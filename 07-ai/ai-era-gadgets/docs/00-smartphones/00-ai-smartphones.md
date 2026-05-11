# AI Smartphones — NPU-Equipped Chips and On-Device AI

> A systematic guide to NPU (Neural Processing Unit) mechanisms in smartphones, AI features on Google Pixel and iPhone, and the new user experiences enabled by on-device AI.

---

## What You Will Learn in This Chapter

1. **How NPUs (Neural Processing Units) Work** — The roles of CPU/GPU/NPU and the principles behind accelerated AI processing
2. **AI Features on Major Platforms** — Specific AI use cases on Google Pixel (Tensor) and iPhone (A/M series)
3. **On-Device AI Design Philosophy** — Technology that reduces cloud dependency while achieving both privacy and low latency


## Prerequisites

Before reading this guide, familiarity with the following will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. NPU Architecture Fundamentals

### 1.1 NPU Placement within an SoC

```
┌─────────────────────────────────────────────────┐
│              Smartphone SoC                       │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │  CPU     │  │  GPU     │  │  NPU / Neural   │  │
│  │(General) │  │(Parallel)│  │  Engine(AI-opt.) │  │
│  │ 4+4core │  │ Adreno/ │  │  INT8/FP16 opt.  │  │
│  │         │  │ Mali    │  │  ~45 TOPS        │  │
│  └─────────┘  └─────────┘  └─────────────────┘  │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │  ISP    │  │  DSP    │  │  Memory (LPDDR5) │  │
│  │(Camera) │  │(Signal) │  │  8-16 GB         │  │
│  └─────────┘  └─────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 1.2 NPU Performance Comparison

```
Processing Performance (TOPS: Trillion Operations Per Second)

Apple A18 Pro (Neural Engine)    ████████████████████████████████████ 35 TOPS
Snapdragon 8 Gen 3 (Hexagon)    █████████████████████████████████████████████ 45 TOPS
Google Tensor G4                 ████████████████████████████████ 32 TOPS
MediaTek Dimensity 9300          ██████████████████████████████████████ 38 TOPS
Samsung Exynos 2400              ██████████████████████████████████████████ 40 TOPS
```

### 1.3 Internal Data Flow of an NPU

The internal processing of an NPU differs significantly from traditional CPU/GPU. It is characterized by dedicated MAC (Multiply-Accumulate) arrays and an optimized memory hierarchy.

```
┌──────────────────────────────────────────────────────┐
│                  NPU Data Flow Details                  │
│                                                        │
│  Input Tensor (INT8/FP16)                              │
│      │                                                 │
│      ▼                                                 │
│  ┌──────────────────────┐                             │
│  │ Weight Buffer (SRAM)  │  Caches quantized weights   │
│  │ A few MB to tens of MB│                             │
│  └──────────┬───────────┘                             │
│             │                                          │
│      ┌──────▼──────┐                                  │
│      │ MAC Array    │  Matrix mult. (conv/FC layers)   │
│      │ 256×256      │  INT8×INT8 → INT32 accumulate   │
│      │ systolic     │  65,536 MAC ops per clock cycle  │
│      └──────┬──────┘                                  │
│             │                                          │
│      ┌──────▼──────┐                                  │
│      │ Activation   │  ReLU / GELU / SiLU             │
│      │ Unit         │  Fast hardware implementation    │
│      └──────┬──────┘                                  │
│             │                                          │
│      ┌──────▼──────┐                                  │
│      │ Pooling /    │  Max/Average Pooling             │
│      │ Normalize    │  BatchNorm / LayerNorm           │
│      └──────┬──────┘                                  │
│             │                                          │
│             ▼                                          │
│     Output Tensor → Next layer or final result         │
└──────────────────────────────────────────────────────┘
```

### 1.4 Power-Efficient Design of NPUs

The reason NPUs are particularly important in smartphones is their power efficiency.

```
Power Consumption Comparison (same task execution)

CPU (8 cores full load):  ████████████████████████████████████████ 8W
GPU (full utilization):   ██████████████████████████████████ 6W
NPU (AI inference only):  ████████ 1.5W
DSP (signal processing):  ██████ 1W

→ NPU achieves 5x+ power efficiency (TOPS/W) compared to CPU
→ A decisive difference for battery-powered smartphones
```

| Processing Unit | Strength | TOPS/W | Battery Impact |
|----------------|----------|--------|----------------|
| CPU | General-purpose computation, branching | 0.5-2 | High |
| GPU | Parallel floating-point operations | 2-5 | Moderate |
| NPU | INT8/FP16 matrix multiplication | 10-30 | Low |
| DSP | Signal processing, filters | 5-15 | Low |

---

## 2. Code Examples

### Code Example 1: Android — On-Device Image Labeling with ML Kit

```kotlin
// build.gradle
// implementation 'com.google.mlkit:image-labeling:17.0.8'

import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions

fun labelImage(bitmap: Bitmap) {
    val image = InputImage.fromBitmap(bitmap, 0)
    val options = ImageLabelerOptions.Builder()
        .setConfidenceThreshold(0.7f) // Only labels with 70%+ confidence
        .build()
    val labeler = ImageLabeling.getClient(options)

    labeler.process(image)
        .addOnSuccessListener { labels ->
            for (label in labels) {
                println("${label.text}: ${label.confidence}")
                // e.g.: "Cat: 0.95", "Animal: 0.92"
            }
        }
        .addOnFailureListener { e ->
            println("Error: ${e.message}")
        }
}
```

### Code Example 2: iOS — On-Device Inference with Core ML

```swift
import CoreML
import Vision

func classifyImage(_ image: CGImage) {
    // Load MobileNetV3 model
    guard let model = try? VNCoreMLModel(
        for: MobileNetV3(configuration: .init()).model
    ) else { return }

    let request = VNCoreMLRequest(model: model) { request, error in
        guard let results = request.results as? [VNClassificationObservation] else { return }

        // Display top 3 results
        for result in results.prefix(3) {
            print("\(result.identifier): \(result.confidence * 100)%")
        }
    }

    let handler = VNImageRequestHandler(cgImage: image)
    try? handler.perform([request])
}
```

### Code Example 3: TensorFlow Lite — Leveraging NPU Delegates

```python
import tensorflow as tf

# Model quantization (FP32 → INT8) for NPU optimization
converter = tf.lite.TFLiteConverter.from_saved_model("model_dir")
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.int8]  # Quantization for NPU

# Quantization calibration with representative dataset
def representative_dataset():
    for data in calibration_data:
        yield [data.astype("float32")]

converter.representative_dataset = representative_dataset
tflite_model = converter.convert()

# Save
with open("model_quantized.tflite", "wb") as f:
    f.write(tflite_model)

print(f"Model size: {len(tflite_model) / 1024 / 1024:.1f} MB")
```

### Code Example 4: NNAPI (Android Neural Networks API) Benchmark

```kotlin
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.nnapi.NnApiDelegate

fun benchmarkNPU(modelPath: String) {
    // NNAPI delegate (NPU preferred)
    val nnApiDelegate = NnApiDelegate(
        NnApiDelegate.Options().apply {
            setAllowFp16(true)             // Allow FP16 operations
            setExecutionPreference(         // Prefer NPU execution
                NnApiDelegate.Options.EXECUTION_PREFERENCE_SUSTAINED_SPEED
            )
        }
    )

    val options = Interpreter.Options().apply {
        addDelegate(nnApiDelegate)
        setNumThreads(4)
    }

    val interpreter = Interpreter(loadModelFile(modelPath), options)

    // Warm-up + measurement
    val input = FloatArray(224 * 224 * 3)
    val output = Array(1) { FloatArray(1000) }

    repeat(10) { interpreter.run(input, output) } // Warm-up

    val start = System.nanoTime()
    repeat(100) { interpreter.run(input, output) }
    val elapsed = (System.nanoTime() - start) / 1_000_000.0 / 100

    println("Average inference time: ${elapsed}ms")  // NPU: ~3ms, CPU: ~25ms
}
```

### Code Example 5: Pixel's Gemini Nano — On-Device Summarization

```kotlin
// Android AICore API (Pixel 8 Pro and later)
import com.google.android.gms.aicore.GenerativeModel
import com.google.android.gms.aicore.GenerateContentRequest

suspend fun summarizeOnDevice(text: String): String {
    val model = GenerativeModel("gemini-nano")

    val request = GenerateContentRequest.newBuilder()
        .addText("Summarize the following text in 3 lines:\n$text")
        .build()

    val response = model.generateContent(request)
    return response.text ?: "Failed to generate summary"
}

// Usage example
val article = "Long article text..."
val summary = summarizeOnDevice(article)
println(summary)
// → "1. AI smartphones are equipped with NPUs..."
// → "2. On-device processing protects privacy..."
// → "3. Low-latency responses without the cloud..."
```

### Code Example 6: On-Device Speech Recognition — Whisper on Mobile

```python
# Optimization pipeline for mobile Whisper model
import torch
import whisper
import coremltools as ct

def convert_whisper_for_mobile():
    """Convert Whisper tiny/base for mobile deployment"""
    # Whisper tiny model (39M parameters, ~150MB)
    model = whisper.load_model("tiny")
    model.eval()

    # Export encoder for Core ML
    # Input: Mel spectrogram (1, 80, 3000)
    dummy_input = torch.randn(1, 80, 3000)

    # Convert to TorchScript
    traced_encoder = torch.jit.trace(model.encoder, dummy_input)

    # Convert to Core ML (fast execution on Neural Engine)
    mlmodel = ct.convert(
        traced_encoder,
        inputs=[ct.TensorType(shape=(1, 80, 3000), name="mel_input")],
        compute_precision=ct.precision.FLOAT16,  # FP16 for speed
        compute_units=ct.ComputeUnit.ALL,  # CPU + GPU + Neural Engine
    )
    mlmodel.save("WhisperEncoder.mlpackage")
    print("Core ML model saved successfully")

    # Model size comparison
    # FP32 (original): ~150MB
    # FP16 (Neural Engine optimized): ~75MB
    # INT8 (maximum compression): ~40MB

convert_whisper_for_mobile()
```

### Code Example 7: Android — Custom TFLite Model NPU Deployment

```kotlin
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.nnapi.NnApiDelegate
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

class AIModelManager(private val context: Context) {
    private var interpreter: Interpreter? = null
    private var currentDelegate: String = "cpu"

    /**
     * Detect available accelerators and select the optimal delegate
     */
    fun loadModel(modelPath: String): Boolean {
        val modelBuffer = loadModelFile(modelPath)
        val options = Interpreter.Options()

        // Try NPU (NNAPI) first as highest priority
        try {
            val nnApiOptions = NnApiDelegate.Options().apply {
                setAllowFp16(true)
                setExecutionPreference(
                    NnApiDelegate.Options.EXECUTION_PREFERENCE_SUSTAINED_SPEED
                )
                setUseNnapiCpu(false) // Disable CPU fallback
            }
            val nnApiDelegate = NnApiDelegate(nnApiOptions)
            options.addDelegate(nnApiDelegate)
            interpreter = Interpreter(modelBuffer, options)
            currentDelegate = "npu"
            println("Running with NPU (NNAPI) delegate")
            return true
        } catch (e: Exception) {
            println("NPU unavailable: ${e.message}")
        }

        // Try GPU next
        try {
            val gpuDelegate = GpuDelegate()
            options.addDelegate(gpuDelegate)
            interpreter = Interpreter(modelBuffer, options)
            currentDelegate = "gpu"
            println("Running with GPU delegate")
            return true
        } catch (e: Exception) {
            println("GPU unavailable: ${e.message}")
        }

        // CPU fallback
        options.setNumThreads(4)
        interpreter = Interpreter(modelBuffer, options)
        currentDelegate = "cpu"
        println("Running with CPU fallback")
        return true
    }

    /**
     * Run inference and measure performance
     */
    fun runInference(input: FloatArray): Pair<FloatArray, Long> {
        val output = Array(1) { FloatArray(1000) }
        val startTime = System.nanoTime()
        interpreter?.run(arrayOf(input), output)
        val elapsed = (System.nanoTime() - startTime) / 1_000_000

        println("Inference complete: ${elapsed}ms (delegate: $currentDelegate)")
        return Pair(output[0], elapsed)
    }

    private fun loadModelFile(path: String): MappedByteBuffer {
        val assetFd = context.assets.openFd(path)
        val inputStream = FileInputStream(assetFd.fileDescriptor)
        val fileChannel = inputStream.channel
        return fileChannel.map(
            FileChannel.MapMode.READ_ONLY,
            assetFd.startOffset,
            assetFd.declaredLength
        )
    }
}
```

### Code Example 8: iOS — On-Device LLM Inference (MLX Swift)

```swift
import MLX
import MLXLLM
import Foundation

/// Local LLM inference on Apple Silicon (Neural Engine + GPU)
class OnDeviceLLMEngine {
    private var model: LLMModel?
    private var tokenizer: Tokenizer?

    func loadModel() async throws {
        // Phi-3 Mini (3.8B, 4-bit quantized ≈ 2.3GB)
        let configuration = ModelConfiguration(
            id: "mlx-community/Phi-3-mini-4k-instruct-4bit"
        )

        // Download & load model
        let (model, tokenizer) = try await LLM.load(configuration: configuration)
        self.model = model
        self.tokenizer = tokenizer

        print("Model loaded: Phi-3 Mini 4bit")
        print("Memory usage: \(MLX.GPU.activeMemory / 1_000_000)MB")
    }

    func generate(prompt: String, maxTokens: Int = 256) async -> String {
        guard let model = model, let tokenizer = tokenizer else {
            return "Model not loaded"
        }

        let input = tokenizer.encode(prompt)
        var output: [Int] = []
        var generationTime: Double = 0

        let startTime = CFAbsoluteTimeGetCurrent()

        // Generate tokens incrementally
        for token in try! model.generate(input: MLXArray(input), parameters: .init(
            temperature: 0.7,
            topP: 0.9,
            repetitionPenalty: 1.1
        )) {
            output.append(token)
            if output.count >= maxTokens { break }
        }

        generationTime = CFAbsoluteTimeGetCurrent() - startTime
        let tokensPerSecond = Double(output.count) / generationTime

        let result = tokenizer.decode(output)
        print("Generation speed: \(String(format: "%.1f", tokensPerSecond)) tokens/sec")
        print("Generated tokens: \(output.count)")

        return result
    }
}

// Usage example
let engine = OnDeviceLLMEngine()
try await engine.loadModel()
let response = await engine.generate(
    prompt: "Briefly explain what an NPU in an AI smartphone is."
)
print(response)
// iPhone 15 Pro: ~15 tokens/sec (Neural Engine + GPU)
```

---

## 3. On-Device AI vs Cloud AI

### Comparison Table 1: Differences in Processing Approaches

```
┌─────────────────────────────────────────────────────┐
│         AI Processing Data Flow Comparison             │
│                                                       │
│  [Cloud AI]                                           │
│  Device ──→ Network ──→ Cloud ──→ Network ──→ Device  │
│         (100-500ms)  (Inference) (100-500ms)          │
│                                                       │
│  [On-Device AI]                                       │
│  Device ──→ NPU ──→ Result                            │
│         (3-20ms)                                      │
│                                                       │
│  [Hybrid AI]                                          │
│  Device ──→ NPU (preprocessing/lightweight inference) │
│         └──→ Cloud (advanced inference) ──→ Device    │
└─────────────────────────────────────────────────────┘
```

| Criterion | On-Device AI | Cloud AI |
|-----------|-------------|----------|
| Latency | 3-20ms | 100ms to several seconds |
| Privacy | Data stays on the device | Sent to servers |
| Offline Operation | Possible | Not possible |
| Model Size | A few MB to a few GB (quantization required) | Unlimited (hundreds of GB possible) |
| Accuracy | Slightly lower (quantization loss) | High (FP32/BF16) |
| Cost | Device load (battery consumption) | Server operation costs |
| Updates | Requires OS/app updates | Instant server-side updates |

### Comparison Table 2: AI Performance of Major Chipsets

| Chipset | Manufacturer | NPU Performance (TOPS) | Supported Models | On-Device LLM |
|---------|-------------|----------------------|-----------------|----------------|
| A18 Pro | Apple | 35 | iPhone 16 Pro | Apple Intelligence |
| Snapdragon 8 Gen 3 | Qualcomm | 45 | Galaxy S24 etc. | Llama 2 7B supported |
| Tensor G4 | Google | 32 | Pixel 9 | Gemini Nano |
| Dimensity 9300 | MediaTek | 38 | Various flagships | Llama 2 supported |
| Exynos 2400 | Samsung | 40 | Galaxy S24 (some) | Galaxy AI |

### Comparison Table 3: Quantization Methods — Accuracy vs Size Trade-offs

| Quantization Method | Bit Width | Model Size (7B baseline) | Accuracy Loss | NPU Support | Recommended Use |
|--------------------|-----------|------------------------|--------------|-------------|-----------------|
| FP32 (unquantized) | 32bit | ~28GB | Baseline | Not supported | Training/research |
| FP16 | 16bit | ~14GB | Negligible | Partial | GPU inference |
| INT8 (PTQ) | 8bit | ~7GB | 1-3% | Full | NPU inference (recommended) |
| INT8 (QAT) | 8bit | ~7GB | 0.5-1% | Full | High-accuracy NPU inference |
| INT4 (GPTQ) | 4bit | ~3.5GB | 3-5% | Limited | Tight memory constraints |
| INT4 (AWQ) | 4bit | ~3.5GB | 2-4% | Limited | On-device LLM |
| Mixed quantization | 4-8bit | ~4-5GB | 1-3% | Partial | Balanced approach |

---

## 4. Practical Use Cases and Applications

### Use Case 1: Real-Time Translation

```
┌─────────────────────────────────────────────┐
│       On-Device Real-Time Translation        │
│                                               │
│  Camera Input → OCR (Text Recognition)       │
│      │                                        │
│      ▼                                        │
│  Language Detection → Translation Model (NMT) │
│      │                                        │
│      ▼                                        │
│  AR Display (overlaid on original text)       │
│                                               │
│  Processing time: ~50ms (fully on-device)    │
│  Supported: Google Translate, Apple Translate │
│  NPU usage: OCR + NMT model inference        │
└─────────────────────────────────────────────┘
```

### Use Case 2: Evolution of Personal AI Assistants

```
┌─────────────────────────────────────────────────┐
│   2024-2025 On-Device AI Assistant Architecture   │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Speech    │ │ Text     │ │ Multimodal       │ │
│  │ Recog.    │ │ Input    │ │ Camera Input     │ │
│  │ Whisper   │ │         │ │ (ViT/CLIP)      │ │
│  │ (NPU run) │ │         │ │                  │ │
│  └────┬─────┘ └────┬────┘ └───────┬──────────┘ │
│       │            │              │              │
│       └────────────┼──────────────┘              │
│                    │                             │
│            ┌───────▼──────┐                      │
│            │ On-Device LLM │                     │
│            │ Gemini Nano   │                     │
│            │ / Phi Silica  │                     │
│            └───────┬──────┘                      │
│                    │                             │
│       ┌────────────┼────────────┐                │
│       │            │            │                │
│  ┌────▼────┐ ┌─────▼────┐ ┌────▼──────┐        │
│  │ App     │ │ System   │ │ Cloud     │        │
│  │ Actions │ │ Settings │ │ Offload   │        │
│  │ (Intent)│ │ Changes  │ │ (Large LLM)│       │
│  └─────────┘ └──────────┘ └───────────┘        │
└─────────────────────────────────────────────────┘
```

### Use Case 3: Health Monitoring AI

| Feature | Sensors Used | AI Model | NPU Usage | Accuracy |
|---------|-------------|----------|-----------|----------|
| Heart Rate Detection | Camera (rPPG) | CNN | NPU inference | ±3 BPM |
| Sleep Analysis | Accelerometer + Mic | LSTM | Background NPU | 70-80% |
| Fall Detection | Accelerometer + Gyro | MLP | Always-on NPU | 95%+ |
| Respiratory Rate | Camera / ToF | CNN | NPU inference | ±2 breaths/min |
| Stress Estimation | HRV + Accelerometer | XGBoost | CPU + NPU | Moderate |

---

## 5. Performance Optimization Tips

### Tip 1: Model Selection Guidelines

```
┌─────────────────────────────────────────────────┐
│      Mobile AI Model Selection Flowchart          │
│                                                   │
│  What type of task?                               │
│      │                                            │
│      ├── Image Classification → MobileNetV3 / EfficientNet-Lite
│      │              (2-5MB, ~3ms on NPU)          │
│      │                                            │
│      ├── Object Detection → SSD-MobileNet / YOLOv8-nano
│      │              (5-10MB, ~10ms on NPU)        │
│      │                                            │
│      ├── Text Classification → DistilBERT / MobileBERT
│      │                  (60-100MB, ~15ms on NPU)  │
│      │                                            │
│      ├── Speech Recognition → Whisper tiny/base   │
│      │              (40-140MB, ~500ms on NPU)     │
│      │                                            │
│      └── Text Generation → Gemini Nano / Phi-3 Mini
│                         (1-4GB, ~30-60ms/token)   │
└─────────────────────────────────────────────────┘
```

### Tip 2: Battery Consumption Optimization

```python
# Android: Battery optimization patterns for AI processing

class BatteryAwareAIManager:
    """
    Adjusts AI processing level based on battery remaining
    """
    def __init__(self):
        self.ai_level = "full"  # full / balanced / minimal

    def adjust_ai_level(self, battery_percentage: int, is_charging: bool):
        """Dynamically adjust AI processing level based on battery remaining"""
        if is_charging:
            self.ai_level = "full"
        elif battery_percentage > 50:
            self.ai_level = "full"
            # Run all AI models on NPU
            # Real-time camera AI enabled
        elif battery_percentage > 20:
            self.ai_level = "balanced"
            # Halve background AI frequency
            # Camera AI only on user interaction
            # Reduce inference batch size
        else:
            self.ai_level = "minimal"
            # Stop background AI
            # Keep only essential AI (fall detection, etc.)
            # Switch to lighter models

        return self.ai_level

    def get_model_config(self, task: str) -> dict:
        """Return model configuration based on current AI level"""
        configs = {
            "image_classification": {
                "full":     {"model": "efficientnet_b4", "resolution": 380},
                "balanced": {"model": "mobilenet_v3_large", "resolution": 224},
                "minimal":  {"model": "mobilenet_v3_small", "resolution": 224},
            },
            "text_generation": {
                "full":     {"model": "gemini-nano-3.25b", "max_tokens": 512},
                "balanced": {"model": "gemini-nano-1.8b", "max_tokens": 256},
                "minimal":  {"model": "none", "max_tokens": 0},  # Cloud fallback
            }
        }
        return configs.get(task, {}).get(self.ai_level, {})
```

### Tip 3: Memory Management Best Practices

| Strategy | Description | Memory Reduction | Impact on Inference Speed |
|----------|------------|-----------------|--------------------------|
| Weight Sharing | Share a common backbone across multiple tasks | 30-50% | None |
| Lazy Loading | Load models into memory only when needed | 40-70% | Initial delay only |
| Memory Mapping | Directly map model files via mmap | Page-level | Slight delay |
| Model Pruning | Remove unnecessary weights | 50-90% | 1-3% accuracy loss |
| Dynamic Quantization | Dynamically convert to INT8 at inference | 75% | 10-20% delay |
| Activation Checkpointing | Recompute intermediate results instead of storing | 60-80% | 20-30% delay |

---

## 6. Troubleshooting Guide

### Problem 1: Falls Back to CPU Instead of Running on NPU

```
Symptom: Inference speed is 10x slower than expected

Checklist:
□ Is the model INT8 quantized?
  → FP32 models are unsupported on most NPUs
□ Is the NNAPI / Core ML delegate configured correctly?
  → Without delegate configuration, it falls back to CPU
□ Does the model contain unsupported operations?
  → Even one unsupported op causes the entire model to fall back to CPU
□ Is the device's NPU driver up to date?
  → Old drivers may only support NNAPI v1.2 or below

Verification command (Android):
  adb shell dumpsys neuralnetworks
  → Displays available accelerators and supported operations
```

### Problem 2: Model Out of Memory

```
Symptom: Crashes with "Out of memory" error

Resolution steps:
1. Check model size
   → 6GB RAM device: ~4GB max for model + app
   → 8GB RAM: ~5GB, 12GB RAM: ~7GB

2. Increase quantization level
   → FP32 → FP16: Halves size
   → FP16 → INT8: Halves again
   → INT8 → INT4: Halves again (watch for accuracy loss)

3. Split model execution
   → Divide large models into chunks and run sequentially
   → Reduces peak memory usage

4. Use memory mapping
   → Android: Map files directly with MappedByteBuffer
   → iOS: MLModel automatic memory mapping optimization
```

### Problem 3: Low NPU Inference Accuracy

```
Symptom: Classification accuracy drops significantly (5%+) after INT8 quantization

Solutions:
1. Verify calibration data quality
   → Prepare at least 100 samples from a representative dataset
   → Biased data leads to improper quantization ranges

2. Switch to QAT (Quantization-Aware Training)
   → Effective when PTQ causes significant accuracy loss
   → Simulates quantization errors during training

3. Consider mixed-precision quantization
   → FP16 for sensitive layers, INT8 for others
   → PyTorch: torch.ao.quantization.quantize_dynamic()

4. Reconsider model architecture
   → DepthwiseSeparable Convolution has high quantization tolerance
   → BatchNorm pairs well with quantization (can be folded)
```

### Problem 4: Abnormally High Battery Consumption

```
Symptom: Battery drains rapidly when AI features are enabled

Checkpoints:
□ Is AI processing running continuously in the background?
  → Design to activate NPU only when needed
□ Is CPU/GPU fallback occurring?
  → Power consumption is significantly lower when running on NPU
□ Is the sensor data acquisition frequency too high?
  → Always-on camera drains heavily. Switch to event-triggered
□ Is the model inference frequency appropriate?
  → Every-frame inference (30fps) is high load. 5-10fps is often sufficient
  → Trigger on motion detection, skip inference when stationary
```

---

## 7. Best Practices and Design Patterns

### Pattern 1: Hybrid AI Design

```
┌─────────────────────────────────────────────────────┐
│             Hybrid AI Design Pattern                   │
│                                                       │
│  Input (text/image/audio)                             │
│      │                                                │
│      ▼                                                │
│  ┌──────────────┐                                    │
│  │ Task Classifier│  Lightweight model (~1MB)         │
│  │ (on-device)   │  determines task type              │
│  └──────┬───────┘                                    │
│         │                                             │
│    ┌────┼────┐                                        │
│    │    │    │                                        │
│    ▼    ▼    ▼                                        │
│  Simple  Med.  Complex                                │
│    │    │    │                                        │
│    ▼    ▼    ▼                                        │
│  NPU  NPU+  Cloud                                    │
│  Inst. GPU    API                                     │
│  resp. resp.  resp.                                   │
│  3ms  20ms  500ms                                     │
│                                                       │
│  Examples:                                            │
│  "Set a 3-minute timer" → NPU (rule-based)           │
│  "What flower is in this photo?" → NPU (image classif.)│
│  "Summarize this paper" → Cloud LLM                   │
└─────────────────────────────────────────────────────┘
```

### Pattern 2: Progressive Model Loading

```python
class ProgressiveModelLoader:
    """
    Progressive model loading pattern
    Delivers high-quality AI without degrading user experience
    """

    def __init__(self):
        self.models = {}
        self.loading_priority = [
            ("tiny_classifier", "model_tiny.tflite", 0),      # Load immediately
            ("standard_classifier", "model_std.tflite", 3),    # Load after 3 seconds
            ("high_quality_model", "model_hq.tflite", 10),     # Load after 10 seconds
        ]

    async def progressive_load(self):
        """Progressively load models after app launch"""
        for name, path, delay in self.loading_priority:
            await asyncio.sleep(delay)
            self.models[name] = load_tflite_model(path)
            print(f"Loaded: {name}")

    def get_best_available_model(self, task: str):
        """Return the highest quality model currently loaded"""
        for name in reversed(self.loading_priority):
            if name[0] in self.models:
                return self.models[name[0]]
        return None  # Nothing loaded yet
```

### Pattern 3: Federated Learning

```
┌──────────────────────────────────────────────┐
│      Model Improvement via Federated Learning │
│                                                │
│  Device A ──→ Local training ──→ Send gradients only ──┐
│  Device B ──→ Local training ──→ Send gradients only ──┤
│  Device C ──→ Local training ──→ Send gradients only ──┤
│  Device D ──→ Local training ──→ Send gradients only ──┤
│                                                        │
│                     ┌──────────────────────────────────┘
│                     │
│                     ▼
│              ┌──────────────┐
│              │ Server-side   │
│              │ Aggregate     │
│              │ gradients     │
│              │ (FedAvg)     │
│              └──────┬───────┘
│                     │
│                     ▼
│              Distribute updated model to all devices
│                                                │
│  Key points:                                    │
│  - Raw data is never sent to the server         │
│  - Differential privacy protects personal data  │
│  - Approach actually adopted by Apple/Google    │
└──────────────────────────────────────────────┘
```

---

## 8. Developer Checklist

### Mobile AI App Development Checklist

```
□ Model Selection
  □ Selected an architecture suitable for the task?
  □ Model size fits within target device RAM?
  □ Model uses NPU-compatible operations?

□ Quantization
  □ Applied INT8 quantization?
  □ Sufficient calibration data (100+ samples)?
  □ Verified accuracy after quantization?
  □ Considered whether QAT is needed?

□ Delegate Configuration
  □ Set up NPU → GPU → CPU fallback order?
  □ Verified supported operations for the delegate?
  □ Benchmarked inference speed on actual device?

□ Battery Optimization
  □ AI processing frequency is appropriate?
  □ Minimized background processing?
  □ Implemented dynamic adjustment based on battery level?

□ Memory Management
  □ Properly managing model load/unload?
  □ Using memory mapping?
  □ Tested for memory leaks?

□ User Experience
  □ Feedback during AI processing (loading indicator)?
  □ Implemented offline fallback?
  □ Displaying confidence scores for AI inference results?
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Forcing All AI Processing On-Device

```
Bad example:
Trying to run a 7B-parameter large LLM directly on a smartphone
→ Out of memory, rapid battery drain, responses take tens of seconds

Correct approach:
- Lightweight tasks (image classification, speech recognition) → On-device
- Heavy tasks (long text generation, complex reasoning) → Cloud
- Preprocessing on-device, final inference in cloud → Hybrid
```

### Anti-Pattern 2: Deploying NPU-Incompatible Models As-Is

```
Bad example:
Converting an FP32 model (500MB) directly to TFLite and deploying
→ Falls back to CPU instead of NPU, 10x slower

Correct approach:
1. Compress model size to 1/4 with INT8 quantization
2. Explicitly specify NNAPI/Core ML delegates
3. Confirm NPU execution via benchmarks (5-10x faster than CPU = success)
```

### Anti-Pattern 3: Collecting AI Data Without User Consent

```
Bad example:
- Sending camera footage to the cloud in the background
- Using voice data for AI training without consent
- Analyzing user behavior patterns without notification

Correct approach:
- Provide clear privacy policy compliant with GDPR/CCPA
- Prioritize on-device processing and minimize data transmission
- Use Federated Learning to avoid sending raw data
- Give users the option to toggle AI features ON/OFF
- Comply with Apple App Tracking Transparency (ATT)
```

### Anti-Pattern 4: Testing on Only a Single Device

```
Bad example:
Testing only on the latest flagship (Pixel 9 Pro / iPhone 16 Pro)
→ NPU unsupported on mid-range devices, out of memory failures

Correct approach:
- Test on at least 3 tiers of devices:
  High-end (NPU supported, RAM 12GB+)
  Mid-range (limited NPU support, RAM 6-8GB)
  Entry-level (no NPU, RAM 4GB)
- Automated testing with Firebase Test Lab / AWS Device Farm
- Implement automatic model selection based on device profile
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

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

# Test
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

Extend the basic implementation by adding the following features.

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

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|-----------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development Speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  (1) Team size?                                  │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to (2)             │
│                                                 │
│  (2) Deployment frequency?                       │
│    ├─ Once a week or less → Monolith + modular   │
│    └─ Daily/multiple times → Go to (3)           │
│                                                 │
│  (3) Team independence?                          │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze them from the following perspectives:

**1. Short-term vs Long-term Cost**
- A method that is faster in the short term may become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack has lower learning costs
- Diverse technologies enable the right tool for each job, but increase operational costs

**3. Level of Abstraction**
- High abstraction is more reusable but can make debugging harder
- Low abstraction is more intuitive but prone to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

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
        md += f"## Context\n{self.context}\n\n"
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
- Focus on the minimum viable set of features
- Automated tests only for critical paths
- Introduce monitoring early on

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally revamp a system that has been in operation for 10+ years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If existing tests are absent, create Characterization Tests first
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

**Situation:** 50+ engineers developing the same product

**Approach:**
- Define clear boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries via Inner Source
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

**Situation:** A system requiring millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leverage asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Method | Effect | Implementation Cost | When to Apply |
|--------------------|--------|-------------------|---------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Med | High | CPU-bound workloads |
---

## 10. FAQ

### Q1: What is the difference between an NPU and a GPU?

**A:** GPUs are optimized for general-purpose parallel computation (game rendering, scientific computing, etc.), while NPUs are circuits specialized for neural network inference (matrix multiplication, convolution). By efficiently performing low-precision operations in INT8/FP16, NPUs achieve several times the performance per watt (TOPS/W) compared to GPUs.

### Q2: How large a model can run with on-device AI?

**A:** As of 2024-2025, the following are realistic on smartphones:
- **Image classification/object detection**: MobileNetV3, EfficientNet-Lite (a few MB)
- **Speech recognition**: Whisper tiny/base (40-140MB)
- **LLM**: Gemini Nano (1.8B/3.25B parameters), Phi-3 Mini (3.8B, ~2GB after quantization)
- LLMs with 7B+ parameters require 12GB+ RAM and are limited to flagship devices.

### Q3: What is the difference between Apple Intelligence and Google AI?

**A:** The main differences are:
- **Apple Intelligence**: Privacy-first. Private Cloud Compute encrypts data even during cloud processing. Siri + ChatGPT integration.
- **Google AI (Pixel)**: Runs Gemini Nano on-device. Deep integration with Google Search/apps. Excels at Cloud AI coordination.
- Both take a hybrid approach: on-device processing by default, offloading advanced tasks to the cloud.

### Q4: Is the NPU performance metric "TOPS" truly reliable?

**A:** TOPS represents theoretical peak performance and does not directly reflect actual model inference speed. Caution is needed for the following reasons:
- TOPS differs between INT8 and FP16 (INT8 yields higher TOPS values)
- Memory bandwidth can become a bottleneck, with effective performance sometimes around 50% of TOPS
- Utilization varies depending on model architecture and supported operators
- The most reliable metric is inference speed (ms/inference) benchmarked on the target model with actual hardware.

### Q5: Are there security risks with on-device AI?

**A:** Key risks and countermeasures:
- **Model theft**: TFLite/CoreML models within apps can be reverse-engineered. Countermeasure: model encryption, obfuscation.
- **Adversarial attacks**: Fooling AI by adding subtle noise to inputs. Countermeasure: Adversarial Training, input validation.
- **Privacy leaks**: Attacks that infer training data from model gradients. Countermeasure: differential privacy, federated learning.
- **Model poisoning**: Contaminating models through malicious updates. Countermeasure: model signature verification, integrity checks.

### Q6: What is the outlook for AI smartphones going forward?

**A:** The following advancements are expected through 2025-2027:
- **NPU performance**: Reaching 100+ TOPS, making real-time inference of 7B models standard
- **Multimodal AI**: On-device models integrating text + image + audio + video
- **Personalization**: AI experiences optimized for individuals by learning user behavior patterns
- **AI agents**: Autonomous cross-app task execution (reservations, shopping, schedule management)
- **Always-on AI**: 24/7 AI monitoring with ultra-low-power NPUs (health, safety, environmental awareness)

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before proceeding to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently used in daily development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------------|
| Role of NPU | A processor specialized for AI inference. Power-efficient, high-speed processing with INT8/FP16 |
| Major Chips | Apple Neural Engine, Qualcomm Hexagon, Google Tensor TPU |
| On-Device AI | Benefits: privacy protection, low latency, offline operation |
| Quantization | 4x compression from FP32 to INT8; essential technology for NPU utilization |
| Hybrid Architecture | Lightweight tasks on-device, heavy tasks in the cloud is the optimal approach |
| Battery Optimization | Context-adaptive dynamic model selection is key |
| Security | Protection via model encryption, differential privacy, federated learning |
| Future Outlook | Advancement of on-device LLMs, standardization of multimodal AI |

---

## Recommended Next Reads

- [AI Cameras — Computational Photography and AI Editing](./01-ai-cameras.md)
- [AI Assistants — Siri/Google Assistant/Alexa](./02-ai-assistants.md)
- [AI PCs — NPU-Equipped PCs and Local LLMs](../01-computing/00-ai-pcs.md)

---

## References

1. **Qualcomm** — "Snapdragon 8 Gen 3 Mobile Platform," qualcomm.com, 2024
2. **Apple** — "Apple Intelligence Technical Overview," developer.apple.com, 2024
3. **Google** — "AICore and Gemini Nano on Android," developer.android.com, 2024
4. **ARM** — "Ethos-U NPU Architecture Reference," developer.arm.com, 2024
5. **TensorFlow** — "TensorFlow Lite for Mobile and Edge Devices," tensorflow.org, 2024
6. **MLX** — "MLX: An array framework for Apple silicon," ml-explore.github.io, 2024
7. **ONNX Runtime** — "ONNX Runtime Mobile," onnxruntime.ai, 2024
