import { describe, it, expect, vi } from 'vitest';
import { getOutlierFlags, filterOutliersFromDataFrame, detectOutliers } from '../../src/helpers/outliers.js';

vi.mock('@/utils/danfo_frame', () => ({
    dfColumn: vi.fn((df, col) => ({
        values: df.$data.map((row) => row[df.columns.indexOf(col)]),
    })),
}));

function createMockDataFrame(data) {
    const columns = Object.keys(data);
    const rowCount = data[columns[0]].length;
    const $data = Array.from({ length: rowCount }, (_, rowIndex) =>
        columns.map((column) => data[column][rowIndex]),
    );
    const frame = {
        $data,
        columns,
        shape: [rowCount, columns.length],
        iloc({ rows }) {
            const indices = Array.isArray(rows)
                ? rows
                : String(rows).split(',').map(Number);
            const nextColumns = columns.reduce((acc, column, columnIndex) => {
                acc[column] = indices.map((rowIndex) => $data[rowIndex][columnIndex]);
                return acc;
            }, {});
            return createMockDataFrame(nextColumns);
        },
    };
    columns.forEach((column) => {
        frame[column] = { values: data[column] };
    });
    return frame;
}

describe('Outlier Detection Helper', () => {
    describe('detectOutliers', () => {
        it('should correctly flag IQR outliers', () => {
            const values = [1.5, 2, 1.8, 2.5, 1.8, 100, 2.1, 1.9];
            const result = detectOutliers(values, 'iqr', 1.5);
            expect(result).not.toBeNull();
            expect(result.count).toBe(1);
            expect(result.minOutlier).toBe(100);
            expect(result.maxOutlier).toBe(100);
        });

        it('should return null for tiny datasets (< 4 elements)', () => {
            const values = [1, 2, 3];
            const result = detectOutliers(values, 'iqr');
            expect(result).toBeNull();
        });
    });

    describe('getOutlierFlags', () => {
        it('should return all false if dataset has fewer than 4 elements', () => {
            const values = [1, 2, 3];
            const flags = getOutlierFlags(values, 'iqr');
            expect(flags).toEqual([false, false, false]);
        });

        it('should flag outliers with IQR method', () => {
            const values = [1.5, 2, 1.8, 2.5, 1.8, 100, 2.1, 1.9];
            const flags = getOutlierFlags(values, 'iqr', 1.5);
            expect(flags).toEqual([false, false, false, false, false, true, false, false]);
        });

        it('should flag outliers with zscore method', () => {
            const values = [2, 2.1, 2.2, 1.9, 2.0, 100, 2.05, 1.95];
            const flags = getOutlierFlags(values, 'zscore', 2);
            expect(flags).toEqual([false, false, false, false, false, true, false, false]);
        });

        it('should flag outliers with MAD method', () => {
            const values = [10, 10.5, 9.5, 10, 10.2, 100, 9.8, 10.1];
            const flags = getOutlierFlags(values, 'mad', 3);
            expect(flags).toEqual([false, false, false, false, false, true, false, false]);
        });

        it('should handle NaN and non-finite values gracefully', () => {
            const values = [2, null, 2.1, 2.2, undefined, 100, 2.0, NaN];
            const flags = getOutlierFlags(values, 'iqr', 1.5);
            expect(flags).toEqual([false, false, false, false, false, true, false, false]);
        });
    });

    describe('filterOutliersFromDataFrame', () => {
        it('should filter out outlier rows and return a clean DataFrame', () => {
            const data = {
                feat1: [1.5, 2, 1.8, 2.5, 1.8, 100, 2.1, 1.9],
                feat2: [10, 20, 30, 40, 50, 60, 70, 80],
                target: [0, 1, 0, 1, 0, 1, 0, 1],
            };
            const df = createMockDataFrame(data);
            const cleanDf = filterOutliersFromDataFrame(df, ['feat1'], 'iqr', 1.5);

            expect(cleanDf.shape[0]).toBe(7);
            expect(cleanDf.columns).toEqual(['feat1', 'feat2', 'target']);
            const values = cleanDf.feat1.values;
            expect(values.includes(100)).toBe(false);
        });

        it('should return original DataFrame if no numeric columns specified', () => {
            const df = createMockDataFrame({
                feat1: [1, 2, 3, 4],
            });
            const cleanDf = filterOutliersFromDataFrame(df, []);
            expect(cleanDf).toBe(df);
        });
    });
});
