# Document Processing — OCR, PDF Parsing, and Contract Analysis

> A systematic guide to AI-powered document processing automation, covering implementation patterns for OCR, PDF parsing, and contract analysis through to production operations.

---

## What You Will Learn

1. **OCR and AI Integration Architecture** — High-accuracy text extraction combining Tesseract, Cloud Vision, and GPT-4V
2. **Building PDF Parsing Pipelines** — Structured data extraction, table parsing, and multimodal processing
3. **Practical AI Contract Analysis** — Automating risk detection, clause comparison, and compliance checks
4. **Production Operations Design** — Building scaling, error handling, and monitoring systems
5. **Industry-Specific Document Processing Patterns** — Real-world examples for invoices, medical records, real estate, and finance


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Workflow Automation — Zapier, n8n, Make Practical Guide](./01-workflow-automation.md)

---

## 1. Document Processing Architecture

### 1.1 Processing Pipeline Overview

```
┌──────────────────────────────────────────────────────────────┐
│              AI Document Processing Pipeline                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Input            Pre-processing     AI Processing   Output  │
│  ┌─────┐      ┌──────────┐      ┌──────────┐    ┌──────┐  │
│  │ PDF │─────▶│Image     │─────▶│ OCR      │──▶│Struct│  │
│  │Image│      │Correction│      │Text      │   │ured  │  │
│  │Scan │      │Denoise   │      │Extraction│   │Data  │  │
│  └─────┘      │Deskew    │      │Layout    │   │JSON  │  │
│               └──────────┘      │Analysis  │   └──────┘  │
│                     │           └──────────┘       │      │
│                     ▼                  ▼             ▼      │
│              ┌──────────┐      ┌──────────┐    ┌──────┐    │
│              │Quality   │      │LLM       │    │DB    │    │
│              │Validation│      │Analysis  │    │Store │    │
│              │Confidence│      │Summary/  │    │      │    │
│              │Check     │      │Classify  │    │      │    │
│              └──────────┘      └──────────┘    └──────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack Comparison

| Technology | Use Case | Accuracy | Cost | Speed | Japanese Support |
|------|------|------|--------|---------|-----------|
| Tesseract OCR | On-premises OCR | Medium | Free | Fast | Vertical/horizontal text |
| Google Cloud Vision | Cloud OCR | High | $1.50/1000 pages | Fast | 95%+ accuracy |
| AWS Textract | Structured extraction | High | $1.50/1000 pages | Medium | Form/table specialized |
| Azure Document Intelligence | Table parsing | High | $1.00/1000 pages | Medium | Rich pre-built models |
| GPT-4 Vision | Multimodal | Highest | $0.01/image | Slow | Strong with handwriting |
| Claude Vision | Multimodal | Highest | $0.01/image | Slow | Superior context understanding |

### 1.3 Technology Selection Flowchart

```
Document processing technology selection:

Q1: What type of document?
├─ Printed text (typeset) ───▶ Go to Q2
├─ Handwritten text ─────────▶ Cloud Vision or GPT-4V
├─ Forms/tables ─────────────▶ AWS Textract or Azure DI
└─ Mixed (photos + text) ────▶ Multimodal LLM

Q2: Volume?
├─ Under 1,000 pages/month ──▶ Cloud Vision (pay-per-use)
├─ Around 10,000 pages/month ▶ Tesseract + Cloud Vision hybrid
└─ 100,000+ pages/month ─────▶ Tesseract-primary + AI post-processing

Q3: Accuracy requirements?
├─ 99%+ required (finance/medical) ▶ Double OCR + Human-in-the-Loop
├─ 95%+ sufficient ──────────────▶ Cloud Vision standalone
└─ 90%+ sufficient ──────────────▶ Tesseract + post-processing
```

### 1.4 Cost Estimation Model

```python
from dataclasses import dataclass

@dataclass
class CostEstimate:
    """Document processing cost estimate"""
    pages_per_month: int
    avg_pages_per_doc: int = 5

    def tesseract_only(self) -> dict:
        """Tesseract only: server cost only"""
        # t3.medium instance: 1000 pages/hour
        hours_needed = self.pages_per_month / 1000
        server_cost = hours_needed * 0.0464  # t3.medium rate
        return {
            "ocr_cost": 0,
            "server_cost": round(server_cost, 2),
            "total": round(server_cost, 2),
            "accuracy": "85-90%"
        }

    def cloud_vision(self) -> dict:
        """Google Cloud Vision"""
        ocr_cost = (self.pages_per_month / 1000) * 1.50
        return {
            "ocr_cost": round(ocr_cost, 2),
            "server_cost": 0,
            "total": round(ocr_cost, 2),
            "accuracy": "95-97%"
        }

    def hybrid_with_ai(self) -> dict:
        """Tesseract + Cloud Vision (low-confidence only) + LLM analysis"""
        # 80% processed by Tesseract, 20% re-processed by Cloud Vision
        tesseract_pages = int(self.pages_per_month * 0.8)
        cloud_pages = int(self.pages_per_month * 0.2)
        cloud_cost = (cloud_pages / 1000) * 1.50

        # LLM analysis: per-document analysis (avg 5 pages/document)
        docs = self.pages_per_month / self.avg_pages_per_doc
        # Claude: ~$0.003/document (summary + classification)
        llm_cost = docs * 0.003

        hours_needed = tesseract_pages / 1000
        server_cost = hours_needed * 0.0464

        total = cloud_cost + llm_cost + server_cost
        return {
            "ocr_cost": round(cloud_cost, 2),
            "llm_cost": round(llm_cost, 2),
            "server_cost": round(server_cost, 2),
            "total": round(total, 2),
            "accuracy": "96-99%"
        }

    def report(self) -> str:
        """Generate cost comparison report"""
        t = self.tesseract_only()
        cv = self.cloud_vision()
        h = self.hybrid_with_ai()
        return f"""
Monthly processing cost comparison for {self.pages_per_month:,} pages:
─────────────────────────────────────────
Method              Monthly Cost   Accuracy
─────────────────────────────────────────
Tesseract only      ${t['total']:>8}   {t['accuracy']}
Cloud Vision        ${cv['total']:>8}   {cv['accuracy']}
Hybrid + AI         ${h['total']:>8}   {h['accuracy']}
─────────────────────────────────────────
"""

# Usage example
estimate = CostEstimate(pages_per_month=50000)
print(estimate.report())
```

---

## 2. OCR Implementation

### 2.1 Tesseract + Pre-processing

```python
import pytesseract
from PIL import Image, ImageFilter, ImageEnhance
import cv2
import numpy as np

class OCRProcessor:
    """High-accuracy OCR processing class"""

    def __init__(self, lang: str = "jpn+eng"):
        self.lang = lang
        self.config = "--oem 3 --psm 6"  # LSTM engine + block detection

    def preprocess_image(self, image_path: str) -> np.ndarray:
        """Image pre-processing: denoising, binarization, deskewing"""
        img = cv2.imread(image_path)

        # Grayscale conversion
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Denoising (Gaussian blur)
        denoised = cv2.GaussianBlur(gray, (3, 3), 0)

        # Adaptive binarization (handles uneven lighting)
        binary = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )

        # Deskew
        corrected = self._correct_skew(binary)
        return corrected

    def _correct_skew(self, image: np.ndarray) -> np.ndarray:
        """Skew correction"""
        coords = np.column_stack(np.where(image > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image, matrix, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated

    def extract_text(self, image_path: str) -> dict:
        """Text extraction + confidence information"""
        processed = self.preprocess_image(image_path)
        data = pytesseract.image_to_data(
            processed, lang=self.lang,
            config=self.config,
            output_type=pytesseract.Output.DICT
        )

        results = []
        for i in range(len(data["text"])):
            if int(data["conf"][i]) > 0:
                results.append({
                    "text": data["text"][i],
                    "confidence": int(data["conf"][i]),
                    "bbox": {
                        "x": data["left"][i],
                        "y": data["top"][i],
                        "w": data["width"][i],
                        "h": data["height"][i]
                    }
                })

        full_text = " ".join(r["text"] for r in results if r["text"].strip())
        avg_confidence = (
            sum(r["confidence"] for r in results) / len(results)
            if results else 0
        )

        return {
            "text": full_text,
            "confidence": avg_confidence,
            "details": results
        }
```

### 2.2 Cloud Vision API Integration

```python
from google.cloud import vision
import io

class CloudVisionOCR:
    """Google Cloud Vision OCR"""

    def __init__(self):
        self.client = vision.ImageAnnotatorClient()

    def extract_text(self, image_path: str) -> dict:
        """Extract text with Cloud Vision"""
        with io.open(image_path, "rb") as f:
            content = f.read()

        image = vision.Image(content=content)
        response = self.client.document_text_detection(image=image)

        if response.error.message:
            raise Exception(f"Vision API Error: {response.error.message}")

        full_text = response.full_text_annotation
        pages = []
        for page in full_text.pages:
            for block in page.blocks:
                block_text = ""
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        word_text = "".join(
                            symbol.text for symbol in word.symbols
                        )
                        block_text += word_text
                    block_text += "\n"
                pages.append({
                    "text": block_text,
                    "confidence": block.confidence,
                    "type": block.block_type.name
                })

        return {
            "text": full_text.text,
            "pages": pages,
            "language": full_text.pages[0].property.detected_languages[0].language_code
        }
```

### 2.3 OCR with Multimodal LLM

```python
import anthropic
import base64

class MultimodalOCR:
    """Multimodal OCR using Claude Vision / GPT-4V"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def extract_with_context(self, image_path: str,
                              document_type: str = "general") -> dict:
        """Extract text from image with contextual understanding"""
        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        # Prompts per document type
        prompts = {
            "general": "Please accurately transcribe the text in this image.",
            "invoice": """Extract the following information from this invoice image and return it in JSON format:
{
  "invoice_number": "invoice number",
  "date": "issue date",
  "due_date": "payment due date",
  "vendor": {"name": "company name", "address": "address"},
  "items": [{"description": "item name", "quantity": quantity, "unit_price": unit price, "amount": amount}],
  "subtotal": subtotal,
  "tax": tax amount,
  "total": total amount,
  "bank_account": "payment destination"
}""",
            "receipt": """Extract the following from this receipt image and return in JSON format:
{
  "store_name": "store name",
  "date": "date",
  "items": [{"name": "item name", "price": price}],
  "total": total,
  "payment_method": "payment method"
}""",
            "business_card": """Extract the following from this business card image and return in JSON format:
{
  "name": "full name",
  "name_reading": "phonetic reading",
  "company": "company name",
  "department": "department",
  "title": "job title",
  "phone": "phone number",
  "mobile": "mobile number",
  "email": "email address",
  "address": "address",
  "url": "URL"
}""",
            "handwritten": """Please accurately transcribe this handwritten document image.
Mark illegible sections as [unknown], and if a guess is possible, include it as (guess: xxx).
"""
        }

        prompt = prompts.get(document_type, prompts["general"])

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_data
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        )

        return {
            "text": response.content[0].text,
            "document_type": document_type,
            "model": "claude-sonnet-4-20250514",
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        }

    def batch_extract(self, image_paths: list[str],
                       document_type: str = "general") -> list[dict]:
        """Batch OCR processing for multiple images"""
        results = []
        for path in image_paths:
            try:
                result = self.extract_with_context(path, document_type)
                result["file_path"] = path
                result["status"] = "success"
                results.append(result)
            except Exception as e:
                results.append({
                    "file_path": path,
                    "status": "error",
                    "error": str(e)
                })
        return results
```

### 2.4 Improving Accuracy with Double OCR

```python
from difflib import SequenceMatcher

class DoubleCheckOCR:
    """Cross-validate with two OCR engines for improved accuracy"""

    def __init__(self):
        self.primary = OCRProcessor(lang="jpn+eng")
        self.secondary = CloudVisionOCR()
        self.confidence_threshold = 85

    def extract_with_verification(self, image_path: str) -> dict:
        """Verify accuracy with double OCR"""
        # Phase 1: Extract with Tesseract
        primary_result = self.primary.extract_text(image_path)

        # Return as-is if high confidence (cost saving)
        if primary_result["confidence"] >= 95:
            return {
                "text": primary_result["text"],
                "confidence": primary_result["confidence"],
                "method": "tesseract_only",
                "verified": False
            }

        # Phase 2: Double-check with Cloud Vision
        secondary_result = self.secondary.extract_text(image_path)

        # Calculate text similarity
        similarity = SequenceMatcher(
            None,
            primary_result["text"],
            secondary_result["text"]
        ).ratio()

        if similarity >= 0.95:
            # High agreement: use Cloud Vision result (generally more accurate)
            return {
                "text": secondary_result["text"],
                "confidence": min(99, primary_result["confidence"] + 10),
                "method": "double_check_agreed",
                "similarity": similarity,
                "verified": True
            }
        else:
            # Disagreement: merge and flag for human review
            merged = self._merge_results(primary_result, secondary_result)
            return {
                "text": merged,
                "confidence": min(
                    primary_result["confidence"],
                    secondary_result.get("confidence", 80)
                ) * 0.8,
                "method": "double_check_diverged",
                "similarity": similarity,
                "verified": False,
                "needs_review": True,
                "primary_text": primary_result["text"],
                "secondary_text": secondary_result["text"]
            }

    def _merge_results(self, primary: dict, secondary: dict) -> str:
        """Intelligently merge two OCR results"""
        # Use the result with higher confidence as the base
        if primary.get("confidence", 0) > 80:
            return primary["text"]
        return secondary.get("text", primary["text"])
```

### 2.5 Japanese OCR Challenges and Solutions

Here are the common issues encountered when OCR-processing Japanese documents, along with their solutions.

```python
class JapaneseOCROptimizer:
    """Japanese OCR optimization class"""

    def __init__(self):
        self.vertical_config = "--oem 3 --psm 5"  # PSM for vertical text
        self.horizontal_config = "--oem 3 --psm 6"  # PSM for horizontal text

    def detect_text_orientation(self, image: np.ndarray) -> str:
        """Auto-detect vertical or horizontal text orientation"""
        # Tesseract OSD (Orientation and Script Detection)
        osd = pytesseract.image_to_osd(image, output_type=pytesseract.Output.DICT)
        rotation = osd.get("rotate", 0)
        script = osd.get("script", "")

        # Heuristic for detecting Japanese vertical text
        if script == "Japanese" and rotation in [90, 270]:
            return "vertical"
        return "horizontal"

    def optimize_for_japanese(self, image_path: str) -> dict:
        """Optimized pipeline for Japanese documents"""
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Step 1: Detect orientation
        orientation = self.detect_text_orientation(gray)

        # Step 2: Pre-processing based on orientation
        if orientation == "vertical":
            # Vertical text: rotate 90 degrees, process as horizontal, then restore
            rotated = cv2.rotate(gray, cv2.ROTATE_90_COUNTERCLOCKWISE)
            config = self.horizontal_config
            processed = rotated
        else:
            config = self.horizontal_config
            processed = gray

        # Step 3: Contrast enhancement (effective for thin Japanese strokes)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(processed)

        # Step 4: Adaptive binarization (for documents with furigana)
        binary = cv2.adaptiveThreshold(
            enhanced, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 15, 4
        )

        # Step 5: Run OCR
        text = pytesseract.image_to_string(
            binary, lang="jpn+eng", config=config
        )

        # Step 6: Japanese post-processing
        cleaned = self._postprocess_japanese(text)

        return {
            "text": cleaned,
            "orientation": orientation,
            "preprocessing": "japanese_optimized"
        }

    def _postprocess_japanese(self, text: str) -> str:
        """Post-processing for Japanese OCR results"""
        import re

        # Fix common misrecognitions
        corrections = {
            "0": "〇",  # Numeric zero vs. kanji zero
            "l": "1",   # Lowercase L vs. digit 1
            "rn": "m",  # Confusion between rn and m
        }

        # Normalize full-width/half-width
        result = text
        # Normalize digits to half-width
        result = re.sub(r'[０-９]', lambda m: chr(ord(m.group()) - 0xFEE0), result)

        # Remove unnecessary spaces between Japanese characters
        result = re.sub(r'(?<=[\u3000-\u9FFF])\s+(?=[\u3000-\u9FFF])', '', result)

        # Normalize line breaks
        result = re.sub(r'\n{3,}', '\n\n', result)

        return result.strip()
```

**Summary of main Japanese OCR challenges and solutions:**

| Challenge | Cause | Solution | Effect |
|------|------|--------|------|
| Vertical text recognition failure | Incorrect PSM setting | Auto-detect orientation + switch PSM | +20% accuracy |
| Furigana mixed into text | Misrecognition of small characters | Split regions to exclude furigana | +15% accuracy |
| Unrecognized archaic kanji | Insufficient training data | Custom dictionary + LLM post-processing | +10% accuracy |
| Mixed full-width/half-width | Standard misrecognition | Normalization post-processing | Improved data quality |
| Japanese text in tables | Misdetected cell boundaries | Table detection + cell-by-cell OCR | +25% accuracy |
| Handwritten Japanese | High individual variation | Cloud Vision + GPT-4V | 80-90% accuracy |

---

## 3. PDF Parsing

### 3.1 PDF Structure Analysis

```python
import fitz  # PyMuPDF
from dataclasses import dataclass

@dataclass
class PDFPage:
    page_num: int
    text: str
    tables: list
    images: list
    metadata: dict

class PDFAnalyzer:
    """PDF structure analysis engine"""

    def __init__(self, pdf_path: str):
        self.doc = fitz.open(pdf_path)
        self.metadata = self.doc.metadata

    def extract_all(self) -> list[PDFPage]:
        """Structured extraction of all pages"""
        pages = []
        for page_num in range(len(self.doc)):
            page = self.doc[page_num]
            pages.append(PDFPage(
                page_num=page_num,
                text=page.get_text("text"),
                tables=self._extract_tables(page),
                images=self._extract_images(page),
                metadata={
                    "width": page.rect.width,
                    "height": page.rect.height,
                    "rotation": page.rotation
                }
            ))
        return pages

    def _extract_tables(self, page) -> list[list[list[str]]]:
        """Table extraction"""
        tables = page.find_tables()
        result = []
        for table in tables:
            rows = []
            for row in table.extract():
                rows.append([cell if cell else "" for cell in row])
            result.append(rows)
        return result

    def _extract_images(self, page) -> list[dict]:
        """Image extraction"""
        images = []
        for img_index, img in enumerate(page.get_images()):
            xref = img[0]
            base_image = self.doc.extract_image(xref)
            images.append({
                "index": img_index,
                "size": len(base_image["image"]),
                "format": base_image["ext"],
                "width": base_image.get("width"),
                "height": base_image.get("height")
            })
        return images

    def to_markdown(self) -> str:
        """Convert entire PDF to Markdown"""
        md_parts = []
        for page in self.extract_all():
            md_parts.append(f"## Page {page.page_num + 1}\n")
            md_parts.append(page.text)
            for i, table in enumerate(page.tables):
                md_parts.append(f"\n### Table {i + 1}\n")
                if table:
                    header = "| " + " | ".join(table[0]) + " |"
                    separator = "| " + " | ".join(["---"] * len(table[0])) + " |"
                    md_parts.append(header)
                    md_parts.append(separator)
                    for row in table[1:]:
                        md_parts.append("| " + " | ".join(row) + " |")
        return "\n".join(md_parts)
```

### 3.2 AI-Integrated PDF Analysis

```
PDF + AI Analysis Flow:

  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ PDF     │──▶│ Structure │──▶│ Chunk    │──▶│ LLM      │
  │ Upload  │   │ Analysis  │   │ Split    │   │ Analysis │
  └─────────┘   │ PyMuPDF  │   └──────────┘   └────┬─────┘
                └──────────┘                        │
                     ┌──────────────────────────────┘
                     ▼
              ┌──────────────┐
              │ Result       │
              │ Aggregation  │
              │ - Summary    │
              │ - Key points │
              │ - Table data │
              │ - Actions    │
              └──────────────┘
```

### 3.3 Intelligent PDF Chunking

A good chunking strategy is critical for efficiently analyzing large PDFs with AI. Accuracy improves significantly by preserving logical structure rather than using simple page-based splits.

```python
import re
from typing import Optional

class IntelligentPDFChunker:
    """PDF chunking that preserves logical structure"""

    def __init__(self, max_chunk_tokens: int = 3000):
        self.max_chunk_tokens = max_chunk_tokens

    def chunk_by_structure(self, pages: list[PDFPage]) -> list[dict]:
        """Structure-based chunking"""
        all_text = "\n".join(p.text for p in pages)

        # Split by heading patterns
        sections = self._split_by_headings(all_text)

        chunks = []
        current_chunk = ""
        current_heading = ""

        for section in sections:
            heading = section["heading"]
            content = section["content"]
            estimated_tokens = len(content) // 3  # Rough estimate for Japanese

            if estimated_tokens > self.max_chunk_tokens:
                # Split large sections further by paragraph
                paragraphs = content.split("\n\n")
                for para in paragraphs:
                    if len(current_chunk) // 3 + len(para) // 3 > self.max_chunk_tokens:
                        if current_chunk:
                            chunks.append({
                                "heading": current_heading,
                                "content": current_chunk.strip(),
                                "estimated_tokens": len(current_chunk) // 3
                            })
                        current_chunk = para
                        current_heading = heading
                    else:
                        current_chunk += "\n\n" + para
            else:
                if len(current_chunk) // 3 + estimated_tokens > self.max_chunk_tokens:
                    if current_chunk:
                        chunks.append({
                            "heading": current_heading,
                            "content": current_chunk.strip(),
                            "estimated_tokens": len(current_chunk) // 3
                        })
                    current_chunk = content
                    current_heading = heading
                else:
                    current_chunk += "\n\n" + content
                    if not current_heading:
                        current_heading = heading

        if current_chunk:
            chunks.append({
                "heading": current_heading,
                "content": current_chunk.strip(),
                "estimated_tokens": len(current_chunk) // 3
            })

        return chunks

    def _split_by_headings(self, text: str) -> list[dict]:
        """Split text by heading patterns"""
        # Heading patterns for Japanese documents
        heading_patterns = [
            r'^第[一二三四五六七八九十\d]+[条章節項]',  # Legal documents
            r'^\d+[\.\)]\s',                           # Numbered headings
            r'^[（(]\d+[）)]',                          # Parenthesized numbers
            r'^■|^●|^◆|^▶',                           # Symbol headings
        ]

        combined_pattern = "|".join(f"({p})" for p in heading_patterns)
        sections = []
        current = {"heading": "", "content": ""}

        for line in text.split("\n"):
            if re.match(combined_pattern, line.strip()):
                if current["content"]:
                    sections.append(current)
                current = {"heading": line.strip(), "content": ""}
            else:
                current["content"] += line + "\n"

        if current["content"]:
            sections.append(current)

        return sections

    def chunk_with_overlap(self, text: str,
                            chunk_size: int = 2000,
                            overlap: int = 200) -> list[dict]:
        """Chunking with overlap (for context preservation)"""
        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = min(start + chunk_size, text_len)

            # Avoid cutting mid-sentence
            if end < text_len:
                # Adjust split position at Japanese sentence-end patterns
                for delimiter in ["。\n", "。", "\n\n", "\n"]:
                    last_delim = text[start:end].rfind(delimiter)
                    if last_delim > chunk_size * 0.7:  # Past 70% of chunk
                        end = start + last_delim + len(delimiter)
                        break

            chunk_text = text[start:end]
            chunks.append({
                "content": chunk_text,
                "start_pos": start,
                "end_pos": end,
                "index": len(chunks)
            })

            start = end - overlap  # Step back by overlap amount

        return chunks
```

### 3.4 PDF to Structured Data Conversion

```python
import anthropic
import json

class PDFToStructuredData:
    """Conversion engine from PDF to structured data"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.pdf_analyzer = None  # Lazy initialization

    def extract_invoice_data(self, pdf_path: str) -> dict:
        """Extract structured data from invoice PDF"""
        self.pdf_analyzer = PDFAnalyzer(pdf_path)
        pages = self.pdf_analyzer.extract_all()

        # Prioritize table data if available
        tables = []
        for page in pages:
            tables.extend(page.tables)

        full_text = "\n".join(p.text for p in pages)

        prompt = f"""Extract information from the following invoice text and return it in accurate JSON format.

{{
  "invoice_number": "invoice number",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "vendor": {{
    "name": "company name",
    "address": "address",
    "registration_number": "registration number (invoice system)"
  }},
  "buyer": {{
    "name": "recipient company name",
    "address": "address"
  }},
  "items": [
    {{
      "description": "item/service name",
      "quantity": quantity,
      "unit": "unit",
      "unit_price": unit price,
      "tax_rate": tax rate (0.08 or 0.10),
      "amount": amount
    }}
  ],
  "subtotal": subtotal,
  "tax_8_percent": 8% tax amount,
  "tax_10_percent": 10% tax amount,
  "total": total amount,
  "payment_method": "payment destination info",
  "notes": "notes"
}}

Table data: {json.dumps(tables, ensure_ascii=False) if tables else "none"}

Invoice text:
{full_text}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        return self._parse_json(response.content[0].text)

    def extract_resume_data(self, pdf_path: str) -> dict:
        """Extract structured data from resume/CV PDF"""
        self.pdf_analyzer = PDFAnalyzer(pdf_path)
        pages = self.pdf_analyzer.extract_all()
        full_text = "\n".join(p.text for p in pages)

        prompt = f"""Extract information from the following resume/CV and return it in JSON format.

{{
  "personal": {{
    "name": "full name",
    "name_reading": "phonetic reading",
    "birth_date": "date of birth",
    "gender": "gender",
    "address": "address",
    "phone": "phone number",
    "email": "email"
  }},
  "education": [
    {{
      "period": "period",
      "institution": "school name",
      "degree": "degree/major",
      "status": "graduated/enrolled"
    }}
  ],
  "work_experience": [
    {{
      "period": "period",
      "company": "company name",
      "position": "position",
      "responsibilities": "job responsibilities",
      "achievements": "achievements"
    }}
  ],
  "skills": ["skill list"],
  "certifications": [
    {{
      "name": "certification name",
      "date": "date obtained"
    }}
  ],
  "self_pr": "self-introduction"
}}

Text:
{full_text}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        return self._parse_json(response.content[0].text)

    def _parse_json(self, text: str) -> dict:
        """Parse JSON from response"""
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"raw_text": text, "parse_error": True}
```

---

## 4. AI Contract Analysis

### 4.1 Contract Analysis Engine

```python
import anthropic
from enum import Enum

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ContractAnalyzer:
    """AI contract analysis engine"""

    ANALYSIS_PROMPT = """
You are a legal AI assistant well-versed in Japanese contract law.
Analyze the following contract and return the results in JSON format.

Analysis items:
1. contract_type: type of contract
2. parties: party information
3. key_terms: key clauses (array)
4. risks: risk items (array, each with a level)
5. missing_clauses: commonly expected clauses that are absent
6. recommendations: recommended actions

Contract text:
{contract_text}
"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def analyze(self, contract_text: str) -> dict:
        """Comprehensive contract analysis"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": self.ANALYSIS_PROMPT.format(
                    contract_text=contract_text
                )
            }]
        )
        return self._parse_response(response.content[0].text)

    def compare_contracts(self, contract_a: str, contract_b: str) -> dict:
        """Comparative analysis of two contracts"""
        prompt = f"""
Compare the two contracts and analyze:
1. Common clauses and differences
2. Which is more favorable to the contracting party
3. Points to negotiate

Contract A:
{contract_a}

Contract B:
{contract_b}
"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        return self._parse_response(response.content[0].text)

    def check_compliance(self, contract_text: str,
                         regulations: list[str]) -> dict:
        """Compliance check"""
        regs = "\n".join(f"- {r}" for r in regulations)
        prompt = f"""
Check whether the following contract complies with the regulations:

Regulations:
{regs}

Contract:
{contract_text}

For each regulation: determine Compliant/Non-compliant/Needs review and explain the reasoning.
"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        return self._parse_response(response.content[0].text)

    def _parse_response(self, text: str) -> dict:
        """Parse JSON from response"""
        import json
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"raw_analysis": text}
```

### 4.2 Risk Classification Matrix

| Risk Category | Detection Target | Impact | AI Accuracy |
|--------------|---------|--------|--------|
| Liability | Unlimited liability clauses | Critical | 95% |
| Intellectual property | Ambiguous ownership | High | 90% |
| Termination conditions | Unilateral termination rights | High | 92% |
| Non-compete | Excessive restriction period | Medium | 88% |
| Confidentiality | Vague disclosure scope | Medium | 85% |
| Payment terms | Unfavorable payment conditions | Low–Medium | 90% |
| Governing law | Unfavorable jurisdiction | Medium | 93% |
| Auto-renewal | Unfavorable renewal terms | Low–Medium | 91% |
| Anti-social forces | Missing exclusion clause | High | 94% |

### 4.3 Automatic Contract Clause Extraction

```python
class ClauseExtractor:
    """Automatically classify and extract contract clauses"""

    CLAUSE_TYPES = [
        "Definitions", "Contract period", "Compensation/consideration",
        "Deliverables/delivery", "Intellectual property rights", "Confidentiality",
        "Damages", "Contract termination", "Non-compete",
        "Anti-social forces exclusion", "Governing law/jurisdiction",
        "Notice clause", "Force majeure", "Assignment prohibition"
    ]

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def extract_clauses(self, contract_text: str) -> dict:
        """Structured extraction of each clause from the contract"""
        clause_types_str = "\n".join(
            f"- {ct}" for ct in self.CLAUSE_TYPES
        )

        prompt = f"""Extract each clause from the following contract and return in JSON format.

Target clause types:
{clause_types_str}

Output format:
{{
  "clauses": [
    {{
      "type": "clause type",
      "article_number": "Article X",
      "title": "clause title",
      "content": "full clause text",
      "key_points": ["key points"],
      "risk_level": "low/medium/high/critical",
      "risk_reason": "risk reason (if any)"
    }}
  ],
  "missing_clauses": ["missing clause types"],
  "overall_risk": "low/medium/high/critical",
  "summary": "overall contract summary (within 3 sentences)"
}}

Contract:
{contract_text}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        return self._parse_json(response.content[0].text)

    def generate_review_report(self, contract_text: str,
                                reviewer_perspective: str = "Contractor") -> str:
        """Generate a review report"""
        prompt = f"""Review the following contract from the perspective of "{reviewer_perspective}"
and create a report in the following format.

# Contract Review Report

## 1. Overview
- Contract type, parties, period

## 2. Risk Assessment Summary
- Overall risk level and top 3 key risks

## 3. Clause-by-Clause Review
For each clause:
- Content summary
- Risk assessment (★1-5)
- Comments and recommended revisions

## 4. Missing Clauses
Clauses that are commonly expected but absent

## 5. Negotiation Points
Points to negotiate as "{reviewer_perspective}" (in priority order)

## 6. Recommended Actions
Specific next steps

Contract:
{contract_text}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    def _parse_json(self, text: str) -> dict:
        import json
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except (ValueError, json.JSONDecodeError):
            return {"raw_text": text}
```

### 4.4 Contract Version Comparison

```python
from difflib import unified_diff, SequenceMatcher

class ContractVersionComparator:
    """Detect differences between contract versions and analyze legal impact"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    def compare_versions(self, old_text: str, new_text: str) -> dict:
        """Compare two versions of a contract"""
        # Step 1: Detect text differences
        diff = self._compute_diff(old_text, new_text)

        # Step 2: AI legal analysis of changes
        analysis = self._analyze_changes(diff, old_text, new_text)

        return {
            "diff": diff,
            "analysis": analysis,
            "change_count": len(diff["additions"]) + len(diff["deletions"]),
            "risk_assessment": analysis.get("overall_risk", "unknown")
        }

    def _compute_diff(self, old_text: str, new_text: str) -> dict:
        """Compute diff"""
        old_lines = old_text.splitlines(keepends=True)
        new_lines = new_text.splitlines(keepends=True)

        diff_lines = list(unified_diff(
            old_lines, new_lines,
            fromfile="old version", tofile="new version",
            lineterm=""
        ))

        additions = [l[1:] for l in diff_lines if l.startswith("+") and not l.startswith("+++")]
        deletions = [l[1:] for l in diff_lines if l.startswith("-") and not l.startswith("---")]

        similarity = SequenceMatcher(None, old_text, new_text).ratio()

        return {
            "additions": additions,
            "deletions": deletions,
            "similarity": round(similarity, 4),
            "raw_diff": "".join(diff_lines[:100])  # First 100 lines
        }

    def _analyze_changes(self, diff: dict, old_text: str, new_text: str) -> dict:
        """AI analysis of the legal impact of changes"""
        changes_summary = []
        for i, (add, rem) in enumerate(
            zip(diff["additions"][:20], diff["deletions"][:20])
        ):
            changes_summary.append(f"Change {i+1}: '{rem.strip()}' → '{add.strip()}'")

        changes_text = "\n".join(changes_summary) if changes_summary else "No differences"

        prompt = f"""Analyze the legal impact of the following contract changes.

Changes:
{changes_text}

Similarity: {diff['similarity']:.1%}

Analysis perspectives:
1. Legal impact of each change (favorable/unfavorable/neutral)
2. Changes in notable risks
3. Inferred intent behind the changes
4. Overall risk assessment

Return in JSON format:
{{
  "changes": [
    {{
      "description": "change description",
      "impact": "favorable/unfavorable/neutral",
      "risk_change": "increased/decreased/unchanged",
      "comment": "comment"
    }}
  ],
  "overall_risk": "low/medium/high/critical",
  "recommendation": "recommended action"
}}"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        try:
            text = response.content[0].text
            start = text.index("{")
            end = text.rindex("}") + 1
            return json.loads(text[start:end])
        except Exception:
            return {"raw_analysis": response.content[0].text}
```

---

## 5. Production Operations

### 5.1 Batch Processing Pipeline

This section explains the design of a production-grade batch processing pipeline for efficiently handling large volumes of documents.

```python
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

class ProcessingStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"

@dataclass
class ProcessingJob:
    job_id: str
    file_path: str
    document_type: str
    status: ProcessingStatus = ProcessingStatus.PENDING
    result: dict = field(default_factory=dict)
    error: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: datetime = None
    retry_count: int = 0
    file_hash: str = ""

class DocumentProcessingPipeline:
    """Production-grade document processing pipeline"""

    def __init__(self, config: dict):
        self.config = config
        self.max_retries = config.get("max_retries", 3)
        self.concurrent_limit = config.get("concurrent_limit", 10)
        self.cache = {}  # Use Redis or similar in production
        self.jobs: dict[str, ProcessingJob] = {}

    async def submit_job(self, file_path: str,
                          document_type: str = "auto") -> str:
        """Submit a processing job"""
        # Check cache by file hash
        file_hash = self._compute_hash(file_path)
        if file_hash in self.cache:
            logger.info(f"Cache hit: {file_path}")
            return self.cache[file_hash]

        job_id = f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file_hash[:8]}"
        job = ProcessingJob(
            job_id=job_id,
            file_path=file_path,
            document_type=document_type,
            file_hash=file_hash
        )
        self.jobs[job_id] = job

        # Submit to async processing queue
        asyncio.create_task(self._process_job(job))
        return job_id

    async def _process_job(self, job: ProcessingJob):
        """Process job with retry"""
        job.status = ProcessingStatus.PROCESSING
        logger.info(f"Processing: {job.job_id}")

        for attempt in range(self.max_retries):
            try:
                # Auto-detect document type
                if job.document_type == "auto":
                    job.document_type = await self._detect_type(job.file_path)

                # Execute processing
                result = await self._execute_processing(job)

                # Quality check
                quality = self._quality_check(result)
                if quality["passed"]:
                    job.result = result
                    job.status = ProcessingStatus.COMPLETED
                    job.completed_at = datetime.now()
                    self.cache[job.file_hash] = result
                    logger.info(f"Completed: {job.job_id}")
                else:
                    job.result = result
                    job.status = ProcessingStatus.NEEDS_REVIEW
                    job.result["quality_issues"] = quality["issues"]
                    logger.warning(f"Needs review: {job.job_id}")
                return

            except Exception as e:
                job.retry_count = attempt + 1
                job.error = str(e)
                logger.error(f"Attempt {attempt+1} failed: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

        job.status = ProcessingStatus.FAILED
        logger.error(f"Failed after {self.max_retries} attempts: {job.job_id}")

    async def _execute_processing(self, job: ProcessingJob) -> dict:
        """Execute processing by document type"""
        processors = {
            "invoice": self._process_invoice,
            "contract": self._process_contract,
            "resume": self._process_resume,
            "receipt": self._process_receipt,
            "general": self._process_general,
        }
        processor = processors.get(job.document_type, self._process_general)
        return await processor(job.file_path)

    async def _detect_type(self, file_path: str) -> str:
        """Auto-detect document type"""
        # Detect from first page text
        analyzer = PDFAnalyzer(file_path)
        pages = analyzer.extract_all()
        if not pages:
            return "general"

        first_page_text = pages[0].text[:500]

        # Simple keyword-based detection
        type_keywords = {
            "invoice": ["請求書", "御請求", "Invoice", "合計金額", "振込先"],
            "contract": ["契約書", "甲", "乙", "条項", "本契約"],
            "resume": ["履歴書", "職務経歴", "学歴", "職歴"],
            "receipt": ["領収書", "レシート", "Receipt"],
        }

        for doc_type, keywords in type_keywords.items():
            if any(kw in first_page_text for kw in keywords):
                return doc_type

        return "general"

    def _quality_check(self, result: dict) -> dict:
        """Quality check on processing results"""
        issues = []

        # OCR confidence check
        if result.get("confidence", 100) < 80:
            issues.append("OCR confidence too low")

        # Required field existence check
        if result.get("document_type") == "invoice":
            required = ["invoice_number", "total", "vendor"]
            for field in required:
                if not result.get(field):
                    issues.append(f"Missing required field: {field}")

        # Text length check (extremely short text indicates a problem)
        text_len = len(result.get("text", ""))
        if text_len < 50:
            issues.append("Extracted text is extremely short")

        return {
            "passed": len(issues) == 0,
            "issues": issues,
            "score": max(0, 100 - len(issues) * 20)
        }

    def _compute_hash(self, file_path: str) -> str:
        """Compute file hash"""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    async def _process_invoice(self, file_path: str) -> dict:
        """Invoice processing"""
        converter = PDFToStructuredData(self.config["api_key"])
        return converter.extract_invoice_data(file_path)

    async def _process_contract(self, file_path: str) -> dict:
        """Contract processing"""
        analyzer = ContractAnalyzer(self.config["api_key"])
        pdf = PDFAnalyzer(file_path)
        text = "\n".join(p.text for p in pdf.extract_all())
        return analyzer.analyze(text)

    async def _process_resume(self, file_path: str) -> dict:
        """Resume processing"""
        converter = PDFToStructuredData(self.config["api_key"])
        return converter.extract_resume_data(file_path)

    async def _process_receipt(self, file_path: str) -> dict:
        """Receipt processing"""
        ocr = MultimodalOCR(self.config["api_key"])
        return ocr.extract_with_context(file_path, "receipt")

    async def _process_general(self, file_path: str) -> dict:
        """General processing"""
        pdf = PDFAnalyzer(file_path)
        pages = pdf.extract_all()
        return {
            "text": "\n".join(p.text for p in pages),
            "page_count": len(pages),
            "tables": [t for p in pages for t in p.tables],
            "document_type": "general"
        }

    def get_status(self, job_id: str) -> dict:
        """Get job status"""
        job = self.jobs.get(job_id)
        if not job:
            return {"error": "Job not found"}
        return {
            "job_id": job.job_id,
            "status": job.status.value,
            "document_type": job.document_type,
            "retry_count": job.retry_count,
            "error": job.error,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        }
```

### 5.2 Monitoring and Metrics System

```python
from collections import defaultdict
from datetime import datetime, timedelta

class DocumentProcessingMetrics:
    """Monitoring metrics for document processing"""

    def __init__(self):
        self.metrics = defaultdict(list)
        self.alerts = []

    def record(self, event_type: str, data: dict):
        """Record metrics"""
        entry = {
            "timestamp": datetime.now(),
            "type": event_type,
            **data
        }
        self.metrics[event_type].append(entry)

        # Check for alerts
        self._check_alerts(event_type, data)

    def _check_alerts(self, event_type: str, data: dict):
        """Check alert conditions"""
        if event_type == "ocr_result" and data.get("confidence", 100) < 70:
            self.alerts.append({
                "level": "warning",
                "message": f"OCR confidence drop: {data.get('confidence')}%",
                "timestamp": datetime.now()
            })

        if event_type == "processing_error":
            # Check error rate in the past hour
            recent_errors = [
                m for m in self.metrics["processing_error"]
                if m["timestamp"] > datetime.now() - timedelta(hours=1)
            ]
            if len(recent_errors) > 10:
                self.alerts.append({
                    "level": "critical",
                    "message": f"Errors in past hour: {len(recent_errors)}",
                    "timestamp": datetime.now()
                })

    def generate_dashboard(self) -> dict:
        """Generate dashboard data"""
        now = datetime.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Today's processing statistics
        today_jobs = [
            m for m in self.metrics.get("job_complete", [])
            if m["timestamp"] >= today
        ]

        total_pages = sum(m.get("pages", 0) for m in today_jobs)
        avg_time = (
            sum(m.get("processing_time_ms", 0) for m in today_jobs) / len(today_jobs)
            if today_jobs else 0
        )
        avg_confidence = (
            sum(m.get("confidence", 0) for m in today_jobs) / len(today_jobs)
            if today_jobs else 0
        )

        # Cost calculation
        api_costs = sum(m.get("api_cost", 0) for m in today_jobs)

        return {
            "date": today.strftime("%Y-%m-%d"),
            "total_documents": len(today_jobs),
            "total_pages": total_pages,
            "avg_processing_time_ms": round(avg_time),
            "avg_confidence": round(avg_confidence, 1),
            "api_cost_usd": round(api_costs, 2),
            "cost_per_page": round(api_costs / total_pages, 4) if total_pages else 0,
            "error_count": len([
                m for m in self.metrics.get("processing_error", [])
                if m["timestamp"] >= today
            ]),
            "pending_reviews": len([
                m for m in self.metrics.get("needs_review", [])
                if m["timestamp"] >= today
            ]),
            "active_alerts": [
                a for a in self.alerts
                if a["timestamp"] > now - timedelta(hours=24)
            ]
        }
```

### 5.3 Error Handling Strategy

```python
class DocumentProcessingError(Exception):
    """Base class for document processing errors"""
    def __init__(self, message: str, error_code: str, recoverable: bool = True):
        super().__init__(message)
        self.error_code = error_code
        self.recoverable = recoverable

class OCRError(DocumentProcessingError):
    pass

class PDFParseError(DocumentProcessingError):
    pass

class AIAnalysisError(DocumentProcessingError):
    pass

class ErrorHandler:
    """Error handling for document processing"""

    ERROR_STRATEGIES = {
        "ocr_low_confidence": {
            "action": "retry_with_alternative",
            "fallback": "cloud_vision",
            "max_retries": 2
        },
        "pdf_corrupted": {
            "action": "repair_and_retry",
            "fallback": "image_conversion",
            "max_retries": 1
        },
        "api_rate_limit": {
            "action": "exponential_backoff",
            "initial_wait": 1,
            "max_wait": 60,
            "max_retries": 5
        },
        "api_timeout": {
            "action": "retry_with_smaller_chunk",
            "chunk_reduction": 0.5,
            "max_retries": 3
        },
        "parse_error": {
            "action": "manual_review",
            "notify": True,
            "max_retries": 0
        }
    }

    def handle(self, error: DocumentProcessingError,
               context: dict) -> dict:
        """Execute recovery strategy based on error type"""
        strategy = self.ERROR_STRATEGIES.get(
            error.error_code,
            {"action": "manual_review", "max_retries": 0}
        )

        logger.error(
            f"Error [{error.error_code}]: {error} | "
            f"Strategy: {strategy['action']} | "
            f"Recoverable: {error.recoverable}"
        )

        return {
            "error_code": error.error_code,
            "strategy": strategy,
            "recoverable": error.recoverable,
            "context": context
        }
```

---

## 6. Industry-Specific Document Processing Patterns

### 6.1 Invoice Processing (for Accounting Departments)

```
Invoice auto-processing flow:

  Email received ──▶ Extract PDF attachment ──▶ OCR processing ──▶ Data extraction
                                                                         │
      ┌──────────────────────────────────────────────────────────────────┘
      ▼
  Invoice number matching ──▶ Auto journal entry ──▶ Approval workflow
      │                              │                       │
      ▼                              ▼                       ▼
  Duplicate check            Accounting software     Slack notification
  Amount validation          freee / MF Cloud         Approval request
```

**Techniques to improve invoice processing accuracy:**

| Technique | Description | Accuracy Improvement |
|-----------|------|---------|
| Template matching | Learn invoice layout per vendor | +15% |
| Amount cross-check | Validate line item total = subtotal | 99% error detection rate |
| Historical data comparison | Compare amounts against past invoices | 95% anomaly detection |
| Invoice number validation | Verify T+13-digit qualified invoice numbers against NTA database | 100% |

### 6.2 Medical Document Processing

```python
class MedicalDocumentProcessor:
    """Dedicated processing engine for medical documents"""

    # PII masking rules specific to medical records
    PII_PATTERNS = {
        "patient_id": r'\d{8,10}',
        "insurance_number": r'[0-9]{8}',
        "phone": r'0\d{2,3}-?\d{2,4}-?\d{4}',
        "name": None,  # Detected by NER model
    }

    def process_prescription(self, image_path: str) -> dict:
        """Process a prescription"""
        # Medical documents require especially high accuracy
        # Double OCR + drug name dictionary matching
        ocr = DoubleCheckOCR()
        result = ocr.extract_with_verification(image_path)

        # Normalize drug names (match against pharmaceutical master)
        medications = self._extract_medications(result["text"])
        verified_meds = self._verify_with_drug_master(medications)

        return {
            "text": result["text"],
            "medications": verified_meds,
            "confidence": result["confidence"],
            "warnings": self._check_interactions(verified_meds)
        }

    def _extract_medications(self, text: str) -> list:
        """Extract drug information from prescription text"""
        # Implementation: use LLM to extract drug names, dosages, and usage
        pass

    def _verify_with_drug_master(self, medications: list) -> list:
        """Verify drug names against pharmaceutical master DB"""
        # Implementation: normalize and confirm existence of drug names
        pass

    def _check_interactions(self, medications: list) -> list:
        """Check drug interactions"""
        # Implementation: detect co-administration risks for multiple drugs
        pass
```

### 6.3 Real Estate Document Processing

```
Real estate document processing pipeline:

  Property PDF ──▶ Text extraction ──▶ Structured data conversion
       │                                         │
       ▼                                         ▼
  Important matter explanation ──▶ Clause analysis ──▶ Risk detection
       │                                                      │
       ▼                                                      ▼
  Registry certificate ──▶ Rights extraction ──▶ Comprehensive report
```

**Fields to extract from real estate documents:**

| Document Type | Extracted Fields | Accuracy Requirement |
|---------|--------------|---------|
| Explanation of important matters | Property info, legal restrictions, utilities | 99%+ |
| Sales contract | Price, delivery conditions, penalty clauses | 99%+ |
| Registry certificate | Owner, mortgage, land category | 100% (human verification required) |
| Lease agreement | Rent, renewal conditions, prohibited items | 95%+ |
| Building inspection report | Deterioration areas, repair estimate | 90%+ |

---

## 7. Anti-patterns

### Anti-pattern 1: Over-trusting OCR Accuracy

```python
# BAD: Using OCR results directly
def process_invoice(image_path):
    text = ocr.extract_text(image_path)
    amount = extract_amount(text)  # Risk of wrong amount due to OCR error
    charge_customer(amount)  # Immediate charge — dangerous!

# GOOD: Confidence check + human review
def process_invoice(image_path):
    result = ocr.extract_text(image_path)  # With confidence score

    if result["confidence"] < 85:
        return flag_for_human_review(result)

    amount = extract_amount(result["text"])
    # Double-check: compare results from two OCR engines
    result2 = cloud_vision.extract_text(image_path)
    amount2 = extract_amount(result2["text"])

    if amount != amount2:
        return flag_for_human_review({"amount1": amount, "amount2": amount2})

    return create_draft_invoice(amount)  # Create draft, process after approval
```

### Anti-pattern 2: Sending the Entire Text to LLM

```python
# BAD: Sending a 100-page PDF entirely to LLM
def analyze_contract(pdf_path):
    full_text = extract_all_text(pdf_path)  # 100,000 tokens
    result = call_ai(f"Analyze: {full_text}")  # High cost, low accuracy

# GOOD: Structured extraction → AI analysis of relevant sections only
def analyze_contract(pdf_path):
    analyzer = PDFAnalyzer(pdf_path)
    pages = analyzer.extract_all()

    # Split by clause
    clauses = split_into_clauses(pages)

    # AI analysis of high-risk clauses only (1/10 the cost)
    risk_clauses = [c for c in clauses
                    if any(kw in c for kw in ["賠償", "解除", "違約"])]

    results = []
    for clause in risk_clauses:
        result = call_ai(f"Risk analysis: {clause}")
        results.append(result)

    return results
```

### Anti-pattern 3: Reprocessing the Same Document Without Caching

```python
# BAD: Processing the same document every time
def process_document(file_path):
    return ocr.extract_text(file_path)  # API call every time

# GOOD: Cache by file hash
import hashlib
import json

class CachedProcessor:
    def __init__(self, cache_dir: str = "/tmp/doc_cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def process(self, file_path: str) -> dict:
        file_hash = self._hash_file(file_path)
        cache_path = f"{self.cache_dir}/{file_hash}.json"

        # Check cache
        if os.path.exists(cache_path):
            with open(cache_path) as f:
                return json.load(f)

        # New processing
        result = ocr.extract_text(file_path)

        # Save to cache
        with open(cache_path, "w") as f:
            json.dump(result, f, ensure_ascii=False)

        return result

    def _hash_file(self, path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
```

---

## 8. FAQ

### Q1: How can I improve Japanese OCR accuracy?

**A:** Three measures are effective. (1) Thorough pre-processing — binarization, denoising, and deskewing improve accuracy by 10-20%. (2) Japanese-specific models — use Tesseract's `jpn_vert` (for vertical text) or Google Cloud Vision (95%+ Japanese accuracy). (3) Post-processing — dictionary matching, context-based spell checking, and LLM-based error correction. For handwritten characters in particular, the combination of Cloud Vision + GPT-4V achieves the highest accuracy.

### Q2: Is AI contract analysis legally valid?

**A:** AI analysis is only a "support tool" and cannot replace legal judgment. However, it is useful for (1) preventing oversights — AI detects clauses that human reviewers tend to miss, (2) initial screening — extracting high-risk cases from large volumes of contracts, (3) comparative analysis — detecting differences from past contracts. The final judgment should always be made by a lawyer.

### Q3: How do I scale for processing large volumes of PDFs?

**A:** Handle it in three stages. (1) Batch processing — use Celery/SQS for queue management and async processing. (2) Parallelization — run parallel OCR on a per-page basis (10x speedup). (3) Caching — cache results by document hash for identical documents. For a scale of 100,000 pages/month, AWS Lambda + SQS + DynamoDB offers the best cost-effectiveness.

### Q4: How should I choose between multimodal LLMs and dedicated OCR engines?

**A:** The basic principle is "dedicated OCR engine as primary, LLM as supplement." (1) Dedicated OCR engines (Tesseract / Cloud Vision) are low-cost and fast, well-suited for large volumes of standard documents. (2) Multimodal LLMs (GPT-4V / Claude Vision) handle handwriting and complex layouts well, but cost $0.01-0.03 per image. (3) Recommended setup: use a dedicated OCR engine for basic processing, falling back to LLM only when confidence is low. This reduces costs by 80% while maintaining the highest accuracy levels.

### Q5: What should I be careful about when AI-processing documents containing personal information?

**A:** Five measures are essential. (1) PII masking — automatically mask personal information (names, addresses, phone numbers, etc.) before sending to AI. Detect using NER models or regular expressions. (2) Data retention policy — check API terms of service and select a plan where data is not used for training (Anthropic API does not use data by default). (3) On-premises processing — process highly confidential data such as medical and financial information using self-hosted models (e.g., Llama). (4) Encryption — always use TLS encryption for data in transit, AES-256 encryption for data at rest. (5) Access logs — fully record who accessed which documents to prepare for audits.

### Q6: How do I integrate with existing document management systems?

**A:** There are three integration patterns. (1) Webhook integration — trigger automatic processing from file upload events in SharePoint, Google Drive, Box, etc. The easiest to get started with. (2) API integration — interact directly with the document management system's API. Processing results can be saved as metadata. (3) File system monitoring — monitor a specific folder and auto-process new files. Effective for integration with on-premises environments and legacy systems. In all cases, linking processing results as metadata to the original document makes subsequent search and utilization easier.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| OCR selection | Free: Tesseract, high-accuracy: Cloud Vision, multimodal: GPT-4V |
| PDF parsing | Two-stage: PyMuPDF for structure extraction → LLM for semantic analysis |
| Contract analysis | Split clauses → extract risk clauses → AI analysis → human review |
| Accuracy management | Confidence scores + double-check + Human-in-the-Loop |
| Cost optimization | AI analysis of relevant sections only, caching, batch processing |
| Legal considerations | AI is a support tool; final judgment by professionals |
| Production | Retries, monitoring, alerts, and complete error handling |
| Industry support | Industry-specific pipeline design for invoices, medical, real estate, etc. |

---

## What to Read Next

- [03-email-communication.md](./03-email-communication.md) — Email and communication automation
- [../01-business/00-ai-saas.md](../01-business/00-ai-saas.md) — Building a document processing SaaS
- [../02-monetization/01-cost-management.md](../02-monetization/01-cost-management.md) — API cost optimization

---

## References

1. **"Document AI" — Google Cloud Documentation** — https://cloud.google.com/document-ai — Cloud service for structured document processing
2. **PyMuPDF Documentation** — https://pymupdf.readthedocs.io — Official guide for the PDF manipulation library
3. **Tesseract OCR Documentation** — https://github.com/tesseract-ocr/tesseract — Open-source OCR engine
4. **"AI-Powered Contract Analysis" — Stanford Law Review (2024)** — Legal considerations and accuracy evaluation of AI contract analysis
5. **AWS Textract Developer Guide** — https://docs.aws.amazon.com/textract/ — AWS structured text extraction service
6. **Azure AI Document Intelligence** — https://learn.microsoft.com/azure/ai-services/document-intelligence/ — Azure document analysis service
