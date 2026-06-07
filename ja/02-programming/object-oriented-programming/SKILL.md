# オブジェクト指向プログラミング（OOP）完全ガイド

> オブジェクト指向プログラミングの本質を理解し、適切に活用するための包括的ガイド。4つの柱、SOLID原則、デザインパターン、アンチパターンまで、MIT級の品質で解説。

## このSkillの対象者

- OOPの基礎から応用まで体系的に学びたいエンジニア
- SOLID原則やデザインパターンを実践的に理解したい開発者
- 「継承 vs コンポジション」「いつOOPを使うべきか」の判断力を磨きたい人

## 前提知識

- プログラミングの基本（変数、関数、制御構文）
- 1つ以上のプログラミング言語の経験

## ガイド一覧

### 00-introduction（導入）
| ファイル | テーマ | 概要 |
|---------|--------|------|
| [00-what-is-oop.md](docs/00-introduction/00-what-is-oop.md) | OOPとは何か | オブジェクト指向の本質、メンタルモデル、他パラダイムとの位置づけ |
| [01-history-and-evolution.md](docs/00-introduction/01-history-and-evolution.md) | OOPの歴史と進化 | Simula→Smalltalk→C++→Java→モダン言語への進化 |
| [02-oop-vs-other-paradigms.md](docs/00-introduction/02-oop-vs-other-paradigms.md) | OOP vs 他パラダイム | 手続き型・関数型・リアクティブとの比較、使い分け |
| [03-class-and-object.md](docs/00-introduction/03-class-and-object.md) | クラスとオブジェクト | クラスの内部構造、メモリ配置、コンストラクタ、静的メンバ |

### 01-four-pillars（4つの柱）
| ファイル | テーマ | 概要 |
|---------|--------|------|
| [00-encapsulation.md](docs/01-four-pillars/00-encapsulation.md) | カプセル化 | 情報隠蔽、アクセス修飾子、不変オブジェクト、ゲッター/セッター論争 |
| [01-inheritance.md](docs/01-four-pillars/01-inheritance.md) | 継承 | 単一/多重継承、ダイヤモンド問題、抽象クラス、継承の落とし穴 |
| [02-polymorphism.md](docs/01-four-pillars/02-polymorphism.md) | ポリモーフィズム | サブタイプ・パラメトリック・アドホック、動的ディスパッチ、仮想関数テーブル |
| [03-abstraction.md](docs/01-four-pillars/03-abstraction.md) | 抽象化 | インターフェース設計、抽象クラス vs インターフェース、リーキー抽象化 |

### 02-design-principles（設計原則）
| ファイル | テーマ | 概要 |
|---------|--------|------|
| [00-solid-overview.md](docs/02-design-principles/00-solid-overview.md) | SOLID原則概要 | 5原則の全体像、なぜSOLIDが重要か、適用の判断基準 |
| [01-srp-and-ocp.md](docs/02-design-principles/01-srp-and-ocp.md) | SRP + OCP | 単一責任の原則、オープン・クローズドの原則、実践例 |
| [02-lsp-and-isp.md](docs/02-design-principles/02-lsp-and-isp.md) | LSP + ISP | リスコフの置換原則、インターフェース分離の原則 |
| [03-dip.md](docs/02-design-principles/03-dip.md) | DIP | 依存性逆転の原則、DI（依存性注入）、IoC コンテナ |

### 03-advanced-concepts（高度な概念）
| ファイル | テーマ | 概要 |
|---------|--------|------|
| [00-composition-vs-inheritance.md](docs/03-advanced-concepts/00-composition-vs-inheritance.md) | コンポジション vs 継承 | 「継承より合成を優先せよ」の理由、実践的な判断基準 |
| [01-interfaces-and-traits.md](docs/03-advanced-concepts/01-interfaces-and-traits.md) | インターフェースとトレイト | Java/TypeScript/Rust/Go での実装、ダックタイピング |
| [02-mixins-and-multiple-inheritance.md](docs/03-advanced-concepts/02-mixins-and-multiple-inheritance.md) | ミックスインと多重継承 | Python MRO、Ruby modules、TypeScript Mixins |
| [03-generics-in-oop.md](docs/03-advanced-concepts/03-generics-in-oop.md) | OOPにおけるジェネリクス | 型パラメータ、共変性/反変性、型消去 vs 単相化 |

### 04-practical-patterns（実践パターン）
| ファイル | テーマ | 概要 |
|---------|--------|------|
| [00-creational-patterns.md](docs/04-practical-patterns/00-creational-patterns.md) | 生成パターン | Factory、Builder、Singleton、Prototype |
| [01-structural-patterns.md](docs/04-practical-patterns/01-structural-patterns.md) | 構造パターン | Adapter、Decorator、Facade、Proxy、Composite |
| [02-behavioral-patterns.md](docs/04-practical-patterns/02-behavioral-patterns.md) | 振る舞いパターン | Strategy、Observer、Command、State、Iterator |
| [03-anti-patterns.md](docs/04-practical-patterns/03-anti-patterns.md) | アンチパターン | God Object、深い継承階層、Anemic Domain Model |

## 学習パス

```
基礎:     00-introduction → 01-four-pillars
原則:     02-design-principles（SOLID）
応用:     03-advanced-concepts → 04-practical-patterns
```

## 関連Skills

