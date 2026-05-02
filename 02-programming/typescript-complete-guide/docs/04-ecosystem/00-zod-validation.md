# Zod Validation Complete Guide

> Integrate runtime validation and type inference with Zod, a TypeScript-first schema definition library

## What You Will Learn

1. **Schema Definition Basics** -- Definition patterns from primitive types to objects, arrays, and unions
2. **Advanced Validation** -- Complex schema design using transform, refine, pipe, and discriminatedUnion
3. **Practical Integration** -- Applying validation to forms, API requests/responses, and environment variable verification
4. **Error Handling** -- Parsing ZodError, custom error messages, and internationalization support
5. **Performance and Best Practices** -- Schema design guidelines, testing, and ecosystem integration


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Schema Definition Basics

### What is Zod?

Zod is a TypeScript-first schema declaration and validation library. Its defining feature is the ability to automatically infer TypeScript types from schema definitions. This solves the "double definition problem" of types and validation, achieving a Single Source of Truth.

```
Core value of Zod:

  Traditional approach (double definition problem):
  ┌─────────────────────┐     ┌─────────────────────┐
  │ TypeScript type def  │     │ Validation           │
  │ interface User {     │     │ function validate(x) │
  │   name: string;      │ ←→ │   if (!x.name) ...   │
  │   age: number;       │     │   if (!x.age) ...    │
  │ }                    │     │ }                    │
  └─────────────────────┘     └─────────────────────┘
     Manual sync required → Risk of divergence

  Zod approach (Single Source of Truth):
  ┌─────────────────────────────┐
  │ const UserSchema = z.object({│
  │   name: z.string(),          │
  │   age: z.number(),           │
  │ })                           │
  │                              │
  │ type User = z.infer<...>     │ ← Type is automatically inferred
  │ schema.parse(data)           │ ← Validation functionality built in
  └─────────────────────────────┘
```

### 1-1. Primitive Types

```typescript
import { z } from "zod";

// Primitives
const stringSchema = z.string();
const numberSchema = z.number();
const boolSchema = z.boolean();
const dateSchema = z.date();
const bigintSchema = z.bigint();
const undefinedSchema = z.undefined();
const nullSchema = z.null();
const voidSchema = z.void();
const anySchema = z.any();
const unknownSchema = z.unknown();
const neverSchema = z.never();

// Literals
const literalSchema = z.literal("active");
const numLiteral = z.literal(42);
const boolLiteral = z.literal(true);

// enum
const statusSchema = z.enum(["active", "inactive", "pending"]);
type Status = z.infer<typeof statusSchema>; // "active" | "inactive" | "pending"

// Get list of enum values
statusSchema.options; // ["active", "inactive", "pending"]

// Validate a value not in the enum
statusSchema.safeParse("unknown"); // { success: false, ... }

// native enum
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}
const directionSchema = z.nativeEnum(Direction);
type Dir = z.infer<typeof directionSchema>; // Direction

// parse and safeParse
const result = stringSchema.parse("hello");      // "hello" (throws on failure)
const safe = stringSchema.safeParse(123);         // { success: false, error: ZodError }
if (safe.success) {
  console.log(safe.data); // type: string
}
```

### 1-2. String Validation

```typescript
const emailSchema = z.string()
  .email("Please enter a valid email address")
  .min(5, "Please enter at least 5 characters")
  .max(255, "Please enter no more than 255 characters");

const urlSchema = z.string().url();
const uuidSchema = z.string().uuid();
const cuuidSchema = z.string().cuid();
const cuid2Schema = z.string().cuid2();
const ulidSchema = z.string().ulid();
const emojiSchema = z.string().emoji();
const datetimeSchema = z.string().datetime(); // ISO 8601
const ipSchema = z.string().ip(); // IPv4 or IPv6
const ipv4Schema = z.string().ip({ version: "v4" });
const ipv6Schema = z.string().ip({ version: "v6" });
const regexSchema = z.string().regex(/^[A-Z]{3}-\d{4}$/);

// Apply trim + toLowerCase before validation
const normalizedEmail = z.string()
  .trim()
  .toLowerCase()
  .email();

// All string validation methods
const fullStringValidation = z.string()
  .min(1, "Required field")           // Minimum character count
  .max(100, "Up to 100 characters")   // Maximum character count
  .length(10, "Exactly 10 characters") // Fixed length
  .startsWith("https://")              // Starts with
  .endsWith(".com")                    // Ends with
  .includes("example")                 // Contains
  .trim()                              // Remove leading/trailing whitespace
  .toLowerCase()                       // Convert to lowercase
  .toUpperCase();                      // Convert to uppercase

// Japanese name validation
const japaneseNameSchema = z.string()
  .min(1, "Please enter your name")
  .max(50, "Please enter no more than 50 characters")
  .regex(/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー\s]+$/u, "Please enter in Japanese");

const phoneSchema = z.string()
  .regex(/^0\d{1,4}-?\d{1,4}-?\d{4}$/, "Please enter a valid phone number");

const postalCodeSchema = z.string()
  .regex(/^\d{3}-?\d{4}$/, "Please enter a valid postal code")
  .transform((val) => val.replace("-", "").replace(/(\d{3})(\d{4})/, "$1-$2"));
```

### 1-3. Number Validation

```typescript
const ageSchema = z.number()
  .int("Please enter an integer")
  .min(0, "Please enter a value of 0 or greater")
  .max(150, "Please enter a value of 150 or less");

const priceSchema = z.number()
  .positive("Please enter a positive value")
  .multipleOf(0.01); // Up to 2 decimal places

const percentSchema = z.number().min(0).max(100);

// All number validation methods
const fullNumberValidation = z.number()
  .int()              // Integer
  .positive()         // Positive number (> 0)
  .nonnegative()      // Non-negative (>= 0)
  .negative()         // Negative number (< 0)
  .nonpositive()      // Non-positive (<= 0)
  .multipleOf(5)      // Multiple of 5
  .min(0)             // Minimum value
  .max(100)           // Maximum value
  .gt(0)              // Greater than
  .gte(0)             // Greater than or equal
  .lt(100)            // Less than
  .lte(100)           // Less than or equal
  .finite()           // Finite number (excludes Infinity)
  .safe();            // Number.MIN_SAFE_INTEGER to MAX_SAFE_INTEGER

// NaN handling
const safeNumber = z.number().refine((n) => !Number.isNaN(n), "Please enter a number");
```

### 1-4. Date Validation

```typescript
const dateSchema = z.date();

// Date range check
const futureDate = z.date().min(new Date(), "Please specify a future date");
const pastDate = z.date().max(new Date(), "Please specify a past date");

// Schema to convert string to Date
const dateStringSchema = z.string()
  .datetime()
  .transform((val) => new Date(val));

// Auto-conversion with coerce
const coerceDateSchema = z.coerce.date();
coerceDateSchema.parse("2024-01-15"); // Date object
coerceDateSchema.parse(1705276800000); // Date object (timestamp)
```

---

## 2. Objects and Arrays

### 2-1. Object Schema

```
Zod object schema and type inference:

  z.object({                     type User = {
    name: z.string(),    ------>   name: string;
    age: z.number(),     ------>   age: number;
    email: z.string()    ------>   email: string;
      .email(),                      // (validation rules don't affect types)
  })                             }

  Automatically inferred with z.infer<typeof schema>
```

```typescript
// Object schema
const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  role: z.enum(["user", "admin"]).default("user"),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type User = z.infer<typeof UserSchema>;
// {
//   name: string;
//   email: string;
//   age?: number | undefined;
//   role: "user" | "admin";     // not optional because of default
//   tags: string[];
//   metadata?: Record<string, unknown> | undefined;
// }

// Schema where input and output types differ
type UserInput = z.input<typeof UserSchema>;
// age? is number | undefined
// role? is "user" | "admin" | undefined (before default is applied)
// tags? is string[] | undefined

type UserOutput = z.output<typeof UserSchema>;
// role is "user" | "admin" (after default is applied)
// tags is string[]
```

### Difference Between z.input, z.output, and z.infer

```
  z.input<typeof Schema>     Input type before transformation (before transform, default applied)
  z.output<typeof Schema>    Output type after transformation (after transform, default applied)
  z.infer<typeof Schema>     Same as z.output (alias)

  Example: z.string().default("hello")
    z.input  → string | undefined
    z.output → string
    z.infer  → string

  Example: z.string().transform(Number)
    z.input  → string
    z.output → number
    z.infer  → number
```

### 2-2. Object Operations

```typescript
// pick / omit
const UserCreateSchema = UserSchema.pick({
  name: true,
  email: true,
  age: true,
});

const UserPublicSchema = UserSchema.omit({
  metadata: true,
});

// partial / required
const UserUpdateSchema = UserSchema.partial(); // all fields optional
const UserStrictSchema = UserSchema.required(); // all fields required

// deepPartial (all nested objects also become optional)
const DeepPartialUser = UserSchema.deepPartial();

// merge / extend
const UserWithIdSchema = UserSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Merge two schemas
const PersonSchema = z.object({ name: z.string(), age: z.number() });
const ContactSchema = z.object({ email: z.string(), phone: z.string() });
const PersonContactSchema = PersonSchema.merge(ContactSchema);

// passthrough / strict / strip
const strictSchema = UserSchema.strict(); // Error on extra fields
const passthroughSchema = UserSchema.passthrough(); // Retain extra fields
// Default (strip): Remove extra fields

// catchall: Validation for undefined keys
const configSchema = z.object({
  host: z.string(),
  port: z.number(),
}).catchall(z.string());
// { host: string; port: number; [key: string]: string }
```

### 2-3. Arrays and Tuples

```typescript
// Array
const tagsSchema = z.array(z.string()).min(1).max(10);
const uniqueTags = z.array(z.string()).refine(
  (items) => new Set(items).size === items.length,
  { message: "Tags cannot be duplicated" }
);

// nonempty: array with at least one element
const nonEmptyArray = z.array(z.number()).nonempty();
type NonEmptyNumbers = z.infer<typeof nonEmptyArray>;
// [number, ...number[]]

// Tuple
const coordinateSchema = z.tuple([z.number(), z.number()]);
type Coordinate = z.infer<typeof coordinateSchema>; // [number, number]

// Variadic tuple
const argsSchema = z.tuple([z.string(), z.number()]).rest(z.boolean());
type Args = z.infer<typeof argsSchema>; // [string, number, ...boolean[]]

// record: object with dynamic keys
const scoresSchema = z.record(z.string(), z.number());
type Scores = z.infer<typeof scoresSchema>; // Record<string, number>

// Apply validation to keys as well
const envSchema = z.record(
  z.string().regex(/^[A-Z_]+$/), // Keys are uppercase letters + underscores only
  z.string(),
);

// Map and Set
const mapSchema = z.map(z.string(), z.number());
const setSchema = z.set(z.string());
type MyMap = z.infer<typeof mapSchema>; // Map<string, number>
type MySet = z.infer<typeof setSchema>; // Set<string>
```

### 2-4. Union and Intersection

```typescript
// union
const stringOrNumber = z.union([z.string(), z.number()]);
// Shorthand
const stringOrNumber2 = z.string().or(z.number());

// discriminatedUnion
const PaymentSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("credit_card"),
    cardNumber: z.string().regex(/^\d{16}$/),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/),
    cvv: z.string().regex(/^\d{3,4}$/),
  }),
  z.object({
    method: z.literal("bank_transfer"),
    bankCode: z.string().length(4),
    accountNumber: z.string(),
  }),
  z.object({
    method: z.literal("wallet"),
    walletId: z.string().uuid(),
  }),
]);

type Payment = z.infer<typeof PaymentSchema>;

// intersection
const hasId = z.object({ id: z.string().uuid() });
const hasTimestamps = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});
const entitySchema = z.intersection(hasId, hasTimestamps);
// Shorthand
const entitySchema2 = hasId.and(hasTimestamps);

// nullable / optional / nullish
const nullableString = z.string().nullable();     // string | null
const optionalString = z.string().optional();     // string | undefined
const nullishString = z.string().nullish();       // string | null | undefined
```

---

## 3. Advanced Patterns

### 3-1. discriminatedUnion in Detail

```typescript
// Comparison: discriminatedUnion vs union
// discriminatedUnion validates quickly using the discriminant
// union tries each member in order (slow)

const ShapeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("circle"),
    radius: z.number().positive(),
  }),
  z.object({
    type: z.literal("rectangle"),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  z.object({
    type: z.literal("triangle"),
    base: z.number().positive(),
    height: z.number().positive(),
  }),
]);

// Error messages are precise
ShapeSchema.safeParse({ type: "circle", radius: -1 });
// → "radius must be positive" (error within the circle schema)

// With union, errors from all members are listed, making it hard to understand
```

### 3-2. transform and pipe

```
transform flow:

  Input  -->  Validation  -->  Transform  -->  Output
  "123"       z.string()       Number()        123
              (string check)   (string→number)

pipe flow:

  Input  -->  First schema  -->  Transform  -->  Second schema  -->  Output
  "123"       z.string()         Number()         z.number()          123
              (string check)     (transform)      .positive()
                                                 (number check)
```

```typescript
// transform: Transform value after validation
const StringToNumberSchema = z.string()
  .transform((val) => Number(val))
  .pipe(z.number().positive()); // Further validate the transformed value

const result = StringToNumberSchema.parse("42"); // 42 (number)

// Convert date string to Date
const DateStringSchema = z.string()
  .datetime()
  .transform((val) => new Date(val));

// coerce: Implicit type conversion
const CoerceNumberSchema = z.coerce.number(); // Number(input)
const CoerceDateSchema = z.coerce.date();     // new Date(input)
const CoerceBoolSchema = z.coerce.boolean();  // Boolean(input)
const CoerceStringSchema = z.coerce.string(); // String(input)
const CoerceBigintSchema = z.coerce.bigint(); // BigInt(input)

// Practical transform example
const MoneySchema = z.object({
  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format")
    .transform((val) => Math.round(parseFloat(val) * 100)), // Convert to cents
  currency: z.enum(["USD", "EUR", "JPY"]),
});

type Money = z.infer<typeof MoneySchema>;
// { amount: number; currency: "USD" | "EUR" | "JPY" }

MoneySchema.parse({ amount: "19.99", currency: "USD" });
// { amount: 1999, currency: "USD" }

// Convert CSV row to object
const CsvRowSchema = z.string()
  .transform((row) => row.split(","))
  .pipe(z.tuple([z.string(), z.string(), z.coerce.number()]))
  .transform(([name, email, age]) => ({ name, email, age }));

CsvRowSchema.parse("Alice,alice@test.com,30");
// { name: "Alice", email: "alice@test.com", age: 30 }
```

### 3-3. refine and superRefine

```typescript
// refine: Custom validation
const PasswordSchema = z.string()
  .min(8, "At least 8 characters")
  .refine((val) => /[A-Z]/.test(val), "Must include uppercase letters")
  .refine((val) => /[a-z]/.test(val), "Must include lowercase letters")
  .refine((val) => /[0-9]/.test(val), "Must include numbers")
  .refine((val) => /[!@#$%^&*]/.test(val), "Must include special characters");

// Specify path in refine
const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: "End date must be after start date",
    path: ["endDate"], // Associate error with endDate field
  }
);

// superRefine: Validation spanning multiple fields
const RegisterSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
  email: z.string().email(),
  acceptTerms: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
  }

  if (!data.acceptTerms) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please agree to the terms of service",
      path: ["acceptTerms"],
    });
  }
});

// Async validation with superRefine
const UniqueEmailSchema = z.object({
  email: z.string().email(),
}).superRefine(async (data, ctx) => {
  const exists = await checkEmailExists(data.email);
  if (exists) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "This email address is already in use",
      path: ["email"],
    });
  }
});

// Use parseAsync / safeParseAsync for async validation
const result = await UniqueEmailSchema.safeParseAsync({
  email: "test@example.com",
});
```

### 3-4. Recursive Type Schemas

```typescript
// Recursive tree structure
type Category = {
  name: string;
  children: Category[];
};

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(CategorySchema),
  })
);

// Recursive JSON type
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
);

// Recursion with depth limit
function createNestedSchema(maxDepth: number): z.ZodTypeAny {
  if (maxDepth <= 0) {
    return z.object({ name: z.string() });
  }
  return z.object({
    name: z.string(),
    children: z.array(createNestedSchema(maxDepth - 1)).optional(),
  });
}

const shallowTree = createNestedSchema(3); // Maximum 3 levels
```

### 3-5. preprocess and Preprocessor Patterns

```typescript
// preprocess: Pre-process data before validation
const NumberFromString = z.preprocess(
  (val) => (typeof val === "string" ? Number(val) : val),
  z.number(),
);

NumberFromString.parse("42"); // 42
NumberFromString.parse(42);   // 42

// Pre-process form data (convert empty strings to undefined)
const FormFieldSchema = z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.string().optional(),
);

// Convert checkbox value to boolean
const CheckboxSchema = z.preprocess(
  (val) => val === "on" || val === "true" || val === true,
  z.boolean(),
);
```

### 3-6. Branded Types

```typescript
// Attach brand type with brand
const UserIdSchema = z.string().uuid().brand<"UserId">();
type UserId = z.infer<typeof UserIdSchema>;
// string & { __brand: "UserId" }

const OrderIdSchema = z.string().uuid().brand<"OrderId">();
type OrderId = z.infer<typeof OrderIdSchema>;

function getUserById(id: UserId): Promise<User> {
  // Only accepts UserId type
  return fetch(`/api/users/${id}`).then((r) => r.json());
}

const userId = UserIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const orderId = OrderIdSchema.parse("550e8400-e29b-41d4-a716-446655440001");

getUserById(userId);  // OK
// getUserById(orderId); // Error: OrderId cannot be assigned to UserId
// getUserById("raw-string"); // Error: string cannot be assigned to UserId
```

---

## 4. Practical Integration

### 4-1. Environment Variable Validation

```typescript
// env.ts
const EnvSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // External API
  API_KEY: z.string().min(32),
  API_BASE_URL: z.string().url(),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
}).superRefine((env, ctx) => {
  // SMTP settings must all be specified or all omitted
  const smtpFields = [env.SMTP_HOST, env.SMTP_PORT, env.SMTP_USER, env.SMTP_PASS];
  const defined = smtpFields.filter((f) => f !== undefined).length;
  if (defined > 0 && defined < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SMTP settings must all be specified or all omitted",
      path: ["SMTP_HOST"],
    });
  }
});

// Validate on app startup
function loadEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment variable validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
// type: { NODE_ENV: "development" | ..., PORT: number, ... }
```

### 4-2. API Response Validation

```typescript
// Generic API response schema
const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      hasNext: z.boolean(),
    }).optional(),
  });

const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
    })).optional(),
  }),
});

const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion("success", [
    ApiSuccessSchema(dataSchema),
    ApiErrorSchema,
  ]);

const UserListResponseSchema = ApiResponseSchema(z.array(UserSchema));

// Type-safe fetch function
async function fetchApi<T extends z.ZodTypeAny>(
  url: string,
  schema: T,
): Promise<z.infer<T>> {
  const response = await fetch(url);
  const json = await response.json();
  return schema.parse(json);
}

// Usage example
const usersResponse = await fetchApi(
  "/api/users",
  ApiResponseSchema(z.array(UserSchema)),
);

if (usersResponse.success) {
  // usersResponse.data type is User[]
  console.log(usersResponse.data);
} else {
  // usersResponse.error type
  console.error(usersResponse.error.message);
}
```

### 4-3. Form Validation (React Hook Form + Zod)

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const ContactFormSchema = z.object({
  name: z.string()
    .min(1, "Please enter your name")
    .max(100, "Please enter no more than 100 characters"),
  email: z.string()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address"),
  category: z.enum(["inquiry", "support", "feedback"], {
    errorMap: () => ({ message: "Please select a category" }),
  }),
  message: z.string()
    .min(10, "Please enter at least 10 characters")
    .max(1000, "Please enter no more than 1000 characters"),
  attachments: z.array(z.instanceof(File))
    .max(3, "You can attach up to 3 files")
    .refine(
      (files) => files.every((f) => f.size <= 5 * 1024 * 1024),
      "Each file must be 5MB or less",
    )
    .optional(),
});

type ContactForm = z.infer<typeof ContactFormSchema>;

function ContactFormComponent() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      category: "inquiry",
    },
  });

  const onSubmit = async (data: ContactForm) => {
    // data is validated ContactForm type
    await submitForm(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name")} />
      {errors.name && <span>{errors.name.message}</span>}

      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}

      <select {...register("category")}>
        <option value="inquiry">Inquiry</option>
        <option value="support">Support</option>
        <option value="feedback">Feedback</option>
      </select>

      <textarea {...register("message")} />
      {errors.message && <span>{errors.message.message}</span>}

      <button type="submit" disabled={isSubmitting}>Submit</button>
    </form>
  );
}
```

### 4-4. Express / Hono Middleware

```typescript
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// Generic validation middleware
function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        errors: result.error.flatten().fieldErrors,
      });
    }

    // Store validated data in req
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    next();
  };
}

// Route definition
const CreateUserSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  query: z.object({}),
  params: z.object({}),
});

app.post("/users", validate(CreateUserSchema), (req, res) => {
  // req.body is type-safe as { name: string; email: string }
  const user = createUser(req.body);
  res.json(user);
});
```

---

## 5. Error Handling

### 5-1. ZodError Structure

```typescript
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0),
});

const result = schema.safeParse({ name: "", email: "invalid", age: -1 });

if (!result.success) {
  // result.error is a ZodError instance

  // issues: Array of individual errors
  console.log(result.error.issues);
  // [
  //   { code: "too_small", path: ["name"], message: "..." },
  //   { code: "invalid_string", path: ["email"], message: "..." },
  //   { code: "too_small", path: ["age"], message: "..." },
  // ]

  // flatten: Group error messages by field
  console.log(result.error.flatten());
  // {
  //   formErrors: [],
  //   fieldErrors: {
  //     name: ["String must contain at least 1 character(s)"],
  //     email: ["Invalid email"],
  //     age: ["Number must be greater than or equal to 0"],
  //   },
  // }

  // format: Get as nested structure
  console.log(result.error.format());
  // {
  //   _errors: [],
  //   name: { _errors: ["..."] },
  //   email: { _errors: ["..."] },
  //   age: { _errors: ["..."] },
  // }
}
```

### 5-2. Custom Error Messages

```typescript
// Specify messages for each validation
const schema = z.string({
  required_error: "This field is required",
  invalid_type_error: "Please enter a string",
}).min(1, { message: "Please enter at least 1 character" });

// Customize globally with errorMap
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === "string") {
      return { message: "Please enter a string" };
    }
    if (issue.expected === "number") {
      return { message: "Please enter a number" };
    }
  }
  if (issue.code === z.ZodIssueCode.too_small) {
    if (issue.type === "string") {
      return { message: `Please enter at least ${issue.minimum} characters` };
    }
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);

// i18n-compatible error map (zod-i18n-map)
import { zodI18nMap } from "zod-i18n-map";
import translation from "zod-i18n-map/locales/ja/zod.json";
import i18next from "i18next";

i18next.init({
  lng: "ja",
  resources: { ja: { zod: translation } },
});

z.setErrorMap(zodI18nMap);
// → Error messages are automatically translated to Japanese
```

---

## Comparison Tables

### Validation Library Comparison

| Library | Size | Type Inference | Performance | API Style | Ecosystem |
|---------|------|----------------|-------------|-----------|-----------|
| zod | ~14KB | Best | Good | Method chain | Largest |
| yup | ~15KB | Medium | Good | Method chain | Large |
| joi | ~30KB | Low(@types) | Good | Method chain | Large(Node) |
| superstruct | ~3KB | High | Good | Function composition | Small |
| valibot | ~1KB | High | Best | Function composition | Growing |
| typia | 0KB(generated) | Best | Best | Decorator | Small |
| arktype | ~5KB | Best | Best | String DSL | Small |

### parse vs safeParse

| Method | On Failure | Return Type | Use Case |
|--------|------------|-------------|----------|
| `.parse()` | ZodError throw | `T` | Trusted internal data |
| `.safeParse()` | `{ success: false }` | `SafeParseResult<T>` | User input, API |
| `.parseAsync()` | ZodError throw | `Promise<T>` | When using async refine |
| `.safeParseAsync()` | `{ success: false }` | `Promise<SafeParseResult<T>>` | Async safe version |

### Zod Method Cheat Sheet

| Category | Method | Description |
|----------|--------|-------------|
| Transform | `.transform()` | Transform value after validation |
| Transform | `.pipe()` | Pipe to another schema |
| Transform | `.preprocess()` | Pre-process before validation |
| Transform | `.coerce` | Implicit type conversion |
| Validation | `.refine()` | Custom validation |
| Validation | `.superRefine()` | Advanced custom validation |
| Optional | `.optional()` | `T \| undefined` |
| Optional | `.nullable()` | `T \| null` |
| Optional | `.nullish()` | `T \| null \| undefined` |
| Optional | `.default()` | Default value |
| Optional | `.catch()` | Fallback on parse failure |
| Type | `.brand()` | Attach brand type |
| Type | `.readonly()` | Make Readonly |
| Get | `z.infer<>` | Get output type |
| Get | `z.input<>` | Get input type |

---

## Anti-Patterns

### AP-1: Double-defining schemas and types

```typescript
// NG: Defining types and schemas separately (risk of sync breaking)
interface User {
  name: string;
  email: string;
  age: number;
}

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number(), // Easy to diverge from interface
});

// OK: Infer types from schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0),
});
type User = z.infer<typeof UserSchema>;
// Single Source of Truth
```

### AP-2: Using parse without catch

```typescript
// NG: Not handling parse exceptions
app.post("/users", (req, res) => {
  const data = UserSchema.parse(req.body); // ZodError may be thrown
  // ...
});

// OK: Handle safely with safeParse
app.post("/users", (req, res) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      errors: result.error.flatten().fieldErrors,
    });
  }
  const data = result.data; // Validated
});
```

### AP-3: Scattering validation logic

```typescript
// NG: Validation scattered across the codebase
function createUser(name: string, email: string) {
  if (!name) throw new Error("Name required");
  if (!email.includes("@")) throw new Error("Invalid email");
  // ...
}

// OK: Consolidate validation with schema
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

function createUser(input: unknown) {
  const data = CreateUserSchema.parse(input);
  // data is validated
}
```

### AP-4: Overusing coerce

```typescript
// NG: Relying on implicit conversion by using coerce carelessly
const schema = z.object({
  count: z.coerce.number(),  // null → 0, undefined → NaN, "abc" → NaN
  active: z.coerce.boolean(), // 0 → false, "" → false, "false" → true!
});

// OK: Convert explicitly with transform
const schema = z.object({
  count: z.string()
    .regex(/^\d+$/, "Please enter a number")
    .transform(Number),
  active: z.enum(["true", "false"])
    .transform((val) => val === "true"),
});
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|---------|
| Initialization error | Configuration file issues | Check the path and format of configuration files |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Check execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check error messages**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Stepwise verification**: Verify hypotheses using log output and debuggers
5. **Fix and regression test**: After fixing, also run tests for related areas

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
    """Decorator to log function inputs and outputs"""
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

Steps to diagnose performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O waits**: Check the status of disk and network I/O
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-------------|-----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize When | Can Compromise When |
|-----------|-----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, speed to market | Quality-focused, mission-critical |

### Choosing Architecture Patterns

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5)   → Monolith                  │
│    └─ Large (10+)   → Go to 2                   │
│                                                 │
│  2. How often do you deploy?                    │
│    ├─ Weekly or less → Monolith + modules       │
│    └─ Daily/multiple → Go to 3                  │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High   → Microservices                    │
│    └─ Medium → Modular monolith                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term costs**
- Fast short-term approaches can become technical debt over time
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging more difficult
- Low abstraction is intuitive but tends to produce code duplication

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
        """Describe background and issues"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
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
        md += f"## Background\n{self.context}\n\n"
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

## Practical Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required functionality
- Automated tests only for the critical path
- Introduce monitoring early

**Lessons learned:**
- Don't pursue perfection (YAGNI principle)
- Gather user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually renovating a system that has been running for over 10 years

**Approach:**
- Gradually migrate using the Strangler Fig pattern
- Create Characterization Tests first if no existing tests exist
- Coexist old and new systems with an API gateway
- Migrate data gradually

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Investigation | Current state analysis, identifying dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Gradually migrate peripheral functions | 3-6 months | Medium |
| 4. Core migration | Migrate core functions | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with domain-driven design
- Set ownership per team
- Manage common libraries with Inner Source approach
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
    """API contract between teams"""
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

**Situation:** System requiring millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging async processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Application |
|------------------------|--------|---------------------|-------------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | CPU-bound cases |

---

## Team Development

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Are naming conventions consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Has documentation been updated?

### Knowledge Sharing Best Practices

| Method | Frequency | Audience | Effect |
|--------|-----------|----------|--------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (design records) | As needed | Future members | Transparent decision-making |
| Retrospective | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Important design | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │ned  │ im- │
    │resp │med- │
    │onse │iate │
    ├─────┼─────┤
    │Log  │Next │
    │only │Sprint│
    │     │     │
    └─────┼─────┘
          │
        Low Impact
    Low Frequency  High Frequency
```
---

## FAQ

### Q1: Should I choose zod or valibot?

zod has the richest ecosystem with abundant integration plugins for tRPC, React Hook Form, Prisma, and more. valibot has an overwhelmingly smaller bundle size (tree-shakable) and superior performance. For new small-to-medium projects, choose valibot; choose zod when ecosystem integration is important.

### Q2: Can zod be used on both server-side and client-side?

Yes. zod is environment-agnostic and works on Node.js, browsers, and Edge Runtime alike. A major advantage is that you can share the same schema definition for both server-side request validation and client-side form validation.

### Q3: What about performance when validating large amounts of data?

Arrays of a few thousand items are fine. For tens of thousands or more, consider adding a size check first or using stream processing. Using typia, which generates validation code at compile time, maximizes runtime performance.

### Q4: Can Zod schemas be auto-generated from a Prisma schema?

Yes. You can use generators like `zod-prisma-types` or `prisma-zod-generator` to auto-generate Zod schemas from Prisma schemas.

```prisma
// prisma/schema.prisma
generator zod {
  provider = "zod-prisma-types"
}
```

### Q5: What is the difference between z.infer and z.input?

`z.infer` (= `z.output`) is the output type of the schema (after transform/default is applied), while `z.input` is the input type (before transform/default is applied). It is common to use `z.input` for form type definitions and `z.infer` for API response type definitions.

### Q6: How do I internationalize (i18n) error messages?

Using the `zod-i18n-map` library, you can automatically translate error messages in conjunction with i18next. Multiple languages including Japanese are supported.

---

## Summary Table

| Concept | Key Point |
|---------|-----------|
| z.infer | Automatically infer TypeScript types from schema |
| safeParse | Returns validation result without throwing exceptions |
| transform | Transform value after validation |
| pipe | Re-validate with schema after transformation |
| discriminatedUnion | Branch type with discriminant field |
| refine / superRefine | Custom validation logic |
| brand | Attach brand type |
| coerce | Implicit type conversion |
| preprocess | Pre-process before validation |
| z.lazy | Define recursive type schemas |

---

## Practice Problems

### Problem 1: User Registration Form Schema

Define a schema for a user registration form that meets the following requirements.

- Name: required, 1-50 characters
- Email: required, valid email format
- Password: 8+ characters, must include uppercase, lowercase, numbers, and special characters
- Password confirmation: must match password
- Age: optional, integer between 0 and 150
- Agreement to terms of service: must be true

### Problem 2: Generic API Response Schema

Define a generic API response schema with the following structure.

- On success: `{ success: true, data: T, meta?: { page, total } }`
- On failure: `{ success: false, error: { code, message } }`
- Must use discriminatedUnion

### Problem 3: Environment Variable Validation

Define a schema to validate the following environment variables for an actual project.

- NODE_ENV: development / production / test
- PORT: number (default 3000)
- DATABASE_URL: URL format
- REDIS_URL: optional, URL format
- JWT_SECRET: 32+ characters
- Log level: debug / info / warn / error (default info)

### Problem 4: Nested Form Validation

Define a schema for a nested object containing address information. The prefecture should be an enum of 47 prefectures, and postal codes should be validated in `xxx-xxxx` format.

### Problem 5: CSV Parser Using transform

Define a schema that receives a CSV string, validates it, and converts it to an array of objects. Each row is in `name,email,age` format.

---


## Summary

In this guide, we covered the following key points:

- Understanding basic concepts and principles
- Practical implementation patterns
- Best practices and considerations
- How to apply in real-world scenarios

---

## Next Guides to Read

- [Error Handling](../02-patterns/00-error-handling.md) -- Integrating zod with Result types
- [tRPC](./02-trpc.md) -- Type-safe API using zod as schema
- [Branded Types](../02-patterns/03-branded-types.md) -- Using zod's `.brand()`

---

## References

1. **Zod Documentation**
   https://zod.dev/

2. **Zod GitHub Repository**
   https://github.com/colinhacks/zod

3. **Total TypeScript - Zod Tutorial**
   https://www.totaltypescript.com/tutorials/zod

4. **React Hook Form + Zod**
   https://react-hook-form.com/get-started#SchemaValidation

5. **zod-i18n-map**
   https://github.com/aiji42/zod-i18n
