# Visual Prompts — Composition, Style, and Negative Prompts

> A systematic guide to prompt engineering techniques for obtaining intended outputs from image generation AI, covering composition design through negative prompts.

---

## What You Will Learn in This Chapter

1. **Prompt Structure Design Principles** — A 4-layer framework of subject, style, quality, and composition
2. **Negative Prompt Strategies** — Techniques for eliminating unwanted elements and improving quality
3. **Model-Specific Optimization** — Effective prompt techniques for SD-based, DALL-E, and Midjourney respectively
4. **Systematic Prompt Debugging** — A/B testing, seed-fixed comparison, and iterative improvement methods
5. **Industry-Specific Prompt Templates** — Practical patterns for advertising, gaming, architecture, and fashion
6. **Quantitative Prompt Quality Evaluation** — Building CLIP Score, human evaluation, and automated evaluation pipelines


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Diffusion Models — DDPM, Score Matching, Noise Schedules](./01-diffusion-models.md)

---

## 1. The 4-Layer Prompt Framework

By constructing instructions for image generation AI with awareness of four layers, you can achieve consistent high-quality outputs. Each layer is independent, and weighting can be adjusted according to the task.

### 1.1 Theoretical Background of the Framework

Text encoders (CLIP, T5, etc.) split input text into tokens, and each token's embedding vector controls image generation. Token position within the prompt (earlier positions have greater influence) and semantic clustering (grouping related keywords together) directly affect output quality.

```
Text Input → Tokenization → Embedding Vectors → Cross-Attention → Image Generation

Token position influence:
Position  1-10:  ████████████████████ 100% (Place subject here)
Position 11-20:  ████████████████     80% (Place style here)
Position 21-40:  ████████████         60% (Place quality/composition here)
Position 41-75:  ████████             40% (Supplementary info)
Position 76+:    ████                 20% (Truncated in SD1.5)
```

### Code Example 1: Prompt Builder Class (Extended Version)

```python
from dataclasses import dataclass, field
from typing import Optional
import json


@dataclass
class PromptLayer:
    """Data class representing each prompt layer"""
    name: str
    content: str = ""
    priority: int = 0  # 0 is highest priority
    tokens_estimate: int = 0

    def estimate_tokens(self) -> int:
        """Estimate approximate token count (English: ~4 chars/token)"""
        self.tokens_estimate = len(self.content.split(", "))
        return self.tokens_estimate


class VisualPromptBuilder:
    """
    Prompt construction based on the 4-layer framework

    Role of each layer:
    - Layer 1 (Subject): What to depict — most important, placed first
    - Layer 2 (Style): What style to use — artistic direction
    - Layer 3 (Quality): Technical quality — resolution, detail
    - Layer 4 (Composition): Composition and camera settings — camera, lighting, angle
    """

    # Token limits per model
    TOKEN_LIMITS = {
        "sd15": 75,
        "sdxl": 150,
        "sd3": 256,
        "flux": 512,
        "dalle3": 4000,  # character count
        "midjourney": 350,  # word count
    }

    def __init__(self, model: str = "sdxl"):
        self.model = model
        self.subject = PromptLayer("subject", priority=0)
        self.style = PromptLayer("style", priority=1)
        self.quality = PromptLayer("quality", priority=2)
        self.composition = PromptLayer("composition", priority=3)
        self.negative = ""
        self._history: list[dict] = []  # Prompt history

    def set_subject(self, subject: str, details: str = "",
                    action: str = "", environment: str = ""):
        """
        Layer 1: What to depict

        Args:
            subject: Main subject (person, object, landscape, etc.)
            details: Subject details (clothing, color, material, etc.)
            action: Action/pose
            environment: Environment/background
        """
        parts = [subject]
        if details:
            parts.append(details)
        if action:
            parts.append(action)
        if environment:
            parts.append(environment)
        self.subject.content = ", ".join(parts)
        return self

    def set_style(self, style: str, artist: str = "",
                  medium: str = "", era: str = "",
                  influences: list[str] = None):
        """
        Layer 2: What style to use

        Args:
            style: Base style (photorealistic, anime, oil painting, etc.)
            artist: Reference artist
            medium: Medium/technique
            era: Era/period
            influences: Other influences/references
        """
        parts = [style]
        if artist:
            parts.append(f"in the style of {artist}")
        if medium:
            parts.append(medium)
        if era:
            parts.append(era)
        if influences:
            parts.extend(influences)
        self.style.content = ", ".join(parts)
        return self

    def set_quality(self, *tags, resolution: str = "",
                    detail_level: str = ""):
        """
        Layer 3: Quality and detail level

        Args:
            *tags: Quality tags (masterpiece, best quality, etc.)
            resolution: Resolution specification (8K, 4K, etc.)
            detail_level: Detail level
        """
        parts = list(tags)
        if resolution:
            parts.append(resolution)
        if detail_level:
            parts.append(detail_level)
        self.quality.content = ", ".join(parts)
        return self

    def set_composition(self, camera: str = "", lighting: str = "",
                        angle: str = "", depth_of_field: str = "",
                        color_palette: str = ""):
        """
        Layer 4: Composition and camera settings

        Args:
            camera: Camera model/lens
            lighting: Lighting setup
            angle: Camera angle
            depth_of_field: Depth of field
            color_palette: Color palette
        """
        parts = [p for p in [camera, lighting, angle,
                             depth_of_field, color_palette] if p]
        self.composition.content = ", ".join(parts)
        return self

    def set_negative(self, *tags, template: str = None):
        """
        Negative prompt

        Args:
            *tags: Exclusion tags
            template: Template name (general, portrait, landscape, etc.)
        """
        neg_parts = list(tags)
        if template and template in NEGATIVE_PROMPT_TEMPLATES:
            neg_parts.insert(0, NEGATIVE_PROMPT_TEMPLATES[template])
        self.negative = ", ".join(neg_parts)
        return self

    def estimate_tokens(self) -> dict:
        """Estimate token count for each layer"""
        layers = [self.subject, self.style,
                  self.quality, self.composition]
        total = sum(l.estimate_tokens() for l in layers)
        limit = self.TOKEN_LIMITS.get(self.model, 75)
        return {
            "layers": {l.name: l.tokens_estimate for l in layers},
            "total": total,
            "limit": limit,
            "utilization": f"{total / limit * 100:.1f}%",
            "remaining": max(0, limit - total),
        }

    def optimize(self) -> "VisualPromptBuilder":
        """Optimize prompt to fit within token limits"""
        token_info = self.estimate_tokens()
        if token_info["total"] <= token_info["limit"]:
            return self  # No action needed if within limits

        # Reduce from lowest priority layers first
        layers = sorted(
            [self.composition, self.quality, self.style, self.subject],
            key=lambda l: l.priority,
            reverse=True  # Lowest priority first
        )
        excess = token_info["total"] - token_info["limit"]
        for layer in layers:
            if excess <= 0:
                break
            tokens = layer.content.split(", ")
            while len(tokens) > 1 and excess > 0:
                tokens.pop()
                excess -= 1
            layer.content = ", ".join(tokens)
        return self

    def build(self) -> dict:
        """Build the final prompt"""
        positive_parts = [
            l.content for l in [self.subject, self.style,
                                self.quality, self.composition]
            if l.content
        ]
        result = {
            "prompt": ", ".join(positive_parts),
            "negative_prompt": self.negative,
            "model": self.model,
            "token_estimate": self.estimate_tokens(),
        }
        self._history.append(result)
        return result

    def export_history(self, filepath: str):
        """Export prompt history as JSON"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self._history, f, ensure_ascii=False, indent=2)

    def __repr__(self):
        return (f"VisualPromptBuilder(model={self.model}, "
                f"subject='{self.subject.content[:30]}...')")


# Usage example: Japanese temple
prompt = (
    VisualPromptBuilder(model="sdxl")
    .set_subject(
        "ancient Japanese temple",
        details="moss-covered stone steps, wet ground after rain",
        environment="serene space surrounded by cedar forest in the mountains"
    )
    .set_style(
        "photorealistic",
        medium="digital photography",
        era="contemporary"
    )
    .set_quality(
        "8K", "ultra high resolution", "sharp", "highly detailed",
        resolution="8192x4608"
    )
    .set_composition(
        camera="Sony α7R V, 24mm f/1.4",
        lighting="golden hour, soft natural light",
        angle="low angle",
        depth_of_field="deep focus",
        color_palette="subdued greens and gold"
    )
    .set_negative(
        "low quality", "blurry", "distortion", "people", "text",
        template="General (High Quality)"
    )
    .build()
)
print(prompt["prompt"])
print(f"Token utilization: {prompt['token_estimate']['utilization']}")
```

### ASCII Diagram 1: 4-Layer Prompt Framework

```
┌─────────────────────────────────────────────────────┐
│                  Prompt Structure                     │
│                                                     │
│  Layer 1: Subject                [Most important,   │
│  ┌─────────────────────────────────────────────┐    │
│  │ "A woman in a red kimono standing           │    │
│  │  under cherry blossoms"                     │    │
│  └─────────────────────────────────────────────┘    │
│           │                       placed first]     │
│  Layer 2: Style              [Artistic direction]   │
│  ┌─────────────────────────────────────────────┐    │
│  │ "Ukiyo-e style, Hokusai style, woodblock"   │    │
│  └─────────────────────────────────────────────┘    │
│           │                                         │
│  Layer 3: Quality              [Technical quality]  │
│  ┌─────────────────────────────────────────────┐    │
│  │ "masterpiece, best quality, 8K, high detail"│    │
│  └─────────────────────────────────────────────┘    │
│           │                                         │
│  Layer 4: Composition        [Camera/Lighting]      │
│  ┌─────────────────────────────────────────────┐    │
│  │ "golden ratio, natural light, 50mm lens,    │    │
│  │  shallow depth of field"                    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Negative: [Elements to exclude]                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ "low quality, blurry, deformed hands,       │    │
│  │  extra fingers"                             │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘

Token position and influence relationship:
┌──────────────────────────────────────────────────┐
│ Position:  1    10   20   30   40   50   60   75 │
│ Impact: ████████████████████░░░░░░░░░░░░░░░░░░░  │
│         ▲ Subject ▲ Style   ▲ Quality ▲ Comp.   │
│         Critical  Important  Moderate  Suppl.    │
│                                                  │
│ SD1.5:  |←──── 75 token limit ────→|             │
│ SDXL:   |←──── 150 token limit ──────────→|      │
│ Flux:   |←──── 512 token limit ────────────────→ │
└──────────────────────────────────────────────────┘
```

### 1.2 Best Practices for Subject Description

Subjects should be composed of four Ws: "What," "Who," "Where," and "Doing What."

```python
SUBJECT_TEMPLATES = {
    "Portrait": {
        "who": "{gender}, {age group}, {appearance features}",
        "what": "{clothing}, {accessories}, {expression}",
        "where": "{background}, {environment}",
        "doing": "{pose}, {action}",
        "example": "young Japanese woman, long black hair, "
                   "wearing a red silk kimono with golden obi, "
                   "gentle smile, standing under cherry blossoms, "
                   "holding a paper umbrella"
    },
    "Landscape": {
        "what": "{main terrain/structures}",
        "where": "{geographic location}, {season}, {time of day}",
        "details": "{weather}, {atmospheric conditions}, {vegetation}",
        "example": "majestic snow-capped mountain reflected in "
                   "a crystal clear alpine lake, surrounded by "
                   "autumn foliage, early morning mist, "
                   "remote wilderness in Hokkaido"
    },
    "Still Life": {
        "what": "{main objects}, {arrangement}",
        "where": "{table/surface}, {background}",
        "details": "{material texture}, {color}, {texture}",
        "example": "antique ceramic teapot with crackle glaze, "
                   "two yunomi cups, bamboo tea whisk, "
                   "on a weathered wooden tray, "
                   "soft window light from the left"
    },
    "Architecture": {
        "what": "{building type}, {architectural style}",
        "where": "{location}, {surroundings}",
        "details": "{materials}, {decorations}, {condition}",
        "example": "traditional Japanese machiya townhouse, "
                   "wooden lattice facade, noren curtains, "
                   "narrow Kyoto alley, stone pavement, "
                   "potted plants along the entrance"
    },
}
```

---

## 2. Style Specification Techniques

### Code Example 2: Extended Style Keyword Dictionary

```python
STYLE_KEYWORDS = {
    "Photorealistic": {
        "keywords": ["photorealistic", "hyperrealistic", "RAW photo",
                     "8K UHD", "DSLR", "film grain"],
        "camera": ["Canon EOS R5", "Sony α7R V", "Nikon Z9",
                    "Hasselblad X2D", "Fujifilm GFX 100S",
                    "Leica M11"],
        "lens": ["85mm f/1.4", "35mm f/1.8", "50mm f/1.2",
                 "24-70mm f/2.8", "70-200mm f/2.8",
                 "90mm f/2.8 macro"],
        "film_stocks": ["Kodak Portra 400", "Fujifilm Pro 400H",
                        "Ilford HP5 Plus", "Kodak Ektar 100",
                        "CineStill 800T"],
        "techniques": ["shallow depth of field", "bokeh",
                       "lens flare", "chromatic aberration",
                       "motion blur", "long exposure"],
    },
    "Anime": {
        "keywords": ["anime style", "cel shading", "vibrant colors",
                     "detailed eyes"],
        "substyles": {
            "Makoto Shinkai Style": "Makoto Shinkai style, lens flare, "
                       "vivid sky, detailed clouds, "
                       "photorealistic backgrounds",
            "Ghibli Style": "Studio Ghibli style, Hayao Miyazaki, "
                       "hand-painted backgrounds, warm colors, "
                       "whimsical atmosphere",
            "Cyberpunk Anime": "cyberpunk anime, neon lights, "
                                   "dark atmosphere, futuristic city, "
                                   "holographic displays",
            "Shoujo Manga Style": "shoujo manga style, sparkle effects, "
                         "soft pastel colors, floral backgrounds, "
                         "detailed eyes with highlights",
            "90s Anime": "90s anime style, retro anime, "
                           "VHS grain, cel animation, "
                           "Yoshiaki Kawajiri style",
        },
        "quality_boosters": ["detailed anime illustration",
                             "key visual", "official art",
                             "anime masterpiece"],
    },
    "Oil Painting": {
        "keywords": ["oil painting", "canvas texture",
                     "visible brushstrokes", "impasto technique"],
        "artists_by_era": {
            "Renaissance": ["Leonardo da Vinci", "Raphael",
                          "Michelangelo"],
            "Baroque": ["Rembrandt", "Vermeer", "Caravaggio"],
            "Impressionism": ["Claude Monet", "Pierre-Auguste Renoir",
                       "Edgar Degas", "Camille Pissarro"],
            "Post-Impressionism": ["Vincent van Gogh", "Paul Cézanne",
                          "Paul Gauguin", "Georges Seurat"],
            "Contemporary": ["David Hockney", "Gerhard Richter"],
        },
        "techniques": ["alla prima", "glazing", "scumbling",
                       "palette knife", "wet-on-wet"],
    },
    "Watercolor": {
        "keywords": ["watercolor painting", "soft edges",
                     "color bleeding", "wet-on-wet technique"],
        "effects": ["bleeding", "transparency", "paper texture",
                    "granulation", "backwash"],
        "paper_types": ["cold press", "hot press",
                        "rough texture", "Arches paper"],
        "techniques": ["wet-on-wet", "wet-on-dry", "dry brush",
                       "lifting", "salt texture", "splatter"],
    },
    "3D Rendering": {
        "keywords": ["3D render", "octane render",
                     "unreal engine 5", "ray tracing"],
        "software": ["Blender Cycles", "Cinema 4D Redshift",
                     "KeyShot", "V-Ray", "Arnold"],
        "materials": ["subsurface scattering", "PBR materials",
                      "metallic", "glass", "translucent",
                      "iridescent"],
        "lighting_setups": ["HDRI environment", "three-point lighting",
                            "global illumination", "caustics",
                            "volumetric lighting"],
    },
    "Concept Art": {
        "keywords": ["concept art", "digital painting",
                     "matte painting", "detailed illustration"],
        "use_cases": {
            "Game": "game concept art, character design sheet, "
                      "environment concept, prop design",
            "Film": "film concept art, VFX pre-visualization, "
                    "production design, storyboard quality",
            "Book Cover": "book cover illustration, epic composition, "
                        "dramatic lighting, narrative scene",
        },
        "industry_artists": ["Craig Mullins", "Feng Zhu",
                             "Syd Mead", "Ralph McQuarrie",
                             "Sparth", "Maciej Kuciara"],
    },
    "Pixel Art": {
        "keywords": ["pixel art", "16-bit", "retro game style",
                     "sprite art"],
        "resolutions": {
            "8-bit": "NES style, 8-bit, limited palette",
            "16-bit": "SNES style, 16-bit, detailed sprites",
            "32-bit": "PS1 style, early 3D, low poly",
            "modern": "modern pixel art, high detail, "
                      "smooth animation, HD pixels",
        },
    },
    "Isometric": {
        "keywords": ["isometric view", "isometric art",
                     "diorama style", "miniature scene"],
        "applications": ["game assets", "architectural diagrams",
                         "infographics", "urban planning"],
    },
}


def suggest_style_prompt(style_name: str,
                          substyle: str = None) -> str:
    """Suggest keywords matching the style"""
    style = STYLE_KEYWORDS.get(style_name, {})
    keywords = style.get("keywords", [])

    # If substyle is specified
    if substyle:
        substyles = style.get("substyles", {})
        if isinstance(substyles, dict) and substyle in substyles:
            return substyles[substyle]
        elif isinstance(substyles, list) and substyle in substyles:
            return f"{', '.join(keywords[:3])}, {substyle}"

    return ", ".join(keywords[:4])


def build_style_combination(*styles: str) -> str:
    """Build a fusion prompt combining multiple styles"""
    combined = []
    for s in styles:
        kw = STYLE_KEYWORDS.get(s, {}).get("keywords", [])
        combined.extend(kw[:2])
    return ", ".join(combined)


# Usage examples
print(suggest_style_prompt("Photorealistic"))
# → "photorealistic, hyperrealistic, RAW photo, 8K UHD"

print(suggest_style_prompt("Anime", "Makoto Shinkai Style"))
# → "Makoto Shinkai style, lens flare, vivid sky, ..."

print(build_style_combination("Watercolor", "Anime"))
# → "watercolor painting, soft edges, anime style, cel shading"
```

### Code Example 3: Composition Keyword System

```python
COMPOSITION_GUIDE = {
    "Camera Angle": {
        "Bird's Eye View": {
            "prompt": "bird's eye view, top-down perspective",
            "use_case": "Full landscape, cartographic representation, pattern emphasis",
            "emotion": "Objective, omniscient, god's perspective",
        },
        "Low Angle": {
            "prompt": "low angle shot, worm's eye view",
            "use_case": "Building impressiveness, subject's power",
            "emotion": "Awe, dignity, power",
        },
        "Eye Level": {
            "prompt": "eye level, straight-on view",
            "use_case": "Natural perspective, portraits",
            "emotion": "Life-size, familiarity, empathy",
        },
        "Dutch Angle": {
            "prompt": "dutch angle, tilted camera",
            "use_case": "Creating instability, tension",
            "emotion": "Anxiety, confusion, dynamism",
        },
        "Over-the-Shoulder": {
            "prompt": "over-the-shoulder shot",
            "use_case": "Dialogue scenes, subjective viewpoint",
            "emotion": "Immersion, conversational presence",
        },
        "Frontal": {
            "prompt": "frontal view, symmetrical framing",
            "use_case": "Architecture, portraits, products",
            "emotion": "Confrontation, directness, impact",
        },
    },
    "Shot Size": {
        "Extreme Close-Up": {
            "prompt": "extreme close-up, macro shot",
            "use_case": "Texture, eyes, material details",
        },
        "Close-Up": {
            "prompt": "close-up portrait, head shot",
            "use_case": "Expressions, emotional portrayal",
        },
        "Bust Shot": {
            "prompt": "bust shot, chest up, medium close-up",
            "use_case": "Social media profiles, ID photos",
        },
        "Medium": {
            "prompt": "medium shot, waist up",
            "use_case": "Upper body, gestures",
        },
        "Full Shot": {
            "prompt": "full body shot, full length",
            "use_case": "Complete outfit, poses",
        },
        "Wide": {
            "prompt": "wide shot, establishing shot",
            "use_case": "Environment establishment, sense of scale",
        },
        "Panoramic": {
            "prompt": "panoramic view, ultra-wide",
            "use_case": "Grand landscapes, city panoramas",
        },
    },
    "Lighting": {
        "Golden Hour": {
            "prompt": "golden hour, warm sunlight, long shadows",
            "color_temp": "3000-4000K",
            "mood": "Warmth, nostalgia, romantic",
        },
        "Blue Hour": {
            "prompt": "blue hour, twilight, cool ambient light",
            "color_temp": "7000-10000K",
            "mood": "Serenity, mysterious, melancholic",
        },
        "Rembrandt Lighting": {
            "prompt": "Rembrandt lighting, dramatic shadow, "
                      "triangle of light on cheek",
            "setup": "Single light at 45 degrees from the side, slightly above",
            "mood": "Dramatic, depth, classical",
        },
        "Rim Light": {
            "prompt": "rim lighting, backlit, silhouette, "
                      "edge lighting",
            "setup": "Light from behind the subject",
            "mood": "Mysterious, contour emphasis, dramatic",
        },
        "Studio Lighting": {
            "prompt": "studio lighting, softbox, professional, "
                      "beauty lighting",
            "setup": "Three-point lighting (key, fill, back)",
            "mood": "Professional, clean",
        },
        "Neon": {
            "prompt": "neon lighting, cyberpunk glow, "
                      "colorful neon reflections",
            "color_temp": "Multi-color (pink, blue, purple)",
            "mood": "Futuristic, urban, energetic",
        },
        "Chiaroscuro": {
            "prompt": "chiaroscuro, dramatic contrast, "
                      "deep shadows, single light source",
            "setup": "Single strong directional light source",
            "mood": "Dramatic, tense, artistic",
        },
        "Flat Light": {
            "prompt": "flat lighting, even illumination, "
                      "no harsh shadows, overcast daylight",
            "setup": "Overcast sky or large diffuser",
            "mood": "Soft, uniform, fashion magazine style",
        },
    },
    "Composition Rules": {
        "Rule of Thirds": {
            "prompt": "rule of thirds composition",
            "description": "Divide the frame into a 3x3 grid, place subject at intersections",
        },
        "Golden Ratio": {
            "prompt": "golden ratio, fibonacci spiral",
            "description": "1:1.618 ratio, place subject at the spiral's focal point",
        },
        "Symmetry": {
            "prompt": "symmetrical composition, centered",
            "description": "Left-right symmetry, stability and order",
        },
        "Leading Lines": {
            "prompt": "leading lines, depth, perspective lines",
            "description": "Guide the viewer's eye using roads, rivers, railings",
        },
        "Frame Within Frame": {
            "prompt": "frame within frame, natural framing",
            "description": "Surround the subject with windows, arches, tree branches",
        },
        "Diagonal Composition": {
            "prompt": "diagonal composition, dynamic angle",
            "description": "Express movement and energy through diagonal lines",
        },
        "Negative Space": {
            "prompt": "negative space, minimalist composition, "
                      "vast empty space",
            "description": "Make the subject stand out by leveraging empty space",
        },
    },
}


def build_composition_prompt(angle: str = None, shot: str = None,
                              light: str = None, rule: str = None,
                              detailed: bool = False) -> str:
    """
    Assemble a composition prompt

    Args:
        angle: Camera angle name
        shot: Shot size name
        light: Lighting name
        rule: Composition rule name
        detailed: If True, include detailed information
    """
    parts = []
    for category, key in [
        ("Camera Angle", angle),
        ("Shot Size", shot),
        ("Lighting", light),
        ("Composition Rules", rule),
    ]:
        if key and key in COMPOSITION_GUIDE.get(category, {}):
            entry = COMPOSITION_GUIDE[category][key]
            if isinstance(entry, dict):
                parts.append(entry["prompt"])
            else:
                parts.append(entry)
    return ", ".join(parts)


# Usage example
comp = build_composition_prompt(
    angle="Low Angle",
    shot="Wide",
    light="Golden Hour",
    rule="Golden Ratio"
)
print(comp)
# → "low angle shot, worm's eye view, wide shot, establishing shot,
#     golden hour, warm sunlight, long shadows,
#     golden ratio, fibonacci spiral"
```

### ASCII Diagram 2: Visual Guide to Composition Rules

```
Rule of Thirds:              Golden Ratio:
┌───┬───┬───┐              ┌──────┬────┐
│   │   │   │              │      │    │
│   │ ● │   │  ← Place    │      │ ●  │  ← Place
├───┼───┼───┤    subject   │      │    │    subject at
│   │   │   │    at inter- ├──────┼────┤    spiral's
│   │   │   │    sections  │      │    │    focal point
├───┼───┼───┤              └──────┴────┘
│   │   │   │
└───┴───┴───┘

Symmetrical:                 Leading Lines:
┌─────────────┐              ┌─────────────┐
│      |      │              │ \         / │
│      |      │              │  \       /  │
│    __|__    │              │   \     /   │
│   / | \   │              │    \   /    │
│  /  |  \  │              │     \ /     │
│ /   |   \ │              │      ●      │
└─────────────┘              └─────────────┘
Buildings, corridors, etc.   Roads, rivers, eye guidance

Frame Within Frame:          Negative Space:
┌─────────────┐              ┌─────────────┐
│  ┌───────┐  │              │             │
│  │       │  │              │             │
│  │   ●   │  │  ← Frame    │         ●   │  ← Make subject
│  │       │  │    with      │             │    stand out
│  └───────┘  │    windows/  │             │    with wide
│             │    arches    │             │    empty space
└─────────────┘              └─────────────┘

Diagonal:                    Triangle:
┌─────────────┐              ┌─────────────┐
│ ●         / │              │      ●      │
│  \       /  │              │     / \     │
│   \     /   │              │    /   \    │
│    \   /    │              │   /     \   │
│     \ /     │              │  ●───────●  │
│      ●      │              │  Stability  │
└─────────────┘              └─────────────┘
Movement, energy             Balance, stability
```

### 2.1 Color Theory and Prompts

Colors can significantly control the mood of an image when explicitly specified in the prompt.

```python
COLOR_PALETTES = {
    "Warm Colors": {
        "prompt": "warm color palette, reds, oranges, yellows, "
                  "warm tones, cozy atmosphere",
        "mood": "Vitality, passion, warmth, intimacy",
        "hex_samples": ["#FF6B6B", "#FFA07A", "#FFD700",
                        "#FF8C00", "#DC143C"],
    },
    "Cool Colors": {
        "prompt": "cool color palette, blues, teals, purples, "
                  "cool tones, serene atmosphere",
        "mood": "Serenity, intellect, trust, calm",
        "hex_samples": ["#4169E1", "#00CED1", "#6A5ACD",
                        "#4682B4", "#008B8B"],
    },
    "Pastel": {
        "prompt": "pastel color palette, soft colors, muted tones, "
                  "light and airy, gentle hues",
        "mood": "Gentleness, delicacy, dreamlike, lightness",
        "hex_samples": ["#FFB6C1", "#B0E0E6", "#DDA0DD",
                        "#98FB98", "#FFDAB9"],
    },
    "Monochrome": {
        "prompt": "monochrome, black and white, grayscale, "
                  "high contrast, noir",
        "mood": "Classic, dramatic, timeless",
        "hex_samples": ["#000000", "#333333", "#666666",
                        "#999999", "#FFFFFF"],
    },
    "Earth Tones": {
        "prompt": "earth tones, natural colors, browns, greens, "
                  "muted orange, organic palette",
        "mood": "Natural, calm, organic, rustic",
        "hex_samples": ["#8B4513", "#556B2F", "#D2691E",
                        "#BDB76B", "#A0522D"],
    },
    "Neon/Cyber": {
        "prompt": "neon colors, vibrant magenta, electric blue, "
                  "fluorescent green, dark background, glow",
        "mood": "Futuristic, urban, vibrant, technology",
        "hex_samples": ["#FF00FF", "#00FFFF", "#39FF14",
                        "#FF6EC7", "#7B68EE"],
    },
    "Japanese Traditional": {
        "prompt": "traditional Japanese colors, wabi-sabi palette, "
                  "muted indigo, deep vermillion, moss green",
        "mood": "Traditional, wabi-sabi, elegant, Japanese aesthetics",
        "hex_samples": ["#264348", "#C53D43", "#7B8D42",
                        "#F6C555", "#5B4F3E"],
        "named_colors": {
            "Indigo (Ai-iro)": "#264348",
            "Crimson (Beni-iro)": "#C53D43",
            "Fresh Green (Moegi)": "#7B8D42",
            "Golden Yellow (Yamabuki)": "#F6C555",
            "Olive Brown (Mirucha)": "#5B4F3E",
        },
    },
}


def get_color_prompt(palette: str,
                      accent: str = None) -> str:
    """Get color palette prompt"""
    p = COLOR_PALETTES.get(palette, {})
    prompt = p.get("prompt", "")
    if accent:
        prompt += f", accent color: {accent}"
    return prompt
```

---

## 3. Negative Prompt Strategies

### Code Example 4: Negative Prompt Templates (Extended Version)

```python
NEGATIVE_PROMPT_TEMPLATES = {
    "General (High Quality)": (
        "low quality, worst quality, blurry, out of focus, "
        "jpeg artifacts, compression artifacts, watermark, "
        "text, signature, username, logo, "
        "poorly rendered, amateur, unprofessional"
    ),
    "Portrait Photography": (
        "deformed, ugly, bad anatomy, bad proportions, "
        "extra limbs, extra fingers, mutated hands, "
        "poorly drawn hands, poorly drawn face, "
        "disfigured, gross proportions, long neck, "
        "cross-eyed, malformed limbs, "
        "missing arms, missing legs, extra arms, extra legs, "
        "fused fingers, too many fingers, "
        "cloned face, duplicate, morbid"
    ),
    "Landscape Photography": (
        "oversaturated, HDR artifacts, chromatic aberration, "
        "lens flare, overexposed, underexposed, "
        "person, people, human, text, watermark, "
        "power lines, trash, litter, construction"
    ),
    "Anime/Illustration": (
        "3d, realistic, photographic, bad anatomy, "
        "bad hands, missing fingers, extra digit, "
        "fewer digits, cropped, worst quality, "
        "low quality, normal quality, "
        "username, text, error, missing arms"
    ),
    "Architecture/Interior": (
        "people, furniture out of place, distorted walls, "
        "unrealistic proportions, floating objects, "
        "bad perspective, warped lines, "
        "construction equipment, debris, clutter"
    ),
    "Product Photography": (
        "background clutter, shadows on product, "
        "reflections, fingerprints, dust, scratches, "
        "text overlay, watermark, low resolution, "
        "motion blur, off-center, tilted"
    ),
    "Food Photography": (
        "unappetizing, overcooked, burnt, raw, spoiled, "
        "artificial, plastic looking, "
        "dirty plate, messy table, hands, utensils in wrong place, "
        "flash reflection, harsh shadows"
    ),
}

# Model-specific negative prompt recommendations
MODEL_NEGATIVE_DEFAULTS = {
    "sd15": {
        "always_include": (
            "lowres, bad anatomy, bad hands, text, error, "
            "missing fingers, extra digit, fewer digits, "
            "cropped, worst quality, low quality, "
            "normal quality, jpeg artifacts, signature, "
            "watermark, username, blurry"
        ),
        "strength": "Strong effect (essential)",
    },
    "sdxl": {
        "always_include": (
            "low quality, worst quality, blurry, "
            "watermark, text, logo"
        ),
        "strength": "Weaker than SD1.5 (base quality is already higher)",
        "note": "SDXL often produces better results with fewer negatives",
    },
    "sd3": {
        "always_include": "",
        "strength": "Negative prompts not supported",
        "note": "SD3 does not support negative prompts",
    },
    "flux": {
        "always_include": "",
        "strength": "Negative prompts not supported",
        "note": "Flux does not support negative prompts. "
                "Use positive prompts to specify quality",
    },
}


def get_negative_prompt(category: str,
                         model: str = "sdxl",
                         custom_exclusions: list = None) -> str:
    """
    Generate a negative prompt based on category and model

    Args:
        category: Template category
        model: Model to use
        custom_exclusions: Custom exclusion keywords
    """
    # If the model doesn't support negatives
    model_info = MODEL_NEGATIVE_DEFAULTS.get(model, {})
    if not model_info.get("always_include") and model in ["sd3", "flux"]:
        return f"[{model} does not support negative prompts]"

    parts = []
    # Model defaults
    if model_info.get("always_include"):
        parts.append(model_info["always_include"])
    # Category template
    if category in NEGATIVE_PROMPT_TEMPLATES:
        parts.append(NEGATIVE_PROMPT_TEMPLATES[category])
    # Custom exclusions
    if custom_exclusions:
        parts.append(", ".join(custom_exclusions))

    # Remove duplicates
    all_tags = ", ".join(parts).split(", ")
    unique_tags = list(dict.fromkeys(all_tags))
    return ", ".join(unique_tags)


# Usage example
neg = get_negative_prompt("Portrait Photography", "sdxl",
                           ["nsfw", "child", "cartoon"])
print(neg)
```

### 3.1 Advanced Negative Prompt Techniques

```python
class NegativePromptOptimizer:
    """
    Optimization tool for maximizing negative prompt effectiveness

    Principles:
    1. Specific exclusions > abstract exclusions
    2. Exclusions tailored to model weaknesses
    3. Excessive exclusions are counterproductive
    """

    def __init__(self, model: str = "sdxl"):
        self.model = model
        self.exclusions: list[str] = []
        self.priority_map: dict[str, int] = {}

    def add_anatomical_fix(self, body_part: str = "hands"):
        """Fix anatomical issues in human bodies"""
        fixes = {
            "hands": [
                "bad hands", "mutated hands", "extra fingers",
                "fused fingers", "too many fingers",
                "missing fingers", "deformed fingers",
                "poorly drawn hands", "malformed hands",
            ],
            "face": [
                "bad face", "ugly face", "deformed face",
                "cross-eyed", "asymmetric eyes",
                "malformed ears", "double chin",
                "poorly drawn face",
            ],
            "body": [
                "bad anatomy", "bad proportions",
                "extra limbs", "missing limbs",
                "long neck", "short neck",
                "deformed body", "twisted torso",
            ],
            "feet": [
                "bad feet", "extra toes", "missing toes",
                "deformed feet", "poorly drawn feet",
            ],
        }
        self.exclusions.extend(fixes.get(body_part, []))
        return self

    def add_quality_guard(self, level: str = "standard"):
        """Add quality guards"""
        guards = {
            "minimal": ["low quality", "blurry"],
            "standard": [
                "low quality", "worst quality", "blurry",
                "jpeg artifacts", "watermark", "text",
            ],
            "aggressive": [
                "low quality", "worst quality", "blurry",
                "jpeg artifacts", "watermark", "text",
                "logo", "signature", "username",
                "normal quality", "amateur",
                "poorly rendered", "bad composition",
            ],
        }
        self.exclusions.extend(guards.get(level, guards["standard"]))
        return self

    def add_style_guard(self, unwanted_style: str):
        """Exclude unwanted styles"""
        style_negatives = {
            "photorealistic": ["3d render", "realistic",
                               "photograph", "DSLR"],
            "anime": ["anime", "cartoon", "manga",
                      "cel shading", "illustration"],
            "3d": ["3d", "3d render", "CGI", "octane render"],
            "painting": ["painting", "oil painting",
                         "watercolor", "canvas texture"],
        }
        self.exclusions.extend(
            style_negatives.get(unwanted_style, [])
        )
        return self

    def build(self) -> str:
        """Build final negative prompt with duplicates removed"""
        unique = list(dict.fromkeys(self.exclusions))
        return ", ".join(unique)


# Usage example: Negative optimization for portrait photography
neg_optimizer = (
    NegativePromptOptimizer(model="sdxl")
    .add_quality_guard("standard")
    .add_anatomical_fix("hands")
    .add_anatomical_fix("face")
    .add_style_guard("3d")
)
print(neg_optimizer.build())
```

### Code Example 5: Prompt Weighting (SD-Based)

```python
"""
Prompt weighting syntax for Stable Diffusion-based models

Basic syntax:
  (keyword)       → 1.1x weight
  ((keyword))     → 1.21x (1.1²)
  (keyword:1.5)   → 1.5x weight
  (keyword:0.5)   → 0.5x (weaken)
  [keyword]       → 0.9x weight (some tools)

DALL-E 3 does not support weight syntax
→ Express emphasis in natural language

Midjourney weighting:
  subject:: 2 details:: 1  → 2x weight on subject
  --iw 0.5                 → image prompt weight
"""

import re
from dataclasses import dataclass


@dataclass
class WeightedToken:
    """Weighted token"""
    text: str
    weight: float = 1.0

    def to_sd_syntax(self) -> str:
        """Convert to SD-based weight syntax"""
        if self.weight == 1.0:
            return self.text
        return f"({self.text}:{self.weight})"

    def to_mj_syntax(self) -> str:
        """Convert to Midjourney weight syntax"""
        if self.weight == 1.0:
            return self.text
        return f"{self.text}::{self.weight}"

    def to_natural_language(self) -> str:
        """Convert to natural language emphasis for DALL-E 3"""
        if self.weight > 1.3:
            return f"prominently featuring {self.text}"
        elif self.weight > 1.0:
            return f"with emphasis on {self.text}"
        elif self.weight < 0.7:
            return f"with subtle {self.text} in the background"
        elif self.weight < 1.0:
            return f"with slight {self.text}"
        return self.text


class PromptWeightManager:
    """Manage prompt weights"""

    def __init__(self, model: str = "sdxl"):
        self.model = model
        self.tokens: list[WeightedToken] = []

    def add(self, text: str, weight: float = 1.0):
        """Add a weighted token"""
        self.tokens.append(WeightedToken(text, weight))
        return self

    def build(self) -> str:
        """Build a weighted prompt tailored to the model"""
        if self.model in ["sd15", "sdxl"]:
            return ", ".join(t.to_sd_syntax() for t in self.tokens)
        elif self.model == "midjourney":
            return " ".join(t.to_mj_syntax() for t in self.tokens)
        elif self.model == "dalle3":
            return ". ".join(t.to_natural_language()
                            for t in self.tokens)
        else:
            return ", ".join(t.text for t in self.tokens)

    def analyze_weights(self) -> dict:
        """Analyze weight distribution"""
        weights = [t.weight for t in self.tokens]
        return {
            "total_tokens": len(weights),
            "max_weight": max(weights) if weights else 0,
            "min_weight": min(weights) if weights else 0,
            "avg_weight": sum(weights) / len(weights) if weights else 0,
            "emphasized": sum(1 for w in weights if w > 1.0),
            "de_emphasized": sum(1 for w in weights if w < 1.0),
            "warning": ("Weight difference is too large"
                       if weights and max(weights) - min(weights) > 1.5
                       else None),
        }


# Usage example for SD-based models
sd_prompt = (
    PromptWeightManager(model="sdxl")
    .add("beautiful landscape", 1.0)
    .add("cherry blossoms", 1.4)   # Emphasize cherry blossoms
    .add("mount fuji", 1.2)        # Slightly emphasize Mt. Fuji
    .add("sunset", 0.8)            # Slightly suppress sunset
    .add("dramatic clouds", 1.1)   # Slightly emphasize clouds
)
print("SD:", sd_prompt.build())
# → "beautiful landscape, (cherry blossoms:1.4),
#    (mount fuji:1.2), (sunset:0.8), (dramatic clouds:1.1)"

# Usage example for DALL-E 3
dalle_prompt = (
    PromptWeightManager(model="dalle3")
    .add("beautiful landscape", 1.0)
    .add("cherry blossoms", 1.4)
    .add("mount fuji", 1.2)
    .add("sunset", 0.8)
)
print("DALL-E:", dalle_prompt.build())
# → "beautiful landscape. prominently featuring cherry blossoms.
#    with emphasis on mount fuji.
#    with slight sunset"

print(sd_prompt.analyze_weights())
```

### 3.2 High-Precision Weighting with Compel for SD-Based Models

```python
"""
Compel: Official weighting library for diffusers

Provides more accurate token weight control than manual weight syntax.
Directly manipulates weights at the CLIP embedding level.
"""

from diffusers import StableDiffusionXLPipeline
# from compel import Compel, ReturnedEmbeddingsType
import torch


def generate_with_compel_weights():
    """High-precision prompt weighting using Compel"""

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16,
        variant="fp16",
    ).to("cuda")

    # Create Compel instance (for SDXL)
    from compel import Compel, ReturnedEmbeddingsType

    compel = Compel(
        tokenizer=[pipe.tokenizer, pipe.tokenizer_2],
        text_encoder=[pipe.text_encoder, pipe.text_encoder_2],
        returned_embeddings_type=(
            ReturnedEmbeddingsType.PENULTIMATE_HIDDEN_STATES_NON_NORMALIZED
        ),
        requires_pooled=[False, True],
    )

    # Write prompt in Compel syntax
    # +/- for weight adjustment, ++ means 1.1^2 = 1.21x
    prompt = (
        "a beautiful Japanese garden++ with cherry blossoms+++, "
        "koi pond+, stone lantern, "
        "golden hour lighting++, "
        "photorealistic+, 8K resolution"
    )

    negative_prompt = (
        "low quality--, blurry-, watermark-, text-"
    )

    # Convert to embeddings
    conditioning, pooled = compel(prompt)
    neg_conditioning, neg_pooled = compel(negative_prompt)

    # Generate
    image = pipe(
        prompt_embeds=conditioning,
        pooled_prompt_embeds=pooled,
        negative_prompt_embeds=neg_conditioning,
        negative_pooled_prompt_embeds=neg_pooled,
        num_inference_steps=30,
        guidance_scale=7.5,
    ).images[0]

    return image


def compel_prompt_blending():
    """
    Prompt blending with Compel

    Two prompts can be mixed at any ratio.
    Useful for style transfer and concept mixing.
    """
    # Blend syntax examples
    blended_prompts = {
        # 50:50 blend
        "equal_blend": (
            '("oil painting of a castle",'
            ' "watercolor of a castle").blend(0.5, 0.5)'
        ),
        # 70:30 — oil painting dominant
        "oil_dominant": (
            '("oil painting of a castle",'
            ' "watercolor of a castle").blend(0.7, 0.3)'
        ),
        # Concept blend
        "concept_blend": (
            '("a cat", "a dog").blend(0.6, 0.4)'
        ),
        # Triple prompt blend
        "triple_blend": (
            '("sunset", "aurora", "starry night")'
            '.blend(0.5, 0.3, 0.2)'
        ),
    }

    # Conjunction syntax (.and()) — process each prompt independently then combine
    conjunction_prompts = {
        "scene_composition": (
            '("a red sports car", "rainy city street at night")'
            '.and()'
        ),
        "weighted_conjunction": (
            '("a red sports car", 1.5, '
            '"rainy city street at night", 0.8)'
            '.and()'
        ),
    }

    return blended_prompts, conjunction_prompts
```

### ASCII Diagram 3: Model-Specific Prompt Optimization Map

```
┌────────── Stable Diffusion 1.5 ────────┐
│ - Weight syntax (keyword:1.5) available │
│ - Negative prompts highly effective     │
│ - Hybrid of tag-based + natural text    │
│ - Custom vocabulary via LoRA/Textual    │
│   Inversion                             │
│ - Recommended: Short tag lists +        │
│   quality keywords                      │
│ - Limit: 75 tokens (CLIP ViT-L/14)     │
│ - Compel recommended: Higher weight     │
│   precision                             │
└──────────────────────────────────────────┘

┌────────── Stable Diffusion XL ──────────┐
│ - Dual CLIP encoder (OpenCLIP G/14)     │
│ - Supports up to 150 tokens             │
│ - Fewer negatives may work better       │
│ - Resolution conditioning: target_size  │
│   can be specified                      │
│ - Combine with refiner                  │
│ - Recommended: More natural text +      │
│   fewer quality tags                    │
└──────────────────────────────────────────┘

┌────────── SD3 / Flux ──────────────────┐
│ - T5-XXL encoder enables long text     │
│   comprehension                        │
│ - Supports 512+ tokens                 │
│ - Negative prompts not supported       │
│ - Accurate text rendering              │
│ - Detailed natural language is optimal │
│ - Recommended: Detailed natural text   │
│ - Weight syntax: Not supported         │
│   (express in sentences)               │
└─────────────────────────────────────────┘

┌────────── DALL-E 3 ─────────────────────┐
│ - Describe in detailed natural language  │
│ - Weight syntax not supported            │
│ - No negative prompts                    │
│   → Write "without ..." in the prompt    │
│ - GPT-4 internally rewrites the prompt   │
│ - Check via revised_prompt               │
│ - Recommended: Describe the scene in     │
│   detail as prose                        │
│ - Limit: 4,000 characters               │
└──────────────────────────────────────────┘

┌────────── Midjourney ───────────────────┐
│ - Parameters: --ar, --v, --s, --c, --q │
│ - --no for negative specification       │
│ - Short, impactful prompts are effective│
│ - :: for multi-prompt (weight split)    │
│ - --sref for style reference            │
│ - --cref for character reference        │
│ - Recommended: Keywords + parameter     │
│   tuning                                │
│ - Limit: ~350 words                     │
└──────────────────────────────────────────┘
```

---

## 4. Model-Specific Prompt Optimization

### Code Example 6: Natural Language Prompt Construction for DALL-E 3

```python
"""
Since DALL-E 3 has GPT-4 internally rewrite prompts,
detailed natural language descriptions are most effective
rather than tag lists.

Key points:
1. Specific scene descriptions (5W1H)
2. Express negative elements as "without ..." or "should not contain ..."
3. Place style specification at the beginning or end of the text
4. Check revised_prompt to identify drift from intent
"""

from openai import OpenAI


class DALLE3PromptCrafter:
    """Prompt construction optimized for DALL-E 3"""

    def __init__(self):
        self.client = OpenAI()
        self.scene_elements = {}

    def set_scene(self, description: str,
                   time_of_day: str = "",
                   weather: str = "",
                   season: str = ""):
        """Set up the basic scene"""
        self.scene_elements["scene"] = description
        if time_of_day:
            self.scene_elements["time"] = time_of_day
        if weather:
            self.scene_elements["weather"] = weather
        if season:
            self.scene_elements["season"] = season
        return self

    def set_subject(self, description: str,
                     action: str = "",
                     appearance: str = ""):
        """Set up the subject"""
        self.scene_elements["subject"] = description
        if action:
            self.scene_elements["action"] = action
        if appearance:
            self.scene_elements["appearance"] = appearance
        return self

    def set_style(self, style: str,
                   art_direction: str = ""):
        """Set up the style"""
        self.scene_elements["style"] = style
        if art_direction:
            self.scene_elements["art_direction"] = art_direction
        return self

    def set_exclusions(self, *exclusions: str):
        """Set exclusion elements (described in natural language for DALL-E 3)"""
        self.scene_elements["exclusions"] = list(exclusions)
        return self

    def build_natural_prompt(self) -> str:
        """Build a natural language prompt"""
        parts = []

        # Style specification (at the beginning)
        if "style" in self.scene_elements:
            parts.append(
                f"Create a {self.scene_elements['style']} image."
            )
            if "art_direction" in self.scene_elements:
                parts.append(self.scene_elements["art_direction"])

        # Scene description
        if "scene" in self.scene_elements:
            scene = self.scene_elements["scene"]
            time_info = self.scene_elements.get("time", "")
            weather_info = self.scene_elements.get("weather", "")
            season_info = self.scene_elements.get("season", "")

            scene_desc = f"The scene depicts {scene}"
            if time_info:
                scene_desc += f" during {time_info}"
            if season_info:
                scene_desc += f" in {season_info}"
            if weather_info:
                scene_desc += f", with {weather_info}"
            parts.append(scene_desc + ".")

        # Subject description
        if "subject" in self.scene_elements:
            subject = self.scene_elements["subject"]
            action = self.scene_elements.get("action", "")
            appearance = self.scene_elements.get("appearance", "")

            subject_desc = f"The main subject is {subject}"
            if appearance:
                subject_desc += f", {appearance}"
            if action:
                subject_desc += f", {action}"
            parts.append(subject_desc + ".")

        # Exclusion elements
        if "exclusions" in self.scene_elements:
            exclusion_text = ", ".join(
                self.scene_elements["exclusions"]
            )
            parts.append(
                f"The image should not contain {exclusion_text}."
            )

        return " ".join(parts)

    def generate(self, size: str = "1024x1024",
                  quality: str = "hd",
                  style: str = "natural") -> dict:
        """Generate an image"""
        prompt = self.build_natural_prompt()

        response = self.client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality=quality,
            style=style,  # "natural" or "vivid"
            n=1,
        )

        return {
            "url": response.data[0].url,
            "original_prompt": prompt,
            "revised_prompt": response.data[0].revised_prompt,
            "prompt_drift": self._calculate_drift(
                prompt, response.data[0].revised_prompt
            ),
        }

    def _calculate_drift(self, original: str,
                          revised: str) -> dict:
        """Analyze differences between original and revised prompts"""
        orig_words = set(original.lower().split())
        rev_words = set(revised.lower().split())

        added = rev_words - orig_words
        removed = orig_words - rev_words

        return {
            "similarity": len(orig_words & rev_words)
                         / len(orig_words | rev_words),
            "words_added": len(added),
            "words_removed": len(removed),
            "top_additions": list(added)[:10],
        }


# Usage example
crafter = (
    DALLE3PromptCrafter()
    .set_scene(
        "a serene Japanese garden with a koi pond",
        time_of_day="golden hour",
        season="autumn",
        weather="light mist rising from the water"
    )
    .set_subject(
        "an ancient stone lantern",
        appearance="covered in moss, weathered by centuries",
    )
    .set_style(
        "photorealistic",
        art_direction="Shot with a medium format camera, "
                      "shallow depth of field, warm tones, "
                      "the composition follows the golden ratio"
    )
    .set_exclusions("people", "modern objects", "text")
)

print(crafter.build_natural_prompt())
```

### Code Example 7: Midjourney Prompt Construction

```python
class MidjourneyPromptBuilder:
    """
    Prompt construction for Midjourney V6+

    V6 features:
    - More natural language understanding
    - --sref for style reference
    - --cref for character reference
    - --p for personalization
    - --sv for style variation
    """

    ASPECT_RATIOS = {
        "Square": "1:1",
        "Landscape": "16:9",
        "Wide Landscape": "21:9",
        "Portrait": "9:16",
        "Portrait Photo": "2:3",
        "Landscape Photo": "3:2",
        "Cinematic": "2.39:1",
        "Social Story": "9:16",
        "Social Post": "4:5",
    }

    STYLE_PRESETS = {
        "Photography": {
            "keywords": ["photograph", "realistic"],
            "recommended_params": {"--s": 100, "--q": 1},
        },
        "Illustration": {
            "keywords": ["illustration", "digital art"],
            "recommended_params": {"--s": 250, "--q": 1},
        },
        "Anime": {
            "keywords": ["anime style", "--niji 6"],
            "recommended_params": {"--s": 200},
        },
        "Oil Painting": {
            "keywords": ["oil painting", "canvas texture"],
            "recommended_params": {"--s": 300, "--c": 20},
        },
        "Minimal": {
            "keywords": ["minimalist", "clean", "simple"],
            "recommended_params": {"--s": 50, "--c": 0},
        },
        "Fantasy": {
            "keywords": ["fantasy art", "magical", "epic"],
            "recommended_params": {"--s": 400, "--c": 30},
        },
    }

    def __init__(self):
        self.subject = ""
        self.style_keywords: list[str] = []
        self.params: dict[str, any] = {}
        self.multi_prompts: list[tuple[str, float]] = []
        self.no_list: list[str] = []

    def set_subject(self, subject: str):
        """Set the subject"""
        self.subject = subject
        return self

    def set_preset(self, preset_name: str):
        """Apply a style preset"""
        if preset_name in self.STYLE_PRESETS:
            preset = self.STYLE_PRESETS[preset_name]
            self.style_keywords.extend(preset["keywords"])
            self.params.update(preset.get("recommended_params", {}))
        return self

    def set_aspect_ratio(self, ratio_name: str):
        """Set the aspect ratio"""
        if ratio_name in self.ASPECT_RATIOS:
            self.params["--ar"] = self.ASPECT_RATIOS[ratio_name]
        return self

    def set_stylize(self, value: int):
        """Stylize value (0-1000)"""
        self.params["--s"] = max(0, min(1000, value))
        return self

    def set_chaos(self, value: int):
        """Chaos value (0-100) — diversity of variations"""
        self.params["--c"] = max(0, min(100, value))
        return self

    def set_weird(self, value: int):
        """Weird value (0-3000) — eccentricity"""
        self.params["--weird"] = max(0, min(3000, value))
        return self

    def add_style_ref(self, url: str, weight: int = 100):
        """Add a style reference image"""
        self.params["--sref"] = url
        if weight != 100:
            self.params["--sw"] = weight
        return self

    def add_character_ref(self, url: str, weight: int = 100):
        """Add a character reference image"""
        self.params["--cref"] = url
        if weight != 100:
            self.params["--cw"] = weight
        return self

    def add_no(self, *exclusions: str):
        """Add exclusion elements"""
        self.no_list.extend(exclusions)
        return self

    def add_multi_prompt(self, text: str, weight: float = 1.0):
        """Add a multi-prompt (weighted)"""
        self.multi_prompts.append((text, weight))
        return self

    def build(self) -> str:
        """Build the final prompt"""
        parts = []

        # Multi-prompt case
        if self.multi_prompts:
            mp_parts = []
            for text, weight in self.multi_prompts:
                if weight != 1.0:
                    mp_parts.append(f"{text}::{weight}")
                else:
                    mp_parts.append(text)
            parts.append(" ".join(mp_parts))
        else:
            # Standard prompt
            prompt_parts = [self.subject]
            prompt_parts.extend(self.style_keywords)
            parts.append(", ".join(p for p in prompt_parts if p))

        # --no parameter
        if self.no_list:
            parts.append(f"--no {', '.join(self.no_list)}")

        # Other parameters
        for key, value in self.params.items():
            if key != "--no":
                parts.append(f"{key} {value}")

        return " ".join(parts)


# Usage example: Japanese fantasy
mj_prompt = (
    MidjourneyPromptBuilder()
    .set_subject("ancient Japanese shrine floating "
                  "among clouds, torii gates, "
                  "mystical atmosphere")
    .set_preset("Fantasy")
    .set_aspect_ratio("Landscape")
    .set_stylize(500)
    .set_chaos(15)
    .add_no("people", "modern objects", "text")
)
print(mj_prompt.build())

# Multi-prompt example
mj_multi = (
    MidjourneyPromptBuilder()
    .add_multi_prompt("serene Japanese garden", 2.0)
    .add_multi_prompt("cyberpunk neon elements", 0.5)
    .set_aspect_ratio("Landscape")
    .set_stylize(300)
)
print(mj_multi.build())
# → "serene Japanese garden::2.0 cyberpunk neon elements::0.5
#    --ar 16:9 --s 300"
```

---

## 5. Systematic Prompt Debugging and A/B Testing

### Code Example 8: Prompt A/B Testing Framework

```python
import hashlib
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import json


@dataclass
class PromptVariant:
    """Record of a prompt variant"""
    variant_id: str
    prompt: str
    negative_prompt: str = ""
    seed: int = 42
    steps: int = 30
    cfg_scale: float = 7.5
    sampler: str = "DPM++ 2M Karras"
    score: Optional[float] = None
    notes: str = ""
    generation_time: float = 0.0


class PromptABTester:
    """
    Systematically execute A/B tests for prompts

    Principles:
    1. Change only one element at a time
    2. Fix the seed for comparison
    3. Verify reproducibility across multiple seeds
    4. Define evaluation criteria in advance
    """

    def __init__(self, base_prompt: str,
                  base_negative: str = "",
                  output_dir: str = "./ab_test_results"):
        self.base_prompt = base_prompt
        self.base_negative = base_negative
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.variants: list[PromptVariant] = []
        self.test_seeds = [42, 123, 456, 789, 1024]

    def add_variant(self, name: str,
                     prompt_modification: str = None,
                     negative_modification: str = None,
                     **kwargs) -> "PromptABTester":
        """Add a test variant"""
        variant = PromptVariant(
            variant_id=name,
            prompt=prompt_modification or self.base_prompt,
            negative_prompt=(negative_modification
                            or self.base_negative),
            **kwargs
        )
        self.variants.append(variant)
        return self

    def create_comparison_grid(self) -> list[dict]:
        """Generate a comparison grid (variants x seeds)"""
        grid = []
        for variant in self.variants:
            for seed in self.test_seeds:
                grid.append({
                    "variant": variant.variant_id,
                    "prompt": variant.prompt,
                    "negative": variant.negative_prompt,
                    "seed": seed,
                    "steps": variant.steps,
                    "cfg_scale": variant.cfg_scale,
                })
        return grid

    def analyze_results(self) -> dict:
        """Analyze test results"""
        scored = [v for v in self.variants if v.score is not None]
        if not scored:
            return {"error": "No scored variants"}

        ranked = sorted(scored, key=lambda v: v.score, reverse=True)
        return {
            "best_variant": ranked[0].variant_id,
            "best_score": ranked[0].score,
            "ranking": [
                {"id": v.variant_id, "score": v.score,
                 "prompt_preview": v.prompt[:80]}
                for v in ranked
            ],
            "improvement": (
                f"{((ranked[0].score - ranked[-1].score)"
                f" / ranked[-1].score * 100):.1f}%"
                if ranked[-1].score > 0 else "N/A"
            ),
        }

    def export_report(self, filepath: str = None):
        """Export test results report as JSON"""
        if filepath is None:
            filepath = str(
                self.output_dir / "ab_test_report.json"
            )
        report = {
            "base_prompt": self.base_prompt,
            "base_negative": self.base_negative,
            "variants": [
                {
                    "id": v.variant_id,
                    "prompt": v.prompt,
                    "negative": v.negative_prompt,
                    "score": v.score,
                    "notes": v.notes,
                }
                for v in self.variants
            ],
            "analysis": self.analyze_results(),
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return filepath


# Usage example: A/B testing for lighting
tester = PromptABTester(
    base_prompt="portrait of a young woman in a garden, "
                "wearing a white dress, masterpiece, best quality",
    base_negative="low quality, blurry, deformed"
)

# Test lighting variations
for lighting in ["golden hour sunlight",
                  "studio softbox lighting",
                  "overcast diffused light",
                  "dramatic Rembrandt lighting",
                  "neon colored lighting"]:
    tester.add_variant(
        name=f"lighting_{lighting.split()[0]}",
        prompt_modification=(
            f"portrait of a young woman in a garden, "
            f"wearing a white dress, {lighting}, "
            f"masterpiece, best quality"
        ),
    )

grid = tester.create_comparison_grid()
print(f"Number of images to generate: {len(grid)}")
# → Number of images to generate: 25 (5 variants x 5 seeds)
```

### 5.1 Iterative Prompt Improvement Method

```python
class IterativePromptRefiner:
    """
    Workflow for iteratively improving prompts

    Steps:
    1. Generate a baseline image with a minimal prompt (subject only)
    2. Add style
    3. Add quality tags
    4. Add composition
    5. Add negative prompt
    6. Adjust weights
    """

    def __init__(self, subject: str, seed: int = 42):
        self.subject = subject
        self.seed = seed
        self.iterations: list[dict] = []
        self.current_prompt = subject
        self.current_negative = ""

    def step(self, addition: str,
              category: str = "unknown",
              to_negative: bool = False) -> dict:
        """Add one step and record it"""
        if to_negative:
            if self.current_negative:
                self.current_negative += f", {addition}"
            else:
                self.current_negative = addition
        else:
            self.current_prompt += f", {addition}"

        iteration = {
            "step": len(self.iterations) + 1,
            "category": category,
            "added": addition,
            "to_negative": to_negative,
            "full_prompt": self.current_prompt,
            "full_negative": self.current_negative,
        }
        self.iterations.append(iteration)
        return iteration

    def get_comparison_prompts(self) -> list[dict]:
        """Return a list of prompts for comparison across all steps"""
        return [
            {
                "step": it["step"],
                "category": it["category"],
                "prompt": it["full_prompt"],
                "negative": it["full_negative"],
                "seed": self.seed,
            }
            for it in self.iterations
        ]

    def print_evolution(self):
        """Display prompt evolution"""
        for it in self.iterations:
            target = "negative" if it["to_negative"] else "positive"
            print(f"Step {it['step']} [{it['category']}] "
                  f"({target}): +'{it['added']}'")
        print(f"\nFinal prompt: {self.current_prompt}")
        print(f"Final negative: {self.current_negative}")


# Usage example
refiner = IterativePromptRefiner(
    "a majestic samurai standing on a cliff",
    seed=42
)

refiner.step("overlooking a misty valley at dawn",
              category="Environment")
refiner.step("wearing ornate black and gold armor",
              category="Subject Details")
refiner.step("digital painting, concept art",
              category="Style")
refiner.step("masterpiece, highly detailed, 8K",
              category="Quality")
refiner.step("dramatic rim lighting, volumetric fog",
              category="Lighting")
refiner.step("wide shot, epic composition, low angle",
              category="Composition")
refiner.step("low quality, blurry, deformed, watermark",
              category="Quality Guard", to_negative=True)
refiner.step("bad anatomy, extra limbs, bad proportions",
              category="Anatomy", to_negative=True)

refiner.print_evolution()
```

---

## 6. Industry-Specific Prompt Templates

### Code Example 9: Industry-Specific Template System

```python
INDUSTRY_TEMPLATES = {
    "E-Commerce/Product Photography": {
        "template": (
            "{product}, product photography, "
            "clean white background, studio lighting, "
            "commercial photography, sharp focus, "
            "{angle}, {style_modifier}"
        ),
        "variables": {
            "product": "Detailed description of the product",
            "angle": ["front view", "45-degree angle",
                      "flat lay", "lifestyle context"],
            "style_modifier": ["minimalist", "luxury",
                                "vibrant", "organic"],
        },
        "negative": (
            "shadows on product, reflections, dust, "
            "fingerprints, background clutter, text, watermark"
        ),
        "best_practices": [
            "Clearly describe the product's material texture",
            "Choose background to match the product (white/gray/context)",
            "Specify lighting to emphasize the product's shape",
        ],
        "examples": [
            {
                "name": "Wristwatch",
                "prompt": "luxury mechanical watch with silver case "
                          "and dark blue dial, product photography, "
                          "clean dark background, dramatic lighting "
                          "highlighting the case finishing, "
                          "45-degree angle, luxury, "
                          "sharp focus on dial details",
            },
            {
                "name": "Sneakers",
                "prompt": "modern white sneaker with neon accents, "
                          "product photography, clean white background, "
                          "studio lighting, floating in air, "
                          "45-degree angle, dynamic, sharp focus",
            },
        ],
    },
    "Real Estate/Architecture": {
        "template": (
            "{property_type}, {architectural_style}, "
            "architectural photography, {time_of_day}, "
            "{composition}, professional real estate photography"
        ),
        "variables": {
            "property_type": "Description of property type",
            "architectural_style": ["modern", "traditional Japanese",
                                     "minimalist", "industrial"],
            "time_of_day": ["twilight exterior", "bright daylight",
                            "blue hour", "golden hour"],
            "composition": ["wide angle", "symmetrical",
                            "leading lines", "aerial view"],
        },
        "negative": (
            "people, cars, clutter, construction equipment, "
            "distorted perspective, unrealistic proportions"
        ),
    },
    "Food & Beverage": {
        "template": (
            "{dish}, food photography, {plating_style}, "
            "{background}, {lighting}, appetizing, "
            "shallow depth of field"
        ),
        "variables": {
            "dish": "Detailed description of the dish",
            "plating_style": ["rustic plating", "fine dining",
                               "casual", "minimalist"],
            "background": ["dark wood table", "marble surface",
                            "rustic linen", "clean white plate"],
            "lighting": ["natural window light", "warm ambient",
                         "moody dark", "bright and airy"],
        },
        "negative": (
            "unappetizing, overcooked, artificial, "
            "plastic looking, messy, hands, utensils"
        ),
    },
    "Game Development": {
        "template": (
            "{asset_type}, game art, {art_style}, "
            "{view}, {detail_level}, "
            "concept art quality"
        ),
        "variables": {
            "asset_type": ["character design", "environment concept",
                            "weapon design", "creature design",
                            "UI element", "icon set"],
            "art_style": ["stylized", "realistic", "pixel art",
                          "cel shaded", "painterly"],
            "view": ["front/side/back turnaround",
                     "3/4 view", "isometric", "top-down"],
            "detail_level": ["high poly reference",
                              "low poly style", "texture sheet"],
        },
    },
    "Social Media/Marketing": {
        "template": (
            "{content_type}, {brand_mood}, "
            "{color_scheme}, social media ready, "
            "high impact visual, {format}"
        ),
        "variables": {
            "content_type": ["hero image", "product feature",
                              "lifestyle", "quote background",
                              "story visual", "banner"],
            "brand_mood": ["professional", "playful", "luxury",
                           "eco-friendly", "tech-forward"],
            "color_scheme": "Specify according to brand colors",
            "format": ["square 1:1", "portrait 4:5",
                       "landscape 16:9", "story 9:16"],
        },
    },
}


def generate_industry_prompt(industry: str,
                               **variables) -> dict:
    """Generate a prompt from an industry template"""
    template_data = INDUSTRY_TEMPLATES.get(industry, {})
    if not template_data:
        return {"error": f"Industry '{industry}' is not supported"}

    template = template_data["template"]

    # Fill in variables
    for key, value in variables.items():
        template = template.replace(f"{{{key}}}", str(value))

    # Detect unfilled variables
    import re
    missing = re.findall(r'\{(\w+)\}', template)

    return {
        "prompt": template,
        "negative_prompt": template_data.get("negative", ""),
        "missing_variables": missing,
        "best_practices": template_data.get("best_practices", []),
    }


# Usage example: Product photography
result = generate_industry_prompt(
    "E-Commerce/Product Photography",
    product="handcrafted ceramic coffee mug with speckled glaze",
    angle="45-degree angle",
    style_modifier="organic"
)
print(result["prompt"])
```

---

## 7. Comparison Tables

### Comparison Table 1: Effect of Prompt Components

| Component | Impact Level | Description Example | Scope of Influence | Recommended Weight (SD) |
|-----------|-------------|--------------------|--------------------|------------------------|
| **Subject** | Maximum | "woman in red kimono" | Core of generated content | 1.0 (default) |
| **Style** | High | "oil painting, impressionism" | Overall mood/texture | 1.0-1.2 |
| **Quality Tags** | Medium-High | "masterpiece, 8K" | Detail quality | 1.0 |
| **Lighting** | Medium | "golden hour" | Color tone/shadows | 0.8-1.2 |
| **Composition** | Medium | "rule of thirds, low angle" | Layout | 0.8-1.0 |
| **Camera Settings** | Low-Medium | "85mm f/1.4, bokeh" | Depth of field/bokeh | 0.8-1.0 |
| **Negative** | Medium-High | "blurry, deformed" | Eliminating unwanted elements | - |
| **Weighting** | Low-Medium | "(cherry:1.4)" | Emphasis/de-emphasis of specific elements | 0.5-1.5 |
| **Color Specification** | Medium | "warm tones, golden" | Overall color tone | 0.8-1.2 |
| **Texture** | Low | "smooth, rough, grainy" | Surface quality | 0.8-1.0 |

### Comparison Table 2: Model-Specific Prompt Characteristics

| Feature | SD 1.5 | SDXL | SD3 | Flux | DALL-E 3 | Midjourney V6 |
|---------|--------|------|-----|------|----------|---------------|
| **Recommended Format** | Tag list | Tags + natural text | Natural text | Natural text | Detailed natural text | Short keywords |
| **Max Length** | 75 tokens | 150 tokens | 256 tokens | 512 tokens | 4000 chars | ~350 words |
| **Weight Syntax** | (keyword:1.5) | (keyword:1.5) | Limited | None | None | :: |
| **Negative Prompts** | Powerful | Moderately powerful | None | None | None (in-text) | --no |
| **Japanese** | Model-dependent | Model-dependent | Partial | Partial | Supported | Limited |
| **Text Rendering** | Poor | Somewhat poor | Good | Good | Good | Somewhat improved |
| **Compel Support** | Yes | Yes | No | No | No | No |
| **Style Reference** | LoRA/IP-Adapter | LoRA/IP-Adapter | None | None | None | --sref |
| **Quality Tag Effect** | High | Medium | Low | Low | None | --q |

### Comparison Table 3: Lighting Types — Effects and Use Cases

| Lighting Type | Color Temp | Mood | Use Case | Prompt Example |
|---------------|-----------|------|----------|---------------|
| Golden Hour | 3000-4000K | Warm, nostalgic | Portraits, landscapes | golden hour, warm sunlight |
| Blue Hour | 7000-10000K | Serene, mysterious | Urban, landscapes | blue hour, twilight |
| Rembrandt Lighting | - | Dramatic | Portraits | Rembrandt lighting |
| Rim Light | - | Mysterious, contour emphasis | Silhouettes, drama | rim lighting, backlit |
| Studio Lighting | 5500K | Professional | Products, fashion | studio lighting, softbox |
| Neon | Multi-color | Futuristic, urban | Cyberpunk | neon lighting, glow |
| Chiaroscuro | - | Dramatic, tense | Drama, classical | chiaroscuro, deep shadows |
| Flat Light | 6500K | Soft, uniform | Fashion, products | flat lighting, even |

---

## 8. Anti-Patterns

### Anti-Pattern 1: Prompt Overstuffing

```
[Problem]
Cramming in massive amounts of quality tags like
"beautiful amazing stunning gorgeous incredible masterpiece
 best quality ultra detailed 8K HDR award winning..."

[Why It's a Problem]
- Consumes token budget, leaving insufficient space for subject description
- Duplicate keywords have diminishing returns
- The model gets confused, producing images with blurred focus
- Quality tags have less effect on SDXL and newer models

[Correct Approach]
- Limit quality tags to 3-5
- Reserve sufficient tokens for subject and composition description
- Test-generate to verify effectiveness and remove unnecessary tags
- Trust the model's baseline quality
```

### Anti-Pattern 2: Directly Reusing Prompts from Other Models

```
[Problem]
Using Midjourney prompts directly in Stable Diffusion, or
feeding SD tag lists directly into DALL-E 3.

[Why It's a Problem]
- Each model has a different text encoder
  (CLIP, T5, GPT-4, etc.)
- Midjourney-specific parameters (--v, --ar) are meaningless elsewhere
- SD weight syntax is ignored by DALL-E 3
- Optimal prompt format differs by model

[Correct Approach]
- Optimize prompts for each model
- SD-based: Tags + weighting + Compel
- DALL-E 3: Detailed natural language prose
- Midjourney: Short and impactful + parameters
- Flux/SD3: Detailed natural text (no negatives)
```

### Anti-Pattern 3: Over-Reliance on Negative Prompts

```
[Problem]
Listing 100+ words of exclusion specifications in negative prompts.

[Why It's a Problem]
- Negative prompts also have token limits
- Excessive negation can paradoxically activate unwanted concepts
- SD3/Flux don't support negative prompts at all
- Better to improve quality through positive prompts than rely on negatives

[Correct Approach]
- Focus negatives on the most frequent issues (10-20 words)
- First improve positive prompt quality
- Verify the model's negative prompt support
- Add negatives incrementally and verify their effect
```

### Anti-Pattern 4: Comparing Without Fixed Seeds

```
[Problem]
Generating with random seeds while changing prompts and
concluding "this prompt is better."

[Why It's a Problem]
- Cannot determine if differences are from seed or prompt changes
- The same prompt produces vastly different results with different seeds
- No reproducibility, making it impossible to accumulate knowledge

[Correct Approach]
- Always fix seeds during A/B testing
- Verify trends across multiple seeds (at least 5)
- Change only one element at a time
- Record results for comparison
```

### Anti-Pattern 5: Style Specification Without Context Awareness

```
[Problem]
Mixing contradictory styles like "oil painting, watercolor,
digital art, anime style, photorealistic."

[Why It's a Problem]
- Contradictory style specifications confuse the model
- Results become half-baked across all styles
- Intentional style mixing is different from chaotic mixing

[Correct Approach]
- Select one primary style
- Control style mixing ratios intentionally
  (Compel's blend, MJ's :: weight specification)
- Test-generate to verify style consistency
```

---

## 9. FAQ

### Q1: Which is more effective, Japanese or English prompts?

**A:** Generally, **English prompts are recommended**:

- **SD-based:** Training data is English-centric, so English yields higher accuracy
- **DALL-E 3:** Japanese is supported, but English conveys nuances more accurately. Japanese input may be internally converted to English by GPT-4
- **Midjourney:** Only officially supports English
- **Flux:** Multilingual via T5 encoder, but English is best
- **Exceptions:** Japanese-specialized models (Animagine XL, SDXL-Lightning JP, etc.) work effectively with Japanese tags
- **Hybrid strategy:** Conceptualize in Japanese → Translate to English → Input to model is practical

### Q2: What is the optimal prompt length?

**A:** It depends on the model and task:

- **SD 1.5:** 20-40 tokens (75 token limit). Shorter prompts have greater per-token influence
- **SDXL:** 40-80 tokens (150 token limit). Stable even with longer prompts than SD1.5
- **SD3/Flux:** 100-200 tokens. Long text comprehension improved with T5 encoder
- **DALL-E 3:** 100-300 word detailed prose is effective. Too short and GPT-4 rewrites extensively
- **Midjourney:** 20-60 words. Shorter prompts yield more stable styles. V6 improved with longer prompts
- **Principle:** Describe necessary and sufficient information without waste. "The shortest prompt that contains all required elements" is ideal

### Q3: How do you debug prompts?

**A:** Test systematically:

1. **Start with a minimal prompt:** Generate with subject only, verify base quality
2. **Add elements one at a time:** Add in order: style → quality → composition
3. **Fix seeds:** Compare changes using the same seed
4. **Batch generation:** Generate 4-8 images simultaneously to check variation
5. **Incremental negative testing:** Compare: none → basic → detailed
6. **Use the IterativePromptRefiner class** to record evolution

### Q4: How can I prevent DALL-E 3 from rewriting my prompt?

**A:** You cannot completely prevent it, but here are some countermeasures:

- Check `revised_prompt` to identify drift from your intent
- Writing specific, detailed prompts reduces rewriting
- Adding "I NEED to test how the tool works with this exact prompt." at the beginning may suppress rewriting (unofficial technique)
- Using `"natural"` for the API's `style` parameter tends to result in more conservative rewrites

### Q5: Where should LoRA and Textual Inversion trigger words be placed?

**A:** The following placement is recommended:

- **LoRA trigger words:** Place near the beginning of the prompt to maximize influence
- **Textual Inversion tokens:** Incorporate naturally into the subject section
- **Multiple LoRAs:** Lower each trigger word's weight to 0.5-0.8 to prevent interference
- **Note:** If trigger words disrupt the prompt's meaning, separate them using BREAK syntax

### Q6: What is the "BREAK" syntax in prompts?

**A:** BREAK syntax is a prompt separation technique available in SD-based models:

```
[Usage Example]
beautiful landscape, cherry blossoms, mount fuji BREAK
golden hour lighting, dramatic clouds, warm colors BREAK
8K resolution, masterpiece, highly detailed

[Effect]
- Content before and after BREAK is processed as independent token groups
- Each group has independent CLIP embeddings
- Prevents concept mixing in long prompts
- Controls chunk splitting when exceeding 75 tokens

[Note]
- Not available in DALL-E 3, Midjourney, or Flux
- Excessive use leads to unnatural results
```

### Q7: Why do I get different results each time with the same prompt?

**A:** Several factors contribute:

- **Seed:** Different random seeds produce different results (the largest factor)
- **Floating-point arithmetic:** Slight computational errors accumulate depending on GPU environment
- **Model version:** Minor updates can change results
- **Sampler:** Different samplers (DPM++, Euler, etc.) produce different results
- **CFG Scale:** Fine-tuning this value significantly changes output
- **Countermeasure:** Ensure reproducibility with fixed seed + same environment + same parameters

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before proceeding to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently utilized in daily development work. It becomes particularly important during code reviews and architecture design.

---

## 10. Summary Table

| Item | Key Points |
|------|------------|
| **4-Layer Structure** | Describe in priority order: Subject → Style → Quality → Composition |
| **Token Position** | Earlier tokens have greater influence |
| **Negatives** | General template + category-specific + custom exclusions |
| **Weighting** | SD-based: (keyword:weight) / Compel recommended, MJ: ::weight |
| **Model Optimization** | SD=tags, DALL-E=natural text, MJ=short keywords, Flux=natural text |
| **Color Control** | Explicitly specify color palettes, Japanese traditional colors also supported |
| **Language** | English is standard. Japanese-specialized models are exceptions |
| **Debugging** | Minimal prompt → incremental additions → seed-fixed comparison |
| **A/B Testing** | Change 1 element at a time, multiple seeds, record results |
| **Industry Templates** | Optimized templates for e-commerce/real estate/food/gaming/social media |
| **BREAK Syntax** | Token group separation in SD-based models (prevents concept mixing) |
| **Compel** | High-precision weight control for SD-based models, supports blending and conjunction |

---

## Recommended Next Guides

- [../01-image/00-image-generation.md](../01-image/00-image-generation.md) — Practice with actual image generation tools
- [../01-image/01-image-editing.md](../01-image/01-image-editing.md) — Partial prompting with inpainting
- [../02-video/00-video-generation.md](../02-video/00-video-generation.md) — Prompts for video generation

---

## References

1. Oppenlaender, J. (2023). "A Taxonomy of Prompt Modifiers for Text-to-Image Generation." *arXiv*. https://arxiv.org/abs/2204.13988
2. Liu, V. & Chilton, L. B. (2022). "Design Guidelines for Prompt Engineering Text-to-Image Generative Models." *CHI 2022*. https://doi.org/10.1145/3491102.3501825
3. Witteveen, S. & Andrews, M. (2022). "Investigating Prompt Engineering in Diffusion Models." *arXiv*. https://arxiv.org/abs/2211.15462
4. Betker, J. et al. (2023). "Improving Image Generation with Better Captions." *OpenAI Technical Report*. https://cdn.openai.com/papers/dall-e-3.pdf
5. Rombach, R. et al. (2022). "High-Resolution Image Synthesis with Latent Diffusion Models." *CVPR 2022*. https://arxiv.org/abs/2112.10752
6. Midjourney Documentation. "Prompts." https://docs.midjourney.com/docs/prompts
7. Stability AI. "Stable Diffusion XL Documentation." https://stability.ai/stable-diffusion
8. Black Forest Labs. "Flux.1 Model Documentation." https://blackforestlabs.ai/
