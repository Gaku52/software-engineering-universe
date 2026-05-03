# API Testing

> API testing is the last line of defense for quality. Master the overall test strategy and practical patterns to guarantee the correctness, reliability, and performance of APIs — from unit tests, integration tests, and contract tests through load tests and E2E tests.

## What You Will Learn

- [ ] Understand API test types and strategy (test pyramid)
- [ ] Implement unit tests and integration tests using supertest / Jest / Vitest
- [ ] Understand the principles and implementation of contract testing with Pact
- [ ] Design and execute load tests and performance tests with k6 / Artillery
- [ ] Learn test automation techniques using Postman / Newman
- [ ] Understand the boundary between E2E tests and integration tests and write tests at an appropriate granularity
- [ ] Learn how to incorporate tests into CI/CD pipelines

---

## Prerequisites

- REST API design principles → See: [REST Best Practices](../01-rest-and-graphql/00-rest-best-practices.md)
- HTTP methods and status codes → See: HTTP Fundamentals (Networking Basics)
- Basics of testing methodologies (unit testing, integration testing, E2E testing)
- Basic concepts of CI/CD pipelines
- Basic Node.js development environment (npm/yarn, understanding of package.json)

---

## 1. Overview of API Testing

### 1.1 Test Pyramid and the Position of API Testing

In software testing, the test pyramid is a conceptual model showing the ideal ratio of tests at each level. A similar pyramid structure applies to API testing: tests at lower layers execute faster and are more numerous, while tests at higher layers are more costly to run but provide more realistic verification.

```
Test Pyramid (API Version)

                  /\
                 /  \        E2E Tests (few: 5-10%)
                /    \       · Verify end-to-end flows in production-equivalent environment
               /      \     · User scenario units (register → purchase → confirm)
              /--------\    · Execution time: minutes to tens of minutes
             /          \
            /  Integration \   Integration Tests (moderate: 20-30%)
           /   Tests        \  · Request/response per endpoint
          /   (API layer)    \ · Combined verification of DB + API + authentication
         /                    \· Execution time: seconds to tens of seconds
        /--------------------  \
       / Contract Tests         \  Contract Tests (moderate: 10-15%)
      /                          \ · API specification agreement verification
     /----------------------------\· Contract between Consumer and Provider
    /                              \
   /    Unit Tests (many)           \  Unit Tests (most: 50-60%)
  /    Validation / Business         \ · Validation, transformation, calculation logic
 /    Logic / Data Transformation     \· Use mocks/stubs, no DB required
/--------------------------------------\· Execution time: milliseconds
```

### 1.2 Detailed Classification of Test Types

API tests are broadly classified into the following 6 types depending on purpose and granularity.

```
API Test Type Map

+------------------------------------------------------------------+
|                    Types of API Tests                             |
+------------------------------------------------------------------+
|                                                                    |
|  [1] Unit Tests              [2] Integration Tests                |
|  +-------------------------+ +----------------------------+       |
|  | · Validation functions  | | · HTTP request/response    |       |
|  | · Business rule calc.   | | · Verification incl. DB    |       |
|  | · Data transform/format | | · Authentication/authz flow|       |
|  | · Error handling        | | · Middleware integration    |       |
|  +-------------------------+ +----------------------------+       |
|                                                                    |
|  [3] Contract Tests          [4] E2E Tests                        |
|  +-------------------------+ +----------------------------+       |
|  | · Schema consistency    | | · Cross-API scenarios      |       |
|  | · Consumer-Provider     | | · External service integr. |       |
|  | · Version compatibility | | · Data consistency check   |       |
|  +-------------------------+ +----------------------------+       |
|                                                                    |
|  [5] Load Tests              [6] Security Tests                   |
|  +-------------------------+ +----------------------------+       |
|  | · Throughput measurement| | · Auth bypass verification |       |
|  | · Latency analysis      | | · Injection verification   |       |
|  | · Scalability testing   | | · Rate limit verification  |       |
|  | · Fault tolerance tests | | · Input validation         |       |
|  +-------------------------+ +----------------------------+       |
+------------------------------------------------------------------+
```

### 1.3 Design Principles for Test Strategy

The following are the basic principles for designing an API test strategy.

**Principle 1: Test Independence**
Each test case must not depend on other tests. The result must not change regardless of the order in which tests are executed.

**Principle 2: Test Data Management**
Set up data for each test and clean up at the end. Avoid shared state to ensure test reliability.

**Principle 3: Selecting the Appropriate Granularity**
Following the test pyramid, maximize fast-executing unit tests and minimize costly E2E tests.

**Principle 4: Deterministic Tests**
Design tests that depend on dates or random values so that fixed values can be injected. It is important not to produce flaky tests (unstable tests).

**Principle 5: Covering Boundary Values and Edge Cases**
Test not only the happy path but also edge cases such as empty strings, null values, large data, special characters, and concurrent access.

---

## 2. Unit Testing in Practice

### 2.1 Testing Validation Logic

Unit tests are the most basic test layer for APIs, verifying the logic of pure functions and classes that do not depend on a DB or network.

```javascript
// src/validators/userValidator.js
export class UserValidator {
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email address is required' };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Email address format is invalid' };
    }
    if (email.length > 254) {
      return { valid: false, error: 'Email address is too long (max 254 characters)' };
    }
    return { valid: true, error: null };
  }

  static validateAge(age) {
    if (age === undefined || age === null) {
      return { valid: false, error: 'Age is required' };
    }
    if (!Number.isInteger(age)) {
      return { valid: false, error: 'Age must be specified as an integer' };
    }
    if (age < 0 || age > 150) {
      return { valid: false, error: 'Age must be in the range 0–150' };
    }
    return { valid: true, error: null };
  }

  static validateCreateUserInput(input) {
    const errors = [];
    const emailResult = this.validateEmail(input.email);
    if (!emailResult.valid) errors.push({ field: 'email', message: emailResult.error });

    const ageResult = this.validateAge(input.age);
    if (!ageResult.valid) errors.push({ field: 'age', message: ageResult.error });

    if (!input.name || input.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' });
    } else if (input.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be 100 characters or fewer' });
    }

    return { valid: errors.length === 0, errors };
  }
}
```

```javascript
// __tests__/unit/userValidator.test.js
import { describe, it, expect } from 'vitest';
import { UserValidator } from '../../src/validators/userValidator';

describe('UserValidator', () => {
  // === Email address validation ===
  describe('validateEmail', () => {
    // Happy path
    it('accepts valid email addresses', () => {
      const testCases = [
        'user@example.com',
        'user.name@example.co.jp',
        'user+tag@example.com',
        'user123@sub.domain.example.com',
      ];
      testCases.forEach(email => {
        const result = UserValidator.validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    // Error path
    it('rejects invalid email addresses', () => {
      const testCases = [
        { input: '', expected: 'Email address is required' },
        { input: null, expected: 'Email address is required' },
        { input: undefined, expected: 'Email address is required' },
        { input: 'invalid', expected: 'Email address format is invalid' },
        { input: '@example.com', expected: 'Email address format is invalid' },
        { input: 'user@', expected: 'Email address format is invalid' },
        { input: 'user@.com', expected: 'Email address format is invalid' },
      ];
      testCases.forEach(({ input, expected }) => {
        const result = UserValidator.validateEmail(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(expected);
      });
    });

    // Boundary values
    it('rejects email addresses longer than 254 characters', () => {
      const longEmail = 'a'.repeat(243) + '@example.com'; // 255 characters
      const result = UserValidator.validateEmail(longEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email address is too long (max 254 characters)');
    });

    it('accepts an email address that is exactly 254 characters', () => {
      const email = 'a'.repeat(242) + '@example.com'; // 254 characters
      const result = UserValidator.validateEmail(email);
      expect(result.valid).toBe(true);
    });
  });

  // === Age validation ===
  describe('validateAge', () => {
    it('accepts valid ages', () => {
      [0, 1, 25, 100, 150].forEach(age => {
        expect(UserValidator.validateAge(age).valid).toBe(true);
      });
    });

    it('rejects ages outside the valid range', () => {
      expect(UserValidator.validateAge(-1).valid).toBe(false);
      expect(UserValidator.validateAge(151).valid).toBe(false);
    });

    it('rejects non-integer values', () => {
      expect(UserValidator.validateAge(25.5).valid).toBe(false);
      expect(UserValidator.validateAge('25').valid).toBe(false);
    });
  });

  // === Composite validation ===
  describe('validateCreateUserInput', () => {
    it('returns true when all fields are valid', () => {
      const result = UserValidator.validateCreateUserInput({
        name: 'Taro Yamada',
        email: 'taro@example.com',
        age: 30,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for multiple fields simultaneously', () => {
      const result = UserValidator.validateCreateUserInput({
        name: '',
        email: 'invalid',
        age: -5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map(e => e.field)).toEqual(
        expect.arrayContaining(['name', 'email', 'age'])
      );
    });
  });
});
```

### 2.2 Testing Business Logic

```javascript
// src/services/pricingService.js
export class PricingService {
  /**
   * Calculates the final price of an item
   * @param {number} basePrice - Base price
   * @param {string} membershipTier - Membership tier ('bronze'|'silver'|'gold'|'platinum')
   * @param {number} quantity - Quantity
   * @param {string|null} couponCode - Coupon code
   * @returns {{ finalPrice: number, discount: number, breakdown: object }}
   */
  static calculatePrice(basePrice, membershipTier, quantity, couponCode = null) {
    if (basePrice < 0) throw new Error('Base price must be 0 or greater');
    if (quantity < 1) throw new Error('Quantity must be 1 or greater');

    // Membership discount rates
    const tierDiscounts = {
      bronze: 0,
      silver: 0.05,
      gold: 0.10,
      platinum: 0.15,
    };

    // Quantity discount rates
    let quantityDiscount = 0;
    if (quantity >= 100) quantityDiscount = 0.10;
    else if (quantity >= 50) quantityDiscount = 0.07;
    else if (quantity >= 10) quantityDiscount = 0.05;

    // Coupon discount
    const couponDiscounts = {
      'SUMMER2024': 0.20,
      'WELCOME10': 0.10,
      'VIP30': 0.30,
    };
    const couponDiscount = couponCode ? (couponDiscounts[couponCode] || 0) : 0;

    // Discounts are not additive — the maximum discount is applied
    const tierRate = tierDiscounts[membershipTier] || 0;
    const maxDiscount = Math.max(tierRate, quantityDiscount, couponDiscount);

    const subtotal = basePrice * quantity;
    const discountAmount = Math.round(subtotal * maxDiscount);
    const finalPrice = subtotal - discountAmount;

    return {
      finalPrice,
      discount: discountAmount,
      breakdown: {
        basePrice,
        quantity,
        subtotal,
        tierDiscount: tierRate,
        quantityDiscount,
        couponDiscount,
        appliedDiscount: maxDiscount,
      },
    };
  }
}
```

```javascript
// __tests__/unit/pricingService.test.js
import { describe, it, expect } from 'vitest';
import { PricingService } from '../../src/services/pricingService';

describe('PricingService.calculatePrice', () => {
  it('basic price calculation (no discount)', () => {
    const result = PricingService.calculatePrice(1000, 'bronze', 1);
    expect(result.finalPrice).toBe(1000);
    expect(result.discount).toBe(0);
  });

  it('applies membership discount', () => {
    const result = PricingService.calculatePrice(1000, 'gold', 1);
    // gold: 10% discount → 1000 - 100 = 900
    expect(result.finalPrice).toBe(900);
    expect(result.discount).toBe(100);
    expect(result.breakdown.appliedDiscount).toBe(0.10);
  });

  it('applies quantity discount (10 or more)', () => {
    const result = PricingService.calculatePrice(100, 'bronze', 10);
    // 100 * 10 = 1000, 5% discount → 1000 - 50 = 950
    expect(result.finalPrice).toBe(950);
  });

  it('applies coupon discount when greater than membership discount', () => {
    const result = PricingService.calculatePrice(1000, 'silver', 1, 'SUMMER2024');
    // silver: 5%, coupon: 20% → apply the maximum of 20%
    expect(result.finalPrice).toBe(800);
    expect(result.breakdown.appliedDiscount).toBe(0.20);
  });

  it('ignores an invalid coupon code', () => {
    const result = PricingService.calculatePrice(1000, 'bronze', 1, 'INVALID');
    expect(result.finalPrice).toBe(1000);
    expect(result.breakdown.couponDiscount).toBe(0);
  });

  it('throws an error for a negative price', () => {
    expect(() => PricingService.calculatePrice(-100, 'bronze', 1))
      .toThrow('Base price must be 0 or greater');
  });

  it('throws an error for quantity 0', () => {
    expect(() => PricingService.calculatePrice(1000, 'bronze', 0))
      .toThrow('Quantity must be 1 or greater');
  });
});
```

---

## 3. Integration Testing in Practice (supertest)

### 3.1 Setting Up the Test Environment

In integration tests, HTTP requests are actually sent to verify endpoint behavior. supertest is a library for sending requests to Node.js HTTP servers and is used in combination with frameworks such as Express / Koa / Fastify.

```javascript
// __tests__/setup/testServer.js
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { createTestUser, generateToken } from './helpers';

// Manages the test server and DB connection
export function setupTestServer() {
  let server;
  let authToken;
  let adminToken;
  let testUser;
  let adminUser;

  beforeAll(async () => {
    // Run migrations for the test DB
    await db.migrate.latest();
    // Insert test seed data
    await db.seed.run();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await db.raw('TRUNCATE TABLE users, orders, products CASCADE');

    // Create test users and tokens
    testUser = await createTestUser(db, {
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
    });
    adminUser = await createTestUser(db, {
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    });

    authToken = generateToken(testUser);
    adminToken = generateToken(adminUser);
  });

  afterAll(async () => {
    await db.destroy();
  });

  return {
    getApp: () => app,
    getAuthToken: () => authToken,
    getAdminToken: () => adminToken,
    getTestUser: () => testUser,
    getAdminUser: () => adminUser,
    getDb: () => db,
  };
}
```

### 3.2 Integration Tests for CRUD Endpoints

```javascript
// __tests__/integration/users.test.js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db';

const request = supertest(app);

describe('Users API - Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    await db.migrate.latest();
  });

  beforeEach(async () => {
    await db('users').truncate();
    const user = await db('users').insert({
      id: 'user_test',
      name: 'Test Admin',
      email: 'test@example.com',
      role: 'admin',
    }).returning('*');
    authToken = generateToken(user[0]);
  });

  afterAll(async () => {
    await db.destroy();
  });

  // ============================================
  // GET /api/v1/users - Get user list
  // ============================================
  describe('GET /api/v1/users', () => {
    it('returns a paginated list of users', async () => {
      // Prepare data
      await db('users').insert([
        { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'user' },
        { id: 'u2', name: 'Bob', email: 'bob@example.com', role: 'admin' },
      ]);

      const res = await request
        .get('/api/v1/users?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(3); // test user + 2
      expect(res.body.meta).toHaveProperty('hasNextPage');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta.total).toBe(3);
    });

    it('can filter by role', async () => {
      await db('users').insert([
        { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'user' },
        { id: 'u2', name: 'Bob', email: 'bob@example.com', role: 'admin' },
      ]);

      const res = await request
        .get('/api/v1/users?filter[role]=admin')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.every(u => u.role === 'admin')).toBe(true);
    });

    it('returns 401 without authentication', async () => {
      await request
        .get('/api/v1/users')
        .expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await request
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });

    it('returns 401 with an expired token', async () => {
      const expiredToken = generateToken(
        { id: 'user_test', role: 'admin' },
        { expiresIn: '-1h' }
      );

      await request
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  // ============================================
  // POST /api/v1/users - Create user
  // ============================================
  describe('POST /api/v1/users', () => {
    it('creates a user and returns 201', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New User', email: 'new@example.com', age: 25 })
        .expect(201);

      expect(res.body.data).toMatchObject({
        name: 'New User',
        email: 'new@example.com',
        role: 'user', // default role
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.headers.location).toMatch(/\/api\/v1\/users\//);
    });

    it('returns 422 for an invalid email address', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test', email: 'invalid-email' })
        .expect(422);

      expect(res.body.errors).toContainEqual(
        expect.objectContaining({ field: 'email' })
      );
    });

    it('returns 409 for a duplicate email address', async () => {
      await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'First', email: 'dup@example.com' })
        .expect(201);

      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Second', email: 'dup@example.com' })
        .expect(409);

      expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
    });

    it('returns 422 when required fields are missing', async () => {
      const res = await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // empty body
        .expect(422);

      expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 403 when a regular user tries to create with admin role', async () => {
      const userToken = generateToken({ id: 'u_normal', role: 'user' });

      await request
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacker', email: 'hack@example.com', role: 'admin' })
        .expect(403);
    });
  });

  // ============================================
  // PUT /api/v1/users/:id - Update user
  // ============================================
  describe('PUT /api/v1/users/:id', () => {
    it('updates user information', async () => {
      const res = await request
        .put('/api/v1/users/user_test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Name');
    });

    it('returns 404 for a non-existent user ID', async () => {
      await request
        .put('/api/v1/users/nonexistent_id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('detects conflict via optimistic locking', async () => {
      // Get with version 1
      const getRes = await request
        .get('/api/v1/users/user_test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const version = getRes.body.data.version;

      // First update (succeeds)
      await request
        .put('/api/v1/users/user_test')
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-Match', `"${version}"`)
        .send({ name: 'Update 1' })
        .expect(200);

      // Second update (conflict due to stale version)
      await request
        .put('/api/v1/users/user_test')
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-Match', `"${version}"`)
        .send({ name: 'Update 2' })
        .expect(409);
    });
  });

  // ============================================
  // DELETE /api/v1/users/:id - Delete user
  // ============================================
  describe('DELETE /api/v1/users/:id', () => {
    it('deletes a user and returns 204', async () => {
      const created = await db('users').insert({
        id: 'u_delete', name: 'To Delete', email: 'delete@example.com', role: 'user',
      }).returning('*');

      await request
        .delete(`/api/v1/users/${created[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // 404 when retrieved after deletion
      await request
        .get(`/api/v1/users/${created[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('idempotency: safe to delete the same resource twice', async () => {
      await db('users').insert({
        id: 'u_idem', name: 'Idempotent', email: 'idem@example.com', role: 'user',
      });

      await request
        .delete('/api/v1/users/u_idem')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Second deletion returns 404 (already gone)
      await request
        .delete('/api/v1/users/u_idem')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
```

### 3.3 Test Helpers and Factories

To avoid duplication in test code, use test helpers and the factory pattern.

```javascript
// __tests__/helpers/factories.js
import { faker } from '@faker-js/faker';
import { db } from '../../src/db';

export class UserFactory {
  static defaults() {
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: 'user',
      age: faker.number.int({ min: 18, max: 80 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static async create(overrides = {}) {
    const data = { ...this.defaults(), ...overrides };
    const [user] = await db('users').insert(data).returning('*');
    return user;
  }

  static async createMany(count, overrides = {}) {
    const users = Array.from({ length: count }, (_, i) => ({
      ...this.defaults(),
      email: `user${i}@example.com`,
      ...overrides,
    }));
    return db('users').insert(users).returning('*');
  }
}

export class OrderFactory {
  static defaults(userId) {
    return {
      id: faker.string.uuid(),
      userId,
      status: 'pending',
      totalAmount: faker.number.int({ min: 100, max: 100000 }),
      items: JSON.stringify([
        { productId: faker.string.uuid(), quantity: 1, price: 1000 },
      ]),
      createdAt: new Date(),
    };
  }

  static async create(userId, overrides = {}) {
    const data = { ...this.defaults(userId), ...overrides };
    const [order] = await db('orders').insert(data).returning('*');
    return order;
  }
}
```

---

## 4. API Test Automation with Postman / Newman

### 4.1 Structuring Postman Collections

Postman provides not just manual testing but also the ability to automatically run tests defined as collections. In CI/CD pipelines, Newman (Postman's command-line runner) is used.

```
Postman Collection Structure Example

Collection: "User Management API"
  |
  +-- Folder: "Authentication"
  |     +-- POST /auth/login
  |     +-- POST /auth/register
  |     +-- POST /auth/refresh
  |     +-- POST /auth/logout
  |
  +-- Folder: "Users (CRUD)"
  |     +-- GET  /api/v1/users       (list)
  |     +-- POST /api/v1/users       (create)
  |     +-- GET  /api/v1/users/:id   (get by ID)
  |     +-- PUT  /api/v1/users/:id   (update)
  |     +-- DELETE /api/v1/users/:id (delete)
  |
  +-- Folder: "Error Cases"
  |     +-- Authentication error (401)
  |     +-- Authorization error (403)
  |     +-- Validation error (422)
  |     +-- Resource conflict (409)
  |
  +-- Folder: "Edge Cases"
        +-- Empty request
        +-- Oversized payload
        +-- Special character input
        +-- Concurrent requests
```

### 4.2 Writing Postman Test Scripts

```javascript
// Example scripts written in the Postman Tests tab

// === Test script for POST /auth/login ===
// Verify status code
pm.test("Returns status code 200", function () {
    pm.response.to.have.status(200);
});

// Verify response body
pm.test("Returns response containing access token", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('accessToken');
    pm.expect(jsonData).to.have.property('refreshToken');
    pm.expect(jsonData).to.have.property('expiresIn');
    pm.expect(jsonData.expiresIn).to.be.a('number');
});

// Save token to environment variable (for use in subsequent requests)
pm.test("Saves token to environment variable", function () {
    const jsonData = pm.response.json();
    pm.environment.set("accessToken", jsonData.accessToken);
    pm.environment.set("refreshToken", jsonData.refreshToken);
});

// Verify response time
pm.test("Response returns within 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});

// Verify headers
pm.test("Content-Type is application/json", function () {
    pm.response.to.have.header("Content-Type", "application/json; charset=utf-8");
});

// Schema validation
const schema = {
    type: "object",
    required: ["accessToken", "refreshToken", "expiresIn", "user"],
    properties: {
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
        expiresIn: { type: "number" },
        user: {
            type: "object",
            required: ["id", "name", "email", "role"],
            properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
                role: { type: "string", enum: ["user", "admin"] },
            }
        }
    }
};

pm.test("Response conforms to schema", function () {
    pm.response.to.have.jsonSchema(schema);
});
```

### 4.3 CI/CD Integration with Newman

```bash
# Install Newman
npm install -g newman newman-reporter-htmlextra

# Run a collection
newman run ./postman/collection.json \
  --environment ./postman/env-staging.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export ./reports/api-test-report.html \
  --iteration-count 3 \
  --delay-request 100 \
  --timeout-request 10000

# Example GitHub Actions configuration
# .github/workflows/api-tests.yml
# name: API Tests
# on:
#   push:
#     branches: [main, develop]
#   pull_request:
#     branches: [main]
#
# jobs:
#   api-tests:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - uses: actions/setup-node@v4
#         with:
#           node-version: '20'
#       - run: npm ci
#       - run: npm run start:test &
#       - run: npx newman run ./postman/collection.json \
#              --environment ./postman/env-test.json \
#              --reporters cli,junit \
#              --reporter-junit-export ./reports/junit.xml
#       - uses: actions/upload-artifact@v4
#         with:
#           name: test-reports
#           path: ./reports/
```

---

## 5. Contract Testing (Pact)

### 5.1 The Concept of Contract Testing

Contract testing is a testing methodology that verifies that the API specification (contract) between services is agreed upon by both parties. In a microservices architecture, it ensures that the Consumer (the side calling the API) and the Provider (the side providing the API) are operating in accordance with each other's expectations.

```
Contract Testing Flow Diagram

  Consumer Side               Pact Broker               Provider Side
  (Frontend)                  (Contract Management)      (API Server)
  +------------------+      +------------------+      +------------------+
  |                  |      |                  |      |                  |
  | 1. Run tests     |      |                  |      |                  |
  |    (against Mock |----->| 2. Upload        |      |                  |
  |     server)      |      |    contract      |      |                  |
  |                  |      |    (Pact JSON)   |      |                  |
  +------------------+      |                  |      |                  |
                            |                  |----->| 3. Download      |
                            |                  |      |    contract and  |
                            |                  |      |    verify against|
                            |                  |<-----| 4. Report        |
                            |                  |      |    verification  |
                            +------------------+      +------------------+
                                     |
                                     v
                            +------------------+
                            | 5. Run           |
                            | can-i-deploy in  |
                            | CI/CD to         |
                            | determine deploy |
                            | eligibility      |
                            +------------------+
```

### 5.2 Implementing the Consumer Side Test

```javascript
// __tests__/contract/userApiConsumer.pact.test.js
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';
import { UserApiClient } from '../../src/clients/userApiClient';

const { like, eachLike, regex, string, integer, boolean } = MatchersV3;

const provider = new PactV3({
  consumer: 'FrontendApp',
  provider: 'UserAPI',
  dir: path.resolve(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('User API Contract - Consumer Side', () => {
  // Contract for getting the user list
  describe('GET /api/v1/users', () => {
    it('returns a paginated list of users', async () => {
      provider
        .given('multiple users exist')
        .uponReceiving('a request to get the user list')
        .withRequest({
          method: 'GET',
          path: '/api/v1/users',
          query: { limit: '10', offset: '0' },
          headers: {
            Authorization: regex(/^Bearer .+$/, 'Bearer valid-token'),
            Accept: 'application/json',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            data: eachLike({
              id: string('user_123'),
              name: string('Taro Yamada'),
              email: string('taro@example.com'),
              role: regex(/^(user|admin)$/, 'user'),
              createdAt: regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                '2024-01-15T09:00:00Z'
              ),
            }),
            meta: {
              total: integer(100),
              limit: integer(10),
              offset: integer(0),
              hasNextPage: boolean(true),
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = new UserApiClient({
          baseUrl: mockServer.url,
          token: 'valid-token',
        });

        const result = await client.listUsers({ limit: 10, offset: 0 });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.meta.total).toBeGreaterThanOrEqual(0);
        expect(result.meta.hasNextPage).toBeDefined();
      });
    });
  });

  // Contract for getting an individual user
  describe('GET /api/v1/users/:id', () => {
    it('returns the user with the specified ID', async () => {
      provider
        .given('a user with ID 123 exists')
        .uponReceiving('a request to get an individual user')
        .withRequest({
          method: 'GET',
          path: '/api/v1/users/123',
          headers: {
            Authorization: regex(/^Bearer .+$/, 'Bearer valid-token'),
          },
        })
        .willRespondWith({
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {
            data: {
              id: string('123'),
              name: like('Taro Yamada'),
              email: like('taro@example.com'),
              role: regex(/^(user|admin)$/, 'user'),
              profile: {
                bio: like('Software Engineer'),
                avatarUrl: like('https://example.com/avatar.png'),
              },
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = new UserApiClient({
          baseUrl: mockServer.url,
          token: 'valid-token',
        });

        const user = await client.getUser('123');
        expect(user.id).toBe('123');
        expect(user.name).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.profile).toBeDefined();
      });
    });

    it('returns 404 for a non-existent ID', async () => {
      provider
        .given('a user with ID 999 does not exist')
        .uponReceiving('a request to get a non-existent user')
        .withRequest({
          method: 'GET',
          path: '/api/v1/users/999',
          headers: {
            Authorization: regex(/^Bearer .+$/, 'Bearer valid-token'),
          },
        })
        .willRespondWith({
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {
            error: {
              code: string('NOT_FOUND'),
              message: like('The specified user was not found'),
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = new UserApiClient({
          baseUrl: mockServer.url,
          token: 'valid-token',
        });

        await expect(client.getUser('999')).rejects.toThrow(/not found/i);
      });
    });
  });

  // Contract for creating a user
  describe('POST /api/v1/users', () => {
    it('creates a new user and returns 201', async () => {
      const newUser = {
        name: 'Hanako Suzuki',
        email: 'hanako@example.com',
        age: 28,
      };

      provider
        .given('user registration is available')
        .uponReceiving('a request to create a user')
        .withRequest({
          method: 'POST',
          path: '/api/v1/users',
          headers: {
            Authorization: regex(/^Bearer .+$/, 'Bearer valid-token'),
            'Content-Type': 'application/json',
          },
          body: newUser,
        })
        .willRespondWith({
          status: 201,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Location: regex(/^\/api\/v1\/users\//, '/api/v1/users/new_id'),
          },
          body: {
            data: {
              id: string('new_id'),
              name: string('Hanako Suzuki'),
              email: string('hanako@example.com'),
              role: string('user'),
              age: integer(28),
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = new UserApiClient({
          baseUrl: mockServer.url,
          token: 'valid-token',
        });

        const created = await client.createUser(newUser);
        expect(created.name).toBe('Hanako Suzuki');
        expect(created.email).toBe('hanako@example.com');
        expect(created.id).toBeDefined();
      });
    });
  });
});
```

### 5.3 Provider Side Verification

```javascript
// __tests__/contract/userApiProvider.pact.test.js
import { Verifier } from '@pact-foundation/pact';
import { app } from '../../src/app';
import { db } from '../../src/db';

describe('User API Contract - Provider Verification', () => {
  let server;
  const port = 4567;

  beforeAll(async () => {
    await db.migrate.latest();
    server = app.listen(port);
  });

  afterAll(async () => {
    server.close();
    await db.destroy();
  });

  it('satisfies the Consumer contract', async () => {
    const opts = {
      provider: 'UserAPI',
      providerBaseUrl: `http://localhost:${port}`,

      // Retrieve from Pact Broker
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,

      // Retrieve from local file
      // pactUrls: ['./pacts/FrontendApp-UserAPI.json'],

      publishVerificationResult: process.env.CI === 'true',
      providerVersion: process.env.GIT_COMMIT_SHA,
      providerVersionBranch: process.env.GIT_BRANCH,

      // Provider State handlers
      stateHandlers: {
        'multiple users exist': async () => {
          await db('users').truncate();
          await db('users').insert([
            { id: 'user_1', name: 'Taro', email: 'taro@example.com', role: 'user' },
            { id: 'user_2', name: 'Hanako', email: 'hanako@example.com', role: 'admin' },
          ]);
        },
        'a user with ID 123 exists': async () => {
          await db('users').truncate();
          await db('users').insert({
            id: '123',
            name: 'Taro Yamada',
            email: 'taro@example.com',
            role: 'user',
            profile: JSON.stringify({
              bio: 'Software Engineer',
              avatarUrl: 'https://example.com/avatar.png',
            }),
          });
        },
        'a user with ID 999 does not exist': async () => {
          await db('users').where({ id: '999' }).delete();
        },
        'user registration is available': async () => {
          await db('users').where({ email: 'hanako@example.com' }).delete();
        },
      },

      // Request filter (e.g., injecting auth tokens)
      requestFilter: (req, res, next) => {
        req.headers['authorization'] = 'Bearer test-provider-token';
        next();
      },
    };

    await new Verifier(opts).verifyProvider();
  });
});
```

### 5.4 Pact Broker and Deploy Safety

```bash
# can-i-deploy check in Pact Broker
# Run before Consumer deployment
pact-broker can-i-deploy \
  --pacticipant FrontendApp \
  --version $(git rev-parse HEAD) \
  --to-environment production

# Run before Provider deployment
pact-broker can-i-deploy \
  --pacticipant UserAPI \
  --version $(git rev-parse HEAD) \
  --to-environment production

# Record a successful deployment
pact-broker record-deployment \
  --pacticipant UserAPI \
  --version $(git rev-parse HEAD) \
  --environment production
```

---

## 6. Load Testing

### 6.1 Types and Purpose of Load Tests

Load testing verifies that an API operates correctly under a given load condition. Several types exist depending on the purpose.

| Test Type | Purpose | VU Count | Duration | Characteristics |
|------------|---------|----------|----------|-----------------|
| Smoke Test | Basic operation check | 1-5 | 1 min | Quick check after deployment |
| Load Test | Normal load verification | 50-200 | 5-30 min | Performance check under normal conditions |
| Stress Test | Identifying the breaking point | 200-1000+ | 10-60 min | Find where the system breaks down |
| Spike Test | Sudden load fluctuation | 0→500→0 | 5-10 min | Resilience against instantaneous load |
| Soak Test | Long-term stability | 50-100 | 1-24 hours | Detect memory leaks, etc. |
| Breakpoint Test | Identify the breaking point | Gradually increasing | Variable | Measure maximum capacity |

### 6.2 Load Testing with k6

```javascript
// load-tests/scenarios/user-api-load.js (k6)
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics definitions
const errorRate = new Rate('errors');
const userCreated = new Counter('users_created');
const listDuration = new Trend('list_duration', true);
const createDuration = new Trend('create_duration', true);

// Test scenario configuration
export const options = {
  scenarios: {
    // Scenario 1: Read-heavy normal load
    read_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },    // Warm-up
        { duration: '2m',  target: 30 },    // Steady load
        { duration: '30s', target: 0 },     // Cool-down
      ],
      gracefulRampDown: '10s',
      exec: 'readScenario',
      tags: { scenario: 'read' },
    },
    // Scenario 2: Write-heavy high load
    write_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m',  target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'writeScenario',
      startTime: '10s',  // Start 10 seconds later
      tags: { scenario: 'write' },
    },
    // Scenario 3: Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },     // Baseline
        { duration: '5s',  target: 100 },   // Sudden spike
        { duration: '30s', target: 100 },   // Sustained spike
        { duration: '5s',  target: 5 },     // Sudden decrease
        { duration: '30s', target: 5 },     // Recovery check
        { duration: '10s', target: 0 },     // End
      ],
      exec: 'readScenario',
      startTime: '4m',  // Run after other scenarios
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    // Global thresholds
    http_req_duration: ['p(50)<200', 'p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],

    // Per-scenario thresholds
    'http_req_duration{scenario:read}': ['p(95)<300'],
    'http_req_duration{scenario:write}': ['p(95)<800'],
    'http_req_duration{scenario:spike}': ['p(95)<2000'],

    // Custom metric thresholds
    list_duration: ['p(95)<400'],
    create_duration: ['p(95)<700'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api-staging.example.com/v1';
const TOKEN = __ENV.API_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Read scenario
export function readScenario() {
  group('Get user list', () => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/users?limit=20`, { headers });
    listDuration.add(Date.now() - startTime);

    const success = check(res, {
      'Status is 200': (r) => r.status === 200,
      'Response contains data': (r) => {
        try { return JSON.parse(r.body).data !== undefined; }
        catch { return false; }
      },
      'Response time < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!success);
  });

  group('Get individual user', () => {
    const userId = `user_${Math.floor(Math.random() * 100) + 1}`;
    const res = http.get(`${BASE_URL}/users/${userId}`, { headers });

    const success = check(res, {
      'Status is 200 or 404': (r) => [200, 404].includes(r.status),
      'Response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(!success);
  });

  sleep(Math.random() * 2 + 1); // Random think time of 1–3 seconds
}

// Write scenario
export function writeScenario() {
  group('Create user', () => {
    const startTime = Date.now();
    const uniqueId = `${Date.now()}_${__VU}_${__ITER}`;
    const payload = JSON.stringify({
      name: `LoadTest User ${uniqueId}`,
      email: `loadtest_${uniqueId}@example.com`,
      age: Math.floor(Math.random() * 60) + 18,
    });

    const res = http.post(`${BASE_URL}/users`, payload, { headers });
    createDuration.add(Date.now() - startTime);

    const success = check(res, {
      'Status is 201': (r) => r.status === 201,
      'Created user ID is returned': (r) => {
        try { return JSON.parse(r.body).data.id !== undefined; }
        catch { return false; }
      },
      'Response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (success) userCreated.add(1);
    errorRate.add(!success);
  });

  sleep(Math.random() * 3 + 2); // Think time of 2–5 seconds
}

// Output test result summary
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    './reports/load-test-summary.json': JSON.stringify(data, null, 2),
  };
}
```

```bash
# k6 run command
k6 run load-tests/scenarios/user-api-load.js \
  --env BASE_URL=https://api-staging.example.com/v1 \
  --env API_TOKEN=sk_test_xxx \
  --out json=./reports/k6-results.json

# Output to Grafana + InfluxDB
k6 run load-tests/scenarios/user-api-load.js \
  --out influxdb=http://localhost:8086/k6
```

### 6.3 Load Testing with Artillery

```yaml
# load-tests/artillery/user-api.yml
config:
  target: "https://api-staging.example.com"
  phases:
    - name: "Warm-up"
      duration: 30
      arrivalRate: 5
    - name: "Normal load"
      duration: 120
      arrivalRate: 20
    - name: "Peak load"
      duration: 60
      arrivalRate: 50
    - name: "Cool-down"
      duration: 30
      arrivalRate: 5
  defaults:
    headers:
      Authorization: "Bearer {{ $processEnvironment.API_TOKEN }}"
      Content-Type: "application/json"
  plugins:
    expect: {}
  ensure:
    p95: 500
    p99: 1000
    maxErrorRate: 1

scenarios:
  - name: "Get user list"
    weight: 60
    flow:
      - get:
          url: "/api/v1/users?limit=20"
          expect:
            - statusCode: 200
            - hasProperty: "data"
            - contentType: "application/json"

  - name: "Create user → Get → Update"
    weight: 30
    flow:
      - post:
          url: "/api/v1/users"
          json:
            name: "Artillery User {{ $randomString() }}"
            email: "artillery_{{ $timestamp() }}@example.com"
            age: "{{ $randomNumber(18, 80) }}"
          capture:
            - json: "$.data.id"
              as: "userId"
          expect:
            - statusCode: 201
      - think: 1
      - get:
          url: "/api/v1/users/{{ userId }}"
          expect:
            - statusCode: 200
      - think: 1
      - put:
          url: "/api/v1/users/{{ userId }}"
          json:
            name: "Updated User {{ $randomString() }}"
          expect:
            - statusCode: 200

  - name: "Search scenario"
    weight: 10
    flow:
      - get:
          url: "/api/v1/users?filter[role]=admin&sort=-createdAt&limit=5"
          expect:
            - statusCode: 200
```

```bash
# Artillery run command
artillery run load-tests/artillery/user-api.yml \
  --output ./reports/artillery-report.json

# Generate HTML report
artillery report ./reports/artillery-report.json \
  --output ./reports/artillery-report.html
```

---

## 7. E2E Testing

### 7.1 Designing E2E Tests

E2E (End-to-End) tests simulate real user scenarios and verify that the overall flow works correctly across multiple APIs. They sit at the top of the test pyramid, are few in number, but provide high confidence.

```
E2E Test Scenario Example: E-Commerce Purchase Flow

  [1] Register                [2] Login
  POST /auth/register   -->  POST /auth/login
  201 Created                 200 OK (token)
       |                           |
       v                           v
  [3] Get product list        [4] Add product to cart
  GET /products          -->  POST /cart/items
  200 OK                      201 Created
       |                           |
       v                           v
  [5] View cart               [6] Create order
  GET /cart              -->  POST /orders
  200 OK                      201 Created
       |                           |
       v                           v
  [7] Execute payment         [8] Confirm order
  POST /payments         -->  GET /orders/:id
  200 OK                      200 OK (status: paid)
       |
       v
  [9] Email confirmation (async)
  → Verify that an order confirmation email was sent via queue
```

### 7.2 Implementing E2E Tests

```javascript
// __tests__/e2e/purchaseFlow.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { seedProducts } from '../helpers/seedData';

const request = supertest(app);

describe('E2E: Product Purchase Flow', () => {
  let accessToken;
  let userId;
  let productId;
  let cartId;
  let orderId;

  beforeAll(async () => {
    await db.migrate.latest();
    await db.raw('TRUNCATE TABLE users, products, carts, orders, payments CASCADE');
    // Insert test product data
    const products = await seedProducts(db);
    productId = products[0].id;
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('Step 1: Register', async () => {
    const res = await request
      .post('/auth/register')
      .send({
        name: 'E2E Test User',
        email: 'e2e@example.com',
        password: 'SecurePass123!',
      })
      .expect(201);

    expect(res.body.data.id).toBeDefined();
    userId = res.body.data.id;
  });

  it('Step 2: Login', async () => {
    const res = await request
      .post('/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'SecurePass123!',
      })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    accessToken = res.body.accessToken;
  });

  it('Step 3: Get product list', async () => {
    const res = await request
      .get('/api/v1/products?limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('price');
  });

  it('Step 4: Add product to cart', async () => {
    const res = await request
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productId,
        quantity: 2,
      })
      .expect(201);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].productId).toBe(productId);
    cartId = res.body.data.id;
  });

  it('Step 5: View cart', async () => {
    const res = await request
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totalAmount).toBeGreaterThan(0);
  });

  it('Step 6: Create order', async () => {
    const res = await request
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        cartId,
        shippingAddress: {
          postalCode: '100-0001',
          prefecture: 'Tokyo',
          city: 'Chiyoda',
          line1: 'Chiyoda 1-1',
        },
      })
      .expect(201);

    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.totalAmount).toBeGreaterThan(0);
    orderId = res.body.data.id;
  });

  it('Step 7: Execute payment', async () => {
    const res = await request
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        orderId,
        method: 'credit_card',
        cardToken: 'tok_test_visa',
      })
      .expect(200);

    expect(res.body.data.status).toBe('succeeded');
    expect(res.body.data.orderId).toBe(orderId);
  });

  it('Step 8: Confirm order status', async () => {
    const res = await request
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.payment).toBeDefined();
    expect(res.body.data.payment.status).toBe('succeeded');
  });
});
```

---

## 8. OpenAPI Specification-Based Testing

### 8.1 Schema Validation Tests

Tests based on the OpenAPI (formerly Swagger) specification automatically verify that API responses conform to the defined schema. This reduces the effort of writing test cases by hand and prevents divergence between the specification and implementation.

```javascript
// __tests__/schema/openapi-validation.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { app } from '../../src/app';
import { resolveRefs } from '../helpers/schemaResolver';

const request = supertest(app);

describe('OpenAPI Schema Validation', () => {
  let spec;
  let ajv;
  let token;

  beforeAll(async () => {
    // Load the OpenAPI specification
    spec = yaml.load(readFileSync('./openapi.yaml', 'utf-8'));

    // Configure JSON schema validator
    ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: true,
    });
    addFormats(ajv);

    // Get test token
    const loginRes = await request
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test123' });
    token = loginRes.body.accessToken;
  });

  // Auto-generate tests for each path in the OpenAPI spec
  const endpoints = [
    { method: 'get', path: '/api/v1/users', status: 200 },
    { method: 'get', path: '/api/v1/users/test_id', status: 200 },
    { method: 'get', path: '/api/v1/products', status: 200 },
  ];

  endpoints.forEach(({ method, path, status }) => {
    it(`${method.toUpperCase()} ${path} response conforms to schema`, async () => {
      const res = await requestmethod
        .set('Authorization', `Bearer ${token}`);

      // Get OpenAPI schema
      const specPath = path.replace(/\/test_id/, '/{id}')
                           .replace('/api/v1', '');
      const responseSchema = spec.paths[specPath]?.[method]
        ?.responses?.[String(status)]
        ?.content?.['application/json']?.schema;

      if (!responseSchema) {
        throw new Error(`Schema not found: ${method.toUpperCase()} ${specPath} ${status}`);
      }

      // Resolve $ref and run validation
      const resolvedSchema = resolveRefs(responseSchema, spec);
      const validate = ajv.compile(resolvedSchema);
      const valid = validate(res.body);

      if (!valid) {
        console.error('Validation error:', JSON.stringify(validate.errors, null, 2));
      }

      expect(valid).toBe(true);
    });
  });
});
```

### 8.2 Fuzzing Tests with Schemathesis

```python
# fuzz-tests/test_api_fuzz.py
# Schemathesis: Automated fuzzing tests based on the OpenAPI specification

import schemathesis
import pytest

# Load the OpenAPI specification
schema = schemathesis.from_url(
    "https://api-staging.example.com/openapi.yaml",
    base_url="https://api-staging.example.com",
)

@schema.parametrize()
def test_api_conformance(case):
    """
    Automated tests based on the OpenAPI specification
    - Generates random requests for all endpoints
    - Verifies that responses conform to the schema
    - Confirms that no 5xx errors are returned
    """
    response = case.call_and_validate()

    # 5xx errors are not acceptable
    assert response.status_code < 500, \
        f"Server error: {response.status_code} - {response.text}"

# Test considering state transitions
@schema.parametrize(method="POST")
def test_create_operations(case):
    """Verification of POST operations: confirms that a resource can be retrieved after creation"""
    response = case.call_and_validate()

    if response.status_code == 201:
        # Get the resource from the Location header
        location = response.headers.get("Location")
        if location:
            get_response = case.session.get(location)
            assert get_response.status_code == 200

# CLI execution example:
# schemathesis run https://api-staging.example.com/openapi.yaml \
#   --auth "Bearer sk_test_xxx" \
#   --stateful=links \
#   --hypothesis-seed=42 \
#   --hypothesis-max-examples=100 \
#   --checks all
```

---

## 9. Test Environments and Mocks

### 9.1 Mocking External Services (MSW)

In integration tests and E2E tests, sending actual requests to external third-party APIs should be avoided. Using MSW (Mock Service Worker) allows you to intercept requests at the network level and return mock responses.

```javascript
// __tests__/mocks/handlers.js
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock for Stripe Payment API
  http.post('https://api.stripe.com/v1/charges', async ({ request }) => {
    const body = await request.formData();
    const amount = body.get('amount');

    if (Number(amount) > 999999) {
      return HttpResponse.json(
        {
          error: {
            type: 'card_error',
            code: 'amount_too_large',
            message: 'Amount must be no more than ¥999,999',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: `ch_test_${Date.now()}`,
      object: 'charge',
      amount: Number(amount),
      currency: body.get('currency') || 'jpy',
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000),
    });
  }),

  // Mock for SendGrid Email Sending API
  http.post('https://api.sendgrid.com/v3/mail/send', async ({ request }) => {
    const body = await request.json();

    // Minimal validation even in the mock
    if (!body.personalizations?.[0]?.to?.[0]?.email) {
      return HttpResponse.json(
        { errors: [{ message: 'The to array is required' }] },
        { status: 400 }
      );
    }

    return new HttpResponse(null, { status: 202 });
  }),

  // Mock for Geocoding API
  http.get('https://api.geocoding.example.com/v1/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    const mockResults = {
      'Tokyo, Chiyoda': {
        lat: 35.6812,
        lng: 139.7671,
        formattedAddress: 'Japan, 〒100-0001 Tokyo, Chiyoda',
      },
      'Osaka, Osaka City': {
        lat: 34.6937,
        lng: 135.5023,
        formattedAddress: 'Japan, 〒530-0001 Osaka, Osaka City, Kita Ward',
      },
    };

    const result = mockResults[query];
    if (!result) {
      return HttpResponse.json({ results: [] });
    }

    return HttpResponse.json({ results: [result] });
  }),
];

// __tests__/mocks/server.js
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const mockServer = setupServer(...handlers);
```

```javascript
// __tests__/setup.js (Vitest global setup)
import { beforeAll, afterAll, afterEach } from 'vitest';
import { mockServer } from './mocks/server';

beforeAll(() => {
  mockServer.listen({
    onUnhandledRequest: 'warn', // Warn on requests outside the mock
  });
});

afterEach(() => {
  mockServer.resetHandlers(); // Reset handlers between tests
});

afterAll(() => {
  mockServer.close();
});
```

### 9.2 Test Database Strategies

```
Comparison of Test Database Strategies

+-------------------+----------------+----------------+------------------+
| Strategy          | Speed          | Isolation      | Proximity to Prod|
+-------------------+----------------+----------------+------------------+
| SQLite in-memory  | Very fast      | Fully isolated | Low              |
|                   | (ms-level)     | (per process)  | (SQL dialect diff)|
+-------------------+----------------+----------------+------------------+
| Docker PostgreSQL | Moderate       | Fully isolated | High             |
|                   | (second-level) | (per container)| (same engine)    |
+-------------------+----------------+----------------+------------------+
| Test schema       | Fast           | Schema-level   | High             |
|                   | (ms to s)      | (same DB)      | (same engine)    |
+-------------------+----------------+----------------+------------------+
| Transaction       | Very fast      | Per-test       | High             |
| rollback          | (ms-level)     | (rollback)     | (same engine)    |
+-------------------+----------------+----------------+------------------+
```

```javascript
// __tests__/setup/testDb.js
// Example implementation of the transaction rollback strategy

import { beforeEach, afterEach } from 'vitest';
import { db } from '../../src/db';

let transaction;

export function useTransactionalTests() {
  beforeEach(async () => {
    // Run each test inside a transaction
    transaction = await db.transaction();
    // Replace the application's DB instance with the transaction
    db._originalKnex = db.client;
    db.client = transaction;
  });

  afterEach(async () => {
    // Rollback after test ends (restore data to original state)
    await transaction.rollback();
    db.client = db._originalKnex;
  });
}
```

---

## 10. Integration into CI/CD Pipelines

### 10.1 Automated Test Execution Flow

```
Test Execution Flow in the CI/CD Pipeline

  Push code change
         |
         v
  +----------------------------------------------+
  |  Stage 1: Static analysis (parallel, ~1 min)  |
  |  +----------+ +----------+ +----------+      |
  |  | ESLint   | | TypeCheck| | Prettier |      |
  |  +----------+ +----------+ +----------+      |
  +----------------------------------------------+
         |
         v
  +----------------------------------------------+
  |  Stage 2: Unit tests (parallel, ~2 min)       |
  |  +------------------+ +-------------------+  |
  |  | Validation       | | Business logic    |  |
  |  | tests (500+)     | | tests (300+)      |  |
  |  +------------------+ +-------------------+  |
  +----------------------------------------------+
         |
         v
  +----------------------------------------------+
  |  Stage 3: Integration tests (Docker, ~5 min)  |
  |  +------------------+ +-------------------+  |
  |  | API endpoint     | | DB integration    |  |
  |  | tests (200+)     | | tests (100+)      |  |
  |  +------------------+ +-------------------+  |
  +----------------------------------------------+
         |
         v
  +----------------------------------------------+
  |  Stage 4: Contract tests (~3 min)             |
  |  +------------------+ +-------------------+  |
  |  | Consumer         | | can-i-deploy      |  |
  |  | verification     | | check             |  |
  |  +------------------+ +-------------------+  |
  +----------------------------------------------+
         |
         v
  +----------------------------------------------+
  |  Stage 5: E2E tests (staging env, ~10 min)    |
  |  +---------------------+                     |
  |  | Scenario tests (20+)|                     |
  |  +---------------------+                     |
  +----------------------------------------------+
         |
         v
  +----------------------------------------------+
  |  Stage 6: Load tests (nightly/manual, ~30 min)|
  |  +---------------------+                     |
  |  | k6 / Artillery      |                     |
  |  +---------------------+                     |
  +----------------------------------------------+
         |
         v
  Deploy (only when all tests pass)
```

### 10.2 GitHub Actions Configuration Example

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Run load tests nightly at 2 AM

jobs:
  # ===== Unit tests =====
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage --reporter=junit
        env:
          JUNIT_OUTPUT: ./reports/unit-tests.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: unit-test-results
          path: ./reports/

  # ===== Integration tests =====
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate:test
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379

  # ===== Contract tests =====
  contract-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:contract
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
          GIT_COMMIT_SHA: ${{ github.sha }}
          GIT_BRANCH: ${{ github.ref_name }}

  # ===== Load tests (scheduled runs only) =====
  load-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: load-tests/scenarios/user-api-load.js
        env:
          BASE_URL: ${{ secrets.STAGING_API_URL }}
          API_TOKEN: ${{ secrets.STAGING_API_TOKEN }}
```

---

## 11. Anti-Patterns and Remedies

### 11.1 Anti-Pattern 1: Implicit Dependencies Between Tests

When a test depends on side effects from another test, unexpected failures occur when the test execution order changes. This is one of the most common causes of flaky tests.

**Problematic code:**

```javascript
// Anti-pattern: test B depends on data created by test A
describe('Orders API', () => {
  // Test A: creates a user (side effect remains in DB)
  it('should create a user', async () => {
    await request.post('/api/v1/users')
      .send({ name: 'SharedUser', email: 'shared@example.com' })
      .expect(201);
  });

  // Test B: depends on the user created by test A (dangerous)
  it('should create an order for the user', async () => {
    const users = await request.get('/api/v1/users?filter[email]=shared@example.com');
    const userId = users.body.data[0].id; // undefined if test A didn't run first

    await request.post('/api/v1/orders')
      .send({ userId, items: [{ productId: 'p1', quantity: 1 }] })
      .expect(201);
  });
});
```

**Improved code:**

```javascript
// Correct pattern: each test prepares its own data independently
describe('Orders API', () => {
  let testUser;

  beforeEach(async () => {
    // Build a clean state before each test
    await db.raw('TRUNCATE TABLE users, orders CASCADE');
    testUser = await UserFactory.create({
      name: 'Test User',
      email: 'test@example.com',
    });
  });

  it('should create an order for the user', async () => {
    const res = await request.post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: testUser.id,
        items: [{ productId: 'p1', quantity: 1 }],
      })
      .expect(201);

    expect(res.body.data.userId).toBe(testUser.id);
  });
});
```

### 11.2 Anti-Pattern 2: Tests That Depend on Timeouts

Depending on `setTimeout` or a fixed wait time in asynchronous tests makes tests unstable across environments.

**Problematic code:**

```javascript
// Anti-pattern: using a fixed sleep to wait for async processing to complete
it('should send a notification after order creation', async () => {
  await request.post('/api/v1/orders')
    .send({ userId: 'u1', items: [{ productId: 'p1', quantity: 1 }] })
    .expect(201);

  // Wishful thinking: the notification will have been sent after 2 seconds...
  await new Promise(resolve => setTimeout(resolve, 2000));

  const notifications = await db('notifications').where({ userId: 'u1' });
  expect(notifications).toHaveLength(1); // Likely to fail in CI environments
});
```

**Improved code:**

```javascript
// Correct pattern: wait for completion using polling or event-driven approach
import { waitFor } from '../helpers/async';

it('should send a notification after order creation', async () => {
  await request.post('/api/v1/orders')
    .send({ userId: 'u1', items: [{ productId: 'p1', quantity: 1 }] })
    .expect(201);

  // Poll until the condition is met (max 5 seconds, check every 100ms)
  const notifications = await waitFor(
    async () => {
      const rows = await db('notifications').where({ userId: 'u1' });
      if (rows.length === 0) throw new Error('Notification has not been created yet');
      return rows;
    },
    { timeout: 5000, interval: 100 }
  );

  expect(notifications).toHaveLength(1);
  expect(notifications[0].type).toBe('order_confirmation');
});

// __tests__/helpers/async.js
export async function waitFor(fn, { timeout = 5000, interval = 100 } = {}) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      return await fn();
    } catch {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  throw new Error(`waitFor: condition was not met within ${timeout}ms`);
}
```

### 11.3 Anti-Pattern 3: Testing with Production Data

Using a copy of production data in a test environment poses problems both in terms of privacy risk and test reproducibility. It is recommended to explicitly manage test seed data.

---

## 12. Edge Case Analysis

### 12.1 Race Conditions from Concurrent Requests

Test the behavior when multiple clients operate on the same resource simultaneously.

```javascript
// __tests__/edge-cases/concurrency.test.js
describe('Race condition handling for concurrent requests', () => {
  it('one of two concurrent stock reservations for the same item should fail', async () => {
    // Prepare a product with 1 unit of stock
    await db('products').insert({
      id: 'prod_limited',
      name: 'Limited Item',
      stock: 1,
      price: 5000,
    });

    // Send two requests simultaneously
    const [res1, res2] = await Promise.all([
      request.post('/api/v1/orders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ items: [{ productId: 'prod_limited', quantity: 1 }] }),
      request.post('/api/v1/orders')
        .set('Authorization', `Bearer ${token2}`)
        .send({ items: [{ productId: 'prod_limited', quantity: 1 }] }),
    ]);

    // Verify that one returns 201 and the other returns 409 (insufficient stock)
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Verify that stock does not go negative
    const product = await db('products').where({ id: 'prod_limited' }).first();
    expect(product.stock).toBe(0);
  });

  it('optimistic lock violation should return an appropriate error', async () => {
    const user = await UserFactory.create({ name: 'Original' });

    // Two concurrent update requests
    const [res1, res2] = await Promise.all([
      request.put(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-Match', `"${user.version}"`)
        .send({ name: 'Update A' }),
      request.put(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-Match', `"${user.version}"`)
        .send({ name: 'Update B' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
```

### 12.2 Large Payloads and Rate Limiting

```javascript
// __tests__/edge-cases/limits.test.js
describe('Payload size and rate limiting', () => {
  it('returns 413 for a request body exceeding 1MB', async () => {
    const largePayload = {
      name: 'Test User',
      email: 'test@example.com',
      bio: 'x'.repeat(1024 * 1024 + 1), // Over 1MB
    };

    const res = await request
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    // Assuming a rate limit of 100 req/min
    const requests = Array.from({ length: 110 }, () =>
      request.get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
    );

    const responses = await Promise.all(requests);

    const tooManyRequests = responses.filter(r => r.status === 429);
    expect(tooManyRequests.length).toBeGreaterThan(0);

    // The 429 response should include a Retry-After header
    const rateLimitedRes = tooManyRequests[0];
    expect(rateLimitedRes.headers['retry-after']).toBeDefined();
    expect(rateLimitedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('correctly processes requests containing Unicode special characters', async () => {
    const unicodePayload = {
      name: 'Japanese test with emoji mixed in',
      email: 'unicode@example.com',
      bio: 'Newline\nTab\tSpecial chars<script>alert("xss")</script>',
    };

    const res = await request
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send(unicodePayload)
      .expect(201);

    expect(res.body.data.name).toBe('Japanese test with emoji mixed in');
    // XSS script should be escaped or removed
    expect(res.body.data.bio).not.toContain('<script>');
  });

  it('correctly processes fields with empty arrays and null values', async () => {
    const edgeCasePayload = {
      name: 'Edge Case User',
      email: 'edge@example.com',
      tags: [],
      metadata: null,
      preferences: {},
    };

    const res = await request
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send(edgeCasePayload)
      .expect(201);

    expect(res.body.data.tags).toEqual([]);
    expect(res.body.data.metadata).toBeNull();
  });
});
```

---

## 13. Test Tool Comparison Tables

### 13.1 Test Framework Comparison

| Characteristic | Vitest | Jest | Mocha + Chai | Playwright Test |
|------|--------|------|-------------|----------------|
| Execution speed | Very fast | Fast | Moderate | Moderate |
| TypeScript support | Native | Requires transform | Requires transform | Native |
| ESM support | Native | Experimental | Supported | Native |
| Watch mode | HMR-integrated | Built-in | Requires add-on | Built-in |
| Snapshot | Supported | Supported | Requires add-on | Supported |
| Coverage | v8/istanbul | istanbul | Requires add-on | Built-in |
| Parallel execution | Thread-based | Worker-based | Sequential | Worker-based |
| Mocking | vi.mock | jest.mock | sinon | Built-in |
| Config simplicity | Very simple | Moderate | Flexible but verbose | Simple |
| Vite integration | Full integration | None | None | None |
| Community | Rapidly growing | Largest | Mature | Rapidly growing |

### 13.2 Load Test Tool Comparison

| Characteristic | k6 | Artillery | Locust | Gatling | JMeter |
|------|-----|-----------|--------|---------|--------|
| Scripting language | JavaScript | YAML/JS | Python | Scala/Java | GUI/XML |
| Learning curve | Low | Very low | Low | Moderate | High |
| Resource efficiency | Very high | Moderate | Moderate | High | Low |
| Distributed execution | k6 Cloud | Artillery Cloud | Built-in | Built-in | Requires config |
| CI/CD integration | Easy | Easy | Moderate | Moderate | Difficult |
| Protocols | HTTP/WS/gRPC | HTTP/WS/Socket.io | HTTP/WS | HTTP/WS | Many |
| Real-time monitoring | Grafana integration | Built-in dashboard | Web UI | Built-in reports | Listeners |
| Script flexibility | High | Moderate | High | High | Low |
| OSS/Commercial | OSS (Cloud paid) | OSS (Cloud paid) | Fully OSS | OSS (Enterprise available) | Fully OSS |
| Recommended use | General purpose | Small–medium scale | Large distributed | Large scale | Legacy |

---

## 14. Exercises

### 14.1 Exercise 1: Basic Level (Unit Tests)

**Task:** Create unit tests for the following `OrderService` class. Include at least 3 happy-path cases, 3 error cases, and 2 boundary-value cases.

```javascript
// src/services/orderService.js
export class OrderService {
  static calculateShippingCost(totalAmount, prefecture, isExpress) {
    // Base shipping cost
    let baseCost = 600;

    // Remote area surcharge
    const remoteAreas = ['Okinawa', 'Hokkaido'];
    if (remoteAreas.includes(prefecture)) {
      baseCost += 500;
    }

    // Express surcharge
    if (isExpress) {
      baseCost += 400;
    }

    // Free shipping above a certain amount
    if (totalAmount >= 5000) {
      return { cost: 0, freeShipping: true, reason: 'Free shipping on orders over 5,000 yen' };
    }

    return { cost: baseCost, freeShipping: false, reason: null };
  }
}
```

**Expected direction of the answer:**

- Basic fee with isExpress=false for a standard prefecture (600 yen)
- Hokkaido surcharge (1,100 yen)
- Express surcharge (1,000 yen)
- Free shipping at 5,000 yen or more
- 4,999 yen (just below boundary, shipping charged) and 5,000 yen (free shipping)
- Remote area + express combination (1,500 yen)
- Robustness against negative amounts or undefined input

### 14.2 Exercise 2: Intermediate Level (Integration Tests + Mocks)

**Task:** Create an integration test suite that satisfies the following conditions.

1. Tests for the `POST /api/v1/orders` endpoint
2. Mock the Stripe API call during order creation using MSW
3. Error handling when stock is insufficient
4. Transaction rollback (order is not saved when payment fails)

**Hint:**

```javascript
// Test structure skeleton
describe('POST /api/v1/orders - Integration Tests', () => {
  // Mock Stripe API with MSW
  // Prepare product and user data in beforeEach
  // Clean up data in afterEach

  it('normal order flow: create → payment → stock update', async () => {
    // 1. Send order creation request
    // 2. Verify response (201, order ID, status)
    // 3. Verify order record in DB
    // 4. Verify that stock has decreased
  });

  it('payment failure: order should be rolled back', async () => {
    // 1. Change Stripe mock to error response
    // 2. Send order creation request
    // 3. Verify response (402 Payment Required)
    // 4. Verify that no order record exists in DB
    // 5. Verify that stock has not changed
  });
});
```

### 14.3 Exercise 3: Advanced Level (Load Tests + Performance Analysis)

**Task:** Design and implement a load test scenario using k6 that satisfies the following requirements.

1. **Load test**: 50 concurrent users for 5 minutes, verify p95 < 500ms
2. **Spike test**: Sudden variation from 10→200→10 users, verify error rate < 5%
3. **Soak test**: 20 concurrent users for 1 hour, observe trends in memory usage
4. Measure per-endpoint latency using custom metrics
5. Output test results as JSON and detect threshold violations

**Evaluation criteria:**

- Appropriateness of scenario design (gradual VU changes)
- Threshold settings (p50, p95, p99, error rate)
- Use of custom metrics
- Visualization of test results and reporting

---

## 15. Test Strategy Checklist

```
API Test Quality Checklist

[Unit Tests]
  [ ] All code paths in validation logic are tested
  [ ] Boundary values of business rules are covered
  [ ] Error cases are appropriately tested
  [ ] Dependencies are isolated with mocks/stubs
  [ ] Test coverage is 80% or higher

[Integration Tests]
  [ ] All CRUD endpoints are tested
  [ ] Authentication and authorization flows are verified
  [ ] Pagination and filtering are tested
  [ ] Error response format conforms to specification
  [ ] Test data is managed independently in each test
  [ ] Idempotency (same request twice yields same result) is verified

[Contract Tests]
  [ ] Consumer-Provider contracts are defined
  [ ] Contracts are managed in Pact Broker
  [ ] can-i-deploy pre-deployment check is performed
  [ ] Provider States are set up appropriately

[E2E Tests]
  [ ] Key user scenarios (3-5) are tested
  [ ] Test environment is configured equivalent to production
  [ ] External services are appropriately mocked

[Load Tests]
  [ ] Performance goals (SLA/SLO) are clearly defined
  [ ] Load test thresholds are configured
  [ ] Spike test verifies fault tolerance
  [ ] Regular load test execution is incorporated into CI

[Test Operations]
  [ ] A process for detecting and fixing flaky tests exists
  [ ] Test execution time is within an acceptable range
  [ ] Test reports are automatically generated
  [ ] Trends in test coverage are tracked
```

---

## 16. Frequently Asked Questions (FAQ)

### Q1: Where is the boundary between integration tests and E2E tests?

**A:** Integration tests verify the behavior of a single API endpoint (or a small number of closely related endpoints), with external services mocked. E2E tests verify user scenarios that span multiple APIs/services and are run in a configuration as close to a real environment as possible.

Specifically, input validation and DB saving for `POST /users` alone is an integration test, while a series of flows like "user registration → login → profile update → email confirmation" is classified as an E2E test. When in doubt, the criterion is whether you can identify "which component broke" when the test fails. If you can, it is an integration test; if it is difficult, it is an E2E test.

### Q2: What coverage percentage should I aim for?

**A:** Setting a uniform numerical target is dangerous, but the following goals serve as a general guideline.

- **Unit tests**: Statement coverage of 80% or more for the business logic layer
- **Integration tests**: Happy paths + key error cases (authentication errors, validation errors) for all endpoints are covered
- **Contract tests**: All Consumer-Provider interactions are covered

More important than coverage numbers is the perspective of "can the tests actually detect bugs?" Focus on branch coverage, and regularly review whether testing of edge cases and boundary values is insufficient. There is no need to demand coverage from generated code or boilerplate (config files, etc.).

### Q3: How should flaky tests (unstable tests) be managed?

**A:** Flaky tests significantly degrade CI/CD reliability, so it is important to address them as soon as they are found. Management methods are as follows.

1. **Detection**: Record test execution results and visualize the variance in success/failure for the same test. Many CI tools have flaky test detection features.
2. **Isolation**: Tag discovered flaky tests with `@flaky` and temporarily isolate them from the main test suite. Run isolated tests as a separate job so they do not block the main pipeline.
3. **Root cause analysis**: The main causes are (a) shared data between tests, (b) time-dependency, (c) network delays, (d) timing issues with asynchronous processing.
4. **Fix**: Once the root cause is identified, fix it promptly. Tests that have been left flaky for more than a week should be considered for deletion.
5. **Prevention**: Check for flaky elements in new tests during code review. Enforce techniques such as using fixed seeds, mocking time, and polling for async waiting.

### Q4: What is the most effective approach for testing between microservices?

**A:** In a microservices environment, contract testing (such as Pact) is the most cost-effective approach. Trying to run E2E tests for each service in a fully integrated state causes the environment setup and maintenance costs to explode.

The recommended strategy is as follows.

1. Enrich unit tests and integration tests within each service
2. Protect inter-service interfaces with contract tests
3. Limit E2E tests to key business flows (3-5 scenarios)
4. Use Pact Broker webhooks to automatically trigger Provider verification when contracts change

### Q5: What are the best practices for test data strategy in API testing?

**A:** A test data strategy composed of the following 3 layers is desirable.

1. **Factory pattern**: Dynamically generate data needed within tests. Use libraries like faker while managing default values for test purposes in factories.
2. **Fixtures**: Manage common master data (product categories, prefecture lists, etc.) as fixed seed files.
3. **Snapshots**: Retain complex datasets needed for specific test scenarios as JSON/SQL snapshot files.

As a principle, each test must create the data it needs in its own setup and clean up after completion. When sharing data between tests, limit it to read-only master data.

### Q6: How should unit tests, integration tests, and E2E tests be used in API testing?

**A:** Each test level is differentiated by the trade-off between verification scope and execution cost.

| Test Level | Verification Scope | External Dependencies | Execution Speed | Target Ratio |
|------------|---------|---------|---------|-----------|
| **Unit tests** | Per-function/method logic | Fully isolated with mocks/stubs | Milliseconds | 50-60% |
| **Integration tests** | Per-endpoint (API+DB) | Internal deps are real env, external APIs are mocked | Seconds | 20-30% |
| **E2E tests** | Cross-service scenarios | Configuration as close to real env as possible | Minutes | 5-10% |

**Criteria for differentiation**:
- Validation logic, calculation logic, data transformation → **unit tests**
- Endpoint input/output, authentication/authorization, database operations → **integration tests**
- Flows spanning multiple screens/APIs like user registration → login → purchase → **E2E tests**

By verifying much of the logic in unit tests, guaranteeing endpoint behavior in integration tests, and limiting E2E tests to critical business scenarios only, an efficient and maintainable test suite can be built.

### Q7: What is the difference between mocks and stubs in API testing, and how should they be used?

**A:** Mocks and stubs are both dummy objects for testing, but they differ in their verification responsibility.

| Characteristic | Stub | Mock |
|-----|--------------|--------------|
| **Purpose** | Provides the dependency needed by the subject under test | Verifies that the subject under test called the dependency correctly |
| **Verification subject** | Return value or state of the subject under test | Calls to the dependency object (count, arguments) |
| **Setup method** | Just returns a fixed value | Define expected calls in advance |
| **Failure condition** | Assertion on the subject under test fails | Expected calls to the mock are not satisfied |

**Concrete examples**:

```typescript
// Example of a stub: replaces the email service implementation with a fixed value
const emailStub = {
  send: () => Promise.resolve(true)
};
// Test verifies "did user registration succeed"

// Example of a mock: verifies that the email was called with the correct parameters
const emailMock = vi.fn();
await registerUser({ email: 'test@example.com' });
expect(emailMock).toHaveBeenCalledWith({
  to: 'test@example.com',
  subject: 'Welcome'
});
```

**Guidelines for differentiation**:
- **Use stubs**: When you want to verify patterns in the return value of a dependency (branching for happy/error cases)
- **Use mocks**: When you want to verify that a dependency was called correctly (notification sending, log output, event publishing)

Excessive use of mocks makes tests depend on implementation details and reduces refactoring resilience, so as a principle prefer stubs and limit mocks to cases where "the call to the dependency itself is the purpose of the test."

### Q8: How do you incorporate API tests into CI/CD pipelines?

**A:** When incorporating API tests into CI/CD pipelines, design the execution timing and gate conditions for each test level.

**Typical pipeline configuration**:

```yaml
# GitHub Actions example
name: API Testing Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:unit
      # Fast (tens of seconds), runs on every commit
      # Fails if coverage drops below 80%

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:integration
      # Medium speed (minutes), runs on every commit
      # Verifies endpoint behavior

  contract-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - run: npm run test:pact
      # Runs only when a PR is created
      # Publishes contract to Pact Broker

  e2e-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: npm run test:e2e
      # Runs only when merging to main branch
      # Takes the longest (minutes to tens of minutes)

  load-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - run: k6 run load-test.js
      # Scheduled execution (weekly, etc.)
      # Detects performance degradation
```

**Gate condition design**:
- **Unit and integration tests**: All must pass before merge is allowed (required gate)
- **Contract tests**: Run when PR is created, warn on failure (recommended gate)
- **E2E tests**: Run before deployment, rollback on failure (required gate)
- **Load tests**: Scheduled execution, alert when threshold is exceeded (monitoring purpose)

**Best practices**:
1. **Test parallelization**: Run tests in parallel in the CI environment to reduce feedback time
2. **Test result visualization**: Output JUnit-format reports and display results in GitHub/GitLab UI
3. **Flaky test isolation**: Separate unstable tests into a separate job so they do not block the main pipeline
4. **Cache utilization**: Cache dependency installation to reduce CI execution time
5. **Gradual rollout**: Run E2E tests in a staging environment and deploy to production only after success

This achieves a CI/CD pipeline that balances fast feedback loops with high quality assurance.

---

## 17. Summary

API testing is an important practice for guaranteeing the accuracy, reliability, and performance of APIs as the last line of defense for quality assurance. The following summarizes what was learned in this chapter.

### Test Types, Recommended Tools, and Execution Strategies

| Test Type | Recommended Tools | What to Verify | Execution Frequency | Target Ratio | Execution Time |
|-----------|-----------|---------|---------|-----------|---------|
| **Unit tests** | Vitest, Jest | Per-function/method logic | Every commit | 50-60% | Milliseconds |
| **Integration tests** | supertest + Vitest | Endpoint + DB + auth | Every commit | 20-30% | Seconds |
| **Contract tests** | Pact | Inter-service interface spec | On PR creation | 10-15% | Seconds |
| **E2E tests** | supertest / Playwright | Full user scenarios | Before deployment | 5-10% | Minutes |
| **Load tests** | k6, Artillery | Performance & scalability | Weekly/pre-release | - | Minutes to tens of minutes |
| **Fuzzing tests** | Schemathesis | Auto-discovery of edge cases/boundary values | Weekly | - | Minutes |
| **Security tests** | OWASP ZAP, Burp Suite | Vulnerability detection | Pre-release | - | Tens of minutes |

### Three Major Principles for Test Strategy Design

#### 1. Structure Based on the Test Pyramid

Following the test pyramid principle, **maximize unit tests (50-60%), keep integration tests at a moderate level (20-30%), and minimize E2E tests (5-10%)**. Tests at lower layers are faster and more stable; tests at higher layers are closer to a real environment but have higher execution costs. Maintaining an appropriate balance achieves both fast feedback loops and high quality assurance.

**Practical guidelines**:
- **Comprehensively cover** validation and calculation logic with unit tests (isolate external dependencies with mocks/stubs)
- **Guarantee** endpoint behavior and DB integration with integration tests (use a test DB)
- **Verify** only critical business scenarios with E2E tests (limit to 3-5 scenarios)

#### 2. Ensuring Test Independence and Idempotency

Each test must be **independently executable** and **not depend on execution order**. When tests share data, identifying the cause of a failure becomes difficult and parallel execution becomes impossible.

**Practical guidelines**:
- Each test creates the data it needs in its own setup and cleans it up in teardown
- Do not share DB state between tests (transaction rollback or data clearing)
- Use fixed seeds to prevent random failures (flaky tests)
- Shuffle test execution order to detect dependencies

#### 3. Integration into CI/CD Pipelines and Continuous Quality Monitoring

Tests only deliver value when **incorporated into CI/CD pipelines and executed automatically**. Running unit and integration tests on every commit, contract tests when a PR is created, and E2E tests before deployment enables early detection of quality degradation.

**Practical guidelines**:
- Run unit and integration tests on every commit and block merging on failure (required gate)
- Run contract tests when a PR is created to verify API specification compatibility
- Run E2E tests in the staging environment and deploy to production only after success
- Output test results in JUnit format and visualize in GitHub/GitLab UI
- Generate coverage reports and continuously improve untested areas
- Fix or isolate flaky tests as soon as they are found (consider deleting tests that have been left flaky for more than a week)

### Key Points

- **Be aware of the test pyramid**: Maintain a balance of unit tests 50-60%, integration tests 20-30%, E2E 5-10%
- **Differentiate between mocks and stubs**: Stubs provide return values for dependencies; mocks verify calls to dependencies. Prefer stubs as a principle
- **Protect microservices with contract tests**: Use Pact to automatically verify API specification agreement between Consumer and Provider
- **Guarantee performance with load tests**: Run load tests regularly with k6/Artillery to detect performance degradation early
- **Incorporate into CI/CD pipelines**: Run tests automatically and make them function as quality gates
- **Address flaky tests immediately**: Unstable tests significantly degrade CI/CD reliability, so fix or isolate them as soon as they are discovered

---

## FAQ

### Q1: Where should I start automating API tests?
It is recommended to start with integration tests (supertest + Vitest/Jest) that offer the highest cost-effectiveness. Create tests that cover the happy paths (CRUD operations) and key error cases (authentication errors, validation errors, 404) for the main endpoints, and set them to run automatically on every commit in the CI pipeline. After that, it is efficient to expand in the following order: unit tests for the business logic layer, contract tests between services, and E2E tests for key scenarios.

### Q2: How should the test environment database be managed?
It is recommended to prepare a dedicated test database and reset it to a clean state before and after each test suite. Methods: (1) the transaction rollback method (wrap each test in BEGIN/ROLLBACK) is the fastest; (2) the migration + seed method (rebuild the DB before the test suite starts) is the most reliable. Stand up a test DB container with Docker Compose so that the same configuration can be reproduced in CI environments. Never connect to the production DB.

### Q3: How often should load tests be run and how should thresholds be set?
Weekly scheduled execution and mandatory pre-release execution are recommended for load tests. Thresholds are set based on SLOs (Service Level Objectives). For example, define quantitative criteria such as P99 latency < 500ms, error rate < 0.1%, throughput > 1000 RPS. Using the CI integration features of k6 or Artillery to fail the test when thresholds are exceeded enables automatic detection of performance degradation. Comparison with a baseline (e.g., alert on more than 10% degradation from previous run) is also effective.

## Summary

In this guide, you learned the following:

- Design of API test strategy based on the test pyramid, and the appropriate balance across unit, integration, and E2E levels
- Integration test implementation patterns using supertest, and verification techniques for authentication, validation, and error handling
- API compatibility guarantees between microservices using Consumer-Driven Contract Testing with Pact
- Load test design using k6/Artillery and SLO-based performance threshold settings
- Test integration strategies for CI/CD pipelines, and processes for detecting, isolating, and fixing flaky tests

---

## What to Read Next

- [Monitoring and Logging](./01-monitoring-and-logging.md) -- API operational monitoring and logging strategy
- [REST Best Practices](../01-rest-and-graphql/00-rest-best-practices.md) -- REST API design fundamentals
- Authentication and Authorization -- Authentication with OAuth2 and OpenID Connect

---

## References

1. k6. "Load Testing for Engineering Teams." k6.io, 2024. https://k6.io/docs/
2. Pact Foundation. "Consumer-Driven Contract Testing." pact.io, 2024. https://docs.pact.io/
3. Schemathesis. "Property-Based API Testing with OpenAPI." github.com/schemathesis, 2024. https://github.com/schemathesis/schemathesis
4. Martin Fowler. "Testing Strategies in a Microservice Architecture." martinfowler.com, 2014. https://martinfowler.com/articles/microservice-testing/
