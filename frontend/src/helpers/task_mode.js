import { FeatureCategories } from "./settings.js";

export const TASK_MODES = {
    AUTO: 'auto',
    CLASSIFICATION: 'classification',
    REGRESSION: 'regression',
};

function toNumeric(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function sanitizeValues(values = []) {
    return values.filter(v => v !== null && v !== undefined && !Number.isNaN(v));
}

function collectNumericStats(values = []) {
    const cleanValues = sanitizeValues(values);
    const numericValues = cleanValues.map(toNumeric).filter(v => v !== null);
    const uniqueValues = [...new Set(numericValues)];
    const allIntegers = numericValues.length > 0 && numericValues.every(v => Number.isInteger(v));
    return { numericValues, uniqueValues, allIntegers };
}

export function detectTaskFromTarget(targetType, targetValues = []) {
    if (targetType !== FeatureCategories.Numerical.id) {
        return true;
    }

    const { uniqueValues, allIntegers } = collectNumericStats(targetValues);
    const hasFewDiscreteValues = uniqueValues.length > 0 && uniqueValues.length <= 20;
    return hasFewDiscreteValues && allIntegers;
}

export function resolveTaskMode(mode, autoClassification) {
    if (mode === TASK_MODES.CLASSIFICATION) {
        return true;
    }
    if (mode === TASK_MODES.REGRESSION) {
        return false;
    }
    return autoClassification;
}

export function validateModeCompatibility(mode, targetType, targetValues = []) {
    if (!targetValues || targetValues.length === 0) {
        return {
            valid: false,
            message: 'Selected target has no values. Please choose a different target column.',
        };
    }

    const { uniqueValues, allIntegers } = collectNumericStats(targetValues);

    if (mode === TASK_MODES.CLASSIFICATION) {
        const numericTarget = targetType === FeatureCategories.Numerical.id;
        if (!numericTarget) {
            return { valid: true };
        }
        if (uniqueValues.length > 30 || !allIntegers) {
            return {
                valid: false,
                message: 'Target looks continuous. Switch to Regression mode or choose a categorical target.',
            };
        }
        return { valid: true };
    }

    if (mode === TASK_MODES.REGRESSION) {
        if (targetType !== FeatureCategories.Numerical.id) {
            return {
                valid: false,
                message: 'Regression mode requires a numerical target column.',
            };
        }
        if (uniqueValues.length <= 1) {
            return {
                valid: false,
                message: 'Regression target needs at least two distinct values.',
            };
        }
        return { valid: true };
    }

    return { valid: true };
}
