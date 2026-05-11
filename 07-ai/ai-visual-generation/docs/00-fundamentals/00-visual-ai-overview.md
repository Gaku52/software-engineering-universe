# Visual AI Overview — History and Present of Image Generation

> A systematic explanation of the full landscape of AI-powered visual content generation technology, from historical context to the latest trends.

---

## What You Will Learn in This Chapter

1. **Historical Evolution of Image Generation AI** — Technological progress from pre-GAN era to the diffusion model era
2. **Classification of Major Architectures** — Differences between GANs, VAEs, diffusion models, and Transformer-based approaches
3. **Current Ecosystem and Application Domains** — Full map of commercial services, open source, and industrial applications
4. **Evaluation Metrics and Quality Measurement** — Objective metrics such as FID, CLIP Score, and IS
5. **Legal and Ethical Issues** — Copyright, deepfakes, and bias concerns
6. **Industry-Specific Use Cases** — Concrete case studies in advertising, gaming, fashion, architecture, and healthcare


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Historical Timeline of Visual AI

### Code Example 1: Timeline Data Structure for Image Generation Technology

```python
timeline = [
    {"year": 2014, "event": "GAN (Generative Adversarial Network) introduced",
     "paper": "Goodfellow et al.", "impact": "Revolutionary turning point for generative models"},
    {"year": 2015, "event": "DCGAN — Stabilization of convolutional GANs",
     "paper": "Radford et al.", "impact": "Foundation for high-resolution image generation"},
    {"year": 2016, "event": "Pix2Pix — Conditional image translation",
     "paper": "Isola et al.", "impact": "Established image translation using paired images"},
    {"year": 2017, "event": "Progressive GAN — Progressive growing",
     "paper": "Karras et al.", "impact": "1024x1024 face image generation"},
    {"year": 2017, "event": "CycleGAN — Unsupervised image translation",
     "paper": "Zhu et al.", "impact": "Domain translation without paired data"},
    {"year": 2018, "event": "BigGAN — Large-scale class-conditional generation",
     "paper": "Brock et al.", "impact": "High-quality generation of ImageNet classes"},
    {"year": 2019, "event": "StyleGAN — Style control",
     "paper": "Karras et al.", "impact": "Attribute disentanglement and high-quality generation"},
    {"year": 2020, "event": "DDPM — Practical diffusion models",
     "paper": "Ho et al.", "impact": "Achieved image quality surpassing GANs"},
    {"year": 2020, "event": "StyleGAN2 — Artifact removal",
     "paper": "Karras et al.", "impact": "Pushed the quality limits of GANs"},
    {"year": 2021, "event": "DALL-E / CLIP — Text to image",
     "paper": "OpenAI", "impact": "Image generation from natural language"},
    {"year": 2021, "event": "Guided Diffusion — Classifier guidance",
     "paper": "Dhariwal & Nichol", "impact": "Diffusion models surpassed GANs"},
    {"year": 2022, "event": "Stable Diffusion — Open-source diffusion model",
     "paper": "Stability AI", "impact": "Democratization and local execution"},
    {"year": 2022, "event": "DALL-E 2 — CLIP-based hierarchical generation",
     "paper": "OpenAI", "impact": "Dramatic improvement in text understanding"},
    {"year": 2023, "event": "SDXL, Midjourney v5, DALL-E 3",
     "paper": "Various companies", "impact": "Establishment of commercial quality"},
    {"year": 2023, "event": "ControlNet — Innovation in structural control",
     "paper": "Zhang et al.", "impact": "Precise control via pose, edge, and depth"},
    {"year": 2024, "event": "Sora, Flux, SD3",
     "paper": "OpenAI / BFL / Stability AI", "impact": "Video generation and architecture renewal"},
    {"year": 2024, "event": "Rectified Flow Transformers",
     "paper": "Esser et al.", "impact": "High-efficiency generation based on DiT"},
    {"year": 2025, "event": "Real-time generation and 3D integration",
     "paper": "Various companies", "impact": "The era of interactive generation"},
]

for entry in timeline:
    print(f"{entry['year']}: {entry['event']}")
    print(f"  Paper: {entry['paper']}")
    print(f"  Impact: {entry['impact']}")
    print()
```

### ASCII Diagram 1: Evolution Tree of Visual AI Technologies

```
2014        2017        2020        2022        2024
 |           |           |           |           |
 v           v           v           v           v
[GAN]--->[ProGAN]    [DDPM]--->[LDM]--->[SD3/Flux]
  |        |            |         |          |
  +-->[StyleGAN]    [DALL-E]  [SDXL]    [Sora]
  |     (2019)      (2021)    (2023)    (Video)
  |        |                    |
  |    [StyleGAN2]          [ControlNet]
  |     (2020)               (2023)
  |                    |
  +-->[Pix2Pix]   [CLIP]--->[DALL-E 2]--->[DALL-E 3]
  |   (2017)       (2021)     (2022)       (2023)
  |
  +-->[CycleGAN]--->[StarGAN]
      (2017)        (2018)

GAN Era (2014-2020)         Diffusion Model Era (2020-Present)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.1 Image Generation Before GANs (2012-2014)

The history of image generation AI dates back before GANs. Here we organize the important early efforts.

```python
pre_gan_history = {
    "Boltzmann Machine (2006-2012)": {
        "Overview": "Probabilistic generative model, stacking Restricted Boltzmann Machines (RBMs)",
        "Limitations": "Training was extremely slow, and high-resolution image generation was impractical",
        "Contributions": "Used as a pre-training method for deep learning"
    },
    "Deep Belief Networks (2009-2013)": {
        "Overview": "Deep generative model with stacked RBMs",
        "Limitations": "Limited image diversity and quality",
        "Contributions": "Established the concept of hierarchical feature learning"
    },
    "Autoencoder / Denoising AE (2010-2014)": {
        "Overview": "Self-supervised learning that encodes and reconstructs inputs",
        "Limitations": "Limited ability to generate novel images",
        "Contributions": "Built the foundation for latent representation learning"
    },
    "VAE (2013)": {
        "Overview": "Probabilistic generative model combining variational inference",
        "Limitations": "Tendency to produce blurry generated images",
        "Contributions": "Established concepts of latent space continuity and interpolation"
    }
}

for model, details in pre_gan_history.items():
    print(f"--- {model} ---")
    for key, value in details.items():
        print(f"  {key}: {value}")
    print()
```

### 1.2 Details of the GAN Era (2014-2020)

```python
gan_evolution = {
    "GAN (2014)": {
        "Architecture": "Minimax game between Generator + Discriminator",
        "Input": "Random noise z ~ N(0, I)",
        "Output": "Low-resolution images (32x32, 64x64)",
        "Challenges": "Mode collapse, training instability",
        "Innovation": "New paradigm of adversarial training"
    },
    "DCGAN (2015)": {
        "Architecture": "Stabilized GAN with convolutional layers",
        "Innovation": "Batch normalization, strided convolutions, ReLU/LeakyReLU",
        "Resolution": "64x64",
        "Impact": "Became the baseline for nearly all subsequent GANs"
    },
    "Pix2Pix (2017)": {
        "Architecture": "Conditional GAN (cGAN) + U-Net Generator",
        "Input": "Paired images (input image + corresponding output image)",
        "Applications": "Edge to photo, semantic map to photo",
        "Loss": "L1 loss + Adversarial loss"
    },
    "CycleGAN (2017)": {
        "Architecture": "Two pairs of GANs + Cycle Consistency Loss",
        "Innovation": "Unsupervised domain translation without paired data",
        "Applications": "Horse to zebra, photo to painting, season conversion"
    },
    "Progressive GAN (2017)": {
        "Architecture": "Progressive growing from 4x4 to 1024x1024",
        "Innovation": "Start training at low resolution and progressively add layers",
        "Impact": "Enabled high-resolution generation, foundation for StyleGAN"
    },
    "StyleGAN (2019)": {
        "Architecture": "Mapping Network + Synthesis Network + AdaIN",
        "Innovation": "Introduction of style space W, coarse/middle/fine style control",
        "Resolution": "1024x1024 face images",
        "Impact": "Release of FFHQ dataset, advancement of latent space manipulation"
    },
    "StyleGAN2 (2020)": {
        "Improvement": "AdaIN replaced with Weight Demodulation to remove artifacts",
        "Addition": "Path Length Regularization for smoother latent space",
        "Resolution": "1024x1024+",
        "Achievement": "De facto upper limit of GAN quality"
    }
}

for model, details in gan_evolution.items():
    print(f"\n{'='*50}")
    print(f"  {model}")
    print(f"{'='*50}")
    for key, value in details.items():
        print(f"  {key}: {value}")
```

### 1.3 Details of the Diffusion Model Era (2020-Present)

```python
diffusion_evolution = {
    "DDPM (2020)": {
        "Full name": "Denoising Diffusion Probabilistic Models",
        "Core idea": "Gradually add noise to images, then generate by denoising in the reverse process",
        "Steps": "1000 steps (T=1000)",
        "Quality": "First to surpass GANs in FID",
        "Challenge": "Very slow generation speed (processing in pixel space)"
    },
    "Guided Diffusion (2021)": {
        "Innovation": "Improved conditional generation with classifier guidance",
        "Discovery": "Proved to surpass GANs in both FID and IS",
        "Impact": "Diffusion models became mainstream in generative AI research"
    },
    "Classifier-Free Guidance (2022)": {
        "Innovation": "Guidance method that does not require a classifier",
        "Mechanism": "Linear interpolation between conditional and unconditional predictions",
        "Parameter": "Introduction of the guidance_scale (CFG scale) concept",
        "Impact": "Used in virtually all current diffusion models"
    },
    "Latent Diffusion / Stable Diffusion (2022)": {
        "Innovation": "Diffusion processing in latent space, dramatically reducing computational cost",
        "Components": "VAE Encoder + U-Net + CLIP Text Encoder + VAE Decoder",
        "Impact": "Enabled execution on consumer GPUs",
        "Open source": "Model weights published, symbol of democratization"
    },
    "SDXL (2023)": {
        "Improvement": "Enlarged U-Net, two-stage (Base + Refiner) pipeline",
        "Text encoder": "Dual encoder with CLIP + OpenCLIP",
        "Resolution": "1024x1024 native",
        "Quality": "Commercial quality comparable to Midjourney v5"
    },
    "DALL-E 3 (2023)": {
        "Innovation": "Dramatic improvement in instruction following through better captioning",
        "Text rendering": "Significantly improved quality of text generation within images",
        "Safety": "C2PA metadata inclusion",
        "Integration": "Prompt expansion through ChatGPT integration"
    },
    "SD3 / Flux (2024)": {
        "Architecture": "Rectified Flow Transformer (DiT-based)",
        "Innovation": "Transition from U-Net to Transformer",
        "MMDiT": "Bidirectional Attention between text and image",
        "Quality": "Significant improvement in text rendering capability"
    },
    "Sora (2024)": {
        "Innovation": "Long-form high-quality video generation using diffusion Transformers",
        "Input": "Text prompts / images",
        "Output": "Up to 60-second 1080p video",
        "Impact": "Breakthrough in video generation AI"
    }
}

for model, details in diffusion_evolution.items():
    print(f"\n--- {model} ---")
    for key, value in details.items():
        print(f"  {key}: {value}")
```

---

## 2. Classification of Major Architectures

### Code Example 2: Basic Structure of a GAN

```python
import torch
import torch.nn as nn

class Generator(nn.Module):
    """Generator: Generates images from random noise"""
    def __init__(self, latent_dim=100, img_channels=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 512),
            nn.ReLU(),
            nn.Linear(512, img_channels * 64 * 64),
            nn.Tanh()
        )

    def forward(self, z):
        return self.net(z).view(-1, 3, 64, 64)

class Discriminator(nn.Module):
    """Discriminator: Determines whether an image is real or generated"""
    def __init__(self, img_channels=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(img_channels * 64 * 64, 512),
            nn.LeakyReLU(0.2),
            nn.Linear(512, 256),
            nn.LeakyReLU(0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )

    def forward(self, img):
        return self.net(img.view(img.size(0), -1))

# GAN training loop overview
# min_G max_D [ E[log D(x)] + E[log(1 - D(G(z)))] ]
```

### Code Example 2b: Convolutional Structure of DCGAN

```python
import torch
import torch.nn as nn

class DCGANGenerator(nn.Module):
    """DCGAN Generator: Progressively upsamples images using transposed convolutions"""
    def __init__(self, latent_dim=100, feature_maps=64, img_channels=3):
        super().__init__()
        self.main = nn.Sequential(
            # Input: latent_dim x 1 x 1
            nn.ConvTranspose2d(latent_dim, feature_maps * 8, 4, 1, 0, bias=False),
            nn.BatchNorm2d(feature_maps * 8),
            nn.ReLU(True),
            # State: (feature_maps*8) x 4 x 4

            nn.ConvTranspose2d(feature_maps * 8, feature_maps * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_maps * 4),
            nn.ReLU(True),
            # State: (feature_maps*4) x 8 x 8

            nn.ConvTranspose2d(feature_maps * 4, feature_maps * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_maps * 2),
            nn.ReLU(True),
            # State: (feature_maps*2) x 16 x 16

            nn.ConvTranspose2d(feature_maps * 2, feature_maps, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_maps),
            nn.ReLU(True),
            # State: feature_maps x 32 x 32

            nn.ConvTranspose2d(feature_maps, img_channels, 4, 2, 1, bias=False),
            nn.Tanh()
            # Output: img_channels x 64 x 64
        )

    def forward(self, z):
        return self.main(z.view(z.size(0), -1, 1, 1))

class DCGANDiscriminator(nn.Module):
    """DCGAN Discriminator: Downsamples using strided convolutions"""
    def __init__(self, img_channels=3, feature_maps=64):
        super().__init__()
        self.main = nn.Sequential(
            # Input: img_channels x 64 x 64
            nn.Conv2d(img_channels, feature_maps, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),

            nn.Conv2d(feature_maps, feature_maps * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_maps * 2),
            nn.LeakyReLU(0.2, inplace=True),

            nn.Conv2d(feature_maps * 2, feature_maps * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_maps * 4),
            nn.LeakyReLU(0.2, inplace=True),

            nn.Conv2d(feature_maps * 4, feature_maps * 8, 4, 2, 1, bias=False),
            nn.BatchNorm2d(feature_maps * 8),
            nn.LeakyReLU(0.2, inplace=True),

            nn.Conv2d(feature_maps * 8, 1, 4, 1, 0, bias=False),
            nn.Sigmoid()
        )

    def forward(self, img):
        return self.main(img).view(-1, 1)


# DCGAN training stabilization techniques
dcgan_best_practices = {
    "Generator": [
        "Use transposed convolutions (ConvTranspose2d)",
        "Apply batch normalization to all layers (except output layer)",
        "ReLU activation (Tanh for output layer)",
    ],
    "Discriminator": [
        "Replace pooling with strided convolutions",
        "Apply batch normalization to all layers (except input layer)",
        "Use LeakyReLU (slope=0.2)",
    ],
    "Training": [
        "Adam optimizer: lr=0.0002, beta1=0.5",
        "Weight initialization: N(0, 0.02)",
        "Label smoothing: set real labels to 0.9",
    ]
}
```

### Code Example 3: Concept of VAE (Variational Autoencoder)

```python
class VAE(nn.Module):
    """VAE: Learns latent space to reconstruct and generate images"""
    def __init__(self, latent_dim=128):
        super().__init__()
        # Encoder: Image -> Parameters of latent distribution
        self.encoder = nn.Sequential(
            nn.Linear(784, 400), nn.ReLU()
        )
        self.fc_mu = nn.Linear(400, latent_dim)
        self.fc_var = nn.Linear(400, latent_dim)
        # Decoder: Latent vector -> Image
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 400), nn.ReLU(),
            nn.Linear(400, 784), nn.Sigmoid()
        )

    def reparameterize(self, mu, log_var):
        """Reparameterization trick: A technique to allow gradients to flow"""
        std = torch.exp(0.5 * log_var)
        eps = torch.randn_like(std)
        return mu + eps * std

    def forward(self, x):
        h = self.encoder(x.view(-1, 784))
        mu, log_var = self.fc_mu(h), self.fc_var(h)
        z = self.reparameterize(mu, log_var)
        return self.decoder(z), mu, log_var

# Loss function: Reconstruction loss + KL divergence
# L = -E[log p(x|z)] + KL(q(z|x) || p(z))
```

### Code Example 3b: VQ-VAE (Vector Quantized VAE) Implementation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class VectorQuantizer(nn.Module):
    """VQ-VAE Codebook: Quantizes continuous latent representations into discrete codes"""
    def __init__(self, num_embeddings=512, embedding_dim=64, commitment_cost=0.25):
        super().__init__()
        self.embedding = nn.Embedding(num_embeddings, embedding_dim)
        self.embedding.weight.data.uniform_(
            -1.0 / num_embeddings, 1.0 / num_embeddings
        )
        self.commitment_cost = commitment_cost

    def forward(self, z):
        # z: (B, D, H, W) -> convert to (B, H, W, D)
        z = z.permute(0, 2, 3, 1).contiguous()
        z_flat = z.view(-1, z.shape[-1])

        # Search for nearest codebook entry
        distances = (
            torch.sum(z_flat ** 2, dim=1, keepdim=True)
            + torch.sum(self.embedding.weight ** 2, dim=1)
            - 2 * torch.matmul(z_flat, self.embedding.weight.t())
        )
        encoding_indices = torch.argmin(distances, dim=1)
        z_q = self.embedding(encoding_indices).view(z.shape)

        # Loss calculation
        loss = (
            F.mse_loss(z_q.detach(), z)  # commitment loss
            + self.commitment_cost * F.mse_loss(z_q, z.detach())  # embedding loss
        )

        # Straight-through estimator
        z_q = z + (z_q - z).detach()
        return z_q.permute(0, 3, 1, 2), loss, encoding_indices


class VQVAE(nn.Module):
    """VQ-VAE: VAE with discrete latent space

    Applications:
    - Used as image tokenizer for DALL-E (original)
    - Speech synthesis (WaveNet + VQ-VAE)
    - Texture synthesis
    """
    def __init__(self, in_channels=3, hidden_dim=128,
                 num_embeddings=512, embedding_dim=64):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, hidden_dim, 4, 2, 1),
            nn.ReLU(),
            nn.Conv2d(hidden_dim, hidden_dim, 4, 2, 1),
            nn.ReLU(),
            nn.Conv2d(hidden_dim, embedding_dim, 3, 1, 1),
        )
        self.vq = VectorQuantizer(num_embeddings, embedding_dim)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(embedding_dim, hidden_dim, 4, 2, 1),
            nn.ReLU(),
            nn.ConvTranspose2d(hidden_dim, hidden_dim, 4, 2, 1),
            nn.ReLU(),
            nn.Conv2d(hidden_dim, in_channels, 3, 1, 1),
            nn.Tanh(),
        )

    def forward(self, x):
        z_e = self.encoder(x)
        z_q, vq_loss, indices = self.vq(z_e)
        x_recon = self.decoder(z_q)
        return x_recon, vq_loss, indices
```

### ASCII Diagram 2: Comparison of Operating Principles of Major Generative Models

```
+------- GAN --------+   +------- VAE --------+
|                     |   |                     |
|  Noise z            |   |  Input x            |
|     |               |   |     |               |
|     v               |   |     v               |
|  [Generator]        |   |  [Encoder]          |
|     |               |   |     |               |
|     v               |   |  mu, sigma          |
|  Generated G(z)     |   |  (latent dist.)     |
|     |               |   |     |               |
|     v               |   |  [Reparameterize]   |
|  [Discriminator]    |   |     |               |
|     |               |   |     v               |
|  Real/Fake          |   |  [Decoder]          |
|                     |   |     |               |
|                     |   |  Reconstructed x'   |
+---------------------+   +---------------------+

+-- Diffusion Model --+   +-- Transformer-based +
|                     |   |                     |
|  Image x_0          |   |  Text               |
|     | (add noise)   |   |     |               |
|     v               |   |  [Text Encoder]     |
|  x_1 -> x_2 -> xT  |   |     |               |
|  (forward diffusion)|   |  [Cross-Attention]  |
|                     |   |     |               |
|  xT (pure noise)    |   |  [Image Decoder]    |
|     | (denoise)     |   |     |               |
|     v               |   |  Generated image    |
|  ... -> x_1 -> x_0  |   |                     |
|  (reverse diffusion)|   |  e.g.: DALL-E,      |
|                     |   |        Parti         |
+---------------------+   +---------------------+

+---- VQ-VAE --------+   +-- Flow Matching ----+
|                     |   |                     |
|  Input x            |   |  Noise z ~ N(0,I)   |
|     |               |   |     |               |
|     v               |   |     v               |
|  [Encoder]          |   |  Straight trajectory |
|     |               |   |  (Rectified Flow)   |
|  [Quantize]         |   |     |               |
|  Codebook lookup    |   |  [Velocity Field]   |
|     |               |   |  v(x_t, t)          |
|     v               |   |     |               |
|  [Decoder]          |   |     v               |
|     |               |   |  Generated image x_1|
|  Reconstructed x'   |   |                     |
|  (discrete tokens)  |   |  e.g.: Flux, SD3    |
+---------------------+   +---------------------+
```

### Comparison Table 1: Comparison of Major Generative Architectures

| Feature | GAN | VAE | Diffusion Model | Transformer-based | Flow Matching |
|------|-----|-----|-----------|---------------|---------------|
| **Image Quality** | High (mode collapse risk) | Somewhat low (blurry) | Very high | Very high | Very high |
| **Diversity** | Tends to be low | High | High | High | High |
| **Training Stability** | Unstable | Stable | Stable | Stable | Stable |
| **Generation Speed** | Fast (1 step) | Fast (1 step) | Slow (multi-step) | Moderate | Few steps possible |
| **Controllability** | Limited | Latent space manipulation | Text conditioning | Text conditioning | Text conditioning |
| **Representative Model** | StyleGAN | VQ-VAE | Stable Diffusion | DALL-E | Flux / SD3 |
| **Emergence** | 2014 | 2013 | 2020 | 2021 | 2023 |
| **Theoretical Basis** | Game theory | Variational inference | Stochastic processes | Autoregressive | Ordinary differential equations |
| **Scalability** | Moderate | Moderate | High | Very high | Very high |

### Comparison Table 1b: Loss Functions for Each Architecture

| Architecture | Loss Function | Formula | Characteristics |
|---------------|---------|------|------|
| **GAN** | Adversarial Loss | min_G max_D V(D,G) | Game-theoretic optimization |
| **VAE** | ELBO | -E[log p(x\|z)] + KL(q\|\|p) | Reconstruction + regularization |
| **DDPM** | Simple Loss | E[\|\|epsilon - epsilon_theta(x_t, t)\|\|^2] | Noise prediction |
| **LDM** | Latent Loss | DDPM loss in latent space | Computational efficiency |
| **Flow Matching** | CFM Loss | E[\|\|v_theta(x_t, t) - u_t\|\|^2] | Velocity field learning |

---

## 3. Current Ecosystem

### Code Example 4: Usage Examples of Major API Services

```python
# OpenAI DALL-E 3 API
from openai import OpenAI

client = OpenAI()

response = client.images.generate(
    model="dall-e-3",
    prompt="A red torii gate standing in front of Mount Fuji, ukiyo-e style",
    size="1024x1024",
    quality="hd",
    n=1,
)
image_url = response.data[0].url
print(f"Generated image URL: {image_url}")

# Check the revised prompt
revised_prompt = response.data[0].revised_prompt
print(f"Revised prompt: {revised_prompt}")

# Variation generation (DALL-E 2)
response_variation = client.images.create_variation(
    image=open("base_image.png", "rb"),
    n=3,
    size="1024x1024",
)
for i, img in enumerate(response_variation.data):
    print(f"Variation {i+1}: {img.url}")
```

```python
# Stability AI API (SD3 / SDXL)
import requests
import base64

API_KEY = "your-stability-api-key"

# High-quality generation with SD3
response = requests.post(
    "https://api.stability.ai/v2beta/stable-image/generate/sd3",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "application/json",
    },
    files={"none": ""},
    data={
        "prompt": "A serene Japanese garden with cherry blossoms, "
                  "koi pond reflecting moonlight, traditional stone lantern",
        "negative_prompt": "low quality, blurry, distorted",
        "output_format": "png",
        "aspect_ratio": "16:9",
        "model": "sd3-large",
    },
)

if response.status_code == 200:
    result = response.json()
    image_data = base64.b64decode(result["image"])
    with open("japanese_garden.png", "wb") as f:
        f.write(image_data)
    print(f"Generation complete: seed={result.get('seed')}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

```python
# Google Imagen API (via Vertex AI)
from google.cloud import aiplatform
from vertexai.preview.vision_models import ImageGenerationModel

aiplatform.init(project="your-project-id", location="us-central1")

model = ImageGenerationModel.from_pretrained("imagegeneration@006")

response = model.generate_images(
    prompt="Professional product photo of a minimalist watch, "
           "studio lighting, white background, 4K quality",
    number_of_images=4,
    aspect_ratio="1:1",
    safety_filter_level="block_some",
    person_generation="allow_adult",
)

for i, image in enumerate(response.images):
    image.save(f"watch_product_{i}.png")
    print(f"Image {i+1} saved")
```

### Code Example 5: Local Execution with Hugging Face diffusers Library

```python
from diffusers import StableDiffusionPipeline
import torch

# Load model
pipe = StableDiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16,
)
pipe = pipe.to("cuda")

# Memory optimization options
pipe.enable_attention_slicing()  # Reduce attention memory usage
pipe.enable_vae_slicing()        # Reduce VAE batch processing memory

# Image generation
image = pipe(
    prompt="Tokyo night view, cyberpunk style, neon lights",
    negative_prompt="low quality, blurry, distorted",
    num_inference_steps=50,
    guidance_scale=7.5,
    width=768,
    height=512,
).images[0]

image.save("tokyo_cyberpunk.png")
print("Image generated")
```

### Code Example 5b: Complete SDXL Pipeline Implementation

```python
from diffusers import (
    StableDiffusionXLPipeline,
    StableDiffusionXLImg2ImgPipeline,
    AutoencoderKL,
    DPMSolverMultistepScheduler,
)
import torch

# Explicit VAE loading (quality improvement)
vae = AutoencoderKL.from_pretrained(
    "madebyollin/sdxl-vae-fp16-fix",
    torch_dtype=torch.float16,
)

# Load Base model
base_pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    vae=vae,
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
base_pipe.to("cuda")

# Change scheduler (for faster generation)
base_pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    base_pipe.scheduler.config,
    use_karras_sigmas=True,
    algorithm_type="dpmsolver++",
)

# Load Refiner model (optional)
refiner_pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-refiner-1.0",
    vae=vae,
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
refiner_pipe.to("cuda")

# Two-stage generation (Base -> Refiner)
prompt = "A majestic dragon flying over ancient Japanese castle, "
prompt += "dramatic sunset, volumetric clouds, cinematic lighting, 8k"
negative_prompt = "low quality, blurry, distorted, watermark, text"

# Step 1: Coarse generation with Base
base_image = base_pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    num_inference_steps=40,
    guidance_scale=7.5,
    width=1024,
    height=1024,
    output_type="latent",  # Output as latent to pass to Refiner
).images

# Step 2: Refine details with Refiner
refined_image = refiner_pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    image=base_image,
    num_inference_steps=25,
    strength=0.3,  # Refiner strength
).images[0]

refined_image.save("dragon_castle_sdxl.png")
print("SDXL two-stage generation complete")
```

### Code Example 5c: Flux Pipeline Implementation

```python
from diffusers import FluxPipeline
import torch

# Load Flux.1-dev model
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=torch.bfloat16,
)

# Memory optimization
pipe.enable_model_cpu_offload()  # Save GPU VRAM

# Flux excels at text rendering
image = pipe(
    prompt='A wooden sign in a forest that reads "Welcome to the '
           'Enchanted Forest" in elegant calligraphy, '
           'moss-covered, sunlight filtering through leaves',
    num_inference_steps=28,
    guidance_scale=3.5,
    width=1024,
    height=768,
    generator=torch.Generator("cpu").manual_seed(42),
).images[0]

image.save("flux_text_rendering.png")
print("Image generation with Flux complete")
```

### ASCII Diagram 3: Visual AI Ecosystem Map

```
+-------------- Visual AI Ecosystem ----------------+
|                                                    |
|  +-- Commercial Services -+  +-- Open Source ----+ |
|  | DALL-E 3 (OpenAI)      |  | Stable Diffusion  | |
|  | Midjourney              |  | Flux (BFL)        | |
|  | Adobe Firefly           |  | PixArt            | |
|  | Google Imagen           |  | SDXL              | |
|  | Canva AI                |  | ComfyUI           | |
|  | Ideogram                |  | Kolors (Kwai)     | |
|  +-------------------------+  +-------------------+ |
|                                                    |
|  +-- Frameworks ----------+  +-- Applications ---+ |
|  | diffusers (HF)         |  | Advertising/Mktg  | |
|  | ComfyUI                |  | Game Development  | |
|  | Automatic1111           |  | Fashion           | |
|  | InvokeAI               |  | Architecture/     | |
|  | Fooocus                |  |   Interior Design | |
|  | ForgeUI                |  | Film/Video Prod.  | |
|  | SwarmUI                |  | Education/Research| |
|  |                        |  | Medical Imaging   | |
|  +------------------------+  +-------------------+ |
|                                                    |
|  +-- Model Hubs ----------+  +-- Hardware ------+ |
|  | Hugging Face            |  | NVIDIA GPU       | |
|  | Civitai                 |  | Apple Silicon    | |
|  | Replicate               |  | Cloud GPU        | |
|  | RunPod                  |  | (AWS/GCP/Azure)  | |
|  +-------------------------+  +------------------+ |
+----------------------------------------------------+
```

### Comparison Table 2: Comparison of Major Image Generation Services

| Service | Delivery Model | Price Range | Strengths | API Available | Local Execution |
|---------|---------|--------|------|---------|------------|
| **DALL-E 3** | Cloud API | Pay-per-use | Text understanding | Yes | No |
| **Midjourney** | Discord/Web | Subscription $10+ | Art quality | Limited | No |
| **Stable Diffusion** | Open source | Free | Customizability | Yes | Yes |
| **Adobe Firefly** | Integrated tool | Creative Cloud | Commercial safety | Yes | No |
| **Flux** | Open weights | Free/Paid | Text rendering | Yes | Yes |
| **Google Imagen** | Cloud API | Pay-per-use | Photorealism | Yes | No |
| **Ideogram** | Web/API | Freemium | Text rendering | Yes | No |

---

## 4. Evaluation Metrics for Image Generation AI

### Code Example 6: FID (Frechet Inception Distance) Calculation

```python
import torch
import numpy as np
from scipy.linalg import sqrtm
from torchvision.models import inception_v3
from torchvision import transforms
from torch.utils.data import DataLoader

class FIDCalculator:
    """FID: Standard metric for measuring distribution distance between generated and real images

    Lower FID indicates higher quality of generated images.
    - FID < 10: Very high quality
    - FID 10-50: Good
    - FID 50-100: Moderate
    - FID > 100: Low quality
    """
    def __init__(self, device="cuda"):
        self.device = device
        self.model = inception_v3(pretrained=True, transform_input=False)
        self.model.fc = torch.nn.Identity()  # Remove final layer
        self.model = self.model.to(device).eval()

        self.transform = transforms.Compose([
            transforms.Resize((299, 299)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                               [0.229, 0.224, 0.225]),
        ])

    def extract_features(self, dataloader):
        """Extract Inception features from a set of images"""
        features = []
        with torch.no_grad():
            for batch in dataloader:
                if isinstance(batch, (list, tuple)):
                    batch = batch[0]
                batch = batch.to(self.device)
                feat = self.model(batch)
                features.append(feat.cpu().numpy())
        return np.concatenate(features, axis=0)

    def calculate_statistics(self, features):
        """Calculate mean vector and covariance matrix"""
        mu = np.mean(features, axis=0)
        sigma = np.cov(features, rowvar=False)
        return mu, sigma

    def calculate_fid(self, real_features, gen_features):
        """FID = ||mu_r - mu_g||^2 + Tr(Sigma_r + Sigma_g - 2*sqrt(Sigma_r * Sigma_g))"""
        mu_r, sigma_r = self.calculate_statistics(real_features)
        mu_g, sigma_g = self.calculate_statistics(gen_features)

        # Norm of mean difference
        diff = mu_r - mu_g
        diff_sq = np.sum(diff ** 2)

        # Square root of covariance
        covmean = sqrtm(sigma_r @ sigma_g)
        if np.iscomplexobj(covmean):
            covmean = covmean.real

        fid = diff_sq + np.trace(sigma_r + sigma_g - 2 * covmean)
        return float(fid)


# Usage example
calculator = FIDCalculator()
# real_loader, gen_loader are DataLoader objects
# real_features = calculator.extract_features(real_loader)
# gen_features = calculator.extract_features(gen_loader)
# fid_score = calculator.calculate_fid(real_features, gen_features)
# print(f"FID Score: {fid_score:.2f}")
```

### Code Example 7: CLIP Score Calculation

```python
import torch
from transformers import CLIPModel, CLIPProcessor
from PIL import Image

class CLIPScoreCalculator:
    """CLIP Score: Evaluates alignment between text and generated image

    Measures fidelity of the generated image to the text prompt.
    Higher scores indicate greater alignment with the prompt.

    Typical score ranges:
    - 0.30+: Very high alignment
    - 0.25-0.30: Good alignment
    - 0.20-0.25: Moderate
    - Below 0.20: Low alignment
    """
    def __init__(self, model_name="openai/clip-vit-large-patch14"):
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model.eval()

    def calculate_score(self, image: Image.Image, text: str) -> float:
        """Calculate CLIP score for a single image-text pair"""
        inputs = self.processor(
            text=[text], images=image,
            return_tensors="pt", padding=True
        )
        with torch.no_grad():
            outputs = self.model(**inputs)
            # Calculate cosine similarity
            image_embeds = outputs.image_embeds
            text_embeds = outputs.text_embeds

            image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
            text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)

            score = (image_embeds @ text_embeds.T).item()
        return score

    def batch_evaluate(self, images, prompts):
        """Batch evaluation: Evaluate multiple image-text pairs at once"""
        results = []
        for img, prompt in zip(images, prompts):
            score = self.calculate_score(img, prompt)
            results.append({
                "prompt": prompt[:50] + "..." if len(prompt) > 50 else prompt,
                "clip_score": round(score, 4),
            })

        avg_score = sum(r["clip_score"] for r in results) / len(results)
        return results, avg_score


# Usage example
# calc = CLIPScoreCalculator()
# image = Image.open("generated_image.png")
# score = calc.calculate_score(image, "a cat sitting on a sofa")
# print(f"CLIP Score: {score:.4f}")
```

### Code Example 8: Inception Score (IS) Calculation

```python
import torch
import numpy as np
from torchvision.models import inception_v3
import torch.nn.functional as F

class InceptionScoreCalculator:
    """Inception Score: Simultaneously evaluates quality and diversity of generated images

    IS = exp(E[KL(p(y|x) || p(y))])

    - p(y|x): Classification probability distribution for each generated image (clearer is better)
    - p(y): Overall marginal distribution (more uniform means greater diversity)

    Typical score ranges (ImageNet):
    - IS > 100: Very high quality (close to real images)
    - IS 50-100: Good
    - IS 10-50: Moderate
    - IS < 10: Low quality
    """
    def __init__(self, device="cuda"):
        self.device = device
        self.model = inception_v3(pretrained=True).to(device).eval()

    def calculate_is(self, images, splits=10):
        """Calculate Inception Score"""
        preds = []
        with torch.no_grad():
            for img in images:
                img = img.unsqueeze(0).to(self.device)
                pred = F.softmax(self.model(img), dim=1)
                preds.append(pred.cpu().numpy())

        preds = np.concatenate(preds, axis=0)

        # Calculate IS for each split and average
        scores = []
        chunk_size = len(preds) // splits
        for i in range(splits):
            chunk = preds[i * chunk_size:(i + 1) * chunk_size]
            p_y = np.mean(chunk, axis=0, keepdims=True)
            kl_div = chunk * (np.log(chunk + 1e-16) - np.log(p_y + 1e-16))
            kl_mean = np.mean(np.sum(kl_div, axis=1))
            scores.append(np.exp(kl_mean))

        return float(np.mean(scores)), float(np.std(scores))
```

### Comparison Table 3: List of Image Generation Evaluation Metrics

| Metric | Measurement Target | Calculation Method | Advantages | Limitations |
|------|---------|---------|------|------|
| **FID** | Quality + Diversity | Distribution distance of Inception features | Most widely used | Requires at least several thousand images |
| **IS** | Quality + Diversity | KL between conditional/marginal distributions | Relatively lightweight computation | Dataset bias |
| **CLIP Score** | Text alignment | Similarity of CLIP embeddings | Enables semantic evaluation | Depends on CLIP limitations |
| **LPIPS** | Perceptual similarity | Distance in feature space | Close to human perception | Requires paired images |
| **SSIM** | Structural similarity | Luminance, contrast, structure | Easy to interpret | Pixel-level limitations |
| **Human Eval** | Overall quality | Subjective evaluation by humans | Most reliable | Costly and time-consuming |
| **Aesthetic Score** | Aesthetic quality | LAION Aesthetic Predictor | Quantitative assessment of beauty | Subjective criteria |

---

## 5. Industry-Specific Use Cases

### 5.1 Advertising and Marketing

```python
# Example ad banner auto-generation pipeline
class AdBannerGenerator:
    """Automated ad banner generation workflow

    Practical workflow:
    1. Input brand guidelines
    2. Generate prompts tailored to target audience
    3. Batch generate multiple variations
    4. Quality filtering
    5. A/B test candidate selection
    """
    def __init__(self, brand_config):
        self.brand_colors = brand_config["colors"]
        self.brand_style = brand_config["style"]
        self.target_sizes = brand_config["sizes"]

    def generate_prompt(self, product, campaign_theme, target_audience):
        """Generate prompts aligned with brand guidelines"""
        base_prompt = f"{product}, {campaign_theme}, "
        style_prompt = f"{self.brand_style} style, "
        color_prompt = f"color palette: {', '.join(self.brand_colors)}, "
        audience_prompt = f"appealing to {target_audience}, "
        quality_prompt = "professional advertising photography, studio lighting, 4K"

        return base_prompt + style_prompt + color_prompt + audience_prompt + quality_prompt

    def generate_variations(self, prompt, num_variations=8):
        """Generate multiple variations"""
        variations = []
        # Composition variations
        compositions = [
            "centered composition",
            "rule of thirds",
            "diagonal composition",
            "symmetrical layout",
        ]
        # Background variations
        backgrounds = [
            "clean white background",
            "gradient background",
        ]
        for comp in compositions:
            for bg in backgrounds:
                full_prompt = f"{prompt}, {comp}, {bg}"
                variations.append(full_prompt)
        return variations[:num_variations]

# Usage example
brand_config = {
    "colors": ["#2563EB", "#F59E0B", "#FFFFFF"],
    "style": "modern minimalist",
    "sizes": ["1200x628", "1080x1080", "160x600"],
}
generator = AdBannerGenerator(brand_config)
prompt = generator.generate_prompt(
    product="wireless earbuds",
    campaign_theme="summer freedom",
    target_audience="young professionals 25-35"
)
print(f"Generated prompt: {prompt}")
```

### 5.2 Game Development

```python
# Example game asset generation pipeline
class GameAssetPipeline:
    """Patterns for using image generation AI in game development

    Application areas:
    - Concept art: Rapid prototyping of initial design ideas
    - Texture generation: Automatic generation of tileable textures
    - UI icons: Variations of item and skill icons
    - Backgrounds: Automatic generation of background art for 2D games
    """

    TEXTURE_PROMPT_TEMPLATE = (
        "{material} texture, seamless tileable, "
        "top-down view, flat lighting, {style}, "
        "game asset, PBR material, 512x512"
    )

    ICON_PROMPT_TEMPLATE = (
        "{item_type} icon, {rarity} rarity, "
        "game UI icon, {art_style}, "
        "centered, clean edges, transparent background"
    )

    CONCEPT_ART_TEMPLATE = (
        "{subject}, concept art, {genre} game style, "
        "{atmosphere}, detailed, professional illustration, "
        "artstation quality"
    )

    def generate_texture_prompts(self, materials):
        """Batch creation of texture generation prompts"""
        prompts = []
        for material in materials:
            prompt = self.TEXTURE_PROMPT_TEMPLATE.format(
                material=material["name"],
                style=material.get("style", "photorealistic"),
            )
            prompts.append({
                "prompt": prompt,
                "filename": f"texture_{material['name'].replace(' ', '_')}.png",
                "use_case": material.get("use_case", "environment"),
            })
        return prompts

    def generate_item_icons(self, items):
        """Generate game item icons"""
        rarity_styles = {
            "common": "simple design, grey border",
            "rare": "glowing blue outline, detailed",
            "epic": "purple aura, ornate design",
            "legendary": "golden glow, extremely detailed, particle effects",
        }
        prompts = []
        for item in items:
            rarity = item.get("rarity", "common")
            prompt = self.ICON_PROMPT_TEMPLATE.format(
                item_type=item["name"],
                rarity=rarity,
                art_style=rarity_styles.get(rarity, "simple design"),
            )
            prompts.append(prompt)
        return prompts

# Usage example
pipeline = GameAssetPipeline()
materials = [
    {"name": "cobblestone", "style": "medieval fantasy", "use_case": "floor"},
    {"name": "wooden planks", "style": "rustic", "use_case": "building"},
    {"name": "metal plate", "style": "sci-fi", "use_case": "spaceship"},
]
texture_prompts = pipeline.generate_texture_prompts(materials)
for tp in texture_prompts:
    print(f"[{tp['use_case']}] {tp['filename']}")
    print(f"  Prompt: {tp['prompt'][:80]}...")
```

### 5.3 Architecture and Interior Design

```python
# Example architectural visualization
class ArchitecturalVisualizer:
    """AI image generation applications in architecture and interior design

    Practical usage patterns:
    1. Initial concept: Rapid creation of proposal images for clients
    2. Style exploration: Quick comparison of multiple interior styles
    3. Renovation proposals: Transform existing photos into completion renderings via AI
    4. Material experimentation: Try different materials in the same space
    """

    STYLES = {
        "modern": "modern minimalist interior, clean lines, "
                  "neutral colors, large windows, natural light",
        "japanese": "Japanese wabi-sabi interior, natural materials, "
                    "tatami, shoji screens, zen garden view",
        "scandinavian": "Scandinavian hygge interior, warm wood tones, "
                        "cozy textiles, simple furniture, white walls",
        "industrial": "industrial loft interior, exposed brick, "
                      "metal fixtures, concrete floor, high ceilings",
        "art_deco": "Art Deco interior, geometric patterns, "
                    "gold accents, velvet furniture, marble floors",
    }

    def generate_room_prompt(self, room_type, style,
                             specific_requirements=None):
        """Generate prompts for room visualization"""
        base = f"{room_type}, {self.STYLES.get(style, style)}"
        quality = (
            "architectural visualization, photorealistic rendering, "
            "interior design magazine quality, professional photography, "
            "8K resolution, ray tracing"
        )
        prompt = f"{base}, {quality}"
        if specific_requirements:
            prompt += f", {specific_requirements}"
        return prompt

# Usage example
viz = ArchitecturalVisualizer()
prompt = viz.generate_room_prompt(
    room_type="living room",
    style="japanese",
    specific_requirements="overlooking a mountain view, evening golden hour"
)
print(f"Architectural visualization prompt:\n{prompt}")
```

### 5.4 Fashion and E-Commerce

```python
class FashionAIWorkflow:
    """AI image generation applications in the fashion industry

    Key use cases:
    - Virtual Try-On
    - Product image variation generation
    - Automated lookbook generation
    - Textile pattern design
    - Model photo pose and background changes
    """

    def generate_product_variants(self, product_description, colors, backgrounds):
        """Generate color variations of product images"""
        prompts = []
        for color in colors:
            for bg in backgrounds:
                prompt = (
                    f"{color} {product_description}, "
                    f"{bg}, "
                    f"professional product photography, "
                    f"e-commerce style, clean, well-lit, "
                    f"high detail, studio lighting"
                )
                prompts.append({
                    "prompt": prompt,
                    "color": color,
                    "background": bg,
                })
        return prompts

    def generate_textile_pattern(self, pattern_type, color_scheme, season):
        """Generate textile patterns"""
        prompt = (
            f"{pattern_type} textile pattern, "
            f"color scheme: {color_scheme}, "
            f"{season} collection, "
            f"seamless tileable pattern, "
            f"fashion fabric design, high resolution, "
            f"surface pattern design"
        )
        return prompt

# Usage example
workflow = FashionAIWorkflow()
variants = workflow.generate_product_variants(
    product_description="leather handbag, tote style",
    colors=["black", "cognac brown", "navy blue"],
    backgrounds=["white studio background", "lifestyle outdoor setting"],
)
for v in variants:
    print(f"[{v['color']}] [{v['background']}]")
    print(f"  {v['prompt'][:80]}...")
```

### 5.5 Medical Imaging Applications

```python
class MedicalImagingAI:
    """Applications of AI generation technology in the medical imaging field

    Note: The use of generative AI in the medical field requires strict regulations
    and ethical considerations. The following are examples for research and educational purposes.

    Application areas:
    - Data augmentation: Augment small medical image samples to train classifiers
    - Anonymization: Generate educational images while preserving patient privacy
    - Simulation: Synthesize images of rare diseases to supplement training data
    - Segmentation support: Improve segmentation accuracy with labeled synthetic data
    """

    def create_augmentation_pipeline(self, modality, condition):
        """Design a medical image data augmentation pipeline"""
        pipeline_config = {
            "modality": modality,
            "condition": condition,
            "augmentation_steps": [
                {
                    "type": "geometric",
                    "methods": ["rotation", "flipping", "scaling"],
                    "note": "Limited to anatomically plausible ranges"
                },
                {
                    "type": "intensity",
                    "methods": ["brightness", "contrast", "noise"],
                    "note": "Variations that do not affect diagnosis"
                },
                {
                    "type": "generative",
                    "methods": ["GAN-based synthesis", "diffusion-based"],
                    "note": "Quality verification by medical specialists is mandatory"
                }
            ],
            "validation": {
                "expert_review": "Visual inspection by radiologists",
                "statistical_check": "Distribution consistency verification (FID, etc.)",
                "downstream_eval": "Performance verification on classification/detection tasks",
            },
            "ethical_requirements": [
                "IRB (Institutional Review Board) approval",
                "Complete anonymization of patient data",
                "Explicit labeling of generated images (clearly marking as synthetic data)",
                "Regulatory agency submission before clinical use",
            ]
        }
        return pipeline_config
```

---

## 6. Cost Analysis and Infrastructure Selection

### Code Example 9: Cost Comparison Calculator

```python
class VisualAICostCalculator:
    """Cost comparison tool for image generation AI

    Cost comparison between API billing, local GPU, and cloud GPU
    """

    # Approximate prices as of 2025
    API_PRICING = {
        "dall-e-3": {
            "standard_1024": 0.040,   # USD per image
            "hd_1024": 0.080,
            "standard_1792": 0.080,
            "hd_1792": 0.120,
        },
        "stability_sd3": {
            "per_image": 0.065,
        },
        "midjourney": {
            "basic_monthly": 10,      # 200 images/month
            "standard_monthly": 30,   # unlimited relax
            "pro_monthly": 60,
        },
    }

    LOCAL_GPU_COSTS = {
        "RTX 4090": {
            "purchase_price": 1600,
            "power_watts": 450,
            "vram_gb": 24,
            "images_per_hour_sdxl": 120,
            "images_per_hour_flux": 40,
        },
        "RTX 4070": {
            "purchase_price": 600,
            "power_watts": 200,
            "vram_gb": 12,
            "images_per_hour_sdxl": 60,
            "images_per_hour_flux": 15,
        },
    }

    CLOUD_GPU_COSTS = {
        "A100_40gb": {"hourly_rate": 3.50, "images_per_hour_sdxl": 200},
        "L4": {"hourly_rate": 0.80, "images_per_hour_sdxl": 80},
        "T4": {"hourly_rate": 0.35, "images_per_hour_sdxl": 30},
    }

    def calculate_monthly_cost(self, method, images_per_month,
                               electricity_rate_per_kwh=0.15):
        """Estimate monthly cost"""
        if method == "dall-e-3":
            return images_per_month * self.API_PRICING["dall-e-3"]["hd_1024"]

        elif method == "local_rtx4090":
            gpu = self.LOCAL_GPU_COSTS["RTX 4090"]
            hours_needed = images_per_month / gpu["images_per_hour_sdxl"]
            electricity = (gpu["power_watts"] / 1000) * hours_needed * electricity_rate_per_kwh
            # GPU depreciation (3 years)
            depreciation = gpu["purchase_price"] / 36
            return electricity + depreciation

        elif method == "cloud_a100":
            cloud = self.CLOUD_GPU_COSTS["A100_40gb"]
            hours_needed = images_per_month / cloud["images_per_hour_sdxl"]
            return hours_needed * cloud["hourly_rate"]

        return 0

    def compare_all(self, images_per_month):
        """Compare costs across all methods"""
        methods = ["dall-e-3", "local_rtx4090", "cloud_a100"]
        results = {}
        for method in methods:
            cost = self.calculate_monthly_cost(method, images_per_month)
            results[method] = {
                "monthly_cost_usd": round(cost, 2),
                "cost_per_image_usd": round(cost / images_per_month, 4)
                    if images_per_month > 0 else 0,
            }
        return results

# Usage example
calc = VisualAICostCalculator()
for volume in [100, 1000, 10000]:
    print(f"\n--- For {volume:,} images per month ---")
    comparison = calc.compare_all(volume)
    for method, costs in comparison.items():
        print(f"  {method}: "
              f"${costs['monthly_cost_usd']:,.2f}/month "
              f"(${costs['cost_per_image_usd']:.4f}/image)")
```

### Comparison Table 4: Infrastructure Selection Guide

| Condition | Recommended Method | Reason |
|------|---------|------|
| Less than 100 images/month | API (DALL-E 3, etc.) | No upfront investment, immediate availability |
| 100-1000 images/month | Cloud GPU | Flexible scaling, moderate cost |
| Over 1000 images/month | Local GPU | Lowest long-term cost, full customization |
| Commercial use priority | Adobe Firefly / DALL-E 3 | Clear licensing, reduced litigation risk |
| Custom model needed | Local GPU + fine-tuning | Full control, training on proprietary data |
| Prototype stage | Midjourney + API | Fast iteration, low cost |

---

## 7. Detailed Legal and Ethical Issues

### 7.1 Current State of Copyright Issues

```python
copyright_landscape = {
    "Japan": {
        "Current law": "Copyright Act Article 30-4 — Use of copyrighted works for AI training is generally lawful",
        "Copyright of generated works": "Determined by presence of 'creative contribution' — prompts alone may be insufficient",
        "Discussion status": "Under review by the Cultural Council, guideline development in progress",
        "Practical responses": [
            "Clearly indicate that outputs are AI-generated",
            "Check similarity with third-party copyrighted works",
            "Confirm terms of service for commercial use",
        ]
    },
    "United States": {
        "Current law": "Copyright Office — Portions without human creative involvement are not eligible for copyright protection",
        "Case law": "Thaler v. Perlmutter (2023) — Works created solely by AI cannot be registered",
        "Mixed cases": "Joint human-AI creations may be partially protected",
        "Ongoing": "Multiple lawsuits (Getty Images vs Stability AI, etc.)",
    },
    "EU": {
        "AI Act": "Enacted in 2024 — Transparency obligations for AI-generated content",
        "Labeling": "AI-generated images require explicit labeling",
        "Training data": "Opt-out rights must be guaranteed",
    }
}

for region, details in copyright_landscape.items():
    print(f"\n=== {region} ===")
    for key, value in details.items():
        if isinstance(value, list):
            print(f"  {key}:")
            for item in value:
                print(f"    - {item}")
        else:
            print(f"  {key}: {value}")
```

### 7.2 Deepfake and Bias Issues

```python
ethical_concerns = {
    "Deepfakes": {
        "Risks": [
            "Fabricated videos of politicians and celebrities for public opinion manipulation",
            "Personal attacks such as revenge pornography",
            "Misuse for fraud and impersonation",
        ],
        "Countermeasure technologies": [
            "C2PA (Coalition for Content Provenance and Authenticity) metadata",
            "SynthID (Google) — Invisible digital watermarking",
            "AI forensics — Detection technology for generated images",
            "Blockchain-based provenance tracking",
        ],
        "Regulatory trends": [
            "EU AI Act: High-risk AI classification, transparency obligations",
            "Japan: Discussion on amendments to the Unfair Competition Prevention Act",
            "United States: State-level regulation (CA, TX, etc.)",
        ]
    },
    "Bias": {
        "Issues": [
            "Reproduction of stereotypes due to biased training data",
            "Under/over-representation of specific races, genders, and cultures",
            "Risk of NSFW content generation",
        ],
        "Mitigation measures": [
            "Training with diverse datasets",
            "Implementation of safety filters",
            "Vulnerability discovery through red teaming",
            "Development of community guidelines",
        ]
    }
}

for topic, details in ethical_concerns.items():
    print(f"\n--- {topic} ---")
    for category, items in details.items():
        print(f"  [{category}]")
        for item in items:
            print(f"    - {item}")
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Adoption Without Technology Assessment

```
[Problem]
Adopting the most talked-about tool with the attitude of
"let's just introduce AI image generation" without requirements definition.

[Why It's a Problem]
- Risk of copyright issues in commercial use
- Budget overruns due to underestimated costs
- Selection of a model that doesn't fit the use case

[Correct Approach]
1. Clarify the use case (ad materials? prototypes? final deliverables?)
2. Confirm legal requirements (commercial use eligibility, training data transparency)
3. Define quality requirements (resolution, style, consistency)
4. Estimate costs (API pay-per-use vs local GPU investment)
5. Select after conducting PoC with multiple models
```

### Anti-Pattern 2: "AI Will Solve Everything" Mindset

```
[Problem]
Attempting to replace the entire design workflow with AI generation.

[Why It's a Problem]
- AI generation is "material creation," not "design"
- Maintaining brand consistency is difficult
- Fine adjustments and tweaks require extensive trial and error
- Human creative judgment remains indispensable

[Correct Approach]
- Position AI as an "assistant"
- Initial ideation -> AI generation -> Human selection and refinement
- Brand guideline consistency checks are handled by humans
- Focus on areas where AI excels (variation generation, background creation)
```

### Anti-Pattern 3: Reusing Prompts Across Models

```
[Problem]
Using a prompt that worked once directly on different models
or versions without modification.

[Why It's a Problem]
- Prompt interpretation differs between models
- Prompt processing logic changes with version updates
- DALL-E 3 internally rewrites prompts
- Optimal prompt structure differs between Midjourney and SD

[Correct Approach]
- Check prompt guides for each model
- Adjust prompts for each model even with the same intent
- Manage prompt templates separately per model
- Verify prompt effectiveness through A/B testing
```

### Anti-Pattern 4: Using Generated Images Without Verification

```
[Problem]
Using generated images directly in production
without quality checks.

[Why It's a Problem]
- May contain artifacts (abnormal fingers, broken text)
- Risk of generating images closely resembling existing copyrighted works
- Possibility of inappropriate content inclusion
- Inconsistency with brand image

[Correct Approach]
1. Automated quality checks (CLIP Score, human body detection, text detection)
2. Reverse image search (TinEye, Google Reverse Image Search)
3. Human review (final check must always be done by humans)
4. Establish approval workflows (designer/legal sign-off)
```

---

## 9. FAQ

### Q1: What specifications are needed to get started with image generation AI?

**A:** It depends on the use case.

- **API services only:** A regular PC/smartphone is sufficient
- **Local execution (SD-based):** GPU with VRAM 8GB or more recommended (RTX 3060 or higher)
- **SDXL execution:** VRAM 12GB or more recommended (RTX 4070 or higher)
- **Flux execution:** VRAM 16GB or more recommended (RTX 4080/4090)
- **Fine-tuning:** VRAM 16-24GB (RTX 4090, A100)
- **Apple Silicon Mac:** Runnable on M1 or later (though slower than GPU)
  - M1/M2: SD 1.5 is practical, SDXL is somewhat slow
  - M3 Max/Ultra: SDXL and Flux also run at practical speeds

### Q2: What about copyright of generated images?

**A:** It varies by country and service, but generally:

- **United States:** AI-generated images are not eligible for copyright protection (2023 Copyright Office guidance)
- **Japan:** Copyright of AI-generated works is under discussion, depends on degree of creative involvement
- **Service terms:** DALL-E, Midjourney, etc. allow commercial use (paid plans)
- **Training data issues:** Copyright infringement risks related to images used for training are a separate matter
- **Practical response:** Always review service terms of use for commercial use and consult with in-house legal

### Q3: Should I learn GANs or diffusion models?

**A:** As of 2025, **we recommend prioritizing learning diffusion models**.

- All current mainstream models (SD, DALL-E, Flux) are diffusion model-based
- GANs are important for theoretical understanding, but diffusion models are superior in practical terms
- However, GAN-like approaches are making a comeback in areas such as real-time generation
- The optimal approach is to understand the basics of both, then dive deep into diffusion models
- Flow Matching (Flux, SD3) is attracting attention as the next trend

### Q4: Should I use ComfyUI or Automatic1111 WebUI?

**A:** It depends on your use case and experience level.

| Aspect | ComfyUI | Automatic1111 WebUI |
|------|---------|-------------------|
| **Interface** | Node-based (visual programming) | Form input-based |
| **Learning Curve** | Somewhat steep | Low |
| **Customizability** | Very high | Moderate |
| **Workflow Management** | Save and share as JSON | Managed via config files |
| **Latest Model Support** | Very fast | Somewhat slow |
| **Recommended Users** | Engineers, power users | Beginners, designers |
| **Memory Efficiency** | Good | Average |

### Q5: Can you make money with image generation AI?

**A:** The following business models exist.

1. **Stock photo sales:** Adobe Stock, Shutterstock, etc. partially accept AI images (disclosure required)
2. **Contract design:** Design services incorporating AI generation into workflows
3. **LoRA model sales:** Selling custom models via subscription on Civitai, etc.
4. **Education and consulting:** Enterprise support for AI image generation adoption
5. **App development:** Developing SaaS products with built-in AI image generation features
6. **Print on demand:** Selling AI-generated art on T-shirts and posters

However, competition is intensifying, and the following are important for differentiation:
- Specialized knowledge in specific domains (medical, architecture, fashion, etc.)
- Ability to build unique workflows and pipelines
- Technical skills in fine-tuning and LoRA training
- Branding and marketing capabilities

### Q6: What are the limitations of image generation AI?

**A:** Major limitations as of 2025:

- **Fingers and anatomy:** Improving but not yet perfect
- **Text rendering:** Significantly improved with Flux and DALL-E 3, but long text remains difficult
- **Consistency:** Generating the same character in multiple poses is still challenging
- **Precise spatial arrangement:** Complex placement instructions like "A to the left of B, C on top of B"
- **Counting:** Generating exact numbers of objects ("3 cats" becomes 4, etc.)
- **Physical laws:** Accurate reproduction of physical phenomena like reflection, shadows, and transparency
- **Long-form video:** Generating long-duration video with consistency

---

## Summary Table

| Item | Key Points |
|------|------|
| **History** | GAN (2014) -> VAE development -> Diffusion models (2020) -> Commercialization (2022~) -> Flow Matching (2024~) |
| **Current Mainstream** | Diffusion models (Latent Diffusion) + Transformer fusion, transition to Flow Matching |
| **Major Players** | OpenAI, Stability AI, Midjourney, Adobe, Google, BFL, Ideogram |
| **Open Source** | Stable Diffusion and Flux are central. Community models on Civitai |
| **Application Domains** | Advertising, gaming, fashion, architecture, film, education, healthcare |
| **Evaluation Metrics** | FID (quality), CLIP Score (alignment), IS (diversity), Human Eval (overall) |
| **Legal Issues** | Copyright, training data transparency, deepfake regulation, AI Act |
| **Technology Trends** | Multimodal integration, real-time generation, 3D integration, Flow Matching |
| **Cost Strategy** | Low volume -> API, Medium volume -> Cloud GPU, High volume -> Local GPU |

---



## FAQ

### Q1: What is the most important point in learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how things work.

### Q2: What common mistakes do beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently utilized in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

In this guide, we learned the following key points:

- Understanding of basic concepts and principles
- Practical implementation patterns
- Best practices and caveats
- Practical applications in the workplace

---

## Recommended Next Guides

- [01-diffusion-models.md](./01-diffusion-models.md) — Mathematical foundations and implementation of diffusion models
- [02-prompt-engineering-visual.md](./02-prompt-engineering-visual.md) — Effective prompt design
- [../01-image/00-image-generation.md](../01-image/00-image-generation.md) — How to use specific image generation tools

---

## References

1. Goodfellow, I. et al. (2014). "Generative Adversarial Nets." *NeurIPS 2014*. https://arxiv.org/abs/1406.2661
2. Kingma, D.P. & Welling, M. (2013). "Auto-Encoding Variational Bayes." *ICLR 2014*. https://arxiv.org/abs/1312.6114
3. Radford, A. et al. (2015). "Unsupervised Representation Learning with Deep Convolutional Generative Adversarial Networks." *ICLR 2016*. https://arxiv.org/abs/1511.06434
4. Isola, P. et al. (2017). "Image-to-Image Translation with Conditional Adversarial Networks." *CVPR 2017*. https://arxiv.org/abs/1611.07004
5. Zhu, J.-Y. et al. (2017). "Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks." *ICCV 2017*. https://arxiv.org/abs/1703.10593
6. Karras, T. et al. (2019). "A Style-Based Generator Architecture for Generative Adversarial Networks." *CVPR 2019*. https://arxiv.org/abs/1812.04948
7. Ho, J. et al. (2020). "Denoising Diffusion Probabilistic Models." *NeurIPS 2020*. https://arxiv.org/abs/2006.11239
8. Dhariwal, P. & Nichol, A. (2021). "Diffusion Models Beat GANs on Image Synthesis." *NeurIPS 2021*. https://arxiv.org/abs/2105.05233
9. Rombach, R. et al. (2022). "High-Resolution Image Synthesis with Latent Diffusion Models." *CVPR 2022*. https://arxiv.org/abs/2112.10752
10. Ramesh, A. et al. (2022). "Hierarchical Text-Conditional Image Generation with CLIP Latents." *arXiv*. https://arxiv.org/abs/2204.06125
11. Zhang, L. et al. (2023). "Adding Conditional Control to Text-to-Image Diffusion Models." *ICCV 2023*. https://arxiv.org/abs/2302.05543
12. Esser, P. et al. (2024). "Scaling Rectified Flow Transformers for High-Resolution Image Synthesis." *ICML 2024*. https://arxiv.org/abs/2403.03206
13. Heusel, M. et al. (2017). "GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium." *NeurIPS 2017*. https://arxiv.org/abs/1706.08500
14. Radford, A. et al. (2021). "Learning Transferable Visual Models From Natural Language Supervision." *ICML 2021*. https://arxiv.org/abs/2103.00020
