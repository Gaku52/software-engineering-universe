# Node.jsとは — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [Node.jsとは](#nodejsとは)
3. [Node.jsが人気の理由](#nodejsが人気の理由)
4. [Node.jsのインストール](#nodejsのインストール)
5. [はじめてのNode.jsプログラム](#はじめてのnodejsプログラム)
6. [REPLを使う](#replを使う)
7. [次のステップ](#次のステップ)

---

## 概要

### この章で学べること

- Node.jsの基本的な考え方
- サーバーサイドでJavaScriptを動かす仕組み
- Node.jsのインストール方法
- はじめてのプログラムを動かす

### 学習時間の目安：30〜40分

---

## Node.jsとは

### 定義

**Node.js**は、JavaScriptをサーバーサイドで実行するための実行環境です。

```
ブラウザ（フロントエンド）
   JavaScript → HTMLを操作する

Node.js（バックエンド）
   JavaScript → サーバー・データベース・ファイルを操作する
```

### 特徴

1. **JavaScriptを使う**
   - フロントエンドと同じ言語
   - 学習コストが低い

2. **非同期I/O**
   - 高速で効率的
   - 大量の同時接続を処理できる

3. **NPMエコシステム**
   - 100万以上のパッケージ
   - 豊富なライブラリが揃っている

---

## Node.jsが人気の理由

### 1. フルスタック開発ができる

```
フロントエンド: JavaScript（React、Vue）
    ↕
バックエンド: JavaScript（Node.js、Express）
    ↕
データベース: JavaScript（MongoDB）
```

**メリット**:
- 1つの言語ですべて開発できる
- コードの再利用が簡単
- チームの効率が上がる

### 2. パフォーマンスが高い

**イベントループ**による非ブロッキングI/O:

```javascript
// 同期処理（遅い）
const data1 = readFileSync('file1.txt')
const data2 = readFileSync('file2.txt')  // file1が終わるまで待つ

// 非同期処理（速い）
readFile('file1.txt', (data1) => {})
readFile('file2.txt', (data2) => {})  // 同時に実行される
```

### 3. 大企業が採用している

- **Netflix**: APIサーバー
- **LinkedIn**: バックエンド
- **Uber**: リアルタイムマッチング
- **PayPal**: 決済システム

---

## Node.jsのインストール

### macOS

```bash
# Homebrewでインストール（推奨）
brew install node

# バージョン確認
node --version  # v20.10.0
npm --version   # 10.2.3
```

### Windows

```bash
# 公式サイトからインストーラーをダウンロード
# https://nodejs.org/

# インストール後に確認
node --version
npm --version
```

### Linux（Ubuntu）

```bash
# NodeSourceでインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 確認
node --version
npm --version
```

### バージョン管理（推奨）

```bash
# nvmでNode.jsのバージョンを管理する
# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Node.js 20をインストール
nvm install 20
nvm use 20
```

---

## はじめてのNode.jsプログラム

### 1. プロジェクトディレクトリを作成

```bash
mkdir hello-node
cd hello-node
```

### 2. JavaScriptファイルを作成

`index.js`を作成:

```javascript
// index.js
console.log('Hello, Node.js!')

// 計算
const sum = (a, b) => a + b
console.log('2 + 3 =', sum(2, 3))

// 現在時刻
const now = new Date()
console.log('現在時刻:', now.toLocaleString())
```

### 3. 実行する

```bash
node index.js
```

**出力**:
```
Hello, Node.js!
2 + 3 = 5
現在時刻: 2024/12/24 10:30:00
```

---

## REPLを使う

### REPLとは

**REPL（Read-Eval-Print Loop）**は、コードをその場で実行できる対話型の環境です。

```bash
# REPLを起動
node

# プロンプトが表示される
>
```

### 使用例

```javascript
> 2 + 3
5

> const name = 'Alice'
undefined

> console.log(`Hello, ${name}!`)
Hello, Alice!
undefined

> [1, 2, 3].map(x => x * 2)
[ 2, 4, 6 ]

> .exit  // 終了
```

---

## Node.jsでできること

### 1. Webサーバー

```javascript
const http = require('http')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello, World!')
})

server.listen(3000, () => {
  console.log('サーバーが起動しました: http://localhost:3000/')
})
```

### 2. ファイル操作

```javascript
const fs = require('fs')

// ファイルを読む
fs.readFile('data.txt', 'utf8', (err, data) => {
  if (err) throw err
  console.log(data)
})

// ファイルに書く
fs.writeFile('output.txt', 'Hello, Node.js!', (err) => {
  if (err) throw err
  console.log('ファイルを保存しました')
})
```

### 3. API開発

```javascript
const express = require('express')
const app = express()

app.get('/api/users', (req, res) => {
  res.json({ users: ['Alice', 'Bob'] })
})

app.listen(3000)
```

---

## よくある質問

### Q1: JavaScriptを知らないと使えない？

**A**: はい、基本的なJavaScriptの知識が必要です。

**学習順序**:
1. JavaScriptの基礎（変数・関数・配列）
2. ES6+の機能（アロー関数・async/await）
3. Node.js

### Q2: ブラウザのJavaScriptとNode.jsの違いは？

| 項目 | ブラウザ | Node.js |
|------|---------|---------|
| **DOM操作** | ✅ 使える | ❌ 使えない |
| **ファイルI/O** | ❌ 使えない | ✅ 使える |
| **モジュール** | ES Modules | CommonJS/ES Modules |
| **グローバルオブジェクト** | window | global |

### Q3: どんなプロジェクトに向いている？

**向いているもの**:
- REST API
- リアルタイムアプリ（チャット・ゲーム）
- マイクロサービス
- CLIツール

**向いていないもの**:
- CPU負荷の高い処理（動画エンコードなど）
- 大規模な数値計算

---

## 次のステップ

### このガイドで学んだこと

- ✅ Node.jsの基本的な考え方
- ✅ インストール方法
- ✅ はじめてのプログラムを動かす
- ✅ REPLの使い方

### 次に読むガイド

**次のガイド**: [02-javascript-basics.md](./02-javascript-basics.md) - JavaScriptの基礎

---

**親ガイド**: [Node.js開発 - SKILL.md](../../SKILL.md)
