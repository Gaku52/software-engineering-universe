# Express & NestJS — 完全ガイド

## 対応バージョン
- **Node.js**: 20.0.0+
- **Express**: 4.18.0+
- **NestJS**: 10.0.0+
- **TypeScript**: 5.0.0+
- **Fastify**: 4.25.0+

---

## Express.js — 軽量で柔軟な Web フレームワーク

### 基本アーキテクチャ

Express はミドルウェアの組み合わせを中心とした、最小限の Web フレームワークです。

```typescript
// src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import { errorHandler } from './middleware/error-handler'
import { router } from './routes'

export function createApp(): Express {
  const app = express()

  // セキュリティミドルウェア
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }))

  // CORS
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // パーサー
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // 圧縮
  app.use(compression())

  // ログ
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  // ヘルスチェック
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() })
  })

  // ルーター
  app.use('/api/v1', router)

  // エラーハンドラー（必ず最後に配置）
  app.use(errorHandler)

  return app
}
```

### レイヤードアーキテクチャ

**ディレクトリ構成:**

```
src/
├── controllers/      # リクエスト処理とレスポンス
├── services/         # ビジネスロジック
├── repositories/     # データアクセス層
├── models/           # データモデルとスキーマ
├── middleware/       # カスタムミドルウェア
├── routes/           # ルート定義
├── validators/       # 入力バリデーション
├── utils/            # ユーティリティ
└── types/            # TypeScript 型定義
```

**コントローラー層:**

```typescript
// src/controllers/product.controller.ts
import { Request, Response, NextFunction } from 'express'
import { ProductService } from '../services/product.service'

export class ProductController {
  constructor(private productService: ProductService) {}

  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, category, sortBy = 'createdAt', order = 'desc' } = req.query

      const result = await this.productService.findAll({
        page: Number(page),
        limit: Number(limit),
        category: category as string,
        sortBy: sortBy as string,
        order: order as string,
      })

      res.json({
        success: true,
        data: result.products,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  async getProductById(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.findById(req.params.id)
      res.json({ success: true, data: product })
    } catch (error) {
      next(error)
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.create(req.body)
      res.status(201).json({ success: true, data: product })
    } catch (error) {
      next(error)
    }
  }

  async updateProduct(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await this.productService.update(req.params.id, req.body)
      res.json({ success: true, data: product })
    } catch (error) {
      next(error)
    }
  }

  async deleteProduct(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.productService.delete(req.params.id)
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
```

**サービス層:**

```typescript
// src/services/product.service.ts
import { ProductRepository } from '../repositories/product.repository'
import { CacheService } from './cache.service'

export class ProductService {
  constructor(
    private productRepository: ProductRepository,
    private cacheService: CacheService
  ) {}

  async findAll(query: ProductQuery) {
    const cacheKey = `products:${JSON.stringify(query)}`

    // キャッシュを確認
    const cached = await this.cacheService.get(cacheKey)
    if (cached) return cached

    const result = await this.productRepository.findAll(query)

    // 5分間キャッシュする
    await this.cacheService.set(cacheKey, result, 300)

    return result
  }

  async findById(id: string) {
    const product = await this.productRepository.findById(id)
    if (!product) throw new NotFoundError(`Product ${id} not found`)
    return product
  }

  async create(dto: CreateProductDto) {
    if (dto.price <= 0) throw new ValidationError('Price must be positive')
    return await this.productRepository.create(dto)
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id)  // 存在確認
    return await this.productRepository.update(id, dto)
  }

  async delete(id: string) {
    await this.findById(id)
    await this.productRepository.delete(id)
  }
}
```

### ミドルウェアパターン

```typescript
// レート制限
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', apiLimiter)

// 認証ミドルウェア
import jwt from 'jsonwebtoken'

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// エラーハンドラーミドルウェア
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err)

  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, details: err.details })
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message })
  }

  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ error: err.message })
  }

  res.status(500).json({ error: 'Internal Server Error' })
}
```

### ルーター構成

```typescript
// src/routes/index.ts
import { Router } from 'express'
import { productRouter } from './product.routes'
import { userRouter } from './user.routes'
import { orderRouter } from './order.routes'

export const router = Router()

router.use('/products', productRouter)
router.use('/users', userRouter)
router.use('/orders', orderRouter)
```

```typescript
// src/routes/product.routes.ts
import { Router } from 'express'
import { ProductController } from '../controllers/product.controller'
import { authMiddleware } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { CreateProductDto } from '../types/product.dto'

const controller = new ProductController(productService)
export const productRouter = Router()

productRouter.get('/', controller.getProducts.bind(controller))
productRouter.get('/:id', controller.getProductById.bind(controller))
productRouter.post('/', authMiddleware, validateBody(CreateProductDto), controller.createProduct.bind(controller))
productRouter.put('/:id', authMiddleware, controller.updateProduct.bind(controller))
productRouter.delete('/:id', authMiddleware, controller.deleteProduct.bind(controller))
```

---

## NestJS — エンタープライズ向けフレームワーク

### コアアーキテクチャ

NestJS はデコレーターと依存性注入を活用し、構造化されたテスタブルなコードベースを実現します。

```typescript
// src/products/products.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { Product } from './entities/product.entity'
import { CacheModule } from '../cache/cache.module'

@Module({
  imports: [TypeOrmModule.forFeature([Product]), CacheModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

```typescript
// src/products/products.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ProductsService } from './products.service'
import { CreateProductDto, UpdateProductDto } from './dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id)
  }
}
```

```typescript
// src/products/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from './entities/product.entity'
import { CacheService } from '../cache/cache.service'

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly cacheService: CacheService
  ) {}

  async findAll(query: ProductQueryDto) {
    const cacheKey = `products:${JSON.stringify(query)}`
    const cached = await this.cacheService.get<Product[]>(cacheKey)
    if (cached) return cached

    const [products, total] = await this.productRepository.findAndCount({
      where: query.category ? { category: query.category } : {},
      take: query.limit ?? 20,
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      order: { [query.sortBy ?? 'createdAt']: query.order ?? 'DESC' },
    })

    const result = { products, total, page: query.page, limit: query.limit }
    await this.cacheService.set(cacheKey, result, 300)
    return result
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({ where: { id } })
    if (!product) throw new NotFoundException(`Product ${id} not found`)
    return product
  }

  async create(dto: CreateProductDto) {
    const product = this.productRepository.create(dto)
    return this.productRepository.save(product)
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id)
    await this.productRepository.update(id, dto)
    return this.findOne(id)
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.productRepository.delete(id)
  }
}
```

### パイプ・ガード・インターセプター

```typescript
// バリデーションパイプ（グローバル設定）
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
}))

// JWT 認証ガード
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context)
  }
}

// ロギングインターセプター
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start
        console.log(`${request.method} ${request.url} - ${duration}ms`)
      })
    )
  }
}
```

---

## Express vs NestJS 比較

| 機能 | Express | NestJS |
|---------|---------|--------|
| 学習コスト | 低い | 中程度 |
| 構造 | 柔軟 | 規約ベース |
| TypeScript サポート | アドオン | 組み込み |
| 依存性注入 | 手動 | 組み込み |
| テスト | 手動セットアップ | 組み込みユーティリティ |
| Swagger/OpenAPI | 手動 | 自動生成 |
| 向いている用途 | 小〜中規模 API | 大規模エンタープライズアプリ |

### Express を選ぶ場合

- 小〜中規模プロジェクト
- 最大限の柔軟性が必要
- ボイラープレートを最小限にしたい
- チームがすでに Express に慣れている

### NestJS を選ぶ場合

- 大規模・複雑なアプリケーション
- 強固な構造とコンベンションが必要
- DI・テスト・バリデーションが組み込みで欲しい
- OpenAPI ドキュメントの自動生成が重要

---

[親ガイド](../../README.md)
