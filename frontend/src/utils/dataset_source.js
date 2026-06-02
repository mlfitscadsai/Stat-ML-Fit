import { markRaw } from 'vue';
import { dfColumn, unwrapFrame } from '@/utils/danfo_frame';

export { unwrapFrame };

/**
 * @returns {Record<string, unknown>[]}
 */
export function normalizeRawRows(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }
    const first = rawData[0];
    if (first == null || typeof first !== 'object' || Array.isArray(first)) {
        return [];
    }
    return rawData;
}

export function getFrameColumns(frame) {
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
 * Column names from store metadata (survives Pinia / danfo bundle quirks).
 * @param {object} settings
 * @param {Record<string, unknown>[]} [rows]
 * @returns {string[]}
 */
export function getStoredColumnNames(settings, rows = []) {
    if (Array.isArray(settings?.datasetColumns) && settings.datasetColumns.length > 0) {
        return [...settings.datasetColumns];
    }
    const normalized = rows.length ? rows : normalizeRawRows(settings?.rawData);
    if (normalized[0]) {
        return Object.keys(normalized[0]);
    }
    const fromDf = getFrameColumns(settings?.getDataset ?? settings?.df);
    if (fromDf.length) return fromDf;
    const features = settings?.features ?? settings?.items;
    if (Array.isArray(features) && features.length > 0) {
        return features.map((f) => f.name).filter(Boolean);
    }
    return [];
}

export function hasLoadedDataset(settings) {
    const rows = normalizeRawRows(settings?.rawData);
    if (rows.length > 0) return true;
    if (getStoredColumnNames(settings, rows).length > 0 && (settings?.datasetShape?.count ?? 0) > 0) {
        return true;
    }
    return getFrameColumns(settings?.getDataset ?? settings?.df).length > 0;
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} columnNames
 */
export function rowsToColumnDict(rows, columnNames) {
    const data = {};
    for (const col of columnNames) {
        data[col] = rows.map((row) => row[col]);
    }
    return data;
}

/**
 * @param {import('danfojs').DataFrame} frame
 * @param {string[]} [columnNames]
 * @returns {Record<string, unknown>[]}
 */
export function dataframeToRows(frame, columnNames = null) {
    const df = unwrapFrame(frame);
    const cols = columnNames?.length ? columnNames : getFrameColumns(df);
    if (!cols.length) return [];
    const rowCount = df.shape?.[0] ?? df.$data?.length ?? df.values?.length ?? 0;
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
        const row = {};
        for (const col of cols) {
            const values = dfColumn(df, col).values;
            row[col] = values[i];
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Build a training DataFrame from raw rows and explicit column metadata.
 * @param {Awaited<ReturnType<typeof import('@/utils/danfo_loader').getDanfo>>} danfo
 * @param {import('@/stores/settings').settingStore} settings
 */
export function createTrainingDataFrame(danfo, settings) {
    let rows = normalizeRawRows(settings.rawData);
    let columnNames = getStoredColumnNames(settings, rows);

    if (rows.length === 0) {
        const existing = unwrapFrame(settings.getDataset);
        if (existing) {
            columnNames = columnNames.length ? columnNames : getFrameColumns(existing);
            rows = dataframeToRows(existing, columnNames);
        }
    }

    if (!columnNames.length && rows[0]) {
        columnNames = Object.keys(rows[0]);
    }

    if (rows.length === 0 || columnNames.length === 0) {
        throw new Error(
            'Dataset is not loaded correctly. Choose the iris preset again (or upload your CSV), then train.'
        );
    }

    settings.setRawData(rows);
    settings.setDatasetColumns(columnNames);

    let df = new danfo.DataFrame(rowsToColumnDict(rows, columnNames));
    if (!getFrameColumns(df).length) {
        df = new danfo.DataFrame(rows, { columns: columnNames });
    }
    if (!getFrameColumns(df).length) {
        throw new Error(
            `Failed to build the training dataset (expected columns: ${columnNames.join(', ')}). Reload the dataset and try again.`
        );
    }
    return df;
}

export function getDataframeRowCount(frame) {
    const df = unwrapFrame(frame);
    if (!df) return 0;
    return df.shape?.[0] ?? df.$data?.length ?? df.values?.length ?? 0;
}

/** @param {import('danfojs').DataFrame | null | undefined} data */
export function storeDataframeInPinia(settings, data) {
    settings.setDataframe(data ? markRaw(data) : {});
}
