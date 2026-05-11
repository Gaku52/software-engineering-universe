# NLP — Text Classification, Named Entity Recognition, Sentiment Analysis

> Implement key natural language processing tasks and extract valuable information from text data

## What You Will Learn

1. **Text Preprocessing** — Tokenization, vectorization, and building embedding representations
2. **Text Classification and Sentiment Analysis** — From classical methods to Transformer fine-tuning
3. **Named Entity Recognition (NER)** — Information extraction through sequence labeling
4. **Text Generation and Summarization** — Automatic text generation, extractive and abstractive summarization
5. **Building Practical Pipelines** — End-to-end design from preprocessing to deployment


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Text Preprocessing

### NLP Pipeline

```
Raw Text -> Preprocessing Pipeline -> Features -> Model -> Output

┌──────────────────┐
│ Raw Text         │
│ "Tokyo is sunny" │
└────────┬─────────┘
         │
         v
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Normalization│   │ Tokenization │   │ Vectorization│
│ - Lowercasing│──>│ - Morphology │──>│ - BoW        │
│ - Symbol rem.│   │ - BPE/WordPiece│ │ - TF-IDF     │
│ - Unicode    │   │ - Subword    │   │ - Word2Vec   │
│   norm.      │   │              │   │ - BERT embed.│
└──────────────┘   └──────────────┘   └──────────────┘
                                             │
                                             v
                                      ┌──────────────┐
                                      │ Model        │
                                      │ - SVM        │
                                      │ - BERT       │
                                      │ - GPT        │
                                      └──────────────┘
```

### Code Example 1: Text Preprocessing Pipeline

```python
import re
import unicodedata
from typing import List, Optional, Dict
from dataclasses import dataclass

@dataclass
class TokenInfo:
    """Detailed token information"""
    surface: str      # Surface form
    base: str = ""    # Base form
    pos: str = ""     # Part of speech
    reading: str = "" # Reading

class TextPreprocessor:
    """Advanced text preprocessing for Japanese/English"""

    def __init__(self, language: str = "ja"):
        self.language = language
        self._stopwords_ja = {
            "の", "に", "は", "を", "た", "が", "で", "て", "と", "し",
            "れ", "さ", "ある", "いる", "も", "する", "から", "な",
            "こと", "として", "い", "や", "れる", "など", "なっ",
            "ない", "この", "ため", "その", "あっ", "よう", "また",
            "もの", "という", "あり", "まで", "られ", "なる", "へ",
            "か", "だ", "これ", "によって", "により", "おり", "より",
        }
        self._stopwords_en = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "shall", "can",
            "to", "of", "in", "for", "on", "with", "at", "by", "from",
            "as", "into", "through", "during", "before", "after",
            "above", "below", "between", "out", "off", "over", "under",
            "again", "further", "then", "once", "here", "there", "when",
            "where", "why", "how", "all", "both", "each", "few", "more",
            "most", "other", "some", "such", "no", "nor", "not", "only",
            "own", "same", "so", "than", "too", "very", "just",
            "it", "its", "he", "she", "they", "them", "his", "her",
            "this", "that", "these", "those", "i", "me", "my", "we",
        }

    def normalize(self, text: str) -> str:
        """Unicode normalization + basic cleaning"""
        # NFKC normalization (fullwidth -> halfwidth, variant unification)
        text = unicodedata.normalize("NFKC", text)
        # Replace URLs/emails/hashtags
        text = re.sub(r"https?://\S+", "[URL]", text)
        text = re.sub(r"\S+@\S+", "[EMAIL]", text)
        text = re.sub(r"#(\w+)", r"[HASHTAG:\1]", text)
        text = re.sub(r"@(\w+)", r"[MENTION:\1]", text)
        # Normalize consecutive whitespace
        text = re.sub(r"\s+", " ", text).strip()
        # Remove HTML tags
        text = re.sub(r"<[^>]+>", "", text)
        # Remove control characters
        text = "".join(c for c in text if unicodedata.category(c)[0] != "C" or c in "\n\t ")
        return text

    def normalize_neologd(self, text: str) -> str:
        """NEologd-style normalization (for Japanese)"""
        text = self.normalize(text)
        # Normalize prolonged sound marks
        text = re.sub(r"[〜～]", "ー", text)
        # Reduce repeated symbols
        text = re.sub(r"([!?！？]){2,}", r"\1", text)
        text = re.sub(r"(ー){2,}", "ー", text)
        text = re.sub(r"(っ){2,}", "っ", text)
        text = re.sub(r"(。){2,}", "。", text)
        # Normalize brackets
        text = re.sub(r"[（\(]", "(", text)
        text = re.sub(r"[）\)]", ")", text)
        return text

    def tokenize_ja(self, text: str, with_pos: bool = False) -> List:
        """Japanese morphological analysis (MeCab)"""
        import MeCab
        tagger = MeCab.Tagger()
        parsed = tagger.parse(text)

        tokens = []
        for line in parsed.split("\n"):
            if line == "EOS" or line == "":
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            surface = parts[0]
            features = parts[1].split(",") if len(parts) > 1 else []

            if with_pos:
                tokens.append(TokenInfo(
                    surface=surface,
                    pos=features[0] if len(features) > 0 else "",
                    base=features[6] if len(features) > 6 else surface,
                    reading=features[7] if len(features) > 7 else "",
                ))
            else:
                tokens.append(surface)

        return tokens

    def tokenize_en(self, text: str) -> List[str]:
        """English tokenization"""
        text = text.lower()
        # Basic tokenization (separate punctuation)
        text = re.sub(r"([.!?,;:'\"-])", r" \1 ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text.split()

    def tokenize(self, text: str) -> List[str]:
        text = self.normalize(text)
        if self.language == "ja":
            return self.tokenize_ja(text)
        return self.tokenize_en(text)

    def remove_stopwords(self, tokens: List[str],
                          custom_stopwords: set = None) -> List[str]:
        stopwords = (custom_stopwords or
                     (self._stopwords_ja if self.language == "ja"
                      else self._stopwords_en))
        return [t for t in tokens if t not in stopwords and len(t) > 1]

    def extract_keywords(self, text: str, top_k: int = 10) -> List[Dict]:
        """TF-IDF-based keyword extraction"""
        from sklearn.feature_extraction.text import TfidfVectorizer
        import numpy as np

        tokens = self.tokenize(text)
        clean_tokens = self.remove_stopwords(tokens)

        # Pseudo TF-IDF (TF only for single-document case)
        word_freq = {}
        for token in clean_tokens:
            word_freq[token] = word_freq.get(token, 0) + 1

        total = sum(word_freq.values())
        keywords = sorted(
            [{"word": w, "score": c / total} for w, c in word_freq.items()],
            key=lambda x: x["score"], reverse=True
        )[:top_k]

        return keywords

# Usage example
preprocessor = TextPreprocessor(language="ja")
text = "東京は今日も晴れです。  気温は２５度でした。https://example.com"
normalized = preprocessor.normalize(text)
tokens = preprocessor.tokenize(normalized)
clean_tokens = preprocessor.remove_stopwords(tokens)
print(f"Normalized: {normalized}")
print(f"Tokens: {tokens}")
print(f"After preprocessing: {clean_tokens}")
```

### Code Example 2: Comparing Subword Tokenizers

```python
from transformers import AutoTokenizer

def compare_tokenizers(text: str):
    """Compare the behavior of multiple tokenizers"""
    tokenizer_names = {
        "BERT (Japanese)": "cl-tohoku/bert-base-japanese-v3",
        "GPT-2": "gpt2",
        "T5": "t5-small",
        "Llama2": "meta-llama/Llama-2-7b-hf",
    }

    print(f"Text: '{text}'")
    print("-" * 60)

    for name, model_name in tokenizer_names.items():
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            tokens = tokenizer.tokenize(text)
            ids = tokenizer.encode(text)
            decoded = tokenizer.decode(ids)

            print(f"\n{name}:")
            print(f"  Token count: {len(tokens)}")
            print(f"  Tokens: {tokens[:20]}{'...' if len(tokens) > 20 else ''}")
            print(f"  IDs: {ids[:10]}{'...' if len(ids) > 10 else ''}")
            print(f"  Decoded: {decoded[:100]}")
        except Exception as e:
            print(f"\n{name}: Skipped ({e})")

# compare_tokenizers("自然言語処理は人工知能の重要な研究分野です。")
# compare_tokenizers("Natural language processing is important.")
```

---

## 2. Text Classification

### Evolution of Classification Approaches

```
Evolution of text classification:

  Before 2010         2013-2018          2018-Present
  ┌─────────┐     ┌───────────┐     ┌────────────┐
  │ BoW     │     │ Word2Vec  │     │ BERT       │
  │ TF-IDF  │ ──> │ + CNN/LSTM│ ──> │ GPT        │
  │ + SVM   │     │           │     │ Fine-tuning│
  │ + NB    │     │           │     │ Few-shot   │
  └─────────┘     └───────────┘     └────────────┘
  Handcrafted      Distributed       Pre-training
  features         repr. + DL        + Transfer
  Accuracy: Med    Accuracy: High    Accuracy: Best
```

### Code Example 3: Classical Text Classification (Full Version)

```python
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import VotingClassifier
from sklearn.pipeline import make_pipeline, Pipeline
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV

class TextClassificationPipeline:
    """Comprehensive text classification pipeline"""

    def __init__(self, language: str = "ja"):
        self.language = language
        self.preprocessor = TextPreprocessor(language)
        self.pipeline = None

    def build_pipeline(self, model_type: str = "svm") -> Pipeline:
        """Build a classification pipeline"""
        tfidf = TfidfVectorizer(
            analyzer="char_wb" if self.language == "ja" else "word",
            ngram_range=(2, 4) if self.language == "ja" else (1, 2),
            max_features=50000,
            sublinear_tf=True,     # Log normalization of TF
            min_df=2,              # Must appear in at least 2 documents
            max_df=0.95,           # Exclude terms appearing in >95% of documents
        )

        models = {
            "lr": LogisticRegression(
                max_iter=1000, C=1.0, class_weight="balanced"
            ),
            "svm": CalibratedClassifierCV(
                LinearSVC(C=1.0, class_weight="balanced", max_iter=5000),
                cv=3
            ),
            "nb": MultinomialNB(alpha=0.1),
            "ensemble": VotingClassifier(
                estimators=[
                    ("lr", LogisticRegression(max_iter=1000, C=1.0)),
                    ("svm", CalibratedClassifierCV(LinearSVC(C=1.0), cv=3)),
                    ("nb", MultinomialNB(alpha=0.1)),
                ],
                voting="soft"
            ),
        }

        self.pipeline = make_pipeline(tfidf, models[model_type])
        return self.pipeline

    def evaluate(self, texts, labels, cv=5):
        """Evaluate using cross-validation"""
        skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
        scores = cross_val_score(
            self.pipeline, texts, labels,
            cv=skf, scoring="f1_weighted", n_jobs=-1
        )
        print(f"F1 (weighted): {scores.mean():.4f} (+/- {scores.std():.4f})")
        return scores

    def train_and_report(self, X_train, y_train, X_test, y_test):
        """Train and output a detailed report"""
        self.pipeline.fit(X_train, y_train)
        y_pred = self.pipeline.predict(X_test)
        print(classification_report(y_test, y_pred))
        return y_pred

# Usage example
texts = [
    "この映画は素晴らしい演技で感動した",
    "ストーリーが退屈で眠くなった",
    "映像美が際立つ傑作だ",
    "期待外れの駄作だった",
    "心温まる感動的な作品",
    "つまらない展開の連続で苦痛だった",
    "演技力に圧倒される名作",
    "時間の無駄だった",
]
labels = [1, 0, 1, 0, 1, 0, 1, 0]

pipeline = TextClassificationPipeline(language="ja")
pipeline.build_pipeline("lr")
pipeline.pipeline.fit(texts, labels)

test_texts = ["感動的な映画だった", "退屈な映画だった"]
preds = pipeline.pipeline.predict(test_texts)
for t, p in zip(test_texts, preds):
    print(f"  '{t}' -> {'Positive' if p == 1 else 'Negative'}")
```

### Code Example 4: BERT Fine-tuning (Complete Version)

```python
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    TrainingArguments, Trainer, EarlyStoppingCallback
)
from datasets import Dataset, DatasetDict
import torch
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

class BERTClassifier:
    """Japanese BERT fine-tuning pipeline"""

    def __init__(self, model_name: str = "cl-tohoku/bert-base-japanese-v3",
                 num_labels: int = 2, max_length: int = 128):
        self.model_name = model_name
        self.num_labels = num_labels
        self.max_length = max_length
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_name, num_labels=num_labels
        )

    def prepare_dataset(self, texts, labels, test_size=0.2):
        """Prepare the dataset"""
        dataset = Dataset.from_dict({"text": texts, "label": labels})
        dataset = dataset.train_test_split(test_size=test_size, seed=42,
                                            stratify_by_column="label")

        def tokenize_fn(examples):
            return self.tokenizer(
                examples["text"],
                padding="max_length",
                truncation=True,
                max_length=self.max_length
            )

        tokenized = dataset.map(tokenize_fn, batched=True,
                                 remove_columns=["text"])
        tokenized.set_format("torch")
        return tokenized

    def compute_metrics(self, eval_pred):
        """Compute evaluation metrics"""
        logits, labels = eval_pred
        predictions = np.argmax(logits, axis=-1)
        return {
            "accuracy": accuracy_score(labels, predictions),
            "f1": f1_score(labels, predictions, average="weighted"),
            "precision": precision_score(labels, predictions, average="weighted"),
            "recall": recall_score(labels, predictions, average="weighted"),
        }

    def train(self, tokenized_dataset, output_dir="./results",
              epochs=5, batch_size=16, lr=2e-5):
        """Run training"""
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size * 2,
            learning_rate=lr,
            weight_decay=0.01,
            warmup_ratio=0.1,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="f1",
            greater_is_better=True,
            logging_steps=50,
            fp16=torch.cuda.is_available(),
            dataloader_num_workers=2,
            report_to="none",
        )

        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset["train"],
            eval_dataset=tokenized_dataset["test"],
            compute_metrics=self.compute_metrics,
            callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
        )

        trainer.train()
        return trainer

    def predict(self, texts: list) -> list:
        """Classify texts"""
        self.model.eval()
        inputs = self.tokenizer(
            texts, padding=True, truncation=True,
            max_length=self.max_length, return_tensors="pt"
        )
        device = next(self.model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            predictions = torch.argmax(outputs.logits, dim=-1)

        return predictions.cpu().tolist()

# Usage example
# classifier = BERTClassifier(num_labels=2)
# dataset = classifier.prepare_dataset(texts, labels)
# trainer = classifier.train(dataset)
# predictions = classifier.predict(["素晴らしい映画だった"])
```

### Code Example 5: Zero-shot / Few-shot Classification with LLMs

```python
from transformers import pipeline
import json

class LLMClassifier:
    """Zero-shot / few-shot classification using LLMs"""

    def __init__(self, model_name: str = "facebook/bart-large-mnli"):
        self.zero_shot = pipeline(
            "zero-shot-classification",
            model=model_name
        )

    def classify_zero_shot(self, text: str, labels: list,
                            multi_label: bool = False) -> dict:
        """Zero-shot classification"""
        result = self.zero_shot(
            text, labels,
            multi_label=multi_label
        )
        return {
            "text": text,
            "predictions": [
                {"label": label, "score": round(score, 4)}
                for label, score in zip(result["labels"], result["scores"])
            ],
            "top_label": result["labels"][0],
            "top_score": round(result["scores"][0], 4),
        }

    def classify_batch(self, texts: list, labels: list) -> list:
        """Batch zero-shot classification"""
        results = self.zero_shot(texts, labels)
        if not isinstance(results, list):
            results = [results]
        return [
            {
                "text": text,
                "label": r["labels"][0],
                "score": round(r["scores"][0], 4),
            }
            for text, r in zip(texts, results)
        ]

    @staticmethod
    def few_shot_prompt(text: str, examples: list,
                         labels: list) -> str:
        """Build a prompt for few-shot learning"""
        prompt = "Please classify the following text.\n\n"
        prompt += f"Categories: {', '.join(labels)}\n\n"
        prompt += "Examples:\n"
        for ex in examples:
            prompt += f"Text: {ex['text']}\n"
            prompt += f"Category: {ex['label']}\n\n"
        prompt += f"Text: {text}\n"
        prompt += "Category: "
        return prompt

# Usage example
# classifier = LLMClassifier()
# result = classifier.classify_zero_shot(
#     "この商品は品質が良く、価格も手頃です",
#     ["Positive", "Negative", "Neutral"]
# )
# print(f"Classification result: {result['top_label']} ({result['top_score']})")
```

---

## 3. Named Entity Recognition (NER)

### NER Tag Schemes

```
BIO Tag Scheme:

  Text: "Taro Tanaka is a professor at the University of Tokyo"

  Tokens:  Taro  Tanaka  is  a  professor  at  the  University  of  Tokyo
  Tags:    B-PER I-PER   O   O  B-TTL      O   O    B-ORG       I-ORG I-ORG

  B = Begin (start of an entity)
  I = Inside (inside an entity)
  O = Outside (not an entity)

  Entity Types:
  ┌──────────────────────────────────────────┐
  │ PER (Person)        : Person name        │
  │ ORG (Organization)  : Organization name  │
  │ LOC (Location)      : Place name         │
  │ DATE                : Date               │
  │ MONEY               : Monetary amount    │
  │ TTL (Title)         : Title/Position     │
  │ PRODUCT             : Product name       │
  │ EVENT               : Event name         │
  │ PERCENT             : Percentage         │
  │ QUANTITY            : Quantity            │
  └──────────────────────────────────────────┘

  BIOES (Extended):
  B = Begin, I = Inside, O = Outside
  E = End (end of an entity)
  S = Single (single-token entity)
```

### Code Example 6: NER with spaCy + Transformers

```python
import spacy
from transformers import pipeline
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class Entity:
    text: str
    label: str
    start: int
    end: int
    score: float = 1.0

class NERPipeline:
    """NER pipeline supporting multiple backends"""

    def __init__(self, backend: str = "spacy", model_name: str = None):
        self.backend = backend

        if backend == "spacy":
            model_name = model_name or "ja_core_news_lg"
            self.nlp = spacy.load(model_name)
        elif backend == "transformers":
            model_name = model_name or "dslim/bert-base-NER"
            self.ner_pipeline = pipeline(
                "ner", model=model_name,
                aggregation_strategy="simple"
            )

    def extract(self, text: str) -> List[Entity]:
        """Extract named entities"""
        if self.backend == "spacy":
            return self._extract_spacy(text)
        else:
            return self._extract_transformers(text)

    def _extract_spacy(self, text: str) -> List[Entity]:
        doc = self.nlp(text)
        return [
            Entity(
                text=ent.text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
            )
            for ent in doc.ents
        ]

    def _extract_transformers(self, text: str) -> List[Entity]:
        results = self.ner_pipeline(text)
        return [
            Entity(
                text=ent["word"],
                label=ent["entity_group"],
                start=ent["start"],
                end=ent["end"],
                score=round(ent["score"], 4),
            )
            for ent in results
        ]

    def extract_batch(self, texts: List[str]) -> List[List[Entity]]:
        """Run NER in batch"""
        return [self.extract(text) for text in texts]

    def format_output(self, text: str, entities: List[Entity]) -> str:
        """Generate a string with entities highlighted"""
        result = text
        # Replace from the end to avoid position shifts
        for ent in sorted(entities, key=lambda e: e.start, reverse=True):
            result = (
                result[:ent.start]
                + f"{ent.text}"
                + result[ent.end:]
            )
        return result

# Usage example
ner = NERPipeline(backend="transformers", model_name="dslim/bert-base-NER")
text = "Apple CEO Tim Cook announced new products in San Francisco."
entities = ner.extract(text)
for ent in entities:
    print(f"  [{ent.label}] {ent.text} (confidence: {ent.score})")
print(f"\n  Annotated: {ner.format_output(text, entities)}")
```

### Code Example 7: Training a Custom NER Model

```python
from transformers import (
    AutoTokenizer, AutoModelForTokenClassification,
    TrainingArguments, Trainer, DataCollatorForTokenClassification
)
from datasets import Dataset
import numpy as np

class CustomNERTrainer:
    """Training pipeline for custom NER models"""

    def __init__(self, model_name: str = "cl-tohoku/bert-base-japanese-v3",
                 label_list: list = None):
        self.model_name = model_name
        self.label_list = label_list or [
            "O", "B-PER", "I-PER", "B-ORG", "I-ORG",
            "B-LOC", "I-LOC", "B-DATE", "I-DATE",
        ]
        self.label2id = {l: i for i, l in enumerate(self.label_list)}
        self.id2label = {i: l for i, l in enumerate(self.label_list)}

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForTokenClassification.from_pretrained(
            model_name,
            num_labels=len(self.label_list),
            id2label=self.id2label,
            label2id=self.label2id,
        )

    def tokenize_and_align(self, examples):
        """Tokenize and align labels"""
        tokenized = self.tokenizer(
            examples["tokens"],
            truncation=True,
            is_split_into_words=True,
            max_length=128,
        )

        labels = []
        for i, label in enumerate(examples["ner_tags"]):
            word_ids = tokenized.word_ids(batch_index=i)
            label_ids = []
            previous_word_idx = None

            for word_idx in word_ids:
                if word_idx is None:
                    label_ids.append(-100)  # Ignore special tokens
                elif word_idx != previous_word_idx:
                    label_ids.append(label[word_idx])
                else:
                    # For 2nd+ subwords: convert B- to I-
                    lbl = label[word_idx]
                    if self.label_list[lbl].startswith("B-"):
                        lbl = self.label2id[
                            self.label_list[lbl].replace("B-", "I-")
                        ]
                    label_ids.append(lbl)
                previous_word_idx = word_idx

            labels.append(label_ids)

        tokenized["labels"] = labels
        return tokenized

    def compute_metrics(self, eval_pred):
        """Compute NER metrics"""
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=2)

        # Evaluate excluding -100
        true_labels = []
        true_predictions = []
        for pred, label in zip(predictions, labels):
            for p, l in zip(pred, label):
                if l != -100:
                    true_labels.append(self.label_list[l])
                    true_predictions.append(self.label_list[p])

        # Entity-level F1
        from seqeval.metrics import f1_score, classification_report
        f1 = f1_score([true_labels], [true_predictions])
        return {"f1": f1}

    def train(self, train_dataset, eval_dataset, output_dir="./ner_model"):
        """Train the NER model"""
        data_collator = DataCollatorForTokenClassification(
            self.tokenizer, pad_to_multiple_of=8
        )

        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=10,
            per_device_train_batch_size=16,
            per_device_eval_batch_size=32,
            learning_rate=3e-5,
            weight_decay=0.01,
            warmup_ratio=0.1,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="f1",
        )

        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            data_collator=data_collator,
            compute_metrics=self.compute_metrics,
        )

        trainer.train()
        return trainer
```

---

## 4. Sentiment Analysis

### Code Example 8: Multi-functional Sentiment Analysis Pipeline

```python
from transformers import pipeline
import pandas as pd
from typing import Dict, List
import numpy as np

class SentimentAnalyzer:
    """Multi-language, multi-aspect sentiment analysis"""

    def __init__(self, model_name: str = None):
        if model_name is None:
            model_name = "nlptown/bert-base-multilingual-uncased-sentiment"
        self.pipe = pipeline("sentiment-analysis", model=model_name,
                              device=-1)

    def analyze(self, texts: list) -> pd.DataFrame:
        """Sentiment analysis on a list of texts"""
        results = self.pipe(texts, truncation=True, max_length=512)

        df = pd.DataFrame({
            "text": texts,
            "label": [r["label"] for r in results],
            "score": [round(r["score"], 4) for r in results],
        })
        return df

    def analyze_aspects(self, text: str, aspects: list) -> dict:
        """Aspect-based sentiment analysis"""
        results = {}
        for aspect in aspects:
            prompt = f"Regarding {aspect}: {text}"
            result = self.pipe(prompt, truncation=True)[0]
            results[aspect] = {
                "label": result["label"],
                "score": round(result["score"], 4),
            }
        return results

    def analyze_with_context(self, text: str,
                               context: str = None) -> Dict:
        """Sentiment analysis with context"""
        if context:
            input_text = f"[Context: {context}] {text}"
        else:
            input_text = text

        result = self.pipe(input_text, truncation=True)[0]
        return {
            "text": text,
            "context": context,
            "label": result["label"],
            "score": round(result["score"], 4),
        }

    def analyze_trends(self, texts: list,
                        timestamps: list = None) -> pd.DataFrame:
        """Time-series sentiment trend analysis"""
        results = self.pipe(texts, truncation=True)

        df = pd.DataFrame({
            "text": texts,
            "label": [r["label"] for r in results],
            "score": [r["score"] for r in results],
        })

        if timestamps:
            df["timestamp"] = timestamps
            df = df.sort_values("timestamp")

        # Moving average of sentiment scores
        df["score_ma"] = df["score"].rolling(window=5, min_periods=1).mean()

        return df

# Usage example
analyzer = SentimentAnalyzer()

reviews = [
    "This product is amazing! Best purchase ever.",
    "Terrible quality, broke after one day.",
    "It's okay, nothing special.",
    "Exceeded my expectations, highly recommended!",
    "Not worth the price at all.",
]

df = analyzer.analyze(reviews)
print(df.to_string(index=False))

# Aspect-based
# result = analyzer.analyze_aspects(
#     "The food was delicious but the service was slow",
#     aspects=["food", "service", "atmosphere"]
# )
```

---

## 5. Text Embeddings and Similarity Search

### Code Example 9: High-performance Semantic Search

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict, Optional
import json

class SemanticSearch:
    """Advanced semantic search using sentence embeddings"""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.documents = []
        self.metadata = []
        self.embeddings = None

    def index(self, documents: list, metadata: list = None) -> None:
        """Index documents"""
        self.documents = documents
        self.metadata = metadata or [{}] * len(documents)
        self.embeddings = self.model.encode(
            documents, normalize_embeddings=True,
            show_progress_bar=True, batch_size=32
        )

    def search(self, query: str, top_k: int = 5,
               threshold: float = 0.0) -> list:
        """Search for the most similar documents to a query"""
        query_emb = self.model.encode(
            [query], normalize_embeddings=True
        )
        similarities = np.dot(self.embeddings, query_emb.T).flatten()
        top_indices = np.argsort(similarities)[::-1][:top_k]

        results = []
        for idx in top_indices:
            sim = float(similarities[idx])
            if sim >= threshold:
                results.append({
                    "document": self.documents[idx],
                    "similarity": round(sim, 4),
                    "index": int(idx),
                    "metadata": self.metadata[idx],
                })
        return results

    def find_similar_pairs(self, threshold: float = 0.8) -> list:
        """Detect document pairs with high similarity"""
        sim_matrix = np.dot(self.embeddings, self.embeddings.T)
        pairs = []
        n = len(self.documents)

        for i in range(n):
            for j in range(i + 1, n):
                if sim_matrix[i][j] >= threshold:
                    pairs.append({
                        "doc1": self.documents[i],
                        "doc2": self.documents[j],
                        "similarity": round(float(sim_matrix[i][j]), 4),
                    })

        return sorted(pairs, key=lambda x: x["similarity"], reverse=True)

    def cluster_documents(self, n_clusters: int = 5) -> dict:
        """Cluster documents"""
        from sklearn.cluster import KMeans

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(self.embeddings)

        clusters = {}
        for i, label in enumerate(labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append({
                "document": self.documents[i],
                "index": i,
            })

        return clusters

# Usage example
search = SemanticSearch()
docs = [
    "Python is a programming language.",
    "Machine learning uses data to learn patterns.",
    "Tokyo is the capital of Japan.",
    "Neural networks are inspired by the brain.",
    "Deep learning requires large datasets.",
    "Japan is an island country in East Asia.",
    "Python supports object-oriented programming.",
    "Gradient descent optimizes neural network weights.",
]
search.index(docs)

results = search.search("AI and data science", top_k=3)
for r in results:
    print(f"  [{r['similarity']:.3f}] {r['document']}")

# Detect similar pairs
print("\nSimilar document pairs:")
pairs = search.find_similar_pairs(threshold=0.5)
for p in pairs[:5]:
    print(f"  [{p['similarity']:.3f}] '{p['doc1']}' <-> '{p['doc2']}'")
```

### Code Example 10: RAG (Retrieval-Augmented Generation) Pipeline

```python
from sentence_transformers import SentenceTransformer
import numpy as np

class SimpleRAG:
    """Simple RAG pipeline"""

    def __init__(self, embedding_model: str = "all-MiniLM-L6-v2"):
        self.encoder = SentenceTransformer(embedding_model)
        self.documents = []
        self.embeddings = None

    def add_documents(self, documents: list):
        """Add documents"""
        self.documents.extend(documents)
        self.embeddings = self.encoder.encode(
            self.documents, normalize_embeddings=True
        )

    def retrieve(self, query: str, top_k: int = 3) -> list:
        """Retrieve relevant documents"""
        query_emb = self.encoder.encode(
            [query], normalize_embeddings=True
        )
        similarities = np.dot(self.embeddings, query_emb.T).flatten()
        top_indices = np.argsort(similarities)[::-1][:top_k]

        return [
            {
                "text": self.documents[idx],
                "score": float(similarities[idx]),
            }
            for idx in top_indices
        ]

    def build_prompt(self, query: str, contexts: list) -> str:
        """Build a prompt with context"""
        context_text = "\n\n".join(
            f"[Document {i+1}] {ctx['text']}"
            for i, ctx in enumerate(contexts)
        )

        prompt = f"""Please answer the question based on the following reference documents.
If the information is not found in the reference documents, respond with "No information available."

## Reference Documents
{context_text}

## Question
{query}

## Answer
"""
        return prompt

    def query(self, question: str, top_k: int = 3) -> dict:
        """Perform retrieval -> answer generation for a question"""
        # 1. Retrieve
        contexts = self.retrieve(question, top_k=top_k)

        # 2. Build prompt
        prompt = self.build_prompt(question, contexts)

        # 3. Generate with LLM (returns prompt here)
        return {
            "question": question,
            "contexts": contexts,
            "prompt": prompt,
            # "answer": llm.generate(prompt)  # LLM call
        }

# Usage example
# rag = SimpleRAG()
# rag.add_documents([
#     "Python was created by Guido van Rossum in 1991.",
#     "Python is an interpreted high-level programming language.",
#     "Python is widely used in data science and machine learning.",
# ])
# result = rag.query("Who created Python?")
# print(result["prompt"])
```

---

## Comparison Tables

### Text Classification Methods Comparison

| Method | Accuracy | Speed | Data Requirement | Interpretability | Multilingual | Cost |
|---|---|---|---|---|---|---|
| BoW + NaiveBayes | Medium | Very Fast | Small OK | High | Needs adaptation | Free |
| TF-IDF + SVM | Medium-High | Fast | Medium | Moderate | Needs adaptation | Free |
| Word2Vec + LSTM | High | Moderate | Medium | Low | Needs adaptation | GPU recommended |
| BERT Fine-tuning | Best | Slow | Small OK | Low | Model-dependent | GPU required |
| GPT Few-shot | High | Slow | Very Small | Low | High | API billing |
| GPT Zero-shot | Medium-High | Slow | None | Low | High | API billing |

### Japanese NLP Libraries Comparison

| Library | Morphological Analysis | NER | Classification | Speed | Accuracy | Use Case |
|---|---|---|---|---|---|---|
| MeCab | O | x | x | Very Fast | High | Preprocessing |
| Janome | O | x | x | Fast | Moderate | Lightweight environments |
| spaCy (ja) | O | O | O | Fast | High | Pipelines |
| GiNZA | O | O | △ | Moderate | High | Detailed analysis |
| SudachiPy | O | x | x | Fast | High | Strong in normalization |
| Transformers (BERT) | △ | O | O | Slow | Best | High-accuracy tasks |

### Embedding Models Comparison

| Model | Dimensions | Speed | Quality | Multilingual | Size |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 | 384 | Fast | High | English-centric | 80MB |
| multilingual-e5-large | 1024 | Moderate | Best | O | 2.2GB |
| paraphrase-multilingual | 768 | Moderate | High | O | 1.1GB |
| text-embedding-ada-002 | 1536 | API-dependent | Best | O | API |
| text-embedding-3-small | 1536 | API-dependent | High | O | API |

---

## Anti-patterns

### Anti-pattern 1: Tokenization Without Considering Text Length

```python
# BAD: Ignoring BERT's 512-token limit
inputs = tokenizer(long_text, return_tensors="pt")  # Gets truncated!

# GOOD: Long text handling strategy
def handle_long_text(text, tokenizer, model, max_length=512, stride=128):
    """Process long text with overlapping chunk splitting"""
    inputs = tokenizer(
        text, max_length=max_length, truncation=True,
        stride=stride, return_overflapping_tokens=True,
        return_tensors="pt", padding=True
    )

    all_logits = []
    for i in range(inputs["input_ids"].shape[0]):
        chunk_inputs = {
            k: v[i:i+1] for k, v in inputs.items()
            if k != "overflow_to_sample_mapping"
        }
        with torch.no_grad():
            outputs = model(**chunk_inputs)
            all_logits.append(outputs.logits)

    # Aggregate chunk results (average)
    avg_logits = torch.stack(all_logits).mean(dim=0)
    return avg_logits
```

### Anti-pattern 2: Inconsistent Preprocessing

```python
# BAD: Different preprocessing at training vs. inference time
# Training: lowercasing + symbol removal
# Inference: raw input -> performance degradation

# GOOD: Embed preprocessing in the pipeline
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        preprocessor=lambda x: TextPreprocessor("en").normalize(x),
        analyzer="char_wb",
        ngram_range=(2, 4)
    )),
    ("classifier", LogisticRegression()),
])
# Same preprocessing is automatically applied at both training and inference time
```

### Anti-pattern 3: Pitfalls of BPE Tokenization for Japanese

```python
# BAD: Applying an English BPE tokenizer to Japanese
tokenizer = AutoTokenizer.from_pretrained("gpt2")
tokens = tokenizer.tokenize("東京は日本の首都です")
# -> Split into individual bytes, consuming many tokens

# GOOD: Use a Japanese-compatible model
tokenizer = AutoTokenizer.from_pretrained("cl-tohoku/bert-base-japanese-v3")
tokens = tokenizer.tokenize("東京は日本の首都です")
# -> Tokenized into units close to morphemes

# For multilingual: Use a multilingual model
tokenizer = AutoTokenizer.from_pretrained(
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)
```


---

## Hands-on Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

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
        assert False, "Should have raised an exception"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
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
        """Remove by key"""
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm computational complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: How much data is needed for BERT fine-tuning?

**A:** It depends on the task, but 100-500 samples per class is generally effective. BERT has pre-trained knowledge, so it performs well even with small datasets. For around 10 samples, few-shot learning (GPT-based) is more suitable. With 1000+ samples, BERT fine-tuning becomes stable.

**Data Volume Guidelines:**

| Data Volume | Recommended Approach | Expected Accuracy |
|----------|-------------|---------|
| 0 samples | GPT Zero-shot | Medium-High |
| 5-20 samples | GPT Few-shot | High |
| 100-500 samples | BERT Fine-tuning | High |
| 1000+ samples | BERT Fine-tuning | Best |
| 10000+ samples | Classical ML or BERT | Best |

### Q2: What are the unique challenges of Japanese NLP?

**A:** (1) No word boundaries (morphological analysis is required), (2) Mixed kanji, hiragana, and katakana characters, (3) Diversity of expressions due to honorific language, (4) Less training data compared to English. For BERT models, use Japanese-specific models such as "cl-tohoku/bert-base-japanese-v3" and "nlp-waseda/roberta-base-japanese".

### Q3: How can sentiment analysis accuracy be improved?

**A:** (1) Additional training with domain-specific labeled data, (2) Aspect-based analysis to evaluate each facet, (3) Handling negation expressions (e.g., "not good") and slang, (4) Considering context (detecting sarcasm and metaphors). Using LLMs as annotators to efficiently create high-quality labeled data is also effective.

### Q4: Should I use RAG or Fine-tuning?

**A:** It depends on the use case.

| Aspect | RAG | Fine-tuning |
|------|-----|-------------|
| Data freshness | Real-time updates possible | Retraining required |
| Hallucination | Can provide evidence | Difficult to suppress |
| Cost | Search infrastructure needed | Training GPU needed |
| Customization | Easy to add external knowledge | Modifies model behavior |
| Recommended for | FAQ, document search | Style changes, specialized tasks |

Combining both approaches is also effective (Fine-tuned model + RAG).

### Q5: How do you handle imbalanced data in text classification?

**A:** Combine the following strategies.

1. **Data level**: Oversampling (SMOTE), undersampling
2. **Loss function**: Focal Loss, Class-weighted Cross Entropy
3. **Evaluation metrics**: Use F1-score and AUPRC instead of Accuracy
4. **Data augmentation**: Synonym replacement, back-translation, LLM-based paraphrase generation

---

## Summary

| Topic | Key Points |
|---|---|
| Preprocessing | Normalization -> Tokenization -> Vectorization. Manage with a consistent pipeline |
| Text Classification | Baseline: TF-IDF+SVM. High accuracy: BERT Fine-tuning |
| NER | Sequence labeling with BIO tags. spaCy or Transformers |
| Sentiment Analysis | Immediately usable with pre-trained models. Improve accuracy with domain adaptation |
| Embeddings | Vectorize sentences with SentenceTransformers. Use for similarity search |
| RAG | Build knowledge-based QA with retrieval + generation |
| Zero/Few-shot | Classify with GPT/BART without labeled data |

---

## Recommended Next Guides

- [01-computer-vision.md](./01-computer-vision.md) — Computer Vision Applications
- [02-mlops.md](./02-mlops.md) — Deploying and Operating NLP Models

---

## References

1. **Jacob Devlin et al.** "BERT: Pre-training of Deep Bidirectional Transformers" NAACL 2019
2. **Hugging Face** "Transformers Documentation" — https://huggingface.co/docs/transformers/
3. **Daniel Jurafsky, James H. Martin** "Speech and Language Processing" 3rd Edition (Draft) — https://web.stanford.edu/~jurafsky/slp3/
4. **Reimers, N. & Gurevych, I.** "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks" EMNLP 2019
5. **Lewis, P. et al.** "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" NeurIPS 2020
