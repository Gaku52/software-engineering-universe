# Dimensionality Reduction — PCA, t-SNE, UMAP

> Explains techniques for compressing high-dimensional data into lower dimensions to enable visualization, noise removal, and computational efficiency

## What You Will Learn in This Chapter

1. **PCA (Principal Component Analysis)** — Maximizing data variance and reducing dimensions via linear projection
2. **t-SNE** — Visualizing high-dimensional data by preserving nonlinear local structure
3. **UMAP** — Fast nonlinear dimensionality reduction that also retains global structure
4. **Kernel PCA** — Nonlinear PCA using the kernel trick
5. **LDA (Linear Discriminant Analysis)** — Maximizing class separation through supervised dimensionality reduction
6. **Autoencoder** — Nonlinear dimensionality reduction using neural networks


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Clustering — K-means, DBSCAN, Hierarchical](./02-clustering.md)

---

## 1. PCA (Principal Component Analysis)

### Geometric Intuition of PCA

```
Original 2D space:              After PCA (direction of first principal component):

  y │    *   *                 PC1
    │   * * *  *              ←──────────────────────→
    │  *  *  *                  * * * * * * * *
    │ *  * *                    (Projected onto the direction of maximum variance)
    │*  *
    └──────────── x

  PCA procedure:
  1. Compute the covariance matrix C = (1/n) X^T X of the data
  2. Eigendecomposition of C → eigenvectors (principal component directions)
  3. Directions with larger eigenvalues explain more variance in the data
  4. Project onto the top k eigenvectors

  Explained variance ratio:
  ┌─────┬─────┬─────┬─────┬─────┬────┐
  │ PC1 │ PC2 │ PC3 │ PC4 │ PC5 │... │
  │ 45% │ 25% │ 15% │ 8%  │ 4%  │... │
  │█████│████ │███  │██   │█    │    │
  └─────┴─────┴─────┴─────┴─────┴────┘
  Cumulative 45%   70%   85%   93%   97%
  → Top 3 components retain 85% of the information
```

### 1.1 Mathematical Foundation of PCA

PCA reduces to the eigenvalue problem of the covariance matrix. After centering the data matrix X (n x d), eigendecompose the covariance matrix C = (1/n) X^T X and extract eigenvectors in descending order of eigenvalue.

```
Mathematical formulation:

  Input: X ∈ ℝ^(n×d) (centered data)
  Goal: Find W ∈ ℝ^(d×k) to project to Z = XW (n×k)

  Maximization problem:
    max_W  tr(W^T C W)
    s.t.   W^T W = I_k

  Solution: Matrix W formed by stacking the top k eigenvectors of C

  Eigendecomposition of the covariance matrix:
    C = V Λ V^T

    V = [v1, v2, ..., vd]  eigenvector matrix
    Λ = diag(λ1, λ2, ..., λd)  eigenvalues (λ1 ≥ λ2 ≥ ... ≥ λd)

  Explained variance ratio:
    Ratio for i-th principal component = λi / Σλj

  Relationship with SVD:
    X = U Σ V^T  (singular value decomposition)
    C = (1/n) V Σ^2 V^T
    → Right singular vectors V of SVD are the principal component directions
    → Squared singular values / n correspond to eigenvalues

  Advantages of using SVD:
    - No need to explicitly compute the covariance matrix → memory efficient
    - Numerically stable
    - scikit-learn's PCA uses SVD internally
```

### Code Example 1: PCA Implementation and Explained Variance Analysis

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import load_digits

# Handwritten digits data (64 dimensions)
digits = load_digits()
X, y = digits.data, digits.target

# Scaling
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# PCA: eigenvalue analysis with all components
pca_full = PCA()
pca_full.fit(X_scaled)

# Cumulative explained variance plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.bar(range(1, len(pca_full.explained_variance_ratio_) + 1),
        pca_full.explained_variance_ratio_, alpha=0.6, label="Individual ratio")
ax1.plot(range(1, len(pca_full.explained_variance_ratio_) + 1),
         np.cumsum(pca_full.explained_variance_ratio_), "ro-", label="Cumulative ratio")
ax1.axhline(y=0.95, color="g", linestyle="--", label="95% line")
ax1.set_xlabel("Principal component number")
ax1.set_ylabel("Explained variance ratio")
ax1.set_title("PCA Explained Variance Analysis")
ax1.legend()
ax1.grid(True, alpha=0.3)

# Number of dimensions retaining 95%
n_components_95 = np.argmax(np.cumsum(pca_full.explained_variance_ratio_) >= 0.95) + 1
print(f"Number of dimensions retaining 95% of variance: {n_components_95} / {X.shape[1]}")

# Project to 2D for visualization
pca_2d = PCA(n_components=2)
X_2d = pca_2d.fit_transform(X_scaled)

scatter = ax2.scatter(X_2d[:, 0], X_2d[:, 1], c=y, cmap="tab10", s=5, alpha=0.6)
ax2.set_xlabel(f"PC1 ({pca_2d.explained_variance_ratio_[0]:.1%})")
ax2.set_ylabel(f"PC2 ({pca_2d.explained_variance_ratio_[1]:.1%})")
ax2.set_title("PCA 2D Projection (Handwritten Digits)")
plt.colorbar(scatter, ax=ax2)

plt.tight_layout()
plt.savefig("reports/pca_analysis.png", dpi=150)
plt.close()
```

### Code Example 1b: PCA Implementation from Scratch

```python
import numpy as np

class PCAFromScratch:
    """
    PCA implemented from scratch.

    Why implement it yourself:
    - Understand the flow from covariance matrix → eigendecomposition
    - Grasp what scikit-learn's PCA does internally
    - Experience the difference from SVD-based implementation
    """

    def __init__(self, n_components: int = 2, method: str = "eigen"):
        """
        Parameters:
            n_components: Number of principal components to retain
            method: "eigen" (eigendecomposition) or "svd" (singular value decomposition)
        """
        self.n_components = n_components
        self.method = method
        self.components_ = None       # Principal component directions (k x d)
        self.explained_variance_ = None
        self.explained_variance_ratio_ = None
        self.mean_ = None

    def fit(self, X: np.ndarray) -> "PCAFromScratch":
        n_samples, n_features = X.shape

        # Step 1: Centering
        self.mean_ = np.mean(X, axis=0)
        X_centered = X - self.mean_

        if self.method == "eigen":
            # Step 2a: Compute covariance matrix
            cov_matrix = (1 / (n_samples - 1)) * X_centered.T @ X_centered

            # Step 3a: Eigendecomposition
            eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

            # Step 4a: Sort by descending eigenvalue
            sorted_idx = np.argsort(eigenvalues)[::-1]
            eigenvalues = eigenvalues[sorted_idx]
            eigenvectors = eigenvectors[:, sorted_idx]

            # Step 5a: Select top k
            self.components_ = eigenvectors[:, :self.n_components].T
            self.explained_variance_ = eigenvalues[:self.n_components]

        elif self.method == "svd":
            # Step 2b: SVD (without computing covariance matrix)
            U, S, Vt = np.linalg.svd(X_centered, full_matrices=False)

            # Step 3b: Compute eigenvalues from singular values
            eigenvalues = (S ** 2) / (n_samples - 1)

            # Step 4b: Select top k
            self.components_ = Vt[:self.n_components]
            self.explained_variance_ = eigenvalues[:self.n_components]

        # Compute explained variance ratio
        total_variance = np.sum(self.explained_variance_)
        # Total variance is the sum of all eigenvalues
        if self.method == "eigen":
            total_var_all = np.sum(eigenvalues)
        else:
            total_var_all = np.sum((S ** 2) / (n_samples - 1))

        self.explained_variance_ratio_ = self.explained_variance_ / total_var_all

        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Project data into principal component space"""
        X_centered = X - self.mean_
        return X_centered @ self.components_.T

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        self.fit(X)
        return self.transform(X)

    def inverse_transform(self, Z: np.ndarray) -> np.ndarray:
        """Back-project from principal component space to original space (approximate reconstruction)"""
        return Z @ self.components_ + self.mean_

    def reconstruction_error(self, X: np.ndarray) -> float:
        """Reconstruction error (measure of information loss)"""
        Z = self.transform(X)
        X_reconstructed = self.inverse_transform(Z)
        return np.mean((X - X_reconstructed) ** 2)

# Usage example: comparison with scikit-learn
from sklearn.decomposition import PCA as SklearnPCA
from sklearn.datasets import load_digits

digits = load_digits()
X = digits.data

# From-scratch implementation (SVD version)
pca_scratch = PCAFromScratch(n_components=10, method="svd")
Z_scratch = pca_scratch.fit_transform(X)

# scikit-learn
pca_sklearn = SklearnPCA(n_components=10)
Z_sklearn = pca_sklearn.fit_transform(X)

# Comparison of explained variance ratios (should match up to sign differences)
print("=== Explained Variance Ratio Comparison ===")
for i in range(5):
    print(f"  PC{i+1}: scratch={pca_scratch.explained_variance_ratio_[i]:.6f}, "
          f"sklearn={pca_sklearn.explained_variance_ratio_[i]:.6f}")

# Reconstruction error
error = pca_scratch.reconstruction_error(X)
print(f"\nReconstruction error (10 components): {error:.4f}")
print(f"Cumulative explained variance ratio: {sum(pca_scratch.explained_variance_ratio_):.4f}")
```

### 1.2 PCA Inverse Transform and Image Reconstruction

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.datasets import load_digits

digits = load_digits()
X = digits.data

# Visualize reconstruction with different numbers of components
n_components_list = [2, 5, 10, 20, 40, 64]
sample_idx = 42  # Sample to display

fig, axes = plt.subplots(2, len(n_components_list) + 1, figsize=(20, 6))

# Original image
for ax in axes[:, 0]:
    ax.imshow(X[sample_idx].reshape(8, 8), cmap="gray")
    ax.set_title("Original")
    ax.axis("off")

for col, n_comp in enumerate(n_components_list, 1):
    pca = PCA(n_components=n_comp)
    X_pca = pca.fit_transform(X)
    X_reconstructed = pca.inverse_transform(X_pca)

    # Reconstructed image
    axes[0][col].imshow(X_reconstructed[sample_idx].reshape(8, 8), cmap="gray")
    axes[0][col].set_title(f"k={n_comp}")
    axes[0][col].axis("off")

    # Difference image
    diff = np.abs(X[sample_idx] - X_reconstructed[sample_idx])
    axes[1][col].imshow(diff.reshape(8, 8), cmap="hot")
    axes[1][col].set_title(f"Error: {np.mean(diff**2):.2f}")
    axes[1][col].axis("off")

axes[1][0].set_visible(False)

plt.suptitle("PCA Reconstruction: Relationship Between Number of Components and Image Quality", fontsize=14)
plt.tight_layout()
plt.savefig("reports/pca_reconstruction.png", dpi=150)
plt.close()

# Plot reconstruction error progression
errors = []
cumvar = []
for k in range(1, 65):
    pca = PCA(n_components=k)
    X_pca = pca.fit_transform(X)
    X_rec = pca.inverse_transform(X_pca)
    errors.append(np.mean((X - X_rec) ** 2))
    cumvar.append(sum(pca.explained_variance_ratio_))

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
ax1.plot(range(1, 65), errors, "b-")
ax1.set_xlabel("Number of principal components")
ax1.set_ylabel("Mean squared reconstruction error")
ax1.set_title("Reconstruction Error vs. Number of Principal Components")
ax1.grid(True, alpha=0.3)

ax2.plot(range(1, 65), cumvar, "r-")
ax2.axhline(y=0.95, color="g", linestyle="--", label="95%")
ax2.set_xlabel("Number of principal components")
ax2.set_ylabel("Cumulative explained variance ratio")
ax2.set_title("Cumulative Explained Variance vs. Number of Principal Components")
ax2.legend()
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/pca_error_vs_components.png", dpi=150)
plt.close()
```

### 1.3 Incremental PCA (for Large-Scale Data)

```python
from sklearn.decomposition import IncrementalPCA
import numpy as np

# Batch-process large data with PCA (saves memory)
n_samples = 100000
n_features = 500
batch_size = 5000

# Process data in chunks
ipca = IncrementalPCA(n_components=50)

# partial_fit for each batch
for i in range(0, n_samples, batch_size):
    # In practice, read from a file, etc.
    X_batch = np.random.randn(min(batch_size, n_samples - i), n_features)
    ipca.partial_fit(X_batch)

print(f"IncrementalPCA training complete")
print(f"Cumulative explained variance ratio (50 components): {sum(ipca.explained_variance_ratio_):.4f}")

# Comparison with standard PCA
# When loading all data into memory:
# from sklearn.decomposition import PCA
# pca = PCA(n_components=50)
# pca.fit(X_all)  # ← memory error if X_all is too large

# IncrementalPCA is fine
# Can read from database or file in chunks
```

---

## 2. t-SNE

### How t-SNE Works

```
t-SNE in 2 steps:

Step 1: Pairwise similarities in high-dimensional space
  ┌──────────────────────────────────┐
  │ For each point pair (i,j)         │
  │ Compute conditional probability  │
  │ using a Gaussian distribution:   │
  │                                  │
  │ p(j|i) = exp(-||xi-xj||²/2σi²) │
  │           / Σk exp(...)          │
  │                                  │
  │ → Higher probability for closer points │
  └──────────────────────────────────┘
              │
              v
Step 2: Rearrangement in low-dimensional space
  ┌──────────────────────────────────┐
  │ Define similarity using t-distribution (heavy tail): │
  │                                  │
  │ q(j|i) = (1+||yi-yj||²)^(-1)   │
  │           / Σk (...)             │
  │                                  │
  │ Find y that minimizes KL(P||Q)   │
  │ → Close points stay close, far points stay far │
  └──────────────────────────────────┘

  Why t-distribution? → Solves the "Crowding Problem"
  Prevents mid-distance points in high dimensions from being squashed in low dimensions
```

### 2.1 Mathematical Details of t-SNE

```
Details of the Crowding Problem:

  High-dimensional space:
    - Around point xi there are "close" points, "mid-distance" points, and "far" points
    - Volume of a d-dimensional sphere is proportional to r^d
    - As d increases, the number of "mid-distance" points becomes enormous

  When projected to 2D:
    - Place "close" points nearby ← OK
    - Place the large number of "mid-distance" points at appropriate distances ← difficult
    - Not enough 2D area → points overlap = Crowding

  t-distribution solution:
    ┌─────────────────────────────────────┐
    │   Gaussian vs t-distribution (df=1) │
    │                                     │
    │   Gaussian: ∝ exp(-d²/2)           │
    │   t-dist:   ∝ (1 + d²)^(-1)        │
    │                                     │
    │   ←── Distance d from center ──→    │
    │   ▓▓                                │
    │   ▓▓▓▓                  ← Gaussian  │
    │   ▓▓▓▓▓▓                            │
    │   ████████████████████  ← t-dist    │
    │                                     │
    │   t-distribution has heavier tails  │
    │   → Stronger repulsion for "slightly far" points │
    │   → Alleviates Crowding             │
    └─────────────────────────────────────┘

  perplexity parameter:
    - Controls the effective number of "neighbors" for each point
    - perplexity ≈ 2^(entropy)
    - Small perplexity → emphasizes local structure
    - Large perplexity → also considers more global structure
    - Recommended: 5 ≤ perplexity ≤ 50 (no more than 1/3 of data size)
```

### Code Example 2: t-SNE Implementation and Perplexity Comparison

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.datasets import load_digits

digits = load_digits()
X, y = digits.data, digits.target

# Compare the effect of perplexity
perplexities = [5, 15, 30, 50, 100]
fig, axes = plt.subplots(1, len(perplexities), figsize=(25, 5))

for ax, perp in zip(axes, perplexities):
    tsne = TSNE(n_components=2, perplexity=perp, random_state=42,
                n_iter=1000, learning_rate="auto", init="pca")
    X_tsne = tsne.fit_transform(X)

    scatter = ax.scatter(X_tsne[:, 0], X_tsne[:, 1], c=y,
                         cmap="tab10", s=5, alpha=0.6)
    ax.set_title(f"perplexity={perp}")
    ax.set_xticks([])
    ax.set_yticks([])

plt.suptitle("t-SNE: Effect of Perplexity", fontsize=14)
plt.tight_layout()
plt.savefig("reports/tsne_perplexity.png", dpi=150)
plt.close()
```

### Code Example 2b: Visualizing the t-SNE Convergence Process

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.datasets import load_digits

digits = load_digits()
X, y = digits.data, digits.target

# Compare results with different iteration counts
n_iters = [50, 100, 250, 500, 1000, 2000]
fig, axes = plt.subplots(2, 3, figsize=(18, 12))

for ax, n_iter in zip(axes.flatten(), n_iters):
    tsne = TSNE(
        n_components=2,
        perplexity=30,
        n_iter=n_iter,
        random_state=42,
        init="pca",
        learning_rate="auto",
        method="barnes_hut",  # O(n log n) approximation
    )
    X_tsne = tsne.fit_transform(X)

    scatter = ax.scatter(X_tsne[:, 0], X_tsne[:, 1], c=y,
                         cmap="tab10", s=5, alpha=0.6)
    ax.set_title(f"n_iter={n_iter}, KL={tsne.kl_divergence_:.4f}")
    ax.set_xticks([])
    ax.set_yticks([])

plt.suptitle("t-SNE Convergence: Effect of Number of Iterations", fontsize=14)
plt.tight_layout()
plt.savefig("reports/tsne_convergence.png", dpi=150)
plt.close()
```

### 2.2 Pitfalls and Correct Interpretation of t-SNE

```
Notes on interpreting t-SNE results:

  ✓ Trustworthy information:
    - Points within the same cluster are close → local similarity exists
    - Clearly separated clusters → distinct groups in high dimensions too

  ✗ Untrustworthy information:
    - Distance between clusters → global distance relationships are not preserved
    - Cluster size → density is distorted (dense → expanded, sparse → compressed)
    - Cluster shape → unrelated to actual shape in high dimensions

  Common misconceptions:

  Wrong: "Two clusters are close in t-SNE → they are similar"
  Right: t-SNE does not preserve global distances. Changing perplexity can
         drastically change the relative positions of clusters.

  Wrong: "No separation in t-SNE → clusters do not exist"
  Right: The parameters may not be appropriate.
         Try changing perplexity.

  Wrong: "The axes of t-SNE have meaning"
  Right: The axes of t-SNE output are random directions. Invariant to rotation and reflection.
         Unlike PCA, axis interpretation is not possible.
```

---

## 3. UMAP

### 3.1 UMAP Algorithm Overview

```
UMAP (Uniform Manifold Approximation and Projection):

  Theoretical basis: Topology + Fuzzy set theory

  Step 1: Build a neighborhood graph in high-dimensional space
  ┌─────────────────────────────────────┐
  │ For each point xi:                   │
  │ 1. Find k-nearest neighbors          │
  │ 2. Scale local distances             │
  │ 3. Define neighborhood relationships │
  │    as fuzzy sets                     │
  │                                     │
  │ Similarity: w(xi, xj) =             │
  │   exp(-(d(xi,xj) - ρi) / σi)       │
  │                                     │
  │ ρi: distance to nearest neighbor of xi │
  │ σi: normalization parameter          │
  └─────────────────────────────────────┘
              │
              v
  Step 2: Optimization in low-dimensional space
  ┌─────────────────────────────────────┐
  │ Minimize cross-entropy:              │
  │                                     │
  │ CE = Σ w_h log(w_h/w_l)             │
  │    + Σ (1-w_h) log((1-w_h)/(1-w_l)) │
  │                                     │
  │ w_h: high-dimensional weights        │
  │ w_l: low-dimensional weights         │
  │ w_l = (1 + a||yi-yj||^(2b))^(-1)   │
  │                                     │
  │ Attraction: pull close points together │
  │ Repulsion: push far points apart     │
  └─────────────────────────────────────┘

  Differences from t-SNE:
  ┌──────────────────┬──────────────────┐
  │     t-SNE        │     UMAP         │
  ├──────────────────┼──────────────────┤
  │ KL divergence    │ Cross-entropy    │
  │ Symmetrized p_ij │ Fuzzy union      │
  │ Gaussian→t-dist  │ Fuzzy→parametric │
  │ Global structure ✗│ Global structure ○│
  │ transform N/A    │ transform available│
  │ O(n²) or O(n log n)│ O(n^1.14)     │
  └──────────────────┴──────────────────┘
```

### Code Example 3: UMAP Implementation and Comparison

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
import umap
from sklearn.datasets import load_digits
import time

digits = load_digits()
X, y = digits.data, digits.target

methods = {
    "PCA": lambda: PCA(n_components=2).fit_transform(X),
    "t-SNE": lambda: TSNE(n_components=2, random_state=42,
                           init="pca", learning_rate="auto").fit_transform(X),
    "UMAP": lambda: umap.UMAP(n_components=2, random_state=42).fit_transform(X),
}

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

for ax, (name, method) in zip(axes, methods.items()):
    start = time.time()
    X_2d = method()
    elapsed = time.time() - start

    scatter = ax.scatter(X_2d[:, 0], X_2d[:, 1], c=y, cmap="tab10",
                         s=5, alpha=0.6)
    ax.set_title(f"{name} ({elapsed:.2f}s)")
    ax.set_xticks([])
    ax.set_yticks([])

plt.suptitle("Comparison of Dimensionality Reduction Methods (Handwritten Digits)", fontsize=14)
plt.colorbar(scatter, ax=axes, shrink=0.8)
plt.tight_layout()
plt.savefig("reports/dim_reduction_comparison.png", dpi=150)
plt.close()
```

### Code Example 4: UMAP Hyperparameter Search

```python
import umap
import numpy as np
import matplotlib.pyplot as plt

n_neighbors_list = [5, 15, 50, 200]
min_dist_list = [0.0, 0.1, 0.5, 0.99]

fig, axes = plt.subplots(len(n_neighbors_list), len(min_dist_list),
                          figsize=(20, 20))

for i, nn in enumerate(n_neighbors_list):
    for j, md in enumerate(min_dist_list):
        reducer = umap.UMAP(n_neighbors=nn, min_dist=md,
                            n_components=2, random_state=42)
        X_umap = reducer.fit_transform(X)

        axes[i][j].scatter(X_umap[:, 0], X_umap[:, 1], c=y,
                           cmap="tab10", s=3, alpha=0.5)
        axes[i][j].set_title(f"nn={nn}, md={md}", fontsize=9)
        axes[i][j].set_xticks([])
        axes[i][j].set_yticks([])

    axes[i][0].set_ylabel(f"n_neighbors={nn}")

for j, md in enumerate(min_dist_list):
    axes[0][j].set_xlabel(f"min_dist={md}")

plt.suptitle("UMAP Parameter Grid", fontsize=14)
plt.tight_layout()
plt.savefig("reports/umap_params.png", dpi=150)
plt.close()
```

### 3.2 UMAP transform (Applying to New Data)

```python
import umap
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.datasets import load_digits

digits = load_digits()
X, y = digits.data, digits.target

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=42
)

# Train UMAP on training data
reducer = umap.UMAP(n_components=2, random_state=42)
X_train_2d = reducer.fit_transform(X_train)

# Apply transform to test data (not possible with t-SNE)
X_test_2d = reducer.transform(X_test)

# Visualization
import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

ax1.scatter(X_train_2d[:, 0], X_train_2d[:, 1], c=y_train,
            cmap="tab10", s=5, alpha=0.5)
ax1.set_title("Training data (fit_transform)")
ax1.set_xticks([])
ax1.set_yticks([])

ax2.scatter(X_test_2d[:, 0], X_test_2d[:, 1], c=y_test,
            cmap="tab10", s=5, alpha=0.5)
ax2.set_title("Test data (transform)")
ax2.set_xticks([])
ax2.set_yticks([])

plt.suptitle("UMAP: Applying to New Data", fontsize=14)
plt.tight_layout()
plt.savefig("reports/umap_transform.png", dpi=150)
plt.close()

# Pipeline of UMAP + classifier
from sklearn.pipeline import make_pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score

pipe = make_pipeline(
    umap.UMAP(n_components=10, random_state=42),
    RandomForestClassifier(n_estimators=100, random_state=42)
)

scores = cross_val_score(pipe, X, y, cv=5, scoring="accuracy")
print(f"UMAP(10) + RF: Accuracy = {scores.mean():.4f} ± {scores.std():.4f}")
```

### Code Example 5: Using Dimensionality Reduction as Preprocessing

```python
from sklearn.decomposition import PCA
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
import numpy as np

# Preprocess high-dimensional data with PCA
from sklearn.datasets import fetch_openml
# mnist = fetch_openml("mnist_784", version=1, as_frame=False)
# X, y = mnist.data[:10000], mnist.target[:10000]

# Sample: handwritten digits data
from sklearn.datasets import load_digits
digits = load_digits()
X, y = digits.data, digits.target

# Compare with and without PCA preprocessing
configs = [
    ("RF (all dims)", make_pipeline(
        StandardScaler(),
        RandomForestClassifier(n_estimators=100, random_state=42)
    )),
    ("PCA(95%) + RF", make_pipeline(
        StandardScaler(),
        PCA(n_components=0.95),  # Retain 95% of variance
        RandomForestClassifier(n_estimators=100, random_state=42)
    )),
    ("PCA(10) + RF", make_pipeline(
        StandardScaler(),
        PCA(n_components=10),
        RandomForestClassifier(n_estimators=100, random_state=42)
    )),
]

import time
for name, pipe in configs:
    start = time.time()
    scores = cross_val_score(pipe, X, y, cv=5, scoring="accuracy")
    elapsed = time.time() - start
    print(f"{name:20s}  Acc={scores.mean():.4f}±{scores.std():.4f}  "
          f"Time={elapsed:.2f}s")
```

---

## 4. Kernel PCA (Nonlinear PCA)

### 4.1 Extension via the Kernel Trick

```
Standard PCA:
  Linear projection → can only capture linear structure

Kernel PCA:
  1. Implicitly map to a higher-dimensional space using a kernel function
  2. Perform PCA in that high-dimensional space
  3. Project the result to lower dimensions

  Example kernel functions:
  ┌──────────────────────────────────────────┐
  │ RBF (Gaussian):                          │
  │   K(x, x') = exp(-γ||x - x'||²)        │
  │   → Mapping to infinite-dimensional space│
  │                                          │
  │ Polynomial:                              │
  │   K(x, x') = (γ x·x' + r)^d            │
  │   → Mapping to degree-d polynomial space │
  │                                          │
  │ Sigmoid:                                 │
  │   K(x, x') = tanh(γ x·x' + r)          │
  │   → Similar to neural network activation │
  └──────────────────────────────────────────┘

  When to use:
  - Data has nonlinear structure (e.g., concentric circles, spirals)
  - Classes that cannot be separated by PCA can be separated by Kernel PCA
  - Computational cost: O(n²), so not suitable for large-scale data
```

### Code Example 6: Kernel PCA Implementation and Comparison

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA, KernelPCA
from sklearn.datasets import make_moons, make_circles

# Nonlinear data: half-moon and concentric circles
datasets = {
    "Half-moon": make_moons(n_samples=500, noise=0.1, random_state=42),
    "Concentric circles": make_circles(n_samples=500, noise=0.05, factor=0.3, random_state=42),
}

fig, axes = plt.subplots(len(datasets), 4, figsize=(20, 10))

for row, (name, (X, y)) in enumerate(datasets.items()):
    # Original data
    axes[row][0].scatter(X[:, 0], X[:, 1], c=y, cmap="coolwarm", s=10)
    axes[row][0].set_title(f"{name}: Original data")

    # Standard PCA
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X)
    axes[row][1].scatter(X_pca[:, 0], X_pca[:, 1], c=y, cmap="coolwarm", s=10)
    axes[row][1].set_title("PCA")

    # Kernel PCA (RBF)
    kpca_rbf = KernelPCA(n_components=2, kernel="rbf", gamma=10)
    X_kpca_rbf = kpca_rbf.fit_transform(X)
    axes[row][2].scatter(X_kpca_rbf[:, 0], X_kpca_rbf[:, 1], c=y,
                          cmap="coolwarm", s=10)
    axes[row][2].set_title("Kernel PCA (RBF)")

    # Kernel PCA (Polynomial)
    kpca_poly = KernelPCA(n_components=2, kernel="poly", degree=3, gamma=1)
    X_kpca_poly = kpca_poly.fit_transform(X)
    axes[row][3].scatter(X_kpca_poly[:, 0], X_kpca_poly[:, 1], c=y,
                          cmap="coolwarm", s=10)
    axes[row][3].set_title("Kernel PCA (Poly)")

plt.tight_layout()
plt.savefig("reports/kernel_pca_comparison.png", dpi=150)
plt.close()
```

### Code Example 6b: Kernel PCA gamma Parameter Optimization

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import KernelPCA
from sklearn.model_selection import GridSearchCV
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.datasets import make_circles

X, y = make_circles(n_samples=1000, noise=0.1, factor=0.3, random_state=42)

# Grid search for gamma
gammas = [0.01, 0.1, 1, 5, 10, 50, 100]

fig, axes = plt.subplots(1, len(gammas), figsize=(28, 4))

for ax, gamma in zip(axes, gammas):
    kpca = KernelPCA(n_components=2, kernel="rbf", gamma=gamma)
    X_kpca = kpca.fit_transform(X)
    ax.scatter(X_kpca[:, 0], X_kpca[:, 1], c=y, cmap="coolwarm", s=5)
    ax.set_title(f"γ={gamma}")
    ax.set_xticks([])
    ax.set_yticks([])

plt.suptitle("Kernel PCA: Effect of gamma (RBF)", fontsize=14)
plt.tight_layout()
plt.savefig("reports/kpca_gamma.png", dpi=150)
plt.close()

# Search for optimal gamma using a pipeline
pipe = make_pipeline(
    KernelPCA(kernel="rbf"),
    LogisticRegression()
)

param_grid = {
    "kernelpca__n_components": [2, 5, 10],
    "kernelpca__gamma": [0.01, 0.1, 1, 10],
}

grid = GridSearchCV(pipe, param_grid, cv=5, scoring="accuracy")
grid.fit(X, y)

print(f"Best parameters: {grid.best_params_}")
print(f"Best score: {grid.best_score_:.4f}")
```

---

## 5. LDA (Linear Discriminant Analysis)

### 5.1 Principle of LDA

```
LDA (Linear Discriminant Analysis):
  Supervised dimensionality reduction — uses class labels to find optimal projection directions

  Goal: Maximize between-class variance & minimize within-class variance

  ┌──────────────────────────────────────────┐
  │                                          │
  │  Original space:    After LDA projection:│
  │                                          │
  │   ○ ○         ← Class A                 │
  │  ○ ○ ○        ← Class A    LDA          │
  │     △ △       ← Class B    ─→  ○○○○ △△△ │
  │    △ △ △      ← Class B        (Separated!) │
  │                                          │
  │  PCA: direction of maximum variance      │
  │  LDA: direction that best separates classes │
  │                                          │
  └──────────────────────────────────────────┘

  Mathematical formulation:
    Within-class scatter matrix: S_W = Σ_c Σ_{x∈c} (x - μ_c)(x - μ_c)^T
    Between-class scatter matrix: S_B = Σ_c n_c (μ_c - μ)(μ_c - μ)^T

    Maximize: J(w) = (w^T S_B w) / (w^T S_W w)
    Solution: Eigenvectors of S_W^(-1) S_B

    Maximum dimensions: min(d, C-1)  (C: number of classes)
    → For 10-class classification, up to 9 dimensions maximum
```

### Code Example 7: Comparison of LDA and PCA

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.decomposition import PCA
from sklearn.datasets import load_wine
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

# Wine dataset (13 dimensions, 3 classes)
wine = load_wine()
X, y = wine.data, wine.target

X_scaled = StandardScaler().fit_transform(X)

# Compare 2D projections of PCA vs LDA
pca = PCA(n_components=2)
lda = LinearDiscriminantAnalysis(n_components=2)

X_pca = pca.fit_transform(X_scaled)
X_lda = lda.fit_transform(X_scaled, y)  # LDA requires labels

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

for cls in np.unique(y):
    mask = y == cls
    ax1.scatter(X_pca[mask, 0], X_pca[mask, 1], label=f"Class {cls}", s=30, alpha=0.7)
    ax2.scatter(X_lda[mask, 0], X_lda[mask, 1], label=f"Class {cls}", s=30, alpha=0.7)

ax1.set_title(f"PCA 2D (Explained variance: {sum(pca.explained_variance_ratio_):.1%})")
ax1.legend()
ax1.grid(True, alpha=0.3)

ax2.set_title("LDA 2D (Supervised)")
ax2.legend()
ax2.grid(True, alpha=0.3)

plt.suptitle("PCA vs LDA: Wine Dataset", fontsize=14)
plt.tight_layout()
plt.savefig("reports/pca_vs_lda.png", dpi=150)
plt.close()

# Comparison of classification accuracy
for name, reducer in [("PCA(2)", PCA(n_components=2)),
                       ("PCA(5)", PCA(n_components=5)),
                       ("LDA(2)", LinearDiscriminantAnalysis(n_components=2))]:
    pipe = make_pipeline(StandardScaler(), reducer, LogisticRegression())
    scores = cross_val_score(pipe, X, y, cv=5, scoring="accuracy")
    print(f"{name:10s}  Accuracy = {scores.mean():.4f} ± {scores.std():.4f}")
```

---

## 6. Dimensionality Reduction with Autoencoders

### 6.1 Autoencoder Architecture

```
Autoencoder:
  Nonlinear dimensionality reduction using neural networks

  Input → Encoder → Bottleneck → Decoder → Reconstruction
  (d)     (d→h1→...→k)    (k)    (k→...→h1→d)  (d)

  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  Input     Hidden    Bottleneck   Hidden  Output│
  │  (784)    (256)      (32)         (256)  (784) │
  │                                                 │
  │   ○ ○      ○         ○             ○      ○ ○  │
  │   ○ ○      ○         ○             ○      ○ ○  │
  │   ○ ○      ○         ○             ○      ○ ○  │
  │   ○ ○      ○                       ○      ○ ○  │
  │   ○ ○                                    ○ ○  │
  │                                                 │
  │  Encoder ──→  Latent representation  ──→  Decoder │
  │                  (z ∈ ℝ^k)                     │
  │                                                 │
  │  Loss: L = ||x - x̂||²  (reconstruction error)  │
  │                                                 │
  │  Relationship with PCA:                         │
  │  - AE with linear activations = equivalent to PCA│
  │  - Nonlinear activations → more powerful dim reduction│
  └─────────────────────────────────────────────────┘
```

### Code Example 8: Autoencoder Implementation with PyTorch

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import load_digits
from sklearn.preprocessing import StandardScaler

# Data preparation
digits = load_digits()
X = StandardScaler().fit_transform(digits.data).astype(np.float32)
y = digits.target

X_tensor = torch.tensor(X)
dataset = TensorDataset(X_tensor, X_tensor)  # input = output
loader = DataLoader(dataset, batch_size=64, shuffle=True)

# Autoencoder model
class Autoencoder(nn.Module):
    def __init__(self, input_dim=64, latent_dim=2):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.Linear(32, input_dim),
        )

    def forward(self, x):
        z = self.encoder(x)
        x_hat = self.decoder(z)
        return x_hat, z

# Training
model = Autoencoder(input_dim=64, latent_dim=2)
optimizer = optim.Adam(model.parameters(), lr=0.001)
criterion = nn.MSELoss()

losses = []
for epoch in range(100):
    epoch_loss = 0
    for x_batch, _ in loader:
        x_hat, z = model(x_batch)
        loss = criterion(x_hat, x_batch)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        epoch_loss += loss.item()

    losses.append(epoch_loss / len(loader))
    if (epoch + 1) % 20 == 0:
        print(f"Epoch {epoch+1}: Loss = {losses[-1]:.6f}")

# Visualize latent space
model.eval()
with torch.no_grad():
    _, Z = model(X_tensor)
    Z = Z.numpy()

fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 5))

# Autoencoder 2D
scatter = ax1.scatter(Z[:, 0], Z[:, 1], c=y, cmap="tab10", s=5, alpha=0.6)
ax1.set_title("Autoencoder 2D")
ax1.set_xticks([])
ax1.set_yticks([])
plt.colorbar(scatter, ax=ax1)

# PCA 2D (for comparison)
from sklearn.decomposition import PCA
X_pca = PCA(n_components=2).fit_transform(X)
ax2.scatter(X_pca[:, 0], X_pca[:, 1], c=y, cmap="tab10", s=5, alpha=0.6)
ax2.set_title("PCA 2D")
ax2.set_xticks([])
ax2.set_yticks([])

# Learning curve
ax3.plot(losses)
ax3.set_xlabel("Epoch")
ax3.set_ylabel("Reconstruction Loss")
ax3.set_title("Learning Curve")
ax3.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/autoencoder_vs_pca.png", dpi=150)
plt.close()
```

---

## 7. Applications: Practical Use Cases for Dimensionality Reduction

### 7.1 Text Data Visualization

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
import umap
import matplotlib.pyplot as plt

# Text data (sample)
texts = [
    "machine learning is a subset of artificial intelligence",
    "deep learning uses neural networks with many layers",
    "natural language processing deals with text data",
    "computer vision focuses on image recognition",
    "reinforcement learning learns from rewards",
    "soccer is a popular sport worldwide",
    "basketball requires good physical fitness",
    "tennis is played on different surfaces",
    "swimming is both a sport and exercise",
    "baseball has nine players on a team",
    "python is a programming language",
    "javascript runs in web browsers",
    "rust focuses on memory safety",
    "go is designed for concurrency",
    "java is used in enterprise applications",
]
categories = ["AI"] * 5 + ["Sports"] * 5 + ["Programming"] * 5

# TF-IDF vectorization
vectorizer = TfidfVectorizer(stop_words="english")
X_tfidf = vectorizer.fit_transform(texts)
print(f"TF-IDF matrix shape: {X_tfidf.shape}")

# High-dimensional sparse → low-dimensional dense vector
# Step 1: Reduce to 50 dimensions with TruncatedSVD (supports sparse matrices)
svd = TruncatedSVD(n_components=min(10, X_tfidf.shape[1] - 1))
X_svd = svd.fit_transform(X_tfidf)

# Step 2: Visualize in 2D with UMAP
reducer = umap.UMAP(n_components=2, n_neighbors=5, random_state=42)
X_2d = reducer.fit_transform(X_svd)

# Visualization
color_map = {"AI": "red", "Sports": "blue", "Programming": "green"}
colors = [color_map[c] for c in categories]

plt.figure(figsize=(10, 8))
for cat in color_map:
    mask = [c == cat for c in categories]
    plt.scatter(X_2d[np.array(mask), 0], X_2d[np.array(mask), 1],
                c=color_map[cat], label=cat, s=100)

for i, text in enumerate(texts):
    short_text = text[:25] + "..." if len(text) > 25 else text
    plt.annotate(short_text, (X_2d[i, 0], X_2d[i, 1]),
                 fontsize=7, alpha=0.7)

plt.title("Dimensionality Reduction Visualization of Text Data")
plt.legend()
plt.tight_layout()
plt.savefig("reports/text_dim_reduction.png", dpi=150)
plt.close()
```

### 7.2 Image Feature Visualization (CNN + UMAP)

```python
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
from torchvision.datasets import CIFAR10
import numpy as np
import umap
import matplotlib.pyplot as plt

# Extract features with pretrained CNN
model = models.resnet18(pretrained=True)
model = torch.nn.Sequential(*list(model.children())[:-1])  # Remove final FC layer
model.eval()

transform = transforms.Compose([
    transforms.Resize(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# Subset of CIFAR-10
dataset = CIFAR10(root="./data", train=False, transform=transform, download=True)
loader = DataLoader(dataset, batch_size=128, shuffle=False)

# Feature extraction
features = []
labels = []
with torch.no_grad():
    for images, targets in loader:
        feat = model(images).squeeze()
        features.append(feat.numpy())
        labels.append(targets.numpy())
        if len(features) * 128 >= 2000:
            break

features = np.vstack(features)[:2000]
labels = np.concatenate(labels)[:2000]
print(f"Feature matrix: {features.shape}")  # (2000, 512)

# Project to 2D with UMAP
reducer = umap.UMAP(n_components=2, n_neighbors=15, random_state=42)
X_2d = reducer.fit_transform(features)

# Visualization
class_names = ['airplane', 'automobile', 'bird', 'cat', 'deer',
               'dog', 'frog', 'horse', 'ship', 'truck']

plt.figure(figsize=(12, 10))
for i, name in enumerate(class_names):
    mask = labels == i
    plt.scatter(X_2d[mask, 0], X_2d[mask, 1], label=name, s=5, alpha=0.6)

plt.legend(markerscale=5, loc="best")
plt.title("CIFAR-10: UMAP Visualization of CNN Features")
plt.xticks([])
plt.yticks([])
plt.tight_layout()
plt.savefig("reports/cnn_features_umap.png", dpi=150)
plt.close()
```

### 7.3 Application to Anomaly Detection

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Generate normal data + anomaly data
np.random.seed(42)
n_normal = 500
n_anomaly = 20
n_features = 20

# Normal data: low-rank structure (actually 5-dimensional structure)
true_dim = 5
W = np.random.randn(true_dim, n_features)
Z_normal = np.random.randn(n_normal, true_dim)
X_normal = Z_normal @ W + np.random.randn(n_normal, n_features) * 0.3

# Anomaly data: patterns that deviate from the normal data structure
X_anomaly = np.random.randn(n_anomaly, n_features) * 3

X = np.vstack([X_normal, X_anomaly])
labels = np.array([0] * n_normal + [1] * n_anomaly)  # 0=normal, 1=anomaly

# Compute reconstruction error with PCA
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

pca = PCA(n_components=5)  # True dimensionality of normal data
X_pca = pca.fit_transform(X_scaled)
X_reconstructed = pca.inverse_transform(X_pca)

# Reconstruction error = anomaly score
reconstruction_error = np.mean((X_scaled - X_reconstructed) ** 2, axis=1)

# Threshold: 99th percentile of normal data
threshold = np.percentile(reconstruction_error[:n_normal], 99)
predictions = (reconstruction_error > threshold).astype(int)

# Visualization
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

# Distribution of reconstruction errors
ax1.hist(reconstruction_error[labels == 0], bins=30, alpha=0.5, label="Normal", color="blue")
ax1.hist(reconstruction_error[labels == 1], bins=10, alpha=0.5, label="Anomaly", color="red")
ax1.axvline(threshold, color="green", linestyle="--", label=f"Threshold={threshold:.2f}")
ax1.set_xlabel("Reconstruction error")
ax1.set_ylabel("Frequency")
ax1.set_title("Anomaly Detection via PCA Reconstruction Error")
ax1.legend()

# PCA 2D visualization
X_2d = PCA(n_components=2).fit_transform(X_scaled)
ax2.scatter(X_2d[labels == 0, 0], X_2d[labels == 0, 1],
            c="blue", s=10, alpha=0.5, label="Normal")
ax2.scatter(X_2d[labels == 1, 0], X_2d[labels == 1, 1],
            c="red", s=50, alpha=0.8, label="Anomaly", marker="x")
ax2.set_title("PCA 2D Visualization")
ax2.legend()

plt.tight_layout()
plt.savefig("reports/pca_anomaly_detection.png", dpi=150)
plt.close()

# Detection accuracy
from sklearn.metrics import precision_score, recall_score, f1_score
print(f"Precision: {precision_score(labels, predictions):.4f}")
print(f"Recall: {recall_score(labels, predictions):.4f}")
print(f"F1: {f1_score(labels, predictions):.4f}")
```

---

## 8. Troubleshooting

### 8.1 Common Problems and Solutions

```
Problem 1: Low PCA explained variance ratio (less than 30% for 2 components)

  Causes:
    - High-dimensional data with variance distributed evenly across many directions
    - Nonlinear structure is dominant

  Solutions:
    1. First check if scaling is appropriate
    2. Use nonlinear methods (t-SNE, UMAP) for visualization
    3. Capture nonlinear structure with Kernel PCA
    4. Increase the number of PCA components and check downstream task accuracy

Problem 2: Clusters do not separate in t-SNE

  Causes:
    - Inappropriate perplexity
    - Data has no clear cluster structure
    - Insufficient preprocessing

  Solutions:
    1. Try perplexity values of 5, 15, 30, 50, 100
    2. Use learning_rate = "auto"
    3. Increase n_iter to 1000 or more
    4. First reduce to ~50 dimensions with PCA before applying t-SNE

Problem 3: UMAP is slow

  Causes:
    - Large amount of data
    - n_neighbors is too large

  Solutions:
    1. First reduce dimensions with PCA
    2. Reduce n_neighbors (around 5-15)
    3. metric="cosine" may be faster in some cases
    4. Apply UMAP after sampling

Problem 4: Kernel PCA results are unstable

  Causes:
    - gamma parameter is inappropriate
    - Poor conditioning of the kernel matrix

  Solutions:
    1. Perform a grid search for gamma
    2. For RBF kernel, use 1/(n_features * X.var()) as the initial value
    3. Enable inverse transform with fit_inverse_transform=True
    4. Check data scaling
```

### 8.2 Performance Tuning

```python
import numpy as np
import time
from sklearn.decomposition import PCA, IncrementalPCA
from sklearn.manifold import TSNE
import umap

# Benchmark: execution time by data size
data_sizes = [1000, 5000, 10000, 50000]
results = []

for n in data_sizes:
    X = np.random.randn(n, 100)

    # PCA
    start = time.time()
    PCA(n_components=2).fit_transform(X)
    pca_time = time.time() - start

    # t-SNE (only for 5000 or fewer)
    if n <= 5000:
        start = time.time()
        TSNE(n_components=2, random_state=42).fit_transform(X)
        tsne_time = time.time() - start
    else:
        tsne_time = float("nan")

    # UMAP
    start = time.time()
    umap.UMAP(n_components=2, random_state=42).fit_transform(X)
    umap_time = time.time() - start

    results.append({
        "n": n,
        "PCA": f"{pca_time:.2f}s",
        "t-SNE": f"{tsne_time:.2f}s" if not np.isnan(tsne_time) else "N/A",
        "UMAP": f"{umap_time:.2f}s",
    })
    print(f"n={n:>6d}  PCA={pca_time:.2f}s  t-SNE={tsne_time:.2f}s  "
          f"UMAP={umap_time:.2f}s")
```

---

## Comparison Table

### Characteristics Comparison of Dimensionality Reduction Methods

| Method | Type | Preserved Structure | Complexity | New Data | Main Uses |
|---|---|---|---|---|---|
| PCA | Linear | Global variance | O(min(n,d)^2 x max(n,d)) | Yes (transform) | Preprocessing, noise removal |
| Kernel PCA | Nonlinear | Nonlinear global structure | O(n^3) | Yes (approximate) | Discovering nonlinear structure |
| t-SNE | Nonlinear | Local structure | O(n^2) → O(n log n) | No | 2D/3D visualization |
| UMAP | Nonlinear | Local + global | O(n^1.14) | Yes (transform) | Visualization, preprocessing |
| LDA | Linear (supervised) | Between-class separation | O(nd^2) | Yes | Classification preprocessing |
| Autoencoder | Nonlinear | Learned representation | NN-dependent | Yes | Feature extraction, generation |
| Incremental PCA | Linear | Global variance | O(batch x d^2) | Yes | Large-scale data |
| TruncatedSVD | Linear | Variance | O(n x d x k) | Yes | Sparse data |

### Parameter Selection Guide

| Method | Key Parameters | Recommended Range | Effect |
|---|---|---|---|
| PCA | n_components | 0.95 (variance ratio) or dimension count | Amount of information retained |
| t-SNE | perplexity | 5-50 (default 30) | Local/global balance |
| t-SNE | learning_rate | "auto" or n/12 | Convergence stability |
| t-SNE | n_iter | 1000-5000 | Convergence quality |
| UMAP | n_neighbors | 5-200 (default 15) | Local/global balance |
| UMAP | min_dist | 0.0-0.99 (default 0.1) | Cluster density |
| Kernel PCA | gamma | 1/(n_features * X.var()) | RBF width |
| LDA | n_components | 1-(C-1) | Projection dimensions |
| Autoencoder | latent_dim | Task-dependent | Bottleneck width |

### Recommended Methods by Use Case

| Use Case | First Choice | Second Choice | Reason |
|---|---|---|---|
| EDA (Exploratory Data Analysis) | UMAP | t-SNE | Fast and also retains global structure |
| Preprocessing (dim reduction) | PCA | UMAP | Linear, stable, transform available |
| Visualization (small scale, < 5000) | t-SNE | UMAP | Best local structure preservation |
| Visualization (large scale, > 10000) | UMAP | PCA → t-SNE | UMAP is overwhelmingly faster |
| Noise removal | PCA | Autoencoder | Low-rank approximation removes noise |
| Anomaly detection | PCA | Autoencoder | Reconstruction error = anomaly score |
| Text data | TruncatedSVD | UMAP | Supports sparse matrices |
| Classification preprocessing (supervised) | LDA | PCA | Maximizes class separation |
| Discovering nonlinear structure | Kernel PCA | UMAP | Explicit projection available |
| Generative model latent space | Autoencoder | VAE | Reconstruction possible via decoder |

---

## Anti-Patterns

### Anti-Pattern 1: Interpreting t-SNE Results as Distances

```
# BAD: Discussing cluster similarity based on t-SNE distances
"Clusters A and B are close in the t-SNE plot, so A and B are similar"
→ t-SNE does not preserve global distance relationships.
  Changing perplexity on the same data can drastically change cluster positions.

# GOOD: Interpret t-SNE as "preservation of local neighborhood relationships"
- Points in the same cluster are close → local structure is preserved
- Distance between clusters → not reliable
- Cluster size → meaningless (density is distorted)
- Use PCA or UMAP for quantitative analysis
```

### Anti-Pattern 2: Projecting to 2D with PCA Solely for Visualization

```python
# BAD: Drawing conclusions when PCA(n_components=2) retains only 30% variance
pca = PCA(n_components=2)
X_2d = pca.fit_transform(X)
print(f"Explained variance ratio: {sum(pca.explained_variance_ratio_):.1%}")
# → Concluding "clusters are not separated" from a 2D plot with only 30% information

# GOOD: First check explained variance ratio, then choose an appropriate method
pca_full = PCA()
pca_full.fit(X)
cumvar = np.cumsum(pca_full.explained_variance_ratio_)
print(f"2D explained variance ratio: {cumvar[1]:.1%}")

if cumvar[1] < 0.5:
    print("Insufficient information in PCA 2D. Recommend t-SNE or UMAP for visualization")
    # Visualize with t-SNE or UMAP
```

### Anti-Pattern 3: Applying PCA Without Scaling

```python
# BAD: Applying PCA directly to features with different units
# Area (m²: 10-200) and number of rooms (1-5) → area has overwhelmingly larger variance
from sklearn.decomposition import PCA
pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_raw)
# → PC1 ≈ direction of area (effect of units)

# GOOD: Normalize with StandardScaler before PCA
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

pipe = make_pipeline(StandardScaler(), PCA(n_components=2))
X_pca = pipe.fit_transform(X_raw)
# → PCA applied with all features equally scaled
```

### Anti-Pattern 4: Selecting Hyperparameters Using Dimensionality-Reduced Data

```python
# BAD: Reduce all data → split → evaluate model
# → Information from test data leaks into dimensionality reduction (data leakage)
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split

pca = PCA(n_components=10)
X_reduced = pca.fit_transform(X)  # fit on all data (leakage!)
X_train, X_test = train_test_split(X_reduced)

# GOOD: Dimensionality reduction inside Pipeline → fit/transform are separated within CV
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import cross_val_score

pipe = make_pipeline(PCA(n_components=10), LogisticRegression())
scores = cross_val_score(pipe, X, y, cv=5)
# → In each fold, PCA fit is applied only to training data
```

---

## Exercises

### Exercise 1 (Basic): PCA Implementation and Interpretation

```
Tasks:
  1. Apply PCA to the Iris dataset (4 dimensions) and visualize in 2D
  2. Compute the explained variance ratio and cumulative explained variance ratio for each principal component
  3. Analyze the first principal component direction vector (loadings) to determine
     which features contribute most to PC1

Hints:
  - pca.components_ stores the principal component direction vectors
  - loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
```

### Exercise 2 (Applied): t-SNE vs UMAP Comparison Experiment

```
Tasks:
  1. Use a subset of MNIST (784 dimensions, 5000 samples)
  2. Implement the pipeline PCA(50) → t-SNE(2)
  3. Implement the pipeline PCA(50) → UMAP(2)
  4. Compare execution time and visualization quality
  5. Record how results change when varying UMAP's n_neighbors

Evaluation criteria:
  - Are points for the same digit placed nearby (local structure)?
  - Are clusters for different digits separated?
  - Difference in execution time
```

### Exercise 3 (Advanced): Autoencoder vs PCA Comparison

```
Tasks:
  1. Implement the following for handwritten digits data:
     a. Reconstruction with PCA (n_components=k)
     b. Reconstruction with Autoencoder (latent_dim=k)
  2. Compare reconstruction errors for k = 2, 5, 10, 20
  3. Visualize the k=2 latent space in 2D and compare class separability
  4. Consider the conditions under which nonlinear Autoencoders outperform PCA

Advanced tasks:
  - Implement a Variational Autoencoder (VAE) and
    verify the continuity of the latent space
```

---

## FAQ

### Q1: Which should I use: PCA, t-SNE, or UMAP?

**A:** It depends on your goal. (1) Preprocessing/noise removal → PCA (linear, transform available), (2) Visualization (small to medium scale) → t-SNE (best local structure preservation), (3) Visualization + preprocessing (large scale) → UMAP (fast, transform available, also retains global structure). Start with PCA for an overview, then try t-SNE/UMAP as needed.

### Q2: How do I decide the number of PCA components?

**A:** (1) Number of components where the cumulative explained variance ratio reaches 95% or more, (2) The "elbow" in the scree plot (eigenvalue decay curve), (3) Cross-validation score of a downstream task (e.g., classification). In practice, `PCA(n_components=0.95)` can determine this automatically.

### Q3: Is t-SNE not reproducible?

**A:** Fixing random_state will produce the same results on the same data. However, due to strong dependence on initial values, it is good practice to run multiple times with different random_state values to verify stability. Since scikit-learn 1.2, `init="pca"` is the default, improving reproducibility.

### Q4: How do I apply dimensionality reduction to large-scale data (1 million rows or more)?

**A:** For PCA, IncrementalPCA enables batch processing. UMAP uses approximate nearest neighbor search internally, so it operates in practical time even for 1 million rows. t-SNE is O(n^2) and is not suitable for large-scale data. Alternatives include the Barnes-Hut approximation from the openTSNE library and FIt-SNE (FFT-accelerated).

### Q5: Is distance calculation valid on dimensionality-reduced data?

**A:** Euclidean distance after PCA is an approximation of the distance in the original space (degraded by the amount of information lost). Distance after UMAP is valid locally but not globally. Distance after t-SNE cannot be used for quantitative analysis. Using PCA is the safe choice for distance-based analysis.

### Q6: How do I interpret negative principal component loadings in PCA?

**A:** A negative loading means that as that feature increases, the principal component value decreases. For example, if the loadings for PC1 are [0.8, -0.6], then increasing feature 1 increases PC1, while increasing feature 2 decreases PC1. This represents a "contrast" that reflects a trade-off relationship between the two features.

---

## Best Practices

### Dimensionality Reduction Workflow

```
Step 1: Data preprocessing
  ├── Handle missing values
  ├── Handle outliers
  └── Scale with StandardScaler (mandatory for PCA/Kernel PCA)

Step 2: Get an overview
  ├── Check explained variance ratio for all PCA components
  ├── Understand information distribution from cumulative explained variance plot
  └── Check rough structure with 2D PCA projection

Step 3: Choose method based on objective
  ├── Preprocessing → PCA (n_components=0.95)
  ├── Visualization → UMAP or t-SNE
  ├── Supervised → LDA
  └── Nonlinear structure → Kernel PCA or Autoencoder

Step 4: Parameter tuning
  ├── PCA: Determine n_components by explained variance ratio or CV
  ├── t-SNE: Try multiple perplexity values
  ├── UMAP: Adjust n_neighbors and min_dist
  └── Kernel PCA: Grid search for gamma

Step 5: Evaluation and validation
  ├── For visualization: Compare multiple methods and parameters
  ├── For preprocessing: Evaluate by downstream task accuracy
  ├── Check reconstruction error
  └── Confirm no data leakage (use Pipeline)
```

### Checklist

```
□ Applied scaling? (especially for PCA, Kernel PCA)
□ Checked the PCA explained variance ratio?
□ Not interpreting t-SNE results as global distances?
□ Compared results with multiple perplexity / n_neighbors values?
□ Using Pipeline to prevent data leakage?
□ If new data needs to be applied, chose a method that supports transform?
□ Considered the balance between computation time and data size?
□ Clearly defined the purpose of dimensionality reduction (visualization vs preprocessing vs anomaly detection)?
```

---

## Summary

| Item | Key Points |
|---|---|
| PCA | Linear dimensionality reduction. Maximizes variance. Best for preprocessing and noise removal |
| t-SNE | Nonlinear. Preserves local structure. Dedicated to 2D/3D visualization. Global distances are inaccurate |
| UMAP | Nonlinear. Preserves local + global. Fast. Can be used for both visualization and preprocessing |
| Kernel PCA | Nonlinear PCA. Performs PCA implicitly in a higher-dimensional space via kernel |
| LDA | Supervised dimensionality reduction. Maximizes class separation. Up to C-1 dimensions |
| Autoencoder | Nonlinear dimensionality reduction via NN. Reconstruction-based. Most flexible |
| Selection criteria | Preprocessing→PCA, Visualization→t-SNE/UMAP, Large-scale→UMAP |
| Cautions | Scaling is mandatory. Set explained variance ratio/parameters appropriately |

---

## Next Guides to Read

- [../02-deep-learning/00-neural-networks.md](../02-deep-learning/00-neural-networks.md) — Fundamentals of neural networks
- [../03-applied/01-computer-vision.md](../03-applied/01-computer-vision.md) — Application of dimensionality reduction to image data

---

## References

1. **Laurens van der Maaten, Geoffrey Hinton** "Visualizing Data using t-SNE" JMLR, 2008
2. **Leland McInnes, John Healy** "UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction" 2018 — https://arxiv.org/abs/1802.03426
3. **scikit-learn** "Decomposing signals in components" — https://scikit-learn.org/stable/modules/decomposition.html
4. **Jolliffe, I. T.** "Principal Component Analysis" 2nd Edition, Springer, 2002
5. **Wattenberg, M., Viegas, F., Johnson, I.** "How to Use t-SNE Effectively" Distill, 2016 — https://distill.pub/2016/misread-tsne/
6. **Kingma, D. P., Welling, M.** "Auto-Encoding Variational Bayes" ICLR, 2014 — https://arxiv.org/abs/1312.6114
