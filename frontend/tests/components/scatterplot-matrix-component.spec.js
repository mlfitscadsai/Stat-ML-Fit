import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Stub the heavy dependencies so the component can mount in jsdom without
// pulling in danfo/plotly/highcharts. The UX redesign doesn't touch any of
// the computation paths; we only need the template + computeds to execute.
vi.mock('@/utils/danfo_loader', () => ({
    getDanfo: vi.fn(() => Promise.resolve({
        DataFrame: class {
            constructor(data) {
                this.$data = data || [];
                this.columns = [];
            }
            sample() { return this; }
            dropNa() { return this; }
            replace() { return this; }
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
        async ScatterplotMatrix() {}
        async parallelCoordinatePlot() {}
        downloadPlot() {}
    }
}));

vi.mock('@/helpers/utils', () => ({
    applyDataTransformation: vi.fn(() => Promise.resolve()),
    metrics: {},
    encode_name: (x) => x,
    scale_data: (x) => x,
    confusionMatrix: () => ({}),
}));

vi.mock('@/helpers/splom_data', () => ({
    prepareSplomInputs: vi.fn(() => ({
        items: [],
        warnings: [],
        matrixFeatureNames: [],
        labelValues: [],
        extendTargetMargins: {},
        error: null,
    }))
}));

import ScatterplotMatrixComponent from '../../src/components/visualization/scatterplot-matrix-component.vue';

/** Mount helper that installs pinia + buefy, stubs child PCP + buefy tooltip. */
async function mountSplom({ reducedMotion = false, stateOverrides = {} } = {}) {
    stubLocalStorage();
    const mqlListeners = [];
    const mql = {
        matches: reducedMotion,
        addEventListener: (_type, cb) => mqlListeners.push(cb),
        removeEventListener: () => {},
        addListener: (cb) => mqlListeners.push(cb),
        removeListener: () => {},
    };
    window.matchMedia = vi.fn(() => mql);

    const pinia = createTestingPinia({
        createSpy: vi.fn,
        stubActions: true,
    });

    const wrapper = mount(ScatterplotMatrixComponent, {
        global: {
            plugins: [pinia, Buefy],
            stubs: {
                'parallel-coordinate-plot-component': {
                    name: 'ParallelCoordinatePlotStub',
                    template: '<div class="pcp-stub" />',
                    methods: { ParallelCoordinatePlot() {} },
                },
                'b-loading': true,
                'b-table': true,
                'b-tooltip': { template: '<span><slot /></span>' },
            },
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
    return { wrapper, store, mql };
}

describe('ScatterplotMatrixComponent.vue — UX redesign', () => {
    beforeEach(() => {
        // Every test gets its own matchMedia stub inside mountSplom.
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the empty state when fewer than 2 numeric features are selected', async () => {
        const { wrapper } = await mountSplom();

        const empty = wrapper.find('.distributions-empty');
        expect(empty.exists()).toBe(true);
        expect(empty.text()).toContain('Select at least 2 numeric features');
        expect(wrapper.vm.viewState).toBe('empty');

        // Scaler toolbar must not be shown in empty state.
        const toolbar = wrapper.find('.distributions-scaler-bar');
        // v-show hides via display:none, but easier: toolbar itself renders with v-show,
        // and it is only shown when selectedFeatureColumns.length > 0 and viewState !== 'empty'.
        if (toolbar.exists()) {
            // When rendered, it must be display: none under v-show.
            expect(toolbar.attributes('style') || '').toContain('display: none');
        }
    });

    it('renders a responsive grid toolbar with no inline pixel width when features are selected', async () => {
        const { wrapper } = await mountSplom({
            stateOverrides: {
                rawData: [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }],
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 0 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                    { name: 'c', selected: true, type: 1, scaler: 0 },
                ],
            },
        });

        const toolbarInner = wrapper.find('.distributions-scaler-bar__inner');
        expect(toolbarInner.exists()).toBe(true);

        // No descendant should carry an inline "width: Npx" style — that's the old
        // width-calculated flex pattern we replaced.
        const all = wrapper.findAll('.distributions-scaler-bar *');
        const offenders = all.filter((el) => /width\s*:\s*\d+px/i.test(el.attributes('style') || ''));
        expect(offenders.length).toBe(0);

        // Scaler toolbar itself also must not have an inline pixel width.
        const bar = wrapper.find('.distributions-scaler-bar');
        expect(/width\s*:\s*\d+px/i.test(bar.attributes('style') || '')).toBe(false);

        // One scaler cell per selected feature.
        const cells = wrapper.findAll('.distributions-scaler-cell');
        expect(cells.length).toBe(3);
    });

    it('offers an Original scaling option so a feature can be reset', async () => {
        const { wrapper } = await mountSplom({
            stateOverrides: {
                rawData: [{ a: 1, b: 2 }, { a: 3, b: 4 }],
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 1 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                ],
            },
        });

        const firstSelectOptions = wrapper.find('select').findAll('option').map((option) => option.text());
        expect(firstSelectOptions).toContain('Original');
    });

    it('applies is-reduced-motion when prefers-reduced-motion: reduce matches', async () => {
        const { wrapper } = await mountSplom({ reducedMotion: true });

        expect(wrapper.vm.prefersReducedMotion).toBe(true);
        expect(wrapper.find('.distributions-card.is-reduced-motion').exists()).toBe(true);
    });

    it('does not apply is-reduced-motion by default', async () => {
        const { wrapper } = await mountSplom({ reducedMotion: false });

        expect(wrapper.vm.prefersReducedMotion).toBe(false);
        expect(wrapper.find('.distributions-card.is-reduced-motion').exists()).toBe(false);
    });

    it('shows the large-dataset pill above the 5000-row threshold', async () => {
        const rows = Array.from({ length: 6000 }, (_, i) => ({ a: i, b: i + 1 }));
        const { wrapper } = await mountSplom({
            stateOverrides: {
                rawData: rows,
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 0 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                ],
            },
        });

        expect(wrapper.vm.isLargeDataset).toBe(true);
        const pill = wrapper.find('.distributions-pill');
        expect(pill.exists()).toBe(true);
        expect(pill.text()).toContain('rows');
        expect(pill.attributes('aria-live')).toBe('polite');
        expect(pill.attributes('role')).toBe('status');
    });

    it('does not show the large-dataset pill at or below the 5000-row threshold', async () => {
        const rows = Array.from({ length: 5000 }, (_, i) => ({ a: i, b: i + 1 }));
        const { wrapper } = await mountSplom({
            stateOverrides: {
                rawData: rows,
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 0 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                ],
            },
        });

        expect(wrapper.vm.isLargeDataset).toBe(false);
        expect(wrapper.find('.distributions-pill').exists()).toBe(false);
    });

    it('exposes region role + aria-label for accessibility', async () => {
        const { wrapper } = await mountSplom();
        const region = wrapper.find('section.distributions-card');
        expect(region.attributes('role')).toBe('region');
        expect(region.attributes('aria-label')).toBe('Scatterplot Matrix');
    });

    it('renders merge panel with regression helper state and classification state', async () => {
        const { wrapper: notClass } = await mountSplom({
            stateOverrides: {
                isClassification: false,
                target: 'target',
                rawData: [{ a: 1, b: 2, target: 2 }],
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 0 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                ],
            },
        });
        const mergeInRegression = notClass.find('.distributions-merge');
        expect(mergeInRegression.exists()).toBe(true);
        expect(mergeInRegression.text()).toMatch(/classification targets only/i);

        const { wrapper: isClass } = await mountSplom({
            stateOverrides: {
                isClassification: true,
                target: 'target',
                rawData: [{ a: 1, b: 2, target: 'A' }],
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 0 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                ],
            },
        });
        const merge = isClass.find('.distributions-merge');
        expect(merge.exists()).toBe(true);
        expect(merge.element.tagName.toLowerCase()).toBe('details');
    });

    it('formats the dataset-size label in k/M for readability', async () => {
        const rows = Array.from({ length: 12_000 }, () => ({ a: 1 }));
        const { wrapper } = await mountSplom({
            stateOverrides: {
                rawData: rows,
                features: [
                    { name: 'a', selected: true, type: 1, scaler: 0 },
                    { name: 'b', selected: true, type: 1, scaler: 0 },
                ],
            },
        });
        expect(wrapper.vm.datasetSizeLabel).toBe('12k');
    });

    it('slugify produces safe ids for attribute wiring', async () => {
        const { wrapper } = await mountSplom();
        expect(wrapper.vm.slugify('Fixed Acidity')).toBe('fixed-acidity');
        expect(wrapper.vm.slugify('pH!!')).toBe('ph');
        expect(wrapper.vm.slugify('')).toBe('feature');
    });
});
