# Supply Chain Security

> Learn how to ensure the trustworthiness of the entire software supply chain from build to deployment through container image signing (cosign), and SBOM (Software Bill of Materials) generation and verification.

## What You Will Learn

1. **Image Signing and Verification (cosign / Sigstore)** -- Build a system that attaches digital signatures to container images and verifies they have not been tampered with
2. **SBOM Generation and Usage** -- List all software components, enabling vulnerability tracking and regulatory compliance
3. **Supply Chain Protection in CI/CD Pipelines** -- Implement build provenance recording and policy-based deployment controls
4. **VEX (Vulnerability Exploitability eXchange)** -- Manage vulnerability impact assessments in conjunction with SBOM
5. **Safe Dependency Management** -- Prevent package tampering, defend against typosquatting, and understand the importance of lockfiles


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Container Security](./00-container-security.md)

---

## 1. Overview of Supply Chain Security

```
+------------------------------------------------------------------+
|              ソフトウェアサプライチェーンの脅威と対策                  |
+------------------------------------------------------------------+
|                                                                  |
|  [ソースコード]                                                   |
|    脅威: 依存パッケージの改ざん、typosquatting                     |
|    対策: 依存関係の固定 (lockfile)、npm audit                     |
|       |                                                          |
|  [ビルド]                                                        |
|    脅威: ビルド環境の侵害、不正なビルドステップ                     |
|    対策: 再現可能ビルド、ビルド来歴 (Provenance)                   |
|       |                                                          |
|  [イメージ]                                                      |
|    脅威: イメージの改ざん、レジストリ侵害                          |
|    対策: イメージ署名 (cosign)、SBOM、脆弱性スキャン               |
|       |                                                          |
|  [レジストリ]                                                    |
|    脅威: 不正イメージの push、タグの上書き                         |
|    対策: イミュータブルタグ、署名検証ポリシー                      |
|       |                                                          |
|  [デプロイ]                                                      |
|    脅威: 未署名イメージのデプロイ                                  |
|    対策: Admission Controller (署名検証ゲート)                    |
|                                                                  |
+------------------------------------------------------------------+
```

### 1.1 Major Supply Chain Attack Examples

Supply chain attacks have become increasingly serious in recent years. The following are representative examples and the lessons they teach.

| Incident | Year | Attack Method | Lesson |
|----------|------|---------------|--------|
| SolarWinds | 2020 | Intrusion into the build system | Recording build provenance is critical |
| Codecov | 2021 | Tampering with CI scripts | Integrity verification of executed scripts |
| Log4Shell | 2021 | Vulnerability in a dependent library | SBOM enables immediate impact scoping |
| ua-parser-js | 2021 | Hijacking of an npm package | lockfile + signature verification |
| colors/faker | 2022 | Intentional sabotage by maintainer | Pin dependency versions |
| xz-utils | 2024 | Social engineering against maintainer | Code review + reproducible builds |

---

## 2. Image Signing with cosign

### 2.1 Overview of cosign

```
+------------------------------------------------------------------+
|              cosign 署名フロー                                     |
+------------------------------------------------------------------+
|                                                                  |
|  [ビルド]                                                        |
|    docker build -t ghcr.io/myorg/myapp:1.0.0 .                  |
|    docker push ghcr.io/myorg/myapp:1.0.0                        |
|       |                                                          |
|  [署名] (CI/CD)                                                  |
|    cosign sign ghcr.io/myorg/myapp@sha256:abc123...              |
|       |                                                          |
|       +-- Keyless (推奨): OIDC トークンで一時鍵を生成             |
|       |     GitHub Actions -> Fulcio -> Rekor (透明性ログ)        |
|       |                                                          |
|       +-- Key-pair: 事前生成した鍵ペアで署名                      |
|       |     cosign.key (秘密鍵) / cosign.pub (公開鍵)             |
|       |                                                          |
|  [検証] (デプロイ時)                                              |
|    cosign verify ghcr.io/myorg/myapp@sha256:abc123...            |
|       |                                                          |
|       +-- Keyless: Fulcio の証明書 + Rekor ログで検証             |
|       +-- Key-pair: 公開鍵で検証                                  |
|                                                                  |
+------------------------------------------------------------------+
```

### 2.2 Sigstore Project Components

```
+------------------------------------------------------------------+
|              Sigstore エコシステム                                  |
+------------------------------------------------------------------+
|                                                                  |
|  cosign: イメージ署名・検証ツール                                  |
|    -> CLI でイメージに署名 / 検証 / SBOM 添付                     |
|                                                                  |
|  Fulcio: 証明書発行局 (CA)                                       |
|    -> OIDC トークンを検証し、短命 (10分) の署名証明書を発行        |
|    -> 長期的な秘密鍵の管理が不要になる                             |
|                                                                  |
|  Rekor: 透明性ログ (Transparency Log)                            |
|    -> 全ての署名を不変のログに記録                                 |
|    -> 署名の存在証明と監査が可能                                   |
|    -> Certificate Transparency と同じ概念                         |
|                                                                  |
|  policy-controller: Kubernetes Admission Controller              |
|    -> デプロイ時に署名を自動検証                                   |
|    -> 未署名イメージのデプロイを拒否                               |
|                                                                  |
|  Gitsign: Git コミットの署名                                      |
|    -> Keyless で Git コミットに署名                                |
|    -> GPG 鍵の管理が不要                                          |
|                                                                  |
+------------------------------------------------------------------+
```

### 2.3 Installing cosign and Generating Keys

```bash
# インストール
# macOS
brew install cosign

# Linux
curl -L https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
  -o /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign

# バージョン確認
cosign version

# 鍵ペア生成 (Key-pair 方式)
cosign generate-key-pair
# -> cosign.key (秘密鍵、パスワード保護)
# -> cosign.pub (公開鍵、配布用)

# KMS を使う場合
cosign generate-key-pair --kms awskms:///alias/cosign-key
cosign generate-key-pair --kms gcpkms://projects/myproject/locations/global/keyRings/myring/cryptoKeys/mykey
cosign generate-key-pair --kms azurekms://myvault.vault.azure.net/keys/mykey

# Kubernetes Secret に鍵を保存
cosign generate-key-pair k8s://production/cosign-key
```

### 2.4 Image Signing and Verification

```bash
# イメージのビルドとプッシュ
docker build -t ghcr.io/myorg/myapp:1.0.0 .
docker push ghcr.io/myorg/myapp:1.0.0

# ダイジェストを取得 (タグではなくダイジェストで署名)
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ghcr.io/myorg/myapp:1.0.0)
echo $DIGEST
# -> ghcr.io/myorg/myapp@sha256:abc123...

# Key-pair 方式で署名
cosign sign --key cosign.key $DIGEST

# Keyless 方式で署名 (推奨、CI/CD 向け)
cosign sign --yes $DIGEST

# カスタムアノテーション付きで署名
cosign sign --yes \
  -a "commit=$(git rev-parse HEAD)" \
  -a "build-url=https://github.com/myorg/myapp/actions/runs/12345" \
  -a "build-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  $DIGEST

# 検証 (Key-pair)
cosign verify --key cosign.pub ghcr.io/myorg/myapp:1.0.0

# 検証 (Keyless)
cosign verify \
  --certificate-identity="https://github.com/myorg/myapp/.github/workflows/build.yml@refs/tags/v1.0.0" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp:1.0.0

# 検証 (正規表現でマッチ)
cosign verify \
  --certificate-identity-regexp="https://github.com/myorg/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp:1.0.0

# 署名の詳細表示
cosign tree ghcr.io/myorg/myapp:1.0.0
```

### 2.5 Keyless Signing in GitHub Actions

```yaml
# .github/workflows/build-sign.yml
name: Build and Sign

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write    # Keyless 署名に必要

jobs:
  build-and-sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=sha

      - uses: docker/build-push-action@v5
        id: build
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

      - uses: sigstore/cosign-installer@v3

      # Keyless 署名 (OIDC トークンベース)
      - name: Sign image
        run: |
          cosign sign --yes \
            -a "commit=${{ github.sha }}" \
            -a "ref=${{ github.ref }}" \
            -a "workflow=${{ github.workflow }}" \
            -a "run-id=${{ github.run_id }}" \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # SBOM を生成して添付
      - name: Generate and attach SBOM
        run: |
          # Trivy で SBOM 生成
          trivy image --format spdx-json \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }} \
            > sbom.spdx.json

          # SBOM をイメージに添付
          cosign attach sbom \
            --sbom sbom.spdx.json \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

          # SBOM 自体にも署名
          cosign sign --yes \
            --attachment sbom \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # Attestation の添付 (カスタムメタデータ)
      - name: Attest build
        run: |
          cosign attest --yes \
            --type custom \
            --predicate <(cat <<EOF
          {
            "buildType": "github-actions",
            "builder": {
              "id": "https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            },
            "metadata": {
              "buildStartedOn": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
              "completeness": {
                "parameters": true,
                "environment": true,
                "materials": true
              }
            }
          }
          EOF
          ) \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # 検証ステップ (確認)
      - name: Verify signature
        run: |
          cosign verify \
            --certificate-identity-regexp="https://github.com/${{ github.repository }}/.*" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
```

### 2.6 Signing in GitLab CI

```yaml
# .gitlab-ci.yml
build-and-sign:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: sigstore
  variables:
    IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG
  script:
    - docker build -t $IMAGE .
    - docker push $IMAGE
    - DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $IMAGE)
    # cosign のインストール
    - apk add --no-cache cosign
    # Keyless 署名 (GitLab OIDC トークンを使用)
    - cosign sign --yes $DIGEST
  rules:
    - if: $CI_COMMIT_TAG
```

---

## 3. SBOM (Software Bill of Materials)

### 3.1 What Is an SBOM?

```
+------------------------------------------------------------------+
|              SBOM の構造                                          |
+------------------------------------------------------------------+
|                                                                  |
|  SBOM (myapp:1.0.0)                                             |
|  |                                                               |
|  +-- OS パッケージ                                               |
|  |     +-- alpine-baselayout 3.4.3                               |
|  |     +-- musl 1.2.4                                            |
|  |     +-- openssl 3.1.4 <- CVE-2024-XXXX (修正済み)             |
|  |     +-- ca-certificates 20240226                              |
|  |     +-- libcrypto3 3.1.4                                      |
|  |     +-- libssl3 3.1.4                                         |
|  |     +-- ...                                                   |
|  |                                                               |
|  +-- アプリ依存関係                                               |
|  |     +-- express 4.18.2                                        |
|  |     +-- pg 8.11.3                                             |
|  |     +-- @prisma/client 5.7.1                                  |
|  |     +-- winston 3.11.0                                        |
|  |     +-- helmet 7.1.0                                          |
|  |     +-- ...                                                   |
|  |                                                               |
|  +-- ライセンス情報                                               |
|  |     +-- express: MIT                                          |
|  |     +-- pg: MIT                                               |
|  |     +-- @prisma/client: Apache-2.0                            |
|  |     +-- ...                                                   |
|  |                                                               |
|  +-- メタデータ                                                   |
|       +-- ビルド日時: 2025-01-15T10:30:00Z                       |
|       +-- ビルドツール: docker buildx 0.12.0                     |
|       +-- ソース: github.com/myorg/myapp@abc1234                 |
|       +-- SBOM 生成ツール: trivy 0.50.0                          |
|                                                                  |
+------------------------------------------------------------------+
```

An SBOM is an "ingredient list for software." Just like food labeling lists ingredients, it enumerates all components contained in software (OS packages, libraries, frameworks) along with their versions and license information. When a new vulnerability is disclosed, it allows you to immediately identify affected software.

### 3.2 SBOM Generation Tools

```bash
# Trivy で SBOM 生成 (SPDX 形式)
trivy image --format spdx-json --output sbom-spdx.json myapp:latest

# Trivy で SBOM 生成 (CycloneDX 形式)
trivy image --format cyclonedx --output sbom-cdx.json myapp:latest

# Syft で SBOM 生成 (Anchore 製)
syft myapp:latest -o spdx-json > sbom-syft-spdx.json
syft myapp:latest -o cyclonedx-json > sbom-syft-cdx.json

# Syft で特定のスコープを指定
syft myapp:latest -o spdx-json --scope all-layers > sbom-all-layers.json

# Docker Scout (Docker Desktop 統合)
docker scout sbom myapp:latest
docker scout sbom --format spdx myapp:latest

# BuildKit で SBOM を自動生成
docker buildx build --sbom=true -t myapp:latest .

# ローカルディレクトリから SBOM 生成
syft dir:. -o cyclonedx-json > sbom-source.json
trivy fs --format spdx-json --output sbom-fs.json .
```

### 3.3 Comparing SBOM Formats

| Item | SPDX | CycloneDX | SWID |
|------|------|-----------|------|
| Standards Body | Linux Foundation | OWASP | ISO/IEC |
| Formats | JSON, RDF, Tag-Value | JSON, XML, Protobuf | XML |
| License Information | Very detailed | Basic | Basic |
| Vulnerability Information | External integration | VEX integrated | None |
| Dependency Graph | Supported | Supported | Limited |
| Service Information | Limited | Detailed (API, endpoints) | None |
| Adoption Examples | US Government (EO 14028) | Security tools | Legacy |
| Tool Support | Broad | Broad | Limited |
| Recommended Use Case | License compliance | Security analysis | Asset management |

### 3.4 Vulnerability Scanning from SBOM

```bash
# SBOM を入力として脆弱性スキャン
trivy sbom sbom-spdx.json

# 重大度でフィルタ
trivy sbom --severity CRITICAL,HIGH sbom-spdx.json

# JSON 出力
trivy sbom --format json --output vuln-results.json sbom-spdx.json

# grype で SBOM スキャン
grype sbom:sbom-cdx.json

# grype で重大度フィルタ
grype sbom:sbom-cdx.json --fail-on critical

# ライセンスコンプライアンスチェック
trivy sbom --scanners license sbom-spdx.json

# 特定のライセンスを検出
trivy sbom --scanners license --severity HIGH sbom-spdx.json
```

### 3.5 Continuous SBOM Management

```yaml
# .github/workflows/sbom-management.yml
name: SBOM Management

on:
  push:
    branches: [main]
  schedule:
    # 毎日再スキャン (新しい CVE の検出)
    - cron: '0 6 * * *'

jobs:
  generate-sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate SBOM
        run: |
          # SPDX 形式
          trivy image --format spdx-json \
            --output sbom-spdx.json \
            ghcr.io/${{ github.repository }}:latest

          # CycloneDX 形式
          trivy image --format cyclonedx \
            --output sbom-cdx.json \
            ghcr.io/${{ github.repository }}:latest

      - name: Scan SBOM for vulnerabilities
        run: |
          trivy sbom --severity CRITICAL,HIGH \
            --exit-code 1 \
            sbom-spdx.json

      - name: Check licenses
        run: |
          trivy sbom --scanners license \
            --severity HIGH \
            sbom-spdx.json

      - name: Upload SBOM as artifact
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: |
            sbom-spdx.json
            sbom-cdx.json
          retention-days: 90

      - name: Attach SBOM to release
        if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')
        run: |
          gh release upload ${{ github.ref_name }} \
            sbom-spdx.json \
            sbom-cdx.json
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 4. VEX (Vulnerability Exploitability eXchange)

### 4.1 What Is VEX?

VEX is a mechanism for expressing "this vulnerability does not affect our environment" in a machine-readable format. Even when a large number of CVEs are detected through vulnerability scanning of an SBOM, not all of them are necessarily exploitable. VEX allows security teams to record and share their assessments.

```
+------------------------------------------------------------------+
|              VEX のステータス                                      |
+------------------------------------------------------------------+
|                                                                  |
|  Not Affected (not affected):                                    |
|    -> The vulnerable code path is unreachable                    |
|    -> The vulnerable feature is not used                         |
|    Example: OpenSSL has a DTLS vulnerability, but DTLS is not used|
|                                                                  |
|  Affected (affected):                                            |
|    -> The product is affected by the vulnerability               |
|    -> Remediation action is required                             |
|                                                                  |
|  Fixed (fixed):                                                  |
|    -> Updated to a version containing the fix                    |
|                                                                  |
|  Under Investigation (under investigation):                      |
|    -> Currently investigating whether there is an impact         |
|                                                                  |
+------------------------------------------------------------------+
```

### 4.2 Creating a VEX Document

```json
{
  "@context": "https://openvex.dev/ns/v0.2.0",
  "@id": "https://myorg.example.com/vex/2025-01-15",
  "author": "security-team@example.com",
  "timestamp": "2025-01-15T10:00:00Z",
  "statements": [
    {
      "vulnerability": {
        "@id": "https://nvd.nist.gov/vuln/detail/CVE-2024-12345",
        "name": "CVE-2024-12345",
        "description": "OpenSSL DTLS vulnerability"
      },
      "products": [
        {
          "@id": "pkg:oci/myapp@sha256:abc123",
          "subcomponents": [
            {"@id": "pkg:apk/alpine/openssl@3.1.4"}
          ]
        }
      ],
      "status": "not_affected",
      "justification": "vulnerable_code_not_in_execute_path",
      "impact_statement": "This application does not use DTLS. The vulnerable code path is never executed."
    },
    {
      "vulnerability": {
        "@id": "https://nvd.nist.gov/vuln/detail/CVE-2024-67890",
        "name": "CVE-2024-67890"
      },
      "products": [
        {"@id": "pkg:oci/myapp@sha256:abc123"}
      ],
      "status": "affected",
      "action_statement": "Update to express@4.19.0 which contains the fix.",
      "action_statement_timestamp": "2025-01-20T00:00:00Z"
    }
  ]
}
```

### 4.3 Integrating VEX with Trivy

```bash
# VEX ファイルを使ったスキャン
trivy image --vex vex.json myapp:latest

# VEX で "not_affected" とされた CVE はスキャン結果から除外される
# -> ノイズが減り、本当に対応すべき脆弱性に集中できる
```

---

## 5. Build Provenance

### 5.1 SLSA (Supply chain Levels for Software Artifacts)

```
+------------------------------------------------------------------+
|              SLSA レベル                                          |
+------------------------------------------------------------------+
|                                                                  |
|  Level 0: None                                                   |
|    -> No measures taken                                          |
|                                                                  |
|  Level 1: Provenance exists                                      |
|    -> A record of the build process exists                       |
|    -> Manual builds are acceptable                               |
|    -> Minimum requirement: build scripts are version-controlled  |
|                                                                  |
|  Level 2: Hosted build                                           |
|    -> Built on a CI/CD service                                   |
|    -> Provenance is automatically generated                      |
|    -> Requirement: build runs on a CI/CD platform               |
|                                                                  |
|  Level 3: Hardened build                                         |
|    -> Build environment is tamper-resistant                      |
|    -> Provenance is cryptographically signed                     |
|    -> Parameter injection between build jobs is prevented        |
|    -> GitHub Actions + SLSA Generator supports this              |
|                                                                  |
|  Level 4 (future): Complete provenance                           |
|    -> Two-party review                                           |
|    -> Hermetic build (network isolation)                         |
|    -> Reproducible builds                                        |
|                                                                  |
+------------------------------------------------------------------+
```

### 5.2 Generating Provenance in GitHub Actions

```yaml
# .github/workflows/slsa-build.yml
name: SLSA Build

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  packages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # BuildKit の Provenance 生成を有効化
      - uses: docker/build-push-action@v5
        id: build
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          provenance: true     # SLSA Provenance を自動生成
          sbom: true           # SBOM を自動生成

      - uses: sigstore/cosign-installer@v3

      - name: Sign with cosign
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}

      # Provenance の検証
      - name: Verify provenance
        run: |
          cosign verify-attestation \
            --type slsaprovenance \
            --certificate-identity-regexp="https://github.com/${{ github.repository }}/" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
```

### 5.3 Using SLSA Generator

```yaml
# .github/workflows/slsa-generator.yml
name: SLSA Level 3 Build

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.build.outputs.image }}
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: build
        run: |
          IMAGE=ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          docker build -t $IMAGE .
          docker push $IMAGE
          DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $IMAGE | cut -d@ -f2)
          echo "image=$IMAGE" >> $GITHUB_OUTPUT
          echo "digest=$DIGEST" >> $GITHUB_OUTPUT

  # SLSA Generator で Level 3 の Provenance を生成
  provenance:
    needs: build
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v2.0.0
    with:
      image: ${{ needs.build.outputs.image }}
      digest: ${{ needs.build.outputs.digest }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

### 5.4 Build Step Attestation with in-toto

```bash
# in-toto: 各ビルドステップの証明を生成
# Step 1: ソースコードのチェックアウト
in-toto-run --step-name checkout \
  --products src/ \
  --signing-key developer.key \
  -- git clone https://github.com/myorg/myapp.git src/

# Step 2: テスト
in-toto-run --step-name test \
  --materials src/ \
  --signing-key ci.key \
  -- cd src && npm test

# Step 3: ビルド
in-toto-run --step-name build \
  --materials src/ \
  --products dist/ \
  --signing-key ci.key \
  -- cd src && npm run build

# レイアウト (ポリシー) の検証
in-toto-verify --layout root.layout \
  --layout-key owner.pub \
  --verification-keys developer.pub ci.pub
```

---

## 6. Safe Dependency Management

### 6.1 Pinning Dependencies with Lockfiles

```bash
# npm: package-lock.json
npm ci  # lockfile に厳密に従ってインストール (npm install は使わない)

# pnpm: pnpm-lock.yaml
pnpm install --frozen-lockfile

# yarn: yarn.lock
yarn install --frozen-lockfile

# pip: requirements.txt (ハッシュ付き)
pip install --require-hashes -r requirements.txt

# Go: go.sum
go mod verify
```

```text
# requirements.txt (ハッシュ付き - 改ざん検出)
flask==3.0.0 \
    --hash=sha256:21128f47e4e3b9d29ce5c59c0ab98341a9f8e8da8e1da9ffa6b8651d2d8f3a5c
requests==2.31.0 \
    --hash=sha256:58cd2187c01e70e6e26505bca751777aa9f2ee0b7f4300988b709f44e013003eb
```

### 6.2 Auditing Dependencies

```bash
# npm audit (脆弱性チェック)
npm audit
npm audit --audit-level=high
npm audit fix  # 自動修正

# pip-audit (Python)
pip install pip-audit
pip-audit -r requirements.txt

# cargo audit (Rust)
cargo install cargo-audit
cargo audit

# Trivy でファイルシステムスキャン
trivy fs --scanners vuln .

# Renovate / Dependabot で自動更新 PR
```

### 6.3 Automated Updates with Renovate

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "security:openssf-scorecard"
  ],
  "labels": ["dependencies"],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"]
  },
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "pr",
      "requiredStatusChecks": ["ci"]
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "reviewers": ["team:platform"]
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "automerge": true,
      "schedule": ["before 9am on monday"]
    }
  ],
  "docker": {
    "pinDigests": true
  },
  "helm-values": {
    "fileMatch": ["values.*\\.yaml$"]
  }
}
```

### 6.4 Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    reviewers:
      - "myorg/platform-team"
    labels:
      - "dependencies"
    open-pull-requests-limit: 10
    groups:
      production-dependencies:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
          - "eslint*"
          - "*jest*"
      dev-dependencies:
        patterns:
          - "@types/*"
          - "eslint*"
          - "*jest*"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## 7. Policy Enforcement at Deploy Time

### 7.1 Kubernetes Admission Controller

```yaml
# Kyverno ポリシー: 署名済みイメージのみ許可
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
      verifyImages:
        - imageReferences:
            - "ghcr.io/myorg/*"
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/myorg/*"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev
```

### 7.2 Sigstore policy-controller

```bash
# policy-controller のインストール
helm repo add sigstore https://sigstore.github.io/helm-charts
helm install policy-controller sigstore/policy-controller \
  -n cosign-system --create-namespace
```

```yaml
# ClusterImagePolicy: 署名検証ポリシー
apiVersion: policy.sigstore.dev/v1alpha1
kind: ClusterImagePolicy
metadata:
  name: require-signed-images
spec:
  images:
    - glob: "ghcr.io/myorg/**"
  authorities:
    - keyless:
        identities:
          - issuer: "https://token.actions.githubusercontent.com"
            subject: "https://github.com/myorg/*/.github/workflows/*"
        ctlog:
          url: "https://rekor.sigstore.dev"

---
# Namespace に適用
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    policy.sigstore.dev/include: "true"
```

### 7.3 OPA/Gatekeeper Policy

```yaml
# ConstraintTemplate: 信頼済みレジストリのみ許可
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8strustedregistries
spec:
  crd:
    spec:
      names:
        kind: K8sTrustedRegistries
      validation:
        openAPIV3Schema:
          type: object
          properties:
            registries:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package trustedregistries
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not trusted(container.image)
          msg := sprintf("Image '%v' is not from a trusted registry", [container.image])
        }
        violation[{"msg": msg}] {
          container := input.review.object.spec.initContainers[_]
          not trusted(container.image)
          msg := sprintf("Init container image '%v' is not from a trusted registry", [container.image])
        }
        trusted(image) {
          registry := input.parameters.registries[_]
          startswith(image, registry)
        }

---
# Constraint: 適用
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sTrustedRegistries
metadata:
  name: require-trusted-registry
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production", "staging"]
  parameters:
    registries:
      - "ghcr.io/myorg/"
      - "gcr.io/myproject/"
```

### 7.4 Digest Pinning Policy

```yaml
# Kyverno ポリシー: タグではなくダイジェストでの参照を強制
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-image-digest
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-digest
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - production
      validate:
        message: "Images must be referenced by digest (@sha256:...), not by tag."
        pattern:
          spec:
            containers:
              - image: "*@sha256:*"
```

---

## 8. Supply Chain Security Tools Reference

```
+------------------------------------------------------------------+
|              サプライチェーンセキュリティツール                       |
+------------------------------------------------------------------+
|                                                                  |
|  Category           | Tool           | Purpose                  |
|  -------------------|----------------|--------------------------|
|  Image Signing      | cosign         | Sign & verify            |
|                     | Notation       | OCI signing (MS/AWS)     |
|  SBOM Generation    | Trivy          | Scan + SBOM              |
|                     | Syft           | Dedicated SBOM gen       |
|                     | docker sbom    | Docker Desktop integration|
|  Vulnerability Scan | Trivy          | Comprehensive scan       |
|                     | Grype          | SBOM-based scan          |
|                     | Snyk           | Developer-oriented scan  |
|  VEX                | OpenVEX        | Vulnerability impact     |
|                     | CycloneDX VEX  | CycloneDX integration    |
|  Provenance         | SLSA Generator | Build provenance proof   |
|                     | in-toto        | Build step attestation   |
|  Transparency Log   | Rekor          | Public signature log     |
|                     | Fulcio         | Short-lived cert issuer  |
|  Policy Enforcement | Kyverno        | K8s policy (sig verify)  |
|                     | OPA/Gatekeeper | K8s policy (general)     |
|                     | policy-controller | Sigstore policy      |
|  Secret Detection   | gitleaks       | Git history secret scan  |
|                     | TruffleHog     | High-precision secret det|
|  Dependency Mgmt    | Renovate       | Auto update PRs          |
|                     | Dependabot     | GitHub integrated update |
|  Dockerfile Lint    | hadolint       | Dockerfile quality check |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 9. Registry Security Configuration

### 9.1 Enabling Immutable Tags

```bash
# ECR: イミュータブルタグの有効化
aws ecr put-image-tag-mutability \
  --repository-name myapp \
  --image-tag-mutability IMMUTABLE

# GHCR: タグの上書き防止 (組織設定)
# GitHub Organization Settings -> Packages -> Default repository permissions
# "Prevent forked repositories from creating packages" を有効化
```

### 9.2 Enabling Vulnerability Scanning

```bash
# ECR: スキャン設定
aws ecr put-image-scanning-configuration \
  --repository-name myapp \
  --image-scanning-configuration scanOnPush=true

# GCR: Container Analysis の有効化
gcloud services enable containeranalysis.googleapis.com
gcloud services enable containerscanning.googleapis.com
```

### 9.3 Registry Access Control

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPushFromCI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/github-actions-role"
      },
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ]
    },
    {
      "Sid": "AllowPullFromEKS",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/eks-node-role"
      },
      "Action": [
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ]
    },
    {
      "Sid": "DenyDeleteImages",
      "Effect": "Deny",
      "Principal": "*",
      "Action": [
        "ecr:BatchDeleteImage",
        "ecr:DeleteRepository"
      ],
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": "arn:aws:iam::123456789012:role/admin-role"
        }
      }
    }
  ]
}
```

---

## Anti-Patterns

### Anti-Pattern 1: Referencing Images by Tag

```yaml
# NG: タグは上書き可能。改ざんリスクがある
containers:
  - name: app
    image: ghcr.io/myorg/myapp:latest
    # "latest" タグが別のイメージに差し替えられる可能性

# NG: セマンティックバージョンタグでも同じ問題
containers:
  - name: app
    image: ghcr.io/myorg/myapp:1.0.0
    # タグは再割り当て可能

# OK: ダイジェスト (SHA256) で参照
containers:
  - name: app
    image: ghcr.io/myorg/myapp@sha256:a1b2c3d4e5f6...
    # ダイジェストはイメージの内容に対する一意なハッシュ
    # 改ざんされていれば検証で失敗する
```

**Problem**: Tags (such as `latest` or `v1.0.0`) can be reassigned to any image in the registry. If an attacker gains access to the registry, they can point the tag at a malicious image. A digest reference directly specifies the content of the image (SHA256 hash), making tampering impossible.

### Anti-Pattern 2: Generating an SBOM but Never Using It

```bash
# NG: SBOM を生成して放置
trivy image --format spdx-json -o sbom.json myapp:latest
# -> ファイルが生成されるだけで誰も見ない

# OK: SBOM を継続的に活用するパイプライン
# 1. SBOM 生成 + イメージに添付
trivy image --format spdx-json -o sbom.json myapp:latest
cosign attach sbom --sbom sbom.json ghcr.io/myorg/myapp@sha256:xxx

# 2. 定期的な脆弱性再スキャン (新しい CVE の検出)
trivy sbom sbom.json  # 新しい脆弱性DBで再スキャン

# 3. ライセンスコンプライアンスチェック
trivy sbom --scanners license sbom.json

# 4. 依存関係の棚卸し (EOL パッケージの検出)

# 5. VEX で影響度を判断・記録
```

**Problem**: The purpose of an SBOM is not "generating it" but "continuously tracking vulnerabilities." Use it as a database for identifying affected images when new CVEs are disclosed.

### Anti-Pattern 3: Not Committing Lockfiles to Git

```bash
# NG: lockfile が .gitignore に含まれている
# .gitignore
package-lock.json
pnpm-lock.yaml
yarn.lock

# OK: lockfile は必ず Git にコミット
# lockfile により、全ての開発者と CI/CD で同じ依存関係が再現される
# lockfile なしでは、ビルドごとに異なるバージョンがインストールされるリスクがある
```

**Problem**: Without a lockfile, the version of dependencies can change with each `npm install`. If an attacker injects malicious code into a new version of a package, that version will be installed automatically without a lockfile. Use `npm ci` (which installs strictly according to the lockfile) in CI/CD, and always version-control lockfiles.

### Anti-Pattern 4: Enabling Signature Verification Only in Production

```yaml
# NG: 本番環境でのみ署名検証
# -> ステージングで動作確認 -> 本番で署名検証に失敗 -> デプロイできない

# OK: ステージングから署名検証を適用
# ステージング: Audit モード (検証失敗をログに記録するが拒否しない)
# 本番: Enforce モード (検証失敗時にデプロイを拒否)
```

**Problem**: If signature verification is only enabled in production, a situation can arise where something works in staging but is rejected in production. Enable signature verification in staging environments as well to catch problems early.

---

## FAQ

### Q1: How does cosign Keyless signing work?

**A**: Keyless signing eliminates the need to manage long-lived private keys. The mechanism works as follows: (1) the CI/CD platform (e.g., GitHub Actions) issues an OIDC token, (2) Fulcio (Sigstore's CA) verifies the token and issues a short-lived signing certificate (valid for 10 minutes), (3) the signature is made with that certificate, and (4) the signature and certificate are recorded in Rekor (the transparency log). Verification checks the Rekor log and the OIDC issuer/subject. This approach eliminates key management overhead and is ideal for CI/CD environments.

### Q2: Should I choose SPDX or CycloneDX for SBOM format?

**A**: Use SPDX if US government compliance or regulatory requirements (EO 14028) are needed. Use CycloneDX if security analysis is the primary goal. In practice, most tools (Trivy, Grype, Syft) support both formats, so choose based on compatibility with your toolchain. CycloneDX has superior integration with VEX (Vulnerability Exploitability eXchange), enabling you to embed "this vulnerability has no impact in our environment" assessments directly into the SBOM.

### Q3: How should I phase in supply chain security incrementally?

**A**: Recommended phased approach: (1) Add Trivy image scanning to CI/CD first (can be done in 1 day), (2) Add SBOM generation to CI/CD and save it as an artifact (half a day), (3) Introduce cosign Keyless signing (1 day), (4) Migrate to digest references (1-2 days), (5) Introduce Admission Controller (Kyverno) with signature verification in the staging environment (1-2 days), (6) Roll out to production. Avoid trying to introduce everything at once; confirm the effect at each stage before proceeding.

### Q4: Digest references make versions hard to read. How should I manage them?

**A**: (1) Use Kyverno's `mutate` rules to automatically convert tags to digests. (2) Use Flux CD or Argo CD's image automation feature to automatically update digest references when new images are pushed. (3) Leave tag information in comments (e.g., a `# v1.2.0` annotation). (4) Delegate digest pinning and automatic updates to Renovate or Dependabot. Automation by tooling is essential in practice.

### Q5: What is the difference between Notation (ORAS/OCI signing) and cosign?

**A**: cosign is part of the Sigstore project and its biggest feature is Keyless signing (OIDC-based). Notation is an OCI signing specification promoted by Microsoft and AWS, and is highly compatible with existing PKI infrastructure (X.509 certificates). cosign excels at automated signing in CI/CD environments, while Notation excels at integrating with enterprise existing certificate infrastructure. The cosign ecosystem is currently more mature, but Notation is also maturing.

### Q6: What is OpenSSF Scorecard?

**A**: OpenSSF Scorecard is a tool that automatically evaluates the security practices of OSS projects. It assesses CI/CD security, branch protection, code review, dependency management, and more on a scale of 0-10. It can be run with `scorecard --repo=github.com/myorg/myapp` and can also be integrated into GitHub Actions. It is useful for objectively understanding your project's security maturity and identifying areas for improvement.

---

## Summary

| Item | Key Points |
|------|------------|
| cosign | Image signing tool from the Sigstore project. Keyless is recommended |
| Keyless signing | Achieves key-management-free signing via OIDC + Fulcio + Rekor |
| SBOM | Records software composition in SPDX / CycloneDX format |
| VEX | Expresses and shares vulnerability impact assessments in a machine-readable format |
| Trivy + Syft | Primary tools for SBOM generation and vulnerability scanning |
| Provenance | Records and verifies build provenance with the SLSA framework |
| Digest reference | Reference images by SHA256 digest instead of tag |
| Admission Controller | Allow only signed images to deploy via Kyverno / OPA / policy-controller |
| lockfile | Pins dependencies to enable reproducible builds |
| Dependency management | Automated updates + vulnerability alerts via Renovate / Dependabot |
| Phased adoption | Introduce in order: scan -> SBOM -> signing -> policy enforcement |

## What to Read Next

- [Container Security](./00-container-security.md) -- Image scanning, least privilege, Dockerfile security
- [Kubernetes Advanced](../05-orchestration/02-kubernetes-advanced.md) -- Production operations with Helm / Ingress / ConfigMap
- Docker Compose Security -- Security awareness in development environments

## References

1. **Sigstore Official** -- https://www.sigstore.dev/ -- Overview of the Sigstore project including cosign, Fulcio, and Rekor
2. **SLSA Framework** -- https://slsa.dev/ -- Supply chain Levels for Software Artifacts specifications and implementation guide
3. **SPDX Specification** -- https://spdx.dev/ -- SPDX format specification for SBOM
4. **CycloneDX** -- https://cyclonedx.org/ -- OWASP-led SBOM format and VEX integration
5. **Kyverno Official** -- https://kyverno.io/ -- Image signature verification with Kubernetes policy engine
6. **NIST SSDF (SP 800-218)** -- https://csrc.nist.gov/Projects/ssdf -- Secure Software Development Framework
7. **OpenVEX** -- https://openvex.dev/ -- VEX specification and implementation guide
8. **OpenSSF Scorecard** -- https://scorecard.dev/ -- Security evaluation tool for OSS projects
