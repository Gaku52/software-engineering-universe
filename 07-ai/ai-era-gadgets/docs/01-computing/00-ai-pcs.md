# AI PC — NPU-Equipped PCs, Copilot+ PCs, Local LLMs, Snapdragon X

> This guide explains the definition and technical requirements of AI PCs. It covers NPU-equipped processors, Microsoft Copilot+ PC specifications, comparisons of Snapdragon X Elite / Intel Core Ultra / AMD Ryzen AI, and how to run local LLMs.

---

## What You Will Learn

1. **AI PC Definition and Requirements** — NPU 40+ TOPS, Copilot+ PC certification conditions, Windows AI features
2. **Major Processor NPU Comparison** — Snapdragon X / Intel Core Ultra / AMD Ryzen AI
3. **Running Local LLMs** — On-device inference with Ollama / LM Studio / llama.cpp


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. AI PC Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI PC Architecture                         │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    CPU       │  │    GPU       │  │       NPU            │  │
│  │ (General     │  │ (Graphics   │  │ (AI Inference         │  │
│  │  Purpose)    │  │  + AI       │  │  Dedicated)           │  │
│  │ P+E Cores   │  │  Training)  │  │ INT8/INT4 Optimized   │  │
│  │ ~100 TOPS   │  │ ~100 TOPS   │  │ 40-75 TOPS           │  │
│  │ (FP32)      │  │ (FP16)      │  │ (INT8)               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│          │                │                    │              │
│          └────────────────┼────────────────────┘              │
│                           │                                   │
│                   ┌───────▼──────┐                            │
│                   │ Windows ML / │                            │
│                   │ DirectML /   │                            │
│                   │ ONNX Runtime │                            │
│                   └──────────────┘                            │
│                           │                                   │
│                   ┌───────▼──────┐                            │
│                   │ Copilot+     │                            │
│                   │ AI Features  │                            │
│                   │ (Recall etc.)│                            │
│                   └──────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 NPU Inference Pipeline

```
┌─────────────────────────────────────────────┐
│          NPU Inference Pipeline               │
│                                               │
│  Input Data                                   │
│    │                                          │
│    ▼                                          │
│  ┌──────────┐                                │
│  │ Quantized │  INT8/INT4 Model               │
│  │ Model     │  (ONNX Format)                 │
│  └──────────┘                                │
│    │                                          │
│    ▼                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ MAC Array│→ │ Activation│→ │ Output   │   │
│  │ (Matrix  │  │ (Activa- │  │ (Post-   │   │
│  │  Multiply)│  │  tion)   │  │  Process)│   │
│  │ INT8×INT8│  │ ReLU/GELU │  │ Softmax  │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│                                    │          │
│                                    ▼          │
│                              Inference Result  │
│                              (3-10ms)         │
└─────────────────────────────────────────────┘
```

### 1.2 AI PC Software Stack Details

```
┌──────────────────────────────────────────────────────┐
│              AI PC Software Stack                       │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ Application Layer                                │   │
│  │ Copilot, Adobe Creative Suite, DaVinci Resolve  │   │
│  │ Visual Studio (IntelliCode), Browser AI Features │   │
│  └───────────────────────┬────────────────────────┘   │
│                           │                            │
│  ┌───────────────────────▼────────────────────────┐   │
│  │ AI Framework Layer                               │   │
│  │ ONNX Runtime | DirectML | OpenVINO | Core ML    │   │
│  │ PyTorch | TensorFlow | llama.cpp                │   │
│  └───────────────────────┬────────────────────────┘   │
│                           │                            │
│  ┌───────────────────────▼────────────────────────┐   │
│  │ API / Runtime Layer                               │   │
│  │ Windows ML | NNAPI | Vulkan Compute              │   │
│  │ CUDA (NVIDIA) | ROCm (AMD) | oneAPI (Intel)     │   │
│  └───────────────────────┬────────────────────────┘   │
│                           │                            │
│  ┌───────────────────────▼────────────────────────┐   │
│  │ Driver / Hardware Abstraction Layer               │   │
│  │ NPU Driver | GPU Driver | CPU Microcode          │   │
│  └───────────────────────┬────────────────────────┘   │
│                           │                            │
│  ┌───────────────────────▼────────────────────────┐   │
│  │ Hardware Layer                                    │   │
│  │ NPU (Hexagon/AI Boost/XDNA) | GPU | CPU         │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## 2. Code Examples

### Code Example 1: NPU Inference with Windows ML

```csharp
using Microsoft.AI.MachineLearning;

// Run an ONNX model on the NPU
async Task RunOnNPU()
{
    // Load the model
    var model = await LearningModel.LoadFromFilePath("model.onnx");

    // Specify the NPU device
    var device = new LearningModelDevice(
        LearningModelDeviceKind.DirectXHighPerformance // NPU preferred
    );
    var session = new LearningModelSession(model, device);

    // Prepare input data
    var binding = new LearningModelBinding(session);
    var inputTensor = TensorFloat.CreateFromArray(
        new long[] { 1, 3, 224, 224 },
        imageData
    );
    binding.Bind("input", inputTensor);

    // Run inference
    var result = await session.EvaluateAsync(binding, "inference");
    var output = result.Outputs["output"] as TensorFloat;

    Console.WriteLine($"Inference complete: {output.GetAsVectorView()[0]}");
}
```

### Code Example 2: Running a Local LLM with Ollama

```bash
# Install and run Ollama

# Download and run models
ollama pull llama3.1:8b        # Llama 3.1 8B (4.7GB)
ollama pull gemma2:9b          # Gemma 2 9B (5.4GB)
ollama pull phi3:mini           # Phi-3 Mini 3.8B (2.3GB)

# Start a conversation
ollama run llama3.1:8b

# Use via API (REST API)
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Implement quicksort in Python",
  "stream": false
}'
```

```python
# Use Ollama from Python
import ollama

# Chat
response = ollama.chat(model='llama3.1:8b', messages=[
    {'role': 'system', 'content': 'Please answer concisely.'},
    {'role': 'user', 'content': 'What is the NPU in an AI PC?'}
])
print(response['message']['content'])

# Streaming
for chunk in ollama.chat(
    model='llama3.1:8b',
    messages=[{'role': 'user', 'content': 'Hello'}],
    stream=True
):
    print(chunk['message']['content'], end='', flush=True)
```

### Code Example 3: Leveraging NPU/GPU with llama.cpp

```bash
# Build llama.cpp (with Vulkan GPU support)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DGGML_VULKAN=ON  # GPU backend
cmake --build build --config Release

# Run a quantized model (Q4_K_M: balance between quality and size)
./build/bin/llama-cli \
  -m models/llama-3.1-8b-q4_k_m.gguf \
  -p "List 3 advantages of AI PCs:" \
  -n 256 \
  --n-gpu-layers 33 \    # Number of GPU layers
  --threads 8 \           # Number of CPU threads
  --temp 0.7
```

```python
# Use with llama-cpp-python
from llama_cpp import Llama

llm = Llama(
    model_path="models/llama-3.1-8b-q4_k_m.gguf",
    n_ctx=4096,        # Context length
    n_gpu_layers=33,   # GPU layers (-1 for all layers on GPU)
    n_threads=8,       # CPU threads
    verbose=False
)

output = llm(
    "Explain the NPU in AI PCs.",
    max_tokens=256,
    temperature=0.7,
    stop=[".\n\n"]
)
print(output['choices'][0]['text'])
# Check tokens/sec (20-40 tok/s when leveraging NPU/GPU)
```

### Code Example 4: Cross-Platform NPU Inference with ONNX Runtime

```python
import onnxruntime as ort
import numpy as np

# Check available providers
print("Available:", ort.get_available_providers())
# → ['DmlExecutionProvider', 'QNNExecutionProvider', 'CPUExecutionProvider']

# Execute with priority: NPU (QNN) > GPU (DML) > CPU
providers = ['QNNExecutionProvider', 'DmlExecutionProvider', 'CPUExecutionProvider']

session = ort.InferenceSession(
    "model_int8.onnx",
    providers=providers,
    provider_options=[
        {'backend_path': 'QnnHtp.dll'},  # NPU (Qualcomm HTP)
        {},                               # GPU (DirectML)
        {}                                # CPU
    ]
)

# Inference
input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)
result = session.run(None, {"input": input_data})

# Check the active execution provider
active = session.get_providers()
print(f"In use: {active[0]}")  # → 'QNNExecutionProvider' (NPU)
```

### Code Example 5: Phi Silica on Copilot+ PC (Windows AI API)

```python
# Windows AI Foundation Model API (Windows 11 24H2 and later)
import windowsai

async def use_phi_silica():
    """Use the built-in Phi Silica model on a Copilot+ PC"""

    # Access the on-device LLM (Phi Silica)
    model = await windowsai.LanguageModel.create_async()

    # Text generation
    result = await model.generate_async(
        prompt="Summarize these meeting notes: ...",
        max_tokens=200
    )
    print(result.text)

    # Streaming generation
    async for token in model.generate_stream_async(
        prompt="Draft an email reply",
        max_tokens=300
    ):
        print(token, end="", flush=True)

# Note: Only runs on Copilot+ PCs (NPU 40+ TOPS)
```

### Code Example 6: Intel NPU Inference with OpenVINO

```python
import openvino as ov
import numpy as np

def run_on_intel_npu(model_path: str, input_data: np.ndarray):
    """Run inference on the Intel Core Ultra NPU (AI Boost)"""

    core = ov.Core()

    # Check available devices
    devices = core.available_devices
    print(f"Available devices: {devices}")
    # → ['CPU', 'GPU', 'NPU']

    # Load the model
    model = core.read_model(model_path)

    # Compile with NPU optimization
    compiled_model = core.compile_model(
        model,
        device_name="NPU",
        config={
            "NPU_COMPILER_TYPE": "DRIVER",
            "PERFORMANCE_HINT": "LATENCY",
        }
    )

    # Inference request
    infer_request = compiled_model.create_infer_request()
    infer_request.set_input_tensor(ov.Tensor(input_data))

    # Run inference and measure time
    import time
    start = time.perf_counter()
    infer_request.infer()
    elapsed = (time.perf_counter() - start) * 1000

    output = infer_request.get_output_tensor().data
    print(f"Inference time: {elapsed:.2f}ms (NPU)")

    return output

# Run inference with an INT8 quantized model
input_image = np.random.randn(1, 3, 224, 224).astype(np.float32)
result = run_on_intel_npu("mobilenet_v3_int8.xml", input_image)
```

### Code Example 7: Running Models on Ryzen AI (XDNA NPU)

```python
# NPU inference using AMD Ryzen AI Software
import vitis_ai_runtime as vai

def run_on_ryzen_ai(model_path: str, input_data):
    """Run inference on the AMD Ryzen AI (XDNA 2 NPU)"""

    # Initialize Vitis AI runtime
    runner = vai.Runner(model_path)

    # Prepare input tensors
    input_tensors = runner.get_input_tensors()
    output_tensors = runner.get_output_tensors()

    # Run inference on the NPU
    job_id = runner.execute_async(input_data, output_tensors)
    runner.wait(job_id)

    return output_tensors

# ONNX → Vitis AI conversion flow
# 1. Prepare the ONNX model
# 2. Quantize to INT8 with Vitis AI Quantizer
# 3. Compile for XDNA with Vitis AI Compiler
# 4. Execute with the runtime

# Example conversion commands:
# vai_q_onnx quantize --model model.onnx \
#     --output_model model_int8.onnx \
#     --calibration_data_reader calibration_data
```

### Code Example 8: Local LLM Benchmark Script

```python
import time
import subprocess
import json
from dataclasses import dataclass

@dataclass
class BenchmarkResult:
    model_name: str
    quantization: str
    tokens_per_second: float
    time_to_first_token: float
    memory_usage_gb: float
    backend: str

def benchmark_ollama_model(model_name: str, prompt: str, num_runs: int = 5):
    """Benchmark performance of an Ollama model"""
    results = []

    for i in range(num_runs):
        start = time.perf_counter()

        # Call the Ollama API
        response = subprocess.run(
            ["curl", "-s", "http://localhost:11434/api/generate",
             "-d", json.dumps({
                 "model": model_name,
                 "prompt": prompt,
                 "stream": False,
                 "options": {"num_predict": 128}
             })],
            capture_output=True, text=True
        )

        elapsed = time.perf_counter() - start
        data = json.loads(response.stdout)

        tokens = data.get("eval_count", 0)
        eval_duration = data.get("eval_duration", 1) / 1e9  # ns → s
        prompt_eval_duration = data.get("prompt_eval_duration", 0) / 1e9

        results.append({
            "tokens": tokens,
            "tokens_per_sec": tokens / eval_duration if eval_duration > 0 else 0,
            "ttft": prompt_eval_duration,
            "total_time": elapsed,
        })

    # Calculate averages
    avg_tps = sum(r["tokens_per_sec"] for r in results) / len(results)
    avg_ttft = sum(r["ttft"] for r in results) / len(results)

    print(f"=== {model_name} Benchmark Results ===")
    print(f"  Avg generation speed: {avg_tps:.1f} tokens/sec")
    print(f"  Avg TTFT: {avg_ttft*1000:.0f}ms")
    print(f"  Number of runs: {num_runs}")

    return BenchmarkResult(
        model_name=model_name,
        quantization="Q4_K_M",
        tokens_per_second=avg_tps,
        time_to_first_token=avg_ttft,
        memory_usage_gb=0,
        backend="ollama"
    )

# Benchmark multiple models
models = ["phi3:mini", "llama3.1:8b", "gemma2:9b", "mistral:7b"]
prompt = "Explain the concept of NPU in AI PCs in 3 sentences."

for model in models:
    benchmark_ollama_model(model, prompt)
```

---

## 3. Comparison Tables

### Comparison Table 1: Major AI PC Processor Comparison

| Item | Snapdragon X Elite | Intel Core Ultra 200V | AMD Ryzen AI 300 |
|------|-------------------|---------------------|-----------------|
| NPU Performance | 45 TOPS | 48 TOPS | 50 TOPS |
| NPU Name | Hexagon NPU | Intel AI Boost (NPU4) | XDNA 2 (Ryzen AI) |
| CPU | Oryon 12-core | P+E Cores (16 threads) | Zen 5 (16 threads) |
| GPU | Adreno X1-85 | Intel Arc (Xe2) | Radeon 890M |
| Power Efficiency | Excellent (ARM) | Good | Good |
| Copilot+ PC | Supported | Supported | Supported |
| Local LLM | 7B-13B models | 7B-13B models | 7B-13B models |
| Supported OS | Windows 11 (ARM) | Windows 11 | Windows 11 |

### Comparison Table 2: Local LLM Execution Tool Comparison

| Tool | GUI | API | Quantization Support | NPU Support | Multi-Model | Difficulty |
|--------|-----|-----|-----------|---------|------------|--------|
| Ollama | None (CLI) | REST API | GGUF (Q4/Q5/Q8) | Limited | Concurrent | Low |
| LM Studio | Yes | OpenAI-compatible | All GGUF | Limited | Switchable | Low |
| llama.cpp | None (CLI) | HTTP Server | All GGUF | Vulkan/CUDA | Single | Medium |
| vLLM | None | OpenAI-compatible | AWQ/GPTQ | CUDA | Batch inference | High |
| GPT4All | Yes | Python API | GGUF | Limited | Switchable | Low |

### Comparison Table 3: GGUF Quantization Levels and Quality

| Quantization Level | Bit Width | 7B Model Size | Quality (Perplexity) | Inference Speed | Recommended Use |
|------------|---------|-------------|------------------|---------|---------|
| Q2_K | 2-3bit | ~2.8GB | Low (significant loss) | Fastest | Speed-first / testing |
| Q3_K_M | 3bit | ~3.3GB | Slightly low | Fast | Tight memory constraints |
| Q4_K_M | 4bit | ~4.1GB | Good | Fast | Most recommended (best balance) |
| Q5_K_M | 5bit | ~4.8GB | High | Moderate | Quality-focused |
| Q6_K | 6bit | ~5.5GB | Very high | Slightly slow | High-quality inference |
| Q8_0 | 8bit | ~7.2GB | Highest | Slow | Quality-first |
| FP16 | 16bit | ~14GB | Baseline | Slowest | Research / evaluation |

### Comparison Table 4: Copilot+ PC AI Feature List

| Feature | Description | Required NPU | Processing Location | Supported Version |
|------|------|---------|---------|-------------|
| Recall | AI search of screen history | 40+ TOPS | NPU (on-device) | Windows 11 24H2 |
| Live Captions | Real-time translated subtitles | 40+ TOPS | NPU | Windows 11 24H2 |
| Image Creator | Text-to-image generation | 40+ TOPS | NPU | Windows 11 24H2 |
| Cocreator (Paint) | AI-assisted drawing | 40+ TOPS | NPU | Windows 11 24H2 |
| Windows Studio Effects | Background blur, eye contact | 10+ TOPS | NPU | Windows 11 23H2+ |
| Copilot | AI assistant | Not required | Cloud | Windows 11 (all) |

---

## 4. Practical Use Cases and Applications

### Use Case 1: Local RAG (Retrieval-Augmented Generation) System

```python
import ollama
import chromadb
from sentence_transformers import SentenceTransformer

class LocalRAGSystem:
    """
    A fully local RAG system running on an AI PC.
    Privacy protection: Data never leaves the device.
    """

    def __init__(self):
        # Embedding model (local execution)
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        # Vector DB (local persistence)
        self.chroma = chromadb.PersistentClient(path="./local_vectordb")
        self.collection = self.chroma.get_or_create_collection("documents")

    def add_document(self, text: str, metadata: dict = None):
        """Add a document to the vector DB"""
        embedding = self.embedder.encode(text).tolist()
        doc_id = f"doc_{self.collection.count()}"
        self.collection.add(
            documents=[text],
            embeddings=[embedding],
            ids=[doc_id],
            metadatas=[metadata or {}]
        )
        print(f"Document added: {doc_id}")

    def query(self, question: str, n_results: int = 3) -> str:
        """Generate a RAG response for a question"""
        # Search for similar documents
        query_embedding = self.embedder.encode(question).tolist()
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )

        context = "\n\n".join(results['documents'][0])

        # Generate response with a local LLM
        response = ollama.chat(
            model='llama3.1:8b',
            messages=[
                {'role': 'system',
                 'content': f'Answer based on the following context.\n\nContext:\n{context}'},
                {'role': 'user', 'content': question}
            ]
        )
        return response['message']['content']

# Usage example
rag = LocalRAGSystem()
rag.add_document("AI PCs are equipped with NPUs that have 40+ TOPS of performance...")
rag.add_document("Copilot+ PC is an AI PC standard defined by Microsoft...")
answer = rag.query("What are the requirements for a Copilot+ PC?")
print(answer)
```

### Use Case 2: Local Code Completion Server

```python
from llama_cpp import Llama
from flask import Flask, request, jsonify

app = Flask(__name__)

# Load a code completion model
llm = Llama(
    model_path="models/codellama-7b-instruct-q4_k_m.gguf",
    n_ctx=4096,
    n_gpu_layers=-1,  # All layers on GPU
    n_threads=8,
)

@app.route('/v1/completions', methods=['POST'])
def code_completion():
    """VS Code / JetBrains compatible code completion API"""
    data = request.json
    prompt = data.get('prompt', '')
    max_tokens = data.get('max_tokens', 128)

    output = llm(
        prompt,
        max_tokens=max_tokens,
        temperature=0.2,  # Low temperature recommended for code completion
        stop=["\n\n", "```", "def ", "class "],
    )

    return jsonify({
        "choices": [{
            "text": output['choices'][0]['text'],
            "finish_reason": output['choices'][0]['finish_reason']
        }],
        "usage": output['usage']
    })

# Can be used with VS Code's Continue extension
# config.json: {"model": "codellama", "apiBase": "http://localhost:5000"}
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### Use Case 3: Real-Time Video Processing Using the NPU

```python
import onnxruntime as ort
import cv2
import numpy as np
import time

class NPUVideoProcessor:
    """Real-time video processing with the NPU (background blur, object detection)"""

    def __init__(self):
        # Background segmentation model (NPU execution)
        self.seg_session = ort.InferenceSession(
            "selfie_segmentation_int8.onnx",
            providers=['QNNExecutionProvider', 'DmlExecutionProvider', 'CPUExecutionProvider']
        )

        # Object detection model (NPU execution)
        self.det_session = ort.InferenceSession(
            "yolov8n_int8.onnx",
            providers=['QNNExecutionProvider', 'DmlExecutionProvider', 'CPUExecutionProvider']
        )

        print(f"Segmentation: {self.seg_session.get_providers()[0]}")
        print(f"Object detection: {self.det_session.get_providers()[0]}")

    def process_frame(self, frame):
        """Process a single frame (background blur + object detection)"""
        # Background segmentation
        input_seg = cv2.resize(frame, (256, 256))
        input_seg = input_seg.astype(np.float32) / 255.0
        input_seg = np.transpose(input_seg, (2, 0, 1))[np.newaxis]

        mask = self.seg_session.run(None, {"input": input_seg})[0]
        mask = cv2.resize(mask[0, 0], (frame.shape[1], frame.shape[0]))

        # Apply background blur
        blurred = cv2.GaussianBlur(frame, (21, 21), 0)
        mask_3d = np.stack([mask] * 3, axis=-1)
        result = (frame * mask_3d + blurred * (1 - mask_3d)).astype(np.uint8)

        return result

    def run_camera(self):
        """Real-time processing from camera input"""
        cap = cv2.VideoCapture(0)
        fps_counter = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            start = time.perf_counter()
            result = self.process_frame(frame)
            elapsed = time.perf_counter() - start

            fps_counter.append(1.0 / elapsed)
            if len(fps_counter) > 30:
                fps_counter.pop(0)
            avg_fps = sum(fps_counter) / len(fps_counter)

            cv2.putText(result, f"FPS: {avg_fps:.1f} (NPU)",
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.imshow("AI PC NPU Demo", result)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()

# With NPU: 30+ FPS (background blur + object detection)
# With CPU: 5-10 FPS
```

---

## 5. Troubleshooting Guide

### Problem 1: "Out of Memory" Error in Ollama

```
Symptom: ollama run llama3.1:8b crashes with "out of memory"

Diagnostic steps:
1. Check available memory
   $ free -h (Linux) / Task Manager (Windows)
   → At least model size + 2GB of free RAM is needed

2. Change quantization level
   $ ollama pull llama3.1:8b    # Q4_K_M (4.7GB) → RAM 8GB+
   $ ollama pull phi3:mini       # (2.3GB) → RAM 6GB+
   $ ollama pull gemma2:2b       # (1.6GB) → RAM 4GB+

3. Check GPU VRAM (when using GPU offloading)
   $ nvidia-smi  # NVIDIA
   → If GPU memory is insufficient, reduce n_gpu_layers

4. Check swap usage
   → If swap usage is increasing, inference speed will drop significantly
   → Use a smaller model or add more RAM
```

### Problem 2: NPU Not Recognized

```
Symptom: QNNExecutionProvider does not appear in ONNX Runtime

Solutions:
1. Check NPU driver
   → Device Manager > Neural Processors
   → Verify the driver is up to date

2. Check ONNX Runtime version
   → NPU support requires ort 1.17+
   $ pip install onnxruntime-qnn  # For Qualcomm NPU
   $ pip install onnxruntime-directml  # DirectML (GPU + NPU)

3. Check Windows version
   → Full NPU support requires Windows 11 24H2 or later
   → Settings > System > About to verify

4. Check model compatibility
   → NPU only supports INT8 quantized models
   → FP32/FP16 models will fall back to GPU/CPU
```

### Problem 3: Slow Local LLM Inference Speed

```
Symptom: Not achieving the expected tokens/sec

Checklist:
[ ] Is GPU offloading enabled?
  → llama.cpp: --n-gpu-layers 33 (all layers on GPU)
  → Ollama: Auto-detected, but runs on CPU if CUDA/ROCm is not installed

[ ] Is the context length too long?
  → n_ctx=4096 → 8192 roughly halves the speed
  → Set the minimum necessary context length

[ ] Is the batch size appropriate?
  → n_batch=512 is the default. Increase to 1024 if memory allows

[ ] Is the quantization level appropriate?
  → Q4_K_M is the best balance of speed and quality
  → Q2_K is fastest but has significant quality loss

[ ] Are background processes consuming CPU/GPU?
  → Temporarily disable browser GPU acceleration, etc.
```

---

## 6. Performance Optimization Tips

### Tip 1: Relationship Between Model Size and RAM

```
┌────────────────────────────────────────────────┐
│     Recommended Model Size by RAM Quick Guide   │
│                                                  │
│  RAM 8GB  ━━━━━━━━━━━━━━━━━━━                  │
│           Phi-3 Mini 3.8B (Q4) ✓                │
│           Gemma 2 2B (Q4) ✓                     │
│           Llama 3.1 8B (Q4) △ (Barely fits)     │
│                                                  │
│  RAM 16GB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│           Llama 3.1 8B (Q4) ✓                   │
│           Mistral 7B (Q4) ✓                     │
│           Gemma 2 9B (Q4) ✓                     │
│           CodeLlama 13B (Q4) △                   │
│                                                  │
│  RAM 32GB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│           Llama 3.1 8B (Q8) ✓                   │
│           Mixtral 8x7B (Q4) ✓                   │
│           CodeLlama 34B (Q4) △                   │
│                                                  │
│  RAM 64GB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│           Llama 3.1 70B (Q4) ✓                  │
│           Qwen 72B (Q4) ✓                       │
│           Command R+ 104B (Q4) △                 │
│                                                  │
│  ✓ = Runs smoothly  △ = Runs but may be slow    │
└────────────────────────────────────────────────┘
```

### Tip 2: Choosing Between NPU vs GPU vs CPU

| Workload | Recommended | Reason |
|------------|------|------|
| Always-on background blur (video calls) | NPU | Power-efficient continuous execution |
| LLM inference (chat) | GPU | High speed with VRAM utilization |
| Batch image classification | NPU | High efficiency with INT8 quantization |
| Image generation (Stable Diffusion) | GPU | Requires FP16/BF16 |
| Speech recognition (real-time) | NPU | Low latency is critical |
| Code completion | GPU+CPU | Moderate speed is sufficient |
| RAG search (embedding generation) | NPU | Fast inference for small models |
| Video editing AI effects | GPU | High throughput needed |

### Tip 3: Setting Up an AI Development Environment on Windows

```bash
# 1. Basic environment
winget install Python.Python.3.12
winget install Git.Git
winget install Ollama.Ollama

# 2. CUDA (for NVIDIA GPUs)
# Install from https://developer.nvidia.com/cuda-downloads

# 3. Python AI packages
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install onnxruntime-directml  # DirectML (GPU + NPU)
pip install transformers accelerate
pip install llama-cpp-python  # Local LLM

# 4. Download Ollama models
ollama pull llama3.1:8b
ollama pull codellama:7b-instruct
ollama pull nomic-embed-text  # Embedding model

# 5. Verify setup
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"
python -c "import onnxruntime as ort; print(ort.get_available_providers())"
curl http://localhost:11434/api/tags  # List Ollama models
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Judging AI Performance Solely by NPU TOPS

```
Bad example:
Assuming "50 TOPS NPU means everything runs fast"
→ NPU is specialized for INT8 inference. FP32 models fall back to GPU/CPU.

Correct approach:
- NPU TOPS is a metric exclusively for INT8 quantized models
- GPU (VRAM) matters more for LLM execution
- Judge by actual benchmarks (inference speed in tok/s)
- Verify NPU compatibility of models in advance
```

### Anti-Pattern 2: Trying to Run Large LLMs with Insufficient RAM

```
Bad example:
Trying to run a 70B parameter model on a PC with 16GB RAM
→ Swap occurs and inference speed drops to less than 1/10

Correct approach (recommended models by RAM):
- 8GB RAM  → Phi-3 Mini (3.8B, Q4) / Gemma 2 2B
- 16GB RAM → Llama 3.1 8B (Q4) / Mistral 7B (Q4)
- 32GB RAM → Llama 3.1 8B (Q8) / Mixtral 8x7B (Q4)
- 64GB RAM → Llama 3.1 70B (Q4) / Qwen 72B (Q4)
```

### Anti-Pattern 3: Exposing a Local LLM Without Security Considerations

```
Bad example:
Exposing the Ollama API to the network without a firewall
→ Unauthorized model usage, prompt injection attacks from outside

Correct approach:
- Ollama binds to localhost only by default
- Set up a reverse proxy + authentication for external access
- Implement rate limiting (max requests per minute)
- Sanitize inputs and protect against prompt injection
- Always enable SSL/TLS
```

### Anti-Pattern 4: Ignoring ARM Windows Compatibility Issues

```
Bad example:
Trying to use x86-only apps on a Snapdragon X Elite (ARM) PC
→ Performance degradation from the emulation layer, some apps may not work

Correct approach:
- Prefer ARM-native apps (Python, VS Code, Chrome, etc. are supported)
- llama.cpp has ARM builds available
- Ollama natively supports ARM Windows
- Expect performance degradation when x86 emulation is needed
- Check ARM compatibility of target apps before purchasing
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
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

# Tests
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
- Be aware of algorithm computational complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to Prioritize | When Compromise Is Acceptable |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                  │
│    ├─ Small (1-5) → Monolith                     │
│    └─ Large (10+) → Go to (2)                    │
│                                                 │
│  (2) Deploy frequency?                           │
│    ├─ Once a week or less → Monolith + modules   │
│    └─ Daily / multiple times → Go to (3)         │
│                                                 │
│  (3) Independence between teams?                 │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-Off Analysis

Technical decisions always involve trade-offs. Analyze them from the following perspectives:

**1. Short-term vs. Long-term Costs**
- A method that is fast in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
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
- Automated tests only for critical paths
- Introduce monitoring from the start

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually modernize a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create characterization tests first if existing tests are missing
- Use an API gateway to run old and new systems side by side
- Perform data migration in stages

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate from peripheral features | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission legacy system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** More than 50 engineers working on the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Set ownership per team
- Manage shared libraries with an Inner Source approach
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
        """Check SLA compliance"""
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

### Scenario 4: Performance-Critical Systems

**Situation:** A system that requires millisecond-level responses

**Optimization Points:**
1. Caching strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Impact | Implementation Cost | Applicable Scenario |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound operations |

---

## Team Development Practices

### Code Review Checklist

Points to verify during code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any impact on performance?
- [ ] Are there any security issues?
- [ ] Is documentation updated?

### Knowledge Sharing Best Practices

| Method | Frequency | Target | Impact |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Entire team | Horizontal knowledge sharing |
| ADR (Decision Records) | As needed | Future members | Decision transparency |
| Retrospectives | Biweekly | Entire team | Continuous improvement |
| Mob programming | Monthly | Important designs | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        Impact High
          │
    ┌─────┼─────┐
    │ Plan │ Fix  │
    │ and  │ Imme-│
    │ sche-│ dia- │
    │ dule │ tely │
    ├─────┼─────┤
    │ Log  │ Next │
    │ only │ Sprint│
    │      │      │
    └─────┼─────┘
          │
        Impact Low
    Frequency Low  Frequency High
```
---

## 8. FAQ

### Q1: What is a Copilot+ PC? How is it different from a regular PC?

**A:** A Copilot+ PC is an AI PC standard defined by Microsoft that must meet the following requirements:
- NPU 40+ TOPS
- RAM 16GB or more
- SSD 256GB or more
- Windows 11 24H2 or later

The key difference from regular PCs is that AI features such as Recall (AI search of screen history), Live Captions (real-time translated subtitles), and Image Creator (on-device image generation) run at high speed on the NPU.

### Q2: What level of quality can be achieved with local LLMs?

**A:** With an 8B parameter (Q4 quantized) model, you can get practical quality for simple Q&A, code generation, and summarization tasks. Reasoning capabilities are inferior compared to GPT-4 or Claude 3.5, but the advantages include privacy protection, offline usage, and being free. Models with 13B+ parameters deliver considerably high quality.

### Q3: Should I use the NPU or GPU for AI processing?

**A:** It depends on the task:
- **NPU-suited**: Always-on background AI (speech recognition, camera correction, notification filtering). Power efficiency is critical.
- **GPU-suited**: LLM inference, image generation, batch processing. VRAM and throughput are critical.
- **Hybrid**: The optimal approach is preprocessing on the NPU and main inference on the GPU.

### Q4: Is image generation (Stable Diffusion) practical on AI PCs?

**A:** It depends on GPU performance:
- **Snapdragon X Elite (Adreno)**: SD 1.5 takes about 15-30 seconds. SDXL is difficult due to memory constraints.
- **Intel Arc (Xe2)**: SD 1.5 takes 10-20 seconds with OpenVINO optimization.
- **AMD Radeon 890M**: SD 1.5 takes 10-25 seconds with ROCm support.
- **dGPU (RTX 4060+)**: SD 1.5 takes 3-5 seconds, SDXL takes 10-15 seconds, practical for use.
- NPU is not suitable for image generation (requires FP16/FP32).

### Q5: How does a MacBook (Apple Silicon) compare to an AI PC?

**A:** Apple Silicon (M3/M4) has unique strengths with its unified memory architecture:
- **Memory**: Up to 128GB shared between CPU/GPU/NPU. No GPU memory shortages occur.
- **Neural Engine**: Up to 38 TOPS. Excellent Core ML integration.
- **MLX**: Optimized with Apple's proprietary AI framework.
- **LLM execution**: 70B models can run on the 64GB model.
- Windows AI PCs have the advantage of a broader software ecosystem and lower-priced lineups.

---

## 9. Edge Case Analysis

### Edge Case 1: Conflicts Between Integrated Memory and Discrete GPUs

Many AI PCs have an iGPU built in while also supporting external eGPUs or Thunderbolt-connected dGPUs. In this case, which device DirectML/ONNX Runtime selects becomes an issue.

```python
# Device enumeration and explicit selection when multiple GPUs are present
import onnxruntime as ort

# Check all available ExecutionProviders
providers = ort.get_available_providers()
print(f"Available: {providers}")
# e.g.: ['TensorrtExecutionProvider', 'CUDAExecutionProvider',
#         'DmlExecutionProvider', 'QNNExecutionProvider', 'CPUExecutionProvider']

# Prefer dGPU (CUDA), then iGPU (DirectML), then NPU
preferred_providers = [
    ('CUDAExecutionProvider', {'device_id': 0}),
    ('DmlExecutionProvider', {'device_id': 0}),  # iGPU
    ('QNNExecutionProvider', {}),                  # NPU
    ('CPUExecutionProvider', {}),
]

session = ort.InferenceSession("model.onnx", providers=preferred_providers)
active = session.get_providers()
print(f"Currently in use: {active[0]}")
```

**Note**: Hot-plugging (connecting/disconnecting while running) an eGPU will crash the session. When using an eGPU, always connect it before startup and disconnect after the session ends.

### Edge Case 2: Accuracy Degradation in NPU Models and Detection

Models optimized for NPU with INT8 quantization may have lower accuracy compared to the FP32 original. This is particularly noticeable in the following cases:

```
Cases prone to accuracy degradation:
├── Long text generation (500+ tokens)
│   → Cumulative errors degrade output quality
├── Mixed-language text
│   → Degradation when switching between languages
├── Inference involving numerical calculations
│   → INT8 precision is insufficient for arithmetic
└── Small object detection (image AI)
    → Quantization loses fine-grained features

Accuracy verification script:
$ python -c "
from sklearn.metrics import accuracy_score
# Compare FP32 and INT8 outputs
fp32_results = run_model('model_fp32.onnx', test_data)
int8_results = run_model('model_int8.onnx', test_data)
acc = accuracy_score(fp32_results, int8_results)
print(f'INT8 agreement rate: {acc:.4f}')  # 0.98+ is acceptable
"
```

### Edge Case 3: AI Performance Throttling on Battery Power

When a laptop runs on battery, both NPU and GPU are subject to power throttling:

| Power State | NPU Performance | GPU Performance | LLM Inference Speed |
|---------|---------|---------|------------|
| AC power connected | 100% (45 TOPS) | 100% | 15 tok/s |
| Battery (High Performance) | 80% (36 TOPS) | 70% | 10 tok/s |
| Battery (Balanced) | 50% (22 TOPS) | 40% | 6 tok/s |
| Battery (Power Saver) | 30% (13 TOPS) | 20% | 3 tok/s |

```powershell
# Check and change the power plan programmatically on Windows
powercfg /getactivescheme
# Switch to high performance mode before running AI processing
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
```

**Best Practice**: Implement an adaptive loading pattern that automatically switches to smaller models when running on battery power.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently used in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| AI PC Definition | Equipped with NPU 40+ TOPS, Copilot+ PC certified |
| Major NPUs | Hexagon (Qualcomm), AI Boost (Intel), XDNA (AMD) |
| Local LLM | 7B-13B models are practical with Ollama/LM Studio |
| Quantization | INT8/INT4 (GGUF format) optimized for NPU/memory |
| Dev Tools | ONNX Runtime, DirectML, Windows ML, OpenVINO |
| Selection Criteria | Prioritize RAM capacity and actual benchmarks over TOPS |
| Security | Authentication and rate limiting are essential when exposing local LLMs |
| ARM Compatibility | Prefer ARM-native apps on Snapdragon X |

---

## Recommended Next Reads

- [GPU Computing — NVIDIA RTX, CUDA](./01-gpu-computing.md)
- [Edge AI — Jetson, Coral, ONNX Runtime](./02-edge-ai.md)
- DL Frameworks — PyTorch, TensorFlow

---

## References

1. **Microsoft** — "Copilot+ PCs Technical Specifications," microsoft.com, 2024
2. **Qualcomm** — "Snapdragon X Elite Compute Platform," qualcomm.com, 2024
3. **Intel** — "Intel Core Ultra Processors with Intel AI Boost," intel.com, 2024
4. **Ollama** — "Run Large Language Models Locally," ollama.com, 2024
5. **ONNX Runtime** — "QNN Execution Provider," onnxruntime.ai, 2024
6. **OpenVINO** — "Intel NPU Plugin," docs.openvino.ai, 2024
