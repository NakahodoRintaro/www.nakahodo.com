---
title: My KSP Fretless Bass Adventure — Where It All Went Wrong
authors: rintaro
tags: [Music, engineering]
description: Building a fretless bass Kontakt instrument with KSP (Kontakt Script Processor) — a hands-on account of every pitfall I hit along the way, from change_tune unit confusion to wait() loops that silently break under rapid note input.
image: /img/ogp-kontakt-fretless.png
---

After reading an article about [FuruBass-Fretless](https://note.com/udongirai/n/n8298e20938b1), I thought: "I could build a Kontakt instrument myself."

Reader, I was not prepared.

**KSP (Kontakt Script Processor) is far more opinionated than it looks.** Implementing a single portamento effect ate half a day.

<!-- truncate -->

---

## What I Was Trying to Build

The defining characteristic of a fretless bass is that notes flow into each other seamlessly — no frets means you can slide your finger up or down the string between pitches, and the pitch transitions continuously. I wanted to recreate this in Kontakt with three core behaviors:

- **Portamento**: glide from the previous note's pitch to the current one
- **Slide-in**: approach each note from a few semitones away before landing on the target pitch
- **Vibrato**: the gentle, organic wobble that makes fretless bass sound alive

---

## What is KSP?

KSP is the scripting language built into Native Instruments Kontakt. It's a proprietary language maintained by NI, with documentation that ranges from "helpful" to "cryptic" depending on what you're trying to do. The syntax is Pascal-like, but the execution model is callback-based:

```ksp
on note       { ← called on every note-on event }
  ...
end on

on release    { ← called on every note-off event }
  ...
end on
```

Variables are typed by prefix: `$` for integers, `%` for integer arrays, `@` for strings, `~` for reals. Mess up the prefix and KSP won't error — it just silently ignores the assignment. Bugs vanish without a trace.

---

## Pitfall #1: `change_tune` Units Are Ambiguous

Portamento works through the `change_tune` function:

```ksp
change_tune($EVENT_ID, $tune_value, $relative)
```

The question is: **what does `$tune_value` actually mean?**

The documentation exists but is terse. I ended up just plugging in values and listening:

```ksp
{ Trial and error log }
change_tune($EVENT_ID, 100, 0)    { ← barely moves }
change_tune($EVENT_ID, 10000, 0)  { ← shifts slightly? }
change_tune($EVENT_ID, 1000, 0)   { ← exactly 1 semitone up }
```

**1000 = 1 semitone.** It's "millisemitones" or something adjacent. The documentation says "semitone × 1000" but I was reading the wrong section for a while and kept putting in wildly wrong values.

---

## Pitfall #2: `wait()` Inside `on note` Breaks Under Rapid Input

The portamento animation is a loop that gradually steps the pitch toward zero while calling `wait()` between each step:

```ksp
on note
  $offset := $porta_offset
  while ($offset # 0)
    $offset := $offset - $step_size
    change_tune($EVENT_ID, $offset, 0)
    wait(5000)   { wait 5ms }
  end while
end on
```

The problem: **if you play fast, the previous note's loop keeps running while the new note starts.** I ended up hearing weird detuned chords when playing eighth notes at any reasonable tempo. Thought I'd broken something fundamental.

The fix: keep `$ANIM_STEPS` low (I settled on 25) so the total loop time stays short. It's not perfect, but playable.

---

## Pitfall #3: Slide-In and Portamento Interfere with Each Other

Slide-in approaches the target note from a few semitones away. The direction logic is straightforward:

```ksp
if ($note > $prev_note)
  $slide_offset := -($knob_slide_range * $SEMITONE)  { approach from below }
else
  $slide_offset := $knob_slide_range * $SEMITONE     { approach from above }
end if
```

But when both slide-in **and** portamento are enabled, they collide. Slide-in ends with pitch at `0` (target). Then portamento says "start from the previous note's offset." If you use `$relative = 0` (absolute), it wipes out whatever slide-in left behind. You need `$relative = 1` (additive):

```ksp
{ After slide-in, pitch is already at 0 — add the portamento offset on top }
if ($sw_slide = 1)
  change_tune($EVENT_ID, $porta_offset, 1)  { relative = 1 }
else
  change_tune($EVENT_ID, $porta_offset, 0)  { absolute }
end if
```

I spent about 30 minutes wondering why the pitch would randomly jump. The culprit was a single `0` vs `1`.

---

## Pitfall #4: Legato Detection Depends on Variable Update Order

I wanted portamento to be optional in "legato only" mode — only glide when the previous note is still held down.

```ksp
declare %is_held[128]

on note
  if ($menu_porta_mode = 1 and %is_held[$prev_note] = 1)
    { legato condition met — do portamento }
  end if
  %is_held[$NOTE] := 1   { ← must come AFTER the check }
end on

on release
  %is_held[$EVENT_NOTE] := 0
end on
```

The trap: if you mark the new note as held *before* checking `$prev_note`, the logic is always comparing against a freshly-set value. Flip the order and you get either "portamento on every note" or "portamento never" — no middle ground.

---

## Final Script Structure

After all the trial and error, the script settled into this shape:

```
on init     → UI knobs/switches, variable initialization
on note     → slide-in → portamento → vibrato (in this order)
on release  → clear the held flag
on controller → CC11 (Expression) and CC64 (Sustain Pedal)
```

The UI surface:

| Section | Control | Description |
|---|---|---|
| PORTAMENTO | ON switch | Enable/disable portamento |
| | Mode | Always / Legato Only |
| | Time | Glide duration (ms) |
| SLIDE IN | ON switch | Enable/disable slide-in |
| | Range | Slide width in semitones |
| | Time | Slide duration (ms) |
| VIBRATO | Depth | Vibrato depth |
| | Rate | Vibrato speed |

---

## How It Sounds

With Portamento Time at 150ms and Slide Range at 4 semitones, the legato lines feel remarkably fretless-like. The slide-in gives each note a sense of physical weight — the pitch arrives rather than snapping into place.

Things still to fix:

- Portamento time synced to BPM (e.g., glide for exactly one 16th note)
- Vibrato sometimes persists into the next note on fast passages
- Behavior on repeated same-pitch notes needs testing with real samples

KSP has a way of making things look like they're working when they're actually quietly broken. The key discipline: always verify variable scope and `wait()` timing before assuming the logic is right.

---

The full script is in the [kontakt_test repository on GitHub](https://github.com/NakahodoRintaro/kontakt_test) (coming soon).

*Live with a Smile!*
