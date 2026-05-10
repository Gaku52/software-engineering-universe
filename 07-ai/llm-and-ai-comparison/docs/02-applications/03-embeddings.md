# Embeddings — Vector Representations, Similarity Search, and Clustering

> Embeddings are a technique for projecting data such as text and images into a high-dimensional vector space. They are the mathematical representation method underpinning the LLM ecosystem for computing semantic similarity, search, classification, and clustering.

## What You Will Learn in This Chapter

1. **Mathematical Foundations of Embeddings** — Vector spaces, distance functions, and dimensionality reduction principles
2. **Selecting and Using Embedding Models** — Comparing APIs and OSS models, multilingual support, and fine-tuning
3. **Practical Application Patterns** — Semantic search, clustering, anomaly detection, and classification


## Prerequisites

Before reading this guide, the following background knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Function Calling — Tool Use, Schema Definitions, and Error Handling](./02-function-calling.md)

---

## 1. Core Concepts of Embeddings

```
┌──────────────────────────────────────────────────────────┐
│           Intuitive Understanding of Embeddings           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Text                  Vector Space                      │
│                                                          │
│  "cat sleeps"  ──▶    [0.82, 0.15, -0.33, ...]          │
│  "dog rests"   ──▶    [0.79, 0.18, -0.31, ...]  ← near  │
│  "economy grows" ──▶  [-0.21, 0.67, 0.44, ...]  ← far   │
│                                                          │
│               y                                          │
│               ^    dog rests                             │
│               |   * *cat sleeps                          │
│               |                                          │
│               |                                          │
│               |          *economy grows                  │
│               |                                          │
│               └──────────────────▶ x                     │
│                                                          │
│  Similar meaning → vectors are close (high cosine sim)   │
│  Distant meaning → vectors are far (low cosine sim)      │
└──────────────────────────────────────────────────────────┘
```

### 1.1 Distance Functions

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity: -1 to 1 (closer to 1 means more similar)"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Euclidean distance: 0 to ∞ (closer to 0 means more similar)"""
    return np.linalg.norm(a - b)

def dot_product(a: np.ndarray, b: np.ndarray) -> float:
    """Dot product: equivalent to cosine similarity for normalized vectors"""
    return np.dot(a, b)

# Example usage
vec_cat  = np.array([0.82, 0.15, -0.33])
vec_dog  = np.array([0.79, 0.18, -0.31])
vec_econ = np.array([-0.21, 0.67, 0.44])

print(f"cat-dog: {cosine_similarity(vec_cat, vec_dog):.4f}")   # → 0.9987 (high)
print(f"cat-economy: {cosine_similarity(vec_cat, vec_econ):.4f}") # → -0.2341 (low)
```

### 1.2 Choosing the Right Distance Function

```
┌──────────────────────────────────────────────────────────┐
│           Distance Function Selection Guide               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Cosine Similarity                                       │
│  ├── Range: -1 to 1                                      │
│  ├── Compares direction only (ignores magnitude)         │
│  ├── Most common for text embeddings                     │
│  └── Recommended: most search and similarity tasks       │
│                                                          │
│  Euclidean Distance (L2 Distance)                        │
│  ├── Range: 0 to ∞                                       │
│  ├── Considers vector magnitude as well                  │
│  ├── Used in clustering                                  │
│  └── Recommended: non-normalized vectors                 │
│                                                          │
│  Dot Product (Inner Product)                             │
│  ├── Range: -∞ to ∞                                      │
│  ├── Equivalent to cosine similarity for normalized vecs │
│  ├── Fastest to compute                                  │
│  └── Recommended: normalized vectors (default for many APIs) │
│                                                          │
│  Manhattan Distance (L1 Distance)                        │
│  ├── Sum of absolute differences per dimension           │
│  ├── More robust to outliers than Euclidean              │
│  └── Recommended: sparse vectors                         │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Using Embedding Models

### 2.1 OpenAI Embedding API

```python
from openai import OpenAI

client = OpenAI()

# Embed a single text
response = client.embeddings.create(
    model="text-embedding-3-large",
    input="What is machine learning?",
    dimensions=1024,  # Dimensionality reduction (3072 → 1024): reduces cost and improves speed
)
embedding = response.data[0].embedding
print(f"Dimensions: {len(embedding)}")  # 1024

# Batch processing (up to 2048 texts)
texts = [
    "Python is a general-purpose programming language",
    "Machine learning is a subfield of artificial intelligence",
    "Sushi is a traditional Japanese dish",
]
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=texts,
)
embeddings = [d.embedding for d in response.data]
```

### 2.2 OSS Embedding Models (Sentence Transformers)

```python
from sentence_transformers import SentenceTransformer

# BGE-M3: a high-performance multilingual OSS model
model = SentenceTransformer("BAAI/bge-m3")

texts = [
    "Learning the fundamentals of machine learning",
    "Introduction to deep learning",
    "What should I have for lunch today?",
]

embeddings = model.encode(texts, normalize_embeddings=True)
print(f"Shape: {embeddings.shape}")  # (3, 1024)

# Similarity matrix
from sentence_transformers.util import cos_sim
similarity_matrix = cos_sim(embeddings, embeddings)
print(similarity_matrix)
```

### 2.3 Cohere Embed v3

```python
import cohere

co = cohere.Client("YOUR_API_KEY")

# input_type matters: generates different embeddings for queries vs. documents
query_embed = co.embed(
    texts=["What is Japan's population?"],
    model="embed-multilingual-v3.0",
    input_type="search_query",       # For search queries
).embeddings[0]

doc_embeds = co.embed(
    texts=[
        "Japan's population is approximately 125 million.",
        "Tokyo is the capital of Japan.",
    ],
    model="embed-multilingual-v3.0",
    input_type="search_document",    # For documents
).embeddings
```

### 2.4 Google Vertex AI Embedding

```python
from google.cloud import aiplatform
from vertexai.language_models import TextEmbeddingModel

# Google's multilingual embedding model
model = TextEmbeddingModel.from_pretrained("text-multilingual-embedding-002")

embeddings = model.get_embeddings(
    texts=["Fundamentals of machine learning", "Introduction to deep learning"],
    auto_truncate=True,
)

for emb in embeddings:
    print(f"Dimensions: {len(emb.values)}")  # 768
    print(f"Statistics: {emb.statistics}")
```

### 2.5 Running Embedding Models Locally

```python
# Fast inference with the ONNX runtime
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
import numpy as np

# Load an ONNX-optimized model
model = ORTModelForFeatureExtraction.from_pretrained(
    "BAAI/bge-m3",
    export=True,  # First run converts PyTorch → ONNX
)
tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-m3")

# Inference
inputs = tokenizer(
    ["Learning the fundamentals of machine learning"],
    padding=True,
    truncation=True,
    max_length=512,
    return_tensors="np",
)

outputs = model(**inputs)
# Use the [CLS] token output as the embedding
embedding = outputs.last_hidden_state[:, 0, :]
embedding = embedding / np.linalg.norm(embedding, axis=1, keepdims=True)
print(f"Shape: {embedding.shape}")  # (1, 1024)
```

---

## 3. Embedding Model Comparison

### 3.1 Performance and Specification Comparison

| Model | Dimensions | Max Input | Japanese | MTEB | Price | License |
|-------|-----------|-----------|----------|------|-------|---------|
| text-embedding-3-large | 3072 | 8191 tok | Good | 64.6 | $0.13/1M | API |
| text-embedding-3-small | 1536 | 8191 tok | Fair | 62.3 | $0.02/1M | API |
| Cohere embed-v3 | 1024 | 512 tok | Excellent | 64.5 | $0.10/1M | API |
| Voyage-3 | 1024 | 32000 tok | Good | 67.1 | $0.06/1M | API |
| BGE-M3 | 1024 | 8192 tok | Excellent | 65.0 | Free | MIT |
| multilingual-e5-large | 1024 | 512 tok | Excellent | 61.5 | Free | MIT |
| nomic-embed-text | 768 | 8192 tok | Fair | 62.4 | Free | Apache 2.0 |

### 3.2 Recommended Models by Use Case

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Japanese search | BGE-M3 / Cohere v3 | Best multilingual performance |
| Low-cost large-scale processing | text-embedding-3-small | Cheapest + sufficient quality |
| Highest accuracy | Voyage-3 / BGE-M3 | Top MTEB scores |
| Long document support | Voyage-3 | Supports 32K tokens |
| On-premises | BGE-M3 | OSS + high performance |
| Edge devices | nomic-embed-text | Lightweight 768 dimensions |

### 3.3 Embedding Model Selection Flowchart

```
┌──────────────────────────────────────────────────────────┐
│          Embedding Model Selection Flow                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  START: Check requirements                               │
│    │                                                     │
│    ├── Cannot send data to the cloud?                    │
│    │   YES → OSS model                                   │
│    │         ├── Multilingual → BGE-M3                   │
│    │         ├── Lightweight  → nomic-embed-text          │
│    │         └── Japanese-focused → multilingual-e5-large │
│    │                                                     │
│    NO ↓                                                  │
│    ├── Handling long documents (8K+ tokens)?             │
│    │   YES → Voyage-3 (32K support)                      │
│    │                                                     │
│    NO ↓                                                  │
│    ├── Cost is a priority?                               │
│    │   YES → text-embedding-3-small ($0.02/1M)           │
│    │                                                     │
│    NO ↓                                                  │
│    ├── Japanese language is a priority?                  │
│    │   YES → Cohere embed-v3 / BGE-M3                    │
│    │                                                     │
│    NO ↓                                                  │
│    └── Highest accuracy                                  │
│         → text-embedding-3-large (dimensions=1024)       │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Practical Application Patterns

### 4.1 Semantic Search

```python
import numpy as np
from openai import OpenAI

client = OpenAI()

def semantic_search(query: str, documents: list[str], top_k: int = 5) -> list:
    """Basic implementation of semantic search"""

    # Embed all texts at once
    all_texts = [query] + documents
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=all_texts,
    )

    query_vec = np.array(response.data[0].embedding)
    doc_vecs = np.array([d.embedding for d in response.data[1:]])

    # Compute cosine similarity
    similarities = np.dot(doc_vecs, query_vec) / (
        np.linalg.norm(doc_vecs, axis=1) * np.linalg.norm(query_vec)
    )

    # Return top k results
    top_indices = np.argsort(similarities)[::-1][:top_k]
    return [
        {"text": documents[i], "score": float(similarities[i])}
        for i in top_indices
    ]

# Example usage
docs = [
    "Python is a general-purpose programming language widely used in machine learning",
    "JavaScript is a scripting language that runs in web browsers",
    "Deep learning is a machine learning method that uses multi-layer neural networks",
    "Sushi is a Japanese dish combining vinegared rice with seafood",
]
results = semantic_search("What language is used in AI?", docs, top_k=2)
for r in results:
    print(f"[{r['score']:.4f}] {r['text']}")
```

### 4.2 Hybrid Search (Vector + Keyword)

```python
import numpy as np
from rank_bm25 import BM25Okapi
import MeCab

def hybrid_search(
    query: str,
    documents: list[str],
    alpha: float = 0.5,  # 0=keyword only, 1=vector only
    top_k: int = 5,
) -> list[dict]:
    """Hybrid search: BM25 + Embedding"""

    # 1. BM25 (keyword search)
    mecab = MeCab.Tagger("-Owakati")
    tokenized_docs = [mecab.parse(doc).strip().split() for doc in documents]
    tokenized_query = mecab.parse(query).strip().split()

    bm25 = BM25Okapi(tokenized_docs)
    bm25_scores = bm25.get_scores(tokenized_query)
    # Normalize (0-1)
    if bm25_scores.max() > 0:
        bm25_scores = bm25_scores / bm25_scores.max()

    # 2. Embedding (semantic search)
    all_texts = [query] + documents
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=all_texts,
    )
    query_vec = np.array(response.data[0].embedding)
    doc_vecs = np.array([d.embedding for d in response.data[1:]])

    cosine_scores = np.dot(doc_vecs, query_vec) / (
        np.linalg.norm(doc_vecs, axis=1) * np.linalg.norm(query_vec)
    )
    # Normalize (0-1)
    cosine_scores = (cosine_scores + 1) / 2

    # 3. Combine scores
    hybrid_scores = alpha * cosine_scores + (1 - alpha) * bm25_scores

    # Return top k results
    top_indices = np.argsort(hybrid_scores)[::-1][:top_k]
    return [
        {
            "text": documents[i],
            "hybrid_score": float(hybrid_scores[i]),
            "vector_score": float(cosine_scores[i]),
            "bm25_score": float(bm25_scores[i]),
        }
        for i in top_indices
    ]
```

### 4.3 Clustering

```python
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import numpy as np

def cluster_texts(texts: list[str], n_clusters: int = 3):
    """Cluster texts into groups"""
    # Get embeddings
    embeddings = get_embeddings(texts)  # [N, dim]

    # K-means clustering
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(embeddings)

    # Reduce to 2D with PCA for visualization
    pca = PCA(n_components=2)
    reduced = pca.fit_transform(embeddings)

    # Group by cluster
    clusters = {}
    for text, label in zip(texts, labels):
        clusters.setdefault(int(label), []).append(text)

    return clusters

# Example usage
texts = [
    "Machine learning with Python", "How to use TensorFlow", "PyTorch tutorial",
    "Tourist spots in Tokyo", "Temples in Kyoto", "Street food in Osaka",
    "How to file taxes", "Calculating local taxes", "Year-end tax adjustment steps",
]
clusters = cluster_texts(texts, n_clusters=3)
for label, items in clusters.items():
    print(f"\nCluster {label}:")
    for item in items:
        print(f"  - {item}")
```

### 4.4 Anomaly Detection

```python
import numpy as np

def detect_anomalies(
    reference_texts: list[str],
    test_texts: list[str],
    threshold: float = 0.5,
) -> list[dict]:
    """Embedding-based anomaly detection"""

    ref_embeddings = np.array(get_embeddings(reference_texts))
    test_embeddings = np.array(get_embeddings(test_texts))

    # Compute centroid of reference texts
    centroid = ref_embeddings.mean(axis=0)
    centroid /= np.linalg.norm(centroid)  # Normalize

    results = []
    for text, emb in zip(test_texts, test_embeddings):
        emb_norm = emb / np.linalg.norm(emb)
        similarity = np.dot(centroid, emb_norm)
        is_anomaly = similarity < threshold
        results.append({
            "text": text,
            "similarity": float(similarity),
            "is_anomaly": is_anomaly,
        })

    return results
```

### 4.5 Text Classification (Zero-Shot)

```python
def zero_shot_classify(text: str, categories: list[str]) -> dict:
    """Zero-shot classification using embeddings"""

    # Embed the text and all categories
    all_inputs = [text] + categories
    embeddings = get_embeddings(all_inputs)

    text_emb = np.array(embeddings[0])
    cat_embs = np.array(embeddings[1:])

    # Compute similarity to each category
    similarities = np.dot(cat_embs, text_emb) / (
        np.linalg.norm(cat_embs, axis=1) * np.linalg.norm(text_emb)
    )

    # Convert to probabilities with softmax
    exp_sim = np.exp(similarities * 10)  # temperature=0.1
    probs = exp_sim / exp_sim.sum()

    return {cat: float(prob) for cat, prob in zip(categories, probs)}

# Example usage
result = zero_shot_classify(
    "A new GPU was announced, tripling AI processing speed",
    ["Technology", "Sports", "Politics", "Entertainment"]
)
# → {'Technology': 0.89, 'Sports': 0.03, 'Politics': 0.04, 'Entertainment': 0.04}
```

### 4.6 Duplicate Detection (Deduplication)

```python
import numpy as np
from itertools import combinations

def find_near_duplicates(
    texts: list[str],
    threshold: float = 0.95,
) -> list[tuple[int, int, float]]:
    """Embedding-based near-duplicate detection"""

    embeddings = np.array(get_embeddings(texts))
    # Normalize
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normalized = embeddings / norms

    # Compute similarity matrix
    similarity_matrix = np.dot(normalized, normalized.T)

    # Extract pairs above threshold
    duplicates = []
    for i, j in combinations(range(len(texts)), 2):
        sim = similarity_matrix[i, j]
        if sim >= threshold:
            duplicates.append((i, j, float(sim)))

    return sorted(duplicates, key=lambda x: -x[2])

# Example usage
texts = [
    "Python is a popular programming language",
    "Python is a widely used programming language",  # Near duplicate
    "JavaScript is a language used on the web",
    "It is a nice day today",
]

duplicates = find_near_duplicates(texts, threshold=0.9)
for i, j, sim in duplicates:
    print(f"[{sim:.4f}] '{texts[i]}' ≈ '{texts[j]}'")
```

### 4.7 Recommendations

```python
import numpy as np

class EmbeddingRecommender:
    """Embedding-based recommendation engine"""

    def __init__(self):
        self.items: list[dict] = []
        self.embeddings: np.ndarray | None = None

    def add_items(self, items: list[dict]):
        """Add items (title, description, metadata)"""
        self.items = items
        texts = [f"{item['title']}: {item['description']}" for item in items]
        self.embeddings = np.array(get_embeddings(texts))
        # Normalize
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        self.embeddings = self.embeddings / norms

    def recommend_by_text(self, query: str, top_k: int = 5) -> list[dict]:
        """Recommend based on a text query"""
        query_emb = np.array(get_embeddings([query])[0])
        query_emb = query_emb / np.linalg.norm(query_emb)

        scores = np.dot(self.embeddings, query_emb)
        top_indices = np.argsort(scores)[::-1][:top_k]

        return [
            {**self.items[i], "score": float(scores[i])}
            for i in top_indices
        ]

    def recommend_similar(self, item_index: int, top_k: int = 5) -> list[dict]:
        """Recommend similar items"""
        scores = np.dot(self.embeddings, self.embeddings[item_index])
        top_indices = np.argsort(scores)[::-1][1:top_k+1]  # Exclude self

        return [
            {**self.items[i], "score": float(scores[i])}
            for i in top_indices
        ]

    def recommend_by_history(
        self, viewed_indices: list[int], top_k: int = 5
    ) -> list[dict]:
        """Recommend based on viewing history"""
        # Average vector of viewed items
        viewed_embs = self.embeddings[viewed_indices]
        profile = viewed_embs.mean(axis=0)
        profile = profile / np.linalg.norm(profile)

        scores = np.dot(self.embeddings, profile)

        # Exclude already-viewed items
        for idx in viewed_indices:
            scores[idx] = -1

        top_indices = np.argsort(scores)[::-1][:top_k]
        return [
            {**self.items[i], "score": float(scores[i])}
            for i in top_indices
        ]
```

---

## 5. Dimensionality Reduction and Performance Optimization

```
┌──────────────────────────────────────────────────────────┐
│          Embedding Optimization Trade-offs                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Dimensions  Accuracy   Storage      Search Speed        │
│  3072        Best       ×3           Slow                │
│  1536        High       ×1.5         Moderate            │
│  1024        Good       ×1           Fast  ← Recommended │
│  512         Moderate   ×0.5         Fastest             │
│  256         Reduced    ×0.25        Fastest             │
│                                                          │
│  Recommended: 1024 dimensions offers the best value      │
│  Reason: only 1-2% accuracy drop vs. major storage/speed │
│          improvements                                    │
│                                                          │
│  Matryoshka Embedding:                                   │
│  text-embedding-3 can be truncated to any dimension count │
│  Just specify with the dimensions parameter              │
└──────────────────────────────────────────────────────────┘
```

### 5.1 Matryoshka Representation Learning (MRL)

```python
from openai import OpenAI

client = OpenAI()

# Embed the same text at different dimension counts
text = "Learning the fundamentals of machine learning"

for dim in [256, 512, 1024, 3072]:
    response = client.embeddings.create(
        model="text-embedding-3-large",
        input=text,
        dimensions=dim,
    )
    emb = response.data[0].embedding
    print(f"Dimensions: {dim:4d}, Memory: {dim * 4:>5d} bytes/vector")

# Output:
# Dimensions:  256, Memory:  1024 bytes/vector
# Dimensions:  512, Memory:  2048 bytes/vector
# Dimensions: 1024, Memory:  4096 bytes/vector
# Dimensions: 3072, Memory: 12288 bytes/vector

# Benefits of MRL:
# - Flexible accuracy vs. cost trade-off with the same model
# - Earlier dimensions retain the most important information
# - Enables staged search (coarse → fine)
```

### 5.2 Batch Processing and Parallelization

```python
import asyncio
from openai import AsyncOpenAI

async def batch_embed(texts: list[str], batch_size: int = 100) -> list:
    """Efficient embedding of large amounts of text"""
    client = AsyncOpenAI()
    all_embeddings = []

    # Split into batches
    batches = [texts[i:i+batch_size] for i in range(0, len(texts), batch_size)]

    # Parallel execution (watch rate limits)
    semaphore = asyncio.Semaphore(5)  # Up to 5 concurrent requests

    async def embed_batch(batch):
        async with semaphore:
            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=batch,
            )
            return [d.embedding for d in response.data]

    results = await asyncio.gather(*[embed_batch(b) for b in batches])

    for batch_result in results:
        all_embeddings.extend(batch_result)

    return all_embeddings
```

### 5.3 Embedding Cache Strategy

```python
import hashlib
import json
import sqlite3
import numpy as np
from typing import Optional

class EmbeddingCache:
    """SQLite-based embedding cache"""

    def __init__(self, db_path: str = "embedding_cache.db", model: str = "text-embedding-3-small"):
        self.model = model
        self.conn = sqlite3.connect(db_path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                text_hash TEXT PRIMARY KEY,
                model TEXT,
                embedding BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    def _hash(self, text: str) -> str:
        return hashlib.sha256(f"{self.model}:{text}".encode()).hexdigest()

    def get(self, text: str) -> Optional[list[float]]:
        """Retrieve an embedding from cache"""
        row = self.conn.execute(
            "SELECT embedding FROM embeddings WHERE text_hash = ?",
            (self._hash(text),),
        ).fetchone()
        if row:
            return json.loads(row[0])
        return None

    def put(self, text: str, embedding: list[float]):
        """Save an embedding to cache"""
        self.conn.execute(
            "INSERT OR REPLACE INTO embeddings (text_hash, model, embedding) VALUES (?, ?, ?)",
            (self._hash(text), self.model, json.dumps(embedding)),
        )
        self.conn.commit()

    def get_or_create(self, texts: list[str]) -> list[list[float]]:
        """Call the API only for cache-miss texts"""
        results = [None] * len(texts)
        uncached_indices = []

        for i, text in enumerate(texts):
            cached = self.get(text)
            if cached:
                results[i] = cached
            else:
                uncached_indices.append(i)

        if uncached_indices:
            uncached_texts = [texts[i] for i in uncached_indices]
            response = client.embeddings.create(
                model=self.model, input=uncached_texts
            )
            for idx, emb_data in zip(uncached_indices, response.data):
                results[idx] = emb_data.embedding
                self.put(texts[idx], emb_data.embedding)

        return results

# Example usage
cache = EmbeddingCache()
embeddings = cache.get_or_create(["Hello", "World", "Hello"])  # "Hello" calls the API only once
```

---

## 6. Fine-Tuning Embedding Models

### 6.1 Fine-Tuning with Sentence Transformers

```python
from sentence_transformers import (
    SentenceTransformer,
    InputExample,
    losses,
)
from torch.utils.data import DataLoader

# Load base model
model = SentenceTransformer("BAAI/bge-m3")

# Prepare training data (positive pairs)
train_examples = [
    InputExample(texts=["How to use Python", "Introduction to Python programming"], label=0.9),
    InputExample(texts=["How to use Python", "Fundamentals of Java"], label=0.3),
    InputExample(texts=["What is machine learning", "Fundamentals of deep learning"], label=0.8),
    InputExample(texts=["What is machine learning", "Today's weather"], label=0.05),
    # 1000+ pairs recommended
]

train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)

# CosineSimilarity Loss (regression-type)
train_loss = losses.CosineSimilarityLoss(model)

# Training
model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=3,
    warmup_steps=100,
    output_path="./finetuned-embedding",
)

# Using the fine-tuned model
finetuned = SentenceTransformer("./finetuned-embedding")
embeddings = finetuned.encode(["Test document"])
```

### 6.2 Fine-Tuning with Contrastive Learning

```python
from sentence_transformers import InputExample, losses
from sentence_transformers.evaluation import InformationRetrievalEvaluator

# Triplet Loss (anchor, positive, negative)
triplet_examples = [
    InputExample(texts=[
        "Data analysis with Python",     # Anchor
        "Data processing with pandas",   # Positive (similar)
        "JavaScript frameworks",          # Negative (dissimilar)
    ]),
    # ...
]

triplet_loader = DataLoader(triplet_examples, shuffle=True, batch_size=16)
triplet_loss = losses.TripletLoss(model, distance_metric=losses.TripletDistanceMetric.COSINE)

# Multiple Negatives Ranking Loss (optimal for large-scale data)
mnrl_examples = [
    InputExample(texts=["Query 1", "Relevant document 1"]),
    InputExample(texts=["Query 2", "Relevant document 2"]),
    # Other pairs in the batch automatically become negatives
]

mnrl_loader = DataLoader(mnrl_examples, shuffle=True, batch_size=32)
mnrl_loss = losses.MultipleNegativesRankingLoss(model)

# Configure evaluator
evaluator = InformationRetrievalEvaluator(
    queries={"q1": "Python data analysis", "q2": "Machine learning introduction"},
    corpus={"d1": "How to use pandas...", "d2": "scikit-learn tutorial..."},
    relevant_docs={"q1": {"d1"}, "q2": {"d2"}},
)

model.fit(
    train_objectives=[(mnrl_loader, mnrl_loss)],
    evaluator=evaluator,
    epochs=5,
    evaluation_steps=500,
    output_path="./finetuned-retrieval",
)
```

---

## 7. Text Chunking Strategies

```
┌──────────────────────────────────────────────────────────┐
│          Text Chunking Strategies                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Fixed Size Splitting                                 │
│     ├── Easiest to implement                             │
│     ├── Risk of cutting mid-sentence                     │
│     └── Recommended chunk size: 256-512 tokens          │
│                                                          │
│  2. Semantic Chunking                                    │
│     ├── Split at sentence/paragraph boundaries           │
│     ├── Split where embedding similarity changes sharply │
│     └── High semantic coherence                         │
│                                                          │
│  3. Overlapping Splits (Sliding Window)                  │
│     ├── Add overlap regions between chunks               │
│     ├── Reduces information loss near boundaries         │
│     └── Recommended overlap: 50-100 tokens               │
│                                                          │
│  4. Recursive Splitting                                  │
│     ├── LangChain's RecursiveCharacterTextSplitter        │
│     ├── Splits hierarchically: paragraph → sentence → word │
│     └── Most versatile and highest quality               │
│                                                          │
│  5. Document Structure-Based                             │
│     ├── Markdown: split by headers                       │
│     ├── HTML: split by tag structure                     │
│     └── Code: split by function/class                    │
└──────────────────────────────────────────────────────────┘
```

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Recursive splitting (most common)
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,        # Character count, not token count
    chunk_overlap=50,      # Number of overlapping characters
    separators=["\n\n", "\n", ".", ",", " ", ""],  # Split priority order
    length_function=len,
)

chunks = splitter.split_text(long_document)

# Semantic chunking (embedding similarity-based)
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

semantic_splitter = SemanticChunker(
    OpenAIEmbeddings(model="text-embedding-3-small"),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=90,  # Split where similarity is low
)

semantic_chunks = semantic_splitter.split_text(long_document)
```

---

## 8. Troubleshooting

### 8.1 Common Issues and Solutions

```
┌──────────────────────────────────────────────────────────┐
│          Embedding Troubleshooting                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue 1: Poor search accuracy                           │
│  ├── Cause 1: Inappropriate chunk size                   │
│  │   └── Solution: Adjust to 256-512 tokens             │
│  ├── Cause 2: Query and document formats differ          │
│  │   └── Solution: e5 models need "query:" "passage:" prefixes │
│  ├── Cause 3: Model has weak language support            │
│  │   └── Solution: Switch to multilingual model (BGE-M3) │
│  └── Cause 4: Many domain-specific terms                 │
│      └── Solution: Consider fine-tuning                  │
│                                                          │
│  Issue 2: Slow speed                                     │
│  ├── Cause 1: Calling the API every time                 │
│  │   └── Solution: Add a caching layer                   │
│  ├── Cause 2: Not using batch processing                 │
│  │   └── Solution: Process 100 items per batch           │
│  └── Cause 3: Dimensions are too large                   │
│      └── Solution: Reduce to 1024 dimensions             │
│                                                          │
│  Issue 3: High cost                                      │
│  ├── Cause 1: Using a large model                        │
│  │   └── Solution: Switch to text-embedding-3-small      │
│  ├── Cause 2: Recomputing duplicate texts                │
│  │   └── Solution: Hash-based caching                    │
│  └── Cause 3: Embedding unnecessarily long texts         │
│      └── Solution: Chunk to optimal length               │
│                                                          │
│  Issue 4: Similarity scores don't match intuition        │
│  ├── Cause 1: Wrong distance function choice             │
│  │   └── Solution: Use cosine similarity                 │
│  └── Cause 2: Vectors are not normalized                 │
│      └── Solution: normalize_embeddings=True             │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Embedding Quality Validation

```python
import numpy as np
from itertools import combinations

def validate_embeddings(
    test_pairs: list[tuple[str, str, float]],
    model_name: str = "text-embedding-3-small",
) -> dict:
    """Validate embedding model quality

    test_pairs: [(text_a, text_b, expected_similarity), ...]
    expected_similarity: 0.0 (unrelated) to 1.0 (synonymous)
    """
    texts_a = [p[0] for p in test_pairs]
    texts_b = [p[1] for p in test_pairs]
    expected = [p[2] for p in test_pairs]

    embs_a = np.array(get_embeddings(texts_a, model=model_name))
    embs_b = np.array(get_embeddings(texts_b, model=model_name))

    # Compute cosine similarity
    actual = []
    for a, b in zip(embs_a, embs_b):
        sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        actual.append(float(sim))

    # Correlation coefficient (correlation with expected values)
    from scipy.stats import spearmanr
    correlation, p_value = spearmanr(expected, actual)

    # Classification accuracy (positive/negative at threshold 0.5)
    correct = sum(
        1 for e, a in zip(expected, actual)
        if (e >= 0.5 and a >= 0.5) or (e < 0.5 and a < 0.5)
    )
    accuracy = correct / len(test_pairs)

    return {
        "model": model_name,
        "spearman_correlation": correlation,
        "p_value": p_value,
        "classification_accuracy": accuracy,
        "mean_actual_similarity": np.mean(actual),
    }
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Mixing Embedding Models

```python
# BAD: Using different models at index time and search time
index_embeddings = openai_embed(documents)    # text-embedding-3-large
query_embedding = cohere_embed(query)          # embed-v3
# → Different vector spaces make similarity computation meaningless

# GOOD: Use the same model consistently
index_embeddings = openai_embed(documents, model="text-embedding-3-small")
query_embedding = openai_embed(query, model="text-embedding-3-small")
```

### Anti-Pattern 2: Embedding Very Large Texts Directly

```python
# BAD: Embedding a 100,000-character document as-is
embedding = embed(huge_document)  # Over-compressed information degrades accuracy

# GOOD: Chunk appropriately before embedding
chunks = split_text(huge_document, chunk_size=512)
chunk_embeddings = [embed(chunk) for chunk in chunks]
# → Preserves the meaning of each chunk
```

### Anti-Pattern 3: Large-Scale Processing Without Caching

```python
# BAD: Sending the same text to the API repeatedly
for query in user_queries:  # Many are identical to past queries
    embedding = embed(query)  # API call every time → massive cost

# GOOD: Use a cache
cache = EmbeddingCache()
for query in user_queries:
    embedding = cache.get_or_create([query])[0]
```

### Anti-Pattern 4: Operating Without Visualizing Embeddings

```python
# BAD: Deploying without checking embedding distribution
# → Unexpected clustering results or biases go unnoticed

# GOOD: Regularly visualize to verify quality
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt

def visualize_embeddings(embeddings, labels, title="Embedding Space"):
    tsne = TSNE(n_components=2, random_state=42, perplexity=30)
    reduced = tsne.fit_transform(np.array(embeddings))

    plt.figure(figsize=(10, 8))
    for label in set(labels):
        mask = [l == label for l in labels]
        points = reduced[mask]
        plt.scatter(points[:, 0], points[:, 1], label=label, alpha=0.6)
    plt.legend()
    plt.title(title)
    plt.savefig("embedding_visualization.png")
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

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

Extend the basic implementation to add the following features.

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

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When it can be deprioritized |
|-----------|-------------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to 2               │
│                                                 │
│  2. How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + modular split  │
│    └─ Daily/multiple times → Go to 3             │
│                                                 │
│  3. How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job but increases operational costs

**3. Level of abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but leads to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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

## 10. FAQ

### Q1: How should I choose the number of embedding dimensions?

For RAG and search use cases, 1024 dimensions offers a good balance between accuracy and cost.
For large-scale data (millions of records or more), reduce to 256-512 dimensions to prioritize storage and speed.
If accuracy is paramount, use 1536-3072 dimensions and compensate for speed with an ANN index (such as HNSW).

### Q2: Is fine-tuning an embedding model effective?

When there are many domain-specific terms or concepts (medical, legal, specific industries), fine-tuning can yield a 5-15% accuracy improvement.
Contrastive learning is possible with Sentence Transformers' `SentenceTransformerTrainer`.
However, for general-purpose use, the latest pre-trained models may perform better.

### Q3: What should I watch out for with Japanese embeddings?

The quality of the tokenizer's Japanese support directly affects performance.
BGE-M3, Cohere embed-v3, and multilingual-e5 perform well for Japanese.
Japanese-specialized models (such as intfloat/multilingual-e5-large) should be evaluated using JSTS/JSICK benchmarks.
For models that use different prefixes for "queries" and "documents" (e5-family), this distinction has a large impact on accuracy.

### Q4: What should I be careful about when changing embedding models?

When changing models, all vectors must be recomputed. Vector spaces from different models are not compatible.
Gradual migration: run the old and new models in parallel, compare quality, then switch.
Version management: record the model name and version in metadata.

### Q5: What is the difference between Sparse Embeddings and Dense Embeddings?

Dense Embeddings (this chapter): all dimensions have values (1024 values in a 1024-dimensional space). Strong for semantic similarity.
Sparse Embeddings (BM25, SPLADE, etc.): most dimensions are 0. Strong for keyword matching.
Hybrid search: combining both achieves the best search accuracy.
BGE-M3 is one of the only models capable of generating both Dense and Sparse embeddings.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just from theory, but by actually writing code and verifying how it works.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and moving on to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|---------------|
| Recommended API model | text-embedding-3-small (cost-effective) / Voyage-3 (accuracy) |
| Recommended OSS model | BGE-M3 (multilingual) / nomic-embed-text (lightweight) |
| Recommended for Japanese | BGE-M3 / Cohere embed-v3 |
| Recommended dimensions | 1024 (balanced) |
| Distance function | Cosine similarity (equivalent to dot product for normalized vectors) |
| Batch size | 100-500 texts/request |
| Chunk size | 256-512 tokens (overlap 50-100) |
| Caching | Required (SQLite / Redis) |
| Primary use cases | Search, classification, clustering, anomaly detection, RAG |

---

## What to Read Next

- [01-rag.md](./01-rag.md) — RAG pipeline leveraging embeddings
- [04-multimodal.md](./04-multimodal.md) — Multimodal embeddings
- [../03-infrastructure/01-vector-databases.md](../03-infrastructure/01-vector-databases.md) — Selecting and operating vector databases

---

## References

1. Muennighoff et al., "MTEB: Massive Text Embedding Benchmark," EACL 2023
2. OpenAI, "Embeddings Guide," https://platform.openai.com/docs/guides/embeddings
3. Xiao et al., "C-Pack: Packaged Resources To Advance General Chinese Embedding," arXiv:2309.07597, 2023
4. Sentence Transformers, "Documentation," https://www.sbert.net/
5. Kusupati et al., "Matryoshka Representation Learning," NeurIPS 2022
6. Karpukhin et al., "Dense Passage Retrieval for Open-Domain Question Answering," EMNLP 2020
