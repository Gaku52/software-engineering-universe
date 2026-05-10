# Classification — Logistic Regression, SVM, Random Forest

> A comprehensive guide to the theory, implementation, and selection criteria for classification methods that predict discrete values (class labels)

## What You Will Learn in This Chapter

1. **Logistic Regression** — Sigmoid function, maximum likelihood estimation, and the principles of probabilistic classification
2. **Support Vector Machines (SVM)** — Margin maximization, the kernel trick, and soft margins
3. **Decision Trees** — Information gain, Gini impurity, and pruning
4. **Ensemble Learning** — How Random Forest and Gradient Boosting work, and when to use each
5. **Evaluation Metrics and Threshold Optimization** — Confusion matrix, ROC/PR curves, and handling class imbalance


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Regression — Linear/Polynomial/Ridge/Lasso](./00-regression.md)

---

## 1. Logistic Regression

### 1.1 How the Decision Boundary Works

```
Structure of Logistic Regression:

  Input x₁, x₂, ..., xₘ
       │
       v
  Linear combination: z = w₁x₁ + w₂x₂ + ... + wₘxₘ + b
       │
       v
  Sigmoid: σ(z) = 1 / (1 + e^(-z))
       │
       v
  Probability output: P(y=1|x) = σ(z) ∈ [0, 1]
       │
       v
  Threshold decision: ŷ = 1 if σ(z) ≥ 0.5 else 0

  Graph of σ(z):
  P(y=1)
  1.0 │              ___________
      │            /
  0.5 │-----------/
      │          /
  0.0 │_________/
      └──────────────────────── z
         -4  -2   0   2   4
```

### 1.2 Mathematics of Maximum Likelihood Estimation

```
■ Likelihood function
  L(w) = Π P(yᵢ|xᵢ; w)
       = Π σ(wᵀxᵢ)^yᵢ × (1 - σ(wᵀxᵢ))^(1-yᵢ)

■ Log-likelihood (to be maximized)
  ℓ(w) = Σ [yᵢ log σ(wᵀxᵢ) + (1-yᵢ) log(1 - σ(wᵀxᵢ))]

■ Cross-entropy loss (to be minimized) = -ℓ(w)/n

■ Gradient
  ∂ℓ/∂w = Σ (yᵢ - σ(wᵀxᵢ)) xᵢ

■ With regularization
  L1 regularization: ℓ(w) - λΣ|wⱼ|  → sparse solution
  L2 regularization: ℓ(w) - λΣwⱼ²   → smooth solution

  In scikit-learn: C = 1/λ (larger C = weaker regularization)
```

### Code Example 1: Logistic Regression from Scratch

```python
import numpy as np

class LogisticRegressionScratch:
    """Full scratch implementation of logistic regression"""

    def __init__(self, learning_rate=0.01, n_iter=1000, l2_lambda=0.0):
        self.lr = learning_rate
        self.n_iter = n_iter
        self.l2_lambda = l2_lambda
        self.weights = None
        self.bias = None
        self.history = []

    def _sigmoid(self, z):
        return 1 / (1 + np.exp(-np.clip(z, -500, 500)))

    def fit(self, X, y):
        n, m = X.shape
        self.weights = np.zeros(m)
        self.bias = 0.0

        for i in range(self.n_iter):
            z = X @ self.weights + self.bias
            y_pred = self._sigmoid(z)

            # Cross-entropy loss
            loss = -np.mean(
                y * np.log(y_pred + 1e-8) +
                (1 - y) * np.log(1 - y_pred + 1e-8)
            )
            if self.l2_lambda > 0:
                loss += self.l2_lambda / (2 * n) * np.sum(self.weights ** 2)

            # Gradient computation
            error = y_pred - y
            dw = (1 / n) * (X.T @ error) + (self.l2_lambda / n) * self.weights
            db = (1 / n) * np.sum(error)

            # Parameter update
            self.weights -= self.lr * dw
            self.bias -= self.lr * db

            self.history.append(loss)

        return self

    def predict_proba(self, X):
        z = X @ self.weights + self.bias
        return self._sigmoid(z)

    def predict(self, X, threshold=0.5):
        return (self.predict_proba(X) >= threshold).astype(int)

    def accuracy(self, X, y):
        return np.mean(self.predict(X) == y)


# Usage example
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

data = load_breast_cancer()
X, y = data.data, data.target
X = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = LogisticRegressionScratch(learning_rate=0.1, n_iter=500, l2_lambda=0.01)
model.fit(X_train, y_train)

print(f"Training accuracy: {model.accuracy(X_train, y_train):.4f}")
print(f"Test accuracy: {model.accuracy(X_test, y_test):.4f}")
```

### Code Example 1b: Detailed Logistic Regression Analysis (scikit-learn)

```python
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.datasets import load_breast_cancer

# Data preparation
data = load_breast_cancer()
X, y = data.data, data.target
feature_names = data.feature_names

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# Comparison of regularization strengths
print(f"{'C':>8s} {'Penalty':>8s} {'AUC':>10s} {'Non-zero':>8s}")
print("-" * 40)
for C in [0.001, 0.01, 0.1, 1.0, 10.0, 100.0]:
    for penalty in ['l1', 'l2']:
        solver = 'saga' if penalty == 'l1' else 'lbfgs'
        lr = LogisticRegression(
            C=C, penalty=penalty, solver=solver,
            max_iter=5000, random_state=42
        )
        scores = cross_val_score(lr, X_train_s, y_train, cv=5, scoring="roc_auc")
        lr.fit(X_train_s, y_train)
        n_nonzero = np.sum(np.abs(lr.coef_[0]) > 1e-4)
        print(f"{C:8.3f} {penalty:>8s} {scores.mean():10.4f} {n_nonzero:8d}")

# Feature importance of the best model
best_lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
best_lr.fit(X_train_s, y_train)

importance = pd.DataFrame({
    "feature": feature_names,
    "coefficient": best_lr.coef_[0],
    "abs_coef": np.abs(best_lr.coef_[0]),
    "odds_ratio": np.exp(best_lr.coef_[0])
}).sort_values("abs_coef", ascending=False).head(10)

print("\n--- Top 10 Important Features ---")
print(importance.to_string(index=False))

# Test evaluation
y_pred = best_lr.predict(X_test_s)
y_prob = best_lr.predict_proba(X_test_s)[:, 1]
print(f"\nAUC-ROC: {roc_auc_score(y_test, y_prob):.4f}")
print(classification_report(y_test, y_pred, target_names=data.target_names))
```

### 1.3 Extension to Multi-class Classification

```
■ One-vs-Rest (OvR)
  With K classes, train K binary classifiers
  Class k: binary classification of "class k or not"
  Prediction: select the class with the highest P(y=k|x)

■ One-vs-One (OvO)
  Train K(K-1)/2 binary classifiers
  Build a classifier for each pair (i, j)
  Prediction: decided by majority vote

■ Softmax Regression (Multi-class Logistic Regression)
  P(y=k|x) = exp(wₖᵀx) / Σⱼ exp(wⱼᵀx)
  Learn all classes simultaneously
  scikit-learn: multi_class="multinomial"

Practical selection:
  · Number of classes ≤ 10: Softmax (recommended)
  · Many classes: OvR (computational efficiency)
  · For SVM: OvO (scikit-learn default)
```

---

## 2. Support Vector Machines (SVM)

### 2.1 Margin Maximization and the Kernel Trick

```
Linear SVM (hard margin):

     Class +1: ●        Decision boundary: w·x + b = 0
     Class -1: ○
                         Margin
  x₂ │                 ←────→
     │  ●  ●         /  ____  \
     │    ●  ●      / /    \ \
     │      ●      / /      \ \  ← Support vectors
     │            / /        \ \    (points closest to the boundary)
     │    ───────/ /──────────\ \────
     │          / /            \ \
     │   ○  ○ / /    ○         \ \
     │  ○   ○                   ○
     └─────────────────────────────── x₁

Kernel trick (non-linear classification):

  Input space (not linearly separable)   Feature space (linearly separable)
  ┌──────────────┐                       ┌──────────────┐
  │  ○ ● ○       │                       │         ●    │
  │ ● ● ● ○      │  φ(x)                │   ●   ● ●   │
  │ ○ ● ● ○      │ ──────>              │  ────────── │
  │  ○ ○ ○       │                       │ ○   ○   ○   │
  │              │                       │○     ○      │
  └──────────────┘                       └──────────────┘
  Kernel K(xᵢ, xⱼ) = φ(xᵢ)·φ(xⱼ)
```

### 2.2 Mathematical Formulation of SVM

```
■ Hard-margin SVM (linearly separable case)
  Minimize: (1/2)||w||²
  Subject to: yᵢ(wᵀxᵢ + b) ≥ 1,  ∀i

■ Soft-margin SVM (non-linearly separable case)
  Minimize: (1/2)||w||² + C·Σξᵢ
  Subject to: yᵢ(wᵀxᵢ + b) ≥ 1 - ξᵢ,  ξᵢ ≥ 0

  C: penalty for misclassification
    Large C → smaller margin, fewer misclassifications (risk of overfitting)
    Small C → larger margin, tolerates misclassifications (focuses on generalization)

■ Major kernels
  Linear:    K(x, z) = xᵀz
  Polynomial: K(x, z) = (γxᵀz + r)^d
  RBF:       K(x, z) = exp(-γ||x - z||²)
  Sigmoid:   K(x, z) = tanh(γxᵀz + r)

■ γ parameter of the RBF kernel
  Large γ → narrow influence range per sample → complex boundary (risk of overfitting)
  Small γ → wide influence range per sample → smooth boundary (risk of underfitting)
```

### Code Example 2: Comparison of SVM Kernels

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.svm import SVC
from sklearn.datasets import make_moons, make_circles
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

# Generate non-linear data
X_moon, y_moon = make_moons(n_samples=300, noise=0.2, random_state=42)
X_circ, y_circ = make_circles(n_samples=300, noise=0.1, factor=0.5, random_state=42)

datasets = [("Moons", X_moon, y_moon), ("Circles", X_circ, y_circ)]
kernels = ["linear", "poly", "rbf", "sigmoid"]

fig, axes = plt.subplots(2, 4, figsize=(20, 10))

for row, (name, X, y) in enumerate(datasets):
    for col, kernel in enumerate(kernels):
        ax = axes[row][col]
        pipe = make_pipeline(StandardScaler(), SVC(kernel=kernel, gamma="auto"))
        scores = cross_val_score(pipe, X, y, cv=5)
        pipe.fit(X, y)

        # Draw decision boundary
        xx, yy = np.meshgrid(
            np.linspace(X[:, 0].min()-1, X[:, 0].max()+1, 200),
            np.linspace(X[:, 1].min()-1, X[:, 1].max()+1, 200)
        )
        Z = pipe.predict(np.c_[xx.ravel(), yy.ravel()]).reshape(xx.shape)
        ax.contourf(xx, yy, Z, alpha=0.3, cmap="coolwarm")
        ax.scatter(X[:, 0], X[:, 1], c=y, cmap="coolwarm", edgecolors="k", s=20)
        ax.set_title(f"{name} / {kernel}\nCV Acc={scores.mean():.3f}")

plt.tight_layout()
plt.savefig("reports/svm_kernels.png", dpi=150)
plt.close()
```

### Code Example 2b: SVM Hyperparameter Tuning

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.svm import SVC
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.datasets import load_breast_cancer

data = load_breast_cancer()
X, y = data.data, data.target

# Joint optimization of C and gamma (RBF kernel)
param_grid = {
    'svc__C': [0.01, 0.1, 1.0, 10.0, 100.0],
    'svc__gamma': ['scale', 'auto', 0.001, 0.01, 0.1, 1.0],
}

pipe = make_pipeline(StandardScaler(), SVC(kernel='rbf', probability=True))
grid = GridSearchCV(
    pipe, param_grid,
    cv=StratifiedKFold(5, shuffle=True, random_state=42),
    scoring='roc_auc', n_jobs=-1, verbose=0
)
grid.fit(X, y)

print(f"Best parameters: {grid.best_params_}")
print(f"Best AUC: {grid.best_score_:.4f}")

# Heatmap of C vs gamma
import pandas as pd
results = pd.DataFrame(grid.cv_results_)
# Heatmap only for numeric gamma values
numeric_results = results[results['param_svc__gamma'].apply(lambda x: isinstance(x, float))]
if len(numeric_results) > 0:
    pivot = numeric_results.pivot_table(
        values='mean_test_score',
        index='param_svc__C',
        columns='param_svc__gamma'
    )
    fig, ax = plt.subplots(figsize=(10, 6))
    import seaborn as sns
    sns.heatmap(pivot, annot=True, fmt='.4f', cmap='viridis', ax=ax)
    ax.set_xlabel('gamma')
    ax.set_ylabel('C')
    ax.set_title('SVM RBF Kernel: AUC Score for C x gamma')
    plt.tight_layout()
    plt.savefig("reports/svm_heatmap.png", dpi=150)
    plt.close()
```

---

## 3. Decision Trees

### 3.1 Decision Tree Algorithm

```
■ Split criteria

  Gini Impurity:
    G(t) = 1 - Σₖ pₖ²
    0 = completely pure, 0.5 = maximum impurity (for 2 classes)

  Entropy (Information Gain):
    H(t) = -Σₖ pₖ log₂(pₖ)
    0 = completely pure, 1 = maximum impurity (for 2 classes)

  Information Gain:
    IG = H(parent) - Σ (|child node i| / |parent|) × H(child node i)

■ Example visualization of a decision tree
                      [All data: 100 samples]
                     feature_A ≤ 5.0 ?
                    /              \
           [Left: 60]          [Right: 40]
         feature_B ≤ 3.2 ?    feature_C ≤ 7.0 ?
          /        \            /        \
    [30]        [30]       [25]       [15]
   Class=0    Class=1    Class=1    Class=0

■ Pruning
  · Pre-pruning: max_depth, min_samples_split, min_samples_leaf
  · Post-pruning: ccp_alpha (Cost-Complexity Pruning)
  · Pre-pruning has lower computational cost and is more common
```

### Code Example 2c: Decision Tree Visualization and Pruning

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.tree import DecisionTreeClassifier, plot_tree, export_text
from sklearn.model_selection import cross_val_score
from sklearn.datasets import load_iris

data = load_iris()
X, y = data.data, data.target

# Effect of pruning parameters
fig, axes = plt.subplots(2, 3, figsize=(24, 14))

configs = [
    ("max_depth=2", {"max_depth": 2}),
    ("max_depth=5", {"max_depth": 5}),
    ("max_depth=None (no limit)", {}),
    ("min_samples_leaf=10", {"min_samples_leaf": 10}),
    ("min_samples_split=20", {"min_samples_split": 20}),
    ("ccp_alpha=0.02", {"ccp_alpha": 0.02}),
]

for ax, (title, params) in zip(axes.flatten(), configs):
    tree = DecisionTreeClassifier(random_state=42, **params)
    scores = cross_val_score(tree, X, y, cv=5, scoring="accuracy")
    tree.fit(X, y)

    plot_tree(tree, ax=ax, feature_names=data.feature_names,
              class_names=data.target_names, filled=True,
              fontsize=7, max_depth=3)
    ax.set_title(f"{title}\nCV Acc={scores.mean():.3f} (depth={tree.get_depth()}, "
                 f"leaves={tree.get_n_leaves()})")

plt.tight_layout()
plt.savefig("reports/decision_tree_pruning.png", dpi=150)
plt.close()

# Cost-Complexity Pruning Path
tree_full = DecisionTreeClassifier(random_state=42)
tree_full.fit(X, y)

path = tree_full.cost_complexity_pruning_path(X, y)
ccp_alphas = path.ccp_alphas[:-1]  # Exclude last entry (single node)

train_scores = []
test_scores = []
for alpha in ccp_alphas:
    tree = DecisionTreeClassifier(ccp_alpha=alpha, random_state=42)
    scores = cross_val_score(tree, X, y, cv=5, scoring="accuracy")
    tree.fit(X, y)
    train_scores.append(tree.score(X, y))
    test_scores.append(scores.mean())

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(ccp_alphas, train_scores, "b-o", label="Train Accuracy", markersize=3)
ax.plot(ccp_alphas, test_scores, "r-o", label="CV Accuracy", markersize=3)
ax.set_xlabel("ccp_alpha")
ax.set_ylabel("Accuracy")
ax.set_title("Cost-Complexity Pruning Path")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("reports/ccp_pruning_path.png", dpi=150)
plt.close()
```

---

## 4. Ensemble Learning

### 4.1 Bagging vs Boosting

```
Bagging — Random Forest:

  Original data D
  ┌──────────┐
  │ Bootstrap sampling
  ├──────────┼──────────┼──────────┐
  │  D₁      │  D₂      │  D₃      │  ... Dₙ
  │  ↓       │  ↓       │  ↓       │
  │ Tree₁    │ Tree₂    │ Tree₃    │  ... Treeₙ
  │  ↓       │  ↓       │  ↓       │
  │ pred₁    │ pred₂    │ pred₃    │  ... predₙ
  └──────────┴──────────┴──────────┘
              │ Majority vote (classification) / Average (regression)
              v
          Final prediction

Boosting — GBM / XGBoost:

  Sequentially add weak learners:
  ┌────────┐   ┌────────┐   ┌────────┐
  │ Tree₁  │──>│ Tree₂  │──>│ Tree₃  │──> ... → Final prediction
  │        │   │ Learns  │   │ Learns  │
  │ Learns │   │ residual│   │ residual│
  │ overall│   │ 1       │   │ 2       │
  └────────┘   └────────┘   └────────┘
     ↓             ↓             ↓
  Residual₁ =  Residual₂ =  Residual₃ = ...
  y - ŷ₁      residual₁ - ŷ₂   residual₂ - ŷ₃

Stacking:
  ┌──────────────────────────────────┐
  │ Level 0: Multiple base models    │
  │  LR   RF   XGB   SVM   KNN     │
  │  ↓    ↓    ↓     ↓     ↓       │
  │ p₁   p₂   p₃    p₄    p₅      │
  │  └────┴────┴─────┴─────┘       │
  │           ↓                      │
  │ Level 1: Meta-model (LR, etc.)   │
  │           ↓                      │
  │       Final prediction           │
  └──────────────────────────────────┘
```

### Code Example 3: Random Forest Implementation and Analysis

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report
import matplotlib.pyplot as plt

# Data preparation
from sklearn.datasets import load_breast_cancer
data = load_breast_cancer()
X, y = data.data, data.target
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Analysis of hyperparameter effects
results = []
for n_est in [10, 50, 100, 200, 500]:
    for max_depth in [3, 5, 10, None]:
        rf = RandomForestClassifier(
            n_estimators=n_est, max_depth=max_depth,
            random_state=42, n_jobs=-1
        )
        scores = cross_val_score(rf, X_train, y_train, cv=5, scoring="f1")
        results.append({
            "n_estimators": n_est,
            "max_depth": max_depth or "None",
            "f1_mean": scores.mean(),
            "f1_std": scores.std()
        })

results_df = pd.DataFrame(results).sort_values("f1_mean", ascending=False)
print(results_df.head(10).to_string(index=False))

# Feature importance of the best model
best_rf = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42)
best_rf.fit(X_train, y_train)

importance = pd.DataFrame({
    "feature": data.feature_names,
    "importance": best_rf.feature_importances_
}).sort_values("importance", ascending=False).head(15)

fig, ax = plt.subplots(figsize=(10, 6))
ax.barh(importance["feature"], importance["importance"])
ax.set_xlabel("Importance (Gini Importance)")
ax.set_title("Random Forest Feature Importance Top 15")
ax.invert_yaxis()
plt.tight_layout()
plt.savefig("reports/rf_feature_importance.png", dpi=150)
plt.close()
```

### Code Example 3b: Permutation Importance and SHAP Values

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.inspection import permutation_importance
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.datasets import load_breast_cancer

data = load_breast_cancer()
X, y = data.data, data.target
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

rf = RandomForestClassifier(n_estimators=200, random_state=42)
rf.fit(X_train, y_train)

# Permutation Importance (computed on test data → more reliable)
perm_imp = permutation_importance(
    rf, X_test, y_test,
    n_repeats=30, random_state=42, n_jobs=-1
)

# Comparison: Gini Importance vs Permutation Importance
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 8))

# Gini Importance
sorted_idx = rf.feature_importances_.argsort()[-15:]
ax1.barh(data.feature_names[sorted_idx], rf.feature_importances_[sorted_idx])
ax1.set_title("Gini Importance (MDI)")
ax1.set_xlabel("Importance")

# Permutation Importance
sorted_idx_perm = perm_imp.importances_mean.argsort()[-15:]
ax2.barh(
    data.feature_names[sorted_idx_perm],
    perm_imp.importances_mean[sorted_idx_perm]
)
ax2.errorbar(
    perm_imp.importances_mean[sorted_idx_perm],
    range(15),
    xerr=perm_imp.importances_std[sorted_idx_perm],
    fmt='none', color='black', capsize=3
)
ax2.set_title("Permutation Importance (test data)")
ax2.set_xlabel("Accuracy decrease")

plt.tight_layout()
plt.savefig("reports/importance_comparison.png", dpi=150)
plt.close()

# SHAP values (requires shap package)
try:
    import shap

    explainer = shap.TreeExplainer(rf)
    shap_values = explainer.shap_values(X_test)

    # Summary Plot
    fig, ax = plt.subplots(figsize=(12, 8))
    shap.summary_plot(shap_values[1], X_test,
                      feature_names=data.feature_names, show=False)
    plt.tight_layout()
    plt.savefig("reports/shap_summary.png", dpi=150)
    plt.close()

    print("SHAP value computation complete")
except ImportError:
    print("shap package not installed: pip install shap")
```

### Code Example 4: Gradient Boosting Implementation

```python
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import GridSearchCV, cross_val_score
import xgboost as xgb
import lightgbm as lgb

# scikit-learn GBM
gb_sklearn = GradientBoostingClassifier(
    n_estimators=200, max_depth=5, learning_rate=0.1,
    subsample=0.8, random_state=42
)

# XGBoost
gb_xgb = xgb.XGBClassifier(
    n_estimators=200, max_depth=5, learning_rate=0.1,
    subsample=0.8, colsample_bytree=0.8,
    use_label_encoder=False, eval_metric="logloss",
    random_state=42
)

# LightGBM
gb_lgb = lgb.LGBMClassifier(
    n_estimators=200, max_depth=5, learning_rate=0.1,
    subsample=0.8, colsample_bytree=0.8,
    random_state=42, verbose=-1
)

models = {
    "sklearn GBM": gb_sklearn,
    "XGBoost": gb_xgb,
    "LightGBM": gb_lgb,
}

import time
for name, model in models.items():
    start = time.time()
    scores = cross_val_score(model, X_train, y_train, cv=5, scoring="f1")
    elapsed = time.time() - start
    print(f"{name:15s}  F1={scores.mean():.4f}+/-{scores.std():.4f}  "
          f"Time={elapsed:.2f}s")
```

### Code Example 4b: Detailed LightGBM Tuning

```python
import lightgbm as lgb
import numpy as np
from sklearn.model_selection import StratifiedKFold
import optuna

def objective(trial):
    """Hyperparameter optimization for LightGBM using Optuna"""

    params = {
        'n_estimators': trial.suggest_int('n_estimators', 50, 1000),
        'max_depth': trial.suggest_int('max_depth', 3, 12),
        'learning_rate': trial.suggest_float('learning_rate', 0.005, 0.3, log=True),
        'num_leaves': trial.suggest_int('num_leaves', 8, 256),
        'min_child_samples': trial.suggest_int('min_child_samples', 5, 100),
        'subsample': trial.suggest_float('subsample', 0.5, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
        'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 10.0, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 10.0, log=True),
        'random_state': 42,
        'verbose': -1,
    }

    model = lgb.LGBMClassifier(**params)

    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    scores = []
    for train_idx, val_idx in cv.split(X_train, y_train):
        X_tr, X_val = X_train[train_idx], X_train[val_idx]
        y_tr, y_val = y_train[train_idx], y_train[val_idx]

        model.fit(
            X_tr, y_tr,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(50, verbose=False)]
        )
        from sklearn.metrics import roc_auc_score
        y_pred = model.predict_proba(X_val)[:, 1]
        scores.append(roc_auc_score(y_val, y_pred))

    return np.mean(scores)


# Run optimization
study = optuna.create_study(direction='maximize')
study.optimize(objective, n_trials=50, timeout=300)

print(f"\nBest AUC: {study.best_value:.4f}")
print(f"Best parameters:")
for key, value in study.best_params.items():
    print(f"  {key}: {value}")
```

### Code Example 4c: Stacking Ensemble

```python
from sklearn.ensemble import StackingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
import xgboost as xgb

# Base models
estimators = [
    ('lr', make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))),
    ('rf', RandomForestClassifier(n_estimators=100, random_state=42)),
    ('xgb', xgb.XGBClassifier(n_estimators=100, use_label_encoder=False,
                                eval_metric='logloss', random_state=42)),
    ('svm', make_pipeline(StandardScaler(), SVC(probability=True, random_state=42))),
    ('knn', make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5))),
]

# Stacking
stacking = StackingClassifier(
    estimators=estimators,
    final_estimator=LogisticRegression(max_iter=1000),
    cv=5,
    stack_method='predict_proba',
    n_jobs=-1
)

# Comparison of each model and stacking
print(f"{'Model':20s} {'CV AUC':>10s}")
print("-" * 35)

for name, model in estimators:
    scores = cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc')
    print(f"{name:20s} {scores.mean():10.4f}")

scores = cross_val_score(stacking, X_train, y_train, cv=5, scoring='roc_auc')
print(f"{'Stacking':20s} {scores.mean():10.4f}")
```

---

## 5. Evaluation Metrics and Threshold Optimization

### 5.1 Confusion Matrix and Key Metrics

```
                Predicted: Positive    Predicted: Negative
Actual: Positive    TP (True Pos)       FN (False Neg)
Actual: Negative    FP (False Pos)      TN (True Neg)

Accuracy    = (TP + TN) / (TP + TN + FP + FN)
Precision   = TP / (TP + FP)  → "Of those predicted positive, the proportion truly positive"
Recall      = TP / (TP + FN)  → "Of all actual positives, the proportion correctly detected"
F1 Score    = 2 × P × R / (P + R)  → Harmonic mean of Precision and Recall
Specificity = TN / (TN + FP)  → "Of all actual negatives, the proportion correctly excluded"

■ Key metrics by task
  · Spam detection: prioritize Precision (avoid mislabeling legitimate email as spam)
  · Cancer screening: prioritize Recall (avoid missing cancer patients)
  · Fraud detection: prioritize Recall + high Precision → F1 Score
  · General classification: F1 Score or AUC-ROC
```

### 5.2 ROC Curve and PR Curve

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_curve, auc, precision_recall_curve,
    average_precision_score, RocCurveDisplay,
    PrecisionRecallDisplay
)

def plot_roc_and_pr_curves(models_dict, X_test, y_test):
    """Plot and compare ROC and PR curves for multiple models"""

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

    for name, model in models_dict.items():
        if hasattr(model, 'predict_proba'):
            y_prob = model.predict_proba(X_test)[:, 1]
        else:
            y_prob = model.decision_function(X_test)

        # ROC curve
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        roc_auc = auc(fpr, tpr)
        ax1.plot(fpr, tpr, linewidth=2, label=f'{name} (AUC={roc_auc:.3f})')

        # PR curve
        precision, recall, _ = precision_recall_curve(y_test, y_prob)
        ap = average_precision_score(y_test, y_prob)
        ax2.plot(recall, precision, linewidth=2, label=f'{name} (AP={ap:.3f})')

    # Finalize ROC curve
    ax1.plot([0, 1], [0, 1], 'k--', linewidth=1)
    ax1.set_xlabel('False Positive Rate')
    ax1.set_ylabel('True Positive Rate')
    ax1.set_title('ROC Curve')
    ax1.legend(loc='lower right')
    ax1.grid(True, alpha=0.3)

    # Finalize PR curve
    baseline = y_test.sum() / len(y_test)
    ax2.axhline(y=baseline, color='k', linestyle='--', linewidth=1,
                label=f'Random (AP={baseline:.3f})')
    ax2.set_xlabel('Recall')
    ax2.set_ylabel('Precision')
    ax2.set_title('Precision-Recall Curve')
    ax2.legend(loc='lower left')
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("reports/roc_pr_curves.png", dpi=150)
    plt.close()
```

### Code Example 5: Threshold Optimization

```python
import numpy as np
from sklearn.metrics import precision_recall_curve, f1_score
import matplotlib.pyplot as plt

def optimize_threshold(y_true, y_prob, metric="f1"):
    """Search for the optimal classification threshold"""
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)

    # Compute F1 score at each threshold
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-8)

    # Optimal threshold
    best_idx = np.argmax(f1_scores)
    best_threshold = thresholds[best_idx] if best_idx < len(thresholds) else 0.5
    best_f1 = f1_scores[best_idx]

    # Visualization
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ax1.plot(thresholds, precisions[:-1], label="Precision")
    ax1.plot(thresholds, recalls[:-1], label="Recall")
    ax1.plot(thresholds, f1_scores[:-1], label="F1", linewidth=2)
    ax1.axvline(best_threshold, color="r", linestyle="--",
                label=f"Optimal threshold={best_threshold:.3f}")
    ax1.set_xlabel("Threshold")
    ax1.set_ylabel("Score")
    ax1.set_title("Threshold vs Metrics")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(recalls, precisions)
    ax2.set_xlabel("Recall")
    ax2.set_ylabel("Precision")
    ax2.set_title("Precision-Recall Curve")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("reports/threshold_optimization.png", dpi=150)
    plt.close()

    print(f"Optimal threshold: {best_threshold:.4f}")
    print(f"Optimal F1: {best_f1:.4f}")
    return best_threshold

# Usage example
from sklearn.linear_model import LogisticRegression
model = LogisticRegression(max_iter=1000).fit(X_train_s, y_train)
y_prob = model.predict_proba(X_test_s)[:, 1]
best_th = optimize_threshold(y_test, y_prob)

# Predict with optimal threshold
y_pred_opt = (y_prob >= best_th).astype(int)
print(f"\nDefault threshold (0.5) F1: {f1_score(y_test, model.predict(X_test_s)):.4f}")
print(f"Optimal threshold ({best_th:.3f}) F1: {f1_score(y_test, y_pred_opt):.4f}")
```

---

## 6. Handling Class Imbalance

### 6.1 Sampling Methods

```python
import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, classification_report

# Generate imbalanced data (1:10 ratio)
X_imb, y_imb = make_classification(
    n_samples=10000, n_features=20,
    n_informative=10, n_redundant=5,
    weights=[0.9, 0.1],  # 90% vs 10%
    random_state=42
)

print(f"Class distribution: {np.bincount(y_imb)}")

# Comparison of countermeasures
from sklearn.utils.class_weight import compute_class_weight

results = {}

# 1. No treatment
lr_base = LogisticRegression(max_iter=1000)
scores = cross_val_score(lr_base, X_imb, y_imb, cv=5, scoring='f1')
results["No treatment"] = scores.mean()

# 2. class_weight='balanced'
lr_balanced = LogisticRegression(max_iter=1000, class_weight='balanced')
scores = cross_val_score(lr_balanced, X_imb, y_imb, cv=5, scoring='f1')
results["class_weight=balanced"] = scores.mean()

# 3. SMOTE (requires imblearn)
try:
    from imblearn.over_sampling import SMOTE
    from imblearn.pipeline import Pipeline as ImbPipeline

    smote_pipe = ImbPipeline([
        ('smote', SMOTE(random_state=42)),
        ('lr', LogisticRegression(max_iter=1000))
    ])
    scores = cross_val_score(smote_pipe, X_imb, y_imb, cv=5, scoring='f1')
    results["SMOTE"] = scores.mean()
except ImportError:
    print("imbalanced-learn not installed: pip install imbalanced-learn")

# 4. Random Forest + class_weight
rf_balanced = RandomForestClassifier(
    n_estimators=200, class_weight='balanced_subsample', random_state=42
)
scores = cross_val_score(rf_balanced, X_imb, y_imb, cv=5, scoring='f1')
results["RF+balanced_subsample"] = scores.mean()

print(f"\n{'Method':30s} {'F1':>8s}")
print("-" * 42)
for name, score in sorted(results.items(), key=lambda x: x[1], reverse=True):
    print(f"{name:30s} {score:8.4f}")
```

---

## 7. k-Nearest Neighbors (k-NN) and Naive Bayes

### 7.1 k-Nearest Neighbors

```python
import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
import matplotlib.pyplot as plt

# Optimize k
k_range = range(1, 31)
scores = []

for k in k_range:
    pipe = make_pipeline(
        StandardScaler(),
        KNeighborsClassifier(n_neighbors=k, weights='distance')
    )
    cv_scores = cross_val_score(pipe, X_train, y_train, cv=5, scoring='accuracy')
    scores.append(cv_scores.mean())

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(k_range, scores, 'b-o', markersize=5)
best_k = k_range[np.argmax(scores)]
ax.axvline(best_k, color='r', linestyle='--', label=f'Optimal k={best_k}')
ax.set_xlabel('k (number of neighbors)')
ax.set_ylabel('CV Accuracy')
ax.set_title('k-NN: Optimizing k')
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("reports/knn_optimization.png", dpi=150)
plt.close()
```

### 7.2 Naive Bayes

```python
from sklearn.naive_bayes import GaussianNB, MultinomialNB, BernoulliNB
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import MinMaxScaler
from sklearn.pipeline import make_pipeline

# Types of Naive Bayes and their use cases
nb_models = {
    "GaussianNB": GaussianNB(),  # Continuous features
    "MultinomialNB": make_pipeline(
        MinMaxScaler(), MultinomialNB()  # Count data (text classification)
    ),
    "BernoulliNB": BernoulliNB(),  # Binary features
}

print(f"{'Model':20s} {'CV Accuracy':>12s}")
print("-" * 35)
for name, model in nb_models.items():
    scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')
    print(f"{name:20s} {scores.mean():12.4f}")
```

---

## Comparison Tables

### Characteristics of Classification Algorithms

| Algorithm | Training Speed | Prediction Speed | Interpretability | Non-linear | Scaling Required | Missing Values |
|---|---|---|---|---|---|---|
| Logistic Regression | Fast | Very fast | High | No (possible with feature engineering) | Yes | No |
| SVM (linear) | Fast | Very fast | Medium | No | Yes | No |
| SVM (RBF) | Slow | Slow | Low | Yes | Yes | No |
| Decision Tree | Fast | Very fast | High | Yes | No | Partial |
| Random Forest | Medium | Medium | Medium | Yes | No | Partial |
| XGBoost / LightGBM | Medium | Fast | Low | Yes | No | Yes |
| k-NN | Not needed | Slow | Medium | Yes | Yes | No |
| Naive Bayes | Very fast | Very fast | High | No | Case-dependent | No |

### Methods for Handling Class Imbalance

| Method | Category | Description | Advantages | Disadvantages |
|---|---|---|---|---|
| class_weight="balanced" | Algorithm-side | Increase weight of minority class | Simple | Risk of overfitting |
| SMOTE | Oversampling | Generate synthetic samples for minority class | Increases data volume | Possible noise increase |
| ADASYN | Oversampling | Generate more samples near difficult ones | Adaptive | Computational cost |
| RandomUnderSampler | Undersampling | Randomly reduce majority class | Speeds up training | Information loss |
| TomekLinks | Undersampling | Remove noise near boundaries | Noise removal | Limited effect |
| Threshold adjustment | Post-processing | Optimize classification threshold | No model change needed | Requires validation data |
| Focal Loss | Loss function | Downweight easy examples | Effective | Requires custom implementation |
| Cost-sensitive learning | Loss function | Set asymmetric misclassification costs | Flexible | Difficult to set costs |

### Evaluation Metric Selection Guide

| Scenario | Recommended Metric | Reason |
|---|---|---|
| General classification with balanced data | Accuracy, F1 | Standard |
| Imbalanced data | F1, AUC-PR | Accuracy is biased toward majority class |
| Medical diagnosis (avoiding missed cases) | Recall, Sensitivity | Minimizing FN is most important |
| Spam detection | Precision | Minimizing FP is important |
| Ranking / information retrieval | AUC-ROC, MAP | Correctness of order matters |
| Multi-class classification | Macro F1, Weighted F1 | Balance of per-class performance |
| Probability output calibration | Brier Score, Log Loss | Accuracy of probabilities |
| Model comparison | AUC-ROC | Threshold-independent |

---

## Anti-patterns

### Anti-pattern 1: Over-relying on Accuracy in Multi-class Classification

```python
# BAD: Not looking at macro average
from sklearn.metrics import accuracy_score
print(f"Accuracy: {accuracy_score(y_test, y_pred)}")
# → A high score can be achieved just by predicting the majority class

# GOOD: Check per-class performance
from sklearn.metrics import classification_report
print(classification_report(y_test, y_pred))
# → Check precision, recall, f1 per class
# → A large gap between macro avg and weighted avg indicates imbalance effects
```

### Anti-pattern 2: Applying SVM to Large-Scale Data

```python
# BAD: Applying RBF SVM to 1 million records (O(n²)～O(n³), impractical)
from sklearn.svm import SVC
svc = SVC(kernel="rbf")
svc.fit(X_large, y_large)  # Out of memory or takes hours

# GOOD: Use linear SVM or GBM for large-scale data
from sklearn.svm import LinearSVC
# or
from sklearn.linear_model import SGDClassifier
sgd = SGDClassifier(loss="hinge", random_state=42)  # Equivalent to linear SVM
sgd.fit(X_large, y_large)  # O(n), fast

# If non-linear like RBF is needed
from sklearn.kernel_approximation import RBFSampler
rbf_feature = RBFSampler(gamma=1.0, n_components=100, random_state=42)
X_rbf = rbf_feature.fit_transform(X_large)
sgd.fit(X_rbf, y_large)  # Speed up with approximate kernel
```

### Anti-pattern 3: Misinterpreting Feature Importance

```python
# BAD: Judging feature importance based solely on Gini Importance
rf = RandomForestClassifier()
rf.fit(X_train, y_train)
print("Importance:", rf.feature_importances_)
# → High-cardinality features (many categories) are overestimated
# → Importance is split among correlated features

# GOOD: Also use Permutation Importance
from sklearn.inspection import permutation_importance
perm_imp = permutation_importance(rf, X_test, y_test, n_repeats=30)
# → Computed on test data, less affected by overfitting
# → More reliable when combined with SHAP values
```

### Anti-pattern 4: Data Leakage Inside Cross-validation

```python
# BAD: Apply SMOTE outside cross-validation
from imblearn.over_sampling import SMOTE
X_resampled, y_resampled = SMOTE().fit_resample(X, y)
scores = cross_val_score(model, X_resampled, y_resampled, cv=5)
# → Information from synthetic samples leaks into the validation fold

# GOOD: Apply SMOTE inside cross-validation using imblearn Pipeline
from imblearn.pipeline import Pipeline as ImbPipeline
pipe = ImbPipeline([
    ('smote', SMOTE(random_state=42)),
    ('model', LogisticRegression(max_iter=1000))
])
scores = cross_val_score(pipe, X, y, cv=5, scoring='f1')
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## FAQ

### Q1: What is the C parameter in Logistic Regression?

**A:** C is the inverse of Lasso's alpha (C = 1/alpha). A larger C means weaker regularization and a more complex model. A smaller C means stronger regularization and a simpler model. The standard approach is to search for the optimal value via CV. The default in scikit-learn is C=1.0. Using L1 penalty (solver='saga') yields a sparse solution, which also has a feature selection effect.

### Q2: How many trees (n_estimators) should Random Forest have?

**A:** In general, increasing n_estimators monotonically improves performance until it saturates at some point (it is not prone to overfitting). Values of 100–500 are common. The decision is a trade-off with computation time. Another approach is to monitor the OOB (Out-of-Bag) score transition to find the saturation point. max_features (the number of features considered at each split) often has a larger impact on performance.

### Q3: What is the difference between XGBoost and LightGBM?

**A:** XGBoost uses level-wise tree growth (layer by layer), while LightGBM uses leaf-wise tree growth (leaf by leaf). LightGBM is generally faster and better suited for large-scale data. Accuracy is comparable or slightly better for LightGBM in many cases. LightGBM has better direct support for categorical variables. CatBoost is specialized for handling categorical variables and can be used without preprocessing.

### Q4: What is the flowchart for choosing a classification model?

**A:** (1) First establish a baseline with Logistic Regression, (2) use Random Forest if there appear to be non-linear relationships between features, (3) use LightGBM/XGBoost if pushing for accuracy, (4) use Decision Tree or Logistic Regression + SHAP if interpretability is needed, (5) also consider SVM (RBF) for small datasets (<1000 samples), (6) use Naive Bayes as a baseline for text classification. Ultimately, compare multiple models and make decisions in combination with domain knowledge.

### Q5: Should I use ROC-AUC or PR-AUC?

**A:** ROC-AUC is recommended when classes are balanced; PR-AUC (Average Precision) is recommended when they are imbalanced. ROC-AUC tends to show overly optimistic scores on imbalanced data. For example, with 99:1 imbalance, predicting everything as the majority class still yields an ROC-AUC of 0.5, but PR-AUC would be around 0.01 (reflecting the imbalance).

### Q6: Which models have reliable probability outputs?

**A:** Logistic Regression probability outputs are the most calibrated. Random Forest tends to skew too close to 0/1, and SVM's decision_function is not a probability. GBM probability outputs are somewhat calibrated but not perfect. When probability calibration is important, use `CalibratedClassifierCV` or apply Platt scaling/Isotonic regression as post-processing.

---

## Summary

| Item | Key Points |
|---|---|
| Logistic Regression | Outputs probabilities. Highly interpretable. Ideal for baseline |
| SVM | Maximizes margin. Handles non-linearity via kernels. Suited for medium-scale data |
| Decision Tree | Most interpretable. Serves as the base for ensembles |
| Random Forest | Bagging + random feature selection. Resistant to overfitting. Parallelizable |
| Gradient Boosting | Sequentially learns residuals. Often achieves highest accuracy |
| k-NN | Simple and intuitive. Scaling required. Beware of the curse of dimensionality |
| Naive Bayes | Extremely fast. Baseline for text classification |
| Threshold adjustment | Default 0.5 is not always optimal. Optimize using PR curve |
| Class imbalance | Handle with class_weight, SMOTE, Focal Loss, etc. |

---

## Guides to Read Next

- [02-clustering.md](./02-clustering.md) — Unsupervised learning clustering methods
- [03-dimensionality-reduction.md](./03-dimensionality-reduction.md) — Dimensionality reduction

---

## References

1. **Christopher M. Bishop** "Pattern Recognition and Machine Learning" Springer, 2006
2. **Tianqi Chen, Carlos Guestrin** "XGBoost: A Scalable Tree Boosting System" KDD 2016
3. **Guolin Ke et al.** "LightGBM: A Highly Efficient Gradient Boosting Decision Tree" NeurIPS 2017
4. **scikit-learn** "Supervised Learning" — https://scikit-learn.org/stable/supervised_learning.html
5. **Leo Breiman** "Random Forests" Machine Learning, 2001
6. **Corinna Cortes, Vladimir Vapnik** "Support-Vector Networks" Machine Learning, 1995
7. **Nitesh V. Chawla et al.** "SMOTE: Synthetic Minority Over-sampling Technique" JAIR, 2002
8. **Scott M. Lundberg, Su-In Lee** "A Unified Approach to Interpreting Model Predictions" NeurIPS 2017
