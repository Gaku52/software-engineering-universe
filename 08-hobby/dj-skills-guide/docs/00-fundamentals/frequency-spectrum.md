# Frequency and Spectrum

Learn about audio frequency bands, which form the foundation for EQ operation and mixing. For DJs, understanding frequency is the key to smooth transitions, and for music producers, it is the most important factor affecting mixdown quality.

## What You Will Learn in This Chapter

- Physical fundamentals of frequency and human auditory characteristics
- Detailed classification of frequency bands and characteristics of each band
- Frequency maps and spectrum analysis for each instrument
- Basic EQ concepts and types of filters
- Practical EQ operation techniques for DJs
- Frequency management and mixing in production (DAW)
- Understanding and addressing frequency masking
- Pink noise/white noise and frequency characteristics
- Club acoustic environments and their relationship to frequency
- How to use spectrum analyzers

## Why Frequency Matters

### For DJs

```
Benefits of understanding frequency:

1. Smooth transitions with EQ
   -> Avoid low-end collisions for seamless mixes
   -> Adjust vocal band overlap
   -> Resolve hi-hat clashes in the high end

2. Avoid frequency overlap
   -> Solve masking problems when playing two tracks simultaneously
   -> Separate each track's "space" by frequency
   -> Maintain a clear and powerful mix

3. Adjust for the club's acoustics
   -> Address room resonance frequencies
   -> Understand PA system characteristics
   -> Sense the floor's response at the frequency level

4. Understand genre characteristics
   -> Differences in frequency balance by genre
   -> Techno's low-end focus vs house's balanced approach
   -> Handling the sub-bass in hip hop

5. Judge source quality
   -> Detect frequency gaps in low-quality sources
   -> Judge mastering quality
   -> Quality control for playlist track selection
```

### For Production

```
Benefits of understanding frequency:

1. Frequency separation of instruments
   -> Low-end separation of kick and bass
   -> Mid-range organization of vocals and synths
   -> High-end management of hi-hats and cymbals

2. Mixdown fundamentals
   -> Balance adjustment by frequency band
   -> Grasp the overall spectrum picture
   -> Design EQ curves for each track

3. Foundation for mastering
   -> Overall frequency balance
   -> Comparison with reference tracks
   -> Relationship between loudness and frequency

4. Sound design
   -> Synthesizer filter operation
   -> Understanding harmonic structure
   -> Relationship between resonance and frequency

5. Troubleshooting
   -> Identify and remove unwanted resonances
   -> Remove hum noise (50/60Hz)
   -> Identify feedback frequencies
```

### For Sound Engineers / PA Operators

```
1. System tuning
   -> Measure room acoustic characteristics
   -> Correct with graphic EQ
   -> Set crossover frequencies

2. Feedback control
   -> Identify howling frequencies
   -> Remove with notch filters
   -> Microphone directionality and frequency response

3. Sound check
   -> Optimal frequency balance for each instrument
   -> Monitor mix adjustment
   -> FOH (Front of House) adjustment
```


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Audio Basics](./audio-basics.md)

---

## 1. Physical Fundamentals of Frequency

### What Is Frequency?

A physical quantity that represents the pitch of sound. The unit is **Hz (Hertz)**, indicating the number of vibrations per second.

```
Basic concept:

Frequency (Hz) = Number of vibrations per second

Examples:
100 Hz = An air wave vibrating 100 times per second
440 Hz = Vibrating 440 times per second (A4 = the note A)
1,000 Hz = Vibrating 1,000 times per second

Visual image (1 second):

Low pitch (100 Hz):
  ∿∿∿∿∿  (Slow wave = fewer vibrations)

High pitch (1000 Hz):
  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿  (Fast wave = more vibrations)

Relationship between frequency and wavelength:
Wavelength (m) = Speed of sound (m/s) / Frequency (Hz)
Speed of sound ≈ 343 m/s (in air, at 20°C)

Examples:
  20 Hz    -> 17.15 m (Wavelength larger than a room)
  100 Hz   -> 3.43 m  (About the width of a large speaker's front panel)
  1,000 Hz -> 0.343 m = 34.3 cm
  10,000 Hz -> 0.0343 m = 3.43 cm
  20,000 Hz -> 0.01715 m = 1.72 cm

What this means for DJs:
- Low sounds have long wavelengths -> They bend around walls easily (diffraction)
- High sounds have short wavelengths -> They travel in a straight line
- In clubs, low frequencies fill the entire room while highs are strongest in front of speakers
- Subwoofer placement determines low-end quality
```

### Octaves and Frequency

```
Octave = A relationship where the frequency doubles (or halves)

Example: The note A
A0:   27.5 Hz
A1:   55 Hz
A2:  110 Hz
A3:  220 Hz
A4:  440 Hz  <- Standard tuning
A5:  880 Hz
A6: 1,760 Hz
A7: 3,520 Hz
A8: 7,040 Hz

The human audible range spans about 10 octaves (20Hz ~ 20,000Hz)

Perception of octaves:
- Musically, they feel equally spaced (one cycle of Do Re Mi Fa...)
- However, frequency increases exponentially
- 100Hz -> 200Hz (+100Hz for one octave up)
- 1000Hz -> 2000Hz (+1000Hz for one octave up)
- 10000Hz -> 20000Hz (+10000Hz for one octave up)

Why this matters:
- The width of one octave on an EQ differs by frequency
- A 100Hz span in the low end and a 100Hz span in the high end are completely different
- This is why logarithmic (log) scale displays are used
```

### Human Audible Range

```
Audible range: Approximately 20 Hz ~ 20,000 Hz (20 kHz)

High-frequency decline with age:
- Teens: ~20 kHz (widest)
- 20s: ~18 kHz
- 30s: ~16 kHz (high-end begins to decline)
- 40s: ~14 kHz
- 50s: ~12 kHz
- 60s: ~10 kHz
- 70s: ~8 kHz

Age-related hearing loss (Presbycusis):
- Primarily declines from the high frequencies
- Irreversible change
- Accelerated by noise exposure

Impact on DJs/musicians:
- Prolonged loud exposure in clubs -> Risk of hearing loss
- Strongly recommended to use earplugs (ear protectors)
  - Those with flat frequency response
  - Etymotic Research ER20
  - ACS Custom Earplugs
  - Around 15-20dB attenuation is suitable for DJs
- Regular hearing tests are recommended

Equal-loudness contours (Fletcher-Munson curves / ISO 226):
- Human hearing does not perceive all frequencies equally
- Highest sensitivity around 2-5 kHz
- Lower sensitivity at low and high frequencies
- This tendency is more pronounced at low volumes (low and high frequencies are harder to hear)
- At high volumes, perception becomes relatively flat
- One reason why loud club sound "sounds good"
```

### Equal-Loudness Contours in Detail

```
Equal-loudness contours (phon/sone):

Sound Pressure Level (dB SPL)
  |
90|  \                              /
  |    \                          /
80|      ──────────────────────── 80 phon
  |        \                    /
70|          ──────────────── 60 phon
  |            \            /
60|              ──────── 40 phon
  |                \  /
50|                  ── 20 phon
  |
  └──────────────────────────────-> Frequency (Hz)
   20  100  500  1k  4k  10k  20k

How to read:
- Each curve represents a line of "equal perceived loudness"
- All points on the 40 phon curve
  sound equally loud to humans
- The dB SPL value at 1kHz equals the phon value

What this means for DJs:
1. At low volumes (below 40 phon), low frequencies are harder to hear
   -> Be mindful of volume when monitoring with headphones
   -> Checking a mix at low volume makes the low end seem insufficient

2. The 2-5 kHz range is where hearing is most sensitive
   -> EQ changes in this band feel significant
   -> Explains why vocals and snare attacks stand out

3. Frequency response becomes flatter at higher volumes
   -> Loud club volumes make acoustic sense
   -> The same EQ settings from home may result in excessive low end at a club
```

---

## 2. Frequency Band Classification

In music production and DJing, frequencies are classified as follows.

### Detailed 8-Band Classification

| Band Name | Frequency Range | Characteristics | Primary Instruments | Impact of Excess/Deficit |
|-----------|----------------|-----------------|--------------------|-----------------------|
| **Sub Bass** | 20-60 Hz | Sound you feel, physical pressure | Sub bass, lowest kick frequencies | Excess->muddy, Deficit->thin |
| **Bass** | 60-250 Hz | Foundation of the track, power | Kick, bass | Excess->murky, Deficit->weak |
| **Low Mid** | 250-500 Hz | Warmth, body | Upper bass, guitar, male vocals | Excess->muddy (Mud), Deficit->thin |
| **Mid** | 500 Hz-2 kHz | Core of instruments, clarity | Vocals, guitar, snare | Excess->harsh, Deficit->recessed |
| **High Mid** | 2-4 kHz | Presence, attack | Vocal consonants, snare attack | Excess->fatiguing, Deficit->lacks cut |
| **Presence** | 4-6 kHz | Clarity, forward projection | Vocals, lead synth | Excess->aggressive, Deficit->recessed |
| **Highs** | 6-12 kHz | Brightness, air | Hi-hat, cymbals | Excess->harsh, Deficit->dark |
| **Air** | 12-20 kHz | Space, sparkle | Cymbal tails, reverb | Excess->thin, Deficit->closed |

### 3-Band Classification (DJ-Oriented)

DJ equipment EQs typically use a 3-band configuration.

```
3-Band EQ crossover points:

Pioneer DJM-900NXS2:
  Low / Mid boundary: Approx. 250 Hz
  Mid / High boundary: Approx. 4 kHz

Allen & Heath Xone:96:
  Low / Mid boundary: Approx. 350 Hz
  Mid / High boundary: Approx. 2.5 kHz
  * Varies by model

General 3-band classification:
  Low  : Below ~250 Hz (kick, bass)
  Mid  : 250 Hz ~ 4 kHz (vocals, melody, snare)
  High : Above 4 kHz (hi-hat, cymbals, space)

4-Band EQ (some mixers):
  Low  : ~100 Hz
  Low-Mid: 100 Hz ~ 1 kHz
  High-Mid: 1 kHz ~ 10 kHz
  High : 10 kHz~

Note:
- Crossover frequencies differ by manufacturer/model
- This is one reason why the "same track sounds different" on different mixers
- It's important to understand the frequency characteristics of your own mixer
```

### 5-Band Classification (For Detailed Analysis)

```
Sub Low:   20-80 Hz     Sub bass region
Low:       80-300 Hz    Bass/kick dominant
Mid:       300-2,000 Hz Vocal/melody dominant
High-Mid:  2,000-8,000 Hz  Attack/presence
High:      8,000-20,000 Hz Hi-hat/air

This classification is useful for spectrum analysis and reference comparison
```

---

## 3. Characteristics and Role of Each Band (Detailed)

### Sub Bass (20-60 Hz)

```
Physical characteristics:
- Wavelength: 5.7m ~ 17.1m (very long)
- Almost no directionality (spreads omnidirectionally)
- Easily passes through walls and doors
- Standing waves are prone to occur

Musical characteristics:
- More "felt" by the body than "heard" by the ears
- Effective with large club speakers/subwoofers
- Difficult to reproduce with headphones (especially in-ear types)
- Gives the track physical impact

Instruments/sources:
- 808 kick (Trap/Hip Hop ultra-low kick)
- Sub bass (synthesizer)
- Lowest frequency component of kick drums
- Lowest open string note of bass guitar (approx. 41Hz = E1)
- Lowest register of pipe organ

DJ tips:
- Phase interference when two sub bass lines play simultaneously
- Mono playback is standard (stereo causes phase issues)
- Use a high-pass filter (HPF) to cut unnecessary sub bass
- Understand the characteristics of the club's subwoofer

Production tips:
- Frequencies below 30Hz are often intentionally cut
- DC offset removal
- Sidechain compression to separate kick and bass
- Check mono compatibility (stereo sub bass is risky)

Standing wave issues:
- Resonance at frequencies corresponding to room dimensions
- Sound becomes louder/quieter at specific positions
- Formula: f = 343 / (2 x L)
  Example: 5m room -> Resonance at 34.3Hz
- Solutions: Bass traps, adjusting listening position
```

### Bass (60-250 Hz)

```
Physical characteristics:
- Wavelength: 1.4m ~ 5.7m
- Somewhat directional
- Significantly affected by room acoustics
- Front-loaded speakers are effective

Musical characteristics:
- Power and foundation of the track
- Core band for kick drums and basslines
- The most important band in dance music
- The source of groove

Instruments/sources and typical frequencies:
- Kick drum: 60-100 Hz (body)
- Bassline: 60-200 Hz (fundamental)
- Male vocals: 80-180 Hz (lowest fundamental)
- Piano left hand: 80-250 Hz
- Cello: 65-250 Hz
- Guitar (low strings): 80-250 Hz

DJ usage:
- The most important EQ operation during transitions
- Don't play two kicks/basses simultaneously
- Use Low EQ to swap (exchange)
- "Bass swap" is a fundamental DJ technique

Bass swap procedure:
1. Check Track B on headphones
2. Cut Track B's Low EQ completely (-inf or minimum)
3. Bring up the channel fader to start playing Track B
4. Quickly on the beat:
   Lower Track A's Low <-> Raise Track B's Low
5. A "kill switch" approach (instant swap) is effective

Production tips:
- The band where kick and bass frequency collision is most problematic
- Sidechain compression: Compress the bass at the moment the kick hits
- Frequency separation: Kick centered at 60-100Hz, Bass centered at 80-200Hz
- Low cut: Cut unnecessary ultra-low frequencies (HPF @ 30-40Hz)
```

### Low Mid (250-500 Hz)

```
Physical characteristics:
- Wavelength: 0.69m ~ 1.37m
- Room reverb tends to accumulate
- Affected by distance between speakers and walls

Musical characteristics:
- The band that provides warmth and body
- Upper harmonics of bass
- Body of the guitar
- Chest voice of male vocals

A problem-prone band ("Mud"):
- Energy from many instruments concentrates here
- Excessive accumulation results in a "muffled" or "hazy" sound
- The band most often cut during mixing
- "Cleaning up 250-500Hz" is a mixing fundamental

DJ usage:
- Affects the lower part of the Mid EQ
- Easily boosted by club wall reflections
- Safer to keep slightly conservative
- Two tracks' low-mids overlapping causes significant muddiness

Production solutions:
- Check the Low-Mid of each track
- Cut a few dB at 250-500Hz on unnecessary tracks
- Utilize high-pass filters (HPF @ 80-150Hz for everything except bass/kick)
- EQ curve examples:
  Guitar: -3dB @ 300Hz (Q=1.0)
  Vocals: -2dB @ 350Hz (Q=0.8)
  Pad: -4dB @ 250Hz (Q=1.2)
```

### Mid (500 Hz - 2 kHz)

```
Physical characteristics:
- Wavelength: 17cm ~ 69cm
- Lower part of the band where human ears are most sensitive
- Speaker reproduction accuracy is important

Musical characteristics:
- Core band of vocals (especially 800Hz-2kHz)
- The "core" and "substance" of instruments
- Directly related to melody recognition
- Close to the telephone band (300Hz-3.4kHz)

Instruments/sources and typical frequencies:
- Female vocal fundamentals: 250-1,000 Hz
- Male vocal fundamentals: 100-500 Hz
- Guitar center: 500-2,000 Hz
- Snare drum: 500-1,000 Hz (body)
- Piano center: 500-4,000 Hz
- Synth lead: Genre-dependent

DJ usage:
- Important for transitions with vocal tracks
- Manage vocal overlap with the Mid EQ
- Decide which track's melody to feature
- Cutting aggressively during instrumental sections is generally fine

Vocal transition techniques:
1. Confirm when Track A's vocals end
2. Bring up Track B's fader before its vocals start
3. If they overlap: Lower Track A's Mid
4. Vocal overlap is the most unpleasant type of collision
5. Key matching is also important (to avoid dissonance)

Production tips:
- The band where instruments "compete" the most
- Each instrument needs its own "seat"
- Organize using panning and EQ together
- Boosting around 1kHz tends to create a "nasal" sound
- Subtractive EQ (cutting unwanted bands) is fundamental
```

### High Mid (2-4 kHz)

```
Physical characteristics:
- Wavelength: 8.6cm ~ 17.2cm
- The band where human ears are most sensitive
- Close to the ear canal resonance frequency (approx. 2.7kHz)

Musical characteristics:
- Determines the "presence" and "definition" of instruments
- The core of attack sounds
- The "punch" of the snare
- Clarity of vocal "consonants"

Why this band is important for human hearing:
- The core frequency band of a baby's cry
- The band humans are evolutionarily most attuned to
- Recognition of speech consonants (S, T sounds, etc.)
- Many danger-alerting sounds fall in this band

DJ usage:
- Affects the lower part of the High EQ
- Percussion attack adjustment
- Managing when two snares overlap
- Control the "closeness" of a track by adjusting presence

Production tips:
- The most delicate band
- Excessive boost -> Fatiguing, listening fatigue
- Excessive cut -> Lacks presence, sounds recessed
- De-esser processing for vocals (sibilance control)
- In mastering, handling this band determines quality
```

### Presence (4-6 kHz)

```
Musical characteristics:
- Determines vocal clarity
- Creates the sensation of "coming forward" or "receding"
- Presence of lead synthesizers
- Picking nuances of acoustic guitar

Instruments/sources:
- Vocal consonant clarity
- Acoustic guitar attack
- Bowing nuances of strings
- Fundamental portion of cymbals
- Piano attack

DJ usage:
- Adjusted indirectly via the High EQ
- Managing presence in vocal tracks
- Boosting makes the track "come forward"
- Cutting makes it "recede"

Production solutions:
- Lead vocals: Slight boost (+1-2dB) to bring forward
- Backing: Slight cut (-1-2dB) to push back
- Sibilance issues concentrate in this band
- De-esser operating range: 4-8kHz is typical
```

### Highs (6-12 kHz)

```
Physical characteristics:
- Wavelength: 2.9cm ~ 5.7cm
- Highly directional
- Handled by the speaker's tweeter
- Attenuates with distance due to air absorption

Musical characteristics:
- Core band for hi-hats and cymbals
- Brightness and brilliance
- String harmonics
- High-frequency synth harmonics

Instruments/sources and typical frequencies:
- Closed hi-hat: 6-10 kHz
- Open hi-hat: 5-12 kHz
- Ride cymbal: 3-12 kHz
- Crash cymbal: 5-15 kHz
- Acoustic guitar highs: 6-12 kHz
- String harmonics: 5-12 kHz

DJ usage:
- The band frequently adjusted with the High EQ
- Cut when two hi-hats overlap
- Cut one track's highs during transitions
- Bring highs back on the drop after a break for dramatic effect

"Hi-hat swap" technique:
1. Identify Track A's hi-hat pattern
2. Lower Track B's High EQ slightly and start playback
3. Swap on the beat:
   Lower Track A's High -> Raise Track B's High
4. Doing this simultaneously with a low-end swap creates a smooth transition

Production tips:
- Sibilance issues
- Use de-essers (6-10kHz band)
- Separating hi-hats and cymbals
- Adding air: Shelf EQ @ 8-10kHz with +1-2dB
```

### Air (12-20 kHz)

```
Physical characteristics:
- Wavelength: 1.7cm ~ 2.9cm
- Extremely directional
- Easily attenuated by distance and cables
- A band many people lose with age

Musical characteristics:
- Sense of space, airiness
- Reverb tails
- Cymbal sustain
- Overall "openness"

DJ usage:
- Direct adjustment is rarely needed
- Indirectly affected by High EQ boosts
- The band where source quality differences are most apparent
- This band is virtually absent in MP3 128kbps

Production applications:
- Air EQ: Shelf +1-3dB @ 12-16kHz
- Reverb high cut: Cut at 12-16kHz (for a natural sound)
- Adding "openness" during mastering
- Caution: Over-boosting creates a "sizzly/brittle" sound
- Close to the Nyquist frequency (22.05kHz @ 44.1kHz SR)
```

---

## 4. Instrument Frequency Map (Detailed)

### Kick Drum

```
Frequency band map:

20Hz ─────── 60Hz ─────── 200Hz ─────── 1kHz ─────── 5kHz ─────── 20kHz
│   Sub     │    Body    │   Boxiness  │  Attack   │   Click   │
│  40-60Hz  │  60-100Hz  │  200-400Hz  │  2-5kHz   │  5-8kHz   │
│ Physical  │  Fatness/  │  Cardboard  │  Attack   │  Click    │
│ pressure  │  punch     │  feel       │           │  sound    │

Kick characteristics by genre:
┌─────────────┬──────────────────────────────────────┐
│ House       │ Peak at 80-120Hz, moderate attack     │
│ Tech House  │ Centered at 100Hz, tight attack       │
│ Techno      │ 50-80Hz emphasis, deep low end        │
│ Trance      │ 60-100Hz, punchy attack               │
│ Drum & Bass │ 80-150Hz, very tight                  │
│ Trap/Hip Hop│ 808: 40-60Hz ultra-low, long tail     │
│ Dubstep     │ 50-80Hz, massive sub                  │
└─────────────┴──────────────────────────────────────┘

EQ processing guidelines:
- HPF @ 30Hz (DC offset removal)
- Body (60-100Hz): Adjust kick fatness
- Boxiness (200-400Hz): Cut -2~4dB for tightness
- Attack (2-5kHz): Boost to emphasize attack
- Click (5-8kHz): Slight boost to add click
```

### Bassline (Bass)

```
Frequency band map:

20Hz ─────── 80Hz ─────── 200Hz ─────── 500Hz ─────── 3kHz ─────── 20kHz
│   Sub     │ Fundamental │  Harmonics  │   Upper    │ Presence  │
│  40-80Hz  │  80-200Hz   │  200-500Hz  │  500Hz-1kHz │  1-3kHz  │
│ Sub low   │ Pitch core  │ Harmonics/  │  Mid range │  Attack   │
│           │             │ body        │            │           │

Bass types and frequency characteristics:
- Synth bass (Sub Bass): Centered at 40-80Hz, sine wave-like
- Synth bass (Reese): 60-200Hz, rich harmonics
- Electric bass: 40-250Hz fundamental, timbre varies with harmonics
- Acoustic bass: 40-200Hz fundamental, body resonance

Kick and bass frequency separation:

Method 1: Frequency separation
  Kick: Peak at 60-80Hz
  Bass: Peak at 80-120Hz
  -> Ensure their fundamentals don't overlap

Method 2: Sidechain compression
  Use the kick signal to compress the bass
  -> Bass ducks only at the moment the kick hits
  -> A classic techno/house technique

Method 3: Ducking (volume automation)
  Lower bass volume at kick timing
  -> Allows more precise control

Method 4: Multiband sidechain
  Apply sidechain processing only to the low end
  -> Bass mid-highs remain unaffected
```

### Snare Drum

```
Frequency band map:

100Hz ─────── 300Hz ─────── 800Hz ─────── 3kHz ─────── 10kHz ─────── 20kHz
│    Body   │    Tone    │   Punch    │   Crack   │   Snap    │
│ 150-250Hz │ 400-800Hz  │  1-3kHz    │  3-5kHz   │  6-10kHz  │
│  Fatness  │ Snare tone │  Punch     │  Attack   │  Snappy   │

Snare characteristics by genre:
- House: Short, tight body, clean attack
- Techno: With reverb, dark, industrial
- Hip Hop: 808 clap, layered, fat
- Drum & Bass: Sharp, tight, high-end emphasis
- Rock: Full range, fat and punchy
- Jazz: Brush, delicate, wide dynamics

EQ processing guidelines:
- HPF @ 80-100Hz (cut unnecessary low end)
- Body (150-250Hz): Adjust fatness
- Boxiness (300-500Hz): Cut -2~3dB
- Crack (3-5kHz): Boost to emphasize attack
- Snap (6-10kHz): Boost to emphasize snappy character
```

### Hi-Hat

```
Frequency band map:

200Hz ─────── 1kHz ─────── 5kHz ─────── 10kHz ─────── 20kHz
│   Body    │   Ring    │    Tone    │   Sizzle  │   Air    │
│ 200-500Hz │  1-3kHz   │   3-8kHz   │  8-15kHz  │ 15-20kHz │
│ Body(min) │   Ring    │ Hi-hat core│  Sizzle   │   Air    │

Characteristics by type:
- Closed HH: Centered at 6-10kHz, short
- Open HH: 5-12kHz, sustained
- Pedal HH: 6-8kHz, tightest
- Ride cymbal: 3-12kHz, bell section is 1-4kHz

EQ processing guidelines:
- HPF @ 200-500Hz (firmly cut the low end)
- Ring (1-3kHz): Cut if unnecessary
- Tone (3-8kHz): Main hi-hat band
- Sizzle (8-15kHz): Adjust sizzly character
- Interference with other instruments: Separate from vocals and synths

DJ tips:
- Two overlapping hi-hat patterns become very noisy
- Cut one with the High EQ
- Pay special attention to overlapping open hi-hats
```

### Vocals

```
Frequency band map:

80Hz ──── 250Hz ──── 500Hz ──── 2kHz ──── 5kHz ──── 8kHz ──── 20kHz
│ Rumble │ Warmth  │  Body   │ Clarity │Presence│Sibilance│ Air │
│ 80-150 │ 150-300 │ 300-800 │ 1-3kHz  │ 3-6kHz │ 6-10kHz │12-16│
│Vibration│ Warmth │  Body   │ Clarity │Presence│Sibilance│Space│

Male vocals:
- Fundamental: 85-260 Hz (E2-C4)
- Main band: 100Hz-4kHz
- Warmth: 150-300Hz
- Clarity: 1.5-3kHz

Female vocals:
- Fundamental: 165-520 Hz (E3-C5)
- Main band: 200Hz-6kHz
- Warmth: 200-400Hz
- Clarity: 2-5kHz
- Sibilance: 5-9kHz (more prominent)

Vocal processing chain (for production):
1. HPF @ 80-120Hz (cut unnecessary low end)
2. Cut problem bands (200-400Hz mud treatment)
3. Clarity boost (2-4kHz, +1-3dB)
4. Presence boost (4-6kHz, +1-2dB)
5. De-esser (5-9kHz)
6. Air shelf (12kHz+, +1-2dB)

DJ tips:
- Overlapping vocals are the most unpleasant
- Different keys overlapping causes dissonance
- Manage the vocal band with Mid EQ
- Avoid vocal sections during transitions
```

### Synthesizer

```
Synth types and frequency characteristics:

Sub bass synth:
  30-80Hz: Nearly pure tone (sine wave)
  Almost no harmonics
  Mono recommended

Bass synth (Saw/Square):
  60-250Hz: Fundamental
  250Hz-4kHz: Rich harmonics
  Timbre changes with filter cutoff position

Pad/String:
  200Hz-8kHz: Wide band
  Balance between warmth (200-500Hz) and brightness (4-8kHz)
  Spreads in stereo

Lead synth:
  300Hz-8kHz: Mid-range focused
  Presence (3-6kHz) is important
  Pitch changes with portamento

Arpeggio/Pluck:
  200Hz-12kHz: Transient-focused
  Attack (2-5kHz) is characteristic
  Band changes with release length

FX sounds (risers, sweeps, etc.):
  Can use the full frequency range
  Band changes dynamically
  Filter sweeps are the primary technique
```

---

## 5. Basic EQ Concepts

### Types of EQ

**Parametric EQ:**
```
Parameters:
1. Frequency: The center frequency to operate on
2. Gain: Amount of boost/cut (dB)
3. Q (Quality Factor): Bandwidth
   - Q = Center frequency / Bandwidth
   - Higher Q = Narrower bandwidth (pinpoint)
   - Lower Q = Wider bandwidth (gentle)

Q value guidelines:
  Q = 0.5: Very wide (approx. 2.5 octaves)
  Q = 1.0: Wide (approx. 1.4 octaves)
  Q = 2.0: Medium (approx. 0.7 octaves)
  Q = 4.0: Narrow (approx. 0.35 octaves)
  Q = 8.0: Very narrow (approx. 0.17 octaves)
  Q = 20+: Notch filter-like

Usage:
  Wide Q (0.5-1.5): Overall tonal adjustment
  Medium (1.5-4): Separating instruments
  Narrow Q (4-10): Pinpoint removal of problem frequencies
  Very narrow (10+): Feedback removal, notch processing
```

**Graphic EQ:**
```
Characteristics:
- Fixed frequency bands (e.g., 31 bands)
- Only gain per band is adjustable
- Widely used in PA systems
- Visually intuitive

Common band counts:
  5-band: Simple adjustment
  10-band: Basic correction
  15-band: 2/3 octave
  31-band: 1/3 octave (PA standard)

PA usage:
1. Measure room characteristics with a measurement microphone
2. Identify peaks/dips
3. Correct with graphic EQ
4. Approach a flat response
```

**Shelving EQ:**
```
Characteristics:
- Raises/lowers everything above/below a certain frequency
- High shelf: Adjusts frequencies above the specified point
- Low shelf: Adjusts frequencies below the specified point

Usage examples:
  High shelf +2dB @ 8kHz:
  -> Boosts everything above 8kHz by +2dB overall
  -> Adds brightness/air

  Low shelf -3dB @ 200Hz:
  -> Cuts everything below 200Hz by -3dB overall
  -> Bass control, tidying the low end

DJ mixer EQ:
  Low: Low shelf (~250Hz and below)
  High: High shelf (4kHz and above)
  * Some have "Kill" EQ (complete cut)
```

**Filters:**
```
Types:
1. High-pass filter (HPF / Low cut)
   - Cuts frequencies below the specified point
   - "Doesn't pass the low end"
   - Used to remove unnecessary low frequencies

2. Low-pass filter (LPF / High cut)
   - Cuts frequencies above the specified point
   - "Doesn't pass the high end"
   - Used as a DJ effect (filter sweep)

3. Band-pass filter (BPF)
   - Passes only a specific band
   - Cuts above and below
   - Creates a radio voice-like effect

4. Notch filter (Band Reject)
   - Cuts only a specific frequency
   - Very narrow Q
   - Removes hum/resonance

Slope:
  6 dB/oct (1st order): Gentle
  12 dB/oct (2nd order): Common
  18 dB/oct (3rd order): Somewhat steep
  24 dB/oct (4th order): Steep
  48 dB/oct: Very steep (digital EQ)

Filter sweep (DJ technique):
1. Start with LPF cutoff at 20kHz
2. Gradually lower the cutoff
3. High frequencies disappear progressively
4. Build-up effect at the lowest point
5. Suddenly raise the cutoff on the drop
6. -> A sense of energy release
```

### Fundamental Principles of EQ Operation

```
Principle 1: Subtractive EQ is fundamental
  X Boost (raise) -> Phase distortion, noise increase, headroom consumed
  O Cut (lower) -> Clean, natural, headroom preserved

  "If something feels lacking, try lowering other things"
  Example: Can't hear vocals -> Instead of raising vocals,
      lower the same band in competing instruments

Principle 2: Adjust gradually
  X +6dB boost all at once
  O Adjust +1-2dB at a time and check

  Human ears are sensitive to sudden changes,
  but less aware of gradual changes
  -> A/B testing (EQ ON/OFF comparison) is important

Principle 3: Judge within the full mix
  X Perfect it in solo
  O Judge within the context of the full mix

  Even if it sounds great in solo, it may get buried or stick out in the mix
  -> Always judge within context

Principle 4: Identify the problem before making adjustments
  X "Boost the highs just because"
  O "Cut the resonance around 3.5kHz"

  Procedure:
  1. Identify the problem by ear
  2. Sweep with a narrow Q boost
  3. Identify the problem frequency
  4. Remove with a cut

Principle 5: Utilize HPF (high-pass filter)
  Apply HPF to all tracks except bass and kick
  By cutting unnecessary low end:
  - Headroom is preserved
  - Low-end clarity improves
  - Masking is reduced

  Recommended cutoff frequencies:
  - Vocals: 80-120Hz
  - Guitar: 80-150Hz
  - Piano: 60-100Hz
  - Hi-hat: 200-500Hz
  - Synth lead: 100-200Hz
  - Pad: 100-200Hz
```

---

## 6. Practical EQ Usage for DJs

### EQ Operation During Transitions

```
Basic EQ mix workflow:

[Preparation stage]
1. Check Track B's cue (headphones)
2. Match the BPM
3. Check the beat grid
4. Understand Track B's characteristics (amount of low end, presence of vocals, etc.)

[Execution stage]
Step 1: Low-end management (most important)
  1. Cut Track B's Low EQ completely (-inf or minimum position)
  2. Bring up the channel fader
  3. Gradually restore Track B's Low EQ while
  4. Lowering Track A's Low
  5. Find the "bass swap" point
     -> Usually at the start of a 4-bar or 8-bar phrase

Step 2: High-end adjustment
  1. Listen for hi-hat overlap
  2. If they overlap and sound "noisy":
     Lower Track B's High slightly (-2~4dB)
  3. Restore the High before pulling out Track A
  4. Watch for cymbal crash timing

Step 3: Mid-range cleanup
  1. Check for vocal or melody overlap
  2. If dissonant: Cut one with Mid EQ
  3. Make one track the main focus
  4. Finally fade out Track A with the fader
```

### DJ Mixer EQ Types

```
Isolator EQ (Pioneer DJM series):
  - Can completely cut each band (-inf)
  - "Kill" switch-like usage
  - Also capable of about +6dB boost
  - Ideal for low-end swaps during transitions

  DJM-900NXS2 EQ characteristics:
  Low: -inf ~ +6dB (below 250Hz)
  Mid: -inf ~ +6dB (250Hz-4kHz)
  High: -inf ~ +6dB (above 4kHz)

Traditional EQ (Allen & Heath, etc.):
  - Shelving/peaking design
  - May have limited cut range
  - More musical changes
  - Often rotary knob type

  Xone:96 EQ characteristics:
  Low: +/-15dB (below 350Hz)
  Mid: +/-15dB (350Hz-2.5kHz)
  High: +/-15dB (above 2.5kHz)
  + Variable high-pass/low-pass filters

Filter-equipped EQ:
  - HPF/LPF sweep function
  - Adjustable resonance
  - Used as DJ effects
  - Expands transition variations
```

### Genre-Specific EQ Setting Guide

```
House / Deep House:
  Low  : Keep solid (groove of kick + bass is prioritized)
  Mid  : Slightly restrained (keep warmth while staying clean)
  High : Bright (hi-hat groove)

  Transitions:
  - Execute bass swaps reliably
  - Mid management is important for vocal house
  - Filter sweeps are also effective

Tech House:
  Low  : Tight (emphasis on punch)
  Mid  : Keep groove elements
  High : Bring out percussion

  Transitions:
  - Use loops to swap Low/High gradually
  - Watch for overlapping percussion patterns

Techno:
  Low  : Emphasis on pressure (sub bass presence)
  Mid  : Cut for darkness (minimal impression)
  High : Subdued (maintain a dark atmosphere)

  Transitions:
  - Longer transitions (32 bars or more)
  - Gradual low-end swap
  - Filter sweeps for build-ups

Melodic Techno / Progressive:
  Low  : Focus on balance
  Mid  : Feature the melody
  High : Maintain spaciousness

  Transitions:
  - Key matching of melodies is important
  - Utilize break sections
  - Use reverb/delay to your advantage

Drum & Bass:
  Low  : Balance between kick and sub bass
  Mid  : Manage mid-range bass
  High : Clarity of drum patterns

  Transitions:
  - Fast operation due to high-speed beats (170BPM+)
  - EQ management is crucial during double drops
  - Pay special attention to bass swaps

Hip Hop / R&B:
  Low  : Very important (808 bass pressure)
  Mid  : Vocal-focused
  High : Subdued

  Transitions:
  - Absolutely avoid vocal collisions
  - Overlapping 808 low end causes breakdown
  - Switching during breaks is safest

Trance:
  Low  : Powerful
  Mid  : Balance between melody and pads
  High : Bright and energetic

  Transitions:
  - Utilize breakdowns
  - Key matching is essential
  - Operate EQ gradually during long build-ups
```

---

## 7. Understanding Frequency Masking

### What Is Masking?

```
Definition:
A phenomenon where the presence of one sound makes another sound harder to hear

Types:
1. Simultaneous Masking
   - Two sounds occurring at the same time
   - The louder sound hides the quieter one
   - Stronger masking occurs between closer frequencies

2. Temporal Masking
   - Forward masking: A quiet sound just before a loud sound
   - Backward masking: A quiet sound just after a loud sound
   - Backward masking lasts longer

3. Frequency Masking
   - Occurs between sounds with close frequencies
   - Multiple instruments in the same band cause "muddiness"
   - The biggest enemy of mixing

Masking issues for DJs:
- Two kicks/basses overlapping -> Low-end masking
- Two vocals overlapping -> Mid-range masking
- Two hi-hats overlapping -> High-end masking
-> Solving these with EQ operation is the DJ's skill
```

### Practical Masking Solutions

```
For DJs:

1. Low-end masking solutions:
   - Bass swap (completely cut one track's Low)
   - Manage with EQ, not faders
   - Principle: Never play two low ends simultaneously

2. Mid-range masking solutions:
   - Avoid overlapping vocal sections
   - Lower one with Mid EQ
   - Use instrumental parts for transitions

3. High-end masking solutions:
   - Manage hi-hat overlap with High EQ
   - Watch cymbal timing
   - Slightly cut one track's High

For Production:

1. Frequency separation:
   Assign a "primary band" to each instrument,
   and have other instruments avoid that band

   Example:
   Kick: 60-100Hz (primary), 2-5kHz (attack)
   Bass: 80-200Hz (primary)
   Snare: 150-250Hz + 2-5kHz
   Vocals: 1-5kHz (primary)
   Guitar: 500Hz-2kHz
   Hi-hat: 6-12kHz
   Pad: 200-800Hz + 4-8kHz

2. Sidechain EQ (Dynamic EQ):
   - Dynamically apply EQ based on the level of the masking instrument
   - Example: Cut synth's 1-5kHz only when vocals are playing
   - FabFilter Pro-Q, Wavesfactory Trackspacer

3. Mid/Side processing:
   - Process Mid (center) and Side (left/right) separately
   - Concentrate kick/bass in Mid
   - Spread guitar/synth to Side
   - Manage stereo width per frequency band

4. Panning:
   - Separate by left/right placement
   - Kick, bass, vocals: Center
   - Guitar, synth, percussion: Pan left/right
   - Combination of panning and EQ for maximum separation
```

---

## 8. Spectrum Analysis

### How to Read a Spectrogram

```
Spectrogram:
- X-axis: Time
- Y-axis: Frequency
- Color/brightness: Volume (energy)

Spectrum Analyzer:
- X-axis: Frequency
- Y-axis: Volume (dB)
- Real-time display

Reading basics:
1. Peak positions -> Bands where the track's energy is concentrated
2. Dip positions -> Bands with less energy
3. Overall slope -> The "color" of the music
   - Sloping down to the right: Low-end focused (dark)
   - Flat: Balanced
   - Sloping up to the right: High-end focused (bright) * Rare

Spectrum characteristics by genre:

House:
  ┃█████████
  ┃██████████
  ┃████████
  ┃██████
  ┃█████
  ┃████
  ┃███
  ┃██
  └──────────-> 20Hz -> 20kHz
  -> Relatively balanced, sloping down to the right

Techno:
  ┃████████████
  ┃██████████████
  ┃████████
  ┃████
  ┃███
  ┃██
  ┃█
  ┃
  └──────────-> 20Hz -> 20kHz
  -> Large energy in the low end, subdued highs

Trance:
  ┃██████████
  ┃██████████
  ┃█████████
  ┃████████
  ┃██████
  ┃█████
  ┃████
  ┃███
  └──────────-> 20Hz -> 20kHz
  -> Full range, solid highs as well
```

### Checking Frequency in Rekordbox

```
Waveform display and spectrum:

1. Waveform color mode:
   - RGB display: Low=red, Mid=green, High=blue
   - Frequency band balance visible at a glance
   - Sections with more red = strong kick/bass
   - Sections with more blue = strong hi-hat/cymbals

2. Detailed waveform (Waveform Zoom):
   - Zoom display to check transients
   - Kick positions shown as red vertical lines
   - Visually confirm break positions

3. Spectrum analyzer:
   - Available in Performance mode
   - Real-time frequency distribution
   - Visually confirm the effect of EQ operations

EQ preset usage:

1. Check EQ curves in Preferences > Controller
2. Adjust performance EQ
3. Common setting patterns:
   - Flat (default)
   - Low boost (low end +2dB)
   - Bright (high end +2dB)
   - Dark (high end -3dB)
```

### Checking Frequency in Ableton Live

```
Spectrum device:

Settings:
1. Drag Audio Effects > Spectrum onto a track
2. Block Size: 4096 (frequency resolution priority) or 1024 (time resolution priority)
3. Channel: L+R / L / R / Mid / Side
4. Refresh Rate: Normal / Fast
5. Range: dB range to display

Applications:
- Place on the master track -> Check overall balance
- Place on individual tracks -> Check each instrument's band
- Compare with reference tracks -> Analyze differences from professional mixes

EQ Eight:

Features:
1. 8-band parametric EQ
2. Select the type for each band:
   - Low Cut (12/24/48 dB/oct)
   - Low Shelf
   - Bell
   - Notch
   - High Shelf
   - High Cut (12/24/48 dB/oct)
3. Real-time spectrum display
4. Oversampling function
5. Mid/Side mode support

Usage:
1. Check frequency with the Audible Range analyzer
2. Band 1: Low Cut @ 30-40Hz (DC removal)
3. Bands 2-7: Cut problem bands / boost as needed
4. Band 8: High Shelf for air adjustment

Third-party plugins:

FabFilter Pro-Q 3:
- Industry-standard parametric EQ
- Up to 24 bands
- Dynamic EQ function
- Mid/Side processing
- Linear phase mode
- Excellent spectrum display

iZotope Insight:
- Comprehensive metering plugin
- Spectrogram display
- Loudness meter (LUFS)
- Stereo width display
- Real-time frequency distribution analysis

Voxengo SPAN (Free):
- High-quality spectrum analyzer
- Multi-channel support
- Customizable display
- Low CPU load
```

---

## 9. Pink Noise and White Noise

### White Noise

```
Definition:
- Noise with equal energy across all frequencies
- Constant power per 1Hz bandwidth
- Flat frequency spectrum

Auditory characteristics:
- A bright "hissing" sound
- Similar to TV static
- Highs are prominent (due to auditory characteristics)

Applications:
- Sound design (FX risers, etc.)
- Synthesizer noise oscillator
- Noise component of snare drums
- Hi-hat material
```

### Pink Noise

```
Definition:
- Noise with equal energy per octave
- -3dB for every doubling of frequency
- Also called 1/f noise

Auditory characteristics:
- A relatively balanced "rushing" sound
- Close to many sounds in nature
- Close to human auditory characteristics

Applications:
* Speaker calibration
  1. Play pink noise through speakers
  2. Measure frequency response with a measurement microphone
  3. Correct with EQ
  -> Build a flat listening environment

* Mixing reference
  1. Use pink noise as a reference
  2. Match each track's level to the pink noise
  3. A starting point for a balanced mix

* Hearing test
  1. Play pink noise
  2. Emphasize bands with EQ
  3. Check your own hearing characteristics
```

### Using Noise in Mixing

```
Pink noise reference mixing method:

Procedure:
1. Place pink noise at -20dBFS on the master track
2. Mute all tracks
3. Unmute one track at a time
4. Set fader to the level where it "blends" with the pink noise
5. Repeat for all tracks
6. Mute the pink noise

Result:
- Each track's frequency band naturally balances out
- Excellent as a mixing starting point
- Make fine adjustments from here

Notes:
- This is only a starting point; ultimately judge by ear
- The "ideal balance" varies by genre
- Dynamic elements are not accounted for
```

---

## 10. Club Acoustic Environment

### Club Sound Systems

```
Typical club speaker system:

┌─────────────────────────────────────────┐
│                DJ Booth                  │
│    [Booth monitors]                      │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │            Dance floor             │ │
│  │                                      │ │
│  │  [Subwoofers]                       │ │
│  │  20-120Hz                            │ │
│  │                                      │ │
│  │  [Mid-bass]                         │ │
│  │  80-500Hz                            │ │
│  │                                      │ │
│  │  [Mid-high]                         │ │
│  │  500Hz-6kHz                          │ │
│  │                                      │ │
│  │  [Tweeters]                         │ │
│  │  6kHz-20kHz                          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [Front of House (FOH) mixer]            │
└─────────────────────────────────────────┘

Major club sound systems:
- Funktion-One: Deep low end, clear highs
- Void Acoustics: Powerful, aggressive
- d&b audiotechnik: Well-balanced, clean
- L-Acoustics: Live/festival standard
- Martin Audio: Wide coverage
- Turbosound: Good value

Crossover frequencies:
- Subwoofer <-> Mid-bass: 80-120Hz
- Mid-bass <-> Mid-high: 500-800Hz
- Mid-high <-> Tweeter: 4-8kHz
```

### Frequency Response Issues in Clubs

```
Typical issues:

1. Low-end accumulation:
   - Standing waves in enclosed spaces
   - Subwoofer placement issues
   - Excessive/insufficient low end at certain positions

2. Muddy mids:
   - Accumulated wall reflections
   - 250-500Hz "mud"
   - Especially noticeable in smaller clubs

3. High-end attenuation:
   - Natural attenuation with distance
   - Absorption by human bodies
   - Insufficient highs toward the back of the floor

DJ responses:
1. Check each frequency band during sound check
2. Understand the difference between booth monitor and floor sound
3. Judge EQ by listening on the actual floor
4. Avoid excessive low-end boosts
5. Collaborate with the PA engineer as needed

Common mistakes:
X Judging EQ based only on what you hear in the booth
X Boosting the low end too much (it's amplified further on the floor)
X Turning up monitor speakers too loud
O Go out to the floor to check (when possible)
O Communicate with the PA engineer
O Set gain levels that don't exceed the limiter
```

---

## 11. Practice Methods

### Beginner

```
1. Distinguish frequency bands:
   - Generate pink noise in a DAW (Ableton Live, etc.)
   - Solo each band with EQ and listen
   - Experience the difference between lows (100Hz), mids (1kHz), and highs (8kHz)
   - Use online frequency test websites

2. Check instrument bands:
   - Listen to kick, snare, and hi-hat individually
   - Cut each band with EQ and see "what changes"
   - Compare against frequency maps

3. Play with 3-band EQ:
   - Play a track in Rekordbox
   - Drastically cut Low/Mid/High individually
   - Experience the impact of each band
   - Notice the "sense of relief" when returning to normal

4. Introduce a spectrum analyzer:
   - Install Voxengo SPAN (free)
   - Check the frequency distribution of your favorite tracks
   - Visually understand differences between genres
```

### Intermediate

```
1. Transition EQ:
   - Practice switching the Low in a 2-track mix
   - Study bass swap timing
   - Progressively shorten: 16 bars -> 8 bars -> 4 bars
   - Also try simultaneous High EQ operation

2. Create frequency maps:
   - Diagram the frequency bands of tracks you often play
   - Verify with spectrograms
   - Understand the kick's center frequency and bassline range
   - Understand a track's "character" through frequency

3. EQ experiments in Ableton:
   - Place EQ Eight on each instrument track
   - Cut/boost each band and observe the effect
   - Identify bands where masking occurs
   - Optimize HPF settings per instrument

4. Reference mixing:
   - Load professional tracks as references
   - Compare your tracks using spectrum analysis
   - Correct bands with differences using EQ
   - Confirm improvements with A/B comparison

5. Ear training:
   - Use SoundGym (online service) for auditory training
   - EQ frequency identification quizzes
   - Boost/cut dB amount guessing
   - 10 minutes of daily practice leads to significant improvement
```

### Advanced

```
1. Precise parametric EQ operation:
   - Sweep with a narrow Q (8-20) to identify problem frequencies
   - Pinpoint notch cuts
   - Utilize dynamic EQ
   - Mid/Side EQ processing

2. Genre-specific frequency characteristics study:
   - Analyze references for House, Techno, DnB, Hip Hop
   - "Ideal" spectrum balance for each genre
   - EQ strategies for cross-genre mixing
   - Sound evolution over time (90s vs 2020s)

3. Practical masking solutions:
   - Utilize sidechain EQ/compression
   - Multiband compression
   - Mid/Side EQ processing
   - Automatic masking tools like Trackspacer

4. Room acoustic measurement and correction:
   - Measure with REW (Room EQ Wizard, free)
   - Measure the room with a measurement mic (Behringer ECM8000, etc.)
   - Identify standing waves and address them
   - Plan acoustic panel placement
   - Correct with Sonarworks SoundID Reference

5. Club practice:
   - Check frequency during sound check
   - Coordinate with the PA system
   - Establish a procedure for checking sound on the floor
   - Record and analyze later (frequency balance of your mix)

6. Mastering EQ:
   - Utilize linear phase EQ
   - Relationship between loudness and frequency balance
   - Understanding multiband limiting
   - Establish an A/B comparison workflow
```

---

## 12. Troubleshooting

```
Problem: Mix sounds muddy
  Cause: Accumulation in the 250-500Hz band (Mud)
  Solution:
  1. Check the Low-Mid of each track
  2. Cut 250-500Hz by -2~4dB on unnecessary tracks
  3. Reconsider HPF settings (set a bit higher)
  4. Compare with a reference track

Problem: Mix sounds thin
  Cause: Insufficient low end, or over-cutting Low-Mid
  Solution:
  1. Check kick/bass levels
  2. Check if 250-500Hz has been cut too much
  3. Verify bass mono compatibility
  4. Check for the presence of sub bass

Problem: Mix sounds harsh / ears hurt
  Cause: Excessive boost in the 2-5kHz band
  Solution:
  1. Check the 2-5kHz band of each track
  2. Cut -1~2dB in that band on the master bus
  3. Address on individual tracks (identify the cause)
  4. Lower monitoring volume and check

Problem: Hi-hats are noisy / sizzly
  Cause: Excess in the 8-12kHz band
  Solution:
  1. Cut 8-12kHz on the hi-hat track
  2. Reconsider sample selection
  3. Apply de-esser-like processing
  4. Control with dynamic EQ

Problem: Low end gets muddy during DJ mix
  Cause: Simultaneous playback of two kicks/basses
  Solution:
  1. Execute a bass swap
  2. Completely cut one track's Low EQ
  3. Manage with EQ, not faders
  4. Reconsider transition length

Problem: Vocals are buried and inaudible
  Cause: Masking by other instruments in the same band
  Solution:
  1. Check the 1-5kHz band of the vocals
  2. Cut the same band on competing instruments with EQ
  3. Slightly boost the vocal's 3-5kHz
  4. Consider using sidechain EQ
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation and add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup factor: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria | When Prioritized | When Acceptable to Compromise |
|----------|-----------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                  │
│    ├─ Small (1-5 people) -> Monolith             │
│    └─ Large (10+ people) -> Go to (2)            │
│                                                 │
│  (2) Deploy frequency?                           │
│    ├─ Once a week or less -> Monolith + modules  │
│    └─ Daily/multiple times -> Go to (3)          │
│                                                 │
│  (3) Team independence?                          │
│    ├─ High -> Microservices                      │
│    └─ Medium -> Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term costs**
- A short-term fast approach may become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs flexibility**
- A unified tech stack has lower learning costs
- Diverse technologies enable best-fit solutions but increase operational costs

**3. Level of abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and challenges"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required features
- Automated tests only for critical paths
- Introduce monitoring early on

**Lessons learned:**
- Don't pursue perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Incrementally revamp a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are absent
- Use an API gateway to coexist old and new systems
- Execute data migration in stages

| Phase | Tasks | Estimated Duration | Risk |
|-------|-------|-------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate from peripheral functions | 3-6 months | Medium |
| 4. Core migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# Inter-team API contract definition
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """Inter-team API contract"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Verify SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical System

**Situation:** A system that requires millisecond-level response times

**Optimization points:**
1. Cache strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Utilize asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Application |
|--------------------|--------|-------------------|-------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development Usage

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No performance impact
- [ ] No security issues
- [ ] Documentation is updated

### Knowledge Sharing Best Practices

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (Decision Record) | As needed | Future members | Decision transparency |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Important design | Consensus building |

### Technical Debt Management

```
Priority matrix:

        Impact High
          │
    ┌─────┼─────┐
    │Plan │ Act  │
    │ful- │ imme-│
    │ ly  │diate-│
    │addr-│ ly   │
    │ ess │      │
    ├─────┼─────┤
    │Docu-│ Next │
    │ment │Sprint│
    │ only │      │
    └─────┼─────┘
          │
        Impact Low
    Freq. Low    Freq. High
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|--------------|-----------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor authentication, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, principle of least privilege | Configuration scan |
| Insufficient logging | Medium | Structured logs, audit trail | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input value"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output in logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Dependency vulnerability scanning has been performed
- [ ] Error messages do not contain internal information
---


## FAQ

### Q1: What is the most important point in learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What are common beginner mistakes?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

### Key Points on Frequency Bands

```
Sub-Bass (20-60 Hz):
  Felt by the body, club subwoofers, mono recommended

Bass (60-250 Hz):
  Foundation of the track, kick/bass center, the most important EQ band for DJs

Low-Mid (250-500 Hz):
  Warmth, watch for "Mud", subtractive EQ is fundamental

Mid (500 Hz - 2 kHz):
  Core of instruments, vocal center, human ears are sensitive here

High-Mid (2-4 kHz):
  Presence/attack, most delicate, ear canal resonance

Presence (4-6 kHz):
  Clarity, forward projection, de-essing

Highs (6-12 kHz):
  Brightness, hi-hat/cymbals, frequently used DJ EQ band

Air (12-20 kHz):
  Sense of space, airiness, easily lost in MP3
```

### Golden Rules of EQ

```
1. Subtractive is fundamental (start with cuts)
2. Adjust gradually (in 1-2dB increments)
3. Judge within the full mix (don't judge in solo)
4. Actively use HPF (remove unnecessary low end)
5. Identify the problem before adjusting (don't tweak blindly)
6. Don't forget A/B comparison (check with EQ ON/OFF)
7. Rest your ears (continuous work degrades judgment)
```

**Next step:** Proceed to [Key and Scales](./key-scales.md)

---


## Recommended Next Guides

- [Harmony Basics](./harmony-basics.md) - Proceed to the next topic

---

## Reference Links

- [Audio Basics](./audio-basics.md)
- [EQ Operation](../dj/03-basic-techniques/eq-operation.md)
- Mixing Basics
- Existing EQ Guide
- [Rhythm Basics](./rhythm-basics.md)
- [Music Theory](./music-theory.md)
