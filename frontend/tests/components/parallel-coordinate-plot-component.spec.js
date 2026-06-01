import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Buefy from 'buefy';
import { settingStore } from '../../src/stores/settings.js';

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
    getDanfo: vi.fn(() => Promise.resolve({
        DataFrame: class {
            constructor(data) {
                this.$data = data || [];
                this.columns = [];
            }
            replace() { return this; }
            dropNa() { return this; }
            column() { return { values: [] }; }
            loc() { return this; }
        }
    })),
    getPlotly: vi.fn(() => Promise.resolve({})),
    highChartLoader: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/helpers/charts', () => ({
    ChartController: class {
        constructor() {}
        async parallelCoordinatePlot() {}
    }
}));

vi.mock('@/helpers/utils', () => ({
    applyDataTransformation: vi.fn(() => Promise.resolve()),
}));

import PCPComponent from '../../src/components/visualization/parallel-coordinate-plot-component.vue';

async function mountPCP({ reducedMotion = false, stateOverrides = {} } = {}) {
    stubLocalStorage();
    window.matchMedia = vi.fn(() => ({
        matches: reducedMotion,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    }));

    const pinia = createTestingPinia({
        createSpy: vi.fn,
        stubActions: true,
    });
    const wrapper = mount(PCPComponent, {
        global: {
            plugins: [pinia, Buefy],
            stubs: { 'b-loading': true },
        },
    });
    const store = settingStore();
    store.$patch({
        features: [],
        rawData: [],
        target: null,
        isClassification: false,
        ...stateOverrides,
    });
    await flushPromises();
    await wrapper.vm.$nextTick();
    return { wrapper, store };
}

describe('ParallelCoordinatePlotComponent.vue — UX redesign', () => {
    afterEach(() => vi.restoreAllMocks());

    it('renders the empty state when there is no target or numeric feature', async () => {
        const { wrapper } = await mountPCP();
        const empty = wrapper.find('.distributions-empty');
        expect(empty.exists()).toBe(true);
        expect(empty.text()).toContain('target');
        expect(wrapper.vm.viewState).toBe('empty');
    });

    it('exposes region role + aria-label for accessibility', async () => {
        const { wrapper } = await mountPCP();
        const region = wrapper.find('section.distributions-card');
        expect(region.attributes('role')).toBe('region');
        expect(region.attributes('aria-label')).toBe('Parallel Coordinate Plot');
    });

    it('applies is-reduced-motion when prefers-reduced-motion: reduce matches', async () => {
        const { wrapper } = await mountPCP({ reducedMotion: true });
        expect(wrapper.vm.prefersReducedMotion).toBe(true);
        expect(wrapper.find('.distributions-card.is-reduced-motion').exists()).toBe(true);
    });

    it('renders a skeleton when target + features are set but the plot has not drawn yet', async () => {
        const { wrapper } = await mountPCP({
            stateOverrides: {
                rawData: [{ a: 1, b: 2 }],
                features: [{ name: 'a', selected: true, type: 1, scaler: 0 }],
                target: 'b',
            },
        });
        // hasPlotDrawn remains false because we stubbed the real ChartController,
        // so viewState should be 'loading' and the skeleton should render.
        expect(wrapper.vm.viewState).toBe('loading');
        expect(wrapper.find('.distributions-skeleton--strip').exists()).toBe(true);
    });
});
