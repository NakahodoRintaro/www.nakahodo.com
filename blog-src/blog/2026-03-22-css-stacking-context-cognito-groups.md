---
title: CSSのスタッキングコンテキスト地雷と、Cognitoで作るロール管理
authors: rintaro
tags: [engineering]
---

今日は2つのデバッグをした。ひとつはCSSの地雷、もうひとつはAWSの認証基盤まわり。どちらも原因がわかれば「なるほど」で終わるが、そこに至るまでが消耗する。

<!-- truncate -->

---

## CSSのスタッキングコンテキスト地雷

### 症状

スマホでハンバーガーメニューを押すと、ヘッダーだけが動いてメニューの中身が一切出てこない。あるいは、ページが横にずれてメニューが表示されない。

フレームワークが生成するUIコンポーネントなのに壊れている、という状況だった。

### 原因1: `overflow-x: hidden` をルートに置く

横スクロールを防ぐために `html` や `body` に `overflow-x: hidden` を書くことがある。ホームページのカスタムコンポーネントでも同様に書いていた。

```css
html, body {
  overflow-x: hidden;
}
```

これが問題だった。

Docusaurusのモバイルサイドバーは `position: fixed` + `transform: translateX(100%)` で画面外に待機し、メニューが開くと `translateX(0)` にアニメーションする仕組みだ。ところが `overflow-x: hidden` を `html` に設定すると、**その要素が新しい包含ブロック（containing block）になる**。`position: fixed` の基準が変わり、サイドバーが期待通りの場所に配置されなくなる。

修正は削除するだけ。横スクロールを防ぐ目的なら、原因になっているコンポーネント側を直すべきで、ルートに `overflow-x: hidden` を書くのは副作用が大きい。

### 原因2: `backdrop-filter` がスタッキングコンテキストを作る

ナビバーにすりガラス効果をつけていた。

```css
.navbar {
  backdrop-filter: blur(12px);
}
```

**`backdrop-filter` は新しいスタッキングコンテキスト（stacking context）を生成する。**

DocusaurusのモバイルサイドバーはNavbarの子要素として存在する。親要素がスタッキングコンテキストを作ると、その中に含まれる子要素は親の `z-index` スタックの中に閉じ込められる。サイドバーがどれだけ大きな `z-index` を持っていても、Navbar自体がページコンテンツより下のスタックにいれば、サイドバーも一緒に埋もれる。

修正は `::before` 疑似要素にぼかしを移動させること。

```css
.navbar {
  background: transparent;
}

.navbar::before {
  content: '';
  position: absolute;
  inset: 0;
  backdrop-filter: blur(12px);
  z-index: -1;
}
```

こうすると `.navbar` 本体はスタッキングコンテキストを作らなくなり、子要素のサイドバーが正しく全画面に広がれる。

### スタッキングコンテキストを生成するCSSプロパティ

`backdrop-filter` 以外にも、知らず知らずスタッキングコンテキストを作るプロパティは多い。

| プロパティ | 条件 |
|---|---|
| `position: relative/absolute/fixed/sticky` | `z-index` が `auto` 以外のとき |
| `opacity` | `1` 未満のとき |
| `transform` | `none` 以外のとき |
| `filter` | `none` 以外のとき |
| `backdrop-filter` | `none` 以外のとき |
| `will-change` | 上記を指定したとき |
| `isolation: isolate` | 常に |

フレームワークのUIコンポーネントが壊れるとき、原因が自分の書いたCSSにある——というパターンは多い。特に `transform` や `backdrop-filter` を使うときは意識しておきたい。

---

## Cognito Groupsでロール管理

### 状況

フロントエンドのみの構成（S3 + CloudFront）でユーザーのロール管理が必要になった。受講生とインストラクターで見えるUIを変えたい。

### 選択肢

| 方法 | 概要 | 向き不向き |
|---|---|---|
| Cognito カスタム属性 | `custom:role` のような属性をユーザーに持たせる | ユーザー自身が書き換えられるリスクがある |
| Cognito Groups | グループにユーザーを追加、JWTに反映 | 管理者のみ変更可能。サーバー不要で完結 |
| 外部DB（DynamoDBなど） | 別テーブルでロール管理 | 柔軟だがバックエンドが必要 |

今回の構成はサーバーレスなので、Cognito Groupsを選んだ。

### 仕組み

Cognitoでグループにユーザーをアサインすると、そのユーザーのIDトークン（JWT）のペイロードに `cognito:groups` クレームが自動で含まれる。

```json
{
  "sub": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "email": "instructor@example.com",
  "cognito:groups": ["instructors"]
}
```

フロントエンドはJWTのペイロードを読んでロールを判定する。

```typescript
function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

const payload = parseJwt(idToken)
const groups: string[] = payload['cognito:groups'] ?? []
const role = groups.includes('instructors') ? 'instructor' : 'student'
```

これだけでサーバーを持たずにロール判定ができる。

### セキュリティ上の注意点

JWTのペイロードはBase64エンコードされているだけで、誰でも読める。フロントエンドでのロール判定は「UIの出し分け」程度に留め、重要なデータへのアクセス制御はバックエンド（API GatewayやLambdaのオーソライザー）で行うべきだ。

```
フロント: ロールに応じてUIを出し分ける（表示制御）
バックエンド: JWTを検証してAPIアクセスを制御（認可）
```

フロントのみでロール判定を完結させる構成は、API呼び出しが不要な純粋な表示制御に限定するのが安全だ。

---

## 今日の教訓

CSSの地雷は「なぜか壊れる」から始まり、原因がわかると「そういうものか」で終わる。スタッキングコンテキストの仕様を頭に入れておくと、フレームワークUIが壊れたときの調査が速くなる。

Cognito Groupsはサーバーレス構成のロール管理として十分実用的だった。細かいパーミッション制御が必要になったらDynamoDBと組み合わせることになるが、受講生/インストラクター程度のシンプルなロールならこれで足りる。

*Live with a Smile!*
