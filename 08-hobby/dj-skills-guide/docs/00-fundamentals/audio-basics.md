# Audio Basics

Learn the fundamentals of digital audio and sound quality. This is essential knowledge for both DJing and music production. By deeply understanding how sound is converted into electrical signals and then stored as digital data, you can ultimately maximize the sound quality delivered at clubs and festivals.

## What You'll Learn in This Chapter

- How digital audio works and its historical background
- Theory and practice of sample rate and bit depth
- Differences between file formats and selection criteria
- Approaches to sound quality and optimization for DJ/production
- Detailed processes of A/D and D/A conversion
- Understanding noise and distortion in digital audio
- Best practices for audio settings in practice
- The role of audio interfaces and how to choose one
- The concept of latency and its optimization
- The future of digital audio and emerging technologies

## Why Audio Basics Matter

### For DJs

Audio fundamentals for DJs go beyond simply "getting good sound" — they form the foundation for delivering consistent performances in any venue.

```
Key Reasons:
1. Ability to select high-quality files
   -> Low-quality files are painfully obvious on club speakers
   -> Missing frequency ranges affect the mix

2. Proper settings for club sound systems
   -> Understanding PA/sound system characteristics
   -> Ensuring headroom to prevent clipping

3. Optimal settings for recording
   -> Format selection when recording DJ mixes
   -> Ensuring audio quality for podcasts/radio shows

4. On-site troubleshooting skills
   -> Identifying noise sources (ground loops, digital noise, etc.)
   -> Understanding connection issues between equipment

5. Efficient source management
   -> Balancing storage capacity and audio quality
   -> Unified library management
```

### For Production

In music production (DTM/DAW), consistent quality management is required from the project design stage through mastering to final distribution.

```
Key Reasons:
1. Ability to configure project settings correctly
   -> Sample rate/bit depth choices determine final quality
   -> Changing them later may cause inconsistencies

2. Understanding export settings
   -> Matching specifications required by distribution platforms (Spotify, Apple Music, etc.)
   -> Making decisions on dithering and limiting

3. Maintaining audio quality after mastering
   -> Minimizing degradation during format conversion
   -> Understanding loudness normalization

4. Plugin compatibility
   -> Operating requirements for VST/AU plugins
   -> Utilizing oversampling

5. Efficient collaboration
   -> Unified stem formats
   -> File sharing with other engineers
```

### For Sound Engineers / PA Operators

```
Key Reasons:
1. System Design
   -> Understanding digital transmission standards (AES/EBU, Dante, etc.)
   -> Importance of clock synchronization

2. Troubleshooting
   -> Identifying digital artifacts
   -> Impact of jitter and countermeasures

3. Audio Quality Optimization
   -> Understanding DSP processing precision
   -> Integration with analog stages
```


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

---

## 1. Physical Properties of Sound

### What Is Sound?

Sound is a pressure wave (longitudinal wave) that propagates through air. Understanding the properties of this wave is the foundation of digital audio.

```
Three Elements of Sound:

1. Frequency
   - Determines pitch
   - Unit: Hz (Hertz) = number of vibrations per second
   - Low sounds: 20-200 Hz
   - Mid-range sounds: 200-4,000 Hz
   - High sounds: 4,000-20,000 Hz

2. Amplitude
   - Determines loudness
   - Unit: dB (decibels)
   - Human audible range: approx. 0 dB to 130 dB (pain threshold)

3. Waveform
   - Determines timbre
   - Changes based on harmonic content
   - Why a piano and guitar sound different at the same frequency
```

### Speed of Sound and Wavelength

```
Speed of sound (in air, 20C): approx. 343 m/s

Wavelength calculation:
Wavelength(m) = Speed of sound(m/s) / Frequency(Hz)

Examples:
- 20 Hz:     343 / 20    = 17.15 m (very long wavelength)
- 100 Hz:    343 / 100   = 3.43 m
- 1,000 Hz:  343 / 1000  = 0.343 m = 34.3 cm
- 10,000 Hz: 343 / 10000 = 0.0343 m = 3.43 cm
- 20,000 Hz: 343 / 20000 = 0.01715 m = 1.715 cm

What this means for DJs:
- Low frequencies have long wavelengths, so they diffract around walls easily
- High frequencies have short wavelengths, so they are highly directional
- In clubs, bass fills the entire room while highs are heard mainly in front of speakers
```

### Harmonics

```
Relationship between fundamental and harmonics:

Fundamental: 100 Hz
+-- 2nd harmonic: 200 Hz (one octave up)
+-- 3rd harmonic: 300 Hz (one octave + a fifth up)
+-- 4th harmonic: 400 Hz (two octaves up)
+-- 5th harmonic: 500 Hz
+-- 6th harmonic: 600 Hz
+-- ... (theoretically continues infinitely)

Relationship between harmonic content and timbre:
- Sine wave: no harmonics (pure tone)
- Square wave: odd harmonics only (1, 3, 5, 7...)
- Sawtooth wave: all harmonics (1, 2, 3, 4...)
- Triangle wave: odd harmonics only (amplitude decays rapidly)

Relevance to synthesizers:
- Subtractive synth: starts with a harmonically rich waveform and removes with filters
- Additive synth: layers sine waves to create timbre
- FM synth: generates complex harmonics through frequency modulation
```

### Understanding Decibels (dB)

The decibel is a logarithmic unit used in various contexts throughout the audio world.

```
Types of Decibels:

1. dB SPL (Sound Pressure Level)
   - Physical loudness measurement
   - Reference: 20 uPa (human audible threshold)
   - Examples: conversation 60 dB SPL, club 100-115 dB SPL

2. dBFS (decibels Full Scale)
   - Digital audio level
   - 0 dBFS = digital maximum
   - Always a negative value (-3 dBFS, -6 dBFS, etc.)
   - Exceeding 0 dBFS causes clipping

3. dBu (decibel unit)
   - Line signal level for professional audio equipment
   - Reference: 0.775 V
   - Professional equipment standard line: +4 dBu
   - Consumer equipment: -10 dBV

4. dBV (decibel volt)
   - Voltage comparison
   - Reference: 1 V

Decibel calculations:
- Power ratio: dB = 10 x log10(P1/P2)
- Voltage/sound pressure ratio: dB = 20 x log10(V1/V2)

Key values to remember:
- +3 dB = approx. 2x power
- +6 dB = approx. 2x voltage/sound pressure
- +10 dB = perceived as "twice the volume"
- +20 dB = approx. 10x voltage/sound pressure
```

---

## 2. What Is Digital Audio?

### History: From Analog to Digital

```
Year        Technology              Characteristics
------      ---------------------   -------------------------
1877        Phonograph              First analog recording
1948        LP Record               Sound recorded as groove vibrations
1963        Cassette Tape           Magnetic recording, portable
1972        PCM Recording           First digital recording technology
1982        CD (Compact Disc)       44.1kHz/16bit digital standard
1995        MP3                     Widespread lossy compression
1999        DVD-Audio/SACD          Early hi-res attempts
2003        iTunes Music Store      Widespread digital distribution
2015        Tidal HiFi              Lossless streaming
2021        Apple Music Lossless    Lossless/spatial audio
2023~       Immersive Audio         Dolby Atmos Music adoption
```

### Characteristics of Analog Audio

```
Advantages:
- Naturally records continuous waveforms
- Unique warmth (tape saturation, etc.)
- Hardware character reflected in the sound

Disadvantages:
- Degradation with each copy (generation loss)
- Physical media wear
- S/N ratio limitations
- Dependence on storage environment

Examples of analog media:
- Vinyl records: groove vibration patterns
- Cassette tapes: magnetic particle alignment
- Reel-to-reel tape: high-quality magnetic recording
- Analog synthesizers: continuous voltage-controlled signals
```

### Characteristics of Digital Audio

```
Advantages:
- No degradation when copied (perfect duplication)
- Easy to edit and process
- Efficient searching and organization
- Network transmission possible
- Inexpensive mass storage

Disadvantages:
- Approximation through sampling (fundamental limitation)
- Possibility of aliasing noise
- Impact of jitter
- Compression degradation from codecs

Examples of digital media:
- CD: 44.1kHz/16bit PCM
- DVD-Audio: up to 192kHz/24bit
- SACD: DSD (1bit/2.8224MHz)
- Files: WAV, FLAC, MP3, AAC, etc.
- Streaming: various formats
```

### A/D Conversion (Analog to Digital Conversion)

The detailed process of converting analog signals to digital data.

```
Detailed A/D Conversion Steps:

[Analog Signal] -> [Anti-Aliasing Filter] -> [Sample & Hold]
                                                    |
                                          [Quantization (A/D Converter)]
                                                    |
                                          [Digital Data Output]

1. Anti-Aliasing Filter (AAF)
   - Removes components above the Nyquist frequency
   - Prevents aliasing noise
   - Implemented as an analog low-pass filter
   - Filter characteristics affect sound quality

2. Sampling
   - Reads the analog signal value at regular intervals
   - Interval determined by the sample rate
   - At 44.1kHz: every 1/44100 seconds = approx. 22.68us

3. Sample & Hold
   - Holds the value at the moment of sampling
   - Keeps the value stable during quantization
   - Requires high-speed circuitry

4. Quantization
   - Converts continuous analog values to discrete digital values
   - Precision determined by bit depth
   - Quantization error (quantization noise) occurs

5. Encoding
   - Converts quantized values to binary data
   - PCM (Pulse Code Modulation) is standard
   - Two's complement representation is standard
```

### D/A Conversion (Digital to Analog Conversion)

```
Detailed D/A Conversion Steps:

[Digital Data] -> [Oversampling] -> [D/A Converter]
                                          |
                              [Reconstruction Filter]
                                          |
                                 [Analog Signal Output]

1. Oversampling
   - Upsamples to several times the original sample rate
   - Example: 44.1kHz -> 176.4kHz (4x)
   - Interpolated with digital filters
   - Reduces the burden on subsequent analog filters

2. D/A Conversion
   - Converts digital values to analog voltage
   - Conversion methods: R-2R ladder, delta-sigma, etc.
   - Conversion precision determines D/A converter quality

3. Reconstruction Filter
   - Restores the stepped output to a smooth waveform
   - Analog low-pass filter
   - Ideally with steep cutoff characteristics

4. Analog Output Stage
   - Buffer amplifier
   - Impedance matching
   - Line output (+4 dBu / -10 dBV)
```

### PCM (Pulse Code Modulation)

```
PCM Concept:

Continuous analog waveform:
    /\      /\
  /    \  /    \
/        \/        \

PCM sampling (discretization):
    ||      ||
  ||  ||  ||  ||
||      ||      ||

Value of each sample (16bit):
Sample 1: 0000 0000 0000 0000 (= 0)
Sample 2: 0011 1111 1111 1111 (= 16383)
Sample 3: 0111 1111 1111 1111 (= 32767 = maximum)
Sample 4: 0011 1111 1111 1111 (= 16383)
Sample 5: 0000 0000 0000 0000 (= 0)
Sample 6: 1100 0000 0000 0001 (= -16383)
Sample 7: 1000 0000 0000 0001 (= -32767 = minimum)

Digital audio methods other than PCM:
- DSD (Direct Stream Digital)
  - 1-bit pulse density modulation
  - Used in SACD
  - 2.8224 MHz / 5.6448 MHz
  - Considered to have characteristics close to analog

- PDM (Pulse Density Modulation)
  - Underlying technology of DSD
  - Used in MEMS microphones, etc.
```

---

## 3. Sample Rate

### Definition and Principles

How many times per second the sound is recorded. The unit is **Hz (Hertz)** or **kHz (kilohertz)**.

```
Visual representation of sample rate:

Original waveform (1kHz sine wave):
     /\      /\      /\
   /    \  /    \  /    \
  /        \/        \/

Sampling at a low sample rate (recording with fewer points):
  .    .    .    .    .    .
-> Low waveform reproduction accuracy

Sampling at a high sample rate (recording with more points):
  ... ... ... ... ... ... ... ...
-> High waveform reproduction accuracy

Numerical examples:
44,100 Hz (44.1 kHz) = 44,100 samples per second
48,000 Hz (48 kHz)   = 48,000 samples per second
88,200 Hz (88.2 kHz) = 88,200 samples per second
96,000 Hz (96 kHz)   = 96,000 samples per second
176,400 Hz (176.4 kHz) = 176,400 samples per second
192,000 Hz (192 kHz) = 192,000 samples per second
384,000 Hz (384 kHz) = 384,000 samples per second
```

### Common Sample Rates

| Sample Rate | Usage | Characteristics | Max Reproducible Frequency |
|-------------|-------|-----------------|---------------------------|
| 8 kHz | Telephone | Voice only | 4 kHz |
| 11.025 kHz | Low-quality audio | AM radio quality | 5.5 kHz |
| 22.05 kHz | FM radio | Medium quality | 11 kHz |
| 32 kHz | Digital broadcast | DAB, etc. | 16 kHz |
| 44.1 kHz | CD, music distribution | Standard, high compatibility | 22.05 kHz |
| 48 kHz | Video, DJ equipment | CDJ, video standard | 24 kHz |
| 88.2 kHz | Mastering | Multiple of 44.1 | 44.1 kHz |
| 96 kHz | Hi-res, production | High quality, large file size | 48 kHz |
| 176.4 kHz | High-precision mastering | 4x of 44.1 | 88.2 kHz |
| 192 kHz | Highest quality | Very large file size | 96 kHz |
| 352.8 kHz | DXD | For DSD editing | 176.4 kHz |
| 384 kHz | Ultra hi-res | Research/archival | 192 kHz |

### The Origin of 44.1 kHz

```
Why 44.1 kHz?

Historical background:
1. During CD development (late 1970s)
2. Digital recording media at the time were video tape recorders
3. Synchronized to NTSC format (525 scan lines, 29.97fps)
4. 3 samples recorded per scan line
5. 525 x 29.97 x 3 / 2 (interlaced) = approx. 44,056
6. Actually used 490 active scan lines
7. 490 x 30 x 3 = 44,100
8. This is the origin of 44.1kHz

For PAL format:
- 625 scan lines, 25fps
- 588 x 25 x 3 = 44,100
- Coincidentally the same value as NTSC

The origin of 48 kHz:
- Established by AES (Audio Engineering Society)
- Designed for video production (broadcast/film)
- Non-integer conversion ratio with 44.1kHz (inconvenient)
- Standard for professional equipment
```

### Nyquist Theorem (Nyquist-Shannon Sampling Theorem)

```
The theorem states:
When converting an analog signal to digital,
a sample rate at least twice the highest frequency of the original signal is required

Formula:
fs >= 2 x fmax

fs: sample rate
fmax: highest frequency to be reproduced

Human audible range and required sample rate:
- Audible range: approx. 20 Hz to 20,000 Hz
- Required sample rate: 20,000 x 2 = 40,000 Hz or higher
- CD standard: 44,100 Hz (with margin)
- Nyquist frequency: 44,100 / 2 = 22,050 Hz
- 22,050 Hz > 20,000 Hz -> Covers the audible range

Aliasing:
- Occurs when components above the Nyquist frequency are sampled
- A phenomenon where non-existent lower frequencies appear
- Prevented by anti-aliasing filters

Example:
Sample rate = 44.1kHz
Nyquist frequency = 22.05kHz
If the input contains a 25kHz component:
-> 44.1 - 25 = 19.1kHz alias noise is generated
-> This is within the audible range and heard as distortion
```

### The Significance of Oversampling

```
Why use hi-res (96kHz, 192kHz, etc.)?

Reason 1: Reduced burden on anti-aliasing filters
- 44.1kHz: Must cut sharply between 20kHz and 22.05kHz
- 96kHz: Wide transition band available from 20kHz to 48kHz
- Gentler filter characteristics, less phase distortion

Reason 2: Improved plugin processing precision
- Non-linear processing (saturation, compressor, etc.)
- At low sample rates, foldback noise enters the audible range
- At high sample rates, foldback stays outside the audible range

Reason 3: Time-stretch/pitch-shift quality
- More original information means higher conversion quality
- Advantageous when changing tempo during DJ sets

Reason 4: Headroom during recording
- Preserves ultra-high frequency information
- Provides filter processing margin during downsampling

Reason 5: Future format compatibility
- Preserving high-quality recordings for archival purposes
- Source quality for remastering

Notes:
- CPU load increases
- Storage consumption increases
- Human hearing limitations (frequencies above 20kHz are inaudible)
- Differences in blind tests are subtle
```

### Recommended Sample Rate Settings

**DJ (Rekordbox / CDJ):**
```
Recommended: 48 kHz

Reasons:
- Native sample rate of CDJ-3000/CDJ-2000NXS2
- Club sound system standard
- ProDJ Link streaming quality
- Rekordbox default setting

Configuration (Rekordbox):
1. Preferences > Audio
2. Sample Rate: 48000 Hz
3. * 44.1kHz sources are automatically resampled

Notes:
- No issues importing 44.1kHz sources
- Rekordbox handles the conversion internally
- 96kHz is not supported on CDJs
```

**Production (Ableton Live / Logic Pro):**
```
Recommended: 48 kHz (basic) / 96 kHz (when higher quality is desired)

48kHz:
- Lower CPU load
- Best plugin compatibility
- Easy integration with video
- Sufficient if final output is 44.1kHz/48kHz

96kHz:
- Improved quality for non-linear plugins
- Better pitch shift/time stretch precision
- Approximately 2x CPU load
- Some plugins may not support it

Configuration (Ableton Live):
1. Preferences > Audio
2. Sample Rate: 48000 / 96000
3. * Recommended to set when creating the project
4. * Avoid changing mid-project (warp markers may shift)
```

---

## 4. Bit Depth

### Definition and Principles

How finely the loudness of sound is recorded. The unit is **bit**.

```
Bit depth and quantization levels:

8 bit  =      256 levels (2^8)
16 bit =   65,536 levels (2^16)
24 bit = 16,777,216 levels (2^24)
32 bit = 4,294,967,296 levels (2^32)

Visual representation (quantization precision):

8bit (coarse quantization):
xxxx
xxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxx
xxxx
-> Large steps (quantization noise) are significant

16bit (fine quantization):
xx
xxxx
xxxxxx
xxxxxxxx
xxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxxxxxx
xxxxxxxxxxxxxxxx
xxxxxxxxxxxxxx
xxxxxxxxxxxx
xxxxxxxxxx
xxxxxxxx
xxxxxx
xxxx
xx
-> Steps are very small, sounds smooth

24bit (very fine quantization):
-> Steps are imperceptible to human hearing
-> Finer precision than the recording noise floor
```

### Dynamic Range in Detail

The higher the bit depth, the more accurately the **difference between the quietest and loudest sounds (dynamic range)** can be recorded.

```
Dynamic range calculation:

Theoretical values:
Dynamic range (dB) = Bit depth x 6.02 + 1.76

  8 bit = 8  x 6.02 + 1.76 = 49.92 dB = approx. 50 dB
 16 bit = 16 x 6.02 + 1.76 = 98.08 dB = approx. 96 dB
 24 bit = 24 x 6.02 + 1.76 = 146.24 dB = approx. 144 dB
 32 bit int = 32 x 6.02 + 1.76 = 194.4 dB

32 bit float (floating point):
- 24-bit mantissa + 8-bit exponent
- Effective dynamic range: approx. 1,680 dB (theoretical)
- No internal clipping even when exceeding 0 dBFS
- Standard for internal DAW processing

Comparison (real-world environments):
- Quiet room: approx. 30 dB SPL
- Conversation: approx. 60 dB SPL
- Club: approx. 100-115 dB SPL
- Jet engine: approx. 140 dB SPL
- 16bit's 96dB covers most everyday scenarios
```

### Quantization Noise and Dithering

```
What is quantization noise?
- Error from rounding analog values to digital values
- More noticeable at lower signal levels
- Sometimes noticeable during fade-outs at 16bit

Dithering:
- A technique that adds slight random noise before quantization
- Converts unpleasant quantization distortion into harmless white noise
- Especially important when reducing bit depth (e.g., 24bit -> 16bit)

Types of dithering:
1. Flat dither (TPDF - Triangular Probability Density Function)
   - Triangular distribution random noise
   - Simplest and most standard
   - Ableton Live default

2. Noise-shaped dither
   - Shifts noise to higher frequencies based on human hearing characteristics
   - POW-r (Type 1, 2, 3)
   - Apogee UV22HR
   - iZotope MBIT+
   - Improves perceptual S/N ratio

Practical application:
- Always apply dithering when exporting 24bit -> 16bit
- Virtually unnecessary for 32bit float -> 24bit (difference is imperceptible)
- Apply dithering only once (avoid multiple applications)
- Apply at the final mastering stage
```

### Common Bit Depths

| Bit Depth | Usage | Dynamic Range | Characteristics |
|-----------|-------|---------------|-----------------|
| 8 bit | Legacy, chiptune | approx. 50 dB | Lo-fi sound |
| 16 bit | CD, distribution | approx. 96 dB | Sufficient quality, small file size |
| 24 bit | Recording, production, hi-res | approx. 144 dB | Pro standard, plenty of headroom |
| 32 bit int | Special use | approx. 194 dB | Rarely used |
| 32 bit float | Internal DAW processing | approx. 1,680 dB | No clipping |
| 64 bit float | Some DAW internals | Virtually infinite | Ultra-high precision calculation |

### Recommended Bit Depth Settings

**DJ (Rekordbox):**
```
Recommended: 16 bit (for playback sources)

Reasons:
- Sources from distribution sites are typically 16bit/24bit
- The difference between 16bit and 24bit is negligible in a club PA environment
- Better storage efficiency
- CDJ processes internally at 24bit/32bit

For recording (DJ mixes):
- Record in 24 bit WAV recommended
- Leaves headroom for later mastering
```

**Production (Ableton Live / Logic Pro):**
```
Recommended settings:
- Internal project: 32 bit float (DAW default)
- Recording: 24 bit
- Export (master): 24 bit WAV
- Export (distribution): 16 bit WAV + dithering
- Export (streaming): 24 bit WAV (current mainstream)

Configuration (Ableton Live):
1. Preferences > Record/Warp/Launch
2. Record Bit Depth: 24
3. Select Dither: Triangular when exporting

Configuration (Logic Pro):
1. Project Settings > Audio
2. Recording Bit Depth: 24-Bit
3. Select Dithering: POW-r #2 when bouncing
```

---

## 5. File Formats

### Uncompressed Formats

**WAV (Waveform Audio File Format):**

```
Characteristics:
- Developed by Microsoft/IBM
- RIFF container format
- Stores uncompressed PCM data
- Widest support

Technical details:
- Header: 44 bytes (standard)
- Chunk-based structure
- Little-endian
- Maximum file size: 4GB (standard WAV)
  - RF64/BWF: supports files larger than 4GB

Metadata:
- BWF (Broadcast Wave Format): timecode, etc.
- LIST chunk: title, artist, etc.
- ID3 tags are non-standard but supported by some software

DJ usage:
- Rekordbox: fully supported
- CDJ: fully supported (via USB)
- Serato DJ: fully supported
- Traktor: fully supported

Production usage:
- Fully supported by all DAWs
- Standard format for sample packs/loops
- Plugin import/export
```

**AIFF (Audio Interchange File Format):**

```
Characteristics:
- Developed by Apple
- IFF container format
- Stores uncompressed PCM data
- Common in Mac environments

Technical details:
- Big-endian (opposite of WAV)
- Chunk-based structure
- AIFF-C: compressed version (rarely used)

Metadata:
- Native ID3v2 tag support
- Easy artwork embedding
- Richer metadata than WAV

WAV vs AIFF comparison:
| Item | WAV | AIFF |
|------|-----|------|
| Developer | Microsoft | Apple |
| Endianness | Little | Big |
| Metadata | Limited | Rich (ID3v2) |
| Compatibility | Highest | High |
| File size | Equivalent | Equivalent |
| Audio quality | Equivalent | Equivalent |

Recommendation:
- No audio quality difference between the two
- Windows-centric -> WAV
- Mac-centric -> AIFF (metadata advantages)
- Compatibility-focused -> WAV
```

### Lossless Compression Formats

**FLAC (Free Lossless Audio Codec):**

```
Characteristics:
- Released in 2001, open source
- Lossless compression
- Compression ratio: approx. 50-70% of original
- Fast decoding speed
- Suitable for streaming

Technical details:
- Based on Linear Predictive Coding (LPC)
- Block size: 1152-65535 samples
- Maximum: 32bit/655.35kHz/8ch
- Streaming-ready (seekable)
- Built-in MD5 checksum

Compression levels (0-8):
- 0: Fastest encoding, lowest compression ratio
- 5: Default (balanced)
- 8: Slowest encoding, highest compression ratio
- Decoding speed is virtually the same regardless of level

Metadata:
- Vorbis Comment tags
- Album art embedding
- ReplayGain support
- Cue sheet embedding

DJ usage:
- Rekordbox 6+: supported
- CDJ-3000: supported (via USB)
- CDJ-2000NXS2: supported
- Serato DJ Pro: supported
- Traktor Pro: supported

Size comparison (5-minute stereo track, 44.1kHz/16bit):
- WAV:  approx. 52.9 MB
- FLAC: approx. 26-37 MB (50-70% compression)
- Saves approx. 1.6-2.6 GB per 100 tracks
```

**ALAC (Apple Lossless Audio Codec):**

```
Characteristics:
- Developed by Apple (2004)
- Open-sourced in 2011
- Advantageous in the iTunes/Apple Music ecosystem
- Audio quality equivalent to FLAC

Technical details:
- Modified linear prediction
- M4A container (MP4-based)
- Maximum: 32bit/384kHz
- Hardware decoding on Apple devices

FLAC vs ALAC comparison:
| Item | FLAC | ALAC |
|------|------|------|
| Compression ratio | Slightly better | Slightly worse |
| Decoding speed | Fast | Fast |
| Apple support | iOS 11+, macOS | Native |
| Android support | Native | App-dependent |
| DJ software | Widely supported | Limited |
| Streaming | Excellent | Good |

Recommendation:
- Apple-centric workflow -> ALAC
- Otherwise -> FLAC
- DJ use -> FLAC (higher compatibility)
```

### Lossy Compression Formats

**MP3 (MPEG Audio Layer-3):**

```
Characteristics:
- Standardized in 1993
- Most widely adopted compression format
- Lossy compression based on psychoacoustic models
- All patents expired in 2017

How compression works:
1. Utilizes auditory masking effects
   - Quiet sounds near loud sounds are inaudible
   - Temporal masking: quiet sounds right after loud sounds
   - Frequency masking: weaker sounds at nearby frequencies
2. Reduces/removes data for masked portions
3. Transforms to frequency domain using MDCT (Modified Discrete Cosine Transform)
4. Encodes with Huffman coding

Bitrate modes:
- CBR (Constant Bit Rate): fixed bitrate
  - 320 kbps CBR: recommended for DJs
  - Predictable file sizes
  - Fast seeking

- VBR (Variable Bit Rate): variable bitrate
  - Allocates more bits to complex passages
  - Smaller files than CBR at same quality
  - V0 = approx. 245 kbps average
  - V2 = approx. 190 kbps average

- ABR (Average Bit Rate): average bitrate
  - A type of VBR with specified average
  - Rarely used

MP3 quality degradation points:
- High frequencies (above 16kHz) are easily cut
- Stereo image degradation
- Pre-echo (artifacts before transients)
- "Swishing" sounds at low bitrates
- Quality degrades with repeated re-encoding
```

**AAC (Advanced Audio Coding):**

```
Characteristics:
- Standardized in 1997 (MPEG-2 Part 7)
- Designed as successor to MP3
- Better quality than MP3 at the same bitrate
- Used by Apple Music / YouTube / Instagram

Profiles:
- AAC-LC (Low Complexity): most common
- HE-AAC (High Efficiency): for low bitrates
  - v1: SBR (Spectral Band Replication)
  - v2: SBR + PS (Parametric Stereo)
- AAC-LD/ELD: low latency (for communication)
- xHE-AAC: latest, ultra-efficient

Quality comparison (subjective evaluation):
- AAC 256 kbps = approx. MP3 320 kbps
- AAC 128 kbps >> MP3 128 kbps
- AAC is particularly superior at low bitrates

Use cases:
- Apple Music: AAC 256 kbps
- YouTube: AAC (video audio)
- Instagram/TikTok: AAC
- iTunes Store: AAC 256 kbps
```

**OGG Vorbis / Opus:**

```
OGG Vorbis:
- Developed by Xiph.org, fully open source
- Quality equal to or better than AAC
- Used by Spotify (320 kbps)
- Widely used in the gaming industry

Opus:
- Standardized in 2012 (RFC 6716)
- Most efficient audio codec
- 6 kbps (voice) to 510 kbps (music)
- Used by Discord, WebRTC
- Low latency (2.5ms to 60ms)

Use case comparison:
| Codec | Primary Use | Recommended Bitrate |
|-------|------------|---------------------|
| MP3 | Compatibility-focused | 320 kbps |
| AAC | Apple/Web | 256 kbps |
| Vorbis | Spotify/Games | 320 kbps |
| Opus | Communication/Web | 128 kbps |
```

### Bitrate Comparison Table

| Bitrate | MP3 | AAC | Vorbis | Opus | Usage |
|---------|-----|-----|--------|------|-------|
| 64 kbps | Unusable | Low quality | Low quality | Good | Voice only |
| 96 kbps | Unusable | Low-mid | Low-mid | Good | Podcasts |
| 128 kbps | Low quality | Mid quality | Mid quality | High quality | Casual listening |
| 192 kbps | Mid quality | High quality | High quality | Highest quality | General listening |
| 256 kbps | High quality | Highest quality | Highest quality | - | Distribution/Apple Music |
| 320 kbps | Highest quality | Highest quality | Highest quality | - | DJ-usable |

---

## 6. File Size Calculation

### Formula (Uncompressed)

```
File size (bytes) = Sample rate x (Bit depth / 8) x Channels x Seconds

MB conversion:
File size (MB) = File size (bytes) / 1,048,576

Simplified formula:
File size (MB) = Sample rate x Bit depth x Channels x Seconds / 8 / 1,000,000
```

### Example Calculations

```
- WAV 44.1kHz 16bit Stereo (5 min = 300 sec):
  44,100 x (16/8) x 2 x 300 = 52,920,000 bytes
  = 50.46 MB

- WAV 48kHz 24bit Stereo (5 min):
  48,000 x (24/8) x 2 x 300 = 86,400,000 bytes
  = 82.40 MB

- WAV 96kHz 24bit Stereo (5 min):
  96,000 x (24/8) x 2 x 300 = 172,800,000 bytes
  = 164.79 MB

- WAV 192kHz 32bit Stereo (5 min):
  192,000 x (32/8) x 2 x 300 = 460,800,000 bytes
  = 439.45 MB

- MP3 320kbps (5 min):
  320,000 x 300 / 8 = 12,000,000 bytes
  = 11.44 MB

- MP3 128kbps (5 min):
  128,000 x 300 / 8 = 4,800,000 bytes
  = 4.58 MB

- FLAC 44.1kHz/16bit (5 min, assuming 60% compression):
  50.46 x 0.6 = approx. 30.3 MB

- AAC 256kbps (5 min):
  256,000 x 300 / 8 = 9,600,000 bytes
  = 9.16 MB
```

### Storage Capacity Estimates (DJ Library)

```
Library of 1000 tracks (average 5 min/track):

WAV 44.1/16:   50 MB x 1000 = 50 GB
WAV 48/24:     82 MB x 1000 = 82 GB
FLAC 44.1/16:  30 MB x 1000 = 30 GB
MP3 320kbps:   12 MB x 1000 = 12 GB
AAC 256kbps:    9 MB x 1000 =  9 GB

Recommended storage configurations:
- USB drive 64GB: approx. 5000 tracks at MP3 320kbps
- USB drive 128GB: approx. 4000 tracks in FLAC
- USB drive 256GB: approx. 5000 tracks in WAV 44.1/16
- External SSD 1TB: approx. 12000 tracks in WAV 48/24

CDJ USB drive notes:
- FAT32 format (4GB per file limit)
- exFAT support: CDJ-3000, CDJ-2000NXS2 (firmware-dependent)
- HFS+: supported by Pioneer DJ equipment
- Folder structure depth is limited
```

### Streaming Service Quality Comparison

```
Distribution formats by service:

Spotify:
- Free: Ogg Vorbis 128 kbps
- Premium: Ogg Vorbis 320 kbps
- HiFi: FLAC (CD quality, select regions)

Apple Music:
- AAC 256 kbps (standard)
- ALAC 16bit/44.1kHz (lossless)
- ALAC 24bit/192kHz (hi-res lossless)
- Dolby Atmos (spatial audio)

Tidal:
- HiFi: FLAC 16bit/44.1kHz
- HiFi Plus: MQA 24bit/96kHz+
- Dolby Atmos

Amazon Music:
- HD: FLAC 16bit/44.1kHz
- Ultra HD: FLAC 24bit/192kHz
- Dolby Atmos / 360 Reality Audio

Beatport:
- MP3 320 kbps
- WAV 44.1kHz/16bit
- AIFF 44.1kHz/16bit
- FLAC (some titles)

Bandcamp:
- MP3 320 kbps / V0
- FLAC
- ALAC
- WAV
- AIFF
- Ogg Vorbis
```

---

## 7. Choosing Audio Quality

### For DJs

```
- Highest Quality Setup:
  Format: WAV 48kHz/24bit or AIFF 48kHz/24bit
  Storage: SSD (not a USB flash drive)
  Advantages: Best audio quality, headroom assured
  Disadvantages: Large file sizes, higher purchase costs

- Balanced Setup:
  Format: FLAC 44.1kHz/16bit
  Storage: USB drive 128GB+
  Advantages: High quality, good storage efficiency
  Disadvantages: Some older equipment may not support it

- Compatibility-Focused Setup:
  Format: MP3 320kbps CBR
  Storage: USB drive 64GB
  Advantages: Plays on any equipment, smallest file sizes
  Disadvantages: Quality loss from lossy compression

- Settings to Avoid:
  x MP3 128kbps (degradation is obvious in clubs)
  x VBR MP3 (seeking issues on some CDJs)
  x YouTube rips (low quality + copyright issues)
  x Illegal downloads (unknown quality + illegal)
  x Upconverted fake hi-res
```

### How to Identify Fake Hi-Res

```
What is fake hi-res?
- Simply converting a low-quality file like MP3 to WAV/FLAC
- Even if the file format is high quality, the content remains low quality
- Higher bitrate does not increase information content

How to identify:
1. Spectrogram analysis
   - Analyze frequencies with Spek (free software)
   - True CD quality: information extends to around 22kHz
   - Converted from MP3: sudden cutoff at 16-20kHz
   - 128kbps MP3: clear cutoff at 16kHz

2. Abnormal file size
   - A 5-minute WAV 44.1/16 track should be approx. 50MB
   - An unusually small WAV file is suspicious

3. Source reliability
   - Beatport, Bandcamp, Juno Download: trustworthy
   - Unknown sites: risk of fake hi-res

4. Verification tools
   - Spek: spectrogram display
   - Audacity: spectrum analysis
   - foobar2000 + ABX plugin
```

### For Production

```
- Within projects:
  - Samples/loops: WAV 48kHz 24bit (recommended)
  - Recording (vocals/instruments): 48kHz 24bit or higher
  - Internal processing: 32bit float (DAW default)
  - Avoid mixing sample rates (resampling will occur)

- Export (stems before mastering):
  - WAV 48kHz 32bit float
  - Headroom: -6dB to -3dB
  - Dithering: not needed (32bit float -> 32bit float)

- Export (after mastering):
  - Master: WAV 48kHz 24bit
  - For distribution: WAV 44.1kHz 16bit + dithering
  - Spotify/Apple Music: WAV 44.1kHz/16bit or 48kHz/24bit
  - MP3: 320kbps CBR (for promo/reference)

- Recommended formats by distribution platform:
  | Platform | Format | Notes |
  |----------|--------|-------|
  | Spotify/Apple Music | WAV 44.1kHz/16bit | Transcoded internally |
  | Beatport | WAV 44.1kHz/16bit | Sold as original |
  | Bandcamp | WAV/FLAC 44.1kHz/16bit | Offered in multiple formats |
  | SoundCloud | WAV 48kHz/24bit | Converted internally to 128kbps |
  | YouTube | WAV 48kHz/24bit | Sync with video |
```

---

## 8. Audio Interface Basics

### What Is an Audio Interface?

```
Role:
- A/D conversion (mic/instrument -> PC)
- D/A conversion (PC -> speakers/headphones)
- Higher quality than built-in PC sound cards
- Low-latency input/output

Components:
+----------------------------------+
|       Audio Interface            |
|                                  |
|  [Mic Preamp] -> [A/D Converter] |
|  [D/A Converter] -> [Headphone Amp] |
|  [D/A Converter] -> [Line Out]   |
|  [Clock Generator]               |
|  [DSP (some models)]             |
|                                  |
|  Connection: USB / Thunderbolt / PCIe |
+----------------------------------+
```

### Audio Interfaces for DJs

```
When using Rekordbox DJ:
- Built into Pioneer DJ DDJ controllers
  - DDJ-FLX10: 24bit/48kHz
  - DDJ-1000: 24bit/44.1kHz
  - DDJ-REV7: 24bit/48kHz

When using an external interface:
- Pioneer DJ Interface 2: DVS control
- Native Instruments Audio 2 DJ
- Allen & Heath Xone:DB4 (built-in)

Selection criteria:
1. Latency (10ms or less is ideal)
2. Channel count (2+ outputs: Master + Monitor)
3. Sample rate (48kHz support)
4. Driver stability (ASIO/Core Audio)
5. Durability (must withstand live use)
```

### Audio Interfaces for Production

```
Entry-level (up to 30,000 yen):
- Focusrite Scarlett 2i2 (4th Gen)
  - 24bit/192kHz
  - USB-C
  - Air mode

- Universal Audio Volt 276
  - 24bit/192kHz
  - Built-in vintage compressor

Mid-range (30,000-100,000 yen):
- Universal Audio Apollo Solo
  - 24bit/192kHz
  - Thunderbolt
  - UAD plugin support

- RME Babyface Pro FS
  - 24bit/192kHz
  - USB
  - Extremely low latency

Professional (100,000 yen+):
- RME Fireface UFX III
  - 24bit/192kHz
  - USB/MADI
  - Multi-channel

- Apogee Symphony Desktop
  - 24bit/192kHz
  - Thunderbolt
  - Top-class conversion quality
```

### Understanding Latency

```
What is latency (delay)?
- The time difference from input to output
- Measured in ms (milliseconds)

Components of latency:
1. A/D conversion delay: approx. 1ms
2. Buffer delay: buffer size / sample rate
3. DAW processing delay: plugin-dependent
4. D/A conversion delay: approx. 1ms

Buffer size and latency:

Buffer Size     Sample Rate    Latency (one-way)
32 samples     48kHz          0.67 ms
64 samples     48kHz          1.33 ms
128 samples    48kHz          2.67 ms
256 samples    48kHz          5.33 ms
512 samples    48kHz          10.67 ms
1024 samples   48kHz          21.33 ms
2048 samples   48kHz          42.67 ms

Round-trip latency = one-way x 2 + A/D + D/A = approx. one-way x 2 + 2ms

Recommended settings:
- DJ performance: 128-256 samples (5-10ms)
- Production (recording): 64-128 samples (3-5ms)
- Production (mixing): 256-512 samples (stability-focused)
- Production (heavy projects): 512-1024 samples

Smaller buffer size:
+ Lower latency
- Higher CPU load
- Risk of dropouts (audio glitches)

Larger buffer size:
+ Stable operation
+ Can handle heavy plugins
- Higher latency
- Interferes with real-time performance
```

---

## 9. Rekordbox Settings

### Audio Output Settings

```
Basic settings:
1. Preferences > Audio
2. Audio Device: your interface (DDJ controller, etc.)
3. Sample Rate: 48000 Hz
4. Buffer Size: 512 samples (balance between latency and stability)

Advanced settings:
- Bit Depth: internal 24bit processing (fixed)
- Master Out: channels 1-2
- Headphone Out: channels 3-4
- Mic In: channels 5-6 (supported controllers)

Troubleshooting:
- No sound -> Check audio device selection
- Audio dropouts -> Increase buffer size (e.g., 1024)
- High latency -> Decrease buffer size (e.g., 256)
- Noise -> Check USB cable, check for power noise
```

### Import Settings

```
Basic settings:
1. Preferences > Advanced
2. File analysis quality: High (not Normal)
3. Auto Gain: Off (manual adjustment recommended)

Analysis settings:
- BPM analysis range: 70-180 (adjust for genre)
- Key analysis: On
- Waveform display: full waveform + detailed waveform
- Auto beat grid: On

Recommended file management:
1. Consolidate sources on an external SSD/USB
2. Use a unified folder structure
   Example:
   /Music/
   +-- House/
   |   +-- Deep House/
   |   +-- Tech House/
   |   +-- Progressive House/
   +-- Techno/
   |   +-- Peak Time/
   |   +-- Melodic/
   |   +-- Minimal/
   +-- DnB/

3. File naming convention: "Artist - Title.wav"
4. Regularly organize the library
5. Thorough backups (3-2-1 rule)
```

### Recording Settings

```
Recording DJ mixes:

Rekordbox built-in recorder:
1. Record button (top right of screen)
2. Format: WAV
3. Bit depth: 16bit / 24bit (24bit recommended)
4. Sample rate: depends on project (48kHz)

External recording (recommended):
- Record separately with Audacity
- Audio interface loopback function
- Mixer REC OUT to a separate device

Professional recording:
- Allen & Heath Xone:96 REC OUT -> Audio IF -> DAW
- Pioneer DJM-V10 Digital OUT -> Audio IF -> DAW
- Record in 24bit/48kHz WAV
- Post-processing: Normalize -> EQ -> Limiter -> Export
```

---

## 10. Ableton Live Settings

### Project Settings

```
Audio Settings (Preferences > Audio):
1. Audio Device: your audio interface
2. Driver Type: Core Audio (Mac) / ASIO (Windows)
3. Sample Rate: 48000 Hz
4. Buffer Size: 512 samples (production) / 128 samples (performance)
5. Input/Output Config: enable only channels in use

Record/Warp/Launch Settings:
1. Record Bit Depth: 24
2. Default Warp Mode: Complex Pro (highest quality)
3. Default SR Conversion Mode: High Quality
4. Clip Update Rate: High

File/Folder Settings:
1. Temporary Folder: a folder on an SSD
2. Sample Editor: path to external editor
3. Collect Files on Export: Ask

CPU optimization:
- Freeze unused plugins
- Remove unused send/return channels
- Use oversampling only during mixdown
```

### Export Settings

```
Export Audio/Video (File > Export Audio/Video):

- Stems for mastering:
  Rendered Track: each track individually
  File Type: WAV
  Bit Depth: 32 Bit (Float)
  Sample Rate: 48000
  Dither Options: No Dither
  Normalize: Off
  Create Analysis File: On

- Final master (for distribution):
  Rendered Track: Master
  File Type: WAV
  Bit Depth: 16
  Sample Rate: 44100
  Dither Options: Triangular
  Normalize: Off (if already mastered)

- Final master (high-quality distribution):
  Rendered Track: Master
  File Type: WAV
  Bit Depth: 24
  Sample Rate: 48000
  Dither Options: No Dither (may not be needed for 24bit)
  Normalize: Off

- Promo/reference:
  Rendered Track: Master
  File Type: MP3
  Bit Rate: 320 CBR
  Normalize: Off

Dithering notes:
- 32bit float -> 24bit: dithering not needed (difference is minimal)
- 32bit float -> 16bit: Triangular dithering recommended
- 24bit -> 16bit: dithering is essential
- Apply dithering only once at the end
- Ensure you don't double up with mastering plugin dither
```

### Ableton Live Internal Processing

```
Signal flow:

[Audio Clip]
    | (Resampling: converted to project SR)
[Warp Engine]
    | (Time stretch/pitch shift)
[Device Chain]
    | (Effects/instruments processing -> 32bit float)
[Mixer]
    | (Pan, volume, sends -> 32bit float)
[Master Bus]
    | (Master effects -> 32bit float)
[D/A Conversion or Export]
    | (Bit depth conversion + dithering)
[Final Output]

All internal processing is done in 32bit float:
- No overflow (clipping) occurs
- Track faders above 0dB are internally OK
- No issues as long as the master stays below 0dBFS
- Virtually unlimited headroom
```

---

## 11. Digital Audio Quality Degradation Factors

### Clipping

```
Digital clipping:
- Occurs when the signal exceeds 0 dBFS
- Wave peaks are flat-cut (squared off)
- Produces very unpleasant distortion
- Cannot be undone once it occurs

Analog clipping:
- Occurs when analog circuit maximum voltage is exceeded
- Gradual saturation
- Can sometimes be pleasant distortion (tape saturation, etc.)

Prevention:
1. During recording: set peaks at -12dB to -6dB
2. During mixing: manage gain on each track
3. Master: control below 0dBFS with a limiter
4. 32bit float DAW: no internal clipping occurs
   (however, clipping is still possible at the final output stage)

True Peak:
- The inter-sample peak problem
- Individual samples may be below 0dBFS,
  but the analog waveform after D/A conversion may exceed 0dBFS
- Check with a True Peak meter
- -1 dBTP (True Peak) or below is recommended
```

### Jitter

```
What is jitter?
- Temporal fluctuations in sampling timing
- Caused by inaccuracy in the clock signal
- A factor in audio quality degradation

Impact:
- High frequency blurring
- Degraded stereo image
- Reduced overall transparency
- Subtle but cumulative degradation

Countermeasures:
1. Use high-quality clock generators
2. Word clock synchronization (professional environments)
3. Choose high-quality D/A converters
4. USB isochronous transfer quality
5. Thunderbolt connection (more stable than USB)

Countermeasures in DJ environments:
- CDJ built-in D/A converters are high quality
- DJ mixer D/A converter quality is important
- When using digital connections (S/PDIF, AES/EBU), synchronize clocks
```

### Quantization Distortion

```
What is quantization distortion?
- Occurs when bit depth is insufficient
- Particularly noticeable at low signal levels
- Perceived as "graininess" or "granularity"

Conditions for occurrence:
- 8bit audio: clearly audible
- 16bit: slightly noticeable during fade-outs
- 24bit: virtually imperceptible
- 32bit float: does not occur

Countermeasures:
- Record at sufficient bit depth (24bit or higher)
- Use dithering when reducing bit depth
- Process internally in 32bit float within the DAW
```

### Aliasing

```
What is aliasing?
- Occurs when components above the Nyquist frequency are sampled
- Non-existent frequencies appear
- Non-integer inharmonic frequencies are added

Specific example:
Sample rate: 44.1kHz (Nyquist: 22.05kHz)
Input: 23kHz sine wave
Result: 44.1 - 23 = 21.1kHz alias appears
-> The original 23kHz is inaudible, but a false sound at 21.1kHz is heard

Countermeasures:
1. Anti-aliasing filter before A/D conversion
2. Sufficiently high sample rate
3. Plugin oversampling features
4. Digital domain filtering

Plugins and aliasing:
- Distortion/saturation -> generates new harmonics
- If generated harmonics exceed the Nyquist frequency, they fold back
- Counter with oversampling (2x, 4x, 8x)
- Tradeoff with CPU load
```

---

## 12. Practice: Comparing Audio Quality

### Preparation

```
What you need:
1. The same track in different formats
   - WAV 44.1kHz/16bit
   - FLAC 44.1kHz/16bit
   - MP3 320kbps
   - MP3 256kbps
   - MP3 128kbps

2. Monitoring environment
   - Studio monitor speakers (recommended)
   - High-quality headphones (alternative)
   - ATH-M50x, DT 770 Pro, HD 650, etc.

3. Spectrum analyzer
   - Spek (free, cross-platform)
   - Audacity spectrogram display
   - iZotope Insight (DAW plugin)
```

### Procedure

```
Step 1: Visual spectrogram comparison

Using Spek:
1. Drag & drop the WAV file
   -> Information displayed up to around 22kHz
2. Drag & drop MP3 320kbps
   -> Cutoff around 20kHz (encoder-dependent)
3. Drag & drop MP3 128kbps
   -> Clear cutoff around 16kHz
4. Drag & drop FLAC
   -> Spectrogram identical to WAV

Step 2: A/B test (blind test)

Method:
1. Install foobar2000 + ABX Comparator plugin
2. Compare WAV and MP3 320kbps
3. Identify whether randomly played A/B matches X
4. Check for statistically significant differences (p < 0.05)

Notes:
- Match volumes exactly (use ReplayGain)
- Compare short sections (10-30 seconds)
- Focus on transients (percussion attacks)
- Focus on cymbal/hi-hat texture
- Focus on bass definition

Step 3: Comparison in a club environment

1. Load the same track in different formats in Rekordbox
2. A/B test (quickly switch using CUE button)
3. Check differences at high volume
   - In front of speakers (high frequency differences)
   - Center of the floor (low frequency pressure)
   - Edge of the room (impression including reflections)

Step 4: Record the results
Comparison sheet example:
| Item | WAV | FLAC | MP3 320 | MP3 128 |
|------|-----|------|---------|---------|
| High frequency clarity | O | O | D | X |
| Low frequency pressure | O | O | O | D |
| Stereo image | O | O | D | X |
| Transients | O | O | O | D |
| Overall spaciousness | O | O | D | X |
```

---

## 13. Clock Synchronization and Digital Connections

### Word Clock

```
What is word clock?
- Synchronizes sample timing between digital audio devices
- A master clock provides the reference signal
- Slave devices synchronize to the master

When it's needed:
- Connecting multiple digital audio devices
- A/D -> Mixer -> D/A chains
- Professional studio environments

Connections:
- BNC connector (75 ohm coaxial cable)
- 75 ohm termination resistor configuration
- Daisy chain or star connection

Relevance for clubs/DJs:
- CDJ -> DJM mixer: DJM is master when digitally connected
- Multiple CDJs: each CDJ's internal clock is independent
- ProDJ Link: BPM sync via network (separate from clock sync)
```

### Digital Connection Standards

```
S/PDIF (Sony/Philips Digital Interface):
- Consumer standard
- Coaxial (RCA/75 ohm) or optical (TOSLINK)
- Maximum 24bit/192kHz (coaxial)
- Maximum 24bit/96kHz (optical, typical)
- 2 channels

AES/EBU (AES3):
- Professional standard
- XLR connector (110 ohm)
- Maximum 24bit/192kHz
- 2 channels
- Strong for long-distance transmission (100m+)

ADAT (Alesis Digital Audio Tape):
- Optical fiber (TOSLINK connector)
- 8 channels @ 48kHz
- 4 channels @ 96kHz (S/MUX)
- Used for multi-channel studio connections

Dante:
- Network audio standard by Audinate
- Ethernet (CAT5e/CAT6)
- Supports hundreds of channels
- Ultra-low latency
- Widely adopted in live/fixed installations
```

---

## 14. Loudness and Volume Management

### The Concept of Loudness

```
Types of volume:

1. Peak Level:
   - Maximum waveform amplitude
   - Measured in dBFS
   - Reference for clipping prevention

2. RMS (Root Mean Square) Level:
   - Effective value (average volume)
   - Lower than peak
   - Closer to perceived loudness

3. LUFS (Loudness Units Full Scale):
   - Volume measurement based on human hearing characteristics
   - ITU-R BS.1770 standard
   - Time-weighted: Momentary (400ms), Short-term (3s), Integrated (overall)
   - Current loudness standard

4. Loudness Range (LRA):
   - Range of volume variation within a track
   - Displayed in LU (Loudness Units)
```

### Loudness Standards by Distribution Platform

```
Target loudness by platform:

| Platform | Target LUFS | True Peak Limit | Notes |
|----------|------------|-----------------|-------|
| Spotify | -14 LUFS | -1 dBTP | Normalization |
| Apple Music | -16 LUFS | -1 dBTP | Sound Check |
| YouTube | -14 LUFS | -1 dBTP | Volume adjustment applied |
| Tidal | -14 LUFS | -1 dBTP | Normalization |
| Amazon Music | -14 LUFS | -2 dBTP | Volume adjustment applied |
| Club/DJ | -6 to -9 LUFS | -0.3 dBTP | Genre-dependent |

Notes:
- On platforms with loudness normalization,
  pushing the volume too loud will result in gain reduction
- Conversely, dynamic tracks will have gain increased
- As a result, tracks with more dynamics can sound richer

DJ-specific notes:
- Club/DJ tracks are typically -6 to -9 LUFS
- Streaming versions and DJ versions may differ in loudness
- Use Rekordbox auto gain with caution
```

---

## 15. Practice Exercises

### Beginner

```
1. Check your file formats:
   - Organize your source library
   - Check formats and bitrates
   - Check spectrograms with Spek
   - Identify low-quality files (128kbps or below)

2. Unify sample rates:
   - Rekordbox: set to 48kHz
   - Check all sources (no mix of rates)
   - If resampling is needed, convert in a DAW

3. Handle low-quality files:
   - Identify MP3 files at 128kbps or below
   - Re-purchase higher quality versions if possible
   - Get WAV versions from Beatport/Bandcamp
   - Re-rip from CD
```

### Intermediate

```
1. Audio quality comparison test:
   - A/B test WAV vs MP3 320kbps
   - Verify statistically with foobar2000 ABX Comparator
   - Understand the limits of your own hearing
   - Check differences across environments (headphones vs speakers)

2. Optimize Rekordbox settings:
   - Adjust buffer size (low latency vs stability)
   - Set analysis quality to "High"
   - Test auto gain (on/off)
   - Configure waveform display colors

3. Adopt FLAC:
   - Convert WAV library to FLAC (save storage)
   - Batch convert with dBpoweramp / XLD (Mac)
   - Test playback in Rekordbox
   - Test USB playback on CDJs

4. Use spectrum analyzers:
   - Install Voxengo SPAN (free plugin) in your DAW
   - Check frequency distribution of tracks
   - Learn the characteristics of each genre
```

### Advanced

```
1. Create mastered sources:
   - Export in 24bit WAV
   - Check with True Peak meter (-1 dBTP or below)
   - Check with LUFS meter (target values)
   - Export in multiple formats and compare

2. Understand and practice dithering:
   - Compare with and without dithering
   - Listen to TPDF vs noise-shaped dithering
   - Compare 16bit + dithering vs 24bit
   - Proper placement in the mastering chain

3. High-resolution production:
   - Create a project at 96kHz
   - Check changes in CPU load
   - Check plugin compatibility
   - Blind test against 48kHz version
   - Verify oversampling effects

4. Optimize digital connections:
   - Practice S/PDIF / AES/EBU connections
   - Configure clock synchronization
   - Compare with analog connections
   - Test cable quality impact

5. Audio degradation detection training:
   - Intentionally create clipping and listen
   - Confirm the sound of aliasing
   - Simulate the impact of jitter
   - Experience quantization distortion at low bit depths
```

---

## 16. Troubleshooting

### Common Problems and Solutions

```
- Problem: No sound
  Causes:
  1. Audio device not correctly selected
  2. Driver not installed
  3. Sample rate mismatch
  4. Channel routing misconfiguration

  Solutions:
  1. Reselect the device in audio settings
  2. Install the latest driver from the manufacturer's site
  3. Unify all devices to the same sample rate (48kHz)
  4. Check output channel assignments

- Problem: Audio dropouts
  Causes:
  1. Buffer size too small
  2. High CPU load
  3. Insufficient USB bus bandwidth
  4. Background process interference

  Solutions:
  1. Increase buffer size (512 -> 1024)
  2. Disable/freeze unnecessary plugins
  3. Use USB 3.0 ports, avoid hubs
  4. Disable Wi-Fi, Bluetooth, antivirus software

- Problem: Noise in the audio
  Causes:
  1. Ground loop
  2. Electromagnetic interference (EMI)
  3. Cable degradation
  4. Buffer underrun

  Solutions:
  1. Connect all devices to the same power strip
  2. Separate audio cables from power cables
  3. Replace cables, use balanced connections
  4. Increase buffer size

- Problem: Left/right volume imbalance
  Causes:
  1. Pan setting issue
  2. Loose cable connection
  3. Interface input gain settings

  Solutions:
  1. Check pan settings in mixer/DAW
  2. Replace cables and test
  3. Match input gain for left and right

- Problem: Low quality recorded files
  Causes:
  1. Sample rate set too low
  2. Bit depth set to 8bit or 16bit
  3. Input level too low
  4. Saved in an inappropriate format

  Solutions:
  1. Set to 48kHz or higher
  2. Record at 24bit or higher
  3. Adjust input level to -12dB to -6dB
  4. Save as WAV/AIFF 24bit
```

---

## 17. The Future of Digital Audio

### New Technology Trends

```
1. Immersive Audio / Spatial Audio:
   - Dolby Atmos Music
   - Sony 360 Reality Audio
   - Apple Spatial Audio
   - Binaural rendering
   - Object-based audio
   - Potential for Atmos mixes in DJ sets

2. AI-Based Audio Processing:
   - Stem separation (vocal/instrument isolation)
   - Noise removal
   - AI mastering (LANDR, iZotope, etc.)
   - Automatic mixing
   - Upsampling (estimating high quality from low quality)

3. Growth of Lossless Streaming:
   - Apple Music Lossless
   - Amazon Music HD
   - Tidal HiFi
   - Spotify HiFi (planned)
   - Improving network bandwidth

4. MQA (Master Quality Authenticated):
   - "Origami" technology for efficient hi-res compression
   - Authenticated (guarantees original studio master quality)
   - Controversial (is it truly lossless?)
   - Adopted by Tidal HiFi Plus

5. Next-Generation Codecs:
   - AV1 Audio (positioned as Opus 2.0)
   - MPEG-H 3D Audio
   - LC3/LC3plus (Bluetooth LE Audio)
   - High quality at low bitrates

6. Head Tracking and Spatial Audio:
   - AirPods Pro / Max spatial audio
   - Sound field that follows head movement
   - Spatial audio distribution of DJ performances
   - Audio experiences in VR/AR
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

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
        """Main logic for data processing"""
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

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
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
        """Remove by key"""
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

    print(f"Inefficient version: {slow_time:.4f} sec")
    print(f"Efficient version:   {fast_time:.6f} sec")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be conscious of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for technology choices.

| Criteria | When to prioritize | When compromise is acceptable |
|----------|-------------------|-------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
+--------------------------------------------------+
|          Architecture Selection Flow              |
+--------------------------------------------------+
|                                                   |
|  1. Team size?                                    |
|    +-- Small (1-5 people) -> Monolith             |
|    +-- Large (10+ people) -> Go to 2              |
|                                                   |
|  2. Deployment frequency?                         |
|    +-- Weekly or less -> Monolith + module split   |
|    +-- Daily/multiple times -> Go to 3            |
|                                                   |
|  3. Inter-team independence?                      |
|    +-- High -> Microservices                      |
|    +-- Moderate -> Modular monolith               |
|                                                   |
+--------------------------------------------------+
```

### Tradeoff Analysis

Technical decisions always involve tradeoffs. Analyze from the following perspectives:

**1. Short-term vs Long-term Costs**
- A short-term fast approach may become technical debt long-term
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables best-fit solutions but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging difficult
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
        """Describe the background and challenges"""
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
            icon = "+" if c['type'] == 'positive' else "!"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What common mistakes do beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in daily development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

### Key Points Overview

```
- Sample Rate:
  - DJ: 48kHz (CDJ/club standard)
  - Production: 48kHz (basic) / 96kHz (high quality)
  - Distribution: 44.1kHz / 48kHz

- Bit Depth:
  - Recording: 24bit
  - DAW internal: 32bit float
  - Distribution: 16bit (CD quality) / 24bit (hi-res)
  - Apply dithering when reducing bit depth

- Format:
  - Highest quality: WAV / AIFF (uncompressed)
  - Storage saving: FLAC (lossless, no quality loss)
  - Compatibility: MP3 320kbps (lossy but practical)
  - Avoid: MP3 128kbps or below

- Settings:
  - Configure properly in Rekordbox/Ableton
  - Buffer size balances latency and stability
  - Always ensure headroom during recording

- Audio Quality Management:
  - Obtain sources from trustworthy outlets
  - Check quality with spectrograms
  - Understand loudness standards
  - Train your ears with A/B testing
```

**Next Step:** Proceed to [Frequency and Spectrum](./frequency-spectrum.md)

---


## Recommended Next Guides

- [Frequency and Spectrum](./frequency-spectrum.md) - Proceed to the next topic

---

## Reference Links

- [Frequency Spectrum](./frequency-spectrum.md)
- [EQ Operation](../dj/03-basic-techniques/eq-operation.md)
- Mastering
- [Rhythm Basics](./rhythm-basics.md)
- [Music Theory](./music-theory.md)
- [Harmony Basics](./harmony-basics.md)
