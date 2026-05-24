# 非同期プログラミング — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [同期処理と非同期処理](#同期処理と非同期処理)
3. [コールバック](#コールバック)
4. [Promise](#promise)
5. [async/await](#asyncawait)
6. [エラーハンドリング](#エラーハンドリング)
7. [演習](#演習)
8. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- 同期処理と非同期処理の違い
- コールバック関数
- Promise の使い方
- async/await の使い方

### 所要時間：1〜1.5 時間

---

## 同期処理と非同期処理

### 同期処理（ブロッキング）

```javascript
const fs = require('fs')

console.log('Start')

// 同期：ファイル読み込みが完了するまで待機する
const data = fs.readFileSync('file.txt', 'utf8')
console.log(data)

console.log('End')
```

**実行順序**：
```
1. Start
2. （ファイル読み込み中）
3. ファイルの内容
4. End
```

### 非同期処理（ノンブロッキング）

```javascript
const fs = require('fs')

console.log('Start')

// 非同期：待機せずに処理を続ける
fs.readFile('file.txt', 'utf8', (err, data) => {
  console.log(data)
})

console.log('End')
```

**実行順序**：
```
1. Start
2. End
3. ファイルの内容
```

---

## コールバック

### コールバックとは

**コールバック**は、非同期処理が完了した後に実行される関数です。

```javascript
// 基本形
setTimeout(() => {
  console.log('2秒後')
}, 2000)

// コールバックの引数
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err)
    return
  }
  console.log(data)
})
```

### コールバック地獄

```javascript
// ❌ コールバック地獄（避けるべき）
fs.readFile('file1.txt', 'utf8', (err, data1) => {
  if (err) return console.error(err)

  fs.readFile('file2.txt', 'utf8', (err, data2) => {
    if (err) return console.error(err)

    fs.readFile('file3.txt', 'utf8', (err, data3) => {
      if (err) return console.error(err)

      console.log(data1, data2, data3)
    })
  })
})
```

---

## Promise

### Promise とは

**Promise** は、非同期処理の最終的な結果を表すオブジェクトです。

**状態**：
- **Pending（保留中）**：処理の実行中
- **Fulfilled（成功）**：処理が成功した
- **Rejected（失敗）**：処理が失敗した

### 基本的な使い方

```javascript
const readFileAsync = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

readFileAsync('file.txt')
  .then(data => {
    console.log(data)
  })
  .catch(err => {
    console.error(err)
  })
```

### Promise チェーン

```javascript
// ✅ Promise チェーン（読みやすい）
readFileAsync('file1.txt')
  .then(data1 => {
    console.log('ファイル1:', data1)
    return readFileAsync('file2.txt')
  })
  .then(data2 => {
    console.log('ファイル2:', data2)
    return readFileAsync('file3.txt')
  })
  .then(data3 => {
    console.log('ファイル3:', data3)
  })
  .catch(err => {
    console.error(err)
  })
```

### Promise.all（並列実行）

```javascript
const promises = [
  readFileAsync('file1.txt'),
  readFileAsync('file2.txt'),
  readFileAsync('file3.txt')
]

Promise.all(promises)
  .then(([data1, data2, data3]) => {
    console.log(data1, data2, data3)
  })
  .catch(err => {
    console.error(err)
  })
```

---

## async/await

### async/await とは

**async/await** は、Promise をより読みやすく書くための構文です。

### 基本的な使い方

```javascript
async function readFiles() {
  try {
    const data1 = await readFileAsync('file1.txt')
    console.log('ファイル1:', data1)

    const data2 = await readFileAsync('file2.txt')
    console.log('ファイル2:', data2)

    const data3 = await readFileAsync('file3.txt')
    console.log('ファイル3:', data3)
  } catch (err) {
    console.error(err)
  }
}

readFiles()
```

### アロー関数での書き方

```javascript
const readFiles = async () => {
  try {
    const data = await readFileAsync('file.txt')
    console.log(data)
  } catch (err) {
    console.error(err)
  }
}
```

### 並列実行

```javascript
// ❌ 直列処理（遅い）
async function sequential() {
  const data1 = await readFileAsync('file1.txt')  // 1秒
  const data2 = await readFileAsync('file2.txt')  // 1秒
  const data3 = await readFileAsync('file3.txt')  // 1秒
  // 合計：3秒
}

// ✅ 並列処理（速い）
async function parallel() {
  const [data1, data2, data3] = await Promise.all([
    readFileAsync('file1.txt'),
    readFileAsync('file2.txt'),
    readFileAsync('file3.txt')
  ])
  // 合計：1秒
}
```

---

## エラーハンドリング

### try-catch

```javascript
async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('エラー:', error.message)
    throw error
  }
}
```

### 複数の try-catch

```javascript
async function process() {
  let data

  try {
    data = await fetchData()
  } catch (error) {
    console.error('取得失敗:', error)
    return
  }

  try {
    await saveData(data)
  } catch (error) {
    console.error('保存失敗:', error)
  }
}
```

---

## 実践例

### 例1：API リクエスト

```javascript
const fetch = require('node-fetch')

// async/await を使う（推奨）
async function getUser(id) {
  try {
    const response = await fetch(`https://api.example.com/users/${id}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const user = await response.json()
    return user
  } catch (error) {
    console.error('ユーザーの取得に失敗しました:', error)
    throw error
  }
}

getUser(1)
  .then(user => console.log(user))
  .catch(err => console.error(err))
```

### 例2：複数の API 呼び出し

```javascript
async function fetchMultipleUsers() {
  try {
    const [user1, user2, user3] = await Promise.all([
      getUser(1),
      getUser(2),
      getUser(3)
    ])

    console.log('ユーザー:', user1, user2, user3)
  } catch (error) {
    console.error('ユーザーの取得に失敗しました:', error)
  }
}
```

---

## Express での async/await

### ルートハンドラー

```javascript
const express = require('express')
const app = express()

// ❌ エラーがキャッチされない
app.get('/users/:id', async (req, res) => {
  const user = await getUser(req.params.id)
  res.json({ user })
})

// ✅ try-catch で囲む
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await getUser(req.params.id)
    res.json({ user })
  } catch (error) {
    next(error)
  }
})

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})
```

### 非同期ラッパーユーティリティ

```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id)
  res.json({ user })
}))
```

---

## よくある間違い

### await を忘れる

```javascript
// ❌ データではなく Promise オブジェクトが返ってしまう
async function fetchData() {
  const data = fetch('https://api.example.com')
  console.log(data)  // [Promise]
}

// ✅ 正しい書き方
async function fetchData() {
  const data = await fetch('https://api.example.com')
  console.log(data)
}
```

### async 関数の外で await を使う

```javascript
// ❌ エラー：async 関数の外では await を使えない
const data = await fetchData()

// ✅ 正しい書き方
async function main() {
  const data = await fetchData()
}

main()
```

---

## 演習

### 課題：sleep 関数の実装

`sleep` 関数を実装してください。

```javascript
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function example() {
  console.log('Start')
  await sleep(2000)
  console.log('2秒後')
}

example()
```

---

## 次のステップ

### このガイドで学んだこと

- ✅ 同期処理と非同期処理の違い
- ✅ コールバック関数
- ✅ Promise の使い方
- ✅ async/await の使い方

**次のガイド**：[06-first-server-tutorial.md](./06-first-server-tutorial.md) — 最初のサーバーを作る

---

**前のガイド**：[04-express-intro.md](./04-express-intro.md)

**親ガイド**：[Node.js 開発 - SKILL.md](../../SKILL.md)
