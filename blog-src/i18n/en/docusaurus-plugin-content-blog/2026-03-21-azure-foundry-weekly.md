---
title: Azure Foundry Agent Service Goes GA — Breaking Down This Week's Azure Updates
authors: rintaro
tags: [engineering, ai]
description: Highlights from the Azure Weekly Update for the third week of March 2026 — including Foundry Agent Service GA, Azure AI Search improvements, and more, analyzed through an engineering lens.
---

Following the Azure Weekly Update last week, there were several updates I found personally interesting, so I decided to write them up. The Foundry Agent Service GA in particular is directly relevant to my work in agent development, so I read it carefully.

<!-- truncate -->

## This week's highlights

Picking out the notable items from the [Azure Weekly Update — 20th March 2026](https://youtu.be/jkpcFAYJjvM).

---

## Foundry Agent Service goes GA

This is the one I've been watching most closely.

[Azure AI Foundry Agent Service](https://devblogs.microsoft.com/foundry/foundry-agent-service-ga/) has reached general availability. In short, it's a **fully managed platform for running agents**.

What makes it compelling is the framework flexibility. Everything from:

- No-code Prompt Agents
- Azure AI Agent Framework
- LangGraph
- Custom implementations

...runs on the same underlying platform. What used to require "choose a framework → build a runtime → set up observability" from scratch is now managed for you.

### Native Live Voice is interesting

What I'm personally most excited about is **Native Live Voice** support.

Traditional voice agents required multiple conversion steps: "audio → text → LLM inference → text → audio." This integrates that pipeline end-to-end. With 140 locales and 700+ voices available, the barrier to building multilingual voice agents has dropped significantly.

I've been thinking about whether this could work for game development — real-time NPCs and similar applications.

### Foundry Observability also gets a boost

Detecting when an agent has broken down is hard. When a model version changes, when a prompt is tweaked slightly, when production traffic spikes — knowing which moment caused quality degradation often isn't clear.

Foundry Observability lets you evaluate:

- **Relevance / Coherence**
- **Groundedness** (degree of hallucination)
- **Retrieval quality** (RAG search accuracy)
- **Safety / policy alignment**

It also supports Azure Monitor integration and custom LLM-based evaluation. If you're running an agent in production, this is the first thing to set up — or you'll regret it later. Speaking from experience.

---

## WAF Default Rule Set 2.2

Subtle but important. Both App Gateway and Front Door Web Application Firewalls (WAF) now support Default Rule Set (DRS) 2.2.

DRS 2.2 is a superset of the OWASP CRS, plus additional rules managed by the Microsoft threat intelligence team. Maintaining support for the latest 3 versions going forward is a quietly nice touch. If you've been thinking about when to update your existing WAF rules, this is a good moment to check.

---

## Azure Databricks × Microsoft Fabric integration

The integration between Azure's data platform and Fabric continues to deepen.

**Lakeflow Connect free tier** now provides 100 DBU per workspace per day (roughly 100 million records) for free. This covers ingestion from SaaS systems like ServiceNow, Salesforce, and Dynamics 365, and from databases like SQL Server, Oracle, and PostgreSQL. I read this as lowering the data onboarding cost for analytics and AI applications.

**Unity Catalog ↔ OneLake federation** is also interesting. You can now query Fabric data directly from Databricks without copying data — side-by-side access. I genuinely like this since I dislike managing data copies.

---

## OpenAI GPT-4.1 mini / nano

New model families have been added to Microsoft Foundry.

| Model | Use case |
|---|---|
| **GPT-4.1 mini** | Multimodal, tool use, Computer Use. For real-time agents, RAG apps, dev tools |
| **GPT-4.1 nano** | Extremely low latency, high throughput. For high-volume requests, real-time chat |

Nano is also being deployed to GitHub Copilot. It's now practical to architect agents where nano handles routing and filtering in latency-sensitive paths, while a full-size model handles heavier inference.

---

## Entra ID backup and recovery

A quietly welcome feature. 5-day automatic daily backups now let you restore:

- Users, groups, applications
- Conditional access policies
- Authentication policies and named locations

When someone accidentally changes an Entra policy, there was previously no way to recover it other than manual reconstruction. A straightforward win for operations teams.

---

## Summary

The big story this week was Foundry Agent Service going GA.

The framing of "how much agent infrastructure should we build ourselves" feels like it's shifting. As each cloud provider rapidly matures their managed services, what becomes more valuable isn't "the ability to build it yourself" but "the ability to judge which service solves which problem."

For FDE engineering proposals, this doesn't mean starting from scratch — it means the parts that were previously bottlenecks (observability setup, runtime construction, framework selection) now have concrete managed options to point to. The thesis stays the same; the supporting evidence just got stronger.

Keeping up with Azure updates weekly is a lot, but [John Savill's summary videos](https://youtu.be/jkpcFAYJjvM) are consistently well-organized and worth the time.
