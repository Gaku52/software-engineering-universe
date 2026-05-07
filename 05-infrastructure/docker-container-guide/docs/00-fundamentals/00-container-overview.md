# Container Technology Overview

> An introductory guide to understanding the differences between virtual machines and containers, and gaining a comprehensive picture of Docker and the container ecosystem. Systematically covers the Linux kernel foundations, OCI standards, real-world use cases, and comparisons of alternative tools.

---

## What You Will Learn in This Chapter

1. Understand the **fundamental differences between virtualization and containerization** and determine which approach to apply in each scenario
2. Gain a deep understanding of **Linux kernel technologies (namespaces / cgroups / UnionFS)**
3. Learn about **Docker's history and the OCI standard** to grasp the overall container ecosystem
4. Understand the **layered structure of container runtimes** (high-level and low-level)
5. Understand **container use cases** and evaluate how to apply them to your own projects
6. Compare and evaluate **alternatives to Docker** (Podman, nerdctl, Buildah, etc.)


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Virtualization and Containerization

### 1.1 Traditional Virtualization (Hypervisor-Based)

A virtual machine (VM) is a technology that boots an entire guest OS on top of a hypervisor. Each VM has its own independent kernel and provides complete isolation.

```
+---------------------------------------------+
|              Host OS                          |
+---------------------------------------------+
|            Hypervisor                         |
+----------+----------+----------+------------+
|  VM 1    |  VM 2    |  VM 3    |            |
| +------+ | +------+ | +------+ |            |
| | App  | | | App  | | | App  | |            |
| +------+ | +------+ | +------+ |            |
| | Bins | | | Bins | | | Bins | |            |
| +------+ | +------+ | +------+ |            |
| |GuestOS| | |GuestOS| | |GuestOS| |            |
| +------+ | +------+ | +------+ |            |
+----------+----------+----------+------------+
```

**Type 1 (Bare-Metal) Hypervisor:**

A hypervisor that runs directly on hardware with high performance.

```
+-------------------------------------------------+
|  Hardware (CPU, Memory, Storage, NIC)           |
+-------------------------------------------------+
|  Type 1 Hypervisor                              |
|  Examples: VMware ESXi, Microsoft Hyper-V,      |
|      Xen, KVM (integrated into Linux kernel)    |
+-------------------------------------------------+
|  VM 1        |  VM 2        |  VM 3            |
|  Ubuntu 22   |  Windows 11  |  RHEL 9          |
+-------------------------------------------------+
```

**Type 2 (Hosted) Hypervisor:**

A hypervisor that runs as an application on the host OS.

```
+-------------------------------------------------+
|  Hardware                                       |
+-------------------------------------------------+
|  Host OS (macOS, Windows, Linux)                |
+-------------------------------------------------+
|  Type 2 Hypervisor                              |
|  Examples: VirtualBox, VMware Workstation/Fusion|
|      Parallels Desktop, QEMU                    |
+-------------------------------------------------+
|  VM 1        |  VM 2        |  VM 3            |
+-------------------------------------------------+
```

### 1.2 Containerization

Containers share the host OS kernel and achieve isolation at the process level. Since no guest OS is required, startup is fast and resource efficiency is high.

```
+---------------------------------------------+
|              Host OS Kernel                   |
+---------------------------------------------+
|          Container Runtime (Docker)           |
+----------+----------+----------+------------+
|Container1 |Container2 |Container3 |            |
| +------+ | +------+ | +------+ |            |
| | App  | | | App  | | | App  | |            |
| +------+ | +------+ | +------+ |            |
| | Bins | | | Bins | | | Bins | |            |
| +------+ | +------+ | +------+ |            |
+----------+----------+----------+------------+
  No Guest OS - Shares the Kernel
```

**Essential benefits of containerization:**

```
+----------------------------------------------------------+
|  Immutability                                             |
|  ├─ Images are never changed once built                   |
|  ├─ Config change = building a new image                  |
|  └─ Deployment = discard old container + start new one    |
|                                                           |
|  Portability                                              |
|  ├─ Use the same image in development and production      |
|  ├─ Eliminates "works on my machine, not in production"   |
|  └─ Not locked into any cloud vendor                      |
|                                                           |
|  Efficiency                                               |
|  ├─ Startup time: hundreds of milliseconds (VMs: minutes) |
|  ├─ Memory: only app footprint (VMs need OS memory too)   |
|  ├─ Disk: layer sharing eliminates duplication            |
|  └─ Density: hundreds of containers per host (VMs: tens)  |
+----------------------------------------------------------+
```

### 1.3 Hybrid Configuration (VM + Containers)

In real-world cloud environments, it is common to run containers on top of VMs in a hybrid configuration.

```
+-----------------------------------------------------+
|              Cloud Provider (AWS / GCP / Azure)      |
+-----------------------------------------------------+
|              Physical Server Cluster                 |
+-----------------------------------------------------+
|              Hypervisor (KVM, etc.)                  |
+-----------------------------------------------------+
|  VM (EC2)   |  VM (EC2)   |  VM (EC2)               |
|  +---------+|  +---------+|  +---------+            |
|  |Containers||  |Containers||  |Containers|            |
|  | K8s Node||  | K8s Node||  | K8s Node|            |
|  +---------+|  +---------+|  +---------+            |
+-----------------------------------------------------+
  VM = Tenant isolation / Container = Application isolation
```

```bash
# Example configuration for AWS EKS
# EC2 instances (VMs) act as Kubernetes worker nodes
# Pods (containers) run on top of them

# Check worker nodes (VMs)
kubectl get nodes -o wide
# NAME                         STATUS   ROLES    AGE   VERSION
# ip-10-0-1-100.ec2.internal   Ready    <none>   5d    v1.28.3
# ip-10-0-2-200.ec2.internal   Ready    <none>   5d    v1.28.3

# Check Pods (containers)
kubectl get pods -o wide
# NAME                    READY   STATUS    NODE
# web-7d8f9c-abc12        1/1     Running   ip-10-0-1-100.ec2.internal
# api-5b6c7d-def34        1/1     Running   ip-10-0-2-200.ec2.internal
```

---

## 2. Linux Kernel Technologies in Detail

### 2.1 namespaces - Controlling Resource Visibility

A Linux kernel technology that forms the foundation of containers, restricting the range of resources visible to a process.

```
+---------------------------------------------------+
|               Linux Kernel                         |
|                                                   |
|  +-------------------+  +----------------------+  |
|  |   namespaces      |  |      cgroups         |  |
|  |                   |  |                      |  |
|  |  - pid namespace  |  |  - CPU limit         |  |
|  |  - net namespace  |  |  - Memory limit      |  |
|  |  - mnt namespace  |  |  - I/O limit         |  |
|  |  - uts namespace  |  |  - Process limit     |  |
|  |  - ipc namespace  |  |                      |  |
|  |  - user namespace |  |                      |  |
|  |  - cgroup ns      |  |                      |  |
|  |  - time ns        |  |                      |  |
|  +-------------------+  +----------------------+  |
|                                                   |
|  namespaces = Restricts visibility (isolation)    |
|  cgroups    = Restricts usage (resource control)  |
+---------------------------------------------------+
```

**Details on all 8 namespaces:**

```bash
# ===================================
# 1. PID namespace - Process ID isolation
# ===================================
# Inside a container, an independent process tree starts from PID 1
docker run --rm alpine ps aux
# PID   USER     COMMAND
#   1   root     ps aux

# From the host, container processes have different PIDs
docker run -d --name test-pid alpine sleep 3600
docker inspect --format '{{.State.Pid}}' test-pid
# Example: 45678 (host-side PID)

# PID as seen from inside the container
docker exec test-pid ps aux
# PID   USER     COMMAND
#   1   root     sleep 3600

# Check namespace via the /proc filesystem
docker exec test-pid ls -la /proc/1/ns/pid
# lrwxrwxrwx 1 root root 0 /proc/1/ns/pid -> 'pid:[4026532456]'

docker rm -f test-pid

# ===================================
# 2. Network namespace - Network stack isolation
# ===================================
# Each container has its own network interfaces, IP addresses,
# routing tables, and iptables rules
docker run --rm alpine ip addr
# 1: lo: <LOOPBACK,UP,LOWER_UP>
#     inet 127.0.0.1/8 scope host lo
# 2: eth0@if123: <BROADCAST,MULTICAST,UP,LOWER_UP>
#     inet 172.17.0.2/16 brd 172.17.255.255

# List network namespaces (from the host)
sudo ip netns list

# Inspect container network configuration in detail
docker run --rm alpine sh -c "ip route && echo '---' && ip addr && echo '---' && cat /etc/resolv.conf"

# ===================================
# 3. Mount namespace - Filesystem isolation
# ===================================
# Containers have their own mount points
docker run --rm alpine ls /
# bin    etc    lib    mnt    proc   run    srv    tmp    var
# dev    home   media  opt    root   sbin   sys    usr

# Completely isolated from the host filesystem
docker run --rm alpine cat /etc/os-release
# NAME="Alpine Linux"

# Check mount points
docker run --rm alpine mount
# overlay on / type overlay (...)
# proc on /proc type proc (...)
# tmpfs on /dev type tmpfs (...)

# ===================================
# 4. UTS namespace - Hostname isolation
# ===================================
# Each container has its own hostname
docker run --rm --hostname my-container alpine hostname
# my-container

docker run --rm alpine hostname
# Random 12-character container ID

# ===================================
# 5. IPC namespace - Inter-process communication isolation
# ===================================
# Isolation of shared memory, semaphores, and message queues
docker run --rm alpine ipcs
# ------ Message Queues --------
# ------ Shared Memory Segments --------
# ------ Semaphore Arrays --------

# ===================================
# 6. User namespace - User ID isolation
# ===================================
# Maps root (UID 0) inside the container to an unprivileged user on the host
docker run --rm alpine id
# uid=0(root) gid=0(root) groups=0(root)

# Running in rootless mode
# Container root -> Unprivileged host user
docker run --rm --userns=host alpine cat /proc/self/uid_map
#          0       1000          1

# ===================================
# 7. Cgroup namespace (Linux 4.6+)
# ===================================
# Virtualizes the cgroup filesystem
docker run --rm alpine cat /proc/self/cgroup
# 0::/

# ===================================
# 8. Time namespace (Linux 5.6+)
# ===================================
# Virtualizes CLOCK_MONOTONIC and CLOCK_BOOTTIME
# Allows each container to have a different boot time
```

### 2.2 cgroups (Control Groups) - Resource Usage Control

cgroups is a feature that limits and monitors the resource usage of process groups.

```bash
# ===================================
# Checking cgroups v1 and v2
# ===================================
# Check the cgroups version
stat -fc %T /sys/fs/cgroup/
# cgroup2fs -> cgroups v2
# tmpfs     -> cgroups v1

# Check the cgroup driver used by Docker
docker info | grep -i cgroup
# Cgroup Driver: systemd
# Cgroup Version: 2

# ===================================
# Memory limits
# ===================================
# Limit memory to 256 MB
docker run --memory=256m --rm alpine free -m

# Limit memory + swap
docker run --memory=256m --memory-swap=512m --rm alpine free -m

# Memory reservation (soft limit)
docker run --memory=512m --memory-reservation=256m --rm nginx

# OOM (Out Of Memory) kill behavior control
docker run --memory=64m --oom-kill-disable --rm stress-ng --vm 1 --vm-bytes 128m
# Disables the OOM Killer (dangerous: may affect the entire host)

# ===================================
# CPU limits
# ===================================
# Limit CPU to 1 core
docker run --cpus=1.0 --rm alpine cat /proc/cpuinfo

# CPU shares (relative weighting)
docker run --cpu-shares=1024 --rm nginx   # Default
docker run --cpu-shares=512 --rm nginx    # Half the weight

# Pin to specific CPU cores (CPU pinning)
docker run --cpuset-cpus="0,1" --rm nginx  # Use only CPU 0 and 1
docker run --cpuset-cpus="0-3" --rm nginx  # Use CPUs 0 through 3

# CPU quota (period-based limit)
docker run --cpu-period=100000 --cpu-quota=50000 --rm nginx
# 50ms of CPU time per 100ms period = 0.5 CPU

# ===================================
# I/O limits
# ===================================
# Limit block device read/write speed
docker run --device-read-bps=/dev/sda:1mb --rm alpine dd if=/dev/zero of=/tmp/test bs=1M count=10
docker run --device-write-bps=/dev/sda:1mb --rm alpine dd if=/dev/zero of=/tmp/test bs=1M count=10

# I/O weight (relative weighting)
docker run --blkio-weight=500 --rm nginx  # Default: 500, Range: 10-1000

# ===================================
# Process count limit (pids cgroup)
# ===================================
docker run --pids-limit=100 --rm alpine sh -c "ulimit -u"
# Important as protection against Fork Bombs

# ===================================
# Checking resource usage
# ===================================
docker stats --no-stream
# CONTAINER ID   NAME     CPU %   MEM USAGE / LIMIT   MEM %   NET I/O       BLOCK I/O    PIDS
# abc123def456   web      0.50%   45.2MiB / 256MiB    17.66%  1.2kB / 0B    8.19kB / 0B  5

# Detailed resource info for a specific container
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}"

# Retrieve information directly from the cgroup filesystem
docker run -d --name cgroup-test --memory=256m nginx
CONTAINER_ID=$(docker inspect --format '{{.Id}}' cgroup-test)
# For cgroups v2
cat /sys/fs/cgroup/system.slice/docker-${CONTAINER_ID}.scope/memory.max
# 268435456 (256MB)
docker rm -f cgroup-test
```

### 2.3 UnionFS / OverlayFS - Layered Filesystem

The technology that underpins the layered structure of container images.

```
+--------------------------------------------------+
|  Container Layer Structure                        |
|                                                  |
|  +--------------------------------------------+ |
|  | Container Layer (Read-Write)                | |
|  | Runtime changes are written here            | |
|  +--------------------------------------------+ |
|  | Layer 4: COPY . /app (application code)     | |
|  +--------------------------------------------+ |
|  | Layer 3: RUN npm install (dependencies)     | |
|  +--------------------------------------------+ |
|  | Layer 2: RUN apt-get install (OS packages)  | |
|  +--------------------------------------------+ |
|  | Layer 1: Base image (ubuntu:22.04)          | |
|  +--------------------------------------------+ |
|  ^ All layers are Read-Only                    |
|  ^ File changes written to upper layer via CoW |
+--------------------------------------------------+
```

```bash
# Check image layer information
docker history nginx:1.25-alpine
# IMAGE          CREATED       CREATED BY                                      SIZE
# 1234abcd5678   2 weeks ago   CMD ["nginx" "-g" "daemon off;"]                0B
# <missing>      2 weeks ago   EXPOSE map[80/tcp:{}]                           0B
# <missing>      2 weeks ago   STOPSIGNAL SIGQUIT                              0B
# <missing>      2 weeks ago   RUN /bin/sh -c set -x && addgroup ...           5.14MB
# <missing>      2 weeks ago   /bin/sh -c #(nop) ADD file:... in /            7.38MB

# Check layer details in JSON
docker inspect nginx:1.25-alpine | python3 -m json.tool | head -50

# overlay2 storage driver info
docker info --format '{{.Driver}}'
# overlay2

# Check where images are stored
docker info --format '{{.DockerRootDir}}'
# /var/lib/docker

# OverlayFS mount info for a specific container
docker run -d --name overlay-test nginx
docker inspect overlay-test --format '{{.GraphDriver.Data.MergedDir}}'
# /var/lib/docker/overlay2/<hash>/merged

docker inspect overlay-test --format '{{.GraphDriver.Data.UpperDir}}'
# /var/lib/docker/overlay2/<hash>/diff  (Read-Write layer)

docker inspect overlay-test --format '{{.GraphDriver.Data.LowerDir}}'
# /var/lib/docker/overlay2/<hash1>/diff:/var/lib/docker/overlay2/<hash2>/diff  (Read-Only layers)

docker rm -f overlay-test

# Verify layer sharing (containers using the same base image share layers)
docker pull nginx:1.25-alpine
docker pull nginx:1.25  # Common layers between alpine and non-alpine will be shared

# Check disk usage
docker system df
# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          15        5         3.258GB   2.1GB (64%)
# Containers      5         3         120MB     45MB (37%)
# Local Volumes   8         3         500MB     200MB (40%)
# Build Cache     20        0         1.5GB     1.5GB

docker system df -v  # Verbose output
```

### 2.4 seccomp - System Call Filtering

```bash
# Check Docker's default seccomp profile
# Out of 300+ system calls, approximately 50 are restricted
docker run --rm alpine cat /proc/self/status | grep Seccomp
# Seccomp:  2
# Seccomp_filters:  1

# Run without a seccomp profile (dangerous - for debugging purposes only)
docker run --rm --security-opt seccomp=unconfined alpine cat /proc/self/status | grep Seccomp
# Seccomp:  0

# Example of a custom seccomp profile
cat > /tmp/my-seccomp.json << 'SECCOMP_EOF'
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [
    {
      "names": ["chmod", "fchmod", "fchmodat"],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    },
    {
      "names": ["ptrace"],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    }
  ]
}
SECCOMP_EOF

docker run --rm --security-opt seccomp=/tmp/my-seccomp.json alpine chmod 777 /tmp
# chmod: /tmp: Operation not permitted
```

### 2.5 capabilities - Fine-Grained Privilege Control

```bash
# List of Linux capabilities (those relevant to containers)
# Docker grants only a limited set of capabilities by default

# Capabilities granted by default
docker run --rm alpine sh -c 'cat /proc/self/status | grep Cap'
# CapPrm:  00000000a80425fb
# CapEff:  00000000a80425fb

# Decode to human-readable format using capsh
docker run --rm alpine sh -c 'apk add -q libcap && capsh --decode=00000000a80425fb'
# 0x00000000a80425fb=cap_chown,cap_dac_override,cap_fowner,...

# Drop all capabilities
docker run --rm --cap-drop=ALL alpine id
# uid=0(root) gid=0(root)  # root but effectively powerless

# Add only the minimum required capabilities
docker run --rm --cap-drop=ALL --cap-add=NET_BIND_SERVICE alpine sh -c 'id'

# Examples of dangerous capabilities
# --cap-add=SYS_ADMIN  # Nearly equivalent to root (avoid)
# --cap-add=NET_ADMIN  # Can modify network settings
# --cap-add=SYS_PTRACE # Can debug other processes
```

---

## 3. Virtual Machines vs. Containers: A Thorough Comparison

### Comparison Table 1: Technical Characteristics

| Characteristic | Virtual Machine (VM) | Container |
|---|---|---|
| Isolation | Hardware level | Process level |
| OS | Guest OS per VM | Shared host OS kernel |
| Startup time | Minutes | Seconds to hundreds of milliseconds |
| Size | GB scale (several to tens of GB) | MB scale (several to hundreds of MB) |
| Performance | Hypervisor overhead (5-10%) | Near native (<1%) |
| Density | Tens of VMs per host | Hundreds to thousands of containers per host |
| Security | Strong isolation (kernel level) | Risk from shared kernel |
| Portability | VM images are large (several GB) | Container images are lightweight (tens of MB) |
| Live migration | Supported | Not supported by default |
| Nested execution | VM in VM (performance degradation) | Container in container (DinD/DooD) |
| Snapshots | Per-VM snapshots | Version management via image layers |
| Networking | Virtual NIC, independent stack | veth pairs, bridge networking |

### Comparison Table 2: Applicable Scenarios

| Use Case | Recommended | Reason |
|---|---|---|
| Microservices | Container | Lightweight, fast deployment, individual scaling |
| Legacy OS support | VM | Requires a different kernel |
| Unified development environment | Container | High reproducibility, one-command setup with docker-compose |
| Multi-tenant (SaaS) | VM | Requires strong isolation, avoids risk from kernel vulnerabilities |
| CI/CD pipeline | Container | Fast startup, disposable |
| Desktop virtualization (VDI) | VM | Requires GUI, drivers, and peripheral support |
| Batch processing / jobs | Container | Easy to scale, auto-destroyed after completion |
| Security testing | VM | Complete isolation, safe for malware analysis |
| GPU workloads | Both | VM: GPU passthrough / Container: NVIDIA Container Runtime |
| Databases | Both | Development: container / Production: VM or bare-metal (I/O performance) |
| Edge computing | Container | Suitable for resource-constrained environments |
| Legacy app migration | VM -> Container | Phased migration: Lift & Shift -> Refactoring |

### Comparison Table 3: Operational Costs

| Aspect | Virtual Machine | Container |
|---|---|---|
| Initial learning cost | Low (close to traditional server operations) | Medium to high (requires understanding new concepts) |
| Setup time | Tens of minutes to hours | Seconds to minutes |
| License costs | Requires licenses for each guest OS | No license needed since OS is shared |
| Hardware efficiency | Low (OS overhead) | High (app only) |
| Patch management | Patch each VM's OS | Update base image + rebuild |
| Backup | VM snapshots (large) | Image + volume backup (lightweight) |
| Disaster recovery | Restore from snapshot | Instantly recreate from image |
| Monitoring / logging | Traditional per-VM monitoring | Requires container-aware monitoring tools |

### Benchmark Comparison

```bash
# ===================================
# Startup time comparison experiment
# ===================================

# Measure container startup time
time docker run --rm alpine echo "Hello"
# real    0m0.432s  # Approximately 0.4 seconds

time docker run --rm nginx sh -c "echo started"
# real    0m0.512s  # Approximately 0.5 seconds

# Simultaneous startup of 100 containers
time for i in $(seq 1 100); do
  docker run -d --rm --name "bench-${i}" alpine sleep 30
done
# real    0m12.345s  # 100 containers started in about 12 seconds

# Cleanup
docker stop $(docker ps -q --filter "name=bench-") 2>/dev/null

# ===================================
# Image size comparison
# ===================================
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -h
# REPOSITORY   TAG              SIZE
# alpine       3.19             7.38MB
# busybox      1.36             4.26MB
# debian       12-slim          74.8MB
# ubuntu       22.04            77.9MB
# node         20-alpine        127MB
# python       3.12-slim        130MB
# golang       1.22-alpine      256MB
# node         20               1.1GB
# ubuntu       22.04 (VM OVA)   ~2.5GB (for reference: VM image)

# ===================================
# Memory usage comparison
# ===================================
# Container: only the app's memory footprint
docker run -d --name mem-test nginx
docker stats --no-stream mem-test
# CONTAINER   MEM USAGE / LIMIT     MEM %
# mem-test    3.5MiB / 16GiB        0.02%

# VM: memory for both the OS and the app is required
# Even a minimal Ubuntu VM needs 512 MB to 1 GB of memory
```

---

## 4. Docker's History and Ecosystem

### 4.1 Timeline

```
2000  FreeBSD Jail (precursor to container-like isolation)
  |
2004  Solaris Zones / Containers
  |
2006  Google Process Containers -> integrated into Linux kernel as cgroups
  |
2008  LXC (Linux Containers) released
  |   - First container technology combining namespaces + cgroups
  |
2013  Docker 0.1 released (by dotCloud)
  |   - User-friendly CLI wrapping LXC
  |   - Image definition via Dockerfile
  |   - Image sharing via Docker Hub
  |
2014  Docker 1.0 GA
  |   - Freed from LXC dependency via libcontainer
  |   - Docker Machine, Docker Swarm announced
  |   - Google open-sourced Kubernetes
  |
2015  OCI (Open Container Initiative) founded
  |   - Docker, CoreOS, Google, Microsoft, etc. joined
  |   - Established standard container specifications
  |   - Docker 1.8: Content Trust (image signing)
  |
2016  Docker 1.12 - Swarm Mode integrated
  |   - CRI (Container Runtime Interface) specified
  |
2017  containerd donated to CNCF
  |   - Moby project started (open-source portion of Docker)
  |   - Kubernetes added CRI support
  |   - LinuxKit announced
  |
2018  Docker Enterprise Edition enhanced
  |   - BuildKit became the default builder
  |
2019  Docker Desktop commercialization policy announced
  |   - Mirantis acquired Docker Enterprise
  |
2020  Kubernetes deprecated dockershim
  |   - Migration to containerd / CRI-O
  |   - Rootless Docker became stable
  |
2021  Docker Desktop license changed
  |   - Paid subscription required for large enterprises (250+ employees or $10M+ revenue)
  |   - Docker Compose V2 (rewritten in Go)
  |
2022  Docker Desktop for Linux released
  |   - Docker Extensions marketplace
  |   - WebAssembly (Wasm) runtime support
  |
2023  Docker Scout (vulnerability scanning)
  |   Docker Init (automatic Dockerfile generation)
  |   Docker Debug (container debugging tool)
  |
2024  Docker Compose Watch (file change detection)
  |   Docker Build Cloud (remote builds)
  |   Docker Model Runner (AI model execution)
  |
2025  Docker AI Agent (AI-assisted development)
      Docker MCP Catalog & Toolkit
```

### 4.2 Docker Architecture in Detail

```
+-------------------------------------------------------------+
|                  Docker Client                               |
|  docker CLI / Docker Desktop / Docker Compose                |
+-------------------------------------------------------------+
        | REST API (unix:///var/run/docker.sock)
        v
+-------------------------------------------------------------+
|                  Docker Daemon (dockerd)                      |
|  ├─ Image management                                         |
|  ├─ Network management                                        |
|  ├─ Volume management                                         |
|  └─ Build management (BuildKit)                               |
+-------------------------------------------------------------+
        | gRPC
        v
+-------------------------------------------------------------+
|                  containerd                                   |
|  ├─ Container lifecycle management                            |
|  ├─ Image pull/push                                           |
|  ├─ Snapshot management                                       |
|  └─ Task execution                                            |
+-------------------------------------------------------------+
        | OCI Runtime Spec
        v
+-------------------------------------------------------------+
|                  containerd-shim                              |
|  ├─ Parent process of the container process                   |
|  ├─ Keeps containers alive across daemon restarts             |
|  └─ Manages exit status                                       |
+-------------------------------------------------------------+
        |
        v
+-------------------------------------------------------------+
|                  runc (OCI Runtime)                           |
|  ├─ Creates namespaces                                        |
|  ├─ Configures cgroups                                        |
|  ├─ Applies seccomp profiles                                  |
|  └─ Starts the container process                              |
+-------------------------------------------------------------+
        |
        v
+-------------------------------------------------------------+
|                  Linux Kernel                                 |
|  namespaces / cgroups / OverlayFS / netfilter / seccomp      |
+-------------------------------------------------------------+
```

```bash
# Check Docker version (client and server)
docker version
# Client:
#  Version:           24.0.7
#  API version:       1.43
#  Go version:        go1.21.3
#  Built:             Thu Oct 26 09:07:41 2023
#  OS/Arch:           linux/amd64
#
# Server:
#  Engine:
#   Version:          24.0.7
#   API version:      1.43 (minimum version 1.12)
#   Go version:       go1.21.3
#   Built:            Thu Oct 26 09:07:41 2023
#   OS/Arch:          linux/amd64
#   containerd:       1.7.6
#   runc:             1.1.10
#   docker-init:      0.19.0

# Check Docker system info
docker info
# Containers: 5
#  Running: 3
#  Paused: 0
#  Stopped: 2
# Images: 25
# Server Version: 24.0.7
# Storage Driver: overlay2
# Logging Driver: json-file
# Cgroup Driver: systemd
# Cgroup Version: 2
# Kernel Version: 6.5.0-14-generic
# Operating System: Ubuntu 22.04.3 LTS

# Check Docker daemon process structure
ps aux | grep -E "(dockerd|containerd|shim)"
# root  1234  dockerd --group docker
# root  1235  containerd
# root  5678  containerd-shim-runc-v2 -namespace moby -id abc123

# Check Docker socket
ls -la /var/run/docker.sock
# srw-rw---- 1 root docker 0 /var/run/docker.sock

# Access Docker API directly
curl --unix-socket /var/run/docker.sock http://localhost/v1.43/info 2>/dev/null | python3 -m json.tool | head -20
```

---

## 5. OCI Standards

OCI (Open Container Initiative) is an organization that defines industry standards for containers. It was established in 2015 as a project under the Linux Foundation, with participation from Docker, Google, CoreOS, Microsoft, Red Hat, IBM, and others.

### 5.1 The Three OCI Specifications

```
+--------------------------------------------------+
|           OCI (Open Container Initiative)         |
|                                                  |
|  +-------------------------------------------+  |
|  | Runtime Specification (runtime-spec)       |  |
|  | - Defines how containers are executed      |  |
|  | - Container config via config.json         |  |
|  | - Lifecycle: create -> start -> stop       |  |
|  | - Implementations: runc, crun, youki,      |  |
|  |           gVisor, Kata Containers          |  |
|  +-------------------------------------------+  |
|                                                  |
|  +-------------------------------------------+  |
|  | Image Specification (image-spec)           |  |
|  | - Defines the container image format       |  |
|  | - Layer structure (tar + gzip)             |  |
|  | - Three elements: manifest, config, layers |  |
|  | - Multi-platform support                   |  |
|  +-------------------------------------------+  |
|                                                  |
|  +-------------------------------------------+  |
|  | Distribution Specification (dist-spec)     |  |
|  | - Defines how images are distributed       |  |
|  | - Registry API (HTTP-based)                |  |
|  | - Standardizes pull / push / discover      |  |
|  +-------------------------------------------+  |
+--------------------------------------------------+
```

### 5.2 OCI Runtime Spec in Detail

```bash
# Example of manually creating and running an OCI bundle with runc
# (A demo to understand Docker's internal workings)

# 1. Prepare the root filesystem
mkdir -p /tmp/oci-demo/rootfs
docker export $(docker create alpine) | tar -C /tmp/oci-demo/rootfs -xf -

# 2. Generate the OCI config file (config.json)
cd /tmp/oci-demo
runc spec
# config.json is generated

# 3. Key contents of config.json
cat config.json
# {
#   "ociVersion": "1.0.2",
#   "process": {
#     "terminal": true,
#     "user": { "uid": 0, "gid": 0 },
#     "args": ["sh"],
#     "env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
#     "cwd": "/"
#   },
#   "root": {
#     "path": "rootfs",
#     "readonly": true
#   },
#   "linux": {
#     "namespaces": [
#       { "type": "pid" },
#       { "type": "network" },
#       { "type": "ipc" },
#       { "type": "uts" },
#       { "type": "mount" }
#     ],
#     "resources": {
#       "memory": { "limit": 268435456 }
#     }
#   }
# }

# 4. Run the container with runc
sudo runc run my-container
# -> alpine's sh starts
```

### 5.3 OCI Image Spec in Detail

```bash
# Check the image manifest
docker manifest inspect nginx:1.25-alpine
# {
#   "schemaVersion": 2,
#   "mediaType": "application/vnd.oci.image.index.v1+json",
#   "manifests": [
#     {
#       "mediaType": "application/vnd.oci.image.manifest.v1+json",
#       "digest": "sha256:abc123...",
#       "size": 1234,
#       "platform": {
#         "architecture": "amd64",
#         "os": "linux"
#       }
#     },
#     {
#       "mediaType": "application/vnd.oci.image.manifest.v1+json",
#       "digest": "sha256:def456...",
#       "size": 1234,
#       "platform": {
#         "architecture": "arm64",
#         "os": "linux"
#       }
#     }
#   ]
# }

# Get detailed image information with skopeo
skopeo inspect docker://nginx:1.25-alpine
# {
#   "Name": "docker.io/library/nginx",
#   "Tag": "1.25-alpine",
#   "Digest": "sha256:...",
#   "RepoTags": ["1.25-alpine", "1.25.3-alpine", ...],
#   "Created": "2024-01-15T...",
#   "DockerVersion": "24.0.7",
#   "Labels": {},
#   "Architecture": "amd64",
#   "Os": "linux",
#   "Layers": [
#     "sha256:abc123...",
#     "sha256:def456...",
#     "sha256:ghi789..."
#   ]
# }

# Save image in OCI format
docker save nginx:1.25-alpine -o nginx-alpine.tar
mkdir -p /tmp/oci-image && tar -xf nginx-alpine.tar -C /tmp/oci-image
ls /tmp/oci-image/
# blobs/  index.json  manifest.json  oci-layout
```

### 5.4 OCI-Compliant Tools

```bash
# ===================================
# runc - OCI runtime reference implementation
# ===================================
runc --version
# runc version 1.1.10
# spec: 1.0.2-dev

# ===================================
# crun - High-speed OCI runtime implemented in C
# ===================================
crun --version
# crun version 1.8.7
# Faster startup than runc (approximately 2x)

# ===================================
# Podman - Daemonless container engine compatible with Docker
# ===================================
podman run --rm alpine echo "Hello from Podman"

# Compatibility with Docker CLI
alias docker=podman  # Many commands work with just this

# Podman's characteristics: daemonless + rootless by default
podman info | grep -A5 "host"
# rootless: true

# Pod (Kubernetes-compatible grouping)
podman pod create --name my-pod -p 8080:80
podman run -d --pod my-pod nginx
podman run -d --pod my-pod redis

# ===================================
# Buildah - OCI image build tool
# ===================================
# Build an image without a Dockerfile
container=$(buildah from alpine)
buildah run $container apk add --no-cache nginx
buildah config --port 80 $container
buildah config --cmd "nginx -g 'daemon off;'" $container
buildah commit $container my-nginx:latest

# Build from Dockerfile (docker build compatible)
buildah bud -t my-app:v1 .

# ===================================
# Skopeo - Container image manipulation tool
# ===================================
# Copy images between registries (no local pull needed)
skopeo copy docker://nginx:1.25 docker://myregistry.example.com/nginx:1.25

# Get detailed image information (no pull needed)
skopeo inspect docker://alpine:latest

# List registry tags
skopeo list-tags docker://nginx

# Delete an image
skopeo delete docker://myregistry.example.com/old-image:v1

# ===================================
# nerdctl - containerd-native CLI
# ===================================
# containerd client compatible with Docker CLI
nerdctl run --rm alpine echo "Hello from nerdctl"
nerdctl build -t my-app:v1 .
nerdctl compose up -d

# Features not available in Docker
nerdctl image encrypt --recipient=jwe:public.pem my-app:v1  # Image encryption
nerdctl run --cosign-key=cosign.pub verified-image:v1        # Signature verification
```

---

## 6. Container Runtime Layer Structure

### 6.1 High-Level and Low-Level Runtimes

```
+----------------------------------------------------------+
|  Container Runtime Layers                                 |
|                                                          |
|  +----------------------------------------------------+ |
|  | Container Engine (User-Facing Interface)            | |
|  | Docker Engine / Podman / nerdctl                    | |
|  +----------------------------------------------------+ |
|        |                                                 |
|        v                                                 |
|  +----------------------------------------------------+ |
|  | High-Level Runtime (Container Lifecycle Management) | |
|  | containerd / CRI-O                                  | |
|  | - Image management (pull / push / store)            | |
|  | - Container lifecycle management                    | |
|  | - Networking / storage abstraction                  | |
|  +----------------------------------------------------+ |
|        |                                                 |
|        v                                                 |
|  +----------------------------------------------------+ |
|  | Low-Level Runtime (OCI Runtime)                     | |
|  | runc / crun / youki / gVisor (runsc) / Kata         | |
|  | - Creates namespaces                                | |
|  | - Configures cgroups                                | |
|  | - Starts the container process                      | |
|  +----------------------------------------------------+ |
|        |                                                 |
|        v                                                 |
|  +----------------------------------------------------+ |
|  | Linux Kernel                                        | |
|  | namespaces / cgroups / OverlayFS / seccomp          | |
|  +----------------------------------------------------+ |
+----------------------------------------------------------+
```

### 6.2 The Relationship Between Kubernetes and Docker

```
+----------------------------------------------------------+
|  Evolution of Container Runtimes in Kubernetes            |
|                                                          |
|  ~2020: dockershim (deprecated)                           |
|  +-----------+    +-----------+    +------+    +------+  |
|  | kubelet   | -> | dockershim| -> |dockerd| -> |runc  |  |
|  +-----------+    +-----------+    +------+    +------+  |
|  * Redundant path calling containerd through Docker       |
|                                                          |
|  2020+: Direct connection to CRI-compliant runtimes       |
|                                                          |
|  Pattern A: containerd                                    |
|  +-----------+    +-----------+    +------+              |
|  | kubelet   | -> |containerd | -> |runc  |              |
|  +-----------+    +-----------+    +------+              |
|  * Direct connection to containerd, formerly part of Docker|
|                                                          |
|  Pattern B: CRI-O                                         |
|  +-----------+    +-----------+    +------+              |
|  | kubelet   | -> |  CRI-O   | -> |runc  |              |
|  +-----------+    +-----------+    +------+              |
|  * Lightweight runtime dedicated to Kubernetes            |
+----------------------------------------------------------+
```

```bash
# Check container runtimes in Kubernetes
kubectl get nodes -o wide
# NAME       STATUS   ROLES    VERSION   CONTAINER-RUNTIME
# node-1     Ready    <none>   v1.28.3   containerd://1.7.6
# node-2     Ready    <none>   v1.28.3   containerd://1.7.6

# Check containerd configuration
cat /etc/containerd/config.toml
# [plugins."io.containerd.grpc.v1.cri"]
#   [plugins."io.containerd.grpc.v1.cri".containerd]
#     default_runtime_name = "runc"
#     [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
#       runtime_type = "io.containerd.runc.v2"

# Get container info using crictl (CRI debugging tool)
crictl ps
# CONTAINER   IMAGE    CREATED    STATE    NAME          POD ID
# abc123...   nginx    10m ago    Running  web-server    def456...

crictl images
# IMAGE                     TAG       SIZE
# docker.io/library/nginx   1.25      41.2MB
```

### 6.3 Sandbox Runtimes

Runtimes that provide stronger security isolation than traditional containers.

```
+----------------------------------------------------------+
|  Comparison of Sandbox Runtimes                           |
|                                                          |
|  +-------------------+  +----------------------------+   |
|  | gVisor (runsc)    |  | Kata Containers            |   |
|  |                   |  |                            |   |
|  | Re-implements     |  | Runs containers inside     |   |
|  | the kernel in     |  | a lightweight VM           |   |
|  | user space        |  |                            |   |
|  |                   |  |                            |   |
|  | +-------------+   |  | +------------------------+ |   |
|  | | App         |   |  | | Lightweight VM         | |   |
|  | +-------------+   |  | | +------------------+   | |   |
|  | | gVisor      |   |  | | | App              |   | |   |
|  | | Sentry      |   |  | | +------------------+   | |   |
|  | | (kernel     |   |  | | | Guest Kernel     |   | |   |
|  | |  emulation) |   |  | | +------------------+   | |   |
|  | +-------------+   |  | +------------------------+ |   |
|  | | Host Kernel |   |  | | QEMU / Firecracker   | |   |
|  | +-------------+   |  | +------------------------+ |   |
|  +-------------------+  +----------------------------+   |
|                                                          |
|  gVisor: Improves security by       Kata: Provides VM-    |
|  filtering/reimplementing syscalls  level isolation with  |
|                                     container usability   |
+----------------------------------------------------------+
```

```bash
# Install gVisor and use it
# Register the gVisor runtime with Docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc"
    }
  }
}
EOF
sudo systemctl restart docker

# Run a container with gVisor
docker run --runtime=runsc --rm alpine uname -a
# Linux ... 4.4.0 ... gVisor

# Run a container with Kata Containers
docker run --runtime=kata --rm alpine uname -a
# Linux ... 5.15.0 ... (lightweight VM kernel)

# Performance comparison by runtime
# runc:    startup ~300ms, memory +0MB (baseline)
# gVisor:  startup ~500ms, memory +50MB (Sentry process overhead)
# Kata:    startup ~1.5s,  memory +128MB (lightweight VM overhead)
```

---

## 7. Container Use Cases

### 7.1 Microservices Architecture

```bash
# Run each service as an independent container
docker network create microservices

# API Gateway
docker run -d --name api-gateway \
  --network microservices \
  -p 8080:8080 \
  -e UPSTREAM_SERVICES="user-service:8081,order-service:8082,payment-service:8083" \
  api-gateway:v1

# User service
docker run -d --name user-service \
  --network microservices \
  -e DB_HOST=user-db \
  -e DB_PORT=5432 \
  user-service:v1

# Order service
docker run -d --name order-service \
  --network microservices \
  -e DB_HOST=order-db \
  -e KAFKA_BROKERS=kafka:9092 \
  order-service:v1

# Payment service
docker run -d --name payment-service \
  --network microservices \
  -e STRIPE_API_KEY_FILE=/run/secrets/stripe_key \
  payment-service:v1

# Databases
docker run -d --name user-db \
  --network microservices \
  -v user-db-data:/var/lib/postgresql/data \
  postgres:16-alpine

docker run -d --name order-db \
  --network microservices \
  -v order-db-data:/var/lib/postgresql/data \
  postgres:16-alpine

# Message queue
docker run -d --name kafka \
  --network microservices \
  -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092 \
  confluentinc/cp-kafka:7.5
```

```yaml
# Microservices configuration via docker-compose.yml
services:
  api-gateway:
    image: api-gateway:v1
    ports:
      - "8080:8080"
    depends_on:
      - user-service
      - order-service
      - payment-service
    environment:
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
    networks:
      - frontend
      - backend

  user-service:
    image: user-service:v1
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    depends_on:
      user-db:
        condition: service_healthy
    environment:
      - DB_HOST=user-db
    networks:
      - backend

  user-db:
    image: postgres:16-alpine
    volumes:
      - user-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  jaeger:
    image: jaegertracing/all-in-one:1.52
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
    networks:
      - backend

networks:
  frontend:
  backend:

volumes:
  user-db-data:
```

### 7.2 Unified Development Environment

```yaml
# Development environment definition via docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules  # Use node_modules from inside the container
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://devuser:devpass@db:5432/devdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: devdb
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devuser -d devdb"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru

  mailhog:
    image: mailhog/mailhog:v1.0.1
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"  # Console
    volumes:
      - minio-data:/data

volumes:
  postgres-data:
  minio-data:
```

### 7.3 CI/CD Pipeline

```yaml
# Example of container usage in GitHub Actions
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Build test image
        run: docker build --target test -t myapp:test .

      - name: Run unit tests
        run: |
          docker run --rm \
            --network host \
            -e DATABASE_URL=postgresql://test:test@localhost:5432/testdb \
            -e REDIS_URL=redis://localhost:6379 \
            myapp:test npm test

      - name: Run integration tests
        run: |
          docker run --rm \
            --network host \
            -e DATABASE_URL=postgresql://test:test@localhost:5432/testdb \
            myapp:test npm run test:integration

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deploy to Kubernetes
          kubectl set image deployment/myapp \
            myapp=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          kubectl rollout status deployment/myapp --timeout=300s
```

### 7.4 Data Science and Machine Learning

```yaml
# docker-compose.yml for ML development environment
services:
  jupyter:
    image: jupyter/scipy-notebook:latest
    ports:
      - "8888:8888"
    volumes:
      - ./notebooks:/home/jovyan/work
      - ./data:/home/jovyan/data
    environment:
      - JUPYTER_ENABLE_LAB=yes
      - GRANT_SUDO=yes
    user: root

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.9.0
    ports:
      - "5000:5000"
    command: >
      mlflow server
      --backend-store-uri postgresql://mlflow:mlflow@mlflow-db:5432/mlflow
      --default-artifact-root s3://mlflow-artifacts/
      --host 0.0.0.0
    depends_on:
      - mlflow-db

  mlflow-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: mlflow
      POSTGRES_PASSWORD: mlflow
      POSTGRES_DB: mlflow
    volumes:
      - mlflow-db-data:/var/lib/postgresql/data

  gpu-training:
    build:
      context: .
      dockerfile: Dockerfile.gpu
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    volumes:
      - ./models:/app/models
      - ./data:/app/data
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - CUDA_VISIBLE_DEVICES=0,1

volumes:
  mlflow-db-data:
```

```dockerfile
# Dockerfile.gpu - GPU-enabled ML environment
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3-pip python3-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \
    torch torchvision torchaudio \
    transformers datasets accelerate \
    mlflow scikit-learn pandas numpy

WORKDIR /app
COPY . .

CMD ["python3", "train.py"]
```

### 7.5 Running Local Tools and Services

```bash
# Start a temporary database (for development/testing)
docker run --rm -d \
  --name temp-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=mypassword \
  postgres:16-alpine

# Start a temporary Redis instance
docker run --rm -d \
  --name temp-redis \
  -p 6379:6379 \
  redis:7-alpine

# Preview a static site
docker run --rm -p 8080:80 \
  -v $(pwd)/dist:/usr/share/nginx/html:ro \
  nginx:alpine

# Run database migrations
docker run --rm \
  --network host \
  -v $(pwd)/migrations:/migrations \
  migrate/migrate \
  -path=/migrations -database "postgresql://user:pass@localhost:5432/mydb?sslmode=disable" up

# Security scan
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image nginx:1.25

# Code formatting (runtime independent of language)
docker run --rm -v $(pwd):/work -w /work \
  golangci/golangci-lint:latest golangci-lint run

# Generate diagrams with PlantUML
docker run --rm -v $(pwd):/data \
  plantuml/plantuml:latest /data/diagram.puml
```

---

## 8. Anti-Patterns and Best Practices

### Anti-Pattern 1: Using Containers Like VMs

```bash
# NG: Stuffing multiple services into a single container
# Cramming SSH, cron, the app, and the DB all into one container
docker run -d my-monolith-container
# -> Difficult to maintain, cannot scale independently, complex log management

# OK: One container, one process principle
docker run -d --name app my-app
docker run -d --name db postgres:16
docker run -d --name cache redis:7
# -> Each can be scaled, updated, and monitored independently
```

### Anti-Pattern 2: Relying on the latest Tag

```bash
# NG: Not specifying a version
docker run -d nginx:latest
# -> Not reproducible. May suddenly stop working one day.
# -> Risk of running a different version in production than what passed CI

# OK: Specify an explicit version
docker run -d nginx:1.25.3-alpine
# -> The same image is always used regardless of when it runs

# Even stricter: Pin by digest
docker run -d nginx@sha256:abc123def456...
# -> Not affected even if the tag is overwritten
```

### Anti-Pattern 3: Carelessly Using Host Networking

```bash
# NG: Using host networking as a default
docker run --network host my-app
# -> Port conflicts, security risks, reduced portability

# OK: Use bridge networking with port mapping
docker run -p 8080:80 my-app
# -> Explicit port control, isolated networking
```

### Anti-Pattern 4: Persisting Data Inside Containers

```bash
# NG: Storing data inside the container
docker run -d my-app
# Data is lost when the container is recreated

# OK: Use volumes
docker run -d -v app-data:/data my-app
# Data persists even after the container is destroyed

# OK: Use bind mounts (for development environments)
docker run -d -v $(pwd)/data:/data my-app
```

### Anti-Pattern 5: Running as Root

```bash
# NG: Running as root (the default)
docker run -d my-app
# Risk of gaining host root privileges if the container is escaped

# OK: Run as a non-privileged user
# Specify in Dockerfile:
# RUN addgroup -S app && adduser -S app -G app
# USER app

# Or specify at runtime:
docker run -d --user 1000:1000 my-app

# Use rootless Docker:
dockerd-rootless.sh
```

### Anti-Pattern 6: Embedding Secrets

```bash
# NG: Passing secrets via environment variables
docker run -e API_KEY=sk-12345secret my-app
# -> Visible via docker inspect, risk of leaking into logs

# NG: Hardcoding in Dockerfile
# ENV API_KEY=sk-12345secret
# -> Permanently stored in the image

# OK: Use Docker Secrets (Swarm mode)
echo "sk-12345secret" | docker secret create api_key -
docker service create --secret api_key my-app
# Readable inside the container as /run/secrets/api_key

# OK: Integration with external secret management tools
docker run -d \
  -e VAULT_ADDR=https://vault.example.com \
  -e VAULT_TOKEN_FILE=/run/secrets/vault_token \
  my-app
```

---

## 9. Future Outlook for Container Technology

### 9.1 WebAssembly (Wasm) Containers

```bash
# Example of running Docker + Wasm
# Using the containerd Wasm shim
docker run --runtime=io.containerd.wasmedge.v1 \
  --platform wasi/wasm \
  ghcr.io/example/wasm-app:latest

# Characteristics of Wasm containers:
# - Startup time: ~1ms (standard containers: ~300ms)
# - Size: ~KB scale (standard containers: ~MB scale)
# - Security: Sandbox model by default
# - Portability: Not dependent on CPU architecture
```

### 9.2 Confidential Containers

```
+----------------------------------------------------------+
|  Confidential Containers (CoCo)                          |
|                                                          |
|  Hardware-based confidential computing                   |
|  Runs containers inside a TEE                            |
|  (Trusted Execution Environment)                         |
|                                                          |
|  +----------------------------------------------------+ |
|  | TEE (Intel SGX / AMD SEV / ARM CCA)                | |
|  | +------------------------------------------------+ | |
|  | | Encrypted memory space                          | | |
|  | | +--------------------------------------------+  | | |
|  | | | Container (started from encrypted image)   |  | | |
|  | | | Data is only decrypted inside the TEE      |  | | |
|  | | +--------------------------------------------+  | | |
|  | +------------------------------------------------+ | |
|  +----------------------------------------------------+ |
|  Host OS and cloud providers cannot access the data      |
+----------------------------------------------------------+
```

### 9.3 Container Monitoring with eBPF

```bash
# eBPF-based container security tools
# Falco - Runtime security detection
docker run --rm -i -t \
  --privileged \
  -v /var/run/docker.sock:/host/var/run/docker.sock \
  -v /proc:/host/proc:ro \
  falcosecurity/falco:latest

# Cilium - eBPF-based container networking
# Implements NetworkPolicy with eBPF (faster than iptables)
# L7-level traffic visibility
```

---

## 10. FAQ

### Q1: Are containers a superset of virtual machines?

**A:** No. Containers and VMs are complementary technologies. Because containers share the host OS kernel, VMs are required in scenarios that need a different OS kernel (e.g., running a Windows application on a Linux host). VMs are also more appropriate for multi-tenant environments where strong security isolation is required. Many cloud environments adopt a hybrid configuration that runs containers inside VMs.

### Q2: How do Docker and Podman differ?

**A:** The biggest difference is their architecture. Docker uses a client-server model with a resident daemon (dockerd), whereas Podman is daemonless and each container runs as an independent process. Podman is OCI-compliant and has high compatibility with the Docker CLI (many commands work with just `alias docker=podman`). Rootless execution is supported by default, which is a security advantage. Podman also has a Pod feature for Kubernetes-compatible grouping. However, Docker has a more mature integrated toolchain (like Docker Compose) and better enterprise support.

### Q3: Do containers run natively on Windows or macOS?

**A:** Linux containers depend on Linux kernel features (namespaces, cgroups), so they do not run natively on macOS or Windows. Docker Desktop internally starts a lightweight Linux VM and runs containers inside it. On macOS, Apple's Virtualization.framework (or HyperKit on Intel Macs) is used; on Windows, WSL2 (Windows Subsystem for Linux 2) is used. Windows containers (on Windows Server) run natively on the Windows kernel but are not compatible with Linux containers.

### Q4: Is container security weaker than VM security?

**A:** While risks from a shared kernel do exist, sufficient practical security can be achieved with appropriate measures. Specifically: using rootless containers, applying seccomp profiles, AppArmor/SELinux, read-only filesystems, and the principle of least privilege (capability restrictions). Furthermore, sandbox runtimes like gVisor and Kata Containers can achieve isolation close to the VM level. A hybrid VM + container configuration is recommended for multi-tenant environments.

### Q5: What is the Docker Desktop licensing situation?

**A:** As of the August 2021 change, companies with 250 or more employees or $10M or more in annual revenue must purchase a paid subscription (Pro / Team / Business). Individual use, small businesses, educational institutions, and open-source projects can continue to use it for free. Alternatives include using Docker Engine (free) directly on Linux, using Colima or Lima + nerdctl on macOS, or using WSL2 + Docker Engine on Windows.

### Q6: What is the difference between containerd and CRI-O?

**A:** containerd is a general-purpose container runtime separated from Docker, also used as the backend for Docker Engine and nerdctl. CRI-O is a lightweight runtime designed specifically for Kubernetes, specialized for the CRI (Container Runtime Interface). containerd is more versatile and has a wider track record. CRI-O is not used outside Kubernetes, but for that reason it is lightweight and has a smaller attack surface. Both are OCI-compliant and use runc as the low-level runtime.

### Q7: Can systemd be used inside containers?

**A:** It is technically possible but not recommended. Containers are designed around the "one container, one process" principle, and using an init system is considered an anti-pattern. However, it may be necessary during the migration of legacy applications that depend on systemd. In that case, the `--privileged` flag or mounting `/sys/fs/cgroup` is required. As an alternative, it is recommended to use a lightweight init process like `tini` or `dumb-init` as PID 1 (Docker can automatically use `tini` with the `--init` flag).

### Q8: What are the alternatives to Docker?

**A:** The main alternative tools are as follows.

| Tool | Use Case | Features |
|---|---|---|
| Podman | Container execution | Daemonless, rootless, Docker CLI compatible |
| nerdctl | Container execution | containerd-native, Docker CLI compatible |
| Buildah | Image building | Can build without a Dockerfile |
| Skopeo | Image operations | Copy between registries without pulling |
| Kaniko | CI/CD builds | Builds without a Docker daemon |
| Lima | Linux VM on macOS | Alternative to Docker Desktop |
| Colima | Docker on macOS | Simple Docker environment based on Lima |
| Finch | Container execution | Provided by AWS, based on Lima + nerdctl |

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it behaves.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## 11. Summary

| Item | Key Point |
|---|---|
| What are containers | Process-level virtualization that shares the host OS kernel |
| Underlying technologies | Linux namespaces (isolation) + cgroups (resource limits) + UnionFS (layered FS) |
| Difference from VMs | Fast and lightweight with no guest OS, but isolation level differs |
| Role of Docker | The de facto standard toolchain of the container ecosystem |
| Architecture | Docker CLI -> dockerd -> containerd -> runc -> kernel |
| OCI standards | Three specifications: runtime-spec, image-spec, distribution-spec |
| Runtime layers | High-level (containerd/CRI-O) + Low-level (runc/crun) |
| Sandboxes | gVisor (kernel reimplementation) / Kata (lightweight VM) |
| Key use cases | Microservices, unified dev environments, CI/CD, ML/AI |
| Design principles | One container per process, immutable, version-pinned |
| Security | Rootless, seccomp, capability restrictions, minimal base image |
| Future outlook | WebAssembly containers, Confidential Containers, eBPF |

---

## Guides to Read Next

- [01-docker-install.md](./01-docker-install.md) -- Docker installation and initial setup
- [02-docker-basics.md](./02-docker-basics.md) -- Docker basic operations
- [../01-dockerfile/00-dockerfile-basics.md](../01-dockerfile/00-dockerfile-basics.md) -- Dockerfile basics

---

## References

1. **Docker Documentation - Get Started** https://docs.docker.com/get-started/ -- Official Docker tutorial covering everything from basic container concepts to practical usage.
2. **Open Container Initiative (OCI)** https://opencontainers.org/ -- Official OCI website. Publishes the runtime-spec, image-spec, and distribution-spec specifications.
3. **Linux man pages - namespaces(7)** https://man7.org/linux/man-pages/man7/namespaces.7.html -- Official documentation for Linux namespaces. Refer to this for a deep understanding of the foundational container technology.
4. **Linux man pages - cgroups(7)** https://man7.org/linux/man-pages/man7/cgroups.7.html -- Official cgroups documentation. Explains the resource limiting mechanism in detail.
5. **Kubernetes Documentation - Container Runtimes** https://kubernetes.io/docs/setup/production-environment/container-runtimes/ -- Comparison and configuration of container runtimes such as containerd and CRI-O.
6. **containerd Documentation** https://containerd.io/docs/ -- Official containerd documentation. Details on the container runtime used internally by Docker.
7. **Podman Documentation** https://podman.io/docs -- Official Podman documentation. Usage of the Docker alternative tool.
8. **gVisor Documentation** https://gvisor.dev/docs/ -- Official gVisor documentation. Security hardening via sandbox runtime.
9. **NIST SP 800-190 Application Container Security Guide** -- Best practices guide for container security.
