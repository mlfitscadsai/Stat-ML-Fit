import { describe, it, expect } from 'vitest';
import { getOutlierFlags, filterOutliersFromDataFrame, detectOutliers } from '../../src/helpers/outliers.js';
import { getDanfo } from '../../src/utils/danfo_loader';

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
            // NaN/null values are mapped to false and ignored in bounds calculation
            expect(flags).toEqual([false, false, false, false, false, true, false, false]);
        });
    });

    describe('filterOutliersFromDataFrame', () => {
        it('should filter out outlier rows and return a clean DataFrame', async () => {
            const danfo = await getDanfo();
            const data = {
                feat1: [1.5, 2, 1.8, 2.5, 1.8, 100, 2.1, 1.9],
                feat2: [10, 20, 30, 40, 50, 60, 70, 80],
                target: [0, 1, 0, 1, 0, 1, 0, 1]
            };
            const df = new danfo.DataFrame(data);
            const cleanDf = filterOutliersFromDataFrame(df, ['feat1'], 'iqr', 1.5);
            
            expect(cleanDf.shape[0]).toBe(7);
            expect(cleanDf.columns).toEqual(['feat1', 'feat2', 'target']);
            // The row with outlier 100 should be removed
            const values = cleanDf['feat1'].values;
            expect(values.includes(100)).toBe(false);
        });

        it('should return original DataFrame if no numeric columns specified', async () => {
            const danfo = await getDanfo();
            const df = new danfo.DataFrame({
                feat1: [1, 2, 3, 4]
            });
            const cleanDf = filterOutliersFromDataFrame(df, []);
            expect(cleanDf).toBe(df);
        });
    });
});
