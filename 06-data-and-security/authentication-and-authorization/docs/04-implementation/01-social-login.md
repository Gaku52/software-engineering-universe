# Social Login

> Social login via Google, GitHub, and Apple is essential for modern web applications. This guide provides comprehensive coverage of OAuth 2.0 / OpenID Connect flows, configuration steps, account linking, profile synchronization, provider-specific considerations, and security pitfalls.

## What You Will Learn in This Chapter

- [ ] Understand how OAuth 2.0 / OpenID Connect works and its role in social login
- [ ] Learn how to configure major providers (Google, GitHub, Apple) and understand their unique constraints
- [ ] Implement secure account linking and provider switching
- [ ] Learn provider-specific edge cases and troubleshooting
- [ ] Apply UX optimization and security hardening for social login

### Prerequisites

- Basic understanding of OAuth 2.0 (Authorization Code Grant)
- Fundamentals of DB operations with Prisma

---

## 1. Overview of Social Login

### 1.1 Why Social Login Is Needed

```
Benefits of Social Login:

  User perspective:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  ① No password required → No memorization burden    │
  │  ② One-click login → Lower abandonment rate         │
  │  ③ Trust → Familiar brands like Google / Apple      │
  │  ④ Auto-fill profile → Simplified sign-up           │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  Developer perspective:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  ① No need to manage password hashing               │
  │  ② Email verification can be delegated to providers │
  │  ③ 2FA / MFA handled on the provider side           │
  │  ④ No need to handle brute-force protection         │
  │  ⑤ No need to implement password reset flow         │
  │                                                     │
  └─────────────────────────────────────────────────────┘

  Statistics (industry data):
    → Introducing social login improves sign-up rates by 20-50%
    → Google has the highest usage rate (approx. 60%)
    → Apple is rapidly growing among iOS users
    → GitHub is nearly essential for developer-facing services
```

### 1.2 OAuth 2.0 Authorization Code Flow (with PKCE)

```
Authentication flow for social login:

  ┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────┐
  │ Browser  │     │App Server│     │ Auth Provider │     │ Database │
  │          │     │ (Auth.js)│     │ (Google etc.) │     │          │
  └────┬─────┘     └────┬──────┘     └──────┬────────┘     └────┬─────┘
       │                │                    │                   │
       │ ① Click login  │                    │                   │
       │ button         │                    │                   │
       ├───────────────→│                    │                   │
       │                │                    │                   │
       │                │ ② Generate state + │                   │
       │                │ PKCE code_verifier │                   │
       │                │                    │                   │
       │ ③ Redirect     │                    │                   │
       │←───────────────│                    │                   │
       │ (authorization endpoint)             │                   │
       │                │                    │                   │
       │ ④ Show consent screen to user        │                   │
       ├────────────────────────────────────→│                   │
       │                │                    │                   │
       │ ⑤ Consent → Authorization Code      │                   │
       │←────────────────────────────────────│                   │
       │                │                    │                   │
       │ ⑥ Send code via callback URL         │                   │
       ├───────────────→│                    │                   │
       │                │                    │                   │
       │                │ ⑦ Code + code_verifier                 │
       │                │ → Token Exchange    │                   │
       │                ├───────────────────→│                   │
       │                │                    │                   │
       │                │ ⑧ Access Token +   │                   │
       │                │ ID Token + Refresh  │                   │
       │                │←───────────────────│                   │
       │                │                    │                   │
       │                │ ⑨ Fetch UserInfo /  │                   │
       │                │ Validate ID Token   │                   │
       │                │                    │                   │
       │                │ ⑩ Create/update user                    │
       │                ├──────────────────────────────────────→│
       │                │                                        │
       │                │ ⑪ Create session                        │
       │                │←──────────────────────────────────────│
       │                │                    │                   │
       │ ⑫ Session Cookie                    │                   │
       │←───────────────│                    │                   │
       │                │                    │                   │
  * PKCE (Proof Key for Code Exchange):
    → Prevents Authorization Code interception attacks
    → code_verifier: random string generated on the client
    → code_challenge: SHA256 hash of code_verifier
    → code_verifier is sent at ⑦ and verified by the server
```

### 1.3 Differences Between OpenID Connect and OAuth 2.0

```
OAuth 2.0 vs OpenID Connect:

  ┌─────────────────┬──────────────────┬──────────────────────┐
  │ Item            │ OAuth 2.0        │ OpenID Connect       │
  ├─────────────────┼──────────────────┼──────────────────────┤
  │ Purpose         │ Authorization    │ Authentication       │
  │                 │ (API access)     │ (user identification)│
  │ Returned token  │ Access Token     │ ID Token + Access T. │
  │ User info       │ Fetched via API  │ Included in ID Token │
  │ Standard scopes │ None             │ openid, profile, etc.│
  │ Discovery       │ None             │ .well-known/openid-c │
  │ Providers       │ GitHub           │ Google, Apple        │
  └─────────────────┴──────────────────┴──────────────────────┘

  ID Token (JWT) structure:
    {
      "iss": "https://accounts.google.com",   // Issuer
      "sub": "1234567890",                     // User identifier
      "aud": "your-client-id.apps...",         // Client ID
      "exp": 1700000000,                       // Expiration
      "iat": 1699996400,                       // Issued at
      "email": "user@gmail.com",               // Email
      "email_verified": true,                  // Email verified flag
      "name": "Taro Yamada",                   // Name
      "picture": "https://..."                 // Avatar URL
    }

  Important: GitHub supports only pure OAuth 2.0 (not OpenID Connect)
  → Since there is no ID Token, user info must be fetched via the /user API
```

---

## 2. Google Login

### 2.1 Google Cloud Console Configuration

```
Detailed setup steps in Google Cloud Console:

  ① Create a project:
     → console.cloud.google.com
     → Create a new project (or select an existing one)

  ② Configure the OAuth consent screen:
     → APIs & Services > OAuth consent screen
     → User Type:
        · Internal: Google Workspace users only (for internal use)
        · External: All Google users (for public use)
     → App name, support email, developer contact
     → Add scopes:
        · openid (required)
        · email (to obtain email)
        · profile (to obtain name and avatar)
     → Add test users (required for External before publishing)

  ③ Create credentials:
     → APIs & Services > Credentials
     → Create Credentials > OAuth client ID
     → Application type: Web application
     → Authorized JavaScript origins:
        Development: http://localhost:3000
        Production: https://myapp.com
     → Authorized redirect URIs:
        Development: http://localhost:3000/api/auth/callback/google
        Production: https://myapp.com/api/auth/callback/google

  ④ Obtain Client ID and Client Secret
     → Configure in .env.local

  ⑤ Publish for production:
     → Click "PUBLISH APP" on the OAuth consent screen
     → Google review process (several days to weeks)
     → Privacy policy and terms of service URLs are required

  Notes:
  ┌────────────────────────────────────────────────────┐
  │ · Test mode supports up to 100 test users           │
  │ · After publishing, must comply with Google's       │
  │   brand guidelines                                  │
  │ · Sensitive scopes (e.g. Calendar) require          │
  │   additional review                                 │
  │ · Never expose Client Secret to the frontend        │
  └────────────────────────────────────────────────────┘
```

### 2.2 Google Provider Configuration (Auth.js v5)

```typescript
// auth.ts - Complete Google provider configuration
import Google from 'next-auth/providers/google';
import type { NextAuthConfig } from 'next-auth';

export const googleProvider = Google({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,

  // Customize authorization parameters
  authorization: {
    params: {
      scope: 'openid email profile',
      prompt: 'consent',         // Show consent screen every time (required to obtain Refresh Token)
      access_type: 'offline',    // Obtain Refresh Token
      response_type: 'code',     // Authorization Code Flow
      // hd: 'mycompany.com',    // Restrict to a specific domain (Google Workspace)
    },
  },

  // Map profile info obtained from ID Token
  profile(profile) {
    return {
      id: profile.sub,                        // Google's unique identifier
      name: profile.name,                     // Full name
      email: profile.email,                   // Email address
      image: profile.picture,                 // Avatar URL
      emailVerified: profile.email_verified,  // Email verified flag
      // Custom fields
      role: 'viewer',                         // Default role
      locale: profile.locale,                 // Locale (ja, en, etc.)
    };
  },
});
```

### 2.3 Google-Specific Considerations

```
Important notes for Google login:

  ① Behavior of the prompt parameter:
     ┌──────────────┬──────────────────────────────────────┐
     │ Value        │ Behavior                             │
     ├──────────────┼──────────────────────────────────────┤
     │ none         │ Automatic login (if already consented)│
     │ consent      │ Show consent screen every time        │
     │ select_account│ Show account selection screen        │
     │ login        │ Require re-authentication             │
     └──────────────┴──────────────────────────────────────┘

     Recommended: prompt: 'consent' + access_type: 'offline'
     → To ensure Refresh Token is obtained

  ② Conditions for obtaining a Refresh Token:
     → access_type: 'offline' is required
     → Issued only at the first authorization (by default)
     → Use prompt: 'consent' to force issuance every time
     → Without a Refresh Token, user is logged out when Access Token expires

  ③ Google One Tap:
     → A popup-based login displayed on the page
     → Directly receives a credential response, not an OAuth flow
     → Not directly supported by Auth.js;
       requires a custom implementation

  ④ Google Workspace (formerly G Suite) restrictions:
     → Use the hd parameter to restrict to an organization domain
     → Admins can control app access
     → Workspace users may need admin approval

  ⑤ Expiry of Google avatar URLs:
     → Google profile image URLs may change over time
     → Update periodically or cache locally
```

```typescript
// Implementing Google Workspace domain restriction
callbacks: {
  async signIn({ account, profile }) {
    if (account?.provider === 'google') {
      // Allow only specific domains
      const allowedDomains = ['mycompany.com', 'partner.com'];
      const email = profile?.email;

      if (!email) return false;

      const domain = email.split('@')[1];
      if (!allowedDomains.includes(domain)) {
        return '/login?error=DomainNotAllowed';
      }

      // Check email_verified
      if (!profile?.email_verified) {
        return '/login?error=EmailNotVerified';
      }
    }
    return true;
  },
}
```

```typescript
// Implementing Google Refresh Token Rotation
import { google } from 'googleapis';

async function refreshGoogleAccessToken(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    return {
      access_token: credentials.access_token!,
      expires_at: Math.floor(credentials.expiry_date! / 1000),
      refresh_token: credentials.refresh_token ?? refreshToken,
      // Google may not return a Refresh Token every time
      // → Retain the existing Refresh Token
    };
  } catch (error) {
    console.error('Failed to refresh Google access token:', error);
    throw error;
  }
}

// Used in Auth.js jwt callback
callbacks: {
  async jwt({ token, account }) {
    // First login: save tokens
    if (account) {
      return {
        ...token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        refresh_token: account.refresh_token,
        provider: account.provider,
      };
    }

    // If Access Token is still valid, return as-is
    if (token.expires_at && Date.now() < (token.expires_at as number) * 1000) {
      return token;
    }

    // If Access Token has expired, refresh it
    if (token.provider === 'google' && token.refresh_token) {
      try {
        const refreshed = await refreshGoogleAccessToken(
          token.refresh_token as string
        );
        return {
          ...token,
          access_token: refreshed.access_token,
          expires_at: refreshed.expires_at,
          refresh_token: refreshed.refresh_token,
        };
      } catch {
        // Refresh failed → prompt user to re-login
        return { ...token, error: 'RefreshAccessTokenError' };
      }
    }

    return token;
  },
}
```

---

## 3. GitHub Login

### 3.1 GitHub OAuth App vs GitHub App

```
Two types of OAuth methods on GitHub:

  ┌─────────────────┬──────────────────┬──────────────────────┐
  │ Item            │ OAuth App        │ GitHub App           │
  ├─────────────────┼──────────────────┼──────────────────────┤
  │ Created in      │ Developer settings│ Developer settings  │
  │                 │ > OAuth Apps     │ > GitHub Apps        │
  │ Scope control   │ User selects     │ Set at installation  │
  │ Org access      │ Requires         │ Per installation     │
  │                 │ separate approval│                      │
  │ Webhook         │ None             │ Available            │
  │ Installation    │ OAuth auth only  │ Install on account   │
  │                 │                  │ or organization      │
  │ Refresh Token   │ None             │ Available (8h valid) │
  │ Rate Limit      │ 5,000 req/h      │ 5,000 req/h (user)  │
  │                 │                  │ + installation limit │
  │ Recommended for │ Simple login     │ Repository access    │
  └─────────────────┴──────────────────┴──────────────────────┘

  OAuth App is sufficient for social login only.
  GitHub App is recommended when repository access is needed.
```

### 3.2 GitHub OAuth App Configuration

```
Steps to configure a GitHub OAuth App:

  ① Settings > Developer settings > OAuth Apps
  ② Create a new OAuth App
  ③ Configuration fields:
     · Application name: App name (displayed to users)
     · Homepage URL: https://myapp.com
     · Application description: Description of the app
     · Authorization callback URL:
       Development: http://localhost:3000/api/auth/callback/github
       Production: https://myapp.com/api/auth/callback/github
  ④ Obtain Client ID and Client Secret

  Important: GitHub OAuth App only supports one callback URL
  → Separate OAuth Apps are needed for development / staging / production
  → GitHub App supports multiple callback URLs

  Common scopes:
  ┌──────────────────┬────────────────────────────────────┐
  │ Scope            │ Description                        │
  ├──────────────────┼────────────────────────────────────┤
  │ (none)           │ Public info only (login, avatar)   │
  │ read:user        │ Read user profile                  │
  │ user:email       │ Obtain email address               │
  │ repo             │ Full access to private repositories│
  │ read:org         │ Read organization membership       │
  │ gist             │ Create Gists                       │
  │ admin:org        │ Manage organization                │
  └──────────────────┴────────────────────────────────────┘

  For login only: read:user user:email is sufficient
```

### 3.3 GitHub Provider Configuration (Auth.js v5)

```typescript
// auth.ts - Complete GitHub provider configuration
import GitHub from 'next-auth/providers/github';

export const githubProvider = GitHub({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,

  // Scope configuration
  authorization: {
    params: {
      scope: 'read:user user:email',
    },
  },

  // GitHub is not OpenID Connect, so uses /user API response
  profile(profile) {
    return {
      id: String(profile.id),              // Convert GitHub's numeric ID to string
      name: profile.name || profile.login,  // Use login if name is null
      email: profile.email,                 // May be null (see below)
      image: profile.avatar_url,            // Avatar URL
      role: 'viewer',                       // Default role
    };
  },
});
```

### 3.4 The GitHub Email Problem and Solutions

```
Issues with obtaining emails on GitHub:

  Cases where a GitHub user's email is null:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Email is set to private                         │
  │     → Settings > Emails > "Keep my email private"  │
  │     → profile.email becomes null                   │
  │                                                    │
  │  ② Email is not set as public                      │
  │     → Settings > Profile > "Public email" is empty │
  │                                                    │
  │  ③ user:email scope is not included                │
  │     → Email is not returned even from /user API    │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Solution: Fetch email via the /user/emails API
  → Requires user:email scope
  → Use the email that is both primary and verified
```

```typescript
// Complete implementation for fetching GitHub email
callbacks: {
  async signIn({ user, account, profile }) {
    // Handle case where email is null for GitHub provider
    if (account?.provider === 'github' && !user.email) {
      try {
        // Fetch email list via GitHub API
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!emailRes.ok) {
          console.error('Failed to fetch GitHub emails:', emailRes.status);
          return '/login?error=EmailFetchFailed';
        }

        const emails: Array<{
          email: string;
          primary: boolean;
          verified: boolean;
          visibility: string | null;
        }> = await emailRes.json();

        // Priority: primary + verified > verified > primary
        const primary = emails.find((e) => e.primary && e.verified);
        const verified = emails.find((e) => e.verified);

        const selectedEmail = primary?.email ?? verified?.email;

        if (selectedEmail) {
          user.email = selectedEmail;
        } else {
          // Deny login if no verified email exists
          return '/login?error=NoVerifiedEmail';
        }
      } catch (error) {
        console.error('Error fetching GitHub emails:', error);
        return '/login?error=EmailFetchFailed';
      }
    }
    return true;
  },
}
```

### 3.5 Access Control Based on GitHub Organization Membership

```typescript
// Validate GitHub organization membership to restrict access
async function checkGitHubOrgMembership(
  accessToken: string,
  allowedOrgs: string[]
): Promise<boolean> {
  const orgsRes = await fetch('https://api.github.com/user/orgs', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!orgsRes.ok) return false;

  const orgs: Array<{ login: string }> = await orgsRes.json();
  return orgs.some((org) => allowedOrgs.includes(org.login));
}

// Used in Auth.js callback
callbacks: {
  async signIn({ account }) {
    if (account?.provider === 'github') {
      const isMember = await checkGitHubOrgMembership(
        account.access_token!,
        ['my-company', 'my-team']
      );

      if (!isMember) {
        return '/login?error=OrgMembershipRequired';
      }
    }
    return true;
  },
}
```

```typescript
// Check GitHub team membership for a specific team
async function checkGitHubTeamMembership(
  accessToken: string,
  org: string,
  teamSlug: string
): Promise<boolean> {
  // Check team membership for self
  const res = await fetch(
    `https://api.github.com/orgs/${org}/teams/${teamSlug}/memberships/${username}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!res.ok) return false;

  const data = await res.json();
  return data.state === 'active';
}

// Assign role based on team membership
async function assignRoleByTeam(
  accessToken: string,
  org: string
): Promise<string> {
  // Check if member of admin team
  if (await checkGitHubTeamMembership(accessToken, org, 'admin')) {
    return 'admin';
  }

  // Check if member of editors team
  if (await checkGitHubTeamMembership(accessToken, org, 'editors')) {
    return 'editor';
  }

  // Otherwise, assign viewer
  return 'viewer';
}
```

---

## 4. Apple Login

### 4.1 Apple Developer Configuration

```
Detailed setup steps in Apple Developer:

  Prerequisites:
  ┌────────────────────────────────────────────────────┐
  │ · Apple Developer Program ($99/year) is required   │
  │ · A Services ID is required for web use            │
  │ · Configuration differs between iOS apps and web   │
  └────────────────────────────────────────────────────┘

  ① Register an App ID:
     → Certificates, Identifiers & Profiles
     → Identifiers > App IDs
     → Enable the Sign in with Apple capability
     → Bundle ID: com.mycompany.myapp

  ② Create a Services ID (for web):
     → Identifiers > Services IDs
     → Identifier: com.mycompany.myapp.web
     → Enable Sign in with Apple
     → Configure:
       · Primary App ID: the App ID created in ①
       · Website URLs:
         · Domains and Subdomains: myapp.com
         · Return URLs: https://myapp.com/api/auth/callback/apple

  ③ Create a Key:
     → Keys > Create a key
     → Key Name: MyApp Auth Key
     → Enable Sign in with Apple
     → Select Primary App ID in Configure
     → Register → Download (AuthKey_XXXXXXXXXX.p8)
     → Note the Key ID

  ④ Required environment variables:
     APPLE_CLIENT_ID=com.mycompany.myapp.web  (Services ID)
     APPLE_TEAM_ID=XXXXXXXXXX                 (Team ID)
     APPLE_KEY_ID=XXXXXXXXXX                  (Key ID)
     APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

  Important constraints:
  ┌────────────────────────────────────────────────────┐
  │ · The p8 file can only be downloaded once          │
  │ · Up to 2 keys can be created                      │
  │ · Up to 10 Return URLs can be configured           │
  │ · localhost cannot be used as a Return URL         │
  │   → A tunnel such as ngrok is needed in development│
  │ · clientSecret must be dynamically generated       │
  │   in JWT format                                    │
  └────────────────────────────────────────────────────┘
```

### 4.2 Apple Provider Configuration (Auth.js v5)

```typescript
// auth.ts - Complete Apple provider configuration
import Apple from 'next-auth/providers/apple';

export const appleProvider = Apple({
  clientId: process.env.APPLE_CLIENT_ID!,
  // clientSecret must be dynamically generated
  clientSecret: generateAppleClientSecret(),
});

// Generate Apple clientSecret
// Generate an ES256 JWT from the p8 private key
import * as jose from 'jose';

async function generateAppleClientSecret(): Promise<string> {
  // Retrieve the private key from the environment variable (restoring newlines)
  const privateKeyPem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');

  // Import the PKCS#8 private key
  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');

  // Generate the JWT
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: process.env.APPLE_KEY_ID!,  // Key ID
    })
    .setIssuedAt()
    .setExpirationTime('180d')  // Maximum 6 months
    .setAudience('https://appleid.apple.com')
    .setIssuer(process.env.APPLE_TEAM_ID!)   // Team ID
    .setSubject(process.env.APPLE_CLIENT_ID!) // Services ID
    .sign(privateKey);

  return jwt;
}
```

### 4.3 Apple-Specific Considerations and Edge Cases

```
Special behavior of Apple login:

  ① name and email are only returned on the first authorization:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  First login:                                      │
  │  {                                                 │
  │    "sub": "001234.abcdef...",                      │
  │    "email": "user@icloud.com",                     │
  │    "email_verified": true,                         │
  │    "name": { "firstName": "Taro", "lastName": "Yamada" }│
  │  }                                                 │
  │                                                    │
  │  Second login and beyond:                          │
  │  {                                                 │
  │    "sub": "001234.abcdef..."                       │
  │    // email and name are NOT included!             │
  │  }                                                 │
  │                                                    │
  │  Mitigation:                                       │
  │  → Always save to DB on first login                │
  │  → If saving fails, the user must go to Apple ID   │
  │    settings → "Stop using Apple ID" → re-authorize │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ② Private Email Relay (hide email feature):
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  When the user selects "Hide My Email":            │
  │  → xxxxx@privaterelay.appleid.com is returned      │
  │  → Emails are forwarded via Apple's relay service  │
  │                                                    │
  │  Relay email configuration:                        │
  │  → Certificates > More > Configure                 │
  │  → Register the sending domain in Email Sources    │
  │  → SPF / DKIM configuration is required            │
  │                                                    │
  │  Note:                                             │
  │  → The same user may return different email addrs  │
  │  → Account matching by email address is difficult  │
  │  → Matching by sub (user ID) is reliable           │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ③ clientSecret expiration:
     → JWT is valid for a maximum of 6 months
     → Must be regenerated every 6 months
     → Recommended to generate dynamically at app startup

  ④ Apple's review guidelines:
     → If providing social login in an iOS app,
       Sign in with Apple is mandatory
     → Optional for web-only services
```

```typescript
// Apple login first-time data saving implementation
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === 'apple') {
      // Apple's profile includes name only on first login
      const appleProfile = profile as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        is_private_email?: string;
      };

      // Auth.js sets name on the user object
      // (retrieved from the user parameter in the POST body)

      const existingUser = await prisma.user.findFirst({
        where: {
          accounts: {
            some: {
              provider: 'apple',
              providerAccountId: appleProfile.sub,
            },
          },
        },
      });

      if (!existingUser && user.email) {
        // New user: save the Private Relay email flag
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            image: user.image,
            isPrivateEmail: appleProfile.is_private_email === 'true',
          },
        });
      }
    }
    return true;
  },
}
```

```typescript
// Configuration for sending emails to Apple Private Relay addresses
// Must be registered with Apple as a relay email source

// Branching logic for email sending
async function sendEmail(to: string, subject: string, body: string) {
  const isAppleRelay = to.endsWith('@privaterelay.appleid.com');

  if (isAppleRelay) {
    // When sending via Apple Relay, the sending domain must be registered
    // From: noreply@myapp.com (domain registered with Apple)
    await sendViaRegisteredDomain(to, subject, body);
  } else {
    await sendNormally(to, subject, body);
  }
}
```

---

## 5. Other Providers

### 5.1 Microsoft (Azure AD / Entra ID)

```typescript
// Microsoft provider configuration
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

MicrosoftEntraID({
  clientId: process.env.AZURE_AD_CLIENT_ID!,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
  // Tenant ID (to allow only a specific organization)
  tenantId: process.env.AZURE_AD_TENANT_ID,
  // 'common': All Microsoft accounts
  // 'organizations': Organization accounts only
  // 'consumers': Personal accounts only
  // Specific tenant ID: Only that organization

  authorization: {
    params: {
      scope: 'openid email profile User.Read',
    },
  },

  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: null, // Microsoft does not return picture directly
      role: 'viewer',
    };
  },
});
```

### 5.2 Discord

```typescript
// Discord provider configuration
import Discord from 'next-auth/providers/discord';

Discord({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,

  authorization: {
    params: {
      scope: 'identify email guilds', // guilds also fetches server info
    },
  },

  profile(profile) {
    // Build Discord avatar URL
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${
          profile.avatar.startsWith('a_') ? 'gif' : 'png'
        }`
      : `https://cdn.discordapp.com/embed/avatars/${
          Number(profile.discriminator) % 5
        }.png`;

    return {
      id: profile.id,
      name: profile.username,
      email: profile.email,
      image: avatarUrl,
      role: 'viewer',
    };
  },
});
```

### 5.3 Provider Comparison Table

```
Comparison of major providers:

  ┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
  │ Item        │ Google   │ GitHub   │ Apple    │Microsoft │ Discord  │
  ├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
  │ Protocol    │ OIDC     │ OAuth2.0 │ OIDC     │ OIDC     │ OAuth2.0 │
  │ ID Token    │ ✓        │ ✗        │ ✓        │ ✓        │ ✗        │
  │ Email avail.│ ✓ always │ △ may be │ △ 1st    │ ✓ always │ ✓ always │
  │             │          │   null   │   time   │          │          │
  │ Email verif.│ ✓        │ ✓(sep API)│ ✓       │ ✓        │ △ may be │
  │             │          │          │          │          │   unverif│
  │ Refresh T.  │ ✓        │ ✗(OAuth) │ ✓        │ ✓        │ ✓        │
  │ Name avail. │ ✓ always │ △ may be │ △ 1st    │ ✓ always │ ✓ always │
  │             │          │   null   │   time   │          │          │
  │ Avatar      │ ✓        │ ✓        │ ✗        │ △(sep API)│ ✓       │
  │ Cost        │ Free     │ Free     │ $99/yr   │ Free     │ Free     │
  │ Review      │ Required │ Not req. │ Not req. │ Not req. │ Not req. │
  │ localhost   │ ✓        │ ✓        │ ✗        │ ✓        │ ✓        │
  │ Best for    │ General  │Developers│ iOS      │Enterprise│ Gamers   │
  └─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## 6. Account Linking

### 6.1 Account Linking Problems and Strategies

```
Account linking problems:

  Scenario:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Alice signs up with Google (alice@gmail.com)    │
  │  ② Later, Alice logs in with GitHub (alice@gmail.com)│
  │                                                    │
  │  Problem: Same email — how should this be handled? │
  │                                                    │
  │  Options:                                          │
  │  (a) Auto-link → Convenient but security risk      │
  │  (b) Create separate account → Safe but poor UX    │
  │  (c) Show error → Safe but poor UX                 │
  │  (d) Conditional auto-link → Balanced approach     │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Attack scenario (why auto-link is dangerous):
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Attacker knows victim@example.com               │
  │  ② Attacker registers victim@example.com on GitHub │
  │    (GitHub allows registration without email verif)│
  │  ③ Attacker logs into target service via GitHub    │
  │  ④ Auto-link associates account with victim's      │
  │  ⑤ Attacker can access victim's data!              │
  │                                                    │
  │  Mitigation: Only auto-link when email_verified    │
  │  is true                                           │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Auth.js default behavior:
  → allowDangerousEmailAccountLinking: false (default)
  → Does not link to existing accounts with the same email
  → OAuthAccountNotLinked error is raised
```

### 6.2 Implementing Secure Account Linking

```typescript
// Complete implementation of conditional automatic account linking
// auth.ts

import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Account, Profile, User } from 'next-auth';

export const authConfig = {
  adapter: PrismaAdapter(prisma),

  callbacks: {
    async signIn({
      user,
      account,
      profile,
    }: {
      user: User;
      account: Account | null;
      profile?: Profile;
    }) {
      if (!account || !user.email) return true;

      // Check for an existing user with the same email
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
        include: {
          accounts: {
            select: {
              provider: true,
              providerAccountId: true,
            },
          },
        },
      });

      // If new user, proceed as-is
      if (!existingUser) return true;

      // If already linked with this provider, proceed as-is
      const isLinked = existingUser.accounts.some(
        (a) => a.provider === account.provider
      );
      if (isLinked) return true;

      // Check email verification status
      const isEmailVerified = checkEmailVerification(
        account.provider,
        profile
      );

      if (!isEmailVerified) {
        // If not verified: redirect to error page
        return `/login?error=OAuthAccountNotLinked&provider=${account.provider}`;
      }

      // If verified: link account to existing user
      try {
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });

        // Record the link event
        await prisma.auditLog.create({
          data: {
            userId: existingUser.id,
            action: 'account_linked',
            metadata: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              linkedAt: new Date().toISOString(),
            },
          },
        });

        // Align Auth.js user ID with existing user
        user.id = existingUser.id;
      } catch (error) {
        console.error('Failed to link account:', error);
        return '/login?error=LinkFailed';
      }

      return true;
    },
  },
};

// Check email verification per provider
function checkEmailVerification(
  provider: string,
  profile?: Profile
): boolean {
  switch (provider) {
    case 'google':
      // Google: determined by the email_verified field
      return (profile as any)?.email_verified === true;

    case 'github':
      // GitHub: /user/emails API only returns verified emails
      // If user:email scope is present, can be considered verified
      return true;

    case 'apple':
      // Apple: email_verified is always true (guaranteed by Apple)
      return (profile as any)?.email_verified === true;

    case 'microsoft-entra-id':
      // Microsoft: determined by the email_verified field
      return (profile as any)?.email_verified === true;

    default:
      // Unknown providers: err on the side of caution
      return false;
  }
}
```

### 6.3 Manual Account Linking (Settings Page)

```typescript
// app/settings/accounts/page.tsx - Account management page (Server Component)
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LinkedAccountsList } from './linked-accounts-list';

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  // Fetch linked accounts for the user
  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Check if user has a password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  const hasPassword = !!user?.password;
  const canUnlink = accounts.length > 1 || hasPassword;

  return (
    <div>
      <h1>Account Connections</h1>
      <LinkedAccountsList
        accounts={accounts}
        canUnlink={canUnlink}
      />
    </div>
  );
}
```

```typescript
// app/settings/accounts/actions.ts - Server Actions
'use server';

import { auth, signIn } from '@/auth';
import { revalidatePath } from 'next/cache';

// Start account linking
export async function linkAccount(provider: string) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  // Call signIn to start the OAuth flow
  await signIn(provider, {
    redirectTo: '/settings/accounts',
  });
}

// Unlink an account
export async function unlinkAccount(
  _prevState: any,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session) return { error: 'Unauthorized' };

  const provider = formData.get('provider') as string;
  if (!provider) return { error: 'Provider is required' };

  // Check number of linked accounts
  const accountCount = await prisma.account.count({
    where: { userId: session.user.id },
  });

  // Check if user has a password
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  // Cannot remove the last login method
  if (accountCount <= 1 && !user?.password) {
    return {
      error: 'Cannot unlink this connection as it is your only login method.',
    };
  }

  try {
    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'account_unlinked',
        metadata: { provider },
      },
    });

    revalidatePath('/settings/accounts');
    return { success: true };
  } catch {
    return { error: 'Failed to unlink account.' };
  }
}
```

```typescript
// app/settings/accounts/linked-accounts-list.tsx - Client Component
'use client';

import { useActionState } from 'react';
import { linkAccount, unlinkAccount } from './actions';

const providerInfo: Record<string, { name: string; icon: string; color: string }> = {
  google:   { name: 'Google',    icon: '/icons/google.svg',  color: '#4285F4' },
  github:   { name: 'GitHub',    icon: '/icons/github.svg',  color: '#333333' },
  apple:    { name: 'Apple',     icon: '/icons/apple.svg',   color: '#000000' },
  discord:  { name: 'Discord',   icon: '/icons/discord.svg', color: '#5865F2' },
};

const allProviders = ['google', 'github', 'apple'];

export function LinkedAccountsList({
  accounts,
  canUnlink,
}: {
  accounts: Array<{ id: string; provider: string; createdAt: Date }>;
  canUnlink: boolean;
}) {
  const [state, dispatch] = useActionState(unlinkAccount, {});

  const linkedProviders = new Set(accounts.map((a) => a.provider));
  const unlinkedProviders = allProviders.filter((p) => !linkedProviders.has(p));

  return (
    <div className="space-y-4">
      {/* Linked accounts */}
      <h2>Connected Accounts</h2>
      {accounts.map((account) => {
        const info = providerInfo[account.provider];
        return (
          <div key={account.id} className="flex items-center justify-between p-4 border rounded">
            <div className="flex items-center gap-3">
              <img src={info?.icon} alt="" className="w-6 h-6" />
              <span>{info?.name ?? account.provider}</span>
              <span className="text-sm text-gray-500">
                Connected: {new Date(account.createdAt).toLocaleDateString('en-US')}
              </span>
            </div>
            {canUnlink && (
              <form action={dispatch}>
                <input type="hidden" name="provider" value={account.provider} />
                <button type="submit" className="text-red-500 hover:text-red-700">
                  Disconnect
                </button>
              </form>
            )}
          </div>
        );
      })}

      {/* Unlinked providers */}
      {unlinkedProviders.length > 0 && (
        <>
          <h2>Add Connections</h2>
          {unlinkedProviders.map((provider) => {
            const info = providerInfo[provider];
            return (
              <div key={provider} className="flex items-center justify-between p-4 border rounded">
                <div className="flex items-center gap-3">
                  <img src={info?.icon} alt="" className="w-6 h-6" />
                  <span>{info?.name ?? provider}</span>
                </div>
                <form action={() => linkAccount(provider)}>
                  <button type="submit" className="text-blue-500 hover:text-blue-700">
                    Connect
                  </button>
                </form>
              </div>
            );
          })}
        </>
      )}

      {state.error && (
        <p className="text-red-500">{state.error}</p>
      )}
    </div>
  );
}
```

---

## 7. Profile Synchronization

### 7.1 Profile Sync on Login

```typescript
// Complete profile synchronization implementation
// Update profile with the latest info from the provider on each login

callbacks: {
  async signIn({ user, account, profile }) {
    if (!account || !user.id) return true;

    // Build profile sync data
    const syncData: Record<string, any> = {
      lastLoginAt: new Date(),
      lastLoginProvider: account.provider,
    };

    // Fetch profile info per provider
    switch (account.provider) {
      case 'google': {
        const googleProfile = profile as {
          name?: string;
          picture?: string;
          locale?: string;
        };
        if (googleProfile.name) syncData.name = googleProfile.name;
        if (googleProfile.picture) syncData.image = googleProfile.picture;
        if (googleProfile.locale) syncData.locale = googleProfile.locale;
        break;
      }

      case 'github': {
        const githubProfile = profile as {
          name?: string;
          login: string;
          avatar_url?: string;
          bio?: string;
          company?: string;
          location?: string;
          blog?: string;
        };
        if (githubProfile.name) syncData.name = githubProfile.name;
        if (githubProfile.avatar_url) syncData.image = githubProfile.avatar_url;
        // Additional fields (if present in schema)
        if (githubProfile.bio) syncData.bio = githubProfile.bio;
        if (githubProfile.company) syncData.company = githubProfile.company;
        break;
      }

      case 'apple': {
        // Apple does not return name after the first login,
        // so do not overwrite existing data
        // Identify by sub only
        break;
      }
    }

    // Do not change email (for security reasons)
    // → Email changes should be handled via a separate flow

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: syncData,
      });
    } catch (error) {
      // Sync failure should not block login
      console.error('Profile sync failed:', error);
    }

    // Update Access Token / Refresh Token
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
      data: {
        access_token: account.access_token,
        refresh_token: account.refresh_token ?? undefined,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      },
    });

    return true;
  },
}
```

### 7.2 Local Caching of Avatar Images

```typescript
// Provider avatar URLs may change over time
// Cache locally to provide a stable URL

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function cacheAvatar(
  userId: string,
  avatarUrl: string
): Promise<string> {
  try {
    // Download the image
    const response = await fetch(avatarUrl);
    if (!response.ok) throw new Error('Failed to fetch avatar');

    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize and optimize
    const optimized = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to S3
    const key = `avatars/${userId}.webp`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AVATAR_BUCKET!,
      Key: key,
      Body: optimized,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=86400', // Cache for 1 day
    }));

    return `${process.env.CDN_URL}/${key}`;
  } catch (error) {
    console.error('Avatar cache failed:', error);
    return avatarUrl; // Fallback: return the original URL
  }
}
```

---

## 8. Social Login UX

### 8.1 Login Page Implementation

```typescript
// app/login/page.tsx - Social login page
import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  // Redirect if already logged in
  const session = await auth();
  if (session) redirect(searchParams.callbackUrl || '/dashboard');

  const callbackUrl = searchParams.callbackUrl || '/dashboard';

  // Error message mapping
  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked:
      'This email address is registered with a different login method. Please log in using the original method.',
    OAuthSignin: 'Failed to initiate login. Please try again.',
    OAuthCallback: 'Authentication failed. Please try again.',
    Callback: 'An error occurred during authentication.',
    AccessDenied: 'Access denied.',
    DomainNotAllowed: 'Login is not allowed for this domain.',
    OrgMembershipRequired: 'Organization membership is required.',
    EmailFetchFailed: 'Failed to retrieve email address.',
    NoVerifiedEmail: 'No verified email address found.',
    Default: 'Login failed. Please try again.',
  };

  const error = searchParams.error;
  const errorMessage = error
    ? errorMessages[error] || errorMessages.Default
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="mt-2 text-gray-600">
            Sign in to your account
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        )}

        <div className="space-y-3">
          {/* Google */}
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3
                         border border-gray-300 rounded-lg hover:bg-gray-50
                         transition-colors"
            >
              <GoogleIcon className="w-5 h-5" />
              <span>Continue with Google</span>
            </button>
          </form>

          {/* Apple */}
          <form
            action={async () => {
              'use server';
              await signIn('apple', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3
                         bg-black text-white rounded-lg hover:bg-gray-900
                         transition-colors"
            >
              <AppleIcon className="w-5 h-5" />
              <span>Continue with Apple</span>
            </button>
          </form>

          {/* GitHub */}
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: callbackUrl });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3
                         bg-gray-800 text-white rounded-lg hover:bg-gray-700
                         transition-colors"
            >
              <GitHubIcon className="w-5 h-5" />
              <span>Continue with GitHub</span>
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Email / password form (fallback) */}
        <EmailPasswordForm callbackUrl={callbackUrl} />

        <p className="text-center text-xs text-gray-500">
          By logging in, you agree to our{' '}
          <a href="/terms" className="underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
```

### 8.2 UX Best Practices

```
UX best practices for social login:

  ① Button order and placement:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  Recommended order (by usage rate):                │
  │    1. Google (most popular, approx. 60%)           │
  │    2. Apple (popular among iOS users)              │
  │    3. GitHub (top priority for developer services) │
  │    4. Email / password (fallback)                  │
  │                                                    │
  │  Adjust based on target audience:                  │
  │  · Developer-facing → GitHub at the top            │
  │  · B2B SaaS  → Google + Microsoft at the top      │
  │  · Gaming    → Add Discord                         │
  │  · Japanese market → Consider LINE login           │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ② Button design:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ✓ Recommended:                                    │
  │  → Follow each provider's brand guidelines         │
  │  → Use "Continue with Google" style labels         │
  │  → Use official logos                              │
  │  → Sufficient touch target size (44px or more)     │
  │                                                    │
  │  ✗ Avoid:                                          │
  │  → Use "Continue with" not "Sign in with"          │
  │    (removes distinction between sign-up and login) │
  │  → Using custom icons (violates brand guidelines)  │
  │  → Listing 5 or more providers (choice fatigue)    │
  │  → Text-only links with just the provider name     │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ③ Error handling:
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  User-friendly messages:                           │
  │                                                    │
  │  ✓ "This email is registered with Google.          │
  │     Please log in with Google."                    │
  │                                                    │
  │  ✗ "OAuthAccountNotLinked"                         │
  │                                                    │
  │  ✓ "Login was cancelled.                           │
  │     Please try again."                             │
  │                                                    │
  │  ✗ "access_denied: user denied access"             │
  │                                                    │
  └────────────────────────────────────────────────────┘

  ④ Handling callbackUrl:
     → Return user to the page they tried to access before login
     → Validation is mandatory to prevent open redirect attacks
     → Prohibit redirects to external URLs
```

```typescript
// callbackUrl validation
function validateCallbackUrl(url: string | undefined): string {
  const defaultUrl = '/dashboard';

  if (!url) return defaultUrl;

  try {
    const parsed = new URL(url, process.env.NEXTAUTH_URL);
    const appHost = new URL(process.env.NEXTAUTH_URL!).host;

    // Allow only the same host (prevent open redirect)
    if (parsed.host !== appHost) {
      return defaultUrl;
    }

    // Block specific paths
    const blockedPaths = ['/api/', '/auth/'];
    if (blockedPaths.some((p) => parsed.pathname.startsWith(p))) {
      return defaultUrl;
    }

    return parsed.pathname + parsed.search;
  } catch {
    return defaultUrl;
  }
}
```

---

## 9. Security Hardening

### 9.1 state Parameter and CSRF Defense

```
OAuth state parameter:

  Purpose: Prevent CSRF attacks

  Attack scenario (without state):
  ┌────────────────────────────────────────────────────┐
  │                                                    │
  │  ① Attacker initiates OAuth with their own Google  │
  │    account                                         │
  │  ② Attacker obtains the redirect URL (with code)   │
  │  ③ Attacker tricks the victim into visiting the URL│
  │  ④ Victim's browser sends the code to the server   │
  │  ⑤ Server creates a session for the attacker's     │
  │    account                                         │
  │  ⑥ Victim operates under the attacker's account    │
  │    (data leakage)                                  │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Auth.js handles state automatically:
  → Generates a random state value
  → Stores it in a Cookie (HttpOnly, SameSite=Lax)
  → Validates the match on callback
  → Rejects authentication if mismatched

  Auth.js also handles PKCE automatically:
  → Generates and stores code_verifier
  → Includes code_challenge in the authorization request
  → Sends code_verifier during token exchange
```

### 9.2 Token Storage Security

```typescript
// Secure storage of Access Token / Refresh Token

// Prisma Schema - Token encryption
// model Account {
//   ...
//   access_token_encrypted   String?
//   refresh_token_encrypted  String?
//   ...
// }

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
// 32 bytes = 256-bit key for AES-256

function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Store in iv:authTag:encrypted format
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Wrap the Auth.js adapter to enable encryption
import { PrismaAdapter } from '@auth/prisma-adapter';

function encryptedAdapter(prisma: PrismaClient) {
  const adapter = PrismaAdapter(prisma);

  return {
    ...adapter,
    async linkAccount(account: any) {
      // Encrypt tokens before saving
      const encryptedAccount = {
        ...account,
        access_token: account.access_token
          ? encryptToken(account.access_token)
          : null,
        refresh_token: account.refresh_token
          ? encryptToken(account.refresh_token)
          : null,
      };
      return adapter.linkAccount!(encryptedAccount);
    },
  };
}
```

### 9.3 Rate Limiting and Brute-Force Prevention

```typescript
// Rate limiting for social login
// Prevent large numbers of login attempts in a short time

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const loginRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'), // Up to 5 times per minute
  analytics: true,
  prefix: 'ratelimit:login',
});

// Apply rate limiting in middleware.ts
export async function middleware(request: NextRequest) {
  // Rate limit requests to /api/auth/signin
  if (request.nextUrl.pathname.startsWith('/api/auth/signin')) {
    const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success, remaining, reset } = await loginRatelimit.limit(ip);

    if (!success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          'X-RateLimit-Remaining': String(remaining),
        },
      });
    }
  }

  return NextResponse.next();
}
```

---

## 10. Edge Cases and Troubleshooting

### 10.1 Common Issues and Solutions

```
Troubleshooting social login:

  ┌─────────────────────┬──────────────────────────────────────┐
  │ Problem             │ Solution                             │
  ├─────────────────────┼──────────────────────────────────────┤
  │ OAuthAccountNotLinked│ Same email already registered with  │
  │                     │ another provider                     │
  │                     │ → Implement account linking feature  │
  ├─────────────────────┼──────────────────────────────────────┤
  │ redirect_uri_mismatch│ Callback URL mismatch               │
  │                     │ → Check provider settings            │
  │                     │ → Watch for trailing slash           │
  ├─────────────────────┼──────────────────────────────────────┤
  │ CSRF error          │ state mismatch                       │
  │                     │ → Check Cookie settings              │
  │                     │ → Verify SameSite=Lax                │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Token expired       │ Refresh Token was not obtained       │
  │                     │ → Google: set prompt=consent +       │
  │                     │   access_type=offline                │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Apple name is null  │ name is not returned after first     │
  │                     │ login                                │
  │                     │ → Always save on first login         │
  │                     │ → Re-authorize from Apple ID settings│
  ├─────────────────────┼──────────────────────────────────────┤
  │ GitHub email null   │ Email set to private                 │
  │                     │ → user:email scope +                 │
  │                     │   /user/emails API to retrieve       │
  ├─────────────────────┼──────────────────────────────────────┤
  │ NEXT_REDIRECT error │ signIn called inside Server Action   │
  │                     │ → Next.js behavior. Re-throw         │
  │                     │   NEXT_REDIRECT in try-catch         │
  ├─────────────────────┼──────────────────────────────────────┤
  │ Not working in dev  │ Missing localhost configuration      │
  │                     │ → Google/GitHub: add localhost       │
  │                     │ → Apple: tunnel such as ngrok needed │
  └─────────────────────┴──────────────────────────────────────┘
```

### 10.2 Debugging

```typescript
// Enable Auth.js debug mode
// auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === 'development',
  // This outputs detailed logs to the console

  logger: {
    error(code, ...message) {
      console.error(`[Auth Error] ${code}:`, ...message);
    },
    warn(code, ...message) {
      console.warn(`[Auth Warn] ${code}:`, ...message);
    },
    debug(code, ...message) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth Debug] ${code}:`, ...message);
      }
    },
  },

  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('[Auth Event] signIn:', {
        userId: user.id,
        provider: account?.provider,
        isNewUser,
      });
    },
    async signOut(message) {
      console.log('[Auth Event] signOut:', message);
    },
    async linkAccount({ user, account }) {
      console.log('[Auth Event] linkAccount:', {
        userId: user.id,
        provider: account.provider,
      });
    },
    async createUser({ user }) {
      console.log('[Auth Event] createUser:', { userId: user.id });
    },
  },
});
```

---

## 11. Anti-Patterns

### 11.1 Exposing Client Secret to the Frontend

```typescript
// ✗ Dangerous: exposing Client Secret to the frontend
// Frontend code
const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'xxx',
    client_secret: 'EXPOSED_SECRET', // Never do this!
    code: authorizationCode,
  }),
});

// ✓ Correct: token exchange on the server side
// Auth.js handles this automatically on the server side
// Client Secret is read from environment variables and used only on the server
```

### 11.2 Linking Accounts Without Checking email_verified

```typescript
// ✗ Dangerous: auto-linking without email verification
callbacks: {
  async signIn({ user, account }) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email! },
    });
    if (existing) {
      // Linking without email verification → account takeover is possible!
      await prisma.account.create({
        data: { userId: existing.id, ...account },
      });
    }
    return true;
  },
}

// ✓ Correct: verify email_verified before linking
// (use the checkEmailVerification function described above)
```

### 11.3 Forgetting to Save Apple First-Login Data

```typescript
// ✗ Problem: Apple profile info not saved on first login
callbacks: {
  async signIn({ user, account }) {
    // Proceeds even if Apple's name is null
    // → name cannot be retrieved on subsequent logins!
    return true;
  },
}

// ✓ Correct: always save name / email on first login
// (refer to the Apple implementation above)
```

---

## 12. Exercises

### Exercise 1: Basic — Implement Google + GitHub Login (Difficulty: Basic)

```
Task:
  Implement social login with Google and GitHub using
  Next.js App Router + Auth.js v5.

Requirements:
  ① Configure Google and GitHub providers
  ② Add provider buttons to the login page
  ③ Redirect to dashboard after login
  ④ Display user info in the header (name + avatar)
  ⑤ Logout functionality

Hints:
  → Configure providers in auth.ts
  → Expose handlers via app/api/auth/[...nextauth]/route.ts
  → Wrap client components with SessionProvider

Verification checklist:
  □ Can log in with Google
  □ Can log in with GitHub
  □ Logout works
  □ Session is correctly maintained
```

### Exercise 2: Applied — Implement Account Linking (Difficulty: Applied)

```
Task:
  Build on Exercise 1 and implement conditional
  automatic account linking.

Requirements:
  ① Auto-link only when email_verified is true
  ② Display list of linked accounts on the settings page
  ③ Account unlinking functionality
  ④ The last login method cannot be unlinked
  ⑤ Log link / unlink events to the audit log

Hints:
  → Handle linking in the signIn callback
  → Create a /settings/accounts page
  → Implement link/unlink via Server Actions

Verification checklist:
  □ Register with Google → auto-link with GitHub using the same email
  □ Account list displays correctly
  □ Unlinking is only possible when 2 or more accounts are linked
  □ Audit log is recorded
```

### Exercise 3: Advanced — Multi-Tenant Social Login (Difficulty: Advanced)

```
Task:
  Implement social login for a SaaS application with multiple
  organizations (tenants), where allowed providers are controlled
  per organization.

Requirements:
  ① Configure allowed providers per organization (admin panel)
  ② Google Workspace domain restriction
  ③ Access control based on GitHub organization membership
  ④ Automatic organization assignment for new users (email domain-based)
  ⑤ Per-organization SSO configuration (Google Workspace / Azure AD)
  ⑥ Users can belong to multiple organizations

Hints:
  → Add allowedProviders to the Organization model
  → Check domain / org membership in the signIn callback
  → Include organization info in the token via the jwt callback

Verification checklist:
  □ Org A allows only Google, Org B allows only GitHub
  □ Domain restriction works correctly
  □ New users are assigned to the correct organization
  □ Organization switching works
```

---

## 13. FAQ

### Q1: Is it safe to operate with social login only and no passwords?

```
A: Yes, it is safe. In fact, going passwordless often improves security.

Reasons:
  → No risk of password leakage
  → Not a target for brute-force attacks
  → Can leverage the provider's 2FA / MFA
  → No need to implement a password reset flow

Caveats:
  → Risk if the provider account is compromised
  → Login becomes unavailable during provider outages
  → Providing multiple providers is recommended (as fallbacks)
```

### Q2: What if the same user uses different emails for Google and GitHub?

```
A: Automatic linking is not possible. Provide a manual linking feature.

Recommended flow:
  ① User logs in with Google (alice@gmail.com)
  ② Clicks "Connect GitHub" on the settings page
  ③ GitHub OAuth flow begins
  ④ On callback, the account is added to the existing user
  ⑤ Either login method works from that point on

Implementation notes:
  → Start the link flow while the user is already logged in
  → Check the session's userId in the signIn callback
  → Can link different emails to the same user
```

### Q3: I cannot send emails to Apple Private Relay addresses

```
A: You need to configure Apple's Private Email Relay.

Steps:
  ① Apple Developer > Certificates > More > Configure
  ② Register your sending domain in "Email Sources"
  ③ SPF record configuration:
     v=spf1 include:_spf.appleid.apple.com ~all
  ④ DKIM configuration (follow your email service provider's instructions)
  ⑤ Only emails sent from registered domains are allowed

Notes:
  → Since Apple relays the messages, bounce detection is difficult
  → Users may disable forwarding from their Apple ID settings
  → Use in-app notifications alongside for important alerts
```

### Q4: What changed for social login when migrating from Auth.js v4 to v5?

```
A: Key changes:

  ① Import path changes:
     v4: import GoogleProvider from 'next-auth/providers/google'
     v5: import Google from 'next-auth/providers/google'
     → Providers changed to default exports

  ② Config file structure:
     v4: pages/api/auth/[...nextauth].ts
     v5: auth.ts (root level) + app/api/auth/[...nextauth]/route.ts

  ③ Adapter change:
     v4: @next-auth/prisma-adapter
     v5: @auth/prisma-adapter

  ④ Callback arguments:
     v4: profile parameter was typed as any
     v5: profile type is defined per provider

  ⑤ signIn / signOut calls:
     v4: import { signIn } from 'next-auth/react'
     v5: Server: import { signIn } from '@/auth'
         Client: import { signIn } from 'next-auth/react'
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Rather than theory alone, understanding deepens by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Protocol | Google/Apple use OIDC; GitHub uses OAuth 2.0 |
| Google | Use prompt=consent + access_type=offline to obtain Refresh Token |
| GitHub | email may be null. Retrieve via /user/emails API |
| Apple | name/email only on first login. clientSecret requires dynamic JWT generation |
| Account Linking | Auto-link only when email_verified. Also provide manual link UI |
| Security | state + PKCE are handled automatically by Auth.js. Store tokens encrypted |
| UX | Use "Continue with" format, follow brand guidelines, show specific error messages |

---

## Further Reading


---

## References

1. Auth.js. "Providers." authjs.dev, 2024.
2. Google. "Sign in with Google for Web." developers.google.com/identity, 2024.
3. Apple. "Sign in with Apple." developer.apple.com/sign-in-with-apple, 2024.
4. GitHub. "Authorizing OAuth Apps." docs.github.com, 2024.
5. IETF. "RFC 6749 — The OAuth 2.0 Authorization Framework." tools.ietf.org, 2012.
6. IETF. "RFC 7636 — Proof Key for Code Exchange (PKCE)." tools.ietf.org, 2015.
7. OpenID Foundation. "OpenID Connect Core 1.0." openid.net/specs, 2014.
8. OWASP. "OAuth 2.0 Security." cheatsheetseries.owasp.org, 2024.
