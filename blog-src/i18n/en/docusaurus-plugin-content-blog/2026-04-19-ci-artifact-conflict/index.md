---
title: "Fixing the GitHub Actions vs blog/ Conflict in Docusaurus + GitHub Pages"
authors: rintaro
tags: [engineering]
image: /img/ogp-ci-artifact-conflict.png
description: "Running Docusaurus on GitHub Pages with GitHub Actions CI caused constant push conflicts: local builds and CI builds kept fighting over the same blog/ directory. Fixed with .git/info/exclude and --force-with-lease."
---

My Docusaurus blog runs on GitHub Pages, built by GitHub Actions. The problem: every push turned into a merge nightmare because my local machine and CI were both writing to the same `blog/` directory.

<!-- truncate -->

---

## Setup and the Problem

The repository looks like this:

```
main branch
├── index.html          ← Portfolio (static HTML)
├── blog/               ← Docusaurus build output
└── blog-src/           ← Docusaurus source
```

GitHub Pages serves straight from the root of `main`. The `blog/` directory holds the built HTML/JS/CSS. GitHub Actions triggers on `blog-src/**` changes, builds, and pushes `blog/` back to `main`.

### What was happening

1. Edit `blog-src/` locally
2. `npm run build` → `rsync build/ blog/` to copy the output
3. Commit both `blog-src/` and `blog/`, then push
4. CI detects the `blog-src/**` change and starts building
5. CI also builds and pushes `blog/` → **different asset hashes = rename conflicts**
6. Next local push is rejected as non-fast-forward
7. Brute-force `git merge -X ours` → conflict again… repeat

Webpack chunk filenames include content hashes, so the same logical file gets committed as `main.a51a8c54.js` by one build and `main.1c070d5d.js` by another. Git sees this as a rename conflict and can't auto-resolve it.

---

## A Second Problem on Top

CI was also failing for a separate reason.

Without a committed `package-lock.json`, `npm install` re-resolved dependencies on every CI run. Locally I had Docusaurus **3.9.2**; CI kept pulling **3.10.0**, which threw a webpack Progress Plugin validation error:

```
ValidationError: Invalid options object. Progress Plugin has been initialized
using an options object that does not match the API schema.
```

Classic "works on my machine" failure — only reproducible in CI.

---

## Solutions

Two separate fixes for two separate problems.

### 1. Pin the version — add package-lock.json and switch to npm ci

```bash
npm install --package-lock-only   # generate lock file without reinstalling
git add blog-src/package-lock.json
```

Update the workflow to use `npm ci` instead of `npm install`:

```yaml title=".github/workflows/blog.yml"
- name: Install dependencies
  # highlight-next-line
  run: npm ci
  working-directory: blog-src
```

`npm ci` reads `package-lock.json` exactly, so CI and local always use the same versions.

### 2. Remove blog/ from local git — .git/info/exclude

`blog/` is CI's job. The local machine shouldn't touch it.

```bash
echo "blog/" >> .git/info/exclude
```

`.git/info/exclude` is a local-only ignore file — like `.gitignore` but it's never committed. After adding this, `blog/` disappears entirely from `git status` and `git add blog/` is rejected:

```bash
$ git add blog/index.html
The following paths are ignored by one of your .gitignore files:
blog
```

**Key point:** `blog/` is still tracked remotely, so GitHub Pages keeps working. Only the local git ignores it.

### 3. Make CI's push conflict-resilient — --force-with-lease

```yaml title=".github/workflows/blog.yml"
- name: Commit and push
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git fetch origin main
    git reset --soft origin/main   # always build on top of latest remote
    git add blog/
    git diff --staged --quiet || git commit -m "build: update blog [skip ci]"
    # highlight-next-line
    git push --force-with-lease origin HEAD:main
```

`git reset --soft origin/main` means CI always starts from whatever is on the remote at fetch time — so any push that happened between the job starting and now gets incorporated automatically. `--force-with-lease` adds a safety check: if the remote moved again between fetch and push, the push fails and CI retries from a fresh run.

---

## Before and After

| | Before | After |
|---|---|---|
| Local blog/ | rsync + commit | Hidden by `.git/info/exclude` |
| `git add blog/` | Allowed (caused conflicts) | Rejected |
| CI push | plain push (failed on conflicts) | `--force-with-lease` (auto-recovers) |
| Docusaurus version | Drifted between local and CI | Pinned via `package-lock.json` |
| Local preview | Build and check blog/ in git | `npm run start` or `npm run serve` |

Now the workflow is: edit `blog-src/`, commit, push. CI handles the build and deploy automatically. No need to touch `blog/` locally.

---

## Takeaway

The root issue was "two writers, one file." Assigning `blog/` exclusively to CI eliminated the conflict at the source.

`.git/info/exclude` is a great tool for this: it makes a directory invisible to local git without touching the remote repo or anyone else's setup.

*Live with a Smile!*
