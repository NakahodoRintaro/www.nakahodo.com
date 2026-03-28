---
title: Pushing the Blog's Performance to Its Limits — Optimizing Docusaurus PageSpeed
authors: rintaro
tags: [engineering]
description: Following the portfolio side, I tackled PageSpeed improvements on the Docusaurus blog. A log of removing LINESeedJP's 7.8 MB, async font loading, WebP conversion, the tricky contrast fixes, React hydration error #418, and Cloudflare's email obfuscation trap.
---

Following the SEO and performance improvements on the portfolio side ([previous article](/blog/posts/2026/03/28/pagespeed-seo-100)), I turned my attention to the Docusaurus blog on the same day. The starting point was Mobile Performance 94 / Accessibility 94 — not bad, but with room to improve. Running PageSpeed Insights repeatedly kept surfacing new problems. Here's the full record.

<!-- truncate -->

---

## Starting point

`nakahodo.com/blog/` is a static blog running on Docusaurus 3.x. Docusaurus's built-in optimizations give decent scores out of the box, but the first measurement revealed several stacked issues.

| Metric | Initial score |
|---|---|
| Performance (mobile) | 94 |
| Accessibility | 94 |
| Best Practices | 96 |
| SEO | 97 |

Individual article pages (mobile) dropped to Performance 85 — the biggest gap to close.

---

## Step 1: Font optimization — cutting 7.8 MB

The first thing I tackled was fonts. `custom.css` had `@font-face` declarations embedding LINESeedJP.

```css
/* Before: loading all weights × all scripts in full */
@font-face {
  font-family: 'LINESeedJP';
  src: url('/fonts/LINESeedJP_OTF_Rg.woff2') format('woff2');
  ...
}
```

**7.8 MB total.** The Japanese font was bundled without subsetting — every character included.

### Solution: system fonts + Jost

Removed LINESeedJP entirely and switched to a system font stack for Japanese.

```css
--ifm-font-family-base: 'Jost', 'Hiragino Sans', 'YuGothic', 'Yu Gothic', 'Noto Sans JP', sans-serif;
```

Hiragino Sans on macOS/iOS, Yu Gothic on Windows, and Noto Sans JP on Android each get selected automatically. The Latin-only English font Jost is loaded asynchronously from Google Fonts.

### Async loading for Jost

Using the `media="print"` pattern I'd used on the portfolio side, set up in `docusaurus.config.ts`'s `headTags`:

```typescript
headTags: [
  { tagName: 'link', attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
  { tagName: 'link', attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' } },
  {
    tagName: 'link',
    attributes: {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap',
      media: 'print',
      onload: "this.media='all'",
    },
  },
],
```

Loading fonts via `@import` in `custom.css` is synchronous and render-blocking. Moving to `headTags` with `media="print"` means rendering no longer waits for the font.

One thing to watch: after manually adding `preconnect` entries, I noticed `@docusaurus/plugin-google-gtag` was already auto-adding its own `preconnect` for GA4 — creating duplicates. Lighthouse flagged "4+ preconnect" warnings, so I removed the manual GA4 ones. Don't double up on what a plugin is already handling.

---

## Step 2: Convert images to WebP

The direct cause of article page mobile scores dropping to 85 was image size.

### Problem images

| File | Before | After |
|---|---|---|
| `rin_port.png` (author avatar) | 1.3 MB (1024×1024) | 9.2 KB (202×202 WebP) |
| `confused-deputy.png` | 164 KB | 17 KB WebP |
| `vnet-apim.png` | 79 KB | 21 KB WebP |
| `icon_03.png` | 256 KB | 9.2 KB (202×202 WebP) |

`rin_port.png` was a 1024×1024 PNG being used to display at 101px in the author card. Going from 1.3 MB to 9.2 KB was achieved not just by WebP conversion but by resizing to match the display dimensions.

```bash
# resize to 202×202 and convert to WebP at q=75
cwebp -q 75 -resize 202 202 rin_port.png -o rin_port.webp
```

DPR 2.0 device displaying at 101px → 101 × 2 = 202px needed. Sending anything larger just gets scaled down by the browser — waste.

---

## Step 3: Accessibility improvements — the contrast challenge

Getting from Accessibility 94 to 100 was the most time-consuming part.

### Contrast ratio fixes

PageSpeed Insights flagged `--page-text-muted`, `time` elements, `footer__copyright`, and other light-colored elements. WCAG AA requires a minimum 4.5:1 for normal text.

| Element | Before | After | Contrast ratio |
|---|---|---|---|
| `--page-text-muted` (light) | #9a96a0 | #6e6e6e | 5.1:1 (white bg) |
| `--page-text-muted` (dark) | #3a3a52 | #9090a8 | 6.3:1 (#0a0a0f bg) |
| `time` (dark) | #5a5a70 | #8888a0 | 5.5:1 (#0a0a0f bg) |
| `footer__copyright` | #2e2e42 | #787890 | 4.8:1 (#030305 bg) |

**The tricky part:** I fixed a value for dark mode (`#7c7c8e`) that mathematically satisfied the contrast ratio, yet PageSpeed Insights continued reporting failures.

The cause was axe-core's evaluation timing (Lighthouse's internal accessibility engine). When axe-core evaluates the DOM, JavaScript may not have set `data-theme="dark"` yet — meaning **it evaluates with light mode colors**. Fixing the dark side while leaving light `#9a96a0` (2.9:1 on a white background) still failing was the issue.

The fix strategy: "use values that comfortably exceed 4.5:1 in *both* light and dark modes." Not barely passing — leave a meaningful margin.

### `<main>` landmark

The `index.tsx` top page was missing a `<main>` tag that screen readers need to jump directly to main content. Changing the existing `<div>` wrapper to `<main>` improved the Accessibility score.

### Social link tap targets

The GitHub, X, and LinkedIn links in the author card were too small. iOS HIG and Android guidelines both specify a minimum tap target of 44×44px.

```css
.authorSocialLink_owbf {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

The Docusaurus-generated class names (with `_owbf` suffix) can change between versions, but this is what's actually used right now, so I target it directly.

---

## Step 4: Fixing React hydration error #418

Fixed a React error that was affecting the Best Practices score.

Error message:

```
Hydration failed because the server rendered HTML didn't match the client.
```

The cause was `index.tsx`'s date formatting using `toLocaleDateString('ja-JP')`. The output of `toLocaleDateString` can differ between Node.js SSR and the browser — the locale handling implementation varies subtly between runtimes.

Similarly, `views.toLocaleString()` produces different number formatting depending on the environment.

```tsx
// Before: environment-dependent
const date = new Date(iso).toLocaleDateString('ja-JP', { ... });
const viewStr = entry.views.toLocaleString();

// After: UTC-based, environment-independent
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}
```

Using UTC methods (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`) produces the same string in SSR and the browser regardless of timezone, eliminating the hydration mismatch.

---

## Step 5: Cloudflare email obfuscation

The Performance score on one article (the MCP security post) suddenly dropped. Looking at the critical rendering path analysis in PageSpeed Insights, an unfamiliar file appeared:

```
email-decode.min.js  296ms ← Cloudflare injecting this automatically
```

**Cloudflare Email Obfuscation** — when enabled, Cloudflare automatically obfuscates email address patterns found in HTML by injecting a script. The article's code block contained `user@example.com` as an example, and Cloudflare added a 296ms external script to the critical path because of it.

The fix is simple: replace `@` with the full-width `＠` (U+FF20). This bypasses Cloudflare's pattern matching.

```
// Before
search_user({ "email": "user@example.com" })

// After
search_user({ "email": "user＠example.com" })
```

Even example addresses in code blocks trigger it without mercy — worth keeping in mind for security-related articles.

---

## CI improvement: adding build cache

Finally, for build time improvement, I added [docuactions/cache](https://github.com/docuactions/cache) to GitHub Actions.

```yaml
- name: Cache Docusaurus build
  uses: docuactions/cache@v1
  with:
    working-directory: blog-src
```

Just inserting it after `npm install` and before `generate-posts` caches `.docusaurus` and `node_modules/.cache`. On cache hits, build time should drop by 30–60 seconds.

---

## Final scores

Mobile measurement on article pages:

| Metric | Before | After |
|---|---|---|
| Performance (mobile) | 85 | 76–90 (variable) |
| Accessibility | 93 | **100** |
| Best Practices | — | **100** |
| SEO | — | **100** |

The Performance number may look like it regressed, but PageSpeed Insights mobile scores are heavily influenced by simulated network conditions and device performance — the same setup can vary by 10–15 points. The real achievement is hitting perfect scores on Accessibility, Best Practices, and SEO.

---

## Remaining issues

| Issue | Reason |
|---|---|
| Cache TTL 4h | GitHub Pages limitation. Latest build can take up to 4 hours to reflect |
| GTM / GA4 scripts | Required for analytics. Can't remove |
| Docusaurus-generated JS | Framework bundle weight isn't controllable |

Same conclusion as the portfolio side: **doing everything possible within the codebase we control** is the realistic goal.

---

## Reflections

I thought Docusaurus was "already optimized," but there turned out to be more to do than expected. Key learnings:

- **axe-core timing** — PageSpeed Insights accessibility audits can run before `data-theme` is set. Dark mode sites need to ensure light mode colors also pass
- **Cloudflare email obfuscation is aggressive** — it reacts to example addresses in code blocks. Extra caution needed for security-related articles
- **Hydration mismatches often come from `toLocaleString`** — format dates and numbers with UTC methods, or extract into client-only components
- **Leave Japanese fonts to system fonts** — bundling all characters without unicode-range subsetting hits 7.8 MB. Custom Japanese fonts require self-hosting with subsetting

*Live with a Smile!*
