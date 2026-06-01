import { describe, expect, it, vi } from 'vitest';
import { createGemmaTools } from '../../src/services/gemma/tools.js';

describe('Gemma actionable tools', () => {
    it('diagnoses the current dataset from readiness state', async () => {
        const settings = {
            rawData: [{ x: 1, target: 'yes' }, { x: 2, target: 'no' }],
            target: 'target',
            taskMode: 'classification',
            results: [],
            features: [],
        };
        const tool = createGemmaTools(settings).find((item) => item.name === 'diagnose_dataset');

        const result = await tool.execute({});

        expect(JSON.parse(result.diagnosis)).toEqual(expect.objectContaining({
            score: expect.any(Number),
            warnings: expect.any(Array),
        }));
    });

    it('queues training draft actions instead of applying them directly', async () => {
        const settings = {
            rawData: [{ x: 1, target: 'yes' }, { x: 2, target: 'no' }],
            target: 'target',
            taskMode: 'classification',
            results: [],
            features: [],
            addPendingAssistantAction: vi.fn((action) => ({ id: 'a1', ...action, status: 'pending' })),
        };
        const tool = createGemmaTools(settings).find((item) => item.name === 'configure_training_draft');

        const result = await tool.execute({ algoId: 5, target: 'target' });

        expect(settings.addPendingAssistantAction).toHaveBeenCalledOnce();
        expect(result.action.status).toBe('pending');
    });
});
