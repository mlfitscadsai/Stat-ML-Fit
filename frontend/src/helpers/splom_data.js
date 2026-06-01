import { dfColumn } from '@/utils/danfo_frame';

/** Max numeric columns in SPLOM (Plotly grid cost grows as n²). */
export const MAX_SPLOM_FEATURES = 10;
/** Beyond this, skip target row/column (too many box/strip traces). */
export const MAX_SPLOM_CLASSES = 24;

export function labelKey(v) {
    if (v == null || v === '') return '\u0000';
    return String(v);
}

/**
 * Pick predictor columns + target handling for a stable SPLOM input.
 * @returns {{ error?: string, warnings: string[], matrixFeatureNames: string[], labelValues: any[]|null, items: any[][], extendTargetMargins: boolean }}
 */
export function prepareSplomInputs(dataframe, numericColumnNames, modelTarget, isClassification) {
    const warnings = [];
    if (!dataframe || !dataframe.columns) {
        return { error: 'Invalid dataframe.', warnings };
    }

    const cols = dataframe.columns;
    const exists = (name) => Boolean(name) && cols.includes(name);

    const presentNumeric = numericColumnNames.filter(exists);
    if (presentNumeric.length < 2) {
        return {
            error: 'Need at least 2 numeric columns that exist in the current dataset.',
            warnings,
        };
    }

    const targetOk = exists(modelTarget);
    if (!targetOk) {
        warnings.push(
            `Target "${modelTarget}" is missing from this dataset; using matrix without target coloring.`
        );
    }

    let matrixFeatureNames = [];
    let extendTargetMargins = false;

    if (isClassification && targetOk) {
        const predictors = presentNumeric.filter((c) => c !== modelTarget);
        if (predictors.length >= 2) {
            matrixFeatureNames = predictors.slice();
            extendTargetMargins = true;
        } else {
            matrixFeatureNames = presentNumeric.slice();
            extendTargetMargins = false;
            warnings.push(
                'Target is included in the numeric axes (or too few predictors); extra target row/column is hidden.'
            );
        }
    } else {
        matrixFeatureNames = presentNumeric.slice();
        extendTargetMargins = false;
    }

    if (matrixFeatureNames.length > MAX_SPLOM_FEATURES) {
        matrixFeatureNames = matrixFeatureNames.slice(0, MAX_SPLOM_FEATURES);
        warnings.push(
            `Showing the first ${MAX_SPLOM_FEATURES} numeric columns in the scatterplot matrix (performance limit).`
        );
    }

    const colsNeeded = new Set(matrixFeatureNames);
    if (targetOk) {
        colsNeeded.add(modelTarget);
    }

    let slice;
    try {
        slice = dataframe.loc({ columns: [...colsNeeded] });
    } catch (e) {
        return { error: `Could not select columns for SPLOM: ${e?.message || e}`, warnings };
    }

    try {
        slice.dropNa({ axis: 0, inplace: true });
    } catch (e) {
        return { error: `Failed to drop incomplete rows: ${e?.message || e}`, warnings };
    }

    let items;
    try {
        items = slice.loc({ columns: matrixFeatureNames }).values;
    } catch (e) {
        return { error: `Could not extract feature matrix: ${e?.message || e}`, warnings };
    }

    if (!Array.isArray(items) || items.length === 0) {
        return {
            error: 'No complete rows left after removing missing values in the selected columns.',
            warnings,
        };
    }

    let labelValues = null;
    if (targetOk) {
        try {
            labelValues = dfColumn(slice, modelTarget).values;
        } catch (e) {
            warnings.push('Could not read target column; drawing without target coloring.');
            labelValues = null;
        }
    }

    if (labelValues != null && labelValues.length !== items.length) {
        warnings.push('Target length does not match feature rows; disabling target coloring.');
        labelValues = null;
        extendTargetMargins = false;
    }

    if (extendTargetMargins && labelValues) {
        const keys = new Set(labelValues.map(labelKey));
        if (keys.size > MAX_SPLOM_CLASSES) {
            extendTargetMargins = false;
            warnings.push(
                `Too many distinct classes (${keys.size}); hiding extra target row/column. Points are still colored by class.`
            );
        }
    }

    return {
        warnings,
        matrixFeatureNames,
        labelValues,
        items,
        extendTargetMargins,
    };
}
