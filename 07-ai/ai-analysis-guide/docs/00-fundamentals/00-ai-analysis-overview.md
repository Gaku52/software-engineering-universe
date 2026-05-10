# AI Analysis Overview — A Bird's-Eye View of Data Science and ML

> Survey the full landscape of data science and machine learning, and systematically understand how to approach AI analysis projects

## What You Will Learn in This Chapter

1. **Data Science Lifecycle** — The complete process from business problem definition to model deployment
2. **Machine Learning Taxonomy** — The positioning and selection of supervised, unsupervised, and reinforcement learning
3. **AI Analysis Project Design Principles** — Design that accounts for reproducibility, scalability, and ethics
4. **EDA (Exploratory Data Analysis)** — A systematic approach to deepening your understanding of data
5. **Experiment Management and Versioning** — Tracking and reproducing experiments with MLflow and DVC
6. **Best Practices for Project Execution** — Team management, stakeholder management, and risk mitigation


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Data Science Lifecycle

AI analysis projects proceed through an iterative, rather than linear, process. CRISP-DM (Cross-Industry Standard Process for Data Mining) is the most widely adopted framework.

### Lifecycle Overview

```
+-------------------+
|  Business         |
|  Understanding    |
+--------+----------+
         |
         v
+--------+----------+     +-------------------+
|  Data             |<--->|  Data             |
|  Understanding    |     |  Preparation      |
+--------+----------+     +--------+----------+
         |                         |
         +----------+--------------+
                    |
                    v
         +----------+----------+
         |  Modeling           |
         +----------+----------+
                    |
                    v
         +----------+----------+
         |  Evaluation         |
         +----------+----------+
                    |
                    v
         +----------+----------+
         |  Deployment         |
         +---------------------+
```

### Details and Deliverables for Each Phase

```
CRISP-DM Phase Details:

Phase 1: Business Understanding
  ├── Input: Business problem, stakeholder requirements
  ├── Activities:
  │   ├── Define KPIs (increase sales by 5%, reduce churn by 10%, etc.)
  │   ├── Clarify success criteria (accuracy thresholds, latency requirements)
  │   ├── Investigate data availability
  │   └── Estimate ROI
  └── Deliverables: Project plan, success criteria document

Phase 2: Data Understanding
  ├── Input: Available data sources
  ├── Activities:
  │   ├── Data collection and access setup
  │   ├── EDA (Exploratory Data Analysis)
  │   ├── Data quality assessment
  │   └── Initial hypothesis building
  └── Deliverables: EDA report, data dictionary, quality report

Phase 3: Data Preparation
  ├── Input: Raw data, EDA results
  ├── Activities:
  │   ├── Data cleaning (missing values, outliers, duplicates)
  │   ├── Feature engineering
  │   ├── Data integration (merging multiple sources)
  │   └── Train/validation/test split
  └── Deliverables: Preprocessed dataset, preprocessing pipeline

Phase 4: Modeling
  ├── Input: Preprocessed data
  ├── Activities:
  │   ├── Build baseline model
  │   ├── Compare multiple algorithms
  │   ├── Hyperparameter optimization
  │   └── Explore ensemble methods
  └── Deliverables: Trained model, experiment logs

Phase 5: Evaluation
  ├── Input: Trained model, test data
  ├── Activities:
  │   ├── Performance evaluation on test data
  │   ├── Cross-reference with business KPIs
  │   ├── Fairness and bias checks
  │   └── Plan A/B testing
  └── Deliverables: Evaluation report, deployment decision

Phase 6: Deployment
  ├── Input: Approved model
  ├── Activities:
  │   ├── Model packaging
  │   ├── Build API/batch inference
  │   ├── Configure monitoring
  │   └── Build retraining pipeline
  └── Deliverables: Production service, monitoring dashboard
```

### Code Example 1: Project Structure Template

```python
# Standard directory structure for an AI analysis project
"""
my-ml-project/
├── data/
│   ├── raw/              # Raw data (do not modify)
│   ├── processed/        # Preprocessed data
│   ├── interim/          # Intermediate data
│   └── external/         # External data sources
├── notebooks/
│   ├── 01_exploration.ipynb
│   ├── 02_preprocessing.ipynb
│   ├── 03_modeling.ipynb
│   └── 04_evaluation.ipynb
├── src/
│   ├── __init__.py
│   ├── data/             # Data processing modules
│   │   ├── __init__.py
│   │   ├── loader.py     # Data loading
│   │   └── validation.py # Data validation
│   ├── features/         # Feature engineering
│   │   ├── __init__.py
│   │   ├── builder.py    # Feature generation
│   │   └── selector.py   # Feature selection
│   ├── models/           # Model definition and training
│   │   ├── __init__.py
│   │   ├── train.py      # Training script
│   │   ├── predict.py    # Inference script
│   │   └── evaluate.py   # Evaluation script
│   └── visualization/    # Visualization utilities
│       ├── __init__.py
│       └── plots.py
├── models/               # Saved trained models
├── reports/              # Analysis reports and figures
│   └── figures/
├── tests/                # Test code
│   ├── test_data.py
│   ├── test_features.py
│   └── test_models.py
├── configs/              # Configuration files
│   ├── config.yaml
│   └── hyperparams.yaml
├── scripts/              # Utility scripts
│   ├── train.sh
│   └── deploy.sh
├── Makefile              # Task runner
├── pyproject.toml        # Project configuration
├── requirements.txt      # Dependency packages
├── .env.example          # Environment variable template
├── .gitignore
└── README.md
"""

import os
import json
from datetime import datetime

def create_project_structure(project_name: str,
                              include_dvc: bool = False,
                              include_docker: bool = False) -> None:
    """Create the standard structure for an AI analysis project

    Parameters
    ----------
    project_name : str
        Project name
    include_dvc : bool
        Whether to include DVC files
    include_docker : bool
        Whether to include a Dockerfile
    """
    dirs = [
        "data/raw", "data/processed", "data/interim", "data/external",
        "notebooks", "src/data", "src/features",
        "src/models", "src/visualization",
        "models", "reports/figures", "tests",
        "configs", "scripts"
    ]
    for d in dirs:
        os.makedirs(os.path.join(project_name, d), exist_ok=True)

    # Place .gitkeep to track empty directories in Git
    for d in dirs:
        gitkeep = os.path.join(project_name, d, ".gitkeep")
        open(gitkeep, "w").close()

    # Create __init__.py files
    for d in ["src", "src/data", "src/features", "src/models", "src/visualization"]:
        init_file = os.path.join(project_name, d, "__init__.py")
        open(init_file, "w").close()

    # Create .gitignore
    gitignore_content = """# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
.venv/
env/

# Data
data/raw/*
data/processed/*
data/interim/*
!data/**/.gitkeep

# Models
models/*.joblib
models/*.pkl
models/*.h5

# Environment
.env

# IDE
.vscode/
.idea/

# Jupyter
.ipynb_checkpoints/

# MLflow
mlruns/
"""
    with open(os.path.join(project_name, ".gitignore"), "w") as f:
        f.write(gitignore_content)

    # Create Makefile
    makefile_content = """.PHONY: install train test lint clean

install:
\tpip install -r requirements.txt

train:
\tpython -m src.models.train --config configs/config.yaml

test:
\tpytest tests/ -v

lint:
\truff check src/ tests/
\tmypy src/

clean:
\trm -rf __pycache__ .pytest_cache models/*.joblib
"""
    with open(os.path.join(project_name, "Makefile"), "w") as f:
        f.write(makefile_content)

    # Project metadata
    metadata = {
        "name": project_name,
        "created_at": datetime.now().isoformat(),
        "version": "0.1.0",
    }
    with open(os.path.join(project_name, "project_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    if include_docker:
        dockerfile = """FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ src/
COPY models/ models/
COPY configs/ configs/
CMD ["python", "-m", "src.models.predict"]
"""
        with open(os.path.join(project_name, "Dockerfile"), "w") as f:
            f.write(dockerfile)

    print(f"Project '{project_name}' created")
    print(f"  Number of directories: {len(dirs)}")

create_project_structure("fraud-detection", include_docker=True)
```

---

## 2. Machine Learning Taxonomy

### Overview of Learning Paradigms

```
              Machine Learning
              ┌──────────┼──────────┐
              │          │          │
         Supervised  Unsupervised  Reinforcement
         Learning    Learning      Learning
              │          │          │
         ┌────┴────┐  ┌──┴──┐    ┌──┴──┐
         │         │  │     │    │     │
      Regression Class- Clust- Dim  Policy  Value
                  ifica- ering  Red- Grad-  Func-
                  tion        uction ient  tion
                     (Clust) (DR) (PG)  (VF)
              │          │          │
         ┌────┴────┐  ┌──┴──┐    ┌──┴──┐
        Linear  DTree K-means PCA  Q-Learn SARSA
        SVM     RF    DBSCAN tSNE  PPO    A3C
        NN      GBM   GMM    UMAP  DQN    SAC

Additional Paradigms:
  ┌──────────────────────────────────────────┐
  │ Semi-Supervised Learning                  │
  │   Small amount of labeled data + large    │
  │   amount of unlabeled data                │
  │   e.g.: Self-Training, Label Propagation  │
  ├──────────────────────────────────────────┤
  │ Self-Supervised Learning                  │
  │   Generates learning signal from the data │
  │   itself                                  │
  │   e.g.: BERT (MLM), GPT (NTP), SimCLR    │
  ├──────────────────────────────────────────┤
  │ Transfer Learning                         │
  │   Apply a pre-trained model to a          │
  │   different task                          │
  │   e.g.: Fine-tuning, Feature Extraction   │
  ├──────────────────────────────────────────┤
  │ Meta-Learning                             │
  │   "Learning to learn"                     │
  │   e.g.: MAML, Prototypical Networks       │
  └──────────────────────────────────────────┘
```

### When to Apply Each Paradigm

```
Paradigm selection based on task and data:

  ┌─────────────────────────┐
  │ Is labeled data available? │
  └────────┬────────────────┘
       Yes │          No
           │            │
  ┌────────┴──────┐  ┌──┴──────────────────┐
  │ Is there      │  │ Want to discover    │
  │ enough of it? │  │ structure?          │
  └────┬──────────┘  └──┬───────────────────┘
   Yes │   No          Yes │        No
       │     │             │          │
  Supervised Semi-       Unsup-    Self-
  Learning   Supervised  ervised   Supervised
  Learning   Learning    Learning  Learning
       │                            │
  ┌────┴────┐                  ┌────┴────┐
  │ What is │                  │Pre-train│
  │ the     │                  │→Fine-tune│
  │ target  │                  └─────────┘
  │ type?   │
  └────┬────┘
  Cont │   Discrete │
      │       │
   Regress  Classify
```

### Code Example 2: Automatic Problem Type Detection

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional

def identify_problem_type(target: pd.Series,
                           threshold_unique_ratio: float = 0.05,
                           threshold_unique_count: int = 20) -> Dict[str, Any]:
    """Automatically identify the problem type from the target variable

    Parameters
    ----------
    target : pd.Series
        Target variable
    threshold_unique_ratio : float
        Threshold for the unique value ratio (above this → regression)
    threshold_unique_count : int
        Threshold for unique value count (above this → regression candidate)
    """
    result = {
        "dtype": str(target.dtype),
        "n_unique": target.nunique(),
        "n_samples": len(target),
        "missing_rate": target.isnull().mean(),
        "unique_ratio": target.nunique() / len(target),
    }

    # Numeric type with many unique values → regression
    if pd.api.types.is_numeric_dtype(target):
        ratio = target.nunique() / len(target)
        if ratio > threshold_unique_ratio and target.nunique() > threshold_unique_count:
            result["problem_type"] = "Regression"
            result["suggested_metrics"] = ["RMSE", "MAE", "R²", "MAPE"]
            result["suggested_models"] = [
                "LinearRegression", "Ridge", "Lasso",
                "RandomForestRegressor", "XGBRegressor", "LGBMRegressor"
            ]
            result["baseline_model"] = "Mean prediction (DummyRegressor)"
        else:
            result["problem_type"] = "Classification"
            if target.nunique() == 2:
                result["sub_type"] = "Binary Classification"
                result["suggested_metrics"] = ["F1", "AUC-ROC", "Precision", "Recall"]
            else:
                result["sub_type"] = f"Multi-class Classification ({target.nunique()} classes)"
                result["suggested_metrics"] = ["F1-macro", "AUC-ROC (OVR)", "Accuracy"]
            result["suggested_models"] = [
                "LogisticRegression", "RandomForestClassifier",
                "XGBClassifier", "LGBMClassifier"
            ]
            result["baseline_model"] = "Most-frequent prediction (DummyClassifier)"

            # Detect class imbalance
            value_counts = target.value_counts(normalize=True)
            imbalance_ratio = value_counts.max() / value_counts.min()
            if imbalance_ratio > 5:
                result["warning"] = (
                    f"Class imbalance detected (ratio={imbalance_ratio:.1f}x). "
                    f"Recommend using SMOTE/class_weight"
                )
                result["suggested_metrics"].extend(["PR-AUC", "MCC"])
    else:
        result["problem_type"] = "Classification"
        if target.nunique() == 2:
            result["sub_type"] = "Binary Classification"
        else:
            result["sub_type"] = f"Multi-class Classification ({target.nunique()} classes)"
        result["suggested_metrics"] = ["F1-macro", "AUC-ROC", "Accuracy"]
        result["suggested_models"] = [
            "LogisticRegression", "RandomForestClassifier",
            "XGBClassifier", "LGBMClassifier"
        ]

    return result

def suggest_approach(df: pd.DataFrame, target_col: str) -> Dict[str, Any]:
    """Suggest an AI analysis approach from a dataframe"""
    n_samples, n_features = df.shape
    target = df[target_col]
    problem_info = identify_problem_type(target)

    suggestion = {
        **problem_info,
        "n_samples": n_samples,
        "n_features": n_features - 1,  # Exclude the target column
        "data_size_category": (
            "Small" if n_samples < 10000
            else "Medium" if n_samples < 1000000
            else "Large"
        ),
    }

    # Tool recommendations based on data size
    if n_samples < 10000:
        suggestion["recommended_framework"] = "scikit-learn"
        suggestion["compute"] = "CPU (local)"
    elif n_samples < 1000000:
        suggestion["recommended_framework"] = "XGBoost / LightGBM"
        suggestion["compute"] = "CPU or GPU (cloud recommended)"
    else:
        suggestion["recommended_framework"] = "Spark / Dask + LightGBM"
        suggestion["compute"] = "Distributed processing cluster"

    return suggestion

# Usage example
df = pd.DataFrame({
    "price": [100.5, 200.3, 150.0, 300.7, 250.1],
    "category": ["A", "B", "A", "C", "B"],
    "is_fraud": [0, 1, 0, 0, 1]
})

print("=== Regression Task ===")
print(identify_problem_type(df["price"]))
print("\n=== Classification Task ===")
print(identify_problem_type(df["is_fraud"]))
```

---

## 3. Data Types and Preprocessing Concepts

### Data Types and Their Characteristics

```
Data types and corresponding preprocessing:

  Structured Data (tabular):
    ├── Numeric data: continuous (height, price), discrete (age, count)
    │   └── Preprocessing: scaling, missing value imputation, outlier handling
    ├── Categorical data: nominal (color, region), ordinal (education, satisfaction)
    │   └── Preprocessing: encoding (OneHot, Target, Ordinal)
    └── Time series data: continuous observations with timestamps
        └── Preprocessing: lag features, moving averages, differencing, periodic features

  Unstructured Data:
    ├── Text: natural language documents
    │   └── Preprocessing: tokenization, TF-IDF, Word2Vec, BERT embeddings
    ├── Images: pixel data
    │   └── Preprocessing: resize, normalization, data augmentation (rotation, flipping)
    ├── Audio: waveform data
    │   └── Preprocessing: MFCC, spectrogram transformation
    └── Video: frame sequences
        └── Preprocessing: keyframe extraction, optical flow
```

### Code Example 3: Data Quality Check

```python
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple

def data_quality_report(df: pd.DataFrame) -> pd.DataFrame:
    """Generate a quality report for a dataframe"""
    report = pd.DataFrame({
        "type": df.dtypes,
        "non_null_count": df.count(),
        "null_count": df.isnull().sum(),
        "null_rate(%)": (df.isnull().sum() / len(df) * 100).round(2),
        "unique_count": df.nunique(),
        "unique_rate(%)": (df.nunique() / len(df) * 100).round(2),
    })

    # Statistics for numeric columns
    for col in df.select_dtypes(include=[np.number]).columns:
        report.loc[col, "mean"] = df[col].mean()
        report.loc[col, "std_dev"] = df[col].std()
        report.loc[col, "min"] = df[col].min()
        report.loc[col, "max"] = df[col].max()
        report.loc[col, "skewness"] = df[col].skew()
        report.loc[col, "kurtosis"] = df[col].kurtosis()

    # Top values for categorical columns
    for col in df.select_dtypes(include=["object", "category"]).columns:
        top_val = df[col].mode()
        if len(top_val) > 0:
            report.loc[col, "mode"] = top_val.iloc[0]
            report.loc[col, "mode_rate(%)"] = (
                df[col].value_counts(normalize=True).iloc[0] * 100
            )

    return report

def detect_data_issues(df: pd.DataFrame) -> List[Dict[str, str]]:
    """Detect potential issues in data"""
    issues = []

    # 1. High missing rate
    for col in df.columns:
        missing_rate = df[col].isnull().mean()
        if missing_rate > 0.5:
            issues.append({
                "column": col, "issue": "High missing rate",
                "detail": f"missing_rate={missing_rate:.1%}",
                "recommendation": "Drop column or use model-based imputation"
            })

    # 2. Constant column
    for col in df.columns:
        if df[col].nunique() <= 1:
            issues.append({
                "column": col, "issue": "Constant column",
                "detail": f"unique_values={df[col].nunique()}",
                "recommendation": "Remove column"
            })

    # 3. High cardinality categorical column
    for col in df.select_dtypes(include=["object"]).columns:
        if df[col].nunique() > 100:
            issues.append({
                "column": col, "issue": "High cardinality",
                "detail": f"unique_values={df[col].nunique()}",
                "recommendation": "TargetEncoding or Hash"
            })

    # 4. Duplicate rows
    n_dup = df.duplicated().sum()
    if n_dup > 0:
        issues.append({
            "column": "all", "issue": "Duplicate rows",
            "detail": f"{n_dup} rows ({n_dup/len(df)*100:.1f}%)",
            "recommendation": "Review duplicates and remove as needed"
        })

    # 5. Suspicious outliers (numeric columns)
    for col in df.select_dtypes(include=[np.number]).columns:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        outlier_count = ((df[col] < q1 - 3 * iqr) | (df[col] > q3 + 3 * iqr)).sum()
        if outlier_count > 0:
            issues.append({
                "column": col, "issue": "Outliers",
                "detail": f"{outlier_count} values (3×IQR criterion)",
                "recommendation": "Consider clipping or transformation"
            })

    if not issues:
        print("No potential issues detected.")
    else:
        print(f"Issues detected: {len(issues)}")
        for issue in issues:
            print(f"  [{issue['column']}] {issue['issue']}: {issue['detail']} → {issue['recommendation']}")

    return issues

# Usage example
# df = pd.read_csv("data/raw/sample.csv")
# report = data_quality_report(df)
# print(report.to_string())
# issues = detect_data_issues(df)
```

### Code Example 4: Exploratory Data Analysis (EDA) Pipeline

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import List, Optional

class EDARunner:
    """Automated runner for exploratory data analysis"""

    def __init__(self, df: pd.DataFrame, target_col: str = None):
        self.df = df
        self.target = target_col
        self.numeric_cols = df.select_dtypes(include="number").columns.tolist()
        self.categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    def summary(self) -> None:
        """Display basic statistics"""
        print("=" * 60)
        print(f"Data shape: {self.df.shape}")
        print(f"Numeric columns: {len(self.numeric_cols)}")
        print(f"Categorical columns: {len(self.categorical_cols)}")
        print(f"Columns with missing values: {self.df.isnull().any().sum()}")
        print(f"Duplicate rows: {self.df.duplicated().sum()}")
        print(f"Memory usage: {self.df.memory_usage(deep=True).sum() / 1024**2:.1f} MB")
        print("=" * 60)

        if self.target:
            print(f"\nTarget variable: {self.target}")
            if self.target in self.numeric_cols:
                print(f"  Mean: {self.df[self.target].mean():.4f}")
                print(f"  Std dev: {self.df[self.target].std():.4f}")
                print(f"  Median: {self.df[self.target].median():.4f}")
            else:
                print(f"  Class distribution:")
                for cls, count in self.df[self.target].value_counts().items():
                    pct = count / len(self.df) * 100
                    print(f"    {cls}: {count} ({pct:.1f}%)")

    def correlation_matrix(self, method: str = "pearson",
                           threshold: float = 0.7) -> None:
        """Heatmap of the correlation matrix"""
        if len(self.numeric_cols) < 2:
            print("Cannot generate correlation matrix: fewer than 2 numeric columns")
            return

        corr = self.df[self.numeric_cols].corr(method=method)

        fig, ax = plt.subplots(figsize=(max(10, len(self.numeric_cols) * 0.8),
                                        max(8, len(self.numeric_cols) * 0.6)))
        mask = np.triu(np.ones_like(corr, dtype=bool))
        sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm",
                    mask=mask, ax=ax, vmin=-1, vmax=1, center=0)
        plt.title(f"Correlation Matrix ({method})")
        plt.tight_layout()
        plt.savefig("reports/correlation_matrix.png", dpi=150)
        plt.close()

        # Report highly correlated pairs
        high_corr_pairs = []
        for i in range(len(corr.columns)):
            for j in range(i + 1, len(corr.columns)):
                if abs(corr.iloc[i, j]) > threshold:
                    high_corr_pairs.append(
                        (corr.columns[i], corr.columns[j], corr.iloc[i, j])
                    )

        if high_corr_pairs:
            print(f"\nHighly correlated pairs (|r| > {threshold}):")
            for col1, col2, r in sorted(high_corr_pairs, key=lambda x: abs(x[2]), reverse=True):
                print(f"  {col1} <-> {col2}: r = {r:.3f}")

    def distribution_plots(self) -> None:
        """Distribution plots for numeric columns"""
        n_cols = min(len(self.numeric_cols), 16)
        if n_cols == 0:
            return

        n_grid_cols = 4
        n_grid_rows = (n_cols + n_grid_cols - 1) // n_grid_cols

        fig, axes = plt.subplots(
            nrows=n_grid_rows, ncols=n_grid_cols,
            figsize=(4 * n_grid_cols, 3.5 * n_grid_rows)
        )
        if n_grid_rows == 1 and n_grid_cols == 1:
            axes = np.array([axes])
        axes = axes.flatten()

        for i, col in enumerate(self.numeric_cols[:n_cols]):
            self.df[col].hist(bins=30, ax=axes[i], edgecolor="black", alpha=0.7)
            axes[i].set_title(f"{col}\n(mean={self.df[col].mean():.1f}, "
                              f"std={self.df[col].std():.1f})", fontsize=9)
            axes[i].axvline(self.df[col].mean(), color="red", linestyle="--", alpha=0.5)

        for i in range(n_cols, len(axes)):
            axes[i].set_visible(False)

        plt.suptitle("Distribution of Numeric Features", fontsize=14, y=1.02)
        plt.tight_layout()
        plt.savefig("reports/distributions.png", dpi=150, bbox_inches="tight")
        plt.close()

    def target_analysis(self) -> None:
        """Visualize the relationship between the target variable and each feature"""
        if self.target is None:
            print("No target column specified")
            return

        # Numeric features vs. target
        n_cols = min(len(self.numeric_cols), 12)
        if n_cols > 0 and self.target in self.numeric_cols:
            feature_cols = [c for c in self.numeric_cols if c != self.target][:n_cols]
            n_grid_cols = 3
            n_grid_rows = (len(feature_cols) + n_grid_cols - 1) // n_grid_cols

            fig, axes = plt.subplots(n_grid_rows, n_grid_cols,
                                      figsize=(5 * n_grid_cols, 4 * n_grid_rows))
            axes = axes.flatten() if n_grid_rows > 1 else [axes] if n_grid_rows == 1 and n_grid_cols == 1 else axes.flatten()

            for i, col in enumerate(feature_cols):
                if i < len(axes):
                    axes[i].scatter(self.df[col], self.df[self.target],
                                    alpha=0.3, s=10)
                    axes[i].set_xlabel(col)
                    axes[i].set_ylabel(self.target)
                    corr_val = self.df[col].corr(self.df[self.target])
                    axes[i].set_title(f"r = {corr_val:.3f}")

            for i in range(len(feature_cols), len(axes)):
                axes[i].set_visible(False)

            plt.suptitle(f"Features vs {self.target}", fontsize=14, y=1.02)
            plt.tight_layout()
            plt.savefig("reports/target_analysis.png", dpi=150, bbox_inches="tight")
            plt.close()

    def categorical_analysis(self) -> None:
        """Visualize the distribution of categorical variables"""
        n_cats = min(len(self.categorical_cols), 8)
        if n_cats == 0:
            return

        fig, axes = plt.subplots(2, min(4, n_cats), figsize=(5 * min(4, n_cats), 8))
        if n_cats == 1:
        elif n_cats <= 4:
            axes = axes.reshape(2, -1)

        for i, col in enumerate(self.categorical_cols[:n_cats]):
            row, col_idx = i // 4, i % 4
            if col_idx < axes.shape[1] and row < axes.shape[0]:
                top_n = self.df[col].value_counts().head(10)
                top_n.plot(kind="barh", ax=axes[row][col_idx])
                axes[row][col_idx].set_title(f"{col} (Top 10)")

        plt.tight_layout()
        plt.savefig("reports/categorical_analysis.png", dpi=150)
        plt.close()

    def full_report(self) -> None:
        """Run all EDA analyses"""
        print("Generating EDA report...")
        self.summary()
        self.correlation_matrix()
        self.distribution_plots()
        self.target_analysis()
        self.categorical_analysis()
        print("Report generation complete. Check the reports/ directory.")

# Usage example
# eda = EDARunner(df, target_col="price")
# eda.full_report()
```

---

## 4. AI Analysis Project Workflow

### Detailed Workflow Diagram

```
Data Acquisition   Preprocessing     Features        Modeling         Evaluation
┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ DB connect  │    │ Missing  │    │ Encoding │    │ Training │    │ Cross    │
│ API fetch   │───>│ Outliers │───>│ Scaling  │───>│ Hyper-   │───>│ Validat. │
│ CSV load    │    │ Dedup    │    │ Selection│    │ parameter│    │ Metrics  │
│ Web scrape  │    │ Type cast│    │ Creation │    │ Tuning   │    │ Visualiz.│
└─────────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
      │              │              │              │              │
      v              v              v              v              v
  data/raw/     data/processed/ src/features/  models/       reports/
```

### Code Example 5: Configuration-Driven Pipeline

```python
import yaml
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass
class ExperimentConfig:
    """Load experiment configuration from YAML"""
    name: str
    data_path: str
    target_column: str
    feature_columns: List[str]
    model_type: str = "random_forest"
    test_size: float = 0.2
    random_state: int = 42
    cv_folds: int = 5
    scoring: str = "f1"
    hyperparams: dict = field(default_factory=dict)
    preprocessing: dict = field(default_factory=lambda: {
        "scaler": "standard",
        "imputer": "median",
        "encoder": "onehot"
    })

    @classmethod
    def from_yaml(cls, path: str) -> "ExperimentConfig":
        with open(path, "r") as f:
            config = yaml.safe_load(f)
        return cls(**config)

    def to_yaml(self, path: str) -> None:
        import dataclasses
        with open(path, "w") as f:
            yaml.dump(dataclasses.asdict(self), f, default_flow_style=False)

    def validate(self) -> List[str]:
        """Validate configuration"""
        errors = []
        if not self.name:
            errors.append("name is required")
        if self.test_size <= 0 or self.test_size >= 1:
            errors.append("test_size must be between 0 and 1")
        if self.cv_folds < 2:
            errors.append("cv_folds must be 2 or greater")
        valid_models = ["random_forest", "gradient_boosting", "logistic_regression",
                        "xgboost", "lightgbm", "svm", "neural_network"]
        if self.model_type not in valid_models:
            errors.append(f"model_type must be one of {valid_models}")
        return errors

# config.yaml example:
"""
name: "house_price_prediction"
data_path: "data/processed/house_prices.csv"
target_column: "price"
feature_columns: ["area", "rooms", "age", "location"]
model_type: "gradient_boosting"
test_size: 0.2
random_state: 42
cv_folds: 5
scoring: "neg_root_mean_squared_error"
hyperparams:
  n_estimators: 500
  max_depth: 6
  learning_rate: 0.01
preprocessing:
  scaler: "robust"
  imputer: "knn"
  encoder: "target"
"""
```

---

## 5. Experiment Management

### The Importance of Experiment Management

```
Problems without experiment management:

  "The model accuracy was 92% last week,
   but I can't remember what the parameters were..."

  ├── Missing parameter records
  ├── Data version mismatches
  ├── Unable to track code changes
  └── Unable to reproduce results

With experiment management:

  Experiment: fraud_detection_v3
  ├── Run ID: abc123
  ├── Parameters: {max_depth: 5, lr: 0.01, ...}
  ├── Metrics: {f1: 0.923, auc: 0.968, ...}
  ├── Artifacts: model.joblib, confusion_matrix.png
  ├── Data Version: data/processed/v2.3
  ├── Git Commit: e4f5a6b
  └── Tags: ["production_candidate", "v3"]
```

### Code Example 6: Experiment Management with MLflow

```python
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import cross_val_score
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score,
    classification_report
)
import numpy as np
import json
import platform
from datetime import datetime

class ExperimentTracker:
    """MLflow-based experiment management class"""

    def __init__(self, experiment_name: str,
                 tracking_uri: str = "mlruns"):
        self.experiment_name = experiment_name
        mlflow.set_tracking_uri(tracking_uri)
        mlflow.set_experiment(experiment_name)

    def log_environment(self):
        """Log runtime environment information"""
        import sklearn
        mlflow.log_param("python_version", platform.python_version())
        mlflow.log_param("sklearn_version", sklearn.__version__)
        mlflow.log_param("os", f"{platform.system()} {platform.release()}")
        mlflow.log_param("timestamp", datetime.now().isoformat())

    def run_experiment(self, model, model_name, X_train, X_test,
                       y_train, y_test, params=None):
        """Run an experiment and log to MLflow"""
        with mlflow.start_run(run_name=model_name):
            # Environment info
            self.log_environment()

            # Log parameters
            mlflow.log_param("model_type", model_name)
            mlflow.log_param("n_train_samples", len(X_train))
            mlflow.log_param("n_test_samples", len(X_test))
            mlflow.log_param("n_features", X_train.shape[1])
            if params:
                mlflow.log_params(params)

            # Cross-validation
            cv_scores = cross_val_score(model, X_train, y_train,
                                        cv=5, scoring="f1")
            mlflow.log_metric("cv_f1_mean", cv_scores.mean())
            mlflow.log_metric("cv_f1_std", cv_scores.std())

            # Train model
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            y_prob = model.predict_proba(X_test)[:, 1] \
                     if hasattr(model, "predict_proba") else None

            # Log metrics
            metrics = {
                "test_accuracy": accuracy_score(y_test, y_pred),
                "test_f1": f1_score(y_test, y_pred),
            }
            if y_prob is not None:
                metrics["test_auc_roc"] = roc_auc_score(y_test, y_prob)

            mlflow.log_metrics(metrics)

            # Save model
            mlflow.sklearn.log_model(model, "model")

            # Classification report artifact
            report = classification_report(y_test, y_pred, output_dict=True)
            with open("classification_report.json", "w") as f:
                json.dump(report, f, indent=2)
            mlflow.log_artifact("classification_report.json")

            print(f"\n{model_name}:")
            print(f"  CV F1: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
            for metric_name, value in metrics.items():
                print(f"  {metric_name}: {value:.4f}")

            return metrics

    def compare_models(self, models_dict, X_train, X_test, y_train, y_test):
        """Run and compare multiple models"""
        results = {}
        for name, (model, params) in models_dict.items():
            metrics = self.run_experiment(
                model, name, X_train, X_test, y_train, y_test, params
            )
            results[name] = metrics

        # Model comparison table
        print("\n" + "=" * 60)
        print("Model Comparison")
        print("=" * 60)
        for name, metrics in results.items():
            print(f"  {name:30s}: F1={metrics['test_f1']:.4f}, "
                  f"Acc={metrics['test_accuracy']:.4f}")

        return results

# Usage example
# tracker = ExperimentTracker("fraud_detection")
# models = {
#     "RandomForest": (
#         RandomForestClassifier(n_estimators=100, random_state=42),
#         {"n_estimators": 100}
#     ),
#     "GradientBoosting": (
#         GradientBoostingClassifier(n_estimators=200, random_state=42),
#         {"n_estimators": 200}
#     ),
# }
# results = tracker.compare_models(models, X_train, X_test, y_train, y_test)
```

### Code Example 7: Seed Management for Reproducibility

```python
import random
import numpy as np
import os

def set_global_seed(seed: int = 42) -> None:
    """Set all random seeds at once"""
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)

    # PyTorch (if installed)
    try:
        import torch
        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    except ImportError:
        pass

    # TensorFlow (if installed)
    try:
        import tensorflow as tf
        tf.random.set_seed(seed)
    except ImportError:
        pass

    print(f"Global seed set to {seed}")

def log_environment_info() -> dict:
    """Collect runtime environment information"""
    import platform
    import sys

    info = {
        "python": sys.version,
        "platform": platform.platform(),
        "processor": platform.processor(),
    }

    # Versions of major libraries
    for lib in ["numpy", "pandas", "sklearn", "xgboost", "lightgbm",
                "torch", "tensorflow"]:
        try:
            mod = __import__(lib)
            info[f"{lib}_version"] = mod.__version__
        except ImportError:
            pass

    return info

# Call at the beginning of the project
set_global_seed(42)
env_info = log_environment_info()
print("Environment info:")
for key, value in env_info.items():
    print(f"  {key}: {value}")
```

---

## 6. Model Deployment

### Deployment Patterns

```
Model deployment options:

  1. Batch Inference
     ├── Run inference in bulk at regular intervals (daily/hourly)
     ├── Use cases: recommendations, report generation
     └── Tools: Airflow, Cloud Functions, cron

  2. Real-time Inference (REST API)
     ├── Respond to HTTP requests in real time
     ├── Use cases: fraud detection, chatbots
     └── Tools: FastAPI, Flask, Seldon

  3. Edge Inference
     ├── Run inference on-device (mobile, IoT)
     ├── Use cases: autonomous driving, smartphone apps
     └── Tools: TensorFlow Lite, ONNX Runtime

  4. Streaming Inference
     ├── Continuously infer on data streams
     ├── Use cases: log analysis, sensor data
     └── Tools: Kafka + ML, Flink, Spark Streaming
```

### Code Example 8: Model Serving with FastAPI

```python
"""
Basic model serving implementation

How to run:
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import joblib
import numpy as np
import pandas as pd
import logging
from datetime import datetime

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ML Model Serving API",
    description="Inference API for machine learning models",
    version="1.0.0"
)

# Load model
try:
    model = joblib.load("models/production_model.joblib")
    logger.info("Model loaded successfully")
except FileNotFoundError:
    logger.warning("Model file not found. Using dummy model.")
    model = None

class PredictionRequest(BaseModel):
    """Schema for inference request"""
    features: List[float] = Field(..., description="List of feature values")
    request_id: Optional[str] = Field(None, description="Request ID (for tracking)")

    class Config:
        json_schema_extra = {
            "example": {
                "features": [25.0, 50000.0, 3.5, 1.0],
                "request_id": "req-001"
            }
        }

class PredictionResponse(BaseModel):
    """Schema for inference response"""
    prediction: int
    probability: float
    request_id: Optional[str]
    model_version: str
    timestamp: str

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    """Inference endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    try:
        features = np.array(request.features).reshape(1, -1)
        prediction = int(model.predict(features)[0])
        probability = float(model.predict_proba(features).max())

        response = PredictionResponse(
            prediction=prediction,
            probability=probability,
            request_id=request.request_id,
            model_version="1.0.0",
            timestamp=datetime.now().isoformat()
        )

        logger.info(f"Prediction: {prediction}, Prob: {probability:.4f}, "
                     f"Request: {request.request_id}")
        return response

    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch")
def predict_batch(requests: List[PredictionRequest]):
    """Batch inference endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    features_batch = np.array([req.features for req in requests])
    predictions = model.predict(features_batch)
    probabilities = model.predict_proba(features_batch).max(axis=1)

    return [
        PredictionResponse(
            prediction=int(pred),
            probability=float(prob),
            request_id=req.request_id,
            model_version="1.0.0",
            timestamp=datetime.now().isoformat()
        )
        for pred, prob, req in zip(predictions, probabilities, requests)
    ]
```

---

## Comparison Tables

### AI Analysis Method Selection Guide

| Data Characteristics | Recommended Approach | Representative Algorithms | Output | Typical Use Cases |
|---|---|---|---|---|
| Labeled, continuous values | Supervised regression | Linear regression, XGBoost | Numeric | Price prediction, demand forecasting |
| Labeled, discrete values | Supervised classification | Logistic regression, RF | Category | Fraud detection, diagnosis |
| Unlabeled, structure discovery | Unsupervised clustering | K-means, DBSCAN | Cluster ID | Customer segmentation |
| Unlabeled, dimensionality reduction | Unsupervised dim. reduction | PCA, t-SNE, UMAP | Low-dim representation | Visualization, noise removal |
| Sequential decision-making | Reinforcement learning | Q-learning, PPO | Action policy | Game AI, robot control |
| Large text corpus | NLP | BERT, GPT | Text | Translation, summarization, classification |
| Images/video | Computer vision | CNN, ViT | Detection/classification | Autonomous driving, medical imaging |
| Time series | Time series forecasting | ARIMA, LSTM, Prophet | Future values | Demand forecasting, stock prediction |
| Small labeled dataset | Semi-supervised/transfer learning | Self-Training, Fine-tune | Classification/regression | High labeling cost scenarios |

### Tool Selection by Project Scale

| Item | Small scale (~10K rows) | Medium scale (~1M rows) | Large scale (100M+ rows) |
|---|---|---|---|
| Data processing | pandas | pandas + Dask / Polars | Spark / Polars |
| Model training | scikit-learn | XGBoost / LightGBM | Distributed training (Horovod) |
| Experiment management | Notebooks | MLflow | Kubeflow / Vertex AI |
| Deployment | Flask / FastAPI | Docker + Cloud Run | Kubernetes + Seldon |
| Compute environment | Local | GPU (Colab / SageMaker) | Multi-GPU cluster |
| Data version control | Git | DVC | Delta Lake / Iceberg |
| Feature store | None | Feast (local) | Feast / Tecton |
| Monitoring | Manual | Prometheus + Grafana | Evidently + dedicated tools |
| Cost estimate | Free to a few $/month | Tens to hundreds $/month | Thousands+ $/month |

### ML Framework Comparison

| Framework | Strengths | Learning Curve | Scalability | Community |
|---|---|---|---|---|
| scikit-learn | Classical ML in general | Low | Moderate | Very large |
| XGBoost | Gradient boosting | Low | High | Large |
| LightGBM | Fast gradient boosting | Low | Very high | Large |
| CatBoost | Categorical features | Low | High | Moderate |
| PyTorch | Deep learning | Moderate | Very high | Very large |
| TensorFlow | Deep learning, production | High | Very high | Very large |
| JAX | High-performance numerical computing | High | Very high | Growing |
| statsmodels | Statistical models | Moderate | Low | Moderate |

---

## Anti-Patterns

### Anti-Pattern 1: Data Leakage

```python
# BAD: Scaling includes test data
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)          # fit on all data → leakage!
X_train, X_test = train_test_split(X_scaled)

# GOOD: fit only on training data, then transform test data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)  # fit only on training data
X_test_scaled = scaler.transform(X_test)         # transform only
```

**Why it is dangerous**: Test data statistics leak into training, causing the model's generalization performance to be overestimated. Leakage is the cause of most cases where a model fails to perform as expected in production.

### Anti-Pattern 2: "Deep Learning First" Syndrome

```
Problem: Predicting sales with 1,000 rows of tabular data

BAD approach:
  "Let's use the latest Transformer model" → overfitting → degraded performance

GOOD approach:
  "Start with linear regression + feature engineering" → establish baseline
  → If improvement is needed, try XGBoost → only then consider NN

Decision criteria:
  ┌─────────────────────────────────────────────────────┐
  │ Data < 10,000     → Classical ML (gradient boosting)│
  │ Data 10K–100K     → Classical ML or shallow NN      │
  │ Data > 100K       → DL becomes an option            │
  │ Images/audio/text → DL recommended (regardless of   │
  │                     data size)                      │
  └─────────────────────────────────────────────────────┘
```

### Anti-Pattern 3: Lack of Reproducibility

```python
# BAD: Random seed not fixed
from sklearn.model_selection import train_test_split
X_train, X_test = train_test_split(X, y)  # Results differ each run

# GOOD: Fix random seed and also record environment info
import random, numpy as np, platform

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=SEED
)

# Record runtime environment
print(f"Python: {platform.python_version()}")
print(f"NumPy: {np.__version__}")
print(f"OS: {platform.system()} {platform.release()}")
```

### Anti-Pattern 4: Development Without a Baseline

```python
# BAD: Starting with a complex model right away
from sklearn.neural_network import MLPClassifier
model = MLPClassifier(hidden_layer_sizes=(256, 128, 64))
model.fit(X_train, y_train)

# GOOD: Establish a baseline first, then improve
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression

# Step 1: Simplest possible baseline
baseline = DummyClassifier(strategy="most_frequent")
baseline.fit(X_train, y_train)
baseline_score = baseline.score(X_test, y_test)
print(f"Baseline (most frequent prediction): {baseline_score:.4f}")

# Step 2: Simple linear model
lr = LogisticRegression(max_iter=1000)
lr.fit(X_train, y_train)
lr_score = lr.score(X_test, y_test)
print(f"Logistic Regression: {lr_score:.4f}")

# Step 3: Move to more complex models as needed
# (Proceed while confirming improvement over the baseline)
```

### Anti-Pattern 5: Insufficient Consideration of Production Environment

```
Gap between PoC and production environments:

  PoC                          Production
  ├── Batch processing         ├── Real-time processing
  ├── Static data              ├── Streaming data
  ├── Notebooks                ├── API / microservices
  ├── Local files              ├── Database / cloud
  ├── Manual execution         ├── Automated pipelines
  └── Accuracy only            └── Latency/throughput also

Countermeasures:
  - Design pipeline-aware code from the PoC stage
  - Benchmark model inference speed
  - Plan for data drift detection
  - Prepare rollback procedures
```

---

## Troubleshooting

### Common Issues and Solutions

| Problem | Symptom | Cause | Solution |
|---|---|---|---|
| Model does not learn | Accuracy same as baseline | No information in features | Check feature usefulness with EDA |
| Overfitting | High train / low test | Model too complex | Regularization, more data, feature reduction |
| Unstable scores | High variance across CV folds | Insufficient data or distribution skew | More data, stratified CV |
| Out of memory | MemoryError | Data too large | Use Dask, split processing, optimize dtypes |
| No reproducibility | Results differ each run | Seed not fixed | Use set_global_seed() |
| Accuracy drops after deployment | Performance degrades in production | Data drift | Monitoring, retraining pipeline |
| Slow training | Takes hours | Too many hyperparameters | Optuna + Pruning, LightGBM |

---

## FAQ

### Q1: What is the difference between a Data Scientist and an ML Engineer?

**A:** A data scientist focuses on "analysis, hypothesis testing, and discovering insights," while an ML engineer focuses on "production operation of models, scalability, and reliability." In small teams these roles are often combined, but in large organizations they are separated. Both require statistics, programming, and domain knowledge.

### Q2: What is the success rate of AI analysis projects?

**A:** A Gartner survey (2023) reported that approximately 85% of AI/ML projects never reach production. The main failure factors are: (1) unclear problem definition, (2) poor data quality, (3) insufficient alignment with business KPIs. Organizational and process failures are more common than technical ones.

### Q3: What are the tips for transitioning from PoC to production?

**A:** (1) Maintain production-quality code from the PoC stage, (2) build data pipeline automation early, (3) define monitoring metrics from the start, (4) conduct regular reviews with stakeholders to manage expectations. In particular, "do not bring notebooks directly into production" is critical.

### Q4: Is a GPU necessary?

**A:** A CPU is sufficient for classical ML on tabular data (e.g., XGBoost). GPUs are effectively essential for deep learning (images, text, audio). Using cloud GPUs such as Google Colab or AWS SageMaker can keep initial investment low.

### Q5: Which programming language should be used?

**A:** Python is the de facto standard. Its ecosystem (scikit-learn, PyTorch, TensorFlow, pandas, etc.) is overwhelmingly rich. R has strengths in statistical analysis, but Python dominates in ML engineering. For production systems where performance is critical, implementing inference in Rust or Go is also an option.

### Q6: What are the criteria for choosing between cloud and on-premises?

**A:** Recommend cloud when: (1) scalability is required, (2) GPU use is occasional, (3) team is distributed. Recommend on-premises when: (1) strict data security requirements, (2) GPUs are needed continuously, (3) running costs are important. A hybrid approach (develop on cloud, run production on-prem) is also common.

---

## Summary

| Item | Key Point |
|---|---|
| Lifecycle | CRISP-DM: iterative cycle of Business Understanding → Data Understanding → Preparation → Modeling → Evaluation → Deployment |
| Learning paradigms | Supervised (regression/classification), Unsupervised (clustering/dim. reduction), Reinforcement learning |
| Project design | Reproducibility (fixed seed), modularity (config-driven), quality (data validation) |
| EDA | Systematically investigate basic statistics, correlation analysis, distribution checks, and relationship to target |
| Experiment management | Track experiments with MLflow. Record parameters, metrics, and artifacts |
| Tool selection | Scale up incrementally according to project size. Start with minimal tooling |
| Deployment | Choose batch/real-time/edge. FastAPI is ideal for getting started |
| Key to success | Problem definition and data quality matter more than technology. Start from a baseline and improve incrementally |

---

## What to Read Next

- [01-data-preprocessing.md](./01-data-preprocessing.md) — Concrete methods for data preprocessing
- [02-ml-basics.md](./02-ml-basics.md) — Foundational ML theory and evaluation metrics
- [03-python-ml-stack.md](./03-python-ml-stack.md) — Setting up a Python ML development environment

---

## References

1. **Aurelien Geron** "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow" 3rd Edition, O'Reilly Media, 2022
2. **Pete Chapman et al.** "CRISP-DM 1.0: Step-by-step data mining guide" SPSS Inc., 2000 — https://www.datascience-pm.com/crisp-dm-2/
3. **Google** "Rules of Machine Learning: Best Practices for ML Engineering" — https://developers.google.com/machine-learning/guides/rules-of-ml
4. **MLOps Community** "MLOps Principles" — https://ml-ops.org/content/mlops-principles
5. **MLflow** "Open source platform for the machine learning lifecycle" — https://mlflow.org/
6. **FastAPI** "Modern, fast web framework for building APIs" — https://fastapi.tiangolo.com/
