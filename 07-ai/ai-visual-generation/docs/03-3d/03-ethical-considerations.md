# Ethical Considerations -- Copyright, Deepfakes, and Responsibility for AI-Generated Content

> Systematically analyze the ethical challenges posed by AI image and video generation technologies from the perspectives of copyright, portrait rights, deepfakes, bias, and environmental impact, and present guidelines and practical decision-making criteria for responsible AI use

## What You Will Learn in This Chapter

1. **Copyright and Intellectual Property Issues** -- Copyright attribution of AI-generated content, rights management of training data, scope of fair use, and legal trends across countries
2. **Deepfakes and Portrait Rights** -- Technical detection methods for face synthesis, legal regulations, and countermeasure frameworks against non-consensual generation
3. **Responsible AI Use in Practice** -- Content authentication (C2PA), ensuring transparency, bias countermeasures, and organizational guideline development
4. **Technical Safeguards** -- Digital watermarking, NSFW filters, content moderation, and audit log implementation patterns
5. **Incident Response** -- Response frameworks when ethical issues arise, legal procedures, and reputation management


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Virtual Try-On](./02-virtual-try-on.md)

---

## 1. Ethical Issues Map for AI-Generated Content

### 1.1 Overall Structure of Issues

```
Ethical Issues of AI-Generated Content

  Legal Issues               Social Issues              Technical Issues
  +-----------+             +-----------+            +-----------+
  | Copyright |             | Deepfakes  |            | Bias      |
  | Attribution|            |            |            | Reproduc- |
  +-----------+             +-----------+            | tion      |
  | Portrait  |             | Misinfor-  |            +-----------+
  | Rights /  |             | mation     |            | Environ-  |
  | Publicity |             | Spread     |            | mental    |
  +-----------+             +-----------+            | Impact    |
  | Trademark |             | Non-       |            | (Compute) |
  | Infringe- |             | Consensual |            +-----------+
  | ment Risk |             | Generation |            | Transpar- |
  +-----------+             +-----------+            | ency /    |
  | Training  |             | Cultural   |            | Explain-  |
  | Data      |             | Appro-     |            | ability   |
  | Rights    |             | priation   |            +-----------+
  +-----------+             +-----------+            | Detection |
                                                     | Difficulty|
                                                     | (Authen-  |
                                                     | ticity)   |
                                                     +-----------+
```

### 1.2 Stakeholder Relationship Diagram

```
Stakeholders and Scope of Impact

  [AI Development Companies]
       |
       | Training data collection
       v
  [Artists / Creators] <-- Concerns about unauthorized use of works for training
       |
       | Using AI tools
       v
  [Content Producers] --> Publishing AI-generated content
       |
       v
  [Consumers / General Public] <-- Difficulty judging authenticity
       |
       v
  [Platforms] <-- Moderation responsibility
       |
       v
  [Regulatory Authorities] <-- Legislation and guideline development
```

### 1.3 Risk Level Matrix

```
  Impact
  High |  Portrait Rights    Deepfakes           Child Exploitation
       |  Violation          (Social Disruption)  Images (Illegal)
       |  (Personal Harm)
       |
  Mid  |  Copyright          Bias                Misinformation
       |  Infringement       Reproduction        Spread
       |  (Rights Holder     (Promoting           (Trust Erosion)
       |   Harm)              Discrimination)
       |
  Low  |  Style Imitation    Environmental       Lack of
       |  (Gray Zone)        Impact              Transparency
       |                     (Indirect Impact)   (Trust Erosion)
       +-----------------------------------------------
       Low              Mid               High
                     Frequency
```

### 1.4 Ethical Risk Assessment Framework

```python
# Quantitative ethical risk assessment framework

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import json
from datetime import datetime


class RiskLevel(Enum):
    CRITICAL = 4    # Requires immediate action (illegal content, etc.)
    HIGH = 3        # Requires action within 24 hours
    MEDIUM = 2      # Consider countermeasures within 1 week
    LOW = 1         # Continue monitoring
    NEGLIGIBLE = 0  # No risk


class RiskCategory(Enum):
    COPYRIGHT = "Copyright Infringement"
    PORTRAIT_RIGHTS = "Portrait Rights Violation"
    DEEPFAKE = "Deepfake"
    BIAS = "Bias / Discrimination"
    MISINFORMATION = "Misinformation"
    CHILD_SAFETY = "Child Safety"
    PRIVACY = "Privacy"
    ENVIRONMENTAL = "Environmental Impact"
    CULTURAL_APPROPRIATION = "Cultural Appropriation"
    TRADEMARK = "Trademark Infringement"


@dataclass
class EthicalRiskAssessment:
    """Ethical risk assessment for AI-generated content"""

    category: RiskCategory
    severity: RiskLevel
    likelihood: RiskLevel
    description: str
    affected_parties: list[str] = field(default_factory=list)
    mitigations: list[str] = field(default_factory=list)
    legal_references: list[str] = field(default_factory=list)
    assessed_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def risk_score(self) -> int:
        """Risk score = Severity x Likelihood"""
        return self.severity.value * self.likelihood.value

    @property
    def priority(self) -> str:
        score = self.risk_score
        if score >= 12:
            return "IMMEDIATE_ACTION"
        elif score >= 6:
            return "HIGH_PRIORITY"
        elif score >= 3:
            return "MONITOR"
        else:
            return "ACCEPTABLE"


class EthicalRiskEvaluator:
    """Comprehensively evaluate the ethical risk of generation requests"""

    def __init__(self):
        self.assessments: list[EthicalRiskAssessment] = []
        self.thresholds = {
            "block": 12,       # Block generation at or above this value
            "review": 6,       # Human review required at or above this value
            "flag": 3,         # Flag at or above this value
        }

    def evaluate_request(self, prompt: str, config: dict) -> dict:
        """Comprehensive ethical evaluation of a generation request"""
        self.assessments = []

        # Evaluate risk for each category
        self._assess_copyright_risk(prompt, config)
        self._assess_portrait_risk(prompt, config)
        self._assess_deepfake_risk(prompt, config)
        self._assess_bias_risk(prompt, config)
        self._assess_child_safety(prompt, config)
        self._assess_misinformation_risk(prompt, config)

        # Overall judgment
        max_score = max(a.risk_score for a in self.assessments) if self.assessments else 0

        return {
            "overall_risk_score": max_score,
            "decision": self._make_decision(max_score),
            "assessments": [
                {
                    "category": a.category.value,
                    "risk_score": a.risk_score,
                    "priority": a.priority,
                    "mitigations": a.mitigations,
                }
                for a in sorted(self.assessments, key=lambda x: x.risk_score, reverse=True)
            ],
            "requires_human_review": max_score >= self.thresholds["review"],
        }

    def _make_decision(self, max_score: int) -> str:
        if max_score >= self.thresholds["block"]:
            return "BLOCKED"
        elif max_score >= self.thresholds["review"]:
            return "REQUIRES_REVIEW"
        elif max_score >= self.thresholds["flag"]:
            return "FLAGGED"
        return "APPROVED"

    def _assess_copyright_risk(self, prompt: str, config: dict):
        """Evaluate copyright risk"""
        # Detect specific artist name references
        artist_keywords = self._detect_artist_references(prompt)
        severity = RiskLevel.HIGH if artist_keywords else RiskLevel.LOW
        likelihood = RiskLevel.HIGH if artist_keywords else RiskLevel.LOW

        self.assessments.append(EthicalRiskAssessment(
            category=RiskCategory.COPYRIGHT,
            severity=severity,
            likelihood=likelihood,
            description=f"Artist references: {artist_keywords}" if artist_keywords else "No specific artist references",
            mitigations=[
                "Remove specific artist names from prompt",
                "Use licensed models (Adobe Firefly)",
                "Perform similarity check",
            ] if artist_keywords else [],
        ))

    def _assess_portrait_risk(self, prompt: str, config: dict):
        """Evaluate portrait rights risk"""
        real_person_indicators = self._detect_real_person_references(prompt)
        if real_person_indicators:
            has_consent = config.get("consent_obtained", False)
            severity = RiskLevel.CRITICAL if not has_consent else RiskLevel.LOW
            self.assessments.append(EthicalRiskAssessment(
                category=RiskCategory.PORTRAIT_RIGHTS,
                severity=severity,
                likelihood=RiskLevel.HIGH,
                description=f"Real person reference detected: {real_person_indicators}",
                affected_parties=real_person_indicators,
                mitigations=[
                    "Obtain written consent from the individual",
                    "Change to a fictional character",
                    "Enter into a publicity rights license agreement",
                ],
            ))

    def _assess_deepfake_risk(self, prompt: str, config: dict):
        """Evaluate deepfake risk"""
        face_swap_keywords = ["face swap", "顔入れ替え", "顔交換", "フェイススワップ"]
        is_face_swap = any(kw in prompt.lower() for kw in face_swap_keywords)
        if is_face_swap:
            self.assessments.append(EthicalRiskAssessment(
                category=RiskCategory.DEEPFAKE,
                severity=RiskLevel.CRITICAL,
                likelihood=RiskLevel.HIGH,
                description="Face swap related prompt detected",
                mitigations=["Block generation", "Notify administrator"],
            ))

    def _assess_bias_risk(self, prompt: str, config: dict):
        """Evaluate bias risk"""
        stereotype_patterns = self._detect_stereotype_patterns(prompt)
        if stereotype_patterns:
            self.assessments.append(EthicalRiskAssessment(
                category=RiskCategory.BIAS,
                severity=RiskLevel.MEDIUM,
                likelihood=RiskLevel.HIGH,
                description=f"Stereotypical expressions detected: {stereotype_patterns}",
                mitigations=[
                    "Add prompts that explicitly specify diversity",
                    "Generate multiple times and verify diversity of results",
                ],
            ))

    def _assess_child_safety(self, prompt: str, config: dict):
        """Evaluate child safety risk"""
        child_risk_keywords = self._detect_child_risk(prompt)
        if child_risk_keywords:
            self.assessments.append(EthicalRiskAssessment(
                category=RiskCategory.CHILD_SAFETY,
                severity=RiskLevel.CRITICAL,
                likelihood=RiskLevel.HIGH,
                description="Risk content related to children detected",
                mitigations=["Block immediately", "Record logs", "Consider legal reporting"],
            ))

    def _assess_misinformation_risk(self, prompt: str, config: dict):
        """Evaluate misinformation risk"""
        news_context = any(kw in prompt.lower() for kw in ["ニュース", "報道", "速報", "breaking"])
        if news_context:
            self.assessments.append(EthicalRiskAssessment(
                category=RiskCategory.MISINFORMATION,
                severity=RiskLevel.HIGH,
                likelihood=RiskLevel.HIGH,
                description="AI image generation in news/reporting context detected",
                mitigations=[
                    "Attach explicit AI-generated label",
                    "Attach C2PA metadata",
                    "Consider prohibiting AI image use for reporting purposes",
                ],
            ))

    def _detect_artist_references(self, prompt: str) -> list[str]:
        """Detect artist name references from prompt (simplified implementation)"""
        # In production, matching against an artist database is required
        known_artists = ["banksy", "warhol", "picasso", "monet", "ghibli",
                        "宮崎駿", "鳥山明", "村上隆", "草間彌生"]
        found = [a for a in known_artists if a.lower() in prompt.lower()]
        return found

    def _detect_real_person_references(self, prompt: str) -> list[str]:
        """Detect references to real persons (simplified implementation)"""
        # In production, a celebrity database combined with NER model is required
        return []  # Skipped for simplified implementation

    def _detect_stereotype_patterns(self, prompt: str) -> list[str]:
        """Detect stereotypical patterns"""
        patterns = []
        role_gender_map = {
            "看護師": "Evokes female image",
            "nurse": "Evokes female image",
            "CEO": "Evokes male image",
            "engineer": "Evokes male image",
            "secretary": "Evokes female image",
        }
        for role, bias in role_gender_map.items():
            if role.lower() in prompt.lower():
                patterns.append(f"{role} → {bias}")
        return patterns

    def _detect_child_risk(self, prompt: str) -> list[str]:
        """Detect child-related risks (details omitted)"""
        return []  # Specific detection logic not disclosed for security reasons
```

---

## 2. Copyright and Intellectual Property

### 2.1 Copyright Attribution of AI-Generated Content

```python
# Copyright judgment framework for AI-generated content (pseudocode)

class CopyrightAnalyzer:
    """Copyright risk analysis for AI-generated content"""

    def analyze_copyright_status(self, content_metadata):
        """Analyze the copyright status of generated content"""
        result = {
            "human_authorship": self._assess_human_contribution(content_metadata),
            "training_data_risk": self._assess_training_data_risk(content_metadata),
            "similarity_risk": self._assess_similarity(content_metadata),
            "jurisdiction_rules": self._get_jurisdiction_rules(content_metadata),
        }
        return result

    def _assess_human_contribution(self, metadata):
        """Evaluate human creative contribution"""
        # US Copyright Office criteria (2023 guidance):
        # AI-generated portions are not eligible for copyright protection
        # Human creative choices and arrangements are the basis for copyright
        contribution_factors = {
            "prompt_complexity": metadata.get("prompt_length", 0) > 100,
            "human_editing": metadata.get("post_editing", False),
            "creative_selection": metadata.get("selection_from_variants", False),
            "artistic_arrangement": metadata.get("composition_design", False),
        }
        score = sum(contribution_factors.values()) / len(contribution_factors)
        return {
            "score": score,
            "likely_copyrightable": score >= 0.5,
            "note": "The greater the human creative contribution, the higher the likelihood of copyright protection"
        }

    def _assess_training_data_risk(self, metadata):
        """Evaluate training data related risks"""
        model_risks = {
            "adobe_firefly": "Low (licensed data only)",
            "stable_diffusion": "Medium (LAION-5B: some rights unprocessed)",
            "midjourney": "Medium (includes web scraping)",
            "dall_e_3": "Medium-Low (filtered)",
        }
        model_name = metadata.get("model", "unknown")
        return model_risks.get(model_name, "Unknown (investigation required)")


# Legal positions by country
copyright_by_jurisdiction = {
    "Japan": {
        "ai_output_copyright": "Protected as a work if human creative contribution is recognized",
        "training_data": "Copyright Act Article 30-4: Use for machine learning is generally lawful",
        "key_cases": "2024 Cultural Council AI Copyright Guidelines",
        "note": "Distinction between the training stage and the generation/use stage",
    },
    "United States": {
        "ai_output_copyright": "Purely AI-generated content is not eligible for copyright protection",
        "training_data": "Under discussion within the scope of fair use",
        "key_cases": "Thaler v. Perlmutter (2023), "
                     "NYT v. OpenAI (2023)",
        "note": "Human creative authorship is required",
    },
    "EU": {
        "ai_output_copyright": "Transparency obligations defined by AI Act (2024)",
        "training_data": "Opt-out rights guaranteed (DSM Directive Art.4)",
        "key_cases": "EU AI Act (enacted 2024)",
        "note": "Generative AI has summary disclosure obligations",
    },
    "China": {
        "ai_output_copyright": "Beijing Internet Court (2023): Copyright recognized for AI-generated content",
        "training_data": "Regulated by Interim Measures for Generative AI Management (2023)",
        "key_cases": "Li v. AI Image Generation Platform (2023)",
        "note": "Trending toward granting copyright when human intellectual input is recognized",
    },
    "South Korea": {
        "ai_output_copyright": "AI Basic Act (2024) establishes regulatory framework",
        "training_data": "Copyright law amendments under discussion",
        "key_cases": "Korea Copyright Commission AI Guidelines (2024)",
        "note": "Under consideration with human creative involvement as a requirement",
    },
    "United Kingdom": {
        "ai_output_copyright": "CDPA 1988 s.9(3): Copyright exists for computer-generated works",
        "training_data": "Expansion of TDM exceptions under discussion",
        "key_cases": "UK Intellectual Property Office AI Copyright Consultation (2022)",
        "note": "Unique legal doctrine where 'the person who made the necessary arrangements' is considered the author",
    },
}
```

### 2.2 Training Data Rights Issues

```python
# Training data rights check flow

def check_training_data_compliance(model_info):
    """Verify model training data compliance"""

    checklist = {
        "licensed_data": {
            "question": "Is the training data licensed?",
            "adobe_firefly": True,   # Adobe Stock only
            "stable_diffusion": False,  # LAION-5B (web scraping)
            "dall_e_3": "Partial",      # Filtered
        },
        "opt_out_respected": {
            "question": "Are creator opt-outs respected?",
            "robots_txt": "Some models ignore robots.txt",
            "do_not_train": "Meta tag support in progress",
            "spawning_ai": "Opt-out available via Have I Been Trained?",
        },
        "attribution": {
            "question": "Is there attribution to training sources?",
            "current_state": "Almost all models lack attribution",
            "ideal": "Disclosure of data sources used for training",
        },
    }
    return checklist


# Opt-out via HTML meta tags
opt_out_html = """
<!-- Request exclusion from AI training -->
<meta name="robots" content="noai, noimageai">

<!-- Exclusion via robots.txt -->
# robots.txt
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /
"""
```

### 2.3 Copyright Similarity Check Implementation

```python
# Copyright similarity check for AI-generated images

import hashlib
from pathlib import Path
from typing import Optional


class CopyrightSimilarityChecker:
    """Inspect AI-generated images for copyright infringement risk"""

    def __init__(self, reference_db_path: str):
        """
        Args:
            reference_db_path: Path to the copyrighted works feature database
        """
        self.reference_db = self._load_reference_db(reference_db_path)
        self.similarity_threshold = 0.85  # Classified as similar at or above this value
        self.warning_threshold = 0.70     # Warning at or above this value

    def check_image(self, generated_image_path: str) -> dict:
        """Copyright similarity check for a generated image"""

        # 1. Fast screening with perceptual hash
        phash = self._compute_perceptual_hash(generated_image_path)
        fast_matches = self._fast_lookup(phash)

        # 2. Detailed comparison with deep features
        features = self._extract_deep_features(generated_image_path)
        detailed_matches = self._detailed_comparison(features)

        # 3. Style similarity evaluation
        style_features = self._extract_style_features(generated_image_path)
        style_matches = self._style_comparison(style_features)

        # 4. Overall judgment
        all_matches = fast_matches + detailed_matches
        max_similarity = max((m["similarity"] for m in all_matches), default=0)

        return {
            "status": self._determine_status(max_similarity),
            "max_similarity": max_similarity,
            "matches": sorted(all_matches, key=lambda x: x["similarity"], reverse=True)[:10],
            "style_analysis": {
                "similar_artists": style_matches[:5],
                "note": "Style similarity does not necessarily constitute copyright infringement, "
                        "but intentional imitation of a specific artist carries risk",
            },
            "recommendations": self._generate_recommendations(max_similarity, style_matches),
        }

    def _determine_status(self, max_similarity: float) -> str:
        if max_similarity >= self.similarity_threshold:
            return "HIGH_RISK: High similarity to existing work detected"
        elif max_similarity >= self.warning_threshold:
            return "WARNING: Similarities with existing works found"
        return "LOW_RISK: No clear signs of copyright infringement"

    def _compute_perceptual_hash(self, image_path: str) -> str:
        """Compute perceptual hash (pHash)"""
        # Resize image -> Grayscale -> DCT -> Hash upper bits
        # In production, use the imagehash library
        pass

    def _extract_deep_features(self, image_path: str) -> list[float]:
        """Feature extraction using deep learning models"""
        # Extract feature vectors using pre-trained models such as CLIP, DINO
        pass

    def _extract_style_features(self, image_path: str) -> list[float]:
        """Extract style features (Gram Matrix based)"""
        # Compute Gram Matrix from intermediate VGG layer outputs
        pass

    def _fast_lookup(self, phash: str) -> list[dict]:
        """Fast search using perceptual hash"""
        pass

    def _detailed_comparison(self, features: list[float]) -> list[dict]:
        """Detailed comparison using deep features"""
        pass

    def _style_comparison(self, style_features: list[float]) -> list[dict]:
        """Style similarity comparison"""
        pass

    def _generate_recommendations(self, max_similarity: float,
                                   style_matches: list) -> list[str]:
        """Recommendations based on risk level"""
        recs = []
        if max_similarity >= self.similarity_threshold:
            recs.extend([
                "Use of this image is strongly discouraged",
                "Recommended to regenerate with different prompt/seed",
                "Recommended to consult with legal team",
            ])
        elif max_similarity >= self.warning_threshold:
            recs.extend([
                "Verify the rights holder of similar existing works",
                "Reduce similarity through image editing/modification",
                "Recommended to further verify with reverse image search",
            ])
        if style_matches and style_matches[0].get("similarity", 0) > 0.9:
            recs.append("Recommended to modify prompt to avoid imitating a specific artist's style")
        return recs

    def _load_reference_db(self, path: str) -> dict:
        """Load the copyrighted works database"""
        return {}


# Batch copyright check execution
def batch_copyright_check(image_dir: str, db_path: str) -> list[dict]:
    """Copyright check all images in a directory"""
    checker = CopyrightSimilarityChecker(db_path)
    results = []

    for image_path in Path(image_dir).glob("*.{png,jpg,jpeg,webp}"):
        result = checker.check_image(str(image_path))
        results.append({
            "file": str(image_path),
            "status": result["status"],
            "max_similarity": result["max_similarity"],
        })

    # Sort by highest risk
    results.sort(key=lambda x: x["max_similarity"], reverse=True)
    return results
```

### 2.4 Commercial Use Decision Criteria

```
Commercial Use Decision Flow

  [Want to commercially use AI-generated images]
           |
           v
  [Check model license]
           |
     +-----+------+
     |             |
  Commercial     Commercial use
  OK             not allowed /
  (Firefly,      requires confirmation
   Midjourney    (some OSS models)
   paid plan,      |
   DALL-E)        v
                [Check license
                 conditions in detail]
     |
     v
  [Check if generated content closely resembles existing works]
     |
     +-----+------+
     |             |
  No close       Close
  resemblance    resemblance
     |             |
     v             v
  [Consider       [Avoid using;
   disclosing      generate
   AI-generated    different image]
   status to
   client]
     |
     v
  [Attach content authentication info (C2PA)]
     |
     v
  [Commercial use OK]
```

### 2.5 Major Lawsuits and Case Law Database

```python
# Major AI copyright lawsuits and case law

ai_copyright_cases = {
    "United States": [
        {
            "case": "Thaler v. Perlmutter (2023)",
            "court": "D.C. District Court",
            "issue": "Copyright registration of images generated by DABUS (AI)",
            "ruling": "AI-generated works without a human author are not eligible for copyright protection",
            "significance": "Clarified that AI cannot be an author",
            "status": "Final (no appeal)",
        },
        {
            "case": "Andersen v. Stability AI et al. (2023)",
            "court": "N.D. California",
            "issue": "Artists sued Stability AI, Midjourney, and DeviantArt",
            "ruling": "Pending (some claims dismissed, others continue)",
            "significance": "Potential precedent for training data rights issues",
            "status": "Pending",
        },
        {
            "case": "Getty Images v. Stability AI (2023)",
            "court": "D. Delaware",
            "issue": "Unauthorized training on over 12 million Getty Images photos",
            "ruling": "Pending",
            "significance": "Rights issues with large-scale datasets",
            "status": "Pending",
        },
        {
            "case": "NYT v. OpenAI & Microsoft (2023)",
            "court": "S.D. New York",
            "issue": "Unauthorized training on NYT articles and reproduction in output",
            "ruling": "Pending",
            "significance": "Text-focused but may set precedent affecting image AI as well",
            "status": "Pending",
        },
        {
            "case": "Kris Kashtanova / Zarya of the Dawn (2023)",
            "court": "US Copyright Office",
            "issue": "Copyright registration of a comic containing Midjourney-generated images",
            "ruling": "Text and layout are copyright-protected; AI-generated image portions are not",
            "significance": "Precedent for partial copyright protection of AI-assisted works",
            "status": "Final",
        },
    ],
    "Japan": [
        {
            "case": "Cultural Council 'Perspectives on AI and Copyright' (2024)",
            "body": "Agency for Cultural Affairs, Cultural Council Copyright Subcommittee",
            "issue": "Organizing copyright issues around AI training and generated content",
            "ruling": "Training stage is generally lawful under Article 30-4; generation stage requires case-by-case judgment",
            "significance": "Established Japan's basic policy on AI copyright",
            "status": "Guidelines (not legally binding)",
        },
    ],
    "China": [
        {
            "case": "Li v. AI Image Generation Platform (2023)",
            "court": "Beijing Internet Court",
            "issue": "Copyright attribution of AI-generated images",
            "ruling": "Copyright recognized for AI-generated content reflecting the user's intellectual input",
            "significance": "One of the world's first cases granting copyright to AI-generated content",
            "status": "Final",
        },
    ],
}
```

---

## 3. Deepfakes and Portrait Rights

### 3.1 Deepfake Detection Technology

```python
# Deepfake detection pipeline (pseudocode)
import torch
from deepfake_detection import FaceForensicsDetector

class DeepfakeDetectionPipeline:
    """Multi-layered approach to deepfake detection"""

    def __init__(self):
        # Combine multiple detection methods
        self.detectors = {
            "frequency_analysis": FrequencyAnalysisDetector(),
            "face_forensics": FaceForensicsDetector(),
            "lip_sync": LipSyncConsistencyChecker(),
            "metadata": MetadataAnalyzer(),
            "c2pa": C2PAVerifier(),
        }

    def analyze(self, media_path):
        """Analyze the authenticity of a media file"""
        results = {}
        for name, detector in self.detectors.items():
            results[name] = detector.detect(media_path)

        # Overall judgment
        fake_scores = [r["fake_probability"] for r in results.values()
                       if "fake_probability" in r]
        avg_score = sum(fake_scores) / len(fake_scores) if fake_scores else 0

        return {
            "overall_fake_probability": avg_score,
            "verdict": "LIKELY_FAKE" if avg_score > 0.7 else
                       "SUSPICIOUS" if avg_score > 0.4 else "LIKELY_REAL",
            "detailed_results": results,
            "confidence": "high" if len(fake_scores) >= 3 else "low",
        }


class FrequencyAnalysisDetector:
    """Deepfake detection through frequency domain analysis"""

    def detect(self, media_path):
        # GAN-generated images have specific frequency patterns
        # Detect spectral anomalies using DCT (Discrete Cosine Transform)
        image = load_image(media_path)
        dct_spectrum = compute_dct(image)
        anomaly_score = detect_spectral_anomaly(dct_spectrum)
        return {
            "fake_probability": anomaly_score,
            "method": "DCT Spectral Analysis",
            "note": "Detects GAN-specific frequency patterns",
        }
```

### 3.2 Digital Watermarking Technology

```python
# Embedding digital watermarks in AI-generated content

import numpy as np
from typing import Optional


class InvisibleWatermark:
    """Embedding and detection of invisible digital watermarks"""

    def __init__(self, secret_key: str):
        self.key = secret_key
        self.bit_depth = 64  # Number of watermark bits

    def embed(self, image: np.ndarray, message: str) -> np.ndarray:
        """
        Embed an invisible digital watermark in an image

        DCT (Discrete Cosine Transform) based method:
        1. Divide image into 8x8 blocks
        2. Apply DCT to each block
        3. Embed message bits in mid-frequency band coefficients
        4. Reconstruct image with inverse DCT

        Args:
            image: Input image (H, W, 3)
            message: Message string to embed

        Returns:
            Watermarked image
        """
        # Convert message to bit sequence
        message_bits = self._string_to_bits(message)

        # Scramble bit sequence with encryption key
        scrambled_bits = self._scramble_with_key(message_bits)

        # Convert to YCbCr color space (embed in luminance channel)
        ycbcr = self._rgb_to_ycbcr(image)
        y_channel = ycbcr[:, :, 0].astype(float)

        # DCT transform and embedding in 8x8 block units
        h, w = y_channel.shape
        bit_idx = 0

        for i in range(0, h - 7, 8):
            for j in range(0, w - 7, 8):
                if bit_idx >= len(scrambled_bits):
                    break

                block = y_channel[i:i+8, j:j+8]
                dct_block = self._dct2d(block)

                # Manipulate relationship between mid-frequency coefficients (4,3) and (3,4)
                if scrambled_bits[bit_idx] == 1:
                    if dct_block[4, 3] <= dct_block[3, 4]:
                        dct_block[4, 3], dct_block[3, 4] = \
                            dct_block[3, 4] + 1, dct_block[4, 3] - 1
                else:
                    if dct_block[4, 3] > dct_block[3, 4]:
                        dct_block[4, 3], dct_block[3, 4] = \
                            dct_block[3, 4] - 1, dct_block[4, 3] + 1

                y_channel[i:i+8, j:j+8] = self._idct2d(dct_block)
                bit_idx += 1

        ycbcr[:, :, 0] = np.clip(y_channel, 0, 255).astype(np.uint8)
        return self._ycbcr_to_rgb(ycbcr)

    def detect(self, watermarked_image: np.ndarray) -> Optional[str]:
        """
        Detect and extract digital watermark from an image

        Args:
            watermarked_image: Watermarked image

        Returns:
            Extracted message, or None if not detected
        """
        ycbcr = self._rgb_to_ycbcr(watermarked_image)
        y_channel = ycbcr[:, :, 0].astype(float)

        extracted_bits = []
        h, w = y_channel.shape

        for i in range(0, h - 7, 8):
            for j in range(0, w - 7, 8):
                if len(extracted_bits) >= self.bit_depth:
                    break

                block = y_channel[i:i+8, j:j+8]
                dct_block = self._dct2d(block)

                if dct_block[4, 3] > dct_block[3, 4]:
                    extracted_bits.append(1)
                else:
                    extracted_bits.append(0)

        # Descramble to recover the message
        descrambled = self._descramble_with_key(extracted_bits)
        return self._bits_to_string(descrambled)

    def _string_to_bits(self, s: str) -> list[int]:
        """Convert string to bit sequence"""
        bits = []
        for byte in s.encode("utf-8"):
            for i in range(7, -1, -1):
                bits.append((byte >> i) & 1)
        return bits

    def _bits_to_string(self, bits: list[int]) -> str:
        """Convert bit sequence to string"""
        bytes_list = []
        for i in range(0, len(bits), 8):
            byte = 0
            for j in range(8):
                if i + j < len(bits):
                    byte = (byte << 1) | bits[i + j]
            bytes_list.append(byte)
        return bytes(bytes_list).decode("utf-8", errors="replace")

    def _scramble_with_key(self, bits: list[int]) -> list[int]:
        """Scramble bit sequence with encryption key"""
        np.random.seed(int(hashlib.md5(self.key.encode()).hexdigest(), 16) % (2**32))
        perm = np.random.permutation(len(bits))
        return [bits[i] for i in perm]

    def _descramble_with_key(self, bits: list[int]) -> list[int]:
        """Restore scrambled sequence"""
        np.random.seed(int(hashlib.md5(self.key.encode()).hexdigest(), 16) % (2**32))
        perm = np.random.permutation(len(bits))
        result = [0] * len(bits)
        for i, p in enumerate(perm):
            if i < len(bits):
                result[p] = bits[i]
        return result

    def _dct2d(self, block: np.ndarray) -> np.ndarray:
        """2D DCT transform"""
        from scipy.fftpack import dct
        return dct(dct(block.T, norm='ortho').T, norm='ortho')

    def _idct2d(self, block: np.ndarray) -> np.ndarray:
        """2D inverse DCT transform"""
        from scipy.fftpack import idct
        return idct(idct(block.T, norm='ortho').T, norm='ortho')

    def _rgb_to_ycbcr(self, rgb: np.ndarray) -> np.ndarray:
        """RGB -> YCbCr conversion"""
        # ITU-R BT.601 conversion matrix
        matrix = np.array([
            [0.299, 0.587, 0.114],
            [-0.169, -0.331, 0.500],
            [0.500, -0.419, -0.081],
        ])
        ycbcr = np.dot(rgb, matrix.T)
        ycbcr[:, :, 1:] += 128
        return ycbcr

    def _ycbcr_to_rgb(self, ycbcr: np.ndarray) -> np.ndarray:
        """YCbCr -> RGB conversion"""
        ycbcr = ycbcr.copy()
        ycbcr[:, :, 1:] -= 128
        matrix_inv = np.array([
            [1.0, 0.0, 1.403],
            [1.0, -0.344, -0.714],
            [1.0, 1.773, 0.0],
        ])
        rgb = np.dot(ycbcr, matrix_inv.T)
        return np.clip(rgb, 0, 255).astype(np.uint8)


# SynthID-style spectral watermark concept
class SpectralWatermark:
    """
    Spectral domain watermark method similar to Google SynthID

    Features:
    - Robust against JPEG compression, resizing, and cropping
    - Imperceptible to the human eye
    - Probabilistic detection (threshold-based)
    """

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.watermark_strength = 0.03  # Minimize impact on PSNR

    def embed_during_generation(self, latent_tensor: "torch.Tensor",
                                 diffusion_step: int) -> "torch.Tensor":
        """
        Embed watermark during the diffusion model generation process

        Unlike conventional post-hoc watermarking, embedding directly during
        the generation process means:
        - Minimal impact on image quality
        - Extremely difficult to remove
        - Functions as a model-specific signature

        Args:
            latent_tensor: Latent representation of the diffusion model
            diffusion_step: Current diffusion step

        Returns:
            Watermarked latent representation
        """
        # Generate unique pattern from model ID + step count
        pattern = self._generate_spectral_pattern(
            latent_tensor.shape, diffusion_step
        )

        # Add pattern to latent space (controlling strength)
        watermarked = latent_tensor + self.watermark_strength * pattern
        return watermarked

    def detect(self, image: np.ndarray) -> dict:
        """
        Detect spectral watermark from an image

        Returns:
            Detection result (probability score and confidence)
        """
        # Transform to frequency domain with Fourier transform
        spectrum = np.fft.fft2(image.mean(axis=2))
        spectrum_shifted = np.fft.fftshift(spectrum)

        # Compute correlation with known patterns
        correlation = self._compute_pattern_correlation(spectrum_shifted)

        return {
            "watermark_detected": correlation > 0.5,
            "confidence": min(correlation * 1.5, 1.0),
            "model_id": self.model_id if correlation > 0.5 else None,
            "note": "Detection based on correlation analysis in the spectral domain",
        }

    def _generate_spectral_pattern(self, shape: tuple, step: int) -> "torch.Tensor":
        """Generate model-specific spectral pattern"""
        pass

    def _compute_pattern_correlation(self, spectrum: np.ndarray) -> float:
        """Compute correlation with known pattern"""
        pass
```

### 3.3 Content Authentication (C2PA)

```python
# C2PA (Coalition for Content Provenance and Authenticity)
# Technical standard for proving the provenance of content

class C2PAManager:
    """C2PA-compliant content authentication management"""

    def sign_content(self, content_path, metadata):
        """Attach a C2PA manifest to content"""
        manifest = {
            "claim_generator": "MyApp/1.0",
            "title": metadata.get("title", "Untitled"),
            "assertions": [
                {
                    "label": "c2pa.actions",
                    "data": {
                        "actions": [
                            {
                                "action": "c2pa.created",
                                "softwareAgent": metadata.get("tool", "Unknown"),
                                "digitalSourceType": self._get_source_type(metadata),
                            }
                        ]
                    }
                },
                {
                    "label": "c2pa.ai_training",
                    "data": {
                        "use": metadata.get("ai_training_allowed", "notAllowed"),
                    }
                }
            ],
        }
        # Prevent manifest tampering with digital signature
        signed_manifest = self._sign_with_certificate(manifest)
        return self._embed_manifest(content_path, signed_manifest)

    def _get_source_type(self, metadata):
        """Classify the content creation method"""
        source_types = {
            "human_created": "http://cv.iptc.org/newscodes/digitalsourcetype/humanCreated",
            "ai_generated": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
            "ai_assisted": "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia",
            "captured": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
        }
        return source_types.get(metadata.get("source_type", ""), "unknown")

    def verify_content(self, content_path: str) -> dict:
        """Verify a C2PA manifest"""
        manifest = self._extract_manifest(content_path)
        if not manifest:
            return {
                "verified": False,
                "reason": "No C2PA manifest found",
                "recommendation": "Content provenance cannot be verified. Please handle with caution.",
            }

        # Signature verification
        signature_valid = self._verify_signature(manifest)

        # Chain verification (edit history consistency)
        chain_valid = self._verify_chain(manifest)

        return {
            "verified": signature_valid and chain_valid,
            "signature_valid": signature_valid,
            "chain_valid": chain_valid,
            "source_type": manifest.get("assertions", [{}])[0].get(
                "data", {}).get("actions", [{}])[0].get("digitalSourceType", "unknown"),
            "creation_tool": manifest.get("claim_generator", "unknown"),
            "edit_history": self._extract_edit_history(manifest),
        }

    def _extract_manifest(self, content_path: str) -> Optional[dict]:
        """Extract C2PA manifest from content"""
        pass

    def _verify_signature(self, manifest: dict) -> bool:
        """Verify digital signature"""
        pass

    def _verify_chain(self, manifest: dict) -> bool:
        """Verify edit history chain consistency"""
        pass

    def _extract_edit_history(self, manifest: dict) -> list[dict]:
        """Extract edit history"""
        pass

    def _sign_with_certificate(self, manifest: dict) -> dict:
        """Sign with certificate"""
        pass

    def _embed_manifest(self, content_path: str, manifest: dict) -> str:
        """Embed manifest in content"""
        pass


# C2PA adoption status (as of 2025)
c2pa_adoption = {
    "Adobe": "Content Credentials attached in Photoshop and Lightroom",
    "Google": "SynthID embeds watermarks in AI-generated content",
    "Microsoft": "C2PA metadata attached in Bing Image Creator",
    "OpenAI": "C2PA metadata attached in DALL-E 3",
    "Meta": "Stable Signatures marks generated content",
    "Camera Manufacturers": "Nikon, Sony, Leica support C2PA at capture time",
    "Stability AI": "Metadata attachment supported from Stable Diffusion XL onward",
    "TikTok": "Automatic labeling of AI-generated content",
    "YouTube": "Mandatory disclosure of AI-generated/edited content",
}
```

### 3.4 Portrait Rights and Consent Management

```python
# Generation flow with portrait rights considerations

class ConsentManager:
    """Portrait rights and publicity rights consent management"""

    CONSENT_LEVELS = {
        "explicit_written": 4,   # Explicit written consent
        "explicit_verbal": 3,    # Explicit verbal consent
        "implied": 2,            # Implied consent (e.g., photography in public places)
        "none": 0,               # No consent
    }

    def check_generation_allowed(self, request):
        """Portrait rights check for a generation request"""
        checks = {
            "real_person_detected": self._contains_real_person(request),
            "consent_level": self._get_consent_level(request),
            "purpose": request.get("purpose", "unknown"),
            "commercial_use": request.get("commercial", False),
        }

        # Judgment logic
        if checks["real_person_detected"]:
            if checks["consent_level"] == "none":
                return {
                    "allowed": False,
                    "reason": "Consent from the individual is required for generating images of real persons",
                    "recommendation": "Please use a fictional character or obtain consent",
                }
            if checks["commercial_use"] and checks["consent_level"] != "explicit_written":
                return {
                    "allowed": False,
                    "reason": "Explicit written consent is required for commercial use",
                    "recommendation": "Please enter into a publicity rights license agreement",
                }

        return {"allowed": True, "conditions": checks}

    def _contains_real_person(self, request: dict) -> bool:
        """Check if the request contains references to real persons"""
        pass

    def _get_consent_level(self, request: dict) -> str:
        """Get consent level"""
        return request.get("consent_level", "none")


# Portrait rights comparison by country
portrait_rights_comparison = {
    "Japan": {
        "legal_basis": "Case law (tort based on Civil Code Articles 709 and 710)",
        "scope_of_protection": "Right not to have one's appearance or likeness photographed or published without consent",
        "publicity_rights": "Established by the Pink Lady Supreme Court decision (2012)",
        "ai_specific_regulation": "No special legislation (addressed by general law)",
        "practical_notes": "Written consent is effectively required for commercial use",
    },
    "United States": {
        "legal_basis": "State law (Right of Publicity)",
        "scope_of_protection": "Varies by state (California is the most extensive)",
        "publicity_rights": "Codified in state law (California Civil Code Section 3344, etc.)",
        "ai_specific_regulation": "California AB 602 (2024): Consent obligation for digital replicas",
        "practical_notes": "Many states protect even after death (California: 70 years post-mortem)",
    },
    "EU": {
        "legal_basis": "GDPR + national laws",
        "scope_of_protection": "Protection of facial images as personal data",
        "publicity_rights": "Varies by national law",
        "ai_specific_regulation": "AI Act (2024): Regulation as a high-risk AI system",
        "practical_notes": "GDPR's explicit consent requirements apply",
    },
}
```

---

## 4. Content Moderation Pipeline

```python
# Content moderation system for AI-generated content

from enum import Enum
from typing import Optional
import logging


class ContentCategory(Enum):
    """Content classification categories"""
    SAFE = "safe"
    NSFW_MILD = "nsfw_mild"        # Mildly inappropriate content
    NSFW_EXPLICIT = "nsfw_explicit"  # Explicitly inappropriate content
    VIOLENCE = "violence"
    HATE_SPEECH = "hate_speech"
    CHILD_EXPLOITATION = "child_exploitation"  # Subject to immediate reporting
    POLITICAL_MISINFO = "political_misinfo"
    SELF_HARM = "self_harm"


class ModerationDecision(Enum):
    ALLOW = "allow"
    WARN = "warn"           # Display warning to user
    BLUR = "blur"           # Apply blur processing
    AGE_GATE = "age_gate"   # Require age verification
    BLOCK = "block"         # Block generation/display
    REPORT = "report"       # Legal reporting


class ContentModerationPipeline:
    """Pre- and post-generation content moderation"""

    def __init__(self):
        self.logger = logging.getLogger("content_moderation")
        self.pre_filters = [
            PromptSafetyFilter(),
            PersonIdentificationFilter(),
            TrademarkFilter(),
        ]
        self.post_filters = [
            NSFWClassifier(),
            ViolenceDetector(),
            ChildSafetyClassifier(),
            DeepfakeIndicatorDetector(),
        ]
        self.policy = self._load_moderation_policy()

    def pre_generation_check(self, prompt: str, config: dict) -> dict:
        """
        Pre-generation prompt check

        Executed before a generation request is submitted,
        preventing generation of inappropriate content in advance.
        """
        results = []
        for filter_instance in self.pre_filters:
            result = filter_instance.check(prompt, config)
            results.append(result)

            if result["decision"] == ModerationDecision.BLOCK:
                self.logger.warning(
                    f"Pre-generation BLOCKED: {result['reason']} | "
                    f"prompt={prompt[:100]}"
                )
                return {
                    "allowed": False,
                    "decision": ModerationDecision.BLOCK,
                    "reason": result["reason"],
                    "filter": result["filter_name"],
                }

        return {
            "allowed": True,
            "decision": ModerationDecision.ALLOW,
            "warnings": [r for r in results if r["decision"] == ModerationDecision.WARN],
        }

    def post_generation_check(self, image_path: str, metadata: dict) -> dict:
        """
        Post-generation image check

        Executed before returning the generated image to the user,
        preventing inappropriate content from being output.
        """
        results = []
        for filter_instance in self.post_filters:
            result = filter_instance.analyze(image_path)
            results.append(result)

        # Adopt the strictest judgment
        decisions = [r["decision"] for r in results]
        if ModerationDecision.REPORT in decisions:
            final_decision = ModerationDecision.REPORT
            self._handle_report(image_path, metadata, results)
        elif ModerationDecision.BLOCK in decisions:
            final_decision = ModerationDecision.BLOCK
        elif ModerationDecision.AGE_GATE in decisions:
            final_decision = ModerationDecision.AGE_GATE
        elif ModerationDecision.BLUR in decisions:
            final_decision = ModerationDecision.BLUR
        elif ModerationDecision.WARN in decisions:
            final_decision = ModerationDecision.WARN
        else:
            final_decision = ModerationDecision.ALLOW

        return {
            "decision": final_decision,
            "details": results,
            "action_taken": self._apply_decision(final_decision, image_path),
        }

    def _handle_report(self, image_path: str, metadata: dict, results: list):
        """Handle cases requiring legal reporting"""
        self.logger.critical(
            f"REPORT REQUIRED: {image_path} | "
            f"Results: {results}"
        )
        # Report to NCMEC (National Center for Missing & Exploited Children), etc.
        # Log for evidence preservation
        self._preserve_evidence(image_path, metadata, results)

    def _apply_decision(self, decision: ModerationDecision, image_path: str) -> str:
        """Execute action based on judgment"""
        actions = {
            ModerationDecision.ALLOW: "Display content normally",
            ModerationDecision.WARN: "Display with warning label attached",
            ModerationDecision.BLUR: "Display with blur processing applied",
            ModerationDecision.AGE_GATE: "Display age verification gate",
            ModerationDecision.BLOCK: "Block content, display alternative image",
            ModerationDecision.REPORT: "Block content, execute legal reporting",
        }
        return actions.get(decision, "Unknown action")

    def _preserve_evidence(self, image_path: str, metadata: dict, results: list):
        """Evidence preservation"""
        pass

    def _load_moderation_policy(self) -> dict:
        """Load moderation policy"""
        return {}


class PromptSafetyFilter:
    """Prompt safety filter"""

    BLOCKED_PATTERNS = [
        # Specific patterns not disclosed for security reasons
        # In production, a regularly updated pattern list is used
    ]

    def check(self, prompt: str, config: dict) -> dict:
        """Prompt safety check"""
        # Matching against block list
        for pattern in self.BLOCKED_PATTERNS:
            if pattern in prompt.lower():
                return {
                    "filter_name": "PromptSafetyFilter",
                    "decision": ModerationDecision.BLOCK,
                    "reason": "Prompt matching a prohibited pattern detected",
                }
        return {
            "filter_name": "PromptSafetyFilter",
            "decision": ModerationDecision.ALLOW,
            "reason": None,
        }


class NSFWClassifier:
    """NSFW content classifier"""

    def analyze(self, image_path: str) -> dict:
        """
        NSFW classification of images

        Determines image category using a CLIP-based classification model.
        Thresholds can be adjusted according to the operating environment.
        """
        # In production, use CLIP + fine-tuned classifier
        # score = self.model.predict(image_path)

        return {
            "filter_name": "NSFWClassifier",
            "category": ContentCategory.SAFE,
            "decision": ModerationDecision.ALLOW,
            "confidence": 0.95,
        }


class ChildSafetyClassifier:
    """Child safety classifier"""

    def analyze(self, image_path: str) -> dict:
        """Detection of inappropriate content related to children"""
        # Hash matching with Microsoft PhotoDNA, etc.
        # + Classification with age estimation model
        return {
            "filter_name": "ChildSafetyClassifier",
            "decision": ModerationDecision.ALLOW,
        }
```

---

## 5. Bias and Fairness

```python
# Bias detection and mitigation in AI image generation

class BiasAuditor:
    """Bias audit of generated images"""

    def audit_generation_results(self, prompt, generated_images):
        """Audit generation results for bias against a prompt"""

        audit_results = {
            "gender_distribution": self._check_gender_representation(generated_images),
            "racial_distribution": self._check_racial_representation(generated_images),
            "age_distribution": self._check_age_representation(generated_images),
            "body_type_diversity": self._check_body_diversity(generated_images),
            "stereotyping": self._check_stereotypes(prompt, generated_images),
        }

        # Specific examples of bias
        known_biases = [
            {
                "prompt": "CEO",
                "bias": "Male and white images are disproportionately generated",
                "mitigation": "Explicitly include diverse attributes in the prompt",
            },
            {
                "prompt": "nurse",
                "bias": "Female images are overwhelmingly dominant",
                "mitigation": "Do not specify gender, or generate with diverse genders",
            },
            {
                "prompt": "beautiful person",
                "bias": "Biased toward specific beauty standards (slim, young, Caucasian-leaning)",
                "mitigation": "Include diverse beauty standards in training data",
            },
            {
                "prompt": "family",
                "bias": "Nuclear family and heterosexual couple-centric",
                "mitigation": "Consciously include diverse family structures",
            },
        ]

        return {
            "audit": audit_results,
            "known_biases": known_biases,
            "recommendations": self._generate_recommendations(audit_results),
        }

    def _generate_recommendations(self, audit):
        """Improvement proposals based on audit results"""
        recommendations = []
        for dimension, result in audit.items():
            if result.get("bias_detected"):
                recommendations.append({
                    "dimension": dimension,
                    "action": f"Please improve diversity in {dimension}",
                    "method": "Explicit diversity specification in prompts, "
                              "rebalancing of training data, "
                              "post-generation filtering",
                })
        return recommendations

    def _check_gender_representation(self, images: list) -> dict:
        """Check for gender representation bias"""
        pass

    def _check_racial_representation(self, images: list) -> dict:
        """Check for racial/ethnic representation bias"""
        pass

    def _check_age_representation(self, images: list) -> dict:
        """Check for age representation bias"""
        pass

    def _check_body_diversity(self, images: list) -> dict:
        """Check body type diversity"""
        pass

    def _check_stereotypes(self, prompt: str, images: list) -> dict:
        """Check for stereotypical representations"""
        pass


# Prompt improvement tool for bias mitigation
class InclusivePromptEnhancer:
    """Tool to improve prompt inclusivity"""

    DIVERSITY_TEMPLATES = {
        "gender": [
            "people of various genders",
            "diverse group including men, women, and non-binary individuals",
        ],
        "ethnicity": [
            "diverse ethnicities and backgrounds",
            "people from various cultural backgrounds",
        ],
        "age": [
            "people of different ages",
            "intergenerational group",
        ],
        "ability": [
            "people with diverse abilities",
            "including people with visible and invisible disabilities",
        ],
        "body_type": [
            "people with diverse body types",
            "various body shapes and sizes",
        ],
    }

    def enhance_prompt(self, original_prompt: str,
                       diversity_dimensions: list[str] = None) -> str:
        """
        Add diversity elements to a prompt

        Args:
            original_prompt: Original prompt
            diversity_dimensions: Diversity dimensions to enhance
                                 (all dimensions if None)

        Returns:
            Prompt with improved inclusivity
        """
        if diversity_dimensions is None:
            diversity_dimensions = list(self.DIVERSITY_TEMPLATES.keys())

        additions = []
        for dim in diversity_dimensions:
            if dim in self.DIVERSITY_TEMPLATES:
                additions.append(self.DIVERSITY_TEMPLATES[dim][0])

        enhanced = f"{original_prompt}, {', '.join(additions)}"
        return enhanced

    def audit_prompt(self, prompt: str) -> dict:
        """Audit prompt inclusivity"""
        issues = []
        suggestions = []

        # Detect occupation names that assume gender
        gendered_terms = {
            "businessman": "business professional",
            "chairman": "chairperson",
            "fireman": "firefighter",
            "policeman": "police officer",
            "stewardess": "flight attendant",
            "看護婦": "看護師",
            "保母": "保育士",
        }

        for term, replacement in gendered_terms.items():
            if term.lower() in prompt.lower():
                issues.append(f"Gender-assuming expression '{term}' detected")
                suggestions.append(f"Recommended to replace '{term}' with '{replacement}'")

        return {
            "issues": issues,
            "suggestions": suggestions,
            "inclusivity_score": 1.0 - (len(issues) * 0.2),
        }
```

---

## 6. Environmental Impact

```
Environmental Impact of AI Image Generation

  Model            Estimated Power per Image    CO2 Equivalent (g)
  ─────────────────────────────────────────────────
  Stable Diffusion  0.01-0.05 kWh              5-25
  DALL-E 3          0.02-0.08 kWh              10-40
  Midjourney        0.01-0.04 kWh              5-20
  Sora (video)      0.5-2.0 kWh (estimated)    250-1000

  Comparison:
  - One smartphone charge: 0.01 kWh ≈ 5g CO2
  - One Google search: 0.0003 kWh ≈ 0.2g CO2
  - One image generation ≈ 1-5 smartphone charges

  Training Phase Impact:
  - Stable Diffusion training: ≈ 150,000 kWh
  - GPT-4 training: ≈ 50,000,000 kWh (estimated)
  - Average Japanese household annual consumption: ≈ 4,000 kWh

  Mitigation Measures:
  1. Limit to minimum necessary generation (avoid unnecessary mass generation)
  2. Use lightweight models (SDXL Turbo, etc.)
  3. Select data centers operated on renewable energy
  4. Use caching (avoid regenerating identical prompts)
```

### 6.1 Environmental Impact Calculator

```python
# Tool for quantifying the environmental impact of AI generation

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class CarbonEstimate:
    """CO2 emission estimate"""
    kwh: float
    co2_grams: float
    equivalent_km_driving: float
    equivalent_smartphone_charges: float
    equivalent_google_searches: int


class EnvironmentalImpactCalculator:
    """Environmental impact calculation for AI image/video generation"""

    # Estimated power consumption per generation (kWh/generation)
    MODEL_POWER = {
        "stable_diffusion_1.5": 0.015,
        "stable_diffusion_xl": 0.030,
        "sdxl_turbo": 0.005,         # Distilled models significantly reduce consumption
        "dall_e_3": 0.050,
        "midjourney_v6": 0.025,
        "imagen_3": 0.040,
        "sora_5s": 0.500,            # 5-second video
        "sora_60s": 2.000,           # 60-second video
        "flux_1_schnell": 0.008,     # Lightweight model
        "flux_1_dev": 0.025,
    }

    # Regional CO2 emission factors (g CO2/kWh)
    GRID_CARBON_INTENSITY = {
        "us_average": 390,
        "us_california": 220,
        "eu_average": 230,
        "japan": 470,
        "china": 550,
        "norway": 20,               # Primarily hydroelectric
        "france": 60,               # Primarily nuclear
        "india": 710,
        "renewable_only": 0,
    }

    def estimate_single_generation(self, model: str,
                                    region: str = "us_average") -> CarbonEstimate:
        """Estimate environmental impact of a single generation"""
        kwh = self.MODEL_POWER.get(model, 0.03)
        co2_per_kwh = self.GRID_CARBON_INTENSITY.get(region, 390)
        co2_grams = kwh * co2_per_kwh

        return CarbonEstimate(
            kwh=kwh,
            co2_grams=co2_grams,
            equivalent_km_driving=co2_grams / 120,      # Passenger car: ~120g/km
            equivalent_smartphone_charges=kwh / 0.01,
            equivalent_google_searches=int(kwh / 0.0003),
        )

    def estimate_project(self, model: str, num_generations: int,
                          region: str = "us_average") -> dict:
        """Estimate environmental impact of an entire project"""
        single = self.estimate_single_generation(model, region)

        total_kwh = single.kwh * num_generations
        total_co2 = single.co2_grams * num_generations

        return {
            "total_generations": num_generations,
            "total_kwh": round(total_kwh, 3),
            "total_co2_grams": round(total_co2, 1),
            "total_co2_kg": round(total_co2 / 1000, 3),
            "equivalent_driving_km": round(total_co2 / 120, 1),
            "equivalent_tree_hours": round(total_co2 / 21.77, 1),  # 1 tree ≈ 21.77g/h
            "optimization_suggestions": self._suggest_optimizations(
                model, num_generations, total_co2
            ),
        }

    def compare_models(self, num_generations: int = 100,
                        region: str = "us_average") -> list[dict]:
        """Compare environmental impact across models"""
        results = []
        for model, kwh in sorted(self.MODEL_POWER.items(), key=lambda x: x[1]):
            estimate = self.estimate_project(model, num_generations, region)
            results.append({
                "model": model,
                "per_generation_kwh": kwh,
                "total_co2_grams": estimate["total_co2_grams"],
                "eco_rating": self._eco_rating(kwh),
            })
        return results

    def _eco_rating(self, kwh_per_generation: float) -> str:
        """Eco rating (A-F)"""
        if kwh_per_generation < 0.01:
            return "A (Extremely low impact)"
        elif kwh_per_generation < 0.03:
            return "B (Low impact)"
        elif kwh_per_generation < 0.05:
            return "C (Standard)"
        elif kwh_per_generation < 0.1:
            return "D (High impact)"
        elif kwh_per_generation < 0.5:
            return "E (Very high impact)"
        else:
            return "F (Extremely high impact)"

    def _suggest_optimizations(self, model: str, count: int, total_co2: float) -> list[str]:
        """Suggest optimizations"""
        suggestions = []
        if "turbo" not in model and "schnell" not in model:
            suggestions.append("Switching to distilled models (Turbo/Schnell) can reduce up to 80%")
        if count > 100:
            suggestions.append("Pre-test prompts (small batch -> large batch) to reduce waste")
        if total_co2 > 10000:
            suggestions.append("Consider carbon offsets")
        suggestions.append("Use caching to avoid regenerating identical prompts")
        suggestions.append("Select cloud regions powered by renewable energy")
        return suggestions
```

---

## 7. Audit Logs and Compliance

```python
# Audit log system for AI-generated content

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional


class AuditLogger:
    """Audit logs for AI-generated content"""

    def __init__(self, log_dir: str, organization: str):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.organization = organization

    def log_generation(self, request: dict, result: dict,
                       moderation_result: dict) -> str:
        """Record audit log for a generation event"""
        log_entry = {
            "event_id": self._generate_event_id(),
            "timestamp": datetime.now().isoformat(),
            "organization": self.organization,
            "event_type": "content_generation",

            # Request information
            "request": {
                "prompt": request.get("prompt", ""),
                "model": request.get("model", "unknown"),
                "parameters": {
                    k: v for k, v in request.items()
                    if k not in ["prompt", "model"]
                },
                "user_id": request.get("user_id", "anonymous"),
                "purpose": request.get("purpose", "unspecified"),
                "commercial_use": request.get("commercial_use", False),
            },

            # Result information
            "result": {
                "output_hash": self._hash_file(result.get("output_path", "")),
                "output_format": result.get("format", "unknown"),
                "output_dimensions": result.get("dimensions", {}),
                "generation_time_ms": result.get("generation_time_ms", 0),
            },

            # Moderation results
            "moderation": {
                "pre_check": moderation_result.get("pre_check", {}),
                "post_check": moderation_result.get("post_check", {}),
                "decision": moderation_result.get("decision", "unknown"),
            },

            # Compliance information
            "compliance": {
                "copyright_check": moderation_result.get("copyright_check", {}),
                "consent_verified": request.get("consent_verified", False),
                "c2pa_attached": result.get("c2pa_attached", False),
                "watermark_embedded": result.get("watermark_embedded", False),
            },
        }

        # Append to log file
        log_file = self.log_dir / f"audit_{datetime.now().strftime('%Y-%m-%d')}.jsonl"
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

        return log_entry["event_id"]

    def generate_compliance_report(self, start_date: str,
                                    end_date: str) -> dict:
        """Generate a compliance report"""
        entries = self._load_entries(start_date, end_date)

        total = len(entries)
        if total == 0:
            return {"period": f"{start_date} ~ {end_date}", "total_generations": 0}

        blocked = sum(1 for e in entries if e["moderation"]["decision"] == "BLOCKED")
        flagged = sum(1 for e in entries if e["moderation"]["decision"] == "FLAGGED")
        with_consent = sum(1 for e in entries if e["compliance"]["consent_verified"])
        with_c2pa = sum(1 for e in entries if e["compliance"]["c2pa_attached"])
        with_watermark = sum(1 for e in entries if e["compliance"]["watermark_embedded"])

        return {
            "period": f"{start_date} ~ {end_date}",
            "total_generations": total,
            "moderation_summary": {
                "blocked": blocked,
                "blocked_rate": f"{blocked/total*100:.1f}%",
                "flagged": flagged,
                "flagged_rate": f"{flagged/total*100:.1f}%",
                "approved": total - blocked - flagged,
            },
            "compliance_summary": {
                "consent_verified_rate": f"{with_consent/total*100:.1f}%",
                "c2pa_attached_rate": f"{with_c2pa/total*100:.1f}%",
                "watermark_rate": f"{with_watermark/total*100:.1f}%",
            },
            "risk_areas": self._identify_risk_areas(entries),
            "recommendations": self._generate_report_recommendations(entries),
        }

    def _generate_event_id(self) -> str:
        """Generate a unique event ID"""
        timestamp = datetime.now().isoformat()
        return hashlib.sha256(
            f"{timestamp}_{self.organization}".encode()
        ).hexdigest()[:16]

    def _hash_file(self, file_path: str) -> str:
        """SHA256 hash of a file"""
        if not file_path or not Path(file_path).exists():
            return ""
        with open(file_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    def _load_entries(self, start_date: str, end_date: str) -> list[dict]:
        """Load log entries for a specified period"""
        entries = []
        for log_file in self.log_dir.glob("audit_*.jsonl"):
            with open(log_file, "r", encoding="utf-8") as f:
                for line in f:
                    entry = json.loads(line)
                    if start_date <= entry["timestamp"][:10] <= end_date:
                        entries.append(entry)
        return entries

    def _identify_risk_areas(self, entries: list[dict]) -> list[str]:
        """Identify risk areas"""
        risk_areas = []
        blocked_reasons = [
            e["moderation"].get("post_check", {}).get("reason", "")
            for e in entries
            if e["moderation"]["decision"] == "BLOCKED"
        ]
        if blocked_reasons:
            risk_areas.append(f"Blocked incidents: {len(blocked_reasons)} cases")
        return risk_areas

    def _generate_report_recommendations(self, entries: list[dict]) -> list[str]:
        """Report recommendations"""
        recs = []
        total = len(entries)
        with_c2pa = sum(1 for e in entries if e["compliance"]["c2pa_attached"])
        if with_c2pa / total < 0.9:
            recs.append("Please improve C2PA metadata attachment rate to 90% or higher")
        return recs
```

---

## 8. Organizational Guideline Development

```python
# Organizational AI-generated content usage guideline template

ai_content_policy = {
    "scope": "All business use of AI image and video generation tools",

    "permitted_uses": [
        "Reference image generation in the early stages of concept art",
        "Material use in internal documents (presentations, proposals)",
        "Creating drafts/rough designs for marketing materials",
        "Using tools with licensed training data (Adobe Firefly, etc.)",
    ],

    "restricted_uses": [
        "Generating images containing real persons' faces (requires written consent from the individual)",
        "Generating images containing brand elements of competitors",
        "Style imitation of clearly copyrighted works (specifying specific artist names)",
        "Using unedited AI-generated images as final deliverables",
    ],

    "prohibited_uses": [
        "Creating deepfakes (fraudulent video/audio)",
        "Generating sexual content involving children",
        "Generating content that promotes hate speech or discrimination",
        "Generating disinformation for elections or political purposes",
        "Generating images of individuals without consent (revenge porn, etc.)",
    ],

    "disclosure_requirements": [
        "Provide advance notice when client deliverables contain AI-generated material",
        "Add #AIGenerated tag to AI-generated images on social media posts",
        "Clear AI-generated labeling is mandatory for use in news/reporting",
        "Attach C2PA metadata whenever possible",
    ],

    "review_process": [
        "AI-generated content must undergo legal team review before publication",
        "Conduct portrait rights check when real persons are included",
        "Conduct trademark/brand element similarity check",
        "Verify absence of bias/discriminatory expressions",
    ],
}
```

### 8.1 Incident Response Framework

```python
# Incident response for AI-generated content

class EthicalIncidentResponse:
    """Ethical incident response framework"""

    SEVERITY_LEVELS = {
        "P0_CRITICAL": {
            "description": "Generation/leak of illegal content (CSAM, incitement to crime, etc.)",
            "response_time": "Immediately (within 30 minutes)",
            "escalation": "CISO + General Counsel + CEO",
            "actions": [
                "Immediately shut down the system",
                "Preserve evidence (prevent tampering)",
                "Report to law enforcement",
                "Identify scope of impact",
                "Notify victims",
            ],
        },
        "P1_HIGH": {
            "description": "Portrait rights violation, deepfake leak, copyright infringement lawsuit",
            "response_time": "Within 4 hours",
            "escalation": "Legal team + Management",
            "actions": [
                "Immediately remove the content in question",
                "Preserve related logs",
                "Report to legal team",
                "Contact affected individuals",
                "Develop recurrence prevention measures",
            ],
        },
        "P2_MEDIUM": {
            "description": "Mass generation of biased content, misinformation spread",
            "response_time": "Within 24 hours",
            "escalation": "Team leader + Compliance officer",
            "actions": [
                "Review and address the content in question",
                "Adjust filters",
                "Evaluate scope of impact",
                "Notify users",
            ],
        },
        "P3_LOW": {
            "description": "Minor policy violation, disclosure obligation deficiency",
            "response_time": "Within 1 week",
            "escalation": "Direct manager",
            "actions": [
                "Correct the policy violation",
                "Provide education for recurrence prevention",
                "Review processes",
            ],
        },
    }

    def handle_incident(self, incident_type: str, details: dict) -> dict:
        """Execute incident response"""
        severity = self._classify_severity(incident_type, details)
        response_plan = self.SEVERITY_LEVELS.get(severity, {})

        return {
            "severity": severity,
            "response_plan": response_plan,
            "incident_id": self._create_incident_record(
                severity, incident_type, details
            ),
            "immediate_actions": response_plan.get("actions", [])[:3],
            "escalation_contacts": response_plan.get("escalation", ""),
        }

    def _classify_severity(self, incident_type: str, details: dict) -> str:
        """Classify incident severity"""
        if details.get("involves_minors"):
            return "P0_CRITICAL"
        if details.get("involves_real_person_without_consent"):
            return "P1_HIGH"
        if details.get("widespread_impact"):
            return "P2_MEDIUM"
        return "P3_LOW"

    def _create_incident_record(self, severity: str, incident_type: str,
                                 details: dict) -> str:
        """Create incident record"""
        record_id = hashlib.sha256(
            f"{datetime.now().isoformat()}_{incident_type}".encode()
        ).hexdigest()[:12]
        return f"INC-{record_id}"


# Ethics committee operations template
ethics_committee_charter = {
    "name": "AI Ethics Committee",
    "purpose": "Ethical decision-making and oversight for AI-generated content",

    "composition": [
        {"role": "Chairperson", "department": "Legal/Compliance"},
        {"role": "Technical Member", "department": "AI/ML Engineering"},
        {"role": "Design Member", "department": "Creative/Design"},
        {"role": "External Member", "department": "Ethics/Sociology Expert"},
        {"role": "Human Rights Member", "department": "HR/Diversity"},
    ],

    "responsibilities": [
        "Development and updating of AI usage policy",
        "Final judgment on ethical incidents",
        "Ethical review for new AI tool adoption",
        "Quarterly review of bias audit reports",
        "Oversight of employee ethics education programs",
    ],

    "meeting_frequency": "Monthly regular meetings + ad hoc for emergencies",
    "decision_process": "Majority vote (unanimous preferred)",
    "reporting": "Quarterly reports to the board of directors",
}
```

---

## 9. Comparison Tables

| Perspective | Risk Level | Legal Framework | Technical Countermeasures | Organizational Countermeasures |
|------|:----------:|:--------:|:--------:|:--------:|
| Copyright Infringement | Medium | Copyright law, AI Act | Similarity detection, training data management | License verification process |
| Portrait Rights Violation | High | Civil law, portrait rights case law | Face detection filter | Consent management flow |
| Deepfakes | Highest | Regulatory laws in each country | C2PA, SynthID, detection AI | Usage prohibition policy |
| Bias | Medium | Anti-discrimination law | Bias audit | Diversity checklist |
| Environmental Impact | Low-Medium | ESG regulations | Lightweight model usage | Generation volume management |
| Misinformation Spread | High | Platform regulations | Watermarks, metadata | Disclosure policy |

| Tool | Training Data Transparency | Commercial Use | IP Indemnification | C2PA Support |
|--------|:----------------:|:------:|:-----:|:-------:|
| Adobe Firefly | High (Licensed) | Paid plan OK | Yes | Yes |
| Midjourney | Low | Paid plan OK | No | No |
| DALL-E 3 | Medium | API use OK | No | Yes |
| Stable Diffusion | Medium (LAION-5B) | License-dependent | No | No |
| Google Imagen | Medium | Limited | No | SynthID |

| Region | AI-Generated Copyright | Training Data Use | Deepfake Regulation | Disclosure Obligation |
|------|:-------------:|:----------:|:--------------:|:------:|
| Japan | Conditional protection | Generally lawful under Art. 30-4 | Criminal Code amendment (2023) | Guidelines |
| United States | Not possible for AI alone | Fair use debate | Addressed by state laws | Left to platforms |
| EU | Regulated by AI Act | DSM Directive | AI Act high-risk classification | Mandatory (AI Act) |
| China | Conditional recognition | Regulated by interim measures | Interim Measures for Generative AI | Mandatory |
| United Kingdom | Protected under s.9(3) | TDM exception under discussion | Online Safety Act | Under consideration |
| South Korea | Under consideration | Under consideration | AI Basic Act (2024) | Under consideration |

---

## 10. Anti-Patterns

### Anti-Pattern 1: The Misconception That "AI-Generated Means Copyright-Free"

```
BAD:
  "AI generated it, so no copyright exists"
  "It's nobody's work, so it can be used freely"
  -> Ignoring the similarity risk with existing works in training data
  -> Intentionally imitating a specific artist's style
  -> Increasing cases of legal disputes

GOOD:
  - Perform similarity checks with existing works even for AI-generated content
  - Prioritize tools with licensed training data
  - Do not use specific artist names in prompts
  - Verify similar works through reverse image search before commercial use
  - Establish a consultation process with the legal team
```

### Anti-Pattern 2: Neglecting Disclosure Obligations

```
BAD:
  Using AI-generated images as news article press photos
  Posting AI-generated model images as "actual wearing photos" on e-commerce
  -> Damages consumer trust and may incur legal liability

GOOD:
  - Always attach explicit labels to AI-generated content
  - Include labeling such as "This image was generated by AI"
  - Record content provenance with C2PA metadata
  - Follow platform AI-generated content policies
  - Do not use AI images in news/journalism
```

### Anti-Pattern 3: Using Portraits Without Consent

```
BAD:
  Using AI-generated images with celebrity faces in advertising
  Modifying and distributing ex-partner's photos using AI
  -> Subject to publicity rights infringement, defamation, criminal penalties

GOOD:
  - Always obtain written consent for generating images of real persons
  - Enter into publicity rights license agreements
  - Prioritize the option of using fictional characters
  - Block generation of real persons with face detection filters
  - Prohibit AI generation of real persons by default in internal policy
```

### Anti-Pattern 4: Lack of Moderation

```
BAD:
  Directly exposing API allowing generation with any prompt
  Distributing content without post-generation checks
  Disabling NSFW filters to prioritize performance
  -> Risk of harmful content being mass-generated and spread

GOOD:
  - Pre-generation prompt filtering
  - Post-generation content classification and inspection
  - Staged moderation (automatic -> human review)
  - Implement rate limiting and user authentication
  - Establish reporting functionality and rapid response flow
```

### Anti-Pattern 5: Operating Without Audit Trails

```
BAD:
  Not recording who generated what
  Not logging moderation judgment results
  Unable to conduct retrospective investigation when incidents occur
  -> Compliance violations, increased legal risk

GOOD:
  - Maintain audit logs for all generation requests
  - Record prompts, models, parameters, and judgment results
  - Ensure traceability with hash values of generated content
  - Generate regular compliance reports
  - Implement tamper-prevention measures for logs (immutable storage)
```

### Anti-Pattern 6: Mass Generation Ignoring Bias

```
BAD:
  Mass-generating marketing materials with AI without checking diversity
  Using "default" generation results as-is
  -> Expressions biased toward specific races, genders, or ages get published

GOOD:
  - Regularly conduct diversity audits on generation results
  - Include explicit diversity specifications in prompts
  - Compare results from multiple models
  - Review by reviewers from diverse backgrounds
  - Quarterly reporting of bias audit reports
```

---

## 11. FAQ

### Q1. What should I check when using AI-generated images commercially?

**A.** (1) **Tool license**: Verify that the plan allows commercial use (Midjourney: paid plan, Adobe Firefly: Creative Cloud, DALL-E: API terms of service). (2) **Similarity check**: Verify similarity with existing works using Google reverse image search or TinEye. (3) **Portrait rights**: Risk exists if resembling a real person. (4) **Disclosure obligation**: Disclose that content is AI-generated based on client or platform terms. (5) **IP indemnification**: Adobe Firefly provides IP Indemnification against intellectual property infringement, offering peace of mind for commercial use.

### Q2. What should I do if I become a victim of deepfakes?

**A.** (1) **Evidence preservation**: Record screenshots, URLs, and posting dates/times. (2) **Platform reporting**: Use each platform's deepfake reporting feature (Meta, Google, X have dedicated reporting forms). (3) **Legal action**: Consult a lawyer and consider filing for damages based on defamation or portrait rights infringement. In Japan, the 2023 Criminal Code amendment made the creation and distribution of sexual deepfakes punishable. (4) **Detection tools**: Supplement evidence with detection tools such as Sensity AI and Microsoft Video Authenticator.

### Q3. How can I mitigate bias in AI-generated content?

**A.** (1) **Prompt engineering**: Explicitly specify diversity with terms like "diverse group of people" or "various ethnicities and ages." (2) **Audit generation results**: Generate 100+ images and check the distribution of gender, race, and age. (3) **Negative prompts**: Exclude stereotypical expressions. (4) **Compare multiple models**: Compare results from different models to understand bias tendencies. (5) **Human review**: Ultimately have team members from diverse backgrounds review. Complete bias elimination is currently difficult, but conscious efforts can mitigate it.

### Q4. To what extent is AI training permitted under Japanese copyright law?

**A.** Japan's Copyright Act Article 30-4 permits use "where the purpose is not to personally enjoy or have others enjoy the thoughts or sentiments expressed in the work." AI machine learning is considered to fall under this provision, and in principle, works can be used for training without the rights holder's permission. However: (1) Exceptions apply when it unduly prejudices the interests of the copyright holder, (2) Infringement may occur when the generation stage produces output similar to specific copyrighted works, (3) The 2024 Cultural Council guidelines clarified that training for enjoyment purposes falls outside the scope of Article 30-4.

### Q5. How do I implement C2PA metadata in my own service?

**A.** (1) Using the **C2PA Rust SDK** (c2pa-rs) is the most popular method. Python bindings (c2pa-python) are also available. (2) Implementation steps include: (a) obtaining an X.509 certificate (from a certificate authority such as DigiCert), (b) manifest definition (creator information, tool information, action history), (c) embedding the manifest in content, (d) implementing a verification endpoint. (3) Supported formats include JPEG, PNG, WebP, AVIF, HEIF, MP4, MOV, etc. (4) Functionality can be verified using Adobe's Content Authenticity Initiative (CAI) Verify tool (https://contentauthenticity.org/verify).

### Q6. Is it legally problematic to use prompts that imitate a specific artist's style?

**A.** It is legally a gray zone but carries ethical and practical risks. (1) **Copyright law**: Style itself is not subject to copyright protection (idea/expression dichotomy). However, infringement is possible if the output closely resembles a specific work. (2) **Unfair competition prevention law**: Commercial content using an artist's name may constitute "misappropriation of a well-known indication." (3) **Ethical issues**: Style imitation against the artist's will damages community trust. (4) **Practical response**: Many platforms (Midjourney, etc.) are moving toward restricting living artist names in prompts. Describing style elements abstractly (e.g., "Impressionist style," "cyberpunk style") is recommended.

### Q7. How should internal training on AI-generated content usage be designed?

**A.** The following structure is recommended: (1) **Basics (all employees, 1 hour)**: Overview of AI-generated content, explanation of internal policy, clarification of prohibited items, understanding disclosure obligations. (2) **Practical (AI tool users, 2 hours)**: License conditions for each tool, practical workflow for copyright/portrait rights checks, how to attach C2PA metadata, bias audit procedures. (3) **Legal (managers/legal staff, 2 hours)**: Legal trends across countries, case law analysis, incident response procedures, how to read compliance reports. (4) **Regular updates (quarterly)**: Updates on legal amendments and case law, sharing of new tools and new risks, retrospective review of incident cases.

### Q8. What operational policy should consider environmental impact of AI image generation?

**A.** (1) **Prioritize lightweight models**: Distilled models such as SDXL Turbo, LCM (Latent Consistency Model), and FLUX.1 Schnell consume 50-80% less power. (2) **Staged generation**: Preview at low resolution/few steps, then generate at high quality after confirmation. (3) **Cache utilization**: Avoid regenerating identical/similar prompts by caching results. (4) **Region selection**: Select cloud regions with high renewable energy ratios (GCP: us-central1, AWS: eu-north-1, etc.). (5) **Carbon offsets**: Consider purchasing carbon offsets for large-scale generation projects. (6) **Quantitative monitoring**: Track monthly environmental impact using tools like EnvironmentalImpactCalculator.

---


## FAQ

### Q1: What is the most important point for learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Copyright | Rights attribution of AI-generated content varies by country/region. Human creative contribution is key |
| Training Data | Models with licensed data (Adobe Firefly) carry the lowest risk |
| Deepfakes | Technical countermeasures like C2PA and SynthID + legislation in progress |
| Portrait Rights | Written consent is mandatory for generating images of real persons. Be mindful of publicity rights |
| Bias | Mitigated through prompt design and generation result auditing. Complete elimination is difficult |
| Organizational Guidelines | Establish clear policies with three tiers: permitted/restricted/prohibited |
| Disclosure Obligations | Attach explicit labels and C2PA metadata to AI-generated content |
| Moderation | Prevent harmful content through multi-layered pre- and post-generation checks |
| Audit Logs | Ensure traceability of all generations and demonstrate compliance |
| Incident Response | Establish a staged response framework based on severity |

---

## Recommended Next Guides

- [Virtual Try-On](./02-virtual-try-on.md) -- The intersection of 3D + AI applications and portrait rights
- [Design Tools](../01-image/03-design-tools.md) -- Licenses and commercial use conditions for each tool
- [Video Editing](../02-video/01-video-editing.md) -- Ethical use of video AI

---

## References

1. **C2PA Technical Specification** -- https://c2pa.org/specifications/ -- Technical standard for content authentication
2. **Cultural Council 'Perspectives on AI and Copyright'** -- Agency for Cultural Affairs (2024) -- Japan's AI copyright guidelines
3. **EU AI Act** -- European Parliament (2024) -- EU AI regulation law
4. **The Ethics of Artificial Intelligence** -- Jobin et al. (Nature Machine Intelligence, 2019) -- International survey on AI ethics
5. **Generative AI and Copyright Law** -- Grimmelmann (Cornell Law Review, 2024) -- Legal theory on AI-generated content and copyright
6. **SynthID: Identifying AI-generated images** -- Pushkarna et al. (Google DeepMind, 2024) -- Digital watermarking technology
7. **Deepfakes and Disinformation** -- Chesney & Citron (California Law Review, 2019) -- Legal analysis of deepfakes
8. **Content Authenticity Initiative** -- https://contentauthenticity.org/ -- Content authentication ecosystem
9. **NIST AI Risk Management Framework** -- NIST AI 100-1 (2023) -- Standard framework for AI risk management
10. **Responsible AI Practices** -- Google AI (2023) -- Guidelines for responsible AI development
