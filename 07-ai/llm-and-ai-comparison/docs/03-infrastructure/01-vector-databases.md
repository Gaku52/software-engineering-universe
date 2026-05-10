# Vector DB — Pinecone, Weaviate, pgvector, Qdrant

> A vector database is a data store specialized for storing high-dimensional vectors and performing Approximate Nearest Neighbor (ANN) search, and serves as the foundational infrastructure for embedding-based applications such as RAG, semantic search, and recommendations.

## What You Will Learn in This Chapter

1. **Fundamentals of Vector DBs** — ANN algorithms (HNSW, IVF), index structures, distance functions
2. **Comparison and Selection of Major Vector DBs** — Characteristics and use cases for Pinecone, Weaviate, Qdrant, and pgvector
3. **Production Operations** — Scaling, backup, monitoring, and cost optimization


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [API Integration — SDK, Streaming, Retry Strategies](./00-api-integration.md)

---

## 1. Fundamentals of Vector Search

```
┌──────────────────────────────────────────────────────────┐
│         ANN (Approximate Nearest Neighbor) Search         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Problem: Find the k vectors closest to a query          │
│           from N vectors                                  │
│  Brute-force: O(N×d) → Too slow for 1M items × 1024 dim │
│                                                          │
│  Solution: ANN (Approximate Nearest Neighbor)             │
│                                                          │
│  1. HNSW (Hierarchical Navigable Small World)            │
│     ┌─ Layer 2: ○───○           (coarse search)          │
│     ├─ Layer 1: ○─○─○─○─○       (intermediate)           │
│     └─ Layer 0: ○○○○○○○○○○○○○○ (all nodes)              │
│     → Traverse graph top-down to find neighbors          │
│     → Search: O(log N), Memory: O(N×M)                   │
│                                                          │
│  2. IVF (Inverted File Index)                            │
│     → Partition vectors into clusters                    │
│     → Search only clusters close to the query            │
│     → Search: O(N/K×d), fast to build                   │
│                                                          │
│  3. Product Quantization (PQ)                            │
│     → Split vectors into subspaces and quantize          │
│     → Dramatically reduces memory usage                  │
│     → Slight decrease in accuracy                        │
│                                                          │
│  Performance estimates (1M vectors, 1024 dim):           │
│  ├── Brute-force: ~500ms                                 │
│  ├── IVF:         ~10ms                                  │
│  └── HNSW:        ~1ms                                   │
└──────────────────────────────────────────────────────────┘
```

### 1.1 HNSW Algorithm in Detail

```
┌──────────────────────────────────────────────────────────┐
│         HNSW (Hierarchical Navigable Small World)         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Core idea: Skip List + Small World Graph                │
│                                                          │
│  Build phase:                                            │
│  1. Assign a random layer to each node                   │
│     (probabilistically fewer nodes in higher layers)     │
│  2. Connect each node to M nearest neighbors per layer   │
│  3. Upper layers act as "highways"                       │
│                                                          │
│  Search phase:                                           │
│  1. Start from entry point in the topmost layer          │
│  2. Move toward nearest neighbor in current layer        │
│     (Greedy Search)                                      │
│  3. Drop to the next layer when no closer node exists    │
│  4. Return candidate set from the bottom layer (Layer 0) │
│                                                          │
│  Parameter effects:                                      │
│  ┌────────────────┬──────────┬──────────┬──────────┐     │
│  │ Parameter      │ Accuracy │ Speed    │ Memory   │     │
│  ├────────────────┼──────────┼──────────┼──────────┤     │
│  │ M ↑ (edges)    │ ↑       │ ↓       │ ↑       │     │
│  │ ef_construct ↑ │ ↑       │ build ↓  │ -       │     │
│  │ ef_search ↑    │ ↑       │ ↓       │ -       │     │
│  └────────────────┴──────────┴──────────┴──────────┘     │
│                                                          │
│  Recommended settings:                                   │
│  ├── M = 16 (balanced) / 32-64 (high accuracy)           │
│  ├── ef_construction = 200-400                           │
│  └── ef_search = top_k × 2-4                            │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Choosing a Distance Function

```python
import numpy as np

# Main distance functions used in vector DBs

def cosine_distance(a, b):
    """Cosine distance: 0 (identical) to 2 (opposite)
    Most common for text embeddings"""
    return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def euclidean_distance(a, b):
    """Euclidean distance (L2): 0 to ∞
    Suitable for image features and clustering"""
    return np.linalg.norm(a - b)

def dot_product_distance(a, b):
    """Dot product: equivalent to cosine for normalized vectors
    Fastest to compute"""
    return -np.dot(a, b)  # Negated to serve as a distance

# Selection guide:
# - Text search → Cosine distance or dot product
# - Image search → Euclidean distance
# - Normalized vectors → Dot product (fastest)
```

---

## 2. Major Vector DBs

### 2.1 Pinecone (Managed Service)

```python
from pinecone import Pinecone, ServerlessSpec

# Initialize
pc = Pinecone(api_key="YOUR_API_KEY")

# Create index
pc.create_index(
    name="products",
    dimension=1024,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)

index = pc.Index("products")

# Insert vectors (Upsert)
index.upsert(
    vectors=[
        {
            "id": "prod-001",
            "values": [0.1, 0.2, ...],  # 1024 dimensions
            "metadata": {
                "name": "Wireless Earphones",
                "category": "electronics",
                "price": 15000,
            },
        },
    ],
    namespace="jp-products",
)

# Query (with metadata filter)
results = index.query(
    vector=[0.15, 0.22, ...],
    top_k=10,
    filter={
        "category": {"$eq": "electronics"},
        "price": {"$lte": 20000},
    },
    include_metadata=True,
    namespace="jp-products",
)

for match in results.matches:
    print(f"ID: {match.id}, Score: {match.score:.4f}")
    print(f"  {match.metadata}")
```

### 2.2 Qdrant

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue, Range,
)

# Connect
client = QdrantClient(url="http://localhost:6333")

# Create collection
client.create_collection(
    collection_name="products",
    vectors_config=VectorParams(
        size=1024,
        distance=Distance.COSINE,
    ),
)

# Insert vectors
client.upsert(
    collection_name="products",
    points=[
        PointStruct(
            id=1,
            vector=[0.1, 0.2, ...],
            payload={
                "name": "Wireless Earphones",
                "category": "electronics",
                "price": 15000,
            },
        ),
    ],
)

# Search with filter
results = client.search(
    collection_name="products",
    query_vector=[0.15, 0.22, ...],
    query_filter=Filter(
        must=[
            FieldCondition(key="category", match=MatchValue(value="electronics")),
            FieldCondition(key="price", range=Range(lte=20000)),
        ]
    ),
    limit=10,
)
```

### 2.3 Weaviate

```python
import weaviate
from weaviate.classes.config import Property, DataType, Configure

# Connect
client = weaviate.connect_to_local()

# Create collection (define schema)
collection = client.collections.create(
    name="Product",
    vectorizer_config=Configure.Vectorizer.none(),  # Use external embedding
    properties=[
        Property(name="name", data_type=DataType.TEXT),
        Property(name="category", data_type=DataType.TEXT),
        Property(name="price", data_type=DataType.INT),
    ],
)

# Insert data
collection.data.insert(
    properties={"name": "Wireless Earphones", "category": "electronics", "price": 15000},
    vector=[0.1, 0.2, ...],
)

# Hybrid search (vector + keyword)
results = collection.query.hybrid(
    query="high-quality earphones",
    vector=[0.15, 0.22, ...],
    alpha=0.5,  # 0=keyword only, 1=vector only
    limit=10,
)

client.close()
```

### 2.4 pgvector (PostgreSQL Extension)

```python
import psycopg2
from pgvector.psycopg2 import register_vector

# Connect
conn = psycopg2.connect("postgresql://localhost/mydb")
register_vector(conn)

cur = conn.cursor()

# Create extension and table
cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        price INTEGER,
        embedding vector(1024)
    )
""")

# Create HNSW index
cur.execute("""
    CREATE INDEX ON products
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200)
""")

# Insert data
cur.execute(
    "INSERT INTO products (name, category, price, embedding) VALUES (%s, %s, %s, %s)",
    ("Wireless Earphones", "electronics", 15000, [0.1, 0.2, ...]),
)

# Search (expressible in SQL)
cur.execute("""
    SELECT name, price, 1 - (embedding <=> %s::vector) AS similarity
    FROM products
    WHERE category = 'electronics' AND price <= 20000
    ORDER BY embedding <=> %s::vector
    LIMIT 10
""", ([0.15, 0.22, ...], [0.15, 0.22, ...]))

for row in cur.fetchall():
    print(f"{row[0]}: ¥{row[1]:,} (similarity: {row[2]:.4f})")

conn.commit()
```

### 2.5 Chroma (Lightweight, for Local Development)

```python
import chromadb
from chromadb.utils import embedding_functions

# Create client (in-memory or persistent)
client = chromadb.Client()  # In-memory
# client = chromadb.PersistentClient(path="./chroma_db")  # Disk-persistent

# Configure embedding function (built-in or external)
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key="YOUR_API_KEY",
    model_name="text-embedding-3-small",
)

# Create collection
collection = client.create_collection(
    name="documents",
    embedding_function=openai_ef,
    metadata={"hnsw:space": "cosine"},  # Specify distance function
)

# Add documents (embeddings are generated automatically)
collection.add(
    documents=[
        "Python is a general-purpose programming language",
        "Machine learning is a branch of AI",
        "Sushi is a Japanese dish",
    ],
    metadatas=[
        {"category": "programming"},
        {"category": "ai"},
        {"category": "food"},
    ],
    ids=["doc1", "doc2", "doc3"],
)

# Search (auto-embeds text query)
results = collection.query(
    query_texts=["AI programming"],
    n_results=2,
    where={"category": {"$ne": "food"}},
)
print(results)

# Advantages of Chroma:
# - Easiest setup (pip install chromadb)
# - Built-in embedding functions
# - Best for development and prototyping
# - Easy integration with LangChain/LlamaIndex
```

---

## 3. Vector DB Comparison

### 3.1 Feature Comparison

| Feature | Pinecone | Qdrant | Weaviate | pgvector | Chroma |
|---------|----------|--------|----------|---------|--------|
| Deployment | Managed only | OSS + Cloud | OSS + Cloud | PostgreSQL extension | OSS |
| ANN Algorithm | Proprietary | HNSW | HNSW | HNSW / IVFFlat | HNSW |
| Metadata Filter | High-performance | High-performance | High-performance | SQL (most powerful) | Basic |
| Hybrid Search | N/A | Sparse vector | Built-in BM25 | w/ pg_trgm | N/A |
| Multi-tenancy | Namespace | Collection/Payload | Multi-tenant | Schema/RLS | Collection |
| Max Vectors | Unlimited | Billions | Billions | Depends on PostgreSQL | ~Millions |
| Language | - | Rust | Go | C | Python |
| License | Commercial | Apache 2.0 | BSD-3 | PostgreSQL | Apache 2.0 |
| Use Case | Production | Production | Production | Production | Dev/Small-scale |

### 3.2 Recommended DB by Use Case

| Use Case | Recommended DB | Reason |
|----------|---------------|--------|
| Startup MVP | Pinecone | Fully managed, low learning cost |
| Existing PostgreSQL environment | pgvector | No additional infrastructure needed |
| High-performance search service | Qdrant | Rust implementation, low latency |
| Hybrid search focus | Weaviate | Built-in BM25 |
| Edge/embedded | Qdrant (in-memory) | Lightweight, few dependencies |
| Enterprise | Pinecone / Weaviate Cloud | SLA, support |
| Prototype/PoC | Chroma | Fastest setup |
| LangChain integration | Chroma / pgvector | Strong official support |

### 3.3 Cost Comparison

```
┌──────────────────────────────────────────────────────────┐
│    Vector DB Cost Comparison (1M vectors, 1024 dim)      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Pinecone Serverless:                                    │
│  ├── Storage: $0.33/GB/month ≈ $1.3/month                │
│  ├── Reads: $8.25/1M Read Units                          │
│  └── Total (low load): ~$30-50/month                     │
│                                                          │
│  Qdrant Cloud:                                           │
│  ├── 4GB RAM node: ~$50/month+                           │
│  └── Total: ~$50-100/month                               │
│                                                          │
│  Weaviate Cloud:                                         │
│  ├── Sandbox: Free (14 days)                             │
│  └── Production: ~$50-200/month                          │
│                                                          │
│  pgvector (self-hosted):                                 │
│  ├── RDS db.r6g.large: ~$200/month                       │
│  └── Can be shared with other workloads                  │
│                                                          │
│  Qdrant / Weaviate (self-deployed):                      │
│  ├── EC2 r6i.large: ~$100/month                          │
│  └── Operational cost: must be considered                │
│                                                          │
│  Chroma:                                                 │
│  └── Free (local execution)                              │
│                                                          │
│  Cost optimization tips:                                 │
│  1. Quantization (int8): 1/4 memory, 1/4 cost            │
│  2. Dimension reduction (1024→512): halves memory        │
│  3. Serverless (Pinecone): pay only for what you use     │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Performance Optimization

```
┌──────────────────────────────────────────────────────────┐
│          HNSW Parameter Tuning                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Build-time parameters:                                  │
│  ├── M (connections): larger → accuracy↑ memory↑ build↓  │
│  │   Recommended: 16 (default) to 64 (high accuracy)     │
│  └── ef_construction: larger → accuracy↑ build speed↓   │
│      Recommended: 128 to 256                             │
│                                                          │
│  Search-time parameters:                                 │
│  └── ef (search width): larger → accuracy↑ speed↓       │
│      Recommended: 2-4× top_k                             │
│                                                          │
│  Trade-offs:                                             │
│  ┌──────────┬──────────┬──────────┬──────────┐           │
│  │ Setting  │ Latency  │ Recall   │ Memory   │           │
│  ├──────────┼──────────┼──────────┼──────────┤           │
│  │ Low      │  0.5ms   │  90%     │  Low     │           │
│  │ Balanced │  1ms     │  95%     │  Medium  │           │
│  │ High     │  3ms     │  99%     │  High    │           │
│  └──────────┴──────────┴──────────┴──────────┘           │
└──────────────────────────────────────────────────────────┘
```

### 4.1 Optimizing Batch Processing

```python
# Batch upsert with Qdrant
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

client = QdrantClient(url="http://localhost:6333")

def batch_upsert(collection: str, data: list[dict], batch_size: int = 100):
    """Efficient insertion of large datasets"""
    points = [
        PointStruct(id=d["id"], vector=d["vector"], payload=d["metadata"])
        for d in data
    ]

    # Split into batches and insert
    for i in range(0, len(points), batch_size):
        batch = points[i:i + batch_size]
        client.upsert(
            collection_name=collection,
            points=batch,
            wait=False,  # Async insert (faster)
        )

    # Wait for final sync
    client.upsert(
        collection_name=collection,
        points=[],
        wait=True,
    )
```

### 4.2 pgvector Index Tuning

```sql
-- pgvector performance optimization

-- 1. Create HNSW index (recommended)
CREATE INDEX idx_documents_embedding ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);

-- Set ef at search time
SET hnsw.ef_search = 100;  -- 2-4× top_k

-- 2. IVFFlat index (faster to build, suitable for large data)
CREATE INDEX idx_documents_ivf ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);  -- sqrt(N) is a good guideline

-- Set number of probes at search time
SET ivfflat.probes = 10;  -- 1-5% of lists

-- 3. Check performance
EXPLAIN ANALYZE
SELECT name, 1 - (embedding <=> $1::vector) AS similarity
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- 4. Partial index (when many filters are applied)
CREATE INDEX idx_electronics_embedding ON documents
USING hnsw (embedding vector_cosine_ops)
WHERE category = 'electronics';

-- 5. Memory settings
SET maintenance_work_mem = '2GB';  -- Memory for index builds
SET work_mem = '256MB';             -- Memory for searches
```

### 4.3 Qdrant Named Vectors (Multi-vector)

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, PointStruct, NamedVector,
)

client = QdrantClient(url="http://localhost:6333")

# Multi-vector collection
client.create_collection(
    collection_name="products_multi",
    vectors_config={
        "title": VectorParams(size=384, distance=Distance.COSINE),
        "description": VectorParams(size=1024, distance=Distance.COSINE),
        "image": VectorParams(size=512, distance=Distance.COSINE),
    },
)

# Insert data with multiple vectors
client.upsert(
    collection_name="products_multi",
    points=[
        PointStruct(
            id=1,
            vector={
                "title": [0.1, 0.2, ...],       # Title embedding
                "description": [0.3, 0.4, ...],  # Description embedding
                "image": [0.5, 0.6, ...],         # Image embedding
            },
            payload={"name": "Wireless Earphones", "price": 15000},
        ),
    ],
)

# Search using a specific vector field
results = client.search(
    collection_name="products_multi",
    query_vector=NamedVector(
        name="description",  # Search by description vector
        vector=[0.35, 0.45, ...],
    ),
    limit=10,
)
```

---

## 5. Usage in RAG Pipelines

### 5.1 LangChain + pgvector

```python
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA

# Embedding model
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Create pgvector store
vectorstore = PGVector(
    embeddings=embeddings,
    collection_name="rag_documents",
    connection="postgresql://localhost/rag_db",
)

# Load and split documents
from langchain_community.document_loaders import TextLoader
loader = TextLoader("knowledge_base.txt")
documents = loader.load()

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
)
chunks = splitter.split_documents(documents)

# Insert into vector DB
vectorstore.add_documents(chunks)

# Build RAG chain
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5},
)

qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-4o-mini"),
    chain_type="stuff",
    retriever=retriever,
)

# Question answering
answer = qa_chain.invoke("Please explain how RAG works")
print(answer["result"])
```

### 5.2 LlamaIndex + Qdrant

```python
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    Settings,
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

# Qdrant client
qdrant_client = QdrantClient(url="http://localhost:6333")

# Configure vector store
vector_store = QdrantVectorStore(
    client=qdrant_client,
    collection_name="llama_docs",
    enable_hybrid=True,  # Enable hybrid search
)

# Settings
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")

# Load documents and create index
documents = SimpleDirectoryReader("./docs/").load_data()
index = VectorStoreIndex.from_documents(
    documents,
    vector_store=vector_store,
)

# Query engine
query_engine = index.as_query_engine(
    similarity_top_k=5,
    vector_store_query_mode="hybrid",  # Hybrid search
    alpha=0.5,
)

response = query_engine.query("How do I choose a vector DB?")
print(response)
```

---

## 6. Scaling Strategies

```
┌──────────────────────────────────────────────────────────┐
│          Vector DB Scaling Patterns                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Data Scale         Recommended Configuration            │
│  ──────────         ──────────────────────────           │
│  ~1M records        Single node (in-memory)              │
│  ~10M records       Single node (SSD + memory mapping)   │
│  ~100M records      Sharding (multiple nodes)            │
│  ~1B+ records       Distributed cluster + PQ compression │
│                                                          │
│  Memory estimate (1024 dim, float32):                    │
│  1M records:  ~4GB (vectors only)                        │
│  10M records: ~40GB                                      │
│  100M records: ~400GB                                    │
│                                                          │
│  Cost reduction strategies:                              │
│  1. Dimension reduction (1024 → 512): halves memory      │
│  2. Quantization (float32 → int8): 1/4 memory            │
│  3. PQ compression: 1/8 to 1/16 memory                   │
│  4. Disk index: no memory required (slower speed)        │
└──────────────────────────────────────────────────────────┘
```

### 6.1 Qdrant Sharding and Replication

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, OptimizersConfigDiff,
    CollectionParams,
)

client = QdrantClient(url="http://localhost:6333")

# Create collection with sharding
client.create_collection(
    collection_name="large_scale",
    vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
    shard_number=4,           # Split into 4 shards
    replication_factor=2,     # 2x replication
    write_consistency_factor=1,
    optimizers_config=OptimizersConfigDiff(
        indexing_threshold=20000,  # Threshold for index building
        memmap_threshold=50000,    # Threshold for memory mapping
    ),
)
```

---

## 7. Monitoring and Operations

### 7.1 Qdrant Metrics Monitoring

```python
import requests
from datetime import datetime

def monitor_qdrant(base_url: str = "http://localhost:6333"):
    """Health check and metrics retrieval for Qdrant"""

    # Health check
    health = requests.get(f"{base_url}/healthz").json()
    print(f"Status: {health}")

    # Collection info
    collections = requests.get(f"{base_url}/collections").json()
    for col in collections["result"]["collections"]:
        name = col["name"]
        info = requests.get(f"{base_url}/collections/{name}").json()
        result = info["result"]

        print(f"\nCollection: {name}")
        print(f"  Vector count: {result['vectors_count']:,}")
        print(f"  Point count: {result['points_count']:,}")
        print(f"  Segment count: {len(result.get('segments', []))}")
        print(f"  Disk usage: {result.get('disk_data_size', 0) / 1024**2:.1f} MB")
        print(f"  RAM usage: {result.get('ram_data_size', 0) / 1024**2:.1f} MB")

    # Telemetry (Prometheus format)
    metrics = requests.get(f"{base_url}/metrics").text
    return metrics

# Periodic monitoring
monitor_qdrant()
```

### 7.2 pgvector Monitoring Queries

```sql
-- pgvector performance monitoring

-- 1. Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';

-- 2. Detect slow queries
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%<=>%'  -- Vector search queries
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 3. Check table sizes
SELECT
    pg_size_pretty(pg_total_relation_size('products')) AS total_size,
    pg_size_pretty(pg_relation_size('products')) AS table_size,
    pg_size_pretty(pg_indexes_size('products')) AS index_size;
```

---

## 8. Troubleshooting

```
┌──────────────────────────────────────────────────────────┐
│          Vector DB Troubleshooting                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue 1: Poor search result quality                     │
│  ├── Cause 1: Wrong embedding model chosen               │
│  │   └── Fix: Switch to a multilingual model like BGE-M3 │
│  ├── Cause 2: Inappropriate metadata filtering           │
│  │   └── Fix: Review pre-filtering vs post-filtering     │
│  ├── Cause 3: HNSW parameters too low                    │
│  │   └── Fix: Increase ef_search to top_k × 4           │
│  └── Cause 4: Inappropriate chunk size                   │
│      └── Fix: Adjust to 256-512 tokens                  │
│                                                          │
│  Issue 2: Slow search speed                              │
│  ├── Cause 1: No index created                           │
│  │   └── Fix: Create an HNSW index                       │
│  ├── Cause 2: Data does not fit in memory                │
│  │   └── Fix: Quantization or add more memory            │
│  ├── Cause 3: ef_search is too large                     │
│  │   └── Fix: Revisit the accuracy/speed trade-off       │
│  └── Cause 4: Inefficient metadata filtering             │
│      └── Fix: Add payload index                          │
│                                                          │
│  Issue 3: Out of memory                                  │
│  ├── Cause 1: All data loaded into memory                │
│  │   └── Fix: Enable memmap / disk mode                  │
│  ├── Cause 2: HNSW M parameter too large                 │
│  │   └── Fix: Lower to M=16 (accuracy drop ~1-2%)        │
│  └── Cause 3: Vector dimensionality too high             │
│      └── Fix: Dimension reduction (3072→1024) or quant.  │
│                                                          │
│  Issue 4: Data consistency problems                      │
│  ├── Cause: Embedding model was changed                  │
│  │   └── Fix: Recompute all vectors                      │
│  └── Cause: Inconsistency from partial updates          │
│      └── Fix: Versioning + full rebuild                  │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Anti-patterns

### Anti-pattern 1: Trying to Load All Data into Memory

```python
# NG: Storing 100M records entirely in memory
client.create_collection(
    collection_name="huge_data",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    # → 1536 * 4bytes * 100M = 614GB of memory required!
)

# OK: Quantization + disk-backed index
from qdrant_client.models import ScalarQuantization, ScalarQuantizationConfig

client.create_collection(
    collection_name="huge_data",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    quantization_config=ScalarQuantization(
        scalar=ScalarQuantizationConfig(type="int8", always_ram=False),
    ),
    on_disk_payload=True,  # Also store payload on disk
)
```

### Anti-pattern 2: Large-scale Search Without an Index

```sql
-- NG: No index in pgvector
SELECT * FROM documents
ORDER BY embedding <=> $1
LIMIT 10;
-- → Full scan on 1M records: takes several seconds

-- OK: Create HNSW index
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
-- → Same query runs in under 1ms
```

### Anti-pattern 3: Mixing Everything into a Single Vector Space

```python
# NG: Mix different types of content in the same collection
collection.upsert([
    # Mixing product descriptions and technical docs → lower search accuracy
    {"id": 1, "vector": product_embedding, "type": "product"},
    {"id": 2, "vector": doc_embedding, "type": "documentation"},
])

# OK: Split collections by content type
product_collection = client.create_collection("products", ...)
doc_collection = client.create_collection("documentation", ...)
# Or use Named Vectors for separation
```

### Anti-pattern 4: Operating Without a Backup Strategy

```python
# NG: No backups of the vector DB
# → In case of failure, all vectors must be recomputed

# OK: Take periodic snapshots
# For Qdrant
snapshot = requests.post(
    f"{base_url}/collections/products/snapshots"
).json()

# For pgvector
# Standard pg_dump works as-is
# pg_dump -Fc mydb > mydb_backup.dump

# Preserving original data is most critical
# Vectors can be rebuilt from original text + embedding model
```

---

## 10. Best Practices

### 10.1 Design Checklist

```
┌──────────────────────────────────────────────────────────┐
│          Vector DB Design Checklist                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  □ Data design                                           │
│    ├── Vector dimensions: 1024 recommended               │
│    ├── Distance function: cosine (text) / L2 (images)    │
│    ├── Metadata: define fields used as search filters    │
│    └── ID scheme: UUID or meaningful IDs                 │
│                                                          │
│  □ Index design                                          │
│    ├── HNSW: M=16, ef_construction=200                   │
│    ├── Metadata index: create for filtered fields        │
│    └── ef_search: top_k × 2-4                            │
│                                                          │
│  □ Operational design                                    │
│    ├── Backup: periodic snapshots                        │
│    ├── Monitoring: latency, memory, recall               │
│    ├── Scaling: decide threshold for horizontal sharding │
│    └── Update strategy: recompute plan for model changes │
│                                                          │
│  □ Security                                              │
│    ├── Authentication: API key or mTLS                   │
│    ├── Encryption: at-rest + in-transit                  │
│    └── Access control: tenant isolation                  │
└──────────────────────────────────────────────────────────┘
```


---

## Hands-on Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Template for basic implementation
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

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

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
        """Add item (with size limit)"""
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

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for technology selection.

| Criterion | Prioritize when | Can compromise when |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                  │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Weekly or less → Monolith + modules        │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. Team independence?                          │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term cost and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack has lower learning cost
- Adopting diverse technologies enables best-fit choices but increases operational cost

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but tends to cause code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
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
        md += f"## Context\n{self.context}\n\n"
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

## Real-world Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required features
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't over-engineer (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally renewing a system that has been running for 10+ years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are absent
- Coexist old and new systems behind an API gateway
- Migrate data in stages

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development in a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Assign ownership per team
- Manage shared libraries with Inner Source
- Design API-first to minimize inter-team dependencies

```python
# Define API contracts between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** Systems that require millisecond-level responses

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Applicable Situation |
|------------------------|--------|---------------------|----------------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-bound workloads |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound workloads |

---

## Team Development Usage

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No negative performance impact
- [ ] No security issues
- [ ] Documentation is updated

### Knowledge Sharing Best Practices

| Method | Frequency | Audience | Effect |
|--------|-----------|----------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | As decisions arise | Future members | Decision transparency |
| Retrospectives | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Important design | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │ Act │
    │ it  │ Now │
    ├─────┼─────┤
    │Log  │Next │
    │Only │Sprint│
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```
---

## 11. FAQ

### Q1: Should I choose pgvector or a dedicated vector DB?

If you're already using PostgreSQL and have fewer than 10 million vectors, pgvector is the most rational choice.
The advantages are no additional infrastructure, filtering via SQL, and transaction support.
For over 10 million vectors, sub-millisecond latency requirements, or advanced ANN tuning needs, consider a dedicated DB.

### Q2: How do backups and disaster recovery work for vector DBs?

Pinecone is managed and has automatic backups. Qdrant/Weaviate support backups via the snapshot API.
pgvector works with standard PostgreSQL backups (pg_dump) as-is.
Since vector data can be rebuilt from the original text + embedding model, backing up the original data is most critical.

### Q3: How do I implement multimodal search (text + image)?

Use a multimodal embedding like CLIP to embed images and text into the same vector space.
Alternatively, store text vectors and image vectors in separate fields and manage them with Named Vectors (Qdrant) or multi-vector fields (Weaviate).

### Q4: What is the best approach for updating data in a vector DB?

Real-time updates: Update individually via the Upsert API. Minimal latency but lower throughput.
Batch updates: Periodic bulk upsert. High throughput.
Full rebuild: When changing the embedding model. Create a new collection → switch (Blue-Green).

### Q5: How do I measure and improve search accuracy (Recall)?

Measurement: Use brute-force results as Ground Truth, and calculate match rate against ANN results.
Improvement: Increase ef_search (most effective), increase M (at build time), adjust quantization parameters.
Target: Achieve 95%+ Recall within latency constraints.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|---------------|
| Managed recommendation | Pinecone (easiest to get started) |
| OSS recommendation | Qdrant (Rust, high-speed) |
| Existing PostgreSQL env | pgvector (no additional infrastructure) |
| Hybrid search | Weaviate (built-in BM25) |
| Prototype | Chroma (fastest setup) |
| ANN algorithm | HNSW (best balance of accuracy and speed) |
| Recommended parameters | M=16, ef_construction=200, ef=top_k×4 |
| Scaling | Quantization + sharding |
| Cost optimization | Dimension reduction + quantization + Serverless |

---

## What to Read Next

- [02-local-llm.md](./02-local-llm.md) — Combining local LLMs with vector DBs
- [../02-applications/01-rag.md](../02-applications/01-rag.md) — Using vector DBs in RAG pipelines
- [../02-applications/03-embeddings.md](../02-applications/03-embeddings.md) — Choosing an embedding model

---

## References

1. Pinecone, "Documentation," https://docs.pinecone.io/
2. Qdrant, "Documentation," https://qdrant.tech/documentation/
3. Weaviate, "Documentation," https://weaviate.io/developers/weaviate
4. pgvector, "GitHub Repository," https://github.com/pgvector/pgvector
5. Malkov & Yashunin, "Efficient and Robust Approximate Nearest Neighbor using Hierarchical Navigable Small World Graphs," IEEE TPAMI, 2020
6. Chroma, "Documentation," https://docs.trychroma.com/
