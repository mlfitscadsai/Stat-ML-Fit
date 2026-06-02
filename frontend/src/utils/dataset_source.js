import { markRaw } from 'vue';
import { dfColumn, getFrameColumnNames, unwrapFrame } from '@/utils/danfo_frame';

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
    return getFrameColumnNames(frame);
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

/** Seeded row shuffle (matches sidebar upload shuffle style). */
export function sampleRows(rows, seed) {
    if (!rows?.length) return [];
    const indices = rows.map((_, i) => i);
    let state = Number(seed) || 123;
    for (let i = indices.length - 1; i > 0; i--) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        const j = state % (i + 1);
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.map((i) => rows[i]);
}

export function subsetRows(rows, columnNames) {
    return rows.map((row) => {
        const next = {};
        for (const col of columnNames) {
            next[col] = row[col];
        }
        return next;
    });
}

export function columnValuesFromRows(rows, columnName) {
    return rows.map((row) => row[columnName]);
}

export function inferColumnDtype(rows, columnName) {
    const sample = rows.find((row) => row[columnName] != null && row[columnName] !== '');
    const value = sample?.[columnName];
    return typeof value === 'string' ? 'string' : 'float32';
}

/**
 * Build a danfo DataFrame from plain row objects (reliable with script bundle).
 */
export function buildDataFrameFromRows(danfo, rows, columnNames) {
    if (!rows.length || !columnNames.length) {
        throw new Error('Cannot build a dataset with no rows or columns.');
    }
    let df = new danfo.DataFrame(rowsToColumnDict(rows, columnNames));
    if (!getFrameColumns(df).length) {
        df = new danfo.DataFrame(rows, { columns: columnNames });
    }
    if (!getFrameColumns(df).length && columnNames.length) {
        try {
            df.$columns = [...columnNames];
        } catch {
            /* read-only in some bundles */
        }
    }
    return df;
}

/** Minimal series-like object for training code that expects .values / .dtype */
export function seriesFromRows(rows, columnName) {
    return {
        values: columnValuesFromRows(rows, columnName),
        dtype: inferColumnDtype(rows, columnName),
        columns: [columnName],
    };
}

/** Ensure k-fold / split helpers can call `.iloc` on the target column. */
export function asDanfoSeries(danfo, seriesLike, columnName = 'target') {
    if (seriesLike != null && typeof seriesLike.iloc === 'function') {
        return seriesLike;
    }
    const values = seriesLike?.values ?? seriesLike;
    return new danfo.Series(values, { columns: [columnName] });
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
    if (!rowCount) return [];

    if (Array.isArray(df.$dataIncolumnFormat) && df.$dataIncolumnFormat.length >= cols.length) {
        const rows = [];
        for (let i = 0; i < rowCount; i++) {
            const row = {};
            for (let c = 0; c < cols.length; c++) {
                row[cols[c]] = df.$dataIncolumnFormat[c]?.[i];
            }
            rows.push(row);
        }
        return rows;
    }

    const rows = [];
    for (let i = 0; i < rowCount; i++) {
        const row = {};
        for (const col of cols) {
            const values = dfColumn(df, col, cols).values;
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
    if (columnNames.length > 0) {
        settings.setDatasetColumns(columnNames);
    }

    let df = new danfo.DataFrame(rowsToColumnDict(rows, columnNames));
    if (!getFrameColumns(df).length) {
        df = new danfo.DataFrame(rows, { columns: columnNames });
    }
    if (!getFrameColumns(df).length) {
        throw new Error(
            `Failed to build the training dataset (expected columns: ${columnNames.join(', ')}). Reload the dataset and try again.`
        );
    }
    return markRaw(df);
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
