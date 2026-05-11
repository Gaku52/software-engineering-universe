# AI 3D Model Generation: Technology, Tools, and Practical Guide

> A comprehensive guide to cutting-edge AI 3D generation technologies including NeRF, 3D Gaussian Splatting, Point-E, and Shap-E — covering everything from understanding the underlying principles to tool usage and integration into production workflows.

---

## What You Will Learn in This Chapter

1. Understand the principles and characteristics of **major AI 3D generation methods** (NeRF, 3DGS, diffusion model-based) and apply them appropriately
2. Build practical workflows to **generate 3D models from text/images**
3. Design production pipelines covering **post-processing, optimization, and export of generated 3D models**
4. Effectively utilize **commercial API services** (Meshy, Tripo3D, etc.)
5. Build end-to-end production pipelines including **game engine and web integration**


## Prerequisites

Having the following knowledge will help deepen your understanding of this guide:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Overview of AI 3D Generation Technology

### 1.1 Technology Map

```
┌───────────────────────────────────────────────────────────┐
│              AI 3D Generation Technology Map               │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Input                Method            Output            │
│  ─────               ─────            ─────              │
│                                                           │
│  Multi-image ──> [NeRF]          ────> Implicit 3D repr.  │
│                  [3D Gaussian     ────> Point cloud +      │
│                   Splatting]            Gaussians          │
│                                                           │
│  Text ────────> [Shap-E]        ────> Mesh / Point cloud  │
│                 [Point-E]        ────> Point cloud → Mesh  │
│                 [DreamFusion]    ────> NeRF → Mesh         │
│                 [Meshy/Tripo]    ────> Mesh (commercial    │
│                                        API)               │
│                                                           │
│  Single image ─> [Zero-1-to-3]   ────> Multi-view → 3D   │
│                  [One-2-3-45]     ────> Mesh              │
│                  [TripoSR]        ────> Mesh              │
│                  [InstantMesh]    ────> Mesh              │
│                                                           │
│  3D scan ─────> [COLMAP+NeRF]   ────> High-quality 3D    │
│                                        scene              │
│                 [3DGS]           ────> Real-time rendering │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 1.2 Evolutionary Lineage of Methods

```
2020  NeRF (Mildenhall et al.)
  │     └─ Revolution in implicit neural representations
  │
2021  Instant-NGP
  │     └─ Accelerated with hash encoding
  │
2022  DreamFusion (Google)
  │     └─ Text-to-3D (SDS Loss)
  │   Point-E / Shap-E (OpenAI)
  │     └─ Direct 3D generation with diffusion models
  │
2023  3D Gaussian Splatting
  │     └─ Explicit representation for real-time rendering
  │   TripoSR / InstantMesh
  │     └─ Fast 3D reconstruction from a single image
  │
2024  Large-scale 3D foundation models
  │     └─ LRM, GRM, Trellis, etc.
  │
2025  Unified multimodal 3D generation
        └─ High-quality 3D from text, images, and video
```

### 1.3 Comparison of 3D Representation Formats

```
┌──────────────── Comparison of 3D Representations ─────────────────┐
│                                                                    │
│  Mesh                                                              │
│  ┌────────────┐  Composed of vertices + faces                      │
│  │  △ △ △     │  Compatible with game engines & DCC tools          │
│  │ △ △ △ △   │  Easy texture mapping                              │
│  │  △ △ △     │  File formats: OBJ, FBX, glTF                     │
│  └────────────┘  Easy LOD control                                  │
│                                                                    │
│  Point Cloud                                                       │
│  ┌────────────┐  Collection of coordinate points in 3D space       │
│  │ . . . .    │  Directly tied to scan data                        │
│  │  . . . .   │  Requires splatting for rendering                  │
│  │ . . . .    │  File formats: PLY, PCD, LAS                      │
│  └────────────┘  Often requires mesh conversion                    │
│                                                                    │
│  Implicit Representation                                           │
│  ┌────────────┐  Represented by neural networks                    │
│  │ f(x,y,z)=σ │  Continuous density field                          │
│  │ + color    │  Meshed via Marching Cubes                         │
│  └────────────┘  Compact but high inference cost                   │
│                                                                    │
│  Gaussian (3DGS)                                                   │
│  ┌────────────┐  Collection of 3D Gaussian functions               │
│  │ ○ ○ ○     │  Position + covariance + color + opacity           │
│  │  ○ ○ ○    │  Fast rendering via rasterization                  │
│  │ ○ ○ ○     │  Intuitive editing                                 │
│  └────────────┘  High memory usage                                 │
│                                                                    │
│  Voxel                                                             │
│  ┌────────────┐  Stores values in each cell of a 3D grid          │
│  │ ■ ■ □     │  Simple but memory-inefficient                     │
│  │ □ ■ ■     │  Resolution limited                                │
│  │ ■ □ ■     │  Suitable for convolution operations               │
│  └────────────┘  File formats: VDB, numpy array                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. NeRF (Neural Radiance Fields)

### 2.1 Principle

```
Camera position (x,y,z) + viewing direction (θ,φ)
            │
            v
   ┌──────────────────┐
   │  MLP Network       │
   │  (Multi-Layer      │
   │   Perceptron)      │
   │                    │
   │  Positional        │
   │  Encoding          │
   │       ↓            │
   │  256-dim hidden    │
   │  layer × 8         │
   │       ↓            │
   │  Density σ +       │
   │  Color (r,g,b)     │
   └──────────────────┘
            │
            v
   Volume Rendering
   C(r) = Σ T_i (1-exp(-σ_i δ_i)) c_i
            │
            v
   Novel view synthesis
```

### 2.2 Mathematical Foundations of NeRF

```python
"""
NeRF Volume Rendering Equation:

Ray r(t) = o + t*d  (o: origin, d: direction)

Color integral:
  C(r) = ∫[t_n, t_f] T(t) * σ(r(t)) * c(r(t), d) dt

Transmittance:
  T(t) = exp(-∫[t_n, t] σ(r(s)) ds)

Discrete approximation (used in implementation):
  C(r) ≈ Σ_{i=1}^{N} T_i * (1 - exp(-σ_i * δ_i)) * c_i
  T_i = exp(-Σ_{j=1}^{i-1} σ_j * δ_j)
  δ_i = t_{i+1} - t_i  (distance between samples)
"""

import torch
import torch.nn as nn

class PositionalEncoding(nn.Module):
    """Positional encoding for NeRF"""

    def __init__(self, input_dim, num_frequencies=10):
        super().__init__()
        self.num_frequencies = num_frequencies
        self.input_dim = input_dim
        # Output dimension = input dimension * (2 * num_frequencies + 1)
        self.output_dim = input_dim * (2 * num_frequencies + 1)

    def forward(self, x):
        """
        γ(p) = (p, sin(2^0 π p), cos(2^0 π p),
                   sin(2^1 π p), cos(2^1 π p),
                   ...,
                   sin(2^{L-1} π p), cos(2^{L-1} π p))
        """
        encodings = [x]
        for i in range(self.num_frequencies):
            freq = 2.0 ** i * torch.pi
            encodings.append(torch.sin(freq * x))
            encodings.append(torch.cos(freq * x))
        return torch.cat(encodings, dim=-1)


class NeRFModel(nn.Module):
    """Core NeRF network"""

    def __init__(self, pos_dim=63, dir_dim=27, hidden_dim=256):
        super().__init__()

        # Positional encoding
        self.pos_encoder = PositionalEncoding(3, num_frequencies=10)
        self.dir_encoder = PositionalEncoding(3, num_frequencies=4)

        # Density network (depends only on position)
        self.density_net = nn.Sequential(
            nn.Linear(pos_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
        )

        # Continuation after skip connection
        self.density_net2 = nn.Sequential(
            nn.Linear(hidden_dim + pos_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
        )

        # Density output
        self.sigma_out = nn.Linear(hidden_dim, 1)

        # Color network (depends on position + direction)
        self.color_net = nn.Sequential(
            nn.Linear(hidden_dim + dir_dim, hidden_dim // 2), nn.ReLU(),
            nn.Linear(hidden_dim // 2, 3), nn.Sigmoid(),
        )

    def forward(self, positions, directions):
        """
        positions: [N, 3] — 3D coordinates
        directions: [N, 3] — viewing directions
        """
        pos_enc = self.pos_encoder(positions)  # [N, 63]
        dir_enc = self.dir_encoder(directions)  # [N, 27]

        # Compute density
        h = self.density_net(pos_enc)
        h = self.density_net2(torch.cat([h, pos_enc], dim=-1))
        sigma = torch.relu(self.sigma_out(h))

        # Compute color
        color = self.color_net(torch.cat([h, dir_enc], dim=-1))

        return sigma, color


def volume_rendering(sigmas, colors, deltas):
    """
    Volume rendering (discrete approximation)

    sigmas: [N_rays, N_samples] — density
    colors: [N_rays, N_samples, 3] — color
    deltas: [N_rays, N_samples] — distance between samples
    """
    # Compute alpha: α_i = 1 - exp(-σ_i * δ_i)
    alphas = 1.0 - torch.exp(-sigmas * deltas)

    # Compute transmittance: T_i = Π_{j<i} (1 - α_j)
    transmittance = torch.cumprod(
        torch.cat([
            torch.ones_like(alphas[:, :1]),
            1.0 - alphas[:, :-1],
        ], dim=1),
        dim=1,
    )

    # Compute weights: w_i = T_i * α_i
    weights = transmittance * alphas

    # Accumulate color: C = Σ w_i * c_i
    rendered_color = torch.sum(weights.unsqueeze(-1) * colors, dim=1)

    # Depth estimation
    depths = torch.sum(weights * deltas.cumsum(dim=1), dim=1)

    return rendered_color, depths, weights
```

### 2.3 NeRF Implementation with nerfstudio

```python
# NeRF pipeline using nerfstudio
# Installation: pip install nerfstudio

# 1. Data preparation (camera estimation with COLMAP)
# ns-process-data images --data ./my_images --output-dir ./processed

# 2. Training
# ns-train nerfacto --data ./processed

# 3. Control from Python
from nerfstudio.configs.method_configs import method_configs
from nerfstudio.engine.trainer import TrainerConfig
from pathlib import Path

def train_nerf(
    data_dir: str,
    output_dir: str,
    method: str = "nerfacto",
    max_iterations: int = 30000,
):
    """Train a NeRF model"""
    config = method_configs[method]
    config.data = Path(data_dir)
    config.output_dir = Path(output_dir)
    config.max_num_iterations = max_iterations

    # GPU settings
    config.machine.num_gpus = 1

    # Training parameter adjustments
    config.pipeline.model.near_plane = 0.01
    config.pipeline.model.far_plane = 1000.0

    trainer = config.setup()
    trainer.train()
    return trainer

# 4. Mesh export
# ns-export poisson --load-config outputs/.../config.yml
#   --output-dir exports/ --target-num-faces 50000
```

### 2.4 Capture Protocol — Data Collection for High-Quality NeRF/3DGS

```python
class CaptureProtocol:
    """Capture guidelines for NeRF/3DGS"""

    GUIDELINES = {
        "camera_settings": {
            "iso": "Fixed (400 or below recommended)",
            "aperture": "f/8 to f/11 (ensure depth of field)",
            "shutter_speed": "Prevent motion blur (1/250 or faster)",
            "white_balance": "Fixed (prevent variation)",
            "format": "RAW recommended (flexibility in post-processing)",
            "resolution": "4000x3000 or higher",
        },
        "shooting_pattern": {
            "minimum_images": 50,
            "recommended_images": "100-200",
            "overlap": "70% or more (between adjacent images)",
            "coverage": "360 degrees around the subject + top and bottom",
            "orbit_levels": "3 levels (low / mid / high angle)",
            "close_ups": "Close-up shots of detailed areas",
        },
        "environment": {
            "lighting": "Uniform diffused light (overcast or studio)",
            "avoid": "Strong shadows, reflections, transparent objects",
            "background": "Static, non-moving background",
            "turntable": "Turntable recommended for small objects",
        },
    }

    @staticmethod
    def generate_camera_positions(
        num_cameras=100,
        radius=2.0,
        num_levels=3,
        elevation_range=(15, 75),
    ):
        """Compute ideal camera positions"""
        import numpy as np

        positions = []
        elevations = np.linspace(
            elevation_range[0], elevation_range[1], num_levels
        )

        cameras_per_level = num_cameras // num_levels

        for elev_deg in elevations:
            elev_rad = np.radians(elev_deg)
            for i in range(cameras_per_level):
                azimuth = 2 * np.pi * i / cameras_per_level
                x = radius * np.cos(elev_rad) * np.cos(azimuth)
                y = radius * np.cos(elev_rad) * np.sin(azimuth)
                z = radius * np.sin(elev_rad)
                positions.append({
                    "position": (x, y, z),
                    "elevation_deg": elev_deg,
                    "azimuth_deg": np.degrees(azimuth),
                    "look_at": (0, 0, 0),
                })

        return positions
```

---

## 3. 3D Gaussian Splatting

### 3.1 Comparison with NeRF

| Attribute | NeRF | 3D Gaussian Splatting |
|-----------|------|----------------------|
| 3D Representation | Implicit (MLP) | Explicit (Gaussian point cloud) |
| Rendering | Ray marching | Rasterization |
| Rendering Speed | Slow (seconds/frame) | Real-time (100+ FPS) |
| Training Speed | Hours | Tens of minutes |
| Memory Usage | Small (MLP weights) | Large (millions of Gaussians) |
| Ease of Editing | Difficult | Easy (point manipulation) |
| Mesh Extraction | Marching Cubes | Requires surface reconstruction |
| Quality | High (especially reflections) | High (especially textures) |

### 3.2 Principles of 3DGS

```
3D Gaussian Splatting — Each Gaussian:

One Gaussian = {
    Position:     μ ∈ R^3          (center coordinates in 3D space)
    Covariance:   Σ ∈ R^{3×3}      (shape and orientation)
    Opacity:      α ∈ [0, 1]       (transparency)
    Color:        SH coefficients ∈ R^{K}   (view-dependent color via
                                              spherical harmonics)
}

Covariance matrix decomposition:
  Σ = R * S * S^T * R^T
  R: Rotation matrix (represented as quaternion)
  S: Scale matrix (diagonal, size along 3 axes)

Rendering:
  1. Projection to camera (3D → 2D Gaussian)
  2. Sorting (by depth)
  3. Alpha-blending (front-to-back)

  Projection: Σ' = J * W * Σ * W^T * J^T
    J: Jacobian (projection derivative)
    W: World-to-camera transform
```

### 3.3 3DGS Implementation

```python
# 3D Gaussian Splatting Pipeline
# Repository: https://github.com/graphdeco-inria/gaussian-splatting

import subprocess
from pathlib import Path

class GaussianSplattingPipeline:
    """Training and rendering pipeline for 3D Gaussian Splatting"""

    def __init__(self, repo_path: str = "./gaussian-splatting"):
        self.repo = Path(repo_path)

    def prepare_data(self, images_dir: str, output_dir: str):
        """Run SfM (Structure from Motion) with COLMAP"""
        cmd = [
            "python", str(self.repo / "convert.py"),
            "-s", images_dir,
            "--output", output_dir,
        ]
        subprocess.run(cmd, check=True)

    def train(
        self,
        data_dir: str,
        output_dir: str,
        iterations: int = 30000,
        densify_until: int = 15000,
        sh_degree: int = 3,
    ):
        """Train a 3DGS model"""
        cmd = [
            "python", str(self.repo / "train.py"),
            "-s", data_dir,
            "-m", output_dir,
            "--iterations", str(iterations),
            "--densify_until_iter", str(densify_until),
            "--sh_degree", str(sh_degree),
            # Quality tuning parameters
            "--position_lr_init", "0.00016",
            "--scaling_lr", "0.005",
            "--opacity_lr", "0.05",
        ]
        subprocess.run(cmd, check=True)

    def render(self, model_dir: str, output_dir: str):
        """Render from a trained model"""
        cmd = [
            "python", str(self.repo / "render.py"),
            "-m", model_dir,
            "--output", output_dir,
        ]
        subprocess.run(cmd, check=True)

    def export_ply(self, model_dir: str) -> str:
        """Export point cloud in PLY format"""
        ply_path = Path(model_dir) / "point_cloud" / "iteration_30000" / "point_cloud.ply"
        return str(ply_path)

    def compact_model(self, model_dir: str, target_points: int = 500000):
        """Reduce Gaussian count to create a lightweight model"""
        import numpy as np
        from plyfile import PlyData

        ply_path = self.export_ply(model_dir)
        plydata = PlyData.read(ply_path)
        vertices = plydata['vertex']

        current_count = len(vertices)
        if current_count <= target_points:
            return ply_path

        # Sort by opacity and keep the top entries
        opacities = vertices['opacity']
        indices = np.argsort(opacities)[::-1][:target_points]

        # Create subset
        new_vertices = vertices[indices]
        new_plydata = PlyData(
            [PlyElement.describe(new_vertices, 'vertex')],
            text=False,
        )

        output_path = ply_path.replace(".ply", f"_compact_{target_points}.ply")
        new_plydata.write(output_path)

        print(f"Compacted: {current_count} → {target_points} Gaussians")
        return output_path
```

### 3.4 Displaying 3DGS in a Web Viewer

```python
"""
Displaying 3D Gaussian Splatting in a web browser

Major web viewers:
1. gsplat.js — WebGL-based
2. splat — Three.js-based
3. Luma AI WebGL Viewer
"""

def create_web_viewer(ply_path: str, output_dir: str = "viewer"):
    """Generate a web viewer for a 3DGS model"""
    from pathlib import Path
    import shutil

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # HTML template
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>3D Gaussian Splatting Viewer</title>
    <style>
        body {{ margin: 0; overflow: hidden; }}
        canvas {{ width: 100vw; height: 100vh; display: block; }}
        #info {{
            position: absolute; top: 10px; left: 10px;
            color: white; font-family: monospace;
            background: rgba(0,0,0,0.5); padding: 10px;
        }}
    </style>
</head>
<body>
    <div id="info">
        Controls: Left-click drag to orbit,
        Right-click drag to pan, Scroll to zoom
    </div>
    <canvas id="canvas"></canvas>
    <script type="module">
        import {{ Viewer }} from './gsplat.js';
        const viewer = new Viewer({{
            canvas: document.getElementById('canvas'),
            url: 'model.splat',
        }});
    </script>
</body>
</html>"""

    with open(out / "index.html", "w") as f:
        f.write(html_content)

    # Convert PLY to splat format
    convert_ply_to_splat(ply_path, str(out / "model.splat"))

    print(f"Web viewer generated: {out / 'index.html'}")
    print("Start local server: python -m http.server 8080")
```

---

## 4. 3D Generation from Text/Images

### 4.1 Comparison of Major Methods

| Method | Input | Generation Speed | Quality | Output Format | Commercial Use |
|--------|-------|-----------------|---------|--------------|---------------|
| Shap-E | Text/Image | Seconds | Medium | Mesh/NeRF | MIT |
| Point-E | Text/Image | Minutes | Medium | Point cloud | MIT |
| DreamFusion | Text | Hours | High | NeRF | Research only |
| TripoSR | Single image | Seconds | High | Mesh | MIT |
| InstantMesh | Single image | Tens of seconds | High | Mesh | Apache 2.0 |
| Meshy API | Text/Image | Minutes | High | Mesh (textured) | Commercial API |
| Tripo API | Text/Image | Tens of seconds | High | Mesh (textured) | Commercial API |

### 4.2 Text-to-3D Generation with Shap-E

```python
# Shap-E: Generate 3D models from text
import torch
from shap_e.diffusion.sample import sample_latents
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
from shap_e.models.download import load_model, load_config
from shap_e.util.notebooks import decode_latent_mesh

def generate_3d_from_text(
    prompt: str,
    output_path: str = "output.obj",
    batch_size: int = 1,
    guidance_scale: float = 15.0,
    num_steps: int = 64,
) -> str:
    """Generate a 3D mesh from a text prompt"""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load models
    xm = load_model("transmitter", device=device)
    model = load_model("text300M", device=device)
    diffusion = diffusion_from_config(load_config("diffusion"))

    # Sample latent representations
    latents = sample_latents(
        batch_size=batch_size,
        model=model,
        diffusion=diffusion,
        guidance_scale=guidance_scale,
        model_kwargs=dict(texts=[prompt] * batch_size),
        progress=True,
        clip_denoised=True,
        use_fp16=True,
        use_karras=True,
        karras_steps=num_steps,
        sigma_min=1e-3,
        sigma_max=160,
        s_churn=0,
    )

    # Decode to mesh
    for i, latent in enumerate(latents):
        mesh = decode_latent_mesh(xm, latent).tri_mesh()
        with open(output_path, "w") as f:
            mesh.write_obj(f)

    return output_path

# Usage example
generate_3d_from_text(
    prompt="a red sports car, detailed, high quality",
    output_path="car.obj",
)
```

### 4.3 Single-Image 3D Reconstruction with TripoSR

```python
# TripoSR: Fast 3D reconstruction from a single image
import torch
from tsr.system import TSR
from PIL import Image

def image_to_3d(
    image_path: str,
    output_path: str = "output.obj",
    chunk_size: int = 8192,
    mc_resolution: int = 256,
) -> str:
    """Generate a 3D mesh from a single image"""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load model
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model = model.to(device)

    # Load and preprocess image
    image = Image.open(image_path)

    # 3D generation (completes in seconds)
    with torch.no_grad():
        scene_codes = model([image], device=device)

    # Mesh extraction (Marching Cubes)
    meshes = model.extract_mesh(
        scene_codes,
        resolution=mc_resolution,
    )

    # Export
    meshes[0].export(output_path)
    return output_path
```

### 4.4 Using Commercial APIs (Meshy / Tripo3D)

```python
import requests
import time
from pathlib import Path

class Meshy3DClient:
    """3D model generation via the Meshy API"""

    BASE_URL = "https://api.meshy.ai/v2"

    def __init__(self, api_key: str):
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def text_to_3d(self, prompt: str, art_style: str = "realistic",
                   negative_prompt: str = "", topology: str = "quad"):
        """Generate a 3D model from text"""
        # Step 1: Preview generation
        resp = requests.post(
            f"{self.BASE_URL}/text-to-3d",
            headers=self.headers,
            json={
                "mode": "preview",
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "art_style": art_style,
                "topology": topology,
            },
        )
        task_id = resp.json()["result"]

        # Polling
        result = self._wait_for_completion(task_id)

        # Step 2: Refine generation (higher quality)
        resp = requests.post(
            f"{self.BASE_URL}/text-to-3d",
            headers=self.headers,
            json={
                "mode": "refine",
                "preview_task_id": task_id,
                "texture_richness": "high",
            },
        )
        refine_id = resp.json()["result"]

        return self._wait_for_completion(refine_id)

    def image_to_3d(self, image_url: str):
        """Generate a 3D model from an image"""
        resp = requests.post(
            f"{self.BASE_URL}/image-to-3d",
            headers=self.headers,
            json={
                "image_url": image_url,
                "topology": "quad",
                "target_polycount": 30000,
            },
        )
        task_id = resp.json()["result"]
        return self._wait_for_completion(task_id)

    def _wait_for_completion(self, task_id, timeout=600):
        """Wait for task completion"""
        for _ in range(timeout // 5):
            resp = requests.get(
                f"{self.BASE_URL}/text-to-3d/{task_id}",
                headers=self.headers,
            )
            data = resp.json()
            if data["status"] == "SUCCEEDED":
                return {
                    "model_urls": data["model_urls"],
                    "thumbnail_url": data.get("thumbnail_url"),
                    "task_id": task_id,
                }
            elif data["status"] == "FAILED":
                raise Exception(f"Generation failed: {data}")
            time.sleep(5)
        raise TimeoutError("Timed out")

    def download_model(self, model_urls: dict, output_dir: str):
        """Download generated models"""
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        for fmt, url in model_urls.items():
            resp = requests.get(url)
            file_path = out / f"model.{fmt}"
            with open(file_path, "wb") as f:
                f.write(resp.content)
            print(f"Downloaded: {file_path}")


class Tripo3DClient:
    """3D model generation via the Tripo3D API"""

    BASE_URL = "https://api.tripo3d.ai/v2/openapi"

    def __init__(self, api_key: str):
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def text_to_model(self, prompt: str):
        """Generate a 3D model from text"""
        resp = requests.post(
            f"{self.BASE_URL}/task",
            headers=self.headers,
            json={
                "type": "text_to_model",
                "prompt": prompt,
            },
        )
        task_id = resp.json()["data"]["task_id"]
        return self._wait_for_result(task_id)

    def image_to_model(self, image_token: str):
        """Generate a 3D model from an image"""
        resp = requests.post(
            f"{self.BASE_URL}/task",
            headers=self.headers,
            json={
                "type": "image_to_model",
                "file": {"type": "jpg", "file_token": image_token},
            },
        )
        task_id = resp.json()["data"]["task_id"]
        return self._wait_for_result(task_id)

    def _wait_for_result(self, task_id, timeout=300):
        """Wait for result"""
        for _ in range(timeout // 3):
            resp = requests.get(
                f"{self.BASE_URL}/task/{task_id}",
                headers=self.headers,
            )
            data = resp.json()["data"]
            if data["status"] == "success":
                return data["output"]
            elif data["status"] == "failed":
                raise Exception(f"Failed: {data}")
            time.sleep(3)
        raise TimeoutError("Timed out")
```

### 4.5 DreamFusion — Text-to-3D via SDS Loss

```python
"""
DreamFusion: Text-to-3D generation using Score Distillation Sampling (SDS)

Principle:
1. Initialize a random 3D representation (NeRF)
2. Render from a random viewpoint
3. Use a pretrained image diffusion model (Imagen / SD) to evaluate
   "does this rendering match the prompt?"
4. Compute SDS Loss and update the 3D representation
5. Repeat steps 2-4 (thousands of iterations)

SDS Loss:
  ∇_θ L_SDS = E_{t,ε} [w(t) * (ε_φ(z_t; y, t) - ε) * ∂z/∂θ]

  θ: NeRF parameters
  z: VAE encoding of the rendered result
  ε_φ: Predicted noise from the diffusion model
  y: Text prompt
  t: Noise level
"""

class DreamFusionConcept:
    """Conceptual implementation of DreamFusion"""

    def __init__(self, prompt, diffusion_model="stabilityai/stable-diffusion-2-1"):
        self.prompt = prompt
        self.nerf = self._init_nerf()
        self.diffusion = self._load_diffusion(diffusion_model)

    def train_step(self, iteration):
        """One training iteration"""
        # 1. Sample a random camera position
        camera = self._random_camera()

        # 2. Render from the current NeRF
        rendered_image = self.nerf.render(camera)

        # 3. Compute SDS Loss
        # (the diffusion model evaluates "does this image match the prompt?")
        t = self._sample_timestep()
        noise = torch.randn_like(rendered_image)
        noisy_image = self._add_noise(rendered_image, noise, t)

        with torch.no_grad():
            predicted_noise = self.diffusion(noisy_image, t, self.prompt)

        # SDS gradient
        gradient = predicted_noise - noise

        # 4. Update NeRF parameters
        self.nerf.backward(gradient)
        self.optimizer.step()

    def optimize(self, num_iterations=10000):
        """Optimization loop"""
        for i in range(num_iterations):
            self.train_step(i)
            if i % 1000 == 0:
                print(f"Iteration {i}/{num_iterations}")
                self._save_checkpoint(i)

        # 5. Mesh extraction
        mesh = self.nerf.extract_mesh(resolution=256)
        return mesh
```

---

## 5. Post-Processing and Optimization Pipeline

### 5.1 3D Model Post-Processing Flow

```
Generated 3D model
        │
        v
┌──────────────────┐
│  Mesh Cleanup     │  Remove isolated vertices & duplicate faces
└──────────────────┘
        │
        v
┌──────────────────┐
│  Mesh Simplification │  Optimize polygon count
└──────────────────┘
        │
        v
┌──────────────────┐
│  UV Unwrapping    │  Prepare for texture mapping
└──────────────────┘
        │
        v
┌──────────────────┐
│  Texture Baking   │  Generate color & normal maps
└──────────────────┘
        │
        v
┌──────────────────┐
│  Format Conversion │  Convert to glTF/FBX/USD, etc.
└──────────────────┘
        │
        v
   Final 3D asset
```

### 5.2 Mesh Post-Processing with Trimesh

```python
# Mesh post-processing with Trimesh
import trimesh
import numpy as np

class MeshPostProcessor:
    """Post-processing for generated 3D meshes"""

    def __init__(self, mesh_path: str):
        self.mesh = trimesh.load(mesh_path)

    def clean(self) -> "MeshPostProcessor":
        """Mesh cleanup"""
        # Merge duplicate vertices
        self.mesh.merge_vertices()
        # Remove degenerate faces (zero area)
        self.mesh.remove_degenerate_faces()
        # Remove isolated vertices
        self.mesh.remove_unreferenced_vertices()
        # Recalculate normals
        self.mesh.fix_normals()
        return self

    def simplify(self, target_faces: int = 10000) -> "MeshPostProcessor":
        """Mesh simplification (polygon reduction)"""
        if len(self.mesh.faces) > target_faces:
            self.mesh = self.mesh.simplify_quadric_decimation(target_faces)
        return self

    def smooth(self, iterations: int = 3) -> "MeshPostProcessor":
        """Laplacian smoothing"""
        trimesh.smoothing.filter_laplacian(
            self.mesh, iterations=iterations
        )
        return self

    def center_and_normalize(self) -> "MeshPostProcessor":
        """Center and normalize to origin"""
        # Move centroid to origin
        self.mesh.vertices -= self.mesh.centroid
        # Normalize bounding box to [-1, 1]
        scale = 2.0 / max(self.mesh.extents)
        self.mesh.vertices *= scale
        return self

    def fill_holes(self) -> "MeshPostProcessor":
        """Repair holes"""
        trimesh.repair.fill_holes(self.mesh)
        return self

    def remesh(self, target_edge_length: float = 0.02) -> "MeshPostProcessor":
        """Remesh (create uniform polygon distribution)"""
        try:
            import pymeshlab
            ms = pymeshlab.MeshSet()
            ms.add_mesh(pymeshlab.Mesh(
                self.mesh.vertices, self.mesh.faces
            ))
            ms.meshing_isotropic_explicit_remeshing(
                targetlen=pymeshlab.AbsoluteValue(target_edge_length)
            )
            result = ms.current_mesh()
            self.mesh = trimesh.Trimesh(
                vertices=result.vertex_matrix(),
                faces=result.face_matrix(),
            )
        except ImportError:
            print("pymeshlab is required: pip install pymeshlab")
        return self

    def generate_lod(self, levels=(50000, 10000, 2000, 500)):
        """Generate LOD (Level of Detail) meshes"""
        lod_meshes = {}
        for level in levels:
            mesh_copy = self.mesh.copy()
            if len(mesh_copy.faces) > level:
                mesh_copy = mesh_copy.simplify_quadric_decimation(level)
            lod_meshes[f"LOD_{level}"] = mesh_copy
        return lod_meshes

    def get_stats(self) -> dict:
        """Get mesh statistics"""
        return {
            "vertices": len(self.mesh.vertices),
            "faces": len(self.mesh.faces),
            "edges": len(self.mesh.edges),
            "watertight": self.mesh.is_watertight,
            "volume": self.mesh.volume if self.mesh.is_watertight else None,
            "bounds": self.mesh.bounds.tolist(),
            "extents": self.mesh.extents.tolist(),
            "centroid": self.mesh.centroid.tolist(),
        }

    def export(self, output_path: str, file_type: str = None):
        """Export mesh"""
        self.mesh.export(output_path, file_type=file_type)

# Usage example
processor = MeshPostProcessor("generated.obj")
processor.clean().simplify(target_faces=50000).smooth().center_and_normalize()
processor.export("optimized.glb", file_type="glb")
print(processor.get_stats())
```

### 5.3 Texture Baking and UV Unwrapping

```python
def auto_uv_and_bake(mesh_path: str, output_dir: str):
    """
    Automated UV unwrapping and texture baking

    Uses the Blender Python API
    """
    import subprocess

    blender_script = '''
import bpy
import sys

# Get arguments
mesh_path = sys.argv[-2]
output_dir = sys.argv[-1]

# Import mesh
bpy.ops.import_scene.obj(filepath=mesh_path)
obj = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = obj

# UV unwrapping (Smart UV Project)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(
    angle_limit=66.0,
    island_margin=0.02,
    area_weight=0.0,
)
bpy.ops.object.mode_set(mode='OBJECT')

# Create image for texture baking
bpy.ops.image.new(
    name='BakedTexture',
    width=2048,
    height=2048,
    color=(0, 0, 0, 1),
)

# Set up material and texture nodes
mat = obj.data.materials[0] if obj.data.materials else bpy.data.materials.new("Material")
if not obj.data.materials:
    obj.data.materials.append(mat)

mat.use_nodes = True
nodes = mat.node_tree.nodes
tex_node = nodes.new('ShaderNodeTexImage')
tex_node.image = bpy.data.images['BakedTexture']
tex_node.select = True
nodes.active = tex_node

# Execute baking
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.bake_type = 'DIFFUSE'
bpy.ops.object.bake(type='DIFFUSE')

# Save texture
bpy.data.images['BakedTexture'].save_render(
    filepath=output_dir + '/texture_diffuse.png'
)

# Export in glTF format
bpy.ops.export_scene.gltf(
    filepath=output_dir + '/model.glb',
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
)
'''

    # Run Blender in headless mode
    script_path = Path(output_dir) / "bake_script.py"
    with open(script_path, "w") as f:
        f.write(blender_script)

    cmd = [
        "blender", "--background", "--python", str(script_path),
        "--", mesh_path, output_dir,
    ]
    subprocess.run(cmd, check=True)
```

---

## 6. Game Engine and Web Integration

### 6.1 Integrating 3D Models into Unity

```csharp
// Loading AI-generated 3D models in Unity (conceptual code)
using UnityEngine;
using System.Threading.Tasks;

public class AI3DModelLoader : MonoBehaviour
{
    [Header("API Settings")]
    public string apiEndpoint = "https://api.meshy.ai/v2";
    public string apiKey;

    [Header("Generation Settings")]
    public string prompt = "a medieval sword";
    public string artStyle = "realistic";

    public async Task<GameObject> GenerateAndLoad(string prompt)
    {
        // 1. Generate 3D model via API
        string modelUrl = await RequestGeneration(prompt);

        // 2. Download glTF file
        byte[] modelData = await DownloadModel(modelUrl);

        // 3. Import into Unity (using GLTFUtility, etc.)
        GameObject model = GLTFUtility.ImportGLB(modelData);

        // 4. Set up LOD
        SetupLOD(model);

        // 5. Add collider
        model.AddComponent<MeshCollider>();

        return model;
    }

    private void SetupLOD(GameObject model)
    {
        LODGroup lodGroup = model.AddComponent<LODGroup>();
        // AI-generated models are typically high-poly,
        // so set up LOD at runtime
    }
}
```

### 6.2 Web Display with Three.js

```javascript
// Displaying AI-generated 3D models with Three.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class AI3DViewer {
    constructor(container) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75, container.clientWidth / container.clientHeight, 0.1, 1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // Lighting
        this.setupLighting();

        // Camera position
        this.camera.position.set(2, 2, 2);
        this.camera.lookAt(0, 0, 0);

        this.animate();
    }

    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambient);

        // Directional light
        const directional = new THREE.DirectionalLight(0xffffff, 1.0);
        directional.position.set(5, 10, 5);
        directional.castShadow = true;
        this.scene.add(directional);

        // Environment map (IBL)
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        // Load and set HDR environment map
    }

    async loadModel(url) {
        const loader = new GLTFLoader();
        return new Promise((resolve, reject) => {
            loader.load(url, (gltf) => {
                const model = gltf.scene;

                // Normalize (unify bounding box)
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.0 / maxDim;

                model.position.sub(center);
                model.scale.multiplyScalar(scale);

                this.scene.add(model);
                resolve(model);
            }, undefined, reject);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
```

---

## 7. Anti-Patterns

### 7.1 Anti-Pattern: Ignoring Capture Quality for NeRF/3DGS

```
BAD: Training NeRF with a few casually taken images
  - Blurry images, inconsistent exposure, insufficient coverage
  - → Floating artifacts, models full of holes

GOOD: Systematic capture protocol
  - Uniform lighting conditions (overcast or studio lights)
  - Continuous capture with 70%+ overlap
  - Cover the subject 360 degrees + from above and below
  - At least 50-100 images, high resolution, no motion blur
```

**Problem**: NeRF/3DGS quality is directly tied to input image quality. The "garbage in, garbage out" principle applies directly.

### 7.2 Anti-Pattern: Using Raw Output in Production

```python
# BAD: Loading a generated mesh directly into a game engine
raw_mesh = generate_3d("a medieval castle")
game_engine.load(raw_mesh)  # 1 million polygons, no UV setup

# GOOD: Apply a proper post-processing pipeline
raw_mesh = generate_3d("a medieval castle")
processor = MeshPostProcessor(raw_mesh)
optimized = (
    processor.clean()
    .simplify(target_faces=10000)  # Reduce based on LOD requirements
    .smooth()
    .center_and_normalize()
)
optimized.export("castle_game_ready.glb")
```

**Problem**: AI-generated meshes typically have excessive polygon counts, topology inconsistencies, and no UV setup. Post-processing is always required for production use.

### 7.3 Anti-Pattern: Relying on a Single Method

```
BAD: Using Shap-E for every use case
  - Good for prototyping but limited quality
  - Insufficient texture quality
  - Difficulty reproducing complex shapes

GOOD: Choose the method based on the use case
  - Concept exploration: Shap-E / Point-E (fast, free)
  - Prototyping: Meshy / Tripo API (textured)
  - Production assets: Commercial API + manual retouching
  - Real-world scanning: 3DGS / NeRF (based on actual objects)
```

### 7.4 Anti-Pattern: Ignoring Memory Limits During 3DGS Training

```
BAD: Training with 200 high-resolution images + SH degree=3 all at once
  - Training halts due to VRAM shortage
  - Explosive increase in Gaussian count

GOOD: Configure settings based on available resources
  - Resize images to around 1600x1200
  - Limit densify_until (15000-20000)
  - Lower sh_degree to 2 (slight quality reduction)
  - Prune periodically
```

---

## 8. FAQ

### Q1: Should I choose NeRF or 3D Gaussian Splatting?

**A**: If real-time rendering is required, choose 3DGS. If the goal is the highest quality novel view synthesis, NeRF (nerfacto, etc.) is more suitable. 3DGS is easy to edit and renders fast, but uses more memory. NeRF is compact but rendering is slow. Since 2024, 3DGS has been becoming the mainstream choice.

### Q2: Can text generate production-quality 3D models?

**A**: As of 2025, commercial API services (Meshy, Tripo3D, etc.) can generate 3D models at prototyping quality. They are sufficient for game background assets and concept models. However, for scenarios requiring high quality such as main characters or product visualizations, a workflow where the generated model serves as a base for manual refinement is more realistic.

### Q3: What GPU specs are needed for 3D generation?

**A**: Recommended GPUs by method:

| Method | Minimum VRAM | Recommended GPU | Notes |
|--------|-------------|----------------|-------|
| NeRF (nerfacto) | 8GB | RTX 3080 or higher | Training takes hours |
| 3DGS | 12GB | RTX 4080 or higher | Depends on scene scale |
| Shap-E | 6GB | RTX 3060 or higher | Generates in seconds |
| TripoSR | 8GB | RTX 3070 or higher | Generates in seconds |
| DreamFusion | 16GB+ | RTX 4090 / A100 | Hours of optimization |
| InstantMesh | 8GB | RTX 3070 or higher | Generates in tens of seconds |
| Meshy API | 0 (cloud) | Not required | API calls only |

### Q4: How do I convert a 3DGS model to a mesh?

**A**: To generate a mesh from 3DGS Gaussian point clouds, the following approaches are available:

1. **Poisson Reconstruction**: Reconstruct surfaces from point clouds (implementable with Open3D)
2. **SuGaR**: A method that adds regularization to 3DGS to improve mesh extraction
3. **2DGS**: Uses 2D Gaussians to represent surfaces more accurately

```python
import open3d as o3d

def gaussians_to_mesh(ply_path, output_path, depth=9):
    """Convert 3DGS point cloud to mesh via Poisson Surface Reconstruction"""
    pcd = o3d.io.read_point_cloud(ply_path)

    # Estimate normals
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=0.1, max_nn=30
        )
    )
    pcd.orient_normals_consistent_tangent_plane(k=15)

    # Poisson Surface Reconstruction
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=depth, width=0, scale=1.1, linear_fit=False
    )

    # Remove low-density regions
    vertices_to_remove = densities < np.quantile(densities, 0.05)
    mesh.remove_vertices_by_mask(vertices_to_remove)

    o3d.io.write_triangle_mesh(output_path, mesh)
    return output_path
```

### Q5: What about the copyright of generated 3D models?

**A:**

| Tool/API | License | Commercial Use | Notes |
|----------|---------|---------------|-------|
| **Shap-E** | MIT | Allowed | Model quality is limited |
| **TripoSR** | MIT | Allowed | Released by Stability AI |
| **InstantMesh** | Apache 2.0 | Allowed | Released by TencentARC |
| **Meshy** | Terms of Service | Allowed on paid plans | Generated content belongs to the user |
| **Tripo3D** | Terms of Service | Allowed on paid plans | Check terms of service |
| **DreamFusion** | Research only | Non-commercial | Google research paper |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important during code reviews and architecture design.

---

## 9. Summary

| Category | Key Points |
|----------|-----------|
| NeRF | Implicit neural representation; high quality but slow |
| 3DGS | Explicit Gaussian representation; real-time rendering; easy to edit |
| Text-to-3D | Shap-E/DreamFusion for research; Meshy/Tripo for commercial use |
| Image-to-3D | TripoSR/InstantMesh are fast and high quality |
| Commercial APIs | Meshy/Tripo3D provide high-quality textured models |
| Post-processing | Mesh cleanup → simplification → UV unwrapping → texture baking is essential |
| Game integration | glTF format, LOD setup, and collider configuration are important |
| Web integration | Three.js + GLTFLoader; gsplat.js for 3DGS |
| Key to quality | Input data quality and post-processing pipeline determine final quality |
| GPU requirements | 8GB+ for inference; 12-16GB+ for training as a guideline |

---

## Recommended Next Reading

- [01-game-assets.md](./01-game-assets.md) — Practical AI game asset generation
- AI Image Generation Fundamentals — Foundational understanding of 2D image generation
- 3D Rendering Pipeline — Integration with traditional 3DCG techniques

---

## References

1. Mildenhall et al., "NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis" — https://www.matthewtancik.com/nerf
2. Kerbl et al., "3D Gaussian Splatting for Real-Time Radiance Field Rendering" — https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
3. OpenAI Shap-E — https://github.com/openai/shap-e
4. nerfstudio Documentation — https://docs.nerf.studio/
5. TripoSR — https://github.com/VAST-AI-Research/TripoSR
6. Poole et al., "DreamFusion: Text-to-3D using 2D Diffusion" — https://dreamfusion3d.github.io/
7. Xu et al., "InstantMesh: Efficient 3D Mesh Generation from a Single Image" — https://arxiv.org/abs/2404.07191
8. Guedon & Lepetit, "SuGaR: Surface-Aligned Gaussian Splatting for Efficient 3D Mesh Reconstruction" — https://arxiv.org/abs/2311.12775
