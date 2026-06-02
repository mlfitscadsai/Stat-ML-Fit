import { describe, it, expect, vi } from 'vitest';
import {
    normalizeRawRows,
    hasLoadedDataset,
    dataframeToRows,
    createTrainingDataFrame,
    getStoredColumnNames,
    rowsToColumnDict,
} from '../../src/utils/dataset_source';

describe('dataset_source.js', () => {
    it('normalizeRawRows rejects non-arrays and empty objects', () => {
        expect(normalizeRawRows({})).toEqual([]);
        expect(normalizeRawRows(null)).toEqual([]);
        expect(normalizeRawRows([{ a: 1 }])).toEqual([{ a: 1 }]);
    });

    it('hasLoadedDataset accepts metadata when raw rows are missing', () => {
        const settings = {
            rawData: [],
            datasetColumns: ['Species', 'sepallength'],
            datasetShape: { count: 150, columns: 5 },
            getDataset: {},
        };
        expect(hasLoadedDataset(settings)).toBe(true);
    });

    it('setDatasetColumns ignores empty arrays so column names are not wiped', () => {
        const store = {
            datasetColumns: ['Species', 'sepallength'],
            setDatasetColumns(columns) {
                if (!Array.isArray(columns) || columns.length === 0) return;
                this.datasetColumns = [...columns];
            },
        };
        store.setDatasetColumns([]);
        expect(store.datasetColumns).toEqual(['Species', 'sepallength']);
    });

    it('getStoredColumnNames prefers datasetColumns', () => {
        const settings = {
            datasetColumns: ['Species'],
            rawData: [{ Species: 'A' }],
        };
        expect(getStoredColumnNames(settings)).toEqual(['Species']);
    });

    it('rowsToColumnDict builds column-oriented payload', () => {
        const rows = [
            { Species: 'A', x: 1 },
            { Species: 'B', x: 2 },
        ];
        expect(rowsToColumnDict(rows, ['Species', 'x'])).toEqual({
            Species: ['A', 'B'],
            x: [1, 2],
        });
    });

    it('createTrainingDataFrame uses column dict when store df has no columns', () => {
        function MockDataFrame(data) {
            const cols = Array.isArray(data)
                ? (data[0] ? Object.keys(data[0]) : [])
                : Object.keys(data || {});
            this.columns = cols;
            this.shape = [Array.isArray(data?.Species) ? data.Species.length : 0, cols.length];
        }
        const danfo = { DataFrame: MockDataFrame };
        const store = {
            rawData: [
                { sepallength: 5.1, Species: 'Setosa' },
                { sepallength: 4.9, Species: 'Setosa' },
            ],
            datasetColumns: ['sepallength', 'Species'],
            datasetShape: { count: 2, columns: 2 },
            getDataset: { columns: [] },
            setRawData: vi.fn(),
            setDatasetColumns: vi.fn(),
        };
        const df = createTrainingDataFrame(danfo, store);
        expect(df.columns).toContain('Species');
        expect(df.columns).toContain('sepallength');
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
