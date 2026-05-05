# Performance Optimization

> Performance is the foundation of user experience. Master optimization techniques to deliver fast web apps in production, from bundle size reduction and image optimization to code splitting, caching strategies, and Core Web Vitals improvements.

## Prerequisites

To get the most out of this guide, it is recommended that you have prior knowledge of the following.


## What You Will Learn

- [ ] Understand bundle size analysis and optimization
- [ ] Learn image, font, and CSS optimization
- [ ] Learn Core Web Vitals improvement strategies
- [ ] Master cache strategy design and implementation
- [ ] Learn rendering performance optimization techniques
- [ ] Understand network optimization and resource delivery strategies
- [ ] Understand the process of performance measurement and continuous improvement

---

## 1. Bundle Optimization

### 1.1 Bundle Size Analysis

The most important first step in improving production performance is to accurately understand the current state. Multiple tools are available for analyzing bundle size.

```bash
# Next.js のビルド時サイズ分析
npx next build
# 出力例:
# Route (app)                              Size     First Load JS
# ┌ ○ /                                    5.2 kB        89.1 kB
# ├ ○ /about                               1.1 kB        85.0 kB
# ├ ● /blog/[slug]                         3.4 kB        87.3 kB
# └ ○ /contact                             2.8 kB        86.7 kB
# + First Load JS shared by all            83.9 kB

# Bundle Analyzer の導入
npm install @next/bundle-analyzer

# Webpack Bundle Analyzer（汎用）
npm install --save-dev webpack-bundle-analyzer

# source-map-explorer による分析
npm install --save-dev source-map-explorer
npx source-map-explorer build/static/js/*.js
```

**Bundle Analyzer configuration in next.config.js:**

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // 他の設定
});

// 使い方: ANALYZE=true npx next build
```

**Analysis in a Vite project:**

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

### 1.2 Code Splitting

Code splitting is a technique that loads only the needed parts at the right time, rather than delivering the entire application as one large bundle.

#### Dynamic Import

```typescript
// React.lazy を使った基本的なコード分割
import { lazy, Suspense } from 'react';

// 重いコンポーネントを遅延読み込み
const HeavyChart = lazy(() => import('./components/HeavyChart'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const MarkdownEditor = lazy(() => import('./components/MarkdownEditor'));

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <HeavyChart data={chartData} />
    </Suspense>
  );
}

// Next.js の dynamic import（より柔軟な制御）
import dynamic from 'next/dynamic';

// 基本的な使い方
const Chart = dynamic(() => import('./Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,  // クライアントのみでレンダリング
});

// 名前付きエクスポートの場合
const MotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  { ssr: false }
);

// 条件付きの動的インポート
const AdminDashboard = dynamic(() => import('./AdminDashboard'), {
  loading: () => <p>管理画面を読み込み中...</p>,
});

function Page({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div>
      <MainContent />
      {isAdmin && <AdminDashboard />}
    </div>
  );
}
```

#### Route-Based Code Splitting

```typescript
// React Router v6 でのルートベースコード分割
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const Blog = lazy(() => import('./pages/Blog'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function AppRoutes() {
  return (
    <Suspense fallback={<GlobalLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blog/*" element={<Blog />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

#### Advanced Code Splitting Patterns

```typescript
// インタラクションベースのプリロード
const HeavyModal = dynamic(() => import('./HeavyModal'), {
  ssr: false,
});

function ProductPage() {
  const [showModal, setShowModal] = useState(false);

  // ホバー時にプリロード開始
  const handleMouseEnter = () => {
    const componentPromise = import('./HeavyModal');
    // ブラウザがアイドル時にプリロード
  };

  return (
    <button
      onMouseEnter={handleMouseEnter}
      onClick={() => setShowModal(true)}
    >
      詳細を表示
    </button>
  );
}

// Intersection Observer によるプリロード
function LazySection({ importFn, fallback }: {
  importFn: () => Promise<any>;
  fallback: React.ReactNode;
}) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          importFn().then((mod) => setComponent(() => mod.default));
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // 200px手前でプリロード開始
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [importFn]);

  return (
    <div ref={ref}>
      {Component ? <Component /> : fallback}
    </div>
  );
}
```

### 1.3 Tree Shaking

Tree shaking is an optimization technique that uses the static structure of ES Modules to eliminate unused code at build time.

```typescript
// NG: デフォルトインポート（Tree Shakingが効かない）
import _ from 'lodash';
const result = _.map(items, transform);

// OK: 名前付きインポート（Tree Shakingが効く）
import { map } from 'lodash-es';
const result = map(items, transform);

// OK: 個別パスからのインポート
import map from 'lodash/map';
const result = map(items, transform);

// NG: barrel file（index.ts）からの全インポート
// utils/index.ts に100個のエクスポートがある場合
import { formatDate } from '@/utils'; // 100個すべてがバンドルに含まれる可能性

// OK: 直接ファイルからインポート
import { formatDate } from '@/utils/date';
```

**sideEffects configuration in package.json:**

```json
{
  "name": "my-library",
  "sideEffects": false,
  "// sideEffects の解説": "false は全モジュールに副作用がないことを宣言",
  "// 部分指定も可能": "CSS ファイルなどは副作用あり",
  "sideEffects_example": ["*.css", "*.scss", "./src/polyfills.ts"]
}
```

**Debugging Tree Shaking:**

```javascript
// webpack.config.js での Tree Shaking 確認
module.exports = {
  optimization: {
    usedExports: true,      // 使用されたエクスポートをマーク
    minimize: true,          // 未使用コードを除去
    sideEffects: true,       // package.json の sideEffects を尊重
    concatenateModules: true, // モジュール連結（Scope Hoisting）
  },
};
```

### 1.4 Dependency Package Optimization

Replacing large dependency packages with lightweight alternatives can dramatically reduce bundle size.

| Heavy Library | Lightweight Alternative | Size Reduction |
|-------------|----------|----------|
| moment.js (67KB gzip) | date-fns (tree-shakeable) | Up to 95% reduction |
| moment.js (67KB gzip) | dayjs (2KB gzip) | 97% reduction |
| lodash (71KB gzip) | lodash-es (tree-shakeable) | Up to 90% reduction |
| lodash (71KB gzip) | Native JS | 100% reduction |
| axios (14KB gzip) | fetch API (built-in) | 100% reduction |
| uuid (3KB gzip) | crypto.randomUUID() | 100% reduction |
| classnames (1KB gzip) | clsx (0.5KB gzip) | 50% reduction |
| numeral.js (16KB gzip) | Intl.NumberFormat (built-in) | 100% reduction |
| chalk (for Node) | picocolors (0.1KB gzip) | 99% reduction |
| request (deprecated) | node-fetch / undici | Significant reduction |

```typescript
// moment.js → dayjs への移行例
// Before (moment.js)
import moment from 'moment';
import 'moment/locale/ja';
const formatted = moment().locale('ja').format('YYYY年MM月DD日');

// After (dayjs)
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
dayjs.locale('ja');
const formatted = dayjs().format('YYYY年MM月DD日');
const ago = dayjs('2024-01-01').fromNow(); // "2ヶ月前"

// lodash → ネイティブJS への移行例
// Before
import { debounce, throttle, groupBy, uniqBy } from 'lodash';

// After: ネイティブ実装
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// groupBy のネイティブ実装（Object.groupBy が使える環境）
const grouped = Object.groupBy(users, (user) => user.role);

// uniqBy のネイティブ実装
function uniqBy<T>(arr: T[], key: keyof T): T[] {
  const seen = new Set();
  return arr.filter((item) => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

// axios → fetch への移行例
// Before
import axios from 'axios';
const { data } = await axios.get('/api/users');
await axios.post('/api/users', { name: 'Taro' });

// After
const data = await fetch('/api/users').then((r) => r.json());
await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Taro' }),
});
```

### 1.5 Bundle Size Targets

```
推奨バンドルサイズ目標:
  ┌─────────────────────────────────┬─────────────────┬───────────────┐
  │ 指標                             │ 推奨値           │ 警告値         │
  ├─────────────────────────────────┼─────────────────┼───────────────┤
  │ 初期JS（gzip）                   │ < 150KB         │ > 250KB       │
  │ 各ルートのJS（gzip）             │ < 80KB          │ > 150KB       │
  │ First Load JS                   │ < 250KB         │ > 400KB       │
  │ 合計CSS（gzip）                  │ < 50KB          │ > 100KB       │
  │ 最大画像サイズ                    │ < 200KB         │ > 500KB       │
  │ Total Page Weight               │ < 1MB           │ > 2MB         │
  └─────────────────────────────────┴─────────────────┴───────────────┘

ネットワーク別の体感速度:
  ┌──────────────┬──────────┬──────────────────────────────┐
  │ 接続速度      │ 帯域幅    │ 1MBの読み込み時間             │
  ├──────────────┼──────────┼──────────────────────────────┤
  │ 3G           │ 1.5Mbps  │ 約5.3秒                      │
  │ 4G           │ 10Mbps   │ 約0.8秒                      │
  │ 5G           │ 100Mbps  │ 約0.08秒                     │
  │ Wi-Fi        │ 50Mbps   │ 約0.16秒                     │
  └──────────────┴──────────┴──────────────────────────────┘
```

---

## 2. Image Optimization

### 2.1 Modern Image Formats

Images often account for the largest share of a web page's total data size, making proper format selection critical.

| Format | Compression | Transparency | Animation | Browser Support | Use Case |
|-----------|---------|-----|-------------|-----------|-----------|
| JPEG | Lossy | No | No | All browsers | Photos, natural images |
| PNG | Lossless | Yes | No | All browsers | Logos, screenshots |
| GIF | Lossless | Yes | Yes | All browsers | Simple animations |
| WebP | Lossy/Lossless | Yes | Yes | 97%+ | General purpose (JPEG/PNG replacement) |
| AVIF | Lossy | Yes | Yes | 92%+ | Next-gen format |
| SVG | Vector | Yes | Yes | All browsers | Icons, illustrations |

**Compression efficiency comparison by format (typical file size at equivalent quality):**

```
元画像: 1MB JPEG
  → WebP:  約 25-35% 削減 → 650-750KB
  → AVIF:  約 40-60% 削減 → 400-600KB

元画像: 500KB PNG（透過あり）
  → WebP:  約 30-40% 削減 → 300-350KB
  → AVIF:  約 50-70% 削減 → 150-250KB
```

### 2.2 Next.js Image Component

```typescript
import Image from 'next/image';

// ① 静的画像（ビルド時に最適化）
import heroImage from '@/public/images/hero.jpg';

function HeroSection() {
  return (
    <Image
      src={heroImage}
      alt="メインビジュアル"
      priority               // LCP画像には必ず設定
      placeholder="blur"     // ビルド時にblurDataURLが自動生成
      quality={85}            // 品質（デフォルト: 75）
      sizes="100vw"
    />
  );
}

// ② 動的画像（外部URL）
function UserAvatar({ user }: { user: User }) {
  return (
    <Image
      src={user.avatarUrl}
      alt={`${user.name}のアバター`}
      width={64}
      height={64}
      sizes="64px"
      className="rounded-full"
      // 外部画像のblurプレースホルダー
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}

// ③ レスポンシブ画像（fillモード）
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="relative aspect-[4/3] w-full">
      <Image
        src={product.imageUrl}
        alt={product.name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover rounded-lg"
      />
    </div>
  );
}

// ④ アート・ディレクション（picture要素的な使い方）
function ResponsiveHero() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <Image
      src={isMobile ? '/hero-mobile.jpg' : '/hero-desktop.jpg'}
      alt="ヒーローイメージ"
      width={isMobile ? 768 : 1920}
      height={isMobile ? 1024 : 1080}
      priority
      sizes="100vw"
    />
  );
}
```

**Image configuration in next.config.js:**

```javascript
// next.config.js
module.exports = {
  images: {
    // 外部画像のドメイン許可
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
    ],
    // 出力フォーマット
    formats: ['image/avif', 'image/webp'],
    // 生成するサイズ一覧
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 画像キャッシュのTTL（秒）
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30日
  },
};
```

### 2.3 Image Lazy Loading and Preloading

```typescript
// ネイティブ lazy loading
<img
  src="/large-image.jpg"
  alt="大きな画像"
  loading="lazy"           // ビューポート外では読み込まない
  decoding="async"         // デコードを非同期で行う
  width="800"
  height="600"
/>

// LCP画像のプリロード（head内に記述）
<link
  rel="preload"
  as="image"
  href="/hero.webp"
  type="image/webp"
  fetchPriority="high"
/>

// fetchpriority による優先度制御
<img
  src="/hero.jpg"
  alt="ヒーロー画像"
  fetchpriority="high"    // LCP画像は高優先度
  width="1920"
  height="1080"
/>

<img
  src="/below-fold.jpg"
  alt="フォールド下の画像"
  fetchpriority="low"     // フォールド下の画像は低優先度
  loading="lazy"
  width="400"
  height="300"
/>
```

### 2.4 Automated Image Optimization Pipeline

```typescript
// sharp を使ったビルド時画像最適化スクリプト
// scripts/optimize-images.ts
import sharp from 'sharp';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';

interface OptimizeOptions {
  inputDir: string;
  outputDir: string;
  quality: number;
  formats: ('webp' | 'avif')[];
  maxWidth: number;
}

async function optimizeImages(options: OptimizeOptions) {
  const { inputDir, outputDir, quality, formats, maxWidth } = options;

  const images = await glob(`${inputDir}/**/*.{jpg,jpeg,png}`, {});
  console.log(`${images.length} 件の画像を最適化します...`);

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  for (const imagePath of images) {
    const relativePath = path.relative(inputDir, imagePath);
    const baseName = path.basename(relativePath, path.extname(relativePath));
    const dirName = path.dirname(relativePath);
    const outDir = path.join(outputDir, dirName);

    await fs.mkdir(outDir, { recursive: true });

    const originalBuffer = await fs.readFile(imagePath);
    totalOriginalSize += originalBuffer.length;

    const image = sharp(originalBuffer);
    const metadata = await image.metadata();

    // リサイズ（最大幅を超える場合）
    const resizedImage = (metadata.width ?? 0) > maxWidth
      ? image.resize({ width: maxWidth, withoutEnlargement: true })
      : image;

    // 各フォーマットに変換
    for (const format of formats) {
      const outputPath = path.join(outDir, `${baseName}.${format}`);

      if (format === 'webp') {
        const buffer = await resizedImage
          .webp({ quality, effort: 6 })
          .toBuffer();
        await fs.writeFile(outputPath, buffer);
        totalOptimizedSize += buffer.length;
      } else if (format === 'avif') {
        const buffer = await resizedImage
          .avif({ quality, effort: 6 })
          .toBuffer();
        await fs.writeFile(outputPath, buffer);
        totalOptimizedSize += buffer.length;
      }
    }
  }

  const savings = ((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1);
  console.log(`完了: ${savings}% 削減 (${formatBytes(totalOriginalSize)} → ${formatBytes(totalOptimizedSize)})`);
}

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// 実行
optimizeImages({
  inputDir: './public/images',
  outputDir: './public/optimized',
  quality: 80,
  formats: ['webp', 'avif'],
  maxWidth: 1920,
});
```

### 2.5 SVG Optimization

```typescript
// SVGO によるSVG最適化
// svgo.config.js
module.exports = {
  plugins: [
    'preset-default',
    'removeDimensions',
    {
      name: 'removeAttrs',
      params: { attrs: '(data-.*)' },
    },
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [{ 'aria-hidden': 'true' }],
      },
    },
  ],
};

// React コンポーネントとしてのSVG（@svgr/webpack）
// webpack / next.config.js
module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};

// 使い方
import SearchIcon from '@/icons/search.svg';

function SearchButton() {
  return (
    <button aria-label="検索">
      <SearchIcon className="w-5 h-5 text-gray-600" />
    </button>
  );
}
```

---

## 3. Font Optimization

### 3.1 Next.js Font Optimization

Next.js's `next/font` downloads font files at build time and self-hosts them, eliminating external requests.

```typescript
// app/layout.tsx
import { Inter, Noto_Sans_JP } from 'next/font/google';

// 欧文フォント
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',         // FOUT を許容（CLS を防止）
  variable: '--font-inter',
  // 使用するウェイトを限定してサイズ削減
  // weight: ['400', '500', '600', '700'],
  // subsets で必要な文字セットのみ
});

// 日本語フォント
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],  // 必要なウェイトのみ
  display: 'swap',
  variable: '--font-noto',
  preload: false,           // 日本語フォントは大きいのでpreloadしない
  adjustFontFallback: true, // フォールバックフォントのサイズ調整
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${notoSansJP.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

### 3.2 Using Local Fonts

```typescript
// next/font/local の使用
import localFont from 'next/font/local';

const customFont = localFont({
  src: [
    {
      path: '../fonts/CustomFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CustomFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-custom',
  // フォントのサブセット化（日本語の場合特に有効）
  // unicode-range で必要な文字のみ
});
```

### 3.3 Comparing font-display Strategies

```
font-display の各値と挙動:

  ┌──────────┬──────────────────────────┬──────────────┬──────────────┐
  │ 値        │ 動作                      │ CLS影響      │ ユースケース  │
  ├──────────┼──────────────────────────┼──────────────┼──────────────┤
  │ swap     │ フォールバックを即表示、    │ 中（FOUT）   │ 本文テキスト  │
  │          │ ロード後に切り替え          │              │              │
  ├──────────┼──────────────────────────┼──────────────┼──────────────┤
  │ block    │ 3秒間非表示、              │ 高（FOIT）   │ アイコン     │
  │          │ その後フォールバック        │              │ フォント     │
  ├──────────┼──────────────────────────┼──────────────┼──────────────┤
  │ fallback │ 100msの非表示期間後に      │ 低           │ バランス型   │
  │          │ フォールバック、3秒以内     │              │              │
  │          │ にロードできれば切り替え    │              │              │
  ├──────────┼──────────────────────────┼──────────────┼──────────────┤
  │ optional │ 100msの非表示期間後に      │ なし         │ 重要でない   │
  │          │ フォールバック、次回訪問    │              │ テキスト     │
  │          │ から使用                   │              │              │
  └──────────┴──────────────────────────┴──────────────┴──────────────┘

推奨: Core Web Vitals を重視する場合は swap または optional
```

### 3.4 Font Subsetting

```bash
# pyftsubset を使った日本語フォントのサブセット化
pip install fonttools brotli

# 第一水準漢字 + ひらがな + カタカナ + 記号のみに削減
pyftsubset NotoSansJP-Regular.ttf \
  --text-file=characters.txt \
  --output-file=NotoSansJP-Regular-subset.woff2 \
  --flavor=woff2 \
  --layout-features='*'

# unicode-range による段階的読み込み
# @font-face で文字範囲ごとに分割
```

```css
/* CSS での unicode-range によるフォント分割 */
/* ラテン文字 */
@font-face {
  font-family: 'NotoSansJP';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/NotoSansJP-Regular-latin.woff2') format('woff2');
  unicode-range: U+0000-007F, U+2000-206F;
}

/* ひらがな・カタカナ */
@font-face {
  font-family: 'NotoSansJP';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/NotoSansJP-Regular-kana.woff2') format('woff2');
  unicode-range: U+3000-30FF, U+FF00-FFEF;
}

/* 漢字（第一水準） */
@font-face {
  font-family: 'NotoSansJP';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/NotoSansJP-Regular-kanji.woff2') format('woff2');
  unicode-range: U+4E00-9FFF;
}
```

### 3.5 Font Configuration in Tailwind CSS

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'var(--font-noto)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          'var(--font-jetbrains-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
    },
  },
};

export default config;
```

---

## 4. CSS Optimization

### 4.1 Removing Unused CSS

```javascript
// Tailwind CSS の purge（content 設定）
// tailwind.config.ts
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    // サードパーティコンポーネントも含める
    './node_modules/@company/ui/**/*.{js,ts,jsx,tsx}',
  ],
  // safelist: 動的に生成されるクラスを保護
  safelist: [
    'bg-red-500',
    'bg-green-500',
    'bg-blue-500',
    { pattern: /^bg-(red|green|blue)-(100|500|900)$/ },
  ],
};

// PurgeCSS の単体使用（Tailwind以外のプロジェクト）
// postcss.config.js
const purgecss = require('@fullhuman/postcss-purgecss');

module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
    ...(process.env.NODE_ENV === 'production'
      ? [purgecss({
          content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
          defaultExtractor: (content) =>
            content.match(/[\w-/:]+(?<!:)/g) || [],
          safelist: {
            standard: [/^data-/, /^aria-/],
            deep: [/modal/, /tooltip/],
          },
        })]
      : []),
  ],
};
```

### 4.2 Inlining Critical CSS

```typescript
// critters による Critical CSS の自動抽出（Next.jsは内蔵）
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true, // Critical CSSの自動インライン化
  },
};

// 手動での Critical CSS 戦略
// <head>内にAbove-the-fold CSSをインライン化
// 残りのCSSは非同期読み込み
```

```html
<!-- Critical CSS のインライン化パターン -->
<head>
  <!-- クリティカルCSSをインライン -->
  <style>
    /* ファーストビューに必要な最小限のCSS */
    :root { --primary: #3b82f6; }
    body { margin: 0; font-family: system-ui, sans-serif; }
    .hero { min-height: 100vh; display: flex; align-items: center; }
    .nav { position: fixed; top: 0; width: 100%; z-index: 50; }
  </style>

  <!-- 残りのCSSは非同期で読み込み -->
  <link
    rel="preload"
    href="/styles/main.css"
    as="style"
    onload="this.onload=null;this.rel='stylesheet'"
  />
  <noscript>
    <link rel="stylesheet" href="/styles/main.css" />
  </noscript>
</head>
```

### 4.3 CSS-in-JS Performance Considerations

```typescript
// ランタイムCSS-in-JS のパフォーマンス問題
// styled-components, emotion はランタイムにCSSを生成する

// 推奨: ゼロランタイムCSS-in-JS への移行
// - Tailwind CSS（ユーティリティファースト）
// - CSS Modules（ビルド時にスコープ化）
// - vanilla-extract（ゼロランタイム、TypeScript対応）
// - Panda CSS（ゼロランタイム、Tailwind風API）

// vanilla-extract の例
// styles.css.ts
import { style, globalStyle } from '@vanilla-extract/css';

export const container = style({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 1rem',
  '@media': {
    '(min-width: 768px)': {
      padding: '0 2rem',
    },
  },
});

export const heading = style({
  fontSize: '2rem',
  fontWeight: 700,
  color: '#1a1a1a',
});
```

---

## 5. Caching Strategies

### 5.1 Next.js Cache Layers

The Next.js App Router has four cache layers, and understanding the characteristics of each is important.

```
Next.js キャッシュ階層の全体像:

  リクエスト
    │
    ▼
  ① Router Cache（クライアント側）
    │  ・ブラウザのメモリに保持
    │  ・prefetch されたルートをキャッシュ
    │  ・セッション間では持続しない
    │
    ▼
  ② Full Route Cache（サーバー側）
    │  ・静的にレンダリングされたルートのHTML + RSC Payload
    │  ・ビルド時または revalidate 後に生成
    │  ・CDN でキャッシュ可能
    │
    ▼
  ③ Data Cache（サーバー側）
    │  ・fetch() の結果をキャッシュ
    │  ・デプロイ間で持続する
    │  ・revalidate で有効期限を設定
    │
    ▼
  ④ Request Memoization（サーバー側）
     ・同一レンダリングパス内の重複 fetch を自動排除
     ・React の機能（fetch の自動メモ化）
     ・リクエスト完了後に破棄
```

### 5.2 Controlling Data Cache

```typescript
// ① キャッシュなし（毎回フェッチ）
async function getLatestData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store',
  });
  return res.json();
}

// ② 時間ベースの再検証（ISR的）
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { revalidate: 60 }, // 60秒間キャッシュ
  });
  return res.json();
}

// ③ タグベースの再検証
async function getBlogPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] }, // 'posts'タグでグループ化
  });
  return res.json();
}

// ④ ページレベルのキャッシュ制御
// app/products/page.tsx
export const revalidate = 60;           // 60秒間キャッシュ
export const dynamic = 'force-dynamic'; // SSR強制（キャッシュなし）
export const dynamic = 'force-static';  // 静的生成を強制
export const fetchCache = 'default-no-store'; // デフォルトキャッシュなし

// ⑤ オンデマンドでのキャッシュ無効化
import { revalidatePath, revalidateTag } from 'next/cache';

// Server Action / Route Handler 内で使用
export async function createPost(formData: FormData) {
  'use server';

  await db.post.create({ ... });

  // パスベースの無効化
  revalidatePath('/blog');          // /blog ページを再生成
  revalidatePath('/blog', 'layout'); // /blog 配下すべて

  // タグベースの無効化
  revalidateTag('posts');           // 'posts'タグのキャッシュを無効化
}
```

### 5.3 HTTP Cache Headers

```typescript
// Next.js Route Handler でのキャッシュヘッダー設定
// app/api/data/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const data = await fetchData();

  return NextResponse.json(data, {
    headers: {
      // 公開キャッシュ: CDN + ブラウザで60秒キャッシュ
      // stale-while-revalidate: 期限切れ後も古いデータを返しつつ裏で更新
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

// 静的アセットのキャッシュ戦略
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        // 静的アセット（ハッシュ付きファイル名）
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 画像
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // APIレスポンス
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
};
```

### 5.4 Cache-Control Directive Reference

```
Cache-Control ディレクティブの詳細:

  ┌──────────────────────────┬────────────────────────────────────────┐
  │ ディレクティブ            │ 説明                                    │
  ├──────────────────────────┼────────────────────────────────────────┤
  │ public                   │ CDN・共有キャッシュに保存可能             │
  │ private                  │ ブラウザのみ（CDNに保存しない）           │
  │ no-cache                 │ 毎回サーバーに検証（304応答可）           │
  │ no-store                 │ 一切キャッシュしない                      │
  │ max-age=N                │ N秒間キャッシュ有効                      │
  │ s-maxage=N               │ 共有キャッシュ（CDN）でのmax-age         │
  │ stale-while-revalidate=N │ 期限切れ後もN秒間は古いデータを返す       │
  │ stale-if-error=N         │ エラー時にN秒間は古いデータを返す         │
  │ immutable                │ コンテンツが変更されないことを宣言         │
  │ must-revalidate          │ 期限切れ後は必ずサーバーに問い合わせ       │
  └──────────────────────────┴────────────────────────────────────────┘

よくある設定パターン:
  静的アセット（JS/CSS/画像、ハッシュ付き）:
    Cache-Control: public, max-age=31536000, immutable

  HTML（頻繁に更新）:
    Cache-Control: no-cache

  API（短期キャッシュ）:
    Cache-Control: public, s-maxage=60, stale-while-revalidate=300

  個人データ:
    Cache-Control: private, no-cache

  認証済みページ:
    Cache-Control: private, no-store
```

### 5.5 Caching with Service Workers

```typescript
// next-pwa を使った Service Worker キャッシュ
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      // 画像のキャッシュ
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30日
        },
      },
    },
    {
      // API レスポンスのキャッシュ
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5分
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      // フォントのキャッシュ
      urlPattern: /\.(?:woff|woff2|ttf|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1年
        },
      },
    },
  ],
});

module.exports = withPWA({
  // Next.js config
});
```

---

## 6. Core Web Vitals Improvement

### 6.1 Core Web Vitals Overview

Core Web Vitals are user experience quality metrics defined by Google and have been a ranking factor since 2021. Continuously measuring and improving the three key metrics (LCP, INP, CLS) is essential for both SEO and UX.

```
Core Web Vitals の指標と閾値:

  ┌────────┬──────────────────────────────┬──────────┬──────────┬───────────┐
  │ 指標    │ 計測内容                      │ Good     │ Needs    │ Poor      │
  │        │                              │          │ Improve  │           │
  ├────────┼──────────────────────────────┼──────────┼──────────┼───────────┤
  │ LCP    │ 最大コンテンツの描画時間       │ ≤ 2.5s  │ ≤ 4.0s  │ > 4.0s   │
  ├────────┼──────────────────────────────┼──────────┼──────────┼───────────┤
  │ INP    │ インタラクションの応答性       │ ≤ 200ms │ ≤ 500ms │ > 500ms  │
  ├────────┼──────────────────────────────┼──────────┼──────────┼───────────┤
  │ CLS    │ レイアウトの安定性            │ ≤ 0.1   │ ≤ 0.25  │ > 0.25   │
  └────────┴──────────────────────────────┴──────────┴──────────┴───────────┘

その他の重要指標:
  ┌────────┬──────────────────────────────┬──────────┐
  │ 指標    │ 計測内容                      │ 推奨値    │
  ├────────┼──────────────────────────────┼──────────┤
  │ FCP    │ 最初のコンテンツ描画           │ ≤ 1.8s  │
  │ TTFB   │ サーバー応答時間               │ ≤ 0.8s  │
  │ FID    │ 初回入力遅延（INPに置換済み）   │ ≤ 100ms │
  │ TBT    │ メインスレッドのブロック時間     │ ≤ 200ms │
  │ TTI    │ インタラクティブになるまでの時間  │ ≤ 3.8s  │
  │ SI     │ コンテンツ表示速度             │ ≤ 3.4s  │
  └────────┴──────────────────────────────┴──────────┘
```

### 6.2 LCP (Largest Contentful Paint) Optimization

LCP is the time until the largest content element in the viewport is rendered. Typically, a hero image or a large text block becomes the LCP element.

```typescript
// LCP 要素の特定と最適化

// ① LCP画像の最適化
import Image from 'next/image';

function HeroSection() {
  return (
    <section>
      {/* LCP画像には必ず priority を設定 */}
      <Image
        src="/hero.jpg"
        alt="ヒーロー画像"
        width={1920}
        height={1080}
        priority           // preload を生成
        quality={85}
        sizes="100vw"
        placeholder="blur"
      />
      {/* LCPテキストが最大要素の場合 */}
      <h1 className="text-5xl font-bold">
        最高のパフォーマンスを実現する
      </h1>
    </section>
  );
}

// ② TTFB の改善（サーバー応答時間の短縮）
// next.config.js
module.exports = {
  // 静的生成を活用して TTFB を最小化
  // generateStaticParams でSSGを活用
  output: 'standalone', // Docker向け最適化
};

// ③ レンダリングブロックリソースの削減
// Resource hintsによる最適化
function Head() {
  return (
    <>
      {/* 重要なリソースを事前接続 */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://cdn.example.com" crossOrigin="anonymous" />

      {/* DNSプリフェッチ */}
      <link rel="dns-prefetch" href="https://api.example.com" />

      {/* LCP画像のプリロード */}
      <link
        rel="preload"
        as="image"
        href="/hero.webp"
        type="image/webp"
        fetchPriority="high"
      />
    </>
  );
}

// ④ Server Component を活用したストリーミングSSR
// app/page.tsx
import { Suspense } from 'react';

export default async function Page() {
  return (
    <main>
      {/* LCP要素は即座にレンダリング */}
      <HeroSection />

      {/* 重くないが重要度の低いセクションはSuspenseで囲む */}
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductList />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />
      </Suspense>
    </main>
  );
}
```

**LCP improvement checklist:**

```
LCP 最適化チェックリスト:

  サーバー応答:
    □ TTFB < 800ms を確認
    □ CDN を利用してエッジ配信
    □ SSG / ISR を活用して静的化
    □ データベースクエリの最適化

  リソース配信:
    □ LCP画像に priority（preload）を設定
    □ 不要な render-blocking CSS/JS を排除
    □ Critical CSS をインライン化
    □ フォントの preload

  レンダリング:
    □ Server Component でサーバー側レンダリング
    □ Streaming SSR でプログレッシブ表示
    □ クライアントサイドレンダリングの最小化

  画像:
    □ 適切なフォーマット（WebP / AVIF）
    □ 適切なサイズ（sizes属性の設定）
    □ fetchpriority="high" の設定
```

### 6.3 INP (Interaction to Next Paint) Optimization

INP measures the time from a user interaction (click, tap, keyboard input) to the next visual update being rendered. It is the successor to FID and evaluates the overall responsiveness of the page.

```typescript
// ① useTransition による非緊急更新の遅延
import { useTransition, useState } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    // 入力フィールドは即座に更新（緊急更新）
    setQuery(value);

    // 検索結果は非緊急更新としてマーク
    startTransition(() => {
      const filtered = filterItems(allItems, value);
      setResults(filtered);
    });
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="検索..."
      />
      {isPending && <Spinner />}
      <ResultsList items={results} />
    </div>
  );
}

// ② useDeferredValue による値の遅延
import { useDeferredValue, useMemo } from 'react';

function ProductFilter({ products, filter }: {
  products: Product[];
  filter: string;
}) {
  // filter の更新は即座に反映
  // deferredFilter は低優先度で更新
  const deferredFilter = useDeferredValue(filter);
  const isStale = filter !== deferredFilter;

  const filteredProducts = useMemo(
    () => products.filter((p) =>
      p.name.toLowerCase().includes(deferredFilter.toLowerCase())
    ),
    [products, deferredFilter]
  );

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      {filteredProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// ③ Web Worker でメインスレッドをオフロード
// workers/heavy-computation.ts
self.addEventListener('message', (event) => {
  const { data, type } = event.data;

  if (type === 'SORT_LARGE_DATASET') {
    const sorted = data.sort((a: any, b: any) =>
      a.name.localeCompare(b.name, 'ja')
    );
    self.postMessage({ type: 'SORT_COMPLETE', data: sorted });
  }

  if (type === 'PARSE_CSV') {
    const rows = data.split('\n').map((row: string) => row.split(','));
    self.postMessage({ type: 'PARSE_COMPLETE', data: rows });
  }
});

// コンポーネントでの使用
function DataTable({ rawData }: { rawData: string }) {
  const [sortedData, setSortedData] = useState<any[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/heavy-computation.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'SORT_COMPLETE') {
        setSortedData(event.data.data);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const handleSort = () => {
    workerRef.current?.postMessage({
      type: 'SORT_LARGE_DATASET',
      data: rawData,
    });
  };

  return (
    <button onClick={handleSort}>ソート実行</button>
  );
}

// ④ 仮想スクロール（大量リスト）
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // 各行の推定高さ
    overscan: 5,            // 画面外に事前レンダリングする行数
  });

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
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
            <ItemRow item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ⑤ メモ化によるリレンダリング最適化
import { memo, useMemo, useCallback } from 'react';

// コンポーネントのメモ化
const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
  onAction,
}: {
  data: ComplexData;
  onAction: (id: string) => void;
}) {
  return (
    <div>
      {/* 重い描画処理 */}
      {data.items.map((item) => (
        <ComplexItem
          key={item.id}
          item={item}
          onClick={() => onAction(item.id)}
        />
      ))}
    </div>
  );
});

function ParentComponent() {
  const [count, setCount] = useState(0);
  const [data] = useState<ComplexData>(initialData);

  // コールバックのメモ化
  const handleAction = useCallback((id: string) => {
    console.log('Action:', id);
  }, []);

  // 計算結果のメモ化
  const processedData = useMemo(
    () => expensiveTransform(data),
    [data]
  );

  return (
    <div>
      {/* count の変更では ExpensiveComponent は再レンダリングされない */}
      <button onClick={() => setCount((c) => c + 1)}>
        Count: {count}
      </button>
      <ExpensiveComponent data={processedData} onAction={handleAction} />
    </div>
  );
}
```

### 6.4 CLS (Cumulative Layout Shift) Optimization

CLS is a metric that measures the visual stability of a page. It detects unintended layout shifts (late-loading ads, images without specified dimensions, etc.).

```typescript
// ① 画像のサイズ指定
// NG: サイズ未指定（CLSの原因）
<img src="/photo.jpg" alt="写真" />

// OK: サイズ明示
<img src="/photo.jpg" alt="写真" width={800} height={600} />

// OK: aspect-ratio で比率指定
<div className="relative w-full" style={{ aspectRatio: '16/9' }}>
  <Image src="/photo.jpg" alt="写真" fill className="object-cover" />
</div>

// ② 動的コンテンツの事前スペース確保
function AdBanner() {
  const [adLoaded, setAdLoaded] = useState(false);

  return (
    // 広告が読み込まれる前からスペースを確保
    <div
      className="w-full bg-gray-100"
      style={{ minHeight: '250px' }} // 広告の想定サイズ
    >
      {adLoaded ? <Ad /> : <AdPlaceholder />}
    </div>
  );
}

// ③ フォントによるCLSの防止
// font-display: swap + size-adjust
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true, // Next.js がフォールバックのサイズを自動調整
});

// ④ 動的に挿入される要素のCLS防止
function NotificationBar({ message }: { message: string | null }) {
  return (
    // message がある場合もない場合も同じスペースを占める
    <div
      className={`
        h-12 transition-all duration-300
        ${message ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      {message && <p>{message}</p>}
    </div>
  );
}

// ⑤ CSS containment による影響範囲の制限
// .card {
//   contain: layout style paint;
//   content-visibility: auto;
//   contain-intrinsic-size: 0 500px;
// }
```

```css
/* content-visibility によるレンダリング最適化 */
.long-article-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* 推定サイズ */
}

/* アニメーションによるCLSを防止 */
/* NG: top/left/width/height のアニメーション */
.animate-bad {
  transition: top 0.3s, left 0.3s;
}

/* OK: transform のアニメーション（レイアウトに影響しない） */
.animate-good {
  transition: transform 0.3s, opacity 0.3s;
  will-change: transform;
}
```

**CLS improvement checklist:**

```
CLS 最適化チェックリスト:

  画像・動画:
    □ すべての画像に width/height または aspect-ratio を指定
    □ fill プロパティ使用時は親要素にサイズ指定
    □ placeholder="blur" でブランクスペース防止

  フォント:
    □ font-display: swap を設定
    □ adjustFontFallback を有効化
    □ フォントのプリロード設定

  動的コンテンツ:
    □ 広告スペースの事前確保（min-height）
    □ スケルトンスクリーンの使用
    □ 挿入される要素の固定サイズ指定

  アニメーション:
    □ transform/opacity のみでアニメーション
    □ レイアウトプロパティのアニメーション禁止
    □ will-change の適切な使用
```

---

## 7. Network Optimization

### 7.1 Resource Hints

Pre-instructing the browser to fetch resources speeds up subsequent page navigations and resource loading.

```html
<!-- ① preconnect: DNS解決 + TCP接続 + TLSハンドシェイクを事前実行 -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://cdn.example.com" crossorigin />

<!-- ② dns-prefetch: DNS解決のみ事前実行（preconnectより軽量） -->
<link rel="dns-prefetch" href="https://analytics.example.com" />
<link rel="dns-prefetch" href="https://api.third-party.com" />

<!-- ③ preload: 現在のページで確実に必要なリソースを早期読み込み -->
<link rel="preload" href="/fonts/Inter.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/hero.webp" as="image" type="image/webp" />
<link rel="preload" href="/critical.css" as="style" />

<!-- ④ prefetch: 次のページで必要になるリソースをアイドル時に取得 -->
<link rel="prefetch" href="/next-page.js" />
<link rel="prefetch" href="/api/data.json" />

<!-- ⑤ prerender: 次のページをバックグラウンドで完全にレンダリング -->
<!-- Speculation Rules API（Chrome 121+） -->
<script type="speculationrules">
{
  "prerender": [
    {
      "urls": ["/about", "/products"],
      "eagerness": "moderate"
    }
  ],
  "prefetch": [
    {
      "urls": ["/blog/*"],
      "eagerness": "conservative"
    }
  ]
}
</script>
```

```typescript
// Next.js でのリソースヒント設定
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://api.example.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}

// prefetch の制御（Next.js Link）
import Link from 'next/link';

function Navigation() {
  return (
    <nav>
      {/* デフォルトで prefetch される */}
      <Link href="/about">About</Link>

      {/* prefetch を無効化 */}
      <Link href="/admin" prefetch={false}>Admin</Link>
    </nav>
  );
}
```

### 7.2 Compression

```
圧縮アルゴリズムの比較:

  ┌──────────┬──────────┬──────────┬──────────────┬────────────┐
  │ 方式      │ 圧縮率    │ 速度     │ ブラウザ対応   │ 推奨用途    │
  ├──────────┼──────────┼──────────┼──────────────┼────────────┤
  │ gzip     │ 良い     │ 高速     │ 99%+         │ 汎用       │
  │ Brotli   │ 非常に良い│ 中速     │ 97%+         │ 静的アセット │
  │ zstd     │ 最も良い  │ 高速     │ 限定的       │ 将来的な選択│
  └──────────┴──────────┴──────────┴──────────────┴────────────┘

  一般的な圧縮効果（JavaScript）:
    元サイズ: 1MB
    gzip:   ~300KB（70%削減）
    Brotli: ~250KB（75%削減）
```

```javascript
// Vercel / Next.js では Brotli が自動的に適用される

// カスタムサーバーでの Brotli 設定（Express）
const express = require('express');
const compression = require('compression');
const shrinkRay = require('shrink-ray-current');

const app = express();

// shrink-ray は Brotli + gzip をサポート
app.use(shrinkRay({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return shrinkRay.filter(req, res);
  },
  brotli: { quality: 4 }, // 動的コンテンツは低品質（速度重視）
}));

// 静的ファイルの事前圧縮
// ビルド時に .br / .gz ファイルを生成
// nginx が自動的に圧縮済みファイルを配信
```

```nginx
# nginx での Brotli + gzip 設定
server {
    # gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json
               application/javascript text/xml application/xml
               application/xml+rss text/javascript image/svg+xml;

    # Brotli（ngx_brotli モジュール）
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/json
                 application/javascript text/xml application/xml
                 application/xml+rss text/javascript image/svg+xml;

    # 事前圧縮ファイルの配信
    brotli_static on;
    gzip_static on;
}
```

### 7.3 Leveraging HTTP/2 and HTTP/3

```
HTTP/1.1 vs HTTP/2 vs HTTP/3:

  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ 特徴          │ HTTP/1.1     │ HTTP/2       │ HTTP/3       │
  ├──────────────┼──────────────┼──────────────┼──────────────┤
  │ 多重化        │ ×（1接続1要求）│ ○（ストリーム）│ ○（UDPベース）│
  │ ヘッダー圧縮  │ ×            │ ○（HPACK）   │ ○（QPACK）   │
  │ Server Push  │ ×            │ ○            │ △（非推奨）   │
  │ HOLブロック   │ あり         │ TCPレベルあり  │ なし         │
  │ 接続確立      │ 1-3 RTT     │ 1-3 RTT     │ 0-1 RTT     │
  │ プロトコル    │ TCP         │ TCP          │ QUIC/UDP    │
  └──────────────┴──────────────┴──────────────┴──────────────┘

HTTP/2 最適化のポイント:
  ✓ ドメインシャーディングは不要（多重化により1接続で十分）
  ✓ スプライトシートは不要（個別ファイルでOK）
  ✓ CSSファイルの結合は不要（ただしHTTP/1.1フォールバック注意）
  ✓ Server Push は慎重に使用（キャッシュとの競合に注意）
```

### 7.4 Leveraging CDN

```typescript
// Vercel Edge Config によるCDN最適化
// next.config.js
module.exports = {
  // 画像の外部最適化
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
};

// lib/image-loader.ts
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const params = [
    `f_auto`,       // 自動フォーマット選択
    `c_limit`,      // アスペクト比維持
    `w_${width}`,   // 幅指定
    `q_${quality || 'auto'}`, // 品質
  ];
  return `https://res.cloudinary.com/demo/image/upload/${params.join(',')}/${src}`;
}

// Edge Middleware でのジオロケーションベース最適化
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'JP';
  const response = NextResponse.next();

  // 地域に応じたCDNオリジンを選択
  response.headers.set('x-user-country', country);

  // 地域別コンテンツの出し分け
  if (country === 'JP') {
    response.headers.set('x-cdn-origin', 'tokyo');
  } else if (country === 'US') {
    response.headers.set('x-cdn-origin', 'us-east');
  }

  return response;
}
```

---

## 8. Rendering Performance

### 8.1 React Rendering Optimization

To improve React rendering performance, it is important to prevent unnecessary re-renders, reduce computation costs, and manage state appropriately.

```typescript
// ① React.memo による再レンダリングスキップ
const UserCard = memo(function UserCard({
  user,
  onSelect,
}: {
  user: User;
  onSelect: (id: string) => void;
}) {
  return (
    <div onClick={() => onSelect(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数（省略可）
  return prevProps.user.id === nextProps.user.id
    && prevProps.user.name === nextProps.user.name;
});

// ② 状態のリフトダウン（コンポーネント分割）
// NG: 親全体が再レンダリングされる
function Page() {
  const [count, setCount] = useState(0); // この状態変更で全体が再レンダリング
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <span>{count}</span>
      <ExpensiveList /> {/* 不要な再レンダリング */}
    </div>
  );
}

// OK: カウンター部分を分離
function Page() {
  return (
    <div>
      <Counter />         {/* 状態はここに閉じ込め */}
      <ExpensiveList />   {/* 再レンダリングされない */}
    </div>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <span>{count}</span>
    </>
  );
}

// ③ children パターンによる最適化
// NG:
function Layout() {
  const [theme, setTheme] = useState('light');
  return (
    <div className={theme}>
      <Header />      {/* theme 変更で再レンダリング */}
      <MainContent /> {/* theme 変更で再レンダリング */}
      <Footer />      {/* theme 変更で再レンダリング */}
    </div>
  );
}

// OK: children は参照が変わらないので再レンダリングされない
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light');
  return (
    <div className={theme}>
      <ThemeToggle onToggle={() => setTheme((t) => t === 'light' ? 'dark' : 'light')} />
      {children} {/* 再レンダリングされない */}
    </div>
  );
}

// app.tsx
<ThemeProvider>
  <Header />
  <MainContent />
  <Footer />
</ThemeProvider>
```

### 8.2 React Compiler（React 19+）

```typescript
// React Compiler は useMemo / useCallback / memo を自動的に適用する
// react-compiler-runtime を導入するだけで最適化が自動化される

// babel.config.js（React Compiler プラグイン）
module.exports = {
  plugins: [
    ['babel-plugin-react-compiler', {
      // 特定のコンポーネントを除外
      // sources: (filename) => !filename.includes('legacy/'),
    }],
  ],
};

// next.config.js（Next.js での設定）
module.exports = {
  experimental: {
    reactCompiler: true,
  },
};

// React Compiler が最適化する前:
function ProductList({ products, category }: Props) {
  // Compiler が自動的に useMemo 相当の最適化を適用
  const filtered = products.filter((p) => p.category === category);
  const sorted = filtered.sort((a, b) => a.price - b.price);

  return (
    <ul>
      {sorted.map((product) => (
        // Compiler が自動的に memo 相当の最適化を適用
        <ProductItem key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

### 8.3 DOM Manipulation Optimization

```typescript
// ① requestAnimationFrame による描画最適化
function useAnimatedScroll() {
  const scrollRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const handleScroll = () => {
      // requestAnimationFrame で描画タイミングに合わせる
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        scrollRef.current = window.scrollY;
        // スクロール位置に応じた処理
        updateParallax(scrollRef.current);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}

// ② ResizeObserver でのレイアウト最適化
function useElementSize(ref: RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // contentBoxSize を使用（borderBoxSize も利用可能）
        const { inlineSize, blockSize } = entry.contentBoxSize[0];
        setSize({ width: inlineSize, height: blockSize });
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

// ③ CSS containment によるレイアウト計算の最適化
// 要素内の変更が外部に影響しないことをブラウザに伝える
const containerStyle: React.CSSProperties = {
  contain: 'layout style paint', // レイアウト・スタイル・ペイントを隔離
  contentVisibility: 'auto',      // 画面外の要素のレンダリングをスキップ
  containIntrinsicSize: '0 500px', // 推定サイズ（CLS防止）
};

function LongList({ items }: { items: Item[] }) {
  return (
    <div>
      {items.map((item) => (
        <div key={item.id} style={containerStyle}>
          <ItemContent item={item} />
        </div>
      ))}
    </div>
  );
}
```

### 8.4 Animation Performance

```css
/* GPU アクセラレーションを利用したアニメーション */

/* OK: transform と opacity のみ（コンポジットレイヤーで処理） */
.animate-slide {
  transition: transform 0.3s ease, opacity 0.3s ease;
  will-change: transform;
}
.animate-slide.active {
  transform: translateX(100px);
  opacity: 1;
}

/* NG: レイアウトプロパティのアニメーション（リフロー発生） */
.animate-bad {
  transition: width 0.3s, height 0.3s, top 0.3s, left 0.3s;
}

/* レイヤー昇格のヒント */
.fixed-header {
  will-change: transform; /* 事前にGPUレイヤーを作成 */
  /* 注意: 乱用するとメモリ消費が増える */
}

/* アニメーション完了後に will-change を解除 */
.modal {
  will-change: transform, opacity;
  transition: transform 0.3s, opacity 0.3s;
}
.modal.closed {
  will-change: auto; /* メモリ解放 */
}
```

```
レンダリングパイプラインとアニメーションのコスト:

  ┌──────────┬──────────────────┬──────────────────────────────┐
  │ 処理段階   │ トリガーされる     │ 対象プロパティ                 │
  │          │ プロパティ変更     │                              │
  ├──────────┼──────────────────┼──────────────────────────────┤
  │ Layout   │ リフロー発生      │ width, height, top, left,    │
  │ (高コスト) │ （最も重い）      │ margin, padding, position,   │
  │          │                  │ font-size, display, float    │
  ├──────────┼──────────────────┼──────────────────────────────┤
  │ Paint    │ リペイント発生     │ color, background,           │
  │ (中コスト) │                  │ border-color, box-shadow,    │
  │          │                  │ visibility, outline          │
  ├──────────┼──────────────────┼──────────────────────────────┤
  │ Composite│ コンポジットのみ   │ transform, opacity,          │
  │ (低コスト) │ （最も軽い）      │ filter, will-change          │
  └──────────┴──────────────────┴──────────────────────────────┘

  アニメーション最適化の原則:
    ✓ transform / opacity のみでアニメーション
    ✓ will-change で事前にレイヤー昇格
    ✓ レイアウトプロパティの変更を避ける
    ✓ requestAnimationFrame で描画タイミングに合わせる
```

---

## 9. Performance Measurement and Monitoring

### 9.1 Measurement with the web-vitals Library

```typescript
// lib/web-vitals.ts
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import type { Metric } from 'web-vitals';

// Analytics への送信
function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,    // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,      // 前回からの差分
    id: metric.id,
    navigationType: metric.navigationType,
    // カスタムメタデータ
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    connectionType: (navigator as any).connection?.effectiveType || 'unknown',
  });

  // Beacon API でページ離脱時もデータを確実に送信
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  } else {
    fetch('/api/analytics/vitals', {
      body,
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 各指標の計測を開始
export function initWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

```typescript
// Next.js App Router での web-vitals 統合
// app/components/WebVitals.tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Google Analytics 4 に送信
    if (typeof window.gtag === 'function') {
      window.gtag('event', metric.name, {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(
          metric.name === 'CLS' ? metric.value * 1000 : metric.value
        ),
        non_interaction: true,
      });
    }

    // カスタムダッシュボード用
    console.log(`[Web Vitals] ${metric.name}: ${metric.value} (${metric.rating})`);
  });

  return null;
}

// app/layout.tsx
import { WebVitals } from './components/WebVitals';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
```

### 9.2 Detailed Measurement with the Performance API

```typescript
// カスタムパフォーマンスマーカー
function measureComponentRender(componentName: string) {
  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;
  const measureName = `${componentName}-render`;

  return {
    start: () => performance.mark(startMark),
    end: () => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);

      const entries = performance.getEntriesByName(measureName);
      const duration = entries[entries.length - 1]?.duration;
      console.log(`[Perf] ${componentName}: ${duration?.toFixed(2)}ms`);

      // クリーンアップ
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);

      return duration;
    },
  };
}

// React Profiler での使用
import { Profiler } from 'react';

function onRender(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  // actualDuration: 実際のレンダリング時間
  // baseDuration: メモ化なしでの推定時間
  if (actualDuration > 16) { // 60fps の1フレーム = 16.67ms
    console.warn(
      `[Profiler] ${id} (${phase}): ${actualDuration.toFixed(2)}ms ` +
      `(budget exceeded by ${(actualDuration - 16.67).toFixed(2)}ms)`
    );
  }
}

function App() {
  return (
    <Profiler id="ProductList" onRender={onRender}>
      <ProductList />
    </Profiler>
  );
}

// Navigation Timing API でのページロード詳細
function getPageLoadMetrics() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  return {
    // DNS解決
    dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
    // TCP接続
    tcpConnection: navigation.connectEnd - navigation.connectStart,
    // TLSハンドシェイク
    tlsNegotiation: navigation.requestStart - navigation.secureConnectionStart,
    // サーバー応答（TTFB相当）
    serverResponse: navigation.responseStart - navigation.requestStart,
    // コンテンツ転送
    contentTransfer: navigation.responseEnd - navigation.responseStart,
    // DOM処理
    domProcessing: navigation.domComplete - navigation.responseEnd,
    // ページ読み込み完了
    pageLoad: navigation.loadEventEnd - navigation.fetchStart,
  };
}

// Resource Timing API でのリソース別計測
function getSlowResources(threshold = 1000) {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  return resources
    .filter((r) => r.duration > threshold)
    .map((r) => ({
      name: r.name,
      type: r.initiatorType,
      duration: `${r.duration.toFixed(0)}ms`,
      size: r.transferSize ? `${(r.transferSize / 1024).toFixed(1)}KB` : 'cached',
      protocol: r.nextHopProtocol,
    }))
    .sort((a, b) => parseFloat(b.duration) - parseFloat(a.duration));
}
```

### 9.3 Automated Measurement with Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true
          temporaryPublicStorage: true
```

```javascript
// lighthouserc.json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/products",
        "http://localhost:3000/blog"
      ],
      "startServerCommand": "npm run start",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["warn", { "minScore": 0.9 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "categories:seo": ["warn", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "interactive": ["warn", { "maxNumericValue": 3800 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### 9.4 Performance Budget

```json
// performance-budget.json
{
  "budgets": [
    {
      "path": "/*",
      "resourceSizes": [
        { "resourceType": "script", "budget": 300 },
        { "resourceType": "stylesheet", "budget": 100 },
        { "resourceType": "image", "budget": 500 },
        { "resourceType": "font", "budget": 200 },
        { "resourceType": "total", "budget": 1500 }
      ],
      "resourceCounts": [
        { "resourceType": "script", "budget": 15 },
        { "resourceType": "stylesheet", "budget": 5 },
        { "resourceType": "image", "budget": 30 },
        { "resourceType": "third-party", "budget": 10 }
      ],
      "timings": [
        { "metric": "first-contentful-paint", "budget": 1800 },
        { "metric": "largest-contentful-paint", "budget": 2500 },
        { "metric": "cumulative-layout-shift", "budget": 0.1 },
        { "metric": "total-blocking-time", "budget": 200 }
      ]
    }
  ]
}
```

```typescript
// webpack でのバンドルサイズバジェット
// next.config.js
module.exports = {
  experimental: {
    // ページごとのバンドルサイズ制限
    largePageDataBytes: 128 * 1024, // 128KB
  },

  webpack(config) {
    // バンドルサイズの警告・エラー設定
    config.performance = {
      hints: 'error',           // 'warning' | 'error' | false
      maxAssetSize: 250 * 1024,  // 250KB
      maxEntrypointSize: 400 * 1024, // 400KB
      assetFilter: (assetFilename) => {
        return assetFilename.endsWith('.js') || assetFilename.endsWith('.css');
      },
    };

    return config;
  },
};
```

### 9.5 Real User Monitoring（RUM）

```typescript
// RUM データ収集の実装
// lib/rum.ts
interface RUMData {
  sessionId: string;
  timestamp: number;
  url: string;
  vitals: Record<string, number>;
  resources: Array<{
    name: string;
    duration: number;
    size: number;
  }>;
  connection: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
  device: {
    memory: number;
    hardwareConcurrency: number;
    devicePixelRatio: number;
  };
}

function collectRUMData(): RUMData {
  const connection = (navigator as any).connection;

  return {
    sessionId: crypto.randomUUID(),
    timestamp: Date.now(),
    url: window.location.href,
    vitals: {},
    resources: performance
      .getEntriesByType('resource')
      .slice(-20) // 最新20件
      .map((r: any) => ({
        name: new URL(r.name).pathname,
        duration: Math.round(r.duration),
        size: r.transferSize || 0,
      })),
    connection: {
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
    },
    device: {
      memory: (navigator as any).deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  };
}

// ページ離脱時にデータ送信
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    const data = collectRUMData();
    navigator.sendBeacon('/api/rum', JSON.stringify(data));
  }
});
```

---

## 10. Third-Party Script Optimization

### 10.1 Third-Party Impact

Third-party scripts (analytics, ads, chat widgets, etc.) have a significant impact on performance. They can block the main thread, consume network bandwidth, and cause layout shifts.

```typescript
// ① Next.js Script コンポーネントによる読み込み戦略
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}

        {/* beforeInteractive: ページのハイドレーション前 */}
        <Script
          src="https://polyfill.io/v3/polyfill.min.js"
          strategy="beforeInteractive"
        />

        {/* afterInteractive: ページのハイドレーション直後（デフォルト） */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"
          strategy="afterInteractive"
        />

        {/* lazyOnload: ブラウザがアイドル状態の時 */}
        <Script
          src="https://widget.intercom.io/widget/XXXXX"
          strategy="lazyOnload"
        />

        {/* worker: Web Workerで実行（Partytown） */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"
          strategy="worker"
        />
      </body>
    </html>
  );
}

// ② Partytown によるメインスレッドオフロード
// next.config.js
const nextConfig = {
  experimental: {
    nextScriptWorkers: true,
  },
};

// lib/gtag.ts
// strategy="worker" で実行されるスクリプトは
// Service Worker / Web Worker 内で動作し
// メインスレッドをブロックしない
```

### 10.2 Third-Party Loading Optimization Patterns

```typescript
// ① 条件付き読み込み（ユーザーアクション時）
function ChatWidget() {
  const [loaded, setLoaded] = useState(false);

  const loadChat = () => {
    if (!loaded) {
      // ユーザーがクリックした時のみ読み込み
      const script = document.createElement('script');
      script.src = 'https://chat-widget.example.com/widget.js';
      script.async = true;
      document.body.appendChild(script);
      setLoaded(true);
    }
  };

  return (
    <button onClick={loadChat}>
      {loaded ? 'チャットを開く' : 'サポートに問い合わせ'}
    </button>
  );
}

// ② Intersection Observer による遅延読み込み
function LazyAnalytics() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // ページ下部に到達したらアナリティクスを読み込み
          loadAnalytics();
          observer.disconnect();
        }
      },
      { rootMargin: '500px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} />;
}

// ③ requestIdleCallback による読み込み
function loadNonCriticalScripts() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // ブラウザがアイドルの時に実行
      loadSocialMediaWidgets();
      loadAnalytics();
      loadHotjar();
    }, { timeout: 5000 }); // 最大5秒待機
  } else {
    // フォールバック
    setTimeout(() => {
      loadSocialMediaWidgets();
      loadAnalytics();
      loadHotjar();
    }, 3000);
  }
}

// ④ facade パターン（本物のウィジェットの代替表示）
function YouTubeFacade({ videoId }: { videoId: string }) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="w-full aspect-video"
      />
    );
  }

  return (
    <button
      onClick={() => setLoaded(true)}
      className="relative w-full aspect-video bg-black cursor-pointer group"
    >
      {/* サムネイル画像（軽量） */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
        alt="動画サムネイル"
        loading="lazy"
        className="w-full h-full object-cover"
      />
      {/* 再生ボタン */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-16 h-16 text-white opacity-80 group-hover:opacity-100"
             viewBox="0 0 68 48">
          <path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
                fill="red"/>
          <path d="M45 24 27 14v20" fill="white"/>
        </svg>
      </div>
    </button>
  );
}
```

### 10.3 Third-Party Impact Analysis

```
サードパーティスクリプトの影響度チェック:

  ┌────────────────────┬────────────┬───────────────┬──────────────┐
  │ カテゴリ            │ 典型的なサイズ │ メインスレッド  │ 最適化戦略    │
  │                    │ (gzip)      │ ブロック時間   │              │
  ├────────────────────┼────────────┼───────────────┼──────────────┤
  │ Google Analytics   │ 20KB       │ 50-100ms     │ worker       │
  │ Google Tag Manager │ 35KB       │ 100-200ms    │ worker       │
  │ Facebook Pixel     │ 30KB       │ 50-150ms     │ lazyOnload   │
  │ Intercom           │ 200KB+     │ 200-500ms    │ lazyOnload   │
  │ Hotjar             │ 50KB       │ 100-300ms    │ lazyOnload   │
  │ Stripe.js          │ 30KB       │ 50-100ms     │ afterInteractive│
  │ reCAPTCHA          │ 150KB+     │ 200-400ms    │ 条件付き     │
  │ YouTube埋め込み     │ 500KB+     │ 300-800ms    │ facade       │
  │ Google Maps        │ 200KB+     │ 200-500ms    │ facade       │
  └────────────────────┴────────────┴───────────────┴──────────────┘

  対策の優先順位:
    1. 不要なスクリプトを削除（最も効果的）
    2. facade パターンで遅延読み込み
    3. Partytown（worker戦略）でオフロード
    4. lazyOnload で後読み込み
    5. preconnect でリソースヒント提供
```

---

## 11. Troubleshooting

### 11.1 Common Performance Problems and Solutions

```
問題1: LCPが遅い（> 2.5秒）

  原因の特定:
    ① DevTools > Performance タブで LCP 要素を確認
    ② Lighthouse の LCP 診断を確認
    ③ TTFB が高い場合はサーバー側の問題

  一般的な原因と解決策:
    ┌─────────────────────────────┬──────────────────────────────────┐
    │ 原因                         │ 解決策                            │
    ├─────────────────────────────┼──────────────────────────────────┤
    │ LCP画像が大きい              │ WebP/AVIF変換、適切なsizes指定    │
    │ LCP画像にpreloadがない       │ priority属性 or <link preload>   │
    │ render-blocking CSS/JS      │ Critical CSSインライン化          │
    │ TTFB が遅い                 │ CDN、SSG/ISR、DB最適化           │
    │ クライアントサイドレンダリング │ Server Component に移行          │
    │ サードパーティの遅延          │ worker戦略、facade パターン       │
    └─────────────────────────────┴──────────────────────────────────┘

問題2: INPが遅い（> 200ms）

  原因の特定:
    ① DevTools > Performance で長いタスクを確認
    ② Main Thread のブロッキング時間を計測
    ③ 問題のあるイベントハンドラを特定

  一般的な原因と解決策:
    ┌─────────────────────────────┬──────────────────────────────────┐
    │ 原因                         │ 解決策                            │
    ├─────────────────────────────┼──────────────────────────────────┤
    │ 重い計算処理                  │ Web Worker にオフロード           │
    │ 大量のDOM更新                │ 仮想スクロール、useTransition     │
    │ 同期的なレイアウト強制        │ requestAnimationFrame使用         │
    │ 不要な再レンダリング          │ memo/useMemo/useCallback         │
    │ サードパーティのブロック       │ Partytown / 遅延読み込み          │
    └─────────────────────────────┴──────────────────────────────────┘

問題3: CLSが高い（> 0.1）

  原因の特定:
    ① DevTools > Performance で Layout Shift を確認
    ② Layout Shift Debugger を有効化
    ③ 問題の要素を特定

  一般的な原因と解決策:
    ┌─────────────────────────────┬──────────────────────────────────┐
    │ 原因                         │ 解決策                            │
    ├─────────────────────────────┼──────────────────────────────────┤
    │ 画像のサイズ未指定            │ width/height or aspect-ratio     │
    │ フォントのFOUT               │ font-display: swap + size-adjust │
    │ 動的コンテンツの挿入          │ min-height でスペース確保         │
    │ 広告の後読み込み              │ スケルトン + 固定サイズ            │
    │ レイアウトプロパティのアニメ   │ transform に変更                 │
    └─────────────────────────────┴──────────────────────────────────┘
```

### 11.2 Performance Debugging Toolkit

```typescript
// DevTools での主要なデバッグ手法
//
// ① Performance タブ
//    - CPU 4x/6x Slowdown でスロー環境シミュレーション
//    - Network Throttling で低速ネットワークテスト
//    - Main Thread のフレームチャートで処理のボトルネック特定
//    - Layout Shift の可視化
//
// ② Network タブ
//    - Waterfall チャートでリソース読み込み順序を確認
//    - Initiator でリソースのリクエスト元を特定
//    - Size でキャッシュ状態を確認
//    - Disable cache でキャッシュなしテスト
//
// ③ Lighthouse タブ
//    - パフォーマンススコアと改善提案
//    - Mobile/Desktop 両方でテスト
//    - Treemap でバンドルサイズ分析
//
// ④ Coverage タブ
//    - 未使用CSS/JSの割合を表示
//    - 赤（未使用）が多いファイルを特定

// プログラムによるパフォーマンスデバッグ
// Long Tasks の監視
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) { // 50ms 以上のタスク
      console.warn(`[Long Task] ${entry.duration.toFixed(0)}ms`, {
        name: entry.name,
        startTime: entry.startTime,
        attribution: (entry as any).attribution,
      });
    }
  }
});
observer.observe({ entryTypes: ['longtask'] });

// Layout Shift の監視
const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const layoutShiftEntry = entry as any;
    if (!layoutShiftEntry.hadRecentInput) {
      console.warn(`[Layout Shift] Score: ${layoutShiftEntry.value.toFixed(4)}`, {
        sources: layoutShiftEntry.sources?.map((s: any) => ({
          node: s.node?.nodeName,
          previousRect: s.previousRect,
          currentRect: s.currentRect,
        })),
      });
    }
  }
});
clsObserver.observe({ entryTypes: ['layout-shift'] });
```

### 11.3 Performance Anti-Pattern Collection

```typescript
// アンチパターン 1: 不要なクライアントコンポーネント
// NG: 'use client' を不必要に使用
'use client'; // これがなくても動作するのに追加してしまう
export default function StaticContent() {
  return <div>静的コンテンツ</div>; // Server Component で十分
}

// OK: 必要な場合のみ 'use client'
// useState, useEffect, onClick 等を使う場合のみ

// アンチパターン 2: useEffect でのデータフェッチ
// NG: クライアントサイドでのウォーターフォール
'use client';
function ProductPage({ id }: { id: string }) {
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    // ウォーターフォール: 1つ目のリクエスト完了後に2つ目
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProduct(data);
        return fetch(`/api/products/${id}/reviews`);
      })
      .then((r) => r.json())
      .then(setReviews);
  }, [id]);
}

// OK: Server Component で並列フェッチ
async function ProductPage({ params }: { params: { id: string } }) {
  // 並列フェッチ
  const [product, reviews] = await Promise.all([
    getProduct(params.id),
    getReviews(params.id),
  ]);

  return (
    <div>
      <ProductDetail product={product} />
      <ReviewList reviews={reviews} />
    </div>
  );
}

// アンチパターン 3: 無限ループ的な再レンダリング
// NG: レンダリング内でオブジェクト生成
function Component({ items }: { items: Item[] }) {
  return (
    <ChildComponent
      // 毎回新しいオブジェクトが生成される → 毎回再レンダリング
      config={{ theme: 'dark', size: 'large' }}
      // 毎回新しい配列が生成される
      data={items.filter((i) => i.active)}
      // 毎回新しい関数が生成される
      onClick={(id) => handleClick(id)}
    />
  );
}

// OK: メモ化で安定した参照を提供
function Component({ items }: { items: Item[] }) {
  const config = useMemo(() => ({ theme: 'dark', size: 'large' }), []);
  const filteredData = useMemo(
    () => items.filter((i) => i.active),
    [items]
  );
  const handleClick = useCallback((id: string) => {
    // handle click
  }, []);

  return (
    <ChildComponent config={config} data={filteredData} onClick={handleClick} />
  );
}

// アンチパターン 4: 巨大なコンテキスト
// NG: 1つのコンテキストに全状態を詰め込む
const AppContext = createContext({
  user: null,
  theme: 'light',
  locale: 'ja',
  cart: [],
  notifications: [],
  // ... 大量の状態
});

// OK: 関心ごとに分割
const UserContext = createContext(null);
const ThemeContext = createContext('light');
const CartContext = createContext([]);
// 変更頻度が異なる状態を分離することで不要な再レンダリングを防止
```

---

## Summary

### Performance Optimization Overview

| Category | Key Techniques | Affected Metrics |
|---------|-------------|-----------|
| Bundle optimization | dynamic import, tree shaking, lightweight libraries | LCP, FCP, TTI |
| Image optimization | next/image, WebP/AVIF, priority, lazy loading | LCP, CLS |
| Font optimization | next/font, display: swap, subsetting | CLS, FCP |
| CSS optimization | Critical CSS, PurgeCSS, zero-runtime CSS-in-JS | FCP, LCP |
| Cache strategy | Data Cache, HTTP Cache, Service Worker | TTFB, LCP |
| Core Web Vitals | LCP < 2.5s, INP < 200ms, CLS < 0.1 | All metrics |
| Network | preconnect, Brotli, HTTP/2, CDN | TTFB, LCP |
| Rendering | memo, useTransition, virtual scroll | INP, TBT |
| Measurement/monitoring | web-vitals, Lighthouse CI, RUM | Continuous improvement |
| Third-party | worker, facade, conditional loading | LCP, INP, CLS |

### Optimization Priority

```
パフォーマンス最適化の優先順位ガイド:

  最重要（即座に取り組むべき）:
    1. LCP画像の最適化（priority, WebP/AVIF, sizes）
    2. バンドルサイズの削減（code splitting, tree shaking）
    3. サーバー応答の高速化（SSG/ISR, CDN）

  重要（Core Web Vitals に直結）:
    4. CLS の改善（画像サイズ、フォント、スケルトン）
    5. INP の改善（useTransition, Web Worker, 仮想スクロール）
    6. キャッシュ戦略の最適化

  推奨（さらなる改善）:
    7. サードパーティスクリプトの最適化
    8. フォントの最適化（サブセット化、preload）
    9. Critical CSS のインライン化
    10. Service Worker / PWA の導入

  継続的:
    11. パフォーマンスバジェットの設定と監視
    12. Lighthouse CI による回帰テスト
    13. RUM による実ユーザーデータ分析
```

### DevTools Quick Reference

```
パフォーマンスデバッグの手順:

  Step 1: Lighthouse でスコア確認
    → Performance スコア 90+ を目標
    → 各指標の問題点を特定

  Step 2: Performance タブで詳細分析
    → CPU Throttling 4x で低スペック端末シミュレーション
    → Main Thread のボトルネック特定
    → Long Task の特定

  Step 3: Network タブでリソース確認
    → Waterfall チャートで読み込み順序確認
    → 不要なリクエストの特定
    → キャッシュ効果の確認

  Step 4: Coverage タブで未使用コード確認
    → 未使用CSS/JSの割合を確認
    → コード分割の候補を特定

  Step 5: 改善 → 計測 → 改善のサイクル
    → 1つずつ改善して効果を計測
    → PRごとにLighthouse CIで回帰チェック
```

---

## Frequently Asked Questions (FAQ)

### Q1: What are the strategies for improving Core Web Vitals?

**Three Core Web Vitals metrics and target values:**

| Metric | Target | What is measured |
|------|--------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | Render time of largest content element |
| INP (Interaction to Next Paint) | < 200ms | Interaction responsiveness |
| CLS (Cumulative Layout Shift) | < 0.1 | Layout stability |

**LCP improvement priority:**

```
1. 画像最適化（最重要）
   □ priority属性でATF画像をプリロード
   □ WebP/AVIF形式に変換
   □ sizes属性で適切なサイズ指定
   □ CDN経由で配信

2. サーバー応答の高速化
   □ SSG/ISRでHTMLを事前生成
   □ Edgeでキャッシュ
   □ TTFB < 600msを目指す

3. リソースのブロッキング削減
   □ Critical CSSのインライン化
   □ 非同期スクリプト読み込み（defer/async）
   □ フォントのpreload

実装例:
// LCP画像の最適化
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // ← LCP画像には必須
  sizes="100vw"
/>
```

**INP improvement strategies:**

```typescript
// 1. 重い処理をWeb Workerに移譲
const worker = new Worker('/worker.js');
worker.postMessage({ data: heavyData });

// 2. useTransition で優先度を下げる
import { useTransition } from 'react';
const [isPending, startTransition] = useTransition();

function handleClick() {
  startTransition(() => {
    // 重い状態更新を低優先度に
    setSearchResults(filterLargeDataset(query));
  });
}

// 3. 仮想スクロール（大量データの場合）
import { useVirtualizer } from '@tanstack/react-virtual';

// 4. デバウンス/スロットル
import { debounce } from 'lodash-es';
const debouncedSearch = debounce(search, 300);
```

**CLS improvement checklist:**

```
□ すべての画像にwidth/heightを指定
  <img src="/img.jpg" width="800" height="600" />

□ フォント読み込み中もレイアウトが崩れないように
  font-display: swap; + fallbackフォント指定

□ 動的コンテンツには領域を事前確保
  <div style={{ minHeight: '200px' }}>{dynamicContent}</div>

□ 広告・埋め込みコンテンツには固定サイズ指定
  <div className="ad-container" style={{ width: 300, height: 250 }} />

□ アニメーションはtransform/opacityのみ使用
  ✓ transform: translateY(10px);
  ✗ margin-top: 10px; ← Reflow発生
```

### Q2: How do I optimize bundle size?

**Understand the current state with analysis tools:**

```bash
# Next.jsのビルド分析
ANALYZE=true npm run build

# バンドルサイズの内訳を確認
npx source-map-explorer 'build/static/js/*.js'
```

**Optimization priority:**

```
1. 不要な依存関係の削除（最も効果大）
   # パッケージサイズを確認
   npx bundlephobia <package-name>

   # 例: moment.js (289KB) → date-fns (13KB) or dayjs (2KB)
   - import moment from 'moment';
   + import { format } from 'date-fns';

2. Tree Shakingを活用
   # ✗ 悪い例: デフォルトインポート
   import _ from 'lodash';  // 全体が読み込まれる

   # ✓ 良い例: 名前付きインポート
   import { debounce, throttle } from 'lodash-es';

3. Dynamic Import でコード分割
   // ✗ 悪い例: 全部を最初に読み込み
   import HeavyChart from './HeavyChart';

   // ✓ 良い例: 必要になったら読み込み
   const HeavyChart = lazy(() => import('./HeavyChart'));

4. 本番ビルドの最適化
   // next.config.js
   module.exports = {
     compiler: {
       removeConsole: process.env.NODE_ENV === 'production',
     },
     experimental: {
       optimizePackageImports: ['lodash-es', 'date-fns'],
     },
   };
```

**Bundle size benchmarks:**

```
Next.js アプリの目標値:

Initial Load (First Load JS):
  ✓ Excellent: < 100KB
  △ Good:      100-200KB
  ✗ Poor:      > 200KB

Per-page JavaScript:
  ✓ Excellent: < 50KB
  △ Good:      50-100KB
  ✗ Poor:      > 100KB
```

### Q3: What are the best practices for image optimization?

**Full utilization of the Next.js Image component:**

```typescript
import Image from 'next/image';

// 1. ATF（Above The Fold）画像 - 最優先
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority              // ← プリロード
  quality={90}          // デフォルト75、ヒーロー画像は高品質
  sizes="100vw"         // レスポンシブ対応
/>

// 2. BTF（Below The Fold）画像 - 遅延読み込み
<Image
  src="/content.jpg"
  alt="Content"
  width={800}
  height={400}
  loading="lazy"        // デフォルトで有効
  quality={75}          // 標準品質
  sizes="(max-width: 768px) 100vw, 800px"
  placeholder="blur"    // ぼかしプレースホルダー
  blurDataURL="data:image/jpeg;base64,..." // LQIP
/>

// 3. 外部画像
<Image
  src="https://example.com/image.jpg"
  alt="External image"
  width={600}
  height={400}
  unoptimized={false}   // Vercel Image Optimizationを利用
/>
```

**Optimization configuration in next.config.js:**

```javascript
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'], // 最新フォーマットを優先
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1年間キャッシュ
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
      },
    ],
  },
};
```

**Format selection guidelines:**

```
シナリオ別の推奨フォーマット:

写真・グラデーション:
  1st: AVIF (最高圧縮、Safari 16.4+)
  2nd: WebP (広範サポート、IE以外)
  3rd: JPEG (フォールバック)

イラスト・ロゴ・アイコン:
  1st: SVG (ベクター、スケーラブル)
  2nd: WebP (透過対応)
  3rd: PNG (フォールバック)

アニメーション:
  1st: WebP animated (GIFより圧縮率高い)
  2nd: MP4/WebM (動画として扱う、さらに軽量)
  3rd: GIF (フォールバック)
```

**Performance verification:**

```bash
# Lighthouse で画像最適化を確認
npx lighthouse https://example.com --only-categories=performance

# 各画像のサイズを確認
# Chrome DevTools > Network > Img フィルター
# サイズが大きい画像を特定して最適化
```

**Delivery via CDN:**

```typescript
// Cloudflare Images経由
const imageUrl = `https://imagedelivery.net/${ACCOUNT_HASH}/${IMAGE_ID}/public`;

// 動的リサイズ
const thumbnail = `${imageUrl}/width=400,height=300`;
const optimized = `${imageUrl}/format=auto,quality=80`;
```

Implementing these optimizations will dramatically improve LCP.

---

## Next Guides to Read

---

## References
1. Next.js. "Optimizing." nextjs.org/docs, 2024.
2. web.dev. "Core Web Vitals." web.dev, 2024.
3. web.dev. "Performance." web.dev/performance, 2024.
4. MDN Web Docs. "Web performance." developer.mozilla.org, 2024.
5. Addy Osmani. "Image Optimization." web.dev/fast, 2024.
6. Philip Walton. "Optimize Interaction to Next Paint." web.dev, 2024.
7. Chrome DevTools. "Performance features reference." developer.chrome.com, 2024.
8. Vercel. "Performance." vercel.com/docs, 2024.
9. TanStack. "Virtual." tanstack.com/virtual, 2024.
10. Workbox. "Service Worker Caching Strategies." developer.chrome.com/docs/workbox, 2024.
