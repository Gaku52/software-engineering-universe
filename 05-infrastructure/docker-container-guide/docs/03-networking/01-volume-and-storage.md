# Volumes and Storage

> Understand the three mount types and storage driver mechanisms for persisting data beyond the container lifecycle.

---

## What You Will Learn

1. **Understand the differences and use cases for Named Volumes, Bind Mounts, and tmpfs**
2. **Master volume lifecycle management** (creation, backup, migration, deletion)
3. **Understand storage driver internals** and performance characteristics
4. **Learn storage design patterns for production environments**
5. **Practice optimal volume configurations for various databases**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Docker Networking](./00-docker-networking.md)

---

## 1. Why Data Persistence Is Necessary

Docker containers are designed to be immutable. The container's writable layer is destroyed when the container is deleted. Volumes are required for data that must persist beyond the container lifecycle — such as database data, uploaded files, and configuration files.

### Container Layer Structure

```
┌──────────────────────────────────────────────┐
│         Container (Writable Layer)            │
│  ┌────────────────────────────────────────┐ │
│  │  Thin R/W Layer (CoW: Copy-on-Write)  │ │ ← Lost when container is deleted
│  └────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│         Image Layers (Read-Only)              │
│  ┌────────────────────────────────────────┐ │
│  │  Layer 4: COPY app.js /app/           │ │
│  ├────────────────────────────────────────┤ │
│  │  Layer 3: RUN npm install             │ │
│  ├────────────────────────────────────────┤ │
│  │  Layer 2: RUN apt-get install nodejs  │ │
│  ├────────────────────────────────────────┤ │
│  │  Layer 1: Ubuntu 22.04 base           │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Three Data Persistence Approaches

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Host                           │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │              Container                        │       │
│  │                                               │       │
│  │  /app/data ──┐  /app/config ──┐  /tmp ──┐   │       │
│  └──────────────┼────────────────┼─────────┼───┘       │
│                 │                │         │             │
│           ┌─────▼──────┐  ┌─────▼────┐  ┌─▼────────┐  │
│           │Named Volume│  │Bind Mount│  │  tmpfs   │  │
│           │            │  │          │  │ (RAM)    │  │
│           │/var/lib/   │  │Any host  │  │In-memory │  │
│           │docker/     │  │directory │  │No disk   │  │
│           │volumes/    │  │          │  │writes    │  │
│           └────────────┘  └──────────┘  └──────────┘  │
│            Docker-managed  User-managed  Kernel-managed │
└──────────────────────────────────────────────────────────┘
```

### Comparison Table of Three Approaches

| Property | Named Volume | Bind Mount | tmpfs |
|----------|-------------|------------|-------|
| Storage location | Docker-managed area | Any path on the host | Memory (RAM) |
| Docker CLI management | Possible | Not possible | Not possible |
| Sharing between containers | Easy | Possible | Not possible |
| Data persistence | Survives container deletion | Survives container deletion | Lost when container stops |
| Performance | Driver-dependent | Native | Fastest |
| Host OS dependency | Low | High (path-dependent) | Low |
| Production recommendation | High | Low (suited for development) | Special use cases |
| Backup | Possible via Docker CLI | Possible with host tools | Not possible |
| Driver switching | Possible (NFS, etc.) | Not possible | Not possible |

---

## 2. Named Volumes

Volumes managed by the Docker engine. Stored under `/var/lib/docker/volumes/` on the host.

### Code Example 1: Basic Named Volume Operations

```bash
# Create a volume
docker volume create my-data

# List volumes
docker volume ls

# Filter volumes
docker volume ls --filter "driver=local"
docker volume ls --filter "dangling=true"   # Unused volumes

# Inspect volume details
docker volume inspect my-data
# Example output:
# [
#     {
#         "CreatedAt": "2025-01-15T10:30:00Z",
#         "Driver": "local",
#         "Labels": {},
#         "Mountpoint": "/var/lib/docker/volumes/my-data/_data",
#         "Name": "my-data",
#         "Options": {},
#         "Scope": "local"
#     }
# ]

# Start a container with the volume mounted
docker run -d \
  --name postgres-db \
  -v my-data:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=secret \
  postgres:16-alpine

# --mount syntax (recommended: more explicit)
docker run -d \
  --name postgres-db \
  --mount type=volume,source=my-data,target=/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=secret \
  postgres:16-alpine

# The volume persists even after the container is removed
docker rm -f postgres-db
docker volume ls  # my-data still exists

# Bulk delete unused volumes (use with caution)
docker volume prune

# Force delete all unused volumes
docker volume prune -a -f
```

### Code Example 2: Volume Definition in Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data       # Named Volume
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro  # Bind Mount (read-only)
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

  backup:
    image: alpine:3.19
    volumes:
      - pgdata:/source:ro          # Mount the same volume as read-only
      - ./backups:/backup
    command: >
      sh -c "tar czf /backup/pgdata-$$(date +%Y%m%d).tar.gz -C /source ."

volumes:
  pgdata:
    driver: local
    labels:
      com.example.description: "PostgreSQL data"
      com.example.environment: "production"
  redis-data:
    driver: local
```

### Volume Labels and Filtering

```bash
# Create a volume with labels
docker volume create \
  --label environment=production \
  --label service=postgres \
  prod-pgdata

# Filter by label
docker volume ls --filter "label=environment=production"
docker volume ls --filter "label=service=postgres"
```

---

## 3. Bind Mounts

A method to mount any directory or file on the host machine into a container. Widely used for source code synchronization during development.

### Code Example 3: Using Bind Mounts

```bash
# Basic Bind Mount (-v syntax)
docker run -d \
  --name dev-server \
  -v /home/user/project/src:/app/src \
  -v /home/user/project/config.yaml:/app/config.yaml:ro \
  my-app:dev

# --mount syntax (more explicit and recommended)
docker run -d \
  --name dev-server \
  --mount type=bind,source=/home/user/project/src,target=/app/src \
  --mount type=bind,source=/home/user/project/config.yaml,target=/app/config.yaml,readonly \
  my-app:dev

# Permission control
# :ro  → Read-only
# :rw  → Read-write (default)

# Behavior when a non-existent host path is specified
# -v syntax    : Automatically creates a directory (risk of unintended empty directory)
# --mount syntax: Returns an error (safer)
```

### Bind Mount Development Workflow

```
┌────────────────────────────┐
│       Development Machine   │
│                            │
│  ~/project/src/ ◄──── Edit with editor
│       │                    │
│  ┌────▼──────────────┐    │
│  │    Container       │    │
│  │  /app/src/ (bind)  │    │
│  │       │            │    │
│  │  ┌────▼────┐      │    │
│  │  │ nodemon │      │    │  ← Detects file changes and
│  │  │ (watch) │      │    │    auto-reloads
│  │  └─────────┘      │    │
│  └────────────────────┘    │
└────────────────────────────┘
```

### Bind Mount Patterns in Docker Compose

```yaml
services:
  app:
    build: .
    volumes:
      # Source code (read-write)
      - ./src:/app/src

      # Configuration files (read-only)
      - ./config:/app/config:ro

      # Single file mount
      - ./nginx.conf:/etc/nginx/nginx.conf:ro

      # node_modules isolated as Named Volume
      - node_modules:/app/node_modules

      # Long-form syntax
      - type: bind
        source: ./data
        target: /app/data
        read_only: false

volumes:
  node_modules:
```

### Bind Mount SELinux Support (RHEL/CentOS)

```bash
# Bind Mount in environments with SELinux enabled
# :z  → Set shared label (sharable across multiple containers)
# :Z  → Set private label (exclusive to a single container)
docker run -d \
  -v /data/app:/app:z \
  my-app:latest

# Specification in Docker Compose
# volumes:
#   - ./data:/app/data:z
```

---

## 4. tmpfs Mounts

A temporary filesystem that exists only in memory. Since data is never written to disk, it is suitable for temporary storage of sensitive data and temporary files where performance matters.

### Code Example 4: Using tmpfs

```bash
# tmpfs mount
docker run -d \
  --name secure-app \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --mount type=tmpfs,destination=/run/secrets,tmpfs-size=10m,tmpfs-mode=0700 \
  my-app

# Specification in Docker Compose
```

```yaml
# docker-compose.yml
services:
  app:
    image: my-app
    tmpfs:
      - /tmp:size=100m,mode=1777
    volumes:
      - type: tmpfs
        target: /run/secrets
        tmpfs:
          size: 10485760  # 10MB
          mode: 0700

  # Test DB (no persistence needed → speed up with tmpfs)
  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: test
    tmpfs:
      - /var/lib/postgresql/data:size=512m
    # → Test DB runs without disk I/O
```

### Use Cases for tmpfs

| Use Case | Reason |
|----------|--------|
| Test DB | No persistence needed. Run tests quickly in memory |
| Session store | Temporary data that is acceptable to reset on restart |
| Temporary file processing | Intermediate files for image conversion or PDF generation |
| Secret storage | Safe because data is never written to disk |
| CI/CD pipelines | Speed up test execution |

### Mount Type Selection Flow by Use Case

```
Is data persistence required?
    │
    ├── Yes ──► Does the host-side path need to be specified?
    │               │
    │               ├── Yes ──► Bind Mount
    │               │           (e.g., source code sync during development)
    │               │
    │               └── No ───► Named Volume
    │                           (DB, app data, etc.)
    │
    └── No ───► Is security/performance critical?
                    │
                    ├── Yes ──► tmpfs
                    │           (temporary files, secrets)
                    │
                    └── No ───► Container writable layer
                                (temporary data such as logs)
```

---

## 5. Volume Backup and Migration

### Code Example 5: Backup, Restore, and Migration

```bash
# === Backup ===
# Compress a volume to tar using a separate container
docker run --rm \
  -v my-data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine:3.19 \
  tar czf /backup/my-data-backup.tar.gz -C /source .

# === Restore ===
# Restore a volume from a backup
docker volume create my-data-restored

docker run --rm \
  -v my-data-restored:/target \
  -v $(pwd)/backups:/backup:ro \
  alpine:3.19 \
  tar xzf /backup/my-data-backup.tar.gz -C /target

# === Volume Migration (Between Hosts) ===
# 1. Backup on the source host
docker run --rm \
  -v my-data:/source:ro \
  alpine:3.19 \
  tar czf - -C /source . | ssh user@remote-host \
  "docker run --rm -i -v my-data:/target alpine:3.19 tar xzf - -C /target"

# === Copy a Volume ===
docker volume create my-data-copy

docker run --rm \
  -v my-data:/from:ro \
  -v my-data-copy:/to \
  alpine:3.19 \
  sh -c "cp -av /from/. /to/"
```

### Code Example 5b: Automating Periodic Backups

```yaml
# docker-compose.yml - Periodic backup configuration
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  # Periodic backup container
  backup:
    image: postgres:16-alpine
    volumes:
      - ./backups:/backups
    environment:
      PGPASSWORD: ${DB_PASSWORD}
    # Backup at 3 AM daily (entrypoint script as cron alternative)
    entrypoint: >
      sh -c "
        while true; do
          echo \"[$(date)] Starting backup...\"
          pg_dump -h postgres -U postgres myapp | \
            gzip > /backups/myapp-$(date +%Y%m%d-%H%M%S).sql.gz
          echo \"[$(date)] Backup completed.\"
          # Delete backups older than 7 days
          find /backups -name '*.sql.gz' -mtime +7 -delete
          sleep 86400
        done
      "
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

```bash
#!/bin/bash
# scripts/backup.sh - Manual backup script

set -euo pipefail

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "=== PostgreSQL Backup ==="
docker compose exec -T postgres \
  pg_dump -U postgres myapp | gzip > "${BACKUP_DIR}/postgres-${TIMESTAMP}.sql.gz"
echo "  → ${BACKUP_DIR}/postgres-${TIMESTAMP}.sql.gz"

echo "=== Volume Backup ==="
docker run --rm \
  -v myapp_pgdata:/source:ro \
  -v "$(pwd)/backups":/backup \
  alpine:3.19 \
  tar czf "/backup/pgdata-${TIMESTAMP}.tar.gz" -C /source .
echo "  → ${BACKUP_DIR}/pgdata-${TIMESTAMP}.tar.gz"

echo "=== Redis Backup ==="
docker compose exec redis redis-cli BGSAVE
sleep 2
docker compose cp redis:/data/dump.rdb "${BACKUP_DIR}/redis-${TIMESTAMP}.rdb"
echo "  → ${BACKUP_DIR}/redis-${TIMESTAMP}.rdb"

echo "=== Backup Complete ==="
ls -lh "${BACKUP_DIR}/"*"${TIMESTAMP}"*
```

### Code Example 6: NFS Volume Driver

```bash
# Create a volume with an NFS backend
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.100,rw,nfsvers=4 \
  --opt device=:/exports/data \
  nfs-data
```

```yaml
# docker-compose.yml - NFS volume
volumes:
  shared-data:
    driver: local
    driver_opts:
      type: nfs
      o: "addr=192.168.1.100,rw,nfsvers=4"
      device: ":/exports/data"

  # CIFS/SMB volume (Windows file server)
  smb-data:
    driver: local
    driver_opts:
      type: cifs
      o: "addr=192.168.1.200,username=user,password=pass,file_mode=0777,dir_mode=0777"
      device: "//192.168.1.200/shared"
```

---

## 6. Storage Drivers

### How Storage Drivers Work (Union File System)

```
┌─────────────────────────────────────────────┐
│           Container (Read/Write Layer)       │
│  ┌────────────────────────────────────────┐ │
│  │  Thin R/W Layer (CoW: Copy-on-Write)  │ │
│  └────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│           Image Layers (Read-Only)           │
│  ┌────────────────────────────────────────┐ │
│  │  Layer 4: COPY app.js /app/           │ │
│  ├────────────────────────────────────────┤ │
│  │  Layer 3: RUN npm install             │ │
│  ├────────────────────────────────────────┤ │
│  │  Layer 2: RUN apt-get install nodejs  │ │
│  ├────────────────────────────────────────┤ │
│  │  Layer 1: Ubuntu 22.04 base           │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### How Copy-on-Write (CoW) Works

```
On read:
  App reads /app/config.json
    → File not found in R/W layer
    → Read from lower layer (Layer 4)
    → File found → Return it

On write (Copy-on-Write):
  App modifies /app/config.json
    1. Copy file from lower layer to R/W layer
    2. Modify the copy in the R/W layer
    3. Subsequent reads return the copy from the R/W layer
    * The original file in the lower layer is not modified
```

### Storage Driver Comparison Table

| Driver | Backing FS | Characteristics | Recommended Environment |
|--------|-----------|-----------------|------------------------|
| overlay2 | xfs, ext4 | Current default. Stable and fast | All environments (recommended) |
| btrfs | btrfs | Leverages snapshots | Environments using btrfs |
| zfs | zfs | Snapshots and compression | Environments using zfs |
| devicemapper | direct-lvm | Block-level operations | RHEL/CentOS (deprecated) |
| vfs | Any FS | No CoW (full copy). Slowest | Testing only |

### Code Example 7: Checking and Configuring Storage Drivers

```bash
# Check the current storage driver
docker info | grep "Storage Driver"
# Example output: Storage Driver: overlay2

# Check storage usage
docker system df
# Example output:
# TYPE            TOTAL   ACTIVE  SIZE      RECLAIMABLE
# Images          15      5       3.2GB     1.8GB (56%)
# Containers      8       3       256MB     128MB (50%)
# Local Volumes   12      4       5.1GB     3.2GB (62%)
# Build Cache     45      0       890MB     890MB (100%)

# Verbose output
docker system df -v

# Bulk cleanup of unused data
docker system prune -a --volumes
# WARNING: This also deletes volumes
```

### Changing the Storage Driver

```json
// /etc/docker/daemon.json
{
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true",
    "overlay2.size=20G"
  ]
}
```

```bash
# Restart the Docker daemon after changing the configuration
sudo systemctl restart docker

# Verify the change
docker info | grep "Storage Driver"
```

---

## 7. Volume Configuration for Various Databases

### PostgreSQL

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: myapp
      # Performance tuning
      POSTGRES_INITDB_ARGS: "--data-checksums"
    volumes:
      - pgdata:/var/lib/postgresql/data
      # Initialization scripts
      - ./initdb:/docker-entrypoint-initdb.d:ro
      # Custom configuration
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    shm_size: '256m'    # PostgreSQL makes heavy use of shared memory
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  pgdata:
```

### MySQL / MariaDB

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: myapp
      MYSQL_USER: app_user
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./my.cnf:/etc/mysql/conf.d/my.cnf:ro
      - ./initdb:/docker-entrypoint-initdb.d:ro
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  mysql-data:
```

### MongoDB

```yaml
services:
  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - mongo-data:/data/db
      - mongo-config:/data/configdb
      # Initialization scripts
      - ./mongo-init:/docker-entrypoint-initdb.d:ro
    command: mongod --wiredTigerCacheSizeGB 0.5

volumes:
  mongo-data:
  mongo-config:
```

### Elasticsearch

```yaml
services:
  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
      - xpack.security.enabled=false
    volumes:
      - es-data:/usr/share/elasticsearch/data
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536

volumes:
  es-data:
```

---

## 8. Performance Optimization

### Code Example 8: Improving Bind Mount Performance on macOS

```yaml
# docker-compose.yml
# Workaround for slow Bind Mounts on macOS
services:
  app:
    build: .
    volumes:
      # Source code as bind mount
      - ./src:/app/src

      # node_modules managed as Named Volume (faster than Bind Mount)
      - node_modules:/app/node_modules

      # Build artifacts also isolated as Volumes
      - build_cache:/app/.next
      - dist_cache:/app/dist

volumes:
  node_modules:
  build_cache:
  dist_cache:
```

### Performance Benchmark (macOS)

```
┌──────────────────────────────────────────────┐
│    File I/O Performance Comparison on macOS  │
├──────────────────────────────────────────────┤
│                                              │
│  Operation             │ Bind Mount │ Volume  │
│  ──────────────────────┼────────────┼─────────│
│  npm install (10000+)  │ 120s       │ 15s     │
│  tsc compile           │ 30s        │ 5s      │
│  Next.js build         │ 90s        │ 20s     │
│  File read             │ Slow       │ Fast    │
│  File write            │ Slow       │ Fast    │
│                                              │
│  Conclusion: Volume wins overwhelmingly for  │
│              large-scale file operations.    │
│              Bind Mount is needed for source │
│              code sync.                      │
│  → "Source as Bind, dependencies as Volume" │
└──────────────────────────────────────────────┘
```

### Volume I/O Performance Tuning

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    volumes:
      # High-speed storage for WAL logs
      - pgdata:/var/lib/postgresql/data
      - pg-wal:/var/lib/postgresql/data/pg_wal
    # PostgreSQL I/O tuning
    command: >
      postgres
        -c shared_buffers=256MB
        -c effective_cache_size=768MB
        -c wal_buffers=8MB
        -c checkpoint_completion_target=0.9
        -c random_page_cost=1.1

volumes:
  pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /ssd/postgres/data    # Directory on SSD
  pg-wal:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /nvme/postgres/wal    # Directory on NVMe
```

---

## 9. Volume Monitoring and Maintenance

### Monitoring Volume Size

```bash
# Check disk usage per volume
docker system df -v

# Check the size of a specific volume
docker run --rm -v myapp_pgdata:/data alpine du -sh /data

# List the sizes of all volumes
for vol in $(docker volume ls -q); do
  size=$(docker run --rm -v "${vol}":/data alpine du -sh /data 2>/dev/null | cut -f1)
  echo "${vol}: ${size}"
done
```

### Periodic Maintenance Script

```bash
#!/bin/bash
# scripts/volume-maintenance.sh

echo "=== Docker Volume Maintenance ==="
echo "Date: $(date)"

# 1. Disk usage
echo ""
echo "--- Disk Usage ---"
docker system df

# 2. Unused volumes
echo ""
echo "--- Dangling Volumes ---"
docker volume ls --filter "dangling=true"

# 3. Size of each volume
echo ""
echo "--- Volume Sizes ---"
for vol in $(docker volume ls -q); do
  size=$(docker run --rm -v "${vol}":/data alpine du -sh /data 2>/dev/null | cut -f1)
  echo "  ${vol}: ${size}"
done

# 4. Cleanup unused volumes (with confirmation)
echo ""
read -p "Remove dangling volumes? (y/N): " confirm
if [ "$confirm" = "y" ]; then
  docker volume prune -f
  echo "Dangling volumes removed."
fi
```

---

## Anti-Patterns

### Anti-Pattern 1: Writing Large Amounts of Data to the Container Writable Layer

```bash
# Bad: Running a DB without a volume
docker run -d postgres:16
# → All data is lost when the container is deleted
# → The writable layer is slow due to CoW overhead

# Good: Store data in a Named Volume
docker run -d \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16
```

**Why this is a problem**: The container writable layer operates using Copy-on-Write, so large amounts of writes degrade performance. Additionally, data is lost when the container is deleted.

### Anti-Pattern 2: Heavy Use of Bind Mounts in Production

```yaml
# Bad: Depending on host paths in production
services:
  app:
    volumes:
      - /opt/myapp/data:/data         # Strong dependency on host path
      - /opt/myapp/config:/config     # Difficult to migrate to another host

# Good: Ensure portability with Named Volumes
services:
  app:
    volumes:
      - app-data:/data
      - app-config:/config
volumes:
  app-data:
  app-config:
```

**Why this is a problem**: Bind Mounts depend on the host's directory structure, making migration to different hosts or scale-out difficult. Named Volumes are portable — you can switch to NFS or cloud storage simply by changing the volume driver.

### Anti-Pattern 3: No Periodic Volume Backups

```yaml
# Bad: DB with no backup setup
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    # No backup mechanism → All data lost in a disk failure

# Good: Include a companion backup container
services:
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

  backup:
    image: postgres:16-alpine
    volumes:
      - ./backups:/backups
    entrypoint: >
      sh -c "while true; do
        pg_dump -h db -U postgres myapp | gzip > /backups/daily-$$(date +%Y%m%d).sql.gz;
        find /backups -mtime +30 -delete;
        sleep 86400;
      done"
```

**Why this is a problem**: Volume data can also be lost due to disk failures or operational mistakes. Regular backups and restore testing are essential.

### Anti-Pattern 4: Running `docker volume prune` Without Care

```bash
# Bad: Delete all unused volumes without confirmation
docker volume prune -f
# → May include data from stopped containers

# Good: Verify first, then delete
docker volume ls --filter "dangling=true"
# Review the output, then:
docker volume rm <specific-volume-name>
```

**Why this is a problem**: `docker volume prune` deletes all volumes that are "not mounted by any container." This includes volumes used by stopped containers, so important data can be unintentionally lost.


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate the input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured configuration file | Verify the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Review error messages**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate incrementally**: Use logging and a debugger to verify hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator to log function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debugging target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Inspect for memory leaks
3. **Check I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Review the state of the connection pool

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes criteria for making technology choices.

| Criterion | Prioritize When | Can Compromise When |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow         │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                  │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. Independence between teams?                 │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering carries high short-term costs and can cause project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is more intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum viable feature set
- Automate tests for critical paths only
- Introduce monitoring early

**Lessons Learned:**
- Don't strive for perfection (YAGNI principle)
- Gather user feedback early
- Manage technical debt intentionally

### Scenario 2: Legacy System Modernization

**Situation:** Incrementally modernizing a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first when there are no existing tests
- Use an API gateway to coexist old and new systems
- Migrate data incrementally

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development in a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries using Domain-Driven Design
- Set ownership per team
- Manage shared libraries with Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# API contract definition between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Check SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** Systems where millisecond-level response times are required

**Optimization Points:**
1. Caching strategy (L1: In-memory, L2: Redis, L3: CDN)
2. Leveraging async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|------------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy workloads |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound workloads |

---

## Team Development Practices

### Code Review Checklist

Points to verify in code reviews related to this topic:

- [ ] Is the naming convention consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security concerns?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|--------|-----------|----------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (design records) | As needed | Future members | Transparency in decision-making |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Key designs | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │ned  │imme-│
    │resp │diate│
    │onse │ly   │
    ├─────┼─────┤
    │     │Next │
    │Log  │Sprint│
    │only │     │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```

---

## Security Considerations

### Common Vulnerabilities and Countermeasures

| Vulnerability | Risk Level | Countermeasure | Detection Method |
|---------------|------------|----------------|-----------------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication failures | High | Multi-factor auth, session management hardening | Penetration testing |
| Exposure of sensitive data | High | Encryption, access control | Security audit |
| Misconfiguration | Medium | Security headers, principle of least privilege | Configuration scan |
| Insufficient logging | Medium | Structured logs, audit trail | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input value"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not output to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is properly configured
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not contain internal information
---

## FAQ

### Q1: Where is Named Volume data stored?

On Linux, it is stored under `/var/lib/docker/volumes/<volume-name>/_data/`. On Docker Desktop (macOS/Windows), the path is inside a virtual machine, so access it through a container like: `docker run --rm -v <volume-name>:/data alpine ls /data`.

### Q2: Which should I use, `-v` or `--mount`?

`--mount` is recommended. Reasons:
- The syntax is explicit and readable
- Returns an error if a non-existent host path is specified (`-v` creates it automatically)
- Richer options for tmpfs

```bash
# -v syntax (with implicit behavior)
docker run -v mydata:/data app

# --mount syntax (explicit and safe)
docker run --mount type=volume,source=mydata,target=/data app
```

### Q3: How do I resolve volume permission issues (Permission Denied)?

If the process inside the Docker container runs as a non-root user, file ownership on the volume may not match.

```dockerfile
# Explicitly set user in Dockerfile
FROM node:20-alpine
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME /app/data
```

```bash
# Fix permissions on an existing volume
docker run --rm -v mydata:/data alpine chown -R 1000:1000 /data
```

### Q4: How do I integrate Named Volumes with external storage (e.g., S3)?

Use a Docker Volume Plugin. For example, the `rexray/s3fs` plugin lets you mount S3 as a volume. Note that block storage (EBS, etc.) often offers better performance.

```bash
# Install S3 volume driver plugin
docker plugin install rexray/s3fs \
  S3FS_ACCESSKEY=xxx \
  S3FS_SECRETKEY=xxx

# Create a volume backed by S3
docker volume create -d rexray/s3fs my-s3-data
```

### Q5: How do I encrypt volumes?

Docker itself has no volume encryption feature. Use the following approaches:
- Host OS-level disk encryption (LUKS, dm-crypt)
- Cloud provider encrypted storage (AWS EBS encryption, GCP Persistent Disk encryption)
- Encryption features of volume plugins

### Q6: What should I be careful about when sharing volumes between containers?

When multiple containers mount the same volume simultaneously, be mindful of data consistency.

```yaml
# docker-compose.yml
services:
  writer:
    image: my-writer-app:latest
    volumes:
      - shared-data:/data   # With write access

  reader:
    image: my-reader-app:latest
    volumes:
      - shared-data:/data:ro   # Read-only

  processor:
    image: my-processor:latest
    volumes:
      - shared-data:/data:ro   # Read-only

volumes:
  shared-data:
```

Notes:
- **File locking**: When multiple containers write to the same file, implement a locking mechanism at the application level
- **Read-only**: Containers that only need to read should mount explicitly with `:ro`
- **Databases**: Database volumes should in principle be accessed by only one container. For replication, use the database's native features (e.g., PostgreSQL streaming replication)
- **NFS**: Use NFS volumes when sharing files across multiple hosts

### Q7: What is the volume cleanup strategy?

Unused volumes accumulate and can fill up disk space. Establish a safe cleanup procedure.

```bash
# Check unused volumes (without deleting)
docker volume ls -f dangling=true

# Delete unused volumes
docker volume prune

# Delete all unused resources (images, containers, networks, volumes)
docker system prune --volumes

# Label-based cleanup (safer)
docker volume ls --filter "label=environment=development" -q | xargs docker volume rm
```

```bash
#!/bin/bash
# cleanup-volumes.sh - Safe volume cleanup script

set -euo pipefail

echo "=== Current Volume Usage ==="
docker system df -v | head -20

echo ""
echo "=== Unused Volumes ==="
DANGLING=$(docker volume ls -f dangling=true -q)

if [ -z "$DANGLING" ]; then
    echo "No unused volumes found."
    exit 0
fi

echo "$DANGLING"
echo ""
echo "Total: $(echo "$DANGLING" | wc -l) volumes"
echo ""

# Check for protected volumes (exclude those with prod/production in the name)
SAFE_TO_DELETE=$(echo "$DANGLING" | grep -v -E "(prod|production|backup)" || true)

if [ -z "$SAFE_TO_DELETE" ]; then
    echo "No volumes safe to delete."
    exit 0
fi

echo "The following volumes will be deleted:"
echo "$SAFE_TO_DELETE"
echo ""
read -p "Proceed? (y/N): " confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    echo "$SAFE_TO_DELETE" | xargs docker volume rm
    echo "Deletion complete."
else
    echo "Cancelled."
fi
```

### Q8: How do I set an explicit volume name in Docker Compose?

By default, the format is `<project-name>_<volume-name>`, but you can set an explicit name with the `name` field.

```yaml
volumes:
  pgdata:
    name: my-app-pgdata   # Explicit name (no project name prefix)
    driver: local
    labels:
      com.example.project: "my-app"
      com.example.type: "database"
```

### Q9: What is the procedure for migrating volume data?

How to migrate volume data from one host to another.

```bash
#!/bin/bash
# migrate-volume.sh - Volume data migration

SOURCE_VOLUME=$1
TARGET_HOST=$2
TARGET_VOLUME=$3

# 1. Export source volume to tar
echo "[1/3] Exporting volume..."
docker run --rm \
  -v ${SOURCE_VOLUME}:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/volume-backup.tar.gz -C /source .

# 2. Transfer tar file to remote host
echo "[2/3] Transferring to remote host..."
scp volume-backup.tar.gz ${TARGET_HOST}:/tmp/

# 3. Import volume on the remote host
echo "[3/3] Importing on remote host..."
ssh ${TARGET_HOST} << 'EOF'
docker volume create ${TARGET_VOLUME}
docker run --rm \
  -v ${TARGET_VOLUME}:/target \
  -v /tmp:/backup:ro \
  alpine sh -c "cd /target && tar xzf /backup/volume-backup.tar.gz"
rm /tmp/volume-backup.tar.gz
echo "Migration complete."
EOF

# Remove local backup file
rm volume-backup.tar.gz
echo "All operations completed."
```

### Q10: Can I set a size limit for volumes?

Docker's default local driver has no direct size limit feature. Use the following approaches.

1. **For tmpfs**: Limit with the `size` option

```yaml
services:
  app:
    tmpfs:
      - /tmp:size=100m
```

2. **xfs + pquota**: When the host uses the xfs filesystem

```bash
# Enable project quota on xfs
docker daemon --storage-opt dm.basesize=20G
```

3. **Volume plugins**: Some plugins support size limits

4. **Monitoring-based**: Use monitoring and alerts instead of hard size limits

```bash
# Periodic volume size check script
docker system df -v | grep "VOLUME" -A 100 | \
  awk '$NF ~ /GB/ && $NF+0 > 10 {print "WARNING: " $1 " is " $NF}'
```

---

## Summary

| Item | Key Points |
|------|-----------|
| Named Volume | Docker-managed. Recommended for production. Portable |
| Bind Mount | Directly tied to host path. Suited for development. Use `--mount` syntax |
| tmpfs | In-memory. Ideal for temporary storage of sensitive data |
| Storage driver | overlay2 is the recommended default. Operates with CoW |
| Backup | Use tar with a separate container. Regular backups are essential |
| Performance | Always use Named Volume for DB. Isolate dependencies as Volumes on macOS |
| Permissions | Use chown in Dockerfile. Combine with non-root user configuration |
| NFS/External storage | Configure with driver_opts. Useful for multi-host sharing |
| Monitoring | Check regularly with `docker system df -v` |

---

## Guides to Read Next

- [Reverse Proxy](./02-reverse-proxy.md) -- Nginx/Traefik configuration and Docker integration
- [Production Best Practices](../04-production/00-production-best-practices.md) -- Production configuration including volume strategy
- [Kubernetes Persistent Volumes](../05-orchestration/02-kubernetes-advanced.md) -- Storage management with PV/PVC

---

## References

1. Docker official documentation "Manage data in Docker" -- https://docs.docker.com/storage/
2. Docker official documentation "Use volumes" -- https://docs.docker.com/storage/volumes/
3. Docker official documentation "Storage drivers" -- https://docs.docker.com/storage/storagedriver/
4. Docker official documentation "Bind mounts" -- https://docs.docker.com/storage/bind-mounts/
5. Docker official documentation "tmpfs mounts" -- https://docs.docker.com/storage/tmpfs/
6. Nigel Poulton (2023) *Docker Deep Dive*, Chapter 13: Volumes and Persistent Data
7. Adrian Mouat (2023) *Using Docker*, Chapter 8: Managing Data with Volumes
