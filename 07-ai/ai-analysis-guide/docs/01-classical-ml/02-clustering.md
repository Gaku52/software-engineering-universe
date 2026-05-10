# Clustering — K-means, DBSCAN, Hierarchical

> Compare and implement clustering methods that automatically discover group structures from unlabeled data

## What You Will Learn in This Chapter

1. **K-means** — Centroid-based clustering and how to determine the number of clusters
2. **DBSCAN** — Density-based clustering for detecting clusters of arbitrary shape
3. **Hierarchical Clustering** — Visualizing cluster structure with dendrograms


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Classification — Logistic Regression, SVM, Random Forest](./01-classification.md)

---

## 1. K-means Clustering

### K-means Algorithm

```
K-means Iterations:

Step 1: Initialization      Step 2: Assignment          Step 3: Update
 (Place K centroids          (Assign each point          (Recompute centroid
  randomly)                   to nearest centroid)        of each cluster)

  ○  ○    ○              ●  ●    ○              ●  ●    ○
    ★       ○               ★       ○               ★     ○
  ○    ○                  ●    ●                  ●    ●
         ★    ○                  ★    ○                ★    ○
    ○  ○     ○               ○  ○     ○             ○  ○     ○
  ○       ○    ○           ○       ○    ○         ○       ○    ○

  ★ = centroid              ● = cluster 1           ★ = centroid
                             ○ = cluster 2             after update

  → Repeat Steps 2 and 3 until convergence
```

### Mathematical Foundation of K-means

K-means minimizes the following objective function (inertia, Within-Cluster Sum of Squares: WCSS).

```
Objective function:
  J = Σ_{k=1}^{K} Σ_{x∈C_k} ||x - μ_k||²

  C_k: set of data points belonging to cluster k
  μ_k: centroid (mean) of cluster k
  K: number of clusters

Convergence:
  · J decreases monotonically with each iteration (provable)
  · Converges to a local optimum in finite steps
  · However, global optimum is not guaranteed → multiple initializations are important
```

### Code Example 1: K-means and Cluster Count Selection

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, silhouette_samples
from sklearn.datasets import make_blobs

# Generate data
X, y_true = make_blobs(n_samples=500, centers=4, cluster_std=1.0,
                        random_state=42)

# Find optimal K using elbow method + silhouette score
K_range = range(2, 11)
inertias = []
silhouettes = []

for k in K_range:
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    km.fit(X)
    inertias.append(km.inertia_)
    silhouettes.append(silhouette_score(X, km.labels_))

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Elbow method
ax1.plot(K_range, inertias, "bo-")
ax1.set_xlabel("Number of Clusters K")
ax1.set_ylabel("Inertia")
ax1.set_title("Elbow Method")
ax1.grid(True, alpha=0.3)

# Silhouette score
ax2.plot(K_range, silhouettes, "ro-")
ax2.set_xlabel("Number of Clusters K")
ax2.set_ylabel("Silhouette Score")
ax2.set_title("Silhouette Analysis")
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/kmeans_selection.png", dpi=150)
plt.close()

best_k = K_range[np.argmax(silhouettes)]
print(f"Optimal number of clusters: {best_k}")
```

### Code Example 1b: K-means From-Scratch Implementation

```python
import numpy as np

class KMeansFromScratch:
    """Full implementation of the K-means algorithm"""

    def __init__(self, n_clusters: int = 3, max_iter: int = 300,
                 tol: float = 1e-4, n_init: int = 10,
                 random_state: int = 42):
        self.n_clusters = n_clusters
        self.max_iter = max_iter
        self.tol = tol
        self.n_init = n_init
        self.rng = np.random.RandomState(random_state)

    def _init_centroids(self, X: np.ndarray) -> np.ndarray:
        """Initialization via K-means++"""
        n_samples = X.shape[0]
        centroids = [X[self.rng.randint(n_samples)]]

        for _ in range(1, self.n_clusters):
            # Squared distance from each point to the nearest centroid
            distances = np.min(
                [np.sum((X - c) ** 2, axis=1) for c in centroids],
                axis=0
            )
            # Select the next centroid with probability proportional to distance
            probs = distances / distances.sum()
            idx = self.rng.choice(n_samples, p=probs)
            centroids.append(X[idx])

        return np.array(centroids)

    def _assign_clusters(self, X: np.ndarray,
                          centroids: np.ndarray) -> np.ndarray:
        """Assign each point to the nearest centroid"""
        distances = np.array([
            np.sum((X - c) ** 2, axis=1) for c in centroids
        ])
        return np.argmin(distances, axis=0)

    def _update_centroids(self, X: np.ndarray,
                           labels: np.ndarray) -> np.ndarray:
        """Recompute the centroid of each cluster"""
        centroids = np.zeros((self.n_clusters, X.shape[1]))
        for k in range(self.n_clusters):
            mask = labels == k
            if mask.sum() > 0:
                centroids[k] = X[mask].mean(axis=0)
        return centroids

    def _compute_inertia(self, X: np.ndarray, labels: np.ndarray,
                          centroids: np.ndarray) -> float:
        """Compute WCSS (inertia)"""
        inertia = 0.0
        for k in range(self.n_clusters):
            mask = labels == k
            if mask.sum() > 0:
                inertia += np.sum((X[mask] - centroids[k]) ** 2)
        return inertia

    def fit(self, X: np.ndarray) -> "KMeansFromScratch":
        """Select the best result from multiple initializations"""
        best_inertia = float("inf")
        best_centroids = None
        best_labels = None

        for _ in range(self.n_init):
            centroids = self._init_centroids(X)

            for iteration in range(self.max_iter):
                labels = self._assign_clusters(X, centroids)
                new_centroids = self._update_centroids(X, labels)

                # Check for convergence
                shift = np.sum((new_centroids - centroids) ** 2)
                centroids = new_centroids
                if shift < self.tol:
                    break

            inertia = self._compute_inertia(X, labels, centroids)
            if inertia < best_inertia:
                best_inertia = inertia
                best_centroids = centroids
                best_labels = labels

        self.cluster_centers_ = best_centroids
        self.labels_ = best_labels
        self.inertia_ = best_inertia
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Assign new data points to clusters"""
        return self._assign_clusters(X, self.cluster_centers_)

# Usage example
X, y_true = make_blobs(n_samples=500, centers=4, random_state=42)
km = KMeansFromScratch(n_clusters=4, n_init=10)
km.fit(X)
print(f"Inertia: {km.inertia_:.2f}")
print(f"Centroid shape: {km.cluster_centers_.shape}")
```

### Code Example 1c: Detailed Silhouette Analysis Visualization

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_samples, silhouette_score
from sklearn.datasets import make_blobs
import matplotlib.cm as cm

def plot_silhouette_analysis(X, k_range=range(2, 7)):
    """Draw silhouette plots side by side for each K"""
    fig, axes = plt.subplots(1, len(k_range), figsize=(5 * len(k_range), 6))

    for ax, k in zip(axes, k_range):
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(X)

        sil_avg = silhouette_score(X, labels)
        sil_samples = silhouette_samples(X, labels)

        y_lower = 10
        for i in range(k):
            cluster_sil = sil_samples[labels == i]
            cluster_sil.sort()
            size = cluster_sil.shape[0]
            y_upper = y_lower + size

            color = cm.nipy_spectral(float(i) / k)
            ax.fill_betweenx(
                np.arange(y_lower, y_upper),
                0, cluster_sil,
                facecolor=color, edgecolor=color, alpha=0.7
            )
            ax.text(-0.05, y_lower + 0.5 * size, str(i))
            y_lower = y_upper + 10

        ax.set_title(f"K={k}, Avg={sil_avg:.3f}")
        ax.set_xlabel("Silhouette Coefficient")
        ax.axvline(x=sil_avg, color="red", linestyle="--")
        ax.set_xlim([-0.2, 1.0])
        ax.set_yticks([])

    plt.suptitle("Cluster Count Selection by Silhouette Analysis", fontsize=14)
    plt.tight_layout()
    plt.savefig("reports/silhouette_analysis.png", dpi=150)
    plt.close()

X, _ = make_blobs(n_samples=500, centers=4, cluster_std=1.0, random_state=42)
plot_silhouette_analysis(X)
```

### Code Example 1d: Mini-Batch K-means (for Large-Scale Data)

```python
from sklearn.cluster import MiniBatchKMeans, KMeans
import numpy as np
import time

def compare_kmeans_scalability(n_samples_list, n_clusters=5):
    """Speed comparison between standard K-means and Mini-Batch K-means"""
    results = []

    for n in n_samples_list:
        X = np.random.randn(n, 10)

        # Standard K-means
        start = time.time()
        km = KMeans(n_clusters=n_clusters, n_init=3, random_state=42)
        km.fit(X)
        km_time = time.time() - start

        # Mini-Batch K-means
        start = time.time()
        mbkm = MiniBatchKMeans(n_clusters=n_clusters, batch_size=1000,
                                n_init=3, random_state=42)
        mbkm.fit(X)
        mb_time = time.time() - start

        results.append({
            "n_samples": n,
            "kmeans_time": km_time,
            "mbkmeans_time": mb_time,
            "speedup": km_time / mb_time,
            "inertia_ratio": mbkm.inertia_ / km.inertia_,
        })
        print(f"n={n:>8,}: KMeans={km_time:.2f}s  "
              f"MiniBatch={mb_time:.2f}s  "
              f"Speedup={km_time/mb_time:.1f}x  "
              f"Inertia ratio={mbkm.inertia_/km.inertia_:.4f}")

    return results

# Usage example
results = compare_kmeans_scalability([1000, 5000, 10000, 50000, 100000])
```

---

## 2. DBSCAN — Density-Based Clustering

### How DBSCAN Works

```
DBSCAN Parameters:
  eps: radius of the neighborhood
  min_samples: minimum number of neighbors to be a core point

Point classifications:
  ┌──────────────────────────────────────┐
  │                                      │
  │  Core Point                          │
  │  ├── has min_samples or more points  │
  │  │   within eps                      │
  │  └── forms the center of a cluster   │
  │                                      │
  │  Border Point                        │
  │  ├── within eps of a core point, but │
  │  └── does not itself meet the        │
  │      core point condition            │
  │                                      │
  │  Noise Point                         │
  │  ├── not within eps of any core point│
  │  └── label = -1                      │
  │                                      │
  └──────────────────────────────────────┘

  Illustration (eps=1, min_samples=3):

       ●───●      ← Core points connected → same cluster
      / \   \
     ●   ●   ◐   ← ◐ = border point

         ✕        ← ✕ = noise point (isolated)
```

### Detailed DBSCAN Algorithm Flow

```
DBSCAN Processing Steps:

1. Mark all data points as "unvisited"
2. Select an unvisited point p
3. Retrieve the eps-neighborhood of p (N(p))
4. If |N(p)| >= min_samples:
   a. Mark p as a "core point"
   b. Create a new cluster C and add p to C
   c. For each point q in N(p):
      - If q is unvisited:
        - Mark q as "visited"
        - Retrieve the eps-neighborhood N(q) of q
        - If |N(q)| >= min_samples, add N(q) to N(p)
      - If q does not belong to any cluster:
        - Add q to C (border point)
5. If |N(p)| < min_samples:
   a. Temporarily mark p as "noise"
   b. May become a "border point" if found within eps of a core point later
6. Repeat steps 2–5 until all points are visited

Complexity:
  · With spatial index (kd-tree, ball-tree): O(n log n)
  · Brute force: O(n²)
  · Memory: O(n)
```

### Code Example 2: DBSCAN Implementation and Parameter Search

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.datasets import make_moons

# Non-convex shaped data
X, y_true = make_moons(n_samples=500, noise=0.1, random_state=42)
X = StandardScaler().fit_transform(X)

# Automatic eps determination (k-distance graph)
k = 5
nn = NearestNeighbors(n_neighbors=k)
nn.fit(X)
distances, _ = nn.kneighbors(X)
k_distances = np.sort(distances[:, -1])

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

ax1.plot(k_distances)
ax1.set_xlabel("Point Index (sorted)")
ax1.set_ylabel(f"{k}-distance")
ax1.set_title(f"k-distance Graph (k={k}) → elbow position is the eps candidate")
ax1.grid(True, alpha=0.3)

# Run near the optimal eps
eps_optimal = 0.3
db = DBSCAN(eps=eps_optimal, min_samples=k)
labels = db.fit_predict(X)

n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = list(labels).count(-1)

ax2.scatter(X[:, 0], X[:, 1], c=labels, cmap="viridis", s=20, alpha=0.7)
ax2.scatter(X[labels == -1, 0], X[labels == -1, 1],
            c="red", marker="x", s=50, label=f"Noise ({n_noise})")
ax2.set_title(f"DBSCAN: {n_clusters} clusters, {n_noise} noise points")
ax2.legend()
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/dbscan_result.png", dpi=150)
plt.close()
```

### Code Example 2b: DBSCAN Parameter Grid Search

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from sklearn.datasets import make_moons

X, y_true = make_moons(n_samples=500, noise=0.1, random_state=42)
X_scaled = StandardScaler().fit_transform(X)

eps_range = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7]
min_samples_range = [3, 5, 7, 10, 15]

fig, axes = plt.subplots(len(min_samples_range), len(eps_range),
                          figsize=(4 * len(eps_range),
                                   3 * len(min_samples_range)))

for i, ms in enumerate(min_samples_range):
    for j, eps in enumerate(eps_range):
        db = DBSCAN(eps=eps, min_samples=ms)
        labels = db.fit_predict(X_scaled)

        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = (labels == -1).sum()

        ax = axes[i][j]
        ax.scatter(X_scaled[:, 0], X_scaled[:, 1],
                   c=labels, cmap="tab10", s=5, alpha=0.7)
        ax.set_title(f"eps={eps}, ms={ms}\n"
                     f"C={n_clusters}, noise={n_noise}",
                     fontsize=8)
        ax.set_xticks([])
        ax.set_yticks([])

plt.suptitle("DBSCAN Parameter Sensitivity Analysis", fontsize=14)
plt.tight_layout()
plt.savefig("reports/dbscan_param_grid.png", dpi=150)
plt.close()
```

### Code Example 2c: HDBSCAN (Hierarchical DBSCAN)

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.datasets import make_moons, make_blobs
import hdbscan

def compare_dbscan_hdbscan(X, y_true=None):
    """Comparison of DBSCAN and HDBSCAN"""
    from sklearn.cluster import DBSCAN
    from sklearn.preprocessing import StandardScaler

    X_scaled = StandardScaler().fit_transform(X)

    # DBSCAN
    db = DBSCAN(eps=0.3, min_samples=5)
    db_labels = db.fit_predict(X_scaled)

    # HDBSCAN (no eps specification needed)
    hdb = hdbscan.HDBSCAN(min_cluster_size=15, min_samples=5)
    hdb_labels = hdb.fit_predict(X_scaled)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # DBSCAN
    n_clusters_db = len(set(db_labels)) - (1 if -1 in db_labels else 0)
    n_noise_db = (db_labels == -1).sum()
    ax1.scatter(X_scaled[:, 0], X_scaled[:, 1],
                c=db_labels, cmap="tab10", s=10, alpha=0.7)
    ax1.set_title(f"DBSCAN: {n_clusters_db} clusters, {n_noise_db} noise points")

    # HDBSCAN
    n_clusters_hdb = len(set(hdb_labels)) - (1 if -1 in hdb_labels else 0)
    n_noise_hdb = (hdb_labels == -1).sum()
    ax2.scatter(X_scaled[:, 0], X_scaled[:, 1],
                c=hdb_labels, cmap="tab10", s=10, alpha=0.7)
    ax2.set_title(f"HDBSCAN: {n_clusters_hdb} clusters, {n_noise_hdb} noise points")

    plt.tight_layout()
    plt.savefig("reports/dbscan_vs_hdbscan.png", dpi=150)
    plt.close()

    # HDBSCAN confidence information
    print(f"HDBSCAN clustering probability statistics:")
    print(f"  Mean probability: {hdb.probabilities_.mean():.3f}")
    print(f"  Min probability: {hdb.probabilities_.min():.3f}")
    print(f"  Samples with probability > 0.5: {(hdb.probabilities_ > 0.5).sum()}")

    return db_labels, hdb_labels

# Test with data of uneven density
np.random.seed(42)
X = np.vstack([X1, X2, X3])

compare_dbscan_hdbscan(X)
```

---

## 3. Hierarchical Clustering

### Code Example 3: Dendrogram and Hierarchical Clustering

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from sklearn.cluster import AgglomerativeClustering
from sklearn.datasets import make_blobs

X, y_true = make_blobs(n_samples=150, centers=4, cluster_std=0.8,
                        random_state=42)

# Generate dendrogram with SciPy
Z = linkage(X, method="ward")  # Ward method (variance minimization)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

# Dendrogram
dendrogram(Z, truncate_mode="lastp", p=30, ax=ax1,
           leaf_rotation=90, leaf_font_size=8)
ax1.set_title("Dendrogram (Ward Method)")
ax1.set_xlabel("Samples")
ax1.set_ylabel("Distance")
ax1.axhline(y=15, color="r", linestyle="--", label="Cut position")
ax1.legend()

# Clustering result
agg = AgglomerativeClustering(n_clusters=4, linkage="ward")
labels = agg.fit_predict(X)

ax2.scatter(X[:, 0], X[:, 1], c=labels, cmap="tab10", s=30, alpha=0.7)
ax2.set_title("Hierarchical Clustering Result (K=4)")
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/hierarchical_clustering.png", dpi=150)
plt.close()
```

### Code Example 4: Linkage Method Comparison

```python
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
import numpy as np

linkages = ["ward", "complete", "average", "single"]
X, y_true = make_blobs(n_samples=300, centers=4, random_state=42)

print(f"{'Linkage':12s} {'ARI':>8s} {'NMI':>8s}")
print("-" * 32)
for link in linkages:
    if link == "ward":
        agg = AgglomerativeClustering(n_clusters=4, linkage=link)
    else:
        agg = AgglomerativeClustering(n_clusters=4, linkage=link)
    labels = agg.fit_predict(X)
    ari = adjusted_rand_score(y_true, labels)
    nmi = normalized_mutual_info_score(y_true, labels)
    print(f"{link:12s} {ari:8.4f} {nmi:8.4f}")
```

### Code Example 4b: Visual Comparison of Linkage Methods

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import AgglomerativeClustering
from sklearn.datasets import make_moons, make_circles, make_blobs

datasets = {
    "Blobs": make_blobs(n_samples=300, centers=3, cluster_std=0.8,
                         random_state=42),
    "Moons": make_moons(n_samples=300, noise=0.1, random_state=42),
    "Circles": make_circles(n_samples=300, noise=0.05, factor=0.5,
                             random_state=42),
    "Aniso": (None, None),  # Anisotropic data
}

# Generate anisotropic data
np.random.seed(42)
X_aniso, y_aniso = make_blobs(n_samples=300, centers=3, random_state=42)
transformation = [[0.6, -0.6], [-0.4, 0.8]]
X_aniso = np.dot(X_aniso, transformation)
datasets["Aniso"] = (X_aniso, y_aniso)

linkages = ["ward", "complete", "average", "single"]

fig, axes = plt.subplots(len(datasets), len(linkages) + 1,
                          figsize=(4 * (len(linkages) + 1),
                                   3.5 * len(datasets)))

for row, (name, (X, y)) in enumerate(datasets.items()):
    # Original data
    axes[row][0].scatter(X[:, 0], X[:, 1], c=y, cmap="tab10", s=10)
    axes[row][0].set_title(f"{name}\n(Ground Truth)")

    for col, link in enumerate(linkages, 1):
        try:
            agg = AgglomerativeClustering(
                n_clusters=3, linkage=link,
                connectivity=None
            )
            labels = agg.fit_predict(X)
            axes[row][col].scatter(X[:, 0], X[:, 1],
                                    c=labels, cmap="tab10", s=10)
        except Exception:
            axes[row][col].text(0.5, 0.5, "Error",
                                transform=axes[row][col].transAxes)

        axes[row][col].set_title(f"{link}")
        axes[row][col].set_xticks([])
        axes[row][col].set_yticks([])

plt.suptitle("Dataset Shape x Linkage Method Comparison", fontsize=14)
plt.tight_layout()
plt.savefig("reports/linkage_comparison.png", dpi=150)
plt.close()
```

### Code Example 5: Practical Use of Clustering Results

```python
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Customer segmentation example
np.random.seed(42)
n = 1000
customers = pd.DataFrame({
    "customer_id": range(n),
    "purchase_amount": np.random.exponential(5000, n),
    "purchase_frequency": np.random.poisson(5, n),
    "recency_days": np.random.exponential(30, n),
    "avg_session_minutes": np.random.exponential(10, n),
})

features = ["purchase_amount", "purchase_frequency",
            "recency_days", "avg_session_minutes"]

# Scaling → K-means
scaler = StandardScaler()
X_scaled = scaler.fit_transform(customers[features])

km = KMeans(n_clusters=4, n_init=10, random_state=42)
customers["segment"] = km.fit_predict(X_scaled)

# Analyze characteristics per segment
segment_profile = (
    customers
    .groupby("segment")[features]
    .agg(["mean", "median", "std"])
    .round(1)
)

# Assign labels to segments
segment_names = {
    0: "Dormant Customers", 1: "Premium Customers",
    2: "New Customers", 3: "Regular Customers"
}

customers["segment_name"] = customers["segment"].map(segment_names)

print("=== Segment Profile ===")
summary = customers.groupby("segment_name")[features].mean().round(1)
summary["Customer Count"] = customers.groupby("segment_name").size()
print(summary)
```

---

## 4. Gaussian Mixture Model (GMM)

### How GMM Works

```
Differences between K-means and GMM:

K-means:
  · "Hard" assignment of each point to one cluster
  · Cluster shape is spherical only
  · Parameters: centroid μ_k

GMM:
  · "Soft" computation of membership probability of each point in each cluster
  · Cluster shape is elliptical (represented by covariance matrix)
  · Parameters: μ_k, Σ_k, π_k

  Probability model:
  p(x) = Σ_{k=1}^{K} π_k × N(x | μ_k, Σ_k)

  π_k: mixing proportion (weight of each cluster)
  μ_k: mean vector
  Σ_k: covariance matrix

  Estimation method: EM (Expectation-Maximization) algorithm
  · E step: compute the membership probability of each point in each cluster
  · M step: update parameters based on membership probabilities
```

### Code Example 5b: GMM Implementation and Usage

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.mixture import GaussianMixture
from sklearn.datasets import make_blobs
from matplotlib.patches import Ellipse

def plot_gmm_with_ellipses(X, n_components, covariance_type="full"):
    """Visualize GMM results with ellipses"""
    gmm = GaussianMixture(n_components=n_components,
                           covariance_type=covariance_type,
                           random_state=42)
    gmm.fit(X)
    labels = gmm.predict(X)
    probs = gmm.predict_proba(X)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    # Hard assignment
    ax1.scatter(X[:, 0], X[:, 1], c=labels, cmap="tab10", s=10, alpha=0.7)
    ax1.set_title("GMM Hard Assignment")

    # Soft assignment (uncertainty expressed by color)
    uncertainty = 1 - probs.max(axis=1)
    scatter = ax2.scatter(X[:, 0], X[:, 1], c=uncertainty,
                           cmap="YlOrRd", s=10, alpha=0.7)
    plt.colorbar(scatter, ax=ax2, label="Uncertainty")
    ax2.set_title("GMM Uncertainty Map")

    # Draw ellipses
    for mean, cov in zip(gmm.means_, gmm.covariances_):
        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        order = eigenvalues.argsort()[::-1]
        eigenvalues = eigenvalues[order]
        eigenvectors = eigenvectors[:, order]

        angle = np.degrees(np.arctan2(*eigenvectors[:, 0][::-1]))
        for nsig in [1, 2, 3]:
            width, height = 2 * nsig * np.sqrt(eigenvalues)
            ellipse = Ellipse(
                xy=mean, width=width, height=height,
                angle=angle, fill=False, edgecolor="black",
                linewidth=1, alpha=0.5 - nsig * 0.1
            )
            ax1.add_patch(ellipse)

    plt.tight_layout()
    plt.savefig("reports/gmm_analysis.png", dpi=150)
    plt.close()

    # Model selection via BIC/AIC
    print(f"BIC: {gmm.bic(X):.2f}")
    print(f"AIC: {gmm.aic(X):.2f}")
    print(f"Log-likelihood: {gmm.score(X):.4f}")

    return gmm, labels

# Usage example
X, _ = make_blobs(n_samples=500, centers=4, cluster_std=[1.0, 1.5, 0.5, 1.2],
                   random_state=42)
gmm, labels = plot_gmm_with_ellipses(X, n_components=4)
```

### Code Example 5c: Cluster Count Selection via BIC/AIC

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.mixture import GaussianMixture

def select_n_components_gmm(X, max_components=10):
    """Select the optimal number of GMM components using BIC/AIC"""
    n_range = range(1, max_components + 1)
    bics = []
    aics = []
    log_likelihoods = []

    for n in n_range:
        gmm = GaussianMixture(n_components=n, random_state=42, n_init=5)
        gmm.fit(X)
        bics.append(gmm.bic(X))
        aics.append(gmm.aic(X))
        log_likelihoods.append(gmm.score(X) * X.shape[0])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ax1.plot(n_range, bics, "bo-", label="BIC")
    ax1.plot(n_range, aics, "ro-", label="AIC")
    ax1.set_xlabel("Number of Components")
    ax1.set_ylabel("Information Criterion")
    ax1.set_title("Model Selection via BIC/AIC")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Optimal number of components
    best_n_bic = n_range[np.argmin(bics)]
    best_n_aic = n_range[np.argmin(aics)]
    ax1.axvline(best_n_bic, color="blue", linestyle="--", alpha=0.5,
                label=f"BIC optimal: {best_n_bic}")
    ax1.axvline(best_n_aic, color="red", linestyle="--", alpha=0.5,
                label=f"AIC optimal: {best_n_aic}")
    ax1.legend()

    ax2.plot(n_range, log_likelihoods, "go-")
    ax2.set_xlabel("Number of Components")
    ax2.set_ylabel("Log-likelihood")
    ax2.set_title("Log-likelihood Transition")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("reports/gmm_model_selection.png", dpi=150)
    plt.close()

    print(f"BIC optimal number of components: {best_n_bic}")
    print(f"AIC optimal number of components: {best_n_aic}")
    return best_n_bic, best_n_aic

# Usage example
from sklearn.datasets import make_blobs
X, _ = make_blobs(n_samples=500, centers=4, random_state=42)
select_n_components_gmm(X)
```

---

## 5. Clustering Application Patterns

### Code Example 6: Text Clustering

```python
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import Normalizer
from collections import Counter

def text_clustering(documents, n_clusters=5, n_top_terms=10):
    """Text clustering using TF-IDF + SVD + K-means"""

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(
        max_df=0.5, min_df=2, max_features=10000,
        stop_words="english"
    )
    tfidf_matrix = vectorizer.fit_transform(documents)
    print(f"TF-IDF matrix: {tfidf_matrix.shape}")

    # Dimensionality reduction with SVD (Latent Semantic Analysis)
    svd = TruncatedSVD(n_components=50, random_state=42)
    normalizer = Normalizer(copy=False)
    lsa_pipeline = make_pipeline(svd, normalizer)
    X_lsa = lsa_pipeline.fit_transform(tfidf_matrix)
    print(f"Explained variance ratio: {svd.explained_variance_ratio_.sum():.2%}")

    # K-means clustering
    km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    labels = km.fit_predict(X_lsa)

    # Extract characteristic words for each cluster
    terms = vectorizer.get_feature_names_out()
    original_centroids = svd.inverse_transform(km.cluster_centers_)

    print(f"\n=== Top Terms for {n_clusters} Clusters ===")
    for i in range(n_clusters):
        top_term_indices = original_centroids[i].argsort()[::-1][:n_top_terms]
        top_terms = [terms[idx] for idx in top_term_indices]
        cluster_size = (labels == i).sum()
        print(f"  Cluster {i} ({cluster_size} documents): {', '.join(top_terms)}")

    return labels, vectorizer, km

# Usage example (20 Newsgroups dataset)
# from sklearn.datasets import fetch_20newsgroups
# data = fetch_20newsgroups(subset="train", remove=("headers", "footers"))
# labels, vec, km = text_clustering(data.data, n_clusters=5)
```

### Code Example 7: Image Segmentation (K-means)

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import MiniBatchKMeans

def segment_image_kmeans(image_array, n_segments=5):
    """
    Segment an image using K-means

    Parameters:
        image_array: NumPy array of shape (H, W, 3) (RGB image)
        n_segments: number of segments
    """
    h, w, c = image_array.shape

    # Convert pixels to feature vectors
    # Features: [R, G, B, x_normalized, y_normalized]
    pixels = image_array.reshape(-1, c).astype(np.float32)

    # Add positional information (for spatial consistency)
    xx, yy = np.meshgrid(np.arange(w), np.arange(h))
    positions = np.column_stack([
        xx.ravel() / w,  # normalized x coordinate
        yy.ravel() / h   # normalized y coordinate
    ])

    # Combine color and position
    features = np.hstack([pixels / 255.0, positions * 0.5])

    # Mini-Batch K-means (for large images)
    km = MiniBatchKMeans(n_clusters=n_segments, batch_size=1000,
                          random_state=42)
    labels = km.fit_predict(features)

    # Convert segmentation result back to image
    segmented = km.cluster_centers_[:, :3][labels] * 255
    segmented = segmented.reshape(h, w, c).astype(np.uint8)

    # Label map
    label_map = labels.reshape(h, w)

    return segmented, label_map

# # Usage example
# from PIL import Image
# img = np.array(Image.open("sample.jpg"))
# segmented, labels = segment_image_kmeans(img, n_segments=8)
```

### Code Example 8: Clustering as Anomaly Detection

```python
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
import matplotlib.pyplot as plt

class ClusterBasedAnomalyDetector:
    """Clustering-based anomaly detection"""

    def __init__(self, n_clusters: int = 5, percentile: float = 95):
        self.n_clusters = n_clusters
        self.percentile = percentile
        self.scaler = StandardScaler()
        self.km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        self.threshold = None

    def fit(self, X: np.ndarray):
        """Train on normal data"""
        X_scaled = self.scaler.fit_transform(X)
        self.km.fit(X_scaled)

        # Compute distance from each point to its centroid
        distances = self._compute_distances(X_scaled)

        # Set threshold (percentile)
        self.threshold = np.percentile(distances, self.percentile)
        print(f"Anomaly detection threshold: {self.threshold:.4f}")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return anomaly scores and predictions"""
        X_scaled = self.scaler.transform(X)
        distances = self._compute_distances(X_scaled)

        # Anomaly (-1) if distance exceeds threshold
        predictions = np.where(distances > self.threshold, -1, 1)
        return predictions, distances

    def _compute_distances(self, X_scaled: np.ndarray) -> np.ndarray:
        """Distance from each point to its nearest centroid"""
        labels = self.km.predict(X_scaled)
        centroids = self.km.cluster_centers_
        distances = np.sqrt(
            np.sum((X_scaled - centroids[labels]) ** 2, axis=1)
        )
        return distances

# Usage example
np.random.seed(42)
X_normal = np.random.randn(1000, 5)
X_anomaly = np.random.randn(50, 5) * 3 + 5
X_all = np.vstack([X_normal, X_anomaly])
y_true = np.array([1] * 1000 + [-1] * 50)

detector = ClusterBasedAnomalyDetector(n_clusters=5, percentile=95)
detector.fit(X_normal)
predictions, scores = detector.predict(X_all)

# Evaluation
from sklearn.metrics import classification_report
print(classification_report(y_true, predictions, target_names=["Anomaly", "Normal"]))
```

---

## 6. Troubleshooting

### Common Problems and Solutions

```
Problem 1: K-means does not converge / results differ each run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes:
  · Random seed is not fixed
  · Number of initializations (n_init) is insufficient
  · Scaling has not been applied to data

Solutions:
  · Fix random_state
  · Set n_init to 10–20 (default is 10)
  · Always apply StandardScaler for scaling
  · Use K-means++ initialization (default in scikit-learn)

Problem 2: DBSCAN returns only one huge cluster
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes:
  · eps is too large
  · min_samples is too small
  · Data is not scaled

Solutions:
  · Estimate appropriate eps using the k-distance graph
  · Set min_samples to approximately dimensionality × 2
  · Scale data with StandardScaler

Problem 3: Difficulty determining the number of clusters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes:
  · Data may not have a clear cluster structure
  · Relying on a single metric

Solutions:
  · Combine multiple metrics (elbow method + silhouette + BIC/AIC)
  · Leverage domain knowledge
  · Use the Gap statistic
  · Use HDBSCAN for automatic estimation

Problem 4: Clustering does not work well on high-dimensional data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Causes:
  · "Curse of dimensionality": Euclidean distance loses meaning in high dimensions
  · Noisy features obscure cluster structure

Solutions:
  · Apply PCA / UMAP dimensionality reduction before clustering
  · Remove noisy features via feature selection
  · Consider subspace clustering
  · Use an appropriate distance metric such as cosine distance
```

### Code Example 9: Comprehensive Clustering Quality Evaluation

```python
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import (
    silhouette_score, calinski_harabasz_score,
    davies_bouldin_score, adjusted_rand_score,
    normalized_mutual_info_score
)
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import make_blobs

def comprehensive_clustering_evaluation(X, y_true=None, n_clusters=4):
    """Comprehensive evaluation of clustering using multiple methods and metrics"""

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    methods = {
        "K-means": KMeans(n_clusters=n_clusters, n_init=10, random_state=42),
        "K-means (Mini)": KMeans(n_clusters=n_clusters, n_init=10,
                                  random_state=42, algorithm="elkan"),
        "Hierarchical (Ward)": AgglomerativeClustering(
            n_clusters=n_clusters, linkage="ward"),
        "GMM": GaussianMixture(n_components=n_clusters, random_state=42),
    }

    results = []
    for name, model in methods.items():
        if hasattr(model, "fit_predict"):
            labels = model.fit_predict(X_scaled)
        else:
            model.fit(X_scaled)
            labels = model.predict(X_scaled)

        row = {
            "Method": name,
            "Silhouette": silhouette_score(X_scaled, labels),
            "CH Index": calinski_harabasz_score(X_scaled, labels),
            "DB Index": davies_bouldin_score(X_scaled, labels),
        }

        if y_true is not None:
            row["ARI"] = adjusted_rand_score(y_true, labels)
            row["NMI"] = normalized_mutual_info_score(y_true, labels)

        results.append(row)

    df = pd.DataFrame(results)
    print("=== Comprehensive Comparison of Clustering Methods ===")
    print(df.to_string(index=False, float_format="%.4f"))
    return df

# Usage example
X, y_true = make_blobs(n_samples=500, centers=4, cluster_std=1.0,
                         random_state=42)
evaluation = comprehensive_clustering_evaluation(X, y_true, n_clusters=4)
```

---

## Comparison Table

### Clustering Method Comparison

| Method | Cluster Shape | K Required | Outlier Handling | Complexity | Scalability | Use Case |
|---|---|---|---|---|---|---|
| K-means | Spherical | Yes | Weak | O(nKt) | High | Uniform-size spherical clusters |
| Mini-Batch K-means | Spherical | Yes | Weak | O(nK) | Very High | Large-scale data |
| DBSCAN | Arbitrary | No | Strong (noise detection) | O(n log n) | Moderate | Data with density variations |
| HDBSCAN | Arbitrary | No | Strong | O(n log n) | Moderate | Non-uniform density |
| Hierarchical (Ward) | Spherical | Post-hoc | Weak | O(n^2) | Low | Small–medium scale, structure exploration |
| GMM | Elliptical | Yes | Moderate | O(nK^2d) | Moderate | Probabilistic cluster assignment |
| Spectral | Arbitrary | Yes | Weak | O(n^3) | Low | Graph-structured data |

### Cluster Evaluation Metric Usage Guide

| Metric | Ground Truth | Range | Interpretation | Use Case |
|---|---|---|---|---|
| Silhouette Score | Not required | [-1, 1] | Higher = more distinct clusters | K selection, quality evaluation |
| Calinski-Harabasz | Not required | [0, +inf) | Higher is better | K selection |
| Davies-Bouldin | Not required | [0, +inf) | Lower is better | K selection |
| ARI (Adjusted Rand Index) | Required | [-1, 1] | 1=perfect match, 0=random | Ground truth comparison |
| NMI (Normalized Mutual Information) | Required | [0, 1] | 1=perfect match | Ground truth comparison |
| V-measure | Required | [0, 1] | Harmonic mean of homogeneity and completeness | Ground truth comparison |
| Gap Statistic | Not required | Real number | K at maximum is optimal | K selection (statistical) |

### Distance Metric Selection Guide

| Distance Metric | Formula | Applicable Data | Characteristics |
|---|---|---|---|
| Euclidean | sqrt(sum((x-y)^2)) | Low–medium dimensional continuous values | Most common |
| Manhattan | sum(abs(x-y)) | High-dimensional, data with outliers | Robust to outliers |
| Cosine | 1 - cos(x,y) | Text, high-dimensional sparse | Considers direction only |
| Mahalanobis | sqrt((x-y)^T S^-1 (x-y)) | Correlated features | Accounts for covariance |
| Ward Distance | WCSS increase | Hierarchical clustering | Minimizes cluster variance |

---

## Best Practices

### Clustering Project Workflow

```
1. Data Understanding & Preprocessing
   ├── Handle missing values
   ├── Detect and handle outliers
   ├── Scaling (StandardScaler recommended)
   └── Consider dimensionality reduction (for high-dimensional data)

2. Exploratory Analysis
   ├── Confirm 2D structure with pair plots
   ├── Identify redundant features via correlation analysis
   └── Check distributions (skewness, multimodality)

3. Clustering Execution
   ├── Try multiple methods (K-means, DBSCAN, GMM, etc.)
   ├── Determine cluster count using multiple metrics
   └── Sensitivity analysis on parameters

4. Result Evaluation
   ├── Internal metrics (silhouette, CH index, etc.)
   ├── Visualization (2D projection, feature box plots)
   ├── Review by domain experts
   └── Cluster stability verification (bootstrapping)

5. Interpretation & Application
   ├── Profiling each cluster
   ├── Translating to business actions
   └── Planning for periodic re-clustering
```

### Checklist

```
Preprocessing:
  [ ] Applied scaling?
  [ ] Handled outliers?
  [ ] Handled missing values?
  [ ] Encoded categorical variables?
  [ ] Considered dimensionality reduction for high-dimensional data?

Clustering:
  [ ] Fixed random seed?
  [ ] Compared multiple methods?
  [ ] Determined cluster count using multiple metrics?
  [ ] Performed parameter sensitivity analysis?

Evaluation:
  [ ] Checked multiple evaluation metrics?
  [ ] Confirmed results with visualization?
  [ ] Verified cluster stability?
  [ ] Confirmed alignment with domain knowledge?

Deployment:
  [ ] Decided how to apply to new data (predict vs. retrain)?
  [ ] Determined re-clustering frequency?
  [ ] Set up a mechanism to monitor cluster changes?
```

---

## Anti-patterns

### Anti-pattern 1: K-means Without Scaling

```python
# BAD: Clustering features with different units as-is
# Annual income (10k JPY: 300–2000) and age (years: 20–70) → income dominates
km = KMeans(n_clusters=3)

# GOOD: Normalize with StandardScaler before clustering
from sklearn.preprocessing import StandardScaler
scaler = StandardScaler()
km = KMeans(n_clusters=3, n_init=10, random_state=42)
km.fit(X_scaled)
```

### Anti-pattern 2: "Just Use K=3"

```python
# BAD: Selecting K=3 without justification
km = KMeans(n_clusters=3).fit(X)

# GOOD: Select K using multiple metrics
from sklearn.metrics import silhouette_score, calinski_harabasz_score

for k in range(2, 11):
    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X)
    sil = silhouette_score(X, km.labels_)
    ch = calinski_harabasz_score(X, km.labels_)
    print(f"K={k:2d}  Silhouette={sil:.4f}  CH={ch:.0f}  Inertia={km.inertia_:.0f}")
```

### Anti-pattern 3: Over-trusting Cluster Results

```python
# BAD: Treating clustering results as ground truth
clusters = km.fit_predict(X)
df["customer_type"] = clusters
# "Cluster 0 is premium customers" → Is it really?

# GOOD: Verify stability and interpretability
from sklearn.utils import resample

n_bootstrap = 50
cluster_stability = np.zeros((len(X), n_bootstrap))

for i in range(n_bootstrap):
    X_boot, idx = resample(X, return_indices=True, random_state=i)
    km_boot = KMeans(n_clusters=k, n_init=5, random_state=42)
    km_boot.fit(X_boot)
    labels_boot = km_boot.predict(X)
    cluster_stability[:, i] = labels_boot

# Compute stability of cluster assignment for each sample
from scipy.stats import mode
stability_scores = []
for j in range(len(X)):
    most_common = mode(cluster_stability[j], keepdims=True)[1][0]
    stability_scores.append(most_common / n_bootstrap)

avg_stability = np.mean(stability_scores)
print(f"Average cluster stability: {avg_stability:.3f}")
# >= 0.8 is stable, <= 0.5 is unstable
```

### Anti-pattern 4: Applying K-means Directly to Categorical Variables

```python
# BAD: One-hot encode categorical variables and apply K-means
# → Euclidean distance is inappropriate for categorical variables

# GOOD: Use K-modes (for categorical) or K-prototypes (for mixed types)
# pip install kmodes
from kmodes.kprototypes import KPrototypes

# Mixed numerical and categorical columns
categorical_indices = [2, 3]  # indices of categorical columns

kp = KPrototypes(n_clusters=4, init="Cao", random_state=42)
labels = kp.fit_predict(X_mixed, categorical=categorical_indices)
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

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
        """Retrieve processing results"""
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

Extend the basic implementation to add the following functionality.

```python
# Exercise 2: Advanced pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise on advanced patterns"""

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
        """Statistics information"""
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
    assert ex.add("d", 4) == False  # size limit
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

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: When should I use K-means vs. GMM?

**A:** K-means performs "hard" assignment of each point to one cluster, while GMM can compute probabilistic "soft" assignments. GMM is more appropriate when clusters overlap or when cluster shapes are elliptical. K-means is faster and suited for large-scale data. However, GMM is sensitive to EM algorithm initialization and prone to local optima, so set n_init to a larger value.

### Q2: How do I choose eps and min_samples for DBSCAN?

**A:** A rule of thumb for min_samples is dimensionality × 2. eps can be read from the "elbow" position in the k-distance graph (k = min_samples). If you have domain knowledge, set it from the "maximum distance to consider as the same cluster." If eps is unclear, using HDBSCAN eliminates the need to specify eps.

### Q3: How do I judge the "correctness" of clustering results?

**A:** Without ground truth labels, there is no single correct answer. Judge comprehensively from three axes: (1) internal metrics such as silhouette score, (2) interpretability of clusters as assessed by domain experts, and (3) effectiveness in downstream tasks (such as marketing campaigns).

### Q4: Which method is suitable for large-scale data (millions of rows or more)?

**A:** Mini-Batch K-means is the first choice. With O(n) complexity, memory consumption can also be controlled by adjusting the batch size. If density-based methods are needed, use the approximate_predict feature of HDBSCAN. For large-scale data, it is also effective to compare methods by sampling first, then apply the optimal method to the full dataset. Dask and sparkml also have distributed clustering implementations.

### Q5: How should I cluster time-series data?

**A:** Normal Euclidean distance is often inappropriate for time-series data. Options include: (1) clustering using DTW (Dynamic Time Warping) distance, (2) extracting features from time series (e.g., tsfresh) and then applying standard clustering, (3) using TimeSeriesKMeans (from the tslearn library). DTW is particularly effective when time series have unequal lengths.

### Q6: How do I apply clustering results to business?

**A:** Main patterns: (1) customer segmentation → segment-specific marketing initiatives, (2) anomaly detection → treating data points outside clusters as anomalies, (3) data compression → summarizing data with representative points of each cluster, (4) labeling support → efficient annotation by sampling within clusters. To clarify business impact, it is important to explain cluster characteristics in a way that is understandable to non-technical stakeholders.

---

## Summary

| Item | Key Points |
|---|---|
| K-means | Fast and simple. For spherical clusters. Select K using elbow method + silhouette |
| DBSCAN | Handles arbitrary shapes. Can detect noise. Determine parameters using k-distance graph |
| HDBSCAN | Improved DBSCAN. No eps required. Strong for non-uniform density data |
| Hierarchical | Visualize structure with dendrogram. For small–medium scale data |
| GMM | Handles elliptical clusters. Probabilistic assignment. Model selection via BIC/AIC |
| Evaluation | Comprehensive judgment using internal metrics (silhouette, etc.) + domain knowledge |
| Preprocessing | Scaling is mandatory (for all distance-based methods) |
| Applications | Text, image, anomaly detection, customer segmentation |

---

## Guides to Read Next

- [03-dimensionality-reduction.md](./03-dimensionality-reduction.md) — Visualize cluster structure with dimensionality reduction
- [../03-applied/00-nlp.md](../03-applied/00-nlp.md) — Applications of text clustering

---

## References

1. **Martin Ester et al.** "A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise" KDD 1996
2. **scikit-learn** "Clustering" -- https://scikit-learn.org/stable/modules/clustering.html
3. **Lior Rokach, Oded Maimon** "Clustering Methods" in Data Mining and Knowledge Discovery Handbook, Springer, 2005
4. **Leland McInnes et al.** "hdbscan: Hierarchical density based clustering" JOSS, 2017
5. **Arthur, D. and Vassilvitskii, S.** "k-means++: The advantages of careful seeding" SODA 2007
