# Key Management

> A comprehensive guide to operating cryptographic keys correctly — covering key lifecycle management, secure key storage with HSM/KMS, and the mechanics of envelope encryption

## What You Will Learn

1. **Key Lifecycle** — Management requirements at each stage of a cryptographic key, from generation to destruction
2. **HSM vs. KMS** — Characteristics of Hardware Security Modules and cloud key management services
3. **Envelope Encryption** — Multi-layer encryption patterns using a Data Encryption Key (DEK) and a Key Encryption Key (KEK)
4. **Key Rotation and Operations** — Automated rotation strategies and emergency response procedures

## Prerequisites

- Cryptography fundamentals (difference between symmetric and public-key cryptography)
- Basic concepts of AES, RSA, and ECDSA
- Basics of cloud services (AWS/GCP/Azure)
- Basic Python programming knowledge

---

## 1. Key Lifecycle

### Overview of Key Management

Managing cryptographic keys is the most critical factor determining the overall security of a cryptographic system. NIST SP 800-57 rigorously defines the key lifecycle, and failing to apply proper management at each stage renders encryption meaningless. Historically, incidents caused by poor key management far outnumber those caused by vulnerabilities in the cryptographic algorithms themselves.

### Key State Transitions

```
  +----------+     +----------+     +----------+
  |  生成     | --> |  有効化   | --> |  運用中   |
  | Generate |     | Activate |     |  Active  |
  +----------+     +----------+     +----------+
                                         |
                        +----------------+----------------+
                        |                                 |
                        v                                 v
                  +----------+                      +----------+
                  | 一時停止  |                      |  期限切れ |
                  | Suspend  |                      | Expired  |
                  +----------+                      +----------+
                        |                                 |
                        v                                 v
                  +----------+                      +----------+
                  | 無効化   |                       |  アーカイブ|
                  | Deactivate|                     | Archive  |
                  +----------+                      +----------+
                        |                                 |
                        +----------------+----------------+
                                         |
                                         v
                                   +----------+
                                   |  廃棄     |
                                   | Destroy  |
                                   +----------+
```

### Key Lifecycle Stages (Detail)

| Stage | Description | Permitted Operations | Typical Duration | Security Requirements |
|-------|-------------|---------------------|------------------|-----------------------|
| Generation | Generate a key using a cryptographically secure random number | None (generation only) | Immediate | CSPRNG required, recommended inside HSM |
| Activation | Register the key in the system and make it usable | Encryption, signing | Immediate | Configure access controls |
| Active | Period during which the key is used for encryption and signing | Encrypt, decrypt, sign, verify | 1–2 years (symmetric) | Usage log auditing |
| Suspended | Temporarily suspended for investigation, etc. | None | Days to weeks | Document the reason |
| Deactivated | Cannot be used for encryption; decryption only | Decrypt and verify only | Several years | Prohibit encryption operations |
| Archived | Retained solely for decrypting past data | Decrypt only (requires approval) | Depends on regulations | Strict access control |
| Destroyed | Securely deleted (cryptographic erasure) | None (irreversible) | Irreversible | Ensure all copies are erased |

### Cryptoperiod Guidelines

```
鍵の種類                 暗号化期間    復号/検証期間    合計
+-----------------------------------------------------------+
| 対称暗号 (AES)         | 1-2年      | +3年          | 5年  |
| 非対称 (RSA署名)       | 1-3年      | +7年          | 10年 |
| 非対称 (ECDSA署名)     | 1-3年      | +7年          | 10年 |
| TLS サーバ証明書       | 1年        | -             | 1年  |
| ルート CA 証明書        | 10-20年    | +10年         | 30年 |
| 中間 CA 証明書         | 3-5年      | +5年          | 10年 |
| SSH ホスト鍵           | 1-2年      | -             | 2年  |
| API 署名鍵             | 90日-1年   | +1年          | 2年  |
+-----------------------------------------------------------+

出典: NIST SP 800-57 Part 1 Rev.5 Table 1
```

### Implementing Key Lifecycle Management

```python
import os
import json
import hashlib
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

class KeyState(Enum):
    """NIST SP 800-57 に基づく鍵の状態"""
    PRE_ACTIVATION = "pre-activation"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"
    COMPROMISED = "compromised"
    DESTROYED = "destroyed"

@dataclass
class ManagedKey:
    """鍵ライフサイクルを管理するクラス"""
    key_id: str
    algorithm: str
    key_size: int
    state: KeyState = KeyState.PRE_ACTIVATION
    created_at: datetime = field(default_factory=datetime.utcnow)
    activated_at: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    deactivated_at: Optional[datetime] = None
    destroyed_at: Optional[datetime] = None
    usage_count: int = 0
    max_usage_count: int = 1_000_000
    metadata: dict = field(default_factory=dict)

    def activate(self, cryptoperiod_days: int = 365):
        """鍵を有効化する"""
        if self.state != KeyState.PRE_ACTIVATION:
            raise ValueError(f"Cannot activate key in state: {self.state}")
        self.state = KeyState.ACTIVE
        self.activated_at = datetime.utcnow()
        self.expiry_date = self.activated_at + timedelta(days=cryptoperiod_days)

    def use(self) -> bool:
        """鍵を使用する (使用可否を返す)"""
        if self.state != KeyState.ACTIVE:
            return False
        if self.expiry_date and datetime.utcnow() > self.expiry_date:
            self.state = KeyState.DEACTIVATED
            self.deactivated_at = datetime.utcnow()
            return False
        if self.usage_count >= self.max_usage_count:
            self.state = KeyState.DEACTIVATED
            self.deactivated_at = datetime.utcnow()
            return False
        self.usage_count += 1
        return True

    def suspend(self, reason: str):
        """鍵を一時停止する"""
        if self.state != KeyState.ACTIVE:
            raise ValueError(f"Cannot suspend key in state: {self.state}")
        self.state = KeyState.SUSPENDED
        self.metadata["suspend_reason"] = reason
        self.metadata["suspended_at"] = datetime.utcnow().isoformat()

    def compromise(self, reason: str):
        """鍵の危殆化を記録する"""
        self.state = KeyState.COMPROMISED
        self.metadata["compromise_reason"] = reason
        self.metadata["compromised_at"] = datetime.utcnow().isoformat()
        # 即座に鍵ローテーションを開始すべき

    def destroy(self):
        """鍵を安全に廃棄する"""
        if self.state in (KeyState.ACTIVE, KeyState.PRE_ACTIVATION):
            raise ValueError("Cannot destroy active or pre-activation key directly")
        self.state = KeyState.DESTROYED
        self.destroyed_at = datetime.utcnow()

    def is_expired(self) -> bool:
        """鍵が期限切れか確認"""
        if self.expiry_date is None:
            return False
        return datetime.utcnow() > self.expiry_date

    def days_until_expiry(self) -> Optional[int]:
        """有効期限までの日数"""
        if self.expiry_date is None:
            return None
        delta = self.expiry_date - datetime.utcnow()
        return max(0, delta.days)


class KeyManager:
    """鍵ライフサイクル全体を管理するマネージャ"""

    def __init__(self):
        self.keys: dict[str, ManagedKey] = {}
        self.audit_log: list[dict] = []

    def generate_key(self, algorithm: str, key_size: int,
                     metadata: dict = None) -> ManagedKey:
        """新しい鍵を生成"""
        key_id = hashlib.sha256(os.urandom(32)).hexdigest()[:16]
        key = ManagedKey(
            key_id=key_id,
            algorithm=algorithm,
            key_size=key_size,
            metadata=metadata or {},
        )
        self.keys[key_id] = key
        self._audit("generate", key_id, f"Generated {algorithm}-{key_size} key")
        return key

    def rotate_key(self, old_key_id: str, cryptoperiod_days: int = 365) -> ManagedKey:
        """鍵をローテーション (旧鍵は復号のみ、新鍵を生成)"""
        old_key = self.keys.get(old_key_id)
        if not old_key:
            raise KeyError(f"Key {old_key_id} not found")

        # 旧鍵を無効化 (復号のみ可)
        if old_key.state == KeyState.ACTIVE:
            old_key.state = KeyState.DEACTIVATED
            old_key.deactivated_at = datetime.utcnow()
            self._audit("deactivate", old_key_id, "Deactivated for rotation")

        # 新鍵を生成・有効化
        new_key = self.generate_key(
            algorithm=old_key.algorithm,
            key_size=old_key.key_size,
            metadata={"rotated_from": old_key_id},
        )
        new_key.activate(cryptoperiod_days)
        self._audit("rotate", new_key.key_id,
                     f"Rotated from {old_key_id}")
        return new_key

    def get_expiring_keys(self, days: int = 30) -> list[ManagedKey]:
        """指定日数以内に期限切れになる鍵を取得"""
        expiring = []
        for key in self.keys.values():
            remaining = key.days_until_expiry()
            if remaining is not None and 0 < remaining <= days:
                expiring.append(key)
        return expiring

    def _audit(self, action: str, key_id: str, detail: str):
        """監査ログを記録"""
        self.audit_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "key_id": key_id,
            "detail": detail,
        })
```

---

## 2. Key Types and Uses

### Key Hierarchy

```
+-------------------------------------------------------+
|              鍵の階層構造 (Key Hierarchy)                |
|-------------------------------------------------------|
|                                                       |
|  Level 0: Root of Trust                               |
|  +-- Master Key (マスター鍵)                           |
|  |   HSM 内に格納、エクスポート不可                     |
|  |   FIPS 140-2/3 Level 3 で保護                      |
|  |   ライフサイクル: 10-20年                            |
|  |                                                    |
|  Level 1: Key Encryption Keys                         |
|  +-- KEK (Key Encryption Key / ラッピング鍵)          |
|  |   マスター鍵で暗号化して保管                         |
|  |   データ鍵の保護に使用                               |
|  |   ライフサイクル: 1-3年                              |
|  |                                                    |
|  Level 2: Data Keys                                   |
|  +-- DEK (Data Encryption Key / データ鍵)             |
|      KEK で暗号化して保管                              |
|      実際のデータを暗号化                              |
|      ライフサイクル: 数時間-1年                         |
|      (用途に応じて異なる)                               |
+-------------------------------------------------------+

Principle of Separation:
  - Keys at each level are stored in separate storage
  - Higher-level keys protect lower-level keys
  - The master key never leaves the HSM
  - When a key is compromised, the blast radius is limited
```

### Key Types and Recommended Parameters

| Use Case | Algorithm | Key Length | Security Strength | Recommendation |
|----------|-----------|------------|-------------------|----------------|
| Data encryption | AES-256-GCM | 256 bit | 256 bit | Recommended |
| Data encryption | AES-128-GCM | 128 bit | 128 bit | Acceptable |
| Data encryption | ChaCha20-Poly1305 | 256 bit | 256 bit | Recommended |
| Digital signature | RSA | 4096 bit | ~140 bit | Recommended |
| Digital signature | ECDSA P-256 | 256 bit | 128 bit | Recommended |
| Digital signature | Ed25519 | 256 bit | ~128 bit | Strongly recommended |
| Key exchange | X25519 | 256 bit | ~128 bit | Strongly recommended |
| Key exchange | ECDH P-384 | 384 bit | 192 bit | Recommended |
| Password hashing | Argon2id | - | - | Strongly recommended |
| Password hashing | bcrypt | - | - | Acceptable |
| Password hashing | SHA-256 | - | - | Not recommended (standalone use) |
| Key derivation | HKDF-SHA256 | - | 128 bit | Recommended |

### Key Generation (Python)

```python
import os
import hashlib
from cryptography.hazmat.primitives.asymmetric import ec, rsa, ed25519, x25519
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.hashes import SHA256

# =============================================
# 1. 対称鍵の生成
# =============================================

# AES-256 用の 256 ビット鍵 (暗号学的に安全な乱数)
aes_key = os.urandom(32)  # 32 bytes = 256 bits

# os.urandom は以下のソースを使用:
#   Linux: getrandom(2) → /dev/urandom
#   macOS: getentropy(2)
#   Windows: CryptGenRandom
# いずれも CSPRNG (暗号学的疑似乱数生成器)

# NG: random モジュール (予測可能)
# import random
# bad_key = bytes([random.randint(0, 255) for _ in range(32)])

# =============================================
# 2. 非対称鍵の生成
# =============================================

# RSA 4096 ビット (レガシー互換性が必要な場合)
rsa_private = rsa.generate_private_key(
    public_exponent=65537,
    key_size=4096,
)

# ECDSA P-256 (一般的な用途)
ec_private = ec.generate_private_key(ec.SECP256R1())

# Ed25519 (推奨: 高速、安全、定数時間)
ed_private = ed25519.Ed25519PrivateKey.generate()

# X25519 (鍵交換用)
x_private = x25519.X25519PrivateKey.generate()

# =============================================
# 3. 秘密鍵の暗号化保存
# =============================================

# パスフレーズで暗号化して PEM 形式で保存
pem_encrypted = ec_private.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.BestAvailableEncryption(
        b"strong-passphrase-here"
    ),
)

# 暗号化なしの PEM (HSM内 or メモリ上のみ使用)
pem_unencrypted = ec_private.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)

# 公開鍵の導出とエクスポート
public_pem = ec_private.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
)

# =============================================
# 4. 鍵導出 (HKDF)
# =============================================

# マスターシークレットから複数の用途別鍵を導出
master_secret = os.urandom(32)

def derive_key(master: bytes, purpose: str, length: int = 32) -> bytes:
    """HKDF で用途別の鍵を導出"""
    return HKDF(
        algorithm=SHA256(),
        length=length,
        salt=None,  # ランダムソルト推奨 (本番では固定しない)
        info=purpose.encode(),
    ).derive(master)

encryption_key = derive_key(master_secret, "encryption")
signing_key = derive_key(master_secret, "signing")
auth_key = derive_key(master_secret, "authentication")

# 重要: 1つのマスターから用途別に導出することで、
# 鍵の使い回し (key reuse) を防ぐ
```

---

## 3. HSM (Hardware Security Module)

### HSM Internal Architecture

```
+---------------------------------------------------+
|                  Application                        |
|---------------------------------------------------|
|  1. Key generation request    4. Signing request  |
|  2. Encryption request        5. Key wrapping     |
|  3. Decryption request        6. HMAC computation |
+---------------------------------------------------+
            |  PKCS#11 / JCE / CNG / KMIP API
            v
+---------------------------------------------------+
|                    HSM                             |
|---------------------------------------------------|
|  [Tamper-resistant hardware]                      |
|  Physical enclosure is tamper-evident             |
|  (opening triggers key erasure)                   |
|                                                   |
|  +-- Key storage                                  |
|  |   Encrypted non-volatile memory                |
|  |   Keys never leave the HSM (non-extractable)   |
|  |                                                |
|  +-- Cryptographic engine                         |
|  |   Dedicated ASIC chip for crypto operations    |
|  |   High-speed processing equivalent to AES-NI  |
|  |   RSA signing: ~1,000 ops/sec                  |
|  |   ECDSA P-256: ~5,000 ops/sec                 |
|  |                                                |
|  +-- Random number generator (TRNG)              |
|  |   Physical entropy source (thermal noise etc.) |
|  |   Compliant with NIST SP 800-90B              |
|  |                                                |
|  +-- Audit log                                    |
|  |   All operations recorded in internal log      |
|  |   Tamper-proof                                 |
|  |                                                |
|  +-- FIPS 140-2/3 Level 3 certification          |
|      Level 2: Detection of physical tampering     |
|      Level 3: Key erasure upon tampering          |
|      Level 4: Resistance to environmental attacks |
+---------------------------------------------------+
```

### HSM Types and Comparison

| Type | Examples | Characteristics | Cost | Use Cases |
|------|----------|-----------------|------|-----------|
| On-premises HSM | Thales Luna, nCipher | Fully managed, highest security | $10K–$100K+ | Finance, government |
| Cloud HSM | AWS CloudHSM, GCP Cloud HSM | Managed, FIPS Level 3 | $1–2/hour | Cloud workloads |
| USB HSM | YubiHSM 2 | Compact, low cost | $650 | Small-scale, development, signing |
| Software HSM | SoftHSM 2 | For development/testing | Free | Development environment only |
| Cloud KMS | AWS KMS, GCP Cloud KMS | Fully managed | $1/key/month | General-purpose encryption |

### HSM Operations via PKCS#11

```python
import pkcs11
from pkcs11 import KeyType, Mechanism, ObjectClass

# =============================================
# HSM ライブラリのロード
# =============================================

# SoftHSM 2 (開発用)
lib = pkcs11.lib("/usr/lib/softhsm/libsofthsm2.so")

# Thales Luna (本番用)
# lib = pkcs11.lib("/usr/lib/libCryptoki2_64.so")

# AWS CloudHSM
# lib = pkcs11.lib("/opt/cloudhsm/lib/libcloudhsm_pkcs11.so")

token = lib.get_token(token_label="my-token")

# =============================================
# セッション開始と鍵操作
# =============================================

with token.open(user_pin="1234") as session:
    # --- AES 鍵の生成 (HSM 内) ---
    aes_key = session.generate_key(
        KeyType.AES, 256,
        label="data-encryption-key-001",
        id=b"\x01\x00\x01",
        store=True,         # HSM に永続保存
        extractable=False,  # HSM 外への抽出を禁止
        sensitive=True,     # 平文での読み出し禁止
        encrypt=True,       # 暗号化に使用可
        decrypt=True,       # 復号に使用可
        wrap=False,         # 他の鍵のラッピングには使用不可
    )

    # --- HSM 内で暗号化 (AES-CBC-PAD) ---
    plaintext = b"Sensitive data that must be encrypted"
    iv = session.generate_random(128)  # 128 bit IV
    ciphertext = aes_key.encrypt(
        plaintext,
        mechanism=Mechanism.AES_CBC_PAD,
        mechanism_param=iv,
    )

    # --- HSM 内で復号 ---
    decrypted = aes_key.decrypt(
        ciphertext,
        mechanism=Mechanism.AES_CBC_PAD,
        mechanism_param=iv,
    )
    assert decrypted == plaintext

    # --- RSA 鍵ペアの生成 (HSM 内) ---
    pub_key, priv_key = session.generate_keypair(
        KeyType.RSA, 4096,
        label="signing-key-001",
        store=True,
        private={
            "extractable": False,
            "sensitive": True,
            "sign": True,
        },
        public={
            "verify": True,
        },
    )

    # --- HSM 内でデジタル署名 ---
    message = b"Data to be signed"
    signature = priv_key.sign(
        message,
        mechanism=Mechanism.SHA256_RSA_PKCS,
    )

    # --- 署名検証 ---
    pub_key.verify(
        message,
        signature,
        mechanism=Mechanism.SHA256_RSA_PKCS,
    )

    # --- 鍵のラッピング (KEK で DEK を暗号化) ---
    # ラッピング用 KEK を生成
    kek = session.generate_key(
        KeyType.AES, 256,
        label="key-encryption-key-001",
        store=True,
        extractable=False,
        wrap=True,      # ラッピングに使用可
        unwrap=True,    # アンラッピングに使用可
    )

    # DEK を KEK でラップ (暗号化して取り出し)
    wrapped_dek = kek.wrap_key(
        aes_key,
        mechanism=Mechanism.AES_KEY_WRAP,
    )
    # wrapped_dek は HSM の外に安全に保存可能

    # 必要時にアンラップ (HSM 内で復元)
    restored_dek = kek.unwrap_key(
        ObjectClass.SECRET_KEY,
        KeyType.AES,
        wrapped_dek,
        mechanism=Mechanism.AES_KEY_WRAP,
        template={
            "encrypt": True,
            "decrypt": True,
            "extractable": False,
        },
    )
```

### HSM Access Control Model

```
+----------------------------------------------------------+
|              HSM Access Control                           |
|----------------------------------------------------------|
|                                                          |
|  [Authentication methods]                                |
|  +-- PIN/Password: Basic authentication                  |
|  +-- M of N: Requires approval from M of N admins        |
|  |   Example: 3 of 5 (3 of 5 administrators at once)    |
|  +-- Smart card + PIN: Two-factor authentication        |
|                                                          |
|  [Roles]                                                 |
|  +-- Security Officer (SO): HSM administration/config   |
|  +-- Crypto Officer (CO): Key generation and deletion   |
|  +-- Crypto User (CU): Key usage (encrypt/sign)        |
|  +-- Auditor: Read-only access to audit logs            |
|                                                          |
|  [Policies]                                              |
|  +-- Key attributes: extractable, sensitive, modifiable  |
|  +-- Operation restrictions: encrypt, decrypt, sign, wrap|
|  +-- Time restrictions: configurable usage time windows  |
|  +-- Usage count limits: maximum usage count settings   |
+----------------------------------------------------------+
```

---

## 4. Cloud KMS

### Basic AWS KMS Operations

```python
import boto3
import base64
import json

kms = boto3.client("kms", region_name="ap-northeast-1")

# =============================================
# 1. カスタマーマスターキー (CMK) の作成
# =============================================

response = kms.create_key(
    Description="Application data encryption key",
    KeyUsage="ENCRYPT_DECRYPT",
    KeySpec="SYMMETRIC_DEFAULT",  # AES-256-GCM
    Origin="AWS_KMS",             # KMS 生成 (推奨)
    # Origin="EXTERNAL",          # 外部から鍵をインポート
    MultiRegion=False,
    Tags=[
        {"TagKey": "Environment", "TagValue": "production"},
        {"TagKey": "Application", "TagValue": "user-data-service"},
        {"TagKey": "Compliance", "TagValue": "PCI-DSS"},
    ],
)
key_id = response["KeyMetadata"]["KeyId"]
key_arn = response["KeyMetadata"]["Arn"]

# エイリアスの設定 (人間が読める名前)
kms.create_alias(
    AliasName="alias/user-data-key",
    TargetKeyId=key_id,
)

# =============================================
# 2. 鍵ポリシーの設定
# =============================================

key_policy = {
    "Version": "2012-10-17",
    "Id": "user-data-key-policy",
    "Statement": [
        {
            "Sid": "Enable IAM policies",
            "Effect": "Allow",
            "Principal": {"AWS": f"arn:aws:iam::123456789012:root"},
            "Action": "kms:*",
            "Resource": "*",
        },
        {
            "Sid": "Allow application to encrypt/decrypt",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::123456789012:role/app-server-role"
            },
            "Action": [
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:GenerateDataKey",
                "kms:GenerateDataKeyWithoutPlaintext",
                "kms:DescribeKey",
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "kms:EncryptionContext:purpose": "user-data",
                },
            },
        },
        {
            "Sid": "Deny direct data encryption (enforce envelope)",
            "Effect": "Deny",
            "Principal": "*",
            "Action": "kms:Encrypt",
            "Resource": "*",
            "Condition": {
                "NumericGreaterThan": {
                    "kms:DataKeySpec": "4096",
                },
            },
        },
    ],
}

kms.put_key_policy(
    KeyId=key_id,
    PolicyName="default",
    Policy=json.dumps(key_policy),
)

# =============================================
# 3. データの暗号化 (直接)
# =============================================

# 小さなデータ (<4KB) は直接暗号化可能
encrypt_response = kms.encrypt(
    KeyId="alias/user-data-key",
    Plaintext=b"Secret data",
    EncryptionContext={
        "purpose": "user-data",
        "tenant": "acme-corp",
        "user_id": "user-12345",
    },
    # EncryptionContext は AAD (Additional Authenticated Data) として機能
    # 復号時に同じ Context を指定しないと復号できない
)
ciphertext = encrypt_response["CiphertextBlob"]

# =============================================
# 4. データの復号
# =============================================

decrypt_response = kms.decrypt(
    CiphertextBlob=ciphertext,
    EncryptionContext={
        "purpose": "user-data",
        "tenant": "acme-corp",
        "user_id": "user-12345",
    },
    # EncryptionContext が不一致 → InvalidCiphertextException
)
plaintext = decrypt_response["Plaintext"]

# =============================================
# 5. 非対称鍵の操作
# =============================================

# 署名用 RSA 鍵の作成
sign_key = kms.create_key(
    Description="API signing key",
    KeyUsage="SIGN_VERIFY",
    KeySpec="RSA_4096",
    Tags=[{"TagKey": "Purpose", "TagValue": "api-signing"}],
)
sign_key_id = sign_key["KeyMetadata"]["KeyId"]

# データの署名
import hashlib
message = b"Important message to sign"
digest = hashlib.sha256(message).digest()

sign_response = kms.sign(
    KeyId=sign_key_id,
    Message=digest,
    MessageType="DIGEST",
    SigningAlgorithm="RSASSA_PKCS1_V1_5_SHA_256",
)
signature = sign_response["Signature"]

# 署名の検証
verify_response = kms.verify(
    KeyId=sign_key_id,
    Message=digest,
    MessageType="DIGEST",
    Signature=signature,
    SigningAlgorithm="RSASSA_PKCS1_V1_5_SHA_256",
)
assert verify_response["SignatureValid"] is True
```

### KMS Comparison Table (Detail)

| Item | AWS KMS | GCP Cloud KMS | Azure Key Vault |
|------|---------|---------------|-----------------|
| HSM backend | CloudHSM integration | Cloud HSM | Managed HSM |
| FIPS certification | 140-2 Level 2 (standard), Level 3 (CloudHSM) | 140-2 Level 3 | 140-2 Level 2 (standard), Level 3 (Premium) |
| Automatic rotation | Annual (symmetric keys only) | Custom period | Custom period |
| Pricing (key/month) | $1 (symmetric), $1 (asymmetric) | $0.06 (software), $1–2.50 (HSM) | $0.03/10,000 operations |
| Pricing (requests) | $0.03/10,000 | $0.03/10,000 | $0.03/10,000 |
| Key import | Supported (BYOK) | Supported (BYOK) | Supported (BYOK) |
| Multi-region | Multi-region keys | Global resource | Geo replication |
| Encryption context | EncryptionContext (AAD) | Additional AAD | - |
| Key policy | KMS Key Policy + IAM | IAM | RBAC + Access Policy |
| CloudTrail integration | All operations logged | Cloud Audit Logs | Activity Log |
| Max data size (direct) | 4 KB | 64 KB | - |

### GCP Cloud KMS Example

```python
from google.cloud import kms

def encrypt_with_gcp_kms(
    project_id: str,
    location_id: str,
    key_ring_id: str,
    key_id: str,
    plaintext: bytes,
) -> bytes:
    """GCP Cloud KMS でデータを暗号化"""
    client = kms.KeyManagementServiceClient()
    key_name = client.crypto_key_path(
        project_id, location_id, key_ring_id, key_id
    )

    # 暗号化 (AAD 付き)
    response = client.encrypt(
        request={
            "name": key_name,
            "plaintext": plaintext,
            "additional_authenticated_data": b"context-info",
        }
    )
    return response.ciphertext

def decrypt_with_gcp_kms(
    project_id: str,
    location_id: str,
    key_ring_id: str,
    key_id: str,
    ciphertext: bytes,
) -> bytes:
    """GCP Cloud KMS でデータを復号"""
    client = kms.KeyManagementServiceClient()
    key_name = client.crypto_key_path(
        project_id, location_id, key_ring_id, key_id
    )

    response = client.decrypt(
        request={
            "name": key_name,
            "ciphertext": ciphertext,
            "additional_authenticated_data": b"context-info",
        }
    )
    return response.plaintext
```

---

## 5. Envelope Encryption

### How Envelope Encryption Works

```
Encryption flow:

  +-----------+     DEK (plaintext)  +-----------+
  |  KMS      | ---- generate ----> |  DEK       |
  | (master   |                      | (data key) |
  |   key)    |                      +-----------+
  +-----------+                           |
       |                                  |
       | Encrypt DEK                      | Encrypt data
       | with master key                  | with DEK
       | (KMS API)                        | (local)
       |                                  |
       v                                  v
  +-----------+                      +-----------+
  | Encrypted  |                      | Encrypted |
  | DEK        |                      | data      |
  | (stored in |                      +-----------+
  |  metadata) |                           |
  +-----------+                            |
       |                                   |
       +------- stored together -----------+

Decryption flow:

  +-----------+                      +-----------+
  | Encrypted  |                      | Encrypted |
  | DEK        |                      | data      |
  +-----------+                      +-----------+
       |                                  |
       | Send to KMS                      |
       v                                  |
  +-----------+     DEK (plaintext)        |
  |  KMS      | ---- decrypt ---→         |
  | (master   |                      Decrypt with DEK
  |   key)    |                      (local)
  +-----------+                           |
                                          v
                                    +-----------+
                                    | Plaintext |
                                    +-----------+

Benefits:
  1. No need to send large data to KMS (reduces latency)
  2. Minimizes KMS API call count (reduces cost)
  3. Master key never leaves KMS/HSM (security)
  4. Easy DEK rotation (re-encrypt with a new DEK)
```

### Envelope Encryption Implementation (Production Quality)

```python
import boto3
import os
import json
import struct
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dataclasses import dataclass
from typing import Optional

@dataclass
class EncryptedBundle:
    """暗号化結果のバンドル"""
    encrypted_dek: bytes    # KMS で暗号化された DEK
    nonce: bytes            # AES-GCM のナンス (12 bytes)
    ciphertext: bytes       # 暗号化されたデータ
    key_id: str             # 使用した KMS キーのARN
    algorithm: str          # 使用した暗号アルゴリズム
    context: dict           # 暗号化コンテキスト

    def serialize(self) -> bytes:
        """バイナリフォーマットにシリアライズ"""
        # フォーマット: [version][dek_len][dek][nonce][ciphertext]
        version = struct.pack("B", 1)  # v1
        dek_len = struct.pack(">H", len(self.encrypted_dek))
        return version + dek_len + self.encrypted_dek + self.nonce + self.ciphertext

    @classmethod
    def deserialize(cls, data: bytes, key_id: str, context: dict) -> "EncryptedBundle":
        """バイナリフォーマットからデシリアライズ"""
        version = struct.unpack("B", data[0:1])[0]
        if version != 1:
            raise ValueError(f"Unsupported version: {version}")
        dek_len = struct.unpack(">H", data[1:3])[0]
        encrypted_dek = data[3:3+dek_len]
        nonce = data[3+dek_len:3+dek_len+12]
        ciphertext = data[3+dek_len+12:]
        return cls(
            encrypted_dek=encrypted_dek,
            nonce=nonce,
            ciphertext=ciphertext,
            key_id=key_id,
            algorithm="AES-256-GCM",
            context=context,
        )


class EnvelopeEncryption:
    """エンベロープ暗号化の本番品質実装"""

    def __init__(self, kms_key_id: str, region: str = "ap-northeast-1"):
        self.kms = boto3.client("kms", region_name=region)
        self.kms_key_id = kms_key_id

    def encrypt(self, plaintext: bytes, context: dict) -> EncryptedBundle:
        """エンベロープ暗号化でデータを暗号化"""
        # Step 1: KMS から DEK を取得
        response = self.kms.generate_data_key(
            KeyId=self.kms_key_id,
            KeySpec="AES_256",
            EncryptionContext=context,
        )
        dek_plaintext = response["Plaintext"]       # 平文 DEK
        dek_encrypted = response["CiphertextBlob"]  # 暗号化 DEK

        try:
            # Step 2: DEK でデータをローカル暗号化 (AES-256-GCM)
            nonce = os.urandom(12)  # 96-bit nonce (GCM推奨)
            aesgcm = AESGCM(dek_plaintext)
            # AAD として暗号化コンテキストを含める
            aad = json.dumps(context, sort_keys=True).encode()
            ciphertext = aesgcm.encrypt(nonce, plaintext, aad)

            return EncryptedBundle(
                encrypted_dek=dek_encrypted,
                nonce=nonce,
                ciphertext=ciphertext,
                key_id=self.kms_key_id,
                algorithm="AES-256-GCM",
                context=context,
            )
        finally:
            # Step 3: 平文 DEK をメモリから確実に消去
            # Python ではガベージコレクタに依存するため完全な消去は困難
            # ctypes でメモリを直接ゼロ化する方法もある
            dek_plaintext = b"\x00" * len(dek_plaintext)
            del dek_plaintext

    def decrypt(self, bundle: EncryptedBundle) -> bytes:
        """暗号化されたデータを復号"""
        # Step 1: KMS で DEK を復号
        response = self.kms.decrypt(
            CiphertextBlob=bundle.encrypted_dek,
            EncryptionContext=bundle.context,
        )
        dek_plaintext = response["Plaintext"]

        try:
            # Step 2: DEK でデータをローカル復号
            aesgcm = AESGCM(dek_plaintext)
            aad = json.dumps(bundle.context, sort_keys=True).encode()
            plaintext = aesgcm.decrypt(bundle.nonce, bundle.ciphertext, aad)
            return plaintext
        finally:
            dek_plaintext = b"\x00" * len(dek_plaintext)
            del dek_plaintext

    def reencrypt_with_new_key(self, bundle: EncryptedBundle,
                                new_key_id: str) -> EncryptedBundle:
        """別の KMS キーで再暗号化 (鍵ローテーション用)"""
        # 旧キーで復号 → 新キーで暗号化
        plaintext = self.decrypt(bundle)
        old_key = self.kms_key_id
        self.kms_key_id = new_key_id
        try:
            return self.encrypt(plaintext, bundle.context)
        finally:
            self.kms_key_id = old_key
            plaintext = b"\x00" * len(plaintext)
            del plaintext


# 使用例
if __name__ == "__main__":
    crypto = EnvelopeEncryption(kms_key_id="alias/user-data-key")

    # 暗号化
    context = {"tenant": "acme", "purpose": "pii-data"}
    bundle = crypto.encrypt(b"John Doe, SSN: 123-45-6789", context)

    # 復号
    decrypted = crypto.decrypt(bundle)
    print(f"Decrypted: {decrypted.decode()}")

    # シリアライズ/デシリアライズ (ストレージ保存用)
    serialized = bundle.serialize()
    restored = EncryptedBundle.deserialize(
        serialized, "alias/user-data-key", context
    )
    assert crypto.decrypt(restored) == b"John Doe, SSN: 123-45-6789"
```

### Envelope Encryption vs. Direct Encryption

| Item | Envelope Encryption | Direct KMS Encryption |
|------|--------------------|-----------------------|
| Data size limit | Unlimited | AWS: 4KB, GCP: 64KB |
| Latency | Low (local encryption) | High (all data sent to KMS) |
| KMS API calls | 1 call (DEK generation) | Proportional to data volume |
| Cost | Low | High (with large data) |
| Master key exposure | None (stays in KMS) | None (stays in KMS) |
| DEK rotation | Easy (re-encrypt with new DEK) | Not needed (KMS-managed) |
| Applicable scenarios | Large data, files | Small secrets, tokens |

---

## 6. Key Rotation

### Automatic Rotation Strategies

```
Key rotation methods:

Method 1: KMS automatic rotation (recommended)
+------------------------------------------+
| KMS Key (alias/my-key)                   |
|                                          |
| v1 (2024-01) → encrypt/decrypt (current) |
| v2 (2025-01) → encrypt/decrypt (auto)    |
| v3 (2026-01) → encrypt (latest)          |
|                                          |
| - Alias unchanged                        |
| - Data encrypted with older key versions |
|   can still be decrypted via same alias  |
| - No application changes required        |
+------------------------------------------+

Method 2: Manual rotation (alias switchover)
+------------------------------------------+
| Step 1: Create a new key                 |
| Step 2: Point alias to the new key       |
| Step 3: Keep old key for decryption      |
| Step 4: Re-encrypt old data as needed    |
|                                          |
| alias/my-key → key-id-NEW (encrypt)     |
| key-id-OLD for decryption only           |
|   (do not deactivate)                    |
+------------------------------------------+

Method 3: Double-write + batch migration
+------------------------------------------+
| Phase 1: Encrypt with both old and new   |
|          keys (double-write)             |
| Phase 2: On read, re-encrypt old-key     |
|          data with new key (lazy)        |
| Phase 3: Batch-migrate remaining data    |
| Phase 4: Deactivate → destroy old key   |
+------------------------------------------+
```

### Key Rotation Implementation

```python
import boto3
from datetime import datetime, timedelta
from typing import Optional

kms = boto3.client("kms")

class KeyRotationManager:
    """KMS 鍵ローテーションの管理"""

    def __init__(self, region: str = "ap-northeast-1"):
        self.kms = boto3.client("kms", region_name=region)

    def enable_auto_rotation(self, key_id: str, rotation_period_days: int = 365):
        """自動ローテーションを有効化"""
        self.kms.enable_key_rotation(KeyId=key_id)

        # ローテーション状態の確認
        status = self.kms.get_key_rotation_status(KeyId=key_id)
        print(f"自動ローテーション: {status['KeyRotationEnabled']}")

        # カスタムローテーション期間 (AWS KMS は 90-2560 日)
        if rotation_period_days != 365:
            self.kms.update_key_rotation_period(
                KeyId=key_id,
                RotationPeriodInDays=rotation_period_days,
            )

    def manual_rotate(self, alias: str) -> str:
        """手動ローテーション (新しい鍵を作成してエイリアスを切り替え)"""
        # 旧鍵の情報を取得
        old_key = self.kms.describe_key(KeyId=f"alias/{alias}")
        old_key_id = old_key["KeyMetadata"]["KeyId"]

        # 新しい鍵を作成
        new_key = self.kms.create_key(
            Description=f"Rotated key - {datetime.now().isoformat()}",
            KeyUsage=old_key["KeyMetadata"]["KeyUsage"],
            KeySpec=old_key["KeyMetadata"]["KeySpec"],
            Tags=[
                {"TagKey": "RotatedFrom", "TagValue": old_key_id},
                {"TagKey": "RotatedAt", "TagValue": datetime.now().isoformat()},
            ],
        )
        new_key_id = new_key["KeyMetadata"]["KeyId"]

        # エイリアスを新しい鍵に向ける (アトミック)
        self.kms.update_alias(
            AliasName=f"alias/{alias}",
            TargetKeyId=new_key_id,
        )

        print(f"ローテーション完了: {old_key_id} → {new_key_id}")
        print(f"旧鍵 {old_key_id} は復号のために残存")

        return new_key_id

    def emergency_rotate(self, alias: str, reason: str) -> str:
        """緊急ローテーション (鍵の危殆化時)"""
        print(f"[EMERGENCY] 緊急ローテーション開始: {reason}")

        # 新しい鍵を即座に作成
        new_key_id = self.manual_rotate(alias)

        # 旧鍵をスケジュール無効化 (即座には無効化しない)
        # 理由: 旧鍵で暗号化されたデータの復号が必要なため
        old_key = self.kms.describe_key(KeyId=f"alias/{alias}")

        # インシデント記録
        print(f"[EMERGENCY] 新鍵: {new_key_id}")
        print(f"[EMERGENCY] 旧データの再暗号化が必要")
        print(f"[EMERGENCY] 理由: {reason}")

        return new_key_id

    def audit_key_ages(self) -> list[dict]:
        """全鍵の年齢を監査"""
        aging_keys = []
        paginator = self.kms.get_paginator("list_keys")

        for page in paginator.paginate():
            for key in page["Keys"]:
                try:
                    metadata = self.kms.describe_key(
                        KeyId=key["KeyId"]
                    )["KeyMetadata"]

                    if metadata["KeyState"] != "Enabled":
                        continue

                    age_days = (datetime.now(metadata["CreationDate"].tzinfo)
                               - metadata["CreationDate"]).days

                    if age_days > 365:
                        aging_keys.append({
                            "key_id": key["KeyId"],
                            "description": metadata.get("Description", ""),
                            "age_days": age_days,
                            "rotation_enabled": self.kms.get_key_rotation_status(
                                KeyId=key["KeyId"]
                            ).get("KeyRotationEnabled", False),
                        })
                except Exception:
                    continue

        return aging_keys
```

### Key Rotation Terraform Configuration

```hcl
# AWS KMS キーの作成と自動ローテーション
resource "aws_kms_key" "data_key" {
  description             = "Data encryption key for user service"
  deletion_window_in_days = 30    # 削除猶予期間
  enable_key_rotation     = true  # 自動ローテーション
  rotation_period_in_days = 365   # ローテーション間隔

  # 鍵ポリシー
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM policies"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow application access"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.app_role.arn
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey",
        ]
        Resource = "*"
      },
    ]
  })

  tags = {
    Environment = "production"
    Compliance  = "PCI-DSS"
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "data_key" {
  name          = "alias/user-data-key"
  target_key_id = aws_kms_key.data_key.key_id
}

# CloudWatch アラーム: 鍵の使用異常検知
resource "aws_cloudwatch_metric_alarm" "kms_usage_anomaly" {
  alarm_name          = "kms-unusual-activity"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "NumberOfDecryptRequests"
  namespace           = "AWS/KMS"
  period              = 300
  statistic           = "Sum"
  threshold           = 1000    # 5分間で1000回以上の復号はアラート

  dimensions = {
    KeyId = aws_kms_key.data_key.key_id
  }

  alarm_actions = [aws_sns_topic.security_alerts.arn]
}
```

---

## 7. Safe Handling of Keys in Memory

### Key Memory Safety

```
Threats:
  1. Memory dumps (core dumps) may contain keys
  2. Keys may be written to swap space
  3. GC (garbage collector) releases memory lazily
  4. Keys copied to child processes on fork
  5. Side-channel attacks (cache timing, etc.)

Countermeasures:
  +-- OS level ------+
  |  mlock()         |  Prevent memory from being swapped
  |  madvise()       |  Do not copy on fork
  |  Disable coredump|  /proc/sys/kernel/core_pattern
  +------------------+

  +-- Application level --+
  |  Immediate zeroing    |  Overwrite memory with zeros after use
  |  Scope limitation     |  Minimize key lifetime
  |  Use HSM              |  Never hold key in memory (best option)
  +----------------------+
```

### Safe Key Handling in Python

```python
import ctypes
import os
import mmap
from contextlib import contextmanager

class SecureBuffer:
    """安全なメモリバッファ (鍵の一時保存用)"""

    def __init__(self, size: int):
        self.size = size
        # mmap で個別のメモリページを確保
        self._buf = mmap.mmap(-1, size, mmap.MAP_PRIVATE | mmap.MAP_ANONYMOUS)
        # mlock でスワップ防止 (root 権限 or CAP_IPC_LOCK 必要)
        try:
            ctypes.CDLL("libc.so.6").mlock(
                ctypes.c_void_p(id(self._buf)),
                ctypes.c_size_t(size),
            )
        except (OSError, AttributeError):
            pass  # mlock 失敗時は続行 (macOS等)

    def write(self, data: bytes):
        """データをバッファに書き込み"""
        if len(data) > self.size:
            raise ValueError("Data exceeds buffer size")
        self._buf.seek(0)
        self._buf.write(data)

    def read(self) -> bytes:
        """バッファからデータを読み出し"""
        self._buf.seek(0)
        return self._buf.read(self.size)

    def zero(self):
        """バッファをゼロで上書き (安全な消去)"""
        self._buf.seek(0)
        self._buf.write(b"\x00" * self.size)

    def __del__(self):
        """デストラクタでゼロ化を保証"""
        try:
            self.zero()
            self._buf.close()
        except Exception:
            pass

@contextmanager
def secure_key(key_data: bytes):
    """鍵の安全な一時保持 (コンテキストマネージャ)"""
    buf = SecureBuffer(len(key_data))
    buf.write(key_data)
    try:
        yield buf.read()
    finally:
        buf.zero()
        # 元のデータもゼロ化
        ctypes.memset(id(key_data) + 32, 0, len(key_data))

# 使用例
# with secure_key(dek_plaintext) as key:
#     aesgcm = AESGCM(key)
#     ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
# # ← ここで key はゼロ化済み
```

---

## 8. Anti-patterns

### Anti-pattern 1: Hardcoding Keys

```python
# NG: ソースコードに暗号鍵を直書き
ENCRYPTION_KEY = b"0123456789abcdef0123456789abcdef"
SECRET_API_KEY = "sk_live_abcdef123456"

# NG: 設定ファイルに平文で保存
# config.yaml:
#   encryption_key: "0123456789abcdef"

# NG: 環境変数に長期保存 (ローテーション不可)
# export ENCRYPTION_KEY="0123456789abcdef"

# OK: KMS から動的に取得
import os
key_ref = os.environ["KMS_KEY_ARN"]  # ARN のみ保持
# KMS API 経由で暗号化・復号を行う (鍵自体はメモリに持たない)

# OK: Secrets Manager から取得 (自動ローテーション付き)
import boto3
sm = boto3.client("secretsmanager")
response = sm.get_secret_value(SecretId="myapp/api-key")
api_key = response["SecretString"]
```

**Impact**: Keys remain in git history and cannot be rotated. All data is compromised upon exposure. According to GitHub research, approximately 10% of public repositories have some kind of secret committed to them.

### Anti-pattern 2: Storing Keys and Data in the Same Storage

```
NG:
  S3 bucket/
    ├── data/encrypted-data.bin
    └── keys/encryption-key.txt     ← key stored in same bucket
  (S3 bucket leak → key and data both exposed simultaneously)

NG:
  Database/
    ├── users table (encrypted columns)
    └── encryption_keys table        ← key stored in same DB
  (SQLi → both key and data can be retrieved)

OK:
  S3 bucket (data)/
    └── data/encrypted-data.bin     ← encrypted DEK stored in metadata
  KMS (keys)/
    └── master key                   ← managed in separate service
  (Even if S3 is leaked, decrypting the encrypted DEK requires KMS access)

OK:
  Database/
    └── users table (encrypted data + encrypted DEK)
  AWS KMS/
    └── CMK (master key)             ← strictly access-controlled via IAM
```

**Impact**: If an S3 bucket is leaked, both the key and the data are exposed simultaneously, rendering encryption meaningless. Encryption is predicated on the assumption that data cannot be read without the key — if keys and data are not separated, that premise breaks down.

### Anti-pattern 3: No Key Rotation

```
NG:
  → Continuing to use an AES key created 5 years ago
  → "It works, so we won't change it"
  → No rotation procedure in place
  → Keys accessed by former employees still exist

OK:
  → Enable KMS automatic rotation
  → Document and automate the rotation procedure
  → Regular audits (check key age)
  → Review key access on employee departure/transfer

Compliance requirements:
  PCI DSS: Annual rotation required
  NIST SP 800-57: Maximum 2 years for symmetric keys
  HIPAA: Requires appropriate key management
```

---

## 9. Exercises

### Exercise 1 (Basic): Key Generation and Encryption

**Task**: Implement the following in Python.
1. Generate an AES-256-GCM key using a CSPRNG
2. Encrypt and decrypt arbitrary text
3. Include AAD (Additional Authenticated Data)
4. Explain how to guarantee nonce uniqueness

**Hint**: Use `os.urandom()` and the `AESGCM` class from the `cryptography` library.

### Exercise 2 (Applied): Designing an Envelope Encryption System

**Task**: Design an envelope encryption system that satisfies the following requirements.
- Multi-tenant environment (different master keys per tenant)
- Re-encryption of existing data is required during key rotation
- Encryption context includes tenant ID and data type
- Alert mechanism on unauthorized access

**Deliverables**: Class design diagram + sequence diagram

### Exercise 3 (Practical): Automating KMS Key Management

**Task**: Use Terraform to build the following KMS configuration.
- 3 purpose-specific KMS keys (data encryption, signing, secret management)
- Appropriate key policies for each key
- Enable automatic rotation
- Anomaly detection via CloudWatch alarms
- A Lambda function to audit key age

**Hint**: Use `aws_kms_key`, `aws_kms_alias`, and `aws_cloudwatch_metric_alarm`.

---

## 10. Troubleshooting

### Common Issues and Solutions

```
Issue 1: Cannot decrypt with KMS (AccessDeniedException)
  → Check that the IAM policy includes kms:Decrypt
  → Check that the calling Principal is in the KMS key policy
  → Check that the EncryptionContext matches exactly what was used during encryption
  → Check that the key is not in a DISABLED state

Issue 2: Cannot decrypt with KMS (InvalidCiphertextException)
  → EncryptionContext mismatch (most common cause)
  → Corrupted ciphertext (encoding issue during S3 transfer)
  → Data encrypted with a key from a different region
  → For multi-region keys: check the replica key

Issue 3: HSM session error
  → Expired PIN/password
  → Insufficient capacity in HSM partition (key count limit)
  → Network connectivity issue (CloudHSM)
  → Check HSM cluster sync status

Issue 4: Cannot decrypt after key rotation
  → Check that the old key has not been deleted
  → Check that the alias points to the correct key
  → Check that the ciphertext includes key version information
  → With KMS automatic rotation, old versions are retained automatically
```

### Debug Commands

```bash
# AWS KMS: 鍵の状態確認
aws kms describe-key --key-id alias/my-key \
  --query 'KeyMetadata.{KeyId:KeyId,KeyState:KeyState,CreationDate:CreationDate}'

# AWS KMS: ローテーション状態
aws kms get-key-rotation-status --key-id alias/my-key

# AWS KMS: 最近の鍵使用状況 (CloudTrail)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::KMS::Key \
  --max-results 20

# AWS KMS: 鍵ポリシーの確認
aws kms get-key-policy --key-id alias/my-key --policy-name default

# AWS CloudHSM: クラスタ状態
aws cloudhsmv2 describe-clusters \
  --query 'Clusters[].{Id:ClusterId,State:State,HSMs:Hsms[].{Id:HsmId,State:State}}'
```

---

## 11. Performance Considerations

### KMS API Latency and Throughput

| Operation | Latency (P50) | Latency (P99) | Throughput Limit |
|-----------|---------------|---------------|-----------------|
| Encrypt (symmetric) | 5–10 ms | 30 ms | 30,000 rps |
| Decrypt (symmetric) | 5–10 ms | 30 ms | 30,000 rps |
| GenerateDataKey | 5–10 ms | 30 ms | 30,000 rps |
| Sign (RSA-4096) | 50–100 ms | 200 ms | 500 rps |
| Sign (ECDSA) | 10–20 ms | 50 ms | 2,000 rps |

### Performance Optimization

```python
# 1. DEK キャッシュ (エンベロープ暗号化時)
from functools import lru_cache
from datetime import datetime, timedelta

class CachedEnvelopeEncryption:
    """DEK をキャッシュしてKMS API呼び出しを最小化"""

    def __init__(self, kms_key_id: str):
        self.kms = boto3.client("kms")
        self.kms_key_id = kms_key_id
        self._dek_cache = {}
        self._cache_ttl = timedelta(minutes=5)

    def _get_or_generate_dek(self, context_key: str, context: dict):
        """キャッシュからDEKを取得、なければ新規生成"""
        now = datetime.utcnow()
        if context_key in self._dek_cache:
            cached = self._dek_cache[context_key]
            if now - cached["created_at"] < self._cache_ttl:
                return cached["plaintext"], cached["encrypted"]

        response = self.kms.generate_data_key(
            KeyId=self.kms_key_id,
            KeySpec="AES_256",
            EncryptionContext=context,
        )
        self._dek_cache[context_key] = {
            "plaintext": response["Plaintext"],
            "encrypted": response["CiphertextBlob"],
            "created_at": now,
        }
        return response["Plaintext"], response["CiphertextBlob"]

# 2. バッチ処理
# 複数データを同じDEKで暗号化 (ナンスは各データで一意)
# → KMS API呼び出し1回で複数データを処理
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not only through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend solidly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in day-to-day development work, and is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------------|
| Key lifecycle | Manage all stages from generation → activation → active → deactivation → destruction based on NIST SP 800-57 |
| Key hierarchy | Three-layer structure: Master Key → KEK → DEK, each layer stored separately |
| HSM | Tamper-resistant hardware physically prevents key leakage; FIPS 140-2/3 certified |
| KMS | Cloud-managed to reduce operational overhead of key management; encryption context is mandatory |
| Envelope encryption | Two-layer DEK + KEK structure for efficiently encrypting large volumes of data |
| Key rotation | Enable automatic rotation and perform at least annually; also prepare emergency procedures |
| Key separation | Keys and data must always be managed in separate storage/services |
| Memory safety | Zero out plaintext keys immediately; use mlock to prevent swapping; using an HSM is the best option |
| Auditing | Log all key operations with CloudTrail etc.; alert on anomalous usage |

---

## Recommended Next Guides

- [TLS/Certificates](./01-tls-certificates.md) — Understand how keys are used in TLS
- [Cloud Security Fundamentals](../05-cloud-security/00-cloud-security-basics.md) — Overview of cloud security including KMS
- [AWS Security](../05-cloud-security/01-aws-security.md) — Practical use of AWS KMS and CloudHSM
- Cryptography Fundamentals — Theoretical background of cryptographic algorithms

---

## References

1. **NIST SP 800-57 Part 1 Rev.5 — Recommendation for Key Management** — https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final
2. **NIST SP 800-57 Part 2 Rev.1 — Best Practices for Key Management Organizations** — https://csrc.nist.gov/publications/detail/sp/800-57-part-2/rev-1/final
3. **AWS KMS Developer Guide** — https://docs.aws.amazon.com/kms/latest/developerguide/
4. **OWASP Cryptographic Storage Cheat Sheet** — https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
5. **Google Cloud KMS Documentation** — https://cloud.google.com/kms/docs
6. **PKCS#11 Specification** — https://docs.oasis-open.org/pkcs11/pkcs11-base/v2.40/pkcs11-base-v2.40.html
7. **FIPS 140-3 Standard** — https://csrc.nist.gov/publications/detail/fips/140/3/final
