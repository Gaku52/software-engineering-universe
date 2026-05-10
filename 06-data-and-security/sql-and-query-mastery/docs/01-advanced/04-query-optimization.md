# Query Optimization — EXPLAIN, Execution Plans, Statistics, and Query Rewriting

> Query optimization is the process of identifying the root cause of database performance issues and resolving them systematically. Reading execution plans with the EXPLAIN command is the first step. This chapter teaches you to accurately interpret every element of EXPLAIN output, understand how scan and join methods are chosen, and master optimization techniques using statistics and query rewriting.

---

## What You Will Learn

1. **Accurately read EXPLAIN / EXPLAIN ANALYZE output** — cost calculation, deviation between estimated and actual row counts, interpreting buffer information
2. **Understand the characteristics of major scan and join methods** — Sequential Scan, Index Scan, Bitmap Scan, Nested Loop, Hash Join, Merge Join
3. **Statistics internals and query rewriting for optimization** — pg_stats, extended statistics, IN→EXISTS rewriting, CTE optimization
4. **Practical performance analysis workflow** — pg_stat_statements, auto_explain, bottleneck identification techniques

---

## Prerequisites

| Topic | Content | Reference |
|---------|------|--------|
| SQL Basics | SELECT/JOIN/subquery syntax | [00-basics/](../00-basics/) |
| Indexes | B-Tree, GIN, GiST basics | [03-indexing.md](./03-indexing.md) |
| Table Design | Normalization, constraint basics | [00-normalization.md](../02-design/00-normalization.md) |

---

## 1. EXPLAIN Basics

### Why EXPLAIN Matters

Reflexively adding an index because a query is "slow" misses the root cause. EXPLAIN is a tool for scientifically diagnosing "why this query is slow" and is the only starting point for database performance tuning.

### Code Example 1: EXPLAIN and EXPLAIN ANALYZE

```sql
-- テスト用テーブルの準備
CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    department_id INTEGER NOT NULL,
    salary        INTEGER NOT NULL,
    hired_date    DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE departments (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- EXPLAIN: 実行計画を推定（実行しない — 安全）
EXPLAIN
SELECT e.name, d.name AS department
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
WHERE e.salary > 500000;

-- 出力例:
-- Hash Join  (cost=1.09..2.24 rows=3 width=64)
--   Hash Cond: (e.department_id = d.id)
--   ->  Seq Scan on employees e  (cost=0.00..1.12 rows=3 width=40)
--         Filter: (salary > 500000)
--   ->  Hash  (cost=1.05..1.05 rows=5 width=36)
--         ->  Seq Scan on departments d  (cost=0.00..1.05 rows=5 width=36)


-- EXPLAIN ANALYZE: 実際に実行して測定（DMLに注意）
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT e.name, d.name AS department
FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
WHERE e.salary > 500000;

-- 出力例:
-- Hash Join  (cost=1.09..2.24 rows=3 width=64)
--            (actual time=0.035..0.042 rows=5 loops=1)
--   Hash Cond: (e.department_id = d.id)
--   Buffers: shared hit=2
--   ->  Seq Scan on employees e  (cost=0.00..1.12 rows=3 width=40)
--                                (actual time=0.012..0.018 rows=5 loops=1)
--         Filter: (salary > 500000)
--         Rows Removed by Filter: 95
--         Buffers: shared hit=1
--   ->  Hash  (cost=1.05..1.05 rows=5 width=36)
--             (actual time=0.008..0.008 rows=5 loops=1)
--         Buckets: 1024  Batches: 1
--         ->  Seq Scan on departments d  (cost=0.00..1.05 rows=5 width=36)
--                                        (actual time=0.003..0.004 rows=5 loops=1)
--         Buffers: shared hit=1
-- Planning Time: 0.15 ms
-- Execution Time: 0.08 ms
```

### How to Read EXPLAIN Output

```
┌─────────── EXPLAIN 出力の構成要素 ──────────────┐
│                                                   │
│  Hash Join (cost=1.09..2.24 rows=3 width=64)      │
│  ~~~~~~~~  ~~~~~  ~~~~~~~~ ~~~~~ ~~~~~~~~         │
│  Node      Startup Total    Est.  Row width       │
│  name      cost    cost     rows  (bytes)         │
│                                                   │
│  (actual time=0.035..0.042 rows=5 loops=1)        │
│  ~~~~~~~~~~~~~~~  ~~~~~~~~ ~~~~~ ~~~~~~~          │
│  Actual startup   Actual   Actual Loop            │
│  time             total    rows  count            │
│                            time                   │
│                                                   │
│  Cost:                                            │
│  · Startup cost: cost to return the first row     │
│  · Total cost: cost to return all rows            │
│  · Unit: seq_page_cost = 1.0 as baseline          │
│  · random_page_cost = 4.0 (HDD) / 1.1 (SSD)      │
│                                                   │
│  Actual time:                                     │
│  · In milliseconds                                │
│  · When loops > 1, the displayed value is the     │
│    average per loop                               │
│    → Actual total time = time × loops             │
│                                                   │
│  Estimated rows vs actual rows:                   │
│  · Large deviation → statistics problem           │
│  · Run ANALYZE to refresh statistics              │
│                                                   │
│  Buffers:                                         │
│  · shared hit: read from buffer cache             │
│  · shared read: read from disk                    │
│  · shared dirtied: buffers written to             │
│  · shared written: buffers flushed to disk        │
│                                                   │
│  Reading the tree:                                │
│  · Deeper indent = executed first                 │
│  · Read from bottom to top                        │
│  · Each node receives results from its children   │
└───────────────────────────────────────────────────┘
```

### EXPLAIN Options Comparison

| Option | Description | Safety | Use Case |
|-----------|------|:---:|------|
| `EXPLAIN` | Estimates only (does not execute) | Safe | Reviewing the plan |
| `EXPLAIN ANALYZE` | Executes and shows actual measurements | Caution with DML | Performance analysis |
| `BUFFERS` | Shows buffer I/O information | - | Identifying I/O bottlenecks |
| `FORMAT JSON` | Outputs in JSON format | - | Programmatic analysis |
| `FORMAT YAML` | Outputs in YAML format | - | Human readability |
| `SETTINGS` | Shows settings that differ from defaults | - | Checking configuration impact |
| `WAL` | Shows WAL usage (PG13+) | - | Checking write load |

---

## 2. Scan Methods

### Code Example 2: Comparing Scan Methods

```sql
-- ===== Sequential Scan (Seq Scan) =====
-- テーブルの全ページを先頭から順に読む
-- 適する: テーブル全体の大部分を取得する場合
EXPLAIN ANALYZE SELECT * FROM employees WHERE status = 'active';
-- Seq Scan on employees  (cost=0.00..1.12 rows=80 width=200)
--   Filter: (status = 'active')
--   Rows Removed by Filter: 20  ← フィルタで除外された行数


-- ===== Index Scan =====
-- インデックスで行の位置(TID)を特定し、テーブルから行を取得
-- 適する: 少数の行を取得する場合（選択率 < ~5%）
EXPLAIN ANALYZE SELECT * FROM employees WHERE id = 42;
-- Index Scan using employees_pkey on employees
--   (cost=0.15..8.17 rows=1 width=200)
--   Index Cond: (id = 42)
--   Buffers: shared hit=3  ← インデックス2ページ + テーブル1ページ


-- ===== Index Only Scan =====
-- インデックスだけで回答（テーブルアクセス不要）
-- 適する: カバリングインデックスが存在し、必要カラムが全てインデックス内
EXPLAIN ANALYZE SELECT id, name FROM employees WHERE id BETWEEN 1 AND 100;
-- Index Only Scan using idx_emp_covering on employees
--   Index Cond: (id >= 1 AND id <= 100)
--   Heap Fetches: 0  ← テーブルアクセスなし（VACUUMが最新の場合）
--   Heap Fetches: 15 ← VACUUMが遅れていると可視性チェックが必要


-- ===== Bitmap Index Scan + Bitmap Heap Scan =====
-- 複数のインデックスをビットマップで合成してから一括取得
-- 適する: 中程度の行数、複数条件のAND/OR
EXPLAIN ANALYZE
SELECT * FROM employees
WHERE department_id = 10 AND salary > 500000;
-- Bitmap Heap Scan on employees
--   Recheck Cond: (department_id = 10)
--   Filter: (salary > 500000)
--   Rows Removed by Filter: 5
--   ->  Bitmap Index Scan on idx_emp_dept
--         Index Cond: (department_id = 10)
-- → まずビットマップでページ位置を収集、
--   次にページ順にソートしてテーブルを読む（ランダムI/Oを削減）


-- ===== Parallel Seq Scan =====
-- 複数のワーカーで並列にテーブルを読む
-- 適する: 大テーブルの全走査
EXPLAIN ANALYZE SELECT COUNT(*) FROM employees WHERE salary > 300000;
-- Finalize Aggregate
--   ->  Gather  (Workers Planned: 2)
--         ->  Partial Aggregate
--               ->  Parallel Seq Scan on employees
--                     Filter: (salary > 300000)
-- → 2ワーカー + リーダーで並列スキャン
```

### Scan Method Selection Flow

```
┌──────── Optimizer Scan Method Selection ──────────┐
│                                                    │
│  SELECT * FROM T WHERE condition                   │
│                   │                                │
│          What is the selectivity?                  │
│          (fraction of rows matching condition)     │
│                   │                                │
│    ┌──────────────┼──────────────┐                 │
│    │              │              │                 │
│  ~100%         5-30%          <5%                  │
│    │              │              │                 │
│ Seq Scan    Bitmap Scan    Index Scan              │
│ (full scan) (batch read)   (random read)          │
│                                                    │
│  Additional criteria:                             │
│  · Small table → Seq Scan is faster               │
│  · All required columns are in the index          │
│    → Index Only Scan                              │
│  · Large table + many CPU cores                   │
│    → Parallel Seq Scan                            │
│  · OR condition using multiple indexes            │
│    → BitmapOr                                     │
└────────────────────────────────────────────────────┘
```

---

## 3. Join Methods

### Code Example 3: Understanding Join Methods

```sql
-- ===== Nested Loop Join =====
-- 外側テーブルの各行に対して内側テーブルをスキャン
-- 適する: 外側が小、内側にインデックスあり
-- 計算量: O(N × M)（インデックスあれば O(N × log M)）
EXPLAIN ANALYZE
SELECT * FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
WHERE o.id = 42;
-- Nested Loop  (cost=0.56..16.59 rows=1 width=400)
--   ->  Index Scan using orders_pkey on orders o  (rows=1)
--   ->  Index Scan using customers_pkey on customers c  (rows=1)
-- → 外側1行 × 内側1行 = 1回のIndex Scan


-- ===== Hash Join =====
-- 小テーブルでハッシュ表を構築、大テーブルで照合
-- 適する: 等値結合、中〜大テーブル
-- 計算量: O(N + M)、メモリ使用: O(min(N, M))
EXPLAIN ANALYZE
SELECT * FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id;
-- Hash Join  (cost=1.09..35.24 rows=1000 width=400)
--   Hash Cond: (o.customer_id = c.id)
--   ->  Seq Scan on orders o        ← 大テーブル（probe側）
--   ->  Hash                         ← ハッシュ表の構築
--         Buckets: 1024  Batches: 1  Memory Usage: 40kB
--         ->  Seq Scan on customers c  ← 小テーブル（build側）


-- ===== Merge Join =====
-- 両テーブルをソートして並行走査
-- 適する: 大テーブル同士の結合、ソート済みデータ
-- 計算量: O(N log N + M log M)（既ソートなら O(N + M)）
EXPLAIN ANALYZE
SELECT * FROM large_orders o
    INNER JOIN large_customers c ON o.customer_id = c.id
ORDER BY o.customer_id;
-- Merge Join  (cost=...)
--   Merge Cond: (o.customer_id = c.id)
--   ->  Sort  ->  Seq Scan on large_orders
--   ->  Sort  ->  Seq Scan on large_customers
```

### Join Method Diagrams

```
┌────────── Three Join Methods ─────────────────────┐
│                                                    │
│  Nested Loop                                       │
│  ┌─────┐                                          │
│  │ A(1)│ → search matching rows in B via index    │
│  │ A(2)│ → search matching rows in B via index    │
│  │ A(3)│ → search matching rows in B via index    │
│  └─────┘                                          │
│  Best: outer has few rows + inner has index        │
│  Worst: both tables are large + no index           │
│                                                    │
│  Hash Join                                         │
│  ① Build: build hash table from smaller table     │
│  ┌─────┐        ┌───────────┐                     │
│  │  B  │ ──────►│Hash Table │                     │
│  └─────┘ build  └─────┬─────┘                     │
│  ② Probe: probe hash table with larger table       │
│  ┌─────┐        probe│                            │
│  │  A  │ ────────────┘                            │
│  └─────┘                                          │
│  Best: equi-join + smaller table fits in memory   │
│  Note: insufficient work_mem → more Batches → slow│
│                                                    │
│  Merge Join                                        │
│  ┌─────────┐  ┌─────────┐                         │
│  │A(sorted)│  │B(sorted)│  → concurrent comparison│
│  └─────────┘  └─────────┘                         │
│  Best: large tables + already sorted via index     │
│  Note: sort cost can be significant               │
└────────────────────────────────────────────────────┘
```

---

## 4. Statistics

### Code Example 4: Checking and Updating Statistics

```sql
-- テーブルの統計情報を確認
SELECT
    attname AS column_name,
    n_distinct,           -- ユニーク値数（負数は行数に対する割合）
    null_frac,            -- NULL率（0.0〜1.0）
    avg_width,            -- 平均バイト幅
    most_common_vals,     -- 最頻値（上位N個）
    most_common_freqs,    -- 最頻値の出現率
    histogram_bounds      -- ヒストグラムの境界値
FROM pg_stats
WHERE tablename = 'employees' AND attname = 'department_id';

-- n_distinct の解釈:
--   正の値: ユニーク値の推定数（例: 10 → 10種類の値）
--   負の値: 行数に対する割合（例: -0.5 → 行数の50%がユニーク）
--   -1: 全行がユニーク

-- 統計情報の手動更新
ANALYZE employees;

-- 特定カラムの統計精度を上げる（デフォルト100、最大10000）
ALTER TABLE employees ALTER COLUMN department_id SET STATISTICS 1000;
ANALYZE employees;
-- → histogram_bounds のバケット数が増え、カーディナリティ推定が改善

-- テーブルの行数推定 vs 実際
SELECT
    relname,
    reltuples::BIGINT AS estimated_rows,    -- 推定行数（ANALYZEで更新）
    pg_stat_get_live_tuples(oid) AS actual_rows  -- 実際のlive行数
FROM pg_class
WHERE relname = 'employees';
```

### Code Example 5: Extended Statistics (Multi-Column Correlation)

```sql
-- 拡張統計: 複数カラム間の相関を考慮した統計情報
-- PostgreSQL 10+ で利用可能

-- 問題: city='東京' AND prefecture='東京都' の選択率を
--        各カラム独立に計算すると実際より小さく見積もる
-- → 「東京に住む人は東京都」という相関を知らないため

-- 依存統計（functional dependencies）
CREATE STATISTICS stat_emp_city_pref (dependencies)
ON city, prefecture FROM addresses;
ANALYZE addresses;

-- n-distinct統計（複合カーディナリティ）
CREATE STATISTICS stat_orders_status_date (ndistinct)
ON status, DATE_TRUNC('month', order_date) FROM orders;
ANALYZE orders;

-- MCV統計（最頻値の組み合わせ）— PostgreSQL 12+
CREATE STATISTICS stat_orders_mcv (mcv)
ON status, payment_method FROM orders;
ANALYZE orders;

-- 拡張統計の効果確認
EXPLAIN SELECT * FROM addresses
WHERE city = '東京' AND prefecture = '東京都';
-- Before: rows=10 (各カラムの選択率を独立に乗算: 0.1 × 0.1 = 0.01)
-- After:  rows=1000 (相関を考慮: 東京→東京都の依存関係)
```

---

## 5. Query Rewriting

### Code Example 6: Rewriting Inefficient Queries

```sql
-- ===== パターン1: OR → UNION ALL =====
-- NG: OR条件でインデックスが効きにくい
SELECT * FROM orders
WHERE customer_id = 42 OR product_id = 100;
-- → Bitmap OR（効率が悪い場合がある）

-- OK: UNION ALLに書き換え
SELECT * FROM orders WHERE customer_id = 42
UNION ALL
SELECT * FROM orders WHERE product_id = 100
  AND customer_id != 42;  -- 重複排除


-- ===== パターン2: IN (サブクエリ) → EXISTS =====
-- NG: IN (サブクエリ) が非効率な場合
SELECT * FROM products
WHERE id IN (SELECT product_id FROM order_items WHERE quantity > 10);

-- OK: EXISTS に書き換え（相関サブクエリとして最適化される）
SELECT * FROM products p
WHERE EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.product_id = p.id AND oi.quantity > 10
);

-- OK: JOIN に書き換え（重複に注意）
SELECT DISTINCT p.*
FROM products p
    INNER JOIN order_items oi ON p.id = oi.product_id
WHERE oi.quantity > 10;


-- ===== パターン3: NOT IN → NOT EXISTS =====
-- NG: NOT IN はNULLの扱いが危険 + Anti Join最適化が効きにくい
SELECT * FROM products
WHERE id NOT IN (SELECT product_id FROM discontinued_products);
-- → product_id にNULLがあると結果が空になる（SQL標準の3値論理）

-- OK: NOT EXISTS（NULLセーフ + Anti Joinに最適化される）
SELECT * FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM discontinued_products dp
    WHERE dp.product_id = p.id
);
-- → Anti Join: Hash Anti Join or Merge Anti Join で効率的に処理


-- ===== パターン4: CTE（WITH句）の注意点 =====
-- PostgreSQL 12未満: CTEは最適化バリア（インライン展開されない）
-- PostgreSQL 12+: 1回だけ参照されるCTEは自動的にインライン展開

-- NG (PG11以前): CTEがSeq Scanを強制
WITH active_orders AS (
    SELECT * FROM orders WHERE status = 'active'
)
SELECT * FROM active_orders WHERE customer_id = 42;
-- → CTEが全active注文をマテリアライズしてからフィルタ

-- OK: サブクエリまたはCTE + MATERIALIZED/NOT MATERIALIZED
-- PG12+ではデフォルトでインライン展開される
WITH active_orders AS NOT MATERIALIZED (
    SELECT * FROM orders WHERE status = 'active'
)
SELECT * FROM active_orders WHERE customer_id = 42;
-- → customer_id=42 の条件がordersテーブルまでプッシュダウン


-- ===== パターン5: OFFSET の代わりにカーソルベースページング =====
-- NG: OFFSET が大きいと全行をスキャンしてからスキップ
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 100000;
-- → 100020行を読んで最初の100000行を捨てる

-- OK: WHERE id > last_seen_id でカーソルベースページング
SELECT * FROM products
WHERE id > 100000  -- 前回最後のIDを使う
ORDER BY id
LIMIT 20;
-- → Index Scanで20行だけ読む（大幅に高速）
```

### Code Example 7: Performance Analysis Queries

```sql
-- ===== pg_stat_statements =====
-- 最も遅いクエリの特定（拡張モジュール）
-- postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT
    calls,
    ROUND(total_exec_time::NUMERIC, 2) AS total_ms,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_ms,
    ROUND(stddev_exec_time::NUMERIC, 2) AS stddev_ms,
    rows,
    ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2)
        AS cache_hit_pct,
    LEFT(query, 120) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- キャッシュヒット率が低いクエリ（I/Oバウンド）
SELECT
    query,
    calls,
    shared_blks_hit,
    shared_blks_read,
    ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2)
        AS cache_hit_pct
FROM pg_stat_statements
WHERE calls > 100
ORDER BY cache_hit_pct ASC
LIMIT 20;


-- ===== auto_explain =====
-- 自動的にスロークエリの実行計画をログに出力
-- postgresql.conf:
-- shared_preload_libraries = 'auto_explain'
-- auto_explain.log_min_duration = '100ms'
-- auto_explain.log_analyze = on
-- auto_explain.log_buffers = on
-- auto_explain.log_format = 'json'


-- ===== 実行計画のJSON形式出力（プログラムからの解析用）=====
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM employees WHERE department_id = 10;

-- ===== 実行計画の比較（SET で挙動を変えて確認）=====
-- インデックスを無効化して比較
SET enable_indexscan = off;
SET enable_bitmapscan = off;
EXPLAIN ANALYZE SELECT * FROM employees WHERE id = 42;
-- → Seq Scan が使われる

-- 元に戻す
RESET enable_indexscan;
RESET enable_bitmapscan;
```

---

## 6. Advanced Optimization Techniques

### Code Example 8: Parallel Query and work_mem Tuning

```sql
-- ===== パラレルクエリの制御 =====
-- パラレルクエリのパラメータ
SHOW max_parallel_workers_per_gather;  -- デフォルト: 2
SHOW parallel_tuple_cost;              -- デフォルト: 0.1
SHOW min_parallel_table_scan_size;     -- デフォルト: 8MB

-- パラレル度を上げて大テーブルの集約を高速化
SET max_parallel_workers_per_gather = 4;
EXPLAIN ANALYZE
SELECT department_id, AVG(salary), COUNT(*)
FROM employees
GROUP BY department_id;
-- Finalize GroupAggregate
--   ->  Gather Merge  (Workers Planned: 4)
--         ->  Sort
--               ->  Partial HashAggregate
--                     ->  Parallel Seq Scan on employees

-- ===== work_mem チューニング =====
-- work_mem: ソートやハッシュ操作で使用するメモリ量
SHOW work_mem;  -- デフォルト: 4MB

-- Hash Join で Batches > 1 の場合 → work_mem不足
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id;
-- Hash Join
--   ->  Hash
--         Buckets: 65536  Batches: 4  ← Batches > 1 = ディスクに溢れている
--         Memory Usage: 4096kB

-- work_mem を増やして改善
SET work_mem = '64MB';  -- セッション単位で設定（グローバル設定は慎重に）
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id;
-- Hash Join
--   ->  Hash
--         Buckets: 262144  Batches: 1  ← 全てメモリ内で処理
--         Memory Usage: 32768kB

-- ソートでのwork_mem影響
EXPLAIN ANALYZE
SELECT * FROM orders ORDER BY created_at DESC;
-- Sort Method: external merge  Disk: 102400kB  ← ディスクソート（遅い）
-- work_mem増加後:
-- Sort Method: quicksort  Memory: 51200kB       ← メモリソート（速い）
```

### Code Example 9: JIT Compilation and Cost Settings

```sql
-- ===== JIT（Just-In-Time）コンパイル =====
-- PostgreSQL 11+: 複雑なクエリの式評価をネイティブコードにコンパイル
SHOW jit;                    -- on (デフォルト)
SHOW jit_above_cost;         -- 100000 (このコスト以上でJIT有効)
SHOW jit_inline_above_cost;  -- 500000
SHOW jit_optimize_above_cost; -- 500000

-- JITが有効な場合の出力
EXPLAIN ANALYZE
SELECT SUM(salary * 1.1 + bonus) FROM employees;
-- JIT:
--   Functions: 4
--   Options: Inlining true, Optimization true, Expressions true
--   Timing: Generation 1.5 ms, Inlining 10.2 ms, Optimization 50.3 ms,
--           Emission 30.1 ms, Total 92.1 ms
-- → JITのオーバーヘッドが大きい場合はjit_above_costを上げる


-- ===== コスト設定の調整 =====
-- SSD環境でのrandom_page_costの最適化
SHOW random_page_cost;  -- デフォルト: 4.0（HDD想定）
SET random_page_cost = 1.1;  -- SSD環境では1.1〜1.5が推奨
-- → Index Scanがより積極的に選択される

-- effective_cache_size の設定
SHOW effective_cache_size;  -- デフォルト: 4GB
-- サーバの物理メモリの50-75%を設定
-- → オプティマイザがIndex Scanを選びやすくなる
SET effective_cache_size = '32GB';
```

---

## Scan Method Comparison

| Scan Method | Best For | Complexity | I/O Characteristics | Parallelizable |
|------------|-----------|--------|---------|:---:|
| Sequential Scan | Fetching all/most rows | O(N) | Sequential read | Yes |
| Index Scan | Fetching few rows (~5%) | O(log N) | Random read | No* |
| Index Only Scan | Covering index available | O(log N) | Index only | Yes |
| Bitmap Index Scan | Moderate row count (5-30%) | O(N) | Batch read | Yes |
| Parallel Seq Scan | Full scan of large tables | O(N/P) | Parallel sequential | Yes |

*Parallel Index Scan planned for PostgreSQL 17

## Join Method Comparison

| Join Method | Best For | Complexity | Memory Usage | Equi/Non-equi |
|---------|-----------|--------|:---:|:---:|
| Nested Loop | Small table + index | O(N*M) or O(N*logM) | Low | Both |
| Hash Join | Equi-join, medium tables | O(N+M) | Medium (hash table) | Equi only |
| Merge Join | Large tables, pre-sorted | O(NlogN+MlogM) | Low | Equi only |

## Cost Configuration Parameters

| Parameter | Default | SSD Recommended | Effect |
|-----------|-----------|---------|------|
| seq_page_cost | 1.0 | 1.0 | Baseline cost for Seq Scan |
| random_page_cost | 4.0 | 1.1-1.5 | Affects Index Scan preference |
| effective_cache_size | 4GB | 50-75% of RAM | Affects Index Scan favorability |
| work_mem | 4MB | 64-256MB* | Memory for sort/hash operations |
| maintenance_work_mem | 64MB | 512MB-2GB | VACUUM/CREATE INDEX |

*Ensure connections × work_mem does not exceed installed RAM

---

## Anti-Patterns

### Anti-Pattern 1: Adding Indexes Without Using EXPLAIN

```sql
-- NG: 「遅いからインデックスを追加」という安易な対応
CREATE INDEX idx_guess ON orders (status);
-- 効果がない理由: statusの選択率が低い（80%が'completed'）
-- → Seq Scanの方が速いためオプティマイザがインデックスを無視

-- OK: EXPLAIN ANALYZEで原因を特定してから対策
EXPLAIN ANALYZE
SELECT * FROM orders WHERE status = 'pending';
-- → Seq Scan、Filter: Rows Removed: 95000
-- → status='pending'は全体の5% → インデックスは有効

-- さらに部分インデックスで最適化
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';
```

### Anti-Pattern 2: Ignoring Deviation Between Estimated and Actual Row Counts

```sql
-- 推定 rows=10 vs 実際 rows=50000 のような乖離
-- → オプティマイザが間違った実行計画を選択する原因
-- → 例: Hash Joinの方が適切なのにNested Loopを選択

-- 対策1: ANALYZEを実行して統計を更新
ANALYZE orders;

-- 対策2: 統計精度を上げる
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 1000;
ANALYZE orders;

-- 対策3: 拡張統計（複数列の相関）
CREATE STATISTICS stat_orders_status_date (dependencies)
ON status, order_date FROM orders;
ANALYZE orders;

-- 対策4: 乖離の確認方法
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';
-- rows=10 (estimated) vs rows=50000 (actual) → 5000倍の乖離
-- → ANALYZEと拡張統計で改善
```

### Anti-Pattern 3: Careless Use of SELECT *

```sql
-- NG: 不要なカラムまで取得
SELECT * FROM orders WHERE customer_id = 42;
-- → 全カラム取得 → Index Only Scanが使えない
-- → ネットワーク転送量が増大

-- OK: 必要なカラムのみ取得
SELECT id, status, total FROM orders WHERE customer_id = 42;
-- → カバリングインデックスがあればIndex Only Scan可能
-- → 転送データ量が削減
```

---

## Practice Exercises

### Exercise 1 (Basic): Reading EXPLAIN Output

Read the following EXPLAIN ANALYZE output and identify the bottleneck.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.total, c.name, c.email
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.created_at > '2024-01-01'
  AND o.status = 'delivered'
ORDER BY o.total DESC
LIMIT 100;

-- 出力:
-- Limit  (cost=45000..45002 rows=100 width=120)
--        (actual time=2500.1..2500.3 rows=100 loops=1)
--   ->  Sort  (cost=45000..45500 rows=50000 width=120)
--              (actual time=2500.0..2500.2 rows=100 loops=1)
--         Sort Key: o.total DESC
--         Sort Method: top-N heapsort  Memory: 50kB
--         ->  Hash Join  (cost=800..44000 rows=50000 width=120)
--                        (actual time=15.0..2400.0 rows=48000 loops=1)
--               Hash Cond: (o.customer_id = c.id)
--               ->  Seq Scan on orders o  (cost=0..40000 rows=50000 width=80)
--                                         (actual time=0.1..2300.0 rows=48000 loops=1)
--                     Filter: (created_at > '2024-01-01' AND status = 'delivered')
--                     Rows Removed by Filter: 952000
--                     Buffers: shared hit=5000 read=30000
--               ->  Hash  (cost=500..500 rows=10000 width=40)
--                          (actual time=10.0..10.0 rows=10000 loops=1)
--                     ->  Seq Scan on customers c
--                     Buffers: shared hit=200
-- Planning Time: 0.5 ms
-- Execution Time: 2500.5 ms
```

<details>
<summary>Model Answer</summary>

**Bottleneck Analysis**:

1. **Primary bottleneck**: `Seq Scan on orders` consuming 2300ms
   - `Rows Removed by Filter: 952000` → 95% of 1 million rows filtered out
   - `Buffers: shared read=30000` → heavy disk I/O
   - Cause: no appropriate index on the orders table

2. **Estimated row count check**: rows=50000 (estimated) vs rows=48000 (actual) → statistics are accurate

3. **Sort**: top-N heapsort Memory: 50kB → efficient with LIMIT 100 (no issue)

4. **Hash Join**: Hash build for customers takes 10ms → no issue

**Remediation**:

```sql
-- 部分インデックス + カバリング
CREATE INDEX idx_orders_delivered_recent ON orders (total DESC)
INCLUDE (customer_id, created_at)
WHERE status = 'delivered' AND created_at > '2024-01-01';

-- 改善後: Seq Scan → Index Scan + LIMIT が直接適用
-- 2500ms → 数ms に改善
```

**Execution plan after improvement**:
```
Limit  (actual time=0.05..0.5 rows=100)
  ->  Nested Loop  (actual time=0.05..0.5 rows=100)
        ->  Index Only Scan using idx_orders_delivered_recent
              (actual time=0.03..0.2 rows=100)
              Heap Fetches: 0
        ->  Index Scan using customers_pkey on customers c
              (actual time=0.002..0.002 rows=1 loops=100)
```

</details>

### Exercise 2 (Intermediate): Query Rewriting for Optimization

Rewrite the following query to make it faster.

```sql
-- 遅いクエリ: 各顧客の最新注文を取得
SELECT c.id, c.name,
       (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order,
       (SELECT SUM(o.total) FROM orders o WHERE o.customer_id = c.id) AS total_spent,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
FROM customers c
WHERE c.status = 'active';
```

<details>
<summary>Model Answer</summary>

```sql
-- 方法1: サブクエリをJOIN + GROUP BYに統合
SELECT
    c.id,
    c.name,
    MAX(o.created_at) AS last_order,
    COALESCE(SUM(o.total), 0) AS total_spent,
    COUNT(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE c.status = 'active'
GROUP BY c.id, c.name;

-- 方法2: LATERAL JOINで効率的に取得
SELECT c.id, c.name, agg.last_order, agg.total_spent, agg.order_count
FROM customers c
LEFT JOIN LATERAL (
    SELECT
        MAX(created_at) AS last_order,
        SUM(total) AS total_spent,
        COUNT(*) AS order_count
    FROM orders
    WHERE customer_id = c.id
) agg ON TRUE
WHERE c.status = 'active';

-- 必要なインデックス
CREATE INDEX idx_orders_customer ON orders (customer_id)
INCLUDE (created_at, total);
```

**Explanation**: The original query runs three scalar subqueries per customer, resulting in customer_count × 3 scans of the orders table. Method 1 consolidates into a single JOIN + GROUP BY, reducing scans to one. Method 2's LATERAL JOIN performs efficient per-customer aggregation using an index.

</details>

### Exercise 3 (Advanced): Performance Monitoring Dashboard

Using pg_stat_statements and pg_stat_user_tables, write queries that output:

1. Top 10 queries by CPU time consumed
2. Top 10 tables by lowest cache hit rate
3. Tables with the largest deviation between estimated and actual row counts

<details>
<summary>Model Answer</summary>

```sql
-- 1. 最もCPU時間を消費するクエリTOP10
SELECT
    ROUND(total_exec_time::NUMERIC, 2) AS total_ms,
    calls,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_ms,
    rows AS total_rows,
    ROUND(100.0 * shared_blks_hit /
        NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct,
    LEFT(query, 150) AS query
FROM pg_stat_statements
WHERE calls > 10
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2. キャッシュヒット率が低いテーブルTOP10
SELECT
    schemaname || '.' || relname AS table_name,
    heap_blks_hit + heap_blks_read AS total_reads,
    CASE
        WHEN heap_blks_hit + heap_blks_read > 0 THEN
            ROUND(100.0 * heap_blks_hit /
                (heap_blks_hit + heap_blks_read), 2)
        ELSE 100
    END AS cache_hit_pct,
    idx_blks_hit + idx_blks_read AS total_idx_reads,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 1000
ORDER BY cache_hit_pct ASC
LIMIT 10;

-- 3. 推定行数と実際の行数の乖離
SELECT
    relname AS table_name,
    reltuples::BIGINT AS estimated_rows,
    n_live_tup AS actual_live_rows,
    CASE
        WHEN reltuples > 0 THEN
            ROUND(ABS(reltuples - n_live_tup) / reltuples * 100, 1)
        ELSE 0
    END AS deviation_pct,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables s
JOIN pg_class c ON s.relid = c.oid
WHERE n_live_tup > 1000
ORDER BY deviation_pct DESC
LIMIT 10;
```

**Explanation**: These three queries reveal:
1. Which queries consume the most resources → optimization priority
2. Which tables' data is not in cache → consider increasing shared_buffers
3. Which tables have stale statistics → ANALYZE needs to be run

</details>


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured settings file | Check the settings file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify the executing user's permissions, review configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Verify hypotheses using log output or a debugger
5. **Fix and regression test**: After fixing, run tests for related areas too

```python
# デバッグ用ユーティリティ
import logging
import traceback
from functools import wraps

# ロガーの設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """関数の入出力をログ出力するデコレータ"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """データ処理（デバッグ対象）"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues when they occur:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Check for memory leaks
3. **Check I/O wait**: Examine disk and network I/O conditions
4. **Check concurrent connections**: Check the state of the connection pool

| Problem Type | Diagnostic Tool | Remedy |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes decision criteria for technology selection.

| Criterion | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin screens, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → go to ②                    │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → go to ③         │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from these perspectives:

**1. Short-term vs Long-term Cost**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified tech stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# 設計判断の記録テンプレート
class ArchitectureDecisionRecord:
    """ADR (Architecture Decision Record) の作成"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """背景と課題の記述"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """決定内容の記述"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """結果の追加"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """却下した代替案の追加"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Markdown形式で出力"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum viable feature set
- Automated tests only for the critical path
- Introduce monitoring from early on

**Lessons Learned:**
- Don't chase perfection (YAGNI principle)
- Gather user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally revamping a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Write Characterization Tests first if existing tests are absent
- Use an API gateway to run old and new systems side-by-side
- Perform data migration in stages

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration Start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core Migration | Migrate core features | 6-12 months | High |
| 5. Completion | Retire the old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Use Domain-Driven Design to clarify boundaries
- Assign ownership per team
- Manage shared libraries via Inner Source
- Design API-first to minimize inter-team dependencies

```python
# チーム間のAPI契約定義
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
    """チーム間のAPI契約"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # レスポンスタイムSLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """SLA準拠の確認"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """OpenAPI形式で出力"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# 使用例
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

**Situation:** Systems that require millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | When to Apply |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy workloads |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound workloads |

---

## Team Development Practices

### Code Review Checklist

Points to check during code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No performance regressions
- [ ] No security issues
- [ ] Documentation is up to date

### Knowledge Sharing Best Practices

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge sharing |
| ADR (Architecture Decision Record) | Per decision | Future members | Decision transparency |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Critical design | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ imme│
    │     │ diat│
    ├─────┼─────┤
    │ Log │ Next│
    │ only│ Spri│
    │     │ nt  │
    └─────┼─────┘
          │
        Low Impact
    Low Freq    High Freq
```

---

## Security Considerations

### Common Vulnerabilities and Mitigations

| Vulnerability | Risk Level | Mitigation | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Broken authentication | High | Multi-factor auth, session management hardening | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, principle of least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trails | Log analysis |

### Secure Coding Best Practices

```python
# セキュアコーディング例
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """セキュリティユーティリティ"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """暗号学的に安全なトークン生成"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """パスワードのハッシュ化"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """パスワードの検証"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """入力値のサニタイズ"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# 使用例
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not written to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is configured appropriately
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not contain internal information

---

## Migration Guide

### Notes for Version Upgrades

| Version | Key Changes | Migration Work | Scope |
|-----------|-----------|---------|---------|
| v1.x → v2.x | Overhauled API design | Endpoint changes | All clients |
| v2.x → v3.x | Authentication method change | Token format update | Auth-related |
| v3.x → v4.x | Data model change | Run migration scripts | DB-related |

### Incremental Migration Steps

```python
# マイグレーションスクリプトのテンプレート
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable

logger = logging.getLogger(__name__)

class MigrationRunner:
    """段階的マイグレーション実行エンジン"""

    def __init__(self, migration_dir: str):
        self.migration_dir = Path(migration_dir)
        self.migrations: List[Dict] = []
        self.completed: List[str] = []

    def register(self, version: str, description: str,
                 up: Callable, down: Callable):
        """マイグレーションの登録"""
        self.migrations.append({
            'version': version,
            'description': description,
            'up': up,
            'down': down,
            'registered_at': datetime.now().isoformat()
        })

    def run_up(self, target_version: str = None):
        """マイグレーションの実行（アップグレード）"""
        for migration in self.migrations:
            if migration['version'] in self.completed:
                continue
            logger.info(f"実行中: {migration['version']} - "
                       f"{migration['description']}")
            try:
                migration['up']()
                self.completed.append(migration['version'])
                logger.info(f"完了: {migration['version']}")
            except Exception as e:
                logger.error(f"失敗: {migration['version']}: {e}")
                raise
            if target_version and migration['version'] == target_version:
                break

    def run_down(self, target_version: str):
        """マイグレーションのロールバック"""
        for migration in reversed(self.migrations):
            if migration['version'] not in self.completed:
                continue
            if migration['version'] == target_version:
                break
            logger.info(f"ロールバック: {migration['version']}")
            migration['down']()
            self.completed.remove(migration['version'])

    def status(self) -> Dict:
        """マイグレーション状態の確認"""
        return {
            'total': len(self.migrations),
            'completed': len(self.completed),
            'pending': len(self.migrations) - len(self.completed),
            'versions': {
                m['version']: 'completed'
                if m['version'] in self.completed else 'pending'
                for m in self.migrations
            }
        }
```

### Rollback Plan

Always prepare a rollback plan for migration work:

1. **Back up your data**: Take a full backup before migration
2. **Validate in a test environment**: Verify in an environment equivalent to production beforehand
3. **Staged rollout**: Deploy gradually using a canary release
4. **Increase monitoring**: Shorten monitoring intervals during migration
5. **Define decision criteria**: Establish rollback criteria in advance

---

## FAQ

### Q1: What is the difference between EXPLAIN and EXPLAIN ANALYZE?

EXPLAIN only estimates the execution plan without executing the query (safe). EXPLAIN ANALYZE actually executes the query and displays measured values. When using EXPLAIN ANALYZE on UPDATE/DELETE, run it inside a transaction and ROLLBACK afterward.

```sql
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status = 'cancelled' WHERE id = 42;
ROLLBACK;  -- 実際の更新は取り消される
```

### Q2: What are the units of cost values?

PostgreSQL costs are abstract units with `seq_page_cost = 1.0` (one sequential page read) as the baseline. `random_page_cost` defaults to 4.0 (recommended 1.1-1.5 for SSD environments). Cost values are meaningful relative to each other, but absolute values do not directly correspond to real time.

### Q3: When is parallel query effective?

Parallel query is effective for Seq Scans of large tables, aggregations over many rows (COUNT, SUM, etc.), and Hash Joins between large tables. Parallelism is controlled by `max_parallel_workers_per_gather` (default 2). For small tables or index access, the overhead outweighs the benefit. If the table size is below `min_parallel_table_scan_size` (default 8MB), parallel query is automatically disabled.

### Q4: What should I do when loops is large in EXPLAIN output?

When `loops=10000`, that node was executed 10,000 times. The displayed time is the average per loop, so the actual total time is `actual time × loops`. Remediation:
- Large loops on the inner side of a Nested Loop → change the JOIN order with a hint (`SET join_collapse_limit`)
- Reduce the outer result row count (add WHERE conditions or improve the index)

### Q5: Why is Seq Scan chosen even for a small table?

When a table spans only a few pages, a Seq Scan (sequential I/O) is faster than an Index Scan (random I/O). This is the correct optimizer decision and not a problem.

---

## Summary

| Item | Key Point |
|------|------|
| EXPLAIN ANALYZE | Confirm both the execution plan and measured values. The only starting point for optimization |
| Estimated vs Actual | Row count deviation → update statistics with ANALYZE, use extended statistics |
| Scan methods | Know when to use Seq / Index / Bitmap / Index Only |
| Join methods | Understand the characteristics of Nested Loop / Hash / Merge |
| Statistics | pg_stats, SET STATISTICS, extended statistics (dependencies, ndistinct, mcv) |
| Query rewriting | OR→UNION ALL, NOT IN→NOT EXISTS, CTE optimization |
| work_mem | Hash Join Batches > 1 or disk sorts are signs of insufficient work_mem |
| Monitoring | Identify slow queries with pg_stat_statements, auto-record with auto_explain |

---

## What to Read Next

- [03-indexing.md](./03-indexing.md) — Detailed index design, partial/covering indexes
- [02-transactions.md](./02-transactions.md) — Impact of transactions and locks
- [02-performance-tuning.md](../03-practical/02-performance-tuning.md) — Comprehensive tuning (connection pooling, shared_buffers, etc.)
- [00-normalization.md](../02-design/00-normalization.md) — Trade-offs between schema design and performance

---

## References

1. PostgreSQL Documentation — "Using EXPLAIN" https://www.postgresql.org/docs/current/using-explain.html
2. PostgreSQL Documentation — "Row Estimation Examples" https://www.postgresql.org/docs/current/row-estimation-examples.html
3. Winand, M. (2012). *SQL Performance Explained*. https://use-the-index-luke.com/
4. Citus Data — "PostgreSQL Query Optimization" https://www.citusdata.com/blog/
5. Dalibo — "EXPLAIN depesz" https://explain.depesz.com/ — Visual analysis tool for EXPLAIN output
6. pgMustard — https://www.pgmustard.com/ — Automated EXPLAIN output analysis service
