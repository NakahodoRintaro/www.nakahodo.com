---
title: ブログにいいね・コメント機能を追加した——GiscusとAWSで迷った話
authors: rintaro
tags: [engineering]
description: Docusaurusブログにコメント・いいね機能を追加した記録。GiscusとAWS（DynamoDB+Lambda）を比較検討し、Giscusを選んだ理由と実装手順を解説。
---

ブログに「いいね」と「コメント」を実装した。note.com のようにハートボタンがついていて、記事の下にコメントが書ける、あの機能だ。

実装自体は数時間で終わったが、「どうやって作るか」を決めるまでの検討が面白かったので記録しておく。

<!-- truncate -->

## きっかけ

note.com の記事にあるハートボタンを見て、自分のブログにも欲しくなった。読んだ人が何か感じたとき、それを残せる場所がある方がいい。コメント欄があると、記事が一方通行でなくなる。

---

## まず頭に浮かんだのはAWS

エンジニアとして最初に思いつくのは自前実装だった。構成案はこうなる：

- **いいね数の保存**: DynamoDB（記事パスをキーにカウントを保持）
- **API**: Lambda + API Gateway（GET/POSTのシンプルなエンドポイント）
- **コメント**: RDS or DynamoDB + Lambda

メリットは明確で、完全な自由度がある。匿名でいいねできるし、UIも自分で作れる。GitHubアカウントが不要なので、技術者以外の読者も参加できる。

ただ、現実的なコストを整理すると微妙になってくる。

| 項目 | 内容 |
|---|---|
| 費用 | Lambda・API GW・DynamoDBで月数百円〜 |
| 実装工数 | バックエンド構築で数日 |
| 維持管理 | デプロイ・監視・スパム対策が必要 |
| スパム対策 | 自前でreCAPTCHA等を用意する必要 |

個人ブログのコメント機能のために、インフラを建てて維持し続けるのは費用対効果が悪い。「作りたい気持ち」はあるが、「運用したい気持ち」が追いつかない。

---

## Giscusという選択肢

調べていて見つけたのが **Giscus** だ。GitHubのDiscussions機能をバックエンドに使うコメントシステムで、いくつかの点でちょうど良かった。

- **無料・広告なし**: GitHubのインフラに乗っかるだけ
- **リアクション対応**: ハート・👍・🎉など、GitHubのリアクションがそのまま使える
- **スパム耐性**: GitHubアカウントが必要なため、botによるスパムが入りにくい
- **メンテナンスフリー**: サーバーを持たないので壊れない

デメリットは一点だけ——**コメント・リアクションにGitHubアカウントが必要**なこと。

ブログの読者層が技術系・エンジニア中心であれば、GitHubアカウントを持っていない人は少ないと判断できる。読者層が広がって困るようになったら、そのとき自前実装に移行すればいい。

**まず Giscus で始めて、物足りなくなったら AWS に移行する**、という順番にした。

---

## 実装：Docusaurusへの組み込み

ブログは Docusaurus で動いている。静的サイトジェネレーターなので、コメント欄は外部サービスを埋め込む形になる。

### 1. GitHubの準備

リポジトリの Settings → Discussions を有効化し、[Giscus の GitHub App](https://github.com/apps/giscus) をインストールする。

### 2. giscus.app で設定を取得

[giscus.app](https://giscus.app/ja) で以下を設定：

- リポジトリ: 自分のリポジトリ
- Discussion カテゴリ: **Announcements**（管理者と Giscus のみが新しい Discussion を作れるカテゴリ）
- ページとの連携: `pathname`（各記事のURLパスをキーにする）
- リアクションを有効にする: ✓

設定すると `repo-id` と `category-id` が発行される。

### 3. @giscus/react のインストール

```bash
npm install @giscus/react
```

### 4. GiscusComponent の作成

Docusaurus のライトモード・ダークモード切り替えに追従させるため、`useColorMode` フックを使う。

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
        lang="ja"
        loading="lazy"
      />
    </div>
  );
}
```

### 5. BlogPostItem/Content をスウィズルして注入

Docusaurus には **スウィズル**という、フレームワークの内部コンポーネントを差し替える仕組みがある。`BlogPostItem/Content` を wrap モードでスウィズルし、記事本文の直後に Giscus を差し込む。

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

`isBlogPostPage` のフラグで、記事一覧ページには表示せず、記事詳細ページにだけ Giscus を出す。

---

## 結果

記事の末尾にハートリアクションとコメント欄が現れた。GitHubのDiscussionsと連動しているため、コメントが投稿されるとリポジトリのDiscussionsに自動で記録される。

AWSで自前実装した場合と比べて、実装時間は数日→数時間、インフラ費用はゼロになった。個人ブログのフェーズとしては、これで十分だと思っている。

物足りなくなる日が来たら、その時はちゃんと AWS を建てよう。

*Live with a Smile!*
