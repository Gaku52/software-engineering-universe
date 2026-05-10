# Open-Source LLMs — Llama, Mistral, Qwen, and the OSS Ecosystem

> Open-source LLMs are large language models whose weights are publicly released and can be freely downloaded, customized, and deployed. Led by Meta Llama, Mistral AI, and Alibaba Qwen as the three dominant forces, they are closing the performance gap against proprietary models.

## What You Will Learn

1. **Characteristics and differences of major open-source LLMs** — Design philosophy, performance, and licensing of Llama 3, Mistral/Mixtral, and Qwen 2.5
2. **Selection criteria for OSS LLMs** — Parameter size, language support, license, and fine-tuning ease
3. **Deployment and optimization for production** — Practical techniques for quantization, inference servers, and cost optimization


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Gemini — Google DeepMind's Unified Multimodal LLM](./02-gemini.md)

---

## 1. Overview of Major Open-Source LLMs

```
┌──────────────────────────────────────────────────────────┐
│            Open-Source LLM Ecosystem (2024-2025)         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Meta (Llama)          Mistral AI          Alibaba       │
│  ┌──────────┐         ┌──────────┐       ┌──────────┐   │
│  │ Llama 3  │         │ Mistral  │       │ Qwen 2.5 │   │
│  │ 8B / 70B │         │ 7B       │       │ 0.5B-72B │   │
│  │ / 405B   │         │ Mixtral  │       │ Coder    │   │
│  └──────────┘         │ 8x7B     │       │ VL / Audio│  │
│                       │ 8x22B    │       └──────────┘   │
│  Google (Gemma)       │ Large 2  │       Microsoft      │
│  ┌──────────┐         └──────────┘       ┌──────────┐   │
│  │ Gemma 2  │                            │ Phi-3/4  │   │
│  │ 2B / 9B  │         DeepSeek           │ mini/med │   │
│  │ / 27B    │         ┌──────────┐       └──────────┘   │
│  └──────────┘         │ V3 / R1  │                      │
│                       │ 671B MoE │                      │
│                       └──────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### 1.1 The Difference Between "Open Source" and "Open Weight"

```
┌──────────────────────────────────────────────────────────┐
│        Classification by Degree of Openness              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Truly Open Source                                       │
│  ├── Model weights: Public                               │
│  ├── Training code: Public                               │
│  ├── Training data: Public (or fully described)          │
│  ├── License: OSI-approved (MIT, Apache 2.0, etc.)       │
│  └── Examples: OLMo (AI2), Pythia (EleutherAI)           │
│                                                          │
│  Open Weight                                             │
│  ├── Model weights: Public                               │
│  ├── Training code: Partially public / proprietary       │
│  ├── Training data: Proprietary                          │
│  ├── License: Custom license (with usage restrictions)   │
│  └── Examples: Llama 3 (Meta), Gemma (Google)            │
│                                                          │
│  Permissive Open                                         │
│  ├── Model weights: Public                               │
│  ├── License: Apache 2.0 / MIT                           │
│  ├── Commercial use: Unrestricted                        │
│  └── Examples: Qwen 2.5 (Apache 2.0), DeepSeek (MIT)    │
│                                                          │
│  Note: "Open-source LLM" is technically open-weight in   │
│  most cases, but the industry convention calls them      │
│  "open source"                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Llama (Meta)

### 2.1 The Llama 3 Series

```python
# Using Llama 3 with Hugging Face Transformers
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_id = "meta-llama/Meta-Llama-3.1-8B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

messages = [
    {"role": "system", "content": "あなたは有能なアシスタントです。"},
    {"role": "user", "content": "Pythonのデコレータを説明してください。"},
]

input_ids = tokenizer.apply_chat_template(
    messages, return_tensors="pt"
).to(model.device)

outputs = model.generate(input_ids, max_new_tokens=512, temperature=0.7)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

### 2.2 Llama Characteristics

| Feature | Details |
|---------|---------|
| Parameters | 8B / 70B / 405B |
| Context length | 128K tokens |
| Training data | 15T+ tokens (multilingual) |
| License | Llama 3 Community License (free for under 700M monthly users) |
| Supported languages | English-focused + multilingual (moderate Japanese support) |
| Notable | 405B is among the largest OSS models, GPT-4 level |

### 2.3 Llama Architecture Details

```
┌──────────────────────────────────────────────────────────┐
│            Llama 3 Architecture Highlights               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Transformer Decoder-Only                                │
│  ├── Grouped Query Attention (GQA)                      │
│  │   └── Shared Key-Value heads reduce memory usage      │
│  ├── RoPE (Rotary Position Embeddings)                  │
│  │   └── Context length extended to 128K                │
│  ├── SwiGLU Activation                                   │
│  │   └── Better gradient flow than ReLU                 │
│  └── RMSNorm (Pre-Normalization)                        │
│      └── More compute-efficient than LayerNorm           │
│                                                          │
│  Tokenizer:                                              │
│  ├── tiktoken-based (128K vocabulary)                    │
│  ├── Significantly expanded from Llama 2's 32K           │
│  └── Improved token efficiency for multilingual text     │
│                                                          │
│  Training characteristics:                               │
│  ├── Large-scale corpus of 15T+ tokens                   │
│  ├── 405B trained on ~16K H100 GPUs                      │
│  ├── Aligned via DPO (Direct Preference Optimization)    │
│  └── Tool use and code generation enhanced via post-training│
└──────────────────────────────────────────────────────────┘
```

### 2.4 Fine-Tuning Llama with LoRA

```python
# Fine-tuning Llama 3 with LoRA
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer
from datasets import load_dataset
import torch

# Load model with 4-bit quantization
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model_id = "meta-llama/Meta-Llama-3.1-8B-Instruct"
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

# LoRA configuration
lora_config = LoraConfig(
    r=16,                        # LoRA rank
    lora_alpha=32,               # Scaling factor
    target_modules=[             # Target layers
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)

# Check trainable parameters
model.print_trainable_parameters()
# → trainable params: 41,943,040 || all params: 8,030,261,248 || 0.52%

# Prepare dataset
dataset = load_dataset("json", data_files="train_data.jsonl")

def format_instruction(example):
    return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
あなたは有能なアシスタントです。<|eot_id|><|start_header_id|>user<|end_header_id|>
{example['instruction']}<|eot_id|><|start_header_id|>assistant<|end_header_id|>
{example['output']}<|eot_id|>"""

# Run training
training_args = TrainingArguments(
    output_dir="./llama3-ft",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    warmup_ratio=0.03,
    logging_steps=10,
    save_strategy="epoch",
    bf16=True,
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    formatting_func=format_instruction,
    max_seq_length=2048,
)

trainer.train()
model.save_pretrained("./llama3-ft-lora")
```

---

## 3. Mistral AI

### 3.1 Mixtral (MoE Architecture)

```python
# Example usage of Mixtral 8x7B with vLLM
from vllm import LLM, SamplingParams

llm = LLM(
    model="mistralai/Mixtral-8x7B-Instruct-v0.1",
    tensor_parallel_size=2,  # Split across 2 GPUs
    dtype="bfloat16",
)

sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=1024,
)

outputs = llm.generate(
    ["Rustの所有権システムを解説してください。"],
    sampling_params,
)

for output in outputs:
    print(output.outputs[0].text)
```

### 3.2 Mistral Model Lineup

```
┌─────────────────────────────────────────────────┐
│          Mistral AI Model Family                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Dense Models:                                  │
│  ┌─────────────┐  ┌─────────────┐              │
│  │ Mistral 7B  │  │ Mistral     │              │
│  │ (2023/09)   │  │ Large 2     │              │
│  │ 7.3B params │  │ (2024/07)   │              │
│  └─────────────┘  │ 123B params │              │
│                    └─────────────┘              │
│  MoE Models:                                    │
│  ┌─────────────┐  ┌─────────────┐              │
│  │ Mixtral     │  │ Mixtral     │              │
│  │ 8x7B       │  │ 8x22B      │              │
│  │ (2023/12)   │  │ (2024/04)   │              │
│  │ 46.7B total │  │ 176B total  │              │
│  │ 12.9B act.  │  │ 39B active  │              │
│  └─────────────┘  └─────────────┘              │
│                                                 │
│  Special Purpose:                               │
│  ┌─────────────┐  ┌─────────────┐              │
│  │ Codestral   │  │ Mistral     │              │
│  │ (Code)      │  │ Nemo (12B)  │              │
│  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────┘
```

### 3.3 MoE (Mixture of Experts) Architecture Explained

```
┌──────────────────────────────────────────────────────────┐
│            How MoE (Mixture of Experts) Works            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Standard Transformer:                                   │
│  Input → Attention → FFN (all params used) → Output      │
│  └── Compute cost: O(total parameter count)              │
│                                                          │
│  MoE Transformer:                                        │
│  Input → Attention → Router → Only 2 experts active → Output│
│                      │                                   │
│                      ├── Expert 1: ✗ (inactive)          │
│                      ├── Expert 2: ✓ (active)            │
│                      ├── Expert 3: ✗                     │
│                      ├── Expert 4: ✗                     │
│                      ├── Expert 5: ✓ (active)            │
│                      ├── Expert 6: ✗                     │
│                      ├── Expert 7: ✗                     │
│                      └── Expert 8: ✗                     │
│                                                          │
│  Mixtral 8x7B breakdown:                                 │
│  ├── Total parameters: 46.7B (8 experts × ~5B + shared)  │
│  ├── Active parameters: 12.9B (only 2 experts)           │
│  ├── Inference speed: equivalent to 12.9B (~2x vs 7B Dense)│
│  ├── Quality: comparable to 70B Dense models             │
│  └── Benefit: high quality + low inference cost          │
│                                                          │
│  Router training:                                        │
│  ├── Load Balancing Loss ensures uniform expert usage    │
│  ├── Selects top-k experts (typically k=2)               │
│  └── Weighted combination via softmax                    │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Using the Mistral API

```python
# Mistral API (OpenAI-compatible format)
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_MISTRAL_API_KEY",
    base_url="https://api.mistral.ai/v1",
)

response = client.chat.completions.create(
    model="mistral-large-latest",
    messages=[
        {"role": "system", "content": "あなたはプログラミングの専門家です。"},
        {"role": "user", "content": "Go言語のgoroutineとチャネルの使い方を教えてください。"},
    ],
    temperature=0.7,
    max_tokens=2048,
)

print(response.choices[0].message.content)

# Function Calling is also supported
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_price",
            "description": "株価を取得します",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "銘柄コード"},
                },
                "required": ["symbol"],
            },
        },
    }
]

response = client.chat.completions.create(
    model="mistral-large-latest",
    messages=[{"role": "user", "content": "Appleの株価を教えて"}],
    tools=tools,
    tool_choice="auto",
)
```

---

## 4. Qwen (Alibaba Cloud)

### 4.1 Using Qwen 2.5

```python
# Qwen 2.5 — OSS model with strong Japanese performance
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen2.5-7B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto",
)

messages = [
    {"role": "system", "content": "あなたは日本語に堪能なアシスタントです。"},
    {"role": "user", "content": "日本の四季について俳句を3つ作ってください。"},
]

text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer([text], return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=256)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

### 4.2 Notable Features of Qwen

- **Extremely strong Japanese and Chinese performance** (top-class among CJK language models)
- Wide range of size variants (0.5B / 1.5B / 3B / 7B / 14B / 32B / 72B)
- Qwen2.5-Coder: code-specialized model
- Qwen-VL: vision-language model
- Apache 2.0 license (maximum permissiveness)

### 4.3 Using Qwen Multimodal Models

```python
# Using Qwen-VL (Vision-Language)
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
from PIL import Image
import torch

model = Qwen2VLForConditionalGeneration.from_pretrained(
    "Qwen/Qwen2-VL-7B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
processor = AutoProcessor.from_pretrained("Qwen/Qwen2-VL-7B-Instruct")

# Prompt with image
image = Image.open("diagram.png")
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": "この図を詳しく説明してください。"},
        ],
    }
]

text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = processor(text=text, images=[image], return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=512)
print(processor.decode(outputs[0], skip_special_tokens=True))
```

### 4.4 Code Generation with Qwen2.5-Coder

```python
# Qwen2.5-Coder — code generation specialized model
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen2.5-Coder-7B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name, torch_dtype="auto", device_map="auto"
)

messages = [
    {"role": "system", "content": "あなたは熟練のソフトウェアエンジニアです。"},
    {"role": "user", "content": """
以下の要件でPythonのクラスを実装してください:
- 名前: AsyncRateLimiter
- Token Bucket アルゴリズムによるレート制限
- asyncio 対応
- 設定可能なレート (リクエスト/秒) とバースト数
"""},
]

text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer([text], return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=2048, temperature=0.2)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

---

## 5. DeepSeek

### 5.1 DeepSeek-R1 (Reasoning-Specialized)

```python
# DeepSeek-R1 outputs its reasoning process explicitly
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_KEY",
    base_url="https://api.deepseek.com"
)

response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=[
        {"role": "user", "content": "271は素数ですか？証明してください。"}
    ]
)

# reasoning_content contains the chain-of-thought
print("思考過程:", response.choices[0].message.reasoning_content)
print("最終回答:", response.choices[0].message.content)
```

### 5.2 Technical Highlights of DeepSeek-V3

```
┌──────────────────────────────────────────────────────────┐
│            DeepSeek-V3 Technical Details                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Architecture: MoE (Mixture of Experts)                  │
│  ├── Total parameters: 671B                              │
│  ├── Active parameters: 37B (per token)                  │
│  ├── Number of experts: 256 (8 activated per token)      │
│  └── Shared expert: 1 (always active for all tokens)     │
│                                                          │
│  Innovations:                                            │
│  ├── Multi-head Latent Attention (MLA)                   │
│  │   └── Compresses KV cache for improved inference      │
│  ├── FP8 mixed-precision training                        │
│  │   └── Dramatically reduced training cost ($5.5M)      │
│  └── Auxiliary-loss-free expert routing                  │
│      └── Novel approach eliminating auxiliary loss       │
│                                                          │
│  Performance:                                            │
│  ├── MMLU: 87.1 (on par with GPT-4o)                    │
│  ├── MATH: 90.2 (surpasses GPT-4o on math)              │
│  ├── Cost: $0.27/1M input, $1.10/1M output (very cheap)  │
│  └── API: available in OpenAI-compatible format          │
│                                                          │
│  DeepSeek-R1:                                            │
│  ├── Reasoning-specialized model (o1 competitor)         │
│  ├── Outputs Chain-of-Thought explicitly                 │
│  ├── Distilled versions: 1.5B / 7B / 8B / 14B / 32B / 70B│
│  └── MIT license (fully permissive)                      │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Running DeepSeek-R1 Distilled Models Locally

```python
# Running a distilled DeepSeek-R1 locally via Ollama
import subprocess
import requests

# Download and run model with Ollama
# $ ollama pull deepseek-r1:7b

# Use via API
response = requests.post(
    "http://localhost:11434/api/chat",
    json={
        "model": "deepseek-r1:7b",
        "messages": [
            {"role": "user", "content": "フィボナッチ数列の第100項を求めるアルゴリズムを説明してください。"}
        ],
        "stream": False,
    },
)

result = response.json()
print(result["message"]["content"])
```

---

## 6. Other Notable OSS Models

### 6.1 Gemma (Google)

```python
# Gemma 2 — Google's lightweight, high-performance model
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained(
    "google/gemma-2-9b-it",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-9b-it")

# Gemma 2 highlights:
# - Compressed via Knowledge Distillation
# - Alternates between Sliding Window Attention and Global Attention
# - Size variants: 2B / 9B / 27B
# - Gemma License (research and commercial use allowed; license must be included on redistribution)
```

### 6.2 Phi (Microsoft)

```python
# Phi-3/4 — Microsoft's compact, high-performance models
# Phi-3 Mini (3.8B) achieves top-class performance for its size

from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Phi-3-mini-4k-instruct",
    torch_dtype="auto",
    device_map="auto",
    trust_remote_code=True,
)

# Phi highlights:
# - Trained on high-quality "textbook-level" data
# - Outperforms GPT-3.5 despite small size
# - MIT license
# - 128K context version also available
# - Phi-4 (14B) claims performance on par with Qwen 2.5 72B
```

### 6.3 Japanese-Specialized Models

```
┌──────────────────────────────────────────────────────────┐
│          Japanese-Specialized / Japanese-Enhanced OSS    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  CyberAgent CALM3 (68B)                                  │
│  ├── Developed by CyberAgent                             │
│  ├── Apache 2.0 license                                  │
│  ├── Additional pre-training on Japanese corpora         │
│  └── High performance on Japanese benchmarks (JGLUE)     │
│                                                          │
│  ELYZA Llama Japanese Series                             │
│  ├── Llama base with Japanese fine-tuning                │
│  ├── Evaluated on ELYZA-tasks-100                        │
│  └── Relatively small and practical                      │
│                                                          │
│  PLaMo (Preferred Networks)                              │
│  ├── Full-scratch LLM from Japan                         │
│  ├── Bilingual training in Japanese and English          │
│  └── Primarily for research use                          │
│                                                          │
│  Swallow (Tokyo Tech + AIST)                             │
│  ├── Continued pre-training on Japanese from Llama       │
│  ├── 7B / 13B / 70B                                      │
│  └── Strong performance on Japanese benchmarks           │
│                                                          │
│  Tanuki (Matsuo Lab)                                     │
│  ├── Trained on Japanese web corpora                     │
│  └── Released for research purposes                      │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Model Comparison Tables

### 7.1 Performance and Specs Comparison

| Model | Parameters | MoE | Context | Japanese | License |
|-------|-----------|-----|---------|----------|---------|
| Llama 3.1 405B | 405B | No | 128K | Medium | Community |
| Llama 3.1 70B | 70B | No | 128K | Medium | Community |
| Mixtral 8x22B | 176B/39B active | Yes | 64K | Medium | Apache 2.0 |
| Qwen 2.5 72B | 72B | No | 128K | High | Apache 2.0 |
| DeepSeek-V3 | 671B/37B active | Yes | 128K | Medium | MIT |
| Gemma 2 27B | 27B | No | 8K | Low | Gemma License |
| Phi-3 Medium | 14B | No | 128K | Low | MIT |

### 7.2 Use-Case Recommendations

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Japanese chatbot | Qwen 2.5 (7B-72B) | Best Japanese performance |
| Code generation | DeepSeek-Coder / Qwen-Coder | Code-specialized training |
| Math and reasoning | DeepSeek-R1 | Specialized Chain-of-Thought reasoning |
| Edge devices | Phi-3 mini / Gemma 2B | Lightweight yet high-performing |
| General / highest accuracy | Llama 3.1 405B | Largest OSS parameter count |
| Cost optimization | Mixtral 8x7B | Low inference cost via MoE |

### 7.3 VRAM Requirements and Hardware Selection

| Model Size | FP16 | INT8 | INT4 (GPTQ/AWQ) | Recommended GPU |
|-----------|------|------|-----------------|----------------|
| 3B | 6GB | 3GB | 2GB | RTX 3060 12GB |
| 7-8B | 16GB | 8GB | 4GB | RTX 4070 12GB |
| 14B | 28GB | 14GB | 8GB | RTX 4090 24GB |
| 32B | 64GB | 32GB | 16GB | A100 40GB |
| 70B | 140GB | 70GB | 35GB | 2×A100 80GB |
| 405B | 810GB | 405GB | 200GB | 8×A100 80GB |

---

## 8. Production Deployment

### 8.1 Optimization via Quantization

```python
# Using a GPTQ-quantized model
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-3-8B-Instruct-GPTQ",
    device_map="auto",
    trust_remote_code=True,
)

# Memory usage comparison
# FP16:  8B model → ~16GB VRAM
# INT8:  8B model → ~8GB VRAM
# INT4:  8B model → ~4GB VRAM (GPTQ/AWQ)
# GGUF:  8B model → ~4-6GB (llama.cpp, CPU-compatible)
```

### 8.2 Inference Server Selection and Setup

```python
# vLLM — high-performance inference server
# $ pip install vllm
# $ vllm serve meta-llama/Meta-Llama-3.1-8B-Instruct --port 8000

from openai import OpenAI

# vLLM provides an OpenAI-compatible API
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="dummy",  # Dummy key is fine for vLLM
)

response = client.chat.completions.create(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    messages=[
        {"role": "user", "content": "Hello!"},
    ],
    max_tokens=256,
)
print(response.choices[0].message.content)
```

```
┌──────────────────────────────────────────────────────────┐
│          Inference Server Comparison                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  vLLM:                                                   │
│  ├── Best memory efficiency via PagedAttention           │
│  ├── Maximum throughput via Continuous Batching          │
│  ├── OpenAI-compatible API                               │
│  ├── Tensor/Pipeline Parallelism support                 │
│  └── Recommended for: production server workloads        │
│                                                          │
│  Text Generation Inference (TGI):                        │
│  ├── Official Hugging Face solution                      │
│  ├── Easy deployment via Docker container                │
│  ├── Flash Attention 2 support                           │
│  └── Recommended for: HF ecosystem users                 │
│                                                          │
│  Ollama:                                                 │
│  ├── Single-command startup (ollama run llama3.1)        │
│  ├── GGUF format supports both CPU and GPU               │
│  ├── macOS / Linux / Windows compatible                  │
│  └── Recommended for: local development and prototyping  │
│                                                          │
│  llama.cpp:                                              │
│  ├── C/C++ implementation with minimal dependencies      │
│  ├── Optimized for CPU inference (AVX, ARM NEON)         │
│  ├── Apple Silicon (Metal) support                       │
│  └── Recommended for: edge / embedded / CPU environments │
│                                                          │
│  Throughput comparison (8B model, A100):                 │
│  ├── vLLM:    ~2000 tokens/s                             │
│  ├── TGI:     ~1500 tokens/s                             │
│  ├── Ollama:  ~100 tokens/s (GPU)                        │
│  └── llama.cpp: ~30 tokens/s (CPU)                       │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Production Deployment with Docker

```dockerfile
# Dockerfile for production deployment with vLLM
FROM vllm/vllm-openai:latest

# Download model (pre-download is also supported)
ENV MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
ENV MAX_MODEL_LEN=8192
ENV GPU_MEMORY_UTILIZATION=0.9

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python", "-m", "vllm.entrypoints.openai.api_server", \
     "--model", "${MODEL_NAME}", \
     "--max-model-len", "${MAX_MODEL_LEN}", \
     "--gpu-memory-utilization", "${GPU_MEMORY_UTILIZATION}", \
     "--host", "0.0.0.0", \
     "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  llm-server:
    image: vllm/vllm-openai:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    ports:
      - "8000:8000"
    environment:
      - HUGGING_FACE_HUB_TOKEN=${HF_TOKEN}
    command: >
      python -m vllm.entrypoints.openai.api_server
      --model Qwen/Qwen2.5-7B-Instruct
      --max-model-len 8192
      --host 0.0.0.0
      --port 8000
    volumes:
      - model-cache:/root/.cache/huggingface

volumes:
  model-cache:
```

---

## 9. Troubleshooting

### 9.1 Common Issues and Solutions

```
┌──────────────────────────────────────────────────────────┐
│          OSS LLM Deployment Troubleshooting              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue 1: CUDA Out of Memory                             │
│  ├── Cause: Model does not fit in GPU memory             │
│  ├── Solution 1: Use a quantized model (GPTQ/AWQ/GGUF)   │
│  ├── Solution 2: Lower gpu_memory_utilization (e.g. 0.8) │
│  ├── Solution 3: Reduce max_model_len                    │
│  └── Solution 4: Increase tensor_parallel_size (multi-GPU)│
│                                                          │
│  Issue 2: Model download is slow or fails                │
│  ├── Cause: HuggingFace Hub bandwidth limits             │
│  ├── Solution 1: Set HF_TOKEN to access gated models     │
│  ├── Solution 2: Pre-fetch with huggingface-cli download  │
│  └── Solution 3: Use a mirror (e.g. hf-mirror.com)       │
│                                                          │
│  Issue 3: Slow inference speed                           │
│  ├── Cause 1: Flash Attention not enabled                │
│  │   └── Install with: pip install flash-attn            │
│  ├── Cause 2: Batch size too small                       │
│  │   └── Increase max_num_seqs                           │
│  └── Cause 3: Insufficient KV cache                      │
│      └── Adjust block_size                               │
│                                                          │
│  Issue 4: Poor output quality (English good, Japanese bad)│
│  ├── Cause: Insufficient Japanese training data          │
│  ├── Solution 1: Switch to a Japanese-capable model (Qwen 2.5)│
│  ├── Solution 2: Fine-tune on Japanese data              │
│  └── Solution 3: Explicitly specify "respond in Japanese" in System Prompt│
│                                                          │
│  Issue 5: Risk of license violation                      │
│  ├── Llama: Contact required above 700M monthly MAU      │
│  ├── Gemma: Must include license on redistribution       │
│  └── Safe choice: Select Apache 2.0 / MIT models         │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Running Performance Benchmarks

```python
# Inference performance benchmark in your own environment
import time
import statistics
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="dummy")

def benchmark_model(
    model: str,
    prompts: list[str],
    max_tokens: int = 256,
    num_runs: int = 3,
) -> dict:
    """Benchmark inference performance"""
    latencies = []
    throughputs = []

    for prompt in prompts:
        for _ in range(num_runs):
            start = time.time()
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
            )
            elapsed = time.time() - start

            output_tokens = response.usage.completion_tokens
            latencies.append(elapsed)
            throughputs.append(output_tokens / elapsed)

    return {
        "model": model,
        "avg_latency_ms": statistics.mean(latencies) * 1000,
        "p50_latency_ms": statistics.median(latencies) * 1000,
        "p95_latency_ms": sorted(latencies)[int(len(latencies) * 0.95)] * 1000,
        "avg_throughput_tps": statistics.mean(throughputs),
        "total_requests": len(latencies),
    }

# Run benchmark
test_prompts = [
    "Pythonでバブルソートを実装してください。",
    "機械学習とディープラーニングの違いを説明してください。",
    "日本の歴史について500文字程度で要約してください。",
]

result = benchmark_model("Qwen/Qwen2.5-7B-Instruct", test_prompts)
print(f"Average latency: {result['avg_latency_ms']:.0f}ms")
print(f"P95 latency: {result['p95_latency_ms']:.0f}ms")
print(f"Average throughput: {result['avg_throughput_tps']:.1f} tokens/s")
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Commercial Use Without License Verification

```
# BAD: Integrating into a commercial product without checking the license

Llama 3 Community License:
  → Contact with Meta required if monthly active users exceed 700 million
  → Prohibits using outputs to train other LLMs

Gemma License:
  → License terms must be included when redistributing

# GOOD: Choose Apache 2.0 licensed models
Qwen 2.5, Mixtral → No restrictions on commercial use
DeepSeek → MIT license, most permissive
```

### Anti-Pattern 2: Selecting Models Based on Size Alone

```
# BAD: The naive assumption that "bigger is always better"
model = "llama-3.1-405b"  # Requires 16 A100 GPUs...

# GOOD: Choose based on task characteristics
# Classification and extraction → 7B-8B is often sufficient
# Creative writing → 70B class is effective
# Fine-tuning → Smaller models are more practical
# Cost-sensitive → MoE models (Mixtral) are advantageous
```

### Anti-Pattern 3: Deploying Without Quantization

```python
# BAD: Running large models in FP16 in production
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3.1-70B-Instruct",
    torch_dtype=torch.float16,  # Requires 140GB VRAM
)

# GOOD: Apply quantization appropriate for your use case
# Quality-focused → INT8 (AWQ): 1-2% quality drop, half the memory
# Cost-focused → INT4 (GPTQ): 3-5% quality drop, 1/4 memory
# CPU inference → GGUF Q4_K_M: run on CPU via llama.cpp
```

### Anti-Pattern 4: Exposing the LLM API Without Security Measures

```python
# BAD: Publishing LLM API without authentication
# vllm serve model --host 0.0.0.0  # Anyone on the internet can access

# GOOD: Proper authentication, rate limiting, and prompt injection defenses
# 1. Add authentication via a reverse proxy (nginx)
# 2. Access control via API keys
# 3. Rate limiting (requests per second)
# 4. Input length limits
# 5. Output filtering (harmful content detection)
```

---

## 11. Best Practices

### 11.1 Model Selection Checklist

```
┌──────────────────────────────────────────────────────────┐
│          OSS LLM Selection Checklist                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  □ License verification                                  │
│    ├── Is commercial use allowed?                        │
│    ├── What are the redistribution conditions?           │
│    └── Are there restrictions on output usage?           │
│                                                          │
│  □ Performance requirements                              │
│    ├── Quality in target language (Qwen for Japanese)    │
│    ├── Required inference speed (tokens/s)               │
│    └── Acceptable quality degradation (quantization impact)│
│                                                          │
│  □ Infrastructure requirements                           │
│    ├── Available GPU / memory                            │
│    ├── Scalability requirements                          │
│    └── Availability and redundancy requirements          │
│                                                          │
│  □ Operational requirements                              │
│    ├── Model update frequency and procedure              │
│    ├── Monitoring and alerting                           │
│    └── Recovery procedures on failure                    │
│                                                          │
│  □ Security requirements                                 │
│    ├── Data must not leave the premises                  │
│    ├── Prompt injection countermeasures                  │
│    └── Output filtering requirements                     │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Phased Adoption Strategy

```
Phase 1: Evaluation (1-2 weeks)
├── Evaluate 3-5 candidate models locally with Ollama
├── Compare quality with an in-house evaluation dataset (50-100 questions)
└── Compare quality and speed at each quantization level (FP16/INT8/INT4)

Phase 2: Prototype (2-4 weeks)
├── Build inference server with vLLM/TGI
├── Integration testing with existing applications
└── Load testing and latency measurement

Phase 3: Production Deployment (2-4 weeks)
├── Containerize with Docker/Kubernetes
├── Set up monitoring and logging
├── Configure auto-scaling
└── Fallback strategy (switch to API-based model)

Phase 4: Operations and Improvement (ongoing)
├── Quality monitoring (LLM-as-a-Judge)
├── Consider fine-tuning
├── Evaluation pipeline for model updates
└── Cost optimization (quantization tuning, batch optimization)
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for a basic implementation pattern"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("入力値がNoneです")
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation by adding the following functionality.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for an advanced pattern"""

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
    print("応用テスト全合格!")

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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the impact with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes criteria for making technology choices.

| Criterion | When to prioritize | When to deprioritize |
|----------|--------------------|----------------------|
| Performance | Real-time processing, large-scale data | Admin UI, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow         │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2                     │
│                                                 │
│  2. How frequent are deployments?               │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. How independent are teams?                  │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A fast short-term solution can become technical debt in the long run
- Conversely, over-engineering raises short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified tech stack lowers learning costs
- Adopting diverse technologies enables best-fit choices, but increases operational costs

**3. Level of abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is intuitive but tends to cause code duplication

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
        """Describe background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
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
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 12. FAQ

### Q1: How should I choose between open-source LLMs and API-based models?

Self-deploying an OSS model is advantageous when data privacy is important, when latency requirements are strict, or when you want to optimize costs for high-volume inference.
On the other hand, API-based models are appropriate when you want access to the latest models at all times or want to avoid managing infrastructure.
A hybrid setup (OSS for sensitive data, API for everything else) is also a valid strategy.

### Q2: What parameter size is best for fine-tuning?

Generally, the 7B-14B range offers the best cost-performance ratio.
With LoRA/QLoRA, fine-tuning a 7B model is possible on consumer-grade GPUs (RTX 4090 / 24GB).
70B and above require multiple GPUs, and fine-tuning costs increase dramatically.

### Q3: What is the best OSS model for Japanese tasks?

As of 2025, the Qwen 2.5 series offers top-class Japanese performance.
For Japan-origin models, CyberAgent's CALM3, Preferred Networks' PLaMo, and ELYZA's Llama Japanese fine-tunes are notable options.
For limited use cases, a Japanese-specialized small model can outperform a large general-purpose model.

### Q4: How close are OSS models to proprietary models in quality?

DeepSeek-V3 and Llama 3.1 405B achieve benchmark scores nearly equivalent to GPT-4o.
For specific tasks (math: DeepSeek-R1 matches o1; code: Qwen-Coder excels), OSS models can surpass proprietary ones.
However, there remains a gap in overall instruction-following, safety, and hallucination control.

### Q5: Should I choose a MoE model or a Dense model?

If you prioritize inference cost, choose MoE (Mixtral, DeepSeek-V3). Equivalent quality with fewer inference FLOPs.
If you prioritize ease of fine-tuning, choose Dense (Llama, Qwen). Fine-tuning MoE models requires balancing across experts, and there is less established know-how.
Dense models also have the advantage of simpler deployment (MoE requires memory for all parameters).

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| Three major forces | Meta Llama, Mistral AI, Alibaba Qwen |
| Notable models | DeepSeek-R1 (reasoning), Phi-3 (lightweight) |
| Largest models | Llama 3.1 405B (Dense), DeepSeek-V3 671B (MoE) |
| Best for Japanese | Qwen 2.5 series |
| Cost-optimized | MoE models (Mixtral, DeepSeek-V3) |
| Recommended license | Apache 2.0 (Qwen, Mixtral) / MIT (DeepSeek) |
| Deployment options | vLLM, TGI, Ollama, llama.cpp |
| Recommended size for fine-tuning | 7B-14B (LoRA/QLoRA on consumer GPU) |

---

## What to Read Next

- [04-model-comparison.md](./04-model-comparison.md) — Cross-model benchmark comparison
- [../../03-infrastructure/02-local-llm.md](../03-infrastructure/02-local-llm.md) — Practical local LLM deployment
- [../../03-infrastructure/03-evaluation.md](../03-infrastructure/03-evaluation.md) — LLM evaluation methods

---

## References

1. Dubey et al., "The Llama 3 Herd of Models," arXiv:2407.21783, 2024
2. Jiang et al., "Mixtral of Experts," arXiv:2401.04088, 2024
3. Qwen Team, "Qwen2.5 Technical Report," arXiv:2412.15115, 2024
4. DeepSeek-AI, "DeepSeek-V3 Technical Report," arXiv:2412.19437, 2024
5. Hugging Face, "Open LLM Leaderboard," https://huggingface.co/spaces/open-llm-leaderboard
6. Abdin et al., "Phi-3 Technical Report," arXiv:2404.14219, 2024
7. Gemma Team, "Gemma 2: Improving Open Language Models at a Practical Size," arXiv:2408.00118, 2024
