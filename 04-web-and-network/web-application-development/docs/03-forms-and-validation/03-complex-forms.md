# Complex Forms

> Complex forms are an unavoidable challenge in professional development. Master the patterns for handling every complex form requirement: multi-step forms, dynamic fields, conditional branching, array fields, and nested forms. Centered on React Hook Form + Zod, this guide covers everything from designing scalable complex forms through implementation, testing, and performance optimization.

## What You Will Learn

- [ ] Understand the design and implementation of multi-step forms
- [ ] Grasp dynamic field management with useFieldArray
- [ ] Learn validation design for conditional branching forms
- [ ] Implement auto-save and draft management for forms
- [ ] Achieve navigation guards and unsaved data protection
- [ ] Master design patterns for nested form structures
- [ ] Understand performance optimization techniques for complex forms
- [ ] Build accessible complex forms
- [ ] Acquire form testing strategies and implementation techniques

---

## Prerequisites

To get the most out of this chapter, it is recommended to have the following knowledge beforehand:

- **File Upload**: Understanding the implementation patterns for file validation, preview display, and upload processing covered in `./02-file-upload.md`
- **State Management**: Understanding the basics of global state management with React Context, Zustand, or Redux covered in `../01-state-management/00-state-management-overview.md`
- **Form Validation**: Understanding Zod schema design, conditional validation, and error handling patterns covered in `./01-validation-patterns.md`

---

## 1. Multi-Step Forms

### 1.1 Design Principles

A multi-step form (wizard form) is a UI pattern that limits the amount of information a user processes at once, reducing cognitive load. Design according to the following principles.

**Criteria for step division:**
- Group logically related information into a single step
- Aim for 3–7 fields per step
- Place steps where users are likely to drop off (e.g., payment info) later in the flow
- Place required information earlier and optional information later

**UX considerations:**
- Always display a progress indicator
- Guarantee the ability to return to previous steps
- Save data upon completing each step (to guard against abandonment)
- Show a summary of all entered data on the final confirmation screen

### 1.2 Basic Implementation: Per-Step Schemas

```typescript
import { z } from 'zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useCallback } from 'react';

// Step 1: Account Information
const step1Schema = z.object({
  name: z.string()
    .min(1, '名前は必須です')
    .max(50, '名前は50文字以内で入力してください'),
  email: z.string()
    .email('有効なメールアドレスを入力してください'),
  password: z.string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'パスワードは大文字、小文字、数字を含む必要があります'
    ),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

// Step 2: Profile Information
const step2Schema = z.object({
  company: z.string().min(1, '会社名は必須です'),
  role: z.enum(['developer', 'designer', 'manager', 'other'], {
    errorMap: () => ({ message: '役割を選択してください' }),
  }),
  experience: z.coerce
    .number()
    .min(0, '経験年数は0以上で入力してください')
    .max(50, '経験年数は50以下で入力してください'),
  bio: z.string()
    .max(500, '自己紹介は500文字以内で入力してください')
    .optional(),
});

// Step 3: Plan Selection
const step3Schema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise'], {
    errorMap: () => ({ message: 'プランを選択してください' }),
  }),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  agreed: z.literal(true, {
    errorMap: () => ({ message: '利用規約に同意する必要があります' }),
  }),
});

// Full schema (for final validation)
const fullSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema);

type FormData = z.infer<typeof fullSchema>;

// Type definition for step configuration
interface StepConfig {
  title: string;
  description: string;
  schema: z.ZodType;
  fields: (keyof FormData)[];
}

const STEPS: StepConfig[] = [
  {
    title: 'アカウント情報',
    description: 'ログインに使用する情報を入力してください',
    schema: step1Schema,
    fields: ['name', 'email', 'password', 'confirmPassword'],
  },
  {
    title: 'プロフィール',
    description: 'あなたの情報を教えてください',
    schema: step2Schema,
    fields: ['company', 'role', 'experience', 'bio'],
  },
  {
    title: 'プラン選択',
    description: 'ご利用プランを選択してください',
    schema: step3Schema,
    fields: ['plan', 'billingCycle', 'agreed'],
  },
];
```

### 1.3 Step Management Hook

```typescript
// Custom hook: Managing multi-step form logic
function useMultiStepForm<T extends Record<string, any>>(
  steps: StepConfig[],
  defaultValues: Partial<T>
) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepData, setStepData] = useState<Partial<T>[]>(
    steps.map(() => ({}))
  );

  const form = useForm<T>({
    resolver: zodResolver(steps[currentStep].schema),
    mode: 'onTouched',
    defaultValues: defaultValues as any,
  });

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goToNext = useCallback(async () => {
    // Validate current step
    const fieldsToValidate = steps[currentStep].fields;
    const isValid = await form.trigger(fieldsToValidate as any);

    if (!isValid) return false;

    // Save step data
    const currentValues = form.getValues();
    setStepData(prev => {
      const updated = [...prev];
      updated[currentStep] = currentValues;
      return updated;
    });

    // Mark step as complete
    setCompletedSteps(prev => new Set(prev).add(currentStep));

    if (!isLastStep) {
      setCurrentStep(s => s + 1);
    }

    return true;
  }, [currentStep, form, steps, isLastStep]);

  const goToPrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(s => s - 1);
    }
  }, [isFirstStep]);

  const goToStep = useCallback((step: number) => {
    // Can navigate to completed steps or up to next of current step
    if (step <= currentStep || completedSteps.has(step - 1)) {
      setCurrentStep(step);
    }
  }, [currentStep, completedSteps]);

  const getMergedData = useCallback((): Partial<T> => {
    return stepData.reduce((acc, data) => ({ ...acc, ...data }), {} as Partial<T>);
  }, [stepData]);

  return {
    form,
    currentStep,
    isFirstStep,
    isLastStep,
    progress,
    completedSteps,
    goToNext,
    goToPrevious,
    goToStep,
    getMergedData,
    totalSteps: steps.length,
  };
}
```

### 1.4 Complete Multi-Step Form Component

```tsx
function MultiStepForm() {
  const {
    form,
    currentStep,
    isFirstStep,
    isLastStep,
    progress,
    completedSteps,
    goToNext,
    goToPrevious,
    goToStep,
    getMergedData,
    totalSteps,
  } = useMultiStepForm<FormData>(STEPS, {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    role: undefined,
    experience: 0,
    bio: '',
    plan: undefined,
    billingCycle: 'monthly',
    agreed: false as any,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleNext = async () => {
    const success = await goToNext();
    if (success && !isLastStep) {
      // Save draft
      const data = getMergedData();
      await saveDraft(data);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Merge data from all steps
      const mergedData = { ...getMergedData(), ...data };

      // Final validation
      const result = fullSchema.safeParse(mergedData);
      if (!result.success) {
        const firstError = result.error.errors[0];
        setSubmitError(`入力エラー: ${firstError.message}`);
        return;
      }

      await api.register(result.data);
      router.push('/registration/complete');
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '登録に失敗しました。もう一度お試しください。'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToStep(i)}
              className={`flex items-center gap-2 text-sm font-medium
                ${i === currentStep ? 'text-blue-600' : ''}
                ${completedSteps.has(i) ? 'text-green-600 cursor-pointer' : 'text-gray-400'}
              `}
              disabled={!completedSteps.has(i) && i !== currentStep}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs
                ${i === currentStep ? 'bg-blue-600 text-white' : ''}
                ${completedSteps.has(i) ? 'bg-green-600 text-white' : 'bg-gray-200'}
              `}>
                {completedSteps.has(i) ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{step.title}</span>
            </button>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">{STEPS[currentStep].title}</h2>
        <p className="text-gray-500 mt-1">{STEPS[currentStep].description}</p>
      </div>

      {/* Form body */}
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {currentStep === 0 && <Step1Fields form={form} />}
        {currentStep === 1 && <Step2Fields form={form} />}
        {currentStep === 2 && <Step3Fields form={form} />}

        {/* Error message */}
        {submitError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{submitError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={isFirstStep}
            className={`px-6 py-2 rounded-lg border
              ${isFirstStep ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
            `}
          >
            戻る
          </button>

          {isLastStep ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg
                hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? '送信中...' : '登録する'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              次へ
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
```

### 1.5 Step Component Implementation

```tsx
// Step 1: Account Information
function Step1Fields({ form }: { form: UseFormReturn<FormData> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          名前 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          {...register('name')}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="山田 太郎"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-500" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          メールアドレス <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="taro@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-500" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          パスワード <span className="text-red-500">*</span>
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="8文字以上"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : 'password-hint'}
        />
        <p id="password-hint" className="mt-1 text-xs text-gray-400">
          大文字、小文字、数字を含む8文字以上
        </p>
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-500" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
          パスワード確認 <span className="text-red-500">*</span>
        </label>
        <input
          id="confirmPassword"
          type="password"
          {...register('confirmPassword')}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="パスワードを再入力"
          aria-invalid={!!errors.confirmPassword}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-500" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
    </div>
  );
}

// Step 2: Profile Information
function Step2Fields({ form }: { form: UseFormReturn<FormData> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="company" className="block text-sm font-medium mb-1">
          会社名 <span className="text-red-500">*</span>
        </label>
        <input
          id="company"
          {...register('company')}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="株式会社サンプル"
        />
        {errors.company && (
          <p className="mt-1 text-sm text-red-500">{errors.company.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">
          役割 <span className="text-red-500">*</span>
        </label>
        <select
          id="role"
          {...register('role')}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">選択してください</option>
          <option value="developer">開発者</option>
          <option value="designer">デザイナー</option>
          <option value="manager">マネージャー</option>
          <option value="other">その他</option>
        </select>
        {errors.role && (
          <p className="mt-1 text-sm text-red-500">{errors.role.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="experience" className="block text-sm font-medium mb-1">
          経験年数
        </label>
        <input
          id="experience"
          type="number"
          {...register('experience')}
          className="w-full px-3 py-2 border rounded-lg"
          min={0}
          max={50}
        />
        {errors.experience && (
          <p className="mt-1 text-sm text-red-500">{errors.experience.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium mb-1">
          自己紹介
        </label>
        <textarea
          id="bio"
          {...register('bio')}
          className="w-full px-3 py-2 border rounded-lg"
          rows={4}
          placeholder="自由に記入してください（500文字以内）"
        />
        {errors.bio && (
          <p className="mt-1 text-sm text-red-500">{errors.bio.message}</p>
        )}
      </div>
    </div>
  );
}
```

### 1.6 Anti-Patterns for Multi-Step Forms

| Anti-Pattern | Problem | Correct Approach |
|-------------|--------|--------------|
| Validating all fields at once | User confused by invisible errors | Validate per step |
| Resetting form between steps | Data is lost | Use a shared form instance |
| Back button clears entered data | UX degradation | Properly manage defaultValues |
| API submission only on final step | Data lost on mid-flow abandonment | Save draft on step completion |
| No progress bar | User cannot track progress | Always show progress |
| No animation between steps | Transitions are unclear | Use appropriate transitions |

### 1.7 Animations Between Steps

```tsx
import { AnimatePresence, motion } from 'framer-motion';

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

function AnimatedStep({
  children,
  direction,
  stepKey,
}: {
  children: React.ReactNode;
  direction: number;
  stepKey: number;
}) {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// 使用例
function MultiStepFormWithAnimation() {
  const [direction, setDirection] = useState(0);
  // ... useMultiStepForm

  const handleNext = async () => {
    setDirection(1);
    await goToNext();
  };

  const handlePrev = () => {
    setDirection(-1);
    goToPrevious();
  };

  return (
    <form>
      <AnimatedStep direction={direction} stepKey={currentStep}>
        {currentStep === 0 && <Step1Fields form={form} />}
        {currentStep === 1 && <Step2Fields form={form} />}
        {currentStep === 2 && <Step3Fields form={form} />}
      </AnimatedStep>
    </form>
  );
}
```

### 1.8 Confirmation Screen Implementation

```tsx
// 最終確認ステップ
function ConfirmationStep({ data }: { data: FormData }) {
  const sections = [
    {
      title: 'アカウント情報',
      items: [
        { label: '名前', value: data.name },
        { label: 'メールアドレス', value: data.email },
        { label: 'パスワード', value: '********' },
      ],
    },
    {
      title: 'プロフィール',
      items: [
        { label: '会社名', value: data.company },
        { label: '役割', value: ROLE_LABELS[data.role] },
        { label: '経験年数', value: `${data.experience}年` },
        { label: '自己紹介', value: data.bio || '未入力' },
      ],
    },
    {
      title: 'プラン',
      items: [
        { label: 'プラン', value: PLAN_LABELS[data.plan] },
        { label: '請求サイクル', value: data.billingCycle === 'monthly' ? '月払い' : '年払い' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">入力内容の確認</h3>
      {sections.map((section) => (
        <div key={section.title} className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 mb-3">{section.title}</h4>
          <dl className="space-y-2">
            {section.items.map((item) => (
              <div key={item.label} className="flex">
                <dt className="w-32 text-gray-500 text-sm">{item.label}</dt>
                <dd className="text-sm font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  developer: '開発者',
  designer: 'デザイナー',
  manager: 'マネージャー',
  other: 'その他',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'フリープラン',
  pro: 'プロプラン',
  enterprise: 'エンタープライズ',
};
```

---

## 2. Dynamic Fields (useFieldArray)

### 2.1 Basic Concepts of useFieldArray

`useFieldArray` is a hook provided by React Hook Form for efficiently managing array-type fields. It is especially powerful for forms that need to dynamically add, remove, and reorder rows.

**Main use cases:**
- Product rows in an order form
- Line items on an invoice
- Survey answer options
- Team member invitation lists
- Managing tags or categories
- Registering multiple addresses

**Methods provided by useFieldArray:**

| Method | Description | Example Use |
|---------|------|-------|
| `append` | Append to end | Add a new row |
| `prepend` | Prepend to start | Insert row at beginning |
| `insert` | Insert at position | Insert row at specific position |
| `remove` | Remove at position | Delete a row |
| `swap` | Swap two elements | Swap two rows |
| `move` | Move element | Drag and drop |
| `update` | Update element | Directly update row value |
| `replace` | Replace all elements | Reset entire list |

### 2.2 Complete Order Form Implementation

```typescript
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Type definition for product master data
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

// Order schema
const orderItemSchema = z.object({
  productId: z.string().min(1, '商品を選択してください'),
  quantity: z.coerce
    .number()
    .min(1, '数量は1以上で入力してください')
    .max(999, '数量は999以下で入力してください'),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce
    .number()
    .min(0, '割引率は0以上で入力してください')
    .max(100, '割引率は100以下で入力してください')
    .optional()
    .default(0),
  note: z.string().max(200, 'メモは200文字以内で入力してください').optional(),
});

const orderSchema = z.object({
  customerName: z.string().min(1, '顧客名は必須です'),
  customerEmail: z.string().email('有効なメールアドレスを入力してください'),
  shippingAddress: z.string().min(1, '配送先住所は必須です'),
  items: z
    .array(orderItemSchema)
    .min(1, '1つ以上の商品を追加してください')
    .max(50, '一度に注文できるのは50商品までです'),
  notes: z.string().optional(),
  priority: z.enum(['normal', 'urgent', 'express']).default('normal'),
});

type OrderFormData = z.infer<typeof orderSchema>;

// Total amount calculation component
function OrderSummary({ control }: { control: any }) {
  const items = useWatch({ control, name: 'items' });

  const summary = useMemo(() => {
    if (!items || !Array.isArray(items)) {
      return { subtotal: 0, discountTotal: 0, total: 0, itemCount: 0 };
    }

    return items.reduce(
      (acc, item) => {
        const lineTotal = (item.unitPrice || 0) * (item.quantity || 0);
        const discountAmount = lineTotal * ((item.discount || 0) / 100);
        return {
          subtotal: acc.subtotal + lineTotal,
          discountTotal: acc.discountTotal + discountAmount,
          total: acc.total + (lineTotal - discountAmount),
          itemCount: acc.itemCount + (item.quantity || 0),
        };
      },
      { subtotal: 0, discountTotal: 0, total: 0, itemCount: 0 }
    );
  }, [items]);

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-4">
      <h4 className="font-medium mb-3">注文サマリー</h4>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">商品数</dt>
          <dd>{summary.itemCount}点</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">小計</dt>
          <dd>{summary.subtotal.toLocaleString()}円</dd>
        </div>
        <div className="flex justify-between text-red-500">
          <dt>割引合計</dt>
          <dd>-{summary.discountTotal.toLocaleString()}円</dd>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
          <dt>合計</dt>
          <dd>{summary.total.toLocaleString()}円</dd>
        </div>
      </dl>
    </div>
  );
}

// Order form body
function OrderForm({ products }: { products: Product[] }) {
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      shippingAddress: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0, discount: 0, note: '' }],
      notes: '',
      priority: 'normal',
    },
  });

  const { fields, append, remove, move, insert } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.unitPrice`, product.price);
      form.setValue(`items.${index}.productId`, productId);
    }
  };

  const handleDuplicate = (index: number) => {
    const currentItem = form.getValues(`items.${index}`);
    insert(index + 1, { ...currentItem });
  };

  const onSubmit = async (data: OrderFormData) => {
    try {
      await api.orders.create(data);
      toast.success('注文を作成しました');
      form.reset();
    } catch (error) {
      toast.error('注文の作成に失敗しました');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Customer information */}
      <fieldset className="border rounded-lg p-4">
        <legend className="text-lg font-medium px-2">顧客情報</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-sm font-medium mb-1">顧客名</label>
            <input {...form.register('customerName')} className="w-full border rounded px-3 py-2" />
            {form.formState.errors.customerName && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.customerName.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              {...form.register('customerEmail')}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">配送先住所</label>
            <input
              {...form.register('shippingAddress')}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </fieldset>

      {/* Product details */}
      <fieldset className="border rounded-lg p-4">
        <legend className="text-lg font-medium px-2">
          商品明細 ({fields.length}件)
        </legend>

        {form.formState.errors.items?.message && (
          <p className="text-red-500 text-sm mb-2">
            {form.formState.errors.items.message}
          </p>
        )}

        <div className="space-y-3 mt-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-wrap gap-2 items-start p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-gray-400 text-sm self-center w-6">
                {index + 1}.
              </span>

              <div className="flex-1 min-w-[200px]">
                <select
                  {...form.register(`items.${index}.productId`)}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">商品を選択</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price.toLocaleString()}円)
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-24">
                <input
                  type="number"
                  {...form.register(`items.${index}.quantity`)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="数量"
                  min={1}
                />
              </div>

              <div className="w-24">
                <input
                  type="number"
                  {...form.register(`items.${index}.discount`)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="割引%"
                  min={0}
                  max={100}
                />
              </div>

              <div className="flex-1 min-w-[150px]">
                <input
                  {...form.register(`items.${index}.note`)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="メモ"
                />
              </div>

              <div className="flex gap-1">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    title="上に移動"
                  >
                    ↑
                  </button>
                )}
                {index < fields.length - 1 && (
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                    title="下に移動"
                  >
                    ↓
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDuplicate(index)}
                  className="p-1.5 text-gray-400 hover:text-blue-600"
                  title="複製"
                >
                  複製
                </button>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="削除"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => append({ productId: '', quantity: 1, unitPrice: 0, discount: 0, note: '' })}
          className="mt-3 px-4 py-2 border-2 border-dashed border-gray-300
            rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500
            transition-colors w-full"
          disabled={fields.length >= 50}
        >
          + 商品を追加
        </button>
      </fieldset>

      {/* Order summary */}
      <OrderSummary control={form.control} />

      {/* Submit button */}
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full py-3 bg-blue-600 text-white rounded-lg
          hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {form.formState.isSubmitting ? '注文処理中...' : '注文を確定する'}
      </button>
    </form>
  );
}
```

### 2.3 Nested useFieldArray

```typescript
// Invoice form: Nested structure of sections > line items
const invoiceSectionSchema = z.object({
  sectionTitle: z.string().min(1, 'セクション名は必須です'),
  items: z.array(z.object({
    description: z.string().min(1, '説明は必須です'),
    quantity: z.coerce.number().min(1),
    unitPrice: z.coerce.number().min(0),
    taxRate: z.coerce.number().min(0).max(100).default(10),
  })).min(1, '1つ以上の明細を追加してください'),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  clientName: z.string().min(1),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  sections: z.array(invoiceSectionSchema).min(1),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

function InvoiceForm() {
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceNumber: '',
      clientName: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      sections: [
        {
          sectionTitle: 'サービス',
          items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
        },
      ],
    },
  });

  const { fields: sectionFields, append: appendSection, remove: removeSection } =
    useFieldArray({
      control: form.control,
      name: 'sections',
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {sectionFields.map((section, sectionIndex) => (
        <InvoiceSection
          key={section.id}
          form={form}
          sectionIndex={sectionIndex}
          onRemove={() => removeSection(sectionIndex)}
          canRemove={sectionFields.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={() =>
          appendSection({
            sectionTitle: '',
            items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 10 }],
          })
        }
      >
        + セクションを追加
      </button>
    </form>
  );
}

// Nested line item component
function InvoiceSection({
  form,
  sectionIndex,
  onRemove,
  canRemove,
}: {
  form: UseFormReturn<InvoiceFormData>;
  sectionIndex: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `sections.${sectionIndex}.items`,
  });

  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <input
          {...form.register(`sections.${sectionIndex}.sectionTitle`)}
          className="text-lg font-medium border-b border-transparent
            hover:border-gray-300 focus:border-blue-500 outline-none"
          placeholder="セクション名"
        />
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-red-500">
            セクション削除
          </button>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500">
            <th className="pb-2">説明</th>
            <th className="pb-2 w-24">数量</th>
            <th className="pb-2 w-32">単価</th>
            <th className="pb-2 w-24">税率</th>
            <th className="pb-2 w-32">小計</th>
            <th className="pb-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, itemIndex) => (
            <InvoiceLineItem
              key={field.id}
              form={form}
              sectionIndex={sectionIndex}
              itemIndex={itemIndex}
              onRemove={() => remove(itemIndex)}
              canRemove={fields.length > 1}
            />
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 10 })}
        className="mt-2 text-sm text-blue-500 hover:text-blue-700"
      >
        + 明細を追加
      </button>
    </div>
  );
}
```

### 2.4 Drag-and-Drop Reordering

```typescript
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable row component
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center
          justify-center cursor-grab active:cursor-grabbing text-gray-400
          hover:text-gray-600"
      >
        ⋮⋮
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

// Drag-and-drop enabled dynamic field array
function DraggableFieldArray() {
  const form = useForm({ /* ... */ });
  const { fields, move } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      move(oldIndex, newIndex);
    }
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={fields.map(f => f.id)}
        strategy={verticalListSortingStrategy}
      >
        {fields.map((field, index) => (
          <SortableItem key={field.id} id={field.id}>
            {/* フィールドの内容 */}
            <input {...form.register(`items.${index}.name`)} />
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### 2.5 Performance Optimization for useFieldArray

```typescript
// Anti-pattern: Re-rendering all fields
function BadExample() {
  const { fields } = useFieldArray({ control, name: 'items' });
  // Watching the whole form with watch() causes all rows to re-render on any field change
  const allValues = form.watch('items'); // 非推奨

  return fields.map((field, i) => (
    <div key={field.id}>
      <input {...form.register(`items.${i}.name`)} />
      <span>合計: {allValues[i].price * allValues[i].quantity}</span>
    </div>
  ));
}

// Recommended pattern: Use useWatch per row
function OptimizedRow({
  index,
  control,
  register,
}: {
  index: number;
  control: any;
  register: any;
}) {
  // Only watch this row's data → only this row re-renders
  const item = useWatch({ control, name: `items.${index}` });

  const lineTotal = useMemo(
    () => (item.price || 0) * (item.quantity || 0),
    [item.price, item.quantity]
  );

  return (
    <div>
      <input {...register(`items.${index}.name`)} />
      <input type="number" {...register(`items.${index}.price`)} />
      <input type="number" {...register(`items.${index}.quantity`)} />
      <span>小計: {lineTotal.toLocaleString()}円</span>
    </div>
  );
}

function GoodExample() {
  const { fields } = useFieldArray({ control: form.control, name: 'items' });

  return fields.map((field, i) => (
    <OptimizedRow
      key={field.id}
      index={i}
      control={form.control}
      register={form.register}
    />
  ));
}
```

### 2.6 Common Pitfalls of useFieldArray

| Problem | Cause | Solution |
|------|------|--------|
| Data shifts when using index as key | React re-render optimization misfires | Use `field.id` as key |
| New field not focused after append | Focus not managed by default | Use `shouldFocus: true` option |
| Validation errors remain after remove | Error re-evaluation not triggered | Call `form.clearErrors()` |
| Performance degrades with many fields | All fields render simultaneously | Use virtualization (react-window) |
| Type errors with nested arrays | Limits of TypeScript type inference | Use `as const` or explicit type annotations |

---

## 3. Conditional Branching Forms

### 3.1 discriminatedUnion Pattern

A conditional branching form dynamically switches the displayed fields and validation rules based on the user's selection. Zod's `discriminatedUnion` is the most intuitive pattern for implementation.

```typescript
// Notification settings: different fields and validation by type
const emailNotificationSchema = z.object({
  type: z.literal('email'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  frequency: z.enum(['daily', 'weekly', 'monthly'], {
    errorMap: () => ({ message: '配信頻度を選択してください' }),
  }),
  format: z.enum(['html', 'text']).default('html'),
  categories: z.array(z.string()).min(1, '1つ以上のカテゴリを選択してください'),
});

const smsNotificationSchema = z.object({
  type: z.literal('sms'),
  phone: z.string()
    .regex(/^\+?\d{10,15}$/, '有効な電話番号を入力してください'),
  maxMessages: z.coerce
    .number()
    .min(1)
    .max(100)
    .default(10),
});

const webhookNotificationSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().url('有効なURLを入力してください'),
  secret: z.string()
    .min(16, 'シークレットキーは16文字以上で入力してください'),
  events: z.array(z.string()).min(1, '1つ以上のイベントを選択してください'),
  retryCount: z.coerce.number().min(0).max(5).default(3),
  timeout: z.coerce.number().min(1000).max(30000).default(5000),
});

const slackNotificationSchema = z.object({
  type: z.literal('slack'),
  webhookUrl: z.string().url('有効なWebhook URLを入力してください'),
  channel: z.string().min(1, 'チャンネル名は必須です'),
  username: z.string().optional(),
  iconEmoji: z.string().optional(),
});

const notificationSchema = z.discriminatedUnion('type', [
  emailNotificationSchema,
  smsNotificationSchema,
  webhookNotificationSchema,
  slackNotificationSchema,
]);

type NotificationFormData = z.infer<typeof notificationSchema>;
```

### 3.2 Complete Conditional Form Implementation

```tsx
function NotificationForm() {
  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { type: 'email' as const },
  });

  const notificationType = form.watch('type');

  // Reset fields on type change
  const handleTypeChange = (newType: NotificationFormData['type']) => {
    // Clear fields specific to current type
    form.reset({ type: newType } as any);
  };

  const onSubmit = async (data: NotificationFormData) => {
    try {
      await api.notifications.create(data);
      toast.success('通知設定を保存しました');
    } catch (error) {
      toast.error('保存に失敗しました');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Notification type selection */}
      <div>
        <label className="block text-sm font-medium mb-2">通知タイプ</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {NOTIFICATION_TYPES.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer
                transition-colors
                ${notificationType === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                value={option.value}
                checked={notificationType === option.value}
                onChange={() => handleTypeChange(option.value)}
                className="sr-only"
              />
              <span className="text-xl">{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Conditional fields */}
      {notificationType === 'email' && <EmailFields form={form} />}
      {notificationType === 'sms' && <SmsFields form={form} />}
      {notificationType === 'webhook' && <WebhookFields form={form} />}
      {notificationType === 'slack' && <SlackFields form={form} />}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full py-2 bg-blue-600 text-white rounded-lg"
      >
        保存する
      </button>
    </form>
  );
}

const NOTIFICATION_TYPES = [
  { value: 'email' as const, label: 'メール', icon: 'M' },
  { value: 'sms' as const, label: 'SMS', icon: 'S' },
  { value: 'webhook' as const, label: 'Webhook', icon: 'W' },
  { value: 'slack' as const, label: 'Slack', icon: 'K' },
];

// Email notification fields
function EmailFields({ form }: { form: UseFormReturn<any> }) {
  return (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
      <div>
        <label className="block text-sm font-medium mb-1">メールアドレス</label>
        <input
          type="email"
          {...form.register('email')}
          className="w-full border rounded px-3 py-2"
          placeholder="example@company.com"
        />
        {form.formState.errors.email && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.email.message as string}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">配信頻度</label>
        <select {...form.register('frequency')} className="w-full border rounded px-3 py-2">
          <option value="">選択してください</option>
          <option value="daily">毎日</option>
          <option value="weekly">毎週</option>
          <option value="monthly">毎月</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">フォーマット</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" value="html" {...form.register('format')} />
            HTML
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="text" {...form.register('format')} />
            テキスト
          </label>
        </div>
      </div>
    </div>
  );
}

// Webhook fields
function WebhookFields({ form }: { form: UseFormReturn<any> }) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
      <div>
        <label className="block text-sm font-medium mb-1">Webhook URL</label>
        <input
          type="url"
          {...form.register('url')}
          className="w-full border rounded px-3 py-2"
          placeholder="https://api.example.com/webhooks"
        />
        {form.formState.errors.url && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.url.message as string}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">シークレットキー</label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            {...form.register('secret')}
            className="w-full border rounded px-3 py-2 pr-20"
            placeholder="16文字以上のシークレットキー"
          />
          <button
            type="button"
            onClick={() => setShowSecret(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500"
          >
            {showSecret ? '隠す' : '表示'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">リトライ回数</label>
          <input
            type="number"
            {...form.register('retryCount')}
            className="w-full border rounded px-3 py-2"
            min={0}
            max={5}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">タイムアウト (ms)</label>
          <input
            type="number"
            {...form.register('timeout')}
            className="w-full border rounded px-3 py-2"
            min={1000}
            max={30000}
            step={1000}
          />
        </div>
      </div>
    </div>
  );
}
```

### 3.3 Complex Conditional Validation with superRefine

```typescript
// Complex conditional branching that discriminatedUnion cannot handle
const paymentSchema = z.object({
  paymentMethod: z.enum(['credit_card', 'bank_transfer', 'invoice']),
  // クレジットカード情報
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvc: z.string().optional(),
  // 銀行振込情報
  bankName: z.string().optional(),
  branchName: z.string().optional(),
  accountNumber: z.string().optional(),
  // 請求書情報
  companyName: z.string().optional(),
  billingAddress: z.string().optional(),
  taxId: z.string().optional(),
}).superRefine((data, ctx) => {
  switch (data.paymentMethod) {
    case 'credit_card':
      if (!data.cardNumber || !/^\d{16}$/.test(data.cardNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '有効なカード番号（16桁）を入力してください',
          path: ['cardNumber'],
        });
      }
      if (!data.cardExpiry || !/^\d{2}\/\d{2}$/.test(data.cardExpiry)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '有効期限をMM/YY形式で入力してください',
          path: ['cardExpiry'],
        });
      }
      if (!data.cardCvc || !/^\d{3,4}$/.test(data.cardCvc)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CVCは3〜4桁の数字で入力してください',
          path: ['cardCvc'],
        });
      }
      break;

    case 'bank_transfer':
      if (!data.bankName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '銀行名は必須です',
          path: ['bankName'],
        });
      }
      if (!data.accountNumber || !/^\d{7}$/.test(data.accountNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '口座番号は7桁の数字で入力してください',
          path: ['accountNumber'],
        });
      }
      break;

    case 'invoice':
      if (!data.companyName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '会社名は必須です',
          path: ['companyName'],
        });
      }
      if (!data.billingAddress?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '請求先住所は必須です',
          path: ['billingAddress'],
        });
      }
      break;
  }
});
```

### 3.4 Fields with Dependencies

```typescript
// Cascade selection: Prefecture → City → Address
function CascadeSelectForm() {
  const form = useForm<AddressFormData>();

  const selectedPrefecture = form.watch('prefecture');
  const selectedCity = form.watch('city');

  // Fetch city list based on selected prefecture
  const { data: cities, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', selectedPrefecture],
    queryFn: () => api.getCities(selectedPrefecture),
    enabled: !!selectedPrefecture,
  });

  // Fetch town list based on selected city
  const { data: towns, isLoading: townsLoading } = useQuery({
    queryKey: ['towns', selectedCity],
    queryFn: () => api.getTowns(selectedCity),
    enabled: !!selectedCity,
  });

  // Reset city when prefecture changes
  useEffect(() => {
    form.setValue('city', '');
    form.setValue('town', '');
  }, [selectedPrefecture]);

  // Reset town when city changes
  useEffect(() => {
    form.setValue('town', '');
  }, [selectedCity]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">都道府県</label>
          <select {...form.register('prefecture')} className="w-full border rounded px-3 py-2">
            <option value="">選択してください</option>
            {PREFECTURES.map(pref => (
              <option key={pref.code} value={pref.code}>{pref.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">市区町村</label>
          <select
            {...form.register('city')}
            className="w-full border rounded px-3 py-2"
            disabled={!selectedPrefecture || citiesLoading}
          >
            <option value="">
              {citiesLoading ? '読み込み中...' : '選択してください'}
            </option>
            {cities?.map(city => (
              <option key={city.code} value={city.code}>{city.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">町名</label>
          <select
            {...form.register('town')}
            className="w-full border rounded px-3 py-2"
            disabled={!selectedCity || townsLoading}
          >
            <option value="">
              {townsLoading ? '読み込み中...' : '選択してください'}
            </option>
            {towns?.map(town => (
              <option key={town.code} value={town.code}>{town.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">番地・建物名</label>
        <input
          {...form.register('address')}
          className="w-full border rounded px-3 py-2"
          placeholder="1-2-3 サンプルビル 4F"
        />
      </div>
    </form>
  );
}
```

### 3.5 Comparison Table of Conditional Form Patterns

| Pattern | Use Case | Advantages | Disadvantages |
|---------|---------|---------|----------|
| `discriminatedUnion` | Completely different fields per option | Type-safe, concise | Handling common fields is verbose |
| `superRefine` | Common fields + conditional validation | Highly flexible | Weak type inference |
| `watch` + dynamic rendering | UI toggling only | Simple | Validation control requires separate handling |
| Cascade select | Data with parent-child relationships | Good UX | More API calls |

---

## 4. Form Auto-Save

### 4.1 Auto-Save with Debounce

Form auto-save is a feature that periodically saves data the user is entering to the server or local storage, preventing data loss due to browser crashes or accidental actions.

```typescript
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';

// Debounce utility
function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Keep the latest version of the callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useMemo(
    () =>
      ((...args: any[]) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
        }, delay);
      }) as T,
    [delay]
  );
}

// Auto-save status type
type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Auto-save hook
function useAutoSave<T extends Record<string, any>>({
  form,
  onSave,
  debounceMs = 1500,
  enabled = true,
}: {
  form: ReturnType<typeof useForm<T>>;
  onSave: (data: Partial<T>) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (data: Partial<T>) => {
    setStatus('saving');
    setError(null);

    try {
      await onSave(data);
      setStatus('saved');
      setLastSaved(new Date());

      // Return to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err : new Error('保存に失敗しました'));
    }
  }, [onSave]);

  const debouncedSave = useDebouncedCallback(save, debounceMs);

  // Watch for form value changes
  useEffect(() => {
    if (!enabled) return;

    const subscription = form.watch((value) => {
      if (form.formState.isDirty) {
        debouncedSave(value as Partial<T>);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave, enabled]);

  return { status, lastSaved, error };
}

// Auto-save status display component
function AutoSaveIndicator({
  status,
  lastSaved,
  error,
}: {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  error: Error | null;
}) {
  const statusConfig = {
    idle: { text: '', className: 'text-gray-400' },
    saving: { text: '保存中...', className: 'text-blue-500' },
    saved: { text: '保存しました', className: 'text-green-500' },
    error: { text: '保存に失敗しました', className: 'text-red-500' },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 text-xs ${config.className}`}>
      {status === 'saving' && (
        <span className="animate-spin inline-block w-3 h-3 border-2
          border-current border-t-transparent rounded-full" />
      )}
      <span>{config.text}</span>
      {lastSaved && status === 'idle' && (
        <span className="text-gray-400">
          最終保存: {lastSaved.toLocaleTimeString()}
        </span>
      )}
      {error && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-red-500 underline ml-2"
        >
          再読み込み
        </button>
      )}
    </div>
  );
}
```

### 4.2 Draft Saving with localStorage

```typescript
// localStorage-based draft management
function useFormDraft<T extends Record<string, any>>(
  key: string,
  defaultValues: T,
  options?: {
    debounceMs?: number;
    expiresInMs?: number; // ドラフトの有効期限
  }
) {
  const { debounceMs = 1000, expiresInMs = 24 * 60 * 60 * 1000 } = options ?? {};

  // Load draft
  const loadDraft = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(`draft:${key}`);
      if (!stored) return null;

      const { data, timestamp } = JSON.parse(stored);
      const isExpired = Date.now() - timestamp > expiresInMs;

      if (isExpired) {
        localStorage.removeItem(`draft:${key}`);
        return null;
      }

      return data as T;
    } catch {
      return null;
    }
  }, [key, expiresInMs]);

  // Save draft
  const saveDraft = useCallback((data: Partial<T>) => {
    try {
      localStorage.setItem(`draft:${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('ドラフトの保存に失敗しました:', error);
    }
  }, [key]);

  // Delete draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(`draft:${key}`);
  }, [key]);

  // Check if draft exists
  const hasDraft = useMemo(() => {
    return loadDraft() !== null;
  }, [loadDraft]);

  // Initial values (prefer draft if available)
  const initialValues = useMemo(() => {
    const draft = loadDraft();
    return draft ?? defaultValues;
  }, [loadDraft, defaultValues]);

  return {
    initialValues,
    hasDraft,
    saveDraft,
    clearDraft,
    loadDraft,
  };
}

// Usage example: Form with draft restoration dialog
function ArticleForm() {
  const {
    initialValues,
    hasDraft,
    saveDraft,
    clearDraft,
  } = useFormDraft('article-editor', {
    title: '',
    content: '',
    tags: [],
    status: 'draft',
  });

  const [showDraftDialog, setShowDraftDialog] = useState(hasDraft);

  const form = useForm({
    defaultValues: showDraftDialog ? initialValues : {
      title: '',
      content: '',
      tags: [],
      status: 'draft',
    },
  });

  const { status } = useAutoSave({
    form,
    onSave: async (data) => {
      saveDraft(data);
    },
    debounceMs: 2000,
  });

  const handleSubmit = async (data: any) => {
    await api.articles.create(data);
    clearDraft(); // 送信成功時にドラフトを削除
  };

  return (
    <>
      {/* Draft restoration dialog */}
      {showDraftDialog && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg
          flex items-center justify-between">
          <p className="text-sm text-yellow-700">
            前回の下書きが見つかりました。復元しますか?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                form.reset(initialValues);
                setShowDraftDialog(false);
              }}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm"
            >
              復元する
            </button>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                setShowDraftDialog(false);
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              破棄する
            </button>
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <AutoSaveIndicator status={status} lastSaved={null} error={null} />
        {/* Form fields */}
      </form>
    </>
  );
}
```

### 4.3 Server-Side Draft Saving

```typescript
// Server-side draft saving (TanStack Query integration)
function useServerDraft<T>({
  draftId,
  defaultValues,
  form,
}: {
  draftId: string | null;
  defaultValues: T;
  form: ReturnType<typeof useForm<T>>;
}) {
  // Load draft
  const { data: savedDraft, isLoading } = useQuery({
    queryKey: ['draft', draftId],
    queryFn: () => api.drafts.get(draftId!),
    enabled: !!draftId,
    staleTime: 0,
  });

  // Save draft
  const saveMutation = useMutation({
    mutationFn: (data: Partial<T>) =>
      draftId
        ? api.drafts.update(draftId, data)
        : api.drafts.create(data),
    onSuccess: (response) => {
      if (!draftId) {
        // Add draft ID to URL on creation
        router.replace(`/editor?draftId=${response.id}`);
      }
    },
  });

  // Auto-save draft
  const { status } = useAutoSave({
    form,
    onSave: async (data) => {
      await saveMutation.mutateAsync(data);
    },
    debounceMs: 3000,
    enabled: !isLoading,
  });

  // Update form when draft is loaded
  useEffect(() => {
    if (savedDraft) {
      form.reset(savedDraft.data as T);
    }
  }, [savedDraft, form]);

  return {
    status,
    isLoading,
    isDraftSaving: saveMutation.isPending,
  };
}
```

---

## 5. Navigation Guard

### 5.1 Navigation Prevention with BeforeUnload Event

```typescript
// Hook to prevent navigation when there are unsaved changes
function useUnsavedChangesWarning(isDirty: boolean, message?: string) {
  const defaultMessage = '変更が保存されていません。ページを離れますか?';

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers do not need returnValue but keep it for compatibility
      e.returnValue = message ?? defaultMessage;
      return message ?? defaultMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);
}

// 使用例
function EditForm() {
  const form = useForm({ defaultValues: { title: '', content: '' } });

  useUnsavedChangesWarning(form.formState.isDirty);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('title')} />
      <textarea {...form.register('content')} />
      <button type="submit">保存</button>
    </form>
  );
}
```

### 5.2 Navigation Prevention with React Router

```typescript
// Preventing route transitions in React Router v6
import { useBlocker, useNavigate } from 'react-router-dom';

function useNavigationBlocker(isDirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  return blocker;
}

// Confirmation dialog component
function UnsavedChangesDialog({
  blocker,
}: {
  blocker: ReturnType<typeof useBlocker>;
}) {
  if (blocker.state !== 'blocked') return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-bold mb-2">変更が保存されていません</h3>
        <p className="text-gray-600 mb-6">
          保存されていない変更があります。このページを離れると変更は失われます。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => blocker.reset()}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            このページにとどまる
          </button>
          <button
            onClick={() => blocker.proceed()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            変更を破棄して移動
          </button>
        </div>
      </div>
    </div>
  );
}

// Integrated usage example
function ProtectedForm() {
  const form = useForm({ defaultValues: { title: '', content: '' } });
  const isDirty = form.formState.isDirty;

  // ブラウザバック・リロード防止
  useUnsavedChangesWarning(isDirty);

  // React Router でのルート遷移防止
  const blocker = useNavigationBlocker(isDirty);

  return (
    <>
      <form onSubmit={form.handleSubmit(async (data) => {
        await api.save(data);
        form.reset(data); // Set isDirty to false
      })}>
        <input {...form.register('title')} />
        <textarea {...form.register('content')} />
        <button type="submit">保存</button>
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
```

### 5.3 Navigation Prevention with Next.js App Router

```typescript
// Navigation prevention for Next.js App Router
// The native useBlocker is unavailable in App Router, so a custom implementation is needed

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useCallback } from 'react';

function useNextNavigationGuard(isDirty: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Handle popstate (browser back)
  useEffect(() => {
    if (!isDirty) return;

    const handlePopState = (e: PopStateEvent) => {
      if (isDirtyRef.current) {
        const confirmed = window.confirm(
          '変更が保存されていません。ページを離れますか?'
        );
        if (!confirmed) {
          // Restore original URL
          window.history.pushState(null, '', pathname);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty, pathname]);

  // Intercept clicks on Link components
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (
        anchor &&
        anchor.href &&
        !anchor.href.startsWith('#') &&
        anchor.target !== '_blank' &&
        isDirtyRef.current
      ) {
        const confirmed = window.confirm(
          '変更が保存されていません。ページを離れますか?'
        );
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty]);

  return { isDirty };
}
```

---

## 6. Performance Optimization for Complex Forms

### 6.1 Minimizing Re-renders

In complex forms, performance tends to degrade as the number of fields increases. React Hook Form is based on uncontrolled components so its baseline performance is good, but improper use of `watch` or `useWatch` can cause unnecessary re-renders.

```typescript
// Anti-pattern: Watching the entire form
function BadPerformanceForm() {
  const form = useForm<LargeFormData>();

  // This entire component re-renders whenever any form value changes
  const allValues = form.watch(); // 非推奨

  return (
    <div>
      {/* 100個のフィールド全てが不要に再レンダリングされる */}
      {Array.from({ length: 100 }, (_, i) => (
        <input key={i} {...form.register(`field_${i}`)} />
      ))}
      <pre>{JSON.stringify(allValues, null, 2)}</pre>
    </div>
  );
}

// Recommended pattern: Watch only needed values individually
function GoodPerformanceForm() {
  const form = useForm<LargeFormData>();

  return (
    <div>
      {Array.from({ length: 100 }, (_, i) => (
        <input key={i} {...form.register(`field_${i}`)} />
      ))}
      {/* 値の表示は別コンポーネントに分離 */}
      <FormDebugger control={form.control} />
    </div>
  );
}

// Separated debugger component
function FormDebugger({ control }: { control: any }) {
  // Only this component re-renders
  const values = useWatch({ control });
  return <pre className="text-xs">{JSON.stringify(values, null, 2)}</pre>;
}
```

### 6.2 Optimization with React.memo

```typescript
// Memoize individual field components
const MemoizedField = React.memo(function MemoizedField({
  name,
  label,
  register,
  error,
  type = 'text',
}: {
  name: string;
  label: string;
  register: any;
  error?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        {...register(name)}
        className={`w-full border rounded px-3 py-2 ${error ? 'border-red-500' : ''}`}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
});

// Memoize controlled components using Controller
const MemoizedSelect = React.memo(function MemoizedSelect({
  name,
  label,
  control,
  options,
}: {
  name: string;
  label: string;
  control: any;
  options: { value: string; label: string }[];
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          <label className="block text-sm font-medium mb-1">{label}</label>
          <select
            {...field}
            className={`w-full border rounded px-3 py-2
              ${fieldState.error ? 'border-red-500' : ''}`}
          >
            <option value="">選択してください</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {fieldState.error && (
            <p className="text-red-500 text-sm mt-1">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
});
```

### 6.3 Virtualization for Large Data Sets

```typescript
import { FixedSizeList as List } from 'react-window';

// Virtualization for a dynamic form with many rows
function VirtualizedFieldArray() {
  const form = useForm<{ items: Array<{ name: string; value: string }> }>({
    defaultValues: {
      items: Array.from({ length: 1000 }, (_, i) => ({
        name: `Item ${i + 1}`,
        value: '',
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <div style={style} className="flex gap-2 items-center px-2">
        <span className="text-gray-400 w-12 text-right text-sm">{index + 1}.</span>
        <input
          {...form.register(`items.${index}.name`)}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
        <input
          {...form.register(`items.${index}.value`)}
          className="flex-1 border rounded px-2 py-1 text-sm"
        />
      </div>
    ),
    [form.register]
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="border rounded-lg overflow-hidden">
        <div className="flex gap-2 px-2 py-2 bg-gray-100 text-sm font-medium">
          <span className="w-12 text-right">#</span>
          <span className="flex-1">名前</span>
          <span className="flex-1">値</span>
        </div>
        <List
          height={400}
          itemCount={fields.length}
          itemSize={40}
          width="100%"
        >
          {Row}
        </List>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        {fields.length}件のアイテム
      </div>

      <button type="submit" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
        保存
      </button>
    </form>
  );
}
```

### 6.4 Performance Comparison Table

| Technique | Target | Effect | Caution |
|------|------|------|--------|
| Individual monitoring with `useWatch` | Referencing specific field values | Limits re-render scope | Field name must be specified |
| `React.memo` | Field components | Prevents unnecessary re-renders | Watch for prop comparison cost |
| Separating `Controller` | Controlled components | Isolates rendering | Increases component count |
| `react-window` | Many fields (100+) | Reduces DOM node count | Be careful of input while scrolling |
| `shouldUnregister: false` | Conditionally shown fields | Preserves data on unmount | Increases memory consumption |
| `mode: 'onSubmit'` | Validation | Reduces validation cost during input | No real-time feedback |

---

## 7. Accessibility

### 7.1 Basic Accessibility Principles for Forms

Accessibility in complex forms is especially important for screen reader users and keyboard navigation users. Follow the principles below.

**WCAG 2.1 AA compliance checklist:**
- All input fields have an appropriate `label` associated
- Error messages are associated via `aria-describedby`
- Required fields are indicated with `aria-required`
- Focus management is handled appropriately
- On error, focus moves to the first field with an error
- Error state is conveyed not only by color but also by text and icons

```tsx
// Accessible form field component
function AccessibleField({
  id,
  label,
  required = false,
  error,
  description,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-required': boolean;
    'aria-describedby': string;
  }) => React.ReactNode;
}) {
  const describedByIds = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(' ');

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="必須">
            *
          </span>
        )}
      </label>

      {description && (
        <p id={`${id}-description`} className="text-xs text-gray-500">
          {description}
        </p>
      )}

      {children({
        id,
        'aria-invalid': !!error,
        'aria-required': required,
        'aria-describedby': describedByIds,
      })}

      {error && (
        <p
          id={`${id}-error`}
          className="text-sm text-red-500 flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <span aria-hidden="true">[!]</span>
          {error}
        </p>
      )}
    </div>
  );
}

// 使用例
function AccessibleForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });

  // Focus the first field with an error when validation fails
  useEffect(() => {
    const errors = form.formState.errors;
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      const element = document.getElementById(firstErrorKey);
      element?.focus();
    }
  }, [form.formState.errors]);

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate // Disable browser default validation
      aria-label="ユーザー登録フォーム"
    >
      <AccessibleField
        id="name"
        label="名前"
        required
        error={form.formState.errors.name?.message}
      >
        {(ariaProps) => (
          <input
            type="text"
            {...form.register('name')}
            {...ariaProps}
            className="w-full border rounded px-3 py-2"
            autoComplete="name"
          />
        )}
      </AccessibleField>

      <AccessibleField
        id="email"
        label="メールアドレス"
        required
        description="確認メールを送信します"
        error={form.formState.errors.email?.message}
      >
        {(ariaProps) => (
          <input
            type="email"
            {...form.register('email')}
            {...ariaProps}
            className="w-full border rounded px-3 py-2"
            autoComplete="email"
          />
        )}
      </AccessibleField>
    </form>
  );
}
```

### 7.2 Accessibility for Multi-Step Forms

```tsx
// Accessible stepper
function AccessibleStepper({
  steps,
  currentStep,
  completedSteps,
}: {
  steps: StepConfig[];
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <nav aria-label="フォームの進捗">
      <ol className="flex gap-2" role="list">
        {steps.map((step, i) => {
          const status = completedSteps.has(i)
            ? 'completed'
            : i === currentStep
            ? 'current'
            : 'upcoming';

          return (
            <li
              key={i}
              className="flex items-center gap-2"
              aria-current={i === currentStep ? 'step' : undefined}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                  ${status === 'current' ? 'bg-blue-600 text-white' : ''}
                  ${status === 'completed' ? 'bg-green-600 text-white' : ''}
                  ${status === 'upcoming' ? 'bg-gray-200 text-gray-500' : ''}
                `}
                aria-hidden="true"
              >
                {status === 'completed' ? '✓' : i + 1}
              </span>
              <span className="sr-only">
                ステップ {i + 1}: {step.title}
                {status === 'completed' && '（完了）'}
                {status === 'current' && '（現在）'}
              </span>
              <span className="hidden sm:inline text-sm" aria-hidden="true">
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ライブリージョンでステップ変更を通知 */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        ステップ {currentStep + 1} / {steps.length}: {steps[currentStep].title}
      </div>
    </nav>
  );
}
```

### 7.3 Accessibility for Dynamic Fields

```tsx
// Accessible dynamic field array
function AccessibleFieldArray() {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const [announcement, setAnnouncement] = useState('');

  const handleAppend = () => {
    append({ name: '', value: '' });
    setAnnouncement(`アイテムを追加しました。合計 ${fields.length + 1} 件です。`);
    // Focus the new field
    setTimeout(() => {
      const newField = document.getElementById(`items-${fields.length}-name`);
      newField?.focus();
    }, 100);
  };

  const handleRemove = (index: number) => {
    const itemName = form.getValues(`items.${index}.name`) || `アイテム ${index + 1}`;
    remove(index);
    setAnnouncement(`${itemName} を削除しました。合計 ${fields.length - 1} 件です。`);
  };

  return (
    <fieldset>
      <legend className="text-lg font-medium mb-4">アイテムリスト</legend>

      {/* Live region: announce operation results */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>

      <div role="list" aria-label="アイテム一覧">
        {fields.map((field, index) => (
          <div
            key={field.id}
            role="listitem"
            className="flex gap-2 items-center mb-2"
            aria-label={`アイテム ${index + 1}`}
          >
            <label htmlFor={`items-${index}-name`} className="sr-only">
              アイテム {index + 1} の名前
            </label>
            <input
              id={`items-${index}-name`}
              {...form.register(`items.${index}.name`)}
              className="flex-1 border rounded px-3 py-2"
              placeholder={`アイテム ${index + 1}`}
            />

            <button
              type="button"
              onClick={() => handleRemove(index)}
              aria-label={`アイテム ${index + 1} を削除`}
              className="p-2 text-red-500 hover:bg-red-50 rounded"
              disabled={fields.length <= 1}
            >
              削除
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAppend}
        className="mt-2 px-4 py-2 border-2 border-dashed rounded-lg w-full"
        aria-label="新しいアイテムを追加"
      >
        + アイテムを追加
      </button>
    </fieldset>
  );
}
```

### 7.4 Keyboard Navigation Support

```typescript
// Keyboard shortcut implementation
function useFormKeyboardShortcuts({
  onSave,
  onCancel,
  onNextStep,
  onPrevStep,
}: {
  onSave?: () => void;
  onCancel?: () => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }

      // Escape: Cancel
      if (e.key === 'Escape') {
        onCancel?.();
      }

      // Ctrl+ArrowRight / Cmd+ArrowRight: Next step
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        onNextStep?.();
      }

      // Ctrl+ArrowLeft / Cmd+ArrowLeft: Previous step
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevStep?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onCancel, onNextStep, onPrevStep]);
}

// Focus trap (for modal forms)
function useFocusTrap(containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef]);
}
```

---

## 8. Form Testing Strategy

### 8.1 Testing Pyramid

Testing for complex forms is conducted in the following layers.

| Layer | Tool | Test Target | Ratio |
|---------|--------|----------|------|
| Unit Test | Vitest / Jest | Schemas, validation logic | 50% |
| Integration Test | Testing Library | Form component behavior | 35% |
| E2E Test | Playwright / Cypress | Full user flows | 15% |

### 8.2 Unit Tests for Schemas

```typescript
import { describe, it, expect } from 'vitest';

describe('step1Schema', () => {
  it('should accept valid data', () => {
    const validData = {
      name: '山田太郎',
      email: 'taro@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    };

    const result = step1Schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail when name is empty', () => {
    const data = {
      name: '',
      email: 'taro@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    };

    const result = step1Schema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('name');
      expect(result.error.errors[0].message).toBe('名前は必須です');
    }
  });

  it('should fail when passwords do not match', () => {
    const data = {
      name: '山田太郎',
      email: 'taro@example.com',
      password: 'Password1',
      confirmPassword: 'Password2',
    };

    const result = step1Schema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('パスワードが一致しません');
    }
  });

  it('should validate password strength requirements', () => {
    const weakPasswords = [
      { pw: 'short', reason: '8文字未満' },
      { pw: 'alllowercase1', reason: '大文字なし' },
      { pw: 'ALLUPPERCASE1', reason: '小文字なし' },
      { pw: 'NoDigitsHere', reason: '数字なし' },
    ];

    weakPasswords.forEach(({ pw, reason }) => {
      const data = {
        name: '山田太郎',
        email: 'taro@example.com',
        password: pw,
        confirmPassword: pw,
      };

      const result = step1Schema.safeParse(data);
      expect(result.success, `${reason}: "${pw}" は拒否されるべき`).toBe(false);
    });
  });

  it('should validate email format', () => {
    const invalidEmails = [
      'not-an-email',
      '@no-local.com',
      'no-domain@',
      'spaces in@email.com',
    ];

    invalidEmails.forEach((email) => {
      const data = {
        name: '山田太郎',
        email,
        password: 'Password1',
        confirmPassword: 'Password1',
      };

      const result = step1Schema.safeParse(data);
      expect(result.success, `"${email}" は拒否されるべき`).toBe(false);
    });
  });
});

describe('orderSchema', () => {
  it('should reject empty product list', () => {
    const data = {
      customerName: 'テスト顧客',
      customerEmail: 'test@example.com',
      shippingAddress: '東京都',
      items: [],
    };

    const result = orderSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('1つ以上の商品を追加してください');
    }
  });

  it('should reject orders exceeding 50 products', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      productId: `prod_${i}`,
      quantity: 1,
      unitPrice: 100,
    }));

    const data = {
      customerName: 'テスト顧客',
      customerEmail: 'test@example.com',
      shippingAddress: '東京都',
      items,
    };

    const result = orderSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('notificationSchema (discriminatedUnion)', () => {
  it('should accept email type notification', () => {
    const data = {
      type: 'email' as const,
      email: 'test@example.com',
      frequency: 'daily' as const,
      format: 'html' as const,
      categories: ['news'],
    };

    const result = notificationSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject short secret for webhook type', () => {
    const data = {
      type: 'webhook' as const,
      url: 'https://example.com/webhook',
      secret: 'short',
      events: ['order.created'],
    };

    const result = notificationSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject unknown type', () => {
    const data = {
      type: 'unknown',
      email: 'test@example.com',
    };

    const result = notificationSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

### 8.3 Integration Tests for Form Components

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('MultiStepForm', () => {
  it('should proceed from step 1 to step 2', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    // ステップ1のフィールドに入力
    await user.type(screen.getByLabelText('名前'), '山田太郎');
    await user.type(screen.getByLabelText('メールアドレス'), 'taro@example.com');
    await user.type(screen.getByLabelText('パスワード'), 'Password1');
    await user.type(screen.getByLabelText('パスワード確認'), 'Password1');

    // 次へボタンをクリック
    await user.click(screen.getByText('次へ'));

    // ステップ2が表示される
    await waitFor(() => {
      expect(screen.getByLabelText('会社名')).toBeInTheDocument();
    });
  });

  it('should not advance step when there are validation errors', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    // Click next without entering anythingをクリック
    await user.click(screen.getByText('次へ'));

    // Error messages are displayed
    await waitFor(() => {
      expect(screen.getByText('名前は必須です')).toBeInTheDocument();
    });

    // ステップ1のままである
    expect(screen.getByLabelText('名前')).toBeInTheDocument();
  });

  it('should return to previous step with Back button', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    // ステップ1を入力して進む
    await user.type(screen.getByLabelText('名前'), '山田太郎');
    await user.type(screen.getByLabelText('メールアドレス'), 'taro@example.com');
    await user.type(screen.getByLabelText('パスワード'), 'Password1');
    await user.type(screen.getByLabelText('パスワード確認'), 'Password1');
    await user.click(screen.getByText('次へ'));

    // ステップ2に到達
    await waitFor(() => {
      expect(screen.getByLabelText('会社名')).toBeInTheDocument();
    });

    // 戻るボタンをクリック
    await user.click(screen.getByText('戻る'));

    // ステップ1に戻り、入力値が保持されている
    await waitFor(() => {
      expect(screen.getByLabelText('名前')).toHaveValue('山田太郎');
    });
  });
});

describe('OrderForm', () => {
  const mockProducts: Product[] = [
    { id: 'prod_1', name: 'Widget A', price: 1000, stock: 100, category: 'widget' },
    { id: 'prod_2', name: 'Widget B', price: 2000, stock: 50, category: 'widget' },
  ];

  it('should be able to add product rows', async () => {
    const user = userEvent.setup();
    render(<OrderForm products={mockProducts} />);

    // 追加ボタンをクリック
    await user.click(screen.getByText('+ 商品を追加'));

    // 2行に増える
    const productSelects = screen.getAllByRole('combobox');
    expect(productSelects.length).toBeGreaterThan(1);
  });

  it('should be able to delete product rows', async () => {
    const user = userEvent.setup();
    render(<OrderForm products={mockProducts} />);

    // 2行追加
    await user.click(screen.getByText('+ 商品を追加'));

    // 削除ボタンをクリック
    const deleteButtons = screen.getAllByTitle('削除');
    await user.click(deleteButtons[0]);

    // 1行に戻る
    await waitFor(() => {
      expect(screen.queryAllByTitle('削除')).toHaveLength(0);
    });
  });

  it('should not be able to delete the last row', () => {
    render(<OrderForm products={mockProducts} />);

    // 削除ボタンが表示されない
    expect(screen.queryByTitle('削除')).not.toBeInTheDocument();
  });
});
```

### 8.4 E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should complete all steps and register', async ({ page }) => {
    await page.goto('/register');

    // Step 1: Account Information
    await page.fill('[name="name"]', '山田太郎');
    await page.fill('[name="email"]', 'taro@example.com');
    await page.fill('[name="password"]', 'Password1');
    await page.fill('[name="confirmPassword"]', 'Password1');
    await page.click('button:text("次へ")');

    // Step 2: Profile
    await expect(page.locator('[name="company"]')).toBeVisible();
    await page.fill('[name="company"]', '株式会社テスト');
    await page.selectOption('[name="role"]', 'developer');
    await page.fill('[name="experience"]', '5');
    await page.click('button:text("次へ")');

    // Step 3: Plan Selection
    await expect(page.locator('[name="plan"]')).toBeVisible();
    await page.click('label:text("プロプラン")');
    await page.check('[name="agreed"]');
    await page.click('button:text("登録する")');

    // Redirect to completion page
    await expect(page).toHaveURL('/registration/complete');
    await expect(page.locator('h1')).toContainText('登録完了');
  });

  test('should display error messages on validation error', async ({ page }) => {
    await page.goto('/register');

    // Click next without entering anything
    await page.click('button:text("次へ")');

    // Error messages are displayed
    await expect(page.locator('text=名前は必須です')).toBeVisible();
    await expect(page.locator('text=有効なメールアドレスを入力してください')).toBeVisible();
  });

  test('should show confirmation dialog when leaving page', async ({ page }) => {
    await page.goto('/register');

    // Enter data in form
    await page.fill('[name="name"]', '山田太郎');

    // Attempt to leave the page
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('beforeunload');
      await dialog.accept();
    });

    await page.goto('/');
  });
});
```

---

## 9. Troubleshooting

### 9.1 Common Issues and Solutions

| Problem | Cause | Solution |
|------|------|--------|
| `watch` value is undefined | `defaultValues` not set | Always pass `defaultValues` to `useForm` |
| `useFieldArray` rows are duplicated | `index` used as `key` | Use `field.id` as `key` |
| Old values remain in conditional form | Misconfigured `shouldUnregister` | Set `shouldUnregister: true` or call `reset` on type change |
| `resolver` changes not reflected | `resolver` not re-evaluated on step change | Dynamically switch `resolver` per step |
| Validation does not run after form submission | `mode` remains `onSubmit` | Switch to `mode: 'onChange'` after submission or manually call `trigger()` |
| Value not reflected in uncontrolled component | `register` not used | Use `Controller` or manually set with `setValue` |
| `defaultValues` changes not reflected | `defaultValues` changed after form initialization | Call `reset(newDefaultValues)` |
| Form is slow with many fields | All fields re-render | Optimize with `React.memo` and `useWatch` |

### 9.2 Debug Tools

```typescript
// Form state debug component (use during development only)
function FormDevTools<T extends Record<string, any>>({
  form,
}: {
  form: ReturnType<typeof useForm<T>>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const values = useWatch({ control: form.control });
  const { errors, dirtyFields, touchedFields, isValid, isDirty, isSubmitting } =
    form.formState;

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="bg-gray-900 text-white px-3 py-1 rounded-full text-xs"
      >
        {isOpen ? 'DevTools [x]' : 'DevTools [o]'}
      </button>

      {isOpen && (
        <div className="absolute bottom-10 right-0 w-96 max-h-96 overflow-auto
          bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono shadow-xl">
          <h4 className="text-white font-bold mb-2">Form State</h4>

          <div className="space-y-2">
            <div>
              <span className="text-gray-400">isValid:</span>{' '}
              <span className={isValid ? 'text-green-400' : 'text-red-400'}>
                {String(isValid)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">isDirty:</span>{' '}
              {String(isDirty)}
            </div>
            <div>
              <span className="text-gray-400">isSubmitting:</span>{' '}
              {String(isSubmitting)}
            </div>
          </div>

          <h4 className="text-white font-bold mt-4 mb-2">Values</h4>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(values, null, 2)}
          </pre>

          {Object.keys(errors).length > 0 && (
            <>
              <h4 className="text-red-400 font-bold mt-4 mb-2">Errors</h4>
              <pre className="whitespace-pre-wrap text-red-400">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(errors).map(([key, val]: [string, any]) => [
                      key,
                      val?.message ?? val,
                    ])
                  ),
                  null,
                  2
                )}
              </pre>
            </>
          )}

          <h4 className="text-white font-bold mt-4 mb-2">Dirty Fields</h4>
          <pre className="whitespace-pre-wrap text-yellow-400">
            {JSON.stringify(dirtyFields, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### 9.3 Error Handling Best Practices

```typescript
// Global error handling
function useFormErrorHandler() {
  const handleFormError = useCallback((error: unknown) => {
    // Zod validation error
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      );
      toast.error(`バリデーションエラー:\n${messages.join('\n')}`);
      return;
    }

    // API error
    if (error instanceof ApiError) {
      switch (error.status) {
        case 400:
          toast.error('入力内容に誤りがあります。確認してください。');
          break;
        case 409:
          toast.error('このメールアドレスは既に登録されています。');
          break;
        case 422:
          // Server-side validation error
          if (error.fieldErrors) {
            // Reflect error in form
            Object.entries(error.fieldErrors).forEach(([field, message]) => {
              form.setError(field as any, {
                type: 'server',
                message: message as string,
              });
            });
          }
          break;
        case 429:
          toast.error('リクエストが多すぎます。しばらくしてから再試行してください。');
          break;
        case 500:
          toast.error('サーバーエラーが発生しました。しばらくしてから再試行してください。');
          break;
        default:
          toast.error('予期しないエラーが発生しました。');
      }
      return;
    }

    // Network error
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      toast.error('ネットワークエラー: インターネット接続を確認してください。');
      return;
    }

    // Other errors
    console.error('Unhandled form error:', error);
    toast.error('予期しないエラーが発生しました。');
  }, []);

  return { handleFormError };
}

// Server-side validation errorの統合
async function submitWithServerValidation<T>(
  form: ReturnType<typeof useForm<T>>,
  data: T,
  submitFn: (data: T) => Promise<void>
) {
  try {
    await submitFn(data);
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      // Reflect server field errors in form
      Object.entries(error.fieldErrors).forEach(([field, message]) => {
        form.setError(field as any, {
          type: 'server',
          message: message as string,
        });
      });

      // Focus the first error field
      const firstErrorField = Object.keys(error.fieldErrors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element instanceof HTMLElement) {
        element.focus();
      }
    } else {
      throw error;
    }
  }
}
```

---

## Summary

### Overview of Complex Form Patterns

| Pattern | Purpose | Main Tools | Difficulty |
|---------|------|----------|--------|
| Multi-step | Wizard-style registration flow | useForm + useState | Medium |
| useFieldArray | Dynamic array fields | useFieldArray | Medium |
| Nested array | Invoice line items (section structure) | Nested useFieldArray | High |
| discriminatedUnion | Conditional validation | Zod discriminatedUnion | Medium |
| superRefine | Complex conditional validation | Zod superRefine | High |
| Cascade select | Parent-child linked selects | watch + useEffect | Medium |
| Auto-save | Draft saving | useWatch + debounce | Low–Medium |
| Draft restore | Resuming after abandonment | localStorage / API | Medium |
| Navigation guard | Protecting unsaved data | beforeunload / useBlocker | Low |
| Virtualization | Optimizing many fields | react-window | High |
| Drag and drop | Reordering fields | dnd-kit + useFieldArray.move | High |

### Decision Flowchart for Design Choices

```
フォームにどのパターンが必要か?

1. フィールドが多い（10個以上）?
   → YES: マルチステップフォームを検討
   → NO: シングルページフォーム

2. 動的にフィールドを追加/削除する?
   → YES: useFieldArray を使用
   → NO: 静的なフォーム

3. 選択に応じてフィールドが変わる?
   → YES: discriminatedUnion または superRefine
   → NO: 固定フィールド

4. 入力途中のデータを保護する必要がある?
   → YES: 自動保存 + 離脱防止
   → NO: 送信時のみ処理

5. フィールド数が100を超える?
   → YES: 仮想化（react-window）を検討
   → NO: 通常のレンダリング
```

### Best Practice Checklist

- [ ] All fields have `defaultValues` set
- [ ] `field.id` is used as key in `useFieldArray`
- [ ] Error messages are clearly written and understandable
- [ ] Required fields are visually distinguishable
- [ ] Focus management (auto-focus on error) is implemented
- [ ] `aria-invalid` and `aria-describedby` are set
- [ ] Performance optimization is applied when there are many fields
- [ ] A progress indicator is present for multi-step forms
- [ ] Navigation guard for unsaved data is implemented
- [ ] Server-side validation errors are reflected in the form
- [ ] Tests (unit, integration, E2E) are appropriately written
- [ ] TypeScript type safety is ensured

---

## Frequently Asked Questions (FAQ)

### Q1. How should I implement dynamic field addition and deletion?

**A:** Using React Hook Form's **`useFieldArray`** is the most robust approach. Managing arrays manually makes key management and validation synchronization complex.

**Basic pattern:**

```typescript
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  members: z.array(
    z.object({
      name: z.string().min(1, '名前は必須です'),
      email: z.string().email('有効なメールアドレスを入力してください'),
    })
  ).min(1, '少なくとも1人のメンバーが必要です'),
});

type FormData = z.infer<typeof schema>;

function DynamicFieldForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      members: [{ name: '', email: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'members',
  });

  return (
    <form onSubmit={form.handleSubmit((data) => console.log(data))}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...form.register(`members.${index}.name`)} placeholder="名前" />
          <input {...form.register(`members.${index}.email`)} placeholder="メール" />
          <button type="button" onClick={() => remove(index)}>削除</button>
        </div>
      ))}

      <button type="button" onClick={() => append({ name: '', email: '' })}>
        メンバーを追加
      </button>

      <button type="submit">送信</button>
    </form>
  );
}
```

**Key points:**

1. **Use `field.id` as key**: Write `fields.map((field, index) => <div key={field.id}>)`. Using `index` as key causes incorrect field validation on deletion
2. **Set default values**: Specify the initial array with `defaultValues`
3. **Control min/max count with Zod schema**: Validate array length with `.min(1)` or `.max(10)`
4. **Confirm before deletion**: Show a confirmation dialog to prevent accidental deletion

**Complex case: Nested dynamic fields**

```typescript
const schema = z.object({
  teams: z.array(
    z.object({
      teamName: z.string(),
      members: z.array(
        z.object({
          name: z.string(),
          role: z.string(),
        })
      ),
    })
  ),
});

function NestedDynamicFields() {
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const { fields: teamFields, append: appendTeam } = useFieldArray({
    control: form.control,
    name: 'teams',
  });

  return (
    <form>
      {teamFields.map((team, teamIndex) => (
        <div key={team.id}>
          <input {...form.register(`teams.${teamIndex}.teamName`)} />

          <NestedMembers teamIndex={teamIndex} control={form.control} />

          <button type="button" onClick={() => appendTeam({ teamName: '', members: [] })}>
            チームを追加
          </button>
        </div>
      ))}
    </form>
  );
}

function NestedMembers({ teamIndex, control }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `teams.${teamIndex}.members`,
  });

  return (
    <>
      {fields.map((member, memberIndex) => (
        <div key={member.id}>
          <input {...form.register(`teams.${teamIndex}.members.${memberIndex}.name`)} />
          <button onClick={() => remove(memberIndex)}>削除</button>
        </div>
      ))}
      <button onClick={() => append({ name: '', role: '' })}>メンバー追加</button>
    </>
  );
}
```

### Q2. How should I optimize form performance?

**A:** For large forms (50+ fields), the following optimizations are essential:

**1. React Hook Form mode setting**

```typescript
const form = useForm({
  mode: 'onBlur', // デフォルトは 'onChange'（入力中に毎回バリデーション）
  // onBlur: フォーカスアウト時にバリデーション（推奨）
  // onSubmit: 送信時のみバリデーション（最もパフォーマンス良好）
});
```

**2. Prevent unnecessary re-renders**

```typescript
// ❌ 悪い例: フォーム全体が再レンダリングされる
const { watch } = useForm();
const allValues = watch(); // 全フィールドを監視

// ✅ 良い例: 必要なフィールドだけ監視
const email = watch('email');
```

**3. Component splitting**

```typescript
// ❌ 悪い例: 1つの巨大なコンポーネント
function MassiveForm() {
  const form = useForm();
  return (
    <form>
      {/* 100個のinputが全て再レンダリング */}
      <input {...form.register('field1')} />
      <input {...form.register('field2')} />
      {/* ... */}
    </form>
  );
}

// ✅ 良い例: セクションごとに分割
function OptimizedForm() {
  const form = useForm();
  return (
    <FormProvider {...form}>
      <PersonalInfoSection />
      <AddressSection />
      <PaymentSection />
    </FormProvider>
  );
}

function PersonalInfoSection() {
  const { register } = useFormContext();
  return (
    <div>
      <input {...register('name')} />
      <input {...register('email')} />
    </div>
  );
}
```

**4. Prevent unnecessary re-renders with React.memo**

```typescript
const FormField = React.memo(({ name, label }: { name: string; label: string }) => {
  const { register } = useFormContext();
  return (
    <div>
      <label>{label}</label>
      <input {...register(name)} />
    </div>
  );
});
```

**5. Performance optimization for useFieldArray**

```typescript
// 大量の動的フィールド（100個以上）がある場合
const { fields } = useFieldArray({ name: 'items' });

// react-window で仮想スクロール
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={fields.length}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>
      <input {...register(`items.${index}.name`)} />
    </div>
  )}
</FixedSizeList>
```

**6. Zod schema optimization**

```typescript
// ❌ 悪い例: 複雑な正規表現やカスタムバリデーション
const schema = z.object({
  email: z.string().refine(async (val) => {
    // 非同期バリデーションが毎回走る
    const exists = await checkEmailExists(val);
    return !exists;
  }),
});

// ✅ 良い例: 基本的なバリデーションはZod、非同期はonBlurで
const schema = z.object({
  email: z.string().email(), // シンプルなバリデーション
});

<input
  {...form.register('email', {
    onBlur: async (e) => {
      // フォーカスアウト時のみ非同期チェック
      const exists = await checkEmailExists(e.target.value);
      if (exists) form.setError('email', { message: '既に使用されています' });
    },
  })}
/>
```

### Q3. How should I handle form processing with Server Actions?

**A:** In Next.js 14 and later, **Server Actions** are the standard pattern for form submission:

**Basic pattern:**

```typescript
// app/actions/user.ts
'use server';

import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function createUser(formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
  };

  // バリデーション
  const result = userSchema.safeParse(rawData);
  if (!result.success) {
    return { errors: result.error.flatten() };
  }

  // データベース保存
  await db.user.create({ data: result.data });

  return { success: true };
}

// app/page.tsx
import { createUser } from './actions/user';

export default function Page() {
  return (
    <form action={createUser}>
      <input name="name" />
      <input name="email" />
      <button type="submit">送信</button>
    </form>
  );
}
```

**React Hook Form + Server Actions integration (recommended):**

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUser } from './actions/user';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type FormData = z.infer<typeof schema>;

export default function UserForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);

    const result = await createUser(formData);

    if (result.errors) {
      // サーバー側のバリデーションエラーをフォームに反映
      Object.entries(result.errors.fieldErrors).forEach(([field, errors]) => {
        form.setError(field as keyof FormData, {
          message: errors?.[0],
        });
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('name')} />
      {form.formState.errors.name && <p>{form.formState.errors.name.message}</p>}

      <input {...form.register('email')} />
      {form.formState.errors.email && <p>{form.formState.errors.email.message}</p>}

      <button type="submit">送信</button>
    </form>
  );
}
```

**Optimistic updates with useActionState:**

```typescript
'use client';

import { useActionState } from 'react';
import { createUser } from './actions/user';

export default function UserForm() {
  const [state, formAction, isPending] = useActionState(createUser, null);

  return (
    <form action={formAction}>
      <input name="name" />
      {state?.errors?.name && <p>{state.errors.name[0]}</p>}

      <input name="email" />
      {state?.errors?.email && <p>{state.errors.email[0]}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? '送信中...' : '送信'}
      </button>
    </form>
  );
}
```

**Best practices:**

1. **Client-server double validation**: Client for UX, server for security
2. **Share the same Zod schema**: Centralize schema management via monorepo or shared packages
3. **Optimistic updates**: Immediately update UI with `useOptimistic`, roll back on error
4. **revalidatePath**: Invalidate cache after data updates in Server Actions

---

## What to Read Next

---

## References
1. React Hook Form. "useFieldArray." react-hook-form.com, 2024.
2. React Hook Form. "Performance Optimization." react-hook-form.com, 2024.
3. Zod. "Discriminated Unions." zod.dev, 2024.
4. Zod. "superRefine." zod.dev, 2024.
5. W3C. "Web Content Accessibility Guidelines (WCAG) 2.1." w3.org, 2018.
6. WAI-ARIA. "ARIA Authoring Practices Guide - Forms." w3.org, 2024.
7. Testing Library. "React Testing Library - User Event." testing-library.com, 2024.
8. Playwright. "Test Generator." playwright.dev, 2024.
9. @dnd-kit. "Sortable." dndkit.com, 2024.
10. react-window. "Windowed Rendering." react-window.vercel.app, 2024.
