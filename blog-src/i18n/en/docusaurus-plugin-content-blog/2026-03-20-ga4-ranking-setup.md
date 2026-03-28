---
title: The Struggle of Getting a GA4 Access Ranking onto the Blog's Top Page
authors: rintaro
tags: [engineering]
description: How to use the GA4 Data API to fetch access ranking data at build time and display it on a Docusaurus top page. Step-by-step guide including GitHub Actions integration.
---

I wanted to show an "access ranking" on the blog's top page, so I built a system to pull data from the GA4 Data API at build time. There were more steps than I expected and a few places to get stuck, so I'm writing it up here.

<!-- truncate -->

## What I wanted to do

Automatically display a ranking of most-read articles on the top page of `nakahodo.com/blog/`. Since GA4 (Google Analytics 4) was already set up, using that data was the natural choice.

## Overall structure

- Docusaurus builds the blog
- GitHub Actions fetches ranking data from the GA4 Data API at build time
- The fetched data is written to `static/ga-ranking.json`
- A React component on the top page reads the JSON and renders the ranking

## Pitfall 1: Measurement ID vs. Property ID

GA4 has multiple similar-looking IDs that are easy to mix up.

| Name | Format | Purpose |
|---|---|---|
| Measurement ID | `G-XXXXXXXX` | For embedding the tag on the site |
| Property ID | Numbers only (e.g. `123456789`) | For calling the Data API |

What you pass to the Data API is the **Property ID** (numbers only). Not the Measurement ID.

Where to find the Property ID: GA4 Admin panel → Admin (gear icon) → Property Settings → displayed at the top of the page.

## Pitfall 2: Service account setup

The GA4 Data API requires OAuth authentication. To call it from GitHub Actions, you need a service account. There are a lot of steps.

### Google Cloud setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Library → search for "Google Analytics Data API" and enable it
3. IAM & Admin → Service Accounts → Create Service Account
4. On the Keys tab of the service account you created → Add Key → Create new key → download as JSON

### GA4 setup

GA4 Admin panel → Property Access Management → + → add the service account's email address (`xxx@xxx.iam.gserviceaccount.com`) as a **Viewer**.

If you skip this step, API calls will fail with a permission error.

## Pitfall 3: GitHub Secrets setup

In your GitHub repository: Settings → Secrets and variables → Actions, add the following:

| Secret name | Value |
|---|---|
| `GA4_PROPERTY_ID` | The property ID number |
| `GA4_CREDENTIALS` | The entire contents of the downloaded JSON file |

Open the JSON file in a text editor and paste the whole thing.

## Pitfall 4: No data to show in early days

If GA4 data collection hasn't started yet (no visits to the site), the API returns nothing.

To prevent the build from failing, I wrote out an empty JSON when there's an API error or the environment variables aren't set:

```json
{ "updatedAt": null, "ranking": [] }
```

On the top page, I only render the ranking section when `ranking.ranking.length > 0`, so the section is invisible when there's no data yet.

## GitHub Actions workflow

```yaml
- name: Fetch GA4 ranking
  run: npm run fetch-ranking
  working-directory: blog-src
  env:
    GA4_PROPERTY_ID: ${{ secrets.GA4_PROPERTY_ID }}
    GA4_CREDENTIALS: ${{ secrets.GA4_CREDENTIALS }}
```

A simple setup that fetches the latest ranking data and bakes it into the build on every run.

## Summary

Integrating the GA4 Data API into CI/CD involves a lot of steps, but once configured it runs automatically. The most common stumbling points are confusing Measurement ID with Property ID, and forgetting to add the service account to GA4.
