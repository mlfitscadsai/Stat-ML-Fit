/**
 * Safe column access for danfo DataFrames (works with bundled + code-split builds).
 */
export function dfColumn(frame, columnName) {
    if (frame == null) {
        throw new Error(`Dataset is required to read column "${columnName}"`);
    }
    if (typeof frame.column === 'function') {
        return frame.column(columnName);
    }
    const series = frame[columnName];
    if (series != null && series.values != null) {
        return series;
    }
    if (typeof frame.$getColumnData === 'function') {
        return frame.$getColumnData(columnName, true);
    }
    throw new Error(`Column "${columnName}" is not available on this dataset`);
}
