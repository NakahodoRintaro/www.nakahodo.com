---
title: "Fixing Google Search Console \"Alternate page with proper canonical tag\" in Docusaurus with trailingSlash"
authors: rintaro
tags: [engineering]
image: /img/ogp-gsc-trailing-slash.png
description: "Got a Google Search Console alert about \"Alternate page with proper canonical tag\". The root cause was a mismatch between GitHub Pages' trailing-slash redirects and the canonical URLs Docusaurus generates. One line — trailingSlash: true — fixes it."
---

Got a Google Search Console notification that the fix for "Alternate page with proper canonical tag" was incomplete. The culprit turned out to be a mismatch between how GitHub Pages handles trailing slashes and the canonical URLs Docusaurus generates.

<!-- truncate -->

---

## The Error

The Coverage report in Search Console showed persistent "Alternate page with proper canonical tag" entries.

This status means Google found a page, but its canonical tag points to a **different URL** — so Google treats it as an alternate, not the canonical, and doesn't index it.

---

## Root Cause

The blog is built with Docusaurus v3 and hosted on GitHub Pages.

### How GitHub Pages handles trailing slashes

GitHub Pages serves `index.html` files from directories. When you request a path without a trailing slash, it redirects:

```
GET /blog/posts/2026/03/19/welcome
→ 301 Redirect → /blog/posts/2026/03/19/welcome/
```

In other words, **GitHub Pages automatically redirects no-slash URLs to their trailing-slash equivalents**.

### What Docusaurus was generating

Without `trailingSlash` configured, Docusaurus generates canonical tags and sitemap entries without a trailing slash:

```html
<!-- Docusaurus default (trailingSlash not set) -->
<link rel="canonical" href="https://nakahodo.com/blog/posts/2026/03/19/welcome">
```

Same in the sitemap:

```xml
<loc>https://nakahodo.com/blog/posts/2026/03/19/welcome</loc>
```

### How Google sees it

1. Google crawls the sitemap URL (no slash)
2. GitHub Pages issues a 301 redirect → lands on the slash URL
3. The slash URL's HTML has a canonical pointing to the no-slash URL
4. Google concludes: "the slash URL is an alternate of the canonical no-slash URL"
5. Following the no-slash canonical triggers the redirect again…

Because the canonical URL and the actually-served URL don't match, Google can't decide which one to index.

---

## The Fix

Add `trailingSlash: true` to `docusaurus.config.ts`. One line.

```ts title="docusaurus.config.ts"
const config: Config = {
  url: 'https://nakahodo.com',
  baseUrl: '/blog/',

  // highlight-next-line
  trailingSlash: true,

  ...
};
```

Docusaurus will now generate all URLs with a trailing slash.

**Canonical tag after the fix**

```html
<link rel="canonical" href="https://nakahodo.com/blog/posts/2026/03/19/welcome/">
```

**Sitemap after the fix**

```xml
<loc>https://nakahodo.com/blog/posts/2026/03/19/welcome/</loc>
```

The canonical now matches the URL GitHub Pages actually serves — no redirect needed.

---

## What to Do in Search Console After Deploying

1. Rebuild and deploy the site
2. Resubmit the sitemap in Search Console
3. Use the URL Inspection tool to request indexing for affected pages
4. Click "Validate Fix" in the Coverage report

Google's recrawl takes anywhere from a few days to two weeks. Results won't appear immediately, but once the canonical inconsistency is gone, pages will be indexed progressively.

---

## Summary

| | Before | After |
|---|---|---|
| canonical | `.../welcome` (no slash) | `.../welcome/` (with slash) |
| Sitemap | no slash | with slash |
| Actual served URL | `.../welcome/` (after redirect) | `.../welcome/` |
| Google's verdict | Alternate page | Canonical page |

If you're seeing canonical errors on a GitHub Pages + Docusaurus site, `trailingSlash: true` is the first thing to check.

*Live with a Smile!*
