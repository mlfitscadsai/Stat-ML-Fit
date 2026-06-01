import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';

function stubLocalStorage() {
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        },
        configurable: true,
    });
}

vi.mock('@/utils/danfo_loader', () => ({
    getPlotly: vi.fn(() => Promise.resolve({})),
}));

import DatasetHealthComponent from '../../src/components/dataset-health-component.vue';

function mountDatasetHealth() {
    stubLocalStorage();
    const pinia = createTestingPinia({
        createSpy: vi.fn,
        stubActions: true,
    });
    return mount(DatasetHealthComponent, {
        global: {
            plugins: [pinia],
        },
    });
}

describe('DatasetHealthComponent.vue — outlier methods', () => {
    afterEach(() => vi.restoreAllMocks());

    it('exposes Isolation Forest as an outlier method', () => {
        const wrapper = mountDatasetHealth();

        expect(wrapper.vm.outlierMethods).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'isolation',
                    label: 'Isolation Forest',
                }),
            ])
        );
    });

    it('flags an isolated extreme value with Isolation Forest', () => {
        const wrapper = mountDatasetHealth();
        const values = Array.from({ length: 30 }, (_, i) => i + 1).concat(1000);

        const result = wrapper.vm.detectOutliers(values, 'isolation');

        expect(result.count).toBeGreaterThan(0);
        expect(result.sample).toContain(1000);
        expect(result.scoreThreshold).toBe(0.62);
    });
});
