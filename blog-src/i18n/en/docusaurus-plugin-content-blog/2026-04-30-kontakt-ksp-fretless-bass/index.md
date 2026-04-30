---
title: "Turning a Friend's Bass Recordings into a Kontakt Instrument with KSP — Every Pitfall Documented"
authors: rintaro
tags: [Music, engineering]
image: /img/ogp-kontakt-ksp.png
description: "A friend recorded a fretless bass and wanted to turn it into a Kontakt instrument. We worked together customizing an existing bass instrument, which eventually led to writing a KSP script from scratch. Here's every error I hit along the way."
---

It started with a simple request: a friend had recorded a fretless bass and wanted to turn it into a playable Kontakt instrument. We collaborated — they handled the recordings, I tackled the KSP scripting side. What began as tweaking an existing bass instrument eventually turned into writing a script from scratch. Getting it to "actually work" took longer than expected. Here's every pitfall I ran into.

<!-- truncate -->

---

## What I Was Building

A multisampled fretless bass instrument — built from my friend's recordings — with the following KSP-driven features:

- **Portamento** — glide from the previous note to the current one (configurable time and legato mode)
- **Slide-in** — approach each note from a few semitones below or above before settling on pitch
- **Vibrato** — CC1 mod wheel overrides the depth knob when active

---

## What Is KSP?

KSP (Kontakt Script Processor) is the scripting language built into NI Kontakt. You write callbacks like `on note`, `on release`, and `on init` to handle pitch changes, CC responses, and custom UI.

There are two places you can load a script, and this distinction matters enormously:

| Slot | Location | Capabilities |
|---|---|---|
| **Instrument Script** | Wrench icon → Script Editor | `on note`, `on release`, `change_tune` all work |
| **Multi Script** | KSP slot in the Multi rack | `on note` and `change_tune` are **not available** |

I spent hours confused because I had pasted my script into the Multi rack slot. Everything I tried to do either silently did nothing or threw errors.

---

## Every Error I Hit

### 1. `syntax error on line 1` — Japanese comments

I added a few Japanese comments at the top of the script. Kontakt refused to load it at all:

```
syntax error on line 1
```

**Cause**: KSP's parser doesn't handle non-ASCII characters (or BOM-prefixed UTF-8) in comments reliably.

**Fix**: Remove all non-ASCII characters from the script. Comments in ASCII only, or no comments at all.

```ksp title="Broken"
{ ポルタメントの処理 }
on note
```

```ksp title="Fixed"
on note
```

---

### 2. Multi Script vs Instrument Script

The most time-consuming mistake. I loaded the script in the Multi rack's KSP slot instead of the instrument's own script slot. The error message when using `change_tune`:

```
change_tune() cannot be used in a multi script!
```

And `on release` simply doesn't exist in a multi script context — the callback is rejected with a red underline.

**Fix**: Open the instrument, click the wrench icon, go to Script Editor, and paste into one of the script slots there. The Multi rack slot is for a completely different use case.

---

### 3. Pitch unit is millicents — 1 semitone = 100,000

`change_tune` takes pitch in **millicents**. I had written `1000` thinking it was one semitone, which made portamento technically functional but inaudible (it was sliding by 1/100th of a semitone).

```ksp title="Wrong — 1/100th of a semitone"
declare const $SEMITONE := 1000
```

```ksp title="Correct"
declare const $SEMITONE := 100000
```

The math: 1 semitone = 100 cents = 100,000 millicents.

---

### 4. `declare ui_knob` syntax

The KSP declaration syntax is `declare ui_knob $name (min, max, display_ratio)`. A label string does not go here.

```ksp title="Wrong"
declare ui_knob $knob_porta_time ("Time", 0, 2000, 1)
```

```ksp title="Correct"
declare ui_knob $knob_porta_time (0, 2000, 1)
set_text($knob_porta_time, "Time")
```

The same applies to `declare ui_switch` and `declare ui_menu` — always separate the declaration from the text assignment.

---

### 5. `declare polyphonic` — per-note variables

KSP has no `declare local`. Variables declared inside a callback don't persist across note events. To hold a value that's independent per note (like the note number, current pitch offset, vibrato phase), declare it in `on init` using `declare polyphonic`:

```ksp
on init
    declare polyphonic $note_num
    declare polyphonic $offset
    declare polyphonic $phase
end on

on note
    $note_num := $EVENT_NOTE
    { $note_num is independent for each simultaneous note }
end on
```

Related: in `on release`, `$EVENT_NOTE` is not accessible. Instead, save it in `on note` via a polyphonic variable and read that in `on release`.

```ksp
on release
    %held[$note_num] := 0   { $note_num saved in on note }
end on
```

---

### 6. CC array is `%CC[]`, not `$CC[]`

`%` prefix means integer array in KSP. The mod wheel value is at `%CC[1]`, not `$CC[1]`.

```ksp title="Wrong"
if ($CC[1] > 0)
```

```ksp title="Correct"
if (%CC[1] > 0)
```

---

## Building the UI

`make_perfview` activates the Performance View, and `move_control($var, col, row)` places controls on a grid. `col = 0` hides a control.

```ksp
on init
    make_perfview
    set_ui_height_px(104)

    declare ui_label $lbl_porta (1, 1)
    set_text($lbl_porta, "PORTA")
    set_control_par(get_ui_id($lbl_porta), $CONTROL_PAR_TEXT_ALIGNMENT, 1)
    move_control($lbl_porta, 1, 1)

    declare ui_knob $knob_porta_time (0, 2000, 1)
    set_text($knob_porta_time, "Time")
    set_knob_unit($knob_porta_time, $KNOB_UNIT_MS)
    set_knob_defval($knob_porta_time, 150)
    $knob_porta_time := 150
    move_control($knob_porta_time, 1, 2)
end on
```

---

## Custom Background Image

To set a background image for the Performance View:

```ksp
set_control_par_str($INST_WALLPAPER_ID, $CONTROL_PAR_PICTURE, "wallpaper")
```

The image must live in a `[InstrumentName] Resources/pictures/` folder next to the `.nki` file. PNG and TGA both work. Minimum width is 633px; height should be `68 + the value passed to set_ui_height_px`.

A companion `.txt` file with the same name is required:

```
Has Alpha Channel: yes
Number of Animations: 0
Horizontal Animation: no
Vertical Resizable: no
Horizontal Resizable: no
Fixed Top: 0
Fixed Bottom: 0
Fixed Left: 0
Fixed Right: 0
```

---

## The Finished Script

[GitHub: NakahodoRintaro/kontakt_test](https://github.com/NakahodoRintaro/kontakt_test/blob/main/scripts/FretlessBass.ksp)

Portamento, slide-in, and vibrato all working. The UI has six knobs and two switches arranged in a grid with section labels.

---

## Summary

| Problem | Cause | Fix |
|---|---|---|
| `syntax error on line 1` | Non-ASCII characters in comments | ASCII-only comments |
| `change_tune` not available | Script in Multi rack slot | Move to instrument script slot |
| Portamento inaudible | Used `1000` for one semitone | Use `100000` (millicents) |
| `ui_knob` shows red | Label string in declaration | Use `set_text()` separately |
| Can't read note in `on release` | `$EVENT_NOTE` invalid there | Save with `declare polyphonic` in `on note` |
| CC value always zero | Used `$CC[1]` | Use `%CC[1]` |

The official KSP Reference Manual PDF is the most reliable source. Whenever something turns red, the first thing to check is the exact syntax definition and unit specification in the manual.

*Live with a Smile!*
