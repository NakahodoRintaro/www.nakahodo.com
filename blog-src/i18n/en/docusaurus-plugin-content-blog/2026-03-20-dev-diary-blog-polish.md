---
title: A Day of Growing the Blog — Grinding Through CSS to Polish the Site
authors: rintaro
tags: [engineering, life]
description: A day spent fixing small things across the blog from morning to night. Not really adding features — just killing off every "something feels off." A log of CSS, Docusaurus, sidebar, and profile implementation work.
---

From morning to night, I kept fixing small things across the blog. It wasn't about adding features — it was a day of hunting down every "something feels off." Unglamorous work, but it's days like this that make a site grow.

<!-- truncate -->

## Building the profile sidebar

I decided to put an author profile on the blog's top page — because "a blog where you can't tell who's writing it feels lonely."

The implementation itself is simple: set `position: sticky; top: 5rem` on a React component to make it a sidebar. On desktop it stays fixed on the right side and follows you as you scroll.

---

## Icon image not showing

I set the profile card icon image with `src="/img/icon.png"`, but it didn't show up.

The culprit was the `baseUrl` trap. This blog lives at `nakahodo.com/blog/`, so Docusaurus is configured with `baseUrl: '/blog/'`. Writing an absolute path like `/img/icon.png` tells the browser to look at `nakahodo.com/img/icon.png`. The correct path is `/blog/img/icon.png`.

I'd already fallen into this exact trap with the author icon config before, and I fell into it again.

---

## Overhauling the mobile menu

The existing mobile menu was a simple list that expanded below the navbar — a bit cramped on a phone. I decided to rebuild it as a fullscreen overlay.

### Portfolio side

The portfolio's `index.html` is free-form JavaScript, so it's not hard. Add an overlay DOM element and toggle CSS animations with class toggling.

```javascript
function openMenu() {
  hamburger.classList.add('is-open');
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden'; // stop background scrolling
}
```

### Blog side (Docusaurus)

The tricky part was the Docusaurus side. Since Docusaurus generates its own HTML that can't be edited directly, I had to make the mobile sidebar look fullscreen using CSS alone.

```css
.navbar-sidebar {
  width: 100% !important;
  background: rgba(6, 6, 12, 0.97) !important;
  transform: translateX(100%);
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1) !important;
}

.navbar-sidebar--show .navbar-sidebar {
  transform: translateX(0);
}
```

Using a lot of `!important` felt a bit ugly, but it was unavoidable for overriding framework styles. The `cubic-bezier(0.23, 1, 0.32, 1)` is close to easeOutQuint — it springs open and snaps to a stop.

---

## The z-index trap: can't close with the × button

After the menu opened, tapping the × button in the top-right did nothing.

### Root cause

Looking at the stacking order:

| Element | z-index |
|---|---|
| nav (hamburger button's parent) | 500 |
| Overlay | 999 |

When the overlay opens, it sits in front of the nav at a higher z-index. The navbar — and the hamburger button inside it — gets covered by the overlay, so click events never reach it.

### Fix

One line. Change `z-index: 500` to `z-index: 1000`.

```css
nav {
  z-index: 1000; /* 1000 > overlay's 999 */
}
```

Once you know the cause it's a one-second fix, but identifying the cause while testing on a phone is quietly exhausting.

---

## Tag pages leaking into the GA4 ranking

Tag listing pages like `/posts/tags/engineering/` were showing up in the access ranking. Same article appearing twice was also happening.

### Tag page leakage

The API filter was pulling paths starting with `/blog/posts/`, which caught tag pages too. Added an exclusion filter:

```javascript
{
  notExpression: {
    filter: {
      fieldName: 'pagePath',
      stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/posts/tags/' },
    },
  },
}
```

### Duplicate entries

GA4 sometimes counts trailing-slash and no-trailing-slash URLs as separate entries. It also creates separate rows for the same URL when the page title changes.

Fixed by normalizing paths and aggregating with a `Map`:

```javascript
const path = rawPath.endsWith('/') ? rawPath : rawPath + '/';
if (merged.has(path)) {
  merged.get(path).views += views;
} else {
  merged.set(path, { path, title, views });
}
```

GA4 also appends `| Rintaro Nakahodo | Blog` to titles, so I stripped that with a regex:

```javascript
const cleanTitle = title.replace(/\s*\|\s*Rintaro Nakahodo.*$/, '').trim();
```

---

## Light/dark mode only changing the header

When I clicked the theme toggle, the navbar color changed but the page body didn't.

### Root cause

I had hard-coded color values directly in CSS:

```css
/* ❌ doesn't respond to theme changes */
.page {
  background: #0a0a0f;
  color: #e4e0d8;
}
```

Docusaurus theme switching just toggles `<html data-theme="dark">` / `<html data-theme="light">` — hard-coded values can't detect that change.

### Fix

Replace everything with CSS custom properties. Define light and dark values in `custom.css`, and have `index.module.css` only reference variables:

```css
/* custom.css */
:root {
  --page-profile-bg: #f8f5ef;
  --page-border: #e0dbd0;
  --page-text-muted: #9a96a0;
}
[data-theme='dark'] {
  --page-profile-bg: #0d0d14;
  --page-border: #1a1a24;
  --page-text-muted: #3a3a52;
}

/* index.module.css */
.profileCard {
  background: var(--page-profile-bg);
}
```

Colors are now managed in one place, and adding more themes in the future will be much easier.

---

## Thoughts on the day

Nothing big was added. But bugs were squashed, rendering was corrected, and the feel of things got better. Days like this are what slowly push a site toward completion.

The ratio of time spent tracking down that z-index bug to the satisfaction of fixing it seems off — but maybe that's just frontend development.

*Live with a Smile!*
