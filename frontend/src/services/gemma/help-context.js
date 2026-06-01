const TAB_NAMES = [
    'Data Analysis',
    'Dimensionality Reduction',
    'Model Training',
    'Results Analysis',
    'Methods Details',
    'Help',
    'Messages Log',
]

const METHOD_CONTEXT = {
    logistic_regression_help: {
        title: 'Logistic Regression',
        summary: 'A classification model that learns linear decision boundaries in log-odds space and outputs class probabilities.',
        guidance: 'Use coefficient signs and confidence intervals for interpretation. Inspect ROC and probability distributions when threshold choice matters.',
    },
    svm_help: {
        title: 'Support Vector Machine',
        summary: 'A margin-based model that separates classes with a maximum-margin hyperplane and optional kernels.',
        guidance: 'Tune C, kernel, gamma/degree, and inspect confusion patterns because probability calibration can be less direct than linear probabilistic models.',
    },
    knn_help: {
        title: 'K-Nearest Neighbors',
        summary: 'A non-parametric classifier or regressor that predicts from the labels or values of nearby samples.',
        guidance: 'Scaling matters strongly. Use the K performance plot and probability distribution to see whether neighborhoods are decisive or ambiguous.',
    },
    cart_help: {
        title: 'Tree, Random Forest, or Boosting',
        summary: 'Tree-based methods split feature space into regions. Ensembles improve stability and accuracy by combining many trees.',
        guidance: 'Use permutation feature importance and partial dependence to understand which variables drive predictions.',
    },
    discriminant_analysis_help: {
        title: 'Discriminant Analysis',
        summary: 'A probabilistic classifier that models class-conditional feature distributions and applies Bayes decision rules.',
        guidance: 'Works best when class covariance assumptions are reasonable. Check probability spread and misclassified classes.',
    },
    naive_bayes_help: {
        title: 'Naive Bayes',
        summary: 'A fast probabilistic classifier using Bayes rule with conditional independence assumptions between features.',
        guidance: 'Useful as a baseline. Review probability plots for overconfident predictions caused by independence assumptions.',
    },
    linear_regression_help: {
        title: 'Linear Regression',
        summary: 'A regression model that estimates a linear relationship between predictors and a continuous target.',
        guidance: 'Inspect residual plots, fitted-vs-actual plots, and coefficient uncertainty before trusting extrapolations.',
    },
    help: {
        title: 'ML Fit Help',
        summary: 'Guidance for uploading data, selecting features, choosing tasks, training models, and interpreting results.',
        guidance: 'Start with dataset quality, confirm the target and feature types, train a model, then inspect metrics and diagnostics.',
    },
}

export function getTabName(index) {
    return TAB_NAMES[index] || `Tab ${index}`
}

export function getMethodContext(helpSectionId, fallbackName = '') {
    return METHOD_CONTEXT[helpSectionId] || {
        title: fallbackName || 'Selected method',
        summary: 'This method is available in ML Fit. Use the assistant to connect the algorithm behavior to your current data and results.',
        guidance: 'Ask for metric interpretation, diagnostics, assumptions, feature effects, and next tuning steps.',
    }
}

function summarizeFeatures(features = []) {
    const selected = features.filter((feature) => feature.selected)
    const numeric = selected.filter((feature) => feature.type === 1)
    const categorical = selected.filter((feature) => feature.type !== 1)
    return {
        selectedCount: selected.length,
        numericCount: numeric.length,
        categoricalCount: categorical.length,
        selectedNames: selected.slice(0, 20).map((feature) => feature.name),
    }
}

function summarizeResult(result) {
    if (!result) return null
    return {
        id: result.id,
        name: result.name,
        task: result.modelTask ? 'classification' : 'regression',
        datasetName: result.datasetName,
        target: result.target,
        metrics: result.metrics,
        options: Object.fromEntries(
            Object.entries(result.options || {}).map(([key, value]) => [key, value?.value ?? value])
        ),
        numericColumns: result.numericColumns || [],
        categoricalFeatures: result.categoricalFeatures || [],
        transformations: (result.transformations || []).map((item) => item.name || item),
        hasProbabilityDiagnostics: Boolean(result.showProbas || result.model?.probas?.length),
        hasExplainability: Boolean(result.hasExplaination),
    }
}

export function buildAppContext(settings, extra = {}) {
    const features = summarizeFeatures(settings.features || [])
    const activeResult = extra.resultId
        ? settings.results?.find((result) => result.id === extra.resultId)
        : settings.results?.[settings.results.length - 1]

    return {
        app: 'ML Fit / ML Studio',
        activeTab: {
            index: settings.activeTab,
            name: getTabName(settings.activeTab),
        },
        dataset: {
            name: settings.datasetName || 'Not loaded',
            shape: settings.datasetShape,
            target: settings.target,
            taskMode: settings.taskMode,
            task: settings.isClassification ? 'classification' : 'regression',
        },
        features,
        results: {
            count: settings.results?.length || 0,
            latest: summarizeResult(activeResult),
            all: (settings.results || []).slice(-5).map(summarizeResult),
        },
        method: extra.helpSectionId ? getMethodContext(extra.helpSectionId, extra.modelName) : null,
    }
}

export function buildSystemPrompt(settings, extra = {}) {
    const context = buildAppContext(settings, extra)
    const compactContext = JSON.stringify(context, null, 2).slice(0, 12000)

    return [
        'You are Gemma, the local browser assistant for ML Fit / ML Studio.',
        'You run directly in the user browser and help with machine learning workflow, model selection, diagnostics, math intuition, and app navigation.',
        'Be concise, practical, and specific to the visible app context.',
        'When interpreting metrics, explain what the number means and what the user should inspect next.',
        'Use tools only when they help inspect app state or navigate. Do not invent hidden data.',
        '',
        'Current app context:',
        compactContext,
    ].join('\n')
}

export function buildMethodPrompt(result) {
    const method = getMethodContext(result?.helpSectionId, result?.name)
    return [
        `Explain ${method.title} for result ${result?.id ?? ''}${result?.name ? ` (${result.name})` : ''}.`,
        method.summary,
        method.guidance,
        'Use this trained result context: metrics, target, features, diagnostics, and suggested next steps.',
    ].join('\n')
}
