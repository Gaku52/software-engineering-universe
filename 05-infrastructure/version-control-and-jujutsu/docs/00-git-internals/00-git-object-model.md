# Git Object Model

> A thorough explanation of the four object types that underpin Git's internal structure (blob, tree, commit, tag) and the content-addressing mechanism based on SHA-1 hashes.

## What You Will Learn in This Chapter

1. The roles and relationships of **Git's four object types** (blob, tree, commit, tag)
2. How **content addressing via SHA-1 hashes** works and how immutability is guaranteed
3. The internal structure and operations of the **object database** (`.git/objects`)
4. Hands-on object manipulation using **low-level plumbing commands**
5. Object model behavior and optimization in **large repositories**
6. The background of the **SHA-256 migration** and its practical impact


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Git Is Snapshot-Based

While many VCSs store "deltas," Git stores **a full snapshot of the entire file tree at each point in time**. This design enables fast branch switching and merging.

```
┌─────────────────────────────────────────────────────┐
│          従来のVCS（差分ベース）                       │
│                                                     │
│  v1 ──── Δ1 ──── Δ2 ──── Δ3 ──── Δ4               │
│  (全体)  (差分)  (差分)  (差分)  (差分)              │
│                                                     │
│  → v4を得るには v1 + Δ1 + Δ2 + Δ3 + Δ4 を計算      │
├─────────────────────────────────────────────────────┤
│          Git（スナップショットベース）                 │
│                                                     │
│  S1 ──── S2 ──── S3 ──── S4 ──── S5               │
│  (全体)  (全体)  (全体)  (全体)  (全体)              │
│                                                     │
│  → 任意のバージョンに O(1) でアクセス可能            │
└─────────────────────────────────────────────────────┘
```

Note: Git also internally performs delta compression via packfiles (see "Packfile/GC" described later).

### 1.1 Detailed Operating Principle of the Snapshot Approach

Let's consider a concrete scenario to understand why Git can store snapshots efficiently.

```
プロジェクト構造:
├── README.md        (1KB)
├── src/
│   ├── main.js      (5KB)
│   ├── utils.js     (3KB)
│   └── config.js    (2KB)
└── package.json     (1KB)
```

If only `src/main.js` is changed and committed:

```
コミット1のtree:
  README.md   → blob:aaa111  (1KB)
  src/        → tree:bbb222
    main.js   → blob:ccc333  (5KB)  ← 変更前
    utils.js  → blob:ddd444  (3KB)
    config.js → blob:eee555  (2KB)
  package.json → blob:fff666 (1KB)

コミット2のtree:
  README.md   → blob:aaa111  (1KB)  ← 同じblob再利用
  src/        → tree:ggg777           ← 新しいtree（中身が変わったため）
    main.js   → blob:hhh888  (5KB)  ← 新しいblob
    utils.js  → blob:ddd444  (3KB)  ← 同じblob再利用
    config.js → blob:eee555  (2KB)  ← 同じblob再利用
  package.json → blob:fff666 (1KB)  ← 同じblob再利用
```

Only **two** new objects are created:
- A new blob for the modified `main.js`
- A new tree for the `src/` directory (because the reference to main.js changed)
- The root tree (because the reference to src/ changed)

Blobs for unchanged files are fully reused. This is why Git's snapshot approach is efficient.

### 1.2 Performance Comparison with Delta-Based VCS

```
操作                    | 差分ベースVCS  | Git（スナップショット）
─────────────────────────────────────────────────────────────
特定バージョンの取得     | O(n)          | O(1)
ブランチの切り替え       | O(n)          | O(変更ファイル数)
2つのバージョンの差分    | O(1)          | O(ファイル数)
マージ                  | O(n)          | O(変更ファイル数)
リポジトリサイズ（論理） | 小さい        | 大きい
リポジトリサイズ（実際） | 同程度        | 同程度（packfile圧縮後）
```

※ n is the number of versions. Delta-based VCSs require reconstruction from v1.

### 1.3 Handling Unchanged Files

A common misconception is that "Git makes a full copy of every file per commit," but this is not accurate.

```bash
# 実験: 同一内容のblob共有を確認する
$ mkdir /tmp/git-snapshot-test && cd /tmp/git-snapshot-test
$ git init

# 最初のコミット
$ echo "unchanged content" > stable.txt
$ echo "version 1" > changing.txt
$ git add -A && git commit -m "v1"

# 2回目のコミット（changing.txtだけ変更）
$ echo "version 2" > changing.txt
$ git add -A && git commit -m "v2"

# stable.txt のblobハッシュを両方のコミットで比較
$ git ls-tree HEAD~1 stable.txt
100644 blob 8c4e7a1b2c3d... stable.txt

$ git ls-tree HEAD stable.txt
100644 blob 8c4e7a1b2c3d... stable.txt
# → 同じハッシュ = 同じオブジェクト（コピーは作られていない）
```

---

## 2. The Four Object Types

### 2.1 blob (Binary Large Object)

Stores **the file content itself**. Does not include the filename or permissions.

```bash
# ファイルの内容からblobオブジェクトを作成
$ echo "Hello, Git!" | git hash-object -w --stdin
557db03de997c86a4a028e1ebd3a1ceb225be238

# blobの中身を確認
$ git cat-file -p 557db03
Hello, Git!

# オブジェクトの型を確認
$ git cat-file -t 557db03
blob
```

**Key property**: Files with the same content share the **same blob object**, even if their filenames differ.

```
┌──────────────────────────────────────────────┐
│  src/utils.js  ──┐                           │
│                  ├──→  blob: abc123...        │
│  lib/utils.js  ──┘     (同一内容なら同一blob)  │
│                                              │
│  README.md     ────→  blob: def456...        │
└──────────────────────────────────────────────┘
```

#### Internal Binary Structure of a blob

Let's look closely at how blob objects are stored on disk.

```
┌──────────────────────────────────────────────┐
│           blob オブジェクトの格納形式           │
├──────────────────────────────────────────────┤
│                                              │
│  zlib_compress(                              │
│    "blob"                    ← 型名          │
│    " "                       ← スペース      │
│    "12"                      ← バイトサイズ   │
│    "\0"                      ← NULLバイト    │
│    "Hello, Git!\n"           ← 実際の内容    │
│  )                                           │
│                                              │
│  → .git/objects/55/7db03de997c86...          │
│    ファイル名 = SHA-1ハッシュ                 │
│    先頭2文字がディレクトリ名                   │
└──────────────────────────────────────────────┘
```

```bash
# blobオブジェクトの生データを確認する
$ python3 -c "
import zlib, sys
with open('.git/objects/55/7db03de997c86a4a028e1ebd3a1ceb225be238', 'rb') as f:
    raw = zlib.decompress(f.read())
    print(repr(raw))
"
# b'blob 12\x00Hello, Git!\n'
```

#### Separation of blob and File Mode

The blob does not include file permissions or the filename. An example illustrating the importance of this design:

```bash
# 同じ内容のファイルに異なる権限を設定
$ echo "#!/bin/bash" > script.sh
$ chmod +x script.sh
$ cp script.sh library.sh
$ chmod -x library.sh

# 両方のファイルのblobハッシュを確認
$ git hash-object script.sh
# => abc123...
$ git hash-object library.sh
# => abc123...  ← 同じハッシュ！内容が同じだから

# tree内では異なるモードで参照される
$ git add -A && git commit -m "test"
$ git ls-tree HEAD
100755 blob abc123... script.sh    ← 実行可能
100644 blob abc123... library.sh   ← 通常ファイル
# 同じblobオブジェクトが異なるモードで参照されている
```

#### Empty File blob

```bash
# 空ファイルにもblobは作られる
$ touch empty.txt
$ git hash-object empty.txt
e69de29bb2d1d6434b8b29ae775ad8c2e48c5391

# このハッシュは全Gitリポジトリで共通
# 「空の内容」のSHA-1は常に同じ値になる
$ git cat-file -s e69de29
0
```

### 2.2 tree

Represents the directory structure. Each entry has a **mode, type, SHA-1, and filename**.

```bash
# 最新コミットのtreeを確認
$ git cat-file -p HEAD^{tree}
100644 blob 557db03de997c86a4a028e1ebd3a1ceb225be238    README.md
040000 tree 8f94139338f9404f26296befa88755fc2598c289    src
100755 blob a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0    run.sh
```

**Mode meanings**:

| Mode     | Meaning                        | Usage                          |
|----------|--------------------------------|--------------------------------|
| `100644` | Regular file                   | Text files, config files, etc. |
| `100755` | Executable file                | Scripts, binaries              |
| `120000` | Symbolic link                  | Link files                     |
| `040000` | Subdirectory (tree)            | Folder structure               |
| `160000` | Submodule (commit reference)   | External repository reference  |

#### Binary Format of a tree Object

While `git cat-file -p` displays a tree object in human-readable form, it is stored internally in binary format.

```
┌──────────────────────────────────────────────────────┐
│           tree オブジェクトの内部バイナリ形式           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  "tree <size>\0"                                     │
│  ┌───────────────────────────────────────────────┐   │
│  │ "100644 README.md\0" + <20バイトSHA-1バイナリ> │   │
│  │ "040000 src\0"       + <20バイトSHA-1バイナリ> │   │
│  │ "100755 run.sh\0"    + <20バイトSHA-1バイナリ> │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ※ エントリはファイル名のASCIIソート順で並ぶ          │
│  ※ SHA-1はhex文字列ではなく20バイトのバイナリ        │
└──────────────────────────────────────────────────────┘
```

```bash
# treeオブジェクトの生バイナリデータを解析
$ python3 -c "
import zlib, binascii
with open('.git/objects/8f/94139338f9404f26296befa88755fc2598c289', 'rb') as f:
    raw = zlib.decompress(f.read())
    # ヘッダーを除去
    null_idx = raw.index(b'\x00')
    header = raw[:null_idx].decode()
    print(f'Header: {header}')

    data = raw[null_idx+1:]
    pos = 0
    while pos < len(data):
        # モードとファイル名を読む
        space_idx = data.index(b' ', pos)
        mode = data[pos:space_idx].decode()
        null_idx = data.index(b'\x00', space_idx)
        name = data[space_idx+1:null_idx].decode()
        sha1 = binascii.hexlify(data[null_idx+1:null_idx+21]).decode()
        pos = null_idx + 21
        print(f'{mode} {sha1} {name}')
"
```

#### Structure of Nested trees

In a real project, trees nest recursively:

```
プロジェクト構造:
my-app/
├── package.json
├── src/
│   ├── index.ts
│   ├── components/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── utils/
│       └── format.ts
└── tests/
    └── format.test.ts

Gitオブジェクトの関係:

root tree (aaa111)
├── 100644 blob bbb222  package.json
├── 040000 tree ccc333  src
│   ├── 100644 blob ddd444  index.ts
│   ├── 040000 tree eee555  components
│   │   ├── 100644 blob fff666  Header.tsx
│   │   └── 100644 blob ggg777  Footer.tsx
│   └── 040000 tree hhh888  utils
│       └── 100644 blob iii999  format.ts
└── 040000 tree jjj000  tests
    └── 100644 blob kkk111  format.test.ts

合計: 5つのtreeオブジェクト + 6つのblobオブジェクト = 11オブジェクト
```

```bash
# 再帰的にtreeを展開して確認
$ git ls-tree -r HEAD
100644 blob bbb222... package.json
100644 blob ddd444... src/index.ts
100644 blob fff666... src/components/Header.tsx
100644 blob ggg777... src/components/Footer.tsx
100644 blob iii999... src/utils/format.ts
100644 blob kkk111... tests/format.test.ts

# treeも含めて表示
$ git ls-tree -r -t HEAD
040000 tree ccc333... src
040000 tree eee555... src/components
040000 tree hhh888... src/utils
040000 tree jjj000... tests
100644 blob bbb222... package.json
100644 blob ddd444... src/index.ts
# ... (以下略)
```

#### Empty Directories and Git

Git tree objects are not unable to reference an empty tree, but the `git add` command is designed not to track empty directories.

```bash
# 空ディレクトリはgit addできない
$ mkdir empty-dir
$ git add empty-dir
# → 何も追加されない

# 慣例的な解決策: .gitkeepファイルを配置
$ touch empty-dir/.gitkeep
$ git add empty-dir/.gitkeep
# → empty-dirがtreeとして追跡される

# 別の解決策: .gitignoreを使う
$ echo "*" > logs/.gitignore
$ echo "!.gitignore" >> logs/.gitignore
$ git add logs/.gitignore
```

### 2.3 commit

Links a snapshot to metadata.

```bash
$ git cat-file -p HEAD
tree 8f94139338f9404f26296befa88755fc2598c289
parent a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
author Gaku <gaku@example.com> 1707600000 +0900
committer Gaku <gaku@example.com> 1707600000 +0900

feat: ユーザー認証機能を追加
```

Components of a commit object:

```
┌─────────────────────────────────────┐
│         commit object               │
│                                     │
│  tree     → SHA-1 of root tree      │
│  parent   → SHA-1 of parent commit  │
│            （マージなら複数parent）   │
│  author   → creator + timestamp     │
│  committer→ applier + timestamp     │
│  message  → commit message          │
└─────────────────────────────────────┘
```

#### Difference Between author and committer

In most cases author and committer are the same person, but they can differ when using `git am` or `git cherry-pick`:

```bash
# パッチを適用した場合のcommitオブジェクト
$ git cat-file -p abc123
tree 8f94139338f9404f26296befa88755fc2598c289
parent def456789...
author Alice <alice@example.com> 1707500000 +0900
committer Bob <bob@example.com> 1707600000 +0900

fix: メモリリークを修正

# Alice がパッチを作成（author）
# Bob がそのパッチを適用（committer）
```

```bash
# cherry-pickの場合
$ git cherry-pick abc123
# → 新しいcommitが作成される
#   author = 元のcommitのauthor（Alice）
#   committer = cherry-pickを実行した人（Bob）

# rebaseの場合
$ git rebase main
# → 各commitが再作成される
#   author = 元のcommitのauthor（変更なし）
#   committer = rebaseを実行した人 + 現在の時刻
```

#### Timestamp Details

Git timestamps come in two formats:

```bash
# author date: 元のコードが書かれた日時
# committer date: commitオブジェクトが作成された日時

# 両方のタイムスタンプを確認
$ git log --format='author:    %ai%ncommitter: %ci%n' -3
author:    2024-02-11 10:30:00 +0900
committer: 2024-02-11 10:30:00 +0900

author:    2024-02-10 15:00:00 +0900
committer: 2024-02-11 09:00:00 +0900    ← rebase等で異なる

# author dateを指定してcommitする
$ GIT_AUTHOR_DATE="2024-01-01T00:00:00+0900" git commit -m "New Year commit"

# committer dateも指定する場合
$ GIT_AUTHOR_DATE="2024-01-01T00:00:00+0900" \
  GIT_COMMITTER_DATE="2024-01-01T00:00:00+0900" \
  git commit -m "New Year commit"
```

#### Types of Parent Commits

```
Initial commit (no parent):
┌──────────────┐
│ commit: aaa  │
│ tree: xxx    │
│ parent: none │  ← root commit
│ msg: "init"  │
└──────────────┘

Regular commit (one parent):
┌──────────────┐     ┌──────────────┐
│ commit: bbb  │────→│ commit: aaa  │
│ tree: yyy    │     │ tree: xxx    │
│ parent: aaa  │     │ parent: none │
│ msg: "feat"  │     │ msg: "init"  │
└──────────────┘     └──────────────┘

Merge commit (two parents):
┌──────────────┐
│ commit: ddd  │
│ tree: zzz    │
│ parent: bbb  │────→ 1st parent (merge target)
│ parent: ccc  │────→ 2nd parent (merge source)
│ msg: "Merge" │
└──────────────┘

Octopus merge (three or more parents):
┌──────────────┐
│ commit: fff  │
│ tree: www    │
│ parent: ccc  │────→ 1st parent
│ parent: ddd  │────→ 2nd parent
│ parent: eee  │────→ 3rd parent
│ msg: "Merge" │
└──────────────┘
```

```bash
# マージコミットの親を確認
$ git cat-file -p HEAD
tree 8f94139...
parent abc123...    ← 1st parent（マージ先ブランチの先頭）
parent def456...    ← 2nd parent（マージ元ブランチの先頭）

Merge branch 'feature/auth' into main

# 1st parentだけをたどる（マージ元を無視）
$ git log --first-parent

# オクトパスマージ（3つ以上のブランチを同時マージ）
$ git merge feature/a feature/b feature/c
# → parentが3つのcommitが作成される
```

#### GPG-Signed Commits

```bash
# 署名付きコミットの作成
$ git commit -S -m "Signed commit"

# 署名付きコミットのオブジェクト内容
$ git cat-file -p HEAD
tree abc123...
parent def456...
author Gaku <gaku@example.com> 1707600000 +0900
committer Gaku <gaku@example.com> 1707600000 +0900
gpgsig -----BEGIN PGP SIGNATURE-----

 iQIzBAABCAAdFiEE...
 ...
 -----END PGP SIGNATURE-----

feat: 署名付きリリース

# 署名の検証
$ git verify-commit HEAD
gpg: Signature made Mon Feb 12 10:00:00 2024 JST
gpg:                using RSA key ABC123...
gpg: Good signature from "Gaku <gaku@example.com>" [ultimate]
```

### 2.4 tag (Annotated Tag)

Assigns a name and metadata to a specific object (typically a commit).

```bash
# 注釈付きタグの作成
$ git tag -a v1.0.0 -m "Release version 1.0.0"

# タグオブジェクトの中身を確認
$ git cat-file -p v1.0.0
object a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
type commit
tag v1.0.0
tagger Gaku <gaku@example.com> 1707600000 +0900

Release version 1.0.0
```

**Lightweight tag vs. annotated tag**:

| Property          | Lightweight tag           | Annotated tag                 |
|-------------------|---------------------------|-------------------------------|
| Object creation   | None (ref only)           | Creates a tag object          |
| Message           | None                      | Yes                           |
| Signing           | Not possible              | GPG signing possible          |
| Recommended use   | Temporary marking         | Release tags                  |
| `git describe`    | Ignored by default        | Recognized                    |
| `git push`        | Must be specified explicitly | Same                       |

#### Objects That a tag Can Reference

A tag object normally references a commit, but it can reference any object type:

```bash
# commitを参照するタグ（最も一般的）
$ git tag -a v1.0.0 -m "Release v1.0.0" HEAD

# treeを参照するタグ（特定のディレクトリ状態をマーク）
$ git tag -a tree-snapshot -m "Snapshot of src/" HEAD^{tree}

# blobを参照するタグ（特定ファイルの特定バージョンをマーク）
$ BLOB_HASH=$(git rev-parse HEAD:README.md)
$ git tag -a readme-v1 -m "README v1" $BLOB_HASH

# 別のタグを参照するタグ（tag-of-tag、珍しい）
$ git tag -a meta-tag -m "Meta tag" v1.0.0
```

#### Detailed Internal Representation of Tags

```
Lightweight tag:
  .git/refs/tags/v1.0.0-light → "abc123def456..."（SHA-1 of the commit is written directly）

Annotated tag:
  .git/refs/tags/v1.0.0 → "xyz789..."（SHA-1 of the tag object）

  tag object (xyz789...):
    object abc123def456...    ← referenced commit
    type commit
    tag v1.0.0
    tagger Gaku <gaku@example.com> 1707600000 +0900

    Release version 1.0.0
```

```bash
# 軽量タグの中身（直接commitを指す）
$ git rev-parse v1.0.0-light
abc123def456...  ← commitのSHA-1

$ git cat-file -t v1.0.0-light
commit  ← 直接commitを指している

# 注釈付きタグの中身（tagオブジェクトを指す）
$ git rev-parse v1.0.0
xyz789...  ← tagオブジェクトのSHA-1

$ git cat-file -t v1.0.0
tag  ← tagオブジェクトを指している

# tagオブジェクトの先のcommitを取得
$ git rev-parse v1.0.0^{commit}
abc123def456...

# タグ一覧をオブジェクト型付きで表示
$ git for-each-ref --format='%(refname:short) %(objecttype) %(objectname:short)' refs/tags/
v1.0.0        tag    xyz789
v1.0.0-light  commit abc123
```

#### GPG-Signed Tags

```bash
# GPG署名付きタグの作成
$ git tag -s v1.0.0 -m "Signed release v1.0.0"

# 署名の検証
$ git verify-tag v1.0.0
gpg: Signature made Mon Feb 12 10:00:00 2024 JST
gpg: Good signature from "Gaku <gaku@example.com>"

# SSH鍵での署名（Git 2.34以降）
$ git config --global gpg.format ssh
$ git config --global user.signingkey ~/.ssh/id_ed25519.pub
$ git tag -s v2.0.0 -m "SSH-signed release"
```

---

## 3. SHA-1 Hashes and Content Addressing

### 3.1 How Hashes Are Calculated

Git object hashes are computed in the following format:

```
SHA-1( "<type> <size>\0<content>" )
```

```bash
# 手動でblobのハッシュを計算
$ echo -n "Hello, Git!" | python3 -c "
import hashlib, sys
content = sys.stdin.buffer.read()
header = f'blob {len(content)}\0'.encode()
print(hashlib.sha1(header + content).hexdigest())
"
557db03de997c86a4a028e1ebd3a1ceb225be238

# git hash-objectと同じ結果になる
$ echo -n "Hello, Git!" | git hash-object --stdin
557db03de997c86a4a028e1ebd3a1ceb225be238
```

#### Hash Calculation for Each Object Type

```bash
# blobのハッシュ計算
# SHA-1("blob <size>\0<file-content>")
$ echo -n "Hello, Git!" | git hash-object --stdin
557db03...

# treeのハッシュ計算
# SHA-1("tree <size>\0<binary-tree-entries>")
# treeのバイナリ形式は直接構築が複雑なため、git mktreeを使う
$ echo -e "100644 blob 557db03de997c86a4a028e1ebd3a1ceb225be238\tREADME.md" | git mktree
# => <tree-hash>

# commitのハッシュ計算
# SHA-1("commit <size>\0tree ...\nparent ...\nauthor ...\ncommitter ...\n\n<message>")
$ python3 -c "
import hashlib

commit_content = '''tree 8f94139338f9404f26296befa88755fc2598c289
parent a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
author Gaku <gaku@example.com> 1707600000 +0900
committer Gaku <gaku@example.com> 1707600000 +0900

feat: add user authentication
'''.encode()

header = f'commit {len(commit_content)}\0'.encode()
sha1 = hashlib.sha1(header + commit_content).hexdigest()
print(sha1)
"
```

### 3.2 Advantages of Content Addressing

Here is an organized summary of the concrete benefits that content addressing provides:

```
┌─────────────────────────────────────────────────────────┐
│         Five Benefits of Content Addressing             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. Automatic deduplication                              │
│    Same content → same hash → only one object needed    │
│                                                         │
│ 2. Guaranteed data integrity                            │
│    Hashes are derived from content, so tampering is     │
│    detected automatically; storage and network errors   │
│    are also detectable                                  │
│                                                         │
│ 3. Efficient comparison                                 │
│    Diff of two trees = determined by hash comparison    │
│    Same hash → same content (no comparison needed)      │
│                                                         │
│ 4. Immutability                                         │
│    Objects cannot be changed once created               │
│    "Modification" = creating a new object               │
│                                                         │
│ 5. Affinity with distributed processing                 │
│    The same content yields the same hash regardless of  │
│    who calculates it                                    │
│    → Data exchange between repositories is efficient    │
└─────────────────────────────────────────────────────────┘
```

```bash
# 実験: データ完全性の検証
$ git fsck
Checking object directories: 100%
Checking objects: 100%

# 手動でオブジェクトを破損させてみる
$ echo "corrupted" > .git/objects/55/7db03de997c86a4a028e1ebd3a1ceb225be238

$ git fsck
error: object file .git/objects/55/7db03... is empty or corrupted
missing blob 557db03de997c86a4a028e1ebd3a1ceb225be238
# → 即座に検出される
```

### 3.3 Migration to SHA-256

Since Git 2.42, SHA-256 has been available as an option.

```bash
# SHA-256を使用するリポジトリの作成
$ git init --object-format=sha256 my-repo
```

| Item            | SHA-1                          | SHA-256                    |
|-----------------|--------------------------------|----------------------------|
| Hash length     | 40 characters (160 bits)       | 64 characters (256 bits)   |
| Collision resistance | Theoretically broken      | Secure                     |
| Compatibility   | Supported by all Git tools     | Some tools not yet supported |
| Default         | Yes                            | No (opt-in)                |
| Performance     | Fast                           | Slightly slower (~10-20%)  |

#### SHA-256 Migration Details

```bash
# SHA-256リポジトリの作成と確認
$ git init --object-format=sha256 sha256-test
$ cd sha256-test

# ハッシュの長さを確認
$ echo "Hello" | git hash-object --stdin
# => 64文字のハッシュ（SHA-256）

# SHA-1リポジトリとの互換性に関する注意点
# 現時点では以下の制限がある:
# - SHA-1とSHA-256リポジトリ間のpush/pullは不可
# - GitHub, GitLabなどのホスティングサービスは未対応（2024年時点）
# - submoduleの参照に互換性の問題がある

# SHA-256リポジトリのオブジェクト形式を確認
$ git rev-parse --show-object-format
sha256
```

#### SHA-1 Collision Detection (sha1dc)

```bash
# Gitが使用しているSHA-1実装を確認
$ git version
git version 2.44.0

# Git 2.13以降、sha1dc（SHA-1 Collision Detection）が標準
# SHAttered攻撃パターンを検出して拒否する

# 衝突検出のデモンストレーション
# （実際の攻撃ファイルは配布されていないが、仕組みを理解する）
# sha1dcは計算中に衝突攻撃の特徴的なパターンを検出し、
# 検出した場合はハッシュ値を意図的に変更して衝突を回避する
```

### 3.4 Abbreviated Hashes and Ambiguity

```bash
# 短縮ハッシュの解決
$ git rev-parse --short HEAD
abc1234

# 短縮長の制御（デフォルトは動的）
$ git rev-parse --short=12 HEAD
abc1234def56

# 曖昧なハッシュの検出
$ git rev-parse --disambiguate=abc
abc1234def567890...
abc1235678901234...
# → 複数のオブジェクトがマッチする場合がある

# Relationship between number of objects in a repository and recommended abbreviated length
# Number of objects     Recommended length
# 1,000                 7 characters
# 100,000               8-9 characters
# 1,000,000             10 characters
# 10,000,000            11-12 characters

# Linuxカーネルリポジトリの場合
$ git -C /path/to/linux log --format='%h' -1
# => 12文字程度が使われる
```

---

## 4. Object Storage Structure

### 4.1 The .git/objects Directory

```
.git/objects/
├── 55/
│   └── 7db03de997c86a4a028e1ebd3a1ceb225be238   ← loose object
├── 8f/
│   └── 94139338f9404f26296befa88755fc2598c289
├── info/
│   └── packs                                      ← list of packfiles
└── pack/
    ├── pack-abc123...def456.idx    ← packfile index
    └── pack-abc123...def456.pack   ← packfile body
```

**Loose objects** are stored as individual files compressed with zlib. They are consolidated into packfiles after running `git gc`.

#### Detailed Storage Process for Loose Objects

```bash
# 1. 内容をzlib圧縮
$ python3 -c "
import zlib, hashlib

content = b'Hello, Git!\n'
header = f'blob {len(content)}\0'.encode()
store = header + content

# SHA-1ハッシュを計算
sha1 = hashlib.sha1(store).hexdigest()
print(f'SHA-1: {sha1}')
print(f'ディレクトリ: {sha1[:2]}/')
print(f'ファイル名: {sha1[2:]}')

# zlib圧縮
compressed = zlib.compress(store)
print(f'元のサイズ: {len(store)} bytes')
print(f'圧縮後サイズ: {len(compressed)} bytes')
print(f'圧縮率: {len(compressed)/len(store)*100:.1f}%')
"

# 2. .git/objects/<first 2 chars>/<remaining 38 chars> に保存
# Reason for using the first 2 characters as the directory name:
# - File system performance (many files in one directory is slow)
# - Distributed across 256 subdirectories
```

#### The info Directory and alternates

```bash
# alternatesファイル: 他のリポジトリのオブジェクトを参照する
$ cat .git/objects/info/alternates
/path/to/other/repo/.git/objects

# Usage example: shared object store in CI
# When building multiple branches of the same project,
# share common objects to reduce disk usage

$ git clone --reference /path/to/cached-repo https://github.com/org/repo.git
# → References objects from the cached repo, reducing network transfer
```

### 4.2 Reference Relationships Between Objects

```
                    ┌──────────┐
                    │  tag     │
                    │  v1.0.0  │
                    └────┬─────┘
                         │ object
                         ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│ commit   │◄─────│ commit   │◄─────│ commit   │
│ abc123   │parent│ def456   │parent│ 789abc   │
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │ tree             │ tree            │ tree
     ▼                  ▼                 ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│  tree    │      │  tree    │      │  tree    │
│ (root)   │      │ (root)   │      │ (root)   │
├──────────┤      ├──────────┤      ├──────────┤
│ README   │──┐   │ README   │──┐   │ README   │──→ blob
│ src/     │  │   │ src/     │  │   │ src/     │──→ tree
└──────────┘  │   └──────────┘  │   └──────────┘
              │                 │
              ▼                 ▼
           blob (shared if content is identical)
```

### 4.3 Object Reachability

In garbage collection, the "reachability" of objects is an important concept:

```
Reachable objects (retained by GC):
  refs/heads/main → commit → tree → blob
  refs/tags/v1.0  → tag → commit → tree → blob
  refs/remotes/origin/main → commit → ...
  refs/stash → commit → ...

Unreachable objects (may be deleted by GC):
  - Old commits before amend (after reflog expiry)
  - Commits discarded by reset
  - Old objects rewritten by filter-branch
  - Intermediate objects from aborted merges

Checking reachability:
$ git fsck --unreachable
unreachable blob abc123...
unreachable commit def456...
unreachable tree ghi789...

# Details of unreachable objects
$ git fsck --unreachable --no-reflogs
# → Shows only objects not referenced by reflog either
```

```bash
# 実験: オブジェクトの到達可能性を確認する

# 1. コミットを作成
$ echo "test" > file.txt
$ git add file.txt && git commit -m "test commit"

# 2. commitのハッシュを記録
$ OLD_COMMIT=$(git rev-parse HEAD)

# 3. 新しいコミットでamend
$ echo "test2" > file.txt
$ git add file.txt && git commit --amend -m "amended commit"

# 4. 古いコミットは到達不可能になる（reflogからは参照可能）
$ git cat-file -t $OLD_COMMIT
commit  # → まだ存在する

$ git fsck --unreachable
# → reflogがあるため「unreachable」とは表示されない

$ git fsck --unreachable --no-reflogs
unreachable commit $OLD_COMMIT
# → reflogを無視すると到達不可能

# 5. reflogの期限切れ後にGCで削除される
$ git reflog expire --expire=now --all
$ git gc --prune=now
$ git cat-file -t $OLD_COMMIT
fatal: Not a valid object name  # → 削除された
```

### 4.4 Object Compression Efficiency

```bash
# リポジトリのオブジェクト統計を確認
$ git count-objects -v
count: 43          ← number of loose objects
size: 128          ← total size of loose objects (KB)
in-pack: 12345     ← number of objects in packfiles
packs: 1           ← number of packfiles
size-pack: 4567    ← total size of packfiles (KB)
prune-packable: 0  ← number of loose objects also in packfiles
garbage: 0         ← number of invalid files
size-garbage: 0    ← size of invalid files (KB)

# 大きなオブジェクトを特定する
$ git rev-list --objects --all |
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
  sort -k3 -n -r |
  head -20
blob abc123... 5242880 assets/large-image.png
blob def456... 2097152 data/sample.csv
# ...
```

---

## 5. Practice: Manipulating Objects with Low-Level Commands

### 5.1 Manually Building from blob to commit

```bash
# 1. 空のリポジトリを作成
$ git init /tmp/manual-git-test && cd /tmp/manual-git-test

# 2. blobを作成
$ echo "console.log('hello');" | git hash-object -w --stdin
# => aabbcc11...

# 3. インデックスにエントリを追加
$ git update-index --add --cacheinfo 100644,aabbcc11...,main.js

# 4. treeを書き出す
$ git write-tree
# => ddeeff22...

# 5. commitを作成（親なし = 初回コミット）
$ echo "Initial commit" | git commit-tree ddeeff22...
# => 112233aa...

# 6. ブランチをcommitに向ける
$ git update-ref refs/heads/main 112233aa...

# 7. HEADをmainに向ける
$ git symbolic-ref HEAD refs/heads/main

# 8. 確認
$ git log --oneline
112233a Initial commit

$ git show HEAD:main.js
console.log('hello');
```

### 5.2 Manually Building Multi-File Directory Structures

```bash
# より複雑な構造を手動で構築する

# 1. 複数のblobを作成
$ echo '{ "name": "my-app" }' | git hash-object -w --stdin
# => pkg_hash...

$ echo 'export function add(a, b) { return a + b; }' | git hash-object -w --stdin
# => utils_hash...

$ echo 'import { add } from "./utils";' | git hash-object -w --stdin
# => main_hash...

$ echo '# My App' | git hash-object -w --stdin
# => readme_hash...

# 2. src/ ディレクトリのtreeを作成
$ printf '100644 blob %s\t%s\n' utils_hash utils.js main_hash main.js | git mktree
# => src_tree_hash...

# 3. ルートtreeを作成
$ printf '100644 blob %s\t%s\n040000 tree %s\t%s\n100644 blob %s\t%s\n' \
    pkg_hash package.json \
    src_tree_hash src \
    readme_hash README.md | git mktree
# => root_tree_hash...

# 4. commitを作成
$ echo "feat: initial project structure" | \
    GIT_AUTHOR_NAME="Gaku" GIT_AUTHOR_EMAIL="gaku@example.com" \
    GIT_COMMITTER_NAME="Gaku" GIT_COMMITTER_EMAIL="gaku@example.com" \
    git commit-tree root_tree_hash
# => commit_hash...

# 5. 確認
$ git cat-file -p root_tree_hash
100644 blob readme_hash    README.md
100644 blob pkg_hash       package.json
040000 tree src_tree_hash  src

$ git cat-file -p src_tree_hash
100644 blob main_hash      main.js
100644 blob utils_hash     utils.js
```

### 5.3 Manually Parsing tree Diffs

```bash
# 2つのtreeの差分を確認（git diff-treeの内部動作を理解する）
$ git diff-tree tree_hash_1 tree_hash_2
:100644 100644 old_blob new_blob M  src/main.js
:000000 100644 0000000 new_blob A  src/config.js
:100644 000000 old_blob 0000000 D  src/legacy.js

# Output format explanation:
# :old-mode new-mode old-hash new-hash status path
# Status:
#   A = Added
#   M = Modified
#   D = Deleted
#   R = Renamed
#   C = Copied
#   T = Type changed (e.g., file → symbolic link)

# リネーム検出付き
$ git diff-tree -M tree_hash_1 tree_hash_2
:100644 100644 abc123 abc123 R100  old-name.js  new-name.js
# R100 = 100% match rename (content is completely identical)
# R075 = 75% match rename (content is 75% identical)
```

### 5.4 Inspecting Objects

```bash
# 全オブジェクトの一覧（loose + packed）
$ git rev-list --all --objects

# 特定オブジェクトのサイズと型
$ git cat-file -s abc123    # size (bytes)
$ git cat-file -t abc123    # type

# オブジェクトのダンプ（デバッグ用）
$ git cat-file --batch-check --batch-all-objects

# Count objects by type
$ git cat-file --batch-check --batch-all-objects | \
    awk '{print $2}' | sort | uniq -c | sort -rn
  12345 blob
   3456 tree
   1234 commit
      5 tag
```

### 5.5 Verifying Object Existence and Integrity

```bash
# 特定のオブジェクトが存在するか確認
$ git cat-file -e abc123def456 && echo "exists" || echo "not found"

# リポジトリ全体の整合性チェック
$ git fsck --full
Checking object directories: 100%
Checking objects: 100%
Checking connectivity: 12345 objects reachable

# Strict check (detects more problems)
$ git fsck --strict
# Problems that would normally be warnings are reported as errors

# Check for dangling objects
$ git fsck --no-reflogs
dangling commit abc123...
dangling blob def456...
# dangling = objects not reachable from any reference

# Repair procedure (corrupted repository)
$ git fsck --full 2>&1 | grep "missing"
missing blob abc123...
# → Copy the object from another clone to repair
$ cp /path/to/backup/.git/objects/ab/c123... .git/objects/ab/c123...
```

---

## 6. Practical Scenarios: Applying the Object Model

### 6.1 Repository Size Analysis

```bash
# リポジトリサイズの詳細分析スクリプト
#!/bin/bash
echo "=== Repository Object Analysis ==="
echo ""

# 全体統計
echo "--- General Statistics ---"
git count-objects -vH
echo ""

# オブジェクト型別の統計
echo "--- Object Type Distribution ---"
git cat-file --batch-check --batch-all-objects 2>/dev/null | \
    awk '{
        type[$2]++
        size[$2] += $3
    }
    END {
        for (t in type) {
            printf "%-10s count: %6d  total_size: %s\n", t, type[t], size[t]
        }
    }'
echo ""

# 最大のblobオブジェクトTOP10
echo "--- Largest Blobs (TOP 10) ---"
git rev-list --objects --all | \
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
    grep '^blob' | \
    sort -k3 -n -r | \
    head -10 | \
    awk '{printf "%s  %10d bytes  %s\n", $2, $3, $4}'
echo ""

# コミット数の統計
echo "--- Commit Statistics ---"
echo "Total commits: $(git rev-list --all --count)"
echo "Merge commits: $(git rev-list --all --merges --count)"
echo "Authors: $(git shortlog -sn --all | wc -l)"
```

### 6.2 Tracking All History of a Specific File at the Object Level

```bash
# ファイルの各バージョンのblobハッシュを一覧表示
$ git log --follow --format="%H" -- src/config.ts | while read commit; do
    blob=$(git rev-parse "$commit:src/config.ts" 2>/dev/null)
    if [ $? -eq 0 ]; then
        size=$(git cat-file -s "$blob")
        date=$(git log -1 --format="%ai" "$commit")
        echo "$date  $blob  ${size}bytes"
    fi
done

# 出力例:
# 2024-02-11 10:30:00 +0900  abc123...  2048bytes
# 2024-02-10 15:00:00 +0900  def456...  1856bytes
# 2024-02-09 09:00:00 +0900  ghi789...  1024bytes

# 特定のバージョン間の差分を確認
$ git diff blob_hash_1 blob_hash_2
```

### 6.3 Submodules and the Object Model

```bash
# サブモジュールはtree内でモード160000として記録される
$ git ls-tree HEAD
100644 blob abc123... .gitmodules
160000 commit def456... libs/external-lib    ← submodule

# サブモジュールのcommitハッシュを確認
$ git ls-tree HEAD libs/external-lib
160000 commit def456... libs/external-lib
# → def456... is the commit hash of the submodule repository

# .gitmodulesファイルの内容
$ git cat-file -p HEAD:.gitmodules
[submodule "libs/external-lib"]
    path = libs/external-lib
    url = https://github.com/org/external-lib.git
```

### 6.4 Shallow Clone and the Object Model

```bash
# shallow clone: 履歴を制限してクローン
$ git clone --depth=1 https://github.com/org/repo.git
# → Only the latest commit and its tree/blobs are fetched

# shallow cloneのオブジェクト状態
$ git cat-file -p HEAD
tree abc123...
parent def456...     ← exists, but this commit object was not fetched
author ...

# Check the shallow boundary
$ cat .git/shallow
def456789...    ← history beyond this point is not available

# Fetch additional depth
$ git fetch --deepen=10
# → Fetches 10 more commits

# Fetch full history
$ git fetch --unshallow
# → Fetches all commits (the .git/shallow file is removed)
```

### 6.5 Replacing Objects with replace objects

```bash
# git replaceを使ってオブジェクトを「差し替え」る
# (The original object is not modified; a different object is returned on access)

# Use case 1: Fixing a commit message (without rewriting history)
$ git replace --edit HEAD
# → An editor opens, allowing you to edit the contents of the commit object
# → The new hash is recorded in .git/refs/replace/<original-hash>

# Use case 2: Grafting histories (graft point)
# Joining the histories of separate repositories
$ git replace --graft <commit> <new-parent>

# List replace objects
$ git replace -l

# Access the original, ignoring replacements
$ git --no-replace-objects cat-file -p HEAD

# Delete a replacement
$ git replace -d <original-hash>
```

---

## 7. Large Repositories and the Object Model

### 7.1 Object Count Explosion in Monorepos

```
Typical object counts for large monorepos:

Repository example        | Object count       | Size
─────────────────────────────────────────────────
Small OSS                 | 1,000 - 10,000     | 1-10 MB
Medium-scale web app      | 10,000 - 100,000   | 10-100 MB
Large monorepo            | 1,000,000+         | 1-10 GB
Linux kernel              | 8,000,000+         | 3+ GB
Chromium                  | 15,000,000+        | 10+ GB
```

```bash
# 大規模リポジトリの最適化設定
$ git config core.commitGraph true        # enable commit-graph
$ git config gc.writeCommitGraph true      # update commit-graph on GC
$ git config feature.manyFiles true        # optimizations for many files
$ git config core.untrackedCache true      # cache untracked files
$ git config core.fsmonitor true           # file system monitoring

# Generate commit-graph
$ git commit-graph write --reachable
# → A binary file is created in .git/objects/info/commit-graphs/
# → Greatly contributes to speeding up git log

# Verify commit-graph
$ git commit-graph verify
```

### 7.2 Partial Clone and Lazy Fetching of Objects

```bash
# blobless clone: blobを取得しない
$ git clone --filter=blob:none https://github.com/org/large-repo.git
# → Only commits + trees are fetched; blobs are fetched on-demand at checkout

# treeless clone: tree + blobを取得しない
$ git clone --filter=tree:0 https://github.com/org/large-repo.git
# → Only commits are fetched; trees/blobs are fetched when needed

# Size-limited clone: exclude blobs above a specified size
$ git clone --filter=blob:limit=1m https://github.com/org/large-repo.git
# → Blobs larger than 1MB are not fetched

# Check lazily-fetched objects
$ git rev-list --objects --all --missing=print | grep "^?"
?abc123...    ← unfetched objects
?def456...

# Explicitly fetch objects
$ git fetch origin --filter=blob:none
```

### 7.3 sparse-checkout and Its Relationship to Objects

```bash
# sparse-checkoutの設定
$ git sparse-checkout init --cone
$ git sparse-checkout set src/frontend

# Object fetching with sparse-checkout:
# → All tree objects are fetched, but
#   only blobs matching the sparse-checkout pattern are checked out
# → Combined with partial clone, unnecessary blobs are never fetched at all

$ git clone --filter=blob:none https://github.com/org/large-repo.git
$ cd large-repo
$ git sparse-checkout init --cone
$ git sparse-checkout set src/frontend
# → Only blobs under src/frontend/ are fetched on-demand
```

---

## 8. Anti-Patterns and Solutions

### Anti-Pattern 1: Committing Large Binary Files

```bash
# NG: 巨大ファイルを直接コミット
$ git add dataset-5gb.csv
$ git commit -m "Add dataset"
# → A 5GB blob is consumed; the packfile becomes bloated even after gc
# → The full history must be downloaded on every clone

# OK: Use Git LFS
$ git lfs install
$ git lfs track "*.csv"
$ git add .gitattributes dataset-5gb.csv
$ git commit -m "Add dataset via LFS"
```

**Reason**: Git's object model is optimized for text files. Delta compression efficiency for binaries is poor, causing repository size to grow exponentially.

```bash
# Check the impact of large files already committed
$ git rev-list --objects --all | \
    git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
    grep '^blob' | sort -k3 -n -r | head -5

# Completely remove a large file from history
$ git filter-repo --path dataset-5gb.csv --invert-paths
# ※ git filter-branch is deprecated; use git filter-repo

# LFS migration tool
$ git lfs migrate import --include="*.csv" --everything
# → Migrates CSV files to LFS across all branches and all history
```

### Anti-Pattern 2: Using Abbreviated SHA-1 as a Fixed Value

```bash
# NG: Hard-coding abbreviated hashes in scripts
DEPLOY_COMMIT="abc123"
git checkout $DEPLOY_COMMIT

# OK: Use tag or branch names, or a hash of sufficient length
DEPLOY_TAG="v1.0.0"
git checkout $DEPLOY_TAG

# OK: Use the full hash (for automation scripts)
DEPLOY_COMMIT=$(git rev-parse v1.0.0)
git checkout $DEPLOY_COMMIT
```

**Reason**: As a repository grows, abbreviated hashes can collide. Since Git 2.11, the default abbreviation length is dynamically adjusted rather than fixed at 7, but using it as a fixed value is dangerous.

### Anti-Pattern 3: Directly Manipulating the Object Database

```bash
# NG: Manually operating on .git/objects/
$ rm .git/objects/ab/c123def456...
# → The repository becomes corrupted

# NG: Backing up by copying .git/objects/
$ cp -r .git/objects/ /backup/
# → The lock state of packfiles can become inconsistent

# OK: Use Git commands
$ git gc                    # clean up objects
$ git prune                 # delete unreachable objects
$ git bundle create backup.bundle --all  # backup
```

### Anti-Pattern 4: Committing Sensitive Information

```bash
# NG: Committing sensitive information
$ echo "API_KEY=sk-abc123" > .env
$ git add .env && git commit -m "Add config"
# → Permanently stored as a blob object
# → Accessible from past commits even after git rm

# Completely remove sensitive information from history
$ git filter-repo --path .env --invert-paths --force
# → All commits are rewritten and assigned new SHA-1 hashes
# → Affects all forks and clones, so proceed with caution

# OK: Exclude from the start with .gitignore
$ echo ".env" >> .gitignore
$ git add .gitignore && git commit -m "Ignore .env"
```

### Anti-Pattern 5: Object Accumulation from Frequent Force Pushes

```bash
# NG: Frequent rebase + force push
$ git rebase -i HEAD~10
$ git push --force
# → Unreachable objects accumulate in the remote repository
# → Consistency with other developers' local repositories is broken

# OK: Use force-with-lease to minimize impact
$ git push --force-with-lease
# → Rejected if the remote state differs from what is expected
```

---

## 9. FAQ

### Q1. If you commit 10 files with the same content, are 10 blobs created?

**A1.** No, only **one**. Because Git uses content addressing, identical content has the same SHA-1 hash, so a single blob object is shared. Tree objects reference the same blob SHA-1 under different filenames.

```bash
# 検証
$ for i in $(seq 1 10); do cp template.txt "file_$i.txt"; done
$ git add -A && git commit -m "Add 10 identical files"
$ git ls-tree HEAD | awk '{print $3}' | sort -u | wc -l
# → 1 (only one blob)
```

### Q2. What happens to the original commit when you amend it with `git commit --amend`?

**A2.** The original commit object **remains in the object database without being deleted**. A new commit object is created and the branch ref is updated to point to the new commit. The original commit can still be referenced from `reflog` and is retained until `git gc` is run (default: 90 days).

```bash
# Restore the pre-amend commit
$ git reflog
abc123 HEAD@{0}: commit (amend): fixed message
def456 HEAD@{1}: commit: original message

$ git checkout def456
# → You can inspect the pre-amend state

$ git branch recover-amend def456
# → Save the pre-amend commit as a branch
```

### Q3. What happens if a SHA-1 collision occurs?

**A3.** In theory, different content could have the same hash, but the practical probability is astronomically low (50% chance after 2^80 attempts). In 2017, Google demonstrated a SHA-1 collision, but Git uses `sha1dc` (SHA-1 with collision detection), which detects and rejects known attack patterns. A complete migration to SHA-256 is planned for the future.

```
Collision probability (birthday paradox):
  Number of objects    Collision probability
  10^6                 ~10^-36 (virtually zero)
  10^9                 ~10^-30
  10^12                ~10^-24
  10^15                ~10^-18

  Reference: The Linux kernel has about 10^7 objects
  → Collision probability is cosmically zero
```

### Q4. When does `git gc` run automatically?

**A4.** It runs automatically under the following conditions:

```bash
# Trigger conditions for automatic GC
$ git config gc.auto
6700    # Auto GC when loose objects exceed this count (default: 6700)

$ git config gc.autoPackLimit
50      # Auto GC when packfiles exceed this count (default: 50)

# Disable automatic GC
$ git config gc.auto 0

# Manual GC
$ git gc
$ git gc --aggressive    # More aggressive compression (takes longer)
```

### Q5. If a blob's content changes by just one byte, is a new blob created?

**A5.** Yes, a **completely new blob object** is created. As loose objects, they are separate zlib-compressed files. However, when consolidated into a packfile by `git gc`, **delta compression** is applied and similar blobs are stored as only their differences.

```bash
# 実験
$ echo "version 1" > test.txt
$ git add test.txt && git commit -m "v1"
$ BLOB_V1=$(git rev-parse HEAD:test.txt)

$ echo "version 2" > test.txt
$ git add test.txt && git commit -m "v2"
$ BLOB_V2=$(git rev-parse HEAD:test.txt)

# Different hashes = different objects
$ echo "$BLOB_V1"
$ echo "$BLOB_V2"
# → Completely different hashes

# Delta compression is applied inside the packfile
$ git gc
$ git verify-pack -v .git/objects/pack/*.idx | grep "$BLOB_V2"
# → Shown as a delta (only the diff from the base blob is stored)
```

### Q6. Can two commit objects have the same tree?

**A6.** Yes, it is possible. For example, if you commit a change and then revert it, the revert commit's tree will be the same as the original commit's tree.

```bash
# 実験
$ git log --format="%H %T" -5
commit1 tree_A    ← current
commit2 tree_B    ← the change being reverted
commit3 tree_A    ← after revert (same as tree_A!)

# Even if trees are the same, commits are separate objects
# (because parent, author, committer, and message differ)
```

### Q7. Are Git objects encrypted?

**A7.** No, they are **not encrypted**. They are compressed with zlib, but this is for size reduction, not encryption. Anyone with access to the repository can read the content of all objects.

```bash
# Options when repository encryption is needed
# 1. git-crypt: encrypt specific files
$ git-crypt init
$ echo "secrets/** filter=git-crypt diff=git-crypt" >> .gitattributes

# 2. File system-level encryption
# → Use LUKS, FileVault, BitLocker, etc.

# 3. Repository hosting access control
# → GitHub Private Repository, GitLab Private, etc.
```

---

## 10. Debugging and Troubleshooting

### 10.1 Diagnosing a Corrupted Repository

```bash
# 1. 整合性チェック
$ git fsck --full --strict 2>&1 | tee fsck-report.txt

# Typical errors and remediation:

# Error: missing object
# → Object file was deleted or corrupted
$ git fsck 2>&1 | grep "missing"
missing blob abc123...
# Remedy: Fetch the object from a backup or another clone
$ git fetch origin  # Fetch missing objects from remote

# Error: corrupt object
# → zlib compressed data is corrupted
$ git fsck 2>&1 | grep "corrupt"
error: corrupt loose object 'abc123...'
# Remedy: Delete the corrupted file and re-fetch from remote
$ rm .git/objects/ab/c123...
$ git fetch origin

# Error: broken link
# → An object referenced by a commit or tree does not exist
$ git fsck 2>&1 | grep "broken"
broken link from commit abc123...
# Remedy: Restore to a valid state using git reflog
$ git reflog
$ git reset --hard HEAD@{n}
```

### 10.2 Manually Restoring Objects

```bash
# Scenario: Restoring files after an accidental git reset --hard

# 1. Identify the original commit in reflog
$ git reflog
abc123 HEAD@{0}: reset: moving to HEAD~5
def456 HEAD@{1}: commit: important work

# 2. Check for dangling objects
$ git fsck --lost-found
dangling commit def456...
dangling blob ghi789...

# 3. Check the content of dangling objects
$ git show def456
# → The content of the commit is displayed

# 4. Restore
$ git checkout -b recovery def456

# 5. Restored objects in .git/lost-found/
$ ls .git/lost-found/
other/    ← blobs, trees, etc.
commit/   ← dangling commits
```

### 10.3 Performance Debugging

```bash
# Trace Git operations (identify what is slow)
$ GIT_TRACE=1 git status
$ GIT_TRACE_PERFORMANCE=1 git log --oneline -100

# Trace object access
$ GIT_TRACE_PACK_ACCESS=1 git log --oneline -10

# Rebuild packfile index (when corrupted)
$ git index-pack .git/objects/pack/pack-abc123.pack

# Optimize loose objects
$ git repack -a -d
# -a: consolidate all objects into one packfile
# -d: delete unnecessary loose objects

# More aggressive optimization
$ git repack -a -d --depth=250 --window=250
# depth: maximum depth of the delta chain
# window: comparison window size for delta calculation
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Concept                | Key Points                                                                 |
|------------------------|----------------------------------------------------------------------------|
| blob                   | Stores only file content; does not include name or permissions             |
| tree                   | Represents directory structure; holds references to blobs/trees            |
| commit                 | tree + parent + author/committer + message                                 |
| tag                    | Named reference to an object (creates a tag object if annotated)           |
| SHA-1                  | Foundation of content addressing; implementation includes collision detection |
| SHA-256                | Successor to SHA-1; available as an option since Git 2.42                  |
| Content addressing     | Same content → same hash → automatic deduplication                         |
| .git/objects           | Two storage formats: loose objects and packfiles                            |
| Reachability           | Basis for GC deletion decisions; whether it can be traced from refs + reflog |
| Partial clone          | Handles large repositories via lazy object fetching                        |

---

## Next Guides to Read

- [Refs and Branches](./01-refs-and-branches.md) -- How HEAD, reflog, and detached HEAD work
- [Packfile/GC](./03-packfile-gc.md) -- Delta compression and repository optimization
- [Merge Algorithms](./02-merge-algorithms.md) -- Internal workings of 3-way merge and ort

---

## References

1. **Pro Git Book** -- Scott Chacon, Ben Straub "Git Internals - Git Objects" https://git-scm.com/book/en/v2/Git-Internals-Git-Objects
2. **Git Official Documentation** -- `git-cat-file`, `git-hash-object` manpage https://git-scm.com/docs
3. **SHA-1 Collision Issue and Git's Response** -- "How does Git handle SHA-1 collisions on blobs?" https://git-scm.com/docs/hash-function-transition
4. **Git Source Code** -- `sha1dc` (SHA-1 collision detection) https://github.com/git/git
5. **Git Internals - Plumbing and Porcelain** -- https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
6. **Technical FAQ** -- https://git-scm.com/docs/technical
7. **commit-graph design document** -- https://git-scm.com/docs/commit-graph
8. **partial clone design** -- https://git-scm.com/docs/partial-clone
