# Docker Basic Operations

> A systematic guide covering Docker's everyday operations: pulling images, starting/stopping/deleting containers, viewing logs, and working inside containers.

---

## What You Will Learn

1. Understand the **relationship between images and containers** and grasp the full lifecycle
2. Master the **major options of docker run** and launch containers according to your needs
3. Build practical skills in **log inspection, in-container operations, and resource management**
4. Understand **network connectivity and volume mounting** and apply them in real-world scenarios
5. Achieve stable container operation through **resource limits and monitoring**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Docker Installation Guide](./01-docker-install.md)

---

## 1. Relationship Between Images and Containers

### 1.1 Conceptual Model

```
+--------------------------------------------------+
|                   Registry                        |
|              (Docker Hub, etc.)                   |
|  +----------+  +----------+  +----------+        |
|  | nginx    |  | postgres |  | node     |        |
|  | :1.25    |  | :16      |  | :20      |        |
|  +----------+  +----------+  +----------+        |
+--------|-----------------------------------------+
         | docker pull
         v
+--------------------------------------------------+
|              Local Images                         |
|  +--------------------------------------------+  |
|  |  Image = Read-only template                 |  |
|  |  (stack of layers)                         |  |
|  |                                            |  |
|  |  Layer 3: Application code                 |  |
|  |  Layer 2: Dependency packages              |  |
|  |  Layer 1: Base OS (alpine, etc.)           |  |
|  +--------------------------------------------+  |
+--------|-----------------------------------------+
         | docker run (image + writable layer)
         v
+--------------------------------------------------+
|              Container (running instance)         |
|  +--------------------------------------------+  |
|  |  Writable layer (container-specific)        |  |
|  |  --------------------------------          |  |
|  |  Image layers (read-only, shared)          |  |
|  +--------------------------------------------+  |
|  Multiple containers can be created from one image|
+--------------------------------------------------+
```

### 1.2 Container Lifecycle

```
                docker create
                     |
                     v
  +--------+    +---------+    docker start    +---------+
  | None   |--->| Created |------------------>| Running |
  +--------+    +---------+                    +---------+
       ^             |                          |   |   |
       |             |  docker rm               |   |   |
       +-------------+                         |   |   |
       |                                       |   |   |
       |        docker stop / container exit   |   |   |
       |             +-------------------------+   |   |
       |             v                             |   |
       |        +---------+    docker restart      |   |
       |        | Stopped  |---------------------->+   |
       |        | (Exited) |                           |
       |        +---------+                           |
       |             |                                |
       |  docker rm  |       docker pause             |
       +-------------+            |                   |
                                  v                   |
                            +----------+              |
                            |  Paused  |--------------+
                            +----------+  docker unpause
```

### 1.3 Container State Reference

| State | Description | Transitioned From | Command |
|---|---|---|---|
| Created | Container created but not yet started | - | `docker create` |
| Running | Container is executing | Created, Stopped, Paused | `docker start`, `docker restart`, `docker unpause` |
| Paused | Process is suspended | Running | `docker pause` |
| Stopped (Exited) | Main process has exited | Running | `docker stop`, process exit |
| Removing | Deletion in progress | Created, Stopped | `docker rm` |
| Dead | Abnormal exit (resource release failed) | Running | On abnormal event |

### 1.4 Containers vs Virtual Machines

```
+-----------------------------------------------+
|  Virtual Machine (VM)     |  Container         |
|                          |                     |
|  +---+ +---+ +---+      |  +---+ +---+ +---+ |
|  |App| |App| |App|      |  |App| |App| |App| |
|  +---+ +---+ +---+      |  +---+ +---+ +---+ |
|  |Lib| |Lib| |Lib|      |  |Lib| |Lib| |Lib| |
|  +---+ +---+ +---+      |  +---+ +---+ +---+ |
|  |OS | |OS | |OS |      |  +-----------------+|
|  +---+ +---+ +---+      |  |   Docker Engine ||
|  +-------------------+   |  +-----------------+|
|  |   Hypervisor      |   |  |    Host OS      ||
|  +-------------------+   |  +-----------------+|
|  |    Host OS        |   |                     |
|  +-------------------+   |                     |
|                          |                     |
|  Boot: minutes           |  Boot: seconds      |
|  Size: several GB        |  Size: tens of MB   |
|  Overhead: high          |  Overhead: low      |
|  Isolation: high         |  Isolation: medium  |
+-----------------------------------------------+
```

---

## 2. Basics of docker run

### 2.1 Basic Syntax

```bash
docker run [OPTIONS] IMAGE[:TAG] [COMMAND] [ARG...]
```

### 2.2 Simplest Execution

```bash
# Run and display result (foreground)
docker run --rm alpine echo "Hello, Docker!"
# Hello, Docker!

# --rm: automatically remove the container on exit
# alpine: lightweight Linux image (approx. 5MB)
# echo "Hello, Docker!": command to run inside the container
```

### 2.3 Interactive Mode

```bash
# Start a shell inside the container
docker run -it --rm alpine /bin/sh

# -i: keep stdin open (interactive)
# -t: allocate a pseudo-TTY (tty)
# combined as -it for an interactive shell

# Operations inside the container
/ # ls
/ # cat /etc/os-release
/ # exit

# Interactive operation on Ubuntu base
docker run -it --rm ubuntu:22.04 /bin/bash
root@abc123:/# apt-get update
root@abc123:/# apt-get install -y curl
root@abc123:/# curl -s https://httpbin.org/ip
root@abc123:/# exit

# Python interactive shell
docker run -it --rm python:3.12-slim python
>>> print("Hello from Docker!")
>>> import sys; print(sys.version)
>>> exit()
```

### 2.4 Background Execution

```bash
# Run in detached mode
docker run -d --name my-nginx -p 8080:80 nginx:alpine

# -d: run in the background (detach)
# --name my-nginx: assign a name to the container
# -p 8080:80: map host port 8080 to container port 80

# Verify operation
curl http://localhost:8080

# Return to foreground (stream logs)
docker attach my-nginx
# Ctrl+C to stop, Ctrl+P Ctrl+Q to detach

# Check container ID
docker ps
# CONTAINER ID   IMAGE          COMMAND                  CREATED          STATUS          PORTS                  NAMES
# a1b2c3d4e5f6   nginx:alpine   "/docker-entrypoint.…"   10 seconds ago   Up 9 seconds    0.0.0.0:8080->80/tcp   my-nginx
```

### 2.5 Setting Environment Variables

```bash
# Run with environment variables specified
docker run -d --name my-db \
    -e POSTGRES_USER=admin \
    -e POSTGRES_PASSWORD=secret123 \
    -e POSTGRES_DB=myapp \
    -p 5432:5432 \
    postgres:16-alpine

# Load from .env file
# .env file contents:
# POSTGRES_USER=admin
# POSTGRES_PASSWORD=secret123
# POSTGRES_DB=myapp
docker run -d --name my-db \
    --env-file .env \
    -p 5432:5432 \
    postgres:16-alpine

# Confirm environment variables
docker exec my-db env | grep POSTGRES

# Inherit environment variables from the host
export MY_VAR=hello
docker run --rm -e MY_VAR alpine env | grep MY_VAR
# MY_VAR=hello
```

### 2.6 Restart Policy

```bash
# Always restart (except manual stop)
docker run -d --name always-up \
    --restart unless-stopped \
    nginx:alpine

# Restart policy types
# no:            do not restart (default)
# on-failure:    restart only on abnormal exit
# on-failure:5:  restart up to 5 times
# always:        always restart (resumes on Docker startup even after manual stop)
# unless-stopped: always restart (does not resume on Docker startup if manually stopped)

# Change restart policy (for a running container)
docker update --restart unless-stopped my-nginx

# Check restart count
docker inspect --format '{{.RestartCount}}' my-container
docker inspect --format '{{.State.StartedAt}}' my-container
```

### 2.7 Using Labels

```bash
# Assign labels to a container
docker run -d --name web \
    --label env=production \
    --label team=backend \
    --label version=1.2.3 \
    nginx:alpine

# Filter by label
docker ps --filter "label=env=production"
docker ps --filter "label=team=backend"

# Inspect labels
docker inspect --format '{{.Config.Labels}}' web
# map[env:production team:backend version:1.2.3]
```

---

## 3. Port Mapping

### 3.1 How Port Mapping Works

```
+-----------------------------------------------------+
|                    Host Machine                      |
|                                                     |
|  Browser ----> localhost:8080 ---+                  |
|                                  |                  |
|  +-------------------------------|---------+        |
|  |        Docker Network         |         |        |
|  |                               v         |        |
|  |  +----------+  +-----------+           |        |
|  |  | Container A|  | Container B|          |        |
|  |  | :80      |  | :3000     |           |        |
|  |  +----------+  +-----------+           |        |
|  |   8080:80       3000:3000              |        |
|  +----------------------------------------+        |
+-----------------------------------------------------+
```

```bash
# Basic port mapping
docker run -d -p 8080:80 nginx:alpine
# host:8080 -> container:80

# Mapping multiple ports
docker run -d -p 8080:80 -p 8443:443 nginx:alpine

# Random port assignment
docker run -d -P nginx:alpine
docker port $(docker ps -q -l)
# 0.0.0.0:32768->80/tcp

# Bind to a specific IP
docker run -d -p 127.0.0.1:8080:80 nginx:alpine
# Accessible from localhost only

# UDP port mapping
docker run -d -p 5353:53/udp dns-server

# Bind to all interfaces (default)
docker run -d -p 0.0.0.0:8080:80 nginx:alpine

# Bind with IPv6
docker run -d -p "[::1]:8080:80" nginx:alpine
```

### 3.2 Checking Port Mappings

```bash
# Check container port mappings
docker port my-nginx
# 80/tcp -> 0.0.0.0:8080

# Check a specific port
docker port my-nginx 80
# 0.0.0.0:8080

# Check port mappings with docker ps
docker ps --format "table {{.Names}}\t{{.Ports}}"
# NAMES       PORTS
# my-nginx    0.0.0.0:8080->80/tcp

# Check ports in use on the host
# macOS
lsof -i :8080
# Linux
ss -tlnp | grep 8080
```

### 3.3 Network Modes

```bash
# bridge (default): isolated network namespace
docker run -d --network bridge nginx:alpine

# host: use the host's network directly (Linux only)
docker run -d --network host nginx:alpine
# No port mapping needed; access directly on port 80

# none: disable networking
docker run -d --network none alpine sleep infinity

# Network mode comparison
# bridge: isolated, requires port mapping, default
# host:   no isolation, no port mapping needed, high performance
# none:   completely isolated, no external communication, security-focused
```

---

## 4. Volume Mounting

### 4.1 Types of Mounts

```
+------------------------------------------------------+
|                   Types of Mounts                    |
|                                                      |
|  1. Bind Mount                                       |
|  +------------------+     +-------------------+      |
|  | Host directory   | --> | Path in container |      |
|  | ./src            |     | /app/src          |      |
|  +------------------+     +-------------------+      |
|                                                      |
|  2. Named Volume                                     |
|  +------------------+     +-------------------+      |
|  | Docker-managed   | --> | Path in container |      |
|  | my-data          |     | /var/lib/data     |      |
|  +------------------+     +-------------------+      |
|                                                      |
|  3. tmpfs Mount                                      |
|  +------------------+     +-------------------+      |
|  | In memory        | --> | Path in container |      |
|  | (volatile)       |     | /tmp              |      |
|  +------------------+     +-------------------+      |
+------------------------------------------------------+
```

```bash
# Bind mount (best for development)
docker run -d --name dev-app \
    -v $(pwd)/src:/app/src \
    -p 3000:3000 \
    node:20-alpine

# Named volume (best for data persistence)
docker volume create db-data
docker run -d --name my-db \
    -v db-data:/var/lib/postgresql/data \
    postgres:16-alpine

# Read-only mount
docker run -d --name web \
    -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
    nginx:alpine

# tmpfs mount (for temporary/sensitive data)
docker run -d --name app \
    --tmpfs /tmp:rw,size=100m \
    my-app

# List and inspect volumes
docker volume ls
docker volume inspect db-data
```

### 4.2 --mount Option (Recommended Syntax)

```bash
# -v syntax (shorthand)
docker run -d -v db-data:/var/lib/postgresql/data postgres:16-alpine

# --mount syntax (recommended, more explicit)
docker run -d \
    --mount type=volume,source=db-data,target=/var/lib/postgresql/data \
    postgres:16-alpine

# Bind mount with --mount syntax
docker run -d \
    --mount type=bind,source=$(pwd)/src,target=/app/src \
    node:20-alpine

# Read-only mount
docker run -d \
    --mount type=bind,source=$(pwd)/config.yml,target=/app/config.yml,readonly \
    my-app

# tmpfs with --mount syntax
docker run -d \
    --mount type=tmpfs,target=/tmp,tmpfs-size=100m \
    my-app
```

### 4.3 Managing Volumes

```bash
# Create a volume
docker volume create my-data

# Create a volume with a specific driver
docker volume create --driver local \
    --opt type=nfs \
    --opt o=addr=192.168.1.100,rw \
    --opt device=:/export/data \
    nfs-data

# List volumes
docker volume ls
docker volume ls --filter "name=my-"
docker volume ls --filter "dangling=true"

# Volume details
docker volume inspect my-data
# [
#     {
#         "CreatedAt": "2024-01-15T10:00:00Z",
#         "Driver": "local",
#         "Labels": {},
#         "Mountpoint": "/var/lib/docker/volumes/my-data/_data",
#         "Name": "my-data",
#         "Options": {},
#         "Scope": "local"
#     }
# ]

# Remove a volume
docker volume rm my-data

# Remove all unused volumes
docker volume prune

# Copy data between volumes
docker run --rm \
    -v source-vol:/from \
    -v dest-vol:/to \
    alpine sh -c "cp -a /from/. /to/"

# Back up a volume
docker run --rm \
    -v my-data:/data:ro \
    -v $(pwd):/backup \
    alpine tar czf /backup/my-data-backup.tar.gz -C /data .

# Restore from backup
docker run --rm \
    -v my-data:/data \
    -v $(pwd):/backup:ro \
    alpine tar xzf /backup/my-data-backup.tar.gz -C /data
```

### Comparison: Types of Mounts

| Type | Data Persistence | Host Access | Performance | Use Case |
|---|---|---|---|---|
| Bind Mount | Depends on host | Direct | OS-dependent | Source code sharing during development |
| Named Volume | Persistent (Docker-managed) | Via Docker | High | Databases, persistent data |
| Anonymous Volume | Orphaned on container removal | Via Docker | High | Temporary data |
| tmpfs | In memory (volatile) | Not possible | Highest | Sensitive info, temporary files |

---

## 5. Container Management

### 5.1 Listing Containers

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Show container IDs only
docker ps -q

# Specify output format
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Output in JSON format
docker ps --format json

# Custom format
docker ps --format "{{.ID}}: {{.Names}} ({{.Status}}) - {{.Image}}"

# Filter containers
docker ps --filter "status=exited"
docker ps --filter "name=my-"
docker ps --filter "label=env=production"
docker ps --filter "ancestor=nginx:alpine"
docker ps --filter "health=healthy"

# Most recently created container
docker ps -l

# Count containers
docker ps -q | wc -l
```

### 5.2 Stopping and Removing

```bash
# Stop a container (SIGTERM -> SIGKILL after 10 seconds)
docker stop my-nginx

# Stop with a specified timeout
docker stop -t 30 my-nginx

# Stop multiple containers at once
docker stop my-nginx my-db my-redis

# Force stop (SIGKILL)
docker kill my-nginx

# Send a specific signal
docker kill --signal=SIGHUP my-nginx

# Remove a container
docker rm my-nginx

# Stop and remove in one step
docker rm -f my-nginx

# Remove all stopped containers
docker container prune

# Remove without confirmation
docker container prune -f

# Bulk remove containers matching a condition
docker rm $(docker ps -aq --filter "status=exited")
docker rm $(docker ps -aq --filter "label=env=test")
```

### 5.3 Other Management Operations

```bash
# Restart a container
docker restart my-nginx

# Pause and unpause a container
docker pause my-nginx
docker unpause my-nginx

# Rename a container
docker rename my-nginx web-server

# Detailed container information
docker inspect my-nginx

# Extract specific information
docker inspect --format '{{.NetworkSettings.IPAddress}}' my-nginx
docker inspect --format '{{.State.Status}}' my-nginx
docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' my-nginx
docker inspect --format '{{.HostConfig.Memory}}' my-nginx

# List processes in a container
docker top my-nginx
# UID     PID     PPID    C    STIME   TTY   TIME     CMD
# root    12345   12330   0    10:00   ?     00:00:00 nginx: master process
# nobody  12346   12345   0    10:00   ?     00:00:00 nginx: worker process

# Show filesystem changes in a container
docker diff my-nginx
# A /var/log/nginx/access.log
# C /run
# A /run/nginx.pid

# Copy file from container to host
docker cp my-nginx:/etc/nginx/nginx.conf ./nginx.conf

# Copy file from host to container
docker cp ./custom.conf my-nginx:/etc/nginx/conf.d/

# Pause container before copying files
docker pause my-nginx
docker cp my-nginx:/var/log/nginx/ ./logs/
docker unpause my-nginx

# Wait for a container to exit
docker wait my-container
# Returns the exit code (0, 1, etc.)
```

---

## 6. Log Management

### 6.1 Displaying Logs

```bash
# Display logs
docker logs my-nginx

# Follow logs in real time (equivalent to tail -f)
docker logs -f my-nginx

# Show only the last N lines
docker logs --tail 100 my-nginx

# Display with timestamps
docker logs -t my-nginx

# Logs since a specific time
docker logs --since "2024-01-15T10:00:00" my-nginx
docker logs --since 30m my-nginx  # from 30 minutes ago
docker logs --since 2h my-nginx   # from 2 hours ago

# Logs until a specific time
docker logs --until "2024-01-15T12:00:00" my-nginx

# Combined options
docker logs -f --tail 50 -t my-nginx

# Output logs to a file
docker logs my-nginx > nginx.log 2>&1
docker logs my-nginx 2>/dev/null > stdout.log
docker logs my-nginx 2>stderr.log >/dev/null
```

### 6.2 Log Drivers

```
+-----------------------------------------------------+
|              Docker Log Drivers                      |
|                                                     |
|  Container stdout/stderr                             |
|       |                                             |
|       v                                             |
|  +------------------+                               |
|  | Log Driver       |                               |
|  +-----|------------+                               |
|        |                                            |
|  +-----+------+--------+--------+-------+          |
|  |     |      |        |        |       |          |
|  v     v      v        v        v       v          |
| json  syslog fluentd  awslogs  gcplogs local       |
| -file                                              |
|  (default)                                         |
+-----------------------------------------------------+
```

### 6.3 Configuring Log Drivers

```bash
# Specify a log driver at container startup
docker run -d --name app \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=5 \
    my-app

# fluentd log driver
docker run -d --name app \
    --log-driver fluentd \
    --log-opt fluentd-address=localhost:24224 \
    --log-opt tag=docker.app \
    my-app

# syslog log driver
docker run -d --name app \
    --log-driver syslog \
    --log-opt syslog-address=udp://logs.example.com:514 \
    --log-opt tag=myapp \
    my-app

# AWS CloudWatch Logs
docker run -d --name app \
    --log-driver awslogs \
    --log-opt awslogs-region=ap-northeast-1 \
    --log-opt awslogs-group=my-app \
    --log-opt awslogs-stream=production \
    my-app

# Log driver comparison
```

| Log Driver | Use Case | How to View Logs | docker logs Support |
|---|---|---|---|
| `json-file` | Default, local development | `docker logs` | Supported |
| `local` | Local (efficient) | `docker logs` | Supported |
| `syslog` | Forward to syslog server | syslog | Not supported |
| `fluentd` | Forward to Fluentd | Fluentd | Not supported |
| `awslogs` | AWS CloudWatch | CloudWatch | Not supported |
| `gcplogs` | GCP Cloud Logging | Cloud Logging | Not supported |
| `journald` | systemd journal | `journalctl` | Supported |
| `none` | Disable logging | None | Not supported |

---

## 7. In-Container Operations (exec)

### 7.1 Basic Operations

```bash
# Run a command in a running container
docker exec my-nginx ls /etc/nginx

# Connect with an interactive shell
docker exec -it my-nginx /bin/sh

# For containers where bash is available
docker exec -it my-nginx /bin/bash

# Run as a specific user
docker exec -u root my-nginx whoami
docker exec -u 1000:1000 my-nginx id

# Run with environment variables set
docker exec -e MY_VAR=hello my-nginx env

# Specify working directory
docker exec -w /etc/nginx my-nginx ls

# Run a command in the background
docker exec -d my-nginx touch /tmp/marker
```

### 7.2 Practical Uses of exec

```bash
# Connect to a database
docker exec -it my-db psql -U admin -d myapp
docker exec -it my-mysql mysql -u root -p

# Connect to Redis CLI
docker exec -it my-redis redis-cli
127.0.0.1:6379> PING
PONG

# Check file contents
docker exec my-nginx cat /etc/nginx/nginx.conf

# Check running processes
docker exec my-nginx ps aux

# Check network
docker exec my-nginx ping -c 3 google.com
docker exec my-nginx nslookup my-db
docker exec my-nginx wget -qO- http://localhost:80

# Check disk usage
docker exec my-nginx df -h
docker exec my-nginx du -sh /var/log/

# Check environment variables
docker exec my-nginx env | sort

# Install packages (for debugging only, not recommended)
docker exec -it my-nginx sh -c "apk add --no-cache curl && curl localhost"
```

### 7.3 Difference Between exec and run

```bash
# docker exec: run a command inside an existing running container
docker exec my-nginx cat /etc/nginx/nginx.conf
# -> displays the file inside the my-nginx container

# docker run: create and run a new container
docker run --rm nginx:alpine cat /etc/nginx/nginx.conf
# -> creates a new container, displays the output, then removes it
```

| Aspect | docker exec | docker run |
|---|---|---|
| Container | Existing running container | Creates a new container |
| State | Shares the container's state | Independent state |
| Network | Uses the container's network | New network configuration |
| Volumes | Uses the container's volumes | Must be specified anew |
| Use Case | Debugging, management tasks | Running temporary commands |
| Prerequisite | Container must be running | Image must exist |

---

## 8. Resource Monitoring

### 8.1 docker stats

```bash
# Real-time resource usage
docker stats

# Example output:
# CONTAINER ID   NAME       CPU %   MEM USAGE / LIMIT   MEM %   NET I/O         BLOCK I/O
# a1b2c3d4e5f6   my-nginx   0.05%   5.2MiB / 7.67GiB    0.07%   1.45kB / 0B    0B / 0B

# Monitor specific containers only
docker stats my-nginx my-db

# One-shot (no streaming)
docker stats --no-stream

# Specify output format
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Output in JSON format
docker stats --no-stream --format json
```

### 8.2 Setting Resource Limits

```bash
# Memory limit
docker run -d --name limited-app \
    --memory=256m \
    --memory-swap=512m \
    nginx:alpine

# Memory reservation (soft limit)
docker run -d --name app \
    --memory=512m \
    --memory-reservation=256m \
    my-app

# CPU limit
docker run -d --name cpu-limited \
    --cpus=1.5 \
    nginx:alpine

# CPU shares (relative weight)
docker run -d --name high-priority \
    --cpu-shares=1024 \
    my-app
docker run -d --name low-priority \
    --cpu-shares=256 \
    my-app

# CPU pinning (bind to specific CPUs)
docker run -d --name pinned-app \
    --cpuset-cpus="0,1" \
    my-app

# I/O limits
docker run -d --name io-limited \
    --device-read-bps /dev/sda:10mb \
    --device-write-bps /dev/sda:10mb \
    my-app

# PID limit
docker run -d --name pid-limited \
    --pids-limit=100 \
    my-app

# Change resource limits of a running container
docker update --memory=512m --cpus=2.0 limited-app

# Check resource limits for all containers
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### 8.3 Health Checks

```bash
# Start a container with a health check
docker run -d --name web \
    --health-cmd="wget --no-verbose --tries=1 --spider http://localhost/ || exit 1" \
    --health-interval=30s \
    --health-timeout=5s \
    --health-retries=3 \
    --health-start-period=10s \
    nginx:alpine

# Check health check status
docker inspect --format '{{.State.Health.Status}}' web
# healthy / unhealthy / starting

# View health check logs
docker inspect --format '{{json .State.Health}}' web | python3 -m json.tool

# Filter by health check status
docker ps --filter "health=healthy"
docker ps --filter "health=unhealthy"
```

---

## 9. Docker Networking

### 9.1 Network Basics

```bash
# List networks
docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# abc123         bridge    bridge    local
# def456         host      host      local
# ghi789         none      null      local

# Create a custom network
docker network create my-network
docker network create --driver bridge --subnet 172.20.0.0/16 my-custom-net

# Network details
docker network inspect my-network

# Connect a container to a network
docker network connect my-network my-nginx

# Disconnect a container from a network
docker network disconnect my-network my-nginx

# Remove a network
docker network rm my-network

# Remove all unused networks
docker network prune
```

### 9.2 Container-to-Container Communication

```bash
# DNS-based name resolution on a custom network
docker network create app-network

docker run -d --name db \
    --network app-network \
    -e POSTGRES_PASSWORD=secret \
    postgres:16-alpine

docker run -d --name app \
    --network app-network \
    -e DATABASE_URL=postgresql://postgres:secret@db:5432/postgres \
    my-app

# The app container can reach the db container by the name "db"
docker exec app ping -c 3 db
# PING db (172.20.0.2): 56 data bytes
# 64 bytes from 172.20.0.2: seq=0 ttl=64 time=0.085 ms

# Network alias
docker run -d --name db-primary \
    --network app-network \
    --network-alias database \
    postgres:16-alpine
# Also accessible by the name "database"
```

### 9.3 Comparison of Network Drivers

| Driver | Description | Use Case | DNS Resolution |
|---|---|---|---|
| bridge | Default, isolated network | Container communication on a single host | Custom networks only |
| host | Shares the host's network | Performance-critical workloads | Host DNS |
| overlay | Network spanning multiple hosts | Docker Swarm / distributed systems | Yes |
| macvlan | Direct connection to physical network | Legacy app integration | No |
| none | Networking disabled | Security-focused isolation | No |

---

## 10. Cleanup

### Comparison Table 1: Cleanup Commands

| Command | Target | Description |
|---|---|---|
| `docker container prune` | Stopped containers | Remove all stopped containers |
| `docker image prune` | Unused images | Remove dangling (untagged) images |
| `docker image prune -a` | All unused images | Remove all images not used by any container |
| `docker volume prune` | Unused volumes | Remove volumes not mounted by any container |
| `docker network prune` | Unused networks | Remove networks not connected to any container |
| `docker system prune` | All of the above | Bulk cleanup |
| `docker system prune -a` | All of the above + all unused images | Full cleanup |
| `docker builder prune` | Build cache | Remove BuildKit cache |

### Comparison Table 2: Key docker run Options

| Option | Short | Description | Example |
|---|---|---|---|
| `--detach` | `-d` | Run in background | `-d` |
| `--interactive` | `-i` | Keep stdin open | `-i` |
| `--tty` | `-t` | Allocate pseudo-TTY | `-t` |
| `--rm` | | Auto-remove on exit | `--rm` |
| `--name` | | Specify container name | `--name web` |
| `--publish` | `-p` | Port mapping | `-p 8080:80` |
| `--volume` | `-v` | Volume mount | `-v data:/app` |
| `--mount` | | Mount (recommended syntax) | `--mount type=volume,...` |
| `--env` | `-e` | Set environment variable | `-e KEY=val` |
| `--env-file` | | Load env file | `--env-file .env` |
| `--network` | | Specify network | `--network my-net` |
| `--memory` | `-m` | Memory limit | `-m 256m` |
| `--cpus` | | CPU limit | `--cpus 1.5` |
| `--restart` | | Restart policy | `--restart unless-stopped` |
| `--platform` | | Specify platform | `--platform linux/amd64` |
| `--label` | `-l` | Assign label | `-l env=prod` |
| `--health-cmd` | | Health check | `--health-cmd "curl ..."` |
| `--user` | `-u` | Run as user | `-u 1000:1000` |
| `--workdir` | `-w` | Working directory | `-w /app` |
| `--hostname` | `-h` | Set hostname | `-h myhost` |
| `--add-host` | | Add hosts entry | `--add-host db:10.0.0.1` |
| `--dns` | | DNS server | `--dns 8.8.8.8` |
| `--cap-add` | | Add Linux capability | `--cap-add SYS_PTRACE` |
| `--cap-drop` | | Drop Linux capability | `--cap-drop ALL` |
| `--read-only` | | Root FS read-only | `--read-only` |
| `--tmpfs` | | tmpfs mount | `--tmpfs /tmp` |
| `--init` | | Use tini as PID 1 | `--init` |
| `--pid` | | PID namespace | `--pid host` |

```bash
# Check disk usage
docker system df

# Example output:
# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          15        5         4.2GB     2.8GB (66%)
# Containers      8         3         120MB     80MB (66%)
# Local Volumes   12        4         1.5GB     800MB (53%)
# Build Cache     50        0         2.1GB     2.1GB

# Verbose output
docker system df -v

# Bulk cleanup (with confirmation)
docker system prune

# Full cleanup including volumes
docker system prune -a --volumes

# Cleanup with filter
docker system prune --filter "until=24h"
docker image prune -a --filter "until=168h"  # older than 1 week

# Periodic cleanup script
# Register with cron: 0 3 * * 0 /usr/local/bin/docker-cleanup.sh
#!/bin/bash
# docker-cleanup.sh
echo "=== Docker Cleanup Start ==="
echo "Before:"
docker system df
docker container prune -f
docker image prune -a --filter "until=168h" -f
docker volume prune -f
docker network prune -f
docker builder prune -f --keep-storage=5GB
echo "After:"
docker system df
echo "=== Docker Cleanup Complete ==="
```

---

## 11. Practical Workflow Examples

### 11.1 Web Application Development Environment

```bash
# Start the database
docker run -d --name dev-db \
    --network dev-net \
    -e POSTGRES_USER=dev \
    -e POSTGRES_PASSWORD=devpass \
    -e POSTGRES_DB=myapp_dev \
    -v db-data:/var/lib/postgresql/data \
    -p 5432:5432 \
    postgres:16-alpine

# Start Redis
docker run -d --name dev-redis \
    --network dev-net \
    -p 6379:6379 \
    redis:7-alpine

# Start the application (mount source code)
docker run -d --name dev-app \
    --network dev-net \
    -v $(pwd):/app \
    -p 3000:3000 \
    -e DATABASE_URL=postgresql://dev:devpass@dev-db:5432/myapp_dev \
    -e REDIS_URL=redis://dev-redis:6379 \
    node:20-alpine sh -c "cd /app && npm install && npm run dev"

# View logs
docker logs -f dev-app

# Connect to the database for debugging
docker exec -it dev-db psql -U dev -d myapp_dev

# Stop the environment
docker stop dev-app dev-redis dev-db

# Remove the environment (data retained)
docker rm dev-app dev-redis dev-db

# Full removal including data
docker rm -f dev-app dev-redis dev-db
docker volume rm db-data
docker network rm dev-net
```

### 11.2 Debugging Multi-Service Systems

```bash
# Create a network
docker network create debug-net

# Debug network issues for a problematic container
docker run -it --rm \
    --network debug-net \
    nicolaka/netshoot \
    bash

# Inside the netshoot container:
# dig db    # Check DNS resolution
# ping db   # Check connectivity
# curl app:3000/health  # Check HTTP
# tcpdump -i eth0 port 5432  # Packet capture
# nmap -sT db  # Port scan
```

---

## 12. Anti-Patterns

### Anti-Pattern 1: Creating disposable containers without --rm

```bash
# Bad: discarded containers accumulate
docker run alpine echo "test1"
docker run alpine echo "test2"
docker run alpine echo "test3"
# docker ps -a shows a large number of Exited containers

# Good: use --rm for tests and temporary runs
docker run --rm alpine echo "test1"
docker run --rm alpine echo "test2"
docker run --rm alpine echo "test3"
# Container is automatically removed after execution
```

### Anti-Pattern 2: Modifying production containers with docker exec

```bash
# Bad: changing files inside a running container
docker exec -it production-app bash
root@abc123:/# apt-get install vim
root@abc123:/# vim /app/config.json
# -> changes are lost on container restart
# -> changes cannot be tracked
# -> cannot be reproduced in other environments

# Good: manage configuration via Dockerfile or ConfigMap
# Modify config -> rebuild image -> redeploy
docker build -t my-app:v2 .
docker stop production-app
docker run -d --name production-app my-app:v2
```

### Anti-Pattern 3: Casually using the host network

```bash
# Bad: starting all containers with host network
docker run -d --network host my-app
docker run -d --network host my-db
# -> risk of port conflicts
# -> no network isolation
# -> security risk

# Good: use a custom network
docker network create app-net
docker run -d --network app-net --name app my-app
docker run -d --network app-net --name db my-db
# -> DNS-based name resolution
# -> network isolation
# -> no port conflicts
```

### Anti-Pattern 4: Storing data directly inside a container

```bash
# Bad: storing data inside the container
docker run -d --name db postgres:16-alpine
# -> data is lost when the container is removed
# -> data is lost when the container is updated

# Good: use volumes for data persistence
docker run -d --name db \
    -v db-data:/var/lib/postgresql/data \
    postgres:16-alpine
# -> data is retained even after the container is removed
# -> data is preserved when the container is updated
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

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
        """Remove by key"""
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

# Test
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # size limit
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be conscious of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Check the config file path and format |
| Timeout | Network delay / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Verify step by step**: Use log output and debuggers to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

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
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps to diagnose performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When to compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Team size?                                  │
│    ├─ Small (1-5 people) -> Monolith            │
│    └─ Large (10+ people) -> Go to 2             │
│                                                 │
│  2. Deployment frequency?                       │
│    ├─ Weekly or less -> Monolith + modules      │
│    └─ Daily / multiple times -> Go to 3         │
│                                                 │
│  3. Independence between teams?                 │
│    ├─ High -> Microservices                     │
│    └─ Moderate -> Modular monolith              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Analyzing Trade-offs

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

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
        """Describe the decision made"""
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

## 13. FAQ

### Q1: What is the difference between `docker run` and `docker create` + `docker start`?

**A:** `docker run` executes both `docker create` (create the container) and `docker start` (start the container) in one step. The advantage of separating them is that you can inspect container settings or change network connections before starting. In practice, `docker run` is used most of the time; `create` + `start` is often used in automation scripts.

### Q2: Why does my container stop immediately?

**A:** A container automatically stops when its main process (PID 1) exits. Common causes include:
- No foreground process (e.g., a daemon tries to start in the background)
- The command completes immediately (e.g., only `echo` is run)
- The application exits due to an error
Use `docker logs <container>` to check logs and identify the cause.

### Q3: In `-p 8080:80`, which side is the host and which is the container?

**A:** The order is `host:container`. With `-p 8080:80`, accessing port 8080 on the host forwards to port 80 inside the container. A helpful mnemonic is "outside to inside" (left = host = outside, right = container = inside). Volume mounts with `-v` follow the same `host:container` order.

### Q4: How do I find a container's IP address?

**A:** Use the following commands:

```bash
# Get IP address
docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' my-nginx

# For a custom network
docker inspect --format '{{.NetworkSettings.Networks.my_network.IPAddress}}' my-nginx

# All network information
docker inspect --format '{{json .NetworkSettings.Networks}}' my-nginx | python3 -m json.tool
```

Note that a container's IP address changes dynamically, so avoid relying on fixed IPs. It is recommended to use Docker network DNS name resolution (container names or network aliases) instead.

### Q5: Should I use the `--init` option when running docker run?

**A:** `--init` starts `tini` as PID 1 inside the container, which properly propagates signals and reaps zombie processes. It is useful when an application spawns child processes or does not correctly implement signal handling. Using `--init` is recommended for Node.js and Python applications.

### Q6: Why can't containers communicate on the default bridge network?

**A:** DNS-based name resolution is not available on the default bridge network. For container-to-container communication, you must create and use a custom network. On a custom network, DNS resolution by container name is automatically enabled.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work, especially during code reviews and architecture design.

---

## 14. Summary

| Item | Key Points |
|---|---|
| Images and Containers | An image is a read-only template; a container is a running instance |
| docker run | `-d` (detach), `-it` (interactive), `--rm` (auto-remove) |
| Port Mapping | Connect networks with `-p host:container` |
| Volumes | Bind mounts (for development), named volumes (for persistence) |
| Networking | Custom networks for DNS resolution and container-to-container communication |
| Logs | Real-time tracking with `docker logs -f`, forward via log drivers |
| exec | Connect to a running container with `docker exec -it` |
| Resource Limits | Limit with `--memory`, `--cpus`; monitor with `docker stats` |
| Health Checks | Monitor container health with `--health-cmd` |
| Cleanup | Bulk removal with `docker system prune` |

---

## What to Read Next

- [03-image-management.md](./03-image-management.md) -- Image management and registries
- [../01-dockerfile/00-dockerfile-basics.md](../01-dockerfile/00-dockerfile-basics.md) -- Dockerfile basics
- [../02-compose/00-compose-basics.md](../02-compose/00-compose-basics.md) -- Docker Compose basics

---

## References

1. **Docker Documentation - docker run** https://docs.docker.com/reference/cli/docker/container/run/ -- Full options reference for `docker run`.
2. **Docker Documentation - Manage data in Docker** https://docs.docker.com/storage/ -- Detailed explanation of volumes, bind mounts, and tmpfs.
3. **Docker Documentation - Configure logging drivers** https://docs.docker.com/config/containers/logging/ -- Log driver configuration and characteristics of each driver.
4. **Docker Documentation - Networking overview** https://docs.docker.com/network/ -- Explanation of Docker networking and drivers.
5. **Docker Documentation - Resource constraints** https://docs.docker.com/config/containers/resource_constraints/ -- Details on memory, CPU, and other resource limits.
6. **Docker Documentation - Healthcheck** https://docs.docker.com/reference/dockerfile/#healthcheck -- How to configure health checks and usage patterns.
