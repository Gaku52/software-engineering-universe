# Regression — Linear / Polynomial / Ridge / Lasso

> Systematically understand regression techniques for predicting continuous values, including regularization

## What You Will Learn

1. **Mathematics of Linear Regression** — Principles of least squares, normal equations, and gradient descent
2. **Regularized Regression** — Overfitting suppression with Ridge (L2), Lasso (L1), and ElasticNet
3. **Polynomial Regression and Nonlinear Extensions** — Nonlinear feature transforms and appropriate degree selection
4. **Advanced Regression Methods** — Robust regression, Bayesian regression, and quantile regression
5. **Practical Regression Analysis** — Residual analysis, feature engineering, and pipeline construction


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Fundamentals of Linear Regression

### 1.1 Geometric Interpretation of Least Squares

```
y (target variable)
│
│         *
│       /  *
│     /   *     ŷ = β₀ + β₁x
│   / *
│ / *            Minimize the sum of squared residuals (y - ŷ)
│*
└──────────────── x (explanatory variable)

Normal equation: β = (X^T X)^(-1) X^T y

    Residual visualization:
    │    *
    │    |   ← residual e = y - ŷ
    │    ŷ
    │   /
    │  /
```

### 1.2 Assumptions of Linear Regression (Gauss-Markov Theorem)

```
Conditions for OLS (Ordinary Least Squares) to be the Best Linear Unbiased Estimator (BLUE):

1. Linearity:      y = Xβ + ε  (linear in parameters)
2. Unbiasedness:   E[ε] = 0    (expected value of errors is zero)
3. Homoscedasticity: Var(ε) = σ²I (constant error variance)
4. No autocorrelation: Cov(εᵢ, εⱼ) = 0  (i≠j, no correlation between errors)
5. Exogeneity:     Cov(X, ε) = 0    (explanatory variables and errors are uncorrelated)

Additional assumptions (for inference and testing):
6. Normality:      ε ~ N(0, σ²I)  (errors follow a normal distribution)
7. No multicollinearity: rank(X) = p    (no perfect linear dependence among features)

Impact when assumptions are violated:
  · Homoscedasticity violated → heteroscedasticity → use Weighted Least Squares (WLS)
  · No autocorrelation violated → autocorrelation → use Generalized Least Squares (GLS)
  · Multicollinearity → unstable coefficients → Ridge regression / VIF analysis
  · Normality violated → inaccurate test results → bootstrap method
```

### Code Example 1: Linear Regression Implementation (From Scratch)

```python
import numpy as np

class LinearRegressionFromScratch:
    """Full implementation of linear regression using least squares"""

    def __init__(self, method: str = "normal_equation"):
        self.method = method
        self.weights = None
        self.bias = None

    def fit(self, X: np.ndarray, y: np.ndarray,
            lr: float = 0.01, n_iter: int = 1000) -> "LinearRegressionFromScratch":
        n, m = X.shape

        if self.method == "normal_equation":
            # Normal equation: β = (X^T X)^(-1) X^T y
            X_b = np.c_[np.ones((n, 1)), X]
            theta = np.linalg.pinv(X_b.T @ X_b) @ X_b.T @ y
            self.bias = theta[0]
            self.weights = theta[1:]

        elif self.method == "gradient_descent":
            # Gradient descent
            self.weights = np.zeros(m)
            self.bias = 0.0
            self.history = []

            for i in range(n_iter):
                y_pred = X @ self.weights + self.bias
                error = y_pred - y

                # Compute gradients
                dw = (2 / n) * (X.T @ error)
                db = (2 / n) * np.sum(error)

                # Update parameters
                self.weights -= lr * dw
                self.bias -= lr * db

                # Record MSE
                mse = np.mean(error ** 2)
                self.history.append(mse)

        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return X @ self.weights + self.bias

    def r2_score(self, X: np.ndarray, y: np.ndarray) -> float:
        y_pred = self.predict(X)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        return 1 - ss_res / ss_tot

# Usage example
np.random.seed(42)
X = np.random.randn(100, 3)
y = 3 * X[:, 0] + 2 * X[:, 1] - 1 * X[:, 2] + 5 + np.random.randn(100) * 0.5

model = LinearRegressionFromScratch(method="normal_equation")
model.fit(X, y)
print(f"Weights: {model.weights.round(3)}")  # ≈ [3, 2, -1]
print(f"Bias: {model.bias:.3f}")              # ≈ 5
print(f"R²: {model.r2_score(X, y):.4f}")
```

### Code Example 1b: Gradient Descent Variants

```python
import numpy as np
import matplotlib.pyplot as plt

class GradientDescentVariants:
    """Various variants of gradient descent"""

    def __init__(self, n_features):
        self.weights = np.zeros(n_features)
        self.bias = 0.0

    def batch_gd(self, X, y, lr=0.01, n_iter=1000):
        """Batch gradient descent (uses all data)"""
        n = X.shape[0]
        history = []

        for i in range(n_iter):
            y_pred = X @ self.weights + self.bias
            error = y_pred - y

            self.weights -= lr * (2 / n) * (X.T @ error)
            self.bias -= lr * (2 / n) * np.sum(error)

            history.append(np.mean(error ** 2))

        return history

    def stochastic_gd(self, X, y, lr=0.01, n_iter=1000):
        """Stochastic gradient descent (updates one sample at a time)"""
        n = X.shape[0]
        history = []

        for i in range(n_iter):
            # Randomly shuffle
            indices = np.random.permutation(n)

            for idx in indices:
                xi = X[idx:idx+1]
                yi = y[idx:idx+1]
                y_pred = xi @ self.weights + self.bias
                error = y_pred - yi

                self.weights -= lr * 2 * (xi.T @ error).ravel()
                self.bias -= lr * 2 * error[0]

            # MSE at end of epoch
            y_pred_all = X @ self.weights + self.bias
            history.append(np.mean((y_pred_all - y) ** 2))

        return history

    def mini_batch_gd(self, X, y, lr=0.01, n_iter=1000, batch_size=32):
        """Mini-batch gradient descent"""
        n = X.shape[0]
        history = []

        for i in range(n_iter):
            indices = np.random.permutation(n)

            for start in range(0, n, batch_size):
                end = min(start + batch_size, n)
                batch_idx = indices[start:end]
                X_batch = X[batch_idx]
                y_batch = y[batch_idx]
                batch_n = X_batch.shape[0]

                y_pred = X_batch @ self.weights + self.bias
                error = y_pred - y_batch

                self.weights -= lr * (2 / batch_n) * (X_batch.T @ error)
                self.bias -= lr * (2 / batch_n) * np.sum(error)

            # MSE at end of epoch
            y_pred_all = X @ self.weights + self.bias
            history.append(np.mean((y_pred_all - y) ** 2))

        return history


# Comparison experiment
np.random.seed(42)
X = np.random.randn(500, 5)
true_w = np.array([3.0, -2.0, 1.5, 0.0, -1.0])
y = X @ true_w + 2.0 + np.random.randn(500) * 0.5

fig, ax = plt.subplots(figsize=(12, 6))

for method_name, method_fn in [
    ("Batch GD", lambda m: m.batch_gd(X, y, lr=0.01, n_iter=100)),
    ("SGD", lambda m: m.stochastic_gd(X, y, lr=0.001, n_iter=100)),
    ("Mini-Batch GD (32)", lambda m: m.mini_batch_gd(X, y, lr=0.01, n_iter=100)),
]:
    model = GradientDescentVariants(5)
    history = method_fn(model)
    ax.plot(history, label=method_name, linewidth=2)

ax.set_xlabel("Epoch")
ax.set_ylabel("MSE")
ax.set_title("Comparison of Gradient Descent Variants")
ax.legend()
ax.grid(True, alpha=0.3)
ax.set_yscale("log")
plt.tight_layout()
plt.savefig("reports/gd_variants.png", dpi=150)
plt.close()
```

---

## 2. Regularized Regression

### 2.1 Effect of Regularization

```
No Regularization (OLS)   Ridge (L2)              Lasso (L1)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Loss = MSE   │    │ Loss = MSE   │    │ Loss = MSE   │
│              │    │  + λΣβ²      │    │  + λΣ|β|     │
│              │    │              │    │              │
│ No weight    │    │ Shrinks      │    │ Drives       │
│ constraints  │    │ weights      │    │ weights to   │
│              │    │ (globally)   │    │ zero (sparse)│
│              │    │              │    │              │
│ High risk    │    │ Robust to    │    │ Feature      │
│ of overfitting│   │ multicollin. │    │ selection    │
└──────────────┘    └──────────────┘    └──────────────┘

ElasticNet = combination of L1 + L2
Loss = MSE + α×ρΣ|β| + α×(1-ρ)Σβ²
          ρ: L1 ratio (0 to 1)
```

### 2.2 Mathematical Understanding of Regularization

```
■ Interpretation as Constrained Optimization

  Ridge:  min ||y - Xβ||²   subject to  ||β||₂ ≤ t
  Lasso:  min ||y - Xβ||²   subject to  ||β||₁ ≤ t

  Geometric interpretation:
    Ridge → L2 constraint = circle (ellipse) → solution unlikely to fall on axis → not sparse
    Lasso → L1 constraint = diamond → solution likely at corners (on axis) → sparse

  ┌──────────────────────────────────┐
  │         Ridge (L2)               │
  │    Contour lines (MSE)           │
  │      ____                        │
  │     /    \    ○ ← L2 constraint (circle)  │
  │    |  *   |  │                    │
  │     \____/   │                    │
  │              │                    │
  │         Lasso (L1)               │
  │      ____                        │
  │     /    \  ◇ ← L1 constraint (diamond)  │
  │    |  *   | / \                   │
  │     \____/ │                     │
  │         Corner solution → βⱼ = 0 │
  └──────────────────────────────────┘

■ Bayesian Interpretation
  Ridge → Prior: β ~ N(0, 1/λ)       (normal distribution → MAP estimation)
  Lasso → Prior: β ~ Laplace(0, 1/λ) (Laplace distribution → MAP estimation)
```

### Code Example 2: Regularized Regression Comparison Experiment

```python
import numpy as np
import pandas as pd
from sklearn.linear_model import (
    LinearRegression, Ridge, Lasso, ElasticNet
)
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_val_score

# High-dimensional data with multicollinearity
np.random.seed(42)
n_samples, n_features = 100, 50
X = np.random.randn(n_samples, n_features)
# True model: only the first 5 variables matter
true_coef = np.zeros(n_features)
true_coef[:5] = [3, -2, 1.5, -1, 0.5]
y = X @ true_coef + np.random.randn(n_samples) * 0.5

models = {
    "Linear Regression (OLS)": LinearRegression(),
    "Ridge (α=1.0)": Ridge(alpha=1.0),
    "Ridge (α=10.0)": Ridge(alpha=10.0),
    "Lasso (α=0.1)": Lasso(alpha=0.1),
    "Lasso (α=1.0)": Lasso(alpha=1.0),
    "ElasticNet (α=0.1)": ElasticNet(alpha=0.1, l1_ratio=0.5),
}

print(f"{'Model':25s} {'CV R²':>10s} {'Non-zero coefs':>15s}")
print("-" * 55)
for name, model in models.items():
    pipe = make_pipeline(StandardScaler(), model)
    scores = cross_val_score(pipe, X, y, cv=5, scoring="r2")
    pipe.fit(X, y)
    coef = pipe.named_steps[type(model).__name__.lower()].coef_ \
           if hasattr(model, "coef_") else pipe[-1].coef_
    n_nonzero = np.sum(np.abs(coef) > 1e-6)
    print(f"{name:25s} {scores.mean():10.4f} {n_nonzero:15d}")
```

### Code Example 2b: From-Scratch Implementation of Regularized Regression

```python
import numpy as np

class RegularizedRegression:
    """From-scratch implementation of Ridge / Lasso / ElasticNet"""

    def __init__(self, alpha=1.0, l1_ratio=0.0, method='ridge'):
        """
        method: 'ridge', 'lasso', 'elasticnet'
        l1_ratio: proportion of L1 in ElasticNet (0=Ridge, 1=Lasso)
        """
        self.alpha = alpha
        self.l1_ratio = l1_ratio
        self.method = method
        self.weights = None
        self.bias = None

    def _ridge_fit(self, X, y):
        """Closed-form solution for Ridge regression"""
        n, m = X.shape
        X_b = np.c_[np.ones((n, 1)), X]
        # (X^T X + αI)^(-1) X^T y  (regularization not applied to bias)
        I = np.eye(m + 1)
        I[0, 0] = 0  # do not regularize the bias term
        theta = np.linalg.inv(X_b.T @ X_b + self.alpha * I) @ X_b.T @ y
        self.bias = theta[0]
        self.weights = theta[1:]

    def _lasso_fit(self, X, y, n_iter=1000, tol=1e-6):
        """Coordinate descent for Lasso regression"""
        n, m = X.shape
        self.weights = np.zeros(m)
        self.bias = np.mean(y)

        for iteration in range(n_iter):
            weights_old = self.weights.copy()

            for j in range(m):
                # Prediction excluding the j-th feature
                residual = y - self.bias - X @ self.weights + X[:, j] * self.weights[j]
                rho = X[:, j] @ residual / n

                # Soft thresholding
                if rho > self.alpha / 2:
                    self.weights[j] = (rho - self.alpha / 2) / (X[:, j] @ X[:, j] / n)
                elif rho < -self.alpha / 2:
                    self.weights[j] = (rho + self.alpha / 2) / (X[:, j] @ X[:, j] / n)
                else:
                    self.weights[j] = 0.0

            self.bias = np.mean(y - X @ self.weights)

            # Convergence check
            if np.max(np.abs(self.weights - weights_old)) < tol:
                break

    def _elasticnet_fit(self, X, y, n_iter=1000, tol=1e-6):
        """Coordinate descent for ElasticNet regression"""
        n, m = X.shape
        self.weights = np.zeros(m)
        self.bias = np.mean(y)

        l1_penalty = self.alpha * self.l1_ratio
        l2_penalty = self.alpha * (1 - self.l1_ratio)

        for iteration in range(n_iter):
            weights_old = self.weights.copy()

            for j in range(m):
                residual = y - self.bias - X @ self.weights + X[:, j] * self.weights[j]
                rho = X[:, j] @ residual / n

                denominator = (X[:, j] @ X[:, j] / n) + l2_penalty

                if rho > l1_penalty / 2:
                    self.weights[j] = (rho - l1_penalty / 2) / denominator
                elif rho < -l1_penalty / 2:
                    self.weights[j] = (rho + l1_penalty / 2) / denominator
                else:
                    self.weights[j] = 0.0

            self.bias = np.mean(y - X @ self.weights)

            if np.max(np.abs(self.weights - weights_old)) < tol:
                break

    def fit(self, X, y, **kwargs):
        if self.method == 'ridge':
            self._ridge_fit(X, y)
        elif self.method == 'lasso':
            self._lasso_fit(X, y, **kwargs)
        elif self.method == 'elasticnet':
            self._elasticnet_fit(X, y, **kwargs)
        return self

    def predict(self, X):
        return X @ self.weights + self.bias


# Usage example
np.random.seed(42)
X = np.random.randn(200, 20)
true_coef = np.zeros(20)
true_coef[:5] = [3.0, -2.0, 1.5, -1.0, 0.5]
y = X @ true_coef + 1.0 + np.random.randn(200) * 0.3

# Ridge
ridge = RegularizedRegression(alpha=1.0, method='ridge')
ridge.fit(X, y)
print(f"Ridge non-zero coefs: {np.sum(np.abs(ridge.weights) > 1e-4)}")

# Lasso
lasso = RegularizedRegression(alpha=0.1, method='lasso')
lasso.fit(X, y)
print(f"Lasso non-zero coefs: {np.sum(np.abs(lasso.weights) > 1e-4)}")

# ElasticNet
enet = RegularizedRegression(alpha=0.1, l1_ratio=0.5, method='elasticnet')
enet.fit(X, y)
print(f"ElasticNet non-zero coefs: {np.sum(np.abs(enet.weights) > 1e-4)}")
```

### Code Example 3: Regularization Parameter Optimization

```python
from sklearn.linear_model import RidgeCV, LassoCV, ElasticNetCV
import numpy as np
import matplotlib.pyplot as plt

# RidgeCV: find optimal α via cross-validation
alphas = np.logspace(-4, 4, 100)

ridge_cv = RidgeCV(alphas=alphas, cv=5)
ridge_cv.fit(X, y)
print(f"Ridge optimal α: {ridge_cv.alpha_:.4f}")

# LassoCV: efficient search along the regularization path
lasso_cv = LassoCV(cv=5, random_state=42, max_iter=10000)
lasso_cv.fit(X, y)
print(f"Lasso optimal α: {lasso_cv.alpha_:.4f}")
print(f"Lasso non-zero coefs: {np.sum(np.abs(lasso_cv.coef_) > 1e-6)}")

# ElasticNetCV: simultaneous optimization of α and l1_ratio
enet_cv = ElasticNetCV(
    l1_ratio=[0.1, 0.3, 0.5, 0.7, 0.9],
    cv=5, random_state=42, max_iter=10000
)
enet_cv.fit(X, y)
print(f"ElasticNet optimal α: {enet_cv.alpha_:.4f}, l1_ratio: {enet_cv.l1_ratio_:.2f}")

# Visualize regularization paths
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Ridge coefficient path
coefs_ridge = []
for a in alphas:
    ridge = Ridge(alpha=a)
    ridge.fit(X, y)
    coefs_ridge.append(ridge.coef_)

ax1.semilogx(alphas, coefs_ridge)
ax1.axvline(ridge_cv.alpha_, color="r", linestyle="--", label=f"Optimal α={ridge_cv.alpha_:.3f}")
ax1.set_xlabel("α (regularization strength)")
ax1.set_ylabel("Coefficient value")
ax1.set_title("Ridge Regularization Path")
ax1.legend()

# Lasso coefficient path
coefs_lasso = []
for a in alphas:
    lasso = Lasso(alpha=a, max_iter=10000)
    lasso.fit(X, y)
    coefs_lasso.append(lasso.coef_)

ax2.semilogx(alphas, coefs_lasso)
ax2.axvline(lasso_cv.alpha_, color="r", linestyle="--", label=f"Optimal α={lasso_cv.alpha_:.3f}")
ax2.set_xlabel("α (regularization strength)")
ax2.set_ylabel("Coefficient value")
ax2.set_title("Lasso Regularization Path")
ax2.legend()

plt.tight_layout()
plt.savefig("reports/regularization_paths.png", dpi=150)
plt.close()
```

---

## 3. Polynomial Regression

### Code Example 4: Polynomial Regression and Degree Selection

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline

# Generate nonlinear data
np.random.seed(42)
X = np.sort(np.random.uniform(-3, 3, 50)).reshape(-1, 1)
y = 0.5 * X.ravel()**3 - 2 * X.ravel()**2 + X.ravel() + np.random.randn(50) * 3

# Compare fits at each degree
degrees = [1, 2, 3, 5, 10, 20]
fig, axes = plt.subplots(2, 3, figsize=(15, 10))
X_plot = np.linspace(-3, 3, 200).reshape(-1, 1)

for ax, degree in zip(axes.flatten(), degrees):
    model = make_pipeline(
        PolynomialFeatures(degree),
        LinearRegression()
    )
    scores = cross_val_score(model, X, y, cv=5, scoring="neg_mean_squared_error")
    model.fit(X, y)
    y_plot = model.predict(X_plot)

    ax.scatter(X, y, s=20, alpha=0.6, label="Data")
    ax.plot(X_plot, y_plot, "r-", linewidth=2, label=f"Degree={degree}")
    ax.set_title(f"Degree={degree}, CV-MSE={-scores.mean():.2f}")
    ax.set_ylim(-40, 40)
    ax.legend()
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/polynomial_degrees.png", dpi=150)
plt.close()
```

### Code Example 4b: Visualizing the Bias-Variance Tradeoff

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_val_score

def bias_variance_decomposition(X, y, degrees, n_bootstraps=100):
    """Bias-variance decomposition via bootstrapping"""

    X_test = np.linspace(X.min(), X.max(), 200).reshape(-1, 1)
    n = len(X)

    results = {"degree": [], "bias_sq": [], "variance": [], "mse": []}

    for degree in degrees:
        predictions = np.zeros((n_bootstraps, len(X_test)))

        for b in range(n_bootstraps):
            # Bootstrap sample
            idx = np.random.choice(n, size=n, replace=True)
            X_boot, y_boot = X[idx], y[idx]

            model = make_pipeline(
                PolynomialFeatures(degree),
                Ridge(alpha=0.001)
            )
            model.fit(X_boot, y_boot)
            predictions[b] = model.predict(X_test).ravel()

        # True function (known in this case)
        y_true = 0.5 * X_test.ravel()**3 - 2 * X_test.ravel()**2 + X_test.ravel()

        mean_pred = predictions.mean(axis=0)
        bias_sq = np.mean((mean_pred - y_true) ** 2)
        variance = np.mean(predictions.var(axis=0))
        mse = bias_sq + variance

        results["degree"].append(degree)
        results["bias_sq"].append(bias_sq)
        results["variance"].append(variance)
        results["mse"].append(mse)

    return results


# Run
np.random.seed(42)
X = np.sort(np.random.uniform(-3, 3, 50)).reshape(-1, 1)
y = 0.5 * X.ravel()**3 - 2 * X.ravel()**2 + X.ravel() + np.random.randn(50) * 3

degrees = range(1, 16)
results = bias_variance_decomposition(X, y, degrees)

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(results["degree"], results["bias_sq"], "b-o", label="Bias²", linewidth=2)
ax.plot(results["degree"], results["variance"], "r-o", label="Variance", linewidth=2)
ax.plot(results["degree"], results["mse"], "g--o", label="MSE (Bias²+Variance)", linewidth=2)
ax.set_xlabel("Polynomial degree")
ax.set_ylabel("Error")
ax.set_title("Bias-Variance Tradeoff")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("reports/bias_variance_tradeoff.png", dpi=150)
plt.close()
```

---

## 4. Advanced Regression Methods

### 4.1 Robust Regression

```python
import numpy as np
from sklearn.linear_model import (
    HuberRegressor, RANSACRegressor, TheilSenRegressor,
    LinearRegression
)
from sklearn.model_selection import cross_val_score
import matplotlib.pyplot as plt

# Data with outliers
np.random.seed(42)
n = 100
X = np.random.randn(n, 1)
y = 3 * X.ravel() + 2 + np.random.randn(n) * 0.5

# Add outliers (10%)
outlier_idx = np.random.choice(n, size=10, replace=False)
y[outlier_idx] += np.random.randn(10) * 20

models = {
    "OLS (Standard Linear Regression)": LinearRegression(),
    "Huber Regression (ε=1.35)": HuberRegressor(epsilon=1.35),
    "RANSAC": RANSACRegressor(random_state=42),
    "Theil-Sen": TheilSenRegressor(random_state=42),
}

fig, axes = plt.subplots(2, 2, figsize=(14, 10))
X_plot = np.linspace(-3, 3, 100).reshape(-1, 1)

for ax, (name, model) in zip(axes.flatten(), models.items()):
    model.fit(X, y)
    y_pred = model.predict(X_plot)

    ax.scatter(X, y, alpha=0.5, s=30)
    ax.scatter(X[outlier_idx], y[outlier_idx], color='red', s=50,
               marker='x', label='Outliers')
    ax.plot(X_plot, y_pred, 'r-', linewidth=2, label=name)
    ax.set_title(name)
    ax.legend()
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/robust_regression.png", dpi=150)
plt.close()

# Performance comparison
print(f"{'Model':30s} {'Slope':>8s} {'Intercept':>10s}")
print("-" * 50)
for name, model in models.items():
    model.fit(X, y)
    coef = model.coef_[0] if hasattr(model, 'coef_') else model.estimator_.coef_[0]
    intercept = model.intercept_ if hasattr(model, 'intercept_') else model.estimator_.intercept_
    print(f"{name:30s} {coef:8.3f} {intercept:10.3f}")
print(f"{'(True values)':30s} {'3.000':>8s} {'2.000':>10s}")
```

### 4.2 Bayesian Linear Regression

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import BayesianRidge
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

# Bayesian linear regression — also outputs prediction uncertainty
np.random.seed(42)
X = np.sort(np.random.uniform(0, 10, 30)).reshape(-1, 1)
y = np.sin(X.ravel()) + np.random.randn(30) * 0.3

X_test = np.linspace(0, 10, 200).reshape(-1, 1)

# Bayesian Ridge (with polynomial features)
model = make_pipeline(
    PolynomialFeatures(degree=7),
    BayesianRidge(
        alpha_1=1e-6, alpha_2=1e-6,
        lambda_1=1e-6, lambda_2=1e-6,
        compute_score=True
    )
)
model.fit(X, y)

# Prediction and uncertainty
y_mean, y_std = model.predict(X_test, return_std=True)

fig, ax = plt.subplots(figsize=(12, 6))
ax.scatter(X, y, color='navy', s=40, label='Training data')
ax.plot(X_test, y_mean, 'r-', linewidth=2, label='Predicted mean')
ax.fill_between(
    X_test.ravel(),
    y_mean - 2 * y_std,
    y_mean + 2 * y_std,
    alpha=0.2, color='red',
    label='95% confidence interval'
)
ax.plot(X_test, np.sin(X_test.ravel()), 'g--', linewidth=1.5, label='True function')
ax.set_xlabel("x")
ax.set_ylabel("y")
ax.set_title("Bayesian Linear Regression — Prediction and Uncertainty")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("reports/bayesian_regression.png", dpi=150)
plt.close()
```

### 4.3 Quantile Regression

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import QuantileRegressor

# Data with heteroscedasticity
np.random.seed(42)
n = 200
X = np.random.uniform(0, 10, n).reshape(-1, 1)
y = 2 * X.ravel() + 3 + np.random.randn(n) * (0.5 + 0.3 * X.ravel())

X_test = np.linspace(0, 10, 100).reshape(-1, 1)

quantiles = [0.1, 0.25, 0.5, 0.75, 0.9]
colors = ['blue', 'cyan', 'red', 'cyan', 'blue']
linestyles = ['--', '-.', '-', '-.', '--']

fig, ax = plt.subplots(figsize=(12, 6))
ax.scatter(X, y, alpha=0.3, s=15, color='gray')

for q, color, ls in zip(quantiles, colors, linestyles):
    model = QuantileRegressor(quantile=q, alpha=0.01, solver='highs')
    model.fit(X, y)
    y_pred = model.predict(X_test)
    ax.plot(X_test, y_pred, color=color, linestyle=ls,
            linewidth=2, label=f'Q{int(q*100)}')

ax.set_xlabel("x")
ax.set_ylabel("y")
ax.set_title("Quantile Regression — Estimating Prediction Intervals")
ax.legend()
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("reports/quantile_regression.png", dpi=150)
plt.close()
```

---

## 5. Diagnosing and Addressing Multicollinearity

### 5.1 Diagnosis with VIF (Variance Inflation Factor)

```python
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

def calculate_vif(X, feature_names=None):
    """Calculate VIF (Variance Inflation Factor)"""
    if feature_names is None:
        feature_names = [f"x{i}" for i in range(X.shape[1])]

    vif_data = []
    for i in range(X.shape[1]):
        # Regress the i-th feature on all other features
        X_others = np.delete(X, i, axis=1)
        y_i = X[:, i]

        model = LinearRegression()
        model.fit(X_others, y_i)
        r2 = model.score(X_others, y_i)

        vif = 1 / (1 - r2) if r2 < 1 else float('inf')
        vif_data.append({
            "Feature": feature_names[i],
            "VIF": vif,
            "R²": r2,
            "Judgment": "No issue" if vif < 5 else ("Warning" if vif < 10 else "Multicollinearity")
        })

    return pd.DataFrame(vif_data)


# Usage example: data with multicollinearity
np.random.seed(42)
x1 = np.random.randn(100)
x2 = 2 * x1 + np.random.randn(100) * 0.1  # almost the same as x1
x3 = np.random.randn(100)                   # independent
x4 = x1 + x3 + np.random.randn(100) * 0.5  # combination of x1 and x3
x5 = np.random.randn(100)                   # independent

X = np.column_stack([x1, x2, x3, x4, x5])
feature_names = ["x1", "x2 (≈2*x1)", "x3 (independent)", "x4 (x1+x3)", "x5 (independent)"]

vif_result = calculate_vif(X, feature_names)
print("=== VIF Analysis Results ===")
print(vif_result.to_string(index=False))

print("\nJudgment criteria:")
print("  VIF < 5      : No issue")
print("  5 ≤ VIF < 10 : Warning (features with high correlation exist)")
print("  VIF ≥ 10     : Multicollinearity present (action required)")
```

### 5.2 Diagnosis via Condition Number

```python
import numpy as np
from sklearn.preprocessing import StandardScaler

def condition_number_analysis(X, feature_names=None):
    """Diagnose multicollinearity using condition number"""
    X_scaled = StandardScaler().fit_transform(X)

    # Singular value decomposition
    U, S, Vt = np.linalg.svd(X_scaled)
    condition_number = S[0] / S[-1]

    print(f"Condition number: {condition_number:.2f}")
    print(f"  < 30   : No issue")
    print(f"  30-100 : Moderate multicollinearity")
    print(f"  > 100  : Severe multicollinearity")

    # Information for each singular value
    print(f"\nSingular values:")
    for i, s in enumerate(S):
        print(f"  σ_{i+1} = {s:.4f}  (contribution: {s**2/np.sum(S**2)*100:.1f}%)")

    return condition_number
```

---

## 6. Feature Engineering and Preprocessing

### 6.1 Feature Transformations for Regression

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, RobustScaler,
    PowerTransformer, QuantileTransformer,
    PolynomialFeatures, SplineTransformer
)
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge
from sklearn.model_selection import cross_val_score

def create_feature_engineering_pipeline(X, y, feature_names):
    """Feature engineering pipeline for regression"""

    # Compare the effect of each transformation
    transformers = {
        "StandardScaler": StandardScaler(),
        "MinMaxScaler": MinMaxScaler(),
        "RobustScaler": RobustScaler(),
        "PowerTransformer (Yeo-Johnson)": PowerTransformer(method='yeo-johnson'),
        "QuantileTransformer (Normal)": QuantileTransformer(output_distribution='normal'),
    }

    print(f"{'Transformation':40s} {'CV R²':>10s}")
    print("-" * 55)

    for name, transformer in transformers.items():
        pipe = Pipeline([
            ("transform", transformer),
            ("model", Ridge(alpha=1.0))
        ])
        scores = cross_val_score(pipe, X, y, cv=5, scoring="r2")
        print(f"{name:40s} {scores.mean():10.4f} (+/- {scores.std():.4f})")


# Example of nonlinear transformations
def add_nonlinear_features(X, feature_names):
    """Manually add nonlinear features"""
    df = pd.DataFrame(X, columns=feature_names)

    # Log transformation (positive values only)
    for col in feature_names:
        if (df[col] > 0).all():
            df[f"log_{col}"] = np.log(df[col])

    # Square root transformation
    for col in feature_names:
        if (df[col] >= 0).all():
            df[f"sqrt_{col}"] = np.sqrt(df[col])

    # Interaction terms
    for i, col1 in enumerate(feature_names):
        for col2 in feature_names[i+1:]:
            df[f"{col1}_x_{col2}"] = df[col1] * df[col2]

    return df


# Spline transformation example
np.random.seed(42)
X = np.random.uniform(0, 10, (200, 1))
y = np.sin(X.ravel()) + 0.5 * X.ravel() + np.random.randn(200) * 0.3

import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

# 1. Linear
model_linear = Pipeline([
    ("scaler", StandardScaler()),
    ("model", Ridge(alpha=0.1))
])
model_linear.fit(X, y)

# 2. Polynomial
model_poly = Pipeline([
    ("poly", PolynomialFeatures(degree=5)),
    ("scaler", StandardScaler()),
    ("model", Ridge(alpha=0.1))
])
model_poly.fit(X, y)

# 3. Spline
model_spline = Pipeline([
    ("spline", SplineTransformer(n_knots=8, degree=3)),
    ("scaler", StandardScaler()),
    ("model", Ridge(alpha=0.1))
])
model_spline.fit(X, y)

X_test = np.linspace(0, 10, 200).reshape(-1, 1)

for ax, (name, model) in zip(axes, [
    ("Linear", model_linear),
    ("Polynomial (degree=5)", model_poly),
    ("B-Spline (knots=8)", model_spline)
]):
    y_pred = model.predict(X_test)
    cv_score = cross_val_score(model, X, y, cv=5, scoring="r2").mean()

    ax.scatter(X, y, alpha=0.3, s=10)
    ax.plot(X_test, y_pred, 'r-', linewidth=2)
    ax.set_title(f"{name}\nCV R² = {cv_score:.4f}")
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/feature_transformations.png", dpi=150)
plt.close()
```

---

## 7. Practical Regression Pipeline

### Code Example 5: Production-Quality Regression Pipeline

```python
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, PolynomialFeatures, OneHotEncoder
from sklearn.linear_model import Ridge
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

def build_regression_pipeline(
    numeric_features: list,
    categorical_features: list,
    poly_degree: int = 1
) -> Pipeline:
    """Build a production-quality regression pipeline"""

    numeric_transformer = Pipeline([
        ("scaler", StandardScaler()),
        ("poly", PolynomialFeatures(degree=poly_degree, include_bias=False)),
    ])

    categorical_transformer = Pipeline([
        ("onehot", OneHotEncoder(drop="first", handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer([
        ("num", numeric_transformer, numeric_features),
        ("cat", categorical_transformer, categorical_features),
    ])

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", Ridge()),
    ])

    return pipeline

# Usage example
df = pd.DataFrame({
    "sqft": np.random.uniform(500, 3000, 200),
    "bedrooms": np.random.choice([1, 2, 3, 4, 5], 200),
    "location": np.random.choice(["urban", "suburban", "rural"], 200),
    "age": np.random.uniform(0, 50, 200),
})
df["price"] = (
    200 * df["sqft"] + 50000 * df["bedrooms"]
    - 1000 * df["age"]
    + np.where(df["location"] == "urban", 100000, 0)
    + np.random.randn(200) * 20000
)

X = df.drop(columns=["price"])
y = df["price"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

pipe = build_regression_pipeline(
    numeric_features=["sqft", "bedrooms", "age"],
    categorical_features=["location"],
    poly_degree=2
)

param_grid = {
    "preprocessor__num__poly__degree": [1, 2, 3],
    "regressor__alpha": [0.01, 0.1, 1.0, 10.0, 100.0],
}

grid = GridSearchCV(pipe, param_grid, cv=5, scoring="neg_root_mean_squared_error")
grid.fit(X_train, y_train)

y_pred = grid.predict(X_test)
print(f"Best parameters: {grid.best_params_}")
print(f"RMSE: {np.sqrt(mean_squared_error(y_test, y_pred)):,.0f}")
print(f"MAE:  {mean_absolute_error(y_test, y_pred):,.0f}")
print(f"R²:   {r2_score(y_test, y_pred):.4f}")
```

### Code Example 5b: Comprehensive Regression Model Evaluation

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error,
    r2_score, mean_absolute_percentage_error
)
from scipy import stats

def comprehensive_regression_evaluation(y_true, y_pred, feature_names=None, model=None):
    """Comprehensive evaluation report for a regression model"""

    residuals = y_true - y_pred

    # Metrics
    metrics = {
        "R²": r2_score(y_true, y_pred),
        "Adjusted R²": None,  # computed later
        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),
        "MAE": mean_absolute_error(y_true, y_pred),
        "MAPE": mean_absolute_percentage_error(y_true, y_pred) * 100,
        "Max Error": np.max(np.abs(residuals)),
        "Median AE": np.median(np.abs(residuals)),
    }

    print("=== Regression Model Evaluation Report ===\n")
    for name, value in metrics.items():
        if value is not None:
            print(f"  {name:15s}: {value:,.4f}")

    # Residual analysis
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))

    # 1. Predicted vs Actual
    ax = axes[0, 0]
    ax.scatter(y_pred, y_true, alpha=0.5, s=20)
    lims = [min(y_true.min(), y_pred.min()), max(y_true.max(), y_pred.max())]
    ax.plot(lims, lims, 'r--', linewidth=2)
    ax.set_xlabel("Predicted values")
    ax.set_ylabel("Actual values")
    ax.set_title("Predicted vs Actual")
    ax.grid(True, alpha=0.3)

    # 2. Residuals vs Predicted (check homoscedasticity)
    ax = axes[0, 1]
    ax.scatter(y_pred, residuals, alpha=0.5, s=20)
    ax.axhline(y=0, color='r', linestyle='--', linewidth=2)
    ax.set_xlabel("Predicted values")
    ax.set_ylabel("Residuals")
    ax.set_title("Residuals vs Predicted")
    ax.grid(True, alpha=0.3)

    # 3. Q-Q plot (check normality)
    ax = axes[0, 2]
    stats.probplot(residuals, plot=ax)
    ax.set_title("Q-Q Plot (Normality of Residuals)")

    # 4. Histogram of residuals
    ax = axes[1, 0]
    ax.hist(residuals, bins=30, edgecolor='black', alpha=0.7, density=True)
    # Fit normal distribution
    mu, std = residuals.mean(), residuals.std()
    x_norm = np.linspace(residuals.min(), residuals.max(), 100)
    ax.plot(x_norm, stats.norm.pdf(x_norm, mu, std), 'r-', linewidth=2)
    ax.set_xlabel("Residuals")
    ax.set_ylabel("Density")
    ax.set_title(f"Residual Distribution (mean={mu:.2f}, std={std:.2f})")

    # 5. Scale-Location plot (homoscedasticity)
    ax = axes[1, 1]
    standardized_residuals = residuals / std
    ax.scatter(y_pred, np.sqrt(np.abs(standardized_residuals)), alpha=0.5, s=20)
    ax.set_xlabel("Predicted values")
    ax.set_ylabel("√|Standardized residuals|")
    ax.set_title("Scale-Location Plot")
    ax.grid(True, alpha=0.3)

    # 6. Autocorrelation of residuals
    ax = axes[1, 2]
    from statsmodels.graphics.tsaplots import plot_acf
    try:
        plot_acf(residuals, ax=ax, lags=20)
        ax.set_title("Residual Autocorrelation (ACF)")
    except ImportError:
        ax.bar(range(20), [np.corrcoef(residuals[:-i], residuals[i:])[0, 1]
                           if i > 0 else 1.0
                           for i in range(20)], alpha=0.7)
        ax.set_title("Residual Autocorrelation")

    plt.tight_layout()
    plt.savefig("reports/regression_evaluation.png", dpi=150)
    plt.close()

    # Statistical tests
    print("\n=== Statistical Tests ===")

    # Normality test (Shapiro-Wilk)
    if len(residuals) <= 5000:
        stat, p_value = stats.shapiro(residuals)
        print(f"  Shapiro-Wilk test: W={stat:.4f}, p={p_value:.4f}",
              "→ Normal" if p_value > 0.05 else "→ Not normal")

    # Durbin-Watson test (autocorrelation)
    dw = np.sum(np.diff(residuals) ** 2) / np.sum(residuals ** 2)
    print(f"  Durbin-Watson statistic: {dw:.4f}",
          "(≈2: no autocorrelation, <1.5: positive autocorrelation, >2.5: negative autocorrelation)")

    return metrics


# Usage example
# comprehensive_regression_evaluation(y_test, y_pred)
```

---

## 8. Regression Metrics in Detail

### 8.1 Metrics Overview

```
Metric         Formula                         Characteristics
─────────────────────────────────────────────────────────────────────
MSE            Σ(y-ŷ)²/n                       Squared error, sensitive to outliers
RMSE           √(MSE)                          Same unit as MSE
MAE            Σ|y-ŷ|/n                        Absolute error, robust to outliers
MAPE           Σ|(y-ŷ)/y|/n × 100              Percentage error, unstable when y is near 0
R²             1 - SS_res/SS_tot               Coefficient of determination; higher is better
Adjusted R²    1 - (1-R²)(n-1)/(n-p-1)         R² adjusted for number of features
AIC            n·ln(SS_res/n) + 2p             Model selection (lower is better)
BIC            n·ln(SS_res/n) + p·ln(n)         Higher penalty than AIC

Notes on R²:
  · R² = 0.9 does not necessarily mean high predictive accuracy
  · Adding features always increases R² → use Adjusted R²
  · Strongly affected by outliers
  · R² may be inappropriate for evaluating nonlinear models
```

### 8.2 Choosing the Right Regression Metric

```
Situation                       Recommended metric    Reason
───────────────────────────────────────────────────────────
General regression evaluation   RMSE + R²             Standard
Data with many outliers         MAE                   Robustness
Business reporting              MAPE                  Easy to understand
Model comparison (diff. # vars) Adjusted R²           Fair comparison
Model selection                 AIC / BIC             Information criterion
Time series forecasting         RMSE + MAE            Look at both
House price prediction          RMSLE                 Log scale
Demand forecasting              MAPE + WMAPE          Business KPI
```

---

## Comparison Tables

### Regression Method Selection Guide

| Method | Regularization | Feature selection | Multicollinearity | Compute cost | Use case |
|---|---|---|---|---|---|
| OLS (Linear Regression) | None | No | Weak | O(n*m^2) | Baseline, interpretability |
| Ridge (L2) | L2 | No | Strong | O(n*m^2) | Multicollinearity, all features matter |
| Lasso (L1) | L1 | Yes | Moderate | Iterative | Sparse model, feature selection |
| ElasticNet | L1+L2 | Yes | Strong | Iterative | High-dimensional, grouped features |
| Polynomial Regression | - | - | - | O(n*m^d) | Nonlinear relationships |
| Huber Regression | L2 | No | Moderate | Iterative | Few outliers |
| RANSAC | None | No | Weak | Iterative | Many outliers |
| Bayesian Regression | Prior | Yes | Strong | O(n*m^2) | Uncertainty estimation needed |
| Quantile Regression | - | - | - | Linear programming | Estimating prediction intervals |
| Spline Regression | - | - | - | O(n*k) | Smooth nonlinear relationships |

### Effect of Regularization Parameter α

| α value | Bias | Variance | Model complexity | Coefficient magnitude | Overfitting risk |
|---|---|---|---|---|---|
| α → 0 | Low | High | High | Large | High |
| Small α | Slightly low | Slightly high | Slightly high | Slightly large | Slightly high |
| Appropriate α | Moderate | Moderate | Appropriate | Appropriate | Low |
| Large α | High | Low | Low | Small | Low (underfitting) |
| α → ∞ | Maximum | Minimum | Zero model | ≈ 0 | None (underfitting) |

### Scaling Methods Comparison

| Method | Transform formula | Output range | Outlier robustness | When to use |
|---|---|---|---|---|
| StandardScaler | (x-μ)/σ | Roughly [-3, 3] | Low | Regularized regression (standard) |
| MinMaxScaler | (x-min)/(max-min) | [0, 1] | Low | NN, distance-based methods |
| RobustScaler | (x-Q2)/(Q3-Q1) | Variable | High | Many outliers |
| PowerTransformer | Box-Cox / Yeo-Johnson | Roughly normal | Moderate | Skewed distributions |
| QuantileTransformer | Quantile transform | [0,1] or N(0,1) | High | Nonlinear relationships |

---

## Anti-Patterns

### Anti-Pattern 1: Regularization Without Scaling

```python
# BAD: regularization without scaling → features with large units are unfairly penalized
from sklearn.linear_model import Lasso

# Area (m², 10~200) vs. number of rooms (1~5) → area coefficient tends to be small
lasso = Lasso(alpha=1.0)
lasso.fit(X_train, y_train)  # unfair regularization

# GOOD: normalize with StandardScaler before regularization
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

pipe = make_pipeline(StandardScaler(), Lasso(alpha=1.0))
pipe.fit(X_train, y_train)  # fair regularization
```

### Anti-Pattern 2: Evaluating Regression Models with R² Alone

```python
# BAD: high R² does not necessarily mean a good model
# R² = 0.95 but still inappropriate if residuals have autocorrelation or heteroscedasticity

# GOOD: always perform residual analysis
import matplotlib.pyplot as plt

y_pred = model.predict(X_test)
residuals = y_test - y_pred

fig, axes = plt.subplots(1, 3, figsize=(15, 4))

# 1. Residuals vs Predicted (check homoscedasticity)
axes[0].scatter(y_pred, residuals, alpha=0.5)
axes[0].axhline(y=0, color="r", linestyle="--")
axes[0].set_xlabel("Predicted values")
axes[0].set_ylabel("Residuals")
axes[0].set_title("Residuals vs Predicted")

# 2. Q-Q plot (check normality)
from scipy import stats
stats.probplot(residuals, plot=axes[1])
axes[1].set_title("Q-Q Plot")

# 3. Histogram of residuals
axes[2].hist(residuals, bins=30, edgecolor="black")
axes[2].set_title("Residual Distribution")

plt.tight_layout()
plt.savefig("reports/residual_analysis.png", dpi=150)
```

### Anti-Pattern 3: Forgetting to Transform the Target Variable

```python
# BAD: using a right-skewed target variable (price, income) as-is
model = Ridge()
model.fit(X_train, y_train_skewed)  # pulled by outliers

# GOOD: apply log transform before training
import numpy as np

y_train_log = np.log1p(y_train_skewed)  # log(1 + y)
model.fit(X_train, y_train_log)

# Convert predictions back to original scale
y_pred_log = model.predict(X_test)
y_pred = np.expm1(y_pred_log)  # exp(y) - 1
```

### Anti-Pattern 4: Fitting on Test Data

```python
# BAD: fit_transform including test data
scaler = StandardScaler()
X_all_scaled = scaler.fit_transform(X_all)  # leaks test data information

# GOOD: fit on training data only, then transform test data
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)  # fit on training data
X_test_scaled = scaler.transform(X_test)          # transform only on test data

# BEST: use Pipeline for automatic management
from sklearn.pipeline import make_pipeline
pipe = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
pipe.fit(X_train, y_train)        # correct fit_transform internally
pipe.predict(X_test)               # correct transform internally
```

### Anti-Pattern 5: Ignoring Multicollinearity

```python
# BAD: feeding highly correlated features as-is
# Using both height (cm) and height (inch) → unstable coefficients

# GOOD: check with VIF analysis and take action
# Option 1: remove one of the correlated features
# Option 2: dimensionality reduction with PCA
# Option 3: use Ridge regression to handle multicollinearity

from sklearn.decomposition import PCA
pipe = make_pipeline(
    StandardScaler(),
    PCA(n_components=0.95),  # retain 95% of variance
    Ridge(alpha=1.0)
)
```

---

## FAQ

### Q1: Should I use Ridge or Lasso?

**A:** If many features are suspected to be irrelevant, use Lasso (it has feature selection capability). If all features are considered to be somewhat important, use Ridge. When there are groups of highly correlated features, Lasso tends to select only one from each group and zero out the rest, so ElasticNet is more stable. When in doubt, use ElasticNet and optimize both the L1/L2 ratio and α via cross-validation for safety.

### Q2: Can linear regression not capture nonlinear relationships?

**A:** By applying feature transformations (polynomial, log, square root, etc.), you can express nonlinear relationships while keeping the model linear in parameters. "Linear in parameters" and "linear in input" are separate concepts. `PolynomialFeatures` can automatically generate interaction and polynomial terms. `SplineTransformer` can flexibly capture piecewise nonlinearity.

### Q3: How do I determine the regularization strength (α)?

**A:** Cross-validation is the standard approach. scikit-learn's `RidgeCV`, `LassoCV`, and `ElasticNetCV` perform efficient cross-validation internally. The search range for α is typically set on a log scale (10^-4 to 10^4). `LassoCV` uses a regularization path algorithm, making it faster than trying individual α values.

### Q4: With many features, is it okay to rely on Lasso for automatic selection?

**A:** Lasso is convenient but not a silver bullet. (1) When highly correlated features are present, it selects only one arbitrarily (low reproducibility). (2) Selected features can vary significantly with different values of α. (3) Using Stability Selection (repeatedly running Lasso on random subsamples and choosing features selected frequently) provides more stable results.

### Q5: What special considerations are needed when the target variable is always positive (e.g., price, count)?

**A:** (1) Applying a log transform (`log1p`) before regression is the standard practice — it improves distributional skew and brings the data closer to the homoscedasticity assumption. (2) Steps to prevent negative predicted values are needed. (3) Consider using Generalized Linear Models (GLMs) such as Poisson regression or Gamma regression. scikit-learn's `PoissonRegressor` and `GammaRegressor` are available.

### Q6: How should I choose a regression model when the sample size is small?

**A:** (1) If the number of features exceeds the sample size, OLS is not applicable (rank deficiency) → Ridge/Lasso is required. (2) Leave-One-Out CV is effective (train on n-1, test on 1). (3) Bayesian regression stabilizes estimation by incorporating prior knowledge. (4) Set α larger (to prevent overfitting).

---

## Summary

| Item | Key points |
|---|---|
| Linear Regression | Least squares. Parameters estimated via normal equations or gradient descent |
| Ridge | L2 regularization. Robust to multicollinearity. Shrinks coefficients but does not zero them out |
| Lasso | L1 regularization. Zeros out coefficients of irrelevant features (sparsity) |
| ElasticNet | L1+L2. Combines the advantages of Lasso and Ridge |
| Polynomial Regression | Captures nonlinear relationships via feature transforms. High degree leads to overfitting |
| Robust Regression | Robust to outliers (Huber, RANSAC, Theil-Sen) |
| Bayesian Regression | Also outputs prediction uncertainty. Regularization via prior distribution |
| Preprocessing | Scaling required, VIF analysis, log transform, spline transform |
| Evaluation | Use residual analysis, RMSE, MAE, etc. — not just R² |

---

## Guides to Read Next

- [01-classification.md](./01-classification.md) — Theory and implementation of classification models
- [02-clustering.md](./02-clustering.md) — Unsupervised learning (clustering)

---

## References

1. **Trevor Hastie, Robert Tibshirani** "Statistical Learning with Sparsity: The Lasso and Generalizations" CRC Press, 2015
2. **scikit-learn** "Generalized Linear Models" — https://scikit-learn.org/stable/modules/linear_model.html
3. **Andrew Ng** "Machine Learning (Stanford CS229)" Lecture Notes — https://cs229.stanford.edu/
4. **Jerome Friedman, Trevor Hastie, Robert Tibshirani** "The Elements of Statistical Learning" Springer, 2009
5. **Peter J. Huber** "Robust Statistics" Wiley, 2004
6. **Christopher M. Bishop** "Pattern Recognition and Machine Learning" Springer, 2006
7. **Nicolai Meinshausen, Peter Buhlmann** "Stability Selection" JRSS Series B, 2010
