# Video Editing -- AI Editing Tools

> Practical guide to AI-powered video editing automation, covering automatic subtitle generation, scene detection, object removal, and audio separation, presenting techniques to dramatically improve editing workflow efficiency

## What You Will Learn in This Chapter

1. **Core AI Video Editing Features** -- Automatic subtitle generation, scene detection, silence removal, object tracking
2. **Major Tool Comparison** -- AI features and use cases of Runway, Descript, CapCut, and DaVinci Resolve
3. **Production Workflow** -- AI-powered pipeline from footage import to publishing


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [Video Generation -- Sora, Runway, Pika](./00-video-generation.md)

---

## 1. Overview of AI Video Editing

### 1.1 Workflow

```
AI Video Editing Pipeline

  Import            Rough Cut           Finishing         Publishing
  +----------+    +----------+     +----------+    +----------+
  | Auto      |    | AI Scene |     | AI Color |    | AI Thumb-|
  | Transcrip-| -> | Detection| --> | Grading  | -> | nail Gen |
  | tion      |    | Silence  |     |          |    | Resizing |
  | (Whisper) |    | Removal  |     |          |    |          |
  +----------+    +----------+     +----------+    +----------+
  | AI Speaker|    | AI Object|     | AI Audio |    | AI Sub-  |
  | Separation|    | Removal  |     | Denoising|    | title    |
  |           |    |          |     |          |    | Translat.|
  +----------+    +----------+     +----------+    +----------+
```

### 1.2 Technology Map

```
AI Video Editing Technology Stack

  Audio Processing
  +-- Whisper (OpenAI) --- Speech-to-text conversion
  +-- Demucs (Meta)   --- Audio separation (BGM/vocals)
  +-- RVC             --- Voice conversion & cloning

  Video Processing
  +-- SAM (Meta)      --- Automatic segmentation
  +-- RIFE            --- Frame interpolation (slow motion)
  +-- Real-ESRGAN     --- Super-resolution (upscaling)
  +-- ProPainter      --- Object removal & inpainting

  Text Processing
  +-- GPT-4           --- Script generation & summarization
  +-- DeepL/Google    --- Subtitle translation
  +-- ElevenLabs      --- AI narration generation
```

### 1.3 AI Video Editing Evolution Timeline

```
2019  Maturation of foundational technologies
  |     +-- Automatic subtitles (YouTube auto-subtitle accuracy improvements)
  |
2020  Descript launches
  |     +-- Innovation in text-based video editing
  |
2021  Whisper (OpenAI)
  |     +-- Democratization of multilingual high-accuracy transcription
  |
2022  Runway Gen-1 / SAM
  |     +-- AI video effects and segmentation
  |
2023  Integration of AI video editing
  |     +-- CapCut AI, DaVinci Resolve AI feature expansion
  |
2024  End-to-end AI editing
  |     +-- Prompt-based editing instructions
  |   ProPainter / Track Anything
  |     +-- High-quality in-video object removal
  |
2025  Multimodal editing
        +-- Automatic full-video editing via text instructions
```

---

## 2. Automatic Subtitle Generation

### 2.1 Implementation with Whisper

```python
# Automatic subtitle generation with OpenAI Whisper
import whisper
import json

model = whisper.load_model("large-v3")

# Transcription + timestamps from audio file
result = model.transcribe(
    "video.mp4",
    language="ja",
    task="transcribe",
    word_timestamps=True,      # Word-level timestamps
    verbose=False,
)

# Output in SRT format
def to_srt(segments):
    srt_lines = []
    for i, seg in enumerate(segments, 1):
        start = format_timestamp(seg['start'])
        end = format_timestamp(seg['end'])
        text = seg['text'].strip()
        srt_lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(srt_lines)

def format_timestamp(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

srt_content = to_srt(result['segments'])
with open("subtitles.srt", "w", encoding="utf-8") as f:
    f.write(srt_content)

print(f"Subtitle generation complete: {len(result['segments'])} segments")
```

### 2.2 Speaker Diarization

```python
# Speaker diarization with pyannote.audio
from pyannote.audio import Pipeline
import whisper

# Speaker diarization model
diarization = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token="your-hf-token"
)

# Get speaker segments
dia_result = diarization("interview.wav")

for turn, _, speaker in dia_result.itertracks(yield_label=True):
    print(f"[{turn.start:.1f}s - {turn.end:.1f}s] {speaker}")
    # [0.5s - 12.3s] SPEAKER_00
    # [12.8s - 25.1s] SPEAKER_01
```

### 2.3 Integrated Pipeline: Whisper + Speaker Diarization

```python
# Complete pipeline for transcription with speaker diarization
import whisper
from pyannote.audio import Pipeline
from dataclasses import dataclass

@dataclass
class TranscriptionSegment:
    start: float
    end: float
    text: str
    speaker: str

class SpeakerAwareTranscriber:
    """Transcription with speaker identification"""

    def __init__(self, whisper_model: str = "large-v3", hf_token: str = ""):
        self.whisper = whisper.load_model(whisper_model)
        self.diarization = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )

    def transcribe_with_speakers(
        self,
        audio_path: str,
        language: str = "ja",
        max_speakers: int = None,
    ) -> list[TranscriptionSegment]:
        """Transcription with speaker diarization"""

        # 1. Transcribe with Whisper
        whisper_result = self.whisper.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
        )

        # 2. Speaker diarization with pyannote
        dia_params = {}
        if max_speakers:
            dia_params["max_speakers"] = max_speakers
        dia_result = self.diarization(audio_path, **dia_params)

        # 3. Merge speaker info with transcription
        segments = []
        for seg in whisper_result["segments"]:
            # Determine speaker at the midpoint of the segment
            mid_time = (seg["start"] + seg["end"]) / 2
            speaker = self._get_speaker_at_time(dia_result, mid_time)

            segments.append(TranscriptionSegment(
                start=seg["start"],
                end=seg["end"],
                text=seg["text"].strip(),
                speaker=speaker,
            ))

        return segments

    def _get_speaker_at_time(self, dia_result, time: float) -> str:
        """Get the speaker at a given time"""
        for turn, _, speaker in dia_result.itertracks(yield_label=True):
            if turn.start <= time <= turn.end:
                return speaker
        return "UNKNOWN"

    def export_to_srt(
        self,
        segments: list[TranscriptionSegment],
        output_path: str,
        include_speaker: bool = True,
    ):
        """Export in SRT format"""
        lines = []
        for i, seg in enumerate(segments, 1):
            start = self._format_time(seg.start)
            end = self._format_time(seg.end)
            text = f"[{seg.speaker}] {seg.text}" if include_speaker else seg.text
            lines.append(f"{i}\n{start} --> {end}\n{text}\n")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def _format_time(self, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# Usage example
transcriber = SpeakerAwareTranscriber(
    whisper_model="large-v3",
    hf_token="your-hf-token",
)

segments = transcriber.transcribe_with_speakers(
    "interview.wav",
    language="ja",
    max_speakers=2,
)

transcriber.export_to_srt(segments, "interview_subtitles.srt")

# Output example:
# 1
# 00:00:01,200 --> 00:00:05,800
# [SPEAKER_00] Today we'll be discussing AI video editing
#
# 2
# 00:00:06,100 --> 00:00:10,500
# [SPEAKER_01] Yes, thank you for having me
```

### 2.4 Subtitle Styling and Auto-Translation

```python
# Subtitle auto-translation and styling

from dataclasses import dataclass
from typing import Optional

@dataclass
class SubtitleStyle:
    """Subtitle style settings"""
    font_family: str = "Noto Sans JP"
    font_size: int = 48
    font_color: str = "#FFFFFF"
    outline_color: str = "#000000"
    outline_width: int = 3
    background_color: Optional[str] = None  # None = transparent
    position: str = "bottom_center"  # top, bottom, center
    max_chars_per_line: int = 20

class SubtitleProcessor:
    """Subtitle post-processing and translation"""

    def auto_split_long_lines(
        self, text: str, max_chars: int = 20
    ) -> str:
        """Split long subtitle text with line breaks"""
        if len(text) <= max_chars:
            return text

        words = text.split()
        lines = []
        current_line = ""

        for word in words:
            if len(current_line + word) > max_chars and current_line:
                lines.append(current_line.strip())
                current_line = word + " "
            else:
                current_line += word + " "

        if current_line.strip():
            lines.append(current_line.strip())

        return "\n".join(lines)

    def translate_subtitles(
        self,
        segments: list,
        target_lang: str = "en",
        service: str = "deepl",
    ) -> list:
        """Translate subtitles"""
        if service == "deepl":
            return self._translate_with_deepl(segments, target_lang)
        elif service == "gpt4":
            return self._translate_with_gpt4(segments, target_lang)
        return segments

    def _translate_with_gpt4(self, segments: list, target_lang: str) -> list:
        """High-quality translation using GPT-4 (context-aware)"""
        from openai import OpenAI
        client = OpenAI()

        # Batch translate all text (to maintain context)
        all_texts = [seg.text for seg in segments]
        numbered_texts = "\n".join(
            f"{i}: {text}" for i, text in enumerate(all_texts)
        )

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": f"Translate the following numbered lines to {target_lang}. "
                               f"Keep the numbering. Maintain natural conversation flow.",
                },
                {"role": "user", "content": numbered_texts},
            ],
        )

        # Parse translated results
        translated_lines = response.choices[0].message.content.strip().split("\n")
        for i, seg in enumerate(segments):
            if i < len(translated_lines):
                # "0: translated text" -> "translated text"
                parts = translated_lines[i].split(": ", 1)
                seg.text = parts[1] if len(parts) > 1 else parts[0]

        return segments

    def generate_ass_file(
        self,
        segments: list,
        style: SubtitleStyle,
        output_path: str,
    ):
        """Output in ASS (Advanced SubStation Alpha) format"""
        header = f"""[Script Info]
Title: AI Generated Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: Default,{style.font_family},{style.font_size},&H00FFFFFF,&H00000000,&H00000000,0,0,1,{style.outline_width},0,2,10,10,40

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        events = []
        for seg in segments:
            start = self._to_ass_time(seg.start)
            end = self._to_ass_time(seg.end)
            text = seg.text.replace("\n", "\\N")
            events.append(
                f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}"
            )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events))

    def _to_ass_time(self, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int((seconds % 1) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
```

---

## 3. Scene Detection and Auto-Cutting

```python
# Scene detection with PySceneDetect
from scenedetect import detect, ContentDetector, split_video_ffmpeg

# Scene detection (detecting content changes)
scene_list = detect("raw_footage.mp4", ContentDetector(threshold=27.0))

print(f"Scenes detected: {len(scene_list)}")
for i, scene in enumerate(scene_list):
    print(f"  Scene {i+1}: {scene[0].get_timecode()} - {scene[1].get_timecode()}")

# Split video by scene
split_video_ffmpeg("raw_footage.mp4", scene_list, output_dir="scenes/")
```

```python
# Auto-cut silent sections with FFmpeg + Whisper
import subprocess
import json

def detect_silence(input_file, threshold=-30, duration=1.0):
    """Detect silent intervals"""
    cmd = [
        'ffmpeg', '-i', input_file,
        '-af', f'silencedetect=noise={threshold}dB:d={duration}',
        '-f', 'null', '-'
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    # Parse silence intervals from stderr
    silences = parse_silence_output(result.stderr)
    return silences

def remove_silence(input_file, output_file, silences):
    """Generate video with silent sections removed"""
    # Extract and concatenate only the sections with audio
    filter_complex = build_trim_filter(silences, get_duration(input_file))
    cmd = ['ffmpeg', '-i', input_file, '-filter_complex', filter_complex, output_file]
    subprocess.run(cmd)

# Usage example
silences = detect_silence("lecture.mp4", threshold=-35, duration=0.8)
remove_silence("lecture.mp4", "lecture_trimmed.mp4", silences)
```

### 3.1 Advanced Scene Detection Pipeline

```python
# High-accuracy scene detection combining multiple methods

from scenedetect import SceneManager, open_video
from scenedetect.detectors import ContentDetector, ThresholdDetector, AdaptiveDetector

class AdvancedSceneDetector:
    """Scene detection using multiple methods"""

    def __init__(self):
        self.detectors = {
            "content": ContentDetector(threshold=27.0),
            "adaptive": AdaptiveDetector(
                adaptive_threshold=3.0,
                min_scene_len=15,  # Minimum 15 frames
            ),
        }

    def detect_scenes(
        self,
        video_path: str,
        method: str = "adaptive",
        min_scene_duration: float = 1.0,
    ) -> list:
        """Execute scene detection"""
        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(self.detectors[method])
        scene_manager.detect_scenes(video)

        scene_list = scene_manager.get_scene_list()

        # Filter by minimum scene length
        fps = video.frame_rate
        min_frames = int(min_scene_duration * fps)
        filtered = [
            scene for scene in scene_list
            if (scene[1] - scene[0]).get_frames() >= min_frames
        ]

        return filtered

    def classify_scenes(self, video_path: str, scenes: list) -> list:
        """
        Classify each scene

        Classification categories:
        - dialogue: Scenes with people talking
        - action: Scenes with high motion
        - transition: Transitions
        - static: Static scenes (slides, text overlays, etc.)
        """
        classified = []
        for scene in scenes:
            # Calculate motion amount in frames
            motion = self._calculate_motion(video_path, scene)
            # Audio analysis
            has_speech = self._detect_speech(video_path, scene)

            if has_speech and motion < 0.3:
                category = "dialogue"
            elif motion > 0.7:
                category = "action"
            elif motion < 0.1:
                category = "static"
            else:
                category = "general"

            classified.append({
                "start": scene[0].get_timecode(),
                "end": scene[1].get_timecode(),
                "category": category,
                "motion_score": motion,
                "has_speech": has_speech,
            })

        return classified

    def auto_highlight(
        self,
        video_path: str,
        target_duration: float = 60.0,
        priority: list = None,
    ) -> list:
        """
        Auto-generate highlights

        Prioritize high-motion scenes and dialogue scenes,
        selecting scenes to fit within the target duration
        """
        scenes = self.detect_scenes(video_path)
        classified = self.classify_scenes(video_path, scenes)

        if priority is None:
            priority = ["action", "dialogue", "general", "static"]

        # Sort by priority
        scored = []
        for scene in classified:
            priority_score = (
                len(priority) - priority.index(scene["category"])
                if scene["category"] in priority else 0
            )
            scored.append((priority_score, scene))

        scored.sort(reverse=True, key=lambda x: x[0])

        # Select scenes to fit within the target duration
        selected = []
        total_duration = 0
        for _, scene in scored:
            # Calculate scene length (simplified)
            scene_duration = 3.0  # Placeholder value
            if total_duration + scene_duration <= target_duration:
                selected.append(scene)
                total_duration += scene_duration

        return selected

    def _calculate_motion(self, video_path, scene):
        """Calculate motion amount in a scene"""
        return 0.5  # In practice, calculated using frame differences

    def _detect_speech(self, video_path, scene):
        """Detect whether speech exists in a scene"""
        return True  # In practice, detected using VAD
```

---

## 4. AI Video Processing

### 4.1 Super-Resolution (Upscaling)

```python
# Video upscaling with Real-ESRGAN
# Command line execution
# realesrgan-ncnn-vulkan -i input.mp4 -o output.mp4 -n realesrgan-x4plus -s 4

# Python API
from realesrgan import RealESRGANer
from basicsr.archs.rrdbnet_arch import RRDBNet

model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
upsampler = RealESRGANer(scale=4, model_path='weights/RealESRGAN_x4plus.pth', model=model)

# Super-resolve each frame
output, _ = upsampler.enhance(input_frame, outscale=4)
```

### 4.2 Frame Interpolation (Slow Motion)

```bash
# Frame interpolation with RIFE (30fps -> 120fps)
python inference_video.py \
  --video input_30fps.mp4 \
  --output output_120fps.mp4 \
  --exp 2 \  # 2^2 = 4x the number of frames
  --model rife-v4.6
```

### 4.3 Object Removal (ProPainter)

```python
# Object removal from video using ProPainter

import cv2
import numpy as np
from pathlib import Path

class VideoObjectRemover:
    """Remove objects from video"""

    def __init__(self, model_path: str = "propainter_weights"):
        self.model = self._load_model(model_path)

    def remove_object(
        self,
        video_path: str,
        mask_dir: str,
        output_path: str,
        flow_completion: bool = True,
    ):
        """
        Remove an object from video

        video_path: Input video
        mask_dir: Directory of per-frame mask images
          White = removal target, Black = keep
        output_path: Output video
        flow_completion: Use optical flow completion
        """
        # 1. Extract frames from video
        frames = self._extract_frames(video_path)
        masks = self._load_masks(mask_dir, len(frames))

        # 2. Compute optical flow
        if flow_completion:
            flows_forward = self._compute_flow(frames, direction="forward")
            flows_backward = self._compute_flow(frames, direction="backward")
            # Flow completion for masked regions
            flows_forward = self._complete_flow(flows_forward, masks)
            flows_backward = self._complete_flow(flows_backward, masks)

        # 3. Inpainting with spatiotemporal attention
        inpainted_frames = self.model.inpaint(
            frames=frames,
            masks=masks,
            flows_f=flows_forward if flow_completion else None,
            flows_b=flows_backward if flow_completion else None,
        )

        # 4. Write out as video
        self._write_video(inpainted_frames, output_path, fps=30)

    def track_and_remove(
        self,
        video_path: str,
        initial_mask: str,
        output_path: str,
    ):
        """
        Track and remove an object from the first frame's mask
        Combines SAM + Track Anything
        """
        # 1. Segmentation with SAM
        # 2. Track in subsequent frames
        # 3. Generate masks for all frames
        # 4. Remove with ProPainter
        pass

    def _extract_frames(self, video_path):
        frames = []
        cap = cv2.VideoCapture(video_path)
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()
        return frames

    def _load_masks(self, mask_dir, num_frames):
        masks = []
        for i in range(num_frames):
            mask_path = Path(mask_dir) / f"mask_{i:04d}.png"
            if mask_path.exists():
                mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
                masks.append(mask)
            else:
                masks.append(np.zeros_like(masks[0]) if masks else None)
        return masks

    def _write_video(self, frames, output_path, fps=30):
        h, w = frames[0].shape[:2]
        writer = cv2.VideoWriter(
            output_path,
            cv2.VideoWriter_fourcc(*'mp4v'),
            fps, (w, h)
        )
        for frame in frames:
            writer.write(frame)
        writer.release()

    def _compute_flow(self, frames, direction):
        """Optical flow computation with RAFT"""
        pass

    def _complete_flow(self, flows, masks):
        """Flow completion for masked regions"""
        pass

    def _load_model(self, model_path):
        """Load ProPainter model"""
        pass
```

### 4.4 AI Audio Processing

```python
# Audio separation with Demucs

class AudioSeparator:
    """AI-powered audio separation"""

    def separate(
        self,
        audio_path: str,
        output_dir: str,
        model: str = "htdemucs_ft",
    ) -> dict:
        """
        Separate audio into stems

        Output stems:
        - vocals: Vocals/speech
        - drums: Drums
        - bass: Bass
        - other: Other instruments
        """
        import subprocess

        cmd = [
            "python", "-m", "demucs",
            "--model", model,
            "--out", output_dir,
            audio_path,
        ]
        subprocess.run(cmd, check=True)

        stem_dir = Path(output_dir) / model / Path(audio_path).stem
        return {
            "vocals": str(stem_dir / "vocals.wav"),
            "drums": str(stem_dir / "drums.wav"),
            "bass": str(stem_dir / "bass.wav"),
            "other": str(stem_dir / "other.wav"),
        }

    def remove_background_music(
        self,
        video_path: str,
        output_path: str,
    ):
        """Remove BGM from video, keeping only speech"""
        import subprocess

        # 1. Extract audio
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le",
            "temp_audio.wav"
        ])

        # 2. Separate audio
        stems = self.separate("temp_audio.wav", "./separated")

        # 3. Reconstruct video with vocals only
        subprocess.run([
            "ffmpeg",
            "-i", video_path,
            "-i", stems["vocals"],
            "-c:v", "copy",
            "-map", "0:v:0",
            "-map", "1:a:0",
            output_path,
        ])

    def enhance_voice(
        self,
        audio_path: str,
        output_path: str,
    ):
        """Audio denoising and quality enhancement"""
        # 1. Extract vocals via audio separation
        # 2. Noise removal (spectral gating)
        # 3. EQ adjustment (boost speech frequency bands)
        # 4. Loudness normalization
        pass
```

---

## 5. Automated Editing Workflow

### 5.1 YouTube Video Auto-Editing Pipeline

```python
# YouTube video auto-editing pipeline

class YouTubeAutoEditor:
    """Auto-editing for YouTube videos"""

    def __init__(self):
        self.whisper_model = whisper.load_model("large-v3")
        self.scene_detector = AdvancedSceneDetector()

    def auto_edit(
        self,
        raw_video: str,
        output_video: str,
        config: dict = None,
    ):
        """
        Full auto-editing pipeline

        config:
          silence_threshold: Threshold for silence cutting (dB)
          silence_duration: Minimum silence length for detection (seconds)
          padding: Margin before/after cuts (seconds)
          target_duration: Target video length (seconds, None = no limit)
          add_subtitles: Whether to add subtitles
          subtitle_lang: Subtitle language
        """
        if config is None:
            config = {
                "silence_threshold": -35,
                "silence_duration": 0.8,
                "padding": 0.1,
                "target_duration": None,
                "add_subtitles": True,
                "subtitle_lang": "ja",
            }

        print("Step 1: Transcription...")
        transcription = self.whisper_model.transcribe(
            raw_video,
            language=config["subtitle_lang"],
            word_timestamps=True,
        )

        print("Step 2: Silence detection...")
        silences = detect_silence(
            raw_video,
            threshold=config["silence_threshold"],
            duration=config["silence_duration"],
        )

        print("Step 3: Scene detection...")
        scenes = self.scene_detector.detect_scenes(raw_video)

        print("Step 4: Determining edit points...")
        edit_points = self._merge_edit_points(
            silences=silences,
            scenes=scenes,
            transcription=transcription,
            padding=config["padding"],
        )

        print("Step 5: Cutting & joining video...")
        self._apply_edits(raw_video, edit_points, output_video)

        if config["add_subtitles"]:
            print("Step 6: Adding subtitles...")
            srt_path = output_video.replace(".mp4", ".srt")
            self._generate_subtitles(transcription, srt_path)

        print(f"Auto-editing complete: {output_video}")

    def _merge_edit_points(self, silences, scenes, transcription, padding):
        """Merge silence cuts, scene detection, and transcription to determine edit points"""
        # Keep regions with audio
        keep_regions = []
        # Calculate the inverse of silent intervals (regions with audio)
        # Select natural cut points at scene boundaries
        # Avoid cutting in the middle of words
        return keep_regions

    def _apply_edits(self, input_video, edit_points, output_video):
        """Apply edits with FFmpeg"""
        pass

    def _generate_subtitles(self, transcription, output_path):
        """Generate subtitle file"""
        srt = to_srt(transcription["segments"])
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(srt)
```

### 5.2 Batch Processing Pipeline

```python
# Batch processing for multiple videos

import concurrent.futures
from pathlib import Path

class BatchVideoProcessor:
    """Batch processing for multiple videos"""

    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers

    def process_batch(
        self,
        input_dir: str,
        output_dir: str,
        operations: list,
    ):
        """
        Process all videos in a directory

        operations: List of operations to apply
          e.g.: ["transcribe", "remove_silence", "upscale", "subtitle"]
        """
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        videos = list(Path(input_dir).glob("*.mp4"))

        print(f"Target: {len(videos)} videos")

        results = {}
        with concurrent.futures.ProcessPoolExecutor(
            max_workers=self.max_workers
        ) as executor:
            futures = {}
            for video in videos:
                output = Path(output_dir) / video.name
                future = executor.submit(
                    self._process_single, str(video), str(output), operations
                )
                futures[future] = video.name

            for future in concurrent.futures.as_completed(futures):
                name = futures[future]
                try:
                    result = future.result()
                    results[name] = {"status": "success", **result}
                    print(f"  Complete: {name}")
                except Exception as e:
                    results[name] = {"status": "error", "error": str(e)}
                    print(f"  Failed: {name} - {e}")

        return results

    def _process_single(self, input_path, output_path, operations):
        """Process a single video"""
        result = {}
        for op in operations:
            if op == "transcribe":
                result["transcription"] = self._transcribe(input_path)
            elif op == "remove_silence":
                input_path = self._remove_silence(input_path)
            elif op == "upscale":
                input_path = self._upscale(input_path)
            elif op == "subtitle":
                self._add_subtitle(input_path, output_path)
        return result

    def _transcribe(self, path):
        pass

    def _remove_silence(self, path):
        return path

    def _upscale(self, path):
        return path

    def _add_subtitle(self, input_path, output_path):
        pass
```

---

## 6. Major Tool Comparison

| Feature | Runway | Descript | CapCut | DaVinci Resolve |
|---------|:------:|:-------:|:------:|:--------------:|
| AI Subtitle Generation | Supported | Supported (High Accuracy) | Supported | Supported |
| Text-Based Editing | -- | Supported (Core Feature) | -- | -- |
| AI Background Removal | Green Screen AI | -- | AI Cutout | Magic Mask |
| Object Removal | Inpainting | -- | -- | Object Removal |
| AI Color Correction | -- | -- | -- | AI Color Match |
| Audio Denoising | -- | Studio Sound | Noise Removal | Voice Isolation |
| Pricing | $12-76/mo | $24/mo | Free/Pro $10/mo | Free/Studio $295 |
| Target Users | Creators | Podcasts & YouTube | Social Media Videos | Professional Production |

| Use Case | Recommended Tool | Reason |
|----------|-----------------|--------|
| YouTube Videos | Descript | Fast text-based editing |
| Social Media Short Videos | CapCut | Free, rich templates |
| Film & Commercial Quality | DaVinci Resolve | Professional color & audio tools |
| Experimental VFX | Runway | Cutting-edge AI video generation |
| Podcasts | Descript | Audio editing + video creation |
| Educational Content | Descript + CapCut | Subtitle-focused, cost-effective |
| Corporate Presentations | CapCut / Canva | Template-based, easy operation |

### Detailed AI Feature Comparison by Tool

| AI Feature | Quality | Speed | Cost | Recommended Tool |
|-----------|:------:|:-----:|:----:|-----------------|
| Auto Subtitles (Japanese) | ★★★★★ | Fast | Low | Whisper (Local) |
| Auto Subtitles (Multilingual) | ★★★★☆ | Fast | Medium | Descript |
| Text-Based Editing | ★★★★★ | Instant | Medium | Descript |
| Object Removal | ★★★★☆ | Medium | High | Runway |
| Background Removal | ★★★★☆ | Fast | Low | CapCut |
| Audio Separation | ★★★★★ | Medium | Low | Demucs (Local) |
| Color Grading | ★★★★★ | Instant | Medium | DaVinci Resolve |
| Frame Interpolation | ★★★★☆ | Slow | Low | RIFE (Local) |
| Super-Resolution | ★★★★☆ | Slow | Low | Real-ESRGAN (Local) |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Publishing AI Subtitles Without Proofreading

```
BAD:
  Generate subtitles with Whisper -> Publish as-is
  -> Misrecognition of proper nouns, improper punctuation placement
  -> Erodes viewer trust

GOOD:
  1. Generate draft subtitles with Whisper
  2. Register proper nouns and technical terms in a dictionary
  3. Human proofreading (especially numbers and proper nouns)
  4. Timing adjustments (readable display duration)
```

### Anti-Pattern 2: Excessive AI Effect Application

```
BAD:
  AI super-resolution + AI color + AI denoising + AI stabilization
  -> Artifacts (AI traces) accumulate
  -> Results in unnatural footage

GOOD:
  - Limit to the 1-2 most impactful processing types
  - Preserve the quality of the original material
  - Always compare before and after AI processing
  - Preview at full resolution before exporting
```

### Anti-Pattern 3: Over-Aggressive Silence Removal

```
BAD:
  Mechanically cut all silence
  -> Natural "pauses" are lost, making it hard to follow
  -> Unnaturally rapid pacing with no breathing room

GOOD:
  - Preserve intentional pauses (keep silences under 2 seconds)
  - Add padding (0.1-0.2 seconds) around cuts
  - Leave slightly longer pauses at speaker transitions
  - Respect pauses at topic changes
```

### Anti-Pattern 4: Not Considering Whisper Model Size

```
BAD:
  Use large-v3 for all transcriptions
  -> Even short videos take a long time to process
  -> Waste of GPU resources

GOOD:
  - Draft stage: Fast processing with base / medium
  - Final version: High-accuracy processing with large-v3
  - Real-time use: tiny / base (can run on CPU)
  - Known language: Specify the language parameter for improved accuracy
```

---

## 8. Performance Optimization Guide

### 8.1 Processing Speed Optimization

```
Processing Pipeline Optimization Techniques:

1. Proxy Editing
   - Original footage: 4K / 60fps
   - Editing proxy: 720p / 30fps
   - Re-render with original footage for final output
   -> 4-8x editing speed improvement

2. GPU Pipeline
   - Whisper: 10x speedup with GPU
   - Real-ESRGAN: GPU required, tile processing to save VRAM
   - RIFE: Real-time processing possible with GPU
   -> 5-10x overall speedup compared to CPU

3. Parallel Processing
   - Run audio and video processing in parallel
   - Multiprocess frame-level processing
   - Batch processing for multiple videos
   -> 2-4x throughput improvement

4. Caching Strategy
   - Cache transcription results
   - Cache scene detection results
   - Save intermediate frames to temporary files
   -> 90% reduction in reprocessing time
```

### 8.2 Quality Control Checklist

```
Video Quality Checklist:

Video:
  [ ] Resolution meets output requirements
  [ ] Frame rate is consistent (no dropped frames)
  [ ] Color grading is uniform
  [ ] AI artifacts are not noticeable
  [ ] Transitions are natural

Audio:
  [ ] Volume levels are consistent (LUFS standard)
  [ ] Noise has been removed
  [ ] BGM and speech balance is appropriate
  [ ] Speaker voices are clear

Subtitles:
  [ ] No typos or errors
  [ ] Timing matches the audio
  [ ] Proper nouns are correct
  [ ] Line break positions are appropriate
  [ ] Font size and color are readable
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Perform input data validation
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
        """Main processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
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

Extend the basic implementation to add the following features.

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

# Test
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
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization Error | Configuration file issues | Check configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of Memory | Data volume growth | Introduce batch processing, implement pagination |
| Permission Error | Insufficient access permissions | Check execution user permissions, review settings |
| Data Inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Procedure

1. **Check Error Messages**: Read the stack trace and identify the location
2. **Establish Reproduction Steps**: Reproduce the error with minimal code
3. **Formulate Hypotheses**: List possible causes
4. **Step-by-Step Verification**: Use log output or a debugger to verify hypotheses
5. **Fix and Regression Test**: After fixing, run tests on related areas as well

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator to log function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify Bottlenecks**: Measure with profiling tools
2. **Check Memory Usage**: Check for memory leaks
3. **Check I/O Waits**: Check disk and network I/O status
4. **Check Connection Count**: Check connection pool status

| Problem Type | Diagnostic Tool | Countermeasure |
|-------------|----------------|----------------|
| CPU Load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory Leak | tracemalloc, objgraph | Proper reference release |
| I/O Bottleneck | strace, iostat | Async I/O, caching |
| DB Latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here is a summary of decision criteria for technology selection.

| Criteria | Prioritize When | Acceptable to Compromise When |
|----------|----------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development Speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
+---------------------------------------------------+
|          Architecture Selection Flow               |
+---------------------------------------------------+
|                                                   |
|  (1) Team size?                                   |
|    +-- Small (1-5 people) -> Monolith             |
|    +-- Large (10+ people) -> Go to (2)            |
|                                                   |
|  (2) Deployment frequency?                        |
|    +-- Weekly or less -> Monolith + module split   |
|    +-- Daily/multiple -> Go to (3)                |
|                                                   |
|  (3) Inter-team independence?                     |
|    +-- High -> Microservices                      |
|    +-- Moderate -> Modular monolith               |
|                                                   |
+---------------------------------------------------+
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A short-term fast approach may become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and delays the project

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit-for-purpose but increases operational costs

**3. Level of Abstraction**
- High abstraction offers better reusability but can make debugging harder
- Low abstraction is intuitive but tends to produce code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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
            icon = "+" if c['type'] == 'positive' else "!"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 9. FAQ

### Q1. How can I improve Whisper's accuracy?

**A.** (1) Use the `large-v3` model (highest accuracy but slowest processing). (2) Explicitly specify the language (`language="ja"`). (3) Provide technical terms and context via `initial_prompt`. (4) For noisy audio, pre-extract vocals using audio separation (Demucs) before processing.

### Q2. How can I streamline editing of long-form videos?

**A.** (1) Transcribe with Whisper -> identify unnecessary parts via text. (2) With Descript's text-based editing, deleting text = cutting the corresponding video segment. (3) Split scenes with PySceneDetect -> exclude unnecessary scenes. (4) Auto-cut silent sections. Combining these techniques allows rough-editing 10 hours of footage in 1-2 hours.

### Q3. How can I speed up AI video editing processing?

**A.** (1) Leverage GPUs (Whisper is 10x faster on NVIDIA CUDA-compatible GPUs). (2) Proxy editing (edit at low resolution -> switch to high resolution for final export). (3) Batch processing (process multiple videos in parallel). (4) Use cloud GPUs (Google Colab, Runway Cloud). A hybrid approach combining local and cloud processing is practical rather than insisting on local-only processing.

### Q4. How does Descript's text-based editing work?

**A.** Descript transcribes video audio and fully synchronizes text with the timeline. Deleting text in the text editor automatically cuts the corresponding video segment. Conversely, rearranging text changes the video structure. It also has auto-detection and removal of filler words like "um" and "uh." A two-stage workflow of rough editing via text followed by fine-tuning on the timeline is efficient.

### Q5. Can AI auto-generate BGM for videos?

**A.** Yes. (1) **Suno AI**: Generates music from text prompts. Can create BGM matching the video's mood. (2) **Udio**: High-quality music generation. (3) **Stable Audio**: Stability AI's music generation model. (4) **Mubert**: BGM generation service with API integration. All require license verification for commercial use. Duration adjustment to match video length and tone changes at scene transitions currently still require human adjustment.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing and running code.

### Q2: What are common mistakes beginners make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Auto Subtitles | Generate with Whisper -> Human proofreading -> SRT/VTT output |
| Scene Detection | Auto-split with PySceneDetect, streamline with silence removal |
| Super-Resolution | Upscale low-resolution footage to 4K with Real-ESRGAN |
| Audio Processing | Audio separation with Demucs, noise removal |
| Tool Selection | YouTube = Descript, Social Media = CapCut, Professional = DaVinci Resolve |
| Quality Control | Keep AI processing minimal; excessive application causes artifacts |
| Automation | Silence removal + subtitle generation auto-pipeline offers the best ROI |
| Optimization | Significant speedup with GPU utilization + proxy editing + batch processing |

---

## Recommended Next Reads

- [Animation](./02-animation.md) -- AI animation generation techniques
- [Design Tools](../01-image/03-design-tools.md) -- AI design for thumbnails and banners
- [Ethical Considerations](../03-3d/03-ethical-considerations.md) -- Rights and ethics of AI-generated content

---

## References

1. **Whisper (OpenAI)** -- https://github.com/openai/whisper -- Speech recognition model
2. **Runway ML Documentation** -- https://docs.runwayml.com/ -- AI video editing tool
3. **DaVinci Resolve Training** -- https://www.blackmagicdesign.com/products/davinciresolve/training
4. **ProPainter** -- Zhou et al. (ICCV 2023) -- Video inpainting
5. **Demucs** -- Rouard et al. (2023) -- Audio separation model
6. **PySceneDetect** -- https://www.scenedetect.com/ -- Scene detection library
