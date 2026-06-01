import { Settings } from '@/helpers/settings';
import { TASK_MODES } from '@/helpers/task_mode';
import { analyzeReadiness } from '@/services/data-readiness/readiness-service';

function isMissing(value) {
    return value === null || value === undefined || value === '' || Number.isNaN(value);
}

function columns(rows) {
    return rows[0] ? Object.keys(rows[0]) : [];
}

function profileRows(rows = [], target) {
    const names = columns(rows);
    const featureNames = names.filter((name) => name !== target);
    let numeric = 0;
    let categorical = 0;
    let missing = 0;
    for (const name of featureNames) {
        const values = rows.map((row) => row?.[name]);
        const present = values.filter((value) => !isMissing(value));
        missing += values.length - present.length;
        const numericCount = present.map(Number).filter(Number.isFinite).length;
        if (present.length && numericCount === present.length) numeric += 1;
        else categorical += 1;
    }
    return {
        rows: rows.length,
        columns: names.length,
        featureCount: featureNames.length,
        numeric,
        categorical,
        missingPercent: missing / Math.max(1, rows.length * Math.max(1, featureNames.length)) * 100,
    };
}

const CANDIDATE_META = {
    classification: [
        { key: 'logistic_regression', id: 1, speed: 'fast', interpretability: 'high', robustness: 'medium', cost: 'low' },
        { key: 'random_forest', id: 5, speed: 'medium', interpretability: 'medium', robustness: 'high', cost: 'medium' },
        { key: 'boosting', id: 6, speed: 'medium', interpretability: 'medium', robustness: 'high', cost: 'medium' },
        { key: 'k_nearest_neighbour', id: 3, speed: 'fast', interpretability: 'medium', robustness: 'low', cost: 'low' },
        { key: 'naive_bayes', id: 7, speed: 'fast', interpretability: 'medium', robustness: 'medium', cost: 'low' },
    ],
    regression: [
        { key: 'linear_regression', id: 9, speed: 'fast', interpretability: 'high', robustness: 'medium', cost: 'low' },
        { key: 'random_forest_regression', id: 13, speed: 'medium', interpretability: 'medium', robustness: 'high', cost: 'medium' },
        { key: 'xgboost_regression', id: 11, speed: 'medium', interpretability: 'medium', robustness: 'high', cost: 'medium' },
        { key: 'knn_regression', id: 10, speed: 'fast', interpretability: 'medium', robustness: 'low', cost: 'low' },
    ],
};

function modelFromCatalog(task, candidate) {
    const catalog = task === 'regression' ? Settings.regression : Settings.classification;
    return Object.values(catalog).find((model) => model.id === candidate.id || candidate.key === model.key);
}

function tagsFor(candidate) {
    return [
        `speed:${candidate.speed}`,
        `interpretability:${candidate.interpretability}`,
        `robustness:${candidate.robustness}`,
        `cost:${candidate.cost}`,
    ];
}

export function recommendModels(data = [], options = {}) {
    const rows = Array.isArray(data) ? data : [];
    const task = options.taskMode === TASK_MODES.REGRESSION || options.taskMode === 'regression'
        ? 'regression'
        : 'classification';
    const readiness = analyzeReadiness(rows, { target: options.target, taskMode: task });
    const profile = profileRows(rows, options.target);
    const hasImbalance = readiness.warnings.some((warning) => warning.code === 'class_imbalance');
    const hasHighCardinality = readiness.warnings.some((warning) => warning.code === 'high_cardinality');
    const hasMissing = profile.missingPercent > 0;

    return CANDIDATE_META[task].map((candidate) => {
        const catalog = modelFromCatalog(task, candidate);
        let score = 50;
        const reasons = [];
        if (candidate.interpretability === 'high') {
            score += 12;
            reasons.push('good interpretable baseline');
        }
        if (candidate.robustness === 'high') {
            score += hasMissing || hasHighCardinality || hasImbalance ? 22 : 10;
            reasons.push('robust to messy tabular features');
        }
        if (candidate.speed === 'fast' && profile.rows <= 10000) {
            score += 8;
            reasons.push('fast enough for a quick first run');
        }
        if (candidate.id === 3 && (hasHighCardinality || hasImbalance)) {
            score -= 15;
            reasons.push('distance-based models can struggle with encoded sparse or imbalanced data');
        }
        if (candidate.id === 5 && hasImbalance) {
            score += 8;
            reasons.push('tree ensembles are a stronger first choice for imbalanced classes');
        }
        if (task === 'regression' && candidate.id === 9) {
            score += 10;
            reasons.push('sets a transparent regression baseline');
        }
        return {
            modelId: candidate.id,
            key: candidate.key,
            label: catalog?.label || catalog?.title || candidate.key,
            score: Math.max(0, Math.round(score)),
            tags: tagsFor(candidate),
            speed: candidate.speed,
            interpretability: candidate.interpretability,
            robustness: candidate.robustness,
            estimatedCost: candidate.cost,
            reasons,
        };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
}

export function recommendNextStep(data = [], options = {}) {
    const readiness = analyzeReadiness(data, options);
    if (readiness.blockers.length) {
        return {
            action: 'fix_readiness_blockers',
            message: readiness.blockers[0].message,
            readiness,
        };
    }
    const models = recommendModels(data, options);
    return {
        action: 'configure_recommended_model',
        message: models[0]
            ? `Start with ${models[0].label}: ${models[0].reasons[0] || 'best ranked candidate'}.`
            : 'Select a target column to get model recommendations.',
        readiness,
        models,
    };
}
