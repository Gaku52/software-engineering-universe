# RAG — Retrieval-Augmented Generation, Chunking, and Reranking

> RAG (Retrieval-Augmented Generation) is a technique that retrieves and injects relevant information from an external knowledge base at generation time, simultaneously reducing hallucinations and enabling access to up-to-date information. It is a core pattern for operating LLMs in production.

## What You Will Learn

1. **Basic RAG Architecture** — Three-phase design: Indexing, Retrieval, and Generation
2. **Chunking and Embedding Optimization** — Splitting strategies, Embedding model selection, metadata utilization
3. **Advanced Retrieval and Reranking** — Hybrid search, rerankers, query transformation
4. **Agentic RAG and Multi-Step Reasoning** — Tool integration, autonomous retrieval, routing
5. **Production Operations and Evaluation** — Monitoring, caching, and continuous improvement pipelines


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Prompt Engineering — Chain-of-Thought, Few-shot, and Template Design](./00-prompt-engineering.md)

---

## 1. Basic RAG Architecture

```
┌──────────────────────────────────────────────────────────┐
│              RAG Pipeline Overview                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Index Construction (Offline)]                          │
│                                                          │
│  Documents → Chunking → Embedding → Vector DB Storage    │
│  ┌────┐   ┌──────┐    ┌────────┐   ┌──────────┐        │
│  │ PDF│   │chunk1│    │[0.1,..]│   │Pinecone  │        │
│  │ Web│──▶│chunk2│──▶│[0.3,..]│──▶│Weaviate  │        │
│  │ DB │   │chunk3│    │[0.7,..]│   │pgvector  │        │
│  └────┘   └──────┘    └────────┘   └──────────┘        │
│                                                          │
│  [Retrieval & Generation (Online)]                       │
│                                                          │
│  User                                                    │
│  Query ──▶ Embedding ──▶ Vector Search                   │
│    │                          │                          │
│    │                   Relevant Chunks (top-k)           │
│    │                          │                          │
│    └────────┐                 │                          │
│             ▼                 ▼                          │
│         ┌──────────────────────────┐                    │
│         │   Prompt Construction    │                    │
│         │   [System Instructions]  │                    │
│         │   [Retrieval Context]    │                    │
│         │   [User Question]        │                    │
│         └──────────┬───────────────┘                    │
│                    ▼                                     │
│              Generate Answer with LLM                    │
│              (with citations)                            │
└──────────────────────────────────────────────────────────┘
```

### 1.1 Comparing RAG with Other Knowledge Injection Methods

| Method | Knowledge Update Cost | Accuracy | Latency | Use Case |
|--------|----------------------|----------|---------|----------|
| RAG | Low (DB update only) | High | Medium–High | Frequently updated knowledge, internal documents |
| Fine-tuning | High (retraining required) | High | Low | Stable specialized knowledge, style/format changes |
| Prompt Engineering | Lowest | Medium | Low | Small amounts of fixed knowledge, format specification |
| Long Context | Low | Medium–High | High | Few long documents, in-session references |
| Knowledge Graph + RAG | Medium | Highest | High | When structured relationships are important |

### 1.2 RAG Maturity Model

```
┌─────────────────────────────────────────────────────────────────┐
│                RAG Maturity Model (5 Levels)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1: Naive RAG                                            │
│  ├── Simple vector search + LLM generation                     │
│  ├── Fixed chunk size, single Embedding model                  │
│  └── No evaluation, no feedback loop                           │
│                                                                 │
│  Level 2: Advanced RAG                                         │
│  ├── Hybrid search, reranking                                  │
│  ├── Semantic chunking, metadata filtering                     │
│  └── Basic evaluation metrics (Recall@k, MRR)                 │
│                                                                 │
│  Level 3: Modular RAG                                          │
│  ├── Each pipeline component is interchangeable                │
│  ├── Query transformation, Multi-Query, HyDE                   │
│  └── Automated evaluation (RAGAS) + A/B testing               │
│                                                                 │
│  Level 4: Agentic RAG                                          │
│  ├── LLM autonomously executes retrieval as a tool             │
│  ├── Multi-step reasoning, iterative retrieval                 │
│  └── Self-correction, retrieval confidence scoring             │
│                                                                 │
│  Level 5: Adaptive RAG                                         │
│  ├── Dynamically selects strategy based on query complexity    │
│  ├── Pipeline optimization via continuous learning             │
│  └── Automatic improvement driven by user feedback             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Chunking Strategies

### 2.1 Comparison of Splitting Methods

```python
from langchain.text_splitter import (
    CharacterTextSplitter,
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
)

document = "... long document text ..."

# Method 1: Fixed-length splitting (simplest)
fixed_splitter = CharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separator="\n"
)

# Method 2: Recursive splitting (recommended)
recursive_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", "、", " ", ""]
    # → Tries splitting in order: paragraph > line > sentence > phrase > word
)

# Method 3: Token-based splitting
token_splitter = TokenTextSplitter(
    chunk_size=256,     # Specified in token count
    chunk_overlap=32,
)

chunks = recursive_splitter.split_text(document)
```

### 2.2 Semantic Chunking

```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

# Split at semantic boundaries (split at points where Embedding similarity changes)
semantic_splitter = SemanticChunker(
    OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,
)

chunks = semantic_splitter.split_text(document)
# → Yields semantically coherent chunks
```

### 2.3 Chunk Strategy by Document Type

```python
from langchain.text_splitter import (
    MarkdownTextSplitter,
    PythonCodeTextSplitter,
    HTMLHeaderTextSplitter,
)

# Markdown documents — split while respecting header hierarchy
markdown_splitter = MarkdownTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
)

# Python code — split at function/class boundaries
code_splitter = PythonCodeTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
)

# HTML — hierarchically split by header tags (h1, h2, h3)
html_splitter = HTMLHeaderTextSplitter(
    headers_to_split_on=[
        ("h1", "Header 1"),
        ("h2", "Header 2"),
        ("h3", "Header 3"),
    ]
)

# Table data — split by row, attaching header to each chunk
def split_table_document(text: str, max_rows_per_chunk: int = 20) -> list[str]:
    """Split a document containing tables by row"""
    lines = text.strip().split("\n")
    header = lines[0] if lines else ""
    separator = lines[1] if len(lines) > 1 and set(lines[1].strip()) <= {"-", "|", " "} else None

    data_start = 2 if separator else 1
    data_lines = lines[data_start:]

    chunks = []
    for i in range(0, len(data_lines), max_rows_per_chunk):
        chunk_lines = data_lines[i:i + max_rows_per_chunk]
        if separator:
            chunk = f"{header}\n{separator}\n" + "\n".join(chunk_lines)
        else:
            chunk = f"{header}\n" + "\n".join(chunk_lines)
        chunks.append(chunk)

    return chunks
```

### 2.4 Parent-Child Chunking

```python
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

# Parent: large chunks (for context retention)
# Child: small chunks (for improved retrieval accuracy)
parent_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=200)
child_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=50)

vectorstore = Chroma(
    collection_name="child_chunks",
    embedding_function=OpenAIEmbeddings(),
)
store = InMemoryStore()

retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=store,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)

# Add documents
retriever.add_documents(documents)

# Search: precise search with Child → returns Parent chunk
# → Balances retrieval accuracy with context
results = retriever.get_relevant_documents("What are the benefits of RAG?")
```

### 2.5 Optimizing Chunk Splitting Parameters

| Parameter | Recommended Range | When Small | When Large |
|-----------|------------------|------------|------------|
| chunk_size | 256–1024 tokens | Precise retrieval, insufficient context | Rich context, noise introduced |
| chunk_overlap | 10–20% of size | Risk of information loss | Duplication, increased cost |
| top_k | 3–10 | Insufficient information | Consumes context window |

### 2.6 Metadata Strategy

```python
from datetime import datetime
from typing import Any

def create_chunk_with_metadata(
    text: str,
    source: str,
    document_title: str,
    section_hierarchy: list[str],
    page_number: int | None = None,
    created_at: datetime | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    """Attach rich metadata to a chunk"""
    return {
        "text": text,
        "metadata": {
            # Basic information
            "source": source,                          # File path / URL
            "document_title": document_title,          # Document title
            "section_hierarchy": section_hierarchy,     # ["Chapter 1", "Section 1.2", "Overview"]

            # Location information
            "page_number": page_number,
            "chunk_index": None,  # Set later

            # Temporal information
            "created_at": (created_at or datetime.now()).isoformat(),
            "indexed_at": datetime.now().isoformat(),

            # Classification information
            "tags": tags or [],
            "document_type": _detect_doc_type(source),  # pdf, html, md, etc.
            "language": "en",

            # Search optimization
            "summary": None,        # Pre-generated by LLM
            "questions": None,      # Hypothetical questions for the chunk (see below)
        }
    }


def enrich_chunk_with_llm(chunk: dict, llm_client) -> dict:
    """Enrich chunk metadata with LLM"""

    text = chunk["text"]

    # 1. Generate a summary
    summary_response = llm_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"Summarize the following text in one sentence:\n\n{text}"
        }],
    )
    chunk["metadata"]["summary"] = summary_response.choices[0].message.content

    # 2. Generate hypothetical questions
    questions_response = llm_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"Generate 3 questions a user might ask about the following text. Output one per line:\n\n{text}"
        }],
    )
    chunk["metadata"]["questions"] = questions_response.choices[0].message.content.strip().split("\n")

    return chunk
```

---

## 3. Embeddings and Vector Search

### 3.1 Choosing an Embedding Model

```python
# OpenAI Embedding
from openai import OpenAI
client = OpenAI()

response = client.embeddings.create(
    model="text-embedding-3-large",  # 3072 dimensions
    input="What is RAG?",
    dimensions=1024,  # Dimensionality reduction option (reduces cost)
)
vector = response.data[0].embedding

# Cohere Embed v3 (strong multilingual support)
import cohere
co = cohere.Client("YOUR_API_KEY")

response = co.embed(
    texts=["What is RAG?"],
    model="embed-multilingual-v3.0",
    input_type="search_query",  # Use different types for queries vs. documents
)
vector = response.embeddings[0]

# BGE-M3 (OSS, runs locally)
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
embeddings = model.encode(
    ["What is RAG?"],
    return_dense=True,
    return_sparse=True,     # Also generates sparse vectors
    return_colbert_vecs=True,  # Also generates ColBERT vectors
)
dense_vector = embeddings["dense_vecs"][0]
sparse_vector = embeddings["lexical_weights"][0]
```

### 3.2 Embedding Model Comparison

| Model | Dimensions | Multilingual | Price ($/1M tokens) | MTEB Score |
|-------|-----------|--------------|---------------------|------------|
| text-embedding-3-large | 3072 | Good | $0.13 | 64.6 |
| text-embedding-3-small | 1536 | Fair | $0.02 | 62.3 |
| Cohere embed-v3 | 1024 | Excellent | $0.10 | 64.5 |
| Voyage-3 | 1024 | Good | $0.06 | 67.1 |
| BGE-M3 (OSS) | 1024 | Excellent | Free | 65.0 |
| multilingual-e5-large (OSS) | 1024 | Excellent | Free | 61.5 |

### 3.3 Batch Processing and Optimization for Embeddings

```python
import asyncio
from typing import AsyncIterator

async def batch_embed(
    texts: list[str],
    client: OpenAI,
    model: str = "text-embedding-3-small",
    batch_size: int = 100,
    max_concurrent: int = 5,
) -> list[list[float]]:
    """Efficiently batch-embed a large number of texts"""

    semaphore = asyncio.Semaphore(max_concurrent)
    all_embeddings = [None] * len(texts)

    async def embed_batch(start_idx: int, batch: list[str]):
        async with semaphore:
            response = await asyncio.to_thread(
                client.embeddings.create,
                model=model,
                input=batch,
            )
            for i, item in enumerate(response.data):
                all_embeddings[start_idx + i] = item.embedding

    tasks = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        tasks.append(embed_batch(i, batch))

    await asyncio.gather(*tasks)
    return all_embeddings


def deduplicate_by_embedding(
    chunks: list[dict],
    embeddings: list[list[float]],
    similarity_threshold: float = 0.95,
) -> list[dict]:
    """Remove duplicate chunks by Embedding similarity"""
    import numpy as np

    vectors = np.array(embeddings)
    # Compute cosine similarity matrix
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    normalized = vectors / norms
    similarity_matrix = normalized @ normalized.T

    keep_indices = []
    removed = set()

    for i in range(len(chunks)):
        if i in removed:
            continue
        keep_indices.append(i)
        for j in range(i + 1, len(chunks)):
            if similarity_matrix[i][j] > similarity_threshold:
                removed.add(j)

    return [chunks[i] for i in keep_indices]
```

---

## 4. Implementing a RAG Pipeline

### 4.1 Basic RAG Implementation

```python
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

client = OpenAI()
qdrant = QdrantClient(":memory:")  # Local in-memory

# 1. Create collection
qdrant.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# 2. Index documents
def index_documents(documents: list[dict]):
    points = []
    for i, doc in enumerate(documents):
        embedding = client.embeddings.create(
            model="text-embedding-3-small",
            input=doc["text"],
        ).data[0].embedding

        points.append(PointStruct(
            id=i,
            vector=embedding,
            payload={"text": doc["text"], "source": doc["source"]},
        ))

    qdrant.upsert(collection_name="docs", points=points)

# 3. Retrieve + Generate
def rag_query(query: str, top_k: int = 5) -> str:
    # Embed the query
    query_vector = client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    ).data[0].embedding

    # Vector search
    results = qdrant.search(
        collection_name="docs",
        query_vector=query_vector,
        limit=top_k,
    )

    # Build context
    context = "\n\n".join([
        f"[Source: {r.payload['source']}]\n{r.payload['text']}"
        for r in results
    ])

    # Generate answer with LLM
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": """
You are a question-answering assistant.
Answer only based on the provided context.
If information is insufficient, state "I cannot answer based on the provided information."
Always cite your sources in the answer.
"""},
            {"role": "user", "content": f"""
Context:
{context}

Question: {query}
"""},
        ],
    )

    return response.choices[0].message.content
```

### 4.2 Hybrid Search

```python
# Combination of vector search + keyword search
from qdrant_client.models import Filter, FieldCondition, MatchValue

def hybrid_search(query: str, top_k: int = 10) -> list:
    """Hybrid of vector search + BM25"""

    # 1. Vector search (semantic similarity)
    query_vector = embed(query)
    vector_results = qdrant.search(
        collection_name="docs",
        query_vector=query_vector,
        limit=top_k,
    )

    # 2. Keyword search (BM25 / full-text search)
    keyword_results = keyword_search(query, top_k=top_k)

    # 3. Merge scores with Reciprocal Rank Fusion (RRF)
    rrf_scores = {}
    k = 60  # RRF constant

    for rank, result in enumerate(vector_results):
        doc_id = result.id
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1 / (k + rank + 1)

    for rank, result in enumerate(keyword_results):
        doc_id = result["id"]
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1 / (k + rank + 1)

    # Sort by score
    sorted_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)
    return sorted_ids[:top_k]
```

### 4.3 Search with Metadata Filtering

```python
from qdrant_client.models import (
    Filter,
    FieldCondition,
    MatchValue,
    Range,
    DatetimeRange,
)

def filtered_search(
    query: str,
    department: str | None = None,
    doc_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    tags: list[str] | None = None,
    top_k: int = 10,
) -> list:
    """Vector search with metadata filters"""

    conditions = []

    if department:
        conditions.append(
            FieldCondition(key="department", match=MatchValue(value=department))
        )

    if doc_type:
        conditions.append(
            FieldCondition(key="document_type", match=MatchValue(value=doc_type))
        )

    if date_from or date_to:
        conditions.append(
            FieldCondition(
                key="created_at",
                range=DatetimeRange(
                    gte=date_from,
                    lte=date_to,
                ),
            )
        )

    if tags:
        for tag in tags:
            conditions.append(
                FieldCondition(key="tags", match=MatchValue(value=tag))
            )

    query_filter = Filter(must=conditions) if conditions else None

    query_vector = embed(query)
    results = qdrant.search(
        collection_name="docs",
        query_vector=query_vector,
        query_filter=query_filter,
        limit=top_k,
    )

    return results


# Example: Search only HR department PDF documents
results = filtered_search(
    query="How do I apply for paid leave?",
    department="HR",
    doc_type="pdf",
    date_from="2025-01-01",
    top_k=5,
)
```

### 4.4 Streaming RAG

```python
from openai import OpenAI

def rag_query_streaming(query: str, top_k: int = 5):
    """Streaming-capable RAG query"""

    client = OpenAI()

    # 1. Retrieve
    query_vector = client.embeddings.create(
        model="text-embedding-3-small",
        input=query,
    ).data[0].embedding

    results = qdrant.search(
        collection_name="docs",
        query_vector=query_vector,
        limit=top_k,
    )

    context = "\n\n".join([
        f"[Source: {r.payload['source']}]\n{r.payload['text']}"
        for r in results
    ])

    # 2. Streaming generation
    stream = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Answer based on the provided context."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
        ],
        stream=True,
    )

    # 3. Yield per chunk
    full_response = ""
    for chunk in stream:
        if chunk.choices[0].delta.content:
            token = chunk.choices[0].delta.content
            full_response += token
            yield {
                "type": "token",
                "content": token,
            }

    # 4. Append source information at the end
    yield {
        "type": "sources",
        "content": [
            {"source": r.payload["source"], "score": r.score}
            for r in results
        ],
    }
```

---

## 5. Reranking

```
┌──────────────────────────────────────────────────────────┐
│              Reranking Pipeline                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Query                                                   │
│    │                                                     │
│    ▼                                                     │
│  Initial Retrieval (top-50)  ← Fast but moderate accuracy│
│  (Vector Search / BM25)                                  │
│    │                                                     │
│    ▼                                                     │
│  Reranker (top-50 → top-5)  ← Slow but high accuracy    │
│  (Cross-Encoder / Cohere Rerank / LLM)                   │
│    │                                                     │
│    ▼                                                     │
│  Pass top 5 to LLM as context                            │
│                                                          │
│  Effect: +10–25% improvement in retrieval accuracy       │
└──────────────────────────────────────────────────────────┘
```

### 5.1 Implementing a Reranker

```python
# Cohere Rerank
import cohere

co = cohere.Client("YOUR_API_KEY")

def rerank(query: str, documents: list[str], top_n: int = 5) -> list:
    response = co.rerank(
        model="rerank-multilingual-v3.0",
        query=query,
        documents=documents,
        top_n=top_n,
    )
    return [
        {"index": r.index, "score": r.relevance_score, "text": documents[r.index]}
        for r in response.results
    ]

# Cross-Encoder (OSS)
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-12-v2")

def cross_encoder_rerank(query: str, documents: list[str], top_n: int = 5):
    pairs = [[query, doc] for doc in documents]
    scores = reranker.predict(pairs)

    ranked = sorted(zip(scores, documents), reverse=True)
    return [{"score": s, "text": d} for s, d in ranked[:top_n]]
```

### 5.2 LLM-Based Reranking

```python
import json

def llm_rerank(
    query: str,
    documents: list[dict],
    client: OpenAI,
    top_n: int = 5,
) -> list[dict]:
    """High-accuracy reranking using LLM"""

    doc_list = "\n".join([
        f"[{i}] {doc['text'][:300]}"
        for i, doc in enumerate(documents)
    ])

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Rate the relevance of each document to the query on a scale of 0-10.
Return a JSON array: [{{"index": 0, "score": 8, "reason": "reason"}}]

Query: {query}

Documents:
{doc_list}
""",
        }],
        response_format={"type": "json_object"},
    )

    rankings = json.loads(response.choices[0].message.content)
    scored = sorted(rankings["results"], key=lambda x: x["score"], reverse=True)

    return [
        {**documents[item["index"]], "rerank_score": item["score"]}
        for item in scored[:top_n]
    ]
```

### 5.3 Reranker Comparison

| Reranker | Accuracy | Speed | Cost | Multilingual | Ease of Setup |
|----------|----------|-------|------|--------------|---------------|
| Cohere Rerank v3 | High | Fast | Paid ($1/1K queries) | Excellent | Easy |
| Cross-Encoder (ms-marco) | Medium–High | Medium | Free | Limited | Medium |
| BGE-Reranker-v2 | High | Medium | Free | Good | Medium |
| LLM Rerank (GPT-4o-mini) | Highest | Slow | Medium | Excellent | Easy |
| FlashRank (lightweight) | Medium | Fastest | Free | Limited | Easy |

---

## 6. Advanced RAG Techniques

### 6.1 Query Transformation

```python
async def multi_query_rag(original_query: str) -> str:
    """Improve retrieval accuracy by decomposing the query into multiple perspectives"""

    # Step 1: Transform query into multiple variations
    expansion_prompt = f"""
Rephrase the following question into 3 different search queries from different angles.
Output each query on a separate line.

Question: {original_query}
"""
    response = await call_llm(expansion_prompt)
    queries = [original_query] + response.strip().split("\n")

    # Step 2: Search with each query
    all_results = set()
    for query in queries:
        results = vector_search(query, top_k=5)
        all_results.update(results)

    # Step 3: Rerank and get top results
    reranked = rerank(original_query, list(all_results), top_n=5)

    # Step 4: Generate answer with LLM
    return await generate_answer(original_query, reranked)
```

### 6.2 HyDE (Hypothetical Document Embedding)

```python
async def hyde_search(query: str, top_k: int = 5) -> list:
    """Search after generating a hypothetical document"""

    # Step 1: Use LLM to generate a hypothetical answer to the query
    hyde_prompt = f"""
Generate a detailed answer to the following question.
It does not need to be based on actual knowledge.
Create a plausible answer.

Question: {query}
"""
    hypothetical_doc = await call_llm(hyde_prompt)

    # Step 2: Embed the hypothetical document
    # → Yields a vector close to the actual answer document
    hyde_vector = embed(hypothetical_doc)

    # Step 3: Search using the hypothetical document vector
    results = qdrant.search(
        collection_name="docs",
        query_vector=hyde_vector,
        limit=top_k,
    )

    return results

# Cases where HyDE is effective:
# - Domains with many technical terms (large vocabulary gap between query and documents)
# - Short queries (low information density)
# - Large gap between question format and document format
```

### 6.3 Step-Back Prompting + RAG

```python
async def step_back_rag(query: str) -> str:
    """Search after transforming to an abstract question (Step-Back Prompting)"""

    # Step 1: Abstract the specific question
    step_back_prompt = f"""
Transform the following specific question into a more general, abstract question.
Make it a question that obtains the background knowledge needed to answer the original question.

Specific question: {query}
Abstract question:
"""
    abstract_query = await call_llm(step_back_prompt)

    # Step 2: Search with both the original query and the abstract query
    original_results = vector_search(query, top_k=3)
    abstract_results = vector_search(abstract_query, top_k=3)

    # Step 3: Merge both results to build context
    all_context = merge_and_deduplicate(original_results + abstract_results)

    # Step 4: Generate answer
    return await generate_answer(query, all_context)

# Example:
# Original question: "What is the context window size of GPT-4 in tokens?"
# Abstracted: "What is a context window in large language models, comparison across models"
# → Can retrieve more comprehensive information
```

### 6.4 CRAG (Corrective RAG)

```python
async def corrective_rag(query: str) -> str:
    """Self-evaluate retrieval quality and correct as needed"""

    # Step 1: Initial retrieval
    results = vector_search(query, top_k=5)

    # Step 2: Evaluate relevance of each result with LLM
    evaluation_prompt = f"""
Evaluate whether the following search results are sufficiently relevant to the query.
For each result, return one of: "relevant", "ambiguous", or "irrelevant".

Query: {query}

Search results:
{format_results(results)}

Return in JSON format: [{{"index": 0, "judgment": "relevant"}}]
"""
    evaluations = await call_llm_json(evaluation_prompt)

    # Step 3: Branch actions based on evaluation results
    relevant_count = sum(1 for e in evaluations if e["judgment"] == "relevant")

    if relevant_count >= 3:
        # Sufficient relevant results → generate answer directly
        context = [results[e["index"]] for e in evaluations if e["judgment"] == "relevant"]
        return await generate_answer(query, context)

    elif relevant_count >= 1:
        # Partially relevant → supplement with additional search
        additional = await web_search(query, top_k=3)  # Supplement with web search
        combined = [results[e["index"]] for e in evaluations if e["judgment"] != "irrelevant"]
        combined.extend(additional)
        return await generate_answer(query, combined)

    else:
        # No relevant results → fall back to web search
        web_results = await web_search(query, top_k=5)
        return await generate_answer(query, web_results)
```

### 6.5 Self-RAG (Self-Reflective RAG)

```python
async def self_rag(query: str) -> str:
    """Control generation quality with self-reflection tokens"""

    # Step 1: Determine if retrieval is needed
    need_retrieval = await judge_retrieval_need(query)

    if not need_retrieval:
        # No retrieval needed → answer directly
        return await direct_answer(query)

    # Step 2: Execute retrieval
    results = vector_search(query, top_k=5)

    # Step 3: Generate answer candidates individually for each chunk
    candidates = []
    for result in results:
        # Generate answer
        answer = await generate_with_single_context(query, result)

        # Faithfulness check: Is the answer faithful to the context?
        is_faithful = await check_faithfulness(answer, result)

        # Usefulness check: Is the answer useful for the query?
        is_useful = await check_usefulness(answer, query)

        candidates.append({
            "answer": answer,
            "context": result,
            "is_faithful": is_faithful,
            "is_useful": is_useful,
            "score": (2 if is_faithful else 0) + (1 if is_useful else 0),
        })

    # Step 4: Select the highest-scoring answer
    best = max(candidates, key=lambda c: c["score"])

    if best["score"] == 0:
        return "We apologize, but we were unable to generate a reliable answer."

    return best["answer"]
```

### 6.6 Technique Comparison Table

| Technique | Accuracy Gain | Complexity | Latency | Use Case |
|-----------|--------------|------------|---------|----------|
| Naive RAG | Baseline | Low | Low | MVP / Prototype |
| Hybrid Search | +10–15% | Medium | Medium | General purpose |
| Reranking | +10–25% | Medium | High | Accuracy-focused |
| Multi-Query | +5–15% | Medium | High | Ambiguous queries |
| Parent-Child Chunk | +5–10% | High | Medium | Long documents |
| HyDE | +5–15% | Medium | High | Specialized domains |
| Step-Back | +5–10% | Medium | High | Abstract questions |
| CRAG | +10–20% | High | High | Reliability-focused |
| Self-RAG | +15–25% | Highest | Highest | High-accuracy requirements |
| Agentic RAG | +20–30% | High | Highest | Complex questions |

---

## 7. Agentic RAG

### 7.1 Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Agentic RAG                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  User Query                                                    │
│       │                                                       │
│       ▼                                                       │
│  ┌──────────────────┐                                         │
│  │  Router Agent     │ ← Determines query type                │
│  │  (Query Analysis) │                                         │
│  └──────┬───────────┘                                         │
│         │                                                     │
│    ┌────┼────────────────┐                                    │
│    ▼    ▼                ▼                                    │
│  [Search] [Compute]  [Web Search]                              │
│  Vector DB  Code Exec  External API                            │
│    │    │                │                                    │
│    └────┼────────────────┘                                    │
│         ▼                                                     │
│  ┌──────────────────┐                                         │
│  │  Synthesizer      │ ← Integrates results and generates answer│
│  │  (Answer Gen)     │                                         │
│  └──────┬───────────┘                                         │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────────┐                                         │
│  │  Self-Check       │ ← Self-evaluates answer quality        │
│  │  (Quality Check)  │                                        │
│  └──────┬───────────┘                                         │
│         │                                                     │
│    Sufficient? ── No ──▶ Additional retrieval/correction (loop)│
│         │                                                     │
│        Yes                                                    │
│         ▼                                                     │
│     Final Answer                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 7.2 Implementation with LangGraph

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    query: str
    search_results: list
    web_results: list
    answer: str
    quality_score: float
    iteration: int
    messages: Annotated[list, operator.add]


def route_query(state: AgentState) -> str:
    """Route based on query type"""
    query = state["query"]

    # Routing decision with LLM
    response = llm.invoke(f"""
Classify the following query:
- "vector_search": requires searching internal documents
- "web_search": requires latest web information
- "direct": can answer directly without search
- "multi_step": requires multiple search steps

Query: {query}
Classification:
""")

    return response.strip()


def vector_search_node(state: AgentState) -> AgentState:
    """Vector search node"""
    results = vector_search(state["query"], top_k=10)
    reranked = rerank(state["query"], results, top_n=5)
    return {"search_results": reranked}


def web_search_node(state: AgentState) -> AgentState:
    """Web search node"""
    results = web_search(state["query"], top_k=5)
    return {"web_results": results}


def generate_answer_node(state: AgentState) -> AgentState:
    """Answer generation node"""
    context = state.get("search_results", []) + state.get("web_results", [])
    answer = generate_answer(state["query"], context)
    return {"answer": answer, "iteration": state.get("iteration", 0) + 1}


def quality_check_node(state: AgentState) -> AgentState:
    """Quality check node"""
    score = evaluate_answer_quality(state["query"], state["answer"])
    return {"quality_score": score}


def should_retry(state: AgentState) -> str:
    """Retry decision"""
    if state["quality_score"] >= 0.8:
        return "end"
    if state["iteration"] >= 3:
        return "end"  # Stop retrying after 3 attempts
    return "retry"


# Build graph
graph = StateGraph(AgentState)

graph.add_node("route", route_query)
graph.add_node("vector_search", vector_search_node)
graph.add_node("web_search", web_search_node)
graph.add_node("generate", generate_answer_node)
graph.add_node("quality_check", quality_check_node)

graph.set_entry_point("route")

graph.add_conditional_edges("route", route_query, {
    "vector_search": "vector_search",
    "web_search": "web_search",
    "direct": "generate",
    "multi_step": "vector_search",
})

graph.add_edge("vector_search", "generate")
graph.add_edge("web_search", "generate")
graph.add_edge("generate", "quality_check")

graph.add_conditional_edges("quality_check", should_retry, {
    "end": END,
    "retry": "vector_search",
})

app = graph.compile()

# Execute
result = app.invoke({"query": "Compare our company's 2024 sales trends with industry trends"})
```

### 7.3 Multi-Document RAG

```python
from dataclasses import dataclass

@dataclass
class DocumentSource:
    name: str
    collection: str
    priority: int
    filters: dict | None = None

class MultiSourceRAG:
    """Search across multiple document sources"""

    def __init__(self, sources: list[DocumentSource]):
        self.sources = sorted(sources, key=lambda s: s.priority)

    async def search(self, query: str, top_k: int = 10) -> list:
        """Parallel search across all sources"""
        import asyncio

        tasks = [
            self._search_source(query, source, top_k)
            for source in self.sources
        ]
        all_results = await asyncio.gather(*tasks)

        # Flatten all results and rerank
        flat_results = [r for results in all_results for r in results]
        reranked = rerank(query, flat_results, top_n=top_k)

        return reranked

    async def _search_source(self, query: str, source: DocumentSource, top_k: int):
        """Search individual source"""
        query_vector = embed(query)
        results = qdrant.search(
            collection_name=source.collection,
            query_vector=query_vector,
            query_filter=build_filter(source.filters) if source.filters else None,
            limit=top_k,
        )
        # Attach source information
        for r in results:
            r.payload["source_name"] = source.name
            r.payload["source_priority"] = source.priority
        return results


# Usage example
rag = MultiSourceRAG([
    DocumentSource("Internal Wiki", "wiki_docs", priority=1),
    DocumentSource("Tech Blog", "blog_posts", priority=2),
    DocumentSource("Product Manuals", "manuals", priority=1, filters={"status": "active"}),
    DocumentSource("FAQ", "faq_docs", priority=3),
])

results = await rag.search("How do I deploy the application?")
```

---

## 8. Production Design Patterns

### 8.1 Caching Strategy

```python
import hashlib
import json
from datetime import datetime, timedelta
from redis import Redis

class RAGCache:
    """Semantic cache for RAG queries"""

    def __init__(self, redis_client: Redis, ttl_hours: int = 24):
        self.redis = redis_client
        self.ttl = timedelta(hours=ttl_hours)

    def _query_hash(self, query: str) -> str:
        """Normalized hash of the query"""
        normalized = query.strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()

    def get(self, query: str) -> dict | None:
        """Exact match cache"""
        key = f"rag:exact:{self._query_hash(query)}"
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None

    def set(self, query: str, result: dict):
        """Cache the result"""
        key = f"rag:exact:{self._query_hash(query)}"
        self.redis.setex(key, self.ttl, json.dumps(result, ensure_ascii=False))

    async def get_semantic(self, query: str, threshold: float = 0.95) -> dict | None:
        """Semantic cache (hits on similar queries)"""
        query_vector = embed(query)

        # Search cache vector DB for similar queries
        results = qdrant.search(
            collection_name="query_cache",
            query_vector=query_vector,
            limit=1,
            score_threshold=threshold,  # 95%+ similarity
        )

        if results:
            cached_key = f"rag:semantic:{results[0].id}"
            cached = self.redis.get(cached_key)
            if cached:
                return json.loads(cached)

        return None

    async def set_semantic(self, query: str, result: dict):
        """Also save to semantic cache"""
        query_vector = embed(query)
        point_id = self._query_hash(query)

        qdrant.upsert(
            collection_name="query_cache",
            points=[PointStruct(
                id=point_id,
                vector=query_vector,
                payload={"query": query, "cached_at": datetime.now().isoformat()},
            )],
        )

        key = f"rag:semantic:{point_id}"
        self.redis.setex(key, self.ttl, json.dumps(result, ensure_ascii=False))
```

### 8.2 Index Update Pipeline

```python
from datetime import datetime
from enum import Enum

class UpdateStrategy(Enum):
    FULL_REBUILD = "full_rebuild"
    INCREMENTAL = "incremental"
    UPSERT = "upsert"

class IndexManager:
    """Lifecycle management for RAG indexes"""

    def __init__(self, qdrant_client, embedding_client):
        self.qdrant = qdrant_client
        self.embedder = embedding_client
        self.collection = "production_docs"

    async def incremental_update(
        self,
        new_documents: list[dict],
        updated_documents: list[dict],
        deleted_ids: list[str],
    ):
        """Incremental update (most efficient)"""

        # 1. Delete
        if deleted_ids:
            self.qdrant.delete(
                collection_name=self.collection,
                points_selector=deleted_ids,
            )

        # 2. Update (overwrite existing points)
        if updated_documents:
            await self._upsert_documents(updated_documents)

        # 3. Add new documents
        if new_documents:
            await self._upsert_documents(new_documents)

        # 4. Invalidate cache
        await self._invalidate_cache()

    async def _upsert_documents(self, documents: list[dict]):
        """Chunk documents and upsert"""
        for doc in documents:
            chunks = chunk_document(doc)
            embeddings = await batch_embed([c["text"] for c in chunks])

            points = [
                PointStruct(
                    id=f"{doc['id']}_{i}",
                    vector=emb,
                    payload={
                        "text": chunk["text"],
                        "source": doc["source"],
                        "document_id": doc["id"],
                        "updated_at": datetime.now().isoformat(),
                        **chunk.get("metadata", {}),
                    },
                )
                for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
            ]

            self.qdrant.upsert(collection_name=self.collection, points=points)

    async def full_rebuild(self, documents: list[dict]):
        """Full rebuild (not recommended but reliable)"""
        # Create a new collection
        temp_collection = f"{self.collection}_temp_{int(datetime.now().timestamp())}"

        self.qdrant.create_collection(
            collection_name=temp_collection,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        )

        # Index all documents
        for doc in documents:
            chunks = chunk_document(doc)
            embeddings = await batch_embed([c["text"] for c in chunks])
            # ... upsert ...

        # Atomically switch (zero downtime)
        self.qdrant.update_collection_aliases(
            change_aliases_operations=[
                {"create_alias": {"collection_name": temp_collection, "alias_name": self.collection}},
            ]
        )
```

### 8.3 Monitoring and Observability

```python
import time
from dataclasses import dataclass, field
from typing import Any

@dataclass
class RAGMetrics:
    """Metrics for the RAG pipeline"""
    query: str
    total_latency_ms: float = 0
    embedding_latency_ms: float = 0
    search_latency_ms: float = 0
    rerank_latency_ms: float = 0
    generation_latency_ms: float = 0
    num_results_retrieved: int = 0
    num_results_after_rerank: int = 0
    top_score: float = 0
    avg_score: float = 0
    tokens_used: int = 0
    cache_hit: bool = False
    error: str | None = None
    metadata: dict = field(default_factory=dict)

class RAGMonitor:
    """Monitoring for the RAG pipeline"""

    def __init__(self, metrics_backend):
        self.backend = metrics_backend

    def track_query(self, metrics: RAGMetrics):
        """Record metrics"""
        self.backend.histogram("rag.latency.total", metrics.total_latency_ms)
        self.backend.histogram("rag.latency.embedding", metrics.embedding_latency_ms)
        self.backend.histogram("rag.latency.search", metrics.search_latency_ms)
        self.backend.histogram("rag.latency.rerank", metrics.rerank_latency_ms)
        self.backend.histogram("rag.latency.generation", metrics.generation_latency_ms)

        self.backend.histogram("rag.results.count", metrics.num_results_retrieved)
        self.backend.histogram("rag.results.top_score", metrics.top_score)

        self.backend.counter("rag.queries.total", 1)
        if metrics.cache_hit:
            self.backend.counter("rag.cache.hits", 1)
        if metrics.error:
            self.backend.counter("rag.errors.total", 1, tags={"error": metrics.error})

    def alert_low_relevance(self, metrics: RAGMetrics, threshold: float = 0.5):
        """Alert on low relevance scores"""
        if metrics.top_score < threshold:
            self.backend.alert(
                "rag.low_relevance",
                f"Query '{metrics.query[:50]}...' had low relevance score: {metrics.top_score}",
            )


class InstrumentedRAG:
    """RAG pipeline with instrumentation"""

    def __init__(self, rag_pipeline, monitor: RAGMonitor):
        self.rag = rag_pipeline
        self.monitor = monitor

    async def query(self, query: str, **kwargs) -> dict:
        metrics = RAGMetrics(query=query)
        start = time.time()

        try:
            # Embedding
            t0 = time.time()
            query_vector = await self.rag.embed(query)
            metrics.embedding_latency_ms = (time.time() - t0) * 1000

            # Search
            t0 = time.time()
            results = await self.rag.search(query_vector, **kwargs)
            metrics.search_latency_ms = (time.time() - t0) * 1000
            metrics.num_results_retrieved = len(results)

            if results:
                metrics.top_score = results[0].score
                metrics.avg_score = sum(r.score for r in results) / len(results)

            # Rerank
            t0 = time.time()
            reranked = await self.rag.rerank(query, results)
            metrics.rerank_latency_ms = (time.time() - t0) * 1000
            metrics.num_results_after_rerank = len(reranked)

            # Generate
            t0 = time.time()
            answer = await self.rag.generate(query, reranked)
            metrics.generation_latency_ms = (time.time() - t0) * 1000
            metrics.tokens_used = answer.get("usage", {}).get("total_tokens", 0)

            metrics.total_latency_ms = (time.time() - start) * 1000

            return {"answer": answer["text"], "sources": reranked, "metrics": metrics}

        except Exception as e:
            metrics.error = str(e)
            metrics.total_latency_ms = (time.time() - start) * 1000
            raise
        finally:
            self.monitor.track_query(metrics)
```

---

## 9. RAG Evaluation

### 9.1 RAGAS Framework

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
    answer_correctness,
)
from datasets import Dataset

# Prepare evaluation dataset
eval_data = {
    "question": [
        "How do I apply for paid leave?",
        "What are the remote work policies?",
    ],
    "answer": [
        "Paid leave can be applied for through the HR system. Manager approval is required.",
        "Remote work is allowed up to 3 days per week. Prior application is required.",
    ],
    "contexts": [
        ["Paid leave applications are submitted via the 'Leave Request' menu in the HR system. After applying, approval from your direct manager is required."],
        ["Remote work policy: Up to 3 days of remote work per week. Submit a request in the system by the previous day."],
    ],
    "ground_truth": [
        "Paid leave is applied for through the 'Leave Request' menu in the HR system and requires approval from your direct manager.",
        "Remote work is allowed up to 3 days per week and requires a prior system application by the previous day.",
    ],
}

dataset = Dataset.from_dict(eval_data)

# Run evaluation
results = evaluate(
    dataset=dataset,
    metrics=[
        faithfulness,         # Is the answer faithful to the context? (0-1)
        answer_relevancy,     # Is the answer relevant to the query? (0-1)
        context_precision,    # Precision of retrieved results (0-1)
        context_recall,       # Coverage of retrieved results (0-1)
        answer_correctness,   # Correctness of the answer (0-1)
    ],
)

print(results)
# {'faithfulness': 0.92, 'answer_relevancy': 0.88,
#  'context_precision': 0.85, 'context_recall': 0.90,
#  'answer_correctness': 0.87}
```

### 9.2 Evaluating Retrieval Accuracy

```python
from typing import Any

def evaluate_retrieval(
    queries: list[str],
    ground_truth_docs: list[list[str]],  # Correct document IDs for each query
    retrieval_fn,
    k_values: list[int] = [1, 3, 5, 10],
) -> dict[str, float]:
    """Evaluate retrieval accuracy"""

    metrics = {f"recall@{k}": 0.0 for k in k_values}
    metrics.update({f"precision@{k}": 0.0 for k in k_values})
    metrics["mrr"] = 0.0  # Mean Reciprocal Rank
    metrics["ndcg@10"] = 0.0  # Normalized Discounted Cumulative Gain

    for query, truth in zip(queries, ground_truth_docs):
        results = retrieval_fn(query, top_k=max(k_values))
        retrieved_ids = [r.id for r in results]

        # Recall@k, Precision@k
        for k in k_values:
            top_k_ids = set(retrieved_ids[:k])
            truth_set = set(truth)

            recall = len(top_k_ids & truth_set) / len(truth_set) if truth_set else 0
            precision = len(top_k_ids & truth_set) / k

            metrics[f"recall@{k}"] += recall / len(queries)
            metrics[f"precision@{k}"] += precision / len(queries)

        # MRR
        for rank, doc_id in enumerate(retrieved_ids, 1):
            if doc_id in truth:
                metrics["mrr"] += 1.0 / rank / len(queries)
                break

    return metrics


# Usage example
results = evaluate_retrieval(
    queries=["How to apply for paid leave", "Remote work policy"],
    ground_truth_docs=[["doc_001", "doc_002"], ["doc_015"]],
    retrieval_fn=lambda q, top_k: vector_search(q, top_k=top_k),
)
print(results)
# {'recall@1': 0.75, 'recall@5': 0.95, 'precision@5': 0.40, 'mrr': 0.83, ...}
```

### 9.3 Automated E2E Answer Quality Evaluation

```python
async def auto_evaluate_answer(
    query: str,
    answer: str,
    context: list[str],
    ground_truth: str | None = None,
    evaluator_llm: str = "gpt-4o",
) -> dict[str, Any]:
    """Automated answer quality evaluation using LLM-as-Judge"""

    evaluation_prompt = f"""Evaluate the following answer to the question.

Question: {query}

Answer: {answer}

Provided context:
{chr(10).join(context)}

{"Ground truth: " + ground_truth if ground_truth else ""}

Rate each of the following dimensions on a scale of 1-5:
1. faithfulness: Is the answer faithful to the context? Are there any hallucinations?
2. relevance: Does the answer appropriately address the question?
3. completeness: Does it cover all necessary information?
4. conciseness: Is it concise and to the point without being verbose?
5. citation_quality: Are sources properly cited?

Return in JSON format:
{{"faithfulness": 4, "relevance": 5, "completeness": 3, "conciseness": 4, "citation_quality": 3, "overall": 3.8, "feedback": "areas for improvement..."}}
"""

    response = await call_llm(evaluation_prompt, model=evaluator_llm)
    return json.loads(response)
```

---

## 10. Document Preprocessing Pipeline

### 10.1 Multi-Format Support

```python
from pathlib import Path
from abc import ABC, abstractmethod

class DocumentParser(ABC):
    @abstractmethod
    def parse(self, file_path: str) -> list[dict]:
        pass

class PDFParser(DocumentParser):
    def parse(self, file_path: str) -> list[dict]:
        import pymupdf  # PyMuPDF

        doc = pymupdf.open(file_path)
        pages = []
        for page_num, page in enumerate(doc):
            text = page.get_text()
            # Extract tables
            tables = page.find_tables()
            table_texts = [t.to_pandas().to_markdown() for t in tables]

            pages.append({
                "text": text,
                "tables": table_texts,
                "page_number": page_num + 1,
                "source": file_path,
            })
        return pages

class HTMLParser(DocumentParser):
    def parse(self, file_path: str) -> list[dict]:
        from bs4 import BeautifulSoup

        with open(file_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        # Remove unnecessary elements
        for tag in soup.find_all(["script", "style", "nav", "footer"]):
            tag.decompose()

        return [{
            "text": soup.get_text(separator="\n", strip=True),
            "title": soup.title.string if soup.title else "",
            "source": file_path,
        }]

class MarkdownParser(DocumentParser):
    def parse(self, file_path: str) -> list[dict]:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return [{
            "text": content,
            "source": file_path,
        }]

class DocxParser(DocumentParser):
    def parse(self, file_path: str) -> list[dict]:
        from docx import Document

        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

        # Also extract tables
        tables = []
        for table in doc.tables:
            rows = []
            for row in table.rows:
                cells = [cell.text for cell in row.cells]
                rows.append(cells)
            tables.append(rows)

        return [{
            "text": "\n".join(paragraphs),
            "tables": tables,
            "source": file_path,
        }]


class UniversalDocumentPipeline:
    """Pipeline for processing documents of any format"""

    PARSERS: dict[str, type[DocumentParser]] = {
        ".pdf": PDFParser,
        ".html": HTMLParser,
        ".htm": HTMLParser,
        ".md": MarkdownParser,
        ".docx": DocxParser,
    }

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def process(self, file_path: str) -> list[dict]:
        ext = Path(file_path).suffix.lower()
        parser_cls = self.PARSERS.get(ext)
        if not parser_cls:
            raise ValueError(f"Unsupported format: {ext}")

        # 1. Parse
        documents = parser_cls().parse(file_path)

        # 2. Chunk
        all_chunks = []
        for doc in documents:
            chunks = self.splitter.split_text(doc["text"])
            for i, chunk_text in enumerate(chunks):
                all_chunks.append({
                    "text": chunk_text,
                    "metadata": {
                        "source": doc["source"],
                        "chunk_index": i,
                        "page_number": doc.get("page_number"),
                    },
                })

        return all_chunks
```

---

## 11. Anti-Patterns and Best Practices

### Anti-Pattern 1: Inappropriate Chunk Size Settings

```python
# BAD: Chunks are too large
splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=0)
# → Reduced retrieval accuracy (large amounts of irrelevant information mixed in)
# → Wastes context window

# BAD: Chunks are too small
splitter = RecursiveCharacterTextSplitter(chunk_size=50, chunk_overlap=0)
# → Context is lost
# → Too fragmented for LLM to understand

# GOOD: Appropriate size + overlap
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,  # About 12% overlap
)
```

### Anti-Pattern 2: Using Retrieval Results Without Validation

```python
# BAD: Feed all retrieval results directly
results = vector_search(query, top_k=20)
context = "\n".join([r.text for r in results])
# → Irrelevant results become noise, degrading answer quality

# GOOD: Relevance score threshold check + rerank
results = vector_search(query, top_k=20)
relevant = [r for r in results if r.score > 0.7]  # Threshold filter
reranked = rerank(query, relevant, top_n=5)  # Rerank

if not reranked:
    return "No relevant information was found."
```

### Anti-Pattern 3: Mismatched Embedding Models

```python
# BAD: Using different Embedding models at index time and query time
# At index time
doc_embedding = embed_with_model_a(document)  # Model A
# At query time
query_embedding = embed_with_model_b(query)    # Model B (mismatch!)
# → Different vector spaces yield no meaningful search results

# GOOD: Always use the same model with a fixed version
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_VERSION = "2024-01-01"

# Centrally managed in config
config = {
    "embedding_model": EMBEDDING_MODEL,
    "embedding_dimensions": 1536,
}
```

### Anti-Pattern 4: Inadequate Prompts

```python
# BAD: Unclear instructions for using context
prompt = f"Question: {query}\nReference: {context}\nAnswer:"
# → LLM answers from its own knowledge, causing hallucinations

# GOOD: Clear instructions and guardrails
prompt = f"""You are an assistant that answers based on internal documents.

Important rules:
1. Answer only based on the "provided context"
2. Do not speculate on information not contained in the context
3. If information is insufficient, explicitly state "This information is not contained in the context"
4. Always include citations [Source: filename] in your answer
5. If there is conflicting information, present both pieces of information

Context:
{context}

Question: {query}

Answer:"""
```

### Anti-Pattern 5: Ignoring Scalability

```python
# BAD: Load all documents into memory
all_docs = load_all_documents()  # Documents of several GB
embeddings = embed_all(all_docs)  # Risk of OOM

# GOOD: Batch processing + streaming
async def index_documents_streaming(doc_paths: list[str], batch_size: int = 50):
    """Memory-efficient batch indexing"""
    for i in range(0, len(doc_paths), batch_size):
        batch_paths = doc_paths[i:i + batch_size]

        # Process per batch
        chunks = []
        for path in batch_paths:
            doc_chunks = parse_and_chunk(path)
            chunks.extend(doc_chunks)

        # Batch Embedding
        embeddings = await batch_embed([c["text"] for c in chunks])

        # Batch upsert
        points = [
            PointStruct(id=f"doc_{i}_{j}", vector=emb, payload=chunk)
            for j, (chunk, emb) in enumerate(zip(chunks, embeddings))
        ]
        qdrant.upsert(collection_name="docs", points=points)

        # Free memory
        del chunks, embeddings, points
```

---

## 12. Practical Use Cases

### 12.1 Internal Help Desk RAG

```python
class HelpDeskRAG:
    """RAG system for internal help desk"""

    def __init__(self):
        self.collections = {
            "hr": "HR-related documents",
            "it": "IT support documents",
            "legal": "Legal and compliance documents",
            "general": "General business documents",
        }

    async def answer(self, query: str, user_department: str) -> dict:
        """Answer with department context taken into account"""

        # 1. Automatically classify the query
        category = await self._classify_query(query)

        # 2. Search from the relevant collection (with department filter)
        results = await filtered_search(
            query=query,
            collection=category,
            filters={"accessible_departments": user_department},
            top_k=5,
        )

        # 3. Escalation decision
        if not results or all(r.score < 0.5 for r in results):
            return {
                "answer": "Please contact the responsible department regarding this question.",
                "escalation": True,
                "suggested_department": category,
            }

        # 4. Generate answer
        answer = await self._generate_answer(query, results)

        return {
            "answer": answer,
            "sources": [r.payload["source"] for r in results],
            "confidence": results[0].score,
            "escalation": False,
        }
```

### 12.2 Codebase RAG

```python
class CodebaseRAG:
    """Question answering for codebases"""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def index_codebase(self):
        """Index the codebase"""
        from tree_sitter_languages import get_parser

        # Process per file
        for file_path in glob.glob(f"{self.repo_path}/**/*.py", recursive=True):
            with open(file_path) as f:
                code = f.read()

            # AST-based splitting (at function/class boundaries)
            parser = get_parser("python")
            tree = parser.parse(code.encode())

            functions = self._extract_functions(tree, code)
            classes = self._extract_classes(tree, code)

            for item in functions + classes:
                # Generate code summary with LLM
                summary = self._summarize_code(item["code"])

                # Embedding is a hybrid of code + summary
                chunk = {
                    "text": f"{summary}\n\n```python\n{item['code']}\n```",
                    "metadata": {
                        "file_path": file_path,
                        "type": item["type"],  # function / class
                        "name": item["name"],
                        "line_start": item["line_start"],
                        "line_end": item["line_end"],
                    },
                }
                self._index_chunk(chunk)

    async def query(self, question: str) -> dict:
        """Answer questions about the codebase"""
        results = vector_search(question, top_k=5)

        answer = await generate_answer(
            question,
            results,
            system_prompt="""You are a senior engineer well-versed in the codebase.
Answer questions based on the provided code snippets.
Include file paths and line numbers in your answer.""",
        )

        return answer
```

### 12.3 Legal and Compliance RAG

```python
class LegalRAG:
    """RAG for legal documents (accuracy is paramount)"""

    async def answer(self, query: str) -> dict:
        """Answer legal queries (with multiple validation steps)"""

        # 1. Collect candidates with multiple search strategies
        vector_results = await vector_search(query, top_k=10)
        keyword_results = await keyword_search(query, top_k=10)
        hybrid_results = rrf_merge(vector_results, keyword_results)

        # 2. Legal-specific reranking
        reranked = await self._legal_rerank(query, hybrid_results)

        # 3. Generate answer (with conservative prompt)
        answer = await generate_answer(
            query, reranked,
            system_prompt="""You are a legal advisor.

Important rules:
1. Answer only based on the provided documents
2. Always add a disclaimer when the answer involves legal judgment
3. If ambiguous, add "We recommend consulting the legal department"
4. Accurately cite article numbers and regulation names
5. If multiple interpretations are possible, present all interpretations""",
        )

        # 4. Fact check (verify consistency between answer and context)
        fact_check = await self._verify_facts(answer, reranked)

        # 5. Confidence score
        confidence = self._calculate_confidence(reranked, fact_check)

        return {
            "answer": answer,
            "confidence": confidence,
            "sources": [r.payload for r in reranked],
            "fact_check": fact_check,
            "disclaimer": "This answer is for reference only and does not constitute legal advice. For official decisions, please consult the legal department.",
        }
```

---

## 13. FAQ

### Q1: How do I choose between RAG and fine-tuning?

RAG is suited for injecting external knowledge; fine-tuning is suited for changing model behavior patterns (writing style, format, decision criteria).
Frequently updated information → RAG; stable specialized knowledge → fine-tuning.
In practice, combining RAG + fine-tuning is most effective.

### Q2: How often should vector DB indexes be updated?

It depends on how often documents are updated. If real-time accuracy is needed, implement incremental index updates.
For batch updates, daily to weekly is typical.
If old and new information coexist, attach timestamps as metadata and weight results during search.

### Q3: What evaluation metrics should I use for RAG?

Key metrics: (1) Faithfulness — is the answer faithful to the context, (2) Relevancy — are the retrieved results relevant to the question, (3) Answer Correctness — accuracy of the final answer.
Automated evaluation is possible with the RAGAS framework or DeepEval.
Evaluating chunk precision is also important: measure whether the correct chunk is included in top-k.

### Q4: What should I pay special attention to for multilingual RAG?

Tokens are 2-3x less efficient for non-Latin scripts compared to English (same text consumes more tokens).
Chunk size should be managed by token count, not character count.
Choose Embedding models with strong multilingual support (Cohere, BGE-M3).
Combining with morpheme-analysis-based keyword search (hybrid) is effective.

### Q5: How can I improve RAG latency?

Key improvement points: (1) Introduce semantic caching (reuse results for similar queries), (2) Async batch processing for Embeddings, (3) Streaming generation (improves perceived latency), (4) Vector DB index optimization (tune HNSW parameters), (5) Reranker selection (trade-off with lightweight models). Typical target: under 2 seconds E2E.

### Q6: How do I handle context loss between chunks?

(1) Use Parent-Child chunking: search with small chunks, pass large chunks to the LLM. (2) Attach section hierarchy information to chunks as metadata. (3) Automatically prepend a context prefix to each chunk: "This document discusses X." (4) Use a Sliding Window to ensure appropriate overlap.

### Q7: How do I implement multimodal RAG (including images and diagrams)?

(1) Convert images to text descriptions using VLMs (GPT-4o, Claude) before indexing. (2) Convert diagrams to structured text using OCR + table extraction. (3) Using multimodal Embeddings like CLIP allows direct vectorization of images. (4) For figures in PDFs, crop them as page images, generate descriptions with a VLM, and include them in chunks.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend firmly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development tasks. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|---------------|
| Chunking | RecursiveCharacterTextSplitter (512 tokens, 12% overlap) |
| Embedding | text-embedding-3-large / Cohere v3 / BGE-M3 |
| Vector DB | Qdrant / pgvector (self-hosted) / Pinecone (managed) |
| Search Method | Hybrid search (vector + BM25) |
| Reranking | Cohere Rerank v3 / Cross-Encoder |
| Query Transformation | Multi-Query / HyDE / Step-Back |
| Evaluation | RAGAS framework / LLM-as-Judge |
| Caching | Semantic cache (Redis + vector DB) |
| Monitoring | Latency, relevance score, cache hit rate |
| Advanced Techniques | Agentic RAG (LangGraph) / Self-RAG / CRAG |

---

## Further Reading

- [02-function-calling.md](./02-function-calling.md) — Combining RAG with Function Calling
- [03-embeddings.md](./03-embeddings.md) — Deep dive into Embedding techniques
- [../03-infrastructure/01-vector-databases.md](../03-infrastructure/01-vector-databases.md) — Selecting and operating vector DBs

---

## References

1. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," NeurIPS 2020
2. Gao et al., "Retrieval-Augmented Generation for Large Language Models: A Survey," arXiv:2312.10997, 2023
3. LangChain, "RAG Documentation," https://python.langchain.com/docs/tutorials/rag/
4. RAGAS, "Evaluation framework for RAG," https://docs.ragas.io/
5. Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection," ICLR 2024
6. Yan et al., "Corrective Retrieval Augmented Generation," arXiv:2401.15884, 2024
7. Zheng et al., "Step-Back Prompting Enables Reasoning via Abstraction," ICLR 2024
8. Gao et al., "Precise Zero-Shot Dense Retrieval without Relevance Labels (HyDE)," ACL 2023
