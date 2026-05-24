# Component Type Definitions — The Complete Guide

## What You Will Learn

In this chapter, you will learn every pattern for implementing React components in a type-safe way with TypeScript.

- Why not to use React.FC and the recommended alternative
- Basic and advanced Props type definitions
- Discriminated Union (conditional Props)
- Inheriting HTML attributes
- Ref type definitions and forwardRef
- Correct typing for children
- Practical use of Utility Types
- Event handler type definitions

**Prerequisites**: Basic TypeScript syntax

**Estimated time**: 40–50 minutes


## Table of Contents

1. [Component Type Definition Patterns](#1-component-type-definition-patterns)
2. [Advanced Props Type Patterns](#2-advanced-props-type-patterns)
3. [Discriminated Union (Conditional Props)](#3-discriminated-union-conditional-props)
4. [Inheriting HTML Attributes](#4-inheriting-html-attributes)
5. [Ref Type Definitions and Forwarding](#5-ref-type-definitions-and-forwarding)
6. [Children Type Definitions](#6-children-type-definitions)
7. [Event Handler Types](#7-event-handler-types)
8. [Using Utility Types](#8-using-utility-types)
9. [Practical Examples: Type-Safe Component Collection](#9-practical-examples-type-safe-component-collection)
10. [Summary](#10-summary)


## 1. Component Type Definition Patterns

### Why Not to Use React.FC

```typescript
// ❌ React.FC (not recommended)
const Component: React.FC<Props> = ({ name }) => {
  return <div>{name}</div>
}

// Problems:
// 1. Implicitly includes children (reduces type safety)
// 2. Poor compatibility with generics
// 3. Compatibility issues with default props
```

**Problems with React.FC**:

1. **Implicit children**: `children` is automatically included without being explicitly defined
2. **Generic constraint**: Syntax becomes complex when using generic type parameters
3. **Default props incompatibility**: Poor compatibility with default props since TypeScript 3.1

### Recommended Patterns

```typescript
// - Regular function (recommended)
interface Props {
  name: string
  age: number
}

function Component({ name, age }: Props) {
  return (
    <div>
      {name} is {age} years old
    </div>
  )
}

// - Arrow function (recommended)
const Component = ({ name, age }: Props) => {
  return (
    <div>
      {name} is {age} years old
    </div>
  )
}

// With explicit return type
function Component({ name, age }: Props): JSX.Element {
  return (
    <div>
      {name} is {age} years old
    </div>
  )
}
```

### Basic Props Type Definitions

```typescript
// Primitive types
interface BasicProps {
  title: string
  count: number
  isActive: boolean
}

// Optional
interface OptionalProps {
  title: string
  subtitle?: string // optional
}

// Union types
interface UnionProps {
  variant: 'primary' | 'secondary' | 'danger'
  size: 'sm' | 'md' | 'lg'
}

// Object types
interface User {
  id: string
  name: string
  email: string
}

interface ObjectProps {
  user: User
  onUpdate: (user: User) => void
}

// Array types
interface ArrayProps {
  tags: string[]
  users: User[]
}

// Function types
interface FunctionProps {
  onClick: () => void
  onSubmit: (value: string) => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}
```

**Implementation example**:

```typescript
interface UserCardProps {
  user: User
  variant: 'compact' | 'full'
  onEdit?: (user: User) => void
}

function UserCard({ user, variant, onEdit }: UserCardProps) {
  return (
    <div className={`user-card user-card--${variant}`}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      {onEdit && (
        <button onClick={() => onEdit(user)}>Edit</button>
      )}
    </div>
  )
}

// Usage
<UserCard
  user={{ id: '1', name: 'John', email: 'john@example.com' }}
  variant="full"
  onEdit={(user) => console.log('Editing', user)}
/>
```


## 2. Advanced Props Type Patterns

### Props with Default Values

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

// Set default values
function Button({
  variant = 'primary',
  size = 'md',
  children
}: ButtonProps) {
  return (
    <button className={`btn btn-${variant} btn-${size}`}>
      {children}
    </button>
  )
}

// Usage
<Button>Click me</Button> // variant='primary', size='md'
<Button variant="secondary" size="lg">Large Button</Button>
```

### Required Props

```typescript
interface OptionalConfig {
  theme?: 'light' | 'dark'
  locale?: string
  debug?: boolean
}

// Make all properties required
type RequiredConfig = Required<OptionalConfig>

function applyConfig(config: RequiredConfig) {
  // All properties are guaranteed to exist
  console.log(config.theme)  // always present
  console.log(config.locale) // always present
  console.log(config.debug)  // always present
}
```

### Partial Props

```typescript
interface FormData {
  username: string
  email: string
  age: number
}

// Make all properties optional
type PartialFormData = Partial<FormData>

interface FormProps {
  initialValues?: Partial<FormData>
  onSubmit: (data: FormData) => void
}

function Form({ initialValues = {}, onSubmit }: FormProps) {
  const [formData, setFormData] = useState<FormData>({
    username: initialValues.username ?? '',
    email: initialValues.email ?? '',
    age: initialValues.age ?? 0
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      onSubmit(formData)
    }}>
      {/* form implementation */}
    </form>
  )
}

// Usage
<Form
  initialValues={{ username: 'John' }} // email and age can be omitted
  onSubmit={(data) => console.log(data)}
/>
```


## 3. Discriminated Union (Conditional Props)

### Basic Pattern

```typescript
// ❌ Problem: props change based on variant, but this isn't expressed in the type
interface BadButtonProps {
  variant: 'link' | 'button'
  href?: string    // only needed when variant is 'link'
  onClick?: () => void // only needed when variant is 'button'
}

// Problems at usage
<BadButton variant="link" onClick={() => {}} /> // ❌ link but with onClick?
<BadButton variant="button" href="/home" />     // ❌ button but with href?
```

```typescript
// - Solution: Discriminated Union
type ButtonProps =
  | {
      variant: 'link'
      href: string
      onClick?: never // cannot be used when variant is 'button'
    }
  | {
      variant: 'button'
      onClick: () => void
      href?: never // cannot be used when variant is 'link'
    }

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    // TypeScript guarantees props.href exists
    return <a href={props.href}>Link</a>
  }

  // TypeScript guarantees props.onClick exists
  return <button onClick={props.onClick}>Button</button>
}

// Usage
<Button variant="link" href="/home" />         // - OK
<Button variant="button" onClick={() => {}} /> // - OK
<Button variant="link" onClick={() => {}} />   // ❌ type error
<Button variant="button" href="/home" />       // ❌ type error
```

### Complex Discriminated Union

```typescript
// Form input type (props change based on inputType)
type InputProps =
  | {
      inputType: 'text'
      value: string
      onChange: (value: string) => void
    }
  | {
      inputType: 'number'
      value: number
      onChange: (value: number) => void
      min?: number
      max?: number
    }
  | {
      inputType: 'select'
      value: string
      onChange: (value: string) => void
      options: Array<{ label: string; value: string }>
    }

function FormInput(props: InputProps) {
  switch (props.inputType) {
    case 'text':
      return (
        <input
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
          min={props.min}
          max={props.max}
        />
      )

    case 'select':
      return (
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
  }
}

// Usage
<FormInput
  inputType="text"
  value="hello"
  onChange={(v) => console.log(v)}
/>

<FormInput
  inputType="number"
  value={42}
  onChange={(v) => console.log(v)}
  min={0}
  max={100}
/>

<FormInput
  inputType="select"
  value="apple"
  onChange={(v) => console.log(v)}
  options={[
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' }
  ]}
/>
```


## 4. Inheriting HTML Attributes

### Button Component

```typescript
// Inherit HTMLButtonElement attributes
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

function Button({
  variant = 'primary',
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}

// Usage (all button attributes are available)
<Button
  variant="primary"
  onClick={() => console.log('clicked')}
  disabled
  type="submit"
  aria-label="Submit button"
  data-testid="submit-btn"
>
  Submit
</Button>
```

### Input Component

```typescript
// Inherit HTMLInputElement attributes
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="input-wrapper">
      <label>{label}</label>
      <input
        className={`input ${error ? 'input--error' : ''} ${className}`}
        aria-invalid={!!error}
        {...props}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  )
}

// Usage
<Input
  label="Email"
  type="email"
  placeholder="your@email.com"
  required
  autoComplete="email"
  error="Invalid email address"
/>
```

### Container Component

```typescript
// Inherit HTMLDivElement attributes
interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: number
  centered?: boolean
}

function Container({
  maxWidth,
  centered = false,
  children,
  style,
  ...props
}: ContainerProps) {
  return (
    <div
      style={{
        ...style,
        maxWidth,
        margin: centered ? '0 auto' : undefined
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Usage
<Container
  maxWidth={1200}
  centered
  className="main-container"
  onClick={() => console.log('Container clicked')}
  data-testid="main-container"
>
  <h1>Content</h1>
</Container>
```


## 5. Ref Type Definitions and Forwarding

### Forwarding Refs with forwardRef

```typescript
interface InputProps {
  label: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error }, ref) => {
    return (
      <div>
        <label>{label}</label>
        <input ref={ref} aria-invalid={!!error} />
        {error && <span>{error}</span>}
      </div>
    )
  }
)

// Set displayName (shown in DevTools)
Input.displayName = 'Input'

// Usage
function Parent() {
  const inputRef = useRef<HTMLInputElement>(null)

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <>
      <Input ref={inputRef} label="Name" />
      <button onClick={focusInput}>Focus Input</button>
    </>
  )
}
```

### Exposing a Custom Ref with useImperativeHandle

```typescript
interface InputHandle {
  focus: () => void
  clear: () => void
  getValue: () => string
}

interface InputProps {
  label: string
  defaultValue?: string
}

const CustomInput = forwardRef<InputHandle, InputProps>(
  ({ label, defaultValue }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus()
      },
      clear: () => {
        if (inputRef.current) {
          inputRef.current.value = ''
        }
      },
      getValue: () => {
        return inputRef.current?.value ?? ''
      }
    }))

    return (
      <div>
        <label>{label}</label>
        <input ref={inputRef} defaultValue={defaultValue} />
      </div>
    )
  }
)

CustomInput.displayName = 'CustomInput'

// Usage
function Parent() {
  const inputRef = useRef<InputHandle>(null)

  const handleSubmit = () => {
    const value = inputRef.current?.getValue()
    console.log('Value:', value)
    inputRef.current?.clear()
  }

  return (
    <>
      <CustomInput ref={inputRef} label="Name" defaultValue="John" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
      <button onClick={handleSubmit}>Submit & Clear</button>
    </>
  )
}
```


## 6. Children Type Definitions

### ReactNode (Most General)

```typescript
interface Props {
  children: React.ReactNode
}

function Container({ children }: Props) {
  return <div className="container">{children}</div>
}

// Usage (accepts any element)
<Container>
  <p>Text</p>
  {[1, 2, 3]}
  {null}
  {undefined}
  <div>Nested</div>
</Container>
```

### ReactElement (Specific Element Only)

```typescript
interface Props {
  children: React.ReactElement
}

function Wrapper({ children }: Props) {
  return <div className="wrapper">{children}</div>
}

// Usage
<Wrapper>
  <p>Only one element allowed</p>
</Wrapper>

// ❌ Error
<Wrapper>
  <p>Multiple</p>
  <p>Elements</p>
</Wrapper>
```

### Render Props Pattern

```typescript
interface User {
  id: string
  name: string
  email: string
}

interface Props {
  children: (data: User) => React.ReactNode
}

function UserProvider({ children }: Props) {
  const user: User = {
    id: '1',
    name: 'John',
    email: 'john@example.com'
  }

  return <>{children(user)}</>
}

// Usage
<UserProvider>
  {(user) => (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )}
</UserProvider>
```

### Allowing Only Specific Components

```typescript
interface ItemProps {
  name: string
}

function Item({ name }: ItemProps) {
  return <li>{name}</li>
}

interface ListProps {
  children: React.ReactElement<ItemProps> | React.ReactElement<ItemProps>[]
}

function List({ children }: ListProps) {
  return <ul>{children}</ul>
}

// Usage
<List>
  <Item name="Apple" />
  <Item name="Banana" />
</List>

// ❌ Error
<List>
  <div>Not an Item</div>
</List>
```


## 7. Event Handler Types

### Basic Event Types

```typescript
// Mouse event
function Button() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Button clicked at', e.clientX, e.clientY)
    e.currentTarget.disabled = true // recognized as HTMLButtonElement
  }

  return <button onClick={handleClick}>Click me</button>
}

// Change event (input)
function TextInput() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Value:', e.target.value)
  }

  return <input onChange={handleChange} />
}

// Change event (select)
function Select() {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log('Selected:', e.target.value)
  }

  return (
    <select onChange={handleChange}>
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
    </select>
  )
}

// Form event
function Form() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    console.log('Form data:', Object.fromEntries(formData))
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="username" />
      <button type="submit">Submit</button>
    </form>
  )
}

// Keyboard event
function KeyboardInput() {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      console.log('Enter pressed')
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      console.log('Ctrl+S pressed')
    }
  }

  return <input onKeyDown={handleKeyDown} />
}

// Focus event
function FocusInput() {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select() // select all text
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    console.log('Input blurred')
  }

  return <input onFocus={handleFocus} onBlur={handleBlur} />
}
```

### Leveraging Type Inference

```typescript
// ❌ Explicit type annotation (verbose)
function Component() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Clicked')
  }

  return <button onClick={handleClick}>Click</button>
}

// - Inline definition (type inference)
function Component() {
  return (
    <button onClick={(e) => {
      // e is automatically inferred as React.MouseEvent<HTMLButtonElement>
      console.log('Clicked at', e.clientX, e.clientY)
    }}>
      Click
    </button>
  )
}
```

### Custom Event Handlers

```typescript
interface User {
  id: string
  name: string
}

interface UserListProps {
  users: User[]
  onUserSelect: (user: User) => void
  onUserDelete: (userId: string) => void
}

function UserList({ users, onUserSelect, onUserDelete }: UserListProps) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <button onClick={() => onUserSelect(user)}>
            {user.name}
          </button>
          <button onClick={() => onUserDelete(user.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}

// Async event handler
interface AsyncButtonProps {
  onAsyncClick: () => Promise<void>
  children: React.ReactNode
}

function AsyncButton({ onAsyncClick, children }: AsyncButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await onAsyncClick()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Loading...' : children}
    </button>
  )
}
```

### Event Handler Type Aliases

```typescript
// Reusable type aliases
type ClickHandler = React.MouseEventHandler<HTMLButtonElement>
type ChangeHandler = React.ChangeEventHandler<HTMLInputElement>
type SubmitHandler = React.FormEventHandler<HTMLFormElement>

interface FormProps {
  onSubmit: SubmitHandler
  onChange: ChangeHandler
}

function Form({ onSubmit, onChange }: FormProps) {
  return (
    <form onSubmit={onSubmit}>
      <input onChange={onChange} />
      <button type="submit">Submit</button>
    </form>
  )
}
```


## 8. Using Utility Types

### Omit to Exclude Properties

```typescript
// Original type
interface FullUser {
  id: string
  name: string
  email: string
  password: string
  createdAt: Date
}

// Type with password excluded
type PublicUser = Omit<FullUser, 'password'>

// Exclude multiple properties
type UserSummary = Omit<FullUser, 'password' | 'createdAt'>

interface UserCardProps {
  user: PublicUser
}

function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {/* user.password does not exist */}
    </div>
  )
}
```

### Pick to Extract Only Needed Properties

```typescript
// Original type
interface FullProduct {
  id: string
  name: string
  description: string
  price: number
  stock: number
  categoryId: string
  images: string[]
}

// Only the properties we need
type ProductSummary = Pick<FullProduct, 'id' | 'name' | 'price'>

interface ProductCardProps {
  product: ProductSummary
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  )
}
```

### Readonly to Make Immutable

```typescript
interface MutableUser {
  id: string
  name: string
}

type ImmutableUser = Readonly<MutableUser>

function Component() {
  const user: ImmutableUser = { id: '1', name: 'John' }

  user.name = 'Jane' // ❌ type error: read-only property
}

// Make nested objects immutable too (DeepReadonly)
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K]
}

interface NestedData {
  user: {
    name: string
    address: {
      city: string
    }
  }
}

type ImmutableNestedData = DeepReadonly<NestedData>

const data: ImmutableNestedData = {
  user: {
    name: 'John',
    address: { city: 'Tokyo' }
  }
}

data.user.address.city = 'Osaka' // ❌ type error
```


## 9. Practical Examples: Type-Safe Component Collection

### 1. Type-Safe Button Component

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  )
}

// Usage
<Button variant="primary" size="lg" onClick={() => console.log('Clicked')}>
  Click me
</Button>

<Button variant="danger" loading>
  Processing...
</Button>
```

### 2. Type-Safe Modal Component

```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content modal-${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </header>
        <main className="modal-body">
          {children}
        </main>
        {footer && (
          <footer className="modal-footer">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

// Usage
function App() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirm Action"
        size="md"
        footer={
          <>
            <button onClick={() => setIsOpen(false)}>Cancel</button>
            <button onClick={() => {
              console.log('Confirmed')
              setIsOpen(false)
            }}>
              Confirm
            </button>
          </>
        }
      >
        <p>Are you sure you want to continue?</p>
      </Modal>
    </>
  )
}
```

### 3. Type-Safe Card Component

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  image?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

function Card({
  title,
  subtitle,
  image,
  children,
  actions,
  className,
  ...props
}: CardProps) {
  return (
    <div className={`card ${className ?? ''}`} {...props}>
      {image && (
        <div className="card-image">
          <img src={image} alt={title} />
        </div>
      )}
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      <div className="card-body">
        {children}
      </div>
      {actions && (
        <div className="card-actions">
          {actions}
        </div>
      )}
    </div>
  )
}

// Usage
<Card
  title="Product Name"
  subtitle="Product Category"
  image="/product.jpg"
  actions={
    <>
      <button>Add to Cart</button>
      <button>View Details</button>
    </>
  }
>
  <p>Product description goes here.</p>
  <p className="price">$12.00</p>
</Card>
```


## 10. Summary

In this chapter, you learned every pattern for implementing React components in a type-safe way with TypeScript.

### Key Takeaways

1. **Don't use React.FC**: Regular functions or arrow functions are recommended
2. **Discriminated Union**: Express conditional Props strictly at the type level
3. **Inherit HTML attributes**: `extends React.XXXHTMLAttributes` improves reusability
4. **forwardRef**: Explicitly specify type parameters when forwarding refs
5. **Children types**: Use `ReactNode` or `ReactElement` depending on the use case
6. **Event handlers**: Leverage type inference with inline definitions
7. **Utility Types**: Build flexible types with `Omit` / `Pick` / `Partial` / `Required`

### Next Steps

The next chapter covers more advanced type patterns (generics, conditional types, mapped types).

- Chapter 5: Advanced Type Patterns and Generics
- Chapter 6: Type-Safe Context and Form Implementation
