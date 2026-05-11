# Cloud AI Hardware Guide

> Leverage TPUs, Inferentia, and GPU as a Service to run scalable AI workloads in the cloud

## What You Will Learn in This Chapter

1. **Cloud AI Accelerators** — Features and use cases of Google TPU, AWS Inferentia/Trainium, and NVIDIA cloud GPUs
2. **GPU as a Service** — Comparing AI instances across major cloud providers and choosing the optimal option
3. **Cost Optimization** — Strategies for spot instances, reserved instances, and serverless inference
4. **Inference Serving** — Building production inference infrastructure with Triton, vLLM, and TensorRT-LLM
5. **Multi-Cloud Strategy** — Avoiding vendor lock-in and designing portable AI infrastructure


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Edge AI Guide](./02-edge-ai.md)

---

## 1. Overview of Cloud AI Hardware

### Classification of Cloud AI Accelerators

```
+-----------------------------------------------------------+
|              Cloud AI Accelerators                         |
+-----------------------------------------------------------+
|                                                           |
|  +------------------+  +------------------+               |
|  | General-purpose  |  | Dedicated ASICs  |               |
|  | GPUs             |  |                  |               |
|  | NVIDIA H100/A100 |  | Google TPU       |               |
|  | AMD MI300X       |  | AWS Inferentia   |               |
|  | Training +       |  | AWS Trainium     |               |
|  | Inference        |  |                  |               |
|  +------------------+  +------------------+               |
|         |                      |                          |
|         v                      v                          |
|  High flexibility        High efficiency for              |
|  Rich ecosystem          specific workloads               |
|  High portability        Sometimes better cost-           |
|                          performance                      |
|                          Vendor lock-in risk              |
+-----------------------------------------------------------+
```

### AI Accelerators by Cloud Provider

```
+-----------------------------------------------------------+
| AWS                                                       |
|   GPU: P5 (H100), P4d (A100), G5 (A10G), G6 (L4)       |
|   ASIC: Inf2 (Inferentia2), Trn1 (Trainium)             |
|   Trn2 (Trainium2): Available from 2025                  |
+-----------------------------------------------------------+
| Google Cloud                                              |
|   GPU: A3 (H100), A2 (A100), G2 (L4)                    |
|   ASIC: TPU v5e, TPU v5p, TPU v4                        |
|   TPU v6e (Trillium): Available from 2025                |
+-----------------------------------------------------------+
| Azure                                                     |
|   GPU: ND H100 v5, ND A100 v4, NC A100 v4               |
|   ASIC: AMD MI300X (ND MI300X v5)                        |
|   Maia 100: Microsoft's in-house AI chip (from 2025)     |
+-----------------------------------------------------------+
| Dedicated GPU Clouds                                      |
|   Lambda Labs, CoreWeave, RunPod, Vast.ai, Together AI   |
|   -> H100/A100 often cheaper than major cloud providers   |
+-----------------------------------------------------------+
```

### Structure of the Cloud AI Market

```
+-----------------------------------------------------------+
|  Hierarchical Structure of the Cloud AI Hardware Market    |
+-----------------------------------------------------------+
|                                                           |
|  Tier 1: Hyperscalers (AWS, GCP, Azure)                   |
|  +-- Largest selection and service integration             |
|  +-- SLA: 99.9%+                                         |
|  +-- Rich managed services (SageMaker, Vertex AI)         |
|  +-- Higher price tier                                    |
|                                                           |
|  Tier 2: Dedicated GPU Clouds (CoreWeave, Lambda Labs)    |
|  +-- GPU-specialized, lower prices                        |
|  +-- Abundant H100/A100 availability                      |
|  +-- Services mainly bare metal/VM                        |
|  +-- SLA: 99.5-99.9%                                     |
|                                                           |
|  Tier 3: GPU Marketplaces (Vast.ai, RunPod)               |
|  +-- Lowest prices (including individual GPU providers)    |
|  +-- Variable availability                                |
|  +-- Suited for development and experimentation           |
|  +-- SLA: Best effort                                     |
|                                                           |
|  Tier 4: Serverless Inference (Replicate, Modal, Banana)  |
|  +-- Fully pay-per-use                                    |
|  +-- Cold start latency                                   |
|  +-- For small-scale and sporadic workloads               |
+-----------------------------------------------------------+
```

---

## 2. Google TPU

### TPU Generation Comparison Table

| Generation | Year | Chip Performance (BF16) | HBM | Interconnect | Primary Use |
|------|--------|-----------------|-----|------|---------|
| TPU v2 | 2017 | 45 TFLOPS | 8GB | 2D Torus | Introductory training |
| TPU v3 | 2018 | 123 TFLOPS | 16GB | 2D Torus | Medium-scale training |
| TPU v4 | 2021 | 275 TFLOPS | 32GB | 3D Torus | Large-scale training |
| TPU v5e | 2023 | 197 TFLOPS | 16GB | ICI | Cost-efficiency focused |
| TPU v5p | 2023 | 459 TFLOPS | 95GB | ICI | Highest-performance training |
| TPU v6e (Trillium) | 2024 | 918 TFLOPS | 32GB | ICI | Next-gen training & inference |

### TPU Architecture

```
+-------------------------------------------------------+
|  TPU (Tensor Processing Unit)                         |
+-------------------------------------------------------+
|                                                       |
|  +------------------+  +------------------+           |
|  | MXU              |  | MXU              |           |
|  | (Matrix Multiply |  | (Matrix Multiply |           |
|  |  Unit)           |  |  Unit)           |           |
|  | 128x128 systolic |  | 128x128 systolic |           |
|  | array            |  | array            |           |
|  +------------------+  +------------------+           |
|                                                       |
|  +------------------+  +------------------+           |
|  | VPU (Vector      |  | SPU (Scalar      |           |
|  |  Processing)     |  |  Processing)     |           |
|  +------------------+  +------------------+           |
|                                                       |
|  +--------------------------------------------+      |
|  | HBM (High Bandwidth Memory) 16-95GB        |      |
|  +--------------------------------------------+      |
|                                                       |
|  TPU Pod: Up to thousands of chips                    |
|  interconnected via ICI                               |
+-------------------------------------------------------+
```

### TPU Pod Scaling Architecture

```
+-----------------------------------------------------------+
|  TPU Pod Scaling                                           |
+-----------------------------------------------------------+
|                                                           |
|  TPU Chip (1 unit)                                        |
|    |                                                      |
|  TPU Board (4 chips)                                      |
|    |                                                      |
|  TPU Slice (variable: 8, 16, 32, ... chips)              |
|    |                                                      |
|  TPU Pod (up to thousands of chips)                       |
|                                                           |
|  Example: TPU v5p Pod (8960 chips)                        |
|  +----+  +----+  +----+  +----+                           |
|  |Chip|--|Chip|--|Chip|--|Chip|  <- ICI (Inter-Chip       |
|  +----+  +----+  +----+  +----+    Interconnect)          |
|    |       |       |       |       direct connection      |
|  +----+  +----+  +----+  +----+                           |
|  |Chip|--|Chip|--|Chip|--|Chip|  Total compute: 459       |
|  +----+  +----+  +----+  +----+  TFLOPS x 8960 =         |
|    ...     ...     ...     ...   4.1 EFLOPS               |
|                                                           |
|  Communication bandwidth: ICI up to 4800 Gbps/chip       |
|  -> Over 5x GPU NVLink (900 Gbps)                        |
+-----------------------------------------------------------+
```

### Code Example 1: Training with JAX + TPU

```python
import jax
import jax.numpy as jnp
from flax import linen as nn
from flax.training import train_state
import optax

# Check TPU devices
print(f"Devices: {jax.devices()}")
# [TpuDevice(id=0, ...), TpuDevice(id=1, ...), ...]

# Simple model definition
class MLP(nn.Module):
    features: int

    @nn.compact
    def __call__(self, x):
        x = nn.Dense(512)(x)
        x = nn.relu(x)
        x = nn.Dense(self.features)(x)
        return x

# Distributed training on TPU Pod
@jax.pmap  # Automatically parallelizes data across TPU cores
def train_step(state, batch):
    def loss_fn(params):
        logits = state.apply_fn({"params": params}, batch["input"])
        return optax.softmax_cross_entropy_with_integer_labels(
            logits, batch["label"]
        ).mean()

    grads = jax.grad(loss_fn)(state.params)
    # Gradients are automatically synchronized across TPU cores
    grads = jax.lax.pmean(grads, axis_name="batch")
    state = state.apply_gradients(grads=grads)
    return state
```

### Code Example 2: Launching and Using a TPU VM

```bash
# Create a TPU VM (Google Cloud)
gcloud compute tpus tpu-vm create my-tpu \
    --zone=us-central1-a \
    --accelerator-type=v5litepod-8 \
    --version=tpu-ubuntu2204-base

# SSH connection
gcloud compute tpus tpu-vm ssh my-tpu --zone=us-central1-a

# Verify JAX TPU operation
python3 -c "import jax; print(jax.devices())"

# Run training
python3 train.py --tpu --batch_size=1024

# Delete TPU VM (stop billing)
gcloud compute tpus tpu-vm delete my-tpu --zone=us-central1-a
```

### Code Example 3: Large-Scale LLM Training on TPU (JAX + FSDP)

```python
import jax
import jax.numpy as jnp
from jax.sharding import Mesh, PartitionSpec, NamedSharding
from jax.experimental import mesh_utils

# Build device mesh for TPU Pod
# For 8x4 = 32 TPU chips
devices = mesh_utils.create_device_mesh((8, 4))
mesh = Mesh(devices, axis_names=('data', 'model'))

# FSDP (Fully Sharded Data Parallel) style distribution
# Shard model parameters across TPU chips
def shard_params(params):
    """Shard parameters along the 'model' axis"""
    def shard_fn(x):
        return jax.device_put(
            x, NamedSharding(mesh, PartitionSpec('model'))
        )
    return jax.tree_map(shard_fn, params)

# Data is split along the 'data' axis
def shard_data(batch):
    """Split batch data along the 'data' axis"""
    return jax.device_put(
        batch, NamedSharding(mesh, PartitionSpec('data'))
    )

# Training step (automatically distributed across the mesh)
@jax.jit
def train_step(state, batch):
    with mesh:
        def loss_fn(params):
            logits = model.apply(params, batch['input_ids'])
            labels = jax.nn.one_hot(batch['labels'], num_classes)
            return -jnp.sum(labels * jax.nn.log_softmax(logits)) / labels.shape[0]

        loss, grads = jax.value_and_grad(loss_fn)(state.params)
        state = state.apply_gradients(grads=grads)
        return state, loss

# Training loop
for epoch in range(num_epochs):
    for batch in dataloader:
        batch = shard_data(batch)
        state, loss = train_step(state, batch)
        if step % 100 == 0:
            print(f"Step {step}, Loss: {loss:.4f}")
```

### Code Example 4: TPU Multislice Training

```python
# TPU Multislice: Connect multiple TPU Pod slices for ultra-large-scale training
# Configuring Multislice on Google Cloud

# 1. Create multi-slice TPU
# gcloud compute tpus queued-resources create my-multislice \
#     --node-count=4 \
#     --accelerator-type=v5litepod-256 \
#     --runtime-version=v2-alpha-tpuv5-lite \
#     --zone=us-central1-a

import jax
from jax.experimental.multihost_utils import (
    sync_global_devices,
    process_allgather,
)

def setup_multislice():
    """Initialize Multislice TPU"""
    # Each slice's process starts independently
    jax.distributed.initialize()

    num_devices = jax.device_count()
    num_local = jax.local_device_count()
    num_processes = jax.process_count()
    process_id = jax.process_index()

    print(f"Process {process_id}/{num_processes}: "
          f"{num_local} local devices, {num_devices} total")

    # Global mesh (integrating all slices)
    devices = jax.devices()
    # 4 slices x 256 chips = 1024-chip mesh
    mesh = Mesh(
        np.array(devices).reshape(num_processes, -1),
        axis_names=('slice', 'device')
    )
    return mesh

# Multislice communication patterns
# Intra-slice: ICI (ultra-fast, ~4800 Gbps)
# Inter-slice: DCN (data center network, ~200 Gbps)
# -> Gradient synchronization can be bottlenecked by DCN
# -> Can be mitigated with asynchronous pipeline parallelism
```

---

## 3. AWS Inferentia / Trainium

### Inferentia and Trainium Generation Comparison

| Item | Inferentia1 | Inferentia2 | Trainium1 | Trainium2 |
|------|------------|-------------|-----------|-----------|
| Year | 2019 | 2022 | 2022 | 2024 |
| NeuronCores | 4 | 2 | 2 | 2 |
| Core Performance (BF16) | - | 190 TFLOPS | 190 TFLOPS | 380 TFLOPS |
| HBM | 8GB (DDR4) | 32GB (HBM2e) | 32GB (HBM2e) | 96GB (HBM3) |
| NeuronLink | None | Supported | Supported | Supported (faster) |
| Primary Use | Inference | Inference | Training | Large-scale training |
| EC2 Instance | inf1 | inf2 | trn1 | trn2 |

### Code Example 5: Inference on AWS Inferentia2

```python
# Inference on Inferentia2 using Neuron SDK
import torch
import torch_neuronx

# Compile PyTorch model to Neuron format
model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased")
model.eval()

# Neuron compilation (optimized for Inferentia2)
example_inputs = torch.zeros(1, 128, dtype=torch.long)
model_neuron = torch_neuronx.trace(model, example_inputs)

# Save compiled model
model_neuron.save("bert_neuron.pt")

# Run inference (high-speed processing on Inferentia2)
model_neuron = torch.jit.load("bert_neuron.pt")
output = model_neuron(input_ids)
```

### Code Example 6: Training on AWS Trainium

```python
# Training on Trainium with Neuron SDK + PyTorch XLA
import torch
import torch_xla.core.xla_model as xm
import torch_xla.distributed.parallel_loader as pl

# Get Trainium device
device = xm.xla_device()

# Place model and optimizer on device
model = MyModel().to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

# Distributed data loader
train_loader = pl.MpDeviceLoader(train_dataloader, device)

for epoch in range(num_epochs):
    for batch in train_loader:
        optimizer.zero_grad()
        loss = model(batch)
        loss.backward()
        xm.optimizer_step(optimizer)  # Gradient synchronization on Trainium
```

### Code Example 7: LLM Inference with Neuron SDK (transformers-neuronx)

```python
# Deploy large-scale LLMs on Inferentia2 with transformers-neuronx
from transformers_neuronx import LlamaForSampling
from transformers import AutoTokenizer
import torch

# Load and compile model
# Deploy Llama-2-7B on Inferentia2 (inf2.48xlarge: 12 chips)
model = LlamaForSampling.from_pretrained(
    "meta-llama/Llama-2-7b-hf",
    batch_size=4,             # Concurrent processing batch size
    tp_degree=12,             # Tensor parallelism degree (using 12 chips)
    n_positions=2048,         # Maximum sequence length
    amp='bf16',               # BFloat16 precision
)

# Compilation (takes several minutes on first run)
model.to_neuron()

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")

# Run inference
prompt = "Please explain the future of AI hardware."
input_ids = tokenizer(prompt, return_tensors='pt').input_ids

# Token generation
with torch.no_grad():
    output_ids = model.sample(
        input_ids,
        sequence_length=512,
        top_k=50,
        top_p=0.9,
        temperature=0.7,
    )

response = tokenizer.decode(output_ids[0], skip_special_tokens=True)
print(response)

# Performance metrics (inf2.48xlarge)
# - Llama-2-7B: ~50 tokens/sec per request
# - Llama-2-13B: ~30 tokens/sec per request
# - Cost: inf2.48xlarge $12.98/hr vs p4d.24xlarge $32.77/hr
#   -> Approximately 60% cost reduction (at equivalent throughput)
```

### Code Example 8: Inference Endpoint with SageMaker + Inferentia2

```python
import sagemaker
from sagemaker.huggingface import HuggingFaceModel

# SageMaker session configuration
sess = sagemaker.Session()
role = sagemaker.get_execution_role()

# Deploy HuggingFace model on Inferentia2
hub_model = HuggingFaceModel(
    model_data=None,
    role=role,
    transformers_version="4.36.0",
    pytorch_version="2.1.0",
    py_version="py310",
    env={
        "HF_MODEL_ID": "meta-llama/Llama-2-7b-hf",
        "HF_TASK": "text-generation",
        "HF_NUM_CORES": "12",              # Number of NeuronCores
        "HF_AUTO_CAST_TYPE": "bf16",
        "HF_BATCH_SIZE": "4",
        "MAX_INPUT_LENGTH": "1024",
        "MAX_TOTAL_TOKENS": "2048",
    },
    image_uri=sagemaker.image_uris.retrieve(
        framework="huggingface-llm-neuron",
        region=sess.boto_region_name,
        version="0.0.23",
        instance_type="ml.inf2.48xlarge",
    ),
)

# Deploy endpoint
predictor = hub_model.deploy(
    initial_instance_count=1,
    instance_type="ml.inf2.48xlarge",
    endpoint_name="llama2-inf2-endpoint",
    model_data_download_timeout=1200,
    container_startup_health_check_timeout=1200,
)

# Inference request
response = predictor.predict({
    "inputs": "About the future of AI",
    "parameters": {
        "max_new_tokens": 256,
        "temperature": 0.7,
        "top_p": 0.9,
    }
})
print(response)

# Auto-scaling configuration
client = boto3.client("application-autoscaling")
client.register_scalable_target(
    ServiceNamespace="sagemaker",
    ResourceId=f"endpoint/{predictor.endpoint_name}/variant/AllTraffic",
    ScalableDimension="sagemaker:variant:DesiredInstanceCount",
    MinCapacity=1,
    MaxCapacity=10,
)

# Scaling policy (based on GPU utilization)
client.put_scaling_policy(
    PolicyName="gpu-utilization-scaling",
    ServiceNamespace="sagemaker",
    ResourceId=f"endpoint/{predictor.endpoint_name}/variant/AllTraffic",
    ScalableDimension="sagemaker:variant:DesiredInstanceCount",
    PolicyType="TargetTrackingScaling",
    TargetTrackingScalingPolicyConfiguration={
        "TargetValue": 70.0,  # Maintain 70% GPU utilization
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "SageMakerVariantInvocationsPerInstance"
        },
        "ScaleInCooldown": 300,
        "ScaleOutCooldown": 60,
    },
)
```

---

## 4. GPU as a Service Comparison

### Major Cloud GPU Instance Comparison Table

| Provider | Instance | GPU | VRAM | Hourly Rate (USD) | Use Case |
|-----------|------------|-----|------|-------------|------|
| AWS | p5.48xlarge | 8x H100 | 640GB | $98.32 | Large-scale training |
| AWS | p4d.24xlarge | 8x A100 | 320GB | $32.77 | Training |
| AWS | g5.xlarge | 1x A10G | 24GB | $1.01 | Inference |
| AWS | g6.xlarge | 1x L4 | 24GB | $0.81 | Inference (new gen) |
| AWS | inf2.xlarge | 1x Inferentia2 | 32GB | $0.76 | Inference (low cost) |
| GCP | a3-highgpu-8g | 8x H100 | 640GB | $98.45 | Large-scale training |
| GCP | a2-highgpu-1g | 1x A100 | 40GB | $3.67 | Training |
| GCP | g2-standard-4 | 1x L4 | 24GB | $0.84 | Inference |
| GCP | TPU v5e-8 | 8x TPU v5e | 128GB | $12.88 | Training (cost-effective) |
| Azure | ND H100 v5 | 8x H100 | 640GB | $98.32 | Large-scale training |
| Azure | NC A100 v4 | 1x A100 | 80GB | $3.67 | Training |
| Lambda Labs | 1x H100 | 1x H100 | 80GB | $2.49 | Training (affordable) |
| CoreWeave | 1x H100 | 1x H100 | 80GB | $2.06 | Training (affordable) |
| RunPod | 1x A100 | 1x A100 | 80GB | $1.64 | Training (affordable) |
| Vast.ai | 1x A100 | 1x A100 | 80GB | $0.80-1.50 | Experimentation (cheapest) |

### GPU vs Dedicated ASIC Decision Flow

```
What type of AI workload?
        |
        +-- Training
        |       |
        |       +-- Flexible with PyTorch/TF -> NVIDIA GPU (H100/A100)
        |       +-- JAX + large-scale -> Google TPU
        |       +-- Committed to AWS + large-scale -> Trainium
        |       +-- Budget-focused + medium-scale -> Lambda Labs / CoreWeave
        |
        +-- Inference
        |       |
        |       +-- General-purpose / flexibility -> NVIDIA GPU (L4/T4/A10G)
        |       +-- AWS + low cost -> Inferentia2
        |       +-- High throughput -> TensorRT + GPU
        |       +-- LLM inference -> vLLM + H100 or Inferentia2
        |       +-- Sporadic requests -> Serverless (Replicate, Modal)
        |
        +-- Fine-tuning
                |
                +-- Small to medium (7B or less) -> 1x A100/H100
                +-- Medium (7B-70B) -> 4-8x A100/H100
                +-- Large (70B+) -> 8x H100 or TPU Pod
                +-- LoRA/QLoRA -> 1x A100/RTX 4090 is sufficient
```

### Managed AI Service Comparison by Major Cloud Provider

```
+-----------------------------------------------------------+
| Comparison of Managed Training/Inference Services          |
+-----------------------------------------------------------+
|                                                           |
| AWS SageMaker                                             |
|   +-- SageMaker Training: Managed training jobs           |
|   +-- SageMaker Inference: Real-time/batch/async infer.   |
|   +-- SageMaker JumpStart: One-click pretrained model     |
|   |   deployment                                          |
|   +-- SageMaker HyperPod: Auto-managed large-scale        |
|       training clusters                                   |
|                                                           |
| Google Cloud Vertex AI                                    |
|   +-- Vertex AI Training: Custom jobs / hypertuning       |
|   +-- Vertex AI Prediction: Online/batch prediction       |
|   +-- Model Garden: Pretrained model gallery              |
|   +-- Vertex AI Pipelines: MLOps pipelines                |
|                                                           |
| Azure Machine Learning                                    |
|   +-- Azure ML Training: Compute cluster management       |
|   +-- Azure ML Endpoints: Managed endpoints               |
|   +-- Azure AI Studio: Integrated development environment |
|   +-- Azure OpenAI Service: OpenAI model hosting          |
+-----------------------------------------------------------+
```

---

## 5. Cost Optimization Strategies

### Code Example 9: Leveraging Spot Instances

```python
# Training with AWS Spot Instances (70-90% discount)
import boto3

ec2 = boto3.client('ec2')

# Spot instance request
response = ec2.request_spot_instances(
    SpotPrice='10.00',  # Maximum bid price
    InstanceCount=1,
    Type='one-time',
    LaunchSpecification={
        'ImageId': 'ami-xxxxx',  # Deep Learning AMI
        'InstanceType': 'p4d.24xlarge',
        'KeyName': 'my-key',
        'SecurityGroupIds': ['sg-xxxxx'],
    }
)

# Checkpoint-based training (prepare for interruptions)
# train.py
class CheckpointCallback:
    def __init__(self, save_path, save_every=1000):
        self.save_path = save_path
        self.save_every = save_every

    def on_step_end(self, step, model, optimizer):
        if step % self.save_every == 0:
            torch.save({
                'step': step,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
            }, f"{self.save_path}/checkpoint_{step}.pt")
            # Also back up to S3
            upload_to_s3(f"{self.save_path}/checkpoint_{step}.pt")
```

### Code Example 10: Spot Instance Interruption Handling

```python
import requests
import signal
import time
import threading

class SpotInterruptionHandler:
    """
    Handles AWS spot instance interruption notifications
    and safely saves checkpoints
    """

    METADATA_URL = "http://169.254.169.254/latest/meta-data/spot/instance-action"

    def __init__(self, checkpoint_fn, cleanup_fn=None):
        self.checkpoint_fn = checkpoint_fn
        self.cleanup_fn = cleanup_fn
        self.interrupted = False
        self._start_monitoring()

    def _start_monitoring(self):
        """Monitor spot interruption notifications in the background"""
        def monitor():
            while not self.interrupted:
                try:
                    response = requests.get(self.METADATA_URL, timeout=2)
                    if response.status_code == 200:
                        action = response.json()
                        print(f"Warning: Spot interruption notice received: {action}")
                        print(f"  Action: {action.get('action')}")
                        print(f"  Interruption time: {action.get('time')}")
                        self._handle_interruption()
                except requests.exceptions.RequestException:
                    pass  # No interruption notice (normal)
                time.sleep(5)  # Check every 5 seconds

        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()

    def _handle_interruption(self):
        """Handle interruption"""
        self.interrupted = True
        print("Saving checkpoint...")
        self.checkpoint_fn()
        if self.cleanup_fn:
            self.cleanup_fn()
        print("Checkpoint saved. Safe to terminate.")

# Usage example
def save_checkpoint():
    torch.save({
        'step': global_step,
        'model': model.state_dict(),
        'optimizer': optimizer.state_dict(),
        'scheduler': scheduler.state_dict(),
        'best_loss': best_loss,
    }, '/tmp/checkpoint_latest.pt')
    # Upload to S3
    boto3.client('s3').upload_file(
        '/tmp/checkpoint_latest.pt',
        'my-training-bucket',
        f'checkpoints/run_{run_id}/latest.pt'
    )

handler = SpotInterruptionHandler(checkpoint_fn=save_checkpoint)

# Training loop
for step in range(num_steps):
    if handler.interrupted:
        print("Interruption detected. Stopping training.")
        break
    train_one_step()
```

### Cost Optimization Methods Comparison Table

| Method | Cost Reduction | Risk | Suitable Use Cases |
|------|-----------|--------|-----------|
| Spot/Preemptible | 60-90% | Possible interruption | Checkpoint-enabled training |
| Reserved (1 year) | 30-40% | Fixed contract period | Continuous inference usage |
| Reserved (3 years) | 50-60% | Long-term contract risk | Large-scale inference infra |
| Savings Plan | 20-40% | Flexible but smaller discount | When usage may change |
| Serverless | Pay-per-use | Cold start | Sporadic inference requests |
| Dedicated clouds | 40-60% | Limited SLA/support | Development and research |
| Mixed precision training | 30-50% GPU time reduction | None | All training jobs |
| Model quantization | 50-75% inference GPU reduction | Slight accuracy loss | Inference serving |

### Code Example 11: Cost Reduction with GCP Preemptible TPU

```bash
# Create a Preemptible TPU (60-90% discount)
gcloud compute tpus tpu-vm create my-preempt-tpu \
    --zone=us-central1-a \
    --accelerator-type=v5litepod-8 \
    --version=tpu-ubuntu2204-base \
    --preemptible  # Preemptible (interruptible)

# Cost comparison (TPU v5e-8)
# On-demand: $12.88/hr -> $9,274/month
# Preemptible: $3.86/hr -> $2,779/month (70% discount)
# Reserved (1 year): $8.37/hr -> $6,028/month (35% discount)

# Auto-restart script (preemptible interruption recovery)
#!/bin/bash
while true; do
    # Check if TPU exists
    STATUS=$(gcloud compute tpus tpu-vm describe my-preempt-tpu \
        --zone=us-central1-a --format="get(state)" 2>/dev/null)

    if [ "$STATUS" != "READY" ]; then
        echo "TPU interruption detected. Recreating..."
        gcloud compute tpus tpu-vm delete my-preempt-tpu \
            --zone=us-central1-a --quiet 2>/dev/null
        gcloud compute tpus tpu-vm create my-preempt-tpu \
            --zone=us-central1-a \
            --accelerator-type=v5litepod-8 \
            --version=tpu-ubuntu2204-base \
            --preemptible
        # Resume training from checkpoint
        gcloud compute tpus tpu-vm ssh my-preempt-tpu \
            --zone=us-central1-a \
            --command="cd /workspace && python train.py --resume"
    fi
    sleep 60
done
```

### Cost Calculation Simulation

```python
def calculate_training_cost(
    model_params_billion: float,
    tokens_billion: float,
    hardware: str = "h100",
    pricing: str = "on_demand",
    provider: str = "aws",
) -> dict:
    """Estimate cloud cost for LLM training"""

    # TFLOPS by hardware (BF16, effective values)
    hw_specs = {
        "h100": {"tflops": 990, "gpus_per_node": 8, "price_od": 98.32, "price_spot": 29.50},
        "a100_80g": {"tflops": 312, "gpus_per_node": 8, "price_od": 32.77, "price_spot": 9.83},
        "tpu_v5e_8": {"tflops": 197*8, "gpus_per_node": 1, "price_od": 12.88, "price_spot": 3.86},
        "trainium": {"tflops": 190*16, "gpus_per_node": 1, "price_od": 21.50, "price_spot": 6.45},
    }

    spec = hw_specs[hardware]

    # Chinchilla scaling law: FLOPs ~ 6 * N * D
    total_flops = 6 * model_params_billion * 1e9 * tokens_billion * 1e9

    # Effective GPU utilization (MFU: Model FLOPs Utilization)
    mfu = 0.40  # Typical value: 30-50%
    effective_tflops = spec["tflops"] * spec["gpus_per_node"] * mfu * 1e12

    # Time required (seconds)
    training_seconds = total_flops / effective_tflops
    training_hours = training_seconds / 3600

    # Cost calculation
    price = spec["price_spot"] if pricing == "spot" else spec["price_od"]
    total_cost = training_hours * price

    return {
        "hardware": hardware,
        "pricing_model": pricing,
        "total_flops": f"{total_flops:.2e}",
        "time_required": f"{training_hours:.0f} hours ({training_hours/24:.1f} days)",
        "cost": f"${total_cost:,.0f} (approx. {total_cost*150:,.0f} JPY)",
        "single_node_assumption (no parallelization)": True,
    }

# Training cost comparison for a 7B model
configs = [
    ("h100", "on_demand"), ("h100", "spot"),
    ("a100_80g", "on_demand"), ("a100_80g", "spot"),
    ("tpu_v5e_8", "on_demand"), ("tpu_v5e_8", "spot"),
]

for hw, pricing in configs:
    result = calculate_training_cost(7, 2000, hw, pricing)
    print(f"{hw} ({pricing}): {result['cost']} / {result['time_required']}")

# Example output (estimates):
# h100 (on_demand): $26,373 (approx. 3.95M JPY) / 268 hours (11.2 days)
# h100 (spot):      $7,912 (approx. 1.19M JPY) / 268 hours
# a100_80g (on_demand): $87,651 (approx. 13.15M JPY) / 2,676 hours (111.5 days)
# a100_80g (spot):   $26,295 (approx. 3.94M JPY) / 2,676 hours
# tpu_v5e_8 (on_demand): $7,106 (approx. 1.07M JPY) / 552 hours (23.0 days)
# tpu_v5e_8 (spot):  $2,132 (approx. 320K JPY) / 552 hours
```

---

## 6. Inference Serving Architecture

### Inference Serving Configuration

```
+-----------------------------------------------------------+
|  Client -> API Gateway -> Load Balancer                   |
+-----------------------------------------------------------+
        |                    |                    |
        v                    v                    v
+---------------+  +---------------+  +---------------+
| Inference     |  | Inference     |  | Inference     |
| Server 1      |  | Server 2      |  | Server 3      |
| GPU: T4       |  | GPU: T4       |  | GPU: T4       |
| Model: v2.1   |  | Model: v2.1   |  | Model: v2.1   |
| TensorRT      |  | TensorRT      |  | TensorRT      |
+---------------+  +---------------+  +---------------+
        |
        v
+-----------------------------------------------------------+
| NVIDIA Triton Inference Server                            |
| - Model repository management                            |
| - Dynamic batching (batch requests for efficiency)        |
| - Multi-model concurrent serving                         |
| - Model version management (blue-green deployment)        |
+-----------------------------------------------------------+
```

### LLM Inference Serving Stack

```
+-----------------------------------------------------------+
|  LLM Inference Serving Options (2025)                      |
+-----------------------------------------------------------+
|                                                           |
|  vLLM                                                     |
|  +-- Efficient KV cache management via PagedAttention      |
|  +-- Continuous Batching                                   |
|  +-- Built-in OpenAI-compatible API server                 |
|  +-- Tensor Parallel support                               |
|  +-- AWQ/GPTQ/FP8 quantization support                    |
|                                                           |
|  TensorRT-LLM                                             |
|  +-- Optimized for NVIDIA GPUs                             |
|  +-- In-Flight Batching                                    |
|  +-- FP8/INT4 quantization                                 |
|  +-- Highest throughput (on NVIDIA GPUs)                   |
|                                                           |
|  Text Generation Inference (TGI)                          |
|  +-- Official Hugging Face solution                        |
|  +-- Flash Attention 2 integration                         |
|  +-- Speculative Decoding                                  |
|  +-- Easy setup                                            |
|                                                           |
|  Ollama                                                    |
|  +-- For local/edge deployment                             |
|  +-- GGUF quantized model support                          |
|  +-- No Docker required, single binary                     |
+-----------------------------------------------------------+
```

### Code Example 12: LLM Inference Server with vLLM

```python
# Launch and use an OpenAI-compatible inference server with vLLM

# --- Server startup (CLI) ---
# pip install vllm
# python -m vllm.entrypoints.openai.api_server \
#     --model meta-llama/Llama-2-7b-hf \
#     --tensor-parallel-size 4 \
#     --gpu-memory-utilization 0.9 \
#     --max-model-len 4096 \
#     --port 8000

# --- Client code ---
from openai import OpenAI

# Connect to vLLM server via OpenAI-compatible API
client = OpenAI(
    api_key="EMPTY",
    base_url="http://localhost:8000/v1",
)

# Chat-style inference
response = client.chat.completions.create(
    model="meta-llama/Llama-2-7b-hf",
    messages=[
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "How should I choose cloud AI hardware?"},
    ],
    max_tokens=512,
    temperature=0.7,
    stream=True,  # Streaming response
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### Code Example 13: Triton Inference Server Configuration

```python
# Triton Inference Server model configuration and startup

# --- Directory structure ---
# model_repository/
# +-- bert-classifier/
# |   +-- config.pbtxt
# |   +-- 1/              # Version 1
# |   |   +-- model.onnx
# |   +-- 2/              # Version 2 (latest)
# |       +-- model.onnx
# +-- image-classifier/
#     +-- config.pbtxt
#     +-- 1/
#         +-- model.plan   # TensorRT engine

# --- config.pbtxt ---
# name: "bert-classifier"
# platform: "onnxruntime_onnx"
# max_batch_size: 64
# input [
#   {
#     name: "input_ids"
#     data_type: TYPE_INT64
#     dims: [128]
#   }
# ]
# output [
#   {
#     name: "logits"
#     data_type: TYPE_FP32
#     dims: [3]
#   }
# ]
# dynamic_batching {
#   max_queue_delay_microseconds: 100
#   preferred_batch_size: [8, 16, 32]
# }
# instance_group [
#   {
#     count: 2
#     kind: KIND_GPU
#     gpus: [0]
#   }
# ]

# --- Launch with Docker ---
# docker run --gpus=all --rm -p 8000:8000 -p 8001:8001 -p 8002:8002 \
#     -v $(pwd)/model_repository:/models \
#     nvcr.io/nvidia/tritonserver:24.01-py3 \
#     tritonserver --model-repository=/models

# --- Python client ---
import tritonclient.http as httpclient
import numpy as np

client = httpclient.InferenceServerClient(url="localhost:8000")

# Check server status
assert client.is_server_live()
assert client.is_model_ready("bert-classifier")

# Inference request
input_ids = np.random.randint(0, 30000, size=(1, 128)).astype(np.int64)
inputs = [httpclient.InferInput("input_ids", input_ids.shape, "INT64")]
inputs[0].set_data_from_numpy(input_ids)

outputs = [httpclient.InferRequestedOutput("logits")]

result = client.infer(
    model_name="bert-classifier",
    model_version="2",  # Specify version (omit for latest)
    inputs=inputs,
    outputs=outputs,
)

logits = result.as_numpy("logits")
print(f"Prediction result: {np.argmax(logits)}")

# Get model statistics
stats = client.get_model_statistics("bert-classifier")
print(f"Inference count: {stats['model_stats'][0]['inference_count']}")
print(f"Average latency: {stats['model_stats'][0]['inference_stats']['success']['compute_infer']['avg']/1e6:.2f}ms")
```

---

## 7. AI Workload Management with Kubernetes

### Code Example 14: Model Serving with Kubernetes + GPU

```yaml
# Managing GPU workloads with Kubernetes

# --- Create GPU node pool (GKE) ---
# gcloud container node-pools create gpu-pool \
#     --cluster=ai-cluster \
#     --zone=us-central1-a \
#     --machine-type=g2-standard-8 \
#     --accelerator type=nvidia-l4,count=1 \
#     --num-nodes=3 \
#     --enable-autoscaling --min-nodes=1 --max-nodes=10

# --- vLLM Deployment ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-inference
  labels:
    app: vllm
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vllm
  template:
    metadata:
      labels:
        app: vllm
    spec:
      containers:
      - name: vllm
        image: vllm/vllm-openai:latest
        args:
        - "--model"
        - "meta-llama/Llama-2-7b-hf"
        - "--tensor-parallel-size"
        - "1"
        - "--gpu-memory-utilization"
        - "0.9"
        ports:
        - containerPort: 8000
        resources:
          limits:
            nvidia.com/gpu: 1      # Request 1 GPU
            memory: "32Gi"
          requests:
            nvidia.com/gpu: 1
            memory: "16Gi"
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 120
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 180
          periodSeconds: 30
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-l4
      tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
spec:
  selector:
    app: vllm
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
---
# Horizontal Pod Autoscaler (GPU utilization-based)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vllm-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vllm-inference
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Pods
    pods:
      metric:
        name: gpu_utilization
      target:
        type: AverageValue
        averageValue: "70"
```

---

## 8. Multi-Cloud and Hybrid Cloud Strategy

### Multi-Cloud AI Architecture

```
+-----------------------------------------------------------+
|  Multi-Cloud AI Architecture                                |
+-----------------------------------------------------------+
|                                                           |
|  Training                                                 |
|  +-- Lambda Labs / CoreWeave (cost-optimized)             |
|  +-- GCP TPU (JAX large-scale training)                   |
|  +-- AWS Trainium (when leveraging AWS ecosystem)         |
|      |                                                    |
|      v  Export model in ONNX / Safetensors format         |
|      |                                                    |
|  Inference                                                |
|  +-- AWS SageMaker (fully managed)                        |
|  +-- GCP Vertex AI (GCP ecosystem)                        |
|  +-- Self-managed K8s + vLLM (maximum flexibility)        |
|      |                                                    |
|      v  Centralized management via model registry         |
|      |                                                    |
|  Model Registry                                           |
|  +-- MLflow Model Registry                                |
|  +-- Weights & Biases                                     |
|  +-- Hugging Face Hub (private repositories)              |
+-----------------------------------------------------------+
```

### Code Example 15: Cross-Cloud Model Portability with ONNX

```python
import torch
import onnx
import onnxruntime as ort

# --- Export PyTorch model to ONNX ---
model = MyModel()
model.load_state_dict(torch.load("model.pt"))
model.eval()

dummy_input = torch.randn(1, 3, 224, 224)

torch.onnx.export(
    model,
    dummy_input,
    "model.onnx",
    opset_version=17,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={
        "input": {0: "batch_size"},
        "output": {0: "batch_size"},
    },
)

# Validate ONNX model
onnx_model = onnx.load("model.onnx")
onnx.checker.check_model(onnx_model)
print("ONNX model validation: OK")

# --- ONNX inference on each cloud ---

# 1. Local (CPU/GPU)
session = ort.InferenceSession(
    "model.onnx",
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
)
input_data = {"input": dummy_input.numpy()}
output = session.run(None, input_data)

# 2. Deploy to AWS SageMaker
# Use SageMaker's ONNX container

# 3. Deploy to GCP Vertex AI
# gcloud ai models upload --artifact-uri=gs://bucket/model.onnx

# 4. Deploy to Azure ML
# az ml model deploy --model-path model.onnx --runtime onnx

# -> The same model runs on all clouds
```

---

## 9. Security and Compliance

### Security Considerations for Cloud AI Environments

```
+-----------------------------------------------------------+
|  Security for Cloud AI Workloads                           |
+-----------------------------------------------------------+
|                                                           |
|  Data Security                                            |
|  +-- Encryption of training data (at rest + in transit)   |
|  +-- Launch GPUs in private subnets within VPC            |
|  +-- Strict IAM policies for S3/GCS buckets              |
|  +-- Geographic data restrictions (GDPR, etc.)            |
|                                                           |
|  Model Security                                           |
|  +-- Encrypted storage of model weight files              |
|  +-- Access control for model registry                    |
|  +-- Authentication/authorization for inference API       |
|  |   (API Key, OAuth2)                                    |
|  +-- Rate limiting and DDoS protection                    |
|                                                           |
|  Infrastructure Security                                  |
|  +-- SSH key management for GPU VMs                       |
|  +-- Principle of least privilege for security groups      |
|  +-- IP restrictions via network ACLs                     |
|  +-- Enable CloudTrail/Cloud Audit Log                    |
|                                                           |
|  Compliance                                               |
|  +-- Choose clouds with SOC 2, ISO 27001 compliance       |
|  +-- HIPAA compliance (for healthcare data)               |
|  +-- Verify copyright/licensing of training data          |
+-----------------------------------------------------------+
```

---

## 10. Monitoring and Observability

### Code Example 16: Building a GPU Monitoring Dashboard

```python
# Monitor GPU metrics with Prometheus + Grafana

# --- DCGM Exporter Kubernetes deployment ---
# Collect GPU metrics with NVIDIA DCGM (Data Center GPU Manager)

# dcgm-exporter DaemonSet
# apiVersion: apps/v1
# kind: DaemonSet
# metadata:
#   name: dcgm-exporter
# spec:
#   selector:
#     matchLabels:
#       app: dcgm-exporter
#   template:
#     spec:
#       containers:
#       - name: dcgm-exporter
#         image: nvcr.io/nvidia/k8s/dcgm-exporter:3.3.0-3.2.0-ubuntu22.04
#         ports:
#         - containerPort: 9400

# --- Custom monitoring script ---
import time
import subprocess
import json
from prometheus_client import start_http_server, Gauge

# Prometheus metrics definition
gpu_utilization = Gauge('gpu_utilization_percent', 'GPU utilization', ['gpu_id'])
gpu_memory_used = Gauge('gpu_memory_used_bytes', 'GPU memory used', ['gpu_id'])
gpu_memory_total = Gauge('gpu_memory_total_bytes', 'GPU memory total', ['gpu_id'])
gpu_temperature = Gauge('gpu_temperature_celsius', 'GPU temperature', ['gpu_id'])
gpu_power_draw = Gauge('gpu_power_draw_watts', 'GPU power draw', ['gpu_id'])
inference_latency = Gauge('inference_latency_ms', 'Inference latency', ['model'])
inference_throughput = Gauge('inference_throughput_rps', 'Inference throughput', ['model'])

def collect_gpu_metrics():
    """Collect GPU metrics from nvidia-smi"""
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=index,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
         "--format=csv,noheader,nounits"],
        capture_output=True, text=True
    )

    for line in result.stdout.strip().split('\n'):
        parts = [p.strip() for p in line.split(',')]
        gpu_id = parts[0]
        gpu_utilization.labels(gpu_id=gpu_id).set(float(parts[1]))
        gpu_memory_used.labels(gpu_id=gpu_id).set(float(parts[2]) * 1e6)
        gpu_memory_total.labels(gpu_id=gpu_id).set(float(parts[3]) * 1e6)
        gpu_temperature.labels(gpu_id=gpu_id).set(float(parts[4]))
        gpu_power_draw.labels(gpu_id=gpu_id).set(float(parts[5]))

# Start Prometheus metrics server
start_http_server(9090)
print("GPU metrics server started: http://localhost:9090")

while True:
    collect_gpu_metrics()
    time.sleep(10)

# --- Alert rules (Prometheus) ---
# groups:
# - name: gpu_alerts
#   rules:
#   - alert: GPUMemoryHigh
#     expr: gpu_memory_used_bytes / gpu_memory_total_bytes > 0.95
#     for: 5m
#     labels:
#       severity: warning
#     annotations:
#       summary: "GPU {{$labels.gpu_id}} memory usage exceeded 95%"
#
#   - alert: GPUTemperatureHigh
#     expr: gpu_temperature_celsius > 85
#     for: 2m
#     labels:
#       severity: critical
#     annotations:
#       summary: "GPU {{$labels.gpu_id}} temperature exceeded 85C"
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Always-On Expensive Instances

```
BAD: Keeping p4d.24xlarge ($32.77/hr) running 24/7 during development
    -> $23,594/month (approx. 3.5M JPY)

GOOD:
    - Development/testing -> g5.xlarge ($1.01/hr) is sufficient
    - Production training -> Spot Instances for 60-90% discount
    - Inference -> Auto-scaling based on demand
    - When idle -> Set up auto-stop scripts
```

### Anti-Pattern 2: Ignoring Vendor Lock-In

```
BAD: Developing exclusively with TPU-specific code + JAX only
    -> Cannot migrate away from Google Cloud

GOOD:
    - Develop with PyTorch/TensorFlow (ensure portability)
    - Export models in ONNX format (platform-independent)
    - Unified deployment via Kubernetes (GKE/EKS/AKS)
    - Regularly compare costs and migrate to the optimal provider
```

### Anti-Pattern 3: Unplanned Inference Cost Growth

```
BAD: Serving inference on the same large instances used for training
    -> 8x H100 ($98.32/hr) for inference -> $70,790/month

GOOD:
    1. Model optimization
       - Quantization: INT8/INT4 inference -> Reduce required GPUs by 1/4
       - Distillation: Transfer knowledge from large to small model
       - Pruning: Remove unnecessary parameters
    2. Appropriate instance selection
       - T4/L4/A10G is sufficient for inference
       - Further cost reduction with Inferentia2
    3. Auto-scaling
       - Zero-scale capable setup (Knative, KEDA)
       - Scale down during nights/weekends
```

### Anti-Pattern 4: Overlooking Data Transfer Costs

```
BAD: Training on GCP TPU, inference on AWS SageMaker
    -> High fees for transferring large models (hundreds of GB)

GOOD:
    - Calculate transfer costs in advance
      AWS egress: $0.09/GB -> 100GB model = $9
      GCP egress: $0.12/GB -> Expensive for large data volumes
    - Consolidate training and inference on the same cloud (when possible)
    - Compress models before transfer
    - Use CDN/edge caching (for distributing inference models)
```

### Anti-Pattern 5: Inefficient GPU Resource Utilization

```
BAD: Processing one request at a time (GPU utilization 5-10%)
    -> Using only 10% of $3.67/hr A100

GOOD:
    - Dynamic batching (Triton/vLLM auto-batching)
      -> Batch multiple requests for GPU processing
    - Multi-model serving
      -> Time-share multiple models on a single GPU
    - GPU sharing (MIG: Multi-Instance GPU)
      -> Split A100 into up to 7 independent GPUs
    - Request queue utilization
      -> Maximize batch size with async processing
```

---

## FAQ

### Q1. Should I choose TPU or GPU?

If you primarily use PyTorch, GPU is the clear choice. If you use JAX and are committed to GCP, TPU v5e offers excellent cost-performance. TPU's matrix computation efficiency particularly shines for Transformer-based model training. However, GPU is essential for cutting-edge research requiring custom CUDA kernels. As of 2025, TPU v6e (Trillium) has arrived with 918 TFLOPS BF16 performance, rivaling the H100's 990 TFLOPS at a lower cost.

### Q2. How can I minimize inference costs?

1) Improve GPU utilization efficiency through model quantization (INT8/INT4), 2) Maximize throughput with dynamic batching, 3) Reduce unit costs with ASICs like AWS Inferentia or Google TPU inference, 4) Switch to pay-per-use with SageMaker/Vertex AI serverless inference. For LLM inference specifically, vLLM's PagedAttention is highly effective, achieving 2-4x throughput on the same GPU through efficient KV cache management.

### Q3. Is a multi-cloud strategy practical?

Separating training and inference across different clouds is practical. For example, train on Lambda Labs (affordable) and serve inference on AWS (SageMaker ecosystem). Saving models in ONNX format makes cross-platform migration easy. However, watch out for data transfer costs. Transferring large models (hundreds of GB) can cost $10-50. Running vLLM or Triton on Kubernetes allows the same manifests to work on GKE/EKS/AKS.

### Q4. What are the risks of dedicated GPU clouds (Lambda Labs, CoreWeave)?

Compared to major clouds (AWS, GCP, Azure), the risks include looser SLAs (around 99.5%), fewer managed services (requiring self-managed infrastructure), and limited support. On the other hand, H100 hourly rates of $2-3/hr are less than half the price of major clouds, making them very cost-effective for research and development. A realistic "hybrid strategy" uses major cloud managed services for production inference while leveraging dedicated clouds for training.

### Q5. How do I deal with GPU cloud shortages (GPU Drought)?

The situation where H100/A100 demand exceeded supply was particularly severe in 2024-2025. Countermeasures include: 1) Maintain accounts with multiple providers and check availability, 2) Secure capacity with reserved instances, 3) Leverage alternative GPUs like A100 or L4, 4) Consider non-GPU alternatives like Google TPU or AWS Trainium, 5) Reduce GPU demand itself through model optimization (downsizing, quantization).

### Q6. On-premises GPU servers vs cloud: What is the break-even point?

A server with an A100 80GB costs approximately $20,000-30,000 to purchase. Running an A100 on the cloud for 720 hours/month (always on) costs approximately $2,640/hr x 720 = ~$2,000/month. Therefore, the break-even point is around 10-15 months. However, on-premises costs include electricity ($200-500/month), cooling, maintenance, failure risk, and depreciation, making the effective break-even point around 18-24 months. Considering the GPU generation refresh cycle (2-3 years), cloud is more rational unless you plan to use the hardware for 3+ years.

---

## Summary

| Concept | Key Points |
|------|------|
| Google TPU | Matrix computation-specialized ASIC, high affinity with JAX, 918 TFLOPS on v6e |
| AWS Inferentia | Inference-specialized ASIC, low-cost inference, SageMaker integration |
| AWS Trainium | Training-specialized ASIC, Neuron SDK, 96GB HBM3 on Trainium2 |
| H100/A100 | General-purpose GPUs, largest ecosystem, maximum flexibility |
| Spot Instance | 60-90% discount, checkpoint-based interruption handling required |
| Triton Server | Industry standard for inference serving, dynamic batching |
| vLLM | De facto standard for LLM inference, PagedAttention |
| Dedicated GPU Clouds | Lambda Labs, CoreWeave — affordable GPUs |
| ONNX | Model format ensuring cross-cloud portability |
| MIG | Split A100 into up to 7 partitions for efficient utilization |
| Kubernetes | Cloud-agnostic AI infrastructure management |

---

## Recommended Next Guides

- **01-computing/01-gpu-computing.md** — GPU: NVIDIA/AMD, CUDA
- **01-computing/02-edge-ai.md** — Edge AI: NPU, Coral, Jetson
- **02-emerging/03-future-hardware.md** — Future Hardware: Quantum Computing

---

## References

1. **Google Cloud — TPU Documentation** https://cloud.google.com/tpu/docs
2. **AWS — Neuron SDK Documentation** https://awsdocs-neuron.readthedocs-hosted.com/
3. **NVIDIA Triton Inference Server** https://developer.nvidia.com/triton-inference-server
4. **MLPerf Benchmark Results** https://mlcommons.org/benchmarks/
5. **vLLM — PagedAttention** https://docs.vllm.ai/
6. **TensorRT-LLM** https://github.com/NVIDIA/TensorRT-LLM
7. **CoreWeave — GPU Cloud** https://www.coreweave.com/
8. **Lambda Labs — GPU Cloud** https://lambdalabs.com/
