/**
 * Safe column access for danfo DataFrames (script bundle, ESM, and Vue-reactive instances).
 */

export function unwrapFrame(frame) {
    if (frame == null) return frame;
    if (typeof frame.__v_raw !== 'undefined') return frame.__v_raw;
    return frame;
}

/**
 * Resolve a user-facing column name to an actual column on the frame (trim + case-insensitive).
 */
export function resolveDataFrameColumnName(frame, columnName) {
    const raw = unwrapFrame(frame);
    if (raw == null || columnName == null || columnName === '') {
        return columnName == null ? '' : String(columnName).trim();
    }
    const requested = String(columnName).trim();
    const cols = raw.columns;
    if (!Array.isArray(cols) || cols.length === 0) return requested;
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
 */
export function dfColumn(frame, columnName) {
    const raw = unwrapFrame(frame);
    if (raw == null) {
        throw new Error(`Dataset is required to read column "${columnName}"`);
    }

    const resolvedName = resolveDataFrameColumnName(raw, columnName);
    const cols = raw.columns;
    if (Array.isArray(cols) && cols.length > 0 && !cols.includes(resolvedName)) {
        const available = cols.join(', ');
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
