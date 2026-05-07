# Docker Networking

> Understand the full picture of Docker networking, which controls communication between containers and connectivity to the host and external networks.

---

## What You Will Learn

1. Understand **the differences and use cases of the three major network drivers: bridge, host, and overlay**
2. Learn **the mechanisms of port mapping and service discovery via the built-in DNS**
3. Grasp **the steps to build overlay networks in multi-host environments**
4. Study **practical patterns for security design through network isolation**
5. Acquire **troubleshooting techniques** to quickly resolve network issues


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Basic Concepts of Docker Networking

Docker assigns an independent network namespace (Network Namespace) to each container. This gives each container its own IP address, routing table, and iptables rules.

### Overview of Network Drivers

```
┌─────────────────────────────────────────────────────┐
│                   Docker Host                       │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Container│  │ Container│  │ Container│         │
│  │   App A  │  │   App B  │  │   App C  │         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│       │              │              │               │
│  ┌────▼──────────────▼──────────────▼─────┐        │
│  │         docker0 (bridge)               │        │
│  │         172.17.0.0/16                  │        │
│  └────────────────┬───────────────────────┘        │
│                   │                                 │
│              ┌────▼────┐                           │
│              │  eth0   │  ← Host NIC               │
│              └────┬────┘                           │
└───────────────────┼─────────────────────────────────┘
                    │
               External Network
```

### How Network Namespaces Work

Linux network namespaces provide each container with an independent network stack. This includes the following elements.

```
┌───────────── Container Network Namespace ──────────────┐
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  eth0 (veth pair)     172.17.0.2/16              │  │
│  │  Routing Table                                    │  │
│  │    default via 172.17.0.1 dev eth0               │  │
│  │  DNS resolver                                     │  │
│  │    nameserver 127.0.0.11                          │  │
│  │  iptables rules                                   │  │
│  │  Loopback (lo: 127.0.0.1)                        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│      ↕ veth pair (virtual Ethernet pair)               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Host side: vethXXXXXX → connected to docker0 bridge │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Network Driver Comparison Table

| Driver | Scope | Use Case | IP Address | Performance |
|--------|-------|----------|------------|-------------|
| bridge | Single host | Default, development environments | Auto-assigned (172.17.x.x) | Good |
| host | Single host | Maximum performance | Shared with host | Best |
| overlay | Multi-host | Swarm/production clusters | Auto-assigned (10.0.x.x) | VXLAN overhead |
| macvlan | Single host | Requires direct physical NIC connection | Physical network | Good |
| ipvlan | Single host | Alternative to macvlan | Physical network | Good |
| none | - | Disable networking | None | - |

### Driver Selection Flowchart

```
Does the container need networking?
    │
    ├── No ──► none driver
    │
    └── Yes ──► Is multi-host communication required?
                   │
                   ├── Yes ──► overlay driver (Swarm/K8s)
                   │
                   └── No ──► Is maximum performance required?
                                │
                                ├── Yes ──► host driver (Linux only)
                                │
                                └── No ──► Does it need to join the physical network directly?
                                             │
                                             ├── Yes ──► macvlan / ipvlan
                                             │
                                             └── No ──► bridge driver (recommended)
```

---

## 2. Bridge Network

### Default Bridge vs User-Defined Bridge

There are important differences between the `docker0` bridge created at Docker installation (default bridge) and a custom bridge that users create explicitly.

| Property | Default Bridge | User-Defined Bridge |
|----------|---------------|---------------------|
| DNS resolution | Not available (IP only) | Resolvable by container name |
| Auto-connect | All containers connect | Specified explicitly |
| Network isolation | No isolation | Isolated per network |
| Live connect/disconnect | Not available | Available |
| Environment variable sharing | `--link` (deprecated) | Not needed |
| Custom subnet | Not available | Available |
| MTU setting | Not available | Available |

### Code Example 1: Creating a User-Defined Bridge Network

```bash
# ユーザー定義bridgeネットワークを作成
docker network create \
  --driver bridge \
  --subnet 192.168.100.0/24 \
  --gateway 192.168.100.1 \
  --ip-range 192.168.100.128/25 \
  my-app-network

# ネットワークの詳細を確認
docker network inspect my-app-network

# コンテナをネットワークに接続して起動
docker run -d \
  --name web-server \
  --network my-app-network \
  nginx:alpine

docker run -d \
  --name api-server \
  --network my-app-network \
  node:20-alpine sleep infinity

# web-server から api-server へ名前解決で通信できる
docker exec web-server ping -c 3 api-server

# 既存のコンテナをネットワークに動的に接続
docker network connect my-app-network existing-container

# ネットワークから切断
docker network disconnect my-app-network existing-container
```

### Code Example 2: Network Definition in Docker Compose

```yaml
# docker-compose.yml
services:
  frontend:
    image: nginx:alpine
    networks:
      - frontend-net
    ports:
      - "80:80"

  api:
    build: ./api
    networks:
      - frontend-net
      - backend-net
    environment:
      DB_HOST: database  # DNS名で参照

  database:
    image: postgres:16-alpine
    networks:
      - backend-net
    environment:
      POSTGRES_PASSWORD: secret

networks:
  frontend-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
  backend-net:
    driver: bridge
    internal: true  # 外部アクセス不可
    ipam:
      config:
        - subnet: 172.21.0.0/24
```

Network isolation structure:

```
      External (Internet)
          │
          │ :80
    ┌─────▼─────┐
    │  frontend  │──── frontend-net (172.20.0.0/24)
    └───────────┘          │
                     ┌─────▼─────┐
                     │    api    │──── backend-net (172.21.0.0/24)
                     └───────────┘      │  ※ internal: true
                                  ┌─────▼─────┐
                                  │  database  │
                                  └───────────┘
                                  (No external access)
```

### Code Example 2b: Advanced Network Configuration Options

```yaml
# docker-compose.yml - 高度なネットワーク設定
networks:
  # カスタムサブネットとゲートウェイ
  custom-net:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.30.0.0/24
          gateway: 172.30.0.1
          ip_range: 172.30.0.128/25    # IPアドレスの割り当て範囲

  # 外部ネットワーク（既に存在するネットワークを参照）
  existing-net:
    external: true
    name: my-existing-network

  # MTUとドライバーオプション
  optimized-net:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "true"           # コンテナ間通信
      com.docker.network.bridge.enable_ip_masquerade: "true"  # IPマスカレード
      com.docker.network.bridge.host_binding_ipv4: "0.0.0.0"  # バインドIP
      com.docker.network.driver.mtu: "1500"                   # MTU
    labels:
      environment: production
      team: platform
```

### Code Example 2c: Fixing IP Addresses for Multiple Containers Joining a Network

```yaml
services:
  app:
    image: my-app:latest
    networks:
      app-net:
        ipv4_address: 172.25.0.10
        aliases:
          - application
          - webapp

  db:
    image: postgres:16-alpine
    networks:
      app-net:
        ipv4_address: 172.25.0.20
        aliases:
          - database
          - postgres

  cache:
    image: redis:7-alpine
    networks:
      app-net:
        ipv4_address: 172.25.0.30
        aliases:
          - redis
          - cache

networks:
  app-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/24
          gateway: 172.25.0.1
```

---

## 3. Port Mapping

### Code Example 3: Various Port Mapping Patterns

```bash
# 基本: ホストの8080番をコンテナの80番にマッピング
docker run -d -p 8080:80 nginx:alpine

# 特定IPにバインド（localhostのみ公開）
docker run -d -p 127.0.0.1:8080:80 nginx:alpine

# UDPポートの公開
docker run -d -p 5353:53/udp dns-server

# ランダムポート割当（ホスト側ポートを自動決定）
docker run -d -p 80 nginx:alpine
# → docker port <container> で確認

# 複数ポートの公開
docker run -d \
  -p 80:80 \
  -p 443:443 \
  -p 8443:8443 \
  nginx:alpine

# ポート範囲の公開
docker run -d -p 7000-7010:7000-7010 my-app

# TCP と UDP の両方を公開
docker run -d -p 53:53/tcp -p 53:53/udp dns-server

# 全ポートを公開 (-P: Dockerfile の EXPOSE で定義されたポート)
docker run -d -P nginx:alpine
```

### How Port Mapping Works (iptables)

```
External Client
    │
    │ :8080
    ▼
┌──────────────────────────────────────┐
│  iptables NAT Table                  │
│  DNAT: 0.0.0.0:8080 → 172.17.0.2:80│
│                                      │
│  ┌────────────────────────────┐     │
│  │  docker-proxy (userland)   │     │
│  │  localhost:8080 → ctr:80   │     │
│  └────────────────────────────┘     │
│                                      │
│  ┌────────────────┐                 │
│  │  Container      │                 │
│  │  172.17.0.2:80  │                 │
│  └────────────────┘                 │
└──────────────────────────────────────┘
```

### Port Mapping in Docker Compose

```yaml
services:
  web:
    image: nginx:alpine
    ports:
      # 短縮構文
      - "80:80"                    # ホスト:コンテナ
      - "443:443"
      - "127.0.0.1:8080:80"       # 特定IPにバインド

      # 長文構文（推奨: 意図が明確）
      - target: 80                 # コンテナ側ポート
        published: 8080            # ホスト側ポート
        protocol: tcp
        mode: host                 # host or ingress

  db:
    image: postgres:16-alpine
    ports:
      # 開発時のみ外部公開（本番では expose のみ）
      - "127.0.0.1:5432:5432"

    # expose: コンテナ間通信のみ（ホストには非公開）
    expose:
      - "5432"
```

### Pattern to Prevent Port Conflicts

```yaml
# .env ファイルでポートを変数化
APP_PORT=3000
DB_PORT=5432
REDIS_PORT=6379

# docker-compose.yml
services:
  app:
    ports:
      - "${APP_PORT:-3000}:3000"
  db:
    ports:
      - "127.0.0.1:${DB_PORT:-5432}:5432"
  redis:
    ports:
      - "127.0.0.1:${REDIS_PORT:-6379}:6379"
```

---

## 4. Host Network

With the host driver, containers directly share the host's network namespace. Since no network translation is needed, it offers the highest performance.

### Code Example 4: Using the Host Network

```bash
# hostネットワークでNginxを起動
# コンテナのポート80がそのままホストのポート80になる
docker run -d \
  --network host \
  --name web \
  nginx:alpine

# ポートマッピング不要（-p フラグは無視される）
curl http://localhost:80

# host ネットワークの確認
docker inspect web --format '{{.NetworkSettings.Networks}}'
```

> **Note**: The host network is fully supported only on Linux. On macOS/Windows, it shares the host inside Docker Desktop's virtual machine, so direct access from the host OS is not available.

### When to Use the Host Network

| Use Case | Reason |
|----------|--------|
| High-frequency small packet communication | Eliminates NAT overhead |
| Network monitoring tools | Direct access to the host's network stack |
| Performance benchmarking | Eliminates the impact of network translation |
| Legacy application migration | When port mapping changes are difficult |

### Host Network in Docker Compose

```yaml
services:
  # パフォーマンスが重要なサービス
  high-perf-app:
    image: my-app:latest
    network_mode: host
    # ports: は使用不可（hostネットワークでは無視される）
    environment:
      PORT: 8080

  # 監視ツール（ホストのネットワークを監視）
  prometheus:
    image: prom/prometheus:latest
    network_mode: host
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

---

## 5. Overlay Network

### How Multi-Host Communication Works

```
┌─────────── Host A ───────────┐   ┌─────────── Host B ───────────┐
│ ┌─────────┐  ┌─────────┐    │   │    ┌─────────┐  ┌─────────┐ │
│ │  Web-1  │  │  Web-2  │    │   │    │  API-1  │  │  DB-1   │ │
│ └────┬────┘  └────┬────┘    │   │    └────┬────┘  └────┬────┘ │
│      │            │          │   │         │            │      │
│ ┌────▼────────────▼────┐    │   │    ┌────▼────────────▼────┐ │
│ │  Overlay: my-overlay │    │   │    │  Overlay: my-overlay │ │
│ │  (VXLAN トンネル)     │◄──┼───┼───►│  (VXLAN トンネル)     │ │
│ └──────────────────────┘    │   │    └──────────────────────┘ │
│           │                  │   │              │              │
│      ┌────▼────┐            │   │         ┌────▼────┐        │
│      │  eth0   │            │   │         │  eth0   │        │
└──────┴─────────┴────────────┘   └─────────┴─────────┴────────┘
            │    UDP 4789 (VXLAN)        │
            └────────────────────────────┘
```

### How VXLAN Works in Detail

VXLAN (Virtual Extensible LAN) is a technology that encapsulates Layer 2 frames into Layer 3 packets. This allows you to build a virtual Layer 2 network that spans physical networks.

```
┌──────────────────────────────────────────────┐
│          VXLAN Encapsulated Packet             │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ Outer Ethernet Header                │    │
│  │ Outer IP Header (Host A → Host B)   │    │
│  │ Outer UDP Header (src → dst:4789)   │    │
│  │ VXLAN Header (VNI: Network ID)      │    │
│  │  ┌────────────────────────────────┐ │    │
│  │  │ Inner Ethernet Header          │ │    │
│  │  │ Inner IP Header (Ctr → Ctr)   │ │    │
│  │  │ Payload (Application Data)    │ │    │
│  │  └────────────────────────────────┘ │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### Code Example 5: Building an Overlay Network (Docker Swarm)

```bash
# Swarmを初期化（マネージャーノード）
docker swarm init --advertise-addr 192.168.1.10

# ワーカーノードをSwarmに参加
docker swarm join --token SWMTKN-xxx 192.168.1.10:2377

# 暗号化付きオーバーレイネットワークを作成
docker network create \
  --driver overlay \
  --subnet 10.10.0.0/16 \
  --opt encrypted \
  --attachable \
  my-overlay

# サービスをオーバーレイネットワーク上にデプロイ
docker service create \
  --name web \
  --network my-overlay \
  --replicas 3 \
  --publish published=80,target=80 \
  nginx:alpine

# ネットワーク状態の確認
docker network inspect my-overlay

# オーバーレイネットワークの暗号化状態を確認
docker network inspect my-overlay --format '{{.Options}}'
```

### Overlay Network in Docker Compose (Swarm mode)

```yaml
# docker-compose.yml (Swarm mode)
services:
  web:
    image: nginx:alpine
    deploy:
      replicas: 3
      placement:
        constraints:
          - node.role == worker
    networks:
      - frontend

  api:
    image: my-api:latest
    deploy:
      replicas: 2
    networks:
      - frontend
      - backend

  db:
    image: postgres:16-alpine
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.type == db
    networks:
      - backend
    volumes:
      - pgdata:/var/lib/postgresql/data

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    internal: true     # 外部アクセス不可
    driver_opts:
      encrypted: "true"  # IPsec暗号化

volumes:
  pgdata:
```

---

## 6. Macvlan Network

The macvlan driver assigns a MAC address on the physical network to a container, making it appear as if it is directly connected to the physical network. Use this when direct communication with legacy applications or network devices is required.

### Code Example 5b: Building a Macvlan Network

```bash
# macvlan ネットワークの作成
docker network create \
  --driver macvlan \
  --subnet 192.168.1.0/24 \
  --gateway 192.168.1.1 \
  --opt parent=eth0 \
  macvlan-net

# コンテナを macvlan ネットワークに接続
docker run -d \
  --name legacy-app \
  --network macvlan-net \
  --ip 192.168.1.100 \
  legacy-app:latest

# 802.1Q VLAN タグ付き macvlan
docker network create \
  --driver macvlan \
  --subnet 192.168.10.0/24 \
  --gateway 192.168.10.1 \
  --opt parent=eth0.10 \
  macvlan-vlan10
```

> **Note**: When using macvlan, direct communication from the host machine to the container is not available by default. This is a limitation of the macvlan specification. If communication between the host and containers is required, consider using IPvlan instead.

---

## 7. DNS and Service Discovery

Docker's built-in DNS server (127.0.0.11) automatically resolves container names within user-defined networks.

### DNS Resolution Flow

```
Container A resolves "api-server"
    │
    ▼
┌──────────────────────┐
│ Resolver in container │
│ /etc/resolv.conf     │
│ nameserver 127.0.0.11│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     Found
│ Docker built-in DNS  │────────────►  172.20.0.3 (api-server)
│ (127.0.0.11)         │
└──────────┬───────────┘
           │ Not found
           ▼
┌──────────────────────┐
│ Host DNS resolver    │────────────►  External DNS response
│ (8.8.8.8, etc.)      │
└──────────────────────┘
```

### DNS Resolution Targets and Priority

Docker's built-in DNS resolves names in the following order.

```
1. Container name (name specified with --name)
   Example: "api-server" → 172.20.0.3

2. Network alias (--network-alias / networks.aliases)
   Example: "api" → 172.20.0.3 (round-robin if multiple containers)

3. Compose service name
   Example: "api" → IP of containers belonging to the service

4. External DNS (uses host's resolv.conf)
   Example: "google.com" → 142.250.xxx.xxx
```

### Code Example 6: Aliases and Service Discovery

```yaml
# docker-compose.yml
services:
  app:
    image: my-app:latest
    networks:
      app-net:
        aliases:
          - application
          - webapp

  cache-primary:
    image: redis:7-alpine
    networks:
      app-net:
        aliases:
          - redis
          - cache

  cache-replica:
    image: redis:7-alpine
    command: redis-server --replicaof redis 6379
    networks:
      app-net:
        aliases:
          - redis    # 同一エイリアスでラウンドロビンDNS
          - cache

networks:
  app-net:
    driver: bridge
```

```bash
# DNS解決の確認
docker run --rm --network app-net busybox nslookup redis
# → cache-primary と cache-replica の両方のIPが返る

# 特定コンテナのDNS設定を確認
docker exec app cat /etc/resolv.conf

# DNS解決のテスト（dig コマンド）
docker run --rm --network app-net tutum/dnsutils dig redis

# 逆引きDNS
docker run --rm --network app-net busybox nslookup 172.20.0.3
```

### Custom DNS Configuration

```yaml
services:
  app:
    image: my-app:latest
    dns:
      - 8.8.8.8
      - 8.8.4.4
    dns_search:
      - example.com
      - internal.example.com
    dns_opt:
      - "ndots:2"
      - "timeout:3"
    extra_hosts:
      - "host.docker.internal:host-gateway"   # ホストマシンへのアクセス
      - "legacy-server:192.168.1.100"         # 手動DNS設定
```

---

## 8. Practical Network Configuration Examples

### Code Example 7: Microservices Configuration

```yaml
# docker-compose.yml - マイクロサービス構成
services:
  # --- Frontend Layer ---
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    networks:
      - public
      - app-tier
    depends_on:
      - frontend

  frontend:
    build: ./frontend
    networks:
      - app-tier

  # --- Application Layer ---
  user-service:
    build: ./services/user
    networks:
      - app-tier
      - data-tier

  order-service:
    build: ./services/order
    networks:
      - app-tier
      - data-tier
      - message-tier

  notification-service:
    build: ./services/notification
    networks:
      - app-tier
      - message-tier

  # --- Messaging Layer ---
  rabbitmq:
    image: rabbitmq:3-management-alpine
    networks:
      - message-tier

  # --- Data Layer ---
  postgres:
    image: postgres:16-alpine
    networks:
      - data-tier

  redis:
    image: redis:7-alpine
    networks:
      - data-tier

networks:
  public:
    driver: bridge
  app-tier:
    driver: bridge
    internal: false
  data-tier:
    driver: bridge
    internal: true   # 外部アクセスを完全遮断
  message-tier:
    driver: bridge
    internal: true
```

### Network Access Matrix

The following summarizes the network access for each service in the above configuration.

| Service | public | app-tier | data-tier | message-tier |
|---------|--------|----------|-----------|-------------|
| nginx | ✅ | ✅ | - | - |
| frontend | - | ✅ | - | - |
| user-service | - | ✅ | ✅ | - |
| order-service | - | ✅ | ✅ | ✅ |
| notification-service | - | ✅ | - | ✅ |
| rabbitmq | - | - | - | ✅ |
| postgres | - | - | ✅ | - |
| redis | - | - | ✅ | - |

### Code Example 7b: Secure Multi-Tenant Configuration

```yaml
# docker-compose.yml - マルチテナント構成
services:
  # 共有リバースプロキシ
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    networks:
      - proxy-net

  # テナントA
  tenant-a-app:
    image: my-app:latest
    environment:
      TENANT_ID: tenant-a
    networks:
      - proxy-net
      - tenant-a-net

  tenant-a-db:
    image: postgres:16-alpine
    networks:
      - tenant-a-net    # テナントA専用ネットワークのみ

  # テナントB
  tenant-b-app:
    image: my-app:latest
    environment:
      TENANT_ID: tenant-b
    networks:
      - proxy-net
      - tenant-b-net

  tenant-b-db:
    image: postgres:16-alpine
    networks:
      - tenant-b-net    # テナントB専用ネットワークのみ

networks:
  proxy-net:
    driver: bridge
  tenant-a-net:
    driver: bridge
    internal: true     # テナントAのDBは外部アクセス不可
  tenant-b-net:
    driver: bridge
    internal: true     # テナントBのDBも外部アクセス不可
```

---

## 9. Network Troubleshooting

### Code Example 8: Collection of Debug Commands

```bash
# ネットワーク一覧を確認
docker network ls

# 特定ネットワークの詳細（接続コンテナ、IPAM設定）
docker network inspect my-app-network

# コンテナのネットワーク設定を確認
docker inspect --format='{{json .NetworkSettings.Networks}}' my-container | jq .

# コンテナのIPアドレスを取得
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' my-container

# コンテナのポートマッピングを確認
docker port my-container

# コンテナ内からネットワーク診断
docker run --rm --network my-app-network nicolaka/netshoot \
  bash -c "
    # DNS解決テスト
    nslookup api-server
    # TCP接続テスト
    nc -zv api-server 8080
    # ルーティング確認
    ip route
    # ネットワークインターフェース確認
    ip addr
    # TCPダンプ（パケットキャプチャ）
    tcpdump -i eth0 -c 20 port 80
  "

# ホスト側からiptablesルールを確認
sudo iptables -t nat -L -n | grep DOCKER

# Docker ネットワーク関連のイベントを監視
docker events --filter type=network

# 使用されていないネットワークの一括削除
docker network prune
```

### Common Network Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Cannot resolve container names | Using default bridge | Switch to user-defined network |
| Port already in use | Port conflict on host side | Check with `docker ps`, stop or change port |
| Cannot communicate from container to outside | DNS configuration issue | Specify external DNS with `dns:` option |
| Slow communication | macOS Bind Mount I/O | Switch to VirtioFS |
| Port forwarding not working | iptables rule issue | Check with `sudo iptables -t nat -L -n` |
| IP conflict on container startup | Overlapping subnets | Specify a custom subnet |

### Detailed Diagnosis with netshoot

```bash
# netshoot コンテナで対象ネットワークに接続して診断
docker run -it --rm --network my-app-network nicolaka/netshoot

# 内部で使えるコマンド:
# ping, traceroute, nslookup, dig
# curl, wget, nc (netcat)
# tcpdump, iperf, mtr
# ip, ss, netstat
# nmap, iftop

# 例: コンテナ間の帯域幅テスト
# サーバー側
docker run -d --name iperf-server --network my-app-network nicolaka/netshoot iperf3 -s
# クライアント側
docker run --rm --network my-app-network nicolaka/netshoot iperf3 -c iperf-server
```

---

## 10. IPv6 Support

```yaml
# docker-compose.yml - IPv6 有効化
services:
  app:
    image: my-app:latest
    networks:
      - dual-stack

networks:
  dual-stack:
    driver: bridge
    enable_ipv6: true
    ipam:
      config:
        - subnet: 172.28.0.0/24    # IPv4
        - subnet: fd00::/64         # IPv6 ULA
```

```bash
# Docker デーモンでIPv6を有効化
# /etc/docker/daemon.json
{
  "ipv6": true,
  "fixed-cidr-v6": "fd00::/80"
}
```

---

## Anti-Patterns

### Anti-Pattern 1: Relying on the Default Bridge Network

```bash
# NG: デフォルトbridgeではDNS解決が機能しない
docker run -d --name app1 my-app
docker run -d --name app2 my-app
docker exec app1 ping app2  # 失敗: 名前解決できない

# OK: ユーザー定義ネットワークを使う
docker network create my-net
docker run -d --name app1 --network my-net my-app
docker run -d --name app2 --network my-net my-app
docker exec app1 ping app2  # 成功
```

**Why it's a problem**: DNS resolution by container name is disabled on the default bridge. Without the deprecated `--link`, you cannot communicate by name and must hardcode IP addresses.

### Anti-Pattern 2: Placing All Containers in the Same Network

```yaml
# NG: 全サービスがフラットに通信可能
services:
  nginx:
    networks: [shared]
  app:
    networks: [shared]
  database:
    networks: [shared]  # フロントエンドからDBに直接到達可能

# OK: 層ごとにネットワークを分離
services:
  nginx:
    networks: [frontend]
  app:
    networks: [frontend, backend]
  database:
    networks: [backend]  # backendからのみアクセス可能
```

**Why it's a problem**: If an attacker compromises a frontend container, they can directly access the DB on the same network. Network isolation is a fundamental security defense.

### Anti-Pattern 3: Exposing Too Many Ports

```bash
# NG: 0.0.0.0 にバインド（全インターフェースに公開）
docker run -d -p 5432:5432 postgres:16

# OK: localhostのみにバインド
docker run -d -p 127.0.0.1:5432:5432 postgres:16
```

**Why it's a problem**: The database port becomes directly accessible from outside, posing an extremely high security risk.

### Anti-Pattern 4: Relying on Hardcoded IP Addresses

```yaml
# NG: IPアドレスをハードコード
services:
  app:
    environment:
      DB_HOST: 172.18.0.5  # IPアドレスは変わる可能性がある

# OK: DNS名（サービス名）を使用
services:
  app:
    environment:
      DB_HOST: database    # Composeのサービス名はDNSで解決される
```

**Why it's a problem**: Container IP addresses can change depending on startup order and network conditions. Using DNS names enables stable communication that is unaffected by IP address changes.


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# 演習1: 基本実装のテンプレート
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Applied Patterns

Extend the basic implementation to add the following features.

```python
# 演習2: 応用パターン
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# 演習3: パフォーマンス最適化
import time
from functools import lru_cache

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured configuration file | Check the path and format of the configuration file |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Verify step by step**: Use log output and debuggers to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# デバッグ用ユーティリティ
import logging
import traceback
from functools import wraps

# ロガーの設定
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """関数の入出力をログ出力するデコレータ"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """データ処理（デバッグ対象）"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues when they arise:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Check the state of disk and network I/O
4. **Check concurrent connections**: Check the state of connection pools

| Problem Type | Diagnostic Tool | Solution |
|-------------|-----------------|----------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Asynchronous I/O, caching |
| DB latency | EXPLAIN, slow query log | Index, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology selections.

| Criterion | When to prioritize | When it can be compromised |
|-----------|-------------------|---------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
┌─────────────────────────────────────────────────┐
│         Architecture Selection Flow              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②              │
│                                                 │
│  ② How often do you deploy?                     │
│    ├─ Once a week or less → Monolith + module split │
│    └─ Daily / multiple times → Go to ③          │
│                                                 │
│  ③ How independent are teams?                   │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster approach in the short term can become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can cause project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging more difficult
- Low abstraction is intuitive but tends to lead to code duplication

```python
# 設計判断の記録テンプレート
class ArchitectureDecisionRecord:
    """ADR (Architecture Decision Record) の作成"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """背景と課題の記述"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """決定内容の記述"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """結果の追加"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """却下した代替案の追加"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Markdown形式で出力"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
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
- Focus on the minimum necessary features
- Automated tests only for the critical path
- Introduce monitoring from an early stage

**Lessons learned:**
- Don't aim for perfection (YAGNI principle)
- Obtain user feedback early
- Manage technical debt intentionally

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually renovating a system that has been in operation for more than 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If existing tests are absent, create Characterization Tests first
- Coexist old and new systems with an API gateway
- Perform data migration incrementally

| Phase | Work Content | Estimated Duration | Risk |
|-------|-------------|-------------------|------|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Assign ownership per team
- Manage shared libraries using Inner Source approach
- Design API-first to minimize inter-team dependencies

```python
# チーム間のAPI契約定義
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
    """チーム間のAPI契約"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # レスポンスタイムSLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """SLA準拠の確認"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """OpenAPI形式で出力"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# 使用例
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

**Situation:** A system where millisecond-level responses are required

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Applicable Situation |
|------------------------|--------|--------------------|--------------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Asynchronous processing | Medium | Medium | Processing with heavy I/O waits |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |

---

## Team Development Practices

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any impact on performance?
- [ ] Are there any security issues?
- [ ] Has documentation been updated?

### Best Practices for Knowledge Sharing

| Method | Frequency | Target | Effect |
|--------|-----------|--------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (design record) | As needed | Future members | Transparency of decisions |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Important designs | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │ Plan│ Act │
    │ ned │ Im- │
    │     │ med │
    ├─────┼─────┤
    │ Doc │ Next│
    │ ume │ Spr-│
    │ nt  │ int │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```
---

## FAQ

### Q1: Why can't I use localhost for communication between containers?

Each container has an independent network namespace, so `localhost` always refers to itself. To communicate with other containers, use the container name (DNS name) or IP address. In Docker Compose, the service name becomes the DNS name directly.

### Q2: How much performance overhead does the overlay network have?

The overhead of VXLAN encapsulation is typically around 5-10%. Enabling `--opt encrypted` adds IPsec encryption, which increases CPU load. For high-throughput requirements, consider host networking or macvlan.

### Q3: When docker-compose up creates a network automatically, what is the name?

It is created in the format `<project directory name>_<network name>`. For example, if the directory is `myapp` and the network name is `backend`, it becomes `myapp_backend`. You can also specify a name explicitly with the `name:` field.

```yaml
networks:
  backend:
    name: my-custom-backend  # 明示的な名前指定
```

### Q4: How do I access the host machine from a container?

On Docker Desktop (macOS/Windows), use the special DNS name `host.docker.internal`. On Linux, specify `--add-host=host.docker.internal:host-gateway`.

```yaml
services:
  app:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      HOST_API: http://host.docker.internal:4000
```

### Q5: How do I restrict communication between networks?

Setting `internal: true` blocks communication from that network to the outside (internet). Restricting communication between networks is controlled by the design of which networks each service joins. Containers belonging to different networks cannot communicate directly.

### Q6: How do I connect to an external network (existing network) in Docker Compose?

By specifying `external: true`, you can connect to a network already created outside the Compose project. This is useful when communication between multiple Compose projects is required.

```yaml
# Project A (creates shared network)
networks:
  shared:
    name: shared-network
    driver: bridge

# Project B (joins existing network)
networks:
  shared:
    external: true
    name: shared-network
```

```bash
# 手動で共有ネットワークを作成
docker network create shared-network

# プロジェクトBからも利用可能
docker compose up -d
```

### Q7: How do I set network priority or default network in Docker Compose?

Compose uses the first defined network in the service as the default routing destination. You can explicitly set priority with the `priority` option.

```yaml
services:
  app:
    networks:
      frontend:
        priority: 1000   # 高い値が優先
      backend:
        priority: 500
      monitoring:
        priority: 100

networks:
  frontend:
  backend:
    internal: true
  monitoring:
    internal: true
```

### Q8: How do I configure network bandwidth limits?

Docker alone has limited native support for network bandwidth limiting, but you can control it with the `tc` (Traffic Control) command or Docker's `--network-bandwidth` option (Docker Swarm mode).

```bash
# tc（Traffic Control）によるコンテナの帯域幅制限
# コンテナのvethインターフェースを特定
CONTAINER_PID=$(docker inspect -f '{{.State.Pid}}' mycontainer)
VETH=$(ip link | grep -A1 "if${CONTAINER_PID}" | head -1 | awk '{print $2}' | tr -d ':')

# 帯域幅を100Mbpsに制限
tc qdisc add dev ${VETH} root tbf rate 100mbit burst 32kbit latency 100ms
```

```yaml
# Docker Swarmモードでのリソース制限
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M
```

### Q9: How do I configure IPv6 networking?

Enable IPv6 in the Docker daemon and assign a fixed subnet.

```json
{
  "ipv6": true,
  "fixed-cidr-v6": "2001:db8:1::/64"
}
```

```yaml
# docker-compose.yml
networks:
  dual-stack:
    enable_ipv6: true
    ipam:
      config:
        - subnet: 172.28.0.0/16
        - subnet: "2001:db8:2::/64"

services:
  app:
    networks:
      dual-stack:
        ipv4_address: 172.28.0.10
        ipv6_address: "2001:db8:2::10"
```

### Q10: What are the networking limitations on Docker Desktop for Mac/Windows?

Docker Desktop runs Docker inside a Linux VM, so there are some limitations.

| Feature | Linux | macOS | Windows |
|---------|-------|-------|---------|
| host network | Full support | Partial (host inside VM) | Partial |
| macvlan | Full support | Not supported | Not supported |
| Direct container IP access from host | Available | Not available (port mapping required) | Not available |
| `host.docker.internal` | Requires setup | Enabled by default | Enabled by default |
| Network performance | Native | VM overhead present | VM overhead present |

On macOS/Windows, use `host.docker.internal` to access the host machine, and use port mapping to access containers from outside.

---

## Summary

| Item | Key Points |
|------|------------|
| bridge | Default driver for single host. User-defined bridge is recommended |
| host | Best performance without port mapping. Full support on Linux only |
| overlay | Multi-host communication. Used with Swarm/Kubernetes |
| macvlan | Direct physical network connection. Used for legacy app integration |
| Port mapping | Expose to host with `-p host:container`. Binding to `127.0.0.1` recommended |
| DNS | Automatic name resolution within user-defined networks. 127.0.0.11 |
| Service discovery | Round-robin DNS with aliases. Simplified with Compose integration |
| Network isolation | Block external access with `internal: true`. Isolating by layer is the golden rule |
| Troubleshooting | Diagnose with the netshoot container. Check with `docker network inspect` |

---

## Guides to Read Next

- [Volumes and Storage](./01-volume-and-storage.md) -- Data persistence and storage drivers
- [Reverse Proxy](./02-reverse-proxy.md) -- HTTP routing with Nginx/Traefik
- [Container Security](../06-security/00-container-security.md) -- Comprehensive security including network isolation

---

## References

1. Docker official documentation "Networking overview" -- https://docs.docker.com/network/
2. Nigel Poulton (2023) *Docker Deep Dive*, Chapter 11: Docker Networking
3. Adrian Mouat (2023) *Using Docker*, Chapter 10: Networking and Service Discovery
4. Docker official documentation "Use bridge networks" -- https://docs.docker.com/network/bridge/
5. Docker official documentation "Use overlay networks" -- https://docs.docker.com/network/overlay/
6. Docker official documentation "Use macvlan networks" -- https://docs.docker.com/network/macvlan/
7. Linux Foundation "Container Networking From Scratch" -- https://www.youtube.com/watch?v=6v_BDHIgOY8
8. Docker official documentation "Networking with standalone containers" -- https://docs.docker.com/network/network-tutorial-standalone/
