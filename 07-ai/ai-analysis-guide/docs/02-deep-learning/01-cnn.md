# CNN — Convolution, Pooling, and Image Recognition

> Understand the structure and principles of convolutional neural networks and apply them to image recognition tasks

## What You Will Learn in This Chapter

1. **Convolution Operation** — How local feature extraction with kernels works and parameter sharing
2. **Pooling and Stride** — Reducing spatial dimensions and achieving translation invariance
3. **Representative Architectures** — Design philosophies of LeNet, VGG, ResNet, and EfficientNet
4. **Practical Techniques** — Transfer learning, data augmentation, mixed precision training, and model optimization
5. **Object Detection and Segmentation** — Advanced visual tasks built on CNNs
6. **Model Visualization and Interpretation** — Feature maps, Grad-CAM, and filter visualization


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming skills
- Understanding of related fundamental concepts
- Familiarity with the content of [Neural Networks — Perceptrons, Activation Functions, and Backpropagation](./00-neural-networks.md)

---

## 1. How Convolution Operations Work

### 2D Convolution in Action

```
Input Image (5x5)              Kernel (3x3)           Output (3x3)

┌───┬───┬───┬───┬───┐       ┌───┬───┬───┐
│ 1 │ 0 │ 1 │ 0 │ 1 │       │ 1 │ 0 │ 1 │       ┌───┬───┬───┐
├───┼───┼───┼───┼───┤       ├───┼───┼───┤       │ 4 │ 3 │ 4 │
│ 0 │ 1 │ 0 │ 1 │ 0 │       │ 0 │ 1 │ 0 │       ├───┼───┼───┤
├───┼───┼───┼───┼───┤  *    ├───┼───┼───┤  =    │ 2 │ 4 │ 3 │
│ 1 │ 0 │ 1 │ 0 │ 1 │       │ 1 │ 0 │ 1 │       ├───┼───┼───┤
├───┼───┼───┼───┼───┤       └───┴───┴───┘       │ 4 │ 3 │ 4 │
│ 0 │ 1 │ 0 │ 1 │ 0 │                            └───┴───┴───┘
├───┼───┼───┼───┼───┤
│ 1 │ 0 │ 1 │ 0 │ 1 │
└───┴───┴───┴───┴───┘

Output Size = (Input Size - Kernel Size + 2 × Padding) / Stride + 1
            = (5 - 3 + 0) / 1 + 1 = 3

Padding:
  "valid" (no padding): output shrinks
  "same"  (zero padding): output size = input size
```

### Overall CNN Architecture

```
Input Image       Convolution Layer   Pooling Layer      Fully Connected   Output
(H×W×C)           (Feature Extraction)(Downsampling)     (Classification/
                                                          Regression)

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────┐    ┌──────┐
│ 224x224  │    │ Conv 3x3 │    │ MaxPool  │    │      │    │      │
│ x3 (RGB) │───>│ + ReLU   │───>│ 2x2      │───>│ FC   │───>│ 1000 │
│          │    │ 64 filters│    │          │    │layers│    │classes│
│          │    │          │    │          │    │      │    │      │
└──────────┘    └──────────┘    └──────────┘    └──────┘    └──────┘
                     │               │
                     v               v
              Feature Maps      Size Halved
              224x224x64        112x112x64

  → Repeat convolution + pooling to extract features hierarchically
  → Low-level features (edges) → Mid-level (textures) → High-level (object parts)
```

### Mathematical Definition of the Convolution Operation

```python
import numpy as np

def conv2d_manual(input_img: np.ndarray, kernel: np.ndarray,
                  stride: int = 1, padding: int = 0) -> np.ndarray:
    """Manual implementation of convolution (for understanding purposes)"""
    # Apply padding
    if padding > 0:
        input_img = np.pad(input_img,
                           ((padding, padding), (padding, padding)),
                           mode='constant', constant_values=0)

    h_in, w_in = input_img.shape
    k_h, k_w = kernel.shape

    # Calculate output size
    h_out = (h_in - k_h) // stride + 1
    w_out = (w_in - k_w) // stride + 1
    output = np.zeros((h_out, w_out))

    # Convolution operation (cross-correlation)
    for i in range(h_out):
        for j in range(w_out):
            region = input_img[i*stride:i*stride+k_h,
                              j*stride:j*stride+k_w]
            output[i, j] = np.sum(region * kernel)

    return output

# Example of edge detection kernels
sobel_x = np.array([[-1, 0, 1],
                     [-2, 0, 2],
                     [-1, 0, 1]], dtype=np.float32)

sobel_y = np.array([[-1, -2, -1],
                     [ 0,  0,  0],
                     [ 1,  2,  1]], dtype=np.float32)

# Gaussian blur
gaussian_3x3 = np.array([[1, 2, 1],
                          [2, 4, 2],
                          [1, 2, 1]], dtype=np.float32) / 16.0

# Sharpening filter
sharpen = np.array([[ 0, -1,  0],
                     [-1,  5, -1],
                     [ 0, -1,  0]], dtype=np.float32)

# Test
test_img = np.random.rand(8, 8)
result = conv2d_manual(test_img, sobel_x, stride=1, padding=1)
print(f"Input: {test_img.shape} → Output: {result.shape}")
```

### Receptive Field Calculation

```python
def calculate_receptive_field(layers: list[dict]) -> dict:
    """Calculate the receptive field for each layer

    Args:
        layers: [{"kernel": k, "stride": s, "padding": p}, ...]

    Returns:
        Receptive field size and jump for each layer
    """
    rf = 1      # Receptive field size
    jump = 1    # Jump (cumulative stride)
    start = 0.5 # Center position of the receptive field

    results = []
    for i, layer in enumerate(layers):
        k = layer["kernel"]
        s = layer["stride"]

        rf = rf + (k - 1) * jump
        jump = jump * s

        results.append({
            "layer": i + 1,
            "kernel": k,
            "stride": s,
            "receptive_field": rf,
            "jump": jump,
        })
        print(f"Layer {i+1}: kernel={k}, stride={s} → "
              f"RF={rf}, jump={jump}")

    return results

# Receptive field calculation example for VGG-16
vgg_layers = [
    {"kernel": 3, "stride": 1, "padding": 1},  # conv1_1
    {"kernel": 3, "stride": 1, "padding": 1},  # conv1_2
    {"kernel": 2, "stride": 2, "padding": 0},  # pool1
    {"kernel": 3, "stride": 1, "padding": 1},  # conv2_1
    {"kernel": 3, "stride": 1, "padding": 1},  # conv2_2
    {"kernel": 2, "stride": 2, "padding": 0},  # pool2
    {"kernel": 3, "stride": 1, "padding": 1},  # conv3_1
    {"kernel": 3, "stride": 1, "padding": 1},  # conv3_2
    {"kernel": 3, "stride": 1, "padding": 1},  # conv3_3
    {"kernel": 2, "stride": 2, "padding": 0},  # pool3
]

print("=== VGG-16 Receptive Field ===")
results = calculate_receptive_field(vgg_layers)
# The larger the RF of the final layer, the wider the context it sees
```

### Code Example 1: Basic CNN Implementation in PyTorch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SimpleCNN(nn.Module):
    """Basic CNN architecture"""

    def __init__(self, num_classes: int = 10):
        super().__init__()

        # Convolution block 1
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=32,
                                kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)

        # Convolution block 2
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)

        # Convolution block 3
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)

        # Pooling
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)
        self.adaptive_pool = nn.AdaptiveAvgPool2d((1, 1))

        # Fully connected layers
        self.fc1 = nn.Linear(128, 256)
        self.dropout = nn.Dropout(0.5)
        self.fc2 = nn.Linear(256, num_classes)

    def forward(self, x):
        # Block 1: Conv → BN → ReLU → Pool
        x = self.pool(F.relu(self.bn1(self.conv1(x))))  # 28x28 → 14x14
        # Block 2
        x = self.pool(F.relu(self.bn2(self.conv2(x))))  # 14x14 → 7x7
        # Block 3
        x = F.relu(self.bn3(self.conv3(x)))              # 7x7
        x = self.adaptive_pool(x)                         # 1x1
        # Flatten → FC
        x = x.view(x.size(0), -1)                         # (B, 128)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x

# Model summary
model = SimpleCNN(num_classes=10)
print(f"Number of parameters: {sum(p.numel() for p in model.parameters()):,}")

# Verify shapes with dummy input
dummy = torch.randn(1, 1, 28, 28)
output = model(dummy)
print(f"Output shape: {output.shape}")  # (1, 10)
```

### Code Example 2: Complete Training Loop

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import time

def train_cnn():
    """Complete training pipeline for MNIST classification"""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Data preprocessing
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,))
    ])

    train_dataset = datasets.MNIST("data", train=True, download=True,
                                    transform=transform)
    test_dataset = datasets.MNIST("data", train=False, transform=transform)

    train_loader = DataLoader(train_dataset, batch_size=128, shuffle=True,
                              num_workers=2, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=256, shuffle=False)

    model = SimpleCNN(num_classes=10).to(device)
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=10)
    criterion = nn.CrossEntropyLoss()

    # Training loop
    for epoch in range(10):
        model.train()
        total_loss = 0
        correct = 0
        total = 0
        start = time.time()

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

        scheduler.step()
        train_acc = correct / total

        # Test evaluation
        model.eval()
        test_correct = 0
        test_total = 0
        with torch.no_grad():
            for images, labels in test_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                test_correct += predicted.eq(labels).sum().item()
                test_total += labels.size(0)

        test_acc = test_correct / test_total
        elapsed = time.time() - start
        print(f"Epoch {epoch+1:2d}  "
              f"Loss={total_loss/len(train_loader):.4f}  "
              f"Train Acc={train_acc:.4f}  "
              f"Test Acc={test_acc:.4f}  "
              f"Time={elapsed:.1f}s")

    return model

# model = train_cnn()
```

### Code Example: Mixed Precision Training and Gradient Accumulation

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.cuda.amp import autocast, GradScaler

class TrainerWithAMP:
    """Trainer combining mixed precision training and gradient accumulation"""

    def __init__(self, model: nn.Module, optimizer: optim.Optimizer,
                 criterion: nn.Module, device: torch.device,
                 accumulation_steps: int = 4):
        self.model = model.to(device)
        self.optimizer = optimizer
        self.criterion = criterion
        self.device = device
        self.accumulation_steps = accumulation_steps
        self.scaler = GradScaler()

    def train_epoch(self, train_loader, epoch: int):
        """One epoch of training (AMP + Gradient Accumulation)"""
        self.model.train()
        total_loss = 0.0
        correct = 0
        total = 0
        self.optimizer.zero_grad()

        for batch_idx, (images, labels) in enumerate(train_loader):
            images = images.to(self.device, non_blocking=True)
            labels = labels.to(self.device, non_blocking=True)

            # Forward pass with mixed precision
            with autocast():
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                # Scale loss for gradient accumulation
                loss = loss / self.accumulation_steps

            # Backward pass using scaler
            self.scaler.scale(loss).backward()

            # Accumulate gradients from N mini-batches then update parameters
            if (batch_idx + 1) % self.accumulation_steps == 0:
                # Gradient clipping (important when using AMP)
                self.scaler.unscale_(self.optimizer)
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(), max_norm=1.0
                )
                self.scaler.step(self.optimizer)
                self.scaler.update()
                self.optimizer.zero_grad()

            total_loss += loss.item() * self.accumulation_steps
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

        acc = correct / total
        avg_loss = total_loss / len(train_loader)
        print(f"Epoch {epoch}: Loss={avg_loss:.4f}, Acc={acc:.4f}")
        return avg_loss, acc

    @torch.no_grad()
    def evaluate(self, test_loader):
        """Evaluation (AMP-compatible)"""
        self.model.eval()
        correct = 0
        total = 0

        for images, labels in test_loader:
            images = images.to(self.device, non_blocking=True)
            labels = labels.to(self.device, non_blocking=True)

            with autocast():
                outputs = self.model(images)

            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

        acc = correct / total
        print(f"Test Accuracy: {acc:.4f}")
        return acc

# Usage example
# model = SimpleCNN(num_classes=10)
# optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
# criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
# device = torch.device("cuda")
#
# trainer = TrainerWithAMP(model, optimizer, criterion, device,
#                          accumulation_steps=4)
# # Effective batch size = batch_size × accumulation_steps
# # Example: batch_size=32 × 4 = 128
```

---

## 2. Representative Architectures

### Code Example 3: ResNet Residual Block Implementation

```python
import torch
import torch.nn as nn

class ResidualBlock(nn.Module):
    """ResNet residual block"""

    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, 3,
                                stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, 3,
                                stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)

        # Shortcut connection (when dimensions differ)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 1,
                          stride=stride, bias=False),
                nn.BatchNorm2d(out_channels)
            )

    def forward(self, x):
        identity = self.shortcut(x)

        out = torch.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += identity     # Residual connection: F(x) + x
        out = torch.relu(out)
        return out

class ResNet(nn.Module):
    """Simplified ResNet"""

    def __init__(self, num_classes=10):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.pool = nn.MaxPool2d(3, stride=2, padding=1)

        self.layer1 = self._make_layer(64, 64, blocks=2, stride=1)
        self.layer2 = self._make_layer(64, 128, blocks=2, stride=2)
        self.layer3 = self._make_layer(128, 256, blocks=2, stride=2)

        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(256, num_classes)

    def _make_layer(self, in_ch, out_ch, blocks, stride):
        layers = [ResidualBlock(in_ch, out_ch, stride)]
        for _ in range(1, blocks):
            layers.append(ResidualBlock(out_ch, out_ch))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.pool(torch.relu(self.bn1(self.conv1(x))))
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.avgpool(x)
        x = x.view(x.size(0), -1)
        x = self.fc(x)
        return x
```

### Bottleneck Block (ResNet-50 and beyond)

```python
class BottleneckBlock(nn.Module):
    """Bottleneck block used in ResNet-50/101/152

    A 3-layer structure of 1x1 → 3x3 → 1x1 that reduces
    computation by compressing channels before convolution.
    With expansion = 4, the output channels are 4x the input.
    """
    expansion = 4

    def __init__(self, in_channels: int, mid_channels: int,
                 stride: int = 1, groups: int = 1, width_per_group: int = 64):
        super().__init__()

        # Group convolution support for ResNeXt
        width = int(mid_channels * (width_per_group / 64.0)) * groups

        # 1x1: Channel compression
        self.conv1 = nn.Conv2d(in_channels, width, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(width)

        # 3x3: Spatial feature extraction (with group convolution support)
        self.conv2 = nn.Conv2d(width, width, 3, stride=stride,
                                padding=1, groups=groups, bias=False)
        self.bn2 = nn.BatchNorm2d(width)

        # 1x1: Channel expansion
        out_channels = mid_channels * self.expansion
        self.conv3 = nn.Conv2d(width, out_channels, 1, bias=False)
        self.bn3 = nn.BatchNorm2d(out_channels)

        self.relu = nn.ReLU(inplace=True)

        # Shortcut
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 1,
                          stride=stride, bias=False),
                nn.BatchNorm2d(out_channels)
            )

    def forward(self, x):
        identity = self.shortcut(x)

        out = self.relu(self.bn1(self.conv1(x)))
        out = self.relu(self.bn2(self.conv2(out)))
        out = self.bn3(self.conv3(out))
        out += identity
        out = self.relu(out)

        return out

# Parameter comparison
basic = ResidualBlock(256, 256)
bottleneck = BottleneckBlock(256, 64)
print(f"BasicBlock parameters: "
      f"{sum(p.numel() for p in basic.parameters()):,}")
print(f"Bottleneck parameters: "
      f"{sum(p.numel() for p in bottleneck.parameters()):,}")
# Bottleneck is more parameter-efficient
```

### EfficientNet: Compound Scaling

```python
import torch
import torch.nn as nn
import math

class MBConvBlock(nn.Module):
    """Mobile Inverted Bottleneck Convolution (MBConv)

    The fundamental block of EfficientNet.
    1x1 expansion → Depthwise 3x3/5x5 → SE → 1x1 compression + Skip
    """

    def __init__(self, in_ch: int, out_ch: int, kernel_size: int = 3,
                 stride: int = 1, expand_ratio: int = 6,
                 se_ratio: float = 0.25, drop_rate: float = 0.2):
        super().__init__()
        self.use_residual = (stride == 1 and in_ch == out_ch)
        mid_ch = in_ch * expand_ratio

        layers = []

        # 1x1 expansion (only when expand_ratio > 1)
        if expand_ratio != 1:
            layers.extend([
                nn.Conv2d(in_ch, mid_ch, 1, bias=False),
                nn.BatchNorm2d(mid_ch),
                nn.SiLU(inplace=True),  # Swish activation
            ])

        # Depthwise Convolution
        layers.extend([
            nn.Conv2d(mid_ch, mid_ch, kernel_size, stride=stride,
                      padding=kernel_size // 2, groups=mid_ch, bias=False),
            nn.BatchNorm2d(mid_ch),
            nn.SiLU(inplace=True),
        ])

        self.conv = nn.Sequential(*layers)

        # Squeeze-and-Excitation (channel attention mechanism)
        se_ch = max(1, int(in_ch * se_ratio))
        self.se = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(mid_ch, se_ch, 1),
            nn.SiLU(inplace=True),
            nn.Conv2d(se_ch, mid_ch, 1),
            nn.Sigmoid(),
        )

        # 1x1 compression
        self.project = nn.Sequential(
            nn.Conv2d(mid_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
        )

        # Stochastic Depth (training only)
        self.drop_rate = drop_rate

    def forward(self, x):
        identity = x

        out = self.conv(x)
        out = out * self.se(out)   # SE: channel weighting
        out = self.project(out)

        # Stochastic Depth
        if self.use_residual:
            if self.training and self.drop_rate > 0:
                keep_prob = 1 - self.drop_rate
                mask = torch.rand(out.shape[0], 1, 1, 1,
                                  device=out.device) < keep_prob
                out = out * mask / keep_prob
            out = out + identity

        return out

# EfficientNet compound scaling
def efficientnet_scaling(base_width: float, base_depth: float,
                         base_resolution: int, phi: float):
    """Calculate EfficientNet compound scaling coefficients

    alpha^phi * beta^phi * gamma^phi ≈ 2
    (alpha=1.2, beta=1.1, gamma=1.15)
    """
    alpha, beta, gamma = 1.2, 1.1, 1.15

    width_mult = base_width * (alpha ** phi)
    depth_mult = base_depth * (beta ** phi)
    resolution = int(base_resolution * (gamma ** phi))

    print(f"phi={phi:.1f}: width={width_mult:.2f}x, "
          f"depth={depth_mult:.2f}x, resolution={resolution}")
    return width_mult, depth_mult, resolution

# Scaling from B0 to B7
print("=== EfficientNet Scaling ===")
for i in range(8):
    efficientnet_scaling(1.0, 1.0, 224, phi=i)
```

### ConvNeXt: Modern CNN Design

```python
import torch
import torch.nn as nn

class ConvNeXtBlock(nn.Module):
    """ConvNeXt Block — Applying ViT design principles to CNNs

    Design principles:
    1. Depthwise Conv (7x7) — Large kernel for global receptive field
    2. Layer Normalization — Instead of BN
    3. Inverted bottleneck — Expansion ratio 4 (MLP-like structure)
    4. GELU activation — Instead of ReLU
    5. Fewer activations/normalizations — One per block
    """

    def __init__(self, dim: int, drop_path: float = 0.0,
                 layer_scale_init: float = 1e-6):
        super().__init__()

        # Depthwise Conv (7x7, large kernel)
        self.dwconv = nn.Conv2d(dim, dim, kernel_size=7,
                                 padding=3, groups=dim)
        self.norm = nn.LayerNorm(dim, eps=1e-6)

        # Inverted bottleneck MLP (expansion ratio 4x)
        self.pwconv1 = nn.Linear(dim, 4 * dim)
        self.act = nn.GELU()
        self.pwconv2 = nn.Linear(4 * dim, dim)

        # Layer Scale (learnable scaling coefficient)
        self.gamma = nn.Parameter(
            layer_scale_init * torch.ones(dim)
        ) if layer_scale_init > 0 else None

        # DropPath (Stochastic Depth)
        self.drop_path = DropPath(drop_path) if drop_path > 0. else nn.Identity()

    def forward(self, x):
        input = x
        # (B, C, H, W) → Depthwise Conv
        x = self.dwconv(x)
        # (B, C, H, W) → (B, H, W, C) for LayerNorm
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        x = self.pwconv1(x)
        x = self.act(x)
        x = self.pwconv2(x)
        if self.gamma is not None:
            x = self.gamma * x
        x = x.permute(0, 3, 1, 2)  # → (B, C, H, W)

        x = input + self.drop_path(x)
        return x


class DropPath(nn.Module):
    """Stochastic Depth implementation"""

    def __init__(self, drop_prob: float = 0.0):
        super().__init__()
        self.drop_prob = drop_prob

    def forward(self, x):
        if not self.training or self.drop_prob == 0.0:
            return x
        keep_prob = 1 - self.drop_prob
        shape = (x.shape[0],) + (1,) * (x.ndim - 1)
        mask = torch.rand(shape, device=x.device) < keep_prob
        return x * mask / keep_prob
```

### Code Example 4: Transfer Learning Implementation

```python
import torch
import torch.nn as nn
import torchvision.models as models

def create_transfer_model(num_classes: int, freeze_backbone: bool = True):
    """Transfer learning model using pretrained ResNet50"""

    # Load ResNet50 pretrained on ImageNet
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)

    # Freeze backbone weights
    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Replace the final fully connected layer
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(512, num_classes),
    )

    # Parameters of the new layers are trainable
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total:,}")
    print(f"Trainable: {trainable:,} ({trainable/total:.1%})")

    return model

# Usage example
model = create_transfer_model(num_classes=5, freeze_backbone=True)
```

### Progressive Fine-Tuning (Progressive Unfreezing)

```python
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.models as models

class ProgressiveFineTuner:
    """Progressively unfreeze the backbone for fine-tuning

    Phase 1: Train classifier only (high learning rate)
    Phase 2: Unfreeze later layers (moderate learning rate)
    Phase 3: Unfreeze all layers (low learning rate)
    """

    def __init__(self, num_classes: int, device: torch.device):
        self.device = device
        self.model = models.resnet50(
            weights=models.ResNet50_Weights.IMAGENET1K_V2
        ).to(device)

        # Freeze all layers
        for param in self.model.parameters():
            param.requires_grad = False

        # Replace classifier
        in_features = self.model.fc.in_features
        self.model.fc = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        ).to(device)

    def get_layer_groups(self):
        """Split parameters into groups"""
        return {
            "early": list(self.model.conv1.parameters()) +
                     list(self.model.bn1.parameters()) +
                     list(self.model.layer1.parameters()) +
                     list(self.model.layer2.parameters()),
            "late": list(self.model.layer3.parameters()) +
                    list(self.model.layer4.parameters()),
            "head": list(self.model.fc.parameters()),
        }

    def phase1_head_only(self, lr: float = 1e-3):
        """Phase 1: Train classifier only"""
        print("=== Phase 1: Head Only ===")
        optimizer = optim.Adam(self.model.fc.parameters(), lr=lr)
        return optimizer

    def phase2_unfreeze_late(self, lr_head: float = 1e-3,
                              lr_late: float = 1e-4):
        """Phase 2: Unfreeze later layers"""
        print("=== Phase 2: Unfreeze Late Layers ===")
        groups = self.get_layer_groups()

        for param in groups["late"]:
            param.requires_grad = True

        optimizer = optim.Adam([
            {"params": groups["late"], "lr": lr_late},
            {"params": groups["head"], "lr": lr_head},
        ])
        return optimizer

    def phase3_unfreeze_all(self, lr_early: float = 1e-5,
                             lr_late: float = 1e-4,
                             lr_head: float = 5e-4):
        """Phase 3: Unfreeze all layers (discriminative learning rates)"""
        print("=== Phase 3: Unfreeze All ===")
        groups = self.get_layer_groups()

        for param in groups["early"]:
            param.requires_grad = True

        optimizer = optim.Adam([
            {"params": groups["early"], "lr": lr_early},
            {"params": groups["late"], "lr": lr_late},
            {"params": groups["head"], "lr": lr_head},
        ])
        return optimizer

    def count_trainable(self):
        """Check trainable parameters"""
        trainable = sum(p.numel() for p in self.model.parameters()
                       if p.requires_grad)
        total = sum(p.numel() for p in self.model.parameters())
        print(f"Trainable: {trainable:,} / {total:,} "
              f"({trainable/total:.1%})")

# Usage example
# device = torch.device("cuda")
# finetuner = ProgressiveFineTuner(num_classes=5, device=device)
#
# # Phase 1: 5 epochs
# opt = finetuner.phase1_head_only(lr=1e-3)
# finetuner.count_trainable()
# # → Trainable: 1,050,117 / 24,607,813 (4.3%)
#
# # Phase 2: 5 epochs
# opt = finetuner.phase2_unfreeze_late(lr_head=5e-4, lr_late=1e-4)
# finetuner.count_trainable()
# # → Trainable: 15,545,861 / 24,607,813 (63.2%)
#
# # Phase 3: 10 epochs
# opt = finetuner.phase3_unfreeze_all()
# finetuner.count_trainable()
# # → Trainable: 24,607,813 / 24,607,813 (100.0%)
```

### Code Example 5: Data Augmentation Pipeline

```python
import torchvision.transforms as T

def get_transforms(image_size: int = 224, is_train: bool = True):
    """Build data augmentation for training/testing"""

    if is_train:
        return T.Compose([
            T.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
            T.RandomHorizontalFlip(p=0.5),
            T.RandomRotation(degrees=15),
            T.ColorJitter(brightness=0.2, contrast=0.2,
                          saturation=0.2, hue=0.1),
            T.RandomAffine(degrees=0, translate=(0.1, 0.1)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]),
            T.RandomErasing(p=0.2),
        ])
    else:
        return T.Compose([
            T.Resize(int(image_size * 1.14)),
            T.CenterCrop(image_size),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]),
        ])

# Usage example
train_transform = get_transforms(224, is_train=True)
test_transform = get_transforms(224, is_train=False)
```

### Advanced Data Augmentation: Albumentations

```python
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np

def get_albumentations_transform(image_size: int = 224,
                                  is_train: bool = True):
    """Advanced data augmentation pipeline using Albumentations

    Differences from torchvision.transforms:
    - More augmentation methods (Cutout, GridDistortion, etc.)
    - Faster (OpenCV/NumPy-based)
    - Integration with bounding boxes and segmentation masks
    """
    if is_train:
        return A.Compose([
            A.RandomResizedCrop(height=image_size, width=image_size,
                                scale=(0.7, 1.0)),
            A.HorizontalFlip(p=0.5),

            # Color transforms
            A.OneOf([
                A.ColorJitter(brightness=0.2, contrast=0.2,
                              saturation=0.2, hue=0.1),
                A.HueSaturationValue(hue_shift_limit=20,
                                      sat_shift_limit=30,
                                      val_shift_limit=20),
                A.RandomBrightnessContrast(brightness_limit=0.2,
                                            contrast_limit=0.2),
            ], p=0.8),

            # Geometric transforms
            A.OneOf([
                A.ShiftScaleRotate(shift_limit=0.1, scale_limit=0.15,
                                    rotate_limit=15),
                A.Affine(shear=(-10, 10)),
                A.Perspective(scale=(0.05, 0.1)),
            ], p=0.5),

            # Noise and blur
            A.OneOf([
                A.GaussNoise(var_limit=(10, 50)),
                A.GaussianBlur(blur_limit=(3, 5)),
                A.MotionBlur(blur_limit=5),
            ], p=0.3),

            # Cutout variants
            A.OneOf([
                A.CoarseDropout(max_holes=8, max_height=image_size // 8,
                                max_width=image_size // 8,
                                fill_value=0),
                A.GridDropout(ratio=0.3, random_offset=True),
            ], p=0.3),

            # Normalization
            A.Normalize(mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ])
    else:
        return A.Compose([
            A.Resize(int(image_size * 1.14), int(image_size * 1.14)),
            A.CenterCrop(image_size, image_size),
            A.Normalize(mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ])

# Mixup / CutMix implementation
class MixupCutmix:
    """Data augmentation that dynamically switches between Mixup and CutMix"""

    def __init__(self, mixup_alpha: float = 0.2,
                 cutmix_alpha: float = 1.0,
                 mixup_prob: float = 0.5):
        self.mixup_alpha = mixup_alpha
        self.cutmix_alpha = cutmix_alpha
        self.mixup_prob = mixup_prob

    def __call__(self, images: 'torch.Tensor',
                 labels: 'torch.Tensor') -> tuple:
        """Apply Mixup/CutMix to a batch"""
        import torch

        batch_size = images.size(0)
        indices = torch.randperm(batch_size, device=images.device)

        if np.random.rand() < self.mixup_prob:
            # Mixup: Linear interpolation of images and labels
            lam = np.random.beta(self.mixup_alpha, self.mixup_alpha)
            mixed_images = lam * images + (1 - lam) * images[indices]
            return mixed_images, labels, labels[indices], lam
        else:
            # CutMix: Replace part of the image with another image
            lam = np.random.beta(self.cutmix_alpha, self.cutmix_alpha)
            _, _, H, W = images.shape

            # Calculate cut region coordinates
            cut_ratio = np.sqrt(1.0 - lam)
            cut_h = int(H * cut_ratio)
            cut_w = int(W * cut_ratio)
            cy = np.random.randint(H)
            cx = np.random.randint(W)

            y1 = np.clip(cy - cut_h // 2, 0, H)
            y2 = np.clip(cy + cut_h // 2, 0, H)
            x1 = np.clip(cx - cut_w // 2, 0, W)
            x2 = np.clip(cx + cut_w // 2, 0, W)

            mixed_images = images.clone()
            mixed_images[:, :, y1:y2, x1:x2] = images[indices, :, y1:y2, x1:x2]

            # Adjust label ratio by area ratio
            lam = 1 - (y2 - y1) * (x2 - x1) / (H * W)
            return mixed_images, labels, labels[indices], lam

# Usage example
# mixup_cutmix = MixupCutmix()
# mixed_images, labels_a, labels_b, lam = mixup_cutmix(images, labels)
# loss = lam * criterion(outputs, labels_a) + (1-lam) * criterion(outputs, labels_b)
```

---

## 3. Model Visualization and Interpretation

### Grad-CAM Implementation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class GradCAM:
    """Grad-CAM: Gradient-weighted Class Activation Mapping

    Visualizes which regions the CNN focuses on when making decisions.
    Weights the feature maps of the last convolutional layer by the
    average gradient of each channel and sums them.
    """

    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register hooks
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor: torch.Tensor,
                 target_class: int = None) -> np.ndarray:
        """Generate a Grad-CAM heatmap"""
        self.model.eval()

        # Forward pass
        output = self.model(input_tensor)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        # Compute gradients for the target class
        self.model.zero_grad()
        one_hot = torch.zeros_like(output)
        one_hot[0, target_class] = 1
        output.backward(gradient=one_hot, retain_graph=True)

        # Average gradient per channel (weights)
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)

        # Weighted sum + ReLU
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)

        # Resize to input dimensions and normalize
        cam = F.interpolate(cam, size=input_tensor.shape[2:],
                            mode='bilinear', align_corners=False)
        cam = cam.squeeze().cpu().numpy()

        # Normalize to 0-1
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        return cam

    def generate_batch(self, input_batch: torch.Tensor,
                       target_classes: list = None) -> list:
        """Generate Grad-CAM for the entire batch"""
        results = []
        for i in range(input_batch.size(0)):
            target = target_classes[i] if target_classes else None
            cam = self.generate(input_batch[i:i+1], target)
            results.append(cam)
        return results


def visualize_gradcam(image: np.ndarray, cam: np.ndarray,
                       alpha: float = 0.5):
    """Overlay a Grad-CAM heatmap on an image"""
    import matplotlib.pyplot as plt
    import matplotlib.cm as cm

    # Generate heatmap
    heatmap = cm.jet(cam)[:, :, :3]  # RGB only
    heatmap = (heatmap * 255).astype(np.uint8)

    # Denormalize original image (ImageNet)
    if image.max() <= 1.0:
        image = (image * 255).astype(np.uint8)

    # Overlay
    overlay = (alpha * heatmap + (1 - alpha) * image).astype(np.uint8)

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    axes[0].imshow(image)
    axes[0].set_title("Original")
    axes[0].axis("off")

    axes[1].imshow(cam, cmap="jet")
    axes[1].set_title("Grad-CAM")
    axes[1].axis("off")

    axes[2].imshow(overlay)
    axes[2].set_title("Overlay")
    axes[2].axis("off")

    plt.tight_layout()
    plt.savefig("gradcam_result.png", dpi=150, bbox_inches="tight")
    plt.show()

# Usage example
# model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
# gradcam = GradCAM(model, model.layer4[-1])
#
# input_tensor = preprocess(image).unsqueeze(0)
# cam = gradcam.generate(input_tensor, target_class=281)  # 281="tabby cat"
# visualize_gradcam(original_image, cam)
```

### Filter (Kernel) Visualization

```python
import torch
import torchvision.models as models
import matplotlib.pyplot as plt
import numpy as np

def visualize_filters(model: torch.nn.Module, layer_name: str = "conv1"):
    """Visualize filters of a convolution layer"""
    # Get filters from the first convolution layer
    layer = dict(model.named_modules())[layer_name]
    filters = layer.weight.data.cpu().numpy()

    n_filters = min(filters.shape[0], 64)
    n_cols = 8
    n_rows = (n_filters + n_cols - 1) // n_cols

    fig, axes = plt.subplots(n_rows, n_cols, figsize=(n_cols * 1.5, n_rows * 1.5))

    for i in range(n_rows * n_cols):
        ax = axes[i // n_cols, i % n_cols]
        if i < n_filters:
            # For 3-channel (RGB) filters
            f = filters[i]
            if f.shape[0] == 3:
                # Normalize to 0-1 for display
                f = (f - f.min()) / (f.max() - f.min() + 1e-8)
                ax.imshow(f.transpose(1, 2, 0))
            else:
                ax.imshow(f[0], cmap="gray")
        ax.axis("off")

    plt.suptitle(f"Filters: {layer_name} ({filters.shape})", fontsize=14)
    plt.tight_layout()
    plt.savefig("filter_visualization.png", dpi=150)
    plt.show()


def visualize_feature_maps(model: torch.nn.Module,
                            input_tensor: torch.Tensor,
                            layer_names: list[str]):
    """Visualize feature maps of intermediate layers"""
    activations = {}

    def hook_fn(name):
        def hook(module, input, output):
            activations[name] = output.detach().cpu()
        return hook

    # Register hooks
    handles = []
    for name, module in model.named_modules():
        if name in layer_names:
            h = module.register_forward_hook(hook_fn(name))
            handles.append(h)

    # Forward pass
    model.eval()
    with torch.no_grad():
        model(input_tensor)

    # Remove hooks
    for h in handles:
        h.remove()

    # Visualization
    for name, feat in activations.items():
        feat = feat[0]  # First element of the batch
        n_channels = min(feat.shape[0], 16)

        fig, axes = plt.subplots(2, 8, figsize=(16, 4))
        fig.suptitle(f"Feature Maps: {name} "
                     f"(shape={tuple(feat.shape)})", fontsize=12)

        for i in range(16):
            ax = axes[i // 8, i % 8]
            if i < n_channels:
                ax.imshow(feat[i].numpy(), cmap="viridis")
            ax.axis("off")

        plt.tight_layout()
        plt.savefig(f"feature_map_{name.replace('.', '_')}.png", dpi=150)
        plt.show()

# Usage example
# model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
# visualize_filters(model, "conv1")
# visualize_feature_maps(model, input_tensor,
#                        ["layer1.0.conv1", "layer2.0.conv1",
#                         "layer3.0.conv1", "layer4.0.conv1"])
```

### t-SNE Feature Space Visualization

```python
import torch
import numpy as np
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt

def extract_features(model: torch.nn.Module, dataloader,
                      device: torch.device,
                      max_samples: int = 2000) -> tuple:
    """Extract intermediate features from a CNN (just before the final FC layer)"""
    model.eval()
    features_list = []
    labels_list = []

    # Hook for feature extraction
    features_out = []
    def hook_fn(module, input, output):
        features_out.append(input[0].detach().cpu())

    # Register hook on the final FC layer
    if hasattr(model, 'fc'):
        handle = model.fc.register_forward_hook(hook_fn)
    elif hasattr(model, 'classifier'):
        handle = model.classifier.register_forward_hook(hook_fn)

    total = 0
    with torch.no_grad():
        for images, labels in dataloader:
            if total >= max_samples:
                break
            images = images.to(device)
            model(images)
            labels_list.append(labels.numpy())
            total += images.size(0)

    handle.remove()

    features = torch.cat(features_out, dim=0)[:max_samples].numpy()
    labels = np.concatenate(labels_list)[:max_samples]

    return features, labels


def plot_tsne(features: np.ndarray, labels: np.ndarray,
               class_names: list = None, perplexity: int = 30):
    """Compress feature space to 2D with t-SNE and visualize"""
    print(f"Running t-SNE... (samples={features.shape[0]}, "
          f"dims={features.shape[1]})")

    tsne = TSNE(n_components=2, perplexity=perplexity,
                random_state=42, n_iter=1000)
    embeddings = tsne.fit_transform(features)

    plt.figure(figsize=(12, 10))
    unique_labels = np.unique(labels)

    for label in unique_labels:
        mask = labels == label
        name = class_names[label] if class_names else str(label)
        plt.scatter(embeddings[mask, 0], embeddings[mask, 1],
                    label=name, alpha=0.6, s=15)

    plt.legend(bbox_to_anchor=(1.05, 1), loc="upper left")
    plt.title("t-SNE Visualization of CNN Features")
    plt.xlabel("t-SNE 1")
    plt.ylabel("t-SNE 2")
    plt.tight_layout()
    plt.savefig("tsne_features.png", dpi=150, bbox_inches="tight")
    plt.show()

# Usage example
# features, labels = extract_features(model, test_loader, device)
# plot_tsne(features, labels, class_names=["cat", "dog", "bird", ...])
```

---

## 4. Object Detection and Segmentation

### Object Detection Basics: Anchor-Based vs Anchor-Free

```
Object Detection Approaches:

1. Two-Stage Detector (R-CNN family)
   Input → Backbone → RPN (Region Proposal) → ROI Pooling → Classification + Regression
   High accuracy but slow (Faster R-CNN, Mask R-CNN)

2. One-Stage Detector
   Input → Backbone → Direct Classification + Regression
   Fast but slightly less accurate (YOLO, SSD, RetinaNet)

3. Anchor-Free
   Input → Backbone → Center Point + Size Prediction
   Simple and fast (CenterNet, FCOS)

     ┌──────────┐    ┌──────────┐    ┌────────────────────┐
     │          │    │ Feature  │    │  Detection Head    │
     │  Input   │───>│ Pyramid  │───>│ (Classification +  │
     │  Image   │    │ Network  │    │  Regression)       │
     │          │    │ (FPN)    │    │ cls: [B,A,C]       │
     └──────────┘    └──────────┘    │ box: [B,A,4]       │
                                      └────────────────────┘
```

### Object Detection with YOLOv8

```python
from ultralytics import YOLO
import cv2
import numpy as np
from pathlib import Path

class ObjectDetector:
    """YOLOv8-based object detector"""

    def __init__(self, model_name: str = "yolov8n.pt"):
        """
        Model size options:
        - yolov8n: Nano (3.2M params) - Fastest, for edge devices
        - yolov8s: Small (11.2M) - Balanced
        - yolov8m: Medium (25.9M) - Accuracy-focused
        - yolov8l: Large (43.7M) - High accuracy
        - yolov8x: XLarge (68.2M) - Highest accuracy
        """
        self.model = YOLO(model_name)

    def detect(self, image_path: str, conf_threshold: float = 0.5):
        """Detect objects in an image"""
        results = self.model(image_path, conf=conf_threshold)

        detections = []
        for result in results:
            for box in result.boxes:
                detection = {
                    "class": result.names[int(box.cls)],
                    "confidence": float(box.conf),
                    "bbox": box.xyxy[0].tolist(),  # [x1, y1, x2, y2]
                }
                detections.append(detection)

        return detections

    def train_custom(self, data_yaml: str, epochs: int = 100,
                      imgsz: int = 640, batch: int = 16):
        """Train on a custom dataset"""
        results = self.model.train(
            data=data_yaml,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            optimizer="AdamW",
            lr0=0.001,
            lrf=0.01,  # Final learning rate = lr0 * lrf
            warmup_epochs=3,
            augment=True,
            mosaic=1.0,        # Mosaic augmentation
            mixup=0.1,         # Mixup augmentation
            copy_paste=0.1,    # Copy-Paste augmentation
            patience=20,       # Early stopping
            save_period=10,    # Checkpoint save interval
        )
        return results

    def export_onnx(self, output_path: str = "model.onnx",
                     imgsz: int = 640):
        """Export to ONNX format (inference optimization)"""
        self.model.export(
            format="onnx",
            imgsz=imgsz,
            dynamic=True,     # Dynamic batch size
            simplify=True,    # Graph optimization
            opset=17,
        )
        print(f"Exported to {output_path}")

# Dataset configuration file example (data.yaml)
DATA_YAML_TEMPLATE = """
path: /path/to/dataset
train: images/train
val: images/val
test: images/test

names:
  0: person
  1: car
  2: bicycle
  3: dog
  4: cat

# Annotation format: YOLO (class x_center y_center width height)
# All values are normalized relative coordinates in 0-1 range
"""

# Usage example
# detector = ObjectDetector("yolov8m.pt")
# detections = detector.detect("photo.jpg", conf_threshold=0.5)
# for d in detections:
#     print(f"{d['class']}: {d['confidence']:.2f} at {d['bbox']}")
```

### Semantic Segmentation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class UNet(nn.Module):
    """U-Net: A classic architecture for semantic segmentation

    Encoder-decoder structure + skip connections
    Widely used in medical imaging and remote sensing
    """

    def __init__(self, in_channels: int = 3, num_classes: int = 21,
                 base_filters: int = 64):
        super().__init__()

        # Encoder (downsampling path)
        self.enc1 = self._double_conv(in_channels, base_filters)
        self.enc2 = self._double_conv(base_filters, base_filters * 2)
        self.enc3 = self._double_conv(base_filters * 2, base_filters * 4)
        self.enc4 = self._double_conv(base_filters * 4, base_filters * 8)

        # Bottleneck
        self.bottleneck = self._double_conv(base_filters * 8,
                                             base_filters * 16)

        # Decoder (upsampling path)
        self.up4 = nn.ConvTranspose2d(base_filters * 16,
                                       base_filters * 8, 2, stride=2)
        self.dec4 = self._double_conv(base_filters * 16, base_filters * 8)

        self.up3 = nn.ConvTranspose2d(base_filters * 8,
                                       base_filters * 4, 2, stride=2)
        self.dec3 = self._double_conv(base_filters * 8, base_filters * 4)

        self.up2 = nn.ConvTranspose2d(base_filters * 4,
                                       base_filters * 2, 2, stride=2)
        self.dec2 = self._double_conv(base_filters * 4, base_filters * 2)

        self.up1 = nn.ConvTranspose2d(base_filters * 2,
                                       base_filters, 2, stride=2)
        self.dec1 = self._double_conv(base_filters * 2, base_filters)

        # Output layer
        self.out_conv = nn.Conv2d(base_filters, num_classes, 1)

        self.pool = nn.MaxPool2d(2, 2)

    def _double_conv(self, in_ch: int, out_ch: int):
        """Conv → BN → ReLU × 2"""
        return nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        # Encoder
        e1 = self.enc1(x)          # (B, 64, H, W)
        e2 = self.enc2(self.pool(e1))  # (B, 128, H/2, W/2)
        e3 = self.enc3(self.pool(e2))  # (B, 256, H/4, W/4)
        e4 = self.enc4(self.pool(e3))  # (B, 512, H/8, W/8)

        # Bottleneck
        b = self.bottleneck(self.pool(e4))  # (B, 1024, H/16, W/16)

        # Decoder + skip connections
        d4 = self.dec4(torch.cat([self.up4(b), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))

        return self.out_conv(d1)  # (B, num_classes, H, W)


class DiceLoss(nn.Module):
    """Dice Loss: Loss function for segmentation

    A loss based on IoU (Intersection over Union).
    Robust to class imbalance.
    """

    def __init__(self, smooth: float = 1.0):
        super().__init__()
        self.smooth = smooth

    def forward(self, pred: torch.Tensor, target: torch.Tensor):
        """
        pred: (B, C, H, W) - logits
        target: (B, H, W) - class indices
        """
        num_classes = pred.shape[1]

        # Convert to probabilities with softmax
        pred_soft = F.softmax(pred, dim=1)

        # One-hot encode target
        target_onehot = F.one_hot(target.long(),
                                   num_classes).permute(0, 3, 1, 2).float()

        # Dice coefficient per class
        intersection = (pred_soft * target_onehot).sum(dim=(2, 3))
        union = pred_soft.sum(dim=(2, 3)) + target_onehot.sum(dim=(2, 3))

        dice = (2.0 * intersection + self.smooth) / (union + self.smooth)

        return 1.0 - dice.mean()


class CombinedSegLoss(nn.Module):
    """Combined CrossEntropy + Dice loss"""

    def __init__(self, ce_weight: float = 0.5, dice_weight: float = 0.5):
        super().__init__()
        self.ce = nn.CrossEntropyLoss()
        self.dice = DiceLoss()
        self.ce_weight = ce_weight
        self.dice_weight = dice_weight

    def forward(self, pred, target):
        return (self.ce_weight * self.ce(pred, target) +
                self.dice_weight * self.dice(pred, target))

# Model verification
# unet = UNet(in_channels=3, num_classes=21)
# dummy = torch.randn(2, 3, 256, 256)
# output = unet(dummy)
# print(f"Output shape: {output.shape}")  # (2, 21, 256, 256)
# print(f"Number of parameters: {sum(p.numel() for p in unet.parameters()):,}")
```

---

## 5. Model Compression and Inference Optimization

### Knowledge Distillation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class DistillationTrainer:
    """Knowledge Distillation: Transfer knowledge from a large model (Teacher)
    to a small model (Student)

    Loss = alpha * KL(soft_student, soft_teacher) +
           (1 - alpha) * CE(student, hard_labels)
    """

    def __init__(self, teacher: nn.Module, student: nn.Module,
                 temperature: float = 4.0, alpha: float = 0.7,
                 device: torch.device = None):
        self.teacher = teacher.eval()
        self.student = student
        self.temperature = temperature
        self.alpha = alpha
        self.device = device or torch.device("cpu")

        # Freeze Teacher weights
        for param in self.teacher.parameters():
            param.requires_grad = False

    def distillation_loss(self, student_logits: torch.Tensor,
                           teacher_logits: torch.Tensor,
                           labels: torch.Tensor) -> torch.Tensor:
        """Calculate distillation loss"""
        T = self.temperature

        # Soft targets: Softmax with temperature
        soft_student = F.log_softmax(student_logits / T, dim=1)
        soft_teacher = F.softmax(teacher_logits / T, dim=1)

        # KL Divergence (scaled by T^2)
        kl_loss = F.kl_div(soft_student, soft_teacher,
                            reduction="batchmean") * (T * T)

        # Hard label loss
        hard_loss = F.cross_entropy(student_logits, labels)

        # Combined loss
        loss = self.alpha * kl_loss + (1 - self.alpha) * hard_loss
        return loss

    def train_epoch(self, train_loader, optimizer):
        """One epoch of distillation training"""
        self.student.train()
        total_loss = 0

        for images, labels in train_loader:
            images = images.to(self.device)
            labels = labels.to(self.device)

            # Teacher inference (no gradients needed)
            with torch.no_grad():
                teacher_logits = self.teacher(images)

            # Student inference
            student_logits = self.student(images)

            # Distillation loss
            loss = self.distillation_loss(
                student_logits, teacher_logits, labels
            )

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        return total_loss / len(train_loader)

# Usage example
# teacher = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
# student = SimpleCNN(num_classes=1000)  # Lightweight model
#
# distiller = DistillationTrainer(
#     teacher=teacher, student=student,
#     temperature=4.0, alpha=0.7, device=device
# )
#
# for epoch in range(30):
#     loss = distiller.train_epoch(train_loader, optimizer)
#     print(f"Epoch {epoch+1}: Loss={loss:.4f}")
```

### Model Quantization

```python
import torch
import torch.quantization as quant

def quantize_model_dynamic(model: torch.nn.Module):
    """Dynamic quantization (converts weights to INT8 at inference time)

    Features: Minimal accuracy loss, easy to set up
    Targets: Linear, LSTM layers
    """
    quantized = torch.quantization.quantize_dynamic(
        model,
        {torch.nn.Linear, torch.nn.Conv2d},
        dtype=torch.qint8,
    )

    # Size comparison
    original_size = sum(
        p.nelement() * p.element_size()
        for p in model.parameters()
    ) / 1024 / 1024

    quantized_size = sum(
        p.nelement() * p.element_size()
        for p in quantized.parameters()
    ) / 1024 / 1024

    print(f"Original model: {original_size:.1f} MB")
    print(f"After quantization: {quantized_size:.1f} MB")
    print(f"Compression ratio: {original_size / quantized_size:.1f}x")

    return quantized


def quantize_model_static(model: torch.nn.Module,
                           calibration_loader,
                           device: torch.device):
    """Static quantization (determines optimal quantization parameters using calibration data)

    Features: Faster than dynamic quantization, suitable for CNNs
    Steps: Prepare → Calibration → Conversion
    """
    model.eval()
    model.cpu()

    # Quantization configuration
    model.qconfig = quant.get_default_qconfig("x86")  # or "qnnpack" for ARM

    # Preparation (insert observers)
    quant.prepare(model, inplace=True)

    # Calibration (run inference on representative data to collect statistics)
    print("Calibrating...")
    with torch.no_grad():
        for i, (images, _) in enumerate(calibration_loader):
            if i >= 100:  # 100 batches is sufficient
                break
            model(images)

    # Quantization conversion
    quantized = quant.convert(model, inplace=False)

    return quantized


class ModelBenchmark:
    """Benchmark model inference speed"""

    @staticmethod
    def benchmark_latency(model: torch.nn.Module,
                           input_shape: tuple = (1, 3, 224, 224),
                           num_runs: int = 100,
                           device: str = "cpu"):
        """Measure inference latency"""
        import time

        model.eval()
        model = model.to(device)
        dummy = torch.randn(*input_shape).to(device)

        # Warm-up
        for _ in range(10):
            with torch.no_grad():
                model(dummy)

        # Measurement
        if device == "cuda":
            torch.cuda.synchronize()

        times = []
        for _ in range(num_runs):
            start = time.perf_counter()
            with torch.no_grad():
                model(dummy)
            if device == "cuda":
                torch.cuda.synchronize()
            times.append(time.perf_counter() - start)

        times = np.array(times) * 1000  # ms
        print(f"Latency: {times.mean():.2f} ± {times.std():.2f} ms")
        print(f"Throughput: {1000 / times.mean():.1f} FPS")
        return times.mean()

# Usage example
# quantized = quantize_model_dynamic(model)
# ModelBenchmark.benchmark_latency(model)
# ModelBenchmark.benchmark_latency(quantized)
```

### ONNX Export and TensorRT Optimization

```python
import torch
import torch.onnx

def export_to_onnx(model: torch.nn.Module, output_path: str,
                    input_shape: tuple = (1, 3, 224, 224),
                    dynamic_axes: dict = None):
    """Export a PyTorch model to ONNX format"""
    model.eval()
    dummy_input = torch.randn(*input_shape)

    if dynamic_axes is None:
        dynamic_axes = {
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        }

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        opset_version=17,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes=dynamic_axes,
        do_constant_folding=True,  # Constant folding optimization
    )

    # Validate ONNX model
    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"ONNX model exported to {output_path}")

    # File size
    import os
    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Model size: {size_mb:.1f} MB")


def run_onnx_inference(onnx_path: str, input_array):
    """Run inference with ONNX Runtime"""
    import onnxruntime as ort
    import numpy as np

    # Create session (auto-select available providers)
    providers = ort.get_available_providers()
    print(f"Available providers: {providers}")

    session = ort.InferenceSession(onnx_path, providers=providers)

    # Inference
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    result = session.run([output_name],
                          {input_name: input_array.astype(np.float32)})

    return result[0]

# Usage example
# export_to_onnx(model, "resnet50.onnx")
# result = run_onnx_inference("resnet50.onnx", dummy_input.numpy())
```

---

## Comparison Tables

### Evolution of CNN Architectures

| Model | Year | Layers | Parameters | Top-1 Accuracy (ImageNet) | Key Innovation |
|---|---|---|---|---|---|
| LeNet-5 | 1998 | 5 | 60K | - | First CNN |
| AlexNet | 2012 | 8 | 61M | 63.3% | ReLU, Dropout, GPU training |
| VGG-16 | 2014 | 16 | 138M | 71.5% | Deep stacking of 3x3 kernels |
| GoogLeNet | 2014 | 22 | 6.8M | 74.8% | Inception module |
| ResNet-50 | 2015 | 50 | 25M | 76.1% | Residual connections (Skip Connection) |
| ResNeXt-50 | 2017 | 50 | 25M | 77.8% | Group convolution |
| SENet-154 | 2017 | 154 | 115M | 81.3% | Channel attention mechanism (SE) |
| EfficientNet-B0 | 2019 | - | 5.3M | 77.1% | Compound scaling |
| EfficientNet-B7 | 2019 | - | 66M | 84.3% | Compound scaling (max) |
| ViT-B/16 | 2020 | 12 | 86M | 77.9% | Pure Transformer |
| ConvNeXt-T | 2022 | - | 28M | 82.1% | Modern CNN design |
| ConvNeXt-L | 2022 | - | 198M | 84.3% | Modern CNN design (large) |

### Types of Convolution

| Convolution | Parameters | Computation | Use Case | Feature |
|---|---|---|---|---|
| Standard (3x3) | C_in × C_out × 9 | O(H×W×C_in×C_out×9) | General purpose | Full cross-channel connections |
| 1x1 | C_in × C_out | O(H×W×C_in×C_out) | Channel mixing | Dimension adjustment |
| Depthwise | C × 9 | O(H×W×C×9) | Lightweight | Independent per channel |
| Separable | C×9 + C×C_out | Significantly reduced | Mobile | Depth+Pointwise |
| Dilated | C_in × C_out × 9 | Equivalent | Segmentation | Expanding receptive field |
| Transposed | C_in × C_out × 9 | Equivalent | Upsampling | Decoder |
| Deformable | C_in × C_out × 9 + offsets | Slightly increased | Object detection | Adaptive receptive field |
| Group Conv | C_in × C_out × 9 / G | Reduced | Efficiency | Channel grouping |

### Model Recommendation Guide by Use Case

| Use Case | Recommended Model | Reason |
|---|---|---|
| Edge/Mobile | MobileNetV3, EfficientNet-B0 | Low computation, small memory |
| General image classification | ResNet-50 + transfer learning | Balance of stability and versatility |
| High-accuracy image classification | EfficientNet-B4 to B7, ConvNeXt | Scaled accuracy |
| Object detection | YOLOv8, Faster R-CNN | Real-time / high accuracy |
| Semantic segmentation | U-Net, DeepLabV3+ | Pixel-level classification |
| Instance segmentation | Mask R-CNN, YOLACT | Individual object separation |
| Medical imaging | U-Net + Attention | Small dataset support |
| Image generation | GAN, Diffusion Model | High-quality image synthesis |
| Super-resolution | ESRGAN, SwinIR | Resolution enhancement |

### Comparison of Normalization Methods

| Method | Normalization Dims | Batch-Dependent | Main Use | Notes |
|---|---|---|---|---|
| Batch Norm | (N, H, W) | Yes | CNNs in general | Effective with large batch sizes |
| Layer Norm | (C, H, W) | No | Transformer, NLP | Independent of batch size |
| Instance Norm | (H, W) | No | Style transfer | Independent per sample and channel |
| Group Norm | (C/G, H, W) | No | Small-batch CNNs | Alternative to BN, batch-size independent |

---

## Anti-Patterns

### Anti-Pattern 1: Fine-tuning all layers from the start in transfer learning

```python
# BAD: Training all parameters with limited data → destroys pretrained knowledge
model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
model.fc = nn.Linear(2048, 5)
optimizer = optim.Adam(model.parameters(), lr=0.001)  # Same lr for all parameters

# GOOD: Progressive fine-tuning
# Phase 1: Freeze backbone, train classifier only
for param in model.parameters():
    param.requires_grad = False
model.fc = nn.Linear(2048, 5)
optimizer = optim.Adam(model.fc.parameters(), lr=0.001)
# ... Phase 1 training ...

# Phase 2: Unfreeze backbone, fine-tune the whole model with low learning rate
for param in model.parameters():
    param.requires_grad = True
optimizer = optim.Adam([
    {"params": model.layer4.parameters(), "lr": 1e-4},
    {"params": model.fc.parameters(), "lr": 1e-3},
], lr=1e-5)  # Even lower learning rate for shallow layers
```

### Anti-Pattern 2: Image classification without data augmentation

```python
# BAD: No augmentation → overfitting with limited data
transform = T.Compose([T.Resize(224), T.ToTensor()])

# GOOD: Apply augmentation appropriate for the task
# However, inappropriate augmentation can also be harmful:
# - 180-degree rotation for digit recognition → can't distinguish 6 and 9
# - Excessive color transforms for medical images → diagnostic information is lost
```

### Anti-Pattern 3: Not calling model.eval() during inference

```python
# BAD: Inference while still in train mode
# → BatchNorm uses mini-batch statistics, results become unstable
# → Dropout remains active, outputs vary randomly
predictions = model(test_images)

# GOOD: Always switch to eval mode for inference
model.eval()
with torch.no_grad():  # Gradient computation is also unnecessary
    predictions = model(test_images)

# Switch back to train mode when resuming training
model.train()
```

### Anti-Pattern 4: Input image normalization mismatch

```python
# BAD: Passing unnormalized input to a pretrained model
# ImageNet pretrained models expect input normalized with
# mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
transform = T.Compose([
    T.Resize(224),
    T.ToTensor(),  # Converts to 0-1 but doesn't normalize!
])

# GOOD: Apply the same normalization as during pretraining
transform = T.Compose([
    T.Resize(256),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])
```

### Anti-Pattern 5: GPU memory leak

```python
# BAD: Tensors accumulate in GPU memory
all_predictions = []
for images, labels in test_loader:
    images = images.to(device)
    outputs = model(images)
    all_predictions.append(outputs)  # GPU tensors accumulate!

# GOOD: Convert to CPU/numpy before appending to list
all_predictions = []
model.eval()
with torch.no_grad():
    for images, labels in test_loader:
        images = images.to(device)
        outputs = model(images)
        # Move to CPU and convert to numpy
        all_predictions.append(outputs.cpu().numpy())

# Even better: Concatenate with torch.cat
all_outputs = []
with torch.no_grad():
    for images, _ in test_loader:
        outputs = model(images.to(device))
        all_outputs.append(outputs.cpu())
all_outputs = torch.cat(all_outputs, dim=0)
```

---

## FAQ

### Q1: Should I use CNN or ViT (Vision Transformer)?

**A:** With limited data (thousands to tens of thousands of images), CNN (especially ResNet + transfer learning) is more stable. With large-scale data (millions of images or more), ViT has an advantage. ConvNeXt, introduced in 2022, modernized CNN design to achieve performance equal to or better than ViT. In practice, ResNet/EfficientNet + transfer learning is the most versatile choice.

Decision criteria summary:

| Condition | Recommendation | Reason |
|---|---|---|
| Data < 10K images | ResNet + transfer learning | CNN's inductive bias is advantageous |
| Data 10K to 1M images | EfficientNet or ConvNeXt | Efficient scaling |
| Data > 1M images | ViT or DeiT | Performance with large-scale data |
| Real-time inference | MobileNetV3 or YOLOv8 | Latency optimization |
| Maximum accuracy needed | ConvNeXt-L or ViT-L | Latest large-scale models |

### Q2: Why does Batch Normalization work?

**A:** (1) Mitigates internal covariate shift (stabilizes the input distribution at each layer), (2) Regularization effect (noise from mini-batch statistics), (3) Allows larger learning rates (gradient magnitudes are stabilized). During inference, the running average from training is used instead of batch statistics, so calling `model.eval()` is essential.

Notes:
- When batch size is small (< 16), Group Norm or Layer Norm tends to be more stable
- When inference batch size is 1, BN's running_mean and running_var are used
- In distributed training, SyncBatchNorm is needed to synchronize statistics across all GPUs

### Q3: What should I do when GPU memory is insufficient?

**A:** Try the following in order of priority:

1. **Reduce batch size** — The simplest approach. However, too small can make training unstable
2. **Mixed precision training (AMP)** — Use FP16 with `torch.cuda.amp`. Reduces memory by ~40%
3. **Gradient accumulation** — Run forward pass with small batches multiple times, accumulate gradients, then update
4. **Reduce image size** — e.g., 224 to 160. Consult accuracy trade-offs
5. **Use a lighter model** — Switch to EfficientNet-B0 or MobileNetV3
6. **Gradient Checkpointing** — Reduces memory (increases computation time)

```python
# Gradient Checkpointing example
from torch.utils.checkpoint import checkpoint

class MemEfficientResNet(nn.Module):
    def forward(self, x):
        # Only checkpoint layer3 and layer4
        x = self.layer1(x)
        x = self.layer2(x)
        x = checkpoint(self.layer3, x, use_reentrant=False)
        x = checkpoint(self.layer4, x, use_reentrant=False)
        return self.fc(self.avgpool(x).flatten(1))
```

### Q4: How to debug when training doesn't converge?

**A:** Check the following items in order:

1. **Verify data**: Visualize that input images and labels are correctly paired
2. **Verify normalization**: Check that the input mean/standard deviation is appropriate (near 0)
3. **Learning rate**: Too large causes loss oscillation; too small causes slow convergence. Start with lr=1e-3
4. **Loss function**: Verify CrossEntropy for classification, MSE/MAE for regression
5. **Overfitting check**: Can the model fully fit a small subset (1 batch)?
6. **Gradient check**: Is gradient norm becoming 0 or NaN?
7. **Weight initialization**: Is Kaiming initialization being used?

```python
# Debug utility: Monitor gradient and weight statistics
def check_gradients(model):
    for name, param in model.named_parameters():
        if param.grad is not None:
            grad_norm = param.grad.norm().item()
            weight_norm = param.data.norm().item()
            ratio = grad_norm / (weight_norm + 1e-8)
            if grad_norm == 0:
                print(f"[WARNING] {name}: gradient is zero!")
            elif ratio > 100:
                print(f"[WARNING] {name}: gradient/weight ratio = {ratio:.1f}")
```

### Q5: How to optimize CNN inference speed?

**A:** Apply optimizations progressively:

| Method | Speed Improvement | Accuracy Loss | Implementation Difficulty |
|---|---|---|---|
| torch.no_grad() | 1.2-1.5x | None | Easy |
| model.eval() | 1.1x | None | Easy |
| TorchScript (JIT) | 1.2-1.5x | None | Medium |
| ONNX Runtime | 1.5-2x | None | Medium |
| TensorRT (FP16) | 2-4x | Minimal | Hard |
| INT8 Quantization | 2-4x | Small to medium | Medium |
| Knowledge Distillation | Model-dependent | Small | Medium |
| Pruning | 1.5-3x | Small to medium | Hard |

### Q6: What to do when my dataset is small (a few hundred images)?

**A:** Combine the following methods:

1. **Transfer learning**: Use an ImageNet pretrained model and train only the final layers
2. **Strong data augmentation**: Apply diverse transforms with Albumentations
3. **Few-shot Learning**: Use Siamese Networks or Prototypical Networks
4. **Synthetic data generation**: Augment data with image generation models (Stable Diffusion, etc.)
5. **Self-supervised Pre-training**: Pre-train with MAE, SimCLR, etc. then fine-tune
6. **Cross-validation**: Use K-fold CV to make the most of all data
7. **Label Smoothing**: Regularization effect to suppress overfitting

```python
# Label Smoothing example
criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
# target [0, 0, 1, 0, 0] → [0.02, 0.02, 0.92, 0.02, 0.02]
# Suppresses overconfidence (100% certainty) and improves generalization
```

---

## Summary

| Topic | Key Points |
|---|---|
| Convolution | Extracts local features with kernels. Efficient through parameter sharing |
| Pooling | Reduces spatial resolution to lower computation and mitigate overfitting |
| Residual connections | Solves vanishing gradients in deep networks (ResNet) |
| Transfer learning | Fine-tune pretrained models. Effective with limited data |
| Data augmentation | Increases training diversity to improve generalization |
| Compound scaling | Simultaneously scale width, depth, and resolution (EfficientNet) |
| Visualization | Understand model decisions via Grad-CAM and filter visualization |
| Compression | Speed up inference with quantization, distillation, and pruning |
| Object detection | One-stage (YOLO) and two-stage (Faster R-CNN) approaches |
| Segmentation | U-Net's encoder-decoder structure is the standard |

---

## Next Guides to Read

- [02-rnn-transformer.md](./02-rnn-transformer.md) — RNN/Transformer for sequential data processing
- [../03-applied/01-computer-vision.md](../03-applied/01-computer-vision.md) — Object detection, segmentation

---

## References

1. **Kaiming He et al.** "Deep Residual Learning for Image Recognition" CVPR 2016
2. **Alexey Dosovitskiy et al.** "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale" ICLR 2021
3. **Zhuang Liu et al.** "A ConvNet for the 2020s" CVPR 2022
4. **Mingxing Tan, Quoc Le** "EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks" ICML 2019
5. **Ramprasaath R. Selvaraju et al.** "Grad-CAM: Visual Explanations from Deep Networks" ICCV 2017
6. **Olaf Ronneberger et al.** "U-Net: Convolutional Networks for Biomedical Image Segmentation" MICCAI 2015
7. **CS231n: Convolutional Neural Networks for Visual Recognition** Stanford University — https://cs231n.stanford.edu/
