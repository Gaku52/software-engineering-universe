# Python ベストプラクティス

> **目標**: Python 開発における型安全性・コード品質・保守性のベストプラクティスを学ぶ。

## 目次

1. [型ヒント](#type-hints)
2. [コード品質](#code-quality)
3. [プロジェクト構成](#project-structure)
4. [仮想環境管理](#virtual-environment-management)
5. [テスト](#testing)
6. [パフォーマンス](#performance)

---

## 型ヒント

### 基本的な型ヒント

```python
# プリミティブ型
def greet(name: str) -> str:
    return f"Hello, {name}"

# リスト
def process_numbers(numbers: list[int]) -> list[int]:
    return [n * 2 for n in numbers]

# 辞書
User = dict[str, str | int]

def get_user(user_id: int) -> User:
    return {"id": user_id, "name": "John", "age": 30}

# Optional（None になり得る）
from typing import Optional

def find_user(user_id: int) -> Optional[User]:
    if user_id == 0:
        return None
    return {"id": user_id, "name": "John"}

# Union（複数の型）
def process_value(value: int | str) -> str:
    return str(value)
```

### Pydantic によるバリデーション

```python
from pydantic import BaseModel, EmailStr, Field, validator

class User(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    age: int = Field(..., ge=0, le=120)

    @validator('age')
    def age_must_be_adult(cls, v):
        if v < 18:
            raise ValueError('18歳以上である必要があります')
        return v

# 使用例
user = User(id=1, name="John", email="john@example.com", age=25)
print(user.dict())  # {'id': 1, 'name': 'John', 'email': 'john@example.com', 'age': 25}

# バリデーションエラー
try:
    User(id=1, name="", email="invalid", age=15)
except ValidationError as e:
    print(e.json())
```

### TypedDict

```python
from typing import TypedDict

class UserDict(TypedDict):
    id: int
    name: str
    email: str

def create_user() -> UserDict:
    return {
        "id": 1,
        "name": "John",
        "email": "john@example.com"
    }

# mypy が型エラーを検出する
user: UserDict = create_user()
print(user["name"])  # OK
# print(user["age"]) # エラー: TypedDict "UserDict" にキー "age" は存在しない
```

---

## コード品質

### リンター / フォーマッター

**ruff（高速リンター + フォーマッター）**:
```bash
# インストール
pip install ruff

# 設定（pyproject.toml）
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
ignore = ["E501"]  # 行長はフォーマッターに任せる

# 実行
ruff check .      # リント
ruff format .     # フォーマット
```

**black（コードフォーマッター）**:
```bash
pip install black

# 実行
black .

# 設定（pyproject.toml）
[tool.black]
line-length = 100
target-version = ['py311']
```

**mypy（型チェッカー）**:
```bash
pip install mypy

# 実行
mypy .

# 設定（pyproject.toml）
[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
```

### pre-commit フック

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.6
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.7.1
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]

# インストール
pip install pre-commit
pre-commit install

# 実行
pre-commit run --all-files
```

---

## プロジェクト構成

### ディレクトリ構成

```
my-project/
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── main.py
│       ├── models/
│       │   ├── __init__.py
│       │   └── user.py
│       ├── api/
│       │   ├── __init__.py
│       │   └── routes.py
│       └── utils/
│           ├── __init__.py
│           └── helpers.py
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   └── test_api.py
├── pyproject.toml
├── requirements.txt
├── .gitignore
└── README.md
```

### pyproject.toml

```toml
[project]
name = "myapp"
version = "1.0.0"
description = "マイアプリケーション"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn>=0.24.0",
    "pydantic>=2.5.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "ruff>=0.1.6",
    "mypy>=1.7.0",
]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[tool.ruff]
line-length = 100

[tool.mypy]
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
```

---

## 仮想環境管理

### venv（標準）

```bash
# 作成
python -m venv venv

# 有効化
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# インストール
pip install -r requirements.txt

# 無効化
deactivate
```

### Poetry（推奨）

```bash
# インストール
curl -sSL https://install.python-poetry.org | python3 -

# プロジェクト初期化
poetry init

# 依存関係の追加
poetry add fastapi uvicorn
poetry add --group dev pytest ruff mypy

# インストール
poetry install

# 実行
poetry run python main.py
poetry run pytest

# シェルを開く
poetry shell
```

**pyproject.toml**（Poetry）:
```toml
[tool.poetry]
name = "myapp"
version = "1.0.0"
description = "マイアプリケーション"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.104.0"
uvicorn = "^0.24.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
ruff = "^0.1.6"
mypy = "^1.7.0"
```

---

## テスト

### pytest

```python
# tests/test_user.py
import pytest
from myapp.models.user import User

def test_user_creation():
    user = User(id=1, name="John", email="john@example.com")
    assert user.id == 1
    assert user.name == "John"

def test_user_validation():
    with pytest.raises(ValidationError):
        User(id=1, name="", email="invalid")

# フィクスチャ
@pytest.fixture
def sample_user():
    return User(id=1, name="John", email="john@example.com")

def test_user_name(sample_user):
    assert sample_user.name == "John"

# パラメータ化
@pytest.mark.parametrize("age,expected", [
    (0, False),
    (17, False),
    (18, True),
    (30, True),
])
def test_is_adult(age, expected):
    assert is_adult(age) == expected
```

### FastAPI テスト

```python
from fastapi.testclient import TestClient
from myapp.main import app

client = TestClient(app)

def test_read_users():
    response = client.get("/users/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_user():
    response = client.post("/users/", json={
        "name": "John",
        "email": "john@example.com"
    })
    assert response.status_code == 201
    assert response.json()["name"] == "John"

def test_user_not_found():
    response = client.get("/users/999")
    assert response.status_code == 404
```

### カバレッジ

```bash
# インストール
pip install pytest-cov

# 実行
pytest --cov=src --cov-report=html

# 閾値を強制
pytest --cov=src --cov-fail-under=80
```

---

## パフォーマンス

### リスト内包表記

```python
# 遅い
result = []
for i in range(1000):
    result.append(i * 2)

# 速い
result = [i * 2 for i in range(1000)]

# ジェネレーター（メモリ効率が良い）
result = (i * 2 for i in range(1000000))
```

### 辞書アクセス

```python
# 遅い
if 'key' in my_dict:
    value = my_dict['key']
else:
    value = default

# 速い
value = my_dict.get('key', default)
```

### f-string

```python
# 遅い
message = "Hello, " + name + "!"

# 速い
message = f"Hello, {name}!"
```

### functools.lru_cache

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# メモ化により即座に結果が得られる
print(fibonacci(100))
```

---

## まとめ

### チェックリスト

**型安全性**:
- [ ] すべての関数に型ヒントを追加する
- [ ] データバリデーションに Pydantic を使用する
- [ ] mypy で型チェックを実行する

**コード品質**:
- [ ] ruff または black でフォーマットする
- [ ] mypy で型チェックする
- [ ] pre-commit フックを設定する

**プロジェクト構成**:
- [ ] pyproject.toml で依存関係を管理する
- [ ] 適切なディレクトリ構成を使用する
- [ ] Poetry または venv で仮想環境を管理する

**テスト**:
- [ ] pytest でユニットテストを書く
- [ ] カバレッジを 80% 以上に保つ
- [ ] CI/CD でテストを自動実行する

---

## 次のステップ

1. **fastapi-django.md**: FastAPI/Django 開発ガイド
2. **data-processing.md**: データ処理・自動化ガイド
