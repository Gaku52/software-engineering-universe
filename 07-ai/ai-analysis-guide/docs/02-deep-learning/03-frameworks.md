# Frameworks — PyTorch, TensorFlow, JAX

> A practical guide to the design philosophies, code comparisons, and selection criteria of the three major deep learning frameworks

## What You Will Learn in This Chapter

1. **PyTorch** — Define-by-Run, the research standard, ecosystem
2. **TensorFlow/Keras** — Production-oriented, TF Serving, TFLite
3. **JAX** — Functional paradigm, XLA, high-speed execution for scientific computing
4. **ONNX** — Interoperability between frameworks and unified deployment
5. **Practical Framework Selection** — Decision criteria based on project requirements
6. **Advanced Topics** — Distributed training, mixed precision, profiling, custom operators


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of the content in [RNN/Transformer](./02-rnn-transformer.md)

---

## 1. History and Design Philosophies of Frameworks

### Evolution of Deep Learning Frameworks

```
Timeline:
2002  Torch (Lua) — NYU Yann LeCun's lab
2007  Theano — University of Montreal, pioneer of symbolic differentiation
2015  TensorFlow 1.0 — Google Brain, Define-and-Run
      Keras — François Chollet, high-level API
      Caffe — Berkeley, specialized for image recognition
2016  PyTorch 0.1 — Facebook AI Research (FAIR)
      Define-by-Run (derived from Chainer)
2017  JAX early development — Google Research
      MXNet — Apache, recommended by AWS
2018  PyTorch 1.0 — TorchScript introduced
      ONNX 1.0 — Cross-framework interoperability
2019  TensorFlow 2.0 — Eager Execution enabled by default
      Keras integration
2020  PyTorch Lightning 1.0 — Structured framework
      Hugging Face Transformers rapid growth
2021  JAX official release — Flax/Haiku stabilized
      PyTorch market share exceeds 50%
2022  PyTorch 2.0 — torch.compile (TorchDynamo)
2023  Over 90% of research papers use PyTorch
      Gemini developed with JAX
2024  PyTorch 2.x — Compiler optimizations mature
      TensorFlow → Keras 3.0 (multi-backend)
```

### Paradigm Comparison

```
PyTorch (Define-by-Run / Eager):
  ┌────────────────────────────────────────────┐
  │  Python code = computation graph            │
  │  Executed line by line immediately          │
  │  Easy to debug (pdb usable)                │
  │  Dynamic control flow (if/for)             │
  │  JIT optimization later with torch.compile │
  │  Automatic differentiation via autograd    │
  └────────────────────────────────────────────┘

TensorFlow 2.x (Eager + @tf.function):
  ┌────────────────────────────────────────────┐
  │  Default is Eager Execution                 │
  │  Static graph via @tf.function             │
  │  AutoGraph: converts Python control flow   │
  │    to graph                                │
  │  Production deploy with SavedModel         │
  │  Multi-environment with TFLite, TF.js      │
  │  High-performance data pipeline via tf.data│
  └────────────────────────────────────────────┘

JAX (Function Transformations):
  ┌────────────────────────────────────────────┐
  │  NumPy-compatible API + function transforms │
  │  jit: acceleration via XLA compilation     │
  │  grad: automatic differentiation           │
  │    (arbitrary order)                       │
  │  vmap: vectorization (automatic batching)  │
  │  pmap: multi-device parallelism            │
  │  Functional programming (no side effects)  │
  │  Pytree: makes arbitrary data structures   │
  │    differentiable                          │
  └────────────────────────────────────────────┘
```

### Fundamental Differences in Design Philosophy

```python
# === PyTorch: Object-oriented + imperative ===
# State is held in objects
class Model(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer = nn.Linear(10, 5)  # State (weights) held in object

    def forward(self, x):
        return self.layer(x)  # Access state through self

model = Model()
# model.parameters() to access all parameters
# model.state_dict() for serialization

# === TensorFlow/Keras: Declarative + object-oriented ===
# Declarative assembly of layers
model = tf.keras.Sequential([
    tf.keras.layers.Dense(5, input_shape=(10,))
])
# model.compile() to declare training configuration
# model.fit() to run training all at once

# === JAX: Functional ===
# Separate state (parameters) from functions
def model_fn(params, x):
    return jnp.dot(x, params['w']) + params['b']

# Parameters managed externally, functions are pure (no side effects)
params = {'w': jnp.ones((10, 5)), 'b': jnp.zeros(5)}
output = model_fn(params, x)  # Same input → always same output
```

### Code Example 1: Implementing the Same Model in 3 Frameworks

```python
# ===== PyTorch =====
import torch
import torch.nn as nn

class PyTorchMLP(nn.Module):
    def __init__(self, in_features, hidden, out_features):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden, out_features),
        )

    def forward(self, x):
        return self.net(x)

# Training
model = PyTorchMLP(784, 256, 10)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

for epoch in range(10):
    model.train()
    for x_batch, y_batch in train_loader:
        optimizer.zero_grad()
        output = model(x_batch)
        loss = criterion(output, y_batch)
        loss.backward()
        optimizer.step()
```

```python
# ===== TensorFlow / Keras =====
import tensorflow as tf

model = tf.keras.Sequential([
    tf.keras.layers.Dense(256, activation="relu", input_shape=(784,)),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(256, activation="relu"),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(10),
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=["accuracy"],
)

model.fit(x_train, y_train, epochs=10, batch_size=128,
          validation_split=0.1, callbacks=[
              tf.keras.callbacks.EarlyStopping(patience=3),
              tf.keras.callbacks.ReduceLROnPlateau(),
          ])
```

```python
# ===== JAX + Flax =====
import jax
import jax.numpy as jnp
from flax import linen as nn
from flax.training import train_state
import optax

class JaxMLP(nn.Module):
    hidden: int
    out_features: int

    @nn.compact
    def __call__(self, x, training: bool = True):
        x = nn.Dense(self.hidden)(x)
        x = nn.relu(x)
        x = nn.Dropout(rate=0.2, deterministic=not training)(x)
        x = nn.Dense(self.hidden)(x)
        x = nn.relu(x)
        x = nn.Dropout(rate=0.2, deterministic=not training)(x)
        x = nn.Dense(self.out_features)(x)
        return x

model = JaxMLP(hidden=256, out_features=10)
key = jax.random.PRNGKey(42)
params = model.init(key, jnp.ones((1, 784)))

tx = optax.adam(learning_rate=0.001)
state = train_state.TrainState.create(apply_fn=model.apply, params=params, tx=tx)

@jax.jit
def train_step(state, batch):
    def loss_fn(params):
        logits = state.apply_fn(params, batch["image"], training=True,
                                 rngs={"dropout": jax.random.PRNGKey(0)})
        return optax.softmax_cross_entropy_with_integer_labels(
            logits, batch["label"]).mean()

    grads = jax.grad(loss_fn)(state.params)
    state = state.apply_gradients(grads=grads)
    return state
```

---

## 2. PyTorch Ecosystem In-Depth

### PyTorch Core Concepts

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

# === Tensor Operation Basics ===

# Tensor creation and operations
x = torch.randn(3, 4, requires_grad=True)  # Enable gradient computation
y = torch.randn(4, 5)
z = torch.matmul(x, y)  # Matrix multiplication

# GPU transfer
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x_gpu = x.to(device)

# Tensor memory layout
print(f"Stride: {x.stride()}")          # (4, 1) — row-major
print(f"Contiguous: {x.is_contiguous()}")  # True
print(f"Dtype: {x.dtype}")              # torch.float32
print(f"Device: {x.device}")            # cpu or cuda:0

# === How autograd Works ===

# Building computation graph and backpropagation
a = torch.tensor([2.0, 3.0], requires_grad=True)
b = torch.tensor([4.0, 5.0], requires_grad=True)
c = a * b          # Element-wise product
d = c.sum()         # Reduce to scalar
d.backward()        # Backpropagation

print(f"a.grad = {a.grad}")  # tensor([4., 5.]) = b
print(f"b.grad = {b.grad}")  # tensor([2., 3.]) = a

# Controlling gradient computation
with torch.no_grad():
    # No computation graph created inside this block (for inference/parameter updates)
    result = a * 2

# Gradient accumulation and reset
a.grad.zero_()  # Reset gradients to zero (important!)
```

### Custom Dataset and DataLoader

```python
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms
from PIL import Image
import os

class CustomImageDataset(Dataset):
    """Practical custom dataset"""

    def __init__(self, root_dir, split="train", transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        self.class_to_idx = {}

        # Build labels from directory structure
        for idx, class_name in enumerate(sorted(os.listdir(root_dir))):
            class_dir = os.path.join(root_dir, class_name)
            if not os.path.isdir(class_dir):
                continue
            self.class_to_idx[class_name] = idx
            for fname in os.listdir(class_dir):
                if fname.lower().endswith(('.png', '.jpg', '.jpeg')):
                    self.samples.append((
                        os.path.join(class_dir, fname), idx
                    ))

        print(f"[{split}] {len(self.samples)} samples, "
              f"{len(self.class_to_idx)} classes")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        image = Image.open(path).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, label

    def get_class_weights(self):
        """Weight calculation for class imbalance handling"""
        from collections import Counter
        label_counts = Counter(label for _, label in self.samples)
        total = len(self.samples)
        weights = {cls: total / count for cls, count in label_counts.items()}
        sample_weights = [weights[label] for _, label in self.samples]
        return sample_weights


# Data augmentation pipeline
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.2, contrast=0.2,
                           saturation=0.2, hue=0.1),
    transforms.RandomRotation(15),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.1),
])

val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# DataLoader with WeightedRandomSampler (class imbalance handling)
dataset = CustomImageDataset("./data/train", split="train",
                             transform=train_transform)
sample_weights = dataset.get_class_weights()
sampler = WeightedRandomSampler(sample_weights, len(sample_weights))

train_loader = DataLoader(
    dataset,
    batch_size=32,
    sampler=sampler,         # Use sampler instead of shuffle
    num_workers=4,           # Parallel data loading
    pin_memory=True,         # Faster GPU transfer
    prefetch_factor=2,       # Number of batches to prefetch
    persistent_workers=True, # Reuse worker processes
    drop_last=True,          # Exclude the last incomplete batch
)
```

### Code Example 2: Structuring with PyTorch Lightning

```python
import pytorch_lightning as pl
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from torchmetrics import Accuracy, F1Score, AUROC

class LitClassifier(pl.LightningModule):
    """Model structured with PyTorch Lightning"""

    def __init__(self, input_dim=784, hidden_dim=256,
                 num_classes=10, lr=0.001, weight_decay=1e-4):
        super().__init__()
        self.save_hyperparameters()

        self.model = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.BatchNorm1d(hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim // 2, num_classes),
        )

        # Metrics
        self.train_acc = Accuracy(task="multiclass", num_classes=num_classes)
        self.val_acc = Accuracy(task="multiclass", num_classes=num_classes)
        self.val_f1 = F1Score(task="multiclass", num_classes=num_classes,
                              average="macro")

    def forward(self, x):
        return self.model(x.view(x.size(0), -1))

    def training_step(self, batch, batch_idx):
        x, y = batch
        logits = self(x)
        loss = F.cross_entropy(logits, y)
        self.train_acc(logits, y)
        self.log("train_loss", loss, prog_bar=True)
        self.log("train_acc", self.train_acc, prog_bar=True)
        return loss

    def validation_step(self, batch, batch_idx):
        x, y = batch
        logits = self(x)
        loss = F.cross_entropy(logits, y)
        self.val_acc(logits, y)
        self.val_f1(logits, y)
        self.log("val_loss", loss, prog_bar=True)
        self.log("val_acc", self.val_acc, prog_bar=True)
        self.log("val_f1", self.val_f1, prog_bar=True)

    def configure_optimizers(self):
        optimizer = torch.optim.AdamW(
            self.parameters(),
            lr=self.hparams.lr,
            weight_decay=self.hparams.weight_decay,
        )
        scheduler = torch.optim.lr_scheduler.OneCycleLR(
            optimizer,
            max_lr=self.hparams.lr * 10,
            total_steps=self.trainer.estimated_stepping_batches,
        )
        return {
            "optimizer": optimizer,
            "lr_scheduler": {
                "scheduler": scheduler,
                "interval": "step",
            },
        }

# Usage
model = LitClassifier()
trainer = pl.Trainer(
    max_epochs=10,
    accelerator="auto",
    precision="16-mixed",    # Mixed precision training
    gradient_clip_val=1.0,   # Gradient clipping
    accumulate_grad_batches=4,  # Gradient accumulation (effective batch size 4x)
    callbacks=[
        pl.callbacks.EarlyStopping(monitor="val_loss", patience=3),
        pl.callbacks.ModelCheckpoint(
            monitor="val_acc", mode="max",
            filename="{epoch}-{val_acc:.3f}",
            save_top_k=3,
        ),
        pl.callbacks.LearningRateMonitor(logging_interval="step"),
        pl.callbacks.RichProgressBar(),
    ],
    logger=[
        pl.loggers.TensorBoardLogger("logs/", name="experiment"),
        # pl.loggers.WandbLogger(project="my-project"),
    ],
)
# trainer.fit(model, train_dataloader, val_dataloader)
```

### PyTorch 2.x: torch.compile

```python
import torch
import torch.nn as nn
import time

class TransformerBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dim_ff=2048):
        super().__init__()
        self.attn = nn.MultiheadAttention(d_model, nhead, batch_first=True)
        self.ff = nn.Sequential(
            nn.Linear(d_model, dim_ff),
            nn.GELU(),
            nn.Linear(dim_ff, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(0.1)

    def forward(self, x):
        # Pre-Norm Transformer
        residual = x
        x = self.norm1(x)
        x, _ = self.attn(x, x, x)
        x = self.dropout(x) + residual

        residual = x
        x = self.norm2(x)
        x = self.ff(x)
        x = self.dropout(x) + residual
        return x

model = TransformerBlock().cuda()

# === Optimization with torch.compile ===
# New feature in PyTorch 2.0+: TorchDynamo + TorchInductor
compiled_model = torch.compile(
    model,
    mode="reduce-overhead",  # "default", "reduce-overhead", "max-autotune"
    # fullgraph=True,        # Compile the entire graph (no graph breaks)
)

x = torch.randn(32, 128, 512).cuda()

# Benchmark
def benchmark(model, x, name, n_iter=100):
    # Warmup
    for _ in range(10):
        _ = model(x)
    torch.cuda.synchronize()

    start = time.time()
    for _ in range(n_iter):
        _ = model(x)
    torch.cuda.synchronize()
    elapsed = time.time() - start
    print(f"{name}: {elapsed:.3f}s ({elapsed/n_iter*1000:.1f}ms/iter)")

benchmark(model, x, "Eager")
benchmark(compiled_model, x, "Compiled")
# Typical result: Compiled is 1.5-2x faster than Eager
```

### PyTorch Custom Operators (C++ Extension)

```python
# === custom_op.cpp ===
"""
#include <torch/extension.h>

torch::Tensor fused_gelu(torch::Tensor input) {
    // Approximate GELU implementation (tanh approximation)
    auto x = input;
    auto cdf = 0.5 * (1.0 + torch::tanh(
        std::sqrt(2.0 / M_PI) * (x + 0.044715 * torch::pow(x, 3))
    ));
    return x * cdf;
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("fused_gelu", &fused_gelu, "Fused GELU activation");
}
"""

# === Usage from Python ===
# from torch.utils.cpp_extension import load
# custom_ops = load(name="custom_ops", sources=["custom_op.cpp"])
# output = custom_ops.fused_gelu(input_tensor)

# For CUDA Extension
"""
// custom_op_cuda.cu
__global__ void fused_gelu_kernel(
    const float* input, float* output, int n
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        float x = input[idx];
        float cdf = 0.5f * (1.0f + tanhf(
            sqrtf(2.0f / M_PI) * (x + 0.044715f * x * x * x)
        ));
        output[idx] = x * cdf;
    }
}
"""
```

---

## 3. TensorFlow / Keras Ecosystem In-Depth

### Code Example 3: TensorFlow SavedModel and Production Deployment

```python
import tensorflow as tf
import numpy as np

# Model saving (TF SavedModel format)
model = tf.keras.Sequential([
    tf.keras.layers.Dense(256, activation="relu"),
    tf.keras.layers.Dense(10),
])
model.build(input_shape=(None, 784))
model.compile(optimizer="adam",
              loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True))

# Save in SavedModel format (directly deployable to TF Serving)
tf.saved_model.save(model, "saved_model/my_model/1")

# TFLite conversion (for mobile/edge)
converter = tf.lite.TFLiteConverter.from_saved_model("saved_model/my_model/1")
converter.optimizations = [tf.lite.Optimize.DEFAULT]  # Quantization
tflite_model = converter.convert()

with open("model.tflite", "wb") as f:
    f.write(tflite_model)

print(f"TFLite model size: {len(tflite_model) / 1024:.1f} KB")

# Inference with TFLite
interpreter = tf.lite.Interpreter(model_content=tflite_model)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Test inference
test_input = np.random.randn(1, 784).astype(np.float32)
interpreter.set_tensor(input_details[0]["index"], test_input)
interpreter.invoke()
output = interpreter.get_tensor(output_details[0]["index"])
print(f"TFLite inference result shape: {output.shape}")
```

### Keras 3.0 Multi-Backend

```python
# Keras 3.0 allows switching between PyTorch, JAX, and TensorFlow as backends
import os
os.environ["KERAS_BACKEND"] = "jax"  # "tensorflow", "torch", "jax"

import keras
from keras import layers, ops

class MultiBackendModel(keras.Model):
    """Keras 3.0 multi-backend compatible model"""

    def __init__(self, num_classes=10):
        super().__init__()
        self.conv1 = layers.Conv2D(32, 3, padding="same", activation="relu")
        self.bn1 = layers.BatchNormalization()
        self.pool1 = layers.MaxPooling2D(2)
        self.conv2 = layers.Conv2D(64, 3, padding="same", activation="relu")
        self.bn2 = layers.BatchNormalization()
        self.pool2 = layers.MaxPooling2D(2)
        self.flatten = layers.Flatten()
        self.dense1 = layers.Dense(128, activation="relu")
        self.dropout = layers.Dropout(0.5)
        self.dense2 = layers.Dense(num_classes)

    def call(self, x, training=False):
        x = self.pool1(self.bn1(self.conv1(x), training=training))
        x = self.pool2(self.bn2(self.conv2(x), training=training))
        x = self.flatten(x)
        x = self.dropout(self.dense1(x), training=training)
        return self.dense2(x)

model = MultiBackendModel()
model.compile(
    optimizer=keras.optimizers.Adam(1e-3),
    loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=["accuracy"],
)
# The same code runs on any backend: TF / PyTorch / JAX
```

### High-Performance Data Pipeline with tf.data

```python
import tensorflow as tf

def build_dataset(file_pattern, batch_size=32, is_training=True):
    """High-performance tf.data pipeline"""

    # Reading TFRecords
    feature_description = {
        "image": tf.io.FixedLenFeature([], tf.string),
        "label": tf.io.FixedLenFeature([], tf.int64),
    }

    def parse_example(serialized):
        example = tf.io.parse_single_example(serialized, feature_description)
        image = tf.io.decode_jpeg(example["image"], channels=3)
        image = tf.cast(image, tf.float32) / 255.0
        image = tf.image.resize(image, [224, 224])
        return image, example["label"]

    def augment(image, label):
        image = tf.image.random_flip_left_right(image)
        image = tf.image.random_brightness(image, max_delta=0.2)
        image = tf.image.random_contrast(image, lower=0.8, upper=1.2)
        image = tf.image.random_saturation(image, lower=0.8, upper=1.2)
        return image, label

    # Pipeline construction
    files = tf.data.Dataset.list_files(file_pattern, shuffle=is_training)

    dataset = files.interleave(
        tf.data.TFRecordDataset,
        num_parallel_calls=tf.data.AUTOTUNE,  # Parallel reading
        cycle_length=8,                        # Number of files to read simultaneously
        deterministic=not is_training,
    )

    dataset = dataset.map(parse_example,
                          num_parallel_calls=tf.data.AUTOTUNE)

    if is_training:
        dataset = dataset.map(augment,
                              num_parallel_calls=tf.data.AUTOTUNE)
        dataset = dataset.shuffle(buffer_size=10000)
        dataset = dataset.repeat()

    dataset = (
        dataset
        .batch(batch_size, drop_remainder=is_training)
        .prefetch(tf.data.AUTOTUNE)  # Prepare data in parallel with GPU computation
    )

    return dataset

# Usage
train_ds = build_dataset("data/train-*.tfrecord", batch_size=64)
val_ds = build_dataset("data/val-*.tfrecord", batch_size=64, is_training=False)
```

### TensorFlow Custom Training Loop

```python
import tensorflow as tf

class CustomTrainer:
    """Custom training loop using tf.GradientTape"""

    def __init__(self, model, optimizer, loss_fn):
        self.model = model
        self.optimizer = optimizer
        self.loss_fn = loss_fn
        self.train_loss = tf.keras.metrics.Mean(name="train_loss")
        self.train_acc = tf.keras.metrics.SparseCategoricalAccuracy(
            name="train_accuracy")
        self.val_loss = tf.keras.metrics.Mean(name="val_loss")
        self.val_acc = tf.keras.metrics.SparseCategoricalAccuracy(
            name="val_accuracy")

    @tf.function  # Accelerate with graph mode
    def train_step(self, x, y):
        with tf.GradientTape() as tape:
            logits = self.model(x, training=True)
            loss = self.loss_fn(y, logits)

        # Compute and apply gradients
        gradients = tape.gradient(loss, self.model.trainable_variables)

        # Gradient clipping
        gradients, global_norm = tf.clip_by_global_norm(gradients, 1.0)

        self.optimizer.apply_gradients(
            zip(gradients, self.model.trainable_variables))

        self.train_loss.update_state(loss)
        self.train_acc.update_state(y, logits)
        return loss

    @tf.function
    def val_step(self, x, y):
        logits = self.model(x, training=False)
        loss = self.loss_fn(y, logits)
        self.val_loss.update_state(loss)
        self.val_acc.update_state(y, logits)

    def fit(self, train_ds, val_ds, epochs):
        for epoch in range(epochs):
            # Training
            self.train_loss.reset_state()
            self.train_acc.reset_state()
            for x_batch, y_batch in train_ds:
                self.train_step(x_batch, y_batch)

            # Validation
            self.val_loss.reset_state()
            self.val_acc.reset_state()
            for x_batch, y_batch in val_ds:
                self.val_step(x_batch, y_batch)

            print(
                f"Epoch {epoch+1}: "
                f"loss={self.train_loss.result():.4f}, "
                f"acc={self.train_acc.result():.4f}, "
                f"val_loss={self.val_loss.result():.4f}, "
                f"val_acc={self.val_acc.result():.4f}"
            )
```

### Model Serving with TF Serving

```python
# === Model Versioning and Signatures ===
import tensorflow as tf

class ServableModel(tf.keras.Model):
    def __init__(self):
        super().__init__()
        self.dense1 = tf.keras.layers.Dense(256, activation="relu")
        self.dense2 = tf.keras.layers.Dense(10)

    @tf.function(input_signature=[
        tf.TensorSpec(shape=[None, 784], dtype=tf.float32, name="input")
    ])
    def serve(self, x):
        """Endpoint for serving"""
        logits = self.dense2(self.dense1(x))
        probs = tf.nn.softmax(logits, axis=-1)
        return {
            "predictions": probs,
            "class_ids": tf.argmax(probs, axis=-1),
            "confidences": tf.reduce_max(probs, axis=-1),
        }

model = ServableModel()
model(tf.random.normal([1, 784]))  # Build

# Save as SavedModel with signatures
tf.saved_model.save(
    model,
    "saved_model/classifier/1",
    signatures={"serving_default": model.serve},
)

# === Launch TF Serving with Docker ===
"""
# docker-compose.yml
version: '3'
services:
  tf-serving:
    image: tensorflow/serving:latest
    ports:
      - "8501:8501"  # REST API
      - "8500:8500"  # gRPC
    volumes:
      - ./saved_model/classifier:/models/classifier
    environment:
      MODEL_NAME: classifier
    command: --enable_batching=true --batching_parameters_file=/models/batching.config
"""

# === Python Client ===
import requests
import numpy as np
import json

def predict_rest(input_data):
    """Inference request via REST API"""
    url = "http://localhost:8501/v1/models/classifier:predict"
    payload = {
        "instances": input_data.tolist()
    }
    response = requests.post(url, json=payload)
    result = response.json()
    return result["predictions"]

# gRPC client (faster)
"""
import grpc
from tensorflow_serving.apis import predict_pb2, prediction_service_pb2_grpc

channel = grpc.insecure_channel("localhost:8500")
stub = prediction_service_pb2_grpc.PredictionServiceStub(channel)

request = predict_pb2.PredictRequest()
request.model_spec.name = "classifier"
request.inputs["input"].CopyFrom(
    tf.make_tensor_proto(input_data, shape=input_data.shape)
)
response = stub.Predict(request)
"""
```

---

## 4. JAX Ecosystem In-Depth

### Code Example 4: High-Speed Scientific Computing with JAX

```python
import jax
import jax.numpy as jnp
from functools import partial
import time

# JAX function transformation demo

# 1. jit: Acceleration via XLA compilation
@jax.jit
def matmul_jit(A, B):
    return jnp.dot(A, B)

A = jax.random.normal(jax.random.PRNGKey(0), (1000, 1000))
B = jax.random.normal(jax.random.PRNGKey(1), (1000, 1000))

# Warmup (initial compilation)
_ = matmul_jit(A, B).block_until_ready()

start = time.time()
for _ in range(100):
    _ = matmul_jit(A, B).block_until_ready()
print(f"JIT matrix multiplication (100 iterations): {time.time()-start:.3f}s")

# 2. grad: Automatic differentiation
def loss_fn(params, x, y):
    pred = jnp.dot(x, params["w"]) + params["b"]
    return jnp.mean((pred - y) ** 2)

# Automatically generate gradient function
grad_fn = jax.grad(loss_fn)

params = {"w": jnp.ones(10), "b": 0.0}
x = jax.random.normal(jax.random.PRNGKey(2), (100, 10))
y = jax.random.normal(jax.random.PRNGKey(3), (100,))

grads = grad_fn(params, x, y)
print(f"w gradient shape: {grads['w'].shape}, b gradient: {grads['b']:.4f}")

# 3. vmap: Automatic vectorization for batching
def single_sample_loss(param, x, y):
    pred = jnp.dot(x, param)
    return (pred - y) ** 2

# Automatically extend single-sample function to batch
batched_loss = jax.vmap(single_sample_loss, in_axes=(None, 0, 0))
losses = batched_loss(jnp.ones(10), x, y)
print(f"Batch loss shape: {losses.shape}")  # (100,)

# 4. Higher-order differentiation (Hessian matrix)
def scalar_loss(params):
    return jnp.sum(params ** 2 + jnp.sin(params))

# First-order derivative
first_grad = jax.grad(scalar_loss)
# Second-order derivative (Hessian)
hessian = jax.hessian(scalar_loss)

params = jnp.array([1.0, 2.0, 3.0])
print(f"Gradient: {first_grad(params)}")
print(f"Hessian:\n{hessian(params)}")
```

### JAX Random Number Management (PRNG)

```python
import jax
import jax.numpy as jnp

# === JAX random numbers are "explicit" and "splittable" ===
# Fundamentally different from PyTorch/NumPy's global state

key = jax.random.PRNGKey(42)

# BAD: Reusing the same key produces the same values
x1 = jax.random.normal(key, (3,))
x2 = jax.random.normal(key, (3,))
print(f"Same key: {jnp.allclose(x1, x2)}")  # True (identical!)

# GOOD: Split the key before use
key, subkey1, subkey2 = jax.random.split(key, 3)
x1 = jax.random.normal(subkey1, (3,))
x2 = jax.random.normal(subkey2, (3,))
print(f"Different keys: {jnp.allclose(x1, x2)}")  # False (different)

# Practical pattern: Key splitting inside a loop
def training_loop(key, num_steps):
    params = jnp.zeros(10)
    for step in range(num_steps):
        key, step_key = jax.random.split(key)
        noise = jax.random.normal(step_key, params.shape)
        params = params + 0.01 * noise  # Example: random search
    return params

# In functional style, pass the key as an argument
result = training_loop(jax.random.PRNGKey(0), 100)
```

### Full-Scale Model Implementation with Flax

```python
import jax
import jax.numpy as jnp
from flax import linen as nn
from flax.training import train_state, checkpoints
import optax
from typing import Sequence

class ResidualBlock(nn.Module):
    """Residual block in Flax"""
    features: int
    training: bool = True

    @nn.compact
    def __call__(self, x):
        residual = x
        x = nn.Dense(self.features)(x)
        x = nn.BatchNorm(use_running_average=not self.training)(x)
        x = nn.relu(x)
        x = nn.Dense(self.features)(x)
        x = nn.BatchNorm(use_running_average=not self.training)(x)

        # Residual connection (project if dimensions differ)
        if residual.shape[-1] != self.features:
            residual = nn.Dense(self.features)(residual)

        return nn.relu(x + residual)


class FlaxResNet(nn.Module):
    """Custom ResNet-style model in Flax"""
    num_classes: int
    hidden_dims: Sequence[int] = (128, 256, 512)

    @nn.compact
    def __call__(self, x, training: bool = True):
        for dim in self.hidden_dims:
            x = ResidualBlock(dim, training=training)(x)
            x = nn.Dropout(rate=0.1, deterministic=not training)(x)

        x = jnp.mean(x, axis=-1, keepdims=True)  # Global Average
        x = nn.Dense(self.num_classes)(x)
        return x


def create_train_state(rng, model, learning_rate, weight_decay):
    """Initialize TrainState"""
    variables = model.init(rng, jnp.ones((1, 784)), training=False)
    params = variables['params']
    batch_stats = variables.get('batch_stats', {})

    # Optax: Learning rate scheduler + AdamW
    schedule = optax.warmup_cosine_decay_schedule(
        init_value=0.0,
        peak_value=learning_rate,
        warmup_steps=1000,
        decay_steps=50000,
        end_value=learning_rate * 0.01,
    )
    tx = optax.chain(
        optax.clip_by_global_norm(1.0),  # Gradient clipping
        optax.adamw(schedule, weight_decay=weight_decay),
    )

    return train_state.TrainState.create(
        apply_fn=model.apply,
        params=params,
        tx=tx,
    ), batch_stats


@jax.jit
def train_step(state, batch_stats, batch, rng):
    """JIT-compiled training step"""
    def loss_fn(params):
        variables = {'params': params, 'batch_stats': batch_stats}
        logits, new_model_state = state.apply_fn(
            variables,
            batch['image'],
            training=True,
            rngs={'dropout': rng},
            mutable=['batch_stats'],
        )
        loss = optax.softmax_cross_entropy_with_integer_labels(
            logits, batch['label']
        ).mean()
        return loss, (logits, new_model_state)

    grad_fn = jax.value_and_grad(loss_fn, has_aux=True)
    (loss, (logits, new_model_state)), grads = grad_fn(state.params)

    state = state.apply_gradients(grads=grads)
    new_batch_stats = new_model_state['batch_stats']

    accuracy = jnp.mean(jnp.argmax(logits, -1) == batch['label'])
    return state, new_batch_stats, {'loss': loss, 'accuracy': accuracy}


# Save and restore checkpoints
def save_checkpoint(state, batch_stats, step, ckpt_dir="checkpoints"):
    checkpoints.save_checkpoint(
        ckpt_dir,
        target={'state': state, 'batch_stats': batch_stats},
        step=step,
        keep=3,
    )

def load_checkpoint(state, batch_stats, ckpt_dir="checkpoints"):
    restored = checkpoints.restore_checkpoint(
        ckpt_dir,
        target={'state': state, 'batch_stats': batch_stats},
    )
    return restored['state'], restored['batch_stats']
```

### JAX pmap: Multi-Device Parallelism

```python
import jax
import jax.numpy as jnp

# Data-parallel training across multiple GPUs/TPUs

@jax.pmap
def parallel_train_step(state, batch):
    """Training step executed in parallel across multiple devices"""
    def loss_fn(params):
        logits = state.apply_fn({'params': params}, batch['image'])
        return optax.softmax_cross_entropy_with_integer_labels(
            logits, batch['label']
        ).mean()

    grads = jax.grad(loss_fn)(state.params)

    # Average gradients across devices (All-Reduce)
    grads = jax.lax.pmean(grads, axis_name='batch')

    state = state.apply_gradients(grads=grads)
    return state

# Usage
n_devices = jax.local_device_count()
print(f"Number of available devices: {n_devices}")

# Replicate state across devices
replicated_state = jax.device_put_replicated(state, jax.local_devices())

# Split batch across devices
# [global_batch, ...] → [n_devices, per_device_batch, ...]
def shard_batch(batch, n_devices):
    return jax.tree.map(
        lambda x: x.reshape(n_devices, -1, *x.shape[1:]),
        batch,
    )

# sharded_batch = shard_batch(batch, n_devices)
# replicated_state = parallel_train_step(replicated_state, sharded_batch)
```

---

## 5. Interoperability with ONNX

### Code Example 5: ONNX Export and Optimization

```python
import torch
import torch.nn as nn

class SimpleModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear1 = nn.Linear(784, 256)
        self.linear2 = nn.Linear(256, 10)

    def forward(self, x):
        x = torch.relu(self.linear1(x))
        return self.linear2(x)

model = SimpleModel()
model.eval()

# Export in ONNX format
dummy_input = torch.randn(1, 784)
torch.onnx.export(
    model, dummy_input, "model.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={
        "input": {0: "batch_size"},
        "output": {0: "batch_size"},
    },
    opset_version=17,
)
print("ONNX model saved")

# Inference with ONNX Runtime (framework-independent)
import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("model.onnx")
input_name = session.get_inputs()[0].name

test_input = np.random.randn(5, 784).astype(np.float32)
result = session.run(None, {input_name: test_input})
print(f"ONNX Runtime inference result: {result[0].shape}")  # (5, 10)
```

### ONNX Model Optimization and Quantization

```python
import onnx
from onnxruntime.quantization import (
    quantize_dynamic, quantize_static,
    QuantType, CalibrationDataReader,
)
import onnxruntime as ort
import numpy as np

# === Model Optimization ===
from onnxruntime.transformers import optimizer
optimized_model = optimizer.optimize_model(
    "model.onnx",
    model_type="bert",  # "bert", "gpt2", "vit", etc.
    num_heads=12,
    hidden_size=768,
)
optimized_model.save_model_to_file("model_optimized.onnx")

# === Dynamic Quantization (no training data needed, simple) ===
quantize_dynamic(
    model_input="model.onnx",
    model_output="model_dynamic_quant.onnx",
    weight_type=QuantType.QInt8,
)

# === Static Quantization (requires calibration data, higher accuracy) ===
class CalibDataReader(CalibrationDataReader):
    def __init__(self, calibration_data):
        self.data = iter(calibration_data)

    def get_next(self):
        try:
            batch = next(self.data)
            return {"input": batch.astype(np.float32)}
        except StopIteration:
            return None

# Prepare calibration data
calib_data = [np.random.randn(1, 784) for _ in range(100)]
reader = CalibDataReader(calib_data)

quantize_static(
    model_input="model.onnx",
    model_output="model_static_quant.onnx",
    calibration_data_reader=reader,
    quant_format=ort.quantization.QuantFormat.QDQ,
)

# === Performance Comparison ===
import time

def benchmark_onnx(model_path, input_data, n_iter=1000):
    """Benchmark an ONNX model"""
    # Select execution providers
    providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    session = ort.InferenceSession(model_path, providers=providers)
    input_name = session.get_inputs()[0].name

    # Warmup
    for _ in range(10):
        session.run(None, {input_name: input_data})

    start = time.time()
    for _ in range(n_iter):
        session.run(None, {input_name: input_data})
    elapsed = time.time() - start

    # Model size
    import os
    size_mb = os.path.getsize(model_path) / (1024 * 1024)

    print(f"{model_path}: {elapsed/n_iter*1000:.2f}ms/inference, "
          f"size: {size_mb:.2f}MB")

input_data = np.random.randn(1, 784).astype(np.float32)
benchmark_onnx("model.onnx", input_data)
benchmark_onnx("model_dynamic_quant.onnx", input_data)
# Typical result: Quantization yields 2-4x speedup, 2-4x size reduction
```

### TensorFlow to ONNX Conversion

```python
# TensorFlow to ONNX conversion using tf2onnx
import subprocess

# Convert from command line
"""
python -m tf2onnx.convert \
    --saved-model saved_model/my_model/1 \
    --output model_from_tf.onnx \
    --opset 17
"""

# Convert using Python API
import tf2onnx
import tensorflow as tf

model = tf.keras.Sequential([
    tf.keras.layers.Dense(256, activation="relu", input_shape=(784,)),
    tf.keras.layers.Dense(10),
])
model.build()

# Keras to ONNX
spec = (tf.TensorSpec((None, 784), tf.float32, name="input"),)
model_proto, _ = tf2onnx.convert.from_keras(
    model,
    input_signature=spec,
    opset=17,
    output_path="model_from_keras.onnx",
)
print(f"Conversion complete: {len(model_proto.SerializeToString())} bytes")
```

---

## 6. Distributed Training

### PyTorch DDP (DistributedDataParallel)

```python
import torch
import torch.nn as nn
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler
import os

def setup_distributed(rank, world_size):
    """Initialize distributed training"""
    os.environ["MASTER_ADDR"] = "localhost"
    os.environ["MASTER_PORT"] = "12355"
    dist.init_process_group(
        backend="nccl",  # Optimal for GPU-to-GPU communication
        rank=rank,
        world_size=world_size,
    )
    torch.cuda.set_device(rank)

def cleanup():
    dist.destroy_process_group()

def train_distributed(rank, world_size, epochs=10):
    """Main function for distributed training"""
    setup_distributed(rank, world_size)

    # Wrap model with DDP
    model = nn.Sequential(
        nn.Linear(784, 256),
        nn.ReLU(),
        nn.Linear(256, 10),
    ).to(rank)
    ddp_model = DDP(model, device_ids=[rank])

    # Split data with DistributedSampler
    dataset = torch.utils.data.TensorDataset(
        torch.randn(10000, 784),
        torch.randint(0, 10, (10000,)),
    )
    sampler = DistributedSampler(
        dataset, num_replicas=world_size, rank=rank, shuffle=True
    )
    loader = DataLoader(dataset, batch_size=64, sampler=sampler,
                        pin_memory=True, num_workers=2)

    optimizer = torch.optim.Adam(ddp_model.parameters(), lr=0.001)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        sampler.set_epoch(epoch)  # Change shuffle order per epoch
        ddp_model.train()

        for batch_idx, (data, target) in enumerate(loader):
            data, target = data.to(rank), target.to(rank)
            optimizer.zero_grad()
            output = ddp_model(data)
            loss = criterion(output, target)
            loss.backward()  # All-Reduce happens automatically
            optimizer.step()

        if rank == 0:
            print(f"Epoch {epoch+1}, Loss: {loss.item():.4f}")

    cleanup()

# Launch
# torchrun --nproc_per_node=4 train.py
# or
# mp.spawn(train_distributed, args=(world_size,), nprocs=world_size)
```

### PyTorch FSDP (Fully Sharded Data Parallel)

```python
import torch
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy,
)
from torch.distributed.fsdp.wrap import (
    transformer_auto_wrap_policy,
    size_based_auto_wrap_policy,
)

# FSDP: Shards model parameters across devices
# DDP: Each device holds a full copy of the model
# FSDP: Each device holds only part of the model → more memory efficient

def setup_fsdp(model, rank):
    """Large-scale model distributed training with FSDP"""

    # Mixed precision settings
    mixed_precision = MixedPrecision(
        param_dtype=torch.float16,
        reduce_dtype=torch.float16,
        buffer_dtype=torch.float32,
    )

    # Auto-wrapping policy
    auto_wrap_policy = size_based_auto_wrap_policy(
        min_num_params=1_000_000,  # Split modules with 1M+ parameters
    )

    fsdp_model = FSDP(
        model,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        mixed_precision=mixed_precision,
        auto_wrap_policy=auto_wrap_policy,
        device_id=rank,
        use_orig_params=True,  # torch.compile compatible
    )

    return fsdp_model

# When to use DDP vs FSDP
"""
Use DDP when:
- The model fits in a single GPU's memory
- You want to minimize communication overhead
- You prefer a simpler implementation

Use FSDP when:
- The model doesn't fit in a single GPU's memory (billions of parameters)
- You want to scale GPU count without changing batch size
- You want to maximize memory efficiency
"""
```

### TensorFlow Distribution Strategies

```python
import tensorflow as tf

# === MirroredStrategy: Single-node, multi-GPU ===
strategy = tf.distribute.MirroredStrategy()
print(f"Number of devices: {strategy.num_replicas_in_sync}")

with strategy.scope():
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(256, activation="relu", input_shape=(784,)),
        tf.keras.layers.Dense(10),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(0.001),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=["accuracy"],
    )

# model.fit() automatically runs with data parallelism

# === MultiWorkerMirroredStrategy: Multi-node ===
"""
# Configure via TF_CONFIG environment variable
import json
os.environ["TF_CONFIG"] = json.dumps({
    "cluster": {
        "worker": ["worker0:2222", "worker1:2222"]
    },
    "task": {"type": "worker", "index": 0}
})

strategy = tf.distribute.MultiWorkerMirroredStrategy()
"""

# === TPUStrategy ===
"""
resolver = tf.distribute.cluster_resolver.TPUClusterResolver()
tf.config.experimental_connect_to_cluster(resolver)
tf.tpu.experimental.initialize_tpu_system(resolver)
strategy = tf.distribute.TPUStrategy(resolver)
"""
```

---

## 7. Mixed Precision Training

### How Mixed Precision Works

```
Mixed Precision Training Concept:

┌──────────────────────────────────────────────┐
│         Forward Pass (FP16)                   │
│  Input ──→ [Layer1] ──→ [Layer2] ──→ Output  │
│   FP16     FP16 weights  FP16 weights  FP16  │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│         Loss Computation (FP32)               │
│  FP16 output → FP32 cast → Loss calc →       │
│    Loss Scaling                               │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│         Backward Pass (FP16)                  │
│  Scaled Loss → FP16 grads → Unscale →        │
│    FP32 update                                │
└──────────────────────────────────────────────┘

Benefits:
- Memory usage: ~50% reduction (FP32 → FP16)
- Computation speed: 2-3x speedup (leveraging Tensor Cores)
- Training accuracy: Nearly equivalent to FP32

Data type ranges:
  FP32: ±3.4×10^38, precision ~7 digits
  FP16: ±65,504,    precision ~3 digits
  BF16: ±3.4×10^38, precision ~3 digits (exponent same as FP32)
```

### PyTorch Mixed Precision

```python
import torch
from torch.cuda.amp import autocast, GradScaler

# === Manual mixed precision ===
model = model.cuda()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
scaler = GradScaler()  # Loss Scaling (prevents gradient underflow)

for epoch in range(10):
    for data, target in train_loader:
        data, target = data.cuda(), target.cuda()
        optimizer.zero_grad()

        # autocast: Automatically selects FP16/FP32
        with autocast(dtype=torch.float16):
            output = model(data)
            loss = criterion(output, target)

        # GradScaler: Scales FP16 gradients
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)  # Unscale before gradient clipping
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optimizer)
        scaler.update()

# === BFloat16 (recommended for Ampere GPUs and later) ===
with autocast(dtype=torch.bfloat16):
    # BF16 has the same exponent as FP32 → Loss Scaling not needed
    output = model(data)
    loss = criterion(output, target)
loss.backward()
optimizer.step()

# === With PyTorch Lightning ===
# trainer = pl.Trainer(precision="16-mixed")     # FP16
# trainer = pl.Trainer(precision="bf16-mixed")   # BF16
```

### TensorFlow Mixed Precision

```python
import tensorflow as tf

# Set via global policy
tf.keras.mixed_precision.set_global_policy("mixed_float16")

# Model definition (explicitly set output layer to FP32)
model = tf.keras.Sequential([
    tf.keras.layers.Dense(256, activation="relu"),
    tf.keras.layers.Dense(256, activation="relu"),
    tf.keras.layers.Dense(10, dtype="float32"),  # Output layer in FP32
])

# Loss Scaling is applied automatically
optimizer = tf.keras.optimizers.Adam(0.001)
# In TF2.x, LossScaleOptimizer is automatically wrapped

model.compile(optimizer=optimizer,
              loss=tf.keras.losses.SparseCategoricalCrossentropy(
                  from_logits=True))
```

---

## 8. Profiling and Debugging

### PyTorch Profiler

```python
import torch
from torch.profiler import profile, record_function, ProfilerActivity

model = model.cuda()
input_data = torch.randn(64, 784).cuda()

# === Basic profiling ===
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    with record_function("model_inference"):
        output = model(input_data)

# Table display
print(prof.key_averages().table(
    sort_by="cuda_time_total", row_limit=20
))

# Export in Chrome Trace format (visualize at chrome://tracing)
prof.export_chrome_trace("trace.json")

# Export in TensorBoard format
prof.export_stacks("profiler_stacks.txt", "self_cuda_time_total")

# === Scheduled profiling ===
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=torch.profiler.schedule(
        wait=1,       # Don't record the first step
        warmup=1,     # Next step is warmup
        active=3,     # Record 3 steps
        repeat=2,     # Repeat the above twice
    ),
    on_trace_ready=torch.profiler.tensorboard_trace_handler("./log/profiler"),
    record_shapes=True,
    with_stack=True,
) as prof:
    for step, (data, target) in enumerate(train_loader):
        if step >= (1 + 1 + 3) * 2:
            break
        data, target = data.cuda(), target.cuda()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        prof.step()  # Notify profiler of the current step
```

### Memory Profiling

```python
import torch

# === Detailed GPU memory tracking ===
torch.cuda.reset_peak_memory_stats()
torch.cuda.empty_cache()

print(f"Initial allocation: {torch.cuda.memory_allocated() / 1e6:.1f} MB")

model = model.cuda()
print(f"After model: {torch.cuda.memory_allocated() / 1e6:.1f} MB")

x = torch.randn(256, 784).cuda()
output = model(x)
print(f"After forward: {torch.cuda.memory_allocated() / 1e6:.1f} MB")

loss = output.sum()
loss.backward()
print(f"After backward: {torch.cuda.memory_allocated() / 1e6:.1f} MB")

print(f"Peak memory: {torch.cuda.max_memory_allocated() / 1e6:.1f} MB")

# === Memory snapshot (PyTorch 2.1+) ===
torch.cuda.memory._record_memory_history()
# ... training code ...
torch.cuda.memory._dump_snapshot("memory_snapshot.pickle")
torch.cuda.memory._record_memory_history(enabled=None)

# Visualize with memory_viz.py
# python torch/cuda/_memory_viz.py trace_plot memory_snapshot.pickle -o mem.html

# === Gradient checkpointing (memory reduction technique) ===
from torch.utils.checkpoint import checkpoint

class MemoryEfficientModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([
            nn.Sequential(nn.Linear(512, 512), nn.ReLU())
            for _ in range(20)
        ])
        self.head = nn.Linear(512, 10)

    def forward(self, x):
        for layer in self.layers:
            # Gradient checkpointing: don't keep intermediate results during forward
            # Recompute during backward → reduces memory, increases computation cost
            x = checkpoint(layer, x, use_reentrant=False)
        return self.head(x)
```

### Visualization with TensorBoard

```python
from torch.utils.tensorboard import SummaryWriter
import torch
import numpy as np

writer = SummaryWriter("runs/experiment_001")

# === Logging scalar values ===
for epoch in range(100):
    train_loss = np.random.exponential(1.0 / (epoch + 1))
    val_loss = train_loss * 1.1
    writer.add_scalar("Loss/train", train_loss, epoch)
    writer.add_scalar("Loss/val", val_loss, epoch)
    writer.add_scalar("Accuracy/train", 1 - train_loss/10, epoch)

# === Histograms (weight distributions) ===
for name, param in model.named_parameters():
    writer.add_histogram(f"params/{name}", param, epoch)
    if param.grad is not None:
        writer.add_histogram(f"grads/{name}", param.grad, epoch)

# === Logging images ===
from torchvision.utils import make_grid
images = torch.randn(16, 3, 32, 32)  # Dummy images
grid = make_grid(images, nrow=4, normalize=True)
writer.add_image("samples", grid, epoch)

# === Model graph ===
dummy_input = torch.randn(1, 784)
writer.add_graph(model.cpu(), dummy_input)

# === Hyperparameter comparison ===
writer.add_hparams(
    {"lr": 0.001, "batch_size": 32, "hidden_dim": 256},
    {"hparam/accuracy": 0.95, "hparam/loss": 0.15},
)

# === Embedding visualization (t-SNE/PCA) ===
features = torch.randn(1000, 128)  # Feature vectors
labels = torch.randint(0, 10, (1000,))
writer.add_embedding(features, metadata=labels.tolist(), tag="embeddings")

writer.close()
# Launch with: tensorboard --logdir=runs
```

---

## Comparison Tables

### Comprehensive Framework Comparison

| Item | PyTorch | TensorFlow 2.x | JAX |
|---|---|---|---|
| Design Philosophy | Pythonic, research-oriented | Production-oriented | Functional, scientific computing |
| Execution Mode | Eager (default) | Eager + @tf.function | jit transformation |
| Automatic Differentiation | autograd | GradientTape | jax.grad |
| High-Level API | Lightning, HuggingFace | Keras | Flax, Haiku |
| Deployment | TorchScript, ONNX | SavedModel, TFLite, TF.js | Requires conversion |
| Mobile | PyTorch Mobile | TFLite (mature) | Not supported |
| TPU Support | Via XLA | Native | Native (optimal) |
| Community | Researcher-centric | Enterprise + research | Google Research |
| Learning Curve | Low | Moderate | High |
| 2024 Market Share | ~70% (research) | ~25% | ~5% (rapidly growing) |

### Recommended Frameworks by Use Case

| Use Case | First Choice | Reason |
|---|---|---|
| Research / Paper Implementation | PyTorch | Vast majority of paper code is in PyTorch |
| Prototyping | PyTorch | Easy to debug |
| Production Web Services | TensorFlow or PyTorch | TF Serving / TorchServe |
| Mobile Deployment | TensorFlow (TFLite) | Most mature mobile inference |
| Browser Execution | TensorFlow (TF.js) | JavaScript support |
| Scientific Computing / HPC | JAX | vmap, pmap, XLA |
| Large Language Models | PyTorch + HuggingFace | Rich ecosystem |
| Kaggle Competitions | PyTorch | Flexible customization |
| Educational Purposes | PyTorch or Keras | Intuitive API |

### High-Level Library Comparison

| Library | Supported FW | Primary Use | Features |
|---|---|---|---|
| PyTorch Lightning | PyTorch | Training structuring | Boilerplate reduction, automated distributed training |
| Hugging Face Transformers | PyTorch, TF, JAX | NLP/Vision | Pretrained model Hub, unified API |
| Keras 3.0 | TF, PyTorch, JAX | General-purpose | Multi-backend, declarative API |
| Optax | JAX | Optimization | Functional optimizer composition |
| Flax | JAX | Model definition | Functional NN, Google official |
| timm | PyTorch | Image models | 700+ pretrained models |
| TorchMetrics | PyTorch | Evaluation metrics | Distributed training-compatible metrics |
| Weights & Biases | All FW | Experiment management | Logging, visualization, hyperparameter optimization |

### Deployment Methods Comparison

| Method | Supported FW | Target Environment | Latency | Setup Difficulty |
|---|---|---|---|---|
| TorchServe | PyTorch | Server | Low | Medium |
| TF Serving | TF | Server | Low | Low |
| ONNX Runtime | All FW | Server/Edge | Lowest | Low |
| TFLite | TF | Mobile/Edge | Low | Medium |
| PyTorch Mobile | PyTorch | Mobile | Medium | Medium |
| TF.js | TF | Browser | Medium | Low |
| TensorRT | PyTorch/TF | NVIDIA GPU | Lowest | High |
| Core ML | All FW (conversion) | iOS/macOS | Low | Medium |
| Triton Server | All FW | Server | Low | High |

### Scaling Comparison

| Item | PyTorch DDP | PyTorch FSDP | TF MirroredStrategy | JAX pmap |
|---|---|---|---|---|
| Type | Data parallel | Sharded parallel | Data parallel | Data parallel |
| Memory Efficiency | Low (full parameter replication) | High (parameters distributed) | Low | Medium |
| Communication Volume | Gradient All-Reduce | Parameter gathering | Gradient All-Reduce | Gradient All-Reduce |
| Max Model Size | Limited by single GPU memory | GPU count x memory | Limited by single GPU memory | Limited by single GPU memory |
| Ease of Setup | Medium | Somewhat difficult | Easy | Easy |
| Multi-Node | Supported | Supported | Supported | Supported |

---

## 9. Practical Framework Selection Flow

```
Selection flowchart based on project requirements:

[Start] → Research/paper implementation?
  │
  ├─ Yes → PyTorch (research standard)
  │
  └─ No → Mobile/edge deployment?
       │
       ├─ Yes → iOS? ──→ Core ML + coremltools
       │         │
       │         └─ Android/embedded? ──→ TFLite (most mature)
       │
       └─ No → Browser execution?
            │
            ├─ Yes → TensorFlow.js
            │
            └─ No → Large-scale parallel computing (TPU/multi-GPU)?
                 │
                 ├─ Yes → Model > 1 GPU?
                 │         │
                 │         ├─ Yes → PyTorch FSDP or DeepSpeed
                 │         │
                 │         └─ No → JAX pmap (optimal for TPU)
                 │                 or PyTorch DDP
                 │
                 └─ No → Server-side API?
                      │
                      ├─ Yes → ONNX Runtime (fastest)
                      │        or TorchServe / TF Serving
                      │
                      └─ No → PyTorch (most versatile)
```

### Selection Criteria for Teams and Organizations

```python
# Framework selection scoring function
def score_framework(requirements):
    """Calculate framework scores from project requirements"""

    weights = {
        "research_reproducibility": {"pytorch": 10, "tensorflow": 5, "jax": 7},
        "production":               {"pytorch": 7, "tensorflow": 9, "jax": 4},
        "mobile_support":           {"pytorch": 5, "tensorflow": 10, "jax": 1},
        "learning_cost":            {"pytorch": 9, "tensorflow": 7, "jax": 3},
        "computational_efficiency": {"pytorch": 7, "tensorflow": 7, "jax": 10},
        "ecosystem":                {"pytorch": 10, "tensorflow": 8, "jax": 5},
        "large_scale_training":     {"pytorch": 8, "tensorflow": 7, "jax": 9},
        "debugging_ease":           {"pytorch": 10, "tensorflow": 6, "jax": 4},
        "team_existing_expertise":  {"pytorch": 0, "tensorflow": 0, "jax": 0},
    }

    scores = {"pytorch": 0, "tensorflow": 0, "jax": 0}
    for req, importance in requirements.items():
        for fw in scores:
            scores[fw] += weights[req][fw] * importance

    return scores

# Usage
requirements = {
    "research_reproducibility": 3,    # Importance 1-5
    "production": 5,
    "mobile_support": 2,
    "learning_cost": 4,
    "computational_efficiency": 3,
    "ecosystem": 4,
    "large_scale_training": 2,
    "debugging_ease": 4,
}
scores = score_framework(requirements)
for fw, score in sorted(scores.items(), key=lambda x: -x[1]):
    print(f"  {fw}: {score}")
```

---

## Anti-Patterns

### Anti-Pattern 1: Forgetting model.eval()

```python
# BAD: Not calling model.eval() during inference
# → Dropout remains active, BatchNorm uses batch statistics
model.train()  # Training mode
# ... training ...
output = model(test_input)  # Dropout/BN still in training mode!

# GOOD: Always use eval() + no_grad() during inference
model.eval()
with torch.no_grad():
    output = model(test_input)  # Dropout disabled, BN uses running average
```

### Anti-Pattern 2: GPU/CPU Device Mismatch

```python
# BAD: Tensors on different devices
model = model.cuda()
input_cpu = torch.randn(1, 784)  # On CPU
output = model(input_cpu)  # RuntimeError: expected CUDA tensor

# GOOD: Unify devices
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
input_tensor = torch.randn(1, 784).to(device)
output = model(input_tensor)  # Run on the same device
```

### Anti-Pattern 3: Improper Data Type Conversion

```python
# BAD: Passing FP64 tensor to FP32 model
x = torch.from_numpy(np.array([1.0, 2.0]))  # FP64 (NumPy default)
model = nn.Linear(2, 1)  # FP32
output = model(x)  # RuntimeError: expected Float but got Double

# GOOD: Explicitly match data types
x = torch.from_numpy(np.array([1.0, 2.0])).float()  # Convert to FP32
output = model(x)

# Even better: Specify type at tensor creation
x = torch.tensor([1.0, 2.0], dtype=torch.float32)
```

### Anti-Pattern 4: Misuse of Mutable State in JAX

```python
import jax.numpy as jnp

# BAD: JAX does not allow side effects (NumPy-style assignment is not possible)
x = jnp.array([1, 2, 3])
# x[0] = 10  # TypeError: JAX arrays are immutable

# GOOD: Use at[].set() (returns a new array)
x_new = x.at[0].set(10)  # x is unchanged, x_new is a new array
print(f"Original: {x}, New: {x_new}")  # Original: [1 2 3], New: [10 2 3]

# BAD: Using side effects on global variables or lists inside jit
results = []
@jax.jit
def bad_fn(x):
    results.append(x)  # Side effect! Unexpected behavior inside JIT
    return x * 2

# GOOD: Implement as a pure function, manage state externally
@jax.jit
def good_fn(x, carry):
    new_carry = carry + x
    return x * 2, new_carry
```

### Anti-Pattern 5: Mistuning DataLoader num_workers

```python
# BAD: Too many num_workers → out of memory, process spawning overhead
loader = DataLoader(dataset, batch_size=32, num_workers=64)

# BAD: num_workers=0 → data loading becomes a bottleneck
loader = DataLoader(dataset, batch_size=32, num_workers=0)

# GOOD: Set based on CPU and GPU counts
import os
import torch

num_gpus = torch.cuda.device_count()
num_cpus = os.cpu_count()
# Guideline: CPU cores / GPU count, max around 8-16
optimal_workers = min(num_cpus // max(num_gpus, 1), 8)

loader = DataLoader(
    dataset,
    batch_size=32,
    num_workers=optimal_workers,
    pin_memory=True,        # Faster GPU transfer
    persistent_workers=True, # Reuse workers
    prefetch_factor=2,       # Number of batches to prefetch
)
print(f"num_workers: {optimal_workers}")
```

### Anti-Pattern 6: Inadequate Checkpoint Saving

```python
# BAD: Saving only model weights → optimizer state lost when resuming training
torch.save(model.state_dict(), "model.pth")

# GOOD: Save all information needed to resume training
checkpoint = {
    "epoch": epoch,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "scheduler_state_dict": scheduler.state_dict(),
    "scaler_state_dict": scaler.state_dict(),  # Mixed precision
    "best_val_loss": best_val_loss,
    "train_loss_history": train_losses,
    "val_loss_history": val_losses,
    "config": config,  # Hyperparameters
    "rng_state": torch.random.get_rng_state(),
    "cuda_rng_state": torch.cuda.get_rng_state_all(),
}
torch.save(checkpoint, f"checkpoint_epoch{epoch}.pth")

# Restore
checkpoint = torch.load("checkpoint_epoch5.pth", weights_only=False)
model.load_state_dict(checkpoint["model_state_dict"])
optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
start_epoch = checkpoint["epoch"] + 1
```

---

## FAQ

### Q1: Should I learn PyTorch or TensorFlow?

**A:** As of 2024, we recommend learning PyTorch first. Over 90% of academic papers are implemented in PyTorch, and major libraries like HuggingFace are PyTorch-centric. However, TensorFlow remains mature for production deployment (especially mobile). Ideally, know the basics of both. With the advent of Keras 3.0, the approach of writing in Keras and switching backends has also become practical.

### Q2: When should I use JAX?

**A:** (1) When large-scale parallel computing (TPU/multi-GPU) is needed, (2) when implementing custom differentiable algorithms, (3) for scientific computing where vectorization (vmap) is useful. Google DeepMind's latest research is often done in JAX. However, the learning curve is the steepest. If you're unfamiliar with functional programming, it's more efficient to master PyTorch first and then transition to JAX.

### Q3: Which framework is best suited for production model deployment?

**A:** It depends on the deployment target. (1) Web server → TorchServe or TF Serving, (2) Mobile → TFLite (most mature) or PyTorch Mobile, (3) Browser → TF.js, (4) Framework-independent → ONNX Runtime (inference-only, fast). Recently, the pattern of converting to ONNX for unified deployment is growing. If latency is the top priority, TensorRT or ONNX Runtime optimization is effective.

### Q4: When should I use torch.compile?

**A:** Available since PyTorch 2.0. (1) When you want to improve training/inference speed, (2) when you want to speed up existing Eager code without modification. Simply adding `torch.compile(model)` in one line typically yields 1.5-2x speedup. However, models with heavy dynamic control flow (input-dependent if/for) will experience graph breaks, limiting effectiveness. Try `fullgraph=True` to identify where errors occur.

### Q5: Should I always use mixed precision training?

**A:** When training on GPUs (Volta generation or later, with Tensor Cores), you should almost always use it. 50% memory reduction and 2-3x speedup can be achieved with virtually no risk. BFloat16 is recommended for GPUs that support it (Ampere and later), as Loss Scaling is unnecessary and it's more stable. For CPU training or scientific computing where very high precision is critical (e.g., PDE solving), it may be worth maintaining FP32.

### Q6: How do I choose between DDP and FSDP for distributed training?

**A:** If the model fits in a single GPU's memory, DDP is simpler and faster. If the model doesn't fit in a single GPU (billions of parameters), FSDP can shard parameters to overcome memory constraints. For even larger scales (tens of billions of parameters or more), consider frameworks like DeepSpeed or Megatron-LM. Combining tensor parallelism (model parallelism) and pipeline parallelism may also be necessary.

### Q7: Why does ONNX conversion fail?

**A:** Main causes: (1) Unsupported operators (custom operators, special functions), (2) Dynamic control flow (input-dependent if/for), (3) Opset version mismatch. Solutions: (a) Use a higher opset version (17 recommended), (b) Replace problematic operations with standard ones, (c) Check debug information with `torch.onnx.export`'s `verbose=True`. For TensorFlow conversion, use `tf2onnx` with the `--fold_const` option for constant folding to improve success rates.

### Q8: Which experiment management tool should I use?

**A:** (1) **Weights & Biases (wandb)**: Most popular, excellent UI, team-oriented, paid plans available. (2) **MLflow**: Open source, rich model registry features, enterprise-oriented. (3) **TensorBoard**: Made by Google, free, supports both PyTorch/TF, basic visualization. (4) **Neptune.ai**: Strong for team collaboration. For small projects, TensorBoard; for team development, wandb or MLflow is recommended. PyTorch Lightning and Hugging Face Trainer natively support major loggers.

---

## Summary

| Item | Key Points |
|---|---|
| PyTorch | Pythonic, research standard, easy debugging, HuggingFace ecosystem |
| TensorFlow | Keras high-level API, rich production deployment, mobile/web support |
| JAX | Function transformations (jit/grad/vmap/pmap), scientific computing, TPU optimization |
| torch.compile | PyTorch 2.0+, 1.5-2x speedup of Eager code with one line |
| Keras 3.0 | Multi-backend (TF/PyTorch/JAX), same code runs across backends |
| Selection Criteria | Research → PyTorch, Mobile → TF, HPC → JAX |
| Interoperability | Cross-framework migration possible via ONNX format |
| Distributed Training | DDP (data parallel) → FSDP (sharded parallel) → DeepSpeed |
| Mixed Precision | BF16 recommended (Ampere and later), 50% memory reduction, 2-3x speedup |
| Experiment Management | Ensure reproducibility and team collaboration with wandb/MLflow/TensorBoard |

---

## Recommended Next Reads

- [../03-applied/00-nlp.md](../03-applied/00-nlp.md) — NLP Applications (Leveraging Transformers)
- [../03-applied/02-mlops.md](../03-applied/02-mlops.md) — Model Deployment and Operations

---

## References

1. **PyTorch Team** "PyTorch Documentation" — https://pytorch.org/docs/stable/
2. **TensorFlow Team** "TensorFlow Guide" — https://www.tensorflow.org/guide
3. **JAX Team** "JAX Reference Documentation" — https://jax.readthedocs.io/
4. **Flax Team** "Flax Documentation" — https://flax.readthedocs.io/
5. **ONNX Runtime** "ONNX Runtime Documentation" — https://onnxruntime.ai/docs/
6. **PyTorch Lightning** "Lightning Documentation" — https://lightning.ai/docs/
7. **Keras 3.0** "Keras Documentation" — https://keras.io/
8. **Weights & Biases** "Documentation" — https://docs.wandb.ai/
9. **Micikevicius et al.** "Mixed Precision Training" (2018) — https://arxiv.org/abs/1710.03740
