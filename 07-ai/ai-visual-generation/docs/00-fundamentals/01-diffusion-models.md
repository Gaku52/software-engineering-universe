# Diffusion Models — DDPM, Score Matching, and Noise Schedules

> A complete guide to the mathematical foundations and implementation of diffusion models that underpin modern image generation, covering forward diffusion and reverse diffusion processes.

---

## What You Will Learn in This Chapter

1. **Mathematical Foundations of Diffusion Models** — Forward process, reverse process, variational lower bound (ELBO), and noise schedules
2. **Relationship Between DDPM and Score Matching** — Equivalence of denoising and score functions
3. **Fast Sampling Methods** — Accelerating inference with DDIM, DPM-Solver, and Consistency Models
4. **Latent Diffusion Model (LDM)** — Computational efficiency through diffusion in latent space
5. **Classifier-Free Guidance** — Mechanism for improving conditional generation quality
6. **Rectified Flow and Flow Matching** — Core technology behind SD3/Flux


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [Visual AI Overview — History and Present of Image Generation](./00-visual-ai-overview.md)

---

## 1. Basic Concepts of Diffusion Models

### Code Example 1: Forward Diffusion Process

```python
import torch
import numpy as np

def linear_beta_schedule(timesteps, beta_start=0.0001, beta_end=0.02):
    """Linear noise schedule"""
    return torch.linspace(beta_start, beta_end, timesteps)

def cosine_beta_schedule(timesteps, s=0.008):
    """Cosine noise schedule (improved version)

    Proposed by Nichol & Dhariwal (2021).
    Addresses problems with linear schedules:
    - Gradual information loss near the end
    - More uniform decrease of SNR (Signal-to-Noise Ratio)
    """
    steps = timesteps + 1
    x = torch.linspace(0, timesteps, steps)
    alphas_cumprod = torch.cos(((x / timesteps) + s) / (1 + s) * np.pi * 0.5) ** 2
    alphas_cumprod = alphas_cumprod / alphas_cumprod[0]
    betas = 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])
    return torch.clamp(betas, 0.0001, 0.9999)

def sigmoid_beta_schedule(timesteps, beta_start=0.0001, beta_end=0.02):
    """Sigmoid noise schedule

    Has the characteristic of rapid noise increase in the middle region.
    Used in some models.
    """
    betas = torch.linspace(-6, 6, timesteps)
    betas = torch.sigmoid(betas) * (beta_end - beta_start) + beta_start
    return betas

class ForwardDiffusion:
    """Complete implementation of the forward diffusion process

    Mathematical background:
    - Forward process: q(x_t | x_{t-1}) = N(x_t; sqrt(1-beta_t) * x_{t-1}, beta_t * I)
    - Direct transition to any t: q(x_t | x_0) = N(x_t; sqrt(alpha_bar_t) * x_0, (1-alpha_bar_t) * I)
    - Where alpha_bar_t = prod_{s=1}^{t} (1 - beta_s)
    """
    def __init__(self, timesteps=1000, schedule="linear"):
        self.T = timesteps

        if schedule == "linear":
            self.betas = linear_beta_schedule(timesteps)
        elif schedule == "cosine":
            self.betas = cosine_beta_schedule(timesteps)
        elif schedule == "sigmoid":
            self.betas = sigmoid_beta_schedule(timesteps)
        else:
            raise ValueError(f"Unknown schedule: {schedule}")

        # Precomputation (store all intermediate values for efficiency)
        self.alphas = 1.0 - self.betas
        self.alphas_cumprod = torch.cumprod(self.alphas, dim=0)
        self.alphas_cumprod_prev = torch.cat(
            [torch.tensor([1.0]), self.alphas_cumprod[:-1]]
        )

        # Constants for the forward process
        self.sqrt_alphas_cumprod = torch.sqrt(self.alphas_cumprod)
        self.sqrt_one_minus_alphas_cumprod = torch.sqrt(1.0 - self.alphas_cumprod)

        # Constants for the reverse process
        self.sqrt_recip_alphas_cumprod = torch.sqrt(1.0 / self.alphas_cumprod)
        self.sqrt_recipm1_alphas_cumprod = torch.sqrt(1.0 / self.alphas_cumprod - 1)

        # Variance of the posterior distribution q(x_{t-1} | x_t, x_0)
        self.posterior_variance = (
            self.betas * (1.0 - self.alphas_cumprod_prev) / (1.0 - self.alphas_cumprod)
        )
        self.posterior_log_variance_clipped = torch.log(
            torch.clamp(self.posterior_variance, min=1e-20)
        )

        # Coefficients for the posterior distribution mean
        self.posterior_mean_coef1 = (
            self.betas * torch.sqrt(self.alphas_cumprod_prev) / (1.0 - self.alphas_cumprod)
        )
        self.posterior_mean_coef2 = (
            (1.0 - self.alphas_cumprod_prev) * torch.sqrt(self.alphas) / (1.0 - self.alphas_cumprod)
        )

        # SNR (Signal-to-Noise Ratio) computation
        self.snr = self.alphas_cumprod / (1.0 - self.alphas_cumprod)
        self.log_snr = torch.log(self.snr)

    def q_sample(self, x_0, t, noise=None):
        """
        Forward process: q(x_t | x_0) = N(sqrt(alpha_bar_t) * x_0, (1 - alpha_bar_t) * I)
        Can compute the noisy image at any timestep t in one step
        """
        if noise is None:
            noise = torch.randn_like(x_0)

        sqrt_alpha = self.sqrt_alphas_cumprod[t].view(-1, 1, 1, 1)
        sqrt_one_minus_alpha = self.sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1, 1)

        return sqrt_alpha * x_0 + sqrt_one_minus_alpha * noise

    def q_posterior_mean_variance(self, x_0, x_t, t):
        """
        Compute the mean and variance of the posterior distribution q(x_{t-1} | x_t, x_0)

        This is the "ground truth" of the reverse process; the model approximates this.
        mu = coef1 * x_0 + coef2 * x_t
        """
        mu = (
            self.posterior_mean_coef1[t].view(-1, 1, 1, 1) * x_0
            + self.posterior_mean_coef2[t].view(-1, 1, 1, 1) * x_t
        )
        var = self.posterior_variance[t].view(-1, 1, 1, 1)
        log_var = self.posterior_log_variance_clipped[t].view(-1, 1, 1, 1)
        return mu, var, log_var

    def get_snr(self, t):
        """Get the SNR at a given timestep (used for loss weighting)"""
        return self.snr[t]
```

### Code Example 1b: SNR (Signal-to-Noise Ratio) Analysis

```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def analyze_schedules():
    """Comparative analysis of SNR characteristics for each noise schedule"""
    timesteps = 1000
    schedules = {
        "Linear": linear_beta_schedule(timesteps),
        "Cosine": cosine_beta_schedule(timesteps),
        "Sigmoid": sigmoid_beta_schedule(timesteps),
    }

    analysis = {}
    for name, betas in schedules.items():
        alphas = 1.0 - betas
        alphas_cumprod = torch.cumprod(alphas, dim=0)
        snr = alphas_cumprod / (1.0 - alphas_cumprod)
        log_snr = torch.log(snr)

        analysis[name] = {
            "betas_range": f"[{betas[0]:.6f}, {betas[-1]:.6f}]",
            "alpha_bar_final": f"{alphas_cumprod[-1]:.6f}",
            "snr_start": f"{snr[0]:.2f}",
            "snr_end": f"{snr[-1]:.6f}",
            "log_snr_range": f"[{log_snr[-1]:.2f}, {log_snr[0]:.2f}]",
            "half_snr_timestep": int(torch.argmin(torch.abs(log_snr)).item()),
        }

    for name, info in analysis.items():
        print(f"\n--- {name} Schedule ---")
        for key, value in info.items():
            print(f"  {key}: {value}")

    return analysis

# analyze_schedules()
```

### ASCII Diagram 1: Overview of Forward and Reverse Diffusion

```
Forward diffusion process q(x_t | x_{t-1})  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━>

  x_0           x_1           x_2          ...        x_{T-1}        x_T
[Original] -> [Slightly    -> [More      -> ... -> [Almost      -> [Pure
 image]        noisy]         noisy]                noise]          noise]
  ^                                                                  ^
  Clean image                                           N(0, I) Gaussian noise

<━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  Reverse diffusion process p_theta(x_{t-1} | x_t)

  x_0           x_1           x_2          ...        x_{T-1}        x_T
[Generated] <- [Denoised]  <- [Denoised] <- ... <- [Denoised]  <- [Random]
 image]

Mathematical expressions:
  Forward: q(x_t | x_{t-1}) = N(x_t; sqrt(1-beta_t) x_{t-1}, beta_t I)
  Reverse: p_theta(x_{t-1}| x_t) = N(x_{t-1}; mu_theta(x_t, t), sigma^2_t I)

Direct sampling (to any t):
  q(x_t | x_0) = N(x_t; sqrt(alpha_bar_t) x_0, (1-alpha_bar_t) I)
  where alpha_bar_t = prod_{s=1}^{t} (1 - beta_s)
```

### ASCII Diagram 1b: SNR (Signal-to-Noise Ratio) Over Time

```
SNR (log scale)
  ^
  |   ***** High SNR (signal dominant)
  |  \
  |   \-- Linear
  |    \
  |     \      Cosine --\
  |      \                \
  |       \                 \
  |        \                  \
  |         \                   \
  | - - - - -\- - - - - - - - - -\- - SNR = 1 (signal = noise)
  |           \                    \
  |            \                     \
  |             \                      \
  |              ***** Low SNR (noise dominant)
  +--------------------------------------> Timestep t
  0                                    T

Linear: Information drops to near zero at the end (sharp degradation at the final steps)
Cosine: Smoother SNR decline (uniform learning effect across all steps)
```

---

## 2. DDPM Training and Inference

### Code Example 2: DDPM Noise Prediction Network (Simplified UNet)

```python
import torch.nn as nn
import torch.nn.functional as F

class SinusoidalPositionEmbeddings(nn.Module):
    """Positional embeddings for timestep t

    Similar to Transformer positional encoding,
    converts integer timestep t into a high-dimensional continuous vector.

    PE(t, 2i) = sin(t / 10000^(2i/d))
    PE(t, 2i+1) = cos(t / 10000^(2i/d))
    """
    def __init__(self, dim):
        super().__init__()
        self.dim = dim

    def forward(self, t):
        device = t.device
        half_dim = self.dim // 2
        emb = np.log(10000) / (half_dim - 1)
        emb = torch.exp(torch.arange(half_dim, device=device) * -emb)
        emb = t[:, None] * emb[None, :]
        return torch.cat([emb.sin(), emb.cos()], dim=-1)

class ResBlock(nn.Module):
    """Residual block + timestep conditioning"""
    def __init__(self, in_ch, out_ch, time_dim):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1)
        self.norm1 = nn.GroupNorm(8, out_ch)
        self.norm2 = nn.GroupNorm(8, out_ch)
        self.time_proj = nn.Linear(time_dim, out_ch)
        self.residual = nn.Conv2d(in_ch, out_ch, 1) if in_ch != out_ch else nn.Identity()

    def forward(self, x, t_emb):
        h = self.norm1(F.silu(self.conv1(x)))
        # Inject timestep information
        h = h + self.time_proj(t_emb)[:, :, None, None]
        h = self.norm2(F.silu(self.conv2(h)))
        return h + self.residual(x)

class SelfAttention(nn.Module):
    """Self-Attention block (captures long-range spatial dependencies)"""
    def __init__(self, channels, num_heads=4):
        super().__init__()
        self.norm = nn.GroupNorm(8, channels)
        self.attention = nn.MultiheadAttention(channels, num_heads, batch_first=True)

    def forward(self, x):
        B, C, H, W = x.shape
        h = self.norm(x)
        h = h.view(B, C, H * W).permute(0, 2, 1)  # (B, HW, C)
        h, _ = self.attention(h, h, h)
        h = h.permute(0, 2, 1).view(B, C, H, W)
        return x + h

class SimpleUNet(nn.Module):
    """Simplified UNet: predicts noise epsilon_theta(x_t, t)

    Architecture:
    - Encoder: Downsampling (convolution + stride)
    - Bottleneck: Self-Attention + ResBlock
    - Decoder: Upsampling (transposed convolution) + Skip Connection
    - Timestep conditioning: SinusoidalPositionEmbeddings -> MLP -> injected into each ResBlock
    """
    def __init__(self, in_ch=3, time_dim=256, base_ch=64):
        super().__init__()
        self.time_mlp = nn.Sequential(
            SinusoidalPositionEmbeddings(time_dim),
            nn.Linear(time_dim, time_dim),
            nn.GELU(),
        )

        # Encoder (downsampling)
        self.down1 = ResBlock(in_ch, base_ch, time_dim)
        self.down2 = ResBlock(base_ch, base_ch * 2, time_dim)
        self.pool1 = nn.Conv2d(base_ch, base_ch, 3, stride=2, padding=1)
        self.pool2 = nn.Conv2d(base_ch * 2, base_ch * 2, 3, stride=2, padding=1)
        self.down3 = ResBlock(base_ch * 2, base_ch * 4, time_dim)

        # Bottleneck
        self.bot = nn.Sequential(
            ResBlock(base_ch * 4, base_ch * 4, time_dim),
            SelfAttention(base_ch * 4),
        )

        # Decoder (upsampling)
        self.up1 = nn.ConvTranspose2d(base_ch * 4, base_ch * 2, 4, stride=2, padding=1)
        self.up_res1 = ResBlock(base_ch * 4, base_ch * 2, time_dim)  # Doubled due to skip connection
        self.up2 = nn.ConvTranspose2d(base_ch * 2, base_ch, 4, stride=2, padding=1)
        self.up_res2 = ResBlock(base_ch * 2, base_ch, time_dim)      # Doubled due to skip connection
        self.out = nn.Conv2d(base_ch, in_ch, 1)

    def forward(self, x, t):
        t_emb = self.time_mlp(t)

        # Encoder
        h1 = self.down1(x, t_emb)              # [B, 64, H, W]
        h1_pool = self.pool1(h1)                # [B, 64, H/2, W/2]
        h2 = self.down2(h1_pool, t_emb)         # [B, 128, H/2, W/2]
        h2_pool = self.pool2(h2)                # [B, 128, H/4, W/4]
        h3 = self.down3(h2_pool, t_emb)         # [B, 256, H/4, W/4]

        # Bottleneck (with Self-Attention)
        h = self.bot0
        h = self.bot1

        # Decoder + skip connections
        h = self.up1(h)                         # [B, 128, H/2, W/2]
        h = torch.cat([h, h2], dim=1)           # [B, 256, H/2, W/2]
        h = self.up_res1(h, t_emb)              # [B, 128, H/2, W/2]
        h = self.up2(h)                         # [B, 64, H, W]
        h = torch.cat([h, h1], dim=1)           # [B, 128, H, W]
        h = self.up_res2(h, t_emb)              # [B, 64, H, W]
        return self.out(h)                      # [B, 3, H, W] <- epsilon prediction
```

### Code Example 3: DDPM Training Loop

```python
def train_ddpm(model, dataloader, diffusion, optimizer, epochs=100, device="cuda"):
    """
    DDPM training: Simple noise prediction loss function
    L = E_{t, x_0, epsilon} [ ||epsilon - epsilon_theta(x_t, t)||^2 ]

    Key points:
    - t is uniformly sampled from [0, T)
    - epsilon is sampled from a standard normal distribution
    - x_t is computed via q_sample (closed-form solution of the forward process)
    """
    model.train()
    for epoch in range(epochs):
        total_loss = 0
        for batch in dataloader:
            x_0 = batch.to(device)
            batch_size = x_0.shape[0]

            # Sample random timestep t
            t = torch.randint(0, diffusion.T, (batch_size,), device=device)

            # Generate noise
            noise = torch.randn_like(x_0)

            # Compute noised image x_t
            x_t = diffusion.q_sample(x_0, t, noise)

            # Predict noise
            noise_pred = model(x_t, t)

            # Compute loss (simple MSE)
            loss = F.mse_loss(noise_pred, noise)

            optimizer.zero_grad()
            loss.backward()
            # Gradient clipping (training stabilization)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(dataloader)
        print(f"Epoch {epoch}: Loss = {avg_loss:.4f}")
```

### Code Example 3b: SNR-Weighted Loss Function (Min-SNR)

```python
def min_snr_loss(noise_pred, noise, t, snr, gamma=5.0):
    """
    Min-SNR-gamma loss weighting

    Hang et al. (2023) "Efficient Diffusion Training via Min-SNR Weighting Strategy"

    Problem: Standard DDPM loss assigns uniform weight to all t,
    but steps with low SNR (t ~ T) have large loss and can destabilize training.

    Solution: Weight by clipped SNR
    weight = min(SNR(t), gamma) / SNR(t)
    """
    mse_loss = F.mse_loss(noise_pred, noise, reduction='none')
    mse_loss = mse_loss.mean(dim=[1, 2, 3])  # MSE for each sample in the batch

    # SNR-based weight
    snr_t = snr[t]
    weight = torch.clamp(snr_t, max=gamma) / snr_t

    weighted_loss = (weight * mse_loss).mean()
    return weighted_loss


def velocity_prediction_loss(model, x_0, t, noise, diffusion):
    """
    v-prediction loss (used in SD 2.x)

    v = sqrt(alpha_bar_t) * epsilon - sqrt(1-alpha_bar_t) * x_0

    Differences from epsilon-prediction:
    - High SNR region (t ~ 0): epsilon-prediction tends to be unstable -> v-prediction is stable
    - Low SNR region (t ~ T): Both are stable
    - Overall, training is more stable and quality improves
    """
    x_t = diffusion.q_sample(x_0, t, noise)

    # Compute v
    sqrt_alpha = diffusion.sqrt_alphas_cumprod[t].view(-1, 1, 1, 1)
    sqrt_one_minus_alpha = diffusion.sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1, 1)
    v_target = sqrt_alpha * noise - sqrt_one_minus_alpha * x_0

    # Predict v with the model
    v_pred = model(x_t, t)

    return F.mse_loss(v_pred, v_target)
```

### ASCII Diagram 2: DDPM Training Pipeline

```
Training:
+----------------------------------------------------+
|                                                    |
|   x_0 (original    t (random        epsilon        |
|    image)          timestep)     (random noise)    |
|      |              |                |             |
|      v              v                |             |
|   +------------------+               |             |
|   | q(x_t | x_0)    |               |             |
|   | x_t = sqrt(alpha_bar_t) * x_0   |             |
|   |    + sqrt(1 - alpha_bar_t) * eps |             |
|   +-------+----------+               |             |
|           |                          |             |
|           v                          |             |
|   +--------------+                   |             |
|   |  UNet eps_th |---- eps_th(x_t,t) |             |
|   |  (x_t, t)   |        |          |             |
|   +--------------+        |          |             |
|                           v          v             |
|                     +--------------------+         |
|                     |  L = ||eps - eps_th||^2      |
|                     |  (MSE loss)        |         |
|                     +--------------------+         |
+----------------------------------------------------+

Inference (sampling):
  x_T ~ N(0,I) -> UNet -> x_{T-1} -> UNet -> ... -> x_1 -> UNet -> x_0
```

### Code Example 3c: DDPM Sampling (Reverse Diffusion Process)

```python
class DDPMSampler:
    """DDPM sampling: Complete implementation of the reverse diffusion process"""

    def __init__(self, model, diffusion, device="cuda"):
        self.model = model
        self.diffusion = diffusion
        self.device = device

    @torch.no_grad()
    def p_sample(self, x_t, t):
        """
        Single step of reverse diffusion: p_theta(x_{t-1} | x_t)

        Algorithm:
        1. Predict epsilon with UNet
        2. Estimate x_0
        3. Compute the mean of the posterior distribution q(x_{t-1} | x_t, x_0)
        4. Add noise to generate x_{t-1} (when t > 0)
        """
        betas = self.diffusion.betas
        alphas = self.diffusion.alphas
        alphas_cumprod = self.diffusion.alphas_cumprod

        t_batch = torch.full((x_t.shape[0],), t, device=self.device, dtype=torch.long)

        # Predict epsilon
        eps_pred = self.model(x_t, t_batch)

        # Estimate x_0
        alpha_t = alphas_cumprod[t]
        x_0_pred = (x_t - torch.sqrt(1 - alpha_t) * eps_pred) / torch.sqrt(alpha_t)
        x_0_pred = torch.clamp(x_0_pred, -1, 1)

        # Posterior mean and variance
        mu, var, log_var = self.diffusion.q_posterior_mean_variance(x_0_pred, x_t, t)

        # Add noise (no noise when t=0)
        noise = torch.randn_like(x_t) if t > 0 else torch.zeros_like(x_t)
        x_prev = mu + torch.exp(0.5 * log_var) * noise

        return x_prev

    @torch.no_grad()
    def sample(self, shape, return_intermediates=False):
        """
        Complete sampling loop

        Starting from x_T ~ N(0, I), generate x_0 over T steps
        """
        self.model.eval()

        # Start from pure noise
        x = torch.randn(shape, device=self.device)
        intermediates = [x.cpu()] if return_intermediates else None

        for t in reversed(range(self.diffusion.T)):
            x = self.p_sample(x, t)
            if return_intermediates and t % (self.diffusion.T // 10) == 0:
                intermediates.append(x.cpu())

        if return_intermediates:
            return x, intermediates
        return x
```

---

## 3. Relationship with Score Matching

### Code Example 4: Equivalence of Score Functions and Noise Prediction

```python
"""
Score matching perspective:
  Score function s_theta(x, t) = nabla_x log p_t(x)

Relationship with DDPM noise prediction:
  s_theta(x_t, t) = -eps_theta(x_t, t) / sqrt(1 - alpha_bar_t)

In other words, noise prediction eps_theta is a
scaled version of the score function.

Historical background:
- Song & Ermon (2019): Generative models via score matching (NCSN)
- Ho et al. (2020): DDPM (noise prediction-based)
- Song et al. (2021): Unified both under the SDE framework
  -> Score-based generative models through SDEs
"""

def score_from_noise_pred(noise_pred, t, alphas_cumprod):
    """Compute the score function from noise prediction"""
    sqrt_one_minus_alpha = torch.sqrt(1.0 - alphas_cumprod[t])
    score = -noise_pred / sqrt_one_minus_alpha.view(-1, 1, 1, 1)
    return score

def noise_from_score(score, t, alphas_cumprod):
    """Compute noise prediction from the score function (inverse transform)"""
    sqrt_one_minus_alpha = torch.sqrt(1.0 - alphas_cumprod[t])
    noise = -score * sqrt_one_minus_alpha.view(-1, 1, 1, 1)
    return noise

# Denoising Score Matching (DSM) loss function
def dsm_loss(score_model, x_0, t, noise, alphas_cumprod):
    """
    DSM loss: E[ ||s_theta(x_t, t) - nabla_{x_t} log q(x_t|x_0)||^2 ]
    This is essentially equivalent to the DDPM noise prediction loss
    """
    sqrt_alpha = torch.sqrt(alphas_cumprod[t]).view(-1, 1, 1, 1)
    sqrt_one_minus_alpha = torch.sqrt(1 - alphas_cumprod[t]).view(-1, 1, 1, 1)

    x_t = sqrt_alpha * x_0 + sqrt_one_minus_alpha * noise
    score_pred = score_model(x_t, t)

    # True score
    true_score = -noise / sqrt_one_minus_alpha

    return F.mse_loss(score_pred, true_score)
```

### ASCII Diagram 2b: Unified Understanding via the SDE Framework

```
+------------------- SDE Framework -------------------+
|                                                      |
|  Forward SDE:  dx = f(x,t)dt + g(t)dw               |
|  Reverse SDE:  dx = [f(x,t) - g^2(t) nabla_x log p_t(x)]dt + g(t)dw_bar  |
|                                                      |
|  Probability Flow ODE (deterministic):               |
|    dx = [f(x,t) - 1/2 g^2(t) nabla_x log p_t(x)]dt |
|                                                      |
|  +----------+         +----------+        +--------+ |
|  |  DDPM    |  =      |  NCSN    |  subset|  SDE   | |
|  |(eps-pred)|  equiv   |(score)   | of     |(unified)| |
|  +----------+         +----------+        +--------+ |
|       |                     |                   |    |
|       v                     v                   v    |
|  eps_theta(x_t, t)  s_theta(x_t, t)     f, g, nabla log p  |
|                                                      |
|  Relationship: s_theta = -eps_theta / sqrt(1-alpha_bar_t)  |
|                                                      |
|  ODE solvers:                                        |
|    DDIM <- 1st-order Euler method                    |
|    DPM-Solver <- Higher-order solvers (2nd, 3rd)     |
|    Rectified Flow <- Straight-line ODE               |
+------------------------------------------------------+
```

---

## 4. Fast Sampling Methods

### Code Example 5: DDIM Sampling

```python
class DDIMSampler:
    """
    DDIM: Denoising Diffusion Implicit Models

    Proposed by Song et al. (2021).

    Features:
    - Deterministic sampling (eta=0)
    - Sampling with any number of steps
    - Consistent results from the same initial noise
    - Image interpolation (latent space interpolation) is possible
    """
    def __init__(self, model, alphas_cumprod, timesteps=1000):
        self.model = model
        self.alphas_cumprod = alphas_cumprod
        self.timesteps = timesteps

    @torch.no_grad()
    def sample(self, shape, num_steps=50, eta=0.0, device="cuda"):
        """
        eta=0: Fully deterministic (DDIM)
        eta=1: Equivalent to DDPM
        0 < eta < 1: Intermediate stochasticity
        """
        # Subset of timesteps used for sampling
        step_size = self.timesteps // num_steps
        time_steps = list(range(0, self.timesteps, step_size))[::-1]

        x = torch.randn(shape, device=device)

        for i, t in enumerate(time_steps):
            t_batch = torch.full((shape[0],), t, device=device, dtype=torch.long)

            # Noise prediction
            eps_pred = self.model(x, t_batch)

            # Predict x_0
            alpha_t = self.alphas_cumprod[t]
            x_0_pred = (x - torch.sqrt(1 - alpha_t) * eps_pred) / torch.sqrt(alpha_t)
            x_0_pred = torch.clamp(x_0_pred, -1, 1)  # Clipping

            if i < len(time_steps) - 1:
                t_prev = time_steps[i + 1]
                alpha_prev = self.alphas_cumprod[t_prev]

                # Compute variance
                sigma = eta * torch.sqrt(
                    (1 - alpha_prev) / (1 - alpha_t) * (1 - alpha_t / alpha_prev)
                )

                # Direction of predicted noise
                dir_xt = torch.sqrt(1 - alpha_prev - sigma**2) * eps_pred

                # Compute x_{t-1}
                noise = torch.randn_like(x) if eta > 0 else 0
                x = torch.sqrt(alpha_prev) * x_0_pred + dir_xt + sigma * noise
            else:
                x = x_0_pred

        return x

    @torch.no_grad()
    def interpolate(self, x1, x2, num_steps=50, alpha_values=None, device="cuda"):
        """
        Image interpolation using DDIM

        1. Encode x1, x2 to latent space (DDIM inversion)
        2. Spherical linear interpolation (slerp) in latent space
        3. Reverse diffusion to recover images
        """
        if alpha_values is None:
            alpha_values = torch.linspace(0, 1, 7)

        interpolated = []
        for alpha in alpha_values:
            # Spherical linear interpolation (slerp)
            theta = torch.acos(torch.clamp(
                torch.sum(x1 * x2) / (x1.norm() * x2.norm()), -1, 1
            ))
            if theta < 1e-5:
                z = (1 - alpha) * x1 + alpha * x2
            else:
                z = (torch.sin((1 - alpha) * theta) / torch.sin(theta)) * x1 + \
                    (torch.sin(alpha * theta) / torch.sin(theta)) * x2

            # Decode via reverse diffusion
            img = self.sample_from_latent(z, num_steps, device)
            interpolated.append(img)

        return interpolated
```

### Code Example 6: DPM-Solver Concept and Implementation

```python
"""
DPM-Solver: Fast sampling via differential equation solvers

The reverse process of diffusion models can be formulated as a
stochastic differential equation (SDE) or ordinary differential equation (ODE):

ODE form (Probability Flow ODE):
  dx = [f(x,t) - (1/2)g^2(t) nabla_x log p_t(x)] dt

DPM-Solver efficiently solves this ODE using higher-order methods:
- 1st order: Equivalent to DDIM (Euler method)
- 2nd order: High quality in ~20 steps (Heun method equivalent)
- 3rd order: High quality in ~10 steps

Core techniques:
- Variable transformation in log-SNR space (lambda = log(alpha/sigma))
- Improved prediction accuracy via Taylor expansion
- Adaptive step size selection
"""

class DPMSolverConcept:
    """Conceptual implementation of DPM-Solver (for educational purposes)"""

    def __init__(self, model, alphas_cumprod):
        self.model = model
        self.alphas_cumprod = alphas_cumprod

    def get_lambda(self, t):
        """log-SNR: lambda(t) = log(alpha_t / sigma_t)"""
        alpha_t = torch.sqrt(self.alphas_cumprod[t])
        sigma_t = torch.sqrt(1 - self.alphas_cumprod[t])
        return torch.log(alpha_t / sigma_t)

    def first_order_update(self, x, t, t_prev):
        """
        1st-order update (equivalent to DDIM)
        x_{t-1} = alpha_{t-1}/alpha_t * x_t
                  + sigma_{t-1} * (exp(-h) - 1) * epsilon_theta
        where h = lambda_{t-1} - lambda_t
        """
        alpha_t = torch.sqrt(self.alphas_cumprod[t])
        alpha_prev = torch.sqrt(self.alphas_cumprod[t_prev])
        sigma_t = torch.sqrt(1 - self.alphas_cumprod[t])
        sigma_prev = torch.sqrt(1 - self.alphas_cumprod[t_prev])

        eps = self.model(x, t)

        x_prev = (alpha_prev / alpha_t) * x + \
                 sigma_prev * (torch.exp(self.get_lambda(t_prev) - self.get_lambda(t)) - 1) * eps

        return x_prev

    def second_order_update(self, x, t, t_mid, t_prev):
        """
        2nd-order update (improved accuracy)
        Additional evaluation at the midpoint corrects the 2nd-order term of the Taylor expansion
        """
        # Find the midpoint using 1st-order prediction
        x_mid = self.first_order_update(x, t, t_mid)
        eps_mid = self.model(x_mid, t_mid)

        # 1st-order prediction
        eps_t = self.model(x, t)

        # 2nd-order correction
        alpha_prev = torch.sqrt(self.alphas_cumprod[t_prev])
        alpha_t = torch.sqrt(self.alphas_cumprod[t])
        sigma_prev = torch.sqrt(1 - self.alphas_cumprod[t_prev])

        h = self.get_lambda(t_prev) - self.get_lambda(t)
        r = self.get_lambda(t_mid) - self.get_lambda(t)

        # 2nd-order DPM update formula
        D0 = eps_t
        D1 = (eps_mid - eps_t) / r

        x_prev = (alpha_prev / alpha_t) * x + \
                 sigma_prev * (torch.exp(-h) - 1) * D0 + \
                 sigma_prev * ((torch.exp(-h) - 1) / h + 1) * D1

        return x_prev


# Usage example with diffusers
from diffusers import DPMSolverMultistepScheduler, StableDiffusionPipeline

pipe = StableDiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-2-1")
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config,
    algorithm_type="dpmsolver++",
    solver_order=2,
    use_karras_sigmas=True,
)

# High-quality generation in just 20 steps
image = pipe(
    prompt="a beautiful Japanese garden",
    num_inference_steps=20,  # Significantly reduced from the usual 50 steps
).images[0]
```

### Code Example 6b: Consistency Model Concept

```python
"""
Consistency Models (Song et al., 2023)

Core idea:
- Learn a function that maps any point on the ODE trajectory directly to x_0
- f_theta(x_t, t) = x_0  (for any t)
- Can generate high-quality images in a single step

Self-consistency condition:
- f_theta(x_t, t) = f_theta(x_{t'}, t')  (for x_t, x_{t'} on the same ODE trajectory)
- In other words, from any point on the ODE trajectory, you reach the same x_0

Training methods:
1. Consistency Distillation: Distillation from a pre-trained diffusion model
2. Consistency Training: Direct training from scratch
"""

class ConsistencyModelConcept:
    """Conceptual implementation of Consistency Models"""

    def __init__(self, backbone, sigma_min=0.002, sigma_max=80.0):
        self.backbone = backbone
        self.sigma_min = sigma_min
        self.sigma_max = sigma_max

    def consistency_function(self, x, t):
        """
        Consistency function: f_theta(x, t) -> x_0

        Boundary condition: f_theta(x, sigma_min) = x
        (When noise is minimal, return the input as-is)

        Implementation: Use skip connection to satisfy the boundary condition
        f_theta(x, t) = c_skip(t) * x + c_out(t) * F_theta(x, t)
        """
        c_skip = self.sigma_min ** 2 / (t ** 2 + self.sigma_min ** 2)
        c_out = self.sigma_min * t / torch.sqrt(t ** 2 + self.sigma_min ** 2)

        F_out = self.backbone(x, t)
        return c_skip * x + c_out * F_out

    def sample(self, shape, device="cuda"):
        """Single-step sampling"""
        # Start from noise at the maximum noise level
        x = torch.randn(shape, device=device) * self.sigma_max
        t = torch.full((shape[0],), self.sigma_max, device=device)

        # Reach x_0 in a single step
        x_0 = self.consistency_function(x, t)
        return x_0

    def multistep_sample(self, shape, num_steps=4, device="cuda"):
        """Multi-step sampling (improved quality)"""
        sigmas = torch.linspace(
            self.sigma_max, self.sigma_min, num_steps + 1, device=device
        )

        x = torch.randn(shape, device=device) * self.sigma_max

        for i in range(num_steps):
            t = torch.full((shape[0],), sigmas[i], device=device)
            x_0 = self.consistency_function(x, t)

            if i < num_steps - 1:
                # Re-add noise and proceed to the next step
                noise = torch.randn_like(x)
                x = x_0 + sigmas[i + 1] * noise
            else:
                x = x_0

        return x
```

### ASCII Diagram 3: Comparison of Sampling Methods

```
                    Quality
                     ^
                     |
            *DDPM    |    *DDIM
            (1000)   |    (50)
                     |         *DPM-Solver
                     |          (20)
                     |               *Consistency
                     |                (1-4)
                     |
                     |    *LCM
                     |    (4-8)
                     |
           ----------+------------------------------> Speed
                     |           (fewer steps)

Steps and quality by method:
+------------------+-----------+---------+-----------+
| Method           | Steps     | Quality | Determin. |
+------------------+-----------+---------+-----------+
| DDPM             | 1000      | *****   | No        |
| DDIM             | 50-100    | ****    | Yes       |
| DPM-Solver       | 15-25     | *****   | Yes       |
| LCM              | 4-8       | ****    | Yes       |
| Consistency      | 1-2       | ***     | Yes       |
| Turbo/Lightning  | 1-4       | ****    | Yes       |
+------------------+-----------+---------+-----------+
```

---

## 5. Classifier-Free Guidance (CFG)

### Code Example 7: CFG Implementation

```python
class ClassifierFreeGuidance:
    """
    Classifier-Free Guidance (Ho & Salimans, 2022)

    Core idea:
    - Training: Randomly drop condition c with probability p_uncond (replace with empty condition)
    - Inference: Linear interpolation between conditional and unconditional predictions

    Formula:
    eps_guided = eps_uncond + w * (eps_cond - eps_uncond)
              = (1 - w) * eps_uncond + w * eps_cond

    w > 1 emphasizes conditional generation (increases fidelity to text)

    Trade-off:
    - Large w: Faithful to text but lower diversity, quality may degrade
    - Small w: Higher diversity but lower text alignment
    """

    def __init__(self, model, guidance_scale=7.5):
        self.model = model
        self.w = guidance_scale

    def predict_noise(self, x_t, t, cond, uncond):
        """
        Noise prediction with CFG

        1. Conditional prediction: eps_cond = model(x_t, t, cond)
        2. Unconditional prediction: eps_uncond = model(x_t, t, uncond)
        3. Guidance: eps = eps_uncond + w * (eps_cond - eps_uncond)
        """
        # Batch computation for efficiency
        x_combined = torch.cat([x_t, x_t], dim=0)
        t_combined = torch.cat([t, t], dim=0)
        cond_combined = torch.cat([uncond, cond], dim=0)

        noise_pred = self.model(x_combined, t_combined, cond_combined)
        eps_uncond, eps_cond = noise_pred.chunk(2)

        # Apply guidance
        guided = eps_uncond + self.w * (eps_cond - eps_uncond)
        return guided

    def dynamic_cfg(self, x_t, t, cond, uncond, t_max):
        """
        Dynamic CFG: Vary guidance strength based on timestep

        Early steps (high noise): High CFG to determine overall structure
        Later steps (low noise): Low CFG for natural details
        """
        progress = t.float() / t_max
        dynamic_w = self.w * (0.5 + 0.5 * progress)  # Decay in the latter half

        x_combined = torch.cat([x_t, x_t], dim=0)
        t_combined = torch.cat([t, t], dim=0)
        cond_combined = torch.cat([uncond, cond], dim=0)

        noise_pred = self.model(x_combined, t_combined, cond_combined)
        eps_uncond, eps_cond = noise_pred.chunk(2)

        guided = eps_uncond + dynamic_w * (eps_cond - eps_uncond)
        return guided


# Recommended CFG values (by model)
CFG_RECOMMENDATIONS = {
    "SD 1.5":   {"range": (7, 12),  "default": 7.5,  "note": "Higher CFG needed"},
    "SDXL":     {"range": (5, 8),   "default": 7.0,  "note": "Lower than SD1.5 is optimal"},
    "SD3":      {"range": (4, 7),   "default": 5.0,  "note": "MMDiT is highly sensitive to CFG"},
    "Flux":     {"range": (2, 5),   "default": 3.5,  "note": "Rectified Flow works best with low CFG"},
    "DALL-E 3": {"range": "N/A",    "default": "auto", "note": "Internally optimized"},
}
```

### ASCII Diagram 4: Effect of CFG

```
CFG Scale (w)
    1.0          3.5          7.5          15.0         30.0
     |            |            |             |            |
     v            v            v             v            v
  [Diverse but  [Good       [Faithful    [Excessive   [Artifacts
   unrelated     balance]     to text]     saturation   appear]
   to text]                               & contrast]

  <-- Higher diversity --------------------- Higher text fidelity -->
  <-- Stable quality ----------------------- Quality tends to degrade -->
```

---

## 6. Latent Diffusion Model (LDM)

### Code Example 8: LDM Architecture

```python
"""
Latent Diffusion Model (Rombach et al., 2022)
= Foundation architecture of Stable Diffusion

Core idea:
- Perform diffusion in latent space rather than pixel space
- Drastically reduce computational cost (512x512 -> 64x64 latent representation)
- Use VAE (Variational Autoencoder) to convert between images and latent representations

Components:
1. VAE Encoder: Image -> Latent representation (3x512x512 -> 4x64x64)
2. U-Net: Noise prediction in latent space (+ text conditioning)
3. VAE Decoder: Latent representation -> Image (4x64x64 -> 3x512x512)
4. Text Encoder: Text -> Embedding vectors (CLIP)
"""

class LatentDiffusionConcept:
    """Conceptual implementation of LDM"""

    def __init__(self, vae, unet, text_encoder, scheduler):
        self.vae = vae
        self.unet = unet
        self.text_encoder = text_encoder
        self.scheduler = scheduler
        self.vae_scale_factor = 0.18215  # VAE scaling for SD 1.x/2.x

    def encode_image(self, image):
        """Encode an image to latent space with VAE"""
        latent = self.vae.encode(image).latent_dist.sample()
        latent = latent * self.vae_scale_factor
        return latent

    def decode_latent(self, latent):
        """Decode a latent representation with VAE"""
        latent = latent / self.vae_scale_factor
        image = self.vae.decode(latent).sample
        return image

    def encode_text(self, text):
        """Encode text with CLIP"""
        tokens = self.text_encoder.tokenizer(
            text, padding="max_length", max_length=77,
            truncation=True, return_tensors="pt"
        )
        text_embeddings = self.text_encoder(tokens.input_ids)
        return text_embeddings

    @torch.no_grad()
    def generate(self, prompt, negative_prompt="", num_steps=50,
                 guidance_scale=7.5, height=512, width=512):
        """Complete generation pipeline of LDM"""
        device = next(self.unet.parameters()).device

        # 1. Text encoding
        text_emb = self.encode_text(prompt)
        uncond_emb = self.encode_text(negative_prompt)
        text_emb_combined = torch.cat([uncond_emb, text_emb])

        # 2. Initialize noise in latent space
        latent_h = height // 8  # VAE downsampling ratio
        latent_w = width // 8
        latents = torch.randn(1, 4, latent_h, latent_w, device=device)

        # 3. Initialize the scheduler
        self.scheduler.set_timesteps(num_steps)
        latents = latents * self.scheduler.init_noise_sigma

        # 4. Reverse diffusion loop (executed in latent space)
        for t in self.scheduler.timesteps:
            # CFG: Predict conditional/unconditional in a batch
            latent_input = torch.cat([latents] * 2)
            latent_input = self.scheduler.scale_model_input(latent_input, t)

            noise_pred = self.unet(latent_input, t, text_emb_combined)

            # Apply CFG
            noise_uncond, noise_cond = noise_pred.chunk(2)
            noise_guided = noise_uncond + guidance_scale * (noise_cond - noise_uncond)

            # Scheduler step
            latents = self.scheduler.step(noise_guided, t, latents).prev_sample

        # 5. VAE decode (latent representation -> image)
        image = self.decode_latent(latents)
        return image
```

### ASCII Diagram 5: LDM Pipeline

```
+------------------- Latent Diffusion Model -------------------+
|                                                               |
|  "A cat sitting on a sofa"                                    |
|         |                                                     |
|         v                                                     |
|  +--------------+                                             |
|  | CLIP Text    | Text -> 77x768 embeddings                   |
|  | Encoder      |                                             |
|  +------+-------+                                             |
|         |                                                     |
|         v                                                     |
|  +----------------------------------------------+             |
|  |              U-Net (latent space)             |             |
|  |                                               |             |
|  |  Input: 4x64x64 (noised latent representation)|            |
|  |                                               |             |
|  |  +--------------+  +----------------+         |  <- z_T (noise)
|  |  | Self-        |  | Cross-         |         |             |
|  |  | Attention    |  | Attention      |         |             |
|  |  | (spatial)    |  | (text cond.)   |         |             |
|  |  +--------------+  +----------------+         |             |
|  |                                               |             |
|  |  Output: 4x64x64 (eps prediction)            |             |
|  +--------------+--------------------------------+             |
|                 |                                              |
|                 | x N steps (reverse diffusion)                |
|                 |                                              |
|                 v                                              |
|  +--------------+                                             |
|  | VAE Decoder  |  4x64x64 -> 3x512x512                       |
|  +------+-------+                                             |
|         |                                                     |
|         v                                                     |
|     Generated image (3x512x512)                               |
|                                                               |
|  Computation comparison:                                      |
|    Pixel-space diffusion: 3x512x512 = 786,432 dimensions     |
|    Latent-space diffusion: 4x64x64  =  16,384 dimensions     |
|    -> ~48x compression -> Significantly faster inference/training |
+---------------------------------------------------------------+
```

---

## 7. Rectified Flow and Flow Matching

### Code Example 9: Rectified Flow Concept

```python
"""
Rectified Flow (Liu et al., 2023)
= Core technology behind SD3 and Flux

Core idea:
- Connect noise x_0 ~ N(0, I) and data x_1 ~ p_data with a straight line
- Intermediate point: x_t = (1 - t) * x_0 + t * x_1  (t in [0, 1])
- Learn the velocity field v(x_t, t) = x_1 - x_0

Differences from traditional diffusion models:
- DDPM: Curved paths from noise to image (requires many steps)
- Rectified Flow: Straight-line paths (high quality in fewer steps)

Loss function:
- L = E_{t, x_0, x_1} [ ||v_theta(x_t, t) - (x_1 - x_0)||^2 ]
"""

class RectifiedFlowConcept:
    """Conceptual implementation of Rectified Flow"""

    def __init__(self, model):
        self.model = model

    def get_xt(self, x_0, x_1, t):
        """Compute intermediate point via linear interpolation

        x_t = (1 - t) * x_0 + t * x_1

        x_0: Noise (source distribution)
        x_1: Data (target distribution)
        t: Timestep [0, 1]
        """
        t = t.view(-1, 1, 1, 1)
        return (1 - t) * x_0 + t * x_1

    def training_step(self, x_1, optimizer):
        """Single training step

        Objective: Train v_theta(x_t, t) to predict (x_1 - x_0)
        """
        batch_size = x_1.shape[0]
        device = x_1.device

        # Sample noise
        x_0 = torch.randn_like(x_1)

        # Sample timestep
        t = torch.rand(batch_size, device=device)

        # Compute intermediate point
        x_t = self.get_xt(x_0, x_1, t)

        # Predict velocity field
        v_pred = self.model(x_t, t)

        # True velocity (direction of the straight line)
        v_target = x_1 - x_0

        # Loss
        loss = F.mse_loss(v_pred, v_target)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        return loss.item()

    @torch.no_grad()
    def sample(self, shape, num_steps=28, device="cuda"):
        """Sampling via Euler method

        ODE: dx/dt = v_theta(x, t)
        x(0) = noise -> x(1) = image
        """
        self.model.eval()

        # Start from noise at t=0
        x = torch.randn(shape, device=device)

        dt = 1.0 / num_steps
        for i in range(num_steps):
            t = torch.full((shape[0],), i * dt, device=device)
            v = self.model(x, t)
            x = x + v * dt

        return x


class FlowMatchingLoss:
    """
    Conditional Flow Matching (CFM) Loss

    Generalized by Lipman et al. (2023).
    Rectified Flow is a special case of CFM.

    General form: L = E_{t, x_0, x_1} [ ||v_theta(x_t, t) - u_t(x_t | x_0, x_1)||^2 ]

    For straight-line paths: u_t = x_1 - x_0 (Rectified Flow)
    """

    @staticmethod
    def compute(model, x_0, x_1, t):
        """Compute CFM loss"""
        t_expanded = t.view(-1, 1, 1, 1)

        # Intermediate point of the conditional flow
        x_t = (1 - t_expanded) * x_0 + t_expanded * x_1

        # Velocity of the conditional flow (straight-line path)
        u_t = x_1 - x_0

        # Model prediction
        v_pred = model(x_t, t)

        # CFM loss
        loss = F.mse_loss(v_pred, u_t)
        return loss
```

### ASCII Diagram 6: Rectified Flow vs DDPM

```
DDPM (curved path):                  Rectified Flow (straight-line path):

  Data x_1                             Data x_1
     *                                    *
    / \                                  /|
   /   \                                / |
  /     * x_{t3}                       /  |
 /       \                            /   |
*         * x_{t2}                   * x_t|  Straight line: x_t = (1-t)x_0 + t*x_1
 \         \                         |    |
  \         * x_{t1}                 |    |
   \       /                         |   /
    \     /                          |  /
     \   /                           | /
      * ------------------            */
  Noise x_0                       Noise x_0

  Requires T=1000 steps             28 steps are sufficient
  Follows curved paths              Follows straight lines, so efficient

Velocity field learning:
  DDPM:  eps_theta(x_t, t) = noise prediction (indirect)
  RF:    v_theta(x_t, t) = x_1 - x_0 (direct direction prediction)
```

---

## 8. Noise Schedule Design

### Comparison Table 1: Noise Schedule Comparison

| Schedule | Formula | Characteristics | Use Cases |
|----------|---------|----------------|-----------|
| **Linear** | beta_t = beta_min + (beta_max - beta_min) * t/T | Simple, first proposed | Original DDPM paper |
| **Cosine** | alpha_bar_t = cos^2((t/T + s)/(1+s) * pi/2) | Improved SNR near the end | Improved DDPM |
| **Scaled Linear** | beta_t scaled by resolution | Adapts to higher resolution | SD3, Flux |
| **Sigmoid** | beta_t = sigmoid(a + (b-a)*t/T) | Rapid change in the middle | Some research |
| **Squared Cosine** | Uses cos^2 for alpha_bar_t | Smoother transitions | Improved models |

### Comparison Table 2: Major Diffusion Models

| Model | Year | Parameterization | Schedule | Latent Space | Conditioning |
|-------|------|-----------------|----------|-------------|-------------|
| **DDPM** | 2020 | epsilon-prediction | Linear | None (pixel space) | None |
| **Improved DDPM** | 2021 | epsilon-prediction | Cosine | None | Class-conditional |
| **Guided Diffusion** | 2021 | epsilon-prediction | Linear | None | Classifier guidance |
| **LDM/SD** | 2022 | epsilon-prediction | Linear | VAE (4x64x64) | Cross-Attention |
| **SDXL** | 2023 | epsilon-prediction | Linear | VAE | Multiple text encoders |
| **SD3** | 2024 | v-prediction/RF | Modified cosine | VAE (16ch) | MM-DiT |
| **Flux** | 2024 | RF (Rectified Flow) | Linear | VAE (16ch) | MM-DiT |

### Comparison Table 3: Parameterization Methods

| Parameterization | Prediction Target | Formula | Advantages | Models Used |
|-----------------|-------------------|---------|-----------|------------|
| **epsilon-prediction** | Noise epsilon | L = \|\|epsilon - epsilon_theta\|\|^2 | Simplest, easy to understand | SD 1.x, SDXL |
| **x_0-prediction** | Clean image x_0 | L = \|\|x_0 - x_0_theta\|\|^2 | Intermediate results are easy to visualize | Some research |
| **v-prediction** | Velocity v | L = \|\|v - v_theta\|\|^2 | Stable at both high/low SNR | SD 2.x |
| **Rectified Flow** | Direction x_1 - x_0 | L = \|\|(x_1-x_0) - v_theta\|\|^2 | High quality in fewer steps | SD3, Flux |

---

## 9. Anti-Patterns

### Anti-Pattern 1: Blindly Increasing the Number of Steps

```
[Problem]
Setting sampling steps to 500 or 1000 with the assumption that "quality should improve."

[Why It's a Problem]
- Modern samplers (e.g., DPM-Solver) achieve sufficient quality in 20-30 steps
- Increasing step count directly increases computational cost (inference time scales linearly)
- Excessive steps do not contribute to quality improvement (they saturate)
- Wastes GPU memory and API costs

[Correct Approach]
- DPM-Solver++: 20-25 steps
- Euler Ancestral: 25-35 steps
- LCM/Turbo: 4-8 steps
- Choose step counts appropriate for the sampler
```

### Anti-Pattern 2: Implementation Ignoring the Math

```
[Problem]
Oversimplifying diffusion models as "just adding and removing noise"
and making custom implementations with incorrect handling of alpha and beta.

[Why It's a Problem]
- Incorrect computation of the cumulative product alpha_bar_t leads to catastrophic quality degradation
- Inappropriate noise schedule range (beta_min, beta_max) prevents training from converging
- Incorrect variance handling causes samples to diverge

[Correct Approach]
- Use verified libraries (diffusers)
- When implementing custom solutions, strictly follow the paper's formulas
- Verify correctness by visualizing intermediate steps
```

### Anti-Pattern 3: Using a Fixed CFG Scale

```
[Problem]
Using the same CFG scale for all models and all prompts.

[Why It's a Problem]
- Optimal CFG ranges differ significantly by model
  (SD1.5: 7-12, SDXL: 5-8, Flux: 2-5)
- Excessive CFG causes saturation anomalies and artifacts
- The optimal value also changes with prompt length and complexity

[Correct Approach]
- Check and use the recommended CFG range for the model
- Compare results with multiple CFG values for the same prompt
- Consider dynamic CFG (varying CFG based on timestep)
```

---

## 10. FAQ

### Q1: Why are diffusion models more stable to train than GANs?

**A:** Primarily for the following reasons:

- **Simplicity of the loss function:** The DDPM loss is a simple MSE. No need to balance two networks as in GANs
- **No mode collapse:** Models the entire probability distribution, maintaining diversity
- **Gradient stability:** The noise prediction task is a regression problem, making gradient vanishing/explosion less likely
- **However:** There is a trade-off of higher inference cost (multiple steps)

### Q2: What is the difference between v-prediction and epsilon-prediction?

**A:**

- **epsilon-prediction:** Directly predicts the added noise epsilon. The original DDPM approach
- **v-prediction:** Predicts v = sqrt(alpha_bar_t) * epsilon - sqrt(1-alpha_bar_t) * x_0. A mixture of noise and signal
- **Advantages of v-prediction:** Stable in both high SNR regions (t near 0) and low SNR regions (t near T). Numerically stable
- **Adoption:** SD 2.x uses v-prediction, SD3/Flux use Rectified Flow

### Q3: What is Rectified Flow?

**A:** Rectified Flow is a method that models the transformation from noise to image using **straight-line** paths:

- **Traditional diffusion:** Transforms noise to image along curved paths
- **Rectified Flow:** Connects x_0 and x_1 with a straight line. Predicts v = x_1 - x_0
- **Advantage:** Enables high-quality generation with fewer steps
- **Adoption:** Used in SD3 and Flux, currently becoming mainstream

### Q4: Why perform diffusion in latent space (LDM)?

**A:** It's a matter of computational efficiency:

- **Pixel space:** Diffusion in 512x512x3 = 786,432 dimensions -> Very slow
- **Latent space:** Diffusion in 64x64x4 = 16,384 dimensions -> ~48x compression
- VAE maintains image quality while drastically reducing the computation of the diffusion process
- Side benefit: Latent space has semantically coherent representations, improving generation quality

### Q5: What is the relationship between Consistency Models and distillation?

**A:**

- **Consistency Distillation:** Distills knowledge from a pre-trained diffusion model into a 1-4 step model
- **Consistency Training:** Direct training without distillation (no teacher needed)
- **LCM (Latent Consistency Models):** Consistency distillation for LDM. Commercial quality in 4-8 steps
- **SDXL Turbo / Lightning:** Distillation-based ultra-fast sampling (1-4 steps)

---

## Summary Table

| Topic | Key Points |
|-------|-----------|
| **Forward Process** | Gradually adds Gaussian noise to destroy data: q(x_t\|x_{t-1}) |
| **Reverse Process** | Neural network removes noise to recover images: p_theta(x_{t-1}\|x_t) |
| **Training Objective** | epsilon-prediction (MSE loss): L = E[\|\|epsilon - epsilon_theta(x_t, t)\|\|^2] |
| **Score Matching** | epsilon-prediction = approximation of score function (mathematically equivalent) |
| **CFG** | Linear interpolation of conditional/unconditional predictions for quality improvement: w*(cond-uncond)+uncond |
| **LDM** | Diffusion in latent space -> ~48x computation compression |
| **Noise Schedule** | Evolution from Linear -> Cosine -> Rectified Flow |
| **Fast Sampling** | DDIM -> DPM-Solver -> LCM/Turbo (1000 -> 4 steps) |
| **Rectified Flow** | Efficient generation via straight-line paths. Foundation of SD3/Flux |
| **Latest Trends** | Rectified Flow + DiT = Foundation technology of SD3/Flux |

---


## FAQ

### Q1: What is the most important point to learn about this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What common mistakes do beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

In this guide, we learned the following key points:

- Understanding of basic concepts and principles
- Practical implementation patterns
- Best practices and caveats
- Practical application methods

---

## Recommended Next Guides

- [02-prompt-engineering-visual.md](./02-prompt-engineering-visual.md) — Practical prompt design
- [../01-image/00-image-generation.md](../01-image/00-image-generation.md) — Practical usage of Stable Diffusion
- [../01-image/02-upscaling.md](../01-image/02-upscaling.md) — Combining with super-resolution techniques

---

## References

1. Ho, J., Jain, A., & Abbeel, P. (2020). "Denoising Diffusion Probabilistic Models." *NeurIPS 2020*. https://arxiv.org/abs/2006.11239
2. Song, J., Meng, C., & Ermon, S. (2021). "Denoising Diffusion Implicit Models (DDIM)." *ICLR 2021*. https://arxiv.org/abs/2010.02502
3. Lu, C. et al. (2022). "DPM-Solver: A Fast ODE Solver for Diffusion Probabilistic Model Sampling." *NeurIPS 2022*. https://arxiv.org/abs/2206.00927
4. Song, Y. & Ermon, S. (2019). "Generative Modeling by Estimating Gradients of the Data Distribution." *NeurIPS 2019*. https://arxiv.org/abs/1907.05600
5. Liu, X. et al. (2023). "Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow." *ICLR 2023*. https://arxiv.org/abs/2209.03003
6. Ho, J. & Salimans, T. (2022). "Classifier-Free Diffusion Guidance." *NeurIPS Workshop 2021*. https://arxiv.org/abs/2207.12598
7. Rombach, R. et al. (2022). "High-Resolution Image Synthesis with Latent Diffusion Models." *CVPR 2022*. https://arxiv.org/abs/2112.10752
8. Song, Y. et al. (2021). "Score-Based Generative Modeling through Stochastic Differential Equations." *ICLR 2021*. https://arxiv.org/abs/2011.13456
9. Nichol, A. & Dhariwal, P. (2021). "Improved Denoising Diffusion Probabilistic Models." *ICML 2021*. https://arxiv.org/abs/2102.09672
10. Song, Y. et al. (2023). "Consistency Models." *ICML 2023*. https://arxiv.org/abs/2303.01469
11. Hang, T. et al. (2023). "Efficient Diffusion Training via Min-SNR Weighting Strategy." *CVPR 2024*. https://arxiv.org/abs/2303.09556
12. Lipman, Y. et al. (2023). "Flow Matching for Generative Modeling." *ICLR 2023*. https://arxiv.org/abs/2210.02747
