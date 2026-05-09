# RBAC (Role-Based Access Control)

> RBAC is the most widely adopted access control model, assigning "roles" to users and associating "permissions" with roles. This chapter covers practical RBAC design and implementation: role design, permission models, hierarchical roles, multi-tenant support, and caching.

## What You Will Learn

- [ ] Understand the fundamental RBAC concepts (RBAC0–RBAC3) and the differences between models
- [ ] Design permission naming conventions and role design patterns at a production level
- [ ] Implement an algorithm that recursively resolves hierarchical roles (role inheritance)
- [ ] Design and implement organization-scoped RBAC for multi-tenant environments
- [ ] Optimize performance using Redis-based permission caching

## Prerequisites

- Difference between authentication and authorization → [00-fundamentals/](../00-fundamentals/)
- Token management basics → [02-token-auth/03-token-management.md](../02-token-auth/03-token-management.md)
- RDB basics (many-to-many relations) → sql-and-query-mastery: 02-design/
- Security fundamentals → security-fundamentals: 00-basics/

---

## 1. RBAC Core Models

### 1.1 RBAC Building Blocks

```
RBAC building blocks:

  ┌──────────┐    ┌──────────┐    ┌──────────────┐
  │  User    │───→│  Role    │───→│  Permission  │
  │          │ N:M│          │ N:M│              │
  └──────────┘    └──────────┘    └──────────────┘

  User → Role:       A user holds one or more roles
  Role → Permission: A role holds one or more permissions
  User → Permission: A user gains permissions indirectly through roles

  Why not assign User → Permission directly (WHY):
    → As the number of users grows, managing permissions individually becomes unmanageable
    → Defining a role like "editor" means you only need to assign the role to new users
    → Changing permissions only requires updating the role — all users reflect the change
    → Auditing is straightforward ("who holds which role" is self-explanatory)
```

### 1.2 RBAC Levels (NIST Definition)

```
RBAC levels (based on NIST SP 359):

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  RBAC0 (Flat RBAC):                                          │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ User ←→ Role → Permission                            │    │
  │  │ The simplest form. Permissions are bound to roles.   │    │
  │  │ Example: 3 roles — admin, editor, viewer             │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  RBAC1 (Hierarchical RBAC):                                  │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Adds inheritance relationships between roles          │    │
  │  │ admin "inherits" the permissions of editor            │    │
  │  │ editor "inherits" the permissions of viewer           │    │
  │  │ → Eliminates redundant permission definitions         │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  RBAC2 (Constrained RBAC):                                   │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Adds constraints to roles                             │    │
  │  │ ① Mutual exclusion: "approver" and "requester"        │    │
  │  │    cannot be held simultaneously                      │    │
  │  │ ② Maximum roles: up to 3 roles per user               │    │
  │  │ ③ Separation of Duties (SoD): prevents conflicts      │    │
  │  │    of interest                                        │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  RBAC3 (Unified RBAC):                                       │
  │  ┌──────────────────────────────────────────────────────┐    │
  │  │ Combines both RBAC1 (hierarchy) and RBAC2             │    │
  │  │ (constraints)                                         │    │
  │  │ The most flexible and complete model                  │    │
  │  │ Designed for enterprise use                           │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  Selection guide:
    Small-scale apps → RBAC0 is sufficient
    Medium-scale apps → RBAC1 (hierarchical roles) recommended
    Enterprise → RBAC3 (hierarchy + constraints)
```

---

## 2. Role and Permission Design

### 2.1 Permission Naming Conventions

```
Permission naming convention: resource:action

  Basic patterns:
    articles:read     — View articles
    articles:create   — Create articles
    articles:update   — Edit articles
    articles:delete   — Delete articles
    articles:publish  — Publish articles

  User management:
    users:read        — View user list
    users:create      — Create users
    users:update      — Edit users
    users:delete      — Delete users
    users:invite      — Invite users

  Organization management:
    org:settings      — Change organization settings
    org:billing       — Manage billing
    org:members       — Manage members

  Naming best practices:
    ✓ Use the resource:action format consistently
    ✓ Resource names in plural (articles, users)
    ✓ Actions based on CRUD + domain-specific (publish, approve)
    ✓ Wildcard: articles:* grants all permissions on articles

  Naming to avoid:
    ✗ can_edit_articles (too verbose)
    ✗ admin (resource is unclear)
    ✗ 1, 2, 3 (numeric IDs are meaningless)
```

### 2.2 Role Design Patterns

```
Role design example (CMS application):

  viewer:
    → articles:read

  editor:
    → all viewer permissions +
    → articles:create, articles:update

  publisher:
    → all editor permissions +
    → articles:publish, articles:delete

  admin:
    → all publisher permissions +
    → users:*, org:settings

  super_admin:
    → all admin permissions +
    → org:billing, system settings

  ┌─────────────────────────────────────────────────┐
  │  Role hierarchy (RBAC1):                         │
  │                                                   │
  │  super_admin                                      │
  │    └── admin                                      │
  │          └── publisher                            │
  │                └── editor                         │
  │                      └── viewer                   │
  │                                                   │
  │  Each role inherits all permissions of its parent │
  └─────────────────────────────────────────────────┘

  Recommended number of roles:
    → Small-scale: 3–5 roles
    → Medium-scale: 5–10 roles
    → Large-scale: 10–20 roles (consider combining with ABAC beyond that)
```

### 2.3 Type Definitions for Permissions and Roles

```typescript
// Permission definitions (type-safe)
const PERMISSIONS = {
  // Articles
  'articles:read': '記事の閲覧',
  'articles:create': '記事の作成',
  'articles:update': '記事の編集',
  'articles:delete': '記事の削除',
  'articles:publish': '記事の公開',
  // Users
  'users:read': 'ユーザー一覧',
  'users:create': 'ユーザー作成',
  'users:update': 'ユーザー編集',
  'users:delete': 'ユーザー削除',
  'users:invite': 'ユーザー招待',
  // Organization
  'org:settings': '組織設定',
  'org:billing': '課金管理',
  'org:members': 'メンバー管理',
} as const;

type Permission = keyof typeof PERMISSIONS;

// Role definitions (with hierarchy)
interface RoleConfig {
  description: string;
  permissions: Permission[];
  inherits: string[];
}

const ROLES: Record<string, RoleConfig> = {
  viewer: {
    description: '閲覧のみ',
    permissions: ['articles:read'],
    inherits: [],
  },
  editor: {
    description: '記事の作成・編集',
    permissions: ['articles:create', 'articles:update'],
    inherits: ['viewer'],
  },
  publisher: {
    description: '記事の公開・削除',
    permissions: ['articles:publish', 'articles:delete'],
    inherits: ['editor'],
  },
  admin: {
    description: 'ユーザー・組織管理',
    permissions: [
      'users:read', 'users:create', 'users:update',
      'users:delete', 'users:invite', 'org:settings', 'org:members',
    ],
    inherits: ['publisher'],
  },
  super_admin: {
    description: '全権限（課金含む）',
    permissions: ['org:billing'],
    inherits: ['admin'],
  },
};

type Role = keyof typeof ROLES;
```

### 2.4 Resolving All Permissions for a Role (Including Inheritance)

```typescript
// Recursively resolve all permissions for a role
function resolvePermissions(role: string, visited = new Set<string>()): Set<Permission> {
  // Prevent circular references
  if (visited.has(role)) return new Set();
  visited.add(role);

  const roleConfig = ROLES[role];
  if (!roleConfig) return new Set();

  const permissions = new Set<Permission>();

  // Add direct permissions
  roleConfig.permissions.forEach((p) => permissions.add(p));

  // Recursively resolve inherited permissions
  roleConfig.inherits.forEach((parentRole) => {
    resolvePermissions(parentRole, visited).forEach((p) => permissions.add(p));
  });

  return permissions;
}

// Permission check
function hasPermission(userRole: string, permission: Permission): boolean {
  const permissions = resolvePermissions(userRole);
  return permissions.has(permission);
}

// Permission check with wildcard support
function hasPermissionWithWildcard(
  userRole: string,
  requiredPermission: string
): boolean {
  const permissions = resolvePermissions(userRole);

  // Exact match
  if (permissions.has(requiredPermission as Permission)) return true;

  // Wildcard check: users:* → users:read, users:create, ...
  const [resource] = requiredPermission.split(':');
  const wildcardPerm = `${resource}:*` as Permission;
  if (permissions.has(wildcardPerm)) return true;

  // Global wildcard
  if (permissions.has('*:*' as Permission)) return true;

  return false;
}

// Usage examples
console.log(hasPermission('editor', 'articles:read'));     // true (inherited from viewer)
console.log(hasPermission('editor', 'articles:create'));   // true (direct permission)
console.log(hasPermission('editor', 'articles:publish'));  // false (requires publisher or above)
console.log(hasPermission('admin', 'articles:publish'));   // true (inherited from publisher)
console.log(hasPermission('super_admin', 'org:billing'));  // true (direct permission)
```

---

## 3. Database Design

### 3.1 Table Structure

```
RBAC table design:

  ┌─────────┐   ┌──────────────┐   ┌──────────┐
  │  users  │──→│ user_roles   │←──│  roles   │
  │         │   │ (user_id,    │   │          │
  │         │   │  role_id)    │   │          │
  └─────────┘   └──────────────┘   └──────────┘
                                       │
                                   ┌───┴────────────┐
                                   │ role_permissions│
                                   │ (role_id,       │
                                   │  permission_id) │
                                   └───┬────────────┘
                                       │
                                   ┌───┴──────────┐
                                   │ permissions   │
                                   └──────────────┘

  Normalized vs Denormalized:

  Normalized (5-table structure above):
    ✓ Highly flexible (dynamic add/remove of permissions)
    ✓ Supports permission changes from an admin UI
    △ Complex queries due to many JOINs

  Denormalized (role definitions in code):
    ✓ Simple queries (role column in the user table)
    ✓ Better performance
    △ Permission changes require code changes + deployment

  Recommendation:
    → Small to medium-scale: denormalized (role column + code definitions)
    → Large-scale: normalized (DB tables + admin UI)
```

### 3.2 Prisma Schema (Normalized Version)

```typescript
// schema.prisma

// model User {
//   id        String     @id @default(cuid())
//   email     String     @unique
//   name      String
//   password  String?
//   roles     UserRole[]
//   createdAt DateTime   @default(now())
//   updatedAt DateTime   @updatedAt
// }
//
// model Role {
//   id          String           @id @default(cuid())
//   name        String           @unique  // "admin", "editor", etc.
//   description String?
//   permissions RolePermission[]
//   users       UserRole[]
//   parentId    String?          // 階層ロール
//   parent      Role?            @relation("RoleHierarchy", fields: [parentId], references: [id])
//   children    Role[]           @relation("RoleHierarchy")
//   createdAt   DateTime         @default(now())
// }
//
// model Permission {
//   id          String           @id @default(cuid())
//   name        String           @unique  // "articles:read"
//   description String?
//   roles       RolePermission[]
//   createdAt   DateTime         @default(now())
// }
//
// model UserRole {
//   userId    String
//   roleId    String
//   user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
//   role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
//   assignedAt DateTime @default(now())
//   assignedBy String?  // 誰がこのロールを割当てたか
//   @@id([userId, roleId])
//   @@index([userId])
//   @@index([roleId])
// }
//
// model RolePermission {
//   roleId       String
//   permissionId String
//   role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
//   permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
//   @@id([roleId, permissionId])
// }
```

### 3.3 Fetching All Permissions for a User from the DB

```typescript
// Fetch all permissions for a user from the DB (with hierarchical role support)
async function getUserPermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
              parent: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                  // Up to 2 levels deep (deeper hierarchies resolved recursively)
                  parent: {
                    include: {
                      permissions: {
                        include: { permission: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const permissions = new Set<string>();

  // Collect permissions from all roles (including hierarchy)
  function collectPermissions(role: any) {
    role.permissions.forEach(({ permission }: any) => {
      permissions.add(permission.name);
    });

    // Collect parent role permissions recursively
    if (role.parent) {
      collectPermissions(role.parent);
    }
  }

  user?.roles.forEach(({ role }) => collectPermissions(role));

  return permissions;
}

// Denormalized version (simple and fast)
async function getUserPermissionsSimple(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }, // when there is a single role column
  });

  if (!user) return new Set();

  // Resolve permissions from code-defined roles
  return resolvePermissions(user.role);
}
```

---

## 4. Permission Checks in Middleware

### 4.1 Express Middleware

```typescript
// Express middleware (generic permission check)
import { Request, Response, NextFunction } from 'express';

// Permission check middleware
function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // set by authentication middleware
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch user permissions (with cache)
    const userPermissions = await getCachedPermissions(user.id);

    // Check if the user holds all required permissions
    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));
    if (!hasAll) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        hint: 'Contact your administrator to request access',
      });
    }

    next();
  };
}

// Allow access if the user holds any one of the required permissions
function requireAnyPermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPermissions = await getCachedPermissions(user.id);
    const hasAny = requiredPermissions.some((p) => userPermissions.has(p));

    if (!hasAny) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required_any: requiredPermissions,
      });
    }

    next();
  };
}

// Usage examples
app.get('/api/articles', requirePermission('articles:read'), getArticles);
app.post('/api/articles', requirePermission('articles:create'), createArticle);
app.put('/api/articles/:id', requirePermission('articles:update'), updateArticle);
app.delete('/api/articles/:id', requirePermission('articles:delete'), deleteArticle);
app.post('/api/articles/:id/publish', requirePermission('articles:publish'), publishArticle);

// When multiple permissions are required
app.delete('/api/users/:id',
  requirePermission('users:delete', 'users:read'),
  deleteUser
);

// When any of the permissions grants access
app.get('/api/reports',
  requireAnyPermission('reports:read', 'admin'),
  getReports
);
```

### 4.2 Permission Checks in Next.js Server Actions

```typescript
// Permission checks in Next.js Server Actions
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// Authorization utility
async function authorize(...requiredPermissions: string[]) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const userPermissions = resolvePermissions(session.user.role);
  const hasAll = requiredPermissions.every((p) =>
    userPermissions.has(p as Permission)
  );

  if (!hasAll) {
    throw new Error(
      `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
    );
  }

  return session;
}

// Usage in a Server Action
'use server';

async function createArticle(formData: FormData) {
  const session = await authorize('articles:create');

  const article = await prisma.article.create({
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      authorId: session.user.id,
    },
  });

  revalidatePath('/articles');
  return article;
}

async function deleteArticle(articleId: string) {
  const session = await authorize('articles:delete');

  await prisma.article.delete({
    where: { id: articleId },
  });

  revalidatePath('/articles');
}

async function inviteUser(email: string, role: string) {
  const session = await authorize('users:invite', 'users:create');

  // Ensure the role being assigned is not higher than the inviter's role
  const inviterPermissions = resolvePermissions(session.user.role);
  const inviteePermissions = resolvePermissions(role);

  // Error if the invitee's role includes permissions the inviter does not have
  for (const perm of inviteePermissions) {
    if (!inviterPermissions.has(perm)) {
      throw new Error('Cannot assign a role with higher permissions than your own');
    }
  }

  await sendInvitation(email, role);
}
```

---

## 5. Multi-Tenant RBAC

### 5.1 Tenant Isolation Design

```
Multi-tenant RBAC design:

  Problem: the same user holds different roles per organization
    Alice: Organization A → admin
    Alice: Organization B → viewer
    Bob:   Organization A → editor

  Table design:

  ┌─────────┐   ┌─────────────────────────┐   ┌───────────┐
  │  users  │──→│ organization_members     │←──│ orgs      │
  │         │   │ (user_id, org_id, role)  │   │           │
  └─────────┘   └─────────────────────────┘   └───────────┘

  Design options:

  ① role column (simple):
     Add a role column to the organization_members table
     → Suitable for small to medium-scale

  ② Separate table (flexible):
     org_member_roles (member_id, role_id)
     → Allows a user to hold multiple roles within an organization
     → Suitable for large-scale
```

### 5.2 Multi-Tenant RBAC Implementation

```typescript
// Multi-tenant RBAC implementation
interface OrgMembership {
  userId: string;
  orgId: string;
  role: string;
  joinedAt: Date;
}

// Permission check within an organization
async function checkOrgPermission(
  userId: string,
  orgId: string,
  permission: string
): Promise<boolean> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_orgId: { userId, orgId },
    },
  });

  if (!membership) return false;

  // Resolve permissions from role
  return hasPermission(membership.role, permission as Permission);
}

// Middleware with organization context
function requireOrgPermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get orgId from URL (/org/:orgId/...)
    const orgId = req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const hasAll = await Promise.all(
      permissions.map((p) => checkOrgPermission(user.id, orgId, p))
    );

    if (hasAll.some((v) => !v)) {
      return res.status(403).json({
        error: 'Insufficient permissions in this organization',
      });
    }

    // Attach organization info to the request
    req.orgId = orgId;
    next();
  };
}

// Organization context in a Next.js Server Component
async function OrgDashboard({ params }: { params: { orgId: string } }) {
  const session = await auth();
  if (!session) redirect('/login');

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_orgId: {
        userId: session.user.id,
        orgId: params.orgId,
      },
    },
    include: { organization: true },
  });

  if (!membership) {
    notFound();
  }

  const permissions = resolvePermissions(membership.role);

  return (
    <div>
      <h1>{membership.organization.name}</h1>
      <p>Your role: {membership.role}</p>

      {permissions.has('articles:create' as Permission) && (
        <Link href={`/org/${params.orgId}/articles/new`}>New Article</Link>
      )}

      {permissions.has('users:read' as Permission) && (
        <Link href={`/org/${params.orgId}/members`}>Members</Link>
      )}

      {permissions.has('org:settings' as Permission) && (
        <Link href={`/org/${params.orgId}/settings`}>Settings</Link>
      )}
    </div>
  );
}
```

### 5.3 Inviting and Managing Organization Members

```typescript
// Organization member management API
class OrgMemberService {
  // Invite a member
  async inviteMember(
    inviterId: string,
    orgId: string,
    email: string,
    role: string
  ) {
    // Check inviter's permissions
    const inviterMembership = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: inviterId, orgId } },
    });

    if (!inviterMembership) {
      throw new Error('You are not a member of this organization');
    }

    if (!hasPermission(inviterMembership.role, 'users:invite' as Permission)) {
      throw new Error('You do not have permission to invite members');
    }

    // Ensure the invited role is no higher than the inviter's role
    const inviterPerms = resolvePermissions(inviterMembership.role);
    const inviteePerms = resolvePermissions(role);

    for (const perm of inviteePerms) {
      if (!inviterPerms.has(perm)) {
        throw new Error('Cannot assign a role with higher permissions');
      }
    }

    // Create the invitation
    const invitation = await prisma.orgInvitation.create({
      data: {
        orgId,
        email,
        role,
        invitedBy: inviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        token: crypto.randomBytes(32).toString('hex'),
      },
    });

    await sendInvitationEmail(email, invitation);
    return invitation;
  }

  // Change role
  async changeRole(
    adminId: string,
    orgId: string,
    targetUserId: string,
    newRole: string
  ) {
    // Check admin permissions
    const adminMembership = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: adminId, orgId } },
    });

    if (!hasPermission(adminMembership!.role, 'users:update' as Permission)) {
      throw new Error('Permission denied');
    }

    // A user cannot change their own role (requires another admin)
    if (adminId === targetUserId) {
      throw new Error('Cannot change your own role');
    }

    await prisma.organizationMember.update({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      data: { role: newRole },
    });
  }
}
```

---

## 6. Permission Caching

### 6.1 Redis Cache Implementation

```typescript
// Speed up permission checks with Redis caching
import Redis from 'ioredis';

class PermissionCache {
  private redis: Redis;
  private ttl = 300; // 5 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  private key(userId: string, orgId?: string): string {
    return orgId ? `perms:${userId}:${orgId}` : `perms:${userId}`;
  }

  // Retrieve permissions from cache
  async get(userId: string, orgId?: string): Promise<Set<string> | null> {
    const cached = await this.redis.smembers(this.key(userId, orgId));
    return cached.length > 0 ? new Set(cached) : null;
  }

  // Store permissions in cache
  async set(
    userId: string,
    permissions: Set<string>,
    orgId?: string
  ): Promise<void> {
    const key = this.key(userId, orgId);
    const pipeline = this.redis.pipeline();
    pipeline.del(key);
    if (permissions.size > 0) {
      pipeline.sadd(key, ...permissions);
    }
    pipeline.expire(key, this.ttl);
    await pipeline.exec();
  }

  // Invalidate cache (on role change)
  async invalidate(userId: string, orgId?: string): Promise<void> {
    if (orgId) {
      await this.redis.del(this.key(userId, orgId));
    } else {
      // Delete cache for all organizations
      const keys = await this.redis.keys(`perms:${userId}:*`);
      if (keys.length > 0) await this.redis.del(...keys);
      await this.redis.del(this.key(userId));
    }
  }

  // Event handler for role changes
  async onRoleChanged(userId: string, orgId?: string): Promise<void> {
    await this.invalidate(userId, orgId);
  }
}

// Fetch permissions with caching
const permissionCache = new PermissionCache(process.env.REDIS_URL!);

async function getCachedPermissions(
  userId: string,
  orgId?: string
): Promise<Set<string>> {
  // Check cache
  const cached = await permissionCache.get(userId, orgId);
  if (cached) return cached;

  // Cache miss → fetch from DB
  const permissions = orgId
    ? await getOrgPermissions(userId, orgId)
    : await getUserPermissions(userId);

  // Store in cache
  await permissionCache.set(userId, permissions, orgId);

  return permissions;
}
```

### 6.2 In-Memory Cache (When Redis Is Not Available)

```typescript
// LRU cache (for small-scale apps)
class InMemoryPermissionCache {
  private cache = new Map<string, {
    permissions: Set<string>;
    expiresAt: number;
  }>();
  private maxSize = 1000;
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(userId: string): Set<string> | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }
    return entry.permissions;
  }

  set(userId: string, permissions: Set<string>): void {
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      // Remove the oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(userId, {
      permissions,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}
```

---

## 7. RBAC Constraints (RBAC2)

### 7.1 Mutually Exclusive Roles and Separation of Duties

```typescript
// RBAC2: implementing constraints

// Mutually exclusive roles (cannot be held simultaneously)
const MUTUALLY_EXCLUSIVE_ROLES: [string, string][] = [
  ['approver', 'requester'],     // approver and requester cannot be combined
  ['auditor', 'admin'],          // auditor and admin cannot be combined
];

// Validation when assigning a role
async function assignRole(userId: string, newRole: string, orgId?: string) {
  // Get current roles
  const currentRoles = await getUserRoles(userId, orgId);

  // Mutual exclusion check
  for (const [roleA, roleB] of MUTUALLY_EXCLUSIVE_ROLES) {
    if (newRole === roleA && currentRoles.includes(roleB)) {
      throw new Error(
        `Cannot assign "${newRole}": conflicts with existing role "${roleB}"`
      );
    }
    if (newRole === roleB && currentRoles.includes(roleA)) {
      throw new Error(
        `Cannot assign "${newRole}": conflicts with existing role "${roleA}"`
      );
    }
  }

  // Maximum roles check
  const MAX_ROLES = 5;
  if (currentRoles.length >= MAX_ROLES) {
    throw new Error(`Maximum of ${MAX_ROLES} roles per user`);
  }

  // Assign the role
  await prisma.userRole.create({
    data: { userId, roleId: newRole },
  });
}

// Separation of Duties (SoD) check
function checkSeparationOfDuties(
  userRoles: string[],
  operation: string
): boolean {
  // Example: payment approval must be done by someone other than the payment creator
  const sodRules: Record<string, string[]> = {
    'payment:approve': ['payment:create'], // approver cannot also be a creator
    'audit:sign': ['accounting:post'],      // audit signer cannot also post accounting entries
  };

  const conflictingOps = sodRules[operation];
  if (!conflictingOps) return true;

  const userPermissions = new Set<string>();
  userRoles.forEach((role) => {
    resolvePermissions(role).forEach((p) => userPermissions.add(p));
  });

  // Check that the user does not hold any conflicting operations
  return !conflictingOps.some((op) => userPermissions.has(op as Permission));
}
```

---

## 8. Anti-Patterns

### 8.1 Hardcoding Role Names

```typescript
// BAD: hardcoding role names
async function deleteArticle(userId: string, articleId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // ✗ Writing role names directly in code
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    throw new Error('Permission denied');
  }

  await prisma.article.delete({ where: { id: articleId } });
}
// Problem: code changes are required every time roles change

// ✓ GOOD: check by permission
async function deleteArticleGood(userId: string, articleId: string) {
  const permissions = await getCachedPermissions(userId);

  // Check by permission name (no dependency on role names)
  if (!permissions.has('articles:delete')) {
    throw new Error('Permission denied');
  }

  await prisma.article.delete({ where: { id: articleId } });
}
// No code changes needed when roles change — just update the permission assignment
```

### 8.2 Skipping Permission Checks

```typescript
// BAD: managing permissions only through frontend display controls
// Frontend
function AdminPanel() {
  const { user } = useAuth();
  if (user.role !== 'admin') return null; // just hide it
  return <AdminDashboard />;
}

// Backend API has no permission check
app.delete('/api/users/:id', async (req, res) => {
  // ✗ Anyone can delete a user
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ✓ GOOD: always check permissions on the backend
app.delete('/api/users/:id',
  requirePermission('users:delete'), // checked in middleware
  async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);
```

### 8.3 Defaulting to Allow

```typescript
// BAD: default allow (access is granted unless explicitly denied)
function checkAccess(userRole: string, resource: string): boolean {
  const deniedResources: Record<string, string[]> = {
    viewer: ['admin-panel', 'billing'],
    editor: ['admin-panel'],
  };

  // ✗ Resources not in the list are allowed (new resources may be missed)
  return !(deniedResources[userRole]?.includes(resource));
}

// ✓ GOOD: default deny (only explicitly allowed resources are accessible)
function checkAccessGood(userRole: string, permission: string): boolean {
  const permissions = resolvePermissions(userRole);
  // Deny unless explicitly permitted
  return permissions.has(permission as Permission);
}
```

---

## Hands-On Exercises

### Exercise 1: Basics — Implementing Role Hierarchy and Permission Resolution

**Task**: Define the following role hierarchy and implement `resolvePermissions` and `hasPermission`.

- guest: articles:read
- member: guest + comments:create, comments:read
- editor: member + articles:create, articles:update
- admin: editor + users:read, users:update, articles:delete

```typescript
// Template
function resolvePermissions(role: string): Set<string> {
  // TODO: implement
  return new Set();
}

// Tests
console.assert(resolvePermissions('guest').size === 1);
console.assert(resolvePermissions('admin').has('articles:read')); // inherited
console.assert(!resolvePermissions('editor').has('users:read')); // admin only
```

<details>
<summary>Model Answer</summary>

```typescript
const ROLE_DEFINITIONS: Record<string, {
  permissions: string[];
  inherits: string[];
}> = {
  guest: {
    permissions: ['articles:read'],
    inherits: [],
  },
  member: {
    permissions: ['comments:create', 'comments:read'],
    inherits: ['guest'],
  },
  editor: {
    permissions: ['articles:create', 'articles:update'],
    inherits: ['member'],
  },
  admin: {
    permissions: ['users:read', 'users:update', 'articles:delete'],
    inherits: ['editor'],
  },
};

function resolvePermissions(role: string, visited = new Set<string>()): Set<string> {
  if (visited.has(role)) return new Set(); // 循環参照防止
  visited.add(role);

  const config = ROLE_DEFINITIONS[role];
  if (!config) return new Set();

  const perms = new Set<string>(config.permissions);

  for (const parent of config.inherits) {
    for (const p of resolvePermissions(parent, visited)) {
      perms.add(p);
    }
  }

  return perms;
}

function hasPermission(role: string, permission: string): boolean {
  return resolvePermissions(role).has(permission);
}

// Tests
const guestPerms = resolvePermissions('guest');
console.log('guest permissions:', [...guestPerms]);
console.assert(guestPerms.size === 1, 'guest should have 1 permission');
console.assert(guestPerms.has('articles:read'), 'guest should have articles:read');

const memberPerms = resolvePermissions('member');
console.log('member permissions:', [...memberPerms]);
console.assert(memberPerms.size === 3, 'member should have 3 permissions');
console.assert(memberPerms.has('articles:read'), 'member inherits articles:read');

const editorPerms = resolvePermissions('editor');
console.log('editor permissions:', [...editorPerms]);
console.assert(editorPerms.size === 5, 'editor should have 5 permissions');
console.assert(!editorPerms.has('users:read'), 'editor should not have users:read');

const adminPerms = resolvePermissions('admin');
console.log('admin permissions:', [...adminPerms]);
console.assert(adminPerms.size === 8, 'admin should have 8 permissions');
console.assert(adminPerms.has('articles:read'), 'admin inherits articles:read');
console.assert(adminPerms.has('users:read'), 'admin has users:read');

console.log('All tests passed!');
```

</details>

### Exercise 2: Applied — Multi-Tenant RBAC Middleware

**Task**: Implement an Express multi-tenant RBAC middleware. Users hold different roles per organization, and permission checks are performed on routes under `/org/:orgId/...`.

<details>
<summary>Model Answer</summary>

```typescript
import express, { Request, Response, NextFunction } from 'express';

// In-memory data (use DB in production)
const memberships = new Map<string, { userId: string; orgId: string; role: string }>();
memberships.set('user1:org1', { userId: 'user1', orgId: 'org1', role: 'admin' });
memberships.set('user1:org2', { userId: 'user1', orgId: 'org2', role: 'viewer' });
memberships.set('user2:org1', { userId: 'user2', orgId: 'org1', role: 'editor' });

// Role definitions (reuse from Exercise 1)
const ROLES: Record<string, { permissions: string[]; inherits: string[] }> = {
  viewer: { permissions: ['articles:read'], inherits: [] },
  editor: {
    permissions: ['articles:create', 'articles:update'],
    inherits: ['viewer'],
  },
  admin: {
    permissions: ['users:read', 'users:update', 'articles:delete', 'org:settings'],
    inherits: ['editor'],
  },
};

function resolvePerms(role: string, visited = new Set<string>()): Set<string> {
  if (visited.has(role)) return new Set();
  visited.add(role);
  const config = ROLES[role];
  if (!config) return new Set();
  const perms = new Set<string>(config.permissions);
  for (const parent of config.inherits) {
    for (const p of resolvePerms(parent, visited)) perms.add(p);
  }
  return perms;
}

// Middleware
function requireOrgPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId; // assume authenticated
    const orgId = req.params.orgId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const membership = memberships.get(`${userId}:${orgId}`);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const userPerms = resolvePerms(membership.role);
    const hasAll = permissions.every((p) => userPerms.has(p));

    if (!hasAll) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        role: membership.role,
        required: permissions,
        granted: [...userPerms],
      });
    }

    (req as any).orgId = orgId;
    (req as any).orgRole = membership.role;
    next();
  };
}

// Simple test server
const app = express();

// Simulate authentication
app.use((req, res, next) => {
  (req as any).userId = req.headers['x-user-id'] as string;
  next();
});

app.get('/org/:orgId/articles', requireOrgPermission('articles:read'), (req, res) => {
  res.json({ articles: [], role: (req as any).orgRole });
});

app.delete('/org/:orgId/articles/:id', requireOrgPermission('articles:delete'), (req, res) => {
  res.json({ deleted: req.params.id });
});

app.get('/org/:orgId/settings', requireOrgPermission('org:settings'), (req, res) => {
  res.json({ settings: {} });
});

// Example test runs:
// user1 (admin in org1): GET /org/org1/articles → 200
// user1 (viewer in org2): DELETE /org/org2/articles/1 → 403
// user2 (editor in org1): GET /org/org1/settings → 403
```

</details>

### Exercise 3: Advanced — Designing a Permission Checker with Redis Cache

**Task**: Design a permission checker class that satisfies the following requirements.

1. Cache permission fetch results from the DB in Redis (TTL: 5 minutes)
2. Immediately invalidate the cache when a role changes
3. Access the DB only on cache misses
4. Multi-tenant support (cache keyed by orgId)

<details>
<summary>Model Answer</summary>

```typescript
import Redis from 'ioredis';

class CachedPermissionChecker {
  private redis: Redis;
  private ttl = 300; // 5 minutes

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  private cacheKey(userId: string, orgId?: string): string {
    return orgId ? `perms:v1:${userId}:${orgId}` : `perms:v1:${userId}`;
  }

  // Permission check (cache-first)
  async hasPermission(
    userId: string,
    permission: string,
    orgId?: string
  ): Promise<boolean> {
    const permissions = await this.getPermissions(userId, orgId);
    return permissions.has(permission);
  }

  // Retrieve permission set (cache-first)
  async getPermissions(userId: string, orgId?: string): Promise<Set<string>> {
    const key = this.cacheKey(userId, orgId);

    // 1. Check cache
    const cached = await this.redis.smembers(key);
    if (cached.length > 0) {
      return new Set(cached);
    }

    // 2. Fetch from DB
    const permissions = orgId
      ? await this.fetchOrgPermissionsFromDB(userId, orgId)
      : await this.fetchPermissionsFromDB(userId);

    // 3. Store in cache
    if (permissions.size > 0) {
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      pipeline.sadd(key, ...permissions);
      pipeline.expire(key, this.ttl);
      await pipeline.exec();
    }

    return permissions;
  }

  // Invalidate cache
  async invalidateUser(userId: string): Promise<void> {
    const pattern = `perms:v1:${userId}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateUserOrg(userId: string, orgId: string): Promise<void> {
    await this.redis.del(this.cacheKey(userId, orgId));
  }

  // Hook for role changes
  async onRoleChanged(event: {
    userId: string;
    orgId?: string;
    oldRole: string;
    newRole: string;
  }): Promise<void> {
    if (event.orgId) {
      await this.invalidateUserOrg(event.userId, event.orgId);
    } else {
      await this.invalidateUser(event.userId);
    }
    console.log(
      `Cache invalidated for user ${event.userId}: ${event.oldRole} → ${event.newRole}`
    );
  }

  // DB fetch (implementation omitted; use Prisma, etc.)
  private async fetchPermissionsFromDB(userId: string): Promise<Set<string>> {
    // Call getUserPermissions(userId)
    return new Set(['articles:read']);
  }

  private async fetchOrgPermissionsFromDB(
    userId: string,
    orgId: string
  ): Promise<Set<string>> {
    // Call getOrgPermissions(userId, orgId)
    return new Set(['articles:read']);
  }
}

// Usage example
async function example() {
  const checker = new CachedPermissionChecker('redis://localhost:6379');

  // Permission check (DB on first call, cache thereafter)
  const canRead = await checker.hasPermission('user1', 'articles:read', 'org1');
  console.log('Can read:', canRead);

  // Invalidate cache on role change
  await checker.onRoleChanged({
    userId: 'user1',
    orgId: 'org1',
    oldRole: 'viewer',
    newRole: 'editor',
  });

  // Next access re-fetches from DB and caches
}
```

</details>


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Misconfigured settings file | Verify the settings file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Growing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify the executing user's permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Read the error message**: Examine the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output and a debugger to test each hypothesis
5. **Fix and run regression tests**: After fixing, also run tests for related areas

```python
# Debugging utility
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

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with a profiling tool
2. **Check memory usage**: Verify whether memory leaks exist
3. **Check for I/O waits**: Inspect disk and network I/O conditions
4. **Check concurrent connections**: Monitor the state of the connection pool

| Issue Type | Diagnostic Tool | Remedy |
|-----------|----------------|--------|
| High CPU | cProfile, py-spy | Improve algorithms, parallelize |
| Memory leak | tracemalloc, objgraph | Release references properly |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |
---

## FAQ

### Q1: Should I choose RBAC or ABAC?

It is generally recommended to start with RBAC. For most applications, RBAC is sufficient. ABAC becomes necessary when attribute-based control is required — for example, "only the creator of a resource can edit it" or "only members of the same department can view it." In practice, a hybrid of RBAC + ABAC is common: RBAC handles coarse-grained control, and ABAC handles fine-grained control. See [ABAC and Policies](./01-abac-and-policies.md) for details.

### Q2: How many roles is an appropriate number?

3–10 roles is a manageable range. When roles exceed 20, management becomes difficult and you should consider introducing ABAC. "Role explosion" is a classic RBAC problem: creating roles per resource or condition leads to a combinatorial explosion. Roles should represent "job functions," and fine-grained conditional logic should be handled by ABAC (attribute-based).

### Q3: Writing permission checks at every API endpoint is tedious. Can it be automated?

Using the middleware pattern, you can declaratively specify permissions at route definition time (see Section 4 of this chapter). You can also include permission metadata in your OpenAPI schema and auto-generate checks, or use a decorator pattern (such as NestJS's `@UseGuards`).

### Q4: When using permission caching, how do I ensure role changes are reflected immediately?

With Redis caching, explicitly invalidate the cache when a role changes (see Section 6). Setting a TTL of around 5 minutes ensures that even if invalidation fails, the change is reflected within 5 minutes at most. When immediacy is critical, combine this with a Token Version to expire permissions at the token level.

### Q5: Do I need to check roles on the frontend as well?

Frontend role checks serve as UX optimization (e.g., hiding buttons the user lacks permission for), but security guarantees must be enforced by the backend API. Frontend checks can be bypassed via DevTools, so relying solely on frontend permission checks is dangerous. See [Frontend Authorization](./03-frontend-authorization.md) for details.

---

## Summary

| Topic | Key Point |
|-------|-----------|
| Permission naming | Use the `resource:action` format consistently |
| Role hierarchy | Use inheritance to eliminate redundant permission definitions (RBAC1) |
| DB design | Small-scale: role column; large-scale: 5-table normalized schema |
| Middleware | Declare checks with `requirePermission()` |
| Multi-tenant | Assign roles per organization (organization_members) |
| Caching | Speed up permission checks with Redis (TTL: 5 minutes) |
| Constraints | Prevent abuse with mutually exclusive roles and Separation of Duties |
| Default | Deny by default (principle of least privilege) |

---

## What to Read Next

- [ABAC and Policy Engines](./01-abac-and-policies.md) — Fine-grained control that RBAC cannot express
- [API Authorization](./02-api-authorization.md) — Scope-based API access control
- [Frontend Authorization](./03-frontend-authorization.md) — Permission control patterns in the UI

---

## References

1. NIST. "Role Based Access Control." NIST SP 359, csrc.nist.gov, 2004.
2. OWASP. "Authorization Cheat Sheet." cheatsheetseries.owasp.org, 2024.
3. Sandhu, R. et al. "Role-Based Access Control Models." IEEE Computer, 1996.
4. CASL. "RBAC with CASL." casl.js.org, 2024.
5. Prisma. "Modeling Relations." prisma.io/docs, 2024.
