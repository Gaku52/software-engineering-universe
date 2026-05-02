# Search Engine Design

> This guide explains the design principles of full-text search systems for large-scale datasets, covering inverted indexes, ranking algorithms, distributed architectures, and Elasticsearch implementation — building an architecture that balances search quality with performance.

---

## What You Will Learn in This Chapter

1. **Fundamentals of search engines** -- The internal structure of inverted indexes, tokenization, and the mathematical background and intuition behind TF-IDF/BM25 ranking
2. **System architecture** -- Index construction pipelines, query processing flows, the Scatter-Gather pattern for distributed search, and replication strategies
3. **Implementation with Elasticsearch** -- Mapping design, Japanese morphological analysis, query optimization, autocomplete, and aggregations
4. **Search quality improvement techniques** -- Synonym dictionaries, Function Score Query, Learning to Rank, and A/B testing
5. **Operations and monitoring** -- Cluster management, index lifecycle, performance tuning, and incident response

---

## Prerequisites

It is recommended to have the following knowledge before reading this chapter.

| Prerequisite | Reference |
|---------|--------|
| Basic system design concepts (scalability, availability) | [Scalability](../00-fundamentals/01-scalability.md) |
| CAP theorem and distributed system trade-offs | [CAP Theorem](../00-fundamentals/03-cap-theorem.md) |
| Message queue basics (Kafka, etc.) | [Message Queue](../01-components/02-message-queue.md) |
| Database scaling fundamentals | [DB Scaling](../01-components/04-database-scaling.md) |
| Caching strategies | [Caching](../01-components/01-caching.md) |
| Observer pattern (understanding event-driven systems) | [Observer Pattern](../../../design-patterns-guide/docs/02-behavioral/00-observer.md) |

---

## 1. Fundamentals of Search Engines

### 1.1 Why Search Engines Are Necessary (WHY)

A `LIKE '%keyword%'` query against a relational database triggers a full table scan. Running a `LIKE` search on a table with one million rows takes several seconds to tens of seconds; with one hundred million rows it times out. B-Tree indexes only help with prefix matches (`LIKE 'keyword%'`) and are useless for infix or suffix matches.

Natural language search also presents the following challenges:

- **Morphological analysis**: "Tokyo Tower sightseeing guide" must be split into individual meaningful tokens
- **Spelling variations**: "PC", "personal computer", and "computer" need to be treated as equivalent
- **Ranking**: Search results must be sorted by relevance
- **Scale**: Responses must be returned in milliseconds for billions of documents

A dedicated search engine solves these challenges. A search engine uses a specialized data structure called an inverted index to achieve full-text search with near O(1) complexity.

```
Why a dedicated search engine is necessary:

  Problem: LIKE search in RDB
  +--------------------------------------------------+
  | SELECT * FROM products                            |
  | WHERE name LIKE '%Tokyo%'                         |
  |                                                    |
  | Execution plan: Full Table Scan                   |
  | 1M rows → 2-5 seconds                            |
  | 100M rows → timeout                              |
  | Morphological analysis: none                      |
  | Ranking: none                                     |
  | Synonyms: not supported                           |
  +--------------------------------------------------+
         ↓ Solution
  +--------------------------------------------------+
  | Elasticsearch (Inverted Index)                    |
  |                                                    |
  | 1M documents → 10-50ms                           |
  | 100M documents → 50-200ms                        |
  | Morphological analysis: kuromoji (Japanese)       |
  | Ranking: BM25 + custom scoring                   |
  | Synonyms: synonym filter supported               |
  +--------------------------------------------------+
```

### 1.2 Internal Structure of the Inverted Index

The inverted index is the core data structure of a search engine. It holds a mapping from "term → list of documents containing that term (posting list)". This is the same concept as a book index. In a book index, there is a mapping of "keyword → page number", allowing you to immediately find pages that mention a keyword.

```
Documents:
  Doc1: "The weather in Tokyo is sunny"
  Doc2: "The weather in Osaka is rainy"
  Doc3: "Sightseeing guide for Tokyo Tower"

Step 1: Tokenize (morphological analysis)
  Doc1 → ["weather", "Tokyo", "sunny"]
  Doc2 → ["weather", "Osaka", "rainy"]
  Doc3 → ["Tokyo", "Tower", "sightseeing", "guide"]

Step 2: Filtering (stop word removal)
  Doc1 → ["Tokyo", "weather", "sunny"]
  Doc2 → ["Osaka", "weather", "rainy"]
  Doc3 → ["Tokyo", "Tower", "sightseeing", "guide"]

Step 3: Build inverted index
  +------------+--------------------------------------------+
  | Term       | Posting List                               |
  |            | (DocID, TermFreq, [Positions])             |
  +------------+--------------------------------------------+
  | "Tokyo"    | [(Doc1, 1, [0]), (Doc3, 1, [0])]           |
  | "weather"  | [(Doc1, 1, [1]), (Doc2, 1, [1])]           |
  | "sunny"    | [(Doc1, 1, [2])]                           |
  | "Osaka"    | [(Doc2, 1, [0])]                           |
  | "rainy"    | [(Doc2, 1, [2])]                           |
  | "Tower"    | [(Doc3, 1, [1])]                           |
  | "sightseeing" | [(Doc3, 1, [2])]                        |
  | "guide"    | [(Doc3, 1, [3])]                           |
  +------------+--------------------------------------------+

Step 4: Execute search "Tokyo weather"
  "Tokyo"   → {Doc1, Doc3}
  "weather" → {Doc1, Doc2}
  AND operation: {Doc1, Doc3} ∩ {Doc1, Doc2} = {Doc1}
  OR  operation: {Doc1, Doc3} ∪ {Doc1, Doc2} = {Doc1, Doc2, Doc3}
```

#### Why the Inverted Index Is Fast

Searching an inverted index runs in near O(1) complexity, similar to a hashmap lookup. It works in the following specific steps:

1. **Term Dictionary**: Holds all terms in sorted order; searched in O(log N) with binary search
2. **Posting List**: Retrieves the document ID list corresponding to the found term (O(1))
3. **Boolean operations**: Merges multiple posting lists (O(M+N) with sorted list merge)

Lucene (the internal engine of Elasticsearch) uses a data structure called FST (Finite State Transducer) for the Term Dictionary, achieving fast prefix search while keeping memory usage efficient.

```
Internal data structure of the inverted index (Lucene):

  +-- Term Dictionary (FST: Finite State Transducer) --+
  | Placed in memory, fast prefix search                |
  |                                                      |
  | "Osaka"     → Block 0x3A (position on disk)         |
  | "Tokyo"     → Block 0x1F                            |
  | "weather"   → Block 0x2B                            |
  | ...                                                  |
  +------------------------------------------------------+
            |
            v
  +-- Term Index (Skip List) ----+
  | Term → position of Posting List |
  +------------------------------+
            |
            v
  +-- Posting List (.doc file) --+
  | Sorted list of DocIDs         |
  | Compressed with delta coding  |
  | [1, 3, 7, 15, 20, ...]       |
  | → Deltas: [1, 2, 4, 8, 5, ...]|
  | → Further compressed with VByte encoding |
  +------------------------------+
            |
            v
  +-- Position (.pos file) ------+
  | Occurrence positions within each Doc |
  | Used for phrase search        |
  +------------------------------+
            |
            v
  +-- Stored Fields (.fdt) ------+
  | Original document content (compressed) |
  | Used for highlight display    |
  +------------------------------+
```

### 1.3 Search Pipeline

A search engine has two processing flows: the "Write Path (index construction)" and the "Read Path (query processing)".

```
===================== Write Path (Index Construction) =====================

  Raw Data ──→ [Crawler / Ingest API]
                     │
                     v
              [Text Extraction]       Extract text from PDF/HTML/JSON
                     │
                     v
              [Character Filter]      Remove HTML tags, normalize width
                     │
                     v
              [Tokenizer]             Morphological analysis (kuromoji)
                     │                "Tokyo weather" → ["Tokyo","weather"]
                     v
              [Token Filter]          Stop word removal, base form conversion
                     │                Synonym expansion, lowercasing
                     v
              [Inverted Index]        Write to inverted index
                     │
                     v
              [Segment]               Save to disk as Lucene segment
                                      ※ immutable (cannot be modified once written)

===================== Read Path (Query Processing) ============================

  Query "Tokyo weather" ──→ [Query Parser]     Parse query syntax
                              │
                              v
                        [Analyzer]          Same tokenization as Write Path
                              │             + search-time filters (synonym expansion)
                              v
                        [Index Lookup]      Look up inverted index
                              │
                              v
                        [Scoring (BM25)]    Calculate score for each document
                              │
                              v
                        [Collector]         Collect Top-K documents (priority queue)
                              │
                              v
                        [Post Filter]       Apply filter conditions (price, category)
                              │
                              v
                        [Highlight]         Generate highlight for matched sections
                              │
                              v
                        [Response]          Build JSON response
```

#### Why Consistency Between Write Path and Read Path Matters

If the Write Path and Read Path do not use the **same Analyzer**, search will not work correctly. For example, if the Write Path splits "Tokyo Tower" into "Tokyo" and "Tower", but the Read Path searches for "Tokyo Tower" as a single token, it will not match in the inverted index.

However, **synonym expansion should only be performed at search time** as best practice. Expanding synonyms at index time requires re-indexing all documents every time the synonym dictionary is updated.

### 1.4 Ranking: TF-IDF and BM25

#### TF-IDF (Term Frequency - Inverse Document Frequency)

TF-IDF is a classical information retrieval ranking method. Intuitively, it is based on the idea that "a term that appears frequently in a document but rarely in other documents is more important".

```
TF-IDF calculation:

  TF(t, d) = number of occurrences of term t in document d / total number of terms in document d

  IDF(t) = log(total number of documents / number of documents containing term t)

  TF-IDF(t, d) = TF(t, d) × IDF(t)

  Example: 100 total documents, "Tokyo" appears 5 times in Doc1 (100 terms),
      "Tokyo" appears in 10 documents

  TF("Tokyo", Doc1) = 5 / 100 = 0.05
  IDF("Tokyo")      = log(100 / 10) = log(10) ≈ 2.30
  TF-IDF            = 0.05 × 2.30 = 0.115

  For "the" (a term that appears in all documents):
  IDF("the") = log(100 / 100) = log(1) = 0
  TF-IDF     = 0.05 × 0 = 0  (function words have zero importance)
```

#### Problems with TF-IDF

TF-IDF has two major problems:

1. **No TF saturation**: A document where a term appears 10 times scores 10 times higher than one where it appears once. In reality, if a term appears 10 times it sufficiently indicates relevance; appearing 100 times does not mean it is 10 times more relevant.
2. **Insufficient document length normalization**: Longer documents naturally have more term occurrences, so they unfairly score higher than shorter documents.

#### BM25 (Best Matching 25)

BM25 is an improved version of TF-IDF that addresses its problems, and is the default ranking algorithm in Elasticsearch.

```
BM25 score calculation:

  score(D, Q) = Σ [ IDF(qi) × f(qi,D) × (k1 + 1)                    ]
                    [         ─────────────────────────────────────────]
                    [         f(qi,D) + k1 × (1 - b + b × |D| / avgdl)]

  Meaning of each element:
  ┌──────────────┬────────────────────────────────────────────────┐
  │ Variable     │ Meaning                                        │
  ├──────────────┼────────────────────────────────────────────────┤
  │ Q            │ Search query (set of terms q1, q2, ...)        │
  │ D            │ Document to score                              │
  │ qi           │ The i-th term in the query                     │
  │ f(qi, D)     │ Frequency of term qi in document D (Term Frequency) │
  │ |D|          │ Length of document D (number of terms)         │
  │ avgdl        │ Average document length across all documents   │
  │ k1 (= 1.2)  │ TF saturation parameter (higher = slower saturation) │
  │ b (= 0.75)  │ Document length normalization parameter (0=off, 1=full) │
  │ IDF(qi)      │ Inverse document frequency (higher for rarer terms) │
  └──────────────┴────────────────────────────────────────────────┘

  IDF calculation in BM25 (Lucene implementation):
  IDF(qi) = log(1 + (N - n(qi) + 0.5) / (n(qi) + 0.5))
    N:      total number of documents
    n(qi):  number of documents containing term qi

  Advantages of BM25 over TF-IDF:
  ┌─────────────────────┬──────────────┬──────────────────────┐
  │ Property            │ TF-IDF       │ BM25                 │
  ├─────────────────────┼──────────────┼──────────────────────┤
  │ TF saturation       │ None (linear) │ Yes (controlled by k1) │
  │ Document length normalization │ Insufficient │ Controlled by b parameter │
  │ Suppression of high-frequency terms │ Weak │ Naturally suppressed by saturation │
  │ Parameter tuning    │ None         │ Adjustable via k1, b  │
  └─────────────────────┴──────────────┴──────────────────────┘
```

#### Intuitive Understanding of TF Saturation in BM25

```
TF saturation graph (k1=1.2):

  Score contribution
  ^
  |                                    -------- TF-IDF (linear)
  |                               ----/
  |                          ----/
  |                     ----/
  |     -------========---------- BM25 (with saturation)
  |   -/  ----/
  | -/ --/
  |/ /
  +----------------------------------------→ occurrence count
  0   1   2   3   5   10  20  50

  TF-IDF: score keeps increasing proportionally to occurrence count
  BM25:   score nearly saturates after a few occurrences
         → Score is nearly the same whether "Tokyo" appears 10 or 100 times
         → Achieves more natural ranking
```

### 1.5 Morphological Analysis and Japanese Text Processing

In a Japanese search engine, one of the most important elements is morphological analysis. In English, words are separated by spaces. Japanese has no space delimiters, so a process to split text into individual words is required.

```
Comparison of Japanese text tokenization methods:

  Input: "Tokyo Skytree observation deck"

  ┌─────────────────────┬─────────────────────────────────────┐
  │ Method              │ Result                              │
  ├─────────────────────┼─────────────────────────────────────┤
  │ N-gram (bigram)     │ Many overlapping 2-character tokens │
  │                     │ → High recall but low precision     │
  │                     │ → Spurious character combinations   │
  │                     │   also match in search              │
  ├─────────────────────┼─────────────────────────────────────┤
  │ kuromoji (morphological analysis) │ ["Tokyo", "Skytree", "observation deck"] │
  │                     │ → Split into meaningful units       │
  │                     │ → High precision                    │
  ├─────────────────────┼─────────────────────────────────────┤
  │ kuromoji + user dictionary │ ["Tokyo Skytree", "observation deck"] │
  │                     │ → Recognizes proper nouns as a single token │
  │                     │ → Further improved search accuracy  │
  └─────────────────────┴─────────────────────────────────────┘

  Trade-offs between N-gram and morphological analysis:
  ┌──────────────┬──────────────────┬──────────────────────┐
  │ Metric       │ N-gram           │ Morphological analysis │
  ├──────────────┼──────────────────┼──────────────────────┤
  │ Recall       │ High (few misses) │ Medium (misses terms not in dictionary) │
  │ Precision    │ Low (noisy)       │ High (matches on meaning units) │
  │ Index size   │ Large             │ Small                 │
  │ Dictionary dependency │ None   │ Yes                   │
  │ New word support │ Automatic    │ Requires dictionary update │
  │ Search speed │ Slow (many candidates) │ Fast             │
  └──────────────┴──────────────────┴──────────────────────┘
```

---

## 2. System Architecture

### 2.1 Overall Architecture

The following shows the overall picture of a large-scale search system. Multiple components work in coordination, from data ingestion to returning results to users.

```
             Large-Scale Search Engine — Overall Architecture

  ┌──────────────────────────────────────────────────────────────┐
  │                        Client Layer                          │
  │  [Web App] [Mobile App] [API Client]                         │
  └──────────┬───────────────────────────────────────────────────┘
             │
  ┌──────────v───────────────────────────────────────────────────┐
  │                        Gateway Layer                         │
  │  [CDN (static content)]  [API Gateway]  [Rate Limiter]       │
  │                              │                               │
  │                    [Authentication]                           │
  │                    [Query Rewriting]                          │
  │                    [Request Routing]                          │
  └──────────────────────┬──────────────────────────────────────-┘
                         │
  ┌──────────────────────v──────────────────────────────────────-┐
  │                     Search Service                           │
  │                                                              │
  │  [Query Parser] → [Spell Check] → [Synonym Expansion]       │
  │       → [Query Planner] → [Elasticsearch Client]            │
  │       → [Result Formatter] → [Personalization]              │
  │       → [Cache (Redis)]                                     │
  └──────────────────────┬──────────────────────────────────────-┘
                         │
  ┌──────────────────────v──────────────────────────────────────-┐
  │              Elasticsearch Cluster                           │
  │                                                              │
  │  [Master Node x3]   Election & cluster management            │
  │  [Data Node x6]     Hold indexes & execute searches          │
  │  [Coordinator x2]   Query routing & result merging           │
  │  [Ingest Node x2]   Document preprocessing pipeline         │
  └──────────────────────────────────────────────────────────────┘
                         │
  ┌──────────────────────v──────────────────────────────────────-┐
  │              Data Ingestion Pipeline                         │
  │                                                              │
  │  [Source DB] → [CDC (Debezium)] → [Kafka] → [Index Worker]  │
  │  [Crawler]  → [Content Parser] → [Enrichment] → [ES Bulk]  │
  │  [File Store] → [Tika (extract)] → [Kafka] → [Index Worker] │
  └──────────────────────────────────────────────────────────────┘
                         │
  ┌──────────────────────v──────────────────────────────────────-┐
  │              Monitoring & Analytics                          │
  │                                                              │
  │  [Prometheus/Grafana]  Cluster metrics                       │
  │  [Search Analytics]    Query logs & CTR analysis             │
  │  [Alerting]            Anomaly detection & alerts            │
  └──────────────────────────────────────────────────────────────┘
```

### 2.2 Scatter-Gather Pattern for Distributed Search

Elasticsearch splits data into shards and distributes them across multiple nodes. At search time, it sends queries to all shards in parallel (Scatter) and merges the results (Gather).

```
                  Scatter-Gather Pattern in Detail

  Client
    │
    v
  [Coordinator Node]
    │
    ├── Phase 1: Query Phase (Scatter)
    │   │
    │   ├──→ [Shard 0, Node A] ── BM25 scoring ──→ (DocID, Score) Top-K
    │   ├──→ [Shard 1, Node B] ── BM25 scoring ──→ (DocID, Score) Top-K
    │   ├──→ [Shard 2, Node C] ── BM25 scoring ──→ (DocID, Score) Top-K
    │   ├──→ [Shard 3, Node A] ── BM25 scoring ──→ (DocID, Score) Top-K
    │   └──→ [Shard 4, Node B] ── BM25 scoring ──→ (DocID, Score) Top-K
    │
    ├── Phase 2: Merge (Gather)
    │   │
    │   └── Sort Top-K from all shards by Score
    │       → Determine Global Top-K
    │       → Example: to get Top-10, each shard returns Top-10,
    │         Coordinator selects Top-10 from 50 candidates
    │
    └── Phase 3: Fetch Phase
        │
        ├──→ [Shard 0] ── Fetch _source for DocID 3, 7
        ├──→ [Shard 2] ── Fetch _source for DocID 15
        └──→ [Shard 4] ── Fetch _source for DocID 42, 88

        → Return document body, highlights, and aggregation results

  ※ Query Phase returns only DocID + Score, so it is lightweight
  ※ Fetch Phase retrieves actual document content (two-phase approach)
```

#### Sharding Strategy

```
Sharding design guidelines:

  ┌──────────────────────┬────────────────────────────────────┐
  │ Consideration        │ Guideline                          │
  ├──────────────────────┼────────────────────────────────────┤
  │ Shard size           │ 10-50 GB / shard (recommended)     │
  │ Max shard count      │ No more than 20 shards per 1GB heap │
  │ Determining shard count │ Total data size ÷ target shard size │
  │ Example: 500GB data  │ 500 ÷ 30 ≈ 17 shards              │
  ├──────────────────────┼────────────────────────────────────┤
  │ Replica count        │ At least 1 (for availability)      │
  │                      │ 2-3 for high read loads            │
  ├──────────────────────┼────────────────────────────────────┤
  │ Routing              │ Default: hash(_id) % num_shards    │
  │                      │ Custom: user_id-based routing      │
  └──────────────────────┴────────────────────────────────────┘

  Time-series index pattern (logs, events):

  logs-2024.01.01  (hot:  SSD, 1 primary + 1 replica)
  logs-2024.01.02  (hot:  SSD, 1 primary + 1 replica)
  ...
  logs-2023.12.01  (warm: HDD, 1 primary + 1 replica, force-merged)
  logs-2023.11.01  (cold: S3, searchable snapshot)

  → Managed automatically with ILM (Index Lifecycle Management)
  → hot → warm → cold → delete lifecycle
```

### 2.3 Index Update Pipeline

Synchronizing the primary data store (RDB) with the search index (Elasticsearch) is achieved with the CDC (Change Data Capture) pattern.

```
  CDC + Kafka Pipeline in Detail

  ┌──────────┐    CDC (WAL)    ┌──────────┐    Consumer    ┌────────────┐
  │ PostgreSQL│───────────────→│  Kafka    │──────────────→│Index Worker│
  │           │  Debezium      │  Topic    │               │            │
  │ products  │  Connector     │"product-  │  Consumer     │ Transform  │
  │ table     │               │ updates"  │  Group        │ Enrich     │
  └──────────┘                └──────────┘               │ Validate   │
                                                          │ Bulk Index │
                                                          └─────┬──────┘
                                                                │
                                                          ┌─────v──────┐
                                                          │Elasticsearch│
                                                          │  Cluster   │
                                                          └────────────┘

  Structure of a CDC event:
  {
    "op": "u",              // c=create, u=update, d=delete
    "before": {...},        // row data before change
    "after": {              // row data after change
      "id": 12345,
      "name": "Product A revised",
      "price": 2980,
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "source": {
      "table": "products",
      "lsn": 123456789      // WAL log sequence number
    }
  }

  Index Worker processing flow:
  1. Consume events from Kafka (batches of 100-500)
  2. Branch based on op:
     - "c" / "u": transform document → upsert to ES
     - "d": delete document from ES
  3. Enrichment: resolve category names, transform image URLs, etc.
  4. Validation: check required fields
  5. Bulk write to ES using Bulk API
  6. Commit offset

  Latency: typically 1-5 seconds from DB update to ES reflection
  Throughput: 5,000-10,000 docs/sec per worker
```

### 2.4 Caching Strategy

In a search system, caching frequent queries has a major impact on performance.

```
Multi-layer cache structure for search:

  Layer 1: CDN / Edge Cache
  ┌─────────────────────────────────────────┐
  │ Static search result pages (for SEO)    │
  │ TTL: 5-15 minutes                       │
  │ Hit rate: 10-20% (high query diversity) │
  └─────────────────────────────────────────┘

  Layer 2: Application Cache (Redis)
  ┌─────────────────────────────────────────┐
  │ Cache of query results                  │
  │ Key: hash(query + filters + page)       │
  │ TTL: 1-5 minutes                        │
  │ Hit rate: 30-50% (popular queries recur)│
  │ Invalidation: purge related cache       │
  │               on index update           │
  └─────────────────────────────────────────┘

  Layer 3: Elasticsearch Request Cache
  ┌─────────────────────────────────────────┐
  │ Shard-level result cache                │
  │ Caches results of filter clauses        │
  │ Automatically invalidated on shard refresh │
  │ Hit rate: high (when same filter conditions repeat) │
  └─────────────────────────────────────────┘

  Layer 4: Elasticsearch Field Data Cache
  ┌─────────────────────────────────────────┐
  │ Field data used for sorting and aggregations │
  │ Pre-built with doc_values (recommended) │
  │ Expanded in heap memory                 │
  └─────────────────────────────────────────┘
```

---

## 3. Elasticsearch Implementation

### 3.1 Index Mapping Design

```python
# Code Example 1: Elasticsearch index settings (Python - elasticsearch-py)
from elasticsearch import Elasticsearch

es = Elasticsearch(['http://localhost:9200'])

# Index settings for Japanese search
index_settings = {
    "settings": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "refresh_interval": "1s",    # Index update interval
        "analysis": {
            "char_filter": {
                "normalize_filter": {
                    "type": "icu_normalizer",      # Unicode normalization
                    "name": "nfkc_cf",
                }
            },
            "analyzer": {
                "ja_analyzer": {
                    "type": "custom",
                    "char_filter": ["normalize_filter"],
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": [
                        "kuromoji_baseform",      # Inflected form → base form (ran→run)
                        "kuromoji_part_of_speech", # Remove particles and auxiliary verbs
                        "cjk_width",              # Normalize full-width/half-width
                        "ja_stop",                # Japanese stop words
                        "lowercase",              # Lowercase English letters
                    ]
                },
                "ja_search_analyzer": {
                    "type": "custom",
                    "char_filter": ["normalize_filter"],
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": [
                        "kuromoji_baseform",
                        "kuromoji_part_of_speech",
                        "cjk_width",
                        "ja_stop",
                        "lowercase",
                        "synonym_filter",          # Synonym expansion at search time only
                    ]
                },
                "ja_ngram_analyzer": {
                    "type": "custom",
                    "char_filter": ["normalize_filter"],
                    "tokenizer": "ja_ngram_tokenizer",
                    "filter": ["lowercase"]
                }
            },
            "tokenizer": {
                "ja_ngram_tokenizer": {
                    "type": "ngram",
                    "min_gram": 2,
                    "max_gram": 3,
                    "token_chars": ["letter", "digit"]
                }
            },
            "filter": {
                "synonym_filter": {
                    "type": "synonym",
                    "synonyms": [
                        "PC, personal computer, computer",
                        "smartphone, mobile phone, cellphone",
                        "television, TV",
                    ]
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "title": {
                "type": "text",
                "analyzer": "ja_analyzer",
                "search_analyzer": "ja_search_analyzer",
                "fields": {
                    "keyword": {"type": "keyword"},  # For exact match, sorting, aggregation
                    "ngram": {                        # For partial match search
                        "type": "text",
                        "analyzer": "ja_ngram_analyzer"
                    }
                }
            },
            "description": {
                "type": "text",
                "analyzer": "ja_analyzer",
                "search_analyzer": "ja_search_analyzer",
            },
            "category": {
                "type": "keyword",               # For filtering and aggregation
            },
            "tags": {
                "type": "keyword",               # Multiple tags
            },
            "price": {
                "type": "integer",               # For range filtering
            },
            "rating": {
                "type": "float",                 # For sorting and boosting
            },
            "review_count": {
                "type": "integer",               # For popularity scoring
            },
            "created_at": {
                "type": "date",                  # For time-based filtering
            },
            "updated_at": {
                "type": "date",
            },
            "location": {
                "type": "geo_point",             # For geo search
            },
            "suggest": {
                "type": "completion",            # For autocomplete
                "analyzer": "ja_analyzer",
            },
            "metadata": {
                "type": "object",
                "enabled": False,                # Not indexed (stored only)
            }
        }
    }
}

# Create index (via alias)
index_name = "products_v1"
alias_name = "products"

es.indices.create(index=index_name, body=index_settings)
es.indices.put_alias(index=index_name, name=alias_name)
print(f"Created index '{index_name}' and set alias '{alias_name}'")
```

### 3.2 Implementing Search Queries

```python
# Code Example 2: Compound search query (product search API)
from typing import Optional, List, Dict, Any
from datetime import datetime


def search_products(
    query: str,
    category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_rating: Optional[float] = None,
    sort_by: str = "relevance",
    page: int = 1,
    size: int = 20,
) -> Dict[str, Any]:
    """
    Execute full-text search for products.

    Args:
        query: Search keyword
        category: Category filter
        tags: Tag filter (AND condition)
        min_price: Minimum price
        max_price: Maximum price
        min_rating: Minimum rating
        sort_by: Sort order ("relevance", "price_asc", "price_desc",
                 "rating", "newest")
        page: Page number (1-indexed)
        size: Number of items per page

    Returns:
        Search results (hit count, product list, facet information)
    """
    # --- must clause: full-text search ---
    must_clauses = []
    if query:
        must_clauses.append({
            "multi_match": {
                "query": query,
                "fields": [
                    "title^3",          # Title boosted 3x
                    "title.ngram^0.5",  # N-gram with low boost
                    "description",
                    "tags^2",
                ],
                "type": "best_fields",
                "fuzziness": "AUTO",    # Allow typos (1 edit distance for 3-5 chars)
                "minimum_should_match": "75%",
            }
        })

    # --- filter clause: narrowing down (does not affect score) ---
    filter_clauses = []
    if category:
        filter_clauses.append({"term": {"category": category}})
    if tags:
        for tag in tags:
            filter_clauses.append({"term": {"tags": tag}})
    if min_price is not None or max_price is not None:
        price_range = {}
        if min_price is not None:
            price_range["gte"] = min_price
        if max_price is not None:
            price_range["lte"] = max_price
        filter_clauses.append({"range": {"price": price_range}})
    if min_rating is not None:
        filter_clauses.append({"range": {"rating": {"gte": min_rating}}})

    # --- Determine sort order ---
    sort_options = {
        "relevance": [{"_score": "desc"}, {"rating": "desc"}],
        "price_asc": [{"price": "asc"}, {"_score": "desc"}],
        "price_desc": [{"price": "desc"}, {"_score": "desc"}],
        "rating": [{"rating": "desc"}, {"review_count": "desc"}],
        "newest": [{"created_at": "desc"}],
    }
    sort = sort_options.get(sort_by, sort_options["relevance"])

    # --- Build query body ---
    body = {
        "query": {
            "bool": {
                "must": must_clauses,
                "filter": filter_clauses,
            }
        },
        "highlight": {
            "fields": {
                "title": {"number_of_fragments": 0},  # Return full text
                "description": {
                    "fragment_size": 150,
                    "number_of_fragments": 3,
                },
            },
            "pre_tags": ["<mark>"],
            "post_tags": ["</mark>"],
        },
        "aggs": {
            "categories": {
                "terms": {"field": "category", "size": 20}
            },
            "price_stats": {
                "stats": {"field": "price"}
            },
            "price_ranges": {
                "range": {
                    "field": "price",
                    "ranges": [
                        {"key": "Under $10", "to": 10},
                        {"key": "$10-$50", "from": 10, "to": 50},
                        {"key": "$50-$100", "from": 50, "to": 100},
                        {"key": "$100+", "from": 100},
                    ]
                }
            },
            "avg_rating": {
                "avg": {"field": "rating"}
            },
            "tags": {
                "terms": {"field": "tags", "size": 30}
            },
        },
        "from": (page - 1) * size,
        "size": size,
        "sort": sort,
        "_source": {
            "excludes": ["suggest", "metadata"]  # Exclude unnecessary fields
        },
    }

    result = es.search(index="products", body=body)

    # --- Format response ---
    return {
        "total": result["hits"]["total"]["value"],
        "page": page,
        "size": size,
        "items": [
            {
                "id": hit["_id"],
                "score": hit["_score"],
                "source": hit["_source"],
                "highlight": hit.get("highlight", {}),
            }
            for hit in result["hits"]["hits"]
        ],
        "facets": {
            "categories": [
                {"key": b["key"], "count": b["doc_count"]}
                for b in result["aggregations"]["categories"]["buckets"]
            ],
            "price_ranges": [
                {"key": b["key"], "count": b["doc_count"]}
                for b in result["aggregations"]["price_ranges"]["buckets"]
            ],
            "price_stats": result["aggregations"]["price_stats"],
            "avg_rating": result["aggregations"]["avg_rating"]["value"],
            "tags": [
                {"key": b["key"], "count": b["doc_count"]}
                for b in result["aggregations"]["tags"]["buckets"]
            ],
        },
    }
```

### 3.3 Autocomplete (Completion Suggester)

```python
# Code Example 3: Suggestions (autocomplete)
def autocomplete(prefix: str, size: int = 5, category: str = None) -> list:
    """
    Return suggestion candidates for the text being typed.

    Args:
        prefix: User's input string
        size: Number of suggestions to return
        category: Filter by category if specified

    Returns:
        List of suggestion candidates
    """
    contexts = {}
    if category:
        contexts["category"] = [category]

    body = {
        "suggest": {
            "product_suggest": {
                "prefix": prefix,
                "completion": {
                    "field": "suggest",
                    "size": size,
                    "fuzzy": {
                        "fuzziness": 1,       # Allow 1-character typo
                        "transpositions": True, # Allow character transpositions
                    },
                    "contexts": contexts if contexts else None,
                    "skip_duplicates": True,
                }
            }
        },
        "_source": ["title", "category", "price"],
    }

    result = es.search(index="products", body=body)
    suggestions = result["suggest"]["product_suggest"][0]["options"]

    return [
        {
            "text": s["text"],
            "title": s["_source"]["title"],
            "category": s["_source"]["category"],
            "price": s["_source"]["price"],
            "score": s["_score"],
        }
        for s in suggestions
    ]


# Settings when indexing suggest data
def build_suggest_input(product: dict) -> dict:
    """Build input data for suggestions"""
    inputs = [product["name"]]

    # Add reading (kana) if available (for romanized input support)
    if product.get("name_kana"):
        inputs.append(product["name_kana"])

    # Brand name
    if product.get("brand"):
        inputs.append(product["brand"])

    # Keywords
    inputs.extend(product.get("keywords", []))

    return {
        "input": inputs,
        "weight": int(product.get("rating", 3.0) * product.get("review_count", 1)),
        "contexts": {
            "category": [product["category"]],
        }
    }
```

### 3.4 Bulk Indexing

```python
# Code Example 4: Bulk indexing and error handling
from elasticsearch.helpers import bulk, BulkIndexError
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def index_products(products: list, chunk_size: int = 500) -> dict:
    """
    Index a list of products in bulk.

    Args:
        products: List of product data
        chunk_size: Number of items to send per bulk request

    Returns:
        Success count and error count
    """
    def generate_actions(products):
        """Generator for bulk actions"""
        for product in products:
            yield {
                "_index": "products",
                "_id": product["id"],
                "_source": {
                    "title": product["name"],
                    "description": product.get("description", ""),
                    "category": product["category"],
                    "tags": product.get("tags", []),
                    "price": product["price"],
                    "rating": product.get("rating", 0.0),
                    "review_count": product.get("review_count", 0),
                    "created_at": product.get("created_at",
                                              datetime.now().isoformat()),
                    "updated_at": datetime.now().isoformat(),
                    "suggest": build_suggest_input(product),
                },
            }

    try:
        success, errors = bulk(
            es,
            generate_actions(products),
            chunk_size=chunk_size,
            request_timeout=120,
            raise_on_error=False,     # Continue processing even on error
            raise_on_exception=False,
            max_retries=3,            # Number of retries
            initial_backoff=1,        # Retry interval (seconds)
            max_backoff=60,
        )
        if errors:
            logger.error(f"Bulk index errors: {len(errors)} items")
            for error in errors[:5]:  # Log first 5 only
                logger.error(f"  {error}")
        logger.info(f"Indexing complete: success={success}, errors={len(errors)}")
        return {"success": success, "errors": len(errors)}

    except BulkIndexError as e:
        logger.exception(f"Bulk index fatal error: {e}")
        raise


def reindex_with_zero_downtime(new_settings: dict,
                                alias: str = "products") -> str:
    """
    Rebuild index without downtime.

    Args:
        new_settings: New index settings
        alias: Alias name

    Returns:
        New index name
    """
    # Step 1: Get current index name
    current_indices = list(es.indices.get_alias(name=alias).keys())
    current_index = current_indices[0] if current_indices else None

    # Step 2: Generate new index name
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    new_index = f"{alias}_v_{timestamp}"

    # Step 3: Create new index
    es.indices.create(index=new_index, body=new_settings)
    logger.info(f"Created new index '{new_index}'")

    # Step 4: Reindex
    es.reindex(
        body={
            "source": {"index": current_index},
            "dest": {"index": new_index},
        },
        wait_for_completion=True,
        request_timeout=3600,
    )
    logger.info(f"Reindex complete: {current_index} → {new_index}")

    # Step 5: Switch alias (atomic operation)
    es.indices.update_aliases(body={
        "actions": [
            {"remove": {"index": current_index, "alias": alias}},
            {"add": {"index": new_index, "alias": alias}},
        ]
    })
    logger.info(f"Switched alias '{alias}' to '{new_index}'")

    # Step 6: Delete old index (optional)
    # es.indices.delete(index=current_index)

    return new_index
```

### 3.5 Function Score Query (Score Customization)

```python
# Code Example 5: Advanced ranking with Function Score Query
def search_with_custom_scoring(
    query: str,
    user_location: tuple = None,   # (lat, lon)
    boost_new: bool = True,
    boost_popular: bool = True,
    page: int = 1,
    size: int = 20,
) -> dict:
    """
    Search combining BM25 score with business logic.

    score = BM25 × popularity_boost × freshness_boost × distance_decay

    Args:
        query: Search keyword
        user_location: User's location (latitude, longitude)
        boost_new: Whether to boost new products
        boost_popular: Whether to boost popular products
        page: Page number
        size: Number of items
    """
    functions = []

    # --- Popularity boost ---
    if boost_popular:
        functions.append({
            "field_value_factor": {
                "field": "review_count",
                "modifier": "log1p",    # log(1 + review_count)
                "factor": 0.5,
                "missing": 0,
            },
            "weight": 2,
        })
        functions.append({
            "field_value_factor": {
                "field": "rating",
                "modifier": "none",
                "factor": 1,
                "missing": 3.0,         # Treat items with no reviews as 3.0
            },
            "weight": 1.5,
        })

    # --- Freshness boost (favor items from the last 30 days) ---
    if boost_new:
        functions.append({
            "gauss": {
                "created_at": {
                    "origin": "now",
                    "scale": "30d",     # Halves at 30 days
                    "offset": "7d",     # No decay within 7 days
                    "decay": 0.5,
                }
            },
            "weight": 1.2,
        })

    # --- Distance boost (favor nearby stores) ---
    if user_location:
        functions.append({
            "gauss": {
                "location": {
                    "origin": {
                        "lat": user_location[0],
                        "lon": user_location[1],
                    },
                    "scale": "5km",     # Halves at 5km
                    "offset": "1km",    # No decay within 1km
                    "decay": 0.5,
                }
            },
            "weight": 1.5,
        })

    body = {
        "query": {
            "function_score": {
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "description", "tags^2"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                },
                "functions": functions,
                "score_mode": "multiply",   # Multiply results of each function
                "boost_mode": "multiply",   # Multiply with BM25
                "max_boost": 10,            # Maximum boost cap
            }
        },
        "from": (page - 1) * size,
        "size": size,
    }

    return es.search(index="products", body=body)
```

### 3.6 Search Log Collection and Analysis

```python
# Code Example 6: Search log collection and analysis queries
import json
from datetime import datetime


def log_search_event(
    query: str,
    user_id: str,
    results_count: int,
    clicked_ids: list = None,
    response_time_ms: int = 0,
):
    """Record a search event to the log index"""
    event = {
        "query": query,
        "user_id": user_id,
        "results_count": results_count,
        "clicked_ids": clicked_ids or [],
        "has_clicks": bool(clicked_ids),
        "response_time_ms": response_time_ms,
        "timestamp": datetime.now().isoformat(),
    }
    es.index(index="search_logs", body=event)


def analyze_zero_result_queries(days: int = 7) -> list:
    """
    Analyze queries that returned zero results.
    → Useful for discovering candidates to add to the synonym dictionary.
    """
    body = {
        "query": {
            "bool": {
                "must": [
                    {"range": {"timestamp": {"gte": f"now-{days}d"}}},
                    {"term": {"results_count": 0}},
                ]
            }
        },
        "aggs": {
            "zero_result_queries": {
                "terms": {
                    "field": "query.keyword",
                    "size": 50,
                    "order": {"_count": "desc"},
                }
            }
        },
        "size": 0,
    }
    result = es.search(index="search_logs", body=body)
    return [
        {"query": b["key"], "count": b["doc_count"]}
        for b in result["aggregations"]["zero_result_queries"]["buckets"]
    ]


def calculate_ctr(days: int = 7) -> list:
    """
    Calculate CTR (Click Through Rate) per query.
    → Used as a metric for ranking improvement.
    """
    body = {
        "query": {
            "range": {"timestamp": {"gte": f"now-{days}d"}}
        },
        "aggs": {
            "queries": {
                "terms": {
                    "field": "query.keyword",
                    "size": 100,
                    "min_doc_count": 10,
                },
                "aggs": {
                    "click_rate": {
                        "avg": {
                            "script": {
                                "source": "doc['has_clicks'].value ? 1 : 0"
                            }
                        }
                    },
                    "avg_response_time": {
                        "avg": {"field": "response_time_ms"}
                    }
                }
            }
        },
        "size": 0,
    }
    result = es.search(index="search_logs", body=body)
    return [
        {
            "query": b["key"],
            "searches": b["doc_count"],
            "ctr": round(b["click_rate"]["value"] * 100, 1),
            "avg_response_ms": round(
                b["avg_response_time"]["value"], 0
            ),
        }
        for b in result["aggregations"]["queries"]["buckets"]
    ]
```

### 3.7 Asynchronous Index Updates via Kafka Consumer

```python
# Code Example 7: Kafka Consumer (CDC → Elasticsearch)
from confluent_kafka import Consumer, KafkaError
import json
import signal
import sys


class SearchIndexConsumer:
    """
    Consumes CDC events from Kafka and updates Elasticsearch.
    """

    def __init__(self, kafka_config: dict, es_client, batch_size: int = 100):
        self.consumer = Consumer(kafka_config)
        self.es = es_client
        self.batch_size = batch_size
        self.running = True
        self.buffer = []

        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

    def _shutdown(self, signum, frame):
        self.running = False

    def start(self, topics: list):
        """Start the consumer loop"""
        self.consumer.subscribe(topics)

        while self.running:
            msg = self.consumer.poll(timeout=1.0)
            if msg is None:
                # Timeout: flush whatever has accumulated in the buffer
                if self.buffer:
                    self._flush_buffer()
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f"Kafka error: {msg.error()}")
                    continue

            # Process message
            event = json.loads(msg.value().decode("utf-8"))
            action = self._build_action(event)
            if action:
                self.buffer.append(action)

            # Flush when batch size is reached
            if len(self.buffer) >= self.batch_size:
                self._flush_buffer()
                self.consumer.commit()

        # Flush buffer before exiting
        if self.buffer:
            self._flush_buffer()
        self.consumer.close()

    def _build_action(self, event: dict) -> dict:
        """Build a bulk action from a CDC event"""
        op = event.get("op")

        if op in ("c", "u", "r"):  # create, update, read (snapshot)
            after = event["after"]
            return {
                "_op_type": "index",
                "_index": "products",
                "_id": after["id"],
                "_source": {
                    "title": after["name"],
                    "description": after.get("description", ""),
                    "category": after["category"],
                    "price": after["price"],
                    "rating": after.get("rating", 0.0),
                    "updated_at": after.get("updated_at"),
                },
            }
        elif op == "d":  # delete
            before = event["before"]
            return {
                "_op_type": "delete",
                "_index": "products",
                "_id": before["id"],
            }
        return None

    def _flush_buffer(self):
        """Bulk write buffer contents to Elasticsearch"""
        if not self.buffer:
            return

        from elasticsearch.helpers import bulk
        try:
            success, errors = bulk(
                self.es,
                self.buffer,
                raise_on_error=False,
            )
            if errors:
                print(f"Bulk errors: {len(errors)} items")
            print(f"Flush complete: {success} items processed")
        except Exception as e:
            print(f"Bulk write error: {e}")
        finally:
            self.buffer = []


# Usage example
if __name__ == "__main__":
    kafka_config = {
        "bootstrap.servers": "kafka:9092",
        "group.id": "search-index-consumer",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    }
    es_client = Elasticsearch(["http://elasticsearch:9200"])
    consumer = SearchIndexConsumer(kafka_config, es_client)
    consumer.start(["dbserver1.public.products"])
```

---

## 4. Search Quality Improvement Techniques

### 4.1 Metrics for Evaluating Search Quality

Understanding the main metrics for objectively evaluating search quality.

```
Search quality evaluation metrics:

  ┌────────────────┬──────────────────────────────────────────────┐
  │ Metric         │ Description                                  │
  ├────────────────┼──────────────────────────────────────────────┤
  │ Precision@K    │ Ratio of relevant documents in top K results  │
  │                │ = (number of relevant docs in K) / K          │
  │                │ Example: 7 out of Top-10 are relevant → P@10 = 0.7 │
  ├────────────────┼──────────────────────────────────────────────┤
  │ Recall@K       │ Ratio of all relevant docs found in top K     │
  │                │ = (number of relevant docs in K) / (total relevant docs) │
  ├────────────────┼──────────────────────────────────────────────┤
  │ MRR            │ Mean Reciprocal Rank                         │
  │                │ = 1/N × Σ(1/rank_i)                         │
  │                │ Emphasizes the rank of the first relevant document │
  │                │ Example: relevant doc at rank 3 → RR = 1/3   │
  ├────────────────┼──────────────────────────────────────────────┤
  │ nDCG           │ Normalized Discounted Cumulative Gain        │
  │                │ Cumulative gain discounted by rank position   │
  │                │ Supports multi-level relevance judgments      │
  │                │ nDCG@10 >= 0.7 is a common target            │
  ├────────────────┼──────────────────────────────────────────────┤
  │ CTR            │ Click Through Rate                           │
  │                │ = searches with clicks / total searches       │
  │                │ Online metric; 30-60% is healthy             │
  ├────────────────┼──────────────────────────────────────────────┤
  │ Zero Result    │ Ratio of search queries returning 0 results   │
  │ Rate           │ < 5% is the target                           │
  └────────────────┴──────────────────────────────────────────────┘
```

### 4.2 Query Rewriting

Rather than passing the user's query directly to the search engine, preprocessing it can significantly improve search quality.

```python
# Code Example 8: Query rewriting pipeline
import re
from typing import List, Tuple


class QueryRewriter:
    """Preprocesses and rewrites search queries"""

    def __init__(self):
        self.spelling_corrections = {
            "gogle": "Google",
            "amazn": "Amazon",
            "microsft": "Microsoft",
        }
        self.query_expansions = {
            "laptop": ["laptop", "notebook computer", "notebook PC"],
            "earphones": ["earphones", "earbuds", "headphones"],
        }
        self.stop_patterns = [
            r"I('m|'m)?\s*(looking|searching)\s*(for)?",
            r"(I\s*)?(want|need|would like)\s*(a|an|the)?",
            r"best\s+",
        ]

    def rewrite(self, query: str) -> dict:
        """
        Analyze the query and return the rewritten result.

        Returns:
            {
                "original": original query,
                "rewritten": rewritten query,
                "expansions": expanded queries,
                "corrections": list of corrections made,
            }
        """
        corrections = []
        rewritten = query.strip()

        # Step 1: Remove natural language patterns
        for pattern in self.stop_patterns:
            cleaned = re.sub(pattern, "", rewritten, flags=re.IGNORECASE).strip()
            if cleaned != rewritten:
                corrections.append(
                    f"Pattern removed: '{rewritten}' → '{cleaned}'"
                )
                rewritten = cleaned

        # Step 2: Spelling correction
        for wrong, correct in self.spelling_corrections.items():
            if wrong in rewritten.lower():
                rewritten = rewritten.replace(wrong, correct)
                corrections.append(f"Spelling corrected: {wrong} → {correct}")

        # Step 3: Query expansion
        expansions = [rewritten]
        for term, expanded in self.query_expansions.items():
            if term in rewritten.lower():
                expansions = expanded
                corrections.append(f"Query expanded: {term} → {expanded}")

        return {
            "original": query,
            "rewritten": rewritten,
            "expansions": expansions,
            "corrections": corrections,
        }


# Usage example
rewriter = QueryRewriter()
result = rewriter.rewrite("I'm looking for a laptop")
# → {
#     "original": "I'm looking for a laptop",
#     "rewritten": "laptop",
#     "expansions": ["laptop", "notebook computer", "notebook PC"],
#     "corrections": [
#         "Pattern removed: 'I'm looking for a laptop' → 'laptop'",
#         "Query expanded: laptop → ['laptop', 'notebook computer', 'notebook PC']"
#     ]
# }
```

### 4.3 Learning to Rank (LTR)

When BM25 alone cannot achieve optimal ranking, Learning to Rank (LTR) is a technique that uses machine learning to build a ranking model.

```
Learning to Rank Architecture:

  ┌── Offline (Model Training) ────────────────────────┐
  │                                                    │
  │  [Search Logs] ─→ [Click Data] ─→ [Judgment List]  │
  │                                                    │
  │  Judgment List example:                            │
  │  query="laptop", doc_id=123, grade=3 (Perfect)     │
  │  query="laptop", doc_id=456, grade=2 (Good)        │
  │  query="laptop", doc_id=789, grade=0 (Bad)         │
  │                                                    │
  │  [Feature Extraction]                              │
  │    - BM25 score                                    │
  │    - Title match score                             │
  │    - Product rating                                │
  │    - Review count                                  │
  │    - Price                                         │
  │    - Sales volume                                  │
  │    - Click count                                   │
  │                                                    │
  │  [LambdaMART / RankNet / LambdaRank]               │
  │       ↓                                            │
  │  [Trained Model]                                   │
  └────────┬───────────────────────────────────────────┘
           │
  ┌────────v── Online (Inference) ─────────────────────┐
  │                                                    │
  │  Query → [Retrieve 100 candidates with BM25]       │
  │       → [Feature extraction]                       │
  │       → [Rescore with LTR model]                   │
  │       → [Return reranked results]                  │
  │                                                    │
  │  Elasticsearch LTR Plugin:                         │
  │  POST products/_search                             │
  │  {                                                 │
  │    "query": { ... },                               │
  │    "rescore": {                                    │
  │      "window_size": 100,                           │
  │      "query": {                                    │
  │        "rescore_query": {                          │
  │          "sltr": {                                 │
  │            "model": "my_ltr_model",                │
  │            "params": { "query": "laptop" }         │
  │          }                                         │
  │        }                                           │
  │      }                                             │
  │    }                                               │
  │  }                                                 │
  └────────────────────────────────────────────────────┘
```

---

## 5. Comparison Tables

### 5.1 Search Engine Comparison

| Property | Elasticsearch | Apache Solr | Meilisearch | Typesense | OpenSearch |
|------|:------------:|:-----------:|:-----------:|:---------:|:----------:|
| Base engine | Lucene | Lucene | Custom (Rust) | Custom (C++) | Lucene |
| License | SSPL / Elastic | Apache 2.0 | MIT | GPL v3 | Apache 2.0 |
| Japanese support | kuromoji | kuromoji | Lindera | Basic | kuromoji |
| Real-time search | Within 1 second | Within 1 second | Immediate | Immediate | Within 1 second |
| Distributed scale | Native | SolrCloud | Limited | Limited | Native |
| Operational complexity | High | High | Low | Low | High |
| Ecosystem | Kibana, Logstash | Banana | Dashboard | Dashboard | OpenSearch Dashboards |
| Managed service | Elastic Cloud, AWS | None | Meilisearch Cloud | Typesense Cloud | AWS OpenSearch |
| Best use case | Large-scale full-text search & log analysis | Enterprise | Small/medium scale, fast suggest | Small/medium scale, typo tolerance | Large-scale (OSS requirement) |

### 5.2 Comparison of Search Feature Implementation Methods

| Search feature | Implementation method | Effect | Implementation difficulty |
|---------|---------|------|-----------|
| Fuzzy search | fuzziness: "AUTO" | Tolerates typos (1-2 characters) | Low |
| Synonym expansion | synonym filter | Handles spelling variations | Low |
| Field boosting | fields: ["title^3"] | Field weight assignment | Low |
| Highlighting | highlight API | Emphasize matching sections | Low |
| Faceted search | aggregations | Display counts by category | Medium |
| Autocomplete | completion suggester | Input completion | Medium |
| Geo search | geo_point + geo_distance | Distance-based search | Medium |
| Function Score | function_score query | Reflect business logic | Medium |
| Query rewriting | Pre-processing in app layer | Improved search accuracy | High |
| Learning to Rank | LTR plugin | ML-based ranking | High |

### 5.3 Field Type Selection for Index Design

| Use case | Field type | Reason |
|------------|----------------|------|
| Full-text search target | text | Tokenized and indexed |
| Filter / sort / aggregation | keyword | Exact match, fast |
| Numeric filter | integer / float | Range search, sorting |
| Date/time filter | date | Range search, time series |
| Location data | geo_point | Distance search |
| Input completion | completion | Prefix search |
| Store only (no search needed) | object + enabled:false | Storage savings |
| Nested objects | nested | Independent search within objects |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Relying on RDB for Full-Text Search

```sql
-- BAD: LIKE search cannot use indexes
SELECT * FROM products
WHERE name LIKE '%Tokyo%' OR description LIKE '%Tokyo%';
-- → Full table scan
-- → 2-5 seconds for 1M rows, does not scale
-- → No morphological analysis, no ranking

-- BAD: MySQL FULLTEXT is also weak for CJK (Japanese)
SELECT * FROM products
WHERE MATCH(name, description)
AGAINST('Tokyo sightseeing' IN BOOLEAN MODE);
-- → No morphological analysis (ngram only)
-- → Low accuracy, no synonym support
-- → Faceted search not possible
```

```python
# OK: Use a dedicated search engine
#
# Architecture:
#   DB (PostgreSQL) --- CDC (Debezium) ---> Kafka ---> Elasticsearch
#
# Benefits:
#   - Morphological analysis (kuromoji) for accurate tokenization
#   - BM25 ranking puts most relevant results first
#   - Full support for faceted search, suggest, and highlighting
#   - Horizontally scalable (sharding)
#
# DB is maintained as SSOT (Single Source of Truth),
# Elasticsearch is positioned as a read model for search only

result = es.search(
    index="products",
    body={
        "query": {
            "multi_match": {
                "query": "Tokyo sightseeing",
                "fields": ["title^3", "description"],
                "analyzer": "ja_search_analyzer",
            }
        },
        "highlight": {"fields": {"title": {}, "description": {}}},
        "aggs": {"categories": {"terms": {"field": "category"}}},
    }
)
```

### Anti-Pattern 2: Relying on Dynamic Mapping

```python
# BAD: Indexing documents without defining mapping
es.index(index="products", body={
    "name": "Test Product",        # → text + keyword (indexed both ways)
    "price": 1000,                 # → long (integer is sufficient)
    "description": "Test description",  # → text + keyword (keyword unnecessary)
    "internal_notes": "Internal memo",  # → text + keyword (not needed for search)
    "created_at": "2024-01-15",    # → date (correct but by accident)
})
# Problems:
#   - All fields are indexed as both text and keyword
#   - Storage doubles or more
#   - Indexing speed degrades
#   - Unnecessary fields become searchable
```

```python
# OK: Design explicit mappings upfront
# (See index mapping design in Section 3.1)
#
# Design principles:
#   - Fields for search: text + appropriate analyzer
#   - For filter/sort/aggregation: keyword
#   - Numeric: integer / float (choose smallest sufficient type)
#   - Fields not needing search: enabled: false
#   - dynamic: "strict" to reject unknown fields

index_settings = {
    "mappings": {
        "dynamic": "strict",  # Unknown fields cause an error
        "properties": {
            "title": {
                "type": "text",
                "analyzer": "ja_analyzer",
            },
            "price": {"type": "integer"},
            "metadata": {
                "type": "object",
                "enabled": False,   # Not indexed
            },
        }
    }
}
```

### Anti-Pattern 3: Expanding Synonyms at Index Time

```python
# BAD: Synonym expansion at index time
index_settings = {
    "settings": {
        "analysis": {
            "analyzer": {
                "my_analyzer": {
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": ["synonym_filter"],  # Synonym expansion at index time
                }
            },
            "filter": {
                "synonym_filter": {
                    "type": "synonym",
                    "synonyms": ["PC, personal computer, computer"]
                }
            }
        }
    }
}
# Problems:
#   - Every synonym dictionary update requires full re-indexing of all documents
#   - Index size bloats
#   - Re-indexing 1 million documents can take hours
```

```python
# OK: Synonym expansion at search time only
index_settings = {
    "settings": {
        "analysis": {
            "analyzer": {
                "ja_index_analyzer": {     # At index time
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": ["kuromoji_baseform", "lowercase"]
                    # ← No synonym filter
                },
                "ja_search_analyzer": {    # At search time
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": [
                        "kuromoji_baseform",
                        "lowercase",
                        "synonym_filter",  # ← Synonym expansion at search time only
                    ]
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "title": {
                "type": "text",
                "analyzer": "ja_index_analyzer",       # At index time
                "search_analyzer": "ja_search_analyzer" # At search time
            }
        }
    }
}
# Benefits:
#   - Updating the synonym dictionary only requires reloading the analyzer
#   - No re-indexing required
#   - Smaller index size
```

---

## 7. Operations and Monitoring

### 7.1 Monitoring the Elasticsearch Cluster

```
Metrics to watch in cluster monitoring:

  ┌────────────────────┬──────────────────┬──────────────────────┐
  │ Metric             │ Normal value     │ Alert threshold      │
  ├────────────────────┼──────────────────┼──────────────────────┤
  │ Cluster Status     │ green            │ yellow/red           │
  │ JVM Heap usage     │ < 75%            │ > 85%                │
  │ CPU usage          │ < 70%            │ > 85%                │
  │ Disk usage         │ < 80%            │ > 85% (watermark)    │
  │ Search Latency p99 │ < 500ms          │ > 1000ms             │
  │ Index Latency p99  │ < 200ms          │ > 500ms              │
  │ GC frequency       │ < 5 times/min    │ > 10 times/min       │
  │ Circuit Breaker    │ trip = 0         │ trip > 0             │
  │ Pending Tasks      │ < 5              │ > 20                 │
  │ Rejected Threads   │ 0                │ > 0                  │
  └────────────────────┴──────────────────┴──────────────────────┘
```

### 7.2 Performance Tuning Checklist

```
Performance tuning:

  Indexing optimization:
  ┌────────────────────────────────────────────────────────────┐
  │ 1. refresh_interval: "30s" (use "-1" during bulk indexing) │
  │ 2. number_of_replicas: 0 (disable during bulk operations)  │
  │ 3. Use Bulk API (do not index one document at a time)      │
  │ 4. chunk_size: 500-1000 (adjust based on network conditions)│
  │ 5. Increase translog.flush_threshold_size to "1gb"         │
  └────────────────────────────────────────────────────────────┘

  Search optimization:
  ┌────────────────────────────────────────────────────────────┐
  │ 1. Put filter clauses in bool/filter (they are cached)     │
  │ 2. Use _source filtering to exclude unnecessary fields     │
  │ 3. Keep size minimal (do not fetch all documents)          │
  │ 4. Replace scroll API with search_after (for large fetches)│
  │ 5. doc_values: true (for sort and aggregation fields)      │
  │ 6. Avoid fielddata (use keyword instead of text for sort)  │
  └────────────────────────────────────────────────────────────┘

  Cluster optimization:
  ┌────────────────────────────────────────────────────────────┐
  │ 1. JVM Heap: 50% of physical memory, but no more than 32GB │
  │ 2. Use remaining 50% for filesystem cache                  │
  │ 3. Use SSD (5-10x faster than HDD)                        │
  │ 4. Separate master / data / coordinator nodes              │
  │ 5. force_merge: merge segments for read-only indexes       │
  └────────────────────────────────────────────────────────────┘
```

---

## 8. Practical Exercises

### Exercise 1: Basic -- Manually Building an Inverted Index

**Task**: From the following three documents, manually build an inverted index and determine the results of search queries.

```
Documents:
  Doc1: "Developing web applications with Python"
  Doc2: "Python data analysis library Pandas"
  Doc3: "Building REST APIs with the Django web framework"

Questions:
(a) Tokenize each document (remove stop words "with", "the")
(b) Build the inverted index
(c) What is the result of an AND search for "Python web"?
(d) What is the result of an OR search for "Python web"?
(e) Estimate the BM25 score for each document
    (assuming k1=1.2, b=0.75, avgdl=5)
```

**Expected output**:

```
(a) Tokenization result:
  Doc1: ["Python", "web", "applications", "developing"]
  Doc2: ["Python", "data", "analysis", "library", "Pandas"]
  Doc3: ["web", "framework", "Django", "REST", "APIs", "building"]

(b) Inverted index:
  "Python"      → [Doc1, Doc2]
  "web"         → [Doc1, Doc3]
  "applications"→ [Doc1]
  "developing"  → [Doc1]
  "data"        → [Doc2]
  "analysis"    → [Doc2]
  "library"     → [Doc2]
  "Pandas"      → [Doc2]
  "framework"   → [Doc3]
  "Django"      → [Doc3]
  "REST"        → [Doc3]
  "APIs"        → [Doc3]
  "building"    → [Doc3]

(c) AND search "Python web":
  "Python" → {Doc1, Doc2}
  "web"    → {Doc1, Doc3}
  AND: {Doc1, Doc2} ∩ {Doc1, Doc3} = {Doc1}
  → Result: Doc1

(d) OR search "Python web":
  "Python" → {Doc1, Doc2}
  "web"    → {Doc1, Doc3}
  OR: {Doc1, Doc2} ∪ {Doc1, Doc3} = {Doc1, Doc2, Doc3}
  → Result: Doc1, Doc2, Doc3

(e) BM25 estimate (query "Python web"):
  N=3, avgdl=5

  IDF("Python") = log(1 + (3-2+0.5)/(2+0.5)) = log(1 + 0.6) ≈ 0.47
  IDF("web")    = log(1 + (3-2+0.5)/(2+0.5)) = log(1 + 0.6) ≈ 0.47

  Doc1 (|D|=4):
    score = 0.47 × (1×2.2)/(1+1.2×(1-0.75+0.75×4/5))
          + 0.47 × (1×2.2)/(1+1.2×(1-0.75+0.75×4/5))
          ≈ 0.47 × 1.02 + 0.47 × 1.02 ≈ 0.96

  Doc2 (|D|=4, no "web"):
    score = 0.47 × 1.02 + 0 ≈ 0.48

  Doc3 (|D|=6, no "Python"):
    score = 0 + 0.47 × (1×2.2)/(1+1.2×(1-0.75+0.75×6/5))
          ≈ 0 + 0.47 × 0.91 ≈ 0.43

  Ranking: Doc1 (0.96) > Doc2 (0.48) > Doc3 (0.43)
```

### Exercise 2: Applied -- Improving Elasticsearch Search Quality

**Task**: Make configuration changes to improve search quality for the following Elasticsearch index.

```python
"""
Context:
- Product search system (e-commerce site)
- 1 million product records
- The following problems were identified from search logs:
  1. Searching for "PC" does not match "personal computer"
  2. Searching for "iphon" (typo) returns 0 results
  3. Long product descriptions rank higher than short title matches
  4. New products get buried
  5. "Tokyo Skytree" is split into "Tokyo" and "Skytree"

Tasks:
(a) Write the synonym settings to solve problem 1
(b) Write the fuzzy search settings to solve problem 2
(c) Write the field boost settings to solve problem 3
(d) Write the Function Score settings to solve problem 4
(e) Write the user dictionary settings to solve problem 5
"""
```

**Expected output**:

```python
# (a) Synonym settings
synonym_settings = {
    "filter": {
        "synonym_filter": {
            "type": "synonym",
            "synonyms": [
                "PC, personal computer, computer, desktop computer",
                "smartphone, mobile phone, cellphone",
                "television, TV",
            ]
        }
    }
}

# (b) Fuzzy search (fuzziness: "AUTO" adjusts automatically based on length)
fuzzy_query = {
    "multi_match": {
        "query": "iphon",
        "fields": ["title^3", "description"],
        "fuzziness": "AUTO",        # 3-5 chars: edit distance 1, 6+ chars: distance 2
        "prefix_length": 1,         # First character must match
        "max_expansions": 50,
    }
}

# (c) Field boosting
boosted_query = {
    "multi_match": {
        "query": "laptop computer",
        "fields": [
            "title^5",          # Prioritize exact title match most
            "title.ngram^1",    # Title partial match
            "description^1",    # Description gets low weight
        ],
        "type": "best_fields",
    }
}

# (d) Freshness boost (Function Score)
freshness_query = {
    "function_score": {
        "query": {"match_all": {}},
        "functions": [
            {
                "gauss": {
                    "created_at": {
                        "origin": "now",
                        "scale": "14d",
                        "decay": 0.5,
                    }
                },
                "weight": 2,
            }
        ],
        "boost_mode": "multiply",
    }
}

# (e) User dictionary (kuromoji)
# Add the following to userdict.txt:
# TokyoSkytree,TokyoSkytree,TokyoSkytree,CustomNoun
user_dict_settings = {
    "tokenizer": {
        "kuromoji_user_dict": {
            "type": "kuromoji_tokenizer",
            "user_dictionary": "userdict.txt",
            "mode": "search",   # Split compound words in search mode
        }
    }
}
```

### Exercise 3: Advanced -- Designing a Distributed Search System

**Task**: Design the architecture of a search system that meets the following requirements.

```
Requirements:
- Target: Product search for an e-commerce site
- Number of products: 50 million
- Data size: 5KB average per product → 250GB total
- Search QPS: 10,000 QPS at peak
- Latency: p99 < 200ms
- Availability: 99.9%
- Japanese language support required

Things to design:
(a) Number of shards and replicas
(b) Node configuration (count, specs)
(c) Index update architecture
(d) Caching strategy
(e) Failure response plan
```

**Expected output**:

```
(a) Shard design:
  Data volume: 250GB
  Target shard size: 30GB
  Number of primary shards: 250 / 30 ≈ 9 → 10 shards
  Replica count: 2 (to ensure 99.9% availability)
  Total shards: 10 × (1 + 2) = 30

(b) Node configuration:
  Master Node: 3 (dedicated, small instances)
    - 4 vCPU, 8GB RAM
    - Cluster management only
  Data Node: 6
    - 16 vCPU, 64GB RAM (Heap: 30GB)
    - SSD: 500GB
    - 5 shards per node (30/6)
  Coordinator Node: 3
    - 8 vCPU, 32GB RAM
    - Execute Scatter-Gather
  Total: 12 nodes

(c) Index updates:
  Source DB (PostgreSQL)
    → Debezium CDC Connector
    → Kafka (3 brokers, partitions=10)
    → Index Worker (3 instances, Consumer Group)
    → Elasticsearch Bulk API

  Update latency: 1-3 seconds
  Throughput: 30,000 docs/sec (3 workers combined)

(d) Caching strategy:
  L1: Redis (search result cache)
    - Key: hash(query + filters + sort + page)
    - TTL: 60 seconds
    - Target hit rate: 40%
    - → 10,000 QPS × 0.4 = 4,000 QPS served from cache
    - → Actual QPS to ES: 6,000
  L2: ES Request Cache
    - Cache results of filter clauses
    - Automatically invalidated on refresh
  L3: ES Field Data Cache / doc_values
    - Sort and aggregation fields

(e) Failure response:
  - Node failure: 2 replicas allow automatic failover on 1 node failure
  - AZ failure: Distribute nodes across 3 AZs
                AZ-a: Data×2, Master×1, Coord×1
                AZ-b: Data×2, Master×1, Coord×1
                AZ-c: Data×2, Master×1, Coord×1
  - Index corruption: Daily restore from snapshot (S3)
  - Kafka failure: Replication=3, ISR=2
  - Circuit Breaker: ES memory circuit breaker prevents OOM
```

---

## 9. FAQ

### Q1. How do you determine the number of Elasticsearch shards?

**A.** The guideline is 10-50GB per shard (around 30GB recommended). Since the shard count cannot be changed later (Reindex is required), the initial design is critical. The specific steps are as follows:

1. Estimate current data volume and future growth rate
2. Calculate the number of primary shards using `data volume ÷ target shard size`
3. Adjust so heap usage stays below `heap size × 20 shards/GB`
4. Example: 500GB of data, 30GB/shard → 17 shards → round up to 20 shards

Note that too many shards increases coordinator Scatter-Gather overhead, while too few prevents rebalancing when nodes are added. For time-series data, setting a rollover policy with ILM (Index Lifecycle Management) to automatically split indexes daily or weekly is effective.

### Q2. How do you improve search relevance?

**A.** A gradual improvement approach is effective:

1. **Step 1 (quick wins)**: Analyzer optimization -- add synonym dictionaries, add user dictionaries (for proper nouns), adjust stop words
2. **Step 2 (medium-term)**: Field boosting -- high weight for title (`title^3`), medium weight for category (`tags^2`)
3. **Step 3 (medium-term)**: Function Score Query -- reflect popularity (`log1p(review_count)`), freshness (`gauss(created_at)`), and distance (`gauss(location)`) in scoring
4. **Step 4 (long-term)**: Search log analysis -- analyze zero-result queries → add synonyms, adjust ranking for low-CTR queries
5. **Step 5 (long-term)**: Learning to Rank -- build a machine learning model from clickthrough data to capture complex relevance that BM25 + Function Score cannot capture

### Q3. How do you rebuild an index?

**A.** Use the Alias pattern to rebuild without downtime:

1. Create a new index `products_v2` with the new mapping
2. Copy data from `products_v1` → `products_v2` using the Reindex API
3. Atomically switch alias `products` from `products_v1` → `products_v2`
4. Delete the old index `products_v1`

Clients always access via the alias name (`products`), so the switch is transparent. For large data volumes, using the `slices` parameter for parallel reindexing speeds up the process. See the `reindex_with_zero_downtime` function in Section 3.4 for a code example.

### Q4. How do you prevent data inconsistencies between Elasticsearch and RDB?

**A.** Using the CDC (Change Data Capture) pattern detects changes from the RDB transaction log (WAL), preventing data inconsistencies caused by application-layer bugs. However, the following measures are also needed:

1. **Consistency check jobs**: Periodically compare document counts and updated timestamps between RDB and ES
2. **Dead letter queue**: Move failed indexing events to a separate queue for later reprocessing
3. **Full rebuild**: Re-index all data monthly (resolves inconsistencies that incremental updates cannot fix)
4. **Idempotency**: Implement Index Worker idempotently (processing the same event twice produces the same result)

### Q5. How do you debug slow search performance?

**A.** Follow these steps to identify the cause:

1. **Profile API** to check execution time for each phase of a query
   ```
   POST products/_search
   { "profile": true, "query": { ... } }
   ```
2. **Slow Log** to enable and identify slow queries
   ```
   PUT products/_settings
   { "index.search.slowlog.threshold.query.warn": "1s" }
   ```
3. **Hot Threads API** to identify CPU bottlenecks
   ```
   GET _nodes/hot_threads
   ```
4. Common causes and solutions:
   - Leading `*` in wildcard queries → avoid
   - Heavy calculations in Script Score → optimize Painless scripts
   - Large number of aggregations → reduce to the minimum necessary
   - Returning massive `_source` → use `_source` filtering

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not only through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Points |
|------|---------|
| Inverted index | The core data structure of a search engine. Mapping from term → document list. Lucene uses FST + Skip List for speed |
| Analyzer | Pipeline of Character Filter → Tokenizer → Token Filter. kuromoji is essential for Japanese |
| BM25 | An improved version of TF-IDF. Achieves more natural ranking through TF saturation and document length normalization |
| Distributed search | Scatter-Gather pattern. Two phases: Query Phase + Fetch Phase. Shard count is the key to scaling |
| Elasticsearch | Large-scale full-text search engine based on Lucene. Japanese support via kuromoji, rich search DSL |
| Index updates | DB changes reflected asynchronously to ES via CDC (Debezium) + Kafka pipeline. Latency of 1-5 seconds |
| Search quality improvement | Incremental improvement: synonym dictionaries → boosting → Function Score → Query Rewriting → Learning to Rank |
| Operations | Zero-downtime rebuild with Alias pattern, time-series management with ILM, debugging with Profile API |

---

## Guides to Read Next

- [Rate Limiter Design](./03-rate-limiter.md) -- Rate limiting design for search APIs
- [Notification System Design](./02-notification-system.md) -- Implementing search alert notifications
- [CDN](../01-components/03-cdn.md) -- Caching strategies for search result pages
- [DB Scaling](../01-components/04-database-scaling.md) -- Scaling the data source (RDB)
- [Message Queue](../01-components/02-message-queue.md) -- Kafka design for CDC pipelines
- [Caching](../01-components/01-caching.md) -- Search result caching with Redis
- [Event-Driven Architecture](../02-architecture/03-event-driven.md) -- The foundation of CDC and event streaming
- [CQRS / Event Sourcing](../../../design-patterns-guide/docs/04-architectural/02-event-sourcing-cqrs.md) -- CQRS pattern viewing the search index as a read model

---

## References

1. **Elasticsearch: The Definitive Guide** -- Clinton Gormley & Zachary Tong (O'Reilly, 2015) -- Comprehensive reference for Elasticsearch
2. **Information Retrieval: Implementing and Evaluating Search Engines** -- Christopher Manning, Prabhakar Raghavan, Hinrich Schutze (Cambridge University Press, 2008) -- Theoretical foundation of information retrieval (inverted indexes, BM25, evaluation metrics)
3. **Relevant Search** -- Doug Turnbull & John Berryman (Manning, 2016) -- Practical guide to improving search relevance
4. **Elasticsearch Official Documentation** -- https://www.elastic.co/guide/ -- Reference for mappings, query DSL, and cluster management
5. **Apache Lucene Official Site** -- https://lucene.apache.org/ -- Specifications for Elasticsearch's internal engine
6. **Designing Data-Intensive Applications** -- Martin Kleppmann (O'Reilly, 2017) -- Theoretical foundation for distributed systems, CDC, and stream processing
