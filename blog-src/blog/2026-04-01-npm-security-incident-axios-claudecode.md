---
title: 2026年3月31日、npmで何が起きたのか——Claude Codeソースコード流出とaxios乗っ取りを読み解く
authors: rintaro
tags: [engineering, ai]
description: 同じ日に起きた2つのnpmセキュリティ事件を解説。Anthropicの設定ミスによるClaude Codeのソースコード全漏洩と、axiosの乗っ取りによるマルウェア配布。実際のソースコードを確認した上で、背景・影響・対策をまとめた。
---

2026年3月31日、npmまわりで2つのセキュリティ事件が同時に起きた。

ひとつは「Anthropicが設定ファイルの一行を書き忘れて、Claude Codeのソースコードを丸ごと公開してしまった」話。もうひとつは「週に1億ダウンロードされるaxiosのnpmアカウントが乗っ取られ、マルウェアが配布された」話。性質はまったく異なるが、どちらも「npmというインフラへの信頼」を揺るがす事件だった。

<!-- truncate -->

---

## 【事件①】Claude Codeのソースコードが全部漏れた——原因は`.map`ファイル1つ

### 発端：セキュリティ研究者の1ツイート

2026年3月31日、セキュリティ研究者のChaofan Shou（@Fried_rice）がこうツイートした。

> "Claude code source code has been leaked via a map file in their npm registry!"

Claude Codeのnpmパッケージ（v2.1.88）に59.8 MBのソースマップファイルが同梱されており、そこからAnthropicのCloudflare R2バケット上にホストされたソースコードのZIPにアクセスできる——という内容だった。

タイミングが3月31日だったこともあり、「April Foolsでは？」という反応も多かった。Xのリプライでは「Claude CodeのリポジトリはすでにGitHubに公開されている」「コードが不完全で動かない」という指摘もあった。

ただし実際に流出したZIPを確認したところ、**TypeScriptファイル1,902個、合計512,000行超**が含まれており、内容は本物だった。

### ソースマップとは何か

JavaScriptのビルドツールはコードを圧縮・難読化する。ソースマップはそれを逆引きするためのファイルで、`sourcesContent` フィールドにオリジナルのソースコードが文字列としてすべて格納されている。

```json
{
  "version": 3,
  "sources": ["../src/main.tsx", "../src/tools/BashTool.ts"],
  "sourcesContent": ["// 元のコードが全部ここに入っている"],
  "mappings": "AAAA..."
}
```

開発中はデバッグに欠かせないが、npmに公開するときに含めると、コードが筒抜けになる。

### なぜ漏れたか

Claude CodeはBunでビルドされている。Bunはデフォルトでソースマップを生成する。Anthropicの誰かが以下のどちらかを忘れた。

- `bunfig.toml` や `bun.build.ts` に `sourcemap: "none"` を設定する
- `.npmignore` に `*.map` を追加する

たった一行の書き忘れで、`npm publish` 時にソースコードが世界に公開された。

### 実際に何が流出していたか

流出したコードを実際に確認した。主な内容は以下のとおりだ。

| 流出した内容 | 詳細 |
|---|---|
| **システムプロンプト全文** | Claudeの挙動を制御するすべての指示。プロンプトキャッシュ戦略やモジュール構成も含む |
| **セキュリティモデル** | ツール操作のリスク分類（LOW/MEDIUM/HIGH）、保護ファイルリスト、自動承認AI「YOLOクラシファイア」の仕組み |
| **内部ツール・コマンド** | `BashTool`、`FileEditTool` など公開ツールに加え、社内限定ツールも。スラッシュコマンドは50種超 |
| **未公開機能の実装** | 後述——これが一番痛い |
| **内部コードネーム** | プロジェクト名「Tengu」（全フィーチャーフラグに `tengu_` プレフィックス）、高速モード = 「Penguin Mode」など |

### 未公開機能：コードで確認できたもの

「流出した」と噂された機能の多くはフェイクや誇張だとも言われた。実際のコードで確認できたものだけを記す。

**KAIROS（プロアクティブアシスタントモード）**

```typescript
// commands.ts より
feature('PROACTIVE') || feature('KAIROS')
feature('KAIROS') || feature('KAIROS_BRIEF')
feature('KAIROS_GITHUB_WEBHOOKS')  // GitHub WebhookをKAIROSに連携
```

`kairosActive` というステートが存在し、GrowthBook（フィーチャーフラグ管理）で `tengu_kairos_cron` というゲートが制御している。「頼まなくても自律的に動くアシスタント」として設計されており、GitHubのWebhookとの連携も視野に入れていることがわかる。

**ULTRAPLAN**

```typescript
// ultraplan.tsx より（抜粋）
const ULTRAPLAN_TIMEOUT_MS = 30 * 60 * 1000; // 30分タイムアウト

function getUltraplanModel(): string {
  return getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_ultraplan_model',
    ALL_MODEL_CONFIGS.opus46.firstParty  // デフォルトはOpus 4.6
  );
}
```

リモートのクラウド環境（CCR）でOpus 4.6を走らせ、最大30分かけて深い計画を立てるモード。すでにかなり作り込まれた実装になっている。

**Dream System（自動メモリ統合）**

```typescript
// autoDream/config.ts より
export function isAutoDreamEnabled(): boolean {
  const setting = getInitialSettings().autoDreamEnabled
  if (setting !== undefined) return setting
  // GrowthBookゲート: tengu_onyx_plover
  return gb?.enabled === true
}
```

DreamTaskのコメントには「4段階構造（orient/gather/consolidate/prune）」と明記されており、バックグラウンドでサブエージェントがメモリを整理する仕組みが実装済み。フィーチャーゲート名は `tengu_onyx_plover`。

**Coordinator Mode（マルチエージェント）**

環境変数 `CLAUDE_CODE_COORDINATOR_MODE` で制御するコーディネーター・ワーカー型のマルチエージェント機能。`TeamCreateTool`、`TeamDeleteTool`、`SendMessageTool` などのツールがすでに存在する。

**BUDDY（コンパニオンペット）**

`/buddy` コマンドのソースが丸ごと存在した。`types.ts` を見ると18種のキャラクター、5段階レアリティ、帽子やステータスまで細かく定義されている。

```typescript
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
export const SPECIES = [duck, goose, blob, cat, dragon, octopus, owl,
  penguin, turtle, snail, ghost, axolotl, capybara, cactus,
  robot, rabbit, mushroom, chonk]
export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK']
export const HATS = ['none', 'crown', 'tophat', 'propeller',
  'halo', 'wizard', 'beanie', 'tinyduck']
```

キャラクターは `hash(userId)` から決定論的に生成される（ユーザーが自分でレアリティを操作できないようにするため）。

### 笑えない皮肉その①：内部情報漏洩防止コードが漏洩した

流出したコードには「**Undercover Mode**」というシステムがあった。目的は「AnthropicのロードマップやSlackチャンネル名などをClaudeが誤って外部に話さないようにする」ため。内部情報の流出を防ぐためのコードが、`.map`ファイルに乗って流出した。

### 笑えない皮肉その②：Capybaraを隠すためにCapybaraを難読化した

`buddy/types.ts` にこんなコメントがある。

```typescript
// One species name collides with a model-codename canary in excluded-strings.txt.
// The check greps build output (not source), so runtime-constructing the value keeps
// the literal out of the bundle while the check stays armed for the actual codename.
const c = String.fromCharCode
export const capybara = c(0x63,0x61,0x70,0x79,0x62,0x61,0x72,0x61) as 'capybara'
```

Buddyのキャラクター種族「capybara」が、内部モデルのコードネームキャナリー（`excluded-strings.txt`）と衝突するため、文字列リテラルをバンドル出力から消すために `String.fromCharCode` でわざわざ16進数エンコードしている。つまり**「capybara」は次世代モデルの内部コードネームである可能性が高い**。そのコードネームを隠すために難読化したコードごと、`.map`ファイルで丸見えになった。

### どれくらい深刻か

**戦略的ダメージは中〜大。ただし致命的ではない。**

Claude Codeの本当の強みはCLIのコードではなく、①Claudeモデル自体の性能、②サーバー側のAPIインフラ、③開発・改善のスピード——このいずれも今回の流出には含まれていない。

ただし、Dream systemやULTRAPLANのアーキテクチャは「モデルに依存しない移転可能なアイデア」なので、競合各社がそこを学ぶ機会になった点は痛い。

---

## 【事件②】axiosが乗っ取られた——マルウェアが最大1億ダウンロード環境に配布

### 何が起きたか

axiosのメインメンテナー（`jasonsaayman`）のnpmアカウントが乗っ取られた。攻撃者はアカウントのメールアドレスを自分のProton Mailに変更し、悪意ある2バージョンを公開した。

- **axios@1.14.1**（約2時間53分間公開）
- **axios@0.30.4**（約2時間15分間公開）

### 攻撃の仕組み

両バージョンには `plain-crypto-js@4.2.1` という偽の依存パッケージが仕込まれていた。このパッケージは**約18時間前にnpmにあらかじめ登録されていた**。インストール時に実行される `postinstall` スクリプトが、macOS・Windows・Linux向けのクロスプラットフォームRAT（遠隔操作型マルウェア）をドロップする仕組みだった。さらにインストール後は自身の痕跡を自動削除するよう設計されていた。

```
攻撃タイムライン:
 T-18h : plain-crypto-js@4.2.1 をnpmに登録（準備）
 T±  0 : axios@1.14.1 を公開
 T+ 39m: axios@0.30.4 を公開
 T+約3h: npmが両バージョンを削除
```

### 影響範囲

axiosは週に**約1億ダウンロード**、クラウド・コード環境の**約80%**に存在するとされる超メジャーパッケージだ。悪意あるバージョンが生きていたのは最大3時間弱だったが、その間に相当数の環境でインストールが走った。RATの実行が確認された環境は被害環境の約3%と報告されている。

### 自分の環境は大丈夫か——確認手順

**① axiosのバージョンを確認する**

```bash
# npmの場合
npm list axios

# pnpmの場合
pnpm list axios
```

危険なバージョンは **`1.14.1`** と **`0.30.4`** のみ。それ以外であれば感染していない。

**② 該当バージョンだった場合**

今すぐ安全なバージョンに下げる。

```bash
npm install axios@1.14.0
# または（0.x系を使っている場合）
npm install axios@0.30.3
```

そして**すべてのシークレット・APIキー・認証情報を即時ローテーション**すること。マルウェアはインストール後に痕跡を自動削除するため、感染したかどうかの確認自体が難しい。

**③ これから再インストールする場合（pnpm移行など）**

悪意あるバージョンはすでにnpmから削除されているため、今から `pnpm install` を実行しても感染することはない。ただしロックファイルに `^1.14.1` が残っている場合は明示的に安全バージョンを指定してから再インストールすること。

---

## 2つの事件が教えてくれること

性質はまったく異なる2つの事件だが、共通点がある。**npmというサプライチェーンが失敗の経路になった**という点だ。

| | Claude Code流出 | axios乗っ取り |
|---|---|---|
| **原因** | ビルド設定の書き忘れ1行 | メンテナーアカウントの乗っ取り |
| **被害** | 内部情報・未公開ロードマップの流出 | マルウェアの配布 |
| **修復** | 該当バージョンの削除・再公開 | 悪意あるバージョンの削除 |
| **教訓** | `.npmignore` / `sourcemap: "none"` の徹底 | npmアカウントへのMFA必須化 |

`npm publish` はボタン一発でコードを1億台のマシンに届けられる。その強力さは、設定ミスやアカウント侵害があったときの爆発半径の大きさと表裏一体だ。

**同じ日に2件。偶然の一致だが、npmへの信頼を問い直す一日になった。**

---

*Live with a Smile!*
