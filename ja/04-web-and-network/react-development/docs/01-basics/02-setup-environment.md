# React 開発環境のセットアップ — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [前提知識](#前提知識)
3. [Node.js のインストール](#nodejs-のインストール)
4. [最初の React プロジェクトを作成する](#最初の-react-プロジェクトを作成する)
5. [プロジェクト構成を理解する](#プロジェクト構成を理解する)
6. [開発サーバーを起動して確認する](#開発サーバーを起動して確認する)
7. [最初のコンポーネントを編集する](#最初のコンポーネントを編集する)
8. [よくあるトラブルと解決策](#よくあるトラブルと解決策)
9. [演習](#演習)
10. [次のステップ](#次のステップ)

---

## 概要

### このガイドで学ぶこと

- Node.js と npm / pnpm のインストール
- Vite を使ったモダンな React プロジェクトの作成
- 基本的なプロジェクト構成の理解
- 開発サーバーの起動と動作確認
- 最初のコンポーネントの編集

### なぜ重要なのか

React を使って開発するには、適切な開発環境が必要です。2024 年時点では **Vite + React** の組み合わせが推奨されています：

- **高速な起動**：Create React App（CRA）の 10 倍以上速い
- **高速な HMR**：コードの変更が即座に反映される（Hot Module Replacement）
- **モダンな構成**：ES Modules・TypeScript・最新ビルドツールに対応
- **公式推奨**：React 公式ドキュメントでも推奨されている

### 学習時間の目安

- このガイドを読むだけ：20〜30 分
- 環境構築の実作業：20〜40 分（ダウンロード速度による）
- 演習まで含めた完全理解：1 時間

---

## 前提知識

### 必須の知識

1. **コマンドライン（ターミナル）の基本操作**：
   - ディレクトリの移動（`cd`）
   - ファイルの一覧表示（`ls` / `dir`）
   - 基本的なコマンドの実行

2. **テキストエディタの使用経験**：VS Code・Sublime Text など

### 推奨環境

- **OS**：Windows 10/11、macOS 10.15 以降、Linux
- **メモリ**：4 GB 以上（8 GB 以上推奨）
- **ストレージ**：空き容量 2 GB 以上

---

## Node.js のインストール

### Node.js とは？

**Node.js** は JavaScript をブラウザの外（サーバーやローカル）で実行するためのランタイムです。React 開発に必要な理由は次のとおりです：

- **npm / pnpm**：パッケージマネージャー（ライブラリの管理ツール）
- **ビルドツール**：Vite・Webpack などを動かすために必要
- **開発サーバー**：React アプリをローカルで実行するために必要

### インストール手順

#### Windows / macOS / Linux 共通

1. **公式サイトにアクセス**：https://nodejs.org/

2. **バージョンを選ぶ**：**LTS（推奨版）** を選択。2024 年初頭時点では Node.js 20.x LTS。

3. **インストーラーをダウンロード**：
   - Windows：`.msi` ファイル
   - macOS：`.pkg` ファイル
   - Linux：パッケージマネージャーを使用

4. **インストーラーを実行**：基本的にデフォルト設定のまま進める。「Add to PATH」にチェックが入っていることを確認する。

5. **インストールの確認**：

```bash
# Node.js のバージョンを確認
node --version
# 出力例: v20.10.0

# npm のバージョンを確認
npm --version
# 出力例: 10.2.3
```

### macOS：Homebrew でインストールする場合（任意）

```bash
brew install node

node --version
npm --version
```

### pnpm のインストール（推奨）

**pnpm** は npm より高速で効率的なパッケージマネージャーです。

```bash
# npm 経由で pnpm をインストール
npm install -g pnpm

# 確認
pnpm --version
# 出力例: 8.15.0
```

**pnpm のメリット**：
- **高速**：npm の 2〜3 倍速い
- **省スペース**：シンボリックリンクを使いディスク消費を抑える
- **厳格な依存管理**：予期しないバグを防ぎやすい

---

## 最初の React プロジェクトを作成する

### Vite でプロジェクトを作成する

Vite はモダンで高速なビルドツールです。

#### ステップ 1：プロジェクトを作成する

```bash
# pnpm を使う場合
pnpm create vite my-react-app --template react-ts

# npm を使う場合
npm create vite@latest my-react-app -- --template react-ts

# my-react-app：好きな名前に変えてOK
# --template react-ts：React + TypeScript テンプレートを使用
```

**所要時間**：10〜30 秒ほど。

#### ステップ 2：プロジェクトディレクトリへ移動する

```bash
cd my-react-app
```

#### ステップ 3：依存パッケージをインストールする

```bash
# pnpm を使う場合
pnpm install

# npm を使う場合
npm install
```

**所要時間**：1〜3 分ほど（ネットワーク速度による）。

#### 正常終了時の出力例

```
added 212 packages, and audited 213 packages in 45s

52 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

---

## プロジェクト構成を理解する

```bash
# ファイルツリーを表示する
tree -L 2 my-react-app
```

### ディレクトリ構成

```
my-react-app/
├── node_modules/       # インストール済みライブラリ（触らない）
├── public/             # 静的ファイル（画像・favicon など）
│   └── vite.svg
├── src/                # ソースコード（主な作業場所）
│   ├── assets/         # 静的リソース（画像・CSS など）
│   ├── App.tsx         # メインの App コンポーネント
│   ├── App.css         # App コンポーネントのスタイル
│   ├── main.tsx        # エントリーポイント（アプリの起動ファイル）
│   └── index.css       # グローバルスタイル
├── index.html          # HTML テンプレート
├── package.json        # プロジェクト設定と依存関係
├── tsconfig.json       # TypeScript 設定
├── vite.config.ts      # Vite 設定
└── README.md           # プロジェクトの説明
```

### 重要なファイル

#### 1. `package.json`

プロジェクトの設定ファイルです。

```json
{
  "name": "my-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",                      // 開発サーバーを起動
    "build": "tsc && vite build",       // 本番ビルド
    "preview": "vite preview"           // ビルド結果をプレビュー
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

- `scripts`：コマンドのショートカット
- `dependencies`：本番環境でも必要なライブラリ
- `devDependencies`：開発時にのみ必要なライブラリ

#### 2. `src/main.tsx`

React アプリのエントリーポイントです。

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// React アプリを #root 要素にマウント（描画）する
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- `ReactDOM.createRoot()`：React 18 の新しいレンダリング API
- `document.getElementById('root')!`：HTML 内の `<div id="root">` を取得
- `<React.StrictMode>`：開発モードの警告を有効化
- `<App />`：メインの App コンポーネントを描画

#### 3. `src/App.tsx`

メインコンポーネントです。

```typescript
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
```

---

## 開発サーバーを起動して確認する

### 開発サーバーを起動する

```bash
# pnpm を使う場合
pnpm dev

# npm を使う場合
npm run dev
```

### 正常起動時の出力例

```
  VITE v5.0.8  ready in 324 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### ブラウザで確認する

1. ブラウザ（Chrome・Firefox・Edge など）を開く
2. `http://localhost:5173/` にアクセスする
3. React アプリが表示されれば成功

**表示される内容**：
- Vite と React のロゴ
- カウンターボタン
- 「count is 0」というテキスト

### HMR（Hot Module Replacement）を体験する

HMR を使うと、コードを変更したときに**ページをリロードせずに**ブラウザが更新されます。

1. `src/App.tsx` を開く
2. `<h1>Vite + React</h1>` を `<h1>Hello React！</h1>` に変更する
3. ファイルを保存する（Ctrl+S / Cmd+S）
4. ブラウザが自動で更新される — **リロード不要**

**更新にかかる時間**：約 0.1 秒（ほぼ即座）。

---

## 最初のコンポーネントを編集する

### 演習：シンプルな自己紹介アプリ

#### ステップ 1：App.tsx を編集する

```typescript
import { useState } from 'react'
import './App.css'

function App() {
  const [name, setName] = useState('')

  return (
    <div className="App">
      <h1>自己紹介アプリ</h1>

      <div>
        <label htmlFor="name-input">あなたの名前：</label>
        <input
          id="name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名前を入力してください"
        />
      </div>

      {name && (
        <div className="greeting">
          <h2>こんにちは、{name}！</h2>
          <p>React へようこそ！</p>
        </div>
      )}
    </div>
  )
}

export default App
```

#### ステップ 2：スタイルを追加する（App.css）

```css
.App {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

input {
  width: 100%;
  max-width: 300px;
  padding: 0.5rem;
  margin: 1rem 0;
  font-size: 1rem;
  border: 2px solid #646cff;
  border-radius: 4px;
}

.greeting {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f0f0f0;
  border-radius: 8px;
}

.greeting h2 {
  color: #646cff;
  margin: 0 0 0.5rem 0;
}

.greeting p {
  margin: 0;
  color: #333;
}
```

#### 完成後の動作

1. ブラウザに「自己紹介アプリ」が表示される
2. 名前を入力すると、リアルタイムで挨拶が表示される
3. 入力を消すと、挨拶も消える

**ポイント**：
- `useState('')`：名前を保持する state
- `onChange={(e) => setName(e.target.value)}`：キー入力のたびに state を更新
- `{name && <div>...</div>}`：名前が入力されているときだけ挨拶を表示

---

## よくあるトラブルと解決策

### 問題 1：`node: command not found`

**症状**：
```bash
$ node --version
bash: node: command not found
```

**解決策**：
1. 公式サイト（https://nodejs.org/）から Node.js を再インストールする
2. ターミナルを再起動する
3. `node --version` で確認する

### 問題 2：`EACCES: permission denied`

**症状**：
```bash
$ npm install -g pnpm
npm ERR! Error: EACCES: permission denied
```

**解決策（macOS / Linux）**：
```bash
# npm のグローバルディレクトリを変更する（推奨）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**解決策（Windows）**：PowerShell を管理者として実行し、再度試す。

### 問題 3：ポート 5173 がすでに使用中

**症状**：
```bash
$ pnpm dev
Error: Port 5173 is already in use
```

**解決策 1**：別のポートを使う：
```bash
# vite.config.ts を編集する
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
})
```

**解決策 2**：ポート 5173 を使っているプロセスを終了する：
```bash
# macOS / Linux
lsof -ti:5173 | xargs kill -9

# Windows（PowerShell）
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process
```

### 問題 4：依存関係のエラー

**症状**：
```bash
$ pnpm install
ERR_PNPM_PEER_DEP_ISSUES  Unmet peer dependencies
```

**解決策**：
```bash
# node_modules とロックファイルを削除する
rm -rf node_modules pnpm-lock.yaml

# 再インストールする
pnpm install
```

---

## 演習

### 演習 1：カウンターの拡張

**難易度**：初級

カウンターに次の機能を追加してください：
- 「+10」ボタン（10 ずつ増やす）
- 「リセット」ボタン（0 に戻す）
- 現在の値が偶数か奇数かを表示する

**ヒント**：`count % 2 === 0` で偶数かどうかを判定できます。

**解答例**：
```typescript
import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const increment = () => setCount(count + 1)
  const incrementBy10 = () => setCount(count + 10)
  const reset = () => setCount(0)

  const isEven = count % 2 === 0

  return (
    <div className="App">
      <h1>カウンター拡張版</h1>
      <p>現在の値: {count}</p>
      <p>{isEven ? '偶数' : '奇数'}</p>
      <div>
        <button onClick={increment}>+1</button>
        <button onClick={incrementBy10}>+10</button>
        <button onClick={reset}>リセット</button>
      </div>
    </div>
  )
}

export default App
```

### 演習 2：自分だけのプロジェクトを作る

**難易度**：中級

新しい React プロジェクトを作成し、シンプルな TODO リストを実装してください：
- TODO アイテムを追加できる
- 合計件数を表示する
- 追加後に入力欄をクリアする

**ヒント**：`useState<string[]>([])` で配列の state を定義できます。

---

## 次のステップ

### このガイドで学んだこと

- Node.js と pnpm のインストール
- Vite を使った React プロジェクトの作成
- プロジェクト構成の理解
- 開発サーバーの起動と HMR の体験
- 最初のコンポーネントの編集
- よくあるトラブルと解決策

### 次に読むガイド

1. **[03-jsx-fundamentals.md](./03-jsx-fundamentals.md)** — JSX の構文・JavaScript との連携・条件分岐とループ
2. **[04-components-intro.md](./04-components-intro.md)** — コンポーネントの分割・props の渡し方・コンポーネント設計

### 参考リンク

- [Vite 公式ドキュメント](https://vitejs.dev/)
- [React 公式ドキュメント - インストール](https://ja.react.dev/learn/installation)
- [VS Code](https://code.visualstudio.com/) — 推奨エディタ
- [ES7+ React/Redux/React-Native snippets](https://marketplace.visualstudio.com/items?itemName=dsznajder.es7-react-js-snippets) — VS Code 拡張機能

---

**次のガイド**: [03-jsx-fundamentals.md](./03-jsx-fundamentals.md)

**前のガイド**: [01-what-is-react.md](./01-what-is-react.md)

**上位ガイド**: [React 開発 - SKILL.md](../../SKILL.md)
