# LLM Overview — Fundamentals of Large Language Models

> A systematic overview of LLMs covering Transformer architecture, scaling laws, training methods, and inference optimization.

## What You Will Learn in This Chapter

1. How the **Transformer architecture** works and the principles of Self-Attention
2. How **scaling laws** affect model performance and what parameter counts mean
3. The stages of **pre-training and post-training** and representative training techniques
4. Types of **positional encoding** and the evolution toward long-context support
5. How the **Mixture of Experts (MoE)** architecture works and its advantages
6. **Inference optimization** techniques and deployment considerations


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Transformer Architecture

### 1.1 The Principles of Self-Attention

Self-Attention is a mechanism where each token in an input sequence computes its relevance to every other token and generates context-aware representations. While traditional RNN/LSTM models required sequential processing of sequences, Self-Attention can compute relationships among all tokens simultaneously in parallel, dramatically improving training efficiency.

### Code Example 1: Self-Attention Computation (NumPy)

```python
import numpy as np

def self_attention(Q, K, V, mask=None):
    """スケーリングドット積アテンション

    Args:
        Q: クエリ行列 (seq_len, d_k)
        K: キー行列 (seq_len, d_k)
        V: バリュー行列 (seq_len, d_v)
        mask: オプションのマスク行列（因果マスクなど）

    Returns:
        出力行列とアテンション重み
    """
    d_k = Q.shape[-1]

    # スケーリングドット積
    scores = np.matmul(Q, K.T) / np.sqrt(d_k)

    # マスクの適用（因果的言語モデルの場合）
    if mask is not None:
        scores = np.where(mask == 0, -1e9, scores)

    # Softmax で正規化
    exp_scores = np.exp(scores - np.max(scores, axis=-1, keepdims=True))
    weights = exp_scores / exp_scores.sum(axis=-1, keepdims=True)

    # 加重和
    output = np.matmul(weights, V)
    return output, weights

# 例: 4トークン、次元8
np.random.seed(42)
seq_len = 4
d_k = 8

Q = np.random.randn(seq_len, d_k)
K = np.random.randn(seq_len, d_k)
V = np.random.randn(seq_len, d_k)

# 因果マスク（下三角行列）- デコーダ用
causal_mask = np.tril(np.ones((seq_len, seq_len)))
print("因果マスク:")
print(causal_mask)

output, weights = self_attention(Q, K, V, mask=causal_mask)
print(f"\n出力形状: {output.shape}")  # (4, 8)
print(f"アテンション重み形状: {weights.shape}")  # (4, 4)
print(f"\nアテンション重み（各行の合計=1）:")
print(weights.round(3))
```

### Code Example 2: Multi-Head Attention Implementation

```python
import numpy as np

class MultiHeadAttention:
    """Multi-Head Attention の NumPy 実装"""

    def __init__(self, d_model: int, num_heads: int):
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        # 重み行列の初期化（Xavier初期化）
        scale = np.sqrt(2.0 / d_model)
        self.W_q = np.random.randn(d_model, d_model) * scale
        self.W_k = np.random.randn(d_model, d_model) * scale
        self.W_v = np.random.randn(d_model, d_model) * scale
        self.W_o = np.random.randn(d_model, d_model) * scale

    def split_heads(self, x):
        """(seq_len, d_model) → (num_heads, seq_len, d_k)"""
        seq_len = x.shape[0]
        x = x.reshape(seq_len, self.num_heads, self.d_k)
        return x.transpose(1, 0, 2)

    def forward(self, x, mask=None):
        """Multi-Head Attention の前方計算"""
        # 線形変換
        Q = x @ self.W_q
        K = x @ self.W_k
        V = x @ self.W_v

        # ヘッド分割
        Q = self.split_heads(Q)  # (num_heads, seq_len, d_k)
        K = self.split_heads(K)
        V = self.split_heads(V)

        # 各ヘッドでアテンション計算
        d_k = self.d_k
        scores = np.matmul(Q, K.transpose(0, 2, 1)) / np.sqrt(d_k)

        if mask is not None:
            scores = np.where(mask == 0, -1e9, scores)

        exp_scores = np.exp(scores - np.max(scores, axis=-1, keepdims=True))
        weights = exp_scores / exp_scores.sum(axis=-1, keepdims=True)

        attended = np.matmul(weights, V)  # (num_heads, seq_len, d_k)

        # ヘッド結合
        seq_len = attended.shape[1]
        concat = attended.transpose(1, 0, 2).reshape(seq_len, self.d_model)

        # 出力射影
        output = concat @ self.W_o
        return output, weights

# 使用例
np.random.seed(42)
mha = MultiHeadAttention(d_model=64, num_heads=8)
x = np.random.randn(10, 64)  # 10トークン、次元64
output, weights = mha.forward(x)
print(f"入力形状: {x.shape}")       # (10, 64)
print(f"出力形状: {output.shape}")   # (10, 64)
print(f"重み形状: {weights.shape}")  # (8, 10, 10) - 8ヘッド
```

### ASCII Diagram 1: Transformer Block Structure

```
┌───────────────────────────────────┐
│         出力 (次の層へ)            │
├───────────────────────────────────┤
│      Layer Norm + 残差接続         │
│      output = LN(x + FFN(x))     │
├───────────────────────────────────┤
│     Feed-Forward Network (FFN)    │
│     ┌─────┐  ┌──────┐  ┌─────┐  │
│     │Lin. │→│SwiGLU│→│Lin. │  │
│     │d→4d │  │      │  │4d→d │  │
│     └─────┘  └──────┘  └─────┘  │
├───────────────────────────────────┤
│      Layer Norm + 残差接続         │
│      x = LN(input + MHA(input))  │
├───────────────────────────────────┤
│   Multi-Head Self-Attention       │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │Head 1│ │Head 2│ │Head N│     │
│  │Q K V │ │Q K V │ │Q K V │     │
│  └──────┘ └──────┘ └──────┘     │
│        ↓ Concat + Linear         │
├───────────────────────────────────┤
│   入力エンベディング + 位置符号化    │
│   x = Embed(token) + PosEnc(pos) │
└───────────────────────────────────┘
```

### 1.2 Encoder vs Decoder

```
┌─────────────────────────────────────────────────────────────────┐
│                   Transformer Architecture Types                 │
├─────────────┬──────────────────┬────────────────────────────────┤
│ Type         │ Representative   │ Characteristics               │
├─────────────┼──────────────────┼────────────────────────────────┤
│ Encoder      │ BERT, RoBERTa   │ Bidirectional attention         │
│ only         │ DeBERTa          │ Best for classification, NER,  │
│              │                  │ similarity; sees full context  │
├─────────────┼──────────────────┼────────────────────────────────┤
│ Decoder      │ GPT, LLaMA      │ Causal (left→right) attention   │
│ only         │ Claude, Gemini   │ Best for text generation/chat  │
│              │                  │ Generates tokens autoregressively│
├─────────────┼──────────────────┼────────────────────────────────┤
│ Encoder-     │ T5, BART        │ Encodes input → decodes output  │
│ Decoder      │ mBART            │ Best for translation, summarization│
│              │                  │ Cross-Attention references input│
└─────────────┴──────────────────┴────────────────────────────────┘

Modern LLM mainstream:
  → Decoder-only architecture
  → Can uniformly handle diverse tasks
  → Most efficient for scaling
```

### Code Example 3: Transformer Layer in PyTorch

```python
import torch
import torch.nn as nn

class TransformerBlock(nn.Module):
    """LLM スタイルの Transformer ブロック（Pre-LN 構成）"""

    def __init__(self, d_model=512, nhead=8, dim_ff=2048, dropout=0.1):
        super().__init__()

        # Pre-LayerNorm 構成（GPT-2 以降の標準）
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(
            d_model, nhead, dropout=dropout, batch_first=True
        )

        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, dim_ff),
            nn.GELU(),              # ReLU → GELU が現代の標準
            nn.Dropout(dropout),
            nn.Linear(dim_ff, d_model),
            nn.Dropout(dropout),
        )

    def forward(self, x, attn_mask=None):
        # Pre-LN + 残差接続（Self-Attention）
        normed = self.ln1(x)
        attn_out, _ = self.attn(normed, normed, normed, attn_mask=attn_mask)
        x = x + attn_out

        # Pre-LN + 残差接続（FFN）
        normed = self.ln2(x)
        ffn_out = self.ffn(normed)
        x = x + ffn_out

        return x

# 使用例
block = TransformerBlock(d_model=512, nhead=8, dim_ff=2048)
src = torch.randn(2, 10, 512)  # (バッチ=2, シーケンス長=10, 次元=512)
output = block(src)
print(f"出力形状: {output.shape}")  # torch.Size([2, 10, 512])

# パラメータ数の確認
total_params = sum(p.numel() for p in block.parameters())
print(f"パラメータ数: {total_params:,}")  # 約4.2M
```

### Code Example 4: Generating Causal Masks

```python
import torch

def create_causal_mask(seq_len: int) -> torch.Tensor:
    """因果的アテンションマスクの生成

    デコーダモデルでは、各位置は自分自身と
    それ以前の位置のみ参照可能。
    """
    mask = torch.triu(torch.ones(seq_len, seq_len), diagonal=1)
    mask = mask.masked_fill(mask == 1, float('-inf'))
    return mask

# 8トークンのマスク
mask = create_causal_mask(8)
print("因果マスク（0=参照可能、-inf=マスク）:")
print(mask)

# Sliding Window Attention のマスク（Mistral 方式）
def create_sliding_window_mask(seq_len: int, window_size: int) -> torch.Tensor:
    """Sliding Window Attention マスク

    各位置は window_size 以内のトークンのみ参照可能。
    長いシーケンスでもメモリ使用量を O(n*w) に抑制。
    """
    mask = torch.zeros(seq_len, seq_len)
    for i in range(seq_len):
        # 因果マスク（未来は見えない）+ ウィンドウ制限
        start = max(0, i - window_size + 1)
        mask[i, :start] = float('-inf')
        mask[i, i+1:] = float('-inf')
    return mask

sw_mask = create_sliding_window_mask(8, window_size=3)
print("\nSliding Window マスク (window=3):")
print(sw_mask)
```

---

## 2. Positional Encoding

### 2.1 Why Positional Information Is Needed

Self-Attention enables parallel computation but carries no inherent information about token order, making positional encoding essential.

### ASCII Diagram 2: Evolution of Positional Encoding

```
┌──────────────────────────────────────────────────────────────────┐
│                  Evolution of Positional Encoding                 │
├────────────────┬─────────────────────────────────────────────────┤
│ Absolute       │ Sinusoidal (original paper) → learnable         │
│ position       │ embeddings (GPT)                                 │
│                │ PE(pos, 2i) = sin(pos / 10000^(2i/d))          │
│                │ Fixed-length constraint                          │
├────────────────┼─────────────────────────────────────────────────┤
│ Relative       │ ALiBi (BLOOM) → adds linear bias directly       │
│ position       │ No training needed, can extrapolate to any length│
├────────────────┼─────────────────────────────────────────────────┤
│ Rotary         │ RoPE (LLaMA, Qwen) → encodes position with      │
│ position       │ rotation matrices; preserves relative-position   │
│ encoding       │ dot products; NTK-aware scaling for long context │
├────────────────┼─────────────────────────────────────────────────┤
│ Latest         │ YaRN → improved RoPE, more efficient            │
│ methods        │ extrapolation                                    │
│                │ LongRoPE → supports up to millions of tokens    │
└────────────────┴─────────────────────────────────────────────────┘
```

### Code Example 5: RoPE (Rotary Position Embedding) Implementation

```python
import numpy as np

def compute_rope_embeddings(seq_len: int, d_model: int, base: float = 10000.0):
    """RoPE (Rotary Position Embedding) の計算

    各次元ペアに対して異なる周波数の回転を適用。
    位置 p のトークンの次元 (2i, 2i+1) に対して:
        cos(p * theta_i), sin(p * theta_i)
    を掛け合わせる。
    """
    # 各次元ペアの周波数 theta
    dim_pairs = d_model // 2
    theta = 1.0 / (base ** (np.arange(0, d_model, 2) / d_model))

    # 位置 × 周波数
    positions = np.arange(seq_len)
    angles = np.outer(positions, theta)  # (seq_len, dim_pairs)

    cos_vals = np.cos(angles)
    sin_vals = np.sin(angles)

    return cos_vals, sin_vals

def apply_rope(x, cos_vals, sin_vals):
    """RoPE をクエリ/キーベクトルに適用"""
    d = x.shape[-1]
    x1 = x[..., :d//2]
    x2 = x[..., d//2:]

    # 回転の適用
    rotated = np.concatenate([
        x1 * cos_vals - x2 * sin_vals,
        x1 * sin_vals + x2 * cos_vals
    ], axis=-1)

    return rotated

# 使用例
seq_len = 16
d_model = 64
cos_vals, sin_vals = compute_rope_embeddings(seq_len, d_model)

# クエリとキーに RoPE を適用
Q = np.random.randn(seq_len, d_model)
K = np.random.randn(seq_len, d_model)

Q_rotated = apply_rope(Q, cos_vals, sin_vals)
K_rotated = apply_rope(K, cos_vals, sin_vals)

print(f"元のクエリ形状: {Q.shape}")
print(f"回転後のクエリ形状: {Q_rotated.shape}")

# 相対位置の内積が保持されることを確認
# 位置 i と j の内積は |i - j| のみに依存
dot_original = np.sum(Q[3] * K[5])
dot_rotated = np.sum(Q_rotated[3] * K_rotated[5])
print(f"\n元の内積 (pos 3, 5): {dot_original:.4f}")
print(f"RoPE後の内積 (pos 3, 5): {dot_rotated:.4f}")
```

---

## 3. Scaling Laws

### ASCII Diagram 3: The Three Elements of Scaling Laws

```
Performance (Loss)
│
│  ╲
│   ╲  ← Increase number of parameters N
│    ╲
│     ╲───────────
│
│  ╲
│   ╲  ← Increase data volume D
│    ╲
│     ╲───────────
│
│  ╲
│   ╲  ← Increase compute C
│    ╲
│     ╲───────────
└──────────────────→ Scale (log scale)

Chinchilla Scaling Law:
L(N, D) ≈ E + A/N^α + B/D^β
- N: number of parameters
- D: number of training tokens
- α ≈ 0.34, β ≈ 0.28
- E: irreducible loss (due to entropy of data)

Optimal compute allocation:
  N_opt ∝ C^0.5   (parameters scale as square root of compute)
  D_opt ∝ C^0.5   (data also scales as square root of compute)
  → Optimal to increase parameters and data at the same ratio
```

### Code Example 6: Scaling Law Estimation and Visualization

```python
import numpy as np

def estimate_loss(params_billions, tokens_trillions):
    """Chinchilla 式での Loss 推定（簡易版）"""
    E = 1.69     # 不可約損失
    A = 406.4
    B = 410.7
    alpha = 0.34
    beta = 0.28

    N = params_billions * 1e9
    D = tokens_trillions * 1e12

    loss = E + A / (N ** alpha) + B / (D ** beta)
    return loss

def compute_optimal_allocation(compute_budget_flops):
    """与えられた計算予算での最適なパラメータ数・データ量を推定

    Chinchilla の知見: N ≈ D / 20 (トークン/パラメータ比 ≈ 20)
    FLOPs ≈ 6 * N * D
    """
    # C = 6 * N * D, D = 20 * N
    # C = 6 * N * 20 * N = 120 * N^2
    N_opt = np.sqrt(compute_budget_flops / 120)
    D_opt = 20 * N_opt
    return N_opt, D_opt

# 各モデルサイズでの推定 Loss
print("=" * 60)
print(f"{'Params':>8} {'Tokens':>8} {'Loss':>8} {'最適比':>10}")
print("=" * 60)
for params in [7, 13, 70, 405]:
    for tokens in [1, 2, 5, 15]:
        loss = estimate_loss(params, tokens)
        ratio = tokens * 1e12 / (params * 1e9)
        optimal = "***" if 15 <= ratio <= 25 else ""
        print(f"{params:>5}B  {tokens:>5}T  {loss:>8.3f}  {ratio:>6.0f}:1 {optimal}")

# 計算予算に対する最適配分
print("\n" + "=" * 60)
print("計算予算に対する最適配分（Chinchilla則）")
print("=" * 60)
budgets_names = [
    ("1e21 (小規模実験)", 1e21),
    ("1e23 (7B級)", 1e23),
    ("1e24 (70B級)", 1e24),
    ("1e25 (GPT-4級)", 1e25),
]
for name, budget in budgets_names:
    N_opt, D_opt = compute_optimal_allocation(budget)
    print(f"\n計算予算: {name}")
    print(f"  最適パラメータ数: {N_opt/1e9:.1f}B")
    print(f"  最適トークン数: {D_opt/1e12:.2f}T")
    print(f"  推定Loss: {estimate_loss(N_opt/1e9, D_opt/1e12):.3f}")
```

### 3.1 Practical Implications of Scaling Laws

```
┌──────────────────────────────────────────────────────────────────┐
│              Practical Meaning of Scaling Laws                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Predictability                                                │
│    Small-scale experiments → can predict large model performance │
│    with high accuracy                                            │
│    → Allows optimizing compute budget allocation in advance      │
│                                                                  │
│ 2. Investment decisions                                          │
│    10x compute → quantitatively estimate ~X% Loss improvement    │
│    → ROI can be evaluated in advance                             │
│                                                                  │
│ 3. Lessons from Chinchilla vs GPT-3                             │
│    GPT-3: 175B params, 300B tokens (1.7:1)                      │
│    Chinchilla optimal: 175B params → 3.5T tokens (20:1)         │
│    → GPT-3 was "over-parameterized and data-starved"             │
│                                                                  │
│ 4. Inference efficiency considerations (Llama 3 strategy)       │
│    Use more data than Chinchilla optimal, achieve high           │
│    performance with smaller models                               │
│    8B + 15T tokens → reduced inference cost + maintained perf.  │
│    → Holistic optimization including "inference compute cost"    │
│                                                                  │
│ 5. Emergent Abilities                                           │
│    New capabilities suddenly appear beyond certain scale         │
│    thresholds                                                    │
│    → Chain-of-Thought reasoning, code generation, multilingual  │
│      ability, etc.                                               │
│    → Qualitative changes that scaling laws cannot predict        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Comparison Table 1: Parameters and Training Data for Representative Models

| Model | Parameters | Training Tokens | Context Length | Architecture | Released |
|--------|-------------|---------------|---------------|---------------|--------|
| GPT-3 | 175B | 300B | 2,048 | Dense Decoder | 2020 |
| Chinchilla | 70B | 1.4T | 2,048 | Dense Decoder | 2022 |
| LLaMA 2 | 7-70B | 2T | 4,096 | Dense Decoder | 2023 |
| GPT-4 | Undisclosed (est. 1.8T MoE) | Undisclosed | 128K | MoE Decoder | 2023 |
| Mixtral 8x7B | 46.7B (active 12.9B) | Undisclosed | 32K | MoE Decoder | 2023 |
| Claude 3.5 Sonnet | Undisclosed | Undisclosed | 200K | Undisclosed | 2024 |
| LLaMA 3.1 | 8-405B | 15T+ | 128K | Dense Decoder | 2024 |
| Gemini 1.5 Pro | Undisclosed | Undisclosed | 1M+ | MoE Decoder | 2024 |
| DeepSeek-V3 | 671B (active 37B) | 14.8T | 128K | MoE Decoder | 2024 |
| Qwen 2.5 | 0.5-72B | 18T+ | 128K | Dense Decoder | 2024 |

---

## 4. Mixture of Experts (MoE) Architecture

### ASCII Diagram 4: MoE Structure

```
┌─────────────────────────────────────────────────────────────┐
│                  Mixture of Experts (MoE)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input token x                                              │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                              │
│  │ Gate     │ → softmax → Top-K selection                  │
│  │ Network  │                                              │
│  └──────────┘                                              │
│       │                                                     │
│       ▼                                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ... ┌─────┐            │
│  │ E_1 │ │ E_2 │ │ E_3 │ │ E_4 │     │ E_N │            │
│  │ FFN │ │ FFN │ │ FFN │ │ FFN │     │ FFN │            │
│  └─────┘ └─────┘ └─────┘ └─────┘     └─────┘            │
│    ✓       ✓                              (inactive)       │
│    │       │                                               │
│    ▼       ▼                                               │
│  Weighted sum: output = Σ g_i * Expert_i(x)               │
│                                                             │
│  Example: Mixtral 8x7B                                     │
│    - 8 experts, top 2 selected per token                   │
│    - Total params: 46.7B, active params: 12.9B             │
│    - 70B-class performance at Dense 13B inference cost     │
│                                                             │
│  Example: DeepSeek-V3                                      │
│    - 256 experts + 1 shared expert                         │
│    - Top 8 selected per token                              │
│    - Total params: 671B, active params: 37B                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Code Example 7: Simple MoE Layer

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MoELayer(nn.Module):
    """Mixture of Experts レイヤー（簡易実装）"""

    def __init__(
        self,
        d_model: int = 512,
        num_experts: int = 8,
        top_k: int = 2,
        dim_ff: int = 2048,
    ):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k

        # ゲートネットワーク
        self.gate = nn.Linear(d_model, num_experts, bias=False)

        # エキスパート（各エキスパートは FFN）
        self.experts = nn.ModuleList([
            nn.Sequential(
                nn.Linear(d_model, dim_ff),
                nn.GELU(),
                nn.Linear(dim_ff, d_model),
            )
            for _ in range(num_experts)
        ])

    def forward(self, x):
        """
        Args:
            x: (batch_size, seq_len, d_model)
        Returns:
            output: (batch_size, seq_len, d_model)
        """
        batch_size, seq_len, d_model = x.shape
        x_flat = x.view(-1, d_model)  # (B*S, d_model)

        # ゲート計算
        gate_logits = self.gate(x_flat)  # (B*S, num_experts)
        gate_probs = F.softmax(gate_logits, dim=-1)

        # Top-K エキスパート選択
        top_k_probs, top_k_indices = torch.topk(gate_probs, self.top_k, dim=-1)
        top_k_probs = top_k_probs / top_k_probs.sum(dim=-1, keepdim=True)

        # 各エキスパートの出力を加重合算
        output = torch.zeros_like(x_flat)
        for k in range(self.top_k):
            expert_indices = top_k_indices[:, k]
            expert_weights = top_k_probs[:, k].unsqueeze(-1)

            for i in range(self.num_experts):
                mask = (expert_indices == i)
                if mask.any():
                    expert_input = x_flat[mask]
                    expert_output = self.expertsi
                    output[mask] += expert_weights[mask] * expert_output

        return output.view(batch_size, seq_len, d_model)

# 使用例
moe = MoELayer(d_model=512, num_experts=8, top_k=2)
x = torch.randn(2, 10, 512)
output = moe(x)
print(f"入力: {x.shape} → 出力: {output.shape}")

total_params = sum(p.numel() for p in moe.parameters())
print(f"総パラメータ数: {total_params:,}")
# 8エキスパートの FFN + ゲート
```

### Comparison Table 2: Dense vs MoE

| Item | Dense Model | MoE Model |
|------|-------------|-----------|
| Parameter efficiency | All parameters always active | Only a subset active (reduced inference cost) |
| Training stability | Stable | Load balancing is a challenge |
| Memory usage | Proportional to parameter count | Must hold all experts in memory |
| Inference speed | Proportional to parameter count | Proportional to active parameter count |
| Performance/FLOP | Baseline | Higher performance for same FLOPs |
| Deployment complexity | Low | High (expert distribution required) |
| Representative models | LLaMA 3.1 405B | Mixtral 8x7B, DeepSeek-V3 |

---

## 5. Training Methods

### ASCII Diagram 5: The 3 Stages of LLM Training

```
┌─────────────────────────────────────────────────────────────────┐
│  Stage 1: Pre-training                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Objective: Learn statistical patterns of language           ││
│  │ Data: Web text, books, code (trillions of tokens)           ││
│  │ Method: Next-token prediction (self-supervised learning)    ││
│  │ Loss: L = -Σ log P(x_t | x_<t)                             ││
│  │ Cost: Thousands to tens of thousands of GPUs × months       ││
│  │       = Millions to tens of millions of dollars             ││
│  │ Compute: 6 * N * D FLOPs (N=params, D=tokens)              ││
│  └─────────────────────────────────────────────────────────────┘│
│                           ↓                                     │
│  Stage 2: Supervised Fine-Tuning (SFT)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Objective: Acquire ability to respond to instructions       ││
│  │ Data: High-quality instruction-response pairs (tens of      ││
│  │       thousands to hundreds of thousands of examples)       ││
│  │ Method: Mask instruction part, compute Loss only on response ││
│  │ Cost: Tens of GPUs × days = thousands to tens of thousands  ││
│  │       of dollars                                            ││
│  │ Important: Data quality matters more than quantity (LIMA)   ││
│  └─────────────────────────────────────────────────────────────┘│
│                           ↓                                     │
│  Stage 3: Alignment (RLHF / DPO / KTO)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Objective: Align with human values and preferences          ││
│  │                                                             ││
│  │ RLHF (Reinforcement Learning from Human Feedback):          ││
│  │   1. Train a reward model (from human comparison judgments) ││
│  │   2. Optimize policy with PPO (reward max. + KL constraint) ││
│  │   → Complex but high-quality results                        ││
│  │                                                             ││
│  │ DPO (Direct Preference Optimization):                       ││
│  │   No reward model needed; learn directly from comparison    ││
│  │   data → Simple and easy to implement                       ││
│  │                                                             ││
│  │ KTO (Kahneman-Tversky Optimization):                       ││
│  │   No pairwise comparisons needed; learn from good/bad       ││
│  │   labels per response → Lowest data collection cost        ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Code Example 8: Loading and Running Inference with a Pretrained Model via Hugging Face

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# モデルのロード（量子化オプション付き）
model_name = "meta-llama/Llama-3.1-8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)

# 量子化なし（フル精度）
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,  # BF16 で半分のメモリ使用
    device_map="auto",            # 自動デバイス配置
    attn_implementation="sdpa",   # PyTorch の最適化アテンション
)

# チャットテンプレートを使用（推奨）
messages = [
    {"role": "system", "content": "あなたは親切なAIアシスタントです。"},
    {"role": "user", "content": "大規模言語モデルの仕組みを簡潔に説明してください。"}
]

# テンプレート適用
input_ids = tokenizer.apply_chat_template(
    messages,
    add_generation_prompt=True,
    return_tensors="pt"
).to(model.device)

# 生成パラメータの設定
outputs = model.generate(
    input_ids,
    max_new_tokens=200,
    temperature=0.7,        # 多様性の制御
    top_p=0.9,              # Nucleus sampling
    repetition_penalty=1.1, # 繰り返し抑制
    do_sample=True,
)

# 入力部分を除いて出力
response = tokenizer.decode(
    outputs[0][input_ids.shape[-1]:],
    skip_special_tokens=True
)
print(response)
```

### Code Example 9: Memory-Efficient 4-bit Quantization

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

# 4bit 量子化設定
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",          # NormalFloat4 量子化
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,     # 二重量子化でさらに圧縮
)

model_name = "meta-llama/Llama-3.1-70B-Instruct"

# 70B モデルを 4bit で読み込み（約35GB → 約17.5GB）
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=quantization_config,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# メモリ使用量の確認
total_memory = sum(
    p.nelement() * p.element_size() for p in model.parameters()
)
print(f"モデルメモリ使用量: {total_memory / 1e9:.2f} GB")

# 量子化の品質比較
# FP16:  70B × 2 bytes = 140 GB
# INT8:  70B × 1 byte  = 70 GB
# INT4:  70B × 0.5 byte = 35 GB
# NF4 + Double Quant ≈ 17.5 GB
```

### Code Example 10: Detailed Training Cost Estimation

```python
def estimate_training_cost(
    params_billions: float,
    tokens_trillions: float,
    gpu_type: str = "H100",
    mfu: float = 0.4,  # Model FLOPs Utilization
):
    """学習コストの詳細な概算

    Args:
        params_billions: パラメータ数（十億単位）
        tokens_trillions: 学習トークン数（兆単位）
        gpu_type: GPU の種類
        mfu: Model FLOPs Utilization（通常 30-50%）
    """
    gpu_specs = {
        "A100_40GB": {"bf16_flops": 312e12, "cost_per_hour": 1.5, "memory_gb": 40},
        "A100_80GB": {"bf16_flops": 312e12, "cost_per_hour": 2.0, "memory_gb": 80},
        "H100_SXM": {"bf16_flops": 989e12, "cost_per_hour": 3.5, "memory_gb": 80},
        "H200":     {"bf16_flops": 989e12, "cost_per_hour": 4.5, "memory_gb": 141},
    }
    spec = gpu_specs.get(gpu_type, gpu_specs["H100_SXM"])

    # 理論的 FLOPs: 6 * N * D（前方 + 後方）
    total_flops = 6 * params_billions * 1e9 * tokens_trillions * 1e12

    # MFU を考慮した実効スループット
    effective_flops_per_gpu = spec["bf16_flops"] * mfu

    # 必要 GPU 時間
    gpu_seconds = total_flops / effective_flops_per_gpu
    gpu_hours = gpu_seconds / 3600

    # コスト計算
    cost = gpu_hours * spec["cost_per_hour"]

    # 電力消費概算（H100: ~700W）
    power_kwh = gpu_hours * 0.7  # kWh
    co2_tons = power_kwh * 0.4 / 1000  # CO2 トン（米国平均）

    print(f"{'='*60}")
    print(f"学習コスト概算: {params_billions}B params × {tokens_trillions}T tokens")
    print(f"{'='*60}")
    print(f"GPU: {gpu_type} (MFU: {mfu*100:.0f}%)")
    print(f"理論 FLOPs: {total_flops:.2e}")
    print(f"必要 GPU 時間: {gpu_hours:,.0f} 時間")
    print(f"推定コスト: ${cost:,.0f}")
    print(f"電力消費: {power_kwh:,.0f} kWh")
    print(f"CO2排出量: {co2_tons:,.0f} トン")
    print(f"\nGPU台数別の学習日数:")
    for num_gpus in [64, 256, 1024, 4096, 16384]:
        days = gpu_hours / num_gpus / 24
        if days >= 1:
            print(f"  {num_gpus:>6}台: {days:>8.1f} 日 (${cost/1e6:.1f}M)")
    print()

# 各モデル規模の概算
estimate_training_cost(8, 15, "H100_SXM", mfu=0.4)    # LLaMA 3.1 8B
estimate_training_cost(70, 15, "H100_SXM", mfu=0.35)   # LLaMA 3.1 70B
estimate_training_cost(405, 15, "H100_SXM", mfu=0.3)   # LLaMA 3.1 405B
```

### Comparison Table 3: Detailed Comparison of Training Methods

| Method | Objective | Data | Compute Cost | Expertise Required | Major Frameworks |
|------|------|--------|-----------|--------------|------------------|
| Pre-training | Acquire language understanding | Trillions of tokens of text | Very high (millions of dollars) | Very high | Megatron-LM, DeepSpeed |
| SFT (Supervised Fine-Tuning) | Instruction-following ability | Tens of thousands to hundreds of thousands of instruction-response pairs | Moderate | High | Hugging Face TRL |
| RLHF | Align with human preferences | Comparison pairs + reward model | High | Very high | TRL + PPO |
| DPO | Simplified RLHF | Comparison pairs only | Moderate | Moderate | TRL + DPOTrainer |
| KTO | Alignment without pairs | good/bad label per response | Moderate | Moderate | TRL |
| LoRA | Efficient fine-tuning | Task-specific data | Low | Moderate | PEFT |
| QLoRA | Quantization + LoRA | Task-specific data | Very low | Moderate | PEFT + bitsandbytes |

---

## 6. Inference Optimization Techniques

### ASCII Diagram 6: Overview of Inference Optimization Techniques

```
┌────────────────────────────────────────────────────────────────┐
│                  Inference Optimization Hierarchy              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Hardware level                                                │
│  ├── Choice of GPU/TPU/NPU                                    │
│  ├── Tensor core utilization (BF16/FP8 operations)            │
│  └── Multi-GPU inference (tensor parallel / pipeline parallel) │
│                                                                │
│  Model level                                                   │
│  ├── Quantization (INT8, INT4, GPTQ, AWQ, GGUF)              │
│  ├── Distillation (knowledge transfer from large to small)    │
│  ├── Pruning (removing unnecessary parameters)                │
│  └── Architecture improvements (GQA, MQA, SWA)               │
│                                                                │
│  Runtime level                                                 │
│  ├── KV Cache (avoid recomputation)                           │
│  ├── Continuous Batching (dynamic batching)                   │
│  ├── PagedAttention (vLLM)                                    │
│  ├── Flash Attention (memory-efficient attention)             │
│  ├── Speculative Decoding                                     │
│  └── Prefix Caching (reuse common prefixes)                   │
│                                                                │
│  Application level                                             │
│  ├── Prompt optimization (reducing token count)               │
│  ├── Model routing (routing by task difficulty)               │
│  ├── Caching strategy (reuse results for similar requests)    │
│  └── Streaming output (improving perceived latency)           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Code Example 11: The Concept of KV Cache

```python
import torch
import torch.nn as nn

class CausalSelfAttentionWithKVCache(nn.Module):
    """KV Cache 付き Self-Attention の概念実装"""

    def __init__(self, d_model: int, num_heads: int):
        super().__init__()
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, x, kv_cache=None):
        """
        初回（プリフィル）: 全トークンを処理、KV Cache を構築
        2回目以降（デコード）: 新トークンのみ処理、KV Cache を更新
        """
        batch_size, seq_len, _ = x.shape

        Q = self.W_q(x).view(batch_size, seq_len, self.num_heads, self.d_k)
        K = self.W_k(x).view(batch_size, seq_len, self.num_heads, self.d_k)
        V = self.W_v(x).view(batch_size, seq_len, self.num_heads, self.d_k)

        if kv_cache is not None:
            # デコードフェーズ: 過去の KV を結合
            past_K, past_V = kv_cache
            K = torch.cat([past_K, K], dim=1)
            V = torch.cat([past_V, V], dim=1)

        # 新しい KV Cache
        new_kv_cache = (K, V)

        # アテンション計算（Q は現在のトークンのみ）
        Q = Q.transpose(1, 2)  # (B, H, S_q, D)
        K = K.transpose(1, 2)  # (B, H, S_kv, D)
        V = V.transpose(1, 2)  # (B, H, S_kv, D)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.d_k ** 0.5)
        weights = torch.softmax(scores, dim=-1)
        output = torch.matmul(weights, V)

        output = output.transpose(1, 2).reshape(batch_size, -1, self.d_model)
        output = self.W_o(output)

        return output, new_kv_cache

# KV Cache の効果を概算
def kv_cache_memory_estimate(
    num_layers: int,
    d_model: int,
    max_seq_len: int,
    batch_size: int = 1,
    dtype_bytes: int = 2,  # BF16
):
    """KV Cache のメモリ使用量を概算"""
    # 各層で K, V の2つのテンソル
    # 形状: (batch_size, seq_len, d_model)
    memory_per_layer = 2 * batch_size * max_seq_len * d_model * dtype_bytes
    total_memory = memory_per_layer * num_layers

    print(f"KV Cache メモリ推定:")
    print(f"  層数: {num_layers}, 次元: {d_model}, 最大長: {max_seq_len}")
    print(f"  バッチサイズ: {batch_size}")
    print(f"  合計: {total_memory / 1e9:.2f} GB")
    return total_memory

# 各モデルの KV Cache サイズ
kv_cache_memory_estimate(32, 4096, 8192, batch_size=1)    # 8B モデル
kv_cache_memory_estimate(80, 8192, 8192, batch_size=1)    # 70B モデル
kv_cache_memory_estimate(126, 16384, 8192, batch_size=1)  # 405B モデル
```

### Code Example 12: High-Speed Inference with vLLM

```python
from vllm import LLM, SamplingParams

# vLLM でモデルロード（PagedAttention 自動適用）
llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    dtype="bfloat16",
    max_model_len=8192,
    gpu_memory_utilization=0.9,  # GPU メモリの90%を使用
    tensor_parallel_size=1,       # GPU 数
    enable_prefix_caching=True,   # 共通プレフィックスのキャッシュ
)

# サンプリングパラメータ
sampling_params = SamplingParams(
    temperature=0.7,
    top_p=0.9,
    max_tokens=512,
    repetition_penalty=1.1,
)

# バッチ推論（Continuous Batching が自動適用）
prompts = [
    "機械学習と深層学習の違いを説明してください。",
    "Pythonでクイックソートを実装してください。",
    "日本の経済政策の課題を3つ挙げてください。",
]

outputs = llm.generate(prompts, sampling_params)

for output in outputs:
    prompt = output.prompt
    generated_text = output.outputs[0].text
    print(f"プロンプト: {prompt[:50]}...")
    print(f"出力: {generated_text[:100]}...")
    print(f"トークン/秒: {len(output.outputs[0].token_ids) / output.metrics.finished_time:.1f}")
    print()
```

### Comparison Table 4: Inference Engine Comparison

| Engine | Key Features | Best Use Case | Supported Models |
|----------|---------|----------------|---------------|
| vLLM | PagedAttention, Continuous Batching | High-throughput server | Wide range |
| TensorRT-LLM | NVIDIA-optimized, FP8 support | Maximum NVIDIA GPU utilization | Major models |
| llama.cpp | CPU/Metal inference, GGUF quantization | Local inference | GGUF-compatible |
| Ollama | Easy setup, local execution | Development & prototyping | GGUF-compatible |
| SGLang | RadixAttention, structured generation | Complex pipelines | Major models |
| MLC-LLM | Cross-platform | Mobile/edge | Major models |

---

## 7. GQA/MQA: Efficient Attention

### ASCII Diagram 7: MHA vs GQA vs MQA

```
Multi-Head Attention (MHA)        Grouped-Query Attention (GQA)
┌───┐ ┌───┐ ┌───┐ ┌───┐         ┌───┐ ┌───┐ ┌───┐ ┌───┐
│Q_1│ │Q_2│ │Q_3│ │Q_4│         │Q_1│ │Q_2│ │Q_3│ │Q_4│
└─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘         └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
  │     │     │     │               ╲   ╱       ╲   ╱
┌─┴─┐ ┌─┴─┐ ┌─┴─┐ ┌─┴─┐         ┌──┴───┘     ┌──┴───┘
│K_1│ │K_2│ │K_3│ │K_4│         │K_1          │K_2
│V_1│ │V_2│ │V_3│ │V_4│         │V_1          │V_2
└───┘ └───┘ └───┘ └───┘         └─────┘       └─────┘
 # KV heads = # Q heads            # KV heads < # Q heads
 → KV Cache maximum                → KV Cache reduced

Multi-Query Attention (MQA)
┌───┐ ┌───┐ ┌───┐ ┌───┐
│Q_1│ │Q_2│ │Q_3│ │Q_4│
└─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
  ╲     │     │   ╱
   ╲    │     │  ╱
    ╲   │     │ ╱
     ┌──┴─────┴──┐
     │K_1        │
     │V_1        │
     └───────────┘
 # KV heads = 1
 → KV Cache minimum, risk of quality degradation

LLaMA 3.1 adoption:
  8B:  GQA (32 Q heads, 8 KV heads) → 4:1
  70B: GQA (64 Q heads, 8 KV heads) → 8:1
  405B: GQA (128 Q heads, 8 KV heads) → 16:1
```

---

## 8. Model Selection Framework for Production Use

### ASCII Diagram 8: Model Selection Decision Flow

```
Analyze task requirements
      │
      ▼
┌─────────────────┐
│ Task complexity? │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Simple      Complex
  │           │
  ▼           ▼
┌────────┐  ┌────────────┐
│Classif.│  │Reasoning/  │
│Extract.│  │Analysis    │
│Format  │  │Code gen.   │
└────┬───┘  │Creative    │
     │      └─────┬──────┘
     │            │
     ▼            ▼
 Small model   Large model
 (7-8B)        (70B+)
 or API Haiku  or API Opus
     │            │
     ▼            ▼
┌──────────────────────────────────┐
│     Verify non-functional reqs.  │
├────────────┬─────────────────────┤
│ Latency    │ < 100ms → small    │
│            │ < 1s → medium      │
│            │ Flexible → large   │
├────────────┼─────────────────────┤
│ Cost       │ Low budget → OSS + LoRA│
│            │ Medium → API        │
│            │ High → dedicated deploy│
├────────────┼─────────────────────┤
│ Privacy    │ Strict → on-premise │
│            │ Normal → API        │
├────────────┼─────────────────────┤
│ Throughput │ High → vLLM + multi-GPU│
│            │ Low → Ollama suffices│
└────────────┴─────────────────────┘
```

### Code Example 13: Model Routing Implementation

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class ModelTier(Enum):
    SMALL = "small"    # 8B 級 / Haiku
    MEDIUM = "medium"  # 70B 級 / Sonnet
    LARGE = "large"    # 405B 級 / Opus

@dataclass
class RoutingDecision:
    model_tier: ModelTier
    reason: str
    estimated_cost_per_1k: float  # $/1K tokens

class ModelRouter:
    """タスクの複雑さに応じてモデルを振り分け"""

    # 複雑さの指標
    COMPLEXITY_SIGNALS = {
        "simple_keywords": [
            "分類", "抽出", "フォーマット", "変換",
            "翻訳", "要約", "ラベル付け"
        ],
        "complex_keywords": [
            "分析", "推論", "比較", "評価", "設計",
            "コード生成", "デバッグ", "創作", "戦略"
        ],
    }

    def route(self, task_description: str, max_latency_ms: Optional[int] = None) -> RoutingDecision:
        """タスク記述からモデルティアを決定"""
        desc_lower = task_description.lower()

        # レイテンシ制約がある場合
        if max_latency_ms and max_latency_ms < 200:
            return RoutingDecision(
                model_tier=ModelTier.SMALL,
                reason="レイテンシ制約により小型モデルを選択",
                estimated_cost_per_1k=0.0001,
            )

        # 複雑さの判定
        simple_score = sum(
            1 for kw in self.COMPLEXITY_SIGNALS["simple_keywords"]
            if kw in desc_lower
        )
        complex_score = sum(
            1 for kw in self.COMPLEXITY_SIGNALS["complex_keywords"]
            if kw in desc_lower
        )

        # テキスト長による追加判定
        if len(task_description) > 2000:
            complex_score += 1

        if complex_score > simple_score:
            if complex_score >= 3:
                return RoutingDecision(
                    model_tier=ModelTier.LARGE,
                    reason=f"高複雑度タスク (score: {complex_score})",
                    estimated_cost_per_1k=0.015,
                )
            return RoutingDecision(
                model_tier=ModelTier.MEDIUM,
                reason=f"中複雑度タスク (score: {complex_score})",
                estimated_cost_per_1k=0.003,
            )

        return RoutingDecision(
            model_tier=ModelTier.SMALL,
            reason=f"低複雑度タスク (score: {simple_score})",
            estimated_cost_per_1k=0.0001,
        )

# 使用例
router = ModelRouter()

tasks = [
    "このテキストをポジティブ/ネガティブに分類してください",
    "この設計書のセキュリティ脆弱性を分析し、改善策を推論してください",
    "複数のマイクロサービス間のAPI設計を比較・評価し、最適なアーキテクチャを提案してください",
]

for task in tasks:
    decision = router.route(task)
    print(f"タスク: {task[:50]}...")
    print(f"  → {decision.model_tier.value} ({decision.reason})")
    print(f"  → 推定コスト: ${decision.estimated_cost_per_1k}/1Kトークン")
    print()
```

---

## Anti-Patterns

### Anti-Pattern 1: The Misconception That "Bigger Model = Always Better"

```
Wrong: Use the largest model for every task
  → Cost explosion, increased latency, environmental impact

Right: Choose model size based on task complexity
  - Classification/extraction → small model (7-8B) is sufficient
  - Complex reasoning → large model (70B+) is needed
  - Design with routing to dispatch appropriately

  Real example:
  - Email classification: Haiku (~$0.25/1M tokens) achieves 95% accuracy
  - Same task with Opus ($15/1M tokens): 97% accuracy
  - 60x cost for 2% accuracy gain → ROI doesn't justify it
```

### Anti-Pattern 2: Over-Trusting Scaling Laws

```
Wrong: Adding parameters will improve performance on all tasks
  → On specific tasks, small model + specialized data can be superior

Right: Always evaluate on task-specific metrics
  - Benchmark scores and real task performance can diverge
  - Domain-specific fine-tuning can outperform large general models
  - Cases where 8B + LoRA beats 70B zero-shot are common
```

### Anti-Pattern 3: Ignoring Inference Costs in Design

```
Wrong: Consider only training costs
  → After deployment, inference costs exceed training costs

Right: Evaluate using TCO (Total Cost of Ownership)
  - Training cost: incurred once
  - Inference cost: occurs every day, every second
  - 1M requests/day: 50ms latency reduction = $XXX/month in savings
  - Quantization and batching can reduce inference cost by up to 10x
```

### Anti-Pattern 4: Abusing Context Length

```
Wrong: Stuffing vast amounts of text into a 128K token context
  → "Lost in the Middle" problem — information in the middle gets missed
  → Cost increases superlinearly
  → Latency degrades significantly

Right: Include only necessary information in context
  - Use RAG to retrieve only relevant portions
  - Summarize before adding to context
  - Split into chunks and process in parallel
  - Place important information at the beginning and end of the prompt
```

---

## FAQ

### Q1: What is the biggest difference from pre-Transformer models (RNN/LSTM)?

**A:** Parallel processing capability. RNN/LSTM models process sequences sequentially, making training slow and handling long contexts difficult. Transformer's Self-Attention computes relationships among all tokens simultaneously, maximizing GPU parallelism. This is the primary factor that made scaling possible.

Specific comparison:
- **RNN**: O(n) sequential steps, vanishing gradient problem, cannot be parallelized
- **LSTM**: Mitigates vanishing gradients, but still sequential processing
- **Transformer**: O(1) depth (attention references all positions), fully parallelizable, O(n^2) memory but optimal for GPUs

### Q2: Does a higher parameter count always mean better performance?

**A:** No. As Chinchilla research showed, the balance between parameter count and data volume is crucial. For example, a 70B parameter model trained on sufficient data can outperform the 175B GPT-3. Additionally, Mixture of Experts (MoE) — which avoids using all parameters at once — has become mainstream for efficient design.

Furthermore, inference-time efficiency is also important:
- LLaMA 3.1 8B (15T tokens) was trained on 3x more data than Chinchilla optimal
- Inference cost is that of an 8B model, but performance matches an "optimal 13B"
- Strategy of "invest extra during training to reduce inference cost"

### Q3: What is the most costly part of LLM training?

**A:** GPU compute cost for pre-training is overwhelmingly dominant. GPT-4-class models are estimated to cost tens of millions to $100 million in compute. In contrast, SFT and RLHF are relatively inexpensive (thousands to tens of thousands of dollars). This is why many organizations adopt a strategy of fine-tuning on top of pretrained models.

Typical cost breakdown (70B model):
1. **GPU compute**: ~80% (training time × number of GPUs × power)
2. **Data preparation**: ~10% (collection, cleaning, filtering)
3. **Personnel**: ~5% (researchers, engineers)
4. **Infrastructure**: ~5% (storage, networking, cooling)

### Q4: Should I choose MoE or Dense?

**A:** It depends on the use case.
- **High throughput needed** → MoE (higher performance for same inference cost)
- **Strict memory constraints** → Dense (MoE requires holding all experts in memory)
- **Stable training needed** → Dense (MoE requires load balancing tuning)
- **Simple deployment** → Dense (MoE distributed inference setup is complex)

### Q5: Should I use local LLM or API?

**A:** Choose based on the following criteria:

| Criteria | Recommend Local | Recommend API |
|------|-------------|---------|
| Data privacy | Handling sensitive data | General data |
| Initial investment | Have GPU assets | Want to avoid GPU investment |
| Scalability | Fixed load | Variable load |
| Latest model | Not required | Always need latest |
| Customization | Fine-tuning needed | Prompting is sufficient |
| Operations team | Have MLOps team | Want minimal operations |

### Q6: How far can you trust context length?

**A:** Advertised context length and effective performance differ.

- **Needle in a Haystack test**: Many models miss information in the middle of long contexts
- **Practical recommendation**: Place important information at the beginning and end of the context
- **Combine with RAG**: Retrieving only needed parts from long documents with RAG yields higher accuracy
- **Cost**: Avoid unnecessary context since cost increases proportionally with input tokens

---

## Summary

| Item | Key Point |
|------|------|
| Transformer | Self-Attention enables parallel processing and long contexts |
| Positional encoding | RoPE is the modern standard; long-context support continues to evolve |
| Scaling laws | Loss is predictable from the three elements: parameters, data, and compute |
| MoE | Limits active parameters to dramatically improve inference efficiency |
| Pre-training | Language ability acquired via next-token prediction at trillion-token scale |
| SFT | Supervised fine-tuning that grants instruction-following capability |
| RLHF/DPO | Alignment methods for aligning with human preferences |
| Inference optimization | KV Cache, quantization, vLLM, etc. improve cost and speed |
| GQA/MQA | Reduces KV Cache memory while maintaining quality |
| Model selection | Optimal solution varies by task complexity, cost, and latency |

---

## What to Read Next

- [01-tokenization.md](./01-tokenization.md) -- How tokenization works and management techniques
- [02-inference.md](./02-inference.md) -- Optimizing inference parameters
- [03-fine-tuning.md](./03-fine-tuning.md) -- Fine-tuning with LoRA/QLoRA

---

## References

1. Vaswani, A. et al. (2017). "Attention Is All You Need." *NeurIPS 2017*. https://arxiv.org/abs/1706.03762
2. Hoffmann, J. et al. (2022). "Training Compute-Optimal Large Language Models (Chinchilla)." *arXiv:2203.15556*. https://arxiv.org/abs/2203.15556
3. Kaplan, J. et al. (2020). "Scaling Laws for Neural Language Models." *arXiv:2001.08361*. https://arxiv.org/abs/2001.08361
4. Ouyang, L. et al. (2022). "Training language models to follow instructions with human feedback (InstructGPT)." *NeurIPS 2022*. https://arxiv.org/abs/2203.02155
5. Su, J. et al. (2021). "RoFormer: Enhanced Transformer with Rotary Position Embedding." *arXiv:2104.09864*. https://arxiv.org/abs/2104.09864
6. Shazeer, N. et al. (2017). "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer." *ICLR 2017*. https://arxiv.org/abs/1701.06538
7. Fedus, W. et al. (2021). "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity." *arXiv:2101.03961*. https://arxiv.org/abs/2101.03961
8. Dao, T. et al. (2022). "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." *NeurIPS 2022*. https://arxiv.org/abs/2205.14135
9. Kwon, W. et al. (2023). "Efficient Memory Management for Large Language Model Serving with PagedAttention (vLLM)." *SOSP 2023*. https://arxiv.org/abs/2309.06180
10. Ainslie, J. et al. (2023). "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints." *arXiv:2305.13245*. https://arxiv.org/abs/2305.13245
