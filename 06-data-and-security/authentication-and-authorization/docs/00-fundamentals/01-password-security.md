# Password Security

> Passwords are the most widely used authentication method, but also the most vulnerable to attack. This guide covers all best practices for password management: hashing with bcrypt/Argon2, secure password policies, breach detection, and password reset flows. Based on NIST SP 800-63B and the OWASP Password Storage Cheat Sheet, it spans from understanding internal algorithm mechanics to practical security measures for production systems.

## Prerequisites

- Basic concepts of hash functions (one-wayness, collision resistance)
- Differences between symmetric and asymmetric encryption
- Basics of HTTP request/response
- Basics of database operations

## What You Will Learn

- [ ] Understand how password hashing works and how to choose the right algorithm
- [ ] Understand the internal workings of bcrypt and Argon2id
- [ ] Be able to design a secure password policy
- [ ] Implement password reset and account recovery securely
- [ ] Learn defenses against brute-force attacks and credential stuffing
- [ ] Understand password migration strategies

---

## 1. Fundamentals of Password Hashing

```
Why hashing is necessary:

  Risks of storing plaintext:
    DB breach → All user passwords immediately exposed
    Insider threat → Developers can view passwords
    Log leakage → Passwords recorded in log files
    Backups → Readable from backup files

  Role of hashing:
    Password → Hash function → Hash value (irreversible)
    "password123" → bcrypt → "$2b$12$LJ3m4ys..."
    Cannot recover the password from the hash value

Hashing vs Encryption:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Hashing (one-way function):                     │
  │  → Input → Hash value (irreversible)             │
  │  → Used for storing passwords                    │
  │  → Same input → always same output               │
  │  → Examples: bcrypt, Argon2, SHA-256             │
  │                                                  │
  │  Encryption (two-way function):                  │
  │  → Plaintext → Ciphertext (decryptable)          │
  │  → Used for protecting data (not for passwords)  │
  │  → Recoverable with a key                        │
  │  → Examples: AES, ChaCha20                       │
  │                                                  │
  └──────────────────────────────────────────────────┘

  ✗ AES encryption → Inappropriate because it can be decrypted with the key
  ✗ MD5 / SHA-256 → Too fast, vulnerable to brute-force
  ✓ bcrypt / Argon2 → Intentionally slow, purpose-built hashing
```

### 1.1 The Importance of Salts

```
How salts work:

  Without salt:
    "password" → SHA-256 → "5e884..."  (same for all users)
    → Can be cracked in bulk with rainbow tables

  With salt:
    "password" + "a3f8e2..." → SHA-256 → "8b2c1..."
    "password" + "7d4b9c..." → SHA-256 → "f1e3a..."
    → Different hash value for each user
    → Renders rainbow table attacks ineffective

  Salt requirements:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  ① Generated with a cryptographically secure RNG │
  │     → crypto.randomBytes(16) or more             │
  │     → Math.random() is not allowed               │
  │                                                  │
  │  ② Unique per user                               │
  │     → Different hash even for the same password  │
  │                                                  │
  │  ③ Stored alongside the hash value               │
  │     → bcrypt automatically embeds salt in hash   │
  │     → No manual management required              │
  │                                                  │
  │  ④ Sufficient length (16 bytes / 128 bits or more)│
  │     → Larger salt space makes rainbow tables harder│
  │                                                  │
  └──────────────────────────────────────────────────┘

  bcrypt / Argon2 auto-generate and embed salts → no manual management needed
```

### 1.2 Pepper (Secret Salt)

```
The pepper concept:

  Salt: Stored in the DB alongside the hash (public information)
  Pepper: A secret value stored outside the DB (secret information)

  Purpose:
  → A DB breach alone is not enough to attack the hashes
  → Offline attacks are impossible without also obtaining the pepper

  Implementation patterns:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Method 1: HMAC wrapping                         │
  │  hash = bcrypt(HMAC-SHA256(pepper, password))    │
  │  → Pepper stored in environment variable or HSM/KMS│
  │                                                  │
  │  Method 2: Encryption wrapping                   │
  │  stored = AES-256-GCM(key, bcrypt(password))     │
  │  → Encrypt the hash value before storing         │
  │  → Easy key rotation                             │
  │                                                  │
  └──────────────────────────────────────────────────┘

  Recommended: Method 2 (encryption wrapping)
  → No need to reset passwords when updating the pepper
  → Key rotation = just re-encrypt
```

```typescript
// Pepper (encryption wrapping) implementation
import crypto from 'crypto';
import argon2 from 'argon2';

const PEPPER_KEY = Buffer.from(process.env.PEPPER_KEY!, 'hex'); // 32 bytes

// Password hash + pepper encryption
async function hashPasswordWithPepper(password: string): Promise<string> {
  // Step 1: Hash with Argon2id
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Step 2: Encrypt with AES-256-GCM
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', PEPPER_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(hash, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate iv + authTag + encrypted and return
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// Password verification
async function verifyPasswordWithPepper(
  password: string,
  stored: string
): Promise<boolean> {
  const data = Buffer.from(stored, 'base64');

  // Split: iv(16) + authTag(16) + encrypted(remainder)
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  // Step 1: Decrypt with AES-256-GCM
  const decipher = crypto.createDecipheriv('aes-256-gcm', PEPPER_KEY, iv);
  decipher.setAuthTag(authTag);
  const hash = decipher.update(encrypted) + decipher.final('utf8');

  // Step 2: Verify with Argon2
  return argon2.verify(hash, password);
}
```

---

## 2. Recommended Algorithms

```
Algorithm comparison:

  Algorithm  │ Recommendation │ Characteristics               │ GPU Resistance
  ───────────┼────────────────┼───────────────────────────────┼───────────────
  Argon2id   │ ◎ Best         │ Memory-hard, strongest GPU resistance │ ◎
  bcrypt     │ ○ Good         │ Proven track record, wide support     │ ○
  scrypt     │ ○ Good         │ Memory-hard                           │ ○
  PBKDF2     │ △ Acceptable   │ Only when FIPS compliance is required │ △
  SHA-256    │ ✗ Not allowed  │ Too fast                              │ ✗
  MD5        │ ✗ Not allowed  │ Fast + collision vulnerabilities      │ ✗

Recommendations:
  New projects → Argon2id
  Existing projects → bcrypt (sufficiently secure)
  FIPS compliance required → PBKDF2 (HMAC-SHA256, 600,000+ iterations)
```

### 2.1 Internal Workings of bcrypt

```
bcrypt structure:

  Hash value format:
  $2b$12$LJ3m4ys3Gk8v0f2xKb2I4OXYiDkG0...
  │  │ │  └──────────────────────────────── Hash + salt
  │  │ └─── Cost factor (2^12 = 4096 iterations)
  │  └───── Version (2b is latest)
  └──────── Algorithm identifier

  Internal algorithm:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  bcrypt(password, cost, salt):                   │
  │                                                  │
  │  ① state = EksBlowfishSetup(cost, salt, password)│
  │                                                  │
  │  ② ctext = "OrpheanBeholderScryDoubt"            │
  │     → Fixed 24-byte magic string                 │
  │                                                  │
  │  ③ for i = 0 to 63:                              │
  │       ctext = EncryptECB(state, ctext)            │
  │     → Repeat Blowfish ECB encryption 64 times    │
  │                                                  │
  │  ④ return concat(cost, salt, ctext)              │
  │                                                  │
  │  EksBlowfishSetup:                               │
  │  → Repeat Blowfish key schedule 2^cost times     │
  │  → When cost=12: 2^12 = 4,096 iterations         │
  │  → Each iteration alternates password and salt   │
  │  → This is the source of "intentional slowness"  │
  │                                                  │
  └──────────────────────────────────────────────────┘

  bcrypt limitations:
  → Password length: max 72 bytes (excess is ignored)
  → For multi-byte characters, long text can be truncated
  → Workaround: SHA-256 pre-hashing
    bcrypt(SHA256(password).base64())
```

```typescript
// bcrypt implementation
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Cost factor (2^12 = 4096 iterations)

// Hash a password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify a password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Usage example
const hash = await hashPassword('mySecurePassword123!');
// "$2b$12$LJ3m4ys3Gk8v0f2xKb2I4O..."

const isValid = await verifyPassword('mySecurePassword123!', hash);
// true

// Pre-hashing for bcrypt's 72-byte limit
import crypto from 'crypto';

async function hashLongPassword(password: string): Promise<string> {
  // Pre-hash with SHA-256 (Base64 output is 44 chars, within 72 bytes)
  const preHash = crypto.createHash('sha256').update(password).digest('base64');
  return bcrypt.hash(preHash, SALT_ROUNDS);
}

async function verifyLongPassword(password: string, hash: string): Promise<boolean> {
  const preHash = crypto.createHash('sha256').update(password).digest('base64');
  return bcrypt.compare(preHash, hash);
}
```

### 2.2 Internal Workings of Argon2id

```
Three Argon2 variants:

  Argon2d: Vulnerable to side-channel attacks, but strongest against GPU attacks
  Argon2i: Resistant to side-channel attacks, but slightly lower GPU resistance
  Argon2id: Hybrid of Argon2d + Argon2i (recommended)

Internal workings of Argon2id:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Parameters:                                     │
  │  → memoryCost (m): Amount of memory used (KB)   │
  │  → timeCost (t): Number of iterations           │
  │  → parallelism (p): Number of parallel lanes    │
  │  → saltLength: Salt length (16 bytes recommended)│
  │  → hashLength: Output hash length (32 bytes rec.)│
  │                                                  │
  │  Algorithm:                                      │
  │  ① Allocate m KB of memory                      │
  │  ② Divide memory into p lanes                   │
  │  ③ Fill memory independently in each lane       │
  │  ④ Execute t passes:                            │
  │     → First pass: Argon2i mode                  │
  │       (data-independent access → side-channel   │
  │        resistance)                              │
  │     → Second pass onward: Argon2d mode          │
  │       (data-dependent access → GPU resistance)  │
  │  ⑤ XOR the final block of each lane for output  │
  │                                                  │
  │  Why memory-hardness matters:                    │
  │  → GPUs are fast to compute but have limited RAM │
  │  → Requiring 64MB of memory → drastically reduces│
  │    GPU parallelism                              │
  │  → Also greatly increases cost of ASIC attacks  │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

```typescript
// Argon2 implementation (recommended)
import argon2 from 'argon2';

// Argon2id (recommended variant)
async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,  // Argon2id: protects against both side-channel + GPU
    memoryCost: 65536,       // 64MB memory usage
    timeCost: 3,             // 3 iterations
    parallelism: 4,          // 4 parallel lanes
    saltLength: 16,          // 16-byte salt
    hashLength: 32,          // 32-byte hash output
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Example hash output:
// "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$..."
// ↑ Algorithm, parameters, salt, and hash are all included

// Check if a hash needs rehashing when parameters change
async function needsRehash(hash: string): Promise<boolean> {
  return argon2.needsRehash(hash, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

// Transparent rehashing at login
async function loginWithRehash(
  password: string,
  storedHash: string,
  userId: string
): Promise<boolean> {
  const isValid = await argon2.verify(storedHash, password);

  if (isValid && await needsRehash(storedHash)) {
    // If parameters are outdated, rehash with new parameters
    const newHash = await hashPassword(password);
    await db.user.update({
      where: { id: userId },
      data: { password: newHash },
    });
    console.log(`Rehashed password for user ${userId}`);
  }

  return isValid;
}
```

### 2.3 Choosing a Cost Factor

```
Cost factor selection guidelines:

  bcrypt:
    Target: 250ms–1 second per hash
    cost=10: ~100ms (minimum)
    cost=12: ~300ms (recommended)
    cost=14: ~1s (high security)

  Argon2id:
    OWASP recommended (2024):
    → memoryCost: 19456 (19MB) or more
    → timeCost: 2 or more
    → parallelism: 1

    High security:
    → memoryCost: 65536 (64MB)
    → timeCost: 3
    → parallelism: 4

    Highest security (when resources allow):
    → memoryCost: 131072 (128MB)
    → timeCost: 4
    → parallelism: 4

  Tuning method:
    → Measure on actual server
    → Adjust to acceptable login latency
    → 250ms–1 second is a typical target
    → Periodically review parameters (keep up with hardware advances)

  Impact on server resources:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Concurrent logins × hash computation time       │
  │  → 100 req/s × 300ms = 30 CPU cores worth        │
  │                                                  │
  │  Mitigations:                                    │
  │  → Run hash computation in worker threads        │
  │  → Limit concurrency (Semaphore)                 │
  │  → Queue requests during sudden spikes           │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

```typescript
// Benchmarking hash parameters
async function benchmarkHashParameters() {
  const password = 'test-password-for-benchmarking';

  // bcrypt benchmark
  for (const cost of [10, 11, 12, 13, 14]) {
    const start = performance.now();
    await bcrypt.hash(password, cost);
    const duration = performance.now() - start;
    console.log(`bcrypt cost=${cost}: ${duration.toFixed(0)}ms`);
  }

  // Argon2id benchmark
  const configs = [
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    { memoryCost: 47104, timeCost: 1, parallelism: 1 },
    { memoryCost: 65536, timeCost: 3, parallelism: 4 },
    { memoryCost: 131072, timeCost: 4, parallelism: 4 },
  ];

  for (const config of configs) {
    const start = performance.now();
    await argon2.hash(password, { type: argon2.argon2id, ...config });
    const duration = performance.now() - start;
    console.log(
      `argon2id m=${config.memoryCost} t=${config.timeCost} p=${config.parallelism}: ${duration.toFixed(0)}ms`
    );
  }
}

// Concurrency control for hash computation
class HashService {
  private semaphore: number = 0;
  private readonly maxConcurrent: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  async hash(password: string): Promise<string> {
    await this.acquire();
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    } finally {
      this.release();
    }
  }

  async verify(password: string, hash: string): Promise<boolean> {
    await this.acquire();
    try {
      return await argon2.verify(hash, password);
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.semaphore < this.maxConcurrent) {
      this.semaphore++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    this.semaphore--;
    if (this.queue.length > 0) {
      this.semaphore++;
      const next = this.queue.shift()!;
      next();
    }
  }
}
```

---

## 3. Password Policy

```
NIST SP 800-63B (2020) recommendations:

  ✓ Recommended:
    → Minimum 8 characters (15+ characters preferred)
    → Allow 64 characters or more as maximum
    → Allow all Unicode characters
    → Check against breached password lists
    → Show a password strength meter
    → Allow paste (for password manager support)

  ✗ Not recommended (outdated practices deprecated by NIST):
    → Requiring uppercase, lowercase, digits, and symbols (✗ deprecated)
    → Forcing periodic password changes (✗ deprecated)
    → Security questions (✗ deprecated)
    → Password hints (✗ deprecated)
    → Similarity checks with previous passwords (✗ excessive ones deprecated)

  Rationale:
    → Complexity rules → Users make predictable substitutions like "P@ssw0rd!"
    → Periodic changes → Increments like "password1", "password2"...
    → Length emphasis → Long passphrases like "correct horse battery staple" are strong

Password strength and entropy:

  ┌───────────────────────────────┬──────────────┬──────────────────┐
  │ Password example              │ Entropy      │ Offline attack   │
  ├───────────────────────────────┼──────────────┼──────────────────┤
  │ "password"                    │ ~0 bit       │ Instant          │
  │ "P@ssw0rd!"                   │ ~15 bit      │ Seconds          │
  │ "7kX#mP2q"                    │ ~50 bit      │ Hours            │
  │ "correct horse battery staple"│ ~44 bit      │ Days             │
  │ "dWp8#kL2$mN9xQ4@"           │ ~95 bit      │ Billions of years │
  │ Random 20 chars (all types)   │ ~130 bit     │ Beyond universe  │
  └───────────────────────────────┴──────────────┴──────────────────┘

  * Offline attack assumes bcrypt cost=12
```

```typescript
// Modern password validation
import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer')
  .refine(
    (password) => !isCommonPassword(password),
    'This password is too commonly used and is not secure'
  )
  .refine(
    async (password) => !(await isBreachedPassword(password)),
    'This password has been found in a previous data breach'
  );

// Check via Have I Been Pwned API (k-Anonymity model)
async function isBreachedPassword(password: string): Promise<boolean> {
  const hash = await sha1(password);
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5).toUpperCase();

  // k-Anonymity: only send the first 5 characters of the hash
  // → does not leak password information to the server
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' }, // Prevent timing attacks
  });
  const text = await res.text();

  // Response example:
  // "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3"
  // → suffix: matching hash, count: number of breaches
  return text.split('\n').some((line) => {
    const [hashSuffix] = line.split(':');
    return hashSuffix === suffix;
  });
}

// SHA-1 hash (for HIBP API)
async function sha1(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Common password list (top 100,000)
const commonPasswordSet = new Set<string>();
// Load from file at startup
function isCommonPassword(password: string): boolean {
  return commonPasswordSet.has(password.toLowerCase());
}

// Context-aware check
function containsUserInfo(password: string, userInfo: {
  email: string;
  name?: string;
  username?: string;
}): boolean {
  const lowerPassword = password.toLowerCase();
  const checks = [
    userInfo.email.split('@')[0],
    userInfo.name,
    userInfo.username,
  ].filter(Boolean).map((s) => s!.toLowerCase());

  return checks.some((info) => lowerPassword.includes(info));
}
```

### 3.1 Password Strength Meter

```typescript
// Password strength meter (zxcvbn)
import zxcvbn from 'zxcvbn';

function checkPasswordStrength(password: string, userInputs: string[] = []) {
  const result = zxcvbn(password, userInputs);

  return {
    score: result.score,           // 0-4 (0=weakest, 4=strongest)
    crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    feedback: result.feedback,     // Improvement suggestions
    warning: result.feedback.warning,
    guesses: result.guesses,       // Estimated number of guesses
    guessesLog10: result.guesses_log10,
  };
}

// Example results:
// "password" → score: 0, crackTime: "less than a second"
// "correcthorsebatterystaple" → score: 4, crackTime: "centuries"

// React component
function PasswordStrengthMeter({ password, email }: {
  password: string;
  email: string;
}) {
  const { score, feedback, crackTime } = checkPasswordStrength(
    password,
    [email.split('@')[0]] // Penalize user-specific inputs
  );

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  if (!password) return null;

  return (
    <div className="mt-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor: i <= score ? colors[score] : '#e5e7eb',
            }}
          />
        ))}
      </div>

      {/* Label and estimated crack time */}
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: colors[score] }}>
          {labels[score]}
        </span>
        <span className="text-xs text-gray-500">
          Estimated crack time: {crackTime}
        </span>
      </div>

      {/* Feedback */}
      {feedback.warning && (
        <p className="text-xs text-amber-600 mt-1">{feedback.warning}</p>
      )}
      {feedback.suggestions.map((suggestion: string, i: number) => (
        <p key={i} className="text-xs text-gray-500 mt-0.5">{suggestion}</p>
      ))}
    </div>
  );
}
```

---

## 4. Brute-Force Defense

```
Attack types and countermeasures:

  ① Online brute-force:
     → Repeated attempts against the login endpoint
     → Countermeasures: rate limiting, account lockout

  ② Offline brute-force:
     → Attacking hashes after a DB breach
     → Countermeasures: strong hash algorithm (Argon2id)

  ③ Credential stuffing:
     → Reusing credentials leaked from other services
     → Countermeasures: breach checking (HIBP), MFA

  ④ Password spraying:
     → Trying a small number of common passwords against many accounts
     → Countermeasures: ban commonly used passwords, IP-based restrictions

Attack speed comparison (assuming GPU cluster):

  Algorithm        │ Attempts / second │ Cracking 8-char random password
  ─────────────────┼───────────────────┼─────────────────────────────────
  MD5              │ ~30 billion       │ Seconds
  SHA-256          │ ~3 billion        │ Minutes
  bcrypt (12)      │ ~100,000          │ Decades
  Argon2id (64MB)  │ ~1,000            │ Hundreds of millions of years
```

```typescript
// Rate limiting implementation (Redis-based)
class LoginRateLimiter {
  constructor(private redis: Redis) {}

  // IP-based limit
  async checkIPLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = `login:ip:${ip}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, 900); // 15 minutes
    }

    if (attempts > 100) { // 100 attempts per IP per 15 minutes
      const ttl = await this.redis.ttl(key);
      return { allowed: false, retryAfter: ttl };
    }

    return { allowed: true };
  }

  // Account-based limit
  async checkAccountLimit(email: string): Promise<{
    allowed: boolean;
    retryAfter?: number;
    remainingAttempts?: number;
  }> {
    const key = `login:account:${email.toLowerCase()}`;
    const attempts = await this.redis.incr(key);

    if (attempts === 1) {
      await this.redis.expire(key, 3600); // 1 hour
    }

    const maxAttempts = 10;

    if (attempts > maxAttempts) {
      const ttl = await this.redis.ttl(key);
      // Progressive lockout: longer lock the more failures occur
      const lockoutTime = Math.min(
        Math.pow(2, attempts - maxAttempts) * 60, // Exponential backoff
        3600 // Max 1 hour
      );
      await this.redis.expire(key, lockoutTime);

      return {
        allowed: false,
        retryAfter: lockoutTime,
        remainingAttempts: 0,
      };
    }

    return {
      allowed: true,
      remainingAttempts: maxAttempts - attempts,
    };
  }

  // Reset counter on successful login
  async onLoginSuccess(email: string): Promise<void> {
    await this.redis.del(`login:account:${email.toLowerCase()}`);
  }
}

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip!;

  // Check IP limit
  const ipCheck = await rateLimiter.checkIPLimit(ip);
  if (!ipCheck.allowed) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: ipCheck.retryAfter,
    });
  }

  // Check account limit
  const accountCheck = await rateLimiter.checkAccountLimit(email);
  if (!accountCheck.allowed) {
    return res.status(429).json({
      error: 'Account temporarily locked',
      retryAfter: accountCheck.retryAfter,
    });
  }

  // Authentication
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  // Timing attack prevention: always compute hash even if user doesn't exist
  if (!user) {
    await argon2.hash('dummy-password-for-timing', {
      type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4,
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isValid = await loginWithRehash(password, user.password, user.id);

  if (!isValid) {
    return res.status(401).json({
      error: 'Invalid email or password',
      remainingAttempts: accountCheck.remainingAttempts,
    });
  }

  // Login successful
  await rateLimiter.onLoginSuccess(email);

  // Anomaly detection: login from new IP / device
  await notifyUnusualLogin(user, req);

  const tokens = await issueTokens(user);
  res.json(tokens);
});
```

---

## 5. Password Reset

```
Secure password reset flow:

  User          Frontend          Backend              Mail Server
    │               │                 │                   │
    │ Reset request │                 │                   │
    │──────────────>│                 │                   │
    │               │ POST /reset     │                   │
    │               │────────────────>│                   │
    │               │                 │ Generate token    │
    │               │                 │ (random, with expiry)
    │               │                 │────────────────────>│
    │               │                 │                   │ Send email
    │               │  "Please check  │                   │
    │               │   your email"   │                   │
    │               │<────────────────│                   │
    │               │                 │                   │
    │ Click link    │                 │                   │
    │ in email      │                 │                   │
    │──────────────>│                 │                   │
    │               │ Verify token    │                   │
    │               │────────────────>│                   │
    │               │                 │ Check token validity│
    │ Enter new pw  │                 │                   │
    │──────────────>│                 │                   │
    │               │ POST /reset/confirm                 │
    │               │────────────────>│                   │
    │               │                 │ Update password   │
    │               │                 │ Invalidate all sessions
    │ Done          │                 │ Invalidate token  │
    │<──────────────│                 │                   │
```

```typescript
// Password reset implementation
import crypto from 'crypto';

class PasswordResetService {
  constructor(
    private db: Database,
    private redis: Redis,
    private emailService: EmailService,
    private hashService: HashService
  ) {}

  // Generate reset token
  async createResetToken(email: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email } });

    // Return the same response whether or not the user exists (prevents user enumeration)
    if (!user) {
      // Timing attack prevention
      await new Promise((resolve) => setTimeout(resolve, 200));
      return;
    }

    // Rate limit: restrict repeated requests to the same email
    const rateLimitKey = `reset:ratelimit:${email}`;
    const isLimited = await this.redis.exists(rateLimitKey);
    if (isLimited) return;
    await this.redis.setex(rateLimitKey, 300, '1'); // 5 minutes

    // Invalidate existing tokens
    await this.db.resetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate a cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await this.db.resetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,            // Store hashed
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Valid for 1 hour
      },
    });

    // Send reset link (include plaintext token in URL)
    await this.emailService.send(email, {
      subject: 'Password Reset',
      html: `
        <p>Click the link below to reset your password (valid for 1 hour):</p>
        <a href="${process.env.APP_URL}/reset-password?token=${token}">
          Reset Password
        </a>
        <p>If you did not request this, please ignore this email.</p>
        <p>Link expires in: 1 hour</p>
      `,
    });
  }

  // Execute password reset
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.db.resetToken.findFirst({
      where: {
        token: hashedToken,
        expiresAt: { gt: new Date() },   // Check expiry
        usedAt: null,                     // Check unused
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    // Ensure new password is different from old
    const isSameAsOld = await argon2.verify(resetToken.user.password, newPassword);
    if (isSameAsOld) {
      throw new Error('New password must be different from the current password');
    }

    // Update password
    const hashedPassword = await this.hashService.hash(newPassword);
    await this.db.$transaction([
      this.db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      // Mark token as used
      this.db.resetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all sessions (log out from all devices on password change)
      this.db.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    // Send password change notification email
    await this.emailService.send(resetToken.user.email, {
      subject: 'Your Password Has Been Changed',
      html: `
        <p>Your password has been successfully changed.</p>
        <p>Changed at: ${new Date().toISOString()}</p>
        <p>If you did not make this change, please contact support immediately.</p>
      `,
    });
  }
}
```

```
Password reset security requirements:

  Token:
  ✓ Cryptographically secure random value (crypto.randomBytes)
  ✓ Store hashed in DB
  ✓ Set an expiry (within 1 hour recommended)
  ✓ Invalidate immediately after use
  ✓ One token per user (delete old token when issuing new one)

  Response:
  ✓ Same response regardless of whether user exists
    → "If the email address is registered, a reset email has been sent"
    → Prevents user enumeration attacks

  Additional measures:
  ✓ Rate limiting (restrict repeated requests to the same email)
  ✓ Invalidate all sessions after password change
  ✓ Send a password change notification email
  ✓ Reject new password that matches the old one
  ✓ CAPTCHA (bot prevention)
```

---

## 6. Password Migration

```
Strategies for migrating from existing hash algorithms:

  Scenario: Migrating from MD5/SHA-256 → Argon2id

  Method 1: Transparent rehashing (recommended)
  ┌──────────────────────────────────────────────────┐
  │  ① User logs in                                  │
  │  ② Verify password with old algorithm            │
  │  ③ On success → rehash with new algorithm        │
  │  ④ Update hash value in DB                       │
  │                                                  │
  │  Pros: No user action required, gradual migration│
  │  Cons: Migration not complete until all users log in│
  └──────────────────────────────────────────────────┘

  Method 2: Wrapping (immediate migration)
  ┌──────────────────────────────────────────────────┐
  │  Old: MD5(password)                              │
  │  New: Argon2id(MD5(password))                    │
  │                                                  │
  │  ① Re-hash existing MD5 hashes with Argon2id     │
  │  ② Immediately migrate all users                 │
  │  ③ At login: verify with Argon2id(MD5(input))    │
  │  ④ On next login: update to Argon2id(password)   │
  │                                                  │
  │  Pros: Immediately strengthens all user protection│
  │  Cons: More complex implementation               │
  └──────────────────────────────────────────────────┘
```

```typescript
// Password migration implementation
import crypto from 'crypto';
import argon2 from 'argon2';

class PasswordMigration {
  // Detect hash format
  detectHashType(hash: string): 'md5' | 'sha256' | 'bcrypt' | 'argon2' {
    if (hash.startsWith('$argon2')) return 'argon2';
    if (hash.startsWith('$2b$') || hash.startsWith('$2a$')) return 'bcrypt';
    if (hash.length === 32) return 'md5';    // 32-char hex
    if (hash.length === 64) return 'sha256'; // 64-char hex
    throw new Error(`Unknown hash format: ${hash.substring(0, 10)}...`);
  }

  // Verify with legacy hash
  async verifyLegacy(password: string, hash: string, type: string): Promise<boolean> {
    switch (type) {
      case 'md5':
        return crypto.createHash('md5').update(password).digest('hex') === hash;
      case 'sha256':
        return crypto.createHash('sha256').update(password).digest('hex') === hash;
      case 'bcrypt':
        return bcrypt.compare(password, hash);
      case 'argon2':
        return argon2.verify(hash, password);
      default:
        return false;
    }
  }

  // Transparent migration at login
  async loginWithMigration(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: any }> {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return { success: false };

    const hashType = this.detectHashType(user.password);
    const isValid = await this.verifyLegacy(password, user.password, hashType);

    if (!isValid) return { success: false };

    // If using old algorithm, rehash with Argon2id
    if (hashType !== 'argon2') {
      const newHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      await db.user.update({
        where: { id: user.id },
        data: { password: newHash },
      });

      console.log(`Migrated password hash for user ${user.id}: ${hashType} → argon2id`);
    }

    return { success: true, user };
  }

  // Bulk wrapping migration
  async wrapAllHashes(): Promise<{ migrated: number; errors: number }> {
    let migrated = 0;
    let errors = 0;

    const users = await db.user.findMany({
      where: {
        NOT: { password: { startsWith: '$argon2' } },
      },
    });

    for (const user of users) {
      try {
        // Wrap old hash with Argon2id
        const wrappedHash = await argon2.hash(user.password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
          raw: false,
        });

        await db.user.update({
          where: { id: user.id },
          data: {
            password: wrappedHash,
            passwordWrapped: true, // Flag as wrapped
          },
        });

        migrated++;
      } catch (error) {
        errors++;
        console.error(`Failed to migrate user ${user.id}:`, error);
      }
    }

    return { migrated, errors };
  }
}
```

---

## 7. Anti-Patterns

```
Password management anti-patterns:

  ✗ Storing plaintext:
    → A DB breach immediately exposes all passwords
    → May result in legal liability
    → Violates GDPR and personal information protection laws

  ✗ Reversible encryption:
    → Encrypting with AES, etc. → decryptable with the key
    → Creates key management problems
    → Key breach = all passwords breached

  ✗ MD5/SHA-256 (without salt):
    → Crackable with rainbow tables
    → GPUs compute billions of hashes per second
    → Zero defensive value with modern hardware

  ✗ Custom hash algorithms:
    → Will have vulnerabilities unless you are a cryptography expert
    → Use verified, well-tested libraries
    → "Too simple to break" is an illusion

  ✗ Maximum password length restriction (e.g., 16 characters):
    → Prevents use of passphrases
    → Length doesn't matter after hashing
    → Handle bcrypt's 72-byte limit with pre-hashing

  ✗ Logging passwords:
    → Plaintext passwords remain in log files
    → Be especially careful when logging request bodies
    → Filter with logging framework

  ✗ Information leakage via error messages:
    → "Wrong password" → reveals user existence
    → "Incorrect email address or password" is correct

  ✗ Vulnerability to timing attacks:
    → Immediately returning an error when user doesn't exist
    → Fast response without hash verification reveals user existence
    → Countermeasure: always compute hash (even with a dummy)

  ✗ Leaving old sessions after password change:
    → Old sessions remain valid after password change
    → Attacker's session persists even after account compromise
    → Invalidate all sessions on password change
```

---

## 8. Exercises

### Exercise 1: Hash Algorithm Speed Comparison (Basic)

```
Task:
  Measure the speed of each hash algorithm and get a feel for why
  bcrypt/Argon2 are appropriate for password hashing.

  Requirements:
  1. Hash with MD5, SHA-256, bcrypt, and Argon2id respectively
  2. Measure the time to compute 100,000 hashes with each algorithm
  3. Summarize the results in a table
  4. Explain why being "slow" is an advantage

  Expected results:
  MD5:        ~1 second / 100,000 hashes
  SHA-256:    ~2 seconds / 100,000 hashes
  bcrypt(12): ~30 minutes / 100,000 hashes
  Argon2id:   ~8 hours / 100,000 hashes
```

### Exercise 2: Implementing a Secure Password Reset Flow (Intermediate)

```
Task:
  Using Express + Prisma, implement an OWASP-compliant
  password reset flow.

  Requirements:
  1. POST /auth/reset-request: Request reset by email address
  2. GET /auth/reset-verify/:token: Verify token validity
  3. POST /auth/reset-confirm: Set new password
  4. Security requirements:
     → Token generated with crypto.randomBytes(32)
     → Store hashed in DB
     → Expiry: 1 hour
     → Invalidate used tokens
     → Prevent user enumeration attacks
     → Rate limiting
     → Invalidate all sessions
     → Send change notification email
```

### Exercise 3: Implementing Password Migration (Advanced)

```
Task:
  Implement a step-by-step migration mechanism from
  MD5 → bcrypt → Argon2id.

  Requirements:
  1. Automatic detection of hash format
  2. Transparent rehashing (automatic migration at login)
  3. Bulk wrapping (wrap MD5 hash with Argon2id)
  4. Migration progress monitoring
  5. Rollback-capable design

  Test scenarios:
  → User with MD5 hash logs in → migrated to Argon2id
  → User with bcrypt hash logs in → migrated to Argon2id
  → Old Argon2id parameters → rehash with new parameters
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

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
        """Get processing results"""
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup:             {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithmic time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 9. FAQ & Troubleshooting

```
Q1: Which should I use, bcrypt or Argon2?
A1: → New projects: Argon2id (memory-hard, strongest GPU resistance)
    → Existing projects: bcrypt is still sufficiently secure
    → FIPS compliance required: PBKDF2-HMAC-SHA256
    → Environments where neither is available: scrypt

Q2: I'm worried about bcrypt's 72-byte limit
A2: → Handle with SHA-256 pre-hashing: bcrypt(SHA256(password).base64())
    → Base64 output is 44 chars → within 72 bytes
    → Or migrate to Argon2id (no length limit)

Q3: What should the maximum password length be?
A3: → Allow at least 64 characters (NIST recommended)
    → Cap at 128–256 characters (DoS mitigation)
    → Check length before hashing (prevent computation load from huge inputs)

Q4: Where should passwords be stored?
A4: → Store hashed in the main DB
    → Add "encryption wrapping" if encryption is needed
    → Manage encryption keys with KMS/HSM
    → Apply the same protection to backups

Q5: What is the flow when a user forgets their password?
A5: → Send a reset token via email
    → Token is random and cryptographically secure
    → Valid for 1 hour, invalidated after use
    → Do not reveal whether user exists
    → If MFA is enabled, require MFA even after reset

Q6: Plaintext passwords ended up in the logs
A6: → Immediately delete the log files securely
    → Force a password reset for affected users
    → Add request body filtering to the logging framework
    → Record the incident in the audit log
    → Report to the security team

Q7: Argon2 memory usage is destabilizing the server
A7: → Lower parallelism (4 → 1)
    → Lower memoryCost (65536 → 19456)
    → Limit concurrent hash computations (Semaphore)
    → Run in worker threads
    → Isolate hash computation to a dedicated service
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Best Practice |
|------|---------------|
| Hash | Argon2id (recommended) or bcrypt |
| Salt | Auto-generated by the algorithm (no manual management needed) |
| Pepper | Encryption wrapping (key managed via KMS) |
| Cost | 250ms–1 second hash computation time |
| Policy | 8+ characters, breach check, strength meter |
| Prohibited | Commonly used passwords, passwords containing user info |
| Reset | Cryptographically random token, 1 hour validity, stored hashed |
| Error | "Incorrect email or password" (keep it vague) |
| Session | Invalidate all sessions on password change |
| Migration | Transparent rehashing or wrapping |

---

## Further Reading

---

## References
1. NIST. "SP 800-63B: Digital Identity Guidelines." nist.gov, 2020.
2. OWASP. "Password Storage Cheat Sheet." cheatsheetseries.owasp.org, 2024.
3. Troy Hunt. "Have I Been Pwned." haveibeenpwned.com, 2024.
4. Dropbox. "zxcvbn: Realistic Password Strength Estimation." github.com/dropbox/zxcvbn.
5. RFC 9106. "Argon2 Memory-Hard Function for Password Hashing and Proof-of-Work Applications." IETF, 2021.
6. Niels Provos, David Mazieres. "A Future-Adaptable Password Scheme." USENIX, 1999.
7. OWASP. "Credential Stuffing Prevention Cheat Sheet." cheatsheetseries.owasp.org, 2024.
8. OWASP. "Forgot Password Cheat Sheet." cheatsheetseries.owasp.org, 2024.
