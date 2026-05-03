# GraphQL Advanced

> Advanced GraphQL topics. Comprehensively learn everything needed for production operations: Subscription (real-time communication), DataLoader (solving the N+1 problem), cache strategies, error handling, security, Federation, and performance tuning.

## What You Will Learn

- [ ] Understand real-time communication with Subscription
- [ ] Know how to solve the N+1 problem with DataLoader
- [ ] Learn GraphQL caching strategies across multiple layers
- [ ] Master error handling design patterns
- [ ] Implement GraphQL-specific security measures
- [ ] Use advanced schema design patterns
- [ ] Understand microservice integration with Apollo Federation
- [ ] Know how to measure and optimize performance
- [ ] Practice testing strategies and monitoring

## Prerequisites

- GraphQL basics (Query, Mutation, Schema) → See: [GraphQL Fundamentals](./01-graphql-fundamentals.md)
- REST API design principles → See: [REST Best Practices](./00-rest-best-practices.md)
- TypeScript type system → See: TypeScript Complete Guide

---

## 1. Subscription (Real-Time Communication)

### 1.1 Basic Concepts of Subscription

GraphQL Subscription provides a mechanism for real-time data delivery from server to client. Compared to polling with REST or using WebSocket directly, it offers type-safe real-time communication.

```
Subscription flow:

  Client                    Server
    |                         |
    |-- subscription req ---->|  ① Establish WebSocket connection
    |                         |
    |                         |  ② Event occurs on the server
    |<-- data push -----------|  ③ Deliver data to the client
    |                         |
    |                         |  ④ Another event occurs
    |<-- data push -----------|  ⑤ Deliver data again
    |                         |
    |-- unsubscribe --------->|  ⑥ Unsubscribe
    |                         |

  vs Polling:
    Client → Server: GET /api/messages?since=xxx  (every second)
    → Generates a large number of unnecessary requests
    → Low real-time performance (depends on polling interval)

  vs Direct WebSocket:
    → No type safety
    → Difficult to unify message format
    → GraphQL Subscription provides typed real-time communication
```

### 1.2 Schema Definition

```graphql
# Subscription schema definition
type Subscription {
  # Subscribe to new messages
  messageAdded(channelId: ID!): Message!

  # Order status changes
  orderStatusChanged(orderId: ID!): Order!

  # User online presence
  userPresenceChanged: UserPresence!

  # Real-time notification delivery
  notificationReceived(userId: ID!): Notification!

  # Dashboard metrics updates
  metricsUpdated(dashboardId: ID!): DashboardMetrics!

  # Typing indicator
  userTyping(channelId: ID!): TypingIndicator!
}

type Message {
  id: ID!
  content: String!
  author: User!
  channel: Channel!
  attachments: [Attachment!]!
  reactions: [Reaction!]!
  createdAt: DateTime!
  editedAt: DateTime
}

type UserPresence {
  user: User!
  isOnline: Boolean!
  lastSeen: DateTime!
  status: PresenceStatus!
}

enum PresenceStatus {
  ONLINE
  AWAY
  DO_NOT_DISTURB
  OFFLINE
}

type Notification {
  id: ID!
  type: NotificationType!
  title: String!
  body: String!
  actionUrl: String
  isRead: Boolean!
  createdAt: DateTime!
}

enum NotificationType {
  MESSAGE
  MENTION
  ORDER_UPDATE
  SYSTEM
  PROMOTION
}

type TypingIndicator {
  user: User!
  channelId: ID!
  isTyping: Boolean!
}

type DashboardMetrics {
  activeUsers: Int!
  requestsPerSecond: Float!
  errorRate: Float!
  averageResponseTime: Float!
  timestamp: DateTime!
}
```

### 1.3 Server-Side Implementation (Apollo Server + WebSocket)

```javascript
// Server side (Apollo Server + WebSocket)
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PubSub, withFilter } from 'graphql-subscriptions';
import express from 'express';

const pubsub = new PubSub();

// Event name constants
const EVENTS = {
  MESSAGE_ADDED: 'MESSAGE_ADDED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  USER_PRESENCE_CHANGED: 'USER_PRESENCE_CHANGED',
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',
  METRICS_UPDATED: 'METRICS_UPDATED',
  USER_TYPING: 'USER_TYPING',
};

const resolvers = {
  Subscription: {
    // Filter by channel ID with withFilter
    messageAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(EVENTS.MESSAGE_ADDED),
        (payload, variables) => {
          // Only deliver messages for the specified channel
          return payload.messageAdded.channel.id === variables.channelId;
        }
      ),
    },

    orderStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(EVENTS.ORDER_STATUS_CHANGED),
        (payload, variables) => {
          return payload.orderStatusChanged.id === variables.orderId;
        }
      ),
    },

    userPresenceChanged: {
      subscribe: () => pubsub.asyncIterator(EVENTS.USER_PRESENCE_CHANGED),
    },

    notificationReceived: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(EVENTS.NOTIFICATION_RECEIVED),
        (payload, variables, context) => {
          // Only deliver notifications to the authenticated user themselves
          return payload.notificationReceived.userId === variables.userId
            && context.user.id === variables.userId;
        }
      ),
    },

    userTyping: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(EVENTS.USER_TYPING),
        (payload, variables) => {
          return payload.userTyping.channelId === variables.channelId;
        }
      ),
    },

    metricsUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(EVENTS.METRICS_UPDATED),
        (payload, variables, context) => {
          // Only admins can subscribe to metrics
          if (!context.user?.roles?.includes('ADMIN')) {
            throw new Error('Not authorized to subscribe to metrics');
          }
          return payload.metricsUpdated.dashboardId === variables.dashboardId;
        }
      ),
    },
  },

  Mutation: {
    sendMessage: async (_, { input }, context) => {
      // Authentication check
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const message = await context.dataSources.messageAPI.create({
        ...input,
        authorId: context.user.id,
      });

      // Notify Subscription
      pubsub.publish(EVENTS.MESSAGE_ADDED, {
        messageAdded: message,
      });

      return { message, errors: [] };
    },

    updateOrderStatus: async (_, { orderId, status }, context) => {
      const order = await context.dataSources.orderAPI.updateStatus(
        orderId,
        status
      );

      // Notify of order status change
      pubsub.publish(EVENTS.ORDER_STATUS_CHANGED, {
        orderStatusChanged: order,
      });

      // Also publish a customer notification
      pubsub.publish(EVENTS.NOTIFICATION_RECEIVED, {
        notificationReceived: {
          userId: order.customerId,
          type: 'ORDER_UPDATE',
          title: 'Order status has been updated',
          body: `Order #${orderId} status changed to "${status}"`,
          createdAt: new Date().toISOString(),
        },
      });

      return order;
    },

    setTypingStatus: async (_, { channelId, isTyping }, context) => {
      pubsub.publish(EVENTS.USER_TYPING, {
        userTyping: {
          user: context.user,
          channelId,
          isTyping,
        },
      });
      return true;
    },
  },
};

// Setup Express + Apollo Server + WebSocket
const app = express();
const httpServer = createServer(app);

const schema = makeExecutableSchema({ typeDefs, resolvers });

// WebSocket server setup
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

const serverCleanup = useServer(
  {
    schema,
    context: async (ctx, msg, args) => {
      // Authentication on WebSocket connect
      const token = ctx.connectionParams?.authorization;
      if (!token) {
        throw new Error('Missing authentication token');
      }

      const user = await authenticateUser(token);
      if (!user) {
        throw new Error('Invalid authentication token');
      }

      return { user };
    },
    onConnect: async (ctx) => {
      console.log('Client connected:', ctx.connectionParams);
      // Validate on connection
      const token = ctx.connectionParams?.authorization;
      if (!token) {
        return false; // Reject the connection
      }
      return true;
    },
    onDisconnect: async (ctx, code, reason) => {
      console.log('Client disconnected:', code, reason);
      // Notify user's offline status
      if (ctx.extra?.user) {
        pubsub.publish(EVENTS.USER_PRESENCE_CHANGED, {
          userPresenceChanged: {
            user: ctx.extra.user,
            isOnline: false,
            lastSeen: new Date().toISOString(),
            status: 'OFFLINE',
          },
        });
      }
    },
    onSubscribe: (ctx, msg) => {
      console.log('Subscription started:', msg.payload.query);
    },
    onNext: (ctx, msg, args, result) => {
      // Hook called on each message send
      console.log('Sending subscription data');
    },
    onError: (ctx, msg, errors) => {
      console.error('Subscription error:', errors);
    },
    onComplete: (ctx, msg) => {
      console.log('Subscription completed');
    },
  },
  wsServer
);

// Apollo Server setup
const server = new ApolloServer({
  schema,
  plugins: [
    // Graceful HTTP server shutdown
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Graceful WebSocket server shutdown
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();

app.use(
  '/graphql',
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: await authenticateUser(req.headers.authorization),
      dataSources: createDataSources(),
    }),
  })
);

httpServer.listen(4000, () => {
  console.log('Server running on http://localhost:4000/graphql');
  console.log('WebSocket running on ws://localhost:4000/graphql');
});
```

### 1.4 Scalable PubSub Implementation (Redis)

```javascript
// In production environments, use Redis PubSub instead of in-memory PubSub
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

// Redis connection configuration
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 3,
};

// Create separate Redis connections for PubSub (recommended)
const pubsub = new RedisPubSub({
  publisher: new Redis(redisOptions),
  subscriber: new Redis(redisOptions),
  // Message serialization
  serializer: (data) => JSON.stringify(data),
  deserializer: (message) => JSON.parse(message),
  // Connection error handling
  connectionListener: (err) => {
    if (err) {
      console.error('Redis connection error:', err);
    }
  },
});

// Usage with multiple server instances:
// Server A publishes → Redis → delivered to Server B's subscriber
// → Horizontal scaling is possible

// Kafka-based PubSub (for large-scale systems)
import { KafkaPubSub } from 'graphql-kafka-subscriptions';

const kafkaPubSub = await KafkaPubSub.create({
  topic: 'graphql-subscriptions',
  host: process.env.KAFKA_HOST || 'localhost',
  port: process.env.KAFKA_PORT || '9092',
  groupIdPrefix: 'graphql-server',
  globalConfig: {
    'client.id': 'graphql-subscriptions-client',
  },
});
```

### 1.5 Client-Side Implementation (React + Apollo Client)

```javascript
// Apollo Client WebSocket configuration
import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// HTTP link (for Query, Mutation)
const httpLink = new HttpLink({
  uri: 'https://api.example.com/graphql',
  headers: {
    authorization: `Bearer ${getToken()}`,
  },
});

// WebSocket link (for Subscription)
const wsLink = new GraphQLWsLink(
  createClient({
    url: 'wss://api.example.com/graphql',
    connectionParams: () => ({
      authorization: `Bearer ${getToken()}`,
    }),
    // Reconnect settings
    retryAttempts: 5,
    shouldRetry: () => true,
    retryWait: async (retryCount) => {
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    },
    on: {
      connected: () => console.log('WebSocket connected'),
      closed: (event) => console.log('WebSocket closed:', event),
      error: (error) => console.error('WebSocket error:', error),
    },
    // KeepAlive settings
    keepAlive: 10000, // ping every 10 seconds
  })
);

// Route to the appropriate link based on operation type
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,   // Subscription → WebSocket
  httpLink  // Query, Mutation → HTTP
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

```tsx
// Usage in React components
import { useSubscription, useQuery, gql } from '@apollo/client';
import { useCallback, useEffect, useState } from 'react';

const MESSAGE_SUBSCRIPTION = gql`
  subscription OnMessageAdded($channelId: ID!) {
    messageAdded(channelId: $channelId) {
      id
      content
      author {
        id
        name
        avatar
      }
      createdAt
    }
  }
`;

const GET_MESSAGES = gql`
  query GetMessages($channelId: ID!, $first: Int!, $after: String) {
    messages(channelId: $channelId, first: $first, after: $after) {
      edges {
        node {
          id
          content
          author {
            id
            name
            avatar
          }
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function ChatMessages({ channelId }) {
  // Fetch existing messages
  const { data, loading, fetchMore, subscribeToMore } = useQuery(
    GET_MESSAGES,
    {
      variables: { channelId, first: 50 },
    }
  );

  // Use subscribeToMore to append new messages to the existing query
  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: MESSAGE_SUBSCRIPTION,
      variables: { channelId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;

        const newMessage = subscriptionData.data.messageAdded;

        // Duplicate check
        const exists = prev.messages.edges.some(
          (edge) => edge.node.id === newMessage.id
        );
        if (exists) return prev;

        return {
          ...prev,
          messages: {
            ...prev.messages,
            edges: [
              {
                __typename: 'MessageEdge',
                node: newMessage,
                cursor: newMessage.id,
              },
              ...prev.messages.edges,
            ],
          },
        };
      },
    });

    return () => unsubscribe();
  }, [channelId, subscribeToMore]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="chat-messages">
      {data?.messages.edges.map(({ node: message }) => (
        <div key={message.id} className="message">
          <img src={message.author.avatar} alt={message.author.name} />
          <div>
            <strong>{message.author.name}</strong>
            <p>{message.content}</p>
            <small>{new Date(message.createdAt).toLocaleString()}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

// Typing indicator implementation
const TYPING_SUBSCRIPTION = gql`
  subscription OnUserTyping($channelId: ID!) {
    userTyping(channelId: $channelId) {
      user {
        id
        name
      }
      isTyping
    }
  }
`;

function TypingIndicator({ channelId }) {
  const [typingUsers, setTypingUsers] = useState(new Map());

  const { data } = useSubscription(TYPING_SUBSCRIPTION, {
    variables: { channelId },
    onData: ({ data: { data } }) => {
      if (!data) return;

      const { user, isTyping } = data.userTyping;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(user.id, { name: user.name, timestamp: Date.now() });
        } else {
          next.delete(user.id);
        }
        return next;
      });
    },
  });

  // Auto-clear typing state after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = new Map();
        prev.forEach((value, key) => {
          if (now - value.timestamp < 5000) {
            next.set(key, value);
          }
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (typingUsers.size === 0) return null;

  const names = Array.from(typingUsers.values()).map((u) => u.name);

  return (
    <div className="typing-indicator">
      {names.length === 1
        ? `${names[0]} is typing...`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing...`
          : `${names.length} people are typing...`}
    </div>
  );
}
```

---

## 2. N+1 Problem and DataLoader

### 2.1 The N+1 Problem in Detail

```
N+1 problem:
  query {
    users(first: 10) {        <- 1 query (users table)
      edges {
        node {
          name
          orders {             <- 10 queries (orders table × number of users)
            total
          }
        }
      }
    }
  }

  SQL executed:
    SELECT * FROM users LIMIT 10;              -- 1 time
    SELECT * FROM orders WHERE user_id = 1;    -- +1 time
    SELECT * FROM orders WHERE user_id = 2;    -- +1 time
    SELECT * FROM orders WHERE user_id = 3;    -- +1 time
    ...                                         -- = N+1 times

  -> 10 users = 11 queries (1 + 10)
  -> 100 users = 101 queries
  -> Deep nesting grows exponentially:

  query {
    users(first: 10) {              -- 1
      orders(first: 5) {            -- 10
        items(first: 10) {          -- 50
          product {                 -- 500
            reviews(first: 5) {     -- 500
              author { name }       -- 2500
            }
          }
        }
      }
    }
  }
  -> Total: 3,061 queries!
```

### 2.2 Solving with DataLoader

```javascript
// Solving with DataLoader
import DataLoader from 'dataloader';

// === Basic batch function patterns ===

// Pattern 1: One-to-one (fetch user from user ID)
const userLoader = new DataLoader(async (userIds) => {
  console.log(`Batch loading users: [${userIds.join(', ')}]`);

  // Fetch all users in a single query
  const users = await db.query(
    'SELECT * FROM users WHERE id = ANY($1)',
    [userIds]
  );

  // Map preserving input ID order
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id) || null);
});

// Pattern 2: One-to-many (fetch order list from user ID)
const ordersByUserLoader = new DataLoader(async (userIds) => {
  console.log(`Batch loading orders for users: [${userIds.join(', ')}]`);

  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id = ANY($1) ORDER BY created_at DESC',
    [userIds]
  );

  // Group by userId and return
  const orderMap = new Map();
  orders.forEach(order => {
    if (!orderMap.has(order.userId)) {
      orderMap.set(order.userId, []);
    }
    orderMap.get(order.userId).push(order);
  });

  return userIds.map(id => orderMap.get(id) || []);
});

// Pattern 3: Conditional loader (filter by status)
const activeOrdersByUserLoader = new DataLoader(async (keys) => {
  // keys is an array of { userId, status } objects
  const userIds = [...new Set(keys.map(k => k.userId))];
  const statuses = [...new Set(keys.map(k => k.status))];

  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id = ANY($1) AND status = ANY($2)',
    [userIds, statuses]
  );

  return keys.map(key =>
    orders.filter(o => o.userId === key.userId && o.status === key.status)
  );
}, {
  // Custom cache key function (required when using objects as keys)
  cacheKeyFn: (key) => `${key.userId}:${key.status}`,
});

// Using DataLoader in resolvers
const resolvers = {
  User: {
    orders: (user, _, context) => context.loaders.ordersByUserLoader.load(user.id),
    activeOrders: (user, _, context) =>
      context.loaders.activeOrdersByUserLoader.load({
        userId: user.id,
        status: 'ACTIVE',
      }),
    // Aggregations can also be optimized with DataLoader
    orderCount: async (user, _, context) => {
      const orders = await context.loaders.ordersByUserLoader.load(user.id);
      return orders.length;
    },
  },
  Order: {
    customer: (order, _, context) => context.loaders.userLoader.load(order.userId),
    items: (order, _, context) => context.loaders.orderItemsLoader.load(order.id),
  },
  OrderItem: {
    product: (item, _, context) => context.loaders.productLoader.load(item.productId),
  },
};

// SQL executed after using DataLoader:
//   SELECT * FROM users LIMIT 10;                          -- 1 time
//   SELECT * FROM orders WHERE user_id = ANY([1,2,...10]); -- 1 time
//   SELECT * FROM products WHERE id = ANY([...]);          -- 1 time
// -> 3 total queries (N+1 resolved)
```

### 2.3 DataLoader Context Management

```javascript
// DataLoader context configuration
// Important: Create a new DataLoader instance per request
// → to prevent cache inconsistencies

function createLoaders(db) {
  return {
    // User loader
    userLoader: new DataLoader(async (ids) => {
      const users = await db.query(
        'SELECT * FROM users WHERE id = ANY($1)', [ids]
      );
      const userMap = new Map(users.map(u => [u.id, u]));
      return ids.map(id => userMap.get(id) || null);
    }, {
      // Option settings
      batch: true,          // Enable batching (default: true)
      maxBatchSize: 100,    // Maximum size per batch
      cache: true,          // Enable caching (default: true)
      batchScheduleFn: (callback) => setTimeout(callback, 10),
      // Wait 10ms before executing batch (to group more requests)
    }),

    // Order loader
    ordersByUserLoader: new DataLoader(async (userIds) => {
      const orders = await db.query(
        'SELECT * FROM orders WHERE user_id = ANY($1) ORDER BY created_at DESC',
        [userIds]
      );
      const map = new Map();
      orders.forEach(o => {
        if (!map.has(o.userId)) map.set(o.userId, []);
        map.get(o.userId).push(o);
      });
      return userIds.map(id => map.get(id) || []);
    }),

    // Product loader
    productLoader: new DataLoader(async (ids) => {
      const products = await db.query(
        'SELECT * FROM products WHERE id = ANY($1)', [ids]
      );
      const map = new Map(products.map(p => [p.id, p]));
      return ids.map(id => map.get(id) || null);
    }),

    // Order items loader
    orderItemsLoader: new DataLoader(async (orderIds) => {
      const items = await db.query(
        `SELECT oi.*, p.name as product_name, p.price
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ANY($1)`,
        [orderIds]
      );
      const map = new Map();
      items.forEach(item => {
        if (!map.has(item.orderId)) map.set(item.orderId, []);
        map.get(item.orderId).push(item);
      });
      return orderIds.map(id => map.get(id) || []);
    }),

    // Products by category loader
    productsByCategoryLoader: new DataLoader(async (categoryIds) => {
      const products = await db.query(
        'SELECT * FROM products WHERE category_id = ANY($1) ORDER BY name',
        [categoryIds]
      );
      const map = new Map();
      products.forEach(p => {
        if (!map.has(p.categoryId)) map.set(p.categoryId, []);
        map.get(p.categoryId).push(p);
      });
      return categoryIds.map(id => map.get(id) || []);
    }),
  };
}

// Apollo Server context
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    user: await authenticateUser(req),
    loaders: createLoaders(db), // Create new per request
    dataSources: createDataSources(),
  }),
});
```

### 2.4 DataLoader Priming and Cache Control

```javascript
// Advanced DataLoader usage patterns

// 1. Priming (pre-populate the cache)
const resolvers = {
  Mutation: {
    createUser: async (_, { input }, { loaders }) => {
      const user = await db.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        [input.name, input.email]
      );

      // Pre-register the created user in the DataLoader cache
      // → Avoids DB queries in subsequent resolvers
      loaders.userLoader.prime(user.id, user);

      return { user, errors: [] };
    },
  },
};

// 2. Cache clearing
async function updateUser(id, input, loaders) {
  const user = await db.query(
    'UPDATE users SET name = $2 WHERE id = $1 RETURNING *',
    [id, input.name]
  );

  // Clear old cache and set new data
  loaders.userLoader.clear(id);
  loaders.userLoader.prime(id, user);

  return user;
}

// 3. Clear all caches
function clearAllLoaderCaches(loaders) {
  Object.values(loaders).forEach(loader => {
    if (loader instanceof DataLoader) {
      loader.clearAll();
    }
  });
}

// 4. Batch function with error handling
const robustUserLoader = new DataLoader(async (ids) => {
  try {
    const users = await db.query(
      'SELECT * FROM users WHERE id = ANY($1)', [ids]
    );
    const userMap = new Map(users.map(u => [u.id, u]));

    return ids.map(id => {
      const user = userMap.get(id);
      if (!user) {
        // Return an individual error (do not fail the whole batch)
        return new Error(`User not found: ${id}`);
      }
      return user;
    });
  } catch (error) {
    // On DB error, return an error for all IDs
    return ids.map(() => new Error(`Database error: ${error.message}`));
  }
});
```

---

## 3. Cache Strategies

### 3.1 GraphQL Caching Challenges and Solutions

```
GraphQL caching challenges:
  -> REST can cache by URL
     GET /api/users/123 → Cache-Control: max-age=3600
  -> GraphQL always uses POST /graphql (same URL)
  -> HTTP caching is not applicable

Solutions (4 layers):

  ┌──────────────────────────────────────────┐
  │  Layer 1: Client-side cache              │
  │  → Apollo Client InMemoryCache           │
  │  → Normalized cache (__typename + id)    │
  ├──────────────────────────────────────────┤
  │  Layer 2: CDN cache                      │
  │  → Persisted Queries (convert to GET)    │
  │  → Automatic Persisted Queries (APQ)     │
  ├──────────────────────────────────────────┤
  │  Layer 3: Server-side cache              │
  │  → Response cache with Redis/Memcached   │
  │  → @cacheControl directive               │
  ├──────────────────────────────────────────┤
  │  Layer 4: Data source cache              │
  │  → In-request cache from DataLoader      │
  │  → HTTP cache from RESTDataSource        │
  └──────────────────────────────────────────┘
```

### 3.2 Apollo Client Normalized Cache

```javascript
// Apollo Client normalized cache
import { InMemoryCache, makeVar } from '@apollo/client';

const cache = new InMemoryCache({
  typePolicies: {
    // Cache configuration for the User type
    User: {
      keyFields: ['id'], // Generate cache key from id field
      fields: {
        // Computed full name field
        fullName: {
          read(_, { readField }) {
            const firstName = readField('firstName');
            const lastName = readField('lastName');
            return `${firstName} ${lastName}`;
          },
        },
      },
    },

    // Cache configuration for the Product type
    Product: {
      keyFields: ['sku'], // Use SKU as the key instead of id
      fields: {
        // Formatted price display
        formattedPrice: {
          read(_, { readField }) {
            const price = readField('price');
            return `$${price.toLocaleString()}`;
          },
        },
      },
    },

    // Cache configuration for query fields
    Query: {
      fields: {
        // Cache and pagination for the users query
        users: {
          keyArgs: ['filter', 'sort'], // Separate cache per these arguments
          merge(existing, incoming, { args }) {
            // Merge for pagination
            if (!existing) return incoming;
            if (args?.after) {
              // Incremental loading (infinite scroll)
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            }
            // Fresh fetch (filter change, etc.)
            return incoming;
          },
          read(existing, { args }) {
            // Read from cache
            return existing;
          },
        },

        // Cache reference for a single user
        user: {
          read(_, { args, toReference }) {
            // Reference a user already in the cache
            return toReference({
              __typename: 'User',
              id: args.id,
            });
          },
        },

        // Cache for search results
        search: {
          keyArgs: ['query', 'type'],
          merge(existing = { results: [] }, incoming) {
            return {
              ...incoming,
              results: [...existing.results, ...incoming.results],
            };
          },
        },
      },
    },

    // Cache configuration for pagination connections
    UserConnection: {
      fields: {
        edges: {
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
      },
    },
  },

  // Possible types definition (for Union/Interface resolution)
  possibleTypes: {
    SearchResult: ['User', 'Product', 'Order'],
    Node: ['User', 'Product', 'Order', 'Category'],
  },
});

// === Manual cache operations ===

// 1. Direct cache update
client.cache.modify({
  id: client.cache.identify({ __typename: 'User', id: '123' }),
  fields: {
    name: () => 'Updated Name',
    email: (prevEmail) => prevEmail, // No change
    orderCount: (prevCount) => prevCount + 1,
  },
});

// 2. Write to cache
client.cache.writeQuery({
  query: GET_USER,
  variables: { id: '123' },
  data: {
    user: {
      __typename: 'User',
      id: '123',
      name: 'New User',
      email: 'new@example.com',
    },
  },
});

// 3. Read from cache
const cachedUser = client.cache.readQuery({
  query: GET_USER,
  variables: { id: '123' },
});

// 4. Evict from cache
client.cache.evict({
  id: client.cache.identify({ __typename: 'User', id: '123' }),
});
// Garbage collection (remove unreferenced objects)
client.cache.gc();

// 5. Reactive Variables (local state management)
const isLoggedInVar = makeVar(false);
const cartItemsVar = makeVar([]);

const cache2 = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        isLoggedIn: {
          read() {
            return isLoggedInVar();
          },
        },
        cartItems: {
          read() {
            return cartItemsVar();
          },
        },
      },
    },
  },
});

// Updating Reactive Variables (automatically re-renders UI)
isLoggedInVar(true);
cartItemsVar([...cartItemsVar(), { productId: '123', quantity: 1 }]);
```

### 3.3 Persisted Queries

```javascript
// Automatic Persisted Queries (APQ)
// → Convert query strings to SHA256 hashes for GET requests
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';
import { sha256 } from 'crypto-hash';

const persistedQueryLink = createPersistedQueryLink({
  sha256,
  useGETForHashedQueries: true, // Use GET requests → CDN-cacheable
});

const client = new ApolloClient({
  link: persistedQueryLink.concat(httpLink),
  cache: new InMemoryCache(),
});

// APQ flow:
// 1. First request: GET /graphql?extensions={"persistedQuery":{"sha256Hash":"abc..."}}
// 2. Server: returns "PersistedQueryNotFound"
// 3. Client: sends full query via POST /graphql
// 4. Server: stores the query associated with its hash
// 5. Subsequent requests: GET /graphql?extensions={"persistedQuery":{"sha256Hash":"abc..."}}
//    → Can be cached by CDN!

// Server-side configuration (Apollo Server)
const server = new ApolloServer({
  typeDefs,
  resolvers,
  persistedQueries: {
    // Persist with Redis cache
    cache: new KeyValueCache({
      url: process.env.REDIS_URL,
      ttl: 86400, // 24 hours
    }),
  },
});
```

### 3.4 Server-Side Caching

```javascript
// Cache control via @cacheControl directive
const typeDefs = gql`
  # Directive definition
  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  directive @cacheControl(
    maxAge: Int
    scope: CacheControlScope
    inheritMaxAge: Boolean
  ) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

  # Type-level cache settings
  type Product @cacheControl(maxAge: 3600) {
    id: ID!
    name: String!
    description: String!
    price: Float! @cacheControl(maxAge: 300)  # Price: 5 minutes
    inventory: Int! @cacheControl(maxAge: 30) # Inventory: 30 seconds
  }

  type User @cacheControl(maxAge: 0, scope: PRIVATE) {
    id: ID!
    name: String!
    email: String!
    orders: [Order!]! @cacheControl(maxAge: 60, scope: PRIVATE)
  }

  type Query {
    products(category: String): [Product!]! @cacheControl(maxAge: 600)
    product(id: ID!): Product @cacheControl(maxAge: 3600)
    me: User @cacheControl(maxAge: 0, scope: PRIVATE)
  }
`;

// Resolver-level caching with Redis
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

function withCache(resolver, options = {}) {
  const { ttl = 300, keyPrefix = 'gql' } = options;

  return async (parent, args, context, info) => {
    const cacheKey = `${keyPrefix}:${info.fieldName}:${JSON.stringify(args)}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Execute resolver
    const result = await resolver(parent, args, context, info);

    // Save to cache
    await redis.setex(cacheKey, ttl, JSON.stringify(result));

    return result;
  };
}

// Usage example
const resolvers = {
  Query: {
    products: withCache(
      async (_, { category }, { dataSources }) => {
        return dataSources.productAPI.getProducts({ category });
      },
      { ttl: 600, keyPrefix: 'products' }
    ),

    product: withCache(
      async (_, { id }, { dataSources }) => {
        return dataSources.productAPI.getProduct(id);
      },
      { ttl: 3600, keyPrefix: 'product' }
    ),
  },
};

// Cache invalidation
async function invalidateProductCache(productId) {
  // Delete individual product cache
  await redis.del(`product:product:{"id":"${productId}"}`);

  // Delete all product list caches
  const keys = await redis.keys('products:products:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

---

## 4. Error Handling

### 4.1 Error Pattern Classification

```graphql
# Two error patterns in GraphQL

# (1) Top-level errors (errors array per GraphQL spec)
# -> Authentication errors, syntax errors, server errors
# -> Errors the client cannot anticipate
{
  "data": null,
  "errors": [
    {
      "message": "Not authenticated",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["user"],
      "extensions": {
        "code": "UNAUTHENTICATED",
        "http": { "status": 401 }
      }
    }
  ]
}

# (2) Business logic errors (errors inside Payload)
# -> Validation, business rule violations
# -> Errors the client should handle
{
  "data": {
    "createUser": {
      "user": null,
      "errors": [
        {
          "field": "email",
          "message": "Already exists",
          "code": "ALREADY_EXISTS"
        }
      ]
    }
  }
}

# (3) Partial success pattern
# -> Some fields are null; others return normally
{
  "data": {
    "user": {
      "name": "Alice",
      "orders": null,
      "profile": {
        "bio": "Developer"
      }
    }
  },
  "errors": [
    {
      "message": "Failed to fetch orders",
      "path": ["user", "orders"],
      "extensions": { "code": "INTERNAL_SERVER_ERROR" }
    }
  ]
}
```

### 4.2 Result Type Pattern (Expressing Errors via Union Types)

```graphql
# Result type pattern: type-safe error expression using Union types
# → The most robust approach leveraging the GraphQL type system

# Error type definitions
interface UserError {
  message: String!
  path: [String!]
}

type ValidationError implements UserError {
  message: String!
  path: [String!]
  field: String!
  constraint: String!
}

type NotFoundError implements UserError {
  message: String!
  path: [String!]
  resourceType: String!
  resourceId: ID!
}

type AuthorizationError implements UserError {
  message: String!
  path: [String!]
  requiredPermission: String!
}

type BusinessRuleError implements UserError {
  message: String!
  path: [String!]
  code: String!
  details: JSON
}

# Union types for Mutation results
union CreateUserResult = CreateUserSuccess | ValidationError | AuthorizationError

type CreateUserSuccess {
  user: User!
}

union UpdateOrderResult =
  | UpdateOrderSuccess
  | NotFoundError
  | AuthorizationError
  | BusinessRuleError

type UpdateOrderSuccess {
  order: Order!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserResult!
  updateOrder(id: ID!, input: UpdateOrderInput!): UpdateOrderResult!
}

# Client-side query
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    ... on CreateUserSuccess {
      user {
        id
        name
        email
      }
    }
    ... on ValidationError {
      message
      field
      constraint
    }
    ... on AuthorizationError {
      message
      requiredPermission
    }
  }
}
```

### 4.3 Server-Side Error Handling Implementation

```javascript
// Server-side error handling
import { GraphQLError } from 'graphql';

// Custom error class definitions
class AppError extends GraphQLError {
  constructor(message, code, extensions = {}) {
    super(message, {
      extensions: {
        code,
        ...extensions,
      },
    });
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Not authenticated') {
    super(message, 'UNAUTHENTICATED', { http: { status: 401 } });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 'FORBIDDEN', { http: { status: 403 } });
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', {
      http: { status: 404 },
      resource,
      resourceId: id,
    });
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 'VALIDATION_ERROR', {
      http: { status: 400 },
      validationErrors: errors,
    });
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter) {
    super('Rate limit exceeded', 'RATE_LIMITED', {
      http: { status: 429 },
      retryAfter,
    });
  }
}

// Usage in resolvers
const resolvers = {
  Query: {
    user: async (_, { id }, context) => {
      // Authentication check
      if (!context.user) {
        throw new AuthenticationError();
      }

      // Authorization check
      if (!context.user.canViewUser(id)) {
        throw new ForbiddenError('You do not have permission to view this user');
      }

      const user = await context.dataSources.userAPI.getUser(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }

      return user;
    },
  },

  Mutation: {
    createUser: async (_, { input }, context) => {
      // Validation
      const validationErrors = validateCreateUserInput(input);
      if (validationErrors.length > 0) {
        // Using the Result type pattern
        return {
          __typename: 'ValidationError',
          message: 'Validation failed',
          field: validationErrors[0].field,
          constraint: validationErrors[0].constraint,
          path: ['createUser'],
        };
      }

      try {
        const user = await context.dataSources.userAPI.create(input);
        return {
          __typename: 'CreateUserSuccess',
          user,
        };
      } catch (error) {
        if (error.code === 'UNIQUE_VIOLATION') {
          return {
            __typename: 'ValidationError',
            message: 'Email already exists',
            field: 'email',
            constraint: 'unique',
            path: ['createUser', 'input', 'email'],
          };
        }
        throw error; // Unexpected errors bubble up to the top level
      }
    },

    updateOrder: async (_, { id, input }, context) => {
      if (!context.user) {
        return {
          __typename: 'AuthorizationError',
          message: 'Authentication required',
          requiredPermission: 'orders:write',
          path: ['updateOrder'],
        };
      }

      const order = await context.dataSources.orderAPI.getOrder(id);
      if (!order) {
        return {
          __typename: 'NotFoundError',
          message: `Order not found: ${id}`,
          resourceType: 'Order',
          resourceId: id,
          path: ['updateOrder'],
        };
      }

      // Business rule check
      if (order.status === 'SHIPPED' && input.status === 'CANCELLED') {
        return {
          __typename: 'BusinessRuleError',
          message: 'Cannot cancel a shipped order',
          code: 'ORDER_ALREADY_SHIPPED',
          details: { currentStatus: order.status, requestedStatus: input.status },
          path: ['updateOrder'],
        };
      }

      const updated = await context.dataSources.orderAPI.update(id, input);
      return {
        __typename: 'UpdateOrderSuccess',
        order: updated,
      };
    },
  },
};

// Global error formatter
const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (formattedError, error) => {
    // Log internal error details
    console.error('GraphQL Error:', {
      message: formattedError.message,
      code: formattedError.extensions?.code,
      path: formattedError.path,
      originalError: error,
    });

    // Hide internal error details in production
    if (process.env.NODE_ENV === 'production') {
      if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return {
          ...formattedError,
          message: 'An internal error occurred',
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
          },
        };
      }
    }

    // Remove stack trace
    delete formattedError.extensions?.stacktrace;

    return formattedError;
  },
});
```

### 4.4 Client-Side Error Handling

```typescript
// Client-side error handling (React + Apollo Client)
import { ApolloError, useQuery, useMutation } from '@apollo/client';

// Error link configuration
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const error of graphQLErrors) {
      switch (error.extensions?.code) {
        case 'UNAUTHENTICATED':
          // Try token refresh
          const oldHeaders = operation.getContext().headers;
          return fromPromise(
            refreshToken().then((newToken) => {
              operation.setContext({
                headers: {
                  ...oldHeaders,
                  authorization: `Bearer ${newToken}`,
                },
              });
              return forward(operation);
            })
          ).flatMap((result) => result);

        case 'FORBIDDEN':
          // Redirect to permission error page
          window.location.href = '/forbidden';
          break;

        case 'RATE_LIMITED':
          // Retry
          const retryAfter = error.extensions?.retryAfter || 60;
          console.warn(`Rate limited. Retrying after ${retryAfter}s`);
          break;

        default:
          console.error('GraphQL Error:', error.message);
      }
    }
  }

  if (networkError) {
    console.error('Network Error:', networkError);

    if ('statusCode' in networkError) {
      switch (networkError.statusCode) {
        case 503:
          // Service temporarily unavailable
          showMaintenanceNotification();
          break;
        case 502:
        case 504:
          // Gateway error → retry
          return forward(operation);
      }
    }
  }
});

// Error handling in React components
function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
    errorPolicy: 'all', // Receive partial data even with errors
  });

  if (loading) return <LoadingSpinner />;

  if (error) {
    // Network error
    if (error.networkError) {
      return <NetworkErrorMessage onRetry={() => window.location.reload()} />;
    }

    // GraphQL errors
    const authError = error.graphQLErrors?.find(
      (e) => e.extensions?.code === 'UNAUTHENTICATED'
    );
    if (authError) {
      return <LoginPrompt />;
    }

    const notFoundError = error.graphQLErrors?.find(
      (e) => e.extensions?.code === 'NOT_FOUND'
    );
    if (notFoundError) {
      return <NotFoundPage resource="User" />;
    }

    return <GenericErrorMessage error={error} />;
  }

  // Display partial data (data is available even with errors)
  return (
    <div>
      <h1>{data.user.name}</h1>
      {data.user.orders ? (
        <OrderList orders={data.user.orders} />
      ) : (
        <p>Failed to load order data</p>
      )}
    </div>
  );
}

// Mutation error handling (Result type pattern)
function CreateUserForm() {
  const [createUser, { loading }] = useMutation(CREATE_USER);

  const handleSubmit = async (input: CreateUserInput) => {
    try {
      const { data } = await createUser({ variables: { input } });

      const result = data.createUser;

      switch (result.__typename) {
        case 'CreateUserSuccess':
          toast.success('User created successfully');
          navigate(`/users/${result.user.id}`);
          break;

        case 'ValidationError':
          toast.error(`${result.field}: ${result.message}`);
          break;

        case 'AuthorizationError':
          toast.error('Permission denied');
          break;
      }
    } catch (error) {
      // Unexpected errors such as network errors
      if (error instanceof ApolloError) {
        toast.error('A communication error occurred. Please try again.');
      }
    }
  };

  return <UserForm onSubmit={handleSubmit} loading={loading} />;
}
```

---

## 5. Security

### 5.1 GraphQL-Specific Security Risks

```
GraphQL-specific security risks:

(1) Query Depth Attack:
  query {
    user(id: "1") {
      orders {
        items {
          product {
            reviews {
              author {
                orders {        <- Recursively nested
                  items { ... }
                }
              }
            }
          }
        }
      }
    }
  }
  -> Countermeasure: Limit query depth

(2) Query Complexity Attack:
  query {
    users(first: 1000) {
      orders(first: 1000) {
        items(first: 1000) { ... }
      }
    }
  }
  -> Countermeasure: Limit query cost

(3) Introspection Abuse:
  query { __schema { types { name fields { name } } } }
  -> Countermeasure: Disable in production

(4) Batch Attack (Query Batching Attack):
  [
    { "query": "query { user(id: \"1\") { ... } }" },
    { "query": "query { user(id: \"2\") { ... } }" },
    ... x 1000
  ]
  -> Countermeasure: Limit batch size

(5) Field Suggestion Attack:
  query { user { passwrd } }
  -> "Did you mean 'password'?" leaks schema information
  -> Countermeasure: Disable suggestions

(6) Alias-based Attack:
  query {
    a1: user(id: "1") { email }
    a2: user(id: "2") { email }
    ... x 1000
  }
  -> Bulk requests for the same field using aliases
  -> Countermeasure: Limit the number of aliases
```

### 5.2 Implementing Security Measures

```javascript
// Implementing security measures

// (1) Query depth limiting
import depthLimit from 'graphql-depth-limit';

// (2) Query cost analysis
import {
  createComplexityRule,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity';

// (3) Query count limiting (against alias attacks)
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    // Max 7 levels of nesting
    depthLimit(7, { ignore: ['__schema'] }),

    // Query cost limiting
    createComplexityRule({
      maximumComplexity: 1000,
      estimators: [
        fieldExtensionsEstimator(),
        simpleEstimator({ defaultComplexity: 1 }),
      ],
      onComplete: (complexity) => {
        console.log('Query Complexity:', complexity);
        // Record metrics
        metrics.recordComplexity(complexity);
      },
    }),
  ],

  // Disable introspection (production environment)
  introspection: process.env.NODE_ENV !== 'production',

  // Disable field suggestions
  includeStacktraceInErrorResponses: false,

  plugins: [
    // CSRF protection
    {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            // Content-Type check
            const contentType = requestContext.request.http?.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
              throw new GraphQLError('Content-Type must be application/json');
            }
          },
        };
      },
    },

    // Logging plugin
    {
      async requestDidStart(requestContext) {
        const start = Date.now();
        return {
          async willSendResponse(requestContext) {
            const duration = Date.now() - start;
            console.log({
              operation: requestContext.request.operationName,
              duration,
              errors: requestContext.errors?.length || 0,
            });
          },
        };
      },
    },
  ],
});

// (4) Rate limiting (field level)
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';

const rateLimitDirectiveTypeDefs = `
  directive @rateLimit(
    max: Int!
    window: String!
    message: String
  ) on FIELD_DEFINITION
`;

function rateLimitDirective(directiveName = 'rateLimit') {
  return {
    rateLimitDirectiveTypeDefs,
    rateLimitDirectiveTransformer: (schema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
          if (!directive) return fieldConfig;

          const { max, window: windowStr, message } = directive;
          const originalResolve = fieldConfig.resolve;

          fieldConfig.resolve = async (source, args, context, info) => {
            const key = `rateLimit:${context.user?.id || context.ip}:${info.fieldName}`;
            const current = await redis.incr(key);

            if (current === 1) {
              await redis.expire(key, parseWindow(windowStr));
            }

            if (current > max) {
              throw new GraphQLError(
                message || `Rate limit exceeded for ${info.fieldName}`,
                { extensions: { code: 'RATE_LIMITED' } }
              );
            }

            return originalResolve(source, args, context, info);
          };

          return fieldConfig;
        },
      }),
  };
}

// Usage in schema
const typeDefs = gql`
  ${rateLimitDirectiveTypeDefs}

  type Query {
    login(email: String!, password: String!): AuthPayload!
      @rateLimit(max: 5, window: "15m", message: "Too many login attempts")

    search(query: String!): [SearchResult!]!
      @rateLimit(max: 30, window: "1m")

    sendPasswordReset(email: String!): Boolean!
      @rateLimit(max: 3, window: "1h")
  }
`;
```

### 5.3 Authorization Implementation

```javascript
// Field-level authorization
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';

const authDirectiveTypeDefs = `
  directive @auth(
    requires: [Role!]!
  ) on FIELD_DEFINITION | OBJECT

  enum Role {
    USER
    ADMIN
    SUPER_ADMIN
    MODERATOR
  }
`;

function authDirective(directiveName = 'auth') {
  return {
    authDirectiveTypeDefs,
    authDirectiveTransformer: (schema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const directive = getDirective(schema, fieldConfig, directiveName)?.[0];
          if (!directive) return fieldConfig;

          const { requires } = directive;
          const originalResolve = fieldConfig.resolve;

          fieldConfig.resolve = async (source, args, context, info) => {
            if (!context.user) {
              throw new AuthenticationError();
            }

            const hasRole = requires.some((role) =>
              context.user.roles.includes(role)
            );

            if (!hasRole) {
              throw new ForbiddenError(
                `Requires one of: ${requires.join(', ')}`
              );
            }

            return originalResolve
              ? originalResolve(source, args, context, info)
              : source[info.fieldName];
          };

          return fieldConfig;
        },
      }),
  };
}

// Usage in schema
const typeDefs = gql`
  ${authDirectiveTypeDefs}

  type Query {
    me: User!
    users: [User!]! @auth(requires: [ADMIN])
    analytics: Analytics! @auth(requires: [ADMIN, SUPER_ADMIN])
    moderationQueue: [Report!]! @auth(requires: [MODERATOR, ADMIN])
  }

  type User {
    id: ID!
    name: String!
    email: String! @auth(requires: [ADMIN])
    phone: String @auth(requires: [ADMIN])
    orders: [Order!]!
    internalNotes: String @auth(requires: [ADMIN, SUPER_ADMIN])
  }

  type Mutation {
    deleteUser(id: ID!): Boolean! @auth(requires: [SUPER_ADMIN])
    banUser(id: ID!): User! @auth(requires: [MODERATOR, ADMIN])
  }
`;

// Persisted Queries (execute only allowed queries)
// → The strongest security measure
import { readFileSync } from 'fs';
import { join } from 'path';

// Extract queries at build time and create a whitelist
const allowedQueries = new Map();
const queryFiles = fs.readdirSync('./queries');
queryFiles.forEach((file) => {
  const query = readFileSync(join('./queries', file), 'utf-8');
  const hash = crypto.createHash('sha256').update(query).digest('hex');
  allowedQueries.set(hash, query);
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            if (process.env.NODE_ENV === 'production') {
              const queryHash = crypto
                .createHash('sha256')
                .update(requestContext.request.query)
                .digest('hex');

              if (!allowedQueries.has(queryHash)) {
                throw new GraphQLError('Query not allowed', {
                  extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
                });
              }
            }
          },
        };
      },
    },
  ],
});

// Batch size limiting
// Implemented as Express middleware
app.use('/graphql', (req, res, next) => {
  if (Array.isArray(req.body)) {
    if (req.body.length > 10) {
      return res.status(400).json({
        errors: [{ message: 'Batch size exceeds maximum of 10' }],
      });
    }
  }
  next();
});
```

---

## 6. Schema Design Patterns

### 6.1 Interfaces and Union Types

```graphql
# (1) Interface (defining common fields)
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

interface Auditable {
  createdBy: User!
  updatedBy: User
  version: Int!
}

type User implements Node & Timestamped {
  id: ID!
  name: String!
  email: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Product implements Node & Timestamped & Auditable {
  id: ID!
  name: String!
  price: Float!
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: User!
  updatedBy: User
  version: Int!
}

# (2) Union types (a set of different types)
union SearchResult = User | Product | Order | Category

type Query {
  search(query: String!, type: SearchResultType): [SearchResult!]!
}

enum SearchResultType {
  ALL
  USERS
  PRODUCTS
  ORDERS
}

# Leveraging fragments on the client side
query Search($q: String!) {
  search(query: $q) {
    ... on User {
      id
      name
      email
    }
    ... on Product {
      id
      name
      price
      category { name }
    }
    ... on Order {
      id
      total
      status
      customer { name }
    }
  }
}

# (3) Relay Node spec (Global Object Identification)
type Query {
  node(id: ID!): Node           # Fetch any Node by ID
  nodes(ids: [ID!]!): [Node]!   # Batch-fetch multiple Nodes
  users(first: Int, after: String): UserConnection!
}

# Node IDs are Base64-encoded "Type:id" format
# User:123 → "VXNlcjoxMjM="
# Product:456 → "UHJvZHVjdDo0NTY="

# (4) Custom scalars
scalar DateTime    # ISO 8601 date/time
scalar JSON        # Arbitrary JSON
scalar URL         # URL string
scalar Email       # Email address
scalar Currency    # Currency code (ISO 4217)
scalar PhoneNumber # Phone number in E.164 format

type User {
  id: ID!
  email: Email!
  phone: PhoneNumber
  website: URL
  metadata: JSON
  registeredAt: DateTime!
}
```

### 6.2 Relay Connection Spec (Cursor-Based Pagination)

```graphql
# Relay Connection specification
# → Standard for cursor-based pagination

# Connection type definitions
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type Query {
  # Forward pagination
  users(first: Int!, after: String, filter: UserFilter): UserConnection!

  # Backward pagination
  # users(last: Int!, before: String): UserConnection!
}

input UserFilter {
  name: StringFilter
  email: StringFilter
  status: UserStatus
  createdAt: DateRangeFilter
  roles: [Role!]
}

input StringFilter {
  eq: String
  contains: String
  startsWith: String
  in: [String!]
}

input DateRangeFilter {
  gte: DateTime
  lte: DateTime
}
```

```javascript
// Connection resolver implementation
const resolvers = {
  Query: {
    users: async (_, { first, after, filter }, context) => {
      // Decode cursor
      const cursor = after ? decodeCursor(after) : null;

      // Build filter conditions
      const where = buildWhereClause(filter);

      // Fetch N+1 (to determine hasNextPage)
      const limit = first + 1;

      let query = db('users').where(where).orderBy('created_at', 'desc').limit(limit);

      if (cursor) {
        query = query.where('created_at', '<', cursor.createdAt)
          .orWhere(function () {
            this.where('created_at', '=', cursor.createdAt)
              .where('id', '<', cursor.id);
          });
      }

      const rows = await query;

      const hasNextPage = rows.length > first;
      const nodes = hasNextPage ? rows.slice(0, first) : rows;

      // Total count (optional; be mindful of performance)
      const [{ count: totalCount }] = await db('users').where(where).count('* as count');

      return {
        edges: nodes.map((node) => ({
          node,
          cursor: encodeCursor({
            id: node.id,
            createdAt: node.createdAt,
          }),
        })),
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor: nodes.length > 0
            ? encodeCursor({ id: nodes[0].id, createdAt: nodes[0].createdAt })
            : null,
          endCursor: nodes.length > 0
            ? encodeCursor({
                id: nodes[nodes.length - 1].id,
                createdAt: nodes[nodes.length - 1].createdAt,
              })
            : null,
        },
        totalCount: parseInt(totalCount, 10),
      };
    },
  },
};

// Cursor encoding/decoding
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
}

// Build filter conditions
function buildWhereClause(filter) {
  if (!filter) return {};

  const conditions = {};

  if (filter.name?.contains) {
    conditions.name = ['ILIKE', `%${filter.name.contains}%`];
  }
  if (filter.status) {
    conditions.status = filter.status;
  }
  if (filter.createdAt?.gte) {
    conditions['created_at >='] = filter.createdAt.gte;
  }
  if (filter.createdAt?.lte) {
    conditions['created_at <='] = filter.createdAt.lte;
  }

  return conditions;
}
```

### 6.3 Using Directives

```graphql
# Custom directives
directive @auth(requires: [Role!]!) on FIELD_DEFINITION | OBJECT
directive @deprecated(reason: String!) on FIELD_DEFINITION | ENUM_VALUE
directive @cacheControl(maxAge: Int!, scope: CacheControlScope) on FIELD_DEFINITION | OBJECT
directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
directive @log(level: LogLevel = INFO) on FIELD_DEFINITION
directive @computed on FIELD_DEFINITION
directive @validate(
  min: Int
  max: Int
  minLength: Int
  maxLength: Int
  pattern: String
  email: Boolean
) on INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
}

# Directive usage examples
type Query {
  publicData: String!
  sensitiveData: String! @auth(requires: [ADMIN])
  oldField: String @deprecated(reason: "Use newField instead")
  cachedProducts: [Product!]! @cacheControl(maxAge: 3600)
  criticalOperation: Result! @rateLimit(max: 10, window: "1m") @log(level: WARN)
}

type User @auth(requires: [USER]) {
  id: ID!
  name: String!
  email: String! @auth(requires: [ADMIN])
  fullName: String! @computed
}

input CreateUserInput {
  name: String! @validate(minLength: 2, maxLength: 50)
  email: String! @validate(email: true)
  age: Int @validate(min: 0, max: 150)
  password: String! @validate(minLength: 8, pattern: "^(?=.*[A-Z])(?=.*[0-9])")
}
```

### 6.4 Input Types and Mutation Design Patterns

```graphql
# Mutation design best practices

# (1) Use a single Input type
input CreateUserInput {
  name: String!
  email: String!
  password: String!
  profile: CreateProfileInput
}

input CreateProfileInput {
  bio: String
  avatar: URL
  location: String
}

input UpdateUserInput {
  name: String
  email: String
  profile: UpdateProfileInput
}

input UpdateProfileInput {
  bio: String
  avatar: URL
  location: String
}

# (2) Return results via Payload types
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type DeleteUserPayload {
  deletedUserId: ID
  errors: [UserError!]!
}

# (3) Consistent Mutation naming
type Mutation {
  # CRUD operations: create/update/delete + resource name
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!

  # Actions: verb + resource name
  activateUser(id: ID!): ActivateUserPayload!
  deactivateUser(id: ID!): DeactivateUserPayload!
  resetPassword(email: String!): ResetPasswordPayload!
  verifyEmail(token: String!): VerifyEmailPayload!

  # Related resource operations
  addUserToTeam(userId: ID!, teamId: ID!): AddUserToTeamPayload!
  removeUserFromTeam(userId: ID!, teamId: ID!): RemoveUserFromTeamPayload!

  # Batch operations
  bulkCreateUsers(inputs: [CreateUserInput!]!): BulkCreateUsersPayload!
  bulkDeleteUsers(ids: [ID!]!): BulkDeleteUsersPayload!
}

# (4) File upload
scalar Upload

type Mutation {
  uploadAvatar(file: Upload!): UploadAvatarPayload!
  uploadDocument(file: Upload!, metadata: DocumentMetadataInput!): UploadDocumentPayload!
}

input DocumentMetadataInput {
  title: String!
  description: String
  category: DocumentCategory!
  tags: [String!]
}
```

---

## 7. Apollo Federation (Microservice Integration)

### 7.1 Federation Overview

```
Apollo Federation architecture:

  ┌─────────────────────────────────────┐
  │           Apollo Gateway             │
  │  (Unified GraphQL endpoint)          │
  │  Query planning & execution          │
  └───┬──────────┬──────────┬───────────┘
      │          │          │
  ┌───┴───┐  ┌──┴───┐  ┌──┴───┐
  │ Users │  │Orders│  │Prods │
  │Service│  │Srvce │  │Srvce │
  │ :4001 │  │:4002 │  │:4003 │
  └───────┘  └──────┘  └──────┘
      │          │          │
  ┌───┴───┐  ┌──┴───┐  ┌──┴───┐
  │UserDB │  │OrderDB│  │ProdDB│
  └───────┘  └──────┘  └──────┘

  Benefits:
  → Each service can be deployed independently
  → Each team manages its own schema
  → Provides a single GraphQL endpoint to clients
  → Share types (Entities) across services
```

### 7.2 Subgraph Definition

```graphql
# === Users Service (Subgraph) ===
# users-service/schema.graphql

extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
  role: Role!
  createdAt: DateTime!
}

enum Role {
  USER
  ADMIN
}

type Query {
  me: User
  user(id: ID!): User
  users(first: Int!, after: String): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}
```

```graphql
# === Orders Service (Subgraph) ===
# orders-service/schema.graphql

extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external", "@requires"])

# Extend the User type from Users Service
type User @key(fields: "id") {
  id: ID!
  orders(first: Int!, after: String): OrderConnection!
  totalSpent: Float! @requires(fields: "id")
}

type Order @key(fields: "id") {
  id: ID!
  customer: User!
  items: [OrderItem!]!
  total: Float!
  status: OrderStatus!
  createdAt: DateTime!
}

type OrderItem {
  product: Product!
  quantity: Int!
  unitPrice: Float!
  subtotal: Float!
}

# Reference to type from Products Service
type Product @key(fields: "id") {
  id: ID!
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

type Query {
  order(id: ID!): Order
  orders(filter: OrderFilter): OrderConnection!
}

type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  cancelOrder(id: ID!): CancelOrderPayload!
}
```

```graphql
# === Products Service (Subgraph) ===
# products-service/schema.graphql

extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

type Product @key(fields: "id") {
  id: ID!
  name: String!
  description: String!
  price: Float!
  category: Category!
  inventory: Int!
  reviews: [Review!]!
}

type Category @key(fields: "id") {
  id: ID!
  name: String!
  products(first: Int!, after: String): ProductConnection!
}

type Review {
  id: ID!
  author: User!
  rating: Int!
  comment: String!
  createdAt: DateTime!
}

type User @key(fields: "id") {
  id: ID!
}

type Query {
  product(id: ID!): Product
  products(filter: ProductFilter, first: Int!, after: String): ProductConnection!
  categories: [Category!]!
}
```

### 7.3 Gateway Configuration

```javascript
// Apollo Gateway configuration
import { ApolloServer } from '@apollo/server';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { startStandaloneServer } from '@apollo/server/standalone';

const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      { name: 'users', url: 'http://users-service:4001/graphql' },
      { name: 'orders', url: 'http://orders-service:4002/graphql' },
      { name: 'products', url: 'http://products-service:4003/graphql' },
    ],
    pollIntervalInMs: 10000, // Check for schema updates every 10 seconds
  }),

  // Custom DataSource (forward authentication headers)
  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        // Forward client authentication to subgraphs
        if (context.token) {
          request.http.headers.set('authorization', context.token);
        }
        // Propagate request ID (distributed tracing)
        if (context.requestId) {
          request.http.headers.set('x-request-id', context.requestId);
        }
      },
      didReceiveResponse({ response, context }) {
        // Process response headers
        const cacheControl = response.http.headers.get('cache-control');
        if (cacheControl) {
          context.cacheControl = cacheControl;
        }
        return response;
      },
    });
  },
});

const server = new ApolloServer({
  gateway,
  // Gateway-specific plugins
  plugins: [
    {
      async requestDidStart() {
        const start = Date.now();
        return {
          async willSendResponse(requestContext) {
            const duration = Date.now() - start;
            // Record gateway-level metrics
            metrics.recordGatewayLatency(
              requestContext.request.operationName,
              duration
            );
          },
        };
      },
    },
  ],
});

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    token: req.headers.authorization,
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
  }),
  listen: { port: 4000 },
});

console.log(`Gateway running at ${url}`);
```

### 7.4 Subgraph Resolver Implementation

```javascript
// Users Service resolvers
import { buildSubgraphSchema } from '@apollo/subgraph';

const resolvers = {
  Query: {
    me: (_, __, context) => context.dataSources.userAPI.getUser(context.userId),
    user: (_, { id }, context) => context.dataSources.userAPI.getUser(id),
    users: (_, args, context) => context.dataSources.userAPI.getUsers(args),
  },

  User: {
    // __resolveReference: called by Federation when resolving an Entity
    __resolveReference: (ref, context) => {
      return context.dataSources.userAPI.getUser(ref.id);
    },
  },
};

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});

// Orders Service resolvers
const orderResolvers = {
  Query: {
    order: (_, { id }, context) => context.dataSources.orderAPI.getOrder(id),
    orders: (_, { filter }, context) => context.dataSources.orderAPI.getOrders(filter),
  },

  User: {
    // Extended fields on the User type
    orders: (user, args, context) => {
      return context.dataSources.orderAPI.getOrdersByUser(user.id, args);
    },
    totalSpent: async (user, _, context) => {
      const orders = await context.dataSources.orderAPI.getOrdersByUser(user.id);
      return orders.reduce((sum, order) => sum + order.total, 0);
    },
  },

  Order: {
    customer: (order) => ({ __typename: 'User', id: order.customerId }),
    items: (order, _, context) => {
      return context.dataSources.orderAPI.getOrderItems(order.id);
    },
  },

  OrderItem: {
    product: (item) => ({ __typename: 'Product', id: item.productId }),
  },
};
```

---

## 8. Performance Tuning

### 8.1 Measuring Query Performance

```javascript
// Performance measurement plugin
const performancePlugin = {
  async requestDidStart(requestContext) {
    const start = process.hrtime.bigint();
    const resolverTimings = [];

    return {
      async executionDidStart() {
        return {
          willResolveField({ info }) {
            const fieldStart = process.hrtime.bigint();

            return (error, result) => {
              const duration = Number(process.hrtime.bigint() - fieldStart) / 1e6;
              resolverTimings.push({
                path: info.path,
                parentType: info.parentType.name,
                fieldName: info.fieldName,
                returnType: info.returnType.toString(),
                duration,
                error: error?.message,
              });
            };
          },
        };
      },

      async willSendResponse(requestContext) {
        const totalDuration = Number(process.hrtime.bigint() - start) / 1e6;

        // Detect slow resolvers (over 100ms)
        const slowResolvers = resolverTimings.filter((t) => t.duration > 100);

        if (slowResolvers.length > 0) {
          console.warn('Slow resolvers detected:', {
            operation: requestContext.request.operationName,
            totalDuration: `${totalDuration.toFixed(2)}ms`,
            slowResolvers: slowResolvers.map((r) => ({
              path: printPath(r.path),
              duration: `${r.duration.toFixed(2)}ms`,
            })),
          });
        }

        // Send metrics
        await metrics.send({
          operation: requestContext.request.operationName,
          totalDuration,
          resolverCount: resolverTimings.length,
          slowResolverCount: slowResolvers.length,
          errors: requestContext.errors?.length || 0,
        });

        // Add timing info to response in development
        if (process.env.NODE_ENV === 'development') {
          requestContext.response.extensions = {
            ...requestContext.response.extensions,
            tracing: {
              totalDuration: `${totalDuration.toFixed(2)}ms`,
              resolvers: resolverTimings.map((t) => ({
                path: printPath(t.path),
                duration: `${t.duration.toFixed(2)}ms`,
              })),
            },
          };
        }
      },
    };
  },
};

function printPath(path) {
  const parts = [];
  let current = path;
  while (current) {
    parts.unshift(current.key);
    current = current.prev;
  }
  return parts.join('.');
}
```

### 8.2 Query Optimization Techniques

```javascript
// 1. Field-level lazy resolution (only resolve fields that are requested)
const resolvers = {
  User: {
    // Only executed if the orders field is included in the query
    orders: async (user, args, context, info) => {
      // Check sub-fields from info.fieldNodes
      const requestedFields = getRequestedFields(info);

      // SELECT only the required fields
      const selectFields = mapFieldsToColumns(requestedFields);

      return context.dataSources.orderAPI.getOrdersByUser(user.id, {
        select: selectFields,
        ...args,
      });
    },

    // Optimizing heavy computed fields
    statistics: async (user, _, context, info) => {
      // Check which sub-fields of statistics were actually requested
      const requestedStats = getRequestedFields(info);

      const result = {};

      // Only calculate requested statistics
      if (requestedStats.includes('orderCount')) {
        result.orderCount = await context.loaders.orderCountLoader.load(user.id);
      }
      if (requestedStats.includes('totalSpent')) {
        result.totalSpent = await context.loaders.totalSpentLoader.load(user.id);
      }
      if (requestedStats.includes('averageOrderValue')) {
        const [count, total] = await Promise.all([
          context.loaders.orderCountLoader.load(user.id),
          context.loaders.totalSpentLoader.load(user.id),
        ]);
        result.averageOrderValue = count > 0 ? total / count : 0;
      }

      return result;
    },
  },
};

// 2. @defer / @stream directives (incremental response)
// GraphQL Incremental Delivery
const GET_USER_WITH_DEFER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      # Defer loading of heavy fields
      ... @defer(label: "orders") {
        orders(first: 10) {
          edges {
            node {
              id
              total
              status
            }
          }
        }
      }
      ... @defer(label: "recommendations") {
        recommendations {
          products {
            id
            name
            price
          }
        }
      }
    }
  }
`;

// Using @defer on the client side
function UserProfile({ userId }) {
  const { data, loading } = useQuery(GET_USER_WITH_DEFER, {
    variables: { id: userId },
  });

  return (
    <div>
      {/* Basic info displayed immediately */}
      <h1>{data?.user?.name}</h1>
      <p>{data?.user?.email}</p>

      {/* Orders loaded deferred */}
      <Suspense fallback={<OrdersSkeleton />}>
        <OrderList orders={data?.user?.orders} />
      </Suspense>

      {/* Recommendations also loaded deferred */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations items={data?.user?.recommendations} />
      </Suspense>
    </div>
  );
}

// 3. Query plan optimization
// Lookahead pattern: pre-fetch child data in the parent resolver
const resolvers = {
  Query: {
    users: async (_, args, context, info) => {
      // Check what the child fields require
      const selections = info.fieldNodes[0].selectionSet;
      const needsOrders = hasField(selections, 'orders');
      const needsProfile = hasField(selections, 'profile');

      // Bulk-fetch with JOIN or subquery
      let query = db('users').select('users.*');

      if (needsProfile) {
        query = query.leftJoin('profiles', 'users.id', 'profiles.user_id')
          .select('profiles.bio', 'profiles.avatar');
      }

      const users = await query.where(buildFilter(args.filter)).limit(args.first);

      // Prime DataLoader
      if (needsOrders) {
        const userIds = users.map(u => u.id);
        const allOrders = await db('orders').whereIn('user_id', userIds);
        const ordersByUser = groupBy(allOrders, 'userId');
        userIds.forEach(id => {
          context.loaders.ordersByUserLoader.prime(id, ordersByUser[id] || []);
        });
      }

      return users;
    },
  },
};
```

### 8.3 Production Operation Best Practices

```javascript
// Apollo Server production configuration
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginUsageReporting } from '@apollo/server/plugin/usageReporting';

const server = new ApolloServer({
  typeDefs,
  resolvers,

  // Production settings
  introspection: false,
  includeStacktraceInErrorResponses: false,

  plugins: [
    // Disable landing page
    ApolloServerPluginLandingPageDisabled(),

    // Send metrics to Apollo Studio
    ApolloServerPluginUsageReporting({
      sendVariableValues: { none: true }, // Do not send variable values
      sendHeaders: { none: true },        // Do not send headers
    }),

    // Performance measurement
    performancePlugin,

    // Request logging
    {
      async requestDidStart({ request }) {
        return {
          async didEncounterErrors({ errors }) {
            errors.forEach((error) => {
              // Error logging (send to Sentry, etc.)
              Sentry.captureException(error.originalError || error, {
                extra: {
                  query: request.query,
                  variables: request.variables,
                  operationName: request.operationName,
                },
              });
            });
          },
        };
      },
    },
  ],

  // Request body size limit
  // Configured on the expressMiddleware side
});

// Express configuration
app.use(
  '/graphql',
  express.json({ limit: '1mb' }), // Request size limit
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: await authenticateUser(req),
      loaders: createLoaders(db),
      dataSources: createDataSources(),
      requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    }),
  })
);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // DB connection check
    await db.raw('SELECT 1');
    // Redis check
    await redis.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
```

---

## 9. Testing Strategy

### 9.1 Unit Testing Resolvers

```javascript
// Resolver unit tests (Jest)
import { resolvers } from '../resolvers';

describe('User resolvers', () => {
  const mockContext = {
    user: { id: '1', roles: ['USER'] },
    dataSources: {
      userAPI: {
        getUser: jest.fn(),
        create: jest.fn(),
      },
    },
    loaders: {
      userLoader: {
        load: jest.fn(),
      },
      ordersByUserLoader: {
        load: jest.fn(),
      },
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.user', () => {
    it('should return user by id', async () => {
      const mockUser = { id: '1', name: 'Alice', email: 'alice@example.com' };
      mockContext.dataSources.userAPI.getUser.mockResolvedValue(mockUser);

      const result = await resolvers.Query.user(
        null,
        { id: '1' },
        mockContext
      );

      expect(result).toEqual(mockUser);
      expect(mockContext.dataSources.userAPI.getUser).toHaveBeenCalledWith('1');
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      const unauthContext = { ...mockContext, user: null };

      await expect(
        resolvers.Query.user(null, { id: '1' }, unauthContext)
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockContext.dataSources.userAPI.getUser.mockResolvedValue(null);

      await expect(
        resolvers.Query.user(null, { id: '999' }, mockContext)
      ).rejects.toThrow('User not found');
    });
  });

  describe('Mutation.createUser', () => {
    it('should create user successfully', async () => {
      const input = { name: 'Bob', email: 'bob@example.com', password: 'Pass123!' };
      const mockUser = { id: '2', ...input };
      mockContext.dataSources.userAPI.create.mockResolvedValue(mockUser);

      const result = await resolvers.Mutation.createUser(
        null,
        { input },
        mockContext
      );

      expect(result.__typename).toBe('CreateUserSuccess');
      expect(result.user).toEqual(mockUser);
    });

    it('should return ValidationError for invalid email', async () => {
      const input = { name: 'Bob', email: 'invalid', password: 'Pass123!' };

      const result = await resolvers.Mutation.createUser(
        null,
        { input },
        mockContext
      );

      expect(result.__typename).toBe('ValidationError');
      expect(result.field).toBe('email');
    });
  });

  describe('User.orders', () => {
    it('should load orders via DataLoader', async () => {
      const mockOrders = [
        { id: 'o1', total: 100 },
        { id: 'o2', total: 200 },
      ];
      mockContext.loaders.ordersByUserLoader.load.mockResolvedValue(mockOrders);

      const result = await resolvers.User.orders(
        { id: '1' },
        {},
        mockContext
      );

      expect(result).toEqual(mockOrders);
      expect(mockContext.loaders.ordersByUserLoader.load).toHaveBeenCalledWith('1');
    });
  });
});
```

### 9.2 Integration Tests

```javascript
// GraphQL integration tests (Apollo Server + Supertest)
import { ApolloServer } from '@apollo/server';
import request from 'supertest';
import { createTestServer, createTestDatabase } from '../test/helpers';

describe('GraphQL API Integration Tests', () => {
  let server;
  let testDb;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    server = await createTestServer(testDb);
  });

  afterAll(async () => {
    await testDb.destroy();
    await server.stop();
  });

  beforeEach(async () => {
    // Seed test data
    await testDb.seed.run();
  });

  afterEach(async () => {
    // Clear test data
    await testDb.raw('TRUNCATE users, orders, products CASCADE');
  });

  describe('Users Query', () => {
    it('should fetch paginated users', async () => {
      const query = `
        query GetUsers($first: Int!, $after: String) {
          users(first: $first, after: $after) {
            edges {
              node {
                id
                name
                email
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      `;

      const response = await request(server.app)
        .post('/graphql')
        .set('Authorization', 'Bearer test-admin-token')
        .send({
          query,
          variables: { first: 5 },
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();

      const { users } = response.body.data;
      expect(users.edges).toHaveLength(5);
      expect(users.pageInfo.hasNextPage).toBe(true);
      expect(users.totalCount).toBeGreaterThan(5);
    });

    it('should handle cursor-based pagination', async () => {
      // Page 1
      const page1 = await graphqlRequest(server, {
        query: GET_USERS,
        variables: { first: 3 },
      });

      const endCursor = page1.data.users.pageInfo.endCursor;

      // Page 2
      const page2 = await graphqlRequest(server, {
        query: GET_USERS,
        variables: { first: 3, after: endCursor },
      });

      // Verify no duplicates
      const page1Ids = page1.data.users.edges.map(e => e.node.id);
      const page2Ids = page2.data.users.edges.map(e => e.node.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Create User Mutation', () => {
    it('should create user and return via subscription', async () => {
      const mutation = `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            ... on CreateUserSuccess {
              user {
                id
                name
                email
              }
            }
            ... on ValidationError {
              message
              field
            }
          }
        }
      `;

      const response = await graphqlRequest(server, {
        query: mutation,
        variables: {
          input: {
            name: 'Test User',
            email: 'test@example.com',
            password: 'SecurePass123!',
          },
        },
      });

      expect(response.data.createUser.__typename).toBe('CreateUserSuccess');
      expect(response.data.createUser.user.name).toBe('Test User');

      // Verify saved to DB
      const dbUser = await testDb('users')
        .where({ email: 'test@example.com' })
        .first();
      expect(dbUser).toBeTruthy();
      expect(dbUser.name).toBe('Test User');
    });
  });
});
```

### 9.3 Schema Tests

```javascript
// Schema structure tests
import { buildSchema, validateSchema, introspectionFromSchema } from 'graphql';

describe('GraphQL Schema', () => {
  const schema = buildSchema(typeDefs);

  it('should have no validation errors', () => {
    const errors = validateSchema(schema);
    expect(errors).toHaveLength(0);
  });

  it('should have required query fields', () => {
    const queryType = schema.getQueryType();
    const fields = queryType.getFields();

    expect(fields).toHaveProperty('user');
    expect(fields).toHaveProperty('users');
    expect(fields).toHaveProperty('me');
    expect(fields).toHaveProperty('products');
  });

  it('should have required mutation fields', () => {
    const mutationType = schema.getMutationType();
    const fields = mutationType.getFields();

    expect(fields).toHaveProperty('createUser');
    expect(fields).toHaveProperty('updateUser');
    expect(fields).toHaveProperty('deleteUser');
  });

  it('should have Node interface implemented correctly', () => {
    const userType = schema.getType('User');
    const interfaces = userType.getInterfaces();
    const nodeInterface = interfaces.find(i => i.name === 'Node');

    expect(nodeInterface).toBeDefined();
    expect(userType.getFields()).toHaveProperty('id');
  });

  // Breaking change check
  it('should not have breaking changes from previous version', async () => {
    const { findBreakingChanges } = await import('graphql');

    const oldSchema = buildSchema(readFileSync('./schema-v1.graphql', 'utf-8'));
    const newSchema = schema;

    const breakingChanges = findBreakingChanges(oldSchema, newSchema);

    // Filter if there are allowed breaking changes
    const unexpectedChanges = breakingChanges.filter(
      change => !allowedBreakingChanges.includes(change.description)
    );

    expect(unexpectedChanges).toHaveLength(0);
  });
});
```

---

## 10. Monitoring and Observability

### 10.1 Metrics Collection

```javascript
// Prometheus metrics collection
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Metric definitions
const graphqlRequestDuration = new Histogram({
  name: 'graphql_request_duration_seconds',
  help: 'Duration of GraphQL requests',
  labelNames: ['operation', 'operationType', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const graphqlResolverDuration = new Histogram({
  name: 'graphql_resolver_duration_seconds',
  help: 'Duration of individual GraphQL resolvers',
  labelNames: ['parentType', 'fieldName'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

const graphqlErrors = new Counter({
  name: 'graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['code', 'operation'],
});

const graphqlComplexity = new Histogram({
  name: 'graphql_query_complexity',
  help: 'Complexity of GraphQL queries',
  labelNames: ['operation'],
  buckets: [10, 50, 100, 200, 500, 1000],
});

const activeSubscriptions = new Gauge({
  name: 'graphql_active_subscriptions',
  help: 'Number of active GraphQL subscriptions',
  labelNames: ['subscription'],
});

// Metrics collection plugin
const metricsPlugin = {
  async requestDidStart({ request }) {
    const timer = graphqlRequestDuration.startTimer();

    return {
      async executionDidStart() {
        return {
          willResolveField({ info }) {
            const resolverTimer = graphqlResolverDuration.startTimer({
              parentType: info.parentType.name,
              fieldName: info.fieldName,
            });

            return () => resolverTimer();
          },
        };
      },

      async willSendResponse({ response }) {
        const operationType = request.query?.includes('mutation')
          ? 'mutation'
          : request.query?.includes('subscription')
            ? 'subscription'
            : 'query';

        const status = response.body?.singleResult?.errors ? 'error' : 'success';

        timer({
          operation: request.operationName || 'anonymous',
          operationType,
          status,
        });
      },

      async didEncounterErrors({ errors }) {
        errors.forEach((error) => {
          graphqlErrors.inc({
            code: error.extensions?.code || 'UNKNOWN',
            operation: request.operationName || 'anonymous',
          });
        });
      },
    };
  },
};

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 10.2 Distributed Tracing

```javascript
// Distributed tracing with OpenTelemetry
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

// Tracer provider configuration
const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new BatchSpanProcessor(
    new JaegerExporter({
      endpoint: 'http://jaeger:14268/api/traces',
    })
  )
);
provider.register();

// GraphQL auto-instrumentation
const graphqlInstrumentation = new GraphQLInstrumentation({
  mergeItems: true,
  allowValues: process.env.NODE_ENV !== 'production',
  depth: 5,
});

graphqlInstrumentation.setTracerProvider(provider);
graphqlInstrumentation.enable();

// Adding custom spans
const tracer = trace.getTracer('graphql-api');

const resolvers = {
  Query: {
    users: async (_, args, context) => {
      return tracer.startActiveSpan('fetchUsers', async (span) => {
        try {
          span.setAttribute('user.filter', JSON.stringify(args.filter));
          span.setAttribute('user.first', args.first);

          const result = await context.dataSources.userAPI.getUsers(args);

          span.setAttribute('user.count', result.edges.length);
          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      });
    },
  },
};
```

---

## FAQ

### Q1: When should I use GraphQL Subscription vs polling?

**A:** Decide based on the balance of real-time requirements, cost, and implementation complexity.

**When to choose Subscription:**
- Chat apps, collaboration tools, and other cases where low latency is essential
- Many server-side event-driven updates (multiple times per second)
- Many clients subscribing to the same data (can be efficiently delivered via PubSub)
- WebSocket infrastructure is in place

**When to choose polling:**
- Low update frequency (once every few minutes or tens of minutes)
- Want to leverage existing HTTP/REST infrastructure
- Want to avoid the cost of maintaining WebSocket connections (mobile app battery usage, etc.)
- WebSocket is unavailable in firewall environments

**Hybrid strategy:**
```javascript
// High-priority updates via Subscription; everything else via polling
const CRITICAL_SUBSCRIPTIONS = ['newMessage', 'orderStatusUpdate'];
const POLLING_QUERIES = ['unreadCount', 'notifications'];

// Subscription (real-time)
useSubscription(NEW_MESSAGE_SUBSCRIPTION, {
  onData: ({ data }) => updateUI(data),
});

// Polling (every 30 seconds)
useQuery(UNREAD_COUNT_QUERY, {
  pollInterval: 30000,
});
```

### Q2: Should I follow the Relay spec when designing a GraphQL schema?

**A:** Decide based on the size of the project and future extensibility.

**When to follow the Relay spec:**
- Large-scale applications (hundreds or more entities)
- Heavy use of pagination
- Want to leverage normalized caching on the client (Apollo Client, Relay)
- Want to maintain schema consistency

**Benefits of Relay compliance:**
```graphql
# Relay Connection spec
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Node Interface (global ID)
interface Node {
  id: ID!  # Globally unique ID (e.g., "VXNlcjox")
}

type User implements Node {
  id: ID!
  name: String!
}
```

**Drawbacks of Relay compliance:**
- High initial implementation cost
- Schema becomes verbose even for simple cases
- Over-engineering when cursor-based pagination is not needed

**Alternative:**
```graphql
# Simple pagination (for small-scale apps)
type UserPage {
  users: [User!]!
  total: Int!
  hasMore: Boolean!
}

type Query {
  users(page: Int!, limit: Int!): UserPage!
}
```

**Recommended approach:**
- New project (medium scale or larger): Adopt the Relay spec (ensures future extensibility)
- Small feature additions to existing projects: Follow existing patterns
- Prototype/MVP: Start with simple pagination; migrate when needed

### Q3: How does GraphQL's cache strategy differ from REST?

**A:** GraphQL uses normalized caching and manages cache at the entity level, which is a key difference from REST.

**REST cache strategy:**
```
Per-endpoint caching:
  GET /api/users/123        → Cache-Control: max-age=3600
  GET /api/users/123/posts  → Cache-Control: max-age=1800

Problems:
  - The same user data is cached redundantly across multiple endpoints
  - Partial updates are difficult (even if just user.name changes, the whole thing must be re-fetched)
  - Cache invalidation is coarse (if a user is updated, invalidate all endpoints)
```

**GraphQL cache strategy:**
```javascript
// Normalized cache (Apollo Client)
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      keyFields: ['id'],  // Cache key
      fields: {
        posts: {
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          },
        },
      },
    },
  },
});

// Query 1
query GetUser {
  user(id: "123") {
    id
    name
    email
  }
}

// Query 2
query GetUserPosts {
  user(id: "123") {
    id
    name  # Served from cache (no request made)
    posts { title }
  }
}

// Automatic cache update after Mutation
mutation UpdateUserName {
  updateUser(id: "123", name: "New Name") {
    id
    name  # Automatically updates name of user:123 in the cache
  }
}
```

**GraphQL-specific cache layers:**
```
┌─────────────────────────────────────┐
│ 1. Client normalized cache          │  Apollo Client InMemoryCache
│    (User:123, Post:456)             │  → Cache per entity
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 2. Persisted Queries                │  Cache by query hash
│    (sha256: abc123 → query string)  │  → Usable via CDN/server
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 3. Server-side cache (Redis)        │  Cache resolver results
│    user:123 → { id, name, email }   │  → DataLoader + Redis
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 4. Database query cache             │  DB-layer caching
└─────────────────────────────────────┘
```

**Cache invalidation differences:**
```javascript
// REST: Invalidate per endpoint
cache.invalidate('/api/users/123');
cache.invalidate('/api/users/123/posts');

// GraphQL: Invalidate per entity
cache.evict({ id: 'User:123' });  // All queries related to User:123 are invalidated
cache.gc();  // Remove orphaned cache entries

// Or re-fetch specific queries with refetchQueries
await updateUser({
  refetchQueries: [{ query: GET_USER, variables: { id: '123' } }],
});
```

**Summary:**
| Item | REST | GraphQL |
|------|------|---------|
| Cache granularity | Endpoint | Entity (type + ID) |
| Duplicate data | Much | Minimized by normalization |
| Partial updates | Difficult | Automatic cache merge |
| Invalidation granularity | Coarse | Fine (down to field level) |
| CDN utilization | Easy | Possible with Persisted Queries |

---

## Summary

| Concept | Key Points |
|---------|-----------|
| Subscription | Real-time over WebSocket + PubSub; scale with Redis PubSub |
| DataLoader | Batch processing resolves N+1; create instance per request |
| Caching | Normalized cache + Persisted Queries + server-side Redis |
| Error handling | Top-level errors vs Payload errors; Result type pattern |
| Security | Depth limit, cost limit, rate limit, disable introspection |
| Schema design | Interface, Union, Relay Connection, custom directives |
| Federation | Microservice integration, Entity resolution, Gateway |
| Performance | Resolver profiling, @defer, query plan optimization |
| Testing | Unit tests, integration tests, schema tests |
| Monitoring | Prometheus metrics, OpenTelemetry tracing |

---

## What to Read Next
- [REST vs GraphQL](./03-rest-vs-graphql.md) -- REST vs GraphQL

---

## References
1. Apollo. "Production Readiness Checklist." apollographql.com, 2024.
2. Facebook. "DataLoader." github.com/graphql/dataloader, 2024.
3. Relay. "Relay Specification." relay.dev, 2024.
4. Apollo. "Apollo Federation." apollographql.com/docs/federation, 2024.
5. GraphQL Foundation. "GraphQL Specification." spec.graphql.org, 2024.
6. Marc-Andre Giroux. "Production Ready GraphQL." book.productionreadygraphql.com, 2024.
7. OpenTelemetry. "GraphQL Instrumentation." opentelemetry.io, 2024.
8. Lee Byron et al. "GraphQL Subscriptions." github.com/graphql/graphql-spec, 2024.
