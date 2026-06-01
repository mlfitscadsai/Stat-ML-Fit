# Feature Roadmap — Stat-ML-Fit v2.0

This document proposes new features organized by category and impact. Each entry describes what to build, why it matters, and the technical approach that fits the existing stack (Pyodide + scikit-learn in-browser, Vue 3, Plotly, DanfoJS).

---

## Priority Legend
- **P1** — High impact, directly improves core ML workflow
- **P2** — Significant value addition, extends current capabilities
- **P3** — Nice-to-have, polish and advanced use cases

---

## 1. Model Explainability

### F-01 · SHAP Value Visualization `P1`
**What:** Replace the current Permutation Feature Importance (PFI) with SHAP (SHapley Additive exPlanations) summary plots, beeswarm plots, and waterfall plots for individual predictions.

**Why it matters:** PFI only shows global importance. SHAP explains *why* a specific prediction was made, which is essential for any real-world use case (medical, financial, scientific).

**Technical approach:**
- Use `shap` package via `micropip.install('shap')` inside the Pyodide worker
- Add SHAP summary plot (beeswarm) and dependency plots alongside existing PFI plots
- For classification: SHAP class-specific breakdowns
- For regression: waterfall chart for individual sample explanation

---

### F-02 · LIME Explanations for Individual Predictions `P1`
**What:** Add a row-level explanation panel — user selects a row from the predictions table, clicks "Explain", and gets a LIME (Local Interpretable Model-agnostic Explanations) bar chart showing which features pushed the prediction up or down.

**Why it matters:** Complements SHAP with a simpler, model-agnostic local explanation. Useful for showing non-technical stakeholders why a single prediction was made.

**Technical approach:**
- `micropip.install('lime')` in Pyodide worker
- Predictions table gets an "Explain this row" button per row
- Renders a horizontal bar chart via Plotly showing feature contributions

---

### F-03 · Partial Dependence Plot (PDP) + Individual Conditional Expectation (ICE) `P2`
**What:** Extend the existing PDP bar charts to proper 1D/2D continuous PDP lines, and overlay ICE curves to show heterogeneity in effect across individuals.

**Why it matters:** The current PDP implementation only handles the main effect. ICE reveals when a feature behaves differently for different data subgroups — a key insight for understanding non-linear models.

**Technical approach:**
- Use `sklearn.inspection.partial_dependence` in Pyodide
- Plotly line traces for each ICE curve (alpha 0.1) with a bold mean line for PDP
- Feature selector dropdown to pick which feature to profile

---

## 2. Unsupervised Learning

### F-04 · Clustering Algorithms Tab `P1`
**What:** Add a dedicated Clustering section with K-Means, DBSCAN, and Agglomerative Clustering. Show: cluster assignments in a 2D scatter (via PCA projection), silhouette score, Davies-Bouldin index, and cluster size distribution.

**Why it matters:** The platform currently does dimensionality reduction but has no clustering. Clustering is one of the most common unsupervised tasks in data science, and the existing PCA/t-SNE visualizations are a natural pair with it.

**Technical approach:**
- `from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering` in Pyodide
- New Vue tab in the dimensionality reduction section (or a separate "Unsupervised" tab)
- Elbow method chart for K-Means (inertia vs k)
- Silhouette plot per cluster
- Show clusters colored in the existing PCA/t-SNE 2D scatter

---

### F-05 · Anomaly Detection `P2`
**What:** Add Isolation Forest and Local Outlier Factor (LOF) to flag anomalous rows in the dataset. Highlight detected outliers in the scatterplot matrix and provide a downloadable list of outlier row indices.

**Why it matters:** Outliers distort all downstream models. Currently the platform has no outlier detection — users may not know their data is skewed before fitting. This makes the data analysis tab significantly more actionable.

**Technical approach:**
- `sklearn.ensemble.IsolationForest` and `sklearn.neighbors.LocalOutlierFactor` via Pyodide
- Anomaly toggle overlay on the existing SPLOM (scatterplot matrix)
- Contamination parameter slider (0.01–0.20)
- Detected outlier rows highlighted in red in the sample data table

---

### F-06 · Association Rule Mining `P3`
**What:** For datasets with categorical/binary features, add an Apriori/FP-Growth rule mining section showing support, confidence, and lift for discovered rules in a sortable table.

**Why it matters:** Common in retail, medical, and survey data but unavailable in any similar browser-based tool.

**Technical approach:**
- `micropip.install('mlxtend')` in Pyodide worker
- Rule table with sortable columns: antecedent → consequent, support, confidence, lift
- Minimum support and confidence sliders

---

## 3. Statistical Analysis

### F-07 · Feature Significance Tests `P1`
**What:** In the Data Analysis tab, add a statistical testing panel showing:
- Pearson/Spearman correlation with p-values for numerical features vs target
- ANOVA F-test (classification) or t-test for feature groups
- Chi-square test for categorical features vs target

**Why it matters:** The current correlation matrix shows correlation strength but not significance. Users currently have no way to distinguish noise correlations from real ones.

**Technical approach:**
- `scipy.stats` in Pyodide (already in Pyodide full distribution)
- Table showing each feature with: test statistic, p-value, significance flag (★ p<0.05, ★★ p<0.01, ★★★ p<0.001)
- Sorted by p-value ascending

---

### F-08 · Distribution Fitting `P2`
**What:** When a user clicks a numerical feature in the Data Analysis tab, fit and overlay common distributions (Normal, Log-Normal, Exponential, Gamma) on the KDE plot and report the best-fitting distribution by AIC/BIC.

**Why it matters:** Understanding the distribution of each feature is fundamental for choosing the right model (e.g., log-transform before linear regression, choosing the right GLM family).

**Technical approach:**
- `scipy.stats.fit` for distribution fitting in Pyodide
- Overlay fitted PDFs on existing KDE plots
- Table: distribution name, parameters, AIC, BIC — best fit highlighted

---

### F-09 · Multicollinearity Report — VIF `P2`
**What:** Add a Variance Inflation Factor (VIF) table to the Data Analysis tab. Flag features with VIF > 5 or > 10 as warnings before model fitting.

**Why it matters:** Multicollinearity inflates coefficient standard errors in linear models and makes feature importance unreliable. No existing tool in the platform detects this.

**Technical approach:**
- `statsmodels.stats.outliers_influence.variance_inflation_factor` via Pyodide
- Color-coded table: green (VIF < 5), orange (5–10), red (> 10)
- Warning toast before fitting if any VIF > 10

---

## 4. Model Training & Evaluation

### F-10 · Learning Curves `P1`
**What:** For any fitted model, add a "Learning Curve" button that shows training score and cross-validation score as a function of training set size, helping diagnose underfitting vs overfitting.

**Why it matters:** Currently the platform shows only the final evaluation metric. Learning curves reveal whether adding more data would help — critical for research and production decisions.

**Technical approach:**
- `sklearn.model_selection.learning_curve` in Pyodide
- Plotly line chart with shaded standard deviation bands
- Training score (blue), CV score (orange), gap labeled

---

### F-11 · Cross-Validation Fold Breakdown `P1`
**What:** When K-Fold CV is selected, show per-fold metrics (accuracy/R²/MSE) as a boxplot or strip plot, not just the mean. Show which folds diverge from the average.

**Why it matters:** The current K-Fold implementation only shows a mean metric. A single outlier fold (e.g., class imbalance in one fold) is invisible. Fold-level insight is fundamental for rigorous evaluation.

**Technical approach:**
- Return per-fold scores from the `cross_val_score` call in Pyodide
- Plotly box + strip plot (jittered dots per fold) alongside the current summary metric
- Tooltip shows fold number on hover

---

### F-12 · Class Imbalance Handling `P1`
**What:** Add resampling strategies to the sidebar for classification tasks:
- SMOTE (Synthetic Minority Oversampling)
- Random Oversampling
- Random Undersampling
- Class weights (already partially supported — expose in UI)

**Why it matters:** The bundled Titanic and real-world datasets are commonly imbalanced. Without resampling, models are biased toward the majority class. This is one of the most frequent pain points for classification beginners.

**Technical approach:**
- `micropip.install('imbalanced-learn')` in Pyodide worker
- New "Class Balance" dropdown in the sidebar (currently only shows raw class distribution)
- Before/after class distribution bar chart

---

### F-13 · Calibration Curves (Reliability Diagrams) `P2`
**What:** For classification models that output probabilities, add a calibration curve (reliability diagram) showing whether predicted probabilities match observed frequencies, with Brier score.

**Why it matters:** A model that says 80% confidence should be right 80% of the time. Bad calibration is common in tree-based models and SVMs. Currently the platform shows ROC and probability boxplots but not calibration.

**Technical approach:**
- `sklearn.calibration.calibration_curve` in Pyodide
- Plotly line chart: predicted probability (x) vs fraction of positives (y)
- Perfectly calibrated diagonal reference line
- Brier score displayed as a metric

---

### F-14 · Hyperparameter Search Visualization `P2`
**What:** Add an optional Grid Search / Random Search step before fitting. Show a heatmap (2-parameter grid) or parallel coordinates plot of parameter combinations vs validation score.

**Why it matters:** Currently all hyperparameters are manually set. Users have no way to find optimal values. This is one of the most requested features in any ML tool.

**Technical approach:**
- `sklearn.model_selection.GridSearchCV` / `RandomizedSearchCV` in Pyodide
- Define search spaces per model in `settings.js`
- Plotly heatmap for 2-parameter grids, line chart for single-parameter sweeps
- Auto-fills the best parameters back into the sidebar inputs

---

## 5. Data Preparation

### F-15 · Interactive Outlier Removal `P1`
**What:** In the scatterplot matrix, allow users to lasso-select outlier points and exclude them from analysis. Show the count of excluded rows in the sidebar with an undo option.

**Why it matters:** Currently there is no way to remove outliers through the UI. Users must clean data externally and re-upload. Interactive outlier removal dramatically speeds up the exploratory workflow.

**Technical approach:**
- Plotly's `selectedpoints` callback on the SPLOM component
- Selected point indices stored in Pinia store with exclusion flag
- All downstream models filter out excluded row indices

---

### F-16 · Feature Engineering Panel `P2`
**What:** Add a "Create Feature" interface that lets users define new derived columns:
- Ratio: feature A / feature B
- Interaction: feature A × feature B
- Log: ln(feature)
- Bin: cut a continuous feature into N quantile buckets

**Why it matters:** Feature engineering is often more impactful than model selection. Providing even basic transformations reduces the need for external preprocessing tools.

**Technical approach:**
- New collapsible panel in the sidebar between "Features" and "Scale"
- New derived columns appear in the feature list marked with a ⊕ symbol
- Stored in Pinia store as transformation rules applied at fit time

---

### F-17 · Time Series Detection & Basic Decomposition `P3`
**What:** If a dataset contains a datetime column, auto-detect it and offer:
- Time series plot of the target variable
- Seasonal decomposition (trend, seasonality, residuals)
- Lagged feature creation (lag 1, 2, 3, …, N)

**Why it matters:** Time series is a common data type with no support in the current platform. Even basic support (decomposition + lag features fed into existing regression models) would cover a large class of problems.

**Technical approach:**
- Datetime column detection in the parser
- `statsmodels.tsa.seasonal.seasonal_decompose` via Pyodide
- Lag feature generator writes new columns to the DanfoJS DataFrame

---

## 6. Reporting & Export

### F-18 · One-Click PDF Report Generation `P1`
**What:** Add a "Download Report" button in the results section that generates a structured PDF containing: dataset summary, preprocessing steps applied, model parameters, all metric values, and all charts.

**Why it matters:** The platform already has individual download buttons for each chart and CSV. A consolidated report dramatically reduces the time to share results with a supervisor or client.

**Technical approach:**
- Use the existing `jsPDF` dependency (already installed but not used for reports)
- `html2canvas` to capture each Plotly chart as an image
- Structured multi-section document: Dataset → Preprocessing → Model → Results → Explainability

---

### F-19 · Full sklearn Pipeline Code Export `P2`
**What:** Replace the current partial code export with a complete, runnable `sklearn.pipeline.Pipeline` script that includes: preprocessing (scaler, encoder, imputer), the model, cross-validation, and evaluation — matching exactly what was configured in the UI.

**Why it matters:** The current code export only generates the model-fitting step. A complete pipeline export lets users run the exact same analysis in a Python environment without guessing the preprocessing steps.

**Technical approach:**
- Extend `export_to_py.js` to read all applied transformations from the Pinia store
- Generate a `Pipeline([...])` with `ColumnTransformer` for mixed-type features
- Include `cross_val_score` block matching the CV setting selected in the UI

---

### F-20 · Shareable Results Link / State Export `P2`
**What:** Serialize the complete application state (data, settings, results) to a compressed JSON and let the user download it as a `.mlfit` file or share a URL with state encoded as a hash.

**Why it matters:** Currently, refreshing the page or closing the tab loses all work. Research workflows need reproducibility across sessions and colleagues.

**Technical approach:**
- Pinia store `$state` serialized via `JSON.stringify` → `LZ-String` compression
- Download as `.mlfit` file (JSON) or encode in base64 URL fragment
- Upload `.mlfit` file to restore full session state

---

## 7. User Experience

### F-21 · Model Comparison Dashboard `P1`
**What:** A dedicated tab that shows all previously fitted models side-by-side in a single table (accuracy, F1, AUC, R², MSE, etc.) with a bar chart ranking them. Allow selecting two models for a head-to-head detailed comparison.

**Why it matters:** The current "Results" tab shows one model at a time. Comparing models requires manually noting down numbers. A comparison dashboard is the most natural next step after fitting multiple models.

**Technical approach:**
- Read the `results` array from the Pinia store (already stores multiple models)
- DataTable component with sortable metric columns
- "Compare two" button opens a split-panel view

---

### F-22 · Live Prediction Panel `P1`
**What:** After fitting a model, add an "Predict New Data" panel where the user types in values for each feature and gets an instant prediction (and probability for classification) without re-running the model.

**Why it matters:** Transforms the platform from purely analytical to interactive. Users can immediately test "what if" scenarios — which is the most common question after a model is fitted.

**Technical approach:**
- Store serialized fitted model coefficients/weights in the Pinia results object
- For tree-based models: re-run inference in Pyodide using stored model parameters
- For linear models: direct matrix multiplication in JavaScript (fast, no worker needed)
- Input form auto-generated from the feature list with type-appropriate controls

---

### F-23 · Guided Tour & Contextual Help `P2`
**What:** Extend the existing Shepherd.js tour (already installed) to cover every major section with step-by-step explanations. Add "?" tooltip badges on every chart title that open a modal explaining what the chart shows and how to interpret it.

**Why it matters:** The platform is powerful but intimidating for students and non-experts. Contextual help reduces the learning curve without simplifying the tool.

**Technical approach:**
- Shepherd.js tour already installed — extend with steps per tab
- Each chart title gets a `b-tooltip` with an interpretation guide
- "Learn more" links to the existing documentation tab

---

### F-24 · Dark Mode `P3`
**What:** Add a dark theme toggle in the header. All Plotly charts, tables, and UI components switch to a dark colour scheme.

**Why it matters:** Standard expectation for modern web apps. Reduces eye strain during long analysis sessions. The existing Bulma CSS-based layout supports dark mode variables.

**Technical approach:**
- CSS custom property (`--bg`, `--text`, `--surface`) overrides via a `.dark` class on `<html>`
- Plotly `template: 'plotly_dark'` passed when dark mode is active
- Theme preference stored in `localStorage`

---

### F-25 · Dataset Profiling Summary Card `P2`
**What:** On data upload, auto-generate a one-page "Dataset Health" card showing: missing value heatmap, skewness of each numerical feature, class balance bar chart (or target distribution for regression), and a list of potential data quality warnings (constant features, near-duplicate columns, high cardinality categoricals).

**Why it matters:** Users currently have to discover data quality issues manually by clicking through charts. A single diagnostic card surfaces all critical issues in under 5 seconds.

**Technical approach:**
- Run on upload, computed from DanfoJS DataFrame in the main thread
- Missing value heatmap: rows × columns, color by % missing
- Skewness computed with `simple-statistics` (already installed)
- Warnings rendered as a `b-message` list with icons

---

## Feature Summary Table

| ID | Feature | Category | Priority |
|----|---------|----------|----------|
| F-01 | SHAP Value Visualization | Explainability | P1 |
| F-02 | LIME Individual Explanations | Explainability | P1 |
| F-03 | PDP + ICE Curves | Explainability | P2 |
| F-04 | Clustering Algorithms (K-Means, DBSCAN, Hierarchical) | Unsupervised | P1 |
| F-05 | Anomaly Detection (Isolation Forest, LOF) | Unsupervised | P2 |
| F-06 | Association Rule Mining | Unsupervised | P3 |
| F-07 | Feature Significance Tests (ANOVA, chi-square, t-test) | Statistics | P1 |
| F-08 | Distribution Fitting with AIC/BIC | Statistics | P2 |
| F-09 | Multicollinearity Report (VIF) | Statistics | P2 |
| F-10 | Learning Curves | Model Evaluation | P1 |
| F-11 | Cross-Validation Fold Breakdown | Model Evaluation | P1 |
| F-12 | Class Imbalance Handling (SMOTE, resampling) | Model Training | P1 |
| F-13 | Calibration Curves (Reliability Diagrams) | Model Evaluation | P2 |
| F-14 | Hyperparameter Search Visualization | Model Training | P2 |
| F-15 | Interactive Outlier Removal via Lasso Select | Data Prep | P1 |
| F-16 | Feature Engineering Panel | Data Prep | P2 |
| F-17 | Time Series Detection & Decomposition | Data Prep | P3 |
| F-18 | One-Click PDF Report Generation | Export | P1 |
| F-19 | Full sklearn Pipeline Code Export | Export | P2 |
| F-20 | Shareable Session State (.mlfit / URL) | Export | P2 |
| F-21 | Model Comparison Dashboard | UX | P1 |
| F-22 | Live Prediction Panel | UX | P1 |
| F-23 | Guided Tour & Contextual Help | UX | P2 |
| F-24 | Dark Mode | UX | P3 |
| F-25 | Dataset Profiling Summary Card | UX | P2 |

**Total: 25 features — 10 × P1, 11 × P2, 4 × P3**
