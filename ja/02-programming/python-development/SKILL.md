# Python 開発

> FastAPI、Django、Flask、型ヒント、非同期プログラミング、データ処理、パフォーマンス最適化まで、高品質な Python アプリケーションを構築するために必要なすべてを網羅した総合ガイド。

## 対象者

- Python またはプログラミングを初めて学ぶ完全初心者
- Python のベストプラクティスを取り入れたい開発者
- Python で Web API やデータパイプラインを構築するエンジニア

## 前提知識

- 基本的な PC 操作（入門ガイド対象）
- Python の基礎知識（上級ガイド対象）

## 学習ガイド

### 01-basics — Python 基礎

| # | ファイル | 内容 |
|---|---------|------|
| 01 | [01-python-intro.md](docs/01-basics/01-python-intro.md) | Python とは・インストール・最初のプログラム・REPL |
| 02 | [02-basic-syntax.md](docs/01-basics/02-basic-syntax.md) | 変数・データ型・演算子・文字列操作 |
| 03 | [03-control-flow.md](docs/01-basics/03-control-flow.md) | if/elif/else・for/while ループ・break/continue/pass |
| 04 | [04-functions.md](docs/01-basics/04-functions.md) | 関数定義・引数・戻り値・スコープ・ラムダ |
| 05 | [05-data-structures.md](docs/01-basics/05-data-structures.md) | リスト・タプル・辞書・セット・内包表記 |
| 06 | [06-modules-packages.md](docs/01-basics/06-modules-packages.md) | インポート・標準ライブラリ・pip・仮想環境 |

### 02-best-practices — Python ベストプラクティス

| # | ファイル | 内容 |
|---|---------|------|
| 01 | [python-best-practices.md](docs/02-best-practices/python-best-practices.md) | 型ヒント・コード品質・プロジェクト構成・テスト |

### 03-frameworks — Web フレームワーク

| # | ファイル | 内容 |
|---|---------|------|
| 01 | [fastapi-django.md](docs/03-frameworks/fastapi-django.md) | FastAPI と Django の開発ガイド |

### 04-data-processing — データ処理

| # | ファイル | 内容 |
|---|---------|------|
| 01 | [data-processing.md](docs/04-data-processing/data-processing.md) | CSV/JSON/Excel 処理・pandas/NumPy・Web スクレイピング・自動化 |

### 05-performance — パフォーマンス最適化

| # | ファイル | 内容 |
|---|---------|------|
| 01 | [performance-optimization.md](docs/05-performance/performance-optimization.md) | プロファイリング・データ構造最適化・並行処理・キャッシュ |

## クイックリファレンス

```
Python ベストプラクティス チートシート:

  型ヒント:
    str, int, float, bool     -- プリミティブ型
    list[T], dict[K, V]       -- ジェネリクス（Python 3.9+）
    T | None                  -- None との Union（Python 3.10+）
    Optional[T]               -- T | None と同等
    Callable[[A], R]          -- 呼び出し可能型
    TypeVar, Generic[T]       -- ジェネリッククラス

  プロジェクトツール:
    ruff      -- 高速リンター + フォーマッター
    mypy      -- 静的型チェッカー
    pytest    -- テストフレームワーク
    poetry    -- 依存関係管理
    pre-commit -- コード品質のための git フック

  仮想環境:
    python -m venv venv       -- 作成
    source venv/bin/activate  -- 有効化（Linux/macOS）
    venv\Scripts\activate     -- 有効化（Windows）
    deactivate                -- 無効化
```

## 参考文献

1. Python Software Foundation. "Python Documentation." docs.python.org, 2024.
2. Tiangolo, S. "FastAPI Documentation." fastapi.tiangolo.com, 2024.
3. Django Software Foundation. "Django Documentation." djangoproject.com, 2024.
4. McKinney, W. "Python for Data Analysis." O'Reilly, 2022.
