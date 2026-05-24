# JavaScript 基礎 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [変数と定数](#変数と定数)
3. [データ型](#データ型)
4. [関数](#関数)
5. [配列とオブジェクト](#配列とオブジェクト)
6. [ES6+ の機能](#es6-の機能)
7. [演習](#演習)
8. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- JavaScript の基本構文
- 変数・関数・配列・オブジェクト
- モダンな ES6+ の機能
- Node.js で使われる重要な概念

### 所要時間：1〜1.5 時間

---

## 変数と定数

### let（変数）

```javascript
let count = 0
count = 10  // 再代入可能

let message = 'Hello'
message = 'Hi'  // OK
```

### const（定数）

```javascript
const PI = 3.14159
// PI = 3.14  // エラー：再代入不可

const user = { name: 'Alice' }
user.name = 'Bob'  // OK：オブジェクトの中身は変更できる
// user = {}  // エラー：変数自体への再代入は不可
```

### var（非推奨）

```javascript
// var は使わない（スコープの問題がある）
// 代わりに let / const を使う
```

---

## データ型

### プリミティブ型

```javascript
// 数値
const age = 25
const price = 1980.5

// 文字列
const name = 'Alice'
const message = "Hello"

// 真偽値
const isActive = true
const hasPermission = false

// null / undefined
const empty = null
const notDefined = undefined
```

### 型変換

```javascript
// 文字列 → 数値
const str = '42'
const num = Number(str)  // 42
const num2 = parseInt(str)  // 42
const num3 = parseFloat('3.14')  // 3.14

// 数値 → 文字列
const n = 123
const s = String(n)  // '123'
const s2 = n.toString()  // '123'

// 真偽値への変換
Boolean(1)  // true
Boolean(0)  // false
Boolean('')  // false
Boolean('text')  // true
```

---

## 関数

### 従来の関数宣言

```javascript
function greet(name) {
  return `Hello, ${name}!`
}

console.log(greet('Alice'))  // Hello, Alice!
```

### アロー関数（推奨）

```javascript
// 基本形
const add = (a, b) => {
  return a + b
}

// 省略形（暗黙のreturn）
const add2 = (a, b) => a + b

// 引数が1つの場合
const double = x => x * 2

// 引数なし
const getTime = () => new Date()
```

### デフォルト引数

```javascript
const greet = (name = 'Guest') => {
  return `Hello, ${name}!`
}

console.log(greet())        // Hello, Guest!
console.log(greet('Alice')) // Hello, Alice!
```

---

## 配列とオブジェクト

### 配列

```javascript
const fruits = ['apple', 'banana', 'grape']

// アクセス
console.log(fruits[0])  // apple

// 要素数
console.log(fruits.length)  // 3

// 追加
fruits.push('strawberry')

// 削除
fruits.pop()  // 末尾の要素を取り除く

// map（変換）
const numbers = [1, 2, 3]
const doubled = numbers.map(n => n * 2)  // [2, 4, 6]

// filter（絞り込み）
const ages = [15, 25, 35]
const adults = ages.filter(age => age >= 18)  // [25, 35]

// find（検索）
const users = ['Alice', 'Bob', 'Charlie']
const user = users.find(u => u === 'Bob')  // Bob
```

### オブジェクト

```javascript
const user = {
  name: 'Alice',
  age: 25,
  email: 'alice@example.com'
}

// アクセス
console.log(user.name)    // Alice
console.log(user['age'])  // 25

// 追加・変更
user.city = 'New York'
user.age = 26

// メソッド
const calculator = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b
}

console.log(calculator.add(10, 5))  // 15
```

---

## ES6+ の機能

### テンプレートリテラル

```javascript
const name = 'Alice'
const age = 25

// 旧来の書き方
const message1 = 'Hello, ' + name + '! You are ' + age + ' years old.'

// テンプレートリテラル（推奨）
const message2 = `Hello, ${name}! You are ${age} years old.`

// 複数行
const html = `
  <div>
    <h1>${name}</h1>
    <p>年齢: ${age}</p>
  </div>
`
```

### 分割代入

```javascript
// 配列
const [a, b, c] = [1, 2, 3]
console.log(a)  // 1

// オブジェクト
const user = { name: 'Alice', age: 25 }
const { name, age } = user
console.log(name)  // Alice

// 関数の引数
const greet = ({ name, age }) => {
  return `${name}（${age}歳）`
}

greet({ name: 'Alice', age: 25 })
```

### スプレッド構文

```javascript
// 配列の結合
const arr1 = [1, 2, 3]
const arr2 = [4, 5, 6]
const combined = [...arr1, ...arr2]  // [1, 2, 3, 4, 5, 6]

// オブジェクトの結合
const user = { name: 'Alice', age: 25 }
const updated = { ...user, age: 26 }  // { name: 'Alice', age: 26 }

// 関数の引数に展開
const numbers = [1, 2, 3]
console.log(Math.max(...numbers))  // 3
```

### モジュール

```javascript
// math.js（エクスポート）
export const add = (a, b) => a + b
export const subtract = (a, b) => a - b

// デフォルトエクスポート
export default class Calculator {}

// main.js（インポート）
import { add, subtract } from './math.js'
import Calculator from './math.js'

console.log(add(10, 5))  // 15
```

---

## Node.js 固有の概念

### CommonJS モジュール

```javascript
// math.js（エクスポート）
const add = (a, b) => a + b
const subtract = (a, b) => a - b

module.exports = { add, subtract }

// main.js（インポート）
const { add, subtract } = require('./math')

console.log(add(10, 5))  // 15
```

### process オブジェクト

```javascript
// 環境変数
console.log(process.env.NODE_ENV)

// コマンドライン引数
console.log(process.argv)
// node app.js arg1 arg2
// ['node', '/path/to/app.js', 'arg1', 'arg2']

// カレントディレクトリ
console.log(process.cwd())

// プロセスの終了
process.exit(0)
```

---

## 演習

### 演習1：FizzBuzz

```javascript
// 1〜100 の数に対して：
// 3の倍数：Fizz
// 5の倍数：Buzz
// 両方の倍数：FizzBuzz

for (let i = 1; i <= 100; i++) {
  if (i % 15 === 0) {
    console.log('FizzBuzz')
  } else if (i % 3 === 0) {
    console.log('Fizz')
  } else if (i % 5 === 0) {
    console.log('Buzz')
  } else {
    console.log(i)
  }
}
```

### 演習2：配列操作

```javascript
// 18歳以上のユーザーの名前を抽出する

const users = [
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 17 },
  { name: 'Charlie', age: 30 }
]

const adults = users
  .filter(user => user.age >= 18)
  .map(user => user.name)

console.log(adults)  // ['Alice', 'Charlie']
```

---

## よくある間違い

### ❌ 間違い1：var を使う

```javascript
var x = 10  // 非推奨
```

**✅ 正しい書き方**：

```javascript
const x = 10  // 推奨（再代入しない場合）
let y = 20    // 推奨（再代入する場合）
```

### ❌ 間違い2：=== の代わりに == を使う

```javascript
'5' == 5  // true（型の変換が行われる）
```

**✅ 正しい書き方**：

```javascript
'5' === 5  // false（型も比較される）
```

### ❌ 間違い3：this の誤った使い方

```javascript
const obj = {
  name: 'Alice',
  greet: function() {
    setTimeout(function() {
      console.log(this.name)  // undefined
    }, 1000)
  }
}
```

**✅ 正しい書き方**：

```javascript
const obj = {
  name: 'Alice',
  greet: function() {
    setTimeout(() => {
      console.log(this.name)  // Alice
    }, 1000)
  }
}
```

---

## 次のステップ

### このガイドで学んだこと

- ✅ JavaScript の基本構文
- ✅ 変数・関数・配列・オブジェクト
- ✅ モダンな ES6+ の機能
- ✅ Node.js で使われる重要な概念

### 次に読むガイド

**次のガイド**：[03-npm-basics.md](./03-npm-basics.md) — NPM とパッケージ管理

---

**前のガイド**：[01-what-is-nodejs.md](./01-what-is-nodejs.md)

**親ガイド**：[Node.js 開発 - SKILL.md](../../SKILL.md)
