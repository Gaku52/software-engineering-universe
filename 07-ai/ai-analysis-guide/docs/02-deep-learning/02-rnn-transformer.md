# RNN/Transformer

> Trace the evolution of sequence data processing from RNN to Transformer, and practically understand the mechanisms and applications of LSTM, Attention, and BERT

## What You Will Learn in This Chapter

1. **RNN Fundamentals and Limitations** — Time series processing, vanishing gradient problem, solutions with LSTM/GRU
2. **Attention Mechanism** — Computational principles of Self-Attention and Multi-Head Attention
3. **Transformer Architecture** — Encoder-Decoder structure, design philosophy of BERT and GPT
4. **Practical Training and Inference Techniques** — Fine-tuning, quantization, efficient inference
5. **Latest Trends** — State Space Models, Mixture of Experts, long context handling


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of [CNN — Convolution, Pooling, Image Recognition](./01-cnn.md)

---

## 1. RNN Fundamentals

```
Unrolled RNN Diagram
=============

       h0    h1    h2    h3
        |     |     |     |
  x0 ->[RNN]->[RNN]->[RNN]->[RNN]-> y
        |     |     |     |
       "I"  "love" "deep" "learning"

Each step:
  h_t = tanh(W_hh * h_{t-1} + W_xh * x_t + b)
  y_t = W_hy * h_t

Problem: Vanishing/exploding gradients with long sequences
  Gradient to h100 = d(loss)/d(h0) --> multiply W_hh 100 times
  |W| < 1: Vanishing gradient (information disappears)
  |W| > 1: Exploding gradient (values diverge)
```

### 1.1 Mathematical Foundations of RNN

An RNN is a neural network with a recurrent structure that updates its hidden state at each step of a sequence. The basic computation is as follows:

```
Vanilla RNN Forward Pass:
=====================

Input: x = (x_1, x_2, ..., x_T)  sequence length T

At each time step t:
  a_t = W_hh * h_{t-1} + W_xh * x_t + b_h    (pre-activation value)
  h_t = tanh(a_t)                               (hidden state)
  o_t = W_hy * h_t + b_y                       (output)
  y_t = softmax(o_t)                            (prediction)

Parameters:
  W_xh ∈ R^{H×D}  (input → hidden)
  W_hh ∈ R^{H×H}  (hidden → hidden)
  W_hy ∈ R^{V×H}  (hidden → output)
  b_h ∈ R^H, b_y ∈ R^V

Backpropagation (BPTT: Backpropagation Through Time):
  ∂L/∂W_hh = Σ_t ∂L_t/∂W_hh

  ∂L_t/∂h_k = (∏_{i=k+1}^{t} diag(1-h_i²) * W_hh) * ∂L_t/∂h_t

  → T-k matrix multiplications cause exponential gradient changes
```

### Code Example 1: LSTM Structure

```python
import torch
import torch.nn as nn

class LSTMModel(nn.Module):
    """Sequence classification with LSTM"""

    def __init__(self, vocab_size, embed_dim, hidden_dim, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(
            embed_dim, hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.3,
            bidirectional=True,  # Bidirectional LSTM
        )
        self.classifier = nn.Linear(hidden_dim * 2, num_classes)  # *2 for bidirectional
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        embedded = self.dropout(self.embedding(x))  # [batch, seq_len, embed_dim]
        output, (hidden, cell) = self.lstm(embedded)
        # hidden: [num_layers*2, batch, hidden_dim]
        # Concatenate forward and backward of the last layer
        hidden_cat = torch.cat((hidden[-2], hidden[-1]), dim=1)
        logits = self.classifier(self.dropout(hidden_cat))
        return logits

# Usage example
model = LSTMModel(vocab_size=30000, embed_dim=256, hidden_dim=512, num_classes=5)
```

```
LSTM Cell Internal Structure
=====================

         c_{t-1} ----[x]--------[+]----> c_t
                      |          |
                   [forget]   [input * candidate]
                      |          |        |
         h_{t-1} --> [f_t]    [i_t]    [~c_t]
                      |          |        |
                   sigmoid    sigmoid    tanh
                      |          |        |
                   +--+--+   +--+--+ +--+--+
                   | W_f |   | W_i | | W_c |
                   +-----+   +-----+ +-----+
                      ^          ^        ^
                   [h_{t-1}, x_t] as input

  f_t: Forget gate (what to forget)
  i_t: Input gate (what to memorize)
  o_t: Output gate (what to output)
```

### Code Example 1.5: GRU Implementation and Comparison with LSTM

```python
import torch
import torch.nn as nn
import time

class GRUModel(nn.Module):
    """Sequence classification with GRU (lighter than LSTM)"""

    def __init__(self, vocab_size, embed_dim, hidden_dim, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.gru = nn.GRU(
            embed_dim, hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.3,
            bidirectional=True,
        )
        self.classifier = nn.Linear(hidden_dim * 2, num_classes)
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        embedded = self.dropout(self.embedding(x))
        output, hidden = self.gru(embedded)  # GRU: no cell state
        hidden_cat = torch.cat((hidden[-2], hidden[-1]), dim=1)
        logits = self.classifier(self.dropout(hidden_cat))
        return logits


def compare_rnn_variants():
    """Compare parameter counts and speed between LSTM and GRU"""
    vocab_size = 30000
    embed_dim = 256
    hidden_dim = 512
    num_classes = 5
    seq_len = 100
    batch_size = 32

    models = {
        "LSTM": LSTMModel(vocab_size, embed_dim, hidden_dim, num_classes),
        "GRU": GRUModel(vocab_size, embed_dim, hidden_dim, num_classes),
    }

    dummy_input = torch.randint(0, vocab_size, (batch_size, seq_len))

    for name, model in models.items():
        # Parameter count
        total_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

        # Inference speed
        model.eval()
        with torch.no_grad():
            start = time.time()
            for _ in range(100):
                _ = model(dummy_input)
            elapsed = time.time() - start

        print(f"{name}:")
        print(f"  Parameters: {total_params:,}")
        print(f"  Trainable: {trainable_params:,}")
        print(f"  Inference time (100 runs): {elapsed:.3f}s")
        print()

compare_rnn_variants()
```

```
GRU Cell Internal Structure
===================

  GRU is a simplified version of LSTM (2 gates):

  z_t = σ(W_z * [h_{t-1}, x_t])       Update gate
  r_t = σ(W_r * [h_{t-1}, x_t])       Reset gate
  ~h_t = tanh(W * [r_t ⊙ h_{t-1}, x_t])  Candidate state
  h_t = (1 - z_t) ⊙ h_{t-1} + z_t ⊙ ~h_t

  LSTM vs GRU:
  ┌─────────────────┬──────────────┬──────────────┐
  │                 │ LSTM         │ GRU          │
  ├─────────────────┼──────────────┼──────────────┤
  │ Number of gates │ 3 (f, i, o) │ 2 (z, r)     │
  │ Number of states│ 2 (h, c)    │ 1 (h)        │
  │ Parameters      │ 4 × matrices│ 3 × matrices │
  │ Memory          │ Higher       │ Lower        │
  │ Long-range dep. │ Slightly better│ Comparable to slightly worse │
  │ Training speed  │ Slower       │ Faster       │
  │ Common use      │ Long sequences│ Short to mid sequences │
  └─────────────────┴──────────────┴──────────────┘
```

### Code Example 1.7: Time Series Prediction (LSTM)

```python
import torch
import torch.nn as nn
import numpy as np
from torch.utils.data import Dataset, DataLoader

class TimeSeriesDataset(Dataset):
    """Create a time series dataset using a sliding window"""

    def __init__(self, data, window_size, forecast_horizon=1):
        self.data = torch.FloatTensor(data)
        self.window_size = window_size
        self.forecast_horizon = forecast_horizon

    def __len__(self):
        return len(self.data) - self.window_size - self.forecast_horizon + 1

    def __getitem__(self, idx):
        x = self.data[idx:idx + self.window_size].unsqueeze(-1)  # [window, 1]
        y = self.data[idx + self.window_size:idx + self.window_size + self.forecast_horizon]
        return x, y


class LSTMForecaster(nn.Module):
    """Time series forecasting model with LSTM"""

    def __init__(self, input_dim=1, hidden_dim=64, num_layers=2,
                 forecast_horizon=1, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_dim, hidden_dim, num_layers=num_layers,
            batch_first=True, dropout=dropout
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, forecast_horizon),
        )

    def forward(self, x):
        # x: [batch, window_size, input_dim]
        lstm_out, (h_n, c_n) = self.lstm(x)
        # Use the hidden state of the last time step
        last_hidden = lstm_out[:, -1, :]  # [batch, hidden_dim]
        prediction = self.fc(last_hidden)  # [batch, forecast_horizon]
        return prediction


def train_forecaster(data, window_size=30, forecast_horizon=7,
                     epochs=50, lr=0.001, batch_size=32):
    """Train a time series forecasting model"""
    # Data split
    train_size = int(len(data) * 0.8)
    train_data = data[:train_size]
    val_data = data[train_size:]

    # Normalization
    mean, std = train_data.mean(), train_data.std()
    train_normalized = (train_data - mean) / std
    val_normalized = (val_data - mean) / std

    # Dataset
    train_ds = TimeSeriesDataset(train_normalized, window_size, forecast_horizon)
    val_ds = TimeSeriesDataset(val_normalized, window_size, forecast_horizon)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    # Model
    model = LSTMForecaster(
        input_dim=1, hidden_dim=64, num_layers=2,
        forecast_horizon=forecast_horizon
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, patience=5, factor=0.5
    )
    criterion = nn.MSELoss()

    best_val_loss = float('inf')
    patience_counter = 0

    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0
        for x_batch, y_batch in train_loader:
            optimizer.zero_grad()
            pred = model(x_batch)
            loss = criterion(pred, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item()

        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                pred = model(x_batch)
                val_loss += criterion(pred, y_batch).item()

        train_loss /= len(train_loader)
        val_loss /= len(val_loader)
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "best_forecaster.pt")
            patience_counter = 0
        else:
            patience_counter += 1

        if patience_counter >= 10:
            print(f"Early stopping at epoch {epoch}")
            break

        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}: train_loss={train_loss:.6f}, val_loss={val_loss:.6f}")

    return model, mean, std

# Usage example
# data = np.sin(np.linspace(0, 100, 1000)) + np.random.randn(1000) * 0.1
# model, mean, std = train_forecaster(data)
```

### Code Example 1.8: Seq2Seq Model (Encoder-Decoder RNN)

```python
import torch
import torch.nn as nn
import random

class Encoder(nn.Module):
    """Seq2Seq Encoder"""

    def __init__(self, input_dim, embed_dim, hidden_dim, num_layers, dropout):
        super().__init__()
        self.embedding = nn.Embedding(input_dim, embed_dim)
        self.rnn = nn.LSTM(embed_dim, hidden_dim, num_layers,
                           batch_first=True, dropout=dropout)
        self.dropout = nn.Dropout(dropout)

    def forward(self, src):
        embedded = self.dropout(self.embedding(src))  # [batch, src_len, embed_dim]
        outputs, (hidden, cell) = self.rnn(embedded)
        return hidden, cell


class Decoder(nn.Module):
    """Seq2Seq Decoder"""

    def __init__(self, output_dim, embed_dim, hidden_dim, num_layers, dropout):
        super().__init__()
        self.embedding = nn.Embedding(output_dim, embed_dim)
        self.rnn = nn.LSTM(embed_dim, hidden_dim, num_layers,
                           batch_first=True, dropout=dropout)
        self.fc_out = nn.Linear(hidden_dim, output_dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, input_token, hidden, cell):
        # input_token: [batch, 1]
        embedded = self.dropout(self.embedding(input_token))
        output, (hidden, cell) = self.rnn(embedded, (hidden, cell))
        prediction = self.fc_out(output.squeeze(1))  # [batch, output_dim]
        return prediction, hidden, cell


class Seq2Seq(nn.Module):
    """Encoder-Decoder Seq2Seq Model"""

    def __init__(self, encoder, decoder, device):
        super().__init__()
        self.encoder = encoder
        self.decoder = decoder
        self.device = device

    def forward(self, src, trg, teacher_forcing_ratio=0.5):
        batch_size = src.size(0)
        trg_len = trg.size(1)
        trg_vocab_size = self.decoder.fc_out.out_features

        outputs = torch.zeros(batch_size, trg_len, trg_vocab_size).to(self.device)
        hidden, cell = self.encoder(src)

        # First input is the <SOS> token
        input_token = trg[:, 0:1]  # [batch, 1]

        for t in range(1, trg_len):
            prediction, hidden, cell = self.decoder(input_token, hidden, cell)
            outputs[:, t] = prediction

            # Teacher Forcing: use ground truth as next input with a certain probability
            teacher_force = random.random() < teacher_forcing_ratio
            top1 = prediction.argmax(dim=1, keepdim=True)
            input_token = trg[:, t:t+1] if teacher_force else top1

        return outputs

# Usage example
INPUT_DIM = 10000   # Source vocabulary size
OUTPUT_DIM = 8000   # Target vocabulary size
EMBED_DIM = 256
HIDDEN_DIM = 512
NUM_LAYERS = 2
DROPOUT = 0.3

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
encoder = Encoder(INPUT_DIM, EMBED_DIM, HIDDEN_DIM, NUM_LAYERS, DROPOUT)
decoder = Decoder(OUTPUT_DIM, EMBED_DIM, HIDDEN_DIM, NUM_LAYERS, DROPOUT)
model = Seq2Seq(encoder, decoder, device).to(device)

print(f"Seq2Seq parameters: {sum(p.numel() for p in model.parameters()):,}")
```

---

## 2. Attention Mechanism

```
Self-Attention Computation
======================

Input: "The cat sat"

1. Compute Q, K, V
   Q = X * W_Q    (Query: "what to look for")
   K = X * W_K    (Key: "what it contains")
   V = X * W_V    (Value: "actual value")

2. Attention scores
   Score = Q * K^T / sqrt(d_k)

3. Normalize with Softmax
   Attention = softmax(Score)

4. Weighted sum
   Output = Attention * V

       The   cat   sat
  The [ 0.7  0.2  0.1 ]    <-- "The" attends most to itself
  cat [ 0.1  0.6  0.3 ]    <-- "cat" attends to itself and "sat"
  sat [ 0.2  0.5  0.3 ]    <-- "sat" attends most to "cat"
```

### 2.1 Types of Attention

```
Classification of Attention Mechanisms
============================

1. Additive Attention (Bahdanau, 2014)
   score(s_i, h_j) = v^T * tanh(W_1 * s_i + W_2 * h_j)
   → Used between Encoder-Decoder
   → Complexity: O(d)

2. Dot-Product Attention (Luong, 2015)
   score(s_i, h_j) = s_i^T * h_j
   → Fast but has scaling issues
   → Complexity: O(1)

3. Scaled Dot-Product Attention (Vaswani, 2017)
   score(Q, K) = Q * K^T / sqrt(d_k)
   → Used in Transformer
   → sqrt(d_k) stabilizes gradients

4. Multi-Head Attention
   head_i = Attention(Q*W_Q_i, K*W_K_i, V*W_V_i)
   MultiHead = Concat(head_1, ..., head_h) * W_O
   → Learns different patterns in different subspaces

5. Cross-Attention
   Q: Decoder states
   K, V: Encoder outputs
   → Information transfer between Encoder and Decoder

6. Causal (Masked) Attention
   Masks attention to future tokens
   → Used in autoregressive models like GPT
```

### Code Example 2: Self-Attention Implementation

```python
import torch
import torch.nn.functional as F
import math

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    Q: [batch, heads, seq_len, d_k]
    K: [batch, heads, seq_len, d_k]
    V: [batch, heads, seq_len, d_v]
    """
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))

    attention_weights = F.softmax(scores, dim=-1)
    output = torch.matmul(attention_weights, V)
    return output, attention_weights

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        assert d_model % num_heads == 0
        self.d_k = d_model // num_heads
        self.num_heads = num_heads

        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)

    def forward(self, query, key, value, mask=None):
        batch_size = query.size(0)

        # Linear transformation + multi-head split
        Q = self.W_q(query).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        K = self.W_k(key).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        V = self.W_v(value).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)

        # Attention computation
        attn_output, attn_weights = scaled_dot_product_attention(Q, K, V, mask)

        # Head concatenation + output transformation
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, -1, self.num_heads * self.d_k)
        output = self.W_o(attn_output)
        return output
```

### Code Example 2.5: Attention Visualization

```python
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt
import numpy as np

def visualize_attention(tokens, attention_weights, layer=0, head=0, save_path=None):
    """
    Visualize attention weights as a heatmap

    Args:
        tokens: List of tokens
        attention_weights: Tensor of shape [layers, heads, seq_len, seq_len]
        layer: Layer to visualize
        head: Head to visualize
    """
    attn = attention_weights[layer][head].detach().cpu().numpy()

    fig, ax = plt.subplots(figsize=(10, 10))
    im = ax.imshow(attn, cmap="viridis", vmin=0, vmax=1)

    ax.set_xticks(range(len(tokens)))
    ax.set_yticks(range(len(tokens)))
    ax.set_xticklabels(tokens, rotation=45, ha="right", fontsize=10)
    ax.set_yticklabels(tokens, fontsize=10)

    # Display values in each cell
    for i in range(len(tokens)):
        for j in range(len(tokens)):
            ax.text(j, i, f"{attn[i, j]:.2f}",
                    ha="center", va="center", fontsize=8,
                    color="white" if attn[i, j] > 0.5 else "black")

    ax.set_xlabel("Key")
    ax.set_ylabel("Query")
    ax.set_title(f"Attention Weights (Layer {layer}, Head {head})")
    plt.colorbar(im, ax=ax)
    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close()


def extract_bert_attention(model, tokenizer, text):
    """Extract attention weights from BERT"""
    inputs = tokenizer(text, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs, output_attentions=True)

    # attentions: tuple of (batch, heads, seq_len, seq_len) per layer
    attentions = outputs.attentions
    tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])

    # Visualize attention for each layer
    all_attentions = torch.stack([a.squeeze(0) for a in attentions])
    return tokens, all_attentions


def attention_rollout(attentions, head_fusion="mean"):
    """
    Attention Rollout: Aggregate attention across multiple layers
    to compute the final contribution of each input token

    Args:
        attentions: [num_layers, num_heads, seq_len, seq_len]
        head_fusion: Method for aggregating heads ("mean", "max", "min")
    """
    num_layers = attentions.shape[0]
    seq_len = attentions.shape[-1]

    # Add identity matrix to attention to account for residual connections
    result = torch.eye(seq_len)

    for layer in range(num_layers):
        if head_fusion == "mean":
            attn = attentions[layer].mean(dim=0)
        elif head_fusion == "max":
            attn = attentions[layer].max(dim=0).values
        elif head_fusion == "min":
            attn = attentions[layer].min(dim=0).values

        # Effect of residual connections
        attn = 0.5 * attn + 0.5 * torch.eye(seq_len)
        # Row-wise normalization
        attn = attn / attn.sum(dim=-1, keepdim=True)
        result = torch.matmul(attn, result)

    return result
```

### Code Example 2.7: Bahdanau Attention (Additive Attention)

```python
import torch
import torch.nn as nn

class BahdanauAttention(nn.Module):
    """Additive Attention (Bahdanau et al., 2014)"""

    def __init__(self, encoder_dim, decoder_dim, attention_dim):
        super().__init__()
        self.W_encoder = nn.Linear(encoder_dim, attention_dim, bias=False)
        self.W_decoder = nn.Linear(decoder_dim, attention_dim, bias=False)
        self.v = nn.Linear(attention_dim, 1, bias=False)

    def forward(self, encoder_outputs, decoder_hidden):
        """
        encoder_outputs: [batch, src_len, encoder_dim]
        decoder_hidden: [batch, decoder_dim]
        """
        # Repeat decoder_hidden for src_len
        decoder_hidden = decoder_hidden.unsqueeze(1)  # [batch, 1, decoder_dim]

        # Score computation
        energy = torch.tanh(
            self.W_encoder(encoder_outputs) + self.W_decoder(decoder_hidden)
        )  # [batch, src_len, attention_dim]

        scores = self.v(energy).squeeze(-1)  # [batch, src_len]
        attention_weights = torch.softmax(scores, dim=-1)  # [batch, src_len]

        # Context vector
        context = torch.bmm(
            attention_weights.unsqueeze(1), encoder_outputs
        ).squeeze(1)  # [batch, encoder_dim]

        return context, attention_weights


class AttentionDecoder(nn.Module):
    """Decoder with Attention"""

    def __init__(self, output_dim, embed_dim, encoder_dim,
                 decoder_dim, attention_dim, dropout=0.3):
        super().__init__()
        self.attention = BahdanauAttention(encoder_dim, decoder_dim, attention_dim)
        self.embedding = nn.Embedding(output_dim, embed_dim)
        self.rnn = nn.GRU(embed_dim + encoder_dim, decoder_dim, batch_first=True)
        self.fc_out = nn.Linear(decoder_dim + encoder_dim + embed_dim, output_dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, input_token, decoder_hidden, encoder_outputs):
        """
        input_token: [batch]
        decoder_hidden: [1, batch, decoder_dim]
        encoder_outputs: [batch, src_len, encoder_dim]
        """
        embedded = self.dropout(self.embedding(input_token.unsqueeze(1)))  # [batch, 1, embed_dim]

        context, attn_weights = self.attention(
            encoder_outputs, decoder_hidden.squeeze(0)
        )
        context = context.unsqueeze(1)  # [batch, 1, encoder_dim]

        rnn_input = torch.cat([embedded, context], dim=2)  # [batch, 1, embed_dim + encoder_dim]
        output, hidden = self.rnn(rnn_input, decoder_hidden)

        prediction = self.fc_out(
            torch.cat([output.squeeze(1), context.squeeze(1), embedded.squeeze(1)], dim=1)
        )  # [batch, output_dim]

        return prediction, hidden, attn_weights
```

---

## 3. Transformer Architecture

```
Overall Transformer Structure
========================

       Input Text                      Output Text
           |                              |
    [Input Embedding]              [Output Embedding]
    [+ Positional Enc]             [+ Positional Enc]
           |                              |
    ┌──────┴──────┐                ┌──────┴──────┐
    │  Encoder x N │                │  Decoder x N │
    │             │                │             │
    │ ┌─────────┐ │                │ ┌─────────┐ │
    │ │Self-Attn│ │                │ │Masked    │ │
    │ │+ ResConn│ │                │ │Self-Attn │ │
    │ │+ LN     │ │                │ │+ ResConn │ │
    │ └────┬────┘ │                │ │+ LN      │ │
    │ ┌────┴────┐ │                │ └────┬────┘ │
    │ │FFN      │ │   K,V          │ ┌────┴────┐ │
    │ │+ ResConn│ │───────────────→│ │Cross-Attn│ │
    │ │+ LN     │ │                │ │+ ResConn │ │
    │ └─────────┘ │                │ │+ LN      │ │
    └─────────────┘                │ └────┬────┘ │
                                   │ ┌────┴────┐ │
                                   │ │FFN      │ │
                                   │ │+ ResConn│ │
                                   │ │+ LN     │ │
                                   │ └─────────┘ │
                                   └──────┬──────┘
                                          |
                                   [Linear + Softmax]
                                          |
                                   Probability Distribution
```

### Code Example 3: Transformer Encoder

```python
class TransformerEncoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads)
        self.feed_forward = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        # Self-Attention + Residual + LayerNorm
        attn_out = self.self_attn(x, x, x, mask)
        x = self.norm1(x + self.dropout(attn_out))

        # Feed-Forward + Residual + LayerNorm
        ff_out = self.feed_forward(x)
        x = self.norm2(x + self.dropout(ff_out))
        return x

class TextClassifier(nn.Module):
    """Transformer-based text classifier"""

    def __init__(self, vocab_size, d_model=512, num_heads=8,
                 num_layers=6, d_ff=2048, num_classes=5, max_len=512):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = nn.Embedding(max_len, d_model)
        self.layers = nn.ModuleList([
            TransformerEncoderLayer(d_model, num_heads, d_ff)
            for _ in range(num_layers)
        ])
        self.classifier = nn.Linear(d_model, num_classes)
        self.dropout = nn.Dropout(0.1)

    def forward(self, x):
        seq_len = x.size(1)
        positions = torch.arange(seq_len, device=x.device).unsqueeze(0)
        x = self.dropout(self.embedding(x) + self.pos_encoding(positions))

        for layer in self.layers:
            x = layer(x)

        # Use the [CLS] token representation for classification
        cls_output = x[:, 0]
        return self.classifier(cls_output)
```

### Code Example 3.5: Transformer Decoder

```python
import torch
import torch.nn as nn

class TransformerDecoderLayer(nn.Module):
    """Transformer Decoder Layer (Causal Attention + Cross-Attention)"""

    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        # Masked Self-Attention
        self.self_attn = MultiHeadAttention(d_model, num_heads)
        # Cross-Attention (Encoder-Decoder)
        self.cross_attn = MultiHeadAttention(d_model, num_heads)
        # Feed-Forward
        self.feed_forward = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, encoder_output, src_mask=None, tgt_mask=None):
        # Masked Self-Attention
        attn_out = self.self_attn(x, x, x, tgt_mask)
        x = self.norm1(x + self.dropout(attn_out))

        # Cross-Attention
        cross_out = self.cross_attn(x, encoder_output, encoder_output, src_mask)
        x = self.norm2(x + self.dropout(cross_out))

        # Feed-Forward
        ff_out = self.feed_forward(x)
        x = self.norm3(x + self.dropout(ff_out))
        return x


class TransformerModel(nn.Module):
    """Complete Transformer (Encoder + Decoder)"""

    def __init__(self, src_vocab, tgt_vocab, d_model=512, num_heads=8,
                 num_encoder_layers=6, num_decoder_layers=6,
                 d_ff=2048, max_len=512, dropout=0.1):
        super().__init__()
        self.d_model = d_model

        # Embeddings
        self.src_embedding = nn.Embedding(src_vocab, d_model)
        self.tgt_embedding = nn.Embedding(tgt_vocab, d_model)
        self.pos_encoding = SinusoidalPositionalEncoding(d_model, max_len)

        # Encoder
        self.encoder_layers = nn.ModuleList([
            TransformerEncoderLayer(d_model, num_heads, d_ff, dropout)
            for _ in range(num_encoder_layers)
        ])

        # Decoder
        self.decoder_layers = nn.ModuleList([
            TransformerDecoderLayer(d_model, num_heads, d_ff, dropout)
            for _ in range(num_decoder_layers)
        ])

        self.output_proj = nn.Linear(d_model, tgt_vocab)
        self.dropout = nn.Dropout(dropout)

    def generate_causal_mask(self, seq_len, device):
        """Generate a causal mask to prevent attending to future tokens"""
        mask = torch.triu(torch.ones(seq_len, seq_len, device=device), diagonal=1)
        mask = mask.bool()
        return ~mask  # True = attend, False = mask

    def encode(self, src):
        x = self.dropout(self.pos_encoding(
            self.src_embedding(src) * (self.d_model ** 0.5)
        ))
        for layer in self.encoder_layers:
            x = layer(x)
        return x

    def decode(self, tgt, encoder_output, tgt_mask=None):
        x = self.dropout(self.pos_encoding(
            self.tgt_embedding(tgt) * (self.d_model ** 0.5)
        ))
        for layer in self.decoder_layers:
            x = layer(x, encoder_output, tgt_mask=tgt_mask)
        return self.output_proj(x)

    def forward(self, src, tgt):
        tgt_mask = self.generate_causal_mask(tgt.size(1), tgt.device)
        encoder_output = self.encode(src)
        output = self.decode(tgt, encoder_output, tgt_mask)
        return output
```

### Code Example 4: Using BERT with Hugging Face

```python
from transformers import BertTokenizer, BertForSequenceClassification
from transformers import Trainer, TrainingArguments

# Load pre-trained model
tokenizer = BertTokenizer.from_pretrained('bert-base-multilingual-cased')
model = BertForSequenceClassification.from_pretrained(
    'bert-base-multilingual-cased',
    num_labels=3,
)

# Tokenize text
texts = ["This movie is wonderful", "It was a boring work"]
inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="pt")

# Inference
outputs = model(**inputs)
predictions = outputs.logits.argmax(dim=-1)

# Fine-tuning
training_args = TrainingArguments(
    output_dir='./results',
    num_train_epochs=3,
    per_device_train_batch_size=16,
    learning_rate=2e-5,
    weight_decay=0.01,
    warmup_steps=500,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
)
trainer.train()
```

### Code Example 4.5: Complete BERT Fine-tuning Pipeline

```python
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    get_linear_schedule_with_warmup
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import numpy as np

class TextDataset(Dataset):
    """Dataset for text classification"""

    def __init__(self, texts, labels, tokenizer, max_length=256):
        self.encodings = tokenizer(
            texts, truncation=True, padding=True,
            max_length=max_length, return_tensors="pt"
        )
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {key: val[idx] for key, val in self.encodings.items()}
        item["labels"] = self.labels[idx]
        return item


class BERTFineTuner:
    """Complete pipeline for BERT fine-tuning"""

    def __init__(self, model_name="bert-base-multilingual-cased",
                 num_labels=3, max_length=256, device=None):
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name, num_labels=num_labels
        ).to(self.device)
        self.max_length = max_length

    def prepare_data(self, texts, labels, test_size=0.2, batch_size=16):
        """Split data and create DataLoaders"""
        train_texts, val_texts, train_labels, val_labels = train_test_split(
            texts, labels, test_size=test_size, stratify=labels, random_state=42
        )

        self.train_dataset = TextDataset(
            train_texts, train_labels, self.tokenizer, self.max_length
        )
        self.val_dataset = TextDataset(
            val_texts, val_labels, self.tokenizer, self.max_length
        )

        self.train_loader = DataLoader(
            self.train_dataset, batch_size=batch_size, shuffle=True
        )
        self.val_loader = DataLoader(
            self.val_dataset, batch_size=batch_size
        )

    def train(self, epochs=3, lr=2e-5, warmup_ratio=0.1,
              weight_decay=0.01, max_grad_norm=1.0):
        """Training loop"""
        # Optimizer (do not apply weight_decay to bias and LayerNorm)
        no_decay = ["bias", "LayerNorm.weight"]
        optimizer_grouped_parameters = [
            {
                "params": [p for n, p in self.model.named_parameters()
                          if not any(nd in n for nd in no_decay)],
                "weight_decay": weight_decay,
            },
            {
                "params": [p for n, p in self.model.named_parameters()
                          if any(nd in n for nd in no_decay)],
                "weight_decay": 0.0,
            },
        ]
        optimizer = torch.optim.AdamW(optimizer_grouped_parameters, lr=lr)

        # Scheduler
        total_steps = len(self.train_loader) * epochs
        warmup_steps = int(total_steps * warmup_ratio)
        scheduler = get_linear_schedule_with_warmup(
            optimizer, warmup_steps, total_steps
        )

        best_val_acc = 0.0

        for epoch in range(epochs):
            # Training phase
            self.model.train()
            total_loss = 0
            correct = 0
            total = 0

            for batch in self.train_loader:
                batch = {k: v.to(self.device) for k, v in batch.items()}
                outputs = self.model(**batch)
                loss = outputs.loss

                loss.backward()
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(), max_grad_norm
                )
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()

                total_loss += loss.item()
                preds = outputs.logits.argmax(dim=-1)
                correct += (preds == batch["labels"]).sum().item()
                total += len(batch["labels"])

            train_acc = correct / total
            avg_loss = total_loss / len(self.train_loader)

            # Validation phase
            val_acc, val_report = self.evaluate()

            print(f"Epoch {epoch+1}/{epochs}")
            print(f"  Train Loss: {avg_loss:.4f}, Train Acc: {train_acc:.4f}")
            print(f"  Val Acc: {val_acc:.4f}")

            if val_acc > best_val_acc:
                best_val_acc = val_acc
                torch.save(self.model.state_dict(), "best_bert_model.pt")
                print(f"  -> Best model saved (acc={val_acc:.4f})")

        return best_val_acc

    def evaluate(self):
        """Evaluate on validation data"""
        self.model.eval()
        all_preds = []
        all_labels = []

        with torch.no_grad():
            for batch in self.val_loader:
                batch = {k: v.to(self.device) for k, v in batch.items()}
                outputs = self.model(**batch)
                preds = outputs.logits.argmax(dim=-1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(batch["labels"].cpu().numpy())

        acc = np.mean(np.array(all_preds) == np.array(all_labels))
        report = classification_report(all_labels, all_preds)
        return acc, report

    def predict(self, texts):
        """Inference on new texts"""
        self.model.eval()
        inputs = self.tokenizer(
            texts, truncation=True, padding=True,
            max_length=self.max_length, return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)
            preds = probs.argmax(dim=-1)

        return preds.cpu().numpy(), probs.cpu().numpy()


# Usage example
# fine_tuner = BERTFineTuner(num_labels=3)
# fine_tuner.prepare_data(texts, labels, batch_size=16)
# best_acc = fine_tuner.train(epochs=3, lr=2e-5)
# preds, probs = fine_tuner.predict(["This movie was amazing"])
```

---

## 4. Model Comparison

### RNN vs Transformer Comparison Table

| Property | RNN (LSTM/GRU) | Transformer |
|---|---|---|
| **Parallel computation** | Not possible (sequential processing) | Possible (all positions processed simultaneously) |
| **Long-range dependencies** | Weak (vanishing gradient) | Strong (direct reference) |
| **Computation** | O(n * d^2) | O(n^2 * d) |
| **Memory** | O(d) | O(n^2) |
| **Training speed** | Slow | Fast (GPU parallelization) |
| **Short sequences** | Efficient | Has overhead |
| **Long sequences** | Performance degrades | Excellent (but memory constrained) |

### Major Transformer Model Comparison Table

| Model | Structure | Parameters | Training Method | Primary Use |
|---|---|---|---|---|
| **BERT** | Encoder only | 110M/340M | Masked language model | Classification, QA, NER |
| **GPT-4** | Decoder only | Undisclosed | Next token prediction | Text generation |
| **T5** | Encoder-Decoder | 220M-11B | Text-to-Text | Translation, summarization, QA |
| **ViT** | Encoder only | 86M-632M | Image patches | Image classification |
| **Whisper** | Encoder-Decoder | 39M-1.5B | Speech-to-text | Speech recognition |

### Detailed Transformer Variant Comparison Table

| Model | Year | Attention Improvement | Context Length | Features |
|---|---|---|---|---|
| **Transformer** | 2017 | Full Attention | 512 | Original paper |
| **Transformer-XL** | 2019 | Segment Recurrence | 3,800 | Long context via memory mechanism |
| **Longformer** | 2020 | Local + Global | 4,096-16K | Sparse Attention |
| **BigBird** | 2020 | Random + Local + Global | 4,096 | With theoretical guarantees |
| **Flash Attention** | 2022 | IO-Aware | Arbitrary | Memory-efficient implementation |
| **Mamba** | 2023 | SSM (non-Attention) | Very long | Linear complexity |
| **Ring Attention** | 2024 | Distributed | Millions | For distributed environments |

### Pre-training Task Comparison

| Model | Pre-training Task | Masking Strategy | Directionality |
|---|---|---|---|
| **BERT** | MLM + NSP | Random 15% masking | Bidirectional |
| **RoBERTa** | MLM only | Dynamic masking | Bidirectional |
| **ALBERT** | MLM + SOP | Random 15% masking | Bidirectional |
| **ELECTRA** | RTD (Replaced Token Detection) | Replace with Generator | Bidirectional |
| **GPT** | CLM (Next token prediction) | Causal Mask | Left-to-right |
| **T5** | Span Corruption | Contiguous token masking | Encoder-Decoder |
| **XLNet** | PLM (Permutation language model) | Permutation combinations | Bidirectional (permutation) |

---

## Code Example 5: Positional Encoding

```python
class SinusoidalPositionalEncoding(nn.Module):
    """Sinusoidal positional encoding from the original Transformer paper"""

    def __init__(self, d_model, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]
```

### Code Example 5.5: Rotary Positional Embedding (RoPE)

```python
import torch
import torch.nn as nn

class RotaryPositionalEmbedding(nn.Module):
    """
    Rotary Positional Embedding (RoPE)
    - Used in LLaMA, GPT-NeoX, etc.
    - Embeds relative positional information via rotation matrices
    - Strong at length extrapolation
    """

    def __init__(self, dim, max_seq_len=4096, base=10000):
        super().__init__()
        self.dim = dim
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)

        # Pre-computation
        t = torch.arange(max_seq_len).float()
        freqs = torch.outer(t, inv_freq)  # [max_seq_len, dim/2]
        emb = torch.cat([freqs, freqs], dim=-1)  # [max_seq_len, dim]
        self.register_buffer("cos_cached", emb.cos())
        self.register_buffer("sin_cached", emb.sin())

    def forward(self, x, seq_len=None):
        # x: [batch, heads, seq_len, dim]
        if seq_len is None:
            seq_len = x.shape[2]
        return (
            self.cos_cached[:seq_len].unsqueeze(0).unsqueeze(0),
            self.sin_cached[:seq_len].unsqueeze(0).unsqueeze(0),
        )


def rotate_half(x):
    """Swap the first and second halves of dimensions with sign inversion"""
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat([-x2, x1], dim=-1)


def apply_rotary_pos_emb(q, k, cos, sin):
    """Apply RoPE to Q, K"""
    q_embed = (q * cos) + (rotate_half(q) * sin)
    k_embed = (k * cos) + (rotate_half(k) * sin)
    return q_embed, k_embed


class RoPEMultiHeadAttention(nn.Module):
    """Multi-Head Attention with RoPE"""

    def __init__(self, d_model, num_heads, max_seq_len=4096):
        super().__init__()
        self.d_k = d_model // num_heads
        self.num_heads = num_heads
        self.W_q = nn.Linear(d_model, d_model, bias=False)
        self.W_k = nn.Linear(d_model, d_model, bias=False)
        self.W_v = nn.Linear(d_model, d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)
        self.rope = RotaryPositionalEmbedding(self.d_k, max_seq_len)

    def forward(self, x, mask=None):
        batch_size, seq_len, _ = x.shape

        Q = self.W_q(x).view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        K = self.W_k(x).view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        V = self.W_v(x).view(batch_size, seq_len, self.num_heads, self.d_k).transpose(1, 2)

        # Apply RoPE
        cos, sin = self.rope(Q, seq_len)
        Q, K = apply_rotary_pos_emb(Q, K, cos, sin)

        # Scaled Dot-Product Attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.d_k ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        attn = torch.softmax(scores, dim=-1)
        output = torch.matmul(attn, V)

        output = output.transpose(1, 2).contiguous().view(batch_size, seq_len, -1)
        return self.W_o(output)
```

---

## 5. Efficient Inference and Quantization

### Code Example 6: Model Quantization

```python
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

class ModelOptimizer:
    """Optimization tools for Transformer models"""

    @staticmethod
    def quantize_dynamic(model):
        """Dynamic quantization (for CPU inference)"""
        quantized = torch.quantization.quantize_dynamic(
            model, {torch.nn.Linear}, dtype=torch.qint8
        )
        return quantized

    @staticmethod
    def compare_model_sizes(original, quantized):
        """Compare model sizes"""
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix=".pt") as f:
            torch.save(original.state_dict(), f.name)
            original_size = os.path.getsize(f.name)

        with tempfile.NamedTemporaryFile(suffix=".pt") as f:
            torch.save(quantized.state_dict(), f.name)
            quantized_size = os.path.getsize(f.name)

        print(f"Original model: {original_size / 1e6:.1f} MB")
        print(f"After quantization: {quantized_size / 1e6:.1f} MB")
        print(f"Compression ratio: {quantized_size / original_size:.1%}")

    @staticmethod
    def benchmark_inference(model, tokenizer, texts, num_runs=100):
        """Benchmark inference speed"""
        import time

        model.eval()
        inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="pt")

        # Warmup
        with torch.no_grad():
            for _ in range(10):
                _ = model(**inputs)

        # Measurement
        start = time.time()
        with torch.no_grad():
            for _ in range(num_runs):
                _ = model(**inputs)
        elapsed = time.time() - start

        print(f"Average inference time: {elapsed / num_runs * 1000:.2f} ms")
        print(f"Throughput: {num_runs / elapsed:.1f} inferences/sec")

    @staticmethod
    def export_onnx(model, tokenizer, output_path="model.onnx", max_length=128):
        """Export in ONNX format"""
        model.eval()
        dummy_input = tokenizer(
            "Sample text", return_tensors="pt",
            padding="max_length", max_length=max_length, truncation=True
        )

        torch.onnx.export(
            model,
            (dummy_input["input_ids"], dummy_input["attention_mask"]),
            output_path,
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size"},
                "attention_mask": {0: "batch_size"},
                "logits": {0: "batch_size"},
            },
            opset_version=14,
        )
        print(f"ONNX model output: {output_path}")


# KV Cache implementation
class KVCache:
    """
    Key-Value Cache: Speed up autoregressive generation
    - Reuse previously computed K, V
    - Reduce computation per generation step to O(n)
    """

    def __init__(self, max_batch_size=1, max_seq_len=2048,
                 num_heads=8, head_dim=64, num_layers=12):
        self.max_seq_len = max_seq_len
        self.cache = {}
        for layer in range(num_layers):
            self.cache[layer] = {
                "key": torch.zeros(max_batch_size, num_heads, max_seq_len, head_dim),
                "value": torch.zeros(max_batch_size, num_heads, max_seq_len, head_dim),
            }
        self.current_len = 0

    def update(self, layer, key, value):
        """Add new K, V to cache"""
        new_len = key.shape[2]
        self.cache[layer]["key"][:, :, self.current_len:self.current_len + new_len] = key
        self.cache[layer]["value"][:, :, self.current_len:self.current_len + new_len] = value

    def get(self, layer):
        """Retrieve K, V from cache"""
        return (
            self.cache[layer]["key"][:, :, :self.current_len + 1],
            self.cache[layer]["value"][:, :, :self.current_len + 1],
        )

    def advance(self):
        """Advance position by one"""
        self.current_len += 1

    def reset(self):
        """Reset cache"""
        self.current_len = 0
        for layer in self.cache:
            self.cache[layer]["key"].zero_()
            self.cache[layer]["value"].zero_()
```

### Code Example 6.5: Parameter-Efficient Fine-tuning with LoRA (Low-Rank Adaptation)

```python
import torch
import torch.nn as nn
import math

class LoRALayer(nn.Module):
    """
    LoRA: Low-Rank Adaptation
    - Add low-rank matrices A*B to the original weight matrix W
    - W' = W + alpha/r * A * B
    - Drastically reduces the number of trainable parameters
    """

    def __init__(self, original_layer, rank=8, alpha=16):
        super().__init__()
        self.original_layer = original_layer
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank

        in_features = original_layer.in_features
        out_features = original_layer.out_features

        # Low-rank matrices
        self.lora_A = nn.Parameter(torch.zeros(in_features, rank))
        self.lora_B = nn.Parameter(torch.zeros(rank, out_features))

        # Initialization
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        nn.init.zeros_(self.lora_B)

        # Freeze original weights
        for param in self.original_layer.parameters():
            param.requires_grad = False

    def forward(self, x):
        original_output = self.original_layer(x)
        lora_output = (x @ self.lora_A @ self.lora_B) * self.scaling
        return original_output + lora_output


def apply_lora_to_model(model, rank=8, alpha=16, target_modules=None):
    """
    Apply LoRA to specific Linear layers of a model

    Args:
        model: Target model
        rank: LoRA rank
        alpha: Scaling factor
        target_modules: List of module names to apply LoRA to
    """
    if target_modules is None:
        target_modules = ["query", "key", "value", "dense"]

    total_params = 0
    lora_params = 0

    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            total_params += module.weight.numel()

            if any(target in name for target in target_modules):
                # Replace with LoRA layer
                parent_name = ".".join(name.split(".")[:-1])
                child_name = name.split(".")[-1]

                parent = model
                for part in parent_name.split("."):
                    if part:
                        parent = getattr(parent, part)

                lora_layer = LoRALayer(module, rank=rank, alpha=alpha)
                setattr(parent, child_name, lora_layer)
                lora_params += rank * (module.in_features + module.out_features)

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    frozen = sum(p.numel() for p in model.parameters() if not p.requires_grad)

    print(f"Original parameters: {total_params:,}")
    print(f"LoRA parameters: {lora_params:,}")
    print(f"Trainable parameters: {trainable:,} ({trainable/(trainable+frozen):.2%})")
    print(f"Frozen parameters: {frozen:,}")

    return model

# Usage example
# from transformers import AutoModelForSequenceClassification
# model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=2)
# model = apply_lora_to_model(model, rank=8, alpha=16)
```

---

## 6. Latest Sequence Models

### Code Example 7: State Space Model (Mamba-style Implementation)

```python
import torch
import torch.nn as nn

class SelectiveSSM(nn.Module):
    """
    Selective State Space Model (simplified Mamba implementation)
    - Selectively retains information via input-dependent gating
    - Can perform sequential processing like RNN (fast at inference)
    - Can also train in parallel like Transformer
    """

    def __init__(self, d_model, d_state=16, d_conv=4, expand=2):
        super().__init__()
        self.d_model = d_model
        self.d_state = d_state
        self.d_inner = int(expand * d_model)

        # Input projection
        self.in_proj = nn.Linear(d_model, self.d_inner * 2, bias=False)

        # 1D convolution (local dependencies)
        self.conv1d = nn.Conv1d(
            self.d_inner, self.d_inner,
            kernel_size=d_conv, padding=d_conv - 1,
            groups=self.d_inner
        )

        # SSM parameters
        self.x_proj = nn.Linear(self.d_inner, d_state * 2 + 1, bias=False)
        self.dt_proj = nn.Linear(1, self.d_inner, bias=True)

        # A parameter (initialized as diagonal matrix)
        A = torch.arange(1, d_state + 1, dtype=torch.float32)
        self.A_log = nn.Parameter(torch.log(A).unsqueeze(0).expand(self.d_inner, -1))

        self.D = nn.Parameter(torch.ones(self.d_inner))
        self.out_proj = nn.Linear(self.d_inner, d_model, bias=False)

    def forward(self, x):
        """
        x: [batch, seq_len, d_model]
        """
        batch, seq_len, _ = x.shape

        # Input projection → x, z
        xz = self.in_proj(x)  # [batch, seq_len, d_inner * 2]
        x_branch, z = xz.chunk(2, dim=-1)

        # 1D convolution
        x_conv = self.conv1d(x_branch.transpose(1, 2))[:, :, :seq_len].transpose(1, 2)
        x_conv = torch.silu(x_conv)

        # SSM parameter computation (input-dependent)
        x_ssm = self.x_proj(x_conv)  # [batch, seq_len, d_state*2 + 1]
        B = x_ssm[:, :, :self.d_state]
        C = x_ssm[:, :, self.d_state:self.d_state*2]
        dt = torch.softplus(self.dt_proj(x_ssm[:, :, -1:]))

        # Discretization of A
        A = -torch.exp(self.A_log)  # [d_inner, d_state]

        # Sequential SSM computation (simplified version)
        y = self._ssm_scan(x_conv, A, B, C, dt)

        # Gating
        y = y * torch.silu(z)
        return self.out_proj(y)

    def _ssm_scan(self, x, A, B, C, dt):
        """Sequential SSM scan"""
        batch, seq_len, d_inner = x.shape
        d_state = A.shape[1]

        h = torch.zeros(batch, d_inner, d_state, device=x.device)
        outputs = []

        for t in range(seq_len):
            # State update: h = A_bar * h + B_bar * x
            dt_t = dt[:, t].unsqueeze(-1)  # [batch, d_inner, 1]
            A_bar = torch.exp(A.unsqueeze(0) * dt_t)  # [batch, d_inner, d_state]
            B_bar = dt_t * B[:, t].unsqueeze(1)  # [batch, d_inner, d_state]

            h = A_bar * h + B_bar * x[:, t].unsqueeze(-1)

            # Output: y = C * h
            y_t = (h * C[:, t].unsqueeze(1)).sum(dim=-1)  # [batch, d_inner]
            outputs.append(y_t)

        return torch.stack(outputs, dim=1)  # [batch, seq_len, d_inner]


class MambaBlock(nn.Module):
    """Mamba Block (SSM + Skip Connection + Norm)"""

    def __init__(self, d_model, d_state=16, d_conv=4, expand=2):
        super().__init__()
        self.norm = nn.LayerNorm(d_model)
        self.ssm = SelectiveSSM(d_model, d_state, d_conv, expand)

    def forward(self, x):
        return x + self.ssm(self.norm(x))
```

### Code Example 7.5: Flash Attention Conceptual Implementation

```python
import torch
import torch.nn.functional as F
import math

def flash_attention_reference(Q, K, V, block_size=256):
    """
    Flash Attention conceptual implementation (for reference)
    - Actual Flash Attention is implemented as a CUDA kernel
    - This is a reference implementation for understanding the algorithm

    Key Idea:
    - Divide Attention computation into small blocks
    - Process in sizes that fit in SRAM (fast memory)
    - Compute Softmax online (log-sum-exp trick)
    """
    batch, heads, seq_len, d_k = Q.shape

    # Initialize output and log-sum-exp
    O = torch.zeros_like(V)
    L = torch.zeros(batch, heads, seq_len, 1, device=Q.device)  # log-sum-exp
    M = torch.full((batch, heads, seq_len, 1), float('-inf'), device=Q.device)  # max

    num_blocks = math.ceil(seq_len / block_size)

    for j in range(num_blocks):
        # K, V block
        j_start = j * block_size
        j_end = min((j + 1) * block_size, seq_len)
        K_block = K[:, :, j_start:j_end]
        V_block = V[:, :, j_start:j_end]

        for i in range(num_blocks):
            # Q block
            i_start = i * block_size
            i_end = min((i + 1) * block_size, seq_len)
            Q_block = Q[:, :, i_start:i_end]

            # Attention scores between blocks
            S_block = torch.matmul(Q_block, K_block.transpose(-2, -1)) / math.sqrt(d_k)

            # Online Softmax
            M_block = S_block.max(dim=-1, keepdim=True).values
            M_new = torch.max(M[:, :, i_start:i_end], M_block)

            # Stable exponential computation
            exp_old = torch.exp(M[:, :, i_start:i_end] - M_new)
            exp_new = torch.exp(S_block - M_new)

            L_new = exp_old * L[:, :, i_start:i_end] + exp_new.sum(dim=-1, keepdim=True)

            # Update output
            O[:, :, i_start:i_end] = (
                exp_old * O[:, :, i_start:i_end] +
                torch.matmul(exp_new, V_block)
            )

            M[:, :, i_start:i_end] = M_new
            L[:, :, i_start:i_end] = L_new

    # Normalization
    O = O / L
    return O


# In PyTorch 2.0+, use torch.nn.functional.scaled_dot_product_attention
def efficient_attention_pytorch2(Q, K, V, is_causal=False):
    """Flash Attention API in PyTorch 2.0"""
    # Automatically selects Flash Attention or Memory-Efficient Attention
    return F.scaled_dot_product_attention(
        Q, K, V,
        is_causal=is_causal,
        # dropout_p=0.0,  # 0 during inference
    )
```

---

## 7. Practical Troubleshooting

### Troubleshooting Guide

| Symptom | Cause | Solution |
|---|---|---|
| Loss becomes NaN | Learning rate too high / gradient explosion | Reduce learning rate by 1/10, add Gradient Clipping |
| Loss does not decrease | Learning rate too low / data issue | Increase learning rate, check data, verify label correctness |
| Overfitting (train↓ val↑) | Model too large / insufficient data | Increase Dropout, add Weight Decay, data augmentation |
| GPU out of memory | Batch size / sequence length too large | Reduce batch size, Gradient Accumulation, Mixed Precision |
| Training is slow | DataLoader bottleneck | Increase num_workers, pin_memory=True, cache preprocessing |
| Tokenizer error | Special characters / text too long | truncation=True, preprocess special characters |
| Fine-tuning instability | Learning rate too high / insufficient Warmup | Learning rate below 2e-5, 10% Warmup Steps |

### Code Example 8: Mixed Precision Training

```python
import torch
from torch.cuda.amp import autocast, GradScaler

class MixedPrecisionTrainer:
    """Reduce memory usage and speed up with Mixed Precision Training"""

    def __init__(self, model, optimizer, criterion):
        self.model = model
        self.optimizer = optimizer
        self.criterion = criterion
        self.scaler = GradScaler()

    def train_step(self, batch):
        self.optimizer.zero_grad()

        with autocast():
            outputs = self.model(**batch)
            loss = outputs.loss if hasattr(outputs, 'loss') else self.criterion(
                outputs, batch["labels"]
            )

        # Scaled backward
        self.scaler.scale(loss).backward()

        # Gradient clipping (unscale first)
        self.scaler.unscale_(self.optimizer)
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)

        # Optimizer step
        self.scaler.step(self.optimizer)
        self.scaler.update()

        return loss.item()

    def train_epoch(self, dataloader, accumulation_steps=4):
        """Training epoch with Gradient Accumulation"""
        self.model.train()
        total_loss = 0

        for step, batch in enumerate(dataloader):
            batch = {k: v.cuda() for k, v in batch.items()}

            with autocast():
                outputs = self.model(**batch)
                loss = outputs.loss / accumulation_steps

            self.scaler.scale(loss).backward()

            if (step + 1) % accumulation_steps == 0:
                self.scaler.unscale_(self.optimizer)
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.scaler.step(self.optimizer)
                self.scaler.update()
                self.optimizer.zero_grad()

            total_loss += loss.item() * accumulation_steps

        return total_loss / len(dataloader)
```

### Code Example 8.5: Memory Saving with Gradient Checkpointing

```python
import torch
from torch.utils.checkpoint import checkpoint

class MemoryEfficientTransformer(nn.Module):
    """Save VRAM with Gradient Checkpointing"""

    def __init__(self, d_model, num_heads, num_layers, d_ff,
                 vocab_size, max_len=512, use_checkpointing=True):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = SinusoidalPositionalEncoding(d_model, max_len)
        self.layers = nn.ModuleList([
            TransformerEncoderLayer(d_model, num_heads, d_ff)
            for _ in range(num_layers)
        ])
        self.classifier = nn.Linear(d_model, 2)
        self.use_checkpointing = use_checkpointing

    def forward(self, x):
        x = self.pos_encoding(self.embedding(x))

        for layer in self.layers:
            if self.use_checkpointing and self.training:
                # Gradient Checkpointing: do not save intermediate activations,
                # recompute during backward pass (reduces memory, increases computation time)
                x = checkpoint(layer, x, use_reentrant=False)
            else:
                x = layer(x)

        return self.classifier(x[:, 0])


def estimate_memory_savings(model, input_shape, dtype=torch.float32):
    """Estimate memory savings from Gradient Checkpointing"""
    batch_size, seq_len = input_shape
    d_model = model.embedding.embedding_dim
    num_layers = len(model.layers)

    # Intermediate activation memory (approximate)
    activation_per_layer = batch_size * seq_len * d_model * 4  # bytes (float32)
    total_activation = activation_per_layer * num_layers

    # With checkpointing: sqrt(num_layers) worth of memory
    import math
    checkpointed_activation = activation_per_layer * math.sqrt(num_layers)

    print(f"Normal intermediate activations: {total_activation / 1e9:.2f} GB")
    print(f"After checkpointing: {checkpointed_activation / 1e9:.2f} GB")
    print(f"Reduction rate: {1 - checkpointed_activation / total_activation:.1%}")
```

---

## 8. Performance Optimization Checklist

### Training Optimization

| Category | Check Item | Recommended Setting |
|---|---|---|
| **Learning rate** | Use Warmup + Linear Decay | BERT: 2e-5 to 5e-5 |
| **Batch size** | Increase effective batch with Gradient Accumulation | Effective 32-64 |
| **Precision** | Use Mixed Precision (FP16/BF16) | Enable AMP |
| **Memory** | Enable Gradient Checkpointing | Essential for large models |
| **Regularization** | Weight Decay (exclude bias/LN) | 0.01-0.1 |
| **Gradient Clipping** | Set max_norm | 1.0 |
| **Early Stopping** | Monitor Validation Loss | patience=3-5 |
| **Data preprocessing** | Dynamic Padding / Bucketing | Group by sequence length |

### Inference Optimization

| Method | Memory Reduction | Speed Up | Accuracy Impact | Difficulty |
|---|---|---|---|---|
| **Dynamic Quantization (INT8)** | 2-4x | 1.5-3x | Minimal | Low |
| **Static Quantization** | 2-4x | 2-4x | Small | Medium |
| **KV Cache** | - | 2-10x | None | Low |
| **Flash Attention** | 2-4x | 2-4x | None | Low |
| **ONNX Runtime** | - | 1.5-3x | None | Low |
| **TensorRT** | - | 2-5x | Minimal | Medium |
| **LoRA / QLoRA** | 10-100x | - | Small to Medium | Medium |
| **Knowledge Distillation** | 3-10x | 3-10x | Medium | High |
| **Speculative Decoding** | - | 2-3x | None | High |

---

## Anti-patterns

### 1. Training a Large Transformer on Small Data

**Problem**: Fine-tuning BERT-large on 100 samples leads to overfitting. When the number of parameters greatly exceeds the number of data points, generalization performance drops dramatically.

**Solution**: For small datasets, use lightweight models (DistilBERT) or few-shot learning (prompt engineering). Also consider data augmentation.

### 2. Ignoring Attention Computational Cost in Design

**Problem**: Self-Attention consumes memory quadratic to sequence length. Processing long texts (10,000+ tokens) exhausts GPU memory.

**Solution**: Consider Longformer (local + global Attention), Flash Attention (memory efficiency), or chunking the input.

### 3. Improper Use of Tokenizers

**Problem**: Using a Tokenizer that doesn't match the model, or failing to account for special tokens ([CLS], [SEP]) in preprocessing.

```python
# BAD: Batch processing without padding/truncation
inputs = tokenizer(texts)  # Unequal lengths → error

# BAD: Using a Tokenizer from a different model
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
model = AutoModelForSequenceClassification.from_pretrained("roberta-base")
# → Token ID mappings are misaligned, producing meaningless results

# GOOD: Use a Tokenizer matching the model with proper preprocessing
model_name = "bert-base-multilingual-cased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)
inputs = tokenizer(texts, padding=True, truncation=True,
                   max_length=512, return_tensors="pt")
```

### 4. Not Using a Learning Rate Schedule

**Problem**: Using a fixed learning rate for Transformer fine-tuning tends to make training unstable.

```python
# BAD: Fixed learning rate
optimizer = torch.optim.Adam(model.parameters(), lr=3e-5)

# GOOD: Warmup + Linear Decay
from transformers import get_linear_schedule_with_warmup
optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
scheduler = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=int(total_steps * 0.1),  # 10% warmup
    num_training_steps=total_steps
)
```

### 5. Always Using Teacher Forcing

**Problem**: Always feeding ground truth during Seq2Seq training causes errors to accumulate during inference (exposure bias).

```python
# BAD: Always Teacher Forcing
teacher_forcing_ratio = 1.0  # Large gap with inference

# GOOD: Scheduled Sampling
# Gradually reduce Teacher Forcing ratio as training progresses
teacher_forcing_ratio = max(0.5, 1.0 - epoch * 0.1)
```

---

## FAQ

### Q1: Are RNNs no longer used?

**A**: While Transformer is mainstream, RNNs still have their use cases. LSTM/GRU are efficient for real-time streaming processing, edge devices with memory constraints, and short fixed-length sequence processing. State Space Models like Mamba also achieve Transformer-level performance while leveraging the advantages of RNN-like sequential processing.

### Q2: How should I choose between BERT and GPT?

**A**: BERT excels at bidirectional context understanding and is ideal for classification, information extraction, and question answering. GPT is autoregressive (left-to-right) and ideal for text generation, summarization, and translation. Choose BERT-family for understanding tasks and GPT-family for generation tasks.

### Q3: How many GPUs are needed to train a Transformer?

**A**: For fine-tuning, BERT-base requires 1 GPU (16GB VRAM), and BERT-large requires 1-2 GPUs as a rough guide. Pre-training requires large-scale compute resources, with even BERT-base taking tens of GPU-days.

### Q4: When should I use LoRA vs Full Fine-tuning?

**A**: Decide based on data volume and resources. Full Fine-tuning achieves the best accuracy with large datasets (100,000+ samples) and sufficient GPUs. LoRA is efficient for small to medium datasets (hundreds to tens of thousands) and significantly saves GPU memory. With QLoRA (4-bit quantization + LoRA), you can fine-tune a 7B parameter model on a single GPU (16GB VRAM).

### Q5: When should I use Flash Attention?

**A**: You should always enable it for tasks with sequence lengths of 512 or more when using PyTorch 2.0+. `torch.nn.functional.scaled_dot_product_attention` automatically selects the optimal implementation. Especially for long sequences (2048+ tokens), memory usage is reduced by 2-4x and speed improves by 2-4x.

### Q6: Which positional encoding should I choose for Transformer?

**A**: It depends on the task and requirements:
- **Sinusoidal**: Fixed-length, simple, highly versatile (original paper)
- **Learnable**: Can be optimized for specific tasks (BERT)
- **RoPE**: Strong at length extrapolation, supports relative positions (LLaMA, GPT-NeoX)
- **ALiBi**: Adds positional bias directly to Attention, strong at extrapolation (BLOOM)
RoPE is mainstream in the latest LLMs.

### Q7: What is the significance of visualizing Attention weights?

**A**: It helps improve model interpretability. Specifically: (1) Verify which parts of the input the model focuses on, (2) Debugging (whether the model learns expected patterns), (3) Explaining the model to domain experts. However, note that Attention weights do not necessarily reflect the model's "reasoning" (Jain & Wallace, 2019).

---

## Summary

| Item | Key Points |
|---|---|
| RNN | Sequential processing of time series. Weak at long-range dependencies due to vanishing gradients |
| LSTM/GRU | Gate mechanisms mitigate vanishing gradients. Effective for medium-length sequences |
| Self-Attention | Directly computes relationships between all positions. Strong at long-range dependencies |
| Multi-Head | Computes Attention from multiple perspectives. Improves expressiveness |
| Transformer | Attention-based architecture enabling parallel processing |
| BERT | Bidirectional Encoder. Standard for classification and understanding tasks |
| GPT | Autoregressive Decoder. Standard for text generation |
| LoRA | Parameter-efficient fine-tuning. Adapts large models with fewer resources |
| Flash Attention | Memory-efficient Attention implementation. Essential for long sequence processing |
| SSM (Mamba) | Linear-complexity sequence model. Combines strengths of RNN and Transformer |

## Recommended Next Guides

- [Computer Vision](../03-applied/01-computer-vision.md) — Applications of Vision Transformer
- [MLOps](../03-applied/02-mlops.md) — Deployment and operation of Transformer models

## References

1. **Vaswani et al.**: [Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762) — Original Transformer paper
2. **Devlin et al.**: [BERT: Pre-training of Deep Bidirectional Transformers (2018)](https://arxiv.org/abs/1810.04805) — Original BERT paper
3. **Jay Alammar**: [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) — Visual explanation of Transformer
4. **Hu et al.**: [LoRA: Low-Rank Adaptation of Large Language Models (2021)](https://arxiv.org/abs/2106.09685) — Original LoRA paper
5. **Dao et al.**: [FlashAttention: Fast and Memory-Efficient Exact Attention (2022)](https://arxiv.org/abs/2205.14135) — Original Flash Attention paper
6. **Gu & Dao**: [Mamba: Linear-Time Sequence Modeling with Selective State Spaces (2023)](https://arxiv.org/abs/2312.00752) — Original Mamba paper
