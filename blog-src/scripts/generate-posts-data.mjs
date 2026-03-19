/**
 * Read blog markdown files and generate static/posts-data.json
 * Run before docusaurus build.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, '../blog');
const OUT_FILE = join(__dirname, '../static/posts-data.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }
  return fm;
}

function parseTags(raw) {
  if (!raw) return [];
  const arr = raw.match(/\[([^\]]*)\]/);
  if (arr) return arr[1].split(',').map((t) => t.trim()).filter(Boolean);
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

function getPermalink(filename, fm) {
  if (fm.slug) return `/blog/posts/${fm.slug}/`;
  const base = filename.replace(/\.mdx?$/, '');
  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})-(.*)/);
  if (m) return `/blog/posts/${m[1]}/${m[2]}/${m[3]}/${m[4]}/`;
  return `/blog/posts/${base}/`;
}

function getDescription(content, fm) {
  if (fm.description) return fm.description;
  const body = content.replace(/^---[\s\S]*?---/, '').replace(/<!--.*?-->/g, '').trim();
  const first = body.split(/\n\n/)[0].replace(/[#*`\[\]()]/g, '').trim();
  return first.slice(0, 120);
}

const files = readdirSync(BLOG_DIR)
  .filter((f) => /\.(md|mdx)$/.test(f) && !f.startsWith('_') && !/^authors|tags/.test(f));

const posts = files.map((filename) => {
  const content = readFileSync(join(BLOG_DIR, filename), 'utf-8');
  const fm = parseFrontmatter(content);
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : (fm.date ?? '');

  return {
    title: fm.title ?? filename,
    date,
    permalink: getPermalink(filename, fm),
    tags: parseTags(fm.tags),
    description: getDescription(content, fm),
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify({ posts }, null, 2));
console.log(`[generate-posts-data] Wrote ${posts.length} post(s).`);
