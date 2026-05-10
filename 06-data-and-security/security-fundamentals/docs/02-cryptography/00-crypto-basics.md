# Cryptography Basics

> A systematic guide to symmetric-key cryptography, asymmetric-key cryptography, hash functions, MACs, encryption modes (AES-GCM), and hybrid encryption schemes — building the foundation for secure cryptographic implementation. Cryptography is the bedrock of security; understanding "why we choose a particular algorithm" and "why a certain usage is dangerous" is the first step toward designing secure systems.

## What You Will Learn

1. Understand the mechanics, characteristics, and appropriate use cases of **symmetric-key and asymmetric-key cryptography**
2. Master the differences between **hash functions and MACs** and their proper applications
3. Learn how to correctly implement authenticated encryption with **AES-GCM**
4. Understand the design pattern of **hybrid encryption** (envelope encryption)
5. Grasp **cryptographic selection criteria** and anti-patterns to make sound decisions in practice

## Prerequisites

- [Security Overview](../00-basics/00-security-overview.md) -- CIA triad (Confidentiality, Integrity, Availability)
- [Security Principles](../00-basics/02-security-principles.md) -- Least privilege, defense-in-depth, and other foundational principles
- Basic Python programming knowledge
- Understanding of bits and bytes (e.g., 128 bits = 16 bytes)

---

## 1. Classification and Overview of Cryptography

### 1.1 The Cryptographic Taxonomy

Cryptographic techniques are broadly divided into "reversible operations (encryption)" and "irreversible operations (hash/MAC)". Understanding when each technique applies is essential.

```
Overview of Cryptographic Techniques:

                        Cryptography
                          |
            +-------------+-------------+
            |                           |
        Encryption                 Hash/MAC
        (Reversible)               (Irreversible)
        "Can be undone"            "Cannot be undone"
            |                           |
    +-------+-------+           +-------+-------+
    |               |           |               |
  Symmetric       Asymmetric  Hash Function     MAC
  (AES)          (RSA, ECC)   (SHA-256)      (HMAC)
    |               |           |               |
  One shared key  Public+Private  Integrity    Auth+Integrity
  Fast            Slow          Tamper detect  Keyed tamper detect

  Real systems combine these:
  - TLS: asymmetric key exchange → symmetric encryption for data
  - Digital signatures: hash → signed with asymmetric key
  - Password storage: dedicated hash (Argon2id)
```

### 1.2 Use-Case Selection Guide

```
Cryptographic technique selection by use case:

  +------------------------------------------+
  | Goal                  → Technique         |
  |------------------------------------------|
  | Conceal data          → AES-256-GCM       |
  | Detect tampering      → SHA-256 / HMAC    |
  | Store passwords       → Argon2id / bcrypt |
  | Exchange keys safely  → ECDH / RSA-OAEP  |
  | Sign documents        → ECDSA / RSA-PSS  |
  | Encrypt communication → TLS 1.3          |
  | Encrypt bulk data     → Envelope encryption|
  +------------------------------------------+
```

| Use Case | Recommended Algorithm | Key Length | Notes |
|----------|-----------------------|------------|-------|
| Data encryption | AES-256-GCM | 256 bits | Authenticated encryption required |
| File integrity verification | SHA-256 / SHA-3 | - | Collision resistance is critical |
| Message authentication | HMAC-SHA256 | 256 bits | Keyed hash |
| Password storage | Argon2id | - | Memory-hardness required |
| Digital signatures | ECDSA (P-256) | 256 bits | RSA-4096 also acceptable |
| Key exchange | ECDH (X25519) | 256 bits | Ensures forward secrecy |

---

## 2. Symmetric-Key Cryptography

### 2.1 Basic Concepts of Symmetric-Key Cryptography

Symmetric-key cryptography uses the same key for both encryption and decryption. It is fast and well-suited for encrypting large volumes of data, but securely distributing the key is a challenge.

```
How symmetric-key cryptography works:

  Sender                              Receiver
    |                                   |
    |  Plaintext: "Hello, World!"      |
    |     ↓ Encrypt (shared key K)     |
    |  Ciphertext: "x8f3k2m9..."       |
    |                                   |
    |--- Send ciphertext -------------> |
    |                                   |  Ciphertext: "x8f3k2m9..."
    |                                   |     ↓ Decrypt (shared key K)
    |                                   |  Plaintext: "Hello, World!"
    |                                   |
    +-- Shared key K distributed via secure channel --+

  Problem: The key distribution problem
  - N parties communicating with each other need N×(N-1)/2 keys
  - 10 people → 45 keys; 100 people → 4,950 keys to manage
  - → Solved using asymmetric-key cryptography or a KMS
```

### 2.2 Authenticated Encryption with AES-GCM

```python
# Code example 1: Authenticated encryption with AES-256-GCM
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os


class AESEncryptor:
    """Authenticated encryption with AES-256-GCM

    WHY AES-GCM is recommended:
    - Performs encryption and authentication simultaneously (Authenticated Encryption with Associated Data)
    - Built-in tamper detection (integrity guaranteed by authentication tag)
    - Fast (supports AES-NI hardware acceleration)
    - NIST-recommended; default cipher suite in TLS 1.3

    WHY the nonce is critical:
    - Reusing the same nonce with the same key leaks information about the plaintext
    - In GCM, the nonce must never be reused with the same key
    - A 96-bit random nonce is safe for up to 2^32 encryptions per key
    """

    KEY_SIZE = 32   # 256 bits
    NONCE_SIZE = 12  # 96 bits (GCM recommended)

    def __init__(self, key: bytes = None):
        if key is None:
            key = AESGCM.generate_key(bit_length=256)
        if len(key) != self.KEY_SIZE:
            raise ValueError(f"Key length must be {self.KEY_SIZE} bytes")
        self._aesgcm = AESGCM(key)
        self._key = key

    def encrypt(self, plaintext: bytes,
                associated_data: bytes = None) -> bytes:
        """Encrypt and return nonce + ciphertext + authentication tag

        Args:
            plaintext: Data to encrypt
            associated_data: Additional Authenticated Data (AAD)
                Data that is not encrypted but whose tampering you want to detect.
                Examples: metadata, header information

        Returns:
            nonce(12 bytes) + ciphertext + tag(16 bytes)
        """
        nonce = os.urandom(self.NONCE_SIZE)
        ciphertext = self._aesgcm.encrypt(nonce, plaintext, associated_data)
        return nonce + ciphertext  # Prepend nonce

    def decrypt(self, data: bytes,
                associated_data: bytes = None) -> bytes:
        """Decrypt by separating the nonce first

        An exception is raised if authentication tag verification fails.
        This prevents decryption of tampered data.
        """
        nonce = data[:self.NONCE_SIZE]
        ciphertext = data[self.NONCE_SIZE:]
        return self._aesgcm.decrypt(nonce, ciphertext, associated_data)


# Usage example
encryptor = AESEncryptor()

# Basic encrypt/decrypt
plaintext = b"This is a secret message"
encrypted = encryptor.encrypt(plaintext)
decrypted = encryptor.decrypt(encrypted)
assert decrypted == plaintext
print(f"Encryption successful: {len(encrypted)} bytes")

# Encrypt with AAD (Additional Authenticated Data)
# When you want to detect tampering on metadata without encrypting it
aad = b"metadata:user_id=123"
encrypted_with_aad = encryptor.encrypt(plaintext, aad)
decrypted_with_aad = encryptor.decrypt(encrypted_with_aad, aad)
assert decrypted_with_aad == plaintext

# Decryption fails if AAD differs (tamper detection)
try:
    encryptor.decrypt(encrypted_with_aad, b"tampered_metadata")
except Exception as e:
    print(f"Tamper detected: {type(e).__name__}")
```

### 2.3 Comparison of Encryption Modes

| Mode | Authentication | Parallel Processing | Padding | Impact of Nonce Reuse | Recommendation |
|------|:--------------:|:-------------------:|:-------:|:---------------------:|:--------------:|
| ECB | No | Yes | Required | - | Prohibited |
| CBC | No | Decrypt only | Required | IV leakage | Conditional |
| CTR | No | Yes | Not required | Plaintext leakage | Conditional |
| GCM | Yes | Yes | Not required | Auth key leakage | Recommended |
| CCM | Yes | No | Not required | Security degradation | Acceptable |
| ChaCha20-Poly1305 | Yes | No | Not required | Auth key leakage | Recommended |

```
ECB mode problem (identical plaintext block → identical ciphertext block):

  Plaintext blocks: [AAAA][BBBB][AAAA][CCCC]
  ECB encrypted:    [xxxx][yyyy][xxxx][zzzz]  ← Identical pattern leaks!
  CBC/GCM:          [abcd][efgh][ijkl][mnop]  ← Pattern fully concealed

  Famous example: an image encrypted with ECB mode
  - The image's outlines remain visible after encryption (ECB penguin problem)
  - Encrypting with CBC/GCM produces random noise
```

### 2.4 ChaCha20-Poly1305 (Alternative to AES-GCM)

```python
# Code example 2: Encryption with ChaCha20-Poly1305
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
import os


class ChaChaEncryptor:
    """Authenticated encryption with ChaCha20-Poly1305

    WHY consider ChaCha20:
    - Faster than AES-GCM on environments without AES-NI (older CPUs, ARM, etc.)
    - Software implementations are resistant to side-channel attacks
    - A standard cipher suite in TLS 1.3 alongside AES-GCM
    - Adopted by Google in many services (especially for mobile)
    """

    NONCE_SIZE = 12  # 96 bits

    def __init__(self, key: bytes = None):
        if key is None:
            key = ChaCha20Poly1305.generate_key()
        self._cipher = ChaCha20Poly1305(key)

    def encrypt(self, plaintext: bytes,
                associated_data: bytes = None) -> bytes:
        """Encrypt"""
        nonce = os.urandom(self.NONCE_SIZE)
        ciphertext = self._cipher.encrypt(nonce, plaintext, associated_data)
        return nonce + ciphertext

    def decrypt(self, data: bytes,
                associated_data: bytes = None) -> bytes:
        """Decrypt"""
        nonce = data[:self.NONCE_SIZE]
        ciphertext = data[self.NONCE_SIZE:]
        return self._cipher.decrypt(nonce, ciphertext, associated_data)


# Usage example
chacha = ChaChaEncryptor()
encrypted = chacha.encrypt(b"Secret data for mobile app")
decrypted = chacha.decrypt(encrypted)
print(f"ChaCha20 decrypted: {decrypted}")
```

---

## 3. Asymmetric-Key Cryptography

### 3.1 Basic Concepts of Asymmetric-Key Cryptography

A scheme using a pair of public and private keys. It solves the key distribution problem, but is 100–1000 times slower than symmetric-key cryptography.

```
How asymmetric-key cryptography works:

  Encryption (Confidentiality):
  Sender                              Receiver
    |                                   |
    |  Encrypt with receiver's public key   |
    |  → Decryptable only with receiver's private key |
    |                                   |
  Digital Signatures (Authentication & Integrity):
  Sender                              Receiver
    |                                   |
    |  Sign with sender's private key   |
    |  → Verifiable with sender's public key |
    |  → Confirms sender's identity and absence of tampering |

  RSA vs ECC comparison:
  +----------+------------------+------------------+
  | Property | RSA              | ECC (Elliptic Curve)|
  +----------+------------------+------------------+
  | Math     | Hardness of      | Discrete logarithm|
  |          | factoring large  | problem on        |
  |          | prime products   | elliptic curves   |
  +----------+------------------+------------------+
  | Key size | 2048-4096 bits   | 256-384 bits      |
  | Speed    | Slow             | Fast              |
  | Key size | Large            | Small             |
  +----------+------------------+------------------+
```

### 3.2 RSA and ECDSA Implementation

```python
# Code example 3: Key generation, signing, and verification with RSA and ECDSA
from cryptography.hazmat.primitives.asymmetric import rsa, ec, padding
from cryptography.hazmat.primitives import hashes, serialization


class AsymmetricCrypto:
    """Asymmetric-key cryptographic operations

    Choosing between RSA and ECC:
    - RSA-4096: Highest compatibility, for legacy system integration
    - ECDSA P-256: Standard for new systems, TLS certificates
    - Ed25519: Latest signing algorithm, highest speed
    """

    @staticmethod
    def generate_rsa_keypair(key_size: int = 4096):
        """Generate an RSA key pair

        The public exponent 65537 (0x10001) is a standard value that
        strikes a good balance between encryption efficiency and security.
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=key_size,
        )
        return private_key, private_key.public_key()

    @staticmethod
    def generate_ec_keypair(curve=None):
        """Generate an ECC key pair

        P-256 (secp256r1): NIST-recommended, most widely supported
        P-384 (secp384r1): Higher security level
        """
        if curve is None:
            curve = ec.SECP256R1()
        private_key = ec.generate_private_key(curve)
        return private_key, private_key.public_key()

    @staticmethod
    def rsa_sign(private_key, message: bytes) -> bytes:
        """RSA-PSS signing

        WHY PSS rather than PKCS#1 v1.5:
        - PSS (Probabilistic Signature Scheme) incorporates randomness
        - Produces a different signature for the same message each time
        - Has mathematically proven security
        """
        return private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )

    @staticmethod
    def rsa_verify(public_key, message: bytes, signature: bytes) -> bool:
        """Verify an RSA-PSS signature"""
        try:
            public_key.verify(
                signature,
                message,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH,
                ),
                hashes.SHA256(),
            )
            return True
        except Exception:
            return False

    @staticmethod
    def ec_sign(private_key, message: bytes) -> bytes:
        """ECDSA signing"""
        return private_key.sign(
            message,
            ec.ECDSA(hashes.SHA256()),
        )

    @staticmethod
    def ec_verify(public_key, message: bytes, signature: bytes) -> bool:
        """Verify an ECDSA signature"""
        try:
            public_key.verify(
                signature,
                message,
                ec.ECDSA(hashes.SHA256()),
            )
            return True
        except Exception:
            return False

    @staticmethod
    def export_public_key_pem(public_key) -> str:
        """Export public key in PEM format"""
        return public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()

    @staticmethod
    def export_private_key_pem(private_key, passphrase: bytes = None) -> str:
        """Export private key in PEM format (with optional encryption)"""
        encryption = (
            serialization.BestAvailableEncryption(passphrase)
            if passphrase
            else serialization.NoEncryption()
        )
        return private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=encryption,
        ).decode()


# Usage example
crypto = AsymmetricCrypto()

# RSA signing
rsa_priv, rsa_pub = crypto.generate_rsa_keypair()
message = b"Important document"
rsa_sig = crypto.rsa_sign(rsa_priv, message)
print(f"RSA signature verification: {crypto.rsa_verify(rsa_pub, message, rsa_sig)}")  # True

# ECDSA signing
ec_priv, ec_pub = crypto.generate_ec_keypair()
ec_sig = crypto.ec_sign(ec_priv, message)
print(f"ECDSA signature verification: {crypto.ec_verify(ec_pub, message, ec_sig)}")  # True

# Export public key
pem = crypto.export_public_key_pem(ec_pub)
print(f"Public key PEM:\n{pem[:100]}...")
```

### 3.3 Comparison of Symmetric and Asymmetric Key Cryptography

| Property | Symmetric-Key | Asymmetric-Key |
|----------|--------------|----------------|
| Number of keys | 1 (shared key) | 2 (public key + private key) |
| Speed | Fast (100-1000x) | Slow |
| Key distribution | Requires secure channel | Public key can be freely shared |
| Use cases | Bulk data encryption | Key exchange, digital signatures |
| Examples | AES-256-GCM | RSA-4096, ECDSA P-256 |
| Key length | 128/256 bits | 2048/4096 bits (RSA) |
| Quantum resistance | AES-256 is safe | RSA/ECC may be broken |

---

## 4. Hash Functions

### 4.1 Properties of Hash Functions

```
Properties of hash functions:

  Input (arbitrary length)  --> Hash function --> Output (fixed length)

  "hello"                   --> SHA-256       --> 2cf24dba5fb0a30e...
  "hello!"                  --> SHA-256       --> ce06092fb948d9ff...
  (A 1-bit change causes a large change in output = Avalanche Effect)

  Required properties:
  1. One-wayness         : Cannot recover the original data from the hash value
  2. Collision resistance: Difficult to find two different inputs with the same hash
  3. Second preimage resistance: Difficult to find another input with the same hash as a given input
  4. Avalanche effect    : Small changes in input produce large changes in output

  Hash function selection:
  +-------------+----------+--------+-------------------+
  | Algorithm   | Output   | Status | Use Case          |
  +-------------+----------+--------+-------------------+
  | MD5         | 128 bits | Retired| Do not use        |
  | SHA-1       | 160 bits | Retired| Do not use (collision found) |
  | SHA-256     | 256 bits | Active | Data integrity    |
  | SHA-3       | Variable | Active | SHA-2 alternative |
  | BLAKE2      | Variable | Active | High-speed hashing|
  +-------------+----------+--------+-------------------+
```

### 4.2 Safe Usage of Hash Functions

```python
# Code example 4: Safe usage of hash functions
import hashlib
import hmac


class SecureHash:
    """Safe hash operations

    Hash functions are one-way (irreversible) functions,
    fundamentally different from encryption (reversible).
    """

    @staticmethod
    def sha256(data: bytes) -> str:
        """SHA-256 hash (for data integrity verification)

        Use for: file checksums, tamper detection
        Not for: password storage (use Argon2id instead)
        """
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def sha3_256(data: bytes) -> str:
        """SHA-3-256 hash (alternative to SHA-2)

        SHA-3 has a different mathematical structure (Keccak) from SHA-2.
        Fallback in case a vulnerability is discovered in SHA-2.
        """
        return hashlib.sha3_256(data).hexdigest()

    @staticmethod
    def file_hash(filepath: str, algorithm: str = "sha256") -> str:
        """Compute hash of a large file using streaming

        WHY streaming is necessary:
        - Loading a multi-GB file into memory at once causes OOM
        - Reading in 8KB chunks keeps memory usage constant
        """
        h = hashlib.new(algorithm)
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def constant_time_compare(a: str, b: str) -> bool:
        """Comparison that prevents timing attacks

        WHY plain == is insufficient:
        - a == b short-circuits at the first mismatched byte
        - Attackers can infer correct bytes from response time differences
        - hmac.compare_digest always compares all bytes
        """
        return hmac.compare_digest(a.encode(), b.encode())


# Usage example
sh = SecureHash()

# Integrity verification
data = b"Important document content"
hash_value = sh.sha256(data)
print(f"SHA-256: {hash_value}")

# Tamper detection
modified_data = b"Important document contenT"  # Last character changed
modified_hash = sh.sha256(modified_data)
print(f"Tamper detected: {hash_value != modified_hash}")  # True

# Safe comparison
print(f"Match: {sh.constant_time_compare(hash_value, hash_value)}")  # True
```

---

## 5. MAC (Message Authentication Code)

### 5.1 Difference Between Hash and MAC

```
Hash vs MAC:

  Hash (SHA-256):
    - Input: message only
    - Output: hash value
    - Use: anyone can compute → guarantees integrity only
    - Problem: an attacker can also recompute the hash

  MAC (HMAC-SHA256):
    - Input: message + secret key
    - Output: MAC value (authentication tag)
    - Use: only those with the key can compute → integrity + authentication
    - Advantage: attacker cannot forge without the key

  Concrete example:
    Preventing tampering of API requests
    - Hash alone: attacker modifies request and recomputes hash
    - HMAC: cannot compute the correct MAC without the secret key
```

### 5.2 HMAC Implementation

```python
# Code example 5: Message authentication with HMAC
import hmac
import hashlib
import time


class MessageAuthenticator:
    """Message authentication with HMAC

    Internal structure of HMAC:
    HMAC(K, M) = H((K ^ opad) || H((K ^ ipad) || M))
    - Double-hash structure prevents Length Extension attacks
    - Including the key directly in the hash is vulnerable to Length Extension attacks
    """

    def __init__(self, key: bytes):
        if len(key) < 32:
            raise ValueError("Key must be at least 32 bytes (256 bits)")
        self.key = key

    def create_mac(self, message: bytes) -> str:
        """Compute the MAC for a message"""
        return hmac.new(self.key, message, hashlib.sha256).hexdigest()

    def verify_mac(self, message: bytes, mac: str) -> bool:
        """Verify MAC (with timing attack protection)"""
        expected = self.create_mac(message)
        return hmac.compare_digest(expected, mac)

    def create_signed_message(self, message: bytes) -> bytes:
        """Generate a signed message with timestamp

        Use cases: temporary URLs, API tokens, CSRF tokens
        """
        timestamp = str(int(time.time())).encode()
        payload = timestamp + b"." + message
        mac = self.create_mac(payload)
        return payload + b"." + mac.encode()

    def verify_signed_message(self, signed: bytes,
                               max_age: int = 300) -> bytes:
        """Verify a signed message (with expiry check)

        Args:
            signed: Signed message
            max_age: Maximum valid duration (seconds)
        """
        parts = signed.rsplit(b".", 1)
        if len(parts) != 2:
            raise ValueError("Invalid signed message format")

        payload, mac = parts[0], parts[1].decode()
        if not self.verify_mac(payload, mac):
            raise ValueError("MAC verification failed")

        timestamp_str, message = payload.split(b".", 1)
        timestamp = int(timestamp_str)
        if time.time() - timestamp > max_age:
            raise ValueError("Message expired")

        return message


# Usage example
auth = MessageAuthenticator(b"secret-key-32-bytes-long!!!!!!!!")

# Basic MAC computation and verification
message = b"payment:100:USD"
mac_value = auth.create_mac(message)
print(f"MAC: {mac_value}")
print(f"Verify: {auth.verify_mac(message, mac_value)}")  # True
print(f"Tamper detected: {auth.verify_mac(b'payment:999:USD', mac_value)}")  # False

# Signed message with timestamp
signed = auth.create_signed_message(b"action=approve&id=123")
original = auth.verify_signed_message(signed, max_age=60)
print(f"Verified message: {original}")
```

---

## 6. Hybrid Encryption

### 6.1 Why Hybrid Encryption Is Necessary

In real-world systems, the standard approach is hybrid encryption — combining symmetric and asymmetric cryptography. This design leverages the strengths of both.

```
Hybrid encryption flow (envelope encryption):

  Sender                                    Receiver
    |                                         |
    |-- 1. Generate a random AES data key     |
    |-- 2. Encrypt message with data key (fast)|
    |-- 3. Encrypt data key with receiver's public key |
    |                                         |
    |-- [Encrypted data key] + [Encrypted data] --> |
    |                                         |
    |                  4. Decrypt data key with private key |
    |                  5. Decrypt data with data key        |

  WHY hybrid encryption is necessary:
  - Symmetric cryptography is fast but has the key distribution problem
  - Asymmetric cryptography solves key distribution but is slow
  - → Use asymmetric cryptography to securely send only the "key",
      then use symmetric cryptography to encrypt the actual data quickly
```

### 6.2 Hybrid Encryption Implementation

```python
# Code example 6: Hybrid encryption (envelope encryption)
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os


class HybridEncryption:
    """Hybrid encryption (RSA + AES-GCM)

    The same design pattern used by real protocols such as TLS, PGP, and S/MIME.
    AWS KMS envelope encryption is also based on this principle.
    """

    def __init__(self):
        self.private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=4096
        )
        self.public_key = self.private_key.public_key()

    def encrypt(self, plaintext: bytes) -> dict:
        """Hybrid encryption

        Steps:
        1. Generate a random AES key (data key)
        2. Encrypt data with the data key (AES-GCM: fast)
        3. Encrypt the data key with the RSA public key (RSA-OAEP: secure key transport)
        4. Zero out the plaintext data key from memory
        """
        # 1. Generate a random AES key
        data_key = AESGCM.generate_key(bit_length=256)

        # 2. Encrypt data with the data key
        nonce = os.urandom(12)
        aesgcm = AESGCM(data_key)
        encrypted_data = aesgcm.encrypt(nonce, plaintext, None)

        # 3. Encrypt the data key with the RSA public key
        encrypted_key = self.public_key.encrypt(
            data_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        # 4. Zero out the plaintext data key (for security)
        data_key = b"\x00" * len(data_key)

        return {
            "encrypted_key": encrypted_key,
            "nonce": nonce,
            "encrypted_data": encrypted_data,
        }

    def decrypt(self, package: dict) -> bytes:
        """Hybrid decryption"""
        # 1. Decrypt the data key with the RSA private key
        data_key = self.private_key.decrypt(
            package["encrypted_key"],
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        # 2. Decrypt data with the data key
        aesgcm = AESGCM(data_key)
        plaintext = aesgcm.decrypt(
            package["nonce"], package["encrypted_data"], None
        )

        # Zero out the data key
        data_key = b"\x00" * len(data_key)

        return plaintext


# Usage example
hybrid = HybridEncryption()
plaintext = b"Sensitive financial data: account=123456, balance=1000000"

# Encrypt
package = hybrid.encrypt(plaintext)
print(f"Encrypted data key: {len(package['encrypted_key'])} bytes")
print(f"Encrypted data: {len(package['encrypted_data'])} bytes")

# Decrypt
decrypted = hybrid.decrypt(package)
assert decrypted == plaintext
print(f"Decryption successful: {decrypted.decode()}")
```

---

## 7. Post-Quantum Cryptography (PQC)

As quantum computers advance, current RSA and ECC algorithms may be broken in the future. NIST is progressing the standardization of post-quantum cryptography.

```
Threats from quantum computers:

  Current cryptography          Impact of quantum computers
  +------------------+  +----------------------------------+
  | RSA              |  | Broken by Shor's algorithm        |
  | ECDSA / ECDH     |  | Broken by Shor's algorithm        |
  | AES-128          |  | Grover halves search space → use AES-256 |
  | AES-256          |  | Safe (equivalent to 128-bit security)   |
  | SHA-256          |  | Safe (equivalent to 128-bit security)   |
  +------------------+  +----------------------------------+

  NIST PQC standardization (announced 2024):
  - ML-KEM (CRYSTALS-Kyber): Key encapsulation mechanism
  - ML-DSA (CRYSTALS-Dilithium): Digital signatures
  - SLH-DSA (SPHINCS+): Hash-based signatures (backup)

  Recommended approach:
  1. Prepare for "Harvest Now, Decrypt Later" attacks
     → Attackers store ciphertext now and decrypt it later with a quantum computer
  2. Use AES-256 to ensure the security of symmetric cryptography
  3. Plan migration to hybrid mode (classical cryptography + PQC)
```

---

## Anti-Patterns

### Anti-Pattern 1: Inventing Custom Cryptographic Algorithms

```python
# BAD: Custom encryption algorithm (XOR cipher example)
def my_encrypt(data: bytes, key: bytes) -> bytes:
    """Custom cipher: simple XOR"""
    return bytes(a ^ b for a, b in zip(data, key * (len(data) // len(key) + 1)))

# Problems:
# - Key reuse leaks patterns
# - Cryptographic security is not proven
# - No authentication (cannot detect tampering)
# - Key can be recovered via known-plaintext attack

# GOOD: Use a standard algorithm
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = AESGCM.generate_key(bit_length=256)
aesgcm = AESGCM(key)
nonce = os.urandom(12)
ciphertext = aesgcm.encrypt(nonce, data, None)
```

**Why it is dangerous**: Cryptographic security is proven through decades of academic scrutiny; custom implementations are extremely likely to contain unknown vulnerabilities. **"Don't roll your own crypto"** is the iron rule of the cryptography field.

### Anti-Pattern 2: Using ECB Mode

```python
# BAD: AES-ECB mode
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
cipher = Cipher(algorithms.AES(key), modes.ECB())
# → Identical plaintext block = identical ciphertext block → pattern leakage

# GOOD: AES-GCM (authenticated encryption mode)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
aesgcm = AESGCM(key)
ciphertext = aesgcm.encrypt(nonce, plaintext, aad)
# → Pattern concealed + tamper detection
```

**Why it is dangerous**: ECB mode encrypts each block independently, so identical plaintext blocks map to identical ciphertext blocks, leaking data patterns.

### Anti-Pattern 3: Nonce/IV Reuse

```python
# BAD: Using a fixed nonce
nonce = b"\x00" * 12  # Fixed nonce
for message in messages:
    ciphertext = aesgcm.encrypt(nonce, message, None)  # Same nonce reused

# GOOD: Generate a fresh random nonce each time
import os
for message in messages:
    nonce = os.urandom(12)  # New nonce each time
    ciphertext = aesgcm.encrypt(nonce, message, None)
```

**Why it is dangerous**: Encrypting two messages with the same key and the same nonce in AES-GCM leaks the authentication key and enables ciphertext forgery (Forbidden Attack).

### Anti-Pattern 4: Encryption Without Authentication

```python
# BAD: Encryption only with CBC mode (no authentication)
cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
encryptor = cipher.encryptor()
ciphertext = encryptor.update(plaintext) + encryptor.finalize()
# → Cannot detect ciphertext tampering (risk of Padding Oracle Attack)

# GOOD: GCM (authenticated encryption)
aesgcm = AESGCM(key)
ciphertext = aesgcm.encrypt(nonce, plaintext, None)
# → An exception is raised if the ciphertext is tampered with during decryption
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured settings file | Check the path and format of the settings file |
| Timeout | Network latency / insufficient resources | Adjust timeout value; add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing; implement pagination |
| Permission error | Insufficient access rights | Verify execution user permissions; review settings |
| Data inconsistency | Race condition in concurrent processing | Introduce locking mechanisms; manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproducibility**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Incremental verification**: Use logging or a debugger to test hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

```python
# Debug utility
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
    """Decorator that logs function inputs and outputs"""
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Review disk and network I/O status
4. **Check concurrent connection count**: Review connection pool state

| Issue Type | Diagnostic Tool | Mitigation |
|-----------|----------------|------------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology decisions.

| Criterion | When to prioritize | When it can be relaxed |
|----------|--------------------|------------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → go to ②              │
│                                                 │
│  ② How frequent are deployments?                │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily / multiple times → go to ③          │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified tech stack reduces learning costs
- Adopting diverse technologies enables the right tool for the job, but increases operational overhead

**3. Level of abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is more intuitive but tends to produce code duplication

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
        """Describe background and problem"""
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
        md += f"## Context\n{self.context}\n\n"
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
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't over-optimize (YAGNI principle)
- Get user feedback as early as possible
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally updating a system that has been in operation for over 10 years

**Approach:**
- Use the Strangler Fig pattern for gradual migration
- Create Characterization Tests first when existing tests are absent
- Use an API gateway to coexist old and new systems
- Perform data migration incrementally

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Analysis | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate central features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Use Domain-Driven Design to clearly define boundaries
- Assign ownership per team
- Manage shared libraries via InnerSource
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
    """Inter-team API contract"""
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

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Applicable When |
|------------------------|--------|---------------------|-----------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-bound operations |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound operations |
---

## FAQ

### Q1: Should I use AES-128 or AES-256?

AES-256 is generally recommended. AES-128 is also sufficiently secure at present and is practically unbreakable. However, considering the advent of quantum computers, AES-256 provides a longer security margin (even if Grover's algorithm halves the search space, 128-bit security is maintained). The performance difference is negligible on AES-NI-capable CPUs, so choose AES-256 unless there is a specific reason not to.

### Q2: Can a hash function be used in place of encryption?

No. Hash functions are one-way; the original data cannot be recovered from the hash value. They are appropriate for data integrity verification and password storage, but encryption must be used when decryption is required. Conversely, encryption cannot replace hashing (passwords should be stored using hashing, not encryption).

### Q3: What RSA key length is needed?

2048 bits is the minimum; 4096 bits is recommended. However, ECDSA with the P-256 curve offers equivalent security to RSA-3072 with a smaller key size and faster processing, so new systems should consider adopting ECDSA. Given quantum computer threats, migration to PQC will eventually be necessary.

### Q4: Why must "encryption" and "hashing" be used differently?

Because they serve different purposes. Encryption is a reversible process that assumes the ability to "recover (decrypt)" the original; it is used for concealing communications and protecting data. Hashing is an irreversible process that assumes the data will "not be recovered"; it is used for password storage and data integrity verification. Storing passwords with encryption means all passwords can be recovered if the encryption key leaks, making hashing the correct choice.

### Q5: What happens if a nonce is duplicated in GCM mode?

Encrypting two different messages with the same key and the same nonce causes the following problems:
1. XOR-ing the two ciphertexts yields the XOR of the plaintexts
2. The authentication key (GHASH key) is leaked, enabling forgery of authentication tags
This is called the "Forbidden Attack". With a 96-bit random nonce, encryption is safe for approximately 2^32 (about 4.3 billion) encryptions per key (the birthday problem threshold). Beyond that, rotate the key.

---

## Practice Exercises

### Exercise 1 (Basic): Implement a File Encryption Tool

Implement a tool that encrypts and decrypts files using AES-256-GCM.

**Requirements**:
- Derive an encryption key from a password (using PBKDF2 or Argon2)
- Generate a random salt and include it in the ciphertext
- Encrypted file format: salt(16B) + nonce(12B) + ciphertext + tag(16B)

<details>
<summary>Reference answer</summary>

```python
import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


class FileEncryptor:
    """Password-based file encryption tool"""

    SALT_SIZE = 16
    NONCE_SIZE = 12
    KEY_SIZE = 32  # AES-256
    ITERATIONS = 600000  # OWASP recommended value (2024)

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """Derive an encryption key from a password"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.KEY_SIZE,
            salt=salt,
            iterations=self.ITERATIONS,
        )
        return kdf.derive(password.encode())

    def encrypt_file(self, input_path: str, output_path: str,
                     password: str) -> None:
        """Encrypt a file"""
        # Generate salt and nonce
        salt = os.urandom(self.SALT_SIZE)
        nonce = os.urandom(self.NONCE_SIZE)

        # Derive key from password
        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)

        # Read and encrypt file
        with open(input_path, "rb") as f:
            plaintext = f.read()

        ciphertext = aesgcm.encrypt(nonce, plaintext, None)

        # Write salt + nonce + ciphertext
        with open(output_path, "wb") as f:
            f.write(salt + nonce + ciphertext)

        print(f"Encryption complete: {output_path}")

    def decrypt_file(self, input_path: str, output_path: str,
                     password: str) -> None:
        """Decrypt a file"""
        with open(input_path, "rb") as f:
            data = f.read()

        # Separate salt and nonce
        salt = data[:self.SALT_SIZE]
        nonce = data[self.SALT_SIZE:self.SALT_SIZE + self.NONCE_SIZE]
        ciphertext = data[self.SALT_SIZE + self.NONCE_SIZE:]

        # Derive key from password
        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)

        # Decrypt
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)

        with open(output_path, "wb") as f:
            f.write(plaintext)

        print(f"Decryption complete: {output_path}")


# Usage example
encryptor = FileEncryptor()
# encryptor.encrypt_file("secret.txt", "secret.enc", "MyPassword123!")
# encryptor.decrypt_file("secret.enc", "secret_decrypted.txt", "MyPassword123!")
```

</details>

### Exercise 2 (Applied): Document Verification System Using Digital Signatures

Implement a system for signing and verifying documents using ECDSA.

**Requirements**:
- Generate a key pair and save/load it in PEM format
- Sign a document (byte sequence)
- Verify the signature
- Create a signed document package (bundle of document + signature + public key)

<details>
<summary>Reference answer</summary>

```python
import json
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization


class DocumentSigner:
    """Digital signature system using ECDSA"""

    def __init__(self):
        self.private_key = ec.generate_private_key(ec.SECP256R1())
        self.public_key = self.private_key.public_key()

    def sign(self, document: bytes) -> bytes:
        """Sign a document"""
        return self.private_key.sign(document, ec.ECDSA(hashes.SHA256()))

    @staticmethod
    def verify(public_key, document: bytes, signature: bytes) -> bool:
        """Verify a signature"""
        try:
            public_key.verify(signature, document, ec.ECDSA(hashes.SHA256()))
            return True
        except Exception:
            return False

    def create_signed_package(self, document: bytes) -> str:
        """Create a signed document package in JSON format"""
        signature = self.sign(document)
        pub_pem = self.public_key.public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return json.dumps({
            "document": base64.b64encode(document).decode(),
            "signature": base64.b64encode(signature).decode(),
            "public_key": pub_pem.decode(),
            "algorithm": "ECDSA-P256-SHA256",
        })

    @staticmethod
    def verify_package(package_json: str) -> dict:
        """Verify a signed package"""
        package = json.loads(package_json)
        document = base64.b64decode(package["document"])
        signature = base64.b64decode(package["signature"])
        public_key = serialization.load_pem_public_key(
            package["public_key"].encode()
        )

        is_valid = DocumentSigner.verify(public_key, document, signature)
        return {
            "valid": is_valid,
            "document": document if is_valid else None,
        }


# Test
signer = DocumentSigner()
doc = b"Contract: Party A agrees to pay Party B $1000"

# Create and verify signed package
package = signer.create_signed_package(doc)
result = DocumentSigner.verify_package(package)
print(f"Signature verification: {result['valid']}")  # True
print(f"Document: {result['document'].decode()}")
```

</details>

### Exercise 3 (Advanced): Implement a Key Exchange Protocol

Implement ECDH (Elliptic Curve Diffie-Hellman) key exchange and design a protocol for two parties to securely establish a shared key.

**Requirements**:
- Key exchange via ECDH
- Derive an AES key from the derived shared secret (using HKDF)
- Encrypted AES-GCM communication using the derived key
- Achieve Perfect Forward Secrecy

<details>
<summary>Reference answer</summary>

```python
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os


class SecureChannel:
    """Secure communication channel using ECDH key exchange + AES-GCM

    Forward secrecy: A new ephemeral key pair is generated per session,
    so past communications cannot be decrypted even if the long-term private key is leaked.
    """

    def __init__(self):
        # Generate ephemeral key pair
        self._private_key = ec.generate_private_key(ec.SECP256R1())
        self.public_key = self._private_key.public_key()
        self._shared_key = None

    def derive_shared_key(self, peer_public_key) -> None:
        """Derive a shared secret from the peer's public key"""
        # Compute shared secret via ECDH
        shared_secret = self._private_key.exchange(
            ec.ECDH(), peer_public_key
        )
        # Derive AES key via HKDF
        self._shared_key = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"secure-channel-v1",
        ).derive(shared_secret)

    def encrypt(self, plaintext: bytes) -> bytes:
        """Encrypt with the shared key"""
        if not self._shared_key:
            raise RuntimeError("Key exchange has not been completed")
        nonce = os.urandom(12)
        aesgcm = AESGCM(self._shared_key)
        return nonce + aesgcm.encrypt(nonce, plaintext, None)

    def decrypt(self, data: bytes) -> bytes:
        """Decrypt with the shared key"""
        if not self._shared_key:
            raise RuntimeError("Key exchange has not been completed")
        nonce = data[:12]
        ciphertext = data[12:]
        aesgcm = AESGCM(self._shared_key)
        return aesgcm.decrypt(nonce, ciphertext, None)


# Usage example: Secure communication between Alice and Bob
alice = SecureChannel()
bob = SecureChannel()

# Exchange public keys (safe over an insecure channel)
alice.derive_shared_key(bob.public_key)
bob.derive_shared_key(alice.public_key)

# Alice → Bob
message = b"Hello Bob, this is a secure message!"
encrypted = alice.encrypt(message)
decrypted = bob.decrypt(encrypted)
print(f"Bob received: {decrypted.decode()}")

# Bob → Alice
reply = b"Hi Alice, received your message!"
encrypted_reply = bob.encrypt(reply)
decrypted_reply = alice.decrypt(encrypted_reply)
print(f"Alice received: {decrypted_reply.decode()}")
```

</details>

---

## Summary

| Technique | Use Case | Recommended Algorithm | Key Length |
|-----------|----------|-----------------------|------------|
| Symmetric-key cryptography | Data encryption | AES-256-GCM / ChaCha20-Poly1305 | 256 bits |
| Asymmetric-key cryptography | Key exchange, digital signatures | ECDSA P-256, RSA-4096 | 256 bits / 4096 bits |
| Hash functions | Integrity verification | SHA-256, SHA-3 | - |
| MAC | Message authentication | HMAC-SHA256 | 256 bits |
| Password hashing | Password storage | Argon2id, bcrypt | - |
| Key exchange | Establishing a shared key | ECDH (X25519, P-256) | 256 bits |
| Hybrid encryption | Secure encryption of bulk data | RSA-OAEP + AES-GCM | - |

---

## Recommended Next Reading

- [TLS/Certificates](./01-tls-certificates.md) -- TLS handshake and certificate management
- [Key Management](./02-key-management.md) -- Key lifecycle and management techniques
- [Authentication Vulnerabilities](../01-web-security/04-auth-vulnerabilities.md) -- Practical password hashing
- [Network Security Basics](../03-network-security/00-network-security-basics.md) -- Upper layers of encrypted communication
- Password Security -- Details on password hashing

---

## References

1. **NIST SP 800-175B: Guideline for Using Cryptographic Standards** -- https://csrc.nist.gov/publications/detail/sp/800-175b/rev-1/final
2. **Christof Paar & Jan Pelzl, "Understanding Cryptography"** -- Springer (a premier cryptography textbook)
3. **OWASP Cryptographic Storage Cheat Sheet** -- https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
4. **NIST Post-Quantum Cryptography Standards** -- https://csrc.nist.gov/projects/post-quantum-cryptography
5. **Dan Boneh & Victor Shoup, "A Graduate Course in Applied Cryptography"** -- https://toc.cryptobook.us/ (definitive free cryptography text)
6. **RFC 5116: An Interface and Algorithms for Authenticated Encryption** -- https://datatracker.ietf.org/doc/html/rfc5116
