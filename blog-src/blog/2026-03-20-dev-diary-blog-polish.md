---
title: ブログを育てる一日——CSSと格闘しながらサイトを磨いた記録
authors: rintaro
tags: [engineering, life]
---

朝から晩までブログの細かいところをひたすら直し続けた。機能追加というより「なんか違う」を潰す日だった。地味だが、こういう日が積み重なってサイトが育っていく。

<!-- truncate -->

## プロフィールサイドバーをつくる

ブログのトップページに著者プロフィールを置くことにした。「誰が書いているかわからないブログは読んでいてさびしい」という理由で。

実装自体はシンプルで、Reactコンポーネントに `position: sticky; top: 5rem` を指定してサイドバー化するだけ。PC幅では右側に固定表示され、スクロールしても追いかけてくる。

---

## アイコン画像が表示されない

プロフィールカードにアイコン画像を `src="/img/icon.png"` で指定したが、表示されなかった。

原因は `baseUrl` の罠。このブログは `nakahodo.com/blog/` に置いてある関係で、Docusaurusの設定に `baseUrl: '/blog/'` が入っている。絶対パスで `/img/icon.png` と書くと、ブラウザは `nakahodo.com/img/icon.png` を見に行く。正しくは `/blog/img/icon.png`。

似たような罠は以前の著者アイコン設定でも踏んでいたのに、また踏んだ。

---

## モバイルメニューを全面刷新する

既存のモバイルメニューはナビバー直下にリストが展開されるシンプルなもので、スマホで使うには少し窮屈だった。フルスクリーンオーバーレイ型に刷新することにした。

ポートフォリオ側の `index.html` はJavaScriptで自由に書けるので難しくない。オーバーレイ用のDOMを追加して、クラスのトグルでCSSアニメーションを制御する。

```javascript
function openMenu() {
  hamburger.classList.add('is-open');
  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden'; // 背景スクロールを止める
}
```

問題はブログ側（Docusaurus）だった。Docusaurusはフレームワークが生成するHTMLに直接手を入れられないので、CSSだけでモバイルサイドバーをフルスクリーンに見せる必要がある。

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

`!important` を多用する少し不格好な書き方になったが、フレームワークのスタイルを上書きするためにはやむを得ない。`cubic-bezier(0.23, 1, 0.32, 1)` はいわゆるeaseOutQuintに近い値で、勢いよく開いてピタっと止まる感じが出る。

---

## z-indexの罠：×ボタンで閉じられない

メニューが開いた後、右上の×ボタンをタップしても閉じられないバグが出た。

スタックの状況を整理すると：

| 要素 | z-index |
|---|---|
| nav（ハンバーガーボタンの親） | 500 |
| オーバーレイ | 999 |

オーバーレイが開くと、navよりz-indexが高いオーバーレイが手前に来る。ナビバーごとハンバーガーボタンが覆われてしまい、クリックイベントが届かなくなっていた。

修正は1行。`z-index: 500` を `z-index: 1000` にするだけ。

```css
nav {
  z-index: 1000; /* 1000 > オーバーレイの999 */
}
```

原因がわかれば秒で直るが、スマホで動作確認しながら原因を特定するまでが地味に消耗する。

---

## GA4ランキングにタグページが混入していた

アクセスランキングに `/posts/tags/engineering/` のようなタグ一覧ページが混じっていた。また同じ記事が重複するケースもあった。

**タグページの混入**

APIのフィルタが `/blog/posts/` で始まるパスを取得するものだったため、タグページも引っかかっていた。除外フィルタを追加して対処：

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

**重複エントリ**

GA4はURL末尾のスラッシュあり・なしを別URLとして集計することがある。また、ページタイトルが変わると同一URLでも別行になる。

正規化してから `Map` で集約することで対処した：

```javascript
const path = rawPath.endsWith('/') ? rawPath : rawPath + '/';
if (merged.has(path)) {
  merged.get(path).views += views;
} else {
  merged.set(path, { path, title, views });
}
```

さらにGA4が返すタイトルには `| Rintaro Nakahodo | Blog` というサイト名が付いていたので、正規表現で除去した。

```javascript
const cleanTitle = title.replace(/\s*\|\s*Rintaro Nakahodo.*$/, '').trim();
```

---

## ライト/ダークモードがヘッダーしか変わらない

テーマ切り替えボタンを押してみたら、ナビバーの色は変わるのにページ本体が変わらなかった。

原因はCSSにハードコードの色を直書きしていたから：

```css
/* ❌ テーマに反応しない */
.page {
  background: #0a0a0f;
  color: #e4e0d8;
}
```

Docusaurusのテーマ切り替えは `<html data-theme="dark">` / `<html data-theme="light">` を切り替えるだけで、ハードコードの色値はその変化を検知できない。

修正はCSSカスタムプロパティに全部置き換えること。`custom.css` でライト/ダークそれぞれの値を定義し、`index.module.css` は変数だけ参照するようにした：

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

色を一箇所で管理できるようになり、今後テーマを追加したくなったときも楽になった。

---

## 今日の感想

大きな機能は何も増えていない。でもバグが潰れて、表示が正しくなって、操作感が良くなった。こういう日の積み重ねがサイトの完成度を上げていく。

z-indexのバグを直すのに費やした時間と、直ったときの達成感の比率がおかしい気もするが、それがフロントエンドというものかもしれない。

*Live with a Smile!*
