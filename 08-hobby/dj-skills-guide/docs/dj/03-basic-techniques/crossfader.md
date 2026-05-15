# Crossfader Complete Guide

The crossfader is one of the most iconic controls on a DJ mixer, a hardware component used to seamlessly switch between two audio sources. This guide comprehensively covers everything from the physical mechanism of the crossfader, to how it is used for different DJ styles, advanced techniques practiced by professionals, and the Smart CFX feature unique to the DDJ-FLX4.

## What You Will Learn

- Physical structure and operating principle of the crossfader
- Fundamental differences from the channel fader and how to use each
- Basic usage by DJ style (Mix DJ / Scratch DJ / Hybrid)
- Theory of curve settings and practical adjustment methods
- The role of the crossfader in Mix DJs vs. Scratch DJs
- Detailed explanation of the DDJ-FLX4's Smart CFX feature
- Practical techniques (cut mix, transform, crab scratch, etc.)
- Staged practice menus and a roadmap for improvement
- Common mistakes and troubleshooting
- Tips and advice from professional DJs

## Why Learn the Crossfader

### Differences in Importance by DJ Style

The importance of the crossfader varies greatly depending on the DJ style you are aiming for. Understanding this correctly is the first step to efficient practice.

**Mix DJ (House / Techno / Trance / Progressive):**
```
Frequency of use: Low (many DJs barely use it)
Primary operations: Channel fader + EQ
Crossfader position: Kept at center at all times

Why it isn't used:
- The channel fader allows for more precise volume adjustment
- Both hands are free to operate EQ and effects
- Long mixes (gradual transitions over several minutes) are the mainstream
- Industry convention has established channel fader-centered operation

Cases where the crossfader is used exceptionally:
- When a sudden transition is needed
- When using special features like Smart CFX
- As a creative performance element
```

**Scratch DJ (Hip Hop / Turntablism / Breaks):**
```
Frequency of use: Very high (essential skill)
Primary operations: Crossfader + jog wheel / turntable
Curve setting: Fast (sharp cut) is standard

Why it's essential:
- The crossfader's ON/OFF of sound is indispensable for creating scratch sounds
- High-speed cutting (multiple times per second) is required
- Beat juggling and transform scratch cannot exist without the crossfader
- Crossfader technique is the core evaluation criterion at DJ battle competitions

Representative scratch DJs:
- DJ Qbert (god of turntablism)
- DJ Craze (three-time DMC world champion)
- DJ A-Trak (youngest DMC champion)
- DJ Jazzy Jeff (pioneer of scratching)
```

**Hybrid DJ (Open Format / Wedding / Mobile):**
```
Frequency of use: Moderate
Primary operations: Use channel fader and crossfader depending on the situation
Curve setting: Smooth to Medium

Characteristics:
- Spanning genres requires a variety of techniques
- Cut with the crossfader in Hip Hop sections,
  long mix with channel faders in EDM sections
- Basic crossfader operation should be mastered
```

### Benefits of Learning the Crossfader

Even if you are aiming to be a Mix DJ, understanding the basics of the crossfader has significant benefits.

1. **More tools in your arsenal** - Enables diverse transitions depending on the situation
2. **Emergency response** - When track BPMs differ greatly, a hard cut with the crossfader is effective
3. **Smart CFX utilization** - Controllers like the DDJ-FLX4 support special effects linked to the crossfader
4. **Deeper musical understanding** - Understanding of beat structure deepens through the crossfader
5. **Improved performance quality** - More dynamic DJ play is possible visually as well


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [Beatmatching](./beatmatching.md)

---

## 1. What Is the Crossfader

### 1.1 Definition and Basic Concepts

The crossfader is a horizontal slider control on a DJ mixer, used to control the volume balance between two audio channels (usually Deck A and Deck B).

```
Basic Principle of the Crossfader:

Relationship between position and volume:
  Far left (A side): Deck A = 100%, Deck B = 0%
  Center:            Deck A = 100%, Deck B = 100% (both at full volume)
  Far right (B side): Deck A = 0%, Deck B = 100%

※ Volume distribution at center changes depending on curve setting (described later)
```

### 1.2 Historical Background

Understanding the history of the crossfader helps you see why this control came to occupy an important place in DJ culture.

```
Crossfader History Timeline:

Early 1970s:
- DJs switched tracks using the volume knobs on rotary mixers
- Grandmaster Flash devised the Quick Mix Theory
- The need to quickly switch between two turntables arose

1977:
- Richard Wadman designed the first crossfader
- First installed on the GLI PMX 9000 mixer
- Intuitive operation via a horizontal slider became possible

1980s:
- Crossfader rapidly spread among Hip Hop DJs
- Evolved alongside the development of scratch techniques
- Scratch-dedicated mixers appeared, such as the Vestax PMC-05 and Rane TTM 54i

1990s:
- Rise of DJ battles (DMC, ITF)
- Crossfader quality became an evaluation criterion for DJ mixers
- Magnetic and optical crossfaders appeared
- Rane, Vestax, and Ecler competed with high-quality crossfaders

2000s onward:
- Software-controlled crossfaders also emerged with the rise of digital DJing
- Serato, Traktor, and Rekordbox implemented curve customization
- Miniaturization of crossfaders in MIDI controllers
- Popularity of aftermarket replacement faders like InnoFader
```

### 1.3 Physical Structure and Operating Principle

Understanding how the crossfader operates enables proper maintenance and handling of malfunctions.

**Conductive Plastic (Resistive) Crossfader:**
```
Structure:
- A wiper (contact) slides across a resistive element (conductive plastic track)
- Resistance value changes based on the wiper position
- The change in resistance is converted to a volume change

Advantages:
✓ Inexpensive and widely available
✓ Simple structure
✓ Easy to repair/replace

Disadvantages:
✗ Sound quality degrades with wear (noise generation)
✗ Limited durability under high-speed operation
✗ Susceptible to dust and dirt
✗ Short lifespan for scratch DJs

Estimated lifespan:
- General use: 2–3 years
- Scratch DJs: 6 months to 1 year
```

**Magnetic (Non-contact) Crossfader:**
```
Structure:
- A magnet moves along a rail
- A Hall sensor detects the magnet's position
- Position information is acquired without physical contact

Advantages:
✓ No wear due to non-contact design
✓ Extremely low noise
✓ Ultra-light feel (nearly zero cut lag)
✓ Long lifespan

Disadvantages:
✗ Expensive
✗ Difficult to repair

Representative products:
- InnoFader (Audio Innovate)
- Vestax CF-PCV / PMC series built-in
```

**Optical Crossfader:**
```
Structure:
- A shutter moves between an LED and a light sensor
- The amount of light blocked changes with shutter position
- The amount of light is converted to an electrical signal to detect position

Advantages:
✓ Non-contact, low wear
✓ High precision
✓ Relatively resistant to dust

Disadvantages:
✗ LED/sensor degradation
✗ Possible interference from some ambient light

Representative products:
- Rane TTM series built-in
```

### 1.4 Placement on the DDJ-FLX4

On the DDJ-FLX4, the crossfader is located at the bottom center of the front panel. This is the industry-standard placement, the most accessible position for a DJ during performance.

```
DDJ-FLX4 Front Panel Schematic:

┌────────────────────────────────────────────────┐
│                                                │
│  [Deck A area]              [Deck B area]      │
│                                                │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │Jog   │  │Mixer │  │Mixer │  │Jog   │      │
│  │Wheel │  │Ch A  │  │Ch B  │  │Wheel │      │
│  │      │  │      │  │      │  │      │      │
│  └──────┘  │[Hi] │  │[Hi] │  └──────┘      │
│            │[Mid]│  │[Mid]│                  │
│            │[Low]│  │[Low]│                  │
│            │     │  │     │                  │
│            │[ChA]│  │[ChB]│  ← Channel faders│
│            │Fader│  │Fader│                  │
│            └──────┘  └──────┘                  │
│                                                │
│  [Smart CFX]  ←──── Smart CFX button          │
│                                                │
│  A ◄═══════════[■]═══════════► B              │
│        ↑                                       │
│    Crossfader                                  │
│                                                │
└────────────────────────────────────────────────┘

Physical specifications of the crossfader (DDJ-FLX4):
- Stroke length: approx. 45 mm
- Type: Conductive Plastic (resistive)
- Curve setting: changeable in software (Rekordbox)
- Cut lag: adjustable in software
```

### 1.5 About Cut Lag

Cut lag indicates how much distance from the end of the crossfader is needed for sound to be completely cut. It is a very important parameter for scratch DJs.

```
Concept of Cut Lag:

Total crossfader stroke
|◄───────────────────────────────────────►|
|                                         |
|◄─►|                               |◄─►|
 ↑                                     ↑
 Cut lag (left)                     Cut lag (right)

Small cut lag (0.5 mm or less):
→ Moving the fader just slightly makes sound appear/disappear
→ Ideal for scratching
→ High-speed cutting is easy

Large cut lag (3 mm or more):
→ Fader must be moved a certain distance before sound appears
→ Not particularly a problem for Mix DJs
→ Prevents unintended cuts

Cut lag on DDJ-FLX4:
- Hardware cut lag is fixed
- Can be pseudo-adjusted with Rekordbox software settings
- Default settings are fine for beginners
```

---

## 2. Differences from the Channel Fader

### 2.1 Fundamental Difference in Design Philosophy

The channel fader and crossfader may look like similar sliders at first glance, but their design philosophy and purpose of use are fundamentally different.

**Channel Fader (Line Fader):**
```
Design philosophy: Independently control the volume of each deck

Characteristics:
✓ Each channel is completely independent
✓ Multiple channels can be set to any level simultaneously
✓ Vertical slider (up = louder, down = quieter)
✓ Usually scaled 0 (minimum) to 10 (maximum)
✓ Small dead zone, fine volume adjustment possible

Freedom of operation:
- Can set Deck A to 70% and Deck B to 30%
- Can also set both Deck A and Deck B to 100%
- On a mixer with 3+ channels, each channel is controlled independently
- Fader position intuitively shows volume

Why Mix DJs prefer it:
1. Both hands are free → can operate faders and EQ simultaneously
2. Gradual volume adjustment → ideal for long mixes
3. Independent volume management per deck → easy to mix tracks of different recording levels
4. Industry standard → gets you used to operation on club-installed mixers (DJM-900NXS2, etc.)
```

**Crossfader:**
```
Design philosophy: Switch (blend) between two decks

Characteristics:
✓ Two channels are linked (one goes up as the other goes down)
✓ Horizontal slider (left = Deck A, right = Deck B)
✓ Controls two channels simultaneously with one operation
✓ Design specialized for high-speed cutting

Operational characteristics:
- Can switch 2 channels with one hand
- Cut operations (ON/OFF of sound) can be done quickly
- While scratching, the other hand is free for record operation
- Essential for special techniques like beat juggling

Why Scratch DJs prefer it:
1. One-hand operation → other hand free for jog wheel / record operation
2. High-speed cut → can cut 4+ times per second
3. Intuitive switching → left/right movement directly links to sound switching
4. Battle DJ standard → skill criterion at competitions like DMC
```

### 2.2 Detailed Operational Comparison

Even when performing the same transition (track switch), the operational procedure differs between channel fader and crossfader.

**Transition with Channel Fader:**
```
Scenario: Transition from Deck A (playing) → Deck B

Preparation:
- Deck A channel fader: 100% (up)
- Deck B channel fader: 0% (down)
- Crossfader: fixed at center (don't touch)
- Cue point confirmed on Deck B

Procedure:
Time  | Deck A   | Deck B   | Action
──────┼──────────┼──────────┼─────────────────
0:00  | 100%     | 0%       | Start Deck B (confirm with headphones)
0:04  | 100%     | 0%       | Beatmatching complete
0:08  | 100%     | 20%      | Begin slowly raising Deck B fader
0:12  | 100%     | 40%      | Deck B starts to be felt
0:16  | 90%      | 60%      | Begin slightly lowering Deck A fader
0:20  | 70%      | 80%      | Deck B becomes the lead
0:24  | 40%      | 100%     | Lower Deck A further
0:28  | 10%      | 100%     | Deck A nearly inaudible
0:32  | 0%       | 100%     | Deck A completely cut → transition complete

Duration: approx. 32 seconds (for 32 bars at 120 BPM)
```

**Transition with Crossfader:**
```
Scenario: Transition from Deck A (playing) → Deck B

Preparation:
- Deck A channel fader: 100%
- Deck B channel fader: 100% (both raised)
- Crossfader: far left (Deck A side)
- Cue point confirmed on Deck B

Procedure:
Time  | Crossfader      | Deck A out | Deck B out | Action
──────┼─────────────────┼────────────┼────────────┼──────────
0:00  | Far left (0%)   | 100%       | 0%         | Deck B playback starts
0:04  | Far left (0%)   | 100%       | 0%         | Beatmatching
0:08  | 25%             | 85%        | 15%        | Slowly toward right
0:16  | 50% (center)    | 100%       | 100%       | Both heard at center
0:24  | 75%             | 15%        | 85%        | Further right
0:32  | Far right (100%)| 0%         | 100%       | Complete

Duration: approx. 32 seconds
Note: Volume distribution during transition varies based on curve setting
```

### 2.3 Detailed Comparison of Advantages and Disadvantages

```
┌──────────────────┬─────────────────────┬─────────────────────┐
│ Aspect           │ Channel Fader       │ Crossfader          │
├──────────────────┼─────────────────────┼─────────────────────┤
│ Volume indep.    │ ◎ Fully independent │ △ Linked            │
│ Fine adj. prec.  │ ◎ Very high         │ ○ Curve-dependent   │
│ High-speed cut   │ △ Difficult         │ ◎ Optimal           │
│ Both-hand freedom│ ○ 1 hand per ch     │ ◎ 1 hand for 2 ch   │
│ Simult. EQ ops   │ ◎ Possible with other hand │ △ Difficult  │
│ Scratch synergy  │ ✗ Not suited        │ ◎ Optimal           │
│ 3+ ch mixing     │ ◎ Each ch indep.    │ ✗ Only 2 ch         │
│ Club compat.     │ ◎ Any mixer         │ ○ Some mixers        │
│ Long mix         │ ◎ Optimal           │ ○ Possible          │
│ Hard cut         │ ○ Possible          │ ◎ Optimal           │
│ Beginner ease    │ ◎ Intuitive         │ ○ Curve understanding│
│ Performance      │ ○ Understated       │ ◎ Visually dynamic  │
└──────────────────┴─────────────────────┴─────────────────────┘
```

### 2.4 Examples of How Professional DJs Use Each

Knowing how actual professional DJs use each fader gives you hints for finding the optimal method for your own style.

```
Carl Cox (Techno / House):
- Channel fader: 100% usage
- Crossfader: barely used
- Characteristics: 3-deck mixing, heavy EQ use
- Equipment: Pioneer DJM-900NXS2 (also uses rotary mixer)

DJ Jazzy Jeff (Hip Hop / Turntablism):
- Crossfader: 90% usage
- Channel fader: only for volume setup
- Characteristics: pioneer of transform scratch
- Equipment: Rane TTM 57SL → Rane Seventy-Two

A-Trak (Open Format / Turntablism):
- Crossfader: 60% usage
- Channel fader: 40% usage
- Characteristics: combines scratching and long mixes
- Equipment: Rane Seventy

Richie Hawtin (Minimal Techno):
- Channel fader: 100% usage (more accurately, rotary knobs)
- Crossfader: not used
- Characteristics: uses MODEL 1 mixer, which has no crossfader
- Equipment: PLAYdifferently MODEL 1
```

---

## 3. Basic Usage

### 3.1 Usage for Mix DJs (Center-Fixed Style)

The majority of Mix DJs (especially House, Techno, Trance, Progressive) keep the crossfader fixed at center and mix using only the channel faders.

**How to set up center-fixed:**
```
Settings on DDJ-FLX4:
1. Physically move the crossfader to center
2. Confirm both channel faders are active
3. After that, do not touch the crossfader at all

Benefits of this setting:
✓ No risk of accidentally touching the crossfader and causing unintended cuts
✓ Both hands can focus on channel faders and EQ
✓ Same operational feel as club professional mixers (Allen & Heath Xone, Pioneer DJM, etc.)

Notes:
- Some DJs remove the crossfader or tape it in place (for standalone mixers)
- The DDJ-FLX4 crossfader cannot be physically removed
- It is also possible to disable the crossfader in Rekordbox settings
  → [Preferences] → [Controller] → Set Crossfader to "Through"
```

**Practical mixing with channel fader only:**
```
Basic procedure (combined with EQ mix):

Phase 1: Preparation
- Deck A: playing, channel fader 100%
- Deck B: cued, channel fader 0%
- Crossfader: fixed at center

Phase 2: Beatmatching
- Monitor Deck B through headphones
- Match BPM (using Sync or manual)
- Confirm phrase timing

Phase 3: Transition begins
- Slowly raise Deck B's channel fader
- Keep Deck B's EQ Low (Bass) at -∞
  → Prevents bass collision

Phase 4: EQ swap
- Gradually raise Deck B's Low EQ while
- Gradually lowering Deck A's Low EQ
  → Bassline handoff (Bass Swap)

Phase 5: Complete
- Set Deck A's channel fader to 0%
- Return all of Deck B's EQ to center position
- Also return Deck A's EQ to center (ready for next use)

Approximate durations:
- House/Techno: 16–64 bars (approx. 30 seconds to 2 minutes)
- Trance: 32–64 bars (approx. 1–2 minutes)
- Progressive: 64–128 bars (approx. 2–4 minutes)
```

### 3.2 Mixing with the Crossfader

A method of mixing using only the crossfader. More casual than the channel fader, but fine adjustments are harder.

**Basic crossfader mix:**
```
Preparation:
- Deck A channel fader: 100%
- Deck B channel fader: 100%
- Crossfader: far left (Deck A only playing)
- Curve setting: Smooth

Procedure:
1. Deck A is playing (crossfader at far left)
2. Prepare Deck B (cue, beatmatch)
3. As the phrase changes, begin slowly moving the crossfader to the right
4. Passing through center, both tracks are heard
5. When far right is reached, only Deck B plays
6. Prepare the next track on Deck A

Points:
- Make sure the curve is set to Smooth
  → On Fast, sudden volume changes occur partway through the mix
- Keep movement speed constant
  → Stopping or changing speed midway tends to sound unnatural
- Using EQ operations together enables an even smoother transition
```

**Advanced crossfader mixing — hard cut:**
```
Purpose: Genre change, surprise effect

Procedure:
1. Deck A playing (crossfader at far left)
2. Prepare next track on Deck B (BPM matching may not be needed)
3. Set cue at the head of Deck B's phrase
4. Time it (at bar boundaries in Deck A)
5. Move crossfader all the way to the right + start Deck B playback
6. Deck A stops immediately

When to use:
- When greatly changing genre (EDM → Hip Hop, etc.)
- Switching to another track at the moment of a drop
- Performance at DJ battles
- Resuming after MC intervention at Wedding DJ

Notes:
- Timing is everything → cut on the downbeat
- Confirm there is no volume difference through headphones beforehand
- Decide based on audience reaction (hard cuts can feel abrupt)
```

### 3.3 Halfway (Midpoint) Technique

A technique of stopping the crossfader near center to play two tracks simultaneously.

```
Details of the Halfway Mix:

Purpose: Play two tracks simultaneously to create a unique soundscape

Preparation:
- Perfectly match BPM of both tracks (Sync recommended)
- Both channel faders: 100%
- Crossfader: center

EQ management is key:
- If both tracks' Low (Bass) is at full simultaneously, sound becomes muddy
  → Lower or cut one track's Low
- Control presence of each track with Mid/Hi adjustments

Example EQ settings:
  Deck A: Low -3 dB, Mid 0 dB, Hi 0 dB
  Deck B: Low -∞ (cut), Mid -3 dB, Hi 0 dB

→ Utilize Deck A's bassline while layering Deck B's melody and higher elements

Applications:
- Acapella + instrumental mashup
- Percussion + melodic track layering
- Live remix creation
- Same track on 2 copies for flanging effect
```

---

## 4. Curve Settings

### 4.1 Theory and Mathematical Understanding of Curves

The crossfader "curve" is the function (curve) that defines the relationship between the physical position of the fader and the actual volume output. This setting is one of the most important parameters, directly tied to DJ style.

```
Mathematical Expression of Curves:

Linear curve:
  Output = Input
  → Volume changes proportionally to fader position
  → Not commonly used in practice (problem of volume dip at center)

Smooth curve (Constant Power / Equal Power):
  Deck A output = cos(θ × π/2)
  Deck B output = sin(θ × π/2)
  ※ θ = fader position (0 = far left, 1 = far right)

  → Total power is kept constant at center
  → No volume dip during mixing
  → Standard for Mix DJs

Fast curve (Cut / Sharp):
  A curve with a steep change
  → Volume only changes when fader is near the ends
  → Near center, both channels are at nearly full output
  → Ideal for cut operations while scratching

Visual comparison of curves:

Volume                  Smooth Curve
100%|  ╲                    ╱
    |    ╲                ╱
 75%|      ╲            ╱
    |        ╲        ╱
 50%|          ╲    ╱     ← Both at 50% at center
    |            ╳
 25%|          ╱    ╲
    |        ╱        ╲
  0%|──────╱────────────╲──
    Left    Center    Right
    ─── Deck A    ─── Deck B

Volume                  Fast Curve
100%|══════╗          ╔══════
    |      ║          ║
 75%|      ║          ║
    |      ║          ║
 50%|      ║          ║     ← Both nearly 100% at center
    |      ║          ║
 25%|      ║          ║
    |      ╚╗        ╔╝
  0%|────────╚════════╝──
    Left    Center    Right
    ─── Deck A    ─── Deck B
```

### 4.2 Details of the Smooth Curve (For Mix DJs)

The Smooth curve (also called Equal Power curve or Constant Power curve) is the most natural and easy-to-use curve setting for Mix DJs.

```
Smooth Curve Volume Change Table:

Fader position | Deck A out | Deck B out | Total power
───────────────┼────────────┼────────────┼────────────
0% (far left)  | 100%       | 0%         | 100%
10%            | 99%        | 2%         | 101%
20%            | 95%        | 6%         | 101%
30%            | 89%        | 15%        | 104%
40%            | 81%        | 31%        | 112%
50% (center)   | 71%        | 71%        | 142% (√2×)
60%            | 31%        | 81%        | 112%
70%            | 15%        | 89%        | 104%
80%            | 6%         | 95%        | 101%
90%            | 2%         | 99%        | 101%
100% (far rt.) | 0%         | 100%       | 100%

※ Total power exceeding 100% is because both channels are
   outputting simultaneously. This is normal behavior.
   However, watch out for clipping at the master level.

Scenes where Smooth curve is optimal:
✓ Long mixes (transitions of 16+ bars)
✓ Mixing melodic tracks with each other
✓ Mixing vocal tracks
✓ When you don't want volume changes to be conspicuous
✓ Calm environments like lounges and restaurants
```

### 4.3 Details of the Fast Curve (For Scratch DJs)

The Fast curve (also called Sharp curve or Cut curve) is a curve setting where volume changes sharply at the ends of the fader.

```
Fast Curve Volume Change Table:

Fader position | Deck A out | Deck B out | Feature
───────────────┼────────────┼────────────┼──────────────
0% (far left)  | 100%       | 0%         | Only Deck A
1%             | 100%       | 0%         | Deck B still silent
2%             | 100%       | 0%         | Cut lag range
3%             | 100%       | 80%        | Deck B suddenly enters!
5%             | 100%       | 95%        |
10%            | 100%       | 100%       | Both at full
...            | ...        | ...        |
50% (center)   | 100%       | 100%       | Both at full
...            | ...        | ...        |
90%            | 100%       | 100%       | Both at full
95%            | 95%        | 100%       |
97%            | 80%        | 100%       | Deck A suddenly drops
98%            | 0%         | 100%       | Cut lag range
99%            | 0%         | 100%       | Deck A still silent
100% (far rt.) | 0%         | 100%       | Only Deck B

Scenes where Fast curve is optimal:
✓ Scratching (all scratch techniques)
✓ Cut mix (high-speed track switching)
✓ Transform (multiple cuts per second)
✓ Beat juggling
✓ Battle DJ performance
✓ Hip Hop DJ sets

Notes for Fast curve:
✗ Not suited for mixing (sudden volume change makes a "click")
✗ Beginners should first practice with Smooth, then transition
✗ Equipment with high crossfader precision is preferable
```

### 4.4 How to Set the Curve on the DDJ-FLX4

The DDJ-FLX4 crossfader curve is set from software (Rekordbox).

```
Setting procedure in Rekordbox:

1. Launch Rekordbox
2. Connect DDJ-FLX4
3. Go to menu → [Preferences] and open it
4. Select [Controller] from the left sidebar
5. Select the [Mixer] tab
6. Find the "Crossfader Curve" section
7. Change the setting with a slider or dropdown

Options:
┌──────────────┬───────────────────────────────┐
│ Setting name │ Description                   │
├──────────────┼───────────────────────────────┤
│ Smooth       │ Gradual change. For mixing    │
│ Normal       │ Intermediate characteristics  │
│ Fast         │ Steep change. For scratching  │
│ Through      │ Disables the crossfader       │
└──────────────┴───────────────────────────────┘

Recommended settings:
- Beginner Mix DJ: Smooth
- Intermediate Mix DJ: Smooth or Normal
- Scratch practice: Fast
- Crossfader not used: Through

Notes when changing settings:
- Changes are reflected in real time
- Changing during a set will suddenly shift the volume balance — be careful
- Always check before starting a set
```

### 4.5 Common Mistakes with Curve Settings

```
Mistake 1: Trying to mix with the Fast curve
→ Problem: Just slightly moving the fader causes a sudden volume change,
           making a smooth transition impossible
→ Fix: Use Smooth for mixing

Mistake 2: Trying to scratch with the Smooth curve
→ Problem: Cuts become soft and scratch sounds don't come out clearly
           Sound is not cut unless the fader is moved all the way to the end
→ Fix: Change to Fast when scratching

Mistake 3: Starting a set without checking curve settings
→ Problem: Previous settings remain, causing unintended behavior
           Especially on shared club equipment, another DJ's settings may remain
→ Fix: Develop the habit of always checking curve settings before playing

Mistake 4: Thinking the crossfader doesn't work because the Through setting is forgotten
→ Problem: When set to Through, the crossfader is disabled,
           and moving it doesn't change volume
→ Fix: Check if it is set to Through in the settings screen
```

---

## 5. Mix DJ vs. Scratch DJ: Detailed Comparison

### 5.1 Mix DJ's Crossfader Philosophy

For a Mix DJ, the crossfader is a control that's "nice to have but not essential." In fact, some professional club mixers exist that do not include a crossfader.

```
Mix DJ's Operational System:

Primary controls:
1. Channel faders × 2–4
2. 3-band EQ (Hi / Mid / Low) × per channel
3. Filter knob × per channel
4. Effects (Send / Return)

Role of the crossfader:
→ Supplementary control, or completely ignored

Typical Mix DJ setup:
- Crossfader: fixed at center or disabled with Through setting
- Channel faders: used to manage volume of both channels
- EQ: frequency band management during transitions (most important)
- Filter: used for creative effects
```

**Deep dive into why Mix DJs don't use the crossfader:**

```
Reason 1: Volume management precision
- The channel fader allows each deck's volume to be freely set independently from 0 to 100%
- With the crossfader, two channels are linked so raising one lowers the other
- Tracks have different recording levels, requiring independent volume management

Reason 2: Compatibility with EQ operations
- The core of mixing is frequency band management with EQ
  (Low Swap, Hi/Mid fade, etc.)
- With channel faders, one hand operates faders while the other operates EQ
- When using the crossfader, one hand is fixed on the fader,
  limiting EQ operations

Reason 3: Multi-deck mixing
- With 3+ decks, the crossfader can only switch 2 channels,
  making it impractical
- More and more DJs are using 3–4 decks lately

Reason 4: Club compatibility
- Pioneer DJM-900NXS2 (or DJM-V10) is installed as standard in clubs worldwide
- On these mixers, channel fader-centered operation is the assumption
- Relying on the crossfader makes it hard to adapt
  to various club environments
```

### 5.2 Scratch DJ's Crossfader Philosophy

For a Scratch DJ, the crossfader is part of an instrument and the core of expression.

```
Scratch DJ's Operational System:

Primary controls:
1. Crossfader (most important)
2. Jog wheel / turntable record (most important)
3. Channel fader (only for volume setup)
4. Transform button (on some mixers)

Role of the crossfader:
→ The instrument itself. The core of musical expression

Typical Scratch DJ setup:
- Crossfader curve: Fast (sharpest)
- Cut lag: minimum (setting close to 0 mm)
- Hamming factor: high (reactivity to high-speed cuts)
- Reverse mode: off (normal)
```

**Relationship between Scratch DJ's basic techniques and the crossfader:**

```
Baby Scratch:
- Crossfader: not used (always open)
- Operation: just move the record back and forth
- Sound: "wikki-wikki"
- Difficulty: ★☆☆☆☆

Chirp Scratch:
- Crossfader: open on forward, closed on back
- Operation: record moves forward + crossfader opens
            → record moves backward + crossfader closes
- Sound: "chwee"
- Difficulty: ★★☆☆☆

Transform Scratch:
- Crossfader: continuous rapid cuts
- Operation: move the record in one direction while
            quickly cutting the crossfader again and again
- Sound: "uh-uh-uh-uh-weeee" (chopped up)
- Difficulty: ★★★☆☆
- Origin: developed by DJ Jazzy Jeff

Flare Scratch:
- Crossfader: momentarily close & open from open state
- Operation: with crossfader open,
            flick your finger to close it instantly and reopen
- Sound: a brief gap (click) in the sound
- Difficulty: ★★★★☆
- Variations: 1-Click Flare, 2-Click Flare, Orbit

Crab Scratch:
- Crossfader: super-fast rapid hits with 4 fingers
- Operation: tap the edge of the fader with fingers from index to pinky in sequence
            → creates 4 cuts per stroke
- Sound: "ta-ta-ta-ta" (ultra-high-speed chops)
- Difficulty: ★★★★★
- Name origin: finger movement resembling a crab moving its legs

Twiddle Scratch:
- Crossfader: super-fast back-and-forth with thumb and index finger
- Operation: pinch the fader between thumb and index finger
            and quickly move it back and forth
- Sound: high-speed stutter effect
- Difficulty: ★★★★☆
```

### 5.3 Hybrid Approach

In the modern DJ scene, hybrid approaches incorporating both mixing and scratching are increasing.

```
Hybrid DJ Practice:

Example set composition:
1. Opening (Ambient / Deep House)
   → Long mix centered on channel faders
   → Crossfader: fixed at center

2. Build-up (House / Tech House)
   → Channel faders + EQ
   → Crossfader: fixed at center

3. Peak time (EDM / Hip Hop)
   → Crossfader cuts + scratch elements
   → Change curve setting to Fast

4. Bridge (R&B / Soul)
   → Smooth transition with crossfader
   → Change curve setting back to Smooth

5. Closing (Downtempo / Chill)
   → Channel fader centered
   → Crossfader: fixed at center

Hybrid DJ challenges:
- May need to change curve settings during the set
  → Understand the setlist in advance and plan switching points
- Need to master two technical systems
  → Double the practice time required (but DJ range expands greatly)
```

---

## 6. DDJ-FLX4's Smart CFX

### 6.1 What Is Smart CFX?

Smart CFX (Smart CrossFader Effects) is a proprietary feature equipped on the DDJ-FLX4 by Pioneer DJ, which automatically links effects to crossfader operation. Normally, DJ effects are operated with dedicated knobs and buttons, but enabling Smart CFX allows professional-sounding effect-enhanced transitions simply by moving the crossfader.

```
Basic Concept of Smart CFX:

Normal crossfader operation:
  Left → Right = Deck A volume goes down, Deck B volume goes up
  (simple volume switching)

Smart CFX ON crossfader operation:
  Left → Right = Deck A fades out with effects applied
               + Deck B fades in with effects applied
  (flashy transition with effects)

Supported software:
- Rekordbox (full feature support)
- Serato DJ Lite (partial feature support)
- djay (partial feature support)

Operating mode:
Toggle ON/OFF by pressing the Smart CFX button
→ Button lit: Smart CFX enabled
→ Button unlit: Smart CFX disabled (normal crossfader operation)
```

### 6.2 Smart CFX Effect Types

On the DDJ-FLX4's Smart CFX, multiple effect types can be selected in Rekordbox.

```
Effect List and Details:

1. Echo (Echo / Delay)
   ─────────────────────────
   Effect: Echo effect where sound repeats
   Behavior: The deeper the crossfader moves, the deeper the echo
   Features:
   - Easiest to use, hardest to fail
   - Tempo-synchronized echo applied automatically
   - Fading out track leaves a beautiful lingering echo

   When to use:
   - House / Techno transitions
   - Developing from a breakdown
   - Cool-down at the end of a set

   Tips:
   - Moving slowly produces a long echo tail
   - Moving quickly produces short echo with a cut feel

   ★ Beginner recommendation: ★★★★★

2. Filter
   ─────────────────────────
   Effect: Frequency filter is applied
   Behavior:
   - Left → center: Low-pass filter on Deck A (highs cut)
   - Center → right: High-pass filter removed from Deck B
   Features:
   - Most popular effect in DJ mixing
   - Natural sound change with less awkwardness
   - Resonance is automatically adjusted

   When to use:
   - Can be used across all genres
   - Especially effective in EDM and House

   ★ Beginner recommendation: ★★★★☆

3. Wash Out
   ─────────────────────────
   Effect: Sound spreads and fades like a reverberation
   Behavior: Reverb + filter applied gradually as fader moves
   Features:
   - Cinematic and fantastical transition
   - Ideal for dramatic staging
   - Note: using it too much becomes overbearing

   When to use:
   - Breakdowns in Trance / Progressive
   - Climax of a set
   - When you want to dramatically change the atmosphere

   ★ Beginner recommendation: ★★★☆☆

4. Noise
   ─────────────────────────
   Effect: White noise added as a build-up effect
   Behavior: Noise volume changes as fader moves
   Features:
   - Technique frequently used in EDM build-ups
   - Effect of building tension
   - Ideal for staging before a drop

   When to use:
   - Build-ups in EDM / Big Room
   - Lead-in to a drop
   - When you want to heighten excitement

   ★ Beginner recommendation: ★★☆☆☆

5. Spin Back
   ─────────────────────────
   Effect: Sound effect like a record spinning in reverse
   Behavior: Moving the fader causes the playing track to spin back and stop
   Features:
   - Very dramatic and conspicuous
   - Timing requires careful selection
   - Works well with cut-style transitions

   When to use:
   - Genre change
   - Surprise track change
   - Party highlight

   ★ Beginner recommendation: ★★☆☆☆
```

### 6.3 Smart CFX Operation Method (Detailed)

```
Basic Operation Flow:

Step 1: Locate the Smart CFX button
- Find the Smart CFX button on the DDJ-FLX4 front panel
- Button is located near the crossfader

Step 2: Select the effect type (in Rekordbox)
- Select the Smart CFX effect on the Rekordbox screen
- A selection UI is available on the performance mode screen

Step 3: Enable Smart CFX
- Press the Smart CFX button → button lights up
- At this point, effects are linked to the crossfader

Step 4: Execute the transition
- Slowly move the crossfader from left to right
- Transition proceeds with effects automatically applied
- Transition is complete when the far right is reached

Step 5: Disable Smart CFX
- After the transition is complete, press the Smart CFX button again → button goes off
- Returns to normal crossfader operation

Important notes:
- Smart CFX must be turned OFF after the transition is complete
  → If left ON, the next crossfader operation will also
     have effects applied
- Select the effect type before the transition begins
  → Changing midway produces unintended results
```

### 6.4 Effective Use of Smart CFX and Best Practices

```
Best Practices:

1. Don't overuse it
   - Using Smart CFX on every transition becomes excessive
   - Limit it to 20–30% of transitions in the entire set
   - Use it effectively for special moments (climax, genre change)

2. Match effect to genre
   - House / Techno → Echo, Filter
   - EDM / Big Room → Noise, Spin Back
   - Trance / Progressive → Wash Out, Echo
   - Hip Hop → Spin Back (sparingly)

3. Differentiate fader speed
   - Slow (4–8 bars): Echo, Filter → smooth transition
   - Medium (2–4 bars): Wash Out → dramatic development
   - Fast (1–2 bars): Spin Back, Noise → impact-focused

4. Why not to use it during practice
   - Smart CFX is like "training wheels"
   - First master manual transitions (EQ + fader)
   - Smart CFX is most effective when you have the fundamentals
   - Relying on Smart CFX carries the risk of not being able to DJ on other equipment

5. Compatibility with other DJ software
   - Smart CFX works best with the DDJ-FLX4 + Rekordbox combination
   - Some restrictions with Serato DJ Lite
   - Smart CFX does not exist on club-installed equipment
     → Mastering foundational skills is the top priority
```

### 6.5 Comparison of Smart CFX vs. Manual Effects

```
Smart CFX:
✓ Even beginners can easily create professional-looking transitions
✓ Operation complete just by moving the crossfader
✓ Effect timing is automatically optimized
✗ Limited customization range
✗ Only usable with DDJ-FLX4 + Rekordbox
✗ Cannot fine-tune detailed parameters

Manual effects:
✓ Complete customization possible
✓ Skills applicable to any equipment
✓ Free combination of effects
✓ Show originality through parameter fine-tuning
✗ Complex operation (effect selection, Dry/Wet, timing, etc.)
✗ Takes time to practice
✗ Higher risk of mistakes

Conclusion:
→ The ideal learning path is to grasp "what's possible" with Smart CFX,
   then aim to reproduce it with manual effects afterward
```

---

## 7. Practical Techniques

### 7.1 Technique 1: Crossfader Cut (Cut Mix)

The crossfader cut is a fundamental technique for Hip Hop DJs and one of the most popular operations using the crossfader.

```
Basic Concept:
- Switch the sound of two decks quickly in time with the beat
- The feeling of the DJ "playing" the crossfader as an instrument
- Genres: Hip Hop, Breaks, Drum & Bass

Preparation:
- Curve setting: Fast
- Deck A: beat loop playing (drum break is ideal)
- Deck B: another beat loop, acapella, or sound effect
- Both channel faders: 100%

Basic Practice Patterns:

Pattern 1: Quarter note cut (easiest)
Practice with Hip Hop at BPM 90:

  Beat: 1    2    3    4    |  1    2    3    4
  CF:   A    B    A    B    |  A    B    A    B

  Operation: switch crossfader left/right on each beat
  Speed: approx. 1.5 times per second (at BPM 90)

Pattern 2: Eighth note cut
  Beat: 1  & 2  & 3  & 4  & |  1  & 2  & 3  & 4  &
  CF:   A  B A  B A  B A  B |  A  B A  B A  B A  B

  Operation: also add a cut between each beat
  Speed: approx. 3 times per second

Pattern 3: Sixteenth note cut (advanced)
  Beat: 1e&a 2e&a 3e&a 4e&a
  CF:   ABAB ABAB ABAB ABAB

  Operation: extremely high-speed cuts
  Speed: approx. 6 times per second
  → At this level, physical training is required

Common mistakes:
✗ Trying to cut with the curve still on Smooth
  → Sound doesn't cut cleanly, has a blurry feel
✗ Channel fader is down
  → Even with cuts, no sound comes out
✗ Cuts not in rhythm
  → Becomes meaningless noise musically
✗ Too much tension/force
  → Wrists tire and you can't play for long
```

### 7.2 Technique 2: Transform

Transform, said to have been developed by DJ Jazzy Jeff, is one of the most iconic scratch techniques using the crossfader.

```
Basic Concept:
- While moving the record (jog wheel) in one direction,
  chop the sound finely with the crossfader
- Effect of chopping continuous sound into "pa-pa-pa-pa"
- A standard technique at DJ battles

Detailed Operation:

1. Preparation
   - Curve setting: Fast (required)
   - Deck A has scratch sound (a long sound, e.g., "Ahhh")
   - Crossfader on Deck A side (far left)

2. Basic movement
   - Right hand: slowly rotate jog wheel forward
     → "Ahhhhhhhh" long sound plays
   - Left hand: quickly cut the crossfader repeatedly
     → "Ah-Ah-Ah-Ah" — chopped up

3. Timing
   - Jog wheel movement is constant speed, slow
   - Crossfader cuts are in rhythm
   - Practice with different rhythm patterns: quarter notes, eighth notes, triplets, etc.

Variations:

2-Click Transform:
- 2 cuts per jog wheel stroke
- Sound: "Ah-Ah"
- Difficulty: ★★☆☆☆

4-Click Transform:
- 4 cuts per jog wheel stroke
- Sound: "Ah-Ah-Ah-Ah"
- Difficulty: ★★★☆☆

Stab Transform:
- Transform on a short sound (e.g., "Hey!")
- Effect with a staccato feel
- Difficulty: ★★★☆☆

Reverse Transform:
- Opposite of normal: start with fader closed,
  sound plays only at the moment of opening
- A sharper sounding impression
- Difficulty: ★★★★☆

Practice tips:
1. Start at a slow tempo of around BPM 80
2. Without moving the right hand (jog wheel),
   practice the left hand (crossfader) only first
3. Once the left hand can cut in rhythm independently,
   add the right hand jog wheel operation
4. Gradually increase BPM
```

### 7.3 Technique 3: Beat Juggling

Beat juggling is a technique of using two copies of the same track (or beat) and reconstructing the beat with the crossfader.

```
Basic Concept:
- Set the same track (same beat) on two decks
- While switching between two decks with the crossfader,
  create rhythm patterns that don't exist in the original track
- A star technique of turntablism

Preparation:
- Load the same track on Deck A and Deck B
- Start from the same point (or from different sections)
- Curve setting: Fast
- Both channel faders: 100%

Basic Pattern (using a drum break):

Pattern 1: Double-up
Original beat:      KICK  -  SNARE  -  |  KICK  -  SNARE  -
Deck A:             KICK  -  SNARE  -  |  KICK  -  SNARE  -
Deck B:             KICK  -  SNARE  -  |  KICK  -  SNARE  -

Crossfader:         A     A  B      B  |  A     A  B      B

Result:             KICK  -  SNARE  -  |  KICK  -  SNARE  -
(Looks the same, but alternating between two decks)

Pattern 2: Stutter
Original beat:      KICK  -  SNARE  -  |  KICK  -  SNARE  -
Operation: Continuously replay Deck A's KICK

Crossfader:         A  A  A  A  |  A  A  A  A
Deck A rewind:     ↺    ↺    |  ↺    ↺

Result:             KICK KICK KICK KICK | KICK KICK KICK KICK

Pattern 3: Snare roll
Operation: Continuously replay SNARE
Result: SNARE SNARE SNARE SNARE (drum roll effect)

Advanced techniques:
- Phrase juggling: combining different sections
- Melody juggling: reconstructing melodic parts
- Acapella juggling: reconstructing vocal phrases
```

### 7.4 Technique 4: Smart CFX Transition

A modern transition technique using the DDJ-FLX4's Smart CFX.

```
Echo Transition (most versatile):

Preparation:
- Smart CFX: ON
- Effect: Echo
- Deck A: playing
- Deck B: beatmatched
- Crossfader: far left

Procedure:
1. Start 8 bars before the phrase change
2. Slowly move crossfader toward center (over 4 bars)
   → Echo gradually starts to be applied to Deck A
3. Briefly stay at center
   → Both tracks audible + echo applied to Deck A
4. Center to far right (over 4 bars)
   → Echo on Deck A deepens further and fades out
   → Deck B comes clearly to the front
5. Far right reached
   → Only Deck B playing
6. Smart CFX: OFF

Filter Transition:

Preparation:
- Smart CFX: ON
- Effect: Filter
- Same preparation as above

Procedure:
1. Begin slowly moving crossfader from far left
   → Low-pass filter starts to be applied to Deck A
   → High frequencies are gradually cut
2. Near center
   → Deck A has only bass remaining
   → Deck B joins at full range
3. Further right
   → Deck A completely filtered out
   → Only Deck B plays clearly
4. Smart CFX: OFF

Application: combination technique
- Track 1 → Track 2: leave a lingering echo with Echo
- Track 2 → Track 3: with manual EQ mix
- Track 3 → Track 4: add variation with Filter
  → Different transition every time keeps it interesting
```

### 7.5 Technique 5: Fader Riding

A dynamic volume control technique using the crossfader.

```
Basic Concept:
- Subtly swing the crossfader left and right in time with the beat
- Dynamically change the balance of two tracks in real time
- Creates a "wave" effect during the mix

Operation:
- Keep the crossfader near center
- Sway it left and right about 2–3 cm in time with the beat
- Curve: Smooth

Effect:
- Wave effect where two tracks are alternately emphasized
- The feeling of the DJ "playing" the track balance in real time
- Guides the audience's attention from one track to the other

When to use:
- When the elements of two tracks complement each other
- Blending instrumental + acapella
- Combining drum breaks together
```

### 7.6 Technique 6: Drop Switch

A technique of instantly switching between the drops of two tracks, with powerful effect in EDM and Hip Hop live performances.

```
Basic Concept:
- While Deck A is in build-up, cue up the drop section of another track on Deck B
- At the climax of the build-up, cut the crossfader all at once
- Instead of the drop the audience expected, a different track's drop plays
- Surprise effect is very high

Preparation:
- Curve setting: Fast (instant cut required)
- Deck A: playing the build-up section
- Deck B: cue point set just before the drop of another track
- Both channel faders: 100%
- Crossfader: Deck A side (far left)

Procedure:
1. Deck A's build-up is in progress
2. Confirm through headphones the moment Deck B's drop starts
3. Just before Deck A's build-up reaches its peak,
   start Deck B (sometimes started slightly ahead)
4. On the last beat of the build-up, move crossfader all the way to the right
5. Deck B's drop explodes!
6. Audience: "Oh yeah!!!"

Tips for success:
- Always match the BPMs of Deck A and Deck B
- Precisely align the head of the drop timing
  → Even 1 beat off ruins the effect
- Confirm timing through headphones multiple times in advance
- Match Deck B's volume level to Deck A
  → Volume difference sounds unnatural

Applied variations:
- Double drop: put crossfader at center to play both drops simultaneously
- Fake drop: switch to a breakdown instead of the drop,
            betray the audience's expectations then deliver the real drop
- Mashup drop: simultaneously play Deck A's drop + Deck B's acapella
```

### 7.7 Technique 7: Stutter Cut

A technique of adding a stutter effect to a playing track using the crossfader.

```
Basic Concept:
- Chop the sound of one deck using high-speed crossfader cuts
- The other deck is silent (or has another sound)
- Produces a sound similar to a drum machine's gate effect

Operation Procedure:
1. Deck A: playing track
2. Deck B: silent (channel fader down) or beats only
3. Crossfader: Deck A side
4. Curve setting: Fast

5. Rapidly cross the crossfader
   back and forth: A → B → A → B in rhythm
6. Deck A's sound gets "duh-duh-duh-duh" chopped up

Example Rhythm Patterns (at BPM 128):

Pattern A: Eighth note stutter
Beat: 1  &  2  &  3  &  4  &
CF:   A  B  A  B  A  B  A  B
Sound:♪  -  ♪  -  ♪  -  ♪  -

Pattern B: Uneven stutter
Beat: 1  &  2  &  3  &  4  &
CF:   A  A  A  B  A  A  A  B
Sound:♪  ♪  ♪  -  ♪  ♪  ♪  -

Pattern C: Accelerating stutter (for build-up)
Beat: 1     2     3  &  4e&a
CF:   A     A     A  B  ABAB
Sound:♪───  ♪───  ♪  -  ♪-♪-

When to use:
- Build-up before a breakdown
- Creating tension just before a drop
- Accent in DJ performance
- Live remix reconstruction
```

---

## 8. Practice Methods

### 8.1 Preparation and Mindset Before Practice

The right preparation and mindset are important for effective crossfader practice.

```
Physical preparation:

1. Equipment setup
   - Set up the DDJ-FLX4 on a stable surface
   - Ideal height is elbow at right angle (when operating standing)
   - Connect both headphones and speakers
   - Launch Rekordbox and load practice tracks

2. Track selection for practice
   For mix practice:
   - 2 House / Tech House tracks of the same BPM (120–128 BPM)
   - Preferably tracks with long intros/outros (32+ bars)
   - Tracks with a clear beat where the melody doesn't interfere

   For scratch/cut practice:
   - Hip Hop beats at BPM 85–95
   - Drum breaks (Amen Break, Funky Drummer, etc.)
   - Short vocal samples ("Hey!" "Yeah!" "Fresh!" etc.)

3. Prepare to record
   - Record the session using Rekordbox's recording function
   - Review later to find areas for improvement
   - Save as a record of improvement

Mindset:
- Don't aim for perfection from the start → be aware of improving gradually
- 30 minutes to 1 hour per practice session is appropriate → concentration drops if too long
- Secure 3+ practice sessions per week → needed for motor memory to sink in
- Don't fear mistakes → there is much to learn from mistakes
- Having fun is the top priority → if it's not fun, you won't continue
```

### 8.2 Beginner: Basic Crossfader Operation (Week 1–2)

The goal is first to get used to the basic movement of the crossfader.

```
Day 1–3: Get a feel for the crossfader

Practice 1: Slow fade (10 minutes)
- Both channel faders: 100%
- Curve: Smooth
- Load tracks of the same BPM on Deck A and Deck B
- Beatmatch (Sync is OK to use)
- Move crossfader from far left to far right over 32 bars
- Then return from far right to far left over 32 bars
- Repeat 5 times

Goals:
✓ Can move at a constant speed
✓ No stopping or jerking partway
✓ Can sense the volume change by ear

Practice 2: Position hold (10 minutes)
- Stop crossfader at the 25% position → hold 5 seconds
- Stop at 50% (center) → hold 5 seconds
- Stop at the 75% position → hold 5 seconds
- Confirm the sound balance at each position by ear

Goals:
✓ Can stop precisely at any position
✓ Understand the sound balance at each position

Day 4–7: Fade in time with the beat

Practice 3: 4-bar fade (15 minutes)
- 2 tracks at BPM 120
- Move crossfader left → right over 4 bars (approx. 8 seconds)
- Then right → left over the next 4 bars
- Always start from the head of a phrase
- Repeat 10 times

Practice 4: 8-bar fade (15 minutes)
- Same tracks, fade over 8 bars (approx. 16 seconds)
- Focus on even slower and smoother movement
- Combined application: cut the Low EQ on one side while doing this

Day 8–14: Practical crossfader mix

Practice 5: Complete transition (20 minutes)
- Deck A track is playing
- Prepare Deck B and beatmatch
- Start crossfader mix at phrase change
- Complete transition over 16–32 bars
- Load new track on Deck A and repeat

Checklist:
□ Are the beats aligned?
□ Is the volume change natural?
□ Is the transition starting from the head of a phrase?
□ Is there no bass collision?
□ Does the fader reach completely to the end after transition?
```

### 8.3 Intermediate: Cut Mix and Curve Switching (Week 3–6)

Once comfortable with basic operations, move on to cut mixes and using different curve settings.

```
Week 3–4: Basics of cut mixing

Practice 6: Quarter note cut (15 minutes/day)
- Change curve setting: Fast
- Hip Hop beats at BPM 90 × 2
- Switch crossfader left/right on each beat
  Beat: 1   2   3   4   | 1   2   3   4
  CF:   A   B   A   B   | A   B   A   B
- Cut precisely in time with a metronome
- Goal: continue stably for 10 minutes

Practice 7: Eighth note cut (15 minutes/day)
- Same settings at double the speed
  Beat: 1 & 2 & 3 & 4 & | 1 & 2 & 3 & 4 &
  CF:   A B A B A B A B | A B A B A B A B
- Release tension in wrist, control with fingertips
- Note: tensing up makes it impossible to continue for long

Practice 8: Varied rhythm patterns (20 minutes/day)
- Not evenly on every beat, but with rhythm variation
  Pattern A: A A B A | A A B A (3 beats Deck A, 1 beat Deck B)
  Pattern B: A B B A | A B B A (symmetric pattern)
  Pattern C: A B A A | B A B B (irregular pattern)
- Practice each pattern for 2 minutes

Week 5–6: Practical curve switching

Practice 9: Feel the difference between curves (10 minutes)
- Same track, same operation, switch Smooth → Normal → Fast
- Consciously listen to the difference in volume change at each curve
- Pay particular attention to the difference near the center of the fader

Practice 10: Simulate in-set curve switching (20 minutes)
- First 4 tracks: long mix with Smooth curve
- Next 4 tracks: cut mix with Fast curve
- Practice switching curve settings between tracks
- Confirm no missed switching

Note: Curve switching is done in Rekordbox,
      requiring PC operation while playing
      → Confirm shortcuts in advance
```

### 8.4 Advanced: Scratch and Smart CFX Use (Week 7–12)

Once the basics are solid, challenge scratch techniques and Smart CFX utilization.

```
Week 7–8: Baby scratch + crossfader

Practice 11: Chirp scratch (20 minutes/day)
- Curve: Fast
- Load scratch sample on Deck A
- Crossfader on Deck A side
- Push jog wheel forward → crossfader opens
- Pull jog wheel backward → crossfader closes
- Repeat in time with a beat at BPM 80

Steps:
1. First, just click the crossfader without jog wheel practice (5 min)
2. Baby scratch practice with jog wheel only (5 min)
3. Combine both (10 min)

Practice 12: Introduction to transform scratch (20 minutes/day)
- While slowly rotating jog wheel forward
- Cut crossfader 2 times (2-Click Transform)
- Repeat in time with the beat
- Once comfortable, try 3-click and 4-click

Week 9–10: Smart CFX utilization

Practice 13: Echo transition (15 minutes/day)
- Smart CFX: ON, Effect: Echo
- Same procedure as normal crossfader mix
- Confirm that echo depth is linked to fader position
- Try both slow (32 bars) and fast (4 bars)

Practice 14: Trying multiple effects (20 minutes/day)
- Echo → Filter → Wash Out → Noise → Spin Back
- Perform 2 transitions with each effect
- Find your favorite effects
- Record which genres/situations are appropriate for each effect

Week 11–12: Comprehensive practice

Practice 15: 30-minute mini set (30 minutes/day)
- A 30-minute mini set consisting of 8–10 tracks
- Incorporate all of the following:
  □ Long mix with channel faders (minimum 2 times)
  □ Smooth mix with crossfader (minimum 2 times)
  □ Hard cut (minimum 1 time)
  □ Smart CFX transition (minimum 2 times)
  □ Cut mix or scratch element (minimum 1 time)
- Record the set and review later
- Note areas for improvement

Evaluation criteria:
✓ Beats are not drifting
✓ Volume balance is appropriate
✓ Transitions are natural
✓ Each technique is executed as intended
✓ The overall flow feels comfortable
```

### 8.5 Practice Record Template

```
┌─────────────────────────────────────────────┐
│        Crossfader Practice Record            │
├─────────────────────────────────────────────┤
│ Date:        /    /                          │
│ Practice time:    minutes                    │
│ Curve setting: □Smooth  □Normal  □Fast      │
│                                             │
│ Practices performed:                         │
│ □ Slow fade                                  │
│ □ Position hold                              │
│ □ Beat fade (    bars)                       │
│ □ Quarter note cut                           │
│ □ Eighth note cut                            │
│ □ Rhythm pattern                             │
│ □ Chirp scratch                              │
│ □ Transform                                  │
│ □ Smart CFX (Effect:          )              │
│ □ Mini set                                   │
│                                             │
│ What went well:                              │
│                                             │
│ Areas needing improvement:                   │
│                                             │
│ Next session goal:                           │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 9. Maintenance and Care

### 9.1 Daily Maintenance

The crossfader is a physical moving part, and proper maintenance greatly affects its lifespan and performance.

```
Daily Care Checklist:

Before use:
□ Confirm fader moves smoothly
□ No catching or wobbling
□ Confirm full stroke (far left to far right) works
□ Confirm curve setting is correct (Rekordbox)
□ No audio dropout or noise (check by lightly moving)

After use:
□ Return crossfader to center
  → If left tilted to one side for long periods,
     springs may degrade or develop a bias
□ Wipe dust from controller surface
□ Put on dust cover (if available)

Weekly maintenance:
□ Remove dust from fader groove
  → Lightly brush with a soft brush (makeup brush, etc.)
  → Blow away with compressed air
□ Confirm fader movement hasn't become stiff
□ Check for noise during operation (confirm through headphones)

Monthly maintenance:
□ Apply fader cleaner if needed
  → DeoxIT Fader F5 is the standard
  → Use spray type
  → Spray a small amount into the fader gap
  → Move fader from end to end several times to work it in
□ Full cleaning of controller
□ Check cable connections
```

### 9.2 Crossfader Cleaning Method (DDJ-FLX4)

```
DDJ-FLX4 crossfader cleaning:

Note: DDJ-FLX4 crossfader disassembly is not recommended,
      so care focuses on external cleaning

Method 1: Cleaning with compressed air
1. Turn off controller and disconnect from PC
2. Move crossfader to far left
3. Spray compressed air into the gap on the right side of the fader (short burst)
4. Move crossfader to far right
5. Similarly spray into the gap on the left side
6. Traverse fader several times from end to end
7. Finish with compressed air again

Method 2: Cleaning with fader cleaner
1. Power OFF, disconnect PC
2. Use DeoxIT Fader F5 (※ do not use other products)
3. Move fader to far left
4. Spray a very small amount into the right side gap
5. Move fader to far right
6. Spray a very small amount into the left side gap
7. Slowly traverse fader 20–30 times from end to end
8. Wipe up excess cleaner with a tissue
9. Allow to dry for about 30 minutes before use

Things never to do:
✗ Use WD-40 or CRC 5-56 (may dissolve plastic)
✗ Apply water or general cleaners
✗ Forcibly disassemble the fader (warranty becomes void)
✗ Spray a large amount
✗ Clean with power on
```

### 9.3 About Fader Replacement

The DDJ-FLX4's crossfader is a consumable, and replacement may become necessary after long-term use.

```
Signs that replacement is needed:

Early symptoms:
- Noise (crackling, popping) when fader is moved
- Sound cuts out at specific positions
- Fader movement becomes stiff or catching
- Curve settings are not reflected accurately

Mid-stage symptoms:
- Fader biases to one side and doesn't return
- Movement is uneven (some parts smooth, some catching)
- Noise doesn't improve even after cleaning
- Cut lag increases (interferes with scratching)

Late-stage symptoms:
- Fader doesn't move or is very heavy
- Constant noise
- Unstable volume control (unintended volume changes)
- Fader is physically broken

Dealing with the DDJ-FLX4:
- Within manufacturer warranty: contact Pioneer DJ support
- After warranty period:
  → Request repair service (recommended)
  → If replacing yourself, purchase a compatible fader
     ※ Disassembly voids warranty, so at your own risk
- Replacing with InnoFader:
  → Possible if there is an adapter for the DDJ-FLX4
  → Significant performance improvement can be expected
  → Cost: fader unit + adapter = approx. 15,000–25,000 JPY
```

---

## 10. Troubleshooting

### 10.1 Common Issues and Solutions

```
Issue 1: Moving the crossfader doesn't change the sound

Causes and fixes:
A) Curve setting is "Through"
   → Rekordbox: [Preferences] → [Controller] → Crossfader Curve
   → Change to something other than "Through"

B) Channel fader is down on one side
   → Confirm both channel faders are raised

C) Track is loaded on only one deck
   → Confirm tracks are loaded on both decks and playing

D) Crossfader assignment is off
   → Check crossfader assignment in Rekordbox's mixer settings
   → Is it set to Deck A = Left, Deck B = Right?

─────────────────────────────────────────────

Issue 2: Noise when crossfader is moved

Causes and fixes:
A) Fader dirt/wear
   → Clean with compressed air
   → Clean with DeoxIT Fader F5
   → If not improved, replace the fader

B) Connection cable issue
   → Reinsert USB cable
   → Try a different USB port
   → Replace cable

C) Software issue
   → Restart Rekordbox
   → Reinstall drivers
   → Update Rekordbox to the latest version

─────────────────────────────────────────────

Issue 3: Changing curve setting has no effect

Causes and fixes:
A) Setting not reflected
   → Restart Rekordbox and set again
   → Disconnect and reconnect DDJ-FLX4

B) Not changing in the correct settings screen
   → [Preferences] → [Controller] → current controller in use
   → Check "Crossfader" section

C) Firmware is outdated
   → Check Pioneer DJ website for latest firmware
   → Run the update

─────────────────────────────────────────────

Issue 4: Smart CFX not working

Causes and fixes:
A) Smart CFX button is OFF
   → Confirm button is lit
   → Press to light it up

B) Effect not selected in Rekordbox
   → Select Smart CFX effect on performance mode screen

C) Software not compatible
   → Check if Rekordbox version supports Smart CFX
   → Some function limitations with Serato DJ Lite

D) MIDI mapping issue
   → Reset Rekordbox's MIDI settings to default

─────────────────────────────────────────────

Issue 5: Crossfader is physically stiff / catching

Causes and fixes:
A) Accumulation of dust and dirt
   → Perform cleaning (see section 9.2)

B) Sticking from long period without use
   → Slowly traverse end to end multiple times
   → If not improved, use cleaner

C) Physical damage
   → Do not force it
   → Contact repair service

─────────────────────────────────────────────

Issue 6: Hand keeps hitting crossfader during mix

Causes and fixes:
A) If using a style that doesn't use the crossfader
   → Set curve to "Through" in Rekordbox
   → Disable the crossfader
   → Remove the fader cap (if possible)

B) Controller placement issue
   → Adjust position so crossfader is not in the path of hand movement
   → Fine-tune the angle/orientation of the controller
```

### 10.2 Recovery During Performance

```
How to handle crossfader-related issues during a live performance:

Scenario 1: Crossfader stopped moving during a transition
Response:
1. Don't panic (the audience may not have noticed)
2. Cover with channel fader
   → Immediately switch to channel fader operations
3. If possible, change Rekordbox's crossfader setting
   to "Through" at the next break in the set
4. Continue DJing with channel faders only

Scenario 2: Forgot to turn OFF Smart CFX, effects applied to next track
Response:
1. Turn Smart CFX button OFF immediately
2. If effects are still lingering,
   move crossfader completely to the Deck B side, then turn OFF
3. You can also play it off as "intentional" and
   connect it smoothly into the next transition

Scenario 3: Curve setting was different from intended
Response:
1. Use the operations possible with the current setting
   → If wanting to mix on Fast setting: even moving slowly causes sudden changes,
     but use only a small range of fader movement (near center only)
2. Change Rekordbox settings at the next break in the set
3. Develop the habit of always checking before starting a set next time
```

---

## 11. Professional DJ Tips and Advice

### 11.1 Professional Wisdom That Works in the Real World

```
Tip 1: Include crossfader in sound check before a set
- At clubs and event venues, always check crossfader operation during sound check
- Settings may have been changed by another DJ who used the equipment before
- In particular, confirm curve settings and cut lag

Tip 2: Memorize crossfader positions by "feel"
- Become able to sense fader position without looking
- In dark places (clubs), faders may not be visible
- Train yourself to operate the fader with eyes closed during practice

Tip 3: Control with fingertips, not wrists
- Scratch DJs tend to use the whole wrist,
  but controlling with fingertips (thumb and index finger) is more precise
- Also reduces wrist fatigue
- Can withstand long performance sessions

Tip 4: Don't rely too much on the crossfader
- More professional DJs have lower crossfader dependency
- Be able to do the same transition with both channel fader and crossfader
- Always have a backup plan for equipment trouble

Tip 5: Record and objectively evaluate your own play
- Review recorded sets the next day
  → Calm judgment unaffected by on-the-spot adrenaline
- Check transition timing, volume balance, and precision of techniques
- List improvements and apply to the next practice session

Tip 6: Analyze other DJs' sets
- Listen to professional DJ sets on YouTube or Mixcloud
- Identify moments where the crossfader is being used
- Consider what technique is being used and why in that moment
- Find things you can incorporate into your own sets

Tip 7: Try crossfaders on multiple pieces of equipment
- The feel of crossfaders varies greatly by equipment
- Borrow a friend's gear or test at a music store to
  experience the feel of various faders
- Understand the fader stiffness (tension) that suits you

Tip 8: Crossfader tension adjustment
- Some DJ mixers allow adjustment of the crossfader's
  spring tension (stiffness)
- Hardware adjustment is not possible on the DDJ-FLX4
- Higher-end models and standalone mixers may have adjustment screws
- Scratch DJs: prefer light tension (no spring or minimum)
- Mix DJs: prefer moderate tension (appropriate resistance)
```

### 11.2 Genre-by-Genre Crossfader Usage Guide

```
House / Deep House (BPM 118–128):
────────────────────────────────────
Crossfader use: Rare
Recommended curve: Smooth or Through
Main technique: Channel fader + EQ mix
When the crossfader comes out:
- Impressive transitions with Smart CFX (Echo, Filter)
- Layering effect with halfway blend
- Occasional hard cut for track change

Techno / Tech House (BPM 125–135):
────────────────────────────────────
Crossfader use: Rare
Recommended curve: Smooth or Through
Main technique: Long mix + filter
Special note:
- Much mixing with 3+ decks, so crossfader is effectively unusable
- EQ operation is most important

Trance / Progressive (BPM 128–140):
────────────────────────────────────
Crossfader use: Low to medium
Recommended curve: Smooth
Main technique: Ultra-long mix (64–128 bars)
When the crossfader comes out:
- Smart CFX at breakdown (Wash Out)
- Fantastical transition staging

EDM / Big Room (BPM 128–150):
────────────────────────────────────
Crossfader use: Medium
Recommended curve: Smooth to Normal
Main technique: Drop switch, build-up staging
When the crossfader comes out:
- Hard cut at the moment of a drop
- Smart CFX (Noise, Spin Back) for build-up
- Layering during mashups

Hip Hop / R&B (BPM 80–100):
────────────────────────────────────
Crossfader use: High
Recommended curve: Fast
Main technique: Cut mix, scratch
When the crossfader comes out:
- Beat juggling
- Transform scratch
- Beat reconstruction with cuts
- Performance with DJ battle elements

Drum & Bass / Jungle (BPM 160–180):
────────────────────────────────────
Crossfader use: Medium to high
Recommended curve: Normal to Fast
Main technique: Double drop, cut mix
When the crossfader comes out:
- Double drop (play both drops simultaneously)
- Cut mix at high BPM
- Rewind (Reload) performance

Open Format / Wedding / Mobile (variable BPM):
────────────────────────────────────
Crossfader use: Depends on situation
Recommended curve: Smooth (default), Fast for some tracks
Main technique: Use all techniques as needed
Special note:
- Genre changes frequently, so all fader techniques are required
- Style with the most frequent hard cuts
- May also use crossfader in coordination with MC (emcee)
```

---

## 12. Applied Knowledge: Crossfader Assignment and Routing

### 12.1 Concept of Crossfader Assignment

```
What crossfader assignment is:

On DJ mixers and software, you can set which side of the crossfader
each channel is assigned to.

Standard assignment:
- Deck 1 (A) → Left side of crossfader
- Deck 2 (B) → Right side of crossfader

For the DDJ-FLX4:
- Basically fixed assignment (Deck A = left, Deck B = right)
- Can be changed in Rekordbox's mixer settings

Assignment on advanced mixers (DJM-900NXS2, etc.):
Assignment switch for each channel:
- A (left): Assigned to left side of crossfader
- Thru: Not affected by crossfader (always at full output)
- B (right): Assigned to right side of crossfader

Usage example:
On a 4-channel mixer:
- CH1: Thru (main beat loop, always outputs)
- CH2: A (sampler, left side assigned)
- CH3: B (scratch record, right side assigned)
- CH4: Thru (effect return, always outputs)

→ Crossfader switches only CH2 and CH3
  CH1 and CH4 are always outputting
```

### 12.2 Reverse Mode

```
Reverse Mode (Reverse / Hamster Switch):

Concept:
The normal crossfader is left = Deck A, right = Deck B, but in
reverse mode this relationship is inverted.
→ Left = Deck B, Right = Deck A

Why reverse exists:
- To accommodate the dominant hand of scratch DJs
- Right-handed DJ: right hand on jog wheel (Deck A), left hand on crossfader
  → Normal mode is OK (far left opens Deck A, easy for left hand)
- Left-handed DJ: left hand on jog wheel (Deck A), right hand on crossfader
  → Reverse mode may be easier to operate

Origin of "Hamster Switch":
- Named by DJ Q-Bert's crew "Invisibl Skratch Piklz"
- From the image of a hamster running in reverse

Setting on DDJ-FLX4:
- Rekordbox [Preferences] → [Controller] → Crossfader
  → Enable "Reverse" option

Notes:
- Reverse mode requires getting used to
- Recommended to try reverse after mastering normal mode
- When using other people's equipment, check reverse settings
  → Unintended reverse causes confusion
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important. Rather than theory alone, understanding deepens by actually operating the equipment and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before proceeding to the next step.

### Q3: How is this applied in real-world practice?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important in code reviews and architecture design.

---

## Summary

### Core Points of the Crossfader

```
1. Definition and role:
   - Hardware control for switching between two audio sources
   - Importance varies greatly by DJ style

2. Usage by DJ style:
   - Mix DJ: barely used (center-fixed or Through)
   - Scratch DJ: essential (part of the instrument)
   - Hybrid DJ: use according to situation

3. Curve settings:
   - Smooth: for mixing (gradual change)
   - Fast: for scratching (steep change)
   - Through: disables crossfader

4. Smart CFX (DDJ-FLX4):
   - Feature that links effects to crossfader
   - Echo, Filter, Wash Out, etc.
   - OFF during practice, use creatively after mastering fundamentals

5. Practical techniques:
   - Cut mix: fundamental for Hip Hop DJs
   - Transform: star technique in scratching
   - Beat juggling: advanced technique
   - Drop switch: standard EDM staging
   - Smart CFX transition: unique to DDJ-FLX4

6. How to progress in practice:
   - Week 1–2: basic operation (slow fade, position hold)
   - Week 3–6: cut mix, curve switching
   - Week 7–12: scratch, Smart CFX, comprehensive practice

7. Maintenance:
   - Regular cleaning (compressed air, DeoxIT Fader F5)
   - Check for noise and catching
   - Replace fader as needed

8. Most important advice:
   - First master mixing with channel faders
   - Acquire crossfader as an "additional tool"
   - Don't rely on Smart CFX without fundamentals
   - Develop skills that can adapt to any equipment
```

### Recommended Crossfader Settings by DJ Level

```
┌────────────┬──────────────┬─────────────┬──────────────────┐
│ Level      │ Curve setting│ Main use    │ Notes            │
├────────────┼──────────────┼─────────────┼──────────────────┤
│ Beginner   │ Smooth       │ Basic fade  │ Center-fixed OK  │
│ (0–3 mo.)  │ or Through   │             │ Channel FD focus │
├────────────┼──────────────┼─────────────┼──────────────────┤
│ Novice     │ Smooth       │ Smooth mix  │ Also use EQ ops  │
│ (3–6 mo.)  │              │             │                  │
├────────────┼──────────────┼─────────────┼──────────────────┤
│ Intermed.  │ Smooth/Fast  │ Start cut   │ Master curve     │
│ (6–12 mo.) │ alternate    │ mixing      │ switching        │
├────────────┼──────────────┼─────────────┼──────────────────┤
│ Advanced   │ All settings │ Scratch +   │ Know optimal     │
│ (1 yr+)    │ at will      │ all techs   │ setting per gear │
└────────────┴──────────────┴─────────────┴──────────────────┘
```

**Next Step:** [Pitch Control](./pitch-control.md)

---


## What to Read Next

- [Cueing](./cueing.md) - Move on to the next topic

---

## Reference Links

- [Mixing Basics](./mixing-basics.md)
- [EQ Operation](./eq-operation.md)
- [DJ Controllers](../02-equipment/controllers.md)
- Effects Operation
- Introduction to Scratching
