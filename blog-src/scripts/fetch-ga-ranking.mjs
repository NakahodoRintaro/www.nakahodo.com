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

async function main() {
  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/' },
      },
    },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  });

  const ranking = (response.rows ?? [])
    .filter((row) => row.dimensionValues?.[0]?.value !== '/blog/posts/')
    .map((row, i) => ({
      rank: i + 1,
      path: row.dimensionValues[0].value,
      title: row.dimensionValues[1].value,
      views: Number(row.metricValues[0].value),
    }));

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
