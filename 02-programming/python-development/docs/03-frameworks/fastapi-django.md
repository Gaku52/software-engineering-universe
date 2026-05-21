# FastAPI & Django Development Guide

> **Goal**: Learn practical techniques for building high-quality web applications with FastAPI and Django.

## Table of Contents

1. [FastAPI Basics](#fastapi-basics)
2. [FastAPI + SQLAlchemy](#fastapi--sqlalchemy)
3. [FastAPI Authentication](#fastapi-authentication)
4. [Django Basics](#django-basics)
5. [Django REST Framework](#django-rest-framework)
6. [Performance Optimization](#performance-optimization)

---

## FastAPI Basics

### Project Setup

```bash
# Create project
mkdir myapi && cd myapi
poetry init

# Add dependencies
poetry add fastapi uvicorn[standard] pydantic pydantic-settings
poetry add --group dev pytest httpx ruff mypy

# Create directory structure
mkdir -p src/myapi/{api,models,schemas,services}
touch src/myapi/__init__.py
```

**Directory structure**:
```
myapi/
├── src/
│   └── myapi/
│       ├── __init__.py
│       ├── main.py           # application entry point
│       ├── config.py         # settings management
│       ├── api/              # API endpoints
│       │   ├── __init__.py
│       │   ├── deps.py       # dependency injection
│       │   └── v1/
│       │       ├── __init__.py
│       │       ├── users.py
│       │       └── posts.py
│       ├── models/           # database models
│       │   ├── __init__.py
│       │   └── user.py
│       ├── schemas/          # Pydantic schemas
│       │   ├── __init__.py
│       │   └── user.py
│       └── services/         # business logic
│           ├── __init__.py
│           └── user.py
├── tests/
├── pyproject.toml
└── .env
```

### Basic API Endpoints

**src/myapi/main.py**:
```python
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

app = FastAPI(
    title="My API",
    description="FastAPI Example",
    version="1.0.0",
)


class User(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=100)
    email: str


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str


# In-memory storage (for demo purposes)
users_db: dict[int, User] = {}
next_id = 1


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/users", response_model=list[User])
async def list_users():
    """List all users"""
    return list(users_db.values())


@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Get a specific user"""
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return users_db[user_id]


@app.post("/users", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate):
    """Create a user"""
    global next_id
    new_user = User(id=next_id, **user.model_dump())
    users_db[next_id] = new_user
    next_id += 1
    return new_user


@app.put("/users/{user_id}", response_model=User)
async def update_user(user_id: int, user: UserCreate):
    """Update a user"""
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    updated_user = User(id=user_id, **user.model_dump())
    users_db[user_id] = updated_user
    return updated_user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int):
    """Delete a user"""
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    del users_db[user_id]
```

**Run**:
```bash
# Start development server
poetry run uvicorn src.myapi.main:app --reload

# View docs
# http://localhost:8000/docs  (Swagger UI)
# http://localhost:8000/redoc (ReDoc)
```

### Environment Variable Management

**src/myapi/config.py**:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application settings
    app_name: str = "My API"
    debug: bool = False

    # Database settings
    database_url: str = "postgresql://user:password@localhost/dbname"

    # Security settings
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS settings
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
```

**Add CORS to main.py**:
```python
from fastapi.middleware.cors import CORSMiddleware
from src.myapi.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## FastAPI + SQLAlchemy

### Setup

```bash
# Add dependencies
poetry add sqlalchemy alembic psycopg2-binary
```

### Database Models

**src/myapi/database.py**:
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from src.myapi.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """DB session for dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**src/myapi/models/user.py**:
```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from src.myapi.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### Pydantic Schemas

**src/myapi/schemas/user.py**:
```python
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(None, min_length=1, max_length=100)
    password: str | None = Field(None, min_length=8)


class UserInDB(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class User(UserInDB):
    """API response (excludes hashed_password)"""
    pass
```

### CRUD Operations

**src/myapi/services/user.py**:
```python
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from src.myapi.models.user import User as UserModel
from src.myapi.schemas.user import UserCreate, UserUpdate


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_user(db: Session, user_id: int) -> UserModel | None:
    return db.query(UserModel).filter(UserModel.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> UserModel | None:
    return db.query(UserModel).filter(UserModel.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[UserModel]:
    return db.query(UserModel).offset(skip).limit(limit).all()


def create_user(db: Session, user: UserCreate) -> UserModel:
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user: UserUpdate) -> UserModel | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None

    update_data = user.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: int) -> bool:
    db_user = get_user(db, user_id)
    if not db_user:
        return False
    db.delete(db_user)
    db.commit()
    return True
```

### Alembic Migrations

```bash
# Initialize
poetry run alembic init alembic

# Create migration
poetry run alembic revision --autogenerate -m "Create users table"

# Apply migration
poetry run alembic upgrade head

# Rollback
poetry run alembic downgrade -1
```

---

## FastAPI Authentication

### JWT Token Authentication

```bash
# Add dependencies
poetry add python-jose[cryptography] passlib[bcrypt]
```

**src/myapi/auth.py**:
```python
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from src.myapi.config import settings
from src.myapi.database import get_db
from src.myapi.services import user as user_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create an access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get the current user (authentication required)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = user_service.get_user(db, user_id=user_id)
    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(current_user=Depends(get_current_user)):
    """Get the current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user
```

**Login endpoint (src/myapi/api/v1/auth.py)**:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.myapi.database import get_db
from src.myapi.services.user import verify_password, get_user_by_email
from src.myapi.auth import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class Token(BaseModel):
    access_token: str
    token_type: str


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and obtain token"""
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}
```

**Protected endpoint example**:
```python
from fastapi import APIRouter, Depends
from src.myapi.auth import get_current_active_user
from src.myapi.schemas.user import User

router = APIRouter()


@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user
```

---

## Django Basics

### Project Setup

```bash
# Create project
mkdir myproject && cd myproject
poetry init
poetry add django psycopg2-binary
poetry add --group dev pytest pytest-django

# Create Django project
poetry run django-admin startproject config .
poetry run python manage.py startapp users
```

**Directory structure**:
```
myproject/
├── config/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── users/
│   ├── migrations/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── views.py
│   └── urls.py
├── manage.py
└── pyproject.toml
```

### Model Definitions

**users/models.py**:
```python
from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model"""
    email = models.EmailField(unique=True)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class Post(models.Model):
    """Post model"""
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return self.title
```

### Migrations

```bash
# Create migrations
poetry run python manage.py makemigrations

# Apply migrations
poetry run python manage.py migrate

# Create superuser
poetry run python manage.py createsuperuser
```

---

## Django REST Framework

### Setup

```bash
# Add dependencies
poetry add djangorestframework djangorestframework-simplejwt
```

**config/settings.py**:
```python
INSTALLED_APPS = [
    # ...
    'rest_framework',
    'users',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}
```

### Serializers

**users/serializers.py**:
```python
from rest_framework import serializers
from .models import User, Post


class UserSerializer(serializers.ModelSerializer):
    posts_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'bio', 'avatar', 'posts_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_posts_count(self, obj):
        return obj.posts.count()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'username', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'title', 'content', 'author', 'published', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
```

### ViewSets

**users/views.py**:
```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, Post
from .serializers import UserSerializer, UserCreateSerializer, PostSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user information"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related('author').all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PostCreateSerializer
        return PostSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_authenticated:
            # Unauthenticated users see only published posts
            queryset = queryset.filter(published=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
```

### URL Configuration

**users/urls.py**:
```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, PostViewSet

router = DefaultRouter()
router.register('users', UserViewSet)
router.register('posts', PostViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
```

**config/urls.py**:
```python
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('users.urls')),
    path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
```

### Testing

```python
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import User, Post


class UserAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='testpass123'
        )

    def test_create_user(self):
        """Test user creation"""
        url = reverse('user-list')
        data = {
            'email': 'newuser@example.com',
            'username': 'newuser',
            'password': 'newpass123'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.count(), 2)

    def test_get_me(self):
        """Test fetching own user info"""
        self.client.force_authenticate(user=self.user)
        url = reverse('user-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'test@example.com')
```

```bash
# Run tests
poetry run python manage.py test
```

---

## Performance Optimization

### FastAPI Optimization

**Async processing**:
```python
from fastapi import FastAPI
import httpx
import asyncio

app = FastAPI()


@app.get("/fetch")
async def fetch_data():
    """Async call to external API"""
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/data")
        return response.json()


@app.get("/fetch-multiple")
async def fetch_multiple():
    """Call multiple APIs in parallel"""
    async with httpx.AsyncClient() as client:
        tasks = [
            client.get("https://api.example.com/data1"),
            client.get("https://api.example.com/data2"),
            client.get("https://api.example.com/data3"),
        ]
        responses = await asyncio.gather(*tasks)
        return [r.json() for r in responses]
```

**Caching**:
```python
from functools import lru_cache
from fastapi import Depends

@lru_cache()
def get_settings():
    """Cache settings"""
    return Settings()


@app.get("/config")
def get_config(settings: Settings = Depends(get_settings)):
    return {"app_name": settings.app_name}
```

**Background tasks**:
```python
from fastapi import BackgroundTasks

def send_email(email: str, message: str):
    """Email sending (slow operation)"""
    print(f"Sending email to {email}: {message}")


@app.post("/send-notification")
async def send_notification(email: str, background_tasks: BackgroundTasks):
    """Send notification (runs in background)"""
    background_tasks.add_task(send_email, email, "Welcome!")
    return {"message": "Notification sent"}
```

### Django Optimization

**Solving the N+1 problem**:
```python
# N+1 problem
posts = Post.objects.all()
for post in posts:
    print(post.author.email)  # separate DB query per post

# select_related (1-to-1, ForeignKey)
posts = Post.objects.select_related('author').all()
for post in posts:
    print(post.author.email)  # fetched with a single JOIN

# prefetch_related (ManyToMany, reverse relations)
users = User.objects.prefetch_related('posts').all()
for user in users:
    print(user.posts.count())  # fetched in 2 queries
```

**Adding indexes**:
```python
class Post(models.Model):
    # ...

    class Meta:
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['author', 'published']),
        ]
```

**Query optimization**:
```python
# Fetch all fields (avoid)
posts = Post.objects.all()

# Fetch only required fields
posts = Post.objects.only('id', 'title', 'created_at')

# Defer heavy fields
posts = Post.objects.defer('content')
```

**Caching with Redis**:
```bash
poetry add django-redis
```

```python
# config/settings.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
```

```python
# Usage
from django.core.cache import cache

def get_posts():
    """Cache post list"""
    posts = cache.get('posts')
    if posts is None:
        posts = list(Post.objects.select_related('author').all())
        cache.set('posts', posts, 60 * 15)  # cache for 15 minutes
    return posts
```

---

## Summary

### FastAPI Checklist

- [ ] Type safety with Pydantic schemas
- [ ] Environment variable management (pydantic-settings)
- [ ] SQLAlchemy + Alembic for database management
- [ ] JWT authentication
- [ ] Async processing for external API calls
- [ ] Tests with pytest + httpx

### Django Checklist

- [ ] Custom user model (AbstractUser)
- [ ] Django REST Framework setup
- [ ] JWT authentication (simplejwt)
- [ ] N+1 problem resolved (select_related / prefetch_related)
- [ ] Redis caching
- [ ] Tests with pytest-django
