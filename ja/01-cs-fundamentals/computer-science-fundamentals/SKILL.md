---
name: computer-science-fundamentals
description: コンピュータサイエンスの基礎知識を網羅的にカバー。ハードウェアの仕組みからデータ表現、アルゴリズム、データ構造、計算理論、プログラミングパラダイム、ソフトウェアエンジニアリング基礎まで、エンジニアに必要な全てのCS基礎知識を体系的に解説。
---

# コンピュータサイエンス基礎

## 目次

1. [概要](#概要)
2. [いつ使うか](#いつ使うか)
3. [学習ロードマップ](#学習ロードマップ)
4. [セクション一覧](#セクション一覧)
5. [ベストプラクティス](#ベストプラクティス)
6. [詳細ドキュメント](#詳細ドキュメント)

---

## 概要

このSkillは、**コンピュータサイエンスの基礎知識**を包括的にカバーする。フレームワークやライブラリは5年で変わるが、ここで扱うCS基礎は50年以上変わらない普遍的な知識であり、エンジニアとしての基礎体力そのものである。

### カバー範囲

- ハードウェアの仕組み（CPU、メモリ、ストレージ、GPU、I/O）
- データ表現（2進数、文字コード、整数、浮動小数点、圧縮）
- アルゴリズム（計算量解析、ソート、探索、再帰、DP、グラフ）
- データ構造（配列、リスト、スタック、キュー、ハッシュ、木、グラフ）
- 計算理論（オートマトン、形式言語、チューリングマシン、計算可能性、P vs NP）
- プログラミングパラダイム（命令型、関数型、OOP、論理型、マルチパラダイム）
- ソフトウェアエンジニアリング基礎（開発手法、バージョン管理、テスト、デバッグ）
- 発展トピック（分散システム、並行処理、セキュリティ、AI/ML入門）

### 前提知識

- **不要**。本Skillはゼロからコンピュータサイエンスを学ぶための入口として設計されている。
- プログラミング経験があるとより理解が深まるが、必須ではない。

### 対象読者

- **初心者**: プログラミングを始めたばかりで、CS基礎を体系的に学びたい人
- **中級者**: 実務経験はあるが、CS基礎に不安がある人、転職面接に備えたい人
- **上級者**: 知識の棚卸し、深い理論的理解の獲得、チーム教育の参考にしたい人

---

## いつ使うか

### 自動的に参照されるケース

- パフォーマンス問題の調査（計算量、メモリ使用量の分析）
- データ構造の選択（配列 vs ハッシュ vs 木の判断）
- アルゴリズムの設計と最適化
- 低レベルの問題（文字化け、浮動小数点誤差、整数オーバーフロー）
- システム設計の議論（CAP定理、一貫性モデル）

### 手動で参照すべきケース

- CS基礎の体系的な学習を開始するとき
- 技術面接の準備
- チームメンバーへの教育・メンタリング
- 特定のCS概念の深い理解が必要なとき

---

## 学習ロードマップ

### Phase 1: 基礎の基礎（1-2ヶ月）

```
00-introduction → 01-hardware-basics → 02-data-representation
「コンピュータが物理的にどう動くか」を理解する
```

### Phase 2: アルゴリズムとデータ構造（2-3ヶ月）

```
03-algorithms-basics → 04-data-structures
「問題を効率的に解く方法」を身につける
```

### Phase 3: 理論と応用（2-3ヶ月）

```
05-computation-theory → 06-programming-paradigms → 07-software-engineering-basics → 08-advanced-topics
「なぜそうなのか」を理論的に理解し、実務に応用する
```

---

## セクション一覧

### 00 - Introduction（導入）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | [overview.md](docs/00-introduction/00-overview.md) | コンピュータサイエンスの全体像 — CSの定義、主要分野、なぜ学ぶべきか |
| 01 | [history-of-computing.md](docs/00-introduction/01-history-of-computing.md) | コンピューティングの歴史 — そろばんから量子コンピュータまで |
| 02 | [why-learn-cs.md](docs/00-introduction/02-why-learn-cs.md) | なぜCSを学ぶのか — 具体的なメリット、CS知識なしの失敗例 |
| 03 | [learning-path.md](docs/00-introduction/03-learning-path.md) | CS学習ロードマップ — 目標別カスタムパス、リソース一覧 |

コンピュータサイエンスとは何か、その全体像を俯瞰する導入セクション。CSの歴史を紐解きながら、なぜエンジニアにCSの知識が不可欠なのかを具体例を交えて解説する。さらに、読者のレベルと目標に応じた最適な学習パスを提示し、本Skill全体の見通しを立てる。

CSは単なる「プログラミング」ではない。計算可能性、効率性、正確性を数学的に扱う学問であり、その基礎はハードウェアからソフトウェア、理論から応用まで広範囲にわたる。本セクションではその全体像を把握し、以降のセクションへの道標を提供する。

### 01 - Hardware Basics（ハードウェアの基礎）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | [cpu-architecture.md](docs/01-hardware-basics/00-cpu-architecture.md) | CPUアーキテクチャ — 命令サイクル、パイプライン、CISC vs RISC |
| 01 | [memory-hierarchy.md](docs/01-hardware-basics/01-memory-hierarchy.md) | メモリ階層 — キャッシュ、RAM、局所性の原理、仮想メモリ |
| 02 | [storage-systems.md](docs/01-hardware-basics/02-storage-systems.md) | ストレージ — HDD、SSD、NVMe、ファイルシステム、RAID |
| 03 | [motherboard-and-bus.md](docs/01-hardware-basics/03-motherboard-and-bus.md) | マザーボードとバス — PCIe、USB、チップセット、ブートプロセス |
| 04 | [gpu-and-parallel.md](docs/01-hardware-basics/04-gpu-and-parallel.md) | GPUと並列計算 — CUDA、OpenCL、AI学習エンジン |
| 05 | [io-systems.md](docs/01-hardware-basics/05-io-systems.md) | I/Oシステム — 割り込み、DMA、デバイスドライバ |
| 06 | [pcb-and-circuits.md](docs/01-hardware-basics/06-pcb-and-circuits.md) | 電子回路 — トランジスタ、論理ゲート、半導体製造 |
| 07 | [capacity-limits.md](docs/01-hardware-basics/07-capacity-limits.md) | 性能限界と未来 — ムーアの法則、量子コンピュータ |

ソフトウェアは最終的にハードウェア上で動く。CPUが命令をどう実行し、メモリがどう階層化され、ストレージがどうデータを永続化するかを理解することは、パフォーマンスを意識したプログラミングの第一歩である。

CPUのパイプライン処理を理解すれば分岐予測ミスのコストが分かり、メモリ階層を知ればキャッシュフレンドリーなコードが書ける。GPUの仕組みを知ればAI学習の高速化が理解でき、I/Oの仕組みを知ればio_uringやDPDKの意義が分かる。このセクションはプログラマーの視点でハードウェアを解説し、実務に直結する知識を提供する。

### 02 - Data Representation（データ表現）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | [binary-and-number-systems.md](docs/02-data-representation/00-binary-and-number-systems.md) | 2進数と数値表現 — ビット演算、基数変換 |
| 01 | [character-encoding.md](docs/02-data-representation/01-character-encoding.md) | 文字コード — ASCII、Unicode、UTF-8、文字化け対策 |
| 02 | [integer-representation.md](docs/02-data-representation/02-integer-representation.md) | 整数表現 — 2の補数、オーバーフロー、エンディアン |
| 03 | [floating-point.md](docs/02-data-representation/03-floating-point.md) | 浮動小数点数 — IEEE 754、丸め誤差、0.1+0.2問題 |
| 04 | [compression-algorithms.md](docs/02-data-representation/04-compression-algorithms.md) | 圧縮アルゴリズム — ハフマン、LZ77、DEFLATE、JPEG/MP3 |
| 05 | [storage-capacity.md](docs/02-data-representation/05-storage-capacity.md) | データ量の感覚 — 単位、Back-of-the-envelope計算 |
| 06 | [brain-vs-computer.md](docs/02-data-representation/06-brain-vs-computer.md) | 脳とコンピュータの比較 — 情報処理方式の根本的な違い |

コンピュータ内部では全てのデータが0と1で表現される。テキスト、数値、画像、音声 — 全てはビット列の解釈の仕方が異なるだけである。このセクションではデータ表現の全てを解説する。

0.1 + 0.2 ≠ 0.3 の理由、文字化けの原因、整数オーバーフローによる事故事例（Ariane 5ロケット爆発）など、データ表現の理解不足が引き起こす実務上の問題は多い。IEEE 754の仕組みをビットレベルで理解し、UTF-8のバイト構造を把握することで、これらの問題を根本から理解し予防できる。

### 03 - Algorithms Basics（アルゴリズムの基礎）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | what-is-algorithm.md | アルゴリズムとは — 定義、表現方法、設計手法概観 |
| 01 | complexity-analysis.md | 計算量解析 — Big-O、Big-Ω、Big-Θ、償却計算量 |
| 02 | sorting-algorithms.md | ソートアルゴリズム — バブル〜TimSort、比較ソートの下界 |
| 03 | searching-algorithms.md | 探索アルゴリズム — 線形、二分、ハッシュ、文字列探索 |
| 04 | recursion-and-divide.md | 再帰と分割統治 — コールスタック、Master Theorem |
| 05 | greedy-algorithms.md | 貪欲法 — 活動選択、ハフマン、ダイクストラ |
| 06 | dynamic-programming.md | 動的計画法 — ナップサック、LCS、編集距離 |
| 07 | graph-algorithms.md | グラフアルゴリズム — BFS/DFS、最短経路、MST、トポロジカルソート |

アルゴリズムはCSの心臓部である。O(n)とO(n²)の違いは、データが100万件になると「1秒 vs 11.5日」の差になる。この差を理解し、適切なアルゴリズムを選択できるかどうかが、エンジニアの実力を分ける。

ソート、探索、再帰、動的計画法、グラフアルゴリズムという5大テーマを、理論（計算量証明）と実践（動作するコード）の両面から解説する。各アルゴリズムは「なぜこの方法が効率的なのか」を内部的に解説し、単なる暗記ではなく深い理解を促す。

### 04 - Data Structures（データ構造）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | arrays-and-lists.md | 配列と連結リスト — 動的配列、スキップリスト |
| 01 | stacks-and-queues.md | スタックとキュー — LIFO/FIFO、Deque、優先度キュー |
| 02 | hash-tables.md | ハッシュテーブル — 衝突解決、ブルームフィルタ、一貫性ハッシュ |
| 03 | trees-basics.md | 木構造の基礎 — 二分探索木、走査、トライ木 |
| 04 | balanced-trees.md | 平衡木 — AVL木、赤黒木、B木、B+木 |
| 05 | heaps-and-priority.md | ヒープと優先度キュー — 二分ヒープ、フィボナッチヒープ |
| 06 | graphs.md | グラフ — 隣接行列/リスト、Union-Find |
| 07 | advanced-structures.md | 発展的データ構造 — ブルームフィルタ、LRUキャッシュ、ロープ |

「適切なデータ構造を選ぶ」ことは、プログラミングにおける最も重要な判断の一つである。配列、ハッシュテーブル、木、グラフ — それぞれに得意・不得意があり、問題に応じた最適な選択ができるかどうかでコードの品質が決まる。

各データ構造について、内部実装の仕組み、計算量、メモリ使用量、キャッシュ効率まで深く解説する。さらに、各プログラミング言語（Python、JavaScript、Java、Rust）での標準ライブラリの実装も比較し、実務ですぐに使える知識を提供する。

### 05 - Computation Theory（計算理論）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | automata-theory.md | オートマトン理論 — DFA/NFA、正規表現エンジン |
| 01 | formal-languages.md | 形式言語 — チョムスキー階層、BNF、構文解析 |
| 02 | turing-machines.md | チューリングマシン — 計算の数学的定義 |
| 03 | computability.md | 計算可能性 — 停止問題、決定不能性 |
| 04 | complexity-classes.md | 計算量クラス — P、NP、NP完全、P vs NP問題 |
| 05 | information-theory.md | 情報理論 — エントロピー、シャノンの定理 |

計算理論はCSの最も深い層であり、「何が計算可能で、何が不可能か」を数学的に明らかにする。正規表現がなぜ再帰的なパターンにマッチできないのか、完璧なバグ検出ツールがなぜ作れないのか — これらの「不可能」を理解することは、エンジニアの思考の深さを決定的に変える。

### 06 - Programming Paradigms（プログラミングパラダイム）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | [imperative.md](docs/06-programming-paradigms/00-imperative.md) | 命令型プログラミング — 手続き型、構造化、C言語 |
| 01 | functional.md | 関数型プログラミング — 純粋関数、不変性、モナド |
| 02 | object-oriented.md | オブジェクト指向 — SOLID、デザインパターン |
| 03 | logic.md | 論理型プログラミング — Prolog、宣言的プログラミング |
| 04 | multi-paradigm.md | マルチパラダイム — Rust、Kotlin、TypeScript |

### 07 - Software Engineering Basics（ソフトウェアエンジニアリング基礎）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | development-lifecycle.md | 開発ライフサイクル — ウォーターフォール、アジャイル、DevOps |
| 01 | version-control.md | バージョン管理 — Gitの内部構造、ブランチ戦略 |
| 02 | testing-fundamentals.md | テスト基礎 — テストピラミッド、TDD、BDD |
| 03 | debugging-techniques.md | デバッグ技法 — 科学的デバッグ、プロファイリング |
| 04 | documentation-practices.md | ドキュメンテーション — Docs as Code、ADR |

### 08 - Advanced Topics（発展トピック）

| # | ファイル | 内容 |
|---|---------|------|
| 00 | distributed-systems-intro.md | 分散システム入門 — CAP定理、Raft、マイクロサービス |
| 01 | concurrency-intro.md | 並行処理入門 — スレッド、デッドロック、async/await |
| 02 | security-intro.md | セキュリティ入門 — 暗号、TLS、OWASP Top 10 |
| 03 | ai-ml-intro.md | AI/ML入門 — 機械学習分類、ニューラルネット、LLM |

---

## ベストプラクティス

### CS学習

1. **理論と実践を交互に** — 理論を学んだら必ずコードで確認する
2. **計算量を常に意識** — 全てのコードに対して「O(?)」を考える習慣を持つ
3. **「なぜ」を追求する** — 手法だけでなく、なぜその手法が正しいかを理解する
4. **手を動かす** — 主要なデータ構造とアルゴリズムは一度は自分で実装する
5. **実務と結びつける** — 学んだ概念が実際のプロダクトでどう使われているか考える
6. **段階的に深める** — 最初は概要を掴み、必要に応じて深い理論に踏み込む
7. **複数の言語で実装** — 同じアルゴリズムをPython、C、Rustで書くと理解が深まる
8. **可視化する** — データ構造やアルゴリズムの動作を図に描いて理解する
9. **教える** — 学んだことを他者に説明できるレベルを目指す
10. **継続する** — CS基礎は一度学べば終わりではなく、深さは無限

### アンチパターン

1. **「CSは数学だから無理」** — CS基礎の大半は高校数学レベルで理解できる
2. **「プログラミングができればCSは不要」** — スケールしないコードを書く原因
3. **「最新技術だけ追えばいい」** — 基礎なき応用は砂上の楼閣
4. **「教科書を最初から全部読む」** — 必要な箇所から実践的に学ぶべき
5. **「LeetCodeだけやればいい」** — パターン暗記ではなく本質的理解が重要
6. **「アルゴリズムは実務で使わない」** — 意識せずに使っているだけ
7. **「理論は不要」** — 理論を知らないと不可能な問題に挑んで時間を無駄にする
8. **「一度学べば忘れない」** — 定期的な復習と実践が必要
9. **「完璧に理解してから次へ」** — 80%理解で次に進み、後から深める
10. **「暗記で乗り切る」** — 原理を理解すれば暗記は不要になる

---

## 詳細ドキュメント

| ディレクトリ | 内容 | ファイル数 |
|-------------|------|----------|
| `docs/00-introduction/` | 導入、歴史、学習パス | 4 |
| `docs/01-hardware-basics/` | ハードウェアの仕組み | 8 |
| `docs/02-data-representation/` | データの内部表現 | 7 |
| `docs/03-algorithms-basics/` | アルゴリズムの基礎 | 8 |
| `docs/04-data-structures/` | データ構造 | 8 |
| `docs/05-computation-theory/` | 計算理論 | 6 |
| `docs/06-programming-paradigms/` | プログラミングパラダイム | 5 |
| `docs/07-software-engineering-basics/` | SE基礎 | 5 |
| `docs/08-advanced-topics/` | 発展トピック | 4 |
| **合計** | | **55** |

---

## 関連Skills

| Skill | 関係 |
|-------|------|

---

## 参考文献

1. Cormen, T. H. et al. "Introduction to Algorithms" (CLRS). MIT Press, 4th Edition, 2022.
2. Bryant, R. E. & O'Hallaron, D. R. "Computer Systems: A Programmer's Perspective" (CS:APP). Pearson, 3rd Edition, 2015.
3. Patterson, D. A. & Hennessy, J. L. "Computer Organization and Design" (COD). Morgan Kaufmann, 6th Edition, 2020.
4. Sipser, M. "Introduction to the Theory of Computation". Cengage, 3rd Edition, 2012.
5. Abelson, H. & Sussman, G. J. "Structure and Interpretation of Computer Programs" (SICP). MIT Press, 2nd Edition, 1996.
6. Tanenbaum, A. S. "Modern Operating Systems". Pearson, 4th Edition, 2014.
7. Knuth, D. E. "The Art of Computer Programming". Addison-Wesley, Volumes 1-4A.
8. Shannon, C. E. "A Mathematical Theory of Communication". Bell System Technical Journal, 1948.
9. Turing, A. M. "On Computable Numbers, with an Application to the Entscheidungsproblem". 1936.
10. ACM/IEEE. "Computing Curricula 2020". ACM, 2020.
11. MIT OpenCourseWare. "6.006 Introduction to Algorithms". https://ocw.mit.edu/
12. Stanford CS Library. https://cs.stanford.edu/
