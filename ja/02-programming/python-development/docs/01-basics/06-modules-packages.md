# モジュールとパッケージ — 完全入門ガイド


> インポート・標準ライブラリ・pip・仮想環境など Python のモジュールとパッケージを学ぶガイド。
## 目次

1. [概要](#概要)
2. [モジュールとは？](#モジュールとは)
3. [標準ライブラリ](#標準ライブラリ)
4. [pip とパッケージ管理](#pip-とパッケージ管理)
5. [仮想環境](#仮想環境)
6. [練習問題](#練習問題)
7. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- モジュールのインポート
- 標準ライブラリの活用
- pip を使ったパッケージのインストール
- 仮想環境の作成と使い方

### 所要時間の目安：1〜2時間

---

## モジュールとは？

### モジュールのインポート

```python
# モジュール全体をインポートする
import math
print(math.pi)        # 3.141592...
print(math.sqrt(16))  # 4.0

# 特定の関数だけインポートする
from math import pi, sqrt
print(pi)
print(sqrt(16))

# エイリアスを付けてインポートする
import math as m
print(m.pi)

# すべてをインポートする（非推奨）
from math import *
```

### 自分でモジュールを作る

```python
# mymodule.py
def greet(name):
    return f"Hello, {name}!"

PI = 3.14159

# main.py
import mymodule
print(mymodule.greet("Alice"))
print(mymodule.PI)
```

---

## 標準ライブラリ

### よく使われる標準ライブラリ

#### os（オペレーティングシステム）

```python
import os

# カレントディレクトリを取得する
print(os.getcwd())

# ディレクトリ内のファイル一覧
print(os.listdir("."))

# パスを結合する
path = os.path.join("folder", "file.txt")
```

#### datetime（日時）

```python
from datetime import datetime, timedelta

# 現在時刻
now = datetime.now()
print(now.strftime("%Y-%m-%d %H:%M:%S"))

# 日時の計算
tomorrow = now + timedelta(days=1)
print(tomorrow)
```

#### random（乱数）

```python
import random

# ランダムな整数
print(random.randint(1, 10))

# リストからランダムに選ぶ
fruits = ["apple", "banana", "orange"]
print(random.choice(fruits))

# シャッフル
random.shuffle(fruits)
```

#### json（JSON 処理）

```python
import json

# 辞書を JSON 文字列に変換する
data = {"name": "Alice", "age": 25}
json_str = json.dumps(data)

# JSON 文字列を辞書に変換する
data2 = json.loads(json_str)
```

---

## pip とパッケージ管理

### pip の基本コマンド

```bash
# パッケージをインストールする
pip install requests

# バージョンを指定してインストールする
pip install requests==2.28.0

# 複数パッケージを一括インストールする
pip install requests pandas numpy

# インストール済みパッケージの一覧
pip list

# パッケージをアンインストールする
pip uninstall requests

# パッケージの情報を確認する
pip show requests

# パッケージをアップグレードする
pip install --upgrade requests
```

### requirements.txt

```bash
# インストール済みパッケージを保存する
pip freeze > requirements.txt

# requirements.txt からインストールする
pip install -r requirements.txt
```

**requirements.txt の例**：
```
requests==2.28.0
pandas==1.5.0
numpy==1.23.0
```

---

## 仮想環境

### 仮想環境を使う理由

- プロジェクトごとに異なるパッケージバージョンを使い分けられる
- システム全体の Python 環境に影響を与えない
- requirements.txt で環境を再現できる

### venv の使い方

```bash
# 仮想環境を作成する
python -m venv myenv

# 有効化する
# Windows
myenv\Scripts\activate

# macOS/Linux
source myenv/bin/activate

# パッケージをインストールする（仮想環境内）
pip install requests

# 無効化する
deactivate
```

### プロジェクト構成の例

```
my_project/
├── myenv/              # 仮想環境（.gitignore に追加）
├── src/
│   └── main.py
├── requirements.txt
└── README.md
```

---

## 練習問題

### 問題1：ファイル操作

```python
import os

# カレントディレクトリ内の .py ファイルを一覧表示する
for file in os.listdir("."):
    if file.endswith(".py"):
        print(file)
```

### 問題2：日付計算

```python
from datetime import datetime, timedelta

# 100日後の日付を計算する
today = datetime.now()
future = today + timedelta(days=100)
print(f"100日後: {future.strftime('%Y-%m-%d')}")
```

### 問題3：JSON の読み書き

```python
import json

# データを用意する
users = [
    {"name": "Alice", "age": 25},
    {"name": "Bob", "age": 30}
]

# JSON ファイルに書き込む
with open("users.json", "w", encoding="utf-8") as f:
    json.dump(users, f, indent=2)

# JSON ファイルを読み込む
with open("users.json", "r", encoding="utf-8") as f:
    loaded_users = json.load(f)
    print(loaded_users)
```

---

## 次のステップ

### このガイドで学んだこと

- モジュールのインポート
- 標準ライブラリの活用
- pip によるパッケージ管理
- 仮想環境の作成

### おめでとうございます！

Python 基礎シリーズを完走しました。

### 次に学ぶこと

1. **オブジェクト指向プログラミング** — クラスとオブジェクト、継承、カプセル化
2. **ファイル入出力** — ファイルの読み書き、CSV の操作
3. **エラーハンドリング** — try/except、独自例外
4. **実践プロジェクト** — Web スクレイピング、データ分析、Web API

### 関連リソース

- [Python 公式ドキュメント](https://docs.python.org/3/)
- [Real Python](https://realpython.com/)
- [PyPI](https://pypi.org/)

---

**前のガイド**：[05-data-structures.md](./05-data-structures.md)
