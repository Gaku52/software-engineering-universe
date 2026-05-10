# Python ML Stack — NumPy, pandas, scikit-learn

> Master the core libraries of the Python machine learning ecosystem through hands-on practice

## What You Will Learn in This Chapter

1. **NumPy** — Fast multi-dimensional array operations and broadcasting
2. **pandas** — Complete operations for loading, processing, and aggregating tabular data
3. **scikit-learn** — Building pipelines from preprocessing to training to evaluation
4. **Matplotlib / Seaborn** — Data visualization from basics to advanced techniques
5. **SciPy** — Scientific computing, statistical tests, and optimization
6. **Practical Patterns** — Project structure, testing, and deployment

[日本語版](ja/03-python-ml-stack.md)

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Machine Learning Fundamentals — Supervised/Unsupervised, Evaluation Metrics](./02-ml-basics.md)

---

## 1. NumPy — Foundation of Numerical Computing

### 1.1 NumPy Architecture

```
Python List               NumPy ndarray
┌───┬───┬───┬───┐         ┌───┬───┬───┬───┐
│ 1 │ 2 │ 3 │ 4 │         │ 1 │ 2 │ 3 │ 4 │
└─┬─┴─┬─┴─┬─┴─┬─┘         └───┴───┴───┴───┘
  │   │   │   │              Contiguous memory block
  v   v   v   v              (equivalent to C array)
 obj obj obj obj
 (each element is a separate object)  → Fast with vectorized operations
 → Requires loops, slow               → Integrates with BLAS/LAPACK
```

Understanding NumPy's internal architecture is essential for writing fast numerical computing code. NumPy's `ndarray` consists of three main components:

1. **Data buffer**: Elements of the same type stored in a contiguous memory region
2. **dtype (data type)**: Defines the number of bytes and interpretation for each element
3. **Strides**: Number of bytes needed to advance one element in each dimension

```python
import numpy as np

# Inspect the internal structure of ndarray
arr = np.array([[1, 2, 3], [4, 5, 6]], dtype=np.float64)

print(f"shape:    {arr.shape}")        # (2, 3)
print(f"dtype:    {arr.dtype}")        # float64
print(f"strides:  {arr.strides}")      # (24, 8) — byte strides for each dimension
print(f"itemsize: {arr.itemsize}")     # 8 bytes (float64)
print(f"nbytes:   {arr.nbytes}")       # 48 bytes (2×3×8)
print(f"flags:\n{arr.flags}")          # C_CONTIGUOUS, F_CONTIGUOUS, etc.
```

### 1.2 Array Creation Patterns

```python
import numpy as np

# --- Basic array creation ---
# Zero-filled
zeros = np.zeros((3, 4))                    # 3×4 zero matrix
ones = np.ones((2, 3, 4))                   # 2×3×4 tensor filled with ones
empty = np.empty((5, 5))                    # Uninitialized (fast but values are undefined)

# Arithmetic and geometric sequences
linspace = np.linspace(0, 1, 100)           # 100 evenly spaced values from 0 to 1
arange = np.arange(0, 10, 0.5)             # 0 to 10 in steps of 0.5
logspace = np.logspace(0, 3, 50)            # 50 logarithmically spaced values from 10^0 to 10^3

# Identity and diagonal matrices
identity = np.eye(4)                         # 4×4 identity matrix
diag = np.diag([1, 2, 3, 4])               # Diagonal matrix

# --- Random number generation (new Generator API recommended) ---
rng = np.random.default_rng(seed=42)

uniform = rng.uniform(0, 1, size=(3, 4))     # Uniform distribution
normal = rng.normal(loc=0, scale=1, size=1000)  # Normal distribution
integers = rng.integers(0, 100, size=50)     # Integer random numbers
choice = rng.choice(['A', 'B', 'C'], size=10, p=[0.5, 0.3, 0.2])  # Weighted selection

# Reproducible random seed management
seed_seq = np.random.SeedSequence(42)
child_seeds = seed_seq.spawn(4)  # Independent seeds for parallel processing
rngs = [np.random.default_rng(s) for s in child_seeds]
```

### 1.3 Vectorized Operations and Broadcasting

```python
import numpy as np
import time

# --- Vectorized vs loop speed comparison ---
n = 1_000_000
a = np.random.randn(n)
b = np.random.randn(n)

# BAD: Python loop
start = time.time()
result_loop = [a[i] + b[i] for i in range(n)]
print(f"Loop: {time.time() - start:.4f} seconds")

# GOOD: Vectorized operation
start = time.time()
result_vec = a + b
print(f"Vectorized: {time.time() - start:.4f} seconds")
# → 100x or more faster

# --- Broadcasting ---
matrix = np.array([[1, 2, 3],
                   [4, 5, 6],
                   [7, 8, 9]])
row = np.array([10, 20, 30])

# Row vector is automatically broadcast
result = matrix + row
# [[11, 22, 33],
#  [14, 25, 36],
#  [17, 28, 39]]
```

### 1.4 Broadcasting Rules in Detail

Broadcasting is one of NumPy's most powerful features — the implicit expansion rules for performing operations between arrays of different shapes.

```
Broadcasting rules:
1. Arrays with fewer dimensions have 1s prepended to their shape
2. Dimensions are compatible if they match or one of them is 1
3. Dimensions of size 1 are expanded to match the other array's size

Examples:
  A: (3, 4)    B: (4,)
  → B is converted to (1, 4)
  → B is broadcast to (3, 4)

  A: (3, 1, 5)  B: (1, 4, 1)
  → Result: (3, 4, 5)
```

```python
import numpy as np

# Practical examples of broadcasting

# Example 1: Subtract column mean for standardization
data = np.random.randn(100, 5)  # 100 samples × 5 features
col_mean = data.mean(axis=0)     # shape: (5,)
col_std = data.std(axis=0)       # shape: (5,)
normalized = (data - col_mean) / col_std  # broadcasting (100,5) with (5,)

# Example 2: Computing a distance matrix (pairwise distances)
points = np.random.randn(100, 3)  # 100 points in 3D space
# (100,1,3) - (1,100,3) → (100,100,3) → sum → (100,100)
diff = points[:, np.newaxis, :] - points[np.newaxis, :, :]
distances = np.sqrt((diff ** 2).sum(axis=-1))

# Example 3: Outer product
x = np.array([1, 2, 3])
y = np.array([4, 5, 6, 7])
outer = x[:, np.newaxis] * y[np.newaxis, :]  # (3,4) outer product matrix

# Example 4: One-hot encoding
labels = np.array([0, 2, 1, 0, 3])
n_classes = 4
one_hot = (labels[:, np.newaxis] == np.arange(n_classes)[np.newaxis, :]).astype(int)
# [[1,0,0,0],
#  [0,0,1,0],
#  [0,1,0,0],
#  [1,0,0,0],
#  [0,0,0,1]]
```

### 1.5 Advanced Indexing and Slicing

```python
import numpy as np

arr = np.arange(20).reshape(4, 5)
# [[ 0,  1,  2,  3,  4],
#  [ 5,  6,  7,  8,  9],
#  [10, 11, 12, 13, 14],
#  [15, 16, 17, 18, 19]]

# --- Basic slicing (view: shared memory) ---
sub = arr[1:3, 2:4]        # [[7,8],[12,13]]
sub[0, 0] = 999            # arr is also modified! (because it's a view)

# --- Fancy indexing (copy: independent memory) ---
rows = [0, 2, 3]
cols = [1, 3, 4]
fancy = arr[rows, cols]     # [ 1, 13, 19] (element at each (row,col) pair)

# --- Boolean indexing ---
mask = arr > 10
filtered = arr[mask]        # [11, 12, 13, 14, 15, 16, 17, 18, 19]

# Conditional assignment
arr_copy = arr.copy()
arr_copy[arr_copy > 15] = -1  # Replace elements greater than 15 with -1

# --- Conditional branching with np.where ---
result = np.where(arr > 10, arr, 0)  # Keep values above 10, set rest to 0

# --- Combining multi-dimensional indexing ---
# Select specific rows and columns
selected = arr[np.ix_([0, 2], [1, 3])]  # 2×2 submatrix [[1,3],[11,13]]

# --- Stride tricks (advanced) ---
# Efficiently create a sliding window
from numpy.lib.stride_tricks import sliding_window_view
data = np.arange(10)
windows = sliding_window_view(data, window_shape=3)
# [[0,1,2], [1,2,3], [2,3,4], ..., [7,8,9]]
```

### 1.6 Linear Algebra and FFT

```python
import numpy as np

# --- Linear algebra ---
A = np.random.randn(3, 3)
b = np.random.randn(3)

# Solve the system of equations Ax = b
x = np.linalg.solve(A, b)
print(f"Solution: {x}")
print(f"Verification Ax - b ≈ 0: {np.allclose(A @ x, b)}")

# Eigenvalue decomposition
eigenvalues, eigenvectors = np.linalg.eig(A)
print(f"Eigenvalues: {eigenvalues}")

# Singular Value Decomposition (SVD)
U, s, Vt = np.linalg.svd(A)
print(f"Singular values: {s}")
# Reconstruction: A ≈ U @ diag(s) @ Vt
A_reconstructed = U @ np.diag(s) @ Vt
print(f"Reconstruction error: {np.linalg.norm(A - A_reconstructed):.2e}")

# Cholesky decomposition (positive definite symmetric matrix)
C = A @ A.T + np.eye(3)  # Create a positive definite matrix
L = np.linalg.cholesky(C)
print(f"C = L @ L.T: {np.allclose(C, L @ L.T)}")

# QR decomposition
Q, R = np.linalg.qr(A)
print(f"Q orthogonality: {np.allclose(Q.T @ Q, np.eye(3))}")

# Matrix rank, condition number, and norm
print(f"Rank: {np.linalg.matrix_rank(A)}")
print(f"Condition number: {np.linalg.cond(A):.2f}")
print(f"Frobenius norm: {np.linalg.norm(A, 'fro'):.4f}")

# --- FFT (Fast Fourier Transform) ---
# Signal analysis example
t = np.linspace(0, 1, 1000)  # 1 second, 1000 samples
# Composite signal at 50Hz and 120Hz + noise
signal = np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 120 * t)
signal += 0.3 * np.random.randn(len(t))

# Extract frequency components with FFT
fft_result = np.fft.fft(signal)
frequencies = np.fft.fftfreq(len(t), d=t[1] - t[0])
power = np.abs(fft_result) ** 2

# Positive frequencies only
positive_mask = frequencies > 0
dominant_freq = frequencies[positive_mask][np.argmax(power[positive_mask])]
print(f"Dominant frequency: {dominant_freq:.1f} Hz")
```

### 1.7 NumPy Memory Management and Optimization

```python
import numpy as np

# --- Memory optimization through dtype selection ---
# float64 is wasteful for image data (0-255)
img_bad = np.random.randint(0, 256, (1920, 1080, 3)).astype(np.float64)
img_good = np.random.randint(0, 256, (1920, 1080, 3)).astype(np.uint8)
print(f"float64: {img_bad.nbytes / 1e6:.1f} MB")  # ~49.8 MB
print(f"uint8:   {img_good.nbytes / 1e6:.1f} MB")  # ~6.2 MB

# --- Memory layout (C-contiguous vs Fortran-contiguous) ---
c_arr = np.array([[1,2,3],[4,5,6]], order='C')    # Row-major (C style)
f_arr = np.array([[1,2,3],[4,5,6]], order='F')    # Column-major (Fortran style)

# Row-wise access is faster with C-contiguous
# Column-wise access is faster with F-contiguous

# --- Determining copy vs view ---
original = np.arange(12).reshape(3, 4)
view = original[1:]          # View (shared memory)
copy = original[1:].copy()   # Copy (independent memory)

print(f"View: {view.base is original}")   # True
print(f"Copy: {copy.base is original}")   # False

# --- np.memmap: Large arrays on disk ---
# Handle huge arrays that don't fit in memory
mmap = np.memmap('/tmp/large_array.dat', dtype='float32',
                 mode='w+', shape=(10000, 10000))
mmap[:100, :100] = np.random.randn(100, 100).astype('float32')
mmap.flush()  # Write to disk
del mmap      # Release

# Read (load only the needed portion into memory)
mmap_read = np.memmap('/tmp/large_array.dat', dtype='float32',
                      mode='r', shape=(10000, 10000))
subset = mmap_read[:100, :100]
```

### 1.8 NumPy Universal Functions (ufunc)

```python
import numpy as np

# --- Using built-in ufuncs ---
x = np.array([1, 4, 9, 16, 25])

# Math functions
print(np.sqrt(x))         # Square root
print(np.log(x))          # Natural logarithm
print(np.exp(x))          # Exponential function

# Aggregate functions
data = np.random.randn(1000)
print(f"Mean: {np.mean(data):.4f}")
print(f"Median: {np.median(data):.4f}")
print(f"Std dev: {np.std(data):.4f}")
print(f"Percentiles: {np.percentile(data, [25, 50, 75])}")

# Cumulative functions
arr = np.array([1, 2, 3, 4, 5])
print(f"Cumulative sum: {np.cumsum(arr)}")      # [1, 3, 6, 10, 15]
print(f"Cumulative product: {np.cumprod(arr)}") # [1, 2, 6, 24, 120]

# --- Creating custom ufuncs ---
# np.vectorize (convenient but no speed improvement)
def my_func(x):
    if x > 0:
        return x ** 2
    else:
        return -x

vectorized = np.vectorize(my_func)
result = vectorized(np.array([-2, -1, 0, 1, 2]))

# np.frompyfunc (faster)
ufunc = np.frompyfunc(my_func, 1, 1)
result = ufunc(np.array([-2, -1, 0, 1, 2]))

# Fastest: combining np.where with vectorized operations
x = np.array([-2, -1, 0, 1, 2])
result = np.where(x > 0, x ** 2, -x)
```

---

## 2. pandas — The Standard Tool for Data Manipulation

### 2.1 Basic DataFrame Operations and Method Chaining

```python
import pandas as pd
import numpy as np

# --- Creating and basic operations on DataFrames ---
df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
    "age": [28, 35, 42, 31, 27],
    "department": ["Engineering", "Marketing", "Engineering", "Sales", "Marketing"],
    "salary": [85000, 72000, 95000, 68000, 71000],
    "join_date": pd.to_datetime(["2020-03-15", "2019-07-01", "2018-01-20",
                                  "2021-06-10", "2022-02-28"])
})

# Data processing with method chaining
result = (
    df
    .assign(
        tenure_years=lambda x: (pd.Timestamp.now() - x["join_date"]).dt.days / 365,
        salary_rank=lambda x: x["salary"].rank(ascending=False).astype(int)
    )
    .query("age >= 30")
    .sort_values("salary", ascending=False)
    .reset_index(drop=True)
)
print(result)

# --- GroupBy aggregation ---
summary = (
    df
    .groupby("department")
    .agg(
        headcount=("name", "count"),
        avg_age=("age", "mean"),
        avg_salary=("salary", "mean"),
        max_salary=("salary", "max"),
    )
    .round(0)
    .sort_values("avg_salary", ascending=False)
)
print(summary)
```

### 2.2 Data Types and Missing Value Management

```python
import pandas as pd
import numpy as np

# --- Checking and converting data types ---
df = pd.DataFrame({
    "id": ["001", "002", "003", "004"],
    "value": ["100", "200", "N/A", "400"],
    "date_str": ["2024-01-15", "2024-02-20", "2024-03-10", "2024-04-05"],
    "category": ["A", "B", "A", "C"],
    "flag": [1, 0, 1, 1],
})

# Best practices for type conversion
df_typed = (
    df
    .assign(
        id=lambda x: x["id"].astype("string"),        # String type (pandas StringDtype)
        value=lambda x: pd.to_numeric(x["value"], errors="coerce"),  # Convert to numeric (N/A→NaN)
        date=lambda x: pd.to_datetime(x["date_str"]),  # Date type
        category=lambda x: x["category"].astype("category"),  # Category type
        flag=lambda x: x["flag"].astype(bool),         # Boolean type
    )
    .drop(columns=["date_str"])
)

print(df_typed.dtypes)
print(f"Memory usage: {df_typed.memory_usage(deep=True).sum()} bytes")

# --- Nullable types (recommended for pandas 1.0+) ---
# Traditional: integer columns with NaN get promoted to float64
# New approach: pd.Int64Dtype() supports NaN while keeping integer type
s = pd.array([1, 2, pd.NA, 4], dtype=pd.Int64Dtype())
print(s)       # [1, 2, <NA>, 4]
print(s.dtype) # Int64

# --- Missing value handling patterns ---
df_missing = pd.DataFrame({
    "A": [1, np.nan, 3, np.nan, 5],
    "B": [np.nan, 2, np.nan, 4, 5],
    "C": [1, 2, 3, 4, 5],
})

# Checking missing values
print(df_missing.isnull().sum())           # Missing count per column
print(df_missing.isnull().mean() * 100)    # Missing rate per column (%)

# Imputation strategies
df_filled = df_missing.copy()
df_filled["A"] = df_filled["A"].fillna(df_filled["A"].median())      # Impute with median
df_filled["B"] = df_filled["B"].interpolate(method="linear")          # Linear interpolation
df_filled["A_forward"] = df_missing["A"].ffill()                      # Forward fill
df_filled["A_backward"] = df_missing["A"].bfill()                     # Backward fill

# Data for visualizing missing patterns
missing_pattern = df_missing.isnull().astype(int)
print(missing_pattern)
```

### 2.3 Time Series Data Processing

```python
import pandas as pd
import numpy as np

# --- Creating time series data ---
dates = pd.date_range("2023-01-01", periods=365, freq="D")
ts = pd.DataFrame({
    "date": dates,
    "sales": np.random.poisson(100, 365) + np.sin(np.arange(365) * 2 * np.pi / 365) * 30,
    "temperature": 15 + 10 * np.sin(np.arange(365) * 2 * np.pi / 365) + np.random.randn(365) * 3,
})
ts = ts.set_index("date")

# --- Resampling ---
# Monthly aggregation
monthly = ts.resample("M").agg({
    "sales": ["sum", "mean", "std"],
    "temperature": "mean",
})
print(monthly.head())

# Weekly aggregation (Monday start)
weekly = ts.resample("W-MON").mean()

# --- Rolling statistics ---
ts["sales_ma7"] = ts["sales"].rolling(window=7).mean()           # 7-day moving average
ts["sales_ma30"] = ts["sales"].rolling(window=30).mean()         # 30-day moving average
ts["sales_std7"] = ts["sales"].rolling(window=7).std()           # 7-day rolling std dev
ts["sales_ewm"] = ts["sales"].ewm(span=7).mean()                # Exponentially weighted moving average

# --- Lag features and differences ---
ts["sales_lag1"] = ts["sales"].shift(1)       # 1 day ago
ts["sales_lag7"] = ts["sales"].shift(7)       # 7 days ago
ts["sales_diff1"] = ts["sales"].diff(1)       # First difference
ts["sales_pct_change"] = ts["sales"].pct_change()  # Percentage change

# --- Extracting day-of-week, month, etc. as features ---
ts["dayofweek"] = ts.index.dayofweek          # 0=Monday
ts["month"] = ts.index.month
ts["quarter"] = ts.index.quarter
ts["is_weekend"] = ts["dayofweek"].isin([5, 6]).astype(int)
ts["day_of_year"] = ts.index.dayofyear

# --- Period index and time zones ---
# Timezone conversion
ts_utc = ts.tz_localize("UTC")
ts_jst = ts_utc.tz_convert("Asia/Tokyo")

# Business day calendar
biz_days = pd.bdate_range("2024-01-01", "2024-12-31", freq="B")
print(f"Business days in 2024: {len(biz_days)}")
```

### 2.4 Efficient Loading of Large Data

```python
import pandas as pd

# --- Memory-optimized loading ---
def read_optimized(filepath: str, sample_rows: int = 10000) -> pd.DataFrame:
    """Memory-efficient CSV loading"""

    # First, infer types from a sample
    sample = pd.read_csv(filepath, nrows=sample_rows)

    # Build a type optimization map
    dtype_map = {}
    for col in sample.columns:
        col_type = sample[col].dtype
        if col_type == "int64":
            if sample[col].min() >= 0 and sample[col].max() <= 255:
                dtype_map[col] = "uint8"
            elif sample[col].min() >= -128 and sample[col].max() <= 127:
                dtype_map[col] = "int8"
            elif sample[col].min() >= -32768 and sample[col].max() <= 32767:
                dtype_map[col] = "int16"
            else:
                dtype_map[col] = "int32"
        elif col_type == "float64":
            dtype_map[col] = "float32"
        elif col_type == "object":
            if sample[col].nunique() / len(sample) < 0.5:
                dtype_map[col] = "category"

    # Load with optimized types
    df = pd.read_csv(filepath, dtype=dtype_map)

    original_mb = sample.memory_usage(deep=True).sum() / 1e6
    optimized_mb = df.head(sample_rows).memory_usage(deep=True).sum() / 1e6
    print(f"Memory reduction: {original_mb:.1f}MB → {optimized_mb:.1f}MB "
          f"({(1-optimized_mb/original_mb)*100:.0f}% reduction)")

    return df


# --- Chunk processing (for data that doesn't fit in memory) ---
def process_large_csv(filepath: str, chunksize: int = 100000):
    """Process a large CSV in chunks"""
    results = []

    for i, chunk in enumerate(pd.read_csv(filepath, chunksize=chunksize)):
        # Process each chunk
        chunk_result = (
            chunk
            .groupby("category")
            .agg({"value": ["sum", "count"]})
        )
        results.append(chunk_result)

        if (i + 1) % 10 == 0:
            print(f"  {(i + 1) * chunksize:,} rows processed")

    # Merge chunk results
    combined = pd.concat(results)
    final = combined.groupby(level=0).sum()
    return final


# --- Using Parquet format (recommended) ---
def csv_to_parquet(csv_path: str, parquet_path: str):
    """Convert CSV to Parquet (compression + fast loading)"""
    df = pd.read_csv(csv_path)
    df.to_parquet(parquet_path, engine="pyarrow", compression="snappy")

    import os
    csv_size = os.path.getsize(csv_path) / 1e6
    parquet_size = os.path.getsize(parquet_path) / 1e6
    print(f"CSV: {csv_size:.1f}MB → Parquet: {parquet_size:.1f}MB "
          f"({(1-parquet_size/csv_size)*100:.0f}% compressed)")


# Reading Parquet (only load needed columns)
# df = pd.read_parquet("data.parquet", columns=["col1", "col2"])
```

### 2.5 MultiIndex and Pivot Operations

```python
import pandas as pd
import numpy as np

# --- MultiIndex ---
arrays = [
    ["Tokyo", "Tokyo", "Osaka", "Osaka", "Nagoya", "Nagoya"],
    ["2023Q1", "2023Q2", "2023Q1", "2023Q2", "2023Q1", "2023Q2"],
]
index = pd.MultiIndex.from_arrays(arrays, names=["city", "quarter"])

df = pd.DataFrame({
    "revenue": [100, 120, 80, 90, 60, 70],
    "profit": [30, 35, 20, 25, 15, 18],
}, index=index)

# Accessing MultiIndex
print(df.loc["Tokyo"])               # All data for Tokyo
print(df.loc[("Tokyo", "2023Q1")])   # Tokyo Q1
print(df.xs("2023Q1", level="quarter"))  # Q1 across all cities

# --- Pivot table ---
sales_data = pd.DataFrame({
    "date": pd.date_range("2024-01-01", periods=100, freq="D"),
    "product": np.random.choice(["A", "B", "C"], 100),
    "region": np.random.choice(["Kanto", "Kansai", "Kyushu"], 100),
    "amount": np.random.randint(1000, 10000, 100),
    "quantity": np.random.randint(1, 50, 100),
})

# Pivot table
pivot = pd.pivot_table(
    sales_data,
    values="amount",
    index="product",
    columns="region",
    aggfunc=["sum", "mean", "count"],
    margins=True,           # Add total row/column
    margins_name="Total",
)
print(pivot)

# --- Cross-tabulation ---
cross = pd.crosstab(
    sales_data["product"],
    sales_data["region"],
    values=sales_data["amount"],
    aggfunc="sum",
    margins=True,
)
print(cross)

# --- stack / unstack ---
stacked = df.stack()       # Columns → rows (wide to long)
unstacked = stacked.unstack(level="city")  # Rows → columns (long to wide)

# --- melt (wide → long conversion) ---
wide_df = pd.DataFrame({
    "name": ["Alice", "Bob"],
    "math": [90, 85],
    "english": [80, 92],
    "science": [88, 78],
})
long_df = wide_df.melt(
    id_vars=["name"],
    value_vars=["math", "english", "science"],
    var_name="subject",
    value_name="score",
)
print(long_df)
```

### 2.6 String Operations and Categorical Data

```python
import pandas as pd

# --- String operations (.str accessor) ---
df = pd.DataFrame({
    "full_name": ["Taro Tanaka", "Hanako Sato", "Ichiro Suzuki", "Misaki Takahashi"],
    "email": ["tanaka@example.com", "SATO@Example.COM", "suzuki@test.org", "takahashi@example.com"],
    "phone": ["090-1234-5678", "080-2345-6789", "070-3456-7890", "090-4567-8901"],
    "address": ["1-2-3 Shibuya, Tokyo", "4-5-6 Kita-ku, Osaka", "7-8-9 Shinjuku, Tokyo", "10-11-12 Hakata-ku, Fukuoka"],
})

# String methods
df["last_name"] = df["full_name"].str.split(" ").str[0]
df["first_name"] = df["full_name"].str.split(" ").str[1]
df["email_lower"] = df["email"].str.lower()
df["email_domain"] = df["email"].str.split("@").str[1].str.lower()
df["phone_clean"] = df["phone"].str.replace("-", "", regex=False)
df["is_tokyo"] = df["address"].str.contains("Tokyo", regex=False)

# Regular expressions
df["city"] = df["address"].str.extract(r",\s*(.+)$")

# --- Handling categorical data ---
# Ordered categories
satisfaction = pd.Categorical(
    ["Satisfied", "Neutral", "Dissatisfied", "Satisfied", "Very Satisfied"],
    categories=["Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
    ordered=True,
)
s = pd.Series(satisfaction)
print(s > "Neutral")  # Comparison operations are supported

# Memory efficiency of categories
large_series = pd.Series(["A", "B", "C"] * 100000)
print(f"object type: {large_series.memory_usage(deep=True) / 1e6:.1f} MB")
print(f"category type: {large_series.astype('category').memory_usage(deep=True) / 1e6:.1f} MB")
```

### 2.7 Complete Guide to Join Operations

```python
import pandas as pd

# --- merge (equivalent to SQL JOIN) ---
orders = pd.DataFrame({
    "order_id": [1, 2, 3, 4, 5],
    "customer_id": [101, 102, 101, 103, 104],
    "amount": [5000, 3000, 7000, 2000, 6000],
})

customers = pd.DataFrame({
    "customer_id": [101, 102, 103, 105],
    "name": ["Tanaka", "Sato", "Suzuki", "Takahashi"],
    "region": ["Tokyo", "Osaka", "Tokyo", "Fukuoka"],
})

# INNER JOIN (only rows present in both)
inner = orders.merge(customers, on="customer_id", how="inner")

# LEFT JOIN (based on the left table)
left = orders.merge(customers, on="customer_id", how="left")

# OUTER JOIN (keep all rows)
outer = orders.merge(customers, on="customer_id", how="outer", indicator=True)
print(outer["_merge"].value_counts())

# --- When keys have different names ---
df1 = pd.DataFrame({"id_left": [1, 2], "val": [10, 20]})
df2 = pd.DataFrame({"id_right": [1, 2], "val2": [30, 40]})
merged = df1.merge(df2, left_on="id_left", right_on="id_right")

# --- concat (stacking and combining) ---
df_a = pd.DataFrame({"col1": [1, 2], "col2": [3, 4]})
df_b = pd.DataFrame({"col1": [5, 6], "col2": [7, 8]})

# Vertical concatenation
vertical = pd.concat([df_a, df_b], axis=0, ignore_index=True)

# Horizontal concatenation
horizontal = pd.concat([df_a, df_b], axis=1)

# --- Conditional join (merge_asof: nearest neighbor join) ---
# Nearest neighbor matching for time series data
trades = pd.DataFrame({
    "time": pd.to_datetime(["2024-01-01 09:01:00", "2024-01-01 09:05:30"]),
    "price": [100, 102],
})
quotes = pd.DataFrame({
    "time": pd.to_datetime(["2024-01-01 09:00:00", "2024-01-01 09:03:00",
                            "2024-01-01 09:05:00"]),
    "bid": [99, 101, 101.5],
})
result = pd.merge_asof(trades, quotes, on="time", direction="backward")
print(result)
```

### 2.8 apply and Fast Alternatives

```python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "a": np.random.randn(100000),
    "b": np.random.randn(100000),
    "c": np.random.choice(["X", "Y", "Z"], 100000),
})

# --- apply is a last resort ---
# BAD: apply (slow due to Python-level loops)
# result = df.apply(lambda row: row["a"] ** 2 + row["b"] ** 2, axis=1)

# GOOD: Vectorized operations (100x or more faster)
result = df["a"] ** 2 + df["b"] ** 2

# --- Vectorizing conditional branches ---
# BAD
# df["label"] = df.apply(lambda row: "high" if row["a"] > 1 else "low", axis=1)

# GOOD: np.where
df["label"] = np.where(df["a"] > 1, "high", "low")

# GOOD: np.select (multiple conditions)
conditions = [
    df["a"] > 1,
    df["a"] > 0,
    df["a"] > -1,
]
choices = ["very_high", "high", "medium"]
df["grade"] = np.select(conditions, choices, default="low")

# --- groupby + transform ---
# Normalize within groups
df["a_group_normalized"] = df.groupby("c")["a"].transform(
    lambda x: (x - x.mean()) / x.std()
)

# --- pipe: function pipeline ---
def add_features(df):
    return df.assign(
        ab_product=df["a"] * df["b"],
        ab_ratio=df["a"] / (df["b"] + 1e-8),
    )

def filter_outliers(df, col="a", n_std=3):
    mean, std = df[col].mean(), df[col].std()
    return df[(df[col] > mean - n_std * std) & (df[col] < mean + n_std * std)]

result = (
    df
    .pipe(add_features)
    .pipe(filter_outliers, col="a", n_std=3)
)
```

---

## 3. scikit-learn — ML Pipelines

### 3.1 scikit-learn API Design

```
Consistent scikit-learn API:

  All Estimators
  ├── fit(X, y)           # Train
  ├── predict(X)          # Predict
  ├── score(X, y)         # Evaluate
  └── get_params()        # Get parameters

  Transformers additionally have:
  ├── transform(X)        # Transform
  └── fit_transform(X)    # Train + transform

  Connected with Pipeline:
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ Scaler   │──>│ PCA      │──>│ Model    │
  │(transform)│  │(transform)│  │(estimator)│
  │fit       │   │fit       │   │fit       │
  │transform │   │transform │   │predict   │
  └──────────┘   └──────────┘   └──────────┘
```

### 3.2 Data Preprocessing

```python
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler,
    LabelEncoder, OrdinalEncoder, OneHotEncoder,
    PolynomialFeatures, PowerTransformer, QuantileTransformer,
    FunctionTransformer,
)
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
import numpy as np
import pandas as pd

# --- Comparing scaling methods ---
X = np.array([[1, 10], [2, 20], [3, 30], [100, 40]])

# StandardScaler: mean 0, standard deviation 1
standard = StandardScaler().fit_transform(X)

# MinMaxScaler: scale to range 0–1
minmax = MinMaxScaler().fit_transform(X)

# RobustScaler: scaling using median and IQR (robust to outliers)
robust = RobustScaler().fit_transform(X)

# PowerTransformer: transform to approximate normal distribution
power = PowerTransformer(method="yeo-johnson").fit_transform(X)

# QuantileTransformer: transform to uniform or normal distribution
quantile = QuantileTransformer(output_distribution="normal").fit_transform(X)

print("StandardScaler:\n", standard)
print("RobustScaler:\n", robust)

# --- Missing value imputation ---
X_missing = np.array([[1, 2], [np.nan, 3], [7, np.nan], [4, 5]])

# Simple imputation
simple = SimpleImputer(strategy="median").fit_transform(X_missing)

# KNN imputation (estimate from neighboring data)
knn_imp = KNNImputer(n_neighbors=2).fit_transform(X_missing)

# --- Text features ---
corpus = [
    "Introduction to machine learning fundamentals",
    "Deep learning and neural networks",
    "Applications of natural language processing",
    "Image recognition with machine learning",
]

# TF-IDF
tfidf = TfidfVectorizer(max_features=100)
X_tfidf = tfidf.fit_transform(corpus)
print(f"TF-IDF shape: {X_tfidf.shape}")
print(f"Feature names: {tfidf.get_feature_names_out()[:10]}")

# --- Custom transformation ---
log_transformer = FunctionTransformer(np.log1p, inverse_func=np.expm1)
X_log = log_transformer.fit_transform(np.array([[1], [10], [100], [1000]]))
```

### 3.3 Building Pipelines

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import GridSearchCV
import pandas as pd
import numpy as np

# Sample data
df = pd.DataFrame({
    "area": [50, 70, 90, 120, 60, np.nan, 80, 100],
    "rooms": [2, 3, 3, 4, 2, 3, np.nan, 4],
    "location": ["urban", "suburban", "urban", "urban", "suburban", "suburban", "urban", "suburban"],
    "age_years": [5, 10, 3, 1, 20, 15, 8, 12],
    "price": [5000, 4000, 7000, 9000, 3500, 3000, 6000, 4500],
})

X = df.drop(columns=["price"])
y = df["price"]

# Different preprocessing for numeric and categorical columns
numeric_features = ["area", "rooms", "age_years"]
categorical_features = ["location"]

numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot", OneHotEncoder(drop="first", handle_unknown="ignore")),
])

preprocessor = ColumnTransformer(transformers=[
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features),
])

# Integrated pipeline of preprocessing + model
pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("regressor", GradientBoostingRegressor(random_state=42)),
])

# Hyperparameter search
param_grid = {
    "regressor__n_estimators": [50, 100, 200],
    "regressor__max_depth": [3, 5, 7],
    "regressor__learning_rate": [0.01, 0.1, 0.3],
}

grid = GridSearchCV(pipeline, param_grid, cv=3, scoring="neg_mean_squared_error")
grid.fit(X, y)

print(f"Best parameters: {grid.best_params_}")
print(f"Best score (neg MSE): {grid.best_score_:.2f}")
```

### 3.4 Cross-Validation and Evaluation Metrics

```python
from sklearn.model_selection import (
    cross_val_score, cross_validate, StratifiedKFold,
    RepeatedStratifiedKFold, LeaveOneOut, TimeSeriesSplit,
)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix,
    mean_squared_error, mean_absolute_error, r2_score,
    roc_auc_score, roc_curve, precision_recall_curve,
    make_scorer,
)
from sklearn.datasets import make_classification, make_regression
from sklearn.ensemble import RandomForestClassifier
import numpy as np

# --- Cross-validation for classification tasks ---
X, y = make_classification(n_samples=1000, n_features=20, n_informative=10,
                           n_classes=2, random_state=42)
model = RandomForestClassifier(n_estimators=100, random_state=42)

# Basic cross-validation
scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
print(f"Accuracy: {scores.mean():.4f} ± {scores.std():.4f}")

# Calculate multiple metrics simultaneously
cv_results = cross_validate(
    model, X, y, cv=5,
    scoring=["accuracy", "precision", "recall", "f1", "roc_auc"],
    return_train_score=True,
)
for metric in ["accuracy", "precision", "recall", "f1", "roc_auc"]:
    test_key = f"test_{metric}"
    train_key = f"train_{metric}"
    print(f"{metric:12s}: train={cv_results[train_key].mean():.4f} "
          f"test={cv_results[test_key].mean():.4f}")

# --- Stratified K-Fold (preserves class ratios) ---
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
    model.fit(X[train_idx], y[train_idx])
    score = model.score(X[val_idx], y[val_idx])
    print(f"Fold {fold+1}: {score:.4f}")

# --- Cross-validation for time series data ---
tscv = TimeSeriesSplit(n_splits=5)
X_ts, y_ts = make_regression(n_samples=200, n_features=5, random_state=42)

for fold, (train_idx, val_idx) in enumerate(tscv.split(X_ts)):
    print(f"Fold {fold+1}: train={len(train_idx)}, val={len(val_idx)}")

# --- Detailed classification report ---
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Class 0", "Class 1"]))

print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)
print(f"\nConfusion Matrix:\n{cm}")

# --- Custom scorer ---
def custom_metric(y_true, y_pred):
    """Custom metric that penalizes false negatives twice as much"""
    fp = np.sum((y_pred == 1) & (y_true == 0))
    fn = np.sum((y_pred == 0) & (y_true == 1))
    tp = np.sum((y_pred == 1) & (y_true == 1))
    return tp / (tp + fp + 2 * fn + 1e-8)

custom_scorer = make_scorer(custom_metric, greater_is_better=True)
scores = cross_val_score(model, X, y, cv=5, scoring=custom_scorer)
print(f"\nCustom metric: {scores.mean():.4f}")
```

### 3.5 Feature Selection

```python
from sklearn.feature_selection import (
    SelectKBest, f_classif, mutual_info_classif,
    RFE, RFECV,
    SequentialFeatureSelector,
    VarianceThreshold,
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
import numpy as np
import pandas as pd

X, y = make_classification(n_samples=500, n_features=30, n_informative=10,
                           n_redundant=5, n_repeated=5, random_state=42)

feature_names = [f"feature_{i}" for i in range(X.shape[1])]

# --- Variance-based filtering ---
# Remove features with near-zero variance
selector_var = VarianceThreshold(threshold=0.01)
X_filtered = selector_var.fit_transform(X)
print(f"Variance filtering: {X.shape[1]} → {X_filtered.shape[1]} features")

# --- Statistical test-based selection ---
# Selection by F-score
selector_f = SelectKBest(f_classif, k=10)
X_f = selector_f.fit_transform(X, y)
f_scores = pd.Series(selector_f.scores_, index=feature_names)
print("\nTop 10 by F-score:")
print(f_scores.nlargest(10))

# Selection by mutual information
selector_mi = SelectKBest(mutual_info_classif, k=10)
X_mi = selector_mi.fit_transform(X, y)
mi_scores = pd.Series(selector_mi.scores_, index=feature_names)
print("\nTop 10 by mutual information:")
print(mi_scores.nlargest(10))

# --- RFE (Recursive Feature Elimination) ---
model = RandomForestClassifier(n_estimators=100, random_state=42)
rfe = RFE(model, n_features_to_select=10, step=1)
rfe.fit(X, y)
selected = [f for f, s in zip(feature_names, rfe.support_) if s]
print(f"\nRFE selected features: {selected}")

# --- RFECV (RFE with cross-validation) ---
rfecv = RFECV(model, step=1, cv=5, scoring="accuracy", min_features_to_select=5)
rfecv.fit(X, y)
print(f"\nOptimal number of features: {rfecv.n_features_}")
print(f"Best score: {rfecv.cv_results_['mean_test_score'].max():.4f}")

# --- Feature importance (model-based) ---
model.fit(X, y)
importances = pd.Series(model.feature_importances_, index=feature_names)
print("\nTop 10 feature importances:")
print(importances.nlargest(10))

# --- Removing redundant features using correlation matrix ---
def remove_correlated(X, threshold=0.9):
    """Remove one feature from each highly correlated pair"""
    corr_matrix = pd.DataFrame(X).corr().abs()
    upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
    to_drop = [col for col in upper.columns if any(upper[col] > threshold)]
    return np.delete(X, to_drop, axis=1), to_drop

X_uncorr, dropped = remove_correlated(X, threshold=0.9)
print(f"\nCorrelation removal: {X.shape[1]} → {X_uncorr.shape[1]} features ({len(dropped)} columns dropped)")
```

### 3.6 Creating Custom Transformers

```python
from sklearn.base import BaseEstimator, TransformerMixin
import numpy as np
import pandas as pd

class OutlierClipper(BaseEstimator, TransformerMixin):
    """IQR-based outlier clipping transformer"""

    def __init__(self, factor: float = 1.5):
        self.factor = factor

    def fit(self, X, y=None):
        X = np.array(X)
        Q1 = np.percentile(X, 25, axis=0)
        Q3 = np.percentile(X, 75, axis=0)
        IQR = Q3 - Q1
        self.lower_ = Q1 - self.factor * IQR
        self.upper_ = Q3 + self.factor * IQR
        return self

    def transform(self, X):
        X = np.array(X).copy()
        X = np.clip(X, self.lower_, self.upper_)
        return X

class FeatureInteraction(BaseEstimator, TransformerMixin):
    """Transformer that adds feature interaction terms"""

    def __init__(self, interaction_pairs=None):
        self.interaction_pairs = interaction_pairs

    def fit(self, X, y=None):
        if self.interaction_pairs is None:
            n_features = X.shape[1]
            from itertools import combinations
            self.interaction_pairs = list(combinations(range(n_features), 2))
        return self

    def transform(self, X):
        X = np.array(X)
        interactions = []
        for i, j in self.interaction_pairs:
            interactions.append((X[:, i] * X[:, j]).reshape(-1, 1))
        return np.hstack([X] + interactions)


class DateFeatureExtractor(BaseEstimator, TransformerMixin):
    """Transformer that extracts features from a date column"""

    def __init__(self, date_column: str, features=None):
        self.date_column = date_column
        self.features = features or [
            "year", "month", "day", "dayofweek",
            "quarter", "is_weekend", "day_of_year"
        ]

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()
        dt = pd.to_datetime(X[self.date_column])

        result = pd.DataFrame(index=X.index)
        feature_map = {
            "year": dt.year,
            "month": dt.month,
            "day": dt.day,
            "dayofweek": dt.dayofweek,
            "quarter": dt.quarter,
            "is_weekend": dt.dayofweek.isin([5, 6]).astype(int),
            "day_of_year": dt.dayofyear,
            "week_of_year": dt.isocalendar().week.astype(int),
        }

        for feat in self.features:
            if feat in feature_map:
                result[f"{self.date_column}_{feat}"] = feature_map[feat]

        # Drop the original date column and return
        other_cols = X.drop(columns=[self.date_column])
        return pd.concat([other_cols, result], axis=1)


class TargetEncoder(BaseEstimator, TransformerMixin):
    """Target encoding transformer (with leak prevention)"""

    def __init__(self, columns=None, smoothing: float = 10.0):
        self.columns = columns
        self.smoothing = smoothing

    def fit(self, X, y=None):
        X = pd.DataFrame(X).copy()
        y = pd.Series(y)
        self.global_mean_ = y.mean()
        self.encoding_map_ = {}

        cols = self.columns or X.select_dtypes(include=["object", "category"]).columns

        for col in cols:
            agg = y.groupby(X[col]).agg(["mean", "count"])
            # Smoothing: categories with few samples are pulled toward the global mean
            smooth = (agg["count"] * agg["mean"] + self.smoothing * self.global_mean_) / \
                     (agg["count"] + self.smoothing)
            self.encoding_map_[col] = smooth.to_dict()

        return self

    def transform(self, X):
        X = pd.DataFrame(X).copy()
        for col, mapping in self.encoding_map_.items():
            X[col] = X[col].map(mapping).fillna(self.global_mean_)
        return X


# Using in a pipeline
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor

pipeline = Pipeline([
    ("clipper", OutlierClipper(factor=1.5)),
    ("interaction", FeatureInteraction()),
    ("scaler", StandardScaler()),
    ("model", GradientBoostingRegressor()),
])
```

### 3.7 Hyperparameter Optimization

```python
from sklearn.model_selection import (
    GridSearchCV, RandomizedSearchCV,
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.datasets import make_classification
from scipy.stats import randint, uniform, loguniform
import numpy as np

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

# --- GridSearchCV (exhaustive search over all combinations) ---
param_grid = {
    "n_estimators": [50, 100, 200],
    "max_depth": [3, 5, 7, None],
    "min_samples_split": [2, 5, 10],
}
grid = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid, cv=5, scoring="f1", n_jobs=-1, verbose=1,
)
grid.fit(X, y)
print(f"Grid best: {grid.best_params_}, score: {grid.best_score_:.4f}")

# --- RandomizedSearchCV (random search, suited for large parameter spaces) ---
param_distributions = {
    "n_estimators": randint(50, 500),
    "max_depth": randint(3, 20),
    "min_samples_split": randint(2, 20),
    "min_samples_leaf": randint(1, 10),
    "max_features": uniform(0.1, 0.9),
}
random_search = RandomizedSearchCV(
    RandomForestClassifier(random_state=42),
    param_distributions, n_iter=100, cv=5, scoring="f1",
    n_jobs=-1, random_state=42, verbose=1,
)
random_search.fit(X, y)
print(f"Random best: {random_search.best_params_}, score: {random_search.best_score_:.4f}")

# --- Optuna (Bayesian optimization, requires pip install optuna) ---
"""
import optuna

def objective(trial):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 50, 500),
        "max_depth": trial.suggest_int("max_depth", 3, 20),
        "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
        "learning_rate": trial.suggest_float("learning_rate", 1e-4, 1.0, log=True),
    }
    model = GradientBoostingClassifier(**params, random_state=42)
    scores = cross_val_score(model, X, y, cv=5, scoring="f1")
    return scores.mean()

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=100)

print(f"Optuna best: {study.best_params}")
print(f"Score: {study.best_value:.4f}")
"""

# --- Analyzing results ---
import pandas as pd
results = pd.DataFrame(grid.cv_results_)
print("\nTop 5 parameter combinations:")
top5 = results.nsmallest(5, "rank_test_score")[
    ["params", "mean_test_score", "std_test_score", "rank_test_score"]
]
print(top5.to_string())
```

### 3.8 Saving and Loading Models

```python
import joblib
import json
from datetime import datetime
from pathlib import Path

def save_model(pipeline, metrics: dict, output_dir: str = "models/"):
    """Save the model and associated information"""
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = f"{output_dir}/model_{timestamp}.joblib"
    meta_path = f"{output_dir}/model_{timestamp}_meta.json"

    # Save the model itself
    joblib.dump(pipeline, model_path)

    # Save metadata
    meta = {
        "timestamp": timestamp,
        "model_type": type(pipeline.named_steps.get("regressor",
                          pipeline.named_steps.get("model"))).__name__,
        "metrics": metrics,
        "sklearn_version": __import__("sklearn").__version__,
        "python_version": __import__("platform").python_version(),
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"Model saved: {model_path}")
    print(f"Metadata: {meta_path}")
    return model_path

def load_model(model_path: str):
    """Load and validate the model"""
    pipeline = joblib.load(model_path)
    meta_path = model_path.replace(".joblib", "_meta.json")

    if Path(meta_path).exists():
        with open(meta_path) as f:
            meta = json.load(f)
        print(f"Model type: {meta['model_type']}")
        print(f"Training timestamp: {meta['timestamp']}")
        print(f"Evaluation metrics: {meta['metrics']}")

    return pipeline


# --- Exporting to ONNX format (for faster inference) ---
"""
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

# sklearn Pipeline → ONNX
initial_type = [("float_input", FloatTensorType([None, X.shape[1]]))]
onnx_model = convert_sklearn(pipeline, initial_types=initial_type)

with open("model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())

# Inference with ONNX Runtime
import onnxruntime as rt
sess = rt.InferenceSession("model.onnx")
pred = sess.run(None, {"float_input": X_test.astype(np.float32)})[0]
"""
```

### 3.9 Ensemble Learning

```python
from sklearn.ensemble import (
    VotingClassifier, VotingRegressor,
    StackingClassifier, StackingRegressor,
    BaggingClassifier, AdaBoostClassifier,
    RandomForestClassifier, GradientBoostingClassifier,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import cross_val_score
import numpy as np

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

# --- Voting ---
voting = VotingClassifier(
    estimators=[
        ("rf", RandomForestClassifier(n_estimators=100, random_state=42)),
        ("gb", GradientBoostingClassifier(n_estimators=100, random_state=42)),
        ("svc", SVC(probability=True, random_state=42)),
    ],
    voting="soft",  # Probability-based voting
    weights=[2, 2, 1],  # Higher weight for RF and GB
)
scores_voting = cross_val_score(voting, X, y, cv=5, scoring="accuracy")
print(f"Voting: {scores_voting.mean():.4f} ± {scores_voting.std():.4f}")

# --- Stacking ---
stacking = StackingClassifier(
    estimators=[
        ("rf", RandomForestClassifier(n_estimators=100, random_state=42)),
        ("gb", GradientBoostingClassifier(n_estimators=100, random_state=42)),
        ("knn", KNeighborsClassifier(n_neighbors=5)),
    ],
    final_estimator=LogisticRegression(),
    cv=5,
    passthrough=False,  # Do not pass original features to meta-learner
)
scores_stacking = cross_val_score(stacking, X, y, cv=5, scoring="accuracy")
print(f"Stacking: {scores_stacking.mean():.4f} ± {scores_stacking.std():.4f}")

# --- Comparison with individual models ---
models = {
    "RandomForest": RandomForestClassifier(n_estimators=100, random_state=42),
    "GradientBoosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
    "SVC": SVC(random_state=42),
    "KNN": KNeighborsClassifier(),
}
for name, model in models.items():
    scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
    print(f"{name:20s}: {scores.mean():.4f} ± {scores.std():.4f}")
```

---

## 4. Matplotlib / Seaborn — Data Visualization

### 4.1 Matplotlib Basic Structure

```python
import matplotlib.pyplot as plt
import numpy as np

# --- Understanding the Figure/Axes structure ---
# matplotlib object hierarchy:
# Figure > Axes > (Line2D, Text, Patch, ...)

# Basic: creating subplots
fig, axes = plt.subplots(2, 2, figsize=(12, 8))

# Top left: line chart
x = np.linspace(0, 2 * np.pi, 100)
axes[0, 0].plot(x, np.sin(x), label="sin(x)", color="blue")
axes[0, 0].plot(x, np.cos(x), label="cos(x)", color="red", linestyle="--")
axes[0, 0].set_title("Trigonometric Functions")
axes[0, 0].legend()
axes[0, 0].grid(True, alpha=0.3)

# Top right: histogram
data = np.random.randn(1000)
axes[0, 1].hist(data, bins=30, color="steelblue", edgecolor="white", alpha=0.7)
axes[0, 1].axvline(data.mean(), color="red", linestyle="--", label=f"Mean={data.mean():.2f}")
axes[0, 1].set_title("Normal Distribution Histogram")
axes[0, 1].legend()

# Bottom left: scatter plot
x = np.random.randn(200)
y = 2 * x + np.random.randn(200) * 0.5
colors = np.random.rand(200)
axes[1, 0].scatter(x, y, c=colors, cmap="viridis", alpha=0.6, s=30)
axes[1, 0].set_title("Scatter Plot")
axes[1, 0].set_xlabel("X")
axes[1, 0].set_ylabel("Y")

# Bottom right: bar chart
categories = ["A", "B", "C", "D", "E"]
values = [23, 45, 56, 78, 32]
bars = axes[1, 1].bar(categories, values, color=["#ff6b6b", "#4ecdc4", "#45b7d1",
                                                   "#96ceb4", "#ffeaa7"])
axes[1, 1].set_title("Bar Chart")
for bar, val in zip(bars, values):
    axes[1, 1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                    str(val), ha="center", fontsize=10)

plt.tight_layout()
plt.savefig("basic_plots.png", dpi=150, bbox_inches="tight")
plt.close()
```

### 4.2 Statistical Visualization with Seaborn

```python
import seaborn as sns
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# Sample data
np.random.seed(42)
n = 300
df = pd.DataFrame({
    "age": np.random.normal(40, 10, n).astype(int),
    "income": np.random.lognormal(11, 0.5, n).astype(int),
    "education": np.random.choice(["High School", "Bachelor's", "Master's"], n, p=[0.3, 0.5, 0.2]),
    "satisfaction": np.random.choice(["Low", "Medium", "High"], n, p=[0.2, 0.5, 0.3]),
})

# Style settings
sns.set_theme(style="whitegrid", font_scale=1.1)

fig, axes = plt.subplots(2, 3, figsize=(18, 10))

# 1. Correlation matrix heatmap
numeric_df = df.select_dtypes(include=[np.number])
sns.heatmap(numeric_df.corr(), annot=True, cmap="RdBu_r", center=0,
            ax=axes[0, 0], fmt=".2f")
axes[0, 0].set_title("Correlation Matrix")

# 2. Box plot by category
sns.boxplot(data=df, x="education", y="income", ax=axes[0, 1],
            order=["High School", "Bachelor's", "Master's"], palette="Set2")
axes[0, 1].set_title("Income Distribution by Education Level")

# 3. Violin plot
sns.violinplot(data=df, x="satisfaction", y="age", ax=axes[0, 2],
               order=["Low", "Medium", "High"], palette="muted", inner="quart")
axes[0, 2].set_title("Age Distribution by Satisfaction Level")

# 4. KDE plot
for edu in ["High School", "Bachelor's", "Master's"]:
    subset = df[df["education"] == edu]["income"]
    sns.kdeplot(subset, ax=axes[1, 0], label=edu, fill=True, alpha=0.3)
axes[1, 0].set_title("Income Density by Education Level")
axes[1, 0].legend()

# 5. Count plot
sns.countplot(data=df, x="education", hue="satisfaction", ax=axes[1, 1],
              order=["High School", "Bachelor's", "Master's"], hue_order=["Low", "Medium", "High"],
              palette="coolwarm")
axes[1, 1].set_title("Education × Satisfaction")

# 6. Scatter plot with regression line
sns.regplot(data=df, x="age", y="income", ax=axes[1, 2],
            scatter_kws={"alpha": 0.3}, line_kws={"color": "red"})
axes[1, 2].set_title("Relationship Between Age and Income")

plt.tight_layout()
plt.savefig("seaborn_analysis.png", dpi=150, bbox_inches="tight")
plt.close()
```

### 4.3 Visualizing ML Results

```python
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    confusion_matrix, ConfusionMatrixDisplay,
    roc_curve, auc, precision_recall_curve,
)
from sklearn.model_selection import learning_curve
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification

# --- Learning curve (overfitting diagnosis) ---
X, y = make_classification(n_samples=1000, n_features=20, random_state=42)
model = RandomForestClassifier(n_estimators=100, random_state=42)

train_sizes, train_scores, val_scores = learning_curve(
    model, X, y, cv=5,
    train_sizes=np.linspace(0.1, 1.0, 10),
    scoring="accuracy", n_jobs=-1,
)

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# Learning curve
axes[0].plot(train_sizes, train_scores.mean(axis=1), "o-", label="Training")
axes[0].plot(train_sizes, val_scores.mean(axis=1), "o-", label="Validation")
axes[0].fill_between(train_sizes,
                     train_scores.mean(axis=1) - train_scores.std(axis=1),
                     train_scores.mean(axis=1) + train_scores.std(axis=1), alpha=0.1)
axes[0].fill_between(train_sizes,
                     val_scores.mean(axis=1) - val_scores.std(axis=1),
                     val_scores.mean(axis=1) + val_scores.std(axis=1), alpha=0.1)
axes[0].set_xlabel("Training Size")
axes[0].set_ylabel("Score")
axes[0].set_title("Learning Curve")
axes[0].legend()
axes[0].grid(True, alpha=0.3)

# ROC curve
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model.fit(X_train, y_train)
y_proba = model.predict_proba(X_test)[:, 1]

fpr, tpr, _ = roc_curve(y_test, y_proba)
roc_auc = auc(fpr, tpr)

axes[1].plot(fpr, tpr, color="darkorange", lw=2, label=f"ROC (AUC = {roc_auc:.3f})")
axes[1].plot([0, 1], [0, 1], color="navy", lw=1, linestyle="--")
axes[1].set_xlabel("False Positive Rate")
axes[1].set_ylabel("True Positive Rate")
axes[1].set_title("ROC Curve")
axes[1].legend()

# Feature importance
importances = model.feature_importances_
indices = np.argsort(importances)[-10:]
axes[2].barh(range(10), importances[indices], color="steelblue")
axes[2].set_yticks(range(10))
axes[2].set_yticklabels([f"feature_{i}" for i in indices])
axes[2].set_title("Top 10 Feature Importances")
axes[2].set_xlabel("Importance")

plt.tight_layout()
plt.savefig("ml_diagnostics.png", dpi=150, bbox_inches="tight")
plt.close()
```

---

## 5. SciPy — Scientific Computing and Statistical Tests

### 5.1 Statistical Tests

```python
from scipy import stats
import numpy as np

np.random.seed(42)

# --- Normality tests ---
data = np.random.normal(100, 15, 200)

# Shapiro-Wilk test (recommended for n < 5000)
stat_sw, p_sw = stats.shapiro(data)
print(f"Shapiro-Wilk: statistic={stat_sw:.4f}, p-value={p_sw:.4f}")

# Kolmogorov-Smirnov test
stat_ks, p_ks = stats.kstest(data, "norm", args=(data.mean(), data.std()))
print(f"KS test: statistic={stat_ks:.4f}, p-value={p_ks:.4f}")

# D'Agostino-Pearson test
stat_dp, p_dp = stats.normaltest(data)
print(f"D'Agostino: statistic={stat_dp:.4f}, p-value={p_dp:.4f}")

# --- Two-sample comparison ---
group_a = np.random.normal(100, 15, 100)
group_b = np.random.normal(105, 15, 120)

# t-test (assumes normal distribution and equal variances)
t_stat, p_value = stats.ttest_ind(group_a, group_b)
print(f"\nt-test: t={t_stat:.4f}, p={p_value:.4f}")

# Welch's t-test (does not assume equal variances)
t_stat_w, p_value_w = stats.ttest_ind(group_a, group_b, equal_var=False)
print(f"Welch's t-test: t={t_stat_w:.4f}, p={p_value_w:.4f}")

# Mann-Whitney U test (non-parametric)
u_stat, p_mw = stats.mannwhitneyu(group_a, group_b, alternative="two-sided")
print(f"Mann-Whitney: U={u_stat:.0f}, p={p_mw:.4f}")

# Effect size (Cohen's d)
def cohens_d(group1, group2):
    n1, n2 = len(group1), len(group2)
    var1, var2 = group1.var(), group2.var()
    pooled_std = np.sqrt(((n1-1)*var1 + (n2-1)*var2) / (n1+n2-2))
    return (group1.mean() - group2.mean()) / pooled_std

d = cohens_d(group_a, group_b)
print(f"Cohen's d: {d:.4f}")

# --- Multiple group comparison (ANOVA) ---
g1 = np.random.normal(100, 15, 50)
g2 = np.random.normal(105, 15, 50)
g3 = np.random.normal(110, 15, 50)

f_stat, p_anova = stats.f_oneway(g1, g2, g3)
print(f"\nANOVA: F={f_stat:.4f}, p={p_anova:.4f}")

# Kruskal-Wallis (non-parametric version of ANOVA)
h_stat, p_kw = stats.kruskal(g1, g2, g3)
print(f"Kruskal-Wallis: H={h_stat:.4f}, p={p_kw:.4f}")

# --- Chi-squared test (test of independence) ---
observed = np.array([[50, 30], [20, 40]])
chi2, p_chi, dof, expected = stats.chi2_contingency(observed)
print(f"\nChi-squared test: χ²={chi2:.4f}, p={p_chi:.4f}, df={dof}")
print(f"Expected frequencies:\n{expected}")
```

### 5.2 Optimization

```python
from scipy.optimize import minimize, curve_fit, minimize_scalar
import numpy as np

# --- Function minimization ---
def rosenbrock(x):
    """Rosenbrock function (optimization benchmark)"""
    return sum(100.0 * (x[1:] - x[:-1]**2.0)**2.0 + (1 - x[:-1])**2.0)

x0 = np.array([0.0, 0.0])  # Initial point
result = minimize(rosenbrock, x0, method="Nelder-Mead")
print(f"Minimum point: {result.x}")
print(f"Minimum value: {result.fun:.6f}")
print(f"Converged: {result.success}")

# Constrained optimization
from scipy.optimize import LinearConstraint, Bounds

# x + y <= 10, x >= 0, y >= 0
result_c = minimize(
    lambda x: (x[0] - 3)**2 + (x[1] - 5)**2,
    x0=[0, 0],
    method="SLSQP",
    constraints={"type": "ineq", "fun": lambda x: 10 - x[0] - x[1]},
    bounds=Bounds(0, np.inf),
)
print(f"\nConstrained optimization: x={result_c.x}, f={result_c.fun:.4f}")

# --- Curve fitting ---
def exp_decay(x, a, b, c):
    return a * np.exp(-b * x) + c

# Generate noisy data
x_data = np.linspace(0, 5, 50)
y_data = 3.0 * np.exp(-1.5 * x_data) + 0.5 + np.random.normal(0, 0.1, 50)

# Fitting
popt, pcov = curve_fit(exp_decay, x_data, y_data, p0=[3, 1, 0.5])
perr = np.sqrt(np.diag(pcov))  # Standard errors of parameters

print(f"\nFitting results:")
print(f"a = {popt[0]:.4f} ± {perr[0]:.4f}")
print(f"b = {popt[1]:.4f} ± {perr[1]:.4f}")
print(f"c = {popt[2]:.4f} ± {perr[2]:.4f}")
```

### 5.3 Interpolation and Splines

```python
from scipy.interpolate import (
    interp1d, CubicSpline, UnivariateSpline,
    RegularGridInterpolator,
)
import numpy as np

# --- 1D interpolation ---
x = np.array([0, 1, 2, 3, 4, 5])
y = np.array([0, 0.8, 0.9, 0.1, -0.8, -1.0])

# Linear interpolation
f_linear = interp1d(x, y, kind="linear")

# Cubic spline interpolation
f_cubic = interp1d(x, y, kind="cubic")

# CubicSpline (more feature-rich)
cs = CubicSpline(x, y)

x_new = np.linspace(0, 5, 100)
y_linear = f_linear(x_new)
y_cubic = f_cubic(x_new)
y_cs = cs(x_new)
y_cs_deriv = cs(x_new, 1)  # First derivative

print(f"Value at x=2.5: linear={f_linear(2.5):.4f}, cubic={f_cubic(2.5):.4f}")
print(f"Derivative at x=2.5: {cs(2.5, 1):.4f}")

# --- 2D interpolation ---
x_grid = np.linspace(0, 4, 5)
y_grid = np.linspace(0, 4, 5)
values = np.random.rand(5, 5)

interpolator = RegularGridInterpolator((x_grid, y_grid), values)
result = interpolator(point)
print(f"\n2D interpolation at (2.1, 3.3): {result[0]:.4f}")
```

---

## 6. Practical Patterns

### 6.1 Project Structure Template

```
ml-project/
├── data/
│   ├── raw/                  # Raw data (do not modify)
│   ├── processed/            # Processed data
│   └── external/             # External data
├── notebooks/
│   ├── 01_eda.ipynb          # Exploratory data analysis
│   ├── 02_feature_eng.ipynb  # Feature engineering
│   └── 03_modeling.ipynb     # Modeling experiments
├── src/
│   ├── __init__.py
│   ├── data/
│   │   ├── __init__.py
│   │   ├── loader.py         # Data loading
│   │   └── preprocessor.py   # Preprocessing
│   ├── features/
│   │   ├── __init__.py
│   │   └── builder.py        # Feature generation
│   ├── models/
│   │   ├── __init__.py
│   │   ├── trainer.py        # Training
│   │   └── predictor.py      # Inference
│   └── utils/
│       ├── __init__.py
│       └── metrics.py        # Evaluation metrics
├── tests/
│   ├── test_data.py
│   ├── test_features.py
│   └── test_models.py
├── models/                   # Trained models
├── configs/
│   └── config.yaml           # Hyperparameters, etc.
├── Makefile
├── pyproject.toml
└── README.md
```

### 6.2 Configuration Management

```python
# configs/config.yaml
"""
data:
  raw_path: data/raw/train.csv
  test_path: data/raw/test.csv
  target_column: price

features:
  numeric_columns:
    - area
    - rooms
    - age_years
  categorical_columns:
    - location
    - building_type

model:
  type: gradient_boosting
  params:
    n_estimators: 200
    max_depth: 5
    learning_rate: 0.1
    random_state: 42

training:
  test_size: 0.2
  cv_folds: 5
  scoring: neg_mean_squared_error
"""

# src/config.py
from dataclasses import dataclass, field
from pathlib import Path
import yaml


@dataclass
class DataConfig:
    raw_path: str
    test_path: str
    target_column: str


@dataclass
class FeatureConfig:
    numeric_columns: list
    categorical_columns: list


@dataclass
class ModelConfig:
    type: str
    params: dict = field(default_factory=dict)


@dataclass
class TrainingConfig:
    test_size: float = 0.2
    cv_folds: int = 5
    scoring: str = "neg_mean_squared_error"


@dataclass
class Config:
    data: DataConfig
    features: FeatureConfig
    model: ModelConfig
    training: TrainingConfig

    @classmethod
    def from_yaml(cls, path: str) -> "Config":
        with open(path) as f:
            raw = yaml.safe_load(f)
        return cls(
            data=DataConfig(**raw["data"]),
            features=FeatureConfig(**raw["features"]),
            model=ModelConfig(**raw["model"]),
            training=TrainingConfig(**raw["training"]),
        )


# Usage example
# config = Config.from_yaml("configs/config.yaml")
# print(config.model.params)
```

### 6.3 Testing ML Pipelines

```python
import pytest
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier


class TestPipeline:
    """Test suite for the ML pipeline"""

    @pytest.fixture
    def sample_data(self):
        """Data for testing"""
        np.random.seed(42)
        X = pd.DataFrame({
            "feature_1": np.random.randn(100),
            "feature_2": np.random.randn(100),
            "feature_3": np.random.randn(100),
        })
        y = (X["feature_1"] + X["feature_2"] > 0).astype(int)
        return X, y

    @pytest.fixture
    def pipeline(self):
        """Pipeline for testing"""
        return Pipeline([
            ("scaler", StandardScaler()),
            ("model", RandomForestClassifier(n_estimators=10, random_state=42)),
        ])

    def test_pipeline_fit_predict(self, pipeline, sample_data):
        """Pipeline trains and predicts correctly"""
        X, y = sample_data
        pipeline.fit(X, y)
        predictions = pipeline.predict(X)
        assert len(predictions) == len(y)
        assert set(predictions).issubset({0, 1})

    def test_pipeline_accuracy(self, pipeline, sample_data):
        """Pipeline achieves minimum accuracy"""
        X, y = sample_data
        pipeline.fit(X, y)
        accuracy = pipeline.score(X, y)
        assert accuracy > 0.7, f"Accuracy too low: {accuracy:.4f}"

    def test_pipeline_predict_proba(self, pipeline, sample_data):
        """Probability predictions have the correct output format"""
        X, y = sample_data
        pipeline.fit(X, y)
        proba = pipeline.predict_proba(X)
        assert proba.shape == (len(X), 2)
        assert np.allclose(proba.sum(axis=1), 1.0)
        assert (proba >= 0).all() and (proba <= 1).all()

    def test_pipeline_unseen_data(self, pipeline, sample_data):
        """Pipeline can predict on unseen data"""
        X, y = sample_data
        pipeline.fit(X, y)
        X_new = pd.DataFrame({
            "feature_1": [0.5, -0.5],
            "feature_2": [1.0, -1.0],
            "feature_3": [0.0, 0.0],
        })
        predictions = pipeline.predict(X_new)
        assert len(predictions) == 2

    def test_scaler_transform(self, sample_data):
        """StandardScaler transforms correctly"""
        X, _ = sample_data
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        assert np.allclose(X_scaled.mean(axis=0), 0, atol=1e-10)
        assert np.allclose(X_scaled.std(axis=0), 1, atol=1e-10)

    def test_feature_names_preserved(self, pipeline, sample_data):
        """Feature names are preserved"""
        X, y = sample_data
        pipeline.fit(X, y)
        # get_feature_names_out is available in sklearn 1.0+
        scaler = pipeline.named_steps["scaler"]
        assert hasattr(scaler, "feature_names_in_")
        assert list(scaler.feature_names_in_) == list(X.columns)
```

### 6.4 Experiment Tracking (MLflow)

```python
"""
Basic patterns for experiment management with MLflow

pip install mlflow
"""

# import mlflow
# import mlflow.sklearn
# from sklearn.ensemble import RandomForestClassifier
# from sklearn.model_selection import cross_val_score
# from sklearn.datasets import make_classification
# import numpy as np

# --- MLflow experiment management template ---
"""
# Configure the experiment
mlflow.set_experiment("my-classification-experiment")

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

# Parameter candidates
configs = [
    {"n_estimators": 100, "max_depth": 5},
    {"n_estimators": 200, "max_depth": 7},
    {"n_estimators": 300, "max_depth": 10},
]

for config in configs:
    with mlflow.start_run():
        # Log parameters
        mlflow.log_params(config)

        # Train and evaluate the model
        model = RandomForestClassifier(**config, random_state=42)
        scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")

        # Log metrics
        mlflow.log_metric("accuracy_mean", scores.mean())
        mlflow.log_metric("accuracy_std", scores.std())

        # Save the model
        model.fit(X, y)
        mlflow.sklearn.log_model(model, "model")

        print(f"Config: {config}")
        print(f"  Accuracy: {scores.mean():.4f} ± {scores.std():.4f}")

# View results: mlflow ui
"""

# --- Custom lightweight experiment tracker ---
import json
from datetime import datetime
from pathlib import Path
import hashlib


class ExperimentTracker:
    """Lightweight experiment management tool"""

    def __init__(self, experiment_name: str, base_dir: str = "experiments"):
        self.experiment_name = experiment_name
        self.base_dir = Path(base_dir) / experiment_name
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.runs = []

    def log_run(self, params: dict, metrics: dict, tags: dict = None):
        """Record experiment results"""
        run = {
            "run_id": hashlib.md5(
                json.dumps(params, sort_keys=True).encode()
            ).hexdigest()[:8],
            "timestamp": datetime.now().isoformat(),
            "params": params,
            "metrics": metrics,
            "tags": tags or {},
        }
        self.runs.append(run)

        # Save to individual file
        run_path = self.base_dir / f"run_{run['run_id']}.json"
        with open(run_path, "w") as f:
            json.dump(run, f, indent=2, ensure_ascii=False)

        return run["run_id"]

    def get_best_run(self, metric: str, mode: str = "max"):
        """Get the best experiment result"""
        if not self.runs:
            return None
        key = max if mode == "max" else min
        return key(self.runs, key=lambda r: r["metrics"].get(metric, float("-inf")))

    def summary(self):
        """Display a summary of all experiments"""
        import pandas as pd
        if not self.runs:
            print("No experiment results found")
            return

        rows = []
        for run in self.runs:
            row = {"run_id": run["run_id"], **run["params"], **run["metrics"]}
            rows.append(row)

        df = pd.DataFrame(rows)
        print(df.to_string(index=False))
        return df


# Usage example
# tracker = ExperimentTracker("my-experiment")
# tracker.log_run(
#     params={"n_estimators": 100, "max_depth": 5},
#     metrics={"accuracy": 0.92, "f1": 0.90},
#     tags={"model": "RandomForest"},
# )
# tracker.summary()
```

---

## Comparison Tables

### NumPy vs pandas vs Polars

| Item | NumPy | pandas | Polars |
|---|---|---|---|
| Data type | Homogeneous multi-dimensional array | Heterogeneous tabular | Heterogeneous tabular |
| Speed | Very fast (C/Fortran) | Medium | Fast (Rust) |
| Memory efficiency | High | Moderate | High |
| Lazy evaluation | No | No | Yes (LazyFrame) |
| API | Low-level | High-level | High-level |
| Main use cases | Numerical computing, linear algebra | Data wrangling, EDA | Large-scale data processing |
| Learning curve | Moderate | Low | Moderate |
| Ecosystem | Vast | Very vast | Growing |
| GPU support | CuPy integration | None | GPU version in development |
| Multi-threading | Limited | GIL constraints | Native support |

### scikit-learn Model Selection Cheat Sheet

| Data conditions | Recommended model | Training speed | Interpretability | Accuracy |
|---|---|---|---|---|
| Small-scale, linear relationship | LinearRegression / LogisticRegression | Very fast | High | Medium |
| Medium-scale, non-linear | RandomForest | Fast | Moderate | High |
| Medium-scale, high accuracy | GradientBoosting | Moderate | Low | High |
| Large-scale, high-dimensional | SGDClassifier | Very fast | Moderate | Medium |
| Text classification | MultinomialNB | Very fast | Moderate | Medium |
| Small data, high accuracy | SVM (RBF kernel) | Slow | Low | High |
| Outlier detection | IsolationForest | Fast | Low | Medium~High |
| Clustering | KMeans / DBSCAN | Fast | Moderate | — |
| Dimensionality reduction | PCA / t-SNE / UMAP | Moderate | Low | — |

### Preprocessing Method Selection Guide

| Data characteristics | Recommended scaling | Reason |
|---|---|---|
| Approximately normally distributed | StandardScaler | Standardize to mean 0, std dev 1 |
| Range is important (0-1) | MinMaxScaler | Scale by min-max values |
| Many outliers | RobustScaler | Robust scaling using median and IQR |
| Skewed distribution | PowerTransformer | Box-Cox/Yeo-Johnson transformation |
| Want uniform distribution | QuantileTransformer | Quantile-based transformation |
| Categorical (nominal) | OneHotEncoder | Dummy variable encoding |
| Categorical (ordinal) | OrdinalEncoder | Numeric encoding preserving order |
| High-cardinality categorical | TargetEncoder | Encode using mean of target values |

---

## Anti-Patterns

### Anti-Pattern 1: Loop Processing in pandas

```python
# BAD: Processing row by row with iterrows (extremely slow)
for idx, row in df.iterrows():
    df.loc[idx, "new_col"] = row["a"] * row["b"] + row["c"]

# GOOD: Use vectorized operations
df["new_col"] = df["a"] * df["b"] + df["c"]

# GOOD: For complex conditions, use np.where or apply
df["category"] = np.where(df["value"] > 100, "high", "low")
```

### Anti-Pattern 2: Not Using Pipeline for Preprocessing

```python
# BAD: Preprocessing and model are separate → risk of forgetting transformation at test time
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
model = RandomForestClassifier()
model.fit(X_train_s, y_train)
# High risk of forgetting scaler.transform() at test time

# GOOD: Integrate with Pipeline
from sklearn.pipeline import make_pipeline
pipe = make_pipeline(StandardScaler(), RandomForestClassifier())
pipe.fit(X_train, y_train)        # Preprocessing + training in one step
score = pipe.score(X_test, y_test) # Preprocessing + prediction in one step
```

### Anti-Pattern 3: Data Leakage

```python
# BAD: fit_transform on all data before splitting (data leakage)
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

X_scaled = StandardScaler().fit_transform(X)  # Test data info leaks into training!
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y)

# GOOD: fit only on training data after splitting
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)   # fit on training data
X_test_scaled = scaler.transform(X_test)          # only transform on test data

# BEST: Using Pipeline structurally prevents leakage
from sklearn.pipeline import make_pipeline
pipe = make_pipeline(StandardScaler(), RandomForestClassifier())
# fit/transform are correctly separated inside cross_val_score
scores = cross_val_score(pipe, X, y, cv=5)
```

### Anti-Pattern 4: Inappropriate Evaluation Metrics

```python
# BAD: Evaluating only accuracy on imbalanced data
# With class ratio 95:5, always predicting the majority class gives accuracy=95%
from sklearn.metrics import accuracy_score
print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")  # Looks high superficially

# GOOD: Check multiple metrics for imbalanced data
from sklearn.metrics import classification_report, balanced_accuracy_score
print(classification_report(y_test, y_pred))
print(f"Balanced Accuracy: {balanced_accuracy_score(y_test, y_pred):.4f}")

# GOOD: Train with class weights
from sklearn.ensemble import RandomForestClassifier
model = RandomForestClassifier(class_weight="balanced", random_state=42)
# Or specify explicitly: class_weight={0: 1, 1: 10}
```

### Anti-Pattern 5: Lack of Reproducibility

```python
# BAD: Not fixing seeds
model = RandomForestClassifier()  # Different results every time
X_train, X_test = train_test_split(X, y)  # Split is different every time too

# GOOD: Set seeds for all random elements
import numpy as np
SEED = 42
np.random.seed(SEED)

model = RandomForestClassifier(random_state=SEED)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=SEED, stratify=y
)

# BEST: Manage seed centrally in config file
# config.yaml → seed: 42
```

---

## FAQ

### Q1: Should I use pandas or Polars?

**A:** As of 2024, pandas has a vastly broader ecosystem and integrates seamlessly with scikit-learn and matplotlib. Polars shines when data exceeds 1 million rows or when speed is critical. For new projects with large data, consider Polars; otherwise, pandas is the safe choice. Note that pandas 2.0+ now supports an Arrow backend, narrowing the performance gap. Polars' lazy evaluation (LazyFrame) enables automatic query plan optimization, giving it a significant speed advantage for large-scale data processing.

### Q2: How far can I customize the scikit-learn Pipeline?

**A:** Any transformer can be created by inheriting from BaseEstimator + TransformerMixin. ColumnTransformer applies different processing per column, and FeatureUnion combines features. Combined with NestedCV and custom scorers, nearly any ML workflow can be expressed with Pipeline. Additionally, `set_output(transform="pandas")` maintains DataFrame output, making debugging easier.

### Q3: How should I choose between Jupyter notebooks and Python scripts?

**A:** Use Notebooks for exploration, visualization, and reporting; use scripts for production pipelines and test code. The ideal workflow is to experiment in notebooks, then move confirmed code to modules under `src/`. Since notebooks are hard to manage with Git, strip cell outputs with nbstripout before committing. Using papermill, notebooks can be parameterized and automatically executed as report generation pipelines.

### Q4: How do I switch between NumPy and CuPy?

**A:** CuPy provides a NumPy-compatible API, and much code runs on GPU simply by writing `import cupy as np`. However, data transfer overhead means CPU (NumPy) can be faster for small data. Use `cupy.asnumpy()` and `cupy.asarray()` for explicit conversion. The cuML library provides GPU-accelerated ML models with the same API as scikit-learn.

### Q5: What is a systematic approach to feature engineering?

**A:** The following steps are effective: (1) design features based on domain knowledge, (2) compute basic statistics (mean, variance, skewness, kurtosis), (3) generate interaction features, (4) add polynomial features, (5) for time series: lag and rolling statistics, (6) encode categorical variables, (7) apply dimensionality reduction (PCA, etc.). Then use feature selection (RFE, importance-based) to remove unnecessary features. Automated feature generation libraries like Featuretools are also worth considering.

### Q6: What should I do when I run out of memory processing large data?

**A:** There are several progressive approaches: (1) dtype optimization (float64→float32, int64→int16, etc.), (2) converting categorical columns to category type, (3) chunk processing (`pd.read_csv(chunksize=N)`), (4) column-oriented reading with Parquet format, (5) distributed DataFrame processing with Dask, (6) lazy evaluation with Polars, (7) memory-mapped processing with Vaex. Using databases (SQLite, DuckDB) as an intermediate layer is also effective. DuckDB can directly query Parquet files with SQL and integrates well with pandas.

### Q7: When should I use XGBoost/LightGBM instead of scikit-learn?

**A:** For tabular data prediction tasks, XGBoost and LightGBM are often faster and more accurate than scikit-learn's GradientBoosting. They are recommended especially when: (1) data is large (100k+ rows), (2) there are many categorical features (LightGBM has native category support), (3) there are many missing values (native missing value support), (4) competing in Kaggle or similar competitions. However, integration with scikit-learn's Pipeline/GridSearchCV is straightforward (sklearn API-compatible wrappers exist), so a practical approach is to implement in scikit-learn first, then switch to XGBoost/LightGBM if performance is insufficient.

---

## Summary

| Item | Key Points |
|---|---|
| NumPy | Speed up with vectorized operations. Avoid loops, leverage broadcasting |
| pandas | Improve readability with method chaining. Optimize types for large data |
| scikit-learn | Build reproducible workflows with Pipeline + ColumnTransformer |
| Matplotlib/Seaborn | Seaborn for exploratory analysis, Matplotlib for fine customization |
| SciPy | Foundation for scientific computing: statistical tests, optimization, interpolation |
| Model saving | Save with joblib. Record metadata (version, metrics) alongside |
| Custom transformers | Integrate custom preprocessing into Pipeline with BaseEstimator + TransformerMixin |
| Feature selection | Select progressively: statistical tests → RFE → importance |
| Experiment management | Ensure reproducibility with MLflow or a lightweight tracker |
| Testing | Always test pipeline I/O, accuracy, and edge cases |

---

## Next Guides to Read

- [../01-classical-ml/00-regression.md](../01-classical-ml/00-regression.md) — Implementing and evaluating regression models
- [../01-classical-ml/01-classification.md](../01-classical-ml/01-classification.md) — Implementing and evaluating classification models

---

## References

1. **Jake VanderPlas** "Python Data Science Handbook" O'Reilly Media, 2016 — https://jakevdp.github.io/PythonDataScienceHandbook/
2. **scikit-learn Documentation** "API Reference" — https://scikit-learn.org/stable/modules/classes.html
3. **Wes McKinney** "Python for Data Analysis" 3rd Edition, O'Reilly Media, 2022
4. **NumPy Documentation** "NumPy User Guide" — https://numpy.org/doc/stable/user/
5. **SciPy Documentation** "SciPy Reference Guide" — https://docs.scipy.org/doc/scipy/reference/
6. **Matplotlib Documentation** "Tutorials" — https://matplotlib.org/stable/tutorials/
7. **Seaborn Documentation** "Tutorial" — https://seaborn.pydata.org/tutorial.html
8. **Aurélien Géron** "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow" 3rd Edition, O'Reilly Media, 2022
