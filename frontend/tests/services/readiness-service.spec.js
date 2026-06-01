import { describe, expect, it } from 'vitest';
import { analyzeReadiness } from '../../src/services/data-readiness/readiness-service.js';

describe('data readiness service', () => {
    it('flags blockers and warnings that affect classification readiness', () => {
        const rows = [
            { id: 'a1', age: 10, constant: 1, label: 'yes' },
            { id: 'a2', age: 11, constant: 1, label: 'yes' },
            { id: 'a3', age: 12, constant: 1, label: 'yes' },
            { id: 'a4', age: 13, constant: 1, label: 'yes' },
            { id: 'a5', age: 14, constant: 1, label: 'yes' },
            { id: 'a6', age: 15, constant: 1, label: 'yes' },
            { id: 'a7', age: 16, constant: 1, label: 'yes' },
            { id: 'a8', age: 17, constant: 1, label: 'yes' },
            { id: 'a9', age: 18, constant: 1, label: 'no' },
            { id: 'a9', age: 18, constant: 1, label: 'no' },
        ];

        const readiness = analyzeReadiness(rows, {
            target: 'label',
            taskMode: 'classification',
        });

        expect(readiness.taskMode).toBe('classification');
        expect(readiness.score).toBeLessThan(100);
        expect(readiness.blockers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'constant_column', column: 'constant' }),
            ])
        );
        expect(readiness.warnings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'duplicate_rows' }),
                expect.objectContaining({ code: 'id_like_column', column: 'id' }),
                expect.objectContaining({ code: 'class_imbalance', column: 'label' }),
            ])
        );
        expect(readiness.suggestions.length).toBeGreaterThan(0);
    });

    it('recommends likely target columns deterministically', () => {
        const rows = [
            { feature: 1, survived: 0, notes: 'a' },
            { feature: 2, survived: 1, notes: 'b' },
            { feature: 3, survived: 1, notes: 'c' },
        ];

        const readiness = analyzeReadiness(rows, { taskMode: 'auto' });

        expect(readiness.targetCandidates[0]).toMatchObject({
            column: 'survived',
            reason: expect.stringContaining('name'),
        });
    });
});
