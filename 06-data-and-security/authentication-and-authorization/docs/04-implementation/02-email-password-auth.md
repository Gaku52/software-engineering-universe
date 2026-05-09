# Email and Password Authentication

> Email and password authentication is necessary when social login alone is insufficient. This guide covers the complete flow for secure email-based authentication: user registration, email verification, login, password reset, and account lockout.

## Prerequisites

- HTTP fundamentals (POST requests, status codes)
- TypeScript / JavaScript basics
- Basic database operations (Prisma)

## What You Will Learn

- [ ] Implement a secure user registration and email verification flow
- [ ] Understand the internal implementation of password hashing and when to use bcrypt vs Argon2
- [ ] Understand the design and implementation of secure login with rate limiting
- [ ] Design a complete password reset and account protection flow
- [ ] Apply countermeasures against user enumeration attacks and timing attacks
- [ ] Design a password policy compliant with NIST SP 800-63B

---

## 1. Password Hashing Fundamentals

### 1.1 Why Hashing Is Necessary

Passwords must never be stored in plaintext. If the database is compromised, all users' passwords are exposed to attackers. Hashing ensures that even if data is leaked, the original password cannot be recovered.

```
Evolution of password storage:

  ✗ Level 0: Plaintext storage
    password: "MySecret123"
    → All passwords are immediately exposed upon DB leak

  ✗ Level 1: Simple hash (MD5/SHA-256)
    hash: SHA256("MySecret123")
    → Vulnerable to rainbow table attacks

  ✗ Level 2: Salted hash
    hash: SHA256("random_salt" + "MySecret123")
    → Can be brute-forced quickly with GPUs (SHA-256 is too fast)

  ✓ Level 3: Dedicated hash function (bcrypt/Argon2)
    hash: bcrypt("MySecret123", cost=12)
    → Intentionally slow hash function
    → Makes brute-force attacks extremely costly

  Internal workings of password hash functions:

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  bcrypt structure:                           │
  │  $2b$12$LJ3m4ysKlcWBzBH8PsYBte.JZj2gLSf...  │
  │   │  │  │                    │               │
  │   │  │  │                    └─ Hash value   │
  │   │  │  └─ Salt (22-char Base64)             │
  │   │  └─ Cost factor (2^12 = 4096 rounds)     │
  │   └─ Algorithm identifier (2b = bcrypt)      │
  │                                              │
  │  Argon2id structure:                         │
  │  $argon2id$v=19$m=65536,t=3,p=4$salt$hash   │
  │   │        │    │       │  │                 │
  │   │        │    │       │  └─ Parallelism    │
  │   │        │    │       └─ Iterations        │
  │   │        │    └─ Memory usage (KB)         │
  │   │        └─ Version                        │
  │   └─ Algorithm identifier                    │
  │                                              │
  └──────────────────────────────────────────────┘
```

### 1.2 bcrypt vs Argon2 Comparison

```
Comparison of password hash functions:

  Feature        │ bcrypt          │ Argon2id        │ scrypt
  ───────────────┼────────────────┼────────────────┼────────────────
  Designed       │ 1999            │ 2015            │ 2009
  Memory-hard    │ ✗               │ ✓ (key benefit) │ ✓
  GPU resistance │ Medium          │ High            │ High
  Ease of config │ 1 parameter     │ 3 parameters    │ 3 parameters
  Library support│ Abundant        │ Growing         │ Moderate
  Recommended use│ Existing systems│ New systems     │ Common in crypto
  OWASP recommend│ ✓ (alternative) │ ✓ (first choice)│ ✓ (alternative)
  Standardized   │ ─               │ PHC Winner      │ RFC 7914

  Recommended settings:
    bcrypt:    cost = 12 (approx. 250ms per login)
    Argon2id:  m=65536 (64MB), t=3, p=4
    → Adjust based on server specs
    → Target 250ms–1s for login processing

  Important: MD5, SHA-1, SHA-256 must NOT be used for password hashing
  → These are fast hash functions and are not designed for passwords
```

### 1.3 Implementing Password Hashing

```typescript
// bcrypt でのパスワードハッシュ化
import bcrypt from 'bcrypt';

// ハッシュ化（登録時）
const BCRYPT_ROUNDS = 12; // コストファクター

async function hashPassword(password: string): Promise<string> {
  // bcrypt は自動でソルトを生成
  // $2b$12$[22文字のソルト][31文字のハッシュ]
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// 検証（ログイン時）
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Argon2id でのパスワードハッシュ化
import argon2 from 'argon2';

async function hashPasswordArgon2(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,    // Argon2id（推奨バリアント）
    memoryCost: 65536,        // 64MB のメモリ使用
    timeCost: 3,              // 3回の反復
    parallelism: 4,           // 4並列
  });
}

async function verifyPasswordArgon2(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// ハッシュ関数の自動判別（マイグレーション対応）
async function verifyPasswordAuto(password: string, hash: string): Promise<{
  valid: boolean;
  needsRehash: boolean;
}> {
  let valid: boolean;
  let needsRehash = false;

  if (hash.startsWith('$argon2')) {
    valid = await argon2.verify(hash, password);
    needsRehash = argon2.needsRehash(hash, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  } else if (hash.startsWith('$2')) {
    valid = await bcrypt.compare(password, hash);
    // bcrypt から Argon2 への移行を示す
    needsRehash = true;
  } else {
    throw new Error('Unknown hash format');
  }

  return { valid, needsRehash };
}

// ログイン時のハッシュ自動アップグレード
async function loginWithHashUpgrade(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) return null;

  const { valid, needsRehash } = await verifyPasswordAuto(password, user.password);
  if (!valid) return null;

  // ハッシュのアップグレード（バックグラウンドで実行）
  if (needsRehash) {
    const newHash = await hashPasswordArgon2(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newHash },
    });
  }

  return user;
}
```

---

## 2. Password Policy Based on NIST SP 800-63B

### 2.1 Modern Password Policy

```
NIST SP 800-63B Recommendations (2020 revision):

  ✓ Do:
    → Require a minimum of 8 characters (15+ recommended)
    → Allow at least 64 characters maximum
    → Allow Unicode characters (e.g., Japanese passwords)
    → Check against compromised password lists (Have I Been Pwned API)
    → Provide a password strength meter
    → Allow paste (for password manager compatibility)

  ✗ Do not:
    → Force periodic password changes
    → Require complexity rules (uppercase/lowercase/digit/symbol combinations)
    → Use security questions
    → Use password hints

  Rationale:
  → Complexity requirements lead to predictable weak password patterns
    (e.g., Password1! — easy to remember but weak)
  → Forced rotation leads to minor incremental changes
    (e.g., MyPass1 → MyPass2 → MyPass3)
  → Long passphrases are more secure
    (e.g., "correct horse battery staple" = high entropy)
```

### 2.2 Implementing Password Validation

```typescript
// NIST準拠のパスワードバリデーション
import { z } from 'zod';

// 漏洩パスワードチェック（Have I Been Pwned API）
async function isPasswordBreached(password: string): Promise<boolean> {
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  // k-Anonymity: プレフィックスのみ送信（パスワード自体は送信しない）
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await res.text();

  // レスポンスからサフィックスを検索
  return text.split('\n').some((line) => {
    const [hashSuffix, count] = line.split(':');
    return hashSuffix.trim() === suffix;
  });
}

// パスワード強度の計算
function calculatePasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // 長さ
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length < 8) feedback.push('8文字以上にしてください');

  // 文字種の多様性
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const charTypes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (charTypes >= 3) score += 1;

  // 繰り返し文字
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('同じ文字の繰り返しを避けてください');
  }

  // 一般的なパターン
  const commonPatterns = [
    /^123456/,
    /^password/i,
    /^qwerty/i,
    /^abcdef/i,
  ];
  if (commonPatterns.some((p) => p.test(password))) {
    score = Math.max(0, score - 2);
    feedback.push('一般的なパスワードパターンを避けてください');
  }

  return { score: Math.min(4, Math.max(0, score)), feedback };
}

// 登録フォームのバリデーション
const registerSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(100),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string()
    .min(8, 'パスワードは8文字以上必要です')
    .max(128, 'パスワードは128文字以下にしてください')
    .refine(
      (val) => !/(.)\1{2,}/.test(val),
      '同じ文字を3回以上連続して使用できません'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});
```

---

## 3. User Registration

### 3.1 Overview of the Registration Flow

```
User registration flow:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  User                       Server               │
  │    │                         │                   │
  │    │ Submit registration form │                   │
  │    │ (name, email, password) │                   │
  │    │────────────────────────>│                   │
  │    │                         │                   │
  │    │                    Validation               │
  │    │                    ├─ Format check          │
  │    │                    ├─ Password strength     │
  │    │                    ├─ Breach check          │
  │    │                    └─ Duplicate email check │
  │    │                         │                   │
  │    │                    Hash password            │
  │    │                    (bcrypt/Argon2)          │
  │    │                         │                   │
  │    │                    Create user (unverified) │
  │    │                         │                   │
  │    │                    Generate verification    │
  │    │                    token (crypto.randomBytes)│
  │    │                         │                   │
  │    │                    Send verification email  │
  │    │                         │                   │
  │    │ "Verification email sent"│                  │
  │    │<────────────────────────│                   │
  │    │                         │                   │
  │    │ Click link in email     │                   │
  │    │────────────────────────>│                   │
  │    │                         │                   │
  │    │                    Verify token             │
  │    │                    emailVerified = true      │
  │    │                    Delete token             │
  │    │                         │                   │
  │    │ "Verification complete" │                   │
  │    │<────────────────────────│                   │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 3.2 Implementing Registration

```typescript
// 登録 Server Action
'use server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

async function register(formData: FormData) {
  // 1. バリデーション
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  // 2. 漏洩パスワードチェック
  const breached = await isPasswordBreached(password);
  if (breached) {
    return {
      error: {
        password: ['このパスワードは漏洩データベースに含まれています。別のパスワードを使用してください'],
      },
    };
  }

  // 3. メールの重複チェック
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // ユーザー列挙攻撃を防止するため、同じメッセージを返す
    // 既存ユーザーには「このメールは既に登録されています」メールを送信
    if (existingUser.emailVerified) {
      await sendEmail({
        to: email,
        subject: 'アカウント登録の試行',
        html: `
          <p>${email} で既にアカウントが登録されています。</p>
          <p>ログインは <a href="${process.env.APP_URL}/login">こちら</a> から。</p>
          <p>パスワードをお忘れの場合は <a href="${process.env.APP_URL}/forgot-password">リセット</a> してください。</p>
        `,
      });
    }
    return { success: true, message: '確認メールを送信しました' };
  }

  // 4. パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(password, 12);

  // 5. ユーザー作成
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'viewer',
      emailVerified: null, // 未確認
    },
  });

  // 6. メール確認トークン生成
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間
    },
  });

  // 7. 確認メール送信
  await sendEmail({
    to: email,
    subject: 'メールアドレスの確認',
    html: `
      <h1>メールアドレスの確認</h1>
      <p>${name} さん、ご登録ありがとうございます。</p>
      <p>以下のリンクをクリックしてメールアドレスを確認してください：</p>
      <a href="${process.env.APP_URL}/verify-email?token=${verificationToken}">
        メールアドレスを確認
      </a>
      <p>このリンクは24時間有効です。</p>
      <p>このメールに心当たりがない場合は無視してください。</p>
    `,
  });

  return { success: true, message: '確認メールを送信しました' };
}
```

### 3.3 Countermeasures Against User Enumeration Attacks

```
User Enumeration Attack:

  Attack methods:
  ┌────────────────────────────────────────────┐
  │                                            │
  │  Ways an attacker can confirm whether      │
  │  an email address exists:                  │
  │                                            │
  │  (1) Error messages during registration    │
  │     ✗ "This email is already registered"  │
  │     → Confirms the email exists            │
  │                                            │
  │  (2) Error messages during login           │
  │     ✗ "Email address not found"            │
  │     ✗ "Incorrect password"                 │
  │     → Which error reveals whether email    │
  │       exists                               │
  │                                            │
  │  (3) Password reset                        │
  │     ✗ "This email is not registered"      │
  │     → Confirms the email does not exist    │
  │                                            │
  │  (4) Differences in response time          │
  │     ✗ Existing email: slower due to hash   │
  │       comparison                           │
  │     ✗ Non-existing email: faster (DB only) │
  │     → Timing attack reveals existence      │
  │                                            │
  └────────────────────────────────────────────┘

  Countermeasures:
  → Use the same response message in all cases
  → Use the same response time in all cases (dummy operations)
  → Whether an email was sent must not be observable from the outside
```

```typescript
// タイミング攻撃対策
async function loginSafe(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.password) {
    // ユーザーが存在しなくても bcrypt.compare を実行
    // → レスポンス時間を均一にしてタイミング攻撃を防止
    await bcrypt.compare(password, '$2b$12$dummy.hash.for.timing.protection');
    return { error: 'メールアドレスまたはパスワードが正しくありません' };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return { error: 'メールアドレスまたはパスワードが正しくありません' };
  }

  return { user };
}
```

---

## 4. Email Verification

### 4.1 Why Email Verification Is Important

Why is email verification necessary? (1) It verifies ownership of the email address. (2) It prevents accounts from being created using someone else's email. (3) It ensures the security of the password reset feature. (4) It establishes a reliable communication channel.

```typescript
// メール確認処理
async function verifyEmail(token: string) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token: hashedToken,
      expires: { gt: new Date() },
    },
  });

  if (!verificationToken) {
    return { error: '無効または期限切れのリンクです' };
  }

  // トランザクションでメールを確認済みに更新 + トークン削除
  await prisma.$transaction([
    prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    }),
  ]);

  return { success: true };
}

// メール確認の再送信
async function resendVerificationEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // ユーザーが存在しない or 既に確認済みでも同じレスポンス
  if (!user || user.emailVerified) {
    return { message: '確認メールを送信しました（メールが登録されている場合）' };
  }

  // レート制限: 同じメールへの再送は1時間に3回まで
  const recentTokens = await prisma.verificationToken.count({
    where: {
      identifier: email,
      expires: { gt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (recentTokens >= 3) {
    return { message: '確認メールを送信しました（メールが登録されている場合）' };
  }

  // 既存トークンを削除
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // 新しいトークン生成
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendEmail({
    to: email,
    subject: 'メールアドレスの確認',
    html: `
      <h1>メールアドレスの確認</h1>
      <p>以下のリンクをクリックしてメールアドレスを確認してください：</p>
      <a href="${process.env.APP_URL}/verify-email?token=${verificationToken}">
        メールアドレスを確認
      </a>
      <p>このリンクは24時間有効です。</p>
    `,
  });

  return { message: '確認メールを送信しました（メールが登録されている場合）' };
}

// メール確認ページ
async function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) {
    return <p>無効なリンクです。</p>;
  }

  const result = await verifyEmail(searchParams.token);

  if (result.error) {
    return (
      <div>
        <h1>確認に失敗しました</h1>
        <p>{result.error}</p>
        <Link href="/resend-verification">確認メールを再送信</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>メールアドレスが確認されました</h1>
      <Link href="/login">ログインする</Link>
    </div>
  );
}
```

---

## 5. Login and Rate Limiting

### 5.1 Overview of the Login Flow

```
Login flow:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  User                       Server               │
  │    │                         │                   │
  │    │ Submit login            │                   │
  │    │ (email, password)       │                   │
  │    │────────────────────────>│                   │
  │    │                         │                   │
  │    │                    ① Rate limit check       │
  │    │                    ├─ IP-based (5/15min)    │
  │    │                    └─ Email-based (5/15min) │
  │    │                         │                   │
  │    │                    ② Fetch user             │
  │    │                         │                   │
  │    │                    ③ Account lock check     │
  │    │                         │                   │
  │    │                    ④ Verify password        │
  │    │                    (bcrypt.compare)         │
  │    │                         │                   │
  │    │                    ⑤ Email verification     │
  │    │                       check                 │
  │    │                         │                   │
  │    │                    ⑥ Reset failure count    │
  │    │                    ⑦ Create session         │
  │    │                    ⑧ Send security notice   │
  │    │                         │                   │
  │    │ Set-Cookie: session     │                   │
  │    │<────────────────────────│                   │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 5.2 Implementing Multi-Layer Rate Limiting

```typescript
// 多層レート制限の設計
// Layer 1: グローバルレート制限（IP ベース）
// Layer 2: アカウントレート制限（メールベース）
// Layer 3: アカウントロック（DB ベース）

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // 秒
}

class LoginRateLimiter {
  constructor(private redis: Redis) {}

  // Layer 1: IP ベースのレート制限
  async checkIPLimit(ip: string): Promise<RateLimitResult> {
    const key = `login:ip:${ip}`;
    const limit = 20;     // 15分間に20回まで
    const window = 900;   // 15分

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    const ttl = await this.redis.ttl(key);

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt: new Date(Date.now() + ttl * 1000),
      retryAfter: current > limit ? ttl : undefined,
    };
  }

  // Layer 2: メールベースのレート制限
  async checkEmailLimit(email: string): Promise<RateLimitResult> {
    const key = `login:email:${email}`;
    const limit = 5;      // 15分間に5回まで
    const window = 900;   // 15分

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    const ttl = await this.redis.ttl(key);

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetAt: new Date(Date.now() + ttl * 1000),
      retryAfter: current > limit ? ttl : undefined,
    };
  }

  // 成功時にカウントをリセット
  async resetOnSuccess(email: string): Promise<void> {
    await this.redis.del(`login:email:${email}`);
  }
}

// ログイン処理（Auth.js Credentials プロバイダー）
async function authorize(credentials: { email: string; password: string }, req: Request) {
  const { email, password } = credentials;
  const ip = getClientIP(req);

  // Layer 1: IP レート制限
  const ipLimit = await rateLimiter.checkIPLimit(ip);
  if (!ipLimit.allowed) {
    throw new Error(`Too many requests. Try again in ${ipLimit.retryAfter} seconds.`);
  }

  // Layer 2: メールレート制限
  const emailLimit = await rateLimiter.checkEmailLimit(email);
  if (!emailLimit.allowed) {
    throw new Error(`Too many login attempts. Try again in ${emailLimit.retryAfter} seconds.`);
  }

  // ユーザー取得
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.password) {
    // タイミング攻撃対策: ダミーの bcrypt 比較
    await bcrypt.compare(password, '$2b$12$dummy.hash.for.timing.attack.prevention.only');
    return null;
  }

  // Layer 3: アカウントロックチェック
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Account is locked. Try again in ${remainingMinutes} minutes.`);
  }

  // パスワード検証
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    // 失敗回数を記録
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updateData: any = { failedLoginAttempts: failedAttempts };

    // 10回失敗でアカウントロック
    if (failedAttempts >= 10) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30分

      // アカウントロック通知
      await sendSecurityNotification(user.id, 'account_locked');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return null;
  }

  // メール未確認チェック
  if (!user.emailVerified) {
    throw new Error('Please verify your email before logging in.');
  }

  // ログイン成功: 失敗カウントリセット
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    },
  });

  // レート制限カウントリセット
  await rateLimiter.resetOnSuccess(email);

  // 新しいデバイスからのログイン検知
  const knownDevice = await isKnownDevice(user.id, req);
  if (!knownDevice) {
    await sendSecurityNotification(user.id, 'new_device');
    await recordDevice(user.id, req);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}
```

### 5.3 Fraud Detection Using Device Fingerprinting

```typescript
// デバイスフィンガープリント（簡易版）
interface DeviceFingerprint {
  userAgent: string;
  ipPrefix: string; // /24 サブネット
  acceptLanguage: string;
}

function generateDeviceFingerprint(req: Request): string {
  const fp: DeviceFingerprint = {
    userAgent: req.headers.get('user-agent') || '',
    ipPrefix: getClientIP(req).split('.').slice(0, 3).join('.'), // /24
    acceptLanguage: req.headers.get('accept-language') || '',
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(fp))
    .digest('hex')
    .substring(0, 16);
}

async function isKnownDevice(userId: string, req: Request): Promise<boolean> {
  const fingerprint = generateDeviceFingerprint(req);

  const device = await prisma.knownDevice.findFirst({
    where: {
      userId,
      fingerprint,
      lastSeenAt: { gt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // 90日以内
    },
  });

  return !!device;
}

async function recordDevice(userId: string, req: Request): Promise<void> {
  const fingerprint = generateDeviceFingerprint(req);

  await prisma.knownDevice.upsert({
    where: { userId_fingerprint: { userId, fingerprint } },
    create: {
      userId,
      fingerprint,
      userAgent: req.headers.get('user-agent') || '',
      ipAddress: getClientIP(req),
      lastSeenAt: new Date(),
    },
    update: {
      lastSeenAt: new Date(),
      ipAddress: getClientIP(req),
    },
  });
}
```

---

## 6. Password Reset

### 6.1 Designing the Reset Flow

```
Password reset flow:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  User                       Server               │
  │    │                         │                   │
  │    │ Submit email address    │                   │
  │    │────────────────────────>│                   │
  │    │                         │                   │
  │    │                    Rate limit check         │
  │    │                    (max 3 per hour)         │
  │    │                         │                   │
  │    │                    Look up user             │
  │    │                    ├─ Found: generate token │
  │    │                    │        send email      │
  │    │                    └─ Not found: do nothing │
  │    │                         │                   │
  │    │ "Reset email sent       │                   │
  │    │  (if registered)"       │                   │
  │    │<────────────────────────│                   │
  │    │                         │                   │
  │    │               ...receive email...           │
  │    │                         │                   │
  │    │ Click reset link        │                   │
  │    │────────────────────────>│                   │
  │    │                         │                   │
  │    │                    Verify token             │
  │    │                    (SHA-256 hash compare)   │
  │    │                    Check expiry (1 hour)    │
  │    │                         │                   │
  │    │ New password input screen│                  │
  │    │<────────────────────────│                   │
  │    │                         │                   │
  │    │ Submit new password     │                   │
  │    │────────────────────────>│                   │
  │    │                         │                   │
  │    │                    ① Check not same as old  │
  │    │                    ② Hash new password      │
  │    │                    ③ Update password        │
  │    │                    ④ Invalidate all sessions│
  │    │                    ⑤ Delete reset token     │
  │    │                    ⑥ Send change notice     │
  │    │                         │                   │
  │    │ "Password has been      │                   │
  │    │  changed"               │                   │
  │    │<────────────────────────│                   │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 6.2 Implementing the Reset

```typescript
// パスワードリセット要求
'use server';

async function requestPasswordReset(email: string) {
  // レート制限
  const key = `password_reset:${email}`;
  const attempts = await redis.get(key);
  if (attempts && parseInt(attempts) >= 3) {
    // 常に同じメッセージ（ユーザー列挙防止）
    return { message: 'メールアドレスが登録されていればリセットメールを送信しました' };
  }
  await redis.incr(key);
  await redis.expire(key, 3600); // 1時間

  // ユーザーの存在に関わらず同じレスポンス
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // 既存のリセットトークンを削除
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間
      },
    });

    await sendEmail({
      to: email,
      subject: 'パスワードリセット',
      html: `
        <h1>パスワードリセット</h1>
        <p>以下のリンクからパスワードをリセットしてください（1時間有効）:</p>
        <a href="${process.env.APP_URL}/reset-password?token=${token}">
          パスワードをリセット
        </a>
        <p>このリクエストに心当たりがない場合は無視してください。</p>
        <p>パスワードは変更されません。</p>
      `,
    });
  }

  // 常に同じメッセージ（ユーザー列挙防止）
  return { message: 'メールアドレスが登録されていればリセットメールを送信しました' };
}

// パスワードリセット実行
async function resetPassword(token: string, newPassword: string) {
  // バリデーション
  if (newPassword.length < 8 || newPassword.length > 128) {
    return { error: 'パスワードは8文字以上128文字以下にしてください' };
  }

  // 漏洩チェック
  const breached = await isPasswordBreached(newPassword);
  if (breached) {
    return { error: 'このパスワードは漏洩データベースに含まれています' };
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      token: hashedToken,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!resetToken) {
    return { error: '無効または期限切れのリンクです' };
  }

  // 新しいパスワードが前のパスワードと同じでないかチェック
  const isSame = await bcrypt.compare(newPassword, resetToken.user.password!);
  if (isSame) {
    return { error: '前のパスワードとは異なるパスワードを設定してください' };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    // パスワード更新
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      },
    }),
    // トークン削除
    prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    }),
    // 全セッション無効化（パスワード変更後は全デバイスからログアウト）
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  // パスワード変更通知メール
  await sendEmail({
    to: resetToken.user.email!,
    subject: 'パスワードが変更されました',
    html: `
      <p>パスワードが正常に変更されました。</p>
      <p>日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
      <p>この変更に心当たりがない場合は、直ちに
        <a href="${process.env.APP_URL}/forgot-password">パスワードをリセット</a>
        するか、サポートにご連絡ください。
      </p>
    `,
  });

  return { success: true };
}
```

---

## 7. Password Change (While Logged In)

```typescript
// パスワード変更（要現在のパスワード）
'use server';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: '現在のパスワードと異なるパスワードを設定してください',
  path: ['newPassword'],
});

async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // 漏洩チェック
  const breached = await isPasswordBreached(parsed.data.newPassword);
  if (breached) {
    return { error: { newPassword: ['このパスワードは漏洩データベースに含まれています'] } };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  // 現在のパスワードを検証
  const isValid = await bcrypt.compare(parsed.data.currentPassword, user!.password!);
  if (!isValid) {
    return { error: { currentPassword: ['現在のパスワードが正しくありません'] } };
  }

  // 新しいパスワードで更新
  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    }),
    // 現在のセッション以外を無効化
    prisma.session.deleteMany({
      where: {
        userId: session.user.id,
        id: { not: session.sessionId },
      },
    }),
  ]);

  // 通知
  await sendSecurityNotification(session.user.id, 'password_change');

  return { success: true };
}
```

---

## 8. Security Notifications

```typescript
// 重要なアカウントイベントの通知
async function sendSecurityNotification(
  userId: string,
  event: 'login' | 'password_change' | 'email_change' | 'new_device' | 'account_locked'
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return;

  const messages = {
    login: {
      subject: 'A new login was detected',
      body: 'A login was detected from a new device.',
    },
    password_change: {
      subject: 'Your password has been changed',
      body: 'Your password was successfully changed.',
    },
    email_change: {
      subject: 'Your email address has been changed',
      body: 'The email address on your account has been changed.',
    },
    new_device: {
      subject: 'Access from a new device',
      body: 'Your account was accessed from an unrecognized device.',
    },
    account_locked: {
      subject: 'Your account has been locked',
      body: 'There were multiple failed login attempts, and your account has been temporarily locked. It will be automatically unlocked after 30 minutes.',
    },
  };

  const { subject, body } = messages[event];

  // 監査ログ
  await prisma.securityEvent.create({
    data: {
      userId,
      event,
      timestamp: new Date(),
      metadata: { notificationSent: true },
    },
  });

  await sendEmail({
    to: user.email,
    subject,
    html: `
      <p>${body}</p>
      <p>日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
      <p>心当たりがない場合は、直ちにパスワードを変更してください。</p>
      <a href="${process.env.APP_URL}/settings/security">セキュリティ設定</a>
    `,
  });
}
```

---

## 9. Database Schema

```typescript
// Prisma スキーマ（認証関連の完全版）
// schema.prisma

/*
model User {
  id                   String    @id @default(cuid())
  email                String    @unique
  name                 String?
  password             String?   // ソーシャルログインユーザーは null
  image                String?
  role                 String    @default("viewer")
  emailVerified        DateTime?
  failedLoginAttempts  Int       @default(0)
  lockedUntil          DateTime?
  lastLoginAt          DateTime?
  lastLoginIp          String?
  passwordChangedAt    DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  sessions             Session[]
  accounts             Account[]
  verificationTokens   VerificationToken[]
  passwordResetTokens  PasswordResetToken[]
  knownDevices         KnownDevice[]
  securityEvents       SecurityEvent[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  ipAddress String?
  userAgent String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  id         String   @id @default(cuid())
  identifier String   // email
  token      String   // SHA-256 ハッシュ
  expires    DateTime

  @@unique([identifier, token])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   // SHA-256 ハッシュ
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model KnownDevice {
  id          String   @id @default(cuid())
  userId      String
  fingerprint String
  userAgent   String
  ipAddress   String
  lastSeenAt  DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, fingerprint])
}

model SecurityEvent {
  id        String   @id @default(cuid())
  userId    String
  event     String
  timestamp DateTime @default(now())
  metadata  Json?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, timestamp])
}
*/
```

---

## 10. Edge Cases and Anti-Patterns

### 10.1 Edge Cases

```
Edge cases in email and password authentication:

  (1) Email delivery delays or failures
     → Provide a resend verification email feature
     → Prompt users to check their spam folder
     → Consider an alternative verification method (code entry)

  (2) Email address case sensitivity
     → RFC 5321: the local part is case-sensitive
     → In practice: virtually all email providers treat it as case-insensitive
     → Recommendation: normalize to lowercase when storing
     → Unify using email.toLowerCase()

  (3) Unicode normalization for passwords
     → "cafe\u0301" and "caf\u00e9" look the same but are different byte sequences
     → NIST SP 800-63B: recommends normalization using SASLprep (RFC 7613)
     → At minimum: apply NFC normalization
     → password.normalize('NFC')

  (4) Mass simultaneous registrations (bots)
     → Introduce CAPTCHA (reCAPTCHA, hCaptcha, Turnstile)
     → Honeypot fields
     → Registration rate limiting

  (5) Existing users with no password set (social login only)
     → Provide a separate password setup flow
     → "Set password" is a different flow from reset
     → Assume email is already verified
```

### 10.2 Anti-Patterns

```
Anti-patterns in email and password authentication:

  (1) Logging passwords in plaintext
     ✗ console.log(`Login: ${email}, ${password}`);
     → Passwords must never be written to logs
     → Passwords in production logs constitute a critical incident

  (2) Storing reset tokens in plaintext
     ✗ await db.resetToken.create({ token: rawToken });
     → Tokens are exposed upon DB leak
     → Store after hashing with SHA-256

  (3) Differing error messages
     ✗ "Email not found" vs "Incorrect password"
     → Enables user enumeration attacks
     → Standardize to "Incorrect email address or password"

  (4) Failing to invalidate sessions
     ✗ Old sessions remain valid after a password change
     → Sessions persist even if an attacker knows the password
     → Invalidate all sessions on password change
```

---

## 11. Exercises

### Exercise 1: Basic Email and Password Authentication (Beginner)

Implement email and password authentication with the following requirements.

```
Requirements:
- User registration (name, email, password)
- Password hashing with bcrypt
- Email verification (token valid for 24 hours)
- Login (session creation)
- Logout (session destruction)

Tests:
- Successful registration → email verification → successful login
- Reject login with unverified email
- Login failure with incorrect password
```

### Exercise 2: Security Hardening (Intermediate)

Add the following security features to Exercise 1.

```
Requirements:
- Rate limiting (2-layer: IP + email)
- Account lockout (lock for 30 minutes after 10 failures)
- Password reset (token valid for 1 hour)
- Password change (requires current password confirmation)
- Countermeasures against user enumeration attacks
- Countermeasures against timing attacks

Tests:
- Verify rate limiting behavior
- Account lockout → automatic unlock
- Complete password reset flow
```

### Exercise 3: Enterprise Features (Advanced)

Add features for a production environment.

```
Requirements:
- Integration with Have I Been Pwned API
- Fraud detection using device fingerprinting
- Audit log for security events
- Migration to Argon2id (automatic upgrade from bcrypt)
- Password history (prohibit the last 5 passwords)
- CAPTCHA integration (reCAPTCHA or Turnstile)

Tests:
- Rejection of breached passwords
- Login notification from unknown device
- Automatic hash function upgrade
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|---------|
| Initialization error | Misconfigured configuration file | Verify the config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Concurrency conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to validate hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

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

Steps to diagnose performance issues when they occur:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Inspect the connection pool state

| Issue type | Diagnostic tool | Countermeasure |
|-----------|----------------|---------------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |
---

## 12. FAQ / Troubleshooting

### Q1: bcrypt comparison is always slow

**Cause**: bcrypt is intentionally designed to be slow. At cost=12, it takes approximately 250ms.

```
Solutions:
- Lowering the cost is not recommended (reduces security)
- If overall login performance is a concern:
  1. Run bcrypt in a worker thread
  2. For Node.js, use the native bcrypt module
  3. Prefer bcrypt (C++ bindings) over bcryptjs (pure JS)
```

### Q2: Emails are slow to deliver or never arrive

```
Solutions:
1. Send emails asynchronously (background job)
2. Use a dedicated email service such as SendGrid, Resend, or Amazon SES
3. Configure SPF, DKIM, and DMARC
4. Maintain the reputation of the sending domain
5. Provide UI that prompts users to check their spam folder
```

### Q3: Account lockouts occur frequently

```
Solutions:
1. Use CAPTCHA to prevent bot attacks
2. Apply IP-based rate limiting first
3. Adjust the lockout threshold (5 attempts → 10 attempts)
4. Increase the lockout duration gradually (5 min → 15 min → 30 min)
5. Provide an admin account unlock feature
```

### Q4: Password reset emails are being abused

```
Solutions:
1. Apply rate limiting to reset email sending as well
2. Shorten the token expiry (1 hour or less)
3. Invalidate tokens after a single use
4. Send email notification upon reset completion
5. Monitor suspicious reset requests
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Rather than theory alone, actually writing code and verifying its behavior deepens your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work, and is especially important during code reviews and architecture design.

---

## Summary

| Flow | Security Requirements |
|------|----------------------|
| Registration | bcrypt/Argon2 hashing, email verification required, breach check |
| Login | Multi-layer rate limiting, account lockout, timing attack countermeasures |
| Email verification | SHA-256 hashed token, valid 24 hours, resend rate limiting |
| Reset | Hashed token, valid 1 hour, invalidate all sessions |
| Change | Confirm current password, invalidate other sessions |
| Notification | Email notification for important events, audit log |
| Enumeration countermeasures | Unified error messages, uniform response timing |

---

## Further Reading

---

## References
1. NIST. "Digital Identity Guidelines: Authentication and Lifecycle Management." SP 800-63B, 2020.
2. OWASP. "Password Storage Cheat Sheet." cheatsheetseries.owasp.org, 2024.
3. OWASP. "Forgot Password Cheat Sheet." cheatsheetseries.owasp.org, 2024.
4. OWASP. "Authentication Cheat Sheet." cheatsheetseries.owasp.org, 2024.
5. Auth.js. "Credentials Provider." authjs.dev, 2024.
6. Troy Hunt. "Have I Been Pwned." haveibeenpwned.com, 2024.
7. RFC 7613. "Preparation, Enforcement, and Comparison of Internationalized Strings (PRECIS)." IETF, 2015.
8. Password Hashing Competition. "Argon2." password-hashing.net, 2015.
