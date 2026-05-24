
# Advanced Type Patterns and Generics

## What You Will Learn

In this chapter, you will learn how to maximize the reusability and type safety of React components using TypeScript's advanced type features.

- Design patterns for generic components
- Practical use of Conditional Types
- Dynamic type generation with Mapped Types
- Type-safe APIs using Template Literal Types
- Type narrowing with Type Guards
- Extracting types with the `infer` keyword
- Practical examples: reusable List / Table / Select / Form components

**Prerequisites**: Chapter 4 content (basic type definitions)

**Estimated time**: 50–60 minutes


## Table of Contents

1. [Introduction to Generic Components](#1-introduction-to-generic-components)
2. [Generic List Component](#2-generic-list-component)
3. [Generic Select Component](#3-generic-select-component)
4. [Generic Table Component](#4-generic-table-component)
5. [Generic Form Component](#5-generic-form-component)
6. [Conditional Types](#6-conditional-types)
7. [Mapped Types](#7-mapped-types)
8. [Template Literal Types](#8-template-literal-types)
9. [Type Guards](#9-type-guards)
10. [Summary](#10-summary)


## 1. Introduction to Generic Components

### What Are Generics?

Generics are a mechanism for accepting types as parameters. This allows a single component definition to work with multiple types.

```typescript
// ❌ Defining a separate component for each type (redundant)
interface UserListProps {
  items: User[]
  renderItem: (item: User) => React.ReactNode
}

interface ProductListProps {
  items: Product[]
  renderItem: (item: Product) => React.ReactNode
}

// - Unified into a single definition with Generics
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

// Works with both User and Product types
function UserList() {
  return <List<User> items={users} renderItem={renderUser} />
}

function ProductList() {
  return <List<Product> items={products} renderItem={renderProduct} />
}
```

### Benefits of Generics

1. **Code reusability**: One implementation handles multiple types
2. **Type safety**: Type mismatches are caught at compile time
3. **Maintainability**: Reduces duplicate code and consolidates changes in one place


## 2. Generic List Component

### Basic Implementation

```typescript
interface ListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  emptyMessage?: string
}

function List<T>({
  items,
  renderItem,
  keyExtractor,
  emptyMessage = 'No items'
}: ListProps<T>) {
  if (items.length === 0) {
    return <p className="empty-message">{emptyMessage}</p>
  }

  return (
    <ul className="list">
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  )
}
```

### Example 1: User Type

```typescript
interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

function UserList() {
  const users: User[] = [
    { id: '1', name: 'John', email: 'john@example.com', role: 'admin' },
    { id: '2', name: 'Jane', email: 'jane@example.com', role: 'user' }
  ]

  return (
    <List<User>
      items={users}
      keyExtractor={(user) => user.id}
      renderItem={(user, index) => (
        <div className="user-item">
          <strong>
            {index + 1}. {user.name}
          </strong>
          <span className="email">{user.email}</span>
          <span className={`badge badge-${user.role}`}>
            {user.role}
          </span>
        </div>
      )}
      emptyMessage="No users found"
    />
  )
}
```

### Example 2: Product Type

```typescript
interface Product {
  id: string
  name: string
  price: number
  inStock: boolean
}

function ProductList() {
  const products: Product[] = [
    { id: '1', name: 'Apple', price: 100, inStock: true },
    { id: '2', name: 'Banana', price: 50, inStock: false }
  ]

  return (
    <List<Product>
      items={products}
      keyExtractor={(product) => product.id}
      renderItem={(product) => (
        <div className="product-item">
          <h3>{product.name}</h3>
          <p className="price">¥{product.price.toLocaleString()}</p>
          <span className={product.inStock ? 'in-stock' : 'out-of-stock'}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
      )}
      emptyMessage="No products available"
    />
  )
}
```

**Benefits of type safety**:

```typescript
// - OK: Accessing a property of the User type
<List<User>
  items={users}
  renderItem={(user) => <div>{user.name}</div>}
  keyExtractor={(user) => user.id}
/>

// ❌ Type error: Property 'username' does not exist on type 'Product'
<List<Product>
  items={products}
  renderItem={(product) => <div>{product.name}</div>} // OK
  keyExtractor={(product) => product.username} // ❌ Error
/>
```


## 3. Generic Select Component

### Basic Implementation

```typescript
interface SelectProps<T> {
  value: T
  options: T[]
  onChange: (value: T) => void
  getLabel: (option: T) => string
  getValue: (option: T) => string
  placeholder?: string
  disabled?: boolean
}

function Select<T>({
  value,
  options,
  onChange,
  getLabel,
  getValue,
  placeholder,
  disabled = false
}: SelectProps<T>) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value
    const selectedOption = options.find(
      (opt) => getValue(opt) === selectedValue
    )
    if (selectedOption) {
      onChange(selectedOption)
    }
  }

  return (
    <select
      value={getValue(value)}
      onChange={handleChange}
      disabled={disabled}
      className="select"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={getValue(option)} value={getValue(option)}>
          {getLabel(option)}
        </option>
      ))}
    </select>
  )
}
```

### Example 1: Primitive Types

```typescript
function FruitSelect() {
  const [selected, setSelected] = useState('apple')
  const fruits = ['apple', 'banana', 'orange', 'grape']

  return (
    <Select<string>
      value={selected}
      options={fruits}
      onChange={setSelected}
      getLabel={(fruit) => fruit.charAt(0).toUpperCase() + fruit.slice(1)}
      getValue={(fruit) => fruit}
      placeholder="Select a fruit"
    />
  )
}
```

### Example 2: Object Types

```typescript
interface Country {
  code: string
  name: string
  flag: string
}

function CountrySelect() {
  const countries: Country[] = [
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' }
  ]

  const [selected, setSelected] = useState(countries[0])

  return (
    <div>
      <Select<Country>
        value={selected}
        options={countries}
        onChange={setSelected}
        getLabel={(country) => `${country.flag} ${country.name}`}
        getValue={(country) => country.code}
      />
      <p>Selected: {selected.name} ({selected.code})</p>
    </div>
  )
}
```


## 4. Generic Table Component

### Basic Implementation

```typescript
interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
}

function Table<T>({
  data,
  columns,
  keyExtractor,
  onRowClick
}: TableProps<T>) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                width: col.width,
                textAlign: col.align ?? 'left'
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={onRowClick ? 'clickable' : ''}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                style={{ textAlign: col.align ?? 'left' }}
              >
                {col.render(item)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### Example: User Table

```typescript
interface User {
  id: string
  name: string
  email: string
  age: number
  status: 'active' | 'inactive'
}

function UserTable() {
  const users: User[] = [
    { id: '1', name: 'John', email: 'john@example.com', age: 25, status: 'active' },
    { id: '2', name: 'Jane', email: 'jane@example.com', age: 30, status: 'inactive' }
  ]

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => <strong>{user.name}</strong>,
      width: '200px'
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => (
        <a href={`mailto:${user.email}`}>{user.email}</a>
      )
    },
    {
      key: 'age',
      header: 'Age',
      render: (user) => `${user.age} years old`,
      align: 'center',
      width: '100px'
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <span className={`badge badge-${user.status}`}>
          {user.status}
        </span>
      ),
      align: 'center'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user) => (
        <div className="actions">
          <button onClick={() => console.log('Edit', user.id)}>
            Edit
          </button>
          <button onClick={() => console.log('Delete', user.id)}>
            Delete
          </button>
        </div>
      ),
      align: 'right'
    }
  ]

  return (
    <Table<User>
      data={users}
      columns={columns}
      keyExtractor={(user) => user.id}
      onRowClick={(user) => console.log('Row clicked:', user.name)}
    />
  )
}
```


## 5. Generic Form Component

### Basic Implementation

```typescript
interface FormField<T> {
  name: keyof T
  label: string
  type: 'text' | 'number' | 'email' | 'password' | 'textarea'
  required?: boolean
  placeholder?: string
  validate?: (value: T[keyof T]) => string | undefined
}

interface FormProps<T> {
  initialValues: T
  fields: FormField<T>[]
  onSubmit: (values: T) => void
  submitLabel?: string
}

function Form<T extends Record<string, any>>({
  initialValues,
  fields,
  onSubmit,
  submitLabel = 'Submit'
}: FormProps<T>) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  const handleChange = (name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }))

    // Validate on change
    const field = fields.find((f) => f.name === name)
    if (field?.validate) {
      const error = field.validate(value)
      setErrors((prev) => ({ ...prev, [name]: error }))
    }
  }

  const handleBlur = (name: keyof T) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    const newErrors: Partial<Record<keyof T, string>> = {}
    fields.forEach((field) => {
      if (field.validate) {
        const error = field.validate(values[field.name])
        if (error) {
          newErrors[field.name] = error
        }
      }
    })

    setErrors(newErrors)

    // Submit only if there are no errors
    if (Object.keys(newErrors).length === 0) {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      {fields.map((field) => (
        <div key={String(field.name)} className="form-field">
          <label htmlFor={String(field.name)}>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              id={String(field.name)}
              value={String(values[field.name] ?? '')}
              onChange={(e) => handleChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              placeholder={field.placeholder}
              required={field.required}
            />
          ) : (
            <input
              id={String(field.name)}
              type={field.type}
              value={String(values[field.name] ?? '')}
              onChange={(e) => {
                const value = field.type === 'number'
                  ? Number(e.target.value)
                  : e.target.value
                handleChange(field.name, value)
              }}
              onBlur={() => handleBlur(field.name)}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}

          {touched[field.name] && errors[field.name] && (
            <span className="error-message">{errors[field.name]}</span>
          )}
        </div>
      ))}

      <button type="submit" className="submit-button">
        {submitLabel}
      </button>
    </form>
  )
}
```

### Example: Registration Form

```typescript
interface RegisterFormData {
  username: string
  email: string
  age: number
  bio: string
}

function RegisterForm() {
  const fields: FormField<RegisterFormData>[] = [
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      required: true,
      placeholder: 'Enter your username',
      validate: (value) => {
        if (typeof value !== 'string') return 'Invalid username'
        if (value.length < 3) return 'Username must be at least 3 characters'
        if (value.length > 20) return 'Username must be at most 20 characters'
        return undefined
      }
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'your@email.com',
      validate: (value) => {
        if (typeof value !== 'string') return 'Invalid email'
        if (!value.includes('@')) return 'Invalid email format'
        return undefined
      }
    },
    {
      name: 'age',
      label: 'Age',
      type: 'number',
      required: true,
      validate: (value) => {
        if (typeof value !== 'number') return 'Invalid age'
        if (value < 18) return 'Must be 18 or older'
        if (value > 120) return 'Invalid age'
        return undefined
      }
    },
    {
      name: 'bio',
      label: 'Bio',
      type: 'textarea',
      placeholder: 'Tell us about yourself...',
      validate: (value) => {
        if (typeof value !== 'string') return 'Invalid bio'
        if (value.length > 500) return 'Bio must be at most 500 characters'
        return undefined
      }
    }
  ]

  const handleSubmit = (values: RegisterFormData) => {
    console.log('Form submitted:', values)
    // API call...
  }

  return (
    <Form<RegisterFormData>
      initialValues={{ username: '', email: '', age: 0, bio: '' }}
      fields={fields}
      onSubmit={handleSubmit}
      submitLabel="Register"
    />
  )
}
```


## 6. Conditional Types

### Basic Syntax

```typescript
type IsString<T> = T extends string ? true : false

type A = IsString<string> // true
type B = IsString<number> // false
```

### Practical Example 1: AsyncReturnType

```typescript
// Extract the return type of an async function
type AsyncReturnType<T> = T extends (...args: any[]) => Promise<infer R>
  ? R
  : never

async function fetchUser() {
  return { id: '1', name: 'John', email: 'john@example.com' }
}

type User = AsyncReturnType<typeof fetchUser>
// { id: string; name: string; email: string }

// Usage example
function UserComponent() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUser().then(setUser)
  }, [])

  return user ? <div>{user.name}</div> : null
}
```

### Practical Example 2: UnwrapArray

```typescript
// Extract the element type from an array type
type UnwrapArray<T> = T extends Array<infer U> ? U : T

type StringArray = UnwrapArray<string[]> // string
type Number = UnwrapArray<number> // number

// Usage: infer the type of an array item
function useArrayItem<T extends any[]>(
  array: T,
  index: number
): UnwrapArray<T> | undefined {
  return array[index]
}

const users = [
  { id: '1', name: 'John' },
  { id: '2', name: 'Jane' }
]

const user = useArrayItem(users, 0)
// Type of user: { id: string; name: string } | undefined
```

### Practical Example 3: NonNullable

```typescript
// Exclude null and undefined
type NonNullable<T> = T extends null | undefined ? never : T

type MaybeString = string | null | undefined
type DefiniteString = NonNullable<MaybeString> // string

// Usage example
interface User {
  id: string
  name: string
  email: string | null
}

type RequiredEmail = NonNullable<User['email']> // string
```


## 7. Mapped Types

### Basic Pattern

```typescript
// Make all properties optional
type Optional<T> = {
  [K in keyof T]?: T[K]
}

interface User {
  id: string
  name: string
  email: string
}

type OptionalUser = Optional<User>
// { id?: string; name?: string; email?: string }
```

### Practical Example 1: Deep Readonly

```typescript
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
      country: string
    }
  }
}

type ImmutableData = DeepReadonly<NestedData>

const data: ImmutableData = {
  user: {
    name: 'John',
    address: { city: 'Tokyo', country: 'Japan' }
  }
}

// ❌ All properties are read-only
data.user.name = 'Jane' // Error
data.user.address.city = 'Osaka' // Error
```

### Practical Example 2: Nullable

```typescript
// Make all properties nullable
type Nullable<T> = {
  [K in keyof T]: T[K] | null
}

interface User {
  id: string
  name: string
  email: string
}

type NullableUser = Nullable<User>
// { id: string | null; name: string | null; email: string | null }

// Usage: API response parsing
function parseUserResponse(response: NullableUser): User | null {
  if (!response.id || !response.name || !response.email) {
    return null
  }
  return {
    id: response.id,
    name: response.name,
    email: response.email
  }
}
```


## 8. Template Literal Types

### Auto-generating Event Handlers

```typescript
type EventName = 'click' | 'focus' | 'blur' | 'submit'
type HandlerName = `on${Capitalize<EventName>}`
// 'onClick' | 'onFocus' | 'onBlur' | 'onSubmit'

// Practical example
type Event = 'submit' | 'cancel' | 'save' | 'delete'
type EventHandlers = {
  [K in Event as `on${Capitalize<K>}`]: () => void
}
// {
//   onSubmit: () => void
//   onCancel: () => void
//   onSave: () => void
//   onDelete: () => void
// }

interface FormProps extends EventHandlers {
  title: string
}

function Form({ title, onSubmit, onCancel, onSave, onDelete }: FormProps) {
  return (
    <form>
      <h2>{title}</h2>
      <button type="button" onClick={onSubmit}>Submit</button>
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="button" onClick={onSave}>Save</button>
      <button type="button" onClick={onDelete}>Delete</button>
    </form>
  )
}
```

### Generating CSS Properties

```typescript
type CSSProperty = 'margin' | 'padding'
type CSSDirection = 'top' | 'right' | 'bottom' | 'left'
type CSSPropertyWithDirection = `${CSSProperty}${Capitalize<CSSDirection>}`
// 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft' |
// 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'

// Usage example
type SpacingProps = {
  [K in CSSPropertyWithDirection]?: number
}

interface BoxProps extends SpacingProps {
  children: React.ReactNode
}

function Box({ children, ...spacing }: BoxProps) {
  return (
    <div style={spacing}>
      {children}
    </div>
  )
}

// Usage example
<Box marginTop={10} paddingLeft={20}>
  Content
</Box>
```


## 9. Type Guards

### Type Guards with `typeof`

```typescript
function processValue(value: string | number) {
  if (typeof value === 'string') {
    // Inside this block, value is of type string
    return value.toUpperCase()
  }
  // Inside this block, value is of type number
  return value.toFixed(2)
}
```

### Custom Type Guards

```typescript
interface User {
  type: 'user'
  id: string
  name: string
}

interface Admin {
  type: 'admin'
  id: string
  name: string
  permissions: string[]
}

// Custom type guard function
function isAdmin(person: User | Admin): person is Admin {
  return person.type === 'admin'
}

function UserProfile({ person }: { person: User | Admin }) {
  if (isAdmin(person)) {
    // Inside this block, person is of type Admin
    return (
      <div>
        <h2>Admin: {person.name}</h2>
        <ul>
          {person.permissions.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    )
  }

  // Inside this block, person is of type User
  return <div>User: {person.name}</div>
}
```

### null / undefined Checks

```typescript
function processUser(user: User | null | undefined) {
  if (!user) {
    return <div>No user</div>
  }

  // Inside this block, user is of type User (not null or undefined)
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}
```


## 10. Summary

In this chapter, you learned how to design React components using TypeScript's advanced type features.

### Key Points

1. **Generic Components**: Maximize reusability with type parameters
   - Ideal for general-purpose components like List / Select / Table / Form

2. **Conditional Types**: Branch types with `T extends U ? X : Y`
   - Useful for type transformations such as AsyncReturnType and UnwrapArray

3. **Mapped Types**: Dynamically generate types with `[K in keyof T]`
   - Useful for type transformations such as DeepReadonly and Nullable

4. **Template Literal Types**: Build types from string literals
   - Ideal for types with naming conventions such as event handlers and CSS properties

5. **Type Guards**: Narrow types with the `is` keyword
   - Custom type guard functions enable type-safe handling of complex type checks

### Practical Applications

- **List / Table**: Always make data display components generic
- **Form**: Use `keyof T` for type-safe form definitions
- **API Responses**: Use Conditional Types to automatically infer return types
- **Event Handlers**: Use Template Literal Types to enforce consistent naming

### Next Steps

In the next chapter, you will use these type patterns to implement Context and Forms in a type-safe manner.

- Chapter 6: Type-safe Implementation of Context and Forms


**Estimated study time**: Approximately 55 minutes
**Word count**: Approximately 2,200 words

Mastering this chapter will enable you to design highly reusable components leveraging TypeScript's advanced type features.
