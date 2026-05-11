# MLOps — Production Infrastructure for Machine Learning

> Systematically learn the engineering practices for continuously converting ML models into value, from experiment management to model deployment and production monitoring.

---

## What You Will Learn in This Chapter

1. **Experiment Management** — Techniques for recording parameters, metrics, and artifacts in a reproducible manner and sharing them across teams
2. **Model Deployment** — Containerization, serving patterns, and safe release strategies using CI/CD pipelines
3. **Production Monitoring** — Feedback loops that detect data drift and model degradation, and automate retraining triggers
4. **Feature Store** — Centralized management and reusability of features
5. **Infrastructure** — Usage patterns for Kubernetes and cloud managed services


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Computer Vision](./01-computer-vision.md)

---

## 1. Overview of MLOps

### 1.1 MLOps Maturity Model

```
+-------------------------------------------------------------------+
|  Level 0: Manual          All processes executed manually          |
|  Level 1: Pipeline        Training/evaluation via automated pipes  |
|  Level 2: CI/CD           Automated continuous training & deploy   |
|  Level 3: Full Loop       Fully automated monitor→retrain→deploy  |
+-------------------------------------------------------------------+
```

The details of each level and the elements required to reach them are shown below.

| Level | Characteristics | Required Tools/Practices | Team Size |
|-------|----------------|--------------------------|-----------|
| Level 0 | Manual experimentation in Jupyter Notebook, manual deployment | Git, manual testing | 1-2 people |
| Level 1 | Automation of training pipelines, experiment tracking | MLflow, DVC, Airflow | 3-5 people |
| Level 2 | Automated model testing and deployment via CI/CD | GitHub Actions, Docker, K8s | 5-10 people |
| Level 3 | Full loop of drift detection → auto-retraining → auto-deployment | Evidently, Kubeflow, Feature Store | 10+ people |

### 1.2 MLOps Lifecycle Overview

```
+----------+     +----------+     +----------+     +----------+
|  Data    | --> | Experiment| --> |  Deploy  | --> | Monitor  |
|  Collect/|     |  Manage/  |     |  Serving |     |  Drift   |
|  Preproc.|     |  Train    |     |  CI/CD   |     |  Detect  |
+----------+     +----------+     +----------+     +----------+
     ^                                                    |
     |              Feedback Loop                         |
     +----------------------------------------------------+
```

### 1.3 Comparison of DevOps and MLOps

| Aspect | DevOps | MLOps |
|--------|--------|-------|
| Version Control Target | Code | Code + Data + Model |
| Testing | Unit/Integration Tests | + Data Validation + Model Quality Tests |
| Deployment Target | Application | Model + Serving Infrastructure |
| Monitoring Target | Latency, Error Rate | + Data Drift, Model Degradation |
| Redeployment Trigger | Code Change | Code Change + Data Change + Accuracy Drop |
| Pipeline Complexity | Relatively Simple (Build → Test → Deploy) | Complex (Data Ingestion → Preprocessing → Training → Evaluation → Deployment → Monitoring) |
| Artifact Characteristics | Deterministic (Same Code = Same Result) | Probabilistic (Same Code but Results Vary by Data) |
| Rollback | Revert Code | Revert While Maintaining Consistency of Model + Data + Config |

### 1.4 MLOps Technology Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MLOps Platform                          │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│ Data Mgmt   │ Experiment  │ Model Mgmt  │ Production Ops    │
│             │ Management  │             │                   │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ DVC         │ MLflow      │ Model       │ Monitoring        │
│ LakeFS      │ W&B         │ Registry    │ (Evidently,       │
│ Delta Lake  │ Neptune     │ (MLflow,    │  Grafana,         │
│ Great       │ CometML     │  Vertex AI) │  Prometheus)      │
│ Expectations│             │             │                   │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ Feature     │ Pipelines   │ Serving     │ Feedback          │
│ Store       │             │             │                   │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│ Feast       │ Kubeflow    │ TF Serving  │ Auto Retrain      │
│ Tecton      │ Airflow     │ Triton      │ Pipeline          │
│ Hopsworks   │ Prefect     │ TorchServe  │ A/B Testing       │
│             │ Dagster     │ BentoML     │ Shadow Deploy     │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

---

## 2. Experiment Management

### 2.1 Experiment Tracking with MLflow

```python
# Code Example 1: Record experiments with MLflow
import mlflow
import mlflow.sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score

# Start an experiment
mlflow.set_experiment("churn-prediction-v2")

with mlflow.start_run(run_name="rf-baseline"):
    # Log hyperparameters
    params = {
        "n_estimators": 100,
        "max_depth": 10,
        "min_samples_split": 5,
        "random_state": 42
    }
    mlflow.log_params(params)

    # Train the model
    model = RandomForestClassifier(**params)
    model.fit(X_train, y_train)

    # Log metrics
    y_pred = model.predict(X_test)
    mlflow.log_metric("accuracy", accuracy_score(y_test, y_pred))
    mlflow.log_metric("f1_score", f1_score(y_test, y_pred))

    # Save the model as an artifact
    mlflow.sklearn.log_model(model, "model")

    # Save feature importance plot
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots()
    ax.barh(feature_names, model.feature_importances_)
    fig.savefig("feature_importance.png")
    mlflow.log_artifact("feature_importance.png")
```

### 2.2 Using the MLflow Model Registry

```python
# Code Example 2: Manage model lifecycle with MLflow Model Registry
import mlflow
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Register the model
model_name = "churn-prediction"
result = mlflow.register_model(
    model_uri=f"runs:/{run_id}/model",
    name=model_name
)

# Transition model stage
# None → Staging → Production → Archived
client.transition_model_version_stage(
    name=model_name,
    version=result.version,
    stage="Staging",
    archive_existing_versions=False
)

# Run tests in the Staging environment
staging_model = mlflow.pyfunc.load_model(
    model_uri=f"models:/{model_name}/Staging"
)
staging_predictions = staging_model.predict(X_staging_test)
staging_accuracy = accuracy_score(y_staging_test, staging_predictions)

print(f"Staging model accuracy: {staging_accuracy:.4f}")

# Promote to Production if accuracy exceeds threshold
if staging_accuracy >= 0.85:
    client.transition_model_version_stage(
        name=model_name,
        version=result.version,
        stage="Production",
        archive_existing_versions=True  # Archive old versions
    )
    print(f"Model v{result.version} promoted to Production")
else:
    print(f"Insufficient accuracy: {staging_accuracy:.4f} < 0.85")

# Add model metadata
client.update_model_version(
    name=model_name,
    version=result.version,
    description="RandomForest baseline with 100 estimators. "
                "Trained on 2024-01 data. F1=0.87"
)

# List all versions
for mv in client.search_model_versions(f"name='{model_name}'"):
    print(f"  v{mv.version}: stage={mv.current_stage}, "
          f"created={mv.creation_timestamp}")
```

### 2.3 Advanced Experiment Management with Weights & Biases (W&B)

```python
# Code Example 3: Run a hyperparameter sweep with W&B
import wandb
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score

# Sweep configuration
sweep_config = {
    "method": "bayes",  # Bayesian optimization
    "metric": {
        "name": "val_f1",
        "goal": "maximize"
    },
    "parameters": {
        "n_estimators": {"min": 50, "max": 500},
        "max_depth": {"values": [3, 5, 7, 10, 15]},
        "learning_rate": {"distribution": "log_uniform_values",
                          "min": 0.001, "max": 0.3},
        "subsample": {"min": 0.5, "max": 1.0},
        "min_samples_split": {"values": [2, 5, 10, 20]},
    }
}

def train_sweep():
    """Training function for W&B sweep"""
    with wandb.init() as run:
        config = wandb.config

        model = GradientBoostingClassifier(
            n_estimators=config.n_estimators,
            max_depth=config.max_depth,
            learning_rate=config.learning_rate,
            subsample=config.subsample,
            min_samples_split=config.min_samples_split,
            random_state=42
        )
        model.fit(X_train, y_train)

        # Validation metrics
        y_pred = model.predict(X_val)
        y_prob = model.predict_proba(X_val)[:, 1]

        wandb.log({
            "val_accuracy": accuracy_score(y_val, y_pred),
            "val_f1": f1_score(y_val, y_pred),
            "val_auc": roc_auc_score(y_val, y_prob),
        })

        # Feature importance table
        importance_table = wandb.Table(
            columns=["feature", "importance"],
            data=[[name, imp] for name, imp in
                  zip(feature_names, model.feature_importances_)]
        )
        wandb.log({"feature_importance": importance_table})

# Run the sweep
sweep_id = wandb.sweep(sweep_config, project="churn-prediction")
wandb.agent(sweep_id, function=train_sweep, count=50)  # 50 trials
```

### 2.4 Data Version Control with DVC

```bash
# Code Example 4: Version control data and models with DVC

# Initialization
dvc init
git add .dvc .dvcignore
git commit -m "Initialize DVC"

# Configure remote storage
dvc remote add -d myremote s3://my-bucket/dvc-store

# Add data files under DVC management
dvc add data/train.csv
git add data/train.csv.dvc data/.gitignore
git commit -m "Add training data v1"

# Define pipeline (dvc.yaml)
# stages:
#   preprocess:
#     cmd: python src/preprocess.py
#     deps: [data/train.csv, src/preprocess.py]
#     outs: [data/processed/]
#   train:
#     cmd: python src/train.py
#     deps: [data/processed/, src/train.py]
#     outs: [models/model.pkl]
#     metrics: [metrics.json]

# Run the pipeline
dvc repro

# Compare experiments
dvc metrics diff
```

### 2.5 Detailed DVC Pipeline Definition

```yaml
# Code Example 5: Complete pipeline definition in dvc.yaml
stages:
  data_validation:
    cmd: python src/validate_data.py
    deps:
      - data/raw/
      - src/validate_data.py
    outs:
      - reports/data_validation.html
    metrics:
      - metrics/data_quality.json:
          cache: false

  preprocess:
    cmd: python src/preprocess.py --config configs/preprocess.yaml
    deps:
      - data/raw/
      - src/preprocess.py
      - configs/preprocess.yaml
    params:
      - preprocess.normalize
      - preprocess.feature_selection
    outs:
      - data/processed/train.parquet
      - data/processed/test.parquet
      - artifacts/preprocessor.pkl

  feature_engineering:
    cmd: python src/feature_engineering.py
    deps:
      - data/processed/train.parquet
      - data/processed/test.parquet
      - src/feature_engineering.py
    outs:
      - data/features/train_features.parquet
      - data/features/test_features.parquet
    params:
      - features.window_sizes
      - features.aggregations

  train:
    cmd: python src/train.py --config configs/model.yaml
    deps:
      - data/features/train_features.parquet
      - src/train.py
      - configs/model.yaml
    params:
      - model.type
      - model.hyperparameters
    outs:
      - models/model.pkl
      - models/model_metadata.json
    metrics:
      - metrics/train_metrics.json:
          cache: false
    plots:
      - plots/training_curve.csv:
          x: epoch
          y: loss

  evaluate:
    cmd: python src/evaluate.py
    deps:
      - data/features/test_features.parquet
      - models/model.pkl
      - src/evaluate.py
    metrics:
      - metrics/eval_metrics.json:
          cache: false
    plots:
      - plots/confusion_matrix.csv:
          template: confusion
          x: predicted
          y: actual
      - plots/roc_curve.csv:
          x: fpr
          y: tpr
```

### 2.6 Experiment Management Tool Comparison

| Feature | MLflow | Weights & Biases | DVC | Neptune | CometML |
|---------|--------|-------------------|-----|---------|---------|
| Experiment Tracking | Yes | Yes | Yes | Yes | Yes |
| Model Registry | Yes | Yes | Partial | Yes | Yes |
| Data Version Control | Partial | Partial | Yes | Partial | Partial |
| Visualization Dashboard | Yes | Yes (Advanced) | Partial | Yes | Yes |
| Team Collaboration | Yes | Yes | Yes (Git Integration) | Yes | Yes |
| Self-Hosted | Yes | Partial (Paid) | Yes | Partial | Partial |
| Hyperparameter Search | Partial | Yes (Sweep) | Partial | Yes | Yes |
| Cost | Free (OSS) | Freemium | Free (OSS) | Freemium | Freemium |

---

## 3. Feature Store

### 3.1 Feature Store Concept

```
Role of a Feature Store:

  Data Sources          Feature Store                Consumers
  +----------+      +------------------+       +-----------+
  | DB       | ---> |                  | ----> | Training  |
  | Logs     |      | Feature          |       | Pipeline  |
  | API      | ---> | Definitions      | ----> +-----------+
  | Streams  |      | (Feature View)   |       | Inference |
  +----------+      |                  |       | Server    |
                    | Offline Store    |       +-----------+
                    | (Batch)          | ---->
                    |                  |
                    | Online Store     |  ← Low-Latency
                    | (Real-time)      |       Access
                    +------------------+

  Key Benefits:
  1. Shared feature definitions between training and serving (prevents Training-Serving Skew)
  2. Feature reuse (sharing across teams)
  3. Point-in-time joins (prevents data leakage)
  4. Automatic online/offline synchronization
```

### 3.2 Building a Feature Store with Feast

```python
# Code Example 6: Build a feature store with Feast
from feast import FeatureStore, Entity, Feature, FeatureView
from feast import FileSource, ValueType
from feast.types import Float32, Int64, String
from datetime import timedelta

# Define data source
customer_source = FileSource(
    path="data/customer_features.parquet",
    timestamp_field="event_timestamp",
    created_timestamp_column="created_timestamp",
)

# Define entity
customer = Entity(
    name="customer_id",
    value_type=ValueType.INT64,
    description="Unique identifier for a customer",
)

# Define feature view
customer_features = FeatureView(
    name="customer_features",
    entities=[customer],
    ttl=timedelta(days=90),  # Feature expiration period
    schema=[
        Feature(name="total_purchases", dtype=Int64),
        Feature(name="avg_order_value", dtype=Float32),
        Feature(name="days_since_last_purchase", dtype=Int64),
        Feature(name="login_count_30d", dtype=Int64),
        Feature(name="support_tickets_count", dtype=Int64),
        Feature(name="customer_segment", dtype=String),
    ],
    source=customer_source,
    online=True,
    tags={"team": "data-science", "version": "v2"},
)

# Initialize feature store
store = FeatureStore(repo_path="feature_repo/")

# Retrieve training data offline (point-in-time join)
import pandas as pd

entity_df = pd.DataFrame({
    "customer_id": [1001, 1002, 1003, 1004, 1005],
    "event_timestamp": pd.to_datetime([
        "2024-01-15", "2024-01-15", "2024-01-15",
        "2024-01-15", "2024-01-15"
    ]),
})

training_data = store.get_historical_features(
    entity_df=entity_df,
    features=[
        "customer_features:total_purchases",
        "customer_features:avg_order_value",
        "customer_features:days_since_last_purchase",
        "customer_features:login_count_30d",
    ],
).to_df()

print(f"Training data shape: {training_data.shape}")
print(training_data.head())

# Retrieve real-time features for online inference
online_features = store.get_online_features(
    features=[
        "customer_features:total_purchases",
        "customer_features:avg_order_value",
        "customer_features:days_since_last_purchase",
    ],
    entity_rows=[{"customer_id": 1001}],
).to_dict()

print(f"Real-time features: {online_features}")
```

---

## 4. Model Deployment

### 4.1 Serving Patterns

```
Pattern A: Batch Inference
+--------+     +----------+     +---------+     +--------+
| Data   | --> | Batch    | --> | Result  | --> | DB /   |
| Store  |     | Job      |     | Table   |     | Cache  |
+--------+     +----------+     +---------+     +--------+
                  (Scheduled)

Pattern B: Real-time Inference
+--------+     +-----------+     +--------+
| Client | --> | Inference | --> | Resp-  |
|        |     | API       |     | onse   |
+--------+     | (REST/gRPC)|    +--------+
               +-----------+
                  |
              +--------+
              | Model  |
              | Server |
              +--------+

Pattern C: Streaming Inference
+--------+     +--------+     +-----------+     +--------+
| Event  | --> | Kafka  | --> | Inference | --> | Output |
| Source |     | etc.   |     | Worker    |     | Topic  |
+--------+     +--------+     +-----------+     +--------+

Pattern D: Edge Inference
+--------+     +-----------+     +--------+
| Sensor | --> | Edge      | --> | Local  |
| Camera |     | Device    |     | Action |
+--------+     | (TFLite/  |     +--------+
               | ONNX)     |         |
               +-----------+         v
                                  Send Results
                                  to Cloud
```

### 4.2 Containerization and Serving

```python
# Code Example 7: Serve a model with FastAPI + Docker

# app/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import numpy as np
import logging
import time
from contextlib import asynccontextmanager
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Metrics definitions
REQUEST_COUNT = Counter(
    "prediction_requests_total",
    "Total prediction requests",
    ["status"]
)
REQUEST_LATENCY = Histogram(
    "prediction_request_latency_seconds",
    "Prediction request latency",
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# Model lifecycle management
model = None
model_metadata = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown handler"""
    global model, model_metadata
    logger.info("Loading model...")
    model = joblib.load("/app/models/model.pkl")
    model_metadata = {
        "model_name": "churn-prediction",
        "version": "v2.1",
        "trained_at": "2024-01-15T10:30:00Z",
        "features": ["feature_0", "feature_1", "feature_2"]
    }
    logger.info(f"Model loaded: {model_metadata['version']}")
    yield
    logger.info("Application shutting down")

app = FastAPI(
    title="Churn Prediction API",
    version="2.1.0",
    lifespan=lifespan
)

class PredictionRequest(BaseModel):
    features: list[float] = Field(
        ..., min_length=1,
        description="List of input features"
    )
    request_id: str = Field(
        default=None,
        description="Request tracking ID"
    )

class PredictionResponse(BaseModel):
    prediction: int
    probability: float
    model_version: str
    request_id: str = None
    latency_ms: float

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    start_time = time.time()

    try:
        X = np.array(request.features).reshape(1, -1)
        prediction = model.predict(X)[0]
        probability = model.predict_proba(X)[0].max()
        latency_ms = (time.time() - start_time) * 1000

        REQUEST_COUNT.labels(status="success").inc()
        REQUEST_LATENCY.observe(latency_ms / 1000)

        return PredictionResponse(
            prediction=int(prediction),
            probability=float(probability),
            model_version=model_metadata["version"],
            request_id=request.request_id,
            latency_ms=round(latency_ms, 2)
        )
    except Exception as e:
        REQUEST_COUNT.labels(status="error").inc()
        logger.error(f"Inference error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/batch")
async def predict_batch(requests: list[PredictionRequest]):
    """Batch inference endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    start_time = time.time()
    X = np.array([r.features for r in requests])
    predictions = model.predict(X)
    probabilities = model.predict_proba(X).max(axis=1)
    latency_ms = (time.time() - start_time) * 1000

    return {
        "predictions": [
            {
                "prediction": int(pred),
                "probability": float(prob),
                "request_id": req.request_id,
            }
            for pred, prob, req in zip(predictions, probabilities, requests)
        ],
        "total_latency_ms": round(latency_ms, 2),
        "count": len(requests),
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_version": model_metadata.get("version", "unknown"),
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

@app.get("/model/info")
async def model_info():
    """Return model metadata"""
    return model_metadata
```

```dockerfile
# Code Example 8: Multi-stage Dockerfile
# ---- Build Stage ----
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- Runtime Stage ----
FROM python:3.11-slim

# Security: Run as non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY models/ ./models/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "4", "--log-level", "info"]
```

### 4.3 Kubernetes Deployment

```yaml
# Code Example 9: Kubernetes manifests
apiVersion: apps/v1
kind: Deployment
metadata:
  name: churn-prediction-api
  labels:
    app: churn-prediction
    version: v2.1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: churn-prediction
  template:
    metadata:
      labels:
        app: churn-prediction
        version: v2.1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: churn-api
          image: myregistry/churn-api:v2.1
          ports:
            - containerPort: 8000
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          env:
            - name: MODEL_PATH
              value: "/app/models/model.pkl"
            - name: LOG_LEVEL
              value: "info"
---
apiVersion: v1
kind: Service
metadata:
  name: churn-prediction-service
spec:
  selector:
    app: churn-prediction
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: churn-prediction-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: churn-prediction-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: prediction_request_latency_seconds
        target:
          type: AverageValue
          averageValue: "200m"  # Scale out when exceeding 200ms
```

### 4.4 CI/CD Pipeline (GitHub Actions)

```yaml
# Code Example 10: .github/workflows/mlops-pipeline.yml
name: MLOps Pipeline

on:
  push:
    paths:
      - 'src/**'
      - 'data/**'
      - 'dvc.yaml'

jobs:
  data-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Pull DVC data
        run: dvc pull
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Validate data with Great Expectations
        run: python src/validate_data.py

  train-and-evaluate:
    needs: data-validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Pull DVC data
        run: dvc pull
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Run pipeline
        run: dvc repro

      - name: Evaluate model
        run: |
          python src/evaluate.py --threshold 0.85
          # Fail if accuracy is below threshold

      - name: Register model
        if: success()
        run: |
          python src/register_model.py \
            --model-name churn-prediction \
            --stage Production

      - name: Upload metrics as artifact
        uses: actions/upload-artifact@v4
        with:
          name: model-metrics
          path: metrics/

  deploy:
    needs: train-and-evaluate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t myregistry/churn-api:${{ github.sha }} .
          docker push myregistry/churn-api:${{ github.sha }}

      - name: Deploy to Kubernetes (Canary)
        run: |
          # Canary deploy: Route 10% of traffic to the new version
          kubectl set image deployment/churn-api-canary \
            churn-api=myregistry/churn-api:${{ github.sha }}

          # Monitor for 5 minutes
          sleep 300

          # Check metrics and decide on full rollout
          python src/check_canary_metrics.py

      - name: Full rollout
        if: success()
        run: |
          kubectl set image deployment/churn-api \
            churn-api=myregistry/churn-api:${{ github.sha }}
```

### 4.5 Model Packaging with BentoML

```python
# Code Example 11: Package a model with BentoML
import bentoml
from bentoml.io import JSON, NumpyNdarray
import numpy as np

# Save model to BentoML
saved_model = bentoml.sklearn.save_model(
    "churn_classifier",
    model,
    signatures={
        "predict": {"batchable": True, "batch_dim": 0},
        "predict_proba": {"batchable": True, "batch_dim": 0},
    },
    metadata={
        "accuracy": 0.92,
        "dataset_version": "v2.1",
        "training_date": "2024-01-15",
    },
    custom_objects={
        "preprocessor": preprocessor,
    }
)
print(f"Saved: {saved_model}")

# Define Bento service
runner = bentoml.sklearn.get("churn_classifier:latest").to_runner()
svc = bentoml.Service("churn_prediction_service", runners=[runner])

@svc.api(input=NumpyNdarray(), output=JSON())
async def predict(input_array: np.ndarray) -> dict:
    prediction = await runner.predict.async_run(input_array)
    probability = await runner.predict_proba.async_run(input_array)
    return {
        "prediction": prediction.tolist(),
        "probability": probability.max(axis=1).tolist(),
    }

# bentofile.yaml
"""
service: "service:svc"
include:
  - "*.py"
python:
  requirements_txt: "./requirements.txt"
docker:
  python_version: "3.11"
  distro: "debian"
"""

# Build and deploy
# bentoml build
# bentoml containerize churn_prediction_service:latest
```

---

## 5. Production Monitoring

### 5.1 Data Drift Detection

```python
# Code Example 12: Detect data drift with Evidently
from evidently.report import Report
from evidently.metric_preset import (
    DataDriftPreset, TargetDriftPreset,
    DataQualityPreset, ClassificationPreset
)
from evidently.metrics import (
    DataDriftTable, DatasetDriftMetric,
    ColumnDriftMetric, DatasetMissingValuesMetric
)
import pandas as pd

# Training data (reference) and production data (current)
reference_data = pd.read_csv("data/train.csv")
current_data = pd.read_csv("data/production_latest.csv")

# Generate a detailed drift report
report = Report(metrics=[
    DataDriftPreset(),
    TargetDriftPreset(),
    DataQualityPreset(),
    ColumnDriftMetric(column_name="age"),
    ColumnDriftMetric(column_name="income"),
    DatasetMissingValuesMetric(),
])
report.run(
    reference_data=reference_data,
    current_data=current_data
)

# Save as HTML report
report.save_html("drift_report.html")

# Retrieve results programmatically
result = report.as_dict()
drift_detected = result["metrics"][0]["result"]["dataset_drift"]
drift_share = result["metrics"][0]["result"]["share_of_drifted_columns"]

print(f"Dataset drift: {'Detected' if drift_detected else 'Not detected'}")
print(f"Share of drifted features: {drift_share:.1%}")

if drift_detected:
    print("WARNING: Data drift detected")
    # Get details of drifted features
    drifted_columns = [
        col for col, info in
        result["metrics"][0]["result"]["drift_by_columns"].items()
        if info["drift_detected"]
    ]
    print(f"Drifted features: {drifted_columns}")
    trigger_retraining_pipeline()
```

### 5.2 Real-time Monitoring with Evidently

```python
# Code Example 13: Build quality gates with Evidently test suites
from evidently.test_suite import TestSuite
from evidently.tests import (
    TestShareOfDriftedColumns,
    TestColumnDrift,
    TestMeanInNSigmas,
    TestShareOfMissingValues,
    TestNumberOfColumnsWithMissingValues,
    TestColumnShareOfMissingValues,
)

# Define test suite
test_suite = TestSuite(tests=[
    # Drift tests
    TestShareOfDriftedColumns(lt=0.3),  # Less than 30% of features drifted
    TestColumnDrift(column_name="age"),
    TestColumnDrift(column_name="income"),

    # Data quality tests
    TestShareOfMissingValues(lt=0.05),  # Missing rate below 5%
    TestColumnShareOfMissingValues(
        column_name="customer_id", eq=0  # customer_id must not be missing
    ),

    # Statistical tests
    TestMeanInNSigmas(column_name="age", n=3),  # Mean within 3 sigma
    TestMeanInNSigmas(column_name="income", n=3),
])

test_suite.run(
    reference_data=reference_data,
    current_data=current_data
)

# Evaluate results
test_results = test_suite.as_dict()
all_passed = all(
    test["status"] == "SUCCESS"
    for test in test_results["tests"]
)

if not all_passed:
    failed_tests = [
        test for test in test_results["tests"]
        if test["status"] == "FAIL"
    ]
    print(f"Number of failed tests: {len(failed_tests)}")
    for test in failed_tests:
        print(f"  - {test['name']}: {test['description']}")

    # Stop the CI/CD pipeline or fire an alert
    send_alert_to_slack(failed_tests)
```

### 5.3 Model Degradation Monitoring Dashboard

```python
# Code Example 14: Expose metrics for Prometheus + Grafana
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time
import numpy as np
from collections import deque

# Metrics definitions
PREDICTION_COUNT = Counter(
    'model_predictions_total',
    'Total number of predictions',
    ['model_version', 'prediction_class']
)
PREDICTION_LATENCY = Histogram(
    'model_prediction_latency_seconds',
    'Prediction latency in seconds',
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0]
)
MODEL_ACCURACY = Gauge(
    'model_accuracy_rolling',
    'Rolling accuracy over last N predictions'
)
DATA_DRIFT_SCORE = Gauge(
    'data_drift_score',
    'Data drift score (0=no drift, 1=full drift)',
    ['feature_name']
)
FEATURE_DISTRIBUTION = Histogram(
    'feature_distribution',
    'Distribution of input features',
    ['feature_name'],
    buckets=[-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]
)

# Start metrics server (port 8001)
start_http_server(8001)

# Track accuracy with a rolling window
class RollingAccuracyTracker:
    def __init__(self, window_size=1000):
        self.predictions = deque(maxlen=window_size)
        self.actuals = deque(maxlen=window_size)

    def update(self, prediction, actual):
        self.predictions.append(prediction)
        self.actuals.append(actual)
        if len(self.predictions) >= 100:  # Calculate with at least 100 samples
            accuracy = np.mean(
                np.array(list(self.predictions)) == np.array(list(self.actuals))
            )
            MODEL_ACCURACY.set(accuracy)

tracker = RollingAccuracyTracker(window_size=1000)

def predict_with_monitoring(model, features, model_version="v1.0"):
    start_time = time.time()

    prediction = model.predict(features)

    # Record latency
    latency = time.time() - start_time
    PREDICTION_LATENCY.observe(latency)

    # Record prediction count
    PREDICTION_COUNT.labels(
        model_version=model_version,
        prediction_class=str(prediction)
    ).inc()

    # Record feature distributions
    for i, feature_name in enumerate(feature_names):
        FEATURE_DISTRIBUTION.labels(
            feature_name=feature_name
        ).observe(float(features[0][i]))

    return prediction
```

### 5.4 Automatic Retraining Pipeline

```python
# Code Example 15: Pipeline from drift detection to automatic retraining
import schedule
import time
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class AutoRetrainingPipeline:
    """Drift detection-based automatic retraining pipeline"""

    def __init__(self, config):
        self.config = config
        self.last_retrain_date = None
        self.consecutive_drift_count = 0

    def check_and_retrain(self):
        """Periodically detect drift and retrain if necessary"""
        logger.info(f"Drift check started: {datetime.now()}")

        # 1. Fetch recent production data
        current_data = self.fetch_production_data(
            since=datetime.now() - timedelta(days=1)
        )

        # 2. Detect drift
        drift_result = self.detect_drift(current_data)

        if drift_result["drift_detected"]:
            self.consecutive_drift_count += 1
            logger.warning(
                f"Drift detected (consecutive count: {self.consecutive_drift_count}): "
                f"Drifted features={drift_result['drifted_features']}"
            )

            # 3. Trigger retraining if threshold exceeded consecutively
            if self.consecutive_drift_count >= self.config["retrain_threshold"]:
                logger.info("Triggering automatic retraining")
                self.trigger_retraining()
                self.consecutive_drift_count = 0
        else:
            self.consecutive_drift_count = 0
            logger.info("No drift detected")

        # 4. Accuracy-based check
        if drift_result.get("accuracy_below_threshold", False):
            logger.warning(
                f"Accuracy degradation detected: {drift_result['current_accuracy']:.4f} "
                f"< {self.config['accuracy_threshold']}"
            )
            self.trigger_retraining()

    def trigger_retraining(self):
        """Execute the retraining pipeline"""
        logger.info("Starting retraining pipeline")

        # Trigger Kubeflow Pipeline
        import kfp
        client = kfp.Client(host=self.config["kubeflow_host"])
        run = client.create_run_from_pipeline_func(
            self.retrain_pipeline,
            arguments={
                "data_start_date": (
                    datetime.now() - timedelta(days=90)
                ).strftime("%Y-%m-%d"),
                "data_end_date": datetime.now().strftime("%Y-%m-%d"),
                "model_name": self.config["model_name"],
            },
        )
        logger.info(f"Retraining job started: run_id={run.run_id}")
        self.last_retrain_date = datetime.now()

    def fetch_production_data(self, since):
        """Fetch recent data from the production database"""
        import pandas as pd
        query = f"""
        SELECT * FROM predictions
        WHERE created_at >= '{since.isoformat()}'
        ORDER BY created_at DESC
        LIMIT 10000
        """
        return pd.read_sql(query, self.config["db_connection"])

    def detect_drift(self, current_data):
        """Execute drift detection"""
        from evidently.report import Report
        from evidently.metric_preset import DataDriftPreset

        report = Report(metrics=[DataDriftPreset()])
        report.run(
            reference_data=self.reference_data,
            current_data=current_data
        )
        result = report.as_dict()
        return {
            "drift_detected": result["metrics"][0]["result"]["dataset_drift"],
            "drifted_features": [
                col for col, info in
                result["metrics"][0]["result"]["drift_by_columns"].items()
                if info["drift_detected"]
            ],
            "drift_share": result["metrics"][0]["result"]["share_of_drifted_columns"],
        }

# Schedule periodic execution
pipeline = AutoRetrainingPipeline(config={
    "retrain_threshold": 3,  # Retrain after 3 consecutive drift detections
    "accuracy_threshold": 0.85,
    "model_name": "churn-prediction",
    "kubeflow_host": "https://kubeflow.example.com",
    "db_connection": "postgresql://...",
})

# Run drift check daily at 9:00 AM
schedule.every().day.at("09:00").do(pipeline.check_and_retrain)

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## 6. Data Validation and Testing

### 6.1 Data Validation with Great Expectations

```python
# Code Example 16: Build data quality gates with Great Expectations
import great_expectations as gx

# Initialize data context
context = gx.get_context()

# Configure data source
datasource = context.sources.add_pandas("my_datasource")
data_asset = datasource.add_dataframe_asset("training_data")

# Define Expectation Suite
suite = context.add_expectation_suite("training_data_quality")

# Add expectations
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToNotBeNull(column="customer_id")
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="age", min_value=0, max_value=150
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="income", min_value=0, max_value=10000000
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeInSet(
        column="gender", value_set=["M", "F", "Other", "Unknown"]
    )
)
suite.add_expectation(
    gx.expectations.ExpectTableRowCountToBeBetween(
        min_value=1000, max_value=10000000
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnProportionOfUniqueValuesToBeBetween(
        column="customer_id", min_value=0.99, max_value=1.0
    )
)

# Run validation
batch_request = data_asset.build_batch_request(dataframe=training_df)
results = context.run_validation_operator(
    "action_list_operator",
    assets_to_validate=[batch_request],
)

if not results["success"]:
    failed = [r for r in results["results"] if not r["success"]]
    print(f"Data validation failed: {len(failed)} issues")
    for f in failed:
        print(f"  - {f['expectation_config']['expectation_type']}: "
              f"{f['result']['unexpected_count']} violations")
    raise ValueError("Data quality standards not met")
```

### 6.2 Model Testing Strategy

```python
# Code Example 17: Comprehensive ML model testing
import pytest
import numpy as np
import joblib
from sklearn.metrics import accuracy_score, f1_score

class TestModelQuality:
    """Test suite for verifying model quality"""

    @pytest.fixture
    def model(self):
        return joblib.load("models/model.pkl")

    @pytest.fixture
    def test_data(self):
        import pandas as pd
        df = pd.read_csv("data/test.csv")
        X = df.drop("target", axis=1)
        y = df["target"]
        return X, y

    def test_minimum_accuracy(self, model, test_data):
        """Verify minimum accuracy"""
        X, y = test_data
        y_pred = model.predict(X)
        accuracy = accuracy_score(y, y_pred)
        assert accuracy >= 0.85, f"Accuracy below threshold: {accuracy:.4f} < 0.85"

    def test_minimum_f1_score(self, model, test_data):
        """Verify minimum F1 score"""
        X, y = test_data
        y_pred = model.predict(X)
        f1 = f1_score(y, y_pred, average="weighted")
        assert f1 >= 0.80, f"F1 below threshold: {f1:.4f} < 0.80"

    def test_no_data_leakage(self, model, test_data):
        """Verify accuracy is not suspiciously high on test data"""
        X, y = test_data
        y_pred = model.predict(X)
        accuracy = accuracy_score(y, y_pred)
        assert accuracy < 0.99, f"Accuracy too high (suspected data leakage): {accuracy:.4f}"

    def test_prediction_latency(self, model, test_data):
        """Verify inference latency"""
        import time
        X, y = test_data

        start = time.time()
        for _ in range(100):
            model.predict(single_sample)
        avg_latency = (time.time() - start) / 100

        assert avg_latency < 0.01, f"Inference too slow: {avg_latency:.4f}s > 0.01s"

    def test_fairness_across_groups(self, model, test_data):
        """Verify fairness across groups"""
        X, y = test_data
        y_pred = model.predict(X)

        # Check accuracy by group (e.g., gender)
        if "gender" in X.columns:
            for group in X["gender"].unique():
                mask = X["gender"] == group
                group_acc = accuracy_score(y[mask], y_pred[mask])
                assert group_acc >= 0.75, (
                    f"Accuracy too low for group '{group}': {group_acc:.4f}"
                )

    def test_model_robustness(self, model, test_data):
        """Verify robustness against noise"""
        X, y = test_data
        baseline_pred = model.predict(X)

        # Add small noise
        noise = np.random.normal(0, 0.01, X.shape)
        X_noisy = X + noise
        noisy_pred = model.predict(X_noisy)

        # Verify prediction stability
        stability = np.mean(baseline_pred == noisy_pred)
        assert stability >= 0.95, (
            f"Low stability against noise: {stability:.4f} < 0.95"
        )

    def test_prediction_distribution(self, model, test_data):
        """Verify prediction distribution is within expected range"""
        X, y = test_data
        y_pred = model.predict(X)

        # Check prediction ratio for each class
        for cls in np.unique(y):
            pred_rate = np.mean(y_pred == cls)
            true_rate = np.mean(y == cls)
            assert abs(pred_rate - true_rate) < 0.2, (
                f"Prediction rate for class {cls} significantly diverges: "
                f"predicted={pred_rate:.3f}, actual={true_rate:.3f}"
            )
```

---

## 7. A/B Testing and Canary Deployment

### 7.1 A/B Testing Implementation for Models

```python
# Code Example 18: Traffic splitting with Istio
"""
# Split traffic with Istio VirtualService

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: churn-prediction-vs
spec:
  hosts:
    - churn-prediction
  http:
    - match:
        - headers:
            x-model-version:
              exact: "v2"
      route:
        - destination:
            host: churn-prediction
            subset: v2
    - route:
        - destination:
            host: churn-prediction
            subset: v1
          weight: 90
        - destination:
            host: churn-prediction
            subset: v2
          weight: 10
"""

# Statistical evaluation of A/B tests
import numpy as np
from scipy import stats

class ABTestAnalyzer:
    """Statistical analysis of model A/B tests"""

    def __init__(self, alpha=0.05, min_sample_size=1000):
        self.alpha = alpha
        self.min_sample_size = min_sample_size

    def calculate_sample_size(self, baseline_rate, mde, alpha=0.05, power=0.8):
        """
        Calculate the required sample size.
        mde: Minimum Detectable Effect
        """
        from statsmodels.stats.power import NormalIndPower
        analysis = NormalIndPower()
        effect_size = mde / np.sqrt(baseline_rate * (1 - baseline_rate))
        sample_size = analysis.solve_power(
            effect_size=effect_size,
            alpha=alpha,
            power=power,
            alternative="two-sided"
        )
        return int(np.ceil(sample_size))

    def analyze(self, control_conversions, control_total,
                treatment_conversions, treatment_total):
        """Analyze A/B test results"""
        control_rate = control_conversions / control_total
        treatment_rate = treatment_conversions / treatment_total

        # Z-test
        pooled_rate = (control_conversions + treatment_conversions) / \
                      (control_total + treatment_total)
        se = np.sqrt(pooled_rate * (1 - pooled_rate) *
                     (1/control_total + 1/treatment_total))
        z_stat = (treatment_rate - control_rate) / se
        p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))

        # Effect size
        lift = (treatment_rate - control_rate) / control_rate

        # Confidence interval
        ci_95 = stats.norm.interval(
            0.95,
            loc=treatment_rate - control_rate,
            scale=se
        )

        return {
            "control_rate": control_rate,
            "treatment_rate": treatment_rate,
            "lift": lift,
            "lift_pct": f"{lift:.2%}",
            "p_value": p_value,
            "significant": p_value < self.alpha,
            "confidence_interval_95": ci_95,
            "recommendation": (
                "Adopt treatment" if p_value < self.alpha and lift > 0
                else "Keep control"
            ),
        }

# Usage example
analyzer = ABTestAnalyzer(alpha=0.05)

# Calculate required sample size
n = analyzer.calculate_sample_size(
    baseline_rate=0.05,  # Baseline conversion rate of 5%
    mde=0.005,           # Want to detect a 0.5% improvement
)
print(f"Required sample size (per group): {n:,}")

# Analyze A/B test results
result = analyzer.analyze(
    control_conversions=520, control_total=10000,   # Old model
    treatment_conversions=580, treatment_total=10000  # New model
)
print(f"Control rate: {result['control_rate']:.4f}")
print(f"Treatment rate: {result['treatment_rate']:.4f}")
print(f"Lift: {result['lift_pct']}")
print(f"P-value: {result['p_value']:.4f}")
print(f"Statistically significant: {result['significant']}")
print(f"Recommendation: {result['recommendation']}")
```

---

## 8. Anti-patterns

### Anti-pattern 1: "Deploying Notebooks to Production"

```
[Wrong] Running Jupyter Notebooks directly in production via cron

Problems:
- No reproducibility (dependent on cell execution order, global variable pollution)
- Cannot be tested
- Difficult to version control (JSON diffs are unreadable)
- Insufficient error handling
- Risk of memory leaks

[Correct] Limit notebooks to exploration/prototyping purposes,
         and convert production code to .py modules

  notebook (exploration) --> Python modules --> tests --> pipeline --> deploy

Concrete migration steps:
  1. Split notebook code into functions/classes
  2. Extract configuration values to external files (YAML/JSON)
  3. Add unit tests
  4. Add logging and error handling
  5. Create a CLI interface (argparse/click)
  6. Integrate into CI/CD pipeline
```

### Anti-pattern 2: "Deploy and Forget"

```
[Wrong] Deploying a model once and leaving it unmonitored

Problems that actually occur:
1. Data drift: User behavior changes, causing divergence from training distribution
2. Concept drift: The definition of the prediction target itself changes
3. Silent degradation: No errors but accuracy gradually declines
4. Seasonality: Input patterns change during holidays and sale periods

  Accuracy at deploy: 92% --> After 3 months: 85% --> After 6 months: 72%
  (Degradation goes unnoticed)

[Correct] Build a feedback loop with monitoring + automatic retraining
  - Periodic drift detection
  - Set accuracy thresholds and alert when breached
  - Trigger automatic retraining pipeline
```

### Anti-pattern 3: "Training-Serving Skew"

```
[Wrong] Applying different preprocessing at training time vs. inference time

Concrete examples:
  Training: StandardScaler → model.fit(scaled_data)
  Inference: MinMaxScaler → model.predict(scaled_data)  # Different scaler!

  Training: Used features A, B, C, D
  Inference: Used features A, B, C (forgot D)

  Training: Python 3.10 + pandas 1.5
  Inference: Python 3.11 + pandas 2.0 (subtly different behavior)

[Correct]
  1. Save preprocessing together with the model (sklearn Pipeline, preprocessor pickle)
  2. Unify feature definitions with a feature store
  3. Lock runtime environment with Docker images
  4. Verify training/inference consistency with tests
```

### Anti-pattern 4: "Deploying Large Models Without Planning"

```
[Wrong] Deploying a 10GB model directly to an inference API

Problems:
- Cold start takes several minutes
- Enormous memory usage
- Scale-out costs are high
- Latency doesn't meet requirements

[Correct] Optimize the model before deploying
  - Quantization (INT8/FP16): 50-75% size reduction, 2-4x speed improvement
  - Pruning: Remove unnecessary parameters
  - Distillation: Transfer knowledge to a smaller model
  - ONNX conversion: Benefit from framework optimizations
  - Batch inference: Process in bulk when real-time is not required
```

---

## 9. FAQ

### Q1: Is MLOps necessary even for small teams?

**A:** Yes, but it is important to raise the maturity level gradually. At minimum, we recommend the following:

- **Moving beyond Level 0**: Record experiments with MLflow or similar (can be set up in a few hours)
- **Data version control**: Manage training data with DVC
- **Model registry**: Track which model is in production

For small teams, reaching Level 1 (pipeline automation) is often sufficient.

**Recommended gradual adoption roadmap:**

| Period | Action | Effort |
|--------|--------|--------|
| Week 1 | Introduce MLflow, start recording experiments | 4 hours |
| Week 2 | Data version control with DVC | 8 hours |
| Month 1 | Containerize the model with Docker | 16 hours |
| Month 2 | Automated testing and deployment with CI/CD | 24 hours |
| Month 3 | Drift monitoring with Evidently | 16 hours |

### Q2: How should I implement A/B testing for models?

**A:** Common approaches are as follows:

1. **Traffic splitting**: Split traffic using a load balancer or service mesh (e.g., Istio)
2. **Shadow mode**: Send a copy of production traffic to the new model, recording results only (no impact on users)
3. **Canary release**: Gradually increase the traffic ratio (5% -> 25% -> 50% -> 100%)

Continue the test until a statistically significant difference is confirmed, and make decisions based on metrics (accuracy, business KPIs).

### Q3: How can I optimize GPU server costs?

**A:** The following strategies are effective:

- **Spot instances**: Use spot/preemptible instances for training jobs (up to 90% cost reduction)
- **Auto-scaling**: Scale inference servers in/out based on traffic
- **Model optimization**: Reduce inference costs with quantization (INT8), distillation, and pruning
- **Batch inference**: Improve GPU utilization with batch processing when real-time is not required
- **Multi-tenancy**: Maximize GPU utilization with NVIDIA Triton's Dynamic Batching
- **Serverless GPU**: Pay only for what you use with Modal, RunPod, and other serverless GPU services

### Q4: Should I build MLOps on-premises or in the cloud?

**A:** The decision criteria are as follows:

| Aspect | On-premises | Cloud |
|--------|-------------|-------|
| Initial Cost | High (GPU purchase) | Low (pay-per-use) |
| Operational Cost | Low (long-term operation) | Usage-dependent |
| Scalability | Limited | High |
| Data Security | Full control | Shared responsibility |
| Time to Launch | Slow | Fast |

For most teams, "start in the cloud and move to hybrid as you scale" is the most practical approach.

### Q5: Should I build an MLOps platform from scratch?

**A:** Generally, we recommend leveraging managed services. Building from scratch has high operational costs and consumes resources that should be devoted to actual ML development.

- **AWS**: SageMaker (integrated training and deployment)
- **GCP**: Vertex AI (AutoML + custom models)
- **Azure**: Azure ML (enterprise integration)
- **OSS**: Combination of Kubeflow + MLflow + Feast

---


## FAQ

### Q1: What is the most important point when learning this topic?

Building practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What common mistakes do beginners make?

Skipping the basics and jumping straight to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in daily development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Category | Key Point | Representative Tools |
|----------|-----------|---------------------|
| Experiment Management | Record parameters, metrics, and artifacts | MLflow, W&B |
| Data Management | Data version control and reproducibility | DVC, LakeFS |
| Data Validation | Automated data quality gates | Great Expectations, Evidently |
| Feature Store | Centralized feature management and reuse | Feast, Tecton |
| Model Registry | Model lifecycle management | MLflow, Vertex AI |
| Pipelines | Automation of training and evaluation | Kubeflow, Airflow, Dagster |
| Serving | Real-time/batch inference delivery | TF Serving, Triton, BentoML |
| CI/CD | Continuous model deployment | GitHub Actions, Jenkins |
| Monitoring | Drift detection and accuracy monitoring | Evidently, Grafana |
| Feedback | Automatic retraining triggers | Kubeflow Pipelines |

---

## Recommended Next Guides

- [Responsible AI](./03-responsible-ai.md) — Implementing fairness, explainability, and privacy
- Data Preprocessing and Feature Engineering — Preprocessing design for MLOps pipelines
- System Design Guide — Design principles for MLOps infrastructure

---

## References

1. Sculley, D. et al. (2015). "Hidden Technical Debt in Machine Learning Systems." *Advances in Neural Information Processing Systems 28 (NIPS 2015)*. Google. https://papers.nips.cc/paper/5656-hidden-technical-debt-in-machine-learning-systems
2. Google Cloud. (2023). "MLOps: Continuous delivery and automation pipelines in machine learning." *Google Cloud Architecture Center*. https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning
3. Kreuzberger, D., Kuhl, N., & Hirschl, S. (2023). "Machine Learning Operations (MLOps): Overview, Definition, and Architecture." *IEEE Access, 11*, 31866-31879. https://ieeexplore.ieee.org/document/10081336
4. Breck, E. et al. (2019). "Data Validation for Machine Learning." *MLSys 2019*. Google. https://mlsys.org/Conferences/2019/doc/2019/167.pdf
5. Polyzotis, N. et al. (2019). "Data Lifecycle Challenges in Production Machine Learning." *SIGMOD Record, 47*(2). https://doi.org/10.1145/3299887.3299891
