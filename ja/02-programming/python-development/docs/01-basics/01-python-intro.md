# Python 入門 — 完全初心者ガイド

## 目次

1. [概要](#概要)
2. [前提知識](#前提知識)
3. [Python とは？](#python-とは)
4. [Python を学ぶ理由](#python-を学ぶ理由)
5. [Python のインストール](#python-のインストール)
6. [開発環境のセットアップ](#開発環境のセットアップ)
7. [最初の Python プログラム](#最初の-python-プログラム)
8. [REPL（インタラクティブモード）の使い方](#replインタラクティブモードの使い方)
9. [よくある問題と解決策](#よくある問題と解決策)
10. [練習問題](#練習問題)
11. [次のステップ](#次のステップ)

> Python とは何か・インストール・最初のプログラム・REPL の使い方を学ぶ完全初心者ガイド。

---

## 概要

### 学べること

- Python の基本概念と特徴
- Python が人気な理由と使われている場所
- Python のインストール方法
- 開発環境のセットアップ（VS Code + Python 拡張機能）
- 最初の Python プログラムの実行
- REPL（インタラクティブモード）の使い方

### なぜ重要か

**Python** は世界で最も人気のあるプログラミング言語の1つです（TIOBE Index 2024 で第1位）。Python を学ぶことで得られるもの：

- **初心者に優しい**: シンプルで読みやすい構文
- **幅広い用途**: Web 開発・データ分析・AI/ML・自動化など
- **豊富なエコシステム**: PyPI に 130 万以上のパッケージ
- **キャリアの可能性**: データサイエンティスト・バックエンドエンジニア・AI エンジニアなど

### 想定時間

- このガイドを読むだけ: 30〜40 分
- 環境構築を含む場合: 1〜2 時間

---

## 前提知識

### 必要な知識

**なし。** このガイドはプログラミング未経験者向けに書かれています。

### 推奨環境

- **OS**: Windows 10/11、macOS 10.15 以降、または Linux
- **メモリ**: 4 GB 以上（8 GB 以上推奨）
- **ディスク**: 2 GB 以上の空き容量

---

## Python とは？

### 公式の定義

Python の公式サイトでは次のように定義されています：

> "Python is a programming language that lets you work quickly and integrate systems more effectively."
> （Python は素早く作業し、システムをより効果的に統合できるプログラミング言語です。）

### より詳しい説明

Python は **1991 年に Guido van Rossum が開発した汎用プログラミング言語**です。

#### 1. インタープリタ言語

Python は**インタープリタ言語**です。コンパイル不要で、書いたコードをすぐに実行できます。

```python
# このコードを書いてすぐ実行できる
print("Hello, World!")
```

**コンパイル言語（C、Java など）との違い**：
- **コンパイル言語**: コード → コンパイル → 実行ファイル → 実行
- **インタープリタ言語**: コード → 実行（直接）

#### 2. 動的型付け言語

Python は**動的型付け**を採用しています。変数の型を明示的に宣言する必要はありません。

```python
# 型宣言不要（型は自動的に推論される）
name = "Alice"      # 文字列
age = 25            # 整数
height = 175.5      # 浮動小数点数
is_student = True   # 真偽値
```

**静的型付け言語（TypeScript、Java など）との違い**：
```typescript
// TypeScript（静的型付け）
let name: string = "Alice";
let age: number = 25;
```

```python
# Python（動的型付け）
name = "Alice"
age = 25
```

#### 3. オブジェクト指向言語

Python は**オブジェクト指向プログラミング**をサポートしています。

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        print(f"{self.name}: ワン！")

# オブジェクトを作成
my_dog = Dog("レックス")
my_dog.bark()  # 出力: レックス: ワン！
```

#### 4. 電池付属（Batteries Included）

Python は**豊富な標準ライブラリ**を持っています。追加インストールなしで多くの機能が使えます。

```python
# ファイル操作
import os
print(os.getcwd())  # カレントディレクトリを出力

# 日付と時刻
import datetime
print(datetime.datetime.now())  # 現在時刻を出力

# HTTP リクエスト
import urllib.request
response = urllib.request.urlopen('https://example.com')
```

---

## Python を学ぶ理由

### 1. 読みやすく書きやすい

Python は**可読性**を優先して設計されています。

```python
# Python のコード（英語のように読める）
if age >= 20:
    print("成人")
else:
    print("未成年")
```

```java
// Java（比較）
if (age >= 20) {
    System.out.println("成人");
} else {
    System.out.println("未成年");
}
```

**Python の特徴**：
- インデント（空白）がブロックを定義する
- セミコロン不要
- 波括弧 `{}` 不要

### 2. 多くの分野で活用されている

Python は幅広い分野で使われています：

#### Web 開発
- **Django**: Instagram・Pinterest・Disqus が使用
- **Flask**: Uber・Reddit が使用
- **FastAPI**: 最速の Python Web フレームワーク

#### データサイエンスと機械学習
- **NumPy, Pandas**: データ分析
- **Matplotlib, Seaborn**: 可視化
- **scikit-learn**: 機械学習
- **TensorFlow, PyTorch**: 深層学習

#### 自動化とスクリプティング
- **ファイル処理**: 大量ファイルの一括操作
- **Web スクレイピング**: BeautifulSoup、Scrapy
- **タスク自動化**: 日常業務の効率化

#### その他の分野
- **ゲーム開発**: Pygame
- **デスクトップアプリ**: Tkinter、PyQt
- **科学計算**: SciPy、SymPy

### 3. 豊富なライブラリエコシステム

**PyPI（Python Package Index）** には 130 万以上のパッケージが登録されています。

```bash
# pip でパッケージをインストール
pip install requests      # HTTP ライブラリ
pip install pandas        # データ分析
pip install django        # Web フレームワーク
pip install opencv-python # 画像処理
```

### 4. 活発なコミュニティ

- **Stack Overflow**: Python 関連の質問が 1,900 万件以上
- **GitHub**: Python リポジトリは全言語中第2位
- **PyCon**: 世界各地で Python カンファレンスが開催

### 5. 高い求人需要

Python 関連の求人は増加中：
- データサイエンティスト
- 機械学習エンジニア
- バックエンドエンジニア
- DevOps エンジニア

---

## Python のインストール

### Python のバージョン

2024 年時点での主要バージョン：
- **Python 3.12.x**: 最新安定版（推奨）
- **Python 3.11.x**: 安定版
- **Python 2.7.x**: **非推奨**（2020 年にサポート終了）

**注意**: 必ず **Python 3.x** をインストールしてください。

### インストール手順

#### Windows

1. **公式サイトにアクセス**: https://www.python.org/downloads/

2. **最新版をダウンロード**: "Download Python 3.12.x" をクリック

3. **インストーラーを実行**:
   - **"Add Python to PATH"** にチェックを入れる（重要）
   - "Install Now" をクリック

4. **インストールの確認**:
```bash
# コマンドプロンプトで確認
python --version
# 例: Python 3.12.0

pip --version
# 例: pip 23.3.1
```

#### macOS

**方法1: 公式インストーラー（推奨）**

1. https://www.python.org/downloads/ からダウンロード
2. `.pkg` ファイルを実行
3. デフォルト設定でインストール

**方法2: Homebrew**

```bash
# Homebrew が既にインストールされている場合
brew install python@3.12

# 確認
python3 --version
pip3 --version
```

#### Linux（Ubuntu/Debian）

```bash
# システムパッケージを更新
sudo apt update

# Python をインストール
sudo apt install python3 python3-pip

# 確認
python3 --version
pip3 --version
```

---

## 開発環境のセットアップ

### 推奨エディタ: VS Code

**Visual Studio Code（VS Code）** は Python との相性が抜群の無料エディタです。

#### 1. VS Code のインストール

1. https://code.visualstudio.com/ にアクセス
2. ダウンロードしてインストール

#### 2. Python 拡張機能のインストール

1. VS Code を開く
2. 左サイドバーの「拡張機能」アイコンをクリック
3. "Python" を検索
4. **Microsoft の公式 Python 拡張機能**をインストール

#### 3. プロジェクトフォルダの作成

```bash
# ホームディレクトリに移動
cd ~

# Python 学習用フォルダを作成
mkdir python-learning
cd python-learning

# VS Code で開く
code .
```

---

## 最初の Python プログラム

### Hello, World!

1. **ファイルを作成**: VS Code で `hello.py` という名前のファイルを作成

2. **コードを書く**:
```python
# hello.py
print("Hello, World!")
```

3. **実行する**

**ターミナルから実行**:
```bash
python hello.py
# または（macOS/Linux）
python3 hello.py
```

**出力**:
```
Hello, World!
```

**VS Code から実行**: 右上の「実行」ボタン（▷）をクリック、または `F5` を押す。

### もう少し複雑な例

```python
# greeting.py
name = input("お名前を入力してください: ")
age = input("年齢を入力してください: ")

print(f"こんにちは、{name} さん！")
print(f"あなたは {age} 歳ですね。")

# 年齢を数値に変換
age_number = int(age)
if age_number >= 18:
    print("あなたは成人です！")
else:
    years_left = 18 - age_number
    print(f"あと {years_left} 年で成人になります。")
```

**実行例**:
```
$ python greeting.py
お名前を入力してください: Alice
年齢を入力してください: 16
こんにちは、Alice さん！
あなたは 16 歳ですね。
あと 2 年で成人になります。
```

---

## REPL（インタラクティブモード）の使い方

### REPL とは？

**REPL**（Read-Eval-Print Loop）は Python をインタラクティブに実行できるモードです。

- **R**ead: 入力を読み込む
- **E**val: 評価（実行）する
- **P**rint: 結果を出力する
- **L**oop: 繰り返す

### REPL の起動

```bash
# ターミナルで
python
# または
python3
```

**出力**:
```python
Python 3.12.0 (main, Oct  2 2023, 14:00:00)
[Clang 15.0.0 (clang-1500.0.40.1)] on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

### REPL での操作

```python
>>> 2 + 3
5

>>> name = "Alice"
>>> print(f"こんにちは、{name}！")
こんにちは、Alice！

>>> numbers = [1, 2, 3, 4, 5]
>>> sum(numbers)
15

>>> # 複数行のコード
>>> for i in range(3):
...     print(f"カウント: {i}")
...
カウント: 0
カウント: 1
カウント: 2

>>> # 終了
>>> exit()
```

**REPL の利点**：
- **即座に試せる**: コードを書いてすぐ結果を確認できる
- **学習に最適**: 新しい機能を試すのに便利
- **電卓代わりに**: 簡単な計算にも使える

---

## よくある問題と解決策

### 問題1: `python: command not found`

**症状**:
```bash
$ python --version
python: command not found
```

**原因**:
- Python がインストールされていない
- Python が PATH に追加されていない

**解決策**:

**Windows**:
1. Python を再インストール
2. "Add Python to PATH" に必ずチェックを入れる

**macOS/Linux**:
```bash
# python3 を試す
python3 --version

# またはエイリアスを設定
echo 'alias python=python3' >> ~/.bashrc
source ~/.bashrc
```

### 問題2: `ModuleNotFoundError`

**症状**:
```python
>>> import requests
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ModuleNotFoundError: No module named 'requests'
```

**原因**: パッケージがインストールされていない。

**解決策**:
```bash
pip install requests
# または
pip3 install requests
```

### 問題3: インデントエラー

**症状**:
```python
if age >= 18:
print("成人")  # インデントなし
```

**エラー**:
```
IndentationError: expected an indented block
```

**解決策**:
```python
if age >= 18:
    print("成人")  # スペース4つのインデント
```

**Python のインデントルール**：
- タブまたはスペース4つを使用（スペース4つ推奨）
- タブとスペースを混在させない

### 問題4: 文字コードの問題

**症状**: 日本語などの非 ASCII 文字が文字化けする。

**解決策**:
```python
# ファイルの先頭に追加
# -*- coding: utf-8 -*-

print("こんにちは")
```

---

## 練習問題

### 練習1: 自己紹介プログラム

**難易度**: 初級

**課題**: 以下を表示するプログラムを作成してください：
- 自分の名前
- 年齢
- 好きな食べ物

**サンプル解答**:
```python
# self_intro.py
name = "山田 太郎"
age = 25
favorite_food = "ラーメン"

print("== 自己紹介 ==")
print(f"名前: {name}")
print(f"年齢: {age}")
print(f"好きな食べ物: {favorite_food}")
```

### 練習2: 簡単な電卓

**難易度**: 初級〜中級

**課題**: 2つの数値を入力として受け取り、四則演算の結果をすべて表示するプログラムを作成してください。

**サンプル解答**:
```python
# calculator.py
print("=== 簡単な電卓 ===")

num1 = float(input("最初の数を入力してください: "))
num2 = float(input("次の数を入力してください: "))

addition = num1 + num2
subtraction = num1 - num2
multiplication = num1 * num2
division = num1 / num2 if num2 != 0 else "エラー（ゼロ除算不可）"

print(f"\n== 計算結果 ==")
print(f"{num1} + {num2} = {addition}")
print(f"{num1} - {num2} = {subtraction}")
print(f"{num1} * {num2} = {multiplication}")
print(f"{num1} / {num2} = {division}")
```

---

## 次のステップ

### このガイドで学んだこと

- Python の基本概念と特徴
- Python のインストール方法
- 開発環境のセットアップ（VS Code）
- 最初の Python プログラムの実行
- REPL（インタラクティブモード）の使い方

### 次に学ぶこと

1. **[02-basic-syntax.md](./02-basic-syntax.md)** — 変数・型・演算子・文字列操作
2. **[03-control-flow.md](./03-control-flow.md)** — 条件分岐とループ

### 関連リソース

- [Python.org](https://www.python.org/)
- [Python チュートリアル（公式）](https://docs.python.org/ja/3/tutorial/index.html)
- [Real Python](https://realpython.com/) — 実践的なチュートリアル
- [PyPI（Python Package Index）](https://pypi.org/)

---

**次のガイド**: [02-basic-syntax.md](./02-basic-syntax.md)

**前のガイド**: なし（最初のガイドです）
