# Edge AI Guide

> Leverage NPUs, Google Coral, and NVIDIA Jetson for local AI inference without cloud dependency

## What You Will Learn in This Chapter

1. **Edge AI Fundamentals** — Differences from cloud AI, roles of NPU/VPU/TPU
2. **Major Platforms** — Practical usage of NVIDIA Jetson, Google Coral, and Apple Neural Engine
3. **Optimization Techniques** — Edge model optimization through quantization, pruning, and knowledge distillation


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of the [GPU Computing Guide](./01-gpu-computing.md)

---

## 1. Edge AI Fundamentals

### Cloud AI vs Edge AI

```
+-----------------------------+     +-----------------------------+
|       Cloud AI              |     |       Edge AI               |
+-----------------------------+     +-----------------------------+
|                             |     |                             |
|  Device -> Network ->       |     |  Inference completed        |
|  Inference on cloud server  |     |  entirely on device         |
|  -> Return results to device|     |                             |
|                             |     |  +--------+                |
|  +------+    +--------+    |     |  | Camera |                |
|  |Device| -> |Cloud   | -> |     |  +---+----+                |
|  +------+    | GPU/TPU|   |     |      |                     |
|       ^      +--------+   |     |  +---v--------+            |
|       |          |         |     |  | NPU/GPU    |            |
|       +----------+         |     |  | Local infer|            |
|   Latency: 50-500ms       |     |  +---+---------+            |
|   Internet required        |     |      |                     |
|                             |     |  +---v----+               |
+-----------------------------+     |  | Result |  Latency: 1-10ms |
                                    |  +--------+  Offline OK  |
                                    +-----------------------------+
```

### Advantages and Challenges of Edge AI

```
+-----------------------------------------------------------+
|             Advantages of Edge AI                          |
+-----------------------------------------------------------+
|  Low latency   | Real-time inference in 1-10ms            |
|  Privacy       | Data never leaves the device             |
|  Bandwidth     | No need to transfer large data to cloud  |
|  Offline       | No internet connection required          |
|  Cost          | No cloud API charges                     |
+-----------------------------------------------------------+
|             Challenges of Edge AI                          |
+-----------------------------------------------------------+
|  Compute limits | Limited processing power and memory     |
|  Model limits   | Large models cannot run                 |
|  Power limits   | Power consumption on battery devices    |
|  Updates        | Complex model update distribution       |
+-----------------------------------------------------------+
```

### Edge AI Architecture Patterns

```
+-----------------------------------------------------------+
|  Edge AI Deployment Patterns                               |
+-----------------------------------------------------------+
|                                                           |
|  Pattern 1: Fully Edge                                    |
|  [Device] -> [NPU Inference] -> [Result] -> [Action]     |
|  Use cases: Security cameras, autonomous driving          |
|                                                           |
|  Pattern 2: Edge + Cloud Collaboration                    |
|  [Device] -> [Edge Preprocessing] -> [Cloud Inference]    |
|  Use cases: Voice assistants (wake word on edge)          |
|                                                           |
|  Pattern 3: Federated Learning                            |
|  [Device group] -> [Local training] -> [Only gradients    |
|                                         sent to cloud]    |
|  Use cases: Medical data, keyboard prediction             |
|                                                           |
|  Pattern 4: Edge Mesh                                     |
|  [Device group] -> [Local P2P comm] -> [Distributed infer]|
|  Use cases: Factory IoT, smart buildings                  |
+-----------------------------------------------------------+
```

---

## 2. Types of Edge AI Accelerators

### Accelerator Comparison Table

| Accelerator | Representative Products | Performance (TOPS) | Power Consumption | Main Use Cases |
|------------|------------------------|-------------------|------------------|---------------|
| NPU (Neural Processing Unit) | Apple Neural Engine, Qualcomm Hexagon | 11-45 TOPS | 1-5W | Smartphones, PCs |
| Edge TPU | Google Coral | 4 TOPS | 2W | IoT devices, cameras |
| Jetson (GPU) | NVIDIA Jetson Orin | 20-275 TOPS | 7-60W | Robots, autonomous driving |
| VPU (Vision Processing Unit) | Intel Movidius | 1-4 TOPS | 1-2W | Cameras, drones |
| FPGA | Xilinx/AMD Versal | Custom | 5-75W | Industrial, custom AI |
| ASIC | Google Edge TPU, Hailo | 4-26 TOPS | 1-5W | Specific applications |

### TOPS (Tera Operations Per Second) Guidelines

```
+-----------------------------------------------------------+
|  TOPS and Achievable Model Guidelines                      |
+-----------------------------------------------------------+
|                                                           |
|  1 TOPS   |█|            Image classification (MobileNet) |
|  4 TOPS   |███|          Object detection (SSD MobileNet) |
|  10 TOPS  |███████|      Face recognition + pose estimation|
|  20 TOPS  |█████████████| Semantic segmentation           |
|  40 TOPS  |████████████████████████|  Small LLM (1-3B)    |
|  100 TOPS |████████████████████████████████████|  7B LLM  |
|  275 TOPS |██████████████████████████████████████████████| |
|            Autonomous driving, multiple models running     |
+-----------------------------------------------------------+
```

### NPU Generational Performance Comparison

| NPU | Manufacturer | Generation | TOPS | Devices | Features |
|-----|-------------|-----------|------|---------|----------|
| Neural Engine (16-core) | Apple | A16/M2 | 15.8 TOPS | iPhone 14 Pro, MacBook Air | Low power, Core ML optimized |
| Neural Engine (16-core) | Apple | A17 Pro/M3 | 35 TOPS | iPhone 15 Pro, MacBook Pro | AV1 decode support |
| Neural Engine (16-core) | Apple | M4 | 38 TOPS | iPad Pro 2024 | Hardware ray tracing |
| Hexagon DSP | Qualcomm | Gen 3 | 45 TOPS | Snapdragon 8 Gen 3 | INT4 support, Micro NPU |
| NPU | Intel | Meteor Lake | 10 TOPS | Core Ultra | Windows AI PC |
| NPU | AMD | Ryzen AI | 16 TOPS | Ryzen 7040 | XDNA architecture |
| NPU | Qualcomm | X Elite | 45 TOPS | Snapdragon X Elite | Copilot+ PC |

---

## 3. NVIDIA Jetson

### Jetson Product Lineup

| Model | GPU | CPU | Memory | AI Performance | Power | Use Cases |
|-------|-----|-----|--------|---------------|-------|-----------|
| Jetson Orin Nano | 1024 CUDA cores | 6-core A78AE | 4-8GB | 20-40 TOPS | 7-15W | Entry-level, lightweight AI |
| Jetson Orin NX | 1024 CUDA cores | 8-core A78AE | 8-16GB | 70-100 TOPS | 10-25W | Robots, drones |
| Jetson AGX Orin | 2048 CUDA cores | 12-core A78AE | 32-64GB | 200-275 TOPS | 15-60W | Autonomous driving, industrial |

### Setting Up the Jetson Development Environment

```bash
# Installing JetPack SDK (recommended)
# JetPack 6.x is for Jetson Orin series

# 1. Install NVIDIA SDK Manager on host machine
# https://developer.nvidia.com/sdk-manager

# 2. Connect Jetson device in recovery mode
# Enter recovery mode via button operation

# 3. Flash with SDK Manager
# JetPack 6.0 = Ubuntu 22.04 + CUDA 12.2 + cuDNN + TensorRT

# 4. Post-setup verification
jetson_release  # Check JetPack version
nvidia-smi      # Check GPU status (note: jtop provides more detail)

# Install jtop (Jetson monitoring tool)
sudo pip3 install jetson-stats
sudo systemctl restart jtop.service
jtop  # Real-time display of GPU/CPU/memory/temperature

# Verify Docker + NVIDIA Container Runtime
sudo docker run --runtime nvidia --rm nvcr.io/nvidia/l4t-base:r36.2.0 \
    nvidia-smi
```

### Code Example 1: Inference on Jetson (TensorRT)

```python
# High-speed inference using TensorRT on Jetson
import tensorrt as trt
import pycuda.driver as cuda
import pycuda.autoinit
import numpy as np

def load_engine(engine_path):
    """Load TensorRT engine"""
    logger = trt.Logger(trt.Logger.WARNING)
    with open(engine_path, "rb") as f, \
         trt.Runtime(logger) as runtime:
        return runtime.deserialize_cuda_engine(f.read())

def infer(engine, input_data):
    """Execute inference"""
    context = engine.create_execution_context()

    # Allocate input/output buffers
    h_input = np.ascontiguousarray(input_data)
    h_output = np.empty(output_shape, dtype=np.float32)

    d_input = cuda.mem_alloc(h_input.nbytes)
    d_output = cuda.mem_alloc(h_output.nbytes)

    # Host -> Device transfer
    cuda.memcpy_htod(d_input, h_input)

    # Execute inference
    context.execute_v2([int(d_input), int(d_output)])

    # Device -> Host transfer
    cuda.memcpy_dtoh(h_output, d_output)

    return h_output

# ONNX -> TensorRT conversion command
# trtexec --onnx=model.onnx --saveEngine=model.trt --fp16
```

### Code Example 2: Real-Time Object Detection on Jetson

```python
import jetson_inference
import jetson_utils

# Load model (automatically optimized for TensorRT)
net = jetson_inference.detectNet("ssd-mobilenet-v2", threshold=0.5)

# Camera input
camera = jetson_utils.videoSource("csi://0")  # CSI camera
display = jetson_utils.videoOutput("display://0")

while display.IsStreaming():
    img = camera.Capture()

    # Object detection (inference on GPU)
    detections = net.Detect(img)

    for det in detections:
        print(f"Detected: {net.GetClassDesc(det.ClassID)} "
              f"Confidence: {det.Confidence:.2f} "
              f"Position: ({det.Left:.0f},{det.Top:.0f})-({det.Right:.0f},{det.Bottom:.0f})")

    display.Render(img)
    display.SetStatus(f"FPS: {net.GetNetworkFPS():.0f}")
```

### Code Example 3: Running YOLOv8 on Jetson

```python
from ultralytics import YOLO
import cv2

# Load YOLOv8 model
model = YOLO("yolov8n.pt")

# Export to TensorRT (run on Jetson)
model.export(format="engine", half=True, device=0)

# Inference with TensorRT engine
model_trt = YOLO("yolov8n.engine")

# Real-time inference from camera
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Execute inference
    results = model_trt(frame, stream=True, verbose=False)

    for result in results:
        annotated = result.plot()
        cv2.imshow("YOLOv8 on Jetson", annotated)

        # Detection result details
        for box in result.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            label = result.names[cls]
            print(f"{label}: {conf:.2f}")

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

### Code Example 4: Multi-Stream Inference on Jetson

```python
import threading
from queue import Queue
import cv2
import numpy as np

class MultiStreamInference:
    """Simultaneous inference pipeline from multiple cameras"""

    def __init__(self, model_path, num_streams=4):
        self.model = load_tensorrt_engine(model_path)
        self.num_streams = num_streams
        self.result_queues = [Queue(maxsize=10) for _ in range(num_streams)]
        self.running = True

    def capture_and_infer(self, stream_id, source):
        """Capture and inference loop for each stream"""
        cap = cv2.VideoCapture(source)
        cuda_stream = cuda.Stream()  # Asynchronous CUDA Stream

        while self.running:
            ret, frame = cap.read()
            if not ret:
                continue

            # Preprocessing (resize, normalize)
            input_tensor = preprocess(frame, target_size=(640, 640))

            # Asynchronous inference (parallel execution via CUDA streams)
            output = self.model.infer_async(
                input_tensor,
                stream=cuda_stream
            )
            cuda_stream.synchronize()

            # Post-processing (NMS, bounding box drawing)
            detections = postprocess(output, conf_threshold=0.5)

            self.result_queues[stream_id].put({
                'stream_id': stream_id,
                'frame': frame,
                'detections': detections,
            })

        cap.release()

    def start(self, sources):
        """Start all streams"""
        threads = []
        for i, source in enumerate(sources):
            t = threading.Thread(
                target=self.capture_and_infer,
                args=(i, source)
            )
            t.daemon = True
            t.start()
            threads.append(t)
        return threads

# Usage: Simultaneous inference from 4 cameras
pipeline = MultiStreamInference("yolov8n.engine", num_streams=4)
sources = [
    "rtsp://192.168.1.101/stream",
    "rtsp://192.168.1.102/stream",
    "rtsp://192.168.1.103/stream",
    "rtsp://192.168.1.104/stream",
]
pipeline.start(sources)
```

---

## 4. Google Coral

### Code Example 5: Inference on Coral Edge TPU

```python
# Image classification using Google Coral Edge TPU
from pycoral.adapters import classify
from pycoral.adapters import common
from pycoral.utils.dataset import read_label_file
from pycoral.utils.edgetpu import make_interpreter
from PIL import Image

# Load model pre-compiled for Edge TPU
interpreter = make_interpreter("mobilenet_v2_1.0_224_quant_edgetpu.tflite")
interpreter.allocate_tensors()

# Load labels
labels = read_label_file("imagenet_labels.txt")

# Image preprocessing and inference
image = Image.open("cat.jpg").resize(
    common.input_size(interpreter), Image.LANCZOS
)
common.set_input(interpreter, image)

# Execute inference (high-speed processing on Edge TPU)
interpreter.invoke()

# Get results
classes = classify.get_classes(interpreter, top_k=5)
for c in classes:
    print(f"{labels.get(c.id, c.id)}: {c.score:.4f}")

# Measure inference time
import time
start = time.perf_counter()
for _ in range(100):
    interpreter.invoke()
elapsed = (time.perf_counter() - start) / 100
print(f"Inference time: {elapsed*1000:.1f} ms ({1/elapsed:.0f} FPS)")
```

### Model Conversion Flow for Edge TPU

```
+-------------------+     +--------------------+     +-------------------+
|  Trained Model    | --> | TFLite Conversion  | --> | INT8 Quantization |
|  (PyTorch/TF)     |     | (float32 -> float32)|     | (float32 -> int8) |
+-------------------+     +--------------------+     +-------------------+
                                                            |
                                                            v
+-------------------+     +--------------------+     +-------------------+
| Inference on      | <-- | Edge TPU Compiler  | <-- | Quantized         |
| Edge TPU          |     | edgetpu_compiler   |     | TFLite Model      |
| 4 TOPS / 2W       |     |                    |     |                   |
+-------------------+     +--------------------+     +-------------------+
```

### Coral Edge TPU Setup Procedure

```bash
# For Coral USB Accelerator

# 1. Install Edge TPU runtime
echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" | \
    sudo tee /etc/apt/sources.list.d/coral-edgetpu.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
    sudo apt-key add -
sudo apt-get update
sudo apt-get install libedgetpu1-std  # Standard clock
# sudo apt-get install libedgetpu1-max  # Maximum clock (beware of heat)

# 2. Install PyCoral
pip3 install pycoral

# 3. Download model
wget https://github.com/google-coral/test_data/raw/master/\
mobilenet_v2_1.0_224_quant_edgetpu.tflite

# 4. Install Edge TPU Compiler
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | \
    sudo apt-key add -
echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" | \
    sudo tee /etc/apt/sources.list.d/coral-edgetpu.list
sudo apt-get update
sudo apt-get install edgetpu-compiler

# 5. Compile custom model
edgetpu_compiler my_model_quant.tflite
# -> my_model_quant_edgetpu.tflite is generated
```

### Code Example 6: Object Detection Pipeline on Coral

```python
from pycoral.adapters import detect
from pycoral.adapters import common
from pycoral.utils.dataset import read_label_file
from pycoral.utils.edgetpu import make_interpreter
from PIL import Image, ImageDraw
import time

class CoralObjectDetector:
    """Object detection using Coral Edge TPU"""

    def __init__(self, model_path, labels_path, threshold=0.5):
        self.interpreter = make_interpreter(model_path)
        self.interpreter.allocate_tensors()
        self.labels = read_label_file(labels_path)
        self.threshold = threshold
        self.input_size = common.input_size(self.interpreter)

    def detect(self, image):
        """Detect objects in an image"""
        # Resize
        resized = image.resize(self.input_size, Image.LANCZOS)
        common.set_input(self.interpreter, resized)

        # Inference
        start = time.perf_counter()
        self.interpreter.invoke()
        inference_time = time.perf_counter() - start

        # Get results
        objs = detect.get_objects(
            self.interpreter,
            score_threshold=self.threshold
        )

        results = []
        for obj in objs:
            bbox = obj.bbox
            # Scale to original image size
            scale_x = image.width / self.input_size[0]
            scale_y = image.height / self.input_size[1]

            results.append({
                'label': self.labels.get(obj.id, str(obj.id)),
                'score': float(obj.score),
                'bbox': (
                    int(bbox.xmin * scale_x),
                    int(bbox.ymin * scale_y),
                    int(bbox.xmax * scale_x),
                    int(bbox.ymax * scale_y),
                ),
            })

        return results, inference_time

    def draw_results(self, image, results):
        """Draw detection results on image"""
        draw = ImageDraw.Draw(image)
        for r in results:
            bbox = r['bbox']
            draw.rectangle(bbox, outline='red', width=2)
            draw.text(
                (bbox[0], bbox[1] - 15),
                f"{r['label']}: {r['score']:.2f}",
                fill='red'
            )
        return image

# Usage
detector = CoralObjectDetector(
    "ssd_mobilenet_v2_coco_quant_postprocess_edgetpu.tflite",
    "coco_labels.txt",
    threshold=0.5
)

image = Image.open("street.jpg")
results, time_ms = detector.detect(image)
print(f"Inference time: {time_ms*1000:.1f}ms, Detections: {len(results)}")
for r in results:
    print(f"  {r['label']}: {r['score']:.2f} @ {r['bbox']}")
```

---

## 5. Apple Neural Engine / NPU-Equipped PCs

### Code Example 7: On-Device Inference with Core ML

```python
# Model conversion with Python (coremltools)
import coremltools as ct
import torch

# Convert PyTorch model to Core ML
model = torchvision.models.mobilenet_v2(pretrained=True)
model.eval()

example_input = torch.rand(1, 3, 224, 224)
traced_model = torch.jit.trace(model, example_input)

mlmodel = ct.convert(
    traced_model,
    inputs=[ct.ImageType(shape=(1, 3, 224, 224), scale=1/255.0)],
    compute_units=ct.ComputeUnit.ALL,  # CPU + GPU + Neural Engine
)
mlmodel.save("MobileNetV2.mlpackage")
```

```swift
// Swift inference (automatically leverages Neural Engine)
import CoreML
import Vision

let model = try! MobileNetV2(configuration: .init())

let request = VNCoreMLRequest(model: try! VNCoreMLModel(for: model.model)) {
    request, error in
    guard let results = request.results as? [VNClassificationObservation] else { return }
    let top = results.prefix(3)
    for result in top {
        print("\(result.identifier): \(result.confidence * 100)%")
    }
}

// Inference on Neural Engine: ~1ms / image
```

### Code Example 8: On-Device LLM Inference with Core ML

```swift
import CoreML

class OnDeviceLLM {
    let model: MLModel
    let tokenizer: BPETokenizer

    init(modelPath: String, tokenizerPath: String) throws {
        let config = MLModelConfiguration()
        config.computeUnits = .all  // CPU + GPU + Neural Engine

        self.model = try MLModel(contentsOf: URL(fileURLWithPath: modelPath),
                                  configuration: config)
        self.tokenizer = try BPETokenizer(mergesFile: tokenizerPath)
    }

    func generate(prompt: String, maxTokens: Int = 100) throws -> String {
        var tokens = tokenizer.encode(prompt)
        var generatedText = ""

        for _ in 0..<maxTokens {
            // Prepare input
            let inputArray = try MLMultiArray(shape: [1, NSNumber(value: tokens.count)],
                                             dataType: .int32)
            for (i, token) in tokens.enumerated() {
                inputArray[i] = NSNumber(value: token)
            }

            // Inference (high-speed execution on Neural Engine)
            let input = try MLDictionaryFeatureProvider(
                dictionary: ["input_ids": MLFeatureValue(multiArray: inputArray)]
            )
            let output = try model.prediction(from: input)

            // Get next token
            guard let logits = output.featureValue(for: "logits")?.multiArrayValue else {
                break
            }
            let nextToken = argmax(logits)

            if nextToken == tokenizer.eosToken {
                break
            }

            tokens.append(nextToken)
            generatedText += tokenizer.decode([nextToken])
        }

        return generatedText
    }

    private func argmax(_ array: MLMultiArray) -> Int {
        var maxVal: Float = -Float.infinity
        var maxIdx = 0
        let lastDim = array.shape.last!.intValue
        let offset = (array.count - lastDim)

        for i in 0..<lastDim {
            let val = array[offset + i].floatValue
            if val > maxVal {
                maxVal = val
                maxIdx = i
            }
        }
        return maxIdx
    }
}
```

### Code Example 9: Qualcomm AI Engine (Snapdragon)

```python
# Inference with Qualcomm AI Engine Direct (QNN)
# Leveraging the Hexagon NPU on smartphones

# Model conversion: ONNX -> QNN
# qnn-onnx-converter --input_network model.onnx \
#     --output_path model.cpp \
#     --input_dim "input" 1,3,224,224

# Quantization (for Hexagon NPU)
# qnn-net-run --model model.so \
#     --backend libQnnHtp.so \
#     --input_list input_list.txt

# Usage in Android apps (Java/Kotlin)
# Uses Qualcomm Neural Processing SDK
```

### Running Models on Windows AI PCs (NPU-Enabled)

```python
# Leveraging NPU with ONNX Runtime (Windows AI PC)
import onnxruntime as ort
import numpy as np

class WindowsNPUInference:
    """Inference using the NPU on Windows AI PCs"""

    def __init__(self, model_path):
        # Session configuration using NPU (DML)
        providers = [
            ('DmlExecutionProvider', {
                'device_id': 0,
                'enable_dynamic_graph_fusion': True,
            }),
            'CPUExecutionProvider',  # Fallback
        ]

        self.session = ort.InferenceSession(
            model_path,
            providers=providers
        )

        # Get input/output information
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def predict(self, input_data):
        """Execute inference on NPU"""
        result = self.session.run(
            [self.output_name],
            {self.input_name: input_data}
        )
        return result[0]

    @staticmethod
    def check_npu_availability():
        """Check NPU availability"""
        providers = ort.get_available_providers()
        print(f"Available providers: {providers}")
        if 'DmlExecutionProvider' in providers:
            print("DirectML (NPU/GPU) is available")
            return True
        else:
            print("DirectML unavailable -- falling back to CPU")
            return False

# Usage
WindowsNPUInference.check_npu_availability()
inferencer = WindowsNPUInference("model.onnx")
result = inferencer.predict(input_array)
```

---

## 6. Model Optimization Techniques

### Optimization Method Comparison Table

| Method | Size Reduction | Speed Improvement | Accuracy Impact | Implementation Difficulty |
|--------|---------------|------------------|----------------|--------------------------|
| INT8 Quantization (PTQ) | 75% | 2-4x | 1-3% decrease | Low |
| INT8 Quantization (QAT) | 75% | 2-4x | 0.5-1% decrease | Medium |
| Pruning (Structured) | 50-90% | 1.5-3x | 1-5% decrease | Medium |
| Knowledge Distillation | 50-90% | 2-10x | 1-3% decrease | High |
| ONNX Runtime | - | 1.2-2x | None | Low |
| TensorRT | - | 2-5x | <=1% decrease | Medium |

### Code Example 10: Post-Training Quantization (PTQ)

```python
import torch
from torch.quantization import quantize_dynamic, quantize_static

# Dynamic quantization (quantized at inference time)
# Simplest method with minimal accuracy degradation
model_fp32 = load_model("resnet50.pth")
model_int8 = quantize_dynamic(
    model_fp32,
    {torch.nn.Linear, torch.nn.Conv2d},  # Layers to quantize
    dtype=torch.qint8
)

# Compare model sizes
import os
torch.save(model_fp32.state_dict(), "model_fp32.pth")
torch.save(model_int8.state_dict(), "model_int8.pth")
size_fp32 = os.path.getsize("model_fp32.pth") / 1e6
size_int8 = os.path.getsize("model_int8.pth") / 1e6
print(f"FP32: {size_fp32:.1f}MB -> INT8: {size_int8:.1f}MB ({size_int8/size_fp32*100:.0f}%)")
```

### Code Example 11: Knowledge Distillation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class DistillationLoss(nn.Module):
    """Loss function for knowledge distillation"""

    def __init__(self, temperature=4.0, alpha=0.5):
        super().__init__()
        self.temperature = temperature
        self.alpha = alpha

    def forward(self, student_logits, teacher_logits, labels):
        # Soft target loss (distilling teacher's knowledge)
        soft_loss = F.kl_div(
            F.log_softmax(student_logits / self.temperature, dim=1),
            F.softmax(teacher_logits / self.temperature, dim=1),
            reduction='batchmean'
        ) * (self.temperature ** 2)

        # Hard target loss (loss against ground truth labels)
        hard_loss = F.cross_entropy(student_logits, labels)

        return self.alpha * soft_loss + (1 - self.alpha) * hard_loss

def train_with_distillation(teacher, student, train_loader, epochs=50):
    """Distill teacher model's knowledge into student model"""
    teacher.eval()  # Teacher is fixed in inference mode
    student.train()

    optimizer = torch.optim.Adam(student.parameters(), lr=1e-3)
    criterion = DistillationLoss(temperature=4.0, alpha=0.5)

    for epoch in range(epochs):
        total_loss = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)

            # Teacher inference (no gradient computation needed)
            with torch.no_grad():
                teacher_logits = teacher(images)

            # Student inference
            student_logits = student(images)

            # Distillation loss
            loss = criterion(student_logits, teacher_logits, labels)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        print(f"Epoch {epoch}: Loss = {total_loss / len(train_loader):.4f}")

# Usage
# Teacher: ResNet-50 (25.6M params, 97.8MB)
# Student: MobileNet-V3 (5.4M params, 21.8MB)
teacher = torchvision.models.resnet50(pretrained=True)
student = torchvision.models.mobilenet_v3_small(pretrained=False)
train_with_distillation(teacher, student, train_loader)
```

### Code Example 12: Structured Pruning

```python
import torch
import torch.nn.utils.prune as prune

def structured_pruning(model, amount=0.3):
    """Structured pruning (removing channels)"""

    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Conv2d):
            # Prune channels based on L1 norm
            prune.ln_structured(
                module,
                name='weight',
                amount=amount,
                n=1,  # L1 norm
                dim=0  # Output channel dimension
            )
            # Make pruning permanent
            prune.remove(module, 'weight')

    return model

def evaluate_pruned_model(model, test_loader):
    """Evaluate pruned model"""
    model.eval()
    total_params = sum(p.numel() for p in model.parameters())
    zero_params = sum((p == 0).sum().item() for p in model.parameters())
    sparsity = zero_params / total_params

    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in test_loader:
            outputs = model(images.to(device))
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels.to(device)).sum().item()

    accuracy = correct / total
    print(f"Sparsity: {sparsity*100:.1f}%")
    print(f"Accuracy: {accuracy*100:.1f}%")
    print(f"Parameters: {total_params:,} (zeros: {zero_params:,})")

    return accuracy, sparsity
```

### Cross-Platform Conversion with ONNX

```python
import torch
import onnx
import onnxruntime as ort

def export_to_onnx(model, input_shape, output_path):
    """Export PyTorch model to ONNX format"""
    model.eval()
    dummy_input = torch.randn(*input_shape)

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'output': {0: 'batch_size'},
        }
    )

    # Validate the model
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"ONNX export complete: {output_path}")

def optimize_onnx(input_path, output_path):
    """Optimize ONNX model"""
    import onnxoptimizer

    model = onnx.load(input_path)
    optimized = onnxoptimizer.optimize(model, [
        'eliminate_deadend',
        'eliminate_identity',
        'eliminate_nop_dropout',
        'fuse_bn_into_conv',
        'fuse_consecutive_transposes',
    ])
    onnx.save(optimized, output_path)
    print(f"Optimization complete: {output_path}")

def benchmark_onnx(model_path, input_shape, num_runs=100):
    """Benchmark inference speed with ONNX Runtime"""
    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name

    dummy = np.random.randn(*input_shape).astype(np.float32)

    # Warmup
    for _ in range(10):
        session.run(None, {input_name: dummy})

    # Benchmark
    import time
    start = time.perf_counter()
    for _ in range(num_runs):
        session.run(None, {input_name: dummy})
    elapsed = (time.perf_counter() - start) / num_runs

    print(f"Inference time: {elapsed*1000:.2f}ms ({1/elapsed:.0f} FPS)")
```

---

## 7. Practical Edge AI Use Cases

### Recommended Configurations by Use Case

| Use Case | Recommended Device | Model | Performance Estimate |
|----------|-------------------|-------|---------------------|
| Smart camera (person detection) | Coral USB + RPi | SSD MobileNet (INT8) | 30 FPS, 2W |
| Manufacturing line inspection | Jetson Orin NX | YOLOv8m (FP16) | 60 FPS, 25W |
| Autonomous driving L2 | Jetson AGX Orin | Multiple models simultaneously | 30 FPS, 60W |
| Smartphone photo editing | Apple Neural Engine | Core ML optimized model | Real-time, 1W |
| Voice commands | Coral + Microphone | Wake word detection (INT8) | <10ms, 0.5W |
| Drone tracking | Jetson Orin Nano | YOLOv8n (FP16) | 60 FPS, 15W |

### Code Example 13: Anomaly Detection on Edge AI

```python
import numpy as np
from sklearn.ensemble import IsolationForest
import onnxruntime as ort

class EdgeAnomalyDetector:
    """Manufacturing line anomaly detection on edge devices"""

    def __init__(self, model_path, threshold=-0.5):
        self.session = ort.InferenceSession(model_path)
        self.threshold = threshold
        self.feature_buffer = []
        self.alert_callback = None

    def extract_features(self, image):
        """Extract features from image"""
        input_name = self.session.get_inputs()[0].name
        preprocessed = self.preprocess(image)
        features = self.session.run(None, {input_name: preprocessed})[0]
        return features.flatten()

    def detect(self, image):
        """Anomaly detection"""
        features = self.extract_features(image)

        # Statistical anomaly detection (lightweight on edge)
        self.feature_buffer.append(features)
        if len(self.feature_buffer) < 100:
            return {'status': 'collecting', 'samples': len(self.feature_buffer)}

        # Calculate anomaly score with Isolation Forest
        if len(self.feature_buffer) == 100:
            self.model = IsolationForest(contamination=0.05)
            self.model.fit(np.array(self.feature_buffer))

        score = self.model.decision_function([features])[0]
        is_anomaly = score < self.threshold

        if is_anomaly and self.alert_callback:
            self.alert_callback(image, score)

        return {
            'status': 'anomaly' if is_anomaly else 'normal',
            'score': float(score),
            'threshold': self.threshold,
        }

    def preprocess(self, image):
        """Image preprocessing"""
        resized = cv2.resize(image, (224, 224))
        normalized = resized.astype(np.float32) / 255.0
        return np.expand_dims(normalized.transpose(2, 0, 1), 0)
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Model Selection That Ignores Edge Device Specs

```
BAD: Trying to deploy a 7B parameter LLM on Jetson Nano (4GB)
     -> Out of memory, unable to run

GOOD: Select models that match device specs
      Jetson Nano 4GB  -> MobileNet, EfficientNet-Lite (image)
                        -> DistilBERT, TinyLlama 1.1B (text)
      Jetson Orin 32GB -> YOLOv8, SAM (image)
                        -> Llama 3 8B 4-bit quantized (text)
```

### Anti-Pattern 2: Deploying to Edge Without Quantization

```
BAD: Placing FP32 model directly on edge device
     -> High memory consumption, slow inference

GOOD: Always quantize for edge deployment
      1. Post-Training Quantization (PTQ) -- No retraining required
      2. Quantization-Aware Training (QAT) -- When accuracy is critical
      3. Match the target device's supported precision
         Edge TPU -> INT8 required
         Jetson   -> FP16 or INT8
         Apple ANE -> FP16
```

### Anti-Pattern 3: Continuous Operation Without Thermal Management

```
BAD: Running Jetson 24/7 without cooling
     -> 50% performance drop from thermal throttling
     -> Worst case: device damage

GOOD: Proper thermal management
      1. Attach heatsink + fan (mandatory)
      2. Monitor operating temperature (use jtop)
      3. Power mode settings
         - Maximum performance: 60W (only with adequate cooling)
         - Balanced: 30W (normal operation)
         - Power saving: 15W (battery/compact enclosure)
      4. Enclosure ventilation design
      5. Apply derating when ambient temperature exceeds 40C
```

### Anti-Pattern 4: Deploying Without OTA Update Mechanism

```
BAD: Burning model onto device and installing without update capability
     -> Bug fixes and model improvements require on-site work

GOOD: Build an OTA (Over-The-Air) update mechanism
      1. A/B partition scheme for model updates
      2. Rollback mechanism for failed updates
      3. Model version management and metadata
      4. Differential updates for bandwidth-limited environments
      5. Pre/post-update accuracy validation tests
```

---

## 9. Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| OOM (Out of Memory) | Model too large | Quantization, model lightweighting, batch size=1 |
| Slow inference | Still FP32, no optimization | Convert to TensorRT/ONNX Runtime, use FP16 |
| Thermal throttling | Insufficient cooling | Add heatsink/fan, change power mode |
| Some layers run on CPU with Edge TPU | Unsupported operations | Modify model structure, use only supported ops |
| Low NPU utilization | Framework misconfiguration | Check compute_units settings, profiling |
| Model accuracy degradation | Accuracy loss from quantization | Apply QAT, improve calibration data |


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
        """Get processing results"""
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
        assert False, "Should have raised an exception"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

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
        """Add item (with size limit)"""
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
        """Remove by key"""
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
    """Efficient search using hash map"""
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
- Be conscious of algorithm time complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to Prioritize | When Acceptable to Compromise |
|-----------|-------------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expecting growth | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
+---------------------------------------------------+
|          Architecture Selection Flow               |
+---------------------------------------------------+
|                                                   |
|  (1) Team size?                                   |
|    +-- Small (1-5) -> Monolith                    |
|    +-- Large (10+) -> Go to (2)                   |
|                                                   |
|  (2) Deploy frequency?                            |
|    +-- Weekly or less -> Monolith + module split   |
|    +-- Daily/multiple -> Go to (3)                |
|                                                   |
|  (3) Team independence?                           |
|    +-- High -> Microservices                      |
|    +-- Moderate -> Modular monolith               |
|                                                   |
+---------------------------------------------------+
```

### Trade-Off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A short-term fast approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables best-fit solutions but increases operational costs

**3. Level of Abstraction**
- High abstraction offers high reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and challenges"""
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

## FAQ

### Q1. Is AI inference practical on Raspberry Pi?

The Raspberry Pi 5 can run MobileNet-level models at 30-50ms (20-30 FPS) with CPU inference. Adding a Coral USB Accelerator speeds this up to 5-10ms on the Edge TPU. It is practical enough for use cases that don't require real-time performance (periodic image classification, voice command recognition).

### Q2. Can LLMs run on edge devices?

As of 2025, the Jetson AGX Orin (64GB) can run Llama 3 8B 4-bit quantized at 10-20 tokens/sec. On smartphones, Phi-3 Mini (3.8B) and Gemma 2B are practical. Apple M4 Macs can even run Llama 3 70B 4-bit quantized.

### Q3. What device is best for getting started with edge AI development?

With a budget under 10,000 yen: Coral USB Accelerator + Raspberry Pi. Under 50,000 yen: Jetson Orin Nano. If you already own an Apple device, you can start with Core ML + Create ML at no additional cost.

### Q4. Should I use TensorRT or ONNX Runtime?

If targeting only NVIDIA GPUs (including Jetson), TensorRT is fastest. If you need cross-platform support (CPU, GPU, NPU), choose ONNX Runtime. The best approach is to try both and benchmark. Since TensorRT accepts ONNX format input, the typical flow is to export to ONNX first and then convert to TensorRT.

### Q5. Should I choose edge AI or cloud AI?

Decision criteria: 1) Latency requirements (under 10ms means edge only), 2) Privacy requirements (medical/financial data favors edge), 3) Internet connection stability (if unstable, choose edge), 4) Model complexity (70B+ parameters need cloud), 5) Cost structure (high-volume inference is cheaper on edge; sporadic use is cheaper on cloud). In practice, a hybrid architecture combining both is often the optimal solution.

---

## Summary

| Concept | Key Point |
|---------|-----------|
| Edge AI | Complete AI inference on device; low latency and privacy protection |
| NPU | Chip specialized for neural network processing |
| NVIDIA Jetson | High-performance edge GPU with TensorRT support |
| Google Coral | Edge TPU equipped, low-power INT8 inference |
| Apple Neural Engine | AI accelerator built into iPhones and Macs |
| Quantization | FP32 to INT8 for 4x memory reduction and speed improvement |
| TensorRT | NVIDIA's inference optimization engine |
| TOPS | AI computation performance metric (Tera Operations Per Second) |
| Knowledge Distillation | Transfer knowledge from large model to lightweight model |
| ONNX | Cross-platform model exchange format |

---

## Recommended Next Guides

- **01-computing/03-cloud-ai-hardware.md** — Cloud AI Hardware: TPU, Inferentia
- **01-computing/01-gpu-computing.md** — GPU: NVIDIA/AMD, CUDA
- **02-emerging/01-robotics.md** — Robotics: Boston Dynamics, Figure

---

## References

1. **NVIDIA Jetson Official Documentation** https://developer.nvidia.com/embedded-computing
2. **Google Coral Official** https://coral.ai/docs/
3. **Apple Core ML Official** https://developer.apple.com/documentation/coreml
4. **TensorFlow Lite for Microcontrollers** https://www.tensorflow.org/lite/microcontrollers
5. **ONNX Runtime** https://onnxruntime.ai/docs/
6. **TensorRT Developer Guide** https://docs.nvidia.com/deeplearning/tensorrt/developer-guide/
