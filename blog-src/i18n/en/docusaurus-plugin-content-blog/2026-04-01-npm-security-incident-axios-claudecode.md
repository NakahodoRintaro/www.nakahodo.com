---
title: "What Happened on npm on March 31, 2026 — Claude Code Source Leak and the axios Hijacking"
authors: rintaro
tags: [engineering, ai]
description: Two npm security incidents on the same day. Anthropic's misconfiguration exposed all of Claude Code's source code, and the axios npm account was hijacked to distribute malware. A firsthand look at the leaked code, with a breakdown of what happened, the impact, and what to do.
image: /img/ogp-npm-incident.png
---

On March 31, 2026, two security incidents hit the npm ecosystem simultaneously.

The first: Anthropic forgot a single line of configuration and accidentally published the entire source code of Claude Code. The second: the npm account for axios — a package downloaded 100 million times a week — was hijacked and used to distribute malware. The two incidents are completely different in nature, but both shook trust in npm as infrastructure.

![What happened on npm on 2026.03.31](/img/ogp-npm-incident.png)

<!-- truncate -->

---

## [Incident 1] All of Claude Code's Source Code Leaked — One `.map` File to Blame

### How It Started: A Single Tweet from a Security Researcher

On March 31, 2026, security researcher Chaofan Shou (@Fried_rice) tweeted:

> "Claude code source code has been leaked via a map file in their npm registry!"

The Claude Code npm package (v2.1.88) contained a 59.8 MB source map file, and from it, the full source code ZIP hosted on Anthropic's Cloudflare R2 bucket was accessible.

Since it happened on March 31, many assumed it was an April Fools' joke. Replies on X argued that "Claude Code's repo is already public on GitHub" and that "the code is incomplete and doesn't run." But after actually examining the leaked ZIP, it was real: **1,902 TypeScript files totaling over 512,000 lines**.

### What Is a Source Map?

JavaScript build tools minify and obfuscate code. Source maps exist to reverse that process — and the `sourcesContent` field stores the original source code as strings in full.

```json
{
  "version": 3,
  "sources": ["../src/main.tsx", "../src/tools/BashTool.ts"],
  "sourcesContent": ["// all original code goes here"],
  "mappings": "AAAA..."
}
```

Source maps are indispensable during development, but including them in an npm package means your code is fully exposed.

### Why Did It Leak?

Claude Code is built with Bun, which generates source maps by default. Someone at Anthropic forgot one of the following:

- Set `sourcemap: "none"` in `bunfig.toml` or `bun.build.ts`
- Add `*.map` to `.npmignore`

One missing line, and `npm publish` sent the source code to the world.

### What Actually Leaked

I reviewed the leaked code directly. Here's a summary of what was inside:

| What leaked | Details |
|---|---|
| **Full system prompt** | All instructions controlling Claude's behavior — including prompt caching strategy and module structure |
| **Security model** | Tool operation risk classifications (LOW/MEDIUM/HIGH), protected file list, the auto-approval AI "YOLO Classifier" |
| **Internal tools and commands** | Public tools like `BashTool` and `FileEditTool`, plus internal-only tools. Over 50 slash commands |
| **Unreleased feature implementations** | Described below — this is the most damaging part |
| **Internal codenames** | Project "Tengu" (all feature flags use the `tengu_` prefix), Fast Mode = "Penguin Mode" |

### Unreleased Features Confirmed in the Code

Many claimed features turned out to be fake or exaggerated. Here are only the ones I personally confirmed from the code.

**KAIROS (Proactive Assistant Mode)**

```typescript
// from commands.ts
feature('PROACTIVE') || feature('KAIROS')
feature('KAIROS') || feature('KAIROS_BRIEF')
feature('KAIROS_GITHUB_WEBHOOKS')  // GitHub Webhook integration for KAIROS
```

A state called `kairosActive` exists and is gated by `tengu_kairos_cron` in GrowthBook (feature flag management). It's designed as an assistant that acts autonomously without being asked, with planned GitHub Webhook integration.

**ULTRAPLAN**

```typescript
// from ultraplan.tsx (excerpt)
const ULTRAPLAN_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute timeout

function getUltraplanModel(): string {
  return getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_ultraplan_model',
    ALL_MODEL_CONFIGS.opus46.firstParty  // defaults to Opus 4.6
  );
}
```

A mode that runs Opus 4.6 in a remote cloud environment (CCR) and spends up to 30 minutes on deep planning. The implementation is already quite mature.

**Dream System (Automatic Memory Consolidation)**

```typescript
// from autoDream/config.ts
export function isAutoDreamEnabled(): boolean {
  const setting = getInitialSettings().autoDreamEnabled
  if (setting !== undefined) return setting
  // GrowthBook gate: tengu_onyx_plover
  return gb?.enabled === true
}
```

DreamTask comments explicitly describe a "4-stage structure (orient/gather/consolidate/prune)" where a background sub-agent organizes memory. Feature gate: `tengu_onyx_plover`.

**Coordinator Mode (Multi-Agent)**

A coordinator-worker multi-agent system controlled via the `CLAUDE_CODE_COORDINATOR_MODE` environment variable. Tools including `TeamCreateTool`, `TeamDeleteTool`, and `SendMessageTool` already exist in the codebase.

**BUDDY (Companion Pet)**

The full source for a `/buddy` command was present. `types.ts` defines 18 species, 5 rarity tiers, hats, and detailed stats.

```typescript
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
export const SPECIES = [duck, goose, blob, cat, dragon, octopus, owl,
  penguin, turtle, snail, ghost, axolotl, capybara, cactus,
  robot, rabbit, mushroom, chonk]
export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK']
export const HATS = ['none', 'crown', 'tophat', 'propeller',
  'halo', 'wizard', 'beanie', 'tinyduck']
```

Characters are generated deterministically from `hash(userId)` so users can't game their rarity.

### Irony #1: Code That Prevents Internal Leaks Was Itself Leaked

The leaked code included a system called **"Undercover Mode"** — designed to prevent Claude from accidentally revealing Anthropic's roadmaps or internal Slack channel names. Code built to prevent information leaks was carried out via a `.map` file.

### Irony #2: They Obfuscated "capybara" to Hide It — and That Got Leaked Too

A comment in `buddy/types.ts` says:

```typescript
// One species name collides with a model-codename canary in excluded-strings.txt.
// The check greps build output (not source), so runtime-constructing the value keeps
// the literal out of the bundle while the check stays armed for the actual codename.
const c = String.fromCharCode
export const capybara = c(0x63,0x61,0x70,0x79,0x62,0x61,0x72,0x61) as 'capybara'
```

The Buddy species "capybara" conflicts with an internal model codename canary in `excluded-strings.txt`. To keep the string literal out of the bundle output, it's hex-encoded with `String.fromCharCode`. In other words, **"capybara" is very likely an internal codename for a next-generation model** — and the obfuscation designed to hide it was exposed wholesale in the `.map` file.

### How Serious Is This?

**Strategic damage: moderate to significant — but not fatal.**

Claude Code's real strengths are (1) the Claude model itself, (2) the server-side API infrastructure, and (3) the speed of development and iteration. None of those were included in this leak.

That said, the architectures of Dream System and ULTRAPLAN are "model-agnostic, transferable ideas" — and the opportunity for competitors to study them is a real cost.

---

## [Incident 2] axios Was Hijacked — An 18-Hour Attack Carefully Planned

### What Happened

The npm account of axios's primary maintainer (`jasonsaayman`) was taken over. The attacker changed the account email to `ifstap@proton.me` (Proton Mail) and published two malicious versions:

- **axios@1.14.1** (live for ~2 hours 53 minutes)
- **axios@0.30.4** (live for ~2 hours 15 minutes)

This was not an ad hoc attack — preparation began 18 hours before the malicious versions were published.

### Attack Timeline (UTC)

| Time | Event |
|---|---|
| 3/30 05:57 | `plain-crypto-js@4.2.0` published (harmless decoy) |
| 3/30 23:59 | `plain-crypto-js@4.2.1` published (malicious payload) |
| 3/31 00:21 | `axios@1.14.1` published |
| 3/31 01:00 | `axios@0.30.4` published |
| 3/31 ~03:15 | npm removes both malicious axios versions |
| 3/31 03:25 | npm places `plain-crypto-js` on security hold |
| 3/31 04:26 | Security stub `plain-crypto-js@0.0.1-security.0` published |

A two-step operation: first claim the `plain-crypto-js` package name with a harmless decoy, then overwrite it the next day with a malicious version.

### How the Attack Worked

The `plain-crypto-js@^4.2.1` dependency added to both axios versions is a **phantom dependency** — it isn't imported anywhere in the axios source. Its 56 source files are identical to the legitimate `crypto-js@4.2.0`, making it look genuine at a glance.

During installation, a `postinstall` hook executes `node setup.js`. This 4.2 KB dropper obfuscates C2 addresses and module names with two layers of XOR encryption, then detects the OS and downloads a platform-specific RAT.

**Platform-specific payloads**

| OS | Behavior |
|---|---|
| macOS | Writes AppleScript to `/tmp/6202033`, installs binary at `/Library/Caches/com.apple.act.mond` |
| Windows | Copies PowerShell to `%PROGRAMDATA%\wt.exe` (persistence), runs hidden via VBScript |
| Linux | Downloads Python dropper to `/tmp/ld.py`, launches as orphaned process via `nohup` under PID 1 (avoids process tree tracking) |

### Sophisticated Evidence Destruction

After execution, the dropper performs a 3-stage self-cleanup:

1. Self-deletes `setup.js`
2. Deletes the malicious `package.json` (version 4.2.1)
3. Renames a pre-staged `package.md` (marked version 4.2.0) to `package.json`

After infection, running `npm list` shows `plain-crypto-js@4.2.0`. What actually ran was 4.2.1 — but the display shows the harmless version. **Version spoofing**.

### Am I Affected? — How to Check

**① Check axios version and traces**

```bash
# Check for malicious axios versions
npm list axios 2>/dev/null | grep -E "1\.14\.1|0\.30\.4"

# plain-crypto-js existing at all suggests possible infection (due to version spoofing)
ls node_modules/plain-crypto-js 2>/dev/null && echo "POTENTIALLY AFFECTED"

# macOS: check for RAT binary
ls -la /Library/Caches/com.apple.act.mond 2>/dev/null

# Linux: check for Python dropper
ls -la /tmp/ld.py 2>/dev/null
```

The dangerous versions are **`1.14.1`** and **`0.30.4`** only. However, if `plain-crypto-js` is present in `node_modules`, the displayed version may be spoofed — treat this carefully.

**② If you're affected**

```bash
# Pin to a safe version (overrides also blocks transitive resolution)
npm install axios@1.14.0
rm -rf node_modules/plain-crypto-js
```

Add `overrides` to `package.json` to block transitive resolution as well:

```json
{
  "dependencies": { "axios": "1.14.0" },
  "overrides": { "axios": "1.14.0" }
}
```

If you find traces of the RAT binary, **treat your entire system as compromised**. Rotate all npm tokens, AWS keys, SSH keys, CI secrets, and anything else stored on that machine.

**③ Future reinstalls (e.g., migrating to pnpm)**

The malicious versions have already been removed from npm, so running `npm install` now won't infect you. But if your lockfile still contains `^1.14.1`, explicitly pin the version before running.

Also, `npm ci --ignore-scripts` in CI/CD will prevent `postinstall` hooks from running entirely. That hook was the sole infection vector in this attack.

### Network-Level IOCs

To block C2 communication:

- C2 domain: `sfrclak.com`
- C2 IP: `142.11.206.73`

---

## What These Two Incidents Teach Us

Two completely different incidents — but with one thing in common: **npm as a supply chain became the failure path**.

| | Claude Code leak | axios hijacking |
|---|---|---|
| **Cause** | One missing line in build config | Maintainer account takeover |
| **Damage** | Internal information and unreleased roadmap exposed | Malware distributed |
| **Remediation** | Remove and republish affected version | Remove malicious versions |
| **Lesson** | Always set `.npmignore` / `sourcemap: "none"` | MFA is mandatory for npm accounts |

`npm publish` can deliver code to a hundred million machines with one command. That power is inseparable from the blast radius when configuration mistakes or account compromises occur.

**Two incidents on the same day. A coincidence — but a day that forced a hard look at trust in npm.**

---

*Live with a Smile!*
