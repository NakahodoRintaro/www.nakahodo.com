---
title: ブログ側も本気で最適化した——Docusaurus の PageSpeed を限界まで高めた記録
authors: rintaro
tags: [engineering]
description: ポートフォリオ側に続き、Docusaurusで動くブログ側のPageSpeed改善に着手。LINESeedJP 7.8MBの撤去、フォント非同期化、WebP変換、コントラスト修正の難所、React hydration エラー #418、Cloudflare のメール難読化トラップなど、次々と出てくる問題を潰した記録。
---

ポートフォリオ側の SEO・パフォーマンス改善（[前回の記事](/blog/posts/2026/03/28/pagespeed-seo-100)）に続き、同じ日にブログ側（Docusaurus）も本格的に手をつけた。初期スコアはモバイルで Performance 94 / Accessibility 94 という「悪くはないがまだ伸びる」状態。改善を重ねるたびに新しい問題が出てくる、PageSpeed Insights を繰り返し回した記録。

<!-- truncate -->

---

## 出発点

`nakahodo.com/blog/` は Docusaurus 3.x で動く静的ブログ。Docusaurus の最適化機能のおかげでビルド時点である程度のスコアが出ているが、初回計測では以下の問題が積み重なっていた。

| 項目 | 初期スコア |
|---|---|
| Performance（モバイル） | 94 |
| Accessibility | 94 |
| Best Practices | 96 |
| SEO | 97 |

個別の記事ページ（モバイル）は Performance 85 まで落ちており、ここが最大の改善余地だった。

---

## Step 1: フォント最適化——7.8MB を切り落とす

最初に着手したのがフォント。`custom.css` に `@font-face` 宣言で LINESeedJP が埋め込まれていた。

```css
/* Before: 全ウェイト × 全スクリプトをまるごと読み込んでいた */
@font-face {
  font-family: 'LINESeedJP';
  src: url('/fonts/LINESeedJP_OTF_Rg.woff2') format('woff2');
  ...
}
```

**合計 7.8 MB**。日本語フォントをサブセット化せず全文字を同梱していた結果だ。

### 解決策: システムフォント + Jost

LINESeedJP を完全に撤去し、日本語部分はシステムフォントスタックに切り替えた。

```css
--ifm-font-family-base: 'Jost', 'Hiragino Sans', 'YuGothic', 'Yu Gothic', 'Noto Sans JP', sans-serif;
```

macOS / iOS の Hiragino Sans、Windows の Yu Gothic、Android の Noto Sans JP がそれぞれのデバイスで自動選択される。英文フォントの Jost（ラテン文字のみ）は Google Fonts から非同期で読み込む形に変えた。

### Jost の非同期化

ポートフォリオ側でも使った `media="print"` パターンを `docusaurus.config.ts` の `headTags` に設定する。

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

`custom.css` の `@import` で読んでいた場合は同期・レンダリングブロックになる。`headTags` に移して `media="print"` にすることで、フォントが来るまで描画をブロックしなくなる。

なお、preconnect を手で追加した際に、`@docusaurus/plugin-google-gtag` プラグインが GA4 向けの preconnect を自動で追加しているのに気づかず重複させてしまった。Lighthouse の「4+ 個の preconnect」警告が出たので、GA4 分の手動追加は削除した。プラグインが面倒を見るものを二重に書かないこと。

---

## Step 2: 画像を WebP に変換する

記事ページのモバイルスコアが 85 に落ちていた直接原因は画像サイズだった。

### 問題の画像一覧

| ファイル | 変換前 | 変換後 |
|---|---|---|
| `rin_port.png`（著者アバター） | 1.3 MB（1024×1024） | 9.2 KB（202×202 WebP） |
| `confused-deputy.png` | 164 KB | 17 KB WebP |
| `vnet-apim.png` | 79 KB | 21 KB WebP |
| `icon_03.png` | 256 KB | 9.2 KB（202×202 WebP） |

`rin_port.png` は著者カードに 101px で表示されるのに 1024×1024 の PNG が使われていた。1.3 MB を 9.2 KB にできるのは WebP 変換だけでなく、表示サイズに合わせたリサイズが大きく効いている。

```bash
# 202×202 にリサイズして q=75 で WebP 変換
cwebp -q 75 -resize 202 202 rin_port.png -o rin_port.webp
```

DPR 2.0 のデバイスで 101px 表示 → 必要なピクセル数は 101 × 2 = 202px。これより大きいファイルを送ってもブラウザが縮小するだけでムダになる。

---

## Step 3: アクセシビリティの改善——コントラストの難所

Accessibility 94 → 100 に上げるのが最も時間がかかった。

### コントラスト比の修正

PageSpeed Insights が指摘してきたのは `--page-text-muted`、`time` 要素、`footer__copyright` などの薄い色。WCAG AA の基準は通常テキストで 4.5:1。

| 要素 | 修正前 | 修正後 | コントラスト比 |
|---|---|---|---|
| `--page-text-muted`（ライト） | #9a96a0 | #6e6e6e | 5.1:1（白背景） |
| `--page-text-muted`（ダーク） | #3a3a52 | #9090a8 | 6.3:1（#0a0a0f背景） |
| `time`（ダーク） | #5a5a70 | #8888a0 | 5.5:1（#0a0a0f背景） |
| `footer__copyright` | #2e2e42 | #787890 | 4.8:1（#030305背景） |

**難所:** 最初に修正した値（ダーク `#7c7c8e`）でコントラスト比は満たしているはずなのに、PageSpeed Insights が依然として失敗を報告した。

原因は axe-core（Lighthouse が内部で使うアクセシビリティエンジン）の評価タイミングにある。axe-core が DOM を評価する時点では、JavaScript がまだ `data-theme="dark"` を設定していない可能性がある。つまり **ライトモードの色で評価される**。ダーク側を直しても、ライト側の `#9a96a0`（白背景で 2.9:1）が問題になっていたのだ。

修正方針は「ライトモードでもダークモードでも余裕を持って 4.5:1 を超える値にする」。ぎりぎりではなく大きめにマージンを取ることが重要だった。

### `<main>` ランドマーク

スクリーンリーダーがメインコンテンツに直接ジャンプできる `<main>` タグが `index.tsx` のトップページに欠けていた。既存の `<div>` ラッパーを `<main>` に変更するだけで Accessibility スコアが改善した。

### ソーシャルリンクのタップターゲット

著者カードの GitHub・X・LinkedIn リンクが小さすぎた。iOS の HIG・Android のガイドラインは最小タップターゲットを 44×44px と定めている。

```css
.authorSocialLink_owbf {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

Docusaurus が内部で生成するクラス名（`_owbf` サフィックス）はバージョンによって変わる可能性があるが、現時点ではこれが実際に使われているクラスなので直接指定する。

---

## Step 4: React hydration エラー #418 を直す

Best Practices のスコアに影響していた React エラーを修正した。

エラーメッセージ：

```
Hydration failed because the server rendered HTML didn't match the client.
```

原因は `index.tsx` の日付フォーマット関数が `toLocaleDateString('ja-JP')` を使っていたこと。Node.js の SSR（サーバーサイドレンダリング）とブラウザでは `toLocaleDateString` の出力が異なる場合がある。ロケール処理の実装がランタイムによって微妙に違うためだ。

同様に `views.toLocaleString()` も環境によって桁区切りが変わる。

```tsx
// Before: 環境依存
const date = new Date(iso).toLocaleDateString('ja-JP', { ... });
const viewStr = entry.views.toLocaleString();

// After: UTC ベースで環境非依存
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}
```

UTC メソッド（`getUTCFullYear`, `getUTCMonth`, `getUTCDate`）を使うことで、タイムゾーンに関係なく SSR とブラウザで同じ文字列が生成されるようになり、hydration ミスマッチが解消した。

---

## Step 5: Cloudflare がメールを難読化してくる問題

ある記事（MCPセキュリティの記事）の Performance が急に悪化した。PageSpeed Insights のクリティカルレンダリングパス分析に見慣れないファイルが入っていた。

```
email-decode.min.js  296ms ← Cloudflare が勝手に挿入
```

**Cloudflare Email Obfuscation** という機能が有効になっていると、HTML 内にメールアドレスのパターンが含まれる場合に Cloudflare が自動で難読化スクリプトを注入する。記事のコードブロックに `user@example.com` という例示が含まれていただけで、クリティカルパスに 296ms の外部スクリプトが追加された。

修正は単純で、`@` を全角の `＠`（U+FF20）に置き換えるだけ。Cloudflare のパターンマッチを回避できる。

```
// Before
search_user({ "email": "user@example.com" })

// After
search_user({ "email": "user＠example.com" })
```

コードブロック内の例示アドレスでも容赦なく反応するので、セキュリティ関連の記事で例示アドレスを書くときは注意が必要だ。

---

## CI 改善: ビルドキャッシュを追加する

最後に、GitHub Actions のビルド時間改善として [docuactions/cache](https://github.com/docuactions/cache) を追加した。

```yaml
- name: Cache Docusaurus build
  uses: docuactions/cache@v1
  with:
    working-directory: blog-src
```

`npm install` の後・`generate-posts` の前に挟むだけで、`.docusaurus` と `node_modules/.cache` がキャッシュされる。キャッシュヒット時にビルド時間が 30〜60 秒短縮される見込み。

---

## 最終スコア

記事ページのモバイル計測：

| 項目 | 改善前 | 改善後 |
|---|---|---|
| Performance（モバイル） | 85 | 76〜90（変動あり）|
| Accessibility | 93 | **100** |
| Best Practices | — | **100** |
| SEO | — | **100** |

Performance の数値が「改善前より下がった」ように見えるが、これは PageSpeed Insights のモバイルスコアがネットワーク条件・デバイス性能のシミュレーション結果に大きく左右されるためで、同じ条件でも数値が 10〜15 前後ばらつく。Accessibility / Best Practices / SEO の 3 指標で満点を取れたことが実質的な成果だ。

---

## 残った課題

| 課題 | 理由 |
|---|---|
| キャッシュ TTL 4h | GitHub Pages の仕様。最新のビルドが反映されるまで最大 4 時間かかる |
| GTM / GA4 スクリプト | 計測のために必須。削れない |
| Docusaurus が生成する JS | フレームワーク本体の重さはコントロールできない |

ポートフォリオ側と同じ結論になるが、**自社コードで対処できることをやりきった**状態が現実的なゴールだった。

---

## 振り返り

Docusaurus は「最初から最適化されている」と思っていたが、意外にやることがあった。特に学びになったのは：

- **axe-core のタイミング問題** — PageSpeed Insights のアクセシビリティ監査は `data-theme` が設定される前に走る場合がある。ダークモード対応サイトはライト側の色もきちんと確保しないとスコアに反映されない
- **Cloudflare のメール難読化は容赦ない** — コードブロック内の例示アドレスでも反応する。セキュリティ系の記事には特に注意
- **hydration ミスマッチは `toLocaleString` が多い** — 日付・数値のフォーマットは UTC メソッドで書くか、クライアント専用コンポーネントに切り出す
- **日本語フォントはシステムフォントに任せる** — unicode-range サブセットなしで全文字同梱すると 7.8MB になる。カスタムフォントにこだわるなら自己ホスト＋サブセット化が前提になる

*Live with a Smile!*
