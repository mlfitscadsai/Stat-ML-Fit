/**
 * Shared EDA dataframe pipeline for Scatterplot Matrix and Parallel Coordinate Plot.
 * Keeps class merges, row filters, seed sampling, and feature scaling consistent.
 */

import { dfColumn } from '@/utils/danfo_frame';
import { transformColumnValues } from '@/helpers/utils';
import {
    applyClassMergeGroupsToDataframe,
    filterColumnsByIndices,
} from '@/helpers/target_class_utils';

export function getEdaCacheKey({
    rawRowCount = 0,
    seed = 0,
    classTransformations = [],
    edaRowKeepIndices = null,
    modelTarget = '',
} = {}) {
    const mergeSig = JSON.stringify(classTransformations || []);
    const keepSig = JSON.stringify(edaRowKeepIndices || []);
    return `${rawRowCount}:${seed}:${mergeSig}:${keepSig}:${modelTarget || ''}`;
}

/**
 * Build column value arrays: raw → class merges → seeded sample → optional row filter.
 */
export async function buildEdaBaseValues({
    rawData,
    modelTarget,
    isClassification,
    mergedClasses,
    seed,
    edaRowKeepIndices,
    danfo,
}) {
    if (!Array.isArray(rawData) || !rawData.length || !danfo) {
        return { columns: [], values: {} };
    }

    let df = new danfo.DataFrame(rawData);

    if (
        isClassification
        && modelTarget
        && df.columns?.includes(modelTarget)
        && mergedClasses?.length
    ) {
        applyClassMergeGroupsToDataframe(df, modelTarget, mergedClasses);
    }

    const rowCount = df.$data?.length ?? df.shape?.[0] ?? rawData.length;
    if (rowCount > 0) {
        df = await df.sample(rowCount, { seed });
    }
    df.dropNa({ axis: 1, inplace: true });

    const columns = (df.columns || []).slice();
    let values = {};
    for (const col of columns) {
        try {
            values[col] = dfColumn(df, col).values.slice();
        } catch {
            values[col] = [];
        }
    }

    if (Array.isArray(edaRowKeepIndices) && edaRowKeepIndices.length) {
        values = filterColumnsByIndices(values, edaRowKeepIndices);
    }

    return { columns, values };
}

/** Apply per-feature scalers from settings onto cached base values. */
export function buildEdaDisplayValues(baseCache, settings) {
    if (!baseCache?.columns?.length) {
        return {};
    }
    const data = {};
    for (const col of baseCache.columns) {
        let colValues = (baseCache.values[col] || []).slice();
        const feature = (settings.items || []).find(
            (item) => item.name === col && item.selected && item.type === 1,
        );
        if (feature && feature.scaler != 0) {
            colValues = transformColumnValues(colValues, feature.scaler);
        }
        data[col] = colValues;
    }
    return data;
}

export function buildEdaDisplayDataframe(baseCache, settings, danfo) {
    const data = buildEdaDisplayValues(baseCache, settings);
    if (!Object.keys(data).length) {
        return new danfo.DataFrame({});
    }
    return new danfo.DataFrame(data);
}

/** Settings snapshot passed into the shared EDA builders. */
export function edaContextFromSettings(settings) {
    const raw = settings.rawData;
    return {
        rawData: raw,
        rawRowCount: Array.isArray(raw) ? raw.length : 0,
        modelTarget: settings.modelTarget,
        isClassification: settings.isClassification,
        mergedClasses: settings.mergedClasses,
        seed: settings.getSeed,
        edaRowKeepIndices: settings.edaRowKeepIndices,
        classTransformations: settings.classTransformations,
    };
}
