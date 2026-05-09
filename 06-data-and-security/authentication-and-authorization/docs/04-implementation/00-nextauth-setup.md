# NextAuth.js (Auth.js) Setup

> NextAuth.js (now Auth.js) is the de facto authentication library for Next.js. This guide covers everything from basic Auth.js setup to production deployment, including provider configuration, session management, database adapters, and callback customization.

## Prerequisites

- Familiarity with Next.js App Router fundamentals (Server Components, Server Actions)
- Understanding of OAuth 2.0 / OpenID Connect concepts

## What You Will Learn

- [ ] Understand the basic setup of Auth.js
- [ ] Learn how to configure providers, adapters, and callbacks
- [ ] Implement session management and customization
- [ ] Understand when to use JWT vs Database session strategies
- [ ] Learn security configuration for production environments
- [ ] Master error handling and troubleshooting

---

## 1. Auth.js Architecture

### 1.1 Overall Structure

```
Auth.js Architecture:

  ┌──────────────────────────────────────────────────────────┐
  │                    Next.js Application                    │
  │                                                          │
  │  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
  │  │ Server      │  │ Client        │  │ Middleware    │  │
  │  │ Components  │  │ Components    │  │              │  │
  │  │             │  │               │  │ Route Guard  │  │
  │  │ auth()      │  │ useSession()  │  │ auth()       │  │
  │  └──────┬──────┘  └───────┬───────┘  └──────┬───────┘  │
  │         │                 │                  │          │
  │         └─────────────────┼──────────────────┘          │
  │                           │                             │
  │                   ┌───────┴───────┐                     │
  │                   │   auth.ts     │ ← Central auth config│
  │                   │               │                     │
  │                   │ - providers   │                     │
  │                   │ - adapter     │                     │
  │                   │ - callbacks   │                     │
  │                   │ - session     │                     │
  │                   │ - pages       │                     │
  │                   └───────┬───────┘                     │
  │                           │                             │
  │              ┌────────────┼────────────┐                │
  │              │            │            │                │
  │         ┌────┴────┐  ┌───┴───┐  ┌────┴─────┐          │
  │         │Providers│  │Adapter│  │Callbacks │          │
  │         │         │  │       │  │          │          │
  │         │Google   │  │Prisma │  │jwt()     │          │
  │         │GitHub   │  │Drizzle│  │session() │          │
  │         │Creds    │  │       │  │signIn()  │          │
  │         └─────────┘  └───┬───┘  └──────────┘          │
  │                          │                             │
  │                    ┌─────┴─────┐                       │
  │                    │ Database  │                       │
  │                    │ (Users,   │                       │
  │                    │  Accounts,│                       │
  │                    │  Sessions)│                       │
  │                    └───────────┘                       │
  └──────────────────────────────────────────────────────────┘
```

### 1.2 Authentication Flow in Detail

```
OAuth Provider Authentication Flow (inside Auth.js):

  ┌────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐
  │Browser │     │ Next.js  │     │Auth.js  │     │Provider  │
  │        │     │          │     │         │     │(Google)  │
  └───┬────┘     └────┬─────┘     └────┬────┘     └────┬─────┘
      │               │               │               │
      │ Click         │               │               │
      │ "Sign in"     │               │               │
      │──────────────→│               │               │
      │               │ signIn()      │               │
      │               │──────────────→│               │
      │               │               │ Build Auth URL│
      │               │               │──────────────→│
      │               │ Redirect 302  │               │
      │←──────────────│               │               │
      │                               │               │
      │ User consents on Google        │               │
      │───────────────────────────────────────────────→│
      │                               │               │
      │ Redirect to callback URL      │               │
      │ /api/auth/callback/google     │               │
      │  ?code=AUTH_CODE&state=...    │               │
      │──────────────→│               │               │
      │               │ handleCallback│               │
      │               │──────────────→│               │
      │               │               │ Exchange code │
      │               │               │──────────────→│
      │               │               │ access_token  │
      │               │               │←──────────────│
      │               │               │               │
      │               │               │ Fetch profile │
      │               │               │──────────────→│
      │               │               │ user info     │
      │               │               │←──────────────│
      │               │               │               │
      │               │ signIn callback│              │
      │               │ jwt callback   │              │
      │               │ session callback│             │
      │               │               │               │
      │               │ Create/Update │               │
      │               │ User in DB    │               │
      │               │               │               │
      │ Set Session   │               │               │
      │ Cookie        │               │               │
      │←──────────────│               │               │
      │               │               │               │
      │ Redirect to   │               │               │
      │ callbackUrl   │               │               │
      │←──────────────│               │               │
```

### 1.3 JWT vs Database Sessions

```
Comparison of Session Strategies:

  ┌─────────────────┬────────────────────┬────────────────────┐
  │                 │ JWT Strategy       │ Database Strategy  │
  ├─────────────────┼────────────────────┼────────────────────┤
  │ Data storage    │ Cookie (encrypted  │ DB + Cookie (ID)   │
  │                 │ JWT)               │                    │
  │ Server state    │ Stateless          │ Stateful           │
  │ Scalability     │ ◎ High            │ ○ DB-dependent     │
  │ Session expiry  │ △ Difficult       │ ◎ Immediate        │
  │ Data capacity   │ △ Cookie limit    │ ◎ Unlimited        │
  │                 │ (4KB)             │                    │
  │ DB load         │ ◎ None           │ △ Every request    │
  │ Credentials     │ ◎ Supported      │ ✗ Not supported    │
  │ Session listing │ ✗ Not possible   │ ◎ Possible         │
  │ Force logout    │ △ Needs blocklist │ ◎ Instant via DB   │
  │ Default         │ ○               │ When Adapter set   │
  └─────────────────┴────────────────────┴────────────────────┘

  Selection criteria:
  → Using Credentials Provider → JWT required
  → Need immediate session expiry → Database
  → Prioritizing scalability → JWT
  → Need session management features → Database
  → Typical web application → JWT (simpler)
```

---

## 2. Basic Setup

### 2.1 Installation and Initial Configuration

```bash
# Installation
npm install next-auth@beta @auth/prisma-adapter
npm install @prisma/client prisma bcrypt
npm install -D @types/bcrypt

# Generate AUTH_SECRET
npx auth secret
# or
openssl rand -base64 32
```

### 2.2 Main Authentication Configuration File

```typescript
// auth.ts (main authentication configuration file)
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Database adapter (persists users, accounts, and sessions)
  adapter: PrismaAdapter(prisma),

  // Authentication providers
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Input validation
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        // If no password set (social login only)
        if (!user?.password) return null;

        // Verify password (bcrypt)
        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) return null;

        // Authentication successful: return user object
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          orgId: user.orgId,
        };
      },
    }),
  ],

  // Session configuration
  session: {
    strategy: 'jwt',  // JWT session (required when using Credentials)
    maxAge: 30 * 24 * 60 * 60, // 30 days (in seconds)
    updateAge: 24 * 60 * 60,   // Update session every 24 hours
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Custom pages
  pages: {
    signIn: '/login',       // Login page
    error: '/login',        // Redirect on error
    newUser: '/onboarding', // Redirect for new users
    // signOut: '/logout',  // Sign-out page (optional)
    // verifyRequest: '/verify', // Email verification page (optional)
  },

  // Callback functions
  callbacks: {
    // Add custom data to JWT
    async jwt({ token, user, trigger, session, account }) {
      // On initial sign-in (user exists)
      if (user) {
        token.role = user.role;
        token.orgId = user.orgId;
      }

      // When saving provider access_token
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;
      }

      // On session update (when update() is called)
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.image = session.image;
      }

      return token;
    },

    // Expose custom data to session
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as string;
      session.user.orgId = token.orgId as string;
      return session;
    },

    // Access control (used in middleware)
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Check protected routes
      const protectedPaths = ['/dashboard', '/admin', '/settings'];
      const isProtected = protectedPaths.some(p => pathname.startsWith(p));

      if (isProtected && !isLoggedIn) {
        return false; // Redirect to login page
      }

      // Check admin routes
      if (pathname.startsWith('/admin')) {
        return auth?.user?.role === 'admin';
      }

      return true;
    },

    // Control sign-in behavior
    async signIn({ user, account, profile }) {
      // Email verification check (for Google)
      if (account?.provider === 'google') {
        return profile?.email_verified === true;
      }

      // Check for blocked users
      if (user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { blockedAt: true },
        });
        if (dbUser?.blockedAt) {
          return false; // Deny sign-in
        }
      }

      return true;
    },
  },

  // Event handlers
  events: {
    async signIn({ user, account, isNewUser }) {
      // Login audit log
      console.log(`User ${user.email} signed in via ${account?.provider}`);

      if (isNewUser) {
        // Send welcome email to new user
        // await sendWelcomeEmail(user.email!);
      }

      // Update last login timestamp
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },

    async signOut(message) {
      // Sign-out audit log
      if ('token' in message) {
        console.log(`User ${message.token?.email} signed out`);
      }
    },

    async createUser({ user }) {
      // Handle new user creation
      console.log(`New user created: ${user.email}`);
    },
  },

  // Debug mode (development only)
  debug: process.env.NODE_ENV === 'development',

  // Custom cookie configuration
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
});
```

### 2.3 API Route Handler

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;

// Note: In Auth.js v5, simply exporting handlers is sufficient
// GET: OAuth callback, CSRF token retrieval, etc.
// POST: Sign-in, sign-out, etc.
```

### 2.4 Middleware Configuration

```typescript
// middleware.ts
export { auth as middleware } from '@/auth';

export const config = {
  // Specify matching paths
  // Exclude static files and API routes
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

```
Middleware Matching Patterns:

  matcher regex:
  /((?!api/auth|_next/static|_next/image|favicon.ico|public).*)

  ┌────────────────────────┬──────────┬──────────────────────┐
  │ Path                   │ Matches  │ Reason               │
  ├────────────────────────┼──────────┼──────────────────────┤
  │ /dashboard             │ ✓        │ Protected route      │
  │ /admin/users           │ ✓        │ Protected route      │
  │ /api/auth/callback     │ ✗        │ Auth.js internal     │
  │ /api/users             │ ✓        │ Custom API           │
  │ /_next/static/...      │ ✗        │ Static files         │
  │ /favicon.ico           │ ✗        │ Favicon              │
  │ /login                 │ ✓        │ Page                 │
  └────────────────────────┴──────────┴──────────────────────┘
```

---

## 3. Type Definition Extensions

### 3.1 TypeScript Type Declarations

```typescript
// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

// Extend User type
declare module 'next-auth' {
  interface User extends DefaultUser {
    role: string;
    orgId?: string;
    blockedAt?: Date | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string;
      orgId?: string;
    } & DefaultSession['user'];
  }
}

// Extend JWT type
declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role?: string;
    orgId?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}
```

### 3.2 Prisma Schema

```prisma
// prisma/schema.prisma

// Models required by Auth.js
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?   // For Credentials authentication
  role          String    @default("viewer")
  orgId         String?
  blockedAt     DateTime?
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]

  org           Organization? @relation(fields: [orgId], references: [id])

  @@index([email])
  @@index([orgId])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())

  users User[]
}
```

```
Auth.js Database Schema Explained:

  ┌──────────────────────────────────────────────────┐
  │                    User                           │
  │ - Application user information                    │
  │ - email obtained via social login                 │
  │ - password for Credentials auth (optional)        │
  │ - role, orgId, etc. are custom fields             │
  └──────────────┬───────────────┬───────────────────┘
                 │               │
                 │ 1:N           │ 1:N
                 │               │
  ┌──────────────┴──────┐  ┌────┴──────────────────┐
  │      Account        │  │      Session          │
  │ - OAuth accounts    │  │ - For DB session      │
  │ - One per provider  │  │   strategy            │
  │ - Stores           │  │ - Unused in JWT        │
  │   access_token      │  │   strategy            │
  └─────────────────────┘  │ - Has expiration      │
                            └───────────────────────┘

  ┌───────────────────────┐
  │  VerificationToken    │
  │ - For email           │
  │   verification        │
  │ - For Magic Links     │
  │ - One-time token      │
  └───────────────────────┘
```

---

## 4. Using Sessions

### 4.1 Getting Sessions in Server Components

```typescript
// Get session in Server Component
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
      <p>Organization: {session.user.orgId}</p>
    </div>
  );
}

export default DashboardPage;
```

### 4.2 Getting Sessions in Client Components

```typescript
// Get session in Client Component
'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

function UserMenu() {
  const { data: session, status, update } = useSession();

  if (status === 'loading') return <Skeleton />;
  if (!session) return <Link href="/login">Login</Link>;

  // Update session information
  const handleNameChange = async (newName: string) => {
    await update({ name: newName });
    // → Triggers jwt callback with trigger === 'update'
  };

  return (
    <div className="flex items-center gap-3">
      <img
        src={session.user.image!}
        alt={session.user.name!}
        className="w-8 h-8 rounded-full"
      />
      <div>
        <span className="font-medium">{session.user.name}</span>
        <span className="text-xs text-gray-500 block">{session.user.role}</span>
      </div>
    </div>
  );
}

export default UserMenu;
```

### 4.3 Sessions in Server Actions

```typescript
// Session in Server Action
'use server';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function createArticle(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  // Role check
  if (!['editor', 'admin'].includes(session.user.role)) {
    throw new Error('Forbidden: editors only');
  }

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  // Validation
  if (!title || title.length < 1 || title.length > 200) {
    throw new Error('Invalid title');
  }

  await prisma.article.create({
    data: {
      title,
      content,
      authorId: session.user.id,
      orgId: session.user.orgId,
    },
  });

  revalidatePath('/articles');
}
```

### 4.4 Sessions in API Routes

```typescript
// app/api/articles/route.ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const articles = await prisma.article.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(articles);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['editor', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();

  const article = await prisma.article.create({
    data: {
      ...body,
      authorId: session.user.id,
      orgId: session.user.orgId,
    },
  });

  return NextResponse.json(article, { status: 201 });
}
```

---

## 5. Sign In and Sign Out

### 5.1 Implementing the Login Page

```typescript
// app/login/page.tsx
'use client';
import { signIn } from 'next-auth/react';
import { useState, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  // Error message mapping
  const errorMessages: Record<string, string> = {
    OAuthSignin: 'Failed to initiate social login',
    OAuthCallback: 'An error occurred during the social login callback',
    OAuthAccountNotLinked: 'This email address is already registered with a different login method',
    CredentialsSignin: 'Invalid email address or password',
    SessionRequired: 'Login is required',
    Default: 'Login failed. Please try again',
  };

  const urlError = searchParams.get('error');
  const displayError = error || (urlError ? errorMessages[urlError] || errorMessages.Default : '');

  // Social login
  const handleSocialLogin = async (provider: string) => {
    setLoading(true);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setError('Login failed');
      setLoading(false);
    }
  };

  // Email/password login
  const handleCredentialsLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);

    try {
      const result = await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      });

      if (result?.error) {
        setError(errorMessages.CredentialsSignin);
      } else {
        router.push(callbackUrl);
        router.refresh(); // Update session state
      }
    } catch {
      setError(errorMessages.Default);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Login</h1>

      {displayError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {displayError}
        </div>
      )}

      {/* Social login */}
      <div className="space-y-2 mb-6">
        <button
          onClick={() => handleSocialLogin('google')}
          disabled={loading}
          className="w-full p-3 border rounded flex items-center justify-center gap-2
                     hover:bg-gray-50 disabled:opacity-50"
        >
          <GoogleIcon className="w-5 h-5" />
          Continue with Google
        </button>
        <button
          onClick={() => handleSocialLogin('github')}
          disabled={loading}
          className="w-full p-3 border rounded flex items-center justify-center gap-2
                     hover:bg-gray-50 disabled:opacity-50"
        >
          <GitHubIcon className="w-5 h-5" />
          Continue with GitHub
        </button>
      </div>

      {/* Separator */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">or</span>
        </div>
      </div>

      {/* Email/password */}
      <form onSubmit={handleCredentialsLogin} className="space-y-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
          required
          disabled={loading}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          minLength={8}
          className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
          required
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-blue-500 text-white rounded hover:bg-blue-600
                     disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-blue-500 hover:underline">Sign up</a>
      </p>
    </div>
  );
}

export default LoginPage;
```

### 5.2 Sign Out

```typescript
// Sign out via Server Action (recommended)
// components/SignOutButton.tsx
import { signOut } from '@/auth';

function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    >
      <button type="submit" className="text-gray-600 hover:text-gray-900">
        Logout
      </button>
    </form>
  );
}

// Sign out via Client Component
'use client';
import { signOut } from 'next-auth/react';

function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/' })}>
      Logout
    </button>
  );
}
```

---

## 6. SessionProvider Configuration

```typescript
// app/layout.tsx
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="ja">
      <body>
        <SessionProvider
          session={session}
          // Auto-update interval for session (in seconds)
          refetchInterval={5 * 60}
          // Re-fetch when window regains focus
          refetchOnWindowFocus={true}
          // refetchWhenOffline={false}
        >
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

```
How SessionProvider Works:

  ┌──────────────────────────────────────────────────┐
  │ SessionProvider                                   │
  │                                                   │
  │ 1. Receives initial session via props             │
  │    → Pass from Server Component using auth()      │
  │    → Session is immediately available on first    │
  │      render                                       │
  │                                                   │
  │ 2. Periodically refreshes via refetchInterval     │
  │    → Requests to /api/auth/session                │
  │    → Detects session expiration                   │
  │                                                   │
  │ 3. Updates on focus via refetchOnWindowFocus      │
  │    → When switching back to the tab               │
  │    → Keeps session state up to date               │
  │                                                   │
  │ 4. Accessible anywhere via useSession()           │
  │    → status: 'loading' | 'authenticated'          │
  │              | 'unauthenticated'                   │
  └──────────────────────────────────────────────────┘
```

---

## 7. Environment Variables

```bash
# .env.local

# NextAuth required
AUTH_SECRET=your-random-secret-at-least-32-characters
AUTH_URL=http://localhost:3000  # Use https://myapp.com in production

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# How to generate AUTH_SECRET:
#   npx auth secret
#   or: openssl rand -base64 32

# AUTH_TRUST_HOST=true  # Required when behind a proxy
```

```
Notes on Environment Variables:

  ┌────────────────────┬─────────────────────────────────────┐
  │ Variable           │ Notes                               │
  ├────────────────────┼─────────────────────────────────────┤
  │ AUTH_SECRET        │ Always use a randomly generated      │
  │                    │ value in production                  │
  │                    │ Minimum 32 characters                │
  │                    │ Use different values per environment │
  ├────────────────────┼─────────────────────────────────────┤
  │ AUTH_URL           │ Usually not needed in v5 (auto-      │
  │                    │ detected)                            │
  │                    │ Set explicitly when behind a proxy   │
  ├────────────────────┼─────────────────────────────────────┤
  │ GOOGLE_CLIENT_*    │ Issued from Google Cloud Console     │
  │                    │ Remember to configure redirect URIs  │
  ├────────────────────┼─────────────────────────────────────┤
  │ GITHUB_CLIENT_*    │ GitHub Settings > Developer settings │
  │                    │ Issued from OAuth App                │
  ├────────────────────┼─────────────────────────────────────┤
  │ DATABASE_URL       │ Connection string                    │
  │                    │ Add connection pool settings for     │
  │                    │ production                           │
  └────────────────────┴─────────────────────────────────────┘
```

---

## 8. Advanced Customization

### 8.1 Access Token Refresh (Refresh Token Rotation)

```typescript
// Add to callbacks in auth.ts
callbacks: {
  async jwt({ token, account }) {
    // Initial sign-in: save token information
    if (account) {
      return {
        ...token,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        accessTokenExpires: account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000,
      };
    }

    // Access token is still valid
    if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
      return token;
    }

    // Refresh access token
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken as string,
        }),
      });

      const tokens = await response.json();

      if (!response.ok) throw tokens;

      return {
        ...token,
        accessToken: tokens.access_token,
        accessTokenExpires: Date.now() + tokens.expires_in * 1000,
        // Update refresh_token if returned (Rotation)
        refreshToken: tokens.refresh_token ?? token.refreshToken,
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return {
        ...token,
        error: 'RefreshTokenError',
      };
    }
  },
}
```

### 8.2 Server-Side Implementation of Custom Sign-In Page

```typescript
// Server Action-based sign-in (recommended pattern)
// app/login/actions.ts
'use server';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
  prevState: { error: string } | undefined,
  formData: FormData
) {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid credentials' };
        case 'AccessDenied':
          return { error: 'Account is blocked' };
        default:
          return { error: 'Something went wrong' };
      }
    }
    throw error; // Re-throw unexpected errors
  }
}

// app/login/page.tsx
'use client';
import { useActionState } from 'react';
import { authenticate } from './actions';

export default function LoginPage() {
  const [state, action, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={action}>
      {state?.error && <p className="text-red-500">{state.error}</p>}

      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />

      <button type="submit" disabled={isPending}>
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

### 8.3 Role-Based Layouts

```typescript
// app/dashboard/layout.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
  admin,
  viewer,
}: {
  children: React.ReactNode;
  admin: React.ReactNode;
  viewer: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="flex">
      <aside className="w-64 bg-gray-100 min-h-screen p-4">
        <nav>
          <NavLink href="/dashboard">Dashboard</NavLink>
          {session.user.role === 'admin' && (
            <>
              <NavLink href="/dashboard/users">Users</NavLink>
              <NavLink href="/dashboard/settings">Settings</NavLink>
            </>
          )}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
```

---

## 9. Edge Cases and Troubleshooting

### 9.1 Common Problems and Solutions

```
Auth.js Common Issues:

  ┌─────────────────────────────┬──────────────────────────────────┐
  │ Problem                     │ Solution                         │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ NEXTAUTH_URL not found      │ Set AUTH_URL in .env.local        │
  │                             │ In v5, auto-detected; may be      │
  │                             │ unnecessary                       │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ Error with Credentials +    │ Set session.strategy = 'jwt'      │
  │ Adapter                     │ JWT strategy is required for      │
  │                             │ Credentials                       │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ OAuth callback error        │ Set redirect URI exactly          │
  │                             │ Verify in provider settings       │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ No id in session            │ Use token.sub in jwt callback     │
  │                             │ Set it in session callback        │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ Cookie not set              │ Check Secure attribute and        │
  │                             │ HTTP/HTTPS                        │
  │                             │ Check SameSite configuration      │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ TypeScript type error       │ Create next-auth.d.ts             │
  │                             │ Add to tsconfig include           │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ No redirect after login     │ Call router.refresh()             │
  │                             │ Set callbackUrl properly          │
  ├─────────────────────────────┼──────────────────────────────────┤
  │ Cannot get session          │ Check SessionProvider             │
  │                             │ Check Server/Client usage         │
  └─────────────────────────────┴──────────────────────────────────┘
```

### 9.2 Anti-Patterns

```
Auth.js Anti-Patterns:

  ✗ Anti-pattern 1: Returning specific error messages inside authorize
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: can be a source for user           │
  │ // enumeration attacks                           │
  │ if (!user) throw new Error('User not found');    │
  │ if (!isValid) throw new Error('Wrong password'); │
  │                                                   │
  │ // Correct: use a generic error message          │
  │ if (!user || !isValid) return null;              │
  └──────────────────────────────────────────────────┘

  ✗ Anti-pattern 2: Including sensitive data in JWT
  ┌──────────────────────────────────────────────────┐
  │ // Dangerous: JWT can be decoded on the client   │
  │ token.creditCardNumber = user.creditCard;        │
  │ token.ssn = user.socialSecurityNumber;           │
  │                                                   │
  │ // Correct: include only minimal information     │
  │ token.role = user.role;                          │
  │ token.orgId = user.orgId;                        │
  └──────────────────────────────────────────────────┘

  ✗ Anti-pattern 3: Authorization checks only in Client Components
  ┌──────────────────────────────────────────────────┐
  │ // Insufficient: can be bypassed via DevTools    │
  │ if (session?.user.role !== 'admin') return null; │
  │                                                   │
  │ // Correct: check in both Server and Client      │
  │ // Server: auth() + redirect()                   │
  │ // Client: for display optimization only         │
  └──────────────────────────────────────────────────┘
```

---

## 10. Production Configuration

### 10.1 Security Checklist

```
Pre-deployment Checklist:

  □ AUTH_SECRET is randomly generated per environment
  □ OAuth provider redirect URIs updated to production URL
  □ Cookie secure attribute is true (HTTPS)
  □ Cookie sameSite is 'lax' or stricter
  □ debug: false (production environment)
  □ Rate limiting configured for Credentials Provider
  □ Input validation (Zod, etc.) applied to all endpoints
  □ CSRF protection is enabled
  □ Session maxAge is appropriate
  □ No sensitive data included in JWT
  □ Error messages cannot be used for user enumeration
  □ Database connection pooling configured
  □ Log output level is appropriate
```

### 10.2 Performance Optimization

```
Auth.js Performance Optimization:

  ┌──────────────────────┬──────────────────────────────────┐
  │ Optimization Point   │ Approach                         │
  ├──────────────────────┼──────────────────────────────────┤
  │ DB connections       │ PgBouncer / PrismaAccelerate     │
  │                      │ Connection pooling               │
  ├──────────────────────┼──────────────────────────────────┤
  │ Session retrieval    │ Avoid DB access with JWT strategy │
  │                      │ Consider caching for DB strategy  │
  ├──────────────────────┼──────────────────────────────────┤
  │ Middleware           │ Exclude unnecessary paths via     │
  │                      │ matcher                           │
  │                      │ Skip static files                 │
  ├──────────────────────┼──────────────────────────────────┤
  │ SessionProvider      │ Set refetchInterval appropriately │
  │                      │ Too short increases API load      │
  ├──────────────────────┼──────────────────────────────────┤
  │ bcrypt               │ saltRounds = 10-12 (default 10)  │
  │                      │ Too high makes login slow         │
  └──────────────────────┴──────────────────────────────────┘
```

---

## 11. Exercises

### Exercise 1: Basics - Auth.js Basic Setup

```
[Exercise 1] Auth.js Basic Setup

Goal: Introduce Auth.js into a Next.js project and implement a basic authentication flow

Steps:
1. Create a Next.js project (App Router)
2. Install and configure Auth.js
3. Configure the Google OAuth provider
4. Configure the Prisma adapter (SQLite)
5. Create a login page
6. Create a protected dashboard page
7. Configure SessionProvider

Evaluation criteria:
  □ Google login works
  □ Session information is displayed
  □ Unauthenticated users are redirected
  □ Sign out works
```

### Exercise 2: Applied - Credentials + Role-Based Access Control

```
[Exercise 2] Credentials + Role-Based Access Control

Goal: Implement email/password authentication and role-based authorization

Steps:
1. Add Credentials Provider
2. Implement user registration form (hash with bcrypt)
3. Type extension to include role in JWT
4. Role-based route guard in Middleware
5. Display control based on role in Server Components
6. Role check in Server Actions

Evaluation criteria:
  □ Registration and login work
  □ Three roles: admin / editor / viewer
  □ Different page access per role
  □ Session information retrieved in a type-safe manner
```

### Exercise 3: Advanced - Multi-Provider + Account Linking

```
[Exercise 3] Multi-Provider + Account Linking

Goal: Implement multiple providers and account linking

Steps:
1. Configure 3 providers: Google + GitHub + Credentials
2. Auto-link same email address (with email_verified check)
3. Account link/unlink in settings page
4. Implement Refresh Token Rotation
5. Implement security audit log

Evaluation criteria:
  □ Login possible with all 3 providers
  □ Accounts with the same email are auto-linked
  □ Link management available in settings page
  □ Cannot delete the last login method
```

---

## 12. FAQ

### Q1: What are the main differences between v4 and v5?

```
Main Changes from Auth.js v4 to v5:

  ┌──────────────────────┬──────────────────┬──────────────────┐
  │ Feature              │ v4               │ v5               │
  ├──────────────────────┼──────────────────┼──────────────────┤
  │ Package name         │ next-auth        │ next-auth@beta   │
  │ Config file          │ [...nextauth].ts │ auth.ts          │
  │ API route            │ pages/api/auth/  │ app/api/auth/    │
  │ Server retrieval     │ getServerSession │ auth()           │
  │ Middleware           │ withAuth         │ auth as middleware│
  │ Type extension       │ next-auth.d.ts   │ Same             │
  │ Edge support         │ Experimental     │ Official         │
  │ Server Actions       │ Not supported    │ Supported        │
  │ signIn/signOut export│ None             │ From auth.ts     │
  └──────────────────────┴──────────────────┴──────────────────┘
```

### Q2: What are the caveats when using Credentials Provider?

```
A: The Credentials Provider has the following limitations:

  1. Session strategy: JWT required (Database strategy not supported)
  2. Adapter: Account / Session tables are not used
  3. Security:
     → Password hashing must be implemented yourself
     → Rate limiting must be implemented yourself
     → Brute force protection must be implemented yourself
  4. Recommendations:
     → Prefer OAuth providers when possible
     → Use Credentials as a supplementary login method
     → Also consider Magic Links
```

### Q3: Can I use it with Drizzle ORM?

```
A: Yes. @auth/drizzle-adapter is officially provided.

  npm install @auth/drizzle-adapter

  import { DrizzleAdapter } from '@auth/drizzle-adapter';
  import { db } from '@/lib/db';

  export const { handlers, auth } = NextAuth({
    adapter: DrizzleAdapter(db),
    ...
  });
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|---------|
| Setup | Centrally managed in auth.ts; export handlers/auth/signIn/signOut |
| Providers | Combine Google, GitHub, Credentials, etc. |
| Session | JWT strategy (when using Credentials) / Database strategy |
| Callbacks | Flow data through jwt → session in order |
| Type definitions | Extend User, Session, JWT in next-auth.d.ts |
| Server | Retrieve session with auth() (Server Components, Actions, API Routes) |
| Client | useSession() + SessionProvider |
| Middleware | Route guard via authorized callback |
| Production | AUTH_SECRET, Cookie configuration, error handling |

---

## Further Reading

---

## References
1. Auth.js. "Getting Started." authjs.dev, 2024.
2. Auth.js. "Providers." authjs.dev/reference, 2024.
3. Auth.js. "Adapters." authjs.dev/reference/adapter, 2024.
4. Auth.js. "Callbacks." authjs.dev/reference/callbacks, 2024.
5. Next.js. "Authentication." nextjs.org/docs, 2024.
6. Auth.js. "Upgrade Guide (v4 to v5)." authjs.dev/getting-started/migrating-to-v5, 2024.
7. Prisma. "Auth.js Adapter." prisma.io/docs, 2024.
