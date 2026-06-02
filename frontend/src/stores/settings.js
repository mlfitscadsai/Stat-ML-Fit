import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { createExperimentRecord, saveExperiment } from '@/services/experiments/experiment-store'
import { applyTheme, getStoredTheme, setStoredTheme } from '@/services/theme/theme-service'

export const settingStore = defineStore('app', {
    state: () => ({
        counter: 1,
        df: {},
        id: null,
        rawData: [],
        features: [],
        transformations: [],
        classTransformations: [],
        results: [],
        trainingRuns: [],
        hpcJobs: [],
        pendingAssistantActions: [],
        messages: [],
        datasetName: '',
        activeTab: 0,
        dataSizeFlag: false,
        resultActiveTab: '',
        datasetShape: {
            count: 0,
            columns: 0
        },
        datasetColumns: [],
        target: null,
        isClassification: true,
        taskMode: 'auto',
        seed: 123,
        isDark: getStoredTheme(),
    }),
    getters: {
        items: (state) => {
            return state.features
        },
        getDatasizeFlag: (state) => {
            return state.dataSizeFlag
        },
        getCounter: (state) => {
            return state.counter
        },
        getUID: () => {
            let id = Math.random().toString(16).slice(2);
            return id;
        },
        getMessages: (state) => {
            return state.messages.reverse()
        },
        getDatasetName: (state) => {
            return state.datasetName
        },
        getDatasetShape: (state) => {
            return state.datasetShape
        },
        getDataset: (state) => {
            return state.df;
        },
        getRawData: (state) => {
            return state.rawData;
        },
        currentTab: (state) => {
            return state.activeTab
        },
        mergedClasses: (state) => {
            return state.classTransformations
        },
        getSeed: (state) => {
            return state.seed
        },
        getMethodResults: (state) => {
            return state.results
        },
        getResultTab: (state) => {
            return state.resultActiveTab
        },
        outputs: (state) => state.results,
        transformationsList: (state) => state.transformations,
        modelTarget: (state) => state.target,
        classificationTask: (state) => state.isClassification,
        getTaskMode: (state) => state.taskMode,
    },
    actions: {
        setSeed(seed) {
            this.seed = seed
        },
        setDatasetName(name) {
            this.datasetName = name;
        },
        setDatasetShape(shape) {
            this.datasetShape = shape;
        },
        resetFeatures() {
            this.features = []
            this.transformations = []
            this.classTransformations = []
        },
        resetClassTransformations() {
            this.classTransformations = []
        },
        resetTransformations() {
            this.transformations = []
        },
        setDatasizeFlag(flag) {
            this.dataSizeFlag = flag;
        },
        resetDataset() {
            this.datasetName = '';
            this.datasetShape = {
                count: 0,
                columns: 0
            };
            this.datasetColumns = [];
        },
        setDatasetColumns(columns) {
            if (!Array.isArray(columns) || columns.length === 0) {
                return;
            }
            this.datasetColumns = [...columns];
        },
        increaseCounter() {
            this.counter++;
        },
        setDataframe(data) {
            this.df = data && typeof data === 'object' ? markRaw(data) : {};
        },
        setRawData(data) {
            this.rawData = Array.isArray(data) ? data : [];
            if (this.rawData[0] && (!this.datasetColumns || this.datasetColumns.length === 0)) {
                this.datasetColumns = Object.keys(this.rawData[0]);
            }
        },
        addFeature(feature) {
            feature.scaler = 0;
            let index = this.features.findIndex(m => m.name === feature.name);
            if (index !== -1) {
                this.features[index] = feature
                return
            }
            this.features.push(feature)
        },
        setClassTransformation(transformations) {
            this.classTransformations.push(transformations)
        },

        addTransformation(transformation) {
            let index = this.transformations.findIndex(m => m.name === transformation.name);
            if (index !== -1) {
                this.transformations[index] = transformation
                return
            }
            this.transformations.push(transformation)
        },
        addResult(result) {
            this.results.push(result)
            const runRecord = createExperimentRecord({
                result,
                datasetName: this.datasetName,
                rawData: Array.isArray(this.rawData) ? this.rawData : [],
                config: {
                    target: result.target || this.target,
                    seed: result.seed || this.seed,
                    taskMode: this.taskMode,
                    modelOption: result.snapshot?.id,
                    options: result.options,
                },
            })
            this.addTrainingRun(runRecord)
            saveExperiment(runRecord).catch((error) => {
                console.warn('Could not persist experiment record:', error)
            })
        },
        addTrainingRun(run) {
            const index = this.trainingRuns.findIndex(existing => existing.runId === run.runId)
            if (index >= 0) {
                this.trainingRuns[index] = run
                return
            }
            this.trainingRuns.push(run)
        },
        setTrainingRuns(runs) {
            this.trainingRuns = Array.isArray(runs) ? runs : []
        },
        upsertHpcJob(job) {
            const index = this.hpcJobs.findIndex(existing => existing.id === job.id)
            if (index >= 0) {
                this.hpcJobs[index] = { ...this.hpcJobs[index], ...job }
                return this.hpcJobs[index]
            }
            this.hpcJobs.push(job)
            return job
        },
        addPendingAssistantAction(action) {
            const queued = {
                id: action.id || `assistant-action-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                status: 'pending',
                createdAt: new Date().toISOString(),
                ...action,
            }
            this.pendingAssistantActions.push(queued)
            return queued
        },
        approveAssistantAction(id) {
            const action = this.pendingAssistantActions.find(item => item.id === id)
            if (action) action.status = 'approved'
            return action
        },
        dismissAssistantAction(id) {
            const action = this.pendingAssistantActions.find(item => item.id === id)
            if (action) action.status = 'dismissed'
            return action
        },
        clearAssistantActions() {
            this.pendingAssistantActions = []
        },
        addMessage(message) {
            var date = new Date();
            message['date'] = date.toLocaleString()
            this.messages.push(message)
        },
        removeResult(id) {
            const i = this.results.findIndex(m => m.id === id)
            if (i > -1) {
                this.results.splice(i, 1);
            }
        },
        getResultVisualizations(id) {
            const i = this.results.findIndex(m => m.id === id)
            if (i > -1) {
                let tables = this.results[i].tables;
                let plots = this.results[i].plots;
                return [tables, plots]
            }
        },
        resetDF() {
            this.df = {}
        },
        updateFeature(feature) {
            let index = this.features.findIndex(m => m.name === feature.name);
            if (index !== -1) {
                this.features[index] = feature
            }
        },
        removeItem(name) {
            const i = this.features.lastIndexOf(name)
            if (i > -1) this.features.splice(i, 1)
        },
        setTarget(target) {
            this.target = target
        },
        setmodelTask(type) {
            this.isClassification = type
        },
        setTaskMode(mode) {
            this.taskMode = mode
        },
        setActiveTab(index) {
            this.activeTab = index
        },
        setResultActiveTab(index) {
            this.resultActiveTab = index
        },
        setDark(value) {
            this.isDark = Boolean(value);
            setStoredTheme(this.isDark);
            applyTheme(this.isDark);
        },
        toggleDark() {
            this.setDark(!this.isDark);
        },
    },
})

