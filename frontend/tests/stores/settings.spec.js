import { setActivePinia, createPinia } from 'pinia';
import { settingStore } from '../../src/stores/settings';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

function createStorage() {
    const store = new Map();
    return {
        getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
        setItem: vi.fn((key, value) => { store.set(key, String(value)); }),
        removeItem: vi.fn((key) => { store.delete(key); }),
        clear: vi.fn(() => { store.clear(); }),
    };
}

describe('Settings Store', () => {
    let storage;

    beforeEach(() => {
        storage = createStorage();
        vi.stubGlobal('localStorage', storage);
        document.documentElement.classList.remove('dark');
        delete document.documentElement.dataset.theme;
        document.documentElement.style.colorScheme = '';
        setActivePinia(createPinia());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.documentElement.classList.remove('dark');
        delete document.documentElement.dataset.theme;
        document.documentElement.style.colorScheme = '';
    });

    it('initializes with default state', () => {
        const store = settingStore();
        expect(store.datasetName).toBe('');
        expect(store.features).toEqual([]);
        expect(store.counter).toBe(1);
    });

    it('setDatasetName updates datasetName', () => {
        const store = settingStore();
        store.setDatasetName('test-dataset');
        expect(store.datasetName).toBe('test-dataset');
        expect(store.getDatasetName).toBe('test-dataset');
    });

    it('setSeed updates seed', () => {
        const store = settingStore();
        store.setSeed(42);
        expect(store.seed).toBe(42);
        expect(store.getSeed).toBe(42);
    });

    it('addFeature adds to and updates features array', () => {
        const store = settingStore();
        const feature = { name: 'age' };
        store.addFeature(feature);
        expect(store.features.length).toBe(1);
        expect(store.features[0].name).toBe('age');
        
        // Update feature
        const updatedFeature = { name: 'age', type: 'numeric' };
        store.addFeature(updatedFeature);
        expect(store.features.length).toBe(1); // Should not increase
        expect(store.features[0].type).toBe('numeric');
    });

    it('resetFeatures clears all arrays', () => {
        const store = settingStore();
        store.features.push({ name: 'test' });
        store.transformations.push({});
        store.classTransformations.push({});
        
        store.resetFeatures();
        
        expect(store.features).toEqual([]);
        expect(store.transformations).toEqual([]);
        expect(store.classTransformations).toEqual([]);
    });

    it('toggleDark changes isDark flag', () => {
        const store = settingStore();
        const initial = store.isDark;
        store.toggleDark();
        expect(store.isDark).not.toBe(initial);
    });

    it('setDark persists theme preference', () => {
        const store = settingStore();
        store.setDark(true);
        expect(store.isDark).toBe(true);
        store.setDark(false);
        expect(store.isDark).toBe(false);
    });

    it('setDark synchronizes state, localStorage, and document theme', () => {
        const store = settingStore();

        store.setDark(true);

        expect(store.isDark).toBe(true);
        expect(localStorage.getItem('isDark')).toBe('true');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');

        store.setDark(false);

        expect(store.isDark).toBe(false);
        expect(localStorage.getItem('isDark')).toBe('false');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('toggleDark uses the same theme synchronization contract', () => {
        const store = settingStore();

        store.toggleDark();

        expect(store.isDark).toBe(true);
        expect(localStorage.getItem('isDark')).toBe('true');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('addResult and removeResult', () => {
        const store = settingStore();
        store.addResult({ id: 'res1', type: 'test' });
        expect(store.results.length).toBe(1);
        
        store.removeResult('res1');
        expect(store.results.length).toBe(0);
    });

    it('adds serializable training run metadata with results', () => {
        const store = settingStore();
        store.setDatasetName('demo');
        store.setRawData([{ x: 1, y: 0 }]);

        store.addResult({
            id: 'res1',
            name: 'Random Forest',
            target: 'y',
            metrics: { accuracy: 0.9 },
            model: { train() {} },
            snapshot: { x: {} },
        });

        expect(store.trainingRuns).toHaveLength(1);
        expect(store.trainingRuns[0]).toMatchObject({
            id: 'res1',
            model: 'Random Forest',
            target: 'y',
            metrics: { accuracy: 0.9 },
        });
        expect(store.trainingRuns[0].snapshot).toBeUndefined();
    });

    it('queues and resolves pending assistant actions', () => {
        const store = settingStore();
        const action = store.addPendingAssistantAction({
            type: 'configure_training_draft',
            title: 'Use Random Forest',
            payload: { algoId: 5 },
        });

        expect(store.pendingAssistantActions).toHaveLength(1);
        expect(action.status).toBe('pending');

        store.approveAssistantAction(action.id);
        expect(store.pendingAssistantActions[0].status).toBe('approved');

        store.dismissAssistantAction(action.id);
        expect(store.pendingAssistantActions[0].status).toBe('dismissed');
    });

    it('upserts HPC job center records', () => {
        const store = settingStore();
        store.upsertHpcJob({ id: 'job-1', status: 'submitted' });
        store.upsertHpcJob({ id: 'job-1', status: 'running' });

        expect(store.hpcJobs).toEqual([{ id: 'job-1', status: 'running' }]);
    });

    it('updates counter', () => {
        const store = settingStore();
        store.increaseCounter();
        expect(store.counter).toBe(2);
    });

    it('manages tabs', () => {
        const store = settingStore();
        store.setActiveTab(2);
        expect(store.activeTab).toBe(2);
        expect(store.currentTab).toBe(2);
        
        store.setResultActiveTab(1);
        expect(store.resultActiveTab).toBe(1);
    });
});
