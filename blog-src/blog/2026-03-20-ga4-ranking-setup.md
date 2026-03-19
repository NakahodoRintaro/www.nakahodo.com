---
title: Google AnalyticsのアクセスランキングをブログのTOPページに出すまでの苦労
authors: rintaro
tags: [engineering]
---

ブログのトップページに「アクセスランキング」を表示したくて、GA4 Data APIを使ってビルド時にデータを取得する仕組みを作った。思ったより手順が多くてハマりポイントもあったのでまとめておく。

<!-- truncate -->

## やりたかったこと

nakahodo.com/blog/ のトップページに、よく読まれた記事のランキングを自動で表示したい。GA4（Google Analytics 4）はすでに設定していたので、そのデータを活用することにした。

## 全体の構成

- Docusaurus でブログをビルド
- GitHub Actions でビルド時に GA4 Data API からランキングデータを取得
- 取得したデータを `static/ga-ranking.json` に書き出し
- トップページのReactコンポーネントでJSONを読み込んで表示

## ハマりポイント1：測定IDとプロパティIDの違い

GA4には似たようなIDが複数あって最初に混乱した。

| 名前 | 形式 | 用途 |
|---|---|---|
| 測定ID | `G-XXXXXXXX` | サイトへのタグ埋め込み用 |
| プロパティID | 数字のみ（例: `123456789`） | Data API呼び出し用 |

Data APIに渡すのは**プロパティID**（数字のみ）。測定IDではない。

プロパティIDの確認場所：GA4管理画面 → 管理（歯車）→ プロパティの設定 → ページ上部に表示。

## ハマりポイント2：サービスアカウントの設定

GA4 Data APIはOAuth認証が必要で、GitHub Actionsから呼ぶにはサービスアカウントを使う。手順が多い。

### Google Cloud側の設定

1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」→「Google Analytics Data API」を有効化
3. 「IAMと管理」→「サービスアカウント」→「サービスアカウントを作成」
4. 作成したサービスアカウントの「キー」タブ → 「新しい鍵を作成」→ JSON でダウンロード

### GA4側の設定

GA4管理画面 → 「プロパティのアクセス管理」→「＋」→ サービスアカウントのメールアドレス（`xxx@xxx.iam.gserviceaccount.com`）を**閲覧者**として追加。

これを忘れると APIを叩いても権限エラーになる。

## ハマりポイント3：GitHub Secretsの設定

GitHub リポジトリの Settings → Secrets and variables → Actions に以下を追加：

| Secret名 | 値 |
|---|---|
| `GA4_PROPERTY_ID` | プロパティIDの数字 |
| `GA4_CREDENTIALS` | ダウンロードしたJSONファイルの内容全体 |

JSONはファイルをテキストエディタで開いてまるごとコピペする。

## ハマりポイント4：データがない期間はランキングを非表示にする

GA4のデータ収集が有効になっていない（サイトへのアクセスがまだない）段階では、APIを叩いてもデータが返ってこない。

ビルドが落ちないように、APIエラー時や環境変数未設定時は空のJSONを書き出すようにした。

```json
{ "updatedAt": null, "ranking": [] }
```

トップページ側でも `ranking.ranking.length > 0` の場合のみランキングセクションを表示するようにして、データがない間はセクション自体を非表示にしている。

## GitHub Actionsのワークフロー

```yaml
- name: Fetch GA4 ranking
  run: npm run fetch-ranking
  working-directory: blog-src
  env:
    GA4_PROPERTY_ID: ${{ secrets.GA4_PROPERTY_ID }}
    GA4_CREDENTIALS: ${{ secrets.GA4_CREDENTIALS }}
```

ビルドのたびに最新のランキングデータを取得してビルドに含めるシンプルな構成。

## まとめ

GA4 Data APIをCI/CDに組み込むのは手順が多いが、一度設定してしまえばあとは自動で動く。測定IDとプロパティIDの混同、サービスアカウントのGA4への追加忘れあたりが躓きやすいポイントだった。
