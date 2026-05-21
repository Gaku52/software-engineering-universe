# データベースパフォーマンス最適化チェックリスト

## クエリ最適化

### SELECT文
- [ ] SELECT * を避け、必要なカラムのみ指定
- [ ] 不要なカラムを取得していないか確認
- [ ] データ転送量を最小化

```sql
-- ❌ BAD
SELECT * FROM users WHERE id = 1;

-- ✅ GOOD
SELECT id, username, email FROM users WHERE id = 1;
```

### WHERE句
- [ ] WHERE句でインデックスが使用されているか確認
- [ ] 関数をカラムに適用していないか確認（インデックスが効かない）
- [ ] 適切な比較演算子を使用（=, IN, BETWEEN）

```sql
-- ❌ BAD: 関数適用でインデックスが効かない
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- ✅ GOOD: 式インデックス作成またはアプリ側で変換
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
-- または
SELECT * FROM users WHERE email = 'user@example.com';
```

### JOIN
- [ ] JOIN順序を最適化（小さいテーブルを先に）
- [ ] JOIN条件のカラムにインデックスが存在するか確認
- [ ] 必要なJOINのみ実行（不要なJOINを削除）
- [ ] LEFT JOIN vs INNER JOINを適切に選択

```sql
-- ❌ BAD: 大きいテーブルを先にJOIN
SELECT p.*, u.username
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE u.username = 'admin';

-- ✅ GOOD: 小さいテーブルを先にフィルター
SELECT p.*, u.username
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE u.username = 'admin';
```

### サブクエリ
- [ ] 相関サブクエリを避ける（JOINに置き換え）
- [ ] EXISTS vs IN の適切な使用
- [ ] WITH句（CTE）で可読性向上

```sql
-- ❌ BAD: 相関サブクエリ（各行ごとに実行）
SELECT
  u.id,
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count
FROM users u;

-- ✅ GOOD: JOINで最適化
SELECT
  u.id,
  COUNT(p.id) AS post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id;
```

### ページネーション
- [ ] OFFSET方式を避ける（大きなオフセットで遅い）
- [ ] カーソル方式またはKeyset Paginationを使用

```sql
-- ❌ BAD: OFFSET（スキップした行もスキャン）
SELECT * FROM posts
ORDER BY created_at DESC
LIMIT 10 OFFSET 10000;

-- ✅ GOOD: カーソルページネーション
SELECT * FROM posts
WHERE created_at < '2025-01-01 00:00:00'
ORDER BY created_at DESC
LIMIT 10;
```

---

## インデックス最適化

### インデックス作成
- [ ] WHERE句で頻繁に使用されるカラムにインデックス
- [ ] JOIN条件のカラムにインデックス
- [ ] ORDER BY / GROUP BYのカラムにインデックス
- [ ] 外部キーカラムにインデックス

### インデックス種類
- [ ] B-tree（デフォルト）: 等価検索、範囲検索、ソート
- [ ] Hash: 等価検索のみ
- [ ] GIN: 全文検索、JSONB、配列
- [ ] GiST: 地理空間データ

### 複合インデックス
- [ ] カラムの順序を最適化（選択性が高いカラムを先頭に）
- [ ] 等価条件（=）を先に、範囲条件（<, >）を後に
- [ ] 最適なカラム数（2〜3が一般的）

### 特殊なインデックス
- [ ] Covering Index（すべてのカラムを含む）でテーブルアクセス削減
- [ ] 部分インデックスでインデックスサイズ削減
- [ ] 式インデックスで関数適用後の値にインデックス

### インデックスメンテナンス
- [ ] 未使用インデックスを削除
- [ ] 重複インデックスを削除
- [ ] インデックスサイズを監視
- [ ] 定期的にREINDEX実行（PostgreSQL）

---

## N+1問題の解消

### 問題の特定
- [ ] ループ内でクエリが発生していないか確認
- [ ] 1リクエストで何クエリ発生しているか確認
- [ ] ログでクエリ回数を監視

### 解決策1: Eager Loading
- [ ] Prisma: `include` または `select`使用
- [ ] TypeORM: `relations`使用
- [ ] ActiveRecord: `includes`使用

```typescript
// ❌ BAD: N+1問題
const users = await prisma.user.findMany()
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } })
}

// ✅ GOOD: Eager Loading
const users = await prisma.user.findMany({
  include: { posts: true }
})
```

### 解決策2: DataLoader
- [ ] GraphQLでDataLoader使用
- [ ] バッチ処理で複数IDを一括取得
- [ ] キャッシュで重複リクエスト削減

### 解決策3: 集計テーブル
- [ ] カウントや集計を事前計算
- [ ] トリガーで自動更新
- [ ] 定期的にバッチ更新

---

## キャッシング戦略

### クエリキャッシュ
- [ ] Redisでクエリ結果をキャッシュ
- [ ] TTLベース無効化戦略
- [ ] キャッシュヒット率を監視

### キャッシュパターン
- [ ] Cache-Asideパターン（読み込み時にキャッシュ）
- [ ] Write-Throughパターン（書き込み時にキャッシュ更新）
- [ ] Write-Behindパターン（非同期書き込み）

### キャッシュ無効化
- [ ] TTLベース無効化（時間経過で自動削除）
- [ ] タグベース無効化（関連キャッシュを一括削除）
- [ ] イベントベース無効化（更新時に削除）

```typescript
// Cache-Asideパターン
async function getUser(userId: number) {
  const cacheKey = `user:${userId}`

  // 1. キャッシュから取得
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // 2. データベースから取得
  const user = await prisma.user.findUnique({ where: { id: userId } })

  // 3. キャッシュに保存
  if (user) {
    await redis.setex(cacheKey, 3600, JSON.stringify(user))
  }

  return user
}
```

---

## コネクションプーリング

### 設定
- [ ] 適切なプールサイズ設定（CPU数 * 2 + 1）
- [ ] 最小接続数設定
- [ ] アイドル接続のタイムアウト設定
- [ ] 接続タイムアウト設定

### ベストプラクティス
- [ ] 接続を使い終わったら必ずrelease
- [ ] トランザクション使用時は専用接続を取得
- [ ] アプリケーション終了時にpool.end()

```typescript
// PostgreSQL: pg-pool
const pool = new Pool({
  max: 20,              // 最大コネクション数
  min: 5,               // 最小コネクション数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

---

## パーティショニング

### 適用検討
- [ ] テーブルサイズが数百万行以上
- [ ] 時系列データ（ログ、イベント）
- [ ] アーカイブデータの定期削除が必要

### パーティショニング種類
- [ ] レンジパーティショニング（日付ベース）
- [ ] リストパーティショニング（カテゴリベース）
- [ ] ハッシュパーティショニング（均等分散）

### メンテナンス
- [ ] 定期的に新しいパーティション作成
- [ ] 古いパーティション削除またはアーカイブ
- [ ] pg_partman拡張で自動管理（PostgreSQL）

---

## モニタリング

### PostgreSQL
- [ ] pg_stat_statements拡張を有効化
- [ ] 最も実行回数が多いクエリを監視
- [ ] 最も時間がかかるクエリを監視
- [ ] 平均実行時間が長いクエリを監視
- [ ] テーブルサイズを監視
- [ ] インデックスサイズを監視
- [ ] 未使用インデックスを定期確認
- [ ] キャッシュヒット率を監視

```sql
-- 最も実行回数が多いクエリ
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- 未使用インデックス
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### MySQL
- [ ] Performance Schema有効化
- [ ] 最も実行回数が多いクエリを監視
- [ ] 最も時間がかかるクエリを監視
- [ ] テーブルI/O統計を監視

### アプリケーションレベル
- [ ] クエリ実行時間をログ出力
- [ ] 遅いクエリに警告
- [ ] Prometheusでメトリクス収集
- [ ] Grafanaでダッシュボード作成

```typescript
// Prismaクエリロギング
prisma.$on('query', (e) => {
  console.log('Query: ' + e.query)
  console.log('Duration: ' + e.duration + 'ms')

  if (e.duration > 1000) {
    console.warn(`Slow query detected: ${e.duration}ms`)
  }
})
```

---

## パフォーマンスアンチパターン

### 回避すべきパターン
- [ ] SELECT * の使用
- [ ] OFFSETの大きな値
- [ ] OR条件の多用（INに置き換え）
- [ ] LIKE '%pattern%'（前方ワイルドカード）
- [ ] COUNT(*) on 大きいテーブル（概算カウント使用）
- [ ] 相関サブクエリの多用
- [ ] トランザクションの長時間保持
- [ ] 重複インデックス
- [ ] 暗黙的な型変換
- [ ] 過度な正規化（JOINが多すぎる）

---

## 実行プラン分析

### PostgreSQL: EXPLAIN ANALYZE
- [ ] Seq Scan（フルスキャン）を確認
- [ ] Index Scan使用を確認
- [ ] Index Only Scan使用を確認
- [ ] JOIN方式を確認（Nested Loop, Hash Join, Merge Join）
- [ ] 実行時間を確認

```sql
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'user@example.com';
```

### MySQL: EXPLAIN
- [ ] type列を確認（ALL, index, range, ref, eq_ref, const）
- [ ] possible_keys列を確認
- [ ] key列を確認（実際に使用されたインデックス）
- [ ] rows列を確認（スキャン行数）

```sql
EXPLAIN
SELECT * FROM users WHERE email = 'user@example.com';
```

---

## トランザクション最適化

### 分離レベル
- [ ] 適切な分離レベルを選択
  - READ UNCOMMITTED: ダーティリード許容
  - READ COMMITTED: デフォルト
  - REPEATABLE READ: ファントムリード防止
  - SERIALIZABLE: 最も厳格

### ロック戦略
- [ ] 楽観的ロック（バージョン管理）
- [ ] 悲観的ロック（FOR UPDATE）
- [ ] デッドロック回避（常に同じ順序でロック）

### トランザクション設計
- [ ] トランザクションを最小限に
- [ ] 外部API呼び出しをトランザクション外に
- [ ] 長時間のトランザクションを避ける

---

## 本番環境チェックリスト

### デプロイ前
- [ ] ステージング環境でパフォーマンステスト
- [ ] 実行プランを確認
- [ ] インデックス作成計画
- [ ] バックアップ作成

### デプロイ時
- [ ] ピークタイム外に実行
- [ ] インデックス作成はCONCURRENTLY使用
- [ ] モニタリング強化

### デプロイ後
- [ ] クエリパフォーマンス監視
- [ ] キャッシュヒット率監視
- [ ] データベース負荷監視
- [ ] エラーログ確認

---

## まとめ: 優先順位別チェックリスト

### 最優先（即座に実施）
- [ ] SELECT * を必要なカラムのみに変更
- [ ] WHERE句で頻繁に使用されるカラムにインデックス作成
- [ ] N+1問題の解消（Eager Loading）
- [ ] 遅いクエリの特定と最適化

### 高優先（1週間以内）
- [ ] Covering Indexの検討
- [ ] 部分インデックスの検討
- [ ] Redisキャッシュ導入
- [ ] コネクションプーリング設定
- [ ] 未使用インデックスの削除

### 中優先（1ヶ月以内）
- [ ] パーティショニングの検討
- [ ] モニタリング強化
- [ ] 定期的なパフォーマンスレビュー
- [ ] ドキュメント整備

### 低優先（継続的に改善）
- [ ] クエリパターンの最適化
- [ ] データベース設定チューニング
- [ ] 定期的なメンテナンス（VACUUM、ANALYZE）
