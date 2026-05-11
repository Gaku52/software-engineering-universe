# Image Editing — Inpainting, Outpainting

> A practical guide to AI-powered partial image modification and extension techniques, from mask generation to seamless compositing.

---

## What You Will Learn in This Chapter

1. **Principles and Implementation of Inpainting** — Natural completion of masked regions, partial rewriting with prompts
2. **Outpainting Techniques** — Extending beyond image boundaries, panorama generation
3. **Advanced Editing with Img2Img and ControlNet** — Composition preservation, style transfer, pose control
4. **Automatic Mask Generation Pipelines** — SAM, Grounding DINO, text-based region selection
5. **Instruct-Pix2Pix and Natural Language Editing** — Intuitive image editing through text instructions
6. **Commercial Workflows** — Batch processing, quality management, production-ready pipelines


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Image Generation — Stable Diffusion, DALL-E, Midjourney](./00-image-generation.md)

---

## 1. Inpainting

### 1.1 Theoretical Background of Inpainting

Inpainting leverages the reverse diffusion process of diffusion models, adding noise only to the masked region and gradually denoising it. The unmasked regions of the original image are either forcibly reset to original pixel values at each step (Repaint method), or a dedicated model receives the original image and mask as conditioning.

```
Mathematical Formulation:

Reverse diffusion step t:
  x_{t-1}^{masked} = denoise(x_t, t, prompt)   # Masked region
  x_{t-1}^{unmasked} = original_image           # Unmasked region
  x_{t-1} = mask * x_{t-1}^{masked} + (1 - mask) * x_{t-1}^{unmasked}

Repaint Method Improvement:
  - n resamplings per step (jump_length)
  - Forward diffusion to re-add noise → reverse diffusion to denoise
  - Significantly improved boundary consistency
  - n=10 is a typical setting
```

### Code Example 1: Inpainting with diffusers

```python
from diffusers import StableDiffusionXLInpaintPipeline
from PIL import Image
import torch

# Load the inpainting pipeline
pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
    "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

# Memory optimization
pipe.enable_model_cpu_offload()
pipe.enable_vae_tiling()

# Load the original image and mask
image = Image.open("room.png").resize((1024, 1024))
mask = Image.open("mask.png").resize((1024, 1024))  # White = edit region

# Execute inpainting
result = pipe(
    prompt="a modern leather sofa, interior design, photorealistic",
    negative_prompt="low quality, blurry, distorted",
    image=image,
    mask_image=mask,
    num_inference_steps=30,
    guidance_scale=7.5,
    strength=0.85,    # Deviation from original (0=no change, 1=full regeneration)
).images[0]

result.save("room_edited.png")
```

### Code Example 2: Programmatic Mask Generation (Extended)

```python
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from typing import Optional, Tuple, List


class MaskGenerator:
    """
    Unified class providing various mask generation methods

    Mask conventions:
    - White (255) = Edit region
    - Black (0) = Protected region
    - Gray = Blend intensity (feathering)
    """

    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height

    def rectangular(self, bbox: Tuple[int, int, int, int],
                     feather: int = 0) -> Image.Image:
        """Generate a rectangular mask"""
        mask = Image.new("L", (self.width, self.height), 0)
        draw = ImageDraw.Draw(mask)
        draw.rectangle(bbox, fill=255)
        if feather > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(feather))
        return mask

    def circular(self, center: Tuple[int, int],
                  radius: int, feather: int = 0) -> Image.Image:
        """Generate a circular mask"""
        mask = Image.new("L", (self.width, self.height), 0)
        draw = ImageDraw.Draw(mask)
        x, y = center
        draw.ellipse(
            [x - radius, y - radius, x + radius, y + radius],
            fill=255,
        )
        if feather > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(feather))
        return mask

    def polygon(self, points: List[Tuple[int, int]],
                 feather: int = 0) -> Image.Image:
        """Generate a polygon mask"""
        mask = Image.new("L", (self.width, self.height), 0)
        draw = ImageDraw.Draw(mask)
        draw.polygon(points, fill=255)
        if feather > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(feather))
        return mask

    def freeform(self, points: List[Tuple[int, int]],
                  width: int = 30,
                  feather: int = 10) -> Image.Image:
        """Generate a freehand brush stroke mask"""
        mask = Image.new("L", (self.width, self.height), 0)
        draw = ImageDraw.Draw(mask)
        for i in range(len(points) - 1):
            draw.line(
                [points[i], points[i + 1]],
                fill=255,
                width=width,
            )
            # Round join points
            x, y = points[i]
            r = width // 2
            draw.ellipse(
                [x - r, y - r, x + r, y + r],
                fill=255,
            )
        if feather > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(feather))
        return mask

    def gradient(self, direction: str = "left_to_right",
                  start: float = 0.0,
                  end: float = 1.0) -> Image.Image:
        """Generate a gradient mask"""
        arr = np.zeros((self.height, self.width), dtype=np.float32)

        if direction == "left_to_right":
            for x in range(self.width):
                arr[:, x] = start + (end - start) * x / self.width
        elif direction == "top_to_bottom":
            for y in range(self.height):
                arr[y, :] = start + (end - start) * y / self.height
        elif direction == "center_out":
            cx, cy = self.width // 2, self.height // 2
            max_dist = np.sqrt(cx ** 2 + cy ** 2)
            for y in range(self.height):
                for x in range(self.width):
                    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                    arr[y, x] = start + (end - start) * dist / max_dist

        arr = np.clip(arr * 255, 0, 255).astype(np.uint8)
        return Image.fromarray(arr)

    def from_color_range(self, image: Image.Image,
                          target_color: Tuple[int, int, int],
                          tolerance: int = 30,
                          feather: int = 5) -> Image.Image:
        """Generate a mask based on color range"""
        img_array = np.array(image)
        target = np.array(target_color)

        # Calculate color difference
        diff = np.sqrt(
            np.sum((img_array.astype(float) - target) ** 2, axis=2)
        )

        # Convert to mask using threshold
        mask_array = (diff < tolerance).astype(np.uint8) * 255
        mask = Image.fromarray(mask_array)

        if feather > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(feather))
        return mask

    def combine(self, masks: List[Image.Image],
                 mode: str = "union") -> Image.Image:
        """Combine multiple masks"""
        arrays = [np.array(m, dtype=float) for m in masks]

        if mode == "union":
            result = np.maximum.reduce(arrays)
        elif mode == "intersection":
            result = np.minimum.reduce(arrays)
        elif mode == "difference":
            result = np.clip(arrays[0] - arrays[1], 0, 255)
        elif mode == "xor":
            a, b = arrays[0] > 127, arrays[1] > 127
            result = np.logical_xor(a, b).astype(float) * 255
        else:
            result = arrays[0]

        return Image.fromarray(result.astype(np.uint8))

    def invert(self, mask: Image.Image) -> Image.Image:
        """Invert a mask"""
        return Image.fromarray(255 - np.array(mask))

    def dilate(self, mask: Image.Image,
                pixels: int = 10) -> Image.Image:
        """Expand (dilate) a mask"""
        arr = np.array(mask)
        from scipy.ndimage import binary_dilation
        struct = np.ones((pixels * 2 + 1, pixels * 2 + 1))
        dilated = binary_dilation(arr > 127, structure=struct)
        return Image.fromarray((dilated * 255).astype(np.uint8))

    def erode(self, mask: Image.Image,
               pixels: int = 10) -> Image.Image:
        """Shrink (erode) a mask"""
        arr = np.array(mask)
        from scipy.ndimage import binary_erosion
        struct = np.ones((pixels * 2 + 1, pixels * 2 + 1))
        eroded = binary_erosion(arr > 127, structure=struct)
        return Image.fromarray((eroded * 255).astype(np.uint8))


# Usage example
gen = MaskGenerator(1024, 1024)

# Rectangular mask (with feathering)
rect_mask = gen.rectangular((200, 300, 800, 700), feather=20)

# Circular mask
circle_mask = gen.circular((512, 512), 200, feather=15)

# Combine multiple masks
combined = gen.combine([rect_mask, circle_mask], mode="union")

# Expand the mask
expanded = gen.dilate(combined, pixels=15)
```

### Code Example 3: Automatic Mask Generation with SAM (Segment Anything)

```python
from segment_anything import SamPredictor, sam_model_registry
from PIL import Image
import numpy as np
import torch


class SAMAutoMasker:
    """
    High-precision automatic mask generation using
    Segment Anything Model

    SAM is a general-purpose vision model that detects
    and segments arbitrary objects.
    """

    def __init__(self, model_type: str = "vit_h",
                  checkpoint: str = "sam_vit_h_4b8939.pth"):
        self.sam = sam_model_registrymodel_type
        self.sam.to("cuda")
        self.predictor = SamPredictor(self.sam)

    def mask_from_point(self, image: Image.Image,
                         point: tuple[int, int],
                         label: int = 1) -> Image.Image:
        """
        Generate a mask from a point selection

        Args:
            image: Input image
            point: (x, y) coordinates
            label: 1=foreground, 0=background
        """
        img_array = np.array(image)
        self.predictor.set_image(img_array)

        input_point = np.array([[point[0], point[1]]])
        input_label = np.array([label])

        masks, scores, logits = self.predictor.predict(
            point_coords=input_point,
            point_labels=input_label,
            multimask_output=True,
        )

        # Select the highest scoring mask
        best_idx = np.argmax(scores)
        best_mask = masks[best_idx]

        return Image.fromarray(
            (best_mask * 255).astype(np.uint8)
        )

    def mask_from_box(self, image: Image.Image,
                       box: tuple[int, int, int, int]) -> Image.Image:
        """
        Generate a mask from a bounding box

        Args:
            image: Input image
            box: (x1, y1, x2, y2)
        """
        img_array = np.array(image)
        self.predictor.set_image(img_array)

        input_box = np.array(box)

        masks, scores, logits = self.predictor.predict(
            box=input_box,
            multimask_output=False,
        )

        return Image.fromarray(
            (masks[0] * 255).astype(np.uint8)
        )

    def mask_from_points_and_boxes(
        self,
        image: Image.Image,
        points: list[tuple[int, int]] = None,
        point_labels: list[int] = None,
        boxes: list[tuple[int, int, int, int]] = None,
    ) -> Image.Image:
        """
        Generate a mask by combining multiple points and boxes
        """
        img_array = np.array(image)
        self.predictor.set_image(img_array)

        kwargs = {"multimask_output": False}

        if points:
            kwargs["point_coords"] = np.array(points)
            kwargs["point_labels"] = np.array(
                point_labels or [1] * len(points)
            )

        if boxes:
            kwargs["box"] = np.array(boxes[0])

        masks, scores, logits = self.predictor.predict(**kwargs)

        return Image.fromarray(
            (masks[0] * 255).astype(np.uint8)
        )


# Usage example
masker = SAMAutoMasker()
image = Image.open("photo.jpg")

# Click the center of the sofa -> auto-generate sofa mask
sofa_mask = masker.mask_from_point(image, (400, 500))

# Specify with bounding box
person_mask = masker.mask_from_box(image, (100, 50, 300, 600))
```

### Code Example 4: Text-Guided Mask with Grounding DINO + SAM

```python
"""
Method to specify "what to mask" with text.
Object detection with Grounding DINO -> Segmentation with SAM.
"""

from groundingdino.util.inference import (
    load_model, load_image, predict
)
from segment_anything import SamPredictor, sam_model_registry
import numpy as np
from PIL import Image
import torch


class TextGuidedMasker:
    """
    Automatically generates masks for target objects from text instructions

    Processing flow:
    1. Detect target objects with Grounding DINO (bounding boxes)
    2. Precise segmentation within bounding boxes using SAM
    3. Return the resulting mask
    """

    def __init__(self):
        # Grounding DINO
        self.dino_model = load_model(
            "groundingdino/config/GroundingDINO_SwinT_OGC.py",
            "weights/groundingdino_swint_ogc.pth",
        )
        # SAM
        sam = sam_model_registry"vit_h"
        sam.to("cuda")
        self.sam_predictor = SamPredictor(sam)

    def create_mask(self, image_path: str,
                     text_prompt: str,
                     box_threshold: float = 0.3,
                     text_threshold: float = 0.25,
                     feather: int = 5) -> dict:
        """
        Generate a mask from text instructions

        Args:
            image_path: Path to the image
            text_prompt: Description of the target object (e.g., "sofa", "person")
            box_threshold: Detection confidence threshold
            text_threshold: Text matching threshold
            feather: Mask boundary blur

        Returns:
            dict: Mask image and detection information
        """
        # Detect with Grounding DINO
        image_source, image = load_image(image_path)
        boxes, logits, phrases = predict(
            model=self.dino_model,
            image=image,
            caption=text_prompt,
            box_threshold=box_threshold,
            text_threshold=text_threshold,
        )

        if len(boxes) == 0:
            return {"mask": None, "error": "No target objects detected"}

        # Precise segmentation with SAM
        pil_image = Image.open(image_path).convert("RGB")
        self.sam_predictor.set_image(np.array(pil_image))

        # Combine all detections into a mask
        h, w = pil_image.size[1], pil_image.size[0]
        combined_mask = np.zeros((h, w), dtype=np.uint8)

        for box in boxes:
            # Convert normalized coordinates to pixel coordinates
            x1, y1, x2, y2 = box.numpy()
            pixel_box = np.array([
                x1 * w, y1 * h, x2 * w, y2 * h
            ])

            masks, scores, _ = self.sam_predictor.predict(
                box=pixel_box,
                multimask_output=False,
            )
            combined_mask = np.maximum(
                combined_mask,
                (masks[0] * 255).astype(np.uint8),
            )

        mask_image = Image.fromarray(combined_mask)

        # Feathering
        if feather > 0:
            from PIL import ImageFilter
            mask_image = mask_image.filter(
                ImageFilter.GaussianBlur(feather)
            )

        return {
            "mask": mask_image,
            "detections": len(boxes),
            "phrases": phrases,
            "confidence": logits.tolist(),
        }


# Usage example
masker = TextGuidedMasker()

# Specify the target with text
result = masker.create_mask(
    "living_room.jpg",
    text_prompt="old sofa",
    box_threshold=0.35,
)

if result["mask"]:
    print(f"Detections: {result['detections']}")
    print(f"Detected objects: {result['phrases']}")
    result["mask"].save("sofa_mask.png")
```

### ASCII Diagram 1: Inpainting Processing Flow

```
Input:
+---------------+    +---------------+    +------------------+
| Original      |    | Mask          |    | Prompt           |
| Image         |    |               |    |                  |
| +-----+       |    | +-----+       |    | "leather sofa"   |
| | old |       |    | |/////| <-white|    |                  |
| |chair|       |    | |/////|       |    |                  |
| +-----+       |    | +-----+       |    |                  |
|   (preserve)  |    |  (edit)       |    |                  |
+---------------+    +---------------+    +------------------+
      |                  |                  |
      v                  v                  v
+------------------------------------------------+
|            Inpainting Model                    |
|                                                |
|  1. Replace masked region with noise           |
|  2. Reference surrounding context              |
|  3. Denoise based on the prompt                |
|  4. Seamlessly blend boundaries                |
+------------------------+-----------------------+
                         |
                         v
+---------------+
| Result Image  |
| +-----+       |
| | new |       |
| |sofa |       |
| +-----+       |
| (naturally    |
|  composited)  |
+---------------+

Mask Processing Details:
+----------------------------------------------+
| Step 1: Mask Preprocessing                   |
|  Original   -> Dilate       -> Feathering    |
|  +--+          +----+          +----+        |
|  |//|          |////|          |.#/#.|       |
|  |//|    ->    |////|    ->    |.#/#.|       |
|  +--+          |////|          |.#/#.|       |
|                +----+          +----+        |
|  Sharp border  Slightly       Smooth border  |
|                expanded                      |
|                                              |
| Step 2: Noise Scheduling                     |
|  t=T:   Full noise (masked area only)        |
|  t=T/2: Structure begins to emerge           |
|  t=0:   Final result                         |
|                                              |
| Step 3: Boundary Blending                    |
|  Linear interpolation between original       |
|  and generated result based on mask          |
|  gray values                                 |
|  result = mask * generated + (1-mask) * orig |
+----------------------------------------------+
```

### 1.2 Advanced Inpainting Techniques

```python
class AdvancedInpainter:
    """
    Advanced inpainting features

    - Simultaneous editing of multiple regions
    - Enhanced context awareness
    - Iterative quality improvement
    """

    def __init__(self, model_id: str = None):
        from diffusers import StableDiffusionXLInpaintPipeline

        self.pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
            model_id or
            "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
            torch_dtype=torch.float16,
        ).to("cuda")
        self.pipe.enable_model_cpu_offload()

    def inpaint_with_context(
        self,
        image: Image.Image,
        mask: Image.Image,
        prompt: str,
        negative_prompt: str = "",
        context_prompt: str = "",
        strength: float = 0.85,
        steps: int = 30,
        cfg_scale: float = 7.5,
    ) -> Image.Image:
        """
        Inpainting with enhanced context awareness

        Args:
            image: Original image
            mask: Mask image
            prompt: Generation prompt
            context_prompt: Context description of the original image
            strength: Edit strength
        """
        # Integrate context into the prompt
        if context_prompt:
            full_prompt = (
                f"{prompt}, "
                f"consistent with {context_prompt}, "
                f"matching ambient lighting and perspective"
            )
        else:
            full_prompt = prompt

        result = self.pipe(
            prompt=full_prompt,
            negative_prompt=(
                negative_prompt or
                "low quality, blurry, inconsistent lighting, "
                "seam visible, color mismatch"
            ),
            image=image,
            mask_image=mask,
            num_inference_steps=steps,
            guidance_scale=cfg_scale,
            strength=strength,
        ).images[0]

        return result

    def iterative_refinement(
        self,
        image: Image.Image,
        mask: Image.Image,
        prompt: str,
        iterations: int = 3,
        strength_schedule: list[float] = None,
    ) -> list[Image.Image]:
        """
        Iteratively improve inpainting quality

        Pass 1: Generate rough structure (high strength)
        Pass 2: Improve details (medium strength)
        Pass 3: Smooth boundaries (low strength)
        """
        if strength_schedule is None:
            strength_schedule = [0.9, 0.6, 0.35]

        results = []
        current = image

        for i, strength in enumerate(strength_schedule[:iterations]):
            print(f"Iteration {i+1}/{iterations}, "
                  f"strength={strength}")

            result = self.pipe(
                prompt=prompt,
                negative_prompt="low quality, blurry, seam",
                image=current,
                mask_image=mask,
                num_inference_steps=30,
                guidance_scale=7.5 - i * 0.5,  # Gradually decrease
                strength=strength,
            ).images[0]

            results.append(result)
            current = result

        return results

    def multi_region_edit(
        self,
        image: Image.Image,
        edits: list[dict],
    ) -> Image.Image:
        """
        Edit multiple regions sequentially

        Args:
            edits: [
                {"mask": mask_img, "prompt": "...", "strength": 0.8},
                {"mask": mask_img2, "prompt": "...", "strength": 0.7},
            ]
        """
        current = image

        for i, edit in enumerate(edits):
            print(f"Editing region {i+1}/{len(edits)}: "
                  f"{edit['prompt'][:50]}...")

            current = self.pipe(
                prompt=edit["prompt"],
                negative_prompt=edit.get(
                    "negative", "low quality, blurry"
                ),
                image=current,
                mask_image=edit["mask"],
                num_inference_steps=edit.get("steps", 30),
                guidance_scale=edit.get("cfg", 7.5),
                strength=edit.get("strength", 0.85),
            ).images[0]

        return current


# Usage example: Multi-region editing
inpainter = AdvancedInpainter()
image = Image.open("room.jpg").resize((1024, 1024))

gen = MaskGenerator(1024, 1024)

# Replace sofa + change wall color
result = inpainter.multi_region_edit(
    image,
    edits=[
        {
            "mask": gen.rectangular((100, 400, 600, 800),
                                     feather=15),
            "prompt": "modern minimalist white sofa, "
                      "interior design, natural lighting",
            "strength": 0.85,
        },
        {
            "mask": gen.rectangular((0, 0, 1024, 300),
                                     feather=20),
            "prompt": "warm beige painted wall, "
                      "matching the interior style",
            "strength": 0.6,
        },
    ],
)
result.save("room_multi_edit.png")
```

---

## 2. Outpainting

### Code Example 5: Outpainting (Extended)

```python
from diffusers import StableDiffusionXLInpaintPipeline
from PIL import Image, ImageDraw, ImageFilter
import torch
import numpy as np
from typing import Literal


class OutpaintingEngine:
    """
    Engine for extending beyond image boundaries

    Features:
    - Extension in all 4 directions
    - Progressive extension for high quality
    - Automatic overlap zone processing
    - Panorama generation
    """

    def __init__(self, model_id: str = None):
        self.pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
            model_id or
            "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
            torch_dtype=torch.float16,
        ).to("cuda")
        self.pipe.enable_model_cpu_offload()

    def extend(
        self,
        image: Image.Image,
        direction: Literal["left", "right", "up", "down"],
        extend_pixels: int = 256,
        overlap: int = 64,
        prompt: str = "seamless continuation of the scene",
        negative_prompt: str = "seam, border, inconsistent",
        steps: int = 30,
        strength: float = 0.85,
    ) -> Image.Image:
        """
        Extend the image in the specified direction

        Args:
            image: Original image
            direction: Extension direction
            extend_pixels: Number of pixels to extend
            overlap: Overlap zone pixels (for seamless boundaries)
            prompt: Generation prompt
        """
        w, h = image.size

        # Direction-specific configuration
        configs = {
            "right": {
                "canvas_size": (w + extend_pixels, h),
                "paste_pos": (0, 0),
                "mask_box": (w - overlap, 0,
                             w + extend_pixels, h),
            },
            "left": {
                "canvas_size": (w + extend_pixels, h),
                "paste_pos": (extend_pixels, 0),
                "mask_box": (0, 0, extend_pixels + overlap, h),
            },
            "down": {
                "canvas_size": (w, h + extend_pixels),
                "paste_pos": (0, 0),
                "mask_box": (0, h - overlap,
                             w, h + extend_pixels),
            },
            "up": {
                "canvas_size": (w, h + extend_pixels),
                "paste_pos": (0, extend_pixels),
                "mask_box": (0, 0, w, extend_pixels + overlap),
            },
        }

        cfg = configs[direction]

        # Create canvas
        canvas = Image.new("RGB", cfg["canvas_size"], (128, 128, 128))
        canvas.paste(image, cfg["paste_pos"])

        # Create mask (with gradient)
        mask = self._create_gradient_mask(
            cfg["canvas_size"], cfg["mask_box"],
            direction, overlap
        )

        # Resize to generation size (SDXL optimal size)
        target_size = (1024, 1024)
        canvas_resized = canvas.resize(target_size)
        mask_resized = mask.resize(target_size)

        # Extend via inpainting
        result = self.pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=canvas_resized,
            mask_image=mask_resized,
            num_inference_steps=steps,
            guidance_scale=7.5,
            strength=strength,
        ).images[0]

        # Restore to original size
        return result.resize(cfg["canvas_size"])

    def _create_gradient_mask(
        self,
        size: tuple[int, int],
        mask_box: tuple[int, int, int, int],
        direction: str,
        overlap: int,
    ) -> Image.Image:
        """Generate a mask with gradient in the overlap zone"""
        w, h = size
        mask = Image.new("L", (w, h), 0)
        draw = ImageDraw.Draw(mask)
        draw.rectangle(mask_box, fill=255)

        # Apply gradient to the overlap zone
        mask_arr = np.array(mask, dtype=float)

        if direction == "right":
            x_start = mask_box[0]
            for x in range(overlap):
                mask_arr[:, x_start + x] = (x / overlap) * 255
        elif direction == "left":
            x_end = mask_box[2]
            for x in range(overlap):
                mask_arr[:, x_end - x] = (x / overlap) * 255
        elif direction == "down":
            y_start = mask_box[1]
            for y in range(overlap):
                mask_arr[y_start + y, :] = (y / overlap) * 255
        elif direction == "up":
            y_end = mask_box[3]
            for y in range(overlap):
                mask_arr[y_end - y, :] = (y / overlap) * 255

        return Image.fromarray(mask_arr.astype(np.uint8))

    def create_panorama(
        self,
        image: Image.Image,
        prompt: str,
        extensions: int = 2,
        extend_pixels: int = 512,
        overlap: int = 96,
    ) -> Image.Image:
        """
        Generate a panorama image (progressively extend left and right)

        Args:
            image: Center reference image
            prompt: Scene description
            extensions: Number of extensions per direction
            extend_pixels: Pixels per extension
            overlap: Overlap zone
        """
        current = image

        # Extend right
        for i in range(extensions):
            print(f"Extending right {i+1}/{extensions}...")
            current = self.extend(
                current, "right",
                extend_pixels=extend_pixels,
                overlap=overlap,
                prompt=f"{prompt}, seamless continuation",
            )

        # Extend left
        for i in range(extensions):
            print(f"Extending left {i+1}/{extensions}...")
            current = self.extend(
                current, "left",
                extend_pixels=extend_pixels,
                overlap=overlap,
                prompt=f"{prompt}, seamless continuation",
            )

        return current


# Usage example
engine = OutpaintingEngine()
image = Image.open("landscape.jpg").resize((1024, 1024))

# Extend right
extended = engine.extend(
    image, "right",
    extend_pixels=512,
    prompt="continuation of mountain landscape, "
           "same lighting and style, autumn foliage",
)

# Panorama generation
panorama = engine.create_panorama(
    image,
    prompt="vast mountain landscape with autumn trees "
           "and clear blue sky",
    extensions=3,
    extend_pixels=512,
)
panorama.save("panorama.png")
```

### ASCII Diagram 2: Outpainting Directions and Overlap Zones

```
Extension directions from original image:

         ^ (up)
    +----------+
    | Newly    |
    | generated|
    +----------+ <- Overlap zone (blend)
    |          |
    | Original | -> (right)  +------+
    | Image    |  +-| Newly  |
 <- |          |  |O| gener- |
    |          |  |L| ated   |
    +----------+  +-+--------+
         v (down)

Gradient processing in overlap zone:
+--------+--------------------+----------+
| Orig.  |   Blend zone       | Newly    |
| Image  |   (gradient)       | generated|
| (kept) |                    | (AI gen) |
| 100%   |   100%  ->  0%     | 0% ->100%|
| orig.  |   Original ratio   | gen.     |
| pixels |   gradually drops  | pixels   |
+--------+--------------------+----------+

Gradient mask cross-section:
Original side                 Newly generated side
255 ########@@@@####....          0
     Protected <-gradient-> Edit

Panorama generation (sequential outpainting):
+----+----+----+----+----+
| <- | <- |Orig| -> | -> |
|ext3|ext2|img |ext1|ext2|
+----+----+----+----+----+
= Panorama image 5x the original width

Each extension step:
  Step 1: [Original][->ext1]
  Step 2: [Original][ext1][->ext2]
  Step 3: [<-ext1][Original][ext1][ext2]
  Step 4: [<-ext2][ext1][Original][ext1][ext2]
```

---

## 3. Img2Img and ControlNet

### Code Example 6: Style Transfer with Img2Img (Extended)

```python
from diffusers import StableDiffusionXLImg2ImgPipeline
from PIL import Image
import torch
from dataclasses import dataclass


@dataclass
class StylePreset:
    """Style transfer preset"""
    name: str
    prompt_template: str
    negative_prompt: str
    strength: float
    guidance_scale: float


STYLE_PRESETS = {
    "oil_impressionist": StylePreset(
        name="Impressionist Oil Painting",
        prompt_template="{subject}, oil painting style, impressionist, "
                        "Claude Monet, visible brushstrokes, "
                        "vibrant colors, natural lighting",
        negative_prompt="photorealistic, sharp, digital, "
                        "smooth, flat colors",
        strength=0.65,
        guidance_scale=7.5,
    ),
    "watercolor": StylePreset(
        name="Watercolor",
        prompt_template="{subject}, watercolor painting, soft edges, "
                        "color bleeding, delicate, paper texture, "
                        "transparent washes",
        negative_prompt="photorealistic, digital, sharp edges, "
                        "heavy colors, oil painting",
        strength=0.60,
        guidance_scale=7.0,
    ),
    "anime": StylePreset(
        name="Anime",
        prompt_template="{subject}, anime style, cel shading, "
                        "vibrant colors, detailed, "
                        "Studio Ghibli quality",
        negative_prompt="realistic, photographic, 3d render, "
                        "low quality, blurry",
        strength=0.70,
        guidance_scale=8.0,
    ),
    "cyberpunk": StylePreset(
        name="Cyberpunk",
        prompt_template="{subject}, cyberpunk style, neon lights, "
                        "futuristic, dark atmosphere, "
                        "rain-soaked streets, holographic elements",
        negative_prompt="natural, daylight, vintage, "
                        "low quality, blurry",
        strength=0.75,
        guidance_scale=8.0,
    ),
    "pixel_art": StylePreset(
        name="Pixel Art",
        prompt_template="{subject}, pixel art, 16-bit style, "
                        "retro game graphics, limited palette, "
                        "crisp pixels",
        negative_prompt="photorealistic, smooth, high resolution, "
                        "anti-aliased, blurry",
        strength=0.80,
        guidance_scale=9.0,
    ),
    "pencil_sketch": StylePreset(
        name="Pencil Sketch",
        prompt_template="{subject}, pencil sketch, graphite drawing, "
                        "detailed hatching, paper texture, "
                        "monochrome, artistic",
        negative_prompt="colorful, photorealistic, digital, "
                        "painting, low quality",
        strength=0.55,
        guidance_scale=7.0,
    ),
}


class StyleTransformer:
    """Style transfer engine"""

    def __init__(self):
        self.pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
        ).to("cuda")
        self.pipe.enable_model_cpu_offload()

    def transform(
        self,
        image: Image.Image,
        style: str,
        subject_description: str = "the scene",
        custom_strength: float = None,
        seed: int = None,
    ) -> Image.Image:
        """
        Transform the image with a preset style

        Args:
            image: Input image
            style: Preset name
            subject_description: Description of the image content
            custom_strength: Custom strength (uses preset value if omitted)
            seed: Random seed
        """
        preset = STYLE_PRESETS.get(style)
        if not preset:
            raise ValueError(
                f"Unknown style: {style}. "
                f"Available: {list(STYLE_PRESETS.keys())}"
            )

        prompt = preset.prompt_template.replace(
            "{subject}", subject_description
        )

        generator = None
        if seed is not None:
            generator = torch.Generator("cuda").manual_seed(seed)

        result = self.pipe(
            prompt=prompt,
            negative_prompt=preset.negative_prompt,
            image=image.resize((1024, 1024)),
            strength=custom_strength or preset.strength,
            num_inference_steps=30,
            guidance_scale=preset.guidance_scale,
            generator=generator,
        ).images[0]

        return result

    def compare_styles(
        self,
        image: Image.Image,
        styles: list[str],
        subject_description: str = "the scene",
        seed: int = 42,
    ) -> dict[str, Image.Image]:
        """Compare multiple styles with the same seed"""
        results = {}
        for style in styles:
            results[style] = self.transform(
                image, style, subject_description, seed=seed,
            )
        return results

    def progressive_transform(
        self,
        image: Image.Image,
        style: str,
        subject_description: str = "the scene",
        strengths: list[float] = None,
    ) -> list[Image.Image]:
        """
        Progressively transform at different strengths to find the optimal value

        Returns:
            List of transformation results for each strength value
        """
        if strengths is None:
            strengths = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]

        results = []
        for s in strengths:
            result = self.transform(
                image, style, subject_description,
                custom_strength=s, seed=42,
            )
            results.append(result)

        return results


# Usage example
transformer = StyleTransformer()
photo = Image.open("photo.jpg")

# Transform to impressionist style
monet = transformer.transform(
    photo, "oil_impressionist",
    subject_description="a garden with flowers and a pond",
)
monet.save("monet_style.png")

# Compare multiple styles
comparisons = transformer.compare_styles(
    photo,
    styles=["oil_impressionist", "watercolor", "anime", "pencil_sketch"],
    subject_description="a garden with flowers",
)
for style_name, result in comparisons.items():
    result.save(f"comparison_{style_name}.png")
```

### Code Example 7: Precise Control with ControlNet (Extended)

```python
from diffusers import (
    StableDiffusionXLControlNetPipeline,
    ControlNetModel,
    AutoencoderKL,
    UniPCMultistepScheduler,
)
from controlnet_aux import (
    CannyDetector,
    OpenposeDetector,
    MidasDetector,
    HEDdetector,
    LineartDetector,
)
from PIL import Image
import torch
import numpy as np


class ControlNetEditor:
    """
    Precise image editing with ControlNet

    Supported control types:
    - Canny Edge: Composition control via edge detection
    - OpenPose: Human pose control
    - Depth: Spatial control via depth information
    - Scribble/HED: Generation from rough sketches
    - Lineart: Colorization from line drawings
    """

    CONTROLNET_MODELS = {
        "canny": "diffusers/controlnet-canny-sdxl-1.0",
        "depth": "diffusers/controlnet-depth-sdxl-1.0",
        "openpose": "thibaud/controlnet-openpose-sdxl-1.0",
    }

    def __init__(self, control_type: str = "canny"):
        self.control_type = control_type

        # Load ControlNet model
        controlnet = ControlNetModel.from_pretrained(
            self.CONTROLNET_MODELS[control_type],
            torch_dtype=torch.float16,
        )

        # Build pipeline
        self.pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            controlnet=controlnet,
            torch_dtype=torch.float16,
        ).to("cuda")

        # Switch to a faster scheduler
        self.pipe.scheduler = UniPCMultistepScheduler.from_config(
            self.pipe.scheduler.config
        )
        self.pipe.enable_model_cpu_offload()

        # Initialize preprocessors
        self.preprocessors = {
            "canny": CannyDetector(),
            "depth": MidasDetector.from_pretrained(
                "lllyasviel/Annotators"
            ),
            "openpose": OpenposeDetector.from_pretrained(
                "lllyasviel/Annotators"
            ),
        }

    def preprocess(self, image: Image.Image,
                    **kwargs) -> Image.Image:
        """Preprocess the control image"""
        preprocessor = self.preprocessors.get(self.control_type)
        if preprocessor is None:
            raise ValueError(
                f"Preprocessor for {self.control_type} not found"
            )

        if self.control_type == "canny":
            return preprocessor(
                image,
                low_threshold=kwargs.get("low_threshold", 100),
                high_threshold=kwargs.get("high_threshold", 200),
            )
        elif self.control_type == "depth":
            return preprocessor(image)
        elif self.control_type == "openpose":
            return preprocessor(image)

        return preprocessor(image)

    def generate(
        self,
        control_image: Image.Image,
        prompt: str,
        negative_prompt: str = "low quality, blurry",
        conditioning_scale: float = 0.8,
        guidance_scale: float = 7.5,
        steps: int = 25,
        seed: int = None,
    ) -> Image.Image:
        """
        Generate an image based on a control image

        Args:
            control_image: Preprocessed control image
            prompt: Generation prompt
            conditioning_scale: Control strength (0.0-2.0)
                0.0: No control (equivalent to txt2img)
                0.5: Loose control
                0.8: Standard control (recommended)
                1.0: Strict control
                1.5+: Excessive control (watch for artifacts)
        """
        generator = None
        if seed is not None:
            generator = torch.Generator("cuda").manual_seed(seed)

        result = self.pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=control_image,
            controlnet_conditioning_scale=conditioning_scale,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
        ).images[0]

        return result

    def edit_with_original(
        self,
        original_image: Image.Image,
        prompt: str,
        conditioning_scale: float = 0.8,
        **kwargs,
    ) -> dict:
        """
        Extract a control image from the original and generate a new image

        Returns:
            dict: {
                "control": Control image,
                "result": Generated result,
            }
        """
        # Extract control image via preprocessing
        control = self.preprocess(original_image, **kwargs)

        # Generate a new image from the control image
        result = self.generate(
            control, prompt,
            conditioning_scale=conditioning_scale,
        )

        return {
            "control": control,
            "result": result,
        }


# Usage example: Restyle a building
editor = ControlNetEditor(control_type="canny")
building = Image.open("building.jpg")

# Extract edges -> generate in a new style
output = editor.edit_with_original(
    building,
    prompt="futuristic glass and steel building, "
           "sci-fi architecture, night city, "
           "neon reflections, cyberpunk",
    conditioning_scale=0.85,
    low_threshold=80,
    high_threshold=180,
)
output["control"].save("building_edges.png")
output["result"].save("building_futuristic.png")

# Pose control
pose_editor = ControlNetEditor(control_type="openpose")
reference = Image.open("pose_reference.jpg")

output = pose_editor.edit_with_original(
    reference,
    prompt="professional ballet dancer in white tutu, "
           "elegant pose, stage lighting, "
           "photorealistic, high quality",
    conditioning_scale=0.9,
)
output["result"].save("ballet_dancer.png")
```

### ASCII Diagram 3: ControlNet Control Types Overview

```
+------- ControlNet Control Types ----------------------+
|                                                       |
|  +-- Edge --------+  +-- Depth -----+  +-- Pose --+  |
|  | Canny Edge     |  | Depth Map    |  | OpenPose |  |
|  | +--+           |  | +--+         |  |  O       |  |
|  | |/\|           |  | |Dk|         |  | /|\      |  |
|  | |\/| Contours  |  | |Lt| Persp.  |  | / \ Skel|  |
|  | +--+           |  | +--+         |  |          |  |
|  | scale: 0.8     |  | scale: 0.7   |  | scale:0.9|  |
|  +----------------+  +--------------+  +----------+  |
|                                                       |
|  +-- Segment -----+  +-- Line Art --+  +-- Normal-+  |
|  | Segmentation   |  | Scribble    |  | Normal   |  |
|  | +--+           |  |  /~~\       |  |  >>>     |  |
|  | |Co| Region    |  | |    | Hand |  |  >>> Surf|  |
|  | |lr| Separ.    |  |  \__/ drawn |  |  >>> Dir |  |
|  | +--+           |  |             |  |          |  |
|  | scale: 0.7     |  | scale: 0.6  |  | scale:0.5|  |
|  +----------------+  +-------------+  +----------+  |
|                                                       |
|  +-- Tile -------+   +-- IP-Adapter ------+          |
|  | Tile          |   | Image-based         |          |
|  | +--+          |   | Transfers style/    |          |
|  | |##| High-res |   | composition from    |          |
|  | |##| control  |   | a reference image   |          |
|  | +--+          |   |                     |          |
|  | scale: 0.5    |   | scale: 0.6-1.0      |          |
|  +---------------+   +---------------------+          |
+-------------------------------------------------------+

Effect of conditioning_scale:
+--------------------------------------------------+
| Scale:  0.0   0.3   0.5   0.8   1.0   1.5   2.0 |
| Effect: None  Weak  Mod.  Std.  Strict Excess Brk|
| Freedom: High <-----------------------------> Low|
| Fidelity: Low <-----------------------------> Hi |
|                                                   |
| Recommended:  |........[===recommended===]......| |
|                       0.5  0.7  0.9               |
+--------------------------------------------------+
```

---

## 4. Instruct-Pix2Pix: Image Editing with Natural Language

### Code Example 8: InstructPix2Pix

```python
from diffusers import StableDiffusionInstructPix2PixPipeline
from PIL import Image
import torch


class TextInstructEditor:
    """
    InstructPix2Pix wrapper for editing images with text instructions

    Features:
    - No mask required (editing possible with text instructions alone)
    - Intuitive natural language instructions
    - Control original image retention via image_guidance_scale
    """

    def __init__(self):
        self.pipe = StableDiffusionInstructPix2PixPipeline.from_pretrained(
            "timbrooks/instruct-pix2pix",
            torch_dtype=torch.float16,
        ).to("cuda")
        self.pipe.enable_model_cpu_offload()

    def edit(
        self,
        image: Image.Image,
        instruction: str,
        image_guidance_scale: float = 1.5,
        guidance_scale: float = 7.5,
        steps: int = 30,
        seed: int = None,
    ) -> Image.Image:
        """
        Edit an image with text instructions

        Args:
            image: Input image
            instruction: Edit instruction
                e.g.: "Make it winter"
                      "Turn the car red"
                      "Add sunglasses"
                      "Make it look like a painting"
            image_guidance_scale: Original image retention
                1.0: Weak reference to original
                1.5: Standard (recommended)
                2.0: Strong retention of original
            guidance_scale: Text instruction adherence
        """
        generator = None
        if seed is not None:
            generator = torch.Generator("cuda").manual_seed(seed)

        result = self.pipe(
            instruction,
            image=image,
            num_inference_steps=steps,
            image_guidance_scale=image_guidance_scale,
            guidance_scale=guidance_scale,
            generator=generator,
        ).images[0]

        return result

    def batch_edit(
        self,
        image: Image.Image,
        instructions: list[str],
        seed: int = 42,
    ) -> list[Image.Image]:
        """Apply multiple instructions to the same image for comparison"""
        return [
            self.edit(image, inst, seed=seed)
            for inst in instructions
        ]

    def chain_edits(
        self,
        image: Image.Image,
        instructions: list[str],
    ) -> list[Image.Image]:
        """
        Apply multiple instructions sequentially (chain editing)

        e.g.: ["Make it sunset", "Add rain", "Make it oil painting"]
        -> Apply sunset -> add rain -> oil painting in sequence
        """
        results = []
        current = image

        for inst in instructions:
            current = self.edit(current, inst)
            results.append(current)

        return results


# Usage example
editor = TextInstructEditor()
image = Image.open("photo.jpg")

# Simple edit instruction
winter = editor.edit(image, "Make it a snowy winter scene")
winter.save("winter_version.png")

# Progressive transformation
stages = editor.chain_edits(
    image,
    [
        "Make it sunset with golden light",
        "Add dramatic clouds in the sky",
        "Make it look like an oil painting",
    ],
)
for i, stage in enumerate(stages):
    stage.save(f"stage_{i+1}.png")
```

### ASCII Diagram 4: InstructPix2Pix Parameter Balance

```
image_guidance_scale vs guidance_scale balance:

                  guidance_scale (text adherence)
                  Low(3)     Mid(7.5)    High(15)
              +----------+----------+----------+
  image_      | No change | Partial  | Major    |
  guidance    | (both     | change   | change   |
  Low(1.0)    |  weak)    |          |          |
              +----------+----------+----------+
  scale       | Subtle   | *Optimal*| Excessive|
  (original   | change   | Balance  | change   |
  retention)  |          |          |          |
  Mid(1.5)    +----------+----------+----------+
              | Almost   | Moderate | Conflict-|
  High(2.0)   | no change| change   | ing result|
              +----------+----------+----------+

Recommended settings:
  Normal editing:       image_guidance=1.5, guidance=7.5
  Fine adjustment:      image_guidance=2.0, guidance=5.0
  Bold transformation:  image_guidance=1.0, guidance=10.0
  Style transfer:       image_guidance=1.2, guidance=8.0
```

---

## 5. Batch Processing and Production Workflows

### Code Example 9: Commercial Batch Editing Pipeline

```python
import json
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from PIL import Image
import torch


@dataclass
class EditJob:
    """Edit job definition"""
    job_id: str
    input_path: str
    output_path: str
    edit_type: str  # "inpaint", "outpaint", "style", "instruct"
    prompt: str
    negative_prompt: str = ""
    mask_path: Optional[str] = None
    strength: float = 0.85
    seed: int = 42
    status: str = "pending"
    error: Optional[str] = None
    processing_time: float = 0.0


class BatchEditPipeline:
    """
    Production-ready batch image editing pipeline

    Features:
    - Job queue management
    - Error handling and retries
    - Progress reporting
    - Result quality checks
    """

    def __init__(self, output_dir: str = "./batch_output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.jobs: list[EditJob] = []
        self.completed: list[EditJob] = []
        self.failed: list[EditJob] = []

    def add_job(self, **kwargs) -> EditJob:
        """Add a job"""
        job = EditJob(**kwargs)
        self.jobs.append(job)
        return job

    def add_bulk_style_transfer(
        self,
        input_dir: str,
        style: str,
        prompt_template: str,
    ):
        """Apply style transfer to all images in a directory"""
        input_path = Path(input_dir)
        for i, img_path in enumerate(
            sorted(input_path.glob("*.{jpg,png,jpeg}"))
        ):
            self.add_job(
                job_id=f"style_{i:04d}",
                input_path=str(img_path),
                output_path=str(
                    self.output_dir / f"{style}_{img_path.name}"
                ),
                edit_type="style",
                prompt=prompt_template,
                strength=0.65,
            )

    def process_all(
        self,
        max_retries: int = 2,
        on_progress: callable = None,
    ) -> dict:
        """Process all jobs"""
        total = len(self.jobs)
        start_time = time.time()

        for i, job in enumerate(self.jobs):
            if on_progress:
                on_progress(i + 1, total, job.job_id)

            success = False
            for attempt in range(max_retries + 1):
                try:
                    self._process_single(job)
                    job.status = "completed"
                    self.completed.append(job)
                    success = True
                    break
                except Exception as e:
                    job.error = str(e)
                    if attempt < max_retries:
                        print(f"  Retry {attempt + 1} for {job.job_id}")
                        torch.cuda.empty_cache()
                    else:
                        job.status = "failed"
                        self.failed.append(job)

        total_time = time.time() - start_time

        report = {
            "total_jobs": total,
            "completed": len(self.completed),
            "failed": len(self.failed),
            "total_time_seconds": total_time,
            "avg_time_per_job": total_time / max(total, 1),
            "failed_jobs": [
                {"id": j.job_id, "error": j.error}
                for j in self.failed
            ],
        }

        # Save report
        report_path = self.output_dir / "batch_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return report

    def _process_single(self, job: EditJob):
        """Process a single job"""
        start = time.time()
        image = Image.open(job.input_path).convert("RGB")

        if job.edit_type == "inpaint" and job.mask_path:
            mask = Image.open(job.mask_path).convert("L")
            result = self._inpaint(image, mask, job)
        elif job.edit_type == "style":
            result = self._style_transfer(image, job)
        elif job.edit_type == "instruct":
            result = self._instruct_edit(image, job)
        else:
            raise ValueError(f"Unknown edit type: {job.edit_type}")

        result.save(job.output_path)
        job.processing_time = time.time() - start

    def _inpaint(self, image, mask, job):
        """Inpainting process"""
        from diffusers import StableDiffusionXLInpaintPipeline
        pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
            "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
            torch_dtype=torch.float16,
        ).to("cuda")
        return pipe(
            prompt=job.prompt,
            negative_prompt=job.negative_prompt,
            image=image.resize((1024, 1024)),
            mask_image=mask.resize((1024, 1024)),
            strength=job.strength,
            num_inference_steps=30,
        ).images[0]

    def _style_transfer(self, image, job):
        """Style transfer process"""
        from diffusers import StableDiffusionXLImg2ImgPipeline
        pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
        ).to("cuda")
        return pipe(
            prompt=job.prompt,
            negative_prompt=job.negative_prompt,
            image=image.resize((1024, 1024)),
            strength=job.strength,
            num_inference_steps=30,
        ).images[0]

    def _instruct_edit(self, image, job):
        """Text instruction edit process"""
        from diffusers import StableDiffusionInstructPix2PixPipeline
        pipe = StableDiffusionInstructPix2PixPipeline.from_pretrained(
            "timbrooks/instruct-pix2pix",
            torch_dtype=torch.float16,
        ).to("cuda")
        return pipe(
            job.prompt,
            image=image,
            num_inference_steps=30,
        ).images[0]


# Usage example
pipeline = BatchEditPipeline("./output/batch_results")

# Register multiple edit jobs
pipeline.add_job(
    job_id="room_sofa",
    input_path="room.jpg",
    output_path="./output/room_new_sofa.png",
    edit_type="inpaint",
    mask_path="sofa_mask.png",
    prompt="modern minimalist white sofa, "
           "matching the room decor",
)

pipeline.add_job(
    job_id="photo_style",
    input_path="landscape.jpg",
    output_path="./output/landscape_watercolor.png",
    edit_type="style",
    prompt="watercolor painting, soft washes, "
           "paper texture, delicate colors",
    strength=0.6,
)

# Execute all jobs
report = pipeline.process_all(
    on_progress=lambda cur, total, jid:
        print(f"[{cur}/{total}] Processing {jid}...")
)
print(f"Completed: {report['completed']}, Failed: {report['failed']}")
```

---

## 6. Comparison Tables

### Comparison Table 1: Image Editing Methods

| Method | Input | Control Precision | Use Case | Computational Cost | Mask Required |
|--------|-------|-------------------|----------|-------------------|---------------|
| **Inpainting** | Image + Mask + Prompt | High | Partial replacement/correction | Medium | Yes |
| **Outpainting** | Image + Direction | Medium | Image extension | Medium | Auto-generated |
| **Img2Img** | Image + Prompt + strength | Medium | Style transfer | Medium | No |
| **ControlNet** | Control image + Prompt | Very high | Composition-controlled generation | High | No |
| **IP-Adapter** | Reference image + Prompt | Medium | Style transfer | Medium | No |
| **Instruct-Pix2Pix** | Image + Edit instruction | Medium | Natural language editing | Medium | No |
| **Grounding DINO + SAM** | Image + Text | High | Automatic mask generation | Medium | - |

### Comparison Table 2: Mask Generation Methods

| Method | Precision | Automation | Tools | Application Scenario |
|--------|-----------|------------|-------|---------------------|
| **Manual Drawing** | Highest | Manual | Photoshop, GIMP, WebUI | Complex shapes |
| **Rectangle/Ellipse** | Low | Automatic | PIL/Pillow | Simple regions |
| **SAM (Segmentation)** | High | Semi-auto | segment-anything | Object-level selection |
| **Color Range Selection** | Medium | Automatic | OpenCV | Solid-color backgrounds |
| **Text-based Selection** | Medium-High | Automatic | Grounding DINO + SAM | Semantic selection |
| **Depth-based** | Medium | Automatic | MiDaS + thresholding | Foreground/background separation |
| **Gradient** | - | Automatic | NumPy/PIL | Outpainting |

### Comparison Table 3: Effect of the strength Parameter

| strength Range | Degree of Change | Use Case | Original Image Retention |
|----------------|-----------------|----------|--------------------------|
| 0.1 - 0.2 | Minimal | Color correction, noise removal | 95%+ |
| 0.2 - 0.3 | Slight | Fine style adjustments | 85-95% |
| 0.3 - 0.5 | Moderate | Style transfer (preserving composition) | 60-85% |
| 0.5 - 0.7 | Significant | Style transfer (major changes) | 30-60% |
| 0.7 - 0.85 | Very significant | Near-complete regeneration | 10-30% |
| 0.85 - 1.0 | Full regeneration | Composition reference only | 0-10% |

### Comparison Table 4: ControlNet Type Application Scenarios

| ControlNet Type | Optimal Scenario | Recommended conditioning_scale | Preprocessing Cost |
|-----------------|-----------------|-------------------------------|-------------------|
| Canny Edge | Architecture, products, structures | 0.7 - 0.9 | Low |
| Depth | Landscapes, interiors, spatial composition | 0.6 - 0.8 | Medium |
| OpenPose | Human poses, dance, sports | 0.8 - 1.0 | Medium |
| Scribble | Generation from rough sketches | 0.5 - 0.7 | Low |
| Lineart | Line art colorization, manga | 0.6 - 0.8 | Medium |
| Tile | Super-resolution, detail enhancement | 0.4 - 0.6 | Low |
| Segmentation | Per-region style control | 0.6 - 0.8 | High |
| Normal Map | 3D surface control | 0.4 - 0.6 | Medium |

---

## 7. Anti-Patterns

### Anti-Pattern 1: Mask Boundaries Are Too Sharp

```
[Problem]
Creating masks with pixel-perfect sharp boundaries,
resulting in an unnatural "pasted-on" look in inpainting results.

[Why It's a Problem]
- Sharp boundaries cause discontinuity in color tone and texture
  between original and generated areas
- Lighting and shadows change abruptly at the boundary
- The human eye is extremely sensitive to discontinuities

[Correct Approach]
- Apply Gaussian blur (10-30px) to the mask for feathering
- Set the edit region slightly larger than the actual target (dilate by 10-20px)
- Adjust boundary blending with the strength parameter
- Further blend boundaries in post-processing
- Utilize MaskGenerator's feather parameter
```

### Anti-Pattern 2: Using Img2Img strength Without Understanding It

```
[Problem]
Setting strength=1.0 in Img2Img and wondering why "the original
image isn't reflected at all." Conversely, setting strength=0.1
and complaining "nothing changed."

[Why It's a Problem]
- strength controls the level of noise addition
- 1.0 = Start from completely random noise (equivalent to txt2img)
- 0.0 = No noise = original image unchanged
- You need to understand the appropriate range for your use case

[Correct Approach]
- Fine-tuning (color correction, etc.): 0.2-0.3
- Style transfer: 0.4-0.6
- Major changes: 0.7-0.8
- Original image as rough reference: 0.85-0.95
- Use progressive_transform() to find the optimal value
```

### Anti-Pattern 3: Inappropriate ControlNet conditioning_scale

```
[Problem]
Setting conditioning_scale to 1.5 or 2.0 and getting
results full of artifacts.

[Why It's a Problem]
- Too high a scale over-amplifies the control signal
- The model overfits to the control image, producing unnatural patterns
- With edge-based control in particular, lines may double up

[Correct Approach]
- Adjust within the 0.5-0.9 range (0.8 is standard)
- Optimal values differ by control type
- Start low and gradually increase
- "Looser" control often leads to more natural results
```

### Anti-Pattern 4: Extending Too Much at Once in Outpainting

```
[Problem]
Trying to extend a 512x512 image to 2048x512 in a single
step, resulting in severely degraded quality.

[Why It's a Problem]
- Large generation areas dilute the context
- Far exceeds the model's training resolution
- Boundary consistency cannot be maintained

[Correct Approach]
- Extend progressively in 256-512px increments
- Ensure sufficient overlap zone (64-96px)
- Lightly unify the whole with Img2Img after each extension
- Use OutpaintingEngine.create_panorama()
```

### Anti-Pattern 5: Vague Instructions for InstructPix2Pix

```
[Problem]
Giving vague edit instructions like "make it better"
or "make it prettier."

[Why It's a Problem]
- The model expects specific changes
- "Better" and "prettier" are subjective and ambiguous
- Results become unstable with unintended changes

[Correct Approach]
- Give specific change instructions: "Make the sky more orange"
- Use verb + target + change: "Turn the car from blue to red"
- Limit each instruction to a single change
- Use chain_edits() for progressive application
```

---

## 8. FAQ

### Q1: What if the inpainted area doesn't match the surrounding colors?

**A:** Address this in the following order:

1. **Expand the mask:** Widen the boundary by 20-50px to include surrounding context
2. **Feathering:** Apply 15-25px Gaussian blur to the mask
3. **Lower the strength:** Set to around 0.7-0.8 to preserve the original color tone
4. **Specify color tone in the prompt:** "matching ambient lighting, same color temperature, consistent shadows"
5. **Two-stage processing:** Rough generation (strength=0.9) -> fine-tuning (strength=0.4)
6. **Context prompt:** Utilize AdvancedInpainter's context_prompt

### Q2: Tips for maintaining consistency in outpainting?

**A:**

- **Use sufficient overlap:** At least 64px, 96px+ recommended
- **Use gradient masks:** OutpaintingEngine's gradient mask
- **Use the same prompt:** Original image description + "seamless continuation"
- **Don't extend too much at once:** Extend progressively in 256-512px increments
- **Fix the seed:** Use the same random seed for consistency
- **Post-processing:** Lightly apply Img2Img (strength=0.2) to the entire extended result for uniformity

### Q3: Which ControlNet type should I choose?

**A:** Choose based on your task:

- **Architecture/Interior:** Canny Edge (contour preservation) + Depth (depth perception)
- **Human pose specification:** OpenPose (skeletal control)
- **Upscaling existing images:** Tile (detail preservation)
- **From hand-drawn sketches:** Scribble (rough line art)
- **Colorizing line art:** Lineart (contour line extraction only)
- **Style transfer:** IP-Adapter (reference image-based)
- **Multiple controls:** Multi-ControlNet allows simultaneous use of multiple types

### Q4: What's the difference between InstructPix2Pix and Img2Img + prompt?

**A:** They serve different purposes:

- **InstructPix2Pix:** Understands "change instructions." Describe the delta like "Make it rainy." No mask required, easy to use. Better at preserving original structure.
- **Img2Img:** Describes the "final state." Describe the result like "A rainy landscape." Controls amount of change via strength. Better suited for larger transformations.
- **Selection criteria:** Use InstructPix2Pix for partial/fine changes, Img2Img for overall style transformation.

### Q5: How should quality management work for commercial use?

**A:** The following workflow is recommended:

1. **Test generation:** Generate with multiple seeds (5+) to verify quality stability
2. **Human review:** Always have a human check after auto-generation
3. **Quality metrics:** Quantitatively evaluate with CLIP Score and SSIM
4. **Batch processing:** Manage jobs with BatchEditPipeline, including error handling
5. **Version control:** Record all inputs, masks, prompts, seeds, and results
6. **A/B testing:** Compare results with different parameters to find optimal settings

### Q6: What to do when GPU memory is insufficient?

**A:** Optimize progressively:

1. **enable_model_cpu_offload():** Offload unused models to CPU
2. **enable_vae_tiling():** VAE tiling processing
3. **torch.float16 (FP16):** Use half-precision floating point
4. **Reduce image size:** 1024x1024 -> 768x768 -> 512x512
5. **Batch size=1:** Process one image at a time
6. **xformers:** Memory-efficient attention implementation
7. **torch.compile():** PyTorch 2.0+ compilation optimization

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory alone, but by actually writing code and verifying the behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## 9. Summary Table

| Item | Key Point |
|------|-----------|
| **Inpainting** | Partial rewriting with mask + prompt. Feathering is essential |
| **Mask Dilation** | Make the mask 10-20px larger than the target |
| **Iterative Refinement** | Improve quality in 3 stages: high -> medium -> low strength |
| **Multiple Regions** | Edit sequentially with multi_region_edit |
| **Outpainting** | Extend image boundaries. Use gradient masks for natural blending |
| **Panorama** | Extend progressively in 256-512px increments |
| **Img2Img** | Control original image retention via strength (0.0-1.0) |
| **Style Presets** | Pre-define optimal strength and cfg per use case |
| **ControlNet** | Precisely control composition via edges/depth/pose, etc. |
| **conditioning_scale** | 0.5-0.9 recommended. Too high causes artifacts |
| **SAM Masks** | Auto-generate with point clicks or bounding boxes |
| **Text-based Masks** | Auto-generate from text with Grounding DINO + SAM |
| **InstructPix2Pix** | Edit images with text instructions only (no mask needed) |
| **Batch Processing** | Job management, error handling, and reporting with BatchEditPipeline |
| **Memory Optimization** | Use cpu_offload, vae_tiling, and fp16 |

---

## Recommended Next Reading

- [02-upscaling.md](./02-upscaling.md) — Upscaling after editing
- [03-design-tools.md](./03-design-tools.md) — Editing features of Canva AI, Adobe Firefly
- [../02-video/01-video-editing.md](../02-video/01-video-editing.md) — Similar editing techniques for video

---

## References

1. Lugmayr, A. et al. (2022). "RePaint: Inpainting using Denoising Diffusion Probabilistic Models." *CVPR 2022*. https://arxiv.org/abs/2201.09865
2. Zhang, L. et al. (2023). "Adding Conditional Control to Text-to-Image Diffusion Models (ControlNet)." *ICCV 2023*. https://arxiv.org/abs/2302.05543
3. Kirillov, A. et al. (2023). "Segment Anything." *ICCV 2023*. https://arxiv.org/abs/2304.02643
4. Brooks, T. et al. (2023). "InstructPix2Pix: Learning to Follow Image Editing Instructions." *CVPR 2023*. https://arxiv.org/abs/2211.09800
5. Liu, S. et al. (2023). "Grounding DINO: Marrying DINO with Grounded Pre-Training for Open-Set Object Detection." *arXiv*. https://arxiv.org/abs/2303.05499
6. Ye, H. et al. (2023). "IP-Adapter: Text Compatible Image Prompt Adapter for Text-to-Image Diffusion Models." *arXiv*. https://arxiv.org/abs/2308.06721
7. Mou, C. et al. (2023). "T2I-Adapter: Learning Adapters to Dig out More Controllable Ability for Text-to-Image Diffusion Models." *AAAI 2024*. https://arxiv.org/abs/2302.08453
