# Data Preprocessing — Missing Values, Normalization, and Feature Engineering

> A comprehensive guide to transforming raw data into a form that machine learning models can consume

## What You Will Learn

1. **Missing value handling** — Analyzing missing patterns and choosing the right imputation strategy
2. **Scaling and normalization** — When to use StandardScaler, MinMaxScaler, and RobustScaler
3. **Categorical variable encoding** — Implementing one-hot, target, and frequency encoding
4. **Feature engineering** — Designing and auto-generating features using domain knowledge
5. **Outlier handling** — Practical techniques for detection, removal, and transformation
6. **Data quality management** — Validation, pipeline construction, and reproducibility


## Prerequisites

Having the following knowledge before reading this guide will help you get more out of it:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [AI Analysis Overview — The Big Picture of Data Science and ML](./00-ai-analysis-overview.md)

---

## 1. Analyzing and Handling Missing Values

### Classifying Missing Patterns

```
Missing Data Mechanisms (Rubin, 1976)
┌──────────────────────────────────────────────────────┐
│                                                      │
│  MCAR (Missing Completely at Random)                 │
│  ├── Missingness is entirely random                  │
│  ├── Example: Temporary sensor failure               │
│  └── Response: Listwise deletion causes no bias      │
│                                                      │
│  MAR (Missing at Random)                             │
│  ├── Missingness depends on other observed variables │
│  ├── Example: Older respondents skip income question │
│  └── Response: Multiple imputation is effective      │
│                                                      │
│  MNAR (Missing Not at Random)                        │
│  ├── Missingness depends on the missing value itself │
│  ├── Example: High earners hide their income         │
│  └── Response: Domain-knowledge-based modeling needed│
│                                                      │
└──────────────────────────────────────────────────────┘

Testing for MCAR:
  Little's MCAR test:
    H0: Data is MCAR
    p > 0.05 → Judged as MCAR (deletion acceptable)
    p ≤ 0.05 → MAR or MNAR (imputation preferred)
```

### Code Example 1: Visualizing and Analyzing Missing Values

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

def analyze_missing(df: pd.DataFrame) -> pd.DataFrame:
    """Generate a detailed missing-value analysis report"""
    missing = df.isnull().sum()
    missing_pct = (missing / len(df)) * 100

    report = pd.DataFrame({
        "Missing Count": missing,
        "Missing Rate (%)": missing_pct.round(2),
        "Data Type": df.dtypes,
        "Unique Count": df.nunique(),
        "Non-Missing Count": df.notnull().sum(),
    })
    report = report[report["Missing Count"] > 0].sort_values("Missing Rate (%)", ascending=False)

    # Add recommended actions
    actions = []
    for _, row in report.iterrows():
        pct = row["Missing Rate (%)"]
        if pct > 80:
            actions.append("Recommend dropping column")
        elif pct > 50:
            actions.append("Model-based imputation or drop")
        elif pct > 10:
            actions.append("KNN/MICE imputation")
        elif pct > 5:
            actions.append("Median/mode imputation")
        else:
            actions.append("Simple imputation sufficient")
    report["Recommended Action"] = actions

    return report

def plot_missing_heatmap(df: pd.DataFrame) -> None:
    """Draw a heatmap of missing patterns"""
    fig, axes = plt.subplots(1, 2, figsize=(18, 6))

    # Left: heatmap of missing patterns
    sns.heatmap(df.isnull(), cbar=True, yticklabels=False,
                cmap="viridis", ax=axes[0])
    axes[0].set_title("Missing Value Pattern (yellow = missing)")

    # Right: bar chart of missing rate per column
    missing_pct = (df.isnull().sum() / len(df) * 100).sort_values(ascending=True)
    missing_pct = missing_pct[missing_pct > 0]
    if len(missing_pct) > 0:
        missing_pct.plot(kind="barh", ax=axes[1], color="coral")
        axes[1].set_xlabel("Missing Rate (%)")
        axes[1].set_title("Missing Rate per Column")
        axes[1].axvline(x=50, color="red", linestyle="--", alpha=0.5, label="50% line")
        axes[1].legend()
    else:
        axes[1].text(0.5, 0.5, "No missing values", ha="center", va="center",
                     fontsize=14, transform=axes[1].transAxes)

    plt.tight_layout()
    plt.savefig("reports/missing_analysis.png", dpi=150)
    plt.close()

def analyze_missing_correlations(df: pd.DataFrame) -> pd.DataFrame:
    """Analyze correlations among missing values (discovering co-occurrence patterns)"""
    missing_cols = df.columns[df.isnull().any()].tolist()
    if len(missing_cols) < 2:
        print("Fewer than 2 columns with missing values; correlation analysis not possible")
        return pd.DataFrame()

    missing_indicator = df[missing_cols].isnull().astype(int)
    corr = missing_indicator.corr()

    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r",
                center=0, ax=ax, vmin=-1, vmax=1)
    ax.set_title("Missing Value Correlation Matrix")
    plt.tight_layout()
    plt.savefig("reports/missing_correlation.png", dpi=150)
    plt.close()

    return corr

# Usage example
np.random.seed(42)
n = 1000
df = pd.DataFrame({
    "age": np.random.normal(40, 15, n),
    "income": np.random.lognormal(10, 1, n),
    "education_years": np.random.randint(6, 20, n).astype(float),
    "satisfaction": np.random.normal(3.5, 1, n),
    "city": np.random.choice(["Tokyo", "Osaka", "Fukuoka", "Nagoya"], n),
})

# Create realistic missing patterns
# MAR: younger people are less likely to report income
mask_income = (df["age"] < 30) & (np.random.random(n) < 0.3)
df.loc[mask_income, "income"] = np.nan

# MCAR: random missingness
mask_age = np.random.random(n) < 0.05
df.loc[mask_age, "age"] = np.nan

# Co-occurring missingness: if satisfaction is missing, education_years is also more likely to be missing
mask_sat = np.random.random(n) < 0.1
df.loc[mask_sat, "satisfaction"] = np.nan
df.loc[mask_sat & (np.random.random(n) < 0.7), "education_years"] = np.nan

report = analyze_missing(df)
print(report)
plot_missing_heatmap(df)
```

### Code Example 2: Missing Value Imputation Strategies

```python
import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.ensemble import RandomForestRegressor

class MissingValueHandler:
    """Unified class for missing value handling"""

    def __init__(self, strategy: str = "auto"):
        self.strategy = strategy
        self.imputers = {}
        self.missing_flags = []

    def fit_transform(self, df: pd.DataFrame,
                      add_indicator: bool = True) -> pd.DataFrame:
        """Analyze missing values and apply appropriate imputation

        Parameters
        ----------
        df : pd.DataFrame
            Input dataframe
        add_indicator : bool
            Whether to add missing-flag columns (default: True)
        """
        result = df.copy()

        for col in df.columns:
            if df[col].isnull().sum() == 0:
                continue

            missing_rate = df[col].isnull().mean()

            # Add a missing-flag column (useful when missingness itself carries information)
            if add_indicator and missing_rate > 0.01:
                result[f"{col}_is_missing"] = df[col].isnull().astype(int)
                self.missing_flags.append(f"{col}_is_missing")

            # Missing rate >= 80% → recommend dropping the column
            if missing_rate > 0.8:
                print(f"WARNING: {col}: missing rate {missing_rate:.0%} → recommend dropping column")
                result.drop(columns=[col], inplace=True)
                continue

            if pd.api.types.is_numeric_dtype(df[col]):
                if missing_rate < 0.05:
                    # Low missingness → impute with median
                    median_val = df[col].median()
                    result[col].fillna(median_val, inplace=True)
                    self.imputers[col] = ("median", median_val)
                elif missing_rate < 0.30:
                    # Moderate missingness → KNN imputation
                    imputer = KNNImputer(n_neighbors=5, weights="distance")
                    numeric_cols = df.select_dtypes(include="number").columns.tolist()
                    result[numeric_cols] = imputer.fit_transform(df[numeric_cols])
                    self.imputers[col] = ("knn", imputer)
                else:
                    # High missingness → iterative imputation (equivalent to MICE)
                    imputer = IterativeImputer(
                        estimator=RandomForestRegressor(
                            n_estimators=50, random_state=42
                        ),
                        max_iter=10, random_state=42
                    )
                    numeric_cols = df.select_dtypes(include="number").columns.tolist()
                    result[numeric_cols] = imputer.fit_transform(df[numeric_cols])
                    self.imputers[col] = ("iterative", imputer)
            else:
                # Categorical variable → mode or "Unknown"
                mode_val = df[col].mode()[0] if not df[col].mode().empty else "Unknown"
                result[col].fillna(mode_val, inplace=True)
                self.imputers[col] = ("mode", mode_val)

        return result

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform new data using learned imputation parameters"""
        result = df.copy()

        for col, (strategy, param) in self.imputers.items():
            if col not in df.columns:
                continue

            if strategy == "median":
                result[col].fillna(param, inplace=True)
            elif strategy == "mode":
                result[col].fillna(param, inplace=True)
            elif strategy in ("knn", "iterative"):
                numeric_cols = df.select_dtypes(include="number").columns.tolist()
                result[numeric_cols] = param.transform(df[numeric_cols])

        # Add missing-flag columns
        for flag_col in self.missing_flags:
            orig_col = flag_col.replace("_is_missing", "")
            if orig_col in df.columns:
                result[flag_col] = df[orig_col].isnull().astype(int)

        return result

    def report(self) -> None:
        """Display a report of imputation strategies"""
        print("=" * 60)
        print("Missing Value Imputation Report")
        print("=" * 60)
        for col, (strategy, param) in self.imputers.items():
            if strategy == "median":
                print(f"  {col}: median imputation (value={param:.2f})")
            elif strategy == "mode":
                print(f"  {col}: mode imputation (value={param})")
            elif strategy == "knn":
                print(f"  {col}: KNN imputation (k=5, distance-weighted)")
            elif strategy == "iterative":
                print(f"  {col}: iterative imputation (RandomForest, max_iter=10)")
        if self.missing_flags:
            print(f"\n  Missing flag columns added: {len(self.missing_flags)}")

handler = MissingValueHandler()
df_clean = handler.fit_transform(df)
handler.report()
print(f"\nBefore imputation: {df.shape}, After imputation: {df_clean.shape}")
print(f"Remaining missing values: {df_clean.isnull().sum().sum()}")
```

### Code Example 2b: Implementing Multiple Imputation

```python
import numpy as np
import pandas as pd
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.linear_model import BayesianRidge
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score

def multiple_imputation(df, n_imputations=5, random_state=42):
    """Multiple imputation to estimate inference uncertainty

    Performs imputation multiple times and evaluates inference
    uncertainty from the variability of results.
    """
    imputed_datasets = []

    for i in range(n_imputations):
        imputer = IterativeImputer(
            estimator=BayesianRidge(),
            max_iter=20,
            random_state=random_state + i,
            sample_posterior=True  # Sample from posterior distribution
        )
        numeric_cols = df.select_dtypes(include="number").columns
        imputed = df.copy()
        imputed[numeric_cols] = imputer.fit_transform(df[numeric_cols])
        imputed_datasets.append(imputed)

    return imputed_datasets

def pool_results(imputed_datasets, col):
    """Pool results using Rubin's rules

    Combines multiple imputation results to compute point estimates
    and confidence intervals.
    """
    m = len(imputed_datasets)
    estimates = [ds[col].values for ds in imputed_datasets]

    # Point estimate: mean of per-dataset means
    Q_bar = np.mean([np.mean(est) for est in estimates])

    # Within-imputation variance (mean of within-dataset variances)
    W = np.mean([np.var(est) for est in estimates])

    # Between-imputation variance
    B = np.var([np.mean(est) for est in estimates])

    # Total variance (Rubin's rules)
    T = W + (1 + 1/m) * B

    # Confidence interval
    se = np.sqrt(T)
    ci_lower = Q_bar - 1.96 * se
    ci_upper = Q_bar + 1.96 * se

    print(f"Multiple imputation results for column '{col}':")
    print(f"  Point estimate: {Q_bar:.4f}")
    print(f"  Standard error: {se:.4f}")
    print(f"  95% confidence interval: [{ci_lower:.4f}, {ci_upper:.4f}]")
    print(f"  Within-variance: {W:.4f}")
    print(f"  Between-variance: {B:.4f}")

    return Q_bar, se, (ci_lower, ci_upper)

# Usage example
# imputed_datasets = multiple_imputation(df, n_imputations=10)
# pool_results(imputed_datasets, "income")
```

---

## 2. Scaling and Normalization

### Scaling Method Processing Flow

```
Raw data               After transformation
┌─────────┐
│ x=1000  │  StandardScaler     z = (x - μ) / σ
│ x=2000  │ ──────────────────> mean=0, std=1
│ x=5000  │
│ x=100   │  MinMaxScaler       z = (x - min) / (max - min)
│         │ ──────────────────> range [0, 1]
│         │
│ outliers│  RobustScaler       z = (x - Q2) / (Q3 - Q1)
│ present │ ──────────────────> median=0, IQR-based
│         │
│ positive│  Log transform      z = log(1 + x)
│ skew    │ ──────────────────> reduces skewness
│         │
│ extreme │  PowerTransformer   z = ((x^λ - 1) / λ)  (Box-Cox)
│ non-norm│ ──────────────────> approximates normal distribution
│         │
│ vector  │  Normalizer         z = x / ||x||₂
│ length  │ ──────────────────> L2 norm=1 (row-wise)
└─────────┘

Decision flow for choosing a method:
  Outliers present? → Yes → RobustScaler
                   → No  → Distribution skewed?
                             → Yes → PowerTransformer / Log transform
                             → No  → Distance-based model?
                                       → Yes → StandardScaler
                                       → No  → MinMaxScaler or as-is
```

### Code Example 3: Comparing Scaling Methods

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler,
    MaxAbsScaler, PowerTransformer, QuantileTransformer,
    Normalizer
)

def compare_scalers(data: np.ndarray, feature_name: str = "feature") -> pd.DataFrame:
    """Compare results from each scaling method"""
    scalers = {
        "Original data": None,
        "StandardScaler": StandardScaler(),
        "MinMaxScaler": MinMaxScaler(),
        "RobustScaler": RobustScaler(),
        "MaxAbsScaler": MaxAbsScaler(),
        "PowerTransformer\n(Yeo-Johnson)": PowerTransformer(method="yeo-johnson"),
        "QuantileTransformer\n(normal dist.)": QuantileTransformer(
            output_distribution="normal", random_state=42
        ),
    }

    results = {}
    fig, axes = plt.subplots(len(scalers), 1, figsize=(12, 3 * len(scalers)))

    for idx, (name, scaler) in enumerate(scalers.items()):
        if scaler is None:
            scaled = data
        else:
            scaled = scaler.fit_transform(data.reshape(-1, 1)).flatten()

        results[name] = {
            "Mean": np.mean(scaled).round(3),
            "Std Dev": np.std(scaled).round(3),
            "Min": np.min(scaled).round(3),
            "Max": np.max(scaled).round(3),
            "Median": np.median(scaled).round(3),
            "Skewness": pd.Series(scaled).skew().round(3),
        }

        axes[idx].hist(scaled, bins=50, edgecolor="black", alpha=0.7)
        axes[idx].set_title(f"{name}: mean={np.mean(scaled):.2f}, "
                           f"std={np.std(scaled):.2f}")
        axes[idx].axvline(x=np.mean(scaled), color="red", linestyle="--")

    plt.tight_layout()
    plt.savefig("reports/scaler_comparison.png", dpi=150)
    plt.close()

    return pd.DataFrame(results).T

# Right-skewed data with outliers
np.random.seed(42)
data_skewed = np.concatenate([
    np.random.lognormal(3, 1, 1000),  # Normal data
    np.array([5000, 8000, 10000])     # Outliers
])
print(compare_scalers(data_skewed, "income"))
```

### Code Example 3b: Automating Scaler Selection

```python
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler, PowerTransformer
)

class AutoScaler:
    """Automatically select a scaling method based on data characteristics"""

    def __init__(self, outlier_threshold: float = 3.0,
                 skew_threshold: float = 1.0):
        self.outlier_threshold = outlier_threshold
        self.skew_threshold = skew_threshold
        self.scalers = {}
        self.selected_methods = {}

    def _has_outliers(self, x: np.ndarray) -> bool:
        """Detect outliers using the IQR method"""
        q1, q3 = np.percentile(x[~np.isnan(x)], [25, 75])
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        return np.any((x < lower) | (x > upper))

    def _is_skewed(self, x: np.ndarray) -> bool:
        """Check skewness"""
        skewness = stats.skew(x[~np.isnan(x)])
        return abs(skewness) > self.skew_threshold

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply the optimal scaling to each column"""
        result = df.copy()
        numeric_cols = df.select_dtypes(include="number").columns

        for col in numeric_cols:
            x = df[col].dropna().values

            if len(x) == 0:
                continue

            has_outliers = self._has_outliers(x)
            is_skewed = self._is_skewed(x)

            if has_outliers and is_skewed:
                scaler = PowerTransformer(method="yeo-johnson")
                method = "PowerTransformer (outliers + skew)"
            elif has_outliers:
                scaler = RobustScaler()
                method = "RobustScaler (outliers)"
            elif is_skewed:
                scaler = PowerTransformer(method="yeo-johnson")
                method = "PowerTransformer (skew)"
            else:
                scaler = StandardScaler()
                method = "StandardScaler (standard)"

            result[col] = scaler.fit_transform(
                df[col].values.reshape(-1, 1)
            ).flatten()

            self.scalers[col] = scaler
            self.selected_methods[col] = method

        return result

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform using learned scalers"""
        result = df.copy()
        for col, scaler in self.scalers.items():
            if col in df.columns:
                result[col] = scaler.transform(
                    df[col].values.reshape(-1, 1)
                ).flatten()
        return result

    def report(self):
        """Report on selected scaling methods"""
        print("=" * 60)
        print("AutoScaler Selection Report")
        print("=" * 60)
        for col, method in self.selected_methods.items():
            print(f"  {col:25s}: {method}")

# Usage example
auto_scaler = AutoScaler()
df_scaled = auto_scaler.fit_transform(df_clean.select_dtypes(include="number"))
auto_scaler.report()
```

---

## 3. Categorical Variable Encoding

### Taxonomy of Encoding Methods

```
Categorical variable encoding methods:

  ┌────────────────────────────────────────────┐
  │ Cardinality (number of unique values)       │
  └──────────────────┬───────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ Low (< 10-15)           │ High (≥ 15)
        ├─────────────────────────┤─────────────────────────
        │                        │
        │ ┌────────────────┐     │ ┌─────────────────────┐
        │ │ OneHotEncoding │     │ │ TargetEncoding      │
        │ │ Safe, standard │     │ │ Target statistics   │
        │ └────────────────┘     │ └─────────────────────┘
        │                        │
        │ ┌────────────────┐     │ ┌─────────────────────┐
        │ │ OrdinalEncoding│     │ │ FrequencyEncoding   │
        │ │ When order     │     │ │ Replace with freq.  │
        │ │ exists         │     │ └─────────────────────┘
        │ └────────────────┘     │
        │                        │ ┌─────────────────────┐
        │ ┌────────────────┐     │ │ HashEncoding        │
        │ │ BinaryEncoding │     │ │ Fixed dim via hash  │
        │ │ Binary repr.   │     │ └─────────────────────┘
        │ └────────────────┘     │
        │                        │ ┌─────────────────────┐
        │                        │ │ Embedding           │
        │                        │ │ Low-dim repr for NN │
        │                        │ └─────────────────────┘
```

### Code Example 4: Implementing Encoding Methods

```python
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder, OneHotEncoder
from sklearn.model_selection import KFold

class CategoryEncoder:
    """Unified class for categorical variable encoding"""

    def __init__(self):
        self.encoders = {}

    def label_encode(self, series: pd.Series) -> pd.Series:
        """Label encoding (unordered binary or ordered)"""
        le = LabelEncoder()
        encoded = le.fit_transform(series.astype(str))
        self.encoders[series.name] = ("label", le)
        return pd.Series(encoded, name=series.name, index=series.index)

    def ordinal_encode(self, series: pd.Series,
                       order: list) -> pd.Series:
        """Ordinal encoding (specify an explicit order)

        Parameters
        ----------
        series : pd.Series
            Target to encode
        order : list
            Ordered list (e.g., ["low", "medium", "high"])
        """
        mapping = {val: idx for idx, val in enumerate(order)}
        encoded = series.map(mapping)
        self.encoders[series.name] = ("ordinal", mapping)
        return encoded

    def onehot_encode(self, df: pd.DataFrame, col: str,
                      drop_first: bool = True,
                      max_categories: int = 15) -> pd.DataFrame:
        """One-hot encoding (nominal variables)"""
        n_unique = df[col].nunique()
        if n_unique > max_categories:
            print(f"WARNING: {col} cardinality={n_unique} is high. "
                  f"TargetEncoding recommended.")

        dummies = pd.get_dummies(df[col], prefix=col, drop_first=drop_first)
        result = pd.concat([df.drop(columns=[col]), dummies], axis=1)
        self.encoders[col] = ("onehot", None)
        return result

    def target_encode(self, df: pd.DataFrame, col: str,
                      target: str, smoothing: float = 10.0) -> pd.DataFrame:
        """Target encoding (for high-cardinality variables)

        Uses smoothing to prevent overfitting on categories with few samples.
        """
        global_mean = df[target].mean()
        agg = df.groupby(col)[target].agg(["mean", "count"])

        # Bayesian smoothing
        smooth = (agg["count"] * agg["mean"] + smoothing * global_mean) / \
                 (agg["count"] + smoothing)

        result = df.copy()
        result[f"{col}_target_enc"] = result[col].map(smooth)
        # Handle unknown categories
        result[f"{col}_target_enc"].fillna(global_mean, inplace=True)
        self.encoders[col] = ("target", {
            "mapping": smooth.to_dict(),
            "global_mean": global_mean
        })
        return result

    def target_encode_cv(self, df: pd.DataFrame, col: str,
                         target: str, n_splits: int = 5) -> pd.DataFrame:
        """CV-based target encoding (leak-prevention version)

        Performs target encoding separately for each fold of
        cross-validation to prevent data leakage.
        """
        result = df.copy()
        result[f"{col}_target_enc_cv"] = np.nan

        kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
        global_mean = df[target].mean()

        for train_idx, val_idx in kf.split(df):
            train = df.iloc[train_idx]
            agg = train.groupby(col)[target].mean()
            result.iloc[val_idx, result.columns.get_loc(f"{col}_target_enc_cv")] = \
                df.iloc[val_idx][col].map(agg)

        result[f"{col}_target_enc_cv"].fillna(global_mean, inplace=True)
        return result

    def frequency_encode(self, df: pd.DataFrame, col: str) -> pd.DataFrame:
        """Frequency encoding (replace with occurrence frequency)"""
        freq = df[col].value_counts(normalize=True)
        result = df.copy()
        result[f"{col}_freq_enc"] = result[col].map(freq)
        result[f"{col}_freq_enc"].fillna(0, inplace=True)
        self.encoders[col] = ("frequency", freq.to_dict())
        return result

    def binary_encode(self, df: pd.DataFrame, col: str) -> pd.DataFrame:
        """Binary encoding (binary representation)"""
        le = LabelEncoder()
        encoded = le.fit_transform(df[col].astype(str))
        n_bits = int(np.ceil(np.log2(len(le.classes_) + 1)))

        binary_cols = []
        for bit in range(n_bits):
            col_name = f"{col}_bin_{bit}"
            df_copy = df.copy() if bit == 0 else result
            binary_cols.append(col_name)

        result = df.copy()
        for bit in range(n_bits):
            col_name = f"{col}_bin_{bit}"
            result[col_name] = ((encoded >> bit) & 1).astype(int)

        result.drop(columns=[col], inplace=True)
        return result

# Usage example
df = pd.DataFrame({
    "city": ["Tokyo", "Osaka", "Tokyo", "Fukuoka", "Osaka", "Tokyo", "Nagoya", "Fukuoka"],
    "size": ["S", "M", "L", "M", "S", "L", "XL", "M"],
    "price": [100, 80, 120, 70, 85, 130, 140, 75]
})

encoder = CategoryEncoder()

# Nominal variable: one-hot
df_encoded = encoder.onehot_encode(df, "city")

# Ordinal variable: ordinal encoding
df_encoded["size_ord"] = encoder.ordinal_encode(
    df["size"], order=["S", "M", "L", "XL"]
)

# High cardinality: target encoding
df_encoded = encoder.target_encode(df_encoded, "size", "price")

# Frequency encoding
df_freq = encoder.frequency_encode(df, "city")

print("Encoding results:")
print(df_encoded.head())
print(f"\nFrequency encoding:")
```

---

## 4. Outlier Detection and Handling

### Outlier Detection Methods

```
Classification of outlier detection methods:

  Statistical methods:
    ├── Z-Score: |z| > 3 is an outlier (assumes normal distribution)
    ├── IQR: values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR
    ├── Modified Z-Score: MAD (median absolute deviation)-based (robust)
    └── Grubbs test: outlier detection via null-hypothesis testing

  Machine learning methods:
    ├── Isolation Forest: isolation score via random splits
    ├── Local Outlier Factor (LOF): detection based on local density
    ├── One-Class SVM: distance from hyperplane trained on normal data
    └── DBSCAN: noise points detected as outliers

  Domain knowledge:
    └── Business-rule thresholds (e.g., age < 0 or > 150)
```

### Code Example: Outlier Detection and Handling

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
import matplotlib.pyplot as plt

class OutlierHandler:
    """Outlier detection and handling"""

    def __init__(self):
        self.outlier_info = {}

    def detect_iqr(self, series: pd.Series,
                    multiplier: float = 1.5) -> pd.Series:
        """Outlier detection using the IQR method"""
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - multiplier * iqr
        upper = q3 + multiplier * iqr

        is_outlier = (series < lower) | (series > upper)
        n_outliers = is_outlier.sum()

        self.outlier_info[series.name] = {
            "method": "IQR",
            "lower_bound": lower,
            "upper_bound": upper,
            "n_outliers": n_outliers,
            "pct_outliers": n_outliers / len(series) * 100
        }

        print(f"  {series.name}: {n_outliers} outliers "
              f"({n_outliers/len(series)*100:.1f}%), "
              f"range=[{lower:.2f}, {upper:.2f}]")

        return is_outlier

    def detect_zscore(self, series: pd.Series,
                       threshold: float = 3.0) -> pd.Series:
        """Outlier detection using the Z-Score method"""
        z = (series - series.mean()) / series.std()
        is_outlier = z.abs() > threshold
        return is_outlier

    def detect_modified_zscore(self, series: pd.Series,
                                threshold: float = 3.5) -> pd.Series:
        """Modified Z-Score method (MAD-based, robust)"""
        median = series.median()
        mad = np.median(np.abs(series - median))
        modified_z = 0.6745 * (series - median) / (mad + 1e-10)
        is_outlier = modified_z.abs() > threshold
        return is_outlier

    def detect_isolation_forest(self, df: pd.DataFrame,
                                 contamination: float = 0.05) -> np.ndarray:
        """Multivariate outlier detection using Isolation Forest"""
        numeric_cols = df.select_dtypes(include="number").columns
        iso_forest = IsolationForest(
            contamination=contamination,
            random_state=42, n_jobs=-1
        )
        labels = iso_forest.fit_predict(df[numeric_cols].fillna(0))
        is_outlier = labels == -1
        print(f"  Isolation Forest: {is_outlier.sum()} outliers "
              f"({is_outlier.sum()/len(df)*100:.1f}%)")
        return is_outlier

    def handle_outliers(self, df: pd.DataFrame, col: str,
                         method: str = "clip",
                         detection: str = "iqr") -> pd.DataFrame:
        """Handle outliers

        Parameters
        ----------
        method : str
            "clip": clip to upper/lower bounds
            "remove": drop rows with outliers
            "nan": replace outliers with NaN (impute later)
            "winsorize": winsorization (cap at percentiles)
            "log": log transform (for positively skewed data)
        """
        result = df.copy()

        if detection == "iqr":
            is_outlier = self.detect_iqr(result[col])
        elif detection == "zscore":
            is_outlier = self.detect_zscore(result[col])
        elif detection == "modified_zscore":
            is_outlier = self.detect_modified_zscore(result[col])
        else:
            raise ValueError(f"Unknown detection method: {detection}")

        if method == "clip":
            info = self.outlier_info.get(col, {})
            lower = info.get("lower_bound", result[col].quantile(0.01))
            upper = info.get("upper_bound", result[col].quantile(0.99))
            result[col] = result[col].clip(lower=lower, upper=upper)
        elif method == "remove":
            result = result[~is_outlier]
        elif method == "nan":
            result.loc[is_outlier, col] = np.nan
        elif method == "winsorize":
            lower = result[col].quantile(0.01)
            upper = result[col].quantile(0.99)
            result[col] = result[col].clip(lower=lower, upper=upper)
        elif method == "log":
            result[col] = np.log1p(result[col].clip(lower=0))

        return result

    def visualize_outliers(self, df: pd.DataFrame,
                           columns: list = None) -> None:
        """Visualize outliers"""
        if columns is None:
            columns = df.select_dtypes(include="number").columns.tolist()

        n_cols = min(3, len(columns))
        n_rows = (len(columns) + n_cols - 1) // n_cols

        fig, axes = plt.subplots(n_rows, n_cols, figsize=(5 * n_cols, 4 * n_rows))
        if n_rows == 1 and n_cols == 1:
            axes = np.array([axes])
        axes = axes.ravel()

        for idx, col in enumerate(columns):
            if idx >= len(axes):
                break
            axes[idx].boxplot(df[col].dropna(), vert=True)
            axes[idx].set_title(f"{col}")
            axes[idx].grid(True, alpha=0.3)

        for idx in range(len(columns), len(axes)):
            axes[idx].set_visible(False)

        plt.tight_layout()
        plt.savefig("reports/outlier_boxplots.png", dpi=150)
        plt.close()

# Usage example
outlier_handler = OutlierHandler()
# df_clean = outlier_handler.handle_outliers(df, "income", method="clip")
# outlier_handler.visualize_outliers(df, ["age", "income", "satisfaction"])
```

---

## 5. Feature Engineering

### Taxonomy of Feature Engineering

```
Classification of feature engineering:

  1. Basic transformations
     ├── Mathematical transforms: log, sqrt, square, reciprocal
     ├── Binning: discretizing continuous values
     └── Clipping: limiting value range

  2. Aggregation features
     ├── Statistics: mean, median, max, min, std
     ├── Counts: occurrence count, unique value count
     └── Ratios: ratio to total, ratio to group

  3. Time-series features
     ├── Lag features: values from past N periods
     ├── Rolling statistics: rolling mean, rolling std
     ├── Difference features: period-over-period, year-over-year
     └── Cyclical features: day-of-week, month, season sin/cos encoding

  4. Text features
     ├── Character count, word count, sentence count
     ├── TF-IDF
     └── Embeddings (Word2Vec, BERT)

  5. Interaction features
     ├── Multiplication: A × B
     ├── Division: A / B
     └── Polynomial: A², A × B, B²

  6. Domain-specific features
     └── Business KPIs, medical indicators, financial metrics, etc.
```

### Code Example 5: Auto-generating Time-series Features

```python
import pandas as pd
import numpy as np

def create_datetime_features(df: pd.DataFrame,
                              date_col: str) -> pd.DataFrame:
    """Auto-generate features from a date column"""
    result = df.copy()
    dt = pd.to_datetime(result[date_col])

    # Basic time features
    result[f"{date_col}_year"] = dt.dt.year
    result[f"{date_col}_month"] = dt.dt.month
    result[f"{date_col}_day"] = dt.dt.day
    result[f"{date_col}_dayofweek"] = dt.dt.dayofweek
    result[f"{date_col}_hour"] = dt.dt.hour
    result[f"{date_col}_is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)
    result[f"{date_col}_quarter"] = dt.dt.quarter
    result[f"{date_col}_dayofyear"] = dt.dt.dayofyear
    result[f"{date_col}_weekofyear"] = dt.dt.isocalendar().week.astype(int)

    # Cyclical encoding (map month to a circle)
    result[f"{date_col}_month_sin"] = np.sin(2 * np.pi * dt.dt.month / 12)
    result[f"{date_col}_month_cos"] = np.cos(2 * np.pi * dt.dt.month / 12)

    # Cyclical encoding for day of week
    result[f"{date_col}_dow_sin"] = np.sin(2 * np.pi * dt.dt.dayofweek / 7)
    result[f"{date_col}_dow_cos"] = np.cos(2 * np.pi * dt.dt.dayofweek / 7)

    # Cyclical encoding for hour of day
    if dt.dt.hour.max() > 0:
        result[f"{date_col}_hour_sin"] = np.sin(2 * np.pi * dt.dt.hour / 24)
        result[f"{date_col}_hour_cos"] = np.cos(2 * np.pi * dt.dt.hour / 24)

    # Start/end of month flags
    result[f"{date_col}_is_month_start"] = dt.dt.is_month_start.astype(int)
    result[f"{date_col}_is_month_end"] = dt.dt.is_month_end.astype(int)

    # Holiday flag (simplified; use a holidays library in production)
    result[f"{date_col}_is_holiday"] = 0  # Can be extended

    return result

def create_lag_features(df: pd.DataFrame, col: str,
                        lags: list = [1, 7, 30],
                        group_col: str = None) -> pd.DataFrame:
    """Generate lag features and rolling averages

    Parameters
    ----------
    group_col : str, optional
        Column name to group by when computing lags
    """
    result = df.copy()

    for lag in lags:
        if group_col:
            result[f"{col}_lag_{lag}"] = result.groupby(group_col)[col].shift(lag)
            result[f"{col}_rolling_mean_{lag}"] = result.groupby(group_col)[col] \
                .transform(lambda x: x.rolling(lag, min_periods=1).mean())
            result[f"{col}_rolling_std_{lag}"] = result.groupby(group_col)[col] \
                .transform(lambda x: x.rolling(lag, min_periods=1).std())
        else:
            result[f"{col}_lag_{lag}"] = result[col].shift(lag)
            result[f"{col}_rolling_mean_{lag}"] = result[col].rolling(
                lag, min_periods=1
            ).mean()
            result[f"{col}_rolling_std_{lag}"] = result[col].rolling(
                lag, min_periods=1
            ).std()

        # Percentage change
        result[f"{col}_pct_change_{lag}"] = result[col].pct_change(periods=lag)

    # EWMA (exponentially weighted moving average)
    for span in [7, 14, 30]:
        result[f"{col}_ewma_{span}"] = result[col].ewm(span=span).mean()

    return result

def create_diff_features(df: pd.DataFrame, col: str,
                          periods: list = [1, 7]) -> pd.DataFrame:
    """Generate difference features"""
    result = df.copy()
    for period in periods:
        result[f"{col}_diff_{period}"] = result[col].diff(period)
        result[f"{col}_diff_pct_{period}"] = result[col].pct_change(period)
    return result

# Usage example
df = pd.DataFrame({
    "date": pd.date_range("2024-01-01", periods=365, freq="D"),
    "sales": np.random.randint(50, 200, 365) + \
             (np.sin(np.arange(365) * 2 * np.pi / 365) * 30).astype(int),
    "store_id": np.random.choice(["A", "B", "C"], 365),
})

df = create_datetime_features(df, "date")
df = create_lag_features(df, "sales", lags=[1, 7, 14, 28])
df = create_diff_features(df, "sales", periods=[1, 7])
print(f"Number of features: {df.shape[1]}")
print(df.head(30))
```

### Code Example 6: Interaction Features and Binning

```python
import pandas as pd
import numpy as np
from itertools import combinations
from sklearn.preprocessing import PolynomialFeatures

def create_interaction_features(df: pd.DataFrame,
                                 columns: list,
                                 operations: list = None) -> pd.DataFrame:
    """Generate interaction features from numeric columns

    Parameters
    ----------
    operations : list, optional
        List of operations to perform. Default is ["multiply", "divide"].
        Choices: "multiply", "divide", "add", "subtract"
    """
    if operations is None:
        operations = ["multiply", "divide"]

    result = df.copy()
    for col1, col2 in combinations(columns, 2):
        if "multiply" in operations:
            result[f"{col1}_x_{col2}"] = result[col1] * result[col2]
        if "divide" in operations:
            result[f"{col1}_div_{col2}"] = result[col1] / (result[col2] + 1e-8)
            result[f"{col2}_div_{col1}"] = result[col2] / (result[col1] + 1e-8)
        if "add" in operations:
            result[f"{col1}_plus_{col2}"] = result[col1] + result[col2]
        if "subtract" in operations:
            result[f"{col1}_minus_{col2}"] = result[col1] - result[col2]

    return result

def create_polynomial_features(df: pd.DataFrame, columns: list,
                                degree: int = 2) -> pd.DataFrame:
    """Generate polynomial features"""
    poly = PolynomialFeatures(degree=degree, include_bias=False,
                               interaction_only=False)
    poly_features = poly.fit_transform(df[columns])
    poly_names = poly.get_feature_names_out(columns)

    result = df.copy()
    for i, name in enumerate(poly_names):
        if name not in columns:  # Exclude original features
            result[f"poly_{name}"] = poly_features[:, i]

    return result

def create_bins(df: pd.DataFrame, col: str,
                n_bins: int = 5, strategy: str = "quantile",
                labels: list = None) -> pd.DataFrame:
    """Binning (discretization)

    Parameters
    ----------
    strategy : str
        "quantile": equal-frequency binning (equal number of samples per bin)
        "uniform": equal-width binning (equal bin widths)
        "kmeans": binning via K-means clustering
    """
    result = df.copy()

    if strategy == "quantile":
        result[f"{col}_bin"] = pd.qcut(
            result[col], q=n_bins, labels=labels or False, duplicates="drop"
        )
    elif strategy == "uniform":
        result[f"{col}_bin"] = pd.cut(
            result[col], bins=n_bins, labels=labels or False
        )
    elif strategy == "kmeans":
        from sklearn.preprocessing import KBinsDiscretizer
        kbd = KBinsDiscretizer(n_bins=n_bins, encode="ordinal", strategy="kmeans")
        result[f"{col}_bin"] = kbd.fit_transform(
            result[col].values.reshape(-1, 1)
        ).astype(int)

    return result

def create_aggregation_features(df: pd.DataFrame,
                                 group_col: str,
                                 agg_col: str) -> pd.DataFrame:
    """Generate group aggregation features"""
    result = df.copy()

    agg = df.groupby(group_col)[agg_col].agg([
        "mean", "std", "min", "max", "median", "count"
    ])
    agg.columns = [f"{agg_col}_by_{group_col}_{stat}" for stat in agg.columns]

    result = result.merge(agg, left_on=group_col, right_index=True, how="left")

    # Deviation feature: individual value - group mean
    mean_col = f"{agg_col}_by_{group_col}_mean"
    result[f"{agg_col}_dev_from_{group_col}_mean"] = result[agg_col] - result[mean_col]

    # Ratio feature: individual value / group mean
    result[f"{agg_col}_ratio_to_{group_col}_mean"] = \
        result[agg_col] / (result[mean_col] + 1e-8)

    return result
```

### Code Example 7: Generating Text Features

```python
import pandas as pd
import numpy as np
import re

def create_text_features(df: pd.DataFrame, text_col: str) -> pd.DataFrame:
    """Generate basic statistical features from a text column"""
    result = df.copy()
    text = df[text_col].fillna("")

    # Basic statistics
    result[f"{text_col}_length"] = text.str.len()
    result[f"{text_col}_word_count"] = text.str.split().str.len().fillna(0)
    result[f"{text_col}_sentence_count"] = text.str.count(r'[。.!?]') + 1
    result[f"{text_col}_avg_word_length"] = \
        text.apply(lambda x: np.mean([len(w) for w in x.split()]) if x else 0)

    # Special character statistics
    result[f"{text_col}_n_digits"] = text.str.count(r'\d')
    result[f"{text_col}_n_uppercase"] = text.str.count(r'[A-Z]')
    result[f"{text_col}_n_special"] = text.str.count(r'[!@#$%^&*()]')
    result[f"{text_col}_n_urls"] = text.str.count(r'https?://\S+')
    result[f"{text_col}_n_emails"] = text.str.count(r'\S+@\S+\.\S+')

    # Exclamation and question mark counts (clues for sentiment analysis)
    result[f"{text_col}_n_exclamation"] = text.str.count("!")
    result[f"{text_col}_n_question"] = text.str.count(r'\?')

    # Unique word ratio (vocabulary richness)
    result[f"{text_col}_unique_word_ratio"] = text.apply(
        lambda x: len(set(x.split())) / (len(x.split()) + 1e-8) if x else 0
    )

    return result
```

---

## 6. Feature Selection

### Feature Selection Methods

```
Three approaches to feature selection:

  1. Filter methods (statistical tests)
     ├── Variance filter: remove features with low variance
     ├── Correlation filter: remove features with low correlation to target
     ├── Mutual information: captures non-linear relationships too
     └── Chi-squared test: independence test for categorical variables
     → Fast, model-agnostic

  2. Wrapper methods (model-based)
     ├── Forward selection: add features one at a time
     ├── Backward elimination: remove features one at a time
     └── Recursive Feature Elimination (RFE): iterative removal by model importance
     → High accuracy, high computational cost

  3. Embedded methods (selected during training)
     ├── L1 regularization (Lasso): sets unnecessary coefficients to 0
     ├── Tree-based importance: RandomForest, XGBoost
     └── Permutation Importance
     → Good balance of accuracy and cost
```

### Code Example 8: Implementing Feature Selection

```python
import numpy as np
import pandas as pd
from sklearn.feature_selection import (
    VarianceThreshold, SelectKBest, f_classif,
    mutual_info_classif, RFE
)
from sklearn.ensemble import RandomForestClassifier
import matplotlib.pyplot as plt

class FeatureSelector:
    """Unified class for feature selection"""

    def __init__(self, X, y, feature_names=None):
        self.X = X
        self.y = y
        self.feature_names = feature_names or [f"f{i}" for i in range(X.shape[1])]
        self.scores = {}

    def variance_filter(self, threshold: float = 0.01) -> list:
        """Variance filter: remove features with variance below the threshold"""
        selector = VarianceThreshold(threshold=threshold)
        selector.fit(self.X)
        mask = selector.get_support()
        removed = [f for f, m in zip(self.feature_names, mask) if not m]
        print(f"Variance filter: {len(removed)} removed (threshold={threshold})")
        return [f for f, m in zip(self.feature_names, mask) if m]

    def correlation_filter(self, threshold: float = 0.95) -> list:
        """High-correlation filter: remove one of each highly correlated pair"""
        corr_matrix = pd.DataFrame(self.X, columns=self.feature_names).corr().abs()
        upper = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        to_drop = [col for col in upper.columns if any(upper[col] > threshold)]
        print(f"Correlation filter: {len(to_drop)} removed (threshold={threshold})")
        return [f for f in self.feature_names if f not in to_drop]

    def statistical_test(self, k: int = 10,
                          method: str = "f_classif") -> list:
        """Selection by statistical test"""
        if method == "f_classif":
            selector = SelectKBest(f_classif, k=k)
        elif method == "mutual_info":
            selector = SelectKBest(mutual_info_classif, k=k)

        selector.fit(self.X, self.y)
        mask = selector.get_support()
        self.scores[method] = selector.scores_

        selected = [f for f, m in zip(self.feature_names, mask) if m]
        print(f"{method}: top {k} selected")
        return selected

    def rfe_selection(self, n_features: int = 10) -> list:
        """Recursive Feature Elimination"""
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        rfe = RFE(model, n_features_to_select=n_features, step=1)
        rfe.fit(self.X, self.y)
        mask = rfe.support_

        selected = [f for f, m in zip(self.feature_names, mask) if m]
        print(f"RFE: {n_features} selected")
        return selected

    def importance_based(self, threshold: float = 0.01) -> list:
        """Selection based on model feature importance"""
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(self.X, self.y)
        importances = model.feature_importances_

        mask = importances > threshold
        selected = [f for f, m in zip(self.feature_names, mask) if m]
        print(f"Importance-based: {len(selected)} selected (threshold={threshold})")

        # Visualization
        sorted_idx = np.argsort(importances)[::-1][:20]
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.barh(range(len(sorted_idx)),
                importances[sorted_idx], align="center")
        ax.set_yticks(range(len(sorted_idx)))
        ax.set_yticklabels([self.feature_names[i] for i in sorted_idx])
        ax.set_xlabel("Importance")
        ax.set_title("Feature Importance (Top 20)")
        ax.invert_yaxis()
        plt.tight_layout()
        plt.savefig("reports/feature_importance_selection.png", dpi=150)
        plt.close()

        return selected

# Usage example
# selector = FeatureSelector(X_train, y_train, feature_names)
# selected = selector.importance_based(threshold=0.01)
```

---

## 7. Data Quality Management Pipeline

### Code Example 9: Integrated Preprocessing Pipeline

```python
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler,
    OneHotEncoder, OrdinalEncoder, PowerTransformer
)
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.feature_selection import VarianceThreshold
import joblib

class DataPreprocessingPipeline:
    """Production-ready data preprocessing pipeline

    Usage:
        1. fit(X_train, y_train) to train
        2. transform(X_test) to transform
        3. save/load for pipeline persistence
    """

    def __init__(self, numeric_features, categorical_features,
                 ordinal_features=None, ordinal_categories=None,
                 scaler_type="standard"):
        self.numeric_features = numeric_features
        self.categorical_features = categorical_features
        self.ordinal_features = ordinal_features or []
        self.ordinal_categories = ordinal_categories or []
        self.scaler_type = scaler_type
        self.pipeline = None
        self._build_pipeline()

    def _get_scaler(self):
        """Get scaler"""
        scalers = {
            "standard": StandardScaler(),
            "minmax": MinMaxScaler(),
            "robust": RobustScaler(),
            "power": PowerTransformer(method="yeo-johnson"),
        }
        return scalers.get(self.scaler_type, StandardScaler())

    def _build_pipeline(self):
        """Build the pipeline"""
        # Numeric feature processing
        numeric_transformer = Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", self._get_scaler()),
        ])

        # Categorical feature processing
        categorical_transformer = Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(
                drop="first", sparse_output=False,
                handle_unknown="ignore", min_frequency=0.01
            )),
        ])

        transformers = [
            ("num", numeric_transformer, self.numeric_features),
            ("cat", categorical_transformer, self.categorical_features),
        ]

        # Ordinal feature processing (optional)
        if self.ordinal_features:
            ordinal_transformer = Pipeline(steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OrdinalEncoder(
                    categories=self.ordinal_categories,
                    handle_unknown="use_encoded_value",
                    unknown_value=-1
                )),
            ])
            transformers.append(
                ("ord", ordinal_transformer, self.ordinal_features)
            )

        self.pipeline = Pipeline(steps=[
            ("preprocessor", ColumnTransformer(
                transformers=transformers,
                remainder="drop"
            )),
            ("variance_filter", VarianceThreshold(threshold=0.0)),
        ])

    def fit(self, X, y=None):
        """Train the pipeline"""
        self.pipeline.fit(X, y)
        return self

    def transform(self, X):
        """Transform data"""
        return self.pipeline.transform(X)

    def fit_transform(self, X, y=None):
        """Train and transform simultaneously"""
        return self.pipeline.fit_transform(X, y)

    def get_feature_names(self):
        """Get feature names after transformation"""
        preprocessor = self.pipeline.named_steps["preprocessor"]
        names = []
        for name, trans, cols in preprocessor.transformers_:
            if name == "num":
                names.extend(cols)
            elif name == "cat":
                encoder = trans.named_steps["encoder"]
                if hasattr(encoder, "get_feature_names_out"):
                    names.extend(encoder.get_feature_names_out(cols))
                else:
                    names.extend(cols)
            elif name == "ord":
                names.extend(cols)
        return names

    def save(self, path: str):
        """Save the pipeline"""
        joblib.dump(self.pipeline, path)
        print(f"Pipeline saved: {path}")

    def load(self, path: str):
        """Load the pipeline"""
        self.pipeline = joblib.load(path)
        print(f"Pipeline loaded: {path}")

# Usage example
pipeline = DataPreprocessingPipeline(
    numeric_features=["age", "income", "satisfaction"],
    categorical_features=["city"],
    ordinal_features=["education"],
    scaler_type="robust"
)

# X_train_processed = pipeline.fit_transform(X_train)
# X_test_processed = pipeline.transform(X_test)
# pipeline.save("models/preprocessing_pipeline.joblib")
```

### Code Example 10: Data Validation Checks

```python
import pandas as pd
import numpy as np

class DataValidator:
    """Data quality validation checks"""

    def __init__(self):
        self.rules = []
        self.results = []

    def add_rule(self, name: str, check_fn, severity: str = "error"):
        """Add a validation rule

        Parameters
        ----------
        severity : str
            "error": must be fixed
            "warning": caution
            "info": informational
        """
        self.rules.append({
            "name": name, "check_fn": check_fn, "severity": severity
        })

    def validate(self, df: pd.DataFrame) -> pd.DataFrame:
        """Run validation against all rules"""
        self.results = []

        for rule in self.rules:
            passed, message = rule"check_fn"
            self.results.append({
                "Rule": rule["name"],
                "Severity": rule["severity"],
                "Result": "PASS" if passed else "FAIL",
                "Details": message
            })

        results_df = pd.DataFrame(self.results)
        n_fail = (results_df["Result"] == "FAIL").sum()
        n_error = ((results_df["Result"] == "FAIL") &
                   (results_df["Severity"] == "error")).sum()

        print("=" * 60)
        print(f"Validation result: {n_fail} FAIL out of {len(self.results)} rules "
              f"(errors: {n_error})")
        print("=" * 60)
        for _, row in results_df.iterrows():
            status = "PASS" if row["Result"] == "PASS" else "FAIL"
            print(f"  [{row['Severity']:7s}] [{status}] {row['Rule']}: {row['Details']}")

        return results_df

# Usage example
validator = DataValidator()

# Define rules
validator.add_rule(
    "Missing rate check",
    lambda df: (
        df.isnull().mean().max() < 0.5,
        f"Max missing rate: {df.isnull().mean().max()*100:.1f}%"
    ),
    severity="warning"
)

validator.add_rule(
    "Duplicate row check",
    lambda df: (
        df.duplicated().sum() == 0,
        f"Duplicate rows: {df.duplicated().sum()}"
    ),
    severity="warning"
)

validator.add_rule(
    "Data type check",
    lambda df: (
        df.select_dtypes(include="object").shape[1] < df.shape[1],
        f"Object-type columns: {df.select_dtypes(include='object').shape[1]}"
    ),
    severity="info"
)

validator.add_rule(
    "Infinite value check",
    lambda df: (
        not np.isinf(df.select_dtypes(include="number")).any().any(),
        f"Columns with infinite values: {df.select_dtypes(include='number').columns[np.isinf(df.select_dtypes(include='number')).any()].tolist()}"
    ),
    severity="error"
)

validator.add_rule(
    "Sample count check",
    lambda df: (
        len(df) >= 100,
        f"Sample count: {len(df)}"
    ),
    severity="error"
)

# results = validator.validate(df)
```

---

## Comparison Tables

### Comparison of Missing Value Imputation Methods

| Method | Computational Cost | Accuracy | Use Case | Notes |
|---|---|---|---|---|
| Deletion (listwise) | Very low | - | MCAR, missing rate < 5% | Reduces data size |
| Mean/Median | Low | Low–Medium | Numeric, missing rate < 10% | Underestimates variance |
| Mode | Low | Low–Medium | Categorical variables | Distorts distribution |
| KNN imputation | Medium | Medium–High | MAR, numeric | Requires scaling |
| Multiple imputation (MICE) | High | High | MAR, multivariate | Check convergence |
| Model-based | High | High | Complex missing patterns | High implementation cost |
| Constant imputation (e.g., -999) | Very low | Low | Tree-based models only | Hurts distance-based models |

### Scaling Method Selection Guide

| Method | Formula | Outlier Robustness | Use Case | Representative Algorithms |
|---|---|---|---|---|
| StandardScaler | (x-μ)/σ | Weak | Data close to normal distribution | SVM, Logistic Regression, PCA |
| MinMaxScaler | (x-min)/(max-min) | Weak | Fixed range required | Neural Networks |
| RobustScaler | (x-Q2)/(Q3-Q1) | Strong | Data with many outliers | General-purpose |
| MaxAbsScaler | x/|max| | Weak | Sparse data | Text classification, sparse SVM |
| PowerTransformer | Yeo-Johnson/Box-Cox | Moderate | Skewed distributions | General-purpose |
| QuantileTransformer | Quantile → normal/uniform | Strong | Arbitrary distributions | General-purpose |
| Normalizer | x/||x|| | - | Per-sample normalization | Text, TF-IDF |
| Log transform | log(1+x) | Moderate | Right-skewed distributions | General-purpose |

### Encoding Method Comparison

| Method | Dimension Increase | Preserves Order | Cardinality | Leak Risk | Use Case |
|---|---|---|---|---|---|
| OneHot | Large | No | Low (<=15) | None | Nominal variables |
| Ordinal | None | Yes | Any | None | Ordinal variables |
| Label | None | No | Any | None | Tree-based models |
| Target | None | No | High | Yes (CV needed) | High cardinality |
| Frequency | None | No | High | None | When frequency is meaningful |
| Binary | log₂(k) | No | Medium–High | None | When limiting dimensions |
| Hash | Fixed | No | Very high | None | Text, web features |
| Embedding | Fixed | No | Very high | None | NN, large-scale data |

---

## Anti-Patterns

### Anti-Pattern 1: Fitting on Test Data

```python
# BAD: fitting on test data as well
from sklearn.preprocessing import StandardScaler

# Training data
scaler_train = StandardScaler()
X_train = scaler_train.fit_transform(X_train)

# fit_transform on test data too ← information leak!
scaler_test = StandardScaler()
X_test = scaler_test.fit_transform(X_test)

# GOOD: transform test data using statistics from training data
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)       # transform only
```

### Anti-Pattern 2: One-Hot Encoding High-Cardinality Variables

```python
# BAD: one-hot encoding a category with 10,000 unique values → dimension explosion
df_onehot = pd.get_dummies(df["zip_code"])  # 10,000 columns added!

# GOOD: use target encoding or an embedding layer
from category_encoders import TargetEncoder
te = TargetEncoder(smoothing=10)
df["zip_code_encoded"] = te.fit_transform(df["zip_code"], df["target"])

# Or frequency encoding
freq = df["zip_code"].value_counts(normalize=True)
df["zip_code_freq"] = df["zip_code"].map(freq)
```

### Anti-Pattern 3: Preprocessing Before Splitting

```python
# BAD: scaling before split → test data information leaks
scaler = StandardScaler()
X_all_scaled = scaler.fit_transform(X)  # fit on all data
X_train, X_test = train_test_split(X_all_scaled, ...)

# GOOD: split first, then process via a pipeline
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split

X_train, X_test = train_test_split(X, ...)
pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("model", SomeModel()),
])
pipeline.fit(X_train, y_train)  # fit happens inside the pipeline
```

### Anti-Pattern 4: Leaking Target Encoding

```python
# BAD: target encoding over the entire training set → leak
mean_by_city = df.groupby("city")["target"].mean()
df["city_target_enc"] = df["city"].map(mean_by_city)

# GOOD: CV-based target encoding
from sklearn.model_selection import KFold

kf = KFold(n_splits=5, shuffle=True, random_state=42)
df["city_target_enc_cv"] = np.nan

for train_idx, val_idx in kf.split(df):
    mean_by_city = df.iloc[train_idx].groupby("city")["target"].mean()
    df.loc[df.index[val_idx], "city_target_enc_cv"] = \
        df.iloc[val_idx]["city"].map(mean_by_city)

# Fill missing values with global mean
df["city_target_enc_cv"].fillna(df["target"].mean(), inplace=True)
```

### Anti-Pattern 5: Ignoring Multicollinearity

```python
# BAD: using highly correlated features as-is → linear models become unstable
# Example: including both "height (cm)" and "height (inch)"

# GOOD: detect and remove multicollinearity with VIF (Variance Inflation Factor)
from statsmodels.stats.outliers_influence import variance_inflation_factor

def check_multicollinearity(X, feature_names, threshold=10):
    """Check multicollinearity using VIF"""
    vif_data = pd.DataFrame()
    vif_data["feature"] = feature_names
    vif_data["VIF"] = [
        variance_inflation_factor(X, i) for i in range(X.shape[1])
    ]
    vif_data = vif_data.sort_values("VIF", ascending=False)

    high_vif = vif_data[vif_data["VIF"] > threshold]
    if len(high_vif) > 0:
        print(f"WARNING: features with VIF > {threshold}:")
        for _, row in high_vif.iterrows():
            print(f"  {row['feature']}: VIF={row['VIF']:.1f}")

    return vif_data
```

---

## Troubleshooting

| Problem | Symptom | Solution |
|---|---|---|
| Abnormally high test score | CV > 0.99 | Suspect data leakage. Check the order of fit calls in preprocessing |
| Model degrades after imputation | Lower accuracy than before imputation | Change imputation method. Add missing-flag columns |
| Out of memory after one-hot encoding | MemoryError | Use sparse=True or TargetEncoding |
| Too many features | Slow training | Perform feature selection. Reduce dimensions with PCA |
| Outliers distort the model | Low train error but poor test results | Use RobustScaler or clip outliers |
| Unknown category value in production | KeyError or NaN | Use handle_unknown="ignore" or a default value |
| Accuracy unchanged after scaling | Using a tree-based model | Tree-based models do not require scaling |
| MICE imputation does not converge | Warning message | Increase max_iter or reduce the number of features |

---

## FAQ

### Q1: How do I decide whether to drop or impute a column with missing values?

**A:** General guidelines: (1) missing rate >= 80% → consider dropping; (2) missing rate < 5% → simple imputation is sufficient; (3) 5–80% → use advanced imputation such as KNN/MICE. However, columns that are domain-critical may be worth imputing even at high missing rates. When missingness itself carries information (e.g., a respondent refusing to answer), add a "missing flag column."

### Q2: Are more features always better?

**A:** No. The "curse of dimensionality" causes generalization performance to degrade when there are too many features, especially with small training sets. Use feature selection (SelectKBest, LASSO, mutual information) to remove unnecessary features, or reduce dimensions with PCA. As a rule of thumb, keep "sample count / feature count > 10."

### Q3: What is the difference between normalization and scaling?

**A:** Strictly speaking, normalization maps each sample's vector to unit length (e.g., L2 normalization), while scaling adjusts the range of each feature. In practice the terms are often used interchangeably. MinMaxScaler is sometimes called "normalization," but it is technically scaling.

### Q4: Is scaling necessary for tree-based models?

**A:** Generally no. Tree-based models such as decision trees, random forests, XGBoost, and LightGBM are not affected by scale when searching for split points. However, scaling is necessary when (1) using regularization, (2) combining with PCA, or (3) ensembling with KNN or linear models.

### Q5: How do I prevent leakage in target encoding?

**A:** (1) Use CV-based target encoding (compute separately for each fold); (2) set the smoothing parameter appropriately (to prevent overfitting on categories with few samples); (3) encode test data using only statistics from the training data.

### Q6: What is the recommended order of preprocessing steps?

**A:** Recommended order: (1) type conversion (e.g., parsing dates), (2) outlier handling (if needed), (3) missing value imputation, (4) categorical encoding, (5) feature engineering, (6) scaling, (7) feature selection. Including this order in a pipeline ensures reproducibility.

---

## Summary

| Item | Key Points |
|---|---|
| Missing value handling | First analyze the missing pattern; choose a strategy based on MCAR/MAR/MNAR |
| Scaling | Choose based on the algorithm. Use RobustScaler when outliers are present |
| Encoding | Low cardinality → one-hot; high cardinality → target encoding |
| Outlier handling | Detect with IQR or Isolation Forest; handle with clip/remove/nan |
| Feature design | Combine domain knowledge with auto-generation (interactions, time-series features) |
| Feature selection | Computational cost increases in order: filter → wrapper → embedded methods |
| Pipeline | Include all transformations in a Pipeline; manage consistently with fit/transform/save |
| Preventing data leakage | Prevent leakage to test data. All transformations must be fit on training data only |

---

## Recommended Next Guides

- [02-ml-basics.md](./02-ml-basics.md) — How to build machine learning models on preprocessed data
- [../01-classical-ml/00-regression.md](../01-classical-ml/00-regression.md) — Implementing regression models

---

## References

1. **Stef van Buuren** "Flexible Imputation of Missing Data" 2nd Edition, CRC Press, 2018
2. **scikit-learn Documentation** "Preprocessing data" — https://scikit-learn.org/stable/modules/preprocessing.html
3. **Feature Engine** "Feature Engineering for Machine Learning" — https://feature-engine.trainindata.com/
4. **Alice Zheng, Amanda Casari** "Feature Engineering for Machine Learning", O'Reilly, 2018
5. **category_encoders** "A set of scikit-learn-style transformers for encoding categorical variables" — https://contrib.scikit-learn.org/category_encoders/
