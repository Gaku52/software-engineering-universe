# Neural Networks — Perceptrons, Activation Functions, and Backpropagation

> Build the foundational theory of neural networks from scratch and bridge the way to deep learning

## What You Will Learn in This Chapter

1. **Perceptrons and MLPs** — Evolution from single-layer to multi-layer and improved representational power
2. **Activation Functions** — Characteristics and selection criteria for ReLU, Sigmoid, Softmax, etc.
3. **Backpropagation** — Automatic gradient computation mechanism and parameter optimization
4. **Regularization Techniques** — Overfitting countermeasures such as Dropout, BatchNorm, and Weight Decay
5. **Practical Model Design** — Architecture design guidelines and debugging techniques


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. History and Theoretical Background of Neural Networks

### 1.1 From Perceptrons to Deep Learning

```
Chronological development:

1943  McCulloch-Pitts: Formal neuron model
      ├── Mathematical abstraction of biological neurons
      └── Linear combination of inputs → threshold function

1958  Rosenblatt: Perceptron
      ├── Single-layer trainable network
      ├── Perceptron learning rule (only for linearly separable problems)
      └── Weight update: w ← w + η(y - ŷ)x

1969  Minsky & Papert: Limitations of the perceptron
      ├── Proved it cannot solve the XOR problem
      └── → First AI winter

1986  Rumelhart, Hinton, Williams: Backpropagation
      ├── Enabled training of multi-layer networks
      ├── Gradient computation via the chain rule
      └── → Revival of neural networks

2006  Hinton: Deep Belief Networks
      ├── Training deep networks via pre-training
      └── → Dawn of deep learning

2012  Krizhevsky: AlexNet
      ├── Won the ImageNet competition
      ├── GPU computation + ReLU + Dropout
      └── → Deep learning boom

2017  Vaswani: Transformer
      ├── Attention Is All You Need
      ├── Self-attention mechanism
      └── → Arrival of the LLM era
```

### 1.2 Biological Neurons and Artificial Neurons

```
Biological neuron:
  Dendrites (input) → Cell body (integration) → Axon (output) → Synapse (connection)

  - Fires when the weighted sum of input signals exceeds a threshold
  - Synaptic strength corresponds to learning (Hebb's rule)
  - Approximately 86 billion neurons and 100 trillion synaptic connections

Artificial neuron:
  x₁w₁ + x₂w₂ + ... + xₙwₙ + b → Activation function → Output

  - Linear combination of inputs × weights + bias
  - Transformation by a nonlinear activation function
  - Learning = optimization of weights and biases
```

---

## 2. Structure of Neural Networks

### 2.1 MLP (Multi-Layer Perceptron) Architecture

```
Input layer      Hidden layer 1    Hidden layer 2    Output layer
(d dimensions)   (h1 units)        (h2 units)        (c dimensions)

 x₁ ─────┐   ┌─── h₁¹ ───┐   ┌─── h₁² ───┐   ┌─── y₁
          ├──>│            ├──>│            ├──>│
 x₂ ─────┤   ├─── h₂¹ ───┤   ├─── h₂² ───┤   ├─── y₂
          ├──>│            ├──>│            ├──>│
 x₃ ─────┤   ├─── h₃¹ ───┤   ├─── h₃² ───┤   └─── y₃
          ├──>│            ├──>│            │
 x₄ ─────┘   └─── h₄¹ ───┘   └─── h₃² ───┘

 Each arrow = weight (w) + bias (b)
 Each unit: z = Σ(wᵢxᵢ) + b  →  a = σ(z)  (activation function)

 Fully connected layer computation:
   Z = XW + b        (linear transformation)
   A = σ(Z)          (nonlinear activation)
```

### 2.2 Universal Approximation Theorem

```
Theorem:
  An MLP with a single hidden layer containing a sufficient number of units
  can approximate any continuous function on a compact set to arbitrary precision.

  ⚠️ Note: "Approximable" and "learnable" are different
  - The theorem guarantees existence, but whether SGD can find it is a separate issue
  - Deeper networks can achieve more efficient representations
  - In practice, make the network deeper while keeping each layer's unit count moderate

Advantages of depth:
  - Exponential efficiency gains (the number of units a shallow model needs for the same representation grows exponentially)
  - Hierarchical feature extraction (low-level → high-level features)
  - Better parameter efficiency
```

### Code Example 1: Full Neural Network Implementation (NumPy Only)

```python
import numpy as np

class NeuralNetwork:
    """Full-scratch NN implemented with NumPy only"""

    def __init__(self, layer_sizes: list, learning_rate: float = 0.01):
        self.layers = layer_sizes
        self.lr = learning_rate
        self.params = {}
        self.cache = {}

        # Xavier initialization
        for i in range(1, len(layer_sizes)):
            scale = np.sqrt(2.0 / layer_sizes[i-1])
            self.params[f"W{i}"] = np.random.randn(
                layer_sizes[i-1], layer_sizes[i]) * scale
            self.params[f"b{i}"] = np.zeros((1, layer_sizes[i]))

    def relu(self, z):
        return np.maximum(0, z)

    def relu_grad(self, z):
        return (z > 0).astype(float)

    def softmax(self, z):
        exp_z = np.exp(z - np.max(z, axis=1, keepdims=True))
        return exp_z / exp_z.sum(axis=1, keepdims=True)

    def forward(self, X):
        """Forward pass"""
        self.cache["A0"] = X
        A = X

        # Hidden layers: ReLU
        for i in range(1, len(self.layers) - 1):
            Z = A @ self.params[f"W{i}"] + self.params[f"b{i}"]
            A = self.relu(Z)
            self.cache[f"Z{i}"] = Z
            self.cache[f"A{i}"] = A

        # Output layer: Softmax
        i = len(self.layers) - 1
        Z = A @ self.params[f"W{i}"] + self.params[f"b{i}"]
        A = self.softmax(Z)
        self.cache[f"Z{i}"] = Z
        self.cache[f"A{i}"] = A

        return A

    def backward(self, y_onehot):
        """Backpropagation"""
        m = y_onehot.shape[0]
        grads = {}
        L = len(self.layers) - 1

        # Output layer gradients (Cross-Entropy + Softmax)
        dZ = self.cache[f"A{L}"] - y_onehot
        grads[f"dW{L}"] = (self.cache[f"A{L-1}"].T @ dZ) / m
        grads[f"db{L}"] = np.mean(dZ, axis=0, keepdims=True)

        # Hidden layer gradients
        for i in range(L - 1, 0, -1):
            dA = dZ @ self.params[f"W{i+1}"].T
            dZ = dA * self.relu_grad(self.cache[f"Z{i}"])
            grads[f"dW{i}"] = (self.cache[f"A{i-1}"].T @ dZ) / m
            grads[f"db{i}"] = np.mean(dZ, axis=0, keepdims=True)

        # Parameter update
        for i in range(1, L + 1):
            self.params[f"W{i}"] -= self.lr * grads[f"dW{i}"]
            self.params[f"b{i}"] -= self.lr * grads[f"db{i}"]

        return grads

    def train(self, X, y, epochs=100, verbose=True):
        """Training loop"""
        # One-hot encoding
        n_classes = len(np.unique(y))
        y_onehot = np.eye(n_classes)[y]

        history = []
        for epoch in range(epochs):
            probs = self.forward(X)
            loss = -np.mean(np.sum(y_onehot * np.log(probs + 1e-8), axis=1))
            self.backward(y_onehot)
            history.append(loss)

            if verbose and (epoch + 1) % 20 == 0:
                acc = np.mean(np.argmax(probs, axis=1) == y)
                print(f"Epoch {epoch+1:4d}  Loss={loss:.4f}  Acc={acc:.4f}")

        return history

# Usage example
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

iris = load_iris()
X, y = iris.data, iris.target
X = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

nn = NeuralNetwork([4, 32, 16, 3], learning_rate=0.1)
history = nn.train(X_train, y_train, epochs=200)

# Test accuracy
probs = nn.forward(X_test)
y_pred = np.argmax(probs, axis=1)
print(f"\nTest accuracy: {np.mean(y_pred == y_test):.4f}")
```

### Code Example 1b: Extended NN with Mini-Batch Support

```python
import numpy as np

class MiniBatchNN:
    """NN with mini-batch SGD, Dropout, and BatchNorm support"""

    def __init__(self, layer_sizes, learning_rate=0.001,
                 dropout_rate=0.0, use_batchnorm=False):
        self.layers = layer_sizes
        self.lr = learning_rate
        self.dropout_rate = dropout_rate
        self.use_batchnorm = use_batchnorm
        self.params = {}
        self.bn_params = {}
        self.cache = {}
        self.training = True

        # He initialization
        for i in range(1, len(layer_sizes)):
            fan_in = layer_sizes[i-1]
            fan_out = layer_sizes[i]
            self.params[f"W{i}"] = np.random.randn(fan_in, fan_out) * np.sqrt(2.0 / fan_in)
            self.params[f"b{i}"] = np.zeros((1, fan_out))

            # BatchNorm parameters
            if use_batchnorm and i < len(layer_sizes) - 1:
                self.bn_params[f"gamma{i}"] = np.ones((1, fan_out))
                self.bn_params[f"beta{i}"] = np.zeros((1, fan_out))
                self.bn_params[f"running_mean{i}"] = np.zeros((1, fan_out))
                self.bn_params[f"running_var{i}"] = np.ones((1, fan_out))

    def batch_norm_forward(self, Z, layer_idx):
        """BatchNormalization forward pass"""
        if self.training:
            mean = np.mean(Z, axis=0, keepdims=True)
            var = np.var(Z, axis=0, keepdims=True)
            Z_norm = (Z - mean) / np.sqrt(var + 1e-8)

            # Update running averages
            momentum = 0.9
            key_mean = f"running_mean{layer_idx}"
            key_var = f"running_var{layer_idx}"
            self.bn_params[key_mean] = momentum * self.bn_params[key_mean] + (1 - momentum) * mean
            self.bn_params[key_var] = momentum * self.bn_params[key_var] + (1 - momentum) * var

            self.cache[f"bn_mean{layer_idx}"] = mean
            self.cache[f"bn_var{layer_idx}"] = var
            self.cache[f"bn_norm{layer_idx}"] = Z_norm
        else:
            mean = self.bn_params[f"running_mean{layer_idx}"]
            var = self.bn_params[f"running_var{layer_idx}"]
            Z_norm = (Z - mean) / np.sqrt(var + 1e-8)

        gamma = self.bn_params[f"gamma{layer_idx}"]
        beta = self.bn_params[f"beta{layer_idx}"]
        return gamma * Z_norm + beta

    def dropout_forward(self, A, layer_idx):
        """Dropout forward pass (inverted scaling method)"""
        if self.training and self.dropout_rate > 0:
            mask = (np.random.rand(*A.shape) > self.dropout_rate).astype(float)
            self.cache[f"dropout_mask{layer_idx}"] = mask
            return A * mask / (1 - self.dropout_rate)  # inverted dropout
        return A

    def forward(self, X):
        """Forward pass"""
        self.cache["A0"] = X
        A = X

        for i in range(1, len(self.layers) - 1):
            Z = A @ self.params[f"W{i}"] + self.params[f"b{i}"]

            if self.use_batchnorm:
                Z = self.batch_norm_forward(Z, i)

            A = np.maximum(0, Z)  # ReLU
            A = self.dropout_forward(A, i)

            self.cache[f"Z{i}"] = Z
            self.cache[f"A{i}"] = A

        # Output layer
        L = len(self.layers) - 1
        Z = A @ self.params[f"W{L}"] + self.params[f"b{L}"]
        exp_z = np.exp(Z - np.max(Z, axis=1, keepdims=True))
        A = exp_z / exp_z.sum(axis=1, keepdims=True)
        self.cache[f"Z{L}"] = Z
        self.cache[f"A{L}"] = A

        return A

    def compute_loss(self, y_onehot, l2_lambda=0.0):
        """Cross-entropy loss + L2 regularization"""
        L = len(self.layers) - 1
        probs = self.cache[f"A{L}"]
        m = y_onehot.shape[0]

        ce_loss = -np.mean(np.sum(y_onehot * np.log(probs + 1e-8), axis=1))

        if l2_lambda > 0:
            l2_reg = sum(np.sum(self.params[f"W{i}"] ** 2)
                         for i in range(1, L + 1))
            ce_loss += l2_lambda / (2 * m) * l2_reg

        return ce_loss

    def train(self, X, y, epochs=100, batch_size=32,
              l2_lambda=0.0, verbose=True):
        """Mini-batch training"""
        n_classes = len(np.unique(y))
        y_onehot = np.eye(n_classes)[y]
        m = X.shape[0]
        history = {"loss": [], "acc": []}

        for epoch in range(epochs):
            # Shuffle
            indices = np.random.permutation(m)
            X_shuffled = X[indices]
            y_shuffled = y_onehot[indices]

            epoch_loss = 0.0
            n_batches = 0

            for start in range(0, m, batch_size):
                end = min(start + batch_size, m)
                X_batch = X_shuffled[start:end]
                y_batch = y_shuffled[start:end]

                self.training = True
                self.forward(X_batch)
                loss = self.compute_loss(y_batch, l2_lambda)
                self._backward(y_batch, l2_lambda)

                epoch_loss += loss
                n_batches += 1

            avg_loss = epoch_loss / n_batches
            history["loss"].append(avg_loss)

            if verbose and (epoch + 1) % 20 == 0:
                self.training = False
                probs = self.forward(X)
                acc = np.mean(np.argmax(probs, axis=1) == y)
                history["acc"].append(acc)
                print(f"Epoch {epoch+1:4d}  Loss={avg_loss:.4f}  Acc={acc:.4f}")

        return history

    def _backward(self, y_onehot, l2_lambda=0.0):
        """Mini-batch backpropagation"""
        m = y_onehot.shape[0]
        L = len(self.layers) - 1

        dZ = self.cache[f"A{L}"] - y_onehot

        for i in range(L, 0, -1):
            dW = (self.cache[f"A{i-1}"].T @ dZ) / m
            db = np.mean(dZ, axis=0, keepdims=True)

            if l2_lambda > 0:
                dW += (l2_lambda / m) * self.params[f"W{i}"]

            if i > 1:
                dA = dZ @ self.params[f"W{i}"].T

                # Dropout backpropagation
                if self.dropout_rate > 0 and f"dropout_mask{i-1}" in self.cache:
                    dA *= self.cache[f"dropout_mask{i-1}"] / (1 - self.dropout_rate)

                dZ = dA * (self.cache[f"Z{i-1}"] > 0).astype(float)

            self.params[f"W{i}"] -= self.lr * dW
            self.params[f"b{i}"] -= self.lr * db


# Usage example: Handwritten digit classification with MNIST
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

digits = load_digits()
X, y = digits.data, digits.target
X = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = MiniBatchNN(
    layer_sizes=[64, 128, 64, 10],
    learning_rate=0.005,
    dropout_rate=0.2,
    use_batchnorm=True
)
history = model.train(X_train, y_train, epochs=100, batch_size=32)

model.training = False
probs = model.forward(X_test)
y_pred = np.argmax(probs, axis=1)
print(f"Test accuracy: {np.mean(y_pred == y_test):.4f}")
```

---

## 3. Activation Functions

### 3.1 Activation Function Comparison (Illustrated)

```
ReLU                    Sigmoid                  Tanh
f(x) = max(0, x)       f(x) = 1/(1+e^(-x))    f(x) = (e^x-e^(-x))/(e^x+e^(-x))

  │      /              │    ____               │     ____
  │     /            1.0│___/                 1.0│___/
  │    /               │  /                     │ /
  │   /             0.5│ /                   0.0│/
  │  /                 │/                       │
  │ /               0.0│                    -1.0│
──┤/─────           ───┤─────               ────┤─────
  │                    │                        │

LeakyReLU               GELU                    Swish
f(x) = max(αx, x)      f(x) = x·Φ(x)         f(x) = x·σ(x)

  │      /              │      __/              │      __/
  │     /               │    _/                 │    _/
  │    /                │  _/                   │  _/
  │   /                 │_/                     │_/
  │  /                  │                       │
  │/                    │                       │
─/┤─────            ────┤─────              ────┤─────
 /│                     │                       │
```

### 3.2 Mathematical Details of Activation Functions

```
■ ReLU (Rectified Linear Unit)
  f(x) = max(0, x)
  f'(x) = 1  (x > 0),  0  (x ≤ 0)
  - Fast computation (comparison operation only)
  - Resistant to vanishing gradients (gradient = 1 in the positive region)
  - Dead Neuron problem: permanently outputs 0 if negative inputs persist
  - Asymmetric output (non-negative only)

■ Leaky ReLU
  f(x) = x  (x > 0),  αx  (x ≤ 0)   (typically α = 0.01)
  f'(x) = 1  (x > 0),  α  (x ≤ 0)
  - Mitigates the Dead Neuron problem
  - α can be learned as a parameter (PReLU)

■ ELU (Exponential Linear Unit)
  f(x) = x  (x > 0),  α(e^x - 1)  (x ≤ 0)
  - Allows negative outputs → mean output closer to 0
  - Computational cost of exponential function

■ GELU (Gaussian Error Linear Unit)
  f(x) = x · Φ(x)  (Φ: CDF of the standard normal distribution)
  Approximation: f(x) ≈ 0.5x(1 + tanh(√(2/π)(x + 0.044715x³)))
  - Standard in BERT, GPT, and Vision Transformers
  - Has a probabilistic interpretation

■ Swish / SiLU
  f(x) = x · σ(βx)  (σ: sigmoid, β: learnable parameter)
  - When β=1, this is SiLU (Sigmoid Linear Unit)
  - Discovered via Google's AutoML search
  - Non-monotonic function (has negative output for x<0)

■ Mish
  f(x) = x · tanh(softplus(x)) = x · tanh(ln(1 + e^x))
  - Adopted in YOLOv4
  - Similar characteristics to Swish but smoother
```

### Code Example 2: Activation Function Implementation and Comparison

```python
import numpy as np
import matplotlib.pyplot as plt

class Activations:
    """Major activation functions and their derivatives"""

    @staticmethod
    def relu(x):
        return np.maximum(0, x)

    @staticmethod
    def relu_grad(x):
        return (x > 0).astype(float)

    @staticmethod
    def leaky_relu(x, alpha=0.01):
        return np.where(x > 0, x, alpha * x)

    @staticmethod
    def leaky_relu_grad(x, alpha=0.01):
        return np.where(x > 0, 1.0, alpha)

    @staticmethod
    def elu(x, alpha=1.0):
        return np.where(x > 0, x, alpha * (np.exp(x) - 1))

    @staticmethod
    def elu_grad(x, alpha=1.0):
        return np.where(x > 0, 1.0, alpha * np.exp(x))

    @staticmethod
    def sigmoid(x):
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

    @staticmethod
    def sigmoid_grad(x):
        s = Activations.sigmoid(x)
        return s * (1 - s)

    @staticmethod
    def tanh(x):
        return np.tanh(x)

    @staticmethod
    def tanh_grad(x):
        return 1 - np.tanh(x) ** 2

    @staticmethod
    def gelu(x):
        return 0.5 * x * (1 + np.tanh(np.sqrt(2/np.pi) * (x + 0.044715 * x**3)))

    @staticmethod
    def swish(x, beta=1.0):
        return x * Activations.sigmoid(beta * x)

    @staticmethod
    def mish(x):
        return x * np.tanh(np.log(1 + np.exp(x)))

# Visualization: Activation functions and their derivatives
x = np.linspace(-4, 4, 1000)
functions = {
    "ReLU": (Activations.relu, Activations.relu_grad),
    "LeakyReLU": (Activations.leaky_relu, Activations.leaky_relu_grad),
    "ELU": (Activations.elu, Activations.elu_grad),
    "Sigmoid": (Activations.sigmoid, Activations.sigmoid_grad),
    "Tanh": (Activations.tanh, Activations.tanh_grad),
    "GELU": (Activations.gelu, None),
    "Swish": (Activations.swish, None),
    "Mish": (Activations.mish, None),
}

fig, axes = plt.subplots(2, 4, figsize=(20, 8))
for ax, (name, (func, grad_func)) in zip(axes.flatten(), functions.items()):
    ax.plot(x, func(x), linewidth=2, label=f"{name}")
    if grad_func is not None:
        ax.plot(x, grad_func(x), linewidth=1.5, linestyle="--",
                alpha=0.7, label=f"{name}' (derivative)")
    ax.axhline(y=0, color="k", linewidth=0.5)
    ax.axvline(x=0, color="k", linewidth=0.5)
    ax.set_title(name, fontsize=14)
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(-4, 4)

plt.tight_layout()
plt.savefig("reports/activation_functions.png", dpi=150)
plt.close()
```

### 3.3 Activation Function Selection Guidelines

```
Recommendations by task:

Hidden layers:
  ├── General MLP / CNN → ReLU (default)
  ├── Dead Neuron is a problem → LeakyReLU / ELU
  ├── Transformer → GELU
  ├── Deep ResNet → ReLU + Skip Connection
  └── Object detection (YOLO) → Mish / Swish

Output layer:
  ├── Binary classification → Sigmoid (1 output node)
  ├── Multi-class classification → Softmax (N output nodes)
  ├── Regression → Linear (no activation)
  ├── Regression (positive values only) → ReLU / Softplus
  └── Regression (interval [a,b]) → Sigmoid × (b-a) + a

Practical decision criteria:
  1. Start with ReLU (highest computational efficiency)
  2. If training stalls, switch to LeakyReLU/ELU
  3. For Transformer-based models, default to GELU
  4. Ultimately compare via benchmarks
```

---

## 4. Loss Functions in Detail

### 4.1 Loss Functions for Classification Tasks

```python
import numpy as np

class LossFunctions:
    """Implementation of major loss functions"""

    @staticmethod
    def binary_cross_entropy(y_true, y_pred, eps=1e-8):
        """Binary cross-entropy for binary classification"""
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(
            y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred)
        )

    @staticmethod
    def categorical_cross_entropy(y_true_onehot, y_pred, eps=1e-8):
        """Categorical cross-entropy for multi-class classification"""
        y_pred = np.clip(y_pred, eps, 1.0)
        return -np.mean(np.sum(y_true_onehot * np.log(y_pred), axis=1))

    @staticmethod
    def focal_loss(y_true_onehot, y_pred, gamma=2.0, alpha=0.25, eps=1e-8):
        """Focal Loss — countermeasure for class imbalance"""
        y_pred = np.clip(y_pred, eps, 1.0)
        # Probability of the correct class
        pt = np.sum(y_true_onehot * y_pred, axis=1)
        # Weighting based on difficulty
        focal_weight = alpha * (1 - pt) ** gamma
        loss = -focal_weight * np.log(pt)
        return np.mean(loss)

    @staticmethod
    def label_smoothing_ce(y_true, y_pred, num_classes, smoothing=0.1, eps=1e-8):
        """Label smoothing cross-entropy"""
        y_pred = np.clip(y_pred, eps, 1.0)
        # Smooth labels: (1-ε)δ(k,y) + ε/K
        smooth_labels = np.full_like(y_pred, smoothing / num_classes)
        smooth_labels[np.arange(len(y_true)), y_true] = 1 - smoothing + smoothing / num_classes
        return -np.mean(np.sum(smooth_labels * np.log(y_pred), axis=1))

    @staticmethod
    def mse_loss(y_true, y_pred):
        """Mean Squared Error (for regression)"""
        return np.mean((y_true - y_pred) ** 2)

    @staticmethod
    def mae_loss(y_true, y_pred):
        """Mean Absolute Error (robust to outliers)"""
        return np.mean(np.abs(y_true - y_pred))

    @staticmethod
    def huber_loss(y_true, y_pred, delta=1.0):
        """Huber Loss (hybrid of MSE and MAE)"""
        diff = y_true - y_pred
        return np.mean(np.where(
            np.abs(diff) <= delta,
            0.5 * diff ** 2,
            delta * (np.abs(diff) - 0.5 * delta)
        ))


# Loss function behavior comparison
y_true = np.array([1.0])
y_preds = np.linspace(0.01, 0.99, 100)

bce_losses = [LossFunctions.binary_cross_entropy(y_true, np.array([p])) for p in y_preds]

import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.plot(y_preds, bce_losses, label="Binary CE", linewidth=2)
plt.xlabel("Predicted probability p(y=1)")
plt.ylabel("Loss")
plt.title("Binary Cross-Entropy Loss (true label = 1)")
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("reports/bce_loss_curve.png", dpi=150)
plt.close()
```

### 4.2 Loss Function Selection Guide

```
Task                      Loss Function           Notes
──────────────────────────────────────────────────────────────
Binary classification     Binary CE               Standard
Multi-class classification Categorical CE         Standard
Imbalanced classification Focal Loss              γ=2.0 is common
Overfitting suppression   Label Smoothing CE      ε=0.1 is common
Regression                MSE                     Sensitive to outliers
Regression (with outliers) MAE / Huber            More robust
Ordinal regression        Ordinal CE              Preserves ordinal relationships
Object detection (localization) Smooth L1 (Huber) Fast R-CNN family
Segmentation              Dice Loss + CE          IoU optimization
Generative models         Adversarial Loss        GAN family
```

---

## 5. Backpropagation and Optimization

### 5.1 Backpropagation Computation Graph

```
Forward pass:
  x → [Linear] → z → [ReLU] → a → [Linear] → z → [Softmax+CE] → Loss
       W₁,b₁              W₂,b₂

Backward pass:
  ∂L/∂x ← ∂L/∂z ← ∂L/∂a ← ∂L/∂z ← ∂L/∂ŷ ← ∂L/∂Loss = 1
            │                  │
            v                  v
         ∂L/∂W₁             ∂L/∂W₂
         ∂L/∂b₁             ∂L/∂b₂

Chain Rule:
  ∂L/∂W₁ = ∂L/∂z₂ × ∂z₂/∂a₁ × ∂a₁/∂z₁ × ∂z₁/∂W₁
```

### 5.2 Gradient Computation at Each Layer in Backpropagation

```
■ Fully connected layer backpropagation
  Forward: Z = XW + b, A = σ(Z)
  Backward:
    ∂L/∂W = Aᵀ_prev · ∂L/∂Z  (weight gradient)
    ∂L/∂b = mean(∂L/∂Z)       (bias gradient)
    ∂L/∂A_prev = ∂L/∂Z · Wᵀ  (gradient propagation to previous layer)

■ ReLU layer backpropagation
  Forward: A = max(0, Z)
  Backward: ∂L/∂Z = ∂L/∂A · 1(Z > 0)

■ Softmax + Cross-Entropy (combined)
  Forward: ŷ = softmax(Z), L = -Σ yₖ log(ŷₖ)
  Backward: ∂L/∂Z = ŷ - y  (remarkably simple!)

■ BatchNorm layer backpropagation
  Forward: Z_norm = (Z - μ) / √(σ² + ε), Y = γZ_norm + β
  Backward:
    ∂L/∂γ = Σ ∂L/∂Y · Z_norm
    ∂L/∂β = Σ ∂L/∂Y
    ∂L/∂Z_norm = ∂L/∂Y · γ
    ∂L/∂Z = complex expression (gradients through μ and σ² must also be computed)
```

### Code Example 3: Optimizer Implementation Comparison

```python
import numpy as np

class Optimizers:
    """Implementation of major optimization algorithms"""

    class SGD:
        def __init__(self, lr=0.01, momentum=0.0):
            self.lr = lr
            self.momentum = momentum
            self.velocity = {}

        def update(self, params, grads):
            for key in params:
                if key not in self.velocity:
                    self.velocity[key] = np.zeros_like(params[key])
                self.velocity[key] = self.momentum * self.velocity[key] - self.lr * grads[key]
                params[key] += self.velocity[key]

    class NesterovSGD:
        """Nesterov Accelerated Gradient"""
        def __init__(self, lr=0.01, momentum=0.9):
            self.lr = lr
            self.momentum = momentum
            self.velocity = {}

        def update(self, params, grads):
            for key in params:
                if key not in self.velocity:
                    self.velocity[key] = np.zeros_like(params[key])
                v_prev = self.velocity[key].copy()
                self.velocity[key] = self.momentum * self.velocity[key] - self.lr * grads[key]
                # Nesterov: use gradient at the look-ahead position
                params[key] += -self.momentum * v_prev + (1 + self.momentum) * self.velocity[key]

    class RMSProp:
        """RMSProp — Adaptive learning rate"""
        def __init__(self, lr=0.001, decay=0.99, eps=1e-8):
            self.lr = lr
            self.decay = decay
            self.eps = eps
            self.cache = {}

        def update(self, params, grads):
            for key in params:
                if key not in self.cache:
                    self.cache[key] = np.zeros_like(params[key])
                self.cache[key] = self.decay * self.cache[key] + (1 - self.decay) * grads[key] ** 2
                params[key] -= self.lr * grads[key] / (np.sqrt(self.cache[key]) + self.eps)

    class Adam:
        def __init__(self, lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8):
            self.lr = lr
            self.beta1 = beta1
            self.beta2 = beta2
            self.eps = eps
            self.m = {}  # 1st moment
            self.v = {}  # 2nd moment
            self.t = 0

        def update(self, params, grads):
            self.t += 1
            for key in params:
                if key not in self.m:
                    self.m[key] = np.zeros_like(params[key])
                    self.v[key] = np.zeros_like(params[key])

                self.m[key] = self.beta1 * self.m[key] + (1 - self.beta1) * grads[key]
                self.v[key] = self.beta2 * self.v[key] + (1 - self.beta2) * grads[key]**2

                # Bias correction
                m_hat = self.m[key] / (1 - self.beta1**self.t)
                v_hat = self.v[key] / (1 - self.beta2**self.t)

                params[key] -= self.lr * m_hat / (np.sqrt(v_hat) + self.eps)

    class AdamW:
        """Adam + Weight Decay (improved version of L2 regularization)"""
        def __init__(self, lr=0.001, beta1=0.9, beta2=0.999,
                     eps=1e-8, weight_decay=0.01):
            self.lr = lr
            self.beta1 = beta1
            self.beta2 = beta2
            self.eps = eps
            self.wd = weight_decay
            self.m = {}
            self.v = {}
            self.t = 0

        def update(self, params, grads):
            self.t += 1
            for key in params:
                if key not in self.m:
                    self.m[key] = np.zeros_like(params[key])
                    self.v[key] = np.zeros_like(params[key])

                self.m[key] = self.beta1 * self.m[key] + (1 - self.beta1) * grads[key]
                self.v[key] = self.beta2 * self.v[key] + (1 - self.beta2) * grads[key]**2

                m_hat = self.m[key] / (1 - self.beta1**self.t)
                v_hat = self.v[key] / (1 - self.beta2**self.t)

                # Weight Decay is applied separately from gradient update
                params[key] -= self.lr * (m_hat / (np.sqrt(v_hat) + self.eps)
                                          + self.wd * params[key])

    class LAMB:
        """LAMB — For large-batch training (used in BERT pre-training)"""
        def __init__(self, lr=0.001, beta1=0.9, beta2=0.999,
                     eps=1e-6, weight_decay=0.01):
            self.lr = lr
            self.beta1 = beta1
            self.beta2 = beta2
            self.eps = eps
            self.wd = weight_decay
            self.m = {}
            self.v = {}
            self.t = 0

        def update(self, params, grads):
            self.t += 1
            for key in params:
                if key not in self.m:
                    self.m[key] = np.zeros_like(params[key])
                    self.v[key] = np.zeros_like(params[key])

                self.m[key] = self.beta1 * self.m[key] + (1 - self.beta1) * grads[key]
                self.v[key] = self.beta2 * self.v[key] + (1 - self.beta2) * grads[key]**2

                m_hat = self.m[key] / (1 - self.beta1**self.t)
                v_hat = self.v[key] / (1 - self.beta2**self.t)

                # Adam update amount
                update = m_hat / (np.sqrt(v_hat) + self.eps) + self.wd * params[key]

                # Layer-wise adaptive learning rate
                w_norm = np.linalg.norm(params[key])
                u_norm = np.linalg.norm(update)
                trust_ratio = w_norm / (u_norm + self.eps) if w_norm > 0 and u_norm > 0 else 1.0

                params[key] -= self.lr * trust_ratio * update
```

### Code Example 4: Learning Rate Schedulers

```python
import numpy as np
import matplotlib.pyplot as plt

class LRSchedulers:
    """Learning rate scheduling strategies"""

    @staticmethod
    def step_decay(initial_lr, epoch, drop_rate=0.5, drop_every=30):
        return initial_lr * (drop_rate ** (epoch // drop_every))

    @staticmethod
    def exponential_decay(initial_lr, epoch, decay_rate=0.95):
        return initial_lr * (decay_rate ** epoch)

    @staticmethod
    def cosine_annealing(initial_lr, epoch, total_epochs, min_lr=1e-6):
        return min_lr + (initial_lr - min_lr) * 0.5 * \
               (1 + np.cos(np.pi * epoch / total_epochs))

    @staticmethod
    def warmup_cosine(initial_lr, epoch, total_epochs,
                      warmup_epochs=10, min_lr=1e-6):
        if epoch < warmup_epochs:
            return initial_lr * (epoch + 1) / warmup_epochs
        progress = (epoch - warmup_epochs) / (total_epochs - warmup_epochs)
        return min_lr + (initial_lr - min_lr) * 0.5 * (1 + np.cos(np.pi * progress))

    @staticmethod
    def cosine_annealing_warm_restarts(initial_lr, epoch, T_0=10,
                                        T_mult=2, min_lr=1e-6):
        """Cosine Annealing with Warm Restarts (SGDR)"""
        T_cur = T_0
        epoch_in_cycle = epoch
        while epoch_in_cycle >= T_cur:
            epoch_in_cycle -= T_cur
            T_cur *= T_mult
        return min_lr + (initial_lr - min_lr) * 0.5 * \
               (1 + np.cos(np.pi * epoch_in_cycle / T_cur))

    @staticmethod
    def one_cycle(initial_lr, epoch, total_epochs,
                  max_lr=None, div_factor=25.0, final_div_factor=1e4):
        """1Cycle Policy (Super-Convergence)"""
        if max_lr is None:
            max_lr = initial_lr
        min_lr = max_lr / div_factor
        final_lr = max_lr / final_div_factor
        mid = total_epochs * 0.45

        if epoch < mid:
            # Warmup: min_lr → max_lr
            return min_lr + (max_lr - min_lr) * epoch / mid
        elif epoch < total_epochs * 0.9:
            # Cooldown: max_lr → min_lr
            progress = (epoch - mid) / (total_epochs * 0.9 - mid)
            return max_lr - (max_lr - min_lr) * progress
        else:
            # Final descent: min_lr → final_lr
            progress = (epoch - total_epochs * 0.9) / (total_epochs * 0.1)
            return min_lr - (min_lr - final_lr) * progress

# Visualization
epochs = range(200)
initial_lr = 0.01

fig, axes = plt.subplots(2, 3, figsize=(18, 10))
schedulers = [
    ("Step Decay", lambda e: LRSchedulers.step_decay(initial_lr, e)),
    ("Exp Decay", lambda e: LRSchedulers.exponential_decay(initial_lr, e)),
    ("Cosine", lambda e: LRSchedulers.cosine_annealing(initial_lr, e, 200)),
    ("Warmup+Cosine", lambda e: LRSchedulers.warmup_cosine(initial_lr, e, 200)),
    ("Warm Restarts", lambda e: LRSchedulers.cosine_annealing_warm_restarts(initial_lr, e)),
    ("1Cycle", lambda e: LRSchedulers.one_cycle(0.001, e, 200, max_lr=0.01)),
]

for ax, (name, func) in zip(axes.flatten(), schedulers):
    lrs = [func(e) for e in epochs]
    ax.plot(epochs, lrs, linewidth=2)
    ax.set_title(name, fontsize=14)
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Learning Rate")
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("reports/lr_schedules.png", dpi=150)
plt.close()
```

---

## 6. Regularization Techniques

### 6.1 Taxonomy of Regularization Techniques

```
Classification of regularization techniques:

■ Data level
  ├── Data Augmentation
  ├── Noise injection (input, weights, gradients)
  └── Label Smoothing

■ Model level
  ├── L1 regularization (Lasso): |w| → sparsification
  ├── L2 regularization (Ridge): w² → smaller weights
  ├── ElasticNet: L1 + L2
  └── Weight Decay (AdamW)

■ Structural level
  ├── Dropout: randomly deactivate units
  ├── DropConnect: randomly deactivate weights
  ├── Batch Normalization: reduce internal covariate shift
  ├── Layer Normalization: batch-independent normalization
  └── Stochastic Depth: randomly skip layers

■ Training level
  ├── Early Stopping: monitor validation loss
  ├── Learning rate scheduling
  ├── Gradient Clipping: prevent gradient explosion
  └── Mixup / CutMix: input mixing
```

### Code Example 6: Regularization Technique Implementations

```python
import numpy as np

class RegularizationDemo:
    """Demo implementation of regularization techniques"""

    @staticmethod
    def l1_penalty(params, lambda_l1=0.001):
        """L1 regularization (Lasso)"""
        penalty = 0.0
        grad_penalty = {}
        for key, w in params.items():
            if key.startswith("W"):  # Do not apply to biases
                penalty += lambda_l1 * np.sum(np.abs(w))
                grad_penalty[key] = lambda_l1 * np.sign(w)
        return penalty, grad_penalty

    @staticmethod
    def l2_penalty(params, lambda_l2=0.001):
        """L2 regularization (Ridge)"""
        penalty = 0.0
        grad_penalty = {}
        for key, w in params.items():
            if key.startswith("W"):
                penalty += 0.5 * lambda_l2 * np.sum(w ** 2)
                grad_penalty[key] = lambda_l2 * w
        return penalty, grad_penalty

    @staticmethod
    def elastic_net(params, lambda_l1=0.001, lambda_l2=0.001, l1_ratio=0.5):
        """ElasticNet regularization"""
        penalty = 0.0
        grad_penalty = {}
        for key, w in params.items():
            if key.startswith("W"):
                l1 = l1_ratio * lambda_l1 * np.sum(np.abs(w))
                l2 = 0.5 * (1 - l1_ratio) * lambda_l2 * np.sum(w ** 2)
                penalty += l1 + l2
                grad_penalty[key] = (
                    l1_ratio * lambda_l1 * np.sign(w) +
                    (1 - l1_ratio) * lambda_l2 * w
                )
        return penalty, grad_penalty

    @staticmethod
    def dropout(A, rate=0.5, training=True):
        """Inverted Dropout"""
        if not training or rate == 0:
            return A, None
        mask = (np.random.rand(*A.shape) > rate).astype(float)
        return A * mask / (1 - rate), mask

    @staticmethod
    def gradient_clipping(grads, max_norm=1.0):
        """Gradient clipping (norm-based)"""
        total_norm = np.sqrt(sum(np.sum(g ** 2) for g in grads.values()))
        clip_coeff = max_norm / (total_norm + 1e-8)
        if clip_coeff < 1.0:
            for key in grads:
                grads[key] *= clip_coeff
        return grads, total_norm

    @staticmethod
    def mixup(X, y_onehot, alpha=0.2):
        """Mixup data augmentation"""
        lam = np.random.beta(alpha, alpha)
        batch_size = X.shape[0]
        indices = np.random.permutation(batch_size)

        X_mixed = lam * X + (1 - lam) * X[indices]
        y_mixed = lam * y_onehot + (1 - lam) * y_onehot[indices]

        return X_mixed, y_mixed


# Early Stopping implementation
class EarlyStopping:
    """Early Stopping with Model Checkpoint"""

    def __init__(self, patience=10, min_delta=1e-4, restore_best=True):
        self.patience = patience
        self.min_delta = min_delta
        self.restore_best = restore_best
        self.best_loss = np.inf
        self.counter = 0
        self.best_params = None
        self.stopped_epoch = None

    def __call__(self, val_loss, model_params):
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
            if self.restore_best:
                # Save a copy of model parameters
                self.best_params = {k: v.copy() for k, v in model_params.items()}
            return False  # Continue training
        else:
            self.counter += 1
            if self.counter >= self.patience:
                return True  # Stop training
            return False

    def get_best_params(self):
        return self.best_params


# Usage example
early_stop = EarlyStopping(patience=15, min_delta=1e-4)

for epoch in range(1000):
    # ... training process ...
    train_loss = 0.5  # placeholder value
    val_loss = 0.6    # placeholder value

    if early_stop(val_loss, {}):  # pass model.params
        print(f"Early stopping at epoch {epoch}")
        break
```

---

## 7. Theory of Weight Initialization

### 7.1 Comparison of Initialization Methods

```
■ Zero initialization
  W = 0
  Problem: All units produce identical output → symmetry not broken → cannot learn

■ Small random values
  W ~ N(0, 0.01²)
  Problem: Output converges to 0 in deep networks (vanishing gradients)

■ Large random values
  W ~ N(0, 1²)
  Problem: Output saturates (Sigmoid/Tanh → vanishing gradients, ReLU → exploding gradients)

■ Xavier initialization (Glorot, 2010)
  W ~ N(0, 2/(fan_in + fan_out))  or U(-√(6/(fan_in+fan_out)), √(6/(fan_in+fan_out)))
  Target: Sigmoid, Tanh
  Principle: Preserve variance across each layer

■ He initialization (Kaiming, 2015)
  W ~ N(0, 2/fan_in)
  Target: ReLU, LeakyReLU
  Principle: ReLU zeroes out half the units, so double the variance

■ LSUV (Layer-Sequential Unit-Variance)
  Procedure: (1) Initialize with orthogonal matrix (2) Scale each layer so output variance is 1
  Advantage: Works with any activation function

■ fixup initialization
  Target: ResNet (without BatchNorm)
  Initialize residual block weights to 0, scale skip connections
```

### Code Example 7: Initialization Method Implementation and Effect Comparison

```python
import numpy as np
import matplotlib.pyplot as plt

def visualize_initialization_effects():
    """Visualize output distributions from different initialization methods"""

    np.random.seed(42)
    n_layers = 10
    n_units = 256
    batch_size = 1000

    initializations = {
        "Small Random": lambda fan_in, fan_out: np.random.randn(fan_in, fan_out) * 0.01,
        "Large Random": lambda fan_in, fan_out: np.random.randn(fan_in, fan_out) * 1.0,
        "Xavier": lambda fan_in, fan_out: np.random.randn(fan_in, fan_out) * np.sqrt(2.0 / (fan_in + fan_out)),
        "He": lambda fan_in, fan_out: np.random.randn(fan_in, fan_out) * np.sqrt(2.0 / fan_in),
    }

    fig, axes = plt.subplots(len(initializations), n_layers, figsize=(30, 12))

    for row, (name, init_fn) in enumerate(initializations.items()):
        X = np.random.randn(batch_size, n_units)

        for layer in range(n_layers):
            W = init_fn(n_units, n_units)
            X = np.maximum(0, X @ W)  # ReLU

            ax = axes[row, layer]
            ax.hist(X.flatten(), bins=50, density=True, alpha=0.7)
            ax.set_title(f"Layer {layer+1}" if row == 0 else "")
            if layer == 0:
                ax.set_ylabel(name, fontsize=12)
            ax.set_xlim(-1, 5)

            # Display variance and activation ratio
            var = np.var(X)
            active_ratio = np.mean(X > 0)
            ax.text(0.5, 0.9, f"var={var:.2e}\nact={active_ratio:.2f}",
                    transform=ax.transAxes, fontsize=7, verticalalignment='top')

    plt.suptitle("Output Distribution per Layer by Initialization Method (ReLU Activation)", fontsize=16)
    plt.tight_layout()
    plt.savefig("reports/initialization_comparison.png", dpi=150)
    plt.close()

visualize_initialization_effects()
```

---

## 8. Implementation with PyTorch

### Code Example 8: MLP Implementation in PyTorch

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

class MLP(nn.Module):
    """Flexible MLP in PyTorch"""

    def __init__(self, input_dim, hidden_dims, output_dim,
                 dropout_rate=0.0, use_batchnorm=True,
                 activation='relu'):
        super().__init__()

        layers = []
        prev_dim = input_dim

        # Activation function selection
        act_fn = {
            'relu': nn.ReLU,
            'leaky_relu': lambda: nn.LeakyReLU(0.01),
            'gelu': nn.GELU,
            'silu': nn.SiLU,  # Swish
            'elu': nn.ELU,
            'mish': nn.Mish,
        }

        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(prev_dim, hidden_dim))

            if use_batchnorm:
                layers.append(nn.BatchNorm1d(hidden_dim))

            if activation in act_fn:
                layers.append(act_fn[activation]())
            else:
                layers.append(nn.ReLU())

            if dropout_rate > 0:
                layers.append(nn.Dropout(dropout_rate))

            prev_dim = hidden_dim

        layers.append(nn.Linear(prev_dim, output_dim))

        self.network = nn.Sequential(*layers)

        # Weight initialization
        self._initialize_weights()

    def _initialize_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode='fan_in', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.BatchNorm1d):
                nn.init.ones_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(self, x):
        return self.network(x)


def train_model(model, train_loader, val_loader, epochs=100,
                lr=0.001, weight_decay=1e-4, patience=10):
    """Training loop (with Early Stopping)"""

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = nn.CrossEntropyLoss()

    best_val_loss = float('inf')
    best_model_state = None
    patience_counter = 0
    history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}

    for epoch in range(epochs):
        # Training phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)

            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()

            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

            optimizer.step()

            train_loss += loss.item() * X_batch.size(0)
            _, predicted = torch.max(outputs, 1)
            train_total += y_batch.size(0)
            train_correct += (predicted == y_batch).sum().item()

        scheduler.step()

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(device), y_batch.to(device)
                outputs = model(X_batch)
                loss = criterion(outputs, y_batch)

                val_loss += loss.item() * X_batch.size(0)
                _, predicted = torch.max(outputs, 1)
                val_total += y_batch.size(0)
                val_correct += (predicted == y_batch).sum().item()

        train_loss /= train_total
        val_loss /= val_total
        train_acc = train_correct / train_total
        val_acc = val_correct / val_total

        history['train_loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['train_acc'].append(train_acc)
        history['val_acc'].append(val_acc)

        # Early Stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_model_state = model.state_dict().copy()
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch+1}")
                model.load_state_dict(best_model_state)
                break

        if (epoch + 1) % 10 == 0:
            current_lr = scheduler.get_last_lr()[0]
            print(f"Epoch {epoch+1:4d}  "
                  f"Train Loss={train_loss:.4f}  Val Loss={val_loss:.4f}  "
                  f"Train Acc={train_acc:.4f}  Val Acc={val_acc:.4f}  "
                  f"LR={current_lr:.6f}")

    return history


# Usage example
digits = load_digits()
X, y = digits.data, digits.target

scaler = StandardScaler()
X = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
X_train, X_val, y_train, y_val = train_test_split(
    X_train, y_train, test_size=0.15, random_state=42, stratify=y_train
)

# Create TensorDataset
train_ds = TensorDataset(
    torch.FloatTensor(X_train), torch.LongTensor(y_train)
)
val_ds = TensorDataset(
    torch.FloatTensor(X_val), torch.LongTensor(y_val)
)
test_ds = TensorDataset(
    torch.FloatTensor(X_test), torch.LongTensor(y_test)
)

train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=64, shuffle=False)
test_loader = DataLoader(test_ds, batch_size=64, shuffle=False)

# Create model and train
model = MLP(
    input_dim=64,
    hidden_dims=[256, 128, 64],
    output_dim=10,
    dropout_rate=0.3,
    use_batchnorm=True,
    activation='gelu'
)

print(model)
print(f"Number of parameters: {sum(p.numel() for p in model.parameters()):,}")

history = train_model(model, train_loader, val_loader,
                      epochs=200, lr=0.001, patience=20)
```

### Code Example 8b: Training Curve Visualization and Model Evaluation

```python
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns

def plot_training_history(history):
    """Visualize training curves"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ax1.plot(history['train_loss'], label='Train Loss')
    ax1.plot(history['val_loss'], label='Val Loss')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss')
    ax1.set_title('Loss Over Time')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(history['train_acc'], label='Train Acc')
    ax2.plot(history['val_acc'], label='Val Acc')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Accuracy')
    ax2.set_title('Accuracy Over Time')
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("reports/training_history.png", dpi=150)
    plt.close()


def evaluate_model(model, test_loader, class_names=None):
    """Detailed model evaluation"""
    device = next(model.parameters()).device
    model.eval()

    all_preds = []
    all_labels = []

    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            X_batch = X_batch.to(device)
            outputs = model(X_batch)
            _, predicted = torch.max(outputs, 1)
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(y_batch.numpy())

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)

    print("=== Classification Report ===")
    print(classification_report(all_labels, all_preds,
                                target_names=class_names))

    # Confusion matrix
    cm = confusion_matrix(all_labels, all_preds)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=class_names, yticklabels=class_names)
    plt.xlabel('Predicted')
    plt.ylabel('Actual')
    plt.title('Confusion Matrix')
    plt.tight_layout()
    plt.savefig("reports/confusion_matrix.png", dpi=150)
    plt.close()

    return all_preds, all_labels

# Execute
plot_training_history(history)
class_names = [str(i) for i in range(10)]
preds, labels = evaluate_model(model, test_loader, class_names)
```

### Code Example 5: MLP with scikit-learn

```python
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.datasets import load_digits

digits = load_digits()
X, y = digits.data, digits.target

pipe = make_pipeline(
    StandardScaler(),
    MLPClassifier(max_iter=500, random_state=42, early_stopping=True,
                  validation_fraction=0.1)
)

param_grid = {
    "mlpclassifier__hidden_layer_sizes": [(64,), (128, 64), (256, 128, 64)],
    "mlpclassifier__activation": ["relu", "tanh"],
    "mlpclassifier__alpha": [0.0001, 0.001, 0.01],  # L2 regularization
    "mlpclassifier__learning_rate_init": [0.001, 0.01],
}

grid = GridSearchCV(pipe, param_grid, cv=3, scoring="accuracy", n_jobs=-1, verbose=1)
grid.fit(X, y)

print(f"Best parameters: {grid.best_params_}")
print(f"Best score: {grid.best_score_:.4f}")
```

---

## 9. Gradient Problems and Their Solutions

### 9.1 Vanishing and Exploding Gradients

```
■ Vanishing Gradient
  Causes:
    - Saturation regions of Sigmoid/Tanh (gradient → 0)
    - Multiplication of gradients through deep layers (0.25^n → 0)
    - Improper initialization
  Solutions:
    - ReLU-family activation functions
    - He/Xavier initialization
    - BatchNormalization
    - Residual connections (Skip Connections)
    - LSTM/GRU (for RNNs)

■ Exploding Gradient
  Causes:
    - Large initial weights
    - Multiplication of gradients through deep layers (large_value^n → ∞)
    - RNNs (long sequences)
  Solutions:
    - Gradient Clipping
    - BatchNormalization
    - Proper initialization
    - Learning rate adjustment

■ Dead Neurons (ReLU-specific)
  Causes:
    - Large negative inputs → ReLU output=0 → gradient=0 → cannot update
    - More likely to occur when learning rate is too large
  Solutions:
    - LeakyReLU / ELU
    - Reduce the learning rate
    - He initialization to lower the probability of occurrence
```

### Code Example 9: Gradient Flow Diagnosis

```python
import torch
import torch.nn as nn
import matplotlib.pyplot as plt

def diagnose_gradient_flow(model, loss, plot=True):
    """Gradient flow diagnostic tool"""
    loss.backward()

    ave_grads = []
    max_grads = []
    layers = []

    for name, param in model.named_parameters():
        if param.requires_grad and param.grad is not None:
            layers.append(name)
            ave_grads.append(param.grad.abs().mean().item())
            max_grads.append(param.grad.abs().max().item())

    if plot:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

        ax1.bar(range(len(ave_grads)), ave_grads, alpha=0.7)
        ax1.set_xticks(range(len(layers)))
        ax1.set_xticklabels(layers, rotation=45, ha='right', fontsize=8)
        ax1.set_ylabel("Mean Gradient")
        ax1.set_title("Mean Gradient per Layer")
        ax1.set_yscale("log")
        ax1.grid(True, alpha=0.3)

        ax2.bar(range(len(max_grads)), max_grads, alpha=0.7, color='orange')
        ax2.set_xticks(range(len(layers)))
        ax2.set_xticklabels(layers, rotation=45, ha='right', fontsize=8)
        ax2.set_ylabel("Max Gradient")
        ax2.set_title("Max Gradient per Layer")
        ax2.set_yscale("log")
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig("reports/gradient_flow.png", dpi=150)
        plt.close()

    # Problem detection
    for name, avg, mx in zip(layers, ave_grads, max_grads):
        if avg < 1e-7:
            print(f"WARNING: Possible vanishing gradient: {name} (avg={avg:.2e})")
        if mx > 100:
            print(f"WARNING: Possible exploding gradient: {name} (max={mx:.2e})")

    return dict(zip(layers, ave_grads))
```

---

## 10. Practical Debugging and Tuning

### 10.1 Common Problems and Solutions

```
■ Training not progressing (loss not decreasing)
  Checklist:
  1. Data: Is preprocessing correct? (normalization, label encoding)
  2. Learning rate: too large → divergence, too small → slow convergence
  3. Loss function: Is it appropriate for the task? (not using MSE for classification?)
  4. Output layer: Softmax + CE for classification, Linear + MSE for regression
  5. Bugs: Forgetting to switch between .train()/.eval()
  6. Data leakage: Is test data information leaking into training?

■ Overfitting (Train↑ Val↓)
  Solutions in priority order:
  1. Increase data (most effective)
  2. Data augmentation
  3. Add Dropout (0.2-0.5)
  4. Increase Weight Decay
  5. Reduce model size (fewer layers, fewer units)
  6. Apply Early Stopping
  7. Label Smoothing

■ Underfitting (both Train↑ and Val↑ are low)
  Solutions:
  1. Increase model size (insufficient representational capacity)
  2. Adjust learning rate
  3. Increase number of epochs
  4. Feature engineering
  5. Reduce regularization (excessive regularization can cause underfitting)
```

### 10.2 Hyperparameter Tuning (Optuna)

```python
import optuna
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

def objective(trial):
    """Optuna objective function"""

    # Hyperparameter suggestions
    n_layers = trial.suggest_int("n_layers", 1, 4)
    hidden_dims = []
    for i in range(n_layers):
        hidden_dims.append(trial.suggest_int(f"n_units_l{i}", 32, 512, log=True))

    dropout_rate = trial.suggest_float("dropout", 0.0, 0.5)
    lr = trial.suggest_float("lr", 1e-5, 1e-2, log=True)
    weight_decay = trial.suggest_float("weight_decay", 1e-6, 1e-2, log=True)
    batch_size = trial.suggest_categorical("batch_size", [16, 32, 64, 128])
    activation = trial.suggest_categorical("activation",
                                            ["relu", "gelu", "silu", "elu"])

    # Data preparation
    digits = load_digits()
    X, y = digits.data, digits.target
    X = StandardScaler().fit_transform(X)
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    train_loader = DataLoader(
        TensorDataset(torch.FloatTensor(X_train), torch.LongTensor(y_train)),
        batch_size=batch_size, shuffle=True
    )
    val_loader = DataLoader(
        TensorDataset(torch.FloatTensor(X_val), torch.LongTensor(y_val)),
        batch_size=64, shuffle=False
    )

    # Model construction
    model = MLP(
        input_dim=64,
        hidden_dims=hidden_dims,
        output_dim=10,
        dropout_rate=dropout_rate,
        use_batchnorm=True,
        activation=activation,
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    criterion = nn.CrossEntropyLoss()

    # Training
    for epoch in range(50):
        model.train()
        for X_b, y_b in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(X_b), y_b)
            loss.backward()
            optimizer.step()

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for X_b, y_b in val_loader:
                outputs = model(X_b)
                _, predicted = torch.max(outputs, 1)
                val_total += y_b.size(0)
                val_correct += (predicted == y_b).sum().item()

        val_acc = val_correct / val_total

        # Pruning: terminate poorly performing trials early
        trial.report(val_acc, epoch)
        if trial.should_prune():
            raise optuna.exceptions.TrialPruned()

    return val_acc


# Run optimization
study = optuna.create_study(
    direction="maximize",
    pruner=optuna.pruners.MedianPruner(n_startup_trials=5),
    sampler=optuna.samplers.TPESampler(seed=42),
)
study.optimize(objective, n_trials=100, timeout=600)

print(f"\nBest accuracy: {study.best_value:.4f}")
print(f"Best parameters: {study.best_params}")

# Visualize results
fig = optuna.visualization.plot_optimization_history(study)
fig = optuna.visualization.plot_param_importances(study)
```

---

## Comparison Tables

### Activation Function Characteristics Comparison

| Activation Function | Output Range | Vanishing Gradient | Computational Cost | Primary Use | Notes |
|---|---|---|---|---|---|
| ReLU | [0, +inf) | Low | Very low | Hidden layers (standard) | Dead Neuron problem |
| LeakyReLU | (-inf, +inf) | Low | Very low | Hidden layers | Dead Neuron countermeasure |
| ELU | (-alpha, +inf) | Low | Low | Hidden layers | Negative output pushes mean toward 0 |
| GELU | (-0.17, +inf) | Low | Medium | Transformer | Standard in BERT, GPT |
| Swish | (-0.28, +inf) | Low | Medium | Deep networks | Self-gating mechanism |
| Mish | (-0.31, +inf) | Low | Medium | Object detection | Adopted in YOLOv4 |
| Sigmoid | (0, 1) | High | Low | Output layer (binary classification) | Not recommended for hidden layers |
| Tanh | (-1, 1) | Medium | Low | RNN (gating mechanism) | Zero-centered output |
| Softmax | (0, 1) | - | Medium | Output layer (multi-class) | Outputs probability distribution |

### Optimizer Comparison

| Optimizer | LR Adjustment | Momentum | Adaptive LR | Memory | Recommended Scenario |
|---|---|---|---|---|---|
| SGD | Manual | No (optional) | No | Low | Convex optimization, final tuning |
| SGD+Momentum | Manual | Yes | No | Low | CNN training |
| Nesterov SGD | Manual | Yes (look-ahead) | No | Low | Accelerating convergence |
| AdaGrad | Automatic | No | Yes | Medium | Sparse data |
| RMSProp | Automatic | No | Yes | Medium | RNN training |
| Adam | Automatic | Yes | Yes | High | General purpose (most widely used) |
| AdamW | Automatic | Yes | Yes | High | Transformer, large-scale models |
| LAMB | Automatic | Yes | Yes (layer-wise) | High | Very large batch training |

### Learning Rate Scheduler Comparison

| Scheduler | Characteristics | Recommended Scenario |
|---|---|---|
| Step Decay | Fixed-rate reduction every N epochs | Simple CNN training |
| Exponential Decay | Exponential decrease | When stable convergence is needed |
| Cosine Annealing | Cosine curve decrease | General purpose (most common) |
| Warmup + Cosine | Increase LR initially → cosine decrease | Transformer pre-training |
| Warm Restarts (SGDR) | Cosine + periodic restarts | Exploring multiple local optima |
| 1Cycle Policy | Warmup → Cooldown | Super-Convergence |
| ReduceLROnPlateau | Reduce when validation loss plateaus | Flexible adaptation |

---

## Anti-Patterns

### Anti-Pattern 1: Using Sigmoid in Hidden Layers

```python
# BAD: Sigmoid in deep network hidden layers → vanishing gradients
model = MLPClassifier(
    hidden_layer_sizes=(256, 128, 64, 32),
    activation="logistic",  # Sigmoid → gradient nearly 0 in deep layers
)

# GOOD: Use ReLU for hidden layers
model = MLPClassifier(
    hidden_layer_sizes=(256, 128, 64, 32),
    activation="relu",  # Resistant to vanishing gradients
)
```

### Anti-Pattern 2: Ignoring Weight Initialization

```python
# BAD: Initialize all to 0 → symmetry not broken, training cannot proceed
W = np.zeros((input_dim, output_dim))

# BAD: Random values too large → activation saturation
W = np.random.randn(input_dim, output_dim) * 10

# GOOD: He initialization (for ReLU)
W = np.random.randn(input_dim, output_dim) * np.sqrt(2.0 / input_dim)

# GOOD: Xavier initialization (for Sigmoid/Tanh)
W = np.random.randn(input_dim, output_dim) * np.sqrt(1.0 / input_dim)
```

### Anti-Pattern 3: Wrong Order of BatchNorm and Dropout

```python
# BAD: Dropout → BatchNorm (variance estimation becomes unstable)
layer = nn.Sequential(
    nn.Linear(256, 128),
    nn.Dropout(0.3),
    nn.BatchNorm1d(128),  # Normalizing variance altered by Dropout → unstable
    nn.ReLU(),
)

# GOOD: BatchNorm → Activation → Dropout
layer = nn.Sequential(
    nn.Linear(256, 128),
    nn.BatchNorm1d(128),
    nn.ReLU(),
    nn.Dropout(0.3),
)

# BETTER: When using BatchNorm, Dropout is often unnecessary
layer = nn.Sequential(
    nn.Linear(256, 128),
    nn.BatchNorm1d(128),
    nn.ReLU(),
)
```

### Anti-Pattern 4: Forgetting to Switch train/eval Mode

```python
# BAD: Forgetting model.eval() during inference → Dropout/BatchNorm behave as in training
model.train()
# ... training ...
# Inference (forgot model.eval())
with torch.no_grad():
    output = model(X_test)  # Dropout still ON → performance degradation

# GOOD: Always switch to eval() during inference
model.eval()
with torch.no_grad():
    output = model(X_test)
# Switch back to train() when resuming training
model.train()
```

### Anti-Pattern 5: Over-Optimizing Hyperparameters on Validation Data

```python
# BAD: Repeatedly tuning on test data → overfitting to test data
for lr in [0.001, 0.01, 0.1]:
    model = train(X_train, y_train)
    score = evaluate(X_test, y_test)  # Selecting on test → leakage
    if score > best_score:
        best_lr = lr

# GOOD: 3-way split into Train / Validation / Test
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5)

# Tune on Validation, Test is for final evaluation only once
for lr in [0.001, 0.01, 0.1]:
    model = train(X_train, y_train)
    score = evaluate(X_val, y_val)  # Select on Validation
    if score > best_score:
        best_lr = lr

# Final evaluation (once only)
final_model = train(X_train, y_train)  # using best_lr
final_score = evaluate(X_test, y_test)
```

---

## FAQ

### Q1: How do I decide the number of units and layers in hidden layers?

**A:** There is no theoretical optimal answer. Rules of thumb: (1) An inverted pyramid shape that gradually decreases between input and output dimensions tends to be stable (e.g., 256->128->64). (2) Start with a small model, check the learning curves, expand if underfitting, add Dropout/regularization if overfitting. (3) Use AutoML (Optuna, etc.) for hyperparameter search. Control overfitting with Dropout and Early Stopping. (4) Depending on task complexity: 1-2 layers for simple classification, 3-5 layers for complex patterns as a guideline.

### Q2: What batch size should I use?

**A:** Generally 32 to 256. Small batches have a regularization effect but are noisier. Large batches are more stable but consume more memory and tend to degrade generalization performance. A practical approach is to start with the maximum batch size that fits in GPU memory and adjust the learning rate proportionally to the batch size. Recent research establishes the Linear Scaling Rule (double the learning rate when doubling the batch size) combined with Warmup as the standard technique for large-batch training.

### Q3: How should I configure Early Stopping?

**A:** Stop training when the validation loss does not improve for N consecutive epochs. N is typically 5 to 20 (patience). Save the model that recorded the best validation score (Model Checkpoint). In scikit-learn, configure with `early_stopping=True, n_iter_no_change=10`. In PyTorch, you need a custom implementation, but PyTorch Lightning provides an `EarlyStopping` callback.

### Q4: Where should I place BatchNormalization?

**A:** The generally recommended order is `Linear -> BatchNorm -> Activation -> (Dropout)`. Since BatchNorm normalizes using mini-batch statistics, use Layer Normalization when the batch size is extremely small (<8). During inference, use the running averages computed during training instead of batch statistics. Layer Norm is the standard for NLP and Transformers.

### Q5: How do I detect vanishing/exploding gradients?

**A:** (1) Monitor the gradient norms of each layer (TensorBoard's histogram feature is convenient). (2) If the loss does not decrease early in training, suspect vanishing gradients. (3) If the loss suddenly becomes NaN, suspect exploding gradients. (4) Use `torch.autograd.set_detect_anomaly(True)` to identify where NaN occurs.

### Q6: Should I train on CPU or GPU?

**A:** It depends on data size and model size. For small datasets (~100K samples) with small MLPs (a few thousand parameters), CPU is sufficient. For large datasets or deep networks, especially CNN/Transformer architectures, GPU is essential. Mixed precision training (FP16) can halve GPU memory usage and speed up training. Use `torch.cuda.amp`.

---

## Summary

| Item | Key Points |
|---|---|
| Structure | Input layer -> Hidden layers (ReLU) -> Output layer (Softmax/Sigmoid) |
| Activation Functions | Hidden layers: ReLU/GELU, Output layer: Softmax (classification) / Linear (regression) |
| Loss Functions | Classification: Cross-Entropy, Regression: MSE/Huber, Imbalanced: Focal Loss |
| Backpropagation | Efficiently computes gradients via the chain rule. Automatic differentiation is mainstream |
| Optimization | Adam (general purpose), AdamW (large-scale), SGD+Momentum (fine-tuning) |
| Initialization | He (for ReLU), Xavier (for Sigmoid/Tanh) |
| Regularization | Dropout, BatchNorm, Weight Decay, Early Stopping |
| Tuning | Automated search with Optuna, etc. Train/Val/Test 3-way split is fundamental |

---

## Recommended Next Guides

- [01-cnn.md](./01-cnn.md) — Convolutional Neural Networks (CNN)
- [02-rnn-transformer.md](./02-rnn-transformer.md) — RNN/Transformer for Sequential Data

---

## References

1. **Ian Goodfellow, Yoshua Bengio, Aaron Courville** "Deep Learning" MIT Press, 2016 — https://www.deeplearningbook.org/
2. **Diederik P. Kingma, Jimmy Ba** "Adam: A Method for Stochastic Optimization" ICLR 2015
3. **Kaiming He et al.** "Delving Deep into Rectifiers: Surpassing Human-Level Performance on ImageNet Classification" ICCV 2015
4. **Sergey Ioffe, Christian Szegedy** "Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift" ICML 2015
5. **Nitish Srivastava et al.** "Dropout: A Simple Way to Prevent Neural Networks from Overfitting" JMLR 2014
6. **Ilya Loshchilov, Frank Hutter** "Decoupled Weight Decay Regularization" ICLR 2019
7. **Ilya Loshchilov, Frank Hutter** "SGDR: Stochastic Gradient Descent with Warm Restarts" ICLR 2017
8. **Leslie N. Smith** "A disciplined approach to neural network hyper-parameters" arXiv 2018
9. **Xavier Glorot, Yoshua Bengio** "Understanding the difficulty of training deep feedforward neural networks" AISTATS 2010
10. **Dan Hendrycks, Kevin Gimpel** "Gaussian Error Linear Units (GELUs)" arXiv 2016
