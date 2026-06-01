function bestMetric(metrics = {}, isClassification) {
    const keys = isClassification
        ? ['f1_macro', 'accuracy', 'auc', 'f1_micro']
        : ['rsquared', 'r2', 'rmse', 'mae'];
    const key = keys.find((item) => metrics[item] != null);
    return key ? { key, value: metrics[key] } : null;
}

function averageImportances(importances = []) {
    if (!Array.isArray(importances) || !importances.length) return [];
    const rows = Array.isArray(importances[0]) ? importances : [importances];
    const width = Math.max(...rows.map((row) => row.length));
    return Array.from({ length: width }, (_, index) => {
        const values = rows.map((row) => Number(row[index])).filter(Number.isFinite);
        const value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
        return { index, value };
    }).sort((a, b) => b.value - a.value);
}

export function normalizeXaiPayload(result = {}) {
    const model = result.model || {};
    const featureNames = result.snapshot?.xFeatures || result.numericColumns || [];
    const importances = averageImportances(model.importances || result.pfi);
    const pdpGrid = model.pdp_grid || result.pdp_grid || [];
    const pdpAverages = model.pdp_averages || result.pdp_avgs || [];
    return {
        featureImportance: importances.map((item) => ({
            feature: featureNames[item.index] || `Feature ${item.index + 1}`,
            value: item.value,
        })),
        partialDependence: Array.isArray(pdpGrid) && pdpGrid.length > 0 && Array.isArray(pdpAverages) && pdpAverages.length > 0,
        probabilityDiagnostics: Boolean(model.probas?.length || result.probas?.length),
        roc: Boolean(model.fpr?.length || result.fprs?.length),
    };
}

export function buildStoryboard(result = {}) {
    const isClassification = result.modelTask !== false;
    const metric = bestMetric(result.metrics, isClassification);
    const xai = normalizeXaiPayload(result);
    const insights = [];

    if (metric) {
        insights.push({
            type: 'metric',
            title: 'Model performance',
            text: `${metric.key.replace(/_/g, ' ')} is ${Number(metric.value).toFixed(3)}. Use this as the headline metric, then confirm with diagnostics.`,
        });
    }

    if (xai.featureImportance.length) {
        const top = xai.featureImportance[0];
        insights.push({
            type: 'feature_importance',
            feature: top.feature,
            title: 'Top driver',
            text: `${top.feature} is currently the strongest feature importance signal for ${result.name || 'this model'}.`,
        });
    }

    if (xai.partialDependence) {
        insights.push({
            type: 'partial_dependence',
            title: 'Feature effect shape',
            text: 'Partial dependence is available. Check whether important features have smooth, monotonic, or nonlinear effects.',
        });
    }

    if (isClassification && xai.probabilityDiagnostics) {
        insights.push({
            type: 'probability',
            title: 'Probability diagnostics',
            text: 'Predicted probabilities are available, so threshold tuning and confidence review are possible.',
        });
    }

    if (!insights.length) {
        insights.push({
            type: 'unsupported',
            title: 'Explainability unavailable',
            text: 'This run does not expose enough metric or explainability payloads yet. Train with explainability enabled or choose a supported model.',
        });
    }

    return {
        supported: insights.some((insight) => insight.type !== 'unsupported'),
        modelName: result.name || 'Model',
        task: isClassification ? 'classification' : 'regression',
        insights,
        nextExperiment: xai.featureImportance.length
            ? `Try a follow-up run that keeps ${xai.featureImportance[0].feature} and removes weak or high-risk features.`
            : 'Run an interpretable baseline next to compare assumptions and diagnostics.',
    };
}
