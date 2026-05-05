# Form Design

> Forms are the primary interaction point between users and your application. Master best practices for building usable, maintainable forms — covering React Hook Form, controlled/uncontrolled components, performance optimization, and accessibility.

## What You Will Learn

- [ ] Understand the fundamental patterns and advanced techniques of React Hook Form
- [ ] Know when to use controlled vs. uncontrolled components and how to implement each
- [ ] Learn UX and accessibility best practices for forms
- [ ] Implement integration patterns with Server Actions
- [ ] Design complex forms (multi-step, dynamic fields)
- [ ] Understand form performance optimization techniques
- [ ] Acquire testing strategies and debugging methods

---

## Prerequisites

To get the most out of this chapter, it is recommended that you have prior knowledge of the following:

- **Component Architecture**: Understanding of React component design principles and how to build reusable components, as covered in `../00-architecture/02-component-architecture.md`
- **React Hooks Fundamentals**: Familiarity with basic hooks such as `useState`, `useRef`, and `useEffect`, as well as custom hook design patterns
- **HTML Form Elements**: Basic knowledge of native HTML elements like `<form>`, `<input>`, `<select>`, and `<textarea>` — their behavior, attributes, and event handling

---

## 1. Core Principles of Form Design

The most important goal in form design is to let users accomplish their objective with minimal friction. Before diving into technical implementation, it is essential to understand these design principles.

### 1.1 The Three Pillars of Form Design

```
The Three Pillars of Form Design:

1. Usability
   - Intuitive layout and flow
   - Clear labels and placeholders
   - Helpful error messages and feedback
   - Mobile-friendly input experience

2. Accessibility
   - Screen reader support
   - Keyboard navigation
   - Sufficient contrast ratios
   - Proper use of ARIA attributes

3. Performance
   - Minimal re-renders
   - Deferred validation
   - Efficient state management
   - Bundle size optimization
```

### 1.2 Comparing Form Libraries

A comparison of the major form libraries in the React ecosystem.

| Characteristic | React Hook Form | Formik | React Final Form | Plain useState |
|----------------|----------------|--------|-----------------|----------------|
| Bundle size | ~9KB | ~13KB | ~5KB | 0KB |
| Re-renders | Minimal (uncontrolled-based) | On every field change | Minimal | On every field change |
| TypeScript support | Excellent (inference works well) | Good | Good | Full (manual definitions) |
| Validation | Zod/Yup integration | Yup integration | Custom | Manual implementation |
| Learning curve | Low–Medium | Medium | Medium | Low |
| Ecosystem | Rich (DevTools, etc.) | Mature | Limited | None |
| Maintenance status | Active | Somewhat stagnant | Stable | — |
| Performance | Best | Average | Good | Depends on implementation |

### 1.3 Why Choose React Hook Form

```typescript
// Reasons to choose React Hook Form:

// 1. Performance: Uncontrolled component-based with minimal re-renders
//    → Fast even on pages with many form fields

// 2. DX (Developer Experience): Easy field registration with register()
//    → Less boilerplate code

// 3. Validation integration: Works with major validation libraries like Zod, Yup, and Joi
//    → Schema-first validation

// 4. TypeScript inference: Types are automatically inferred from the schema
//    → Type-safe form development

// 5. DevTools: React Hook Form DevTools for real-time state inspection
//    → Easy debugging

// 6. Lightweight: ~9KB gzipped
//    → Minimal impact on bundle size
```

---

## 2. React Hook Form Basic Patterns

### 2.1 Installation and Setup

```bash
# Basic installation
npm install react-hook-form

# Zod validation integration
npm install zod @hookform/resolvers

# DevTools (development only)
npm install -D @hookform/devtools
```

### 2.2 Basic Form Implementation

```typescript
// React Hook Form: a performance-optimized form library
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// ========================================
// Step 1: Define the Zod schema
// ========================================
const userSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  email: z.string()
    .email('Please enter a valid email address'),
  age: z.coerce
    .number()
    .min(0, 'Age must be 0 or greater')
    .max(150, 'Age must be 150 or less')
    .optional(),
  role: z.enum(['user', 'admin', 'editor'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  agreed: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the terms of service' }),
  }),
});

// Step 2: Automatically infer the type
type UserFormData = z.infer<typeof userSchema>;
// Inferred type:
// {
//   name: string;
//   email: string;
//   age?: number | undefined;
//   role: "user" | "admin" | "editor";
//   agreed: true;
// }

// ========================================
// Step 3: Form component
// ========================================
function CreateUserForm() {
  const {
    register,       // Register an input as an uncontrolled component
    handleSubmit,   // Form submission handler (includes validation)
    formState: {
      errors,        // Validation error object
      isSubmitting,  // True while the form is being submitted
      isDirty,       // True if the form has been modified
      isValid,       // True if the form is valid
      dirtyFields,   // Fields that have been modified
      touchedFields, // Fields that have been touched
    },
    reset,          // Reset the form
    watch,          // Watch field values (triggers re-renders)
    setValue,       // Set a value programmatically
    getValues,      // Get values without triggering a re-render
    setError,       // Set an error manually
    clearErrors,    // Clear errors
    trigger,        // Manually trigger validation
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'user',
      agreed: false as any,
    },
    mode: 'onBlur',             // When to run validation
    reValidateMode: 'onChange', // When to re-run validation
  });

  // Submit handler
  const onSubmit = async (data: UserFormData) => {
    try {
      await api.users.create(data);
      reset(); // Reset the form
      toast.success('User created successfully');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', {
          message: 'This email address is already registered',
        });
      } else {
        toast.error('Failed to create user');
      }
    }
  };

  // Error handler (called when validation fails)
  const onError = (errors: FieldErrors<UserFormData>) => {
    console.error('Validation errors:', errors);
    // Focus the first error field (happens automatically)
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} noValidate>
      {/* Name field */}
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          type="text"
          {...register('name')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          aria-required="true"
          autoComplete="name"
          placeholder="Jane Doe"
        />
        {errors.name && (
          <p id="name-error" className="error-message" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Email field */}
      <div className="form-group">
        <label htmlFor="email">Email Address *</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-required="true"
          autoComplete="email"
          placeholder="example@example.com"
        />
        {errors.email && (
          <p id="email-error" className="error-message" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Age field (optional) */}
      <div className="form-group">
        <label htmlFor="age">Age</label>
        <input
          id="age"
          type="number"
          {...register('age')}
          aria-invalid={!!errors.age}
          aria-describedby={errors.age ? 'age-error' : 'age-hint'}
          min={0}
          max={150}
        />
        <p id="age-hint" className="hint-text">
          This field is optional
        </p>
        {errors.age && (
          <p id="age-error" className="error-message" role="alert">
            {errors.age.message}
          </p>
        )}
      </div>

      {/* Role selection */}
      <div className="form-group">
        <label htmlFor="role">Role *</label>
        <select
          id="role"
          {...register('role')}
          aria-invalid={!!errors.role}
        >
          <option value="user">User</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        {errors.role && (
          <p className="error-message" role="alert">
            {errors.role.message}
          </p>
        )}
      </div>

      {/* Terms of service agreement */}
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            {...register('agreed')}
            aria-invalid={!!errors.agreed}
          />
          <span>I agree to the Terms of Service *</span>
        </label>
        {errors.agreed && (
          <p className="error-message" role="alert">
            {errors.agreed.message}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

### 2.3 useForm Options in Detail

```typescript
// Full reference for useForm options
const form = useForm<FormData>({
  // Validation resolver
  resolver: zodResolver(schema),

  // Default values (can also be async)
  defaultValues: {
    name: '',
    email: '',
  },
  // Or fetch default values asynchronously:
  // defaultValues: async () => {
  //   const user = await fetchUser(userId);
  //   return user;
  // },

  // Validation mode
  mode: 'onBlur',
  // 'onSubmit'  - Only on submission (default)
  // 'onBlur'    - When a field loses focus
  // 'onChange'  - On every value change
  // 'onTouched' - onChange after the first blur
  // 'all'       - onBlur + onChange

  // Re-validation mode (after the first error)
  reValidateMode: 'onChange',
  // 'onBlur'    - When a field loses focus
  // 'onChange'  - On every value change (default)
  // 'onSubmit'  - Only on submission

  // Focus the first error field on submit
  shouldFocusError: true,

  // How to report multiple errors per field
  criteriaMode: 'firstError',
  // 'firstError' - Only the first error (default)
  // 'all'        - Collect all errors

  // Whether to keep fields registered after unmount
  shouldUnregister: false,

  // Whether to use native browser validation
  shouldUseNativeValidation: false,

  // Options for when default values change
  resetOptions: {
    keepDirtyValues: true,  // Keep values changed by the user
    keepErrors: false,
  },
});
```

### 2.4 register Options in Detail

```typescript
// Options for register()
<input
  {...register('fieldName', {
    // React Hook Form native validation (when not using Zod)
    required: 'This field is required',
    minLength: { value: 3, message: 'Must be at least 3 characters' },
    maxLength: { value: 100, message: 'Must be 100 characters or fewer' },
    min: { value: 0, message: 'Must be 0 or greater' },
    max: { value: 150, message: 'Must be 150 or less' },
    pattern: {
      value: /^[A-Za-z]+$/,
      message: 'Only letters are allowed',
    },
    validate: {
      // Custom validators (multiple can be defined)
      notAdmin: (v) => v !== 'admin' || 'The name "admin" is not allowed',
      unique: async (v) => {
        const exists = await checkUsername(v);
        return !exists || 'This username is already taken';
      },
    },
    // Transform the field value
    setValueAs: (v) => v.trim(),
    // Or convert to number:
    // valueAsNumber: true,
    // Or convert to Date:
    // valueAsDate: true,

    // Disable the field
    disabled: false,

    // onChange / onBlur event handlers
    onChange: (e) => console.log('Changed:', e.target.value),
    onBlur: (e) => console.log('Blurred:', e.target.value),

    // Dependent field validation
    deps: ['otherField'], // Re-validate this field when otherField changes
  })}
/>
```

### 2.5 Using watch and What to Watch Out For

```typescript
// watch: reactively observe field values
function ConditionalForm() {
  const { register, watch, control } = useForm<FormData>();

  // 1. Watch a specific field (triggers re-renders)
  const role = watch('role');

  // 2. Watch multiple fields
  const [firstName, lastName] = watch(['firstName', 'lastName']);

  // 3. Watch all fields (be careful with performance)
  // const allValues = watch();

  // 4. useWatch: isolate to a child component (recommended)
  // → Only that component re-renders when the watched field changes
  return (
    <form>
      <select {...register('role')}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      {/* Conditionally display a field */}
      {role === 'admin' && (
        <div>
          <label htmlFor="adminCode">Admin Code</label>
          <input
            id="adminCode"
            {...register('adminCode', { required: 'Admin code is required' })}
          />
        </div>
      )}

      {/* Isolated watch component using useWatch */}
      <PriceDisplay control={control} />
    </form>
  );
}

// useWatch: only this component re-renders
import { useWatch } from 'react-hook-form';

function PriceDisplay({ control }: { control: Control<FormData> }) {
  const [quantity, unitPrice] = useWatch({
    control,
    name: ['quantity', 'unitPrice'],
  });

  const total = (quantity || 0) * (unitPrice || 0);

  return (
    <div className="price-display">
      Total: ${total.toLocaleString()}
    </div>
  );
}
```

### 2.6 Using DevTools

```typescript
// React Hook Form DevTools
import { DevTool } from '@hookform/devtools';

function FormWithDevTools() {
  const { control, register, handleSubmit } = useForm();

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <input {...register('name')} />
        <input {...register('email')} />
        <button type="submit">Submit</button>
      </form>

      {/* Show only in development */}
      {process.env.NODE_ENV === 'development' && (
        <DevTool control={control} placement="top-right" />
      )}
    </>
  );
}

// Information available in DevTools:
// - Current form values
// - Validation errors
// - touched / dirty / valid states
// - Field registration status
// - Number of submissions and their results
```

---

## 3. Controlled / Uncontrolled Components

### 3.1 Understanding the Concepts

```
Uncontrolled Components:
  ┌────────────────────────────────────────┐
  │ The DOM manages the value              │
  │ A ref is registered via register()     │
  │ Better performance (no re-renders)     │
  │                                        │
  │ Use with: native HTML elements         │
  │   - <input type="text" />              │
  │   - <input type="email" />             │
  │   - <input type="number" />            │
  │   - <input type="checkbox" />          │
  │   - <input type="radio" />             │
  │   - <select />                         │
  │   - <textarea />                       │
  └────────────────────────────────────────┘

Controlled Components:
  ┌────────────────────────────────────────┐
  │ React manages the value                │
  │ Integrated with React Hook Form via    │
  │ Controller                             │
  │ Required for custom UI components      │
  │                                        │
  │ Use with: custom / third-party UI      │
  │   - DatePicker                         │
  │   - Autocomplete                       │
  │   - Rich Text Editor                   │
  │   - shadcn/ui components               │
  │   - Material UI components             │
  │   - Radix UI Primitives               │
  └────────────────────────────────────────┘
```

### 3.2 Uncontrolled Component Pattern

```typescript
// Uncontrolled component: using register()
function UncontrolledExample() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      username: '',
      bio: '',
      newsletter: false,
      category: 'general',
      priority: 'medium',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Text input */}
      <input type="text" {...register('username')} />

      {/* Textarea */}
      <textarea {...register('bio')} rows={5} />

      {/* Checkbox */}
      <label>
        <input type="checkbox" {...register('newsletter')} />
        Subscribe to newsletter
      </label>

      {/* Select box */}
      <select {...register('category')}>
        <option value="general">General</option>
        <option value="tech">Technology</option>
        <option value="design">Design</option>
      </select>

      {/* Radio buttons */}
      <fieldset>
        <legend>Priority</legend>
        <label>
          <input type="radio" value="low" {...register('priority')} />
          Low
        </label>
        <label>
          <input type="radio" value="medium" {...register('priority')} />
          Medium
        </label>
        <label>
          <input type="radio" value="high" {...register('priority')} />
          High
        </label>
      </fieldset>

      <button type="submit">Submit</button>
    </form>
  );
}
```

### 3.3 Controlled Component Pattern

```typescript
// Using Controller: integrating custom UI components
import { Controller, useForm } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { DatePicker } from '@/shared/components/ui/date-picker';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { Combobox } from '@/shared/components/ui/combobox';

interface ProjectFormData {
  projectName: string;
  category: string;
  startDate: Date;
  budget: number;
  isPublic: boolean;
  assignee: { id: string; name: string } | null;
}

function ProjectForm() {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormData>({
    defaultValues: {
      projectName: '',
      category: '',
      startDate: new Date(),
      budget: 50,
      isPublic: false,
      assignee: null,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Uncontrolled: native input */}
      <input {...register('projectName')} />

      {/* Controlled: shadcn/ui Select */}
      <Controller
        name="category"
        control={control}
        rules={{ required: 'Please select a category' }}
        render={({ field, fieldState: { error } }) => (
          <div>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
            >
              <SelectTrigger aria-invalid={!!error}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Web Development</SelectItem>
                <SelectItem value="mobile">Mobile Development</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
            {error && (
              <p className="error-message" role="alert">
                {error.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Controlled: DatePicker */}
      <Controller
        name="startDate"
        control={control}
        rules={{ required: 'Please select a start date' }}
        render={({ field, fieldState: { error } }) => (
          <div>
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={!!error}
            />
            {error && (
              <p className="error-message" role="alert">
                {error.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Controlled: Slider */}
      <Controller
        name="budget"
        control={control}
        render={({ field }) => (
          <div>
            <label>Budget: {field.value}%</label>
            <Slider
              value={[field.value]}
              onValueChange={(vals) => field.onChange(vals[0])}
              min={0}
              max={100}
              step={10}
            />
          </div>
        )}
      />

      {/* Controlled: Switch */}
      <Controller
        name="isPublic"
        control={control}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              id="is-public"
            />
            <label htmlFor="is-public">Public project</label>
          </div>
        )}
      />

      {/* Controlled: Combobox (select with search) */}
      <Controller
        name="assignee"
        control={control}
        render={({ field }) => (
          <Combobox
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            options={members}
            placeholder="Search for an assignee..."
            displayValue={(item) => item?.name || ''}
          />
        )}
      />

      <button type="submit">Create</button>
    </form>
  );
}
```

### 3.4 Decision Flow: Controlled vs. Uncontrolled

```
What type of field is it?
│
├─ Native HTML element (input, select, textarea)
│  │
│  ├─ Need to display the value in real time?
│  │  ├─ YES → Use watch() or useWatch() (still uncontrolled)
│  │  └─ NO  → Use register() only (uncontrolled)
│  │
│  └─ → Uncontrolled component: register()
│
├─ Third-party UI component
│  │
│  ├─ Does it support ref?
│  │  ├─ YES → Try register() first (may work as uncontrolled)
│  │  └─ NO  → Controller is required
│  │
│  └─ → Controlled component: Controller
│
└─ Custom component
   │
   ├─ Does it forward ref with forwardRef?
   │  ├─ YES → register() can be used
   │  └─ NO  → Controller is needed
   │
   └─ → Usually a controlled component: Controller
```

### 3.5 Performance Comparison

```typescript
// Rendering behavior of uncontrolled vs. controlled components
// When a user types "hello" into an input:
//
// Uncontrolled (register):
//   Initial render:  1
//   While typing:    0 (the DOM manages the value directly)
//   On submit:       1
//   Total:           2
//
// Controlled (Controller + onChange):
//   Initial render:  1
//   While typing:    5 ("h", "he", "hel", "hell", "hello")
//   On submit:       1
//   Total:           7

// → When there are many fields, uncontrolled is significantly more efficient
// → However, controlled components can also be optimized with React.memo

// Performance optimization: isolate useWatch into a separate component
function OptimizedForm() {
  const { register, control, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* These do not re-render */}
      <input {...register('field1')} />
      <input {...register('field2')} />
      <input {...register('field3')} />
      <input {...register('field4')} />

      {/* Only this child component re-renders */}
      <WatchedFieldDisplay control={control} />

      <button type="submit">Submit</button>
    </form>
  );
}

function WatchedFieldDisplay({ control }: { control: Control }) {
  // Only this component re-renders when field1 changes
  const field1Value = useWatch({ control, name: 'field1' });
  return <div>Field 1 value: {field1Value}</div>;
}
```

---

## 4. Advanced Form Patterns

### 4.1 Dynamic Field Arrays (useFieldArray)

```typescript
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema definition
const orderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Please select a product'),
      quantity: z.coerce.number().min(1, 'Must be at least 1'),
      price: z.coerce.number().min(0, 'Must be 0 or greater'),
      note: z.string().optional(),
    })
  ).min(1, 'Please add at least one item'),
  discount: z.coerce.number().min(0).max(100).default(0),
});

type OrderFormData = z.infer<typeof orderSchema>;

function OrderForm() {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: '',
      items: [{ productId: '', quantity: 1, price: 0, note: '' }],
      discount: 0,
    },
  });

  const { fields, append, remove, move, swap, insert } = useFieldArray({
    control,
    name: 'items',
  });

  const onSubmit = (data: OrderFormData) => {
    console.log('Order:', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="customerName">Customer Name</label>
        <input id="customerName" {...register('customerName')} />
        {errors.customerName && (
          <p className="error-message" role="alert">
            {errors.customerName.message}
          </p>
        )}
      </div>

      <h3>Order Items</h3>

      {fields.map((field, index) => (
        <div key={field.id} className="item-row">
          {/* Use field.id as the key (not index) */}
          <div>
            <label>Product</label>
            <select {...register(`items.${index}.productId`)}>
              <option value="">Please select</option>
              <option value="prod-1">Product A - $10.00</option>
              <option value="prod-2">Product B - $20.00</option>
              <option value="prod-3">Product C - $30.00</option>
            </select>
            {errors.items?.[index]?.productId && (
              <p className="error-message" role="alert">
                {errors.items[index]?.productId?.message}
              </p>
            )}
          </div>

          <div>
            <label>Quantity</label>
            <input
              type="number"
              min={1}
              {...register(`items.${index}.quantity`)}
            />
          </div>

          <div>
            <label>Unit Price</label>
            <input
              type="number"
              min={0}
              {...register(`items.${index}.price`)}
            />
          </div>

          <div>
            <label>Note</label>
            <input {...register(`items.${index}.note`)} />
          </div>

          <button
            type="button"
            onClick={() => remove(index)}
            disabled={fields.length <= 1}
            aria-label={`Remove item ${index + 1}`}
          >
            Remove
          </button>

          {/* Reorder buttons */}
          <button
            type="button"
            onClick={() => move(index, Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label="Move up"
          >
            Up
          </button>
          <button
            type="button"
            onClick={() => move(index, Math.min(fields.length - 1, index + 1))}
            disabled={index === fields.length - 1}
            aria-label="Move down"
          >
            Down
          </button>
        </div>
      ))}

      {/* Array-level error */}
      {errors.items?.root && (
        <p className="error-message" role="alert">
          {errors.items.root.message}
        </p>
      )}

      <button
        type="button"
        onClick={() => append({ productId: '', quantity: 1, price: 0, note: '' })}
      >
        Add Item
      </button>

      {/* Order total display */}
      <OrderTotal control={control} />

      <button type="submit">Place Order</button>
    </form>
  );
}

// Order total component (isolated with useWatch)
function OrderTotal({ control }: { control: Control<OrderFormData> }) {
  const items = useWatch({ control, name: 'items' });
  const discount = useWatch({ control, name: 'discount' });

  const subtotal = items.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.price || 0);
  }, 0);

  const total = subtotal * (1 - (discount || 0) / 100);

  return (
    <div className="order-total">
      <p>Subtotal: ${subtotal.toLocaleString()}</p>
      <p>Discount: {discount}%</p>
      <p className="total">Total: ${Math.floor(total).toLocaleString()}</p>
    </div>
  );
}
```

### 4.2 Multi-Step Forms

```typescript
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

// Schema for each step
const step1Schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
});

const step2Schema = z.object({
  company: z.string().min(1, 'Company name is required'),
  position: z.string().min(1, 'Position is required'),
  department: z.string().optional(),
});

const step3Schema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  paymentMethod: z.enum(['credit', 'invoice']).optional(),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the terms of service' }),
  }),
});

// Combined schema
const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FullFormData = z.infer<typeof fullSchema>;

// Validation schemas per step
const stepSchemas = [step1Schema, step2Schema, step3Schema];

// Field names per step
const stepFields: (keyof FullFormData)[][] = [
  ['firstName', 'lastName', 'email'],
  ['company', 'position', 'department'],
  ['plan', 'paymentMethod', 'agreeToTerms'],
];

function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 3;

  const methods = useForm<FullFormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      company: '',
      position: '',
      department: '',
      plan: 'free',
      agreeToTerms: false as any,
    },
    mode: 'onBlur',
  });

  const { trigger, handleSubmit, formState: { isSubmitting } } = methods;

  // Advance to the next step
  const handleNext = async () => {
    // Validate only the fields on the current step
    const fieldsToValidate = stepFields[currentStep];
    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  // Go back to the previous step
  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (data: FullFormData) => {
    try {
      await api.registration.submit(data);
      toast.success('Registration complete');
    } catch (error) {
      toast.error('Registration failed');
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Progress bar */}
        <div className="progress-bar" role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        >
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`step ${i <= currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
              aria-current={i === currentStep ? 'step' : undefined}
            >
              <span className="step-number">{i + 1}</span>
              <span className="step-label">
                {['Basic Info', 'Company Info', 'Plan Selection'][i]}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="step-content">
          {currentStep === 0 && <Step1BasicInfo />}
          {currentStep === 1 && <Step2CompanyInfo />}
          {currentStep === 2 && <Step3PlanSelection />}
        </div>

        {/* Navigation buttons */}
        <div className="step-navigation">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Back
          </button>

          {currentStep < totalSteps - 1 ? (
            <button type="button" onClick={handleNext}>
              Next
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Register'}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}

// Step 1: Basic Info
function Step1BasicInfo() {
  const { register, formState: { errors } } = useFormContext<FullFormData>();

  return (
    <div>
      <h2>Basic Info</h2>
      <div>
        <label htmlFor="firstName">First Name *</label>
        <input id="firstName" {...register('firstName')} />
        {errors.firstName && (
          <p className="error-message" role="alert">
            {errors.firstName.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="lastName">Last Name *</label>
        <input id="lastName" {...register('lastName')} />
        {errors.lastName && (
          <p className="error-message" role="alert">
            {errors.lastName.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="email">Email Address *</label>
        <input id="email" type="email" {...register('email')} />
        {errors.email && (
          <p className="error-message" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>
    </div>
  );
}
```
        )}
      </div>
    </div>
  );
}

// Step 2: Company Info
function Step2CompanyInfo() {
  const { register, formState: { errors } } = useFormContext<FullFormData>();

  return (
    <div>
      <h2>Company Info</h2>
      <div>
        <label htmlFor="company">Company Name *</label>
        <input id="company" {...register('company')} />
        {errors.company && (
          <p className="error-message" role="alert">
            {errors.company.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="position">Position *</label>
        <input id="position" {...register('position')} />
        {errors.position && (
          <p className="error-message" role="alert">
            {errors.position.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="department">Department</label>
        <input id="department" {...register('department')} />
      </div>
    </div>
  );
}

// Step 3: Plan Selection
function Step3PlanSelection() {
  const { register, watch, formState: { errors } } = useFormContext<FullFormData>();
  const plan = watch('plan');

  return (
    <div>
      <h2>Plan Selection</h2>
      <fieldset>
        <legend>Choose a Plan *</legend>
        <label className="plan-option">
          <input type="radio" value="free" {...register('plan')} />
          <span>Free - $0/month</span>
        </label>
        <label className="plan-option">
          <input type="radio" value="pro" {...register('plan')} />
          <span>Pro - $9.80/month</span>
        </label>
        <label className="plan-option">
          <input type="radio" value="enterprise" {...register('plan')} />
          <span>Enterprise - Contact us</span>
        </label>
      </fieldset>

      {plan !== 'free' && (
        <div>
          <label htmlFor="paymentMethod">Payment Method</label>
          <select id="paymentMethod" {...register('paymentMethod')}>
            <option value="credit">Credit Card</option>
            <option value="invoice">Invoice</option>
          </select>
        </div>
      )}

      <label className="checkbox-label">
        <input type="checkbox" {...register('agreeToTerms')} />
        <span>I agree to the Terms of Service *</span>
      </label>
      {errors.agreeToTerms && (
        <p className="error-message" role="alert">
          {errors.agreeToTerms.message}
        </p>
      )}
    </div>
  );
}
```

### 4.3 Nested Forms (FormProvider)

```typescript
// Splitting components with FormProvider
import { FormProvider, useForm, useFormContext } from 'react-hook-form';

// Parent component
function ParentForm() {
  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      personal: { name: '', email: '' },
      address: { zip: '', prefecture: '', city: '', street: '' },
      preferences: { theme: 'light', language: 'en', notifications: true },
    },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <PersonalInfoSection />
        <AddressSection />
        <PreferencesSection />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

// Child component: access the parent form via useFormContext
function PersonalInfoSection() {
  const { register, formState: { errors } } = useFormContext<ProfileFormData>();

  return (
    <fieldset>
      <legend>Personal Information</legend>
      <input {...register('personal.name')} />
      {errors.personal?.name && (
        <p className="error-message">{errors.personal.name.message}</p>
      )}
      <input {...register('personal.email')} />
      {errors.personal?.email && (
        <p className="error-message">{errors.personal.email.message}</p>
      )}
    </fieldset>
  );
}

// Address section (example of auto-filling address from postal code)
function AddressSection() {
  const { register, setValue, formState: { errors } } = useFormContext<ProfileFormData>();

  const handleZipCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const zip = e.target.value.replace(/[^0-9]/g, '');
    if (zip.length === 5) {
      try {
        const address = await fetchAddressFromZipCode(zip);
        setValue('address.state', address.state, { shouldValidate: true });
        setValue('address.city', address.city, { shouldValidate: true });
      } catch {
        // Address lookup failed - prompt the user to enter manually
      }
    }
  };

  return (
    <fieldset>
      <legend>Address</legend>
      <input
        {...register('address.zip')}
        onChange={(e) => {
          register('address.zip').onChange(e); // Also fire the RHF event
          handleZipCodeChange(e);
        }}
        placeholder="12345"
        inputMode="numeric"
      />
      <input {...register('address.state')} placeholder="California" />
      <input {...register('address.city')} placeholder="San Francisco" />
      <input {...register('address.street')} placeholder="123 Main St" />
    </fieldset>
  );
}
```

---

## 5. Integration with Server Actions

### 5.1 Basic Server Actions Integration

```typescript
// React Hook Form + Server Actions
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUser } from './actions';
import { useTransition } from 'react';

// Server Action side (actions.ts)
// 'use server';
// import { z } from 'zod';
// import { userSchema } from './schema';
//
// export async function createUser(formData: FormData) {
//   const rawData = Object.fromEntries(formData.entries());
//   const result = userSchema.safeParse(rawData);
//
//   if (!result.success) {
//     return {
//       success: false,
//       errors: result.error.flatten().fieldErrors,
//     };
//   }
//
//   try {
//     await db.user.create({ data: result.data });
//     return { success: true };
//   } catch (error) {
//     return {
//       success: false,
//       errors: { _form: ['Failed to create user'] },
//     };
//   }
// }

function CreateUserForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  return (
    <form
      action={async (formData) => {
        // Step 1: Client-side validation
        const valid = await form.trigger();
        if (!valid) return;

        // Step 2: Execute the Server Action
        startTransition(async () => {
          const result = await createUser(formData);

          if (result?.errors) {
            // Step 3: Reflect server-side errors in the form
            for (const [field, messages] of Object.entries(result.errors)) {
              if (field === '_form') {
                // Form-level error
                toast.error(messages[0]);
              } else {
                form.setError(field as any, { message: messages[0] });
              }
            }
          } else if (result?.success) {
            form.reset();
            toast.success('User created successfully');
          }
        });
      }}
    >
      <div>
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          {...form.register('name')}
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name && (
          <p className="error-message" role="alert">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email Address *</label>
        <input
          id="email"
          type="email"
          {...form.register('email')}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email && (
          <p className="error-message" role="alert">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

### 5.2 Integration with useActionState (React 19)

```typescript
// Pattern using useActionState from React 19
'use client';
import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Return type of the Server Action
interface ActionState {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}

function CreateUserFormWithActionState() {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  // Manage Server Action state with useActionState
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (prevState, formData) => {
      // Client-side validation
      const valid = await form.trigger();
      if (!valid) {
        return { success: false, message: 'Validation error' };
      }

      // Call the Server Action
      const result = await createUser(formData);

      if (!result.success && result.errors) {
        // Reflect server errors in the form
        for (const [field, messages] of Object.entries(result.errors)) {
          form.setError(field as keyof UserFormData, {
            message: messages[0],
          });
        }
      }

      return result;
    },
    { success: false }
  );

  return (
    <form action={formAction}>
      {/* Form fields */}
      <input {...form.register('name')} />
      <input {...form.register('email')} />

      {/* Success message from the server */}
      {state.success && (
        <div className="success-message" role="status">
          {state.message || 'User created successfully'}
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

### 5.3 Progressive Enhancement

```typescript
// Form design that works even without JavaScript
// Server Actions natively support progressive enhancement

// Pattern 1: Server Action only (works without JS)
async function submitForm(formData: FormData) {
  'use server';
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  // Server-side validation
  if (!name || !email) {
    redirect('/form?error=validation');
  }

  await db.user.create({ data: { name, email } });
  redirect('/users');
}

// Pattern 2: React Hook Form + Server Actions (client-side validation when JS is enabled)
function ProgressiveForm() {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  return (
    <form
      action={submitForm}                    // When JS is disabled: Server Action runs directly
      onSubmit={form.handleSubmit(           // When JS is enabled: client-side validation runs first
        async (data) => {
          const formData = new FormData();
          Object.entries(data).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
          await submitForm(formData);
        }
      )}
    >
      <input name="name" {...form.register('name')} />
      <input name="email" type="email" {...form.register('email')} />

      {/* Show a message when JavaScript is disabled */}
      <noscript>
        <p className="info-text">
          When JavaScript is disabled, validation is handled server-side.
        </p>
      </noscript>

      <button type="submit">Submit</button>
    </form>
  );
}
```

### 5.4 Optimistic Updates Pattern

```typescript
// Optimistic updates using useOptimistic
'use client';
import { useOptimistic } from 'react';
import { useForm } from 'react-hook-form';

interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  isPending?: boolean;
}

function CommentForm({ comments }: { comments: Comment[] }) {
  const form = useForm<{ text: string }>({
    defaultValues: { text: '' },
  });

  const [optimisticComments, addOptimisticComment] = useOptimistic<
    Comment[],
    Comment
  >(
    comments,
    (state, newComment) => [...state, newComment]
  );

  return (
    <div>
      {/* Comment list */}
      <ul>
        {optimisticComments.map((comment) => (
          <li key={comment.id} className={comment.isPending ? 'opacity-50' : ''}>
            <p>{comment.text}</p>
            <span>{comment.author}</span>
            {comment.isPending && <span className="badge">Posting...</span>}
          </li>
        ))}
      </ul>

      {/* Comment submission form */}
      <form
        action={async (formData) => {
          const text = formData.get('text') as string;

          // Optimistically update the UI (show immediately)
          addOptimisticComment({
            id: `temp-${Date.now()}`,
            text,
            author: currentUser.name,
            createdAt: new Date().toISOString(),
            isPending: true,
          });

          form.reset();

          // Persist with a Server Action
          await addComment(formData);
        }}
      >
        <textarea {...form.register('text')} name="text" required />
        <button type="submit">Post Comment</button>
      </form>
    </div>
  );
}
```

---

## 6. Form UX Best Practices

### 6.1 Designing Validation Timing

```
Validation Timing Strategy:

Recommended pattern: "On submit → real-time afterwards"

1. First input:
   ✗ Do not show errors yet
   ✗ Do not validate the moment the form opens
   → The user has not finished typing yet

2. First submission attempt:
   ✓ Validate all fields
   ✓ Focus the first field with an error
   → The user has indicated they are done with input

3. After first submission, while editing:
   ✓ Real-time validation via onChange / onBlur
   ✓ Clear error messages immediately once corrected
   → Feedback for the user as they fix errors

React Hook Form configuration:
  mode: 'onSubmit'           → Validate only on submission
  reValidateMode: 'onChange' → Real-time validation after first submit
  or
  mode: 'onBlur'             → Validate when a field loses focus
  reValidateMode: 'onChange' → Real-time validation after an error appears
```

### 6.2 Designing Error Messages

```typescript
// Error message design principles

// Good error messages:
// 1. Specifically describe what the problem is
// 2. Show how to fix it
// 3. Do not blame the user

const goodMessages = {
  required: 'Please enter your name',
  email: 'Please enter a valid email address (e.g. user@example.com)',
  minLength: 'Password must be at least 8 characters',
  pattern: 'Only alphanumeric characters are allowed',
  unique: 'This email is already registered. Would you like to log in?',
};

// Bad error messages:
const badMessages = {
  required: 'Input error',            // Unclear what the problem is
  email: 'Invalid email',             // No guidance on how to fix it
  minLength: 'Error: too short',      // Too technical
  pattern: 'Invalid input',           // Too vague
  unique: 'Error: 409 Conflict',      // Exposes an HTTP status code
};

// Error message component
function FieldError({ error }: { error?: FieldError }) {
  if (!error) return null;

  return (
    <div className="field-error" role="alert" aria-live="assertive">
      <svg className="error-icon" aria-hidden="true" /* ... */ />
      <span>{error.message}</span>
    </div>
  );
}
```

### 6.3 Managing Submission State

```typescript
// Preventing double submission and displaying a loading state
function SubmitButton({
  isSubmitting,
  isDirty,
  isValid,
  label = 'Submit',
}: {
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  label?: string;
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting || !isDirty}
      aria-busy={isSubmitting}
      aria-disabled={isSubmitting || !isDirty}
      className={cn(
        'submit-button',
        isSubmitting && 'loading',
        !isDirty && 'disabled',
      )}
    >
      {isSubmitting ? (
        <>
          <Spinner aria-hidden="true" />
          <span>Submitting...</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
```

### 6.4 Unsaved Changes Warning

```typescript
// Warn the user before navigating away
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function useUnsavedChangesWarning(isDirty: boolean) {
  const router = useRouter();

  useEffect(() => {
    // Native browser navigation warning
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Navigation warning for Next.js App Router
  useEffect(() => {
    if (!isDirty) return;

    const originalPush = router.push;

    router.push = (...args) => {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (confirmed) {
        originalPush.apply(router, args);
      }
    };

    return () => {
      router.push = originalPush;
    };
  }, [isDirty, router]);
}

// Usage in a form
function EditForm() {
  const { register, handleSubmit, formState: { isDirty } } = useForm();

  // Enable the navigation warning
  useUnsavedChangesWarning(isDirty);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {isDirty && (
        <div className="unsaved-banner" role="status">
          You have unsaved changes
        </div>
      )}
      {/* Form fields */}
    </form>
  );
}
```

### 6.5 Form Layout Best Practices

```
Form Layout Principles:

1. Use a single-column layout as the default
   ✓ Natural top-to-bottom reading flow
   ✓ Works on mobile as-is
   ✗ Two columns only for related fields (e.g. first/last name, city/state)

2. Label placement
   ✓ Above the field (recommended): easy to read, mobile-friendly
   △ Left of the field: aligned on desktop but can break on mobile
   ✗ Inside the field (placeholder only): disappears after typing

3. Required / optional indicators
   ✓ When most fields are required: mark optional fields with "(optional)"
   ✓ When most fields are optional: mark required fields with "*"
   ✗ Using "*" alone without explanation

4. Grouping
   ✓ Group related fields with fieldset + legend
   ✓ Visually separate groups with spacing or borders
   ✓ Add section headings

5. Mobile support
   ✓ Set inputMode appropriately (numeric, tel, email, url)
   ✓ Set autoComplete (supports browser autofill)
   ✓ Touch target size should be at least 44x44px
   ✓ Prevent zoom: set font-size to 16px or larger
```

```css
/* Mobile-friendly form CSS */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem; /* 16px or larger prevents iOS zoom */
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input[aria-invalid="true"] {
  border-color: #ef4444;
}

.form-group input[aria-invalid="true"]:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.error-message {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.hint-text {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
}

/* Minimum touch target size */
.checkbox-label,
.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  cursor: pointer;
}

/* Mobile optimization */
@media (max-width: 640px) {
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 0.875rem 1rem;
  }
}
```

---

## 7. Accessibility (a11y)

### 7.1 Correct Use of ARIA Attributes

```typescript
// Accessible form field component
interface FormFieldProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  register: UseFormRegister<any>;
}

function FormField({
  name,
  label,
  type = 'text',
  required = false,
  hint,
  error,
  register,
}: FormFieldProps) {
  const fieldId = `field-${name}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  // Build the aria-describedby value
  const describedBy = [
    hint ? hintId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-field">
      {/* Label */}
      <label htmlFor={fieldId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true"> *</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {/* Hint text */}
      {hint && (
        <p id={hintId} className="hint-text">
          {hint}
        </p>
      )}

      {/* Input field */}
      <input
        id={fieldId}
        type={type}
        {...register(name)}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={describedBy}
      />

      {/* Error message */}
      {error && (
        <p id={errorId} className="error-message" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}
```

### 7.2 Keyboard Navigation

```typescript
// Keyboard navigation support
// Key principles:
// 1. All fields must be reachable via the Tab key
// 2. Enter submits the form
// 3. Escape closes a modal form
// 4. Space toggles checkboxes/radio buttons

function AccessibleForm() {
  const formRef = useRef<HTMLFormElement>(null);

  // Custom keyboard event handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Ctrl+Enter to submit (useful when textarea is present)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }

    // Escape to reset the form
    if (e.key === 'Escape') {
      const confirmed = window.confirm('Reset all input? This cannot be undone.');
      if (confirmed) {
        form.reset();
      }
    }
  };

  return (
    <form
      ref={formRef}
      onKeyDown={handleKeyDown}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {/* Be careful with tabIndex order */}
      <input {...form.register('name')} tabIndex={1} />
      <input {...form.register('email')} tabIndex={2} />
      <textarea {...form.register('message')} tabIndex={3} />

      {/* Skip link: useful for long forms */}
      <a href="#form-actions" className="sr-only focus:not-sr-only">
        Skip to submit button
      </a>

      <div id="form-actions">
        <button type="submit" tabIndex={4}>Submit</button>
        <button type="button" tabIndex={5} onClick={() => form.reset()}>
          Reset
        </button>
      </div>
    </form>
  );
}
```

### 7.3 Screen Reader Support

```typescript
// Optimizations for screen readers

// 1. Live regions: announce dynamic error messages
function LiveErrorSummary({ errors }: { errors: FieldErrors }) {
  const errorMessages = Object.entries(errors)
    .map(([field, error]) => `${field}: ${error?.message}`)
    .join('. ');

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    >
      {errorMessages && `The form has ${Object.keys(errors).length} error(s). ${errorMessages}`}
    </div>
  );
}

// 2. Error summary: display a list of errors at the top of the form
function ErrorSummary({ errors }: { errors: FieldErrors }) {
  const errorList = Object.entries(errors);
  if (errorList.length === 0) return null;

  return (
    <div
      role="alert"
      aria-labelledby="error-summary-title"
      className="error-summary"
      tabIndex={-1}
      ref={(el) => el?.focus()} // Focus when errors appear
    >
      <h3 id="error-summary-title">
        {errorList.length} input error(s) found
      </h3>
      <ul>
        {errorList.map(([field, error]) => (
          <li key={field}>
            <a href={`#field-${field}`}>
              {error?.message as string}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 3. Form completion notification
function FormSuccessMessage({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="success-message"
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      Your form was submitted successfully
    </div>
  );
}
```

### 7.4 Complete Guide to autoComplete

```html
<!-- autoComplete attribute reference -->
<!-- Important for enabling correct browser autofill behavior -->

<!-- Name -->
<input autoComplete="name" />           <!-- Full name -->
<input autoComplete="given-name" />     <!-- First name -->
<input autoComplete="family-name" />    <!-- Last name -->
<input autoComplete="honorific-prefix" /> <!-- Title/salutation -->

<!-- Contact -->
<input autoComplete="email" />
<input autoComplete="tel" />            <!-- Phone number -->
<input autoComplete="tel-national" />   <!-- Domestic phone number -->

<!-- Address -->
<input autoComplete="postal-code" />    <!-- Postal / ZIP code -->
<input autoComplete="address-level1" /> <!-- State / province -->
<input autoComplete="address-level2" /> <!-- City -->
<input autoComplete="street-address" /> <!-- Street address -->
<input autoComplete="country" />        <!-- Country -->

<!-- Account -->
<input autoComplete="username" />
<input autoComplete="new-password" />   <!-- New password -->
<input autoComplete="current-password" /> <!-- Current password -->

<!-- Payment -->
<input autoComplete="cc-name" />        <!-- Cardholder name -->
<input autoComplete="cc-number" />      <!-- Card number -->
<input autoComplete="cc-exp" />         <!-- Expiry date -->
<input autoComplete="cc-csc" />         <!-- Security code -->

<!-- Other -->
<input autoComplete="organization" />   <!-- Organization name -->
<input autoComplete="organization-title" /> <!-- Job title -->
<input autoComplete="bday" />           <!-- Date of birth -->
<input autoComplete="sex" />            <!-- Gender -->
<input autoComplete="url" />            <!-- URL -->

<!-- Disable autofill -->
<input autoComplete="off" />            <!-- Standard approach -->
<!-- Note: some browsers ignore "off" -->
<!-- In that case, use a unique value: -->
<input autoComplete="nope" />
```

### 7.5 WCAG 2.1 Compliance Checklist

```
Form WCAG 2.1 Compliance Checklist:

Level A (required):
  [x] All form controls have an associated label (1.3.1)
  [x] Errors are described in text when they occur (3.3.1)
  [x] The purpose of each form control can be determined (1.3.5)
  [x] All functionality is operable via keyboard alone (2.1.1)
  [x] Focus is visible (2.4.7)
  [x] Context changes are predictable (3.2.1, 3.2.2)

Level AA (recommended):
  [x] Error correction suggestions are provided (3.3.3)
  [x] Legal or financial submissions can be confirmed or reversed (3.3.4)
  [x] Text contrast ratio is at least 4.5:1 (1.4.3)
  [x] Target size is at least 24x24px (2.5.8)
  [x] Focus indicator is sufficiently visible (2.4.11)

Level AAA (ideal):
  [x] Help is available (3.3.5)
  [x] Target size is at least 44x44px (2.5.5)
  [x] Text contrast ratio is at least 7:1 (1.4.6)
```

---

## 8. Performance Optimization

### 8.1 Minimizing Re-renders

```typescript
// Performance optimization patterns

// Pattern 1: Isolate watched values with useWatch
// → Only the component that uses useWatch re-renders when the watched field changes
import { useWatch } from 'react-hook-form';

// Bad: the entire parent component re-renders
function BadForm() {
  const { register, watch, handleSubmit } = useForm();
  const name = watch('name'); // Causes the entire parent to re-render

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      <input {...register('email')} />    {/* Also re-renders on name change */}
      <input {...register('phone')} />    {/* Also re-renders on name change */}
      <input {...register('address')} />  {/* Also re-renders on name change */}
      <p>Preview: {name}</p>
    </form>
  );
}

// Good: only the child component re-renders
function GoodForm() {
  const { register, control, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      <input {...register('email')} />    {/* Does not re-render on name change */}
      <input {...register('phone')} />    {/* Does not re-render on name change */}
      <input {...register('address')} />  {/* Does not re-render on name change */}
      <NamePreview control={control} />   {/* Only this re-renders */}
    </form>
  );
}

function NamePreview({ control }: { control: Control }) {
  const name = useWatch({ control, name: 'name' });
  return <p>Preview: {name}</p>;
}

// Pattern 2: Memoize field components with React.memo
const MemoizedField = React.memo(function MemoizedField({
  name,
  register,
  error,
}: {
  name: string;
  register: UseFormRegister<any>;
  error?: FieldError;
}) {
  console.log(`${name} rendered`); // For debugging

  return (
    <div>
      <label htmlFor={name}>{name}</label>
      <input id={name} {...register(name)} />
      {error && <p className="error-message">{error.message}</p>}
    </div>
  );
});

// Pattern 3: Subscribe only to the state you need with useFormState
import { useFormState } from 'react-hook-form';

function SubmitButtonOptimized({ control }: { control: Control }) {
  // Only re-renders when isSubmitting changes
  const { isSubmitting, isDirty } = useFormState({
    control,
    name: ['isSubmitting', 'isDirty'], // Limit the subscribed state
  });

  return (
    <button type="submit" disabled={isSubmitting || !isDirty}>
      {isSubmitting ? 'Submitting...' : 'Submit'}
    </button>
  );
}
```

### 8.2 Optimizing for Large Numbers of Fields

```typescript
// Optimization strategies when there are many fields

// Strategy 1: Virtualization
// → Render only the fields currently visible on screen
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedFieldList() {
  const { register, control } = useForm();
  const parentRef = useRef<HTMLDivElement>(null);

  const fieldNames = Array.from({ length: 1000 }, (_, i) => `field_${i}`);

  const virtualizer = useVirtualizer({
    count: fieldNames.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated height of each field
    overscan: 5, // Pre-render 5 fields outside the viewport
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const fieldName = fieldNames[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <input {...register(fieldName)} placeholder={fieldName} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Strategy 2: Section splitting with lazy loading
function SectionedForm() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['basic'])
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <form>
      {/* Each section can be collapsed */}
      <details open={expandedSections.has('basic')}>
        <summary onClick={() => toggleSection('basic')}>Basic Information</summary>
        <BasicInfoFields />
      </details>

      <details open={expandedSections.has('contact')}>
        <summary onClick={() => toggleSection('contact')}>Contact</summary>
        {/* Render only when expanded */}
        {expandedSections.has('contact') && <ContactFields />}
      </details>

      <details open={expandedSections.has('preferences')}>
        <summary onClick={() => toggleSection('preferences')}>Preferences</summary>
        {expandedSections.has('preferences') && <PreferenceFields />}
      </details>
    </form>
  );
}

// Strategy 3: Debounced validation
function DebouncedValidation() {
  const { register, trigger } = useForm({
    mode: 'onChange',
  });

  const debouncedValidate = useMemo(
    () =>
      debounce((fieldName: string) => {
        trigger(fieldName);
      }, 300),
    [trigger]
  );

  return (
    <input
      {...register('search', {
        onChange: (e) => {
          debouncedValidate('search');
        },
      })}
    />
  );
}
```

### 8.3 Bundle Size Optimization

```typescript
// Bundle size optimization

// 1. Lazy-load the form with dynamic import
const EditProfileForm = lazy(() => import('./EditProfileForm'));

function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      {isEditing ? (
        <Suspense fallback={<FormSkeleton />}>
          <EditProfileForm onCancel={() => setIsEditing(false)} />
        </Suspense>
      ) : (
        <ProfileDisplay onEdit={() => setIsEditing(true)} />
      )}
    </div>
  );
}

// 2. Split Zod schemas
// Split large schemas to benefit from tree-shaking
// schema/user.ts
export const userBasicSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// schema/user-extended.ts
// Import only when needed
export const userExtendedSchema = userBasicSchema.extend({
  address: addressSchema,
  preferences: preferencesSchema,
});

// 3. Dynamically import the resolver
async function loadResolver() {
  const { zodResolver } = await import('@hookform/resolvers/zod');
  return zodResolver;
}
```

---

## 9. Testing Strategy

### 9.1 Form Testing with React Testing Library

```typescript
// Form unit tests
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateUserForm } from './CreateUserForm';

describe('CreateUserForm', () => {
  const user = userEvent.setup();

  it('successfully submits the form', async () => {
    const onSubmit = vi.fn();
    render(<CreateUserForm onSubmit={onSubmit} />);

    // Fill in the fields
    await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address *'), 'jane@example.com');
    await user.selectOptions(screen.getByLabelText('Role *'), 'admin');
    await user.click(screen.getByLabelText('I agree to the Terms of Service *'));

    // Submit
    await user.click(screen.getByRole('button', { name: /Create User/ }));

    // Verify onSubmit was called with the correct values
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'admin',
        agreed: true,
      });
    });
  });

  it('shows errors when required fields are empty', async () => {
    render(<CreateUserForm />);

    // Submit without entering anything
    await user.click(screen.getByRole('button', { name: /Create User/ }));

    // Verify that error messages are displayed
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('shows an error when the email address is invalid', async () => {
    render(<CreateUserForm />);

    await user.type(screen.getByLabelText('Email Address *'), 'invalid-email');
    await user.tab(); // Blur the field (onBlur validation)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('disables the button while submitting', async () => {
    const onSubmit = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    render(<CreateUserForm onSubmit={onSubmit} />);

    // Fill in the form
    await user.type(screen.getByLabelText('Name *'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email Address *'), 'jane@example.com');
    await user.click(screen.getByLabelText('I agree to the Terms of Service *'));

    // Submit
    await user.click(screen.getByRole('button', { name: /Create User/ }));

    // Button should be disabled
    expect(screen.getByRole('button', { name: /Creating/ })).toBeDisabled();
  });

  it('clears the error message after it is corrected', async () => {
    render(<CreateUserForm />);

    // Enter an invalid email and submit
    await user.type(screen.getByLabelText('Email Address *'), 'invalid');
    await user.click(screen.getByRole('button', { name: /Create User/ }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    // Correct the email
    const emailInput = screen.getByLabelText('Email Address *');
    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');

    // Error message should disappear (reValidateMode: 'onChange')
    await waitFor(() => {
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });
  });
});
```

### 9.2 Accessibility Testing

```typescript
// Accessibility testing with axe-core
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('CreateUserForm Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<CreateUserForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in the error state', async () => {
    const { container } = render(<CreateUserForm />);
    const user = userEvent.setup();

    // Trigger errors
    await user.click(screen.getByRole('button', { name: /Create User/ }));

    await waitFor(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it('all fields have an associated label', () => {
    render(<CreateUserForm />);

    // Verify that all inputs have labels
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toHaveAccessibleName();
    });
  });

  it('focus can be moved with the keyboard', async () => {
    render(<CreateUserForm />);
    const user = userEvent.setup();

    // Move focus with Tab
    await user.tab();
    expect(screen.getByLabelText('Name *')).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText('Email Address *')).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText('Age')).toHaveFocus();
  });

  it('error messages are linked via aria-describedby', async () => {
    render(<CreateUserForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Create User/ }));

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name *');
      const errorId = nameInput.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();

      const errorElement = document.getElementById(errorId!);
      expect(errorElement).toHaveTextContent('Name is required');
    });
  });
});
```

### 9.3 E2E Testing (Playwright)

```typescript
// Form E2E tests with Playwright
import { test, expect } from '@playwright/test';

test.describe('Create User Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users/new');
  });

  test('successful form submission', async ({ page }) => {
    // Fill in the fields
    await page.getByLabel('Name').fill('Jane Doe');
    await page.getByLabel('Email Address').fill('jane@example.com');
    await page.getByLabel('Role').selectOption('admin');
    await page.getByLabel('I agree to the Terms of Service').check();

    // Wait for the API response
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/users') && response.status() === 201
    );

    // Submit
    await page.getByRole('button', { name: 'Create User' }).click();

    // Verify the API response
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Verify the success message
    await expect(page.getByText('User created successfully')).toBeVisible();

    // Verify the form was reset
    await expect(page.getByLabel('Name')).toHaveValue('');
  });

  test('displaying and fixing validation errors', async ({ page }) => {
    // Submit without filling anything in
    await page.getByRole('button', { name: 'Create User' }).click();

    // Verify error messages
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();

    // Verify focus moved to the first error field
    await expect(page.getByLabel('Name')).toBeFocused();

    // Fix the error
    await page.getByLabel('Name').fill('Jane Doe');

    // Error message should disappear
    await expect(page.getByText('Name is required')).not.toBeVisible();
  });

  test('server error for duplicate email address', async ({ page }) => {
    // Mock a server error
    await page.route('**/api/users', (route) => {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: {
            email: ['This email address is already registered'],
          },
        }),
      });
    });

    // Fill in and submit the form
    await page.getByLabel('Name').fill('Jane Doe');
    await page.getByLabel('Email Address').fill('existing@example.com');
    await page.getByLabel('I agree to the Terms of Service').check();
    await page.getByRole('button', { name: 'Create User' }).click();

    // Verify the server error message is displayed
    await expect(page.getByText('This email address is already registered')).toBeVisible();
  });

  test('form interaction on mobile', async ({ page }) => {
    // Switch to a mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Fill in the form using touch events
    await page.getByLabel('Name').tap();
    await page.getByLabel('Name').fill('Jane Doe');

    // Scroll to the submit button at the bottom of the screen
    await page.getByRole('button', { name: 'Create User' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Create User' }).tap();
  });
});
```

---

## 10. Anti-Patterns and Troubleshooting

### 10.1 Common Anti-Patterns

```typescript
// Anti-pattern 1: Managing both register and state
// Bad: Duplicating state between React Hook Form and useState
function BadDoubleState() {
  const { register } = useForm();
  const [name, setName] = useState(''); // Unnecessary!

  return (
    <input
      {...register('name')}
      value={name}                       // Overrides the register value
      onChange={(e) => setName(e.target.value)} // Overrides the register onChange
    />
  );
}

// Good: Let React Hook Form manage the state
function GoodSingleSource() {
  const { register, watch } = useForm();
  const name = watch('name'); // Get the value with watch only when needed

  return <input {...register('name')} />;
}


// Anti-pattern 2: Using index as the key in useFieldArray
// Bad: Using index as the key causes bugs on delete and reorder
function BadFieldArray() {
  const { fields } = useFieldArray({ control, name: 'items' });

  return fields.map((field, index) => (
    <div key={index}>  {/* Field values shift on delete */}
      <input {...register(`items.${index}.name`)} />
    </div>
  ));
}

// Good: use field.id as the key
function GoodFieldArray() {
  const { fields } = useFieldArray({ control, name: 'items' });

  return fields.map((field, index) => (
    <div key={field.id}>  {/* Stable key */}
      <input {...register(`items.${index}.name`)} />
    </div>
  ));
}


// Anti-pattern 3: defaultValues reference changes on every render
// Bad: A new object is created on every render
function BadDefaultValues() {
  const form = useForm({
    defaultValues: {  // New reference on every render
      items: [],
    },
  });
}

// Good: Define outside the component or use useMemo
const defaultValues = { items: [] };

function GoodDefaultValues() {
  const form = useForm({ defaultValues });
}


// Anti-pattern 4: Wrong validation mode for async validation
// Bad: mode: 'onChange' + heavy async validation
function BadValidationMode() {
  const form = useForm({
    mode: 'onChange', // Makes an API call on every keystroke!
  });

  return (
    <input
      {...form.register('username', {
        validate: async (value) => {
          const exists = await checkUsername(value); // Runs on every keystroke
          return !exists || 'This username is already taken';
        },
      })}
    />
  );
}

// Good: mode: 'onBlur' + debounce
function GoodValidationMode() {
  const form = useForm({
    mode: 'onBlur', // Validate only when the field loses focus
  });

  return (
    <input
      {...form.register('username', {
        validate: async (value) => {
          const exists = await checkUsername(value);
          return !exists || 'This username is already taken';
        },
      })}
    />
  );
}


// Anti-pattern 5: Showing errors at the wrong time
// Bad: Showing errors on the initial render
function BadInitialErrors() {
  const { register, formState: { errors } } = useForm({
    mode: 'all',       // Validate in all modes
    defaultValues: {
      name: '',        // Empty initial value → error shown immediately
    },
  });

  return (
    <div>
      <input {...register('name', { required: 'Name is required' })} />
      {errors.name && <p>{errors.name.message}</p>} {/* Error on first render! */}
    </div>
  );
}

// Good: Consider touchedFields
function GoodInitialDisplay() {
  const { register, formState: { errors, touchedFields } } = useForm({
    mode: 'onTouched',
  });

  return (
    <div>
      <input {...register('name', { required: 'Name is required' })} />
      {touchedFields.name && errors.name && (
        <p>{errors.name.message}</p>
      )}
    </div>
  );
}
```

### 10.2 Troubleshooting Guide

```
Troubleshooting:

Q: Can't get the value of a registered input
A: Possible causes:
   1. defaultValues not set
      → useForm({ defaultValues: { fieldName: '' } })
   2. Using register on a custom component that needs Controller
      → Switch to Controller
   3. Component unmounts and remounts
      → Set shouldUnregister: false

Q: Validation is not running
A: Possible causes:
   1. Incorrect resolver import
      → import { zodResolver } from '@hookform/resolvers/zod'
   2. Mismatch between schema and field names
      → If register('name'), the schema must have a 'name' property
   3. mode setting
      → mode: 'onSubmit' (default) only runs on submission

Q: TypeScript type errors
A: Possible causes:
   1. Type mismatch between z.infer and the form type
      → Use type FormData = z.infer<typeof schema>
   2. The name passed to register does not exist in the schema
      → Align with the schema property name
   3. Type of optional fields
      → Use z.coerce.number().optional() to allow undefined

Q: Values become incorrect after deleting a useFieldArray item
A: Possible causes:
   1. Using index as the key
      → Change to key={field.id}
   2. defaultValues does not include the field
      → defaultValues: { items: [{ name: '' }] }

Q: Values remain after form reset
A: Possible causes:
   1. Not passing options to reset()
      → reset({ name: '', email: '' }) to reset explicitly
   2. Controller component has internal state
      → Force remount by changing the key

Q: formData is empty in a Server Action
A: Possible causes:
   1. Input has no name attribute
      → register('name') sets the name automatically, but when using
         handleSubmit, parsed data is passed instead of FormData
   2. Using both action and onSubmit
      → Stick to one or the other

Q: Poor performance with a large number of fields
A: Solutions:
   1. Minimize use of watch → isolate with useWatch
   2. Avoid mode: 'onChange' → switch to mode: 'onBlur'
   3. Introduce virtual scrolling → @tanstack/react-virtual
   4. Split the form into sections
   5. Memoize field components with React.memo
```

### 10.3 Comprehensive Error Handling Pattern

```typescript
// Comprehensive error handling implementation
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Custom error class
class FormSubmitError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'FormSubmitError';
  }
}

// Form with comprehensive error handling
function RobustForm() {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '' },
  });

  const onSubmit = async (data: UserFormData) => {
    setGlobalError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);

        switch (response.status) {
          case 400:
            // Validation error: set errors per field
            if (errorBody?.fieldErrors) {
              for (const [field, messages] of Object.entries(errorBody.fieldErrors)) {
                form.setError(field as keyof UserFormData, {
                  type: 'server',
                  message: (messages as string[])[0],
                });
              }
            }
            break;

          case 409:
            // Duplicate error
            form.setError('email', {
              type: 'server',
              message: 'This email address is already in use',
            });
            break;

          case 422:
            // Unprocessable entity
            setGlobalError('Failed to process the input data. Please check your submission.');
            break;

          case 429:
            // Rate limit
            setGlobalError('Too many requests. Please wait a moment and try again.');
            break;

          case 500:
            // Server error
            setGlobalError('A server error occurred. Please try again later.');
            break;

          default:
            setGlobalError(`An error occurred (${response.status})`);
        }
        return;
      }

      // Success
      form.reset();
      toast.success('User created successfully');

    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // Network error
        setGlobalError('Network error: please check your internet connection.');
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        // Request timeout
        setGlobalError('The request timed out. Please try again.');
      } else {
        // Unexpected error
        console.error('Unexpected error:', error);
        setGlobalError('An unexpected error occurred.');
      }
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Global error display */}
      {globalError && (
        <div className="global-error" role="alert" aria-live="assertive">
          <p>{globalError}</p>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error summary */}
      {Object.keys(form.formState.errors).length > 0 && (
        <ErrorSummary errors={form.formState.errors} />
      )}

      {/* Form fields */}
      <div>
        <label htmlFor="name">Name *</label>
        <input id="name" {...form.register('name')} />
        {form.formState.errors.name && (
          <p className="error-message" role="alert">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email Address *</label>
        <input id="email" type="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="error-message" role="alert">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Submitting...' : 'Create User'}
      </button>
    </form>
  );
}
```

---

## 11. Designing Reusable Form Components

### 11.1 Generic Form Field Component

```typescript
// Reusable form field component
import { type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';

interface FormInputProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
  className?: string;
}

function FormInput<T extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  hint,
  autoComplete,
  className,
}: FormInputProps<T>) {
  const fieldId = `field-${String(name)}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const error = form.formState.errors[name];

  const describedBy = [
    hint ? hintId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('form-group', className)}>
      <label htmlFor={fieldId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {hint && (
        <p id={hintId} className="hint-text">{hint}</p>
      )}

      <input
        id={fieldId}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={describedBy}
        {...form.register(name)}
      />

      {error && (
        <p id={errorId} className="error-message" role="alert">
          {error.message as string}
        </p>
      )}
    </div>
  );
}

// Usage example
function UserForm() {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormInput
        form={form}
        name="name"
        label="Name"
        required
        autoComplete="name"
        placeholder="Jane Doe"
      />
      <FormInput
        form={form}
        name="email"
        label="Email Address"
        type="email"
        required
        autoComplete="email"
        placeholder="user@example.com"
      />
      <FormInput
        form={form}
        name="age"
        label="Age"
        type="number"
        hint="This field is optional"
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### 11.2 Form Wrapper Component

```typescript
// Generic form wrapper
import { type FieldValues, type DefaultValues, FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ZodSchema } from 'zod';

interface FormWrapperProps<T extends FieldValues> {
  schema: ZodSchema<T>;
  defaultValues: DefaultValues<T>;
  onSubmit: (data: T) => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  mode?: 'onSubmit' | 'onBlur' | 'onChange' | 'onTouched' | 'all';
}

function FormWrapper<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  mode = 'onBlur',
}: FormWrapperProps<T>) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode,
    reValidateMode: 'onChange',
  });

  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleSubmit = async (data: T) => {
    setGlobalError(null);
    try {
      await onSubmit(data);
    } catch (error) {
      if (error instanceof Error) {
        setGlobalError(error.message);
      } else {
        setGlobalError('An unexpected error occurred');
      }
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleSubmit)}
        className={className}
        noValidate
      >
        {globalError && (
          <div className="global-error" role="alert">
            {globalError}
          </div>
        )}
        {children}
      </form>
    </FormProvider>
  );
}

// Usage example
function CreateUserPage() {
  return (
    <FormWrapper
      schema={userSchema}
      defaultValues={{ name: '', email: '', role: 'user' }}
      onSubmit={async (data) => {
        await api.users.create(data);
        router.push('/users');
      }}
    >
      <FormInput name="name" label="Name" required />
      <FormInput name="email" label="Email Address" type="email" required />
      <SubmitButton label="Create User" />
    </FormWrapper>
  );
}
```

---

## Summary

| Concept | Key Points |
|---------|-----------|
| React Hook Form | Achieve type-safe, high-performance forms with register + zodResolver |
| Uncontrolled components | Use with native HTML elements for best performance with no re-renders |
| Controlled components | Use Controller to integrate custom UI / third-party components |
| useFieldArray | Efficiently manage dynamic field arrays; always use field.id as the key |
| Multi-step forms | FormProvider + trigger for per-step validation; centralized state management |
| Server Actions | Progressive enhancement support; optimistic update patterns |
| UX | Real-time validation after first submit; double-submit prevention; unsaved changes warning |
| Accessibility | ARIA attributes, keyboard navigation, screen reader support |
| Performance | Isolate with useWatch; React.memo; virtualization; debounce |
| Testing | Test user interactions with RTL; a11y testing with axe; E2E with Playwright |
| Error handling | Unified client/server error handling; global error display |
| Reusability | Generic types for form field and wrapper components |

---

## Frequently Asked Questions (FAQ)

### Q1. How should I choose between Controlled and Uncontrolled Components?

**A:** In general, **prefer Controlled Components**. The reasons are:

- **Immediate validation**: You can validate the value in real time as it changes
- **Conditional UI**: You can dynamically change the form based on the input
- **Easier debugging**: State is managed by React, making it easy to track in DevTools

However, **Uncontrolled Components are more appropriate** in these cases:

- **Large numbers of form fields**: When there are hundreds of fields and performance is a concern
- **Integration with legacy code**: When compatibility with existing non-React code is required
- **File inputs**: `<input type="file">` must always be uncontrolled

React Hook Form uses an uncontrolled mechanism internally while providing a controlled-like interface, achieving both performance and developer experience.

### Q2. Should I choose React Hook Form or Formik?

**A:** For current projects, **React Hook Form is recommended**:

| Item | React Hook Form | Formik |
|------|----------------|---------|
| Performance | Excellent (uncontrolled approach minimizes re-renders) | Acceptable (controlled approach causes more re-renders) |
| Bundle size | 8.5KB (gzip) | 15KB (gzip) |
| TypeScript support | Full support with strong type inference | Supported but weaker inference |
| Ecosystem | Easy Zod/Yup integration | Yup recommended |
| Learning curve | Slightly steep (takes time to get used to the useForm API) | Gentle (Formik components are intuitive) |
| Maintenance | Active | Slowing down |

Where Formik excels:

- **Intuitive API**: Write in a React-idiomatic style with `<Formik>` and `<Field>` components
- **Rich documentation**: Long history and plenty of learning resources

Where React Hook Form excels:

- **Performance**: Fast even for large forms
- **TypeScript integration**: Types automatically inferred from Zod schemas
- **Modern React philosophy**: Hooks-based and well-suited to modern React development

### Q3. How should I design a multi-step form?

**A:** There are four main approaches for designing multi-step forms:

**1. Independent form per step (recommended)**

```typescript
// Each step has its own useForm
const Step1 = () => {
  const { register, handleSubmit } = useForm<Step1Data>();
  const onSubmit = (data) => saveToContext(data);
  // ...
};
```

Pros: Each step is independent; validation is isolated; back button is easy to implement
Cons: Sharing data between steps requires Context or a state management library

**2. Single form with conditional rendering**

```typescript
const MultiStepForm = () => {
  const { register, handleSubmit } = useForm<AllStepsData>();
  const [currentStep, setCurrentStep] = useState(1);
  // Hold all fields, just switch what's displayed
};
```

Pros: Simple implementation; all data is in one form
Cons: Gets complex at scale; validation is harder to control

**3. Per-step schema + merge strategy**

```typescript
const step1Schema = z.object({ name: z.string() });
const step2Schema = z.object({ email: z.string().email() });
const finalSchema = step1Schema.merge(step2Schema);
```

Pros: Leverages Zod type inference; step-by-step validation
Cons: Schema merging can get complex

**Recommended design patterns:**

- 3–5 steps: **Independent form per step + share state with Context**
- 2 steps: **Single form with conditional rendering**
- 6+ steps: Consider a **form builder library** (e.g. react-multi-step-form)

**UX considerations:**

- Always display a progress bar
- Allow the user to go back to previous steps
- Save progress to localStorage on each step completion (prevents data loss on exit)
- Show a confirmation screen with all inputs before final submission

---

## What to Read Next

---

## References
1. React Hook Form. "Documentation." react-hook-form.com, 2024.
2. shadcn/ui. "Form." ui.shadcn.com, 2024.
3. web.dev. "Form Best Practices." web.dev, 2024.
4. W3C. "WCAG 2.1 - Web Content Accessibility Guidelines." w3.org, 2018.
5. MDN Web Docs. "Web forms - Working with user data." developer.mozilla.org, 2024.
6. Zod. "TypeScript-first schema validation." zod.dev, 2024.
7. React. "React 19 - useActionState, useOptimistic." react.dev, 2024.
8. Testing Library. "React Testing Library." testing-library.com, 2024.
9. Playwright. "End-to-end testing." playwright.dev, 2024.
10. Deque Systems. "axe-core - Accessibility Testing." deque.com, 2024.
