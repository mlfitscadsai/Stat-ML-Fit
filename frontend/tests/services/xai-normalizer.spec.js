import { describe, expect, it } from 'vitest';
import { buildStoryboard } from '../../src/services/explainability/xai-normalizer.js';

describe('XAI normalizer', () => {
    it('builds classification storyboard insights from metrics and feature importance', () => {
        const storyboard = buildStoryboard({
            name: 'RF',
            modelTask: true,
            metrics: { accuracy: 0.91, f1_macro: 0.84 },
            model: { importances: [[0.2, 0.4], [0.1, 0.3]], pdp_grid: [[1, 2]], pdp_averages: [[0.1, 0.2]] },
            snapshot: { xFeatures: ['age', 'income'] },
        });

        expect(storyboard.supported).toBe(true);
        expect(storyboard.insights).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'metric' }),
            expect.objectContaining({ type: 'feature_importance', feature: 'income' }),
            expect.objectContaining({ type: 'partial_dependence' }),
        ]));
    });

    it('returns guardrail insight for unsupported runs', () => {
        const storyboard = buildStoryboard({ name: 'Unknown', metrics: {} });

        expect(storyboard.supported).toBe(false);
        expect(storyboard.insights[0].type).toBe('unsupported');
    });
});
