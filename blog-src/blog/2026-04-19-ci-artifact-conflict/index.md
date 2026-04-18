---
title: "GitHub Actions と blog/ の競合を根本解決した ——Docusaurus × GitHub Pages のビルド成果物問題"
authors: rintaro
tags: [engineering]
image: /img/ogp-ci-artifact-conflict.png
description: "Docusaurus ブログを GitHub Pages でホストし GitHub Actions でビルドする構成で、ローカルと CI が同じ blog/ ディレクトリを奪い合って push 競合が頻発していた。.git/info/exclude と --force-with-lease で根本解決した記録。"
---

Docusaurus ブログを GitHub Actions でビルドして GitHub Pages にデプロイする構成で、ローカルからの push と CI のビルド push が同じ `blog/` ディレクトリを奪い合い、毎回マージ地獄になっていた。

<!-- truncate -->

---

## 構成とその問題点

このブログは次の構成で動いている。

```
リポジトリ main ブランチ
├── index.html          ← ポートフォリオ（静的 HTML）
├── blog/               ← Docusaurus ビルド成果物
└── blog-src/           ← Docusaurus ソース
```

GitHub Pages は `main` ブランチのルートをそのまま配信する。`blog/` はビルドして生成した HTML/JS/CSS を置くディレクトリで、ここが GitHub Pages から配信される。

GitHub Actions は `blog-src/**` が変わるたびに起動し、ビルドして `blog/` を更新し `main` に push する。

### 何が起きていたか

1. ローカルで `blog-src/` を編集
2. `npm run build` → `rsync build/ blog/` でビルド結果をコピー
3. `blog-src/` と `blog/` をまとめてコミット・push
4. CI が `blog-src/**` の変更を検知して起動
5. CI もビルドして `blog/` を push → **ハッシュ付きアセット名が違うので rename 競合**
6. 次のローカル push が `non-fast-forward` で弾かれる
7. `git merge -X ours` で強引に解決 → また競合…の繰り返し

Webpack のチャンクファイルはビルドのたびにハッシュが変わるため、同じファイルが `main.a51a8c54.js` と `main.1c070d5d.js` のように別名でコミットされ、git がこれを rename 競合と認識する。コンテンツ的には「どちらが正しい」かなど判断できないのでマージが詰まる。

---

## 重なっていたもう一つの問題

CI が失敗する別の原因もあった。

`package-lock.json` をコミットしていなかったため、CI の `npm install` が毎回依存を解決し直していた。ローカルで動いていた Docusaurus **3.9.2** のところ、CI は **3.10.0** をインストールし、webpack の Progress Plugin でバリデーションエラーが出てビルドが落ちていた。

```
ValidationError: Invalid options object. Progress Plugin has been initialized
using an options object that does not match the API schema.
```

ローカルでは再現せず、CI だけが赤くなる典型的な「環境差分」バグ。

---

## 解決策

2つの問題を別々に直した。

### 1. バージョン固定 — package-lock.json を追加して npm ci に切り替え

```bash
npm install --package-lock-only   # lock ファイルだけ生成
git add blog-src/package-lock.json
```

ワークフローを `npm install` から `npm ci` に変更。

```yaml title=".github/workflows/blog.yml"
- name: Install dependencies
  # highlight-next-line
  run: npm ci
  working-directory: blog-src
```

`npm ci` は `package-lock.json` を厳密に読むので、CI とローカルが必ず同じバージョンを使う。

### 2. blog/ をローカルから切り離す — .git/info/exclude

`blog/` は CI だけが書き込むべきビルド成果物だと割り切り、ローカルの git から見えなくする。

```bash
echo "blog/" >> .git/info/exclude
```

`.git/info/exclude` はリポジトリに入らないローカル専用の除外設定（`.gitignore` のローカル版）。これを追加すると、`blog/` 以下のファイルが `git status` に一切現れなくなり、`git add blog/` も弾かれる。

```bash
$ git add blog/index.html
The following paths are ignored by one of your .gitignore files:
blog
```

**ポイント：** `blog/` はすでにリモートの git に追跡されているので GitHub Pages は引き続き機能する。ローカルの git だけが「存在しないもの」として扱うだけ。

### 3. CI の push を競合に強くする — --force-with-lease

CI の「Commit and push」ステップで `git push --force-with-lease` を使う。

```yaml title=".github/workflows/blog.yml"
- name: Commit and push
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git fetch origin main
    git reset --soft origin/main   # 常に最新の remote から積み上げる
    git add blog/
    git diff --staged --quiet || git commit -m "build: update blog [skip ci]"
    # highlight-next-line
    git push --force-with-lease origin HEAD:main
```

`git reset --soft origin/main` で fetch した時点の remote HEAD からスタートするため、誰かが間に push しても上書きではなくその上に積む形になる。さらに `--force-with-lease` で、fetch 後に remote が変わっていた場合は自動的に弾かれ、CI が再起動されて再試行される。

---

## 修正後のワークフロー

| | 修正前 | 修正後 |
|---|---|---|
| ローカルでの blog/ | rsync + コミット | `.git/info/exclude` で不可視 |
| `git add blog/` | 可能（競合の原因） | 拒否される |
| CI push | plain push（競合で失敗） | `--force-with-lease`（競合を自動突破） |
| Docusaurus バージョン | CI と差異あり | `package-lock.json` で固定 |
| ローカルのプレビュー | ビルドして blog/ を確認 | `npm run start` または `npm run serve` |

修正後は `blog-src/` だけ編集してそのまま push すれば、CI が勝手にビルド・デプロイまでやってくれる。ローカルで `blog/` を触る必要は一切なくなった。

---

## まとめ

根本の問題は「CI と自分が同じファイルを別々に書いていた」こと。役割を分離して「`blog/` は CI だけが触る」と決めたことで、競合の発生源がなくなった。

`.git/info/exclude` はリモートに影響を与えずローカルだけで効くので、「特定のディレクトリを CI 専用にしたい」という場面で非常に使いやすい。

*Live with a Smile!*
