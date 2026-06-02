/**
 * Safe column access for danfo DataFrames (script bundle, ESM, and Vue-reactive instances).
 */

export function unwrapFrame(frame) {
    if (frame == null) return frame;
    if (typeof frame.__v_raw !== 'undefined') return frame.__v_raw;
    return frame;
}

/** Column names from a danfo frame (works when Vue proxy hides `.columns`). */
export function getFrameColumnNames(frame) {
    const raw = unwrapFrame(frame);
    if (!raw) return [];
    if (Array.isArray(raw.columns) && raw.columns.length > 0) {
        return [...raw.columns];
    }
    if (Array.isArray(raw.$columns) && raw.$columns.length > 0) {
        return [...raw.$columns];
    }
    return [];
}

/**
 * Resolve a user-facing column name to an actual column on the frame (trim + case-insensitive).
 * @param {object} frame
 * @param {string} columnName
 * @param {string[]} [columnNames] optional list when frame metadata is unavailable
 */
export function resolveDataFrameColumnName(frame, columnName, columnNames = null) {
    const raw = unwrapFrame(frame);
    if (raw == null || columnName == null || columnName === '') {
        return columnName == null ? '' : String(columnName).trim();
    }
    const requested = String(columnName).trim();
    const cols = columnNames?.length ? columnNames : getFrameColumnNames(raw);
    if (!cols.length) return requested;
    if (cols.includes(requested)) return requested;
    const match = cols.find(
        (c) => String(c).trim().toLowerCase() === requested.toLowerCase()
    );
    return match != null ? match : requested;
}

function seriesValues(series) {
    if (series == null) return null;
    if (series.values != null) return series.values;
    if (series.$data != null) return series.$data;
    return null;
}

function columnViaPrototype(frame, resolvedName) {
    const proto = Object.getPrototypeOf(frame);
    if (proto && typeof proto.column === 'function' && proto.column !== frame.column) {
        return proto.column.call(frame, resolvedName);
    }
    return null;
}

function columnViaGetColumnData(frame, resolvedName) {
    const proto = Object.getPrototypeOf(frame);
    const fn = frame.$getColumnData ?? proto?.$getColumnData;
    if (typeof fn === 'function') {
        return fn.call(frame, resolvedName, true);
    }
    return null;
}

function columnViaColumnFormat(frame, resolvedName) {
    const idx = frame.columns?.indexOf(resolvedName);
    if (idx == null || idx < 0) return null;
    const data = frame.$dataIncolumnFormat?.[idx];
    if (data == null) return null;
    const dtype = frame.dtypes?.[idx];
    return {
        values: data,
        dtype,
        columns: [resolvedName],
    };
}

/**
 * @param {import('danfojs').DataFrame | Record<string, unknown>} frame
 * @param {string} columnName
 * @param {string[]} [fallbackColumnNames] when frame `.columns` is empty (e.g. Vue proxy)
 */
export function dfColumn(frame, columnName, fallbackColumnNames = null) {
    const raw = unwrapFrame(frame);
    if (raw == null) {
        throw new Error(`Dataset is required to read column "${columnName}"`);
    }

    const cols = getFrameColumnNames(raw);
    const nameList = fallbackColumnNames?.length ? fallbackColumnNames : cols;
    const resolvedName = resolveDataFrameColumnName(raw, columnName, nameList);
    if (nameList.length > 0 && !nameList.includes(resolvedName)) {
        const available = nameList.join(', ');
        throw new Error(
            `Column "${columnName}" is not available on this dataset. Available columns: ${available}`
        );
    }

    let series = null;

    try {
        series = columnViaPrototype(raw, resolvedName);
    } catch {
        series = null;
    }

    if (series == null && typeof raw.column === 'function') {
        try {
            series = raw.column(resolvedName);
        } catch {
            series = null;
        }
    }

    if (series == null) {
        try {
            series = raw[resolvedName];
        } catch {
            series = null;
        }
    }

    if (series == null) {
        try {
            series = columnViaGetColumnData(raw, resolvedName);
        } catch {
            series = null;
        }
    }

    if (series == null) {
        series = columnViaColumnFormat(raw, resolvedName);
    }

    if (series != null && seriesValues(series) != null) {
        return series;
    }

    const available = Array.isArray(cols) && cols.length ? cols.join(', ') : '(none)';
    throw new Error(
        `Column "${columnName}" is not available on this dataset. Available columns: ${available}`
    );
}
