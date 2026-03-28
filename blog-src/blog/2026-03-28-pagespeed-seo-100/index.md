---
title: 超SEO対策 ——  PageSpeed Insights で限界まで点数を上げた記録
authors: rintaro
tags: [engineering]
description: ポートフォリオサイト nakahodo.com に SEO の基礎実装からPageSpeed Insights のスコア改善まで、一日で徹底的にやりきった。WebP化・srcset・強制リフロー・GA4遅延読み込みなど、コードで対処できることを全部やった記録。
---

ポートフォリオサイトの SEO とパフォーマンスを一日かけて本気で改善した。「ちゃんとやったことがない」状態からスタートし、PageSpeed Insights を繰り返し回しながら指摘を潰していった記録。

<!-- truncate -->

---

## 出発点

### サイト構成

`nakahodo.com` は静的 HTML で作った一枚ページのポートフォリオ。ビルドステップはなく、`index.html` と CSS・JS・画像を GitHub リポジトリに置いて **GitHub Pages** で公開している。カスタムドメインは DNS の CNAME レコードで GitHub Pages に向けている。

```
リポジトリの main ブランチ → GitHub Pages → nakahodo.com
```

ファイルを push すれば数秒で反映される手軽さがある一方、CDN のキャッシュ TTL が 10 分〜数時間に固定されており、配信設定を細かく制御できないという制約もある。後述する「残った課題」はほぼこの制約から来ている。

### SEO の初期状態

デザインにはこだわっていたが、SEO は完全に放置していた。

- `<meta name="description">` なし
- OGP・Twitter Card なし
- canonical なし
- 画像は PNG のまま、width/height 属性もなし
- `<h1>` タグは CSS で代替していた（実際には `<div>`）

PageSpeed Insights を初めて計測したら、モバイルでパフォーマンスが赤。やることが山積みだった。

---

## Step 1: SEO の基礎を整える

まず `<head>` に抜けているものを全部追加した。

### メタタグ

```html
<title>Rintaro Nakahodo — NLP Researcher & Engineer</title>
<meta name="description" content="Rintaro Nakahodo のポートフォリオ。NLP研究者・エンジニア・ゲームプロデューサー。AI・自然言語処理・音楽制作・ゲーム開発に携わっています。">
<link rel="canonical" href="https://nakahodo.com/">
<link rel="alternate" hreflang="ja" href="https://nakahodo.com/">
<link rel="alternate" hreflang="x-default" href="https://nakahodo.com/">
```

### OGP / Twitter Card

```html
<meta property="og:type" content="website">
<meta property="og:title" content="Rintaro Nakahodo — NLP Researcher & Engineer">
<meta property="og:image" content="https://nakahodo.com/img/port04.jpg">
<meta property="og:image:width" content="2000">
<meta property="og:image:height" content="1050">
<meta name="twitter:card" content="summary_large_image">
```

OG 画像は `summary_large_image` のために 1200px 以上・2:1 比率のものを選ぶ必要がある。ポートフォリオ画像の中で条件を満たすものを使った。

### JSON-LD（構造化データ）

Person スキーマと WebSite スキーマを両方追加した。

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Rintaro Nakahodo",
  "url": "https://nakahodo.com/",
  "jobTitle": "NLP Researcher & Engineer",
  "sameAs": [
    "https://github.com/NakahodoRintaro",
    "https://twitter.com/rin_88astro",
    "https://www.linkedin.com/in/rintaro-nakahodo-884305199"
  ]
}
```

### H1 / H2 の整備

`<div>` で代替していたセクション見出しを `<h2>` タグに変更。ヒーローエリアの名前表示は `<h1>` に変更した。見た目はまったく変わらないが、クローラーへの意味付けが変わる。

### サイトマップ

Docusaurus がブログ側の `/blog/sitemap.xml` を自動生成してくれているが、ルートに `sitemap.xml` がなかった。sitemapindex 形式で作成した。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://nakahodo.com/blog/sitemap.xml</loc>
  </sitemap>
</sitemapindex>
```

---

## Step 2: 画像を徹底的に最適化する

PageSpeed が最も強く警告してくるのが画像だった。

### WebP 変換

全 6 枚の PNG/JPG を WebP に変換した。`sips` は macOS の標準ツールだが WebP 出力に対応していないので `cwebp` を使う。

```bash
cwebp -q 82 img/port05.png -o img/port05.webp
```

変換前後の合計サイズ：

| 変換前 | 変換後 |
|---|---|
| 約 6.4 MB | 約 344 KB |

**95% 削減**。これだけでも体感速度が大きく変わる。

### レスポンシブ画像（srcset / sizes）

WebP 変換だけでは不十分で、デバイス DPR に応じて最適なサイズの画像を配信する必要がある。PageSpeed Insights はデバイスの DPR（1.44 〜 1.75）を使って「このサイズが必要」と計算してくる。

```html
<picture>
  <source
    srcset="img/port05-1x.webp 672w, img/port05-968.webp 968w, img/port05-sm.webp 1080w, img/port05-md.webp 1202w, img/port05.webp 1344w"
    sizes="(max-width: 640px) 617px, 672px"
    type="image/webp"
  >
  <img src="img/port05.png" alt="Mosquito interaction" width="1344" height="748">
</picture>
```

`sizes` 属性は「このビューポート幅のとき、画像は何 px で表示されるか」を教えるもの。固定値を書いていると、DPR が 1.75 のモバイルで `672 × 1.75 = 1176px` のファイルが必要になり、隣の `1202w` が選ばれてしまう。`617px` と宣言することで、`617 × 1.75 = 1079px` → `1080w` が選ばれるようになる。

DPR 別にどのファイルが選ばれるか：

| DPR | 必要 px | 選択されるファイル |
|---|---|---|
| 1.0 | 672 | port05-1x.webp (43 KB) |
| 1.44 | 968 | port05-968.webp (72 KB) |
| 1.6 | 1075 | port05-sm.webp (85 KB) |
| 1.79 | 1203 | port05-md.webp (99 KB) |
| 2.0 | 1344 | port05.webp (116 KB) |

---

## Step 3: 強制リフローを潰す

PageSpeed の「強制リフロー」警告は、JavaScript がレイアウト計算後にすぐ `offsetWidth` などを読み取ることで、ブラウザに再計算を強制するもの。

### Before: `requestAnimationFrame` での読み取り

```javascript
requestAnimationFrame(() => {
  const stageW = stage.offsetWidth; // ← ここで強制リフロー
  ...
});
```

rAF 内でも、直前に DOM 書き込みがあれば読み取り時に再計算が走る。

### After: `ResizeObserver` でキャッシュ

```javascript
let stageW = 0;
const ro = new ResizeObserver(entries => {
  stageW = entries[0].contentRect.width; // ← レイアウト後に受け取る（リフロー不要）
  ...
});
ro.observe(stage);
```

`ResizeObserver` のコールバックはブラウザのレイアウトフェーズ**後**に呼ばれるため、`offsetWidth` を読まずにサイズを取得できる。アニメーションループ内での DOM 読み取りがゼロになった。

---

## Step 4: レンダリングブロックを排除する

### Google Fonts の非同期化

```html
<!-- Before: レンダリングブロック -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">

<!-- After: 非同期読み込み -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...&display=swap"
      media="print" onload="this.media='all'">
```

`media="print"` にしておくと通常画面描画に使われないため、ブラウザは非同期でダウンロードする。ロード完了後に `onload` で `media='all'` に変更して適用する。

### lite-yt-embed.css のインライン化

外部 CSS ファイルは HTML の解析をブロックする。2.3KB の lite-yt-embed.css を `<style>` タグにインライン化することでクリティカルパスから除外した。

```
クリティカルパスの最大待ち時間: 537 ms → 0 ms（この CSS に限る）
```

### GA4 の遅延読み込み

GA4 のスクリプトがモバイルで 53ms の強制リフローを起こしていることが PageSpeed Insights で判明した。`window.load` 後に動的挿入することで初期描画への干渉をなくした。

```javascript
window.addEventListener('load', function() {
  var s = document.createElement('script');
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-X5FV7SNY8N';
  s.async = true;
  document.head.appendChild(s);
});
```

---

## Step 5: アクセシビリティ

PageSpeed Insights のアクセシビリティ監査で、スクロールティッカーのテキストが低コントラストと判定された。

```css
/* Before: コントラスト比 3.6:1（WCAG AA 4.5:1 未満）*/
.ticker-item {
  color: var(--accent); /* #c8a96e */
  opacity: 0.6;
}

/* After: コントラスト比 約 7:1（WCAG AAA 相当）*/
.ticker-item {
  color: var(--accent);
  opacity: 0.85;
}
```

`opacity: 0.6` で暗い背景 `#0f0f1a` に対するコントラストが 3.6:1 まで落ちていた。`0.85` に上げることで 7:1 を確保した。

---

## 残った課題

いくら最適化しても、GitHub Pages がホストである限り変えられないものがある。

| 課題 | 理由 |
|---|---|
| キャッシュ TTL 4h | GitHub Pages の仕様。CDN 移行でのみ解決可能 |
| Google Fonts 60KB | フォント CSS には使わない unicode-range の `@font-face` が大量に含まれる。自己ホストで解決可能 |
| GTM の未使用 JS 62KB | GA4 に必須。削れない |

「100点を目指す」と言っておきながら、キャッシュと外部スクリプトの問題は構造的に解決できない。PageSpeed Insights のスコアは「測定のたびに変動する推定値」であることも考慮すると、**自社コードでできることをやりきった**状態が現実的なゴールだった。

---

## 振り返り

最初は「OGP タグを入れるだけでしょ」くらいの温度感だったが、PageSpeed Insights を繰り返し回すと次々と問題が出てきた。

特に学びになったのは：

- **srcset は数字だけ書いても意味がない** — `sizes` との組み合わせで初めて機能する
- **ResizeObserver と requestAnimationFrame は別物** — rAF はタイミングの話、RO はレイアウト後フックの話
- **GA4 自身がリフローを起こす** — ページ描画前に読み込むと PageSpeed Insights のスコアに影響する


最終的に「コードで対処できる問題」はほぼ全部対応した。残りはホスティング選択の問題。

*Live with a Smile!*
