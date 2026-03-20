/**
 * Fetch top blog posts from GA4 Data API and write to static/ga-ranking.json
 *
 * Required env vars (set as GitHub Actions secrets):
 *   GA4_PROPERTY_ID  — numeric property ID (e.g. "123456789")
 *                      found in GA4 > Admin > Property Settings > Property ID
 *   GA4_CREDENTIALS  — service account JSON key (stringified)
 *                      or set GOOGLE_APPLICATION_CREDENTIALS to a file path
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const CREDENTIALS_JSON = process.env.GA4_CREDENTIALS;

if (!PROPERTY_ID) {
  console.warn('[fetch-ranking] GA4_PROPERTY_ID not set — writing empty ranking.');
  writeEmpty();
  process.exit(0);
}

let clientOptions = {};
if (CREDENTIALS_JSON) {
  clientOptions = { credentials: JSON.parse(CREDENTIALS_JSON) };
}

const client = new BetaAnalyticsDataClient(clientOptions);

// Paths that are NOT article pages
const EXCLUDE_PREFIXES = [
  '/blog/posts/tags/',
  '/blog/posts/archive',
  '/blog/posts/authors',
  '/blog/posts/page/',
];

function isArticlePath(path) {
  if (path === '/blog/posts/' || path === '/blog/posts') return false;
  return !EXCLUDE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Normalize path: ensure trailing slash for consistent dedup
function normalizePath(path) {
  return path.endsWith('/') ? path : path + '/';
}

async function main() {
  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'pagePath',
              stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/' },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/tags/' },
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/archive' },
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/authors' },
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/page/' },
              },
            },
          },
        ],
      },
    },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 50, // fetch more to account for dedup merging
  });

  // Deduplicate by normalized path, summing views, keeping first title seen
  const merged = new Map();
  for (const row of response.rows ?? []) {
    const rawPath = row.dimensionValues[0].value;
    const path = normalizePath(rawPath);
    if (!isArticlePath(path)) continue;
    const title = row.dimensionValues[1].value;
    const views = Number(row.metricValues[0].value);
    const cleanTitle = title.replace(/\s*\|\s*Rintaro Nakahodo.*$/, '').trim();
    if (merged.has(path)) {
      merged.get(path).views += views;
    } else {
      merged.set(path, { path, title: cleanTitle, views });
    }
  }

  const ranking = [...merged.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map((entry, i) => ({ rank: i + 1, ...entry }));

  writeRanking(ranking);
  console.log(`[fetch-ranking] Wrote ${ranking.length} entries.`);
}

function writeRanking(data) {
  const out = join(__dirname, '../static/ga-ranking.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ updatedAt: new Date().toISOString(), ranking: data }, null, 2));
}

function writeEmpty() {
  writeRanking([]);
}

main().catch((err) => {
  console.error('[fetch-ranking] Error:', err.message);
  writeEmpty();
  process.exit(0); // don't break the build
});
