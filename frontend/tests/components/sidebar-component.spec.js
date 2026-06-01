import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/helpers/py-worker', () => ({
    asyncRun: vi.fn(),
}));

import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Buefy from 'buefy';
import SidebarComponent from '../../src/components/sidebar-component.vue';
import { settingStore } from '../../src/stores/settings.js';
import { CV_OPTIONS, Settings } from '../../src/helpers/settings.js';

// Mock dependencies
vi.mock('@/utils/danfo_loader', () => ({
    getDanfo: vi.fn(() => Promise.resolve({
        DataFrame: class {
            constructor(data) {
                this.$data = data || [];
                this.columns = Object.keys(data?.[0] || {});
                this.dtypes = this.columns.map(() => 'float32');
                this.shape = [this.$data.length, this.columns.length];
            }
            sample() { return this; }
            dropNa() { return this; }
            replace() { return this; }
            column(name) {
                return {
                    values: this.$data.map(r => r[name])
                };
            }
            loc() { return this; }
        }
    })),
    getPlotly: vi.fn(() => Promise.resolve({})),
    highChartLoader: vi.fn(() => Promise.resolve()),
}));

describe('SidebarComponent.vue — Wizard Sync and Target Fallback', () => {
    let pinia;

    beforeEach(() => {
        pinia = createTestingPinia({
            createSpy: vi.fn,
            stubActions: false, // We want real actions so store getters/setters work
        });
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('implements syncFromWizard and correctly synchronizes wizard state', async () => {
        const wrapper = mount(SidebarComponent, {
            global: {
                plugins: [pinia, Buefy],
                stubs: {
                    'upload-component': { template: '<div class="upload-stub" />' },
                    'b-loading': true,
                }
            }
        });

        // Initialize wrapper data mock dataframe and columns
        wrapper.vm.dataframe = {
            columns: ['sepal_length', 'sepal_width', 'species'],
            dtypes: ['float32', 'float32', 'string'],
            column: vi.fn((name) => ({
                values: name === 'species' ? ['setosa', 'versicolor'] : [5.1, 4.9]
            })),
            shape: [150, 3]
        };
        wrapper.vm.featureSettings = [
            { name: 'sepal_length', selected: true, type: 1 },
            { name: 'sepal_width', selected: true, type: 1 },
            { name: 'species', selected: true, type: 2 },
        ];

        // Call syncFromWizard
        wrapper.vm.syncFromWizard({
            taskMode: 'classification',
            target: 'species',
            algoId: 6,
            crossValidationOption: 3,
            modelConfigurations: { depth: { value: 6 } }
        });

        expect(wrapper.vm.taskMode).toBe('classification');
        expect(wrapper.vm.modelTarget).toBe('species');
        expect(wrapper.vm.modelOption).toBe(6);
        expect(wrapper.vm.crossValidationOption).toBe(3);
        expect(wrapper.vm.modelConfigurations.depth.value).toBe(6);
    });

    it('resolves target from featureSettings and falls back to dataframe columns in checkmodelTask', async () => {
        const wrapper = mount(SidebarComponent, {
            global: {
                plugins: [pinia, Buefy],
                stubs: {
                    'upload-component': { template: '<div class="upload-stub" />' },
                    'b-loading': true,
                }
            }
        });

        const store = settingStore();

        // 1. Target not in settings.items, but in featureSettings
        wrapper.vm.dataframe = {
            columns: ['sepal_length', 'sepal_width', 'species'],
            dtypes: ['float32', 'float32', 'string'],
            column: vi.fn(() => ({ values: ['setosa', 'versicolor'] })),
            shape: [150, 3]
        };
        wrapper.vm.featureSettings = [
            { name: 'sepal_length', selected: true, type: 1 },
            { name: 'sepal_width', selected: true, type: 1 },
            { name: 'species', selected: false, type: 2 }, // Target initially not selected/added
        ];

        wrapper.vm.modelTarget = 'species';
        wrapper.vm.taskMode = 'classification';
        wrapper.vm.checkmodelTask();

        // Should find in featureSettings, mark selected = true, and add to settings store features
        const speciesFeature = store.features.find(f => f.name === 'species');
        expect(speciesFeature).toBeDefined();
        expect(speciesFeature.selected).toBe(true);

        // 2. Target not in settings.items nor featureSettings, but exists in dataframe columns
        store.features = [];
        wrapper.vm.featureSettings = [];
        wrapper.vm.modelTarget = 'sepal_width';
        wrapper.vm.taskMode = 'regression';
        wrapper.vm.checkmodelTask();

        const sepalWidthFeature = store.features.find(f => f.name === 'sepal_width');
        expect(sepalWidthFeature).toBeDefined();
        expect(sepalWidthFeature.selected).toBe(true);
        expect(sepalWidthFeature.type).toBe(1); // Numerical
    });

    it('resolves a K-Fold split with defined train and test targets', async () => {
        const wrapper = mount(SidebarComponent, {
            global: {
                plugins: [pinia, Buefy],
                stubs: {
                    'upload-component': { template: '<div class="upload-stub" />' },
                    'b-loading': true,
                }
            }
        });

        const frame = createFrame([
            { sepal_length: 5.1, sepal_width: 3.5 },
            { sepal_length: 4.9, sepal_width: 3.0 },
            { sepal_length: 6.2, sepal_width: 3.4 },
            { sepal_length: 5.9, sepal_width: 3.0 },
            { sepal_length: 6.7, sepal_width: 3.1 },
        ], ['sepal_length', 'sepal_width']);
        const targets = createSeries(['setosa', 'setosa', 'versicolor', 'versicolor', 'virginica']);

        const [xTrain, yTrain, xTest, yTest] = await wrapper.vm.resolveTrainingSplit(CV_OPTIONS.KFOLD, frame, targets);

        expect(xTrain.values.length).toBeGreaterThan(0);
        expect(yTrain.values.length).toBeGreaterThan(0);
        expect(xTest.values.length).toBeGreaterThan(0);
        expect(yTest.values.length).toBeGreaterThan(0);
    });

    it('keeps wizard-synced K-Fold config trainable for logistic regression', async () => {
        const wrapper = mount(SidebarComponent, {
            global: {
                plugins: [pinia, Buefy],
                stubs: {
                    'upload-component': { template: '<div class="upload-stub" />' },
                    'b-loading': true,
                }
            }
        });

        wrapper.vm.dataframe = {
            columns: ['sepal_length', 'sepal_width', 'species'],
            dtypes: ['float32', 'float32', 'string'],
            column: vi.fn((name) => ({
                values: name === 'species' ? ['setosa', 'versicolor', 'virginica'] : [5.1, 4.9, 6.2]
            })),
            shape: [3, 3]
        };
        wrapper.vm.featureSettings = [
            { name: 'sepal_length', selected: true, type: 1 },
            { name: 'sepal_width', selected: true, type: 1 },
            { name: 'species', selected: true, type: 2 },
        ];

        wrapper.vm.syncFromWizard({
            taskMode: 'classification',
            target: 'species',
            algoId: Settings.classification.logistic_regression.id,
            crossValidationOption: CV_OPTIONS.KFOLD,
            modelConfigurations: null
        });

        expect(wrapper.vm.crossValidationOption).toBe(CV_OPTIONS.KFOLD);
        expect(wrapper.vm.modelOption).toBe(Settings.classification.logistic_regression.id);
        expect(wrapper.vm.modelConfigurations.regularization).toBeDefined();
    });
});

function createFrame(rows, columns = Object.keys(rows[0] || {})) {
    return {
        $data: rows,
        columns,
        values: rows.map((row) => columns.map((column) => row[column])),
        iloc({ rows: bounds }) {
            const [start, end] = parseBounds(bounds[0], this.$data.length);
            return createFrame(this.$data.slice(start, end), columns);
        },
    };
}

function createSeries(values) {
    return {
        values,
        iloc(bounds) {
            const [start, end] = parseBounds(bounds[0], values.length);
            return createSeries(values.slice(start, end));
        },
    };
}

function parseBounds(bound, length) {
    const [rawStart, rawEnd] = String(bound).split(':');
    const start = rawStart === '' ? 0 : Number(rawStart);
    const end = rawEnd === '' || rawEnd === undefined ? length : Number(rawEnd);
    return [start, end];
}
