# Validation Patterns

> Validation determines the quality of a form. Master all patterns for robust and user-friendly validation design — from Zod integration and real-time validation to asynchronous validation and client/server double validation.

## What You Will Learn

- [ ] Understand Zod schema design principles and advanced patterns
- [ ] Implement integration patterns with React Hook Form
- [ ] Know when to apply different validation timing strategies
- [ ] Understand real-time and asynchronous validation implementation
- [ ] Learn client/server double validation design
- [ ] Implement a password strength indicator
- [ ] Understand internationalization and accessibility for error messages
- [ ] Master validation testing strategies

---

## Prerequisites

To get the most out of this chapter, it is recommended that you have the following knowledge in advance:

- **Form Design**: Understanding of the basic React Hook Form patterns and the concept of controlled/uncontrolled components, as covered in `./00-form-design.md`
- **TypeScript Type System**: Familiarity with intermediate TypeScript type system features such as generics, union types, intersection types, and type inference
- **Zod Schema Basics**: Understanding of basic Zod schema definitions (`z.string()`, `z.number()`, `z.object()`, etc.) and how to use `.parse()` / `.safeParse()`

---

## 1. Basic Concepts and Design Philosophy of Validation

### 1.1 Why Validation Matters

Validation in web applications goes far beyond simple input checking. It is the foundational mechanism for ensuring data integrity, guaranteeing security, and providing appropriate feedback to users.

Problems that can occur when validation is insufficient:

1. **Security risks**: SQL injection, XSS attacks, injection of malicious data
2. **Data inconsistency**: Invalid values stored in the database cause failures in downstream processes
3. **Poor UX**: Users don't know what to fix, leading to higher form abandonment rates
4. **Business logic breakdown**: Unexpected data flows into business processes, causing calculation errors or invalid state transitions

```
Scope of validation:

  ┌──────────────────────────────────────┐
  │           Client Side                │
  │  ┌──────────────────────────────┐    │
  │  │  HTML5 Native Validation     │    │
  │  │  (required, pattern, min,    │    │
  │  │   etc.)                      │    │
  │  └──────────────────────────────┘    │
  │  ┌──────────────────────────────┐    │
  │  │  JavaScript Validation       │    │
  │  │  (Zod, Yup, custom logic)    │    │
  │  └──────────────────────────────┘    │
  │  → Immediate feedback, better UX     │
  └──────────────────────────────────────┘
              ↓ HTTP Request
  ┌──────────────────────────────────────┐
  │           Server Side                │
  │  ┌──────────────────────────────┐    │
  │  │  Application Layer           │    │
  │  │  Validation                  │    │
  │  │  (Zod, class-validator, etc.)│    │
  │  └──────────────────────────────┘    │
  │  ┌──────────────────────────────┐    │
  │  │  Business Logic Layer        │    │
  │  │  (duplicate check, auth      │    │
  │  │   check, etc.)               │    │
  │  └──────────────────────────────┘    │
  │  ┌──────────────────────────────┐    │
  │  │  Database Layer Constraints  │    │
  │  │  (UNIQUE, CHECK, NOT NULL,   │    │
  │  │   etc.)                      │    │
  │  └──────────────────────────────┘    │
  │  → Security guarantee, data          │
  │    integrity                         │
  └──────────────────────────────────────┘
```

### 1.2 Comparing Validation Libraries

A comparison of major validation libraries used in the current TypeScript/JavaScript ecosystem.

| Library | Type Inference | Bundle Size | Performance | Ecosystem | Learning Cost |
|-----------|--------|-------------|--------------|------------|-----------|
| **Zod** | Excellent | 13KB (gzip) | Good | React Hook Form, tRPC, Next.js | Low |
| **Yup** | Good | 12KB (gzip) | Good | Formik, React Hook Form | Low |
| **Valibot** | Excellent | 1KB+ (tree-shake) | Very Good | React Hook Form | Medium |
| **Joi** | Limited | Large | Good | Express/Hapi | Medium |
| **class-validator** | Decorators | Medium | Good | NestJS | Medium |
| **ArkType** | Very Excellent | Small | Very Good | Limited | High |
| **TypeBox** | Excellent | Small | Very Good | Fastify | Medium |

```typescript
// Comparison of equivalent schema definitions in each library

// === Zod ===
import { z } from 'zod';
const zodSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
  email: z.string().email(),
});
type ZodUser = z.infer<typeof zodSchema>;

// === Yup ===
import * as yup from 'yup';
const yupSchema = yup.object({
  name: yup.string().required().min(1).max(100),
  age: yup.number().integer().min(0).max(150).required(),
  email: yup.string().email().required(),
});
type YupUser = yup.InferType<typeof yupSchema>;

// === Valibot ===
import * as v from 'valibot';
const valibotSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  age: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(150)),
  email: v.pipe(v.string(), v.email()),
});
type ValibotUser = v.InferOutput<typeof valibotSchema>;

// === ArkType ===
import { type } from 'arktype';
const arkSchema = type({
  name: 'string>=1<=100',
  age: 'integer>=0<=150',
  email: 'string.email',
});
type ArkUser = typeof arkSchema.infer;
```

### 1.3 Why Choose Zod

This guide primarily explains implementation patterns using Zod. The reasons for choosing Zod are as follows:

1. **TypeScript-first design**: Types are automatically inferred from schema definitions
2. **Rich ecosystem**: Official integration with React Hook Form, tRPC, and Next.js Server Actions
3. **Intuitive API**: Declarative schema definition via method chaining
4. **Zero dependencies**: No external library dependencies
5. **Active community**: Large user base and extensive documentation

```typescript
// Zod's greatest advantage: automatically generate types from schemas
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive(),
  role: z.enum(['admin', 'user', 'moderator']),
  createdAt: z.date(),
});

// Automatically infer type from schema - no need to manually define an interface
type User = z.infer<typeof userSchema>;
// => {
//   id: string;
//   name: string;
//   email: string;
//   age: number;
//   role: 'admin' | 'user' | 'moderator';
//   createdAt: Date;
// }

// Partial types are also easy to generate
type UserUpdate = z.infer<typeof userSchema.partial()>;
type UserCreate = z.infer<typeof userSchema.omit({ id: true, createdAt: true })>;
```

---

## 2. Zod Schema Design

### 2.1 Basic Schema Patterns

#### Validating Primitive Types

```typescript
import { z } from 'zod';

// String validation
const stringSchemas = {
  // Basic
  required: z.string().min(1, 'This field is required'),

  // Length constraints
  username: z.string()
    .min(3, 'Must be at least 3 characters')
    .max(20, 'Must be at most 20 characters'),

  // Regex pattern
  alphanumeric: z.string()
    .regex(/^[a-zA-Z0-9]+$/, 'Only alphanumeric characters are allowed'),

  // Built-in validations
  email: z.string().email('Please enter a valid email address'),
  url: z.string().url('Please enter a valid URL'),
  uuid: z.string().uuid('Please enter a valid UUID format'),
  cuid: z.string().cuid(),
  datetime: z.string().datetime(),
  ip: z.string().ip(),

  // Trim + transform
  trimmed: z.string().trim().min(1, 'Whitespace-only is not allowed'),
  lowercase: z.string().toLowerCase(),
  uppercase: z.string().toUpperCase(),

  // Japanese support: full-width character validation
  japaneseName: z.string()
    .min(1, 'Please enter your name')
    .max(50, 'Must be at most 50 characters')
    .regex(/^[ぁ-んァ-ヶー一-龠々\s]+$/, 'Please enter in Japanese'),

  // Phone number (Japan)
  phoneJP: z.string()
    .regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/, 'Please enter a valid phone number'),

  // Postal code (Japan)
  postalCodeJP: z.string()
    .regex(/^\d{3}-?\d{4}$/, 'Please enter a valid postal code'),
};

// Number validation
const numberSchemas = {
  // Basic
  positive: z.number().positive('Please enter a positive number'),
  nonNegative: z.number().nonnegative('Please enter a number of 0 or greater'),
  integer: z.number().int('Please enter an integer'),

  // Range
  age: z.number()
    .int('Please enter an integer')
    .min(0, 'Please enter 0 or greater')
    .max(150, 'Please enter 150 or less'),

  // Decimal places
  price: z.number()
    .nonnegative('Please enter 0 or greater')
    .multipleOf(0.01, 'Up to 2 decimal places are allowed'),

  // Conversion from string (for form input values)
  fromString: z.coerce.number()
    .int('Please enter an integer')
    .min(1, 'Please enter 1 or greater'),
};

// Date validation
const dateSchemas = {
  // Basic
  date: z.coerce.date(),

  // Range
  pastDate: z.coerce.date()
    .max(new Date(), 'Future dates cannot be specified'),

  futureDate: z.coerce.date()
    .min(new Date(), 'Past dates cannot be specified'),

  // Custom range
  dateRange: z.coerce.date()
    .min(new Date('2020-01-01'), 'Please specify a date on or after January 1, 2020')
    .max(new Date('2030-12-31'), 'Please specify a date on or before December 31, 2030'),
};

// Boolean validation
const booleanSchemas = {
  // Terms agreement (only true allowed)
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the terms of service' }),
  }),

  // Checkbox (conversion of form values)
  checkbox: z.coerce.boolean(),
};

// Enum validation
const enumSchemas = {
  // Zod enum
  role: z.enum(['admin', 'user', 'moderator'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),

  // Integration with TypeScript enums
  // enum Status { Active = 'active', Inactive = 'inactive' }
  status: z.nativeEnum({ Active: 'active', Inactive: 'inactive' } as const),
};
```

#### Complete Schema for a User Registration Form

```typescript
import { z } from 'zod';

// User registration form schema
const registerSchema = z.object({
  // Username
  username: z.string()
    .min(3, 'Must be at least 3 characters')
    .max(20, 'Must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric characters and underscores are allowed')
    .refine(
      (val) => !['admin', 'root', 'system', 'null', 'undefined'].includes(val.toLowerCase()),
      'Reserved words cannot be used'
    ),

  // Email address
  email: z.string()
    .email('Please enter a valid email address')
    .max(254, 'Email address is too long'),

  // Password
  password: z.string()
    .min(8, 'Must be at least 8 characters')
    .max(100, 'Must be at most 100 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one symbol'),

  // Password confirmation
  confirmPassword: z.string(),

  // Date of birth
  birthDate: z.coerce.date()
    .max(new Date(), 'Future dates cannot be specified')
    .refine(
      (date) => {
        const age = Math.floor(
          (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );
        return age >= 13;
      },
      'You must be at least 13 years old'
    ),

  // Website (optional)
  website: z.string()
    .url('Please enter a valid URL')
    .optional()
    .or(z.literal('')),

  // Bio (optional)
  bio: z.string()
    .max(500, 'Must be at most 500 characters')
    .optional()
    .or(z.literal('')),

  // Terms of service agreement
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the terms of service' }),
  }),

  // Privacy policy agreement
  agreeToPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the privacy policy' }),
  }),

}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
).refine(
  (data) => {
    // Check that the password does not contain the username
    if (data.username && data.password) {
      return !data.password.toLowerCase().includes(data.username.toLowerCase());
    }
    return true;
  },
  {
    message: 'Password cannot contain the username',
    path: ['password'],
  }
);

// Automatic type inference
type RegisterFormData = z.infer<typeof registerSchema>;
```

### 2.2 Advanced Schema Patterns

#### Conditional Validation (Discriminated Union)

```typescript
// Pattern that requires different fields depending on the payment method
const creditCardSchema = z.object({
  paymentMethod: z.literal('credit_card'),
  cardNumber: z.string()
    .regex(/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/, 'Invalid card number format')
    .transform((val) => val.replace(/[\s-]/g, '')),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(new Date().getFullYear()),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3 to 4 digits'),
  cardholderName: z.string().min(1, 'Please enter the cardholder name'),
});

const bankTransferSchema = z.object({
  paymentMethod: z.literal('bank_transfer'),
  bankName: z.string().min(1, 'Please enter the bank name'),
  branchName: z.string().min(1, 'Please enter the branch name'),
  accountType: z.enum(['ordinary', 'checking']),
  accountNumber: z.string()
    .regex(/^\d{7}$/, 'Account number must be 7 digits'),
  accountHolder: z.string().min(1, 'Please enter the account holder name'),
});

const digitalWalletSchema = z.object({
  paymentMethod: z.literal('digital_wallet'),
  walletType: z.enum(['paypay', 'linepay', 'merpay']),
  walletId: z.string().min(1, 'Please enter the wallet ID'),
});

// Integrate with Discriminated Union
const paymentSchema = z.discriminatedUnion('paymentMethod', [
  creditCardSchema,
  bankTransferSchema,
  digitalWalletSchema,
]);

type PaymentData = z.infer<typeof paymentSchema>;

// Usage example: switching in a form
function PaymentForm() {
  const [paymentMethod, setPaymentMethod] = useState<
    'credit_card' | 'bank_transfer' | 'digital_wallet'
  >('credit_card');

  const form = useForm<PaymentData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentMethod: 'credit_card',
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <select
        value={paymentMethod}
        onChange={(e) => {
          const method = e.target.value as PaymentData['paymentMethod'];
          setPaymentMethod(method);
          form.setValue('paymentMethod', method);
          // Reset the form when the payment method changes
          form.clearErrors();
        }}
      >
        <option value="credit_card">Credit Card</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="digital_wallet">Digital Wallet</option>
      </select>

      {paymentMethod === 'credit_card' && <CreditCardFields form={form} />}
      {paymentMethod === 'bank_transfer' && <BankTransferFields form={form} />}
      {paymentMethod === 'digital_wallet' && <DigitalWalletFields form={form} />}
    </form>
  );
}
```

#### Complex Validation with superRefine

```typescript
// Complex cross-field validation using superRefine
const eventSchema = z.object({
  title: z.string().min(1, 'Please enter a title'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  isAllDay: z.boolean(),
  maxParticipants: z.number().int().positive().optional(),
  currentParticipants: z.number().int().nonnegative().default(0),
  isOnline: z.boolean(),
  venue: z.string().optional(),
  meetingUrl: z.string().url().optional(),
}).superRefine((data, ctx) => {
  // Check consistency of start and end dates
  if (data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be on or after the start date',
      path: ['endDate'],
    });
  }

  // If on the same day, confirm that end time is after start time
  if (
    data.startDate.toDateString() === data.endDate.toDateString() &&
    !data.isAllDay
  ) {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endTime'],
      });
    }
  }

  // Consistency of participant count
  if (data.maxParticipants !== undefined && data.currentParticipants > data.maxParticipants) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current number of participants exceeds capacity',
      path: ['maxParticipants'],
    });
  }

  // Required fields based on online/offline
  if (data.isOnline && !data.meetingUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A meeting URL is required for online events',
      path: ['meetingUrl'],
    });
  }

  if (!data.isOnline && !data.venue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A venue is required for offline events',
      path: ['venue'],
    });
  }
});
```

#### Schema Reuse and Composition

```typescript
// Define base schemas
const baseUserSchema = z.object({
  name: z.string().min(1, 'Please enter your name').max(100),
  email: z.string().email('Please enter a valid email address'),
});

const addressSchema = z.object({
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/, 'Please enter a valid postal code'),
  prefecture: z.string().min(1, 'Please select a prefecture'),
  city: z.string().min(1, 'Please enter a city'),
  street: z.string().min(1, 'Please enter a street address'),
  building: z.string().optional(),
});

const phoneSchema = z.object({
  phoneNumber: z.string()
    .regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/, 'Please enter a valid phone number'),
  phoneType: z.enum(['mobile', 'home', 'work']),
});

// extend: add fields
const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8, 'Must be at least 8 characters'),
  role: z.enum(['admin', 'user']).default('user'),
});

// merge: combine multiple schemas
const fullUserSchema = baseUserSchema
  .merge(addressSchema)
  .merge(phoneSchema);

// pick: get only specific fields
const loginSchema = baseUserSchema.pick({
  email: true,
}).extend({
  password: z.string().min(1, 'Please enter your password'),
});

// omit: exclude specific fields
const publicUserSchema = fullUserSchema.omit({
  phoneNumber: true,
  phoneType: true,
});

// partial: make all fields optional (ideal for update APIs)
const updateUserSchema = baseUserSchema.partial();

// deepPartial: make all fields including nested objects optional
const deepUpdateSchema = fullUserSchema.deepPartial();

// required: make optional fields required
const strictSchema = updateUserSchema.required();

// passthrough: retain unknown properties
const flexibleSchema = baseUserSchema.passthrough();

// strict: error on unknown properties
const strictUserSchema = baseUserSchema.strict();

// Array schema
const usersSchema = z.array(baseUserSchema)
  .min(1, 'At least one user is required')
  .max(100, 'Up to 100 users are allowed');

// Record schema
const settingsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
);
```

### 2.3 Data Transformation with transform and preprocess

```typescript
// transform: transform data after validation
const formSchema = z.object({
  // Trim and normalize a string
  name: z.string()
    .transform((val) => val.trim())
    .pipe(z.string().min(1, 'Please enter your name')),

  // Convert a comma-separated string to an array
  tags: z.string()
    .transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string()).min(1, 'Please enter at least one tag')),

  // Remove hyphens from phone number
  phone: z.string()
    .transform((val) => val.replace(/-/g, ''))
    .pipe(z.string().regex(/^0\d{9,10}$/, 'Please enter a valid phone number')),

  // Normalize postal code
  postalCode: z.string()
    .transform((val) => {
      const digits = val.replace(/[^\d]/g, '');
      return digits.length === 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : val;
    })
    .pipe(z.string().regex(/^\d{3}-\d{4}$/, 'Please enter a valid postal code')),

  // Amount conversion (remove commas → convert to number)
  amount: z.string()
    .transform((val) => Number(val.replace(/,/g, '')))
    .pipe(z.number().positive('Please enter a positive amount')),
});

// preprocess: pre-process data before validation
const preprocessedSchema = z.object({
  // Convert empty string to undefined (for optional fields)
  website: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('Please enter a valid URL').optional()
  ),

  // Convert checkbox value to boolean
  isActive: z.preprocess(
    (val) => val === 'on' || val === 'true' || val === true,
    z.boolean()
  ),

  // Convert numeric string to number type
  quantity: z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive()
  ),
});

// Using coerce (automatic conversion from FormData)
const formDataSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0),     // string → number
  isAdmin: z.coerce.boolean(),              // string → boolean
  createdAt: z.coerce.date(),               // string → Date
  score: z.coerce.bigint(),                 // string → Bigint
});
```

### 2.4 Custom Error Messages and Error Maps

```typescript
// Field-level custom error messages
const detailedSchema = z.object({
  username: z.string({
    required_error: 'Username is required',
    invalid_type_error: 'Username must be a string',
  })
    .min(3, { message: 'Must be at least 3 characters' })
    .max(20, { message: 'Must be at most 20 characters' }),

  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number',
  })
    .int({ message: 'Please enter an integer' })
    .min(0, { message: 'Please enter 0 or greater' }),
});

// Global error map
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  // Customize default error messages
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === 'string') {
        return { message: 'Please enter text' };
      }
      if (issue.expected === 'number') {
        return { message: 'Please enter a number' };
      }
      break;
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: `Must be at least ${issue.minimum} characters` };
      }
      if (issue.type === 'number') {
        return { message: `Please enter a value of ${issue.minimum} or greater` };
      }
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Must be at most ${issue.maximum} characters` };
      }
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'Please enter a valid email address' };
      }
      if (issue.validation === 'url') {
        return { message: 'Please enter a valid URL' };
      }
      break;
  }
  return { message: ctx.defaultError };
};

// Set globally
z.setErrorMap(customErrorMap);

// Apply only to a specific schema
const schemaWithCustomErrors = z.string().min(1).describe('Username');
```

---

## 3. Integration with React Hook Form

### 3.1 Basic Setup

```typescript
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema definition
const contactSchema = z.object({
  firstName: z.string().min(1, 'Please enter your first name'),
  lastName: z.string().min(1, 'Please enter your last name'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string()
    .regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  subject: z.enum(['inquiry', 'support', 'feedback', 'other'], {
    errorMap: () => ({ message: 'Please select an inquiry type' }),
  }),
  message: z.string()
    .min(10, 'Must be at least 10 characters')
    .max(2000, 'Must be at most 2000 characters'),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the terms of service' }),
  }),
});

type ContactFormData = z.infer<typeof contactSchema>;

// Form component
function ContactForm() {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      subject: undefined,
      message: '',
      agreeToTerms: false as unknown as true,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty, touchedFields },
    watch,
    reset,
    setError,
    clearErrors,
  } = form;

  const onSubmit = async (data: ContactFormData) => {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Map server errors to the form
        if (errorData.fieldErrors) {
          Object.entries(errorData.fieldErrors).forEach(([field, messages]) => {
            setError(field as keyof ContactFormData, {
              type: 'server',
              message: (messages as string[])[0],
            });
          });
          return;
        }
        throw new Error(errorData.message || 'Submission failed');
      }

      // On success
      reset();
      alert('Your inquiry has been submitted');
    } catch (error) {
      setError('root', {
        type: 'server',
        message: error instanceof Error ? error.message : 'Submission failed',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Root error display */}
      {errors.root && (
        <div role="alert" className="bg-red-50 border border-red-200 p-4 rounded">
          <p className="text-red-700">{errors.root.message}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Last Name"
          error={errors.lastName?.message}
          required
        >
          <input
            {...register('lastName')}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? 'lastName-error' : undefined}
            className={errors.lastName ? 'border-red-500' : 'border-gray-300'}
          />
        </FormField>

        <FormField
          label="First Name"
          error={errors.firstName?.message}
          required
        >
          <input
            {...register('firstName')}
            aria-invalid={!!errors.firstName}
            className={errors.firstName ? 'border-red-500' : 'border-gray-300'}
          />
        </FormField>
      </div>

      <FormField label="Email Address" error={errors.email?.message} required>
        <input
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
      </FormField>

      <FormField label="Phone Number" error={errors.phone?.message}>
        <input
          type="tel"
          {...register('phone')}
          aria-invalid={!!errors.phone}
        />
      </FormField>

      <FormField label="Inquiry Type" error={errors.subject?.message} required>
        <select {...register('subject')}>
          <option value="">Please select</option>
          <option value="inquiry">Inquiry</option>
          <option value="support">Support</option>
          <option value="feedback">Feedback</option>
          <option value="other">Other</option>
        </select>
      </FormField>

      <FormField label="Message" error={errors.message?.message} required>
        <textarea
          {...register('message')}
          rows={5}
          aria-invalid={!!errors.message}
        />
        <p className="text-sm text-gray-500">
          {watch('message')?.length || 0}/2000 characters
        </p>
      </FormField>

      <FormField error={errors.agreeToTerms?.message}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('agreeToTerms')}
          />
          <span>I agree to the terms of service</span>
        </label>
      </FormField>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

// Reusable form field component
function FormField({
  label,
  error,
  required,
  children,
}: {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-red-500 text-sm mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

### 3.2 Nested Forms with FormProvider

```typescript
// Pattern for splitting large forms into components
const orderSchema = z.object({
  // Personal information
  personal: z.object({
    name: z.string().min(1, 'Please enter your name'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/),
  }),
  // Shipping address
  shipping: z.object({
    postalCode: z.string().regex(/^\d{3}-?\d{4}$/),
    prefecture: z.string().min(1),
    city: z.string().min(1),
    street: z.string().min(1),
    building: z.string().optional(),
  }),
  // Order items
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1).max(99),
  })).min(1, 'Please select at least one item'),
  // Notes
  notes: z.string().max(500).optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

// Parent component
function OrderForm() {
  const methods = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      personal: { name: '', email: '', phone: '' },
      shipping: { postalCode: '', prefecture: '', city: '', street: '' },
      items: [],
      notes: '',
    },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <PersonalInfoSection />
        <ShippingAddressSection />
        <OrderItemsSection />
        <NotesSection />
        <SubmitButton />
      </form>
    </FormProvider>
  );
}

// Child component (access parent form state with useFormContext)
function PersonalInfoSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OrderFormData>();

  return (
    <fieldset>
      <legend className="text-lg font-bold">Customer Information</legend>
      <input
        {...register('personal.name')}
        placeholder="Full Name"
      />
      {errors.personal?.name && (
        <span className="text-red-500">{errors.personal.name.message}</span>
      )}
      <input
        type="email"
        {...register('personal.email')}
        placeholder="Email Address"
      />
      {errors.personal?.email && (
        <span className="text-red-500">{errors.personal.email.message}</span>
      )}
      <input
        type="tel"
        {...register('personal.phone')}
        placeholder="Phone Number"
      />
      {errors.personal?.phone && (
        <span className="text-red-500">{errors.personal.phone.message}</span>
      )}
    </fieldset>
  );
}

// Shipping address section
function ShippingAddressSection() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<OrderFormData>();

  // Auto-fill address from postal code
  const handlePostalCodeChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const postalCode = e.target.value.replace(/-/g, '');
    if (postalCode.length === 7) {
      try {
        const res = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`
        );
        const data = await res.json();
        if (data.results?.[0]) {
          const result = data.results[0];
          setValue('shipping.prefecture', result.address1);
          setValue('shipping.city', result.address2 + result.address3);
        }
      } catch {
        // Ignore address lookup API errors (user can enter manually)
      }
    }
  };

  return (
    <fieldset>
      <legend className="text-lg font-bold">Shipping Address</legend>
      <input
        {...register('shipping.postalCode')}
        onChange={(e) => {
          register('shipping.postalCode').onChange(e);
          handlePostalCodeChange(e);
        }}
        placeholder="Postal Code (e.g., 100-0001)"
      />
      {errors.shipping?.postalCode && (
        <span className="text-red-500">{errors.shipping.postalCode.message}</span>
      )}
      {/* Other fields are similar */}
    </fieldset>
  );
}
```

### 3.3 Dynamic Forms with useFieldArray

```typescript
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Schema for managing multiple contacts
const contactListSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().min(1, 'Please enter a name'),
      email: z.string().email('Please enter a valid email address'),
      relationship: z.enum(['family', 'friend', 'colleague', 'other']),
      isPrimary: z.boolean().default(false),
    })
  )
    .min(1, 'Please add at least one contact')
    .max(10, 'Up to 10 contacts are allowed')
    .refine(
      (contacts) => contacts.filter((c) => c.isPrimary).length <= 1,
      'Only one primary contact can be set'
    ),
});

type ContactListData = z.infer<typeof contactListSchema>;

function ContactListForm() {
  const form = useForm<ContactListData>({
    resolver: zodResolver(contactListSchema),
    defaultValues: {
      contacts: [{ name: '', email: '', relationship: 'friend', isPrimary: false }],
    },
  });

  const { fields, append, remove, move, swap, insert } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id} className="border p-4 mb-4 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3>Contact #{index + 1}</h3>
            <div className="flex gap-2">
              {index > 0 && (
                <button type="button" onClick={() => move(index, index - 1)}>
                  Move Up
                </button>
              )}
              {index < fields.length - 1 && (
                <button type="button" onClick={() => move(index, index + 1)}>
                  Move Down
                </button>
              )}
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-500"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <input
            {...form.register(`contacts.${index}.name`)}
            placeholder="Name"
          />
          {form.formState.errors.contacts?.[index]?.name && (
            <span className="text-red-500">
              {form.formState.errors.contacts[index]?.name?.message}
            </span>
          )}

          <input
            type="email"
            {...form.register(`contacts.${index}.email`)}
            placeholder="Email Address"
          />
          {form.formState.errors.contacts?.[index]?.email && (
            <span className="text-red-500">
              {form.formState.errors.contacts[index]?.email?.message}
            </span>
          )}

          <select {...form.register(`contacts.${index}.relationship`)}>
            <option value="family">Family</option>
            <option value="friend">Friend</option>
            <option value="colleague">Colleague</option>
            <option value="other">Other</option>
          </select>

          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              {...form.register(`contacts.${index}.isPrimary`)}
            />
            Set as primary contact
          </label>
        </div>
      ))}

      {/* Array-level errors */}
      {form.formState.errors.contacts?.root && (
        <p className="text-red-500">{form.formState.errors.contacts.root.message}</p>
      )}

      <button
        type="button"
        onClick={() =>
          append({ name: '', email: '', relationship: 'friend', isPrimary: false })
        }
        disabled={fields.length >= 10}
        className="mb-4"
      >
        Add Contact
      </button>

      <button type="submit">Save</button>
    </form>
  );
}
```

---

## 4. Validation Timing Strategies

### 4.1 Detailed Comparison of Validation Modes

```
Comparison of validation strategies:

  ① mode: 'onSubmit' (default)
     ┌──────────────────────────────────────────────┐
     │ While typing  → Show nothing                  │
     │ On Blur       → Show nothing                  │
     │ On Submit     → Validate all fields           │
     │ While fixing  → Depends on reValidateMode     │
     └──────────────────────────────────────────────┘
     → Advantage: No errors shown while typing
     → Disadvantage: Problems not noticed until Submit
     → Use case: Simple forms, short forms

  ② mode: 'onSubmit' + reValidateMode: 'onChange' (recommended)
     ┌──────────────────────────────────────────────┐
     │ First input   → Show nothing                  │
     │ On Submit     → Validate all fields           │
     │ After error   → Re-validate in real time on   │
     │                 every input                   │
     └──────────────────────────────────────────────┘
     → Advantage: Non-intrusive on first input, quick feedback after errors
     → Disadvantage: Errors not shown until first Submit
     → Use case: Most forms (best balance)

  ③ mode: 'onBlur'
     ┌──────────────────────────────────────────────┐
     │ While typing  → Show nothing                  │
     │ On Blur       → Validate that field           │
     │ On Submit     → Validate all fields           │
     └──────────────────────────────────────────────┘
     → Advantage: Immediate feedback when leaving a field
     → Disadvantage: No feedback while typing
     → Use case: Medium to large forms

  ④ mode: 'onChange'
     ┌──────────────────────────────────────────────┐
     │ While typing  → Validate immediately          │
     │ On Blur       → Validate immediately          │
     │ On Submit     → Validate all fields           │
     └──────────────────────────────────────────────┘
     → Advantage: Most immediate feedback
     → Disadvantage: Performance impact, too many errors during early input
     → Use case: Password strength display, real-time search

  ⑤ mode: 'onTouched'
     ┌──────────────────────────────────────────────┐
     │ Before first touch → Show nothing             │
     │ After first Blur   → Validate with onChange   │
     │                      + onBlur                 │
     │ On Submit          → Validate all fields      │
     └──────────────────────────────────────────────┘
     → Advantage: Real-time feedback after first touch
     → Disadvantage: Similar to onBlur but slightly different behavior
     → Use case: When slightly more aggressive feedback than onBlur is desired

  ⑥ mode: 'all'
     ┌──────────────────────────────────────────────┐
     │ Validate on both onChange and onBlur          │
     └──────────────────────────────────────────────┘
     → Advantage: Most aggressive validation
     → Disadvantage: Largest performance impact
     → Use case: Only when there are special requirements
```

### 4.2 Recommended Configuration Patterns

```typescript
// Pattern 1: Standard form (most recommended)
const standardForm = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: 'onSubmit',           // First time: on Submit
  reValidateMode: 'onChange', // Re-validation: real time
  defaultValues: {
    // Set default values for all fields
  },
});

// Pattern 2: Progressive feedback (medium to large forms)
const progressiveForm = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: 'onBlur',             // Check on focus out
  reValidateMode: 'onChange', // Real-time check while fixing
  defaultValues: {},
});

// Pattern 3: Real-time search/filter
const realtimeForm = useForm<FilterData>({
  resolver: zodResolver(filterSchema),
  mode: 'onChange',           // Immediate check
  defaultValues: {},
});

// Pattern 4: Wizard form (validate per step)
const wizardForm = useForm<WizardData>({
  resolver: zodResolver(currentStepSchema),
  mode: 'onSubmit',           // Validate on "Next" button press
  reValidateMode: 'onChange',
  defaultValues: {},
});
```

### 4.3 Per-Field Validation Control

```typescript
// Manual validation using trigger
function StepForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });

  const [step, setStep] = useState(1);

  // Validate only specific fields
  const handleNextStep = async () => {
    let isValid = false;

    switch (step) {
      case 1:
        isValid = await form.trigger(['name', 'email']); // Only Step 1 fields
        break;
      case 2:
        isValid = await form.trigger(['address', 'phone']); // Only Step 2 fields
        break;
      case 3:
        isValid = await form.trigger(); // All fields
        break;
    }

    if (isValid) {
      if (step < 3) {
        setStep(step + 1);
      } else {
        form.handleSubmit(onSubmit)();
      }
    }
  };

  return (
    <form>
      {step === 1 && <Step1 form={form} />}
      {step === 2 && <Step2 form={form} />}
      {step === 3 && <Step3 form={form} />}

      <div className="flex justify-between mt-4">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button type="button" onClick={handleNextStep}>
          {step < 3 ? 'Next' : 'Submit'}
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              s === step
                ? 'bg-blue-600 text-white'
                : s < step
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? '✓' : s}
          </div>
        ))}
      </div>
    </form>
  );
}
```

---

## 5. Asynchronous Validation

### 5.1 Basic Asynchronous Validation

```typescript
// Duplicate email check (asynchronous)
const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z.string().min(3, 'Must be at least 3 characters'),
});

function RegisterForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input
        {...form.register('email', {
          validate: async (value) => {
            if (!value) return true;
            // Perform basic format check first
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) return true; // Leave it to Zod

            try {
              const response = await fetch(
                `/api/check-email?email=${encodeURIComponent(value)}`
              );
              const data = await response.json();
              return data.available
                ? true
                : 'This email address is already in use';
            } catch {
              // Skip validation on network error (validate on server)
              return true;
            }
          },
        })}
      />
      {form.formState.errors.email && (
        <span className="text-red-500">
          {form.formState.errors.email.message}
        </span>
      )}

      <input
        {...form.register('username', {
          validate: async (value) => {
            if (!value || value.length < 3) return true;

            try {
              const response = await fetch(
                `/api/check-username?username=${encodeURIComponent(value)}`
              );
              const data = await response.json();
              return data.available
                ? true
                : 'This username is already in use';
            } catch {
              return true;
            }
          },
        })}
      />
    </form>
  );
}
```

### 5.2 Asynchronous Validation with Debounce

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';

// Custom hook: asynchronous validation with debounce
function useAsyncValidation(
  validateFn: (value: string) => Promise<string | true>,
  delay = 500
) {
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastValueRef = useRef<string>('');

  const validate = useCallback(
    (value: string) => {
      lastValueRef.current = value;

      // Clear the previous timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Cancel the previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Skip validation for empty values
      if (!value) {
        setError(null);
        setIsValidating(false);
        return;
      }

      setIsValidating(true);

      timeoutRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const result = await validateFn(value);

          // Reflect result only if it matches the latest value
          if (lastValueRef.current === value && !controller.signal.aborted) {
            setError(result === true ? null : result);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Ignore cancelled requests
            return;
          }
          // Skip validation on other errors
          setError(null);
        } finally {
          if (lastValueRef.current === value) {
            setIsValidating(false);
          }
        }
      }, delay);
    },
    [validateFn, delay]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setIsValidating(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  return { error, isValidating, validate, reset };
}

// Usage example
function UsernameField() {
  const form = useFormContext();

  const checkUsername = useCallback(async (value: string): Promise<string | true> => {
    const response = await fetch(
      `/api/check-username?username=${encodeURIComponent(value)}`
    );
    const data = await response.json();
    return data.available ? true : 'This username is already in use';
  }, []);

  const { error: asyncError, isValidating, validate } = useAsyncValidation(
    checkUsername,
    500
  );

  const formError = form.formState.errors.username?.message;
  const displayError = formError || asyncError;

  return (
    <div className="relative">
      <input
        {...form.register('username')}
        onChange={(e) => {
          form.register('username').onChange(e); // React Hook Form's onChange
          validate(e.target.value);               // Asynchronous validation
        }}
        className={displayError ? 'border-red-500' : 'border-gray-300'}
      />

      {/* Loading indicator */}
      {isValidating && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {/* Success indicator */}
      {!isValidating && !displayError && form.getValues('username') && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
          ✓
        </div>
      )}

      {displayError && (
        <p className="text-red-500 text-sm mt-1">{displayError as string}</p>
      )}
    </div>
  );
}
```

### 5.3 Asynchronous Validation in Zod (refine)

```typescript
// Asynchronous validation inside a Zod schema
const asyncRegisterSchema = z.object({
  username: z.string()
    .min(3, 'Must be at least 3 characters')
    .max(20, 'Must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric characters and underscores are allowed'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Must be at least 8 characters'),
}).superRefine(async (data, ctx) => {
  // Note: asynchronous validation in superRefine
  // is only executed on Submit (not on onChange/onBlur)

  // Check for duplicate usernames
  const usernameExists = await checkUsernameExists(data.username);
  if (usernameExists) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'This username is already in use',
      path: ['username'],
    });
  }

  // Check for duplicate email addresses
  const emailExists = await checkEmailExists(data.email);
  if (emailExists) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'This email address is already in use',
      path: ['email'],
    });
  }
});

// Example async validation API endpoint
// app/api/check-username/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return NextResponse.json({
    available: !existingUser,
  });
}
```

---

## 6. Client/Server Double Validation

### 6.1 Why Double Validation Is Necessary

Client-side validation alone cannot prevent the following attacks and issues:

1. **JavaScript disabled**: Users with JS disabled via browser settings or add-ons
2. **Tampering via developer tools**: Rewriting `required` attributes or validation logic on a form
3. **Direct HTTP requests**: Requests sent without going through the form, via cURL or Postman
4. **Bot-based fraudulent submissions**: Automated tools bypass form validation
5. **Business logic consistency**: Validation that depends on DB state (duplicate checks, etc.) can only be executed on the server

```
Double validation architecture:

  Browser                       Server
  ┌─────────────────┐         ┌─────────────────────────┐
  │                 │         │                         │
  │  Form Input     │         │  Validate with same     │
  │       ↓         │         │  Zod schema             │
  │  Zod Schema     │  HTTP   │         ↓               │
  │  (client)       │ ──────→ │  Business logic         │
  │       ↓         │         │  validation             │
  │  Display        │  ←────  │  (duplicate check,      │
  │  immediate FB   │  Error   │   auth check, etc.)     │
  │                 │  JSON   │         ↓               │
  └─────────────────┘         │  Save to DB or return   │
                              │  error                  │
                              └─────────────────────────┘

  Key points:
  - Share the same Zod schema (place in shared/schemas/)
  - Client side is for UX improvement
  - Server side is for security guarantee
  - Some validations can only be done on the server (DB-dependent)
```

### 6.2 Shared Schema Design

```typescript
// ===================================================================
// shared/schemas/user.ts
// Schema definitions shared between client and server
// ===================================================================
import { z } from 'zod';

// Basic field schemas (reusable parts)
export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .max(254, 'Email address is too long')
  .toLowerCase();

export const passwordSchema = z.string()
  .min(8, 'Must be at least 8 characters')
  .max(100, 'Must be at most 100 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number');

export const usernameSchema = z.string()
  .min(3, 'Must be at least 3 characters')
  .max(20, 'Must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric characters and underscores are allowed');

// User creation schema
export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Please enter your name').max(100),
  role: z.enum(['user', 'admin']).default('user'),
}).refine(
  (data) => !data.password.toLowerCase().includes(data.username.toLowerCase()),
  {
    message: 'Password cannot contain the username',
    path: ['password'],
  }
);

export type CreateUserInput = z.infer<typeof createUserSchema>;

// User update schema (supports partial updates)
export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: emailSchema.optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Login schema
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Password reset schema
export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
```

### 6.3 Client-Side Implementation

```typescript
// ===================================================================
// app/(auth)/register/page.tsx
// Client side: React Hook Form + shared Zod schema
// ===================================================================
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput } from '@shared/schemas/user';
import { registerAction } from './actions';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      username: '',
      email: '',
      password: '',
      name: '',
      role: 'user',
    },
  });

  const onSubmit = async (data: CreateUserInput) => {
    setServerError(null);

    try {
      const result = await registerAction(data);

      if (result.errors) {
        // Map field errors from server to form
        Object.entries(result.errors).forEach(([field, messages]) => {
          if (field === '_form') {
            // Form-wide error
            setServerError((messages as string[])[0]);
          } else {
            form.setError(field as keyof CreateUserInput, {
              type: 'server',
              message: (messages as string[])[0],
            });
          }
        });
        return;
      }

      // On success
      router.push('/login?registered=true');
    } catch (error) {
      setServerError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-6">Create Account</h1>

      {serverError && (
        <div role="alert" className="bg-red-50 border border-red-200 p-4 rounded mb-4">
          <p className="text-red-700">{serverError}</p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {/* Form fields */}
        <div className="space-y-4">
          <FormField label="Username" error={form.formState.errors.username?.message} required>
            <input {...form.register('username')} autoComplete="username" />
          </FormField>

          <FormField label="Name" error={form.formState.errors.name?.message} required>
            <input {...form.register('name')} autoComplete="name" />
          </FormField>

          <FormField label="Email Address" error={form.formState.errors.email?.message} required>
            <input type="email" {...form.register('email')} autoComplete="email" />
          </FormField>

          <FormField label="Password" error={form.formState.errors.password?.message} required>
            <input type="password" {...form.register('password')} autoComplete="new-password" />
          </FormField>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {form.formState.isSubmitting ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

### 6.4 Server-Side Implementation (Server Actions)

```typescript
// ===================================================================
// app/(auth)/register/actions.ts
// Server side: Server Action + same Zod schema
// ===================================================================
'use server';

import { createUserSchema, type CreateUserInput } from '@shared/schemas/user';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';

// Server-specific validation (DB-dependent checks)
async function validateServerConstraints(data: CreateUserInput) {
  const errors: Record<string, string[]> = {};

  // Check for duplicate usernames
  const existingUsername = await prisma.user.findUnique({
    where: { username: data.username },
    select: { id: true },
  });
  if (existingUsername) {
    errors.username = ['This username is already in use'];
  }

  // Check for duplicate email addresses
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existingEmail) {
    errors.email = ['This email address is already in use'];
  }

  // Check blocklist
  const isBlocked = await prisma.blockedEmail.findUnique({
    where: { email: data.email },
  });
  if (isBlocked) {
    errors.email = ['This email address cannot be used'];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export async function registerAction(input: unknown) {
  // Step 1: Validate with shared schema
  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // Step 2: Server-specific validation
  const serverErrors = await validateServerConstraints(parsed.data);
  if (serverErrors) {
    return { errors: serverErrors };
  }

  // Step 3: Save to database
  try {
    const hashedPassword = await hash(parsed.data.password, 12);

    await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        name: parsed.data.name,
        password: hashedPassword,
        role: parsed.data.role,
      },
    });

    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error('User registration failed:', error);
    return {
      errors: {
        _form: ['User registration failed. Please try again.'],
      },
    };
  }
}
```

### 6.5 Double Validation in API Routes

```typescript
// ===================================================================
// app/api/users/route.ts
// Double validation pattern for REST APIs
// ===================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createUserSchema } from '@shared/schemas/user';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Type definition for validation error response
type ValidationErrorResponse = {
  success: false;
  errors: {
    fieldErrors: Record<string, string[]>;
    formErrors: string[];
  };
};

type SuccessResponse<T> = {
  success: true;
  data: T;
};

type ApiResponse<T> = ValidationErrorResponse | SuccessResponse<T>;

// Validation helper function
function createValidationError(
  fieldErrors: Record<string, string[]>,
  formErrors: string[] = []
): NextResponse<ValidationErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      errors: { fieldErrors, formErrors },
    },
    { status: 422 }
  );
}

export async function POST(request: NextRequest) {
  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, message: 'Authentication required' },
      { status: 401 }
    );
  }

  // Permission check
  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { success: false, message: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Step 1: Validate with Zod schema
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return createValidationError(
      flattened.fieldErrors as Record<string, string[]>,
      flattened.formErrors
    );
  }

  // Step 2: Business logic validation
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: parsed.data.email },
        { username: parsed.data.username },
      ],
    },
    select: { email: true, username: true },
  });

  if (existingUser) {
    const fieldErrors: Record<string, string[]> = {};
    if (existingUser.email === parsed.data.email) {
      fieldErrors.email = ['This email address is already in use'];
    }
    if (existingUser.username === parsed.data.username) {
      fieldErrors.username = ['This username is already in use'];
    }
    return createValidationError(fieldErrors);
  }

  // Step 3: Save data
  try {
    const hashedPassword = await hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        ...parsed.data,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

### 6.6 Double Validation with tRPC

```typescript
// ===================================================================
// server/routers/user.ts
// Schema sharing pattern with tRPC
// ===================================================================
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { createUserSchema, updateUserSchema, loginSchema } from '@shared/schemas/user';
import { hash, compare } from 'bcryptjs';
import { TRPCError } from '@trpc/server';

export const userRouter = router({
  // Create user
  create: publicProcedure
    .input(createUserSchema) // Use the Zod schema directly for input validation
    .mutation(async ({ input, ctx }) => {
      // tRPC automatically validates input with the Zod schema
      // Validation errors are automatically returned as TRPCErrors

      // Business logic validation
      const existing = await ctx.prisma.user.findFirst({
        where: {
          OR: [{ email: input.email }, { username: input.username }],
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: existing.email === input.email
            ? 'This email address is already in use'
            : 'This username is already in use',
        });
      }

      const hashedPassword = await hash(input.password, 12);
      return ctx.prisma.user.create({
        data: { ...input, password: hashedPassword },
        select: { id: true, username: true, email: true, name: true },
      });
    }),

  // Update user
  update: protectedProcedure
    .input(updateUserSchema) // Partial update schema
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: input,
      });
    }),

  // Login
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user || !(await compare(input.password, user.password))) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Incorrect email address or password',
        });
      }

      // Session creation logic...
      return { user: { id: user.id, email: user.email, name: user.name } };
    }),
});
```

---

## 7. Password Strength Indicator

### 7.1 Password Strength Calculation Logic

```typescript
// ===================================================================
// lib/password-strength.ts
// Functions for evaluating password strength from multiple angles
// ===================================================================

// Password strength evaluation result
export type PasswordStrength = {
  score: number;          // Score from 0 to 4
  label: string;          // Strength label
  color: string;          // Tailwind CSS color class
  textColor: string;      // Text color class
  percentage: number;     // Percentage (0 to 100)
  feedback: string[];     // Feedback for improvement
  requirements: {         // Achievement status of each requirement
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    noCommonPattern: boolean;
  };
};

// List of commonly used passwords (top 100)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
  'michael', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'football', 'password1', 'password123',
  // ... abbreviated
]);

// Detection of common patterns
const COMMON_PATTERNS = [
  /^(.)\1{2,}$/,                    // Repeated characters (aaa, 1111)
  /^(012|123|234|345|456|567|678|789|890)+$/, // Sequential numbers
  /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential alphabet
  /^(qwerty|asdf|zxcv|wasd)/i,     // Keyboard layout patterns
  /^(19|20)\d{2}/,                   // Starts with a year
];

// Entropy calculation
function calculateEntropy(password: string): number {
  const charsetSize = getCharsetSize(password);
  return password.length * Math.log2(charsetSize);
}

function getCharsetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[^a-zA-Z0-9]/.test(password)) size += 32;
  return size || 1;
}

// Main evaluation function
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: '',
      color: 'bg-gray-200',
      textColor: 'text-gray-400',
      percentage: 0,
      feedback: [],
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false,
        noCommonPattern: true,
      },
    };
  }

  // Requirement checks
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    noCommonPattern: !COMMON_PASSWORDS.has(password.toLowerCase()) &&
      !COMMON_PATTERNS.some((pattern) => pattern.test(password)),
  };

  // Score calculation
  let score = 0;

  // Score for basic requirements
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  score += metRequirements * 0.5;

  // Length bonus
  if (password.length >= 12) score += 0.5;
  if (password.length >= 16) score += 0.5;

  // Entropy bonus
  const entropy = calculateEntropy(password);
  if (entropy >= 40) score += 0.5;
  if (entropy >= 60) score += 0.5;

  // Significantly reduce score for common passwords/patterns
  if (!requirements.noCommonPattern) {
    score = Math.min(score, 1);
  }

  // Normalize to 0-4
  score = Math.min(Math.round(score), 4);

  // Generate feedback
  const feedback: string[] = [];
  if (!requirements.minLength) feedback.push('Use at least 8 characters');
  if (!requirements.hasUppercase) feedback.push('Add an uppercase letter');
  if (!requirements.hasLowercase) feedback.push('Add a lowercase letter');
  if (!requirements.hasNumber) feedback.push('Add a number');
  if (!requirements.hasSpecial) feedback.push('Add a symbol (e.g., !@#$%)');
  if (!requirements.noCommonPattern) feedback.push('Avoid commonly used passwords and patterns');
  if (password.length < 12) feedback.push('Using 12 or more characters is more secure');

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-400', 'bg-green-600'];
  const textColors = ['text-red-600', 'text-orange-600', 'text-yellow-600', 'text-green-500', 'text-green-700'];

  return {
    score,
    label: labels[score],
    color: colors[score],
    textColor: textColors[score],
    percentage: (score / 4) * 100,
    feedback,
    requirements,
  };
}
```

### 7.2 Password Strength Indicator Component

```typescript
// ===================================================================
// components/PasswordStrengthIndicator.tsx
// Component that visually displays password strength
// ===================================================================
'use client';

import { useMemo } from 'react';
import { getPasswordStrength, type PasswordStrength } from '@/lib/password-strength';

type Props = {
  password: string;
  showRequirements?: boolean;
  showFeedback?: boolean;
};

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
  showFeedback = true,
}: Props) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex gap-1 h-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors duration-300 ${
                i <= strength.score - 1 ? strength.color : 'bg-gray-200'
              }`}
              role="presentation"
            />
          ))}
        </div>
        <p className={`text-xs font-medium ${strength.textColor}`}>
          Password strength: {strength.label}
        </p>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <ul className="text-xs space-y-1" aria-label="Password requirements">
          <RequirementItem met={strength.requirements.minLength} label="At least 8 characters" />
          <RequirementItem met={strength.requirements.hasUppercase} label="Contains uppercase" />
          <RequirementItem met={strength.requirements.hasLowercase} label="Contains lowercase" />
          <RequirementItem met={strength.requirements.hasNumber} label="Contains a number" />
          <RequirementItem met={strength.requirements.hasSpecial} label="Contains a symbol" />
        </ul>
      )}

      {/* Improvement feedback */}
      {showFeedback && strength.feedback.length > 0 && strength.score < 3 && (
        <div className="text-xs text-gray-500">
          <p className="font-medium">Tips for improvement:</p>
          <ul className="list-disc list-inside">
            {strength.feedback.slice(0, 3).map((fb, i) => (
              <li key={i}>{fb}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met ? (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{label}</span>
    </li>
  );
}
```

### 7.3 Complete Password Field Implementation

```typescript
// ===================================================================
// components/PasswordField.tsx
// Complete password field with show/hide toggle and strength display
// ===================================================================
'use client';

import { useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

type Props = {
  name: string;
  label: string;
  showStrength?: boolean;
  autoComplete?: string;
  placeholder?: string;
};

export function PasswordField({
  name,
  label,
  showStrength = false,
  autoComplete = 'current-password',
  placeholder,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const password = watch(name) || '';
  const error = errors[name]?.message as string | undefined;

  const toggleVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="relative">
        <input
          id={name}
          type={showPassword ? 'text' : 'password'}
          {...register(name)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`w-full pr-10 rounded-md border ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
          } focus:outline-none focus:ring-2 px-3 py-2`}
        />

        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <p id={`${name}-error`} className="text-red-500 text-sm" role="alert">
          {error}
        </p>
      )}

      {showStrength && <PasswordStrengthIndicator password={password} />}
    </div>
  );
}
```

---

## 8. Error Messages and Accessibility

### 8.1 Accessible Error Display Patterns

To display form validation errors in an accessible manner, implementation conforming to WAI-ARIA specifications is required. Design so that screen reader users can recognize the presence and content of errors.

```typescript
// ===================================================================
// components/AccessibleFormField.tsx
// Accessible form field conforming to WAI-ARIA
// ===================================================================
import { forwardRef, useId } from 'react';

type Props = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-required': boolean;
  }) => React.ReactNode;
};

export function AccessibleFormField({
  label,
  error,
  hint,
  required = false,
  children,
}: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // List of IDs to set in aria-describedby
  const describedByIds = [
    hint ? hintId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-hidden="true">*</span>
        )}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {/* Hint text */}
      {hint && (
        <p id={hintId} className="text-sm text-gray-500 mb-1">
          {hint}
        </p>
      )}

      {/* Form element (render prop pattern) */}
      {children({
        id,
        'aria-invalid': !!error,
        'aria-describedby': describedByIds,
        'aria-required': required,
      })}

      {/* Error message (dynamically announced with aria-live) */}
      {error && (
        <p
          id={errorId}
          className="text-red-500 text-sm mt-1"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// Usage example
function ExampleForm() {
  const form = useForm();

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <AccessibleFormField
        label="Email Address"
        error={form.formState.errors.email?.message as string}
        hint="Enter the email address you will use to log in"
        required
      >
        {(ariaProps) => (
          <input
            type="email"
            {...form.register('email')}
            {...ariaProps}
            className={`w-full border rounded-md px-3 py-2 ${
              ariaProps['aria-invalid'] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        )}
      </AccessibleFormField>
    </form>
  );
}
```

### 8.2 Error Summary Display

```typescript
// ===================================================================
// components/ErrorSummary.tsx
// Component that displays a summary of errors after form submission
// ===================================================================
import { useEffect, useRef } from 'react';
import { type FieldErrors } from 'react-hook-form';

type Props = {
  errors: FieldErrors;
  fieldLabels: Record<string, string>;
};

export function ErrorSummary({ errors, fieldLabels }: Props) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const errorEntries = Object.entries(errors).filter(
    ([key]) => key !== 'root'
  );

  // Automatically move focus when errors are displayed
  useEffect(() => {
    if (errorEntries.length > 0 && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [errorEntries.length]);

  if (errorEntries.length === 0) return null;

  return (
    <div
      ref={summaryRef}
      role="alert"
      aria-labelledby="error-summary-title"
      tabIndex={-1}
      className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
    >
      <h2
        id="error-summary-title"
        className="text-red-800 font-semibold text-sm mb-2"
      >
        {errorEntries.length} error(s) found
      </h2>
      <ul className="list-disc list-inside space-y-1">
        {errorEntries.map(([fieldName, error]) => (
          <li key={fieldName} className="text-red-700 text-sm">
            <a
              href={`#${fieldName}`}
              className="underline hover:no-underline"
              onClick={(e) => {
                e.preventDefault();
                // Move focus to the field with the error
                const field = document.getElementById(fieldName);
                field?.focus();
                field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {fieldLabels[fieldName] || fieldName}
            </a>
            : {(error as { message?: string })?.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Usage example
function FormWithErrorSummary() {
  const form = useForm();
  const [showSummary, setShowSummary] = useState(false);

  const fieldLabels: Record<string, string> = {
    name: 'Name',
    email: 'Email Address',
    password: 'Password',
    phone: 'Phone Number',
  };

  const onInvalid = () => {
    setShowSummary(true);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
      {showSummary && (
        <ErrorSummary
          errors={form.formState.errors}
          fieldLabels={fieldLabels}
        />
      )}
      {/* Form fields */}
    </form>
  );
}
```

### 8.3 Internationalized (i18n) Error Messages

```typescript
// ===================================================================
// lib/validation-messages.ts
// Multi-language validation message management
// ===================================================================
type Locale = 'ja' | 'en' | 'zh' | 'ko';

type MessageKey =
  | 'required'
  | 'email'
  | 'url'
  | 'min_length'
  | 'max_length'
  | 'min_value'
  | 'max_value'
  | 'pattern'
  | 'password_mismatch'
  | 'password_too_weak'
  | 'email_taken'
  | 'username_taken'
  | 'agree_to_terms';

// Message templates (with parameter support)
const messages: Record<Locale, Record<MessageKey, string>> = {
  ja: {
    required: 'この項目は必須です',
    email: '有効なメールアドレスを入力してください',
    url: '有効なURLを入力してください',
    min_length: '{min}文字以上で入力してください',
    max_length: '{max}文字以下で入力してください',
    min_value: '{min}以上の値を入力してください',
    max_value: '{max}以下の値を入力してください',
    pattern: '入力形式が正しくありません',
    password_mismatch: 'パスワードが一致しません',
    password_too_weak: 'パスワードが弱すぎます',
    email_taken: 'このメールアドレスは既に使用されています',
    username_taken: 'このユーザー名は既に使用されています',
    agree_to_terms: '利用規約に同意してください',
  },
  en: {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    url: 'Please enter a valid URL',
    min_length: 'Must be at least {min} characters',
    max_length: 'Must be at most {max} characters',
    min_value: 'Must be at least {min}',
    max_value: 'Must be at most {max}',
    pattern: 'Invalid format',
    password_mismatch: 'Passwords do not match',
    password_too_weak: 'Password is too weak',
    email_taken: 'This email is already in use',
    username_taken: 'This username is already taken',
    agree_to_terms: 'You must agree to the terms',
  },
  zh: {
    required: '此项为必填项',
    email: '请输入有效的电子邮件地址',
    url: '请输入有效的URL',
    min_length: '请输入至少{min}个字符',
    max_length: '请输入不超过{max}个字符',
    min_value: '请输入不小于{min}的值',
    max_value: '请输入不大于{max}的值',
    pattern: '输入格式不正确',
    password_mismatch: '两次输入的密码不一致',
    password_too_weak: '密码强度不够',
    email_taken: '此电子邮件已被使用',
    username_taken: '此用户名已被使用',
    agree_to_terms: '请同意使用条款',
  },
  ko: {
    required: '이 항목은 필수입니다',
    email: '유효한 이메일 주소를 입력해 주세요',
    url: '유효한 URL을 입력해 주세요',
    min_length: '{min}자 이상 입력해 주세요',
    max_length: '{max}자 이하로 입력해 주세요',
    min_value: '{min} 이상의 값을 입력해 주세요',
    max_value: '{max} 이하의 값을 입력해 주세요',
    pattern: '입력 형식이 올바르지 않습니다',
    password_mismatch: '비밀번호가 일치하지 않습니다',
    password_too_weak: '비밀번호가 너무 약합니다',
    email_taken: '이미 사용중인 이메일 주소입니다',
    username_taken: '이미 사용중인 사용자 이름입니다',
    agree_to_terms: '이용 약관에 동의해 주세요',
  },
};

// Message retrieval function
export function getMessage(
  key: MessageKey,
  locale: Locale = 'ja',
  params?: Record<string, string | number>
): string {
  let message = messages[locale]?.[key] || messages.ja[key] || key;

  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      message = message.replace(`{${paramKey}}`, String(value));
    });
  }

  return message;
}

// When used with Zod schemas
export function createLocalizedSchema(locale: Locale = 'ja') {
  const t = (key: MessageKey, params?: Record<string, string | number>) =>
    getMessage(key, locale, params);

  return z.object({
    name: z.string().min(1, t('required')),
    email: z.string().email(t('email')),
    password: z.string()
      .min(8, t('min_length', { min: 8 }))
      .max(100, t('max_length', { max: 100 })),
    confirmPassword: z.string(),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: t('agree_to_terms') }),
    }),
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: t('password_mismatch'),
      path: ['confirmPassword'],
    }
  );
}

// Usage with React context
import { createContext, useContext, type ReactNode } from 'react';

const LocaleContext = createContext<Locale>('ja');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useValidationMessage() {
  const locale = useLocale();
  return (key: MessageKey, params?: Record<string, string | number>) =>
    getMessage(key, locale, params);
}
```

### 8.4 Accessibility Checklist

Accessibility checklist for form validation:

| Item | How to Handle | Priority |
|------|---------|--------|
| Associate error messages with fields | Reference error message ID via `aria-describedby` | Required |
| Indicate error state | Set `aria-invalid="true"` | Required |
| Indicate required fields | `aria-required="true"` + visual marker | Required |
| Dynamically announce errors | `role="alert"` or `aria-live="polite"` | Required |
| Don't rely on color alone | Convey errors via icons and text too | Required |
| Focus on error summary | Move focus to error summary on Submit failure | Recommended |
| Scroll to error fields | Jump to field from error links | Recommended |
| Provide input hints | Associate hint text via `aria-describedby` | Recommended |
| Focus management | Tab order must be logical | Required |
| Keyboard operation | Must be submittable with Enter key | Required |

```typescript
// Complete form example with accessibility support
function AccessibleRegistrationForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const firstErrorRef = useRef<HTMLInputElement>(null);

  const onInvalid = (errors: FieldErrors) => {
    // Move focus to the first error field
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      const element = document.getElementById(firstErrorField);
      element?.focus();
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      noValidate  // Disable browser native validation
      aria-label="User Registration Form"
    >
      {/* Error summary on Submit failure */}
      {form.formState.isSubmitted && !form.formState.isValid && (
        <div
          role="alert"
          tabIndex={-1}
          className="bg-red-50 border-l-4 border-red-500 p-4 mb-6"
        >
          <p className="font-bold text-red-800">There are errors in your input</p>
          <p className="text-red-700 text-sm">
            Please check the following fields.
          </p>
        </div>
      )}

      {/* Each field */}
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-medium">
            Email Address
            <span className="text-red-500" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            id="email"
            type="email"
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={
              [
                'email-hint',
                form.formState.errors.email ? 'email-error' : null,
              ].filter(Boolean).join(' ')
            }
            aria-required="true"
            autoComplete="email"
          />
          <p id="email-hint" className="text-sm text-gray-500 mt-1">
            Enter the email address you will use to log in
          </p>
          {form.formState.errors.email && (
            <p id="email-error" role="alert" className="text-red-500 text-sm mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <span className="sr-only">Submitting</span>
            <span aria-hidden="true">Submitting...</span>
          </>
        ) : (
          'Register'
        )}
      </button>
    </form>
  );
}
```

---

## 9. Validation Testing Strategies

### 9.1 Unit Testing Zod Schemas

Since Zod schemas behave as pure functions, they are easy to unit test. By comprehensively testing all edge cases, you can ensure the reliability of validation logic.

```typescript
// ===================================================================
// __tests__/schemas/user.test.ts
// Unit tests for Zod schemas
// ===================================================================
import { describe, it, expect } from 'vitest';
import { createUserSchema, loginSchema, passwordResetSchema } from '@shared/schemas/user';

describe('createUserSchema', () => {
  // Happy path tests
  describe('valid inputs', () => {
    it('parses successfully when all required fields are correct', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password1!',
        name: 'Test User',
        role: 'user',
      };

      const result = createUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('testuser');
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('applies the default value for role', () => {
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password1!',
        name: 'Test User',
      };

      const result = createUserSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('user');
      }
    });
  });

  // Negative tests: username
  describe('username validation', () => {
    const baseData = {
      email: 'test@example.com',
      password: 'Password1!',
      name: 'Test User',
      role: 'user' as const,
    };

    it('rejects usernames shorter than 3 characters', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        username: 'ab',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.username).toContain(
          'Must be at least 3 characters'
        );
      }
    });

    it('rejects usernames longer than 20 characters', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        username: 'a'.repeat(21),
      });
      expect(result.success).toBe(false);
    });

    it('rejects usernames containing special characters', () => {
      const invalidUsernames = ['user name', 'user@name', 'user.name', 'username_jp'];
      invalidUsernames.forEach((username) => {
        const result = createUserSchema.safeParse({ ...baseData, username });
        expect(result.success).toBe(false);
      });
    });

    it('allows usernames containing underscores', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        username: 'test_user_123',
      });
      expect(result.success).toBe(true);
    });
  });

  // Negative tests: email
  describe('email validation', () => {
    const baseData = {
      username: 'testuser',
      password: 'Password1!',
      name: 'Test User',
      role: 'user' as const,
    };

    it.each([
      ['missing @', 'testexample.com'],
      ['missing domain', 'test@'],
      ['missing local part', '@example.com'],
      ['spaces', 'test @example.com'],
      ['double dots', 'test@example..com'],
    ])('%s: rejects "%s"', (_, email) => {
      const result = createUserSchema.safeParse({ ...baseData, email });
      expect(result.success).toBe(false);
    });
  });

  // Negative tests: password
  describe('password validation', () => {
    const baseData = {
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user' as const,
    };

    it('rejects passwords shorter than 8 characters', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        password: 'Pass1!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords without uppercase letters', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        password: 'password1!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords without lowercase letters', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        password: 'PASSWORD1!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords without numbers', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        password: 'Password!@',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords containing the username', () => {
      const result = createUserSchema.safeParse({
        ...baseData,
        username: 'testuser',
        password: 'Testuser1!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten();
        expect(errors.fieldErrors.password).toBeDefined();
      }
    });
  });

  // Cross-field validation
  describe('cross-field validation', () => {
    it('rejects when the password contains the username', () => {
      const result = createUserSchema.safeParse({
        username: 'johndoe',
        email: 'john@example.com',
        password: 'Johndoe123!',
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ===================================================================
// Password strength tests
// ===================================================================
import { getPasswordStrength } from '@/lib/password-strength';

describe('getPasswordStrength', () => {
  it('empty string has a score of 0', () => {
    const result = getPasswordStrength('');
    expect(result.score).toBe(0);
  });

  it('short and simple passwords have a low score', () => {
    const result = getPasswordStrength('abc');
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('commonly used passwords have a low score', () => {
    const result = getPasswordStrength('password');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.requirements.noCommonPattern).toBe(false);
  });

  it('sufficiently complex passwords have a high score', () => {
    const result = getPasswordStrength('MyStr0ng!P@ssw0rd2024');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('requirements are all true when all conditions are met', () => {
    const result = getPasswordStrength('MyP@ssw0rd!');
    expect(result.requirements.minLength).toBe(true);
    expect(result.requirements.hasUppercase).toBe(true);
    expect(result.requirements.hasLowercase).toBe(true);
    expect(result.requirements.hasNumber).toBe(true);
    expect(result.requirements.hasSpecial).toBe(true);
  });
});
```

### 9.2 Integration Testing Form Components

```typescript
// ===================================================================
// __tests__/components/ContactForm.test.tsx
// Form testing with React Testing Library
// ===================================================================
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactForm } from '@/components/ContactForm';

// API mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ContactForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    mockFetch.mockReset();
  });

  // Helper: fill in the form
  async function fillForm(overrides: Partial<Record<string, string>> = {}) {
    const defaults = {
      lastName: 'Smith',
      firstName: 'John',
      email: 'john@example.com',
      message: 'This is a test message with more than 10 characters.',
      ...overrides,
    };

    if (defaults.lastName) {
      await user.type(screen.getByLabelText('Last Name'), defaults.lastName);
    }
    if (defaults.firstName) {
      await user.type(screen.getByLabelText('First Name'), defaults.firstName);
    }
    if (defaults.email) {
      await user.type(screen.getByLabelText('Email Address'), defaults.email);
    }
    if (defaults.message) {
      await user.type(screen.getByLabelText('Message'), defaults.message);
    }

    // Select inquiry type
    await user.selectOptions(screen.getByLabelText('Inquiry Type'), 'inquiry');

    // Agree to terms
    await user.click(screen.getByLabelText('I agree to the terms of service'));
  }

  it('displays error messages when required fields are empty', async () => {
    render(<ContactForm />);

    // Submit with empty fields
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter your last name')).toBeInTheDocument();
      expect(screen.getByText('Please enter your first name')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('displays an error when the email address format is invalid', async () => {
    render(<ContactForm />);

    await user.type(screen.getByLabelText('Email Address'), 'invalid-email');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(
        screen.getByText('Please enter a valid email address')
      ).toBeInTheDocument();
    });
  });

  it('displays an error when the message is shorter than 10 characters', async () => {
    render(<ContactForm />);

    await user.type(screen.getByLabelText('Message'), 'Short');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(
        screen.getByText('Must be at least 10 characters')
      ).toBeInTheDocument();
    });
  });

  it('can submit the form with correct input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ContactForm />);
    await fillForm();
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/contact', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });
  });

  it('displays server errors on the form', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        fieldErrors: {
          email: ['This email address is already in use'],
        },
      }),
    });

    render(<ContactForm />);
    await fillForm();
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(
        screen.getByText('This email address is already in use')
      ).toBeInTheDocument();
    });
  });

  it('disables the button while submitting', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(<ContactForm />);
    await fillForm();
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
  });

  it('errors disappear in real time after fixing them', async () => {
    render(<ContactForm />);

    // First Submit to show errors
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter your last name')).toBeInTheDocument();
    });

    // Type in the field with the error
    await user.type(screen.getByLabelText('Last Name'), 'Smith');

    // Confirm error disappears (reValidateMode: 'onChange')
    await waitFor(() => {
      expect(screen.queryByText('Please enter your last name')).not.toBeInTheDocument();
    });
  });

  // Accessibility tests
  it('sets aria-invalid attribute on error fields', async () => {
    render(<ContactForm />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Last Name')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('sets role="alert" on error messages', async () => {
    render(<ContactForm />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});
```

### 9.3 E2E Testing (Playwright)

```typescript
// ===================================================================
// e2e/registration.spec.ts
// E2E testing with Playwright
// ===================================================================
import { test, expect } from '@playwright/test';

test.describe('User Registration Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('registration succeeds with valid input', async ({ page }) => {
    // Fill in the form
    await page.fill('[name="username"]', 'newuser123');
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'StrongP@ss1');

    // Submit
    await page.click('button[type="submit"]');

    // Confirm redirect
    await expect(page).toHaveURL('/login?registered=true');
  });

  test('validation errors are displayed', async ({ page }) => {
    // Submit with empty fields
    await page.click('button[type="submit"]');

    // Confirm error messages are shown
    await expect(page.getByText('Must be at least 3 characters')).toBeVisible();
    await expect(page.getByText('Please enter your name')).toBeVisible();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('password strength indicator updates dynamically', async ({ page }) => {
    const passwordField = page.locator('[name="password"]');

    // Weak password
    await passwordField.fill('abc');
    await expect(page.getByText('Very Weak')).toBeVisible();

    // Moderate password
    await passwordField.fill('Password1');
    await expect(page.getByText(/Fair|Strong/)).toBeVisible();

    // Strong password
    await passwordField.fill('MyStr0ng!P@ss');
    await expect(page.getByText(/Strong|Very Strong/)).toBeVisible();
  });

  test('email duplicate check works', async ({ page }) => {
    // Enter an existing email address
    await page.fill('[name="email"]', 'existing@example.com');
    await page.locator('[name="email"]').blur();

    // Confirm duplicate error is shown (asynchronous validation)
    await expect(
      page.getByText('This email address is already in use')
    ).toBeVisible({ timeout: 5000 });
  });

  test('can be operated with keyboard only', async ({ page }) => {
    // Confirm focus moves to all fields with Tab key
    await page.keyboard.press('Tab'); // username
    await expect(page.locator('[name="username"]')).toBeFocused();

    await page.keyboard.press('Tab'); // name
    await expect(page.locator('[name="name"]')).toBeFocused();

    await page.keyboard.press('Tab'); // email
    await expect(page.locator('[name="email"]')).toBeFocused();

    await page.keyboard.press('Tab'); // password
    await expect(page.locator('[name="password"]')).toBeFocused();
  });
});
```

---

## 10. Anti-Patterns and Best Practices

### 10.1 Common Anti-Patterns

#### Anti-Pattern 1: Client-Only Validation

```typescript
// BAD: Validation only on the client side
function BadForm() {
  const onSubmit = async (data: FormData) => {
    // Send to server (no validation)
    await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
}

// GOOD: Validate with the same schema on the server side too
// server
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 422 });
  }
  // ... database operation
}
```

#### Anti-Pattern 2: Duplicating Validation Logic

```typescript
// BAD: Define separate validation rules on client and server
// client
const clientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// server (same rules duplicated in a different file)
function validateOnServer(data: unknown) {
  if (typeof data.email !== 'string' || !data.email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (typeof data.password !== 'string' || data.password.length < 8) {
    throw new Error('Invalid password');
  }
}

// GOOD: Place schemas in a shared directory and reuse them
// shared/schemas/auth.ts
export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Import the same schema in both client and server
import { authSchema } from '@shared/schemas/auth';
```

#### Anti-Pattern 3: Hardcoding Error Messages

```typescript
// BAD: Hardcode error messages directly
const schema = z.object({
  name: z.string().min(1, 'Name is required'),  // Fixed language
});

// GOOD: Externalize messages for internationalization support
const schema = z.object({
  name: z.string().min(1, getMessage('required', locale)),
});
```

#### Anti-Pattern 4: Carelessly Using onChange Mode

```typescript
// BAD: Using onChange mode for all forms (performance issues)
const form = useForm({
  resolver: zodResolver(schema),
  mode: 'onChange', // Validation runs on every keystroke
});

// GOOD: Combine onSubmit + onChange
const form = useForm({
  resolver: zodResolver(schema),
  mode: 'onSubmit',           // First time: on Submit
  reValidateMode: 'onChange', // After errors: real time
});
```

#### Anti-Pattern 5: Lack of Type Safety

```typescript
// BAD: Using any type, not leveraging type inference
const onSubmit = async (data: any) => {
  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// GOOD: Infer types from Zod schema
type FormData = z.infer<typeof userSchema>;

const onSubmit = async (data: FormData) => {
  // data is automatically type-safe
  await createUser(data);
};
```

#### Anti-Pattern 6: Asynchronous Validation Without Debounce

```typescript
// BAD: API request on every keystroke
<input
  {...register('username', {
    validate: async (value) => {
      // Calls API every time → large number of requests to server
      const res = await fetch(`/api/check?username=${value}`);
      const data = await res.json();
      return data.available || 'This username is already in use';
    },
  })}
/>

// GOOD: Controlled with debounce + AbortController
const { validate, isValidating } = useAsyncValidation(
  async (value) => {
    const res = await fetch(`/api/check?username=${value}`);
    const data = await res.json();
    return data.available || 'This username is already in use';
  },
  500 // 500ms debounce
);
```

### 10.2 Summary of Best Practices

| Category | Best Practice | Reason |
|---------|-------------------|------|
| **Schema Design** | Place schemas in a shared directory | Reuse between client/server |
| **Schema Design** | Auto-infer types with z.infer | Prevent duplicate type definitions |
| **Schema Design** | Derive from baseSchema + extend/pick/omit | Follow the DRY principle |
| **Validation** | mode: 'onSubmit' + reValidateMode: 'onChange' | Balance UX and performance |
| **Validation** | Apply debounce to async validation | Reduce server load |
| **Validation** | Always validate on the server too | Guarantee security |
| **Error Display** | Use aria-invalid and aria-describedby | Accessibility support |
| **Error Display** | Focus on error fields on Submit failure | Improve UX |
| **Testing** | Cover boundary values in schema tests | Reliability of validation logic |
| **Testing** | Verify form behavior with integration tests | Quality assurance of user experience |
| **Internationalization** | Externalize error messages | Easy multi-language support |
| **Performance** | Split large forms with FormProvider | Rendering optimization |

---

## 11. Troubleshooting

### 11.1 Common Problems and Solutions

#### Problem 1: zodResolver validation does not work

```typescript
// Symptom: No validation errors displayed even after form submission

// Cause 1: Missing resolver configuration
// BAD
const form = useForm<FormData>({
  // resolver not configured
});

// GOOD
const form = useForm<FormData>({
  resolver: zodResolver(schema), // Required
});

// Cause 2: Type mismatch between schema and default values
// BAD: Inconsistency between undefined and string
const schema = z.object({
  name: z.string().min(1),
});
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    name: undefined, // string expected but undefined provided
  },
});

// GOOD
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    name: '', // Initialize with empty string
  },
});
```

#### Problem 2: refine errors are not displayed

```typescript
// Symptom: Validation errors added with refine are not shown on screen

// Cause: Missing path specification
// BAD
const schema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  'Passwords do not match'  // path not specified → treated as root error
);

// GOOD
const schema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // Specify the field to associate the error with
  }
);

// To display root errors
{errors.root && (
  <div role="alert">{errors.root.message}</div>
)}
```

#### Problem 3: Validation for select or checkbox does not work

```typescript
// Symptom: No validation errors for select elements or checkboxes

// Cause 1: select - handling of empty option value
// BAD: value="" is treated as an empty string (string) in Zod
const schema = z.object({
  category: z.string().min(1, 'Please select a category'),
});

// GOOD: Use enum
const schema = z.object({
  category: z.enum(['tech', 'design', 'business'], {
    errorMap: () => ({ message: 'Please select a category' }),
  }),
});

// Cause 2: checkbox - boolean vs literal
// BAD: z.boolean() allows false too
const schema = z.object({
  agree: z.boolean(), // false passes too
});

// GOOD: z.literal(true) to allow only true
const schema = z.object({
  agree: z.literal(true, {
    errorMap: () => ({ message: 'Agreement is required' }),
  }),
});

// Note on defaultValues
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    agree: false as unknown as true, // Type assertion required
  },
});
```

#### Problem 4: Validation with useFieldArray

```typescript
// Symptom: Array validation errors for dynamic fields are not displayed correctly

// Cause: Incorrect path for error access

// GOOD: Correct access method
// Array-wide validation errors (min, max, refine, etc.)
{errors.contacts?.root?.message}

// Validation errors for individual elements
{errors.contacts?.[index]?.name?.message}

// Example array schema definition
const schema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
    })
  )
  .min(1, 'At least one required')     // → errors.contacts?.root?.message
  .max(10, 'Up to 10 allowed'),         // → errors.contacts?.root?.message
});
```

#### Problem 5: Form does not reset after submission

```typescript
// Symptom: Form values and error state remain after successful submission

// GOOD: Use reset() correctly
const onSubmit = async (data: FormData) => {
  const result = await submitForm(data);

  if (result.success) {
    // Reset the entire form
    form.reset();

    // Or reset only specific fields
    form.reset({
      name: '',
      email: data.email, // Retain email address
    });

    // Return to default values
    form.reset(undefined, {
      keepDirtyValues: false,
      keepErrors: false,
    });
  }
};
```

#### Problem 6: coerce type conversion does not behave as expected

```typescript
// Symptom: z.coerce.number() returns unexpected values

// Cause: Empty string is converted to NaN/0
const schema = z.object({
  age: z.coerce.number(), // '' → 0, 'abc' → NaN
});

// GOOD: Handle empty string with preprocess then coerce
const schema = z.object({
  age: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      return val;
    },
    z.coerce.number().int().min(0).optional()
  ),
});

// Or validate after parsing with transform
const schema = z.object({
  age: z.string()
    .transform((val) => {
      if (val === '') return undefined;
      const num = Number(val);
      if (isNaN(num)) return undefined;
      return num;
    })
    .pipe(z.number().int().min(0).optional()),
});
```

### 11.2 Performance Optimization

```typescript
// ===================================================================
// Notes on performance and optimization techniques
// ===================================================================

// 1. Rendering optimization for large forms
// BAD: All fields re-render with watch
function BadForm() {
  const form = useForm<FormData>();
  const allValues = form.watch(); // Re-renders on every field change

  return (
    <form>
      {/* 100 fields... all re-rendered */}
    </form>
  );
}

// GOOD: Watch only the necessary fields
function GoodForm() {
  const form = useForm<FormData>();
  const password = form.watch('password'); // Only monitor password

  return (
    <form>
      <input {...form.register('password')} />
      <PasswordStrengthIndicator password={password} />
      {/* Other fields are not re-rendered */}
    </form>
  );
}

// 2. Separate child components with useWatch
function OptimizedPasswordField() {
  // Only this component re-renders on password change
  const password = useWatch({ name: 'password' });

  return (
    <div>
      <input {...register('password')} />
      <PasswordStrengthIndicator password={password || ''} />
    </div>
  );
}

// 3. Using memoization
const MemoizedField = React.memo(function Field({
  name,
  label,
  error,
}: {
  name: string;
  label: string;
  error?: string;
}) {
  const { register } = useFormContext();

  return (
    <div>
      <label>{label}</label>
      <input {...register(name)} />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
});

// 4. Memoize Zod schemas (for dynamic schemas)
const useDynamicSchema = (locale: string) => {
  return useMemo(() => {
    return z.object({
      name: z.string().min(1, getMessage('required', locale)),
      email: z.string().email(getMessage('email', locale)),
    });
  }, [locale]); // Re-create only when locale changes
};

// 5. Caching asynchronous validation
const validationCache = new Map<string, boolean>();

async function checkUsernameWithCache(username: string): Promise<string | true> {
  // Check cache
  if (validationCache.has(username)) {
    return validationCache.get(username) ? true : 'This username is already in use';
  }

  const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
  const data = await res.json();

  // Cache the result (up to 100 entries)
  if (validationCache.size > 100) {
    const firstKey = validationCache.keys().next().value;
    validationCache.delete(firstKey);
  }
  validationCache.set(username, data.available);

  return data.available ? true : 'This username is already in use';
}
```

---

## 12. Practical Form Pattern Collection

### 12.1 Multi-Step Form (Wizard Style)

```typescript
// ===================================================================
// components/MultiStepForm.tsx
// Large form that validates per step
// ===================================================================
import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define schemas for each step
const step1Schema = z.object({
  name: z.string().min(1, 'Please enter your name'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/, 'Please enter a valid phone number'),
});

const step2Schema = z.object({
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/, 'Please enter a valid postal code'),
  prefecture: z.string().min(1, 'Please select a prefecture'),
  city: z.string().min(1, 'Please enter a city'),
  street: z.string().min(1, 'Please enter a street address'),
  building: z.string().optional(),
});

const step3Schema = z.object({
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'convenience']),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the terms of service' }),
  }),
});

// Full schema (used for final submission)
const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type FullFormData = z.infer<typeof fullSchema>;

// Step definitions
const steps = [
  { title: 'Customer Information', schema: step1Schema },
  { title: 'Shipping Address', schema: step2Schema },
  { title: 'Payment & Confirmation', schema: step3Schema },
] as const;

function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const methods = useForm<FullFormData>({
    resolver: zodResolver(fullSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      postalCode: '',
      prefecture: '',
      city: '',
      street: '',
      building: '',
      paymentMethod: 'credit_card',
      agreeToTerms: false as unknown as true,
    },
  });

  // Validate only the current step's fields
  const validateCurrentStep = async (): Promise<boolean> => {
    const currentSchema = steps[currentStep].schema;
    const currentFields = Object.keys(currentSchema.shape) as Array<keyof FullFormData>;

    const isValid = await methods.trigger(currentFields);
    return isValid;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = async (stepIndex: number) => {
    // Can freely go back to earlier steps
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
      return;
    }

    // Validate current step before advancing
    if (stepIndex === currentStep + 1) {
      await handleNext();
    }
  };

  const onSubmit = async (data: FullFormData) => {
    console.log('Submitting:', data);
    // API submission logic
  };

  return (
    <FormProvider {...methods}>
      <div className="max-w-2xl mx-auto">
        {/* Step indicator */}
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex justify-between">
            {steps.map((step, index) => (
              <li key={index} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(index)}
                  className={`flex items-center gap-2 ${
                    index === currentStep
                      ? 'text-blue-600 font-bold'
                      : completedSteps.has(index)
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
                  aria-current={index === currentStep ? 'step' : undefined}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    index === currentStep
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : completedSteps.has(index)
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 text-gray-400'
                  }`}>
                    {completedSteps.has(index) ? '✓' : index + 1}
                  </span>
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Step content */}
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">
              {steps[currentStep].title}
            </h2>

            {currentStep === 0 && <Step1Fields />}
            {currentStep === 1 && <Step2Fields />}
            {currentStep === 2 && <Step3Fields />}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-6 py-2 border rounded disabled:opacity-50"
            >
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={methods.formState.isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {methods.formState.isSubmitting ? 'Submitting...' : 'Place Order'}
              </button>
            )}
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
```

### 12.2 Inline Edit Pattern

```typescript
// ===================================================================
// components/InlineEdit.tsx
// Pattern for clicking a field inside a table to edit it
// ===================================================================
import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';

type InlineEditProps<T extends z.ZodType> = {
  value: string;
  schema: T;
  onSave: (newValue: z.infer<T>) => Promise<void>;
  displayComponent?: React.ReactNode;
  placeholder?: string;
};

function InlineEdit<T extends z.ZodType>({
  value,
  schema,
  onSave,
  displayComponent,
  placeholder = 'Click to edit',
}: InlineEditProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    // Validate with Zod
    const result = schema.safeParse(editValue);

    if (!result.success) {
      setError(result.error.errors[0]?.message || 'Validation error');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(result.data);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="group flex items-center gap-1 hover:bg-gray-50 px-2 py-1 rounded cursor-pointer"
        aria-label={`Edit ${value || placeholder}`}
      >
        {displayComponent || (
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>
            {value || placeholder}
          </span>
        )}
        <svg
          className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full px-2 py-1 border rounded text-sm ${
            error ? 'border-red-500' : 'border-blue-500'
          }`}
          disabled={isSaving}
          aria-invalid={!!error}
        />
        {error && (
          <p className="text-red-500 text-xs mt-0.5" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="text-green-600 hover:text-green-800"
        aria-label="Save"
      >
        {isSaving ? '...' : '✓'}
      </button>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="text-red-600 hover:text-red-800"
        aria-label="Cancel"
      >
        x
      </button>
    </div>
  );
}

// Usage example
function UserTable() {
  return (
    <table>
      <tbody>
        <tr>
          <td>
            <InlineEdit
              value={user.name}
              schema={z.string().min(1, 'Please enter a name').max(100)}
              onSave={async (newName) => {
                await updateUser({ name: newName });
              }}
            />
          </td>
          <td>
            <InlineEdit
              value={user.email}
              schema={z.string().email('Please enter a valid email address')}
              onSave={async (newEmail) => {
                await updateUser({ email: newEmail });
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
```

### 12.3 Conditional Field Show/Hide Pattern

```typescript
// ===================================================================
// Form where fields increase or decrease based on conditions
// ===================================================================
const shippingSchema = z.discriminatedUnion('shippingType', [
  z.object({
    shippingType: z.literal('standard'),
    // Standard shipping has no additional fields
  }),
  z.object({
    shippingType: z.literal('express'),
    expressOption: z.enum(['next_day', 'same_day']),
    expressNote: z.string().max(200).optional(),
  }),
  z.object({
    shippingType: z.literal('pickup'),
    pickupLocation: z.string().min(1, 'Please select a pickup location'),
    pickupDate: z.coerce.date().min(new Date(), 'Past dates cannot be specified'),
    pickupTime: z.string().regex(/^\d{2}:\d{2}$/, 'Please enter a pickup time'),
  }),
]);

type ShippingData = z.infer<typeof shippingSchema>;

function ShippingForm() {
  const form = useForm<ShippingData>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      shippingType: 'standard',
    },
  });

  const shippingType = form.watch('shippingType');

  // Reset form when shipping method changes
  useEffect(() => {
    form.clearErrors();
    // Clear fields for shipping types other than the current one
    if (shippingType === 'standard') {
      form.unregister(['expressOption', 'expressNote', 'pickupLocation', 'pickupDate', 'pickupTime']);
    } else if (shippingType === 'express') {
      form.unregister(['pickupLocation', 'pickupDate', 'pickupTime']);
    } else if (shippingType === 'pickup') {
      form.unregister(['expressOption', 'expressNote']);
    }
  }, [shippingType]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <fieldset>
        <legend>Shipping Method</legend>
        <label>
          <input type="radio" {...form.register('shippingType')} value="standard" />
          Standard Shipping (3-5 business days)
        </label>
        <label>
          <input type="radio" {...form.register('shippingType')} value="express" />
          Express Shipping
        </label>
        <label>
          <input type="radio" {...form.register('shippingType')} value="pickup" />
          In-Store Pickup
        </label>
      </fieldset>

      {/* Conditional fields */}
      {shippingType === 'express' && (
        <div className="mt-4 p-4 bg-yellow-50 rounded">
          <h3>Express Options</h3>
          <select {...form.register('expressOption')}>
            <option value="next_day">Next-Day Delivery</option>
            <option value="same_day">Same-Day Delivery</option>
          </select>
          <textarea
            {...form.register('expressNote')}
            placeholder="Notes (optional)"
            maxLength={200}
          />
        </div>
      )}

      {shippingType === 'pickup' && (
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <h3>In-Store Pickup Information</h3>
          <select {...form.register('pickupLocation')}>
            <option value="">Select Pickup Location</option>
            <option value="tokyo">Tokyo Store</option>
            <option value="osaka">Osaka Store</option>
            <option value="nagoya">Nagoya Store</option>
          </select>
          {form.formState.errors.pickupLocation && (
            <span className="text-red-500">
              {form.formState.errors.pickupLocation.message}
            </span>
          )}
          <input type="date" {...form.register('pickupDate')} />
          <input type="time" {...form.register('pickupTime')} />
        </div>
      )}

      <button type="submit">Confirm</button>
    </form>
  );
}
```

---

## Summary

### Overview of Validation Patterns

| Pattern | Use Case | Recommendation |
|---------|------|-------|
| Zod + React Hook Form | Type-safe form validation | Most Recommended |
| Double validation with shared schemas | Same schema on client + server | Required |
| Discriminated Union | Validation for conditional fields | Situational |
| Async validation + debounce | Email duplicate check, etc. | Recommended |
| mode: 'onSubmit' + reValidateMode: 'onChange' | Optimal UX balance | Most Recommended |
| useFieldArray | Managing dynamic field arrays | Situational |
| FormProvider + useFormContext | Splitting large forms into components | Recommended |
| Password strength indicator | Quality feedback for passwords | Recommended |
| Error summary | Error list display after Submit | Recommended |
| Multi-step form | Gradual input of large numbers of fields | Situational |
| Inline edit | Direct editing inside tables | Situational |
| Conditional field display | Dynamic UI with Discriminated Union | Situational |
| Internationalized error messages | Multi-language support | Situational |

### Design Principles

1. **Schema-first**: Define the Zod schema first, then derive types and validation rules from it
2. **Single source of truth**: Define validation rules in one place and share between client and server
3. **Progressive feedback**: Start conservatively on first input, provide aggressive feedback after errors
4. **Accessibility-first**: Use WAI-ARIA attributes correctly and support keyboard operation and screen readers
5. **Defensive programming**: Client-side validation is for UX, server-side validation is for security
6. **Test-driven**: Progressively build schema boundary value tests, form integration tests, and E2E tests

---

## Frequently Asked Questions (FAQ)

### Q1. How should I distinguish between client-side and server-side validation?

**A:** The fundamental rule is that **both are required**. Each has the following role:

**Client-Side Validation (JavaScript/Zod):**

- **Role**: For UX improvement
- **Purpose**: Provide immediate feedback to users and prevent unnecessary server requests
- **Reliability**: **Must not be trusted** (can easily be bypassed with browser developer tools)

Implementation example:

```typescript
// Client side (React Hook Form + Zod)
const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  age: z.number().min(18, 'You must be at least 18 years old'),
});

const form = useForm({ resolver: zodResolver(schema) });
```

**Server-Side Validation (API/Backend):**

- **Role**: Guarantee security and data integrity
- **Purpose**: Protect the system from malicious requests and invalid data
- **Reliability**: **The only trustworthy validation**

Implementation example:

```typescript
// Server side (Next.js Server Action)
'use server';

export async function createUser(formData: FormData) {
  // Always re-validate on the server side
  const result = schema.safeParse({
    email: formData.get('email'),
    age: Number(formData.get('age')),
  });

  if (!result.success) {
    return { errors: result.error.flatten() };
  }

  // Additional business rule validation before saving to database
  const emailExists = await db.user.findUnique({ where: { email: result.data.email } });
  if (emailExists) {
    return { errors: { email: 'This email address is already in use' } };
  }

  // Save operation
  await db.user.create({ data: result.data });
}
```

**Best Practices:**

1. **Share schemas**: Use the same Zod schema on client and server (via monorepo or package sharing)
2. **Layered validation**:
   - Client: Format validation (email format, required fields, etc.)
   - Server: Format re-validation + business rules (duplicate check, auth check, etc.)
3. **Consistent error messages**: Return the same messages from client and server

### Q2. Should I choose Zod or yup?

**A:** For current projects, **Zod is strongly recommended**:

| Item | Zod | yup |
|------|-----|-----|
| TypeScript support | TypeScript-first, perfect type inference | JavaScript-based, type definitions added later |
| Bundle size | 8KB (gzip) | 13KB (gzip) |
| Performance | Fast | Slightly slower |
| Error messages | Easy to customize | Somewhat complex to customize |
| Ecosystem | Integrates with latest tools like Next.js, tRPC, Prisma | Strong integration with Formik |
| Maintenance | Active | Active but growth slowing |

**Where Zod excels:**

```typescript
// Perfect type inference
const userSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type User = z.infer<typeof userSchema>;
// → { name: string; age: number } is automatically inferred
```

**Where yup excels:**

- Historically strong integration with Formik (Formik official docs recommend yup)
- Abundant learning resources (longer history)

**Is migration easy?**

Since Zod and yup have similar APIs, migration is relatively straightforward:

```typescript
// yup
const schema = yup.object({
  email: yup.string().email().required(),
});

// Zod
const schema = z.object({
  email: z.string().email(),
});
```

### Q3. How should I implement asynchronous validation (such as duplicate checks)?

**A:** Asynchronous validation is used for **checks that require API calls** (email address duplicate check, username availability check, etc.).

**Pattern 1: Asynchronous check with Zod `.refine()`**

```typescript
const emailSchema = z.string().email().refine(
  async (email) => {
    // Duplicate check via API
    const response = await fetch(`/api/check-email?email=${email}`);
    const { available } = await response.json();
    return available;
  },
  { message: 'This email address is already in use' }
);
```

**Pattern 2: React Hook Form `validate` option**

```typescript
const form = useForm();

<input
  {...form.register('email', {
    validate: async (value) => {
      const response = await fetch(`/api/check-email?email=${value}`);
      const { available } = await response.json();
      return available || 'This email address is already in use';
    }
  })}
/>
```

**Pattern 3: Defensive implementation with a custom hook (recommended)**

```typescript
function useEmailValidation() {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const validateEmail = useCallback(async (email: string) => {
    // Debounce: don't call API during continuous input
    clearTimeout(timeoutRef.current);

    return new Promise<boolean>((resolve) => {
      timeoutRef.current = setTimeout(async () => {
        setIsChecking(true);
        try {
          const response = await fetch(`/api/check-email?email=${email}`);
          const { available } = await response.json();

          if (!available) {
            setError('This email address is already in use');
            resolve(false);
          } else {
            setError(null);
            resolve(true);
          }
        } catch (err) {
          setError('An error occurred while checking');
          resolve(false);
        } finally {
          setIsChecking(false);
        }
      }, 500); // 500ms debounce
    });
  }, []);

  return { validateEmail, isChecking, error };
}

// Usage example
function EmailField() {
  const form = useForm();
  const { validateEmail, isChecking, error } = useEmailValidation();

  return (
    <div>
      <input
        {...form.register('email', {
          validate: validateEmail,
        })}
      />
      {isChecking && <span>Checking...</span>}
      {error && <span>{error}</span>}
    </div>
  );
}
```

**Best Practices:**

1. **Always implement debounce**: Avoid unnecessary API requests during continuous input (500ms recommended)
2. **Show loading state**: Use an `isChecking` flag to inform users that processing is in progress
3. **Error handling**: Handle network errors and timeouts
4. **Use caching**: Don't check the same input value multiple times (consider React Query or SWR)
5. **Final validation on the server**: Client-side async checks are for UX; always re-validate on the server

**Notes:**

- Carefully choose whether to trigger on onBlur (focus out) or onChange (while typing)
- If implementing with onChange, debounce is mandatory (otherwise the API will be called excessively)
- Don't forget to re-validate on the server side at form submission

---

## Next Guides to Read

---

## References
1. React Hook Form. "Resolvers." react-hook-form.com, 2024.
2. Zod. "Documentation." zod.dev, 2024.
3. WAI-ARIA. "Forms Pattern." w3.org/WAI/ARIA/apg/patterns/forms, 2024.
4. MDN Web Docs. "Client-side form validation." developer.mozilla.org, 2024.
5. Colinhacks. "Zod: TypeScript-first schema validation." GitHub, 2024.
6. React Hook Form. "Advanced Usage - Wizard Form." react-hook-form.com, 2024.
7. Valibot. "Documentation." valibot.dev, 2024.
8. Web Content Accessibility Guidelines (WCAG) 2.2. "Understanding Success Criterion 3.3.1: Error Identification." w3.org, 2023.
