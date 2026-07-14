/**
 * Target-column helpers for class merge / balance in EDA and training.
 */

export function normalizeTargetLabel(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (Number.isInteger(value)) return String(value);
        const rounded = Number(value.toFixed(6));
        return String(rounded);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === 'false') {
        return lower;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && String(numeric) === trimmed) {
        return String(Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(6)));
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

/** Merged display label for a transformation group, e.g. [{class:3},{class:4}] → "3_4". */
export function mergedLabelFromGroup(group) {
    if (!Array.isArray(group) || !group.length) return '';
    return group
        .map((entry) => normalizeTargetLabel(entry?.class))
        .filter(Boolean)
        .sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
            return String(a).localeCompare(String(b));
        })
        .join('_');
}

/** Index of the merge group whose merged label matches, or -1. */
export function findMergeGroupIndex(mergeGroups, mergedLabel) {
    const target = normalizeTargetLabel(mergedLabel);
    if (!target) return -1;
    return (mergeGroups || []).findIndex(
        (group) => mergedLabelFromGroup(group) === target,
    );
}

/** Expand a row label to original constituent labels (handles already-merged classes). */
export function expandClassLabel(classLabel, mergeGroups) {
    const idx = findMergeGroupIndex(mergeGroups, classLabel);
    if (idx >= 0) {
        return (mergeGroups[idx] || [])
            .map((entry) => normalizeTargetLabel(entry?.class))
            .filter(Boolean);
    }
    const single = normalizeTargetLabel(classLabel);
    return single ? [single] : [];
}

/** Resolve UI selection to sorted original labels for a new merge group. */
export function resolveSelectionToOriginalLabels(selectedRows, mergeGroups) {
    const labels = new Set();
    for (const row of selectedRows || []) {
        for (const label of expandClassLabel(row?.class, mergeGroups)) {
            labels.add(label);
        }
    }
    return [...labels].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });
}

/** Drop one merge group by its merged display label. */
export function removeMergeGroupByLabel(mergeGroups, mergedLabel) {
    const idx = findMergeGroupIndex(mergeGroups, mergedLabel);
    if (idx < 0) return (mergeGroups || []).slice();
    return (mergeGroups || []).filter((_, i) => i !== idx);
}

/**
 * Replace overlapping groups and append a new merge for the given original labels.
 * @param {Array<Array<{ class: unknown }>>} existingGroups
 * @param {string[]} labelsToMerge sorted original labels
 */
export function mergeGroupsAfterManualMerge(existingGroups, labelsToMerge) {
    const mergeSet = new Set((labelsToMerge || []).map((l) => normalizeTargetLabel(l)).filter(Boolean));
    if (mergeSet.size < 2) return (existingGroups || []).slice();

    const remaining = (existingGroups || []).filter((group) => {
        const members = group
            .map((entry) => normalizeTargetLabel(entry?.class))
            .filter(Boolean);
        const merged = mergedLabelFromGroup(group);
        if (mergeSet.has(merged)) return false;
        return !members.some((member) => mergeSet.has(member));
    });

    const newGroup = [...mergeSet].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    }).map((label) => ({ class: label }));

    return [...remaining, newGroup];
}

/**
 * Build class table rows from target values + active merge groups.
 */
export function buildClassInfoRows(values, mergeGroups) {
    const counts = new Map();
    for (const value of values || []) {
        const key = normalizeTargetLabel(value);
        if (key == null) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const total = values?.length || 1;

    return [...counts.entries()]
        .map(([cls, count]) => {
            const groupIdx = findMergeGroupIndex(mergeGroups, cls);
            const isMerged = groupIdx >= 0;
            const members = isMerged
                ? expandClassLabel(cls, mergeGroups)
                : [cls];
            const share = count / total;
            return {
                class: cls,
                count,
                mode: +share.toFixed(4),
                sharePct: +(share * 100).toFixed(1),
                isMerged,
                members,
                mergeGroupIndex: groupIdx,
                isRare: share < 0.05,
                isMinor: share < 0.10,
            };
        })
        .sort((a, b) => compareClassLabels(a.class, b.class));
}

/** Filter parallel column arrays by kept row indices. */
export function filterColumnsByIndices(columnValues, keptIndices) {
    if (!Array.isArray(keptIndices) || !keptIndices.length) {
        return columnValues;
    }
    const keepSet = new Set(keptIndices);
    const next = {};
    for (const [col, values] of Object.entries(columnValues || {})) {
        next[col] = (values || []).filter((_, index) => keepSet.has(index));
    }
    return next;
}

/** Compare class labels for stable sorting (numeric, then lexical). */
export function compareClassLabels(a, b) {
    const left = normalizeTargetLabel(a);
    const right = normalizeTargetLabel(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    const na = Number(left);
    const nb = Number(right);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(left).localeCompare(String(right));
}
