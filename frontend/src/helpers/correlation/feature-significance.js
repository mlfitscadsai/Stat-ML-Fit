import { asyncRun } from "@/helpers/sns-worker";

export default class FeatureSignificance {
    async compute(X_data, y_data, X_columns, num_columns, cat_columns, is_classification) {
        this.context = {
            X_data: X_data,
            y_data: y_data,
            X_columns: X_columns,
            num_columns: num_columns,
            cat_columns: cat_columns,
            is_classification: is_classification
        };
        // NOTE: We return json.dumps(results) — a plain string — to avoid
        // postMessage DataCloneError when Pyodide returns Map/PyProxy objects.
        const script = `
import pandas as pd
import scipy.stats as stats
import numpy as np
import json
from js import X_data, y_data, X_columns, num_columns, cat_columns, is_classification

results = []
try:
    X_columns_py = list(X_columns)
    num_columns_py = list(num_columns)
    cat_columns_py = list(cat_columns)
    is_cls = bool(is_classification)

    if hasattr(X_data, 'to_py'):
        X_data = X_data.to_py()
    if hasattr(y_data, 'to_py'):
        y_data = y_data.to_py()

    df = pd.DataFrame(X_data, columns=X_columns_py)
    y = pd.Series(y_data)

    def get_sig(p):
        if p < 0.001: return '\\u2605\\u2605\\u2605'
        elif p < 0.01: return '\\u2605\\u2605'
        elif p < 0.05: return '\\u2605'
        return ''

    for num_col in num_columns_py:
        try:
            if is_cls:
                groups = [df[num_col][y == g].dropna() for g in y.unique()]
                groups = [g for g in groups if len(g) > 0]
                if len(groups) >= 2:
                    f_stat, p_val = stats.f_oneway(*groups)
                    if not np.isnan(f_stat) and not np.isnan(p_val):
                        results.append({"feature": str(num_col), "test": "ANOVA F-test", "statistic": f"{float(f_stat):.2f}", "p_value": float(p_val), "p_value_display": "< 0.001" if float(p_val) < 0.001 else f"{float(p_val):.4f}", "significance": get_sig(float(p_val))})
            else:
                mask = ~df[num_col].isna() & ~y.isna()
                num_valid = df[num_col][mask].values
                y_valid = y[mask].values
                if len(num_valid) > 2:
                    r, p_val = stats.pearsonr(num_valid.astype(float), y_valid.astype(float))
                    if not np.isnan(r) and not np.isnan(p_val):
                        results.append({"feature": str(num_col), "test": "Pearson r", "statistic": f"{float(r):.2f}", "p_value": float(p_val), "p_value_display": "< 0.001" if float(p_val) < 0.001 else f"{float(p_val):.4f}", "significance": get_sig(float(p_val))})
        except Exception as e:
            results.append({"feature": str(num_col), "test": "ERROR", "statistic": "0", "p_value": 1.0, "p_value_display": str(e)[:80], "significance": ""})

    for cat_col in cat_columns_py:
        try:
            if is_cls:
                contingency = pd.crosstab(df[cat_col], y)
                if min(contingency.shape) > 1:
                    chi2, p_val, dof, ex = stats.chi2_contingency(contingency)
                    if not np.isnan(chi2) and not np.isnan(p_val):
                        results.append({"feature": str(cat_col), "test": "Chi-square", "statistic": f"{float(chi2):.2f}", "p_value": float(p_val), "p_value_display": "< 0.001" if float(p_val) < 0.001 else f"{float(p_val):.4f}", "significance": get_sig(float(p_val))})
            else:
                groups = [y[df[cat_col] == g].dropna() for g in df[cat_col].unique()]
                groups = [g for g in groups if len(g) > 0]
                if len(groups) >= 2:
                    f_stat, p_val = stats.f_oneway(*groups)
                    if not np.isnan(f_stat) and not np.isnan(p_val):
                        results.append({"feature": str(cat_col), "test": "ANOVA F-test", "statistic": f"{float(f_stat):.2f}", "p_value": float(p_val), "p_value_display": "< 0.001" if float(p_val) < 0.001 else f"{float(p_val):.4f}", "significance": get_sig(float(p_val))})
        except Exception as e:
            results.append({"feature": str(cat_col), "test": "ERROR", "statistic": "0", "p_value": 1.0, "p_value_display": str(e)[:80], "significance": ""})

    results.sort(key=lambda x: x['p_value'])
except Exception as global_e:
    results.append({"feature": "GLOBAL ERROR", "test": "ERROR", "statistic": "0", "p_value": 1.0, "p_value_display": str(global_e)[:120], "significance": ""})

json.dumps(results)
        `;
        try {
            const { results, error } = await asyncRun(script, this.context);
            if (results !== undefined && results !== null) {
                // Pyodide returns json.dumps result as a plain JS string
                const parsed = typeof results === 'string' ? JSON.parse(results) : results;
                return Array.isArray(parsed) ? parsed : [];
            } else if (error) {
                return [{ feature: "Python Worker Error", test: "N/A", statistic: "0", p_value_display: String(error).slice(0, 120), significance: "ERROR" }];
            }
        } catch (e) {
            return [{ feature: "JS Error", test: "N/A", statistic: "0", p_value_display: e.message, significance: "ERROR" }];
        }
        return [];
    }
}
