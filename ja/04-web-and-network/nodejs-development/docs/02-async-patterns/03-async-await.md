# Node.js における async/await

`async/await` は Promise の上に構築された糖衣構文であり、非同期コードを同期的なスタイルで書けるようにします。ES2017（Node.js 7.6以降）で導入され、現在は非同期 Node.js コードの主流パターンとなっています。

---

## 目次

1. [async/await とは](#1-asyncawait-とは)
2. [基本的な `async` 関数](#2-基本的な-async-関数)
3. [`await` の仕組み](#3-await-の仕組み)
4. [try/catch によるエラーハンドリング](#4-trycatch-によるエラーハンドリング)
5. [`Promise.all` による並行実行](#5-promiseall-による並行実行)
6. [よくある間違い](#6-よくある間違い)
7. [FAQ](#7-faq)

---

## 1. async/await とは

`async/await` は新たな非同期機能を導入するものではなく、Promise の上に置かれた層です。すべての `async` 関数は Promise を返し、`await` は待機中の Promise が settled になるまでその関数の実行を一時停止します。

**同じロジックを3つのスタイルで書く：**

```js
// 1. callback スタイル
readFile("config.json", "utf8", (err, data) => {
  if (err) return console.error(err);
  const cfg = JSON.parse(data);
  connectDB(cfg.dbUrl, (err, db) => {
    if (err) return console.error(err);
    console.log("Connected");
  });
});

// 2. Promise チェーンスタイル
readFile("config.json", "utf8")
  .then((data) => JSON.parse(data))
  .then((cfg) => connectDB(cfg.dbUrl))
  .then(() => console.log("Connected"))
  .catch(console.error);

// 3. async/await スタイル
async function init() {
  const data = await readFile("config.json", "utf8");
  const cfg = JSON.parse(data);
  await connectDB(cfg.dbUrl);
  console.log("Connected");
}

init().catch(console.error);
```

3つはすべて同じ動作をします。async/await バージョンはノンブロッキングでありながら、同期コードのように読めます。

---

## 2. 基本的な `async` 関数

### async 関数の宣言

`async` キーワードは任意の関数宣言や関数式の前に付けられます。

```js
// 関数宣言
async function fetchUser(id) {
  return { id, name: "Alice" };
}

// 関数式
const fetchPost = async function (id) {
  return { id, title: "Hello" };
};

// アロー関数
const fetchComment = async (id) => {
  return { id, body: "Great post!" };
};

// クラスメソッド
class UserService {
  async getUser(id) {
    return { id, name: "Bob" };
  }
}
```

### 戻り値

`async` 関数は、プレーンな値を返した場合でも**常に Promise を返します**。

```js
async function add(a, b) {
  return a + b; // Promise.resolve(a + b) と同等
}

add(2, 3).then(console.log); // 5
```

### 実践例：ファイル操作

```js
const fs = require("fs/promises"); // Node.js 14以降のビルトイン Promise API

async function processConfig(path) {
  const raw = await fs.readFile(path, "utf8");
  const config = JSON.parse(raw);

  config.processedAt = new Date().toISOString();

  const output = JSON.stringify(config, null, 2);
  await fs.writeFile(path.replace(".json", ".out.json"), output, "utf8");

  return config;
}

processConfig("./config.json")
  .then((cfg) => console.log("Processed:", cfg.processedAt))
  .catch((err) => console.error("Failed:", err.message));
```

---

## 3. `await` の仕組み

### 実行の一時停止

`await` はその時点で `async` 関数の実行を一時停止し、Event Loop に制御を返します。待機していた Promise が settled になると実行が再開されます。

```js
async function demo() {
  console.log("1 - before await");

  const result = await new Promise((resolve) => {
    setTimeout(() => resolve("done"), 1000);
  });

  console.log("3 - after await:", result); // 約1秒後に実行される
}

demo();
console.log("2 - this runs while demo() is awaiting");
```

```
出力:
  1 - before await
  2 - this runs while demo() is awaiting
  3 - after await: done
```

### Promise でない値への `await`

`await` は Promise でない値を `Promise.resolve()` でラップします。つまり `await 42` は有効であり、`42` を即座に返します。

```js
async function test() {
  const x = await 42;       // 即座に解決される
  const y = await "hello";  // これも有効
  console.log(x, y);        // 42 hello
}
```

### `await` は `async` 内でのみ使用可能

CommonJS モジュールのトップレベルで `await` を使うと構文エラーになります。async IIFE を使うか、ES モジュールに切り替えてください（Node.js 14.8以降ではトップレベル `await` がサポートされています）。

```js
// CommonJS — async 関数でラップする
(async () => {
  const data = await fetchData();
  console.log(data);
})();

// ES モジュール（.mjs または package.json で "type": "module"） — トップレベル await が使える
const data = await fetchData();
console.log(data);
```

### 内部の仕組み

`async/await` は Promise 上のジェネレータベースのコルーチンスケジューリングに脱糖されます。以下の2つのコードは同等です：

```js
// async/await
async function getUser(id) {
  const user = await fetchUser(id);
  return user.name;
}

// 同等の Promise チェーン
function getUser(id) {
  return fetchUser(id).then((user) => user.name);
}
```

---

## 4. try/catch によるエラーハンドリング

### 基本的な try/catch

`await` 式を try/catch で囲むことで、reject された Promise を処理できます。

```js
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    console.log("User:", user.name);
    return user;
  } catch (err) {
    console.error("Failed to load user:", err.message);
    return null;
  }
}
```

### 複数ステップのエラーハンドリング

1つの try ブロックで複数の await 処理をカバーできます。

```js
const fs = require("fs/promises");

async function buildReport(userId) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchPosts(userId);
    const report = { user, posts, generatedAt: new Date() };
    await fs.writeFile("./report.json", JSON.stringify(report, null, 2));
    console.log("Report saved");
    return report;
  } catch (err) {
    console.error("Report generation failed:", err.message);
    throw err; // 呼び出し元に失敗を伝えるために再スロー
  }
}
```

### きめ細かいエラーハンドリング

エラーの種類によって異なる処理が必要な場合は、try/catch ブロックを分けます。

```js
async function syncData(userId) {
  let user;

  try {
    user = await fetchUser(userId);
  } catch (err) {
    console.error("Could not fetch user:", err.message);
    return; // 早期終了
  }

  try {
    await syncToRemote(user);
    console.log("Sync complete");
  } catch (err) {
    // 同期の失敗は致命的でない — ログに記録して続行
    console.warn("Sync failed, will retry later:", err.message);
    await scheduleRetry(userId);
  }
}
```

### ヘルパー：`to` パターン（任意）

チームによっては、ネストした try/catch を避けるため、reject された Promise を `[err, null]` / `[null, data]` に変換するヘルパーを使うことがあります。

```js
async function to(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (err) {
    return [err, null];
  }
}

async function getUser(id) {
  const [err, user] = await to(fetchUser(id));
  if (err) {
    console.error("Fetch failed:", err.message);
    return null;
  }
  return user;
}
```

---

## 5. `Promise.all` による並行実行

### 逐次実行の落とし穴

並行して実行できる処理を1つずつ await してしまうのはよくある間違いです。

```js
// 遅い: 合計300ms（100 + 100 + 100）
async function slowFetch() {
  const user = await fetchUser(1);    // 100ms 待つ
  const posts = await fetchPosts(1);  // さらに100ms 待つ
  const tags = await fetchTags(1);    // さらに100ms 待つ
  return { user, posts, tags };
}
```

### `Promise.all` による並行実行

```js
// 速い: 約100ms（すべて同時に実行）
async function fastFetch() {
  const [user, posts, tags] = await Promise.all([
    fetchUser(1),
    fetchPosts(1),
    fetchTags(1),
  ]);
  return { user, posts, tags };
}
```

```
逐次実行: [fetchUser][fetchPosts][fetchTags]   約300ms
並行実行: [fetchUser ]
          [fetchPosts]                          約100ms
          [fetchTags ]
```

### 逐次処理と並行処理の組み合わせ

独立したステップは並行して、前の結果に依存するステップは逐次的に実行します。

```js
async function loadDashboard(userId) {
  // Step 1: まずユーザーを取得（次のステップで必要）
  const user = await fetchUser(userId);

  // Step 2: 投稿と設定を並行取得（どちらも userId が必要）
  const [posts, preferences] = await Promise.all([
    fetchPosts(user.id),
    fetchPreferences(user.id),
  ]);

  return { user, posts, preferences };
}
```

### `Promise.allSettled` による部分的な失敗の処理

```js
async function loadOptionalData(userId) {
  const results = await Promise.allSettled([
    fetchUser(userId),             // 必須
    fetchRecommendations(userId),  // 任意
    fetchAds(userId),              // 任意
  ]);

  const [userResult, recsResult, adsResult] = results;

  if (userResult.status === "rejected") {
    throw userResult.reason; // ユーザーは必須
  }

  return {
    user: userResult.value,
    recommendations: recsResult.status === "fulfilled" ? recsResult.value : [],
    ads: adsResult.status === "fulfilled" ? adsResult.value : [],
  };
}
```

---

## 6. よくある間違い

### 6.1 ループ内での不必要な逐次 await

```js
const userIds = [1, 2, 3, 4, 5];

// 悪い例: 前のフェッチが終わるまで次を待つ
async function slowAll() {
  const users = [];
  for (const id of userIds) {
    const user = await fetchUser(id); // 逐次実行！
    users.push(user);
  }
  return users;
}

// 良い例: すべてのフェッチを開始してから結果をまとめて待つ
async function fastAll() {
  const promises = userIds.map((id) => fetchUser(id));
  return await Promise.all(promises);
}
```

**例外**: 各イテレーションが前の結果に依存する場合（例：ページネーション付き API のトラバーサル）は、ループ内の逐次 await が適切です。

### 6.2 async 関数の未処理 rejection

```js
// 悪い例: .catch() も try/catch もなく async 関数を呼び出している
async function dangerousOperation() {
  await doSomethingRisky(); // reject される可能性がある
}

dangerousOperation(); // rejection が未処理 — Node.js がクラッシュする可能性

// 良い例: 呼び出し側でハンドリングする
dangerousOperation().catch((err) => console.error(err));

// または async コンテキスト内で try/catch を使う
async function safeWrapper() {
  try {
    await dangerousOperation();
  } catch (err) {
    console.error(err);
  }
}
```

### 6.3 `forEach` 内の `await` は期待通りに動かない

```js
const ids = [1, 2, 3];

// 悪い例: forEach は async callback を await しない
async function wrong() {
  ids.forEach(async (id) => {
    const user = await fetchUser(id); // 実行されるが forEach は待たない
    console.log(user.name);
  });
  console.log("Done?"); // ユーザーが取得される前に出力される
}

// 良い例: 逐次処理なら for...of、並行処理なら map + Promise.all を使う
async function correctSequential() {
  for (const id of ids) {
    const user = await fetchUser(id);
    console.log(user.name);
  }
}

async function correctParallel() {
  await Promise.all(ids.map(async (id) => {
    const user = await fetchUser(id);
    console.log(user.name);
  }));
  console.log("All done");
}
```

### 6.4 `await` の戻り値を無視する

```js
// 悪い例: 結果が捨てられ、変数が undefined になる
async function bad() {
  const user = fetchUser(1); // await がない！
  console.log(user.name);   // TypeError: Promise のプロパティを読み取れない
}

// 良い例
async function good() {
  const user = await fetchUser(1);
  console.log(user.name);
}
```

### 6.5 不要な `async` の使用

```js
// 不要: 関数本体に await がない
async function getConfig() {
  return { host: "localhost", port: 3000 }; // 非同期処理なし
}

// よりシンプル: 必要に応じてプレーンな値または Promise.resolve を返す
function getConfig() {
  return { host: "localhost", port: 3000 };
}
```

---

## 7. FAQ

**Q: `async/await` は単なる糖衣構文ですか？**

A: はい。すべての `async` 関数は Promise を返し、`await` は `.then()` と同等です。JavaScript エンジンは `async/await` を内部で Promise チェーンにコンパイルします。パフォーマンスの差はありません。

---

**Q: 古い Node.js バージョンで `async/await` は使えますか？**

A: `async/await` は Node.js 7.6以降（ネイティブ）、または Babel トランスパイルを使えば Node.js 4以降で利用できます。2025年時点では Node.js 18以降が LTS のベースラインとなっており、ネイティブサポートは事実上すべての環境で利用可能です。

---

**Q: `await` はスレッドをブロックしますか？**

A: いいえ。`await` は現在の `async` 関数を一時停止しますが、Event Loop に制御を返すため、他の callback や Promise が実行できます。スレッドがブロックされることはありません。

---

**Q: `Promise.all` と逐次 `await` はどう使い分けますか？**

A: 処理が**独立している**（順序に依存せず、データの依存関係もない）場合は `Promise.all` を使います。各ステップが**前のステップの結果に依存する**場合や、順序が重要な場合（例：書き込み前に読み込む）は逐次 `await` を使います。

---

**Q: `async/await` でタイムアウトを処理するにはどうすればいいですか？**

A: `Promise.race` とタイムアウト Promise を組み合わせます。

```js
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function fetchWithTimeout(url) {
  try {
    const data = await withTimeout(fetch(url).then((r) => r.json()), 5000);
    return data;
  } catch (err) {
    console.error(err.message);
    throw err;
  }
}
```

---

**Q: Node.js でトップレベル `await` は使えますか？**

A: はい、ES モジュール（`.mjs` 拡張子または `package.json` に `"type": "module"` を指定したファイル）では使えます。CommonJS モジュールでは async IIFE でコードをラップしてください。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
