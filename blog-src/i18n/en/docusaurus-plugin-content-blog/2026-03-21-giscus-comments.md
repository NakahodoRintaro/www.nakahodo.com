---
title: Adding Likes and Comments to the Blog — The Choice Between Giscus and AWS
authors: rintaro
tags: [engineering]
description: A record of adding comment and like functionality to a Docusaurus blog. Comparing Giscus and AWS (DynamoDB + Lambda), why I chose Giscus, and the implementation steps.
---

I implemented "likes" and "comments" on the blog — the kind of feature note.com has, where there's a heart button and a comment section under each article.

The implementation itself took a few hours. But the decision process of figuring out *how* to build it was interesting enough to write up.

<!-- truncate -->

## The motivation

Seeing the heart button on note.com articles, I wanted the same thing on my own blog. When someone reads something and feels something, having a place to leave that is good. Comments stop an article from being a one-way street.

---

## My first instinct: AWS

As an engineer, self-implementation was the first thing that came to mind. The architecture would look like:

- **Storing like counts**: DynamoDB (using article path as key, tracking a count)
- **API**: Lambda + API Gateway (simple GET/POST endpoints)
- **Comments**: RDS or DynamoDB + Lambda

The benefits are clear: complete freedom. Anonymous likes, custom UI, no GitHub account required — non-technical readers could participate.

But when I laid out the realistic costs, it started looking less attractive.

| Item | Details |
|---|---|
| Cost | Lambda, API GW, DynamoDB: a few hundred yen/month and up |
| Implementation time | Several days to build the backend |
| Maintenance | Deployment, monitoring, spam prevention all needed |
| Spam protection | Need to set up reCAPTCHA or similar myself |

Building and maintaining infrastructure just for a personal blog's comment section has poor ROI. "I want to build it" — yes. "I want to operate it" — not so much.

---

## Giscus as an alternative

While researching, I came across **Giscus** — a comment system that uses GitHub Discussions as its backend. It hit the right notes in several ways:

- **Free, no ads**: just runs on GitHub's infrastructure
- **Reactions**: heart, 👍, 🎉, and so on — GitHub reactions work out of the box
- **Spam resistant**: requires a GitHub account, so bot spam is much less of an issue
- **Maintenance-free**: no server, nothing to break

The one downside: **commenting and reacting requires a GitHub account**.

If your blog is primarily technical content, the number of readers without a GitHub account is probably small. It could become a barrier if your audience grows beyond that — but if that becomes a real problem, migrating to self-hosted at that point is the right call.

**Start with Giscus, move to AWS when it's not enough.** That's the order I went with.

---

## Implementation: integrating with Docusaurus

The blog runs on Docusaurus — a static site generator, so comments are embedded via an external service.

### 1. GitHub setup

Enable Discussions in the repository Settings, and install the [Giscus GitHub App](https://github.com/apps/giscus).

### 2. Get configuration from giscus.app

At [giscus.app](https://giscus.app/en) configure:

- Repository: your repository
- Discussion category: **Announcements** (only admins and Giscus can create new Discussions)
- Page ↔ discussion mapping: `pathname` (uses each article's URL path as the key)
- Enable reactions: ✓

This generates a `repo-id` and `category-id`.

### 3. Install @giscus/react

```bash
npm install @giscus/react
```

### 4. Create GiscusComponent

Use the `useColorMode` hook to follow Docusaurus light/dark mode switching:

```tsx
import Giscus from '@giscus/react';
import { useColorMode } from '@docusaurus/theme-common';

export default function GiscusComponent() {
  const { colorMode } = useColorMode();

  return (
    <div style={{ marginTop: '3rem' }}>
      <Giscus
        repo="your-username/your-repo"
        repoId="R_xxxxxxxxxxxx"
        category="Announcements"
        categoryId="DIC_xxxxxxxxxxxx"
        mapping="pathname"
        reactionsEnabled="1"
        theme={colorMode === 'dark' ? 'dark_dimmed' : 'light'}
        lang="en"
        loading="lazy"
      />
    </div>
  );
}
```

### 5. Swizzle BlogPostItem/Content to inject it

Docusaurus has a mechanism called **swizzling** — replacing internal framework components. Swizzle `BlogPostItem/Content` in wrap mode to inject Giscus directly after the article body:

```tsx
// src/theme/BlogPostItem/Content/index.tsx
import Content from '@theme-original/BlogPostItem/Content';
import { useBlogPost } from '@docusaurus/plugin-content-blog/client';
import GiscusComponent from '@site/src/components/GiscusComponent';

export default function ContentWrapper(props) {
  const { isBlogPostPage } = useBlogPost();

  return (
    <>
      <Content {...props} />
      {isBlogPostPage && <GiscusComponent />}
    </>
  );
}
```

The `isBlogPostPage` flag ensures Giscus only appears on individual article pages, not on the article listing.

---

## Result

A heart reaction button and comment section now appear at the bottom of each article. Since it's linked to GitHub Discussions, comments are automatically recorded in the repository's Discussions tab.

Compared to self-implementing on AWS: implementation time went from several days to a few hours, and infrastructure cost went to zero. For a personal blog at this stage, this is more than enough.

When the day comes that it's not enough, I'll build on AWS properly.

*Live with a Smile!*
