import { describe, it, expect, vi } from 'vitest';
import {
    normalizeRawRows,
    hasLoadedDataset,
    dataframeToRows,
    createTrainingDataFrame,
} from '../../src/utils/dataset_source';

describe('dataset_source.js', () => {
    it('normalizeRawRows rejects non-arrays and empty objects', () => {
        expect(normalizeRawRows({})).toEqual([]);
        expect(normalizeRawRows(null)).toEqual([]);
        expect(normalizeRawRows([{ a: 1 }])).toEqual([{ a: 1 }]);
    });

    it('hasLoadedDataset accepts store df when rawData is empty', () => {
        const settings = {
            rawData: {},
            getDataset: { columns: ['Species'], shape: [2, 1] },
        };
        expect(hasLoadedDataset(settings)).toBe(true);
    });

    it('createTrainingDataFrame falls back to store df when rawData is empty', () => {
        const danfo = {
            DataFrame: vi.fn((rows) => {
                const cols = rows[0] ? Object.keys(rows[0]) : [];
                return {
                    columns: cols,
                    shape: [rows.length, cols.length],
                    copy() {
                        return this;
                    },
                };
            }),
        };
        const store = {
            rawData: {},
            getDataset: {
                columns: ['Species'],
                shape: [2, 1],
                column(name) {
                    return { values: name === 'Species' ? ['A', 'B'] : [] };
                },
                copy() {
                    return this;
                },
            },
            setRawData: vi.fn(),
        };
        const df = createTrainingDataFrame(danfo, store);
        expect(df.columns).toContain('Species');
        expect(store.setRawData).toHaveBeenCalled();
    });

    it('dataframeToRows extracts row objects', () => {
        const frame = {
            columns: ['Species'],
            shape: [2, 1],
            column(name) {
                return { values: name === 'Species' ? ['A', 'B'] : [] };
            },
        };
        expect(dataframeToRows(frame)).toEqual([
            { Species: 'A' },
            { Species: 'B' },
        ]);
    });
});
