# MIDI x AI — Automatic Composition, Arrangement, and Chord Progression Generation

> A guide to MIDI music production techniques and practices using AI, including automatic composition, chord progression generation, and arrangement

## What You Will Learn in This Chapter

1. MIDI data fundamentals and data representation for AI processing
2. Major methods and models for AI automatic composition and chord progression generation
3. DAW integration and incorporation into production workflows
4. Implementation of melody generation, bassline generation, and drum pattern generation
5. MIDI data preprocessing and postprocessing techniques
6. Building AI composition pipelines for practical use


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Audio Effects — AI EQ, Noise Removal, Mastering](./02-audio-effects.md)

---

## 1. MIDI Fundamentals

### 1.1 MIDI Data Structure

```
MIDI Message Structure
==================================================

Basic unit of a MIDI event:
┌──────────┬──────────┬──────────┬──────────┐
│  Delta   │ Status   │  Data 1  │  Data 2  │
│  Time    │  Byte    │  (Note)  │(Velocity)│
│(time diff)│(msg type)│ (0-127) │ (0-127)  │
└──────────┴──────────┴──────────┴──────────┘

Note On:  0x90 | channel, note_number, velocity
Note Off: 0x80 | channel, note_number, velocity

Piano Roll Representation:
  MIDI Note Number
  ↑
  72│        ■■■■
  71│
  69│  ■■■■■■■■          ■■■■
  67│          ■■■■■■
  65│
  64│■■■■■■
  60│                ■■■■■■■■■■
    └──────────────────────────→ Time (ticks)

Note Number to Pitch Name Mapping:
  C4=60, D4=62, E4=64, F4=65
  G4=67, A4=69, B4=71, C5=72
==================================================
```

### 1.2 MIDI File Format Details

```
MIDI File Structure:
==================================================

SMF (Standard MIDI File) Format:

■ Format 0: All tracks merged into a single track
  ┌────────────┬────────────────────────┐
  │ Header     │ Track 0                │
  │ MThd       │ (all channel data)     │
  └────────────┴────────────────────────┘

■ Format 1: Multi-track (synchronized playback)
  ┌────────────┬──────────┬──────────┬──────────┐
  │ Header     │ Track 0  │ Track 1  │ Track 2  │
  │ MThd       │(tempo etc)│(melody) │ (bass)   │
  └────────────┴──────────┴──────────┴──────────┘

■ Format 2: Multi-track (independent playback, rarely used)

Header Chunk (MThd):
  4D 54 68 64  = "MThd"
  00 00 00 06  = Chunk size (always 6)
  00 01        = Format (0/1/2)
  00 03        = Number of tracks
  01 E0        = Resolution (480 ticks/beat)

Track Chunk (MTrk):
  4D 54 72 6B  = "MTrk"
  xx xx xx xx  = Chunk size
  [Event data...]

MIDI Channel Message List:
  0x80-0x8F  Note Off          (2 data bytes)
  0x90-0x9F  Note On           (2 data bytes)
  0xA0-0xAF  Polyphonic Aftertouch (2 data bytes)
  0xB0-0xBF  Control Change    (2 data bytes)
  0xC0-0xCF  Program Change    (1 data byte)
  0xD0-0xDF  Channel Aftertouch (1 data byte)
  0xE0-0xEF  Pitch Bend        (2 data bytes)

Major Control Change Numbers:
  CC#1   = Modulation
  CC#7   = Volume
  CC#10  = Pan
  CC#11  = Expression
  CC#64  = Sustain Pedal
  CC#91  = Reverb
  CC#93  = Chorus
==================================================
```

### 1.3 Programming MIDI Data

```python
import mido
from mido import MidiFile, MidiTrack, Message, MetaMessage

def create_chord_progression():
    """Generate a chord progression in MIDI"""
    mid = MidiFile(ticks_per_beat=480)
    track = MidiTrack()
    mid.tracks.append(track)

    # Tempo setting (BPM 120)
    track.append(MetaMessage('set_tempo', tempo=mido.bpm2tempo(120)))

    # C-Am-F-G chord progression
    chords = [
        {"name": "C",  "notes": [60, 64, 67], "duration": 480 * 2},  # 2 beats
        {"name": "Am", "notes": [57, 60, 64], "duration": 480 * 2},
        {"name": "F",  "notes": [53, 57, 60], "duration": 480 * 2},
        {"name": "G",  "notes": [55, 59, 62], "duration": 480 * 2},
    ]

    for chord in chords:
        # Note On (all notes simultaneously)
        for i, note in enumerate(chord["notes"]):
            track.append(Message('note_on', note=note, velocity=80, time=0))

        # Note Off (after duration)
        for i, note in enumerate(chord["notes"]):
            time = chord["duration"] if i == 0 else 0
            track.append(Message('note_off', note=note, velocity=0, time=time))

    mid.save('chord_progression.mid')
    return mid

# MIDI -> Token sequence (for AI input)
def midi_to_tokens(midi_file: str) -> list:
    """Convert MIDI to a token sequence for AI processing"""
    mid = MidiFile(midi_file)
    tokens = []

    for msg in mid.tracks[0]:
        if msg.type == 'note_on' and msg.velocity > 0:
            tokens.append(f"NOTE_ON_{msg.note}")
            tokens.append(f"VELOCITY_{msg.velocity // 8}")  # Quantize to 0-15
        elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
            tokens.append(f"NOTE_OFF_{msg.note}")
        if msg.time > 0:
            # Quantize time
            time_token = min(msg.time // 120, 15)  # Quantize to 0-15
            tokens.append(f"TIME_SHIFT_{time_token}")

    return tokens
```

### 1.4 MIDI Operations with pretty_midi

```python
import pretty_midi
import numpy as np

class MIDIProcessor:
    """Advanced MIDI operations using pretty_midi"""

    def __init__(self):
        self.pm = None

    def load(self, filepath: str):
        """Load and analyze a MIDI file"""
        self.pm = pretty_midi.PrettyMIDI(filepath)
        return self.analyze()

    def analyze(self) -> dict:
        """Detailed analysis of a MIDI file"""
        info = {
            "tempo_changes": self.pm.get_tempo_changes(),
            "time_signatures": [],
            "key_signatures": [],
            "instruments": [],
            "total_duration": self.pm.get_end_time(),
            "total_notes": 0,
        }

        for ts in self.pm.time_signature_changes:
            info["time_signatures"].append({
                "numerator": ts.numerator,
                "denominator": ts.denominator,
                "time": ts.time
            })

        for ks in self.pm.key_signature_changes:
            info["key_signatures"].append({
                "key_number": ks.key_number,
                "time": ks.time
            })

        for inst in self.pm.instruments:
            inst_info = {
                "name": inst.name,
                "program": inst.program,
                "is_drum": inst.is_drum,
                "note_count": len(inst.notes),
                "pitch_range": (
                    min(n.pitch for n in inst.notes) if inst.notes else 0,
                    max(n.pitch for n in inst.notes) if inst.notes else 0,
                ),
                "velocity_range": (
                    min(n.velocity for n in inst.notes) if inst.notes else 0,
                    max(n.velocity for n in inst.notes) if inst.notes else 0,
                ),
            }
            info["instruments"].append(inst_info)
            info["total_notes"] += len(inst.notes)

        return info

    def extract_piano_roll(self, fs: int = 100) -> np.ndarray:
        """Extract piano roll matrix (for AI input)"""
        # shape: (128, time_steps)
        piano_roll = self.pm.get_piano_roll(fs=fs)
        return piano_roll

    def extract_chroma(self, fs: int = 100) -> np.ndarray:
        """Extract chromagram (for chord detection)"""
        # shape: (12, time_steps)
        chroma = self.pm.get_chroma(fs=fs)
        return chroma

    def transpose(self, semitones: int) -> pretty_midi.PrettyMIDI:
        """Transpose the entire piece"""
        for inst in self.pm.instruments:
            for note in inst.notes:
                note.pitch = max(0, min(127, note.pitch + semitones))
        return self.pm

    def change_tempo(self, factor: float) -> pretty_midi.PrettyMIDI:
        """Change tempo (factor=2.0 for double speed)"""
        for inst in self.pm.instruments:
            for note in inst.notes:
                note.start /= factor
                note.end /= factor
        return self.pm

    def split_by_instrument(self) -> dict:
        """Split MIDI by instrument"""
        result = {}
        for inst in self.pm.instruments:
            new_midi = pretty_midi.PrettyMIDI()
            new_inst = pretty_midi.Instrument(
                program=inst.program,
                is_drum=inst.is_drum,
                name=inst.name
            )
            new_inst.notes = inst.notes.copy()
            new_midi.instruments.append(new_inst)
            result[inst.name] = new_midi
        return result

    def merge_midis(self, midi_files: list) -> pretty_midi.PrettyMIDI:
        """Merge multiple MIDI files"""
        merged = pretty_midi.PrettyMIDI()
        for filepath in midi_files:
            pm = pretty_midi.PrettyMIDI(filepath)
            for inst in pm.instruments:
                merged.instruments.append(inst)
        return merged

    def quantize_notes(self, grid_size: float = 0.125,
                       strength: float = 0.8):
        """Quantize notes (in grid_size second units)"""
        for inst in self.pm.instruments:
            for note in inst.notes:
                nearest_start = round(note.start / grid_size) * grid_size
                nearest_end = round(note.end / grid_size) * grid_size
                note.start += (nearest_start - note.start) * strength
                note.end += (nearest_end - note.end) * strength
                # Guarantee minimum duration
                if note.end - note.start < grid_size * 0.5:
                    note.end = note.start + grid_size * 0.5
        return self.pm

    def extract_melody(self, track_index: int = 0) -> list:
        """Extract melody (highest notes) from the specified track"""
        inst = self.pm.instruments[track_index]
        # Sort by time
        sorted_notes = sorted(inst.notes, key=lambda n: n.start)

        # Keep only the highest note among overlapping notes
        melody = []
        current_time = -1
        for note in sorted_notes:
            if abs(note.start - current_time) < 0.01:
                if note.pitch > melody[-1].pitch:
                    melody[-1] = note
            else:
                melody.append(note)
                current_time = note.start

        return melody
```

### 1.5 Numerical Representation of MIDI Data and AI Preprocessing

```python
import numpy as np
from typing import List, Tuple

class MIDIFeatureExtractor:
    """MIDI feature extraction (for AI training data preprocessing)"""

    def __init__(self, resolution: int = 480):
        self.resolution = resolution  # ticks per beat

    def notes_to_matrix(self, notes: list,
                        duration_beats: int = 32) -> np.ndarray:
        """Convert a note list to matrix representation

        Output: (128, time_steps) matrix
        - Rows: MIDI note numbers (0-127)
        - Columns: Time steps (in 16th note units)
        - Values: Velocity (0-127)
        """
        steps_per_beat = 4  # 16th notes
        total_steps = duration_beats * steps_per_beat
        matrix = np.zeros((128, total_steps), dtype=np.float32)

        for note in notes:
            start_step = int(note["start"] * steps_per_beat)
            end_step = int(note["end"] * steps_per_beat)
            pitch = note["pitch"]
            velocity = note["velocity"]

            if 0 <= pitch <= 127:
                start_step = max(0, min(start_step, total_steps - 1))
                end_step = max(start_step + 1, min(end_step, total_steps))
                matrix[pitch, start_step:end_step] = velocity / 127.0

        return matrix

    def matrix_to_notes(self, matrix: np.ndarray,
                        threshold: float = 0.1) -> list:
        """Restore note list from matrix representation"""
        notes = []
        steps_per_beat = 4

        for pitch in range(128):
            in_note = False
            start = 0
            for step in range(matrix.shape[1]):
                if matrix[pitch, step] > threshold and not in_note:
                    in_note = True
                    start = step
                elif (matrix[pitch, step] <= threshold or
                      step == matrix.shape[1] - 1) and in_note:
                    in_note = False
                    velocity = int(np.max(
                        matrix[pitch, start:step + 1]) * 127)
                    notes.append({
                        "pitch": pitch,
                        "start": start / steps_per_beat,
                        "end": step / steps_per_beat,
                        "velocity": velocity,
                    })

        return sorted(notes, key=lambda n: n["start"])

    def extract_rhythm_pattern(self, notes: list,
                                beats: int = 4) -> np.ndarray:
        """Extract rhythm pattern (16th note grid)"""
        steps = beats * 4
        pattern = np.zeros(steps, dtype=np.float32)

        for note in notes:
            step = int(note["start"] * 4) % steps
            pattern[step] = max(pattern[step],
                                note["velocity"] / 127.0)

        return pattern

    def compute_pitch_histogram(self, notes: list) -> np.ndarray:
        """Pitch class histogram (12 dimensions, for chord detection)"""
        histogram = np.zeros(12, dtype=np.float32)
        for note in notes:
            pitch_class = note["pitch"] % 12
            duration = note["end"] - note["start"]
            histogram[pitch_class] += duration

        # Normalize
        total = np.sum(histogram)
        if total > 0:
            histogram /= total

        return histogram

    def compute_interval_histogram(self, notes: list) -> np.ndarray:
        """Interval histogram (melody features)"""
        sorted_notes = sorted(notes, key=lambda n: n["start"])
        intervals = np.zeros(25, dtype=np.float32)  # -12 to +12

        for i in range(1, len(sorted_notes)):
            interval = sorted_notes[i]["pitch"] - sorted_notes[i-1]["pitch"]
            interval = max(-12, min(12, interval))
            intervals[interval + 12] += 1

        total = np.sum(intervals)
        if total > 0:
            intervals /= total
        return intervals

    def compute_velocity_statistics(self, notes: list) -> dict:
        """Velocity statistics"""
        velocities = [n["velocity"] for n in notes]
        if not velocities:
            return {"mean": 0, "std": 0, "min": 0, "max": 0}
        return {
            "mean": np.mean(velocities),
            "std": np.std(velocities),
            "min": np.min(velocities),
            "max": np.max(velocities),
        }

    def compute_note_density(self, notes: list,
                              window_beats: float = 1.0) -> list:
        """Note density time series (per beat)"""
        if not notes:
            return []
        max_time = max(n["end"] for n in notes)
        windows = int(np.ceil(max_time / window_beats))
        density = []

        for w in range(windows):
            start = w * window_beats
            end = (w + 1) * window_beats
            count = sum(1 for n in notes
                        if n["start"] < end and n["end"] > start)
            density.append(count)

        return density
```

---

## 2. AI Automatic Composition

### 2.1 MIDI Tokenizer

```python
# MidiTok: A tokenizer library dedicated to MIDI

from miditok import REMI, TokenizerConfig
from pathlib import Path

# Tokenizer configuration
config = TokenizerConfig(
    num_velocities=32,      # Number of velocity quantization levels
    use_chords=True,        # Enable chord detection
    use_tempos=True,        # Include tempo changes
    use_time_signatures=True,
    nb_tempos=32,           # Number of tempo quantization levels
    tempo_range=(40, 250),
)

# Create REMI tokenizer
tokenizer = REMI(config)

# Tokenize a MIDI file
tokens = tokenizer("song.mid")
print(f"Token count: {len(tokens.ids)}")
print(f"First 10 tokens: {tokens.tokens[:10]}")
# Example: ['Bar_None', 'Position_0', 'Chord_C:maj', 'Pitch_60', 'Velocity_80', ...]

# Reconstruct MIDI from tokens
reconstructed_midi = tokenizer.decode(tokens)
reconstructed_midi.dump_midi("reconstructed.mid")
```

### 2.2 Comparison and Implementation of Tokenization Methods

```python
from miditok import REMI, TSD, MIDILike, Structured, CPWord

class TokenizerComparison:
    """Comparison implementation of various tokenization methods"""

    def __init__(self, config: TokenizerConfig):
        self.config = config

    def compare_tokenizers(self, midi_path: str) -> dict:
        """Tokenize the same MIDI with all tokenizers and compare"""
        tokenizers = {
            "REMI": REMI(self.config),
            "TSD": TSD(self.config),
            "MIDILike": MIDILike(self.config),
            "Structured": Structured(self.config),
            "CPWord": CPWord(self.config),
        }

        results = {}
        for name, tok in tokenizers.items():
            tokens = tok(midi_path)
            results[name] = {
                "token_count": len(tokens.ids),
                "vocab_size": len(tok),
                "tokens_sample": tokens.tokens[:20],
                "description": self._get_description(name),
            }

        return results

    def _get_description(self, name: str) -> str:
        descriptions = {
            "REMI": "Position-based. Bar/Position/Pitch/Velocity/Duration. "
                    "Most intuitive and widely used.",
            "TSD": "Time Shift + Duration. Relative time representation. "
                   "Tends to produce shorter sequences.",
            "MIDILike": "Representation close to raw MIDI messages. "
                        "Explicitly represents Note On/Off.",
            "Structured": "Hierarchically represents track/bar/position. "
                          "Suited for multi-track.",
            "CPWord": "Compound Word. Compresses multiple attributes into one token. "
                      "Significantly reduces sequence length.",
        }
        return descriptions.get(name, "")


# Concrete tokenization examples
"""
REMI token sequence example (C major chord, quarter note):

  Bar_0                    <- Start of bar 0
  Position_0               <- Downbeat (position 0)
  Chord_C:maj              <- Chord detection result
  Pitch_60                 <- Note C4
  Velocity_80              <- Velocity
  Duration_2.0             <- 2 beats (quarter note x 2)
  Pitch_64                 <- Note E4
  Velocity_80
  Duration_2.0
  Pitch_67                 <- Note G4
  Velocity_80
  Duration_2.0

TSD token sequence example (same content):

  Pitch_60
  Velocity_80
  Duration_480             <- ticks
  TimeShift_0              <- Simultaneous notes
  Pitch_64
  Velocity_80
  Duration_480
  TimeShift_0
  Pitch_67
  Velocity_80
  Duration_480
  TimeShift_960            <- Time until next event
"""
```

### 2.3 Composition with Transformers

```python
# Transformer-based automatic composition model (conceptual implementation)

import torch
import torch.nn as nn

class MusicTransformer(nn.Module):
    """Transformer for MIDI automatic composition"""

    def __init__(
        self,
        vocab_size: int = 512,    # Token vocabulary size
        d_model: int = 512,
        n_heads: int = 8,
        n_layers: int = 6,
        max_seq_len: int = 2048,
    ):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = nn.Embedding(max_seq_len, d_model)

        decoder_layer = nn.TransformerDecoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=0.1,
            batch_first=True,
        )
        self.transformer = nn.TransformerDecoder(decoder_layer, n_layers)
        self.output_proj = nn.Linear(d_model, vocab_size)

    def forward(self, x):
        seq_len = x.shape[1]
        positions = torch.arange(seq_len, device=x.device)

        embeddings = self.embedding(x) + self.pos_encoding(positions)

        # Causal mask (prevent looking at future tokens)
        mask = torch.triu(torch.ones(seq_len, seq_len), diagonal=1).bool()
        mask = mask.to(x.device)

        memory = torch.zeros_like(embeddings)  # Decoder-only
        output = self.transformer(embeddings, memory, tgt_mask=mask)
        logits = self.output_proj(output)
        return logits

    def generate(self, seed_tokens, max_length=512, temperature=0.8, top_k=40):
        """Automatic composition (token generation)"""
        self.eval()
        generated = seed_tokens.clone()

        with torch.no_grad():
            for _ in range(max_length):
                logits = self.forward(generated)
                next_logits = logits[:, -1, :] / temperature

                # Top-K filtering
                top_k_logits, top_k_indices = torch.topk(next_logits, top_k)
                probs = torch.softmax(top_k_logits, dim=-1)
                idx = torch.multinomial(probs, 1)
                next_token = top_k_indices.gather(-1, idx)

                generated = torch.cat([generated, next_token], dim=1)

        return generated
```

### 2.4 Music Transformer with Relative Position Encoding

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class RelativeAttention(nn.Module):
    """Self-Attention with Relative Position Encoding

    Core technique of Music Transformer (Huang et al., 2018).
    By considering the relative distance between notes rather than
    absolute positions, it captures long-term structure (repetition, variation).
    """

    def __init__(self, d_model: int, n_heads: int,
                 max_relative_position: int = 512):
        super().__init__()
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        self.max_relative_position = max_relative_position

        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

        # Relative position embeddings
        self.relative_embeddings = nn.Embedding(
            2 * max_relative_position + 1, self.d_k
        )

    def forward(self, x, mask=None):
        batch_size, seq_len, _ = x.shape

        # Compute Q, K, V
        Q = self.W_q(x).view(batch_size, seq_len, self.n_heads, self.d_k)
        K = self.W_k(x).view(batch_size, seq_len, self.n_heads, self.d_k)
        V = self.W_v(x).view(batch_size, seq_len, self.n_heads, self.d_k)

        Q = Q.transpose(1, 2)  # (batch, heads, seq, d_k)
        K = K.transpose(1, 2)
        V = V.transpose(1, 2)

        # Content-based attention
        content_score = torch.matmul(Q, K.transpose(-2, -1))

        # Relative position-based attention
        positions = torch.arange(seq_len, device=x.device)
        relative_pos = positions.unsqueeze(0) - positions.unsqueeze(1)
        relative_pos = relative_pos.clamp(
            -self.max_relative_position,
            self.max_relative_position
        ) + self.max_relative_position

        rel_embeddings = self.relative_embeddings(relative_pos)
        position_score = torch.einsum(
            'bhqd,qkd->bhqk', Q, rel_embeddings
        )

        # Combined score
        scores = (content_score + position_score) / math.sqrt(self.d_k)

        if mask is not None:
            scores = scores.masked_fill(mask.unsqueeze(1), float('-inf'))

        attn_weights = F.softmax(scores, dim=-1)
        output = torch.matmul(attn_weights, V)

        output = output.transpose(1, 2).contiguous()
        output = output.view(batch_size, seq_len, self.d_model)
        return self.W_o(output)


class MusicTransformerV2(nn.Module):
    """Music Transformer with Relative Position Encoding"""

    def __init__(self, vocab_size=512, d_model=512,
                 n_heads=8, n_layers=6, max_seq_len=2048):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.layers = nn.ModuleList([
            nn.ModuleDict({
                'attention': RelativeAttention(d_model, n_heads),
                'norm1': nn.LayerNorm(d_model),
                'ffn': nn.Sequential(
                    nn.Linear(d_model, d_model * 4),
                    nn.GELU(),
                    nn.Dropout(0.1),
                    nn.Linear(d_model * 4, d_model),
                    nn.Dropout(0.1),
                ),
                'norm2': nn.LayerNorm(d_model),
            })
            for _ in range(n_layers)
        ])
        self.output_proj = nn.Linear(d_model, vocab_size)

    def forward(self, x):
        seq_len = x.shape[1]
        h = self.embedding(x)

        # Causal mask
        mask = torch.triu(
            torch.ones(seq_len, seq_len, device=x.device),
            diagonal=1
        ).bool()

        for layer in self.layers:
            # Self-Attention with relative position
            h_norm = layer'norm1'
            h = h + layer'attention'
            # Feed-Forward
            h_norm = layer'norm2'
            h = h + layer'ffn'

        return self.output_proj(h)
```

### 2.5 Training Pipeline

```python
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path

class MIDIDataset(Dataset):
    """MIDI token dataset"""

    def __init__(self, data_dir: str, tokenizer, max_seq_len: int = 1024):
        self.tokenizer = tokenizer
        self.max_seq_len = max_seq_len
        self.sequences = []

        midi_files = list(Path(data_dir).glob("**/*.mid")) + \
                     list(Path(data_dir).glob("**/*.midi"))

        for midi_file in midi_files:
            try:
                tokens = tokenizer(str(midi_file))
                ids = tokens.ids
                # Split into fixed-length sequences
                for i in range(0, len(ids) - max_seq_len, max_seq_len // 2):
                    seq = ids[i:i + max_seq_len + 1]
                    if len(seq) == max_seq_len + 1:
                        self.sequences.append(seq)
            except Exception as e:
                print(f"Skipped: {midi_file} - {e}")

        print(f"Loading complete: {len(self.sequences)} sequences "
              f"({len(midi_files)} MIDI files)")

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        seq = self.sequences[idx]
        x = torch.tensor(seq[:-1], dtype=torch.long)
        y = torch.tensor(seq[1:], dtype=torch.long)
        return x, y


class MusicTrainer:
    """Music Transformer training"""

    def __init__(self, model, tokenizer, device="cuda"):
        self.model = model.to(device)
        self.tokenizer = tokenizer
        self.device = device
        self.optimizer = torch.optim.AdamW(
            model.parameters(), lr=1e-4, weight_decay=0.01
        )
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=100, eta_min=1e-6
        )
        self.criterion = nn.CrossEntropyLoss()

    def train_epoch(self, dataloader: DataLoader) -> float:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0
        total_batches = 0

        for batch_idx, (x, y) in enumerate(dataloader):
            x = x.to(self.device)
            y = y.to(self.device)

            logits = self.model(x)
            loss = self.criterion(
                logits.view(-1, logits.size(-1)),
                y.view(-1)
            )

            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                self.model.parameters(), max_norm=1.0
            )
            self.optimizer.step()

            total_loss += loss.item()
            total_batches += 1

            if batch_idx % 100 == 0:
                avg_loss = total_loss / total_batches
                print(f"  Batch {batch_idx}: loss={avg_loss:.4f}")

        self.scheduler.step()
        return total_loss / total_batches

    def train(self, data_dir: str, epochs: int = 50,
              batch_size: int = 16, save_dir: str = "checkpoints"):
        """Training loop"""
        dataset = MIDIDataset(data_dir, self.tokenizer)
        dataloader = DataLoader(
            dataset, batch_size=batch_size,
            shuffle=True, num_workers=4
        )

        Path(save_dir).mkdir(exist_ok=True)
        best_loss = float("inf")

        for epoch in range(epochs):
            avg_loss = self.train_epoch(dataloader)
            print(f"Epoch {epoch+1}/{epochs}: loss={avg_loss:.4f}")

            if avg_loss < best_loss:
                best_loss = avg_loss
                torch.save(
                    self.model.state_dict(),
                    f"{save_dir}/best_model.pt"
                )
                print(f"  Best model saved (loss={best_loss:.4f})")

            # Periodically generate samples
            if (epoch + 1) % 10 == 0:
                self._generate_sample(epoch + 1, save_dir)

    def _generate_sample(self, epoch: int, save_dir: str):
        """Generate samples during training"""
        self.model.eval()
        seed = torch.randint(0, 100, (1, 16)).to(self.device)
        with torch.no_grad():
            generated = self.model.generate(
                seed, max_length=256,
                temperature=0.9, top_k=50
            )
        tokens_list = generated[0].cpu().tolist()
        midi = self.tokenizer.decode(tokens_list)
        midi.dump_midi(f"{save_dir}/sample_epoch{epoch}.mid")
        print(f"  Sample generated: sample_epoch{epoch}.mid")
```

### 2.6 Chord Progression Generation

```python
import random

class ChordProgressionGenerator:
    """Chord progression generation based on music theory + AI"""

    # Diatonic chords (C major)
    DIATONIC_CHORDS = {
        "I":   {"root": "C",  "type": "maj", "notes": [0, 4, 7]},
        "ii":  {"root": "Dm", "type": "min", "notes": [2, 5, 9]},
        "iii": {"root": "Em", "type": "min", "notes": [4, 7, 11]},
        "IV":  {"root": "F",  "type": "maj", "notes": [5, 9, 0]},
        "V":   {"root": "G",  "type": "maj", "notes": [7, 11, 2]},
        "vi":  {"root": "Am", "type": "min", "notes": [9, 0, 4]},
        "vii": {"root": "Bdim","type": "dim", "notes": [11, 2, 5]},
    }

    # Common chord progression patterns
    COMMON_PROGRESSIONS = {
        "Pop Standard":       ["I", "V", "vi", "IV"],
        "Canon Progression":  ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
        "Komuro Progression": ["vi", "IV", "V", "I"],
        "Classic Ballad":     ["I", "vi", "IV", "V"],
        "Jazz Standard":      ["ii", "V", "I", "I"],
        "Blues":              ["I", "I", "IV", "I", "V", "IV", "I", "V"],
        "Reverse Cycle":      ["I", "vi", "ii", "V"],
        "Radiohead":          ["I", "iii", "vi", "IV"],
        "Neo Soul":           ["ii", "V", "I", "vi"],
        "Bossa Nova":         ["I", "vi", "ii", "V"],
    }

    # Tension chord definitions
    TENSION_CHORDS = {
        "Imaj7":   {"notes": [0, 4, 7, 11]},
        "ii7":     {"notes": [2, 5, 9, 0]},
        "iii7":    {"notes": [4, 7, 11, 2]},
        "IVmaj7":  {"notes": [5, 9, 0, 4]},
        "V7":      {"notes": [7, 11, 2, 5]},
        "vi7":     {"notes": [9, 0, 4, 7]},
        "Vaug":    {"notes": [7, 11, 3]},
        "bVII":    {"notes": [10, 2, 5]},
        "IV#dim":  {"notes": [6, 9, 0]},
    }

    def generate(self, style: str = "Pop Standard", key: str = "C",
                 bars: int = 8, use_tensions: bool = False) -> list:
        """Generate a chord progression"""
        base_progression = self.COMMON_PROGRESSIONS.get(style)
        if not base_progression:
            base_progression = random.choice(
                list(self.COMMON_PROGRESSIONS.values()))

        # Repeat or generate variations to match the number of bars
        progression = []
        while len(progression) < bars:
            progression.extend(base_progression)
        progression = progression[:bars]

        # Add tensions
        if use_tensions:
            progression = self._add_tensions(progression)

        # Key transposition
        transposed = self._transpose(progression, key)
        return transposed

    def _add_tensions(self, progression: list) -> list:
        """Probabilistically add tension chords"""
        tension_map = {
            "I": "Imaj7", "ii": "ii7", "iii": "iii7",
            "IV": "IVmaj7", "V": "V7", "vi": "vi7",
        }
        result = []
        for chord in progression:
            if chord in tension_map and random.random() < 0.5:
                result.append(tension_map[chord])
            else:
                result.append(chord)
        return result

    def _transpose(self, progression, target_key):
        """Key transposition"""
        key_offsets = {
            "C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
            "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
        }
        offset = key_offsets.get(target_key, 0)
        return [(chord, offset) for chord in progression]

    def generate_with_markov(self, length: int = 8,
                              start: str = "I") -> list:
        """Generate chord progression using Markov chain"""
        # Transition probability matrix (based on music theory)
        transitions = {
            "I":   {"ii": 0.15, "iii": 0.05, "IV": 0.30,
                    "V": 0.30, "vi": 0.15, "vii": 0.05},
            "ii":  {"V": 0.50, "vii": 0.10, "I": 0.10,
                    "iii": 0.10, "IV": 0.10, "vi": 0.10},
            "iii": {"vi": 0.30, "IV": 0.30, "ii": 0.20,
                    "I": 0.10, "V": 0.10},
            "IV":  {"V": 0.35, "I": 0.25, "ii": 0.15,
                    "vi": 0.15, "vii": 0.10},
            "V":   {"I": 0.50, "vi": 0.25, "IV": 0.10,
                    "iii": 0.10, "ii": 0.05},
            "vi":  {"IV": 0.30, "ii": 0.25, "V": 0.20,
                    "I": 0.15, "iii": 0.10},
            "vii": {"I": 0.50, "iii": 0.20, "vi": 0.15,
                    "IV": 0.10, "V": 0.05},
        }

        progression = [start]
        current = start

        for _ in range(length - 1):
            probs = transitions[current]
            chords = list(probs.keys())
            weights = list(probs.values())
            next_chord = random.choices(chords, weights=weights, k=1)[0]
            progression.append(next_chord)
            current = next_chord

        return progression

    def to_midi(self, progression: list, key: str = "C",
                bpm: int = 120, beats_per_chord: int = 4) -> 'MidiFile':
        """Convert chord progression to MIDI"""
        from mido import MidiFile, MidiTrack, Message, MetaMessage
        import mido

        key_offsets = {
            "C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
            "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
        }
        offset = key_offsets.get(key, 0)
        ticks_per_beat = 480

        mid = MidiFile(ticks_per_beat=ticks_per_beat)
        track = MidiTrack()
        mid.tracks.append(track)
        track.append(MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))

        for chord_name in progression:
            if chord_name in self.DIATONIC_CHORDS:
                chord_data = self.DIATONIC_CHORDS[chord_name]
            elif chord_name in self.TENSION_CHORDS:
                chord_data = self.TENSION_CHORDS[chord_name]
            else:
                continue

            notes = [(n + offset) % 12 + 60 for n in chord_data["notes"]]
            duration = ticks_per_beat * beats_per_chord

            for i, note in enumerate(notes):
                track.append(Message(
                    'note_on', note=note, velocity=80, time=0
                ))

            for i, note in enumerate(notes):
                time = duration if i == 0 else 0
                track.append(Message(
                    'note_off', note=note, velocity=0, time=time
                ))

        return mid


# Usage example
gen = ChordProgressionGenerator()

# Pattern-based generation
chords = gen.generate(style="Komuro Progression", key="A", bars=8)
print(f"Pattern generation: {chords}")

# Markov chain generation
markov_chords = gen.generate_with_markov(length=8, start="I")
print(f"Markov generation: {markov_chords}")
```

---

## 3. Melody Generation

### 3.1 Conditional Melody Generation

```python
import numpy as np
import random

class MelodyGenerator:
    """Melody generation based on chord progressions"""

    SCALES = {
        "major":      [0, 2, 4, 5, 7, 9, 11],
        "minor":      [0, 2, 3, 5, 7, 8, 10],
        "dorian":     [0, 2, 3, 5, 7, 9, 10],
        "mixolydian": [0, 2, 4, 5, 7, 9, 10],
        "pentatonic": [0, 2, 4, 7, 9],
        "blues":      [0, 3, 5, 6, 7, 10],
    }

    # Chord tone weight (prioritize chord tones)
    CHORD_TONE_WEIGHT = 0.6
    SCALE_TONE_WEIGHT = 0.3
    PASSING_TONE_WEIGHT = 0.1

    def __init__(self, key: str = "C", scale: str = "major",
                 octave_range: tuple = (4, 6)):
        self.key = key
        self.scale = scale
        self.octave_range = octave_range
        self.key_offset = {
            "C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
            "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
        }.get(key, 0)

    def generate(self, chord_progression: list,
                 notes_per_chord: int = 8,
                 style: str = "stepwise") -> list:
        """Generate melody following a chord progression"""
        melody = []
        prev_pitch = 60 + self.key_offset  # Starting note

        for chord in chord_progression:
            chord_notes = self._get_chord_tones(chord)
            scale_notes = self._get_available_notes()

            for i in range(notes_per_chord):
                if style == "stepwise":
                    pitch = self._stepwise_motion(
                        prev_pitch, chord_notes, scale_notes
                    )
                elif style == "arpeggiated":
                    pitch = self._arpeggio_motion(
                        prev_pitch, chord_notes, i
                    )
                elif style == "mixed":
                    if random.random() < 0.3:
                        pitch = self._arpeggio_motion(
                            prev_pitch, chord_notes, i
                        )
                    else:
                        pitch = self._stepwise_motion(
                            prev_pitch, chord_notes, scale_notes
                        )
                else:
                    pitch = random.choice(scale_notes)

                velocity = self._generate_velocity(i, notes_per_chord)
                duration = self._generate_duration(i, notes_per_chord)

                melody.append({
                    "pitch": pitch,
                    "velocity": velocity,
                    "duration": duration,
                    "chord": chord,
                })
                prev_pitch = pitch

        return melody

    def _stepwise_motion(self, prev_pitch: int,
                          chord_notes: list,
                          scale_notes: list) -> int:
        """Stepwise motion (adjacent note progression)"""
        # Use nearby scale notes as candidates
        candidates = []
        weights = []

        for note in scale_notes:
            distance = abs(note - prev_pitch)
            if distance <= 7:  # Within a 5th
                candidates.append(note)
                # Chord tones get higher weight
                if note % 12 in [n % 12 for n in chord_notes]:
                    weight = self.CHORD_TONE_WEIGHT
                else:
                    weight = self.SCALE_TONE_WEIGHT
                # Closer notes get higher weight
                weight *= max(0.1, 1.0 - distance / 7.0)
                weights.append(weight)

        if not candidates:
            return prev_pitch

        total = sum(weights)
        weights = [w / total for w in weights]
        return random.choices(candidates, weights=weights, k=1)[0]

    def _arpeggio_motion(self, prev_pitch: int,
                          chord_notes: list, index: int) -> int:
        """Arpeggio motion"""
        if not chord_notes:
            return prev_pitch
        target = chord_notes[index % len(chord_notes)]
        # Select the nearest octave
        best_pitch = target
        best_distance = abs(target - prev_pitch)
        for octave_shift in [-12, 0, 12]:
            candidate = target + octave_shift
            if (self.octave_range[0] * 12 <= candidate <=
                    self.octave_range[1] * 12):
                distance = abs(candidate - prev_pitch)
                if distance < best_distance:
                    best_pitch = candidate
                    best_distance = distance
        return best_pitch

    def _get_chord_tones(self, chord: str) -> list:
        """Return chord tones as MIDI note numbers"""
        chord_intervals = {
            "I": [0, 4, 7], "ii": [2, 5, 9], "iii": [4, 7, 11],
            "IV": [5, 9, 0], "V": [7, 11, 2], "vi": [9, 0, 4],
            "vii": [11, 2, 5],
        }
        intervals = chord_intervals.get(chord, [0, 4, 7])
        notes = []
        for octave in range(self.octave_range[0], self.octave_range[1] + 1):
            for interval in intervals:
                note = octave * 12 + (interval + self.key_offset) % 12
                notes.append(note)
        return notes

    def _get_available_notes(self) -> list:
        """Get available scale notes"""
        scale = self.SCALES[self.scale]
        notes = []
        for octave in range(self.octave_range[0], self.octave_range[1] + 1):
            for degree in scale:
                note = octave * 12 + (degree + self.key_offset) % 12
                notes.append(note)
        return sorted(notes)

    def _generate_velocity(self, position: int, total: int) -> int:
        """Generate velocity based on position"""
        # Downbeats are stronger, offbeats are weaker
        if position % 4 == 0:
            base = 90
        elif position % 2 == 0:
            base = 75
        else:
            base = 65
        variation = random.randint(-8, 8)
        return max(40, min(127, base + variation))

    def _generate_duration(self, position: int, total: int) -> float:
        """Generate duration based on position (in beats)"""
        durations = [0.25, 0.5, 0.5, 0.25, 0.5, 0.25, 0.5, 0.25]
        return durations[position % len(durations)]
```

### 3.2 Melody Generation with VAE (MusicVAE-style)

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MelodyVAE(nn.Module):
    """VAE-based melody generation model

    Implementation inspired by MusicVAE (Roberts et al., 2018).
    Enables melody morphing through interpolation in latent space.
    """

    def __init__(self, input_dim=128, hidden_dim=256,
                 latent_dim=64, seq_len=32):
        super().__init__()
        self.seq_len = seq_len
        self.latent_dim = latent_dim

        # Encoder (Bidirectional LSTM)
        self.encoder = nn.LSTM(
            input_dim, hidden_dim, num_layers=2,
            batch_first=True, bidirectional=True
        )
        self.fc_mu = nn.Linear(hidden_dim * 2, latent_dim)
        self.fc_logvar = nn.Linear(hidden_dim * 2, latent_dim)

        # Decoder (LSTM with teacher forcing)
        self.decoder_input = nn.Linear(latent_dim, hidden_dim)
        self.decoder = nn.LSTM(
            input_dim + hidden_dim, hidden_dim,
            num_layers=2, batch_first=True
        )
        self.output_proj = nn.Linear(hidden_dim, input_dim)

    def encode(self, x):
        """Encode input melody to latent space"""
        _, (h, _) = self.encoder(x)
        # Concatenate bidirectional final hidden states
        h = torch.cat([h[-2], h[-1]], dim=-1)
        mu = self.fc_mu(h)
        logvar = self.fc_logvar(h)
        return mu, logvar

    def reparameterize(self, mu, logvar):
        """Reparameterization trick"""
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z, target=None):
        """Reconstruct melody from latent variable"""
        batch_size = z.shape[0]
        decoder_init = self.decoder_input(z).unsqueeze(0).repeat(2, 1, 1)
        h = (decoder_init, torch.zeros_like(decoder_init))

        outputs = []
        current_input = torch.zeros(batch_size, 1, 128).to(z.device)

        for t in range(self.seq_len):
            z_expanded = z.unsqueeze(1)
            decoder_in = torch.cat([current_input, z_expanded], dim=-1)
            output, h = self.decoder(decoder_in, h)
            note_logits = self.output_proj(output)
            outputs.append(note_logits)

            if target is not None and self.training:
                current_input = target[:, t:t+1, :]
            else:
                current_input = torch.softmax(note_logits, dim=-1)

        return torch.cat(outputs, dim=1)

    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        recon = self.decode(z, target=x)
        return recon, mu, logvar

    def interpolate(self, melody_a, melody_b, steps=8):
        """Latent space interpolation between two melodies"""
        self.eval()
        with torch.no_grad():
            mu_a, _ = self.encode(melody_a.unsqueeze(0))
            mu_b, _ = self.encode(melody_b.unsqueeze(0))

            interpolated = []
            for alpha in np.linspace(0, 1, steps):
                z = mu_a * (1 - alpha) + mu_b * alpha
                melody = self.decode(z)
                interpolated.append(melody.squeeze(0))

        return interpolated

    def sample(self, n_samples=1, temperature=1.0):
        """Random sampling from latent space"""
        self.eval()
        with torch.no_grad():
            z = torch.randn(n_samples, self.latent_dim) * temperature
            melodies = self.decode(z)
        return melodies
```

---

## 4. DAW Integration

### 4.1 DAW Integration Architecture

```
AI x DAW Workflow
==================================================

┌────────────────────────────────────────┐
│              DAW (Ableton / Logic)      │
│                                        │
│  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │Track1│  │Track2│  │Track3│  ...    │
│  │Piano │  │Bass  │  │Drums │        │
│  └──┬───┘  └──┬───┘  └──┬───┘        │
│     │         │         │             │
│     └────┬────┘────┬────┘             │
│          │         │                  │
│     ┌────▼─────┐   │                  │
│     │MIDI Out  │   │                  │
│     │(VST/AU)  │   │                  │
│     └────┬─────┘   │                  │
└──────────┼─────────┼──────────────────┘
           │         │
    ┌──────▼─────────▼──────┐
    │   AI Composition Engine│
    │                       │
    │  Input: MIDI + Config  │
    │  ├─ Chord progression  │
    │  ├─ Melody generation  │
    │  ├─ Bassline generation│
    │  ├─ Drum pattern gen.  │
    │  └─ Arrangement        │
    │                       │
    │  Output: MIDI          │
    └───────────────────────┘
==================================================
```

### 4.2 Real-time Integration via Virtual MIDI Ports

```python
import mido
import time
import threading

class RealtimeMIDIBridge:
    """Real-time MIDI integration between DAW and AI engine"""

    def __init__(self, input_port_name: str = None,
                 output_port_name: str = None):
        """
        macOS: Use IAC Driver
        Windows: Use loopMIDI
        Linux: Use ALSA virtual ports
        """
        if input_port_name is None:
            available = mido.get_input_names()
            print(f"Available input ports: {available}")
            input_port_name = available[0] if available else None

        if output_port_name is None:
            available = mido.get_output_names()
            print(f"Available output ports: {available}")
            output_port_name = available[0] if available else None

        self.input_port = mido.open_input(input_port_name)
        self.output_port = mido.open_output(output_port_name)
        self.running = False
        self.note_buffer = []
        self.callback = None

    def set_callback(self, callback):
        """Set callback for MIDI input"""
        self.callback = callback

    def start(self):
        """Start real-time processing"""
        self.running = True
        self.thread = threading.Thread(target=self._listen_loop)
        self.thread.daemon = True
        self.thread.start()
        print("MIDI Bridge started")

    def stop(self):
        """Stop"""
        self.running = False
        self.thread.join()
        self.input_port.close()
        self.output_port.close()
        print("MIDI Bridge stopped")

    def _listen_loop(self):
        """MIDI message receive loop"""
        while self.running:
            for msg in self.input_port.iter_pending():
                if msg.type == 'note_on' and msg.velocity > 0:
                    self.note_buffer.append(msg)

                    # Trigger AI processing when buffer reaches threshold
                    if len(self.note_buffer) >= 4:
                        if self.callback:
                            response = self.callback(
                                self.note_buffer.copy()
                            )
                            self._send_response(response)
                        self.note_buffer.clear()

            time.sleep(0.001)  # 1ms interval

    def _send_response(self, midi_messages: list):
        """Send AI-generated results to DAW"""
        for msg in midi_messages:
            self.output_port.send(msg)

    def send_note(self, note: int, velocity: int = 80,
                  channel: int = 0, duration: float = 0.5):
        """Send a single note"""
        on = mido.Message('note_on', note=note,
                          velocity=velocity, channel=channel)
        off = mido.Message('note_off', note=note,
                           velocity=0, channel=channel)
        self.output_port.send(on)
        time.sleep(duration)
        self.output_port.send(off)

    def send_chord(self, notes: list, velocity: int = 80,
                   channel: int = 0, duration: float = 1.0):
        """Send a chord"""
        for note in notes:
            on = mido.Message('note_on', note=note,
                              velocity=velocity, channel=channel)
            self.output_port.send(on)

        time.sleep(duration)

        for note in notes:
            off = mido.Message('note_off', note=note,
                               velocity=0, channel=channel)
            self.output_port.send(off)


# Usage example: Real-time harmonization
def harmonize_callback(input_notes: list) -> list:
    """Generate harmony for input notes"""
    response = []
    for msg in input_notes:
        # Add harmonies a 3rd and 5th above
        harmony_3rd = mido.Message(
            'note_on', note=min(127, msg.note + 4),
            velocity=int(msg.velocity * 0.7), channel=1
        )
        harmony_5th = mido.Message(
            'note_on', note=min(127, msg.note + 7),
            velocity=int(msg.velocity * 0.6), channel=1
        )
        response.extend([harmony_3rd, harmony_5th])
    return response
```

### 4.3 Drum Pattern Generation

```python
import numpy as np

class DrumPatternGenerator:
    """AI drum pattern generator"""

    # General MIDI Drum Map (excerpt)
    GM_DRUMS = {
        "kick":     36,
        "snare":    38,
        "hihat_c":  42,  # Closed Hi-Hat
        "hihat_o":  46,  # Open Hi-Hat
        "crash":    49,
        "ride":     51,
        "tom_high": 48,
        "tom_mid":  45,
        "tom_low":  41,
        "clap":     39,
        "rimshot":  37,
        "cowbell":  56,
        "tambourine": 54,
        "shaker":   70,
    }

    # Basic pattern templates (16th note grid)
    PATTERNS = {
        "basic_rock": {
            "kick":    [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
            "snare":   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            "hihat_c": [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
        },
        "four_on_floor": {
            "kick":    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
            "snare":   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            "hihat_c": [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
            "hihat_o": [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
        },
        "hip_hop": {
            "kick":    [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
            "snare":   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            "hihat_c": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
        },
        "bossa_nova": {
            "kick":    [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
            "rimshot": [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0],
            "hihat_c": [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
        },
        "shuffle": {
            "kick":    [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
            "snare":   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
            "hihat_c": [1,0,1,1, 0,1,1,0, 1,1,0,1, 1,0,1,0],
        },
        "drum_and_bass": {
            "kick":    [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,0],
            "snare":   [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
            "hihat_c": [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
            "ride":    [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
        },
    }

    def generate(self, style="basic_rock", bars=4, humanize=True):
        """Generate a drum pattern"""
        base = self.PATTERNS.get(style, self.PATTERNS["basic_rock"])

        pattern = {}
        for instrument, beat in base.items():
            full_pattern = beat * bars
            if humanize:
                full_pattern = self._humanize(full_pattern)
            pattern[instrument] = full_pattern

        return pattern

    def generate_variation(self, base_style: str = "basic_rock",
                            variation_amount: float = 0.2) -> dict:
        """Add variation to a base pattern"""
        base = self.PATTERNS.get(base_style, self.PATTERNS["basic_rock"])
        varied = {}

        for instrument, beat in base.items():
            new_beat = beat.copy()
            for i in range(len(new_beat)):
                if random.random() < variation_amount:
                    new_beat[i] = 1 - new_beat[i]  # Toggle
            varied[instrument] = new_beat

        return varied

    def generate_fill(self, length_16ths: int = 16) -> dict:
        """Generate a drum fill"""
        fill = {
            "snare": [0] * length_16ths,
            "tom_high": [0] * length_16ths,
            "tom_mid": [0] * length_16ths,
            "tom_low": [0] * length_16ths,
            "crash": [0] * length_16ths,
        }

        # Fill pattern generation (gradually increase density)
        for i in range(length_16ths):
            density = (i + 1) / length_16ths
            if random.random() < density * 0.8:
                # High-to-low tom roll
                if i < length_16ths * 0.33:
                    fill["tom_high"][i] = 1
                elif i < length_16ths * 0.66:
                    fill["tom_mid"][i] = 1
                else:
                    if random.random() < 0.5:
                        fill["tom_low"][i] = 1
                    else:
                        fill["snare"][i] = 1

        # Crash at the end
        fill["crash"][-1] = 1

        return fill

    def _humanize(self, pattern, timing_var=10, velocity_var=15):
        """Add human feel (timing/velocity fluctuation)"""
        humanized = []
        for hit in pattern:
            if hit:
                velocity = max(40, min(127, 80 + np.random.randint(
                    -velocity_var, velocity_var)))
                timing_offset = np.random.randint(
                    -timing_var, timing_var)
                humanized.append({
                    "hit": True,
                    "velocity": velocity,
                    "offset": timing_offset
                })
            else:
                humanized.append({"hit": False})
        return humanized

    def to_midi(self, pattern, bpm=120, ticks_per_beat=480):
        """Convert pattern to MIDI"""
        from mido import MidiFile, MidiTrack, Message, MetaMessage
        import mido

        mid = MidiFile(ticks_per_beat=ticks_per_beat)
        track = MidiTrack()
        mid.tracks.append(track)
        track.append(MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))

        tick_per_16th = ticks_per_beat // 4

        # Sort all instrument events chronologically
        events = []
        for instrument, beats in pattern.items():
            note = self.GM_DRUMS[instrument]
            for i, beat in enumerate(beats):
                if isinstance(beat, dict) and beat["hit"]:
                    time_ticks = i * tick_per_16th + beat.get("offset", 0)
                    events.append({
                        "time": max(0, time_ticks),
                        "note": note,
                        "velocity": beat["velocity"],
                    })
                elif isinstance(beat, int) and beat == 1:
                    events.append({
                        "time": i * tick_per_16th,
                        "note": note,
                        "velocity": 80,
                    })

        events.sort(key=lambda e: e["time"])

        prev_time = 0
        for event in events:
            delta = event["time"] - prev_time
            track.append(Message(
                'note_on', note=event["note"],
                velocity=event["velocity"],
                time=max(0, delta), channel=9  # GM Drum Channel
            ))
            track.append(Message(
                'note_off', note=event["note"],
                velocity=0,
                time=tick_per_16th // 2, channel=9
            ))
            prev_time = event["time"] + tick_per_16th // 2

        return mid
```

### 4.4 Bassline Generation

```python
class BasslineGenerator:
    """Automatic bassline generation based on chord progressions"""

    STYLES = {
        "root_notes": "Root notes only (simple)",
        "walking": "Walking bass (jazz)",
        "syncopated": "Syncopation (funk)",
        "octave": "Octave playing (rock)",
        "arpeggiated": "Arpeggio (pop)",
    }

    def __init__(self, key: str = "C"):
        self.key = key
        self.key_offset = {
            "C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
            "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
        }.get(key, 0)

    def generate(self, chord_progression: list,
                 style: str = "root_notes",
                 beats_per_chord: int = 4) -> list:
        """Generate a bassline"""
        bassline = []

        for chord in chord_progression:
            root = self._get_root_note(chord)
            chord_tones = self._get_chord_tones(chord)

            if style == "root_notes":
                notes = self._root_note_pattern(
                    root, beats_per_chord)
            elif style == "walking":
                notes = self._walking_pattern(
                    root, chord_tones, beats_per_chord)
            elif style == "syncopated":
                notes = self._syncopated_pattern(
                    root, chord_tones, beats_per_chord)
            elif style == "octave":
                notes = self._octave_pattern(
                    root, beats_per_chord)
            elif style == "arpeggiated":
                notes = self._arpeggiated_pattern(
                    root, chord_tones, beats_per_chord)
            else:
                notes = self._root_note_pattern(
                    root, beats_per_chord)

            bassline.extend(notes)

        return bassline

    def _get_root_note(self, chord: str) -> int:
        """Get chord root note as MIDI note number (bass register)"""
        chord_roots = {
            "I": 0, "ii": 2, "iii": 4, "IV": 5,
            "V": 7, "vi": 9, "vii": 11,
        }
        interval = chord_roots.get(chord, 0)
        # Bass register: C2-C4 (36-60)
        return 36 + (interval + self.key_offset) % 12

    def _get_chord_tones(self, chord: str) -> list:
        """Get chord tones in bass register"""
        root = self._get_root_note(chord)
        if chord in ["I", "IV", "V"]:
            return [root, root + 4, root + 7]  # Major
        elif chord in ["ii", "iii", "vi"]:
            return [root, root + 3, root + 7]  # Minor
        else:
            return [root, root + 3, root + 6]  # Diminished

    def _root_note_pattern(self, root: int,
                            beats: int) -> list:
        """Root note pattern"""
        notes = []
        for i in range(beats * 2):  # 8th notes
            if i % 2 == 0:
                notes.append({
                    "pitch": root,
                    "velocity": 90 if i % 4 == 0 else 70,
                    "duration": 0.5,
                })
            else:
                notes.append({
                    "pitch": 0,  # Rest
                    "velocity": 0,
                    "duration": 0.5,
                })
        return notes

    def _walking_pattern(self, root: int,
                          chord_tones: list,
                          beats: int) -> list:
        """Walking bass pattern"""
        notes = []
        scale = [0, 2, 3, 5, 7, 9, 10]  # Mixolydian-like

        for i in range(beats):
            if i == 0:
                pitch = root
            elif i == beats - 1:
                # Approach note to next chord
                pitch = root + random.choice([-1, 1, -2, 2])
            else:
                degree = random.choice(scale)
                pitch = root + degree
                if pitch > root + 12:
                    pitch -= 12

            notes.append({
                "pitch": pitch,
                "velocity": 80 + random.randint(-10, 10),
                "duration": 1.0,
            })

        return notes

    def _syncopated_pattern(self, root: int,
                             chord_tones: list,
                             beats: int) -> list:
        """Syncopation pattern"""
        # 16th note grid
        grid = [0] * (beats * 4)
        # Syncopation placement
        syncopation = [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,1]

        notes = []
        for i in range(len(syncopation[:beats*4])):
            if syncopation[i]:
                ct = random.choice(chord_tones)
                notes.append({
                    "pitch": ct,
                    "velocity": 85 + random.randint(-10, 10),
                    "duration": 0.25,
                })
            else:
                notes.append({
                    "pitch": 0,
                    "velocity": 0,
                    "duration": 0.25,
                })
        return notes

    def _octave_pattern(self, root: int, beats: int) -> list:
        """Octave playing pattern"""
        notes = []
        for i in range(beats * 2):
            pitch = root if i % 2 == 0 else root + 12
            notes.append({
                "pitch": pitch,
                "velocity": 90 if i % 4 == 0 else 75,
                "duration": 0.5,
            })
        return notes

    def _arpeggiated_pattern(self, root: int,
                              chord_tones: list,
                              beats: int) -> list:
        """Arpeggio pattern"""
        notes = []
        for i in range(beats * 2):
            pitch = chord_tones[i % len(chord_tones)]
            notes.append({
                "pitch": pitch,
                "velocity": 80,
                "duration": 0.5,
            })
        return notes
```

---

## 5. AI Composition Pipeline Integration

### 5.1 End-to-End Composition System

```python
class AICompositionPipeline:
    """AI composition pipeline integration class"""

    def __init__(self, key="C", scale="major", bpm=120):
        self.key = key
        self.scale = scale
        self.bpm = bpm
        self.chord_gen = ChordProgressionGenerator()
        self.melody_gen = MelodyGenerator(key=key, scale=scale)
        self.bass_gen = BasslineGenerator(key=key)
        self.drum_gen = DrumPatternGenerator()

    def compose(self, bars: int = 16,
                chord_style: str = "Pop Standard",
                melody_style: str = "mixed",
                bass_style: str = "root_notes",
                drum_style: str = "basic_rock") -> dict:
        """Automatically generate an entire piece"""

        # 1. Generate chord progression
        chord_progression = self.chord_gen.generate(
            style=chord_style, key=self.key, bars=bars
        )
        chord_names = [c[0] for c in chord_progression]

        # 2. Generate melody
        melody = self.melody_gen.generate(
            chord_progression=chord_names,
            notes_per_chord=8,
            style=melody_style
        )

        # 3. Generate bassline
        bassline = self.bass_gen.generate(
            chord_progression=chord_names,
            style=bass_style,
            beats_per_chord=4
        )

        # 4. Generate drum pattern
        drums = self.drum_gen.generate(
            style=drum_style, bars=bars, humanize=True
        )

        return {
            "chords": chord_progression,
            "melody": melody,
            "bassline": bassline,
            "drums": drums,
            "metadata": {
                "key": self.key,
                "scale": self.scale,
                "bpm": self.bpm,
                "bars": bars,
            }
        }

    def export_midi(self, composition: dict,
                    output_path: str = "composition.mid"):
        """Export composition result as multi-track MIDI"""
        from mido import MidiFile, MidiTrack, Message, MetaMessage
        import mido

        mid = MidiFile(ticks_per_beat=480)
        tpb = 480

        # Tempo track
        tempo_track = MidiTrack()
        mid.tracks.append(tempo_track)
        tempo_track.append(MetaMessage(
            'set_tempo', tempo=mido.bpm2tempo(self.bpm)
        ))
        tempo_track.append(MetaMessage(
            'track_name', name='Tempo', time=0
        ))

        # Melody track
        melody_track = MidiTrack()
        mid.tracks.append(melody_track)
        melody_track.append(MetaMessage(
            'track_name', name='Melody', time=0
        ))
        melody_track.append(Message(
            'program_change', program=0, channel=0, time=0
        ))  # Piano

        prev_time = 0
        for note in composition["melody"]:
            start_ticks = int(note.get("start", 0) * tpb)
            duration_ticks = int(note["duration"] * tpb)
            delta = max(0, start_ticks - prev_time)

            melody_track.append(Message(
                'note_on', note=note["pitch"],
                velocity=note["velocity"],
                time=delta, channel=0
            ))
            melody_track.append(Message(
                'note_off', note=note["pitch"],
                velocity=0, time=duration_ticks, channel=0
            ))
            prev_time = start_ticks + duration_ticks

        # Bass track
        bass_track = MidiTrack()
        mid.tracks.append(bass_track)
        bass_track.append(MetaMessage(
            'track_name', name='Bass', time=0
        ))
        bass_track.append(Message(
            'program_change', program=33, channel=1, time=0
        ))  # Fingered Bass

        for note in composition["bassline"]:
            if note["pitch"] > 0:
                duration_ticks = int(note["duration"] * tpb)
                bass_track.append(Message(
                    'note_on', note=note["pitch"],
                    velocity=note["velocity"],
                    time=0, channel=1
                ))
                bass_track.append(Message(
                    'note_off', note=note["pitch"],
                    velocity=0, time=duration_ticks, channel=1
                ))
            else:
                rest_ticks = int(note["duration"] * tpb)
                bass_track.append(Message(
                    'note_on', note=60, velocity=0,
                    time=rest_ticks, channel=1
                ))

        mid.save(output_path)
        print(f"MIDI file exported: {output_path}")
        return mid


# Usage example
pipeline = AICompositionPipeline(key="C", scale="major", bpm=120)
composition = pipeline.compose(
    bars=16,
    chord_style="Canon Progression",
    melody_style="mixed",
    bass_style="walking",
    drum_style="basic_rock"
)
pipeline.export_midi(composition, "my_song.mid")
```

---

## 6. Comparison Tables

### 6.1 AI Composition Tool Comparison

| Item | Magenta | MuseNet | AIVA | Amper/Shutterstock | MusicTransformer | Suno |
|------|---------|---------|------|-------------------|-----------------|------|
| Type | OSS | API (discontinued) | SaaS | SaaS | Research | SaaS |
| MIDI Output | Supported | Not supported | Supported | Limited | Supported | Not supported |
| Genres | Diverse | Diverse | Classical-focused | Diverse | Diverse | Diverse |
| Interactive | Supported | Not supported | Partial | Not supported | Not supported | Partial |
| Customization | High | Low | Medium | Low | High | Low |
| Commercial Use | Apache 2.0 | - | Paid plan | Paid plan | Research only | Paid plan |
| API | Python | - | REST | REST | - | REST |

### 6.2 Chord Progression Generation Method Comparison

| Method | Music Theory Knowledge | Creativity | Controllability | Implementation Cost | Training Data Volume |
|------|-------------|--------|--------|-----------|------------|
| Rule-based | Required | Low | Highest | Low | Not needed |
| Markov Chain | Not needed (learned) | Medium | Medium | Low | Small |
| LSTM/GRU | Not needed (learned) | High | Low | Medium | Medium |
| Transformer | Not needed (learned) | Highest | Low | High | Large |
| Rule + AI Hybrid | Partially required | High | High | Medium | Medium |
| VAE | Not needed (learned) | High | Medium-High | High | Large |
| GAN | Not needed (learned) | High | Low | Highest | Large |
| Diffusion | Not needed (learned) | Highest | Medium | Highest | Large |

### 6.3 MIDI Tokenization Method Comparison

| Method | Sequence Length | Information Retention | Multi-track | Implementation Difficulty | Representative Library |
|------|------------|---------|-------------|-----------|-------------|
| REMI | Long | High | Limited | Low | MidiTok |
| TSD | Medium | High | Limited | Low | MidiTok |
| MIDILike | Longest | Highest | Supported | Lowest | MidiTok |
| Structured | Medium | High | Supported | Medium | MidiTok |
| CPWord | Shortest | High | Limited | High | MidiTok |
| Octuple | Short | High | Supported | High | MidiTok |

---

## 7. Anti-patterns

### 7.1 Anti-pattern: Completely Ignoring Music Theory

```python
# BAD: Completely random note generation
def bad_melody_generation(length=32):
    notes = [random.randint(0, 127) for _ in range(length)]
    velocities = [random.randint(0, 127) for _ in range(length)]
    return notes, velocities  # Full of dissonance

# GOOD: Generation with scale constraints
def good_melody_generation(length=32, key="C", scale="major"):
    scales = {
        "major":     [0, 2, 4, 5, 7, 9, 11],
        "minor":     [0, 2, 3, 5, 7, 8, 10],
        "pentatonic": [0, 2, 4, 7, 9],
    }
    key_offset = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

    scale_notes = scales[scale]
    offset = key_offset[key]
    # Available notes (multiple octaves)
    available_notes = []
    for octave in range(3, 6):  # C3-C6
        for degree in scale_notes:
            note = octave * 12 + degree + offset
            if 48 <= note <= 84:
                available_notes.append(note)

    # Melody generation (prioritize stepwise motion)
    melody = [random.choice(available_notes)]
    for _ in range(length - 1):
        current = melody[-1]
        # Select from 3 adjacent notes (stepwise motion)
        nearby = [n for n in available_notes if abs(n - current) <= 4]
        melody.append(random.choice(nearby))

    return melody
```

### 7.2 Anti-pattern: Mechanical Application of Quantization

```python
# BAD: Fully quantize all notes
def bad_quantize(midi_events, grid=480):
    for event in midi_events:
        event.time = round(event.time / grid) * grid
    return midi_events  # Mechanical, groove is lost

# GOOD: Groove-preserving quantization
def good_quantize(midi_events, grid=480, strength=0.75, swing=0.0):
    """
    Parameters:
        grid: Quantize grid (ticks)
        strength: 0.0 (none) to 1.0 (full)
        swing: 0.0 (straight) to 1.0 (full swing)
    """
    for event in midi_events:
        # Nearest grid point
        nearest = round(event.time / grid) * grid

        # Apply swing (shift even beats only)
        if swing > 0 and (nearest // grid) % 2 == 1:
            nearest += int(grid * swing * 0.33)

        # Partially quantize according to strength
        event.time = int(event.time + (nearest - event.time) * strength)

    return midi_events
```

### 7.3 Anti-pattern: Excessive Context Length

```python
# BAD: Ultra-long sequence causing out-of-memory
def bad_training():
    model = MusicTransformer(max_seq_len=16384)  # Too long
    # -> Out of memory, training is extremely slow
    # -> Attention computation is O(n^2)

# GOOD: Appropriate context length and splitting strategy
def good_training():
    model = MusicTransformer(max_seq_len=2048)  # Appropriate length

    # Split long pieces with overlap
    def split_with_overlap(tokens, max_len=2048, overlap=256):
        segments = []
        for i in range(0, len(tokens) - max_len, max_len - overlap):
            segments.append(tokens[i:i + max_len])
        return segments
```

### 7.4 Anti-pattern: Biased Training Data

```python
# BAD: Training data from only one specific genre
def bad_dataset():
    # Only 10,000 classical music pieces
    # -> Even when trying to generate pop, everything sounds classical

# GOOD: Building a balanced dataset
def good_dataset():
    dataset_config = {
        "genres": {
            "pop": 3000,
            "rock": 2000,
            "jazz": 2000,
            "classical": 1500,
            "electronic": 1500,
        },
        "total": 10000,
        "augmentation": {
            "transpose": True,      # Transpose to all 12 keys
            "tempo_variation": True, # Vary tempo by +/-20%
            "velocity_scaling": True, # Velocity scaling
        },
        "filtering": {
            "min_notes": 50,        # Minimum note count
            "max_notes": 10000,     # Maximum note count
            "min_duration": 30,     # Minimum 30 seconds
            "max_duration": 600,    # Maximum 10 minutes
        }
    }
    return dataset_config
```

---

## 8. FAQ

### Q1: What is the copyright status of AI-generated MIDI data?

MIDI data itself may be protected as a copyrighted work, but the copyright attribution of AI-generated content is legally a gray area. Many AI composition services (AIVA, Amper, etc.) grant commercial use rights under paid plans. When generated with OSS models (Magenta, etc.), copyright issues with training data remain. As a safeguard, it is recommended to: (1) use AI generation as a starting point and have humans substantially edit it, (2) use services that explicitly permit commercial use, and (3) keep records of the generation process.

### Q2: How can I use AI-generated chord progressions in a DAW?

The simplest method is: (1) output a MIDI file using Python etc., (2) drag and drop the MIDI file into the DAW. For real-time integration: (1) send via virtual MIDI ports (macOS: IAC Driver, Windows: loopMIDI), (2) run AI models within Ableton Live's Max for Live devices, (3) communicate between DAW and AI engine using the OSC protocol. Using libraries like MidiTok or pretty_midi makes it easy to convert AI output to DAW-friendly MIDI files.

### Q3: What are tips for improving melody generation AI quality?

There are five effective techniques: (1) Scale constraints: limit available notes to those within the scale. (2) Expanding context length: use models that consider longer context (Transformer). (3) Chord-conditioned generation: generate melody following chord progressions. (4) Post-processing rules: limit consecutive identical notes, limit leaps, handle phrase endings. (5) Temperature parameter tuning: lower values (0.6-0.8) for "safer" melodies, higher values (1.0-1.2) for more experimental melodies.

### Q4: What should I watch out for in MIDI data preprocessing?

Key points for MIDI preprocessing are as follows: (1) Unify resolution: MIDI files from different sources have different resolutions (ticks_per_beat), and standardizing to 480 is common practice. (2) Clean up channels: remove unnecessary channels (GM System Exclusive, etc.). (3) Normalize notes: normalize velocity range (e.g., linear mapping from 20-120 to 0-127). (4) Remove duplicate notes: fix abnormal data where Note On events occur consecutively without Note Off. (5) Handle tempo information: convert MIDI with tempo changes to relative time before processing.

### Q5: How do you solve latency for real-time AI composition?

There are three stages of latency countermeasures for real-time inference: (1) Model optimization: distilled models or ONNX runtime can improve inference speed by 10x or more. (2) Buffering strategy: set a 4-beat buffer for look-ahead generation. Generate the next 4 beats while the user is performing. (3) Caching and precomputation: precompute and cache results for commonly used chord progression patterns. On a PC with a GPU, generating 512 tokens can be completed in under 100ms, ensuring practical real-time performance.

### Q6: Where can I obtain MIDI datasets suitable for training?

Major MIDI datasets include the following: (1) Lakh MIDI Dataset: a large-scale dataset of approximately 170,000 songs. Diverse genres, ideal for research. (2) MAESTRO: a piano performance dataset published by Google Magenta. High-quality performance MIDI. (3) GiantMIDI-Piano: approximately 10,000 classical piano pieces. (4) ADL Piano MIDI: approximately 11,000 pop/rock piano MIDI files. (5) MusicNet: an annotated music dataset. Licenses vary by dataset, so be sure to verify before commercial use.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------|
| MIDI Data | Three elements: note number (0-127) + velocity + timing |
| Tokenization | Convert MIDI to LM input using REMI, Compound Word, etc. |
| AI Composition | Transformer-based is mainstream. Context length directly affects quality |
| Chord Progressions | Hybrid of music theory rules + AI is practical |
| Melody Generation | Chord-conditioned + scale constraints ensure quality |
| Basslines | Style-specific templates + AI variations are efficient |
| Drum Patterns | Pattern DB + humanization for natural groove |
| DAW Integration | Connect via MIDI file output or virtual MIDI ports |
| Quality Improvement | Scale constraints + chord conditioning + appropriate temperature settings |
| Training Pipeline | Automate data preprocessing -> tokenization -> training -> sample generation |

## Recommended Next Guides

- [00-music-generation.md](./00-music-generation.md) — Music Generation (Suno, MusicGen)
- [02-audio-effects.md](./02-audio-effects.md) — Audio Effects
- [../03-development/01-audio-processing.md](../03-development/01-audio-processing.md) — Audio Processing Libraries

## References

1. Huang, C.Z.A., et al. (2018). "Music Transformer: Generating Music with Long-Term Structure" — Music Transformer paper. Generation of long-term structure via relative position encoding
2. Fraternali, D., et al. (2023). "MidiTok: A Python package for MIDI file tokenization" — MidiTok paper. MIDI tokenization library
3. Roberts, A., et al. (2018). "A Hierarchical Latent Vector Model for Learning Long-Term Structure in Music Generation" — MusicVAE paper. Music generation via hierarchical latent variables
4. Dong, H.W., et al. (2018). "MuseGAN: Multi-track Sequential Generative Adversarial Networks for Symbolic Music Generation and Accompaniment" — Music generation via multi-track GAN
5. Hawthorne, C., et al. (2019). "Enabling Factorized Piano Music Modeling and Generation with the MAESTRO Dataset" — MAESTRO dataset and piano music generation
6. Lakh MIDI Dataset — https://colinraffel.com/projects/lmd/ — Large-scale MIDI research dataset
