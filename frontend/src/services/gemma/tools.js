import { buildAppContext, getMethodContext, getTabName } from './help-context'
import { analyzeReadiness } from '@/services/data-readiness/readiness-service'
import { recommendModels, recommendNextStep } from '@/services/recommendations/recommendation-service'

const TAB_LOOKUP = {
    data: 0,
    analysis: 0,
    dimensionality: 1,
    pca: 1,
    tsne: 1,
    umap: 1,
    training: 2,
    model: 2,
    results: 3,
    result: 3,
    methods: 4,
    documentation: 4,
    help: 5,
    messages: 6,
}

function safeJson(value) {
    return JSON.stringify(value, null, 2).slice(0, 12000)
}

function normalizeTabIndex(tab) {
    if (typeof tab === 'number' && tab >= 0 && tab <= 6) return tab
    const key = String(tab || '').toLowerCase().trim()
    if (key in TAB_LOOKUP) return TAB_LOOKUP[key]
    const parsed = Number.parseInt(key, 10)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 6) return parsed
    return null
}

export function createGemmaTools(settings) {
    return [
        {
            name: 'read_app_context',
            description: 'Read the current ML Fit app context including active tab, dataset, target, selected features, and recent model results.',
            execute: async () => ({
                context: safeJson(buildAppContext(settings)),
            }),
        },
        {
            name: 'list_results',
            description: 'List all trained model results with metrics and basic metadata.',
            execute: async () => ({
                results: safeJson({
                    count: settings.results?.length || 0,
                    results: (settings.results || []).map((result) => ({
                        id: result.id,
                        name: result.name,
                        target: result.target,
                        datasetName: result.datasetName,
                        task: result.modelTask ? 'classification' : 'regression',
                        metrics: result.metrics,
                        hasExplainability: Boolean(result.hasExplaination),
                        hasProbabilityDiagnostics: Boolean(result.showProbas || result.model?.probas?.length),
                    })),
                }),
            }),
        },
        {
            name: 'explain_method',
            description: 'Get concise built-in context for an ML method by helpSectionId or model name.',
            parameters: {
                type: 'object',
                properties: {
                    helpSectionId: {
                        type: 'string',
                        description: 'The method help id, such as logistic_regression_help, svm_help, knn_help, cart_help, or linear_regression_help.',
                    },
                    modelName: {
                        type: 'string',
                        description: 'Optional model display name.',
                    },
                },
            },
            execute: async (args) => ({
                method: safeJson(getMethodContext(args.helpSectionId, args.modelName)),
            }),
        },
        {
            name: 'open_app_tab',
            description: 'Navigate ML Fit to a major app tab. Use this when the user asks to open data analysis, dimensionality reduction, model training, results, methods, help, or messages.',
            parameters: {
                type: 'object',
                properties: {
                    tab: {
                        type: 'string',
                        description: 'Tab name or index. Examples: data, dimensionality, training, results, methods, help, messages.',
                    },
                },
                required: ['tab'],
            },
            execute: async (args) => {
                const tabIndex = normalizeTabIndex(args.tab)
                if (tabIndex == null) {
                    return { error: `Unknown tab "${args.tab}".` }
                }
                settings.setActiveTab(tabIndex)
                return { opened: getTabName(tabIndex), index: tabIndex }
            },
        },
        {
            name: 'read_selected_features',
            description: 'Read selected feature names and types for the current dataset.',
            execute: async () => ({
                features: safeJson((settings.features || [])
                    .filter((feature) => feature.selected)
                    .map((feature) => ({
                        name: feature.name,
                        type: feature.type === 1 ? 'numeric' : 'categorical_or_ordinal',
                        missingValuesCount: feature.missingValuesCount,
                        scaler: feature.scaler,
                    }))),
            }),
        },
        {
            name: 'diagnose_dataset',
            description: 'Diagnose current dataset readiness with blockers, warnings, and suggestions grounded in the uploaded data.',
            execute: async () => ({
                diagnosis: safeJson(analyzeReadiness(settings.rawData || [], {
                    target: settings.target,
                    taskMode: settings.taskMode,
                })),
            }),
        },
        {
            name: 'recommend_next_step',
            description: 'Recommend the next workflow step based on readiness and current target/task state.',
            execute: async () => ({
                recommendation: safeJson(recommendNextStep(settings.rawData || [], {
                    target: settings.target,
                    taskMode: settings.taskMode,
                })),
            }),
        },
        {
            name: 'suggest_model_config',
            description: 'Suggest ranked model configurations for the current dataset and target.',
            execute: async () => ({
                models: safeJson(recommendModels(settings.rawData || [], {
                    target: settings.target,
                    taskMode: settings.taskMode,
                })),
            }),
        },
        {
            name: 'compare_runs',
            description: 'Compare stored experiment runs and identify the currently best candidate by available metrics.',
            execute: async () => {
                const runs = settings.trainingRuns || []
                const scored = runs.map((run) => {
                    const metrics = run.metrics || {}
                    const score = metrics.accuracy ?? metrics.f1_macro ?? metrics.r2 ?? (metrics.rmse != null ? -metrics.rmse : null)
                    return { id: run.id, model: run.model, target: run.target, score, metrics }
                }).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
                return { comparison: safeJson({ count: runs.length, best: scored[0] || null, runs: scored.slice(0, 8) }) }
            },
        },
        {
            name: 'explain_metric',
            description: 'Explain a metric from a named result or the latest result.',
            parameters: {
                type: 'object',
                properties: {
                    metric: { type: 'string', description: 'Metric key, for example accuracy, f1_macro, rmse, r2.' },
                },
                required: ['metric'],
            },
            execute: async (args) => {
                const latest = settings.results?.[settings.results.length - 1]
                const value = latest?.metrics?.[args.metric]
                return {
                    metric: safeJson({
                        metric: args.metric,
                        value,
                        result: latest ? { id: latest.id, name: latest.name, target: latest.target } : null,
                        explanation: value == null
                            ? 'Metric not found on the latest result.'
                            : `${args.metric} is ${value}. Compare it with complementary diagnostics before choosing the model.`,
                    }),
                }
            },
        },
        {
            name: 'create_report_outline',
            description: 'Create a concise report outline from dataset readiness and current experiment history.',
            execute: async () => ({
                outline: safeJson({
                    sections: [
                        'Dataset overview and readiness',
                        'Target and validation strategy',
                        'Recommended candidate models',
                        'Experiment comparison',
                        'Explainability findings',
                        'Limitations and next steps',
                    ],
                    dataset: settings.datasetName,
                    runCount: settings.trainingRuns?.length || settings.results?.length || 0,
                }),
            }),
        },
        {
            name: 'configure_training_draft',
            description: 'Queue a draft training configuration for user approval. This never applies changes directly.',
            parameters: {
                type: 'object',
                properties: {
                    algoId: { type: 'number', description: 'Recommended model id.' },
                    target: { type: 'string', description: 'Target column.' },
                    taskMode: { type: 'string', description: 'classification or regression.' },
                },
                required: ['algoId'],
            },
            execute: async (args) => {
                if (typeof settings.addPendingAssistantAction !== 'function') {
                    return { error: 'Assistant action queue is unavailable.' }
                }
                const action = settings.addPendingAssistantAction({
                    type: 'configure_training_draft',
                    title: 'Configure recommended training run',
                    payload: {
                        algoId: args.algoId,
                        target: args.target || settings.target,
                        taskMode: args.taskMode || settings.taskMode,
                    },
                })
                return { action }
            },
        },
    ]
}
