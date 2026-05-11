# Animation -- AI Animation

> This guide provides a practical explanation of automation techniques for animation production using AI technology, covering video generation from images, character animation, and motion generation, demonstrating how to reduce tasks that previously took days to just minutes

## What You Will Learn in This Chapter

1. **Fundamentals of AI Animation Generation** -- Image-to-Video, Text-to-Video, and motion transfer mechanisms
2. **Key Tools and Models** -- Comparison of Runway Gen-3, Pika, Stable Video Diffusion, and AnimateDiff
3. **Practical Workflows** -- Prompt design, consistency maintenance, and loop animation production
4. **Advanced Character Animation** -- Motion transfer, facial expression control, and cutting-edge real-time generation techniques
5. **Production Pipelines** -- Commercial-grade AI animation production workflows


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Video Editing -- AI Editing Tools](./01-video-editing.md)

---

## 1. Overview of AI Animation Technology

### 1.1 Technology Classification

```
AI Animation Technology Map

  Image-to-Video (Still Image -> Video)
  ├── Runway Gen-3 Alpha    --- High-quality motion generation
  ├── Stable Video Diffusion --- Open source
  ├── Pika                   --- Easy operation, 3D conversion
  └── Kling                  --- Long-form generation, high quality

  Text-to-Video (Text -> Video)
  ├── Sora (OpenAI)          --- Ultra-high quality (limited access)
  ├── Runway Gen-3           --- Text to video
  └── AnimateDiff            --- Stable Diffusion extension

  Motion Transfer
  ├── ControlNet + Temporal  --- Pose control
  ├── DWPose                 --- Human body pose estimation
  └── MagicAnimate           --- Animation from reference poses

  Character Animation
  ├── Live2D + AI            --- Motion generation for 2D characters
  ├── Mixamo                 --- Automated rigging for 3D characters
  └── Motion Diffusion Model --- Text to 3D motion
```

### 1.2 Technology Evolution Timeline

```
Evolution of AI Animation Technology

  2020  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ├── First Order Motion Model (Facial motion transfer)
        └── VQ-VAE (Foundation for video tokenization)

  2021  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ├── CogVideo (Early text-to-video model)
        └── FILM (Frame interpolation)

  2022  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ├── Make-A-Video (Meta)
        ├── Imagen Video (Google)
        └── AnimateDiff v1 (SD extension)

  2023  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ├── Stable Video Diffusion (Stability AI)
        ├── Runway Gen-2/Gen-3
        ├── Pika Labs official release
        ├── Kling (Kuaishou, China)
        └── MagicAnimate (Human body animation)

  2024  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ├── Sora (OpenAI, general release)
        ├── AnimateDiff v3 + SparseCtrl
        ├── EMO (Audio-to-facial animation)
        └── LivePortrait (Real-time facial control)

  2025  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ├── Real-time video generation
        ├── Major improvements in long-form consistency
        └── Integration of 3D and animation
```

### 1.3 Generation Pipeline

```
  [Text Prompt]
       |
       v
  [AI Image Generation] --> [Reference Image]
  (Stable Diffusion)            |
                                v
  [Image-to-Video] -------> [Video Clip 4s]
  (Runway Gen-3)                |
                                v
  [Frame Interpolation] ---> [Smooth Video 4s 60fps]
  (RIFE)                        |
                                v
  [Video Compositing/Editing] -> [Final Animation]
  (DaVinci Resolve)
```

### 1.4 Quality vs. Time Trade-off

```
  Quality
  High |                          * Sora
       |                    * Gen-3 Alpha
       |              * Kling
       |         * SVD
       |    * Pika
       |* AnimateDiff
  Low  +--------------------------------
       Fast                        Slow
              Generation Time

  Selection by Use Case:
  - Social media content -> Pika / AnimateDiff (speed priority)
  - Commercials / Presentations -> Gen-3 Alpha (quality priority)
  - Research / Experiments -> SVD / AnimateDiff (customizability)
```

---

## 2. Image-to-Video Generation

### 2.1 Runway Gen-3 Alpha

```python
# Image-to-Video generation with Runway API (pseudo-code)
import runway

client = runway.Client(api_key="your-api-key")

# Generate animation from a still image
task = client.image_to_video.create(
    model="gen3a_turbo",
    prompt_image="hero_image.png",
    prompt_text="camera slowly zooms in, cherry blossom petals falling gently, "
                "soft wind blowing through hair, cinematic lighting",
    duration=10,            # Up to 10 seconds
    ratio="16:9",
    watermark=False,
)

# Retrieve the generated result
result = task.wait()
result.download("output_animation.mp4")
```

### 2.2 Stable Video Diffusion

```python
# Stable Video Diffusion (local execution)
import torch
from diffusers import StableVideoDiffusionPipeline
from diffusers.utils import load_image

pipe = StableVideoDiffusionPipeline.from_pretrained(
    "stabilityai/stable-video-diffusion-img2vid-xt",
    torch_dtype=torch.float16,
    variant="fp16",
)
pipe.to("cuda")

# Load input image
image = load_image("input_scene.png")
image = image.resize((1024, 576))

# Generate video
frames = pipe(
    image,
    decode_chunk_size=8,
    motion_bucket_id=127,    # Amount of motion (0-255)
    noise_aug_strength=0.02,
    num_frames=25,
).frames[0]

# Save as GIF / MP4
from diffusers.utils import export_to_video
export_to_video(frames, "svd_output.mp4", fps=7)
```

### 2.3 AnimateDiff

```python
# AnimateDiff: Stable Diffusion + Motion Generation
import torch
from diffusers import AnimateDiffPipeline, MotionAdapter, DDIMScheduler

# Load motion adapter
adapter = MotionAdapter.from_pretrained("guoyww/animatediff-motion-adapter-v1-5-3")

pipe = AnimateDiffPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    motion_adapter=adapter,
    torch_dtype=torch.float16,
)
pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
pipe.to("cuda")

# Generate video from text
output = pipe(
    prompt="a cat walking on a sunny garden path, anime style, "
           "detailed fur, soft shadows, studio ghibli",
    negative_prompt="blurry, low quality, distorted",
    num_frames=16,
    guidance_scale=7.5,
    num_inference_steps=25,
)

frames = output.frames[0]
export_to_video(frames, "animatediff_cat.mp4", fps=8)
```

### 2.4 AnimateDiff + ControlNet for Advanced Control

```python
# AnimateDiff + SparseCtrl: Video generation with keyframe specification
import torch
from diffusers import (
    AnimateDiffSparseControlNetPipeline,
    MotionAdapter,
    SparseControlNetModel,
    AutoencoderKL,
)
from diffusers.utils import load_image, export_to_video

# SparseCtrl: Control the entire video with a few keyframes
controlnet = SparseControlNetModel.from_pretrained(
    "guoyww/animatediff-sparsectrl-scribble",
    torch_dtype=torch.float16,
)

motion_adapter = MotionAdapter.from_pretrained(
    "guoyww/animatediff-motion-adapter-v1-5-3",
    torch_dtype=torch.float16,
)

vae = AutoencoderKL.from_pretrained(
    "stabilityai/sd-vae-ft-mse",
    torch_dtype=torch.float16,
)

pipe = AnimateDiffSparseControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    motion_adapter=motion_adapter,
    controlnet=controlnet,
    vae=vae,
    torch_dtype=torch.float16,
).to("cuda")

# Specify keyframe images
# Assign sketches to frame 0 and frame 15, interpolating between them
keyframe_images = {
    0: load_image("sketch_frame_0.png"),   # Start pose
    15: load_image("sketch_frame_15.png"), # End pose
}

# Conditioning mask for control images
conditioning_frames = [keyframe_images.get(i) for i in range(16)]

output = pipe(
    prompt="a warrior drawing a sword, dynamic action, anime style",
    negative_prompt="blurry, static, low quality",
    num_frames=16,
    conditioning_frames=conditioning_frames,
    controlnet_conditioning_scale=0.7,
    num_inference_steps=25,
    guidance_scale=7.5,
)

export_to_video(output.frames[0], "controlled_animation.mp4", fps=8)
```

### 2.5 Frame Interpolation with RIFE

```python
# RIFE: Real-Time Intermediate Flow Estimation
# Improve the frame rate of generated videos
import torch
from PIL import Image
import numpy as np

class RIFEInterpolator:
    """Frame interpolation pipeline using RIFE"""

    def __init__(self, model_path: str = "pretrained/rife_v4.6"):
        from model.RIFE import Model
        self.model = Model()
        self.model.load_model(model_path)
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def interpolate_pair(
        self, frame1: np.ndarray, frame2: np.ndarray, ratio: float = 0.5
    ) -> np.ndarray:
        """Generate an intermediate frame between two frames"""
        # numpy -> tensor
        img1 = torch.from_numpy(frame1).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        img2 = torch.from_numpy(frame2).permute(2, 0, 1).unsqueeze(0).float() / 255.0
        img1 = img1.to(self.device)
        img2 = img2.to(self.device)

        with torch.no_grad():
            mid = self.model.inference(img1, img2, timestep=ratio)

        result = (mid[0].permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)
        return result

    def upscale_fps(
        self, frames: list[np.ndarray], target_multiplier: int = 4
    ) -> list[np.ndarray]:
        """
        Multiply the FPS of a frame list
        target_multiplier=2: 2x (8fps -> 16fps)
        target_multiplier=4: 4x (8fps -> 32fps)
        """
        result = []
        for i in range(len(frames) - 1):
            result.append(frames[i])
            # Recursively generate intermediate frames
            self._recursive_interpolate(
                frames[i], frames[i + 1], result,
                depth=0, max_depth=int(np.log2(target_multiplier))
            )
        result.append(frames[-1])
        return result

    def _recursive_interpolate(
        self, f1, f2, result_list, depth, max_depth
    ):
        if depth >= max_depth:
            return
        mid = self.interpolate_pair(f1, f2, 0.5)
        self._recursive_interpolate(f1, mid, result_list, depth + 1, max_depth)
        result_list.append(mid)
        self._recursive_interpolate(mid, f2, result_list, depth + 1, max_depth)


# Usage example: Interpolate from 8fps to 32fps
interpolator = RIFEInterpolator()
original_frames = load_video_frames("animatediff_output.mp4")  # 16 frames, 8fps
smooth_frames = interpolator.upscale_fps(original_frames, target_multiplier=4)
save_video(smooth_frames, "smooth_animation.mp4", fps=32)
print(f"Original: {len(original_frames)} frames -> Interpolated: {len(smooth_frames)} frames")
```

---

## 3. Character Animation

### 3.1 Pose Control

```
Motion Transfer Workflow

  Reference Video (Person dancing)
  +------------------+
  | [Dance footage]  |
  +--------+---------+
           |
  [Pose estimation with DWPose]
           |
  +--------v---------+
  | [Pose sequence]  |  <- Continuous frames of stick figures
  +--------+---------+
           |
  [ControlNet + AnimateDiff]
           |
  +--------v---------+
  | [Video of the    |  <- Character reproduces the same movements
  |  character doing |
  |  the same dance] |
  +------------------+
```

### 3.2 Pose Estimation Pipeline Implementation

```python
# Complete motion transfer pipeline using DWPose + ControlNet
import cv2
import numpy as np
from controlnet_aux import DWposeDetector
from PIL import Image

class MotionTransferPipeline:
    """Transfer motion from a reference video to a character"""

    def __init__(self):
        self.pose_detector = DWposeDetector()
        self.video_frames = []
        self.pose_frames = []

    def extract_poses_from_video(
        self, video_path: str, target_fps: int = 8
    ) -> list[Image.Image]:
        """Extract pose sequences from a reference video"""
        cap = cv2.VideoCapture(video_path)
        original_fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = max(1, int(original_fps / target_fps))

        poses = []
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                # BGR -> RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_frame = Image.fromarray(rgb_frame)

                # Pose estimation
                pose_image = self.pose_detector(pil_frame)
                poses.append(pose_image)
                self.video_frames.append(pil_frame)

            frame_idx += 1

        cap.release()
        self.pose_frames = poses
        return poses

    def apply_to_character(
        self,
        character_prompt: str,
        negative_prompt: str = "blurry, low quality",
        controlnet_scale: float = 0.8,
    ) -> list[Image.Image]:
        """Apply extracted poses to a character"""
        import torch
        from diffusers import (
            AnimateDiffPipeline,
            MotionAdapter,
            ControlNetModel,
        )

        # ControlNet (OpenPose) + AnimateDiff
        controlnet = ControlNetModel.from_pretrained(
            "lllyasviel/control_v11p_sd15_openpose",
            torch_dtype=torch.float16,
        )

        adapter = MotionAdapter.from_pretrained(
            "guoyww/animatediff-motion-adapter-v1-5-3"
        )

        pipe = AnimateDiffPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            motion_adapter=adapter,
            torch_dtype=torch.float16,
        ).to("cuda")

        # Generate video with pose conditioning
        output = pipe(
            prompt=character_prompt,
            negative_prompt=negative_prompt,
            num_frames=len(self.pose_frames),
            conditioning_frames=self.pose_frames,
            controlnet_conditioning_scale=controlnet_scale,
            num_inference_steps=25,
            guidance_scale=7.5,
        )

        return output.frames[0]

    def create_comparison_video(
        self, character_frames: list, output_path: str, fps: int = 8
    ):
        """Output the original and character videos side by side for comparison"""
        import ffmpeg

        comparison_frames = []
        for orig, char in zip(self.video_frames, character_frames):
            orig_resized = orig.resize(char.size)
            # Combine horizontally
            combined = Image.new(
                "RGB",
                (orig_resized.width + char.width, char.height)
            )
            combined.paste(orig_resized, (0, 0))
            combined.paste(char, (orig_resized.width, 0))
            comparison_frames.append(combined)

        # Save as video
        from diffusers.utils import export_to_video
        export_to_video(comparison_frames, output_path, fps=fps)


# Usage example
pipeline = MotionTransferPipeline()

# 1. Extract poses from reference video
poses = pipeline.extract_poses_from_video("dance_reference.mp4", target_fps=8)
print(f"Extracted poses: {len(poses)}")

# 2. Apply to character
character_frames = pipeline.apply_to_character(
    character_prompt="a magical girl in sailor uniform, "
                     "anime style, studio ghibli, detailed",
    controlnet_scale=0.75,
)

# 3. Output comparison video
pipeline.create_comparison_video(character_frames, "comparison.mp4")
```

### 3.3 Facial Expression Animation (LivePortrait)

```python
# LivePortrait: Apply facial expression animation to a still image
# Pipeline for real-time facial expression control

class LivePortraitAnimator:
    """Real-time facial expression control for face images"""

    def __init__(self, model_path: str = "pretrained/liveportrait"):
        self.model = self._load_model(model_path)
        self.expression_params = {
            "smile": {"mouth_open": 0.0, "lip_corner_raise": 0.6, "eye_blink": 0.0},
            "surprise": {"mouth_open": 0.7, "lip_corner_raise": 0.0, "eye_wide": 0.8},
            "wink_left": {"eye_blink_left": 0.9, "lip_corner_raise": 0.3},
            "talking": None,  # Auto-generated from audio
        }

    def animate_with_expression(
        self,
        source_image: str,
        expression: str,
        duration: float = 2.0,
        fps: int = 30,
    ) -> list:
        """Apply facial expression animation to a still image"""
        from PIL import Image
        import numpy as np

        source = Image.open(source_image)
        n_frames = int(duration * fps)
        params = self.expression_params.get(expression, {})

        frames = []
        for i in range(n_frames):
            t = i / n_frames
            # Use an easing function for natural movement
            eased_t = self._ease_in_out(t)

            # Interpolate expression parameters
            current_params = {
                k: v * eased_t for k, v in params.items()
            } if params else {}

            frame = self.model.generate(
                source=source,
                expression_params=current_params,
            )
            frames.append(frame)

        return frames

    def animate_with_audio(
        self,
        source_image: str,
        audio_path: str,
        emotion: str = "neutral",
    ) -> list:
        """Lip-sync animation synchronized with audio"""
        # Extract audio -> text -> phonemes using Whisper
        from audio_utils import extract_phonemes

        phonemes = extract_phonemes(audio_path)

        # Phoneme to mouth shape mapping
        viseme_map = {
            "a": {"mouth_open": 0.7, "lip_width": 0.6},
            "i": {"mouth_open": 0.3, "lip_width": 0.8},
            "u": {"mouth_open": 0.4, "lip_width": 0.3},
            "e": {"mouth_open": 0.5, "lip_width": 0.7},
            "o": {"mouth_open": 0.6, "lip_width": 0.4},
            "m": {"mouth_open": 0.0, "lip_press": 0.8},
            "silence": {"mouth_open": 0.0, "lip_width": 0.5},
        }

        frames = []
        for phoneme_data in phonemes:
            viseme = viseme_map.get(phoneme_data["phoneme"], viseme_map["silence"])
            frame = self.model.generate(
                source=Image.open(source_image),
                expression_params={**viseme, "emotion": emotion},
            )
            frames.append(frame)

        return frames

    @staticmethod
    def _ease_in_out(t: float) -> float:
        """Smooth easing function (cubic)"""
        if t < 0.5:
            return 4 * t * t * t
        else:
            return 1 - (-2 * t + 2) ** 3 / 2
```

### 3.4 Loop Animation

```python
# Tips for generating loop animations
# Configure so that the first and last frames connect smoothly

def create_loop_animation(pipe, prompt, num_frames=16):
    """Generate a loopable animation"""
    # Normal generation
    output = pipe(prompt=prompt, num_frames=num_frames + 4)
    frames = output.frames[0]

    # Crossfade the last 4 frames into the first frame
    loop_frames = []
    for i in range(num_frames):
        if i < num_frames - 4:
            loop_frames.append(frames[i])
        else:
            # Crossfade
            alpha = (i - (num_frames - 4)) / 4.0
            blended = blend_frames(frames[i], frames[i - num_frames], alpha)
            loop_frames.append(blended)

    return loop_frames


def create_ping_pong_loop(frames: list) -> list:
    """Ping-pong loop: Create a natural loop by playing forward and backward"""
    # Original frames + reversed frames (excluding the first and last)
    forward = frames
    backward = frames[-2:0:-1]  # Reversed order excluding the last and first
    return forward + backward


class AdvancedLoopCreator:
    """Advanced loop animation generation"""

    def __init__(self, interpolator=None):
        self.interpolator = interpolator  # Frame interpolator such as RIFE

    def create_seamless_loop(
        self,
        frames: list,
        blend_frames: int = 4,
        method: str = "crossfade",
    ) -> list:
        """Create a seamless loop"""
        if method == "crossfade":
            return self._crossfade_loop(frames, blend_frames)
        elif method == "optical_flow":
            return self._optical_flow_loop(frames, blend_frames)
        elif method == "pingpong":
            return create_ping_pong_loop(frames)
        else:
            raise ValueError(f"Unknown method: {method}")

    def _crossfade_loop(self, frames, n_blend):
        """Loop connection using crossfade"""
        import numpy as np
        result = []
        total = len(frames)

        for i in range(total):
            if i < total - n_blend:
                result.append(frames[i])
            else:
                # Blend region
                blend_idx = i - (total - n_blend)
                alpha = blend_idx / n_blend
                # Blend frame i and frame (blend_idx)
                f1 = np.array(frames[i], dtype=np.float32)
                f2 = np.array(frames[blend_idx], dtype=np.float32)
                blended = (f1 * (1 - alpha) + f2 * alpha).astype(np.uint8)
                result.append(blended)

        return result

    def _optical_flow_loop(self, frames, n_blend):
        """High-quality loop connection using optical flow"""
        import cv2
        import numpy as np

        result = frames[:len(frames) - n_blend]

        for i in range(n_blend):
            alpha = i / n_blend
            idx_end = len(frames) - n_blend + i
            idx_start = i

            # Estimate motion using optical flow
            f_end = np.array(frames[idx_end])
            f_start = np.array(frames[idx_start])

            gray_end = cv2.cvtColor(f_end, cv2.COLOR_RGB2GRAY)
            gray_start = cv2.cvtColor(f_start, cv2.COLOR_RGB2GRAY)

            flow = cv2.calcOpticalFlowFarneback(
                gray_end, gray_start,
                None, 0.5, 3, 15, 3, 5, 1.2, 0
            )

            # Warp with flow and blend
            h, w = f_end.shape[:2]
            flow_map = np.column_stack([
                np.tile(np.arange(w), h),
                np.repeat(np.arange(h), w),
            ]).reshape(h, w, 2).astype(np.float32)
            flow_map += flow * alpha

            warped = cv2.remap(
                f_end, flow_map[:, :, 0], flow_map[:, :, 1],
                cv2.INTER_LINEAR
            )

            blended = (warped * (1 - alpha) + f_start * alpha).astype(np.uint8)
            result.append(blended)

        return result
```

---

## 4. Tool Comparison Tables

### 4.1 Feature Comparison of Major Tools

| Feature | Runway Gen-3 | Pika | SVD | AnimateDiff | Sora |
|---------|:-----------:|:----:|:---:|:-----------:|:----:|
| Input | Image+Text | Image+Text | Image | Text | Text |
| Max Length | 10s | 4s | 4s | 2s | 60s |
| Resolution | 1280x768 | 1024x576 | 1024x576 | 512x512 | 1920x1080 |
| Customization | Medium | Low | High | Highest | Low |
| Pricing | $12-76/mo | $8-58/mo | Free (OSS) | Free (OSS) | Limited |
| GPU Requirements | Cloud | Cloud | VRAM 16GB+ | VRAM 12GB+ | Cloud |

### 4.2 Recommendations by Use Case

| Use Case | Recommended Tool | Reason |
|----------|-----------------|--------|
| Social media short videos | Pika | Easy operation, fast |
| Promotional videos | Runway Gen-3 | High quality, long-form support |
| Anime-style content | AnimateDiff | Flexible style control |
| Research / Experiments | SVD | Open source, customizable |
| Music videos | Runway Gen-3 | Motion Brush support |
| Character PVs | AnimateDiff + ControlNet | Pose control available |
| Educational content | Pika | Cost-effective |
| Film previsualization | Sora | Long-form, high quality |

### 4.3 Technical Element Comparison

| Element | AnimateDiff | SVD | Runway Gen-3 | Sora |
|---------|:----------:|:---:|:-----------:|:----:|
| Text Comprehension | Medium (CLIP) | None | High | Highest |
| Consistency | Medium | High | High | Very High |
| Physics Compliance | Low | Medium | Medium | High |
| Camera Control | LoRA/ControlNet | Limited | Motion Brush | Auto-estimated |
| LoRA Support | Yes | Limited | No | No |
| ControlNet Support | Yes | Limited | No | No |
| Offline Execution | Possible | Possible | Not possible | Not possible |
| API Availability | None (local) | None (local) | Yes | Yes |

---

## 5. Production Pipeline

### 5.1 Commercial Animation Production Flow

```
+-- Phase 1: Planning ------------------------------------+
|                                                         |
|  Create storyboard (Canva AI / Midjourney)              |
|       |                                                 |
|       v                                                 |
|  Scene breakdown (3-5s each, camera work design)        |
|       |                                                 |
|       v                                                 |
|  Generate reference images (Stable Diffusion + LoRA)    |
|  * Maintain character consistency with IP-Adapter       |
|                                                         |
+---------------------------------------------------------+
       |
       v
+-- Phase 2: Generation ----------------------------------+
|                                                         |
|  Generate each shot with AI                             |
|  +-- Image-to-Video (Runway Gen-3)                      |
|  +-- AnimateDiff (anime style)                          |
|  +-- Motion transfer (ControlNet + DWPose)              |
|       |                                                 |
|       v                                                 |
|  Quality screening (select best from 5 candidates)      |
|  +-- Temporal consistency check                         |
|  +-- Character similarity check                         |
|  +-- Motion naturalness check                           |
|                                                         |
+---------------------------------------------------------+
       |
       v
+-- Phase 3: Post-processing -----------------------------+
|                                                         |
|  Frame interpolation (RIFE: 8fps -> 30fps)              |
|       |                                                 |
|       v                                                 |
|  Upscale (Real-ESRGAN: 512 -> 1080p)                   |
|       |                                                 |
|       v                                                 |
|  Color correction (DaVinci Resolve)                     |
|       |                                                 |
|       v                                                 |
|  Add transitions (connections between scenes)           |
|       |                                                 |
|       v                                                 |
|  Add music, sound effects, and narration                |
|       |                                                 |
|       v                                                 |
|  Final render (H.264/H.265, 1080p/4K)                  |
|                                                         |
+---------------------------------------------------------+
```

### 5.2 Efficiency through Batch Processing

```python
# Automated batch generation pipeline for multiple shots
import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

@dataclass
class ShotConfig:
    """Shot configuration"""
    shot_id: str
    reference_image: str
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted"
    duration: float = 4.0
    camera_move: str = "static"
    num_candidates: int = 5

class BatchAnimationPipeline:
    """Batch generation and management of multiple shots"""

    def __init__(self, output_dir: str = "./production"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.quality_threshold = 0.7

    async def generate_all_shots(
        self, shots: list[ShotConfig]
    ) -> dict[str, str]:
        """Generate all shots in parallel"""
        results = {}
        tasks = [self._generate_shot(shot) for shot in shots]
        completed = await asyncio.gather(*tasks)

        for shot, best_path in zip(shots, completed):
            results[shot.shot_id] = best_path

        return results

    async def _generate_shot(self, shot: ShotConfig) -> str:
        """Generate candidates for one shot and select by quality"""
        candidates = []
        shot_dir = self.output_dir / shot.shot_id
        shot_dir.mkdir(exist_ok=True)

        for i in range(shot.num_candidates):
            output_path = shot_dir / f"candidate_{i}.mp4"
            await self._generate_single(shot, output_path, seed=i * 1000)
            quality = await self._evaluate_quality(output_path)
            candidates.append((output_path, quality))
            print(f"  {shot.shot_id} candidate {i}: quality score {quality:.2f}")

        # Select the highest quality candidate
        best = max(candidates, key=lambda x: x[1])
        if best[1] < self.quality_threshold:
            print(f"  Warning: {shot.shot_id} best quality is below threshold ({best[1]:.2f})")

        return str(best[0])

    async def _generate_single(
        self, shot: ShotConfig, output_path: Path, seed: int
    ):
        """Generate a single candidate video"""
        # Generate using Runway API / local model
        # (Implementation depends on API client)
        pass

    async def _evaluate_quality(self, video_path: Path) -> float:
        """Automatic video quality evaluation"""
        scores = {
            "temporal_consistency": self._check_temporal(video_path),
            "sharpness": self._check_sharpness(video_path),
            "motion_quality": self._check_motion(video_path),
        }
        return sum(scores.values()) / len(scores)

    def _check_temporal(self, path) -> float:
        """Inter-frame consistency check"""
        # Calculate frame similarity using SSIM, etc.
        return 0.8  # placeholder

    def _check_sharpness(self, path) -> float:
        """Sharpness check"""
        return 0.85  # placeholder

    def _check_motion(self, path) -> float:
        """Motion quality check"""
        return 0.75  # placeholder

    def concatenate_shots(
        self, shot_paths: dict[str, str], output_path: str,
        transition: str = "crossfade", transition_duration: float = 0.5,
    ):
        """Combine multiple shots into the final video"""
        import subprocess

        # Combine using FFmpeg filter complex
        inputs = []
        filter_parts = []
        for i, (shot_id, path) in enumerate(sorted(shot_paths.items())):
            inputs.extend(["-i", path])
            filter_parts.append(f"[{i}:v]")

        # Crossfade filter
        if transition == "crossfade":
            concat_filter = "".join(filter_parts)
            concat_filter += f"concat=n={len(shot_paths)}:v=1:a=0[outv]"
        else:
            concat_filter = "".join(filter_parts)
            concat_filter += f"concat=n={len(shot_paths)}:v=1:a=0[outv]"

        cmd = [
            "ffmpeg", *inputs,
            "-filter_complex", concat_filter,
            "-map", "[outv]",
            "-c:v", "libx264", "-crf", "18",
            output_path,
        ]
        subprocess.run(cmd, check=True)


# Usage example
shots = [
    ShotConfig(
        shot_id="shot_01",
        reference_image="ref/castle.png",
        prompt="majestic castle, camera slowly zooms in, morning mist",
        camera_move="dolly_in",
    ),
    ShotConfig(
        shot_id="shot_02",
        reference_image="ref/garden.png",
        prompt="beautiful garden, cherry blossoms falling, gentle wind",
        camera_move="pan_right",
    ),
    ShotConfig(
        shot_id="shot_03",
        reference_image="ref/character.png",
        prompt="anime girl turns around and smiles, hair flowing",
        camera_move="static",
    ),
]

pipeline = BatchAnimationPipeline(output_dir="./my_animation")
# results = asyncio.run(pipeline.generate_all_shots(shots))
```

---

## 6. Character Consistency Maintenance Techniques

### 6.1 Consistency Control with IP-Adapter

```python
# IP-Adapter: Fix character appearance using a reference image
import torch
from diffusers import AnimateDiffPipeline, MotionAdapter
from ip_adapter import IPAdapter

class ConsistentCharacterAnimator:
    """Animation generation with character consistency maintenance"""

    def __init__(self):
        self.adapter = MotionAdapter.from_pretrained(
            "guoyww/animatediff-motion-adapter-v1-5-3"
        )
        self.pipe = AnimateDiffPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            motion_adapter=self.adapter,
            torch_dtype=torch.float16,
        ).to("cuda")

        # Apply IP-Adapter
        self.ip_adapter = IPAdapter(
            self.pipe,
            image_encoder_path="models/image_encoder",
            ip_ckpt="models/ip-adapter_sd15.bin",
            device="cuda",
        )

    def generate_consistent_shots(
        self,
        character_reference: str,
        shot_prompts: list[str],
        ip_scale: float = 0.6,
    ) -> list:
        """Generate multiple shots with the same character"""
        from PIL import Image

        ref_image = Image.open(character_reference)
        results = []

        for prompt in shot_prompts:
            output = self.ip_adapter.generate(
                prompt=prompt,
                negative_prompt="blurry, inconsistent, different character",
                pil_image=ref_image,
                scale=ip_scale,  # Reference image influence (0.4-0.8 recommended)
                num_frames=16,
                num_inference_steps=25,
            )
            results.append(output.frames[0])

        return results


# Usage example
animator = ConsistentCharacterAnimator()
shots = animator.generate_consistent_shots(
    character_reference="my_character.png",
    shot_prompts=[
        "character walking through a forest, sunlight filtering through trees",
        "character sitting by a lake, looking at reflection",
        "character standing on a cliff, wind blowing cape",
    ],
    ip_scale=0.65,
)
```

### 6.2 Style Fixation with LoRA

```python
# Fix character/style with LoRA training
from diffusers import AnimateDiffPipeline, MotionAdapter

def setup_consistent_pipeline(
    base_model: str = "runwayml/stable-diffusion-v1-5",
    character_lora: str = "path/to/character_lora.safetensors",
    style_lora: str = "path/to/style_lora.safetensors",
    character_weight: float = 0.8,
    style_weight: float = 0.6,
):
    """Pipeline combining character + style LoRAs"""
    import torch

    adapter = MotionAdapter.from_pretrained(
        "guoyww/animatediff-motion-adapter-v1-5-3"
    )

    pipe = AnimateDiffPipeline.from_pretrained(
        base_model,
        motion_adapter=adapter,
        torch_dtype=torch.float16,
    ).to("cuda")

    # Character LoRA
    pipe.load_lora_weights(
        character_lora,
        adapter_name="character",
    )

    # Style LoRA
    pipe.load_lora_weights(
        style_lora,
        adapter_name="style",
    )

    # Set weights
    pipe.set_adapters(
        ["character", "style"],
        adapter_weights=[character_weight, style_weight],
    )

    return pipe


# Example LoRA training command for character
LORA_TRAINING_CONFIG = """
# LoRA training with Kohya-ss sd-scripts
# Example configuration for character training

accelerate launch train_network.py \\
    --pretrained_model_name_or_path="runwayml/stable-diffusion-v1-5" \\
    --train_data_dir="./training_images/my_character" \\
    --output_dir="./lora_output" \\
    --output_name="my_character_lora" \\
    --network_module=networks.lora \\
    --network_dim=128 \\
    --network_alpha=64 \\
    --resolution=512 \\
    --train_batch_size=1 \\
    --learning_rate=1e-4 \\
    --max_train_steps=1000 \\
    --caption_extension=".txt" \\
    --mixed_precision="fp16" \\
    --save_every_n_steps=200
"""
```

---

## 7. Performance Optimization

### 7.1 GPU Memory Optimization

```python
# Collection of memory optimization techniques for AnimateDiff
import torch

def optimize_pipeline_memory(pipe):
    """Optimize memory usage"""

    # 1. Attention Slicing (reduces memory, may slow down speed)
    pipe.enable_attention_slicing(slice_size="auto")

    # 2. VAE Slicing (effective for large frame counts)
    pipe.enable_vae_slicing()

    # 3. CPU Offload (when VRAM is insufficient)
    pipe.enable_model_cpu_offload()

    # 4. xFormers (speed improvement + memory reduction)
    try:
        pipe.enable_xformers_memory_efficient_attention()
        print("xFormers enabled successfully")
    except ImportError:
        print("xFormers not installed, using standard Attention")

    return pipe


# Memory usage guidelines
MEMORY_REQUIREMENTS = """
AnimateDiff Memory Requirements (16-frame generation)

| Configuration             | VRAM Usage | Generation Speed |
|--------------------------|-----------|-----------------|
| FP32 (no optimization)    | ~16GB    | Slow            |
| FP16                      | ~10GB    | Standard        |
| FP16 + Attention Slicing  | ~8GB     | Slightly slow   |
| FP16 + xFormers           | ~7GB     | Fast            |
| FP16 + CPU Offload        | ~5GB     | Slow            |

SVD Memory Requirements (25-frame generation)

| Configuration             | VRAM Usage | Generation Speed |
|--------------------------|-----------|-----------------|
| FP16                      | ~16GB    | Standard        |
| FP16 + decode_chunk=8     | ~12GB    | Slightly slow   |
| FP16 + CPU Offload        | ~8GB     | Slow            |
"""
```

### 7.2 Quality vs. Speed Trade-off Settings

```python
# Quality/speed presets by use case
QUALITY_PRESETS = {
    "draft": {
        "description": "For fast preview",
        "num_inference_steps": 10,
        "guidance_scale": 5.0,
        "num_frames": 8,
        "width": 256,
        "height": 256,
        "fps": 4,
        "estimated_time": "~5 seconds",
    },
    "standard": {
        "description": "For social media posts",
        "num_inference_steps": 20,
        "guidance_scale": 7.5,
        "num_frames": 16,
        "width": 512,
        "height": 512,
        "fps": 8,
        "estimated_time": "~30 seconds",
    },
    "high": {
        "description": "For promotions",
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "num_frames": 24,
        "width": 768,
        "height": 768,
        "fps": 12,
        "estimated_time": "~2 minutes",
    },
    "production": {
        "description": "For final delivery",
        "num_inference_steps": 40,
        "guidance_scale": 8.0,
        "num_frames": 32,
        "width": 1024,
        "height": 576,
        "fps": 24,
        "estimated_time": "~5 minutes",
        "post_processing": ["rife_interpolation", "realesrgan_upscale"],
    },
}
```

---

## 8. Troubleshooting

### 8.1 Common Problems and Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Flickering | Insufficient inter-frame consistency | Lower motion_bucket_id / Adjust guidance_scale |
| Character face changes | Insufficient consistency control | Use IP-Adapter / LoRA |
| Too little motion | Low motion parameter | Increase motion_bucket_id (SVD) |
| Too much motion | High motion parameter | Lower motion_bucket_id / Lower noise_aug_strength |
| Out of VRAM | Insufficient memory optimization | Enable attention_slicing / cpu_offload |
| Slow generation | Settings too heavy | Reduce step count / Lower resolution / Use xFormers |
| Color mismatch | VAE version differences | Use unified VAE (ft-mse) |
| Discontinuity in loops | End frame mismatch | Crossfade / optical flow blending |

### 8.2 Debugging Techniques

```python
# Debugging tools for animation quality
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim

class AnimationDebugger:
    """Quality diagnostics for generated animations"""

    def analyze_temporal_consistency(self, frames: list) -> dict:
        """Analyze inter-frame consistency"""
        ssim_scores = []
        for i in range(len(frames) - 1):
            f1 = np.array(frames[i])
            f2 = np.array(frames[i + 1])
            score = ssim(f1, f2, channel_axis=2)
            ssim_scores.append(score)

        return {
            "mean_ssim": np.mean(ssim_scores),
            "min_ssim": np.min(ssim_scores),
            "max_ssim": np.max(ssim_scores),
            "std_ssim": np.std(ssim_scores),
            "flicker_frames": [
                i for i, s in enumerate(ssim_scores) if s < 0.85
            ],
            "verdict": "Good" if np.mean(ssim_scores) > 0.9 else
                       "Needs improvement" if np.mean(ssim_scores) > 0.8 else "Poor",
        }

    def analyze_motion_magnitude(self, frames: list) -> dict:
        """Analyze amount of motion"""
        import cv2
        motion_scores = []
        for i in range(len(frames) - 1):
            f1 = cv2.cvtColor(np.array(frames[i]), cv2.COLOR_RGB2GRAY)
            f2 = cv2.cvtColor(np.array(frames[i + 1]), cv2.COLOR_RGB2GRAY)
            diff = np.mean(np.abs(f1.astype(float) - f2.astype(float)))
            motion_scores.append(diff)

        return {
            "mean_motion": np.mean(motion_scores),
            "max_motion": np.max(motion_scores),
            "motion_profile": motion_scores,
            "verdict": "Too little motion" if np.mean(motion_scores) < 2.0 else
                       "Appropriate" if np.mean(motion_scores) < 15.0 else "Too much motion",
        }

    def generate_diagnostic_report(self, frames: list) -> str:
        """Generate a comprehensive diagnostic report"""
        consistency = self.analyze_temporal_consistency(frames)
        motion = self.analyze_motion_magnitude(frames)

        report = f"""
=== Animation Quality Diagnostic Report ===

Frame count: {len(frames)}

[Temporal Consistency]
  Mean SSIM: {consistency['mean_ssim']:.4f}
  Min SSIM: {consistency['min_ssim']:.4f}
  Flicker frames: {consistency['flicker_frames']}
  Verdict: {consistency['verdict']}

[Motion Amount]
  Mean motion: {motion['mean_motion']:.2f}
  Max motion: {motion['max_motion']:.2f}
  Verdict: {motion['verdict']}

[Recommended Actions]
"""
        if consistency["verdict"] != "Good":
            report += "  - Try lowering guidance_scale by 0.5-1.0\n"
            report += "  - Try lowering motion_bucket_id\n"
        if motion["verdict"] == "Too little motion":
            report += "  - Try increasing motion_bucket_id\n"
            report += "  - Add specific motion descriptions to the prompt\n"
        if motion["verdict"] == "Too much motion":
            report += "  - Try lowering motion_bucket_id\n"
            report += "  - Set noise_aug_strength to 0.01\n"

        return report
```

---

## 9. Anti-patterns

### Anti-pattern 1: Expecting a Finished Product in One Shot

```
BAD:
  Expecting a perfect 60-second animation from a single prompt
  -> Current AI is limited to 4-10 seconds; quality degrades for longer durations

GOOD: Generate shot by shot and combine in editing software
  1. Create a storyboard (each shot 4-10 seconds)
  2. Generate each shot individually with AI
  3. Combine with transitions in editing software
  4. Add BGM and sound effects
```

### Anti-pattern 2: Resolution and Frame Rate Mismatch

```
BAD:
  Generate at 512x512 -> Play on a 4K display
  -> Pixels become visible, resulting in low quality

GOOD: Generate at a resolution appropriate for the use case
  - Social media (vertical): 720x1280 is sufficient
  - YouTube: 1280x720 or higher
  - Large screens: Upscale with Real-ESRGAN after generation
```

### Anti-pattern 3: Excessive Frame Interpolation

```
BAD:
  8fps -> Interpolate to 240fps with RIFE
  -> Massive ghost/artifact generation in intermediate frames
  -> Motion becomes unnaturally "too smooth"

GOOD: Interpolate at an appropriate multiplier
  - 8fps -> 24fps (3x) is a safe upper limit
  - 8fps -> 30fps (4x) is within acceptable range
  - Higher interpolation carries high risk of quality degradation
  - Anime-style intentionally at lower FPS (12-15fps) looks more natural
```

### Anti-pattern 4: Ignoring Character Consistency Across Consecutive Shots

```
BAD:
  Generate each shot independently
  -> Character's face, clothing, and body type change per shot
  -> Creates a sense of incongruity for viewers

GOOD: Incorporate consistency maintenance mechanisms
  1. Share reference images across all shots (IP-Adapter)
  2. Train and use a character LoRA
  3. Generate with correlated seed values
  4. Consider post-processing face swap for unification
```

---

## 10. Exercises

### Exercise 1: Basics -- Your First Animation with AnimateDiff

```
Goal: Generate a 16-frame animation GIF from a text prompt

Steps:
1. Set up the AnimateDiff pipeline
2. Generate with a landscape prompt (e.g., "ocean waves at sunset")
3. Compare guidance_scale at 5.0, 7.5, and 10.0
4. Check the effect of motion_bucket_id (if available)
5. Save as a GIF and verify loop playback

Evaluation Criteria:
- Successful generation (no errors)
- Minimal flickering
- Content aligned with the prompt
```

### Exercise 2: Intermediate -- Building a Motion Transfer Pipeline

```
Goal: Transfer poses from a reference video to an anime character

Steps:
1. Prepare a 5-10 second dance video
2. Extract pose sequences with DWPose
3. Apply to a character with ControlNet + AnimateDiff
4. Maintain character consistency with IP-Adapter
5. Interpolate frames with RIFE (8fps -> 24fps)

Evaluation Criteria:
- Accurate pose transfer
- Character consistency maintenance
- Smooth frame interpolation
```

### Exercise 3: Advanced -- Creating a 30-Second Animation PV

```
Goal: Produce a 30-second animation PV from a storyboard

Steps:
1. Design a storyboard with 6-8 shots
2. Generate character reference images with Stable Diffusion
3. Generate each shot with AnimateDiff / Runway (5 candidates each)
4. Select best candidates through quality screening
5. Post-process with RIFE + Real-ESRGAN
6. Add transitions and BGM in DaVinci Resolve
7. Final render (1080p, 30fps)

Evaluation Criteria:
- Character consistency (across all shots)
- Story communication effectiveness
- Technical quality (flickering, resolution, FPS)
- Overall completeness
```

---

## 11. FAQ

### Q1. How can I maintain AI animation consistency (preserving character appearance)?

**A.** (1) Fix the reference image and generate each cut via Image-to-Video from the same image. (2) Control poses with ControlNet while fixing appearance with IP-Adapter. (3) Train a LoRA to maintain a specific character's style. Perfect consistency is difficult with current technology, so correct minor differences in editing software.

### Q2. Can AI animations be used commercially?

**A.** It depends on the tool's terms of service. **Runway**: Commercial use allowed on paid plans. **Pika**: Commercial use allowed on paid plans. **Stable Video Diffusion**: Stability AI license (commercial use allowed, with conditions). **AnimateDiff**: Apache 2.0 license, commercial use allowed. Be cautious of similarities to existing content in generated outputs.

### Q3. What are the options if I don't have a local GPU?

**A.** (1) **Cloud APIs**: Runway and Pika run in the cloud, no GPU needed. (2) **Google Colab**: Free T4 GPU available (with limitations). (3) **Cloud GPUs**: Rent A100/H100 by the hour from Lambda Labs, Vast.ai. (4) **Apple Silicon**: Some models run on M2/M3 Macs (MPS backend). Choose based on budget and frequency.

### Q4. Which is more effective: frame interpolation (RIFE) or increasing the number of generated frames?

**A.** It depends on the situation. (1) **Increasing generated frames**: Higher motion consistency, physically correct intermediate frames. However, VRAM consumption increases and generation time grows. (2) **RIFE interpolation**: Post-processing, so it doesn't affect generation time. Low VRAM consumption. However, ghosting may occur with intense motion. **Recommendation**: A hybrid approach of first generating with an appropriate frame count (16-24) and then interpolating 2-3x with RIFE is the most efficient.

### Q5. Do recommended settings differ between anime style and live-action style?

**A.** Yes, they differ significantly. (1) **Anime style**: Low FPS (12-15fps) looks natural due to the cel-animation aesthetic. AnimateDiff + anime-specific LoRA is optimal. guidance_scale of 7-9 is recommended. (2) **Live-action style**: 24-30fps is required. SVD / Runway Gen-3 produce high quality. guidance_scale of 5-7 is recommended. RIFE interpolation also works more effectively for live-action. (3) **Common**: For both styles, specifying "blurry, low quality, distorted" in the negative prompt improves quality.

### Q6. What is the current state of audio-synchronized animation (lip sync)?

**A.** This field is rapidly evolving as of 2025. (1) **EMO (Alibaba)**: Generates facial animation from audio. High quality but resource-intensive. (2) **LivePortrait**: Real-time facial expression control. Lightweight and practical. (3) **Pika Lip Sync**: Built-in Pika feature. Convenient but limited quality. (4) **SadTalker**: Open source and stable. Medium quality. **Recommendation**: Use EMO or LivePortrait for high quality, and Pika or SadTalker for convenience.

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not only through theory but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently utilized in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Image-to-Video | Generate video from still images. Runway Gen-3 and SVD are the primary choices |
| Text-to-Video | Generate video directly from text. Sora is the highest quality but limited access |
| AnimateDiff | Stable Diffusion-based. Strong for anime style with highest customizability |
| Loop Animation | Connect first and last frames using crossfade/optical flow techniques |
| Character Consistency | Maintain with fixed reference images + ControlNet + IP-Adapter + LoRA |
| Workflow | Generate shot by shot -> Combine in editing software is the practical approach |
| Frame Interpolation | 2-3x interpolation with RIFE is safe. Excessive interpolation causes artifacts |
| Motion Transfer | DWPose -> ControlNet to apply reference video poses to characters |
| Quality Management | Automated diagnostics + multiple candidate generation + human final selection |

---

## Recommended Next Reads

- [Video Editing](./01-video-editing.md) -- Integration with AI video editing tools
- [Virtual Try-On](../03-3d/02-virtual-try-on.md) -- 3D + AI animation applications
- [Ethical Considerations](../03-3d/03-ethical-considerations.md) -- Copyright of AI-generated content

---

## References

1. **Runway Research** -- https://research.runwayml.com/ -- Technical papers on Gen-3
2. **Stable Video Diffusion** -- Stability AI (2023) -- https://stability.ai/stable-video
3. **AnimateDiff** -- Yuwei Guo et al. (2023) -- Research paper on text-to-video generation
4. **RIFE: Real-Time Intermediate Flow Estimation** -- Huang et al. (2022) -- https://arxiv.org/abs/2011.06294
5. **IP-Adapter** -- Ye et al. (2023) -- https://ip-adapter.github.io/
6. **DWPose** -- Yang et al. (2023) -- Efficient whole-body pose estimation
7. **LivePortrait** -- https://github.com/KwaiVGI/LivePortrait -- Real-time facial control
8. **SparseCtrl** -- Guo et al. (2024) -- Keyframe control extension for AnimateDiff
