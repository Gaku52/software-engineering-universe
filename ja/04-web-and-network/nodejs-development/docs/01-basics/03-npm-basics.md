# NPM とパッケージ管理 — 完全入門ガイド

## 目次

1. [概要](#概要)
2. [NPM とは](#npm-とは)
3. [package.json の作成](#packagejson-の作成)
4. [パッケージのインストール](#パッケージのインストール)
5. [依存関係の管理](#依存関係の管理)
6. [NPM スクリプト](#npm-スクリプト)
7. [よく使うパッケージ](#よく使うパッケージ)
8. [次のステップ](#次のステップ)

---

## 概要

### 学習内容

- NPM の基本概念
- package.json の管理
- パッケージのインストールと削除
- NPM スクリプトの活用

### 所要時間：40〜50 分

---

## NPM とは

### 定義

**NPM（Node Package Manager）** は、Node.js のパッケージ管理ツールです。

**主な機能**：
- パッケージのインストール
- 依存関係の管理
- スクリプトの実行
- パッケージの公開

### NPM レジストリ

**npmjs.com** には 100 万件以上のパッケージが登録されています。

```bash
# パッケージを検索する
npm search express

# パッケージの情報を確認する
npm info express
```

---

## package.json の作成

### 初期化

```bash
# 新しいプロジェクトを作成する
mkdir myproject
cd myproject

# 対話形式で package.json を作成する
npm init

# デフォルト設定で作成する
npm init -y
```

### package.json の構造

```json
{
  "name": "myproject",
  "version": "1.0.0",
  "description": "My awesome project",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["nodejs", "express"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## パッケージのインストール

### 本番依存（dependencies）

```bash
# express をインストールする
npm install express

# 省略形
npm i express

# 複数のパッケージを一度にインストールする
npm i express body-parser cors
```

### 開発依存（devDependencies）

```bash
# nodemon を開発用依存としてインストールする
npm install --save-dev nodemon

# 省略形
npm i -D nodemon
```

### グローバルインストール

```bash
# グローバルにインストールする
npm install -g typescript

# 確認する
npm list -g --depth=0
```

---

## 依存関係の管理

### package-lock.json

**package-lock.json** は、全依存パッケージの正確なバージョンを記録したファイルです。

```bash
# 全依存パッケージをインストールする
npm install

# package-lock.json も同時に生成される
```

**重要**：
- `package-lock.json` は Git にコミットする
- チーム全員が同じバージョンを使用できるようになる

### node_modules

**node_modules** は、インストールされたパッケージが格納されるディレクトリです。

```bash
# インストール済みパッケージを一覧表示する
npm list --depth=0

# node_modules のサイズを確認する
du -sh node_modules
```

**.gitignore** に追加する：

```
node_modules/
```

### バージョン指定子

```json
{
  "dependencies": {
    "express": "4.18.2",      // 厳密なバージョン指定
    "lodash": "^4.17.21",    // マイナーアップデートまで許可
    "axios": "~1.6.0"        // パッチアップデートのみ許可
  }
}
```

---

## NPM スクリプト

### スクリプトの定義

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "build": "webpack",
    "lint": "eslint ."
  }
}
```

### スクリプトの実行

```bash
# start と test は "run" なしで実行できる
npm start
npm test

# それ以外は "run" が必要
npm run dev
npm run build
npm run lint
```

### 実用的な例

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest --watch",
    "test:ci": "jest --coverage",
    "lint": "eslint src/**/*.js",
    "lint:fix": "eslint src/**/*.js --fix",
    "format": "prettier --write src/**/*.js"
  }
}
```

---

## よく使うパッケージ

### Web フレームワーク

```bash
# Express — 最も人気のあるフレームワーク
npm i express

# Fastify — 高パフォーマンスなフレームワーク
npm i fastify

# Koa — 軽量フレームワーク
npm i koa
```

### ユーティリティ

```bash
# lodash — ユーティリティ関数ライブラリ
npm i lodash

# dayjs — 日付・時刻操作（moment の後継として推奨）
npm i dayjs

# dotenv — 環境変数の管理
npm i dotenv
```

### 開発ツール

```bash
# nodemon — ファイル変更時に自動再起動
npm i -D nodemon

# eslint — コードの静的解析
npm i -D eslint

# prettier — コードフォーマッター
npm i -D prettier

# jest — テストフレームワーク
npm i -D jest
```

---

## 実践例

### プロジェクトのセットアップ

```bash
# 1. プロジェクトを作成する
mkdir express-app
cd express-app
npm init -y

# 2. 依存パッケージをインストールする
npm i express dotenv
npm i -D nodemon

# 3. ディレクトリ構成
mkdir src
touch src/index.js
touch .env
touch .gitignore
```

### package.json の設定

```json
{
  "name": "express-app",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### .gitignore

```
node_modules/
.env
npm-debug.log
.DS_Store
```

---

## パッケージ管理コマンド

### インストール

```bash
# package.json にあるすべてをインストールする
npm install

# 特定のパッケージをインストールする
npm install express

# バージョンを指定してインストールする
npm install express@4.18.2
```

### アンインストール

```bash
# パッケージを削除する
npm uninstall express

# 省略形
npm un express
```

### アップデート

```bash
# 全パッケージを更新する
npm update

# 特定のパッケージを更新する
npm update express

# アップデート可能なパッケージを確認する
npm outdated
```

### 確認

```bash
# インストール済みパッケージを一覧表示する
npm list

# グローバルパッケージを一覧表示する
npm list -g --depth=0

# パッケージの情報を確認する
npm info express
```

---

## よくある問題と解決策

### 問題1：依存関係エラー

```bash
# エラー
npm ERR! peer dep missing

# 解決策
rm -rf node_modules package-lock.json
npm install
```

### 問題2：パーミッションエラー（EACCES）

```bash
# エラー
npm ERR! EACCES: permission denied

# 解決策（macOS/Linux）
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### 問題3：パッケージが古い

```bash
# アップデート可能なパッケージを確認する
npm outdated

# 更新する
npm update

# メジャーバージョンのアップグレード（慎重に行う）
npx npm-check-updates -u
npm install
```

---

## 演習

### 課題：プロジェクトのセットアップ

以下の要件でプロジェクトを構築してください：
1. `todo-app` プロジェクトを作成する
2. `express` と `dotenv` をインストールする
3. `nodemon` を開発用依存としてインストールする
4. `start` と `dev` スクリプトを追加する

**解答例**：

```bash
mkdir todo-app
cd todo-app
npm init -y

npm i express dotenv
npm i -D nodemon
```

```json
{
  "name": "todo-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## 次のステップ

### このガイドで学んだこと

- ✅ NPM の基本概念
- ✅ package.json の管理
- ✅ パッケージのインストールと削除
- ✅ NPM スクリプトの活用

**次のガイド**：[04-express-intro.md](./04-express-intro.md) — Express 入門

---

**前のガイド**：[02-javascript-basics.md](./02-javascript-basics.md)

**親ガイド**：[Node.js 開発 - SKILL.md](../../SKILL.md)
