# Virtual Try-On

> Explains the mechanisms of virtual try-on systems leveraging AI and computer vision technology from the perspectives of human body estimation, garment deformation, and real-time rendering, and demonstrates implementation methods for e-commerce sites and the apparel industry

## What You Will Learn in This Chapter

1. **Technical Foundations of Virtual Try-On** -- Human pose estimation, semantic segmentation, garment deformation algorithms
2. **Comparison of Major Approaches** -- 2D image-based vs 3D model-based vs AR-based methods and accuracy
3. **Implementation Pipeline and Challenges** -- Data preparation, model training, achieving real-time inference


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [AI Game Asset Generation Practical Guide](./01-game-assets.md)

---

## 1. Overview of Virtual Try-On

### 1.1 System Architecture

```
Virtual Try-On Pipeline

  Input                   Processing                    Output
  +----------+           +-------------------+         +----------+
  | User     |           | 1. Body Estimation |        | Try-On   |
  | Photo/   | -------> | 2. Segmentation     | -->   | Result   |
  | Video    |           | 3. Garment Warping  |       | Image/   |
  +----------+           | 4. Compositing &    |       | Video    |
  +----------+           |    Rendering        |       +----------+
  | Garment  | -------> |                     |
  | Image    |           +-------------------+
  | (Catalog)|
  +----------+
```

### 1.2 Technology Stack

```
Layer Structure

  Frontend
  +-- WebGL / Three.js    --- 3D Rendering
  +-- MediaPipe           --- Real-time Body Estimation
  +-- WebRTC              --- Camera Input

  AI Models
  +-- DWPose / OpenPose   --- Human Pose Estimation
  +-- SAM (Meta)          --- Segmentation
  +-- HR-VITON            --- Image-based Try-On
  +-- CatVTON             --- Category-aware Try-On
  +-- StableVITON         --- Diffusion-based Try-On

  Backend
  +-- ONNX Runtime        --- Model Inference
  +-- TensorRT            --- GPU-optimized Inference
  +-- Triton Server       --- Inference Server
```

### 1.3 Three Approaches

```
[2D Image-based (Image-based VTON)]
  User photo + Garment image -> AI composites
  Accuracy: Medium-High
  Speed: Medium (1-3 seconds)
  Use case: E-commerce sites, catalogs

[3D Model-based]
  3D body scan + 3D garment model -> Physics simulation
  Accuracy: Highest
  Speed: Low (seconds to tens of seconds)
  Use case: Luxury apparel, made-to-order

[AR Real-time]
  Camera feed + AR overlay -> Real-time compositing
  Accuracy: Low-Medium
  Speed: Real-time (30fps)
  Use case: In-store mirrors, mobile apps
```

### 1.4 Technology Evolution Timeline

```
2018  VITON (Han et al.)
  |     +-- Origin of image-based try-on, Thin Plate Spline warping
  |
2019  CP-VTON (Wang et al.)
  |     +-- Introduction of Geometric Matching Module
  |
2020  ACGPN (Yang et al.)
  |     +-- Refinement of semantic segmentation
  |
2021  PF-AFN (Ge et al.)
  |     +-- Parser-Free approach (eliminating the need for parsing)
  |
2022  HR-VITON (Lee et al.)
  |     +-- High-resolution support, conditional normalizing flows
  |
2023  StableVITON (Kim et al.)
  |     +-- Stable Diffusion-based, high-quality compositing
  |   CatVTON (Zheng et al.)
  |     +-- Category-aware try-on
  |
2024  OOTDiffusion (Xu et al.)
  |     +-- Outfitting Fusion, full-body support
  |   IDM-VTON
  |     +-- Identity-preserving try-on
  |
2025  Multimodal Integration
        +-- Garment modification via text instructions, 3D integration
```

---

## 2. 2D Image-based Try-On Implementation

### 2.1 HR-VITON Pipeline

```python
# Try-on image generation with HR-VITON (pseudocode)
import torch
from hr_viton import HRVITONModel
from utils import load_image, preprocess

# Load model
model = HRVITONModel.from_pretrained("hr-viton-checkpoint")
model.to("cuda")

# Prepare inputs
person_image = load_image("person.jpg")           # User photo
garment_image = load_image("tshirt_catalog.jpg")   # Garment catalog image

# Preprocessing: Human parsing + Pose estimation
person_parse = segment_person(person_image)         # Body part segmentation
person_pose = estimate_pose(person_image)           # Joint position estimation
garment_mask = segment_garment(garment_image)       # Garment region extraction

# Generate try-on image
result = model.inference(
    person_image=person_image,
    garment_image=garment_image,
    person_parse=person_parse,
    person_pose=person_pose,
    garment_mask=garment_mask,
)

result.save("try_on_result.jpg")
```

### 2.2 Human Surface Estimation with DensePose

```python
# DensePose: UV mapping of the human body surface
from detectron2 import model_zoo
from detectron2.engine import DefaultPredictor
from detectron2.config import get_cfg
from densepose.config import add_densepose_config

cfg = get_cfg()
add_densepose_config(cfg)
cfg.merge_from_file(model_zoo.get_config_file(
    "densepose_rcnn_R_101_FPN_DL_s1x.yaml"
))
cfg.MODEL.WEIGHTS = "densepose_model.pkl"

predictor = DefaultPredictor(cfg)
outputs = predictor(person_image)

# DensePose maps the human body surface to UV coordinates
# -> Enables accurate garment texture mapping onto the body surface
```

### 2.3 Segmentation

```python
# Human parsing (LIP / ATR format)
# Classifies each pixel into body parts

# Part labels:
#  0: Background, 1: Hat, 2: Hair, 3: Sunglasses
#  4: Upper clothes, 5: Skirt, 6: Pants, 7: Dress
#  8: Belt, 9: Left shoe, 10: Right shoe, 11: Face
#  12: Left leg, 13: Right leg, 14: Left arm, 15: Right arm
#  16: Bag, 17: Scarf

from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor

processor = SegformerImageProcessor.from_pretrained(
    "mattmdjaga/segformer_b2_clothes"
)
model = SegformerForSemanticSegmentation.from_pretrained(
    "mattmdjaga/segformer_b2_clothes"
)

inputs = processor(images=person_image, return_tensors="pt")
outputs = model(**inputs)

# Get the part label for each pixel
parse_map = outputs.logits.argmax(dim=1).squeeze()
```

### 2.4 High-Quality Try-On with OOTDiffusion

```python
# OOTDiffusion: Try-on model based on Outfitting Fusion
# A state-of-the-art VTON method built on Stable Diffusion

import torch
from ootd.inference import OOTDInference
from PIL import Image

class OOTDiffusionPipeline:
    """High-quality virtual try-on with OOTDiffusion"""

    def __init__(self, model_path: str = "levihsu/OOTDiffusion"):
        self.model = OOTDInference(
            model_path=model_path,
            model_type="hd",  # "hd" (half-body) or "dc" (full-body)
        )

    def try_on(
        self,
        person_image_path: str,
        garment_image_path: str,
        category: str = "upperbody",
        num_samples: int = 1,
        num_steps: int = 20,
        guidance_scale: float = 2.0,
        seed: int = 42,
    ) -> list:
        """
        Execute virtual try-on

        category:
          - "upperbody": Upper body (T-shirts, shirts, jackets, etc.)
          - "lowerbody": Lower body (pants, skirts, etc.)
          - "dress": One-piece dresses

        guidance_scale:
          - 1.0-2.0: Natural finish
          - 2.0-3.0: Emphasizes garment details
          - 3.0+: Over-emphasized (watch for artifacts)
        """
        person_img = Image.open(person_image_path).resize((768, 1024))
        garment_img = Image.open(garment_image_path).resize((768, 1024))

        results = self.model(
            category=category,
            image_garm=garment_img,
            image_vton=person_img,
            n_samples=num_samples,
            n_steps=num_steps,
            image_scale=guidance_scale,
            seed=seed,
        )

        return results

    def batch_try_on(
        self,
        person_image_path: str,
        garment_dir: str,
        output_dir: str,
        category: str = "upperbody",
    ) -> dict:
        """Batch try-on with multiple garments"""
        from pathlib import Path
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        results = {}
        for garment_path in Path(garment_dir).glob("*.{jpg,png,jpeg}"):
            try:
                output = self.try_on(
                    person_image_path=person_image_path,
                    garment_image_path=str(garment_path),
                    category=category,
                )
                out_path = f"{output_dir}/{garment_path.stem}_tryon.png"
                output[0].save(out_path)
                results[garment_path.stem] = out_path
            except Exception as e:
                results[garment_path.stem] = f"Error: {e}"

        return results


# Usage example
pipeline = OOTDiffusionPipeline()

# Single garment try-on
result = pipeline.try_on(
    person_image_path="user_photo.jpg",
    garment_image_path="blue_tshirt.jpg",
    category="upperbody",
    num_samples=3,  # Generate 3 variations
    guidance_scale=2.0,
)

# Save results
for i, img in enumerate(result):
    img.save(f"tryon_result_{i}.png")
```

### 2.5 Garment Deformation Algorithm Details

```python
# Thin Plate Spline (TPS) Warping
# A method to deform garment images to fit the user's body shape

import numpy as np
import cv2

class ThinPlateSplineWarper:
    """Garment deformation using TPS (Thin Plate Spline)"""

    def __init__(self, source_points: np.ndarray, target_points: np.ndarray):
        """
        source_points: Control points on the garment image (N, 2)
        target_points: Corresponding points on the user image (N, 2)
        """
        self.source = source_points
        self.target = target_points
        self.n = len(source_points)

        # Compute TPS parameters
        self._compute_parameters()

    def _compute_parameters(self):
        """Compute TPS deformation parameters"""
        n = self.n
        K = np.zeros((n, n))

        for i in range(n):
            for j in range(n):
                if i != j:
                    r = np.linalg.norm(self.source[i] - self.source[j])
                    K[i, j] = r ** 2 * np.log(r + 1e-6)

        # Linear part matrix
        P = np.hstack([np.ones((n, 1)), self.source])

        # Build system of equations
        L = np.zeros((n + 3, n + 3))
        L[:n, :n] = K
        L[:n, n:] = P
        L[n:, :n] = P.T

        # Solve for each axis
        self.params_x = np.linalg.solve(
            L + np.eye(n + 3) * 1e-6,
            np.concatenate([self.target[:, 0], [0, 0, 0]])
        )
        self.params_y = np.linalg.solve(
            L + np.eye(n + 3) * 1e-6,
            np.concatenate([self.target[:, 1], [0, 0, 0]])
        )

    def warp_image(self, image: np.ndarray) -> np.ndarray:
        """Apply TPS warping to an image"""
        h, w = image.shape[:2]
        output = np.zeros_like(image)

        for y in range(h):
            for x in range(w):
                point = np.array([x, y], dtype=float)

                # Coordinate transformation via TPS
                new_x = self._transform_point(point, self.params_x)
                new_y = self._transform_point(point, self.params_y)

                # Get pixel value via bilinear interpolation
                if 0 <= new_x < w and 0 <= new_y < h:
                    output[y, x] = self._bilinear_interpolate(
                        image, new_x, new_y
                    )

        return output

    def _transform_point(self, point, params):
        """Transform a single point's coordinates"""
        result = params[self.n] + params[self.n + 1] * point[0] + params[self.n + 2] * point[1]
        for i in range(self.n):
            r = np.linalg.norm(point - self.source[i])
            if r > 0:
                result += params[i] * r ** 2 * np.log(r)
        return result

    def _bilinear_interpolate(self, image, x, y):
        """Bilinear interpolation"""
        x0 = int(np.floor(x))
        x1 = min(x0 + 1, image.shape[1] - 1)
        y0 = int(np.floor(y))
        y1 = min(y0 + 1, image.shape[0] - 1)

        dx = x - x0
        dy = y - y0

        return (
            image[y0, x0] * (1 - dx) * (1 - dy)
            + image[y0, x1] * dx * (1 - dy)
            + image[y1, x0] * (1 - dx) * dy
            + image[y1, x1] * dx * dy
        ).astype(np.uint8)
```

---

## 3. AR Real-time Try-On

```python
# Real-time AR try-on with MediaPipe + Three.js (conceptual code)
import mediapipe as mp
import cv2

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Pose estimation
    results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    if results.pose_landmarks:
        landmarks = results.pose_landmarks.landmark
        # Get coordinates of shoulders, hips, and arms
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]

        # Warp and composite garment image to match the pose
        garment_overlay = warp_garment_to_pose(
            garment_image, landmarks, frame.shape
        )
        frame = overlay_transparent(frame, garment_overlay)

    cv2.imshow('Virtual Try-On', frame)
```

### 3.1 WebAR Implementation Pattern

```javascript
// Browser-based try-on using WebAR
// Three.js + MediaPipe Holistic

class WebARTryOn {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;

    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
    });

    // Initialize MediaPipe Pose
    this.pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.pose.onResults(this.onPoseResults.bind(this));

    // Garment mesh
    this.garmentMesh = null;
  }

  async loadGarment(glbPath) {
    const loader = new THREE.GLTFLoader();
    const gltf = await loader.loadAsync(glbPath);
    this.garmentMesh = gltf.scene;
    this.scene.add(this.garmentMesh);
  }

  onPoseResults(results) {
    if (!results.poseLandmarks || !this.garmentMesh) return;

    const landmarks = results.poseLandmarks;

    // Calculate scale and position from shoulder coordinates
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    // Scale garment based on shoulder width
    const shoulderWidth = Math.sqrt(
      Math.pow(rightShoulder.x - leftShoulder.x, 2) +
      Math.pow(rightShoulder.y - leftShoulder.y, 2)
    );

    // Body center coordinates
    const centerX = (leftShoulder.x + rightShoulder.x) / 2;
    const centerY = (leftShoulder.y + leftHip.y) / 2;

    // Calculate body tilt angle
    const angle = Math.atan2(
      rightShoulder.y - leftShoulder.y,
      rightShoulder.x - leftShoulder.x
    );

    // Update mesh position, rotation, and scale
    this.garmentMesh.position.set(
      (centerX - 0.5) * 4,
      -(centerY - 0.5) * 4,
      0
    );
    this.garmentMesh.rotation.z = angle;
    this.garmentMesh.scale.setScalar(shoulderWidth * 5);

    this.renderer.render(this.scene, this.camera);
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.video.srcObject = stream;

    const cameraLoop = new Camera(this.video, {
      onFrame: async () => {
        await this.pose.send({ image: this.video });
      },
      width: 1280,
      height: 720,
    });
    cameraLoop.start();
  }
}

// Usage example
const tryOn = new WebARTryOn(
  document.getElementById('video'),
  document.getElementById('canvas')
);
await tryOn.loadGarment('/models/tshirt.glb');
await tryOn.start();
```

### 3.2 Size Recommendation System

```python
# AI-based size recommendation system

import numpy as np
from dataclasses import dataclass

@dataclass
class BodyMeasurements:
    """Body measurement data"""
    height_cm: float
    weight_kg: float
    chest_cm: float
    waist_cm: float
    hip_cm: float
    shoulder_width_cm: float
    arm_length_cm: float
    inseam_cm: float

class SizeRecommender:
    """Size recommendation based on body measurement data"""

    # Size chart per brand (example)
    SIZE_CHARTS = {
        "standard_jp": {
            "S": {"chest": (80, 88), "waist": (68, 76), "hip": (82, 90)},
            "M": {"chest": (88, 96), "waist": (76, 84), "hip": (90, 98)},
            "L": {"chest": (96, 104), "waist": (84, 92), "hip": (98, 106)},
            "XL": {"chest": (104, 112), "waist": (92, 100), "hip": (106, 114)},
        },
    }

    def __init__(self, brand: str = "standard_jp"):
        self.size_chart = self.SIZE_CHARTS.get(brand, self.SIZE_CHARTS["standard_jp"])

    def estimate_body_from_image(self, image_path: str, height_cm: float) -> BodyMeasurements:
        """
        Estimate body measurements from a photo and height

        Actual implementation:
        1. UV mapping of body surface with DensePose
        2. Estimate 3D body parameters with SMPL / SMPL-X
        3. Calculate dimensions for each body part from parameters
        """
        # Body estimation with SMPL model (pseudocode)
        from smpl_estimation import estimate_smpl_params

        smpl_params = estimate_smpl_params(image_path, height_cm)

        measurements = BodyMeasurements(
            height_cm=height_cm,
            weight_kg=smpl_params.estimated_weight,
            chest_cm=smpl_params.chest_circumference,
            waist_cm=smpl_params.waist_circumference,
            hip_cm=smpl_params.hip_circumference,
            shoulder_width_cm=smpl_params.shoulder_width,
            arm_length_cm=smpl_params.arm_length,
            inseam_cm=smpl_params.inseam,
        )
        return measurements

    def recommend_size(
        self,
        measurements: BodyMeasurements,
        garment_type: str = "top",
        fit_preference: str = "regular",
    ) -> dict:
        """
        Recommend a size

        fit_preference: "slim", "regular", "loose"
        """
        # Fit adjustment (cm)
        fit_adjustment = {
            "slim": -2,
            "regular": 0,
            "loose": 4,
        }
        adj = fit_adjustment.get(fit_preference, 0)

        # Calculate fit score for each size
        scores = {}
        for size, ranges in self.size_chart.items():
            score = 0
            if garment_type in ("top", "outerwear"):
                chest_mid = (ranges["chest"][0] + ranges["chest"][1]) / 2
                score += 1.0 - abs(measurements.chest_cm + adj - chest_mid) / 20
            if garment_type in ("bottom",):
                waist_mid = (ranges["waist"][0] + ranges["waist"][1]) / 2
                score += 1.0 - abs(measurements.waist_cm + adj - waist_mid) / 20
                hip_mid = (ranges["hip"][0] + ranges["hip"][1]) / 2
                score += 1.0 - abs(measurements.hip_cm + adj - hip_mid) / 20

            scores[size] = max(0, score)

        # Best size
        best_size = max(scores, key=scores.get)
        confidence = scores[best_size] / max(sum(scores.values()), 1e-6)

        return {
            "recommended_size": best_size,
            "confidence": round(confidence, 2),
            "scores": scores,
            "fit_preference": fit_preference,
            "note": f"Recommendation based on chest {measurements.chest_cm}cm"
                    if garment_type == "top"
                    else f"Recommendation based on waist {measurements.waist_cm}cm",
        }


# Usage example
recommender = SizeRecommender(brand="standard_jp")

measurements = BodyMeasurements(
    height_cm=170,
    weight_kg=65,
    chest_cm=92,
    waist_cm=78,
    hip_cm=94,
    shoulder_width_cm=44,
    arm_length_cm=58,
    inseam_cm=76,
)

result = recommender.recommend_size(
    measurements=measurements,
    garment_type="top",
    fit_preference="regular",
)
print(f"Recommended size: {result['recommended_size']}")
print(f"Confidence: {result['confidence']}")
```

---

## 4. Implementation Guide for E-Commerce Sites

### 4.1 Backend API Design

```python
# Virtual try-on API with FastAPI

from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

app = FastAPI(title="Virtual Try-On API")

class TryOnRequest(BaseModel):
    person_image_id: str
    garment_id: str
    category: str = "upperbody"  # upperbody, lowerbody, dress
    guidance_scale: float = 2.0
    num_samples: int = 1

class TryOnResponse(BaseModel):
    request_id: str
    status: str
    result_urls: list[str] = []
    processing_time_ms: float = 0
    size_recommendation: Optional[dict] = None

class VTONService:
    """Virtual try-on service"""

    def __init__(self):
        self.model = None  # Lazy loading
        self._load_model()

    def _load_model(self):
        """Lazy model loading"""
        import torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # Load VTON model here
        print(f"Model loaded on {self.device}")

    async def process_try_on(self, request: TryOnRequest) -> TryOnResponse:
        """Process a try-on request"""
        import time
        start = time.time()

        request_id = str(uuid.uuid4())

        try:
            # Fetch images
            person_img = await self._fetch_image(request.person_image_id)
            garment_img = await self._fetch_garment(request.garment_id)

            # Execute try-on
            results = self._run_inference(
                person_img, garment_img,
                category=request.category,
                guidance_scale=request.guidance_scale,
                num_samples=request.num_samples,
            )

            # Save results
            result_urls = []
            for i, result in enumerate(results):
                url = await self._save_result(request_id, i, result)
                result_urls.append(url)

            elapsed = (time.time() - start) * 1000

            return TryOnResponse(
                request_id=request_id,
                status="completed",
                result_urls=result_urls,
                processing_time_ms=round(elapsed, 1),
            )

        except Exception as e:
            return TryOnResponse(
                request_id=request_id,
                status=f"error: {str(e)}",
            )

    def _run_inference(self, person_img, garment_img, **kwargs):
        """Execute inference"""
        # Actual inference logic
        pass

    async def _fetch_image(self, image_id):
        """Fetch image from S3, etc."""
        pass

    async def _fetch_garment(self, garment_id):
        """Fetch garment image from catalog DB"""
        pass

    async def _save_result(self, request_id, index, image):
        """Save result to S3"""
        pass

vton_service = VTONService()

@app.post("/api/v1/try-on", response_model=TryOnResponse)
async def try_on(request: TryOnRequest):
    """Virtual try-on API endpoint"""
    return await vton_service.process_try_on(request)

@app.post("/api/v1/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    """Upload user photo"""
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(400, "Only JPEG or PNG supported")

    image_id = str(uuid.uuid4())
    # Save to S3
    return {"image_id": image_id, "status": "uploaded"}
```

### 4.2 Frontend Integration Pattern

```typescript
// Integration example with React components

interface TryOnResult {
  requestId: string;
  status: string;
  resultUrls: string[];
  processingTimeMs: number;
}

async function virtualTryOn(
  personImageId: string,
  garmentId: string,
  category: 'upperbody' | 'lowerbody' | 'dress' = 'upperbody'
): Promise<TryOnResult> {
  const response = await fetch('/api/v1/try-on', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person_image_id: personImageId,
      garment_id: garmentId,
      category: category,
      guidance_scale: 2.0,
      num_samples: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Try-on failed: ${response.statusText}`);
  }

  return response.json();
}

// UX Pattern: Progressive display
// 1. Show loading skeleton
// 2. Display low-resolution preview first (512px)
// 3. Replace with high-resolution result (1024px+)
```

---

## 5. Performance Optimization

### 5.1 Inference Acceleration Techniques

```python
# Inference acceleration with TensorRT

import tensorrt as trt
import numpy as np

class TRTOptimizedVTON:
    """Virtual try-on model optimized with TensorRT"""

    def __init__(self, engine_path: str):
        self.logger = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, "rb") as f:
            self.engine = trt.Runtime(self.logger).deserialize_cuda_engine(f.read())
        self.context = self.engine.create_execution_context()

    @staticmethod
    def convert_to_trt(
        onnx_path: str,
        output_path: str,
        fp16: bool = True,
        max_batch: int = 4,
    ):
        """Convert ONNX model to TensorRT engine"""
        builder = trt.Builder(trt.Logger(trt.Logger.WARNING))
        network = builder.create_network(
            1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
        )
        parser = trt.OnnxParser(network, trt.Logger(trt.Logger.WARNING))

        with open(onnx_path, "rb") as f:
            parser.parse(f.read())

        config = builder.create_builder_config()
        config.max_workspace_size = 4 << 30  # 4GB

        if fp16:
            config.set_flag(trt.BuilderFlag.FP16)

        # Dynamic batch size
        profile = builder.create_optimization_profile()
        input_shape = network.get_input(0).shape
        profile.set_shape(
            network.get_input(0).name,
            min=(1, *input_shape[1:]),
            opt=(2, *input_shape[1:]),
            max=(max_batch, *input_shape[1:]),
        )
        config.add_optimization_profile(profile)

        engine = builder.build_engine(network, config)
        with open(output_path, "wb") as f:
            f.write(engine.serialize())

        print(f"TRT engine saved: {output_path}")


# Acceleration comparison
# +----------------+----------+----------+----------+
# | Method         | Latency  | VRAM     | Quality  |
# +----------------+----------+----------+----------+
# | PyTorch FP32   | 3.5s     | 8GB      | Highest  |
# | PyTorch FP16   | 1.8s     | 4GB      | Near equal|
# | ONNX Runtime   | 1.2s     | 4GB      | Near equal|
# | TensorRT FP16  | 0.6s     | 3GB      | Near equal|
# | TensorRT INT8  | 0.3s     | 2GB      | Slightly lower|
# +----------------+----------+----------+----------+
```

### 5.2 Batch Processing and Caching

```python
# Caching try-on results with Redis

import hashlib
import redis
import json

class TryOnCache:
    """Cache management for try-on results"""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.from_url(redis_url)
        self.ttl = 3600 * 24  # 24 hours

    def _generate_key(self, person_hash: str, garment_id: str, params: dict) -> str:
        """Generate cache key"""
        param_str = json.dumps(params, sort_keys=True)
        raw = f"{person_hash}:{garment_id}:{param_str}"
        return f"vton:{hashlib.sha256(raw.encode()).hexdigest()}"

    def get_cached_result(self, person_hash: str, garment_id: str, params: dict):
        """Retrieve result from cache"""
        key = self._generate_key(person_hash, garment_id, params)
        result = self.redis.get(key)
        if result:
            return json.loads(result)
        return None

    def cache_result(self, person_hash: str, garment_id: str, params: dict, result_urls: list):
        """Save result to cache"""
        key = self._generate_key(person_hash, garment_id, params)
        self.redis.setex(key, self.ttl, json.dumps(result_urls))

    def get_cache_stats(self) -> dict:
        """Cache statistics"""
        info = self.redis.info("stats")
        return {
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": info.get("keyspace_hits", 0) /
                        max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1),
        }
```

---

## 6. Comparison Tables

| Method | Accuracy | Speed | Cost | Requirements |
|--------|:--------:|:-----:|:----:|------|
| 2D Image-based (HR-VITON) | High | 1-3s | Medium | GPU server |
| Diffusion-based (StableVITON) | Highest | 5-15s | High | High-performance GPU |
| OOTDiffusion | Highest | 3-8s | High | High-performance GPU |
| 3D Model-based | Highest | 10-30s | Highest | 3D scan data |
| AR Real-time (MediaPipe) | Medium | Real-time | Low | Camera only |
| Simple Overlay | Low | Real-time | Lowest | None |

| Use Case | Recommended Method | Reason |
|----------|-------------------|--------|
| E-commerce product pages | 2D Image-based | Batch processing capable, high quality |
| In-store AR mirrors | AR Real-time | Immediate feedback |
| Luxury brands | 3D Model-based | Highest quality, accurate size representation |
| Mobile apps | AR Real-time | Lightweight GPU usage, good UX |
| Automated lookbook generation | OOTDiffusion | High quality, full-body support |

### VTON Model Generational Comparison

| Generation | Representative Models | Features | Limitations |
|------------|----------------------|----------|-------------|
| 1st Gen (2018) | VITON, CP-VTON | TPS warping + compositing | Unnatural deformations |
| 2nd Gen (2020) | ACGPN, PF-AFN | Improved segmentation | Weak with complex garments |
| 3rd Gen (2022) | HR-VITON | High resolution, normalizing flows | Limited to specific poses |
| 4th Gen (2023-) | StableVITON, OOTDiffusion | Diffusion-based | Slow processing speed |

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

```
Issue 1: Garment texture is crushed/blurred
----------------------------------------------
Cause: Low input image resolution, or garment image has too many shadows/creases
Solution:
  1. Photograph garments on a white background in a flat state (recommended: 1024x1024+)
  2. Apply shadow removal preprocessing
  3. Lower the guidance_scale (1.5-2.0)

Issue 2: Body shape is unnaturally deformed
----------------------------------------------
Cause: Low accuracy in human parsing, pose estimation failure
Solution:
  1. Use front-facing, full-body photos
  2. Select photos with simple backgrounds
  3. Ensemble multiple estimation results

Issue 3: Unnatural boundary between garment and skin
----------------------------------------------
Cause: Insufficient segmentation accuracy, lack of blending
Solution:
  1. Apply feathering (blur) to masks
  2. Post-process to unify color tones at boundaries
  3. Use DensePose UV maps for precise compositing

Issue 4: Flickering in AR mode
----------------------------------------------
Cause: Frame-to-frame jitter in pose estimation
Solution:
  1. Smooth landmarks with One Euro Filter
  2. Increase min_tracking_confidence (0.7-0.8)
  3. Smooth positions with exponential moving average

Issue 5: Slow processing speed (over 5 seconds)
----------------------------------------------
Cause: Insufficient model optimization, resolution too large
Solution:
  1. Optimize inference with TensorRT / ONNX Runtime
  2. Switch to FP16 precision
  3. Standardize input resolution to 768x1024
  4. Improve throughput with batch processing
```

### 7.2 Garment Image Quality Checklist

```
Photography Conditions Checklist:
  [ ] White or solid-color background
  [ ] Uniform lighting (no shadows)
  [ ] Photographed from the front (flat lay or mannequin)
  [ ] Entire garment is visible in frame
  [ ] Minimum 1024x1024 pixels
  [ ] JPEG quality 90% or higher
  [ ] Color accuracy (white balance adjusted)
  [ ] Minimal wrinkles and creases

Preprocessing Pipeline:
  1. Background removal -> Standardize to white background
  2. White balance correction
  3. Shadow removal (Intrinsic Image Decomposition)
  4. Resolution standardization (resize to 1024x1024)
  5. Garment mask generation (SAM or U2-Net)
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Ignoring Body Type Diversity

```
BAD:
  Training only with standard body type models
  -> Unnatural try-on results for users with diverse body types
  -> Garments overflow, stretch, or deform

GOOD:
  - Train with diverse body type data
  - Use body parameters (height, weight, bust/waist/hip) as input
  - Include a size recommendation feature tailored to the user's body type
```

### Anti-Pattern 2: Lighting and Color Mismatch

```
BAD:
  Studio-lit garment image + outdoor natural light user photo
  -> Obvious compositing artifacts, color mismatch
  -> Negative impact on user purchase decisions

GOOD:
  - Analyze ambient light with Light Estimation
  - Adjust garment color temperature and brightness to match the user photo
  - Unify shadow direction (Shadow Harmonization)
```

### Anti-Pattern 3: Supporting Only a Single Angle

```
BAD:
  Only supporting front-facing photos, completely unsupported for side/back views
  -> Users cannot see the full garment
  -> Complaints like "I can't see the back design"

GOOD:
  - Multi-view support: generate try-on images from front, side, and back
  - Estimate 3D body model -> Render from multiple viewpoints
  - UI that guides users to take "front-facing photos"
  - Future: 3D reconstruction from video input
```

### Anti-Pattern 4: Lack of Error Handling

```
BAD:
  When pose estimation fails, display nothing and return a deformed try-on result
  -> Users see unnatural images and leave

GOOD:
  - Check pose estimation confidence scores
  - Display a "please retake photo" message when confidence is low
  - Fallback: show try-on with a standard model as alternative
  - Set quality gates at each processing stage
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

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

Extend the basic implementation and add the following features.

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
- Be mindful of algorithm computational complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria | When to Prioritize | When Compromise Is Acceptable |
|----------|-------------------|-------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development Speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
+---------------------------------------------------+
|           Architecture Selection Flow              |
+---------------------------------------------------+
|                                                   |
|  (1) Team size?                                   |
|    +-- Small (1-5 people) -> Monolith             |
|    +-- Large (10+ people) -> Go to (2)            |
|                                                   |
|  (2) Deploy frequency?                            |
|    +-- Once a week or less -> Monolith + modules  |
|    +-- Daily/multiple times -> Go to (3)          |
|                                                   |
|  (3) Team independence?                           |
|    +-- High -> Microservices                      |
|    +-- Medium -> Modular monolith                 |
|                                                   |
+---------------------------------------------------+
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Costs**
- A method that is fast in the short term may become technical debt in the long term
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
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
        md += f"## Context\n{self.context}\n\n"
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

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons Learned:**
- Don't pursue perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually modernize a system that has been in operation for over 10 years

**Approach:**
- Migrate gradually using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are missing
- Use an API gateway to coexist old and new systems
- Perform data migration in stages

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core Migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** More than 50 engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
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
    """API contract between teams"""
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

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leverage asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | Applicable Scenario |
|--------------------|--------|--------------------|--------------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 9. FAQ

### Q1. How practical is the accuracy of virtual try-on?

**A.** The latest 2D image-based methods (StableVITON, etc.) have reached a practical level for upper-body garment try-on with front-facing photos. However, challenges remain with (1) reproducing complex patterns and textures, (2) side-facing and back-facing poses, and (3) layered outfit scenarios. The quality is sufficient as a "reference image" on e-commerce sites.

### Q2. Does virtual try-on effectively reduce return rates?

**A.** Multiple studies report a 25-35% reduction in return rates. Returns due to size mismatch are significantly reduced in particular. Data shows that users who use the try-on feature on apparel e-commerce sites with AR try-on have a 2-3x higher purchase rate. However, since accurate color reproduction is display-dependent, the effect on color-related returns is limited.

### Q3. What are the minimum requirements for in-house implementation?

**A.** (1) **GPU server**: NVIDIA A10G or higher (AWS: g5.xlarge equivalent). (2) **Data**: Garment catalog images (white background, front-facing). (3) **Model**: Start with open-source models like HR-VITON or CatVTON. (4) **Inference time**: 2-5 seconds per image is realistic for batch processing. If real-time AR is needed, start with MediaPipe + simple compositing. Build a minimum PoC, verify effectiveness, then invest further.

### Q4. What privacy measures are needed for virtual try-on?

**A.** User body photos are highly sensitive personal information. (1) **On-device processing**: Perform inference on the user's device whenever possible (WebGPU / Core ML). (2) **When sending to server**: TLS encryption required, delete immediately after processing. (3) **Storage policy**: Do not store user photos as a rule. Obtain explicit consent when necessary. (4) **Access control**: Limit access to try-on results to the user only. (5) **GDPR / Personal Information Protection Act**: Clearly establish legal basis for data processing and state it in the privacy policy.

### Q5. Is try-on possible for accessories (hats, glasses, shoes)?

**A.** Maturity of accessory try-on varies by category. **Glasses**: AR-based is very mature, already in practical use at Warby Parker, etc. High accuracy due to precise facial landmark detection. **Hats**: Head size estimation is challenging, but AR can achieve a certain level of quality. **Shoes**: Foot size estimation + AR is progressing (Nike Fit, etc.). **Accessories in general**: 3D model-based AR is the most suitable approach.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing and running code.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Technical Foundation | Human pose estimation + Segmentation + Garment warping + Compositing |
| 2D Image-based | For e-commerce sites. HR-VITON and StableVITON are the main methods |
| AR Real-time | For in-store/mobile use. Lightweight implementation possible with MediaPipe |
| 3D Model-based | Highest accuracy but high cost. For luxury brands |
| Business Impact | Reports of 25-35% reduction in returns, 2-3x improvement in purchase rates |
| Challenges | Body type diversity, lighting consistency, complex garment reproduction |
| Optimization | 6x speedup with TensorRT, caching is essential |
| Privacy | Delete user photos immediately, on-device processing recommended |

---

## Recommended Next Guides

- [Ethical Considerations](./03-ethical-considerations.md) -- Ethics and copyright of AI-generated images
- [Animation](../02-video/02-animation.md) -- AI animation technology
- [Design Tools](../01-image/03-design-tools.md) -- AI editing of product images

---

## References

1. **HR-VITON** -- Lee et al. (ECCV 2022) -- High-resolution virtual try-on
2. **StableVITON** -- Kim et al. (2024) -- Diffusion-based try-on model
3. **DensePose** -- Guler et al. (CVPR 2018) -- Dense mapping of the human body surface
4. **OOTDiffusion** -- Xu et al. (2024) -- Outfitting Fusion-based VTON
5. **SMPL** -- Loper et al. (SIGGRAPH Asia 2015) -- Parametric human body model
6. **MediaPipe Pose** -- Google (2020) -- Real-time human pose estimation
