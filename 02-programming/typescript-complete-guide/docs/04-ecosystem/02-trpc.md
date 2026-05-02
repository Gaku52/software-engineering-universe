# tRPC Complete Guide

> A schema-free RPC framework that achieves type safety between client and server using only TypeScript type inference

## What You Will Learn

1. **tRPC Basics** -- Router definition, procedures, and integration with zod input validation
2. **Client Integration** -- Usage with React (@trpc/react-query), Next.js, and vanilla clients
3. **Advanced Patterns** -- Middleware, error handling, subscriptions, and testing strategies
4. **Performance Optimization** -- Batching, caching strategies, and response optimization
5. **Production Operations** -- Deployment, monitoring, security, and scaling


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Prisma + TypeScript Complete Guide](./01-prisma-typescript.md)

---

## 1. tRPC Basics

### 1-1. Concept

```
tRPC Type Sharing Model:

  Traditional REST API:
  +---------+    HTTP    +---------+
  | Client  | ---------> | Server  |
  +---------+    JSON    +---------+
  No types (any)           Typed
  → Manually sync type definitions or generate via OpenAPI

  tRPC:
  +---------+    HTTP    +---------+
  | Client  | ---------> | Server  |
  +---------+            +---------+
       |                      |
       +--- TypeScript type inference ---+
  Types shared directly (no code generation needed!)

  The server's router types are inferred
  directly as the client's types
```

### 1-2. Server Setup

```typescript
// server/trpc.ts -- tRPC initialization
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

// Context type
interface Context {
  userId: string | null;
  db: PrismaClient;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

// Exports
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

### 1-3. Router Definition

```typescript
// server/routers/user.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const UserCreateInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
});

const UserUpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export const userRouter = router({
  // Query: fetch data
  list: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: { createdAt: "desc" },
      });
      const total = await ctx.db.user.count();
      return { users, total, page: input.page };
    }),

  // Query: fetch single
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        include: { profile: true },
      });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `User ${input.id} not found`,
        });
      }
      return user;
    }),

  // Mutation: create
  create: publicProcedure
    .input(UserCreateInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.create({ data: input });
    }),

  // Mutation: update
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UserUpdateInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  // Mutation: delete
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

### 1-4. Root Router

```typescript
// server/routers/_app.ts
import { router } from "../trpc";
import { userRouter } from "./user";
import { postRouter } from "./post";

export const appRouter = router({
  user: userRouter,
  post: postRouter,
});

// Export type (used on the client)
export type AppRouter = typeof appRouter;
```

### 1-5. Advanced Context Creation Patterns

```typescript
// server/context.ts -- Advanced context creation
import { inferAsyncReturnType } from "@trpc/server";
import { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import { prisma } from "../db";

/**
 * Context creation function
 * Called per request, creates shared state accessible from all procedures
 */
export async function createContext(opts: CreateNextContextOptions) {
  const session = await getServerSession(opts.req, opts.res, authOptions);

  return {
    session,
    userId: session?.user?.id ?? null,
    db: prisma,
    req: opts.req,
    res: opts.res,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
```

```typescript
// server/context.ts -- For Fetch API (App Router / Edge Runtime)
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getToken } from "next-auth/jwt";

export async function createContext(opts: FetchCreateContextFnOptions) {
  // Get token from headers
  const authHeader = opts.req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  let userId: string | null = null;
  if (token) {
    try {
      const decoded = await verifyJWT(token);
      userId = decoded.sub;
    } catch {
      // Invalid token -- userId remains null
    }
  }

  return {
    userId,
    db: prisma,
    requestId: crypto.randomUUID(),
    ip: opts.req.headers.get("x-forwarded-for") ?? "unknown",
  };
}
```

### 1-6. Advanced Input Schema Definitions

```typescript
// server/schemas/user.ts -- Reusable schemas
import { z } from "zod";

// Base schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["USER", "ADMIN", "MODERATOR"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Partial type (for PATCH updates)
export const UserUpdateSchema = UserSchema.pick({
  name: true,
  email: true,
  role: true,
}).partial();

// For creation (omitting id, timestamps)
export const UserCreateSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// For filtering
export const UserFilterSchema = z.object({
  search: z.string().optional(),
  role: z.enum(["USER", "ADMIN", "MODERATOR"]).optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
});

// For pagination (generic)
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Combined
export const UserListInput = PaginationSchema.merge(UserFilterSchema);

// Type extraction (usable in other files)
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserFilter = z.infer<typeof UserFilterSchema>;
```

```typescript
// server/routers/user.ts -- Router using external schemas
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  UserCreateSchema,
  UserUpdateSchema,
  UserListInput,
} from "../schemas/user";

export const userRouter = router({
  list: publicProcedure
    .input(UserListInput)
    .query(async ({ ctx, input }) => {
      const { page, limit, sortBy, sortOrder, search, role } = input;

      const where = {
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }),
        ...(role && { role }),
      };

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: sortOrder },
        }),
        ctx.db.user.count({ where }),
      ]);

      return {
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      };
    }),

  create: protectedProcedure
    .input(UserCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate email
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }
      return ctx.db.user.create({ data: input });
    }),
});
```

---

## 2. Middleware and Authentication

### 2-1. Authentication Middleware

```
Middleware chain:

  Request
     |
     v
  +--------------------+
  | publicProcedure    |  Anyone can access
  +--------------------+
     |
     v
  +--------------------+
  | isAuthed           |  Login required
  | (middleware)       |  Guarantees ctx.userId
  +--------------------+
     |
     v
  +--------------------+
  | isAdmin            |  Admins only
  | (middleware)       |  Guarantees ctx.user.role
  +--------------------+
     |
     v
  Procedure execution
```

```typescript
// Authentication middleware
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }

  const user = await ctx.db.user.findUnique({
    where: { id: ctx.userId },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // string (guaranteed non-null)
      user,               // User type added to ctx
    },
  });
});

// Admin middleware
const isAdmin = middleware(async ({ ctx, next }) => {
  // Intended for use after isAuthed
  if ((ctx as any).user?.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// Procedure bases
const protectedProcedure = publicProcedure.use(isAuthed);
const adminProcedure = protectedProcedure.use(isAdmin);

// Usage example
export const adminRouter = router({
  listAllUsers: adminProcedure.query(async ({ ctx }) => {
    // ctx.user is guaranteed to be of type User
    return ctx.db.user.findMany();
  }),
});
```

### 2-2. Logging Middleware

```typescript
// server/middleware/logging.ts
import { middleware } from "../trpc";

/**
 * Middleware that logs request timing and path
 */
export const loggerMiddleware = middleware(async ({ path, type, next }) => {
  const start = Date.now();

  const result = await next();

  const durationMs = Date.now() - start;
  const meta = {
    path,
    type,         // "query" | "mutation" | "subscription"
    durationMs,
    ok: result.ok,
  };

  if (result.ok) {
    console.log(`[tRPC] ${type} ${path} - ${durationMs}ms OK`);
  } else {
    console.error(`[tRPC] ${type} ${path} - ${durationMs}ms ERROR`, meta);
  }

  return result;
});

// Apply to all procedures
export const publicProcedure = t.procedure.use(loggerMiddleware);
```

### 2-3. Rate Limiting Middleware

```typescript
// server/middleware/rateLimit.ts
import { middleware } from "../trpc";
import { TRPCError } from "@trpc/server";

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number;  // Window duration (milliseconds)
  maxRequests: number;  // Maximum requests within the window
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return middleware(async ({ ctx, next }) => {
    const key = ctx.userId ?? ctx.ip ?? "anonymous";
    const now = Date.now();

    let record = rateLimitMap.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + options.windowMs };
      rateLimitMap.set(key, record);
    }

    record.count++;

    if (record.count > options.maxRequests) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil(
          (record.resetAt - now) / 1000
        )} seconds`,
      });
    }

    return next();
  });
}

// Usage example
const rateLimitedProcedure = publicProcedure.use(
  createRateLimitMiddleware({
    windowMs: 60_000,   // 1 minute
    maxRequests: 100,    // Maximum 100 requests
  })
);

// Redis-based rate limiting (recommended for production)
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export function createRedisRateLimitMiddleware(options: RateLimitOptions) {
  return middleware(async ({ ctx, next }) => {
    const key = `ratelimit:${ctx.userId ?? ctx.ip ?? "anon"}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.pexpire(key, options.windowMs);
    }

    if (current > options.maxRequests) {
      const ttl = await redis.pttl(key);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil(ttl / 1000)}s`,
      });
    }

    return next();
  });
}
```

### 2-4. Organization-Based Access Control Middleware

```typescript
// server/middleware/organization.ts
import { middleware } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

/**
 * Middleware that validates organization membership
 * Used after protectedProcedure
 */
export const withOrganization = middleware(async ({ ctx, next, rawInput }) => {
  // Extract orgId from rawInput
  const parsed = z.object({ orgId: z.string() }).safeParse(rawInput);
  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization ID is required",
    });
  }

  const membership = await ctx.db.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: ctx.userId,
        organizationId: parsed.data.orgId,
      },
    },
    include: { organization: true },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }

  return next({
    ctx: {
      ...ctx,
      organization: membership.organization,
      memberRole: membership.role, // "OWNER" | "ADMIN" | "MEMBER"
    },
  });
});

// Organization admin only
export const withOrgAdmin = middleware(async ({ ctx, next }) => {
  if (!["OWNER", "ADMIN"].includes((ctx as any).memberRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization admin access required",
    });
  }
  return next({ ctx });
});

// Procedure definitions
const orgProcedure = protectedProcedure.use(withOrganization);
const orgAdminProcedure = orgProcedure.use(withOrgAdmin);

// Usage example
export const orgRouter = router({
  getMembers: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.db.organizationMember.findMany({
        where: { organizationId: ctx.organization.id },
        include: { user: true },
      });
    }),

  removeMember: orgAdminProcedure
    .input(z.object({
      orgId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Cannot remove OWNER
      const target = await ctx.db.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: input.memberId,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (target?.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the organization owner",
        });
      }

      await ctx.db.organizationMember.delete({
        where: {
          userId_organizationId: {
            userId: input.memberId,
            organizationId: ctx.organization.id,
          },
        },
      });

      return { success: true };
    }),
});
```

---

## 3. Client Integration

### 3-1. React + React Query

```typescript
// utils/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();
```

```typescript
// app/providers.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "../utils/trpc";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
      headers: () => ({
        Authorization: `Bearer ${getToken()}`,
      }),
    }),
  ],
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

```typescript
// components/UserList.tsx
import { trpc } from "../utils/trpc";

export function UserList() {
  // Query: types are automatically inferred
  const { data, isLoading, error } = trpc.user.list.useQuery({
    page: 1,
    limit: 20,
  });
  // data type: { users: User[]; total: number; page: number } | undefined

  // Mutation
  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      // Invalidate cache and refetch
      utils.user.list.invalidate();
    },
  });

  const utils = trpc.useUtils();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.users.map((user) => (
        <div key={user.id}>
          {user.name} ({user.email})
        </div>
      ))}
      <button
        onClick={() =>
          createUser.mutate({
            name: "New User",
            email: "new@example.com",
          })
        }
      >
        Add User
      </button>
    </div>
  );
}
```

### 3-2. Next.js App Router Integration

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../../../server/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      // Create context from request
      const userId = await getUserIdFromRequest(req);
      return { userId, db: prisma };
    },
  });

export { handler as GET, handler as POST };
```

### 3-3. Server-Side Calls

```typescript
// Call directly from Server Components
import { appRouter } from "../server/routers/_app";

// Server-side caller
const caller = appRouter.createCaller({
  userId: null,
  db: prisma,
});

export default async function UsersPage() {
  // Call directly server-side (no HTTP needed)
  const { users } = await caller.user.list({ page: 1, limit: 20 });

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### 3-4. Vanilla Client (Without React)

```typescript
// client/vanilla.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/routers/_app";

// Pure tRPC client without React
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
      headers: () => ({
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      }),
    }),
  ],
});

// Execute a query
async function fetchUsers() {
  const result = await client.user.list.query({
    page: 1,
    limit: 10,
  });
  // result type is automatically inferred
  console.log(result.users);
  console.log(result.total);
}

// Execute a mutation
async function createUser(name: string, email: string) {
  const newUser = await client.user.create.mutate({
    name,
    email,
  });
  // newUser type is also inferred from the server's return value
  console.log(`Created user: ${newUser.id}`);
}

// Usage from Node.js scripts or CLI tools
async function main() {
  try {
    await fetchUsers();
    await createUser("Alice", "alice@example.com");
  } catch (err) {
    if (err instanceof TRPCClientError) {
      console.error("tRPC Error:", err.message);
      console.error("Error code:", err.data?.code);
    }
  }
}
```

### 3-5. Optimistic Updates

```typescript
// components/TodoList.tsx -- Complete optimistic update example
import { trpc } from "../utils/trpc";

export function TodoList() {
  const utils = trpc.useUtils();

  const { data: todos } = trpc.todo.list.useQuery();

  const toggleTodo = trpc.todo.toggle.useMutation({
    // Optimistic update: update UI without waiting for server response
    onMutate: async (input) => {
      // 1. Cancel in-progress refetches (to avoid overwriting optimistic update)
      await utils.todo.list.cancel();

      // 2. Snapshot current data
      const previousTodos = utils.todo.list.getData();

      // 3. Optimistically update the cache
      utils.todo.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((todo) =>
          todo.id === input.id
            ? { ...todo, completed: !todo.completed }
            : todo
        );
      });

      // 4. Return context for rollback
      return { previousTodos };
    },

    // On error: rollback to snapshot
    onError: (_err, _input, context) => {
      if (context?.previousTodos) {
        utils.todo.list.setData(undefined, context.previousTodos);
      }
    },

    // Regardless of success or failure, sync with server data at the end
    onSettled: () => {
      utils.todo.list.invalidate();
    },
  });

  const deleteTodo = trpc.todo.delete.useMutation({
    onMutate: async (input) => {
      await utils.todo.list.cancel();
      const previousTodos = utils.todo.list.getData();

      // Optimistically delete
      utils.todo.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((todo) => todo.id !== input.id);
      });

      return { previousTodos };
    },
    onError: (_err, _input, context) => {
      if (context?.previousTodos) {
        utils.todo.list.setData(undefined, context.previousTodos);
      }
    },
    onSettled: () => {
      utils.todo.list.invalidate();
    },
  });

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>
          <label>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo.mutate({ id: todo.id })}
            />
            <span style={{
              textDecoration: todo.completed ? "line-through" : "none",
            }}>
              {todo.title}
            </span>
          </label>
          <button onClick={() => deleteTodo.mutate({ id: todo.id })}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
```

### 3-6. Infinite Scroll

```typescript
// components/InfinitePostList.tsx
import { trpc } from "../utils/trpc";
import { useCallback, useRef, useEffect } from "react";

// Server side: cursor-based pagination
// server/routers/post.ts
export const postRouter = router({
  infiniteList: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),  // ID of the last item
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, category } = input;

      const posts = await ctx.db.post.findMany({
        take: limit + 1,  // +1 to determine if there is a next page
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,  // Skip the cursor itself
        }),
        ...(category && { where: { category } }),
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, avatar: true } } },
      });

      let nextCursor: string | undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      return { posts, nextCursor };
    }),
});

// Client side
export function InfinitePostList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = trpc.post.infiniteList.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Auto-load with Intersection Observer
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  if (isLoading) return <div>Loading...</div>;

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div>
      {allPosts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>by {post.author.name}</p>
          <p>{post.content.slice(0, 200)}...</p>
        </article>
      ))}

      <div ref={loadMoreRef}>
        {isFetchingNextPage ? (
          <p>Loading more...</p>
        ) : hasNextPage ? (
          <p>Scroll to load more</p>
        ) : (
          <p>No more posts</p>
        )}
      </div>
    </div>
  );
}
```

---

## 4. Testing

```typescript
// server/routers/user.test.ts
import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./_app";

describe("userRouter", () => {
  const mockDb = {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  } as unknown as PrismaClient;

  const caller = appRouter.createCaller({
    userId: "user-1",
    db: mockDb,
  });

  it("should list users", async () => {
    const mockUsers = [
      { id: "1", name: "Alice", email: "alice@test.com" },
    ];
    (mockDb.user.findMany as any).mockResolvedValue(mockUsers);
    (mockDb.user.count as any).mockResolvedValue(1);

    const result = await caller.user.list({ page: 1, limit: 10 });

    expect(result.users).toEqual(mockUsers);
    expect(result.total).toBe(1);
  });

  it("should throw NOT_FOUND for invalid id", async () => {
    (mockDb.user.findUnique as any).mockResolvedValue(null);

    await expect(
      caller.user.byId({ id: "00000000-0000-0000-0000-000000000000" })
    ).rejects.toThrow("NOT_FOUND");
  });
});
```

### 4-1. Integration Tests

```typescript
// server/routers/user.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./_app";
import type { AppRouter } from "./_app";
import { PrismaClient } from "@prisma/client";

describe("User Router Integration", () => {
  let server: ReturnType<typeof createHTTPServer>;
  let client: ReturnType<typeof createTRPCClient<AppRouter>>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } },
    });

    server = createHTTPServer({
      router: appRouter,
      createContext: () => ({
        userId: "test-user-id",
        db: prisma,
      }),
    });

    // Start server on random port
    const { port } = server.listen(0);

    client = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `http://localhost:${port}`,
        }),
      ],
    });
  });

  afterAll(async () => {
    server.server.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.user.deleteMany();
  });

  it("should create and retrieve a user", async () => {
    // Create user
    const created = await client.user.create.mutate({
      name: "Integration Test User",
      email: "integration@test.com",
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Integration Test User");

    // Retrieve the created user
    const retrieved = await client.user.byId.query({ id: created.id });
    expect(retrieved.name).toBe("Integration Test User");
    expect(retrieved.email).toBe("integration@test.com");
  });

  it("should paginate users correctly", async () => {
    // Create 25 users
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        client.user.create.mutate({
          name: `User ${i}`,
          email: `user${i}@test.com`,
        })
      )
    );

    const page1 = await client.user.list.query({ page: 1, limit: 10 });
    expect(page1.users).toHaveLength(10);
    expect(page1.total).toBe(25);

    const page3 = await client.user.list.query({ page: 3, limit: 10 });
    expect(page3.users).toHaveLength(5);
  });

  it("should handle concurrent mutations safely", async () => {
    const user = await client.user.create.mutate({
      name: "Concurrent User",
      email: "concurrent@test.com",
    });

    // Execute update and delete simultaneously
    const results = await Promise.allSettled([
      client.user.update.mutate({
        id: user.id,
        data: { name: "Updated Name" },
      }),
      client.user.delete.mutate({ id: user.id }),
    ]);

    // At least one should succeed
    const successes = results.filter((r) => r.status === "fulfilled");
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });
});
```

### 4-2. Middleware Testing

```typescript
// server/middleware/auth.test.ts
import { describe, it, expect, vi } from "vitest";
import { appRouter } from "../routers/_app";
import { TRPCError } from "@trpc/server";

describe("Auth Middleware", () => {
  const mockDb = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  } as unknown as PrismaClient;

  it("should reject unauthenticated requests to protected routes", async () => {
    const caller = appRouter.createCaller({
      userId: null, // Unauthenticated
      db: mockDb,
    });

    await expect(
      caller.admin.listAllUsers()
    ).rejects.toThrow(TRPCError);

    await expect(
      caller.admin.listAllUsers()
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("should reject non-admin users from admin routes", async () => {
    (mockDb.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      role: "USER", // Not an admin
    });

    const caller = appRouter.createCaller({
      userId: "user-1",
      db: mockDb,
    });

    await expect(
      caller.admin.listAllUsers()
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should allow admin users to access admin routes", async () => {
    const mockUsers = [{ id: "1", name: "User" }];
    (mockDb.user.findUnique as any).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
    });
    (mockDb.user.findMany as any).mockResolvedValue(mockUsers);

    const caller = appRouter.createCaller({
      userId: "admin-1",
      db: mockDb,
    });

    const result = await caller.admin.listAllUsers();
    expect(result).toEqual(mockUsers);
  });
});
```

---

## 5. Subscriptions (Real-Time Communication)

### 5-1. WebSocket Subscription Setup

```
tRPC Subscription Architecture:

  +-----------+    WebSocket     +------------+
  |  Client   | <=============> |   Server   |
  +-----------+  Bidirectional  +------------+
       |                              |
       | subscribe('onMessage')       | EventEmitter
       |------------------------------>|  .emit('message', data)
       |                              |
       |      { type: 'data',         |
       |        data: Message }       |
       |<-----------------------------|
       |                              |
       |      { type: 'data',         |
       |        data: Message }       |
       |<-----------------------------|
       |                              |
```

```typescript
// server/routers/chat.ts
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { EventEmitter } from "events";
import { router, protectedProcedure } from "../trpc";

// Event emitter (Redis Pub/Sub recommended for production)
const ee = new EventEmitter();

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

export const chatRouter = router({
  // Send message
  sendMessage: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        content: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: input.roomId,
        userId: ctx.userId,
        userName: ctx.user.name,
        content: input.content,
        createdAt: new Date(),
      };

      // Save to DB
      await ctx.db.message.create({ data: message });

      // Emit event (notify subscribers)
      ee.emit(`room:${input.roomId}`, message);

      return message;
    }),

  // Receive real-time messages
  onMessage: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .subscription(({ input }) => {
      return observable<ChatMessage>((emit) => {
        const handler = (message: ChatMessage) => {
          emit.next(message);
        };

        // Register event listener
        ee.on(`room:${input.roomId}`, handler);

        // Cleanup: called when client disconnects
        return () => {
          ee.off(`room:${input.roomId}`, handler);
        };
      });
    }),

  // User typing status
  onTyping: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .subscription(({ input }) => {
      return observable<{ userId: string; userName: string }>((emit) => {
        const handler = (data: { userId: string; userName: string }) => {
          emit.next(data);
        };

        ee.on(`typing:${input.roomId}`, handler);
        return () => ee.off(`typing:${input.roomId}`, handler);
      });
    }),

  startTyping: protectedProcedure
    .input(z.object({ roomId: z.string() }))
    .mutation(({ ctx, input }) => {
      ee.emit(`typing:${input.roomId}`, {
        userId: ctx.userId,
        userName: ctx.user.name,
      });
      return { ok: true };
    }),
});
```

### 5-2. Client-Side WebSocket Setup

```typescript
// utils/trpc.ts -- With WebSocket link
import { createTRPCReact } from "@trpc/react-query";
import { createWSClient, wsLink, httpBatchLink, splitLink } from "@trpc/client";
import type { AppRouter } from "../server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

// WebSocket client
const wsClient = createWSClient({
  url: "ws://localhost:3000/trpc",
  retryDelayMs: (attemptIndex) =>
    Math.min(1000 * 2 ** attemptIndex, 30_000), // Exponential backoff
  onOpen: () => console.log("WebSocket connected"),
  onClose: () => console.log("WebSocket disconnected"),
});

export const trpcClient = trpc.createClient({
  links: [
    // Use splitLink to route only subscriptions over WebSocket
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: "http://localhost:3000/api/trpc",
        headers: () => ({
          Authorization: `Bearer ${getToken()}`,
        }),
      }),
    }),
  ],
});
```

```typescript
// components/ChatRoom.tsx
import { trpc } from "../utils/trpc";
import { useState } from "react";

export function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Subscription: receive new messages in real time
  trpc.chat.onMessage.useSubscription(
    { roomId },
    {
      onData: (message) => {
        setMessages((prev) => [...prev, message]);
      },
      onError: (err) => {
        console.error("Subscription error:", err);
      },
    }
  );

  // Typing indicator
  trpc.chat.onTyping.useSubscription(
    { roomId },
    {
      onData: ({ userName }) => {
        setTypingUsers((prev) => [...new Set([...prev, userName])]);
        // Remove after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== userName));
        }, 3000);
      },
    }
  );

  const sendMessage = trpc.chat.sendMessage.useMutation();
  const startTyping = trpc.chat.startTyping.useMutation();

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage.mutateAsync({ roomId, content: input });
    setInput("");
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id}>
            <strong>{msg.userName}</strong>: {msg.content}
          </div>
        ))}
      </div>

      {typingUsers.length > 0 && (
        <p>{typingUsers.join(", ")} is typing...</p>
      )}

      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          startTyping.mutate({ roomId });
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

---

## 6. Error Handling

### 6-1. tRPC Error Code Reference

```
tRPC error codes and corresponding HTTP status codes:

  +------------------------+--------+-----------------------------+
  | tRPC Code              | HTTP   | Usage                       |
  +------------------------+--------+-----------------------------+
  | BAD_REQUEST            | 400    | Input validation failure    |
  | UNAUTHORIZED           | 401    | Authentication required     |
  | FORBIDDEN              | 403    | Insufficient permissions    |
  | NOT_FOUND              | 404    | Resource not found          |
  | METHOD_NOT_SUPPORTED   | 405    | Unsupported method          |
  | TIMEOUT                | 408    | Timeout                     |
  | CONFLICT               | 409    | Resource conflict           |
  | PRECONDITION_FAILED    | 412    | Precondition failed         |
  | PAYLOAD_TOO_LARGE      | 413    | Payload too large           |
  | UNPROCESSABLE_CONTENT  | 422    | Unprocessable content       |
  | TOO_MANY_REQUESTS      | 429    | Rate limit exceeded         |
  | CLIENT_CLOSED_REQUEST  | 499    | Client closed connection    |
  | INTERNAL_SERVER_ERROR  | 500    | Internal error              |
  +------------------------+--------+-----------------------------+
```

### 6-2. Custom Error Classes

```typescript
// server/errors.ts
import { TRPCError } from "@trpc/server";

/**
 * Custom error for business logic
 */
export class BusinessError extends TRPCError {
  public readonly errorCode: string;

  constructor(opts: {
    code: TRPCError["code"];
    message: string;
    errorCode: string;
    cause?: Error;
  }) {
    super({
      code: opts.code,
      message: opts.message,
      cause: opts.cause,
    });
    this.errorCode = opts.errorCode;
  }
}

// Specific errors
export class InsufficientBalanceError extends BusinessError {
  constructor(balance: number, required: number) {
    super({
      code: "BAD_REQUEST",
      message: `Insufficient balance: have ${balance}, need ${required}`,
      errorCode: "INSUFFICIENT_BALANCE",
    });
  }
}

export class DuplicateEmailError extends BusinessError {
  constructor(email: string) {
    super({
      code: "CONFLICT",
      message: `Email ${email} is already registered`,
      errorCode: "DUPLICATE_EMAIL",
    });
  }
}

export class SubscriptionExpiredError extends BusinessError {
  constructor(expiredAt: Date) {
    super({
      code: "FORBIDDEN",
      message: `Subscription expired at ${expiredAt.toISOString()}`,
      errorCode: "SUBSCRIPTION_EXPIRED",
    });
  }
}
```

### 6-3. Advanced Error Formatter Configuration

```typescript
// server/trpc.ts -- Advanced error formatter
import { initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import { BusinessError } from "./errors";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Zod validation error details
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
        // Business error code
        businessCode:
          error instanceof BusinessError
            ? error.errorCode
            : null,
        // Include stack trace in development only
        stack:
          process.env.NODE_ENV === "development"
            ? error.stack
            : undefined,
      },
    };
  },
});
```

### 6-4. Client-Side Error Handling

```typescript
// hooks/useTRPCError.ts
import { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "../server/routers/_app";
import { toast } from "sonner";

/**
 * Utility for handling tRPC errors uniformly
 */
export function handleTRPCError(error: unknown) {
  if (!(error instanceof TRPCClientError<AppRouter>)) {
    toast.error("An unexpected error occurred");
    console.error("Non-tRPC error:", error);
    return;
  }

  const { data, message } = error;

  // Zod validation errors
  if (data?.zodError) {
    const fieldErrors = data.zodError.fieldErrors;
    const messages = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors as string[]).join(", ")}`)
      .join("\n");
    toast.error(`Validation Error:\n${messages}`);
    return;
  }

  // Business errors
  if (data?.businessCode) {
    switch (data.businessCode) {
      case "INSUFFICIENT_BALANCE":
        toast.error("Your balance is insufficient for this operation");
        break;
      case "DUPLICATE_EMAIL":
        toast.error("This email is already registered");
        break;
      case "SUBSCRIPTION_EXPIRED":
        toast.error("Your subscription has expired. Please renew.");
        break;
      default:
        toast.error(message);
    }
    return;
  }

  // HTTP status-based handling
  switch (error.data?.httpStatus) {
    case 401:
      toast.error("Please log in to continue");
      // Redirect
      window.location.href = "/login";
      break;
    case 403:
      toast.error("You don't have permission to perform this action");
      break;
    case 429:
      toast.error("Too many requests. Please try again later.");
      break;
    default:
      toast.error(message || "Something went wrong");
  }
}

// Usage in React components
function CreatePostForm() {
  const createPost = trpc.post.create.useMutation({
    onSuccess: (data) => {
      toast.success("Post created successfully!");
      router.push(`/posts/${data.id}`);
    },
    onError: handleTRPCError,
  });

  // ...
}
```

---

## 7. Performance Optimization

### 7-1. Batch Request Control

```typescript
// Client side: optimizing batch link
import { httpBatchLink } from "@trpc/client";

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // Maximum batch size (unlimited by default)
      maxURLLength: 2083,  // To match IE URL length limit

      // Custom headers
      headers: () => ({
        Authorization: `Bearer ${getToken()}`,
      }),

      // Pre-request hook
      fetch: (url, options) => {
        // Custom fetch implementation (with timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    }),
  ],
});
```

```
Batch request behavior:

  Normal (httpLink):
  Client  →  GET /api/trpc/user.list     →  Server
  Client  →  GET /api/trpc/post.list     →  Server
  Client  →  GET /api/trpc/comment.list  →  Server
  3 HTTP requests

  Batched (httpBatchLink):
  Client  →  GET /api/trpc/user.list,post.list,comment.list  →  Server
  1 HTTP request (combines 3 calls)

  Response:
  [
    { result: { data: { users: [...] } } },
    { result: { data: { posts: [...] } } },
    { result: { data: { comments: [...] } } }
  ]
```

### 7-2. Selective Data Fetching (Output Validation)

```typescript
// server/routers/user.ts -- Output filtering
export const userRouter = router({
  // Public profile (excluding sensitive information)
  publicProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string().nullable(),
        bio: z.string().nullable(),
        // email, phone, etc. are not included
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user; // output validation automatically strips unnecessary fields
    }),

  // For admins (all fields)
  adminDetail: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUniqueOrThrow({
        where: { id: input.userId },
        include: {
          profile: true,
          sessions: true,
          auditLogs: { take: 50, orderBy: { createdAt: "desc" } },
        },
      });
    }),
});
```

### 7-3. Caching Strategy

```typescript
// components/UserProfile.tsx -- staleTime and cacheTime settings
export function UserProfile({ userId }: { userId: string }) {
  const { data: user } = trpc.user.byId.useQuery(
    { id: userId },
    {
      // Time data is considered "fresh" (no refetch during this period)
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Time the cache is retained in memory
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)

      // Refetch on window focus
      refetchOnWindowFocus: false,

      // Refetch on mount
      refetchOnMount: "always",

      // Retry settings
      retry: (failureCount, error) => {
        // Don't retry 404s
        if (error.data?.httpStatus === 404) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30_000),
    }
  );

  // ...
}
```

```typescript
// Global cache settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,         // Default 1 minute
      gcTime: 10 * 60 * 1000,       // Default 10 minutes
      refetchOnWindowFocus: true,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: false,                  // Mutations don't retry by default
    },
  },
});
```

### 7-4. Prefetching and Data Preloading

```typescript
// pages/users/index.tsx -- Prefetch before page navigation
import { trpc } from "../../utils/trpc";
import Link from "next/link";

export function UserListPage() {
  const { data } = trpc.user.list.useQuery({ page: 1, limit: 20 });
  const utils = trpc.useUtils();

  return (
    <div>
      {data?.users.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.id}`}
          // Prefetch on hover
          onMouseEnter={() => {
            utils.user.byId.prefetch({ id: user.id });
          }}
        >
          {user.name}
        </Link>
      ))}
    </div>
  );
}
```

```typescript
// Next.js SSR prefetch
// app/users/page.tsx
import { createServerSideHelpers } from "@trpc/react-query/server";
import { appRouter } from "../../server/routers/_app";
import superjson from "superjson";

export default async function UsersPage() {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: { userId: null, db: prisma },
    transformer: superjson,
  });

  // Prefetch data on the server side
  await helpers.user.list.prefetch({ page: 1, limit: 20 });

  return (
    <HydrateClient state={helpers.dehydrate()}>
      <UserList />
    </HydrateClient>
  );
}
```

---

## 8. Advanced Link Configuration

### 8-1. Debugging with loggerLink

```typescript
import { loggerLink, httpBatchLink } from "@trpc/client";

const trpcClient = trpc.createClient({
  links: [
    // Logger should be placed before other links
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),

      // Custom log format
      colorMode: "ansi", // For terminal
    }),

    httpBatchLink({
      url: "/api/trpc",
    }),
  ],
});
```

### 8-2. Conditional Routing with splitLink

```typescript
import { splitLink, httpBatchLink, httpLink } from "@trpc/client";

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // Condition: use individual requests for file uploads
      condition: (op) => op.path.startsWith("upload."),
      true: httpLink({
        url: "/api/trpc",
        // Settings for file upload
      }),
      false: httpBatchLink({
        url: "/api/trpc",
      }),
    }),
  ],
});
```

### 8-3. Creating Custom Links

```typescript
// utils/retryLink.ts -- Custom retry link implementation
import { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../server/routers/_app";

/**
 * Custom link that retries requests under certain conditions
 */
export function retryLink(opts: {
  maxRetries: number;
  retryableErrors: string[];
}): TRPCLink<AppRouter> {
  return () => {
    return ({ op, next }) => {
      return observable((observer) => {
        let attempts = 0;

        function attempt() {
          attempts++;
          const subscription = next(op).subscribe({
            next: (value) => observer.next(value),
            error: (err) => {
              if (
                attempts < opts.maxRetries &&
                opts.retryableErrors.includes(err.data?.code)
              ) {
                // Retryable error -- retry with exponential backoff
                const delay = Math.min(1000 * 2 ** (attempts - 1), 10_000);
                console.warn(
                  `[retryLink] Retry attempt ${attempts} for ${op.path} in ${delay}ms`
                );
                setTimeout(attempt, delay);
              } else {
                observer.error(err);
              }
            },
            complete: () => observer.complete(),
          });

          return subscription;
        }

        const sub = attempt();
        return () => sub?.unsubscribe();
      });
    };
  };
}

// Usage example
const trpcClient = trpc.createClient({
  links: [
    retryLink({
      maxRetries: 3,
      retryableErrors: ["INTERNAL_SERVER_ERROR", "TIMEOUT"],
    }),
    httpBatchLink({ url: "/api/trpc" }),
  ],
});
```

---

## 9. File Uploads

### 9-1. Multipart Uploads

```typescript
// server/routers/upload.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const uploadRouter = router({
  // Get presigned URL (client uploads directly to S3)
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        size: z.number().max(10 * 1024 * 1024), // Maximum 10MB
      })
    )
    .mutation(async ({ ctx, input }) => {
      const key = `uploads/${ctx.userId}/${Date.now()}-${input.filename}`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.size,
      });

      const presignedUrl = await getSignedUrl(s3, command, {
        expiresIn: 300, // Valid for 5 minutes
      });

      // Save metadata to DB
      const file = await ctx.db.file.create({
        data: {
          key,
          filename: input.filename,
          contentType: input.contentType,
          size: input.size,
          userId: ctx.userId,
          status: "PENDING",
        },
      });

      return { presignedUrl, fileId: file.id, key };
    }),

  // Confirm upload completion
  confirmUpload: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.file.update({
        where: {
          id: input.fileId,
          userId: ctx.userId,
        },
        data: { status: "COMPLETED" },
      });

      return { url: `${process.env.CDN_URL}/${file.key}` };
    }),
});
```

```typescript
// hooks/useFileUpload.ts -- Client-side upload hook
import { trpc } from "../utils/trpc";
import { useState } from "react";

export function useFileUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const getPresignedUrl = trpc.upload.getPresignedUrl.useMutation();
  const confirmUpload = trpc.upload.confirmUpload.useMutation();

  async function upload(file: File): Promise<string> {
    setIsUploading(true);
    setProgress(0);

    try {
      // 1. Get presigned URL
      const { presignedUrl, fileId } = await getPresignedUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      // 2. Upload directly to S3 (with progress tracking)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      // 3. Notify upload completion
      const { url } = await confirmUpload.mutateAsync({ fileId });
      return url;
    } finally {
      setIsUploading(false);
    }
  }

  return { upload, progress, isUploading };
}
```

---

## 10. New Features in tRPC v11

### 10-1. Server-Sent Events (SSE) Transport

```typescript
// SSE link added in tRPC v11
import { unstable_httpBatchStreamLink } from "@trpc/client";

const trpcClient = trpc.createClient({
  links: [
    unstable_httpBatchStreamLink({
      url: "/api/trpc",
      // Streaming responses over SSE
    }),
  ],
});

// Server side: streaming procedure
export const aiRouter = router({
  generateText: protectedProcedure
    .input(z.object({ prompt: z.string() }))
    .query(async function* ({ input }) {
      // Streaming response with AsyncGenerator
      const stream = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: input.prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    }),
});
```

### 10-2. FormData Support

```typescript
// FormData support in tRPC v11
import { experimental_formDataLink } from "@trpc/client";

// Server side
export const uploadRouter = router({
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        file: z.instanceof(File),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(await input.file.arrayBuffer());
      // File processing...
      return { url: "https://cdn.example.com/avatar.jpg" };
    }),
});
```

### 10-3. Deep Integration with React Server Components

```typescript
// app/users/[id]/page.tsx -- RSC + tRPC v11
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/_app";

// Client for server components
const serverClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`,
      headers: () => {
        // Access cookies directly in server components
        const cookieStore = cookies();
        return {
          cookie: cookieStore.toString(),
        };
      },
    }),
  ],
});

// Call tRPC directly from RSC
export default async function UserPage({
  params,
}: {
  params: { id: string };
}) {
  // Fetch data directly server-side (type-safe via HTTP)
  const user = await serverClient.user.byId.query({ id: params.id });

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {/* Pass to client component */}
      <UserActions userId={user.id} />
    </div>
  );
}
```

---

## 11. Production Deployment and Operations

### 11-1. Express Adapter

```typescript
// server/index.ts -- Express server
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/_app";
import { createContext } from "./context";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// tRPC middleware
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`[tRPC Error] ${path}:`, error);
      // Send to error monitoring service
      Sentry.captureException(error);
    },
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 11-2. Fastify Adapter

```typescript
// server/index.ts -- Fastify server (high performance)
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, AppRouter } from "./routers/_app";
import { createContext } from "./context";

const server = Fastify({
  maxParamLength: 5000,
  logger: true,
});

await server.register(cors);

server.register(fastifyTRPCPlugin, {
  prefix: "/api/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      server.log.error(`[tRPC] ${path}: ${error.message}`);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

### 11-3. Edge Runtime Deployment (Cloudflare Workers)

```typescript
// worker/index.ts -- tRPC on Cloudflare Workers
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers/_app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: async () => ({
        userId: await getUserFromRequest(request),
        db: createD1Client(env.DB),
      }),
      responseMeta() {
        return {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        };
      },
    });
  },
};
```

### 11-4. Monitoring and Observability

```typescript
// server/middleware/monitoring.ts
import { middleware } from "../trpc";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("trpc");

/**
 * Tracing middleware with OpenTelemetry support
 */
export const tracingMiddleware = middleware(async ({ path, type, next }) => {
  return tracer.startActiveSpan(`trpc.${type}.${path}`, async (span) => {
    span.setAttribute("rpc.system", "trpc");
    span.setAttribute("rpc.method", path);
    span.setAttribute("rpc.type", type);

    try {
      const result = await next();

      if (!result.ok) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "tRPC procedure failed",
        });
      }

      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
});

/**
 * Metrics collection middleware (for Prometheus)
 */
import { Counter, Histogram } from "prom-client";

const requestCounter = new Counter({
  name: "trpc_requests_total",
  help: "Total number of tRPC requests",
  labelNames: ["path", "type", "status"],
});

const requestDuration = new Histogram({
  name: "trpc_request_duration_seconds",
  help: "Duration of tRPC requests in seconds",
  labelNames: ["path", "type"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const metricsMiddleware = middleware(async ({ path, type, next }) => {
  const timer = requestDuration.startTimer({ path, type });

  try {
    const result = await next();
    requestCounter.inc({ path, type, status: result.ok ? "ok" : "error" });
    return result;
  } catch (error) {
    requestCounter.inc({ path, type, status: "exception" });
    throw error;
  } finally {
    timer();
  }
});
```

---

## 12. Security Best Practices

### 12-1. Input Sanitization

```typescript
// server/schemas/sanitize.ts
import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

/**
 * String schema with HTML sanitization
 */
export const sanitizedString = z.string().transform((val) => {
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: [], // Allow text only
    ALLOWED_ATTR: [],
  });
});

/**
 * For rich text (allowing some HTML tags)
 */
export const richText = z.string().transform((val) => {
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
});

// Usage example
export const postRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        title: sanitizedString.pipe(z.string().min(1).max(200)),
        content: richText.pipe(z.string().min(1).max(50000)),
        tags: z.array(sanitizedString).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.post.create({
        data: {
          ...input,
          authorId: ctx.userId,
        },
      });
    }),
});
```

### 12-2. CSRF Protection

```typescript
// server/middleware/csrf.ts
import { middleware } from "../trpc";
import { TRPCError } from "@trpc/server";

/**
 * CSRF protection middleware
 * Validates the presence of a custom header
 */
export const csrfProtection = middleware(async ({ ctx, next, type }) => {
  // Skip for queries (GET) since they have low CSRF risk
  if (type === "query") {
    return next();
  }

  // For mutations, require a custom header
  const csrfToken = ctx.req?.headers?.["x-csrf-token"];
  if (!csrfToken) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CSRF token missing",
    });
  }

  // Validate the token
  const expectedToken = await ctx.db.csrfToken.findUnique({
    where: { token: csrfToken as string },
  });

  if (!expectedToken || expectedToken.expiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invalid or expired CSRF token",
    });
  }

  return next();
});
```

### 12-3. Data Access Control

```typescript
// server/middleware/dataAccess.ts
import { middleware } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

/**
 * Resource ownership check middleware
 */
export function ownershipCheck<T extends z.ZodType>(
  resourceSchema: T,
  getResource: (id: string, db: PrismaClient) => Promise<any>,
  ownerField: string = "userId"
) {
  return middleware(async ({ ctx, rawInput, next }) => {
    const parsed = z.object({ id: z.string() }).safeParse(rawInput);
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST" });
    }

    const resource = await getResource(parsed.data.id, ctx.db);
    if (!resource) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (resource[ownerField] !== ctx.userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only modify your own resources",
      });
    }

    return next({
      ctx: { ...ctx, resource },
    });
  });
}

// Usage example
const ownPostProcedure = protectedProcedure.use(
  ownershipCheck(
    z.any(),
    (id, db) => db.post.findUnique({ where: { id } }),
    "authorId"
  )
);

export const postRouter = router({
  updateOwn: ownPostProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.resource already contains the fetched post
      return ctx.db.post.update({
        where: { id: input.id },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.content && { content: input.content }),
        },
      });
    }),
});
```

---

## Comparison Tables

### API Framework Comparison

| Characteristic | tRPC | REST (Express) | GraphQL | gRPC |
|----------------|------|----------------|---------|------|
| Type Safety | Highest (inference) | Manual/OpenAPI | Medium (codegen) | High (protobuf) |
| Code Generation | Not needed | OpenAPI → types | Required | Required |
| Clients | TypeScript only | Any language | Any language | Any language |
| Bundle Size | Small | - | Medium | Large |
| Learning Cost | Low | Lowest | Medium | High |
| Ecosystem | Growing | Largest | Large | Medium |

### tRPC Link Comparison

| Link | Usage | Batching | WebSocket |
|------|-------|----------|-----------|
| httpBatchLink | Standard | Yes | No |
| httpLink | Single requests | No | No |
| wsLink | Real-time | No | Yes |
| splitLink | Conditional routing | - | - |
| loggerLink | Debugging | - | - |

### Middleware Pattern Comparison

| Pattern | Usage | Complexity | Reusability |
|---------|-------|------------|-------------|
| Auth check | Restrict to logged-in users | Low | High |
| Role-based RBAC | Permission level control | Medium | High |
| Organization-based access | Multi-tenancy | High | Medium |
| Rate limiting | API protection | Medium | High |
| Logging | Debugging/auditing | Low | Highest |
| Tracing | Performance analysis | Medium | High |
| CSRF protection | Security | Medium | High |
| Ownership check | Resource protection | Medium | Medium |

---

## Anti-Patterns

### AP-1: Bloated Routers

```typescript
// Bad: Packing all procedures into one file
export const appRouter = router({
  getUser: publicProcedure.query(/* 50 lines */),
  createUser: publicProcedure.mutation(/* 80 lines */),
  updateUser: publicProcedure.mutation(/* 60 lines */),
  deleteUser: publicProcedure.mutation(/* 30 lines */),
  getPost: publicProcedure.query(/* 50 lines */),
  // ... 100+ procedures
});

// Good: Split routers by domain
export const appRouter = router({
  user: userRouter,     // server/routers/user.ts
  post: postRouter,     // server/routers/post.ts
  comment: commentRouter, // server/routers/comment.ts
  admin: adminRouter,   // server/routers/admin.ts
});
```

### AP-2: Manually Defining Types on the Client

```typescript
// Bad: Manually duplicating server types
interface User {
  id: string;
  name: string;
  email: string;
}
const { data } = trpc.user.byId.useQuery({ id: "1" });
const user = data as User; // Manual cast

// Good: Let types be automatically inferred
const { data } = trpc.user.byId.useQuery({ id: "1" });
// data type is automatically inferred from the server's router definition
```

### AP-3: Overloading Context with Unnecessary Data

```typescript
// Bad: Context bloat (fetching all data for every request)
export async function createContext(opts: CreateNextContextOptions) {
  const session = await getServerSession(opts.req, opts.res, authOptions);
  const user = session ? await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      settings: true,
      organizations: { include: { organization: true } },
      notifications: { where: { read: false } },
    },
  }) : null;

  return { session, user, db: prisma };
}

// Good: Keep context minimal. Fetch additional data in middleware
export async function createContext(opts: CreateNextContextOptions) {
  const session = await getServerSession(opts.req, opts.res, authOptions);
  return {
    userId: session?.user?.id ?? null,
    db: prisma,
  };
}
// Only fetch additional data in middleware for routes that need it
```

### AP-4: Skipping Error Handling

```typescript
// Bad: Suppressing errors
const createUser = trpc.user.create.useMutation();

// Bad: async call without catch
const handleCreate = async () => {
  await createUser.mutateAsync({ name: "", email: "invalid" });
  // Will crash on error
};

// Good: Proper error handling
const createUser = trpc.user.create.useMutation({
  onSuccess: (data) => {
    toast.success("User created!");
    router.push(`/users/${data.id}`);
  },
  onError: (error) => {
    if (error.data?.zodError) {
      // Show validation errors in the form
      setFormErrors(error.data.zodError.fieldErrors);
    } else {
      toast.error(error.message);
    }
  },
});
```

### AP-5: Forgetting Rollback in Optimistic Updates

```typescript
// Bad: No rollback handling
const toggleTodo = trpc.todo.toggle.useMutation({
  onMutate: async (input) => {
    utils.todo.list.setData(undefined, (old) =>
      old?.map((t) => (t.id === input.id ? { ...t, done: !t.done } : t))
    );
    // Data will become inconsistent on error!
  },
});

// Good: Snapshot + rollback + re-sync
const toggleTodo = trpc.todo.toggle.useMutation({
  onMutate: async (input) => {
    await utils.todo.list.cancel();
    const prev = utils.todo.list.getData();
    utils.todo.list.setData(undefined, (old) =>
      old?.map((t) => (t.id === input.id ? { ...t, done: !t.done } : t))
    );
    return { prev };
  },
  onError: (_, __, ctx) => {
    if (ctx?.prev) utils.todo.list.setData(undefined, ctx.prev);
  },
  onSettled: () => utils.todo.list.invalidate(),
});
```

---

## FAQ

### Q1: Can tRPC replace REST APIs?

In TypeScript monorepos (frontend + backend), it can completely replace REST. However, if you have mobile app clients (Swift/Kotlin) or clients in other languages, REST/GraphQL is more suitable. tRPC delivers maximum power within the "TypeScript ecosystem."

### Q2: What are the differences between tRPC v10 and v11?

v11 includes enhanced React Server Components integration, a new link API, and performance improvements. Migration from v10 is relatively easy, with few breaking changes.

### Q3: Can tRPC and GraphQL be used together?

Technically yes, but you typically choose one or the other. tRPC is suitable for internal tools and full-stack TypeScript projects, while GraphQL is suited for public APIs and multi-platform scenarios.

### Q4: Can tRPC be used with microservices?

It can, but caution is needed. Since tRPC assumes type sharing within a monorepo, you need to publish type definitions as a shared package for inter-service communication. If service interfaces are stable, gRPC may sometimes be more appropriate.

```typescript
// packages/shared-types/src/index.ts -- Shared type package
export type { AppRouter as ServiceARouter } from "@myapp/service-a/src/routers/_app";
export type { AppRouter as ServiceBRouter } from "@myapp/service-b/src/routers/_app";

// service-a/src/clients/serviceB.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { ServiceBRouter } from "@myapp/shared-types";

export const serviceBClient = createTRPCClient<ServiceBRouter>({
  links: [
    httpBatchLink({
      url: process.env.SERVICE_B_URL + "/trpc",
      headers: () => ({
        "x-service-auth": process.env.SERVICE_SECRET,
      }),
    }),
  ],
});
```

### Q5: What is the performance of tRPC like?

tRPC's own overhead is minimal. HTTP request/response serialization and zod validation account for most of the cost. Using batch links can significantly reduce the number of requests. In large-scale applications, the bottleneck is usually DB queries or business logic, not tRPC itself.

### Q6: Can OpenAPI documentation be generated from tRPC?

Using the `trpc-openapi` package, you can automatically generate an OpenAPI specification from a tRPC router. This enables exposing the API as a REST API to non-TypeScript clients.

```typescript
import { generateOpenApiDocument } from "trpc-openapi";

const openApiDoc = generateOpenApiDocument(appRouter, {
  title: "My API",
  version: "1.0.0",
  baseUrl: "https://api.example.com",
});
```

### Q7: How do you create mocks for testing?

Using `createCaller` makes server-side testing easy. For client-side testing, you can use MSW (Mock Service Worker) to mock at the HTTP level, or directly mock the tRPC hooks.

```typescript
// Client testing with MSW
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("/api/trpc/user.list", () => {
    return HttpResponse.json({
      result: {
        data: {
          users: [{ id: "1", name: "Test User" }],
          total: 1,
          page: 1,
        },
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Summary Table

| Concept | Key Points |
|---------|------------|
| tRPC | E2E type-safe API using TypeScript type inference |
| Router | Compose procedures in a nested structure |
| Query / Mutation | Read / write operation distinction |
| Subscription | Real-time communication via WebSocket |
| Middleware | Chain for authentication, logging, error handling |
| createCaller | Direct server-side invocation |
| zod integration | Input validation and schema definition |
| Links | Customize the request pipeline |
| Optimistic Updates | Responsive UX with optimistic updates |
| Infinite Queries | Cursor-based infinite scroll |
| Output Validation | Output filtering and security |
| SSE / Streaming | Streaming responses in v11 |

---


## Summary

This guide covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and considerations
- How to apply in real-world scenarios

---

## Guides to Read Next

- [Zod Validation](./00-zod-validation.md) -- Full zod capabilities for defining tRPC input schemas
- [Prisma + TypeScript](./01-prisma-typescript.md) -- Full-stack type safety with tRPC + Prisma
- [Error Handling](../02-patterns/00-error-handling.md) -- Error handling design for tRPC

---

## References

1. **tRPC Documentation**
   https://trpc.io/docs

2. **tRPC GitHub Repository**
   https://github.com/trpc/trpc

3. **Create T3 App** -- Starter kit for tRPC + Next.js + Prisma
   https://create.t3.gg/

4. **TanStack Query Documentation** -- Data fetching library used internally by tRPC React
   https://tanstack.com/query

5. **Zod Documentation** -- Schema library used for tRPC input validation
   https://zod.dev

6. **trpc-openapi** -- Generate OpenAPI documentation from tRPC
   https://github.com/jlalmes/trpc-openapi
