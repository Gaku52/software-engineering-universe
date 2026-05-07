# Docker Compose Basics

> Systematically understand the syntax and concepts of docker-compose.yml, and build a foundation for constructing multi-container application environments by combining services, volumes, and networks.

## What You Will Learn

1. **Syntax and basic structure of docker-compose.yml** -- Understand the role and notation of each section (services, volumes, networks) in a Compose file based on YAML syntax
2. **Service definitions and container lifecycle management** -- Master the main service definition options including image specification, build configuration, port exposure, and environment variables
3. **Data and communication management with volumes and networks** -- Learn design patterns for data persistence and internal communication between containers


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What is Docker Compose

### 1.1 Single Container vs Compose

```
+------------------------------------------------------------------+
|          Single Container vs Docker Compose                       |
+------------------------------------------------------------------+
|                                                                  |
|  [Single Container (docker run)]                                 |
|  $ docker run -d --name web -p 3000:3000 \                       |
|      -e DATABASE_URL=... \                                       |
|      --network mynet myapp:latest                                |
|  $ docker run -d --name db -p 5432:5432 \                        |
|      -v pgdata:/var/lib/postgresql/data \                        |
|      --network mynet postgres:16                                 |
|  → Long commands, complex management, low reproducibility        |
|                                                                  |
|  [Docker Compose]                                                |
|  $ docker compose up -d                                          |
|  → Launch all services with one command. Config managed in YAML  |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.2 Docker Compose Architecture

```
+------------------------------------------------------------------+
|              Docker Compose Internal Architecture                 |
+------------------------------------------------------------------+
|                                                                  |
|  docker compose up                                               |
|    |                                                             |
|    +-- Parse & validate compose.yml                              |
|    |     |                                                       |
|    |     +-- YAML → conversion to internal model                 |
|    |     +-- Environment variable expansion (including .env)     |
|    |     +-- Merge multiple Compose files                        |
|    |     +-- Profile filtering                                   |
|    |                                                             |
|    +-- Build dependency graph                                    |
|    |     |                                                       |
|    |     +-- Parse depends_on                                    |
|    |     +-- Detect circular dependencies                        |
|    |     +-- Determine startup order                             |
|    |                                                             |
|    +-- Create resources                                          |
|    |     |                                                       |
|    |     +-- Create networks (docker network create)             |
|    |     +-- Create volumes (docker volume create)               |
|    |     +-- Prepare secrets/configs                             |
|    |                                                             |
|    +-- Start services                                            |
|          |                                                       |
|          +-- Pull or build images                                |
|          +-- Create containers (docker create)                   |
|          +-- Start containers (docker start)                     |
|          +-- Wait for health checks                              |
|          +-- Start dependent services                            |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.3 Project Names and Container Naming

Docker Compose determines resource names based on the project name. The project name is determined by the following priority order:

```bash
# 1. -p / --project-name flag (highest priority)
docker compose -p myproject up -d

# 2. COMPOSE_PROJECT_NAME environment variable
export COMPOSE_PROJECT_NAME=myproject
docker compose up -d

# 3. name field in compose.yml
# compose.yml
# name: myproject

# 4. Directory name where compose.yml is located (default)
# /home/user/my-app/ → project name: my-app
```

Resource naming conventions:

```
+------------------------------------------------------------------+
|              Resource Naming by Project Name                      |
+------------------------------------------------------------------+
|                                                                  |
|  Project name: myproject                                         |
|                                                                  |
|  Container names: myproject-web-1, myproject-db-1                |
|  Network name:    myproject_default                              |
|  Volume name:     myproject_pgdata                               |
|                                                                  |
|  Can also be specified explicitly with container_name:           |
|  services:                                                       |
|    web:                                                          |
|      container_name: my-web-server  # fixed name                 |
|      # ※ Specifying container_name disables                      |
|      #   scaling (--scale)                                       |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.4 Compose File Versions

```
+------------------------------------------------------------------+
|              History of Compose File Specification               |
+------------------------------------------------------------------+
| Version          | Features                  | Recommendation    |
|------------------|--------------------------|------------------|
| version: "2"     | Before Docker Engine integration | Deprecated  |
| version: "3"     | Swarm support             | Deprecated        |
| version: "3.8"   | Last explicit version     | Compatibility only|
| (version omitted)| Compose Spec compliant    | Recommended (current standard) |
+------------------------------------------------------------------+
|                                                                  |
|  Currently, omitting the version key and complying with the      |
|  Compose Specification is recommended. Docker Compose V2         |
|  automatically determines this.                                  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 2. Basic Structure of docker-compose.yml

### 2.1 Overall Structure

```yaml
# docker-compose.yml

# (version is recommended to be omitted)

# Service definitions (container configuration)
services:
  web:
    image: node:20-alpine
    # ... configuration
  db:
    image: postgres:16-alpine
    # ... configuration

# Volume definitions (data persistence)
volumes:
  pgdata:
    driver: local

# Network definitions (inter-container communication)
networks:
  backend:
    driver: bridge

# Secret definitions (sensitive information)
secrets:
  db_password:
    file: ./secrets/db_password.txt

# Config definitions (configuration files)
configs:
  nginx_conf:
    file: ./nginx/nginx.conf
```

### 2.2 Compose File Hierarchy

```
+------------------------------------------------------------------+
|              Structure of docker-compose.yml                      |
+------------------------------------------------------------------+
|                                                                  |
|  docker-compose.yml                                              |
|    |                                                             |
|    +-- services:          ← Container definitions (required)     |
|    |     +-- web:                                                |
|    |     |    +-- image / build                                  |
|    |     |    +-- ports                                          |
|    |     |    +-- environment                                    |
|    |     |    +-- volumes                                        |
|    |     |    +-- networks                                       |
|    |     |    +-- depends_on                                     |
|    |     |    +-- restart                                        |
|    |     +-- db:                                                 |
|    |          +-- ...                                            |
|    |                                                             |
|    +-- volumes:           ← Volume definitions (optional)        |
|    |     +-- pgdata:                                             |
|    |                                                             |
|    +-- networks:          ← Network definitions (optional)       |
|    |     +-- backend:                                            |
|    |                                                             |
|    +-- secrets:           ← Secret definitions (optional)        |
|    +-- configs:           ← Config file definitions (optional)   |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 3. Details of services

### 3.1 Image Specification vs Build

```yaml
services:
  # Pattern 1: Use an existing image
  db:
    image: postgres:16-alpine

  # Pattern 2: Build from Dockerfile
  web:
    build:
      context: .               # Build context
      dockerfile: Dockerfile   # Dockerfile path (default: Dockerfile)
      args:                    # Build arguments
        NODE_ENV: production
      target: runner           # Target stage for multi-stage builds
      cache_from:
        - myapp:latest
    image: myapp:latest        # Tag name after build

  # Pattern 3: Simple build
  api:
    build: ./api               # Specify context only (Dockerfile auto-detected)
```

### 3.2 Port Exposure

```yaml
services:
  web:
    ports:
      # host:container
      - "3000:3000"            # localhost:3000 → container:3000
      - "443:443"

      # Specify host IP
      - "127.0.0.1:3000:3000"  # localhost only (not accessible from outside)

      # Randomly assign host port
      - "3000"                 # random port → container:3000

      # Specify protocol
      - "6379:6379/tcp"

    # Expose only between containers (not accessible from host)
    expose:
      - "3000"
```

### 3.3 Environment Variables

```yaml
services:
  web:
    environment:
      # key=value format
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      # No value = inherit host environment variable
      API_KEY:

    # Load from .env file
    env_file:
      - .env
      - .env.local             # Later files take precedence
```

### 3.4 Volume Mounts

```yaml
services:
  web:
    volumes:
      # Named volume
      - node_modules:/app/node_modules

      # Bind mount (host directory)
      - ./src:/app/src

      # Read-only
      - ./config:/app/config:ro

      # tmpfs (in memory)
      - type: tmpfs
        target: /tmp
        tmpfs:
          size: 100000000  # 100MB

      # Long syntax
      - type: bind
        source: ./data
        target: /app/data
        consistency: cached   # macOS performance improvement
```

### 3.5 Restart Policy

```yaml
services:
  web:
    restart: unless-stopped
    # no           : Do not restart (default)
    # always       : Always restart
    # on-failure   : Restart only on abnormal exit
    # unless-stopped: Restart unless manually stopped
```

### 3.6 depends_on and Startup Order Control

```yaml
services:
  web:
    build: .
    depends_on:
      db:
        condition: service_healthy     # Start after health check passes
        restart: true                  # Restart web when db restarts
      redis:
        condition: service_started     # Only check that container has started
      migrations:
        condition: service_completed_successfully  # Start after successful exit

  migrations:
    build: .
    command: ["npm", "run", "migrate"]
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

```
+------------------------------------------------------------------+
|              depends_on condition Reference                       |
+------------------------------------------------------------------+
|                                                                  |
|  condition               | Description                           |
|  ----------------------- | ------------------------------------- |
|  service_started         | When container has started (default)  |
|  service_healthy         | When health check becomes healthy     |
|  service_completed_      | When container exits normally (exit 0)|
|    successfully          |                                       |
|                                                                  |
|  Startup order example:                                          |
|  db (healthy) → migrations (completed) → web (start)             |
|                                                                  |
|  ※ service_healthy requires a healthcheck definition             |
|  ※ service_completed_successfully is useful for migrations       |
|    and seed operations                                           |
|                                                                  |
+------------------------------------------------------------------+
```

### 3.7 Resource Limits

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: "1.0"           # CPU core limit
          memory: 512M          # Memory limit
        reservations:
          cpus: "0.25"          # Reserved CPU
          memory: 128M          # Reserved memory

  db:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 256M

    # OOM Killer adjustment
    oom_kill_disable: false     # Do not disable OOM Killer (recommended)
    oom_score_adj: -500         # OOM score adjustment (lower = less likely to be killed)
```

### 3.8 Logging Configuration

```yaml
services:
  web:
    logging:
      driver: json-file        # Default log driver
      options:
        max-size: "10m"        # Maximum log file size
        max-file: "3"          # Number of rotations
        compress: "true"       # Enable compression
        tag: "{{.Name}}"       # Log tag

  # Send to syslog
  api:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logserver:514"
        syslog-facility: daemon
        tag: "api-service"

  # Disable logging (for services that produce large amounts of logs)
  load-test:
    logging:
      driver: none
```

### 3.9 Health Checks

```yaml
services:
  web:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s            # Check interval
      timeout: 10s             # Timeout
      retries: 3               # Number of retries
      start_period: 40s        # Startup grace period (failures during this time are not counted)
      start_interval: 5s       # Check interval during startup (Compose v2.20+)

  # Health check using shell command
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d myapp"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Disable health check (for images with a default health check)
  custom-service:
    healthcheck:
      disable: true
```

```
+------------------------------------------------------------------+
|              Health Check State Machine                           |
+------------------------------------------------------------------+
|                                                                  |
|  Container starts                                                |
|    |                                                             |
|    v                                                             |
|  [starting]  ← Stays here during start_period                   |
|    |                                                             |
|    +-- Check success → [healthy]                                 |
|    |                    |                                        |
|    |                    +-- Check fails (retries times) → [unhealthy]|
|    |                    |                                        |
|    |                    +-- Check success → [healthy] (loop)     |
|    |                                                             |
|    +-- Check still failing after start_period → [unhealthy]      |
|                                                                  |
|  ※ Even when unhealthy, container won't restart without a restart policy|
|  ※ Use depends_on + service_healthy to block other service startups|
|                                                                  |
+------------------------------------------------------------------+
```

---

## 4. volumes

### 4.1 Types of Volumes

```
+------------------------------------------------------------------+
|              Volume Types and Characteristics                     |
+------------------------------------------------------------------+
|                                                                  |
|  [Named Volume]                                                  |
|  volumes:                                                        |
|    pgdata:                                                       |
|      driver: local                                               |
|  → Managed by Docker. Viewable with docker volume ls             |
|  → Shareable between containers. Persistence is guaranteed       |
|  → Fast on macOS/Windows too (inside Docker VM)                  |
|                                                                  |
|  [Bind Mount]                                                    |
|  volumes:                                                        |
|    - ./src:/app/src                                              |
|  → Mounts host directory directly                                |
|  → Ideal for sharing source code during development              |
|  → I/O may be slow on macOS/Windows                              |
|                                                                  |
|  [tmpfs]                                                         |
|  tmpfs:                                                          |
|    - /tmp                                                        |
|  → Created in memory. Lost when container stops                  |
|  → Ideal for temporary files and caches                          |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.2 Volume Definitions

```yaml
volumes:
  # Simple definition
  pgdata:

  # Specify driver
  mysql_data:
    driver: local

  # External volume (pre-created with docker volume create)
  shared_data:
    external: true

  # Driver options
  nfs_data:
    driver: local
    driver_opts:
      type: nfs
      o: addr=192.168.1.100,rw
      device: ":/exports/data"
```

---

## 5. networks

### 5.1 How Networks Work

```
+------------------------------------------------------------------+
|              How Compose Networks Work                            |
+------------------------------------------------------------------+
|                                                                  |
|  When docker compose up runs:                                    |
|  → {project_name}_default network is created by default          |
|  → All services connect to this network                          |
|  → DNS resolution by service name is possible                    |
|                                                                  |
|  +--- default network ----------------------------+              |
|  |                                                 |              |
|  |  [web]                        [db]              |              |
|  |  curl http://db:5432    <---> PostgreSQL         |              |
|  |  curl http://redis:6379 <---> [redis]           |              |
|  |                                                 |              |
|  +-------------------------------------------------+              |
|                                                                  |
|  ※ Service name = DNS hostname, automatically resolved           |
|                                                                  |
+------------------------------------------------------------------+
```

### 5.2 Network Usage Patterns

```yaml
services:
  web:
    networks:
      - frontend
      - backend

  api:
    networks:
      - backend

  db:
    networks:
      - backend    # Not directly accessible from web

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # Block external access
```

### 5.3 Network Comparison

| Item | Default | Custom bridge | internal | host |
|------|----------|---------------|----------|------|
| Auto-created | Yes | No | No | N/A |
| Inter-container communication | All services | Specified services only | Specified services only | Host network |
| External access | Expose with ports | Expose with ports | Not allowed | Direct port |
| DNS resolution | Service name | Service name | Service name | Hostname |
| Security | Low | Medium | High | Low |
| Use case | Small scale | General | DB/internal API | Performance |

### 5.4 Advanced Network Configuration

```yaml
networks:
  # Custom subnet specification
  backend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
          gateway: 172.28.0.1

  # DNS configuration
  custom_dns:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: custom0

services:
  web:
    networks:
      backend:
        ipv4_address: 172.28.0.10   # Fixed IP address
        aliases:
          - web.local               # Additional DNS aliases
          - frontend.local

  api:
    networks:
      backend:
        ipv4_address: 172.28.0.20
        aliases:
          - api.local

    # DNS configuration
    dns:
      - 8.8.8.8
      - 8.8.4.4
    dns_search:
      - example.com

    # Add to /etc/hosts
    extra_hosts:
      - "host.docker.internal:host-gateway"  # Access to host machine
      - "api.external.com:192.168.1.100"     # Resolution of external services
```

### 5.5 Network Isolation Patterns

```
+------------------------------------------------------------------+
|              Microservices Network Isolation Design               |
+------------------------------------------------------------------+
|                                                                  |
|  [Internet]                                                      |
|      |                                                           |
|      v                                                           |
|  +--- public network ------+                                     |
|  |  [nginx/traefik]         |                                    |
|  |    (reverse proxy)       |                                    |
|  +-----|-------|-------------+                                    |
|        |       |                                                 |
|        v       v                                                 |
|  +--- frontend network --------+                                 |
|  |  [web-app]    [admin-app]  |                                  |
|  +-----|-------|-----|--------+                                   |
|        |       |     |                                           |
|        v       v     v                                           |
|  +--- api network -----------+                                   |
|  |  [api-gateway]           |                                    |
|  |    |         |           |                                    |
|  |    v         v           |                                    |
|  |  [user-svc] [order-svc]  |                                    |
|  +----|---------|------------+                                    |
|       |         |                                                |
|       v         v                                                |
|  +--- data network (internal) -------+                           |
|  |  [postgres]  [redis]  [rabbitmq]  |                           |
|  |  ※ Not directly accessible from outside |                     |
|  +-----------------------------------+                           |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 6. secrets and configs

### 6.1 Secret Definitions and Usage

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    secrets:
      - db_password
      - db_user
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_USER_FILE: /run/secrets/db_user

  web:
    build: .
    secrets:
      - source: db_password        # Secret name
        target: database_password   # Filename inside container
        uid: "1000"                 # File owner UID
        gid: "1000"                 # File owner GID
        mode: 0440                  # File permissions

secrets:
  # File-based secret
  db_password:
    file: ./secrets/db_password.txt

  # Environment variable-based secret
  db_user:
    environment: POSTGRES_USER      # Retrieved from host environment variable
```

```
+------------------------------------------------------------------+
|              How Secrets Work                                     |
+------------------------------------------------------------------+
|                                                                  |
|  Host                            Container                       |
|  ./secrets/db_password.txt  -->  /run/secrets/db_password        |
|                                                                  |
|  ※ Secrets are mounted as tmpfs                                  |
|  ※ Unlike environment variables, values are not visible with docker inspect|
|  ※ Application-side support is needed since access is via file   |
|                                                                  |
|  PostgreSQL _FILE suffix support:                                |
|    POSTGRES_PASSWORD_FILE=/run/secrets/db_password               |
|    → File contents are recognized as POSTGRES_PASSWORD           |
|                                                                  |
+------------------------------------------------------------------+
```

### 6.2 Config Definitions and Usage

```yaml
services:
  nginx:
    image: nginx:alpine
    configs:
      - source: nginx_conf
        target: /etc/nginx/nginx.conf    # Path inside container
        uid: "0"
        gid: "0"
        mode: 0444

  prometheus:
    image: prom/prometheus:v2.51.0
    configs:
      - source: prometheus_conf
        target: /etc/prometheus/prometheus.yml

configs:
  nginx_conf:
    file: ./nginx/nginx.conf

  prometheus_conf:
    file: ./prometheus/prometheus.yml
```

---

## 7. Basic Commands

### 7.1 Commonly Used Commands

```bash
# Start
docker compose up -d          # Start all services in background
docker compose up web db      # Start only specified services
docker compose up --build     # Build then start

# Stop
docker compose stop           # Stop services (keep containers)
docker compose down           # Stop services + remove containers
docker compose down -v        # + also remove volumes
docker compose down --rmi all # + also remove images

# Check status
docker compose ps             # List services
docker compose logs           # Show logs
docker compose logs -f web    # Follow logs of specific service
docker compose top            # List processes

# Execute
docker compose exec web bash  # Run command in running container
docker compose run web npm test # Run command in a new container

# Other
docker compose config         # Validate settings & show expanded result
docker compose pull           # Update images to latest
docker compose build          # Build services only
```

### 7.2 Command Flow Diagram

```
+------------------------------------------------------------------+
|              docker compose Command Flow                          |
+------------------------------------------------------------------+
|                                                                  |
|  docker compose up -d                                            |
|    |                                                             |
|    +-- Create networks (if not exist)                            |
|    +-- Create volumes (if not exist)                             |
|    +-- Pull/build images (if not exist)                          |
|    +-- Create & start containers                                 |
|    +-- Wait for health checks (if configured)                    |
|                                                                  |
|  docker compose down                                             |
|    |                                                             |
|    +-- Stop containers                                           |
|    +-- Remove containers                                         |
|    +-- Remove networks                                           |
|    +-- (Volumes are retained. Use -v to remove)                  |
|                                                                  |
+------------------------------------------------------------------+
```

### 7.3 Command Execution Pattern Comparison

```
+------------------------------------------------------------------+
|              Difference between exec and run                      |
+------------------------------------------------------------------+
|                                                                  |
|  docker compose exec web bash                                    |
|  → Connect to a running container                                |
|  → Uses the container's environment variables and network as-is  |
|  → Cannot be used when the container is stopped                  |
|  → File changes persist (until container is recreated)           |
|                                                                  |
|  docker compose run web npm test                                 |
|  → Create and run a new container                                |
|  → Port mapping is disabled by default (enable with --service-ports)|
|  → Services in depends_on are also started                       |
|  → Container remains after exit (use --rm for auto-removal)      |
|                                                                  |
|  Usage guide:                                                    |
|  +---------------------------+-----------------------------------+|
|  | Use case                  | Command                          ||
|  +---------------------------+-----------------------------------+|
|  | Debug (shell access)      | exec web bash                    ||
|  | Run tests                 | run --rm web npm test            ||
|  | Migration                 | run --rm web npm run migrate     ||
|  | One-off scripts           | run --rm web node script.js      ||
|  | Database client           | exec db psql -U postgres         ||
|  +---------------------------+-----------------------------------+|
|                                                                  |
+------------------------------------------------------------------+
```

---

## 8. Practical Configuration Examples

### 8.1 Web Application + DB + Redis

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
  node_modules:
```

### 8.2 Django + PostgreSQL + Nginx

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - static_volume:/app/staticfiles:ro
      - media_volume:/app/media:ro
    depends_on:
      web:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: .
      target: production
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@db:5432/django_app
      DJANGO_SETTINGS_MODULE: config.settings.production
      SECRET_KEY: ${DJANGO_SECRET_KEY}
      ALLOWED_HOSTS: ${ALLOWED_HOSTS:-localhost}
    expose:
      - "8000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    environment:
      POSTGRES_DB: django_app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d django_app"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Migration (run once at startup)
  migrate:
    build:
      context: .
      target: production
    command: python manage.py migrate --noinput
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@db:5432/django_app
    depends_on:
      db:
        condition: service_healthy

  # Static file collection (run once at startup)
  collectstatic:
    build:
      context: .
      target: production
    command: python manage.py collectstatic --noinput
    volumes:
      - static_volume:/app/staticfiles
    depends_on:
      migrate:
        condition: service_completed_successfully

volumes:
  pgdata:
  static_volume:
  media_volume:
```

### 8.3 Microservices Configuration

```yaml
# docker-compose.yml
services:
  # API gateway
  gateway:
    build: ./gateway
    ports:
      - "8080:8080"
    environment:
      USER_SERVICE_URL: http://user-service:3001
      ORDER_SERVICE_URL: http://order-service:3002
      PRODUCT_SERVICE_URL: http://product-service:3003
    networks:
      - frontend
      - backend
    depends_on:
      user-service:
        condition: service_healthy
      order-service:
        condition: service_healthy
      product-service:
        condition: service_healthy
    restart: unless-stopped

  # User service
  user-service:
    build: ./services/user
    expose:
      - "3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@user-db:5432/users
      REDIS_URL: redis://redis:6379/0
    networks:
      - backend
      - data
    depends_on:
      user-db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # Order service
  order-service:
    build: ./services/order
    expose:
      - "3002"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@order-db:5432/orders
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
    networks:
      - backend
      - data
    depends_on:
      order-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3002/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # Product service
  product-service:
    build: ./services/product
    expose:
      - "3003"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@product-db:5432/products
    networks:
      - backend
      - data
    depends_on:
      product-db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3003/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # Databases
  user-db:
    image: postgres:16-alpine
    volumes:
      - user_pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: users
      POSTGRES_PASSWORD: postgres
    networks:
      - data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  order-db:
    image: postgres:16-alpine
    volumes:
      - order_pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: orders
      POSTGRES_PASSWORD: postgres
    networks:
      - data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  product-db:
    image: postgres:16-alpine
    volumes:
      - product_pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: products
      POSTGRES_PASSWORD: postgres
    networks:
      - data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Message queue
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"       # Management UI (for development)
    expose:
      - "5672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - data
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  # Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
  data:
    driver: bridge
    internal: true          # No external access

volumes:
  user_pgdata:
  order_pgdata:
  product_pgdata:
  rabbitmq_data:
  redis_data:
```

### 8.4 Environment Variables and .env File Management

```bash
# .env (auto-loaded by docker compose)
COMPOSE_PROJECT_NAME=myapp
DB_PASSWORD=secure_password_here
DJANGO_SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,example.com
NODE_ENV=production
```

```yaml
# Environment variable expansion in docker-compose.yml
services:
  web:
    image: myapp:${APP_VERSION:-latest}     # With default value
    environment:
      DB_HOST: ${DB_HOST:?DB_HOST is required}  # Error if not set
      DB_PORT: ${DB_PORT:-5432}                 # Default if not set
      NODE_ENV: ${NODE_ENV}                     # Load from .env
```

```
+------------------------------------------------------------------+
|              Environment Variable Priority (high → low)           |
+------------------------------------------------------------------+
|                                                                  |
|  1. Value passed with docker compose run -e                      |
|  2. Shell environment variables (exported values)                |
|  3. environment section in compose.yml                           |
|  4. File specified with --env-file                               |
|  5. File specified with env_file in compose.yml                  |
|  6. ENV instruction in Dockerfile                                |
|                                                                  |
|  ※ .env file is used for variable expansion (${VAR}) in compose.yml|
|  ※ env_file sets environment variables directly in the container |
|  ※ Note that .env and env_file are different things              |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Anti-patterns

### Anti-pattern 1: Using the latest Tag

```yaml
# NG: Version not pinned
services:
  db:
    image: postgres:latest     # Unknown which version will be pulled
  redis:
    image: redis               # Omitting tag = latest

# OK: Explicitly pin versions
services:
  db:
    image: postgres:16-alpine  # Major version + variant
  redis:
    image: redis:7-alpine
```

**Problem**: `latest` may pull a different version each time the image is updated, causing environment differences between team members and CI/CD. PostgreSQL major version upgrades often include breaking changes, and there is a risk of data corruption from unintended upgrades.

### Anti-pattern 2: Overusing Host Network Mode

```yaml
# NG: Expose all ports with host network
services:
  db:
    image: postgres:16
    network_mode: host         # All ports exposed directly to host

# OK: Expose only necessary ports
services:
  db:
    image: postgres:16
    ports:
      - "127.0.0.1:5432:5432" # Expose to localhost only
```

**Problem**: `network_mode: host` completely disables the container's network isolation. DBs and cache servers become directly accessible from external networks, increasing security risk.

### Anti-pattern 3: Using depends_on Without a condition

```yaml
# NG: Only checks container startup (does not wait for service readiness)
services:
  web:
    build: .
    depends_on:
      - db              # Start web immediately when db container starts
  db:
    image: postgres:16-alpine
    # No health check
# -> web starts before PostgreSQL is ready to accept connections, causing connection errors

# OK: Wait for readiness with health check + condition
services:
  web:
    build: .
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Problem**: The default `depends_on` (`service_started`) only checks that the container has started. It takes a few seconds for the database to actually be able to accept queries, so the application will encounter connection errors immediately after startup. Rather than relying solely on retry logic in the application, leverage Compose's health check integration.

### Anti-pattern 4: Not Considering Volume Backups

```yaml
# NG: Named volume with no backup mechanism
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
# -> docker compose down -v completely deletes data

# OK: Prepare a backup script
# backup.sh
# docker compose exec db pg_dump -U postgres myapp > backup_$(date +%Y%m%d).sql

# Safer configuration: add a backup service
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
  backup:
    image: postgres:16-alpine
    volumes:
      - ./backups:/backups
    entrypoint: /bin/sh
    command: >
      -c "pg_dump -h db -U postgres myapp > /backups/backup_$$(date +%Y%m%d_%H%M%S).sql"
    depends_on:
      db:
        condition: service_healthy
    profiles:
      - backup              # Run manually with: docker compose --profile backup run backup
volumes:
  pgdata:
```

**Problem**: Named volumes exist independently of the container lifecycle, but are deleted by `docker compose down -v` or `docker volume prune`. When handling production data or important data, always set up a regular backup mechanism.

### Anti-pattern 5: Managing Secrets via Environment Variables

```yaml
# NG: Password hardcoded in compose file
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: my_secret_password  # Gets committed to Git
  web:
    build: .
    environment:
      DB_PASSWORD: my_secret_password        # Visible with docker inspect

# OK: Use .env files + secrets
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
  web:
    build: .
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # Add to .gitignore
```

**Problem**: Hardcoding secrets in environment variables means they get committed to the Git repository and are visible with `docker inspect`. When using `.env` files, add them to `.gitignore`, and when secrets are needed, use Docker's secrets feature.

---

## FAQ

### Q1: What is the difference between docker-compose and docker compose (without hyphen)?

**A**: `docker-compose` is Compose V1 (standalone binary) written in Python; `docker compose` is Compose V2 (Docker CLI plugin) written in Go. V1 reached EOL in June 2023, and `docker compose` V2 should be used now. They are functionally mostly compatible, but V2 is faster and integrated into the Docker CLI as a `docker compose` subcommand.

### Q2: Does setting depends_on guarantee the service startup order?

**A**: `depends_on` only controls the order containers start, not that services are "ready." For example, it takes a few seconds after a PostgreSQL container starts before it can actually accept connections. By specifying `condition: service_healthy` in `depends_on` and combining it with a health check, you can wait until the service is actually available.

### Q3: Should I separate Compose files for development and production?

**A**: Yes. It is common to separate into `docker-compose.yml` (shared/development) and `docker-compose.prod.yml` (production overrides). By specifying multiple files like `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`, the later file can override settings from the earlier file. Compose V2 also has a feature to automatically merge `compose.yml` and `compose.override.yml`.

### Q4: How do I rebuild and update only a specific service with Compose?

**A**: Specify the service name like `docker compose up -d --build web`. The `--build` flag rebuilds the image before starting. Adding `--no-deps` prevents restarting dependent services: `docker compose up -d --build --no-deps web`. If you only want to rebuild the image, use `docker compose build web`.

### Q5: Bind mounts in Compose are slow on macOS. Are there any workarounds?

**A**: On macOS (Docker Desktop for Mac), bind mount I/O performance is slower compared to native. The following workarounds are available:
- **Use VirtioFS**: Enable `VirtioFS` in Docker Desktop settings (often enabled by default). Significantly faster than gRPC FUSE
- **Volume separation**: Separate dependency directories like `node_modules` or `vendor` into named volumes
- **Synchronized file shares** (Docker Desktop 4.27+): A feature that optimizes file synchronization

```yaml
# macOS performance improvement example
services:
  web:
    volumes:
      - .:/app                               # Source code
      - node_modules:/app/node_modules       # Separated into named volume
volumes:
  node_modules:
```

### Q6: What is docker compose watch?

**A**: A feature introduced in Docker Compose v2.22+ that detects file changes and automatically executes actions. Hot reload and auto-rebuild can be managed at the Compose level.

```yaml
services:
  web:
    build: .
    develop:
      watch:
        - action: sync           # Sync files to container
          path: ./src
          target: /app/src
        - action: rebuild         # Rebuild image
          path: package.json
        - action: sync+restart    # Sync and restart container
          path: ./config
          target: /app/config
```

When started with `docker compose watch`, `sync` (file sync), `rebuild` (image rebuild + container recreation), and `sync+restart` (file sync + container restart) are automatically executed in response to file changes.

### Q7: How do I use multiple Compose files?

**A**: There are several ways to merge multiple Compose files:

```bash
# 1. Explicitly specify files with -f flag (later files override)
docker compose -f compose.yml -f compose.prod.yml up -d

# 2. compose.override.yml is automatically merged
# compose.yml         ← base configuration
# compose.override.yml ← development overrides (auto-merged)

# 3. COMPOSE_FILE environment variable
export COMPOSE_FILE=compose.yml:compose.prod.yml
docker compose up -d

# 4. include (Compose v2.20+)
# compose.yml
# include:
#   - path: ./monitoring/compose.yml
#   - path: ./logging/compose.yml
```

```yaml
# compose.yml (base)
services:
  web:
    build: .
    ports:
      - "3000:3000"

# compose.override.yml (development - auto-merged)
services:
  web:
    volumes:
      - .:/app
    environment:
      NODE_ENV: development

# compose.prod.yml (production - explicit specification)
services:
  web:
    restart: always
    environment:
      NODE_ENV: production
    deploy:
      resources:
        limits:
          memory: 512M
```

---

## Summary

| Item | Key Points |
|------|------|
| Compose file | Omit version key. Compose Specification compliant is the current standard |
| services | Container definitions. image / build / ports / environment / volumes are the basics |
| volumes | Named volumes recommended. Essential for DB data persistence |
| networks | DNS resolution by service name by default. Define explicitly when isolation is needed |
| secrets | Manage sensitive information with secrets. Safer than environment variables |
| configs | Mount configuration files. nginx.conf, prometheus.yml, etc. |
| depends_on | `condition: service_healthy` integration with health checks is important |
| healthcheck | Essential for detecting service readiness. DB uses pg_isready, HTTP uses curl |
| Resource limits | Set CPU/memory limits and reservations with deploy.resources |
| Log management | Set max-size/max-file with logging to prevent disk exhaustion |
| Commands | `up -d` / `down` / `logs -f` / `exec` are the daily basics |
| Image tags | Avoid `latest`, explicitly specify major version + variant |
| V1 vs V2 | Use `docker compose` (V2, CLI plugin). V1 is EOL |
| Environment variables | Manage with .env files. Avoid hardcoding secrets |
| File splitting | Separate development/production settings with compose.override.yml |

## Next Guides to Read

- [Compose Advanced](./01-compose-advanced.md) -- Profiles, depends_on, healthcheck, advanced usage of environment variables
- [Compose Development Workflow](./02-development-workflow.md) -- Hot reload, debugging, CI integration
- Dockerizing local services -- Practical Compose configuration for DB / Redis / MailHog

## References

1. **Docker Compose Official Reference** -- https://docs.docker.com/compose/compose-file/ -- Complete reference for the Compose file specification
2. **Compose Specification** -- https://compose-spec.io/ -- Official Docker Compose specification (GitHub)
3. **Docker Official Tutorial** -- https://docs.docker.com/compose/gettingstarted/ -- Quick start guide for Compose
4. **Docker Compose Networking** -- https://docs.docker.com/compose/networking/ -- Detailed guide for Compose network configuration
5. **Docker Compose Environment Variables** -- https://docs.docker.com/compose/environment-variables/ -- How to configure environment variables and priority
6. **Docker Compose Watch** -- https://docs.docker.com/compose/file-watch/ -- Documentation for automatic sync/rebuild via file watching
7. **Awesome Docker Compose** -- https://github.com/docker/awesome-compose -- Docker official Compose sample collection
