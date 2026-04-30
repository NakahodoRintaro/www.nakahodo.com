---
title: "自作フレットレスベース音源を KSP スクリプトで動かすまで ——ハマりポイント全記録"
authors: rintaro
tags: [Music, engineering]
image: /img/ogp-kontakt-ksp.png
description: "自分で録音したフレットレスベースを Kontakt 音源にするために KSP スクリプトを書いた記録。文字コードエラーからミリセント単位の罠、マルチスクリプトとインストゥルメントスクリプトの違いまで、ハマりポイントを全部まとめた。"
---

自分で録音したフレットレスベースを Kontakt 音源にしたくて、KSP（Kontakt Script Processor）でスクリプトを書き始めた。「動く」まで思ったより長かった。ハマったポイントを全部記録しておく。

<!-- truncate -->

---

## 作りたかったもの

フレットレスベースをマルチサンプリングして Kontakt に読み込み、ポルタメント・スライドイン・ビブラートを KSP スクリプトで実現したかった。

最終的なスクリプトの機能：
- **ポルタメント**：前の音から現在の音へグライドする（時間・レガート ON/OFF）
- **スライドイン**：音が始まる前に半音数セント下（または上）からアプローチ
- **ビブラート**：CC1 モジュレーションホイールで深さを上書き可能

---

## KSP とは

KSP は NI Kontakt に内蔵されたスクリプト言語。`on note` / `on release` / `on init` などのコールバックに処理を書くことで、ピッチ変更・CC 反応・カスタム UI を実現できる。

スクリプトは 2 種類のスロットに入れられる：

| スロット | 場所 | 特徴 |
|---|---|---|
| **インストゥルメントスクリプト** | レンチアイコン → Script Editor | `on note` / `on release` / `change_tune` が使える |
| **マルチスクリプト** | Multi ラックの KSP スロット | `on note` / `change_tune` は使えない |

これを最初に知らず、マルチスクリプトに貼り付けて「なぜ動かない？」と数時間悩んだ。

---

## ハマりポイント全記録

### 1. 日本語コメントで `syntax error on line 1`

スクリプトの先頭に日本語でコメントを書いたところ、Kontakt が `syntax error on line 1` を吐いて一切読み込めなくなった。

**原因**：KSP は UTF-8 以外の文字（または BOM 付き UTF-8）を受け付けないことがある。日本語コメントの文字コードが Kontakt のパーサーと合わなかった。

**対処**：コメントをすべて英語か ASCII 記号だけにする。

```ksp title="NG"
{ ポルタメントの処理 }
on note
```

```ksp title="OK"
on note
```

---

### 2. マルチスクリプト vs インストゥルメントスクリプト

最初にスクリプトを貼ったのは Multi ラック上の KSP スロット（マルチスクリプト）だった。ここでは `change_tune` や `on release` が使えず、貼るとエラーになる。

```
change_tune() cannot be used in a multi script!
```

**対処**：Kontakt でインストゥルメントを開き、レンチアイコン → Script Editor → スクリプトスロットに貼り直す。

---

### 3. ピッチ単位はミリセント ——1 半音 = 100,000

`change_tune` のピッチ単位はミリセント（millicents）。最初に 1,000 と書いてしまい、ポルタメントが動いているのにほとんど聞こえないという状態になった。

```ksp title="NG（1 半音のつもりが 100 分の 1 半音）"
declare const $SEMITONE := 1000
```

```ksp title="OK"
declare const $SEMITONE := 100000
```

1 セント = 1,000 ミリセント、1 半音 = 100 セント = **100,000 ミリセント**。

---

### 4. `declare ui_knob` の構文

KSP マニュアルの構文は `declare ui_knob $name (min, max, display_ratio)` で、ラベル文字列をここに書けない。

```ksp title="NG"
declare ui_knob $knob_porta_time ("Time", 0, 2000, 1)
```

```ksp title="OK"
declare ui_knob $knob_porta_time (0, 2000, 1)
set_text($knob_porta_time, "Time")
```

`declare ui_switch` / `declare ui_menu` も同様。宣言とテキスト設定は分ける。

---

### 5. `declare polyphonic` — ポリフォニック変数

`on note` コールバック内で宣言した変数は存在しない（KSP に `declare local` はない）。音ごとに独立した値を持つには `on init` 内で `declare polyphonic $xxx` と宣言する。

```ksp
on init
    declare polyphonic $note_num
    declare polyphonic $offset
    declare polyphonic $phase
    { ... }
end on

on note
    $note_num := $EVENT_NOTE
    { $note_num は音ごとに独立した値 }
end on
```

`on release` で `%held[$EVENT_NOTE] := 0` と書くと赤くなるのも同じ理由。`$EVENT_NOTE` は `on release` では参照できないので、`on note` で `$note_num := $EVENT_NOTE` と保存した polyphonic 変数を使う。

---

### 6. CC 配列は `%CC[]`

モジュレーションホイールの値を読む際、`$CC[1]` ではなく `%CC[1]` （パーセント記号 = 整数配列）が正しい。

```ksp title="NG"
if ($CC[1] > 0)
```

```ksp title="OK"
if (%CC[1] > 0)
```

---

## UI レイアウト

`make_perfview` を呼ぶと Performance View モードになり、`move_control($var, col, row)` でグリッドにコントロールを配置できる。

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

`move_control($var, 0, 0)` でコントロールを非表示にもできる。

---

## 背景画像

パフォーマンスビューの背景を変えるには `$INST_WALLPAPER_ID` を使う。

```ksp
set_control_par_str($INST_WALLPAPER_ID, $CONTROL_PAR_PICTURE, "wallpaper")
```

画像は `.nki` ファイルと同階層の `[インストゥルメント名] Resources/pictures/` フォルダに置く。PNG / TGA が使える。最小幅 633px、高さは `68 + set_ui_height_px で指定した値` px。

画像と同名の `.txt` ファイルが必要：

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

## 完成したスクリプト

[GitHub: NakahodoRintaro/kontakt_test](https://github.com/NakahodoRintaro/kontakt_test/blob/main/scripts/FretlessBass.ksp)

ポルタメント・スライドイン・ビブラートすべて動いている。UI は 6 つのノブと 2 つのスイッチ、セクションラベルをグリッドに並べた。

---

## まとめ

| 問題 | 原因 | 対処 |
|---|---|---|
| `syntax error on line 1` | 日本語コメントの文字コード | コメントを ASCII のみに |
| `change_tune` が使えない | マルチスクリプトに貼っていた | インストゥルメントスクリプトスロットに移す |
| ポルタメントが聞こえない | ミリセントを 1,000 にしていた | 100,000 に修正 |
| `ui_knob` が赤い | 宣言にラベル文字列を入れた | `set_text()` を別で呼ぶ |
| `on release` で変数が取れない | `$EVENT_NOTE` は `on release` で無効 | `declare polyphonic` で保存 |
| CC 値が読めない | `$CC[]` ではなく `%CC[]` | `%CC[1]` に修正 |

KSP のマニュアルは公式 PDF が一番正確。エラーが出たらまずマニュアルの構文定義と単位のページを確認するのが近道だった。

*Live with a Smile!*
