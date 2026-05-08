# Git → Jujutsu Migration

> This guide explains how to smoothly migrate from existing Git workflows to Jujutsu, providing a command reference table, co-located repo usage, and a step-by-step team adoption strategy.

## What You Will Learn

1. **Git → Jujutsu Command Reference Table** — Complete mapping of Jujutsu commands for everyday Git operations
2. **Co-located Repo in Practice** — Configuration and considerations for environments using both Git and Jujutsu
3. **Step-by-Step Migration Strategy** — Migration roadmap from personal use to team adoption
4. **Workflow Conversion in Practice** — Converting Feature Branch, Gitflow, Trunk-Based, and more to Jujutsu
5. **Migration Troubleshooting** — Common issues and resolution steps


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Jujutsu Advanced](./02-jujutsu-advanced.md)

---

## 1. Git → Jujutsu Command Reference Table

### 1.1 Basic Operations

| Git Command                       | Jujutsu Command                     | Notes                             |
|-----------------------------------|-------------------------------------|-----------------------------------|
| `git init`                        | `jj git init`                       | Use `--colocate` to coexist with existing git |
| `git clone URL`                   | `jj git clone URL`                  |                                   |
| `git status`                      | `jj status` / `jj st`              |                                   |
| `git diff`                        | `jj diff`                           | No staging concept                |
| `git diff --staged`               | (not needed)                        | Staging does not exist            |
| `git diff HEAD~3..HEAD`           | `jj diff -r @---..@`               | Range diff                        |
| `git log`                         | `jj log`                            | Graph display by default          |
| `git log --oneline`               | `jj log --no-graph`                |                                   |
| `git log -p`                      | `jj log -p`                         | Log with patches                  |
| `git show COMMIT`                 | `jj show REVISION`                  |                                   |
| `git blame FILE`                  | (use git blame in co-located)       | blame not implemented in jj       |
| `git bisect`                      | (use git bisect in co-located)      | bisect not implemented in jj      |

### 1.2 Recording Changes

| Git Command                       | Jujutsu Command                     | Notes                             |
|-----------------------------------|-------------------------------------|-----------------------------------|
| `git add FILE`                    | (not needed)                        | Automatically reflected in working copy |
| `git add .`                       | (not needed)                        | All changes are automatically tracked |
| `git add -p`                      | `jj split`                          | Split later instead               |
| `git commit -m "MSG"`             | `jj commit -m "MSG"`               | Shortcut for describe + new       |
| `git commit --amend`              | `jj describe -m "MSG"`             | Edit the working copy directly    |
| `git commit --amend --no-edit`    | (just edit the file)                | Automatically reflected in commit |
| `git reset HEAD FILE`             | `jj restore --from @- FILE`        |                                   |
| `git checkout -- FILE`            | `jj restore FILE`                   |                                   |
| `git stash`                       | (not needed)                        | Move to a new commit with jj new  |
| `git stash pop`                   | `jj edit CHANGE_ID`                | Return to the original commit     |
| `git stash list`                  | `jj log -r 'description("wip")'`  | Search for WIP commits            |
| `git clean -fd`                   | `jj restore`                        | Restore working copy to parent state |

### 1.3 Branch Operations

| Git Command                       | Jujutsu Command                     | Notes                             |
|-----------------------------------|-------------------------------------|-----------------------------------|
| `git branch NAME`                 | `jj bookmark create NAME`          |                                   |
| `git branch -d NAME`              | `jj bookmark delete NAME`          |                                   |
| `git branch -m OLD NEW`           | `jj bookmark rename OLD NEW`       |                                   |
| `git branch -a`                   | `jj bookmark list --all`           |                                   |
| `git branch --merged`             | `jj log -r 'bookmarks() & ::trunk()'` | Bookmarks merged into trunk    |
| `git checkout BRANCH`             | `jj new BRANCH`                    | Creates a new commit              |
| `git checkout -b NAME`            | `jj new && jj bookmark create NAME`|                                   |
| `git switch BRANCH`               | `jj new BRANCH`                    |                                   |
| `git switch -c NAME`              | `jj new main && jj bookmark create NAME` |                            |

### 1.4 History Operations

| Git Command                       | Jujutsu Command                     | Notes                             |
|-----------------------------------|-------------------------------------|-----------------------------------|
| `git rebase -i`                   | `jj rebase` / `jj squash` / `jj split` | Decomposed into individual operations |
| `git rebase main`                 | `jj rebase -d main`                |                                   |
| `git rebase --onto A B C`         | `jj rebase -r C -d A`              | More intuitive                    |
| `git cherry-pick COMMIT`          | `jj duplicate COMMIT`              | Equivalent to cherry-pick         |
| `git merge BRANCH`                | `jj new @ BRANCH`                  | Creates a merge commit            |
| `git merge --squash BRANCH`       | `jj new @ BRANCH && jj squash`     | Squash merge                      |
| `git revert COMMIT`               | `jj backout -r COMMIT`             |                                   |
| `git reset --hard HEAD~1`         | `jj abandon @`                      |                                   |
| `git reset --soft HEAD~1`         | `jj squash --from @ --into @-`     | Move changes to parent            |
| `git reset --mixed HEAD~1`        | (Jujutsu has no staging concept)   |                                   |
| `git reflog`                      | `jj op log`                         | Operation Log                     |
| `git commit --fixup=COMMIT`       | `jj absorb`                         | Auto-distribution                 |

### 1.5 Remote Operations

| Git Command                       | Jujutsu Command                     | Notes                             |
|-----------------------------------|-------------------------------------|-----------------------------------|
| `git fetch`                       | `jj git fetch`                      |                                   |
| `git fetch --all`                 | `jj git fetch --all-remotes`       |                                   |
| `git pull`                        | `jj git fetch && jj rebase -d main@origin` | pull = fetch + rebase    |
| `git pull --rebase`               | `jj git fetch && jj rebase -d main@origin` | Same (rebase by default)  |
| `git push`                        | `jj git push`                       |                                   |
| `git push -u origin BRANCH`       | `jj git push --bookmark NAME --allow-new` |                          |
| `git push --force-with-lease`     | `jj git push`                       | Force push judgment is automatic  |
| `git push --delete origin BRANCH` | `jj bookmark delete NAME && jj git push --deleted` |              |
| `git remote add NAME URL`         | `jj git remote add NAME URL`       |                                   |
| `git remote -v`                   | `jj git remote list`               |                                   |
| `git remote set-url NAME URL`     | `jj git remote set-url NAME URL`   |                                   |

### 1.6 Other Operations

| Git Command                       | Jujutsu Command                     | Notes                             |
|-----------------------------------|-------------------------------------|-----------------------------------|
| `git tag v1.0`                    | (use git tag in co-located)         | Tag creation from jj has limitations |
| `git tag -a v1.0 -m "MSG"`       | (use git tag in co-located)         |                                   |
| `git grep "pattern"`              | `jj file grep "pattern"` (planned) | Use git grep in co-located        |
| `git log -S "code"`              | (use git log in co-located)        | Pickaxe search                    |
| `git worktree add PATH`          | (not supported)                     |                                   |
| `git submodule update`           | (use git submodule in co-located)  | Use Git submodule directly        |
| `git lfs pull`                    | (use git lfs in co-located)        |                                   |

---

## 2. Concept Mapping

### 2.1 Comparison of Basic Concepts

```
┌─────────────────────────────────────────────────────┐
│  Git と Jujutsu の概念マッピング                     │
│                                                     │
│  Git                    Jujutsu                     │
│  ─────────────────────  ─────────────────────       │
│  working directory   →  working copy (= commit)     │
│  staging area (index)→  (存在しない)                 │
│  commit              →  change / commit             │
│  commit SHA          →  commit ID + change ID       │
│  branch              →  bookmark                    │
│  HEAD                →  @ (working copy)            │
│  detached HEAD       →  (通常状態)                   │
│  reflog              →  operation log               │
│  stash               →  (不要、全てcommit)          │
│  cherry-pick         →  duplicate / restore         │
│  rebase -i           →  squash, split, rebase       │
│  commit --amend      →  edit / describe             │
│  commit --fixup      →  absorb                      │
│  tag                 →  tag (Git互換)               │
│  submodule           →  (Git submoduleを使用)       │
│  hook                →  (未実装、Git hookを使用)    │
│  .gitignore          →  .gitignore (共有)           │
│  .gitattributes      →  .gitattributes (共有)       │
└─────────────────────────────────────────────────────┘
```

### 2.2 Difference in Mental Models

```
┌─────────────────────────────────────────────────────┐
│  メンタルモデルの違い                                │
│                                                     │
│  Git:                                               │
│  "変更をステージしてコミットする"                    │
│                                                     │
│  file edit → git add → git commit → git push        │
│  (4ステップ)                                        │
│                                                     │
│  Jujutsu:                                           │
│  "常にコミットの上で作業している"                    │
│                                                     │
│  file edit → jj describe → jj new → jj git push    │
│  (file editは自動的にcommitに反映)                  │
│  (3ステップ、実質的にはdescribeとnewだけ)           │
└─────────────────────────────────────────────────────┘
```

### 2.3 Essential Workflow Differences

```
┌──────────────────────────────────────────────────────┐
│  Git のワークフロー                                   │
│                                                      │
│  作業ディレクトリ                                     │
│       │                                              │
│       ▼  git add (選択的にステージ)                   │
│  ステージングエリア                                   │
│       │                                              │
│       ▼  git commit (スナップショット作成)            │
│  ローカルリポジトリ                                   │
│       │                                              │
│       ▼  git push                                    │
│  リモートリポジトリ                                   │
│                                                      │
│  特徴:                                               │
│  - ステージングで「何をコミットするか」を制御        │
│  - コミットは明示的な操作                            │
│  - 未コミットの変更は消失リスクがある                │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Jujutsu のワークフロー                               │
│                                                      │
│  ファイル編集 → 自動的にworking copy commitに反映    │
│       │                                              │
│       ▼  jj describe (メッセージを設定)              │
│  working copy commit（常にcommitの上で作業）          │
│       │                                              │
│       ▼  jj new (次のcommitに移動)                   │
│  commitチェーン（自動的にDAGに組み込み）              │
│       │                                              │
│       ▼  jj git push                                 │
│  リモートリポジトリ                                   │
│                                                      │
│  特徴:                                               │
│  - ステージングが不要                                │
│  - ファイル保存 = 自動的にcommitに含まれる           │
│  - 後から「分割」(split)で粒度を調整可能            │
│  - 全変更が常にcommitに記録され、消失リスクが低い   │
└──────────────────────────────────────────────────────┘
```

### 2.4 Difference in ID Systems

```
┌──────────────────────────────────────────────────────┐
│  Git: commit SHA（コミットID）                        │
│  - コンテンツアドレス（内容から決定）                 │
│  - rebaseするとSHAが変わる                           │
│  - 参照はrefで管理（HEAD, branch, tag）              │
│                                                      │
│  commit A (sha: abc123)                              │
│       ↓ rebase                                       │
│  commit A' (sha: def456) ← SHAが変わる              │
│                                                      │
├──────────────────────────────────────────────────────┤
│  Jujutsu: commit ID + change ID                      │
│  - commit ID: Gitと同じSHA（rebaseで変わる）         │
│  - change ID: 論理的な変更の識別子（rebaseで不変）   │
│                                                      │
│  commit A (commit-id: abc123, change-id: rlvkpntz)  │
│       ↓ rebase                                       │
│  commit A' (commit-id: def456, change-id: rlvkpntz) │
│                      ↑ 変わる         ↑ 不変        │
│                                                      │
│  利点:                                               │
│  - rebase後もchange IDで同じ変更を参照できる         │
│  - スタックドPRでbase変更後もIDが維持される          │
│  - 「この変更」という概念が安定して追跡可能          │
└──────────────────────────────────────────────────────┘
```

---

## 3. Co-located Repo Configuration and Usage

### 3.1 Setup in an Existing Repository

```bash
# Step 1: 既存のGitリポジトリでJujutsuを初期化
$ cd my-git-project
$ jj git init --colocate
Initialized repo in "."

# Step 2: 状態の確認
$ jj log
@  rlvkpntz gaku@example.com 2025-02-11 abc12345
│  (empty) (no description set)
○  qpvuntsm gaku@example.com 2025-02-10 def67890
│  feat: latest commit
◆  zzzzzzzz root() 00000000

# Step 3: .gitignoreにjjのファイルを追加（通常は不要、.jjは自動でignore）

# Step 4: 設定の確認
$ jj config list
# → user.name, user.email等が表示される

# Gitの設定からユーザー情報を自動取得
# → git config のuser.name/emailがデフォルトで使われる
```

### 3.2 Creating a New Repository

```bash
# 方法1: jjで新規作成（co-located）
$ jj git init --colocate my-project
$ cd my-project

# 方法2: git cloneしてからjjを追加
$ git clone https://github.com/user/repo.git
$ cd repo
$ jj git init --colocate

# 方法3: jj git clone（自動的にco-located）
$ jj git clone https://github.com/user/repo.git
$ cd repo
# → .git/ と .jj/ の両方が存在する

# 方法4: jjのみのリポジトリ（co-locatedではない）
$ jj git init my-project
$ cd my-project
# → .jj/ のみ、.git/ は .jj/repo/store/git/ 内に隠蔽
# → git コマンドは使えない（推奨しない移行時は）
```

### 3.3 Directory Structure

```
my-project/
├── .git/                    ← Git のデータ
│   ├── objects/
│   ├── refs/
│   └── ...
├── .jj/                     ← Jujutsu のメタデータ
│   ├── repo/
│   │   ├── store/
│   │   │   └── git_target   ← "../../../.git" へのパス
│   │   ├── op_store/        ← Operation Log
│   │   └── op_heads/
│   └── working_copy/
├── .gitignore
├── src/
└── ...
```

### 3.4 Considerations When Coexisting

```bash
# gitコマンドを使った後にjjの状態を同期
$ git fetch origin
$ jj git import        # git→jj のref同期（通常は自動）

# jjコマンドを使った後にgitの状態を同期
$ jj git export        # jj→git のref同期（通常は自動）

# 同期の確認
$ jj git import && jj git export
```

| Operation                        | Auto Sync | When Manual Sync Is Needed                        |
|----------------------------------|-----------|---------------------------------------------------|
| After `jj` command               | Yes       | -                                                 |
| After `git fetch`                | Yes       | Auto-imported on next jj command execution        |
| After `git commit`               | Yes       | Auto-imported on next jj command execution        |
| After `git rebase`               | Caution   | `jj git import` is safer                          |
| After `git reset --hard`         | Caution   | `jj git import` recommended                       |
| After `git merge`                | Yes       | Auto-imported on next jj command execution        |
| After `git stash`                | Partial   | Stash is not visible from jj                      |

### 3.5 Safe Git Commands in a Co-located Repo

```bash
# 安全に使えるGitコマンド（jjとの不整合が起きにくい）
$ git status           # 状態確認（読み取り専用）
$ git log              # ログ確認（読み取り専用）
$ git diff             # 差分確認（読み取り専用）
$ git blame            # blame確認（読み取り専用）
$ git bisect           # bisect（読み取り専用の調査）
$ git grep             # ファイル内検索（読み取り専用）
$ git fetch            # fetch（jjが自動importする）
$ git stash            # stash（jjからは見えない）
$ git tag              # タグ作成（jjが自動importする）

# 注意が必要なGitコマンド（jjのOperation Logと不整合の可能性）
$ git commit           # → jj commit を推奨
$ git rebase           # → jj rebase を推奨
$ git merge            # → jj new @ BRANCH を推奨
$ git reset            # → jj abandon / jj undo を推奨
$ git checkout -b      # → jj new + jj bookmark create を推奨
$ git push --force     # → jj git push を推奨
```

---

## 4. Step-by-Step Migration Strategy

### 4.1 Phase 1: Personal Trial (1–2 Weeks)

```bash
# 既存プロジェクトにco-locatedで導入
$ cd my-project
$ jj git init --colocate

# 日常作業をjjで行ってみる
$ jj new main
$ vim src/feature.js
$ jj describe -m "feat: 新機能"
$ jj new
$ jj git push --bookmark feature --allow-new
```

```
┌────────────────────────────────────────────────────┐
│  Phase 1 の目標                                     │
│                                                    │
│  - jj log, jj status, jj diff を使いこなす         │
│  - jj new, jj describe のリズムを掴む              │
│  - jj git push/fetch の動作を理解                  │
│  - 困ったら git に戻れることを確認                  │
│                                                    │
│  この段階では Git コマンドに戻ることを許容          │
│                                                    │
│  チェックリスト:                                    │
│  □ jj log で履歴が読める                           │
│  □ jj new + describe で日常のcommitができる        │
│  □ jj git push でリモートにpushできる              │
│  □ jj undo で操作を取り消せる                      │
│  □ jj git fetch で最新を取得できる                 │
└────────────────────────────────────────────────────┘
```

### 4.2 Phase 2: Using Advanced Features (2–4 Weeks)

```bash
# jj edit による過去commit の直接編集
$ jj edit <change-id>
$ vim src/auth.js
$ jj new

# jj squash / jj split によるcommit整理
$ jj squash
$ jj split src/auth.js src/api.js

# revset クエリの活用
$ jj log -r 'mine() & (main..)'

# jj absorb の活用
$ jj absorb

# スタックドPRの作成
$ jj new main
$ vim src/types.ts
$ jj describe -m "feat: types"
$ jj bookmark create pr/types -r @
$ jj new
$ vim src/auth.ts
$ jj describe -m "feat: auth"
$ jj bookmark create pr/auth -r @
$ jj git push --bookmark pr/types --allow-new
$ jj git push --bookmark pr/auth --allow-new
```

```
┌────────────────────────────────────────────────────┐
│  Phase 2 の目標                                     │
│                                                    │
│  - jj edit で過去commitを直接修正できる             │
│  - jj squash / jj split でcommitを整理できる       │
│  - revset で複雑なクエリを書ける                    │
│  - jj absorb で効率的に修正を振り分けられる        │
│  - スタックドPRのワークフローを実践できる           │
│  - Operation Log (jj op log) を活用できる          │
│                                                    │
│  チェックリスト:                                    │
│  □ jj edit で中間commitを修正できる                │
│  □ jj squash で不要なcommitを統合できる            │
│  □ jj split で大きなcommitを分割できる             │
│  □ revset でフィルタリングできる                   │
│  □ jj absorb で修正を自動振り分けできる            │
│  □ jj op log / jj undo を活用できる               │
└────────────────────────────────────────────────────┘
```

### 4.3 Phase 3: Introducing to the Team (4–8 Weeks)

```bash
# チーム共有の設定ファイル
# .jj/repo/config.toml (リポジトリレベル設定)
[revset-aliases]
'immutable_heads()' = 'trunk() | tags()'
```

```
┌────────────────────────────────────────────────────┐
│  チーム導入のポイント                               │
│                                                    │
│  1. co-located repo なので既存の Git ユーザーに     │
│     影響を与えない                                 │
│                                                    │
│  2. jj ユーザーと git ユーザーが同じリポジトリで    │
│     並行して作業できる                             │
│                                                    │
│  3. リモート(GitHub/GitLab)は Git 互換なので       │
│     サーバー側の変更は不要                          │
│                                                    │
│  4. PR/MR のワークフローはそのまま維持             │
│                                                    │
│  5. CI/CD パイプラインの変更も不要                  │
│                                                    │
│  6. Git hookは co-located repoで引き続き動作       │
│                                                    │
│  7. IDE (VS Code, IntelliJ等) のGit統合も維持      │
└────────────────────────────────────────────────────┘
```

### 4.4 Phase 4: Mature Team Operation (8+ Weeks)

```toml
# チーム共有の.jj/repo/config.toml
[revset-aliases]
# 保護するcommit
'immutable_heads()' = 'trunk() | tags() | bookmarks("release-")'

# よく使うrevset
'unpushed()' = 'mine() ~ ::remote_bookmarks()'
'review_ready()' = 'bookmarks() & mine() ~ empty() ~ conflict()'
'stale()' = 'bookmarks() & committer_date(before:"30 days ago")'
```

```bash
# チーム運用のベストプラクティス

# 1. ブックマーク命名規則
$ jj bookmark create feature/AUTH-123-login -r @
$ jj bookmark create fix/BUG-456-null-check -r @
$ jj bookmark create chore/update-deps -r @

# 2. コミットメッセージ規則（Conventional Commits）
$ jj describe -m "feat(auth): ログイン機能を追加

Refs: AUTH-123"

# 3. PRの作成フロー
$ jj git push --bookmark feature/AUTH-123-login --allow-new
# → GitHub CLIでPR作成
$ gh pr create --base main --head feature/AUTH-123-login

# 4. PRマージ後のクリーンアップ
$ jj git fetch
$ jj bookmark delete feature/AUTH-123-login
$ jj git push --deleted
```

---

## 5. Practice: Converting Common Git Workflows to Jujutsu

### 5.1 Feature Branch Workflow

```bash
# Git:
$ git checkout -b feature/auth main
$ vim src/auth.js
$ git add . && git commit -m "feat: 認証"
$ git push -u origin feature/auth
# PRを作成

# Jujutsu:
$ jj new main
$ vim src/auth.js
$ jj describe -m "feat: 認証"
$ jj bookmark create feature/auth -r @
$ jj git push --bookmark feature/auth --allow-new
# PRを作成（GitHub CLIまたはWeb UI）

# レビュー指摘への対応（Git）:
$ git checkout feature/auth
$ vim src/auth.js
$ git add . && git commit -m "fix: レビュー指摘対応"
$ git push

# レビュー指摘への対応（Jujutsu）:
$ jj edit feature/auth      # 元のcommitを直接編集
$ vim src/auth.js            # 修正
$ jj git push --bookmark feature/auth  # 更新（force push相当が自動）
# → コミット履歴がクリーンに保たれる
```

### 5.2 Keeping Up with main (Rebase)

```bash
# Git:
$ git fetch origin
$ git checkout feature/auth
$ git rebase origin/main
# コンフリクト解決...
$ git add .
$ git rebase --continue
# さらにコンフリクト解決...
$ git push --force-with-lease

# Jujutsu:
$ jj git fetch
$ jj rebase -d main@origin
# コンフリクトがあればcommitに記録（後で解決可）
$ jj resolve          # マージツールで解決
$ jj git push --bookmark feature/auth
# → force push相当が自動的に行われる

# コンフリクト解決の違い
# Git: rebase中にコンフリクトが発生すると中途半端な状態になる
#      → git rebase --abort で中断するか、解決して --continue
# jj: コンフリクトはcommitに記録されるので、いつでも解決可能
#     → 中途半端な状態にならない
#     → 他の作業をしてから後で解決することも可能
```

### 5.3 Editing Commits

```bash
# Git: 直前のcommitを修正
$ git commit --amend -m "fix: corrected message"

# Git: 3つ前のcommitを修正
$ git rebase -i HEAD~3
# → pick → edit に変更
# → 修正
$ git commit --amend
$ git rebase --continue

# Jujutsu: 直前のcommitを修正（メッセージ）
$ jj describe -m "fix: corrected message"

# Jujutsu: 任意のcommitを修正（内容）
$ jj edit <change-id>
$ vim src/auth.js
# → 保存するだけ、自動的にcommitに反映
# → 子commitが自動リベース（コンフリクトがあれば記録）
$ jj new   # working copyを先端に戻す

# Jujutsu: 修正をabsorbで自動振り分け
$ vim src/auth.js   # 修正
$ vim src/api.js    # 修正
$ jj absorb
# → 各行の修正が元のcommitに自動振り分け
```

### 5.4 Stash-Equivalent Operations

```bash
# Git:
$ git stash
$ git checkout another-branch
$ ... 作業 ...
$ git checkout original-branch
$ git stash pop

# Jujutsu:
# stashは不要 — 全てがcommitとして保存される

# 現在の作業にメモを付けて別の作業へ
$ jj describe -m "wip: ログイン画面の途中"
$ jj new main          # mainの上で新しい作業を開始
$ ... 作業 ...
$ jj edit <元のchange-id>  # 元の作業に戻る
# → stashは不要、全てがcommitとして保存されている

# 複数の「stash」を同時に管理
$ jj log -r 'description(regex:"^wip:")'
# → wip:で始まるcommitを一覧表示
# → jj edit で任意の作業に戻れる
```

### 5.5 Interactive Rebase Equivalent

```bash
# Git: git rebase -i HEAD~4
# pick abc Fix A
# squash def Fix B (Aに統合)
# pick ghi Feature C
# drop jkl Remove D

# Jujutsu: 個別の操作に分解
$ jj squash --from def --into abc    # BをAに統合
$ jj abandon jkl                      # Dを削除
# → 自動リベースで残りが整列

# Git: reorder commits
# git rebase -i → 行を並べ替え

# Jujutsu:
$ jj rebase -r ghi -d abc            # ghiをabcの直後に移動
# → 他のcommitは自動リベース

# Git: split a commit
# git rebase -i → edit → git reset HEAD~ → git add -p → git commit → git rebase --continue

# Jujutsu:
$ jj split -r <change-id>
# → 対話的に分割（1コマンドで完結）
```

### 5.6 Gitflow Workflow in Jujutsu

```bash
# Gitflow: develop → feature → develop → release → main

# Jujutsuでのマッピング:
# develop = develop ブックマーク
# feature = 個別のcommit/ブックマーク

# feature ブランチ開始
$ jj new develop
$ jj bookmark create feature/login -r @

# feature 作業
$ vim src/login.tsx
$ jj describe -m "feat: ログイン画面"

# develop にマージ
$ jj new develop feature/login    # マージcommitを作成
$ jj describe -m "merge: feature/login into develop"
$ jj bookmark set develop -r @

# release ブランチ
$ jj new develop
$ jj bookmark create release/1.0 -r @

# hotfix
$ jj new main
$ jj bookmark create hotfix/critical-fix -r @
$ vim src/fix.js
$ jj describe -m "hotfix: クリティカルな修正"

# mainとdevelopにマージ
$ jj new main hotfix/critical-fix
$ jj bookmark set main -r @
$ jj new develop hotfix/critical-fix
$ jj bookmark set develop -r @
```

### 5.7 Trunk-Based Development in Jujutsu

```bash
# Trunk-Based: mainに直接（短寿命ブランチで）

# 短寿命の作業ブランチ
$ jj new main
$ vim src/feature.js
$ jj describe -m "feat: 小さな機能追加"
$ jj bookmark create small-feature -r @
$ jj git push --bookmark small-feature --allow-new
# → PRを作成、レビュー後すぐにマージ

# スタックドPRで大きな変更を分割
$ jj new main
$ jj describe -m "refactor: 型定義の整理"
$ jj bookmark create pr/1-types -r @

$ jj new
$ jj describe -m "feat: 新しいAPI"
$ jj bookmark create pr/2-api -r @

$ jj new
$ jj describe -m "feat: UIの更新"
$ jj bookmark create pr/3-ui -r @

# 各PRを順番にレビュー＆マージ
$ jj git push --bookmark pr/1-types --allow-new
$ jj git push --bookmark pr/2-api --allow-new
$ jj git push --bookmark pr/3-ui --allow-new
```

---

## 6. Migration Troubleshooting

### 6.1 Common Issues and Solutions

```bash
# 問題1: jj と git の状態が不整合になった
$ jj git import    # git→jj の同期を強制
$ jj git export    # jj→git の同期を強制

# 問題2: jj git push で認証エラー
$ jj git remote set-url origin git@github.com:user/repo.git  # SSH化
# または
$ gh auth setup-git  # GitHub CLI のトークンを設定

# 問題3: working copy が予期しない状態になった
$ jj op log         # 操作履歴を確認
$ jj undo           # 直前の操作を取り消し
$ jj op restore <op-id>  # 特定の時点に復元

# 問題4: .jjを完全に削除してGitだけに戻りたい
$ rm -rf .jj
$ git checkout .    # working copyをGitの状態に復元

# 問題5: jj git fetch でエラー
# "unexpected response from remote"
$ jj git remote set-url origin git@github.com:user/repo.git
# SSH鍵の問題:
$ ssh -T git@github.com  # SSH接続テスト
$ eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519

# 問題6: co-located repoでGitコマンドがworking copyを変更した
$ jj git import    # gitの変更をjjに取り込む
# それでも不整合な場合:
$ jj workspace update-stale   # working copyの状態を更新
```

### 6.2 Differences in Conflict Resolution

```bash
# Git: rebase中のコンフリクト
$ git rebase main
# CONFLICT (content): Merge conflict in src/auth.js
# → 中途半端な状態（"rebase in progress"）
# → 解決してgit add → git rebase --continue
# → または git rebase --abort で中断

# Jujutsu: rebase時のコンフリクト
$ jj rebase -d main
# → コンフリクトはcommitに記録される
# → 中途半端な状態にはならない
# → jj status でコンフリクトの状態を確認
$ jj status
# Working copy changes:
# C src/auth.js  (conflict)

# コンフリクトの解決
$ jj resolve src/auth.js
# → マージツールが起動
# → 解決するとコンフリクトマーカーが消える

# または手動で解決
$ vim src/auth.js
# → コンフリクトマーカーを削除
# → 保存するだけでコンフリクトが解消される

# コンフリクトを含むcommitの上に作業を続けることも可能
# → 後で解決すればよい
$ jj new    # コンフリクトを放置して次の作業へ
$ ... 別の作業 ...
$ jj edit <conflict-commit>   # 後でコンフリクトを解決
$ vim src/auth.js
```

### 6.3 Considerations for Large Repositories

```bash
# 大規模リポジトリでのパフォーマンス
# 1. watchmanの有効化
$ jj config set --user core.watchman.register-snapshot-trigger true

# 2. fsmonitorの設定
$ jj config set --user core.fsmonitor "watchman"

# 3. デフォルトrevsetの制限
$ jj config set --user ui.default-revset 'ancestors(heads(all()), 10)'
# → ログ表示を最新10世代に制限

# 4. .gitignoreの最適化
# → 不要なファイル（node_modules, build/等）を確実にignore
# → jjのworking copy snapshotが高速化される

# 5. 大規模なバイナリファイル
# → Git LFS を使用（co-located repoでgit lfsコマンドを使用）
$ git lfs install
$ git lfs track "*.psd"
```

---

## 7. IDE Integration

### 7.1 VS Code

```bash
# co-located repoではVS CodeのGit統合がそのまま使える
# → Source Control パネルでdiff、commit、pushが可能
# → ただし、jjのworking copy概念と少しズレがある

# 推奨設定:
# 1. VS CodeのTerminalでjjコマンドを使用
# 2. Source Control パネルはdiff確認用として使用
# 3. commit/pushはjjコマンドで実行

# VS Code拡張（存在する場合）
# → "Jujutsu" 拡張を検索してインストール

# settings.json
{
  "git.enabled": true,
  "git.autofetch": true,
  // jjのworking copyと競合しないよう設定
  "git.autoStash": false,
  "git.confirmSync": true
}
```

### 7.2 IntelliJ IDEA / JetBrains

```bash
# co-located repoではIntelliJのGit統合がそのまま使える
# → Version Control ツールウィンドウでdiff、log確認
# → ただしcommitはjjコマンドで行うのが安全

# 推奨設定:
# 1. IntelliJのTerminalでjjコマンドを使用
# 2. VCS操作はdiff/blame/log確認用として使用
# 3. commit/push/rebaseはjjコマンドで実行
```

### 7.3 lazyjj (TUI Tool)

```bash
# lazyjjのインストール
$ cargo install lazyjj

# 使用
$ lazyjj
# → lazygit風のTUIでjjの操作ができる
# → log表示、diff、describe、new、squash等が視覚的に操作可能

# キーバインド
# j/k: 上下移動
# Enter: 詳細表示
# d: diff表示
# n: jj new
# e: jj edit
# s: jj squash
# q: 終了
```

---

## 8. Cheat Sheet

### 8.1 Quick Reference for Daily Operations

```bash
# === 朝一番の同期 ===
$ jj git fetch                    # リモートの最新を取得
$ jj rebase -d main@origin        # mainに追従

# === 新しい作業の開始 ===
$ jj new main                     # mainから新しい変更を開始
$ jj describe -m "feat: 機能名"   # メッセージを設定

# === ファイル編集中 ===
$ vim src/feature.ts               # 編集（自動的にcommitに反映）
$ jj status                        # 状態確認
$ jj diff                          # 差分確認

# === 変更の確定と次の作業 ===
$ jj describe -m "feat: 完成した機能" # メッセージ確定
$ jj new                           # 次のcommitに移動

# === PRの作成 ===
$ jj bookmark create feature-x -r @-  # 直前のcommitにブックマーク
$ jj git push --bookmark feature-x --allow-new

# === 過去のcommitを修正 ===
$ jj edit <change-id>              # 過去のcommitに移動
$ vim src/fix.ts                    # 修正
$ jj new                           # 先端に戻る

# === 操作の取り消し ===
$ jj undo                          # 直前の操作を取り消し
$ jj op log                        # 操作履歴を確認
$ jj op restore <op-id>            # 特定時点に復元
```

### 8.2 Jujutsu Quick Reference for Git Users

```
┌──────────────────────────────────────────────────────┐
│  GitユーザーのためのJujutsu早見表                      │
│                                                      │
│  "ファイルを修正した":                                │
│  Git:  git add . && git commit -m "msg"              │
│  jj:   jj describe -m "msg"  (addは不要)             │
│                                                      │
│  "前のcommitに戻りたい":                              │
│  Git:  git reset --hard HEAD~1                       │
│  jj:   jj abandon @                                  │
│                                                      │
│  "ブランチを作りたい":                                │
│  Git:  git checkout -b new-branch                    │
│  jj:   jj new && jj bookmark create new-branch       │
│                                                      │
│  "他の人の変更を取り込みたい":                         │
│  Git:  git pull --rebase                             │
│  jj:   jj git fetch && jj rebase -d main@origin     │
│                                                      │
│  "push前にcommitを整理したい":                        │
│  Git:  git rebase -i HEAD~5                          │
│  jj:   jj squash / jj split / jj rebase             │
│                                                      │
│  "間違った操作を取り消したい":                         │
│  Git:  git reflog + git reset                        │
│  jj:   jj undo (一発で完了)                          │
│                                                      │
│  "PRのレビュー指摘に対応したい":                       │
│  Git:  git commit -m "fix: review" (commitが増える)   │
│  jj:   jj edit <commit> + 修正 (履歴がクリーン)      │
│                                                      │
│  "作業を一時的に中断したい":                           │
│  Git:  git stash                                     │
│  jj:   jj new main (作業は自動保存されている)        │
│                                                      │
│  "複数のPRを効率的に管理したい":                       │
│  Git:  複数ブランチの手動管理                        │
│  jj:   スタックドPR (自動リベースで連動)             │
└──────────────────────────────────────────────────────┘
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Mixing Destructive Git and Jujutsu Operations in a Co-located Repo

```bash
# NG: jjで作業した後にgit reset --hardする
$ jj new main
$ vim src/feature.js
$ jj describe -m "feat: new feature"
$ git reset --hard HEAD    # ← jjの変更が消失する可能性
# → jjのOperation Logと不整合が生じる

# OK: 一貫してjjコマンドを使う
$ jj undo                  # jjの操作取り消し
$ jj op restore <op-id>   # 特定時点への復元
```

**Reason**: In a co-located repo, jj and git share the same object store. Destructive git operations can cause inconsistencies with jj metadata such as the Operation Log.

### Anti-Pattern 2: Forcing the Entire Team to Switch to Jujutsu at Once

```bash
# NG: "来週からJujutsu必須です"
# → 学習コストが高く、生産性が一時的に大幅低下
# → Gitに戻したい人のモチベーション低下

# OK: co-located repoで段階的に導入
# Phase 1: 興味のあるメンバーから試用
# Phase 2: 成功事例を共有
# Phase 3: 公式にサポートするが強制しない
# → GitユーザーとJujutsuユーザーが共存可能
```

**Reason**: Jujutsu can be introduced without affecting Git users through co-located repos. Gradual migration rather than forced adoption is the most effective approach.

### Anti-Pattern 3: Looking for `jj add` Due to Git Habits

```bash
# NG: stagingの概念を持ち込む
$ vim src/auth.ts
$ jj add src/auth.ts   # ← このコマンドは存在しない

# OK: jjにはstagingがないことを理解する
$ vim src/auth.ts
# → 保存するだけで自動的にworking copy commitに含まれる
# → 特定のファイルだけcommitしたい場合はjj split
```

**Reason**: In Jujutsu's "always working on a commit" model, staging is unnecessary. Saving a file is immediately reflected in the commit. Granularity can be adjusted after the fact with split/squash.

### Anti-Pattern 4: Running `jj new` Without Checking Working Copy Changes

```bash
# NG: 意図しない変更が含まれたままnew
$ vim src/auth.ts
$ vim src/unrelated.ts   # 関係ないファイルも編集してしまった
$ jj new                  # ← 両方の変更が前のcommitに含まれる

# OK: statusを確認してから次へ進む
$ jj status               # 変更内容を確認
$ jj diff                 # 差分を確認
# 不要な変更を取り消す
$ jj restore --from @- src/unrelated.ts
$ jj new                  # クリーンな状態で次へ
```

**Reason**: Because jj has no staging, all file changes are included in the working copy commit. Check with `jj status`, undo unwanted changes with `jj restore`, or separate them later with `jj split`.

### Anti-Pattern 5: Trying to Push Without Creating a Bookmark

```bash
# NG: bookmarkなしでpush
$ jj new main
$ vim src/feature.ts
$ jj describe -m "feat: new feature"
$ jj git push             # ← pushするブックマークがない！

# OK: bookmarkを作成してからpush
$ jj bookmark create feature-x -r @
$ jj git push --bookmark feature-x --allow-new

# または --change で自動生成
$ jj git push --change @  # ← change IDからブックマーク名を自動生成
```

**Reason**: `jj git push` converts bookmarks to Git branches and pushes them. Commits without bookmarks are not push targets. Use `--change` to auto-generate, or explicitly create a bookmark.

### Anti-Pattern 6: Forgetting to Run `jj new` After `jj edit`

```bash
# NG: editしたまま作業を続ける
$ jj edit <old-change-id>    # 過去のcommitに移動
$ vim src/fix.ts              # 修正
$ vim src/new-feature.ts      # ← 新しい機能も追加（混在！）

# OK: 修正が終わったらjj newで先端に戻る
$ jj edit <old-change-id>    # 過去のcommitに移動
$ vim src/fix.ts              # 修正のみ
$ jj new                      # 先端に戻る
$ vim src/new-feature.ts      # 新しい機能は別のcommitで
```

**Reason**: When editing a past commit with `jj edit`, you should not add changes that go beyond that commit's scope. Once editing is complete, move to a new commit with `jj new`.

---

## 10. FAQ

### Q1. Will Git history be lost when migrating to Jujutsu?

**A1.** No, **nothing will be lost**. Jujutsu internally uses Git's object store, and in a co-located repo, `.git/` is maintained as-is. All commit history, tags, branches, and reflog are fully preserved.

```bash
# co-located repoの確認
$ ls -la .git/ .jj/
# → 両方が存在
$ git log --oneline -5
# → Gitの履歴がそのまま
$ jj log
# → 同じ履歴がjjからも見える
```

### Q2. Can the GitHub/GitLab PR workflow be used as-is?

**A2.** Yes, **it is fully compatible**. `jj git push` pushes to the remote as a Git branch, so GitHub/GitLab recognizes it as a normal Git branch. PR/MR creation, review, and merging work as usual.

```bash
# JujutsuでPRを作成するフロー
$ jj new main
$ vim src/feature.js
$ jj describe -m "feat: new feature"
$ jj bookmark create feature-branch -r @
$ jj git push --bookmark feature-branch --allow-new
# → GitHubでPRを作成（通常のGitと全く同じ）

# GitHub CLIを使ったPR作成
$ gh pr create --base main --head feature-branch --title "feat: new feature"
```

### Q3. Are there features still missing from Jujutsu compared to Git?

**A3.** As of 2025, the following features are unimplemented or limited compared to Git.

| Feature            | Status                            | Alternative                       |
|--------------------|-----------------------------------|-----------------------------------|
| `bisect`           | Not implemented                   | Use git bisect in co-located      |
| `blame`            | Not implemented                   | Use git blame in co-located       |
| hooks              | Not implemented                   | Use Git hooks in co-located       |
| submodule          | Partial support                   | Use Git submodule commands        |
| sparse checkout    | Not implemented                   | Use git sparse-checkout           |
| GUI tools          | Limited                           | lazyjj (TUI tool)                 |
| IDE integration    | Some IDEs being supported         | Use Git IDE integration in co-located |
| shallow clone      | Not implemented                   | Use git clone --depth             |
| LFS                | Partial                           | Use git lfs in co-located         |
| worktree           | Not supported                     | jj workspace (different concept)  |

### Q4. What are the most common points of confusion when starting with Jujutsu?

**A4.** The following three points are the most commonly reported areas of confusion.

```bash
# 混乱1: staging（git add）がない
# → ファイルを保存するだけで自動的にcommitに含まれる
# → 「特定のファイルだけcommitしたい」場合はjj split

# 混乱2: working copy = commit
# → Gitでは「未コミットの変更」が存在するが、jjでは常にcommitの上にいる
# → jj log で @ がworking copy commit
# → jj new で「次のcommitに移動」

# 混乱3: bookmark ≠ branch
# → Gitのbranchは「移動するポインタ」
# → jjのbookmarkも類似だが、自動追従はしない
# → commitを追加してもbookmarkは自動的に移動しない
# → jj bookmark set NAME -r @ で明示的に移動
```

### Q5. How do I revert to Git-only after using Jujutsu?

**A5.** For a co-located repo, simply delete the .jj directory.

```bash
# Jujutsuを完全に削除
$ rm -rf .jj

# Gitの状態を確認
$ git status
$ git log --oneline -5
# → Gitの履歴は完全に維持されている

# working copyの状態がおかしい場合
$ git checkout .
# → Gitの最新状態に復元
```

### Q6. What should I be careful about when upgrading jj?

**A6.** Jujutsu generally maintains compatibility between versions, but pay attention to the following.

```bash
# バージョン確認
$ jj --version

# アップグレード
$ cargo install jj-cli
# または
$ brew upgrade jj

# アップグレード後の注意
# - .jj/repo/ のフォーマットが変わる場合がある
# - jjが自動的にマイグレーションを行う
# - 問題がある場合は jj op log で確認して jj undo
```

### Q7. Can jj be used with a large monorepo?

**A7.** Yes, but performance configuration is important.

```bash
# watchmanの有効化（必須）
$ jj config set --user core.watchman.register-snapshot-trigger true
$ jj config set --user core.fsmonitor "watchman"

# revsetのデフォルトを制限
$ jj config set --user ui.default-revset 'ancestors(heads(all()), 10)'

# .gitignoreの最適化
# → node_modules, build, dist等を確実にignore
# → jjのsnapshot処理が高速化

# 注意: 数GBのリポジトリでも動作するが、
#       数十万ファイルの場合はwatchman必須
```

### Q8. When should I use jj vs. git?

**A8.** Use jj as the default, and use git commands in the following situations.

```bash
# gitを使うべきシーン（co-located repo）:
$ git blame src/auth.ts          # blameはgitで
$ git bisect start               # bisectはgitで
$ git grep "searchterm"           # ファイル内検索
$ git log -S "deleted_function"   # pickaxe検索
$ git stash                       # 一時退避（jjからは見えない）
$ git tag -a v1.0 -m "Release"    # アノテーションタグ
$ git lfs pull                    # LFSファイル取得
$ git submodule update             # サブモジュール更新

# jjを使うべきシーン:
$ jj new / jj describe / jj commit  # コミット操作
$ jj edit / jj squash / jj split    # 履歴の編集
$ jj rebase                          # リベース
$ jj absorb                          # 修正の自動振り分け
$ jj git push / jj git fetch         # リモート操作
$ jj undo / jj op restore            # 操作の取り消し
$ jj log -r '<revset>'              # 高度なログ検索
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Concept                | Key Point                                                     |
|------------------------|---------------------------------------------------------------|
| co-located repo        | .git/ and .jj/ coexist; both Git and Jujutsu can be used     |
| jj git init --colocate | Instantly add Jujutsu to an existing Git repository          |
| Command mapping        | git add → not needed, git commit → jj commit, git branch → jj bookmark |
| Mental model           | Shift from "stage → commit" to "always working on a commit"  |
| change ID              | Identifier that remains stable after rebase, independent of commit ID |
| Auto sync              | Sync with git happens automatically when jj commands are run |
| Gradual migration      | 4 phases: personal trial → advanced use → team introduction → mature team operation |
| undo                   | Safe restoration with jj undo / jj op restore                |
| Conflicts              | Recorded in commit, can be resolved later (no half-baked state) |
| Stacked PRs            | Efficiently manage dependent PRs, auto-rebased in sync       |
| IDE integration        | Git IDE integration works as-is with co-located repo         |

---

## Recommended Further Reading

- [Jujutsu Introduction](./00-jujutsu-introduction.md) — Review of basic concepts and design philosophy
- [Jujutsu Workflow](./01-jujutsu-workflow.md) — Practical use of change sets and auto-rebase
- [Jujutsu Advanced](./02-jujutsu-advanced.md) — revsets, templates, and Git integration

---

## References

1. **Jujutsu Official Documentation** — "Git comparison" https://martinvonz.github.io/jj/latest/git-comparison/
2. **Jujutsu Official Documentation** — "Git compatibility" https://martinvonz.github.io/jj/latest/git-compatibility/
3. **Jujutsu Official Documentation** — "Tutorial" https://martinvonz.github.io/jj/latest/tutorial/
4. **Steve Klabnik** — "jj init" (Migration experience from Git) https://steveklabnik.com/writing/jj-init
5. **Jujutsu GitHub Discussions** — Migration tips and tricks https://github.com/martinvonz/jj/discussions
6. **lazyjj** — TUI for Jujutsu https://github.com/Cretezy/lazyjj
