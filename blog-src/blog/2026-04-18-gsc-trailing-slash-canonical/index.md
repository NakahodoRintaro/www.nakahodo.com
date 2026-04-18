---
title: "Google Search Console「代替ページ（適切な canonical タグあり）」を Docusaurus の trailingSlash で解決した"
authors: rintaro
tags: [engineering]
image: /img/ogp-gsc-trailing-slash.png
description: "Google Search Console から「代替ページ（適切な canonical タグあり）」エラーが届いた。原因は GitHub Pages のトレーリングスラッシュリダイレクトと Docusaurus の canonical URL の不一致。trailingSlash: true を設定するだけで解決できる。"
---

Google Search Console から「代替ページ（適切な canonical タグあり）」の修正が完了しなかった旨のメールが届いた。調べてみると、GitHub Pages のリダイレクト挙動と Docusaurus が生成する canonical タグのトレーリングスラッシュが噛み合っていなかった。

<!-- truncate -->

---

## エラーの内容

Search Console の Coverage レポートに「代替ページ（適切な canonical タグあり）」が残っていた。英語では **"Alternate page with proper canonical tag"**。

この状態は、Google がページを発見したものの、canonical タグが指す URL が**アクセスした URL と異なる**ため、インデックスに登録せず「代替版」扱いにしていることを意味する。

---

## 原因の特定

ブログは Docusaurus v3 で構築し、GitHub Pages でホストしている。

### GitHub Pages のリダイレクト挙動

GitHub Pages は、ディレクトリ内の `index.html` に対して次のような挙動をする。

```
GET /blog/posts/2026/03/19/welcome
→ 301 Redirect → /blog/posts/2026/03/19/welcome/
```

つまり**トレーリングスラッシュなし URL にアクセスすると、スラッシュあり URL へ自動リダイレクト**される。

### Docusaurus が生成していた canonical タグ

一方、Docusaurus（`trailingSlash` 未設定）が生成する canonical タグはスラッシュなしだった。

```html
<!-- Docusaurus デフォルト（trailingSlash 未設定） -->
<link rel="canonical" href="https://nakahodo.com/blog/posts/2026/03/19/welcome">
```

サイトマップも同様。

```xml
<loc>https://nakahodo.com/blog/posts/2026/03/19/welcome</loc>
```

### Google の認識の流れ

1. サイトマップの URL（スラッシュなし）を Google がクロール
2. GitHub Pages が 301 リダイレクト → スラッシュあり URL に到達
3. スラッシュあり URL の HTML を読むと canonical はスラッシュなし URL を指している
4. Google は「スラッシュあり URL はスラッシュなし URL の代替ページ」と判断
5. スラッシュなし URL を辿ると再びリダイレクト…

canonical が指す URL と実際に配信される URL が一致しないため、Google がどちらをインデックスすべきか判断できなくなっていた。

---

## 修正

`docusaurus.config.ts` に `trailingSlash: true` を1行追加するだけ。

```ts title="docusaurus.config.ts"
const config: Config = {
  url: 'https://nakahodo.com',
  baseUrl: '/blog/',

  // highlight-next-line
  trailingSlash: true,

  ...
};
```

これで Docusaurus はすべての URL をスラッシュあり形式で生成する。

**修正後の canonical タグ**

```html
<link rel="canonical" href="https://nakahodo.com/blog/posts/2026/03/19/welcome/">
```

**修正後のサイトマップ**

```xml
<loc>https://nakahodo.com/blog/posts/2026/03/19/welcome/</loc>
```

GitHub Pages が配信するスラッシュあり URL と canonical が一致し、リダイレクトも不要になった。

---

## 修正後に Search Console でやること

1. サイトを再ビルド・デプロイ
2. Search Console で「サイトマップを再送信」
3. 問題のページを URL 検査ツールで「インデックス登録をリクエスト」
4. Coverage レポートで「修正を検証」

Google の再クロールには数日〜2週間かかる。すぐに結果は出ないが、canonical の不整合が解消されれば順次インデックスに登録されていく。

---

## まとめ

| | 修正前 | 修正後 |
|---|---|---|
| canonical | `.../welcome`（スラッシュなし） | `.../welcome/`（スラッシュあり） |
| サイトマップ | スラッシュなし | スラッシュあり |
| 実際の配信 URL | `.../welcome/`（リダイレクト後） | `.../welcome/` |
| Google の判断 | 代替ページ | 正規ページ |

GitHub Pages × Docusaurus の組み合わせで canonical エラーが出ていたら、まず `trailingSlash: true` を疑ってみてほしい。

*Live with a Smile!*
