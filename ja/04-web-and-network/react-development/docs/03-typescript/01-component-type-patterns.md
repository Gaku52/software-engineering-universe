
# コンポーネントの型定義完全版

## この章で学べること

この章では、TypeScriptでReactコンポーネントを型安全に実装する全パターンを学びます。

- React.FC を使わない理由と推奨パターン
- Props の基本と高度な型定義
- Discriminated Union（条件付きProps）
- HTML属性の継承パターン
- Ref の型定義と forwardRef
- Children の正しい型付け
- Utility Types の実践活用
- イベントハンドラの型定義

**前提知識**: TypeScript の基本文法

**所要時間**: 40-50分


## 目次

1. [コンポーネントの型定義パターン](#1-コンポーネントの型定義パターン)
2. [Props の高度な型パターン](#2-props-の高度な型パターン)
3. [Discriminated Union（条件付きProps）](#3-discriminated-union条件付きprops)
4. [HTML属性の継承](#4-html属性の継承)
5. [Ref の型定義と転送](#5-ref-の型定義と転送)
6. [Children の型定義](#6-children-の型定義)
7. [イベントハンドラの型](#7-イベントハンドラの型)
8. [Utility Types の活用](#8-utility-types-の活用)
9. [実践例：型安全なコンポーネント集](#9-実践例型安全なコンポーネント集)
10. [まとめ](#10-まとめ)


## 1. コンポーネントの型定義パターン

### React.FC を使わない理由

```typescript
// ❌ React.FC（非推奨）
const Component: React.FC<Props> = ({ name }) => {
  return <div>{name}</div>
}

// 問題点:
// 1. 暗黙的に children を含む（型安全性が低下）
// 2. ジェネリクスとの相性が悪い
// 3. デフォルトProps との互換性問題
```

**React.FC の問題点**:

1. **暗黙的な children**: 明示的に `children` を定義しなくても、自動的に含まれる
2. **ジェネリクスの制約**: ジェネリック型パラメータを使う場合、構文が複雑になる
3. **デフォルトProps の非互換性**: TypeScript 3.1 以降、デフォルトProps と相性が悪い

### 推奨パターン

```typescript
// - 通常の関数（推奨）
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

// - アロー関数（推奨）
const Component = ({ name, age }: Props) => {
  return (
    <div>
      {name} is {age} years old
    </div>
  )
}

// 戻り値の型を明示する場合
function Component({ name, age }: Props): JSX.Element {
  return (
    <div>
      {name} is {age} years old
    </div>
  )
}
```

### Props の基本的な型定義

```typescript
// プリミティブ型
interface BasicProps {
  title: string
  count: number
  isActive: boolean
}

// オプショナル
interface OptionalProps {
  title: string
  subtitle?: string // オプショナル
}

// ユニオン型
interface UnionProps {
  variant: 'primary' | 'secondary' | 'danger'
  size: 'sm' | 'md' | 'lg'
}

// オブジェクト型
interface User {
  id: string
  name: string
  email: string
}

interface ObjectProps {
  user: User
  onUpdate: (user: User) => void
}

// 配列型
interface ArrayProps {
  tags: string[]
  users: User[]
}

// 関数型
interface FunctionProps {
  onClick: () => void
  onSubmit: (value: string) => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}
```

**実装例**:

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

// 使用例
<UserCard
  user={{ id: '1', name: 'John', email: 'john@example.com' }}
  variant="full"
  onEdit={(user) => console.log('Editing', user)}
/>
```


## 2. Props の高度な型パターン

### デフォルト値を持つProps

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

// デフォルト値を設定
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

// 使用例
<Button>Click me</Button> // variant='primary', size='md'
<Button variant="secondary" size="lg">Large Button</Button>
```

### Required Props（必須プロパティ）

```typescript
interface OptionalConfig {
  theme?: 'light' | 'dark'
  locale?: string
  debug?: boolean
}

// 全てのプロパティを必須に
type RequiredConfig = Required<OptionalConfig>

function applyConfig(config: RequiredConfig) {
  // 全てのプロパティが保証されている
  console.log(config.theme)  // 必ず存在
  console.log(config.locale) // 必ず存在
  console.log(config.debug)  // 必ず存在
}
```

### Partial Props（オプショナル化）

```typescript
interface FormData {
  username: string
  email: string
  age: number
}

// 全てのプロパティをオプショナルに
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
      {/* フォーム実装 */}
    </form>
  )
}

// 使用例
<Form
  initialValues={{ username: 'John' }} // email, age は省略可能
  onSubmit={(data) => console.log(data)}
/>
```


## 3. Discriminated Union（条件付きProps）

### 基本パターン

```typescript
// ❌ 問題：variantによってpropsが変わるが、型で表現できていない
interface BadButtonProps {
  variant: 'link' | 'button'
  href?: string    // linkの時のみ必要
  onClick?: () => void // buttonの時のみ必要
}

// 使用時に問題が発生
<BadButton variant="link" onClick={() => {}} /> // ❌ linkなのにonClick?
<BadButton variant="button" href="/home" />     // ❌ buttonなのにhref?
```

```typescript
// - 解決：Discriminated Union
type ButtonProps =
  | {
      variant: 'link'
      href: string
      onClick?: never // buttonの時は使えない
    }
  | {
      variant: 'button'
      onClick: () => void
      href?: never // linkの時は使えない
    }

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    // TypeScriptがprops.hrefの存在を保証
    return <a href={props.href}>Link</a>
  }

  // TypeScriptがprops.onClickの存在を保証
  return <button onClick={props.onClick}>Button</button>
}

// 使用例
<Button variant="link" href="/home" />         // - OK
<Button variant="button" onClick={() => {}} /> // - OK
<Button variant="link" onClick={() => {}} />   // ❌ 型エラー
<Button variant="button" href="/home" />       // ❌ 型エラー
```

### 複雑な Discriminated Union

```typescript
// フォーム入力の型（inputTypeによってpropsが変わる）
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

// 使用例
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


## 4. HTML属性の継承

### Button コンポーネント

```typescript
// HTMLButtonElement の属性を継承
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

// 使用例（すべてのbutton属性が使える）
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

### Input コンポーネント

```typescript
// HTMLInputElement の属性を継承
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

// 使用例
<Input
  label="Email"
  type="email"
  placeholder="your@email.com"
  required
  autoComplete="email"
  error="Invalid email address"
/>
```

### Container コンポーネント

```typescript
// HTMLDivElement の属性を継承
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

// 使用例
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


## 5. Ref の型定義と転送

### forwardRef を使った Ref の転送

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

// displayName を設定（DevTools で表示される）
Input.displayName = 'Input'

// 使用例
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

### useImperativeHandle でカスタムRefを公開

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

// 使用例
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


## 6. Children の型定義

### ReactNode（最も汎用的）

```typescript
interface Props {
  children: React.ReactNode
}

function Container({ children }: Props) {
  return <div className="container">{children}</div>
}

// 使用例（あらゆる要素を受け入れる）
<Container>
  <p>Text</p>
  {[1, 2, 3]}
  {null}
  {undefined}
  <div>Nested</div>
</Container>
```

### ReactElement（特定の要素のみ）

```typescript
interface Props {
  children: React.ReactElement
}

function Wrapper({ children }: Props) {
  return <div className="wrapper">{children}</div>
}

// 使用例
<Wrapper>
  <p>Only one element allowed</p>
</Wrapper>

// ❌ エラー
<Wrapper>
  <p>Multiple</p>
  <p>Elements</p>
</Wrapper>
```

### Render Props パターン

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

// 使用例
<UserProvider>
  {(user) => (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )}
</UserProvider>
```

### 特定のコンポーネントのみ許可

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

// 使用例
<List>
  <Item name="Apple" />
  <Item name="Banana" />
</List>

// ❌ エラー
<List>
  <div>Not an Item</div>
</List>
```


## 7. イベントハンドラの型

### 基本的なイベント型

```typescript
// マウスイベント
function Button() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Button clicked at', e.clientX, e.clientY)
    e.currentTarget.disabled = true // HTMLButtonElement として認識
  }

  return <button onClick={handleClick}>Click me</button>
}

// チェンジイベント（input）
function TextInput() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Value:', e.target.value)
  }

  return <input onChange={handleChange} />
}

// チェンジイベント（select）
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

// フォームイベント
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

// キーボードイベント
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

// フォーカスイベント
function FocusInput() {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select() // 全選択
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    console.log('Input blurred')
  }

  return <input onFocus={handleFocus} onBlur={handleBlur} />
}
```

### 型推論を活用

```typescript
// ❌ 明示的な型注釈（冗長）
function Component() {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Clicked')
  }

  return <button onClick={handleClick}>Click</button>
}

// - インライン定義（型推論）
function Component() {
  return (
    <button onClick={(e) => {
      // eは自動的にReact.MouseEvent<HTMLButtonElement>と推論される
      console.log('Clicked at', e.clientX, e.clientY)
    }}>
      Click
    </button>
  )
}
```

### カスタムイベントハンドラ

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

// 非同期イベントハンドラ
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

### イベントハンドラの型エイリアス

```typescript
// 再利用可能な型エイリアス
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


## 8. Utility Types の活用

### Omit でプロパティを除外

```typescript
// 元の型
interface FullUser {
  id: string
  name: string
  email: string
  password: string
  createdAt: Date
}

// パスワードを除外した型
type PublicUser = Omit<FullUser, 'password'>

// 複数のプロパティを除外
type UserSummary = Omit<FullUser, 'password' | 'createdAt'>

interface UserCardProps {
  user: PublicUser
}

function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      {/* user.password は存在しない */}
    </div>
  )
}
```

### Pick で必要なプロパティのみ抽出

```typescript
// 元の型
interface FullProduct {
  id: string
  name: string
  description: string
  price: number
  stock: number
  categoryId: string
  images: string[]
}

// 必要なプロパティのみ
type ProductSummary = Pick<FullProduct, 'id' | 'name' | 'price'>

interface ProductCardProps {
  product: ProductSummary
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>¥{product.price}</p>
    </div>
  )
}
```

### Readonly で不変に

```typescript
interface MutableUser {
  id: string
  name: string
}

type ImmutableUser = Readonly<MutableUser>

function Component() {
  const user: ImmutableUser = { id: '1', name: 'John' }

  user.name = 'Jane' // ❌ 型エラー：読み取り専用
}

// ネストしたオブジェクトも不変に（DeepReadonly）
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

data.user.address.city = 'Osaka' // ❌ 型エラー
```


## 9. 実践例：型安全なコンポーネント集

### 1. 型安全なButtonコンポーネント

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

// 使用例
<Button variant="primary" size="lg" onClick={() => console.log('Clicked')}>
  Click me
</Button>

<Button variant="danger" loading>
  Processing...
</Button>
```

### 2. 型安全なModalコンポーネント

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

// 使用例
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

### 3. 型安全なCardコンポーネント

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

// 使用例
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
  <p className="price">¥1,200</p>
</Card>
```


## 10. まとめ

この章では、TypeScriptでReactコンポーネントを型安全に実装する全パターンを学びました。

### 重要ポイント

1. **React.FC は使わない**: 通常の関数またはアロー関数を推奨
2. **Discriminated Union**: 条件付きPropsは型で厳密に表現
3. **HTML属性の継承**: `extends React.XXXHTMLAttributes` で再利用性向上
4. **forwardRef**: Ref転送時は型パラメータを明示
5. **Children の型**: 用途に応じて `ReactNode` / `ReactElement` を使い分け
6. **イベントハンドラ**: インライン定義で型推論を活用
7. **Utility Types**: `Omit` / `Pick` / `Partial` / `Required` で柔軟に型を構築

### Next Steps

次の章では、さらに高度な型パターン（ジェネリック、条件付き型、マップ型）を学びます。

- Chapter 5: 高度な型パターンとジェネリック
- Chapter 6: Context と Form の型安全な実装


**執筆時間**: 約45分で習得可能
**文字数**: 約2,100語

この章をマスターすることで、型安全なReactコンポーネント設計の基礎が身につきます。
