# GPU Computing Guide

> Comprehensive practical knowledge on NVIDIA/AMD GPUs, CUDA, and choosing GPUs for AI training

## What You Will Learn in This Chapter

1. **GPU Architecture** basics — Differences from CPUs, generation-specific features of NVIDIA/AMD
2. **CUDA Ecosystem** — Programming model, key libraries, comparison with ROCm
3. **Choosing GPUs for AI Training** — Spec comparison by use case, cost-performance analysis
4. **VRAM Management and Optimization** — Mixed precision, gradient checkpointing, DeepSpeed/FSDP in practice
5. **Multi-GPU Training** — Design and implementation of DDP, FSDP, and pipeline parallelism


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [AI PCs — NPU-equipped PCs, Copilot+ PCs, Local LLMs, Snapdragon X](./00-ai-pcs.md)

---

## 1. GPU Architecture Basics

### Structural Differences Between CPU and GPU

```
+----------------------------------+   +----------------------------------+
|        CPU (Few but Strong)      |   |       GPU (Massively Parallel)   |
+----------------------------------+   +----------------------------------+
|                                  |   |                                  |
|  +------+  +------+              |   |  +--+ +--+ +--+ +--+ +--+ +--+ |
|  | Core |  | Core |  Large cores |   |  |SM| |SM| |SM| |SM| |SM| |SM| |
|  |(Powerful)|(Powerful)| Few      |   |  +--+ +--+ +--+ +--+ +--+ +--+ |
|  +------+  +------+              |   |  +--+ +--+ +--+ +--+ +--+ +--+ |
|  +------+  +------+              |   |  |SM| |SM| |SM| |SM| |SM| |SM| |
|  | Core |  | Core |              |   |  +--+ +--+ +--+ +--+ +--+ +--+ |
|  |(Powerful)|(Powerful)|          |   |  +--+ +--+ +--+ +--+ +--+ +--+ |
|  +------+  +------+              |   |  |SM| |SM| |SM| |SM| |SM| |SM| |
|                                  |   |  +--+ +--+ +--+ +--+ +--+ +--+ |
|  +---------------------------+   |   |                                  |
|  |     Large Cache            |   |   |  SM = Streaming Multiprocessor  |
|  +---------------------------+   |   |  Small cores x thousands~tens of |
|                                  |   |  thousands                       |
|  Optimized for sequential        |   |  Optimized for parallel          |
|  processing                      |   |  processing                      |
|  Branch prediction,              |   |  Apply same instruction to       |
|  speculative execution           |   |  massive data                    |
+----------------------------------+   +----------------------------------+
```

### Why GPUs Are Well-Suited for AI

```
+-----------------------------------------------------------+
|  Affinity Between AI Computation (Matrix Operations)      |
|  and GPUs                                                 |
+-----------------------------------------------------------+
|                                                           |
|  The essence of neural network computation:               |
|                                                           |
|  Y = W × X + b                                           |
|  (Output = Weight Matrix × Input Vector + Bias)           |
|                                                           |
|  Characteristics of matrix operations:                    |
|  1. Each element's computation is independent             |
|     → Easily parallelizable                               |
|  2. Same operation applied to massive data → SIMD-suited  |
|  3. Regular memory access patterns → Bandwidth utilization|
|                                                           |
|  CPU: 8-64 cores × sequential processing                  |
|       → 1024×1024 matrix multiplication: tens of ms       |
|                                                           |
|  GPU: Thousands~tens of thousands of cores × parallel     |
|       → 1024×1024 matrix multiplication: hundreds of μs   |
|         (100x faster)                                     |
|                                                           |
|  Tensor Core: Dedicated matrix operation units             |
|       → 1024×1024 matrix multiplication: tens of μs       |
|         (another 10x faster)                              |
+-----------------------------------------------------------+
```

### NVIDIA GPU Generation Overview

| Generation | Architecture | Representative Products | Release Year | AI Features |
|------|--------------|---------|--------|-----------|
| Kepler | GK110 | Tesla K80 | 2014 | Early days of GPGPU |
| Pascal | GP100 | Tesla P100, GTX 1080 | 2016 | FP16 support, NVLink |
| Volta | GV100 | Tesla V100 | 2017 | First Tensor Core |
| Turing | TU102 | RTX 2080 Ti | 2018 | RT Core, INT8 inference |
| Ampere | GA100/GA102 | A100, RTX 3090 | 2020 | TF32, structured sparsity |
| Hopper | GH100 | H100 | 2022 | FP8, Transformer Engine |
| Blackwell | GB100/GB202 | B200, RTX 5090 | 2024-25 | FP4, 2nd-gen Transformer Engine |

### NVIDIA GPU Detailed Spec Comparison

| Item | RTX 4090 | A100 80GB | H100 SXM | B200 |
|------|---------|----------|----------|------|
| CUDA Cores | 16,384 | 6,912 | 14,592 | 18,432 |
| Tensor Core | 512 (4th gen) | 432 (3rd gen) | 528 (4th gen) | 576 (5th gen) |
| VRAM | 24GB GDDR6X | 80GB HBM2e | 80GB HBM3 | 192GB HBM3e |
| Memory Bandwidth | 1,008 GB/s | 2,039 GB/s | 3,350 GB/s | 8,000 GB/s |
| FP32 Performance | 82.6 TFLOPS | 19.5 TFLOPS | 66.9 TFLOPS | 90 TFLOPS |
| BF16 Tensor | 660 TFLOPS | 312 TFLOPS | 990 TFLOPS | 2,250 TFLOPS |
| FP8 Tensor | 1,321 TFLOPS | - | 1,979 TFLOPS | 4,500 TFLOPS |
| TDP | 450W | 300W | 700W | 1,000W |
| NVLink | None | 600 GB/s | 900 GB/s | 1,800 GB/s |
| Price Range | ~$1,600 | ~$15,000 | ~$30,000 | ~$40,000 |

### SM (Streaming Multiprocessor) Internal Structure

```
+-----------------------------------------------------------+
|  SM (Streaming Multiprocessor) — Hopper H100              |
+-----------------------------------------------------------+
|                                                           |
|  +-------+  +-------+  +-------+  +-------+              |
|  |FP32   |  |FP32   |  |FP32   |  |FP32   |  128 FP32   |
|  |Core x32| |Core x32| |Core x32| |Core x32|  CUDA Cores|
|  +-------+  +-------+  +-------+  +-------+              |
|                                                           |
|  +-------+  +-------+  +-------+  +-------+              |
|  |INT32  |  |INT32  |  |INT32  |  |INT32  |  128 INT32  |
|  |Core x32| |Core x32| |Core x32| |Core x32|  Cores     |
|  +-------+  +-------+  +-------+  +-------+              |
|                                                           |
|  +--------------------------------------------------+    |
|  | Tensor Core × 4 (4th Generation)                  |    |
|  | Supports FP64, TF32, BF16, FP16, FP8, INT8        |    |
|  | 1 Tensor Core = 4×4×4 matrix op in 1 clock cycle  |    |
|  +--------------------------------------------------+    |
|                                                           |
|  +--------------------------------------------------+    |
|  | Shared Memory / L1 Cache: 228 KB (configurable)   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  +--------------------------------------------------+    |
|  | Warp Scheduler × 4                                |    |
|  | Manages warps of 32 threads each                  |    |
|  +--------------------------------------------------+    |
|                                                           |
|  H100: 132 SMs → 16,896 FP32 CUDA Cores                  |
|  B200:  160 SMs → 18,432 FP32 CUDA Cores (estimated)     |
+-----------------------------------------------------------+
```

---

## 2. CUDA Ecosystem

### CUDA Software Stack

```
+-------------------------------------------------------+
|                  Application Layer                      |
|  PyTorch / TensorFlow / JAX / DeepSpeed                |
+-------------------------------------------------------+
|                  Library Layer                          |
|  cuDNN / cuBLAS / NCCL / TensorRT / Triton             |
+-------------------------------------------------------+
|                  Runtime Layer                          |
|  CUDA Runtime API / CUDA Driver API                    |
+-------------------------------------------------------+
|                  Driver Layer                           |
|  NVIDIA GPU Driver                                     |
+-------------------------------------------------------+
|                  Hardware Layer                         |
|  NVIDIA GPU (SM, Tensor Core, HBM)                     |
+-------------------------------------------------------+
```

### Roles of Key CUDA Libraries

```
+-----------------------------------------------------------+
|  CUDA Library Hierarchy                                    |
+-----------------------------------------------------------+
|                                                           |
|  cuBLAS — Linear Algebra (BLAS: Basic Linear Algebra      |
|           Subprograms)                                    |
|  +-- Ultra-fast implementation of matrix multiplication   |
|      (GEMM)                                               |
|  +-- Runs behind PyTorch's torch.mm()                     |
|  +-- Supports FP64/FP32/FP16/BF16/FP8/INT8               |
|                                                           |
|  cuDNN — Deep Learning Primitives                         |
|  +-- Optimized convolution implementations                |
|  +-- BatchNorm, Pooling, Activation, RNN                  |
|  +-- Automatically selects fastest algorithm from         |
|      multiple candidates                                  |
|                                                           |
|  NCCL — Multi-GPU Communication                           |
|  +-- AllReduce, AllGather, ReduceScatter                  |
|  +-- NVLink / NVSwitch support                            |
|  +-- Communication backend for DDP/FSDP                   |
|                                                           |
|  TensorRT — Inference Optimization                        |
|  +-- Graph optimization (layer fusion, dead op removal)   |
|  +-- Quantization (FP16/INT8/FP8/INT4)                    |
|  +-- Dynamic shape support                                |
|                                                           |
|  cuFFT — Fast Fourier Transform                           |
|  cuSPARSE — Sparse Matrix Operations                      |
|  cuRAND — Random Number Generation                        |
+-----------------------------------------------------------+
```

### Code Example 1: Basic Structure of a CUDA Kernel

```cuda
// vector_add.cu — CUDA kernel for vector addition
#include <stdio.h>

// Kernel function executed on the GPU
__global__ void vectorAdd(float *a, float *b, float *c, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

int main() {
    int n = 1000000;
    size_t size = n * sizeof(float);

    // Allocate host (CPU) memory
    float *h_a = (float*)malloc(size);
    float *h_b = (float*)malloc(size);
    float *h_c = (float*)malloc(size);

    // Allocate device (GPU) memory
    float *d_a, *d_b, *d_c;
    cudaMalloc(&d_a, size);
    cudaMalloc(&d_b, size);
    cudaMalloc(&d_c, size);

    // Host → Device transfer
    cudaMemcpy(d_a, h_a, size, cudaMemcpyHostToDevice);
    cudaMemcpy(d_b, h_b, size, cudaMemcpyHostToDevice);

    // Launch kernel: 256 threads/block
    int blockSize = 256;
    int numBlocks = (n + blockSize - 1) / blockSize;
    vectorAdd<<<numBlocks, blockSize>>>(d_a, d_b, d_c, n);

    // Device → Host transfer
    cudaMemcpy(h_c, d_c, size, cudaMemcpyDeviceToHost);

    // Free memory
    cudaFree(d_a); cudaFree(d_b); cudaFree(d_c);
    free(h_a); free(h_b); free(h_c);
    return 0;
}
```

### CUDA Execution Model Hierarchy

```
+-----------------------------------------------------------+
|  CUDA Execution Model                                      |
+-----------------------------------------------------------+
|                                                           |
|  Grid ← One kernel launch                                 |
|  +---+---+---+---+                                        |
|  | B | B | B | B |  Block × many                          |
|  +---+---+---+---+                                        |
|  | B | B | B | B |  Each block is assigned to one SM      |
|  +---+---+---+---+                                        |
|                                                           |
|  Inside a Block:                                          |
|  +---+---+---+---+---+---+---+---+                        |
|  | T | T | T | T | T | T | T | T |  Thread × up to 1024  |
|  +---+---+---+---+---+---+---+---+                        |
|  | T | T | T | T | T | T | T | T |                        |
|  +---+---+---+---+---+---+---+---+                        |
|                                                           |
|  Warp:                                                     |
|  +---+---+---+---+  ...  +---+---+                        |
|  | T | T | T | T |  ...  | T | T |  32 threads execute    |
|  +---+---+---+---+  ...  +---+---+  in lockstep           |
|                                                           |
|  threadIdx.x: Thread ID within a block                     |
|  blockIdx.x:  Block ID within the grid                     |
|  blockDim.x:  Number of threads per block                  |
|  Global ID = blockIdx.x * blockDim.x + threadIdx.x        |
+-----------------------------------------------------------+
```

### Code Example 2: GPU Utilization in PyTorch

```python
import torch
import torch.nn as nn

# Check if GPU is available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")
print(f"GPU: {torch.cuda.get_device_name(0)}")
print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

# Transfer model to GPU
model = nn.Sequential(
    nn.Linear(784, 512),
    nn.ReLU(),
    nn.Linear(512, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
).to(device)

# Transfer data to GPU
x = torch.randn(64, 784).to(device)

# Mixed precision training (AMP)
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()
optimizer = torch.optim.Adam(model.parameters())

with autocast():  # Fast computation in FP16
    output = model(x)
    loss = nn.CrossEntropyLoss()(output, target.to(device))

scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()
```

### Code Example 3: Multi-GPU Training (DDP)

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

def setup(rank, world_size):
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def train(rank, world_size):
    setup(rank, world_size)

    model = MyModel().to(rank)
    model = DDP(model, device_ids=[rank])

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(num_epochs):
        for batch in dataloader:
            inputs, targets = batch
            inputs = inputs.to(rank)
            targets = targets.to(rank)

            loss = model(inputs, targets)
            loss.backward()     # Gradients are automatically synchronized across all GPUs
            optimizer.step()
            optimizer.zero_grad()

# Launch: torchrun --nproc_per_node=4 train.py
```

### Code Example 4: FSDP (Fully Sharded Data Parallel)

```python
import torch
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy,
)
from torch.distributed.fsdp.wrap import (
    transformer_auto_wrap_policy,
)
import functools

# FSDP mixed precision policy
mixed_precision_policy = MixedPrecision(
    param_dtype=torch.bfloat16,      # Parameters: BF16
    reduce_dtype=torch.bfloat16,     # Gradient sync: BF16
    buffer_dtype=torch.bfloat16,     # Buffers: BF16
)

# Shard at transformer layer granularity
auto_wrap_policy = functools.partial(
    transformer_auto_wrap_policy,
    transformer_layer_cls={TransformerDecoderLayer},
)

# Wrap model with FSDP
model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,  # Equivalent to ZeRO-3
    mixed_precision=mixed_precision_policy,
    auto_wrap_policy=auto_wrap_policy,
    device_id=torch.cuda.current_device(),
)

# Can be used with the same training loop as DDP
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

for batch in dataloader:
    loss = model(batch)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()

# FSDP vs DDP memory comparison (7B model, BF16)
# DDP:  Full parameter copy on each GPU → 14GB/GPU × 4 = 56GB
# FSDP: Parameters sharded → 3.5GB/GPU × 4 = 14GB (reconstructed during computation)
```

---

## 3. NVIDIA vs AMD Comparison

### GPU Ecosystem Comparison Table

| Item | NVIDIA (CUDA) | AMD (ROCm) |
|------|--------------|------------|
| Programming Language | CUDA C/C++ | HIP (nearly identical syntax to CUDA) |
| Deep Learning | cuDNN, TensorRT | MIOpen |
| Communication Library | NCCL | RCCL |
| Linear Algebra | cuBLAS | rocBLAS |
| Framework Support | Full support for PyTorch, TF, JAX | PyTorch supported, JAX limited |
| Cloud Support | Full support on AWS, GCP, Azure | Azure (MI300X), limited |
| Ecosystem Maturity | Very high | Growing |
| Cost-Performance | Expensive but stable | Competitive pricing, driver improving |

### AMD MI300X's Position

```
+-----------------------------------------------------------+
|  AMD MI300X — A Contender Against NVIDIA                   |
+-----------------------------------------------------------+
|                                                           |
|  Specs:                                                    |
|  +-- HBM3: 192GB (2.4x H100's 80GB)                      |
|  +-- Memory bandwidth: 5.3 TB/s (1.6x H100's 3.35 TB/s)  |
|  +-- FP16: 1,307 TFLOPS                                   |
|  +-- TDP: 750W                                             |
|                                                           |
|  Advantages:                                               |
|  +-- Massive VRAM → advantageous for large LLM inference   |
|  +-- Can fit Llama 70B on a single chip                    |
|  +-- Available via Azure ND MI300X v5                      |
|                                                           |
|  Challenges:                                               |
|  +-- ROCm software ecosystem still maturing               |
|  +-- Some CUDA kernel-dependent libraries may not work     |
|  +-- Flash Attention ROCm support tends to lag             |
|  +-- Debugging tools not as mature as CUDA                 |
|                                                           |
|  Recommended Use Cases:                                    |
|  +-- Large-scale LLM inference (when VRAM is bottleneck)   |
|  +-- Standard PyTorch-based training                       |
|  +-- H100 alternative in Azure environments                |
+-----------------------------------------------------------+
```

### Tensor Core Precision Modes

```
+-------------------------------------------------------+
|  Tensor Core Precision Modes (Hopper H100 and later)   |
+-------------------------------------------------------+
|                                                       |
|  FP64  ███████████████████████████████  Highest       |
|        precision                                      |
|        Scientific computing, simulations              |
|                                                       |
|  TF32  ██████████████████  19-bit mantissa            |
|        FP32 replacement, default for training         |
|                                                       |
|  FP16  ████████████  Half-precision floating point    |
|        Mixed precision training (AMP)                 |
|                                                       |
|  BF16  ████████████  Brain Floating Point             |
|        Standard for large-scale LLM training          |
|                                                       |
|  FP8   ████████  8-bit floating point                 |
|        Inference optimization, Hopper and later       |
|                                                       |
|  INT8  ████████  8-bit integer                        |
|        Quantized inference                            |
|                                                       |
|  FP4   ████  4-bit floating point                     |
|        Blackwell and later, ultra-low precision       |
|        inference                                      |
+-------------------------------------------------------+
```

### Detailed Precision Format Comparison

| Format | Bits | Exponent | Mantissa | Range | Primary Use |
|-------------|---------|--------|--------|------|---------|
| FP32 | 32 | 8 | 23 | ±3.4e38 | Inference (high precision) |
| TF32 | 19 | 8 | 10 | ±3.4e38 | Training (Ampere+ default) |
| BF16 | 16 | 8 | 7 | ±3.4e38 | Standard for LLM training |
| FP16 | 16 | 5 | 10 | ±6.5e4 | Mixed precision training |
| FP8 (E4M3) | 8 | 4 | 3 | ±448 | Inference (Hopper+) |
| FP8 (E5M2) | 8 | 5 | 2 | ±57344 | Training gradients |
| INT8 | 8 | - | - | -128 to 127 | Quantized inference |
| FP4 (E2M1) | 4 | 2 | 1 | ±6 | Ultra-low precision inference (Blackwell) |
| INT4 | 4 | - | - | -8 to 7 | GPTQ/AWQ quantized inference |

---

## 4. Choosing GPUs for AI Training

### Code Example 5: GPU Spec Check Script

```python
import torch
import subprocess

def gpu_info():
    if not torch.cuda.is_available():
        print("No CUDA GPU found")
        return

    for i in range(torch.cuda.device_count()):
        props = torch.cuda.get_device_properties(i)
        print(f"=== GPU {i}: {props.name} ===")
        print(f"  Compute Capability: {props.major}.{props.minor}")
        print(f"  Total VRAM: {props.total_mem / 1e9:.1f} GB")
        print(f"  SM Count: {props.multi_processor_count}")
        print(f"  Max Threads/SM: {props.max_threads_per_multi_processor}")

    # Detailed info via nvidia-smi
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total,power.max_limit,temperature.gpu",
         "--format=csv,noheader"],
        capture_output=True, text=True
    )
    print(f"\nnvidia-smi:\n{result.stdout}")

gpu_info()
```

### Code Example 6: VRAM Usage Estimation

```python
def estimate_vram_for_training(
    param_count_billion: float,
    precision: str = "bf16",
    optimizer: str = "adam",
    batch_size: int = 1,
    seq_length: int = 2048,
) -> dict:
    """Estimate VRAM required for LLM training"""

    bytes_per_param = {
        "fp32": 4, "tf32": 4, "bf16": 2, "fp16": 2, "fp8": 1
    }[precision]

    params_bytes = param_count_billion * 1e9 * bytes_per_param

    # Optimizer states (Adam: 2x parameters)
    optimizer_multiplier = {"adam": 2, "adamw": 2, "sgd": 0, "adafactor": 0.5}
    opt_bytes = param_count_billion * 1e9 * 4 * optimizer_multiplier[optimizer]

    # Gradients (same size as parameters)
    grad_bytes = params_bytes

    # Activation memory (rough estimate)
    activation_bytes = batch_size * seq_length * param_count_billion * 1e9 * 2 / 1000

    total_gb = (params_bytes + opt_bytes + grad_bytes + activation_bytes) / 1e9

    return {
        "Model Parameters": f"{params_bytes / 1e9:.1f} GB",
        "Optimizer States": f"{opt_bytes / 1e9:.1f} GB",
        "Gradients": f"{grad_bytes / 1e9:.1f} GB",
        "Activations (estimate)": f"{activation_bytes / 1e9:.1f} GB",
        "Total (estimate)": f"{total_gb:.1f} GB",
    }

# VRAM needed to train a 7B model
print(estimate_vram_for_training(7, "bf16", "adam"))
# Model Parameters: 14.0 GB
# Optimizer States: 56.0 GB
# Gradients: 14.0 GB
# Total: ~100 GB → Requires H100 80GB x2 or A100 80GB x2
```

### Code Example 7: Inference VRAM Estimation

```python
def estimate_vram_for_inference(
    param_count_billion: float,
    precision: str = "fp16",
    batch_size: int = 1,
    seq_length: int = 2048,
    kv_cache: bool = True,
    num_layers: int = None,
    num_heads: int = None,
    head_dim: int = 128,
) -> dict:
    """Estimate VRAM required for LLM inference"""

    bytes_per_param = {
        "fp32": 4, "fp16": 2, "bf16": 2, "int8": 1,
        "int4": 0.5, "fp8": 1, "gptq_4bit": 0.5, "awq_4bit": 0.5,
    }[precision]

    # Model weights
    model_bytes = param_count_billion * 1e9 * bytes_per_param

    # KV cache (LLM-specific memory consumption)
    kv_bytes = 0
    if kv_cache and num_layers and num_heads:
        # KV cache = 2 (K+V) * batch * layers * heads * head_dim * seq * dtype_size
        kv_bytes = (2 * batch_size * num_layers * num_heads
                    * head_dim * seq_length * 2)  # FP16

    # Temporary buffers (~10% overhead)
    overhead = (model_bytes + kv_bytes) * 0.1

    total_gb = (model_bytes + kv_bytes + overhead) / 1e9

    return {
        "Model Weights": f"{model_bytes / 1e9:.1f} GB",
        "KV Cache": f"{kv_bytes / 1e9:.1f} GB",
        "Overhead": f"{overhead / 1e9:.1f} GB",
        "Total": f"{total_gb:.1f} GB",
        "Recommended GPU": recommend_gpu(total_gb),
    }

def recommend_gpu(vram_needed_gb):
    """Recommend GPU based on required VRAM"""
    gpus = [
        (16, "RTX 4060 Ti 16GB"),
        (24, "RTX 4090"),
        (48, "RTX 6000 Ada / A6000"),
        (80, "A100 80GB / H100 80GB"),
        (192, "MI300X"),
    ]
    for vram, name in gpus:
        if vram_needed_gb <= vram * 0.9:  # 90% upper limit
            return name
    return "Multi-GPU configuration required"

# Inference VRAM for Llama 2 7B (various precisions)
for prec in ["fp16", "int8", "int4"]:
    result = estimate_vram_for_inference(
        7, prec, batch_size=1, seq_length=4096,
        num_layers=32, num_heads=32, head_dim=128
    )
    print(f"Llama-2-7B ({prec}): {result['Total']} → {result['Recommended GPU']}")
# fp16: 15.4 GB → RTX 4090
# int8: 8.5 GB  → RTX 4060 Ti 16GB
# int4: 5.0 GB  → RTX 4060 Ti 16GB
```

### GPU Recommendation by Use Case

| Use Case | Recommended GPU | VRAM | Estimated Budget | Notes |
|------|---------|------|---------|------|
| Learning/Inference Beginner | RTX 4060 Ti 16GB | 16GB | ~$400 | Entry-level fine-tuning |
| Mid-scale Training | RTX 4090 | 24GB | ~$1,600 | 7B model inference, small-scale training |
| Serious Training | A100 80GB (cloud) | 80GB | Hourly billing | 7-13B model training |
| Large-scale LLM | H100 80GB (cloud) | 80GB | Hourly billing | 70B+ models, multi-GPU |
| Inference Optimization | L4 / T4 (cloud) | 24GB / 16GB | Low cost | Quantized model inference serving |
| Edge Inference | Jetson Orin | 8-64GB | ~$500-$3,000 | Local inference |
| Ultra-large LLM Inference | MI300X (Azure) | 192GB | Hourly billing | 70B+ inference on a single chip |

---

## 5. VRAM Management and Optimization Techniques

### Memory Optimization Methods Comparison

| Method | VRAM Reduction | Speed Impact | Accuracy Impact | Implementation Difficulty |
|------|-----------|---------|---------|---------|
| Mixed Precision Training (AMP) | ~40% | Faster | Negligible | Low |
| Gradient Checkpointing | ~60% | 20-30% slower | None | Low |
| DeepSpeed ZeRO-1 | ~40% | Slightly slower | None | Medium |
| DeepSpeed ZeRO-2 | ~60% | Slightly slower | None | Medium |
| DeepSpeed ZeRO-3 | ~80% | Communication overhead | None | Medium |
| LoRA / QLoRA | ~90% | Faster | Slightly lower | Low |
| 4-bit Quantization (inference) | ~75% | Slightly slower | Model-dependent | Low |
| Flash Attention 2 | 50% activation reduction | Faster | None | Low |
| Paged Attention (vLLM) | 50% KV reduction | Same | None | Automatic |

### Code Example 8: Gradient Checkpointing Implementation

```python
import torch
import torch.nn as nn
from torch.utils.checkpoint import checkpoint

class LargeTransformerBlock(nn.Module):
    """Transformer block with gradient checkpointing support"""

    def __init__(self, d_model=1024, nhead=16, use_checkpoint=True):
        super().__init__()
        self.use_checkpoint = use_checkpoint
        self.self_attn = nn.MultiheadAttention(d_model, nhead, batch_first=True)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_model * 4),
            nn.GELU(),
            nn.Linear(d_model * 4, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)

    def _forward_impl(self, x):
        """Actual forward computation"""
        # Self-Attention
        residual = x
        x = self.norm1(x)
        x, _ = self.self_attn(x, x, x)
        x = residual + x

        # Feed-Forward
        residual = x
        x = self.norm2(x)
        x = self.ffn(x)
        x = residual + x

        return x

    def forward(self, x):
        if self.use_checkpoint and self.training:
            # Gradient checkpointing: don't save intermediate results
            # of forward pass, recompute during backward pass → memory savings
            return checkpoint(self._forward_impl, x, use_reentrant=False)
        return self._forward_impl(x)

# Memory usage comparison
# Without checkpointing: activation memory ∝ number of layers
# With checkpointing:    activation memory ∝ √(number of layers)
# Example: 32 layers → activation memory reduced to ~1/5
```

### Code Example 9: DeepSpeed ZeRO Configuration

```python
# DeepSpeed ZeRO-3 configuration example
# deepspeed_config.json
deepspeed_config = {
    "train_batch_size": 32,
    "gradient_accumulation_steps": 4,
    "gradient_clipping": 1.0,

    # FP16/BF16 settings
    "bf16": {
        "enabled": True
    },

    # ZeRO Stage 3: Partition parameters + gradients + optimizer states across all GPUs
    "zero_optimization": {
        "stage": 3,
        "offload_optimizer": {
            "device": "cpu",           # Offload optimizer states to CPU
            "pin_memory": True
        },
        "offload_param": {
            "device": "cpu",           # Offload parameters to CPU (maximum savings)
            "pin_memory": True
        },
        "overlap_comm": True,          # Overlap communication and computation
        "contiguous_gradients": True,
        "sub_group_size": 1e9,
        "reduce_bucket_size": 5e8,
        "stage3_prefetch_bucket_size": 5e8,
        "stage3_param_persistence_threshold": 1e6,
        "stage3_max_live_parameters": 1e9,
        "stage3_max_reuse_distance": 1e9,
        "stage3_gather_16bit_weights_on_model_save": True,
    },

    # Optimizer
    "optimizer": {
        "type": "AdamW",
        "params": {
            "lr": 1e-4,
            "betas": [0.9, 0.999],
            "eps": 1e-8,
            "weight_decay": 0.01
        }
    },

    # Learning rate scheduler
    "scheduler": {
        "type": "WarmupDecayLR",
        "params": {
            "warmup_min_lr": 0,
            "warmup_max_lr": 1e-4,
            "warmup_num_steps": 1000,
            "total_num_steps": 100000
        }
    }
}

# ZeRO Stage comparison (7B model, 4 GPUs)
# Stage 0 (DDP):  Full parameter replication   → 100GB per GPU needed
# Stage 1:        Optimizer state partitioning  → 72GB per GPU
# Stage 2:        + Gradient partitioning       → 58GB per GPU
# Stage 3:        + Parameter partitioning      → 30GB per GPU
# Stage 3+Offload: + CPU offloading            → 5GB per GPU (uses CPU memory)
```

### Code Example 10: Memory-Efficient Fine-Tuning with LoRA

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load base model (further memory reduction with quantization)
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,                    # 4-bit quantization
    bnb_4bit_quant_type="nf4",            # NormalFloat4
    bnb_4bit_compute_dtype=torch.bfloat16, # Compute in BF16
    bnb_4bit_use_double_quant=True,       # Double quantization
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    quantization_config=bnb_config,
    device_map="auto",
)

# LoRA configuration
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                    # LoRA rank (lower = fewer parameters)
    lora_alpha=32,           # Scaling factor
    lora_dropout=0.05,
    target_modules=[         # Layers to apply LoRA
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    bias="none",
)

# Apply LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 20,971,520 (0.31%)
# all params: 6,758,404,096
# → Only 0.31% of all parameters are trained

# VRAM usage comparison (Llama-2-7B)
# Full training (BF16):    ~100 GB (requires 4x A100)
# LoRA (BF16):             ~18 GB (possible on 1x A100)
# QLoRA (4bit+LoRA):       ~6 GB (possible on RTX 4060 Ti 16GB)
```

---

## 6. NVLink and Multi-GPU Topology

### NVLink Generations and Bandwidth

```
+-----------------------------------------------------------+
|  Evolution of NVLink                                       |
+-----------------------------------------------------------+
|                                                           |
|  NVLink 1.0 (Pascal, 2016):   80 GB/s (bidirectional 160)|
|  NVLink 2.0 (Volta, 2017):   150 GB/s (bidirectional 300)|
|  NVLink 3.0 (Ampere, 2020):  300 GB/s (bidirectional 600)|
|  NVLink 4.0 (Hopper, 2022):  450 GB/s (bidirectional 900)|
|  NVLink 5.0 (Blackwell, 2024): 900 GB/s (bidirectional   |
|                                           1800)           |
|                                                           |
|  Comparison: PCIe 5.0 x16 = 64 GB/s (bidirectional 128)  |
|  → NVLink 4.0 is ~7x the bandwidth of PCIe               |
|                                                           |
|  NVSwitch (Hopper):                                       |
|  +-- All-to-all connectivity for 8 GPUs                   |
|  +-- 900 GB/s between any two GPUs                        |
|  +-- DGX H100: 8x H100 + NVSwitch configuration          |
|                                                           |
|  Why it matters:                                           |
|  +-- Faster gradient synchronization in multi-GPU training|
|  +-- Makes tensor parallelism (splitting model across     |
|      multiple GPUs) practical                             |
|  +-- Essential for Megatron-LM pipeline parallelism       |
+-----------------------------------------------------------+
```

### Multi-GPU Training Parallelism Strategies

```
+-----------------------------------------------------------+
|  Comparison of Parallelism Strategies                      |
+-----------------------------------------------------------+
|                                                           |
|  Data Parallel (Data Parallel / DDP)                       |
|  +-- Copy the same model to all GPUs                      |
|  +-- Split data and distribute to each GPU                |
|  +-- Synchronize gradients via AllReduce                   |
|  +-- Simple, scalable                                     |
|  +-- Constraint: model must fit on a single GPU           |
|                                                           |
|  Tensor Parallel                                           |
|  +-- Split weight matrices of each layer across GPUs      |
|  +-- Requires NVLink (frequent high-bandwidth             |
|      communication)                                       |
|  +-- Used across 2-8 GPUs within a single node            |
|  +-- Megatron-LM is the representative implementation     |
|                                                           |
|  Pipeline Parallel                                         |
|  +-- Split layers across multiple GPUs (e.g., first/      |
|      second half)                                         |
|  +-- Microbatches keep each GPU busy in parallel          |
|  +-- Can be used across nodes                             |
|  +-- Efficiency loss due to pipeline bubbles              |
|                                                           |
|  FSDP (Fully Sharded Data Parallel)                       |
|  +-- ZeRO-3: Shard parameters + gradients + optimizer     |
|      states                                               |
|  +-- Gather parameters for computation, release after     |
|  +-- Native PyTorch implementation                        |
+-----------------------------------------------------------+
```

---

## 7. GPU Profiling and Optimization

### Code Example 11: Bottleneck Analysis with PyTorch Profiler

```python
import torch
from torch.profiler import profile, record_function, ProfilerActivity

# Profiler configuration
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=torch.profiler.schedule(
        wait=1,        # Wait 1 batch
        warmup=1,      # Warm up 1 batch
        active=3,      # Profile 3 batches
        repeat=1,
    ),
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./logs/profiler'),
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step, batch in enumerate(dataloader):
        if step >= 6:
            break

        with record_function("data_transfer"):
            inputs = batch["input"].to(device)
            labels = batch["label"].to(device)

        with record_function("forward"):
            outputs = model(inputs)
            loss = criterion(outputs, labels)

        with record_function("backward"):
            loss.backward()

        with record_function("optimizer_step"):
            optimizer.step()
            optimizer.zero_grad()

        prof.step()

# Display profiling results
print(prof.key_averages().table(
    sort_by="cuda_time_total",
    row_limit=20,
))

# Common bottlenecks:
# 1. DataLoader → increase num_workers, pin_memory=True
# 2. CPU-GPU transfer → async transfer, prefetching
# 3. Many small kernels in sequence → kernel fusion, torch.compile()
# 4. Synchronization points → use async AllReduce
```

### Code Example 12: Kernel Fusion with torch.compile()

```python
import torch

# PyTorch 2.0+ torch.compile()
# JIT compilation to automatically fuse kernels for speedup

model = MyModel().to(device)

# Compile (slow on first run, fast thereafter)
compiled_model = torch.compile(
    model,
    mode="max-autotune",  # Maximum optimization (longer compile time)
    # mode="reduce-overhead",  # Prioritize overhead reduction
    # mode="default",          # Balanced
    fullgraph=True,       # Optimize entire graph
    dynamic=False,        # Static shapes (set True for dynamic shapes)
)

# Usage remains the same
output = compiled_model(input_tensor)

# How it achieves speedup:
# 1. Triton kernel generation: fuse multiple ops into a single GPU kernel
# 2. Memory optimization: reduce intermediate tensor allocations
# 3. Auto-tuning: search for optimal block sizes
#
# Typical speedup:
# - Inference: 1.3-2.0x
# - Training: 1.1-1.5x
# - Particularly effective for Transformer models
```

### Code Example 13: Leveraging Flash Attention 2

```python
import torch
from flash_attn import flash_attn_func

# Flash Attention 2: Memory-efficient Attention implementation
# Standard Attention: O(N^2) memory → Flash: O(N) memory

# Standard Attention (memory-inefficient)
def standard_attention(q, k, v):
    # q, k, v: (batch, seq_len, num_heads, head_dim)
    scores = torch.matmul(q, k.transpose(-2, -1)) / (q.size(-1) ** 0.5)
    # scores: (batch, num_heads, seq_len, seq_len) ← O(N^2) memory!
    attn = torch.softmax(scores, dim=-1)
    output = torch.matmul(attn, v)
    return output

# Flash Attention 2 (memory-efficient)
def flash_attention(q, k, v):
    # Input shape: (batch, seq_len, num_heads, head_dim)
    output = flash_attn_func(
        q, k, v,
        dropout_p=0.0,
        softmax_scale=None,  # Auto-calculated
        causal=True,         # Causal mask (for LLMs)
    )
    return output

# Memory usage comparison (batch=4, seq=8192, heads=32, dim=128)
# Standard Attention: 8192^2 * 32 * 4 * 2 bytes = 16 GB (attention matrix)
# Flash Attention: O(N) ≈ a few MB (tiled sequential computation)
#
# Speed comparison:
# Standard: ~150ms
# Flash Attention 2: ~30ms (5x faster)
#
# In PyTorch 2.0+, automatically used via F.scaled_dot_product_attention()
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Ignoring VRAM Shortage During Training

```python
# BAD: Not handling OOM (Out of Memory)
model = LargeModel().to("cuda")
# RuntimeError: CUDA out of memory

# GOOD: Apply memory countermeasures progressively
# 1. Reduce batch size
# 2. Use gradient accumulation
# 3. Enable AMP (mixed precision)
# 4. Enable gradient checkpointing
# 5. Introduce DeepSpeed / FSDP
# 6. Reduce parameters with LoRA / QLoRA
```

### Anti-Pattern 2: Not Monitoring GPU Utilization

```bash
# BAD: Start training and walk away
python train.py &

# GOOD: Continuously monitor GPU utilization
watch -n 1 nvidia-smi
# Verify GPU-Util is 90%+
# Verify Memory-Usage is appropriate

# More detailed monitoring
nvidia-smi dmon -s pucvmet -d 1
```

### Anti-Pattern 3: DataLoader Bottleneck

```python
# BAD: GPU idling while waiting for data
dataloader = DataLoader(dataset, batch_size=32)
# GPU-Util: 30-50% (data transfer is the bottleneck)

# GOOD: Optimize the DataLoader
dataloader = DataLoader(
    dataset,
    batch_size=32,
    num_workers=8,           # Parallel data loading
    pin_memory=True,         # Page-locked memory (faster transfers)
    persistent_workers=True, # Prevent worker restarts
    prefetch_factor=4,       # Number of batches to prefetch
)
# GPU-Util: 95%+
```

### Anti-Pattern 4: Training Without Mixed Precision

```python
# BAD: Training in FP32 only (slow, high memory usage)
output = model(input)
loss = criterion(output, target)
loss.backward()
optimizer.step()

# GOOD: Use AMP (Automatic Mixed Precision)
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

with autocast(dtype=torch.bfloat16):  # Compute in BF16
    output = model(input)
    loss = criterion(output, target)

scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()

# Benefits:
# - Speed: 1.5-3x faster
# - Memory: 30-50% reduction
# - Accuracy: Nearly equivalent (with BF16)
```

### Anti-Pattern 5: Not Using torch.compile()

```python
# BAD: Not using compile on PyTorch 2.0+
model = MyModel().to(device)
# → Individual CUDA kernels launched sequentially (high overhead)

# GOOD: Kernel fusion with torch.compile()
model = torch.compile(model, mode="reduce-overhead")
# → Multiple operations fused into a single kernel (20-50% speedup)

# Caveats:
# - Initial compilation takes several minutes
# - Effectiveness decreases with dynamic shapes (variable batch sizes, etc.)
# - Some operations (custom ops, etc.) may not be supported for compilation
```

---

## 9. Understanding NVIDIA Enterprise Products

### DGX / HGX / SuperPOD Configurations

```
+-----------------------------------------------------------+
|  NVIDIA AI Infrastructure Hierarchy                        |
+-----------------------------------------------------------+
|                                                           |
|  DGX H100 (1 node)                                        |
|  +-- 8x H100 SXM (640GB VRAM)                            |
|  +-- All GPUs connected via NVSwitch at 900GB/s           |
|  +-- 2x Intel Xeon                                        |
|  +-- 2TB System Memory                                    |
|  +-- 8x ConnectX-7 (400Gbps InfiniBand)                   |
|  +-- Price: ~$300,000                                      |
|                                                           |
|  HGX H100 (baseboard)                                      |
|  +-- GPU board portion of DGX only (for OEMs)             |
|  +-- Integrated into servers by Dell, HPE, Lenovo, etc.   |
|                                                           |
|  DGX SuperPOD (cluster)                                    |
|  +-- 32-256 DGX H100 nodes                                |
|  +-- All nodes connected via InfiniBand                    |
|  +-- 256 nodes = 2,048 H100 GPUs                          |
|  +-- Up to ~40 EFLOPS (FP8)                               |
|  +-- Capable of training GPT-4 class models               |
|                                                           |
|  DGX Cloud                                                 |
|  +-- DGX SuperPOD available in the cloud                  |
|  +-- Via AWS, GCP, Azure, Oracle                           |
|  +-- Monthly subscription                                 |
+-----------------------------------------------------------+
```

---

## FAQ

### Q1. What are the differences between consumer GPUs (GeForce) and data center GPUs (A100/H100)?

The main differences are VRAM capacity (24GB vs 80GB), memory bandwidth (ECC HBM3 vs GDDR6X), NVLink connectivity (multi-GPU communication speed), FP64 performance, and durability for 24/7 continuous operation. VRAM and NVLink are particularly important for training. For personal use, the RTX 4090 offers the best cost-performance ratio. Note that the GeForce RTX 4090 does not support NVLink, so multi-GPU training is limited to slower PCIe communication.

### Q2. What about CUDA version and driver compatibility?

CUDA has forward compatibility, meaning newer drivers can run applications built with older CUDA Toolkits. Since PyTorch bundles the CUDA Toolkit, it works as long as your driver is at or above the supported version. The CUDA version shown in the top-right of `nvidia-smi` is the maximum version supported by the driver. PyTorch 2.x supports CUDA 11.8 and 12.x.

### Q3. Which is more cost-effective: cloud GPUs or self-owned GPUs?

For short-term experiments and prototyping, cloud (AWS, GCP, Lambda Labs) is overwhelmingly cheaper. If you consistently use more than 100 hours per month, self-owned GPUs may have lower TCO. However, H100-class GPUs are only practically accessible via the cloud. Using Spot/Preemptible instances can provide 70-90% discounts.

### Q4. What changes with the Blackwell generation (B200/RTX 5090)?

FP4 (4-bit floating point) support dramatically improves inference performance. B200 achieves approximately 2.5x AI training performance and 5x inference performance compared to H100. NVLink 5.0 (bidirectional 1.8TB/s) also doubles multi-GPU communication speed. RTX 5090 significantly improves BF16 Tensor Core performance for consumer GPUs, making local AI inference execution even more practical.

### Q5. Is AMD ROCm production-ready?

As of 2025, it has reached a production-ready level for standard PyTorch training and inference workloads. The MI300X's 192GB VRAM is a major advantage for large-scale LLM inference. However, libraries that heavily use Flash Attention and custom CUDA kernels (such as bitsandbytes) tend to lag behind in ROCm support, and cutting-edge optimization techniques may not be immediately available. Trying MI300X on Azure is the easiest way to get started.

### Q6. How do GPUs compare to other AI accelerators (TPUs, Inferentia)?

The greatest advantage of NVIDIA GPUs is the maturity of the CUDA ecosystem. PyTorch, TensorFlow, and JAX all run most stably on NVIDIA GPUs. TPUs offer the best cost-performance for matrix operations when combined with JAX, but come with vendor lock-in. Inferentia specializes in inference cost optimization on AWS. Selection criteria: "GPUs for flexibility, TPUs/Inferentia for cost-performance, cloud vendor's ASIC for ecosystem integration."

---

## Summary

| Concept | Key Points |
|------|------|
| GPU vs CPU | GPUs are optimized for parallel processing, CPUs for sequential processing |
| CUDA | NVIDIA's GPU programming platform |
| Tensor Core | Matrix operation-specialized units that significantly accelerate AI training |
| Mixed Precision (AMP) | Accelerate with FP16/BF16 while maintaining FP32-equivalent accuracy |
| VRAM | Most important factor in GPU selection, directly tied to model size |
| NVLink | High-speed inter-GPU communication, essential for tensor parallelism |
| ROCm | AMD GPU's competing platform against CUDA |
| DeepSpeed / FSDP | Memory optimization for large-scale model training |
| Flash Attention | O(N) memory Attention implementation, 5x faster |
| torch.compile | PyTorch 2.0+ JIT compiler, automatic optimization |
| LoRA / QLoRA | Parameter-efficient fine-tuning |

---

## Recommended Next Reads

- **01-computing/02-edge-ai.md** — Edge AI: NPU, Coral, Jetson
- **01-computing/03-cloud-ai-hardware.md** — Cloud AI Hardware: TPU, Inferentia
- **02-emerging/03-future-hardware.md** — Future Hardware: Quantum Computers

---

## References

1. **NVIDIA CUDA Programming Guide** https://docs.nvidia.com/cuda/cuda-c-programming-guide/
2. **PyTorch — CUDA Semantics** https://pytorch.org/docs/stable/notes/cuda.html
3. **NVIDIA — GPU Architecture Whitepapers** https://www.nvidia.com/en-us/technologies/
4. **Hugging Face — Model Memory Calculator** https://huggingface.co/spaces/hf-accelerate/model-memory-usage
5. **Flash Attention 2** https://github.com/Dao-AILab/flash-attention
6. **DeepSpeed** https://www.deepspeed.ai/
7. **AMD ROCm** https://www.amd.com/en/products/software/rocm.html
