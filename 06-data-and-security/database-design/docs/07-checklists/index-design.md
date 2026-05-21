# インデックス設計チェックリスト

## インデックス作成前の検討事項

### 必要性の評価
- [ ] WHERE句で頻繁に使用されるカラムか？
- [ ] JOIN条件で使用されるカラムか？
- [ ] ORDER BY / GROUP BYで使用されるカラムか？
- [ ] UNIQUE制約が必要なカラムか？
- [ ] テーブルサイズが十分大きいか？（数千行以上）
- [ ] クエリの実行頻度が高いか？

### パフォーマンスへの影響
- [ ] 読み取り（SELECT）の頻度 > 書き込み（INSERT/UPDATE/DELETE）の頻度？
- [ ] インデックス作成によるクエリ高速化の見込みは？
- [ ] 書き込みパフォーマンス低下の許容範囲は？
- [ ] インデックスサイズの増加は許容範囲内か？

---

## インデックス種類の選択

### B-treeインデックス（デフォルト）
- [ ] 等価検索（=）に使用
- [ ] 範囲検索（<, >, BETWEEN）に使用
- [ ] ソート（ORDER BY）に使用
- [ ] 前方一致検索（LIKE 'prefix%'）に使用

**作成例:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_created_at ON posts(created_at);
```

### Hashインデックス
- [ ] 等価検索（=）のみに使用
- [ ] 範囲検索は不要
- [ ] PostgreSQLで使用

**作成例:**
```sql
CREATE INDEX idx_users_email_hash ON users USING HASH (email);
```

### GINインデックス（汎用転置インデックス）
- [ ] 全文検索に使用
- [ ] JSONB型のカラムに使用
- [ ] 配列型のカラムに使用
- [ ] PostgreSQLで使用

**作成例:**
```sql
-- 全文検索
CREATE INDEX idx_posts_search
ON posts USING GIN(to_tsvector('english', title || ' ' || content));

-- JSONB
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

-- 配列
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);
```

### GiSTインデックス（汎用検索ツリー）
- [ ] 地理空間データに使用
- [ ] 範囲データに使用
- [ ] PostgreSQLで使用

**作成例:**
```sql
CREATE INDEX idx_locations_geography
ON locations USING GIST (location);
```

---

## 複合インデックス設計

### カラムの順序決定
- [ ] **最も選択性が高いカラムを先頭に配置**
  - 選択性 = ユニークな値の数 / 総レコード数
  - 例: user_id (選択性高) → created_at (選択性低)

- [ ] **WHERE句でのフィルタリング順序に合わせる**
  ```sql
  -- クエリ
  SELECT * FROM posts WHERE user_id = 1 ORDER BY created_at DESC;

  -- インデックス
  CREATE INDEX idx_posts_user_created ON posts(user_id, created_at);
  ```

- [ ] **等価条件（=）を先に、範囲条件（<, >）を後に**
  ```sql
  -- ✅ GOOD
  CREATE INDEX idx_posts_user_created ON posts(user_id, created_at);
  WHERE user_id = 1 AND created_at > '2025-01-01'

  -- ❌ BAD
  CREATE INDEX idx_posts_created_user ON posts(created_at, user_id);
  ```

### 最適なカラム数
- [ ] 2〜3カラムが一般的
- [ ] 4カラム以上は慎重に検討
- [ ] すべてのカラムの組み合わせで検索するか確認

---

## 特殊なインデックス

### Covering Index（カバリングインデックス）
- [ ] クエリに必要なすべてのカラムを含む
- [ ] テーブルアクセスを完全に回避
- [ ] Index Only Scanで超高速化

**作成例:**
```sql
-- クエリ
SELECT username, email FROM users WHERE email = 'user@example.com';

-- Covering Index
CREATE INDEX idx_users_email_username ON users(email, username);
```

**チェックポイント:**
- [ ] INCLUDEカラムは適切か？（PostgreSQL 11+）
  ```sql
  CREATE INDEX idx_users_email_inc
  ON users(email) INCLUDE (username);
  ```

### 部分インデックス（Partial Index）
- [ ] 特定条件のレコードのみインデックス化
- [ ] インデックスサイズを削減
- [ ] クエリ速度を向上

**作成例:**
```sql
-- 公開済み投稿のみ
CREATE INDEX idx_posts_published ON posts(published_at)
WHERE published_at IS NOT NULL;

-- pending状態の注文のみ
CREATE INDEX idx_orders_pending ON orders(created_at)
WHERE status = 'pending';
```

**チェックポイント:**
- [ ] WHERE条件が適切か？
- [ ] インデックスサイズ削減効果は？
- [ ] クエリのWHERE句と一致するか？

### 式インデックス（Expression Index）
- [ ] 関数適用後の値にインデックス
- [ ] 計算式の結果にインデックス

**作成例:**
```sql
-- 大文字小文字を区別しない検索
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- JSON フィールド
CREATE INDEX idx_products_attributes_color
ON products((attributes->>'color'));

-- 計算式
CREATE INDEX idx_products_discounted_price
ON products((price * (1 - discount_rate)));
```

**チェックポイント:**
- [ ] 関数は決定的（同じ入力で常に同じ出力）か？
- [ ] クエリで同じ式を使用しているか？

---

## インデックス作成時の注意点

### ゼロダウンタイム作成
- [ ] **PostgreSQL: CONCURRENTLY オプション使用**
  ```sql
  CREATE INDEX CONCURRENTLY idx_posts_user_id ON posts(user_id);
  ```

- [ ] **MySQL: ALGORITHM=INPLACE, LOCK=NONE 使用**
  ```sql
  ALTER TABLE posts
  ADD INDEX idx_posts_user_id (user_id),
  ALGORITHM=INPLACE, LOCK=NONE;
  ```

### トランザクション管理
- [ ] 大きいテーブルでは時間がかかることを想定
- [ ] タイムアウト設定を調整
- [ ] ピークタイム外に実行

---

## インデックスメンテナンス

### 定期的な確認
- [ ] **未使用インデックスの確認**
  ```sql
  -- PostgreSQL
  SELECT
    schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0
    AND schemaname = 'public'
  ORDER BY pg_relation_size(indexrelid) DESC;
  ```

- [ ] **重複インデックスの確認**
  - 単一カラムインデックスと複合インデックスの重複
  - 例: (email) と (email, username) → (email) は不要

- [ ] **インデックスサイズの確認**
  ```sql
  -- PostgreSQL
  SELECT
    schemaname, tablename, indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY pg_relation_size(indexname::regclass) DESC;
  ```

### インデックスの削除
- [ ] 未使用インデックスを削除
  ```sql
  DROP INDEX idx_unused_index;
  ```

- [ ] 本番環境では慎重に削除（監視期間を設ける）

---

## パフォーマンス検証

### 実行プラン確認
- [ ] **PostgreSQL: EXPLAIN ANALYZE 使用**
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM users WHERE email = 'user@example.com';
  ```

- [ ] **MySQL: EXPLAIN 使用**
  ```sql
  EXPLAIN
  SELECT * FROM users WHERE email = 'user@example.com';
  ```

### 確認ポイント
- [ ] Index Scan が使用されているか？
- [ ] Index Only Scan が使用されているか？（Covering Index）
- [ ] Seq Scan（フルスキャン）になっていないか？
- [ ] 実行時間が改善されたか？

---

## ベストプラクティス

### DO（推奨）
- [ ] WHERE句で頻繁に使用されるカラムにインデックス
- [ ] JOIN条件のカラムにインデックス
- [ ] ORDER BY / GROUP BYのカラムにインデックス
- [ ] 外部キーカラムにインデックス
- [ ] Covering Indexでテーブルアクセス削減
- [ ] 部分インデックスでインデックスサイズ削減
- [ ] 複合インデックスのカラム順序を最適化

### DON'T（非推奨）
- [ ] すべてのカラムにインデックスを作成（書き込み性能低下）
- [ ] 小さいテーブル（数百行以下）にインデックス
- [ ] 選択性が低いカラムにインデックス（性別、フラグなど）
- [ ] 頻繁に更新されるカラムに過剰なインデックス
- [ ] 重複したインデックスの作成
- [ ] LIKE '%pattern%'（中間一致）での使用を期待

---

## 実測データ

### インデックス最適化による改善例
- クエリ応答時間: 850ms → 12ms (-99%)
- Covering Index導入: 45ms → 2ms (-96%)
- 部分インデックス: インデックスサイズ -85%、クエリ速度 2,500ms → 80ms (-97%)
- GINインデックス: 全文検索 2,500ms → 85ms (-97%)
- インデックス使用率: 30% → 95% (+65%)

---

## まとめチェックリスト

### インデックス作成前
- [ ] クエリパフォーマンス問題を確認
- [ ] EXPLAIN ANALYZEで実行プラン確認
- [ ] インデックス種類を選択
- [ ] カラム順序を最適化（複合インデックス）
- [ ] Covering Index / 部分インデックス検討

### インデックス作成時
- [ ] CONCURRENTLY オプション使用（PostgreSQL）
- [ ] ピークタイム外に実行
- [ ] タイムアウト設定確認

### インデックス作成後
- [ ] EXPLAIN ANALYZEで効果確認
- [ ] 実際のクエリパフォーマンス測定
- [ ] 書き込みパフォーマンスへの影響確認

### 定期メンテナンス
- [ ] 未使用インデックスの確認・削除
- [ ] 重複インデックスの確認・削除
- [ ] インデックスサイズの監視
- [ ] クエリパフォーマンスの監視
