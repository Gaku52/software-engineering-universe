# Practical Guide to AI Game Asset Generation

> This guide explains practical workflows for efficiently generating and utilizing game development assets—textures, 3D models, animations, level designs, and more—using AI.

---

## What You Will Learn in This Chapter

1. **Select the appropriate AI generation method for each asset type**, enabling staged utilization from prototypes to production quality
2. **Build automated generation pipelines for textures, 3D models, and animations** and integrate them with game engines
3. **Address practical challenges in quality control, licensing, and performance optimization** of AI-generated assets


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [AI 3D Model Generation: Technology, Tools & Utilization Guide](./00-3d-generation.md)

---

## 1. Overview of Game Asset Generation

### 1.1 Mapping Asset Types to AI Generation Methods

```
┌─────────────────────────────────────────────────────────┐
│       Game Asset × AI Generation Method Matrix           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Textures ──────> Stable Diffusion / DALL-E             │
│  │  ├ Diffuse Map          (Color & Pattern)            │
│  │  ├ Normal Map           (Bumps)                      │
│  │  ├ Roughness Map        (Surface Roughness)          │
│  │  └ Environment Map/HDRI (Lighting)                   │
│  │                                                      │
│  3D Models ──────> TripoSR / Meshy / Shap-E             │
│  │  ├ Props (Small Items)  (Chairs, Weapons, Items)     │
│  │  ├ Buildings/Structures (Castles, Houses, Bridges)   │
│  │  └ Characters           (Manual Adjustment Required) │
│  │                                                      │
│  Animations ──────> MDM / MotionDiffuse / Mixamo        │
│  │  ├ Walk/Run             (Motion Capture Alternative) │
│  │  ├ Actions              (Attack, Jump)               │
│  │  └ Facial               (Expression Changes)         │
│  │                                                      │
│  Level Design ──────> WaveFunctionCollapse / PCG + LLM  │
│     ├ Terrain Generation   (Height Maps)                │
│     ├ Dungeon Layout       (Room & Corridor Generation) │
│     └ Object Placement     (Auto Decoration)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Quality Levels of AI-Generated Assets

```
Quality Level        Use Case               AI Reliance  Manual Adjustment
──────────────────────────────────────────────────────────
Lv.1 Placeholder     Prototype              100% AI      None
Lv.2 Draft           Internal Review         90% AI      Minor
Lv.3 Game-Ready      Indie Games             60% AI      Moderate
Lv.4 AAA Quality     Commercial Games        30% AI      Extensive
──────────────────────────────────────────────────────────
```

### 1.3 Genre-Specific Asset Requirements Matrix

```
AI-Generated Asset Suitability by Game Genre:

Genre              Textures  3D Models  Anim  Level  Suitability
──────────────────────────────────────────────────────────
Roguelike           ◎         ◎         ○     ◎     Highest
Sandbox             ◎         ○         △     ◎     High
Mobile RPG          ◎         ○         ○     ○     High
Indie 2D            ◎         -         △     ○     Moderate
AAA Open World      ○         △         △     ○     Somewhat Low
Fighting Game       ○         △         ✕     -     Low
──────────────────────────────────────────────────────────

◎ = Usable as-is  ○ = Usable with adjustments  △ = Major adjustments needed
✕ = Not recommended  - = Not applicable
```

### 1.4 Overall Architecture of the AI Generation Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│          AI Game Asset Generation Pipeline v2.0               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Input]                                                     │
│  ├── Game Design Document (GDD)                              │
│  ├── Style Guide / Reference Art                             │
│  ├── Technical Specs (Polygon Budget, Texture Resolution)    │
│  └── Prompt Library                                          │
│       │                                                      │
│       v                                                      │
│  ┌──────────────────────────────────────────┐               │
│  │  Phase 1: AI Generation (Batch Process)   │               │
│  │  ├── Textures: SD/DALL-E → PBR Set        │               │
│  │  ├── 3D Models: Meshy/TripoSR → GLB       │               │
│  │  ├── Animation: MDM/Mixamo → BVH/FBX      │               │
│  │  └── Level: WFC/PCG → Map Data             │               │
│  └──────────────┬───────────────────────────┘               │
│                  │                                           │
│                  v                                           │
│  ┌──────────────────────────────────────────┐               │
│  │  Phase 2: Automated Quality Check         │               │
│  │  ├── Polygon Count Check                  │               │
│  │  ├── Texture Size Validation              │               │
│  │  ├── UV Overlap Check                     │               │
│  │  ├── Material Count Validation            │               │
│  │  └── Style Consistency Score (CLIP sim.)  │               │
│  └──────────────┬───────────────────────────┘               │
│                  │                                           │
│                  v                                           │
│  ┌──────────────────────────────────────────┐               │
│  │  Phase 3: Post-Processing & Optimization  │               │
│  │  ├── Auto Retopology (Instant Meshes)     │               │
│  │  ├── LOD Auto Generation                  │               │
│  │  ├── Texture Atlas Packing                │               │
│  │  ├── Collision Mesh Generation            │               │
│  │  └── Metadata Assignment (Tags, Category) │               │
│  └──────────────┬───────────────────────────┘               │
│                  │                                           │
│                  v                                           │
│  [Output] → Game Engine-Compatible Asset Bundle              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Texture Generation

### 2.1 Automated PBR Texture Set Generation

```python
# PBR texture set generation using AI + image processing
from diffusers import StableDiffusionPipeline
import torch
import numpy as np
from PIL import Image, ImageFilter
import cv2

class PBRTextureGenerator:
    """Generate PBR (Physically Based Rendering) texture sets"""

    def __init__(self, model_id: str = "stabilityai/stable-diffusion-xl-base-1.0"):
        self.pipe = StableDiffusionPipeline.from_pretrained(
            model_id, torch_dtype=torch.float16
        )
        self.pipe = self.pipe.to("cuda")

    def generate_diffuse(
        self,
        prompt: str,
        size: int = 1024,
        seamless: bool = True,
    ) -> Image.Image:
        """Generate a diffuse (albedo) map"""
        full_prompt = (
            f"seamless tileable texture of {prompt}, "
            f"top-down view, flat lighting, no shadows, "
            f"high resolution PBR texture"
        )
        image = self.pipe(
            full_prompt,
            width=size,
            height=size,
            num_inference_steps=30,
            guidance_scale=7.5,
        ).images[0]

        if seamless:
            image = self._make_seamless(image)
        return image

    def generate_normal_map(self, diffuse: Image.Image) -> Image.Image:
        """Estimate a normal map from the diffuse map"""
        gray = np.array(diffuse.convert("L"), dtype=np.float32) / 255.0

        # Compute gradients using Sobel filters
        grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)

        # Construct normal vectors
        normal = np.zeros((*gray.shape, 3), dtype=np.float32)
        normal[:, :, 0] = -grad_x  # X component
        normal[:, :, 1] = -grad_y  # Y component
        normal[:, :, 2] = 1.0      # Z component

        # Normalize
        norm = np.linalg.norm(normal, axis=2, keepdims=True)
        normal = normal / (norm + 1e-8)

        # [-1,1] → [0,255]
        normal_map = ((normal + 1.0) * 0.5 * 255).astype(np.uint8)
        return Image.fromarray(normal_map)

    def generate_roughness_map(self, diffuse: Image.Image) -> Image.Image:
        """Estimate a roughness map from the diffuse map"""
        gray = diffuse.convert("L")
        # More high-frequency content = rougher surface
        blurred = gray.filter(ImageFilter.GaussianBlur(radius=5))
        diff = np.abs(
            np.array(gray, dtype=np.float32)
            - np.array(blurred, dtype=np.float32)
        )
        # Normalize into a roughness map
        roughness = (diff / diff.max() * 200 + 55).clip(0, 255)
        return Image.fromarray(roughness.astype(np.uint8))

    def generate_ao_map(self, diffuse: Image.Image) -> Image.Image:
        """Estimate an ambient occlusion map from the diffuse map"""
        gray = np.array(diffuse.convert("L"), dtype=np.float32)
        # Pseudo-AO using multi-scale blur
        ao = np.ones_like(gray)
        for radius in [3, 7, 15, 31]:
            blurred = cv2.GaussianBlur(gray, (0, 0), radius)
            local_ao = gray / (blurred + 1e-8)
            local_ao = np.clip(local_ao, 0.5, 1.5)
            ao *= local_ao
        ao = np.clip(ao * 128 + 64, 0, 255)
        return Image.fromarray(ao.astype(np.uint8))

    def generate_height_map(self, diffuse: Image.Image) -> Image.Image:
        """Estimate a height map from the diffuse map"""
        gray = np.array(diffuse.convert("L"), dtype=np.float32)
        # Estimate bumps using edge detection
        edges = cv2.Canny(gray.astype(np.uint8), 50, 150)
        # Smooth with Gaussian blur
        height = cv2.GaussianBlur(gray, (0, 0), 3)
        # Emphasize areas around edges
        height = height - edges.astype(np.float32) * 0.3
        height = np.clip(height, 0, 255)
        return Image.fromarray(height.astype(np.uint8))

    def generate_full_set(
        self, prompt: str, output_dir: str, size: int = 1024
    ) -> dict[str, str]:
        """Generate a complete PBR texture set"""
        from pathlib import Path
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        diffuse = self.generate_diffuse(prompt, size)
        normal = self.generate_normal_map(diffuse)
        roughness = self.generate_roughness_map(diffuse)
        ao = self.generate_ao_map(diffuse)
        height = self.generate_height_map(diffuse)

        paths = {}
        for name, img in [
            ("diffuse", diffuse),
            ("normal", normal),
            ("roughness", roughness),
            ("ao", ao),
            ("height", height),
        ]:
            path = f"{output_dir}/{name}.png"
            img.save(path)
            paths[name] = path

        return paths

    def _make_seamless(self, image: Image.Image) -> Image.Image:
        """Convert to a seamless tileable texture"""
        arr = np.array(image, dtype=np.float32)
        h, w = arr.shape[:2]
        blend_size = w // 4

        # Left-right blending
        for i in range(blend_size):
            alpha = i / blend_size
            arr[:, i] = arr[:, i] * alpha + arr[:, w - blend_size + i] * (1 - alpha)

        # Top-bottom blending
        for i in range(blend_size):
            alpha = i / blend_size
            arr[i, :] = arr[i, :] * alpha + arr[h - blend_size + i, :] * (1 - alpha)

        return Image.fromarray(arr.astype(np.uint8))
```

### 2.2 Texture Variation Generation Pipeline

```python
class TextureVariationPipeline:
    """Batch-generate texture variations in a unified style"""

    def __init__(self, generator: PBRTextureGenerator):
        self.generator = generator

    def generate_material_family(
        self,
        base_material: str,
        variations: list[str],
        output_dir: str,
        style_reference: str = "",
    ) -> dict[str, dict[str, str]]:
        """Generate variations of the same material family

        Example:
            base_material = "stone wall"
            variations = ["mossy", "cracked", "weathered", "clean"]
        """
        results = {}
        style_suffix = f", {style_reference}" if style_reference else ""

        for variation in variations:
            prompt = f"{variation} {base_material}{style_suffix}"
            var_dir = f"{output_dir}/{variation.replace(' ', '_')}"
            paths = self.generator.generate_full_set(prompt, var_dir)
            results[variation] = paths

        return results

    def generate_tileset(
        self,
        theme: str,
        tile_types: list[str],
        output_dir: str,
        size: int = 512,
    ) -> dict[str, str]:
        """Generate a tileset (floor, wall, ceiling, etc.) in a unified style

        Example:
            theme = "medieval dungeon"
            tile_types = ["floor_stone", "wall_brick",
                         "ceiling_wooden", "pillar_marble"]
        """
        results = {}
        style_prompt = (
            f"{theme} style, consistent art direction, "
            f"game texture, seamless tileable"
        )

        for tile_type in tile_types:
            readable = tile_type.replace("_", " ")
            prompt = f"{readable}, {style_prompt}"
            tile_dir = f"{output_dir}/{tile_type}"
            paths = self.generator.generate_full_set(prompt, tile_dir, size)
            results[tile_type] = paths

        return results

    def generate_damage_progression(
        self,
        material: str,
        damage_levels: int = 4,
        output_dir: str = "./damage_progression",
    ) -> list[dict[str, str]]:
        """Generate damage progression textures (visual changes based on durability)"""
        results = []
        damage_descriptions = [
            "pristine clean undamaged",
            "slightly worn scratched",
            "moderately damaged cracked chipped",
            "heavily damaged broken destroyed",
        ]

        for level in range(min(damage_levels, len(damage_descriptions))):
            desc = damage_descriptions[level]
            prompt = f"{desc} {material}, game texture"
            level_dir = f"{output_dir}/damage_{level}"
            paths = self.generator.generate_full_set(prompt, level_dir)
            results.append(paths)

        return results
```

### 2.3 HDRI Environment Map Generation

```python
class HDRIGenerator:
    """HDRI environment map generation for games"""

    def __init__(self, pipe):
        self.pipe = pipe

    def generate_panoramic_hdri(
        self,
        environment: str,
        time_of_day: str = "noon",
        weather: str = "clear",
        width: int = 2048,
        height: int = 1024,
    ) -> Image.Image:
        """Generate a panoramic HDRI environment map

        Args:
            environment: Description of the environment ("forest", "city", "desert", etc.)
            time_of_day: Time of day ("dawn", "noon", "sunset", "night")
            weather: Weather condition ("clear", "cloudy", "overcast", "stormy")
        """
        prompt = (
            f"360 degree equirectangular panorama HDRI, "
            f"{environment}, {time_of_day}, {weather} sky, "
            f"seamless panoramic environment map, "
            f"high dynamic range, realistic lighting"
        )
        image = self.pipe(
            prompt,
            width=width,
            height=height,
            num_inference_steps=30,
            guidance_scale=7.0,
        ).images[0]

        return image

    def generate_skybox_faces(
        self,
        environment: str,
        face_size: int = 1024,
    ) -> dict[str, Image.Image]:
        """Generate 6-face skybox textures"""
        faces = {}
        directions = {
            "front": "facing forward",
            "back": "facing backward",
            "left": "facing left",
            "right": "facing right",
            "top": "looking straight up at sky",
            "bottom": "looking straight down at ground",
        }
        for face_name, direction in directions.items():
            prompt = (
                f"skybox texture, {environment}, {direction}, "
                f"seamless edges, game environment"
            )
            faces[face_name] = self.pipe(
                prompt,
                width=face_size,
                height=face_size,
                num_inference_steps=25,
            ).images[0]

        return faces
```

---

## 3. 3D Model Generation and Game Engine Integration

### 3.1 3D Generation Pipeline for Game Assets

```
Text/Image Prompt
        │
        v
┌──────────────────┐
│  AI 3D Generation │  Meshy API / TripoSR
│  (High-Poly)      │  100K-500K Polygons
└──────────────────┘
        │
        v
┌──────────────────┐
│  Auto Retopology  │  Instant Meshes / Blender
│  (Low-Poly)       │  1K-50K Polygons
└──────────────────┘
        │
        v
┌──────────────────┐
│  UV Unwrap        │  xatlas / Blender
│  + Texture Bake   │  Normal/AO/Diffuse
└──────────────────┘
        │
        v
┌──────────────────┐
│  LOD Generation   │  Level of Detail
│  LOD0: 10K faces  │  Close Range
│  LOD1: 2K faces   │  Mid Range
│  LOD2: 500 faces  │  Far Range
└──────────────────┘
        │
        v
┌──────────────────┐
│  Export           │  glTF 2.0 / FBX
│  + Metadata       │  Collision / Tags
└──────────────────┘
```

### 3.2 Commercial-Quality Asset Generation Using Meshy API

```python
# Meshy API: Generate commercial-quality 3D assets from text
import requests
import time
from pathlib import Path

class MeshyAssetGenerator:
    """Game asset generation using Meshy API"""

    BASE_URL = "https://api.meshy.ai/v2"

    def __init__(self, api_key: str):
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def text_to_3d(
        self,
        prompt: str,
        negative_prompt: str = "",
        art_style: str = "game-asset",
        topology: str = "quad",
        target_polycount: int = 30000,
    ) -> str:
        """Generate a 3D model from text (returns task ID)"""
        payload = {
            "mode": "preview",  # Two-stage: preview → refine
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "art_style": art_style,
            "topology": topology,
            "target_polycount": target_polycount,
        }
        resp = requests.post(
            f"{self.BASE_URL}/text-to-3d",
            headers=self.headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["result"]

    def image_to_3d(
        self,
        image_url: str,
        target_polycount: int = 30000,
    ) -> str:
        """Generate a 3D model from a reference image"""
        payload = {
            "image_url": image_url,
            "target_polycount": target_polycount,
            "enable_pbr": True,
        }
        resp = requests.post(
            f"{self.BASE_URL}/image-to-3d",
            headers=self.headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["result"]

    def refine_model(self, preview_task_id: str) -> str:
        """Refine a preview model to higher quality"""
        payload = {
            "mode": "refine",
            "preview_task_id": preview_task_id,
        }
        resp = requests.post(
            f"{self.BASE_URL}/text-to-3d",
            headers=self.headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["result"]

    def wait_and_download(
        self, task_id: str, output_dir: str, poll_interval: int = 10
    ) -> dict[str, str]:
        """Wait for task completion and download results"""
        while True:
            resp = requests.get(
                f"{self.BASE_URL}/text-to-3d/{task_id}",
                headers=self.headers,
            )
            data = resp.json()

            if data["status"] == "SUCCEEDED":
                break
            elif data["status"] == "FAILED":
                raise RuntimeError(f"Generation failed: {data.get('error')}")

            print(f"Progress: {data.get('progress', 0)}%")
            time.sleep(poll_interval)

        # Download
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        paths = {}
        for fmt in ["glb", "fbx", "obj"]:
            url = data.get(f"model_urls", {}).get(fmt)
            if url:
                path = f"{output_dir}/{task_id}.{fmt}"
                content = requests.get(url).content
                with open(path, "wb") as f:
                    f.write(content)
                paths[fmt] = path

        # Download textures
        for tex in data.get("texture_urls", []):
            tex_path = f"{output_dir}/{tex['name']}"
            content = requests.get(tex["url"]).content
            with open(tex_path, "wb") as f:
                f.write(content)
            paths[tex["name"]] = tex_path

        return paths

# Usage example
generator = MeshyAssetGenerator(api_key="your-api-key")
task_id = generator.text_to_3d(
    prompt="medieval wooden barrel, game prop, low poly style",
    art_style="game-asset",
    target_polycount=5000,
)
assets = generator.wait_and_download(task_id, "./assets/barrel")
```

### 3.3 Batch Generation and Asset Catalog Management

```python
import json
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path

@dataclass
class AssetMetadata:
    """Metadata for AI-generated assets"""
    asset_id: str
    name: str
    category: str              # "prop", "character", "environment", "weapon"
    subcategory: str           # "furniture", "nature", "architecture"
    prompt: str
    model_used: str            # "meshy", "triposr", "shap-e"
    poly_count: int = 0
    texture_resolution: int = 0
    lod_levels: int = 0
    file_formats: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    style: str = ""            # "realistic", "stylized", "low-poly"
    license: str = ""
    created_at: str = ""
    quality_score: float = 0.0
    status: str = "generated"  # "generated", "reviewed", "approved", "rejected"

class AssetCatalog:
    """Catalog management for AI-generated assets"""

    def __init__(self, catalog_path: str = "./asset_catalog.json"):
        self.catalog_path = catalog_path
        self.assets: dict[str, AssetMetadata] = {}
        self._load()

    def _load(self):
        if Path(self.catalog_path).exists():
            with open(self.catalog_path) as f:
                data = json.load(f)
                for asset_id, meta in data.items():
                    self.assets[asset_id] = AssetMetadata(**meta)

    def save(self):
        with open(self.catalog_path, "w") as f:
            json.dump(
                {k: asdict(v) for k, v in self.assets.items()},
                f, indent=2, ensure_ascii=False,
            )

    def register(self, metadata: AssetMetadata) -> str:
        """Register an asset in the catalog"""
        if not metadata.asset_id:
            metadata.asset_id = hashlib.md5(
                f"{metadata.prompt}{datetime.now().isoformat()}".encode()
            ).hexdigest()[:12]
        if not metadata.created_at:
            metadata.created_at = datetime.now().isoformat()
        self.assets[metadata.asset_id] = metadata
        self.save()
        return metadata.asset_id

    def search(
        self,
        category: str = "",
        tags: list[str] = None,
        style: str = "",
        min_quality: float = 0.0,
    ) -> list[AssetMetadata]:
        """Search assets in the catalog"""
        results = []
        for asset in self.assets.values():
            if category and asset.category != category:
                continue
            if tags and not all(t in asset.tags for t in tags):
                continue
            if style and asset.style != style:
                continue
            if asset.quality_score < min_quality:
                continue
            results.append(asset)
        return results

    def batch_generate(
        self,
        generator: MeshyAssetGenerator,
        asset_list: list[dict],
        output_base: str = "./assets",
    ) -> list[str]:
        """Batch-generate assets from a list"""
        generated_ids = []
        for spec in asset_list:
            try:
                task_id = generator.text_to_3d(
                    prompt=spec["prompt"],
                    art_style=spec.get("art_style", "game-asset"),
                    target_polycount=spec.get("polycount", 10000),
                )
                output_dir = f"{output_base}/{spec['name']}"
                paths = generator.wait_and_download(task_id, output_dir)

                metadata = AssetMetadata(
                    asset_id="",
                    name=spec["name"],
                    category=spec.get("category", "prop"),
                    subcategory=spec.get("subcategory", ""),
                    prompt=spec["prompt"],
                    model_used="meshy",
                    file_formats=list(paths.keys()),
                    tags=spec.get("tags", []),
                    style=spec.get("style", "game-asset"),
                )
                asset_id = self.register(metadata)
                generated_ids.append(asset_id)
                print(f"Generation complete: {spec['name']} ({asset_id})")

            except Exception as e:
                print(f"Generation failed: {spec['name']}: {e}")

        return generated_ids

# Usage example: Batch generation
catalog = AssetCatalog()
asset_specs = [
    {
        "name": "wooden_barrel",
        "prompt": "medieval wooden barrel, game prop, low poly",
        "category": "prop",
        "subcategory": "container",
        "tags": ["medieval", "wood", "container"],
        "polycount": 5000,
    },
    {
        "name": "iron_sword",
        "prompt": "iron longsword, fantasy weapon, game asset",
        "category": "weapon",
        "subcategory": "melee",
        "tags": ["fantasy", "metal", "sword"],
        "polycount": 8000,
    },
    {
        "name": "stone_well",
        "prompt": "stone water well, medieval village prop",
        "category": "prop",
        "subcategory": "architecture",
        "tags": ["medieval", "stone", "water"],
        "polycount": 12000,
    },
]
```

### 3.4 Unity Asset Importer

```csharp
// Unity: Automatic import and configuration of AI-generated assets
using UnityEngine;
using UnityEditor;
using System.IO;

public class AIAssetImporter : AssetPostprocessor
{
    // Automatic configuration for AI-generated assets
    void OnPreprocessModel()
    {
        // Determine if the asset is in the AI-generated folder
        if (!assetPath.Contains("AI_Generated")) return;

        ModelImporter importer = assetImporter as ModelImporter;

        // Mesh optimization settings
        importer.optimizeMeshPolygons = true;
        importer.optimizeMeshVertices = true;
        importer.meshCompression = ModelImporterMeshCompression.Medium;

        // Collision generation
        importer.addCollider = true;

        // LOD automatic configuration
        importer.importNormals = ModelImporterNormals.Calculate;
        importer.normalCalculationMode =
            ModelImporterNormalCalculationMode.AreaAndAngleWeighted;

        // Scale adjustment (AI-generated models have inconsistent scales)
        importer.globalScale = 1.0f;
        importer.useFileScale = false;
    }

    void OnPreprocessTexture()
    {
        if (!assetPath.Contains("AI_Generated")) return;

        TextureImporter importer = assetImporter as TextureImporter;

        // Automatic texture type detection
        string fileName = Path.GetFileNameWithoutExtension(assetPath).ToLower();

        if (fileName.Contains("normal"))
        {
            importer.textureType = TextureImporterType.NormalMap;
        }
        else if (fileName.Contains("roughness") || fileName.Contains("metallic"))
        {
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = false; // Linear space
        }
        else if (fileName.Contains("ao") || fileName.Contains("occlusion"))
        {
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = false;
        }
        else if (fileName.Contains("height") || fileName.Contains("displacement"))
        {
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = false;
        }

        // Compression settings
        importer.textureCompression = TextureImporterCompression.CompressedHQ;
        importer.maxTextureSize = 2048;
    }
}
```

### 3.5 Unreal Engine Asset Importer

```python
# Unreal Engine: Automatic import of AI-generated assets via Python Editor Scripting
import unreal

class AIAssetImporterUE:
    """Unreal Engine AI-generated asset importer"""

    def __init__(self, asset_base_path="/Game/AI_Generated"):
        self.asset_base_path = asset_base_path
        self.asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

    def import_fbx_with_settings(
        self,
        source_path: str,
        destination_path: str,
        asset_name: str,
    ):
        """Import an FBX file with AI-generated asset-optimized settings"""
        task = unreal.AssetImportTask()
        task.set_editor_property("automated", True)
        task.set_editor_property("filename", source_path)
        task.set_editor_property("destination_path", destination_path)
        task.set_editor_property("destination_name", asset_name)
        task.set_editor_property("replace_existing", True)
        task.set_editor_property("save", True)

        # FBX import settings
        options = unreal.FbxImportUI()
        options.set_editor_property("import_mesh", True)
        options.set_editor_property("import_textures", True)
        options.set_editor_property("import_materials", True)
        options.set_editor_property("import_as_skeletal", False)

        # Static mesh settings
        options.static_mesh_import_data.set_editor_property(
            "combine_meshes", True
        )
        options.static_mesh_import_data.set_editor_property(
            "generate_lightmap_u_vs", True
        )
        options.static_mesh_import_data.set_editor_property(
            "auto_generate_collision", True
        )

        task.set_editor_property("options", options)
        self.asset_tools.import_asset_tasks([task])

        return task.get_editor_property("imported_object_paths")

    def auto_setup_lod(
        self,
        static_mesh_path: str,
        lod_count: int = 3,
    ):
        """Automatic LOD setup"""
        mesh = unreal.EditorAssetLibrary.load_asset(static_mesh_path)
        if not mesh:
            return

        # LOD group settings
        reduction_settings = []
        for i in range(1, lod_count):
            settings = unreal.MeshReductionSettings()
            # Polygon reduction ratio based on LOD level
            percent = max(0.1, 1.0 - (i * 0.3))
            settings.set_editor_property("percent_triangles", percent)
            reduction_settings.append(settings)

        unreal.EditorStaticMeshLibrary.set_lod_count(mesh, lod_count)

    def batch_import_directory(
        self,
        source_directory: str,
        destination_path: str = None,
    ):
        """Batch-import all FBX/GLB files in a directory"""
        import os
        if destination_path is None:
            destination_path = self.asset_base_path

        supported_extensions = [".fbx", ".glb", ".gltf", ".obj"]
        imported = []

        for root, dirs, files in os.walk(source_directory):
            for filename in files:
                ext = os.path.splitext(filename)[1].lower()
                if ext in supported_extensions:
                    source = os.path.join(root, filename)
                    name = os.path.splitext(filename)[0]
                    result = self.import_fbx_with_settings(
                        source, destination_path, name
                    )
                    imported.extend(result)

        return imported
```

---

## 4. AI Animation Generation

### 4.1 Comparison of Motion Generation Methods

| Method | Input | Quality | Speed | Use Case |
|--------|-------|---------|-------|----------|
| Mixamo | Rigged Model | High | Instant | General Humanoid Motion |
| MDM | Text | Medium-High | Seconds | Text-Described Motion |
| MotionDiffuse | Text | Medium-High | Seconds | Text-Described Motion |
| Motion Matching | Database | High | Real-time | In-Game Transitions |
| RAG+LLM | Text+DB | High | Seconds | Custom Motion |
| MotionGPT | Text | High | Seconds | Natural Language to Motion |
| MoMask | Text/Mask | Medium-High | Seconds | Partial Motion Editing |

### 4.2 Text-to-Motion Generation

```python
# Text-to-motion generation using Motion Diffusion Model (MDM)
import torch
from motion_diffusion_model import MDM, HumanML3DDataset

def generate_motion_from_text(
    prompt: str,
    duration: float = 3.0,
    num_samples: int = 1,
    model_path: str = "pretrained/mdm_humanml.pth",
) -> dict:
    """Generate motion from a text prompt"""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load model
    model = MDM.load_pretrained(model_path).to(device)
    model.eval()

    # Calculate frame count (assuming 30fps)
    n_frames = int(duration * 30)

    with torch.no_grad():
        motions = model.generate(
            texts=[prompt] * num_samples,
            lengths=[n_frames] * num_samples,
            guidance_scale=2.5,
        )

    # Return joint position data
    return {
        "joints": motions.cpu().numpy(),  # (samples, frames, joints, 3)
        "fps": 30,
        "duration": duration,
        "prompt": prompt,
    }

def export_to_bvh(motion_data: dict, output_path: str):
    """Export motion data to BVH format"""
    from motion_utils import joints_to_bvh

    joints = motion_data["joints"][0]  # First sample
    bvh_data = joints_to_bvh(
        joints,
        fps=motion_data["fps"],
        skeleton="humanml3d",
    )

    with open(output_path, "w") as f:
        f.write(bvh_data)

# Usage example
motion = generate_motion_from_text(
    prompt="a person swings a sword overhead then steps forward",
    duration=2.5,
)
export_to_bvh(motion, "sword_attack.bvh")
```

### 4.3 Motion Blending and Transition Generation

```python
class MotionBlender:
    """Generate smooth transitions between AI-generated motions"""

    def __init__(self, model):
        self.model = model

    def blend_motions(
        self,
        motion_a: dict,
        motion_b: dict,
        blend_frames: int = 15,
        method: str = "slerp",
    ) -> dict:
        """Blend and connect two motions

        Args:
            motion_a: Previous motion
            motion_b: Next motion
            blend_frames: Number of frames used for blending
            method: "slerp" (spherical linear interpolation) or "lerp" (linear interpolation)
        """
        import numpy as np
        from scipy.spatial.transform import Rotation, Slerp

        joints_a = motion_a["joints"][0]  # (frames, joints, 3)
        joints_b = motion_b["joints"][0]

        # Blend the last blend_frames of A with the first blend_frames of B
        end_a = joints_a[-blend_frames:]
        start_b = joints_b[:blend_frames]

        blended = np.zeros_like(end_a)
        for i in range(blend_frames):
            t = i / (blend_frames - 1)  # 0.0 ~ 1.0
            if method == "slerp":
                # Spherical linear interpolation (suitable for rotations)
                t = self._ease_in_out(t)
            blended[i] = end_a[i] * (1 - t) + start_b[i] * t

        # Concatenate
        result = np.concatenate([
            joints_a[:-blend_frames],
            blended,
            joints_b[blend_frames:],
        ], axis=0)

        return {
            "joints": result[np.newaxis],
            "fps": motion_a["fps"],
            "duration": len(result) / motion_a["fps"],
            "prompt": f"{motion_a['prompt']} -> {motion_b['prompt']}",
        }

    def _ease_in_out(self, t: float) -> float:
        """Ease-in-out interpolation curve"""
        return t * t * (3 - 2 * t)

    def create_animation_state_machine(
        self,
        states: dict[str, dict],
        transitions: list[tuple[str, str]],
        blend_frames: int = 10,
    ) -> dict:
        """Generate transition data for an animation state machine

        Args:
            states: {"idle": motion_data, "walk": motion_data, ...}
            transitions: [("idle", "walk"), ("walk", "run"), ...]
        """
        transition_clips = {}
        for state_a, state_b in transitions:
            if state_a in states and state_b in states:
                key = f"{state_a}_to_{state_b}"
                transition_clips[key] = self.blend_motions(
                    states[state_a],
                    states[state_b],
                    blend_frames=blend_frames,
                )

        return {
            "states": states,
            "transitions": transition_clips,
        }
```

---

## 5. Procedural Level Generation

### 5.1 Combining Wave Function Collapse with AI

```python
# Intelligent level generation using WFC + LLM
import numpy as np
from dataclasses import dataclass
from typing import Optional

@dataclass
class Tile:
    """Tile data"""
    id: str
    asset_path: str
    connections: dict  # Direction -> Connection type
    weight: float = 1.0
    tags: list[str] = None

class WFCLevelGenerator:
    """Level generation based on Wave Function Collapse"""

    def __init__(self, width: int, height: int, tiles: list[Tile]):
        self.width = width
        self.height = height
        self.tiles = tiles
        # Set of possible tiles for each cell
        self.grid = [
            [set(range(len(tiles))) for _ in range(width)]
            for _ in range(height)
        ]

    def collapse(self) -> np.ndarray:
        """Resolve the grid using WFC algorithm"""
        while not self._is_fully_collapsed():
            # Select the cell with lowest entropy
            y, x = self._find_min_entropy_cell()
            if y is None:
                raise RuntimeError("Contradiction occurred: backtracking required")

            # Collapse to a single tile via weighted random selection
            possible = list(self.grid[y][x])
            weights = [self.tiles[t].weight for t in possible]
            total = sum(weights)
            probs = [w / total for w in weights]
            chosen = np.random.choice(possible, p=probs)
            self.grid[y][x] = {chosen}

            # Constraint propagation
            self._propagate(x, y)

        # Convert result to grid
        result = np.zeros((self.height, self.width), dtype=int)
        for y in range(self.height):
            for x in range(self.width):
                result[y][x] = list(self.grid[y][x])[0]
        return result

    def _is_fully_collapsed(self) -> bool:
        return all(
            len(self.grid[y][x]) == 1
            for y in range(self.height)
            for x in range(self.width)
        )

    def _find_min_entropy_cell(self) -> tuple:
        min_entropy = float("inf")
        min_pos = (None, None)
        for y in range(self.height):
            for x in range(self.width):
                e = len(self.grid[y][x])
                if 1 < e < min_entropy:
                    min_entropy = e
                    min_pos = (y, x)
        return min_pos

    def _propagate(self, start_x: int, start_y: int):
        """Constraint propagation: narrow down possibilities in adjacent cells"""
        stack = [(start_x, start_y)]
        directions = [(0, -1, "up"), (0, 1, "down"), (-1, 0, "left"), (1, 0, "right")]
        opposite = {"up": "down", "down": "up", "left": "right", "right": "left"}

        while stack:
            x, y = stack.pop()
            for dx, dy, direction in directions:
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.width and 0 <= ny < self.height:
                    # Allowed connections from the current cell
                    allowed = set()
                    for t in self.grid[y][x]:
                        conn_type = self.tiles[t].connections.get(direction)
                        for nt in self.grid[ny][nx]:
                            opp_conn = self.tiles[nt].connections.get(opposite[direction])
                            if conn_type == opp_conn:
                                allowed.add(nt)

                    new_possible = self.grid[ny][nx] & allowed
                    if len(new_possible) < len(self.grid[ny][nx]):
                        self.grid[ny][nx] = new_possible
                        if len(new_possible) == 0:
                            raise RuntimeError(f"Contradiction: ({nx},{ny})")
                        stack.append((nx, ny))
```

### 5.2 LLM-Based Level Design Assistant

```python
class LLMLevelDesigner:
    """Intelligent level design powered by LLM"""

    def __init__(self, llm_client, wfc_generator: WFCLevelGenerator):
        self.llm = llm_client
        self.wfc = wfc_generator

    async def design_level_from_description(
        self,
        description: str,
        width: int = 20,
        height: int = 20,
    ) -> dict:
        """Generate a level from a natural language description

        Args:
            description: "A dark cave with a large lake in the center.
                         A treasure room to the north, entrance to the south."
        """
        # Step 1: Plan the level structure using LLM
        plan_prompt = f"""
Design a game level.

Description: {description}
Size: {width}x{height}

Output in the following JSON format:
{{
    "zones": [
        {{"name": "Entrance", "position": [x, y], "size": [w, h], "type": "entrance"}},
        {{"name": "Main Area", "position": [x, y], "size": [w, h], "type": "open"}},
    ],
    "connections": [
        {{"from": "Entrance", "to": "Main Area", "type": "corridor"}},
    ],
    "poi": [
        {{"name": "Treasure Chest", "zone": "North Room", "importance": "high"}},
    ],
    "atmosphere": "dark_cave"
}}
"""
        plan = await self.llm.generate(plan_prompt)
        level_plan = json.loads(plan)

        # Step 2: Generate detailed tile placement with WFC
        # Reflect zone information in WFC weights
        for zone in level_plan["zones"]:
            self._apply_zone_weights(zone)

        grid = self.wfc.collapse()

        # Step 3: Place Points of Interest (POIs)
        poi_placements = self._place_points_of_interest(
            grid, level_plan["poi"], level_plan["zones"]
        )

        return {
            "grid": grid.tolist(),
            "plan": level_plan,
            "poi": poi_placements,
            "metadata": {
                "width": width,
                "height": height,
                "description": description,
            }
        }

    def _apply_zone_weights(self, zone: dict):
        """Adjust tile weights based on zone information"""
        zone_type = zone["type"]
        x, y = zone["position"]
        w, h = zone["size"]

        # Tile weight adjustments based on zone type
        type_preferences = {
            "entrance": {"door": 5.0, "floor": 2.0, "wall": 1.0},
            "open": {"floor": 3.0, "wall": 0.5},
            "corridor": {"floor": 2.0, "wall": 2.0},
            "treasure": {"floor": 2.0, "decoration": 3.0},
        }
        # Implementation omitted: dynamically modify tile weights for zone regions

    def _place_points_of_interest(
        self, grid, pois, zones
    ) -> list[dict]:
        """Place POIs on the grid"""
        placements = []
        for poi in pois:
            # Randomly select from floor tiles within the target zone
            zone = next(z for z in zones if z["name"] == poi["zone"])
            zx, zy = zone["position"]
            zw, zh = zone["size"]

            candidates = []
            for dy in range(zh):
                for dx in range(zw):
                    gx, gy = zx + dx, zy + dy
                    if 0 <= gx < len(grid[0]) and 0 <= gy < len(grid):
                        tile_id = grid[gy][gx]
                        # Only floor tiles are candidates
                        if self.wfc.tiles[tile_id].id.startswith("floor"):
                            candidates.append((gx, gy))

            if candidates:
                chosen = candidates[np.random.randint(len(candidates))]
                placements.append({
                    "name": poi["name"],
                    "position": list(chosen),
                    "importance": poi["importance"],
                })

        return placements
```

---

## 6. Performance Optimization

### 6.1 Optimization Checklist for AI-Generated Assets

| Check Item | Threshold | Tool |
|------------|-----------|------|
| Polygon Count | Mobile: <5K, PC: <50K | Blender Decimate |
| Texture Size | Mobile: 512px, PC: 2048px | ImageMagick |
| Draw Calls | 1-3 per object | Unity Profiler |
| UV Overlap | 0% | UV Checker |
| Normal Direction | All outward-facing | Blender Recalculate |
| Material Count | 1-2 per object | Atlas Packing |
| LOD Levels | 3 or more | Auto LOD Generation |
| Texture Compression | BC7/ASTC | GPU Compression |
| Mesh Bounds | Proper AABB | Engine Verification |
| Collision | Simplified mesh | Primitive Substitution |

### 6.2 Automated Optimization Pipeline

```python
class AssetOptimizer:
    """Automated optimization pipeline for AI-generated assets"""

    def __init__(self, target_platform: str = "pc"):
        self.platform = target_platform
        self.budgets = self._get_platform_budgets()

    def _get_platform_budgets(self) -> dict:
        """Asset budgets by platform"""
        budgets = {
            "mobile": {
                "max_poly": 5000,
                "max_texture": 512,
                "max_materials": 1,
                "texture_format": "ASTC",
            },
            "pc": {
                "max_poly": 50000,
                "max_texture": 2048,
                "max_materials": 3,
                "texture_format": "BC7",
            },
            "console": {
                "max_poly": 30000,
                "max_texture": 2048,
                "max_materials": 2,
                "texture_format": "BC7",
            },
        }
        return budgets.get(self.platform, budgets["pc"])

    def validate_asset(self, asset_path: str) -> dict:
        """Validate an asset"""
        import trimesh

        mesh = trimesh.load(asset_path)
        results = {
            "poly_count": len(mesh.faces),
            "vertex_count": len(mesh.vertices),
            "is_watertight": mesh.is_watertight,
            "has_degenerate_faces": mesh.is_empty,
            "bounding_box": mesh.bounding_box.extents.tolist(),
        }

        # Budget check
        results["poly_over_budget"] = (
            results["poly_count"] > self.budgets["max_poly"]
        )
        results["needs_decimation"] = results["poly_over_budget"]

        # UV check
        if hasattr(mesh.visual, 'uv') and mesh.visual.uv is not None:
            uv = mesh.visual.uv
            results["has_uv"] = True
            results["uv_range"] = {
                "min": uv.min(axis=0).tolist(),
                "max": uv.max(axis=0).tolist(),
            }
        else:
            results["has_uv"] = False

        return results

    def optimize_mesh(
        self,
        input_path: str,
        output_path: str,
        target_faces: int = None,
    ) -> dict:
        """Automatic mesh optimization"""
        import trimesh

        mesh = trimesh.load(input_path)
        original_faces = len(mesh.faces)

        if target_faces is None:
            target_faces = min(original_faces, self.budgets["max_poly"])

        if original_faces > target_faces:
            # Quadric Edge Collapse Decimation
            ratio = target_faces / original_faces
            mesh = mesh.simplify_quadric_decimation(target_faces)

        # Recalculate normals
        mesh.fix_normals()

        # Export
        mesh.export(output_path)

        return {
            "original_faces": original_faces,
            "optimized_faces": len(mesh.faces),
            "reduction_ratio": 1 - len(mesh.faces) / original_faces,
        }

    def generate_lods(
        self,
        input_path: str,
        output_dir: str,
        lod_ratios: list[float] = None,
    ) -> list[str]:
        """Automatic LOD mesh generation"""
        import trimesh
        from pathlib import Path

        if lod_ratios is None:
            lod_ratios = [1.0, 0.5, 0.25, 0.1]

        Path(output_dir).mkdir(parents=True, exist_ok=True)
        mesh = trimesh.load(input_path)
        base_faces = len(mesh.faces)
        lod_paths = []

        for i, ratio in enumerate(lod_ratios):
            target = max(100, int(base_faces * ratio))
            if ratio < 1.0:
                lod_mesh = mesh.simplify_quadric_decimation(target)
            else:
                lod_mesh = mesh.copy()

            lod_path = f"{output_dir}/lod{i}.glb"
            lod_mesh.export(lod_path)
            lod_paths.append(lod_path)

        return lod_paths
```

### 6.3 Texture Atlas Automation

```python
class TextureAtlasBuilder:
    """Combine textures from multiple assets into an atlas"""

    def __init__(self, atlas_size: int = 2048):
        self.atlas_size = atlas_size

    def build_atlas(
        self,
        textures: list[dict],
        output_path: str,
    ) -> dict:
        """Generate a texture atlas

        Args:
            textures: [{"name": "barrel", "image": PIL.Image, "size": (256, 256)}, ...]
        """
        from PIL import Image
        import numpy as np

        # Packing (simple shelf algorithm)
        atlas = Image.new("RGBA", (self.atlas_size, self.atlas_size), (0, 0, 0, 0))
        uv_mapping = {}

        current_x = 0
        current_y = 0
        row_height = 0

        for tex_info in textures:
            img = tex_info["image"]
            w, h = img.size

            # Wrap to next row if needed
            if current_x + w > self.atlas_size:
                current_x = 0
                current_y += row_height
                row_height = 0

            # Check if it fits in the atlas
            if current_y + h > self.atlas_size:
                raise ValueError(
                    f"Cannot fit within atlas size of {self.atlas_size}px"
                )

            # Place texture
            atlas.paste(img, (current_x, current_y))

            # Record UV mapping information
            uv_mapping[tex_info["name"]] = {
                "offset": (
                    current_x / self.atlas_size,
                    current_y / self.atlas_size,
                ),
                "scale": (
                    w / self.atlas_size,
                    h / self.atlas_size,
                ),
            }

            current_x += w
            row_height = max(row_height, h)

        atlas.save(output_path)
        return {
            "atlas_path": output_path,
            "uv_mapping": uv_mapping,
            "utilization": self._calculate_utilization(uv_mapping),
        }

    def _calculate_utilization(self, mapping: dict) -> float:
        """Calculate atlas utilization rate"""
        total_used = sum(
            m["scale"][0] * m["scale"][1] for m in mapping.values()
        )
        return total_used  # 0.0 ~ 1.0
```

---

## 7. Style Unification and Art Direction

### 7.1 CLIP-Based Style Consistency Check

```python
class StyleConsistencyChecker:
    """Check asset style consistency using CLIP"""

    def __init__(self):
        from transformers import CLIPModel, CLIPProcessor
        self.model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14")
        self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")

    def compute_style_similarity(
        self,
        reference_image: Image.Image,
        target_image: Image.Image,
    ) -> float:
        """Compute style similarity between reference and target"""
        import torch

        inputs = self.processor(
            images=[reference_image, target_image],
            return_tensors="pt",
        )

        with torch.no_grad():
            features = self.model.get_image_features(**inputs)

        # Cosine similarity
        similarity = torch.nn.functional.cosine_similarity(
            features[0:1], features[1:2]
        ).item()

        return similarity

    def batch_check_consistency(
        self,
        reference: Image.Image,
        assets: list[Image.Image],
        threshold: float = 0.75,
    ) -> list[dict]:
        """Batch-check style consistency across multiple assets"""
        results = []
        for i, asset in enumerate(assets):
            sim = self.compute_style_similarity(reference, asset)
            results.append({
                "index": i,
                "similarity": sim,
                "passes": sim >= threshold,
                "grade": (
                    "A" if sim >= 0.9 else
                    "B" if sim >= 0.8 else
                    "C" if sim >= 0.7 else
                    "D" if sim >= 0.6 else "F"
                ),
            })
        return results
```

### 7.2 Style Locking with LoRA / IP-Adapter

```python
class StyleFixedGenerator:
    """Generate with fixed style using LoRA or IP-Adapter"""

    def __init__(self, base_model: str, lora_path: str = None):
        from diffusers import StableDiffusionXLPipeline
        import torch

        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            base_model, torch_dtype=torch.float16
        ).to("cuda")

        if lora_path:
            self.pipe.load_lora_weights(lora_path)

    def generate_with_style_lock(
        self,
        prompts: list[str],
        style_prompt: str = "low poly, hand-painted, stylized game asset",
        color_palette: list[str] = None,
    ) -> list[Image.Image]:
        """Generate textures for multiple assets in a unified style"""
        results = []

        palette_suffix = ""
        if color_palette:
            palette_suffix = f", color palette: {', '.join(color_palette)}"

        for prompt in prompts:
            full_prompt = f"{prompt}, {style_prompt}{palette_suffix}"
            image = self.pipe(
                full_prompt,
                num_inference_steps=25,
                guidance_scale=7.5,
            ).images[0]
            results.append(image)

        return results
```

---

## 8. Anti-Patterns

### 8.1 Anti-Pattern: Mass-Deploying AI-Generated Models Without Validation

```
BAD: Placing 1000 AI-generated props directly into the scene
  - Total polygon count: 50 million → Frame rate plummets
  - Texture memory: 20GB → VRAM shortage
  - Style inconsistency → World-building falls apart

GOOD: Staged deployment with quality gates
  1. AI generation → Automated quality check (poly count, texture size)
  2. Style consistency check (color palette, detail density)
  3. Performance profiling
  4. Art director review
  5. Deploy to production scene
```

### 8.2 Anti-Pattern: Using AI-Generated Assets Without License Verification

```
BAD: Releasing commercially without verifying AI-generated asset licenses
  - Copyright issues with training data
  - API terms of service violations
  - Rights conflicts with highly similar existing works

GOOD: Building a license check workflow
  1. Review terms of service for the AI tool/API used
  2. Clarify commercial use permissions
  3. Confirm ownership rights of generated outputs
  4. Legal team review
  5. Archive a snapshot of the terms of service
```

### 8.3 Anti-Pattern: Ignoring Inconsistent Scales

```
BAD: Inconsistent scales across AI-generated models
  - Barrel is the same size as a house
  - Sword is larger than the character
  - Collision doesn't match the visual

GOOD: Scale normalization pipeline
  1. Set a reference object (1m cube)
  2. Create a scale reference table by category
     - Small items: 0.1-0.5m
     - Furniture: 0.5-2.0m
     - Buildings: 3-20m
  3. Auto-scale on import
  4. Bounding box validation
```

### 8.4 Anti-Pattern: Using High-Poly Meshes Without Retopology

```
BAD: Using AI-generated high-poly meshes directly in-game
  - Irregular topology with only triangles
  - Uneven polygon density (flat surfaces with excessive polygons)
  - Animation breaks down
  - LOD generation quality is poor

GOOD: Proper retopology workflow
  1. AI-generated high-poly → Auto retopo with Instant Meshes
  2. Obtain even quad-based topology
  3. Maintain edge loops on important shape edges
  4. UV unwrap → Texture bake (preserve detail via normal maps)
  5. LOD generation for staged simplification
```

---

## 9. Troubleshooting

### 9.1 Common Problems and Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Texture tiling is visible | Insufficient seam processing | Apply seamless processing, increase blend width |
| 3D model has holes | Non-manifold mesh | Auto-repair with mesh repair tools (MeshFix) |
| Normal map is inverted | OpenGL/DirectX convention difference | Flip Y-axis, check engine settings |
| Texture stretching | UV unwrap failure | Re-unwrap with xatlas, check stretch |
| LOD switching flickers | Too large a gap between LODs | Add intermediate LODs, adjust blend distance |
| Material appears black | Metallic map issues | Set metallic value to 0, check PBR settings |
| Animation floats | Root motion misalignment | Apply foot IK, check ground contact |
| Slow game startup | Insufficient texture memory | Enable streaming, generate mipmaps |
| Low frame rate | Too many draw calls | Texture atlas packing, instancing |
| Unnatural model silhouette | Insufficient polygons | Add polygons to important edges |

### 9.2 Platform-Specific Constraint Handling

```
Mobile Optimization Checklist:
┌─────────────────────────────────────────────┐
│  [ ] Polygon count: 500-5000 per object      │
│  [ ] Textures: 256-512px, ASTC compression   │
│  [ ] Materials: 1 per object                 │
│  [ ] Shaders: Unlit or Simple Lit            │
│  [ ] Draw calls: Under 100 per scene         │
│  [ ] Memory: Under 200MB total textures      │
│  [ ] LOD: 2 or more levels                   │
│  [ ] Animation: Under 30 bones               │
│  [ ] Particles: Under 50 simultaneous        │
│  [ ] Lightmaps: Pre-bake recommended         │
└─────────────────────────────────────────────┘

PC/Console Optimization Checklist:
┌─────────────────────────────────────────────┐
│  [ ] Polygon count: 5K-50K per object        │
│  [ ] Textures: 1024-4096px, BC7 compression  │
│  [ ] Materials: 1-3 per object               │
│  [ ] Shaders: PBR Standard                   │
│  [ ] Draw calls: Under 2000 per scene        │
│  [ ] Memory: Under 2GB total textures        │
│  [ ] LOD: 3-4 levels                         │
│  [ ] Animation: Under 100 bones              │
│  [ ] Lighting: Real-time GI supported        │
│  [ ] Ray tracing: Mesh optimized             │
└─────────────────────────────────────────────┘
```

---

## 10. FAQ

### Q1: Can a game be completed using only AI-generated assets?

**A**: It is entirely possible for indie games and prototypes. AI-generated asset quality is often usable as-is, especially for low-poly or stylized art styles. However, character rigging and animation, as well as UI elements, require manual adjustment. For AAA quality, a hybrid workflow where specialized artists refine AI-generated bases is more practical. As of 2025, approximately 30% of indie games are said to use some form of AI-generated assets.

### Q2: How do you unify the style of AI-generated assets?

**A**: (1) Include a style guide in prompts (e.g., "low poly, pastel colors, hand-painted style"), (2) Lock the style using LoRA or ControlNet, (3) Apply post-processing shaders for visual coherence, (4) Restrict the color palette. The most effective approach is to prepare a small number of high-quality reference images and apply a consistent style using img2img or IP-Adapter. Automating CLIP-based style similarity checks makes it easy to integrate into the pipeline.

### Q3: What are the recommended workflows for each game engine?

**A**:

| Engine | Recommended Format | Import Method | Automation |
|--------|-------------------|---------------|------------|
| Unity | glTF 2.0 / FBX | AssetPostprocessor | C# Script |
| Unreal Engine | FBX / USD | Python Editor Script | Blueprint/Python |
| Godot | glTF 2.0 | EditorImportPlugin | GDScript |

### Q4: How can I improve the quality of AI-generated motion?

**A**: (1) Make text prompts specific ("walk" becomes "walk slowly and cautiously, looking around alertly"), (2) Fine-tune in a motion editor after generation, (3) Apply foot IK to improve ground contact, (4) Smooth transitions with motion blending, (5) Generate multiple samples and select the best one. Manual adjustment is often necessary, especially for fighting games and action games.

### Q5: What if seamless texture generation doesn't work well?

**A**: (1) Always include "seamless tileable" in the prompt, (2) Apply seamless processing after generation (blend width of about 1/4 of the image), (3) Generate multiple times and select the most seamless result, (4) Apply clone-stamp-like corrections to boundary areas in post-processing, (5) Using ControlNet's Tile mode can improve quality in some cases.

### Q6: How should AI-generated assets be version-controlled?

**A**: (1) Manage asset files (textures, meshes) with Git LFS, (2) Save the prompts, parameters, and model versions used for generation as metadata, (3) Manage with an asset catalog (JSON/DB) enabling search and filtering, (4) Version-control prompts the same way as code, (5) Record seed values to ensure reproducibility.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Category | Key Points |
|----------|-----------|
| Textures | Seamless generation with Stable Diffusion, automated PBR set creation, batch variation generation |
| 3D Models | Generate with Meshy/TripoSR, optimize with retopo + LOD, streamline with batch generation |
| Animation | Text-to-motion with MDM, general-purpose motion with Mixamo, transition generation with blending |
| Level | Intelligent auto-placement with WFC + LLM, level design from natural language |
| Quality Control | Automated check gates + CLIP consistency checks + art director review |
| Performance | Polygon budgets, texture atlas, LOD required, platform-specific optimization |
| Licensing | Always verify terms of service, include legal review, record in metadata |
| Style Unification | Leverage LoRA/IP-Adapter, restrict color palette, CLIP score checking |

---

## Recommended Next Reads

- [00-3d-generation.md](./00-3d-generation.md) -- Fundamentals of AI 3D Model Generation Technology
- Game Engine Integration -- Detailed integration methods with Unity and UE
- Procedural Generation -- Advanced PCG technique applications

---

## References

1. Meshy API Documentation -- https://docs.meshy.ai/
2. Gumin, "WaveFunctionCollapse" -- https://github.com/mxgmn/WaveFunctionCollapse
3. Tevet et al., "Human Motion Diffusion Model" -- https://guytevet.github.io/mdm-page/
4. Unity Asset Pipeline Documentation -- https://docs.unity3d.com/Manual/AssetWorkflow.html
5. KhronosGroup glTF Specification -- https://www.khronos.org/gltf/
6. Instant Meshes -- https://github.com/wjakob/instant-meshes
7. xatlas UV Packing -- https://github.com/jpcy/xatlas
8. Radford et al., "Learning Transferable Visual Models From Natural Language Supervision (CLIP)" -- https://arxiv.org/abs/2103.00020
