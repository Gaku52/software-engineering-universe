# Tokenization — Converting Text into Units the Model Understands

> Learn the principles of BPE, SentencePiece, and the differences between model-specific tokenizers, along with practical techniques for managing token counts.

## What You Will Learn

1. The principles of **BPE (Byte Pair Encoding)** and its major derivative algorithms
2. The characteristics and comparison of **SentencePiece** and model-specific tokenizers
3. Practical methods for **token count management** and cost optimization


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [LLM Overview — Fundamentals of Large Language Models](./00-llm-overview.md)

---

## 1. Fundamentals of Tokenization

### ASCII Diagram 1: The Tokenization Flow

```
Input Text
"大規模言語モデルは素晴らしい"
        │
        ▼
┌─────────────────────┐
│  Pre-tokenization   │
│  (split by spaces   │
│   and punctuation)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Subword Splitting  │
│  BPE / Unigram      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Token ID Conversion│
│  Vocabulary Lookup  │
└─────────┬───────────┘
          │
          ▼
[15043, 30590, 29914, 234, ...]
```

### 1.1 History and Background of Tokenization

Text segmentation methods in natural language processing (NLP) have a long evolutionary history. Early NLP systems predominantly used word-level tokenization, but the out-of-vocabulary (OOV) problem was severe. Character-level tokenization eliminates OOV issues but results in extremely long sequences and loses semantic information.

Subword splitting is a groundbreaking approach that sits between these two methods. Frequently occurring words are kept as a single token, while rare words are split into smaller, meaningful units (subwords). This makes it possible to represent any text while keeping vocabulary size manageable.

```
Evolution of splitting methods:

Word-level:        "unhappiness" → ["unhappiness"] (needs to be in vocabulary)
                   "unhappily"  → [UNK]           (out of vocabulary!)

Character-level:   "unhappiness" → ["u","n","h","a","p","p","i","n","e","s","s"]
                   → 11 tokens (too long)

Subword (BPE):     "unhappiness" → ["un", "happiness"]
                   "unhappily"   → ["un", "happily"]
                   → small vocabulary, no OOV, preserves meaning
```

### 1.2 Details of Pre-tokenization

Pre-tokenization is the step before subword splitting that divides text into rough units. The design of this stage significantly affects the overall performance of the tokenizer.

```python
# Various pre-tokenization methods
import re

text = "Hello, World! 大規模言語モデル（LLM）は2024年に急速に発展した。"

# Method 1: Whitespace splitting (simplest)
whitespace_tokens = text.split()
print(f"Whitespace split: {whitespace_tokens}")
# → ['Hello,', 'World!', '大規模言語モデル（LLM）は2024年に急速に発展した。']

# Method 2: GPT-2/GPT-4o style (regex-based)
gpt2_pattern = re.compile(
    r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""",
    re.UNICODE
)

# Method 3: Byte-level (GPT-4o, Claude)
# Process all text as UTF-8 byte sequences
byte_sequence = text.encode("utf-8")
print(f"Byte count: {len(byte_sequence)}")
# Japanese characters are 3 bytes each (UTF-8)

# Method 4: SentencePiece style (whitespace as special character)
# Convert spaces to "▁" (U+2581)
sp_text = "▁" + text.replace(" ", "▁")
print(f"SentencePiece format: {sp_text}")
```

### Code Example 1: Tokenization with tiktoken (OpenAI)

```python
import tiktoken

# Encoder for GPT-4o
enc = tiktoken.encoding_for_model("gpt-4o")

text = "大規模言語モデルは素晴らしい技術です。"
tokens = enc.encode(text)

print(f"Text: {text}")
print(f"Token count: {len(tokens)}")
print(f"Token IDs: {tokens}")

# Check the content of each token
for token_id in tokens:
    token_bytes = enc.decode_single_token_bytes(token_id)
    print(f"  ID {token_id:>6} → {token_bytes}")
```

### Code Example 2: Comparing Hugging Face Tokenizers

```python
from transformers import AutoTokenizer

models = {
    "GPT-4o": "Xenova/gpt-4o",
    "Claude": "anthropic/claude-tokenizer",  # hypothetical example
    "Llama-3": "meta-llama/Llama-3.1-8B-Instruct",
    "Gemma-2": "google/gemma-2-9b",
}

text = "東京タワーの高さは333メートルです。The height is 333 meters."

for name, model_id in models.items():
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        tokens = tokenizer.encode(text)
        print(f"{name:>10}: {len(tokens):>3} tokens")
    except Exception as e:
        print(f"{name:>10}: (could not load)")
```

### Code Example: Detailed Tokenization Analysis Tool

```python
import tiktoken
from collections import Counter

class TokenAnalyzer:
    """A tool for detailed analysis of text tokenization"""

    def __init__(self, model: str = "gpt-4o"):
        self.enc = tiktoken.encoding_for_model(model)
        self.model = model

    def analyze(self, text: str) -> dict:
        """Perform detailed analysis of text tokenization"""
        tokens = self.enc.encode(text)
        token_strings = [
            self.enc.decode([t]) for t in tokens
        ]

        # Classify token types
        categories = {
            "ascii": 0,
            "japanese": 0,
            "number": 0,
            "punctuation": 0,
            "whitespace": 0,
            "other": 0,
        }

        for ts in token_strings:
            if ts.strip() == "":
                categories["whitespace"] += 1
            elif ts.isascii() and ts.isalpha():
                categories["ascii"] += 1
            elif ts.isdigit():
                categories["number"] += 1
            elif any(ord(c) > 0x3000 for c in ts):
                categories["japanese"] += 1
            elif not ts.isalnum():
                categories["punctuation"] += 1
            else:
                categories["other"] += 1

        return {
            "text_length_chars": len(text),
            "text_length_bytes": len(text.encode("utf-8")),
            "token_count": len(tokens),
            "chars_per_token": len(text) / len(tokens),
            "bytes_per_token": len(text.encode("utf-8")) / len(tokens),
            "token_categories": categories,
            "unique_tokens": len(set(tokens)),
            "token_ids": tokens,
            "token_strings": token_strings,
        }

    def compare_texts(self, texts: dict[str, str]) -> None:
        """Compare token efficiency across multiple texts"""
        print(f"{'Text':<20} {'Chars':>6} {'Bytes':>8} "
              f"{'Tokens':>8} {'Chars/Token':>12}")
        print("-" * 70)
        for name, text in texts.items():
            result = self.analyze(text)
            print(f"{name:<20} {result['text_length_chars']:>6} "
                  f"{result['text_length_bytes']:>8} "
                  f"{result['token_count']:>8} "
                  f"{result['chars_per_token']:>12.2f}")

    def estimate_cost(self, text: str, model_pricing: dict) -> dict:
        """Estimate the API cost for a text"""
        tokens = len(self.enc.encode(text))
        input_cost = (tokens / 1_000_000) * model_pricing["input"]
        return {
            "tokens": tokens,
            "input_cost_usd": input_cost,
        }

# Usage example
analyzer = TokenAnalyzer("gpt-4o")

# English/Japanese comparison
texts = {
    "English (short)": "The quick brown fox jumps over the lazy dog.",
    "Japanese (short)": "素早い茶色の狐が怠惰な犬を飛び越える。",
    "English (technical)": "Transformer architecture uses self-attention mechanism.",
    "Japanese (technical)": "Transformerアーキテクチャは自己注意機構を使用する。",
    "Code": "def hello(): return 'Hello, World!'",
    "Mixed": "GPT-4oは2024年にリリースされた最新のLLMです。",
}

analyzer.compare_texts(texts)
```

---

## 2. BPE and SentencePiece

### ASCII Diagram 2: The BPE Merge Process

```
Initial state (character-level):
["l", "o", "w"]  ["l", "o", "w", "e", "r"]  ["n", "e", "w"]

Step 1: Most frequent pair ("l", "o") → merge into "lo"
["lo", "w"]  ["lo", "w", "e", "r"]  ["n", "e", "w"]

Step 2: Most frequent pair ("lo", "w") → merge into "low"
["low"]  ["low", "e", "r"]  ["n", "e", "w"]

Step 3: Most frequent pair ("e", "r") → merge into "er"
["low"]  ["low", "er"]  ["n", "e", "w"]

Step 4: Most frequent pair ("n", "e") → merge into "ne"
["low"]  ["low", "er"]  ["ne", "w"]

Step 5: Most frequent pair ("ne", "w") → merge into "new"
["low"]  ["low", "er"]  ["new"]

→ Vocabulary: {l, o, w, e, r, n, lo, low, er, ne, new, lower, ...}
```

### 2.1 BPE Variations

Several important variations of BPE exist, each adopted by different models.

```
BPE family:

1. Standard BPE (Sennrich et al., 2016)
   - Starts from character level and merges most frequent pairs
   - Deterministic: the same corpus always yields the same vocabulary
   - Adopted by: early GPT series

2. Byte-Level BPE (GPT-2/GPT-4o/Claude)
   - Uses bytes (0-255) as the basic unit
   - Unknown words are fundamentally impossible
   - Can process any language or symbol
   - Applies BPE to UTF-8 byte sequences

3. WordPiece (BERT)
   - A variant of BPE with a different merge criterion
   - Selects merge pairs based on likelihood increase rather than frequency
   - Split subwords are represented with "##" prefix
   - Example: "unhappiness" → ["un", "##happiness"]

4. Unigram LM (SentencePiece)
   - The opposite of BPE: starts with a large vocabulary and prunes it
   - Probabilistic: a word may have multiple possible splits
   - Provides regularization effect (improves robustness during training)
```

### Code Example 3: Simple BPE Implementation

```python
from collections import Counter

def get_pairs(word_freqs):
    """Calculate frequency of all pairs"""
    pairs = Counter()
    for word, freq in word_freqs.items():
        symbols = word.split()
        for i in range(len(symbols) - 1):
            pairs[(symbols[i], symbols[i + 1])] += freq
    return pairs

def merge_pair(pair, word_freqs):
    """Merge the most frequent pair"""
    new_word_freqs = {}
    bigram = " ".join(pair)
    replacement = "".join(pair)
    for word, freq in word_freqs.items():
        new_word = word.replace(bigram, replacement)
        new_word_freqs[new_word] = freq
    return new_word_freqs

# Word frequencies from training data
word_freqs = {
    "l o w": 5,
    "l o w e r": 2,
    "n e w e s t": 6,
    "w i d e s t": 3,
}

num_merges = 10
merges = []

for i in range(num_merges):
    pairs = get_pairs(word_freqs)
    if not pairs:
        break
    best_pair = max(pairs, key=pairs.get)
    word_freqs = merge_pair(best_pair, word_freqs)
    merges.append(best_pair)
    print(f"Merge {i+1}: {best_pair} → {''.join(best_pair)}")

print(f"\nPart of final vocabulary: {list(word_freqs.keys())}")
```

### Code Example: Detailed Byte-Level BPE Implementation

```python
from collections import Counter, defaultdict
from typing import Optional

class ByteLevelBPE:
    """Educational implementation of Byte-Level BPE"""

    def __init__(self, vocab_size: int = 1000):
        self.vocab_size = vocab_size
        self.merges: list[tuple[bytes, bytes]] = []
        self.vocab: dict[int, bytes] = {}

    def _get_stats(self, ids_list: list[list[int]]) -> Counter:
        """Calculate frequency of all byte pairs"""
        counts = Counter()
        for ids in ids_list:
            for i in range(len(ids) - 1):
                counts[(ids[i], ids[i + 1])] += 1
        return counts

    def _merge(self, ids: list[int], pair: tuple[int, int],
               new_id: int) -> list[int]:
        """Merge the specified pair and replace with new ID"""
        new_ids = []
        i = 0
        while i < len(ids):
            if i < len(ids) - 1 and ids[i] == pair[0] and ids[i + 1] == pair[1]:
                new_ids.append(new_id)
                i += 2
            else:
                new_ids.append(ids[i])
                i += 1
        return new_ids

    def train(self, texts: list[str]) -> None:
        """Learn BPE vocabulary from a text corpus"""
        # Initial vocabulary: byte values 0-255
        self.vocab = {i: bytes([i]) for i in range(256)}
        next_id = 256

        # Convert texts to byte sequences
        ids_list = [list(text.encode("utf-8")) for text in texts]

        # Repeat merges until vocabulary size is reached
        while next_id < self.vocab_size:
            stats = self._get_stats(ids_list)
            if not stats:
                break

            # Select most frequent pair
            best_pair = max(stats, key=stats.get)

            # Execute merge across all texts
            ids_list = [
                self._merge(ids, best_pair, next_id)
                for ids in ids_list
            ]

            # Add to vocabulary
            self.vocab[next_id] = self.vocab[best_pair[0]] + self.vocab[best_pair[1]]
            self.merges.append(best_pair)

            if next_id % 100 == 0:
                print(f"Merge {next_id - 256}: "
                      f"{self.vocab[best_pair[0]]!r} + "
                      f"{self.vocab[best_pair[1]]!r} → "
                      f"{self.vocab[next_id]!r}")

            next_id += 1

        print(f"\nTraining complete: {len(self.vocab)} tokens, "
              f"{len(self.merges)} merges")

    def encode(self, text: str) -> list[int]:
        """Convert text to a list of token IDs"""
        ids = list(text.encode("utf-8"))
        for pair in self.merges:
            new_id = 256 + self.merges.index(pair)
            ids = self._merge(ids, pair, new_id)
        return ids

    def decode(self, ids: list[int]) -> str:
        """Restore a list of token IDs to text"""
        byte_sequence = b"".join(self.vocab[i] for i in ids)
        return byte_sequence.decode("utf-8", errors="replace")

# Usage example
bpe = ByteLevelBPE(vocab_size=500)
corpus = [
    "The quick brown fox jumps over the lazy dog.",
    "大規模言語モデルは自然言語処理の革命です。",
    "Machine learning and deep learning are transforming AI.",
] * 100  # Repeat corpus to increase frequency

bpe.train(corpus)

test_text = "The quick fox"
encoded = bpe.encode(test_text)
decoded = bpe.decode(encoded)
print(f"Original: {test_text}")
print(f"Token count: {len(encoded)}")
print(f"Decoded: {decoded}")
```

### Code Example 4: Training and Using SentencePiece

```python
import sentencepiece as spm

# Train the model
spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=32000,
    model_type="bpe",           # "unigram" is also available
    character_coverage=0.9995,  # Set higher for Japanese
    pad_id=3,
    unk_id=0,
    bos_id=1,
    eos_id=2,
)

# Use the trained model
sp = spm.SentencePieceProcessor()
sp.load("my_tokenizer.model")

text = "大規模言語モデルの性能はトークナイザに大きく依存する"
tokens = sp.encode(text, out_type=str)
ids = sp.encode(text, out_type=int)

print(f"Text: {text}")
print(f"Tokens: {tokens}")
print(f"IDs: {ids}")
print(f"Decoded: {sp.decode(ids)}")
```

### Code Example: Advanced SentencePiece Configuration

```python
import sentencepiece as spm

# SentencePiece training optimized for Japanese
spm.SentencePieceTrainer.train(
    input="japanese_corpus.txt",
    model_prefix="jp_tokenizer",
    vocab_size=32000,
    model_type="unigram",        # Unigram is often suitable for Japanese
    character_coverage=0.9995,   # Character coverage for Japanese
    byte_fallback=True,          # Fall back to byte representation for unknown characters
    split_by_unicode_script=True,  # Split at Unicode script boundaries
    split_by_number=True,         # Split at number boundaries
    split_by_whitespace=True,     # Split at whitespace
    split_digits=True,            # Treat each digit as an individual token
    treat_whitespace_as_suffix=False,
    allow_whitespace_only_pieces=True,
    normalization_rule_name="nfkc",  # Unicode normalization
    num_threads=8,
    # Define special tokens
    user_defined_symbols=["<code>", "</code>", "<math>", "</math>"],
    control_symbols=["<sep>", "<cls>", "<mask>"],
)

# Detailed usage of the trained model
sp = spm.SentencePieceProcessor()
sp.load("jp_tokenizer.model")

text = "GPT-4oの性能は2024年に大幅に向上した。"

# Standard encoding
tokens_str = sp.encode(text, out_type=str)
tokens_id = sp.encode(text, out_type=int)
print(f"Tokens (string): {tokens_str}")
print(f"Tokens (ID): {tokens_id}")

# N-best encoding (retrieve multiple split candidates)
nbest = sp.nbest_encode(text, nbest_size=5, out_type=str)
print(f"\nN-best split candidates:")
for i, candidate in enumerate(nbest):
    print(f"  Candidate {i+1}: {candidate}")

# Sampling encoding (regularization effect)
for i in range(3):
    sampled = sp.encode(text, out_type=str, enable_sampling=True,
                        alpha=0.1, nbest_size=-1)
    print(f"Sample {i+1}: {sampled}")
```

### 2.2 How Unigram Language Model Works

```
Unigram LM Tokenization:

BPE (bottom-up):
  characters → merge → merge → ... → final vocabulary
  (grow from small vocabulary)

Unigram (top-down):
  huge vocabulary → prune → prune → ... → final vocabulary
  (shrink from large vocabulary)

Procedure:
1. Prepare a sufficiently large initial vocabulary
   (e.g., frequently occurring substrings)

2. Estimate probability P(x_i) for each vocabulary element using EM algorithm

3. Calculate loss increase when each vocabulary element is removed:
   loss_i = -sum(log P(sentence | vocab \ {x_i}))

4. Remove the vocabulary element with the smallest loss increase
   (= remove elements whose removal has the least impact)

5. Repeat steps 2-4 until the target vocabulary size is reached

Advantages:
- Probabilistic splitting: a word may have multiple possible splits
  → Regularization effect during training (Subword Regularization)
- Split quality is closer to optimal
```

### Comparison Table 1: Tokenization Method Comparison

| Method | Characteristics | Adopted by | Japanese Support | Vocabulary Size |
|--------|----------------|------------|-----------------|----------------|
| BPE (Byte-level) | No unknown words at byte level | GPT-4, Claude | Good | 100K-200K |
| SentencePiece (Unigram) | Probabilistic subword splitting | LLaMA, Gemma | Good | 32K-128K |
| SentencePiece (BPE) | BPE on SPP framework | T5, mBART | Good | 32K-64K |
| WordPiece | BPE variant | BERT | Requires tuning | 30K-50K |
| tiktoken | OpenAI's high-speed BPE | GPT-4o | Good | 100K-200K |

### Comparison Table: Implementation Details of Each Tokenizer

| Property | tiktoken | SentencePiece | HF Tokenizers |
|----------|----------|--------------|---------------|
| Implementation Language | Rust + Python | C++ + Python | Rust + Python |
| Speed (MB/s) | ~100 | ~50 | ~80 |
| Multithreading | Supported | Supported | Supported |
| Streaming | Supported | Limited | Supported |
| Custom Training | Not possible | Possible | Possible |
| Vocabulary Extension | Not possible | Possible | Possible |
| Memory Efficiency | High | Medium | High |
| License | MIT | Apache 2.0 | Apache 2.0 |

---

## 3. Token Count Management

### ASCII Diagram 3: Relationship Between Token Count and Cost

```
API cost structure:
┌──────────────────────────────────────────┐
│                                          │
│  Input Tokens          Output Tokens     │
│  ┌──────────┐      ┌──────────┐         │
│  │ System   │      │ Generated│         │
│  │ Prompt   │      │ Text     │         │
│  │          │      │          │         │
│  │ User     │      │          │         │
│  │ Message  │      │          │         │
│  └──────────┘      └──────────┘         │
│   $X / 1M tokens    $Y / 1M tokens      │
│   (Y is usually higher)                 │
│                                          │
│  Total cost = input×X + output×Y        │
└──────────────────────────────────────────┘

Example: Claude 3.5 Sonnet
  Input: $3.00 / 1M tokens
  Output: $15.00 / 1M tokens
```

### 3.1 Managing the Context Window

The context window is the maximum number of tokens a model can process at once. The sum of input and output tokens cannot exceed this limit.

```
Context window composition:

┌──────────────────────────────────────────────────┐
│              Context Window (e.g., 200K)          │
│                                                    │
│  ┌────────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ System     │  │ Convers- │  │ Reserved      │ │
│  │ Prompt     │  │ ation    │  │ Output        │ │
│  │ (fixed)    │  │ History  │  │ (max_tokens)  │ │
│  │ ~2K tokens │  │ (variable│  │ ~8K tokens    │ │
│  │            │  │ ~190K)   │  │ (fixed)       │ │
│  └────────────┘  └──────────┘  └───────────────┘ │
│                                                    │
│  Available conversation history = window size     │
│                    - system prompt                 │
│                    - max_tokens (output reserve)   │
└──────────────────────────────────────────────────┘
```

```python
class ContextWindowManager:
    """Utility for managing the context window"""

    MODEL_LIMITS = {
        "gpt-4o": 128_000,
        "gpt-4o-mini": 128_000,
        "claude-3-5-sonnet": 200_000,
        "claude-3-5-haiku": 200_000,
        "gemini-1.5-pro": 1_000_000,
        "llama-3.1-8b": 128_000,
    }

    def __init__(self, model: str, max_output_tokens: int = 4096,
                 system_prompt_tokens: int = 0):
        self.model = model
        self.context_limit = self.MODEL_LIMITS.get(model, 128_000)
        self.max_output_tokens = max_output_tokens
        self.system_prompt_tokens = system_prompt_tokens

    @property
    def available_input_tokens(self) -> int:
        """Remaining tokens available for input"""
        return (self.context_limit
                - self.max_output_tokens
                - self.system_prompt_tokens)

    def can_fit(self, input_tokens: int) -> bool:
        """Check if input fits within the context window"""
        return input_tokens <= self.available_input_tokens

    def truncate_messages(self, messages: list[dict],
                          token_counter,
                          strategy: str = "sliding_window") -> list[dict]:
        """Truncate message history to fit within the context"""
        if strategy == "sliding_window":
            return self._sliding_window(messages, token_counter)
        elif strategy == "summarize_old":
            return self._summarize_old(messages, token_counter)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

    def _sliding_window(self, messages: list[dict],
                         token_counter) -> list[dict]:
        """Remove old messages first (prioritize latest)"""
        result = []
        total_tokens = 0
        limit = self.available_input_tokens

        # Add messages in reverse order from newest
        for msg in reversed(messages):
            msg_tokens = token_counter(msg["content"])
            if total_tokens + msg_tokens > limit:
                break
            result.insert(0, msg)
            total_tokens += msg_tokens

        return result

    def _summarize_old(self, messages: list[dict],
                        token_counter) -> list[dict]:
        """Compress old messages by summarizing them"""
        # Example implementation: summarize old portion + keep new portion as-is
        limit = self.available_input_tokens
        half_limit = limit // 2

        # Recent messages (latter half)
        recent = []
        recent_tokens = 0
        for msg in reversed(messages):
            msg_tokens = token_counter(msg["content"])
            if recent_tokens + msg_tokens > half_limit:
                break
            recent.insert(0, msg)
            recent_tokens += msg_tokens

        # Summarize old messages (former half)
        old_messages = messages[:len(messages) - len(recent)]
        if old_messages:
            summary_msg = {
                "role": "system",
                "content": f"[Summary of previous conversation: {len(old_messages)} messages]"
            }
            return [summary_msg] + recent

        return recent

# Usage example
manager = ContextWindowManager(
    model="claude-3-5-sonnet",
    max_output_tokens=4096,
    system_prompt_tokens=500,
)

print(f"Model: {manager.model}")
print(f"Context limit: {manager.context_limit:,} tokens")
print(f"Available for input: {manager.available_input_tokens:,} tokens")
```

### Code Example 5: Token Count and Cost Estimation

```python
import tiktoken

def estimate_cost(
    text: str,
    model: str = "gpt-4o",
    max_output_tokens: int = 1000
):
    """Estimate API cost"""
    pricing = {
        "gpt-4o":          {"input": 2.50, "output": 10.00},
        "gpt-4o-mini":     {"input": 0.15, "output": 0.60},
        "claude-3.5-sonnet": {"input": 3.00, "output": 15.00},
        "claude-3.5-haiku": {"input": 0.80, "output": 4.00},
    }

    enc = tiktoken.encoding_for_model("gpt-4o")
    input_tokens = len(enc.encode(text))

    if model in pricing:
        p = pricing[model]
        input_cost = input_tokens / 1_000_000 * p["input"]
        output_cost = max_output_tokens / 1_000_000 * p["output"]
        total = input_cost + output_cost

        print(f"Model: {model}")
        print(f"Input tokens: {input_tokens:,}")
        print(f"Output tokens (max): {max_output_tokens:,}")
        print(f"Input cost: ${input_cost:.4f}")
        print(f"Output cost: ${output_cost:.4f}")
        print(f"Total estimate: ${total:.4f}")

text = "A long prompt goes here." * 100
estimate_cost(text, model="claude-3.5-sonnet")
```

### 3.2 Token Optimization for Batch Processing

```python
import tiktoken
from typing import Generator

class BatchTokenOptimizer:
    """Token optimization for processing large volumes of text"""

    def __init__(self, model: str = "gpt-4o",
                 max_tokens_per_batch: int = 100_000):
        self.enc = tiktoken.encoding_for_model(model)
        self.max_tokens_per_batch = max_tokens_per_batch

    def create_batches(self, texts: list[str],
                        max_tokens: int = None
                        ) -> Generator[list[str], None, None]:
        """Split texts into batches based on token count"""
        max_tokens = max_tokens or self.max_tokens_per_batch
        current_batch = []
        current_tokens = 0

        for text in texts:
            text_tokens = len(self.enc.encode(text))

            if current_tokens + text_tokens > max_tokens and current_batch:
                yield current_batch
                current_batch = []
                current_tokens = 0

            current_batch.append(text)
            current_tokens += text_tokens

        if current_batch:
            yield current_batch

    def truncate_to_tokens(self, text: str,
                            max_tokens: int) -> str:
        """Truncate text to within the specified token count"""
        tokens = self.enc.encode(text)
        if len(tokens) <= max_tokens:
            return text
        truncated_tokens = tokens[:max_tokens]
        return self.enc.decode(truncated_tokens)

    def split_by_tokens(self, text: str,
                         chunk_size: int,
                         overlap: int = 0) -> list[str]:
        """Split text into chunks based on token count"""
        tokens = self.enc.encode(text)
        chunks = []
        start = 0

        while start < len(tokens):
            end = min(start + chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            chunks.append(self.enc.decode(chunk_tokens))
            start += chunk_size - overlap

        return chunks

# Usage example
optimizer = BatchTokenOptimizer("gpt-4o")

# Batch processing of large volumes of text
documents = [f"Document {i}: " + "Test sentence. " * 100 for i in range(50)]

for batch_idx, batch in enumerate(optimizer.create_batches(documents)):
    print(f"Batch {batch_idx + 1}: {len(batch)} documents")

# Token-based text splitting
long_text = "This is a very long text. " * 500
chunks = optimizer.split_by_tokens(long_text, chunk_size=512, overlap=64)
print(f"Number of chunks: {len(chunks)}")
```

### Comparison Table 2: Tokenizer Characteristics by Model

| Model | Tokenizer | Vocabulary Size | Japanese Efficiency | Special Tokens |
|-------|-----------|----------------|--------------------|--------------------|
| GPT-4o | cl100k_base+ | ~200K | High (improved) | <\|endoftext\|> etc. |
| Claude 3.5 | Proprietary BPE | ~150K | High | Not disclosed |
| Llama 3.1 | tiktoken-derived | 128K | Medium-High | <\|begin_of_text\|> etc. |
| Gemini 1.5 | SentencePiece | ~256K | High | Not disclosed |
| Gemma 2 | SentencePiece | 256K | High | <bos>, <eos> etc. |

### Comparison Table: Token Efficiency by Language

| Language | GPT-4o | Llama 3.1 | Gemini 1.5 | Notes |
|----------|--------|-----------|-----------|-------|
| English | ~0.25 tokens/char | ~0.25 tokens/char | ~0.25 tokens/char | Nearly equivalent |
| Japanese | ~0.7 tokens/char | ~1.2 tokens/char | ~0.6 tokens/char | Large variance |
| Chinese | ~0.6 tokens/char | ~1.0 tokens/char | ~0.5 tokens/char | Difference in kanji handling |
| Korean | ~0.8 tokens/char | ~1.3 tokens/char | ~0.7 tokens/char | Hangul processing |
| Code | ~0.3 tokens/char | ~0.3 tokens/char | ~0.3 tokens/char | Nearly equivalent |
| Math | ~0.5 tokens/char | ~0.5 tokens/char | ~0.4 tokens/char | Depends on special symbols |

---

## 4. Practical Challenges in Tokenization

### 4.1 Handling Special Characters and Unicode

```python
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")

# Verify tokenization of special characters
test_cases = {
    "Emoji": "🎉🚀💡🔥",
    "Math symbols": "∑∫∂∇∞",
    "CJK extension": "𠮷𩸽𠀋",
    "Control chars": "Tab\tand\nnewline",
    "Zero-width char": "hello\u200bworld",  # zero-width space
    "Combining chars": "がぎぐげご",  # voiced/semi-voiced marks
    "URL": "https://example.com/path?q=test&lang=ja",
    "JSON": '{"key": "value", "num": 42}',
    "Code": 'def hello():\n    print("Hello")',
}

for name, text in test_cases.items():
    tokens = enc.encode(text)
    print(f"{name:<15}: {len(text):>3} chars → {len(tokens):>3} tokens "
          f"(efficiency: {len(text)/len(tokens):.2f} chars/token)")
```

### 4.2 Token Boundary Issues

When token splits occur at semantically inappropriate positions, it can affect the model's understanding.

```python
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")

# Visualize token boundary issues
def visualize_tokenization(text: str):
    """Visually display token splits"""
    tokens = enc.encode(text)
    result = []
    for token_id in tokens:
        token_str = enc.decode([token_id])
        result.append(f"[{token_str}]")
    print(f"Original: {text}")
    print(f"Split: {''.join(result)}")
    print(f"Token count: {len(tokens)}")
    print()

# Problematic examples
visualize_tokenization("unhappiness")      # Normal: [un][happiness]
visualize_tokenization("123456789")         # Digit splitting
visualize_tokenization("user@example.com")  # Email address
visualize_tokenization("2024-03-15T10:30:00Z")  # ISO datetime
visualize_tokenization("192.168.1.1")       # IP address
visualize_tokenization("東京都千代田区丸の内1-1-1")  # Japanese address
```

### 4.3 Prompt Injection and Tokenization

```python
# Examples of prompt injection attacks exploiting tokenization, and countermeasures

class TokenSanitizer:
    """Input sanitization at the token level"""

    DANGEROUS_TOKEN_PATTERNS = [
        b"<|im_start|>",   # ChatML injection
        b"<|im_end|>",
        b"<|endoftext|>",
        b"[INST]",          # Llama format
        b"[/INST]",
        b"<s>",
        b"</s>",
    ]

    def __init__(self, model: str = "gpt-4o"):
        import tiktoken
        self.enc = tiktoken.encoding_for_model(model)

    def sanitize(self, text: str) -> str:
        """Remove dangerous token patterns"""
        sanitized = text
        for pattern in self.DANGEROUS_TOKEN_PATTERNS:
            pattern_str = pattern.decode("utf-8", errors="ignore")
            if pattern_str in sanitized:
                sanitized = sanitized.replace(pattern_str, "")
        return sanitized

    def validate_token_count(self, text: str,
                              max_tokens: int) -> tuple[bool, int]:
        """Validate that token count is within the limit"""
        tokens = self.enc.encode(text)
        return len(tokens) <= max_tokens, len(tokens)
```

---

## 5. Troubleshooting

### 5.1 Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| More tokens than expected | Poor efficiency with Japanese text | Split chunks by token count |
| Garbled text on decode | Multibyte characters split across token boundaries | Switch to a model using byte-level BPE |
| API calls fail | Context length exceeded | Manage with ContextWindowManager |
| Cost exceeds budget | Underestimated output tokens | Set max_tokens + track costs |
| Tokenization is slow | Sequential processing of large volumes of text | Batch processing + multithreading |
| Token count mismatch across models | Differences in tokenizers | Use model-specific counters |

### 5.2 Debugging Techniques

```python
def debug_tokenization(text: str, models: list[str] = None):
    """Display tokenization results for multiple models for debugging"""
    import tiktoken

    if models is None:
        models = ["gpt-4o", "gpt-4o-mini"]

    print(f"Text: {text[:50]}{'...' if len(text) > 50 else ''}")
    print(f"Characters: {len(text)}, Bytes: {len(text.encode('utf-8'))}")
    print("-" * 60)

    for model in models:
        try:
            enc = tiktoken.encoding_for_model(model)
            tokens = enc.encode(text)
            decoded_tokens = [enc.decode([t]) for t in tokens]

            print(f"\n{model}:")
            print(f"  Token count: {len(tokens)}")
            print(f"  Chars/token: {len(text)/len(tokens):.2f}")
            print(f"  First 5 tokens: {decoded_tokens[:5]}")
            print(f"  Last 5 tokens: {decoded_tokens[-5:]}")
        except Exception as e:
            print(f"  {model}: Error - {e}")

# Run debug
debug_tokenization("Transformerアーキテクチャは自然言語処理に革命をもたらした。")
```

---

## 6. Performance Optimization

### 6.1 Tokenizer Benchmarking

```python
import time
import tiktoken

def benchmark_tokenizer(text: str, iterations: int = 1000):
    """Benchmark tokenizer speed"""
    enc = tiktoken.encoding_for_model("gpt-4o")

    # Encoding speed
    start = time.perf_counter()
    for _ in range(iterations):
        tokens = enc.encode(text)
    encode_time = (time.perf_counter() - start) / iterations

    # Decoding speed
    tokens = enc.encode(text)
    start = time.perf_counter()
    for _ in range(iterations):
        enc.decode(tokens)
    decode_time = (time.perf_counter() - start) / iterations

    text_bytes = len(text.encode("utf-8"))
    print(f"Text size: {text_bytes:,} bytes")
    print(f"Token count: {len(tokens):,}")
    print(f"Encode: {encode_time*1000:.3f} ms "
          f"({text_bytes/encode_time/1024/1024:.1f} MB/s)")
    print(f"Decode: {decode_time*1000:.3f} ms "
          f"({text_bytes/decode_time/1024/1024:.1f} MB/s)")

# Run benchmark
short_text = "Hello, World!" * 10
long_text = "大規模言語モデルの性能は素晴らしい。" * 1000

print("=== Short Text ===")
benchmark_tokenizer(short_text)
print("\n=== Long Text ===")
benchmark_tokenizer(long_text, iterations=100)
```

### 6.2 Memory Efficiency Optimization

```python
class StreamingTokenCounter:
    """Count tokens in a memory-efficient streaming fashion"""

    def __init__(self, model: str = "gpt-4o"):
        import tiktoken
        self.enc = tiktoken.encoding_for_model(model)

    def count_file(self, filepath: str,
                    chunk_size: int = 1024 * 1024) -> int:
        """Count tokens by reading a file in chunks"""
        total_tokens = 0

        with open(filepath, "r", encoding="utf-8") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                total_tokens += len(self.enc.encode(chunk))

        return total_tokens

    def count_streaming(self, text_generator) -> int:
        """Count tokens by streaming from a generator"""
        total_tokens = 0
        for text in text_generator:
            total_tokens += len(self.enc.encode(text))
        return total_tokens
```

---

## Anti-Patterns

### Anti-Pattern 1: Prompt Design That Ignores Token Count

```
Wrong: Send verbose instructions in full every time
  → Enormous token consumption, cost explosion

# Bad example
prompt = """
You are a very capable assistant. Your role is...
(1000-token system prompt)
""" + user_message  # 1000-token overhead every time

# Good example: concise prompt + leverage caching
prompt = "Reply in JSON format." + user_message
# Or use the API's system prompt caching
```

### Anti-Pattern 2: Ignoring Token Efficiency by Language

```
Wrong: Design token limits based on English
  → Japanese may consume 1.5-2x as many tokens for the same content

# How to check
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")

en = "The capital of Japan is Tokyo."
ja = "日本の首都は東京です。"

print(f"English: {len(enc.encode(en))} tokens ({len(en)} chars)")
print(f"Japanese: {len(enc.encode(ja))} tokens ({len(ja)} chars)")
# Japanese tends to use more tokens per character
```

### Anti-Pattern 3: Tokenizer Mismatch

```
Wrong: Using the GPT-4o tokenizer to estimate Claude's token count
  → Diverges from actual token count, leading to inaccurate cost estimates

# Bad example
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")
claude_tokens = len(enc.encode(text))  # ← This is NOT Claude's token count!

# Good example: use each provider's token counting API
# Anthropic: get accurate count via response.usage.input_tokens
# Or: anthropic.count_tokens() method (when available)
```

### Anti-Pattern 4: Ignoring Special Tokens

```
Wrong: Calculate context usage from text token count alone
  → Special tokens (BOS, EOS, delimiters, etc.) are added on top

# Actual token usage:
# text tokens + special tokens + message format overhead
# OpenAI: approximately 4 tokens of overhead per message
# Claude: additional tokens depending on message structure

# Refer to the API's usage field for accurate counts
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also create test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise in basic implementation patterns"""

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

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise in advanced patterns"""

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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology decisions.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → go to ②              │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily/multiple times → go to ③            │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze them from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has a high short-term cost and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is more intuitive but tends to lead to code duplication

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

## FAQ

### Q1: Can token counts be compared across models with different tokenizers?

**A:** Accurate comparison is not possible. The same text will have different token counts in GPT-4o vs. Llama 3. When comparing costs, you need to count separately with each model's tokenizer. However, as a rough guideline, 1 token is approximately 4 characters in English, and approximately 1-2 characters in Japanese.

### Q2: What happens when the context window is exceeded?

**A:** The API returns an error. Countermeasures include: (1) summarize the text to shorten it, (2) split into chunks and process across multiple calls, (3) use RAG to retrieve only relevant portions, (4) switch to a model with a longer context length.

### Q3: Which model has the best token efficiency for Japanese?

**A:** As of 2024, GPT-4o and Gemini 1.5 excel in Japanese token efficiency. GPT-4o in particular has improved significantly from the previous generation. Claude 3.5 also has high Japanese token efficiency. However, evaluate actual cost by multiplying token efficiency by the unit price, not token efficiency alone.

### Q4: In what cases should you create a custom tokenizer?

**A:** A custom tokenizer is worth considering in the following cases:
- When there are many **domain-specific technical terms** (medical, legal, chemical formulas, etc.)
- When handling **special symbol systems** (programming languages, mathematical formulas, musical notation, etc.)
- When training or fine-tuning a **local LLM** yourself
- In large-scale batch processing where **token efficiency** directly impacts cost

However, when using an existing model via API, you must use that model's tokenizer, so a custom tokenizer cannot be used.

### Q5: How does Prompt Caching affect token costs?

**A:** Using Prompt Caching significantly reduces the input cost for the cached portion of a prompt. With Anthropic, the input price on a cache hit is 10% of the normal price. OpenAI provides a similar caching mechanism. This is especially effective when reusing long system prompts or few-shot examples repeatedly.

### Q6: How are multimodal inputs (images, etc.) converted to tokens?

**A:** Images are converted to token counts based on pixel count.
- **OpenAI GPT-4o**: approximately 85 tokens at low resolution, up to approximately 1,700 tokens at high resolution (170 tokens per 512x512 tile)
- **Claude**: automatically calculated based on image size (approximately 1,600 tokens for a 1,000x1,000px image)
- **Gemini**: approximately 258 tokens per image (fixed)

---

## Summary

| Item | Key Point |
|------|-----------|
| BPE | A method that builds a subword vocabulary by merging the most frequent pairs |
| SentencePiece | A language-independent tokenization framework |
| tiktoken | OpenAI's high-speed BPE implementation, used by GPT models |
| Byte-Level BPE | Processes at the byte level; unknown words are fundamentally impossible |
| Unigram LM | Top-down approach; probabilistic splitting provides regularization effect |
| Japanese efficiency | Often requires 1.5-2x as many tokens as English |
| Cost management | Understanding input/output token counts and optimizing prompts is critical |
| Context management | Use sliding window or summarization to stay within the window |
| Vocabulary size | Ranges from 32K to 256K; larger is more efficient but increases training cost |
| Prompt Caching | Can reduce repeated prompt costs by up to 90% |

---

## What to Read Next

- [02-inference.md](./02-inference.md) — Optimizing inference parameters (temperature, Top-p)
- [../02-applications/00-prompt-engineering.md](../02-applications/00-prompt-engineering.md) — Practical prompt engineering
- [../03-infrastructure/01-vector-databases.md](../03-infrastructure/01-vector-databases.md) — Embeddings and vector databases

---

## References

1. Sennrich, R. et al. (2016). "Neural Machine Translation of Rare Words with Subword Units (BPE)." *ACL 2016*. https://arxiv.org/abs/1508.07909
2. Kudo, T. & Richardson, J. (2018). "SentencePiece: A simple and language independent subword tokenizer." *EMNLP 2018*. https://arxiv.org/abs/1808.06226
3. OpenAI. "tiktoken: Fast BPE tokeniser for use with OpenAI's models." https://github.com/openai/tiktoken
4. Kudo, T. (2018). "Subword Regularization: Improving Neural Network Translation Models with Multiple Subword Candidates." *ACL 2018*. https://arxiv.org/abs/1804.10959
5. Radford, A. et al. (2019). "Language Models are Unsupervised Multitask Learners." *OpenAI*. (GPT-2 Byte-Level BPE)
6. Hugging Face. "Summary of the tokenizers." https://huggingface.co/docs/transformers/tokenizer_summary
