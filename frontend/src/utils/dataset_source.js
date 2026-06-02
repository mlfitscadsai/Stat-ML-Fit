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

export function hasLoadedDataset(settings) {
    const rows = normalizeRawRows(settings?.rawData);
    if (rows.length > 0) return true;
    const df = unwrapFrame(settings?.getDataset ?? settings?.df);
    return Boolean(df?.columns?.length);
}

/**
 * @param {import('danfojs').DataFrame} frame
 * @returns {Record<string, unknown>[]}
 */
export function dataframeToRows(frame) {
    const df = unwrapFrame(frame);
    if (!df?.columns?.length) return [];
    const rowCount = df.shape?.[0] ?? df.$data?.length ?? df.values?.length ?? 0;
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
        const row = {};
        for (const col of df.columns) {
            const values = dfColumn(df, col).values;
            row[col] = values[i];
        }
        rows.push(row);
    }
    return rows;
}

/**
 * Build a training DataFrame from raw rows or the dataframe already in the Pinia store.
 * @param {ReturnType<typeof import('@/utils/danfo_loader').getDanfo>} danfo
 * @param {import('@/stores/settings').settingStore} settings
 */
export function createTrainingDataFrame(danfo, settings) {
    const rows = normalizeRawRows(settings.rawData);
    if (rows.length > 0) {
        const fromRaw = new danfo.DataFrame(rows);
        if (fromRaw.columns?.length > 0) {
            return fromRaw;
        }
    }

    const existing = unwrapFrame(settings.getDataset);
    if (!existing?.columns?.length) {
        throw new Error(
            'Dataset is not loaded correctly. Reload iris (or your CSV) from the sidebar, then train again.'
        );
    }

    if (typeof existing.copy === 'function') {
        const copy = existing.copy();
        const backfill = normalizeRawRows(settings.rawData);
        if (backfill.length === 0) {
            settings.setRawData(dataframeToRows(copy));
        }
        return copy;
    }

    const extracted = dataframeToRows(existing);
    if (!extracted.length) {
        throw new Error(
            'Could not read dataset rows from memory. Reload the dataset from the sidebar, then train again.'
        );
    }
    settings.setRawData(extracted);
    return new danfo.DataFrame(extracted);
}

export function getDataframeRowCount(frame) {
    const df = unwrapFrame(frame);
    if (!df) return 0;
    return df.shape?.[0] ?? df.$data?.length ?? df.values?.length ?? 0;
}
