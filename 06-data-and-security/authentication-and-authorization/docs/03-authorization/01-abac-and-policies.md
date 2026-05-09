# ABAC and Policy Engines

> When RBAC cannot express complex access control requirements, ABAC (Attribute-Based Access Control) is needed. This chapter covers designing dynamic authorization policies that combine user attributes, resource attributes, and environment conditions, along with policy engines such as CASL, Oso, and Cedar.

## Prerequisites

- Basic concepts of RBAC (roles, permissions)
- Fundamentals of TypeScript / JavaScript

## What You Will Learn

- [ ] Understand the concept of ABAC and its essential differences from RBAC
- [ ] Grasp the ABAC architecture based on NIST SP 800-162
- [ ] Apply policy design patterns in practice
- [ ] Learn practical policy implementation using CASL
- [ ] Compare the characteristics of external policy engines such as OPA/Rego and Cedar
- [ ] Acquire techniques for testing, debugging, and operating policies

---

## 1. Core Concepts of ABAC

### 1.1 What Is ABAC?

ABAC (Attribute-Based Access Control) is a model in which access control decisions are made based on the evaluation of "attributes." While RBAC (Role-Based Access Control) determines access rights by the "role" assigned to a user, ABAC dynamically evaluates attributes of the subject, resource, action, and environment to determine whether access is granted.

The greatest advantage of ABAC is that it eliminates the need to predefine roles, enabling extremely fine-grained access control through combinations of attributes. For example, complex conditions such as "managers at or above a certain rank in the Tokyo office can view confidential documents of their own department during business hours" can be expressed naturally.

```
ABAC (Attribute-Based Access Control):

  RBAC: Access control based on "roles"
    → admin can edit all articles
    → Coarse granularity, role explosion problem

  ABAC: Access control based on "attributes"
    → The author of an article can edit their own article
    → A manager in the same department can view their subordinates' evaluations
    → Data can only be exported during business hours
    → Fine-grained control through combinations of conditions

  4 Attribute Categories:

  ┌──────────────────────────────────────────┐
  │                                          │
  │  (1) Subject attributes:                 │
  │     → User ID, role, department, title   │
  │     → Email, hire date, qualifications,  │
  │        clearance                         │
  │     → Group membership, manager flag     │
  │                                          │
  │  (2) Resource attributes:                │
  │     → Resource ID, type, creator         │
  │     → Status, classification, public flag│
  │     → Sensitivity level, owning org,     │
  │        creation date                     │
  │                                          │
  │  (3) Action attributes:                  │
  │     → read, create, update, delete       │
  │     → publish, approve, export           │
  │     → archive, share, transfer           │
  │                                          │
  │  (4) Environment attributes:             │
  │     → Time, IP address, device           │
  │     → Region, network type               │
  │     → Risk score, MFA status             │
  │                                          │
  └──────────────────────────────────────────┘

  Policy examples:
    IF subject.role == "editor"
    AND resource.type == "article"
    AND resource.author == subject.id
    AND action == "update"
    THEN ALLOW

    IF subject.department == resource.department
    AND subject.role == "manager"
    AND action == "read"
    AND environment.time BETWEEN "09:00" AND "18:00"
    THEN ALLOW

    IF subject.clearance >= resource.classification
    AND environment.network == "corporate"
    AND environment.mfa_verified == true
    THEN ALLOW
```

### 1.2 NIST SP 800-162 ABAC Architecture

The ABAC reference architecture defined by NIST (National Institute of Standards and Technology) consists of the following components.

```
NIST ABAC Reference Architecture:

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  ┌───────────┐     ┌───────────┐               │
  │  │   PEP     │────>│   PDP     │               │
  │  │ (Policy   │<────│ (Policy   │               │
  │  │ Enforce-  │     │ Decision  │               │
  │  │ ment      │     │ Point)    │               │
  │  │ Point)    │     └─────┬─────┘               │
  │  └───────────┘           │                     │
  │       │            ┌─────┴─────┐               │
  │       │            │   PAP     │               │
  │  Enforces          │ (Policy   │               │
  │  access control    │ Admin     │               │
  │  at the app layer  │ Point)    │               │
  │                    └─────┬─────┘               │
  │                          │                     │
  │                    ┌─────┴─────┐               │
  │                    │   PIP     │               │
  │                    │ (Policy   │               │
  │                    │ Info      │               │
  │                    │ Point)    │               │
  │                    └───────────┘               │
  │                                                 │
  └─────────────────────────────────────────────────┘

  PEP (Policy Enforcement Point):
    → Intercepts access requests
    → Enforces PDP decisions (allow/deny)
    → Application middleware or gateway

  PDP (Policy Decision Point):
    → Evaluates policies and decides whether access is allowed
    → Retrieves attribute information from PIP
    → Policy engine (OPA, Cedar, CASL, etc.)

  PAP (Policy Administration Point):
    → Creates, manages, and distributes policies
    → Interface through which administrators define policies

  PIP (Policy Information Point):
    → Provides attribute information
    → User DB, resource DB, external services, etc.
    → Retrieves environment information (time, IP, device)
```

### 1.3 Comparison: RBAC vs ABAC vs ReBAC

```
Comparison of Access Control Models:

  Item           │ RBAC             │ ABAC               │ ReBAC
  ───────────────┼─────────────────┼───────────────────┼──────────────────
  Basis          │ Role             │ Attribute combos   │ Relationship
  Granularity    │ Role level       │ Attribute combos   │ Object relations
  Flexibility    │ Low to medium    │ High               │ High
  Complexity     │ Low              │ Medium to high     │ Medium to high
  Mgmt cost      │ Low              │ Medium             │ Medium
  Scalability    │ Risk of role     │ Risk of policy     │ Graph traversal
                 │ explosion        │ complexity         │ performance
  Use case       │ Clear org roles  │ Resource owners,   │ Document sharing,
                 │                  │ conditional access  │ hierarchical perms
  Example        │ admin/editor/    │ "Only edit your    │ "Contents inside
                 │ viewer           │ own articles"      │ a shared folder"
  Tools          │ express-roles    │ CASL, OPA, Cedar   │ Google Zanzibar,
                 │                  │                    │ SpiceDB, Ory Keto

  In practice:
  → A RBAC + ABAC hybrid is common
  → Use RBAC as the base, add ABAC for fine-grained control
  → Large-scale SaaS may combine ReBAC as well
```

### 1.4 The Role Explosion Problem in RBAC

One of the main reasons RBAC requires ABAC is the "role explosion" problem.

```
Role Explosion:

  Simple RBAC:
    admin, editor, viewer → 3 roles

  Add departments:
    admin_sales, admin_engineering, admin_hr,
    editor_sales, editor_engineering, editor_hr,
    viewer_sales, viewer_engineering, viewer_hr
    → 3 x 3 = 9 roles

  Add regions:
    admin_sales_tokyo, admin_sales_osaka, ...
    → 3 x 3 x 3 = 27 roles

  Add projects:
    → 3 x 3 x 3 x N = exponential growth

  With ABAC:
    Policy: "same department AND same region AND role is editor or above"
    → No increase in role count
    → Dynamically evaluated through attribute combinations
```

---

## 2. Policy Implementation with CASL

### 2.1 CASL Basics

CASL (pronounced "castle") is a policy library for JavaScript/TypeScript that enables declarative definition of ABAC-style access control. Its major features include compatibility with MongoDB query syntax and the ability to share the same policy definitions between frontend and backend.

```typescript
// CASL: JavaScript/TypeScript policy library
// npm install @casl/ability

import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  subject,
  ForbiddenError,
} from '@casl/ability';

// Type definitions for actions and subjects
type Actions = 'read' | 'create' | 'update' | 'delete' | 'publish' | 'manage';
type Subjects = 'Article' | 'User' | 'Comment' | 'Organization' | 'all';
type AppAbility = MongoAbility<[Actions, Subjects]>;

// User type
interface User {
  id: string;
  role: string;
  orgId: string;
  department?: string;
  permissions?: string[];
}

// Ability definition based on user role
function defineAbilityFor(user: User): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'super_admin':
      can('manage', 'all'); // Full permissions
      break;

    case 'admin':
      can('manage', 'Article');
      can('read', 'User');
      can('create', 'User');
      can('update', 'User', { orgId: user.orgId }); // Same org only
      cannot('delete', 'User'); // User deletion is super_admin only
      can('manage', 'Comment');
      can('read', 'Organization', { id: user.orgId });
      can('update', 'Organization', { id: user.orgId });
      break;

    case 'editor':
      can('read', 'Article');
      can('create', 'Article');
      can('update', 'Article', { authorId: user.id }); // Own articles only
      can('delete', 'Article', { authorId: user.id }); // Own articles only
      can('read', 'Comment');
      can('create', 'Comment');
      can('update', 'Comment', { authorId: user.id });
      can('delete', 'Comment', { authorId: user.id });
      break;

    case 'viewer':
      can('read', 'Article', { status: 'published' }); // Published articles only
      can('read', 'Comment');
      can('create', 'Comment');
      can('update', 'Comment', { authorId: user.id }); // Own comments only
      can('delete', 'Comment', { authorId: user.id });
      break;
  }

  return build();
}

// Usage example
const ability = defineAbilityFor({ id: 'user_1', role: 'editor', orgId: 'org_1' });

ability.can('read', 'Article');    // true
ability.can('create', 'Article');  // true
ability.can('update', subject('Article', { authorId: 'user_1' })); // true (own article)
ability.can('update', subject('Article', { authorId: 'user_2' })); // false (another's article)
ability.can('publish', 'Article'); // false (editor has no publish permission)
```

### 2.2 CASL Condition Syntax in Detail

CASL supports MongoDB query syntax, enabling complex conditions to be expressed.

```typescript
// CASL MongoDB-compatible condition syntax
function defineAdvancedAbility(user: User): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // $eq: equality comparison (default)
  can('read', 'Article', { status: 'published' });

  // $ne: negation
  can('update', 'Article', { status: { $ne: 'archived' } });

  // $in: matches any value in an array
  can('read', 'Article', { category: { $in: ['tech', 'science'] } });

  // $nin: matches none of the values in an array
  can('read', 'Article', { sensitivity: { $nin: ['confidential', 'top_secret'] } });

  // $gt, $gte, $lt, $lte: comparison operators
  can('read', 'Article', { priority: { $gte: 1, $lte: 5 } });

  // $exists: checks for field existence
  can('read', 'Article', { deletedAt: { $exists: false } });

  // $regex: regular expression match
  can('read', 'Article', { title: { $regex: /^公開/ } });

  // $all: array contains all elements
  can('read', 'Article', { tags: { $all: ['approved', 'reviewed'] } });

  // $elemMatch: condition on array elements
  can('read', 'Article', {
    collaborators: { $elemMatch: { userId: user.id, role: 'editor' } },
  });

  // Combining multiple conditions (AND)
  can('update', 'Article', {
    authorId: user.id,
    status: { $ne: 'archived' },
    orgId: user.orgId,
  });

  // cannot for explicit denial (takes priority over can)
  cannot('delete', 'Article', { status: 'published' });

  return build();
}
```

### 2.3 Custom Field Matchers

For conditions that cannot be expressed with the default MongoDB syntax, use custom matchers.

```typescript
import { createMongoAbility, MongoAbility, AbilityBuilder } from '@casl/ability';
import { buildMongoQueryMatcher } from '@casl/ability/extra';

// Custom operator: $today (checks if a date is today)
const customConditionsMatcher = buildMongoQueryMatcher({
  $today: (value: boolean, fieldValue: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isToday = fieldValue >= today && fieldValue < tomorrow;
    return value ? isToday : !isToday;
  },
  $withinHours: (hours: number, fieldValue: Date) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return fieldValue >= cutoff;
  },
});

// Ability using custom matchers
const ability = createMongoAbility<[Actions, Subjects]>(
  [
    {
      action: 'update',
      subject: 'Article',
      conditions: { createdAt: { $withinHours: 24 } }, // Editable only within 24 hours of creation
    },
    {
      action: 'delete',
      subject: 'Comment',
      conditions: { createdAt: { $today: true } }, // Only delete comments created today
    },
  ],
  { conditionsMatcher: customConditionsMatcher }
);
```

---

## 3. Permission Checks in the API

### 3.1 Implementation with Express Middleware

```typescript
// CASL + Express middleware
import { ForbiddenError, subject } from '@casl/ability';

// General permission check middleware
function authorize(action: Actions, subjectType: Subjects) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ability = defineAbilityFor(req.user);

    try {
      // Check subject type only (no conditions)
      ForbiddenError.from(ability).throwUnlessCan(action, subjectType);
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Cannot ${error.action} ${error.subjectType}`,
          reason: error.message,
        });
      }
      next(error);
    }
  };
}

// Resource-based permission check (with attributes)
function authorizeResource<T>(
  action: Actions,
  subjectType: Subjects,
  getResource: (req: Request) => Promise<T | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ability = defineAbilityFor(req.user);

    // Fetch the resource
    const resource = await getResource(req);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    try {
      // Attribute-based check
      ForbiddenError.from(ability).throwUnlessCan(
        action,
        subject(subjectType, resource as Record<string, unknown>)
      );
      (req as any).resource = resource;
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Cannot ${error.action} ${error.subjectType}`,
        });
      }
      next(error);
    }
  };
}

// Article update API
app.put(
  '/api/articles/:id',
  authorizeResource('update', 'Article', async (req) =>
    prisma.article.findUnique({ where: { id: req.params.id } })
  ),
  async (req, res) => {
    const article = (req as any).resource;

    const updated = await prisma.article.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(updated);
  }
);

// Article list API (filtering based on policy)
app.get('/api/articles', async (req, res) => {
  const ability = defineAbilityFor(req.user);

  // Build Prisma where conditions from CASL rules
  const articles = await prisma.article.findMany({
    where: accessibleBy(ability, 'read').Article,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  res.json(articles);
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ForbiddenError) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Cannot ${error.action} ${error.subjectType}`,
    });
  }
  next(error);
});
```

### 3.2 Integration with Prisma (accessibleBy)

CASL can integrate with Prisma to automatically generate database query filters based on policies.

```typescript
// npm install @casl/prisma
import { accessibleBy } from '@casl/prisma';

// Automatically generate Prisma where conditions from CASL rules
async function getAccessibleArticles(user: User) {
  const ability = defineAbilityFor(user);

  // Automatically builds where conditions from ability's 'read' rules
  // For editor:
  //   can('read', 'Article')
  //   → where: {} (no restrictions)
  //
  // For viewer:
  //   can('read', 'Article', { status: 'published' })
  //   → where: { status: 'published' }
  const articles = await prisma.article.findMany({
    where: accessibleBy(ability, 'read').Article,
  });

  return articles;
}

// Fetch only editable articles
async function getEditableArticles(user: User) {
  const ability = defineAbilityFor(user);

  // editor: can('update', 'Article', { authorId: user.id })
  // → where: { authorId: user.id }
  const articles = await prisma.article.findMany({
    where: accessibleBy(ability, 'update').Article,
  });

  return articles;
}

// Safe update (integrates permission check + data retrieval)
async function safeUpdateArticle(user: User, articleId: string, data: any) {
  const ability = defineAbilityFor(user);

  // Use accessibleBy to target only articles the user has permission for
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      ...accessibleBy(ability, 'update').Article,
    },
  });

  if (!article) {
    throw new Error('Article not found or no permission');
  }

  return prisma.article.update({
    where: { id: articleId },
    data,
  });
}
```

---

## 4. Permission Control on the Frontend

### 4.1 React + CASL Integration

```typescript
// React + CASL
import { createContext, useContext, useMemo } from 'react';
import { createContextualCan } from '@casl/react';
import { createMongoAbility, MongoAbility } from '@casl/ability';

// Ability context
const AbilityContext = createContext<AppAbility>(undefined!);
const Can = createContextualCan(AbilityContext.Consumer);

// Provider
function AbilityProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();
  const ability = useMemo(() => {
    if (!user) return createMongoAbility<[Actions, Subjects]>([]);
    return defineAbilityFor(user);
  }, [user]);

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

// Conditionally render UI using the Can component
function ArticleActions({ article }: { article: Article }) {
  return (
    <div className="flex gap-2">
      <Can I="read" this={subject('Article', article)}>
        <button>View</button>
      </Can>

      <Can I="update" this={subject('Article', article)}>
        <button>Edit</button>
      </Can>

      <Can I="delete" this={subject('Article', article)}>
        <button className="text-red-500">Delete</button>
      </Can>

      <Can I="publish" a="Article">
        <button className="text-green-500">Publish</button>
      </Can>

      {/* not prop for negated conditions */}
      <Can not I="update" this={subject('Article', article)}>
        <span className="text-gray-400">No edit permission</span>
      </Can>
    </div>
  );
}

// Hook
function useAbility() {
  return useContext(AbilityContext);
}

// Conditional branching using the useAbility hook
function ArticlePage({ article }: { article: Article }) {
  const ability = useAbility();

  if (ability.cannot('read', subject('Article', article))) {
    return <div>You do not have permission to view this article.</div>;
  }

  return (
    <div>
      <ArticleContent article={article} />
      {ability.can('update', subject('Article', article)) && (
        <EditButton articleId={article.id} />
      )}
    </div>
  );
}
```

### 4.2 Syncing Policies from the Server

An approach for keeping frontend and backend policies consistent.

```typescript
// Backend: Expose policy rules via API
// GET /api/auth/permissions
app.get('/api/auth/permissions', async (req, res) => {
  const ability = defineAbilityFor(req.user);

  // Return CASL rules in a JSON-serializable format
  res.json({
    rules: ability.rules,
  });
});

// Frontend: Reconstruct Ability from server rules
import { createMongoAbility } from '@casl/ability';
import { unpackRules } from '@casl/ability/extra';

function useServerAbility() {
  const { data, error } = useSWR('/api/auth/permissions', fetcher);

  const ability = useMemo(() => {
    if (!data?.rules) {
      return createMongoAbility<[Actions, Subjects]>([]);
    }

    return createMongoAbility<[Actions, Subjects]>(data.rules);
  }, [data]);

  return { ability, isLoading: !data && !error };
}

// Detect Ability updates and trigger re-renders
function useAbilityUpdate(ability: AppAbility) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Re-render when ability.rules change
    const unsubscribe = ability.on('updated', () => {
      forceUpdate((n) => n + 1);
    });

    return () => unsubscribe();
  }, [ability]);
}
```

### 4.3 Caveats for Frontend Permission Control

```
Important notes on frontend permission control:

  ┌────────────────────────────────────────────────┐
  │                                                │
  │  Important: Frontend permission control is     │
  │             for UX purposes, NOT for security. │
  │                                                │
  │  Frontend:                                     │
  │    → Show/hide buttons                         │
  │    → Filter menu items                         │
  │    → Redirect to pages without permission      │
  │    → Can easily be bypassed via DevTools       │
  │                                                │
  │  Backend (required):                           │
  │    → Permission checks at the API level        │
  │    → Database query filtering                  │
  │    → Security boundary that cannot be bypassed │
  │                                                │
  │  Conclusion: Apply the same policy on both     │
  │              sides — sharing CASL rules is     │
  │              an effective approach.            │
  │                                                │
  └────────────────────────────────────────────────┘
```

---

## 5. Policy Design Patterns

### 5.1 Basic Patterns

```
Policy design patterns:

  (1) Resource ownership:
     → The creator can operate on their own resources
     → can('update', 'Article', { authorId: user.id })
     → The most common pattern

  (2) Organization scope:
     → Access only resources within the same organization
     → can('read', 'Article', { orgId: user.orgId })
     → The foundation for multi-tenant SaaS

  (3) Status-based:
     → Operation restrictions based on status
     → can('update', 'Article', { status: { $ne: 'archived' } })
     → Only admins can edit published content

  (4) Time-based:
     → Allow only during specific time periods
     → Check current time when defining the policy
     → Implemented as an environment attribute

  (5) Approval workflow:
     → Draft → Review → Approved → Published
     → Different roles can operate at each stage
     → Combine with a state machine

  (6) Hierarchical permissions:
     → Department heads can access all resources under their department
     → Resolve permissions by traversing the org tree
     → May require a ReBAC-style approach

  (7) Delegated permissions:
     → Temporary delegation of permissions (e.g., proxy approvals)
     → Temporary permission expansion with an expiry date
     → Integration with audit logs is important

  Design principles:
  → Default deny (allow only what is explicitly permitted)
  → Principle of least privilege
  → Manage policies as code (version-controllable)
  → Testable (unit tests for policies)
  → Auditable (record who accessed what)
```

### 5.2 Practical Approval Workflow Implementation

```typescript
// Implementing an approval workflow with ABAC
interface WorkflowStage {
  status: string;
  allowedActions: Record<string, string[]>; // role → allowed actions
}

const articleWorkflow: WorkflowStage[] = [
  {
    status: 'draft',
    allowedActions: {
      author: ['read', 'update', 'delete', 'submit'],
      editor: ['read'],
      admin: ['read', 'update', 'delete'],
    },
  },
  {
    status: 'review',
    allowedActions: {
      author: ['read'],
      editor: ['read', 'approve', 'reject'],
      admin: ['read', 'approve', 'reject', 'update'],
    },
  },
  {
    status: 'approved',
    allowedActions: {
      author: ['read'],
      editor: ['read', 'publish'],
      admin: ['read', 'publish', 'update', 'reject'],
    },
  },
  {
    status: 'published',
    allowedActions: {
      author: ['read'],
      editor: ['read'],
      admin: ['read', 'update', 'unpublish', 'archive'],
    },
  },
];

// Ability definition supporting workflows
function defineWorkflowAbility(user: User, article: Article): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const stage = articleWorkflow.find((s) => s.status === article.status);
  if (!stage) return build();

  // Permissions based on role
  const roleActions = stage.allowedActions[user.role] || [];
  for (const action of roleActions) {
    can(action as Actions, 'Article', { id: article.id });
  }

  // Additional permissions for the author
  if (article.authorId === user.id) {
    const authorActions = stage.allowedActions['author'] || [];
    for (const action of authorActions) {
      can(action as Actions, 'Article', { id: article.id });
    }
  }

  return build();
}
```

### 5.3 Policies Using Environment Attributes

```typescript
// Policy definition including environment information
interface EnvironmentContext {
  time: Date;
  ipAddress: string;
  userAgent: string;
  isMfaVerified: boolean;
  riskScore: number;
  networkType: 'corporate' | 'vpn' | 'public';
}

function defineAbilityWithEnvironment(
  user: User,
  env: EnvironmentContext
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Basic read permission
  can('read', 'Article', { orgId: user.orgId });

  // Allow data export only during business hours
  const hour = env.time.getHours();
  const isBusinessHours = hour >= 9 && hour < 18;
  const isWeekday = env.time.getDay() >= 1 && env.time.getDay() <= 5;

  if (isBusinessHours && isWeekday) {
    can('export', 'Article' as any, { orgId: user.orgId });
  }

  // Allow access to confidential data only from the corporate network
  if (env.networkType === 'corporate' || env.networkType === 'vpn') {
    can('read', 'Article', { classification: 'confidential', orgId: user.orgId });
  }

  // Allow administrative operations only if MFA is verified
  if (env.isMfaVerified) {
    can('update', 'User', { orgId: user.orgId });
    can('delete', 'Article', { authorId: user.id });
  }

  // Deny sensitive operations if the risk score is high
  if (env.riskScore > 70) {
    cannot('export', 'Article' as any);
    cannot('delete', 'Article');
    cannot('update', 'User');
  }

  return build();
}

// Retrieve environment information
function getEnvironmentContext(req: Request): EnvironmentContext {
  return {
    time: new Date(),
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent') || '',
    isMfaVerified: req.session?.mfaVerified ?? false,
    riskScore: calculateRiskScore(req),
    networkType: classifyNetwork(getClientIP(req)),
  };
}
```

---

## 6. Testing Policies

### 6.1 Unit Tests

```typescript
// Policy tests
import { describe, it, expect } from 'vitest';
import { subject } from '@casl/ability';

describe('Editor permissions', () => {
  const ability = defineAbilityFor({
    id: 'user_1',
    role: 'editor',
    orgId: 'org_1',
  });

  it('can read articles', () => {
    expect(ability.can('read', 'Article')).toBe(true);
  });

  it('can create articles', () => {
    expect(ability.can('create', 'Article')).toBe(true);
  });

  it('can update own articles', () => {
    expect(
      ability.can('update', subject('Article', { authorId: 'user_1' }))
    ).toBe(true);
  });

  it('cannot update others articles', () => {
    expect(
      ability.can('update', subject('Article', { authorId: 'user_2' }))
    ).toBe(false);
  });

  it('cannot publish articles', () => {
    expect(ability.can('publish', 'Article')).toBe(false);
  });

  it('cannot manage users', () => {
    expect(ability.can('update', 'User')).toBe(false);
  });

  it('can manage own comments', () => {
    expect(
      ability.can('update', subject('Comment', { authorId: 'user_1' }))
    ).toBe(true);
    expect(
      ability.can('delete', subject('Comment', { authorId: 'user_1' }))
    ).toBe(true);
  });

  it('cannot manage others comments', () => {
    expect(
      ability.can('update', subject('Comment', { authorId: 'user_2' }))
    ).toBe(false);
  });
});

describe('Viewer permissions', () => {
  const ability = defineAbilityFor({
    id: 'user_2',
    role: 'viewer',
    orgId: 'org_1',
  });

  it('can only read published articles', () => {
    expect(
      ability.can('read', subject('Article', { status: 'published' }))
    ).toBe(true);
    expect(
      ability.can('read', subject('Article', { status: 'draft' }))
    ).toBe(false);
  });

  it('cannot create articles', () => {
    expect(ability.can('create', 'Article')).toBe(false);
  });
});

describe('Admin permissions', () => {
  const ability = defineAbilityFor({
    id: 'admin_1',
    role: 'admin',
    orgId: 'org_1',
  });

  it('can manage articles', () => {
    expect(ability.can('manage', 'Article')).toBe(true);
  });

  it('can update users in same org', () => {
    expect(
      ability.can('update', subject('User', { orgId: 'org_1' }))
    ).toBe(true);
  });

  it('cannot update users in different org', () => {
    expect(
      ability.can('update', subject('User', { orgId: 'org_2' }))
    ).toBe(false);
  });

  it('cannot delete users', () => {
    expect(ability.can('delete', 'User')).toBe(false);
  });
});

describe('Super admin permissions', () => {
  const ability = defineAbilityFor({
    id: 'super_1',
    role: 'super_admin',
    orgId: 'org_1',
  });

  it('can manage everything', () => {
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
    expect(ability.can('update', subject('User', { orgId: 'org_99' }))).toBe(true);
  });
});
```

### 6.2 Policy Matrix Testing

A matrix-based approach for comprehensive testing.

```typescript
// Policy matrix test — validates all role x action combinations
describe('Permission matrix', () => {
  type PermissionMatrix = {
    [role: string]: {
      [action: string]: {
        [subject: string]: boolean | 'conditional';
      };
    };
  };

  const expectedMatrix: PermissionMatrix = {
    super_admin: {
      manage: { all: true },
    },
    admin: {
      read: { Article: true, User: true, Comment: true, Organization: 'conditional' },
      create: { Article: true, User: true, Comment: true },
      update: { Article: true, User: 'conditional', Comment: true, Organization: 'conditional' },
      delete: { Article: true, User: false, Comment: true },
      publish: { Article: true },
    },
    editor: {
      read: { Article: true, User: false, Comment: true },
      create: { Article: true, Comment: true },
      update: { Article: 'conditional', Comment: 'conditional' },
      delete: { Article: 'conditional', Comment: 'conditional' },
      publish: { Article: false },
    },
    viewer: {
      read: { Article: 'conditional', Comment: true },
      create: { Article: false, Comment: true },
      update: { Article: false, Comment: 'conditional' },
      delete: { Article: false },
    },
  };

  for (const [role, actions] of Object.entries(expectedMatrix)) {
    describe(`${role} role`, () => {
      const ability = defineAbilityFor({
        id: `${role}_user`,
        role,
        orgId: 'org_1',
      });

      for (const [action, subjects] of Object.entries(actions)) {
        for (const [subjectType, expected] of Object.entries(subjects)) {
          if (expected === true) {
            it(`can ${action} ${subjectType}`, () => {
              expect(ability.can(action as Actions, subjectType as Subjects)).toBe(true);
            });
          } else if (expected === false) {
            it(`cannot ${action} ${subjectType}`, () => {
              expect(ability.can(action as Actions, subjectType as Subjects)).toBe(false);
            });
          }
          // 'conditional' is verified with individual tests
        }
      }
    });
  }
});
```

---

## 7. RBAC + ABAC Hybrid

### 7.1 Hybrid Architecture

```
Practical hybrid approach:

  Layer 1: RBAC (coarse-grained control)
    → Role determines the basic scope of access
    → admin, editor, viewer
    → Checked in middleware
    → "Can this user access this API endpoint?"

  Layer 2: ABAC (fine-grained control)
    → Additional constraints based on resource attributes
    → Only edit your own articles
    → Only data within the same organization
    → Checked in the service layer
    → "Can this user operate on this specific resource?"

  Layer 3: Business rules
    → Time-of-day restrictions, approval workflows
    → API rate limits, data volume limits
    → Checked within domain logic
    → "Is this operation permitted by business rules?"

  Request processing flow:

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Request                                         │
  │    │                                             │
  │    ▼                                             │
  │  ┌────────────────────┐                          │
  │  │ Auth middleware     │ ← Identify the user     │
  │  └────────┬───────────┘                          │
  │           ▼                                      │
  │  ┌────────────────────┐                          │
  │  │ RBAC check         │ ← Role-based control     │
  │  │ (middleware)        │    requireRole('editor') │
  │  └────────┬───────────┘                          │
  │           ▼                                      │
  │  ┌────────────────────┐                          │
  │  │ Fetch resource     │ ← Retrieve resource from │
  │  └────────┬───────────┘   DB                     │
  │           ▼                                      │
  │  ┌────────────────────┐                          │
  │  │ ABAC check         │ ← Attribute-based control│
  │  │ (service layer)    │    ability.can('update', │
  │  │                    │    subject('Article',    │
  │  │                    │    article))             │
  │  └────────┬───────────┘                          │
  │           ▼                                      │
  │  ┌────────────────────┐                          │
  │  │ Business rules     │ ← Business logic         │
  │  │ (domain layer)     │   constraints            │
  │  └────────┬───────────┘                          │
  │           ▼                                      │
  │  Response                                        │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

### 7.2 Hybrid Implementation

```typescript
// Complete example of hybrid access control

// Layer 1: RBAC middleware
function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
}

// Layer 2: ABAC service
class ArticleService {
  async update(user: User, articleId: string, data: UpdateArticleInput) {
    const ability = defineAbilityFor(user);
    const article = await prisma.article.findUnique({ where: { id: articleId } });

    if (!article) throw new NotFoundError('Article not found');

    // ABAC check
    ForbiddenError.from(ability).throwUnlessCan(
      'update',
      subject('Article', article)
    );

    // Layer 3: Business rules
    if (article.status === 'published' && !user.permissions?.includes('edit_published')) {
      throw new BusinessRuleError('Published articles require special permission to edit');
    }

    return prisma.article.update({ where: { id: articleId }, data });
  }
}

// API route (combining all 3 layers)
app.put(
  '/api/articles/:id',
  requireRole('editor', 'admin', 'super_admin'),  // Layer 1: RBAC
  async (req, res, next) => {
    try {
      const result = await articleService.update(  // Layer 2 + Layer 3
        req.user,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
```

---

## 8. Comparison of External Policy Engines

### 8.1 OPA (Open Policy Agent) / Rego

```
OPA (Open Policy Agent):

  Overview: General-purpose policy engine, a CNCF graduated project
  Language: Rego (a proprietary policy language)
  Deployment: Sidecar, library, REST API
  Use cases: Kubernetes, API gateways, microservices

  Rego policy example:

    package authz

    default allow = false

    allow {
      input.action == "read"
      input.resource.type == "article"
      input.resource.status == "published"
    }

    allow {
      input.action == "update"
      input.resource.type == "article"
      input.resource.author_id == input.subject.id
    }

    allow {
      input.subject.role == "admin"
      input.resource.org_id == input.subject.org_id
    }
```

### 8.2 Cedar (AWS)

```
Cedar (Amazon Verified Permissions):

  Overview: Policy language and engine developed by AWS
  Language: Cedar (a type-safe policy language)
  Features: Formally verifiable, fast evaluation, SDK provided
  Use cases: AWS Verified Permissions, applications

  Cedar policy example:

    permit(
      principal in Group::"editors",
      action == Action::"update",
      resource
    )
    when {
      resource.author == principal &&
      resource.status != "archived"
    };

    forbid(
      principal,
      action == Action::"delete",
      resource
    )
    when {
      resource.status == "published"
    };
```

### 8.3 Policy Engine Comparison

```
Policy engine comparison table:

  Item           │ CASL          │ OPA/Rego      │ Cedar         │ Casbin
  ───────────────┼──────────────┼──────────────┼──────────────┼──────────────
  Language       │ JavaScript/TS│ Rego (custom) │ Cedar (custom)│ Config files
  Runtime        │ Browser/Node │ Go binary     │ Rust binary   │ Multi-lang SDK
  Learning cost  │ Low          │ Medium–High   │ Medium        │ Low–Medium
  Type safety    │ TypeScript   │ None          │ Yes           │ None
  Frontend       │ ✓ (React etc)│ ✗             │ ✗            │ ✗
  DB integration │ ✓ (Prisma)   │ ✗             │ ✗            │ Limited
  Performance    │ Fast (same   │ Fast (Go      │ Very fast    │ Fast
                 │ process)     │ sidecar)      │ (Rust)       │
  Formal verify  │ ✗            │ Limited       │ ✓            │ ✗
  Use case       │ Web apps     │ K8s/micro-    │ AWS           │ General
                 │              │ services      │ integration   │
  License        │ MIT          │ Apache 2.0   │ Apache 2.0   │ Apache 2.0

  Selection guide:
    Single web app    → CASL (sharable with frontend)
    Microservices     → OPA (sidecar pattern)
    AWS environment   → Cedar (Verified Permissions)
    Multi-language    → Casbin (rich SDK ecosystem)
```

---

## 9. Anti-Patterns

### 9.1 Common Mistakes

```
ABAC anti-patterns:

  (1) Permission control on the frontend only
     ✗ Simply hiding buttons
     → Direct API calls can still perform operations
     → Always validate on the backend as well

     ✗ Bad example:
       // Hide button on frontend
       {user.role === 'admin' && <DeleteButton />}
       // But no permission check in the API
       app.delete('/api/articles/:id', async (req, res) => {
         await prisma.article.delete({ where: { id: req.params.id } });
       });

     ✓ Good example:
       // Hide button on frontend + permission check in API
       app.delete('/api/articles/:id', async (req, res) => {
         const ability = defineAbilityFor(req.user);
         ForbiddenError.from(ability).throwUnlessCan('delete', ...);
         await prisma.article.delete({ where: { id: req.params.id } });
       });

  (2) Hardcoded permission checks
     ✗ Bad example:
       if (user.role === 'admin' || user.role === 'editor') {
         // Allow operation
       }
     → Code changes required every time a role is added
     → Inconsistencies arise from scattered checks

     ✓ Good example:
       if (ability.can('update', subject('Article', article))) {
         // Allow operation
       }
     → Manage policies in one place

  (3) Overly complex policies
     ✗ Policies with more than 100 intertwined conditions
     → Difficult to debug
     → Impacts performance
     → Address by layering and modularizing policies

  (4) Insufficient testing
     ✗ No unit tests for policies
     → Unintended permission leaks occur during changes
     → Always write policy matrix tests

  (5) Lack of audit logs
     ✗ No record of who accessed what and when
     → Investigation is impossible during security incidents
     → Always log access control decisions
```

### 9.2 Performance Pitfalls

```
Performance considerations:

  (1) N+1 problem
     ✗ Checking permissions individually for each item in a list
       for (const article of articles) {
         if (ability.can('read', subject('Article', article))) { ... }
       }
     → Processing time grows in proportion to the number of items

     ✓ Filter at the DB level
       const articles = await prisma.article.findMany({
         where: accessibleBy(ability, 'read').Article,
       });

  (2) Cost of fetching attributes
     ✗ Fetching all attributes from the DB every time
     → Select only the required attributes
     → Utilize caching

  (3) Caching policy evaluation results
     → Cache evaluation results for the same user and resource type
     → Set a short TTL (to ensure permission changes take effect quickly)
     → Invalidate the cache when user permissions change
```

---

## 10. Audit Logs and Compliance

```typescript
// Audit log for ABAC access control
interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  decision: 'allow' | 'deny';
  reason?: string;
  attributes: {
    subject: Record<string, any>;
    resource: Record<string, any>;
    environment: Record<string, any>;
  };
  ipAddress: string;
  userAgent: string;
}

class AuditLogger {
  async log(entry: AuditLogEntry) {
    // Output as structured log
    console.log(JSON.stringify({
      level: entry.decision === 'deny' ? 'warn' : 'info',
      message: `ABAC ${entry.decision}: ${entry.userId} ${entry.action} ${entry.resourceType}/${entry.resourceId}`,
      ...entry,
    }));

    // Persist to DB
    await prisma.auditLog.create({
      data: {
        timestamp: entry.timestamp,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        decision: entry.decision,
        reason: entry.reason,
        metadata: entry.attributes,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }
}

// Permission check with auditing
async function authorizeWithAudit(
  user: User,
  action: Actions,
  resourceType: Subjects,
  resource: Record<string, any>,
  req: Request
): Promise<boolean> {
  const ability = defineAbilityFor(user);
  const allowed = ability.can(action, subject(resourceType, resource));

  await auditLogger.log({
    timestamp: new Date(),
    userId: user.id,
    action,
    resourceType,
    resourceId: resource.id,
    decision: allowed ? 'allow' : 'deny',
    attributes: {
      subject: { id: user.id, role: user.role, orgId: user.orgId },
      resource: { id: resource.id, authorId: resource.authorId, status: resource.status },
      environment: { time: new Date().toISOString(), ip: getClientIP(req) },
    },
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent') || '',
  });

  return allowed;
}
```

---

## 11. Exercises

### Exercise 1: Basic ABAC Policy (Foundational)

Implement the following requirements using CASL.

```
Requirements:
- viewer: can only read published articles
- editor: can read all articles; can edit and delete their own articles
- admin: can manage all articles; can manage users in the same organization
- All roles: can only edit and delete their own comments
- No one can edit archived articles

Tests:
- Verify with vitest that each role has the expected permissions
- Create at least 10 test cases
```

### Exercise 2: Approval Workflow (Applied)

Implement the following approval flow using ABAC.

```
Requirements:
- Article statuses: draft → submitted → reviewed → approved → published
- Different roles can perform operations at each status
- Authors can only edit drafts
- Reviewers can approve or reject submitted articles
- Admins can operate at any status
- Status transitions are one-way only (rejection returns article to draft)

Implementation:
- Combine a state machine with CASL
- API endpoint: POST /api/articles/:id/transition
- Tests: Verify the transition matrix for all statuses x all roles
```

### Exercise 3: Multi-Tenant ABAC (Advanced)

Design and implement ABAC for a multi-tenant SaaS.

```
Requirements:
- Each organization can define different policies
- Custom role creation (defined by organization administrators)
- Organization scope for resources (no access to data from other organizations)
- Cross-organization collaboration (access only to invited resources)
- Policy audit logs

Design:
- How to store policies (DB schema)
- Converting custom roles to Ability
- Performance optimization (caching strategy)

Implementation:
- Fully functional prototype using Prisma + CASL
- Mock API for organization management UI
- Tests: Verify data isolation between organizations
```

---

## 12. FAQ and Troubleshooting

### Q1: Getting "Cannot read properties of undefined" error in CASL

**Cause**: This occurs when an object is passed directly without using the `subject()` helper. CASL requires the `__caslSubjectType__` property to identify the type of subject.

```typescript
// ✗ Causes an error
ability.can('update', { authorId: 'user_1' }); // subject type is unknown

// ✓ Correct approach
import { subject } from '@casl/ability';
ability.can('update', subject('Article', { authorId: 'user_1' }));
```

### Q2: CASL rules are not working as expected

**Cause**: `cannot` is evaluated after `can`, so be mindful of order. Also, a conditional `can` does not override an unconditional `can`.

```typescript
// ✗ Unintended behavior
can('read', 'Article');                          // Can read all articles
can('read', 'Article', { status: 'published' }); // This only adds to the rule above

// ✓ Correct approach (deny-first)
can('read', 'Article', { status: 'published' }); // More restrictive rule first
// Allow all articles for admin only
if (user.role === 'admin') {
  can('read', 'Article'); // Unconditional allow
}
```

### Q3: How to address poor performance

```
Steps to improve performance:

  1. Cache Ability instances
     → Do not regenerate on every request
     → Cache per user with a TTL

  2. Optimize DB queries
     → Use accessibleBy for DB-level filtering
     → Select only the required attributes

  3. Reduce the number of rules
     → Consolidate redundant rules
     → Use wildcards (manage, all) appropriately

  4. Simplify conditions
     → Avoid complex $elemMatch where possible
     → Use precomputed attributes when feasible
```

### Q4: CASL conditions do not match Prisma where clauses

**Cause**: There are some incompatibilities between CASL's condition syntax and Prisma's query syntax. The `@casl/prisma` package handles this conversion, but not all MongoDB operators are supported.

```typescript
// Supported conditions
can('read', 'Article', { status: 'published' });        // ✓
can('read', 'Article', { status: { $ne: 'archived' } }); // ✓
can('read', 'Article', { status: { $in: ['a', 'b'] } }); // ✓

// Conditions that may not be supported
can('read', 'Article', { tags: { $all: ['a', 'b'] } });  // △
can('read', 'Article', { title: { $regex: /^test/ } });   // ✗
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping straight to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world work?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|-----------|
| ABAC | Control based on attributes (subject, resource, action, environment) |
| NIST Architecture | Separation of PEP, PDP, PAP, PIP |
| CASL | JS/TS policy library with conditional permission definitions |
| Hybrid | RBAC (basic) + ABAC (fine-grained control) |
| Frontend | Conditional UI display with the Can component (for UX purposes) |
| Backend | Permission checks at the API and DB level (for security purposes) |
| Testing | Verify all roles x all actions with policy matrix tests |
| Auditing | Record access control decisions in audit logs |
| Policy engines | CASL (Web), OPA (K8s), Cedar (AWS) |

---

## Recommended Next Guides

---

## References
1. NIST. "Guide to Attribute Based Access Control (ABAC) Definition and Considerations." SP 800-162, 2014.
2. NIST. "Attribute-Based Access Control." SP 800-205, 2019.
3. CASL. "Documentation." casl.js.org, 2024.
4. Oso. "Authorization Academy." osohq.com, 2024.
5. Open Policy Agent. "Documentation." openpolicyagent.org, 2024.
6. AWS. "Cedar Policy Language." docs.cedarpolicy.com, 2024.
7. OWASP. "Access Control Cheat Sheet." cheatsheetseries.owasp.org, 2024.
8. Casbin. "Documentation." casbin.org, 2024.
