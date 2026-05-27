# Pythonデータ処理・自動化ガイド

> **目標**: Pythonを使った効率的なデータ処理、自動化、スクレイピング、データ分析の実践的なテクニックを習得する。

## 目次

1. [データ処理の基礎](#data-processing-basics)
2. [ファイル処理](#file-processing)
3. [データ分析](#data-analysis)
4. [Webスクレイピング](#web-scraping)
5. [自動化](#automation)
6. [並列処理](#parallel-processing)

---

## データ処理の基礎

### リストと辞書の操作

**リスト内包表記**:
```python
# 基本
numbers = [1, 2, 3, 4, 5]
squared = [n ** 2 for n in numbers]
# [1, 4, 9, 16, 25]

# 条件付き
evens = [n for n in numbers if n % 2 == 0]
# [2, 4]

# 複雑な変換
users = [
    {"name": "Alice", "age": 25},
    {"name": "Bob", "age": 30},
]
names = [user["name"].upper() for user in users if user["age"] >= 25]
# ['ALICE', 'BOB']

# ネストしたループ
matrix = [[1, 2], [3, 4], [5, 6]]
flattened = [num for row in matrix for num in row]
# [1, 2, 3, 4, 5, 6]
```

**辞書内包表記**:
```python
# 基本
numbers = [1, 2, 3, 4, 5]
squared_dict = {n: n ** 2 for n in numbers}
# {1: 1, 2: 4, 3: 9, 4: 16, 5: 25}

# キーの変換
user = {"name": "Alice", "age": 25, "city": "Tokyo"}
upper_keys = {k.upper(): v for k, v in user.items()}
# {'NAME': 'Alice', 'AGE': 25, 'CITY': 'Tokyo'}

# フィルタリング
filtered = {k: v for k, v in user.items() if isinstance(v, str)}
# {'name': 'Alice', 'city': 'Tokyo'}

# 2つのリストから辞書を作成
keys = ["name", "age", "city"]
values = ["Alice", 25, "Tokyo"]
user_dict = {k: v for k, v in zip(keys, values)}
# {'name': 'Alice', 'age': 25, 'city': 'Tokyo'}
```

### データクラス

```python
from dataclasses import dataclass, field


@dataclass
class User:
    name: str
    age: int
    email: str
    tags: list[str] = field(default_factory=list)

    def __post_init__(self):
        if self.age < 0:
            raise ValueError("Age must be positive")


# 使用例
user = User(name="Alice", age=25, email="alice@example.com")
print(user)
# User(name='Alice', age=25, email='alice@example.com', tags=[])

user.tags.append("admin")
print(user.tags)
# ['admin']


@dataclass(frozen=True)  # イミュータブル（不変）
class Point:
    x: int
    y: int


point = Point(x=10, y=20)
# point.x = 30  # エラー: frozenなデータクラス
```

### イテレータとジェネレータ

**ジェネレータ**:
```python
# 基本
def count_up(max_count: int):
    """カウントアップジェネレータ"""
    count = 0
    while count < max_count:
        yield count
        count += 1


for num in count_up(5):
    print(num)  # 0, 1, 2, 3, 4


# ジェネレータ式
squared = (n ** 2 for n in range(1000000))  # メモリ効率が良い
first_10 = list(squared)[:10]


# 大きなファイルを効率的に読み込む
def read_large_file(file_path: str):
    """大きなファイルを1行ずつ処理する"""
    with open(file_path) as f:
        for line in f:
            yield line.strip()


for line in read_large_file("large_file.txt"):
    process_line(line)
```

**itertools**:
```python
from itertools import chain, combinations, groupby, islice, product

# chain: 複数のイテラブルを結合
list1 = [1, 2, 3]
list2 = [4, 5, 6]
combined = list(chain(list1, list2))
# [1, 2, 3, 4, 5, 6]

# combinations: すべての組み合わせ
items = ['A', 'B', 'C']
combos = list(combinations(items, 2))
# [('A', 'B'), ('A', 'C'), ('B', 'C')]

# product: 直積（デカルト積）
colors = ['red', 'green']
sizes = ['S', 'M', 'L']
products = list(product(colors, sizes))
# [('red', 'S'), ('red', 'M'), ('red', 'L'), ('green', 'S'), ...]

# groupby: アイテムをグループ化
data = [
    {"name": "Alice", "dept": "Sales"},
    {"name": "Bob", "dept": "Sales"},
    {"name": "Charlie", "dept": "Engineering"},
]
data.sort(key=lambda x: x["dept"])  # groupby前にソートが必要

for dept, group in groupby(data, key=lambda x: x["dept"]):
    print(f"{dept}: {[user['name'] for user in group]}")
# Sales: ['Alice', 'Bob']
# Engineering: ['Charlie']

# islice: イテラブルをスライス
numbers = range(100)
first_10 = list(islice(numbers, 10))
# [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

---

## ファイル処理

### CSV処理

```python
import csv
from pathlib import Path
from typing import Iterator


def read_csv(file_path: str) -> Iterator[dict[str, str]]:
    """CSVを辞書のイテレータとして読み込む"""
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def write_csv(file_path: str, data: list[dict[str, str]], fieldnames: list[str]):
    """辞書のリストをCSVに書き出す"""
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)


# 使用例
users = [
    {"name": "Alice", "age": "25", "city": "Tokyo"},
    {"name": "Bob", "age": "30", "city": "Osaka"},
]
write_csv("users.csv", users, fieldnames=["name", "age", "city"])

for user in read_csv("users.csv"):
    print(user["name"], user["age"])
```

**pandasを使ったCSV処理**:
```python
import pandas as pd

# CSVを読み込む
df = pd.read_csv("users.csv")

# データを確認する
print(df.head())
print(df.info())
print(df.describe())

# フィルタリング
adults = df[df["age"] >= 20]

# 列を追加
df["age_group"] = df["age"].apply(lambda age: "adult" if age >= 20 else "minor")

# グループ集計
grouped = df.groupby("city")["age"].mean()

# CSVに書き出す
df.to_csv("output.csv", index=False, encoding='utf-8')
```

### JSON処理

```python
import json
from typing import Any


def read_json(file_path: str) -> dict[str, Any]:
    """JSONファイルを読み込む"""
    with open(file_path, encoding='utf-8') as f:
        return json.load(f)


def write_json(file_path: str, data: dict[str, Any], indent: int = 2):
    """JSONファイルに書き込む"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)


# 使用例
data = {
    "users": [
        {"name": "Alice", "age": 25},
        {"name": "Bob", "age": 30},
    ]
}
write_json("data.json", data)

loaded = read_json("data.json")
print(loaded["users"][0]["name"])  # Alice


# JSON Lines（JSONL）処理
def read_jsonl(file_path: str):
    """JSONLを1行ずつ読み込む"""
    with open(file_path, encoding='utf-8') as f:
        for line in f:
            yield json.loads(line.strip())


def write_jsonl(file_path: str, data: list[dict[str, Any]]):
    """JSONLに書き込む"""
    with open(file_path, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
```

### Excel処理

```bash
pip install openpyxl pandas
```

```python
import pandas as pd

# Excelを読み込む
df = pd.read_excel("data.xlsx", sheet_name="Sheet1")

# 全シートを読み込む
dfs = pd.read_excel("data.xlsx", sheet_name=None)
for sheet_name, df in dfs.items():
    print(f"Sheet: {sheet_name}")
    print(df.head())

# Excelに書き出す
df.to_excel("output.xlsx", index=False, sheet_name="Results")

# 複数シートに書き出す
with pd.ExcelWriter("multi_sheet.xlsx") as writer:
    df1.to_excel(writer, sheet_name="Sheet1", index=False)
    df2.to_excel(writer, sheet_name="Sheet2", index=False)
```

**openpyxlで直接操作する**:
```python
from openpyxl import Workbook, load_workbook

# 新しいワークブックを作成
wb = Workbook()
ws = wb.active
ws.title = "Users"

# データを書き込む
ws['A1'] = "Name"
ws['B1'] = "Age"
ws.append(["Alice", 25])
ws.append(["Bob", 30])

wb.save("users.xlsx")

# 既存ファイルを読み込む
wb = load_workbook("users.xlsx")
ws = wb["Users"]

for row in ws.iter_rows(min_row=2, values_only=True):
    name, age = row
    print(f"{name}: {age}")

wb.close()
```

---

## データ分析

### pandasの基礎

```bash
pip install pandas numpy matplotlib
```

**基本操作**:
```python
import pandas as pd
import numpy as np

# DataFrameを作成
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"],
    "age": [25, 30, 35],
    "city": ["Tokyo", "Osaka", "Tokyo"],
    "salary": [50000, 60000, 70000],
})

# データを確認
print(df.head())
print(df.info())
print(df.describe())

# 列を選択
names = df["name"]
subset = df[["name", "age"]]

# 行を選択
first_row = df.iloc[0]
tokyo_users = df[df["city"] == "Tokyo"]
high_salary = df[df["salary"] >= 60000]

# 複数条件
tokyo_adults = df[(df["city"] == "Tokyo") & (df["age"] >= 30)]

# ソート
sorted_df = df.sort_values("age", ascending=False)

# 集計
print(df["age"].mean())
print(df["salary"].sum())
print(df.groupby("city")["salary"].mean())
```

**データクレンジング**:
```python
# 欠損値を処理
df = pd.DataFrame({
    "name": ["Alice", "Bob", None],
    "age": [25, None, 35],
})

# 欠損値を確認
print(df.isnull().sum())

# 欠損値を削除
df_dropped = df.dropna()

# 欠損値を補完
df_filled = df.fillna({"age": df["age"].mean()})

# 重複を削除
df_unique = df.drop_duplicates()

# 型変換
df["age"] = df["age"].astype(int)
```

**データの結合**:
```python
users = pd.DataFrame({
    "user_id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
})

orders = pd.DataFrame({
    "order_id": [101, 102, 103],
    "user_id": [1, 1, 2],
    "amount": [100, 200, 150],
})

# 内部結合
merged = pd.merge(users, orders, on="user_id", how="inner")

# 左外部結合
merged_left = pd.merge(users, orders, on="user_id", how="left")

# 縦方向の結合
df1 = pd.DataFrame({"name": ["Alice"]})
df2 = pd.DataFrame({"name": ["Bob"]})
combined = pd.concat([df1, df2], ignore_index=True)
```

### データの可視化

```python
import matplotlib.pyplot as plt
import pandas as pd

# サンプルデータ
df = pd.DataFrame({
    "month": ["Jan", "Feb", "Mar", "Apr", "May"],
    "sales": [100, 120, 140, 130, 160],
    "costs": [80, 90, 100, 95, 110],
})

# 折れ線グラフ
plt.figure(figsize=(10, 6))
plt.plot(df["month"], df["sales"], marker='o', label='Sales')
plt.plot(df["month"], df["costs"], marker='s', label='Costs')
plt.xlabel("Month")
plt.ylabel("Amount")
plt.title("Sales and Costs")
plt.legend()
plt.grid(True)
plt.savefig("sales_chart.png")
plt.close()

# 棒グラフ
plt.figure(figsize=(8, 6))
df.plot(x="month", y=["sales", "costs"], kind="bar")
plt.savefig("bar_chart.png")
plt.close()

# 散布図
plt.figure(figsize=(8, 6))
plt.scatter(df["sales"], df["costs"])
plt.xlabel("Sales")
plt.ylabel("Costs")
plt.title("Sales vs Costs")
plt.savefig("scatter.png")
plt.close()
```

---

## Webスクレイピング

### requests + BeautifulSoup

```bash
pip install requests beautifulsoup4 lxml
```

```python
import requests
from bs4 import BeautifulSoup


def scrape_articles(url: str) -> list[dict[str, str]]:
    """記事一覧をスクレイピングする"""
    response = requests.get(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; MyBot/1.0)"
    })
    response.raise_for_status()

    soup = BeautifulSoup(response.content, 'lxml')
    articles = []

    for article in soup.select(".article-item"):
        title = article.select_one(".title").get_text(strip=True)
        link = article.select_one("a")["href"]
        date = article.select_one(".date").get_text(strip=True)

        articles.append({
            "title": title,
            "link": link,
            "date": date,
        })

    return articles


# 使用例
articles = scrape_articles("https://example.com/articles")
for article in articles:
    print(f"{article['title']} - {article['date']}")
```

**レート制限**:
```python
import time
import requests


def scrape_multiple_pages(base_url: str, max_pages: int = 10) -> list[dict]:
    """レート制限を設けて複数ページをスクレイピングする"""
    all_articles = []

    for page in range(1, max_pages + 1):
        url = f"{base_url}?page={page}"
        print(f"Scraping page {page}...")

        articles = scrape_articles(url)
        all_articles.extend(articles)

        # レート制限: リクエスト間に1秒待機
        time.sleep(1)

    return all_articles
```

### Seleniumによる動的コンテンツのスクレイピング

```bash
pip install selenium webdriver-manager
```

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


def scrape_dynamic_content(url: str) -> list[dict[str, str]]:
    """JavaScriptでレンダリングされたコンテンツをスクレイピングする"""
    service = Service(ChromeDriverManager().install())
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(service=service, options=options)

    try:
        driver.get(url)

        # 要素が読み込まれるまで待機
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "article-item")))

        articles = []
        elements = driver.find_elements(By.CLASS_NAME, "article-item")

        for element in elements:
            title = element.find_element(By.CLASS_NAME, "title").text
            link = element.find_element(By.TAG_NAME, "a").get_attribute("href")

            articles.append({
                "title": title,
                "link": link,
            })

        return articles

    finally:
        driver.quit()
```

---

## 自動化

### コマンドラインスクリプト

```python
import argparse
import pandas as pd


def main():
    parser = argparse.ArgumentParser(description="CSVデータ処理ツール")
    parser.add_argument("input", type=str, help="入力CSVファイル")
    parser.add_argument("output", type=str, help="出力CSVファイル")
    parser.add_argument("--filter-age", type=int, help="最低年齢でフィルタリング")
    parser.add_argument("--verbose", "-v", action="store_true", help="詳細出力")

    args = parser.parse_args()

    if args.verbose:
        print(f"Input: {args.input}")
        print(f"Output: {args.output}")

    df = pd.read_csv(args.input)

    if args.filter_age:
        df = df[df["age"] >= args.filter_age]

    df.to_csv(args.output, index=False)

    if args.verbose:
        print(f"Processed {len(df)} rows")


if __name__ == "__main__":
    main()
```

**使用例**:
```bash
python process_csv.py input.csv output.csv --filter-age 20 --verbose
```

### タスクスケジューリング

**cron（Linux/macOS）**:
```bash
# crontabを編集
crontab -e

# 毎日午前9時に実行
0 9 * * * /usr/bin/python3 /path/to/script.py

# 毎時実行
0 * * * * /usr/bin/python3 /path/to/script.py

# 毎週月曜日の午前10時に実行
0 10 * * 1 /usr/bin/python3 /path/to/script.py
```

**scheduleライブラリ（Python）**:
```bash
pip install schedule
```

```python
import schedule
import time


def job():
    print("スケジュールされたジョブを実行中...")
    # データ処理


schedule.every().day.at("09:00").do(job)
schedule.every().hour.do(job)
schedule.every().monday.at("10:00").do(job)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### メール送信

```python
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()


def send_email(
    to: str,
    subject: str,
    body: str,
    attachments: list[str] | None = None
):
    """メールを送信する"""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = to
    msg["Subject"] = subject

    msg.attach(MIMEText(body, "plain"))

    if attachments:
        for file_path in attachments:
            with open(file_path, "rb") as f:
                part = MIMEApplication(f.read(), Name=Path(file_path).name)
                part["Content-Disposition"] = f'attachment; filename="{Path(file_path).name}"'
                msg.attach(part)

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)


# 使用例
send_email(
    to="recipient@example.com",
    subject="日次レポート",
    body="日次レポートを添付にてお送りします。",
    attachments=["report.csv", "chart.png"]
)
```

---

## 並列処理

### multiprocessing

```python
from multiprocessing import Pool
import time


def process_item(item: int) -> int:
    """重い計算処理"""
    time.sleep(0.1)
    return item ** 2


def process_sequential(items: list[int]) -> list[int]:
    """逐次処理"""
    return [process_item(item) for item in items]


def process_parallel(items: list[int], num_workers: int = 4) -> list[int]:
    """並列処理"""
    with Pool(processes=num_workers) as pool:
        results = pool.map(process_item, items)
    return results


# ベンチマーク
items = list(range(100))

start = time.time()
results_seq = process_sequential(items)
print(f"逐次処理: {time.time() - start:.2f}s")

start = time.time()
results_par = process_parallel(items, num_workers=4)
print(f"並列処理: {time.time() - start:.2f}s")
```

### concurrent.futures

```python
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import requests


def fetch_url(url: str) -> dict[str, str]:
    """URLを取得する（I/Oバウンド）"""
    response = requests.get(url)
    return {"url": url, "status": response.status_code}


def process_urls_parallel(urls: list[str], max_workers: int = 10) -> list[dict]:
    """複数のURLを並列に取得する"""
    results = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(fetch_url, url): url for url in urls}

        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                result = future.result()
                results.append(result)
            except Exception as exc:
                print(f"{url} で例外が発生しました: {exc}")

    return results


# CPUバウンドなタスクはProcessPoolExecutorを使用
def cpu_bound_task(n: int) -> int:
    return sum(i * i for i in range(n))


def process_cpu_bound(numbers: list[int]) -> list[int]:
    with ProcessPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(cpu_bound_task, numbers))
    return results
```
