/**
 * Target-column helpers for class merge / balance in EDA and training.
 */

export function normalizeTargetLabel(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number.isInteger(value) ? String(value) : String(value);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && String(numeric) === trimmed) {
        return String(numeric);
    }
    return trimmed;
}

export function targetLabelsMatch(a, b) {
    const left = normalizeTargetLabel(a);
    const right = normalizeTargetLabel(b);
    return left != null && right != null && left === right;
}

/**
 * Replace matching target values in a plain array (handles number/string mismatch).
 */
export function replaceTargetClassInValues(values, fromClass, toClass) {
    return values.map((value) => (targetLabelsMatch(value, fromClass) ? toClass : value));
}

/**
 * Apply manual merge groups from settings.classTransformations.
 * @param {Array<unknown>} values
 * @param {Array<Array<{ class: unknown }>>} mergeGroups
 */
export function applyClassMergeGroupsToValues(values, mergeGroups) {
    let next = values.slice();
    for (const group of mergeGroups || []) {
        if (!Array.isArray(group) || !group.length) continue;
        const labels = group
            .map((entry) => normalizeTargetLabel(entry?.class))
            .filter(Boolean)
            .sort();
        const newClass = labels.join('_');
        for (const entry of group) {
            next = replaceTargetClassInValues(next, entry.class, newClass);
        }
    }
    return next;
}

/**
 * Write merged/balanced values back into a danfo DataFrame target column.
 */
export function setTargetColumnValues(df, targetColumn, values) {
    if (!df?.columns?.includes(targetColumn) || !Array.isArray(values)) return;
    try {
        df.addColumn(targetColumn, values, { inplace: true });
    } catch {
        try {
            df[targetColumn] = values;
        } catch {
            /* best effort */
        }
    }
}

/**
 * Robust danfo.replace wrapper for target columns (numeric vs string labels).
 */
export function replaceTargetClassInDataframe(df, targetColumn, fromClass, toClass) {
    if (!df?.columns?.includes(targetColumn)) return;
    let values;
    try {
        values = df[targetColumn]?.values ?? df.column?.(targetColumn)?.values;
    } catch {
        return;
    }
    if (!Array.isArray(values)) return;
    const updated = replaceTargetClassInValues(values, fromClass, toClass);
    setTargetColumnValues(df, targetColumn, updated);
}

export function applyClassMergeGroupsToDataframe(df, targetColumn, mergeGroups) {
    if (!df?.columns?.includes(targetColumn)) return;
    let values;
    try {
        values = df[targetColumn]?.values ?? df.column?.(targetColumn)?.values;
    } catch {
        return;
    }
    if (!Array.isArray(values)) return;
    setTargetColumnValues(df, targetColumn, applyClassMergeGroupsToValues(values, mergeGroups));
}
