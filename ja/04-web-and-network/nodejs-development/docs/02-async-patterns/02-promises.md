# Node.js における Promises

Promise は、callback に比べてより簡潔で組み合わせやすい非同期処理の手段です。ES2015 で標準化され、現在のすべての Node.js バージョンでネイティブにサポートされています。

---

## 目次

1. [Promise とは](#1-promise-とは)
2. [Promise の3つの状態](#2-promise-の3つの状態)
3. [`.then()` と `.catch()` のチェーン](#3-then-と-catch-のチェーン)
4. [`Promise.all()` / `Promise.race()` / `Promise.allSettled()`](#4-promiseall--promiserace--promiseallsettled)
5. [エラーハンドリング](#5-エラーハンドリング)
6. [アンチパターン](#6-アンチパターン)
7. [FAQ](#7-faq)

---

## 1. Promise とは

**Promise** は、非同期処理の最終的な完了または失敗を表すオブジェクトです。callback ベースのコードが抱える2つの核心的な問題を解決します：

- **Callback hell** — 連続する非同期ステップをネストではなく `.then()` でチェーンできる
- **一貫性のないエラーハンドリング** — チェーンの末尾に `.catch()` を1つ置くだけですべてのエラーを処理できる

```js
// callback スタイル
readFile("config.json", (err, data) => {
  if (err) return handleError(err);
  processData(data, (err, result) => {
    if (err) return handleError(err);
    saveResult(result, (err) => {
      if (err) return handleError(err);
      console.log("Done");
    });
  });
});

// Promise スタイル — 同じロジックを線形に記述
readFile("config.json")
  .then((data) => processData(data))
  .then((result) => saveResult(result))
  .then(() => console.log("Done"))
  .catch((err) => handleError(err));
```

### Promise の生成

`new Promise(executor)` を使います。executor は `resolve` と `reject` の2つの関数を受け取ります。

```js
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fetchUser(id) {
  return new Promise((resolve, reject) => {
    if (id <= 0) {
      return reject(new Error("Invalid ID"));
    }
    setTimeout(() => {
      resolve({ id, name: "Alice" });
    }, 100);
  });
}

fetchUser(1).then((user) => console.log(user.name)); // Alice
```

### `util.promisify` による callback の Promise 化

Node.js には、error-first callback 関数を Promise を返す関数に変換するビルトインユーティリティが用意されています。

```js
const fs = require("fs");
const { promisify } = require("util");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

readFile("./data.txt", "utf8")
  .then((content) => {
    console.log(content);
    return writeFile("./copy.txt", content, "utf8");
  })
  .then(() => console.log("Copy written"))
  .catch((err) => console.error(err));
```

---

## 2. Promise の3つの状態

Promise は常に、互いに排他的な3つの状態のいずれかにあります：

```
            ┌─────────────────────────────┐
            │         PENDING             │
            │  (初期状態 — 待機中)         │
            └──────────┬──────────────────┘
                       │
          ┌────────────┴────────────┐
          │ resolve(value)          │ reject(reason)
          ▼                         ▼
  ┌──────────────┐         ┌──────────────────┐
  │  FULFILLED   │         │    REJECTED       │
  │ (成功)       │         │ (失敗)            │
  └──────────────┘         └──────────────────┘
```

- **Pending（保留中）**: 非同期処理がまだ完了していない
- **Fulfilled（成功）**: 処理が正常に完了し、`resolve(value)` が呼ばれた
- **Rejected（失敗）**: 処理が失敗し、`reject(reason)` が呼ばれた

Promise が一度 settled（pending から fulfilled または rejected に遷移）すると、その状態は**変更不可**になります。`resolve` や `reject` を2回目に呼び出しても無効です。

```js
const p = new Promise((resolve, reject) => {
  resolve("first");
  resolve("second"); // 無視される — すでに settled 状態
  reject(new Error("too late")); // これも無視される
});

p.then((val) => console.log(val)); // "first"
```

---

## 3. `.then()` と `.catch()` のチェーン

### `.then(onFulfilled, onRejected)`

`.then()` は成功時と失敗時の2つの callback を受け取ります。

```js
fetchUser(1)
  .then(
    (user) => console.log("Success:", user.name),
    (err) => console.error("Error:", err.message)
  );
```

実際には、成功とエラーのハンドラを `.then()` と `.catch()` に分けて書く方がわかりやすいです：

```js
fetchUser(1)
  .then((user) => console.log("Success:", user.name))
  .catch((err) => console.error("Error:", err.message));
```

### `.then()` のチェーン

`.then()` はそれぞれ**新しい Promise** を返すため、連続する非同期ステップを線形にチェーンできます。

```js
const { promisify } = require("util");
const fs = require("fs");
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

readFile("./input.txt", "utf8")
  .then((content) => {
    const transformed = content.toUpperCase();
    return writeFile("./output.txt", transformed, "utf8");
  })
  .then(() => {
    console.log("Transformation complete");
    return readFile("./output.txt", "utf8");
  })
  .then((result) => {
    console.log("Verified output:", result.slice(0, 50));
  })
  .catch((err) => {
    console.error("Pipeline failed:", err.message);
  });
```

### チェーンを通じた値の受け渡し

`.then()` の callback が返した値は、次の `.then()` の解決値になります。

```js
Promise.resolve(1)
  .then((n) => n + 1)   // 2 を返す
  .then((n) => n * 3)   // 6 を返す
  .then((n) => console.log(n)); // 6
```

### `.finally()`

`.finally()` は成功・失敗にかかわらず実行されます。クリーンアップ処理に便利です。

```js
let connection;

openConnection()
  .then((conn) => {
    connection = conn;
    return conn.query("SELECT * FROM users");
  })
  .then((rows) => console.log(rows))
  .catch((err) => console.error(err))
  .finally(() => {
    if (connection) connection.close();
  });
```

---

## 4. `Promise.all()` / `Promise.race()` / `Promise.allSettled()`

### `Promise.all(iterable)`

複数の Promise を**並行して**実行し、**すべて**が fulfilled になったときに解決します。**いずれか1つ**が reject されると即座に reject されます。

```js
const fetchPost = (id) =>
  fetch(`https://jsonplaceholder.typicode.com/posts/${id}`).then((r) =>
    r.json()
  );

Promise.all([fetchPost(1), fetchPost(2), fetchPost(3)])
  .then(([post1, post2, post3]) => {
    console.log(post1.title);
    console.log(post2.title);
    console.log(post3.title);
  })
  .catch((err) => {
    // いずれかのリクエストが失敗すると実行される
    console.error("One or more requests failed:", err.message);
  });
```

```
処理時間の比較:
  逐次実行: [---1---][---2---][---3---]  約300ms
  並行実行: [---1---]
            [---2---]                    約100ms（同時に実行）
            [---3---]
```

### `Promise.race(iterable)`

**最初に**settled になった Promise の結果（成功または失敗）で解決または reject し、残りは無視します。

```js
function timeout(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
}

function fetchWithTimeout(url, ms) {
  return Promise.race([fetch(url).then((r) => r.json()), timeout(ms)]);
}

fetchWithTimeout("https://api.example.com/data", 3000)
  .then((data) => console.log(data))
  .catch((err) => console.error(err.message));
```

### `Promise.allSettled(iterable)`

**すべての** Promise が settled（fulfilled または rejected）になるまで待ち、結果オブジェクトの配列を返します。決して reject されません。

```js
const requests = [
  fetch("https://api.example.com/users").then((r) => r.json()),
  fetch("https://api.example.com/posts").then((r) => r.json()),
  fetch("https://api.invalid.com/data").then((r) => r.json()), // 失敗する
];

Promise.allSettled(requests).then((results) => {
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`Request ${index + 1} succeeded:`, result.value);
    } else {
      console.log(`Request ${index + 1} failed:`, result.reason.message);
    }
  });
});
```

### `Promise.any(iterable)`（ES2021）

**最初に fulfilled** になった Promise で解決します。**すべての** Promise が reject された場合のみ reject されます。

```js
// 複数のミラーを試し、最初に応答したものを使う
Promise.any([
  fetch("https://mirror1.example.com/file"),
  fetch("https://mirror2.example.com/file"),
  fetch("https://mirror3.example.com/file"),
])
  .then((response) => response.blob())
  .then((blob) => console.log("Downloaded from fastest mirror"))
  .catch((err) => console.error("All mirrors failed"));
```

### 比較表

| メソッド              | 解決するとき           | reject されるとき     |
|---------------------|-----------------------|----------------------|
| `Promise.all`       | すべて fulfilled       | いずれか1つが reject  |
| `Promise.race`      | 最初が settled         | 最初が settled（失敗）|
| `Promise.allSettled`| すべてが settled       | しない               |
| `Promise.any`       | 最初が fulfilled       | すべてが reject      |

---

## 5. エラーハンドリング

### チェーン全体に対する単一の `.catch()`

```js
readConfig()
  .then((config) => validateConfig(config))
  .then((config) => connectDB(config.dbUrl))
  .then((db) => db.query("SELECT 1"))
  .then((result) => console.log("DB OK:", result))
  .catch((err) => {
    // 上記のどのステップのエラーもここでキャッチされる
    console.error("Pipeline error:", err.message);
  });
```

### チェーン途中でのエラー回復

チェーンの途中に `.catch()` を置いてエラーを処理し、フォールバック値を返すことでチェーンを継続させることができます。

```js
fetchUserFromAPI(userId)
  .catch((err) => {
    console.warn("API unavailable, falling back to cache:", err.message);
    return fetchUserFromCache(userId); // 回復 — チェーンが続く
  })
  .then((user) => {
    console.log("Got user:", user.name);
  })
  .catch((err) => {
    console.error("Both API and cache failed:", err.message);
  });
```

### エラーの再スロー

```js
fetchData()
  .catch((err) => {
    if (err.code === "ENOENT") {
      return defaultData; // 処理してリカバリー
    }
    throw err; // 不明なエラーは再スロー
  })
  .then((data) => process(data))
  .catch((err) => console.error("Unhandled:", err.message));
```

### 未処理の Promise rejection

`.catch()` が付いていない reject された Promise があると、Node.js は `unhandledRejection` イベントを発行します。最近の Node.js バージョン（v15以降）ではプロセスがクラッシュします。

```js
// 必ず .catch() を付けるか、async/await と try/catch を使う
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});
```

---

## 6. アンチパターン

### 6.1 Promise コンストラクタのアンチパターン（Deferred）

```js
// 悪い例: 既存の Promise を新しい Promise でラップしている
function getUser(id) {
  return new Promise((resolve, reject) => {
    fetchUser(id) // fetchUser はすでに Promise を返している
      .then((user) => resolve(user))
      .catch((err) => reject(err));
  });
}

// 良い例: Promise を直接返す
function getUser(id) {
  return fetchUser(id);
}
```

### 6.2 `.then()` 内で Promise を return し忘れる

```js
// 悪い例: チェーンが saveUser の完了を待たない
fetchUser(1)
  .then((user) => {
    saveUser(user); // return がない — fire and forget
  })
  .then(() => console.log("Saved")); // saveUser が終わる前に実行される

// 良い例: 内側の Promise を return する
fetchUser(1)
  .then((user) => {
    return saveUser(user); // チェーンがこれを待つ
  })
  .then(() => console.log("Saved"));
```

### 6.3 空の `.catch()` でエラーを握りつぶす

```js
// 悪い例: エラーが黙って無視される
doSomething()
  .catch(() => {}); // ブラックホール — エラーが消える

// 良い例: 最低限ログに出力する
doSomething()
  .catch((err) => console.error("doSomething failed:", err));
```

### 6.4 callback と Promise を混在させる

```js
// 悪い例: 予測不能 — callback が実行された後に .then() も実行される
function mixedBad(callback) {
  return fetchData().then((data) => {
    callback(null, data);
    return data; // .then() も実行される
  });
}

// 良い例: どちらか一方のスタイルに統一する
function promiseBased() {
  return fetchData();
}
```

---

## 7. FAQ

**Q: `.then(null, onRejected)` と `.catch(onRejected)` の違いは何ですか？**

A: 機能的には同等です。`.catch(fn)` は `.then(undefined, fn)` の糖衣構文です。わかりやすさのために `.catch()` を使うことを推奨します。

---

**Q: Promise でない値を `await` できますか？**

A: できます。`await someValue` は Promise でない値を `Promise.resolve()` でラップするため、即座に解決されます。便利な場合もありますが、あまり必要になることはありません。

---

**Q: `Promise.all` はリクエストを並行して実行しますか？**

A: `Promise.all` に渡される Promise はすでに実行中です（生成された時点で開始されます）。`Promise.all` はすべてが settled になるのを待つだけです。並行性は `Promise.all` ではなく、Promise を生成するタイミングによって決まります。

---

**Q: Promise をキャンセルするにはどうすればいいですか？**

A: ネイティブの Promise はキャンセルできません。一般的な回避策として、`AbortController`（`fetch` や一部の Node.js API で利用可能）や、タイムアウト Promise を使った `Promise.race` があります。

```js
const controller = new AbortController();

fetch("https://api.example.com/data", { signal: controller.signal })
  .then((r) => r.json())
  .then(console.log)
  .catch((err) => {
    if (err.name === "AbortError") {
      console.log("Request cancelled");
    }
  });

// 2秒後にキャンセル
setTimeout(() => controller.abort(), 2000);
```

---

**Q: `Promise.allSettled` と `Promise.all` はどう使い分けますか？**

A: 個別の失敗にかかわらずすべての処理結果を扱う必要がある場合（例：部分的な成功が許容されるバッチ API 呼び出し）は `Promise.allSettled` を使います。すべての処理が成功しなければワークフローを続けられない場合は `Promise.all` を使います。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
