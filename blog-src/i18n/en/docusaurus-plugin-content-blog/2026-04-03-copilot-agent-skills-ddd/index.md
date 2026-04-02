---
title: "Turning Book Knowledge into Copilot Agent Skills — System Design Principles Edition"
authors: rintaro
tags: [engineering, ai]
description: Inspired by eda-san's Agent Skills article, I ported the same theme to GitHub Copilot (VS Code Agent Mode). A walkthrough of the SKILL.md structure and a hands-on implementation of the domain-extractor skill based on Toru Masuda's "Person/Thing/Event" framework for discovering domain models.
image: /img/ogp-copilot-agent-skills-ddd.png
---

After reading eda-san's (@eda_sann) article "Turning Book Knowledge into Agent Skills — System Design Principles Edition," I was inspired to build the same thing myself — this time for GitHub Copilot.

While eda-san used Claude Code's Agent Teams, this article takes a different angle:

- **Ported to GitHub Copilot (VS Code Agent Mode)**
- A close look at the structure and format of a Skill
- A demo of it running in practice

<!-- truncate -->

---

## What Are Agent Skills?

Agent Skills are an open standard for giving AI agents a "specialist procedure manual."
Originally introduced with Anthropic's Claude Code, the concept was open-standardized in December 2025 and is now available in GitHub Copilot as well.

### How They Differ from Other Customization Features

| Feature | When loaded | Granularity | Use case |
|---------|------------|-------------|----------|
| copilot-instructions.md | Always | Entire session | Coding conventions and style |
| Prompt Files | On demand | Per task | Reusable prompt templates |
| Agent Skills | Auto-loaded when relevant | Per task | Complex workflows and expert procedures |

The defining characteristic of Skills is that they are **loaded only when needed**.
Only the `description` field in the SKILL.md frontmatter is always read; the full content is expanded into the context only when deemed relevant to the current task. This lets you maintain many skills without burning tokens.

### Where to Place Them

```
your-repo/
└── .github/
    └── skills/
        └── domain-extractor/   ← folder named after the skill
            └── SKILL.md        ← required file
```

Placing them under `.claude/skills/` also works — Copilot recognizes both locations, enabling sharing with Claude Code.

---

## The Skill We're Building

Following eda-san's article, I'll build a `domain-extractor` skill based on Toru Masuda's *Practical Principles of System Design*. The book's core approach — **discovering domain models by starting from "Events" in the Person/Thing/Event framework** — is what I'm formalizing as a skill.

---

## Structure of SKILL.md

A SKILL.md file consists of **YAML frontmatter + Markdown body**.

### Frontmatter (required)

```yaml
---
name: domain-extractor
description: >
  A skill for discovering and organizing domain models through guided interviews.
  Auto-loaded for prompts like "I want to start domain design," "I need to organize
  business requirements," or "I don't know where to begin with DDD."
---
```

The `description` is the skill's **business card**. Copilot reads only this field at all times and matches it against the user's prompt. The key is to write concrete keywords and usage scenarios that act as triggers.

---

## The Implemented SKILL.md

```markdown
---
name: domain-extractor
description: >
  A skill for discovering and organizing domain models through guided interviews.
  Auto-loaded for prompts like "I want to start domain design," "I need to organize
  business requirements," or "I don't know where to begin with DDD."
  Based on the "Person/Thing/Event" framework from Toru Masuda's
  "Practical Principles of System Design," this skill starts from Events (business
  occurrences) to progressively identify domain object candidates and outputs
  a Markdown analysis report.
---

# domain-extractor — Interactive Domain Extraction Skill

## Core Principles (All Phases)

1. **Event-first** — always start analysis from business occurrences (Events)
2. **Small, independent parts** — create small domain objects per concern
3. **Business language = code** — type and function names must match business terminology
4. **Incremental growth** — start rough; refine each time understanding deepens
5. **Rules hidden in Events** — every Event has business rules lurking behind it

## Interviewing Workflow

Phase 1: Business overview  → Grasp purpose and scope
Phase 2: Event discovery    → Identify the chronological chain of business events
Phase 3: Event deep-dive    → Extract business rules per event
Phase 4: Cross-cutting concerns → Discover common patterns and packages
Phase 5: Artifact synthesis → Compile into an analysis report

...(body continues)
```

The full text is available in the repository linked at the end.

---

## Setup

### 1. Enable Agent Skills

Add the following to your VS Code `settings.json`:

```json
{
  "chat.useAgentSkills": true
}
```

### 2. Place the File

```bash
mkdir -p .github/skills/domain-extractor
# Place SKILL.md in this directory
```

### 3. Invoke from Copilot Chat

Just say something like this in Agent Mode:

```
I want to start domain design. I'd like to organize the order management for an e-commerce site.
```

Copilot will automatically recognize the `domain-extractor` skill and begin the interview. You can also invoke it with a slash command:

```
/domain-extractor
```

---

## Trying It Out

I used a "Music Lesson Booking System" as the subject for the interview.

### Phase 1 → Event Discovery

```
Copilot:
Hello! Domain extraction skill activated 🏗️

First, tell me:
What business or service domain would you like to design?

---

Me:
It's an online booking system for music lessons.
Students can choose their preferred instructor and book a lesson.

---

Copilot:
Got it!
A service where "students choose an instructor and book a lesson." Let me confirm.

🎵 Music Lesson Booking System
- Key actors: students, instructors
- Core value: students can choose their preferred instructor and time and take a lesson

Does that sound right?

Next question:
Please describe the important "occurrences" in this system (things like "X happens," "X is done")
in chronological order.
```

### Phase 3 → Extracting Business Rules

In the Event deep-dive phase, rules were surfaced for each event.

```
Copilot (excerpt):

Let's look at the "Book a lesson" event.

[R-001] A booking can only be made during a time slot the instructor has marked "available"
[R-002] Only one booking per instructor per time slot
[R-003] A booking can only be cancelled up to 24 hours before the start time

These rules are knowledge that the "Booking" domain object should own.
Are there any edge cases you can think of (e.g., a student repeatedly no-showing)?
```

### Final Output (excerpt)

```markdown
# Domain Analysis Report — Music Lesson Booking System

## 2. Event Chain

\`\`\`mermaid
flowchart LR
  A[Search for instructor] --> B[Check availability] --> C[Book a lesson]
  C --> D[Attend lesson] --> E[Post a review]
  C --> F[Cancel booking]
\`\`\`

## 5. Domain Object Candidates

| Object | Type | Related Rules |
|--------|------|--------------|
| Booking | Entity | R-001, R-002, R-003 |
| Lesson Slot | Entity | R-001 |
| Tuition Fee | Value Object | R-004 |
| Cancellation Policy | Value Object | R-003 |
```

---

## Differences from Claude Code

Comparing with eda-san's implementation:

| Aspect | eda-san (Claude Code) | This article (GitHub Copilot) |
|--------|----------------------|-------------------------------|
| Multi-agent | ◎ 3 roles via Agent Teams | △ Single agent |
| IDE integration | Terminal-centric | Native VS Code UI |
| Auto-loading | Specify skill name with `#` | Auto-detected from prompt content |
| Target users | Developers | Developers to designers |

Claude Code's Agent Teams excel at delegating distinct roles — facilitator, business analyst, and reviewer — to separate agents. On the other hand, Copilot Skills are woven into VS Code, making it seamless to design domains while actively writing code.

---

## Reflections

Formalizing book knowledge into a skill surfaced a few insights.

### What worked well

- Designing the interview order forced me to properly understand parts I had only skimmed
- The phase structure made it explicit where analysis ends and design begins
- Copilot matches skills based on `description` alone, so word choice there matters far more than I expected

### What was tricky

- Having a single agent cover multiple roles produces more complex instructions than Claude Code's Agent Teams approach
- Expressing phase-gate control ("confirm before moving on") in a prompt requires some finesse

---

## Summary

- Agent Skills are a simple open standard that starts with a single SKILL.md file
- Works in GitHub Copilot (VS Code) by placing it under `.github/skills/`
- How you write `description` directly determines trigger accuracy — concrete usage examples are key
- Formalizing book knowledge as a skill is a great way to surface where your understanding is still fuzzy

I'm hoping to formalize more technical book knowledge into Agent Skills going forward.

---

## References

- [Turning Book Knowledge into Agent Skills — System Design Principles Edition (eda-san)](https://zenn.dev/eda_sann/articles/6fcb025e2c6b79)
- [Practical Principles of System Design (Toru Masuda)](https://www.amazon.co.jp/dp/477419087X)
- [About Agent Skills - GitHub Docs](https://docs.github.com/en/copilot/customizing-copilot/agent-skills)
- [Use Agent Skills in VS Code](https://code.visualstudio.com/docs/copilot/agent-skills)
- [anthropics/skills - Official skills repository](https://github.com/anthropics/skills)
