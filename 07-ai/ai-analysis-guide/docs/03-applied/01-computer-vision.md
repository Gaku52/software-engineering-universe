# Computer Vision

> Gain practical understanding of key techniques and implementation patterns for object detection, segmentation, and image classification

## What You Will Learn in This Chapter

1. **Image Classification and Feature Extraction** — Leveraging CNNs, transfer learning, and Vision Transformers
2. **Object Detection** — How YOLO and DETR work, and real-time detection
3. **Segmentation** — Semantic/instance segmentation, SAM


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [NLP — Text Classification, Named Entity Recognition, Sentiment Analysis](./00-nlp.md)

---

## 1. Fundamentals of Image Classification

```
Basic Structure of a CNN
=========================

Input Image [224x224x3]
    |
    v
[Conv 3x3, 64] --> [ReLU] --> [MaxPool 2x2]  --> Feature Map [112x112x64]
    |
    v
[Conv 3x3, 128] --> [ReLU] --> [MaxPool 2x2] --> Feature Map [56x56x128]
    |
    v
[Conv 3x3, 256] --> [ReLU] --> [MaxPool 2x2] --> Feature Map [28x28x256]
    |
    v
[Global Average Pooling] --> [256]
    |
    v
[FC 256 -> num_classes] --> [Softmax] --> Classification Result

Role of Convolutions:
  Shallow layers: Detect edges and textures
  Middle layers: Detect parts (eyes, wheels, etc.)
  Deep layers: Recognize entire objects
```

### Code Example 1: Image Classification with Transfer Learning

```python
import torch
import torch.nn as nn
import torchvision.models as models
from torchvision import transforms

# Build a classifier based on a pretrained model
class ImageClassifier(nn.Module):
    def __init__(self, num_classes, backbone="resnet50"):
        super().__init__()
        self.backbone = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)

        # Replace the final layer
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, num_classes),
        )

        # Freeze part of the backbone
        for param in list(self.backbone.parameters())[:-20]:
            param.requires_grad = False

    def forward(self, x):
        return self.backbone(x)

# Data augmentation
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

model = ImageClassifier(num_classes=10)
```

### Code Example 1b: Complete Training and Evaluation Pipeline for Transfer Learning

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import time
import json
from pathlib import Path

class TransferLearningTrainer:
    """Complete training and evaluation pipeline for transfer learning"""

    def __init__(self, model, device="auto"):
        self.device = torch.device(
            "cuda" if device == "auto" and torch.cuda.is_available() else "cpu"
        )
        self.model = model.to(self.device)
        self.history = {"train_loss": [], "train_acc": [],
                        "val_loss": [], "val_acc": []}

    def train(self, train_loader, val_loader, epochs=30, lr=1e-3,
              patience=5, save_dir="checkpoints"):
        """Training with progressive fine-tuning"""
        Path(save_dir).mkdir(parents=True, exist_ok=True)

        # Phase 1: Train only the classification head
        print("Phase 1: Training the classification head")
        optimizer = optim.Adam(
            filter(lambda p: p.requires_grad, self.model.parameters()),
            lr=lr
        )
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        criterion = nn.CrossEntropyLoss()

        best_val_acc = 0.0
        no_improve_count = 0

        for epoch in range(epochs):
            # Training phase
            self.model.train()
            total_loss, correct, total = 0, 0, 0
            start = time.time()

            for images, labels in train_loader:
                images, labels = images.to(self.device), labels.to(self.device)
                optimizer.zero_grad()
                outputs = self.model(images)
                loss = criterion(outputs, labels)
                loss.backward()
                optimizer.step()

                total_loss += loss.item() * images.size(0)
                _, predicted = outputs.max(1)
                correct += predicted.eq(labels).sum().item()
                total += labels.size(0)

            scheduler.step()
            train_loss = total_loss / total
            train_acc = correct / total

            # Validation phase
            val_loss, val_acc = self.evaluate(val_loader, criterion)
            elapsed = time.time() - start

            self.history["train_loss"].append(train_loss)
            self.history["train_acc"].append(train_acc)
            self.history["val_loss"].append(val_loss)
            self.history["val_acc"].append(val_acc)

            print(f"  Epoch {epoch+1:3d}/{epochs}  "
                  f"Train Loss={train_loss:.4f} Acc={train_acc:.4f}  "
                  f"Val Loss={val_loss:.4f} Acc={val_acc:.4f}  "
                  f"Time={elapsed:.1f}s")

            # Early Stopping
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                no_improve_count = 0
                torch.save(self.model.state_dict(),
                           f"{save_dir}/best_model.pt")
            else:
                no_improve_count += 1
                if no_improve_count >= patience:
                    print(f"  Early stopping at epoch {epoch+1}")
                    break

        # Restore the best model
        self.model.load_state_dict(
            torch.load(f"{save_dir}/best_model.pt")
        )
        return self.history

    def evaluate(self, loader, criterion=None):
        """Validation/test evaluation"""
        if criterion is None:
            criterion = nn.CrossEntropyLoss()

        self.model.eval()
        total_loss, correct, total = 0, 0, 0

        with torch.no_grad():
            for images, labels in loader:
                images, labels = images.to(self.device), labels.to(self.device)
                outputs = self.model(images)
                loss = criterion(outputs, labels)
                total_loss += loss.item() * images.size(0)
                _, predicted = outputs.max(1)
                correct += predicted.eq(labels).sum().item()
                total += labels.size(0)

        return total_loss / total, correct / total

    def predict(self, images):
        """Batch inference"""
        self.model.eval()
        with torch.no_grad():
            images = images.to(self.device)
            outputs = self.model(images)
            probabilities = torch.softmax(outputs, dim=1)
            _, predicted = outputs.max(1)
        return predicted.cpu(), probabilities.cpu()

    def save_training_report(self, path="training_report.json"):
        """Save training report as JSON"""
        report = {
            "best_val_acc": max(self.history["val_acc"]),
            "final_train_acc": self.history["train_acc"][-1],
            "epochs_trained": len(self.history["train_loss"]),
            "history": self.history,
        }
        with open(path, "w") as f:
            json.dump(report, f, indent=2)

# Usage example
# trainer = TransferLearningTrainer(model)
# history = trainer.train(train_loader, val_loader, epochs=30)
# trainer.save_training_report()
```

### Code Example 1c: Image Classification with Vision Transformer (ViT)

```python
import torch
import torch.nn as nn
from torchvision import models

class ViTClassifier(nn.Module):
    """Vision Transformer-based image classifier"""

    def __init__(self, num_classes, model_name="vit_b_16", pretrained=True):
        super().__init__()
        if model_name == "vit_b_16":
            self.backbone = models.vit_b_16(
                weights=models.ViT_B_16_Weights.IMAGENET1K_V1 if pretrained else None
            )
        elif model_name == "vit_l_16":
            self.backbone = models.vit_l_16(
                weights=models.ViT_L_16_Weights.IMAGENET1K_V1 if pretrained else None
            )

        # Replace the classification head
        in_features = self.backbone.heads.head.in_features
        self.backbone.heads.head = nn.Sequential(
            nn.LayerNorm(in_features),
            nn.Dropout(0.3),
            nn.Linear(in_features, 512),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        return self.backbone(x)

    def freeze_backbone(self):
        """Freeze the backbone"""
        for name, param in self.backbone.named_parameters():
            if "heads" not in name:
                param.requires_grad = False

    def unfreeze_last_n_blocks(self, n=4):
        """Unfreeze the last N Transformer blocks"""
        # First, freeze everything
        for param in self.backbone.parameters():
            param.requires_grad = False
        # The head is always trainable
        for param in self.backbone.heads.parameters():
            param.requires_grad = True
        # Unfreeze the last N blocks
        total_blocks = len(self.backbone.encoder.layers)
        for i in range(total_blocks - n, total_blocks):
            for param in self.backbone.encoder.layers[i].parameters():
                param.requires_grad = True

    def get_attention_maps(self, x):
        """Retrieve attention maps (for visualization)"""
        self.backbone.eval()
        attention_maps = []
        hooks = []

        def hook_fn(module, input, output):
            # Record Multi-Head Attention output
            attention_maps.append(output)

        for layer in self.backbone.encoder.layers:
            hook = layer.self_attention.register_forward_hook(hook_fn)
            hooks.append(hook)

        with torch.no_grad():
            _ = self.backbone(x)

        for hook in hooks:
            hook.remove()

        return attention_maps

# Usage example
vit_model = ViTClassifier(num_classes=10, model_name="vit_b_16")
vit_model.freeze_backbone()
print(f"Trainable parameters: {sum(p.numel() for p in vit_model.parameters() if p.requires_grad):,}")
```

### Code Example 1d: Self-Supervised Feature Extraction with DINOv2

```python
import torch
import torch.nn as nn

class DINOv2Classifier(nn.Module):
    """Classifier using DINOv2 pretrained feature extractor"""

    def __init__(self, num_classes, model_size="small"):
        super().__init__()
        # Load the DINOv2 model
        model_name = f"dinov2_vit{model_size[0]}14"
        self.backbone = torch.hub.load("facebookresearch/dinov2", model_name)

        # Get the feature dimension of the backbone
        embed_dim = self.backbone.embed_dim

        # Classification head
        self.classifier = nn.Sequential(
            nn.LayerNorm(embed_dim),
            nn.Linear(embed_dim, 512),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

        # Freeze the backbone (linear probing)
        for param in self.backbone.parameters():
            param.requires_grad = False

    def forward(self, x):
        with torch.no_grad():
            features = self.backbone(x)  # [batch, embed_dim]
        return self.classifier(features)

# Usage example
# dino_model = DINOv2Classifier(num_classes=10, model_size="small")
```

---

## 2. Object Detection

```
Major Approaches to Object Detection
======================================

1-Stage (Fast):
  YOLO: Divides the image into a grid, predicts directly in each cell
  SSD:  Detects using multi-scale feature maps

  Input --> [CNN Backbone] --> [Detection Head] --> Boxes + Classes
  Speed: 30-150+ FPS

2-Stage (High Accuracy):
  Faster R-CNN: Region Proposal + Classification
  Cascade R-CNN: Multi-stage refinement

  Input --> [CNN] --> [RPN] --> [ROI Pooling] --> [Classifier]
  Speed: 5-15 FPS

Transformer-based:
  DETR: End-to-End object detection
  Input --> [CNN] --> [Transformer Encoder] --> [Decoder + FFN] --> Boxes
```

### Code Example 2: Object Detection with YOLOv8

```python
from ultralytics import YOLO

# Load a pretrained model
model = YOLO("yolov8n.pt")  # nano (fastest), s, m, l, x (highest accuracy)

# Run inference on an image
results = model("image.jpg")

# Process the results
for result in results:
    boxes = result.boxes
    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        confidence = box.conf[0].item()
        class_id = int(box.cls[0].item())
        class_name = model.names[class_id]
        print(f"{class_name}: {confidence:.2f} at ({x1:.0f},{y1:.0f})-({x2:.0f},{y2:.0f})")

# Fine-tuning on custom data
model.train(
    data="dataset.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    device="cuda",
)

# Real-time video detection
results = model("video.mp4", stream=True)
for result in results:
    annotated_frame = result.plot()
    # Display/save the frame
```

### Code Example 2b: Preparing and Training a YOLOv8 Custom Dataset

```python
import os
import yaml
import shutil
from pathlib import Path
import random

def prepare_yolo_dataset(image_dir, label_dir, output_dir,
                          train_ratio=0.8, val_ratio=0.1):
    """Prepare a dataset in YOLO format"""
    output = Path(output_dir)
    for split in ["train", "val", "test"]:
        (output / "images" / split).mkdir(parents=True, exist_ok=True)
        (output / "labels" / split).mkdir(parents=True, exist_ok=True)

    # Get and shuffle the list of images
    images = sorted(Path(image_dir).glob("*.jpg"))
    random.shuffle(images)

    n = len(images)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    splits = {
        "train": images[:train_end],
        "val": images[train_end:val_end],
        "test": images[val_end:],
    }

    for split_name, split_images in splits.items():
        for img_path in split_images:
            # Copy the image
            shutil.copy2(img_path, output / "images" / split_name / img_path.name)
            # Copy the label
            label_path = Path(label_dir) / f"{img_path.stem}.txt"
            if label_path.exists():
                shutil.copy2(label_path, output / "labels" / split_name / label_path.name)

    print(f"Train: {len(splits['train'])}, Val: {len(splits['val'])}, "
          f"Test: {len(splits['test'])}")

    # Generate dataset.yaml
    config = {
        "path": str(output.resolve()),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "names": {0: "class_0", 1: "class_1", 2: "class_2"},  # Change class names as needed
    }
    yaml_path = output / "dataset.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False)

    return str(yaml_path)


def train_yolo_with_best_practices(dataset_yaml, model_size="n"):
    """Train YOLO with best practices applied"""
    from ultralytics import YOLO

    model = YOLO(f"yolov8{model_size}.pt")

    results = model.train(
        data=dataset_yaml,
        epochs=100,
        imgsz=640,
        batch=16,
        patience=20,          # Early stopping
        save=True,
        save_period=10,       # Checkpoint every 10 epochs
        device="0",           # GPU 0
        workers=8,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,             # Final learning rate ratio
        warmup_epochs=3,
        warmup_momentum=0.8,
        cos_lr=True,          # Cosine learning rate scheduler
        # Data augmentation
        augment=True,
        hsv_h=0.015,          # Hue variation
        hsv_s=0.7,            # Saturation variation
        hsv_v=0.4,            # Brightness variation
        degrees=10.0,         # Rotation angle
        translate=0.1,        # Translation
        scale=0.5,            # Scale variation
        fliplr=0.5,           # Horizontal flip probability
        mosaic=1.0,           # Mosaic augmentation probability
        mixup=0.15,           # Mixup probability
    )
    return results


def evaluate_yolo_model(model_path, dataset_yaml):
    """Detailed evaluation of a trained model"""
    from ultralytics import YOLO

    model = YOLO(model_path)

    # Evaluate on the validation set
    metrics = model.val(data=dataset_yaml, split="val")

    print(f"mAP50:    {metrics.box.map50:.4f}")
    print(f"mAP50-95: {metrics.box.map:.4f}")
    print(f"Precision: {metrics.box.mp:.4f}")
    print(f"Recall:    {metrics.box.mr:.4f}")

    # Per-class performance
    for i, name in enumerate(metrics.names.values()):
        print(f"  {name}: mAP50={metrics.box.ap50[i]:.4f}")

    return metrics
```

### Code Example 3: Object Detection with DETR

```python
from transformers import DetrImageProcessor, DetrForObjectDetection
from PIL import Image
import torch

processor = DetrImageProcessor.from_pretrained("facebook/detr-resnet-50")
model = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50")

image = Image.open("image.jpg")
inputs = processor(images=image, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

# Post-processing: retrieve detections above the threshold
target_sizes = torch.tensor([image.size[::-1]])
results = processor.post_process_object_detection(
    outputs, target_sizes=target_sizes, threshold=0.7
)[0]

for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
    box = [round(i, 2) for i in box.tolist()]
    print(f"{model.config.id2label[label.item()]}: {score:.3f} {box}")
```

### Code Example 3b: Open-Set Object Detection with Grounding DINO

```python
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
from PIL import Image
import torch

class OpenVocabularyDetector:
    """Detect arbitrary objects using text prompts"""

    def __init__(self, model_name="IDEA-Research/grounding-dino-base"):
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = AutoModelForZeroShotObjectDetection.from_pretrained(model_name)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

    def detect(self, image_path, text_prompt, threshold=0.3):
        """Object detection based on a text prompt"""
        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(
            images=image,
            text=text_prompt,
            return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)

        results = self.processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            box_threshold=threshold,
            text_threshold=threshold,
            target_sizes=[image.size[::-1]]
        )[0]

        detections = []
        for score, label, box in zip(
            results["scores"], results["labels"], results["boxes"]
        ):
            detections.append({
                "label": label,
                "score": float(score),
                "box": [round(c, 2) for c in box.tolist()],
            })

        return detections

# Usage example
# detector = OpenVocabularyDetector()
# results = detector.detect("photo.jpg", "dog. cat. person.")
# for det in results:
#     print(f"  {det['label']}: {det['score']:.3f} {det['box']}")
```

---

## 3. Segmentation

```
Types of Segmentation
=======================

Semantic Segmentation:
  Assigns a class label to each pixel
  [Sky][Sky][Tree][Tree][Car][Car][Road][Road]
  No distinction between individual instances

Instance Segmentation:
  Distinguishes each object instance
  [Sky][Sky][Tree1][Tree2][Car1][Car2][Road][Road]
  Distinguishes individual instances

Panoptic Segmentation:
  Semantic + Instance
  Integrates background (stuff) + foreground (things)
```

### Code Example 4: SAM (Segment Anything Model)

```python
from segment_anything import SamPredictor, sam_model_registry

# Load the model
sam = sam_model_registry"vit_h"
sam.to(device="cuda")
predictor = SamPredictor(sam)

# Set the image
image = cv2.imread("image.jpg")
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
predictor.set_image(image_rgb)

# Segmentation with point prompts
input_label = np.array([1])  # 1=foreground, 0=background

masks, scores, logits = predictor.predict(
    point_coords=input_point,
    point_labels=input_label,
    multimask_output=True,  # Return multiple mask candidates
)

# Select the mask with the highest confidence
best_mask = masks[scores.argmax()]

# Bounding box prompt
input_box = np.array([100, 100, 400, 400])  # [x1, y1, x2, y2]
masks, _, _ = predictor.predict(
    box=input_box,
    multimask_output=False,
)
```

### Code Example 4b: Video Segmentation with SAM 2

```python
import torch
import numpy as np

class VideoSegmentationPipeline:
    """Video segmentation using SAM 2"""

    def __init__(self, model_path="sam2_hiera_large.pt"):
        # Initialize SAM 2 (conceptual code)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def segment_video(self, video_path, initial_prompts, output_path=None):
        """
        Segment an entire video

        Parameters:
            video_path: Path to the input video
            initial_prompts: Prompts for the initial frame
            output_path: Path to the output video
        """
        import cv2

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if output_path:
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        frame_idx = 0
        masks_history = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            if frame_idx == initial_prompts.get("frame_idx", 0):
                # Initial frame: prompt-based segmentation
                mask = self._segment_with_prompt(frame_rgb, initial_prompts)
            else:
                # Subsequent frames: propagate the mask from the previous frame
                mask = self._propagate_mask(frame_rgb, masks_history[-1])

            masks_history.append(mask)

            if output_path:
                # Overlay the mask
                overlay = self._apply_mask_overlay(frame, mask)
                writer.write(overlay)

            frame_idx += 1

        cap.release()
        if output_path:
            writer.release()

        return masks_history

    def _segment_with_prompt(self, frame, prompts):
        """Prompt-based segmentation (initial frame)"""
        # Implementation depends on the SAM 2 API
        pass

    def _propagate_mask(self, frame, prev_mask):
        """Propagate the previous frame's mask to the current frame"""
        # Track using SAM 2's memory mechanism
        pass

    def _apply_mask_overlay(self, frame, mask, color=(0, 255, 0), alpha=0.4):
        """Overlay a mask on the image"""
        overlay = frame.copy()
        overlay[mask > 0] = (
            overlay[mask > 0] * (1 - alpha) +
            np.array(color) * alpha
        ).astype(np.uint8)
        return overlay
```

### Code Example 5: Semantic Segmentation

```python
from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
import torch
from PIL import Image

processor = SegformerImageProcessor.from_pretrained("nvidia/segformer-b5-finetuned-cityscapes-1024-1024")
model = SegformerForSemanticSegmentation.from_pretrained("nvidia/segformer-b5-finetuned-cityscapes-1024-1024")

image = Image.open("street.jpg")
inputs = processor(images=image, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

# Per-pixel class prediction
logits = outputs.logits  # [batch, num_classes, height, width]
upsampled = torch.nn.functional.interpolate(
    logits, size=image.size[::-1], mode="bilinear", align_corners=False
)
predicted = upsampled.argmax(dim=1).squeeze().numpy()

# Class mapping: 0=road, 1=sidewalk, 2=building, ...
```

### Code Example 5b: Custom Segmentation with U-Net

```python
import torch
import torch.nn as nn

class DoubleConv(nn.Module):
    """Basic U-Net block: Conv -> BN -> ReLU -> Conv -> BN -> ReLU"""

    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.double_conv(x)


class UNet(nn.Module):
    """U-Net segmentation model"""

    def __init__(self, in_channels=3, num_classes=2, features=[64, 128, 256, 512]):
        super().__init__()
        self.downs = nn.ModuleList()
        self.ups = nn.ModuleList()
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)

        # Downsampling path (encoder)
        for feature in features:
            self.downs.append(DoubleConv(in_channels, feature))
            in_channels = feature

        # Bottleneck
        self.bottleneck = DoubleConv(features[-1], features[-1] * 2)

        # Upsampling path (decoder)
        for feature in reversed(features):
            self.ups.append(
                nn.ConvTranspose2d(feature * 2, feature, kernel_size=2, stride=2)
            )
            self.ups.append(DoubleConv(feature * 2, feature))

        # Final output
        self.final_conv = nn.Conv2d(features[0], num_classes, kernel_size=1)

    def forward(self, x):
        skip_connections = []

        # Encoder
        for down in self.downs:
            x = down(x)
            skip_connections.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)
        skip_connections = skip_connections[::-1]

        # Decoder
        for idx in range(0, len(self.ups), 2):
            x = self.upsidx  # TransposedConv
            skip = skip_connections[idx // 2]

            # Padding if sizes don't match
            if x.shape != skip.shape:
                x = nn.functional.pad(x, [
                    0, skip.shape[3] - x.shape[3],
                    0, skip.shape[2] - x.shape[2]
                ])

            x = torch.cat([skip, x], dim=1)  # Skip connection
            x = self.upsidx + 1  # DoubleConv

        return self.final_conv(x)


def dice_loss(pred, target, smooth=1.0):
    """Dice Loss: a loss function for segmentation"""
    pred = torch.sigmoid(pred)
    pred_flat = pred.view(-1)
    target_flat = target.view(-1)

    intersection = (pred_flat * target_flat).sum()
    return 1 - (2.0 * intersection + smooth) / (
        pred_flat.sum() + target_flat.sum() + smooth
    )


class CombinedLoss(nn.Module):
    """Combined BCE + Dice loss function"""

    def __init__(self, bce_weight=0.5, dice_weight=0.5):
        super().__init__()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        self.bce = nn.BCEWithLogitsLoss()

    def forward(self, pred, target):
        bce_loss = self.bce(pred, target)
        d_loss = dice_loss(pred, target)
        return self.bce_weight * bce_loss + self.dice_weight * d_loss

# Usage example
model = UNet(in_channels=3, num_classes=1)
criterion = CombinedLoss(bce_weight=0.5, dice_weight=0.5)
print(f"Number of parameters: {sum(p.numel() for p in model.parameters()):,}")
```

---

## 4. Advanced Applications of Image Processing

### Code Example 6: Image Quality Assessment and Preprocessing Pipeline

```python
import torch
import numpy as np
from PIL import Image
from pathlib import Path
import cv2

class ImageQualityChecker:
    """Automated image quality checking and preprocessing"""

    def __init__(self, min_size=100, max_size=4096,
                 min_brightness=30, max_brightness=230):
        self.min_size = min_size
        self.max_size = max_size
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness

    def check_image(self, image_path):
        """Check the quality of an image"""
        issues = []
        img = cv2.imread(str(image_path))
        if img is None:
            return {"path": str(image_path), "valid": False,
                    "issues": ["Failed to load"]}

        h, w = img.shape[:2]

        # Size check
        if h < self.min_size or w < self.min_size:
            issues.append(f"Too small: {w}x{h}")
        if h > self.max_size or w > self.max_size:
            issues.append(f"Too large: {w}x{h}")

        # Aspect ratio check
        aspect = max(h, w) / min(h, w)
        if aspect > 5:
            issues.append(f"Extreme aspect ratio: {aspect:.1f}")

        # Brightness check
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mean_brightness = gray.mean()
        if mean_brightness < self.min_brightness:
            issues.append(f"Too dark: mean brightness={mean_brightness:.0f}")
        if mean_brightness > self.max_brightness:
            issues.append(f"Too bright: mean brightness={mean_brightness:.0f}")

        # Blur detection (Laplacian variance)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 50:
            issues.append(f"Blurry: Laplacian variance={laplacian_var:.1f}")

        # Corruption check
        if img.shape[2] != 3:
            issues.append(f"Abnormal number of channels: {img.shape[2]}")

        return {
            "path": str(image_path),
            "valid": len(issues) == 0,
            "size": (w, h),
            "brightness": round(mean_brightness, 1),
            "sharpness": round(laplacian_var, 1),
            "issues": issues,
        }

    def check_dataset(self, image_dir, extensions=(".jpg", ".jpeg", ".png")):
        """Check the quality of an entire dataset"""
        results = []
        image_dir = Path(image_dir)
        for ext in extensions:
            for img_path in image_dir.rglob(f"*{ext}"):
                results.append(self.check_image(img_path))

        total = len(results)
        valid = sum(1 for r in results if r["valid"])
        invalid = total - valid

        print(f"Total images: {total}")
        print(f"Valid: {valid} ({valid/total*100:.1f}%)")
        print(f"With issues: {invalid} ({invalid/total*100:.1f}%)")

        # Summary of issues
        all_issues = [issue for r in results for issue in r["issues"]]
        from collections import Counter
        issue_counts = Counter(all_issues)
        if issue_counts:
            print("\nTypes of issues:")
            for issue, count in issue_counts.most_common():
                print(f"  {issue}: {count} cases")

        return results

# Usage example
# checker = ImageQualityChecker()
# results = checker.check_dataset("data/images/")
```

### Code Example 7: Inference Optimization with TensorRT

```python
import torch
import time
import numpy as np

class InferenceOptimizer:
    """Inference optimization and benchmarking"""

    @staticmethod
    def export_to_onnx(model, input_shape, output_path="model.onnx"):
        """Export a PyTorch model to ONNX"""
        model.eval()
        dummy_input = torch.randn(*input_shape)

        torch.onnx.export(
            model, dummy_input, output_path,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
            opset_version=17,
        )
        print(f"ONNX model saved: {output_path}")

    @staticmethod
    def benchmark_model(model, input_shape, n_runs=100, device="cuda"):
        """Benchmark model inference speed"""
        model.eval()
        model.to(device)
        dummy = torch.randn(*input_shape).to(device)

        # Warmup
        for _ in range(10):
            with torch.no_grad():
                _ = model(dummy)

        if device == "cuda":
            torch.cuda.synchronize()

        # Benchmark
        latencies = []
        for _ in range(n_runs):
            start = time.time()
            with torch.no_grad():
                _ = model(dummy)
            if device == "cuda":
                torch.cuda.synchronize()
            latencies.append((time.time() - start) * 1000)

        latencies = np.array(latencies)
        print(f"Inference Latency (ms):")
        print(f"  Mean: {latencies.mean():.2f}")
        print(f"  Median: {np.median(latencies):.2f}")
        print(f"  P95: {np.percentile(latencies, 95):.2f}")
        print(f"  P99: {np.percentile(latencies, 99):.2f}")
        print(f"  Throughput: {1000 / latencies.mean():.1f} FPS")

        return {
            "mean_ms": latencies.mean(),
            "median_ms": np.median(latencies),
            "p95_ms": np.percentile(latencies, 95),
            "fps": 1000 / latencies.mean(),
        }

    @staticmethod
    def optimize_with_torch_compile(model):
        """Optimization with torch.compile (PyTorch 2.0+)"""
        optimized = torch.compile(model, mode="reduce-overhead")
        return optimized

    @staticmethod
    def quantize_model(model, calibration_loader=None):
        """INT8 quantization"""
        model.eval()

        if calibration_loader:
            # Dynamic quantization
            quantized = torch.quantization.quantize_dynamic(
                model, {torch.nn.Linear, torch.nn.Conv2d}, dtype=torch.qint8
            )
        else:
            quantized = torch.quantization.quantize_dynamic(
                model, {torch.nn.Linear}, dtype=torch.qint8
            )

        # Size comparison
        import os, tempfile
        with tempfile.NamedTemporaryFile(suffix=".pt") as f:
            torch.save(model.state_dict(), f.name)
            original_size = os.path.getsize(f.name) / 1024 / 1024
        with tempfile.NamedTemporaryFile(suffix=".pt") as f:
            torch.save(quantized.state_dict(), f.name)
            quantized_size = os.path.getsize(f.name) / 1024 / 1024

        print(f"Original size: {original_size:.1f} MB")
        print(f"After quantization: {quantized_size:.1f} MB")
        print(f"Compression ratio: {original_size / quantized_size:.1f}x")

        return quantized

# Usage example
# optimizer = InferenceOptimizer()
# optimizer.benchmark_model(model, (1, 3, 224, 224))
# optimizer.export_to_onnx(model, (1, 3, 224, 224))
```

---

## 5. Practical Use Cases

### Use Case 1: Product Appearance Inspection (Anomaly Detection)

```python
import torch
import torch.nn as nn
from torchvision import models, transforms

class AnomalyDetector:
    """Visual anomaly detection on a manufacturing line"""

    def __init__(self, feature_extractor="resnet18"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        # Use as a feature extractor (up to the layer before the final one)
        self.feature_extractor = nn.Sequential(
            *list(backbone.children())[:-1]
        ).to(self.device)
        self.feature_extractor.eval()

        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        self.normal_features = None
        self.threshold = None

    def fit(self, normal_images):
        """Learn the feature distribution from normal images"""
        features_list = []
        for img in normal_images:
            img_tensor = self.transform(img).unsqueeze(0).to(self.device)
            with torch.no_grad():
                feat = self.feature_extractor(img_tensor).squeeze()
            features_list.append(feat.cpu().numpy())

        import numpy as np
        self.normal_features = np.array(features_list)
        self.mean = self.normal_features.mean(axis=0)
        self.cov_inv = np.linalg.pinv(np.cov(self.normal_features.T))

        # Set the Mahalanobis distance threshold
        distances = [self._mahalanobis_distance(f) for f in self.normal_features]
        self.threshold = np.percentile(distances, 95)

    def _mahalanobis_distance(self, feature):
        """Compute the Mahalanobis distance"""
        import numpy as np
        diff = feature - self.mean
        return float(np.sqrt(diff @ self.cov_inv @ diff))

    def predict(self, image):
        """Compute the anomaly score"""
        img_tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            feat = self.feature_extractor(img_tensor).squeeze().cpu().numpy()
        distance = self._mahalanobis_distance(feat)
        is_anomaly = distance > self.threshold
        return {
            "anomaly_score": distance,
            "is_anomaly": is_anomaly,
            "threshold": self.threshold,
        }
```

### Use Case 2: OCR (Optical Character Recognition) Pipeline

```python
class OCRPipeline:
    """OCR pipeline for extracting text from images"""

    def __init__(self):
        self.reader = None

    def initialize(self, languages=["ja", "en"]):
        """Initialize EasyOCR"""
        import easyocr
        self.reader = easyocr.Reader(languages, gpu=torch.cuda.is_available())

    def extract_text(self, image_path, detail=True):
        """Extract text from an image"""
        results = self.reader.readtext(str(image_path))

        if detail:
            extracted = []
            for bbox, text, confidence in results:
                extracted.append({
                    "text": text,
                    "confidence": round(confidence, 4),
                    "bbox": bbox,
                })
            return extracted
        else:
            return " ".join([text for _, text, _ in results])

    def extract_from_document(self, image_path, layout_analysis=True):
        """Structured text extraction from a document image"""
        results = self.extract_text(image_path, detail=True)

        if layout_analysis:
            # Sort from top to bottom, left to right
            results.sort(key=lambda r: (
                min(p[1] for p in r["bbox"]),  # Sort by y-coordinate
                min(p[0] for p in r["bbox"]),  # Sort by x-coordinate
            ))

        lines = []
        current_line = []
        prev_y = None

        for result in results:
            y = min(p[1] for p in result["bbox"])
            if prev_y is not None and abs(y - prev_y) > 20:
                lines.append(" ".join([r["text"] for r in current_line]))
                current_line = []
            current_line.append(result)
            prev_y = y

        if current_line:
            lines.append(" ".join([r["text"] for r in current_line]))

        return "\n".join(lines)
```

---

## Model Selection Comparison Table

| Task | Model | Speed | Accuracy | Use Case |
|---|---|---|---|---|
| **Image Classification** | EfficientNet | Fast | High | Mobile, edge |
| **Image Classification** | ViT-Large | Slow | Highest | Server-side |
| **Image Classification** | DINOv2 | Medium | Highest | Zero-shot / few-shot |
| **Object Detection (Fast)** | YOLOv8n | Fastest | Medium | Real-time |
| **Object Detection (Accurate)** | YOLOv8x | Medium | High | High-accuracy requirements |
| **Object Detection (E2E)** | DETR | Slow | High | Research, custom |
| **Object Detection (Open)** | Grounding DINO | Slow | High | Text-guided detection |
| **Segmentation** | SAM | Medium | Highest | Zero-shot |
| **Segmentation** | SAM 2 | Medium | Highest | Video segmentation |
| **Segmentation** | SegFormer | Fast | High | Autonomous driving |
| **Segmentation** | U-Net | Fast | High | Medical imaging |

### Relationship Between Image Size and Accuracy

| Input Size | Inference Speed | Accuracy | Application |
|---|---|---|---|
| 224x224 | Fastest | Low-Medium | Mobile classification |
| 416x416 | Fast | Medium | Real-time detection |
| 640x640 | Medium | High | Standard detection |
| 1280x1280 | Slow | Highest | High-accuracy requirements |

### Comparison of Inference Optimization Techniques

| Technique | Speedup | Accuracy Impact | Difficulty | Supported Frameworks |
|---|---|---|---|---|
| torch.compile | 1.5-3x | None | Low | PyTorch 2.0+ |
| ONNX Runtime | 1.5-2x | None | Low | Framework-agnostic |
| TensorRT | 2-5x | Minimal | Medium | NVIDIA GPU |
| INT8 Quantization | 2-4x | Small | Medium | Various frameworks |
| Pruning | 1.5-3x | Small-Medium | High | PyTorch |
| Knowledge Distillation | 2-10x | Small-Medium | High | Various frameworks |

---

## Troubleshooting

### Problem 1: GPU Out of Memory (CUDA Out of Memory)

```python
# Solution 1: Reduce batch size
train_loader = DataLoader(dataset, batch_size=8)  # 16 -> 8

# Solution 2: Mixed precision training (reduces memory usage by roughly half)
from torch.cuda.amp import autocast, GradScaler
scaler = GradScaler()
with autocast():
    output = model(images)
    loss = criterion(output, labels)
scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()

# Solution 3: Gradient accumulation (maintain effective batch size while saving memory)
accumulation_steps = 4  # Accumulate gradients over 4 steps
for i, (images, labels) in enumerate(train_loader):
    outputs = model(images.cuda())
    loss = criterion(outputs, labels.cuda()) / accumulation_steps
    loss.backward()
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()

# Solution 4: Reduce image size
transform = transforms.Resize(160)  # 224 -> 160

# Solution 5: Release unnecessary tensors
del outputs, loss
torch.cuda.empty_cache()
```

### Problem 2: Training Does Not Converge

```python
# Checklist:
# 1. Check if the learning rate is appropriate
# 2. Check if data normalization is correct
# 3. Check if the loss function is appropriate

# Learning Rate Finder (LR Finder)
from torch.optim.lr_scheduler import OneCycleLR

# Try from a small learning rate to a large one
lrs = []
losses = []
lr = 1e-7
model_copy = copy.deepcopy(model)
optimizer = optim.Adam(model_copy.parameters(), lr=lr)

for batch in train_loader:
    optimizer.param_groups[0]["lr"] = lr
    images, labels = batch
    outputs = model_copy(images.cuda())
    loss = criterion(outputs, labels.cuda())
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()

    lrs.append(lr)
    losses.append(loss.item())
    lr *= 1.1  # Increase learning rate exponentially

    if lr > 1.0:
        break

# Select the learning rate where the loss decreases most rapidly
```

### Problem 3: Class Imbalance

```python
# Solution 1: Weighted loss function
from collections import Counter
class_counts = Counter(labels)
total = sum(class_counts.values())
weights = torch.tensor([total / class_counts[i] for i in range(num_classes)])
weights = weights / weights.sum() * num_classes
criterion = nn.CrossEntropyLoss(weight=weights.cuda())

# Solution 2: Oversampling
from torch.utils.data import WeightedRandomSampler
sample_weights = [1.0 / class_counts[label] for label in labels]
sampler = WeightedRandomSampler(sample_weights, len(sample_weights))
train_loader = DataLoader(dataset, batch_size=32, sampler=sampler)

# Solution 3: Focal Loss
class FocalLoss(nn.Module):
    def __init__(self, alpha=1, gamma=2):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, inputs, targets):
        ce_loss = nn.functional.cross_entropy(inputs, targets, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss
        return focal_loss.mean()
```

---

## Anti-Patterns

### 1. Training Without Data Augmentation

**Problem**: Without data augmentation on a small dataset, the model overfits to the training data and performs poorly in production.

**Solution**: Apply data augmentation such as rotation, flipping, color jittering, Mixup, and CutMix. Augmentation has a significant impact on accuracy, especially with small datasets.

### 2. Improper Input Preprocessing

**Problem**: Running inference without using the pretrained model's normalization parameters (ImageNet mean/std) significantly degrades accuracy.

**Solution**: Verify the preprocessing specifications for the model being used and apply identical preprocessing during both training and inference.

### 3. Training All Layers from the Start in Transfer Learning

```python
# BAD: Train all parameters with the same learning rate
optimizer = optim.Adam(model.parameters(), lr=0.001)

# GOOD: Progressive fine-tuning
# Phase 1: Head only
for param in model.backbone.parameters():
    param.requires_grad = False
optimizer = optim.Adam(model.backbone.fc.parameters(), lr=0.001)
# Train for a few epochs

# Phase 2: Entire model with a lower learning rate
for param in model.parameters():
    param.requires_grad = True
optimizer = optim.Adam([
    {"params": model.backbone.layer4.parameters(), "lr": 1e-4},
    {"params": model.backbone.fc.parameters(), "lr": 1e-3},
], lr=1e-5)
```

### 4. Forgetting model.eval() During Inference

```python
# BAD: Not switching modes during inference
output = model(test_images)  # Dropout/BN remain in training mode

# GOOD:
model.eval()
with torch.no_grad():
    output = model(test_images)
```

---

## Performance Optimization Checklist

- [ ] **Data Loader**: `num_workers > 0`, `pin_memory=True` (when using GPU)
- [ ] **Mixed Precision Training**: Use FP16 with `torch.cuda.amp`
- [ ] **Batch Size**: Use the maximum size that fits in GPU memory
- [ ] **Data Augmentation**: Execute on GPU (`torchvision.transforms.v2` or Albumentations)
- [ ] **Model Selection**: Choose a model of appropriate size for the task
- [ ] **Learning Rate**: Warmup + Cosine Annealing is stable
- [ ] **Early Stopping**: Essential for preventing overfitting
- [ ] **Gradient Clipping**: Stabilize with `torch.nn.utils.clip_grad_norm_`
- [ ] **Inference Optimization**: Speed up with ONNX/TensorRT/torch.compile
- [ ] **Caching**: Cache preprocessed data to reduce I/O

---

## FAQ

### Q1: Should I use a CNN or a Vision Transformer?

**A**: If you have limited data (a few thousand images or less), CNN + transfer learning is more reliable. With large-scale data (tens of thousands of images or more), ViT achieves higher accuracy. In practice, EfficientNet (CNN) or DINOv2 (ViT-based self-supervised learning) offer the best versatility.

### Q2: What are the minimum requirements for real-time object detection?

**A**: To achieve 30+ FPS, the baseline is YOLOv8n + GPU (RTX 3060 or above) with 640x640 input. For edge devices, optimization with TensorRT or ONNX Runtime is required.

### Q3: What makes SAM so impressive?

**A**: SAM can perform "zero-shot" segmentation. Without any class-specific training data, it can segment any object with a single click, making it revolutionary for annotation tools and general-purpose image editing.

### Q4: How can I make image data annotation more efficient?

**A**: (1) Semi-automatic annotation based on SAM (generate contours with a single click), (2) Active learning (prioritize annotating samples where the model is uncertain), (3) Weakly supervised learning (pixel-level predictions from image-level labels), (4) Generate more training data from a small amount of annotations through data augmentation. Representative tools include Label Studio, CVAT, and Roboflow.

### Q5: How do I deploy to edge devices?

**A**: (1) Use lightweight models (MobileNet, EfficientNet-Lite), (2) Quantization (INT8, FP16), (3) Optimization with TensorRT/ONNX Runtime, (4) Leverage hardware accelerators such as NVIDIA Jetson, Apple Neural Engine, and Google Coral. On Jetson Nano, YOLOv8n can achieve 30+ FPS with TensorRT optimization.

### Q6: What techniques exist for 3D computer vision?

**A**: (1) NeRF (Neural Radiance Fields): Reconstruct 3D scenes from collections of 2D images, (2) 3D Gaussian Splatting: Real-time 3D rendering, (3) Point Cloud processing: Classification and segmentation of LiDAR data (PointNet++, Point Transformer), (4) Depth Estimation: Monocular depth estimation (MiDaS, Depth Anything).

---

## Summary

| Topic | Key Points |
|---|---|
| Image Classification | CNN + transfer learning is the baseline. ViT for large-scale data |
| Object Detection | YOLO for real-time, DETR for high accuracy |
| Segmentation | SAM for zero-shot, SegFormer for fast processing |
| Data Augmentation | Essential for small datasets. Directly impacts accuracy |
| Preprocessing | Strictly follow per-model normalization parameters |
| Edge Inference | Optimize with TensorRT/ONNX, speed up with quantization |
| Quality Control | Integrate image quality checks into the pipeline |
| Emerging Tech | DINOv2, SAM 2, and Grounding DINO are noteworthy |

## Recommended Next Guides

- [MLOps](./02-mlops.md) — Deploying and operating CV models
- [RNN/Transformer](../02-deep-learning/02-rnn-transformer.md) — Foundations of Vision Transformers

## References

1. **Ultralytics**: [YOLOv8 Documentation](https://docs.ultralytics.com/) — Latest YOLO documentation
2. **Kirillov et al.**: [Segment Anything (2023)](https://arxiv.org/abs/2304.02643) — Original SAM paper
3. **Dosovitskiy et al.**: [An Image is Worth 16x16 Words (2020)](https://arxiv.org/abs/2010.11929) — Original Vision Transformer paper
4. **Oquab et al.**: [DINOv2: Learning Robust Visual Features (2023)](https://arxiv.org/abs/2304.07193) — Original DINOv2 paper
5. **Liu et al.**: [Grounding DINO (2023)](https://arxiv.org/abs/2303.05499) — Open-set object detection
