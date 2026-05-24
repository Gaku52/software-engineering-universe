# 最初のサーバーを作る — 総合チュートリアル

## 目次

1. [概要](#概要)
2. [プロジェクトの目標](#プロジェクトの目標)
3. [プロジェクトのセットアップ](#プロジェクトのセットアップ)
4. [サーバーの実装](#サーバーの実装)
5. [データ管理](#データ管理)
6. [エラーハンドリング](#エラーハンドリング)
7. [テストとデバッグ](#テストとデバッグ)
8. [まとめ](#まとめ)

---

## 概要

### 作るもの

このチュートリアルでは、これまでに学んだすべての概念を統合して **タスク管理 API** を実装します。

### 機能

- ✅ タスクの一覧取得
- ✅ タスクの作成
- ✅ タスクの更新
- ✅ タスクの削除
- ✅ データの永続化（JSON ファイル）
- ✅ エラーハンドリング

### 所要時間：2〜3 時間

---

## プロジェクトの目標

### 完成する API

```
GET    /api/tasks          - タスクの一覧取得
POST   /api/tasks          - タスクの作成
GET    /api/tasks/:id      - タスクの詳細取得
PUT    /api/tasks/:id      - タスクの更新
DELETE /api/tasks/:id      - タスクの削除
```

---

## プロジェクトのセットアップ

### ステップ1：プロジェクトの作成

```bash
mkdir task-api
cd task-api

npm init -y

npm install express
npm install --save-dev nodemon
```

### ステップ2：ディレクトリ構成

```bash
task-api/
├── src/
│   ├── server.js          # サーバーのエントリーポイント
│   ├── routes/
│   │   └── tasks.js       # タスクルーター
│   └── data/
│       └── tasks.json     # データファイル
├── package.json
└── .gitignore
```

```bash
mkdir -p src/routes src/data
touch src/server.js
touch src/routes/tasks.js
touch src/data/tasks.json
echo "node_modules/" > .gitignore
```

### ステップ3：package.json の設定

```json
{
  "name": "task-api",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## サーバーの実装

### src/server.js

```javascript
const express = require('express')
const tasksRouter = require('./routes/tasks')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    message: 'Task API',
    endpoints: {
      tasks: '/api/tasks',
      task: '/api/tasks/:id'
    }
  })
})

app.use('/api/tasks', tasksRouter)

// 404 ハンドラー
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
```

---

## データ管理

### src/data/tasks.json（初期データ）

```json
[
  {
    "id": 1,
    "title": "Go grocery shopping",
    "completed": false,
    "createdAt": "2024-12-24T10:00:00.000Z"
  },
  {
    "id": 2,
    "title": "Reply to emails",
    "completed": true,
    "createdAt": "2024-12-24T11:00:00.000Z"
  }
]
```

### src/routes/tasks.js

```javascript
const express = require('express')
const fs = require('fs').promises
const path = require('path')

const router = express.Router()
const DATA_FILE = path.join(__dirname, '../data/tasks.json')

async function readTasks() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Failed to read tasks:', error)
    return []
  }
}

async function writeTasks(tasks) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(tasks, null, 2))
  } catch (error) {
    console.error('Failed to write tasks:', error)
    throw error
  }
}

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    const tasks = await readTasks()
    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks()
    const task = tasks.find(t => t.id === parseInt(req.params.id))

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json({ task })
  } catch (error) {
    next(error)
  }
})

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const tasks = await readTasks()
    const newTask = {
      id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
      title: title.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }

    tasks.push(newTask)
    await writeTasks(tasks)

    res.status(201).json({ task: newTask })
  } catch (error) {
    next(error)
  }
})

// PUT /api/tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const { title, completed } = req.body

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return res.status(400).json({ error: 'Invalid title' })
    }

    if (completed !== undefined && typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Invalid completed value' })
    }

    const tasks = await readTasks()
    const taskIndex = tasks.findIndex(t => t.id === id)

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    if (title !== undefined) tasks[taskIndex].title = title.trim()
    if (completed !== undefined) tasks[taskIndex].completed = completed

    await writeTasks(tasks)
    res.json({ task: tasks[taskIndex] })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    const tasks = await readTasks()
    const taskIndex = tasks.findIndex(t => t.id === id)

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' })
    }

    tasks.splice(taskIndex, 1)
    await writeTasks(tasks)

    res.json({ message: 'Task deleted' })
  } catch (error) {
    next(error)
  }
})

module.exports = router
```

---

## テストとデバッグ

### サーバーの起動

```bash
# 開発モード（自動再起動あり）
npm run dev

# 本番モード
npm start
```

### curl でテストする

```bash
# 1. タスクの一覧取得
curl http://localhost:3000/api/tasks

# 2. タスクの作成
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"New task"}'

# 3. タスクの詳細取得
curl http://localhost:3000/api/tasks/1

# 4. タスクの更新
curl -X PUT http://localhost:3000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# 5. タスクの削除
curl -X DELETE http://localhost:3000/api/tasks/1
```

---

## 発展アイデア

### 1. 検索とフィルタリング

```javascript
// GET /api/tasks?completed=false
router.get('/', async (req, res, next) => {
  try {
    let tasks = await readTasks()

    if (req.query.completed !== undefined) {
      const completed = req.query.completed === 'true'
      tasks = tasks.filter(t => t.completed === completed)
    }

    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})
```

### 2. ソート

```javascript
// GET /api/tasks?sort=createdAt&order=desc
router.get('/', async (req, res, next) => {
  try {
    let tasks = await readTasks()
    const { sort = 'id', order = 'asc' } = req.query
    tasks.sort((a, b) => {
      const aVal = a[sort]
      const bVal = b[sort]
      return order === 'asc' ? aVal > bVal ? 1 : -1 : aVal < bVal ? 1 : -1
    })
    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})
```

### 3. ページネーション

```javascript
// GET /api/tasks?page=1&limit=10
router.get('/', async (req, res, next) => {
  try {
    const tasks = await readTasks()
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const startIndex = (page - 1) * limit
    const paginatedTasks = tasks.slice(startIndex, startIndex + limit)

    res.json({
      tasks: paginatedTasks,
      pagination: {
        page,
        limit,
        total: tasks.length,
        totalPages: Math.ceil(tasks.length / limit)
      }
    })
  } catch (error) {
    next(error)
  }
})
```

---

## まとめ

### このガイドで学んだこと

- ✅ Express を使った API の構築
- ✅ ルーティングとミドルウェア
- ✅ ファイルベースのデータ管理
- ✅ 非同期プログラミング（async/await）
- ✅ エラーハンドリング
- ✅ CRUD 操作

### 今後の学習ステップ

1. **データベース連携**：MongoDB、PostgreSQL など
2. **認証**：JWT、OAuth
3. **バリデーション**：Joi、express-validator
4. **テスト**：Jest、Supertest
5. **デプロイ**：Heroku、Render、AWS など

---

**前のガイド**：[05-async-programming.md](./05-async-programming.md)

**親ガイド**：[Node.js 開発 - SKILL.md](../../SKILL.md)

**おめでとうございます！** Node.js 開発の基礎をすべて学習しました。
