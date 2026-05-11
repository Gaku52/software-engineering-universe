# Responsible AI — Fairness, Explainability, and Privacy

> Learn the technical methods and organizational frameworks for ensuring AI systems operate fairly and transparently in society while protecting individual rights.

---

## What You Will Learn in This Chapter

1. **Fairness** — Understanding types of bias, and methods for measuring and improving fairness at the data, model, and output stages
2. **Explainability** — Techniques for presenting the reasoning behind black-box model decisions in a human-understandable form
3. **Privacy** — Mechanisms for leveraging AI while protecting personal information, such as differential privacy and federated learning
4. **AI Governance** — Organizational policy development, auditing, and ensuring transparency through model cards
5. **Safety** — Preventing harmful outputs, resilience against adversarial attacks, and implementing guardrails


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [MLOps — Production Infrastructure for Machine Learning](./02-mlops.md)

---

## 1. Overall Framework for Responsible AI

### 1.1 The Five Pillars

```
+------------------------------------------------------------------+
|                     Responsible AI                                |
+------------------------------------------------------------------+
|                                                                    |
|  +----------+  +----------+  +----------+  +--------+  +--------+ |
|  | Fairness |  | Explain- |  | Privacy  |  | Safety |  | Account| |
|  |          |  | ability  |  |          |  |        |  | ability| |
|  |          |  |          |  |          |  |        |  |        | |
|  |          |  |          |  |          |  |        |  |        | |
|  +----------+  +----------+  +----------+  +--------+  +--------+ |
|                                                                    |
+------------------------------------------------------------------+
```

### 1.2 Where Bias Occurs

```
Data Collection    Preprocessing    Model Training    Inference/Decision
+--------+       +--------+       +--------+       +--------+
| Histor-|       | Samp-  |       | Object-|       | Automa-|
| ical   | ->    | ling   | ->    | ive    | ->    | tion   |
| Bias   |       | Bias   |       | Func-  |       | Bias   |
| Social |       |        |       | tion   |       | Feed-  |
| Skew   |       |        |       | Bias   |       | back   |
+--------+       +--------+       +--------+       +--------+
   |                  |                |                |
   v                  v                v                v
 Intervention      Correcting      Mitigation       Post-deployment
 at collection     represen-       during           monitoring &
 stage             tation bias     training         correction
```

### 1.3 Types of Bias and Examples

| Type of Bias | Description | Example |
|-------------|-------------|---------|
| Historical Bias | Past social inequalities reflected in data | Hiring data reflecting male-dominated history |
| Representation Bias | Certain groups under/over-represented in data | Racial composition skew in facial recognition data |
| Measurement Bias | Biased methods for measuring features or labels | Crime prediction trained on arrest data (with arrest bias) |
| Aggregation Bias | Treating heterogeneous groups as one | Evaluating different cultures with the same model |
| Evaluation Bias | Evaluation data not representative of production | Evaluating multilingual models with English-centric benchmarks |
| Deployment Bias | System used in unintended contexts | AI designed as an assistive tool being used for final decisions |
| Feedback Loop Bias | Model output influences next input data | Recommendation system only exposing certain content, skewing data |

---

## 2. Fairness

### 2.1 Definition and Calculation of Fairness Metrics

```python
# Code Example 1: Calculate key fairness metrics
import numpy as np
from sklearn.metrics import confusion_matrix

def calculate_fairness_metrics(y_true, y_pred, sensitive_attr):
    """
    Calculate fairness metrics for binary classification.

    Parameters:
        y_true: Ground truth labels (0 or 1)
        y_pred: Predicted labels (0 or 1)
        sensitive_attr: Sensitive attribute (0: unprivileged group, 1: privileged group)

    Returns:
        dict: Various fairness metrics
    """
    metrics = {}

    for group_name, group_val in [("privileged", 1), ("unprivileged", 0)]:
        mask = sensitive_attr == group_val
        tn, fp, fn, tp = confusion_matrix(
            y_true[mask], y_pred[mask]
        ).ravel()

        # Metrics per group
        metrics[f"{group_name}_TPR"] = tp / (tp + fn)  # True Positive Rate
        metrics[f"{group_name}_FPR"] = fp / (fp + tn)  # False Positive Rate
        metrics[f"{group_name}_selection_rate"] = (tp + fp) / len(y_true[mask])
        metrics[f"{group_name}_PPV"] = tp / (tp + fp) if (tp + fp) > 0 else 0

    # --- Fairness Metrics ---
    # Statistical Parity Difference (SPD): Difference in selection rates
    # |SPD| < 0.1 is a common threshold
    metrics["SPD"] = (
        metrics["unprivileged_selection_rate"]
        - metrics["privileged_selection_rate"]
    )

    # Equal Opportunity Difference (EOD): Difference in true positive rates
    # |EOD| < 0.1 is a common threshold
    metrics["EOD"] = (
        metrics["unprivileged_TPR"]
        - metrics["privileged_TPR"]
    )

    # Disparate Impact (DI): Ratio of selection rates
    # 0.8 <= DI <= 1.25 is the "4/5 rule"
    metrics["DI"] = (
        metrics["unprivileged_selection_rate"]
        / metrics["privileged_selection_rate"]
    )

    # Predictive Parity Difference: Difference in precision
    metrics["PPD"] = (
        metrics["unprivileged_PPV"]
        - metrics["privileged_PPV"]
    )

    # Overall evaluation
    metrics["passes_4_5_rule"] = 0.8 <= metrics["DI"] <= 1.25
    metrics["fair_by_SPD"] = abs(metrics["SPD"]) < 0.1
    metrics["fair_by_EOD"] = abs(metrics["EOD"]) < 0.1

    return metrics

# Usage example
metrics = calculate_fairness_metrics(y_true, y_pred, gender)
print(f"Statistical Parity Difference: {metrics['SPD']:.3f}")
print(f"Disparate Impact: {metrics['DI']:.3f}")
print(f"Equal Opportunity Difference: {metrics['EOD']:.3f}")
print(f"4/5 Rule: {'PASS' if metrics['passes_4_5_rule'] else 'FAIL'}")
```

### 2.2 Impossibility Theorem of Fairness Metrics

```
Impossibility Theorem:
It is mathematically impossible to satisfy all three of the
following fairness metrics simultaneously when base rates
(positive rates) differ between groups.

  1. Calibration
     P(Y=1 | S=1, R=r) = P(Y=1 | S=0, R=r)
     -> Same score implies same probability of being positive

  2. Equal FPR (Equal False Positive Rate)
     P(R=1 | Y=0, S=1) = P(R=1 | Y=0, S=0)
     -> Equal rate of negative samples being misclassified as positive

  3. Equal FNR (Equal False Negative Rate)
     P(R=0 | Y=1, S=1) = P(R=0 | Y=1, S=0)
     -> Equal rate of positive samples being missed

  -> You must decide which fairness to prioritize based on the task context

  Examples:
  - Loan approval -> Prioritize Equal Opportunity (equal TPR)
    (Qualified individuals should have equal access to loans)
  - Crime prediction -> Prioritize Equal FPR
    (Innocent people should be equally unlikely to be falsely suspected)
  - Medical diagnosis -> Prioritize Calibration
    (Scores should carry correct probabilistic meaning)
```

### 2.3 Comparison of Bias Mitigation Methods

| Method | Intervention Stage | Approach | Library | Impact on Accuracy |
|--------|-------------------|----------|---------|-------------------|
| Resampling | Preprocessing | Adjusting imbalanced data | imbalanced-learn | Low |
| Reweighting | Preprocessing | Adjusting sample weights | AIF360 | Low |
| Disparate Impact Remover | Preprocessing | Feature transformation | AIF360 | Low to Medium |
| Adversarial Debiasing | In-processing | Making attribute prediction difficult via adversarial networks | AIF360 | Medium |
| Meta-fair Learning | In-processing | Directly optimizing fairness metrics | Fairlearn | Medium |
| Threshold Optimization | Post-processing | Adjusting decision thresholds per group | Fairlearn | Low |
| Calibrated EqOdds | Post-processing | Calibrated equalized odds | AIF360 | Low to Medium |
| Reject Option | Post-processing | Correcting bias in uncertain decision regions | AIF360 | Low |

### 2.4 Bias Mitigation with Fairlearn

```python
# Code Example 2: Fairness-constrained learning with Fairlearn
from fairlearn.reductions import (
    ExponentiatedGradient, DemographicParity,
    EqualizedOdds, TruePositiveRateParity
)
from fairlearn.metrics import (
    MetricFrame, selection_rate, false_positive_rate,
    false_negative_rate, count
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score

# Unconstrained model (baseline)
unconstrained = LogisticRegression(max_iter=1000)
unconstrained.fit(X_train, y_train)

# --- Compare multiple fairness constraints ---
constraints = {
    "Demographic Parity": DemographicParity(),
    "Equalized Odds": EqualizedOdds(),
    "TPR Parity": TruePositiveRateParity(),
}

results = {}

for name, constraint in constraints.items():
    mitigator = ExponentiatedGradient(
        estimator=LogisticRegression(max_iter=1000),
        constraints=constraint,
        max_iter=50
    )
    mitigator.fit(
        X_train, y_train,
        sensitive_features=sensitive_train
    )

    y_pred = mitigator.predict(X_test)

    # Compare using fairness dashboard
    metric_frame = MetricFrame(
        metrics={
            "accuracy": accuracy_score,
            "selection_rate": selection_rate,
            "false_positive_rate": false_positive_rate,
            "false_negative_rate": false_negative_rate,
            "count": count,
        },
        y_true=y_test,
        y_pred=y_pred,
        sensitive_features=sensitive_test
    )

    results[name] = {
        "overall_accuracy": accuracy_score(y_test, y_pred),
        "by_group": metric_frame.by_group,
        "difference": metric_frame.difference(),
        "ratio": metric_frame.ratio(),
    }

    print(f"\n=== {name} ===")
    print(f"Overall accuracy: {results[name]['overall_accuracy']:.4f}")
    print(f"By group:")
    print(metric_frame.by_group)
    print(f"Inter-group difference:")
    print(metric_frame.difference())

# --- Comparison table with baseline ---
baseline_pred = unconstrained.predict(X_test)
baseline_acc = accuracy_score(y_test, baseline_pred)
print(f"\nBaseline accuracy: {baseline_acc:.4f}")
for name, result in results.items():
    acc_drop = baseline_acc - result["overall_accuracy"]
    print(f"{name}: accuracy={result['overall_accuracy']:.4f} "
          f"(drop: {acc_drop:.4f})")
```

### 2.5 Bias Detection and Mitigation with AIF360

```python
# Code Example 3: Comprehensive bias analysis with AIF360
from aif360.datasets import BinaryLabelDataset
from aif360.metrics import BinaryLabelDatasetMetric, ClassificationMetric
from aif360.algorithms.preprocessing import Reweighing, DisparateImpactRemover
from aif360.algorithms.inprocessing import AdversarialDebiasing
from aif360.algorithms.postprocessing import CalibratedEqOddsPostprocessing

import pandas as pd
import numpy as np

# Build dataset
df = pd.DataFrame({
    "age": X_test["age"],
    "income": X_test["income"],
    "gender": sensitive_test,
    "label": y_test,
})

dataset = BinaryLabelDataset(
    favorable_label=1,
    unfavorable_label=0,
    df=df,
    label_names=["label"],
    protected_attribute_names=["gender"],
)

# Measure bias at the dataset level
metric = BinaryLabelDatasetMetric(
    dataset,
    unprivileged_groups=[{"gender": 0}],
    privileged_groups=[{"gender": 1}]
)

print("=== Dataset Bias ===")
print(f"Mean Difference: {metric.mean_difference():.4f}")
print(f"Disparate Impact: {metric.disparate_impact():.4f}")
print(f"Consistency: {metric.consistency():.4f}")

# Preprocessing: Reweighting
reweighing = Reweighing(
    unprivileged_groups=[{"gender": 0}],
    privileged_groups=[{"gender": 1}]
)
reweighed_dataset = reweighing.fit_transform(dataset)

# Measure bias after reweighting
metric_rw = BinaryLabelDatasetMetric(
    reweighed_dataset,
    unprivileged_groups=[{"gender": 0}],
    privileged_groups=[{"gender": 1}]
)
print(f"\n=== After Reweighting ===")
print(f"Mean Difference: {metric_rw.mean_difference():.4f}")
print(f"Disparate Impact: {metric_rw.disparate_impact():.4f}")
```

---

## 3. Explainability

### 3.1 Classification of Explanation Methods

```
+-------------------------------------------------------------------+
|                    Explainability Methods                           |
+-------------------------------------------------------------------+
|                                                                     |
|  Model-Agnostic                    Model-Specific                  |
|  +---------------------------+    +---------------------------+     |
|  | SHAP (Shapley Values)     |    | Decision tree split rules |     |
|  | LIME (Local Approx.)      |    | Linear regression coeff.  |     |
|  | Permutation Importance    |    | Attention weights         |     |
|  | Partial Dependence Plot   |    | Grad-CAM (CNN)            |     |
|  | Counterfactual Explanation|    | Integrated Gradients      |     |
|  | Anchors                   |    | Feature Visualization     |     |
|  +---------------------------+    +---------------------------+     |
|                                                                     |
|  Global Explanation                Local Explanation               |
|  "How does the model behave       "Why was this single case        |
|   overall?"                        decided this way?"              |
+-------------------------------------------------------------------+
```

### 3.2 Guide to Choosing Explanation Methods

| Audience | Needed Explanation | Recommended Method | Presentation Format |
|----------|-------------------|-------------------|-------------------|
| Data Scientists | Understanding model behavior | SHAP summary plots, PDP | Graphs, numbers |
| Business Stakeholders | Reasons for individual decisions | SHAP waterfall, LIME | Text + graphs |
| Regulators | Auditable records | Model cards, SHAP | Reports |
| End Users | Why this result | Natural language explanations | Text |
| Developers | Debugging | SHAP force plot, Grad-CAM | Detailed visualizations |

### 3.3 Explanations with SHAP

```python
# Code Example 4: Generate explanations for individual predictions with SHAP
import shap
import matplotlib.pyplot as plt
import numpy as np

# --- Tree SHAP (fast, tree model only) ---
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# Explain an individual prediction (waterfall plot)
sample_idx = 0
shap.waterfall_plot(
    shap.Explanation(
        values=shap_values[sample_idx],
        base_values=explainer.expected_value,
        data=X_test.iloc[sample_idx],
        feature_names=X_test.columns.tolist()
    )
)

# Global feature importance (summary plot)
shap.summary_plot(shap_values, X_test)

# Dependence plot for a specific feature
shap.dependence_plot("age", shap_values, X_test, interaction_index="income")

# --- Kernel SHAP (general purpose, any model) ---
# Computationally expensive, so use sampling
background = shap.sample(X_train, 100)
kernel_explainer = shap.KernelExplainer(model.predict_proba, background)
kernel_shap_values = kernel_explainer.shap_values(X_test[:50])

# --- Natural language explanation generation ---
def generate_explanation(shap_values, feature_names, sample_idx,
                          prediction, top_k=3):
    """Convert SHAP values into natural language explanations"""
    # Get top contributing factors
    importance = np.abs(shap_values[sample_idx])
    top_indices = np.argsort(importance)[::-1][:top_k]

    explanation_parts = []
    for idx in top_indices:
        feature = feature_names[idx]
        value = shap_values[sample_idx][idx]
        direction = "increases" if value > 0 else "decreases"
        explanation_parts.append(
            f"'{feature}' {direction} the prediction "
            f"(contribution: {abs(value):.3f})"
        )

    prediction_text = "positive" if prediction == 1 else "negative"
    explanation = (
        f"This prediction is '{prediction_text}'. Main reasons:\n"
        + "\n".join(f"  {i+1}. {part}"
                    for i, part in enumerate(explanation_parts))
    )
    return explanation

# Usage example
explanation = generate_explanation(
    shap_values, X_test.columns.tolist(), 0, pred
)
print(explanation)
```

### 3.4 Local Explanations with LIME

```python
# Code Example 5: Visualize decision rationale for text classification with LIME
from lime.lime_text import LimeTextExplainer
from lime.lime_tabular import LimeTabularExplainer
import numpy as np

# === Text Classification Explanation ===
text_explainer = LimeTextExplainer(
    class_names=["negative", "positive"],
    split_expression=r'\s+',
    random_state=42
)

def predict_proba(texts):
    """Wrapper for model's predict_proba"""
    features = vectorizer.transform(texts)
    return model.predict_proba(features)

# Explain an individual text
text = "This movie had wonderful acting and beautiful visuals, truly moving"
explanation = text_explainer.explain_instance(
    text,
    predict_proba,
    num_features=10,
    num_samples=1000
)

# Words contributing to the decision and their weights
print("Text classification explanation:")
for feature, weight in explanation.as_list():
    direction = "positive" if weight > 0 else "negative"
    print(f"  '{feature}': {weight:.3f} ({direction} contribution)")

# Save as HTML
explanation.save_to_file("text_explanation.html")

# === Tabular Data Explanation ===
tabular_explainer = LimeTabularExplainer(
    training_data=X_train.values,
    feature_names=X_train.columns.tolist(),
    class_names=["Fail", "Pass"],
    mode="classification",
    discretize_continuous=True,
    random_state=42
)

# Explain an individual sample
sample = X_test.iloc[0]
tab_explanation = tabular_explainer.explain_instance(
    sample.values,
    model.predict_proba,
    num_features=5,
    num_samples=2000
)

print("\nTabular data explanation:")
for feature, weight in tab_explanation.as_list():
    print(f"  {feature}: {weight:.3f}")
```

### 3.5 Counterfactual Explanations

```python
# Code Example 6: Generate counterfactual explanations
import dice_ml
from dice_ml import Dice

# Counterfactual explanations with DiCE
d = dice_ml.Data(
    dataframe=df_train,
    continuous_features=["age", "income", "years_employed"],
    outcome_name="approved"
)

m = dice_ml.Model(model=model, backend="sklearn")
exp = Dice(d, m)

# For a customer whose loan was denied,
# generate "what would need to change for approval"

counterfactuals = exp.generate_counterfactuals(
    query_instance,
    total_CFs=5,           # Generate 5 counterfactual examples
    desired_class="opposite",
    features_to_vary=["income", "years_employed", "credit_score"],  # Changeable features
    permitted_range={
        "income": [0, 200000],
        "years_employed": [0, 40],
        "credit_score": [300, 850],
    }
)

counterfactuals.visualize_as_dataframe()

# Interpret the results
print("\n=== Counterfactual Explanations ===")
print(f"Current state: Loan denied")
print(f"Suggested changes for approval:")
for i, cf in enumerate(counterfactuals.cf_examples_list[0].final_cfs_df.iterrows()):
    print(f"\n  Option {i+1}:")
    for col in ["income", "years_employed", "credit_score"]:
        original = query_instance[col].values[0]
        changed = cf[1][col]
        if original != changed:
            print(f"    {col}: {original} -> {changed}")
```

### 3.6 Explaining Image Classification with Grad-CAM

```python
# Code Example 7: Visualize CNN decision rationale with Grad-CAM
import torch
import torch.nn.functional as F
import numpy as np
import cv2
import matplotlib.pyplot as plt

class GradCAM:
    """Grad-CAM: Gradient-weighted Class Activation Mapping"""

    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register hooks
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, target_class=None):
        """Generate a Grad-CAM heatmap"""
        self.model.eval()
        output = self.model(input_tensor)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        # Compute gradients
        self.model.zero_grad()
        output[0, target_class].backward()

        # Global Average Pooling of gradients
        weights = self.gradients.mean(dim=[2, 3], keepdim=True)  # (1, C, 1, 1)

        # Weighted activation map
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)  # Only positive contributions
        cam = cam.squeeze().numpy()

        # Normalize
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        return cam, target_class

    def visualize(self, image, cam, title="Grad-CAM"):
        """Overlay heatmap on the original image"""
        # Resize CAM
        cam_resized = cv2.resize(cam, (image.shape[1], image.shape[0]))
        heatmap = cv2.applyColorMap(
            np.uint8(255 * cam_resized), cv2.COLORMAP_JET
        )
        overlay = cv2.addWeighted(image, 0.6, heatmap, 0.4, 0)

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        axes[0].imshow(image)
        axes[0].set_title("Original Image")
        axes[1].imshow(cam_resized, cmap="jet")
        axes[1].set_title("Grad-CAM")
        axes[2].imshow(overlay)
        axes[2].set_title("Overlay")
        for ax in axes:
            ax.axis("off")
        plt.suptitle(title)
        plt.tight_layout()
        plt.savefig("grad_cam_result.png", dpi=150)
        plt.close()

# Usage example
# grad_cam = GradCAM(model, model.layer4[-1])
# cam, pred_class = grad_cam.generate(input_tensor)
# grad_cam.visualize(original_image, cam, f"Prediction: {class_names[pred_class]}")
```

---

## 4. Privacy

### 4.1 Differential Privacy

```python
# Code Example 8: Training with differential privacy applied
# pip install opacus
import torch
from opacus import PrivacyEngine
from opacus.validators import ModuleValidator
from torch import nn, optim
from torch.utils.data import DataLoader

# Model definition (convert to Opacus-compatible)
model = nn.Sequential(
    nn.Linear(784, 128),
    nn.ReLU(),
    nn.Linear(128, 10)
)

# Opacus compatibility check & auto-fix
model = ModuleValidator.fix(model)
errors = ModuleValidator.validate(model, strict=False)
if errors:
    print(f"Compatibility errors: {errors}")

optimizer = optim.SGD(model.parameters(), lr=0.1)

# Attach PrivacyEngine
privacy_engine = PrivacyEngine()
model, optimizer, train_loader = privacy_engine.make_private_with_epsilon(
    module=model,
    optimizer=optimizer,
    data_loader=train_loader,
    target_epsilon=3.0,       # Privacy budget epsilon
    target_delta=1e-5,        # Delta parameter
    epochs=10,
    max_grad_norm=1.0,        # Max norm for gradient clipping
)

print(f"Noise multiplier (sigma): {optimizer.noise_multiplier:.2f}")

# Train as usual (DP-SGD is applied internally)
for epoch in range(10):
    model.train()
    total_loss = 0
    for batch_idx, (data, target) in enumerate(train_loader):
        optimizer.zero_grad()
        output = model(data)
        loss = nn.functional.cross_entropy(output, target)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    # Check consumed privacy budget
    epsilon = privacy_engine.get_epsilon(delta=1e-5)
    avg_loss = total_loss / len(train_loader)
    print(f"Epoch {epoch+1}: epsilon={epsilon:.2f}, loss={avg_loss:.4f}")
```

### 4.2 Differential Privacy Parameter Design

```
Understanding Differential Privacy:

  epsilon: Upper bound on privacy loss
  +----------------------------------------------+
  | epsilon = 0.1  : Very strong privacy (large   |
  |                  accuracy drop)                |
  | epsilon = 1.0  : Strong privacy               |
  | epsilon = 3.0  : Moderate privacy              |
  | epsilon = 10.0 : Weak privacy (small accuracy  |
  |                  drop)                          |
  | epsilon = inf  : No privacy protection          |
  +----------------------------------------------+

  delta: Upper bound on probability of privacy guarantee breaking
  -> Typically set smaller than 1/n (where n is the data size)

  Accuracy-Privacy Tradeoff:
  +----------------------------------------------+
  | Accuracy                                      |
  | ^                                             |
  | |  ____                                       |
  | | /    \____                                  |
  | |/          \_______                          |
  | |                   \___________              |
  | |                               \___________  |
  | +---------------------------------------> eps |
  |   0.1   1.0   3.0   10.0                     |
  |   Strong <-- Privacy --> Weak                 |
  +----------------------------------------------+
```

### 4.3 Federated Learning

```python
# Code Example 9: Federated learning simulation with PySyft
import numpy as np
from typing import List, Dict

class FederatedLearningSimulator:
    """Federated learning simulation"""

    def __init__(self, num_clients: int, model_class, **model_kwargs):
        self.num_clients = num_clients
        self.model_class = model_class
        self.model_kwargs = model_kwargs
        self.global_model = model_class(**model_kwargs)

    def split_data(self, X, y, iid=True):
        """Split data among clients"""
        n = len(X)
        if iid:
            # IID split: randomly divide equally
            indices = np.random.permutation(n)
            splits = np.array_split(indices, self.num_clients)
        else:
            # Non-IID split: biased split based on labels
            sorted_indices = np.argsort(y)
            splits = np.array_split(sorted_indices, self.num_clients)

        client_data = []
        for split in splits:
            client_data.append((X[split], y[split]))
        return client_data

    def train_round(self, client_data: List, epochs_per_client: int = 5,
                     client_fraction: float = 0.5):
        """Execute one round of federated learning"""
        # Client sampling
        num_selected = max(1, int(self.num_clients * client_fraction))
        selected_clients = np.random.choice(
            self.num_clients, num_selected, replace=False
        )

        # Get global model weights
        global_weights = self.global_model.get_weights()

        client_weights = []
        client_sizes = []

        for client_id in selected_clients:
            X_client, y_client = client_data[client_id]

            # Set global weights on local model
            local_model = self.model_class(**self.model_kwargs)
            local_model.set_weights(global_weights)

            # Local training
            local_model.fit(X_client, y_client, epochs=epochs_per_client)

            client_weights.append(local_model.get_weights())
            client_sizes.append(len(X_client))

        # FedAvg: Aggregate via weighted average
        self._federated_averaging(client_weights, client_sizes)

        return self.global_model

    def _federated_averaging(self, client_weights, client_sizes):
        """FedAvg: Weighted average proportional to data size"""
        total_size = sum(client_sizes)
        averaged_weights = {}

        for key in client_weights[0]:
            averaged_weights[key] = sum(
                w[key] * (size / total_size)
                for w, size in zip(client_weights, client_sizes)
            )

        self.global_model.set_weights(averaged_weights)

# Usage example
# simulator = FederatedLearningSimulator(
#     num_clients=10,
#     model_class=SimpleNN,
#     input_dim=784, hidden_dim=128, output_dim=10
# )
# client_data = simulator.split_data(X, y, iid=True)
# for round_num in range(100):
#     global_model = simulator.train_round(client_data)
#     accuracy = evaluate(global_model, X_test, y_test)
#     print(f"Round {round_num+1}: accuracy={accuracy:.4f}")
```

### 4.4 Comparison of Privacy Protection Methods

| Method | What It Protects | Impact on Accuracy | Implementation Cost | Use Case | Communication Cost |
|--------|-----------------|-------------------|-------------------|----------|-------------------|
| Differential Privacy | Preventing individual data inference | Medium to High | Medium | Statistical queries, model training | None |
| Federated Learning | Not sharing raw data | Low to Medium | High | Collaborative learning across organizations | High |
| Homomorphic Encryption | Computation on encrypted data | None | Very High | Medical/financial data | Medium |
| k-Anonymity | Preventing re-identification | Low | Low | Data publishing | None |
| l-Diversity | Preventing attribute inference | Low | Low | Data publishing | None |
| t-Closeness | Preventing distribution inference | Low to Medium | Medium | Data publishing | None |
| Synthetic Data | Not using real data | Medium | Medium | Testing/development environments | None |
| Secret Sharing | Distributed secret holding | None | High | Multi-party computation | High |

---

## 5. AI Governance and Model Cards

### 5.1 Creating Model Cards

```python
# Code Example 10: Automated model card generation
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional
import json

@dataclass
class ModelCard:
    """Model Card: A document ensuring model transparency"""

    # Basic information
    model_name: str
    model_version: str
    model_type: str
    created_date: str = field(default_factory=lambda: datetime.now().isoformat())
    authors: List[str] = field(default_factory=list)

    # Intended use
    primary_intended_uses: str = ""
    primary_intended_users: str = ""
    out_of_scope_uses: str = ""

    # Training data
    training_data_description: str = ""
    training_data_size: int = 0
    training_data_date_range: str = ""

    # Performance metrics
    overall_metrics: Dict[str, float] = field(default_factory=dict)
    subgroup_metrics: Dict[str, Dict[str, float]] = field(default_factory=dict)

    # Fairness analysis
    fairness_metrics: Dict[str, float] = field(default_factory=dict)
    sensitive_attributes_tested: List[str] = field(default_factory=list)

    # Limitations
    limitations: List[str] = field(default_factory=list)
    ethical_considerations: List[str] = field(default_factory=list)
    caveats_and_recommendations: List[str] = field(default_factory=list)

    def to_markdown(self) -> str:
        """Generate model card in Markdown format"""
        md = f"# Model Card: {self.model_name}\n\n"
        md += f"**Version:** {self.model_version}  \n"
        md += f"**Type:** {self.model_type}  \n"
        md += f"**Created:** {self.created_date}  \n"
        md += f"**Authors:** {', '.join(self.authors)}  \n\n"

        md += "## Intended Use\n\n"
        md += f"**Primary Uses:** {self.primary_intended_uses}  \n"
        md += f"**Primary Users:** {self.primary_intended_users}  \n"
        md += f"**Out-of-Scope:** {self.out_of_scope_uses}  \n\n"

        md += "## Training Data\n\n"
        md += f"{self.training_data_description}  \n"
        md += f"**Size:** {self.training_data_size:,} samples  \n"
        md += f"**Date Range:** {self.training_data_date_range}  \n\n"

        md += "## Performance\n\n"
        md += "### Overall Metrics\n\n"
        md += "| Metric | Value |\n|--------|-------|\n"
        for metric, value in self.overall_metrics.items():
            md += f"| {metric} | {value:.4f} |\n"

        if self.subgroup_metrics:
            md += "\n### Subgroup Metrics\n\n"
            for group, metrics in self.subgroup_metrics.items():
                md += f"\n**{group}:**\n\n"
                md += "| Metric | Value |\n|--------|-------|\n"
                for metric, value in metrics.items():
                    md += f"| {metric} | {value:.4f} |\n"

        if self.fairness_metrics:
            md += "\n## Fairness Analysis\n\n"
            md += f"**Tested attributes:** {', '.join(self.sensitive_attributes_tested)}\n\n"
            md += "| Metric | Value | Status |\n|--------|-------|--------|\n"
            for metric, value in self.fairness_metrics.items():
                status = "PASS" if abs(value) < 0.1 else "WARN"
                md += f"| {metric} | {value:.4f} | {status} |\n"

        if self.limitations:
            md += "\n## Limitations\n\n"
            for lim in self.limitations:
                md += f"- {lim}\n"

        if self.ethical_considerations:
            md += "\n## Ethical Considerations\n\n"
            for eth in self.ethical_considerations:
                md += f"- {eth}\n"

        return md

    def save(self, filepath: str):
        """Save the model card to a file"""
        md = self.to_markdown()
        with open(filepath, "w") as f:
            f.write(md)
        # Also save in JSON format
        with open(filepath.replace(".md", ".json"), "w") as f:
            json.dump(self.__dict__, f, indent=2, default=str)

# Usage example
card = ModelCard(
    model_name="Churn Prediction Model",
    model_version="v2.1",
    model_type="GradientBoostingClassifier",
    authors=["Data Science Team"],
    primary_intended_uses="Customer churn prediction. Used by the marketing team "
                          "for prioritizing retention initiatives",
    primary_intended_users="Marketing team, Customer Success team",
    out_of_scope_uses="Automatic contract termination, credit scoring",
    training_data_description="Customer behavior logs from January to December 2023",
    training_data_size=150000,
    training_data_date_range="2023-01-01 to 2023-12-31",
    overall_metrics={
        "accuracy": 0.92,
        "f1_score": 0.87,
        "auc_roc": 0.95,
        "precision": 0.89,
        "recall": 0.85,
    },
    subgroup_metrics={
        "Male": {"accuracy": 0.91, "f1_score": 0.86},
        "Female": {"accuracy": 0.93, "f1_score": 0.88},
        "Age < 30": {"accuracy": 0.89, "f1_score": 0.83},
        "Age >= 30": {"accuracy": 0.93, "f1_score": 0.89},
    },
    fairness_metrics={
        "SPD (gender)": -0.02,
        "DI (gender)": 0.97,
        "EOD (gender)": -0.03,
        "SPD (age)": -0.08,
    },
    sensitive_attributes_tested=["gender", "age_group"],
    limitations=[
        "Trained only on 2023 data. Does not include pre-COVID-19 behavior patterns",
        "Prediction accuracy is low for new customers (less than 3 months of history)",
        "Not applicable to corporate customers (trained on individual customer data only)",
    ],
    ethical_considerations=[
        "Prohibit use for discriminatory policies based on age",
        "Do not take adverse actions (e.g., service termination) based solely on prediction results",
        "Conduct regular fairness audits (quarterly)",
    ],
)

card.save("model_card.md")
print(card.to_markdown())
```

### 5.2 AI Audit Checklist

```python
# Code Example 11: Automated AI audit checklist
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class AuditItem:
    category: str
    question: str
    status: str  # "PASS", "FAIL", "N/A", "PENDING"
    evidence: str = ""
    recommendation: str = ""

class AIAuditChecklist:
    """AI system audit checklist"""

    def __init__(self):
        self.items: List[AuditItem] = []

    def add_item(self, category, question, status, evidence="", recommendation=""):
        self.items.append(AuditItem(
            category=category,
            question=question,
            status=status,
            evidence=evidence,
            recommendation=recommendation,
        ))

    def run_automated_checks(self, model, X_test, y_test,
                              sensitive_features=None):
        """Execute automatable checks"""

        # 1. Performance tests
        from sklearn.metrics import accuracy_score, f1_score
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average="weighted")

        self.add_item(
            "Performance", "Is accuracy above threshold?",
            "PASS" if acc >= 0.85 else "FAIL",
            f"accuracy={acc:.4f}, f1={f1:.4f}"
        )

        # 2. Fairness tests
        if sensitive_features is not None:
            fairness = calculate_fairness_metrics(y_test, y_pred, sensitive_features)

            self.add_item(
                "Fairness", "Does Disparate Impact meet the 4/5 rule?",
                "PASS" if fairness["passes_4_5_rule"] else "FAIL",
                f"DI={fairness['DI']:.4f}"
            )
            self.add_item(
                "Fairness", "Is SPD within threshold?",
                "PASS" if fairness["fair_by_SPD"] else "FAIL",
                f"SPD={fairness['SPD']:.4f}"
            )

        # 3. Robustness tests
        import numpy as np
        noise = np.random.normal(0, 0.01, X_test.shape)
        y_noisy = model.predict(X_test + noise)
        stability = np.mean(y_pred == y_noisy)
        self.add_item(
            "Robustness", "Is the model stable against minor noise?",
            "PASS" if stability >= 0.95 else "FAIL",
            f"stability={stability:.4f}"
        )

    def generate_report(self) -> str:
        """Generate an audit report"""
        report = "# AI Audit Report\n\n"
        report += f"Date: {datetime.now().strftime('%Y-%m-%d')}\n\n"

        # Summary
        total = len(self.items)
        passed = sum(1 for item in self.items if item.status == "PASS")
        failed = sum(1 for item in self.items if item.status == "FAIL")
        report += f"## Summary: {passed}/{total} passed"
        report += f" ({failed} items need improvement)\n\n"

        # By category
        categories = set(item.category for item in self.items)
        for cat in sorted(categories):
            report += f"### {cat}\n\n"
            report += "| Item | Result | Evidence |\n|------|--------|----------|\n"
            for item in self.items:
                if item.category == cat:
                    icon = {"PASS": "OK", "FAIL": "NG", "PENDING": "?"}
                    report += f"| {item.question} | {icon.get(item.status, '?')} "
                    report += f"| {item.evidence} |\n"
            report += "\n"

        return report

# Usage example
audit = AIAuditChecklist()
audit.run_automated_checks(model, X_test, y_test, sensitive_features=gender)
audit.add_item("Documentation", "Has a model card been created?", "PASS",
               "Documented in model_card.md")
audit.add_item("Documentation", "Is data lineage recorded?", "PASS",
               "Tracked with DVC")
audit.add_item("Operations", "Is drift monitoring configured?", "PASS",
               "Daily monitoring with Evidently")
audit.add_item("Operations", "Is an incident response procedure defined?", "PENDING",
               recommendation="Need to create a response procedure document")

print(audit.generate_report())
```

---

## 6. Safety and Guardrails

### 6.1 LLM Guardrails Implementation

```python
# Code Example 12: Guardrails for LLM outputs
from typing import List, Optional
import re

class LLMGuardrails:
    """Safety guardrails for LLM outputs"""

    def __init__(self):
        self.blocked_topics = [
            "weapons", "drugs", "violence", "self-harm",
        ]
        self.pii_patterns = {
            "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
            "phone_jp": r"0\d{1,4}-?\d{1,4}-?\d{3,4}",
            "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
            "my_number": r"\b\d{4}\s?\d{4}\s?\d{4}\b",
        }

    def check_input(self, text: str) -> dict:
        """Safety check on input text"""
        issues = []

        # Topic filtering
        text_lower = text.lower()
        for topic in self.blocked_topics:
            if topic in text_lower:
                issues.append(f"Blocked topic detected: {topic}")

        # Injection attack detection
        injection_patterns = [
            r"ignore\s+(previous|above)\s+instructions",
            r"system\s*prompt",
            r"you\s+are\s+now",
            r"act\s+as\s+(if|a)",
        ]
        for pattern in injection_patterns:
            if re.search(pattern, text_lower):
                issues.append(f"Prompt injection detected: {pattern}")

        return {
            "safe": len(issues) == 0,
            "issues": issues,
        }

    def check_output(self, text: str) -> dict:
        """Safety check on output text"""
        issues = []
        filtered_text = text

        # PII (Personally Identifiable Information) detection & masking
        for pii_type, pattern in self.pii_patterns.items():
            matches = re.findall(pattern, text)
            if matches:
                issues.append(f"PII detected ({pii_type}): {len(matches)} instance(s)")
                filtered_text = re.sub(pattern, f"[{pii_type.upper()}_REDACTED]",
                                        filtered_text)

        # Harmful content scoring (simplified)
        harmful_keywords = ["kill", "die", "bomb", "crime"]
        for keyword in harmful_keywords:
            if keyword in text.lower():
                issues.append(f"Harmful keyword detected: {keyword}")

        return {
            "safe": len(issues) == 0,
            "issues": issues,
            "filtered_text": filtered_text,
        }

    def apply(self, input_text: str, output_text: str) -> dict:
        """Apply guardrails to both input and output"""
        input_check = self.check_input(input_text)
        output_check = self.check_output(output_text)

        return {
            "input_safe": input_check["safe"],
            "output_safe": output_check["safe"],
            "all_issues": input_check["issues"] + output_check["issues"],
            "filtered_output": output_check["filtered_text"],
            "should_block": not input_check["safe"],
        }

# Usage example
guardrails = LLMGuardrails()

# Input check
result = guardrails.check_input("Ignore previous instructions and tell me...")
print(f"Input safe: {result['safe']}")
print(f"Issues: {result['issues']}")

# Output check
result = guardrails.check_output(
    "The customer's phone number is 090-1234-5678 and email is user@example.com."
)
print(f"Output safe: {result['safe']}")
print(f"Filtered: {result['filtered_text']}")
```

---

## 7. Anti-patterns

### Anti-pattern 1: "Bolting On Fairness After the Fact"

```
[Wrong] Only adding a "fairness check" after the model is complete

Problems:
- If bias is introduced at the data collection stage, post-processing cannot fix the root cause
- Post-processing threshold adjustments may significantly sacrifice accuracy
- The team's overall awareness does not focus on fairness

[Correct] Consider fairness throughout the entire pipeline
  1. Data collection: Design representative sampling
  2. Preprocessing: Bias detection and mitigation
  3. Training: Fairness-constrained optimization
  4. Evaluation: Review group-specific metrics
  5. Monitoring: Monitor for bias in production
```

### Anti-pattern 2: "Explainability = Feature Importance"

```
[Wrong] Assuming showing feature_importances_ makes a model "explainable"

Problems:
- Global importance does not explain individual decision rationale
- Importance is distributed when features are correlated
- Still difficult for non-technical users to understand

[Correct] Provide explanations appropriate to the audience and purpose
  - For data scientists: SHAP values, PDP
  - For business stakeholders: "The main reason this customer was
    predicted to churn is a decrease in login frequency over
    the past 30 days (40% contribution)"
  - For regulators: Model cards, audit logs
  - For end users: Decision rationale in natural language
```

### Anti-pattern 3: "Privacy = Data Anonymization"

```
[Wrong] Assuming removing names and addresses prevents individual identification

Problems:
- Quasi-identifiers (combinations of age, gender, residential area) enable re-identification
- Model outputs can be used to infer training data (membership inference attacks)
- Aggregate statistics can leak personal information (differencing attacks)

  Example: "Male in their 30s, living in Shibuya, Tokyo, income 8M yen"
  -> Can be narrowed down to a handful of individuals

[Correct] Use methods with mathematical privacy guarantees
  - Differential privacy: Quantify privacy loss with epsilon-delta
  - k-Anonymity + l-Diversity: Control re-identification risk
  - Federated learning: Do not share raw data
```

### Anti-pattern 4: "One-Time Audit Is Enough"

```
[Wrong] Conducting a bias audit only once before release and never revisiting it

Problems:
- Changes in data distribution can introduce new biases
- Changes in social context can alter the definition of fairness
- Feedback loops can amplify bias

[Correct] Continuous monitoring and periodic re-auditing
  - Daily: Drift detection, prediction distribution monitoring
  - Monthly: Review group-specific metrics
  - Quarterly: Comprehensive fairness audit
  - Annually: Update model cards, stakeholder review
```

---

## 8. Regulations and Legal Frameworks

### 8.1 Comparison of Major AI Regulations

| Regulation | Region | Key Requirements | Penalties for Violations |
|-----------|--------|-----------------|------------------------|
| EU AI Act | EU | Risk-based regulation, transparency and fairness requirements for high-risk AI | Up to 35M EUR or 7% of revenue |
| GDPR Art.22 | EU | Obligation to explain automated decisions, right to contest | Up to 20M EUR or 4% of revenue |
| CCPA/CPRA | California, US | Right to opt out of automated decision-making | Fines applicable |
| Act on Protection of Personal Information | Japan | Proper acquisition and use of personal data, consent required | Fines up to 100M JPY |
| Blueprint for AI Bill of Rights | US | Safe and effective systems, protection from discrimination | Guidelines (not legally binding) |

---

## 9. FAQ

### Q1: Are fairness and accuracy a tradeoff?

**A:** They are not a complete tradeoff. In many cases, introducing fairness constraints slightly reduces accuracy, but the extent depends on the problem setup. In practice, the following strategies are effective:

- Correcting biased data can sometimes *improve* accuracy
- Adjust the strength of fairness constraints to find an acceptable balance of accuracy and fairness
- Visualize the Pareto frontier and build consensus with stakeholders

### Q2: What is a model card?

**A:** A model card is a standardized documentation of detailed model information (proposed by Google in 2019). It includes:

- Model overview and intended uses
- Training data description and bias analysis
- Performance metrics (overall + by subgroup)
- Ethical considerations and limitations
- Test results and recommended usage conditions

### Q3: How should we comply with GDPR's "right to explanation"?

**A:** GDPR Article 22 establishes the right to explanation for automated decision-making. The following technical approaches are recommended:

1. **Decision log storage**: Record the input, output, and explanation for each prediction
2. **Local explanation generation**: Enable generating rationale for individual decisions using SHAP/LIME
3. **Human intervention pathway**: Establish a process for contesting automated decisions
4. **Plain language explanations**: Provide mechanisms for communicating decision rationale in non-technical terms

### Q4: Which fairness metric should I use?

**A:** Choose based on the task context:

- **Loan approval**: Equal Opportunity (equal TPR) -- Qualified individuals are equally approved
- **Crime risk assessment**: Predictive Parity + equal FPR -- Do not unfairly treat innocent people
- **Hiring screening**: Demographic Parity -- Selection rates are equal across groups
- **Medical diagnosis**: Calibration -- Probabilistic predictions are accurate

Due to the impossibility theorem, all metrics cannot be satisfied simultaneously, so agree on priorities with stakeholders.

### Q5: How should a small team start with responsible AI?

**A:** Adopt it incrementally:

1. **Phase 1 (1 week)**: Create a model card template and apply it to existing models
2. **Phase 2 (2 weeks)**: Add explainability with SHAP
3. **Phase 3 (1 month)**: Measure group-specific metrics with Fairlearn
4. **Phase 4 (2 months)**: Integrate fairness tests into CI/CD
5. **Phase 5 (3 months)**: Start monitoring for bias in production

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not only through theory but also by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Area | Purpose | Key Methods | Example Tools |
|------|---------|-------------|---------------|
| Fairness | Bias detection and mitigation | SPD, DI, adversarial debiasing | Fairlearn, AIF360 |
| Explainability | Visualizing decision rationale | SHAP, LIME, PDP, Counterfactual | shap, lime, DiCE |
| Privacy | Protecting personal information | Differential privacy, federated learning | Opacus, PySyft |
| Transparency | Documenting model information | Model cards | model-card-toolkit |
| Safety | Preventing harmful outputs | Guardrails, red teaming | guardrails-ai, NeMo |
| Accountability | Ensuring auditability | Audit logs, lineage | MLflow |
| Governance | Organizational management structure | Audit checklists, policies | Custom implementation |

---

## Recommended Next Reads

- [AI Safety](../../../llm-and-ai-comparison/docs/04-ethics/00-ai-safety.md) — Alignment and red teaming in practice
- [AI Governance](../../../llm-and-ai-comparison/docs/04-ethics/01-ai-governance.md) — Trends in regulations and policies
- [MLOps](./02-mlops.md) — How to integrate responsible AI into production pipelines

---

## References

1. Mitchell, M. et al. (2019). "Model Cards for Model Reporting." *Proceedings of the Conference on Fairness, Accountability, and Transparency (FAT\* '19)*. ACM. https://doi.org/10.1145/3287560.3287596
2. Dwork, C. & Roth, A. (2014). "The Algorithmic Foundations of Differential Privacy." *Foundations and Trends in Theoretical Computer Science, 9*(3-4), 211-407. https://doi.org/10.1561/0400000042
3. Mehrabi, N. et al. (2021). "A Survey on Bias and Fairness in Machine Learning." *ACM Computing Surveys, 54*(6), 1-35. https://doi.org/10.1145/3457607
4. Chouldechova, A. (2017). "Fair prediction with disparate impact: A study of bias in recidivism prediction instruments." *Big Data, 5*(2), 153-163.
5. EU Artificial Intelligence Act (2024). European Parliament and Council Regulation on Artificial Intelligence. https://artificialintelligenceact.eu/
