# Image Generation — Stable Diffusion, DALL-E, Midjourney

> A complete guide to the features and usage of the three major image generation platforms, with practical code examples and workflow comparisons.

---

## What You Will Learn in This Chapter

1. **Running and Customizing Stable Diffusion Locally** — Using diffusers, ComfyUI, and LoRA
2. **Leveraging the DALL-E 3 API** — API design, quality control, and ChatGPT integration
3. **Using Midjourney Effectively** — Parameter control, style consistency, and workflow integration
4. **Getting Started with Flux** — Next-generation image generation with Rectified Flow Transformers
5. **Batch Generation and Automation Pipelines** — Efficient workflows for mass image generation
6. **Quality Optimization Techniques** — Scheduler selection, CFG control, and post-processing in practice

## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Stable Diffusion Ecosystem

### Code Example 1: Basic Image Generation with diffusers

```python
from diffusers import (
    StableDiffusionXLPipeline,
    DPMSolverMultistepScheduler,
    AutoencoderKL,
)
import torch

# Load VAE (using a dedicated VAE for quality improvement)
vae = AutoencoderKL.from_pretrained(
    "madebyollin/sdxl-vae-fp16-fix",
    torch_dtype=torch.float16,
)

# Load SDXL pipeline
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    vae=vae,
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
pipe.to("cuda")

# Switch sampler to a faster version
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config
)

# Generate image
image = pipe(
    prompt="A majestic Japanese castle surrounded by cherry blossoms, "
           "golden hour lighting, photorealistic, 8K",
    negative_prompt="low quality, blurry, distorted",
    num_inference_steps=25,
    guidance_scale=7.0,
    width=1024,
    height=1024,
    generator=torch.Generator("cuda").manual_seed(42),
).images[0]

image.save("castle.png")
```

### Code Example 1b: Advanced Generation with Memory Optimization

```python
from diffusers import (
    StableDiffusionXLPipeline,
    DPMSolverMultistepScheduler,
    AutoencoderKL,
)
import torch
from compel import Compel, ReturnedEmbeddingsType

# Load VAE
vae = AutoencoderKL.from_pretrained(
    "madebyollin/sdxl-vae-fp16-fix",
    torch_dtype=torch.float16,
)

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    vae=vae,
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
pipe.to("cuda")

# Various memory optimization options
pipe.enable_attention_slicing()     # Reduce attention memory usage
pipe.enable_vae_slicing()           # Reduce VAE memory usage
pipe.enable_vae_tiling()            # VAE processing for high resolutions
# pipe.enable_model_cpu_offload()   # CPU offload when VRAM is insufficient
# pipe.enable_sequential_cpu_offload()  # For extremely low VRAM situations

# Prompt weight control with Compel
compel = Compel(
    tokenizer=[pipe.tokenizer, pipe.tokenizer_2],
    text_encoder=[pipe.text_encoder, pipe.text_encoder_2],
    returned_embeddings_type=ReturnedEmbeddingsType.PENULTIMATE_HIDDEN_STATES_NON_NORMALIZED,
    requires_pooled=[False, True],
)

# Prompt weighting: (word)++ to emphasize, (word)-- to suppress
prompt = "A (majestic)++ Japanese castle, (cherry blossoms)++, golden hour"
negative = "(low quality)--, (blurry)--, distorted, watermark"

conditioning, pooled = compel(prompt)
neg_conditioning, neg_pooled = compel(negative)

image = pipe(
    prompt_embeds=conditioning,
    pooled_prompt_embeds=pooled,
    negative_prompt_embeds=neg_conditioning,
    negative_pooled_prompt_embeds=neg_pooled,
    num_inference_steps=30,
    guidance_scale=7.0,
    width=1024,
    height=1024,
).images[0]

image.save("castle_weighted.png")
```

### Code Example 2: Applying LoRA

```python
from diffusers import StableDiffusionXLPipeline
import torch

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda")

# Load and apply LoRA
pipe.load_lora_weights(
    "path/to/lora",
    weight_name="anime_style_v2.safetensors",
    adapter_name="anime_style",
)

# Adjust LoRA influence (0.0-1.0)
pipe.set_adapters(["anime_style"], adapter_weights=[0.8])

image = pipe(
    prompt="1girl, cherry blossom, detailed eyes, anime style",
    num_inference_steps=25,
).images[0]

# Applying multiple LoRAs simultaneously
pipe.load_lora_weights(
    "path/to/lora2",
    weight_name="lighting_enhance.safetensors",
    adapter_name="lighting",
)
pipe.set_adapters(
    ["anime_style", "lighting"],
    adapter_weights=[0.7, 0.5],  # Adjust weights individually
)
```

### Code Example 2b: LoRA Training (DreamBooth LoRA)

```python
"""
LoRA fine-tuning execution example
Uses the train_dreambooth_lora_sdxl.py script from diffusers
"""

# Command-line execution configuration
train_config = {
    "pretrained_model_name_or_path": "stabilityai/stable-diffusion-xl-base-1.0",
    "instance_data_dir": "./training_images",     # Training image folder (10-30 images recommended)
    "output_dir": "./my_lora_model",
    "instance_prompt": "a photo of sks dog",      # sks is the trigger word
    "resolution": 1024,
    "train_batch_size": 1,
    "gradient_accumulation_steps": 4,
    "learning_rate": 1e-4,
    "lr_scheduler": "cosine",
    "lr_warmup_steps": 100,
    "max_train_steps": 1000,
    "rank": 32,                                    # LoRA rank (4-128)
    "seed": 42,
    "mixed_precision": "fp16",
    "use_8bit_adam": True,                         # Memory saving
    "gradient_checkpointing": True,                # Memory saving
    "prior_preservation": True,                    # Prevent overfitting
    "prior_preservation_class_prompt": "a photo of a dog",
    "num_class_images": 100,
}

# Generate training command using accelerate
def generate_train_command(config):
    cmd = "accelerate launch train_dreambooth_lora_sdxl.py"
    for key, value in config.items():
        if isinstance(value, bool):
            if value:
                cmd += f" --{key}"
        else:
            cmd += f" --{key}={value}"
    return cmd

print(generate_train_command(train_config))

# Using the LoRA after training
# pipe.load_lora_weights("./my_lora_model", weight_name="pytorch_lora_weights.safetensors")
# image = pipe("a photo of sks dog in a garden", num_inference_steps=25).images[0]
```

### Code Example 2c: Structural Control with ControlNet

```python
from diffusers import (
    StableDiffusionXLControlNetPipeline,
    ControlNetModel,
    AutoencoderKL,
)
from diffusers.utils import load_image
from controlnet_aux import CannyDetector, OpenposeDetector, MidasDetector
import torch
from PIL import Image

# --- Canny Edge ControlNet ---
controlnet_canny = ControlNetModel.from_pretrained(
    "diffusers/controlnet-canny-sdxl-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
)

vae = AutoencoderKL.from_pretrained(
    "madebyollin/sdxl-vae-fp16-fix",
    torch_dtype=torch.float16,
)

pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnet_canny,
    vae=vae,
    torch_dtype=torch.float16,
    variant="fp16",
)
pipe.to("cuda")
pipe.enable_model_cpu_offload()

# Edge detection
canny = CannyDetector()
source_image = load_image("reference_building.png")
canny_image = canny(source_image, low_threshold=100, high_threshold=200)

# Generate image based on edges
image = pipe(
    prompt="A futuristic glass skyscraper, same structure as reference, "
           "cyberpunk city, neon lights, night scene, photorealistic",
    negative_prompt="low quality, blurry",
    image=canny_image,
    controlnet_conditioning_scale=0.7,  # ControlNet influence strength
    num_inference_steps=30,
    guidance_scale=7.5,
).images[0]

image.save("controlnet_building.png")


# --- OpenPose ControlNet ---
controlnet_pose = ControlNetModel.from_pretrained(
    "thibaud/controlnet-openpose-sdxl-1.0",
    torch_dtype=torch.float16,
)
pipe_pose = StableDiffusionXLControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnet_pose,
    vae=vae,
    torch_dtype=torch.float16,
)
pipe_pose.to("cuda")

# Pose detection
openpose = OpenposeDetector.from_pretrained("lllyasviel/Annotators")
pose_image = openpose(load_image("person_reference.png"))

# Generate image based on pose
image_pose = pipe_pose(
    prompt="A samurai warrior in traditional armor, dynamic pose, "
           "detailed, concept art, dramatic lighting",
    image=pose_image,
    controlnet_conditioning_scale=0.8,
    num_inference_steps=30,
).images[0]

image_pose.save("controlnet_samurai.png")


# --- Depth ControlNet ---
controlnet_depth = ControlNetModel.from_pretrained(
    "diffusers/controlnet-depth-sdxl-1.0",
    torch_dtype=torch.float16,
)
pipe_depth = StableDiffusionXLControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnet_depth,
    vae=vae,
    torch_dtype=torch.float16,
)
pipe_depth.to("cuda")

# Depth map estimation
midas = MidasDetector.from_pretrained("lllyasviel/Annotators")
depth_image = midas(load_image("room_photo.png"))

# Interior design conversion based on depth
image_depth = pipe_depth(
    prompt="Modern Japanese interior, tatami room, shoji screens, "
           "natural light, same spatial layout, interior design magazine",
    image=depth_image,
    controlnet_conditioning_scale=0.6,
    num_inference_steps=30,
).images[0]

image_depth.save("controlnet_interior.png")
```

### ASCII Diagram 1: Overall Stable Diffusion Pipeline Architecture

```
┌─────────────── Stable Diffusion Pipeline ────────────────┐
│                                                           │
│  Text Input                                               │
│      │                                                    │
│      v                                                    │
│  ┌──────────────┐                                         │
│  │ Text Encoder │  CLIP (SD1.5) / CLIP+OpenCLIP (SDXL)   │
│  │ (Tokenize)   │  / T5+CLIP (SD3/Flux)                   │
│  └──────┬───────┘                                         │
│         │ Text Embeddings                                 │
│         v                                                 │
│  ┌──────────────────────────────────────┐                  │
│  │         UNet / DiT                   │                  │
│  │  ┌─────────┐  ┌─────────────────┐   │  ← Noise        │
│  │  │ Self-   │  │ Cross-Attention │   │    (Latent       │
│  │  │Attention│  │ (Text Condition)│   │     Space)       │
│  │  └─────────┘  └─────────────────┘   │                  │
│  │  × N Steps (Reverse Diffusion)      │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │ Denoised Latent Representation           │
│                 v                                          │
│  ┌──────────────┐                                         │
│  │ VAE Decoder  │  Latent Space → Pixel Space             │
│  │ (4x64x64 →  │                                         │
│  │  3x512x512)  │                                         │
│  └──────┬───────┘                                         │
│         │                                                 │
│         v                                                 │
│     Generated Image                                       │
└───────────────────────────────────────────────────────────┘
```

### Code Example 2d: Scheduler (Sampler) Comparison and Selection

```python
from diffusers import (
    StableDiffusionXLPipeline,
    DPMSolverMultistepScheduler,
    EulerDiscreteScheduler,
    EulerAncestralDiscreteScheduler,
    UniPCMultistepScheduler,
    KDPM2AncestralDiscreteScheduler,
    HeunDiscreteScheduler,
    DDIMScheduler,
)
import torch
import time

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda")

# Scheduler list and characteristics
schedulers = {
    "DPM++ 2M Karras": {
        "class": DPMSolverMultistepScheduler,
        "config": {"use_karras_sigmas": True, "algorithm_type": "dpmsolver++"},
        "recommended_steps": 25,
        "characteristics": "Best balance of speed and quality. Most versatile",
    },
    "Euler": {
        "class": EulerDiscreteScheduler,
        "config": {},
        "recommended_steps": 30,
        "characteristics": "Simple and stable. Close to Midjourney's default",
    },
    "Euler Ancestral": {
        "class": EulerAncestralDiscreteScheduler,
        "config": {},
        "recommended_steps": 30,
        "characteristics": "Has randomness. Slightly different results even with the same seed",
    },
    "UniPC": {
        "class": UniPCMultistepScheduler,
        "config": {},
        "recommended_steps": 20,
        "characteristics": "High quality with minimal steps. Best for fast generation",
    },
    "Heun": {
        "class": HeunDiscreteScheduler,
        "config": {},
        "recommended_steps": 25,
        "characteristics": "High quality but slow (evaluates twice per step). For precise generation",
    },
    "DDIM": {
        "class": DDIMScheduler,
        "config": {},
        "recommended_steps": 50,
        "characteristics": "Deterministic. Can be used for image interpolation",
    },
}

# Run benchmark
prompt = "A beautiful landscape, mountains, lake, sunset, photorealistic"
results = {}

for name, sched_info in schedulers.items():
    scheduler = sched_info["class"].from_config(
        pipe.scheduler.config, **sched_info["config"]
    )
    pipe.scheduler = scheduler
    steps = sched_info["recommended_steps"]

    start = time.time()
    image = pipe(
        prompt=prompt,
        num_inference_steps=steps,
        guidance_scale=7.0,
        generator=torch.Generator("cuda").manual_seed(42),
    ).images[0]
    elapsed = time.time() - start

    results[name] = {
        "time": round(elapsed, 2),
        "steps": steps,
        "characteristics": sched_info["characteristics"],
    }
    image.save(f"scheduler_{name.replace(' ', '_').lower()}.png")

# Output results
for name, info in results.items():
    print(f"{name}: {info['time']}s ({info['steps']} steps)")
    print(f"  Characteristics: {info['characteristics']}")
```

---

## 2. DALL-E 3 API

### Code Example 3: Image Generation with DALL-E 3

```python
from openai import OpenAI
import base64
import httpx
from pathlib import Path

client = OpenAI()

# Basic image generation
response = client.images.generate(
    model="dall-e-3",
    prompt="A traditional Japanese onsen ryokan open-air bath. Surrounded by "
           "autumn foliage, steam rising like morning mist. Photorealistic.",
    size="1792x1024",       # Landscape
    quality="hd",           # High quality mode
    style="natural",        # "natural" or "vivid"
    n=1,
)

# Generated image information
image_url = response.data[0].url
revised_prompt = response.data[0].revised_prompt  # Prompt rewritten by GPT-4
print(f"Revised prompt: {revised_prompt}")

# Download the image
image_data = httpx.get(image_url).content
Path("onsen.png").write_bytes(image_data)

# Variation generation patterns
prompts_batch = [
    "The same onsen ryokan in spring with cherry blossoms",
    "The same onsen ryokan in winter with snow scenery",
    "The same onsen ryokan in summer with lush greenery",
]

for i, prompt in enumerate(prompts_batch):
    resp = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
    )
    print(f"Season {i}: {resp.data[0].url}")
```

### Code Example 3b: Advanced DALL-E 3 Usage Patterns

```python
from openai import OpenAI
import httpx
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

client = OpenAI()

class DALLEWorkflow:
    """Collection of practical DALL-E 3 usage patterns"""

    def __init__(self, output_dir="./generated"):
        self.client = OpenAI()
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def generate_with_metadata(self, prompt, size="1024x1024",
                                quality="hd", style="natural"):
        """Image generation with metadata"""
        response = self.client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality=quality,
            style=style,
            n=1,
        )

        image_url = response.data[0].url
        revised_prompt = response.data[0].revised_prompt

        # Download image
        image_data = httpx.get(image_url).content

        # Generate filename
        import hashlib
        name_hash = hashlib.md5(prompt.encode()).hexdigest()[:8]
        filename = f"dalle3_{name_hash}.png"
        filepath = self.output_dir / filename

        filepath.write_bytes(image_data)

        # Save metadata
        metadata = {
            "original_prompt": prompt,
            "revised_prompt": revised_prompt,
            "size": size,
            "quality": quality,
            "style": style,
            "filename": filename,
        }
        meta_path = self.output_dir / f"dalle3_{name_hash}_meta.json"
        meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2))

        return filepath, metadata

    def generate_product_shots(self, product_name, angles=None, styles=None):
        """Generate product images from multiple angles"""
        if angles is None:
            angles = [
                "front view, centered",
                "45 degree angle, slightly above",
                "close-up detail shot",
                "lifestyle setting, in use",
            ]
        if styles is None:
            styles = ["natural"]

        results = []
        for angle in angles:
            for style in styles:
                prompt = (
                    f"Professional product photography of {product_name}, "
                    f"{angle}, studio lighting, white background, "
                    f"commercial quality, 4K, no text or watermark"
                )
                filepath, meta = self.generate_with_metadata(
                    prompt, size="1024x1024", quality="hd", style=style
                )
                results.append({"file": str(filepath), "angle": angle, **meta})

        return results

    def generate_with_chatgpt_enhancement(self, rough_description):
        """Enhance prompt with ChatGPT before generation"""
        # Improve prompt with GPT-4
        enhancement = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content":
                    "You are an expert at writing prompts for DALL-E 3. "
                    "Given a rough description, create a detailed, vivid prompt "
                    "that will produce a stunning image. Include details about "
                    "lighting, composition, style, and mood."},
                {"role": "user", "content": rough_description},
            ],
            max_tokens=300,
        )
        enhanced_prompt = enhancement.choices[0].message.content

        # Generate with the enhanced prompt
        filepath, meta = self.generate_with_metadata(enhanced_prompt)
        meta["rough_description"] = rough_description
        meta["enhanced_prompt"] = enhanced_prompt

        return filepath, meta


# Usage example
workflow = DALLEWorkflow(output_dir="./product_shots")

# Product image generation
results = workflow.generate_product_shots("minimalist leather wallet")
for r in results:
    print(f"[{r['angle']}] {r['file']}")

# ChatGPT-enhanced generation
filepath, meta = workflow.generate_with_chatgpt_enhancement(
    "Night view of an old Japanese hot spring town"
)
print(f"Generated: {filepath}")
print(f"Enhanced prompt: {meta['enhanced_prompt'][:100]}...")
```

### Code Example 3c: DALL-E 3 Size, Style, and Quality Combination Effects

```python
"""
DALL-E 3 Parameter Effect Comparison

Sizes:
  1024x1024  — Square (default, suitable for social media posts)
  1024x1792  — Portrait (posters, phone wallpapers)
  1792x1024  — Landscape (banners, presentation backgrounds)

Quality:
  standard   — Standard quality, fast, $0.040/image
  hd         — High quality, fine details, $0.080/image

Style:
  natural    — Photorealistic, natural impression
  vivid      — Vivid, high contrast, cinematic
"""

from openai import OpenAI
client = OpenAI()

# Generate comparisons with all parameter combinations
def compare_dalle3_params(base_prompt):
    sizes = ["1024x1024", "1024x1792", "1792x1024"]
    qualities = ["standard", "hd"]
    styles = ["natural", "vivid"]

    results = []
    for size in sizes:
        for quality in qualities:
            for style in styles:
                response = client.images.generate(
                    model="dall-e-3",
                    prompt=base_prompt,
                    size=size,
                    quality=quality,
                    style=style,
                    n=1,
                )
                cost = 0.040 if quality == "standard" and size == "1024x1024" else \
                       0.080 if quality == "standard" else \
                       0.080 if size == "1024x1024" else 0.120
                results.append({
                    "size": size,
                    "quality": quality,
                    "style": style,
                    "cost_usd": cost,
                    "revised_prompt": response.data[0].revised_prompt[:80],
                    "url": response.data[0].url,
                })
                print(f"Generated: {size} / {quality} / {style} (${cost})")

    return results

# Usage example
# results = compare_dalle3_params("A serene Japanese garden in autumn")
```

---

## 3. Midjourney

### Code Example 4: Midjourney Style Parameter Guide

```python
"""
Midjourney Parameter Reference (v6.1)

Syntax: /imagine prompt: [text] --[parameter]
"""

MIDJOURNEY_PARAMS = {
    # Aspect ratio
    "--ar": {
        "description": "Image aspect ratio",
        "example": "--ar 16:9, --ar 3:2, --ar 1:1",
        "default": "1:1",
    },
    # Stylize
    "--s": {
        "description": "Midjourney style intensity (0-1000)",
        "example": "--s 50 (subtle), --s 750 (strong)",
        "default": "100",
    },
    # Chaos
    "--c": {
        "description": "Variation diversity (0-100)",
        "example": "--c 0 (stable), --c 50 (diverse)",
        "default": "0",
    },
    # Quality
    "--q": {
        "description": "Generation quality/computation (.25, .5, 1)",
        "example": "--q 1 (highest), --q .5 (fast)",
        "default": "1",
    },
    # Negative
    "--no": {
        "description": "Elements to exclude",
        "example": "--no text, watermark, people",
    },
    # Seed
    "--seed": {
        "description": "Seed value for reproducibility",
        "example": "--seed 12345",
    },
    # Style reference
    "--sref": {
        "description": "Style reference image URL",
        "example": "--sref https://example.com/style.png",
    },
    # Character reference (v6+)
    "--cref": {
        "description": "Character reference image URL",
        "example": "--cref https://example.com/character.png",
        "note": "Used for generating the same character in different poses",
    },
    # Tile
    "--tile": {
        "description": "Generate a tileable pattern",
        "example": "--tile",
        "use_case": "Textures, wallpapers, textiles",
    },
    # Stop
    "--stop": {
        "description": "Stop generation partway (10-100)",
        "example": "--stop 80",
        "use_case": "Abstract, unfinished-looking images",
    },
    # Weird
    "--weird": {
        "description": "Experimental/quirky generation (0-3000)",
        "example": "--weird 500",
    },
}

def build_mj_prompt(text: str, **params) -> str:
    """Build a Midjourney prompt"""
    parts = [f"/imagine prompt: {text}"]
    for param, value in params.items():
        if not param.startswith("--"):
            param = f"--{param}"
        parts.append(f"{param} {value}")
    return " ".join(parts)

# Usage example
prompt = build_mj_prompt(
    "Ancient Japanese temple, moss-covered, misty morning",
    ar="16:9", s="250", c="20", q="1", no="people, text"
)
print(prompt)
```

### Code Example 4b: Midjourney Prompt Template Collection

```python
"""
Midjourney Practical Prompt Templates
"""

class MidjourneyPromptBuilder:
    """Systematic prompt construction for Midjourney"""

    # Style presets
    STYLE_PRESETS = {
        "photorealistic": "photorealistic, DSLR, 85mm lens, f/1.8, "
                         "natural lighting, 8K resolution",
        "cinematic": "cinematic lighting, film grain, anamorphic, "
                    "movie still, dramatic shadows",
        "anime": "anime style, cel shading, vibrant colors, "
                "detailed, Studio Ghibli inspired",
        "watercolor": "watercolor painting, soft edges, transparent washes, "
                     "artistic, paper texture",
        "3d_render": "3D render, octane render, subsurface scattering, "
                    "volumetric lighting, high detail",
        "concept_art": "concept art, digital painting, matte painting, "
                      "artstation trending, detailed illustration",
        "oil_painting": "oil painting, classical style, rich textures, "
                       "canvas texture, chiaroscuro lighting",
        "flat_design": "flat design, vector art, clean lines, "
                      "minimal, modern graphic design",
    }

    # Lighting presets
    LIGHTING_PRESETS = {
        "golden_hour": "golden hour, warm light, long shadows",
        "blue_hour": "blue hour, twilight, cool tones",
        "studio": "studio lighting, softbox, key light and fill light",
        "dramatic": "dramatic lighting, strong contrast, rim lighting",
        "natural": "natural daylight, soft shadows",
        "neon": "neon lighting, cyberpunk, colorful glow",
        "moonlight": "moonlit, silvery light, ethereal atmosphere",
    }

    # Composition presets
    COMPOSITION_PRESETS = {
        "rule_of_thirds": "rule of thirds composition",
        "centered": "centered symmetrical composition",
        "wide_angle": "wide angle perspective, expansive view",
        "closeup": "extreme close-up, macro detail",
        "birds_eye": "bird's eye view, top-down perspective",
        "worms_eye": "worm's eye view, looking up, dramatic angle",
    }

    def build(self, subject, style=None, lighting=None,
              composition=None, additional="", **mj_params):
        """Build a structured prompt"""
        parts = [subject]

        if style and style in self.STYLE_PRESETS:
            parts.append(self.STYLE_PRESETS[style])
        elif style:
            parts.append(style)

        if lighting and lighting in self.LIGHTING_PRESETS:
            parts.append(self.LIGHTING_PRESETS[lighting])

        if composition and composition in self.COMPOSITION_PRESETS:
            parts.append(self.COMPOSITION_PRESETS[composition])

        if additional:
            parts.append(additional)

        prompt_text = ", ".join(parts)

        # Add Midjourney parameters
        param_parts = []
        for param, value in mj_params.items():
            if not param.startswith("--"):
                param = f"--{param}"
            if value is True:
                param_parts.append(param)
            else:
                param_parts.append(f"{param} {value}")

        if param_parts:
            prompt_text += " " + " ".join(param_parts)

        return f"/imagine prompt: {prompt_text}"


# Usage examples
builder = MidjourneyPromptBuilder()

# Photorealistic landscape
prompt1 = builder.build(
    subject="Ancient Japanese shrine in a bamboo forest",
    style="photorealistic",
    lighting="golden_hour",
    composition="rule_of_thirds",
    ar="16:9", s="200", q="1"
)
print(f"Landscape: {prompt1}")

# Concept art
prompt2 = builder.build(
    subject="A cyberpunk samurai standing on a neon-lit rooftop",
    style="concept_art",
    lighting="neon",
    composition="worms_eye",
    additional="rain, reflections, detailed armor",
    ar="2:3", s="500"
)
print(f"Concept art: {prompt2}")

# Textile pattern
prompt3 = builder.build(
    subject="Japanese wave pattern with koi fish",
    style="flat_design",
    additional="seamless pattern, navy blue and gold",
    tile=True, ar="1:1", s="100"
)
print(f"Pattern: {prompt3}")
```

### ASCII Diagram 2: Workflow Comparison of the Three Major Platforms

```
Stable Diffusion (Local):
┌──────┐   ┌─────────┐   ┌──────┐   ┌───────────┐
│Model │→  │ComfyUI/ │→  │Generate│→ │Post-      │
│Select│   │A1111    │   │(LoRA) │   │Processing │
└──────┘   └─────────┘   └──────┘   │(Upscale)  │
                                     └───────────┘
  Flexibility: ★★★★★  Cost: GPU electricity only

DALL-E 3 (API):
┌──────┐   ┌─────────┐   ┌──────────┐   ┌──────┐
│Prompt│→  │GPT-4    │→  │Generate  │→  │Get   │
│      │   │Rewrite  │   │(Cloud)   │   │URL   │
└──────┘   └─────────┘   └──────────┘   └──────┘
  Flexibility: ★★★☆☆  Cost: $0.04-0.12/image

Midjourney (Discord/Web):
┌────────┐   ┌──────────┐   ┌──────┐   ┌───────┐
│/imagine│→  │4-Image   │→  │Select│→  │Upscale│
│Command │   │Grid      │   │(U/V) │   │/Vary  │
└────────┘   └──────────┘   └──────┘   └───────┘
  Flexibility: ★★☆☆☆  Cost: $10-120/month

Flux (Local/API):
┌──────┐   ┌─────────┐   ┌──────────┐   ┌──────┐
│Prompt│→  │Rectified│→  │Generate  │→  │Save  │
│      │   │Flow DiT │   │(28 steps)│   │      │
└──────┘   └─────────┘   └──────────┘   └──────┘
  Flexibility: ★★★★☆  Cost: GPU/API dependent
```

### ASCII Diagram 3: ComfyUI Node-Based Workflow

```
┌─────────────┐
│ Load        │
│ Checkpoint  │──────────────┐
│ (SDXL)      │              │
└─────────────┘              │
                             v
┌─────────────┐    ┌─────────────────┐    ┌──────────┐
│ CLIP Text   │───>│  KSampler       │───>│ VAE      │
│ Encode      │    │  Steps: 25      │    │ Decode   │
│ (Positive)  │    │  CFG: 7.0       │    │          │──> Image
└─────────────┘    │  Sampler: dpmpp │    └──────────┘
                   │  Scheduler: karras│
┌─────────────┐    │                 │
│ CLIP Text   │───>│                 │
│ Encode      │    └─────────────────┘
│ (Negative)  │            ↑
└─────────────┘            │
                  ┌────────────────┐
                  │ Empty Latent   │
                  │ Image          │
                  │ 1024x1024      │
                  └────────────────┘
```

### ASCII Diagram 3b: ComfyUI ControlNet + LoRA Workflow

```
┌──────────────┐
│ Load         │
│ Checkpoint   │─────────┐
│ (SDXL Base)  │         │
└──────────────┘         │
        │                │
┌───────────────┐        │
│ Load LoRA     │        │
│ (anime_v2)    │────────┤
│ strength: 0.8 │        │
└───────────────┘        │
                         v
┌──────────────┐  ┌──────────────┐  ┌─────────────┐
│ Load Image   │  │ Apply        │  │ KSampler    │
│ (reference)  │─>│ ControlNet   │─>│ Advanced    │──> VAE Decode ──> Image
└──────────────┘  │ (Canny)      │  │ Steps: 30   │
        │         │ strength:0.7 │  │ CFG: 7.0    │
        v         └──────────────┘  │ denoise:1.0 │
┌──────────────┐                    └─────────────┘
│ Canny Edge   │                          ↑
│ Detector     │                    ┌──────────┐
│ low:100      │                    │ CLIP     │
│ high:200     │                    │ Encode   │
└──────────────┘                    │ (Pos/Neg)│
                                    └──────────┘
```

---

## 4. Next-Generation Image Generation with Flux

### Code Example 5: Flux Pipeline Basics

```python
from diffusers import FluxPipeline
import torch

# Load the Flux.1-dev model
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=torch.bfloat16,
)
pipe.enable_model_cpu_offload()  # Save VRAM

# Basic generation — Flux excels at text rendering
image = pipe(
    prompt='A wooden sign in a forest that reads "Welcome to the '
           'Enchanted Forest" in elegant calligraphy, '
           'moss-covered, sunlight filtering through leaves',
    num_inference_steps=28,
    guidance_scale=3.5,      # Low CFG recommended for Flux (2.0-5.0)
    width=1024,
    height=768,
    generator=torch.Generator("cpu").manual_seed(42),
).images[0]

image.save("flux_basic.png")
```

### Code Example 5b: Advanced Flux Usage

```python
from diffusers import FluxPipeline, FluxImg2ImgPipeline
import torch
from PIL import Image

# --- Flux Text Rendering Practical Examples ---
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=torch.bfloat16,
)
pipe.enable_model_cpu_offload()

# Text rendering (Flux's greatest strength)
text_prompts = [
    'A coffee shop menu board that reads:\n'
    '"Today\'s Special\nMatcha Latte - $5\nEspresso - $4"\n'
    'chalk style on dark background',

    'A vintage book cover with the title "The Last Samurai" '
    'in gold embossed letters, leather texture, ornate border',

    'A neon sign that says "OPEN 24/7" in bright pink and blue, '
    'wet street reflection, night scene, Japanese alley',
]

for i, prompt in enumerate(text_prompts):
    image = pipe(
        prompt=prompt,
        num_inference_steps=28,
        guidance_scale=3.5,
        width=1024,
        height=1024,
        generator=torch.Generator("cpu").manual_seed(42 + i),
    ).images[0]
    image.save(f"flux_text_{i}.png")
    print(f"Generated: flux_text_{i}.png")


# --- Flux img2img ---
pipe_i2i = FluxImg2ImgPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=torch.bfloat16,
)
pipe_i2i.enable_model_cpu_offload()

# Style transfer of an existing image
init_image = Image.open("photo.png").resize((1024, 1024))
image = pipe_i2i(
    prompt="Same scene but in Studio Ghibli anime style, "
           "vibrant colors, detailed background",
    image=init_image,
    strength=0.6,           # Original image retention (0.0=no change, 1.0=full generation)
    num_inference_steps=28,
    guidance_scale=3.5,
).images[0]
image.save("flux_style_transfer.png")
```

### Comparison Table: SD Model Generational Comparison

| Feature | SD 1.5 | SDXL | SD3 | Flux.1 |
|---------|--------|------|-----|--------|
| **Architecture** | U-Net | U-Net (Large) | MMDiT | DiT (Rectified Flow) |
| **Text Encoder** | CLIP | CLIP + OpenCLIP | CLIP + T5 | CLIP + T5 |
| **Native Resolution** | 512x512 | 1024x1024 | 1024x1024 | 1024x1024 |
| **Text Rendering** | Not possible | Poor | Good | Excellent |
| **VRAM Requirements** | 4GB+ | 8GB+ | 12GB+ | 16GB+ |
| **Recommended Steps** | 20-50 | 25-40 | 28 | 28 |
| **Recommended CFG** | 7-12 | 5-8 | 4-7 | 2-5 |
| **LoRA Support** | Abundant | Abundant | Limited | Growing |
| **ControlNet** | Abundant | Abundant | Limited | Limited |
| **Community** | Largest | Large | Small | Growing |
| **Commercial License** | Model-dependent | Model-dependent | Check terms | dev: Research, pro: Commercial |

---

## 5. Batch Generation and Automation Pipelines

### Code Example 6: Efficient Mass Image Generation

```python
import torch
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
from pathlib import Path
import json
import time
from dataclasses import dataclass, asdict
from typing import Optional

@dataclass
class GenerationJob:
    """Image generation job definition"""
    prompt: str
    negative_prompt: str = "low quality, blurry, distorted, watermark"
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 25
    guidance_scale: float = 7.0
    seed: Optional[int] = None
    lora_path: Optional[str] = None
    lora_weight: float = 0.8
    output_name: Optional[str] = None

class BatchGenerator:
    """Batch image generation pipeline"""

    def __init__(self, model_id="stabilityai/stable-diffusion-xl-base-1.0",
                 output_dir="./batch_output", device="cuda"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.device = device

        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            variant="fp16",
        ).to(device)

        self.pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            self.pipe.scheduler.config,
            use_karras_sigmas=True,
        )
        self.pipe.enable_attention_slicing()

    def generate_single(self, job: GenerationJob, index: int = 0):
        """Execute a single job"""
        # Apply LoRA
        if job.lora_path:
            self.pipe.load_lora_weights(job.lora_path)
            self.pipe.set_adapters(
                ["default"], adapter_weights=[job.lora_weight]
            )

        # Set seed
        generator = None
        if job.seed is not None:
            generator = torch.Generator(self.device).manual_seed(job.seed)

        start_time = time.time()

        image = self.pipe(
            prompt=job.prompt,
            negative_prompt=job.negative_prompt,
            width=job.width,
            height=job.height,
            num_inference_steps=job.num_inference_steps,
            guidance_scale=job.guidance_scale,
            generator=generator,
        ).images[0]

        elapsed = time.time() - start_time

        # Save file
        if job.output_name:
            filename = f"{job.output_name}.png"
        else:
            filename = f"batch_{index:04d}.png"

        filepath = self.output_dir / filename
        image.save(filepath)

        # Save metadata
        metadata = {
            **asdict(job),
            "filename": filename,
            "generation_time_sec": round(elapsed, 2),
        }
        meta_path = self.output_dir / f"{filename.replace('.png', '_meta.json')}"
        meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2))

        # Unload LoRA
        if job.lora_path:
            self.pipe.unload_lora_weights()

        return filepath, metadata

    def run_batch(self, jobs: list[GenerationJob]):
        """Execute batch"""
        results = []
        total = len(jobs)

        for i, job in enumerate(jobs):
            print(f"[{i+1}/{total}] {job.prompt[:60]}...")
            filepath, meta = self.generate_single(job, i)
            results.append(meta)
            print(f"  -> {filepath} ({meta['generation_time_sec']}s)")

        # Save batch summary
        summary_path = self.output_dir / "batch_summary.json"
        summary_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(f"\nBatch complete: {total} images generated")

        return results


# Usage example
generator = BatchGenerator(output_dir="./product_images")

jobs = [
    GenerationJob(
        prompt="Professional product photo of wireless earbuds, "
               "white background, studio lighting, 4K",
        seed=42,
        output_name="earbuds_front",
    ),
    GenerationJob(
        prompt="Professional product photo of wireless earbuds, "
               "in charging case, white background, studio lighting",
        seed=43,
        output_name="earbuds_case",
    ),
    GenerationJob(
        prompt="Lifestyle photo of person wearing wireless earbuds, "
               "jogging in park, natural lighting",
        seed=44,
        width=1024,
        height=768,
        output_name="earbuds_lifestyle",
    ),
]

results = generator.run_batch(jobs)
```

### Code Example 7: Batch Generation via ComfyUI API

```python
import requests
import json
import time
from pathlib import Path
import websocket

class ComfyUIClient:
    """ComfyUI API Client

    Start ComfyUI in server mode: python main.py --listen
    """

    def __init__(self, host="127.0.0.1", port=8188):
        self.base_url = f"http://{host}:{port}"
        self.ws_url = f"ws://{host}:{port}/ws"

    def queue_prompt(self, workflow: dict) -> str:
        """Add a workflow to the queue"""
        response = requests.post(
            f"{self.base_url}/prompt",
            json={"prompt": workflow},
        )
        return response.json()["prompt_id"]

    def get_history(self, prompt_id: str) -> dict:
        """Get generation history"""
        response = requests.get(f"{self.base_url}/history/{prompt_id}")
        return response.json()

    def get_image(self, filename: str, subfolder: str = "",
                  folder_type: str = "output") -> bytes:
        """Download generated image"""
        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": folder_type,
        }
        response = requests.get(
            f"{self.base_url}/view", params=params
        )
        return response.content

    def wait_for_completion(self, prompt_id: str, timeout: int = 120):
        """Wait for generation to complete"""
        start = time.time()
        while time.time() - start < timeout:
            history = self.get_history(prompt_id)
            if prompt_id in history:
                return history[prompt_id]
            time.sleep(1)
        raise TimeoutError(f"Generation timed out after {timeout}s")

    def generate_from_workflow(self, workflow_path: str,
                                prompt_text: str, seed: int = -1):
        """Batch generate from a workflow JSON"""
        with open(workflow_path) as f:
            workflow = json.load(f)

        # Update prompt node
        for node_id, node in workflow.items():
            if node.get("class_type") == "CLIPTextEncode":
                if "positive" in node.get("_meta", {}).get("title", "").lower():
                    node["inputs"]["text"] = prompt_text
            if node.get("class_type") == "KSampler":
                if seed >= 0:
                    node["inputs"]["seed"] = seed

        prompt_id = self.queue_prompt(workflow)
        result = self.wait_for_completion(prompt_id)
        return result


# Usage example
# client = ComfyUIClient()
# result = client.generate_from_workflow(
#     "workflow_sdxl.json",
#     prompt_text="A beautiful sunset over Mount Fuji",
#     seed=42,
# )
```

---

## 6. Quality Optimization Techniques

### Code Example 8: Quality Improvement via Img2Img

```python
from diffusers import (
    StableDiffusionXLPipeline,
    StableDiffusionXLImg2ImgPipeline,
)
import torch
from PIL import Image

# Two-stage generation: txt2img → img2img for quality improvement
base_pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda")

refine_pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
).to("cuda")

prompt = "A detailed fantasy map of a fictional island, "
prompt += "hand-drawn style, parchment texture, labeled locations"
negative = "low quality, blurry, modern"

# Step 1: Base image generation
base_image = base_pipe(
    prompt=prompt,
    negative_prompt=negative,
    num_inference_steps=30,
    guidance_scale=7.0,
    width=1024,
    height=1024,
    generator=torch.Generator("cuda").manual_seed(42),
).images[0]
base_image.save("map_base.png")

# Step 2: Add detail with img2img
refined_image = refine_pipe(
    prompt=prompt + ", intricate details, fine lines",
    negative_prompt=negative,
    image=base_image,
    strength=0.35,          # Low strength to add only details
    num_inference_steps=25,
    guidance_scale=7.0,
).images[0]
refined_image.save("map_refined.png")

# Step 3: Partial Hires Fix (upscaling)
# Upscale the image 2x then apply img2img
upscaled = base_image.resize((2048, 2048), Image.LANCZOS)
hires_image = refine_pipe(
    prompt=prompt + ", ultra detailed, sharp lines",
    negative_prompt=negative,
    image=upscaled,
    strength=0.25,          # Add high-res detail while maintaining structure
    num_inference_steps=30,
    guidance_scale=7.0,
).images[0]
hires_image.save("map_hires.png")
```

### Code Example 9: Prompt Templates and Quality Tag Management

```python
class PromptQualityManager:
    """Quality management system for image generation prompts"""

    # Quality enhancement tags (common across models)
    QUALITY_TAGS = {
        "high": [
            "masterpiece", "best quality", "highly detailed",
            "sharp focus", "professional",
        ],
        "photo": [
            "photorealistic", "DSLR quality", "natural lighting",
            "8K resolution", "RAW photo",
        ],
        "art": [
            "masterpiece", "artstation trending", "detailed illustration",
            "professional artwork", "concept art",
        ],
    }

    # Negative prompt presets (common across models)
    NEGATIVE_PRESETS = {
        "standard": (
            "low quality, worst quality, blurry, distorted, "
            "deformed, ugly, watermark, text, signature"
        ),
        "photo": (
            "low quality, worst quality, blurry, out of focus, "
            "overexposed, underexposed, noise, grain, "
            "watermark, text, illustration, painting, cartoon"
        ),
        "art": (
            "low quality, worst quality, blurry, distorted, "
            "deformed, ugly, amateur, bad anatomy, "
            "bad proportions, watermark, text"
        ),
        "product": (
            "low quality, blurry, distorted, watermark, text, "
            "shadow on background, cluttered background, "
            "multiple objects, person"
        ),
    }

    def build_prompt(self, subject, quality_preset="high",
                     additional_tags=None, style_tags=None):
        """Generate a structured prompt"""
        parts = [subject]

        if quality_preset in self.QUALITY_TAGS:
            parts.extend(self.QUALITY_TAGS[quality_preset])

        if style_tags:
            parts.extend(style_tags)

        if additional_tags:
            parts.extend(additional_tags)

        return ", ".join(parts)

    def get_negative(self, preset="standard", additional=None):
        """Get negative prompt"""
        neg = self.NEGATIVE_PRESETS.get(preset, self.NEGATIVE_PRESETS["standard"])
        if additional:
            neg += ", " + ", ".join(additional)
        return neg


# Usage example
pm = PromptQualityManager()

# Photorealistic product image
prompt = pm.build_prompt(
    subject="Wireless bluetooth earbuds on marble surface",
    quality_preset="photo",
    additional_tags=["studio lighting", "45 degree angle"],
)
negative = pm.get_negative("product")

print(f"Prompt: {prompt}")
print(f"Negative: {negative}")

# Artwork
prompt_art = pm.build_prompt(
    subject="A dragon flying over a medieval castle",
    quality_preset="art",
    style_tags=["digital painting", "epic fantasy", "volumetric lighting"],
)
negative_art = pm.get_negative("art")
print(f"\nArt Prompt: {prompt_art}")
print(f"Art Negative: {negative_art}")
```

---

## 7. Comparison Tables

### Comparison Table 1: Detailed Comparison of the Three Major Platforms

| Item | Stable Diffusion | DALL-E 3 | Midjourney | Flux |
|------|-----------------|----------|-----------|------|
| **Execution Environment** | Local/Cloud | Cloud API | Discord/Web | Local/API |
| **Customization** | Extremely high | Low | Low | High |
| **LoRA Support** | Yes | No | No | Yes |
| **ControlNet** | Yes | No | No | Limited |
| **Japanese Input** | Model-dependent | Supported | Limited | Supported via T5 |
| **Commercial Use** | Model-dependent | Yes (paid) | Yes (paid) | dev: Research only |
| **Text Rendering** | Poor | Good | Somewhat poor | Excellent |
| **Consistency** | Seed-fixable | Low | Style reference | Seed-fixable |
| **Batch Generation** | Easy | Possible via API | Manual | Easy |
| **Learning Curve** | Steep | Gentle | Moderate | Moderate |
| **Recommended CFG** | 5-8 | N/A | N/A | 2-5 |

### Comparison Table 2: Recommended Platforms by Use Case

| Use Case | Recommended | Reason |
|----------|-------------|--------|
| **Mass variation generation** | Stable Diffusion | Cost efficiency, batch processing |
| **Business document illustrations** | DALL-E 3 | Easy, high quality, Japanese support |
| **Art creation** | Midjourney | Artistic quality, unique style |
| **Game assets** | Stable Diffusion | ControlNet, consistency control |
| **Prototype UI** | DALL-E 3 | Detailed specification via natural language |
| **Architectural renders** | Stable Diffusion | ControlNet (depth/line drawing) |
| **Social media content** | Midjourney / DALL-E 3 | Balance of ease and quality |
| **Images with text** | Flux / DALL-E 3 | Text rendering capability |
| **Fine-tuning** | Stable Diffusion | LoRA/DreamBooth support |
| **Brand consistency** | Stable Diffusion + LoRA | Custom style learning |

### Comparison Table 3: Scheduler (Sampler) Selection Guide

| Scheduler | Recommended Steps | Speed | Quality | Use Case |
|-----------|-------------------|-------|---------|----------|
| DPM++ 2M Karras | 25 | Fast | High | General purpose, most recommended |
| Euler | 30 | Fast | High | Stability-focused |
| Euler Ancestral | 30 | Fast | High | Variation-focused |
| UniPC | 20 | Fastest | Good | Fast generation |
| Heun | 25 | Slow | Highest | Precise generation |
| DDIM | 50 | Slow | Good | Interpolation, inversion |
| LCM | 4-8 | Ultra-fast | Moderate | Real-time applications |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Not Pinning the Model Version

```
[Problem]
Starting a project specifying only "Stable Diffusion"
without deciding on a specific model.

[Why It's a Problem]
- Prompt compatibility differs between SD 1.5, SDXL, SD3, and Flux
- LoRAs are model-version dependent
- Changing models mid-project destroys style consistency

[Correct Approach]
- Decide on the base model and version at project start
- Confirm quality with test generations before production use
- Check the model card (license) to verify commercial use eligibility
```

### Anti-Pattern 2: Setting guidance_scale to Extreme Values

```
[Problem]
Setting guidance_scale to 20 or 30 because you want
"more faithful to the prompt."

[Why It's a Problem]
- Excessive CFG causes oversaturation and abnormal contrast
- Images get an unnatural "burned" color appearance
- Details are crushed and artifacts appear

[Correct Approach]
- SDXL: 5.0-8.0 is the recommended range
- SD3/Flux: 3.0-5.0 is the recommended range
- DALL-E 3: Not user-adjustable (already optimized)
- For higher fidelity, improve the prompt itself instead
```

### Anti-Pattern 3: Excessive ControlNet conditioning_scale

```
[Problem]
Using ControlNet with conditioning_scale left at 1.0
for all generations.

[Why It's a Problem]
- Overly constrained by control conditions (edges, poses, etc.)
- Natural expression and detail are lost
- Noise and artifacts in the input image are faithfully reproduced

[Correct Approach]
- Canny Edge: Adjust in the 0.5-0.8 range
- OpenPose: Adjust in the 0.6-0.9 range
- Depth: Adjust in the 0.4-0.7 range
- Experiment to find the optimal value for your use case
- For Multi-ControlNet, keep the total around 1.0-1.5
```

### Anti-Pattern 4: No Error Handling in Batch Generation

```
[Problem]
Starting a batch of 100 images, and when an error occurs
midway, the entire process stops and must restart from scratch.

[Why It's a Problem]
- Mid-process crash due to VRAM shortage
- Timeout from API rate limiting
- Download failure due to network issues
- Hours of work wasted

[Correct Approach]
1. Catch individual job errors with try-except
2. Record progress to file for resumable execution
3. Implement logic to skip already-generated files
4. VRAM management: Run torch.cuda.empty_cache() periodically
5. Implement rate-limit-aware delays when using APIs
```

---

## 9. FAQ

### Q1: What are the minimum specs to run Stable Diffusion locally?

**A:**

- **SD 1.5:** VRAM 4GB (minimum) / 8GB (recommended)
- **SDXL:** VRAM 8GB (minimum) / 12GB (recommended)
- **SD3/Flux:** VRAM 12GB (minimum) / 16GB+ (recommended)
- **Apple Silicon:** SD1.5 runs on M1 8GB, SDXL requires M2 Pro 16GB or higher
- **Quantized versions:** GGUF/NF4 formats can halve VRAM requirements

### Q2: What should I do when generated image quality is low?

**A:** Check the following in order:

1. **Review the prompt:** Add quality tags, set negative prompts
2. **Change the sampler:** DPM++ 2M Karras is stable
3. **Adjust step count:** 20-30 steps recommended
4. **Adjust CFG:** Try values in the 5-8 range
5. **Change the model:** Use a fine-tuned model suited to your task
6. **Post-processing:** Upscaling, img2img refinement

### Q3: What should I be aware of for commercial use?

**A:**

- **Stable Diffusion:** Check the model's license (CreativeML Open RAIL-M, etc.)
- **DALL-E 3:** Commercial use permitted under the terms of service. Must comply with content policy
- **Midjourney:** Commercial use permitted on paid plans. Pro plan required if annual revenue exceeds $1M
- **Flux:** dev version is for research only, pro version allows commercial use
- **Common:** Using commercially images that closely resemble others' copyrighted works carries legal risk
- **Recommended:** Use generated images as materials and add human creativity to the final product

### Q4: How many images are needed for LoRA training?

**A:** This varies by purpose:

| Purpose | Recommended Count | Steps | Notes |
|---------|-------------------|-------|-------|
| Face learning | 10-20 images | 500-1000 | Include various angles and expressions |
| Style learning | 20-50 images | 1000-2000 | Images with consistent style |
| Concept learning | 5-15 images | 500-1500 | Variations of the target object |
| Texture | 10-30 images | 800-1500 | Shot under various conditions |

### Q5: How do I add custom nodes to ComfyUI?

**A:**

```bash
# Install ComfyUI Manager (recommended)
cd ComfyUI/custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager.git

# Manually add a custom node
git clone https://github.com/author/custom-node-repo.git

# Install dependencies
pip install -r custom-node-repo/requirements.txt

# Restart ComfyUI
```

Popular custom nodes:
- **ComfyUI-Manager:** Node management UI
- **ComfyUI-Impact-Pack:** Face detection and restoration
- **ComfyUI-AnimateDiff:** Animation generation
- **ComfyUI-Advanced-ControlNet:** ControlNet extensions
- **ComfyUI-IPAdapter:** Image prompting

### Q6: How can I control DALL-E 3's revised_prompt?

**A:** DALL-E 3 internally rewrites prompts, but you can control this with the following methods:

1. Add **I NEED to test how the tool works with prompts.** at the beginning to minimize rewriting
2. Write prompts as detailed as possible (reduce room for rewriting)
3. Explicitly specify important elements (color, composition, style)
4. When using via ChatGPT, instruct it to "send the prompt without modification"

---

## Summary Table

| Item | Key Points |
|------|------------|
| **SD Series** | Highest customization. Precise control with LoRA and ControlNet. Steep learning curve |
| **DALL-E 3** | Most accessible. Natural language prompts. Easy API integration |
| **Midjourney** | Highest art quality. Easy via Discord/Web. Low customization |
| **Flux** | Excellent text rendering. Efficient with Rectified Flow. Rapidly expanding ecosystem |
| **Model Selection** | Finalize early in the project. Mid-project changes risk style collapse |
| **Workflow** | ComfyUI (nodes) / Automatic1111 (WebUI) / API integration |
| **Cost** | Local = GPU investment, Cloud = pay-per-use/subscription |
| **Quality Optimization** | Scheduler selection + CFG tuning + img2img finishing + upscaling |

---



## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What common mistakes do beginners make?

Skipping the basics and jumping to advanced topics. We recommend firmly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

In this guide, we learned the following key points:

- Understanding of basic concepts and principles
- Practical implementation patterns
- Best practices and important considerations
- Practical applications in real-world work

---

## Recommended Next Reads

- [01-image-editing.md](./01-image-editing.md) — Inpainting, outpainting
- [02-upscaling.md](./02-upscaling.md) — Further quality improvement with super-resolution
- [03-design-tools.md](./03-design-tools.md) — Integration with Canva AI, Adobe Firefly, etc.

---

## References

1. Rombach, R. et al. (2022). "High-Resolution Image Synthesis with Latent Diffusion Models." *CVPR 2022*. https://arxiv.org/abs/2112.10752
2. Podell, D. et al. (2023). "SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis." *arXiv*. https://arxiv.org/abs/2307.01952
3. Betker, J. et al. (2023). "Improving Image Generation with Better Captions (DALL-E 3)." *OpenAI*. https://cdn.openai.com/papers/dall-e-3.pdf
4. Esser, P. et al. (2024). "Scaling Rectified Flow Transformers for High-Resolution Image Synthesis (SD3)." https://arxiv.org/abs/2403.03206
5. Zhang, L. et al. (2023). "Adding Conditional Control to Text-to-Image Diffusion Models." *ICCV 2023*. https://arxiv.org/abs/2302.05543
6. Hu, E.J. et al. (2021). "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR 2022*. https://arxiv.org/abs/2106.09685
7. Ruiz, N. et al. (2023). "DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation." *CVPR 2023*. https://arxiv.org/abs/2208.12242
