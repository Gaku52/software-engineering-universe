# Data Agents

> Analytics, visualization, and insights — design and implementation of data analysis agents that autonomously query databases, perform statistical analysis, and generate charts.

## What You Will Learn

1. Text-to-SQL conversion and data analysis pipeline design
2. Implementation patterns for automatic visualization generation and insight extraction
3. Ensuring data agent safety (read-only access, injection prevention)
4. Building integrated analysis agents that span multiple data sources
5. Caching strategies, cost optimization, and monitoring for production use

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Customer Support Agents](./02-customer-support.md)

---

## 1. Overview of Data Agents

```
Data Agent Pipeline

[Natural Language Question]
  "What are the top 10 products by sales last month?"
       |
       v
[Question Understanding] ── References schema information
       |
       v
[SQL Generation] ── Text-to-SQL
       |
       v
[SQL Validation] ── Safety check (READ ONLY)
       |
       v
[SQL Execution] ── DB connection & query execution
       |
       v
[Result Analysis] ── Statistical processing, pattern detection
       |
       v
[Visualization] ── Graph & chart creation
       |
       v
[Insights] ── Natural language insights
```

### 1.1 Types of Data Agents

```
Types of Data Agents

┌────────────────┬────────────────┬────────────────┐
│  Query Agent   │ Analysis Agent │ Report Agent   │
│                │                │                │
│ NL → SQL       │ Statistical/ML │ Periodic report│
│ Single Q&A     │ Multi-step     │ Dashboard      │
│ Instant result │ Deep insights  │ Scheduled run  │
└────────────────┴────────────────┴────────────────┘
         │                │                │
         v                v                v
┌────────────────┬────────────────┬────────────────┐
│ Pipeline       │ Exploratory    │ Anomaly        │
│ Agent          │ Agent          │ Detection Agent│
│ ETL automation │ Hypothesis→    │ Data quality   │
│ Data transform │ Validation     │ monitoring     │
│ Quality check  │ Iterative drill│ Alert & action │
└────────────────┴────────────────┴────────────────┘
```

### 1.2 Overall Architecture

```python
# Data agent architecture overview
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class AgentRole(Enum):
    QUERY = "query"           # Single query execution
    ANALYST = "analyst"       # Multi-step analysis
    REPORTER = "reporter"     # Report generation
    MONITOR = "monitor"       # Anomaly detection & monitoring

@dataclass
class DataAgentConfig:
    """Integrated configuration for data agents"""
    role: AgentRole
    db_connections: dict[str, str]        # name → connection string
    max_rows: int = 1000                  # Maximum result rows
    max_query_time_seconds: int = 30      # Query timeout
    enable_caching: bool = True           # Result caching
    cache_ttl_seconds: int = 300          # Cache TTL
    pii_columns: set[str] = field(
        default_factory=lambda: {"email", "phone", "ssn", "credit_card", "address"}
    )
    allowed_operations: set[str] = field(
        default_factory=lambda: {"SELECT"}
    )
    model_name: str = "claude-sonnet-4-20250514"
    max_retries: int = 3
    enable_visualization: bool = True
    log_queries: bool = True              # Query logging
    cost_limit_per_session: float = 1.0   # API cost limit per session (USD)

@dataclass
class QueryResult:
    """Standard format for query results"""
    query: str
    columns: list[str]
    rows: list[tuple]
    row_count: int
    execution_time_ms: float
    truncated: bool = False
    error: Optional[str] = None
    cached: bool = False

    def to_dataframe(self):
        """Convert to pandas DataFrame"""
        import pandas as pd
        return pd.DataFrame(self.rows, columns=self.columns)

    def summary(self) -> str:
        """Return a summary of results as a string"""
        if self.error:
            return f"Error: {self.error}"
        lines = [
            f"Columns: {', '.join(self.columns)}",
            f"Row count: {self.row_count}{'(truncated)' if self.truncated else ''}",
            f"Execution time: {self.execution_time_ms:.1f}ms",
        ]
        if self.cached:
            lines.append("(Cached result)")
        return "\n".join(lines)
```

---

## 2. Text-to-SQL

### 2.1 Basic Implementation

```python
# Text-to-SQL エージェント
import anthropic
import sqlite3
import json
import time
import hashlib
from typing import Optional

class TextToSQLAgent:
    def __init__(self, db_path: str, config: Optional[DataAgentConfig] = None):
        self.client = anthropic.Anthropic()
        self.db_path = db_path
        self.schema = self._get_schema()
        self.config = config or DataAgentConfig(role=AgentRole.QUERY, db_connections={})
        self._query_cache: dict[str, QueryResult] = {}
        self._query_log: list[dict] = []

    def _get_schema(self) -> str:
        """Retrieve database schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT sql FROM sqlite_master WHERE type='table'"
        )
        schemas = cursor.fetchall()
        conn.close()
        return "\n".join(s[0] for s in schemas if s[0])

    def query(self, question: str) -> dict:
        """Convert a natural language question to SQL and execute it"""

        # 1. SQL generation
        sql = self._generate_sql(question)

        # 2. Safety check
        if not self._is_safe_query(sql):
            return {"error": "Unsafe query detected"}

        # 3. Cache check
        cache_key = self._cache_key(sql)
        if self.config.enable_caching and cache_key in self._query_cache:
            cached = self._query_cache[cache_key]
            cached.cached = True
            return {
                "question": question,
                "sql": sql,
                "results": {"columns": cached.columns, "rows": cached.rows},
                "interpretation": "(Cached result)",
                "cached": True
            }

        # 4. Execution
        start_time = time.time()
        results = self._execute_sql(sql)
        execution_time = (time.time() - start_time) * 1000

        # 5. Log recording
        if self.config.log_queries:
            self._query_log.append({
                "question": question,
                "sql": sql,
                "execution_time_ms": execution_time,
                "success": "error" not in results,
                "timestamp": time.time()
            })

        # 6. Result interpretation
        interpretation = self._interpret_results(question, sql, results)

        return {
            "question": question,
            "sql": sql,
            "results": results,
            "interpretation": interpretation,
            "execution_time_ms": execution_time
        }

    def _cache_key(self, sql: str) -> str:
        """Generate a cache key from SQL"""
        return hashlib.sha256(sql.strip().lower().encode()).hexdigest()

    def _generate_sql(self, question: str) -> str:
        """Convert natural language to SQL"""
        response = self.client.messages.create(
            model=self.config.model_name,
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Database schema:
{self.schema}

Generate a SQL query for the following question.
Only SELECT is allowed (INSERT/UPDATE/DELETE are not permitted).

Question: {question}

Output only the SQL query (no explanation):
"""}]
        )
        sql = response.content[0].text.strip()
        # Handle ```sql ... ``` format
        if sql.startswith("```"):
            sql = sql.split("\n", 1)[1].rsplit("```", 1)[0]
        return sql.strip()

    def _is_safe_query(self, sql: str) -> bool:
        """Check SQL safety"""
        dangerous_keywords = [
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
            "CREATE", "TRUNCATE", "EXEC", "EXECUTE",
            "GRANT", "REVOKE"
        ]
        sql_upper = sql.upper()
        return not any(kw in sql_upper for kw in dangerous_keywords)

    def _execute_sql(self, sql: str) -> list:
        """Execute SQL"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA query_only = ON")  # Enforce read-only
        cursor = conn.cursor()
        try:
            cursor.execute(sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            return {"columns": columns, "rows": rows[:1000]}  # Max 1000 rows
        except Exception as e:
            return {"error": str(e)}
        finally:
            conn.close()

    def _interpret_results(self, question: str, sql: str, results: dict) -> str:
        """Interpret results in natural language"""
        response = self.client.messages.create(
            model=self.config.model_name,
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Question: {question}
Executed SQL: {sql}
Results: {json.dumps(results, ensure_ascii=False)[:3000]}

Interpret the results clearly in English.
Point out important numbers or trends if any.
"""}]
        )
        return response.content[0].text
```

### 2.2 Enhanced Schema Information

```python
# スキーマに説明を付加して精度向上
ENHANCED_SCHEMA = """
-- Products table
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,           -- Product name
    category TEXT NOT NULL,        -- Category (electronics, clothing, food, etc.)
    price REAL NOT NULL,           -- Price before tax (JPY)
    stock INTEGER DEFAULT 0,       -- Stock count
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL,  -- Customer ID
    product_id INTEGER NOT NULL,   -- Product ID
    quantity INTEGER NOT NULL,     -- Quantity
    total_price REAL NOT NULL,     -- Total amount (tax included)
    status TEXT DEFAULT 'pending', -- pending/confirmed/shipped/delivered/cancelled
    ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Sample data examples:
-- products: (1, 'Wireless Earbuds', 'electronics', 12800, 150, '2025-01-01')
-- orders: (1, 101, 1, 2, 28160, 'delivered', '2025-01-15')
"""
```

### 2.3 Dynamic Schema Selection

```python
# 大規模DB向け: 質問に関連するテーブルだけを選択
class SchemaSelector:
    """Automatically selects relevant tables from a DB with 100+ tables"""

    def __init__(self, db_path: str):
        self.client = anthropic.Anthropic()
        self.db_path = db_path
        self.table_catalog = self._build_catalog()

    def _build_catalog(self) -> dict[str, str]:
        """Build a catalog of all table names and descriptions"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        conn.close()

        catalog = {}
        for name, sql in tables:
            if sql:
                # Extract table and column names to create a summary
                catalog[name] = self._summarize_table(name, sql)
        return catalog

    def _summarize_table(self, name: str, create_sql: str) -> str:
        """Extract column names from a CREATE statement"""
        import re
        columns = re.findall(r'(\w+)\s+(INTEGER|TEXT|REAL|BLOB|DATETIME|BOOLEAN)', create_sql)
        col_list = ", ".join(f"{c[0]}({c[1]})" for c in columns)
        return f"{name}: {col_list}"

    def select_tables(self, question: str, max_tables: int = 5) -> list[str]:
        """Select tables relevant to the question"""
        catalog_text = "\n".join(
            f"- {name}: {desc}" for name, desc in self.table_catalog.items()
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=256,
            messages=[{"role": "user", "content": f"""
From the following table list, select up to {max_tables} tables needed to answer the question.

Table list:
{catalog_text}

Question: {question}

Output only the table names, comma-separated:
"""}]
        )
        selected = response.content[0].text.strip().split(",")
        return [t.strip() for t in selected if t.strip() in self.table_catalog]

    def get_selected_schema(self, question: str) -> str:
        """Return only the CREATE statements for tables relevant to the question"""
        selected = self.select_tables(question)
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        schemas = []
        for table_name in selected:
            cursor.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            row = cursor.fetchone()
            if row and row[0]:
                schemas.append(row[0])

        conn.close()
        return "\n\n".join(schemas)
```

### 2.4 Few-shot SQL Generation

```python
# Few-shot例を使ったSQL生成精度の向上
class FewShotSQLGenerator:
    """Improve SQL generation accuracy using similar question examples"""

    def __init__(self, db_path: str):
        self.client = anthropic.Anthropic()
        self.db_path = db_path
        self.schema = self._get_schema(db_path)
        # Few-shot example store (use vector DB in production)
        self.examples: list[dict] = []

    def _get_schema(self, db_path: str) -> str:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
        schemas = cursor.fetchall()
        conn.close()
        return "\n".join(s[0] for s in schemas if s[0])

    def add_example(self, question: str, sql: str, description: str = ""):
        """Add a few-shot example"""
        self.examples.append({
            "question": question,
            "sql": sql,
            "description": description
        })

    def find_similar_examples(self, question: str, top_k: int = 3) -> list[dict]:
        """Find few-shot examples similar to the question (simple: keyword matching)"""
        import re
        question_words = set(re.findall(r'\w+', question.lower()))
        scored = []
        for ex in self.examples:
            ex_words = set(re.findall(r'\w+', ex["question"].lower()))
            overlap = len(question_words & ex_words)
            scored.append((overlap, ex))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [ex for _, ex in scored[:top_k]]

    def generate_sql(self, question: str) -> str:
        """Generate SQL using few-shot examples"""
        similar = self.find_similar_examples(question)

        examples_text = ""
        if similar:
            examples_text = "Reference examples:\n"
            for i, ex in enumerate(similar, 1):
                examples_text += f"""
Example {i}:
  Question: {ex['question']}
  SQL: {ex['sql']}
"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Database schema:
{self.schema}

{examples_text}

Question: {question}

Using the above reference examples, generate a SQL query.
Only SELECT is allowed.
Output only the SQL query:
"""}]
        )
        sql = response.content[0].text.strip()
        if sql.startswith("```"):
            sql = sql.split("\n", 1)[1].rsplit("```", 1)[0]
        return sql.strip()

    def learn_from_correction(self, question: str, corrected_sql: str):
        """Learn from user corrections as few-shot examples"""
        self.add_example(
            question=question,
            sql=corrected_sql,
            description="User-corrected"
        )
```

### 2.5 Advanced SQL Validation

```python
import sqlparse
from typing import Optional

class SQLValidator:
    """Multi-layer SQL validation"""

    # Allowed statement types
    ALLOWED_STATEMENT_TYPES = {"SELECT"}

    # Forbidden keywords (uppercase)
    FORBIDDEN_KEYWORDS = {
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
        "TRUNCATE", "EXEC", "EXECUTE", "GRANT", "REVOKE",
        "CALL", "LOAD", "REPLACE", "MERGE", "UPSERT",
        "ATTACH", "DETACH", "VACUUM", "REINDEX", "ANALYZE",
    }

    # Forbidden functions (SQL injection countermeasures)
    FORBIDDEN_FUNCTIONS = {
        "LOAD_FILE", "INTO OUTFILE", "INTO DUMPFILE",
        "SLEEP", "BENCHMARK", "WAITFOR",
    }

    def validate(self, sql: str) -> tuple[bool, Optional[str]]:
        """Validate SQL and return (is_valid, error_message)"""
        checks = [
            self._check_statement_type,
            self._check_forbidden_keywords,
            self._check_forbidden_functions,
            self._check_subquery_depth,
            self._check_union_count,
            self._check_comment_injection,
            self._check_semicolon,
        ]

        for check in checks:
            is_valid, error = check(sql)
            if not is_valid:
                return False, error

        return True, None

    def _check_statement_type(self, sql: str) -> tuple[bool, Optional[str]]:
        """Validate statement type"""
        parsed = sqlparse.parse(sql)
        if not parsed:
            return False, "Empty SQL"
        stmt_type = parsed[0].get_type()
        if stmt_type and stmt_type.upper() not in self.ALLOWED_STATEMENT_TYPES:
            return False, f"Disallowed statement type: {stmt_type}"
        return True, None

    def _check_forbidden_keywords(self, sql: str) -> tuple[bool, Optional[str]]:
        """Detect forbidden keywords"""
        tokens = sqlparse.parse(sql)[0].flatten()
        for token in tokens:
            if token.ttype is sqlparse.tokens.Keyword:
                if token.value.upper() in self.FORBIDDEN_KEYWORDS:
                    return False, f"Forbidden keyword: {token.value}"
        return True, None

    def _check_forbidden_functions(self, sql: str) -> tuple[bool, Optional[str]]:
        """Detect forbidden functions"""
        sql_upper = sql.upper()
        for func in self.FORBIDDEN_FUNCTIONS:
            if func in sql_upper:
                return False, f"Forbidden function: {func}"
        return True, None

    def _check_subquery_depth(self, sql: str, max_depth: int = 3) -> tuple[bool, Optional[str]]:
        """Limit subquery nesting depth"""
        depth = 0
        max_found = 0
        for char in sql:
            if char == '(':
                depth += 1
                max_found = max(max_found, depth)
            elif char == ')':
                depth -= 1
        if max_found > max_depth:
            return False, f"Subquery too deeply nested (depth {max_found}, max {max_depth})"
        return True, None

    def _check_union_count(self, sql: str, max_unions: int = 5) -> tuple[bool, Optional[str]]:
        """Limit the number of UNION clauses"""
        union_count = sql.upper().count("UNION")
        if union_count > max_unions:
            return False, f"Too many UNION clauses ({union_count}, max {max_unions})"
        return True, None

    def _check_comment_injection(self, sql: str) -> tuple[bool, Optional[str]]:
        """Detect comment injection"""
        if "--" in sql or "/*" in sql:
            return False, "SQL comments are not allowed"
        return True, None

    def _check_semicolon(self, sql: str) -> tuple[bool, Optional[str]]:
        """Prevent multiple statements"""
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        if len(statements) > 1:
            return False, "Multiple statements are not allowed"
        return True, None
```

---

## 3. Data Visualization

### 3.1 Automatic Chart Generation

```python
# Pythonコード生成によるグラフ作成
class DataVisualizer:
    def __init__(self):
        self.client = anthropic.Anthropic()

    def generate_chart(self, data: dict, chart_request: str) -> str:
        """Generate Python code to create a chart based on the data"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
Generate Python code to create a matplotlib chart based on the following data.

Data:
Columns: {data['columns']}
Row count: {len(data['rows'])}
First 5 rows: {data['rows'][:5]}

Request: {chart_request}

Rules:
- Use matplotlib + pandas
- Use 'DejaVu Sans' as the font
- Save with plt.savefig('chart.png', dpi=150, bbox_inches='tight')
- Use readable color scheme
"""}]
        )
        return response.content[0].text

    def auto_visualize(self, data: dict) -> str:
        """Automatically select the best chart type based on data characteristics"""
        num_columns = len(data["columns"])
        num_rows = len(data["rows"])

        if num_rows == 0:
            return "No data available"

        # Analyze data characteristics
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": f"""
Choose one optimal chart type for the following data.

Columns: {data['columns']}
First 3 rows: {data['rows'][:3]}
Row count: {num_rows}

Options: bar, line, pie, scatter, heatmap, table

Output the best chart type and a one-line reason:
"""}]
        )
        return response.content[0].text
```

### 3.2 Advanced Visualization Templates

```python
import matplotlib.pyplot as plt
import matplotlib
import pandas as pd
import numpy as np
from pathlib import Path

# Japanese font settings
matplotlib.rcParams['font.family'] = 'Hiragino Sans'
matplotlib.rcParams['axes.unicode_minus'] = False

class ChartTemplates:
    """Collection of reusable chart templates"""

    # Common color palette
    COLORS = [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
        '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
        '#9c755f', '#bab0ac'
    ]

    @staticmethod
    def sales_trend(df: pd.DataFrame, date_col: str, value_col: str,
                    title: str = "Sales Trend", output_path: str = "chart.png"):
        """Line chart showing sales trend"""
        fig, ax = plt.subplots(figsize=(12, 6))

        ax.plot(df[date_col], df[value_col],
                color=ChartTemplates.COLORS[0],
                linewidth=2, marker='o', markersize=4)

        # Add moving average line
        if len(df) >= 7:
            ma7 = df[value_col].rolling(window=7).mean()
            ax.plot(df[date_col], ma7,
                    color=ChartTemplates.COLORS[1],
                    linewidth=1.5, linestyle='--',
                    label='7-day moving average')

        ax.set_title(title, fontsize=16, fontweight='bold', pad=15)
        ax.set_xlabel("Date", fontsize=12)
        ax.set_ylabel("Amount (JPY)", fontsize=12)
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)

        # Format Y axis (in thousands)
        ax.yaxis.set_major_formatter(
            matplotlib.ticker.FuncFormatter(lambda x, p: f'{x/1000:.0f}K')
        )

        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return output_path

    @staticmethod
    def category_comparison(df: pd.DataFrame, cat_col: str, value_col: str,
                            title: str = "Category Comparison",
                            output_path: str = "chart.png"):
        """Horizontal bar chart comparing categories"""
        fig, ax = plt.subplots(figsize=(10, max(6, len(df) * 0.4)))

        sorted_df = df.sort_values(value_col, ascending=True)
        colors = [ChartTemplates.COLORS[i % len(ChartTemplates.COLORS)]
                  for i in range(len(sorted_df))]

        bars = ax.barh(sorted_df[cat_col], sorted_df[value_col], color=colors)

        # Add value labels
        for bar, val in zip(bars, sorted_df[value_col]):
            ax.text(bar.get_width() + max(sorted_df[value_col]) * 0.01,
                    bar.get_y() + bar.get_height() / 2,
                    f'{val:,.0f}', va='center', fontsize=10)

        ax.set_title(title, fontsize=16, fontweight='bold', pad=15)
        ax.set_xlabel("Amount (JPY)", fontsize=12)
        ax.grid(True, axis='x', alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return output_path

    @staticmethod
    def pie_chart(df: pd.DataFrame, label_col: str, value_col: str,
                  title: str = "Composition", output_path: str = "chart.png",
                  top_n: int = 8):
        """Pie chart (top N + others)"""
        fig, ax = plt.subplots(figsize=(10, 8))

        sorted_df = df.sort_values(value_col, ascending=False)

        if len(sorted_df) > top_n:
            top = sorted_df.head(top_n)
            other_sum = sorted_df.iloc[top_n:][value_col].sum()
            other_row = pd.DataFrame({
                label_col: ["Others"],
                value_col: [other_sum]
            })
            plot_df = pd.concat([top, other_row], ignore_index=True)
        else:
            plot_df = sorted_df

        wedges, texts, autotexts = ax.pie(
            plot_df[value_col],
            labels=plot_df[label_col],
            autopct='%1.1f%%',
            colors=ChartTemplates.COLORS[:len(plot_df)],
            startangle=90,
            pctdistance=0.85
        )

        for text in autotexts:
            text.set_fontsize(10)
            text.set_fontweight('bold')

        ax.set_title(title, fontsize=16, fontweight='bold', pad=20)
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return output_path

    @staticmethod
    def heatmap(df: pd.DataFrame, title: str = "Heatmap",
                output_path: str = "chart.png"):
        """Heatmap for correlation matrices or cross-tabulations"""
        fig, ax = plt.subplots(figsize=(10, 8))

        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.empty:
            return None

        corr = numeric_df.corr()
        im = ax.imshow(corr, cmap='RdBu_r', vmin=-1, vmax=1, aspect='auto')

        ax.set_xticks(range(len(corr.columns)))
        ax.set_yticks(range(len(corr.columns)))
        ax.set_xticklabels(corr.columns, rotation=45, ha='right')
        ax.set_yticklabels(corr.columns)

        # Display values in each cell
        for i in range(len(corr)):
            for j in range(len(corr)):
                text_color = 'white' if abs(corr.iloc[i, j]) > 0.5 else 'black'
                ax.text(j, i, f'{corr.iloc[i, j]:.2f}',
                        ha='center', va='center', color=text_color, fontsize=9)

        plt.colorbar(im, ax=ax, shrink=0.8)
        ax.set_title(title, fontsize=16, fontweight='bold', pad=15)
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return output_path

    @staticmethod
    def multi_metric_dashboard(
        data: dict[str, pd.DataFrame],
        title: str = "Dashboard",
        output_path: str = "dashboard.png"
    ):
        """Dashboard with multiple metrics (2x2 grid)"""
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle(title, fontsize=20, fontweight='bold', y=0.98)

        panels = list(data.items())[:4]

        for idx, (panel_title, df) in enumerate(panels):
            ax = axes[idx // 2][idx % 2]
            if len(df.columns) >= 2:
                x_col, y_col = df.columns[0], df.columns[1]
                if pd.api.types.is_numeric_dtype(df[y_col]):
                    ax.bar(df[x_col].astype(str), df[y_col],
                           color=ChartTemplates.COLORS[idx])
                    ax.set_title(panel_title, fontsize=14, fontweight='bold')
                    ax.tick_params(axis='x', rotation=45)
                    ax.grid(True, axis='y', alpha=0.3)

        plt.tight_layout(rect=[0, 0, 1, 0.96])
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return output_path
```

### 3.3 Interactive Visualization

```python
# Plotlyを使ったインタラクティブグラフ生成
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

class InteractiveVisualizer:
    """Plotly-based interactive visualization"""

    def sales_dashboard(self, df: pd.DataFrame) -> go.Figure:
        """Sales dashboard"""
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=(
                'Daily Sales Trend', 'Sales by Category',
                'Orders by Hour', 'Customer Segments'
            ),
            specs=[
                [{"type": "scatter"}, {"type": "bar"}],
                [{"type": "bar"}, {"type": "pie"}]
            ]
        )

        # Daily sales
        if 'date' in df.columns and 'revenue' in df.columns:
            fig.add_trace(
                go.Scatter(x=df['date'], y=df['revenue'],
                           mode='lines+markers', name='Revenue'),
                row=1, col=1
            )

        # By category
        if 'category' in df.columns and 'revenue' in df.columns:
            cat_data = df.groupby('category')['revenue'].sum().reset_index()
            fig.add_trace(
                go.Bar(x=cat_data['category'], y=cat_data['revenue'],
                       name='Category'),
                row=1, col=2
            )

        fig.update_layout(
            height=800,
            title_text="Sales Dashboard",
            showlegend=True,
            template="plotly_white"
        )
        return fig

    def time_series_with_anomaly(self, df: pd.DataFrame,
                                 date_col: str, value_col: str) -> go.Figure:
        """Time series chart with anomaly highlighting"""
        # Anomaly detection (IQR method)
        q1 = df[value_col].quantile(0.25)
        q3 = df[value_col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        normal = df[(df[value_col] >= lower) & (df[value_col] <= upper)]
        anomalies = df[(df[value_col] < lower) | (df[value_col] > upper)]

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=normal[date_col], y=normal[value_col],
            mode='lines+markers', name='Normal',
            line=dict(color='#4e79a7')
        ))

        fig.add_trace(go.Scatter(
            x=anomalies[date_col], y=anomalies[value_col],
            mode='markers', name='Anomaly',
            marker=dict(color='red', size=12, symbol='x')
        ))

        # Add normal range band
        fig.add_hrect(
            y0=lower, y1=upper,
            fillcolor="lightgreen", opacity=0.1,
            annotation_text="Normal range"
        )

        fig.update_layout(
            title="Time Series Data (Anomaly Highlighted)",
            template="plotly_white",
            height=500
        )
        return fig
```

### 3.4 Analysis Pipeline

```python
# 複数ステップの分析パイプライン
class AnalysisPipeline:
    def __init__(self):
        self.client = anthropic.Anthropic()

    def comprehensive_analysis(self, db_path: str, topic: str) -> dict:
        """Comprehensive data analysis on a given topic"""
        agent = TextToSQLAgent(db_path)

        # Step 1: Summary statistics
        overview = agent.query(f"Overall summary of {topic} (count, total, average)")

        # Step 2: Trend analysis
        trend = agent.query(f"Monthly trend for {topic}")

        # Step 3: Top N analysis
        top_items = agent.query(f"Top 10 items for {topic}")

        # Step 4: Distribution analysis
        distribution = agent.query(f"Distribution by category for {topic}")

        # Step 5: Period comparison
        comparison = agent.query(f"Month-over-month comparison for {topic}")

        # Step 6: Integrated insights
        insights = self._generate_insights({
            "overview": overview,
            "trend": trend,
            "top_items": top_items,
            "distribution": distribution,
            "comparison": comparison
        })

        return {
            "overview": overview,
            "trend": trend,
            "top_items": top_items,
            "distribution": distribution,
            "comparison": comparison,
            "insights": insights
        }

    def _generate_insights(self, analysis_results: dict) -> str:
        """Integrate multiple analysis results to generate insights"""
        results_text = json.dumps(analysis_results, ensure_ascii=False, default=str)[:5000]

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
From the following analysis results, extract 3-5 business insights.

Analysis results:
{results_text}

For each insight include the following:
1. Finding (what was discovered)
2. Business impact (why it matters)
3. Recommended action (what to do)

Format:
### Insight 1: [Title]
- Finding: ...
- Impact: ...
- Action: ...
"""}]
        )
        return response.content[0].text

    def anomaly_analysis(self, db_path: str, metric: str,
                         period: str = "last 30 days") -> dict:
        """Anomaly detection and root cause analysis"""
        agent = TextToSQLAgent(db_path)

        # Step 1: Retrieve baseline data
        baseline = agent.query(
            f"Daily data (date, value) for {metric} over {period}"
        )

        # Step 2: Statistical anomaly detection
        stats = agent.query(
            f"Mean, standard deviation, min, and max of {metric} over {period}"
        )

        # Step 3: Identify anomalous days
        anomalies = agent.query(
            f"Days when {metric} was more than twice the normal or less than half"
        )

        # Step 4: Analyze potential causes
        if anomalies.get("results", {}).get("rows"):
            cause_analysis = self._analyze_causes(
                agent, metric, anomalies
            )
        else:
            cause_analysis = "No anomalies detected"

        return {
            "baseline": baseline,
            "statistics": stats,
            "anomalies": anomalies,
            "cause_analysis": cause_analysis
        }

    def _analyze_causes(self, agent: TextToSQLAgent,
                        metric: str, anomalies: dict) -> str:
        """Analyze root causes of anomalies"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Anomalies were detected in {metric}:
{json.dumps(anomalies, ensure_ascii=False, default=str)[:2000]}

List 3 possible causes for these anomalies, and for each
suggest a SQL query to investigate further.
"""}]
        )
        return response.content[0].text
```

---

## 4. Integrating Multiple Data Sources

### 4.1 Multi-Source Agent

```python
# 複数のデータソースを横断する分析エージェント
from abc import ABC, abstractmethod

class DataSource(ABC):
    """Abstract interface for data sources"""

    @abstractmethod
    def get_schema(self) -> str:
        pass

    @abstractmethod
    def execute_query(self, sql: str) -> QueryResult:
        pass

    @abstractmethod
    def get_sample_data(self, table: str, limit: int = 5) -> list[dict]:
        pass

class SQLiteSource(DataSource):
    def __init__(self, db_path: str, name: str = "sqlite"):
        self.db_path = db_path
        self.name = name

    def get_schema(self) -> str:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
        schemas = cursor.fetchall()
        conn.close()
        return "\n".join(s[0] for s in schemas if s[0])

    def execute_query(self, sql: str) -> QueryResult:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA query_only = ON")
        cursor = conn.cursor()
        start = time.time()
        try:
            cursor.execute(sql)
            columns = [d[0] for d in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            elapsed = (time.time() - start) * 1000
            return QueryResult(
                query=sql, columns=columns, rows=rows[:1000],
                row_count=len(rows), execution_time_ms=elapsed,
                truncated=len(rows) > 1000
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            return QueryResult(
                query=sql, columns=[], rows=[], row_count=0,
                execution_time_ms=elapsed, error=str(e)
            )
        finally:
            conn.close()

    def get_sample_data(self, table: str, limit: int = 5) -> list[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table} LIMIT {limit}")
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        conn.close()
        return [dict(zip(columns, row)) for row in rows]

class PostgreSQLSource(DataSource):
    def __init__(self, connection_string: str, name: str = "postgres"):
        self.connection_string = connection_string
        self.name = name

    def get_schema(self) -> str:
        import psycopg2
        conn = psycopg2.connect(self.connection_string)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)
        rows = cursor.fetchall()
        conn.close()

        tables: dict[str, list] = {}
        for table, col, dtype, nullable in rows:
            if table not in tables:
                tables[table] = []
            null_str = "NULL" if nullable == "YES" else "NOT NULL"
            tables[table].append(f"    {col} {dtype} {null_str}")

        schemas = []
        for table, cols in tables.items():
            schemas.append(f"CREATE TABLE {table} (\n" + ",\n".join(cols) + "\n);")
        return "\n\n".join(schemas)

    def execute_query(self, sql: str) -> QueryResult:
        import psycopg2
        conn = psycopg2.connect(self.connection_string)
        conn.set_session(readonly=True)
        cursor = conn.cursor()
        start = time.time()
        try:
            cursor.execute(sql)
            columns = [d[0] for d in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            elapsed = (time.time() - start) * 1000
            return QueryResult(
                query=sql, columns=columns, rows=rows[:1000],
                row_count=len(rows), execution_time_ms=elapsed,
                truncated=len(rows) > 1000
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            return QueryResult(
                query=sql, columns=[], rows=[], row_count=0,
                execution_time_ms=elapsed, error=str(e)
            )
        finally:
            conn.close()

    def get_sample_data(self, table: str, limit: int = 5) -> list[dict]:
        import psycopg2
        conn = psycopg2.connect(self.connection_string)
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table} LIMIT {limit}")
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        conn.close()
        return [dict(zip(columns, row)) for row in rows]


class MultiSourceAgent:
    """Analysis agent that spans multiple data sources"""

    def __init__(self, sources: dict[str, DataSource]):
        self.sources = sources
        self.client = anthropic.Anthropic()
        self.validator = SQLValidator()

    def query(self, question: str) -> dict:
        """Select the appropriate data source and execute query for a natural language question"""

        # 1. Select the relevant data source
        source_name = self._select_source(question)
        source = self.sources[source_name]

        # 2. Retrieve schema
        schema = source.get_schema()

        # 3. SQL generation
        sql = self._generate_sql(question, schema, source_name)

        # 4. Validation
        is_valid, error = self.validator.validate(sql)
        if not is_valid:
            return {"error": f"SQL validation error: {error}"}

        # 5. Execution
        result = source.execute_query(sql)

        # 6. Interpretation
        interpretation = self._interpret(question, result)

        return {
            "source": source_name,
            "question": question,
            "sql": sql,
            "result": result,
            "interpretation": interpretation
        }

    def cross_source_analysis(self, question: str) -> dict:
        """Analysis spanning multiple data sources"""
        # Collect relevant data from each source
        partial_results = {}
        for name, source in self.sources.items():
            schema = source.get_schema()
            sub_question = self._decompose_question(question, name, schema)
            if sub_question:
                sql = self._generate_sql(sub_question, schema, name)
                is_valid, _ = self.validator.validate(sql)
                if is_valid:
                    partial_results[name] = source.execute_query(sql)

        # Integrate results and analyze
        unified_insight = self._unify_results(question, partial_results)
        return {
            "question": question,
            "partial_results": partial_results,
            "unified_insight": unified_insight
        }

    def _select_source(self, question: str) -> str:
        """Select the most suitable data source for the question"""
        source_descriptions = []
        for name, source in self.sources.items():
            schema_summary = source.get_schema()[:500]
            source_descriptions.append(f"- {name}: {schema_summary}")

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=64,
            messages=[{"role": "user", "content": f"""
From the following data sources, select the one best suited to answer the question.

Data sources:
{chr(10).join(source_descriptions)}

Question: {question}

Output only the data source name:
"""}]
        )
        name = response.content[0].text.strip()
        return name if name in self.sources else list(self.sources.keys())[0]

    def _generate_sql(self, question: str, schema: str, source_name: str) -> str:
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Data source: {source_name}
Schema:
{schema}

Question: {question}
Only SELECT is allowed. Output only the SQL query:
"""}]
        )
        sql = response.content[0].text.strip()
        if sql.startswith("```"):
            sql = sql.split("\n", 1)[1].rsplit("```", 1)[0]
        return sql.strip()

    def _decompose_question(self, question: str, source_name: str,
                            schema: str) -> Optional[str]:
        """Decompose a question into sub-questions per data source"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=256,
            messages=[{"role": "user", "content": f"""
Original question: {question}

Schema for data source "{source_name}":
{schema[:500]}

If this data source can answer part of the question,
output the sub-question for that part.
If not answerable, output "SKIP":
"""}]
        )
        result = response.content[0].text.strip()
        return None if result == "SKIP" else result

    def _interpret(self, question: str, result: QueryResult) -> str:
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Question: {question}
SQL: {result.query}
Result: columns={result.columns}, row count={result.row_count}
First 5 rows: {result.rows[:5]}

Interpret the results in English:
"""}]
        )
        return response.content[0].text

    def _unify_results(self, question: str,
                       partial_results: dict[str, QueryResult]) -> str:
        summaries = []
        for name, result in partial_results.items():
            summaries.append(
                f"[{name}] {result.summary()}\nFirst 3 rows: {result.rows[:3]}"
            )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
Question: {question}

Results from each data source:
{chr(10).join(summaries)}

Integrate the results from multiple data sources and
create a comprehensive answer in English:
"""}]
        )
        return response.content[0].text
```

---

## 5. Safety Design

```
Data Agent Security Layers

Layer 1: Query generation restriction
  └── Constrain prompt to generate only SELECT statements

Layer 2: SQL validation
  └── Static analysis of generated SQL syntax

Layer 3: DB connection restriction
  └── Connect with READ ONLY user

Layer 4: Result size limit
  └── Limit maximum rows and columns

Layer 5: Sensitive data masking
  └── Exclude PII (personally identifiable information)

Layer 6: Query rate limiting
  └── Limit number of queries per unit time

Layer 7: Audit logging
  └── Record all queries and detect anomalies
```

```python
# 多層セキュリティの実装
import re
import logging
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)

class SecureDataAgent:
    def __init__(self, db_config: dict):
        self.db_config = db_config
        self.max_rows = 1000
        self.max_columns = 50
        self.pii_columns = {"email", "phone", "ssn", "credit_card", "address", "password"}
        self.validator = SQLValidator()
        self._rate_limiter = RateLimiter(max_queries=100, window_seconds=3600)
        self._audit_log: list[dict] = []

    def execute_safely(self, sql: str, user_id: str = "anonymous") -> dict:
        """Execute query with multi-layer security applied"""
        start_time = time.time()

        # Layer 0: Rate limit check
        if not self._rate_limiter.allow(user_id):
            self._log_audit(user_id, sql, "RATE_LIMITED")
            return {"error": "Rate limit reached. Please try again later."}

        # Layer 1: Syntax validation
        is_valid, error = self.validator.validate(sql)
        if not is_valid:
            self._log_audit(user_id, sql, f"VALIDATION_FAILED: {error}")
            return {"error": f"SQL validation error: {error}"}

        # Layer 2: SQL injection detection
        if self._detect_injection(sql):
            self._log_audit(user_id, sql, "INJECTION_DETECTED")
            logger.warning(f"SQL injection detected: user={user_id}, sql={sql[:100]}")
            return {"error": "Malicious query pattern detected"}

        # Layer 3: READ ONLY connection
        conn = self._get_readonly_connection()

        try:
            cursor = conn.cursor()

            # Layer 4: Query timeout
            cursor.execute(f"SET statement_timeout = '30s'")
            cursor.execute(sql)

            # Layer 5: Result size limit
            columns = [desc[0] for desc in cursor.description]
            if len(columns) > self.max_columns:
                self._log_audit(user_id, sql, "TOO_MANY_COLUMNS")
                return {"error": f"Too many columns ({len(columns)}, max {self.max_columns})"}

            results = cursor.fetchmany(self.max_rows)
            truncated = cursor.fetchone() is not None

            # Layer 6: PII masking
            masked_results = self._mask_pii(columns, results)

            elapsed = (time.time() - start_time) * 1000
            self._log_audit(user_id, sql, "SUCCESS", elapsed)

            return {
                "columns": columns,
                "rows": masked_results,
                "row_count": len(masked_results),
                "truncated": truncated,
                "execution_time_ms": elapsed
            }
        except Exception as e:
            elapsed = (time.time() - start_time) * 1000
            self._log_audit(user_id, sql, f"ERROR: {str(e)}", elapsed)
            return {"error": str(e)}
        finally:
            conn.close()

    def _detect_injection(self, sql: str) -> bool:
        """Detect SQL injection patterns"""
        injection_patterns = [
            r";\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)",  # Multiple statements + dangerous ops
            r"UNION\s+ALL\s+SELECT\s+NULL",                  # UNION NULL pattern
            r"'\s*OR\s+'1'\s*=\s*'1",                        # OR 1=1
            r"'\s*OR\s+1\s*=\s*1",                           # OR 1=1 (numeric)
            r"CHAR\s*\(\s*\d+\s*\)",                         # CHAR function
            r"0x[0-9a-fA-F]+",                               # Hex literals
            r"INFORMATION_SCHEMA",                            # Metadata access
            r"pg_catalog",                                    # PostgreSQL catalog
            r"sqlite_master",                                 # SQLite master table
        ]
        for pattern in injection_patterns:
            if re.search(pattern, sql, re.IGNORECASE):
                return True
        return False

    def _get_readonly_connection(self):
        """Return a read-only DB connection"""
        import psycopg2
        conn = psycopg2.connect(
            host=self.db_config["host"],
            port=self.db_config.get("port", 5432),
            dbname=self.db_config["dbname"],
            user=self.db_config.get("readonly_user", "readonly"),
            password=self.db_config.get("readonly_password", ""),
        )
        conn.set_session(readonly=True, autocommit=True)
        return conn

    def _mask_pii(self, columns: list, rows: list) -> list:
        """Mask personally identifiable information columns"""
        pii_indices = {
            i for i, col in enumerate(columns)
            if col.lower() in self.pii_columns
            or any(pii in col.lower() for pii in self.pii_columns)
        }
        if not pii_indices:
            return rows

        return [
            tuple(
                "***MASKED***" if i in pii_indices else val
                for i, val in enumerate(row)
            )
            for row in rows
        ]

    def _log_audit(self, user_id: str, sql: str, status: str,
                   execution_time_ms: float = 0):
        """Record audit log entry"""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "sql": sql[:500],
            "status": status,
            "execution_time_ms": execution_time_ms
        }
        self._audit_log.append(entry)
        logger.info(f"AUDIT: {status} user={user_id} time={execution_time_ms:.1f}ms")

    def get_audit_summary(self, hours: int = 24) -> dict:
        """Summary of audit logs"""
        cutoff = datetime.now() - timedelta(hours=hours)
        recent = [
            e for e in self._audit_log
            if datetime.fromisoformat(e["timestamp"]) > cutoff
        ]
        status_counts = defaultdict(int)
        for entry in recent:
            status_counts[entry["status"]] += 1
        return {
            "total_queries": len(recent),
            "status_counts": dict(status_counts),
            "unique_users": len(set(e["user_id"] for e in recent))
        }


class RateLimiter:
    """Sliding window rate limiter"""

    def __init__(self, max_queries: int = 100, window_seconds: int = 3600):
        self.max_queries = max_queries
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def allow(self, user_id: str) -> bool:
        """Determine whether to allow the request"""
        now = time.time()
        cutoff = now - self.window_seconds

        # Remove expired requests
        self._requests[user_id] = [
            t for t in self._requests[user_id] if t > cutoff
        ]

        if len(self._requests[user_id]) >= self.max_queries:
            return False

        self._requests[user_id].append(now)
        return True

    def remaining(self, user_id: str) -> int:
        """Remaining number of requests"""
        now = time.time()
        cutoff = now - self.window_seconds
        current = len([t for t in self._requests.get(user_id, []) if t > cutoff])
        return max(0, self.max_queries - current)
```

---

## 6. Caching and Performance Optimization

### 6.1 Query Cache

```python
import hashlib
import pickle
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

@dataclass
class CacheEntry:
    """Cache entry"""
    result: QueryResult
    created_at: float
    ttl_seconds: float
    access_count: int = 0
    last_accessed: float = 0

    @property
    def is_expired(self) -> bool:
        return time.time() - self.created_at > self.ttl_seconds


class QueryCache:
    """Tiered cache: Memory → Disk"""

    def __init__(self, max_memory_entries: int = 100,
                 disk_cache_dir: Optional[str] = None,
                 default_ttl: float = 300):
        self._memory: dict[str, CacheEntry] = {}
        self.max_memory = max_memory_entries
        self.disk_dir = Path(disk_cache_dir) if disk_cache_dir else None
        self.default_ttl = default_ttl
        self._stats = {"hits": 0, "misses": 0, "evictions": 0}

        if self.disk_dir:
            self.disk_dir.mkdir(parents=True, exist_ok=True)

    def get(self, sql: str) -> Optional[QueryResult]:
        """Retrieve query result from cache"""
        key = self._key(sql)

        # Check memory cache
        if key in self._memory:
            entry = self._memory[key]
            if not entry.is_expired:
                entry.access_count += 1
                entry.last_accessed = time.time()
                self._stats["hits"] += 1
                return entry.result
            else:
                del self._memory[key]

        # Check disk cache
        if self.disk_dir:
            disk_path = self.disk_dir / f"{key}.pkl"
            if disk_path.exists():
                try:
                    with open(disk_path, "rb") as f:
                        entry = pickle.load(f)
                    if not entry.is_expired:
                        # Promote to memory
                        self._memory[key] = entry
                        entry.access_count += 1
                        entry.last_accessed = time.time()
                        self._stats["hits"] += 1
                        return entry.result
                    else:
                        disk_path.unlink()
                except Exception:
                    disk_path.unlink(missing_ok=True)

        self._stats["misses"] += 1
        return None

    def put(self, sql: str, result: QueryResult,
            ttl: Optional[float] = None):
        """Store query result in cache"""
        key = self._key(sql)
        entry = CacheEntry(
            result=result,
            created_at=time.time(),
            ttl_seconds=ttl or self.default_ttl,
            last_accessed=time.time()
        )

        # Store in memory cache
        if len(self._memory) >= self.max_memory:
            self._evict()
        self._memory[key] = entry

        # Also store in disk cache
        if self.disk_dir:
            disk_path = self.disk_dir / f"{key}.pkl"
            with open(disk_path, "wb") as f:
                pickle.dump(entry, f)

    def invalidate(self, sql: str):
        """Invalidate a specific cache entry"""
        key = self._key(sql)
        self._memory.pop(key, None)
        if self.disk_dir:
            (self.disk_dir / f"{key}.pkl").unlink(missing_ok=True)

    def clear(self):
        """Clear all cache"""
        self._memory.clear()
        if self.disk_dir:
            for f in self.disk_dir.glob("*.pkl"):
                f.unlink()

    def stats(self) -> dict:
        """Cache statistics"""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total > 0 else 0
        return {
            **self._stats,
            "hit_rate": f"{hit_rate:.1%}",
            "memory_entries": len(self._memory),
        }

    def _key(self, sql: str) -> str:
        normalized = " ".join(sql.strip().lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def _evict(self):
        """Evict cache using LRU policy"""
        if not self._memory:
            return
        oldest_key = min(
            self._memory, key=lambda k: self._memory[k].last_accessed
        )
        del self._memory[oldest_key]
        self._stats["evictions"] += 1
```

### 6.2 Query Optimization

```python
class QueryOptimizer:
    """Optimize generated SQL queries"""

    def optimize(self, sql: str, schema: str) -> str:
        """Optimize a SQL query"""
        optimizations = [
            self._add_limit_if_missing,
            self._optimize_select_star,
            self._suggest_index_hints,
        ]

        optimized = sql
        for opt in optimizations:
            optimized = opt(optimized, schema)

        return optimized

    def _add_limit_if_missing(self, sql: str, schema: str) -> str:
        """Add LIMIT if not present"""
        sql_upper = sql.upper().strip()
        if "LIMIT" not in sql_upper and "GROUP BY" not in sql_upper:
            if not sql.strip().endswith(";"):
                return f"{sql}\nLIMIT 1000"
            else:
                return f"{sql[:-1]}\nLIMIT 1000;"
        return sql

    def _optimize_select_star(self, sql: str, schema: str) -> str:
        """Limit SELECT * to necessary columns (log output only)"""
        if "SELECT *" in sql.upper() or "SELECT  *" in sql.upper():
            logger.info(
                "Performance warning: SELECT * detected. "
                "It is recommended to specify only the needed columns."
            )
        return sql

    def _suggest_index_hints(self, sql: str, schema: str) -> str:
        """Output index usage hints"""
        where_match = re.search(r'WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)',
                                sql, re.IGNORECASE | re.DOTALL)
        if where_match:
            where_clause = where_match.group(1)
            columns = re.findall(r'(\w+)\s*[=<>!]', where_clause)
            if columns:
                logger.info(
                    f"Recommended indexes: Check whether columns {columns} "
                    "used in the WHERE clause have indexes."
                )
        return sql
```

---

## 7. Comparison Tables

### 7.1 Text-to-SQL Approach Comparison

| Approach | Accuracy | Flexibility | Implementation Cost | Safety | Scalability |
|-----------|------|--------|-----------|--------|--------------|
| Direct SQL generation | Medium | High | Low | Low | Medium |
| Template-based | High | Low | Medium | High | Low |
| Few-shot + validation | High | Medium | Medium | Medium | High |
| Self-correction | Highest | High | High | Medium | High |
| Parse → SQL | High | Medium | High | High | Medium |
| Dynamic schema selection | High | High | High | High | Highest |

### 7.2 Data Analysis Tool Comparison

| Tool | Interactive | No SQL | Visualization | Cost | Customizability |
|--------|--------|---------|--------|--------|-------------|
| Data Agent | Yes | Yes | Automatic | API cost | High |
| Jupyter Notebook | Manual | No | Manual code | Free | Highest |
| Tableau / Looker | GUI | Yes | Drag & drop | Expensive | Medium |
| pandas + matplotlib | Manual | No | Manual code | Free | Highest |
| Metabase | GUI | Yes | Templates | Free/Paid | Low |
| Streamlit + LLM | Yes | Yes | Code generation | API cost | High |

### 7.3 Connection Methods by Data Source

| Data Source | Connection Method | READ ONLY Setting | Notes |
|-------------|---------|--------------|------|
| SQLite | File path | PRAGMA query_only | For local development |
| PostgreSQL | psycopg2 | SET SESSION READ ONLY | Recommended for production |
| MySQL | mysql-connector | READ ONLY user | Requires permission setup |
| BigQuery | google-cloud-bigquery | IAM role | Watch costs (scan billing) |
| Snowflake | snowflake-connector | WAREHOUSE READONLY | Watch credit usage |
| DuckDB | duckdb | access_mode='read_only' | Analytics-focused, high performance |

---

## 8. Error Handling and Self-Correction

### 8.1 Basic Self-Correction Pattern

```python
# SQL生成の自己修正パターン
class SelfCorrectingAgent(TextToSQLAgent):
    def query_with_retry(self, question: str, max_retries: int = 3) -> dict:
        """Self-correct and retry on SQL errors"""
        sql = self._generate_sql(question)
        errors_history = []

        for attempt in range(max_retries):
            if not self._is_safe_query(sql):
                return {"error": "Unsafe query"}

            results = self._execute_sql(sql)

            if "error" not in results:
                return {
                    "sql": sql,
                    "results": results,
                    "attempts": attempt + 1,
                    "errors_history": errors_history
                }

            # Accumulate error history
            errors_history.append({
                "attempt": attempt + 1,
                "sql": sql,
                "error": results["error"]
            })

            # Self-correct based on error
            sql = self._fix_sql(question, sql, results["error"], errors_history)

        return {
            "error": f"Failed after {max_retries} attempts",
            "errors_history": errors_history
        }

    def _fix_sql(self, question: str, bad_sql: str, error: str,
                 history: list[dict]) -> str:
        """Fix SQL based on the error message"""
        history_text = ""
        if len(history) > 1:
            history_text = "\nPrevious attempts:\n"
            for h in history[:-1]:
                history_text += f"  SQL: {h['sql']}\n  Error: {h['error']}\n"

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
The following SQL produced an error. Please fix it.

Schema: {self.schema}
Original question: {question}
Failed SQL: {bad_sql}
Error: {error}
{history_text}
Important: Do not generate the same SQL that previously failed.
Output only the corrected SQL:
"""}]
        )
        return response.content[0].text.strip()
```

### 8.2 Stepwise Query Decomposition

```python
class DecomposingAgent:
    """Stepwise decomposition and execution of complex questions"""

    def __init__(self, db_path: str):
        self.client = anthropic.Anthropic()
        self.agent = TextToSQLAgent(db_path)

    def query_complex(self, question: str) -> dict:
        """Decompose a complex question and execute sequentially"""

        # Step 1: Assess question complexity
        complexity = self._assess_complexity(question)

        if complexity == "simple":
            return self.agent.query(question)

        # Step 2: Decompose into sub-questions
        sub_questions = self._decompose(question)

        # Step 3: Execute each sub-question sequentially
        sub_results = []
        for i, sq in enumerate(sub_questions):
            result = self.agent.query(sq)
            sub_results.append({
                "sub_question": sq,
                "result": result,
                "step": i + 1
            })

        # Step 4: Integrate results
        final_answer = self._synthesize(question, sub_results)

        return {
            "question": question,
            "complexity": complexity,
            "sub_results": sub_results,
            "final_answer": final_answer
        }

    def _assess_complexity(self, question: str) -> str:
        """Assess the complexity of the question"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=32,
            messages=[{"role": "user", "content": f"""
Can the following question be answered with a single SQL query?

Question: {question}

Answer: output only "simple" or "complex"
"""}]
        )
        return response.content[0].text.strip().lower()

    def _decompose(self, question: str) -> list[str]:
        """Decompose a question into sub-questions"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[{"role": "user", "content": f"""
Decompose the following complex question into sub-questions,
each answerable with a single SQL query.

Question: {question}
Database schema: {self.agent.schema}

Output sub-questions as a numbered list (one per line):
"""}]
        )
        lines = response.content[0].text.strip().split("\n")
        return [
            re.sub(r'^\d+[\.\)]\s*', '', line).strip()
            for line in lines
            if line.strip() and re.match(r'^\d+', line.strip())
        ]

    def _synthesize(self, question: str, sub_results: list[dict]) -> str:
        """Integrate sub-results to generate a final answer"""
        results_text = ""
        for sr in sub_results:
            results_text += f"""
Step {sr['step']}: {sr['sub_question']}
Result: {json.dumps(sr['result'].get('results', {}), ensure_ascii=False, default=str)[:500]}
"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Original question: {question}

Results from each step:
{results_text}

Integrate these results and create a comprehensive answer to the original question:
"""}]
        )
        return response.content[0].text
```

---

## 9. Production Patterns

### 9.1 Streamlit-based Data Analysis UI

```python
# streamlit_app.py
import streamlit as st

def main():
    st.set_page_config(page_title="Data Analysis Agent", layout="wide")
    st.title("Data Analysis Agent")

    # Sidebar: Settings
    with st.sidebar:
        st.header("Settings")
        db_path = st.text_input("Database path", "data/sample.db")
        model = st.selectbox("Model", [
            "claude-sonnet-4-20250514",
            "claude-haiku-4-20250514"
        ])
        max_rows = st.slider("Max rows", 10, 1000, 100)

    # Initialize agent
    if "agent" not in st.session_state:
        config = DataAgentConfig(
            role=AgentRole.QUERY,
            db_connections={"main": db_path},
            max_rows=max_rows,
            model_name=model
        )
        st.session_state.agent = SelfCorrectingAgent(db_path, config)
        st.session_state.history = []

    # Display chat history
    for entry in st.session_state.history:
        with st.chat_message("user"):
            st.write(entry["question"])
        with st.chat_message("assistant"):
            st.write(entry["interpretation"])
            if entry.get("sql"):
                with st.expander("Executed SQL"):
                    st.code(entry["sql"], language="sql")
            if entry.get("chart_path"):
                st.image(entry["chart_path"])

    # Input
    question = st.chat_input("Ask a question about your data")
    if question:
        with st.chat_message("user"):
            st.write(question)

        with st.chat_message("assistant"):
            with st.spinner("Analyzing..."):
                result = st.session_state.agent.query_with_retry(question)

            if "error" in result:
                st.error(result["error"])
            else:
                st.write(result.get("interpretation", ""))

                with st.expander("Executed SQL"):
                    st.code(result["sql"], language="sql")

                # Result table
                if result.get("results", {}).get("rows"):
                    import pandas as pd
                    df = pd.DataFrame(
                        result["results"]["rows"],
                        columns=result["results"]["columns"]
                    )
                    st.dataframe(df, use_container_width=True)

                    # Auto visualization
                    visualizer = DataVisualizer()
                    chart_type = visualizer.auto_visualize(result["results"])
                    st.info(f"Recommended chart: {chart_type}")

                # Add to history
                st.session_state.history.append({
                    "question": question,
                    "sql": result.get("sql"),
                    "interpretation": result.get("interpretation", ""),
                })

if __name__ == "__main__":
    main()
```

### 9.2 API Server

```python
# FastAPIベースのデータ分析APIサーバー
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn

app = FastAPI(title="Data Agent API", version="1.0.0")

class QueryRequest(BaseModel):
    question: str = Field(..., description="Natural language question")
    db_name: str = Field(default="main", description="Database name")
    max_rows: int = Field(default=100, le=1000, description="Maximum rows")
    enable_visualization: bool = Field(default=False, description="Include visualization")

class QueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[list]
    row_count: int
    interpretation: str
    execution_time_ms: float
    cached: bool = False
    chart_url: Optional[str] = None

class AnalysisRequest(BaseModel):
    topic: str = Field(..., description="Analysis topic")
    db_name: str = Field(default="main")
    analysis_type: str = Field(
        default="comprehensive",
        description="Analysis type: comprehensive, trend, anomaly"
    )

# Global agent instances
agents: dict[str, SecureDataAgent] = {}
cache = QueryCache(max_memory_entries=500, default_ttl=300)

@app.on_event("startup")
async def startup():
    """Initialize agents on startup"""
    db_configs = {
        "main": {"host": "localhost", "dbname": "analytics", "readonly_user": "reader"},
        "logs": {"host": "localhost", "dbname": "logs", "readonly_user": "reader"},
    }
    for name, config in db_configs.items():
        agents[name] = SecureDataAgent(config)

@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Query data using natural language"""
    if request.db_name not in agents:
        raise HTTPException(404, f"Database '{request.db_name}' not found")

    agent = agents[request.db_name]

    # Cache check (question-based since SQL is unknown)
    cache_key = f"{request.db_name}:{request.question}"
    cached_result = cache.get(cache_key)
    if cached_result:
        return QueryResponse(
            question=request.question,
            sql=cached_result.query,
            columns=cached_result.columns,
            rows=[list(r) for r in cached_result.rows],
            row_count=cached_result.row_count,
            interpretation="(Cached result)",
            execution_time_ms=0,
            cached=True
        )

    try:
        result = agent.execute_safely(request.question)
        if "error" in result:
            raise HTTPException(400, result["error"])

        return QueryResponse(
            question=request.question,
            sql=result.get("sql", ""),
            columns=result["columns"],
            rows=result["rows"],
            row_count=result["row_count"],
            interpretation=result.get("interpretation", ""),
            execution_time_ms=result["execution_time_ms"],
        )
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    """Run comprehensive data analysis"""
    pipeline = AnalysisPipeline()
    try:
        if request.analysis_type == "comprehensive":
            result = pipeline.comprehensive_analysis(
                request.db_name, request.topic
            )
        elif request.analysis_type == "anomaly":
            result = pipeline.anomaly_analysis(
                request.db_name, request.topic
            )
        else:
            raise HTTPException(400, f"Unsupported analysis type: {request.analysis_type}")

        return result
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "databases": list(agents.keys())}

@app.get("/cache/stats")
async def cache_stats():
    return cache.stats()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 9.3 Slack Bot Integration

```python
# Slackボットとしてデータエージェントを運用
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

slack_app = App(token="xoxb-your-bot-token")
agent = SelfCorrectingAgent("data/analytics.db")

@slack_app.event("app_mention")
def handle_mention(event, say):
    """Run data analysis when mentioned"""
    question = event["text"].split(">", 1)[-1].strip()
    user = event["user"]

    if not question:
        say("Please enter a question. Example: @DataBot What were last month's sales?")
        return

    say(f"<@{user}> Analyzing... :hourglass:")

    try:
        result = agent.query_with_retry(question)

        if "error" in result:
            say(f"<@{user}> Error: {result['error']}")
            return

        # Format results
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Question:* {question}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Answer:*\n{result.get('interpretation', 'No result')}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"```sql\n{result.get('sql', 'N/A')}\n```"
                }
            }
        ]

        # Table-formatted results (up to 10 rows)
        results_data = result.get("results", {})
        if results_data.get("rows"):
            columns = results_data["columns"]
            rows = results_data["rows"][:10]
            table = " | ".join(columns) + "\n"
            table += " | ".join(["---"] * len(columns)) + "\n"
            for row in rows:
                table += " | ".join(str(v) for v in row) + "\n"
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"```\n{table}\n```"}
            })

        say(blocks=blocks)

    except Exception as e:
        say(f"<@{user}> An unexpected error occurred: {str(e)}")

@slack_app.command("/data-query")
def handle_command(ack, say, command):
    """Execute query via slash command"""
    ack()
    question = command["text"]
    user = command["user_id"]

    result = agent.query_with_retry(question)
    if "error" in result:
        say(f"<@{user}> Error: {result['error']}")
    else:
        say(f"<@{user}>\n{result.get('interpretation', '')}")

if __name__ == "__main__":
    handler = SocketModeHandler(slack_app, "xapp-your-app-token")
    handler.start()
```

---

## 10. Monitoring and Cost Management

### 10.1 Cost Tracking

```python
class CostTracker:
    """Track API call costs"""

    # Anthropic API pricing (approximate as of 2025, USD)
    PRICING = {
        "claude-sonnet-4-20250514": {"input": 3.0 / 1_000_000, "output": 15.0 / 1_000_000},
        "claude-haiku-4-20250514": {"input": 0.25 / 1_000_000, "output": 1.25 / 1_000_000},
    }

    def __init__(self):
        self._sessions: dict[str, list[dict]] = defaultdict(list)

    def record(self, session_id: str, model: str,
               input_tokens: int, output_tokens: int):
        """Record an API call"""
        pricing = self.PRICING.get(model, {"input": 0, "output": 0})
        cost = (input_tokens * pricing["input"] +
                output_tokens * pricing["output"])

        self._sessions[session_id].append({
            "timestamp": time.time(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost
        })

    def session_cost(self, session_id: str) -> float:
        """Total cost for a session"""
        return sum(e["cost_usd"] for e in self._sessions.get(session_id, []))

    def daily_report(self) -> dict:
        """Daily cost report"""
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time()).timestamp()

        total_cost = 0
        total_calls = 0
        model_costs: dict[str, float] = defaultdict(float)

        for session_id, entries in self._sessions.items():
            for entry in entries:
                if entry["timestamp"] >= today_start:
                    total_cost += entry["cost_usd"]
                    total_calls += 1
                    model_costs[entry["model"]] += entry["cost_usd"]

        return {
            "date": str(today),
            "total_cost_usd": round(total_cost, 4),
            "total_api_calls": total_calls,
            "model_breakdown": {
                k: round(v, 4) for k, v in model_costs.items()
            },
            "active_sessions": len(self._sessions)
        }
```

### 10.2 Performance Monitoring

```python
class PerformanceMonitor:
    """Monitor query performance"""

    def __init__(self):
        self._metrics: list[dict] = []

    def record_query(self, sql: str, execution_time_ms: float,
                     row_count: int, success: bool):
        """Record query metrics"""
        self._metrics.append({
            "timestamp": time.time(),
            "sql_length": len(sql),
            "execution_time_ms": execution_time_ms,
            "row_count": row_count,
            "success": success
        })

    def get_summary(self, last_n: int = 100) -> dict:
        """Performance summary"""
        recent = self._metrics[-last_n:]
        if not recent:
            return {"message": "No metrics"}

        times = [m["execution_time_ms"] for m in recent]
        success_count = sum(1 for m in recent if m["success"])

        return {
            "total_queries": len(recent),
            "success_rate": f"{success_count / len(recent):.1%}",
            "avg_execution_ms": round(sum(times) / len(times), 1),
            "p50_execution_ms": round(sorted(times)[len(times) // 2], 1),
            "p95_execution_ms": round(sorted(times)[int(len(times) * 0.95)], 1),
            "max_execution_ms": round(max(times), 1),
            "avg_row_count": round(
                sum(m["row_count"] for m in recent) / len(recent), 1
            ),
        }

    def slow_queries(self, threshold_ms: float = 5000) -> list[dict]:
        """Detect slow queries"""
        return [
            m for m in self._metrics
            if m["execution_time_ms"] > threshold_ms
        ]
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Fetching All Data

```python
# NG: テーブル全体をLLMに渡す
sql = "SELECT * FROM orders"  # 100万行!
results = execute(sql)
llm.analyze(results)  # コンテキスト超過

# OK: 集計してから分析
sql = """
SELECT
    DATE(ordered_at) as date,
    COUNT(*) as order_count,
    SUM(total_price) as revenue
FROM orders
GROUP BY DATE(ordered_at)
ORDER BY date DESC
LIMIT 30
"""
```

### Anti-Pattern 2: Generating SQL Without Schema Information

```python
# NG: スキーマを渡さずにSQL生成
llm.generate("Show me sales")  # Doesn't know table or column names → hallucination

# OK: スキーマ + サンプルデータを必ず提供
llm.generate(f"""
Schema: {schema}
Sample rows: {sample_rows}
Question: Show me sales
""")
```

### Anti-Pattern 3: Connecting with Write Permissions

```python
# NG: 管理者権限でデータエージェントを接続
conn = psycopg2.connect(
    user="admin",      # Full privileges
    password="secret",
    dbname="production"
)

# OK: 読み取り専用ユーザーで接続
conn = psycopg2.connect(
    user="readonly_agent",  # SELECT only
    password="readonly_pass",
    dbname="production"
)
conn.set_session(readonly=True)
```

### Anti-Pattern 4: Running in Production Without Error Handling

```python
# NG: エラーを握りつぶす
def query(question):
    sql = generate_sql(question)
    return execute(sql)  # Crashes on error

# OK: 多層のエラーハンドリング
def query_safely(question):
    try:
        sql = generate_sql(question)
        is_valid, error = validator.validate(sql)
        if not is_valid:
            return {"error": f"Validation failed: {error}", "sql": sql}

        result = execute_with_timeout(sql, timeout=30)
        if result.error:
            # Attempt self-correction
            corrected = self_correct(question, sql, result.error)
            result = execute_with_timeout(corrected, timeout=30)

        return result
    except TimeoutError:
        return {"error": "Query timed out (30 seconds)"}
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return {"error": "An internal error occurred"}
```

### Anti-Pattern 5: Repeating the Same Query Without Caching

```python
# NG: 同じ質問を毎回LLMに送信
for department in departments:
    # 50 departments × (SQL generation + interpretation) = 100 API calls
    result = agent.query(f"What are the sales for {department}?")

# OK: パラメータ化 + キャッシュ
template_sql = agent.generate_sql("What are the sales by department?")
# → SELECT department, SUM(revenue) FROM sales GROUP BY department
result = agent.execute(template_sql)  # Get all departments with one DB call
```

---

## 12. Practical Scenario Guides

### Scenario 1: E-Commerce Sales Analysis

```python
# ECサイト分析エージェントの具体的な使用例
class ECommerceAnalyst:
    """Data analysis agent specialized for e-commerce"""

    def __init__(self, db_path: str):
        self.agent = SelfCorrectingAgent(db_path)
        self.visualizer = DataVisualizer()

    def daily_report(self) -> dict:
        """Automatically generate a daily sales report"""
        queries = {
            "summary": "Today's total sales, order count, and average order value",
            "hourly": "Today's hourly sales trend",
            "top_products": "Today's top 10 products by sales",
            "categories": "Today's sales composition by category",
            "comparison": "Sales comparison vs yesterday and same day last week",
            "new_customers": "Today's new customer count and their sales",
            "cancellations": "Today's cancellation count and amount"
        }

        results = {}
        for key, question in queries.items():
            results[key] = self.agent.query_with_retry(question)

        return results

    def customer_cohort_analysis(self, months: int = 6) -> dict:
        """Customer cohort analysis"""
        return self.agent.query_with_retry(f"""
Monthly customer cohort analysis for the past {months} months:
Show the retention rate for each cohort of customers
who made their first purchase in a given month,
and how many returned in subsequent months.
""")

    def product_recommendation_data(self, product_id: int) -> dict:
        """Data for product recommendations"""
        return self.agent.query_with_retry(f"""
Top 10 products most frequently purchased together with product ID {product_id}
(aggregate products in the same order)
""")
```

### Scenario 2: SaaS Metrics Dashboard

```python
class SaaSMetricsAgent:
    """SaaS KPI automated analysis agent"""

    def __init__(self, db_path: str):
        self.agent = SelfCorrectingAgent(db_path)

    def calculate_mrr(self) -> dict:
        """Calculate Monthly Recurring Revenue (MRR)"""
        return self.agent.query_with_retry("""
Calculate this month's MRR (Monthly Recurring Revenue):
- New MRR: total monthly fees from new contracts this month
- Expansion MRR: total upgrade differences for customers this month
- Contraction MRR: total downgrade differences for customers this month
- Churned MRR: total monthly fees from customers who cancelled this month
- Net MRR: New + Expansion - Contraction - Churned
""")

    def churn_analysis(self) -> dict:
        """Churn analysis"""
        return self.agent.query_with_retry("""
Monthly churn rate and reason analysis for the past 12 months:
- Monthly churn count and rate
- Breakdown of churn reasons by category
- Churn rate comparison by plan
- Usage before churn (days since last login)
""")

    def ltv_analysis(self) -> dict:
        """Customer Lifetime Value (LTV) analysis"""
        return self.agent.query_with_retry("""
LTV (Life Time Value) analysis by plan:
- Average contract duration (months) per plan
- Monthly fee per plan
- Calculated LTV = monthly fee × average contract duration
- Customer count per plan
""")
```

---

## 13. FAQ

### Q1: What is the Text-to-SQL accuracy for large databases (100+ tables)?

When there are many tables, including all schemas in the prompt adds noise and reduces accuracy. Mitigation strategies:
- **Automatic relevant table selection**: Narrow down related tables in two steps (step 1: keyword matching, step 2: LLM selection)
- **Schema summarization**: Pass only table descriptions first, then provide CREATE TABLE statements after selection
- **SchemaSelector class**: Use the dynamic schema selection implemented in section 2.3

### Q2: Can data agents be applied to real-time dashboards?

Data agents are well suited for ad-hoc analysis but are not ideal for real-time dashboards (latency + cost). Recommended approach:
- **Ad-hoc analysis**: Data agent
- **Periodic reports**: Generate query once with agent → migrate to scheduled execution
- **Real-time**: Traditional BI tools (e.g., Metabase)

### Q3: How do you guarantee data freshness?

- **Timestamped responses**: "This data is as of January 31, 2025"
- **Check data update time**: Verify last update date via metadata table
- **Cache expiration**: Set expiration on cached results for the same query

### Q4: How do you measure Text-to-SQL accuracy?

```python
# SQL生成精度のベンチマーク
class SQLAccuracyBenchmark:
    def __init__(self, agent: TextToSQLAgent):
        self.agent = agent
        self.test_cases: list[dict] = []

    def add_test(self, question: str, expected_sql: str,
                 expected_result: list = None):
        self.test_cases.append({
            "question": question,
            "expected_sql": expected_sql,
            "expected_result": expected_result
        })

    def run(self) -> dict:
        correct = 0
        results = []
        for tc in self.test_cases:
            generated = self.agent._generate_sql(tc["question"])
            # Result-based comparison (judge by execution result, not SQL string)
            gen_result = self.agent._execute_sql(generated)
            exp_result = self.agent._execute_sql(tc["expected_sql"])

            match = (gen_result.get("rows") == exp_result.get("rows"))
            if match:
                correct += 1
            results.append({
                "question": tc["question"],
                "generated_sql": generated,
                "expected_sql": tc["expected_sql"],
                "match": match
            })

        return {
            "total": len(self.test_cases),
            "correct": correct,
            "accuracy": f"{correct/len(self.test_cases):.1%}" if self.test_cases else "N/A",
            "details": results
        }
```

### Q5: What are the best practices for cost reduction?

| Strategy | Effect | Implementation Difficulty |
|------|------|-----------|
| Query cache | Reduces API calls for duplicate questions | Low |
| Pre-classification with smaller model | Use Haiku for non-SQL generation tasks | Low |
| Prompt optimization with few-shot examples | Reduces tokens + improves accuracy | Medium |
| Batch processing (periodic reports) | Reduces real-time calls | Medium |
| Schema compression | Reduces input tokens | Medium |

### Q6: How do you handle multiple database dialects?

```python
# データベース方言の抽象化
class SQLDialect:
    """Abstraction layer for SQL dialect differences"""

    DIALECTS = {
        "sqlite": {
            "current_date": "DATE('now')",
            "date_diff": "JULIANDAY({end}) - JULIANDAY({start})",
            "limit": "LIMIT {n}",
            "string_concat": "{a} || {b}",
        },
        "postgresql": {
            "current_date": "CURRENT_DATE",
            "date_diff": "({end}::date - {start}::date)",
            "limit": "LIMIT {n}",
            "string_concat": "{a} || {b}",
        },
        "mysql": {
            "current_date": "CURDATE()",
            "date_diff": "DATEDIFF({end}, {start})",
            "limit": "LIMIT {n}",
            "string_concat": "CONCAT({a}, {b})",
        },
    }

    @classmethod
    def get_prompt_hint(cls, dialect: str) -> str:
        """Include SQL dialect hints in the prompt"""
        d = cls.DIALECTS.get(dialect, {})
        hints = [f"Database: {dialect}"]
        for key, val in d.items():
            hints.append(f"  {key}: {val}")
        return "\n".join(hints)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|------|
| Core flow | Question understanding → SQL generation → validation → execution → analysis → visualization |
| Text-to-SQL | Schema info + question → generate SELECT statement (enhanced with few-shot) |
| Safety | 7-layer defense: validation → READ ONLY → PII masking → rate limiting → audit logging |
| Visualization | Automatic chart selection based on data characteristics (matplotlib/Plotly) |
| Self-correction | On SQL error, correct with error history (up to 3 retries) |
| Multiple sources | Cross-DB analysis with DataSource abstraction |
| Cache | Tiered memory → disk cache, LRU eviction |
| Production | Streamlit UI / FastAPI / Slack bot |
| Core principle | Aggregate before passing to LLM. Never read all raw data |

## Next Guides to Read

- [../04-production/00-deployment.md](../04-production/00-deployment.md) -- Deploying data agents
- [../00-fundamentals/03-memory-systems.md](../00-fundamentals/03-memory-systems.md) -- RAG and vector search
- [../01-patterns/02-workflow-agents.md](../01-patterns/02-workflow-agents.md) -- Analysis workflows
- [../02-implementation/04-evaluation.md](../02-implementation/04-evaluation.md) -- Evaluation and benchmarking
