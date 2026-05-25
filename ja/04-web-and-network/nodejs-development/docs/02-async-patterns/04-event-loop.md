# Node.js の Event Loop

Event Loop は、Node.js がシングルスレッドで動作しながらもノンブロッキング I/O を実現するための中核的な仕組みです。予測可能な非同期コードの作成やパフォーマンス問題の診断において、Event Loop の理解は不可欠です。

---

## 目次

1. [Event Loop とは](#1-event-loop-とは)
2. [Call Stack](#2-call-stack)
3. [Task Queue（macrotask）](#3-task-queuemacrotask)
4. [Microtask Queue](#4-microtask-queue)
5. [Event Loop のフェーズ](#5-event-loop-のフェーズ)
6. [実行順序の例](#6-実行順序の例)
7. [よくある面接での質問](#7-よくある面接での質問)

---

## 1. Event Loop とは

Node.js は **libuv** という C ライブラリの上に構築されており、libuv が Event Loop と非同期 I/O のプリミティブを提供しています。Event Loop は保留中の処理を継続的に確認し、その callback をディスパッチします。

```
  ┌─────────────────────────────────────────┐
  │         Node.js Process                 │
  │                                         │
  │  ┌───────────┐   ┌───────────────────┐  │
  │  │ Call Stack│   │   libuv / OS      │  │
  │  │ (V8)      │   │  Thread Pool      │  │
  │  └─────┬─────┘   │  (fs, crypto...)  │  │
  │        │          └────────┬──────────┘  │
  │        │                   │             │
  │  ┌─────▼─────────────────▼──────────┐  │
  │  │            Event Loop             │  │
  │  │  timers → I/O → poll → check     │  │
  │  └──────────────────────────────────┘  │
  └─────────────────────────────────────────┘
```

**重要なポイント**: Event Loop 自体はメインスレッドで動きます。I/O 処理（ファイル読み込み、ネットワークリクエスト）がディスパッチされると、libuv はそれらを OS カーネルの非同期 API またはスレッドプールにオフロードします。完了した callback は Event Loop が拾い上げるためにキューに入れられ、メインスレッドが待機でブロックされることはありません。

---

## 2. Call Stack

**Call Stack** は現在実行中の関数を追跡する LIFO（後入れ先出し）のデータ構造です。関数が呼ばれるとフレームがプッシュされ、返るとポップされます。

```js
function multiply(a, b) {
  return a * b;
}

function square(n) {
  return multiply(n, n);
}

function main() {
  const result = square(5);
  console.log(result);
}

main();
```

```
Call Stack の遷移:

  main()          →  square(5)       →  multiply(5,5)
  ┌─────────┐       ┌─────────┐        ┌─────────────┐
  │  main   │       │ square  │        │  multiply   │
  └─────────┘       │  main   │        │  square     │
                    └─────────┘        │  main       │
                                       └─────────────┘
                    ← multiply が返る
                    ← square が返る
  ← main が返る  (スタックが空 → Event Loop がキューを確認)
```

**Call Stack のブロック**: 同期処理に時間がかかると（例：大きなファイルへの `fs.readFileSync`、重い計算処理）、その間 Call Stack が占有されます。スタックが空になるまで Event Loop はどの callback も処理できません。これが「Node.js をブロックする」ということの意味です。

```js
// 危険: Call Stack を数秒間ブロックする可能性がある
const data = fs.readFileSync("huge-file.csv"); // この間 I/O は処理されない

// 安全: チャンク間に Event Loop へ制御を返す
const stream = fs.createReadStream("huge-file.csv");
stream.on("data", (chunk) => processChunk(chunk));
```

---

## 3. Task Queue（macrotask）

**Task Queue**（macrotask queue または callback queue とも呼ばれる）は実行待ちの callback を保持します。macrotask の主なソース：

| ソース | 説明 |
|--------|-------------|
| `setTimeout(fn, delay)` | 少なくとも `delay` ミリ秒後に実行 |
| `setInterval(fn, delay)` | `delay` ミリ秒ごとに繰り返し実行 |
| `setImmediate(fn)` | check フェーズで実行（I/O の後） |
| I/O callback | `fs.readFile`、ネットワーク応答など |

Event Loop は**1回のループ反復で1つの macrotask** を処理し、次に進む前に microtask queue をすべて空にします。

```js
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));

// Node.js での出力順（I/O callback の外側では）:
// どちらが先になるかは不確定 — システムのタイマー精度に依存する
// I/O callback の内側では: setImmediate が setTimeout より常に先に実行される
```

---

## 4. Microtask Queue

**Microtask Queue** は、現在の処理が完了した直後、Event Loop が次のフェーズに移るまたは別の macrotask を処理する前に実行すべき callback を保持します。

microtask のソース：

| ソース | 説明 |
|--------|-------------|
| `Promise.then()` / `.catch()` / `.finally()` | Promise 解決の callback |
| `queueMicrotask(fn)` | 明示的な microtask のスケジューリング |
| `process.nextTick(fn)` | Node.js 固有 — 最高優先度の microtask |

### 優先度の順序

```
各タスクの後（またはスタートアップ時）:
  1. process.nextTick キューをすべて処理
  2. Promise microtask キューをすべて処理
  3. Event Loop に戻る → 次の macrotask
```

```js
Promise.resolve().then(() => console.log("Promise microtask"));
process.nextTick(() => console.log("nextTick"));
setTimeout(() => console.log("setTimeout macrotask"), 0);

console.log("synchronous");

// 出力:
// synchronous
// nextTick          ← process.nextTick が最初に実行される
// Promise microtask ← 次に Promise の .then()
// setTimeout macrotask ← 最後に macrotask キュー
```

### Microtask の枯渇（Starvation）

Microtask queue はどの macrotask よりも先にすべて処理されるため、無限再帰的な microtask が Event Loop を飢餓状態にする可能性があります。

```js
// 危険: I/O callback を永久にブロックする
function infinite() {
  Promise.resolve().then(infinite);
}
infinite();
// setTimeout の callback は実行されず、I/O も応答しなくなる
```

---

## 5. Event Loop のフェーズ

Node.js の Event Loop には6つのフェーズがあり、固定の順序で実行されます。各フェーズには FIFO の callback キューがあります。

```
  ┌──────────────────────────────────────────────┐
  │                                              │
  │   ┌─────────┐                               │
  │   │ timers  │  setTimeout, setInterval       │
  │   └────┬────┘                               │
  │        │                                    │
  │   ┌────▼──────────┐                         │
  │   │ pending I/O   │  遅延 I/O エラー         │
  │   └────┬──────────┘                         │
  │        │                                    │
  │   ┌────▼──────┐                             │
  │   │  idle,    │  内部使用のみ               │
  │   │  prepare  │                             │
  │   └────┬──────┘                             │
  │        │                                    │
  │   ┌────▼──────┐     ┌──────────────────┐   │
  │   │   poll    │◄────│ 受信 I/O /       │   │
  │   └────┬──────┘     │ 空なら待機       │   │
  │        │            └──────────────────┘   │
  │   ┌────▼──────┐                             │
  │   │   check   │  setImmediate               │
  │   └────┬──────┘                             │
  │        │                                    │
  │   ┌────▼───────────┐                        │
  │   │ close callbacks│  socket.on('close')    │
  │   └────────────────┘                        │
  │        │                                    │
  └────────┘ (ループが繰り返される)
```

### 各フェーズの詳細

**timers フェーズ**: 遅延時間が経過した `setTimeout` および `setInterval` の callback を実行します。なお、`setTimeout(fn, 0)` は内部的に最低 1ms にクランプされます。

**pending I/O フェーズ**: 前のループ反復から次のループ反復に延期された I/O callback（主にエラー callback）を実行します。

**poll フェーズ**: 最も重要なフェーズです。
- 新しい I/O イベントのためにどれくらい待機するかを計算する
- poll キューの I/O callback を処理する
- poll キューが空の場合、I/O イベントを待機する（`setImmediate` の callback が保留中でない限り）

**check フェーズ**: `setImmediate` の callback を実行します。poll フェーズ完了後に常に実行されます。

**close callbacks フェーズ**: クローズされたハンドルの callback を実行します（例：`socket.on('close', ...)`）。

**各フェーズの間**: microtask キュー（`process.nextTick` → Promise の順）がすべて処理されます。

---

## 6. 実行順序の例

### 例1: 基本的な順序

```js
console.log("A"); // 同期

setTimeout(() => console.log("B"), 0); // macrotask

Promise.resolve().then(() => console.log("C")); // microtask

process.nextTick(() => console.log("D")); // 最高優先度の microtask

console.log("E"); // 同期

// 出力: A, E, D, C, B
```

解説:
1. `A` と `E` が同期的に実行される（Call Stack）
2. `D` が実行される — `process.nextTick` キューが最初にすべて処理される
3. `C` が実行される — Promise microtask キューが処理される
4. `B` が実行される — Event Loop が timers フェーズに入る

### 例2: ネストした microtask

```js
process.nextTick(() => {
  console.log("nextTick 1");
  process.nextTick(() => console.log("nextTick 2 (nested)"));
});

Promise.resolve().then(() => {
  console.log("Promise 1");
  return Promise.resolve();
}).then(() => console.log("Promise 2 (chained)"));

// 出力:
// nextTick 1
// nextTick 2 (nested)  ← Promise より先に nextTick キューがすべて処理される
// Promise 1
// Promise 2 (chained)
```

### 例3: I/O 内での `setImmediate` と `setTimeout` の比較

```js
const fs = require("fs");

fs.readFile(__filename, () => {
  // I/O callback の内側 — poll フェーズが完了した直後
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// 出力（I/O callback 内では確定的）:
// setImmediate  ← check フェーズは常に次の timers フェーズより前に来る
// setTimeout
```

### 例4: フルパイプライン

```js
const fs = require("fs/promises");

async function pipeline() {
  console.log("1 - start");

  const data = await fs.readFile(__filename, "utf8"); // ここで一時停止

  console.log("3 - after await (I/O complete)");

  process.nextTick(() => console.log("4 - nextTick after resume"));

  await Promise.resolve();

  console.log("5 - after inner await");
}

pipeline();
console.log("2 - synchronous after pipeline() call");

// 出力:
// 1 - start
// 2 - synchronous after pipeline() call
// 3 - after await (I/O complete)
// 4 - nextTick after resume
// 5 - after inner await
```

### 例5: タイマーの精度

```js
const start = Date.now();

setTimeout(() => {
  console.log(`Timer fired after ${Date.now() - start}ms`);
}, 100);

// ブロッキング処理のシミュレーション
const until = Date.now() + 200;
while (Date.now() < until) {} // Call Stack を200ms間ブロック

// 出力: Timer fired after ~200ms（100ms ではない）
// callback は約100ms でキューに入ったが、スタックが空になるまで実行できなかった
```

この例は、Call Stack をブロックするとすべての保留中の callback が遅延することを示しています。

---

## 7. よくある面接での質問

### Q1: `process.nextTick` と `Promise.then` の違いは何ですか？

どちらも microtask ですが、`process.nextTick` の callback は毎回の microtask ドレインサイクルにおいて Promise callback より**先に**実行されます。

```js
Promise.resolve().then(() => console.log("Promise"));
process.nextTick(() => console.log("nextTick"));

// 出力:
// nextTick
// Promise
```

現在のターンで I/O や Promise 解決より前に callback をスケジュールしたい場合は `process.nextTick` を使います。標準的な非同期の順序付けには `Promise.then` を使います。

---

### Q2: `setImmediate` と `setTimeout(fn, 0)` の違いは何ですか？

- `setImmediate` は poll フェーズの後の **check フェーズ**で実行される
- `setTimeout(fn, 0)` は次のループ開始時の **timers フェーズ**で実行される

I/O callback の内側では `setImmediate` が常に先に実行されます。I/O callback の外側では順序が不確定です（OS のタイマー精度に依存）。

```js
// I/O callback の内側 → setImmediate が常に先
fs.readFile("file.txt", () => {
  setImmediate(() => console.log("setImmediate")); // 先
  setTimeout(() => console.log("setTimeout"), 0);  // 後
});
```

---

### Q3: Event Loop は「詰まる」ことがありますか？

はい、2つの方法で詰まります：

1. **Call Stack のブロック** — CPU 負荷の高い同期コード（重いループ、大きなファイルへの `readFileSync` など）が、callback を処理できない状態にする。

2. **Microtask の枯渇** — microtask の無限連鎖（再帰的な `Promise.resolve().then(...)` や `process.nextTick(...)`）が macrotask を永遠に実行させない。

---

### Q4: `async/await` は Event Loop とどのように連携しますか？

`await` 式は `async` 関数を一時停止し、待機していた Promise が settled になったときに、再開を **microtask** としてスケジュールします。つまり `await` 後のコードは、新しい macrotask としてではなく microtask キューで実行されます。

```js
async function example() {
  await Promise.resolve(); // ここで一時停止
  console.log("resumed"); // microtask としてキューに追加される
}

example();
console.log("synchronous");

// 出力:
// synchronous
// resumed
```

---

### Q5: `setTimeout(fn, 0)` はなぜ即座に実行されないのですか？

3つの理由があります：
1. 最小クランプ: Node.js は内部的に `setTimeout` の遅延を最低 1ms にクランプする。
2. Event Loop が現在のフェーズを完了してから timers フェーズに到達する必要がある。
3. すべての microtask（nextTick + Promise）が macrotask より先に処理される。

---

### Q6: スレッドプールとは何ですか？Event Loop とどのように関係しますか？

libuv は OS レベルで非同期実行できない処理のためにスレッドプール（デフォルトサイズ: 4スレッド、`UV_THREADPOOL_SIZE` で設定可能）を使用します。対象の処理には以下が含まれます：

- ファイルシステム操作（`fs.readFile` など）
- `crypto` モジュールの操作
- `dns.lookup`（`dns.resolve` ではない）
- 一部の `zlib` 操作

スレッドプールは**メインスレッドとは別に**実行されます。スレッドプールのタスクが完了すると、その callback は poll キューに置かれ、メインスレッドの Event Loop が拾い上げます。

```
  Main Thread        Thread Pool（4スレッド）
  ┌──────────┐       ┌────────────────────┐
  │ Event    │──────►│ fs.readFile        │
  │ Loop     │       │ crypto.pbkdf2      │
  │          │◄──────│ (完了したら        │
  └──────────┘       │  callback をキューへ) │
                     └────────────────────┘
```

スレッドプールの4スロットがすべて使用中の場合、後続の I/O 操作はキューで待機します。CPU 負荷の高い crypto 処理が I/O スループットを低下させることがあるのはこのためです。

---

**親ガイド**: [Node.js Development - SKILL.md](../../SKILL.md)
