import { describe, expect, it } from 'vitest';
import { recommendModels, recommendNextStep } from '../../src/services/recommendations/recommendation-service.js';

describe('recommendation service', () => {
    const classificationRows = [
        { age: 30, income: 100, city: 'A', target: 'yes' },
        { age: 31, income: 110, city: 'B', target: 'yes' },
        { age: 29, income: 90, city: 'A', target: 'yes' },
        { age: 50, income: 120, city: 'C', target: 'no' },
    ];

    it('returns ranked model candidates with actionable reasons', () => {
        const recommendations = recommendModels(classificationRows, {
            target: 'target',
            taskMode: 'classification',
        });

        expect(recommendations.length).toBeGreaterThanOrEqual(3);
        expect(recommendations[0]).toEqual(expect.objectContaining({
            modelId: expect.any(Number),
            label: expect.any(String),
            score: expect.any(Number),
            tags: expect.arrayContaining([expect.any(String)]),
            reasons: expect.arrayContaining([expect.any(String)]),
        }));
    });

    it('recommends fixing blockers before training', () => {
        const step = recommendNextStep([{ x: 1, constant: 1 }, { x: 2, constant: 1 }], {
            target: 'missing',
            taskMode: 'classification',
        });

        expect(step.action).toBe('fix_readiness_blockers');
    });
});
