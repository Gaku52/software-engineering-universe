# Multi-Factor Authentication (MFA)

> Passwords alone are no longer enough. This guide covers how multi-factor authentication works and how to implement it securely — from TOTP and WebAuthn/Passkeys to SMS authentication and recovery codes — while also looking ahead to the future of passwordless authentication. Based on RFC 6238 (TOTP), W3C WebAuthn, and FIDO2 specifications, this guide covers everything from internal algorithms to implementation and operational best practices.

## Prerequisites

- Basic concepts of symmetric-key cryptography and HMAC
- Fundamentals of public-key cryptography
- Basics of HTTP cookies and session management

## What You Will Learn

- [ ] Understand the types of MFA and the security strength of each method
- [ ] Grasp the internal algorithm of TOTP (RFC 6238 / RFC 4226)
- [ ] Learn how WebAuthn/Passkeys work and how to implement them
- [ ] Design MFA implementation and recovery strategies
- [ ] Understand design patterns for passwordless authentication
- [ ] Learn how to implement step-up authentication

---

## 1. MFA Fundamentals

```
The Three Authentication Factors:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  ① Something You Know (Knowledge Factor)         │
  │     → Passwords, PINs, security questions        │
  │     → Most common but most vulnerable            │
  │     → Weak against phishing and brute force      │
  │                                                  │
  │  ② Something You Have (Possession Factor)        │
  │     → Smartphone, hardware key, smart card       │
  │     → TOTP, SMS code, FIDO2 security key         │
  │     → Requires physical theft → difficult to     │
  │       attack remotely                            │
  │                                                  │
  │  ③ Something You Are (Inherence Factor)          │
  │     → Fingerprint, face, iris, voice             │
  │     → Cannot be changed (high risk if leaked)    │
  │     → Processed locally on device (not sent to   │
  │       server)                                    │
  │                                                  │
  └──────────────────────────────────────────────────┘

MFA Principle:
  → Combine factors from different categories
  → Multiple factors from the same category do NOT constitute MFA

  ✗ Password + security question = Single factor (both "knowledge")
  ✓ Password + TOTP = Multi-factor ("knowledge" + "possession")
  ✓ Password + fingerprint = Multi-factor ("knowledge" + "inherence")
  ✓ Passkey = Multi-factor ("possession" + "inherence" on a single device)
```

---

## 2. MFA Method Comparison

```
Detailed MFA Method Comparison:

  Method        │ Security    │ UX      │ Phishing    │ Cost    │ Offline
  ──────────────┼─────────────┼─────────┼─────────────┼─────────┼────────
  SMS OTP       │ △ Low       │ ○ Good  │ ✗ Weak      │ Carrier │ ✗ No
  Email OTP     │ △ Low       │ ○ Good  │ ✗ Weak      │ Free    │ ✗ No
  TOTP          │ ○ Moderate  │ ○ Good  │ △ Somewhat  │ Free    │ ✓ Yes
  Push Notify   │ ○ Moderate  │ ◎ Best  │ △ Somewhat  │ Paid    │ ✗ No
  FIDO2/        │ ◎ Strongest │ ◎ Best  │ ✓ Resistant │ Key $   │ ✓ Yes
  WebAuthn      │             │         │             │         │
  Passkeys      │ ◎ Strongest │ ◎ Best  │ ✓ Resistant │ Free    │ ✓ Yes

Recommended Priority:
  1. Passkeys / WebAuthn (most secure + best UX)
  2. TOTP (widely adopted, free)
  3. Push notifications (good UX)
  4. SMS OTP (last resort)

Detailed Attack Resistance Comparison:

  Attack Type              │ SMS  │ TOTP │ Push │ WebAuthn
  ─────────────────────────┼──────┼──────┼──────┼─────────
  Phishing                 │ ✗    │ ✗    │ ✗    │ ✓ Resistant
  SIM Swap                 │ ✗    │ ✓    │ ✓    │ ✓
  SS7 Interception         │ ✗    │ ✓    │ ✓    │ ✓
  Real-time Phishing       │ ✗    │ ✗    │ △    │ ✓
  MitM Proxy               │ ✗    │ ✗    │ △    │ ✓
  Social Engineering       │ ✗    │ △    │ ✗    │ ✓
  Malware                  │ △    │ △    │ △    │ ○
```

---

## 3. TOTP (Time-based One-Time Password)

### 3.1 TOTP Internal Algorithm

```
How TOTP Works (RFC 6238 + RFC 4226):

  Setup:
    ① Server generates a secret key (160 bits or more recommended)
    ② Displayed as a QR code (otpauth:// URI)
    ③ User scans with an authenticator app (e.g. Google Authenticator)
    ④ User enters the displayed 6-digit code for verification

  Authentication:
    ① User enters the 6-digit code shown in the authenticator app
    ② Server computes the code using the same algorithm
    ③ If they match, authentication succeeds

  Internal Algorithm Steps:

  Step 1: Calculate the time step
  ┌──────────────────────────────────────────┐
  │  T = floor(unix_time / period)           │
  │                                          │
  │  unix_time = 1700000000 (seconds)        │
  │  period = 30 (seconds)                   │
  │  T = floor(1700000000 / 30) = 56666666   │
  │                                          │
  │  → T changes every 30 seconds            │
  │  → T is synchronized between server and  │
  │    client                                │
  └──────────────────────────────────────────┘

  Step 2: Compute HOTP (RFC 4226)
  ┌──────────────────────────────────────────┐
  │  HOTP(K, C) = Truncate(HMAC-SHA1(K, C))  │
  │                                          │
  │  K = secret key (raw bytes before        │
  │      Base32 encoding)                    │
  │  C = T (8-byte big-endian representation)│
  │                                          │
  │  ① hmac = HMAC-SHA1(K, C)               │
  │     → 20-byte (160-bit) hash value       │
  │                                          │
  │  ② offset = hmac[19] & 0x0F             │
  │     → Lower 4 bits of the last byte (0-15)│
  │                                          │
  │  ③ binary = (hmac[offset] & 0x7F) << 24  │
  │           | hmac[offset+1] << 16          │
  │           | hmac[offset+2] << 8           │
  │           | hmac[offset+3]                │
  │     → Convert 4 bytes to a 31-bit integer │
  │                                          │
  │  ④ otp = binary % 10^digits             │
  │     → 6 digits: binary % 1000000         │
  │     → Result: "481592"                   │
  └──────────────────────────────────────────┘

  QR Code URI:
    otpauth://totp/MyApp:alice@example.com
      ?secret=JBSWY3DPEHPK3PXP
      &issuer=MyApp
      &algorithm=SHA1
      &digits=6
      &period=30
```

```typescript
// TOTP internal implementation (educational purposes; use otplib in production)
import crypto from 'crypto';

function generateTOTP(
  secret: Buffer,      // Secret key (raw bytes)
  period: number = 30, // Time step (seconds)
  digits: number = 6,  // Number of OTP digits
  algorithm: string = 'sha1'
): string {
  // Step 1: Calculate the time step
  const time = Math.floor(Date.now() / 1000 / period);

  // Step 2: Convert time step to 8-byte big-endian
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(time));

  // Step 3: Compute HMAC-SHA1
  const hmac = crypto.createHmac(algorithm, secret).update(timeBuffer).digest();

  // Step 4: Dynamic Truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  );

  // Step 5: Truncate to the specified number of digits
  const otp = binary % Math.pow(10, digits);

  // Step 6: Zero-pad to preserve leading zeros
  return otp.toString().padStart(digits, '0');
}

// Verification (allows a window of previous/next steps)
function verifyTOTP(
  token: string,
  secret: Buffer,
  window: number = 1  // How many steps before/after to allow
): boolean {
  const period = 30;
  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const time = Math.floor(currentTime / period) + i;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigUInt64BE(BigInt(time));

    const hmac = crypto.createHmac('sha1', secret).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    );
    const otp = (binary % 1000000).toString().padStart(6, '0');

    // Timing-safe comparison
    if (crypto.timingSafeEqual(Buffer.from(otp), Buffer.from(token))) {
      return true;
    }
  }

  return false;
}
```

### 3.2 TOTP Implementation (otplib Library)

```typescript
// TOTP implementation (otplib)
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

// Setup: Generate secret key
async function setupTOTP(userId: string, email: string) {
  const secret = authenticator.generateSecret(); // Base32 encoded

  // Encrypt and save secret to DB (pending until MFA is verified)
  await db.mfaSetup.create({
    data: {
      userId,
      secret: encrypt(secret),  // Encrypt with AES before saving
      verified: false,
    },
  });

  // Generate QR code
  const otpauthUrl = authenticator.keyuri(email, 'MyApp', secret);
  const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

  return { qrCodeUrl, secret }; // secret is shown for backup purposes
}

// Verify setup: Confirm the code entered by the user
async function verifyTOTPSetup(userId: string, token: string) {
  const setup = await db.mfaSetup.findUnique({ where: { userId } });
  if (!setup) throw new Error('MFA setup not found');

  const secret = decrypt(setup.secret);
  const isValid = authenticator.verify({ token, secret });

  if (!isValid) {
    throw new Error('Invalid TOTP code');
  }

  // Enable MFA
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    }),
    db.mfaSetup.update({
      where: { userId },
      data: { verified: true },
    }),
  ]);

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes();
  await saveRecoveryCodes(userId, recoveryCodes);

  return { recoveryCodes }; // Shown to user only once
}

// Verify during authentication
async function verifyTOTP(userId: string, token: string): Promise<boolean> {
  const setup = await db.mfaSetup.findUnique({
    where: { userId, verified: true },
  });
  if (!setup) return false;

  const secret = decrypt(setup.secret);

  // Replay attack prevention: check if code has already been used
  const codeKey = `totp:used:${userId}:${token}`;
  const isUsed = await redis.exists(codeKey);
  if (isUsed) return false;

  // Window=1: also accept codes from the previous/next 30 seconds
  const isValid = authenticator.verify({ token, secret });

  if (isValid) {
    // Record as used (retain for 90 seconds = period * 3)
    await redis.setex(codeKey, 90, '1');
  }

  return isValid;
}
```

### 3.3 TOTP Security Considerations

```
TOTP Security Risks and Mitigations:

  ① Protecting the secret key:
     → Do not store in DB as plaintext (encrypt with AES-256-GCM, etc.)
     → Manage encryption keys with HSM or KMS
     → Store backups encrypted as well

  ② Replay attacks:
     → Prevent reuse of the same OTP code
     → Store used codes in Redis for a short period
     → Manage with a window of 30s × 3 = 90 seconds

  ③ Time drift:
     → Clock skew between server and client
     → Requires NTP time synchronization as a prerequisite
     → A window (1-2 steps before/after) accommodates this
     → Large drift → guide the user to sync their clock

  ④ Brute force:
     → 6 digits = 1,000,000 possibilities (must be tried within 30 seconds)
     → Rate limiting: lock out after 5 failures
     → Lockout duration: 15-30 minutes

  ⑤ Phishing (real-time proxy):
     → Attacker sits between the user and the real server
     → Forwards OTP entered by user to the real server in real time
     → TOTP is vulnerable to this attack (WebAuthn is resistant)
     → Mitigation: recommend combining with WebAuthn

  ⑥ Migration path from TOTP to WebAuthn:
     → Start by introducing TOTP
     → Offer WebAuthn/Passkey as an additional option
     → Encourage users to migrate
     → Eventually make TOTP a secondary method
```

---

## 4. WebAuthn / Passkeys

### 4.1 WebAuthn Internal Operation

```
How WebAuthn Works:

  Public-key cryptography-based authentication:
    → No passwords used
    → Private key stored on device (never sent to server)
    → Full phishing resistance (origin verification)

  Registration Flow:

  User      Browser         Authenticator   Server
    │          │              │               │
    │ Start     │              │               │
    │ register  │              │               │
    │─────────>│              │               │
    │          │ Request       │               │
    │          │ options       │               │
    │          │──────────────────────────────>│
    │          │              │               │
    │          │ challenge +   │               │
    │          │ rpId + userId │               │
    │          │<──────────────────────────────│
    │          │              │               │
    │          │ credentials   │               │
    │          │ .create()     │               │
    │          │─────────────>│               │
    │          │              │               │
    │ Finger/   │              │ User verify   │
    │ face auth │              │ Generate key  │
    │<─────────│              │ pair          │
    │ OK       │              │               │
    │─────────>│              │               │
    │          │              │ Public key +  │
    │          │              │ attestation   │
    │          │<─────────────│               │
    │          │              │               │
    │          │ Public key +  │               │
    │          │ attestation   │               │
    │          │──────────────────────────────>│
    │          │              │               │
    │          │              │  Verify sig   │
    │          │              │  Save pub key │
    │          │ Registration  │               │
    │          │ complete      │               │
    │          │<──────────────────────────────│
    │ Done     │              │               │
    │<─────────│              │               │

  Authentication Flow:

  User      Browser         Authenticator   Server
    │          │              │               │
    │ Login    │              │               │
    │─────────>│              │               │
    │          │ Request       │               │
    │          │ challenge     │               │
    │          │──────────────────────────────>│
    │          │              │               │
    │          │ challenge +   │               │
    │          │ allowCredentials              │
    │          │<──────────────────────────────│
    │          │              │               │
    │          │ credentials   │               │
    │          │ .get()        │               │
    │          │─────────────>│               │
    │          │              │               │
    │ Finger/   │              │ User verify   │
    │ face auth │              │ Sign challenge│
    │<─────────│              │               │
    │ OK       │              │               │
    │─────────>│              │               │
    │          │              │ Signed data   │
    │          │<─────────────│               │
    │          │              │               │
    │          │ Send signed   │               │
    │          │ data          │               │
    │          │──────────────────────────────>│
    │          │              │               │
    │          │              │  Verify sig   │
    │          │              │  with pub key │
    │          │ Auth success  │               │
    │          │<──────────────────────────────│
    │ Login    │              │               │
    │ success  │              │               │
    │<─────────│              │               │

  Passkeys (evolution of WebAuthn):
    → Synced via iCloud Keychain / Google Password Manager
    → Works across devices (register on iPhone → use on Mac)
    → De facto standard for passwordless authentication
    → Conditional UI: shows Passkey candidates in the input field

  Why Phishing-Resistant:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  What WebAuthn authentication data contains:     │
  │  → rpIdHash: hash of the RP (Relying Party)      │
  │    domain                                        │
  │  → origin: the origin of the request             │
  │                                                  │
  │  A key registered on example.com:                │
  │  → rpIdHash = SHA256("example.com")              │
  │  → Auth request from evil.com → rpId mismatch    │
  │  → Authenticator automatically rejects it        │
  │                                                  │
  │  Even if the user visits a fake site evil.com:   │
  │  → Authenticator will not use the example.com    │
  │    key                                           │
  │  → Phishing attacks are fundamentally impossible │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 4.2 WebAuthn Server Implementation

```typescript
// WebAuthn implementation (@simplewebauthn/server + @simplewebauthn/browser)

// Server side: Generate registration options
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const rpName = 'My App';
const rpID = 'example.com';
const origin = 'https://example.com';

// Registration: Generate options
async function getRegistrationOptions(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const existingDevices = await db.credential.findMany({
    where: { userId },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: user!.email,
    attestationType: 'none',
    excludeCredentials: existingDevices.map((d) => ({
      id: d.credentialId,
      transports: d.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',          // Support Passkeys
      userVerification: 'preferred',     // Recommend biometrics
    },
  });

  // Temporarily store the challenge (valid for 5 minutes)
  await redis.setex(
    `webauthn:challenge:${userId}`,
    300,
    options.challenge
  );

  return options;
}

// Registration: Verify response
async function verifyRegistration(userId: string, response: any) {
  const expectedChallenge = await redis.get(`webauthn:challenge:${userId}`);
  if (!expectedChallenge) {
    throw new Error('Challenge expired or not found');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;

    // Save the credential
    await db.credential.create({
      data: {
        userId,
        credentialId: Buffer.from(credential.id),
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: response.response.transports,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        createdAt: new Date(),
      },
    });

    // Delete the challenge
    await redis.del(`webauthn:challenge:${userId}`);
  }

  return verification;
}

// Authentication: Generate options
async function getAuthenticationOptions(email?: string) {
  let allowCredentials: any[] = [];

  if (email) {
    // If email is specified, retrieve the credentials for that user
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const credentials = await db.credential.findMany({
        where: { userId: user.id },
      });
      allowCredentials = credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports,
      }));
    }
  }
  // If email is not specified, leave allowCredentials empty
  // → Discoverable Credential (Passkey) will be used

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  // Temporarily store the challenge
  const challengeKey = email || 'anonymous';
  await redis.setex(
    `webauthn:auth:challenge:${challengeKey}`,
    300,
    options.challenge
  );

  return options;
}

// Authentication: Verify response
async function verifyAuthentication(response: any, email?: string) {
  // Identify user from credential ID
  const credential = await db.credential.findFirst({
    where: {
      credentialId: Buffer.from(response.id, 'base64url'),
    },
    include: { user: true },
  });

  if (!credential) {
    throw new Error('Credential not found');
  }

  const challengeKey = email || 'anonymous';
  const expectedChallenge = await redis.get(
    `webauthn:auth:challenge:${challengeKey}`
  );

  if (!expectedChallenge) {
    throw new Error('Challenge expired');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
    },
  });

  if (verification.verified) {
    // Update the counter (clone detection)
    await db.credential.update({
      where: { id: credential.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    // Delete the challenge
    await redis.del(`webauthn:auth:challenge:${challengeKey}`);

    return { verified: true, user: credential.user };
  }

  return { verified: false, user: null };
}
```

### 4.3 WebAuthn Client Implementation

```typescript
// Client side: WebAuthn registration and authentication
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';

// Check WebAuthn support
async function checkWebAuthnSupport() {
  const supported = browserSupportsWebAuthn();
  const platformAvailable = await platformAuthenticatorIsAvailable();

  return {
    supported,              // Browser supports WebAuthn
    platformAvailable,       // Fingerprint/face auth is available
    canUsePasskeys: supported && platformAvailable,
  };
}

// Register Passkey
async function registerPasskey() {
  const support = await checkWebAuthnSupport();
  if (!support.supported) {
    throw new Error('This browser does not support Passkeys');
  }

  // Fetch options from server
  const optionsRes = await fetch('/api/webauthn/register/options', {
    method: 'POST',
    credentials: 'include',
  });
  const options = await optionsRes.json();

  try {
    // Show the browser authentication dialog
    const registration = await startRegistration({ optionsJSON: options });

    // Send verification to server
    const verifyRes = await fetch('/api/webauthn/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
      credentials: 'include',
    });

    if (!verifyRes.ok) {
      throw new Error('Registration verification failed');
    }

    return verifyRes.json();
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Authentication was cancelled');
    }
    if (error.name === 'InvalidStateError') {
      throw new Error('This authenticator is already registered');
    }
    throw error;
  }
}

// Authenticate with Passkey
async function authenticateWithPasskey(email?: string) {
  const optionsRes = await fetch('/api/webauthn/authenticate/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const options = await optionsRes.json();

  try {
    const authentication = await startAuthentication({ optionsJSON: options });

    const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authentication),
      credentials: 'include',
    });

    if (!verifyRes.ok) {
      throw new Error('Authentication failed');
    }

    return verifyRes.json();
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Authentication was cancelled');
    }
    throw error;
  }
}

// Conditional UI (show Passkey candidates in the input field)
async function setupConditionalUI() {
  if (!browserSupportsWebAuthn()) return;

  try {
    const optionsRes = await fetch('/api/webauthn/authenticate/options', {
      method: 'POST',
    });
    const options = await optionsRes.json();

    // Enable Conditional UI with mediation: 'conditional'
    const authentication = await startAuthentication({
      optionsJSON: options,
      useBrowserAutofill: true, // Use Conditional UI
    });

    // Handle the case where authentication completes automatically
    const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authentication),
      credentials: 'include',
    });

    if (verifyRes.ok) {
      window.location.href = '/dashboard';
    }
  } catch (error) {
    console.log('Conditional UI not available or cancelled');
  }
}
```

### 4.4 Differences Between Passkeys and Traditional WebAuthn

```
Passkey vs Traditional WebAuthn:

  ┌───────────────────┬─────────────────┬─────────────────┐
  │ Feature           │ Traditional     │ Passkey          │
  │                   │ WebAuthn        │                  │
  ├───────────────────┼─────────────────┼─────────────────┤
  │ Key sync          │ Tied to device  │ Cloud synced     │
  │ Cross-device      │ Not possible    │ Possible         │
  │ Backup            │ None            │ Automatic        │
  │ Lost device       │ No access       │ Use other device │
  │ Discoverable      │ Optional        │ Required         │
  │ No username       │ Conditional     │ Possible         │
  │ Cross-device auth │ Not possible    │ QR + Bluetooth   │
  └───────────────────┴─────────────────┴─────────────────┘

  Passkey Cross-Device Authentication:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  PC (no Passkey) → Display QR code               │
  │         ↕                                        │
  │  Smartphone (Passkey registered)                 │
  │  → Scan the QR code                              │
  │  → Confirm proximity via Bluetooth               │
  │  → Verify identity with fingerprint/face         │
  │  → Authentication completes on the PC            │
  │                                                  │
  │  This flow is defined in CTAP 2.2 Hybrid         │
  │  Transport                                       │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

---

## 5. SMS / Email OTP

```
Risks of SMS OTP:

  ✗ SIM Swap Attack:
    → Attacker has SIM reissued at a carrier store
    → Tricks staff through social engineering
    → Victim's phone number transferred to attacker's device
    → SMS OTP is delivered to the attacker

  ✗ SS7 Protocol Vulnerability:
    → Control protocol of the telephone network (designed in 1975)
    → Weak authentication mechanism
    → Technically possible to intercept or redirect SMS
    → Can be exploited by nation-state-level attackers

  ✗ Phishing:
    → Tricks user into entering code on a fake site
    → Immediately used via real-time proxy attack
    → SMS link phishing is also common

  ✗ Social Engineering:
    → "A verification code was sent to you — please share it"
    → Fraudulent extraction posing as customer support

  ✗ Malware:
    → Android malware that reads SMS messages
    → Lower risk on iOS (sandboxed)

  When using SMS OTP anyway:
  → Significantly more secure than no MFA (blocks 99.9% of attacks)
  → Most familiar method for users
  → Use TOTP / WebAuthn as primary, SMS as fallback
  → Permitted as a "restricted authenticator" under NIST SP 800-63B
```

```typescript
// OTP implementation (with rate limiting and brute-force protection)
import crypto from 'crypto';

class OTPService {
  constructor(
    private db: Database,
    private redis: Redis,
    private smsService: SMSService,
    private emailService: EmailService
  ) {}

  // Generate and send OTP
  async sendOTP(userId: string, channel: 'sms' | 'email'): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Rate limiting: once per minute
    const rateLimitKey = `otp:ratelimit:${userId}`;
    const isLimited = await this.redis.exists(rateLimitKey);
    if (isLimited) {
      throw new Error('Please wait before requesting a new code');
    }

    // Daily sending limit: up to 10 times
    const dailyKey = `otp:daily:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const dailyCount = await this.redis.incr(dailyKey);
    if (dailyCount === 1) {
      await this.redis.expire(dailyKey, 86400); // 24 hours
    }
    if (dailyCount > 10) {
      throw new Error('Daily OTP limit exceeded');
    }

    // Random 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Hash and store
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Invalidate existing unused codes
    await this.db.otpCode.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.db.otpCode.create({
      data: {
        userId,
        code: hashedCode,
        channel,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Valid for 10 minutes
        attempts: 0,
      },
    });

    // Set rate limit (60 seconds)
    await this.redis.setex(rateLimitKey, 60, '1');

    // Send
    if (channel === 'sms') {
      await this.smsService.send(user.phone!, `Your verification code: ${code}`);
    } else {
      await this.emailService.send(user.email, {
        subject: 'Verification Code',
        html: `
          <p>Your verification code is <strong>${code}</strong>.</p>
          <p>This code is valid for 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });
    }
  }

  // Verify OTP
  async verifyOTP(userId: string, code: string): Promise<boolean> {
    const otpRecord = await this.db.otpCode.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) return false;

    // Attempt limit (brute-force protection)
    if (otpRecord.attempts >= 5) {
      await this.db.otpCode.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() }, // Invalidate
      });

      // Account lockout
      await this.lockAccount(userId, 15 * 60); // 15 minutes

      return false;
    }

    // Increment attempt count
    await this.db.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    // Timing-safe comparison
    const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hashedInput),
      Buffer.from(otpRecord.code)
    );

    if (!isValid) return false;

    // Mark as used
    await this.db.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    return true;
  }

  private async lockAccount(userId: string, durationSeconds: number): Promise<void> {
    await this.redis.setex(`account:locked:${userId}`, durationSeconds, '1');
  }
}
```

---

## 6. Recovery Codes

```
Recovery Code Design:

  Purpose:
  → Account recovery when the MFA device is lost
  → The last resort as a backup

  Requirements:
  → 8-10 codes (each code is single-use)
  → Sufficient entropy (unpredictable)
  → Guide users to store them in a safe place
  → Invalidate used codes
  → Store hashed (do not store as plaintext)

  Entropy Calculation:
  ┌──────────────────────────────────────────┐
  │  8-character alphanumeric code           │
  │  (e.g., "a3f8-e2b1")                    │
  │  → 8 hex digits = 4 bytes = 32 bits      │
  │  → 2^32 ≈ 4.3 billion combinations       │
  │  → Sufficient for brute force, but        │
  │    attempt rate limiting is essential     │
  │                                          │
  │  Recommended: 10-character alphanumeric  │
  │  (a-z, 0-9)                              │
  │  → 36^10 = 3.6 × 10^15                  │
  │  → Sufficient entropy                    │
  └──────────────────────────────────────────┘
```

```typescript
// Recovery code generation and management
import crypto from 'crypto';

class RecoveryCodeService {
  constructor(private db: Database, private redis: Redis) {}

  // Generate recovery codes
  generateRecoveryCodes(count: number = 10): string[] {
    return Array.from({ length: count }, () => {
      // 10-character secure random code (e.g., "a3f8-e2b1-c7d9")
      const bytes = crypto.randomBytes(6);
      const hex = bytes.toString('hex');
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    });
  }

  // Save recovery codes
  async saveCodes(userId: string, codes: string[]): Promise<void> {
    // Delete existing codes
    await this.db.recoveryCode.deleteMany({ where: { userId } });

    // Hash and store
    const hashedCodes = codes.map((code) => ({
      userId,
      code: crypto.createHash('sha256').update(code).digest('hex'),
      used: false,
    }));

    await this.db.recoveryCode.createMany({ data: hashedCodes });
  }

  // Verify a recovery code
  async verifyCode(userId: string, code: string): Promise<boolean> {
    // Rate limiting
    const rateLimitKey = `recovery:ratelimit:${userId}`;
    const attempts = await this.redis.incr(rateLimitKey);
    if (attempts === 1) {
      await this.redis.expire(rateLimitKey, 3600); // 1 hour
    }
    if (attempts > 10) {
      throw new Error('Too many recovery attempts. Try again later.');
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const record = await this.db.recoveryCode.findFirst({
      where: { userId, code: hashedCode, used: false },
    });

    if (!record) return false;

    // Mark as used
    await this.db.recoveryCode.update({
      where: { id: record.id },
      data: { used: true, usedAt: new Date() },
    });

    // Check remaining code count
    const remaining = await this.db.recoveryCode.count({
      where: { userId, used: false },
    });

    // Notify if few codes remain
    if (remaining <= 2) {
      await this.notifyLowCodes(userId, remaining);
    }

    // If all codes are used, temporarily disable MFA and prompt re-setup
    if (remaining === 0) {
      await this.promptMfaReset(userId);
    }

    return true;
  }

  // Regenerate recovery codes
  async regenerateCodes(userId: string): Promise<string[]> {
    const codes = this.generateRecoveryCodes();
    await this.saveCodes(userId, codes);
    return codes;
  }

  private async notifyLowCodes(userId: string, remaining: number): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (user) {
      await emailService.send(user.email, {
        subject: 'Your recovery codes are running low',
        html: `<p>You have ${remaining} recovery code(s) remaining. Please generate new codes to stay secure.</p>`,
      });
    }
  }

  private async promptMfaReset(userId: string): Promise<void> {
    // Issue a temporary MFA reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.redis.setex(`mfa:reset:${userId}`, 3600, resetToken);
  }
}
```

---

## 7. Step-Up Authentication

```
Step-Up Authentication:

  Concept:
  → Normal operations: baseline authentication (password + TOTP)
  → High-risk operations: require additional authentication steps

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Risk Levels and Required Authentication:        │
  │                                                  │
  │  Level 0: Password only                          │
  │    → View profile, change settings               │
  │                                                  │
  │  Level 1: Password + TOTP                        │
  │    → Login, general operations                   │
  │                                                  │
  │  Level 2: Password + TOTP + re-authentication    │
  │    → Change password, change MFA settings,       │
  │      update payment info                         │
  │                                                  │
  │  Level 3: Password + TOTP + biometrics +         │
  │           approval                               │
  │    → Large transfers, account deletion,          │
  │      admin operations                            │
  │                                                  │
  └──────────────────────────────────────────────────┘

  Implementation in JWT:
  → acr (Authentication Context Class Reference) claim
  → amr (Authentication Methods References) claim
  → auth_time: timestamp of last authentication
```

```typescript
// Step-up authentication implementation
interface AuthLevel {
  level: number;
  methods: string[];
  authenticatedAt: Date;
}

class StepUpAuthService {
  // Authentication level definitions
  private readonly AUTH_LEVELS = {
    basic: { level: 1, maxAge: 24 * 60 * 60 },      // 24 hours
    elevated: { level: 2, maxAge: 15 * 60 },         // 15 minutes
    critical: { level: 3, maxAge: 5 * 60 },          // 5 minutes
  };

  // Required authentication level per operation
  private readonly OPERATION_LEVELS: Record<string, keyof typeof this.AUTH_LEVELS> = {
    'view:profile': 'basic',
    'update:profile': 'basic',
    'change:password': 'elevated',
    'change:mfa': 'elevated',
    'delete:account': 'critical',
    'transfer:funds': 'critical',
    'admin:users': 'critical',
  };

  // Check current authentication level
  async checkAuthLevel(
    userId: string,
    operation: string
  ): Promise<{ allowed: boolean; requiredLevel: string; currentLevel: number }> {
    const requiredLevelName = this.OPERATION_LEVELS[operation] || 'basic';
    const requiredLevel = this.AUTH_LEVELS[requiredLevelName];

    // Retrieve authentication info from session
    const authInfo = await this.getAuthInfo(userId);

    if (!authInfo) {
      return { allowed: false, requiredLevel: requiredLevelName, currentLevel: 0 };
    }

    // Check if auth level is sufficient
    const levelSufficient = authInfo.level >= requiredLevel.level;

    // Check if authentication is fresh enough
    const ageSeconds = (Date.now() - authInfo.authenticatedAt.getTime()) / 1000;
    const freshEnough = ageSeconds <= requiredLevel.maxAge;

    return {
      allowed: levelSufficient && freshEnough,
      requiredLevel: requiredLevelName,
      currentLevel: authInfo.level,
    };
  }

  // Perform step-up authentication
  async performStepUp(
    userId: string,
    method: 'totp' | 'webauthn' | 'password',
    credential: string
  ): Promise<boolean> {
    let verified = false;

    switch (method) {
      case 'totp':
        verified = await verifyTOTP(userId, credential);
        break;
      case 'webauthn':
        const result = await verifyAuthentication(JSON.parse(credential));
        verified = result.verified;
        break;
      case 'password':
        const user = await db.user.findUnique({ where: { id: userId } });
        verified = user ? await argon2.verify(user.password, credential) : false;
        break;
    }

    if (verified) {
      await this.upgradeAuthLevel(userId, method);
    }

    return verified;
  }

  private async upgradeAuthLevel(userId: string, method: string): Promise<void> {
    const current = await this.getAuthInfo(userId) || {
      level: 0,
      methods: [],
      authenticatedAt: new Date(),
    };

    current.level = Math.min(current.level + 1, 3);
    current.methods.push(method);
    current.authenticatedAt = new Date();

    await redis.setex(
      `auth:level:${userId}`,
      24 * 60 * 60,
      JSON.stringify(current)
    );
  }

  private async getAuthInfo(userId: string): Promise<AuthLevel | null> {
    const data = await redis.get(`auth:level:${userId}`);
    return data ? JSON.parse(data) : null;
  }
}

// Used as Express middleware
function requireAuthLevel(operation: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const result = await stepUpAuth.checkAuthLevel(req.user!.userId, operation);

    if (result.allowed) {
      return next();
    }

    return res.status(403).json({
      error: 'step_up_required',
      requiredLevel: result.requiredLevel,
      currentLevel: result.currentLevel,
      message: 'Additional authentication required for this operation',
    });
  };
}

// Usage example
app.post('/api/transfer',
  requireAuth(),
  requireAuthLevel('transfer:funds'),
  async (req, res) => {
    // Execute high-risk operation
    await transferFunds(req.body);
    res.json({ success: true });
  }
);
```

---

## 8. MFA UX Design

```
MFA Setup UX:

  ① Recommend during onboarding (don't force)
  ② Display step-by-step guidance
  ③ Provide both QR code and manual entry options
  ④ Verify the code immediately after setup
  ⑤ Ensure users save their recovery codes

  ✓ Confirm recovery code storage:
    → Provide a download button
    → "Have you saved your codes in a safe place?" checkbox
    → Ask users to re-enter part of the code to confirm
    → Export as PDF or text file

MFA Setup Flow:

  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Step 1: Choose MFA Method                   │
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
  │  │ Passkey  │  │  TOTP   │  │   SMS   │      │
  │  │(Recommended)│        │  │         │      │
  │  └────┬────┘  └────┬────┘  └────┬────┘      │
  │       ↓            ↓            ↓            │
  │                                              │
  │  Step 2: Setup                               │
  │  → Passkey: generate key with finger/face    │
  │  → TOTP: scan QR code → enter code           │
  │  → SMS: enter phone number → enter code      │
  │                                              │
  │  Step 3: Verify                              │
  │  → Enter the code to confirm it works        │
  │                                              │
  │  Step 4: Recovery Codes                      │
  │  → Display 10 recovery codes                 │
  │  → Download/copy button                      │
  │  → "I have saved these" checkbox             │
  │  → Re-enter part of the codes to confirm     │
  │                                              │
  │  Step 5: Complete                            │
  │  → MFA is now enabled                        │
  │  → Suggest registering a trusted device      │
  │                                              │
  └──────────────────────────────────────────────┘

MFA Authentication UX:
  ✓ "Trust this device" option (30 days)
  ✓ Choose from multiple MFA methods
  ✓ Fallback to recovery codes
  ✗ Account lockout from enforced MFA → always provide a recovery path
```

```typescript
// Trusted device management
class TrustedDeviceService {
  constructor(private db: Database, private redis: Redis) {}

  // Register a device as trusted
  async trustDevice(userId: string, req: Request): Promise<string> {
    const deviceId = crypto.randomUUID();
    const hashedDeviceId = crypto.createHash('sha256').update(deviceId).digest('hex');

    const deviceInfo = {
      userId,
      hashedDeviceId,
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip,
      trustedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    await this.db.trustedDevice.create({ data: deviceInfo });

    return deviceId;
  }

  // Check if a device is trusted
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    if (!deviceId) return false;

    const hashedDeviceId = crypto.createHash('sha256').update(deviceId).digest('hex');

    const device = await this.db.trustedDevice.findFirst({
      where: {
        userId,
        hashedDeviceId,
        expiresAt: { gt: new Date() },
      },
    });

    return device !== null;
  }

  // Manage device ID via cookie
  setDeviceCookie(res: Response, deviceId: string): void {
    res.cookie('trusted_device', deviceId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }
}

// Integrated into the login flow
async function loginWithMFA(email: string, password: string, req: Request, res: Response) {
  // Step 1: Password authentication
  const user = await authenticatePassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Step 2: If MFA is enabled
  if (user.mfaEnabled) {
    // Check if this is a trusted device
    const deviceId = req.cookies.trusted_device;
    const isTrusted = await trustedDeviceService.isDeviceTrusted(user.id, deviceId);

    if (isTrusted) {
      // Skip MFA
      const tokens = await issueTokens(user);
      return res.json(tokens);
    }

    // MFA is required
    const mfaToken = await issueMfaToken(user.id); // Temporary token (valid for 5 minutes)
    return res.json({
      requireMFA: true,
      mfaToken,
      availableMethods: await getAvailableMFAMethods(user.id),
    });
  }

  // Login without MFA
  const tokens = await issueTokens(user);
  return res.json(tokens);
}
```

---

## 9. Anti-Patterns

```
MFA Implementation Anti-Patterns:

  ✗ Anti-pattern 1: Storing TOTP secrets in plaintext
    → If the DB is leaked, MFA for all users is compromised
    → Always encrypt before storing (AES-256-GCM + KMS)

  ✗ Anti-pattern 2: Relying solely on SMS OTP
    → Can be completely bypassed by SIM swap attacks
    → Provide TOTP at minimum as the primary method

  ✗ Anti-pattern 3: Enforcing MFA without a recovery path
    → Losing a device means permanent loss of account access
    → Always provide recovery codes
    → Also set up an identity verification flow via support

  ✗ Anti-pattern 4: Revealing MFA status before authentication
    → Displaying "Please enter your MFA code" as an error
    → This tells attackers that MFA is enabled on the account
    → A clue for user enumeration attacks

  ✗ Anti-pattern 5: Allowing OTP replay
    → Permitting the same OTP code to be used multiple times
    → Track and reject already-used codes

  ✗ Anti-pattern 6: Skipping WebAuthn counter validation
    → Cannot detect cloned authenticators
    → Vulnerable to authenticator cloning attacks
```

---

## 10. Passwordless Authentication Design

```
Passwordless Authentication Methods:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  1. Passkey (Recommended)                        │
  │     → Public-key cryptography based              │
  │     → Phishing resistant                         │
  │     → Best UX (fingerprint/face only)            │
  │     → Cloud-synced across devices                │
  │                                                  │
  │  2. Magic Link                                   │
  │     → Send a one-time link to email              │
  │     → Click the link to log in                   │
  │     → Depends on email security                  │
  │                                                  │
  │  3. OTP (Email / SMS)                            │
  │     → Send a one-time password                   │
  │     → Enter to authenticate                      │
  │     → Vulnerable to phishing                     │
  │                                                  │
  └──────────────────────────────────────────────────┘

Benefits of Passwordless:
  → Completely eliminates password leak risk
  → Prevents credential stuffing attacks
  → Better user experience (no passwords to remember)
  → Reduces support costs (no password resets needed)
```

```typescript
// Magic Link authentication implementation
class MagicLinkService {
  constructor(
    private db: Database,
    private redis: Redis,
    private emailService: EmailService
  ) {}

  // Send Magic Link
  async sendMagicLink(email: string): Promise<void> {
    // Same response regardless of whether the user exists
    const user = await this.db.user.findUnique({ where: { email } });

    if (!user) {
      // Take the same amount of time to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, 200));
      return;
    }

    // Rate limiting
    const rateLimitKey = `magiclink:ratelimit:${email}`;
    const isLimited = await this.redis.exists(rateLimitKey);
    if (isLimited) return;

    // Generate token
    const token = crypto.randomBytes(32).toString('base64url');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await this.db.magicLink.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // Valid for 15 minutes
      },
    });

    await this.redis.setex(rateLimitKey, 60, '1');

    // Send email
    const loginUrl = `${process.env.APP_URL}/auth/magic-link?token=${token}`;
    await this.emailService.send(email, {
      subject: 'Your Login Link',
      html: `
        <p>Click the link below to log in (valid for 15 minutes):</p>
        <a href="${loginUrl}">Log in</a>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
  }

  // Verify Magic Link
  async verifyMagicLink(token: string): Promise<{ userId: string } | null> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const magicLink = await this.db.magicLink.findFirst({
      where: {
        token: hashedToken,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!magicLink) return null;

    // Mark as used
    await this.db.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });

    return { userId: magicLink.userId };
  }
}
```

---

## 11. Exercises

### Exercise 1: Implement the TOTP Algorithm (Basic)

```
Task:
  Implement the TOTP algorithm from scratch based on RFC 6238.

  Requirements:
  1. TOTP generation based on HMAC-SHA1
  2. 6-digit one-time password
  3. 30-second time step
  4. Verification window of 1 step before and after
  5. Timing-safe comparison

  Test Vectors (RFC 6238 Appendix B):
  Secret: "12345678901234567890" (ASCII)
  Time 0: OTP = 755224 (RFC 4226 test vector)
  Time 1: OTP = 287082

  Verification: Match the results of the otplib library
```

### Exercise 2: Passwordless Login with WebAuthn (Applied)

```
Task:
  Implement a passwordless login page using @simplewebauthn.

  Requirements:
  1. Passkey registration flow
  2. Passkey authentication flow
  3. Conditional UI (show Passkey candidates in the input field)
  4. Manage multiple authenticators (list and delete)
  5. Fallback (for browsers without Passkey support)

  Tech stack:
  → Server: Express + @simplewebauthn/server
  → Client: React + @simplewebauthn/browser
  → DB: PostgreSQL (Prisma)
```

### Exercise 3: Design an MFA Policy Engine (Advanced)

```
Task:
  Design and implement an engine for managing MFA policies at the organization level.

  Requirements:
  1. Configurable MFA policy per organization
     → Enforce MFA for everyone
     → Enforce MFA for admins only
     → Recommendation only (not enforced)
  2. Restrict allowed MFA methods
     → Example: prohibit SMS, allow WebAuthn only
  3. Step-up authentication rules
     → Set the required authentication level per operation
  4. Risk-based authentication
     → New device → MFA required
     → Unusual geographic location → MFA required
     → Normal access pattern → skip MFA for trusted devices
  5. Audit log
     → Log all MFA operations
     → Viewable in admin panel

  Data Model:
  ┌──────────────┐  ┌──────────────┐
  │ Organization │  │ MFAPolicy    │
  ├──────────────┤  ├──────────────┤
  │ id           │  │ orgId        │
  │ name         │  │ enforcement  │
  │              │  │ allowedMethods│
  │              │  │ stepUpRules  │
  │              │  │ riskRules    │
  └──────────────┘  └──────────────┘
```

---

## 12. FAQ / Troubleshooting

```
Q1: TOTP code always mismatches
A1: → Check server time (NTP sync)
    → Widen the verification window (window=2)
    → Check client time (enable auto time on smartphone)
    → Verify that the secret key is being saved/decrypted correctly

Q2: WebAuthn registration fails in the browser
A2: → Confirm HTTPS environment (localhost is an exception)
    → Confirm rpID matches the domain
    → Check browser WebAuthn support status
    → Check if Content-Security-Policy is blocking it

Q3: Passkey is not syncing across devices
A3: → Confirm iCloud Keychain / Google Password Manager is enabled
    → Confirm residentKey is set to 'required'
    → Confirm a Passkey-compatible platform authenticator is being used

Q4: SMS OTP is not being delivered
A4: → Verify phone number format (international format: +1...)
    → Check SMS sending service quota
    → Check if the number is blocked
    → Provide voice call as a fallback option

Q5: Account is locked after enabling MFA
A5: → Recover using recovery codes
    → Identity verification flow via support
    → Admin-initiated MFA reset (audit log required)
    → Prevention: recommend registering multiple MFA methods

Q6: Lost recovery codes
A6: → Check if login is possible with another MFA method
    → Identity verification via government-issued ID
    → Admin-initiated reset (with approval flow)
    → Prevention: improve UX for confirming recovery code storage

Q7: User drop-off increased after introducing MFA
A7: → Make MFA a recommendation rather than a requirement (gradual rollout)
    → Prioritize suggesting Passkeys (best UX)
    → Reduce frequency with trusted device feature
    → Improve setup UI/UX
    → Explain the benefits of MFA to users
```

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Jumping to advanced topics without mastering the basics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| MFA Method | Security | Phishing Resistance | Offline | Recommended |
|------------|----------|---------------------|---------|-------------|
| Passkeys/WebAuthn | Strongest | Yes | Possible | Most recommended |
| TOTP | Moderate | No | Possible | Recommended |
| Push Notifications | Moderate | Limited | No | Good |
| SMS OTP | Low | No | No | Last resort |

| Design Element | Recommendation |
|----------------|----------------|
| Primary methods | Passkey + TOTP dual |
| Recovery | 10 single-use codes |
| Trusted devices | 30 days, managed via cookie |
| Step-up auth | Additional auth for high-risk operations |
| OTP storage | Hashed + encrypted |
| Replay prevention | Track used codes |

---

## What to Read Next

---

## References
1. RFC 6238. "TOTP: Time-Based One-Time Password Algorithm." IETF, 2011.
2. RFC 4226. "HOTP: An HMAC-Based One-Time Password Algorithm." IETF, 2005.
3. W3C. "Web Authentication: An API for accessing Public Key Credentials Level 2." w3.org, 2021.
4. FIDO Alliance. "Passkeys." fidoalliance.org, 2024.
5. NIST. "SP 800-63B §5.1.3: Out-of-Band Devices." nist.gov, 2020.
6. OWASP. "Multifactor Authentication Cheat Sheet." cheatsheetseries.owasp.org, 2024.
7. Apple. "Supporting Passkeys." developer.apple.com, 2024.
8. Google. "Passkeys on Android." developers.google.com, 2024.
9. Yubico. "WebAuthn Developer Guide." developers.yubico.com, 2024.
10. FIDO Alliance. "CTAP 2.2 Specification." fidoalliance.org, 2023.
