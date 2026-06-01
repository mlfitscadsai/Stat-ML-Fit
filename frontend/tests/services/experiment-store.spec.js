import { describe, expect, it } from 'vitest';
import { createExperimentRecord, datasetFingerprint } from '../../src/services/experiments/experiment-store.js';

describe('experiment store serialization', () => {
    it('builds a stable dataset fingerprint from shape, columns, and sample data', () => {
        const rows = [
            { a: 1, b: 'x' },
            { a: 2, b: 'y' },
        ];

        expect(datasetFingerprint({ name: 'demo', rows, columns: ['a', 'b'] })).toBe(
            datasetFingerprint({ name: 'demo', rows, columns: ['a', 'b'] })
        );
        expect(datasetFingerprint({ name: 'other', rows, columns: ['a', 'b'] })).not.toBe(
            datasetFingerprint({ name: 'demo', rows, columns: ['a', 'b'] })
        );
    });

    it('removes non-serializable result fields from experiment records', () => {
        const record = createExperimentRecord({
            result: {
                id: 3,
                name: 'Random Forest',
                metrics: { accuracy: 0.9 },
                model: { train() {} },
                snapshot: { x: { values: [[1]] } },
            },
            datasetName: 'demo',
            rawData: [{ x: 1, y: 0 }],
            config: { target: 'y', seed: 123 },
        });

        expect(record).toMatchObject({
            id: 3,
            model: 'Random Forest',
            metrics: { accuracy: 0.9 },
            config: { target: 'y', seed: 123 },
            datasetName: 'demo',
        });
        expect(record.modelObject).toBeUndefined();
        expect(record.snapshot).toBeUndefined();
        expect(JSON.stringify(record)).toContain('Random Forest');
    });
});
