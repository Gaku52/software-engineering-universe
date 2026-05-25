# Node.js における Callbacks

callback は Node.js における非同期プログラミングの基盤です。Promise や async/await に進む前に、まずこれを理解することが重要です。

---

## 目次

1. [callback とは](#1-callback-とは)
2. [基本的な callback パターン](#2-基本的な-callback-パターン)
3. [Callback Hell](#3-callback-hell)
4. [Callback Hell の問題点](#4-callback-hell-の問題点)
5. [アンチパターン](#5-アンチパターン)
6. [FAQ](#6-faq)

---

## 1. callback とは

**callback** とは、別の関数に引数として渡される関数のことで、処理が完了したタイミングで呼び出されます。Node.js では、callback が非同期 I/O 処理を扱う主要な仕組みです。

```js
// callback の基本的な概念
function greet(name, callback) {
  const message = `Hello, ${name}!`;
  callback(message);
}

greet("Alice", (msg) => {
  console.log(msg); // Hello, Alice!
});
```

Node.js は **error-first callback 規約**（「Node スタイルの callback」または「errback」とも呼ばれる）を採用しています。第1引数は常にエラーオブジェクト（エラーがなければ `null`）、第2引数が結果値です。

```js
// error-first callback 規約
function readData(id, callback) {
  if (id <= 0) {
    return callback(new Error("ID must be positive"));
  }
  // 非同期処理のシミュレーション
  setTimeout(() => {
    callback(null, { id, value: "data" });
  }, 100);
}

readData(1, (err, data) => {
  if (err) {
    console.error("Error:", err.message);
    return;
  }
  console.log("Data:", data);
});
```

**なぜ error-first なのか？**
- すべての非同期 API でエラーハンドリングを一貫させるため
- Node.js のコアモジュール（`fs`、`net`、`http`）がすべてこの規約に従っている
- 呼び出し側がエラーを必ず処理しなければならないことを明示するため

---

## 2. 基本的な callback パターン

### 2.1 ファイルシステム操作

Node.js における最もよくある callback の実用例は `fs` モジュールの操作です。

```js
const fs = require("fs");

// ファイルを非同期で読み込む
fs.readFile("./data.txt", "utf8", (err, content) => {
  if (err) {
    console.error("Failed to read file:", err.message);
    return;
  }
  console.log("File content:", content);
});

console.log("This runs before file content is logged");
```

```
出力:
  This runs before file content is logged
  File content: (ファイルの内容)
```

### 2.2 ファイルへの書き込み

```js
const fs = require("fs");

const data = JSON.stringify({ name: "Alice", age: 30 }, null, 2);

fs.writeFile("./output.json", data, "utf8", (err) => {
  if (err) {
    console.error("Write failed:", err.message);
    return;
  }
  console.log("File written successfully");
});
```

### 2.3 callback を使った HTTP リクエスト

```js
const https = require("https");

function fetchData(url, callback) {
  https
    .get(url, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          callback(null, parsed);
        } catch (parseErr) {
          callback(parseErr);
        }
      });
    })
    .on("error", (err) => {
      callback(err);
    });
}

fetchData("https://jsonplaceholder.typicode.com/todos/1", (err, data) => {
  if (err) {
    console.error("Fetch error:", err.message);
    return;
  }
  console.log("Fetched:", data);
});
```

### 2.4 データベースクエリのシミュレーション

```js
// 非同期データベースクエリのシミュレーション
function queryUser(userId, callback) {
  // ネットワーク遅延をシミュレーション
  setTimeout(() => {
    const users = {
      1: { id: 1, name: "Alice", role: "admin" },
      2: { id: 2, name: "Bob", role: "user" },
    };

    const user = users[userId];
    if (!user) {
      return callback(new Error(`User ${userId} not found`));
    }
    callback(null, user);
  }, 50);
}

queryUser(1, (err, user) => {
  if (err) {
    console.error(err.message);
    return;
  }
  console.log("Found user:", user.name); // Found user: Alice
});
```

---

## 3. Callback Hell

**Callback hell**（「ピラミッド・オブ・ドゥーム」とも呼ばれる）は、複数の非同期処理が互いに依存しており、それぞれ前の callback の中にネストしなければならない状況で発生します。

### 3.1 実際のシナリオ

設定ファイルの読み込み → データベースへのクエリ → API からの追加データ取得 → 統合結果のファイル書き込み、というワークフローを想像してみてください。

```js
const fs = require("fs");

fs.readFile("./config.json", "utf8", (err, configData) => {
  if (err) {
    console.error("Config read error:", err.message);
    return;
  }

  const config = JSON.parse(configData);

  queryUser(config.userId, (err, user) => {
    if (err) {
      console.error("User query error:", err.message);
      return;
    }

    fetchUserPosts(user.id, (err, posts) => {
      if (err) {
        console.error("Posts fetch error:", err.message);
        return;
      }

      const report = JSON.stringify({ user, posts }, null, 2);

      fs.writeFile("./report.json", report, "utf8", (err) => {
        if (err) {
          console.error("Write error:", err.message);
          return;
        }

        console.log("Report written successfully");

        notifyAdmin(user.name, (err) => {
          if (err) {
            console.error("Notification error:", err.message);
            return;
          }
          console.log("Admin notified");
        });
      });
    });
  });
});
```

インデントが問題を視覚的に示しています：

```
readFile(
  queryUser(
    fetchUserPosts(
      writeFile(
        notifyAdmin(
          // callback hell
        )
      )
    )
  )
)
```

---

## 4. Callback Hell の問題点

### 4.1 可読性

コードが縦ではなく横に伸びていきます。深いネストのせいで、処理の流れをひと目で追うことが難しくなります。

### 4.2 エラーハンドリングの重複

ネストされた callback はそれぞれ自分のエラーを処理しなければならず、`if (err) { return; }` のブロックがコード全体に散らばります。

```js
// エラー処理がすべてのレベルで繰り返される
step1((err, result1) => {
  if (err) return handleError(err); // 繰り返し
  step2(result1, (err, result2) => {
    if (err) return handleError(err); // 繰り返し
    step3(result2, (err, result3) => {
      if (err) return handleError(err); // 繰り返し
      // ...
    });
  });
});
```

### 4.3 リファクタリングの困難さ

途中に新しいステップを追加するには、ネスト構造全体を作り直す必要があります。

### 4.4 戻り値が使えない

callback では `return` を使ってコールスタックの上位に値を返すことができません。すべてのデータは callback の引数を通じて受け渡さなければなりません。

### 4.5 緩和策：名前付き関数

視覚的なネストを減らす方法の1つは、callback を名前付き関数として切り出すことです：

```js
const fs = require("fs");

function onAdminNotified(err) {
  if (err) {
    console.error("Notification error:", err.message);
    return;
  }
  console.log("Admin notified");
}

function onReportWritten(err, user) {
  // 注意: user はクロージャで参照するか、別の方法で渡す必要がある
  if (err) {
    console.error("Write error:", err.message);
    return;
  }
  notifyAdmin(user.name, onAdminNotified);
}

// このアプローチはインデントを改善するが、逐次依存の問題は残る
```

名前付き関数はネストを視覚的に減らしますが、エラー伝播やコンポーザビリティの本質的な問題は解決しません。

---

## 5. アンチパターン

### 5.1 callback の後に return を忘れる

```js
// 悪い例: return がないと callback が2回呼ばれる
function badFunction(input, callback) {
  if (!input) {
    callback(new Error("No input")); // 実行が続いてしまう！
  }
  callback(null, processInput(input)); // 再度呼び出される → バグ
}

// 良い例: エラー時は必ず return してから callback を呼ぶ
function goodFunction(input, callback) {
  if (!input) {
    return callback(new Error("No input")); // ここで止まる
  }
  callback(null, processInput(input));
}
```

### 5.2 エラーを callback で渡さずに throw する

```js
// 悪い例: 非同期の callback 内で throw するとプロセスがクラッシュする
fs.readFile("file.txt", "utf8", (err, data) => {
  if (err) throw err; // 非同期コンテキストでの未処理例外
});

// 良い例: callback を通じてエラーを渡す
function readAndProcess(path, callback) {
  fs.readFile(path, "utf8", (err, data) => {
    if (err) return callback(err);
    callback(null, data.toUpperCase());
  });
}
```

### 5.3 非同期ラッパー内での同期処理

```js
// 悪い例: 非同期であるべき関数内で同期の fs を使う
function getConfig(callback) {
  try {
    const data = fs.readFileSync("config.json"); // Event Loop をブロックする
    callback(null, JSON.parse(data));
  } catch (err) {
    callback(err);
  }
}

// 良い例: 非同期バージョンを使う
function getConfig(callback) {
  fs.readFile("config.json", "utf8", (err, data) => {
    if (err) return callback(err);
    try {
      callback(null, JSON.parse(data));
    } catch (parseErr) {
      callback(parseErr);
    }
  });
}
```

### 5.4 同期と非同期の戻り値が混在する

```js
// 悪い例: 同期になったり非同期になったりする — 予測不能な動作
function getData(useCache, callback) {
  if (useCache) {
    callback(null, cachedData); // 同期呼び出し — 現在のティックが終わる前に実行される
  } else {
    fetchFromDB(callback); // 非同期呼び出し
  }
}

// 良い例: process.nextTick を使って常に非同期にする
function getData(useCache, callback) {
  if (useCache) {
    return process.nextTick(() => callback(null, cachedData));
  }
  fetchFromDB(callback);
}
```

---

## 6. FAQ

**Q: error-first callback 規約は必須ですか？**

A: 言語仕様として強制されているわけではありませんが、Node.js エコシステムにおけるデファクトスタンダードです。この規約を破ると、`util.promisify` などのユーティリティとの連携が難しくなります。

---

**Q: `util.promisify` を使って callback ベースの関数を Promise に変換できますか？**

A: できます。ただし、その関数が error-first callback 規約に従っている必要があります。

```js
const fs = require("fs");
const { promisify } = require("util");

const readFile = promisify(fs.readFile);

readFile("./data.txt", "utf8")
  .then((content) => console.log(content))
  .catch((err) => console.error(err));
```

---

**Q: async/await を常に使うなら、callback を学ぶ必要はありますか？**

A: あります。Node.js のコアモジュールや多くのサードパーティライブラリは依然として callback ベースの API を提供しています。callback を理解することで、async/await がどのようにコンパイルされるかを把握でき、Event Loop に関する問題のデバッグにも役立ちます。

---

**Q: `process.nextTick` とは何ですか？いつ使うべきですか？**

A: `process.nextTick` は、現在の処理の終わりに、Event Loop が次のフェーズに進む前に callback をスケジュールします。結果が同期的に得られる場合でも callback を常に非同期で実行したいときに使います。

```js
function alwaysAsync(value, callback) {
  process.nextTick(() => callback(null, value));
}
```

---

**Q: リファクタリングの目安として、何段階のネストまでが許容範囲ですか？**

A: 一般的なガイドラインとして、callback のネストが2〜3段階を超えたらリファクタリングのサインです。非同期ステップが2つ以上続くワークフローには Promise または async/await を使いましょう。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
