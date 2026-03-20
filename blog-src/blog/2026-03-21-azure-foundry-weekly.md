---
title: Azure Foundry Agent ServiceがGAに——今週のAzureアップデートを読み解く
authors: rintaro
tags: [engineering, ai]
---

先週のAzure Weekly Updateを追っていたら、個人的に気になるアップデートが多かったので整理してみた。特にFoundry Agent ServiceのGAは、エージェント開発の文脈で仕事にも直結する話なのでしっかり読んだ。

<!-- truncate -->

## 今週のハイライト

[Azure Weekly Update — 20th March 2026](https://youtu.be/jkpcFAYJjvM) より、特に気になったものをピックアップする。

---

## Foundry Agent Service、ついにGA

今週一番注目しているのはここ。

[Azure AI Foundry Agent Service](https://devblogs.microsoft.com/foundry/foundry-agent-service-ga/)がGAになった。ひとことで言えば、**エージェントをフルマネージドで動かせるプラットフォーム**だ。

何が良いかというと、フレームワークを選ばないこと。

- ノーコードのPrompt Agentから
- Azure AI Agent Framework
- LangGraph
- 自前実装

までが同じ基盤で動く。今まで「フレームワーク選定→ランタイム構築→オブザーバビリティ整備」を自前でやっていたところがまるごとマネージドになった感じ。

### ネイティブライブボイスが面白い

個人的に注目しているのが**Native Live Voice**の対応。

従来のボイスエージェントは「音声→テキスト→LLM推論→テキスト→音声」という変換を複数ステップ挟んでいたが、これをエンドツーエンドで統合できる。140ロケール・700種類以上の音声も用意されているとのことで、多言語対応のボイスエージェントを作る敷居がかなり下がった。

ゲーム開発とかリアルタイムNPCとかに使えないか、少し考えている。

### Foundry Observabilityも同時に強化

エージェントが壊れているかどうか検知するのは難しい。モデルのバージョンが変わったとき、プロンプトを少し変えたとき、本番トラフィックが増えたとき——どのタイミングで品質が劣化したかがわからないことが多い。

Foundry Observabilityでは以下を評価できる：

- **関連性・一貫性**（Relevance / Coherence）
- **Groundedness**（幻覚の度合い）
- **Retrieval品質**（RAGの検索精度）
- **安全性・ポリシー整合性**

さらにAzure Monitorとの統合と、カスタムLLMによる評価も可能。エージェントをプロダクションで運用するなら、ここを最初に整備しないと後で詰まる。自戒を込めて。

---

## WAF Default Rule Set 2.2

地味だが重要。App GatewayとFront Door両方のWeb Application Firewall（WAF）がDefault Rule Set（DRS）2.2に対応した。

DRS 2.2はOWASP CRSのスーパーセット + Microsoft脅威インテリジェンスチームが管理するルール群が追加されている。最新3バージョンのサポートが維持されるようになった点も地味に嬉しい。既存のWAFルールをいつ更新するか考えていた人は、このタイミングで確認しておくといい。

---

## Azure Databricks × Microsoft Fabric連携

AzureのデータプラットフォームとFabricの連携が着実に深まっている。

**Lakeflow Connect 無料枠**では、ワークスペースあたり1日100 DBU（≒約1億レコード）が無料になった。ServiceNow・Salesforce・Dynamics365などSaaSからの取り込みや、SQL Server・Oracle・PostgreSQLなどDBからの取り込みが対象。AnalyticsやAIアプリへのデータ流入コストが下がる話として読んだ。

**Unity Catalog ↔ OneLake フェデレーション**も興味深い。DatabricksからFabricのデータに直接クエリを打てるようになり、データをコピーせずにサイド・バイ・サイドで扱える。データコピーの管理コストが嫌いな人間なので、これは素直に好き。

---

## OpenAI GPT-4.1 mini / nano

Microsoft Foundryに新しいモデルファミリーが追加された。

| モデル | 用途 |
|---|---|
| **GPT-4.1 mini** | マルチモーダル・ツール使用・Computer Use対応。リアルタイムエージェント、RAGアプリ、Dev Tools向け |
| **GPT-4.1 nano** | 極めて低レイテンシ・高スループット。高ボリュームリクエスト、リアルタイムチャット向け |

nanoはGitHub Copilotにも展開されている。エージェントの中でルーティングやフィルタリングなど「速さが必要な部分」にnanoを使い、重い推論にはフルサイズを使い分けるアーキテクチャが現実的になってきた。

---

## Entra ID バックアップ・リカバリ

地味にありがたい機能。5日間の自動日次バックアップから以下を復元できるようになった：

- ユーザー・グループ・アプリケーション
- 条件付きアクセスポリシー
- 認証ポリシー・名前付き場所

Entraのポリシーを誰かが誤って変更してしまったとき、今まで手動で復元するしかなかった。運用チームには素直に嬉しいアップデート。

---

## まとめ

今週はFoundry Agent ServiceのGAが大きかった。エージェント開発のインフラをどこまで自前でやるかという議論が変わってくる可能性がある。FDEエンジニアとして顧客にどう提案するかも少し考え直す必要が出てきた。

週次でAzureのアップデートを追うのは量が多くて大変だが、[John Savillのまとめ動画](https://youtu.be/jkpcFAYJjvM)は毎回コンパクトにまとまっているので重宝している。
