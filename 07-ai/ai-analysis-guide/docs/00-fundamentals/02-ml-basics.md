# Machine Learning Basics — Supervised/Unsupervised, Evaluation Metrics

> Systematically understand the fundamental concepts of machine learning from both theoretical and implementation perspectives

## What You Will Learn in This Chapter

1. **Learning Paradigms** — Principles and use cases for supervised, unsupervised, semi-supervised, and reinforcement learning
2. **Bias-Variance Tradeoff** — Mechanisms behind overfitting and underfitting, and strategies to address them
3. **Evaluation Metrics** — Metrics for classification and regression, and criteria for appropriate selection
4. **Cross-Validation** — Splitting strategies for correctly measuring generalization performance
5. **Hyperparameter Optimization** — Implementation and comparison of Grid/Random/Bayesian methods
6. **Model Selection** — Guidelines for choosing algorithms based on business requirements


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Data Preprocessing — Missing Values, Normalization, Feature Engineering](./01-data-preprocessing.md)

---

## 1. Fundamentals of Supervised Learning

### How Learning Works

```
Supervised Learning Flow:

  Training Data                Prediction
  ┌─────────────┐           ┌─────────┐
  │ Features (X)│           │ New Data│
  │ Labels  (y) │           │ (X_new) │
  └──────┬──────┘           └────┬────┘
         │                       │
         v                       v
  ┌──────┴──────┐         ┌─────┴─────┐
  │  Training   │         │ Inference │
  │  f(X) ≈ y  │────────>│  ŷ = f(X) │
  │  Parameter  │  Model  │           │
  │  Optimization│        │           │
  └─────────────┘         └───────────┘

  Loss Function: Find parameters θ that minimize L(y, ŷ)
  θ* = argmin_θ Σ L(y_i, f(x_i; θ)) + λR(θ)
                                        ↑ Regularization term
```

### Main Categories of Supervised Learning

Supervised learning is broadly divided into two categories based on the nature of the target variable.

```
Classification:
  - Target variable is discrete (categorical)
  - Examples: spam/non-spam, image classes, customer churn prediction
  - Representative algorithms:
    - Logistic Regression
    - Support Vector Machine (SVM)
    - Decision Tree / Random Forest
    - Gradient Boosting (XGBoost, LightGBM)
    - Neural Networks

Regression:
  - Target variable is continuous (numeric)
  - Examples: house price prediction, sales forecasting, temperature prediction
  - Representative algorithms:
    - Linear Regression / Ridge / Lasso
    - Support Vector Regression (SVR)
    - Decision Tree Regression / Random Forest Regression
    - Gradient Boosting Regression
    - Neural Network Regression
```

### Loss Functions in Detail

Loss functions guide model training; choosing the right one directly impacts model performance.

```python
import numpy as np

# === Regression Loss Functions ===

def mse_loss(y_true, y_pred):
    """Mean Squared Error: sensitive to outliers, easy to differentiate"""
    return np.mean((y_true - y_pred) ** 2)

def mae_loss(y_true, y_pred):
    """Mean Absolute Error: robust to outliers, non-differentiable at zero"""
    return np.mean(np.abs(y_true - y_pred))

def huber_loss(y_true, y_pred, delta=1.0):
    """Huber Loss: hybrid of MSE and MAE
    |error| <= delta: MSE (smooth)
    |error| > delta:  MAE (robust to outliers)
    """
    error = y_true - y_pred
    is_small = np.abs(error) <= delta
    squared_loss = 0.5 * error ** 2
    linear_loss = delta * (np.abs(error) - 0.5 * delta)
    return np.mean(np.where(is_small, squared_loss, linear_loss))

def quantile_loss(y_true, y_pred, quantile=0.5):
    """Quantile Loss: used when predicting a specific quantile
    quantile=0.5 → equivalent to MAE
    quantile=0.9 → predicts the 90th percentile
    """
    error = y_true - y_pred
    return np.mean(np.where(error >= 0, quantile * error, (quantile - 1) * error))


# === Classification Loss Functions ===

def binary_cross_entropy(y_true, y_prob, eps=1e-15):
    """Binary Cross-Entropy: standard loss function for binary classification"""
    y_prob = np.clip(y_prob, eps, 1 - eps)
    return -np.mean(y_true * np.log(y_prob) + (1 - y_true) * np.log(1 - y_prob))

def categorical_cross_entropy(y_true_onehot, y_prob, eps=1e-15):
    """Categorical Cross-Entropy: standard loss function for multi-class classification"""
    y_prob = np.clip(y_prob, eps, 1 - eps)
    return -np.mean(np.sum(y_true_onehot * np.log(y_prob), axis=1))

def hinge_loss(y_true, y_score):
    """Hinge Loss: used in SVM. y_true is {-1, +1}"""
    return np.mean(np.maximum(0, 1 - y_true * y_score))

def focal_loss(y_true, y_prob, gamma=2.0, alpha=0.25, eps=1e-15):
    """Focal Loss: loss function robust to class imbalance (proposed in RetinaNet)
    Reduces loss for easy samples and focuses on hard samples
    """
    y_prob = np.clip(y_prob, eps, 1 - eps)
    pt = np.where(y_true == 1, y_prob, 1 - y_prob)
    at = np.where(y_true == 1, alpha, 1 - alpha)
    loss = -at * (1 - pt) ** gamma * np.log(pt)
    return np.mean(loss)


# Comparison experiment for loss functions
y_true = np.array([3.0, 5.0, 2.5, 7.0, 4.5])
y_pred = np.array([2.8, 5.2, 2.0, 10.0, 4.3])  # 7.0→10.0 is an outlier-like prediction

print("Comparison of regression loss functions (with outlier):")
print(f"  MSE:   {mse_loss(y_true, y_pred):.4f}")
print(f"  MAE:   {mae_loss(y_true, y_pred):.4f}")
print(f"  Huber: {huber_loss(y_true, y_pred, delta=1.0):.4f}")
```

### Code Example 1: Complete Supervised Learning Workflow

```python
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

# 1. Data preparation
from sklearn.datasets import load_breast_cancer
data = load_breast_cancer()
X, y = data.data, data.target

# 2. Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 3. Preprocessing
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# 4. Model training
models = {
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
}

for name, model in models.items():
    # Cross-validation
    cv_scores = cross_val_score(model, X_train_s, y_train, cv=5, scoring="f1")
    print(f"\n{name}")
    print(f"  CV F1: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Test evaluation
    model.fit(X_train_s, y_train)
    y_pred = model.predict(X_test_s)
    print(classification_report(y_test, y_pred, target_names=data.target_names))
```

### Code Example 1b: Integrating Preprocessing and Model with a Pipeline

In practice, combining preprocessing and model into a pipeline prevents data leakage and ensures reproducibility.

```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score
import pandas as pd
import numpy as np

# Simulating a realistic dataset
np.random.seed(42)
n = 1000
df = pd.DataFrame({
    "age": np.random.normal(40, 15, n),
    "income": np.random.lognormal(10, 1, n),
    "education": np.random.choice(["high_school", "bachelor", "master", "phd"], n),
    "city": np.random.choice(["tokyo", "osaka", "nagoya", "fukuoka"], n),
    "satisfaction": np.random.normal(3.5, 1.0, n),
})
# Inserting missing values
for col in ["age", "income", "satisfaction"]:
    mask = np.random.random(n) < 0.05
    df.loc[mask, col] = np.nan

y = (df["income"].fillna(df["income"].median()) > df["income"].median()).astype(int)
X = df.drop(columns=[])

# Defining column types
numeric_features = ["age", "income", "satisfaction"]
categorical_features = ["education", "city"]

# Preprocessing pipeline for numeric features
numeric_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

# Preprocessing pipeline for categorical features
categorical_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot", OneHotEncoder(drop="first", sparse_output=False, handle_unknown="ignore")),
])

# Combining preprocessing steps
preprocessor = ColumnTransformer(
    transformers=[
        ("num", numeric_transformer, numeric_features),
        ("cat", categorical_transformer, categorical_features),
    ]
)

# Full pipeline
pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("classifier", GradientBoostingClassifier(
        n_estimators=100, max_depth=5, random_state=42
    )),
])

# Cross-validation (no data leakage)
cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring="f1")
print(f"CV F1: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Saving the pipeline
import joblib
pipeline.fit(X, y)
joblib.dump(pipeline, "models/full_pipeline.joblib")

# Inference in production
loaded_pipeline = joblib.load("models/full_pipeline.joblib")
new_data = pd.DataFrame({
    "age": [35], "income": [50000], "education": ["master"],
    "city": ["tokyo"], "satisfaction": [4.0]
})
prediction = loaded_pipeline.predict(new_data)
probability = loaded_pipeline.predict_proba(new_data)[:, 1]
print(f"Prediction: {prediction[0]}, Probability: {probability[0]:.4f}")
```

---

## 2. Fundamentals of Unsupervised Learning

### Taxonomy of Unsupervised Learning

Unsupervised learning discovers the structure of data without labels (ground truth).

```
Categories of Unsupervised Learning:

  ┌───────────────────────────────────────────────────┐
  │           Unsupervised Learning                    │
  │                                                   │
  │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │
  │  │ Clustering  │  │ Dim. Reduc.  │  │ Anomaly  │ │
  │  ├─────────────┤  ├──────────────┤  │ Detection│ │
  │  │ K-means     │  │ PCA          │  ├──────────┤ │
  │  │ DBSCAN      │  │ t-SNE        │  │ LOF      │ │
  │  │ Hierarchical│  │ UMAP         │  │ IF       │ │
  │  │ GMM         │  │ Autoencoders │  │ One-Class│ │
  │  └─────────────┘  └──────────────┘  │ SVM      │ │
  │                                      └──────────┘ │
  │  ┌─────────────┐  ┌──────────────┐               │
  │  │ Assoc. Rules│  │ Density Est. │               │
  │  ├─────────────┤  ├──────────────┤               │
  │  │ Apriori     │  │ KDE          │               │
  │  │ FP-Growth   │  │ GMM          │               │
  │  └─────────────┘  └──────────────┘               │
  └───────────────────────────────────────────────────┘
```

### Code Example: Clustering and Evaluation

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from sklearn.datasets import make_blobs

# Data generation
X, y_true = make_blobs(n_samples=500, n_features=2, centers=4,
                        cluster_std=1.0, random_state=42)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Comparison of multiple clustering algorithms
algorithms = {
    "K-Means": KMeans(n_clusters=4, random_state=42, n_init=10),
    "DBSCAN": DBSCAN(eps=0.5, min_samples=5),
    "Agglomerative": AgglomerativeClustering(n_clusters=4),
    "GMM": GaussianMixture(n_components=4, random_state=42),
}

fig, axes = plt.subplots(2, 2, figsize=(14, 12))
axes = axes.ravel()

for idx, (name, algo) in enumerate(algorithms.items()):
    if name == "GMM":
        labels = algo.fit_predict(X_scaled)
    else:
        labels = algo.fit_predict(X_scaled)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

    # Evaluate on non-noise samples
    mask = labels != -1
    if mask.sum() > 1 and n_clusters > 1:
        sil = silhouette_score(X_scaled[mask], labels[mask])
        ch = calinski_harabasz_score(X_scaled[mask], labels[mask])
        db = davies_bouldin_score(X_scaled[mask], labels[mask])
    else:
        sil, ch, db = 0, 0, 0

    axes[idx].scatter(X_scaled[:, 0], X_scaled[:, 1], c=labels, cmap="viridis", s=10)
    axes[idx].set_title(f"{name}\nSil={sil:.3f}, CH={ch:.0f}, DB={db:.3f}")
    print(f"{name}: clusters={n_clusters}, Silhouette={sil:.4f}, "
          f"CH={ch:.1f}, DB={db:.4f}")

plt.tight_layout()
plt.savefig("reports/clustering_comparison.png", dpi=150)
plt.close()
```

### Elbow Method and Silhouette Analysis for K Selection

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, silhouette_samples

def optimal_k_analysis(X, k_range=range(2, 11)):
    """Determine K using the elbow method and silhouette analysis"""
    inertias = []
    silhouettes = []

    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X)
        inertias.append(km.inertia_)
        silhouettes.append(silhouette_score(X, labels))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Elbow method
    ax1.plot(list(k_range), inertias, "bo-")
    ax1.set_xlabel("Number of Clusters K")
    ax1.set_ylabel("Inertia")
    ax1.set_title("Elbow Method")
    ax1.grid(True, alpha=0.3)

    # Silhouette score
    ax2.plot(list(k_range), silhouettes, "ro-")
    ax2.set_xlabel("Number of Clusters K")
    ax2.set_ylabel("Silhouette Score")
    ax2.set_title("Silhouette Analysis")
    ax2.grid(True, alpha=0.3)

    best_k = list(k_range)[np.argmax(silhouettes)]
    ax2.axvline(x=best_k, color="green", linestyle="--", label=f"Best K={best_k}")
    ax2.legend()

    plt.tight_layout()
    plt.savefig("reports/optimal_k_analysis.png", dpi=150)
    plt.close()

    return best_k

best_k = optimal_k_analysis(X_scaled)
print(f"Optimal number of clusters: {best_k}")
```

---

## 3. Semi-Supervised Learning and Self-Supervised Learning

### Semi-Supervised Learning

Semi-supervised learning combines a small amount of labeled data with a large amount of unlabeled data. It is especially effective in practical scenarios where labeling is costly.

```
Approaches to Semi-Supervised Learning:

  1. Self-Training
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │ Labeled  │───>│  Model   │───>│ Predict  │
     │  Data    │    │Training  │    │ unlabeled│
     └──────────┘    └──────────┘    │  data    │
                           ↑          └────┬─────┘
                           │               │
                           └───────────────┘
                           Add high-confidence predictions to labeled set

  2. Label Propagation
     Propagate labels to neighboring data points on a graph

  3. Co-Training
     Train two models with different views (feature subsets)
     that mutually teach each other
```

```python
from sklearn.semi_supervised import LabelSpreading, SelfTrainingClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
import numpy as np

# Data generation
X, y = make_classification(n_samples=2000, n_features=20, n_informative=10,
                            n_classes=3, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Mask most labels (only 5% labeled)
rng = np.random.RandomState(42)
mask = rng.random(len(y_train)) > 0.05  # Hide 95% of labels
y_train_semi = y_train.copy()
y_train_semi[mask] = -1  # -1 represents unlabeled

n_labeled = (y_train_semi != -1).sum()
n_unlabeled = (y_train_semi == -1).sum()
print(f"Labeled: {n_labeled}, Unlabeled: {n_unlabeled}")

# Self-Training
base_model = RandomForestClassifier(n_estimators=100, random_state=42)
self_training = SelfTrainingClassifier(
    base_estimator=base_model,
    threshold=0.8,  # Add samples with >= 80% confidence to labeled set
    max_iter=20,
)
self_training.fit(X_train, y_train_semi)
score_semi = self_training.score(X_test, y_test)

# Comparison: train on labeled data only
labeled_mask = y_train_semi != -1
base_model_only = RandomForestClassifier(n_estimators=100, random_state=42)
base_model_only.fit(X_train[labeled_mask], y_train[labeled_mask])
score_labeled = base_model_only.score(X_test, y_test)

# Comparison: train on all labels (upper bound)
full_model = RandomForestClassifier(n_estimators=100, random_state=42)
full_model.fit(X_train, y_train)
score_full = full_model.score(X_test, y_test)

print(f"\nAccuracy comparison:")
print(f"  Labeled only ({n_labeled} samples): {score_labeled:.4f}")
print(f"  Semi-supervised learning:           {score_semi:.4f}")
print(f"  Full label training (upper bound):  {score_full:.4f}")
```

### Self-Supervised Learning

Self-supervised learning generates training signals from the data itself without using labels. It has become the foundational technology behind recent large-scale language models and image models.

```
Pretext Tasks in Self-Supervised Learning:

  Text:
    - Masked Language Model (BERT): mask tokens in a sentence and predict them
    - Next Token Prediction (GPT): predict the next token
    - Sentence Order Prediction: predict the order of sentences

  Images:
    - Contrastive Learning (SimCLR, MoCo): pull together different augmentations of the same image
    - Masked Image Modeling (MAE): mask image patches and reconstruct them
    - DINO: vision transformer training via self-distillation

  Tabular:
    - VIME: detect value corruption
    - SCARF: contrastive learning by masking a subset of features
```

---

## 4. Fundamentals of Reinforcement Learning

### Reinforcement Learning Framework

```
Markov Decision Process (MDP):

  Agent                        Environment
  ┌──────────┐               ┌──────────┐
  │          │ ── Action ──> │          │
  │  Policy  │               │  State   │
  │  π(a|s)  │ <── State ── │Transition│
  │          │ <── Reward ── │          │
  └──────────┘               └──────────┘

  Goal: Maximize cumulative reward G_t = Σ γ^k × r_{t+k}
         γ: discount factor (0 < γ ≤ 1)

  Key concepts:
    - State value function V(s): expected cumulative reward from state s
    - Action value function Q(s, a): expected cumulative reward when taking action a in state s
    - Bellman equation: V(s) = max_a [R(s,a) + γ Σ P(s'|s,a) V(s')]
```

### Classification of Reinforcement Learning Algorithms

```
Taxonomy of Reinforcement Learning Methods:

  ┌──────────────────────────────────────────┐
  │           Reinforcement Learning          │
  │                                          │
  │  ┌──────────────┐  ┌──────────────────┐  │
  │  │ Model-Free   │  │ Model-Based      │  │
  │  ├──────────────┤  ├──────────────────┤  │
  │  │              │  │ Learn env. model │  │
  │  │ ┌──────────┐ │  │ and plan ahead   │  │
  │  │ │Value-Based│ │  │                  │  │
  │  │ │ Q-Learning│ │  │ Examples:        │  │
  │  │ │ DQN      │ │  │  - Dyna-Q        │  │
  │  │ │ SARSA    │ │  │  - World Models  │  │
  │  │ └──────────┘ │  │  - MuZero        │  │
  │  │              │  └──────────────────┘  │
  │  │ ┌──────────┐ │                        │
  │  │ │Policy-   │ │                        │
  │  │ │Based     │ │                        │
  │  │ │ REINFORCE│ │                        │
  │  │ │ PPO      │ │                        │
  │  │ │ A3C      │ │                        │
  │  │ └──────────┘ │                        │
  │  │              │                        │
  │  │ ┌──────────┐ │                        │
  │  │ │Actor-    │ │                        │
  │  │ │Critic    │ │                        │
  │  │ │ A2C      │ │                        │
  │  │ │ SAC      │ │                        │
  │  │ │ TD3      │ │                        │
  │  │ └──────────┘ │                        │
  │  └──────────────┘                        │
  └──────────────────────────────────────────┘
```

### Code Example: Basic Q-Learning Implementation

```python
import numpy as np

class QLearningAgent:
    """Basic implementation of a Q-Learning agent"""

    def __init__(self, n_states, n_actions, learning_rate=0.1,
                 discount_factor=0.99, epsilon=1.0, epsilon_decay=0.995,
                 epsilon_min=0.01):
        self.q_table = np.zeros((n_states, n_actions))
        self.lr = learning_rate
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.n_actions = n_actions

    def choose_action(self, state):
        """Select action using ε-greedy policy"""
        if np.random.random() < self.epsilon:
            return np.random.randint(self.n_actions)
        return np.argmax(self.q_table[state])

    def update(self, state, action, reward, next_state, done):
        """Update Q-value"""
        if done:
            target = reward
        else:
            target = reward + self.gamma * np.max(self.q_table[next_state])

        # Q-Learning update rule
        self.q_table[state, action] += self.lr * (
            target - self.q_table[state, action]
        )

    def decay_epsilon(self):
        """Decay exploration rate"""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)

    def train(self, env, n_episodes=1000):
        """Training loop"""
        rewards_history = []

        for episode in range(n_episodes):
            state = env.reset()
            total_reward = 0
            done = False

            while not done:
                action = self.choose_action(state)
                next_state, reward, done, _ = env.step(action)
                self.update(state, action, reward, next_state, done)
                state = next_state
                total_reward += reward

            self.decay_epsilon()
            rewards_history.append(total_reward)

            if (episode + 1) % 100 == 0:
                avg_reward = np.mean(rewards_history[-100:])
                print(f"Episode {episode+1}: "
                      f"Avg Reward={avg_reward:.2f}, "
                      f"Epsilon={self.epsilon:.4f}")

        return rewards_history
```

---

## 5. Bias-Variance Tradeoff

### Conceptual Diagram

```
Decomposition of Prediction Error:

  Total Error = Bias² + Variance + Noise (irreducible)

  Model Complexity →  Low                             High
                   │                                │
  Bias:            │████████████████░░░░░░░░░░░░░░░│  High→Low
  Variance:        │░░░░░░░░░░░░░░░████████████████│  Low→High
                   │                                │
  Training Error:  │████████░░░░░░░░░░░░░░░░░░░░░░░│  High→Very Low
  Test Error:      │████████░░░░░░░░░░░░░████████░░│  U-shaped
                   │         ↑                      │
                   │     Optimal Point              │
                   └────────────────────────────────┘

  Underfitting              Optimal          Overfitting
```

### Mathematical Definitions of Bias and Variance

```
Error decomposition for a prediction at data point x:

  E[(y - f̂(x))²] = Bias[f̂(x)]² + Var[f̂(x)] + σ²

  Bias:
    Bias[f̂(x)] = E[f̂(x)] - f(x)
    = Difference between the expected prediction and the true function
    → Increases when the model is too simple

  Variance:
    Var[f̂(x)] = E[(f̂(x) - E[f̂(x)])²]
    = Variability of predictions across different training datasets
    → Increases when the model is too complex

  Noise (σ²):
    Irreducible randomness in the data itself
    → Cannot be reduced by any model
```

### Code Example 2: Visualizing and Diagnosing Overfitting

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import learning_curve, validation_curve
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier

def plot_learning_curve(estimator, X, y, title="Learning Curve"):
    """Plot learning curves to diagnose overfitting/underfitting"""
    train_sizes, train_scores, test_scores = learning_curve(
        estimator, X, y, cv=5,
        train_sizes=np.linspace(0.1, 1.0, 10),
        scoring="accuracy", n_jobs=-1
    )

    train_mean = train_scores.mean(axis=1)
    train_std = train_scores.std(axis=1)
    test_mean = test_scores.mean(axis=1)
    test_std = test_scores.std(axis=1)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.fill_between(train_sizes, train_mean - train_std,
                    train_mean + train_std, alpha=0.1, color="blue")
    ax.fill_between(train_sizes, test_mean - test_std,
                    test_mean + test_std, alpha=0.1, color="orange")
    ax.plot(train_sizes, train_mean, "o-", color="blue", label="Training Score")
    ax.plot(train_sizes, test_mean, "o-", color="orange", label="Validation Score")
    ax.set_xlabel("Number of Training Samples")
    ax.set_ylabel("Accuracy")
    ax.set_title(title)
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Diagnostic message
    gap = train_mean[-1] - test_mean[-1]
    if gap > 0.1:
        ax.text(0.5, 0.05, f"Signs of Overfitting (Gap={gap:.3f})",
                transform=ax.transAxes, color="red", fontsize=12)
    elif test_mean[-1] < 0.7:
        ax.text(0.5, 0.05, "Signs of Underfitting",
                transform=ax.transAxes, color="red", fontsize=12)

    plt.tight_layout()
    plt.savefig("reports/learning_curve.png", dpi=150)
    plt.close()

    return train_mean, test_mean

# Deep decision tree prone to overfitting
deep_tree = DecisionTreeClassifier(max_depth=None, random_state=42)
plot_learning_curve(deep_tree, X_train_s, y_train, "Deep Decision Tree (Overfitting Tendency)")

# Regularized shallow decision tree
shallow_tree = DecisionTreeClassifier(max_depth=3, random_state=42)
plot_learning_curve(shallow_tree, X_train_s, y_train, "Shallow Decision Tree (Appropriate Complexity)")
```

### Code Example 2b: Hyperparameter Diagnosis with Validation Curve

```python
from sklearn.model_selection import validation_curve
import matplotlib.pyplot as plt
import numpy as np

def plot_validation_curve(estimator, X, y, param_name, param_range, title="Validation Curve"):
    """Visualize training/validation scores as a hyperparameter is varied"""
    train_scores, test_scores = validation_curve(
        estimator, X, y,
        param_name=param_name,
        param_range=param_range,
        cv=5, scoring="accuracy", n_jobs=-1
    )

    train_mean = train_scores.mean(axis=1)
    train_std = train_scores.std(axis=1)
    test_mean = test_scores.mean(axis=1)
    test_std = test_scores.std(axis=1)

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.fill_between(param_range, train_mean - train_std,
                    train_mean + train_std, alpha=0.1, color="blue")
    ax.fill_between(param_range, test_mean - test_std,
                    test_mean + test_std, alpha=0.1, color="orange")
    ax.plot(param_range, train_mean, "o-", color="blue", label="Training Score")
    ax.plot(param_range, test_mean, "o-", color="orange", label="Validation Score")
    ax.set_xlabel(param_name)
    ax.set_ylabel("Accuracy")
    ax.set_title(title)
    ax.legend()
    ax.grid(True, alpha=0.3)

    best_idx = np.argmax(test_mean)
    ax.axvline(x=param_range[best_idx], color="green", linestyle="--",
               label=f"Best Value={param_range[best_idx]}")
    ax.legend()

    plt.tight_layout()
    plt.savefig("reports/validation_curve.png", dpi=150)
    plt.close()

    return param_range[best_idx]

# Validation curve for decision tree depth
best_depth = plot_validation_curve(
    DecisionTreeClassifier(random_state=42),
    X_train_s, y_train,
    param_name="max_depth",
    param_range=[1, 2, 3, 5, 7, 10, 15, 20, 30, None],
    title="Decision Tree: Validation Curve for max_depth"
)
print(f"Optimal max_depth: {best_depth}")
```

### Systematic Approach to Preventing Overfitting

```
Classification of Overfitting Countermeasures:

  1. Increase Data Volume
     ├── Strengthen data collection
     ├── Data augmentation (image rotation, text synonym replacement, etc.)
     └── Synthetic data generation (SMOTE, GANs, etc.)

  2. Limit Model Complexity
     ├── Reduce number of parameters
     ├── Choose shallower architectures
     └── Remove noisy features via feature selection

  3. Regularization
     ├── L1 Regularization (Lasso): sparsification, feature selection effect
     ├── L2 Regularization (Ridge): shrink parameters toward zero
     ├── Elastic Net: L1 + L2
     ├── Dropout (neural networks)
     └── Batch Normalization

  4. Ensemble Learning
     ├── Bagging: reduces variance (RandomForest)
     ├── Boosting: reduces bias (XGBoost, LightGBM)
     └── Stacking: meta-learning from multiple models

  5. Early Stopping
     └── Stop training when validation score stops improving
```

```python
# Example: regularization implementation
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
import numpy as np

# Comparison of L1, L2, ElasticNet
regularizations = {
    "L1 (Lasso)": LogisticRegression(penalty="l1", solver="saga", C=1.0, max_iter=5000),
    "L2 (Ridge)": LogisticRegression(penalty="l2", solver="saga", C=1.0, max_iter=5000),
    "ElasticNet": LogisticRegression(penalty="elasticnet", solver="saga",
                                      C=1.0, l1_ratio=0.5, max_iter=5000),
    "No Regularization": LogisticRegression(penalty=None, solver="saga", max_iter=5000),
}

print("Comparison of regularization methods:")
print("-" * 60)
for name, model in regularizations.items():
    scores = cross_val_score(model, X_train_s, y_train, cv=5, scoring="accuracy")
    model.fit(X_train_s, y_train)
    n_nonzero = np.sum(np.abs(model.coef_) > 1e-6)
    print(f"  {name:20s}: Accuracy={scores.mean():.4f} ± {scores.std():.4f}, "
          f"Non-zero coefs={n_nonzero}")
```

---

## 6. Cross-Validation

### Types of Cross-Validation

```
K-Fold Cross-Validation (K=5):

  Fold 1: [TEST] [Train] [Train] [Train] [Train]
  Fold 2: [Train] [TEST] [Train] [Train] [Train]
  Fold 3: [Train] [Train] [TEST] [Train] [Train]
  Fold 4: [Train] [Train] [Train] [TEST] [Train]
  Fold 5: [Train] [Train] [Train] [Train] [TEST]

  Final Score = Mean ± Standard Deviation across 5 folds

Stratified K-Fold (for class imbalance):
  Maintains class proportions in each fold

Time Series Split (for time series data):
  Fold 1: [Train] → [TEST]
  Fold 2: [Train][Train] → [TEST]
  Fold 3: [Train][Train][Train] → [TEST]
  * Never train on future data

Group K-Fold (for grouped data):
  Prevents the same group from appearing in both train and validation
  Example: medical data per patient, where patients are treated as groups

Leave-One-Out (LOO):
  K = number of samples. Effective for small data but computationally expensive
```

### Code Example 3: Choosing Among Cross-Validation Strategies

```python
from sklearn.model_selection import (
    KFold, StratifiedKFold, TimeSeriesSplit, GroupKFold,
    cross_validate, RepeatedStratifiedKFold, LeaveOneOut
)
from sklearn.ensemble import GradientBoostingClassifier
import numpy as np

def comprehensive_cv(model, X, y, cv_strategy="stratified", groups=None):
    """Run comprehensive cross-validation"""

    strategies = {
        "kfold": KFold(n_splits=5, shuffle=True, random_state=42),
        "stratified": StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        "repeated": RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42),
        "timeseries": TimeSeriesSplit(n_splits=5),
    }

    if cv_strategy == "group" and groups is not None:
        cv = GroupKFold(n_splits=5)
        scoring = ["accuracy", "f1", "precision", "recall", "roc_auc"]
        results = cross_validate(
            model, X, y, cv=cv, scoring=scoring,
            return_train_score=True, n_jobs=-1, groups=groups
        )
    else:
        cv = strategies[cv_strategy]
        scoring = ["accuracy", "f1", "precision", "recall", "roc_auc"]
        results = cross_validate(
            model, X, y, cv=cv, scoring=scoring,
            return_train_score=True, n_jobs=-1
        )

    print(f"Cross-validation strategy: {cv_strategy}")
    print("-" * 70)
    for metric in scoring:
        train_key = f"train_{metric}"
        test_key = f"test_{metric}"
        print(f"  {metric:12s}: "
              f"Train={results[train_key].mean():.4f} ± {results[train_key].std():.4f}  "
              f"Test={results[test_key].mean():.4f} ± {results[test_key].std():.4f}")

    # Determine degree of overfitting
    train_acc = results["train_accuracy"].mean()
    test_acc = results["test_accuracy"].mean()
    gap = train_acc - test_acc
    if gap > 0.1:
        print(f"\n  ⚠ Signs of overfitting (Train-Test Gap = {gap:.4f})")
    elif test_acc < 0.6:
        print(f"\n  ⚠ Signs of underfitting (Test Accuracy = {test_acc:.4f})")
    else:
        print(f"\n  ✓ Good fit (Gap = {gap:.4f})")

    return results

model = GradientBoostingClassifier(n_estimators=100, random_state=42)
results = comprehensive_cv(model, X_train_s, y_train, "stratified")
```

### Preventing Data Leakage in Cross-Validation

```python
# ★ Important: Correct implementation to prevent data leakage in cross-validation

# BAD: Preprocess all data BEFORE cross-validation
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from sklearn.svm import SVC

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)  # ← Test data information leaks!
scores = cross_val_score(SVC(), X_scaled, y, cv=5)
print(f"With leakage: {scores.mean():.4f}")  # Overly optimistic result

# GOOD: Include preprocessing inside CV using a pipeline
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("svm", SVC()),
])
scores = cross_val_score(pipe, X, y, cv=5)  # fit_transform separately inside each fold
print(f"Without leakage: {scores.mean():.4f}")  # Accurate result
```

---

## 7. Evaluation Metrics

### Code Example 4: Detailed Calculation of Classification Metrics

```python
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix,
    precision_recall_curve, roc_curve, average_precision_score,
    matthews_corrcoef, cohen_kappa_score, log_loss,
    balanced_accuracy_score
)
import matplotlib.pyplot as plt

class ClassificationEvaluator:
    """Comprehensive evaluation of a classification model"""

    def __init__(self, y_true, y_pred, y_prob=None):
        self.y_true = y_true
        self.y_pred = y_pred
        self.y_prob = y_prob

    def print_metrics(self):
        """Display key metrics"""
        print("=" * 60)
        print("Classification Evaluation Metrics")
        print("=" * 60)
        print(f"  Accuracy:          {accuracy_score(self.y_true, self.y_pred):.4f}")
        print(f"  Balanced Accuracy: {balanced_accuracy_score(self.y_true, self.y_pred):.4f}")
        print(f"  Precision:         {precision_score(self.y_true, self.y_pred):.4f}")
        print(f"  Recall:            {recall_score(self.y_true, self.y_pred):.4f}")
        print(f"  F1-Score:          {f1_score(self.y_true, self.y_pred):.4f}")
        print(f"  MCC:               {matthews_corrcoef(self.y_true, self.y_pred):.4f}")
        print(f"  Cohen's Kappa:     {cohen_kappa_score(self.y_true, self.y_pred):.4f}")
        if self.y_prob is not None:
            print(f"  AUC-ROC:           {roc_auc_score(self.y_true, self.y_prob):.4f}")
            print(f"  AP:                {average_precision_score(self.y_true, self.y_prob):.4f}")
            print(f"  Log Loss:          {log_loss(self.y_true, self.y_prob):.4f}")

        cm = confusion_matrix(self.y_true, self.y_pred)
        print(f"\n  Confusion Matrix:")
        print(f"             Pred=0  Pred=1")
        print(f"  Actual=0   {cm[0,0]:5d}   {cm[0,1]:5d}  (TN, FP)")
        print(f"  Actual=1   {cm[1,0]:5d}   {cm[1,1]:5d}  (FN, TP)")

        # Additional metrics
        tn, fp, fn, tp = cm.ravel()
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0
        print(f"\n  Specificity (TNR): {specificity:.4f}")
        print(f"  NPV:               {npv:.4f}")
        print(f"  FPR:               {fp / (fp + tn):.4f}")
        print(f"  FNR:               {fn / (fn + tp):.4f}")

    def plot_roc_pr(self):
        """Draw ROC curve and PR curve side by side"""
        if self.y_prob is None:
            print("Probability predictions are required")
            return

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # ROC curve
        fpr, tpr, thresholds_roc = roc_curve(self.y_true, self.y_prob)
        auc = roc_auc_score(self.y_true, self.y_prob)
        ax1.plot(fpr, tpr, label=f"AUC = {auc:.3f}")
        ax1.plot([0, 1], [0, 1], "k--", alpha=0.3)
        ax1.set_xlabel("False Positive Rate (FPR)")
        ax1.set_ylabel("True Positive Rate (TPR)")
        ax1.set_title("ROC Curve")
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        # PR curve
        prec, rec, thresholds_pr = precision_recall_curve(self.y_true, self.y_prob)
        ap = average_precision_score(self.y_true, self.y_prob)
        ax2.plot(rec, prec, label=f"AP = {ap:.3f}")
        ax2.set_xlabel("Recall")
        ax2.set_ylabel("Precision")
        ax2.set_title("PR Curve")
        ax2.legend()
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig("reports/roc_pr_curves.png", dpi=150)
        plt.close()

    def find_optimal_threshold(self, metric="f1"):
        """Search for the optimal threshold"""
        if self.y_prob is None:
            raise ValueError("Probability predictions are required")

        thresholds = np.arange(0.1, 0.9, 0.01)
        best_score = 0
        best_threshold = 0.5

        print(f"\nThreshold optimization (metric: {metric}):")
        print("-" * 50)

        for t in thresholds:
            y_pred_t = (self.y_prob >= t).astype(int)
            if metric == "f1":
                score = f1_score(self.y_true, y_pred_t, zero_division=0)
            elif metric == "precision":
                score = precision_score(self.y_true, y_pred_t, zero_division=0)
            elif metric == "recall":
                score = recall_score(self.y_true, y_pred_t, zero_division=0)

            if score > best_score:
                best_score = score
                best_threshold = t

        print(f"  Optimal threshold: {best_threshold:.2f}")
        print(f"  Optimal {metric}: {best_score:.4f}")
        print(f"  {metric} at default threshold (0.5): "
              f"{f1_score(self.y_true, (self.y_prob >= 0.5).astype(int)):.4f}")

        return best_threshold

# Usage example
model = LogisticRegression(max_iter=1000)
model.fit(X_train_s, y_train)
y_pred = model.predict(X_test_s)
y_prob = model.predict_proba(X_test_s)[:, 1]

evaluator = ClassificationEvaluator(y_test, y_pred, y_prob)
evaluator.print_metrics()
evaluator.plot_roc_pr()
best_t = evaluator.find_optimal_threshold("f1")
```

### Code Example 4b: Evaluation for Multi-Class Classification

```python
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, f1_score
)
from sklearn.preprocessing import label_binarize
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def multiclass_evaluation(y_true, y_pred, y_prob, class_names):
    """Comprehensive evaluation of multi-class classification"""

    print("=" * 60)
    print("Multi-Class Classification Evaluation")
    print("=" * 60)

    # Classification Report
    print(classification_report(y_true, y_pred, target_names=class_names))

    # Macro / Micro / Weighted averages
    for avg in ["micro", "macro", "weighted"]:
        f1 = f1_score(y_true, y_pred, average=avg)
        print(f"  F1 ({avg:8s}): {f1:.4f}")

    # Multi-class AUC-ROC
    if y_prob is not None:
        try:
            auc_ovr = roc_auc_score(y_true, y_prob, multi_class="ovr", average="macro")
            auc_ovo = roc_auc_score(y_true, y_prob, multi_class="ovo", average="macro")
            print(f"\n  AUC-ROC (OVR macro): {auc_ovr:.4f}")
            print(f"  AUC-ROC (OVO macro): {auc_ovo:.4f}")
        except ValueError as e:
            print(f"  AUC calculation error: {e}")

    # Confusion matrix heatmap
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=class_names, yticklabels=class_names, ax=ax)
    ax.set_xlabel("Predicted Label")
    ax.set_ylabel("Actual Label")
    ax.set_title("Multi-Class Confusion Matrix")
    plt.tight_layout()
    plt.savefig("reports/multiclass_confusion.png", dpi=150)
    plt.close()

    return cm
```

### Code Example 5: Calculating Regression Metrics

```python
import numpy as np
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error,
    r2_score, mean_absolute_percentage_error,
    median_absolute_error, max_error,
    explained_variance_score
)
import matplotlib.pyplot as plt

class RegressionEvaluator:
    """Comprehensive evaluation of a regression model"""

    def __init__(self, y_true, y_pred, n_features=None):
        self.y_true = np.array(y_true)
        self.y_pred = np.array(y_pred)
        self.n_features = n_features

    def all_metrics(self) -> dict:
        """Calculate all metrics"""
        mse = mean_squared_error(self.y_true, self.y_pred)
        metrics = {
            "MSE": mse,
            "RMSE": np.sqrt(mse),
            "MAE": mean_absolute_error(self.y_true, self.y_pred),
            "Median AE": median_absolute_error(self.y_true, self.y_pred),
            "Max Error": max_error(self.y_true, self.y_pred),
            "MAPE(%)": mean_absolute_percentage_error(self.y_true, self.y_pred) * 100,
            "R²": r2_score(self.y_true, self.y_pred),
            "Explained Var": explained_variance_score(self.y_true, self.y_pred),
        }
        if self.n_features is not None:
            metrics["Adjusted R²"] = self._adjusted_r2(self.n_features)
        return metrics

    def _adjusted_r2(self, n_features: int) -> float:
        """Degrees-of-freedom-adjusted R²"""
        n = len(self.y_true)
        r2 = r2_score(self.y_true, self.y_pred)
        return 1 - (1 - r2) * (n - 1) / (n - n_features - 1)

    def print_metrics(self):
        metrics = self.all_metrics()
        print("=" * 50)
        print("Regression Evaluation Metrics")
        print("=" * 50)
        for name, value in metrics.items():
            print(f"  {name:15s}: {value:.4f}")

    def plot_diagnostics(self):
        """Create regression diagnostic plots"""
        residuals = self.y_true - self.y_pred

        fig, axes = plt.subplots(2, 2, figsize=(14, 12))

        # 1. Predicted vs Actual
        axes[0, 0].scatter(self.y_true, self.y_pred, alpha=0.5, s=20)
        min_val = min(self.y_true.min(), self.y_pred.min())
        max_val = max(self.y_true.max(), self.y_pred.max())
        axes[0, 0].plot([min_val, max_val], [min_val, max_val], "r--")
        axes[0, 0].set_xlabel("Actual Values")
        axes[0, 0].set_ylabel("Predicted Values")
        axes[0, 0].set_title("Predicted vs Actual")

        # 2. Residual plot
        axes[0, 1].scatter(self.y_pred, residuals, alpha=0.5, s=20)
        axes[0, 1].axhline(y=0, color="r", linestyle="--")
        axes[0, 1].set_xlabel("Predicted Values")
        axes[0, 1].set_ylabel("Residuals")
        axes[0, 1].set_title("Residual Plot")

        # 3. Histogram of residuals
        axes[1, 0].hist(residuals, bins=30, edgecolor="black", alpha=0.7)
        axes[1, 0].axvline(x=0, color="r", linestyle="--")
        axes[1, 0].set_xlabel("Residuals")
        axes[1, 0].set_ylabel("Frequency")
        axes[1, 0].set_title("Distribution of Residuals")

        # 4. Q-Q plot
        from scipy import stats
        (osm, osr), (slope, intercept, r) = stats.probplot(residuals, dist="norm")
        axes[1, 1].scatter(osm, osr, alpha=0.5, s=20)
        axes[1, 1].plot(osm, slope * np.array(osm) + intercept, "r--")
        axes[1, 1].set_xlabel("Theoretical Quantiles")
        axes[1, 1].set_ylabel("Sample Quantiles")
        axes[1, 1].set_title(f"Q-Q Plot (R={r:.4f})")

        plt.tight_layout()
        plt.savefig("reports/regression_diagnostics.png", dpi=150)
        plt.close()

# Usage example
# evaluator = RegressionEvaluator(y_test, y_pred, n_features=10)
# evaluator.print_metrics()
# evaluator.plot_diagnostics()
```

---

## 8. Hyperparameter Optimization

### Comparison of Optimization Methods

```
Hyperparameter Optimization Methods:

  Method              Search Strategy          Compute Cost  Discovery Efficiency
  ─────────────────────────────────────────────────────────────────────────────
  Grid Search         All combinations         High          Low
  Random Search       Random sampling          Moderate      Moderate
  Bayesian (Optuna)   Bayesian optimization    Low           High
  Hyperband           With early stopping      Low           High

  General recommendations:
    - Few parameters (2-3): Grid Search
    - Moderate parameters (4-6): Random Search
    - Many parameters / wide search space: Bayesian (Optuna)
```

### Code Example 6: Grid Search and Random Search

```python
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
from sklearn.ensemble import RandomForestClassifier
from scipy.stats import randint, uniform
import time

# Grid Search
param_grid = {
    "n_estimators": [50, 100, 200],
    "max_depth": [3, 5, 10, None],
    "min_samples_split": [2, 5, 10],
    "min_samples_leaf": [1, 2, 4],
}

print("Grid Search")
start = time.time()
grid = GridSearchCV(
    RandomForestClassifier(random_state=42),
    param_grid, cv=5, scoring="f1", n_jobs=-1, verbose=0
)
grid.fit(X_train_s, y_train)
elapsed_grid = time.time() - start
print(f"  Combinations: {len(grid.cv_results_['params'])}")
print(f"  Best score: {grid.best_score_:.4f}")
print(f"  Best params: {grid.best_params_}")
print(f"  Elapsed time: {elapsed_grid:.1f}s")

# Random Search
param_distributions = {
    "n_estimators": randint(50, 500),
    "max_depth": [3, 5, 10, 15, 20, None],
    "min_samples_split": randint(2, 20),
    "min_samples_leaf": randint(1, 10),
    "max_features": uniform(0.1, 0.9),
}

print("\nRandom Search")
start = time.time()
random_search = RandomizedSearchCV(
    RandomForestClassifier(random_state=42),
    param_distributions, n_iter=50, cv=5, scoring="f1",
    n_jobs=-1, random_state=42, verbose=0
)
random_search.fit(X_train_s, y_train)
elapsed_random = time.time() - start
print(f"  Trials: 50")
print(f"  Best score: {random_search.best_score_:.4f}")
print(f"  Best params: {random_search.best_params_}")
print(f"  Elapsed time: {elapsed_random:.1f}s")
```

### Code Example 7: Bayesian Optimization with Optuna

```python
import optuna
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score
import warnings
warnings.filterwarnings("ignore")

def objective(trial):
    """Optuna objective function"""
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 50, 500),
        "max_depth": trial.suggest_int("max_depth", 2, 15),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
        "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
        "max_features": trial.suggest_float("max_features", 0.1, 1.0),
    }

    model = GradientBoostingClassifier(random_state=42, **params)
    scores = cross_val_score(model, X_train_s, y_train, cv=5, scoring="f1", n_jobs=-1)
    return scores.mean()

# Run optimization
study = optuna.create_study(direction="maximize", study_name="gbc_optimization")
study.optimize(objective, n_trials=100, show_progress_bar=True)

print(f"\nBest score: {study.best_value:.4f}")
print(f"Best params:")
for key, value in study.best_params.items():
    print(f"  {key}: {value}")

# Train model with optimal parameters
best_model = GradientBoostingClassifier(random_state=42, **study.best_params)
best_model.fit(X_train_s, y_train)
test_score = best_model.score(X_test_s, y_test)
print(f"\nTest score: {test_score:.4f}")

# Parameter importance
importance = optuna.importance.get_param_importances(study)
print("\nParameter importance:")
for param, imp in importance.items():
    print(f"  {param}: {imp:.4f}")
```

### Code Example 8: LightGBM Optimization (Practical Pattern)

```python
import lightgbm as lgb
import optuna
from sklearn.model_selection import StratifiedKFold
import numpy as np

def lgbm_objective(trial, X, y, cv=5):
    """Optuna objective function for LightGBM (production-ready)"""
    params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "boosting_type": "gbdt",
        "verbosity": -1,
        "n_estimators": trial.suggest_int("n_estimators", 100, 2000),
        "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.3, log=True),
        "max_depth": trial.suggest_int("max_depth", 3, 12),
        "num_leaves": trial.suggest_int("num_leaves", 8, 256),
        "min_child_samples": trial.suggest_int("min_child_samples", 5, 100),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.3, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
    }

    skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
    scores = []

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_train_fold, X_val_fold = X[train_idx], X[val_idx]
        y_train_fold, y_val_fold = y[train_idx], y[val_idx]

        model = lgb.LGBMClassifier(**params)
        model.fit(
            X_train_fold, y_train_fold,
            eval_set=[(X_val_fold, y_val_fold)],
            callbacks=[
                lgb.early_stopping(50, verbose=False),
                lgb.log_evaluation(period=0),
            ]
        )

        from sklearn.metrics import f1_score
        y_pred = model.predict(X_val_fold)
        scores.append(f1_score(y_val_fold, y_pred))

        # Optuna pruning
        trial.report(np.mean(scores), fold)
        if trial.should_prune():
            raise optuna.TrialPruned()

    return np.mean(scores)

# study = optuna.create_study(direction="maximize",
#                              pruner=optuna.pruners.MedianPruner())
# study.optimize(lambda trial: lgbm_objective(trial, X_train, y_train),
#                n_trials=200, show_progress_bar=True)
```

---

## 9. Feature Importance and Interpretability

### Methods for Calculating Feature Importance

```python
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
import pandas as pd

def feature_importance_analysis(model, X_train, X_test, y_test, feature_names):
    """Analyze feature importance using multiple methods"""

    # 1. Built-in importance (impurity-based)
    if hasattr(model, "feature_importances_"):
        imp_builtin = model.feature_importances_
    else:
        imp_builtin = None

    # 2. Permutation Importance (recommended)
    perm_result = permutation_importance(
        model, X_test, y_test, n_repeats=10, random_state=42, n_jobs=-1
    )

    # Comparison of results
    df = pd.DataFrame({
        "feature": feature_names,
        "perm_importance_mean": perm_result.importances_mean,
        "perm_importance_std": perm_result.importances_std,
    })
    if imp_builtin is not None:
        df["builtin_importance"] = imp_builtin

    df = df.sort_values("perm_importance_mean", ascending=False)

    print("Feature Importance (Permutation Importance):")
    print("-" * 60)
    for _, row in df.head(15).iterrows():
        print(f"  {row['feature']:30s}: "
              f"{row['perm_importance_mean']:.4f} ± {row['perm_importance_std']:.4f}")

    # Visualization
    fig, ax = plt.subplots(figsize=(10, 8))
    top_n = min(20, len(df))
    top_df = df.head(top_n)
    ax.barh(range(top_n), top_df["perm_importance_mean"].values, align="center")
    ax.set_yticks(range(top_n))
    ax.set_yticklabels(top_df["feature"].values)
    ax.set_xlabel("Permutation Importance")
    ax.set_title("Feature Importance (Top 20)")
    ax.invert_yaxis()
    plt.tight_layout()
    plt.savefig("reports/feature_importance.png", dpi=150)
    plt.close()

    return df

# SHAP value analysis (more detailed)
def shap_analysis(model, X_test, feature_names):
    """Analyze feature impact using SHAP values"""
    import shap

    # TreeExplainer (for tree-based models, fast)
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    # Summary Plot
    shap.summary_plot(shap_values, X_test, feature_names=feature_names, show=False)
    plt.tight_layout()
    plt.savefig("reports/shap_summary.png", dpi=150, bbox_inches="tight")
    plt.close()

    # Explanation for individual samples
    shap.plots.waterfall(explainer(X_test)[0], show=False)
    plt.tight_layout()
    plt.savefig("reports/shap_waterfall.png", dpi=150, bbox_inches="tight")
    plt.close()

    return shap_values
```

---

## Comparison Tables

### Choosing Among Classification Evaluation Metrics

| Metric | Formula | When to Prioritize | Robustness to Class Imbalance |
|---|---|---|---|
| Accuracy | (TP+TN)/N | Overall evaluation when classes are balanced | Weak |
| Balanced Accuracy | (TPR+TNR)/2 | Overall evaluation when classes are imbalanced | Strong |
| Precision | TP/(TP+FP) | When cost of false positives is high (spam detection) | Moderate |
| Recall | TP/(TP+FN) | When cost of false negatives is high (cancer screening) | Moderate |
| F1-Score | 2×P×R/(P+R) | Balance between Precision and Recall | Moderate |
| F-beta | (1+β²)PR/(β²P+R) | Adjust P/R weight with β | Moderate |
| MCC | (TP×TN-FP×FN)/√... | Comprehensive metric considering all cells | Strong |
| AUC-ROC | Area under ROC curve | Threshold-independent overall evaluation | Moderate |
| Average Precision | Area under PR curve | Positive detection ability with class imbalance | Strong |
| Log Loss | -Σ y log(p) | Accuracy of probability predictions | Moderate |
| Cohen's Kappa | (accuracy-expected)/(1-expected) | Evaluation excluding chance agreement | Strong |

### Comparison of Regression Evaluation Metrics

| Metric | Formula | Scale Dependent | Outlier Robustness | Interpretability |
|---|---|---|---|---|
| MSE | Σ(y-y_hat)²/n | Yes | Weak (squared) | Low |
| RMSE | √MSE | Yes (original units) | Weak | High |
| MAE | Σ|y-y_hat|/n | Yes (original units) | Moderate | High |
| Median AE | median(|y-y_hat|) | Yes (original units) | Strong | High |
| MAPE | Σ|y-y_hat|/y /n | No (%) | Weak | High |
| R² | 1-SS_res/SS_tot | No (0 to 1) | Weak | High |
| Adjusted R² | Adjusted R² | No | Weak | High |
| Explained Var | 1-Var(res)/Var(y) | No (0 to 1) | Weak | Moderate |

### Comparison of Learning Paradigms

| Paradigm | Data Type | Main Tasks | Examples |
|---|---|---|---|
| Supervised Learning | Labeled | Classification, Regression | SVM, RF, XGBoost |
| Unsupervised Learning | Unlabeled | Clustering, Dimensionality Reduction | K-means, PCA |
| Semi-supervised | Partially labeled | Classification with few labels | Self-Training, Label Propagation |
| Self-supervised | Unlabeled (pretext task) | Representation learning | BERT, SimCLR |
| Reinforcement Learning | Reward signal | Sequential decision making | DQN, PPO |
| Transfer Learning | Pre-trained model | Domain adaptation | Fine-tuning |

---

## Anti-Patterns

### Anti-Pattern 1: Accuracy Obsession with Imbalanced Data

```python
# BAD: Using Accuracy on data with 99% normal and 1% fraud
# "Predict everything as normal" → Accuracy 99% but zero fraud detection ability

# GOOD: Choose appropriate metrics for imbalanced data
from sklearn.metrics import classification_report, f1_score
from sklearn.ensemble import RandomForestClassifier
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

# Method 1: Handle class imbalance with class_weight
model = LogisticRegression(class_weight="balanced", max_iter=1000)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

# Evaluate with F1, Recall, PR-AUC
print(classification_report(y_test, y_pred))

# Method 2: Oversample with SMOTE
smote_pipe = ImbPipeline([
    ("smote", SMOTE(random_state=42)),
    ("classifier", RandomForestClassifier(n_estimators=100, random_state=42)),
])
smote_pipe.fit(X_train, y_train)
y_pred_smote = smote_pipe.predict(X_test)
print(f"SMOTE + RF F1: {f1_score(y_test, y_pred_smote):.4f}")

# Method 3: Cost-sensitive learning
from sklearn.ensemble import GradientBoostingClassifier
# Reflect misclassification costs via sample_weight
sample_weights = np.where(y_train == 1, 10.0, 1.0)  # 10x weight for minority class
model_weighted = GradientBoostingClassifier(n_estimators=100, random_state=42)
model_weighted.fit(X_train, y_train, sample_weight=sample_weights)
```

### Anti-Pattern 2: Tuning Hyperparameters on Test Data

```python
# BAD: Adjusting while looking at test scores → information leakage
for max_depth in [3, 5, 10, 20]:
    model = DecisionTreeClassifier(max_depth=max_depth)
    model.fit(X_train, y_train)
    score = model.score(X_test, y_test)  # Evaluating on test → NOT OK
    print(f"depth={max_depth}: {score:.4f}")

# GOOD: Tune using validation data or cross-validation; use test set only once at the end
from sklearn.model_selection import GridSearchCV

param_grid = {"max_depth": [3, 5, 10, 20]}
grid = GridSearchCV(
    DecisionTreeClassifier(random_state=42),
    param_grid, cv=5, scoring="f1"
)
grid.fit(X_train, y_train)  # Train + validate only
print(f"Best params: {grid.best_params_}")
print(f"Test score: {grid.score(X_test, y_test):.4f}")  # One final evaluation
```

### Anti-Pattern 3: Data Leakage in Preprocessing

```python
# BAD: Fit on data including test set
scaler = StandardScaler()
X_all_scaled = scaler.fit_transform(np.vstack([X_train, X_test]))  # Leakage!
X_train_scaled = X_all_scaled[:len(X_train)]
X_test_scaled = X_all_scaled[len(X_train):]

# GOOD: Fit only on training data, only transform test data
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)  # fit + transform
X_test_scaled = scaler.transform(X_test)  # transform only
```

### Anti-Pattern 4: Data Leakage in Feature Selection

```python
# BAD: Feature selection on all data before CV
from sklearn.feature_selection import SelectKBest, f_classif

selector = SelectKBest(f_classif, k=10)
X_selected = selector.fit_transform(X, y)  # Select on all data → leakage
scores = cross_val_score(SVC(), X_selected, y, cv=5)

# GOOD: Include in pipeline so selection happens inside CV
pipe = Pipeline([
    ("selector", SelectKBest(f_classif, k=10)),
    ("scaler", StandardScaler()),
    ("svm", SVC()),
])
scores = cross_val_score(pipe, X, y, cv=5)  # Selection inside each fold
```

### Anti-Pattern 5: Random Split of Time Series Data

```python
# BAD: Applying random split to time series data
# "Look-ahead bias" occurs: predicting the past using future information
X_train, X_test, y_train, y_test = train_test_split(
    X_timeseries, y_timeseries, test_size=0.2, random_state=42  # NOT OK
)

# GOOD: Split while preserving temporal order
from sklearn.model_selection import TimeSeriesSplit

tscv = TimeSeriesSplit(n_splits=5)
for train_idx, test_idx in tscv.split(X_timeseries):
    X_train = X_timeseries[train_idx]
    X_test = X_timeseries[test_idx]
    # Always train on past, evaluate on future
    assert train_idx.max() < test_idx.min(), "Temporal order is broken"
```

---

## 10. Model Selection Flowchart

```
Model selection based on data characteristics:

                     ┌──────────────────┐
                     │ What is the task?│
                     └────────┬─────────┘
              ┌───────────────┼───────────────┐
              v               v               v
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │Classification│  │Regression│  │  Clustering  │
        └────┬─────┘   └────┬─────┘   └──────┬───────┘
             │              │                 │
        ┌────┴────┐    ┌────┴────┐      ┌─────┴─────┐
        │Linearly │    │ Linear  │      │  K known? │
        │separable│    │relation?│      └─────┬─────┘
        └────┬────┘    └────┬────┘        Y/   \N
         Y/   \N        Y/   \N          /       \
        /       \      /       \     K-means   DBSCAN
 Logistic Reg  │  Linear Reg  │     GMM      Hierarchical
 SVM(linear)  │  Ridge/Lasso │
              │              │
        ┌─────┴─────┐  ┌────┴─────┐
        │ Many data?│  │ Many data?│
        └─────┬─────┘  └────┬─────┘
         Y/    \N       Y/    \N
        /        \     /        \
  Ensemble    SVM  Ensemble   SVR
  (RF/XGB/  (RBF)  (RF/XGB)  KNN Reg
   LightGBM)
```

### Characteristics Comparison of Major Algorithms

```
Algorithm Selection Guide:

  Algorithm        Train Speed  Inference Speed  Interpretability  Nonlinear  Large Scale
  ──────────────────────────────────────────────────────────────────────────────────────
  Linear Reg/LR    ★★★★★        ★★★★★            ★★★★★             ✗          ★★★★★
  SVM              ★★★☆☆        ★★★★☆            ★★☆☆☆             ✓          ★★☆☆☆
  Decision Tree    ★★★★★        ★★★★★            ★★★★☆             ✓          ★★★★☆
  Random Forest    ★★★★☆        ★★★★☆            ★★★☆☆             ✓          ★★★★☆
  XGBoost/LGBM     ★★★★☆        ★★★★★            ★★☆☆☆             ✓          ★★★★★
  KNN              ★★★★★        ★☆☆☆☆            ★★★☆☆             ✓          ★☆☆☆☆
  Neural Network   ★☆☆☆☆        ★★★★☆            ★☆☆☆☆             ✓          ★★★★★
```

---

## Troubleshooting

### Common Problems and Solutions

| Problem | Symptoms | Solution |
|---|---|---|
| Overfitting | High Train / Low Test | Stronger regularization, more data, simpler model |
| Underfitting | Low Train / Low Test | More complex model, more features, adjust learning rate |
| Class imbalance | Low metrics for minority class | SMOTE, class_weight, cost-sensitive learning |
| Data leakage | CV score is too high | Use pipelines, include preprocessing inside CV |
| Too many features | Slow training, overfitting | PCA, feature selection, regularization |
| Out of memory | MemoryError | Mini-batch learning, reduce features, sparse matrices |
| No convergence | ConvergenceWarning | Increase max_iter, adjust learning rate, normalize |
| NaN predictions | Predictions contain NaN | Handle missing values, check feature scaling |

### Debugging Checklist

```python
def ml_debug_checklist(X_train, X_test, y_train, y_test, model):
    """Debugging checklist for a machine learning pipeline"""
    print("=" * 60)
    print("ML Debugging Checklist")
    print("=" * 60)

    # 1. Basic data statistics
    print("\n1. Data shapes:")
    print(f"   X_train: {X_train.shape}, X_test: {X_test.shape}")
    print(f"   y_train: {y_train.shape}, y_test: {y_test.shape}")

    # 2. Missing value check
    nan_train = np.isnan(X_train).sum()
    nan_test = np.isnan(X_test).sum()
    print(f"\n2. Missing values: Train={nan_train}, Test={nan_test}")
    if nan_train > 0 or nan_test > 0:
        print("   ⚠ Missing values found → processing with SimpleImputer etc. required")

    # 3. Infinite value check
    inf_train = np.isinf(X_train).sum()
    inf_test = np.isinf(X_test).sum()
    print(f"\n3. Infinite values: Train={inf_train}, Test={inf_test}")

    # 4. Class distribution
    if len(np.unique(y_train)) < 20:
        unique, counts = np.unique(y_train, return_counts=True)
        print(f"\n4. Class distribution (Train):")
        for u, c in zip(unique, counts):
            print(f"   Class {u}: {c} ({c/len(y_train)*100:.1f}%)")
        imbalance_ratio = counts.max() / counts.min()
        if imbalance_ratio > 5:
            print(f"   ⚠ Imbalance ratio: {imbalance_ratio:.1f}x → consider SMOTE/class_weight")

    # 5. Scale check
    print(f"\n5. Feature scales:")
    means = X_train.mean(axis=0)
    stds = X_train.std(axis=0)
    print(f"   Mean range: [{means.min():.2f}, {means.max():.2f}]")
    print(f"   Std range: [{stds.min():.2f}, {stds.max():.2f}]")
    if means.max() - means.min() > 100 or stds.max() / (stds.min() + 1e-10) > 100:
        print("   ⚠ High scale variability → StandardScaler recommended")

    # 6. Constant feature check
    const_features = np.where(stds == 0)[0]
    if len(const_features) > 0:
        print(f"\n6. Constant features: {len(const_features)} found → removal recommended")

    # 7. Highly correlated feature check
    corr = np.corrcoef(X_train.T)
    np.fill_diagonal(corr, 0)
    high_corr = np.where(np.abs(corr) > 0.95)
    n_high_corr = len(high_corr[0]) // 2
    if n_high_corr > 0:
        print(f"\n7. Highly correlated pairs (|r|>0.95): {n_high_corr} pairs → consider removing one")

    print("\n" + "=" * 60)

# Usage example
# ml_debug_checklist(X_train_s, X_test_s, y_train, y_test, model)
```

---

## FAQ

### Q1: How do you evaluate the "ground truth" in unsupervised learning?

**A:** There are two approaches: external evaluation (when ground truth labels are available) and internal evaluation (without labels). For internal evaluation, use metrics such as silhouette score (cluster separation), the elbow method (rate of inertia decrease), and Davies-Bouldin index. However, qualitative assessment using domain knowledge is ultimately indispensable.

### Q2: What is a good value for K in cross-validation?

**A:** K=5 or K=10 is standard. Use a larger K (up to Leave-One-Out) when data is scarce; K=3 to 5 is sufficient when computation is expensive. RepeatedKFold (repeated cross-validation) is also a technique to stabilize variance.

### Q3: What methods are available to prevent overfitting?

**A:** Key strategies: (1) regularization (L1/L2, Dropout), (2) early stopping, (3) data augmentation, (4) limiting model complexity (max_depth, etc.), (5) ensemble learning (Bagging, Boosting), (6) proper evaluation via cross-validation. The most effective approach is to "increase training data."

### Q4: Should I use F1 score or MCC?

**A:** MCC considers all four cells (TP, TN, FP, FN), making it more reliable than F1 under class imbalance. However, F1 is more intuitive and widely used. Research recommending MCC in papers and rigorous evaluations is growing. In practice, reporting both and judging based on the use case is desirable.

### Q5: How do I choose between Optuna and Grid Search?

**A:** Grid Search is sufficient when the parameter space is small (2-3 dimensions, up to 10 values each). Optuna is more efficient when the search space is wide or there are many continuous parameters. For multi-parameter models like LightGBM or XGBoost in particular, Optuna's Bayesian optimization is overwhelmingly more efficient.

### Q6: How do I choose among feature importance methods?

**A:** Impurity-based importance (Random Forest's `feature_importances_`) tends to overrate high-cardinality features, so Permutation Importance should be preferred. For more detailed analysis, use SHAP values to visualize feature impact at the individual sample level.

### Q7: What is the difference between test data and validation data?

**A:** Validation data is used for hyperparameter tuning and model selection. Test data is used only for final evaluation and must not have its information used at any stage of model building. In cross-validation, the role of validation is handled within the CV, so the test data must not be touched at all. Strictly adhere to the three-way split principle (Train/Validation/Test).

---

## Practical Workflow: End-to-End Example

```python
"""
Complete ML Workflow: Customer Churn Prediction
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    VotingClassifier
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
import optuna
import joblib
import warnings
warnings.filterwarnings("ignore")


class ChurnPredictionPipeline:
    """Practical pipeline for customer churn prediction"""

    def __init__(self, numeric_features, categorical_features):
        self.numeric_features = numeric_features
        self.categorical_features = categorical_features
        self.pipeline = None
        self.best_params = None

    def _create_preprocessor(self):
        """Create preprocessing pipeline"""
        numeric_transformer = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ])
        categorical_transformer = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(drop="first", sparse_output=False,
                                       handle_unknown="ignore")),
        ])
        return ColumnTransformer([
            ("num", numeric_transformer, self.numeric_features),
            ("cat", categorical_transformer, self.categorical_features),
        ])

    def optimize(self, X, y, n_trials=50):
        """Optimize hyperparameters with Optuna"""
        preprocessor = self._create_preprocessor()

        def objective(trial):
            model_name = trial.suggest_categorical("model",
                ["rf", "gb", "lr"])

            if model_name == "rf":
                classifier = RandomForestClassifier(
                    n_estimators=trial.suggest_int("n_estimators", 50, 300),
                    max_depth=trial.suggest_int("max_depth", 3, 15),
                    random_state=42,
                )
            elif model_name == "gb":
                classifier = GradientBoostingClassifier(
                    n_estimators=trial.suggest_int("n_estimators", 50, 300),
                    max_depth=trial.suggest_int("max_depth", 2, 10),
                    learning_rate=trial.suggest_float("lr", 0.01, 0.3, log=True),
                    random_state=42,
                )
            else:
                classifier = LogisticRegression(
                    C=trial.suggest_float("C", 0.01, 100, log=True),
                    max_iter=1000, random_state=42,
                )

            pipe = Pipeline([
                ("preprocessor", preprocessor),
                ("classifier", classifier),
            ])

            skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
            scores = []
            for train_idx, val_idx in skf.split(X, y):
                pipe.fit(X.iloc[train_idx], y.iloc[train_idx])
                y_prob = pipe.predict_proba(X.iloc[val_idx])[:, 1]
                scores.append(roc_auc_score(y.iloc[val_idx], y_prob))
            return np.mean(scores)

        study = optuna.create_study(direction="maximize")
        study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
        self.best_params = study.best_params
        print(f"Best AUC-ROC: {study.best_value:.4f}")
        print(f"Best params: {self.best_params}")
        return study

    def train(self, X_train, y_train):
        """Train model with optimal parameters"""
        preprocessor = self._create_preprocessor()

        model_name = self.best_params.get("model", "gb")
        params = {k: v for k, v in self.best_params.items() if k != "model"}

        if model_name == "rf":
            classifier = RandomForestClassifier(random_state=42, **params)
        elif model_name == "gb":
            params_gb = {k.replace("lr", "learning_rate"): v
                         for k, v in params.items()}
            classifier = GradientBoostingClassifier(random_state=42, **params_gb)
        else:
            classifier = LogisticRegression(max_iter=1000, random_state=42, **params)

        self.pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ])
        self.pipeline.fit(X_train, y_train)

    def evaluate(self, X_test, y_test):
        """Evaluate on test data"""
        y_pred = self.pipeline.predict(X_test)
        y_prob = self.pipeline.predict_proba(X_test)[:, 1]

        print("\n" + "=" * 50)
        print("Test Evaluation Results")
        print("=" * 50)
        print(classification_report(y_test, y_pred))
        print(f"AUC-ROC: {roc_auc_score(y_test, y_prob):.4f}")

    def save(self, path):
        """Save model"""
        joblib.dump(self.pipeline, path)
        print(f"Model saved: {path}")

    def load(self, path):
        """Load model"""
        self.pipeline = joblib.load(path)
        print(f"Model loaded: {path}")
```

---

## Summary

| Topic | Key Points |
|---|---|
| Supervised Learning | Learn f(X)≈y from input X and labels y. Divided into regression and classification |
| Unsupervised Learning | Discover data structure without labels. Clustering, dimensionality reduction, anomaly detection |
| Semi-supervised / Self-supervised | Learn from few labels or pretext tasks. Foundation for large-scale models |
| Reinforcement Learning | Learn a policy for sequential decision making from reward signals |
| Bias-Variance | Total Error = Bias² + Variance + Noise. Controlled by model complexity |
| Cross-Validation | K-Fold/Stratified/TimeSeries. Use test data only once at the end |
| Classification Metrics | Use F1/PR-AUC/MCC for imbalanced data. ROC-AUC for threshold-independent evaluation |
| Regression Metrics | RMSE (original units), R² (explained variance), MAPE (comparable as %) |
| Hyperparameters | Grid for few params, Optuna (Bayesian optimization) for many |
| Feature Importance | Prefer Permutation Importance; use SHAP for detailed analysis |
| Data Leakage Prevention | Include all preprocessing in pipelines; fit individually within CV |

---

## Next Guides to Read

- [03-python-ml-stack.md](./03-python-ml-stack.md) — Python ML development environment in detail
- [../01-classical-ml/00-regression.md](../01-classical-ml/00-regression.md) — Implementing regression models
- [../01-classical-ml/01-classification.md](../01-classical-ml/01-classification.md) — Implementing classification models

---

## References

1. **Trevor Hastie, Robert Tibshirani, Jerome Friedman** "The Elements of Statistical Learning" 2nd Edition, Springer, 2009
2. **scikit-learn** "Model evaluation: quantifying the quality of predictions" — https://scikit-learn.org/stable/modules/model_evaluation.html
3. **Google Developers** "Machine Learning Crash Course" — https://developers.google.com/machine-learning/crash-course
4. **Optuna** "A hyperparameter optimization framework" — https://optuna.readthedocs.io/
5. **SHAP** "SHapley Additive exPlanations" — https://shap.readthedocs.io/
6. **Chicco, D., Jurman, G.** "The advantages of the Matthews correlation coefficient (MCC) over F1 score and accuracy in binary classification evaluation" BMC Genomics, 2020
