# Law of Demeter ── The Principle of Least Knowledge

> The Law of Demeter (LoD) is a design principle that says "only talk to your immediate friends." By keeping the scope of what an object needs to know to a minimum, it reduces coupling and builds systems that are resilient to change.

---

## What You Will Learn in This Chapter

1. **Definition and purpose of the Law of Demeter** ── Understand the essence of "avoid dot chain" code
2. **Detecting violation patterns** ── Develop an eye for spotting Train Wreck code
3. **Balancing application** ── Build judgment to apply it appropriately without over-applying it
4. **Practical refactoring techniques** ── Understand and apply the relationship with the Tell, Don't Ask principle
5. **Language-specific application** ── Grasp the differences in application across OOP, functional, and data-oriented styles

---

## Prerequisites

To get the most out of this guide, the following knowledge is required.

| Prerequisite | Required Level | Reference |
|---------|----------|--------|
| Coupling and Cohesion | Basic understanding | [Coupling and Cohesion](./03-coupling-cohesion.md) |
| SOLID Principles (especially SRP, ISP) | Basic understanding | [SOLID Principles](./01-solid.md) |
| Overview of Clean Code | Recommended to read | [Clean Code Overview](./00-clean-code-overview.md) |
| Basics of Object-Oriented Programming | Experience with class design | -- |
| Fundamentals of Refactoring | General understanding | [Code Smells](../02-refactoring/00-code-smells.md) |

---

## 1. What Is the Law of Demeter?

### 1.1 Historical Background

The Law of Demeter was proposed in 1987 by Karl Lieberherr and colleagues at Northeastern University through their research on the "Demeter Project." The project name comes from Demeter, the goddess of agriculture and harvest in Greek mythology — carrying the meaning of "harvest only what you need (knowledge)."

Their research was based on empirical data showing that "restricting the range of objects a method may call" in object-oriented programs dramatically improves maintainability.

```
  Problems the Law of Demeter solves

  Tightly coupled code (LoD violation):
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Client   │───→│ Object A │───→│ Object B │───→│ Object C │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
  client.a.b.c.doSomething()
  → Client knows the internal structure of A, B, and C
  → Any change to A, B, or C breaks Client

  Loosely coupled code (LoD compliant):
  ┌──────────┐    ┌──────────┐
  │ Client   │───→│ Object A │  (A manages B and C internally)
  └──────────┘    └──────────┘
  client.a.doSomething()
  → Client only knows A's public methods
  → Changes to B and C do not affect Client
```

### 1.2 Formal Definition

```
+-----------------------------------------------------------+
|  Law of Demeter (1987)                                    |
|  ─────────────────────────────────────────────────         |
|  Within a method M, M may only call methods of:           |
|                                                           |
|  1. The object M belongs to                      (self)   |
|  2. Objects passed as arguments to M             (param)  |
|  3. Objects created locally within M             (local)  |
|  4. Fields of the object M belongs to            (field)  |
|                                                           |
|  In other words, do not call methods of a "friend's friend"|
+-----------------------------------------------------------+
```

**Code Example 1: Four Permitted Method Call Types**

```python
class OrderProcessor:
    def __init__(self, validator: OrderValidator, logger: Logger):
        self.validator = validator  # field
        self.logger = logger       # field

    def process(self, order: Order) -> ProcessResult:
        # Rule 1: own method (self)
        self._log_processing_start(order)

        # Rule 2: method of an argument (param)
        if not order.is_valid():
            return ProcessResult.invalid()

        # Rule 3: method of a locally created object (local)
        receipt = Receipt.create(order)
        receipt.finalize()

        # Rule 4: method of a field (field)
        self.validator.validate(order)
        self.logger.info(f"Order {order.id} processed")

        return ProcessResult.success(receipt)

    def _log_processing_start(self, order: Order):
        self.logger.info(f"Processing order {order.id}")

    # The following is NOT OK (calling a method of a friend's friend)
    # order.customer.address.city.name  <- NOT OK!
    # self.validator.config.timeout      <- NOT OK!
```

### 1.3 Intuitive Understanding

```
  LoD violation: Talking directly to a friend's friend

  self ──→ friend ──→ friend's friend ──→ their friend
  obj.getA().getB().getC().doSomething()
       ↑       ↑       ↑
       OK     NG!     NG!

  LoD compliant: Ask your friend

  self ──→ friend
  obj.doSomethingThroughChain()
       ↑
       OK (the friend takes responsibility internally)
```

**Real-World Analogy:**

```
  LoD violation (real-world example):
  When you order a pizza...

  ✗ Look at the PIN on the clerk's credit card in their wallet
    and enter it directly into the payment system
    → Knowing too much about the clerk's internals (wallet)

  ✓ Hand the clerk money and say "One pizza, please"
    → You don't need to know how the clerk handles it internally


  LoD violation (code example):
  order.getCustomer().getWallet().getCreditCard().charge(amount)
  → The order object knows all the way into the customer's wallet

  LoD compliant:
  order.charge(amount)
  → The order object delegates the processing internally
```

### 1.4 Why the Law of Demeter Matters

Here is a quantitative illustration of the problems the Law of Demeter prevents.

| Problem | With LoD Violation | With LoD Compliance |
|------|----------|----------|
| Scope of change impact | Breaks whenever any class in the chain changes (N locations) | Only breaks when the direct friend's interface changes (1 location) |
| Test setup cost | Must mock all objects in the chain (N mocks) | Only mock the direct friend (1 mock) |
| Readability | Must decode the meaning of a long dot chain | Intent is readable from the method name |
| NullPointerException | Hard to pinpoint where null is in the chain | Only one level deep, so easy to debug |

```
  Comparison of change propagation

  LoD violation: customer.getAddress().getCity().getZipCode()
  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
  │Customer│→│Address │→│ City   │→│ZipCode │
  └────────┘  └────────┘  └────────┘  └────────┘
  ↑ A change to City's structure propagates to Client (high coupling)
  Affected files: Client + Customer + Address + City = 4

  LoD compliant: customer.getShippingZipCode()
  ┌────────┐  ┌────────┐
  │ Client │→│Customer│  (Customer manages internally)
  └────────┘  └────────┘
  ↑ Changes to City's structure are absorbed within Customer
  Affected files: Customer only = 1
```

---

## 2. Violation Patterns and Improvements

### 2.1 Train Wreck Code

```
  Code structure of a LoD violation (dot chain)

  customer.getAddress().getCity().getZipCode().format()
  ────────┬──────────┬─────────┬────────────┬────────
          │          │         │            │
    Level 1   Level 2   Level 3    Level 4
    retrieval  retrieval  retrieval  operation

  → Depends on the internal structure of 4 classes
  → If any class changes, the caller breaks
```

**Code Example 2: Fixing a Train Wreck**

```python
# === LoD violation: deep dot chain ===
class OrderProcessor:
    def calculate_shipping(self, order):
        # Drilling 4 levels: Order → Customer → Address → City → ZipCode
        zip_code = order.customer.address.city.zip_code
        if zip_code.startswith('100'):
            return 500  # 500 yen within the city
        return 1000


# === LoD compliant: each object responds within its own responsibility ===
class Order:
    def __init__(self, customer: Customer):
        self.customer = customer

    def get_shipping_zip_code(self) -> str:
        """Return the shipping zip code (hiding internal structure)"""
        return self.customer.get_zip_code()

class Customer:
    def __init__(self, address: Address):
        self.address = address

    def get_zip_code(self) -> str:
        """Return the customer's zip code"""
        return self.address.get_zip_code()

class Address:
    def __init__(self, city: City):
        self.city = city

    def get_zip_code(self) -> str:
        """Return the address's zip code"""
        return self.city.zip_code

class OrderProcessor:
    def calculate_shipping(self, order):
        zip_code = order.get_shipping_zip_code()  # Done with 1 dot
        if zip_code.startswith('100'):
            return 500
        return 1000
```

**Code Example 3: Collection Operations**

```java
// === LoD violation: exposing internal collection to the outside ===
class Department {
    private List<Employee> employees;

    public List<Employee> getEmployees() {
        return employees;  // Exposing internal structure
    }
}

// The caller depends on the internal structure
int count = department.getEmployees().stream()
    .filter(e -> e.getSalary() > 500000)
    .count();

// Problems:
// 1. Department exposes its internal data structure (List)
// 2. The caller knows about Employee's salary field
// 3. Filtering logic leaks into the caller


// === LoD compliant: provide query methods ===
class Department {
    private List<Employee> employees;

    public int countEmployeesWithSalaryAbove(int threshold) {
        return (int) employees.stream()
            .filter(e -> e.getSalary() > threshold)
            .count();
    }

    public List<String> getEmployeeNames() {
        return employees.stream()
            .map(Employee::getName)
            .collect(Collectors.toUnmodifiableList());
    }

    public Optional<Employee> findHighestPaid() {
        return employees.stream()
            .max(Comparator.comparingInt(Employee::getSalary));
    }

    // Return a defensive copy if needed
    public List<Employee> getEmployeesSnapshot() {
        return List.copyOf(employees);
    }
}

// The caller is simple
int count = department.countEmployeesWithSalaryAbove(500000);
```

**Code Example 4: Accessing Configuration Objects**

```typescript
// === LoD violation: directly accessing deep config hierarchy ===
function connectDatabase(config: AppConfig) {
  const host = config.database.connection.primary.host;
  const port = config.database.connection.primary.port;
  const timeout = config.database.connection.primary.timeoutMs;
  return new Database(`${host}:${port}`, { timeout });
}
// → 3 levels of dependency on config's internal structure
// → Breaks if database, connection, or primary structure changes


// === LoD compliant: receive only the necessary data ===
interface DatabaseConnectionInfo {
  host: string;
  port: number;
  timeoutMs: number;
}

function connectDatabase(connection: DatabaseConnectionInfo) {
  return new Database(`${connection.host}:${connection.port}`, {
    timeout: connection.timeoutMs
  });
}

// The caller extracts and passes only the required information
// Config structure changes affect only the caller (1 location)
const db = connectDatabase(config.getDatabaseConnection());
```

**Code Example 5: Null Check Chains**

```python
# === LoD violation + null hell ===
def get_manager_email(employee):
    if employee is not None:
        dept = employee.department
        if dept is not None:
            manager = dept.manager
            if manager is not None:
                contact = manager.contact
                if contact is not None:
                    return contact.email
    return "unknown@example.com"
# → 4 levels of null checks = knowing the internal structure of 4 classes
# → Hard to trace, test combinations are 2^4 = 16 patterns


# === LoD compliant: each object takes responsibility ===
class Employee:
    def get_manager_email(self) -> str:
        """Get the manager's email address (delegates to department)"""
        if self.department is None:
            return "unknown@example.com"
        return self.department.get_manager_email()

class Department:
    def get_manager_email(self) -> str:
        """Get manager's email (delegates to manager)"""
        if self.manager is None:
            return "unknown@example.com"
        return self.manager.get_email()

class Manager:
    def get_email(self) -> str:
        """Get email address"""
        return self.contact.email if self.contact else "unknown@example.com"

# Usage: simple and null-safe
email = employee.get_manager_email()
# → Each class handles null checks within its own responsibility
# → Tests can be written independently per class
```

### 2.2 Relationship with the Tell, Don't Ask Principle

The Law of Demeter is closely related to the "Tell, Don't Ask" principle.

```
  Ask (querying) → prone to LoD violations
  ┌────────┐      ┌────────┐
  │ Caller │ ask →│ Object │
  └────┬───┘      └────────┘
       │ Decides based on the result of the query...
       │
  ┌────▼───┐
  │ Logic  │ ← Decision logic leaks into the caller
  └────────┘

  Tell (commanding) → promotes LoD compliance
  ┌────────┐       ┌────────┐
  │ Caller │ tell →│ Object │
  └────────┘       └────┬───┘
                         │ Decides and processes on its own
                    ┌────▼───┐
                    │ Logic  │ ← Decision logic stays inside the object
                    └────────┘
```

**Code Example 6: Applying Tell, Don't Ask**

```python
# === Ask pattern (prone to LoD violations) ===
class OrderProcessor:
    def process_discount(self, order: Order):
        # "Asks" for customer info and makes the decision itself
        customer = order.customer
        if customer.membership_level == 'gold':
            if customer.total_purchases > 100000:
                discount = 0.15
            else:
                discount = 0.10
        elif customer.membership_level == 'silver':
            discount = 0.05
        else:
            discount = 0.0

        order.apply_discount(discount)
        # → Discount logic leaks into OrderProcessor
        # → OrderProcessor breaks when Customer's membership_level spec changes


# === Tell pattern (LoD compliant) ===
class OrderProcessor:
    def process_discount(self, order: Order):
        # Tells the order to "calculate and apply the discount"
        order.apply_membership_discount()
        # → OrderProcessor doesn't know the details of the discount

class Order:
    def apply_membership_discount(self):
        discount = self.customer.calculate_discount()
        self.total *= (1 - discount)

class Customer:
    def calculate_discount(self) -> float:
        """The customer itself knows its own discount rate"""
        if self.membership_level == 'gold':
            return 0.15 if self.total_purchases > 100000 else 0.10
        elif self.membership_level == 'silver':
            return 0.05
        return 0.0
    # → Discount logic is encapsulated in the Customer class
    # → Spec changes only affect Customer
```

**Code Example 7: Delegating Complex Business Logic**

```typescript
// === LoD violation: the caller makes all decisions ===
class ShippingService {
  calculateShippingCost(order: Order): number {
    // Knowing too much about the order's internal structure
    const weight = order.items.reduce(
      (sum, item) => sum + item.product.weight * item.quantity, 0
    );
    const isOversized = order.items.some(
      item => item.product.dimensions.width > 120 ||
              item.product.dimensions.height > 120
    );
    const address = order.customer.shippingAddress;
    const isRemoteArea = address.prefecture === 'Okinawa' ||
                         address.prefecture === 'Hokkaido';

    let cost = weight * 10; // base shipping rate
    if (isOversized) cost *= 1.5;
    if (isRemoteArea) cost += 500;
    if (order.customer.membershipLevel === 'premium') cost *= 0.8;

    return cost;
  }
}
// → ShippingService knows about Order, Item, Product, Dimensions,
//   Customer, Address, and MembershipLevel


// === LoD compliant: delegate decisions to each object ===
class ShippingService {
  calculateShippingCost(order: Order): number {
    const shippingInfo = order.getShippingInfo();
    return this.calculateBaseCost(shippingInfo)
         * shippingInfo.sizeMultiplier
         + shippingInfo.remoteAreaSurcharge
         * shippingInfo.membershipDiscount;
  }

  private calculateBaseCost(info: ShippingInfo): number {
    return info.totalWeight * 10;
  }
}

// Order provides the necessary information in aggregate
class Order {
  getShippingInfo(): ShippingInfo {
    return {
      totalWeight: this.calculateTotalWeight(),
      sizeMultiplier: this.hasOversizedItems() ? 1.5 : 1.0,
      remoteAreaSurcharge: this.customer.getRemoteAreaSurcharge(),
      membershipDiscount: this.customer.getMembershipDiscount(),
    };
  }

  private calculateTotalWeight(): number {
    return this.items.reduce(
      (sum, item) => sum + item.getWeight(), 0
    );
  }

  private hasOversizedItems(): boolean {
    return this.items.some(item => item.isOversized());
  }
}

// Each object handles its own decisions
class OrderItem {
  getWeight(): number { return this.product.weight * this.quantity; }
  isOversized(): boolean { return this.product.isOversized(); }
}

class Product {
  isOversized(): boolean {
    return this.dimensions.width > 120 || this.dimensions.height > 120;
  }
}
```

---

## 3. When to Apply and When Not to Apply

### 3.1 Application Decision Matrix

| When to Apply | Reason | Example |
|--------------|------|-----|
| Navigation between domain objects | Prevents dependency on internal structure | `order.customer.address.city` |
| Using external APIs/libraries | Localizes impact of changes | `lib.getConfig().getModule().getSetting()` |
| Communication between layers | Maintains architectural boundaries | Controller → Service → Repository |
| Stability of test code | Minimizes mock targets | A 5-level mock chain in tests is dangerous |

| When Not to Apply | Reason | Example |
|--------------|------|-----|
| Fluent Interface / Builder | Operations on the same object | `builder.setName("x").setAge(20).build()` |
| Data Transfer Objects (DTO) | Structure is part of the contract | `response.data.user.name` |
| Internal DSL | Dot chaining is the source of expressiveness | `select("name").from("users").where(...)` |
| Stream/LINQ operations | Functional pipeline | `list.filter(...).map(...).reduce(...)` |
| Optional/Maybe chains | Null-safe navigation | `user?.address?.city?.name` |

**Code Example 8: Distinguishing from Fluent Interface**

```python
# This is NOT a LoD violation! (Fluent Interface / method chain)
query = (
    QueryBuilder()
    .select("name", "email")
    .from_table("users")
    .where("age > 18")
    .order_by("name")
    .limit(10)
    .build()
)
# Each method returns the same object (or same type)
# → Not a "friend's friend" but repeatedly talking to the "same friend"

# This is also NOT a LoD violation (Stream pipeline)
result = (
    users
    .stream()
    .filter(lambda u: u.is_active())
    .map(lambda u: u.name)
    .sorted()
    .collect(to_list())
)
# This is a data transformation pipeline, not exploration of internal structure
```

### 3.2 Decision Flowchart

```
  LoD Application Decision Flow

  There is a dot chain
    │
    ▼
  Does it return the same object? ─── Yes ──→ Not a LoD violation
  (Fluent/Builder)                            (Fluent Interface)
    │ No
    ▼
  Is it accessing a DTO's structure? ─── Yes ──→ Not a LoD violation
                                                 (DTO structure is a contract)
    │ No
    ▼
  Is it a Stream/LINQ operation? ─── Yes ──→ Not a LoD violation
                                              (Functional pipeline)
    │ No
    ▼
  Is it exploring the internal
  structure of a domain object? ─── Yes ──→ LoD violation!
    │ No                                      Add delegation methods
    ▼
  No problem
```

---

## 4. The Law of Demeter and Related Principles

### 4.1 Relationship to the 7 Levels of Coupling

A Law of Demeter violation corresponds to "content coupling" or "stamp coupling" in coupling classifications.

| LoD State | Coupling Level | Example |
|---------|------------|-----|
| LoD violation (deep chain) | Close to content coupling | `order.customer.address.city.zipCode` |
| LoD violation (1-level internal access) | Stamp coupling | `order.customer.name` |
| LoD compliant (delegation method) | Data coupling | `order.getCustomerName()` |
| LoD compliant (event-driven) | Message coupling | `eventBus.publish(event)` |

### 4.2 Relationship to SOLID Principles

| SOLID Principle | Relationship to the Law of Demeter |
|-----------|---------------------|
| SRP | LoD compliance causes each class to own the decisions about its own responsibilities |
| OCP | Delegation methods prevent internal structure changes from propagating externally |
| LSP | LoD-compliant interfaces improve substitutability |
| ISP | LoD compliance leads to providing minimal interfaces |
| DIP | LoD compliance promotes dependency on abstractions |

### 4.3 Relationship to Information Hiding

The Law of Demeter is closely related to the information hiding principle proposed by David Parnas (1972).

```
  Information Hiding and the Law of Demeter

  Information Hiding: Hide design decisions (internal structure) of a module from the outside
  Law of Demeter: Do not explore an object's internal structure through method calls

  Information Hiding defines "what to hide,"
  while the Law of Demeter provides the concrete rules for "how to hide it"

  ┌─────────────────────────────────────────────┐
  │  Information Hiding Principle (Parnas, 1972) │
  │  "Hide design decisions that are likely to   │
  │   change within a module, and provide a      │
  │   stable interface"                          │
  └──────────────────┬──────────────────────────┘
                      │ Concretized as
                      ▼
  ┌─────────────────────────────────────────────┐
  │  Law of Demeter (Lieberherr, 1987)          │
  │  "Restrict the objects that may be called   │
  │   within a method to direct friends"         │
  └─────────────────────────────────────────────┘
```

---

## 5. Advanced Application Patterns

### 5.1 Information Hiding via Wrapper/Facade

**Code Example 9: Wrapping a Third-Party Library**

```python
# === LoD violation: directly dependent on third-party API internals ===
class PaymentProcessor:
    def __init__(self):
        self.stripe = stripe

    def charge(self, customer_id: str, amount: int):
        # Directly dependent on Stripe API's internal structure
        customer = self.stripe.Customer.retrieve(customer_id)
        default_source = customer.sources.data[0]  # exploring internal structure
        charge = self.stripe.Charge.create(
            amount=amount,
            currency='jpy',
            source=default_source.id,
            customer=customer.id,
        )
        return charge.status == 'succeeded'
        # → Breaks when Stripe API structure changes


# === LoD compliant: wrapped with an Adapter ===
class StripePaymentAdapter:
    """Confines coupling to Stripe API within this class"""
    def __init__(self, api_key: str):
        stripe.api_key = api_key

    def charge_default_method(self, customer_id: str, amount: int) -> PaymentResult:
        """Charge the customer's default payment method"""
        try:
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency='jpy',
                customer=customer_id,
                confirm=True,
            )
            return PaymentResult(
                success=intent.status == 'succeeded',
                transaction_id=intent.id,
            )
        except stripe.error.CardError as e:
            return PaymentResult(success=False, error=str(e))


class PaymentProcessor:
    """Payment processing - does not know Stripe's internal structure"""
    def __init__(self, payment_gateway: PaymentGateway):
        self.gateway = payment_gateway  # depends on interface

    def charge(self, customer_id: str, amount: int) -> PaymentResult:
        return self.gateway.charge_default_method(customer_id, amount)
```

### 5.2 Context Object Pattern

**Code Example 10: Passing Required Information in Aggregate**

```typescript
// === LoD violation: gathering information through long chains ===
function generateInvoice(order: Order): Invoice {
  const customerName = order.customer.profile.displayName;
  const billingAddress = order.customer.addresses.find(a => a.type === 'billing');
  const taxId = order.customer.taxInfo.registrationNumber;
  const items = order.items.map(i => ({
    name: i.product.name,
    price: i.product.price * i.quantity,
    taxRate: i.product.category.taxRate,
  }));
  // → Knows about order, customer, profile, addresses, taxInfo, items,
  //   product, and category
}


// === LoD compliant: use a context object to aggregate required info ===

// A type that only contains information needed for invoice generation
interface InvoiceContext {
  customerName: string;
  billingAddress: Address;
  taxRegistrationNumber: string;
  lineItems: InvoiceLineItem[];
}

interface InvoiceLineItem {
  productName: string;
  totalPrice: number;
  taxRate: number;
}

// Order is responsible for building the context
class Order {
  toInvoiceContext(): InvoiceContext {
    return {
      customerName: this.customer.getDisplayName(),
      billingAddress: this.customer.getBillingAddress(),
      taxRegistrationNumber: this.customer.getTaxRegistrationNumber(),
      lineItems: this.items.map(item => item.toInvoiceLineItem()),
    };
  }
}

class OrderItem {
  toInvoiceLineItem(): InvoiceLineItem {
    return {
      productName: this.product.getName(),
      totalPrice: this.product.getPrice() * this.quantity,
      taxRate: this.product.getTaxRate(),
    };
  }
}

// The invoice generation function only knows InvoiceContext
function generateInvoice(context: InvoiceContext): Invoice {
  // Knows nothing about Order's internal structure
  return new Invoice(context);
}

// Usage
const invoice = generateInvoice(order.toInvoiceContext());
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Over-creating Middle Men

```java
// NG: Over-applying LoD leads to an explosion of wrapper methods
class Customer {
    private Address address;

    // Delegation methods multiply explosively
    public String getStreet() { return address.getStreet(); }
    public String getCity() { return address.getCity(); }
    public String getState() { return address.getState(); }
    public String getZipCode() { return address.getZipCode(); }
    public String getCountry() { return address.getCountry(); }
    public void setStreet(String s) { address.setStreet(s); }
    public void setCity(String c) { address.setCity(c); }
    // ... goes on and on → Middle Man code smell

// OK: Delegate at a meaningful abstraction level
class Customer {
    private Address address;

    // Rather than delegating each field individually,
    // provide meaningful operations
    public String getFormattedAddress() {
        return address.format();
    }

    public boolean isInDeliveryArea(DeliveryZone zone) {
        return zone.includes(address);
    }

    // If Address itself is needed, return a defensive copy
    public Address getAddressCopy() {
        return new Address(address); // immutable copy
    }
}
```

### Anti-Pattern 2: The Reverse of Feature Envy

```python
# NG: Trying to comply with LoD by pushing unrelated responsibilities
class Order:
    def format_customer_address_for_shipping_label(self) -> str:
        # This is NOT Order's responsibility!
        return f"{self.customer.name}\n{self.customer.address.full_address()}"

# OK: Assign responsibility to the appropriate object
class ShippingLabel:
    """Class responsible for generating shipping labels"""
    def format(self, customer: Customer) -> str:
        return f"{customer.name}\n{customer.get_formatted_address()}"

# Usage
label = ShippingLabel()
formatted = label.format(order.customer)
# → Order does not hold shipping label knowledge; it only provides access to Customer
```

### Anti-Pattern 3: Performance Degradation from Excessive Wrapping

```python
# NG: Too many unnecessary delegation layers
class WidgetA:
    def get_value(self):
        return self.widget_b.get_value()

class WidgetB:
    def get_value(self):
        return self.widget_c.get_value()

class WidgetC:
    def get_value(self):
        return self.widget_d.get_value()

class WidgetD:
    def get_value(self):
        return self._actual_value
# → 4 levels of delegation. LoD-compliant but the design is distorted

# OK: Revisit the design and find the right granularity
# Excessive delegation is a sign of "design distortion"
# Reconsider where responsibilities truly belong
```

---

## 7. Detecting LoD Violations with Static Analysis

### 7.1 Metrics and Detection Rules

| Metric | Description | Threshold |
|-----------|------|---------|
| Dot chain depth | Number of levels in a method chain | Warning at 2 or more |
| Message Chain (Martin Fowler) | Detection as a code smell | Review at 3 or more |
| Feature Envy | Excessive calls to another class's methods | Warning when exceeding own class calls |
| CBO (Coupling Between Objects) | Number of dependent classes | Warning at 10 or more |

### 7.2 Linter Rule Configuration Examples

```python
# === Python: detecting LoD violations with pylint ===
# .pylintrc
# [DESIGN]
# max-args=5              # Many args may indicate LoD violation risk
# max-attributes=7        # Many fields may indicate LoD violation risk

# === Custom rule: detecting dot chains ===
import ast

class LoDChecker(ast.NodeVisitor):
    """AST analysis to detect LoD violation candidates"""
    MAX_CHAIN_LENGTH = 2

    def visit_Attribute(self, node):
        chain_length = self._count_chain(node)
        if chain_length > self.MAX_CHAIN_LENGTH:
            print(
                f"Line {node.lineno}: "
                f"dot chain depth {chain_length} "
                f"(threshold: {self.MAX_CHAIN_LENGTH})"
            )
        self.generic_visit(node)

    def _count_chain(self, node, depth=1):
        if isinstance(node.value, ast.Attribute):
            return self._count_chain(node.value, depth + 1)
        return depth
```

```typescript
// === TypeScript: ESLint custom rule ===
// eslint-plugin-demeter
module.exports = {
  rules: {
    'no-deep-chain': {
      create(context) {
        return {
          MemberExpression(node) {
            let depth = 0;
            let current = node;
            while (current.type === 'MemberExpression') {
              depth++;
              current = current.object;
            }
            if (depth > 2) {
              context.report({
                node,
                message: `Dot chain depth is ${depth}. This may violate the Law of Demeter.`,
              });
            }
          },
        };
      },
    },
  },
};
```

---

## 8. Exercises

### Exercise 1 (Basic): Identifying LoD Violations

Find the LoD violations in the following code and explain the reason for each.

```python
class ReportGenerator:
    def generate(self, company):
        # (1)
        ceo_name = company.board.ceo.personal_info.full_name

        # (2)
        total = sum(d.budget for d in company.departments)

        # (3)
        report = Report()
        report.set_title(f"Annual Report for {company.name}")

        # (4)
        formatted = (
            ReportFormatter()
            .set_font("Arial")
            .set_size(12)
            .format(report)
        )

        # (5)
        company.departments[0].employees[0].salary

        return formatted
```

**Expected Answer:**

```
(1) LoD violation: company → board → ceo → personal_info → full_name
    4-level dot chain. Should delegate to company.getCeoName().

(2) LoD violation: directly accesses company.departments,
    then further accesses each department's budget.
    Should delegate to company.getTotalBudget().

(3) LoD compliant: report is a locally created object (Rule 3).
    company.name is a direct property of the argument (Rule 2).

(4) LoD compliant: ReportFormatter is created locally (Rule 3).
    It is a Fluent Interface, so dot chaining is OK.

(5) LoD violation: company → departments[0] → employees[0] → salary
    Directly accessing the contents of an internal collection.
```

### Exercise 2 (Applied): Refactoring with Tell, Don't Ask

Refactor the following Ask pattern code into the Tell pattern.

```typescript
class NotificationSender {
  sendReminder(user: User) {
    if (user.preferences.notifications.email.enabled) {
      const email = user.contactInfo.primaryEmail;
      if (user.subscription.plan === 'premium') {
        this.emailService.sendPriority(email, 'Reminder', '...');
      } else {
        this.emailService.send(email, 'Reminder', '...');
      }
    }

    if (user.preferences.notifications.push.enabled) {
      const deviceToken = user.devices[0].pushToken;
      this.pushService.send(deviceToken, 'Reminder', '...');
    }
  }
}
```

**Expected Answer:**

```typescript
// Tell pattern: delegate decisions to each object
class NotificationSender {
  sendReminder(user: User) {
    user.sendNotification({
      type: 'reminder',
      subject: 'Reminder',
      body: '...',
      emailService: this.emailService,
      pushService: this.pushService,
    });
  }
}

class User {
  sendNotification(params: NotificationParams) {
    if (this.shouldSendEmail()) {
      this.sendEmailNotification(params);
    }
    if (this.shouldSendPush()) {
      this.sendPushNotification(params);
    }
  }

  private shouldSendEmail(): boolean {
    return this.preferences.isEmailEnabled();
  }

  private sendEmailNotification(params: NotificationParams) {
    const email = this.contactInfo.getPrimaryEmail();
    if (this.subscription.isPremium()) {
      params.emailService.sendPriority(email, params.subject, params.body);
    } else {
      params.emailService.send(email, params.subject, params.body);
    }
  }

  private shouldSendPush(): boolean {
    return this.preferences.isPushEnabled();
  }

  private sendPushNotification(params: NotificationParams) {
    const token = this.getPreferredPushToken();
    params.pushService.send(token, params.subject, params.body);
  }
}
```

### Exercise 3 (Advanced): Practicing Design Decisions

For each scenario below, decide whether to apply the Law of Demeter and explain your reasoning.

```
Scenario A: GraphQL resolver
query {
  user(id: "123") {
    profile { displayName }
    orders {
      items { product { name, price } }
    }
  }
}

Scenario B: ORM relations
user = User.find(123)
orders = user.orders.where(status: "active").includes(:items)

Scenario C: Domain logic
def calculate_bonus(employee):
    base_salary = employee.contract.compensation.base_salary
    department_budget = employee.department.budget_allocation.bonus_pool
    return min(base_salary * 0.1, department_budget / len(employee.department.members))
```

**Expected Answer:**

```
Scenario A: Do not apply LoD
→ GraphQL is a query language where clients declaratively specify
  the structure of data. This is not a LoD violation but
  an appropriate API design pattern.

Scenario B: Do not apply LoD (with conditions)
→ ORM relation access is acceptable as a DSL.
  However, if a chain like user.orders.items.product appears
  inside domain logic, a dedicated query method should be provided.

Scenario C: Apply LoD (violation present)
→ 3-level dot chains appear in 2 places. Refactoring:
  employee.get_base_salary() + employee.get_available_bonus_pool()
  Each object provides its value within its own responsibility.
```


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Invalid configuration file | Check config file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review settings |
| Data inconsistency | Race conditions in concurrent processing | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where the error occurs
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form a hypothesis**: List possible causes
4. **Incremental verification**: Use log output and debugger to verify each hypothesis
5. **Fix and regression test**: After fixing, run tests for related areas as well

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
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Called: {func.__name__}(args={args}, kwargs={kwargs})")
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

Steps for diagnosing performance issues when they arise:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Examine disk and network I/O status
4. **Check concurrent connections**: Check the connection pool state

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly releasing references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Here are the criteria for making technology choices.

| Criterion | When to Prioritize | When to Compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                      │
│    ├─ Small (1-5) → Monolith                    │
│    └─ Large (10+) → Go to 2                     │
│                                                 │
│  2. What is the deployment frequency?           │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily/multiple times → Go to 3            │
│                                                 │
│  3. How independent are the teams?              │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always come with trade-offs. Analyze from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering raises short-term costs and can delay projects

**2. Consistency vs. Flexibility**
- A unified technology stack lowers learning costs
- Adopting diverse technologies allows best-fit choices but increases operational costs

**3. Level of Abstraction**
- High abstraction improves reusability but can make debugging harder
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
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
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
        md += f"## Context\n{self.context}\n\n"
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
- Focus on the minimum required features
- Automated tests only for the critical path
- Introduce monitoring from early on

**Lessons Learned:**
- Don't aim for perfection (YAGNI principle)
- Gather user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually replacing a system that has been in operation for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- If there are no existing tests, write Characterization Tests first
- Use an API gateway to run old and new systems side by side
- Migrate data incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, understanding dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Retire old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Assign ownership per team
- Manage shared libraries using an Inner Source approach
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

# Usage examples
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

**Situation:** A system requiring millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | CPU-bound cases |

---

## Team Development Practices

### Code Review Checklist

Points to check in code reviews related to this topic:

- [ ] Is naming convention consistent?
- [ ] Is error handling appropriate?
- [ ] Is test coverage sufficient?
- [ ] Is there any performance impact?
- [ ] Are there any security issues?
- [ ] Is documentation up to date?

### Best Practices for Knowledge Sharing

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talks | Weekly | Whole team | Horizontal knowledge sharing |
| ADR (Design records) | Per decision | Future members | Transparency in decision-making |
| Retrospectives | Every 2 weeks | Whole team | Continuous improvement |
| Mob programming | Monthly | Key design | Building consensus |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │ it  │imme-│
    │     │diate│
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

## 9. FAQ

### Q1: Should the Law of Demeter be applied to DTOs and data classes?

DTOs are containers for data without "behavior," and their structure is part of the contract itself. Accessing fields inside a DTO with dots is not considered a LoD violation. However, the domain logic that receives a DTO should be designed to accept only the needed data as arguments.

```python
# Accessing a DTO is OK
user_dto = api_response.data.user
name = user_dto.profile.display_name  # OK because it's a DTO

# Domain logic should not depend on the DTO's structure
def greet_user(display_name: str) -> str:  # receive a primitive value
    return f"Hello, {display_name}!"

greet_user(user_dto.profile.display_name)  # expand the DTO at the call site
```

### Q2: Isn't calling the Law of Demeter a "law" an exaggeration?

In practice, many developers treat it as a "guideline" rather than a "law." Rather than following it blindly, what matters is understanding the goal of **reducing coupling** and making judgment calls accordingly.

Robert C. Martin has also said "LoD is not a strict rule, but a useful heuristic." The important thing is not counting the number of dots, but constantly asking, "Does this code know too much about other objects' internal structure?"

### Q3: How is the Law of Demeter applied in functional programming?

In functional programming, pipeline operators and map/filter chains may look like dot chains, but they are data transformation pipelines and are not LoD violations. What matters in functional programming is "minimizing the types a function needs to know." Use parametric polymorphism (generics) to design functions that do not depend on concrete types.

```haskell
-- Functional: pipelines are not LoD violations
result = users
  |> filter isActive
  |> map getName
  |> sort
  |> take 10
-- Each function only transforms data; it does not explore internal structure

-- The equivalent of a LoD violation
getUserCity :: User -> String
getUserCity user = city (address (profile user))
-- → Knows too much about User's internal structure (profile → address → city)

-- LoD compliant
getUserCity :: User -> String
getUserCity = getCity . getAddress . getProfile
-- → However, this is often acceptable as function composition
-- → The key is that getUserCity is exposed from the User module
```

### Q4: Should LoD also be applied in microservice API design?

In microservices, the spirit of LoD should be applied to API design, though the implementation approach differs.

```
Good API design (spirit of LoD compliance):
GET /orders/{id}/shipping-cost
→ The client gets the shipping cost without knowing the order's internal structure

Bad API design (spirit of LoD violation):
GET /orders/{id} → retrieve customer_id
GET /customers/{customer_id} → retrieve address_id
GET /addresses/{address_id} → retrieve zip_code
→ The client must make multiple API calls in a specific order
```

### Q5: What is the recommended priority for introducing LoD?

The following staged introduction order is recommended:

1. **Service layer API boundaries**: Highest impact. Minimize the interfaces exposed externally
2. **Coupling with external libraries**: Isolate with the Adapter pattern
3. **Navigation between domain objects**: Convert Train Wrecks to delegation methods
4. **Stabilizing test code**: Reduce mock chains
5. **Incremental improvement of legacy code**: Apply to new code first, then improve changed code incrementally

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|------|
| Core idea | "Only talk to your immediate friends" |
| Purpose | Reduce coupling, localize impact of changes |
| Formal definition | Within method M, only call methods of: self, param, local, field |
| Signs of violation | Dot chains (Train Wreck), deep null checks |
| Remedies | Delegation methods, Tell Don't Ask, context objects, Adapter |
| When not to apply | Fluent Interface, DTOs, Stream operations, internal DSLs |
| Risks of over-application | Middle Man, explosion of wrapper methods |
| Related principles | Tell Don't Ask, Information Hiding, SRP, DIP |

| Criterion | Question |
|---------|------|
| Is it a LoD violation? | "Does this code know the internal structure of a friend's friend?" |
| Should it be improved? | "When a class in the chain changes, will this code break?" |
| Should it delegate? | "Which object is responsible for this decision logic?" |
| Is it over-applied? | "Is there an explosive increase in delegation methods?" |

---

## Guides to Read Next

- [Coupling and Cohesion](./03-coupling-cohesion.md) ── Background of the problems the Law of Demeter solves
- [Function Design](../01-practices/01-functions.md) ── Applying LoD in argument design
- [Code Smells](../02-refactoring/00-code-smells.md) ── Relationship with Feature Envy and Middle Man
- Refactoring Techniques ── Steps for Extract Method and Move Method
- Design Pattern: Facade ── A pattern for reducing coupling

---

## References

1. **Karl J. Lieberherr, Ian M. Holland** "Assuring Good Style for Object-Oriented Programs" IEEE Software, 1989 ── Original paper on the Law of Demeter
2. **Robert C. Martin** *Clean Code: A Handbook of Agile Software Craftsmanship* Prentice Hall, 2008 (Chapter 6: Objects and Data Structures) ── Explanation of Train Wreck
3. **Martin Fowler** *Refactoring: Improving the Design of Existing Code* Addison-Wesley, 2018 ── Remedies for Middle Man smell and Feature Envy
4. **David Parnas** "On the criteria to be used in decomposing systems into modules" Communications of the ACM, 1972 ── The information hiding principle
5. **Andrew Hunt, David Thomas** *The Pragmatic Programmer: From Journeyman to Master* Addison-Wesley, 1999 ── Practical explanation of "Don't talk to strangers"
6. **Karl Lieberherr** "Demeter Project" Northeastern University ── Official project documentation
7. **Pragmatic Dave Thomas** "Tell, Don't Ask" ── Explanation of the Tell Don't Ask principle
8. **Eric Evans** *Domain-Driven Design: Tackling Complexity in the Heart of Software* Addison-Wesley, 2003 ── Bounded Context and information hiding
