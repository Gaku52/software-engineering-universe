# Design Tools -- Canva AI, Adobe Firefly, Figma AI

> Compare the features of major design platforms with integrated AI capabilities from a workflow perspective, and explain practical methods for efficiently creating professional deliverables even for non-designers

## What You Will Learn in This Chapter

1. **AI Features of Each Tool** -- Core capabilities and strengths of Canva Magic Studio, Adobe Firefly, and Figma AI
2. **Workflow Integration** -- How to leverage AI at each stage: planning, design, feedback, and delivery
3. **Prompt Design and Customization** -- Prompt techniques and brand unification methods for achieving intended outputs


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Upscaling -- Real-ESRGAN, Super Resolution](./02-upscaling.md)

---

## 1. AI Features of Each Tool

### 1.1 Feature Map

```
Design Tool AI Feature Map

  Canva Magic Studio          Adobe Firefly              Figma AI
  +------------------+       +------------------+       +------------------+
  | Magic Design     |       | Text to Image    |       | Auto Layout AI   |
  | (Auto template   |       | (Text-to-image   |       | (Layout          |
  |  generation)     |       |  generation)     |       |  suggestions)    |
  +------------------+       +------------------+       +------------------+
  | Magic Edit       |       | Generative Fill  |       | Component Suggest|
  | (AI image editing)|      | (Generative fill)|       | (Component       |
  |                  |       |                  |       |  suggestions)    |
  +------------------+       +------------------+       +------------------+
  | Magic Write      |       | Text Effects     |       | Content Reel     |
  | (AI text gen)    |       | (Text decoration)|       | (Bulk content)   |
  +------------------+       +------------------+       +------------------+
  | Magic Eraser     |       | Generative Expand|       | Variable Suggest |
  | (Object removal) |       | (Image expansion)|       | (Auto variable   |
  |                  |       |                  |       |  configuration)  |
  +------------------+       +------------------+       +------------------+
  | Background Remover|       | Structure Ref   |       | Prototype AI     |
  | (Background      |       | (Structure       |       | (Prototype       |
  |  removal)        |       |  reference gen)  |       |  assistance)     |
  +------------------+       +------------------+       +------------------+

  Target Users:
  Canva    = Non-designers, marketers, small businesses
  Firefly  = Professional designers, photographers
  Figma AI = UI/UX designers, engineers
```

### 1.2 Overall Workflow

```
AI Utilization in the Design Workflow

  1. Planning        2. Design           3. Review          4. Delivery
  +----------+     +----------+       +----------+      +----------+
  | AI for   |     | AI for   |       | AI for   |      | AI for   |
  | brain-   | --> | first    | --->  | variation| ---> | resizing |
  | storming |     | draft    |       | genera-  |      | format   |
  | ideas    |     | template |       | tion     |      | convert  |
  |          |     | selection|       |          |      |          |
  +----------+     +----------+       +----------+      +----------+
  |Canva:     |    |Firefly:   |     |Canva:     |    |Canva:     |
  | Magic     |    | Text to   |     | Magic     |    | Resize    |
  | Write     |    | Image     |     | Design    |    | & Magic   |
  |           |    |Figma AI:  |     |           |    | Switch    |
  |           |    | Auto      |     |           |    |           |
  |           |    | Layout    |     |           |    |           |
  +-----------+    +-----------+     +-----------+    +-----------+
```

### 1.3 Technology Evolution Timeline

```
AI Design Tool Evolution History

2020 --- Canva: Added basic background removal feature
         Adobe: Integrated Neural Filters into Photoshop (beta)
         Figma: Introduced Smart Selection

2021 --- Canva: Released Magic Resize
         Adobe: Neural Filters official release, Super Resolution
         Figma: Auto Layout v3, Interactive Components

2022 --- Canva: Magic Write (AI text generation), Text to Image
         Adobe: Firefly project announced
         Figma: Component Properties, Variable Modes
         Microsoft: Released Designer (DALL-E integration)

2023 --- Canva: Released Magic Studio (integrated AI suite)
         Adobe: Firefly official release, Generative Fill in Photoshop
         Figma: AI feature preview, First Draft
         Google: Integrated Gemini into Workspace

2024 --- Canva: Dream Lab (high-quality image generation), Magic Expand
         Adobe: Firefly 3 (Generative Match, Structure Reference)
         Figma: Expanded AI features, Dev Mode improvements
         Penpot: Added AI features to open source

2025 --- Canva: Magic Design v3 (multi-page support)
         Adobe: Firefly 4 (video generation support)
         Figma: AI Prototyping, Design System Intelligence
         All tools: Multimodal AI integration becomes standard
```

### 1.4 AI Design Tool Architecture

```
Internal Structure of AI Design Tools

┌─────────────────────────────────────────────────┐
│                 User Interface                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Template  │  │ Editor   │  │ Preview  │      │
│  │ Browser   │  │ Canvas   │  │ Panel    │      │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘      │
│        └────────────┼────────────┘              │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │       AI Orchestration Layer              │   │
│  │  ┌────────┐ ┌────────┐ ┌────────────┐   │   │
│  │  │Prompt  │ │Context │ │Brand       │   │   │
│  │  │Parsing │ │Under-  │ │Guidelines  │   │   │
│  │  │Engine  │ │standing│ │Engine      │   │   │
│  │  │        │ │Engine  │ │            │   │   │
│  │  └───┬────┘ └───┬────┘ └──────┬─────┘   │   │
│  │      └──────────┼───────────┘           │   │
│  │                 ▼                        │   │
│  │  ┌──────────────────────────────────┐   │   │
│  │  │      AI Model Dispatcher          │   │   │
│  │  │  Image Gen | Edit | Text | Suggest│   │   │
│  │  └──────────────────────────────────┘   │   │
│  └──────────────────────────────────────────┘   │
│                     ▼                            │
│  ┌──────────────────────────────────────────┐   │
│  │          Backend AI Services              │   │
│  │  Diffusion Models | LLM | Vision Models  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 1.5 Detailed Pricing Comparison

| Item | Canva Free | Canva Pro | Adobe CC | Figma Starter | Figma Pro |
|------|-----------|-----------|----------|--------------|-----------|
| Monthly fee | $0 | ~$13 | ~$55+ | $0 | $15/person |
| AI image generation | 50/month | 500/month | 250 credits/month | -- | -- |
| AI editing | Limited | Unlimited | Included | Basic features only | Full features |
| Storage | 5GB | 1TB | 100GB+ | Unlimited | Unlimited |
| Brand kit | 1 | 100 | -- | -- | Team shared |
| API access | -- | Supported | Supported | -- | Supported |
| Team features | -- | 5+ people | Included | 2 people | Unlimited |
| Commercial use | Limited | All allowed | All allowed | Allowed | Allowed |
| IP indemnification | -- | -- | Yes | -- | -- |

---

## 2. Canva Magic Studio in Practice

### 2.1 Template Generation with Magic Design

```
Prompt Example: Auto-generation of SNS Posts

  Input:
    Purpose: Instagram post
    Tone: Modern, minimal
    Theme: New product launch announcement
    Brand color: #2563EB (blue)
    Text: "New Collection Arrival | Spring 2026"

  Magic Design generates:
  +----------------------------------+
  |  [AI-generated image: product]   |
  |                                  |
  |      New Collection Arrival      |
  |      Spring 2026                 |
  |                                  |
  |  #NewCollection #Spring2026      |
  +----------------------------------+
  -> Select from 5-10 variations -> Customize
```

### 2.2 Utilizing Magic Edit

```
Magic Edit Workflow

  Original Image            Instruction          Result
  +------------+         +-----------+    +------------+
  | [Product   |  --->  | Change     |    | [Product   |
  |  photo]    |         | background | -> |  photo]    |
  | (white bg) |         | to a cafe  |    | (cafe bg)  |
  |            |         | table      |    |            |
  +------------+         +-----------+    +------------+

  Prompt examples:
  - "Change the background to a warm-toned cafe table"
  - "Add a coffee cup next to the product"
  - "Change the overall tone to a film photography style"
```

### 2.3 Bulk Create

```python
# Bulk generate variations with Canva API (pseudo-code)
import canva_api

template_id = "DAF-xxxxx"  # Template ID

# Bulk generation from CSV data
products = [
    {"name": "Product A", "price": "$29.99", "image_url": "https://..."},
    {"name": "Product B", "price": "$39.99", "image_url": "https://..."},
    {"name": "Product C", "price": "$19.99", "image_url": "https://..."},
]

for product in products:
    design = canva_api.create_from_template(
        template_id=template_id,
        data={
            "product_name": product["name"],
            "price_text": product["price"],
            "product_image": product["image_url"],
        }
    )
    design.export(format="png", quality="high")
    print(f"Generation complete: {product['name']}")
```

### 2.4 Integrated Brand Kit Management

```python
# Canva Brand Kit auto-configuration and validation
class CanvaBrandManager:
    """Management class for maintaining brand consistency"""

    def __init__(self, api_key: str, brand_id: str):
        self.client = canva_api.Client(api_key=api_key)
        self.brand_id = brand_id
        self.brand_kit = None

    def load_brand_kit(self) -> dict:
        """Load the brand kit"""
        self.brand_kit = self.client.get_brand_kit(self.brand_id)
        return {
            "colors": {
                "primary": self.brand_kit.primary_color,
                "secondary": self.brand_kit.secondary_colors,
                "accent": self.brand_kit.accent_color,
            },
            "fonts": {
                "heading": self.brand_kit.heading_font,
                "body": self.brand_kit.body_font,
                "caption": self.brand_kit.caption_font,
            },
            "logos": [logo.url for logo in self.brand_kit.logos],
            "guidelines": self.brand_kit.guidelines_text,
        }

    def validate_design(self, design_id: str) -> dict:
        """Verify whether a design complies with brand guidelines"""
        design = self.client.get_design(design_id)
        issues = []

        # Color check
        used_colors = design.get_used_colors()
        allowed_colors = set(self.brand_kit.all_colors)
        unauthorized = used_colors - allowed_colors
        if unauthorized:
            issues.append({
                "type": "color_violation",
                "severity": "warning",
                "detail": f"Unauthorized colors used: {unauthorized}",
                "suggestion": f"Allowed colors: {allowed_colors}"
            })

        # Font check
        used_fonts = design.get_used_fonts()
        allowed_fonts = set(self.brand_kit.all_fonts)
        unauthorized_fonts = used_fonts - allowed_fonts
        if unauthorized_fonts:
            issues.append({
                "type": "font_violation",
                "severity": "error",
                "detail": f"Unauthorized fonts used: {unauthorized_fonts}",
                "suggestion": f"Allowed fonts: {allowed_fonts}"
            })

        # Logo placement check
        logo_placements = design.get_logo_placements()
        for placement in logo_placements:
            if placement.clear_space < self.brand_kit.min_clear_space:
                issues.append({
                    "type": "logo_clearspace",
                    "severity": "error",
                    "detail": f"Insufficient logo clear space: {placement.clear_space}px",
                    "suggestion": f"Minimum clear space: {self.brand_kit.min_clear_space}px"
                })

        return {
            "is_compliant": len([i for i in issues if i["severity"] == "error"]) == 0,
            "issues": issues,
            "score": max(0, 100 - len(issues) * 15),
        }

    def batch_generate_with_brand(
        self,
        template_id: str,
        data_list: list[dict],
        output_formats: list[str] = ["png"],
        sizes: list[str] = None,
    ) -> list[dict]:
        """Bulk generation with brand kit applied"""
        results = []
        for data in data_list:
            design = self.client.create_from_template(
                template_id=template_id,
                data=data,
                brand_kit_id=self.brand_id,  # Auto-apply brand kit
            )

            # Validation
            validation = self.validate_design(design.id)
            if not validation["is_compliant"]:
                # Attempt auto-fix
                design = self._auto_fix_brand_issues(design, validation["issues"])

            # Export in multiple sizes
            exports = []
            target_sizes = sizes or ["instagram_post", "facebook_post", "twitter_post"]
            for size in target_sizes:
                for fmt in output_formats:
                    export = design.export(
                        format=fmt,
                        size_preset=size,
                        quality="high"
                    )
                    exports.append({
                        "size": size,
                        "format": fmt,
                        "url": export.url,
                    })

            results.append({
                "design_id": design.id,
                "data": data,
                "validation": validation,
                "exports": exports,
            })

        return results

    def _auto_fix_brand_issues(self, design, issues):
        """Auto-fix brand violations"""
        for issue in issues:
            if issue["type"] == "color_violation":
                # Replace with nearest brand color
                design.replace_colors_to_nearest_brand()
            elif issue["type"] == "font_violation":
                # Replace with brand fonts
                design.replace_fonts_to_brand()
        return design


# Usage example
brand_mgr = CanvaBrandManager(
    api_key="your-api-key",
    brand_id="brand-123"
)

brand_mgr.load_brand_kit()

# Bulk generation of SNS posts
products_data = [
    {"title": "Spring New Collection", "subtitle": "2026 Spring", "image": "spring.jpg"},
    {"title": "Summer Sale Now On", "subtitle": "Up to 50% OFF", "image": "summer.jpg"},
    {"title": "Autumn Limited Items", "subtitle": "Limited Quantity", "image": "autumn.jpg"},
]

results = brand_mgr.batch_generate_with_brand(
    template_id="template-456",
    data_list=products_data,
    output_formats=["png", "jpg"],
    sizes=["instagram_post", "instagram_story", "facebook_cover"],
)

for r in results:
    print(f"Design {r['design_id']}: Score={r['validation']['score']}")
    for export in r["exports"]:
        print(f"  {export['size']} ({export['format']}): {export['url']}")
```

### 2.5 Copywriting with Magic Write

```
Effective Prompt Structure for Magic Write

┌────────────────────────────────────────────────────┐
│ Level 1: Basic Prompt                              │
│ "Write a product introduction catchphrase"         │
│ -> Generic, personality-less copy is generated      │
├────────────────────────────────────────────────────┤
│ Level 2: Context-aware Prompt                      │
│ "Write 3 Instagram post catchphrase options for    │
│  a spring dress ($69.99) targeting women in their  │
│  20s"                                              │
│ -> Copy tailored to the target audience is generated│
├────────────────────────────────────────────────────┤
│ Level 3: Brand Voice-specified Prompt              │
│ "Brand voice: Elegant yet approachable             │
│  Tone: Bright and positive                         │
│  Prohibited expressions: 'dirt cheap', 'bargain    │
│  bin' and similar discount-heavy language           │
│  Required elements: Material quality, comfort       │
│  CTA: Drive traffic to e-commerce site             │
│  Character count: 80-120 characters                │
│  Hashtags: 5"                                      │
│ -> High-quality copy matching the brand is generated│
└────────────────────────────────────────────────────┘
```

---

## 3. Adobe Firefly in Practice

### 3.1 Effective Prompts for Text to Image

```
Prompt Structure Template:

  [Subject] + [Style] + [Composition] + [Lighting] + [Color Tone] + [Quality Modifiers]

  Example:
  "minimalist product photography of a ceramic coffee mug,
   on a marble surface, soft natural window light,
   warm neutral tones, studio quality, 4K"

  Structure Reference:
  - Upload a reference image -> Generate different content with the same composition
  - Effective for maintaining brand consistency

  Style Reference:
  - Apply the color tone and atmosphere of a reference image to a new image
  - Unify brand visual identity
```

### 3.2 Generative Fill

```
Photoshop + Firefly Workflow

  Step 1: Create a selection
  +------------------+
  | [Portrait photo]  |
  | [---Selection---] |  <- Select the background area
  +------------------+

  Step 2: Enter prompt
  "Tokyo night cityscape, neon lights, post-rain reflections"

  Step 3: AI generation
  +------------------+
  | [Portrait photo]  |
  | [Tokyo night bg]  |  <- Natural composite
  +------------------+

  Use cases:
  - Changing product image backgrounds
  - Extending subjects (expanding the edges of an image with generation)
  - Removing unwanted objects and generating background
```

### 3.3 Firefly API Integration

```python
# Adobe Firefly API (pseudo-code)
import adobe_firefly

client = adobe_firefly.Client(api_key="your-api-key")

# Text to Image
result = client.generate_image(
    prompt="modern office workspace, clean desk, laptop, indoor plant, "
           "natural light from large window, minimalist style",
    style="photo",
    aspect_ratio="16:9",
    content_class="photo",        # photo / art
    visual_intensity=4,            # 1-10
    negative_prompt="cluttered, dark, messy",
    num_variations=4,
)

for i, image in enumerate(result.images):
    image.save(f"workspace_v{i+1}.png")

# Generative Fill
result = client.generative_fill(
    image_path="product.jpg",
    mask_path="mask.png",          # White=generation area, Black=preserve area
    prompt="wooden table surface with soft shadows",
)
result.image.save("product_on_wood.jpg")
```

### 3.4 Firefly and Creative Cloud Integration Workflow

```python
# Adobe Creative Cloud integration workflow
class AdobeCreativeWorkflow:
    """Integrated pipeline for Firefly + Photoshop + Illustrator"""

    def __init__(self, client_id: str, client_secret: str):
        self.auth = self._authenticate(client_id, client_secret)
        self.firefly = FireflyClient(self.auth)
        self.photoshop = PhotoshopAPIClient(self.auth)
        self.illustrator = IllustratorAPIClient(self.auth)

    def _authenticate(self, client_id, client_secret):
        """Adobe IMS OAuth authentication"""
        import requests
        response = requests.post(
            "https://ims-na1.adobelogin.com/ims/token/v3",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
                "scope": "openid,creative_sdk,firefly_api",
            }
        )
        return response.json()["access_token"]

    def generate_product_hero(
        self,
        product_image_path: str,
        scene_prompt: str,
        output_sizes: dict = None,
    ) -> dict:
        """Product hero image generation pipeline

        1. Remove background from product image
        2. Generate scene with Firefly
        3. Composite and retouch with Photoshop
        4. Export in multiple sizes
        """
        # Step 1: Background removal
        cutout = self.photoshop.remove_background(
            input_path=product_image_path,
            output_format="png",
            refine_edge=True,      # Precise edge processing
            edge_feather=1.5,      # Natural feathering
        )

        # Step 2: Generate scene background with Firefly
        background = self.firefly.generate_image(
            prompt=scene_prompt,
            style="photo",
            aspect_ratio="16:9",
            content_class="photo",
            visual_intensity=5,
            num_variations=4,       # Generate 4 patterns
        )

        # Step 3: Composite with Photoshop API
        composites = []
        for i, bg in enumerate(background.images):
            composite = self.photoshop.composite_images(
                layers=[
                    {"type": "background", "image": bg.url},
                    {
                        "type": "foreground",
                        "image": cutout.url,
                        "position": "center",
                        "scale": 0.6,
                        "shadow": {
                            "type": "drop",
                            "opacity": 30,
                            "angle": 135,
                            "distance": 15,
                            "blur": 25,
                        },
                    },
                ],
                adjustments=[
                    {"type": "color_match", "reference": "background"},
                    {"type": "lighting_match", "intensity": 0.7},
                ],
            )
            composites.append(composite)

        # Step 4: Export in multiple sizes
        sizes = output_sizes or {
            "hero_desktop": {"width": 1920, "height": 1080},
            "hero_mobile": {"width": 750, "height": 1334},
            "thumbnail": {"width": 400, "height": 400},
            "og_image": {"width": 1200, "height": 630},
        }

        final_outputs = {}
        best_composite = composites[0]  # Or manual selection

        for name, size in sizes.items():
            output = self.photoshop.resize_and_crop(
                image=best_composite.url,
                width=size["width"],
                height=size["height"],
                crop_mode="smart",   # AI-optimized cropping
                format="jpg",
                quality=92,
            )
            final_outputs[name] = output.url

        return {
            "variations": [c.url for c in composites],
            "final_outputs": final_outputs,
        }

    def batch_style_transfer(
        self,
        source_images: list[str],
        style_reference: str,
        strength: float = 0.7,
    ) -> list[str]:
        """Batch style unification using Style Reference

        Unify all brand photos to the same tone
        """
        results = []
        for img_path in source_images:
            result = self.firefly.style_transfer(
                source_image=img_path,
                style_reference=style_reference,
                strength=strength,
                preserve_structure=True,    # Preserve composition
                preserve_color_range=0.3,   # Color change range
            )
            results.append(result.url)
        return results


# Usage example: Product image creation for an e-commerce site
workflow = AdobeCreativeWorkflow(
    client_id="your-client-id",
    client_secret="your-client-secret"
)

# Generate product hero image
hero = workflow.generate_product_hero(
    product_image_path="product_sneaker.jpg",
    scene_prompt="urban street at golden hour, wet asphalt reflection, "
                 "cinematic lighting, shallow depth of field, warm tones",
    output_sizes={
        "banner": {"width": 1920, "height": 600},
        "square": {"width": 1080, "height": 1080},
        "story": {"width": 1080, "height": 1920},
    }
)

print(f"Variations: {len(hero['variations'])} generated")
for name, url in hero["final_outputs"].items():
    print(f"  {name}: {url}")
```

### 3.5 Practical Techniques for Generative Expand

```
Generative Expand Usage Patterns

Pattern 1: Aspect Ratio Conversion
  ┌──────────┐
  │ Original  │ 1:1 (Instagram)
  │ 1080x1080│
  └──────────┘
       ↓ Generative Expand
  ┌────────────────────────┐
  │ [←expand] Original [expand→] │ 16:9 (YouTube thumbnail)
  │    1920 x 1080         │
  └────────────────────────┘

Pattern 2: Adding Margins for Print
  ┌──────────┐         ┌────────────────┐
  │ [Design]  │  →     │    [Margin]     │
  │          │         │  ┌──────────┐  │
  │          │         │  │ [Design]  │  │ Bleed margins
  │          │         │  └──────────┘  │ generated by AI
  └──────────┘         └────────────────┘

Pattern 3: Panoramic Expansion
  ┌──────────┐
  │ [Landscape│
  │  photo]  │
  └──────────┘
       ↓ Generative Expand left and right
  ┌──────────────────────────────────────┐
  │ [←AI expand] [Original landscape] [expand→] │
  │            Ultra-wide panorama        │
  └──────────────────────────────────────┘

Prompt Tips:
- Provide specific instructions for what to generate in the expanded area
- Add "continue the same style and lighting"
- Give instructions mindful of compositional balance
- Avoid: Just saying "expand" tends to produce unnatural results
```

---

## 4. Figma AI in Practice

### 4.1 Auto Layout AI

```
Figma AI Design Assistance

  /auto-layout command:
  Automatically apply optimal Auto Layout to selected elements
  ├── Padding estimation
  ├── Gap estimation
  └── Alignment estimation

  /suggest-component command:
  Suggest similar components from the design system
  ├── Existing button style candidates
  ├── Card layout candidates
  └── Navigation pattern candidates
```

### 4.2 Prototype Assistance

```
  Design Screen                AI Suggestions
  +------------------+         +------------------+
  | [Login Screen]    |  --->   | Interactions:    |
  |                  |         | - Button→Home    |
  | Email: [____]    |         | - Error display  |
  | Pass:  [____]    |         | - Loading        |
  | [Login]          |         | - Forgot password|
  +------------------+         +------------------+
```

### 4.3 Automation with the Figma API

```python
# Retrieve and manipulate design data with the Figma API
import requests
import json

class FigmaDesignAutomation:
    """Design process automation using the Figma API"""

    BASE_URL = "https://api.figma.com/v1"

    def __init__(self, access_token: str):
        self.headers = {"X-FIGMA-TOKEN": access_token}

    def get_file(self, file_key: str, depth: int = 2) -> dict:
        """Retrieve the structure of a Figma file"""
        response = requests.get(
            f"{self.BASE_URL}/files/{file_key}",
            headers=self.headers,
            params={"depth": depth}
        )
        response.raise_for_status()
        return response.json()

    def get_components(self, file_key: str) -> list[dict]:
        """Retrieve the list of components in a file"""
        response = requests.get(
            f"{self.BASE_URL}/files/{file_key}/components",
            headers=self.headers,
        )
        data = response.json()
        return [
            {
                "key": comp["key"],
                "name": comp["name"],
                "description": comp.get("description", ""),
                "containing_frame": comp.get("containing_frame", {}).get("name", ""),
            }
            for comp in data.get("meta", {}).get("components", [])
        ]

    def get_design_tokens(self, file_key: str) -> dict:
        """Retrieve design tokens (Variables)"""
        response = requests.get(
            f"{self.BASE_URL}/files/{file_key}/variables/local",
            headers=self.headers,
        )
        data = response.json()

        tokens = {"colors": {}, "spacing": {}, "typography": {}}
        for var_id, var in data.get("meta", {}).get("variables", {}).items():
            name = var["name"]
            resolved = var.get("resolvedType", "")
            values = var.get("valuesByMode", {})

            if resolved == "COLOR":
                # Retrieve RGBA values
                for mode_id, value in values.items():
                    if isinstance(value, dict) and "r" in value:
                        hex_color = self._rgba_to_hex(value)
                        tokens["colors"][name] = hex_color
            elif resolved == "FLOAT":
                for mode_id, value in values.items():
                    tokens["spacing"][name] = value

        return tokens

    def export_components_as_svg(
        self,
        file_key: str,
        node_ids: list[str],
        output_dir: str = "./exports",
    ) -> list[str]:
        """Export components as SVG"""
        import os
        os.makedirs(output_dir, exist_ok=True)

        ids_param = ",".join(node_ids)
        response = requests.get(
            f"{self.BASE_URL}/images/{file_key}",
            headers=self.headers,
            params={
                "ids": ids_param,
                "format": "svg",
                "svg_include_id": True,
                "svg_simplify_stroke": True,
            }
        )
        data = response.json()

        exported = []
        for node_id, url in data.get("images", {}).items():
            if url:
                svg_response = requests.get(url)
                filename = f"{output_dir}/{node_id.replace(':', '-')}.svg"
                with open(filename, "w") as f:
                    f.write(svg_response.text)
                exported.append(filename)

        return exported

    def generate_design_audit_report(self, file_key: str) -> dict:
        """Generate a quality audit report for a design file"""
        file_data = self.get_file(file_key, depth=4)
        components = self.get_components(file_key)

        # Page analysis
        pages = file_data.get("document", {}).get("children", [])
        report = {
            "file_name": file_data.get("name", "Unknown"),
            "pages": len(pages),
            "components_count": len(components),
            "issues": [],
            "recommendations": [],
        }

        # Component usage analysis
        detached_instances = 0
        unnamed_layers = 0
        inconsistent_spacing = set()

        for page in pages:
            self._analyze_node(
                page, report, detached_instances,
                unnamed_layers, inconsistent_spacing
            )

        # Report generation
        if unnamed_layers > 10:
            report["issues"].append({
                "type": "naming",
                "severity": "warning",
                "message": f"{unnamed_layers} unnamed layers found",
                "fix": "Please give meaningful names to layers",
            })

        if detached_instances > 0:
            report["issues"].append({
                "type": "consistency",
                "severity": "error",
                "message": f"{detached_instances} detached instances found",
                "fix": "Please re-link to main components",
            })

        report["score"] = max(0, 100 - len(report["issues"]) * 10)
        return report

    def _rgba_to_hex(self, rgba: dict) -> str:
        """Convert RGBA values to hex color code"""
        r = int(rgba["r"] * 255)
        g = int(rgba["g"] * 255)
        b = int(rgba["b"] * 255)
        return f"#{r:02x}{g:02x}{b:02x}"

    def _analyze_node(self, node, report, detached, unnamed, spacing):
        """Recursively analyze nodes"""
        if node.get("name", "").startswith("Frame ") or node.get("name", "").startswith("Group "):
            unnamed += 1
        children = node.get("children", [])
        for child in children:
            self._analyze_node(child, report, detached, unnamed, spacing)


# Usage example
figma = FigmaDesignAutomation(access_token="your-figma-token")

# Retrieve design tokens
tokens = figma.get_design_tokens(file_key="abc123xyz")
print("Color tokens:")
for name, color in tokens["colors"].items():
    print(f"  {name}: {color}")

# Quality audit report
report = figma.generate_design_audit_report(file_key="abc123xyz")
print(f"\nDesign audit score: {report['score']}/100")
for issue in report["issues"]:
    print(f"  [{issue['severity']}] {issue['message']}")
```

### 4.4 AI Utilization in Design Systems

```
The Role of AI in Design Systems

┌──────────────────────────────────────────────────────────┐
│                    Design System                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Foundation    │  │ Components   │  │ Patterns     │  │
│  │ ─────────    │  │ ──────────   │  │ ────────     │  │
│  │ Color Tokens │  │ Button       │  │ Navigation   │  │
│  │ Typography   │  │ Card         │  │ Form Layout  │  │
│  │ Spacing      │  │ Input        │  │ Dashboard    │  │
│  │ Elevation    │  │ Modal        │  │ Settings     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └─────────────────┼─────────────────┘           │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │              AI Intelligence Layer                  │  │
│  │                                                    │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │  │
│  │  │Component    │ │Accessibility│ │Consistency  │ │  │
│  │  │Recommenda-  │ │Check        │ │Checker      │ │  │
│  │  │tion Engine  │ │             │ │             │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ │  │
│  │                                                    │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │  │
│  │  │Responsive   │ │Dark Mode    │ │Multilingual │ │  │
│  │  │Layout       │ │Auto-gen     │ │Layout       │ │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Tool Integration and Pipeline Construction

### 5.1 Multi-tool Workflow

```python
# Production pipeline integrating multiple tools
class DesignPipeline:
    """Integrated pipeline for Canva + Firefly + Figma"""

    def __init__(self, config: dict):
        self.canva = CanvaBrandManager(
            api_key=config["canva_api_key"],
            brand_id=config["canva_brand_id"],
        )
        self.adobe = AdobeCreativeWorkflow(
            client_id=config["adobe_client_id"],
            client_secret=config["adobe_client_secret"],
        )
        self.figma = FigmaDesignAutomation(
            access_token=config["figma_token"],
        )

    def product_launch_campaign(
        self,
        product_name: str,
        product_images: list[str],
        brand_guidelines: dict,
    ) -> dict:
        """Bulk generate all design assets for a product launch campaign

        1. Generate high-quality product images with Firefly
        2. Bulk generate SNS post assets with Canva
        3. Retrieve LP components from Figma's design system
        """
        results = {"hero_images": [], "sns_assets": [], "lp_components": []}

        # Phase 1: Product hero images (Adobe Firefly)
        for img in product_images:
            hero = self.adobe.generate_product_hero(
                product_image_path=img,
                scene_prompt=brand_guidelines.get(
                    "hero_scene",
                    "clean minimalist studio, soft lighting"
                ),
            )
            results["hero_images"].append(hero)

        # Phase 2: SNS assets (Canva)
        sns_data = []
        for i, hero in enumerate(results["hero_images"]):
            sns_data.append({
                "product_name": product_name,
                "hero_image": hero["final_outputs"]["square"],
                "campaign_text": f"{product_name} Now Available",
                "cta_text": "Learn more via the link in our profile",
            })

        results["sns_assets"] = self.canva.batch_generate_with_brand(
            template_id=brand_guidelines["sns_template_id"],
            data_list=sns_data,
            sizes=["instagram_post", "instagram_story",
                   "facebook_post", "twitter_post"],
        )

        # Phase 3: LP components (Figma)
        components = self.figma.get_components(
            file_key=brand_guidelines["figma_file_key"]
        )
        lp_components = [
            c for c in components
            if "product" in c["name"].lower() or "hero" in c["name"].lower()
        ]
        results["lp_components"] = lp_components

        return results


# Execute the pipeline
pipeline = DesignPipeline(config={
    "canva_api_key": "canva-key",
    "canva_brand_id": "brand-123",
    "adobe_client_id": "adobe-id",
    "adobe_client_secret": "adobe-secret",
    "figma_token": "figma-token",
})

campaign = pipeline.product_launch_campaign(
    product_name="EcoBreeze Sneakers",
    product_images=["sneaker_front.jpg", "sneaker_side.jpg"],
    brand_guidelines={
        "hero_scene": "urban rooftop at sunset, concrete and plants",
        "sns_template_id": "template-789",
        "figma_file_key": "xyz789abc",
    },
)

print(f"Hero images: {len(campaign['hero_images'])} patterns")
print(f"SNS assets: {len(campaign['sns_assets'])} sets")
print(f"LP components: {len(campaign['lp_components'])} items")
```

---

## 6. Tool Comparison Table

| Feature | Canva | Adobe Firefly | Figma AI |
|---------|:-----:|:------------:|:--------:|
| Text-to-image generation | Magic Media | Text to Image | -- |
| AI image editing | Magic Edit | Generative Fill | -- |
| Background removal | Supported | Supported | -- |
| Auto template generation | Magic Design | -- | Auto Layout |
| Text generation | Magic Write | -- | -- |
| UI component suggestions | -- | -- | Supported |
| Prototype AI | -- | -- | Supported |
| API integration | Canva API | Firefly API | Figma API |
| Pricing | Free to ~$13/month | Included in Creative Cloud | Free to $15/month |
| Target users | General / Non-designers | Professional designers | UI/UX designers |

| Use Case | Recommended Tool | Reason |
|----------|-----------------|--------|
| SNS post images | Canva | Templates + bulk generation |
| Product image background changes | Adobe Firefly | High-quality Generative Fill |
| Website UI design | Figma AI | Component management + prototype |
| Presentation materials | Canva | Rich templates, easy operation |
| Photo editing and compositing | Adobe Firefly | Photoshop integration, pro quality |
| Design system construction | Figma AI | Variable management, component library |

---

## 6. Anti-patterns

### Anti-pattern 1: Using AI-generated Output As-is

```
BAD:
  Generate image with AI -> Use as-is ignoring brand guidelines
  -> Inconsistent color tones, non-unified fonts, brand image collapse

GOOD:
  1. Pre-configure brand kit (colors, fonts, logos)
  2. Use AI generation as a base
  3. Adjust to match brand guidelines
  4. Publish after team review
```

### Anti-pattern 2: Trying to Do Everything with One Tool

```
BAD:
  UI design with Canva -> Cannot handle responsive design
  SNS images with Figma -> Weak template features

GOOD: Use the right tool for the job
  Planning and ideation       -> Canva (Magic Write)
  UI/UX design                -> Figma AI
  Photo editing / product images -> Adobe Firefly + Photoshop
  SNS posts / marketing assets   -> Canva (Magic Design)
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input values"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced pattern
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

    print(f"Inefficient version: {slow_time:.4f} sec")
    print(f"Efficient version:   {fast_time:.6f} sec")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm time complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 7. FAQ

### Q1. What about the copyright of AI-generated images?

**A.** Terms differ by tool. **Canva**: Commercial use allowed. Copyright of generated images belongs to the user. **Adobe Firefly**: Commercial use allowed. Training data consists only of Adobe Stock and licensed materials (low risk of copyright infringement). IP indemnification provided. **Figma**: Copyright does not apply to AI-suggested layouts themselves. Always check the terms of service regularly for all tools.

### Q2. How can AI help maintain design consistency?

**A.** (1) Pre-register a **brand kit** in each tool (color palette, fonts, logos). (2) Use Adobe Firefly's **Style Reference** to unify color tones and atmosphere. (3) Use Canva's **Brand Kit** feature to standardize templates. (4) Use Figma's **Design Tokens** to manage component variables. Providing these constraints as input during AI generation maintains consistency.

### Q3. What criteria should non-designers use when choosing a design tool?

**A.** (1) **Canva has the lowest learning curve** (template-based with intuitive operation). (2) Canva is sufficient for SNS and presentation materials. (3) If web/app UI design is needed, choose Figma (easy collaboration with engineers). (4) If high-quality image editing is needed, choose Adobe Firefly (Photoshop integration). Start with Canva and add other tools as needed -- this is the most practical approach.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently utilized in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Canva | For non-designers. Rapid design creation with templates + AI |
| Adobe Firefly | For professionals. Photoshop integration, high-quality image generation and editing |
| Figma AI | For UI/UX. Component suggestions, Auto Layout, prototype assistance |
| Tool selection | Decide based on use case and target user skill level |
| Brand consistency | Unify with Brand Kit, Style Reference, and Design Tokens |
| AI generation caveats | Do not use as-is; adjust to match brand guidelines |

---

## Recommended Next Reads

- [Video Editing](../02-video/01-video-editing.md) -- AI-powered video editing tools
- [Animation](../02-video/02-animation.md) -- AI animation generation
- [Ethical Considerations](../03-3d/03-ethical-considerations.md) -- Copyright and ethics of AI-generated content

---

## References

1. **Canva Design School** -- https://www.canva.com/designschool/ -- Official learning resources for Canva
2. **Adobe Firefly Documentation** -- https://www.adobe.com/products/firefly.html -- Official Firefly documentation
3. **Figma Learn** -- https://help.figma.com/ -- Official Figma help center
