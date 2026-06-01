/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

import { asyncRun } from "@/helpers/py-worker";
import { ClassificationModel } from "../model";

export default class LogisticRegression extends ClassificationModel {
    constructor(options) {
        super();
        this.options = options;
        this.model = null;
        this.summary = null;
        this.model_stats_matrix = null;
        this.hasProbability = true;
        this.helpSectionId = "logistic_regression_help";
    }

    async train(x_train, y_train, x_test, y_test, labels, categorical_columns) {
        console.time('LogisticRegression:total');
        
        // Pass categorical_columns to the Python context
        this.context = {
            X_train: x_train,
            y_train: y_train,
            y_test: y_test,
            X_test: x_test,
            seed: this.seed,
            regularization_type: this.options.regularization.value === "Lasso" ? 1 : 0,
            labels: labels,
            categorical_columns: categorical_columns && categorical_columns.length > 0 ? categorical_columns : ['empty']
        };

        const script = `
from js import X_train, y_train, X_test, y_test, seed, regularization_type, labels, categorical_columns
import numpy as np
import json
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss, roc_curve, roc_auc_score
from sklearn.preprocessing import label_binarize
import statsmodels.api as sm

X_train_np = np.asarray(X_train, dtype=np.float64)
X_test_np = np.asarray(X_test, dtype=np.float64)
y_train_np = np.asarray(y_train)
y_test_np = np.asarray(y_test)

feature_names = [str(item) for item in list(labels)]
cat_cols = [str(item) for item in list(categorical_columns)]

# 1. Selective Scaling (Scale only continuous columns, mirror R's logic)
num_indices = [i for i, name in enumerate(feature_names) if name not in cat_cols]

X_train_scaled = X_train_np.copy()
X_test_scaled = X_test_np.copy()

if len(num_indices) > 0:
    scaler = StandardScaler()
    X_train_scaled[:, num_indices] = scaler.fit_transform(X_train_np[:, num_indices])
    X_test_scaled[:, num_indices] = scaler.transform(X_test_np[:, num_indices])
    # Handle NaNs from zero variance features
    X_train_scaled[np.isnan(X_train_scaled)] = 0
    X_test_scaled[np.isnan(X_test_scaled)] = 0

penalty = "l1" if int(regularization_type) == 1 else "l2"

# Filter out classes with fewer than 5 training samples — too few for stable CV/estimation.
# Test data is kept intact; rare-class test rows are predicted into the nearest known class.
_all_cls, _all_cnts = np.unique(y_train_np, return_counts=True)
_valid_classes = _all_cls[_all_cnts >= 5]
if len(_valid_classes) < 2:
    raise ValueError(
        "Not enough classes with sufficient training data (need at least 2 classes with "
        "5+ training samples each). Please use a more balanced dataset or choose a different target."
    )
if len(_valid_classes) < len(_all_cls):
    _train_keep = np.isin(y_train_np, _valid_classes)
    X_train_scaled = X_train_scaled[_train_keep]
    y_train_np    = y_train_np[_train_keep]
    _all_cls, _all_cnts = np.unique(y_train_np, return_counts=True)

# 2. Run CV to find optimal lambdas (n_splits adapts to smallest class size, max 5)
c_grid = np.logspace(-4, 3, 24)
min_class_count = int(_all_cnts.min())
n_splits = max(2, min(5, min_class_count))

cv_clf = LogisticRegressionCV(
    Cs=c_grid,
    cv=n_splits,
    penalty=penalty,
    solver="saga",
    scoring="accuracy",
    max_iter=8000,
    random_state=int(seed),
    refit=True
)
cv_clf.fit(X_train_scaled, y_train_np)

scores_dict = cv_clf.scores_
class_keys = list(scores_dict.keys())
class_keys.sort(key=lambda x: str(x))
score_key = class_keys[0]
scores = np.asarray(scores_dict[score_key], dtype=np.float64)
mean_errors = 1.0 - scores.mean(axis=0)
std_scores = scores.std(axis=0, ddof=1) if scores.shape[0] > 1 else np.zeros_like(mean_errors)

best_idx = int(np.argmin(mean_errors))
threshold = float(mean_errors[best_idx] + std_scores[best_idx])
candidate_idxs = np.where(mean_errors <= threshold)[0]
idx_1se = int(candidate_idxs[0]) if candidate_idxs.size > 0 else best_idx

best_c = float(cv_clf.Cs_[best_idx])
c_1se = float(cv_clf.Cs_[idx_1se])
lambda_values = (1.0 / np.asarray(cv_clf.Cs_, dtype=np.float64)).tolist()
lambda_min_log = float(np.log(1.0 / best_c))
lambda_1se_log = float(np.log(1.0 / c_1se))

# Helper to get non-zero feature indices for a given lambda
def get_nonzero_features(c_val):
    clf = LogisticRegression(penalty=penalty, C=c_val, solver="saga", random_state=int(seed), max_iter=8000)
    clf.fit(X_train_scaled, y_train_np)
    nonzero_mask = np.any(clf.coef_ != 0, axis=0)
    return np.where(nonzero_mask)[0].tolist()

idx_min_features = get_nonzero_features(best_c)
idx_1se_features = get_nonzero_features(c_1se)

# 3. Fit unregularized model & extract Stats (equivalent to nnet::multinom)
def fit_sm_model(feature_idxs, X_train_full, y_train_full):
    if len(feature_idxs) == 0:
        X_sub = np.ones((X_train_full.shape[0], 1))
        names = ["(Intercept)"]
    else:
        X_sub = X_train_full[:, feature_idxs]
        X_sub = sm.add_constant(X_sub, prepend=True)
        names = ["(Intercept)"] + [feature_names[i] for i in feature_idxs]
    
    classes = np.unique(y_train_full)
    try:
        # MNLogit defaults to first class as reference (matching R multinom)
        model = sm.MNLogit(y_train_full, X_sub)
        res = model.fit(disp=False, maxiter=5000, method='bfgs')
        
        # Transpose matrices so shape matches JS expectations: (K-1, features)
        coefs = res.params.T.values.tolist() if hasattr(res.params, 'values') else res.params.T.tolist()
        stds = res.bse.T.values.tolist() if hasattr(res.bse, 'values') else res.bse.T.tolist()
        p_values = res.pvalues.T.values.tolist() if hasattr(res.pvalues, 'values') else res.pvalues.T.tolist()
        
        model_classes = [str(c) for c in classes[1:]] 
        
        conf_rows = []
        conf_names = []
        z_val = 1.96
        
        # Calculate standard 95% Confidence Intervals
        for class_idx, class_name in enumerate(model_classes):
            for col_idx, col_name in enumerate(names):
                est = coefs[class_idx][col_idx]
                se = stds[class_idx][col_idx]
                conf_rows.append([class_name, est, est - z_val * se, est + z_val * se])
                conf_names.append(col_name)
                
        aic_val = float(res.aic)
        return model_classes, coefs, stds, p_values, conf_rows, conf_names, aic_val
        
    except Exception:
        # MNLogit failed to converge; use ridge-regularized sklearn for stable estimates
        clf = LogisticRegression(penalty='l2', C=1.0, solver="lbfgs", max_iter=8000)
        clf.fit(X_sub, y_train_full)
        coef_mat = np.concatenate([clf.intercept_.reshape(-1, 1), clf.coef_], axis=1)
        model_classes = [str(x) for x in clf.classes_[1:]]
        coef_mat = coef_mat[1:]  # drop reference class row to match MNLogit convention

        stds = np.full_like(coef_mat, np.nan).tolist()
        p_values = np.full_like(coef_mat, np.nan).tolist()

        conf_rows = []
        conf_names = []
        z_val = 1.96
        for class_idx, class_name in enumerate(model_classes):
            for col_idx, col_name in enumerate(names):
                est = coef_mat[class_idx, col_idx]
                conf_rows.append([class_name, est, est, est])
                conf_names.append(col_name)

        probs = clf.predict_proba(X_sub)
        ll = -log_loss(y_train_full, probs, labels=clf.classes_, normalize=False)
        aic_val = float((2 * coef_mat.size) - (2 * ll))

        return model_classes, coef_mat.tolist(), stds, p_values, conf_rows, conf_names, aic_val

# Extract all 3 models identically to R script
classes, coefs, stds, p_values, conf_int, conf_names, aic = fit_sm_model(list(range(len(feature_names))), X_train_scaled, y_train_np)
_, coefs_min, stds_min, p_values_min, conf_int_min, conf_names_min, aic_min = fit_sm_model(idx_min_features, X_train_scaled, y_train_np)
_, coefs_1se, stds_1se, p_values_1se, conf_int_1se, conf_names_1se, aic_1se = fit_sm_model(idx_1se_features, X_train_scaled, y_train_np)

# Base model predictions
base_clf = LogisticRegression(penalty=None, solver="lbfgs", max_iter=8000)
base_clf.fit(X_train_scaled, y_train_np)
y_pred = base_clf.predict(X_test_scaled)
probas = base_clf.predict_proba(X_test_scaled)
fprs = []
tprs = []
aucs = []
roc_classes = base_clf.classes_
if len(roc_classes) == 2:
    fpr, tpr, _ = roc_curve(y_test_np, probas[:, 1])
    auc = roc_auc_score(y_test_np, probas[:, 1])
    fprs.append(fpr)
    tprs.append(tpr)
    aucs.append(auc)
else:
    y_test_one_hot = label_binarize(y_test_np, classes=roc_classes)
    auc = roc_auc_score(y_test_one_hot, probas, multi_class='ovr')
    aucs.append(auc)
    for i in range(len(roc_classes)):
        fpr, tpr, _ = roc_curve(y_test_one_hot[:, i], probas[:, i])
        fprs.append(fpr)
        tprs.append(tpr)

# Plotting Data Extraction
fit_rows = []
try:
    for class_name, path in cv_clf.coefs_paths_.items():
        arr = np.asarray(path, dtype=np.float64)
        if arr.ndim != 3:
            continue
        mean_path = arr.mean(axis=0)
        if mean_path.shape[1] >= len(feature_names):
            mean_path = mean_path[:, :len(feature_names)]
        for i, c_val in enumerate(cv_clf.Cs_):
            lam = float(1.0 / c_val)
            for j, name in enumerate(feature_names):
                if j < mean_path.shape[1]:
                    fit_rows.append([lam, name, float(mean_path[i, j]), str(class_name)])
except Exception:
    pass

regularization_plot = {
    "data": [
        {
            "type": "scatter",
            "mode": "lines+markers",
            "name": "CV error",
            "x": [float(np.log(x)) for x in lambda_values],
            "y": [float(x) for x in mean_errors.tolist()],
            "marker": {"size": 5, "color": "#f05454"},
            "line": {"color": "#30475e"},
            "error_y": {
                "type": "data",
                "visible": True,
                "array": [float(x) for x in std_scores.tolist()]
            }
        }
    ],
    "layout": {
        "showlegend": False,
        "margin": {"l": 40, "r": 20, "b": 40, "t": 20},
        "xaxis": {"title": "log lambda"},
        "yaxis": {"title": "Error"},
        "shapes": [
            {
                "type": "line",
                "x0": lambda_min_log,
                "x1": lambda_min_log,
                "y0": 0,
                "y1": 1,
                "xref": "x",
                "yref": "paper",
                "line": {"color": "black", "dash": "dashdot", "width": 1}
            },
            {
                "type": "line",
                "x0": lambda_1se_log,
                "x1": lambda_1se_log,
                "y0": 0,
                "y1": 1,
                "xref": "x",
                "yref": "paper",
                "line": {"color": "black", "dash": "dashdot", "width": 1}
            }
        ]
    }
}

(
    y_pred.tolist(),
    json.dumps(regularization_plot),
    classes,
    coefs,
    stds,
    p_values,
    conf_int,
    conf_names,
    conf_names_min,
    coefs_min,
    stds_min,
    p_values_min,
    conf_int_min,
    conf_names_1se,
    coefs_1se,
    stds_1se,
    p_values_1se,
    conf_int_1se,
    float(aic),
    float(aic_min),
    float(aic_1se),
    fit_rows,
    float(lambda_min_log),
    float(lambda_1se_log),
    fprs,
    tprs,
    aucs,
    probas
)
`;

        const { results, error } = await asyncRun(script, this.context);
        console.timeEnd('LogisticRegression:total');

        if (error) {
            throw Error(`Logistic regression training failed: ${error}`);
        }
        if (!results) {
            throw Error("Logistic regression training returned no result.");
        }

        const fitRows = Array.from(results[21] || []).map((row) => ({
            lambda: +row[0],
            predictor: String(row[1]),
            coefficient: +row[2],
            class: String(row[3]),
        }));

        this.summary = {
            regularization_plot: JSON.parse(results[1]),
            classes: Array.from(results[2] || []),
            coefs: Array.from(results[3] || []),
            stds: Array.from(results[4] || []),
            z_scores: [], // Z-scores can be derived in JS as coef / std if needed
            p_values: Array.from(results[5] || []),
            predictions: Array.from(results[0] || []),
            confidence_intervals: Array.from(results[6] || []),
            confidence_intervals_row_names: Array.from(results[7] || []),
            aic: +results[18],
            best_fit_min: {
                names: Array.from(results[8] || []),
                coefs: Array.from(results[9] || []),
                stds: Array.from(results[10] || []),
                p_values: Array.from(results[11] || []),
                confidence_intervals: Array.from(results[12] || []),
                aic: +results[19],
            },
            best_fit_1se: {
                names: Array.from(results[13] || []),
                coefs: Array.from(results[14] || []),
                stds: Array.from(results[15] || []),
                p_values: Array.from(results[16] || []),
                confidence_intervals: Array.from(results[17] || []),
                aic: +results[20],
            },
            fit: fitRows,
            lambda_min: +results[22],
            lambda_1se: +results[23],
        };
        this.fpr = Array.from(results[24] || []);
        this.tpr = Array.from(results[25] || []);
        this.auc = Array.from(results[26] || []);
        this.probas = Array.from(results[27] || []);

        // Data table compilation mapping
        this.model_stats_matrix = [];
        const cols = [...labels];
        cols.unshift("(Intercept)");
        const minColumns = [...new Set((this.summary.best_fit_min.names || []).map((m) => String(m).replace(/^`|`$/g, "")))];
        const oneSeColumns = [...new Set((this.summary.best_fit_1se.names || []).map((m) => String(m).replace(/^`|`$/g, "")))];

        const fmtCoef = (value) => (Number.isFinite(+value) ? Number(value).toFixed(2) : "0.00");
        const fmtStd = (value) => (Number.isFinite(+value) ? Number(value).toFixed(2) : "0.00");
        const fmtP = (value) => (Number.isFinite(+value) ? Number(value).toFixed(2) : "1.00");

        for (let j = 0; j < this.summary.classes.length; j++) {
            for (let i = 0; i < cols.length; i++) {
                const row = [];
                row.push(cols[i]);

                const olsCoef = this.summary.coefs?.[j]?.[i];
                const olsStd = this.summary.stds?.[j]?.[i];
                const olsP = this.summary.p_values?.[j]?.[i];
                row.push(fmtCoef(olsCoef));
                row.push(fmtStd(olsStd));
                row.push(fmtP(olsP));

                let index = minColumns.findIndex((m) => m === cols[i]);
                if (index !== -1) {
                    const coef = this.summary.best_fit_min.coefs?.[j]?.[index];
                    const std = this.summary.best_fit_min.stds?.[j]?.[index];
                    const pVal = this.summary.best_fit_min.p_values?.[j]?.[index];
                    row.push(fmtCoef(coef));
                    row.push(fmtStd(std));
                    row.push(fmtP(pVal));
                } else {
                    row.push("0.00");
                    row.push("0.00");
                    row.push("1.00");
                }

                index = oneSeColumns.findIndex((m) => m === cols[i]);
                if (index !== -1) {
                    const coef = this.summary.best_fit_1se.coefs?.[j]?.[index];
                    const std = this.summary.best_fit_1se.stds?.[j]?.[index];
                    const pVal = this.summary.best_fit_1se.p_values?.[j]?.[index];
                    row.push(fmtCoef(coef));
                    row.push(fmtStd(std));
                    row.push(fmtP(pVal));
                } else {
                    row.push("0.00");
                    row.push("0.00");
                    row.push("1.00");
                }
                this.model_stats_matrix.push(row);
            }
            if (j < this.summary.classes.length - 1) {
                this.model_stats_matrix.push(this.model_stats_matrix[0].map(() => ""));
            }
        }

        this.summary.regularization_plot.layout = this.summary.regularization_plot.layout || {};
        this.summary.regularization_plot.layout.showlegend = false;
        this.summary.regularization_plot.layout.autosize = true;
        this.summary.regularization_plot.layout.legend = {
            font: {
                size: 8,
                color: "#000",
            },
        };

        return this.summary.predictions;
    }

    async visualize(x_test, y_test, uniqueLabels, predictions, encoder) {
        await super.visualize(x_test, y_test, uniqueLabels, predictions, encoder);
        this.chartController.plotROC(this.id, this.fpr, this.tpr, uniqueLabels, this.auc);
        this.chartController.probabilities_boxplot(this.probas, encoder.inverseTransform(predictions), uniqueLabels, this.id);
        
        // Unchanged plotting logic mirroring previous script ...
        setTimeout(async () => {
            const current = this;
            new DataTable("#metrics_table_" + current.id, {
                responsive: false,
                footerCallback: function () {
                    const api = this.api();
                    $(api.column(2).footer()).html("AIC : " + current.summary.aic.toFixed(2));
                    $(api.column(5).footer()).html("AIC : " + current.summary.best_fit_min.aic.toFixed(2));
                    $(api.column(8).footer()).html("AIC : " + current.summary.best_fit_1se.aic.toFixed(2));
                },
                data: current.model_stats_matrix,
                info: false,
                search: false,
                ordering: false,
                searching: false,
                paging: false,
                bDestroy: true,
            });

            await Plotly.newPlot(
                "regularization_" + current.id,
                current.summary.regularization_plot.data || [],
                current.summary.regularization_plot.layout || {}
            );

            const yClasses = (this.summary.confidence_intervals_row_names || [])
                .map((item, i) => item + "_" + (this.summary.confidence_intervals?.[i]?.[0] ?? ""))
                .reverse();
            const confIntervals = [...(this.summary.confidence_intervals || [])].reverse();
            const tracesParams = [];
            const olsY = yClasses.map((_, i) => i);
            tracesParams.push({
                name: "OLS",
                x: confIntervals.map((item) => item[1]),
                y: olsY,
                error_x: {
                    type: "data",
                    array: confIntervals.map((item) => Math.abs(item[3] - item[1])),
                },
                type: "scatter",
                mode: "markers",
                showlegend: true,
            });

            const yClassesMin = (this.summary.best_fit_min.names || [])
                .map((item, i) => item + "_" + (this.summary.best_fit_min.confidence_intervals?.[i]?.[0] ?? ""))
                .reverse();
            const confIntervalsMin = [...(this.summary.best_fit_min.confidence_intervals || [])].reverse();
            const minY = yClassesMin.map((_, i) => i + 0.2);
            tracesParams.push({
                name: "lasso min",
                x: confIntervalsMin.map((item) => item[1]),
                y: minY,
                error_x: {
                    type: "data",
                    array: confIntervalsMin.map((item) => Math.abs(item[3] - item[1])),
                },
                type: "scatter",
                mode: "markers",
                showlegend: true,
            });

            const yClasses1se = (this.summary.best_fit_1se.names || [])
                .map((item, i) => item + "_" + (this.summary.best_fit_1se.confidence_intervals?.[i]?.[0] ?? ""))
                .reverse();
            const confIntervals1se = [...(this.summary.best_fit_1se.confidence_intervals || [])].reverse();
            const oneSeY = yClasses1se.map((_, i) => i + 0.4);
            tracesParams.push({
                name: "lasso 1se",
                x: confIntervals1se.map((item) => item[1]),
                y: oneSeY,
                error_x: {
                    type: "data",
                    array: confIntervals1se.map((item) => Math.abs(item[3] - item[1])),
                },
                type: "scatter",
                mode: "markers",
                showlegend: true,
            });

            await Plotly.newPlot("parameters_plot_" + current.id, {
                data: tracesParams,
                layout: {
                    margin: { l: 80, r: 40, b: 40, t: 40, pad: 10 },
                    showlegend: true,
                    legend: {
                        xanchor: "left",
                        yanchor: "top",
                        x: 0.02,
                        y: 0.98,
                        font: { size: 8, color: "black" },
                        bgcolor: "rgba(0,0,0,0)",
                    },
                    xaxis: {
                        linecolor: "black",
                        linewidth: 1,
                        zeroline: true,
                        mirror: true,
                        title: "Confidence interval",
                    },
                    yaxis: {
                        linecolor: "black",
                        linewidth: 1,
                        zeroline: false,
                        mirror: true,
                        tickvals: oneSeY,
                        ticktext: yClasses1se,
                        tickfont: { size: 10 },
                    },
                },
            });

            this.summary.fit.sort((a, b) => a.lambda - b.lambda);
            let subset = this.summary.fit.filter((m) => m.class === "1");
            if (subset.length === 0 && this.summary.fit.length > 0) {
                const className = this.summary.fit[0].class;
                subset = this.summary.fit.filter((m) => m.class === className);
            }

            const params = new Set(subset.filter((m) => !!m.predictor).map((m) => m.predictor));
            const traces = [];
            let annotations = [];
            params.forEach((param) => {
                const series = subset.filter((m) => m.predictor === param);
                const coefs = series.map((m) => m.coefficient);
                const lambdas = series.map((m) => Math.log(m.lambda));
                traces.push({
                    name: param,
                    y: coefs,
                    x: lambdas,
                    mode: "lines",
                });
                annotations.push({
                    xref: "paper",
                    x: 0.01,
                    y: coefs[0],
                    xanchor: "left",
                    yanchor: "middle",
                    text: param,
                    font: { family: "Arial", size: 8, color: "black" },
                    showarrow: false,
                });
            });

            annotations = annotations.concat([
                {
                    x: this.summary.lambda_min,
                    y: 0.5,
                    xref: "x",
                    yref: "paper",
                    text: "Lambda min",
                    showarrow: false,
                    font: { size: 8, color: "black" },
                    textangle: -90,
                    align: "center",
                },
                {
                    x: this.summary.lambda_1se,
                    y: 0.5,
                    xref: "x",
                    yref: "paper",
                    text: "Lambda 1se",
                    showarrow: false,
                    font: { size: 8, color: "black" },
                    textangle: -90,
                    align: "center",
                },
            ]);

            await Plotly.newPlot("errors_" + current.id, {
                data: traces,
                layout: {
                    shapes: [
                        {
                            type: "line",
                            x0: this.summary.lambda_min,
                            x1: this.summary.lambda_min,
                            y0: 0,
                            y1: 1,
                            xref: "x",
                            yref: "paper",
                            line: { color: "black", dash: "dashdot", width: 1 },
                        },
                        {
                            type: "line",
                            x0: this.summary.lambda_1se,
                            x1: this.summary.lambda_1se,
                            y0: 0,
                            y1: 1,
                            xref: "x",
                            yref: "paper",
                            line: { color: "black", dash: "dashdot", width: 1 },
                        },
                    ],
                    annotations,
                    showlegend: false,
                    margin: { l: 40, r: 40, b: 40, t: 40, pad: 10 },
                    autosize: true,
                    xaxis: {
                        linecolor: "black",
                        linewidth: 1,
                        zeroline: false,
                        mirror: true,
                        title: "log lambda",
                    },
                    yaxis: {
                        linecolor: "black",
                        linewidth: 1,
                        zeroline: false,
                        mirror: true,
                        title: "coefficient",
                    },
                },
            });

            window.dispatchEvent(new Event("resize"));
        }, 500);
    }

    generatePythonCode() {
        const modelImport = "from sklearn.linear_model import LogisticRegression";
        const modelFit = `
model = LogisticRegression(random_state=${this.seed}, max_iter=5000)
`;
        return super.generatePythonCode(modelImport, modelFit);
    }
}
