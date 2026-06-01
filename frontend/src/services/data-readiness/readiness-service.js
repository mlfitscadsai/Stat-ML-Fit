import { TASK_MODES } from '@/helpers/task_mode';

const PREFERRED_TARGET_NAMES = ['target', 'label', 'class', 'y', 'survived', 'outcome'];

function isMissing(value) {
    return value === null || value === undefined || value === '' || Number.isNaN(value);
}

function toRows(data) {
    if (Array.isArray(data)) return data;
    if (data?.$data && Array.isArray(data.$data) && Array.isArray(data.columns)) {
        return data.$data.map((row) => Object.fromEntries(data.columns.map((col, index) => [col, row[index]])));
    }
    if (data?.values && Array.isArray(data.values) && Array.isArray(data.columns)) {
        return data.values.map((row) => Object.fromEntries(data.columns.map((col, index) => [col, row[index]])));
    }
    return [];
}

function getColumns(rows) {
    const seen = new Set();
    for (const row of rows) {
        for (const column of Object.keys(row || {})) {
            seen.add(column);
        }
    }
    return [...seen];
}

function columnValues(rows, column) {
    return rows.map((row) => row?.[column]);
}

function uniqueNonMissing(values) {
    return [...new Set(values.filter((value) => !isMissing(value)).map((value) => String(value)))];
}

function numericValues(values) {
    return values
        .filter((value) => !isMissing(value))
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
}

function columnKind(values) {
    const present = values.filter((value) => !isMissing(value));
    if (!present.length) return 'empty';
    const numeric = numericValues(values);
    return numeric.length === present.length ? 'numeric' : 'categorical';
}

function duplicatePercent(rows, columns) {
    if (!rows.length) return 0;
    const seen = new Set();
    let duplicates = 0;
    for (const row of rows) {
        const key = columns.map((column) => {
            const value = row?.[column];
            return isMissing(value) ? '' : String(value);
        }).join('\x1f');
        if (seen.has(key)) duplicates += 1;
        else seen.add(key);
    }
    return (duplicates / rows.length) * 100;
}

function scoreTargetCandidate(column, values) {
    const normalized = String(column).toLowerCase().trim();
    let score = 0;
    const reasons = [];
    if (PREFERRED_TARGET_NAMES.some((name) => normalized === name || normalized.includes(name))) {
        score += 50;
        reasons.push('name matches a common target column');
    }
    const uniqueCount = uniqueNonMissing(values).length;
    if (uniqueCount > 1 && uniqueCount <= 30) {
        score += 20;
        reasons.push('has a manageable number of outcomes');
    } else if (uniqueCount > 30) {
        score += 8;
        reasons.push('looks usable for regression');
    }
    if (columnKind(values) === 'categorical') score += 10;
    return { column, score, reason: reasons.join('; ') || 'last columns are often targets' };
}

function classImbalance(values) {
    const counts = new Map();
    for (const value of values) {
        if (isMissing(value)) continue;
        const key = String(value);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (counts.size <= 1 || counts.size > 30) return null;
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const min = Math.min(...counts.values());
    const max = Math.max(...counts.values());
    return {
        classes: counts.size,
        minorityPercent: total ? (min / total) * 100 : 0,
        majorityPercent: total ? (max / total) * 100 : 0,
    };
}

function skewRisk(values) {
    const nums = numericValues(values);
    if (nums.length < 8) return false;
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = nums.reduce((sum, value) => sum + value, 0) / nums.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const spread = Math.max(1e-9, max - min);
    return Math.abs(mean - median) / spread > 0.2;
}

export function analyzeReadiness(data, options = {}) {
    const rows = toRows(data);
    const columns = getColumns(rows);
    const target = options.target || null;
    const taskMode = options.taskMode || TASK_MODES.AUTO;
    const blockers = [];
    const warnings = [];
    const suggestions = [];
    const featureExclusions = [];
    let score = 100;

    if (!rows.length || !columns.length) {
        return {
            score: 0,
            taskMode,
            blockers: [{ code: 'empty_dataset', message: 'Upload a dataset before training.' }],
            warnings,
            suggestions: [{ code: 'upload_dataset', message: 'Load a CSV or TXT dataset to begin.' }],
            targetCandidates: [],
            featureExclusions,
            summary: { rows: 0, columns: 0, missingPercent: 0, duplicatePercent: 0 },
        };
    }

    let missingCells = 0;
    for (const column of columns) {
        const values = columnValues(rows, column);
        const present = values.filter((value) => !isMissing(value));
        const unique = uniqueNonMissing(values);
        missingCells += values.length - present.length;

        if (unique.length <= 1) {
            blockers.push({
                code: 'constant_column',
                column,
                message: `'${column}' has one unique value and should not be used as a feature.`,
            });
            featureExclusions.push(column);
            score -= 10;
        }

        const uniqueRatio = rows.length ? unique.length / rows.length : 0;
        const looksNamedLikeId = /(^id$|_id$|id_|identifier|uuid)/i.test(String(column));
        const canBehaveLikeId = columnKind(values) === 'categorical' || looksNamedLikeId;
        if (column !== target && rows.length > 3 && uniqueRatio >= 0.8 && canBehaveLikeId) {
            warnings.push({
                code: 'id_like_column',
                column,
                message: `'${column}' is nearly unique per row and may behave like an ID.`,
            });
            featureExclusions.push(column);
            score -= 5;
        }

        if (column !== target && columnKind(values) === 'categorical' && unique.length > 20) {
            warnings.push({
                code: 'high_cardinality',
                column,
                message: `'${column}' has ${unique.length} categories and may expand too much after encoding.`,
            });
            score -= 5;
        }

        if (column !== target && skewRisk(values)) {
            warnings.push({
                code: 'skewed_numeric',
                column,
                message: `'${column}' looks skewed; scaling or robust models may help.`,
            });
            score -= 2;
        }
    }

    const missingPercent = (missingCells / Math.max(1, rows.length * columns.length)) * 100;
    if (missingPercent > 0) {
        warnings.push({
            code: 'missing_values',
            message: `${missingPercent.toFixed(1)}% of cells are missing.`,
        });
        score -= Math.min(25, missingPercent * 2);
    }

    const duplicates = duplicatePercent(rows, columns);
    if (duplicates > 0) {
        warnings.push({
            code: 'duplicate_rows',
            message: `${duplicates.toFixed(1)}% of sampled rows are duplicates.`,
        });
        score -= Math.min(15, duplicates);
    }

    if (target) {
        if (!columns.includes(target)) {
            blockers.push({
                code: 'missing_target',
                column: target,
                message: `Target '${target}' is not present in the dataset.`,
            });
            score -= 30;
        } else {
            const targetValues = columnValues(rows, target);
            const targetPresent = targetValues.filter((value) => !isMissing(value));
            if (!targetPresent.length) {
                blockers.push({
                    code: 'empty_target',
                    column: target,
                    message: `Target '${target}' has no usable values.`,
                });
                score -= 30;
            }

            if (taskMode === TASK_MODES.CLASSIFICATION || taskMode === TASK_MODES.AUTO) {
                const imbalance = classImbalance(targetValues);
                if (imbalance && imbalance.minorityPercent <= 20) {
                    warnings.push({
                        code: 'class_imbalance',
                        column: target,
                        message: `Target '${target}' is imbalanced: smallest class is ${imbalance.minorityPercent.toFixed(1)}%.`,
                    });
                    score -= imbalance.minorityPercent < 10 ? 12 : 6;
                }
            }
        }
    } else {
        warnings.push({
            code: 'target_not_selected',
            message: 'Select a target column to get task-specific readiness guidance.',
        });
        score -= 5;
    }

    if (rows.length < 30) {
        warnings.push({
            code: 'small_dataset',
            message: 'The dataset is small; validation metrics may be unstable.',
        });
        score -= 5;
    }

    const targetCandidates = columns
        .map((column, index) => ({
            ...scoreTargetCandidate(column, columnValues(rows, column)),
            index,
        }))
        .sort((a, b) => b.score - a.score || b.index - a.index)
        .slice(0, 5)
        .map(({ index, ...candidate }) => candidate);

    if (featureExclusions.length) {
        suggestions.push({
            code: 'exclude_features',
            message: `Review or exclude ${[...new Set(featureExclusions)].join(', ')} before training.`,
        });
    }
    if (warnings.some((warning) => warning.code === 'class_imbalance')) {
        suggestions.push({
            code: 'rebalance_or_metric',
            message: 'Use class-balanced metrics such as macro F1 and consider rebalancing for the first benchmark.',
        });
    }
    if (!target && targetCandidates.length) {
        suggestions.push({
            code: 'target_candidate',
            message: `Suggested target: ${targetCandidates[0].column}.`,
        });
    }

    return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        taskMode,
        blockers,
        warnings,
        suggestions,
        targetCandidates,
        featureExclusions: [...new Set(featureExclusions)],
        summary: {
            rows: rows.length,
            columns: columns.length,
            missingPercent: Number(missingPercent.toFixed(2)),
            duplicatePercent: Number(duplicates.toFixed(2)),
        },
    };
}
