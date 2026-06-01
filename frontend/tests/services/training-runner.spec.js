import { describe, expect, it, vi } from 'vitest';
import { normalizeResult, pollProgress, recommend, runQuickBenchmark, runSidebarTraining, validateConfig } from '../../src/services/training/training-runner.js';

describe('training runner', () => {
    it('validates required training config before execution', () => {
        expect(validateConfig({ rawData: [], target: null })).toMatchObject({
            valid: false,
            message: expect.stringContaining('dataset'),
        });
        expect(validateConfig({ rawData: [{ x: 1 }], target: 'x', algoId: 5 })).toMatchObject({
            valid: true,
        });
    });

    it('normalizes result metrics for wizard display', () => {
        const normalized = normalizeResult({
            id: 15,
            metrics: { accuracy: 0.9234, rmse: 1.23456 },
        });

        expect(normalized.modelId).toBe('f');
        expect(normalized.metrics).toEqual([
            { name: 'Accuracy', value: 0.9234, display: '92.3%' },
            { name: 'Rmse', value: 1.23456, display: '1.2346' },
        ]);
    });

    it('emits real lifecycle progress around sidebar training', async () => {
        const sidebar = {
            train: vi.fn().mockResolvedValue(),
        };
        const store = {
            results: [{ id: 1, metrics: { accuracy: 0.8 } }],
        };
        const onProgress = vi.fn();

        const result = await runSidebarTraining({ sidebar, store, onProgress });

        expect(sidebar.train).toHaveBeenCalledOnce();
        expect(onProgress).toHaveBeenCalledWith(10, 'Validating dataset and model configuration...');
        expect(onProgress).toHaveBeenCalledWith(100, 'Training run completed.');
        expect(result.modelId).toBe('1');
    });

    it('proxies recommendations for training flows', () => {
        const models = recommend([{ x: 1, target: 'yes' }, { x: 2, target: 'no' }], {
            target: 'target',
            taskMode: 'classification',
        });

        expect(models.length).toBeGreaterThan(0);
    });

    it('runs a cancellable serial quick benchmark', async () => {
        const runner = vi.fn()
            .mockResolvedValueOnce({ modelId: 'a' })
            .mockResolvedValueOnce({ modelId: 'b' });
        const signal = { aborted: false };

        const results = await runQuickBenchmark({
            candidates: [{ modelId: 1 }, { modelId: 5 }],
            runCandidate: runner,
            signal,
        });

        expect(results).toHaveLength(2);
        expect(runner).toHaveBeenCalledTimes(2);
    });

    it('polls HPC progress through a job client', async () => {
        const jobClient = {
            pollJob: vi.fn().mockResolvedValue({ id: 'j1', status: 'running' }),
        };

        const job = await pollProgress('j1', { jobClient });

        expect(job.status).toBe('running');
    });
});
