# Memory Systems

> Short-term memory, long-term memory, and RAG — design and implement memory architectures that allow AI agents to retain context and learn from past experience.

## What You Will Learn

1. The role and design of the three-layer memory model in agents (short-term, working, long-term)
2. Implementing scalable memory with RAG (Retrieval-Augmented Generation)
3. Criteria for selecting memory strategies and implementation patterns
4. Advanced memory architectures (knowledge graphs, episodic memory, semantic memory)
5. Operating and tuning memory systems in production environments


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Tool Use](./02-tool-use.md)

---

## 1. The Need for Memory

### 1.1 Problems with Agents That Have No Memory

```
Agent without memory:
  Turn 1: "My name is Tanaka" → "Hello, Tanaka"
  Turn 2: "What is my name?"  → "I don't know"  ← Forgot!

Agent with memory:
  Turn 1: "My name is Tanaka" → "Hello, Tanaka" [saved to memory]
  Turn 2: "What is my name?"  → "You are Tanaka" ← References memory
```

### 1.2 The Three-Layer Memory Model

```
Three-Layer Memory Model for Agents
+--------------------------------------------------------+
|                                                          |
|  +--------------------------------------------------+   |
|  |  Short-Term Memory                               |   |
|  |  - Current conversation history                  |   |
|  |  - Recent tool execution results                 |   |
|  |  - Lifespan: 1 session                          |   |
|  +--------------------------------------------------+   |
|                                                          |
|  +--------------------------------------------------+   |
|  |  Working Memory                                   |   |
|  |  - Current task plan                             |   |
|  |  - Scratchpad for intermediate results           |   |
|  |  - Lifespan: 1 task                             |   |
|  +--------------------------------------------------+   |
|                                                          |
|  +--------------------------------------------------+   |
|  |  Long-Term Memory                                 |   |
|  |  - User preferences and profile                  |   |
|  |  - Results of past tasks                         |   |
|  |  - Learned patterns                              |   |
|  |  - Lifespan: Persistent                         |   |
|  +--------------------------------------------------+   |
|                                                          |
+--------------------------------------------------------+
```

### 1.3 Correspondence with the Human Memory Model

```
Human Memory                  AI Agent Memory
+-----------------------+     +-----------------------+
| Sensory memory (secs)  | --> | Input buffer          |
| - Temporary visual/    |     | - Raw request         |
|   auditory retention   |     |                       |
+-----------------------+     +-----------------------+
| Short-term (tens secs) | --> | Context window        |
| - Memorizing a phone   |     | - Conversation history|
|   number              |     |                       |
+-----------------------+     +-----------------------+
| Working memory (s-min) | --> | Scratchpad            |
| - Temporary hold       |     | - Task intermediate   |
|   during mental math   |     |   results             |
+-----------------------+     +-----------------------+
| Long-term (persistent) | --> | Vector DB / Files     |
| - Episodic memory      |     | - Past conversation   |
| - Semantic memory      |     |   summaries           |
| - Procedural memory    |     | - Knowledge base      |
|                        |     | - Learned patterns    |
+-----------------------+     +-----------------------+
```

---

## 2. Implementing Short-Term Memory

### 2.1 Conversation Buffer

```python
# Simplest short-term memory: retain all history
class ConversationBufferMemory:
    def __init__(self):
        self.messages = []

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def get_context(self) -> list:
        return self.messages.copy()

    def clear(self):
        self.messages = []
```

### 2.2 Sliding Window

```python
# Retain only the last N messages
class SlidingWindowMemory:
    def __init__(self, window_size: int = 20):
        self.messages = []
        self.window_size = window_size

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        # Remove old messages that exceed the window
        if len(self.messages) > self.window_size:
            self.messages = self.messages[-self.window_size:]

    def get_context(self) -> list:
        return self.messages.copy()
```

### 2.3 Summary Memory

```python
# Compress old history by summarizing it
class SummaryMemory:
    def __init__(self, llm, max_tokens: int = 2000):
        self.llm = llm
        self.max_tokens = max_tokens
        self.summary = ""
        self.recent_messages = []

    def add(self, role: str, content: str):
        self.recent_messages.append({"role": role, "content": content})

        # Summarize when the token count exceeds the threshold
        if self._count_tokens() > self.max_tokens:
            self._compress()

    def _compress(self):
        """Merge old messages into the summary"""
        old_messages = self.recent_messages[:-4]  # Keep last 4 messages

        summary_prompt = f"""
Please summarize the following conversation history in 200 characters or less.
Preserve important facts, user requests, and decisions.

Existing summary: {self.summary}

New conversation:
{self._format_messages(old_messages)}
"""
        self.summary = self.llm.generate(summary_prompt)
        self.recent_messages = self.recent_messages[-4:]

    def get_context(self) -> list:
        context = []
        if self.summary:
            context.append({
                "role": "system",
                "content": f"Summary of the conversation so far: {self.summary}"
            })
        context.extend(self.recent_messages)
        return context
```

### 2.4 Token-Based Buffer

```python
# Short-term memory managed by token count
import tiktoken

class TokenBasedMemory:
    """Manages messages based on a maximum token count"""

    def __init__(self, max_tokens: int = 8000, model: str = "cl100k_base"):
        self.max_tokens = max_tokens
        self.messages = []
        self.encoder = tiktoken.get_encoding(model)

    def _count_tokens(self, messages: list) -> int:
        """Calculate the token count of a message list"""
        total = 0
        for msg in messages:
            total += len(self.encoder.encode(msg["content"]))
            total += 4  # Message overhead
        return total

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        self._trim()

    def _trim(self):
        """Remove old messages when the token limit is exceeded"""
        while (self._count_tokens(self.messages) > self.max_tokens
               and len(self.messages) > 2):  # Keep at least 2 messages
            # Preserve system messages
            if self.messages[0]["role"] == "system":
                self.messages.pop(1)
            else:
                self.messages.pop(0)

    def get_context(self) -> list:
        return self.messages.copy()

    def get_stats(self) -> dict:
        """Return memory usage statistics"""
        return {
            "message_count": len(self.messages),
            "total_tokens": self._count_tokens(self.messages),
            "max_tokens": self.max_tokens,
            "usage_percent": (
                self._count_tokens(self.messages) / self.max_tokens * 100
            )
        }
```

### 2.5 Hybrid Short-Term Memory

```python
# Hybrid of summary + sliding window
class HybridShortTermMemory:
    """Combines summary memory and sliding window"""

    def __init__(self, llm, window_size: int = 10,
                 max_summary_length: int = 500):
        self.llm = llm
        self.window_size = window_size
        self.max_summary_length = max_summary_length
        self.summary = ""
        self.messages = []
        self.important_facts = []  # Store important facts separately

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

        # Automatically extract important facts
        if role == "user":
            self._extract_facts(content)

        # Summarize when the window is exceeded
        if len(self.messages) > self.window_size:
            overflow = self.messages[:-self.window_size]
            self._update_summary(overflow)
            self.messages = self.messages[-self.window_size:]

    def _extract_facts(self, content: str):
        """Extract important facts from user input"""
        fact_indicators = [
            "my name is", "I am", "I like", "I dislike",
            "I use", "project", "company"
        ]
        if any(indicator in content for indicator in fact_indicators):
            self.important_facts.append(content)
            # Deduplicate (keep up to 10 most recent)
            self.important_facts = list(set(self.important_facts))[-10:]

    def _update_summary(self, overflow_messages: list):
        """Merge overflowed messages into the summary"""
        messages_text = "\n".join(
            f"{m['role']}: {m['content']}" for m in overflow_messages
        )
        prompt = f"""Please update the existing summary.
Existing summary: {self.summary}
New conversation:
{messages_text}
Summarize in {self.max_summary_length} characters or less:"""
        self.summary = self.llm.generate(prompt)

    def get_context(self) -> list:
        context = []
        if self.summary:
            context.append({
                "role": "system",
                "content": f"Conversation summary: {self.summary}"
            })
        if self.important_facts:
            context.append({
                "role": "system",
                "content": f"Important facts:\n" + "\n".join(
                    f"- {f}" for f in self.important_facts
                )
            })
        context.extend(self.messages)
        return context
```

---

## 3. Long-Term Memory and RAG

### 3.1 RAG Architecture

```
RAG (Retrieval-Augmented Generation) Flow

1. Index Building (Offline)
+----------+    Chunking      +---------+   Embedding   +----------+
| Documents|--------------->| Text    |-------------->| Vector   |
|          |               | Chunks   |              | DB       |
+----------+               +---------+              +----------+

2. Retrieval and Generation (Online)
+--------+   Query    +---------+   Search  +----------+
|  User  |--------->| Embedding|-------->| Vector   |
|        |          | Model    |         | DB       |
+--------+          +---------+         +----+-----+
     ^                                       |
     |              +---------+              | Top-K results
     +------<-------|   LLM   |<------<------+
        Answer      |Generate |   Context + Query
                    +---------+
```

### 3.2 RAG Implementation

```python
# Long-term memory implementation using RAG
from sentence_transformers import SentenceTransformer
import chromadb
import uuid

class RAGMemory:
    def __init__(self, collection_name: str = "agent_memory"):
        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        self.client = chromadb.PersistentClient(path="./memory_db")
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def store(self, text: str, metadata: dict = None):
        """Vectorize and store text"""
        embedding = self.embedder.encode(text).tolist()
        self.collection.add(
            ids=[str(uuid.uuid4())],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata or {}]
        )

    def retrieve(self, query: str, top_k: int = 5) -> list[str]:
        """Search for memories similar to the query"""
        query_embedding = self.embedder.encode(query).tolist()
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        return results["documents"][0]

    def retrieve_with_filter(self, query: str, filter_metadata: dict,
                              top_k: int = 5) -> list[str]:
        """Search with metadata filtering"""
        query_embedding = self.embedder.encode(query).tolist()
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter_metadata
        )
        return results["documents"][0]

# Usage example
memory = RAGMemory()

# Store past task results
memory.store(
    "The user prefers Python's FastAPI and prioritizes it over Flask",
    metadata={"type": "preference", "user": "tanaka"}
)

memory.store(
    "Project X deployment is configured with AWS ECS + Fargate",
    metadata={"type": "fact", "project": "X"}
)

# Search
relevant = memory.retrieve("What is the infrastructure configuration for this project?")
print(relevant)
```

### 3.3 Chunking Strategies

```python
# Text chunking strategies
from typing import Generator

def chunk_by_tokens(text: str, chunk_size: int = 500,
                     overlap: int = 50) -> Generator[str, None, None]:
    """Token-count-based chunking (with overlap)"""
    words = text.split()
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            yield chunk

def chunk_by_semantic(text: str) -> list[str]:
    """Semantic chunking"""
    # Split at boundaries such as paragraphs, headings, code blocks
    import re
    sections = re.split(r'\n#{1,3}\s|\n\n\n', text)
    return [s.strip() for s in sections if s.strip()]

def chunk_by_recursive(text: str, max_size: int = 1000) -> list[str]:
    """Recursive chunking (LangChain style)"""
    separators = ["\n\n", "\n", ". ", " ", ""]

    for sep in separators:
        if len(text) <= max_size:
            return [text]

        parts = text.split(sep)
        chunks = []
        current = ""

        for part in parts:
            if len(current) + len(part) + len(sep) <= max_size:
                current += (sep if current else "") + part
            else:
                if current:
                    chunks.append(current)
                current = part

        if current:
            chunks.append(current)

        if all(len(c) <= max_size for c in chunks):
            return chunks

    return [text[:max_size]]
```

### 3.4 Hybrid Search

```python
# Hybrid of vector search + keyword search
from rank_bm25 import BM25Okapi
import numpy as np

class HybridRetriever:
    """Hybrid search combining vector search and BM25"""

    def __init__(self, embedder, vector_store):
        self.embedder = embedder
        self.vector_store = vector_store
        self.documents = []
        self.bm25 = None

    def add_documents(self, documents: list[str], metadatas: list[dict] = None):
        """Add documents"""
        self.documents.extend(documents)

        # Rebuild BM25 index
        tokenized = [doc.split() for doc in self.documents]
        self.bm25 = BM25Okapi(tokenized)

        # Also add to vector DB
        for i, doc in enumerate(documents):
            self.vector_store.store(
                doc,
                metadata=metadatas[i] if metadatas else {}
            )

    def search(self, query: str, top_k: int = 5,
               vector_weight: float = 0.7) -> list[dict]:
        """Hybrid search (RRF fusion)"""
        # Vector search
        vector_results = self.vector_store.retrieve_with_scores(query, top_k=top_k * 2)

        # BM25 search
        tokenized_query = query.split()
        bm25_scores = self.bm25.get_scores(tokenized_query)
        bm25_top = np.argsort(bm25_scores)[-top_k * 2:][::-1]

        # Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        k = 60  # RRF parameter

        for rank, (doc, score) in enumerate(vector_results):
            rrf_scores[doc] = rrf_scores.get(doc, 0) + vector_weight / (k + rank + 1)

        for rank, idx in enumerate(bm25_top):
            doc = self.documents[idx]
            rrf_scores[doc] = rrf_scores.get(doc, 0) + (1 - vector_weight) / (k + rank + 1)

        # Sort by score
        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        return [{"document": doc, "score": score} for doc, score in sorted_results[:top_k]]
```

### 3.5 Reranking

```python
# Reranking with Cross-Encoder
from sentence_transformers import CrossEncoder

class Reranker:
    """Rerank search results with Cross-Encoder"""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, documents: list[str],
               top_k: int = 5) -> list[dict]:
        """Rerank documents"""
        # Create query-document pairs
        pairs = [(query, doc) for doc in documents]

        # Scoring
        scores = self.model.predict(pairs)

        # Sort by score
        scored_docs = list(zip(documents, scores))
        scored_docs.sort(key=lambda x: x[1], reverse=True)

        return [
            {"document": doc, "score": float(score)}
            for doc, score in scored_docs[:top_k]
        ]

# Usage example: search → rerank
retriever = HybridRetriever(embedder, vector_store)
reranker = Reranker()

# Stage 1: Get candidates via hybrid search
candidates = retriever.search(query, top_k=20)
candidate_docs = [c["document"] for c in candidates]

# Stage 2: High-accuracy reranking with Cross-Encoder
final_results = reranker.rerank(query, candidate_docs, top_k=5)
```

---

## 4. Knowledge Graph Memory

### 4.1 Knowledge Graph Structure

```
Knowledge Graph Memory

  [Tanaka] --belongs to--> [Engineering Dept]
    |                           |
    |--uses language-->   [Python]
    |                           |
    |--prefers-->         [FastAPI] --category--> [Web Framework]
    |                                                  |
    |--in charge of-->  [Project X] --uses--> [AWS ECS]
    |                           |
    v                           v
  [senior]              [Started Q3 2024]
```

### 4.2 Implementing Knowledge Graph Memory

```python
# Knowledge graph-based memory system
from dataclasses import dataclass
from collections import defaultdict
import json

@dataclass
class Triple:
    """A knowledge graph triple (subject-predicate-object)"""
    subject: str
    predicate: str
    object: str
    confidence: float = 1.0
    timestamp: float = 0.0

class KnowledgeGraphMemory:
    """Long-term memory based on a knowledge graph"""

    def __init__(self, llm=None):
        self.triples: list[Triple] = []
        self.entity_index = defaultdict(list)  # Entity → triple index
        self.llm = llm

    def add_triple(self, subject: str, predicate: str, obj: str,
                   confidence: float = 1.0):
        """Add a triple"""
        import time
        triple = Triple(
            subject=subject.lower(),
            predicate=predicate.lower(),
            object=obj.lower(),
            confidence=confidence,
            timestamp=time.time()
        )
        self.triples.append(triple)
        self.entity_index[subject.lower()].append(triple)
        self.entity_index[obj.lower()].append(triple)

    def extract_and_store(self, text: str):
        """Automatically extract knowledge from text and store it"""
        if not self.llm:
            raise ValueError("LLM is required")

        prompt = f"""Extract facts from the following text in triple format.

Text: {text}

Output in JSON format:
[{{"subject": "...", "predicate": "...", "object": "..."}}]

Example:
"Tanaka is good at Python" → [{{"subject": "Tanaka", "predicate": "is good at", "object": "Python"}}]
"""
        response = self.llm.generate(prompt)
        triples = json.loads(response)
        for t in triples:
            self.add_triple(t["subject"], t["predicate"], t["object"])

    def query(self, entity: str) -> list[Triple]:
        """Search for triples related to an entity"""
        return self.entity_index.get(entity.lower(), [])

    def query_relation(self, subject: str = None, predicate: str = None,
                       obj: str = None) -> list[Triple]:
        """Search for triples matching the conditions"""
        results = self.triples
        if subject:
            results = [t for t in results if t.subject == subject.lower()]
        if predicate:
            results = [t for t in results if t.predicate == predicate.lower()]
        if obj:
            results = [t for t in results if t.object == obj.lower()]
        return results

    def get_subgraph(self, entity: str, depth: int = 2) -> list[Triple]:
        """Get a subgraph centered on an entity"""
        visited = set()
        result = []
        queue = [(entity.lower(), 0)]

        while queue:
            current, d = queue.pop(0)
            if current in visited or d > depth:
                continue
            visited.add(current)

            related = self.entity_index.get(current, [])
            result.extend(related)

            for triple in related:
                if triple.subject not in visited:
                    queue.append((triple.subject, d + 1))
                if triple.object not in visited:
                    queue.append((triple.object, d + 1))

        return result

    def to_context_string(self, entity: str, depth: int = 1) -> str:
        """Output entity knowledge as a context string"""
        triples = self.get_subgraph(entity, depth)
        if not triples:
            return f"No information found for {entity}."

        lines = []
        for t in triples:
            lines.append(f"- {t.subject} {t.predicate} {t.object}")
        return f"Knowledge about {entity}:\n" + "\n".join(lines)

# Usage example
kg = KnowledgeGraphMemory(llm=llm)
kg.add_triple("Tanaka", "belongs to", "Engineering Dept")
kg.add_triple("Tanaka", "uses language", "Python")
kg.add_triple("Tanaka", "preferred framework", "FastAPI")
kg.add_triple("Project X", "uses infrastructure", "AWS ECS")
kg.add_triple("Tanaka", "in charge of", "Project X")

# Get information about Tanaka
context = kg.to_context_string("Tanaka")
print(context)
# → Knowledge about Tanaka:
#    - tanaka belongs to engineering dept
#    - tanaka uses language python
#    - tanaka preferred framework fastapi
#    - tanaka in charge of project x
```

---

## 5. Episodic Memory

### 5.1 Designing Episodic Memory

```
Episodic Memory: Store past "experiences" in chronological order

Episode 1 (2024-01-15):
  Task: "Create a CRUD API with FastAPI"
  Result: Success
  Lessons learned: "Combining with SQLAlchemy is efficient"
  Difficulties: "Async session management"

Episode 2 (2024-01-16):
  Task: "Add JWT authentication to the API"
  Result: Success (on the 2nd attempt)
  Lessons learned: "PyJWT is simpler than python-jose"
  Difficulties: "Token refresh logic"

→ When a similar situation is encountered in a new task, refer to past episodes
```

### 5.2 Implementing Episodic Memory

```python
# Episodic memory: learn from past experiences
from dataclasses import dataclass, field
from datetime import datetime
import json

@dataclass
class Episode:
    """A single task execution episode"""
    task: str
    actions: list[str]
    result: str
    success: bool
    lessons_learned: list[str]
    difficulties: list[str]
    timestamp: datetime = field(default_factory=datetime.now)
    duration_seconds: float = 0.0
    tags: list[str] = field(default_factory=list)

class EpisodicMemory:
    """Episodic memory: store and retrieve past experiences"""

    def __init__(self, rag_memory: RAGMemory):
        self.episodes: list[Episode] = []
        self.rag = rag_memory

    def record_episode(self, episode: Episode):
        """Record an episode"""
        self.episodes.append(episode)

        # Also index in RAG
        episode_text = (
            f"Task: {episode.task}\n"
            f"Result: {'Success' if episode.success else 'Failure'}\n"
            f"Lessons: {', '.join(episode.lessons_learned)}\n"
            f"Difficulties: {', '.join(episode.difficulties)}"
        )
        self.rag.store(episode_text, metadata={
            "type": "episode",
            "success": episode.success,
            "timestamp": episode.timestamp.isoformat(),
            "tags": ",".join(episode.tags)
        })

    def recall_similar(self, current_task: str,
                       top_k: int = 3) -> list[Episode]:
        """Recall past episodes similar to the current task"""
        similar_texts = self.rag.retrieve(current_task, top_k=top_k)
        # Restore episodes from text
        recalled = []
        for text in similar_texts:
            for episode in self.episodes:
                if episode.task in text:
                    recalled.append(episode)
                    break
        return recalled

    def get_lessons_for_task(self, task: str) -> str:
        """Return a summary of past lessons related to the task"""
        similar = self.recall_similar(task, top_k=5)
        if not similar:
            return "No related past episodes found."

        lessons = []
        for ep in similar:
            if ep.success:
                lessons.append(f"[Success] {ep.task}: {', '.join(ep.lessons_learned)}")
            else:
                lessons.append(f"[Failure] {ep.task}: {', '.join(ep.difficulties)}")

        return "Lessons from past episodes:\n" + "\n".join(lessons)

    def get_success_rate(self, tag: str = None) -> float:
        """Calculate success rate"""
        episodes = self.episodes
        if tag:
            episodes = [e for e in episodes if tag in e.tags]
        if not episodes:
            return 0.0
        return sum(1 for e in episodes if e.success) / len(episodes)
```

---

## 6. Comparing Memory Strategies

### 6.1 Short-Term Memory Pattern Comparison

| Pattern | Memory Usage | Context Retention | Cost | Use Case |
|---------|-------------|-------------------|------|----------|
| Full history buffer | High (linear growth) | Complete | High | Short conversations |
| Sliding window | Fixed | Recent only | Medium | General dialogue |
| Summary memory | Low | Compressed summary | Medium (summary cost) | Long conversations |
| Token-limited buffer | Fixed | Within limit | Medium | API limit awareness |
| Hybrid | Medium | Summary + recent | Medium | Balance-oriented |

### 6.2 Long-Term Memory Store Comparison

| Store | Search Method | Scalability | Cost | Representative Products |
|-------|--------------|-------------|------|------------------------|
| Vector DB | Semantic | High | Medium-High | Pinecone, Chroma |
| Key-Value | Exact match | High | Low | Redis, DynamoDB |
| Graph DB | Relationships | Medium | Medium | Neo4j |
| RDBMS | SQL | High | Low-Medium | PostgreSQL + pgvector |
| File | Full-text search | Low | Lowest | JSON, SQLite |

### 6.3 Memory Architecture Selection Flowchart

```
Memory Architecture Selection

Q1: Will the conversation last a long time?
├── NO → A full history buffer is sufficient
└── YES
    Q2: Is information from past sessions needed?
    ├── NO → Summary memory or sliding window
    └── YES
        Q3: Are relationships between entities important?
        ├── YES → Knowledge graph + Vector DB
        └── NO
            Q4: How much data?
            ├── Small (~10K entries)  → ChromaDB (local)
            ├── Medium (~1M entries)  → PostgreSQL + pgvector
            └── Large (1M+ entries)  → Pinecone / Milvus
```

---

## 7. Integrated Memory System

```python
# Memory system integrating short-term and long-term
class IntegratedMemory:
    def __init__(self, llm, rag_memory: RAGMemory):
        self.short_term = SummaryMemory(llm)
        self.working = {}  # Task-specific working area
        self.long_term = rag_memory

    def add_conversation(self, role: str, content: str):
        """Add a conversation to short-term memory"""
        self.short_term.add(role, content)

    def add_fact(self, fact: str, metadata: dict = None):
        """Save a fact to long-term memory"""
        self.long_term.store(fact, metadata)

    def set_working(self, key: str, value):
        """Save temporary data to working memory"""
        self.working[key] = value

    def get_context(self, current_query: str) -> dict:
        """Return an integrated context for the current state"""
        return {
            "conversation": self.short_term.get_context(),
            "relevant_memories": self.long_term.retrieve(current_query, top_k=3),
            "working_data": self.working
        }

    def end_task(self, task_summary: str):
        """Save results to long-term memory when a task ends"""
        self.long_term.store(
            task_summary,
            metadata={"type": "task_result", "timestamp": time.time()}
        )
        self.working.clear()
```

### 7.1 Production Integrated Memory

```python
# Production-ready integrated memory system
import time
import logging
from typing import Optional

class ProductionMemorySystem:
    """Integrated memory system for production environments"""

    def __init__(self, config: dict):
        self.logger = logging.getLogger("memory")

        # Short-term memory
        self.short_term = HybridShortTermMemory(
            llm=config["llm"],
            window_size=config.get("window_size", 15)
        )

        # Long-term memory (vector DB)
        self.long_term = RAGMemory(
            collection_name=config.get("collection", "production_memory")
        )

        # Knowledge graph
        self.knowledge_graph = KnowledgeGraphMemory(llm=config["llm"])

        # Episodic memory
        self.episodic = EpisodicMemory(rag_memory=self.long_term)

        # Metrics
        self.metrics = {
            "store_count": 0,
            "retrieve_count": 0,
            "cache_hits": 0,
            "avg_retrieve_latency": 0.0
        }

        # Search result cache
        self._cache = {}
        self._cache_ttl = config.get("cache_ttl", 300)

    def store(self, content: str, memory_type: str = "fact",
              metadata: dict = None):
        """Save a memory"""
        meta = metadata or {}
        meta["memory_type"] = memory_type
        meta["stored_at"] = time.time()

        self.long_term.store(content, metadata=meta)
        self.metrics["store_count"] += 1

        # Also extract and save to knowledge graph
        try:
            self.knowledge_graph.extract_and_store(content)
        except Exception as e:
            self.logger.warning(f"Knowledge graph extraction failed: {e}")

    def retrieve(self, query: str, top_k: int = 5,
                 use_cache: bool = True) -> dict:
        """Integrated search"""
        # Cache check
        cache_key = f"{query}:{top_k}"
        if use_cache and cache_key in self._cache:
            entry = self._cache[cache_key]
            if time.time() - entry["timestamp"] < self._cache_ttl:
                self.metrics["cache_hits"] += 1
                return entry["result"]

        start = time.time()

        # Search from each memory source
        result = {
            "conversation_context": self.short_term.get_context(),
            "semantic_matches": self.long_term.retrieve(query, top_k),
            "knowledge_graph": self.knowledge_graph.to_context_string(
                query.split()[0] if query else ""
            ),
            "past_episodes": self.episodic.get_lessons_for_task(query)
        }

        latency = time.time() - start
        self.metrics["retrieve_count"] += 1
        self._update_avg_latency(latency)

        # Save to cache
        self._cache[cache_key] = {
            "result": result,
            "timestamp": time.time()
        }

        return result

    def build_prompt_context(self, query: str) -> str:
        """Build context string to pass to the LLM"""
        retrieved = self.retrieve(query)

        parts = []

        # Conversation context
        conv = retrieved["conversation_context"]
        if conv:
            parts.append("=== Conversation History ===")
            for msg in conv[-5:]:
                parts.append(f"{msg['role']}: {msg['content']}")

        # Semantic search results
        matches = retrieved["semantic_matches"]
        if matches:
            parts.append("\n=== Relevant Memories ===")
            for i, match in enumerate(matches, 1):
                parts.append(f"{i}. {match}")

        # Knowledge graph
        kg = retrieved["knowledge_graph"]
        if kg and "No information found" not in kg:
            parts.append(f"\n=== Knowledge ===\n{kg}")

        # Episodic memory
        episodes = retrieved["past_episodes"]
        if episodes and "No related" not in episodes:
            parts.append(f"\n=== Past Experiences ===\n{episodes}")

        return "\n".join(parts)

    def _update_avg_latency(self, latency: float):
        n = self.metrics["retrieve_count"]
        old_avg = self.metrics["avg_retrieve_latency"]
        self.metrics["avg_retrieve_latency"] = (old_avg * (n-1) + latency) / n

    def get_metrics(self) -> dict:
        return self.metrics.copy()
```

---

## 8. Memory Lifecycle

```
Memory Lifecycle Management

Session Start
     |
     v
+--------------------+
| Load from long-term |  ← User info, past tasks
+----+---------------+
     |
     v
+--------------------+
| Add conversation to |  ← Updated each turn
| short-term memory  |
+----+---------------+
     |
     v (Threshold exceeded?)
+--------------------+
| Summarize/Compress  |  ← Summarize old history
+----+---------------+
     |
     v
+--------------------+
| Task Complete       |
+----+---------------+
     |
     v
+--------------------+
| Save important info |  ← Learned facts, user preferences
| to long-term memory |
+----+---------------+
     |
     v
Session End
```

### 8.1 Memory Garbage Collection

```python
# Automatic cleanup of unnecessary memory
class MemoryGarbageCollector:
    """Automatic cleanup of old and duplicate memory"""

    def __init__(self, memory: RAGMemory, max_age_days: int = 90):
        self.memory = memory
        self.max_age_days = max_age_days

    def cleanup_old_entries(self):
        """Delete old entries"""
        cutoff = time.time() - (self.max_age_days * 86400)
        # Identify and delete old entries using metadata filtering
        results = self.memory.collection.get(
            where={"stored_at": {"$lt": cutoff}}
        )
        if results["ids"]:
            self.memory.collection.delete(ids=results["ids"])
            return len(results["ids"])
        return 0

    def deduplicate(self, similarity_threshold: float = 0.95):
        """Merge duplicate memories"""
        all_docs = self.memory.collection.get()
        to_delete = []

        for i, doc_i in enumerate(all_docs["documents"]):
            for j, doc_j in enumerate(all_docs["documents"]):
                if i >= j:
                    continue
                # Similarity check
                similarity = self._compute_similarity(doc_i, doc_j)
                if similarity > similarity_threshold:
                    # Mark the older one for deletion
                    to_delete.append(all_docs["ids"][j])

        if to_delete:
            self.memory.collection.delete(ids=list(set(to_delete)))
            return len(set(to_delete))
        return 0

    def compact_summaries(self, llm, max_per_topic: int = 5):
        """Summarize and merge memories on the same topic"""
        # Group by topic
        all_docs = self.memory.collection.get(include=["documents", "metadatas"])
        topics = defaultdict(list)

        for doc, meta in zip(all_docs["documents"], all_docs["metadatas"]):
            topic = meta.get("topic", "general")
            topics[topic].append(doc)

        # Summarize per topic
        for topic, docs in topics.items():
            if len(docs) > max_per_topic:
                combined = "\n".join(docs)
                summary = llm.generate(
                    f"Summarize the following {len(docs)} items into {max_per_topic}:\n{combined}"
                )
                # Delete old entries and save summary
                # (actual implementation requires ID tracking)
```

---

## 9. Troubleshooting

### 9.1 Common Problems and Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Memory not found | Mismatch between search query and chunks | Adjust chunk size, introduce hybrid search |
| Inaccurate memory recall | Similar but different-context memory | Add metadata filter, add reranking |
| Memory bloat | Insufficient garbage collection | Periodic cleanup, set TTL |
| Loss of conversation context | Summary drops important information | Store important facts separately, use hybrid short-term memory |
| Increased latency | Growing search targets | Index optimization, caching, batch search |
| Context overflow | Too many retrieved memories | Limit top_k, summarize results |

### 9.2 Memory Debugging Tools

```python
# Debug support for the memory system
class MemoryDebugger:
    """Debug and analysis tool for the memory system"""

    def __init__(self, memory_system):
        self.memory = memory_system

    def inspect_retrieval(self, query: str, top_k: int = 10) -> dict:
        """Detailed analysis of search results"""
        results = self.memory.long_term.collection.query(
            query_texts=[query],
            n_results=top_k,
            include=["documents", "distances", "metadatas"]
        )

        analysis = {
            "query": query,
            "num_results": len(results["documents"][0]),
            "results": []
        }

        for i, (doc, dist, meta) in enumerate(zip(
            results["documents"][0],
            results["distances"][0],
            results["metadatas"][0]
        )):
            analysis["results"].append({
                "rank": i + 1,
                "distance": float(dist),
                "similarity": 1 - float(dist),
                "document_preview": doc[:200],
                "metadata": meta
            })

        return analysis

    def check_memory_health(self) -> dict:
        """Check the health of the memory system"""
        collection = self.memory.long_term.collection
        count = collection.count()

        return {
            "total_entries": count,
            "short_term_size": len(self.memory.short_term.messages),
            "working_memory_keys": list(self.memory.working.keys()),
            "metrics": self.memory.get_metrics()
            if hasattr(self.memory, "get_metrics") else "N/A"
        }
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Unlimited Conversation History

```python
# NG: Pass all history directly to the LLM
messages = load_all_history()  # Exceeds 100K tokens
response = llm.generate(messages=messages)  # Context overflow error

# OK: Apply an appropriate compression strategy
memory = SummaryMemory(llm, max_tokens=4000)
for msg in load_all_history():
    memory.add(msg["role"], msg["content"])
response = llm.generate(messages=memory.get_context())
```

### Anti-Pattern 2: Long-Term Memory Without Retrieval

```python
# NG: Include all long-term memories in the prompt
all_memories = database.get_all()  # Large amount of data
prompt = f"Knowledge: {all_memories}\nQuestion: {query}"

# OK: Search and include only memories relevant to the query
relevant = rag_memory.retrieve(query, top_k=5)
prompt = f"Relevant knowledge:\n{chr(10).join(relevant)}\n\nQuestion: {query}"
```

### Anti-Pattern 3: Redundant Memory Storage

```python
# NG: Store the same information repeatedly
for turn in conversation:
    memory.store(f"The user's name is {user_name}")  # Stored every turn

# OK: Store only when there is a change
def store_if_new(memory, key, value):
    existing = memory.retrieve(key, top_k=1)
    if not existing or existing[0] != value:
        memory.store(value, metadata={"key": key, "updated": time.time()})
```

### Anti-Pattern 4: Inappropriate Chunk Size Settings

```python
# NG: Chunks are too small
chunks = chunk_by_tokens(text, chunk_size=50)  # Insufficient context

# NG: Chunks are too large
chunks = chunk_by_tokens(text, chunk_size=5000)  # Too much noise

# OK: Appropriate size (300-800 tokens) with overlap
chunks = chunk_by_tokens(text, chunk_size=500, overlap=50)
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Perform input data validation
- Implement appropriate error handling
- Also create test code

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
        """Get processing results"""
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

Extend the basic implementation to add the following functionality.

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
    print(f"Speedup:      {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 11. FAQ

### Q1: Which vector DB should I choose?

- **Prototype**: ChromaDB (embedded, no setup required)
- **Small to medium production**: PostgreSQL + pgvector (leverages existing DB)
- **Large-scale production**: Pinecone (managed, scalable)
- **On-premises**: Weaviate, Milvus (self-hostable)

### Q2: What should be stored in memory?

In order of priority:
1. **User preferences and settings** ("prefers Python", "wants concise answers")
2. **Project-specific facts** ("uses PostgreSQL for the DB")
3. **Summaries of past task results** ("3 points raised in the previous review")
4. **Error and solution pairs** ("error X is resolved by Y")

### Q3: How do I improve RAG accuracy?

- **Optimize chunk size**: Too small means insufficient context, too large means noise. 300-800 tokens is typical.
- **Hybrid search**: Combine vector search + keyword search (BM25)
- **Reranking**: Rerank search results with Cross-Encoder
- **Metadata filtering**: Filter by category etc. before searching

### Q4: How do I persist memory?

| Method | Features | Use Case |
|--------|----------|----------|
| File storage (JSON) | Simple, easy to back up | Prototype |
| SQLite | Embedded, SQL support | Small-scale production |
| PostgreSQL + pgvector | Scalable, vector search | Production environment |
| Redis | Fast, volatile | Cache layer |
| S3 + DynamoDB | AWS integration, cost-optimized | Cloud-native |

### Q5: How do I maintain memory consistency?

```python
# Pattern for maintaining memory consistency
class ConsistentMemory:
    def update_fact(self, key: str, new_value: str):
        """Maintain consistency when updating a fact"""
        # 1. Search for the old fact
        old = self.retrieve(key, top_k=1)

        # 2. Contradiction check
        if old and self._contradicts(old[0], new_value):
            # 3. Invalidate the old fact
            self.invalidate(old[0])
            self.store(
                f"[Updated] {key}: {new_value} (previously: {old[0]})",
                metadata={"type": "fact_update"}
            )
        else:
            self.store(new_value, metadata={"key": key})
```

### Q6: What are the criteria for choosing an embedding model?

| Model | Dimensions | Performance | Speed | Cost |
|-------|-----------|-------------|-------|------|
| all-MiniLM-L6-v2 | 384 | Medium | Very fast | Free |
| all-mpnet-base-v2 | 768 | High | Fast | Free |
| text-embedding-3-small | 1536 | High | API-dependent | Cheap |
| text-embedding-3-large | 3072 | Highest | API-dependent | Moderate |
| Cohere embed-v3 | 1024 | High | API-dependent | Moderate |

**Recommendation**: Use all-MiniLM-L6-v2 for prototypes, text-embedding-3-small or above for production.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Your understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Details |
|------|---------|
| Three-layer model | Short-term (session) / Working (task) / Long-term (persistent) |
| Short-term memory | Buffer / Sliding window / Summary / Hybrid |
| Long-term memory | Semantic search with Vector DB + RAG |
| Knowledge graph | Structured storage of relationships between entities |
| Episodic memory | Learn from past experiences (successes and failures) |
| Chunking | Token-based / Semantic / Recursive |
| Integrated design | Combine short-term + long-term + knowledge graph + episodic |
| Core principle | Efficiently retrieve only relevant memories |

## Next Guides to Read

- [../01-patterns/00-single-agent.md](../01-patterns/00-single-agent.md) — Using memory in single agents
- [../01-patterns/03-autonomous-agents.md](../01-patterns/03-autonomous-agents.md) — Long-term memory for autonomous agents
- [../02-implementation/00-langchain-agent.md](../02-implementation/00-langchain-agent.md) — Implementing memory with LangChain

## References

1. Lewis, P. et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (2020) — https://arxiv.org/abs/2005.11401
2. LangChain, "Memory" — https://python.langchain.com/docs/concepts/memory/
3. ChromaDB Documentation — https://docs.trychroma.com/
4. Zhang, Z. et al., "A Survey on the Memory Mechanism of Large Language Model based Agents" (2024) — https://arxiv.org/abs/2404.13501
5. Anthropic, "MCP Memory Server" — https://github.com/anthropics/mcp-memory
6. Robertson, S. et al., "The Probabilistic Relevance Framework: BM25 and Beyond" — https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf
