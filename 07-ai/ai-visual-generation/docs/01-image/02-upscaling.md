# Upscaling — Real-ESRGAN, Super-Resolution

> A systematic guide to AI-based super-resolution for image upscaling, from classical methods to state-of-the-art deep learning models.

---

## What You Will Learn in This Chapter

1. **Principles and Types of Super-Resolution** — Mathematical foundations and evolution of Single Image Super-Resolution (SISR)
2. **Comparison and Selection of Key Models** — Characteristics and use cases for Real-ESRGAN, SwinIR, and SUPIR
3. **Diffusion Model-Based Super-Resolution** — High-quality upscaling using Stable Diffusion
4. **Building Production Pipelines** — Practical techniques for batch processing, API integration, and quality control
5. **Combining Face Restoration with Super-Resolution** — Integration techniques with GFPGAN and CodeFormer


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [Image Editing — Inpainting, Outpainting](./01-image-editing.md)

---

## 1. Fundamental Concepts of Super-Resolution

### 1.1 Mathematical Foundations

Super-resolution is formulated as an inverse problem of estimating a high-resolution image $I_{HR}$ from a low-resolution image $I_{LR}$. The degradation model can be expressed as follows:

```
I_LR = (I_HR * k) ↓_s + n

Where:
  k   = blur kernel (e.g., Gaussian blur)
  ↓_s = downsampling (scale factor s)
  n   = noise
  *   = convolution operation
```

Since this degradation process is irreversible, super-resolution is inherently an ill-posed problem, meaning multiple high-resolution images are candidates for a single low-resolution image.

### Code Example 1: Comparison of Classical and AI Super-Resolution Methods

```python
from PIL import Image
import cv2
import numpy as np

def compare_upscaling_methods(image_path, scale=4):
    """Compare classical methods and AI super-resolution"""
    img = Image.open(image_path)
    w, h = img.size
    new_w, new_h = w * scale, h * scale

    results = {}

    # 1. Nearest Neighbor Interpolation
    results["nearest"] = img.resize(
        (new_w, new_h), Image.NEAREST
    )

    # 2. Bilinear Interpolation
    results["bilinear"] = img.resize(
        (new_w, new_h), Image.BILINEAR
    )

    # 3. Bicubic Interpolation
    results["bicubic"] = img.resize(
        (new_w, new_h), Image.BICUBIC
    )

    # 4. Lanczos Interpolation
    results["lanczos"] = img.resize(
        (new_w, new_h), Image.LANCZOS
    )

    return results

# Calculate quality metrics
def calculate_psnr(original, upscaled):
    """Calculate PSNR (Peak Signal-to-Noise Ratio)"""
    mse = np.mean((np.array(original) - np.array(upscaled)) ** 2)
    if mse == 0:
        return float('inf')
    return 20 * np.log10(255.0 / np.sqrt(mse))

def calculate_ssim(original, upscaled):
    """Calculate SSIM (Structural Similarity Index)"""
    from skimage.metrics import structural_similarity
    return structural_similarity(
        np.array(original),
        np.array(upscaled),
        channel_axis=2,  # Color image
    )

def calculate_lpips(original, upscaled):
    """Calculate LPIPS (Learned Perceptual Image Patch Similarity) — a metric closer to human perception"""
    import torch
    import lpips

    loss_fn = lpips.LPIPS(net='alex')

    # PIL → Tensor conversion ([-1, 1] range)
    def to_tensor(img):
        arr = np.array(img).astype(np.float32) / 255.0
        arr = arr * 2.0 - 1.0
        return torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)

    t_orig = to_tensor(original)
    t_upsc = to_tensor(upscaled)

    with torch.no_grad():
        score = loss_fn(t_orig, t_upsc)

    return score.item()  # Lower means higher similarity


def comprehensive_quality_assessment(original_path, upscaled_path):
    """Generate a comprehensive quality assessment report"""
    from PIL import Image
    import json

    original = Image.open(original_path)
    upscaled = Image.open(upscaled_path)

    # Resolution check
    orig_w, orig_h = original.size
    upsc_w, upsc_h = upscaled.size
    scale_w = upsc_w / orig_w
    scale_h = upsc_h / orig_h

    # Metric calculation
    # Note: PSNR and SSIM require same-size images for comparison,
    # so resize the original to match
    original_resized = original.resize(
        (upsc_w, upsc_h), Image.LANCZOS
    )

    report = {
        "resolution": {
            "original": f"{orig_w}x{orig_h}",
            "upscaled": f"{upsc_w}x{upsc_h}",
            "scale_factor": f"{scale_w:.1f}x{scale_h:.1f}",
        },
        "metrics": {
            "psnr_db": round(
                calculate_psnr(original_resized, upscaled), 2
            ),
            "ssim": round(
                calculate_ssim(original_resized, upscaled), 4
            ),
        },
        "file_info": {
            "original_size_kb": round(
                os.path.getsize(original_path) / 1024, 1
            ),
            "upscaled_size_kb": round(
                os.path.getsize(upscaled_path) / 1024, 1
            ),
        },
    }

    return report
```

### ASCII Diagram 1: Types and Evolution of Super-Resolution

```
Classification of Super-Resolution Techniques:

┌─────────── Classical Methods ───────────────────────┐
│  Nearest → Bilinear → Bicubic → Lanczos             │
│  (1970s)   (1980s)    (1990s)   (2000s)             │
│  Quality: ★ Quality: ★★ Quality: ★★★ Quality: ★★★☆ │
└─────────────────────────────────────────────────────┘
                      │
                      v  Advent of Deep Learning
┌─────────── CNN-Based ───────────────────────────────┐
│  SRCNN → EDSR → RCAN → SwinIR                       │
│  (2014)  (2017)  (2018)  (2021)                      │
│  Quality: ★★★★  Quality: ★★★★☆  Quality: ★★★★★     │
└─────────────────────────────────────────────────────┘
                      │
                      v  Advent of GAN / Diffusion Models
┌─────────── Generative-Based ────────────────────────┐
│  SRGAN → Real-ESRGAN → StableSR → SUPIR              │
│  (2017)   (2021)       (2023)     (2024)              │
│  Quality: ★★★★☆  Quality: ★★★★★  Realism: ★★★★★    │
│  * Fidelity may decrease as details are "generated"   │
└─────────────────────────────────────────────────────┘
```

### 1.2 Understanding the Degradation Model in Detail

Real-world image degradation is a composite degradation that differs from simple downsampling. The key to Real-ESRGAN's success lies in more accurately modeling this real-world degradation.

```python
def simulate_real_world_degradation(image, scale=4):
    """
    Reproduces Real-ESRGAN's second-order degradation model

    Real-world degradation = blur + downsampling + noise + JPEG compression
    This is repeated twice (second-order degradation)
    """
    import cv2
    import numpy as np

    img = np.array(image).astype(np.float32) / 255.0

    # === First-order degradation ===
    # 1. Blur (isotropic/anisotropic Gaussian)
    kernel_size = np.random.choice([7, 9, 11, 13, 15, 17, 19, 21])
    sigma = np.random.uniform(0.2, 3.0)
    img = cv2.GaussianBlur(img, (kernel_size, kernel_size), sigma)

    # 2. Downsampling (bicubic/bilinear/area)
    h, w = img.shape[:2]
    method = np.random.choice([
        cv2.INTER_CUBIC,
        cv2.INTER_LINEAR,
        cv2.INTER_AREA,
    ])
    down_scale = np.random.uniform(1.0, scale)
    img = cv2.resize(
        img, (int(w / down_scale), int(h / down_scale)),
        interpolation=method,
    )

    # 3. Noise addition (Gaussian/Poisson)
    noise_type = np.random.choice(["gaussian", "poisson"])
    if noise_type == "gaussian":
        sigma_n = np.random.uniform(1, 30) / 255.0
        noise = np.random.normal(0, sigma_n, img.shape)
        img = img + noise
    else:
        vals = 2 ** np.ceil(np.log2(len(np.unique(img))))
        img = np.random.poisson(img * vals) / vals

    # 4. JPEG compression artifacts
    quality = np.random.randint(30, 95)
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    _, enc = cv2.imencode('.jpg', (img * 255).astype(np.uint8),
                          encode_param)
    img = cv2.imdecode(enc, cv2.IMREAD_COLOR).astype(np.float32) / 255.0

    # === Second-order degradation (repeated) ===
    # Apply the same process again (with different parameter ranges)
    kernel_size2 = np.random.choice([7, 9, 11, 13, 15, 17, 19, 21])
    sigma2 = np.random.uniform(0.2, 1.5)
    img = cv2.GaussianBlur(img, (kernel_size2, kernel_size2), sigma2)

    # Final resize
    img = cv2.resize(
        img, (w // scale, h // scale),
        interpolation=cv2.INTER_LINEAR,
    )

    img = np.clip(img, 0, 1)
    return (img * 255).astype(np.uint8)
```

### ASCII Diagram: Real-ESRGAN's Second-Order Degradation Model

```
Real-ESRGAN Training Degradation Pipeline:

High-Resolution Image (GT)
     │
     ▼ ─── First-Order Degradation ───
     │
     ├── Blur (isotropic/anisotropic/out-of-focus)
     │     │ Kernels: Gaussian, generalized Gaussian, plateau Gaussian
     │     │ Size: 7-21, σ: 0.2-3.0
     │
     ├── Resize (downsampling)
     │     │ Methods: bicubic / bilinear / area
     │     │ Scale: 0.15-1.5
     │
     ├── Noise
     │     │ Gaussian: σ = 1-30
     │     │ Poisson: scale = 0.05-3.0
     │
     └── JPEG Compression
           │ Quality: 30-95
           ▼
     │
     ▼ ─── Second-Order Degradation ─── (same 4 steps applied again)
     │
     ├── Blur (σ: 0.2-1.5, milder)
     ├── Resize
     ├── Noise (σ: 1-25)
     └── JPEG/WEBP Compression
           │
           ▼
     Low-Resolution Image (LR) ← Used as training pair
```

---

## 2. Real-ESRGAN

### 2.1 Architecture Details

Real-ESRGAN uses the RRDB (Residual in Residual Dense Block) network as its backbone. It achieves stable training by combining a U-Net discriminator with spectral normalization.

```
RRDB Network Structure:

Input (3ch) ──→ Conv3x3 ──→ [RRDB x 23] ──→ Conv3x3 ──→ Upsample ──→ Output (3ch)
                              │                              │
                              └───── Skip Connection ─────────┘

Single RRDB:
┌─────────────────────────────────┐
│  ┌──── Dense Block 1 ────┐      │
│  │ Conv → LeakyReLU       │      │
│  │ Conv → LeakyReLU       │      │
│  │ Conv → LeakyReLU       │      │
│  │ Conv → LeakyReLU       │      │
│  │ Conv                   │      │
│  └─── × β (0.2) ─────────┘      │
│                │                  │
│  ┌──── Dense Block 2 ────┐      │
│  │ (same structure)       │      │
│  └─── × β (0.2) ─────────┘      │
│                │                  │
│  ┌──── Dense Block 3 ────┐      │
│  │ (same structure)       │      │
│  └─── × β (0.2) ─────────┘      │
└──────── × β (0.2) ──── + Input ─┘
```

### Code Example 2: Using Real-ESRGAN

```python
# pip install realesrgan
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
from PIL import Image
import numpy as np
import cv2

def upscale_with_realesrgan(image_path, scale=4, model_name="x4plus"):
    """Super-resolution with Real-ESRGAN"""

    # Model selection
    models = {
        "x4plus": {
            "model": RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64,
                num_block=23, num_grow_ch=32, scale=4,
            ),
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/"
                   "download/v0.1.0/RealESRGAN_x4plus.pth",
            "scale": 4,
        },
        "x4plus_anime": {
            "model": RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64,
                num_block=6, num_grow_ch=32, scale=4,
            ),
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/"
                   "download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
            "scale": 4,
        },
        "x2plus": {
            "model": RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64,
                num_block=23, num_grow_ch=32, scale=2,
            ),
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/"
                   "download/v0.2.1/RealESRGAN_x2plus.pth",
            "scale": 2,
        },
    }

    config = models[model_name]

    upsampler = RealESRGANer(
        scale=config["scale"],
        model_path=config["url"],
        model=config["model"],
        tile=0,          # Tile processing (0=disabled, recommended: 400)
        tile_pad=10,     # Padding between tiles
        pre_pad=0,
        half=True,       # Speed up with FP16
    )

    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    output, _ = upsampler.enhance(img, outscale=scale)
    cv2.imwrite("upscaled.png", output)

    return output

# For anime images
upscale_with_realesrgan("anime.png", model_name="x4plus_anime")

# For photos
upscale_with_realesrgan("photo.jpg", model_name="x4plus")
```

### Code Example 3: Super-Resolution for Large Images with Tile Processing

```python
def tiled_upscale(image_path, tile_size=512, overlap=64, scale=4):
    """
    Super-resolution by splitting large images into tiles

    Technique for processing large images in memory-constrained environments:
    1. Split the image into tiles
    2. Apply super-resolution to each tile individually
    3. Blend overlapping regions and merge
    """
    from PIL import Image
    import numpy as np

    img = np.array(Image.open(image_path))
    h, w, c = img.shape
    out_h, out_w = h * scale, w * scale

    output = np.zeros((out_h, out_w, c), dtype=np.float32)
    weight = np.zeros((out_h, out_w, c), dtype=np.float32)

    # Calculate tile positions
    y_positions = list(range(0, h - tile_size + 1, tile_size - overlap))
    x_positions = list(range(0, w - tile_size + 1, tile_size - overlap))

    # Add positions if edges are not covered
    if y_positions[-1] + tile_size < h:
        y_positions.append(h - tile_size)
    if x_positions[-1] + tile_size < w:
        x_positions.append(w - tile_size)

    for y in y_positions:
        for x in x_positions:
            # Extract tile
            tile = img[y:y+tile_size, x:x+tile_size]

            # Apply super-resolution (placeholder upscale here)
            upscaled_tile = upscale_single_tile(tile, scale)

            # Weighted mask (smooth blending at edges)
            blend_mask = create_blend_mask(
                tile_size * scale, tile_size * scale,
                overlap * scale
            )

            # Add to result
            oy, ox = y * scale, x * scale
            ts = tile_size * scale
            output[oy:oy+ts, ox:ox+ts] += upscaled_tile * blend_mask
            weight[oy:oy+ts, ox:ox+ts] += blend_mask

    # Normalize
    output = output / np.maximum(weight, 1e-8)
    return output.astype(np.uint8)

def create_blend_mask(h, w, margin):
    """Gradient mask for tile blending"""
    mask = np.ones((h, w, 1), dtype=np.float32)
    # Apply gradients to all four edges
    for i in range(margin):
        alpha = i / margin
        mask[i, :, :] *= alpha      # Top edge
        mask[h-1-i, :, :] *= alpha  # Bottom edge
        mask[:, i, :] *= alpha      # Left edge
        mask[:, w-1-i, :] *= alpha  # Right edge
    return mask
```

### ASCII Diagram 2: Tile Processing Blending Concept

```
Tile split of original image:
┌────────┬──┬────────┐
│ Tile A │OL│ Tile B │
│        │  │        │
├── Overlap ─┼────────┤
│        │  │        │
│ Tile C │OL│ Tile D │
│        │  │        │
└────────┴──┴────────┘

Blend mask (weight for one tile):
┌────────────────────┐
│ 0.0  0.5  1.0  0.5│  ← Left-right gradient
│ 0.5  1.0  1.0  0.5│
│ 1.0  1.0  1.0  1.0│  ← Maximum weight at center
│ 0.5  1.0  1.0  0.5│
│ 0.0  0.5  1.0  0.5│  ← Top-bottom gradient
└────────────────────┘

Merged result:
 TileA×WeightA + TileB×WeightB
─────────────────────────────── = Final pixel value
      WeightA + WeightB
```

### 2.2 Advanced Usage of Real-ESRGAN

```python
class RealESRGANPipeline:
    """
    Production-ready pipeline for Real-ESRGAN

    Features:
    - Automatic model selection (image type detection)
    - Batch processing
    - Quality evaluation
    - Progress reporting
    """

    def __init__(self, device="cuda", half=True):
        self.device = device
        self.half = half
        self.models = {}
        self._load_models()

    def _load_models(self):
        """Prepare lazy loading of models"""
        self.model_configs = {
            "photo": {
                "arch": RRDBNet(
                    num_in_ch=3, num_out_ch=3, num_feat=64,
                    num_block=23, num_grow_ch=32, scale=4,
                ),
                "path": "weights/RealESRGAN_x4plus.pth",
                "scale": 4,
            },
            "anime": {
                "arch": RRDBNet(
                    num_in_ch=3, num_out_ch=3, num_feat=64,
                    num_block=6, num_grow_ch=32, scale=4,
                ),
                "path": "weights/RealESRGAN_x4plus_anime_6B.pth",
                "scale": 4,
            },
        }

    def _get_upsampler(self, model_type, tile=0):
        """Lazy load only the required model"""
        if model_type not in self.models:
            config = self.model_configs[model_type]
            self.models[model_type] = RealESRGANer(
                scale=config["scale"],
                model_path=config["path"],
                model=config["arch"],
                tile=tile,
                tile_pad=10,
                pre_pad=0,
                half=self.half,
            )
        return self.models[model_type]

    def detect_image_type(self, image_path):
        """Automatically detect image type"""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")

        # Determine by unique color count and variance
        # Anime/illustrations have fewer colors and less gradation
        h, w = img.shape[:2]
        sample = img[::4, ::4]  # Sample every 4th pixel

        unique_colors = len(np.unique(
            sample.reshape(-1, 3), axis=0
        ))
        color_ratio = unique_colors / (sample.shape[0] * sample.shape[1])

        # Edge sharpness
        gray = cv2.cvtColor(sample, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_ratio = np.sum(edges > 0) / edges.size

        # Classification logic
        if color_ratio < 0.3 and edge_ratio > 0.05:
            return "anime"
        else:
            return "photo"

    def upscale(self, image_path, output_path=None,
                model_type=None, scale=4, tile=0):
        """
        Upscale an image with super-resolution

        Parameters:
            image_path: Input image path
            output_path: Output image path (None=auto-naming)
            model_type: "photo" / "anime" / None (auto-detect)
            scale: Output scale factor (2 or 4)
            tile: Tile size (0=disabled, 400-512 recommended)

        Returns:
            dict: Processing results (output path, metadata)
        """
        import time
        start_time = time.time()

        # Model selection
        if model_type is None:
            model_type = self.detect_image_type(image_path)

        # Automatic tile size based on VRAM
        if tile == 0:
            img = cv2.imread(image_path)
            h, w = img.shape[:2]
            total_pixels = h * w
            if total_pixels > 2_000_000:  # Over 2MP
                tile = 400
            elif total_pixels > 4_000_000:  # Over 4MP
                tile = 256

        upsampler = self._get_upsampler(model_type, tile=tile)

        img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
        output, _ = upsampler.enhance(img, outscale=scale)

        if output_path is None:
            from pathlib import Path
            p = Path(image_path)
            output_path = str(p.parent / f"{p.stem}_upscaled{p.suffix}")

        cv2.imwrite(output_path, output)

        elapsed = time.time() - start_time

        return {
            "input": image_path,
            "output": output_path,
            "model": model_type,
            "scale": scale,
            "input_size": f"{img.shape[1]}x{img.shape[0]}",
            "output_size": f"{output.shape[1]}x{output.shape[0]}",
            "elapsed_seconds": round(elapsed, 2),
        }

    def batch_upscale(self, input_dir, output_dir,
                      model_type=None, scale=4, tile=400,
                      extensions=("png", "jpg", "jpeg", "webp")):
        """Batch super-resolution for all images in a directory"""
        from pathlib import Path
        import json

        input_path = Path(input_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        files = []
        for ext in extensions:
            files.extend(input_path.glob(f"*.{ext}"))
            files.extend(input_path.glob(f"*.{ext.upper()}"))

        results = []
        total = len(files)

        for i, f in enumerate(sorted(files)):
            print(f"[{i+1}/{total}] Processing: {f.name}")
            try:
                result = self.upscale(
                    str(f),
                    str(output_path / f.name),
                    model_type=model_type,
                    scale=scale,
                    tile=tile,
                )
                result["status"] = "success"
            except Exception as e:
                result = {
                    "input": str(f),
                    "status": "error",
                    "error": str(e),
                }
            results.append(result)

        # Output report
        report_path = output_path / "upscale_report.json"
        with open(report_path, "w", encoding="utf-8") as fout:
            json.dump(results, fout, indent=2, ensure_ascii=False)

        success_count = sum(
            1 for r in results if r["status"] == "success"
        )
        print(f"\nComplete: {success_count}/{total} succeeded")
        return results
```

---

## 3. Diffusion Model-Based Super-Resolution

### Code Example 4: Super-Resolution with Stable Diffusion (SD Upscaler)

```python
from diffusers import StableDiffusionUpscalePipeline
from PIL import Image
import torch

# SD x4 Upscaler pipeline
pipe = StableDiffusionUpscalePipeline.from_pretrained(
    "stabilityai/stable-diffusion-x4-upscaler",
    torch_dtype=torch.float16,
).to("cuda")

# Load low-resolution image
low_res = Image.open("small_image.png")  # e.g., 256x256

# Prompt-guided upscaling
upscaled = pipe(
    prompt="high resolution, sharp details, photorealistic, 8K",
    negative_prompt="blurry, noisy, artifacts, low quality",
    image=low_res,
    num_inference_steps=25,
    guidance_scale=4.0,    # Lower values recommended (too high causes artifacts)
    noise_level=20,        # Noise level (0-350, recommended: 20-50)
).images[0]

upscaled.save("high_res.png")  # Output: 1024x1024
```

### 3.1 StableSR — Super-Resolution Leveraging Diffusion Priors

```python
"""
StableSR: Super-resolution leveraging Stable Diffusion's prior knowledge

Features:
- Directly utilizes Stable Diffusion's pre-trained knowledge
- Time-aware Encoder controls the balance between fidelity and quality
- CFW (Controllable Feature Wrapping) module
"""

from diffusers import (
    StableDiffusionPipeline,
    DDPMScheduler,
)
import torch

class StableSRPipeline:
    """Conceptual implementation of StableSR"""

    def __init__(self, sd_model_path, sr_module_path, device="cuda"):
        self.device = device

        # Stable Diffusion base model
        self.sd_pipe = StableDiffusionPipeline.from_pretrained(
            sd_model_path,
            torch_dtype=torch.float16,
        ).to(device)

        # Additional module for super-resolution
        self.encoder_module = self._load_sr_encoder(sr_module_path)

    def upscale(self, image, scale=4,
                positive_prompt="",
                negative_prompt="blurry, artifacts",
                num_steps=50,
                color_fix="wavelet"):
        """
        Upscale with StableSR

        Parameters:
            image: PIL Image (low resolution)
            scale: Upscale factor
            positive_prompt: Quality enhancement prompt
            negative_prompt: Suppression prompt
            num_steps: Number of diffusion steps
            color_fix: Color correction method ("none", "adain", "wavelet")
        """
        # 1. Encode the low-resolution image
        lr_features = self.encoder_module.encode(image)

        # 2. Upscale through the diffusion process
        #    Time-aware Encoder adjusts features at each step
        hr_latent = self.sd_pipe(
            prompt=positive_prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=num_steps,
            # Custom conditioning mechanism
            cross_attention_kwargs={
                "lr_features": lr_features
            },
        )

        # 3. Color correction
        result = hr_latent.images[0]
        if color_fix == "wavelet":
            result = self._wavelet_color_fix(image, result)
        elif color_fix == "adain":
            result = self._adain_color_fix(image, result)

        return result

    def _wavelet_color_fix(self, source, target):
        """Color correction using wavelet transform"""
        import pywt
        # Extract low-frequency components (color info) from the original image
        # Extract high-frequency components (details) from the super-resolved result
        source_resized = source.resize(target.size, Image.LANCZOS)

        src_arr = np.array(source_resized).astype(np.float32)
        tgt_arr = np.array(target).astype(np.float32)

        result = np.zeros_like(tgt_arr)

        for ch in range(3):
            # Wavelet decomposition
            src_coeffs = pywt.dwt2(src_arr[:, :, ch], 'haar')
            tgt_coeffs = pywt.dwt2(tgt_arr[:, :, ch], 'haar')

            # Low frequency from original, high frequency from super-resolved result
            new_coeffs = (src_coeffs[0], tgt_coeffs[1])
            result[:, :, ch] = pywt.idwt2(new_coeffs, 'haar')

        return Image.fromarray(
            np.clip(result, 0, 255).astype(np.uint8)
        )

    def _adain_color_fix(self, source, target):
        """Color correction using AdaIN"""
        source_resized = source.resize(target.size, Image.LANCZOS)
        src = np.array(source_resized).astype(np.float32)
        tgt = np.array(target).astype(np.float32)

        for ch in range(3):
            src_mean, src_std = src[:,:,ch].mean(), src[:,:,ch].std()
            tgt_mean, tgt_std = tgt[:,:,ch].mean(), tgt[:,:,ch].std()
            tgt[:,:,ch] = (
                (tgt[:,:,ch] - tgt_mean) / (tgt_std + 1e-8)
            ) * src_std + src_mean

        return Image.fromarray(
            np.clip(tgt, 0, 255).astype(np.uint8)
        )
```

### Code Example 5: High-Quality Upscaling with SUPIR

```python
"""
SUPIR (Scaling Up to Excellence: Practicing Model Scaling
       for Photo-Realistic Image Restoration)

Super-resolution leveraging a large-scale language model (SDXL).
Allows controlling generated details via text prompts.
"""

# SUPIR is typically used via CLI or Gradio
# pip install git+https://github.com/Fanghua-Yu/SUPIR.git

# CLI usage example:
# python inference.py \
#   --input_path input.png \
#   --output_path output.png \
#   --prompt "high quality photograph, sharp details" \
#   --upscale 4 \
#   --model_path SUPIR-v0Q.ckpt

# API-style usage (conceptual code):
class SUPIRUpscaler:
    """Conceptual wrapper for SUPIR super-resolution"""

    def __init__(self, model_path, device="cuda"):
        self.device = device
        # Model loading (follows SUPIR's configuration)
        self.model = self._load_model(model_path)

    def upscale(self, image, prompt="", scale=4,
                restoration_strength=0.7):
        """
        Text-guided super-resolution

        restoration_strength:
          0.0-0.3: Fidelity-focused (closer to original)
          0.4-0.6: Balanced
          0.7-1.0: Quality-focused (more detail generation)
        """
        # 1. Encode the low-quality image
        # 2. Encode the text prompt
        # 3. Generate high-resolution image through diffusion
        # 4. Restore while maintaining consistency with original
        pass

    def batch_upscale(self, image_dir, output_dir, **kwargs):
        """Batch process all images in a directory"""
        from pathlib import Path
        for img_path in Path(image_dir).glob("*.{png,jpg,jpeg}"):
            img = Image.open(img_path)
            result = self.upscale(img, **kwargs)
            result.save(Path(output_dir) / img_path.name)
```

### ASCII Diagram 3: Super-Resolution Pipeline Selection Flowchart

```
                    START
                      │
                      v
              ┌──────────────┐
              │ What is the  │
              │ use case?    │
              └──────┬───────┘
                     │
        ┌────────────┼────────────┐
        v            v            v
   ┌────────┐  ┌──────────┐  ┌────────┐
   │ Photo/ │  │ Anime/   │  │ Text/  │
   │ Real   │  │ Illustra-│  │ Docu-  │
   │        │  │ tion     │  │ ment   │
   └───┬────┘  └────┬─────┘  └───┬────┘
       │            │            │
       v            v            v
  ┌─────────┐ ┌──────────┐ ┌─────────┐
  │Fidelity │ │Real-ESRGAN│ │waifu2x  │
  │priority?│ │anime      │ │/Lanczos │
  └──┬──────┘ └──────────┘ └─────────┘
     │
  ┌──┴──┐
  │Yes  │No
  v     v
┌──────┐ ┌──────────┐
│Real- │ │SUPIR /   │
│ESRGAN│ │StableSR  │
│x4plus│ │(generative)│
└──────┘ └──────────┘

Selection Criteria:
  Fidelity priority = Medical images, evidence photos, scientific data
  Quality priority  = Social media posts, print materials, presentations
```

---

## 4. Combining Face Restoration with Super-Resolution

### 4.1 Face-Specific Restoration with GFPGAN

For face image super-resolution, general-purpose models are often insufficient. GFPGAN (Generative Facial Prior GAN) achieves high-quality face restoration by leveraging facial geometric structure as prior knowledge.

```python
from gfpgan import GFPGANer
import cv2
import numpy as np

class FaceRestorationPipeline:
    """Integrated pipeline for face restoration + super-resolution"""

    def __init__(self, device="cuda"):
        self.device = device

        # GFPGAN face restoration model
        self.face_restorer = GFPGANer(
            model_path="weights/GFPGANv1.4.pth",
            upscale=4,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=self._create_bg_upsampler(),
        )

    def _create_bg_upsampler(self):
        """Real-ESRGAN upsampler for backgrounds"""
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet

        model = RRDBNet(
            num_in_ch=3, num_out_ch=3, num_feat=64,
            num_block=23, num_grow_ch=32, scale=4,
        )
        return RealESRGANer(
            scale=4,
            model_path="weights/RealESRGAN_x4plus.pth",
            model=model,
            tile=400,
            tile_pad=10,
            pre_pad=0,
            half=True,
        )

    def restore(self, image_path, output_path=None,
                fidelity_weight=0.5, only_center_face=False):
        """
        Face restoration + background super-resolution

        Parameters:
            image_path: Input image path
            fidelity_weight: Fidelity weight (0=quality-focused, 1=fidelity-focused)
            only_center_face: Whether to process only the largest face

        Returns:
            dict: Restoration results and detection info
        """
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)

        # Execute face restoration
        _, _, output = self.face_restorer.enhance(
            img,
            has_aligned=False,
            only_center_face=only_center_face,
            paste_back=True,
            weight=fidelity_weight,
        )

        if output_path:
            cv2.imwrite(output_path, output)

        return {
            "output": output,
            "input_size": f"{img.shape[1]}x{img.shape[0]}",
            "output_size": f"{output.shape[1]}x{output.shape[0]}",
        }


    def batch_restore(self, input_dir, output_dir,
                      fidelity_weight=0.5):
        """Face restoration for all images in a directory"""
        from pathlib import Path

        input_path = Path(input_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        results = []
        for img_file in sorted(input_path.glob("*")):
            if img_file.suffix.lower() in (
                ".png", ".jpg", ".jpeg", ".webp"
            ):
                try:
                    result = self.restore(
                        str(img_file),
                        str(output_path / img_file.name),
                        fidelity_weight=fidelity_weight,
                    )
                    result["status"] = "success"
                    result["file"] = img_file.name
                except Exception as e:
                    result = {
                        "file": img_file.name,
                        "status": "error",
                        "error": str(e),
                    }
                results.append(result)

        return results
```

### 4.2 CodeFormer — Codebook-Based Face Restoration

```python
"""
CodeFormer: Face restoration using a discrete codebook

Differences from GFPGAN:
- Codebook: Uses discrete representations learned via VQ-VAE
- Fidelity control: Continuously controllable via parameter w
  w=0: High quality but low fidelity
  w=1: High fidelity but lower quality
  Recommended: w=0.5-0.7
"""

# pip install codeformer-pip

def restore_face_codeformer(
    image_path,
    output_path,
    fidelity_weight=0.5,
    upscale=4,
    detection_model="retinaface_resnet50",
):
    """Face restoration with CodeFormer"""
    import subprocess

    cmd = [
        "python", "inference_codeformer.py",
        "-i", image_path,
        "-o", output_path,
        "-w", str(fidelity_weight),
        "-s", str(upscale),
        "--detection_model", detection_model,
        "--bg_upsampler", "realesrgan",
        "--face_upsample",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"CodeFormer error: {result.stderr}")

    return output_path
```

### ASCII Diagram: Face Restoration Pipeline Overview

```
Input Image (low resolution, degraded)
     │
     ▼
┌────────────────────────────────┐
│   Face Detection (RetinaFace/MTCNN)   │
│   ┌─────┐  ┌─────┐  ┌─────┐  │
│   │Face1│  │Face2│  │Face3│  │
│   └──┬──┘  └──┬──┘  └──┬──┘  │
└──────┼────────┼────────┼──────┘
       │        │        │
       ▼        ▼        ▼
┌─────────────────────────────────┐
│     Face Alignment               │
│  (5-point landmarks → affine)    │
│  → Normalized to 512x512         │
└──────────┬──────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐ ┌───────────┐
│ GFPGAN   │ │CodeFormer │
│          │ │           │
│ GAN Prior│ │ Codebook  │
│ + Style  │ │ + VQ-VAE  │
│ Transfer │ │ + w ctrl  │
└────┬─────┘ └────┬──────┘
     │            │
     ▼            ▼
┌────────────────────────┐
│  Inverse Affine Transform │
│  (Paste back to original  │
│   position)               │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│  Background Super-Resolution │
│  (Real-ESRGAN x4plus)       │
│  Process non-face regions    │
└────────┬───────────────┘
         │
         ▼
    High-Resolution Output Image
```

---

## 5. SwinIR — Transformer-Based Super-Resolution

### 5.1 SwinIR Implementation and Usage

```python
"""
SwinIR: Applying Swin Transformer to super-resolution

Features:
- Wider receptive field than CNNs (window attention)
- Shifted windows for information exchange between adjacent windows
- High fidelity (does not "hallucinate" details as much as GAN-based methods)
"""

import torch
from PIL import Image
import numpy as np

def upscale_with_swinir(image_path, scale=4, task="real_sr"):
    """
    Super-resolution with SwinIR

    task:
      "classical_sr": Classical super-resolution (assumes bicubic degradation)
      "real_sr": Real-world super-resolution (assumes composite degradation)
      "lightweight_sr": Lightweight version
      "jpeg_car": JPEG compression artifact removal
      "color_dn": Color noise removal
      "gray_dn": Grayscale noise removal
    """
    # Model configuration
    model_configs = {
        "classical_sr": {
            "model_path": "weights/001_classicalSR_DF2K_s64w8_"
                         f"SwinIR-M_x{scale}.pth",
            "window_size": 8,
            "img_size": 64,
        },
        "real_sr": {
            "model_path": "weights/003_realSR_BSRGAN_DFOWMFC_"
                         f"s64w8_SwinIR-L_x{scale}_GAN.pth",
            "window_size": 8,
            "img_size": 64,
        },
        "lightweight_sr": {
            "model_path": "weights/002_lightweightSR_DIV2K_"
                         f"s64w8_SwinIR-S_x{scale}.pth",
            "window_size": 8,
            "img_size": 64,
        },
    }

    config = model_configs[task]

    # Load image and apply padding
    img = np.array(Image.open(image_path)).astype(np.float32) / 255.0
    img = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0)

    # Pad to a multiple of window size
    ws = config["window_size"]
    _, _, h, w = img.shape
    pad_h = (ws - h % ws) % ws
    pad_w = (ws - w % ws) % ws
    img = torch.nn.functional.pad(img, (0, pad_w, 0, pad_h), mode="reflect")

    # Model loading and inference
    model = torch.load(config["model_path"])
    model.eval()

    with torch.no_grad():
        output = model(img.to("cuda"))

    # Remove padding
    output = output[:, :, :h * scale, :w * scale]

    # Tensor → PIL Image
    output = output.squeeze(0).permute(1, 2, 0).cpu().numpy()
    output = np.clip(output * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(output)
```

### 5.2 Choosing Between SwinIR and Real-ESRGAN

```
SwinIR vs Real-ESRGAN Decision Matrix:

                 Fidelity Priority    Quality Priority
                  ┌──────┐          ┌──────┐
 Speed Priority → │SwinIR│          │Real- │ ← Speed Priority
                  │(L)   │          │ESRGAN│
                  └──────┘          └──────┘

                  ┌──────┐          ┌──────┐
 Max Quality →    │SwinIR│          │SUPIR │ ← Max Quality
                  │+ Post│          │      │
                  │proc. │          │      │
                  └──────┘          └──────┘

Specific Selection Criteria:

┌─────────────────┬──────────┬─────────────┐
│ Requirement     │ SwinIR   │ Real-ESRGAN │
├─────────────────┼──────────┼─────────────┤
│ Medical/Science │ ◎        │ △           │
│ Evidence Photos │ ◎        │ △           │
│ E-commerce      │ ○        │ ◎           │
│ Social Media    │ △        │ ◎           │
│ Print Materials │ ○        │ ○           │
│ Anime/Illustr.  │ △        │ ◎           │
│ Batch Process   │ ○        │ ◎           │
│ Edge Preserv.   │ ◎        │ ○           │
│ Texture Gen.    │ △        │ ◎           │
└─────────────────┴──────────┴─────────────┘
```

---

## 6. Video Super-Resolution

### 6.1 Frame-by-Frame Super-Resolution

```python
import cv2
from pathlib import Path
import time

class VideoUpscaler:
    """Video super-resolution pipeline"""

    def __init__(self, model_type="realesrgan", scale=4, device="cuda"):
        self.scale = scale
        self.model_type = model_type
        self._init_model(device)

    def _init_model(self, device):
        """Initialize model"""
        if self.model_type == "realesrgan":
            from basicsr.archs.rrdbnet_arch import RRDBNet
            from realesrgan import RealESRGANer

            model = RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64,
                num_block=23, num_grow_ch=32, scale=self.scale,
            )
            self.upsampler = RealESRGANer(
                scale=self.scale,
                model_path=f"weights/RealESRGAN_x{self.scale}plus.pth",
                model=model,
                tile=400,
                tile_pad=10,
                half=True,
            )

    def upscale_video(self, input_path, output_path,
                      codec="libx264", crf=18,
                      audio_copy=True):
        """
        Upscale a video with super-resolution

        Parameters:
            input_path: Input video path
            output_path: Output video path
            codec: Output codec
            crf: Quality (0=lossless, 51=lowest, 18 recommended)
            audio_copy: Whether to copy audio
        """
        cap = cv2.VideoCapture(input_path)

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        out_w = w * self.scale
        out_h = h * self.scale

        # Output video only to a temporary file
        tmp_video = output_path + ".tmp.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(
            tmp_video, fourcc, fps, (out_w, out_h)
        )

        print(f"Input: {w}x{h} @ {fps}fps, {total_frames} frames")
        print(f"Output: {out_w}x{out_h}")

        start_time = time.time()
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Super-resolution
            output, _ = self.upsampler.enhance(
                frame, outscale=self.scale
            )
            writer.write(output)

            frame_idx += 1
            if frame_idx % 10 == 0:
                elapsed = time.time() - start_time
                fps_actual = frame_idx / elapsed
                eta = (total_frames - frame_idx) / fps_actual
                print(
                    f"  [{frame_idx}/{total_frames}] "
                    f"{fps_actual:.1f} fps, "
                    f"ETA: {eta:.0f}s"
                )

        cap.release()
        writer.release()

        # Merge audio with ffmpeg
        if audio_copy:
            import subprocess
            cmd = [
                "ffmpeg", "-y",
                "-i", tmp_video,
                "-i", input_path,
                "-c:v", codec,
                "-crf", str(crf),
                "-c:a", "copy",
                "-map", "0:v:0",
                "-map", "1:a:0?",
                output_path,
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            Path(tmp_video).unlink()
        else:
            Path(tmp_video).rename(output_path)

        total_time = time.time() - start_time
        print(f"\nComplete: {total_time:.1f}s "
              f"({total_frames / total_time:.1f} fps)")

        return {
            "input": input_path,
            "output": output_path,
            "frames": total_frames,
            "elapsed_seconds": round(total_time, 1),
            "avg_fps": round(total_frames / total_time, 2),
        }
```

### 6.2 Ensuring Temporal Consistency

```python
def temporal_consistent_upscale(frames, upsampler, flow_model=None):
    """
    Super-resolution with temporal consistency

    Simply applying super-resolution frame by frame causes
    detail flickering between frames (temporal flickering).

    Countermeasures:
    1. Optical flow alignment
    2. Reference previous frame results
    3. Temporal blending
    """

    results = []
    prev_output = None

    for i, frame in enumerate(frames):
        # Super-resolve current frame
        current_output, _ = upsampler.enhance(
            frame, outscale=4
        )

        if prev_output is not None and flow_model is not None:
            # Warp previous frame using optical flow
            flow = flow_model.estimate(
                frames[i-1], frame
            )
            warped_prev = warp_image(prev_output, flow, scale=4)

            # Blend current frame and warped previous frame
            # → Suppress temporal flickering
            alpha = 0.3  # Blend ratio
            occlusion_mask = compute_occlusion_mask(flow)

            current_output = np.where(
                occlusion_mask[..., None],
                current_output,  # Use current frame only for occluded regions
                (1 - alpha) * current_output
                + alpha * warped_prev  # Blend for other regions
            ).astype(np.uint8)

        results.append(current_output)
        prev_output = current_output

    return results
```

---

## 7. Production Pipeline Integration

### 7.1 REST API Super-Resolution Service

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import tempfile
import uuid
from pathlib import Path

app = FastAPI(title="Super Resolution API")

# Global pipeline
pipeline = RealESRGANPipeline(device="cuda", half=True)

@app.post("/upscale")
async def upscale_image(
    file: UploadFile = File(...),
    scale: int = 4,
    model: str = "auto",
):
    """
    API endpoint for image upscaling

    Parameters:
        file: Uploaded image
        scale: Scale factor (2 or 4)
        model: Model name ("photo", "anime", "auto")
    """
    # Validation
    if scale not in (2, 4):
        raise HTTPException(400, "scale must be 2 or 4")

    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"Unsupported: {file.content_type}")

    # File size limit (20MB)
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    # Save to temporary file
    job_id = str(uuid.uuid4())
    tmp_dir = Path(tempfile.mkdtemp())
    input_path = tmp_dir / f"input_{job_id}.png"
    output_path = tmp_dir / f"output_{job_id}.png"

    with open(input_path, "wb") as f:
        f.write(contents)

    try:
        model_type = None if model == "auto" else model
        result = pipeline.upscale(
            str(input_path),
            str(output_path),
            model_type=model_type,
            scale=scale,
            tile=400,
        )
    except Exception as e:
        raise HTTPException(500, f"Processing error: {str(e)}")

    return FileResponse(
        str(output_path),
        media_type="image/png",
        filename=f"upscaled_{file.filename}",
        headers={
            "X-Input-Size": result["input_size"],
            "X-Output-Size": result["output_size"],
            "X-Model": result["model"],
            "X-Elapsed": str(result["elapsed_seconds"]),
        },
    )


@app.post("/upscale/batch")
async def batch_upscale(
    files: list[UploadFile] = File(...),
    scale: int = 4,
    model: str = "auto",
):
    """Batch upscaling of multiple images"""
    if len(files) > 50:
        raise HTTPException(400, "Max 50 files per batch")

    results = []
    for file in files:
        try:
            # Process each file individually
            result = await upscale_image(file, scale, model)
            results.append({
                "filename": file.filename,
                "status": "success",
            })
        except HTTPException as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "detail": e.detail,
            })

    return {"results": results}
```

### 7.2 Gradio GUI Application

```python
import gradio as gr
from PIL import Image
import numpy as np

def create_upscaling_ui():
    """Gradio-based super-resolution GUI"""

    pipeline = RealESRGANPipeline(device="cuda")

    def upscale_handler(image, model_choice, scale, tile_size):
        """Super-resolution processing handler"""
        if image is None:
            return None, "Please upload an image"

        # PIL → temporary file → process → PIL
        import tempfile
        with tempfile.NamedTemporaryFile(
            suffix=".png", delete=False
        ) as tmp:
            Image.fromarray(image).save(tmp.name)
            result = pipeline.upscale(
                tmp.name,
                model_type=(
                    None if model_choice == "Auto Detect"
                    else model_choice.lower()
                ),
                scale=scale,
                tile=tile_size,
            )

        output = Image.open(result["output"])
        info = (
            f"Input: {result['input_size']} → "
            f"Output: {result['output_size']}\n"
            f"Model: {result['model']}\n"
            f"Processing time: {result['elapsed_seconds']}s"
        )
        return np.array(output), info

    with gr.Blocks(title="AI Super-Resolution") as demo:
        gr.Markdown("# AI Super-Resolution Tool")

        with gr.Row():
            with gr.Column():
                input_img = gr.Image(label="Input Image")
                model_choice = gr.Radio(
                    ["Auto Detect", "Photo", "Anime"],
                    label="Model",
                    value="Auto Detect",
                )
                scale = gr.Slider(
                    minimum=2, maximum=4, step=2,
                    value=4, label="Scale Factor",
                )
                tile_size = gr.Slider(
                    minimum=0, maximum=800, step=100,
                    value=400, label="Tile Size (0=disabled)",
                )
                btn = gr.Button("Run Super-Resolution", variant="primary")

            with gr.Column():
                output_img = gr.Image(label="Output Image")
                info_text = gr.Textbox(label="Processing Info")

        btn.click(
            fn=upscale_handler,
            inputs=[input_img, model_choice, scale, tile_size],
            outputs=[output_img, info_text],
        )

    return demo

# demo = create_upscaling_ui()
# demo.launch(server_name="0.0.0.0", server_port=7860)
```

### 7.3 Cloud API Usage (Replicate / RunPod)

```python
import replicate
import requests
from pathlib import Path

class CloudUpscaler:
    """Super-resolution using cloud APIs (no local GPU required)"""

    def __init__(self, provider="replicate"):
        self.provider = provider

    def upscale_replicate(self, image_path, scale=4, model="real-esrgan"):
        """Super-resolution via Replicate API"""
        model_versions = {
            "real-esrgan": "xinntao/realesrgan:latest",
            "supir": "cjwbw/supir:latest",
            "swinir": "jingyunliang/swinir:latest",
        }

        with open(image_path, "rb") as f:
            output = replicate.run(
                model_versions[model],
                input={
                    "image": f,
                    "scale": scale,
                    "face_enhance": True,
                },
            )

        # Download result
        output_path = Path(image_path).stem + "_upscaled.png"
        if isinstance(output, str):
            response = requests.get(output)
            with open(output_path, "wb") as f:
                f.write(response.content)
        elif isinstance(output, list):
            response = requests.get(output[0])
            with open(output_path, "wb") as f:
                f.write(response.content)

        return output_path

    def upscale_runpod(self, image_path, scale=4):
        """Super-resolution via RunPod Serverless"""
        import base64

        with open(image_path, "rb") as f:
            img_base64 = base64.b64encode(f.read()).decode()

        response = requests.post(
            "https://api.runpod.ai/v2/<endpoint_id>/run",
            headers={
                "Authorization": f"Bearer {RUNPOD_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "input": {
                    "image": img_base64,
                    "scale": scale,
                    "model": "realesrgan",
                },
            },
        )

        job_id = response.json()["id"]

        # Poll for results
        import time
        while True:
            status = requests.get(
                f"https://api.runpod.ai/v2/<endpoint_id>/status/{job_id}",
                headers={
                    "Authorization": f"Bearer {RUNPOD_API_KEY}",
                },
            ).json()

            if status["status"] == "COMPLETED":
                output_b64 = status["output"]["image"]
                output_bytes = base64.b64decode(output_b64)
                output_path = Path(image_path).stem + "_upscaled.png"
                with open(output_path, "wb") as f:
                    f.write(output_bytes)
                return output_path

            elif status["status"] == "FAILED":
                raise RuntimeError(f"RunPod error: {status}")

            time.sleep(2)
```

---

## 8. Comparison Tables

### Comparison Table 1: Detailed Comparison of Super-Resolution Models

| Model | Type | Max Scale | Speed | Quality | VRAM | Fidelity |
|--------|------|---------|------|------|------|--------|
| **Lanczos** | Classical | Unlimited | Very Fast | ★★★ | 0 | Highest |
| **Real-ESRGAN** | GAN | x4 | Fast | ★★★★☆ | 2GB | High |
| **ESRGAN anime** | GAN | x4 | Fast | ★★★★ | 2GB | High |
| **SwinIR** | Transformer | x4 | Medium | ★★★★☆ | 4GB | High |
| **SD x4 Upscaler** | Diffusion | x4 | Slow | ★★★★★ | 6GB | Moderate |
| **StableSR** | Diffusion | x4 | Slow | ★★★★★ | 8GB | Moderate |
| **SUPIR** | Diffusion+LLM | x4 | Very Slow | ★★★★★ | 12GB+ | Moderate |

### Comparison Table 2: Recommended Models by Use Case

| Use Case | Recommended Model | Reason |
|-------------|-----------|------|
| **Social media quality boost** | Real-ESRGAN x4plus | Balance of speed and quality |
| **Anime/Illustrations** | Real-ESRGAN anime | Anime-specialized training |
| **Print-quality upscaling** | SUPIR / StableSR | Highest quality detail generation |
| **Batch processing (large volume)** | Real-ESRGAN | Fast processing speed |
| **Medical/Scientific images** | SwinIR / Lanczos | Fidelity is top priority |
| **Face photo restoration** | GFPGAN + Real-ESRGAN | Combination with face-specific model |
| **Old photo restoration** | SUPIR | Text-guided detail addition |
| **E-commerce product photos** | Real-ESRGAN + color correction | Texture preservation and color accuracy |
| **Surveillance footage** | SwinIR | Fidelity-focused, evidence preservation |
| **Satellite imagery** | SwinIR + domain-specific fine-tuning | Geographic information accuracy |

### Comparison Table 3: Processing Speed Benchmark

```
Test conditions: 512x512 → 2048x2048 (4x), NVIDIA RTX 4090

┌──────────────────┬───────────┬────────────┬────────────┐
│ Model            │ Time      │ VRAM Usage │ Throughput │
├──────────────────┼───────────┼────────────┼────────────┤
│ Lanczos (CPU)    │ 0.002s    │ 0          │ 500 img/s  │
│ Real-ESRGAN      │ 0.05s     │ 1.8GB      │ 20 img/s   │
│ Real-ESRGAN FP16 │ 0.03s     │ 0.9GB      │ 33 img/s   │
│ SwinIR-M         │ 0.15s     │ 3.2GB      │ 6.7 img/s  │
│ SwinIR-L         │ 0.35s     │ 5.1GB      │ 2.9 img/s  │
│ SD x4 Upscaler   │ 3.5s      │ 5.8GB      │ 0.29 img/s │
│ StableSR (50step)│ 8.2s      │ 7.5GB      │ 0.12 img/s │
│ SUPIR (50step)   │ 25s       │ 14GB       │ 0.04 img/s │
└──────────────────┴───────────┴────────────┴────────────┘

* Excludes model loading time for batch processing
* Increases proportionally to image size with tile processing enabled
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Repeating Super-Resolution Multiple Times

```
[Problem]
Applying 4x super-resolution twice, thinking it will achieve 16x.

[Why It's a Problem]
- Artifacts accumulate with each processing pass
- GAN-based models over-emphasize patterns
- Non-existent details get amplified
- The second pass rarely contributes to quality improvement

[Correct Approach]
- Reach the target resolution in a single pass (4x is the practical limit)
- For larger upscaling: Lanczos to intermediate size → AI super-resolution
- Use diffusion-based methods (SUPIR, etc.) for one-shot high-quality upscaling
```

### Anti-Pattern 2: Applying the Same Model to All Images

```
[Problem]
Processing photos, anime, and illustrations all with Real-ESRGAN x4plus.

[Why It's a Problem]
- Photo models applied to anime produce excessive textures
- Anime models applied to photos produce flat-looking results
- Not suitable for text images (characters become blurry)

[Correct Approach]
- Detect input image type and switch models accordingly
- Photos: x4plus / SUPIR
- Anime: x4plus_anime / waifu2x
- Text: Lanczos / SwinIR
- Mixed content: Segment regions and process individually
```

### Anti-Pattern 3: Ignoring VRAM Limits and Processing at Full Size

```
[Problem]
Attempting to super-resolve an 8000x6000 image with tile=0 (tile processing disabled),
resulting in an OOM (Out of Memory) error.

[Why It's a Problem]
- VRAM consumption scales quadratically with image size
- 4x super-resolution would produce 32000x24000 output, requiring massive memory
- OOM errors can leave GPU processes lingering, affecting other tasks

[Correct Approach]
- Always set the tile parameter (recommended: 400-512)
- Automatically adjust tile size based on input size
- Incorporate VRAM monitoring and issue warnings when dangerous
- Catch OOM with try-except, reduce tile size, and retry
```

### Anti-Pattern 4: Delivering Super-Resolution Results Without Validation

```
[Problem]
Using super-resolution output directly as the final deliverable.

[Why It's a Problem]
- GAN-based models can "hallucinate" (generate non-existent textures/patterns)
- Faces may subtly change
- JPEG compression artifacts may be amplified
- Color tones may shift

[Correct Approach]
- Always perform human review after super-resolution
- Automatically check quality metrics (PSNR, SSIM, LPIPS)
- Set thresholds and alert on anomalous values
- Pay special attention to faces and text areas
```

### Anti-Pattern 5: Saving JPEG-Compressed Images as JPEG Again

```
[Problem]
Super-resolving a JPEG image and saving the result as JPEG again.

[Why It's a Problem]
- Details improved by super-resolution are lost to JPEG compression
- Double JPEG compression artifacts
- Mosquito noise appears especially at edges

[Correct Approach]
- Always save super-resolution output as PNG (lossless)
- If JPEG is required for final delivery, use quality=95 or higher
- WebP (lossless mode) is also a good choice
- Maintain lossless formats throughout the workflow
```

---

## 10. Troubleshooting

### 10.1 Common Errors and Solutions

```python
class UpscaleErrorHandler:
    """Handling common errors in super-resolution"""

    @staticmethod
    def handle_oom(func):
        """Retry with reduced tile size on OOM error"""
        import functools

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            tile_sizes = [0, 512, 400, 256, 128]
            last_error = None

            for tile_size in tile_sizes:
                try:
                    kwargs["tile"] = tile_size
                    return func(*args, **kwargs)
                except RuntimeError as e:
                    if "out of memory" in str(e).lower():
                        last_error = e
                        # Clear GPU memory
                        import torch
                        torch.cuda.empty_cache()
                        if tile_size == 0:
                            print(
                                "VRAM insufficient: switching to tile processing "
                                f"(tile={tile_sizes[1]})"
                            )
                        else:
                            print(
                                f"VRAM insufficient: reducing tile size "
                                f"(tile={tile_size} → next size)"
                            )
                    else:
                        raise

            raise RuntimeError(
                f"OOM with all tile sizes: {last_error}"
            )

        return wrapper

    @staticmethod
    def validate_input(image_path):
        """Validate input image"""
        import cv2
        from pathlib import Path

        path = Path(image_path)

        # File existence check
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        # Extension check
        valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
        if path.suffix.lower() not in valid_exts:
            raise ValueError(
                f"Unsupported format: {path.suffix}\n"
                f"Supported: {valid_exts}"
            )

        # Image loading test
        img = cv2.imread(str(path))
        if img is None:
            raise ValueError(f"Failed to load image (corrupted?): {path}")

        h, w = img.shape[:2]

        # Size check
        if h < 16 or w < 16:
            raise ValueError(
                f"Image too small: {w}x{h} (minimum: 16x16)"
            )

        if h > 10000 or w > 10000:
            print(
                f"Warning: Large image ({w}x{h}). "
                "Tile processing is recommended."
            )

        # Memory estimate (4x super-resolution)
        estimated_vram_gb = (
            w * h * 3 * 4 * 16  # Rough estimate
        ) / (1024 ** 3)

        return {
            "path": str(path),
            "size": f"{w}x{h}",
            "channels": img.shape[2] if len(img.shape) > 2 else 1,
            "estimated_vram_gb": round(estimated_vram_gb, 2),
            "recommendation": (
                "Tile processing recommended" if w * h > 2_000_000
                else "Tile processing not needed"
            ),
        }
```

### 10.2 Handling Color Shifts

```python
def post_process_color_correction(
    original_path, upscaled_path, output_path,
    method="histogram_matching"
):
    """
    Color correction after super-resolution

    Super-resolution models may alter color tones.
    Correct by referencing the original image's color distribution.
    """
    import cv2
    import numpy as np

    original = cv2.imread(original_path)
    upscaled = cv2.imread(upscaled_path)

    # Resize original to super-resolved size (for reference)
    h, w = upscaled.shape[:2]
    original_resized = cv2.resize(
        original, (w, h), interpolation=cv2.INTER_LANCZOS4
    )

    if method == "histogram_matching":
        # Histogram matching
        result = np.zeros_like(upscaled)
        for ch in range(3):
            result[:, :, ch] = _match_histogram(
                upscaled[:, :, ch],
                original_resized[:, :, ch],
            )

    elif method == "color_transfer":
        # Statistical color transfer in LAB color space
        result = _lab_color_transfer(original_resized, upscaled)

    elif method == "linear":
        # Linear regression color correction
        result = _linear_color_correction(
            original_resized, upscaled
        )

    cv2.imwrite(output_path, result)
    return output_path


def _match_histogram(source, reference):
    """Histogram matching (single channel)"""
    src_values, src_unique_indices, src_counts = np.unique(
        source.ravel(), return_inverse=True, return_counts=True
    )
    ref_values, ref_counts = np.unique(
        reference.ravel(), return_counts=True
    )

    src_cdf = np.cumsum(src_counts).astype(np.float64)
    src_cdf /= src_cdf[-1]

    ref_cdf = np.cumsum(ref_counts).astype(np.float64)
    ref_cdf /= ref_cdf[-1]

    interp_values = np.interp(src_cdf, ref_cdf, ref_values)
    return interp_values[src_unique_indices].reshape(source.shape).astype(
        np.uint8
    )


def _lab_color_transfer(source, target):
    """Color transfer in LAB color space (Reinhard et al.)"""
    source_lab = cv2.cvtColor(source, cv2.COLOR_BGR2LAB).astype(np.float32)
    target_lab = cv2.cvtColor(target, cv2.COLOR_BGR2LAB).astype(np.float32)

    for ch in range(3):
        src_mean = source_lab[:, :, ch].mean()
        src_std = source_lab[:, :, ch].std()
        tgt_mean = target_lab[:, :, ch].mean()
        tgt_std = target_lab[:, :, ch].std()

        target_lab[:, :, ch] = (
            (target_lab[:, :, ch] - tgt_mean)
            * (src_std / (tgt_std + 1e-8))
            + src_mean
        )

    target_lab = np.clip(target_lab, 0, 255).astype(np.uint8)
    return cv2.cvtColor(target_lab, cv2.COLOR_LAB2BGR)
```

---

## FAQ

### Q1: What is the difference between super-resolution and simple upscaling?

**A:** They are fundamentally different:

- **Upscaling (resizing):** Interpolates existing pixels. No new information is added. Always results in blurriness
- **Super-Resolution:** AI **estimates/generates new details** from learned patterns. Edges become sharper and textures are restored
- **Note:** Super-resolution is "estimation," so it may add details that did not exist in the original image through "hallucination." Exercise caution when fidelity is required

### Q2: What upscale factor is practical?

**A:**

- **2x:** Safest. High quality with high fidelity
- **4x:** Practical upper limit. Sufficient quality for photos
- **8x and above:** Most details are AI-generated. Acceptable for art/creative purposes
- **Rule of thumb:** For a 512x512 original, 4x (2048x2048) is the practical limit
- **For larger upscaling:** Use diffusion-based methods (SUPIR) to ensure quality

### Q3: What if VRAM is insufficient for super-resolution?

**A:** The following countermeasures are available:

1. **Tile processing:** Split the image and process each part (recommended tile_size=400-512)
2. **FP16 (half precision):** half=True halves VRAM usage
3. **CPU processing:** Slower but requires no VRAM. Real-ESRGAN works on CPU
4. **Smaller model size:** RealESRGAN_x4plus_anime (6B) is a lightweight version
5. **Cloud APIs:** Use API services like Replicate

### Q4: How to fine-tune a super-resolution model?

**A:** When domain-specific super-resolution is needed, fine-tuning can be done with these steps:

1. **Dataset preparation:** Collect high-resolution images (minimum 500, ideally 5000+)
2. **Create degradation pairs:** Generate low-resolution images from high-resolution ones using a degradation model
3. **Fine-tune Real-ESRGAN:**

```python
# BasicSR configuration file example
# finetune_realesrgan_x4plus.yml

name: finetune_RealESRGANx4plus
model_type: RealESRGANModel
scale: 4
num_gpu: 1

datasets:
  train:
    name: custom_dataset
    type: RealESRGANPairedDataset
    dataroot_gt: /data/train/HR  # High-resolution images
    dataroot_lq: /data/train/LR  # Low-resolution images
    io_backend:
      type: disk
    gt_size: 256
    use_hflip: true
    use_rot: true

# Network configuration
network_g:
  type: RRDBNet
  num_in_ch: 3
  num_out_ch: 3
  num_feat: 64
  num_block: 23
  num_grow_ch: 32
  scale: 4

# Training configuration
train:
  optim_g:
    type: Adam
    lr: !!float 1e-4
    weight_decay: 0
    betas: [0.9, 0.99]

  # Start from pre-trained model
  path:
    pretrain_network_g: weights/RealESRGAN_x4plus.pth
    strict_load_g: true

  total_iter: 50000
  warmup_iter: -1
```

### Q5: What about super-resolution for newer formats like WebP and AVIF?

**A:** For input formats, there are no issues as long as OpenCV / Pillow supports them. What matters is the output format selection:

| Format | Lossless | Recommended Use | Notes |
|-------------|---------|---------|--------|
| **PNG** | Yes | Intermediate files, quality priority | Large file size |
| **WebP** | Both | Web publishing, lossless storage | Some viewers unsupported |
| **AVIF** | Both | Modern web, high compression | Slow encoding |
| **JPEG XL** | Both | Future standard, transitioning | Limited browser support |
| **TIFF** | Yes | Print, archiving | Large file size |
| **JPEG** | No | Final delivery only | Q95+ recommended |

### Q6: Can results from multiple super-resolution models be ensembled?

**A:** Yes, it is possible. However, since processing time doubles, this should be limited to cases where quality is paramount:

```python
def ensemble_upscale(image_path, models, weights=None):
    """Combine results from multiple models using weighted average"""
    results = []
    for model in models:
        result = model.upscale(image_path)
        results.append(np.array(result).astype(np.float32))

    if weights is None:
        weights = [1.0 / len(models)] * len(models)

    ensemble = np.zeros_like(results[0])
    for result, weight in zip(results, weights):
        ensemble += result * weight

    return Image.fromarray(
        np.clip(ensemble, 0, 255).astype(np.uint8)
    )
```

---

## Summary Table

| Item | Key Points |
|------|------|
| **Classical Methods** | Lanczos is the best. 100% fidelity but no detail addition |
| **GAN-Based (Real-ESRGAN)** | Fast and high quality. Use different models for photos/anime |
| **Transformer-Based (SwinIR)** | Higher fidelity than GAN-based. Slightly slower processing |
| **Diffusion-Based (SUPIR)** | Highest quality but slow. Controllable via text guidance |
| **Face Restoration (GFPGAN)** | Face-specific. Combine with Real-ESRGAN for backgrounds |
| **Tile Processing** | Essential technique for large images or limited VRAM |
| **Practical Scale** | 4x is the upper limit guideline. 2x is the safest |
| **Color Correction** | Histogram matching after super-resolution is effective |
| **Video Super-Resolution** | Frame-by-frame processing + ensuring temporal consistency is key |
| **Quality Evaluation** | Combine PSNR/SSIM/LPIPS for comprehensive assessment |

---


## Summary

In this guide, you learned the following important points:

- Understanding of fundamental concepts and principles
- Practical implementation patterns
- Best practices and caveats
- Real-world application methods

---

## Recommended Next Reads

- [03-design-tools.md](./03-design-tools.md) — Super-resolution features integrated into design tools
- [../02-video/00-video-generation.md](../02-video/00-video-generation.md) — Video super-resolution
- [../03-3d/00-3d-generation.md](../03-3d/00-3d-generation.md) — High-resolution 3D textures

---

## References

1. Wang, X. et al. (2021). "Real-ESRGAN: Training Real-World Blind Super-Resolution with Pure Synthetic Data." *ICCV Workshop 2021*. https://arxiv.org/abs/2107.10833
2. Liang, J. et al. (2021). "SwinIR: Image Restoration Using Swin Transformer." *ICCV Workshop 2021*. https://arxiv.org/abs/2108.10257
3. Yu, F. et al. (2024). "Scaling Up to Excellence: Practicing Model Scaling for Photo-Realistic Image Restoration In the Wild." *CVPR 2024*. https://arxiv.org/abs/2401.13627
4. Wang, J. et al. (2023). "Exploiting Diffusion Prior for Real-World Image Super-Resolution (StableSR)." *arXiv*. https://arxiv.org/abs/2305.07015
5. Wang, X. et al. (2021). "GFPGAN: Towards Real-World Blind Face Restoration with Generative Facial Prior." *CVPR 2021*. https://arxiv.org/abs/2101.04061
6. Zhou, S. et al. (2022). "Towards Robust Blind Face Restoration with Codebook Lookup Transformer (CodeFormer)." *NeurIPS 2022*. https://arxiv.org/abs/2206.11253
7. Ledig, C. et al. (2017). "Photo-Realistic Single Image Super-Resolution Using a Generative Adversarial Network (SRGAN)." *CVPR 2017*. https://arxiv.org/abs/1609.04802
8. Dong, C. et al. (2014). "Image Super-Resolution Using Deep Convolutional Networks (SRCNN)." *ECCV 2014*. https://arxiv.org/abs/1501.00092
