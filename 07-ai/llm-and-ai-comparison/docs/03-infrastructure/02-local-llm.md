# Local LLM — Ollama, llama.cpp, and Quantization

> Local LLMs are an approach to running large language models on your own servers or local machines, offering an important option for meeting data privacy, latency, cost, and offline operation requirements.

## What You Will Learn

1. **How local execution and quantization work** — Efficiency gains and the memory/quality trade-offs of GGUF, GPTQ, and AWQ
2. **Using the major tools** — Practical setup procedures for Ollama, llama.cpp, vLLM, and TGI
3. **GPU/CPU selection and performance optimization** — Hardware requirements and techniques for improving inference speed


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Vector DB — Pinecone, Weaviate, pgvector, Qdrant](./01-vector-databases.md)

---

## 1. Overview of Local LLMs

```
┌──────────────────────────────────────────────────────────┐
│          ローカル LLM 実行のエコシステム                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  モデル取得          量子化/最適化       実行環境          │
│  ┌──────────┐       ┌──────────┐      ┌─────────────┐  │
│  │Hugging   │       │ GGUF     │      │ Ollama      │  │
│  │Face Hub  │──────▶│ GPTQ     │─────▶│ llama.cpp   │  │
│  │          │       │ AWQ      │      │ vLLM        │  │
│  └──────────┘       │ GGML     │      │ TGI         │  │
│                     └──────────┘      └──────┬──────┘  │
│                                              │          │
│                                              ▼          │
│  ハードウェア                                            │
│  ┌──────────────────────────────────────┐              │
│  │ GPU: NVIDIA (CUDA) / Apple Silicon   │              │
│  │ CPU: x86_64 / ARM (推論可能)         │              │
│  │ RAM: 8GB〜 (モデルサイズ依存)        │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  API 提供                                                │
│  ┌──────────────────────────────────────┐              │
│  │ OpenAI 互換 API (localhost:11434等)   │              │
│  │ → 既存コードをそのまま流用可能        │              │
│  └──────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

### 1.1 When to Choose a Local LLM

Local LLMs are not a universal solution — they offer a significant advantage under specific conditions. Use the following decision matrix to evaluate your situation.

```
┌──────────────────────────────────────────────────────────┐
│      ローカル LLM vs クラウド API 判断マトリクス            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  要件                      ローカル  API   判断基準      │
│  ──────                    ──────   ───   ──────────    │
│  データ機密性が最優先       ★★★     ★    医療・金融等  │
│  オフライン環境で動作       ★★★     ☆    軍事・工場等  │
│  低レイテンシ (<50ms)      ★★★     ★    ゲーム・RT系  │
│  月間100万req以上          ★★★     ★★   コスト逆転点  │
│  最新モデルを常に使いたい   ☆       ★★★  API有利     │
│  インフラ管理を避けたい     ☆       ★★★  チーム規模   │
│  GPT-4o級の品質が必須      ★       ★★★  大型モデル   │
│  カスタマイズが必要         ★★★     ★    FT・LoRA     │
│                                                          │
│  ★★★=非常に有利  ★★=有利  ★=まあまあ  ☆=不向き     │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Local LLM Architecture Patterns

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class DeploymentPattern(Enum):
    """ローカル LLM のデプロイパターン"""
    SINGLE_GPU = "single_gpu"          # 単一 GPU (RTX 4090 等)
    MULTI_GPU = "multi_gpu"            # マルチ GPU (テンソル並列)
    CPU_ONLY = "cpu_only"              # CPU のみ (GGUF Q4)
    HYBRID = "hybrid"                  # GPU + CPU オフロード
    APPLE_SILICON = "apple_silicon"    # Apple Silicon (Metal)
    EDGE = "edge"                      # エッジデバイス (Raspberry Pi等)

@dataclass
class LocalLLMConfig:
    """ローカル LLM 構成定義"""
    model_name: str
    model_size_b: float                 # パラメータ数 (Billion)
    quantization: str                   # "Q4_K_M", "Q8_0", "GPTQ", "AWQ"
    deployment_pattern: DeploymentPattern
    max_context_length: int = 8192
    gpu_layers: int = -1                # -1 = 全レイヤー GPU
    threads: int = 8
    batch_size: int = 512

    @property
    def estimated_vram_gb(self) -> float:
        """推定 VRAM/RAM 使用量を計算"""
        quant_multiplier = {
            "FP16": 2.0,
            "Q8_0": 1.1,
            "Q5_K_M": 0.75,
            "Q4_K_M": 0.65,
            "Q3_K_M": 0.5,
            "Q2_K": 0.4,
            "GPTQ": 0.6,
            "AWQ": 0.6,
        }
        multiplier = quant_multiplier.get(self.quantization, 0.65)
        return self.model_size_b * multiplier

    @property
    def fits_in_gpu(self) -> bool:
        """指定された GPU に収まるか判定"""
        common_gpus = {
            "RTX_3060_12GB": 12,
            "RTX_4070_12GB": 12,
            "RTX_4090_24GB": 24,
            "A100_40GB": 40,
            "A100_80GB": 80,
        }
        return self.estimated_vram_gb < 24  # RTX 4090 基準

# 使用例: 各構成の VRAM 見積もり
configs = [
    LocalLLMConfig("Llama-3.1-8B", 8, "Q4_K_M", DeploymentPattern.SINGLE_GPU),
    LocalLLMConfig("Qwen-2.5-14B", 14, "Q4_K_M", DeploymentPattern.SINGLE_GPU),
    LocalLLMConfig("Llama-3.1-70B", 70, "Q4_K_M", DeploymentPattern.MULTI_GPU),
    LocalLLMConfig("Phi-3-mini", 3.8, "Q4_K_M", DeploymentPattern.EDGE),
]

for config in configs:
    print(f"{config.model_name:20s} {config.quantization:8s} "
          f"→ {config.estimated_vram_gb:.1f} GB "
          f"(GPU適合: {config.fits_in_gpu})")
```

---

## 2. How Quantization Works

### 2.1 What Is Quantization?

```
┌──────────────────────────────────────────────────────────┐
│           量子化によるモデルサイズ削減                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  FP32 (32bit浮動小数点)                                  │
│  ████████████████████████████████  → 1パラメータ = 4B    │
│  7B モデル: 28GB                                         │
│                                                          │
│  FP16 / BF16 (16bit)                                    │
│  ████████████████                  → 1パラメータ = 2B    │
│  7B モデル: 14GB                                         │
│                                                          │
│  INT8 (8bit整数)                                         │
│  ████████                          → 1パラメータ = 1B    │
│  7B モデル: 7GB                                          │
│                                                          │
│  INT4 (4bit整数)                                         │
│  ████                              → 1パラメータ = 0.5B  │
│  7B モデル: 3.5GB                                        │
│                                                          │
│  品質への影響:                                            │
│  FP16 → INT8: ほぼ劣化なし (-0.1〜0.5%)                 │
│  FP16 → INT4: 軽微な劣化 (-1〜3%)                       │
│  FP16 → INT2: 顕著な劣化 (-5〜15%)                      │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Comparison of Quantization Formats

| Format | Bit width | Runtime | Quality | Speed | Primary use case |
|--------|-----------|---------|---------|-------|-----------------|
| GGUF (Q4_K_M) | 4-5 bit | CPU + GPU | High | Medium | Ollama, llama.cpp |
| GGUF (Q8_0) | 8 bit | CPU + GPU | Highest | Slow | Quality-first |
| GGUF (Q2_K) | 2-3 bit | CPU + GPU | Low | Fastest | Minimal-memory environments |
| GPTQ | 4 bit | GPU required | High | Fast | vLLM, TGI |
| AWQ | 4 bit | GPU required | Highest | Fast | vLLM (recommended) |
| EETQ | 8 bit | GPU required | Highest | Fast | TGI |
| bitsandbytes | 4/8 bit | GPU required | High | Medium | Transformers integration |

### 2.3 GGUF Quantization in Detail

GGUF (GPT-Generated Unified Format) is a model format defined by llama.cpp that supports inference on both CPU and GPU. Understanding how quantization variant names are read is important.

```
┌──────────────────────────────────────────────────────────┐
│          GGUF 量子化名の読み方                              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Q4_K_M の解読:                                          │
│  │ │ │                                                  │
│  │ │ └── M = Medium (品質・サイズのバランス)              │
│  │ │     S = Small (より小型)                            │
│  │ │     L = Large (より高品質)                          │
│  │ │                                                    │
│  │ └──── K = K-Quant 方式 (改良型量子化)                 │
│  │       0 = 旧方式 (対称量子化)                         │
│  │                                                      │
│  └────── 4 = 基本ビット幅 (4bit)                         │
│                                                          │
│  推奨順位 (品質/サイズバランス):                          │
│  1. Q4_K_M  → 最もバランスが良い (推奨)                  │
│  2. Q5_K_M  → やや高品質 + やや大型                      │
│  3. Q3_K_M  → メモリ節約優先                             │
│  4. Q6_K    → 高品質指向                                 │
│  5. Q8_0    → 品質最優先 (FP16 に近い)                   │
│  6. Q2_K    → 最小サイズ (品質犠牲大)                    │
└──────────────────────────────────────────────────────────┘
```

### 2.4 Differences Between GPTQ and AWQ

```python
# GPTQ quantization: post-training quantization dependent on calibration data
# → Determines optimal quantization parameters using a specific dataset
# → Optimized for GPU inference

# AWQ (Activation-aware Weight Quantization):
# → Identifies "important weights" and protects them during quantization
# → Often higher quality than GPTQ

# Comparison table
"""
Property      GPTQ                    AWQ
──────        ──────                  ──────
Method        Layer-wise optimization Activation-based importance analysis
Quality       High                    Slightly higher (exceeds GPTQ)
Speed         Fast                    Fast
Calibration   Required (128-256 samples)  Required (small amount OK)
Compatibility vLLM, TGI, AutoGPTQ    vLLM, TGI, AutoAWQ
Recommended   General GPU inference   Quality-focused GPU inference
"""
```

### 2.5 Running Quantization Yourself

```python
# AutoGPTQ を使った GPTQ 量子化
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
from transformers import AutoTokenizer

model_name = "meta-llama/Meta-Llama-3.1-8B-Instruct"
output_dir = "llama-3.1-8b-gptq-4bit"

# 量子化設定
quantize_config = BaseQuantizeConfig(
    bits=4,                 # 量子化ビット数
    group_size=128,         # グループサイズ (小さいほど高品質、大きいほど高速)
    desc_act=True,          # 活性化に基づくソート (品質向上)
    damp_percent=0.1,       # ダンピング (数値安定性)
)

# トークナイザとモデルの読み込み
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoGPTQForCausalLM.from_pretrained(
    model_name,
    quantize_config=quantize_config,
)

# キャリブレーションデータの準備
calibration_data = [
    tokenizer(text, return_tensors="pt")
    for text in [
        "The meaning of life is",
        "機械学習とは、データから",
        "def fibonacci(n):\n    if n <= 1:\n        return n",
        # ... 128-256 サンプル推奨
    ]
]

# 量子化の実行 (数十分〜数時間)
model.quantize(calibration_data)

# 保存
model.save_quantized(output_dir)
tokenizer.save_pretrained(output_dir)
print(f"量子化完了: {output_dir}")
```

```python
# AWQ 量子化
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer

model_name = "meta-llama/Meta-Llama-3.1-8B-Instruct"
output_dir = "llama-3.1-8b-awq-4bit"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoAWQForCausalLM.from_pretrained(model_name)

# AWQ 量子化設定
quant_config = {
    "zero_point": True,
    "q_group_size": 128,
    "w_bit": 4,
    "version": "GEMM",  # GEMM = GPU最適化
}

# 量子化実行
model.quantize(
    tokenizer,
    quant_config=quant_config,
)

# 保存
model.save_quantized(output_dir)
tokenizer.save_pretrained(output_dir)
```

### 2.6 HuggingFace → GGUF Conversion

```bash
# llama.cpp の convert スクリプトを使用
cd llama.cpp

# HuggingFace 形式 → GGUF (FP16)
python convert_hf_to_gguf.py \
    /path/to/huggingface-model \
    --outfile model-fp16.gguf \
    --outtype f16

# GGUF の量子化 (FP16 → Q4_K_M)
./build/bin/llama-quantize \
    model-fp16.gguf \
    model-q4_k_m.gguf \
    Q4_K_M

# 量子化結果の確認
./build/bin/llama-quantize --help
# 利用可能な量子化タイプ:
#   Q2_K, Q3_K_S, Q3_K_M, Q3_K_L,
#   Q4_0, Q4_1, Q4_K_S, Q4_K_M,
#   Q5_0, Q5_1, Q5_K_S, Q5_K_M,
#   Q6_K, Q8_0, F16, F32

# imatrix (重要度行列) を使った高品質量子化
./build/bin/llama-imatrix \
    -m model-fp16.gguf \
    -f calibration_data.txt \
    -o imatrix.dat

./build/bin/llama-quantize \
    --imatrix imatrix.dat \
    model-fp16.gguf \
    model-q4_k_m-imat.gguf \
    Q4_K_M
# → imatrix 使用で Q4 の品質が Q5 に近づく
```

---

## 3. Ollama

### 3.1 Installation and Basic Usage

```bash
# macOS / Linux: インストール
curl -fsSL https://ollama.com/install.sh | sh

# モデルのダウンロードと実行
ollama pull llama3.1:8b          # 8Bモデル (4.7GB)
ollama pull qwen2.5:7b           # Qwen 7B
ollama pull deepseek-r1:8b       # DeepSeek R1 蒸留版

# インタラクティブ実行
ollama run llama3.1:8b

# 利用可能モデル一覧
ollama list
```

### 3.2 Ollama API (OpenAI-Compatible)

```python
from openai import OpenAI

# Ollama は OpenAI 互換 API を提供
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # 任意の値でOK
)

response = client.chat.completions.create(
    model="llama3.1:8b",
    messages=[
        {"role": "system", "content": "日本語で回答してください。"},
        {"role": "user", "content": "Pythonのリスト内包表記を説明してください。"},
    ],
    temperature=0.7,
)
print(response.choices[0].message.content)

# ストリーミング
stream = client.chat.completions.create(
    model="qwen2.5:7b",
    messages=[{"role": "user", "content": "RAGとは？"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### 3.3 Customizing with a Modelfile

```dockerfile
# Modelfile: カスタムモデル定義
FROM llama3.1:8b

# システムプロンプト設定
SYSTEM """
あなたはPythonプログラミングの専門家です。
コードは常にPEP 8準拠で、型ヒント付きで記述してください。
"""

# パラメータ調整
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER num_ctx 8192
PARAMETER stop "<|eot_id|>"
```

```bash
# カスタムモデルのビルドと実行
ollama create python-expert -f Modelfile
ollama run python-expert
```

### 3.4 Advanced Ollama Management

```bash
# モデルの詳細情報
ollama show llama3.1:8b

# モデルの削除 (ストレージ解放)
ollama rm llama3.1:8b

# GPU メモリ使用量の確認
ollama ps

# 実行中のモデルの一覧
ollama list --running

# 環境変数によるカスタマイズ
export OLLAMA_HOST=0.0.0.0:11434           # バインドアドレス
export OLLAMA_MODELS=/data/ollama/models   # モデル保存先
export OLLAMA_NUM_PARALLEL=4               # 同時リクエスト数
export OLLAMA_MAX_LOADED_MODELS=2          # 同時ロードモデル数
export OLLAMA_KEEP_ALIVE=5m                # モデルのメモリ保持時間
```

### 3.5 Using a Custom GGUF with Ollama

```dockerfile
# Modelfile: カスタム GGUF モデル
FROM /path/to/my-custom-model-q4_k_m.gguf

TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ .Response }}<|eot_id|>"""

PARAMETER stop "<|eot_id|>"
PARAMETER num_ctx 8192
```

```bash
# ビルドと実行
ollama create my-custom -f Modelfile
ollama run my-custom
```

### 3.6 Ollama Python Library (Native)

```python
import ollama

# Ollama ネイティブ API
response = ollama.chat(
    model="llama3.1:8b",
    messages=[
        {"role": "user", "content": "量子コンピュータの原理を簡潔に説明してください。"}
    ],
)
print(response["message"]["content"])

# ストリーミング
stream = ollama.chat(
    model="llama3.1:8b",
    messages=[{"role": "user", "content": "Rustの所有権を説明"}],
    stream=True,
)
for chunk in stream:
    print(chunk["message"]["content"], end="", flush=True)

# Embeddings
embeddings = ollama.embeddings(
    model="nomic-embed-text",
    prompt="日本語のテキストを埋め込む",
)
print(f"次元数: {len(embeddings['embedding'])}")

# モデル一覧
models = ollama.list()
for model in models["models"]:
    print(f"{model['name']:30s} {model['size'] / 1e9:.1f} GB")
```

---

## 4. llama.cpp

### 4.1 Build and Run

```bash
# ビルド (macOS - Metal対応)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DGGML_METAL=ON
cmake --build build --config Release

# NVIDIA GPU 対応ビルド
cmake -B build -DGGML_CUDA=ON
cmake --build build --config Release

# サーバーモード (OpenAI互換API)
./build/bin/llama-server \
    -m models/llama-3.1-8b-q4_k_m.gguf \
    --host 0.0.0.0 \
    --port 8080 \
    -c 8192 \       # コンテキスト長
    -ngl 99 \       # GPUにオフロードするレイヤー数
    --threads 8     # CPUスレッド数
```

### 4.2 Python Bindings

```python
from llama_cpp import Llama

# モデル読み込み
llm = Llama(
    model_path="models/llama-3.1-8b-q4_k_m.gguf",
    n_ctx=8192,        # コンテキスト長
    n_gpu_layers=-1,   # 全レイヤーをGPUに (-1 = 全部)
    n_threads=8,       # CPUスレッド数
    verbose=False,
)

# 推論
output = llm.create_chat_completion(
    messages=[
        {"role": "system", "content": "日本語で回答してください。"},
        {"role": "user", "content": "量子コンピュータの原理を説明してください。"},
    ],
    temperature=0.7,
    max_tokens=512,
)
print(output["choices"][0]["message"]["content"])
```

### 4.3 Detailed llama.cpp Server Configuration

```bash
# 高度なサーバー設定
./build/bin/llama-server \
    -m models/llama-3.1-8b-q4_k_m.gguf \
    --host 0.0.0.0 \
    --port 8080 \
    -c 16384 \              # コンテキスト長
    -ngl 99 \               # GPU レイヤー数
    --threads 8 \           # CPU スレッド数
    --threads-batch 8 \     # バッチ処理用 CPU スレッド
    --batch-size 2048 \     # バッチサイズ
    --ubatch-size 512 \     # マイクロバッチサイズ
    --cont-batching \       # 連続バッチ処理 (スループット向上)
    --flash-attn \          # Flash Attention (メモリ節約 + 高速化)
    --mlock \               # メモリロック (スワップ防止)
    --no-mmap \             # メモリマップ無効化 (大きいモデル用)
    --parallel 4 \          # 同時リクエスト処理数
    --metrics               # Prometheus メトリクス有効化
```

### 4.4 Advanced llama-cpp-python Usage

```python
from llama_cpp import Llama
from llama_cpp.llama_chat_format import Llama3ChatHandler

# Function Calling 対応
llm = Llama(
    model_path="models/llama-3.1-8b-q4_k_m.gguf",
    n_ctx=8192,
    n_gpu_layers=-1,
    chat_format="llama-3",
    chat_handler=Llama3ChatHandler(),
)

# JSON Mode (Structured Output)
import json

output = llm.create_chat_completion(
    messages=[
        {"role": "system", "content": "JSONで回答してください。"},
        {"role": "user", "content": "日本の3大都市の人口を教えて"},
    ],
    response_format={"type": "json_object"},
    temperature=0.1,
)
result = json.loads(output["choices"][0]["message"]["content"])
print(json.dumps(result, ensure_ascii=False, indent=2))

# Grammar による出力制約 (GBNF 形式)
grammar_text = r'''
root   ::= "{" ws "\"name\"" ws ":" ws string "," ws "\"age\"" ws ":" ws number "}"
string ::= "\"" [a-zA-Z ]+ "\""
number ::= [0-9]+
ws     ::= [ \t\n]*
'''

from llama_cpp import LlamaGrammar
grammar = LlamaGrammar.from_string(grammar_text)

output = llm.create_chat_completion(
    messages=[{"role": "user", "content": "架空の人物のプロフィールを作成"}],
    grammar=grammar,
)
# → 必ず {"name": "...", "age": ...} 形式で出力
```

### 4.5 Speculative Decoding

```bash
# 大きなモデルの推論を小さなモデルで加速
# Draft model (小): 高速に候補トークンを生成
# Target model (大): 候補を検証

./build/bin/llama-speculative \
    -m models/llama-3.1-70b-q4_k_m.gguf \      # ターゲット (大)
    -md models/llama-3.1-8b-q4_k_m.gguf \       # ドラフト (小)
    --draft 8 \                                   # ドラフトトークン数
    -ngl 99 \
    -c 4096 \
    -p "Explain quantum computing in detail."

# 原理:
# 1. ドラフトモデルが 8 トークンを高速生成
# 2. ターゲットモデルが 8 トークンを一括検証
# 3. 一致するトークンはそのまま採用
# 4. 不一致の時点から再生成
# → 2-3 倍の高速化が期待できる
```

---

## 5. vLLM (High-Throughput Inference)

### 5.1 vLLM Server

```bash
# インストール
pip install vllm

# サーバー起動 (OpenAI互換)
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --dtype bfloat16 \
    --max-model-len 8192 \
    --tensor-parallel-size 1 \    # GPU数
    --gpu-memory-utilization 0.9
```

```python
# vLLM サーバーへのアクセス (OpenAI互換)
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="vllm")

response = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### 5.2 Batch Inference (Offline)

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    dtype="bfloat16",
    max_model_len=4096,
)

sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=512,
)

# 大量プロンプトを一括処理 (バッチ推論で高効率)
prompts = [f"質問{i}に回答してください" for i in range(1000)]
outputs = llm.generate(prompts, sampling_params)

for output in outputs:
    print(output.outputs[0].text[:100])
```

### 5.3 Advanced vLLM Configuration

```bash
# プロダクション向け vLLM 設定
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --dtype bfloat16 \
    --max-model-len 16384 \
    --tensor-parallel-size 2 \          # 2 GPU でテンソル並列
    --pipeline-parallel-size 1 \        # パイプライン並列
    --gpu-memory-utilization 0.90 \     # GPU メモリ使用率
    --max-num-seqs 256 \                # 最大同時シーケンス数
    --max-num-batched-tokens 8192 \     # 最大バッチトークン数
    --enable-prefix-caching \           # プレフィックスキャッシュ (KV Cache共有)
    --quantization awq \                # AWQ 量子化モデル使用時
    --enforce-eager \                   # CUDA Graph 無効 (デバッグ用)
    --disable-log-requests              # リクエストログ抑制 (本番用)
```

```python
# vLLM で LoRA アダプタを動的に切り替え
from vllm import LLM, SamplingParams
from vllm.lora.request import LoRARequest

# ベースモデル + LoRA 対応で起動
llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    enable_lora=True,
    max_lora_rank=64,
    max_loras=4,  # 同時に4つの LoRA をロード可能
)

# LoRA アダプタの指定
lora_request = LoRARequest(
    lora_name="japanese-qa",
    lora_int_id=1,
    lora_local_path="/path/to/lora-adapter",
)

# LoRA 付きで推論
outputs = llm.generate(
    ["日本の首都は？"],
    SamplingParams(temperature=0.1, max_tokens=128),
    lora_request=lora_request,
)

# 別の LoRA に切り替え
lora_code = LoRARequest("code-gen", 2, "/path/to/code-lora")
outputs_code = llm.generate(
    ["def fibonacci(n):"],
    SamplingParams(temperature=0.2, max_tokens=256),
    lora_request=lora_code,
)
```

### 5.4 vLLM vs TGI Comparison

```
┌──────────────────────────────────────────────────────────┐
│           vLLM vs TGI 詳細比較                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  特性           vLLM                  TGI                │
│  ────           ────                  ───                │
│  開発元         UC Berkeley           Hugging Face       │
│  言語           Python                Rust + Python      │
│  バッチ処理     PagedAttention        Continuous Batch   │
│  メモリ効率     PagedAttention        Token Streaming    │
│  量子化対応     GPTQ/AWQ/FP8         GPTQ/AWQ/EETQ     │
│  テンソル並列   対応 (最大8GPU)       対応               │
│  LoRA対応       対応 (動的切替)       対応               │
│  スループット   非常に高い            高い               │
│  ドキュメント   良好                  良好               │
│  Docker対応     公式イメージあり      公式イメージあり   │
│  Kubernetes     対応                  対応               │
│                                                          │
│  推奨:                                                   │
│  - 最大スループット → vLLM                                │
│  - HuggingFace エコシステム → TGI                        │
│  - Apple Silicon → どちらも非推奨 (Ollama推奨)           │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Hardware Requirements

```
┌──────────────────────────────────────────────────────────┐
│         モデルサイズ別のハードウェア要件                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  モデル        量子化    VRAM/RAM     推奨GPU/CPU        │
│  ─────        ─────    ─────────    ─────────          │
│  3B (Phi-3)   Q4       ~2GB         MacBook Air M1     │
│  7-8B         Q4       ~4GB         RTX 3060 12GB      │
│  7-8B         Q8       ~8GB         RTX 4070 12GB      │
│  7-8B         FP16     ~16GB        RTX 4090 24GB      │
│  13-14B       Q4       ~8GB         RTX 4070 Ti 16GB   │
│  34B          Q4       ~20GB        RTX 4090 24GB      │
│  70B          Q4       ~40GB        A100 80GB / 2xRTX  │
│  70B          FP16     ~140GB       2xA100 80GB        │
│  405B         Q4       ~240GB       8xA100 80GB        │
│                                                          │
│  Apple Silicon:                                          │
│  M1 (8GB)   → 7B Q4 まで快適                            │
│  M2 Pro (16GB) → 13B Q4 まで快適                        │
│  M3 Max (48GB) → 34B Q4 / 70B Q3 可能                  │
│  M3 Ultra (192GB) → 70B FP16 可能                       │
└──────────────────────────────────────────────────────────┘
```

### 6.1 GPU Selection Guide

```python
# GPU 選定の意思決定ツール
from dataclasses import dataclass
from typing import Optional

@dataclass
class GPUSpec:
    name: str
    vram_gb: int
    bandwidth_gb_s: int   # メモリ帯域幅 (推論速度に直結)
    price_usd: int        # 概算価格
    power_w: int          # 消費電力
    fp16_tflops: float    # FP16 演算性能

gpu_catalog = {
    "RTX_3060":    GPUSpec("RTX 3060 12GB", 12, 360, 300, 170, 12.7),
    "RTX_4060_Ti": GPUSpec("RTX 4060 Ti 16GB", 16, 288, 450, 165, 22.1),
    "RTX_4070_Ti": GPUSpec("RTX 4070 Ti 16GB", 16, 504, 600, 285, 40.1),
    "RTX_4090":    GPUSpec("RTX 4090 24GB", 24, 1008, 1600, 450, 82.6),
    "A100_40GB":   GPUSpec("A100 40GB", 40, 1555, 10000, 250, 77.9),
    "A100_80GB":   GPUSpec("A100 80GB", 80, 2039, 15000, 300, 77.9),
    "H100_80GB":   GPUSpec("H100 80GB", 80, 3350, 30000, 700, 267.6),
    "L40S":        GPUSpec("L40S 48GB", 48, 864, 7000, 350, 91.6),
}

def recommend_gpu(model_size_b: float, quant: str = "Q4_K_M") -> list:
    """モデルサイズから推奨GPUを返す"""
    quant_factor = {
        "FP16": 2.0, "Q8_0": 1.1, "Q4_K_M": 0.65,
        "GPTQ": 0.6, "AWQ": 0.6,
    }
    required_vram = model_size_b * quant_factor.get(quant, 0.65) * 1.2  # 20%マージン

    suitable = []
    for key, gpu in gpu_catalog.items():
        if gpu.vram_gb >= required_vram:
            # tok/s 概算 (帯域幅 / (VRAM使用量))
            est_tok_s = gpu.bandwidth_gb_s / (required_vram * 2) * 10
            suitable.append({
                "gpu": gpu.name,
                "vram": gpu.vram_gb,
                "required": f"{required_vram:.1f} GB",
                "est_tok_s": f"~{est_tok_s:.0f} tok/s",
                "price": f"${gpu.price_usd:,}",
            })

    return sorted(suitable, key=lambda x: x["vram"])

# 例
print("=== 8B Q4_K_M ===")
for gpu in recommend_gpu(8, "Q4_K_M"):
    print(f"  {gpu['gpu']:25s} VRAM:{gpu['vram']}GB "
          f"必要:{gpu['required']} 速度:{gpu['est_tok_s']} "
          f"価格:{gpu['price']}")

print("\n=== 70B Q4_K_M ===")
for gpu in recommend_gpu(70, "Q4_K_M"):
    print(f"  {gpu['gpu']:25s} VRAM:{gpu['vram']}GB "
          f"必要:{gpu['required']} 速度:{gpu['est_tok_s']} "
          f"価格:{gpu['price']}")
```

### 6.2 Performance Optimization on Apple Silicon

```bash
# Apple Silicon 最適化の確認
# Metal が有効かどうか
ollama run llama3.1:8b --verbose 2>&1 | grep -i metal

# llama.cpp でのメモリ帯域テスト
./build/bin/llama-bench \
    -m models/llama-3.1-8b-q4_k_m.gguf \
    -p 512 \       # プロンプトトークン数
    -n 128 \       # 生成トークン数
    -ngl 99        # 全レイヤー GPU (Metal)

# 結果例 (M3 Max 48GB):
# prompt eval: 1234.56 tok/s
# generation:  38.91 tok/s
```

```python
# Apple Silicon での最適設定
from llama_cpp import Llama

llm = Llama(
    model_path="models/llama-3.1-8b-q4_k_m.gguf",
    n_ctx=8192,
    n_gpu_layers=-1,      # Metal で全レイヤー処理
    n_threads=1,           # Apple Silicon ではスレッド数を減らす方が速い場合あり
    n_batch=512,
    use_mlock=True,        # メモリロック
    verbose=False,
)

# パフォーマンス測定
import time

prompt = "日本語で100文字程度の物語を書いてください。"
start = time.time()
output = llm.create_chat_completion(
    messages=[{"role": "user", "content": prompt}],
    max_tokens=256,
)
elapsed = time.time() - start
tokens = output["usage"]["completion_tokens"]
print(f"生成トークン: {tokens}, 時間: {elapsed:.2f}s, 速度: {tokens/elapsed:.1f} tok/s")
```

---

## 7. Comparison Tables

### 7.1 Inference Engine Comparison

| Feature | Ollama | llama.cpp | vLLM | TGI |
|---------|--------|-----------|------|-----|
| Ease of setup | Highest | Medium | Medium | Medium |
| CPU inference | Supported | Best | Not recommended | Not recommended |
| GPU inference | Supported | Supported | Best | Best |
| Apple Silicon | Best | Best | Limited | Not supported |
| Quantization formats | GGUF | GGUF | GPTQ/AWQ/FP16 | GPTQ/AWQ/EETQ |
| Batch inference | Limited | Limited | Best | Best |
| OpenAI-compatible | Supported | Supported | Supported | Supported |
| Multi-GPU | N/A | Limited | Best | Best |
| Use case | Personal development | Custom setups | Production | Production |

### 7.2 Quantization Quality Comparison (Llama 3.1 8B baseline)

| Quantization | Size | MMLU | Inference speed (tok/s) | Recommendation |
|--------------|------|------|-------------------------|----------------|
| FP16 | 16GB | 68.4 | 40 (A100) | Quality-first |
| Q8_0 | 8.5GB | 68.2 | 55 (A100) | Balanced |
| Q5_K_M | 5.7GB | 67.8 | 70 (A100) | High quality + compact |
| Q4_K_M | 4.9GB | 67.1 | 80 (A100) | Recommended |
| Q3_K_M | 3.9GB | 65.5 | 90 (A100) | Memory-focused |
| Q2_K | 3.2GB | 60.2 | 100 (A100) | Minimal |

---

## 8. Deployment with Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  vllm:
    image: vllm/vllm-openai:latest
    ports:
      - "8000:8000"
    volumes:
      - huggingface-cache:/root/.cache/huggingface
    command: >
      --model Qwen/Qwen2.5-7B-Instruct
      --dtype bfloat16
      --max-model-len 8192
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama-data:
  huggingface-cache:
```

### 8.1 Kubernetes Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-server
  labels:
    app: vllm-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vllm-server
  template:
    metadata:
      labels:
        app: vllm-server
    spec:
      containers:
        - name: vllm
          image: vllm/vllm-openai:latest
          command:
            - "python"
            - "-m"
            - "vllm.entrypoints.openai.api_server"
            - "--model"
            - "Qwen/Qwen2.5-7B-Instruct"
            - "--dtype"
            - "bfloat16"
            - "--max-model-len"
            - "8192"
            - "--gpu-memory-utilization"
            - "0.90"
          ports:
            - containerPort: 8000
          resources:
            limits:
              nvidia.com/gpu: 1
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
          volumeMounts:
            - name: model-cache
              mountPath: /root/.cache/huggingface
      volumes:
        - name: model-cache
          persistentVolumeClaim:
            claimName: model-cache-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
spec:
  selector:
    app: vllm-server
  ports:
    - port: 8000
      targetPort: 8000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vllm-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vllm-server
  minReplicas: 1
  maxReplicas: 4
  metrics:
    - type: Pods
      pods:
        metric:
          name: gpu_utilization
        target:
          type: AverageValue
          averageValue: "80"
```

### 8.2 Reverse Proxy Configuration for Production

```nginx
# nginx.conf — reverse proxy for local LLM
upstream vllm_backend {
    least_conn;  # load balancing by minimum connections
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;
}

server {
    listen 443 ssl;
    server_name llm.example.com;

    ssl_certificate     /etc/ssl/certs/llm.crt;
    ssl_certificate_key /etc/ssl/private/llm.key;

    # rate limiting
    limit_req_zone $binary_remote_addr zone=llm:10m rate=10r/s;

    location /v1/ {
        limit_req zone=llm burst=20 nodelay;

        proxy_pass http://vllm_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # streaming support
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;

        # timeout settings (LLM responses can take time)
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        # request size limit
        client_max_body_size 10M;
    }

    # health check
    location /health {
        proxy_pass http://vllm_backend/health;
    }
}
```

---

## 9. Performance Optimization

### 9.1 Bottleneck Analysis for Inference Speed

```
┌──────────────────────────────────────────────────────────┐
│          LLM 推論のボトルネック分析                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  推論は 2 つのフェーズに分かれる:                         │
│                                                          │
│  1. Prefill (プロンプト処理)                              │
│     - 入力トークン全体を一括処理                         │
│     - GPU 演算がボトルネック (compute-bound)              │
│     - 高速化: バッチサイズ増加、Flash Attention           │
│                                                          │
│  2. Decode (トークン生成)                                │
│     - 1 トークンずつ逐次生成                             │
│     - メモリ帯域幅がボトルネック (memory-bound)           │
│     - 高速化: 量子化、KV Cache最適化                     │
│                                                          │
│  推論速度の計算式 (概算):                                │
│  Decode tok/s ≈ メモリ帯域幅(GB/s) / モデルサイズ(GB)   │
│                                                          │
│  例:                                                     │
│  RTX 4090 (1008 GB/s) + 8B Q4 (4.9GB)                  │
│  → 1008 / 4.9 ≈ 205 tok/s (理論上限)                   │
│  → 実測 80-120 tok/s (オーバーヘッド含む)                │
│                                                          │
│  A100 80GB (2039 GB/s) + 8B Q4 (4.9GB)                  │
│  → 2039 / 4.9 ≈ 416 tok/s (理論上限)                   │
│  → 実測 150-250 tok/s                                   │
└──────────────────────────────────────────────────────────┘
```

### 9.2 KV Cache Optimization

```python
# KV Cache はコンテキスト長に比例してメモリを消費
# 8B モデル、4096 コンテキストでの KV Cache サイズ:
# = layers * 2 (K+V) * heads * head_dim * context_len * dtype_size
# = 32 * 2 * 32 * 128 * 4096 * 2 (FP16)
# ≈ 2 GB

# vLLM の PagedAttention で効率化
# → KV Cache をページ単位で管理し、未使用部分を解放
# → メモリ効率が 2-4 倍向上

# llama.cpp での KV Cache 設定
"""
./build/bin/llama-server \
    -m model.gguf \
    -c 8192 \         # コンテキスト長 (KV Cache サイズに直結)
    --cache-type-k q8_0 \   # KV Cache の K を Q8 に量子化
    --cache-type-v q8_0 \   # KV Cache の V を Q8 に量子化
    # → KV Cache のメモリ使用量が約半分に
"""
```

### 9.3 Performance Measurement Tools

```python
import time
import statistics
from typing import Callable

def benchmark_model(
    generate_fn: Callable,
    prompts: list[str],
    warmup: int = 3,
    iterations: int = 10,
) -> dict:
    """ローカル LLM のパフォーマンスベンチマーク"""
    # ウォームアップ
    for _ in range(warmup):
        generate_fn(prompts[0])

    # 計測
    ttft_list = []  # Time to First Token
    tps_list = []   # Tokens per Second
    total_list = [] # Total Time

    for prompt in prompts[:iterations]:
        start = time.perf_counter()

        # 最初のトークンまでの時間を計測
        first_token_time = None
        total_tokens = 0

        for token in generate_fn(prompt, stream=True):
            if first_token_time is None:
                first_token_time = time.perf_counter() - start
                ttft_list.append(first_token_time)
            total_tokens += 1

        total_time = time.perf_counter() - start
        total_list.append(total_time)

        if total_tokens > 1:
            # TTFT 以降の生成速度
            gen_time = total_time - first_token_time
            tps = (total_tokens - 1) / gen_time if gen_time > 0 else 0
            tps_list.append(tps)

    return {
        "TTFT (ms)": {
            "mean": statistics.mean(ttft_list) * 1000,
            "p50": statistics.median(ttft_list) * 1000,
            "p95": sorted(ttft_list)[int(len(ttft_list) * 0.95)] * 1000,
        },
        "TPS (tok/s)": {
            "mean": statistics.mean(tps_list),
            "p50": statistics.median(tps_list),
            "min": min(tps_list),
        },
        "Total (s)": {
            "mean": statistics.mean(total_list),
            "p50": statistics.median(total_list),
        },
    }
```

---

## 10. Troubleshooting

### 10.1 Common Problems and Solutions

```python
# === Problem 1: OOM (Out of Memory) ===
# Error: "CUDA out of memory" / "Killed" (Linux OOM Killer)

# Solutions:
troubleshoot_oom = """
1. Check model size
   $ ollama show llama3.1:8b --modelfile
   → Verify VRAM requirements

2. Check GPU memory usage
   $ nvidia-smi
   → Ensure no other processes are using the GPU

3. Lower quantization level
   Q8_0 (8GB) → Q4_K_M (4.9GB) → Q3_K_M (3.9GB)

4. Reduce the number of GPU layers (CPU offload)
   llama-server -m model.gguf -ngl 20  # GPU only for some layers

5. Shorten context length
   -c 8192 → -c 4096 → -c 2048

6. Reduce batch size
   --batch-size 2048 → --batch-size 512
"""

# === Problem 2: Slow inference ===
troubleshoot_slow = """
1. Verify GPU is being used
   $ nvidia-smi  # If GPU utilization is 0%, the model is running on CPU
   → Check the -ngl parameter (-1 means all layers on GPU)

2. Check if Metal is enabled (Apple Silicon)
   $ ollama run llama3.1 --verbose 2>&1 | grep metal

3. Optimize CPU thread count
   NVIDIA GPU: --threads $(nproc)  # all cores
   Apple Silicon: --threads 1      # 1 thread may be fastest

4. Check memory mapping settings
   --mlock  # lock memory to prevent swapping
   --no-mmap  # disable memory map (for large models)

5. Enable Flash Attention
   --flash-attn  # llama.cpp server
"""

# === Problem 3: Poor output quality ===
troubleshoot_quality = """
1. Check quantization level
   Q2_K causes significant quality degradation → Q4_K_M or higher recommended

2. Verify chat template
   Ollama: check if TEMPLATE in Modelfile is correct
   llama.cpp: --chat-template parameter

3. Set system prompt
   Japanese tasks require a Japanese system prompt

4. Tune Temperature/Top-p
   For accuracy: temperature=0.1, top_p=0.9
   For creativity: temperature=0.8, top_p=0.95

5. Reconsider model selection
   Japanese → prefer Qwen 2.5
   English → Llama 3.1 is stable
"""
```

### 10.2 Debug Utilities

```python
import subprocess
import json
from typing import Optional

class LocalLLMDebugger:
    """ローカル LLM のデバッグ・診断ツール"""

    @staticmethod
    def check_gpu_status() -> dict:
        """GPU の状態を確認"""
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,utilization.gpu",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")
                gpus = []
                for line in lines:
                    parts = [p.strip() for p in line.split(",")]
                    gpus.append({
                        "name": parts[0],
                        "vram_total_mb": int(parts[1]),
                        "vram_used_mb": int(parts[2]),
                        "utilization_pct": int(parts[3]),
                    })
                return {"status": "ok", "gpus": gpus}
            return {"status": "error", "message": result.stderr}
        except FileNotFoundError:
            return {"status": "no_nvidia_gpu", "message": "nvidia-smi not found"}

    @staticmethod
    def check_ollama_status() -> dict:
        """Ollama の状態を確認"""
        try:
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                models = []
                for line in result.stdout.strip().split("\n")[1:]:  # ヘッダー除外
                    parts = line.split()
                    if parts:
                        models.append(parts[0])
                return {"status": "ok", "models": models}
            return {"status": "error", "message": result.stderr}
        except Exception as e:
            return {"status": "not_running", "message": str(e)}

    @staticmethod
    def estimate_requirements(model_size_b: float, context_length: int = 8192) -> dict:
        """モデル実行に必要なリソースを見積もり"""
        quant_options = {}
        for quant, factor in [("FP16", 2.0), ("Q8_0", 1.1), ("Q5_K_M", 0.75),
                               ("Q4_K_M", 0.65), ("Q3_K_M", 0.5)]:
            model_mem = model_size_b * factor
            # KV Cache 概算 (layer * 2 * heads * head_dim * ctx * dtype)
            kv_cache_gb = (model_size_b / 7) * 32 * 2 * 32 * 128 * context_length * 2 / 1e9
            total = model_mem + kv_cache_gb
            quant_options[quant] = {
                "model_gb": round(model_mem, 1),
                "kv_cache_gb": round(kv_cache_gb, 1),
                "total_gb": round(total, 1),
            }
        return quant_options

# 使用例
debugger = LocalLLMDebugger()

print("=== GPU 状態 ===")
print(json.dumps(debugger.check_gpu_status(), indent=2))

print("\n=== Ollama 状態 ===")
print(json.dumps(debugger.check_ollama_status(), indent=2))

print("\n=== 8B モデルの要件 ===")
reqs = debugger.estimate_requirements(8, 8192)
for quant, info in reqs.items():
    print(f"  {quant:8s}: モデル {info['model_gb']:.1f}GB + "
          f"KV Cache {info['kv_cache_gb']:.1f}GB = "
          f"合計 {info['total_gb']:.1f}GB")
```

---

## 11. Anti-patterns

### Anti-pattern 1: Forcing Execution with Insufficient GPU Memory

```bash
# NG: attempting to run a 70B model (FP16) on a 24GB GPU
# → OOM (Out of Memory) error, or extremely slow due to swapping

# OK: choose an appropriate quantization level
ollama pull llama3.1:70b-q4_0  # Q4 quantization: requires ~40GB
# alternatively: GPU-CPU split (run some layers on CPU)
llama-server -m model.gguf -ngl 30  # only 30 layers on GPU
```

### Anti-pattern 2: Expecting Cloud API-Level Quality from a Local LLM

```
# NG: "A 7B Q4 model should produce the same quality as GPT-4o"
# → A 7B Q4 model has less than 1/100th the parameter scale of GPT-4o

# OK: set appropriate expectations
# - 7B Q4: sufficient for simple Q&A, classification, and summarization
# - 70B Q4: quality comparable to GPT-3.5 Turbo
# - fine-tuning for a narrow use case can achieve high accuracy even with small models
```

### Anti-pattern 3: Deploying Without Security Considerations

```python
# NG: exposing a local LLM server publicly without authentication
"""
ollama serve  # binds to 0.0.0.0:11434 by default
# → accessible from anyone on the internet!
"""

# OK: configure authentication and network restrictions
"""
# 1. bind to localhost only
export OLLAMA_HOST=127.0.0.1:11434

# 2. add authentication via reverse proxy
# API Key authentication with nginx

# 3. restrict with firewall
ufw allow from 192.168.1.0/24 to any port 11434
ufw deny 11434
"""
```

---

## 12. FAQ

### Q1: Are local LLMs practical on Apple Silicon (M1/M2/M3)?

Fully practical. GPU acceleration works via the Metal framework, and an M2 Pro (16GB) achieves 30–40 tok/s with a 7B Q4 model; an M3 Max (48GB) achieves 15–20 tok/s with a 34B Q4 model. Ollama provides the best Apple Silicon support.

### Q2: What is the break-even point between local LLMs and API models?

Running a 7B model on an RTX 4090 (approx. ¥250,000), compared to GPT-4o mini API costs, local becomes advantageous at roughly 500,000+ requests per month (including electricity). However, factoring in operational overhead (model updates, incident response), 1 million+ requests per month is a more realistic break-even point.

### Q3: How do I run a fine-tuned model locally?

Fine-tune with LoRA/QLoRA → merge the LoRA adapter → convert to GGUF → run with Ollama. The `convert` script in `llama.cpp` handles HuggingFace format → GGUF conversion. With Ollama, you can also run models directly by specifying a HuggingFace model in a `FROM` Modelfile.

### Q4: Can multiple models run simultaneously?

With Ollama, the `OLLAMA_MAX_LOADED_MODELS` environment variable controls how many models can be loaded at once. If VRAM allows, 2–3 models can be loaded simultaneously. vLLM does not support multiple `--model` arguments, but you can run multiple instances on different ports and route traffic based on use case.

### Q5: How do I choose between GGUF and GPTQ/AWQ?

CPU inference or Apple Silicon → GGUF is the only choice. For NVIDIA GPU-only environments where maximum throughput is needed, use GPTQ/AWQ. When using vLLM, AWQ offers the best quality-speed balance. For Ollama/llama.cpp, GGUF (Q4_K_M) is the most stable option.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most critical factor. Writing actual code and verifying behavior deepens understanding far more than theory alone.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is applied frequently in day-to-day development work, especially during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|---------------|
| Personal development / evaluation | Ollama (easiest) |
| CPU inference | llama.cpp (GGUF Q4_K_M) |
| High-throughput GPU inference | vLLM (AWQ/GPTQ) |
| Apple Silicon | Ollama + GGUF |
| Recommended quantization | Q4_K_M (best quality/size balance) |
| Recommended model (Japanese) | Qwen 2.5 7B / 14B |
| Minimum hardware | 8GB RAM + 4-core CPU (7B Q4) |

---

## What to Read Next

- [03-evaluation.md](./03-evaluation.md) — Quality evaluation of local models
- [01-vector-databases.md](./01-vector-databases.md) — Fully local RAG with local LLM + vector DB
- [../01-models/03-open-source.md](../01-models/03-open-source.md) — Selecting OSS models

---

## References

1. Ollama, "Documentation," https://ollama.com/
2. Gerganov, "llama.cpp," https://github.com/ggerganov/llama.cpp
3. vLLM, "Documentation," https://docs.vllm.ai/
4. Dettmers et al., "QLoRA: Efficient Finetuning of Quantized LLMs," NeurIPS 2023
5. Lin et al., "AWQ: Activation-aware Weight Quantization," MLSys 2024
6. Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention," SOSP 2023
7. NVIDIA, "TensorRT-LLM," https://github.com/NVIDIA/TensorRT-LLM
