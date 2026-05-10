# Fine-Tuning — Techniques for Specializing Models to Specific Tasks

> A practical guide to the key methods for optimizing LLMs with your own data and tasks, including LoRA, QLoRA, RLHF, and DPO.

## What You Will Learn

1. How **LoRA / QLoRA** efficiently adjusts parameters and how to implement it
2. The principles and selection criteria for **RLHF and DPO** alignment methods
3. Practical fine-tuning **workflows and evaluation approaches**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Inference — Parameters and Techniques for Controlling LLM Output](./02-inference.md)

---

## 1. LoRA (Low-Rank Adaptation)

### ASCII Diagram 1: How LoRA Works

```
Standard Fine-Tuning:
┌─────────────┐
│ All params W  │  ← All updated (billions of parameters)
│  (d × d)     │     Massive GPU memory consumption
└─────────────┘

LoRA:
┌─────────────┐
│ Original W   │  ← Frozen (not updated)
│  (d × d)     │
└──────┬──────┘
       │
       + (addition)
       │
┌──────┴──────┐
│  ΔW = B × A  │  ← Only low-rank matrices updated
│              │
│ B: (d × r)   │  r << d (e.g., r=8, d=4096)
│ A: (r × d)   │
│              │  Parameter count: 2 × d × r
│ e.g.: 2×4096×8│  = 65,536 (less than 0.01% of original)
└─────────────┘
```

### Code Example 1: Fine-Tuning with LoRA (PEFT)

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from trl import SFTTrainer

# Load base model
model_name = "meta-llama/Llama-3.1-8B-Instruct"
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# LoRA configuration
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                          # Rank (8-64 is typical)
    lora_alpha=32,                 # Scaling factor
    lora_dropout=0.05,             # Dropout rate
    target_modules=[               # Layers to apply LoRA to
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
)

# Apply LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 41,943,040 || all params: 8,072,204,288 || trainable%: 0.52%
```

### Code Example 2: QLoRA (4-bit Quantization + LoRA)

```python
from transformers import BitsAndBytesConfig
import torch

# 4-bit quantization configuration
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",        # NormalFloat4
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,    # Double quantization
)

# QLoRA: 4-bit quantized model + LoRA
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=bnb_config,
    device_map="auto",
)

# Apply LoRA (same configuration as above)
model = get_peft_model(model, lora_config)
# VRAM: 70B → ~40GB (QLoRA) vs ~140GB (full precision)
```

### ASCII Diagram 2: GPU Memory Comparison by Fine-Tuning Method

```
GPU VRAM Usage (for Llama 3.1 8B)

Full FT:     ████████████████████████████████████  ~60GB
             All params updated + gradients + optimizer

LoRA (fp16): ████████████████████░░░░░░░░░░░░░░░  ~20GB
             Model (fp16) + LoRA gradients only

QLoRA (4bit):████████████░░░░░░░░░░░░░░░░░░░░░░░  ~8GB
             Model (4bit) + LoRA gradients (bf16)

Inference:   ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  ~5GB
             Model (4bit) only

             0    10   20   30   40   50   60 GB
```

---

## 2. Advanced LoRA Design and Optimization

### 2.1 Effect of LoRA Hyperparameters

```
┌──────────────────────────────────────────────────────────┐
│         LoRA Hyperparameter Design Space                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  r (rank):                                               │
│  ─────────                                               │
│  Small (4-8)      → Fewer params, lightweight, less overfitting  │
│  Medium (16-32)   → General recommendation, good balance │
│  Large (64-128)   → High expressiveness, overfitting risk, more memory │
│                                                          │
│  lora_alpha (scaling):                                   │
│  ─────────────────────                                   │
│  ΔW contribution = (lora_alpha / r) × B × A             │
│  → alpha/r ratio determines effective learning rate scale│
│  → Typically alpha = 2 × r (e.g., r=16, alpha=32)       │
│  → Too large alpha causes unstable training              │
│                                                          │
│  target_modules:                                          │
│  ──────────────                                          │
│  q_proj, v_proj only    → Minimal config, lightweight    │
│  + k_proj, o_proj       → Standard config                │
│  + gate/up/down_proj    → Full attention+FFN (recommended)│
│  + embed/lm_head        → Maximum config (rarely used)   │
│                                                          │
│  lora_dropout:                                            │
│  ────────────                                            │
│  0.0    → No dropout (when data volume is large)         │
│  0.05   → Light regularization (recommended default)     │
│  0.1+   → Strong regularization (for small datasets)     │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Experiments on Selecting target_modules

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM

# Comparison of different target_modules configurations
configs = {
    "minimal": {
        "target_modules": ["q_proj", "v_proj"],
        "r": 16,
        "lora_alpha": 32,
    },
    "standard": {
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
        "r": 16,
        "lora_alpha": 32,
    },
    "full": {
        "target_modules": [
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        "r": 16,
        "lora_alpha": 32,
    },
}

for name, config_params in configs.items():
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        lora_dropout=0.05,
        **config_params,
    )

    model = AutoModelForCausalLM.from_pretrained(
        "meta-llama/Llama-3.1-8B-Instruct",
        torch_dtype="auto",
        device_map="auto",
    )
    model = get_peft_model(model, lora_config)

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    print(f"{name:10s}: trainable={trainable:>12,} ({trainable/total:.2%})")

# Example output:
# minimal   : trainable=  13,107,200 (0.16%)
# standard  : trainable=  26,214,400 (0.32%)
# full      : trainable=  41,943,040 (0.52%)
```

### 2.3 Mathematical Background of LoRA

```python
import torch
import torch.nn as nn

class LoRALayer(nn.Module):
    """Educational implementation of a LoRA layer"""

    def __init__(
        self,
        original_layer: nn.Linear,
        r: int = 16,
        alpha: float = 32.0,
        dropout: float = 0.05,
    ):
        super().__init__()
        self.original = original_layer
        self.r = r
        self.alpha = alpha
        self.scaling = alpha / r

        # Freeze original weights
        for param in self.original.parameters():
            param.requires_grad = False

        in_dim = original_layer.in_features
        out_dim = original_layer.out_features

        # Low-rank matrices A and B
        self.lora_A = nn.Linear(in_dim, r, bias=False)
        self.lora_B = nn.Linear(r, out_dim, bias=False)
        self.dropout = nn.Dropout(dropout)

        # A is randomly initialized, B is zero-initialized
        # → At training start, ΔW = 0 (identical to original model)
        nn.init.kaiming_uniform_(self.lora_A.weight)
        nn.init.zeros_(self.lora_B.weight)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Original output + LoRA low-rank approximation
        original_output = self.original(x)
        lora_output = self.lora_B(self.lora_A(self.dropout(x)))
        return original_output + self.scaling * lora_output

    def merge_weights(self):
        """Merge LoRA weights into original weights at inference time (speeds up inference)"""
        delta_w = self.scaling * (self.lora_B.weight @ self.lora_A.weight)
        self.original.weight.data += delta_w
        return self.original


# Usage example
linear = nn.Linear(4096, 4096)
lora_linear = LoRALayer(linear, r=16, alpha=32)

# Number of trainable parameters
trainable = sum(p.numel() for p in lora_linear.parameters() if p.requires_grad)
total = sum(p.numel() for p in lora_linear.parameters())
print(f"Trainable: {trainable:,} / {total:,} ({trainable/total:.4%})")
# Trainable: 131,072 / 16,908,288 (0.7754%)
```

---

## 3. Complete SFT (Supervised Fine-Tuning) Workflow

### 3.1 Dataset Preparation

```python
from datasets import Dataset, load_dataset
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")

# Method 1: Create from local data
raw_data = [
    {
        "instruction": "Please fix the bug in the following Python code.",
        "input": "def add(a, b):\n    return a - b",
        "output": "def add(a, b):\n    return a + b\n\n# Fix: changed subtraction(-) to addition(+)."
    },
    {
        "instruction": "Please optimize this SQL query.",
        "input": "SELECT * FROM users WHERE name LIKE '%Tanaka%'",
        "output": (
            "SELECT id, name, email FROM users WHERE name LIKE '%Tanaka%'\n\n"
            "-- Improvements:\n"
            "-- 1. Replaced SELECT * with specific columns\n"
            "-- 2. LIKE with prefix wildcard allows index use, but middle wildcard causes full scan"
        )
    },
    # ... hundreds to thousands of examples
]

# Convert to chat template format
def format_chat(example):
    messages = [
        {"role": "system", "content": "You are an excellent programming assistant."},
        {"role": "user", "content": f"{example['instruction']}\n\n{example['input']}"},
        {"role": "assistant", "content": example["output"]},
    ]
    return {"text": tokenizer.apply_chat_template(messages, tokenize=False)}

dataset = Dataset.from_list(raw_data).map(format_chat)

# Method 2: Load from Hugging Face Hub
dataset_hf = load_dataset("kunishou/databricks-dolly-15k-ja")


# Method 3: From a JSONL file
import json

def load_jsonl(filepath: str) -> Dataset:
    data = []
    with open(filepath) as f:
        for line in f:
            data.append(json.loads(line))
    return Dataset.from_list(data)
```

### 3.2 Training with SFTTrainer

```python
from peft import LoraConfig, TaskType
from transformers import (
    AutoModelForCausalLM, AutoTokenizer,
    TrainingArguments, BitsAndBytesConfig,
)
from trl import SFTTrainer, SFTConfig
import torch

# Model and tokenizer
model_name = "meta-llama/Llama-3.1-8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token

# Quantization config for QLoRA
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto",
    attn_implementation="flash_attention_2",  # Flash Attention 2
)

# LoRA configuration
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
)

# Training configuration
training_args = SFTConfig(
    output_dir="./output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    gradient_accumulation_steps=4,     # Effective batch size = 4 × 4 = 16
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    weight_decay=0.01,
    bf16=True,
    logging_steps=10,
    save_steps=100,
    eval_steps=100,
    eval_strategy="steps",
    save_total_limit=3,
    load_best_model_at_end=True,
    max_seq_length=2048,
    dataset_text_field="text",
    gradient_checkpointing=True,       # Save memory
    gradient_checkpointing_kwargs={"use_reentrant": False},
    optim="paged_adamw_8bit",          # Memory-efficient optimizer
    report_to="wandb",                 # Monitor with Weights & Biases
)

# Trainer
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    tokenizer=tokenizer,
    peft_config=lora_config,
)

# Run training
trainer.train()

# Save model
trainer.save_model("./output/final")
tokenizer.save_pretrained("./output/final")
```

### 3.3 Monitoring Training Curves and Early Stopping

```python
from transformers import TrainerCallback
import matplotlib.pyplot as plt

class LossMonitorCallback(TrainerCallback):
    """Monitor training curves in real time"""

    def __init__(self):
        self.train_losses = []
        self.eval_losses = []
        self.steps = []
        self.eval_steps = []

    def on_log(self, args, state, control, logs=None, **kwargs):
        if "loss" in logs:
            self.train_losses.append(logs["loss"])
            self.steps.append(state.global_step)

        if "eval_loss" in logs:
            self.eval_losses.append(logs["eval_loss"])
            self.eval_steps.append(state.global_step)

            # Overfitting detection: eval_loss rising 3 times in a row
            if len(self.eval_losses) >= 3:
                if (self.eval_losses[-1] > self.eval_losses[-2] >
                    self.eval_losses[-3]):
                    print("WARNING: Signs of overfitting detected. Consider stopping training.")

    def plot(self, save_path: str = "loss_curve.png"):
        plt.figure(figsize=(10, 6))
        plt.plot(self.steps, self.train_losses, label="Train Loss", alpha=0.7)
        if self.eval_losses:
            plt.plot(self.eval_steps, self.eval_losses, label="Eval Loss",
                     marker="o", linewidth=2)
        plt.xlabel("Steps")
        plt.ylabel("Loss")
        plt.title("Fine-tuning Loss Curve")
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"Training curve saved to {save_path}")


# Usage example
loss_monitor = LossMonitorCallback()

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    tokenizer=tokenizer,
    peft_config=lora_config,
    callbacks=[loss_monitor],
)

trainer.train()
loss_monitor.plot()
```

---

## 4. RLHF and DPO

### ASCII Diagram 3: RLHF vs DPO Workflow

```
RLHF (Reinforcement Learning from Human Feedback):
┌─────────┐    ┌──────────┐    ┌──────────┐
│SFT Model│ →  │ Generate │ →  │  Human   │
└─────────┘    │Responses │    │Evaluation│
               └──────────┘    └────┬─────┘
                                     │
                                     ▼
┌─────────┐    ┌──────────┐    ┌──────────┐
│  Final  │ ←  │PPO Train │ ←  │  Reward  │
│  Model  │    │(unstable)│    │  Model   │
└─────────┘    └──────────┘    └──────────┘
                                (requires separate training)

DPO (Direct Preference Optimization):
┌─────────┐    ┌──────────┐    ┌──────────┐
│SFT Model│ →  │ Generate │ →  │  Human   │
└─────────┘    │  Pairs   │    │Evaluation│
               └──────────┘    │(ranking) │
                               └────┬─────┘
                                     │
                                     ▼
┌─────────┐                   ┌──────────┐
│  Final  │ ←─────────────── │ Train w/ │
│  Model  │  (direct optim.) │ DPO Loss │
└─────────┘   (stable)        └──────────┘
               No reward model needed
```

### Code Example 3: Alignment Training with DPO

```python
from trl import DPOTrainer, DPOConfig
from datasets import load_dataset

# Preference dataset format
# {"prompt": "...", "chosen": "good response", "rejected": "bad response"}
dataset = load_dataset("your-org/preference-dataset")

# DPO configuration
training_args = DPOConfig(
    output_dir="./dpo-output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=5e-7,
    beta=0.1,              # Strength of KL penalty
    loss_type="sigmoid",   # "sigmoid", "hinge", "ipo"
    logging_steps=10,
    save_steps=100,
    bf16=True,
)

# DPO trainer
trainer = DPOTrainer(
    model=model,
    ref_model=None,  # Reference model auto-generated when using PEFT
    args=training_args,
    train_dataset=dataset["train"],
    tokenizer=tokenizer,
    peft_config=lora_config,
)

trainer.train()
trainer.save_model("./dpo-final")
```

### 4.1 Mathematical Background of DPO

```
┌──────────────────────────────────────────────────────────┐
│         Intuitive Understanding of the DPO Loss Function  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  DPO Loss = -log σ(β × (log π(y_w|x)/π_ref(y_w|x)     │
│                      - log π(y_l|x)/π_ref(y_l|x)))      │
│                                                          │
│  Where:                                                  │
│  π     = policy being trained (the model)                │
│  π_ref = reference policy (SFT model)                    │
│  y_w   = response preferred by humans (winner/chosen)    │
│  y_l   = response not preferred by humans (loser/rejected)│
│  β     = strength of KL penalty                          │
│  σ     = sigmoid function                                │
│                                                          │
│  Intuition:                                              │
│  → Increase probability of chosen, decrease rejected     │
│  → Large β restricts deviation from SFT model            │
│  → Small β allows free optimization (overfitting risk)   │
│                                                          │
│  Recommended β values:                                   │
│  ├── 0.1  → Standard (effective in most cases)           │
│  ├── 0.05 → Aggressive optimization (when data quality is high) │
│  └── 0.5  → Conservative (prioritize preserving SFT model quality) │
└──────────────────────────────────────────────────────────┘
```

### 4.2 How to Create Preference Datasets

```python
from datasets import Dataset
import json

def create_preference_dataset(
    sft_model,
    tokenizer,
    prompts: list[str],
    n_responses: int = 4,
    temperature: float = 0.8,
) -> Dataset:
    """Auto-generate preference dataset from SFT model"""
    preference_data = []

    for prompt in prompts:
        # Generate multiple responses
        responses = []
        for _ in range(n_responses):
            inputs = tokenizer(prompt, return_tensors="pt").to(sft_model.device)
            outputs = sft_model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=temperature,
                do_sample=True,
            )
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)
            responses.append(response)

        # Evaluate with LLM-as-a-Judge (using GPT-4o)
        from openai import OpenAI
        client = OpenAI()

        judge_prompt = f"""
Evaluate the following {n_responses} responses to the question below,
and select the best and worst response.

Question: {prompt}

Responses:
{chr(10).join(f'{i+1}. {r}' for i, r in enumerate(responses))}

Output in JSON format: {{"best": <number>, "worst": <number>, "reason": "<reason>"}}
"""

        judge_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": judge_prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )

        result = json.loads(judge_response.choices[0].message.content)

        preference_data.append({
            "prompt": prompt,
            "chosen": responses[result["best"] - 1],
            "rejected": responses[result["worst"] - 1],
        })

    return Dataset.from_list(preference_data)


# Template for manual data creation
manual_preference = [
    {
        "prompt": "How do I remove duplicates from a list in Python?",
        "chosen": (
            "There are several ways to remove duplicates from a list:\n\n"
            "1. Using `set()` (simplest approach):\n"
            "```python\n"
            "unique = list(set(original_list))\n"
            "```\n"
            "Note: Order is not preserved.\n\n"
            "2. Using `dict.fromkeys()` to preserve order:\n"
            "```python\n"
            "unique = list(dict.fromkeys(original_list))\n"
            "```\n"
        ),
        "rejected": "Just use set().",
    },
    # ... hundreds of examples
]
```

### 4.3 ORPO (Odds Ratio Preference Optimization)

```python
from trl import ORPOTrainer, ORPOConfig

# ORPO: A method that performs SFT and DPO simultaneously
# → No SFT step needed, more efficient
orpo_config = ORPOConfig(
    output_dir="./orpo-output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=8e-6,
    beta=0.1,              # ORPO odds ratio parameter
    logging_steps=10,
    bf16=True,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
)

trainer = ORPOTrainer(
    model=model,
    args=orpo_config,
    train_dataset=dataset["train"],
    tokenizer=tokenizer,
    peft_config=lora_config,
)

trainer.train()
```

---

## 5. Fine-Tuning via OpenAI / API

### Code Example 5: Fine-Tuning with OpenAI (via API)

```python
from openai import OpenAI
import json

client = OpenAI()

# 1. Prepare training data (JSONL format)
training_data = [
    {
        "messages": [
            {"role": "system", "content": "An assistant that summarizes technical documents in Japanese"},
            {"role": "user", "content": "Please summarize the following document: ..."},
            {"role": "assistant", "content": "Summary: ..."}
        ]
    },
    # ... tens to hundreds of examples
]

with open("training_data.jsonl", "w") as f:
    for item in training_data:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

# 2. Upload file
file = client.files.create(
    file=open("training_data.jsonl", "rb"),
    purpose="fine-tune"
)

# 3. Create fine-tuning job
job = client.fine_tuning.jobs.create(
    training_file=file.id,
    model="gpt-4o-mini-2024-07-18",
    hyperparameters={
        "n_epochs": 3,
        "learning_rate_multiplier": 1.8,
        "batch_size": 4,
    }
)

# 4. Check status
status = client.fine_tuning.jobs.retrieve(job.id)
print(f"Status: {status.status}")
# Fine-tuned model: ft:gpt-4o-mini:org-name::job-id
```

### 5.1 Best Practices for OpenAI Fine-Tuning

```python
import json
from pathlib import Path

class OpenAIFTDataValidator:
    """Validation tool for OpenAI fine-tuning data"""

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.data = []
        with open(filepath) as f:
            for line in f:
                self.data.append(json.loads(line))

    def validate(self) -> dict:
        """Data quality check"""
        issues = []
        stats = {
            "total_examples": len(self.data),
            "total_tokens": 0,
            "avg_tokens": 0,
            "max_tokens": 0,
            "min_tokens": 0,
        }

        token_counts = []
        for i, example in enumerate(self.data):
            messages = example.get("messages", [])

            # Required field check
            if not messages:
                issues.append(f"Row {i}: messages is empty")
                continue

            roles = [m["role"] for m in messages]

            # System prompt consistency
            if roles[0] == "system":
                system_content = messages[0]["content"]
            else:
                issues.append(f"Row {i}: no system message")

            # Check for assistant response
            if "assistant" not in roles:
                issues.append(f"Row {i}: no assistant response")

            # Rough token count estimate (1 token ≈ 4 characters)
            total_chars = sum(len(m["content"]) for m in messages)
            est_tokens = total_chars // 4
            token_counts.append(est_tokens)

        if token_counts:
            stats["total_tokens"] = sum(token_counts)
            stats["avg_tokens"] = sum(token_counts) // len(token_counts)
            stats["max_tokens"] = max(token_counts)
            stats["min_tokens"] = min(token_counts)

        # Recommendation checks
        if len(self.data) < 10:
            issues.append("WARNING: Fewer than 10 examples. Minimum 50 recommended")
        elif len(self.data) < 50:
            issues.append("NOTE: Fewer than 50 examples. 100+ recommended")

        # Cost estimate (gpt-4o-mini FT pricing: $3.00/1M training tokens)
        cost_per_epoch = (stats["total_tokens"] / 1_000_000) * 3.00
        stats["estimated_cost_per_epoch"] = f"${cost_per_epoch:.2f}"
        stats["estimated_cost_3_epochs"] = f"${cost_per_epoch * 3:.2f}"

        return {"stats": stats, "issues": issues}


# Usage example
validator = OpenAIFTDataValidator("training_data.jsonl")
report = validator.validate()
print("=== Data Validation Report ===")
for key, value in report["stats"].items():
    print(f"  {key}: {value}")
if report["issues"]:
    print("\nIssues:")
    for issue in report["issues"]:
        print(f"  - {issue}")
```

### 5.2 Evaluating Fine-Tuned Models

```python
from openai import OpenAI

client = OpenAI()

def compare_base_vs_ft(
    base_model: str,
    ft_model: str,
    test_prompts: list[dict],
) -> list[dict]:
    """Comparative evaluation of base model vs fine-tuned model"""
    results = []

    for test in test_prompts:
        # Base model response
        base_resp = client.chat.completions.create(
            model=base_model,
            messages=test["messages"],
            max_tokens=500,
            temperature=0,
        )

        # FT model response
        ft_resp = client.chat.completions.create(
            model=ft_model,
            messages=test["messages"],
            max_tokens=500,
            temperature=0,
        )

        # Compare with LLM-as-a-Judge
        judge_resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Please comparatively evaluate the following two responses.

Question: {test['messages'][-1]['content']}

Response A (Base): {base_resp.choices[0].message.content}

Response B (FT): {ft_resp.choices[0].message.content}

JSON: {{"winner": "A" | "B" | "tie", "reason": "<reason>", "score_a": 1-5, "score_b": 1-5}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )

        import json
        result = json.loads(judge_resp.choices[0].message.content)
        result["prompt"] = test["messages"][-1]["content"][:100]
        results.append(result)

    # Aggregate
    wins = {"A": 0, "B": 0, "tie": 0}
    for r in results:
        wins[r["winner"]] += 1

    print(f"Base wins: {wins['A']}, FT wins: {wins['B']}, Ties: {wins['tie']}")
    return results
```

---

## 6. Model Merging and Export

### 6.1 Merging LoRA Adapters

```python
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer

# Merge LoRA adapter into base model
model = AutoPeftModelForCausalLM.from_pretrained(
    "./output/final",             # Path to LoRA adapter
    torch_dtype="auto",
    device_map="auto",
)

merged_model = model.merge_and_unload()

# Save merged model
merged_model.save_pretrained("./merged_model")
tokenizer = AutoTokenizer.from_pretrained("./output/final")
tokenizer.save_pretrained("./merged_model")

print("Merge complete. Inference is now possible without LoRA.")
```

### 6.2 Converting to GGUF Format (for Local Inference)

```bash
# Convert to GGUF using llama.cpp convert script
python llama.cpp/convert_hf_to_gguf.py \
    ./merged_model \
    --outtype bf16 \
    --outfile ./merged_model.gguf

# Quantize (4-bit)
./llama.cpp/build/bin/llama-quantize \
    ./merged_model.gguf \
    ./merged_model-q4_k_m.gguf \
    Q4_K_M

# Use with Ollama
cat > Modelfile << 'EOF'
FROM ./merged_model-q4_k_m.gguf

SYSTEM """You are a specialized assistant."""

PARAMETER temperature 0.3
PARAMETER num_ctx 4096
EOF

ollama create my-finetuned -f Modelfile
ollama run my-finetuned
```

### 6.3 Uploading to Hugging Face Hub

```python
from huggingface_hub import HfApi

api = HfApi()

# Create repository
api.create_repo("your-org/my-finetuned-model", private=True)

# Upload
api.upload_folder(
    folder_path="./merged_model",
    repo_id="your-org/my-finetuned-model",
    commit_message="Upload fine-tuned Llama 3.1 8B",
)

# Or upload only the LoRA adapter (lightweight)
api.upload_folder(
    folder_path="./output/final",
    repo_id="your-org/my-lora-adapter",
    commit_message="Upload LoRA adapter",
)
```

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

```
┌──────────────────────────────────────────────────────────┐
│       Fine-Tuning Troubleshooting                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue 1: Loss not decreasing                            │
│  Causes:                                                 │
│  - Learning rate too low or too high                     │
│  - Data format does not match model chat template        │
│  - Low data quality                                      │
│  Solutions:                                              │
│  - Adjust learning rate in the range 1e-5 ~ 5e-4        │
│  - Use tokenizer.apply_chat_template()                   │
│  - Sample 10 examples and inspect them manually          │
│                                                          │
│  Issue 2: Overfitting (eval_loss increasing)             │
│  Causes:                                                 │
│  - Too many epochs relative to data size                 │
│  - LoRA rank too large                                   │
│  Solutions:                                              │
│  - Reduce number of epochs (1-3 is typical)              │
│  - Lower LoRA r (8-16)                                   │
│  - Increase dropout (0.1-0.2)                            │
│  - Increase data volume                                  │
│                                                          │
│  Issue 3: CUDA Out of Memory                             │
│  Cause: Insufficient GPU memory                          │
│  Solutions:                                              │
│  - Halve the batch_size                                  │
│  - Double gradient_accumulation_steps                    │
│  - Set gradient_checkpointing=True                       │
│  - Switch to QLoRA (4-bit)                               │
│  - Shorten max_seq_length                                │
│                                                          │
│  Issue 4: Degraded generation quality                    │
│  Causes:                                                 │
│  - Catastrophic forgetting                               │
│  - Bias in training data                                 │
│  Solutions:                                              │
│  - Lower learning rate                                   │
│  - Lower LoRA r                                          │
│  - Mix in general-purpose data (10-20%)                  │
│  - Increase DPO β (0.3-0.5)                              │
│                                                          │
│  Issue 5: Chat template mismatch                         │
│  Cause: Template differs between training and inference  │
│  Solutions:                                              │
│  - Always use tokenizer.apply_chat_template()            │
│  - Unify handling of special tokens (BOS, EOS)           │
│  - Set Modelfile template precisely in Ollama etc.       │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Debugging Code

```python
def debug_training_data(dataset, tokenizer, n_samples: int = 5):
    """Debug training data"""
    print("=== Training Data Check ===")
    for i, example in enumerate(dataset.select(range(n_samples))):
        text = example.get("text", "")
        tokens = tokenizer.encode(text)

        print(f"\n--- Example {i+1} ---")
        print(f"Character count: {len(text)}")
        print(f"Token count: {len(tokens)}")
        print(f"First 200 chars: {text[:200]}")
        print(f"Last 200 chars: {text[-200:]}")

        # Check for special tokens
        special_tokens = [
            t for t in tokens
            if t in tokenizer.all_special_ids
        ]
        print(f"Special token count: {len(special_tokens)}")

    # Statistics
    all_lengths = [len(tokenizer.encode(e["text"])) for e in dataset]
    print(f"\n=== Statistics ===")
    print(f"Number of examples: {len(all_lengths)}")
    print(f"Average token count: {sum(all_lengths) / len(all_lengths):.0f}")
    print(f"Max token count: {max(all_lengths)}")
    print(f"Min token count: {min(all_lengths)}")
```

---

### Comparison Table 1: Comparison of Fine-Tuning Methods

| Method | GPU Memory | Training Speed | Quality | Implementation Difficulty | Cost |
|--------|-----------|----------------|---------|--------------------------|------|
| Full FT | Very high | Slow | Best | High | Very high |
| LoRA | Moderate | Fast | High | Moderate | Moderate |
| QLoRA | Low | Fast | High | Moderate | Low |
| API FT (OpenAI) | Not required | Moderate | Medium~High | Low | Pay-per-use |
| Prompt Tuning | Very low | Very fast | Moderate | Low | Low |

### Comparison Table 2: Detailed Comparison of RLHF vs DPO

| Item | RLHF | DPO | ORPO |
|------|------|-----|------|
| Reward model | Required (trained separately) | Not required | Not required |
| SFT step | Required | Required | Not required (integrated) |
| Training stability | Unstable (PPO tuning is hard) | Stable | Stable |
| Compute cost | High (3 models in parallel) | Moderate (2 models) | Low (1 model) |
| Data requirements | Comparison pairs + reward labels | Comparison pairs only | Comparison pairs only |
| Performance | High (when tuned successfully) | Comparable to RLHF | Comparable to DPO |
| Implementation difficulty | Very high | Moderate | Low |
| Adoption examples | GPT-4, Claude | Llama 3, Zephyr | Mistral v0.3 |

### Comparison Table 3: Guidelines for Training Data Scale and Quality

| Task Type | Minimum Data | Recommended Data | Data Quality Criteria |
|-----------|-------------|-----------------|----------------------|
| Text classification | 100 examples | 500-2,000 examples | Label consistency >95% |
| Style adjustment | 200 examples | 1,000-3,000 examples | Human-verified |
| Knowledge injection | 500 examples | 2,000-10,000 examples | Fact-checked |
| Code generation | 300 examples | 1,000-5,000 examples | Test-passing verified |
| Complex reasoning | 1,000 examples | 5,000-50,000 examples | Expert-reviewed |
| Dialogue optimization | 500 examples | 2,000-10,000 examples | A/B test validated |

---

## Anti-Patterns

### Anti-Pattern 1: Feeding Large Amounts of Low-Quality Data

```
Wrong: Fine-tuning with 100,000 low-quality examples
  → Learns noise, increased hallucination, quality degradation

Right: Carefully curate high-quality data
  - 1,000 high-quality examples > 100,000 low-quality examples
  - Always verify data quality manually
  - Choose representative examples that cover diverse patterns
```

### Anti-Pattern 2: Over-Reliance on Fine-Tuning

```
Wrong: Start with fine-tuning right away
  → Waste of time and cost

Right: Approach incrementally
  1. First try to solve with prompt engineering
  2. Try improving with few-shot examples
  3. Try providing context with RAG
  4. Only fine-tune when still insufficient
  → "FT is a last resort" is the guiding principle
```

### Anti-Pattern 3: Fixed Learning Rate

```python
# Bad: Using the same learning rate for all tasks
learning_rate = 2e-4  # Always this value

# Good: Adjust based on task and model size
learning_rates = {
    "sft_7b_lora":   2e-4,   # LoRA SFT for small~medium models
    "sft_70b_lora":  5e-5,   # LoRA SFT for large models
    "dpo_7b":        5e-7,   # DPO uses low learning rate
    "dpo_70b":       1e-7,   # Even lower for large model DPO
    "openai_ft":     1.8,    # OpenAI API multiplier
}

# Best practice: Learning rate schedule
# 1. warmup (5-10% of steps): linear increase
# 2. cosine decay: gradually decrease
# 3. Final learning rate: ~10% of initial
```

### Anti-Pattern 4: Deploying Without Evaluation

```python
# Bad: Training complete → immediate deploy
trainer.train()
deploy(model)  # Quality not verified

# Good: Staged evaluation process
trainer.train()

# 1. Quantitative evaluation (automated)
eval_results = evaluate_on_test_set(model, test_dataset)
if eval_results["score"] < baseline_score:
    raise ValueError("Quality is below baseline")

# 2. Qualitative evaluation (manual sampling)
samples = generate_samples(model, sample_prompts, n=20)
# Review manually

# 3. A/B testing
# Conduct comparison against existing model

# 4. Staged rollout
# Start with 10% of traffic → expand if no issues
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
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
        assert False, "Exception should have been raised"
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
    """Exercise on advanced patterns"""

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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes criteria for making technology choices.

| Criteria | When to prioritize | When to compromise |
|---------|-------------------|-------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│          Architecture Selection Flow             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + module split   │
│    └─ Daily/multiple times → Go to ③            │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction enables reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

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
        """Describe background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add consequence"""
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

### Q1: What value should I set for LoRA rank r?

**A:** Generally, r=8~32 is a good starting point. More complex tasks require higher ranks, but r=64 and above increases overfitting risk. The best approach is to experimentally compare r=8, 16, and 32 and decide based on validation set performance. `lora_alpha` is typically set to 2× the value of `r`.

### Q2: How much data is needed for fine-tuning?

**A:** It depends on the task, but general guidelines are as follows: classification tasks: 100-500 examples, style adjustment: 500-2,000 examples, knowledge injection: 1,000-5,000 examples, complex reasoning: 5,000-50,000 examples. However, data quality and diversity are more important than data volume.

### Q3: Should I choose fine-tuning or RAG?

**A:** Choose based on your objective. Fine-tuning is suitable for "changing behavior or style," while RAG is better for "adding knowledge." Fine-tuning has no change in inference cost once trained, while RAG can dynamically provide up-to-date information. In many cases, combining both is optimal.

### Q4: How much quality difference is there between LoRA and full-parameter FT?

**A:** For many tasks, LoRA (r=16-32) achieves 95-99% of the performance of full-parameter FT. The difference is minimal for task-specific fine-tuning (classification, summarization, code generation, etc.). However, for training that significantly rewrites the model's knowledge (acquiring a new language, adapting to an entirely new domain), full-parameter FT may have an advantage.

### Q5: What hardware is needed to train a 70B model with QLoRA?

**A:** Training a 70B model with QLoRA (4-bit) + LoRA (r=16) requires approximately 40-48GB of VRAM. It can be run on one A100 80GB, or two A100 40GB cards (DeepSpeed ZeRO Stage 3). Batch size is 1-2, with gradient_accumulation to secure effective batch size. On an RTX 4090 (24GB), it may barely run with gradient_checkpointing + batch_size=1, but it is not recommended due to stability concerns.

### Q6: What to do when a model is "broken" after fine-tuning?

**A:** Catastrophic forgetting is likely the cause. Solutions: (1) Lower the learning rate (by ~1/10), (2) Reduce the number of epochs (even 1 epoch can be effective), (3) Lower LoRA r, (4) Mix in 10-20% general-purpose data, (5) For DPO, increase beta to restrict deviation from the SFT model.

---

## Summary

| Item | Key Point |
|------|-----------|
| LoRA | Efficiently adapts models with low-rank matrices, drastically reduces VRAM |
| QLoRA | 4-bit quantization + LoRA enables training an 8B model on a single GPU |
| RLHF | Aligns to human preferences with a reward model and PPO (high performance but unstable) |
| DPO | Direct optimization without a reward model (stable and simple) |
| ORPO | Efficient method that integrates SFT + DPO |
| Data quality | Quality matters more than quantity; 1,000 good examples beat 100,000 poor ones |
| Staged approach | Consider in order: prompt → few-shot → RAG → FT |
| Evaluation | Always conduct comparative evaluation before and after FT; record baselines |
| Export | LoRA merge → GGUF conversion → Ollama execution pipeline |

---

## Further Reading

- [../01-models/04-model-comparison.md](../01-models/04-model-comparison.md) — Model comparison and benchmarks
- [../02-applications/01-rag.md](../02-applications/01-rag.md) — RAG implementation
- [../03-infrastructure/02-local-llm.md](../03-infrastructure/02-local-llm.md) — Local LLMs and quantization

---

## References

1. Hu, E. et al. (2021). "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR 2022*. https://arxiv.org/abs/2106.09685
2. Dettmers, T. et al. (2023). "QLoRA: Efficient Finetuning of Quantized Language Models." *NeurIPS 2023*. https://arxiv.org/abs/2305.14314
3. Rafailov, R. et al. (2023). "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." *NeurIPS 2023*. https://arxiv.org/abs/2305.18290
4. Ouyang, L. et al. (2022). "Training language models to follow instructions with human feedback." *NeurIPS 2022*. https://arxiv.org/abs/2203.02155
5. Hong, J. et al. (2024). "ORPO: Monolithic Preference Optimization without Reference Model." *arXiv:2403.07691*
6. Hugging Face, "PEFT Documentation." https://huggingface.co/docs/peft
7. Hugging Face, "TRL Documentation." https://huggingface.co/docs/trl
