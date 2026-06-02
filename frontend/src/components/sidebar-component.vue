<!-- eslint-disable no-unused-vars -->
<template>
    <div class="column is-3 control-panel control-panel--dark" style="height: 100%;">
        <figure class="image mx-auto my-auto p-3 control-logo">
            <img fetchpriority="high" src="/logo.png" alt="logo" />
        </figure>
        <div class="has-text-centered mb-2 control-header">
            <p class="control-title">ML Studio</p>
            <p class="control-subtitle">Upload data, configure model, run training.</p>
            <button type="button" class="dark-mode-toggle" @click="settings.toggleDark()"
                aria-label="Toggle application theme"
                :title="settings.isDark ? 'Switch to light mode' : 'Switch to dark mode'">
                {{ settings.isDark ? '☀️' : '🌙' }}
            </button>
        </div>
        <section class="control-content">
            <upload-component class="sidebar-upload-card" @uploaded="generateTargetDropdown" @uploaded-file="setFile"></upload-component>
            <div class="control-form">
                <!-- Group 1: Core Setup -->
                <details class="sidebar-details sidebar-details--primary" open>
                    <summary class="sidebar-details__summary">
                        <span>Core Setup</span>
                        <i class="fas fa-chevron-down sidebar-details__icon"></i>
                    </summary>
                    <div class="sidebar-details__content">
                        <b-field class="sidebar-field" label="Seed">
                            <b-input v-model="seed" size="is-small" placeholder="Seed" type="number" min="0">
                            </b-input>
                        </b-field>
                        <b-field class="sidebar-field" label="Target">
                            <b-select :expanded="true" v-model="modelTarget" @update:modelValue="checkmodelTask" size="is-small">
                                <option v-for="option in columns" :value="option" :key="option">
                                    {{ option }}
                                </option>
                            </b-select>
                        </b-field>
                        <b-field class="sidebar-field" label="Task mode">
                            <b-select :expanded="true" v-model="taskMode" @update:modelValue="onTaskModeChange" size="is-small">
                                <option v-for="option in taskModeOptions" :value="option.id" :key="option.id">
                                    {{ option.label }}
                                </option>
                            </b-select>
                        </b-field>
                    </div>
                </details>

                <!-- Group 2: Model Configuration -->
                <details class="sidebar-details sidebar-details--primary" open>
                    <summary class="sidebar-details__summary">
                        <span>Model &amp; Validation</span>
                        <i class="fas fa-chevron-down sidebar-details__icon"></i>
                    </summary>
                    <div class="sidebar-details__content">
                        <b-field class="sidebar-field sidebar-field--with-action" label="Model">
                            <b-select :disabled="tuneModel" :expanded="true" v-model="modelOption" size="is-small">
                                <option v-for="option in modelOptions" :value="option.id" :key="option.id">
                                    {{ option.label }}
                                </option>
                            </b-select>
                            <b-button @click="configureModel" size="is-small" class="model-config-btn" icon-pack="fas"
                                :icon-left="!this.tuneModel ? 'cog' : 'arrow-left'"></b-button>
                        </b-field>

                        <!-- Hyperparameters sub-section -->
                        <section v-if="tuneModel" class="mx-1 hyperparams-section">
                            <b-field class="sidebar-field" v-for="(option, i) in modelConfigurations" :key="i" :label="option.label">
                                <b-select v-model="option.value" :expanded="true" size="is-small"
                                    v-if="option.type === 'select'">
                                    <option v-for="(item, index) in option.values" :value="item.value" :key="index">
                                        {{ item.label }}
                                    </option>
                                </b-select>
                                <b-input size="is-small" v-model="option.value" type="number"
                                    v-else-if="option.type === 'number'"></b-input>
                                <b-input size="is-small" v-model="option.value" type="text"
                                    v-else-if="option.type === 'text'"></b-input>
                            </b-field>
                        </section>

                        <b-field class="sidebar-field" label="Cross Validation">
                            <b-select :expanded="true" v-model="crossValidationOption" size="is-small">
                                <option v-for="option in crossValidationOptions" :value="option.id" :key="option.id">
                                    {{ option.label }}
                                </option>
                            </b-select>
                        </b-field>
                        <b-field class="sidebar-field" label="Imputation">
                            <b-select :expanded="true" v-model="imputationOption" size="is-small">
                                <option v-for="option in imputationOptions" :value="option.id" :key="option.id">
                                    {{ option.label }}
                                </option>
                            </b-select>
                        </b-field>
                    </div>
                </details>

                <!-- Group 3: Preprocessing & Resources -->
                <details class="sidebar-details sidebar-details--advanced">
                    <summary class="sidebar-details__summary">
                        <span>Advanced Pipeline &amp; HPC</span>
                        <i class="fas fa-chevron-down sidebar-details__icon"></i>
                    </summary>
                    <div class="sidebar-details__content">
                        <b-field>
                            <b-checkbox v-model="dataScalingBehavior" size="is-small">Standardize by default</b-checkbox>
                        </b-field>
                        <b-field>
                            <b-checkbox v-model="explainModel" size="is-small">Explain the model</b-checkbox>
                        </b-field>
                        <b-field>
                            <b-checkbox v-model="usePCAs" size="is-small">Use PC components</b-checkbox>
                        </b-field>
                        <b-field v-if="usePCAs" class="sidebar-field" label="Number of Components">
                            <b-input size="is-small" v-model="numberOfComponents" type="number"></b-input>
                        </b-field>
                        <b-field>
                            <b-checkbox v-model="useOutliers" size="is-small">Enable outlier detection</b-checkbox>
                        </b-field>
                        <b-field v-if="useOutliers" class="sidebar-field" label="Outlier Method">
                            <b-select v-model="outlierMethod" :expanded="true" size="is-small">
                                <option v-for="method in outlierMethods" :value="method.id" :key="method.id">
                                    {{ method.label }}
                                </option>
                            </b-select>
                        </b-field>
                        <b-field v-if="useOutliers && outlierMethod === 'zscore'" class="sidebar-field" label="Z threshold">
                            <b-input size="is-small" v-model="outlierZThreshold" type="number" min="1" step="0.1"></b-input>
                        </b-field>
                        <b-field>
                            <b-checkbox v-model="useHPC" size="is-small">Use HPC resources</b-checkbox>
                        </b-field>
                        <p v-if="useHPC && hpcConfigured === false" class="sidebar-hpc-hint sidebar-hpc-hint--warn">
                            HPC is not configured on the server (set HPC_HOST, HPC_USER, HPC_PASSWORD in .env).
                        </p>
                        <p v-else-if="useHPC && hpcUploadedFile" class="sidebar-hpc-hint">
                            Dataset on HPC: {{ hpcUploadedFile }}
                        </p>
                    </div>
                </details>

                <div class="train-actions">
                    <b-button @click="train" size="is-small" icon-pack="fas" icon-left="play"
                        class="control-action-btn control-action-btn-train" type="is-success" :loading="training"
                        :disabled="!hasDataset || modelOption == null">
                        Train</b-button>
                    <b-button
                        :disabled="!canUploadToHpc"
                        :title="uploadToHpcTitle"
                        class="control-action-btn control-action-btn-upload"
                        size="is-small"
                        :loading="hpcUploading"
                        @click="uploadToHpc()">Upload to HPC</b-button>
                </div>
                <b-loading :is-full-page="false" v-model="training"></b-loading>
            </div>
        </section>
    </div>
</template>

<script>
/* eslint-disable no-unused-vars */

import UploadComponent from "./upload-component.vue";
import { Settings, FeatureCategories, CV_OPTIONS } from '../helpers/settings'
import PCA from '@/helpers/dimensionality-reduction/pca';

import { ModelFactory } from "@/helpers/model_factory";
import { settingStore } from '@/stores/settings'
import { applyDataTransformation, handle_missing_values, encode_dataset } from '@/helpers/utils';
import { filterOutliersFromDataFrame } from '@/helpers/outliers';
import { TASK_MODES, detectTaskFromTarget, resolveTaskMode, validateModeCompatibility } from '@/helpers/task_mode';
import { getDanfo } from '@/utils/danfo_loader';
import { dfColumn, resolveDataFrameColumnName } from '@/utils/danfo_frame';
import {
    buildCsvBlobFromDataframe,
    buildCsvBlobFromRawRows,
    fetchHpcHealth,
    uploadDatasetBlob,
} from '@/services/hpc/hpc-client';
import { BButton, BSelect, BField, BInput, BCheckbox, useToast } from 'buefy'

import axios from "axios";
export default {
    name: 'SidebarComponent',
    setup() {
        const settings = settingStore()

        return { settings }
    },
    components: {
        UploadComponent, BButton, BSelect, BField, BInput, BCheckbox

    },
    props: {
        msg: String
    },

    data() {
        return {
            dataScalingBehavior: false,
            explainModel: true,
            training: false,
            tuneModel: false,
            numberOfComponents: 2,
            usePCAs: false,
            useOutliers: false,
            outlierMethod: 'iqr',
            outlierZThreshold: 3,
            outlierMethods: [
                { id: 'iqr', label: 'IQR (Tukey)' },
                { id: 'zscore', label: 'Z-score' },
                { id: 'mad', label: 'Modified Z (MAD)' },
                { id: 'isolation', label: 'Isolation Forest' },
            ],
            useHPC: false,
            hpcConfigured: null,
            hpcUploadedFile: null,
            hpcUploading: false,
            seed: 123,
            dataframe: null,
            configureFeatures: false,
            modelOptions: Settings.classification,
            imputationOption: 1,
            modelOption: 5,
            featureTypeOptions: FeatureCategories,
            crossValidationOption: 1,
            columns: [],
            modelTarget: null,
            modelConfigurations: null,
            taskMode: TASK_MODES.AUTO,
            taskModeOptions: [
                {
                    id: TASK_MODES.AUTO,
                    label: 'Auto detect'
                },
                {
                    id: TASK_MODES.CLASSIFICATION,
                    label: 'Classification'
                },
                {
                    id: TASK_MODES.REGRESSION,
                    label: 'Regression'
                }
            ],
            imputationOptions: [{
                id: 1,
                label: 'Delete rows'
            },
            {
                id: 2,
                label: 'Mean and Mode'
            }, {
                id: 3,
                label: 'Linear regression'
            }, {
                id: 4,
                label: 'random forest'
            }],
            crossValidationOptions: [{
                id: CV_OPTIONS.SPLIT,
                label: '70 % training - 30 % test'
            },
            {
                id: CV_OPTIONS.NO,
                label: 'No'
            }, {
                id: CV_OPTIONS.KFOLD,
                label: 'k-fold'
            }],
            featureSettings: [],
            modelSettings: [],
            modelName: '',
            file: null
        }
    },
    computed: {
        hasDataset() {
            return Array.isArray(this.settings.rawData) && this.settings.rawData.length > 0;
        },
        canUploadToHpc() {
            return this.useHPC && this.hasDataset && this.hpcConfigured !== false && !this.hpcUploading;
        },
        uploadToHpcTitle() {
            if (!this.useHPC) return 'Enable “Use HPC resources” first';
            if (!this.hasDataset) return 'Load a dataset before uploading';
            if (this.hpcConfigured === false) return 'HPC is not configured on the API server';
            return 'Upload the current dataset CSV to the HPC staging area';
        },
    },
    watch: {
        usePCAs(enabled) {
            if (enabled && (!Number(this.numberOfComponents) || Number(this.numberOfComponents) < 1)) {
                this.numberOfComponents = 2;
            }
        },
    },
    methods: {
        setFile(e) {
            this.file = e
        },
        async refreshHpcStatus() {
            try {
                const health = await fetchHpcHealth();
                this.hpcConfigured = health?.hpc_configured === true;
            } catch {
                this.hpcConfigured = false;
            }
        },
        resolvePcaComponents(featureCount) {
            const n = Number(this.numberOfComponents);
            if (Number.isFinite(n) && n > 0) {
                return Math.min(Math.floor(n), featureCount);
            }
            return Math.min(2, featureCount);
        },
        async buildDatasetUploadBlob() {
            if (this.file) {
                return this.file;
            }
            const danfo = await getDanfo();
            if (this.dataframe?.columns?.length) {
                return buildCsvBlobFromDataframe(danfo, this.dataframe);
            }
            return buildCsvBlobFromRawRows(this.settings.rawData);
        },
        async uploadToHpc() {
            if (!this.canUploadToHpc) {
                this.Toast.open({
                    duration: 4000,
                    message: this.uploadToHpcTitle,
                    type: 'is-warning',
                });
                return;
            }
            this.hpcUploading = true;
            try {
                const blob = await this.buildDatasetUploadBlob();
                if (!blob) {
                    throw new Error('No dataset available to upload.');
                }
                const fileName = await uploadDatasetBlob(blob, 'main.csv');
                this.hpcUploadedFile = fileName;
                this.Toast.open({
                    duration: 4000,
                    message: `Dataset uploaded to HPC as ${fileName}`,
                    type: 'is-success',
                });
                this.settings.addMessage({ message: `HPC upload: ${fileName}`, type: 'info' });
            } catch (err) {
                const message = err?.response?.data?.error || err?.message || 'HPC upload failed';
                this.Toast.open({ duration: 5000, message, type: 'is-danger' });
                this.settings.addMessage({ message, type: 'warning' });
            } finally {
                this.hpcUploading = false;
            }
        },
        onTaskModeChange() {
            this.settings.setTaskMode(this.taskMode)
            this.checkmodelTask()
            if (!this.modelTarget || !this.dataframe || this.taskMode === TASK_MODES.AUTO) {
                return
            }
            const targetFeature = this.settings.items.find(feature => feature.name === this.modelTarget)
            const modeValidation = validateModeCompatibility(
                this.taskMode,
                targetFeature?.type,
                this.dataframe ? dfColumn(this.dataframe, this.modelTarget)?.values ?? [] : []
            )
            if (!modeValidation.valid) {
                this.Toast.open({
                    duration: 4000,
                    message: modeValidation.message,
                    type: 'is-warning',
                })
                this.settings.addMessage({ message: modeValidation.message, type: 'warning' });
            }
        },
        updateFeatures() {
            this.configureFeatures = false;
            this.$emit('updateFeatures', true)
        },
        toggleTraining() {
            this.training = !this.training;
            let message = this.training ? 'Started training ' + this.modelName : 'Successully fitted ' + this.modelName;
            this.Toast.open(
                {
                    duration: 5000,
                    message: this.training ? 'Started training ' + this.modelName : 'Successully fitted ' + this.modelName,
                    type: this.training ? 'is-info' : 'is-success',
                })
            this.settings.addMessage({ message: message, type: 'info' });
        },
        getDefaultModelConfiguration() {
            for (const key in this.modelOptions) {
                const model = this.modelOptions[key];
                if (model.id === this.modelOption) {
                    for (const key in model.options) {
                        model.options[key].value = model.options[key]?.default;
                    }
                    this.modelConfigurations = model.options;
                    this.modelName = model.title
                }
            }
        },
        configureModel() {
            this.tuneModel = !this.tuneModel;
            this.getDefaultModelConfiguration()
        },
        generateTargetDropdown() {
            this.dataframe = this.settings.getDataset;
            this.columns = this.dataframe.columns;
            this.featureSettings = this.columns.map((column, index) => {
                let series = this.dataframe[column];
                let isString = this.dataframe.dtypes[index] === 'string';
                let uniqueCount = series.unique().values.length;

                // Auto-exclude ID columns, High Cardinality Categoricals, and Constants
                let isConstant = uniqueCount <= 1;
                let isId = uniqueCount === this.dataframe.shape[0];
                let isHighCardinality = isString && uniqueCount > 20;

                return {
                    name: column,
                    selected: !(isConstant || isId || isHighCardinality),
                    type: isString ? FeatureCategories.Nominal.id : FeatureCategories.Numerical.id
                }
            })
            const normalizedColumns = this.dataframe.columns.map(column => String(column).toLowerCase().trim())
            const preferredTargets = ['survived', 'target', 'label', 'class', 'y']
            const preferredTargetIndex = preferredTargets
                .map(name => normalizedColumns.findIndex(column => column === name || column.includes(name)))
                .find(index => index !== -1)
            this.modelTarget = preferredTargetIndex !== undefined
                ? this.dataframe.columns[preferredTargetIndex]
                : this.dataframe.columns[this.dataframe.columns.length - 1];
            this.settings.setTarget(this.modelTarget)
            let selectedFeatures = this.featureSettings.filter(feature => feature.selected);
            for (const element of selectedFeatures) {
                this.settings.addFeature(element)
            }
            this.checkmodelTask()
            this.getDefaultModelConfiguration()
            this.$emit('updateFeatures', true)

        },
        checkmodelTask() {
            this.settings.setTarget(this.modelTarget)
            let targetFeature = this.settings.items.find(feature => feature.name == this.modelTarget);
            if (!targetFeature && this.featureSettings) {
                targetFeature = this.featureSettings.find(feature => feature.name == this.modelTarget);
                if (targetFeature) {
                    targetFeature.selected = true
                    this.settings.addFeature(targetFeature)
                }
            }
            if (!targetFeature && this.dataframe) {
                const colIndex = this.dataframe.columns.indexOf(this.modelTarget);
                if (colIndex !== -1) {
                    const isString = this.dataframe.dtypes[colIndex] === 'string';
                    targetFeature = {
                        name: this.modelTarget,
                        selected: true,
                        type: isString ? FeatureCategories.Nominal.id : FeatureCategories.Numerical.id
                    };
                    if (this.featureSettings) {
                        this.featureSettings.push(targetFeature);
                    }
                    this.settings.addFeature(targetFeature);
                }
            }
            if (!targetFeature) {
                return
            }
            if (!targetFeature.selected) {
                targetFeature.selected = true
                this.settings.addFeature(targetFeature)
            }

            const targetValues = this.dataframe ? dfColumn(this.dataframe, this.modelTarget)?.values ?? [] : [];
            const autoClassification = detectTaskFromTarget(targetFeature.type, targetValues);
            const selectedTaskMode = this.taskMode || TASK_MODES.AUTO;
            const isClassification = resolveTaskMode(selectedTaskMode, autoClassification);
            this.settings.setmodelTask(isClassification);
            this.settings.setTaskMode(selectedTaskMode)
            this.modelOptions = isClassification ? Settings.classification : Settings.regression;
            const availableModelIds = Object.values(this.modelOptions).map(option => option.id)
            if (!availableModelIds.includes(this.modelOption)) {
                this.modelOption = availableModelIds[0] ?? null
            }
            this.getDefaultModelConfiguration()
        },
        syncFromWizard(config) {
            if (config.taskMode !== undefined && config.taskMode !== null) {
                this.taskMode = config.taskMode;
            }
            if (config.target !== undefined && config.target !== null) {
                this.modelTarget = config.target;
                this.settings.setTarget(config.target);
            }
            if (config.algoId !== undefined && config.algoId !== null) {
                this.modelOption = config.algoId;
            }
            if (config.crossValidationOption !== undefined && config.crossValidationOption !== null) {
                this.crossValidationOption = config.crossValidationOption;
            }
            this.checkmodelTask();
            if (config.modelConfigurations !== undefined && config.modelConfigurations !== null && this.modelConfigurations) {
                for (const key of Object.keys(config.modelConfigurations)) {
                    if (this.modelConfigurations[key] !== undefined) {
                        this.modelConfigurations[key].value = config.modelConfigurations[key].value;
                    }
                }
            }
        },
        async train() {
            try {
                if (!this.settings.items?.length && this.settings.rawData?.length) {
                    this.generateTargetDropdown();
                }
                if (!this.settings.rawData || this.settings.rawData.length === 0) {
                    this.Toast.open({
                        duration: 3000,
                        message: 'Please upload/select a dataset first.',
                        type: 'is-warning',
                    })
                    return
                }
                const targetName = this.modelTarget || this.settings.modelTarget
                if (!targetName) {
                    this.Toast.open({
                        duration: 3000,
                        message: 'Please select a target column.',
                        type: 'is-warning',
                    })
                    return
                }
                const danfo = await getDanfo();
                this.dataframe = new danfo.DataFrame(this.settings.rawData);
                const resolvedTarget = resolveDataFrameColumnName(this.dataframe, targetName);
                if (!this.dataframe.columns?.includes(resolvedTarget)) {
                    const available = (this.dataframe.columns || []).join(', ') || '(none)';
                    throw new Error(
                        `Column "${targetName}" is not available on this dataset. Available columns: ${available}`
                    );
                }
                this.modelTarget = resolvedTarget;
                this.settings.setTarget(resolvedTarget);
                this.checkmodelTask()
                const targetFeature = this.settings.items.find(feature => feature.name === resolvedTarget)
                    || this.settings.items.find(
                        (feature) => feature.name?.toLowerCase() === resolvedTarget.toLowerCase()
                    )
                const modeValidation = validateModeCompatibility(
                    this.taskMode,
                    targetFeature?.type,
                    dfColumn(this.dataframe, resolvedTarget)?.values ?? []
                )
                if (!modeValidation.valid) {
                    this.Toast.open({
                        duration: 4000,
                        message: modeValidation.message,
                        type: 'is-warning',
                    })
                    this.settings.addMessage({ message: modeValidation.message, type: 'warning' });
                    return
                }
                if (!this.modelConfigurations) {
                    this.getDefaultModelConfiguration()
                }
                if (this.modelOption == null) {
                    this.Toast.open({
                        duration: 3000,
                        message: 'Please choose a model before training.',
                        type: 'is-warning',
                    })
                    return
                }
                if (this.useHPC) {
                    await this.refreshHpcStatus();
                    if (!this.hpcConfigured) {
                        this.Toast.open({
                            duration: 5000,
                            message: 'HPC is not configured on the server. Disable “Use HPC resources” for local training, or set HPC_* in .env and restart the API.',
                            type: 'is-warning',
                        });
                        return;
                    }
                }
                let seed = +this.seed;
                this.settings.setSeed(seed)
                let categoricalFeatures = []
                let dataset = await this.dataframe.sample(this.dataframe.$data.length, { seed: seed });

                const target = resolvedTarget;

                // Get selected features and numeric columns
                let numericColumns = this.settings.items.filter(m => m.selected && m.type === FeatureCategories.Numerical.id).map(m => m.name);
                let selected_columns = this.settings.items.filter(m => m.selected).map(m => m.name)

                // Safety: try to exclude high cardinality strings to prevent OHE explosion
                try {
                    selected_columns = selected_columns.filter(col => {
                        if (!dataset.columns.includes(col)) return false;
                        if (dataset[col].dtype !== 'string') return true;
                        return dataset[col].unique().values.length <= 20;
                    });
                } catch(e) {
                    // If filtering fails, keep all selected columns
                    selected_columns = this.settings.items.filter(m => m.selected).map(m => m.name)
                }

                const col_index = selected_columns.findIndex(m => m === target)
                if (col_index === -1) {
                    selected_columns.push(target)
                }

                // Filter to selected columns first, THEN handle missing values
                let filterd_dataset = dataset.loc({ columns: selected_columns })
                numericColumns = numericColumns.filter(c => selected_columns.includes(c));
                if (this.useOutliers && numericColumns.length > 0) {
                    const threshold = this.outlierMethod === 'zscore' ? Number(this.outlierZThreshold) || 3 : undefined;
                    const before = filterd_dataset.shape[0];
                    filterd_dataset = filterOutliersFromDataFrame(
                        filterd_dataset,
                        numericColumns,
                        this.outlierMethod,
                        threshold
                    );
                    const removed = before - filterd_dataset.shape[0];
                    if (removed > 0) {
                        this.settings.addMessage({
                            message: `Removed ${removed} row(s) as outliers (${this.outlierMethod}).`,
                            type: 'info',
                        });
                    }
                }
                filterd_dataset = handle_missing_values(
                    filterd_dataset,
                    this.imputationOption !== 1
                )
                filterd_dataset = applyDataTransformation(filterd_dataset, numericColumns, this.settings.transformationsList);
                if (this.dataScalingBehavior) {
                    let transformations = []
                    for (let i = 0; i < numericColumns.length; i++) {
                        transformations.push({ name: numericColumns[i], scaler: '1' })
                    }
                    filterd_dataset = applyDataTransformation(filterd_dataset, numericColumns, transformations);
                }
                // add class transformation
                if (this.settings.isClassification) {
                    let selectedClasses = this.settings.mergedClasses
                    if (selectedClasses?.length > 0) {
                        this.settings.mergedClasses.forEach((classes) => {
                            let newClass = classes.map(m => m.class).join('_');
                            classes.forEach(cls => {
                                filterd_dataset.replace(cls.class, newClass, { columns: [this.settings.modelTarget], inplace: true })
                            });
                        })
                    }
                }


                const targets = dfColumn(filterd_dataset, target)
                filterd_dataset.drop({ columns: target, inplace: true })



                const cross_validation_setting = this.crossValidationOption;

                [filterd_dataset, categoricalFeatures] = await encode_dataset(filterd_dataset, this.settings.items.filter(m => m.selected && selected_columns.includes(m.name)).filter(m => m.name !== this.settings.modelTarget).map(m => {
                    return {
                        name: m.name,
                        type: m.type
                    }
                }))
                let [x_train, y_train, x_test, y_test] = await this.resolveTrainingSplit(cross_validation_setting, filterd_dataset, targets);


                let uniqueLabels = [...new Set(y_train.values)];
                let labelEncoder, encoded_y, encoded_y_test;
                if (this.settings.classificationTask) {
                    [labelEncoder, encoded_y, encoded_y_test] = await this.encodeTarget(y_train.values, y_test.values)
                } else {
                    encoded_y = y_train.values;
                    encoded_y_test = y_test.values;
                }
                let model_factory = new ModelFactory();
                let model = model_factory.createModel(this.modelOption, this.modelConfigurations)
                model.seed = seed;
                model.id = this.settings.getCounter
                this.toggleTraining()
                model.hasExplaination = this.explainModel;
                if (this.usePCAs) {
                    const pca = new PCA();
                    let numericColumns = this.settings.items.filter(column => column.selected && column.type === 1 && column.name != this.modelTarget).map(column => column.name);
                    const pcaComponents = this.resolvePcaComponents(numericColumns.length);
                    let [pca_train, _, __, ___, ____, pca_test] = await pca.predict(x_train.loc({ columns: numericColumns }).values,
                        pcaComponents, x_test.loc({ columns: numericColumns }).values, seed)
                    pca_train = pca_train.map(m => [].slice.call(m))
                    pca_test = pca_test.map(m => [].slice.call(m))
                    let cols = pca_train[0].map((_, i) => 'PC_' + (i + 1))
                    x_train = new danfo.DataFrame(pca_train, { columns: cols })
                    x_test = new danfo.DataFrame(pca_test, { columns: cols })
                }
                let predictions = this.useHPC ? [] : await model.train(x_train.values, encoded_y, x_test.values, encoded_y_test, x_train.columns, categoricalFeatures, 0);
                let metrics = this.useHPC ? [] : await model.evaluateModel(encoded_y_test, predictions, uniqueLabels)
                if (predictions?.length > 0 || this.useHPC) {

                    this.settings.addResult({
                        id: model.id,
                        useHPC: this.useHPC ? Math.random().toString(16).slice(2) : 0,
                        showProbas: model.hasProbability,
                        helpSectionId: model.helpSectionId,
                        hasExplaination: model.hasExplaination,
                        snapshot: {
                            x: x_train,
                            y: encoded_y,
                            xt: x_test,
                            yt: encoded_y_test,
                            xFeatures: x_train.columns,
                            categoricals: categoricalFeatures,
                            id: this.modelOption,
                            labels: uniqueLabels
                        },
                        seed: seed,
                        encoder: labelEncoder,
                        name: this.usePCAs ? 'PC.' + this.modelName : this.modelName,
                        datasetName: this.settings.getDatasetName,
                        modelTask: this.settings.classificationTask,
                        metrics: metrics,
                        options: JSON.parse(JSON.stringify(this.modelConfigurations)),
                        target: target,
                        categoricalFeatures: this.settings.items.filter(m => m.selected && m.type !== FeatureCategories.Numerical.id).map(m => m.name),
                        numericColumns: numericColumns,
                        transformations: [...this.settings.transformationsList.filter(feature => feature.type != 0)],
                        tables: model.tables,
                        plots: model.plots,
                        predictions: predictions,
                        model: model

                    });
                    this.settings.setActiveTab(2);
                    setTimeout(async () => {
                        this.settings.setResultActiveTab(model.id + 1);
                        window.dispatchEvent(new Event('resize'));
                    }, 100);
                    if (!this.useHPC) {
                        await model.visualize(x_test, encoded_y_test, uniqueLabels, predictions, labelEncoder, x_train.columns, categoricalFeatures)
                    }
                    this.settings.increaseCounter();
                    this.toggleTraining();
                }
            } catch (error) {
                console.error("Training error details:", error);
                this.training = false;
                let message = 'Failed to fit the ' + this.modelName
                this.$buefy.toast.open(
                    {
                        duration: 3000,
                        message: message,
                        type: 'is-warning',
                    })
                this.settings.addMessage({ message: message, type: 'warning' });
                throw error;
            }
        },
        async impute() {
            const danfo = await getDanfo();
            this.training = true;
            axios.post('http://127.0.0.1:5000/missforest', {
                data: danfo.toJSON(this.dataframe),
                categoricalFeatures: this.settings.items.filter(m => m.selected && m.type !== FeatureCategories.Numerical.id).map(m => m.name)
            }).then(res => {
                let df = new danfo.DataFrame(res.data);
                this.dataframe = df
                this.settings.setDataframe(df);
                this.training = false;
            })
        }
    },
    mounted() {
        this.refreshHpcStatus();
    },
    created: function () {
        this.Toast = useToast()
        this.taskMode = this.settings.getTaskMode || TASK_MODES.AUTO

        this.splitData = function (cross_validation_setting, filterd_dataset, targets, stepSize = 0.7) {
            let x_train, y_train, x_test, y_test;
            let len = filterd_dataset.$data.length
            if (cross_validation_setting === CV_OPTIONS.SPLIT) {
                const limit = Math.ceil(len * stepSize)
                const train_bound = `0:${limit}`
                const test_bound = `${limit}:${len}`
                x_train = filterd_dataset.iloc({ rows: [train_bound] })
                y_train = targets.iloc([train_bound])
                x_test = filterd_dataset.iloc({ rows: [test_bound] });
                y_test = targets.iloc([test_bound]);
            } else if (cross_validation_setting === CV_OPTIONS.NO) {
                x_train = filterd_dataset
                y_train = targets
                x_test = filterd_dataset
                y_test = targets
            }
            return [x_train, y_train, x_test, y_test]
        }
        this.resolveTrainingSplit = async function (cross_validation_setting, filterd_dataset, targets) {
            if (cross_validation_setting === CV_OPTIONS.KFOLD) {
                return this.kfoldSplit(filterd_dataset, targets, 1);
            }
            return this.splitData(cross_validation_setting, filterd_dataset, targets);
        }
        this.kfoldSplit = async function (filterd_dataset, targets, fold = 1) {
            const danfo = await getDanfo();

            let x_train, y_train, x_test, y_test;
            let len = filterd_dataset.$data.length
            const lowerLimit = Math.ceil(len * ((fold - 1) * 0.2))
            const upperLimit = Math.ceil(len * (fold * 0.2))
            const train_bound_lower = lowerLimit != 0 ? `:${lowerLimit}` : null
            const train_bound_upper = upperLimit != len ? `${upperLimit}:` : null
            const test_bound = `${lowerLimit}:${upperLimit}`


            let x_train_upper = train_bound_upper != null ? filterd_dataset.iloc({ rows: [train_bound_upper] }) : null
            let y_train_upper = train_bound_upper != null ? targets.iloc([train_bound_upper]) : null
            x_test = filterd_dataset.iloc({ rows: [test_bound] });
            y_test = targets.iloc([test_bound]);
            let x_train_lower = train_bound_lower != null ? filterd_dataset.iloc({ rows: [train_bound_lower] }) : null
            let y_train_lower = train_bound_lower != null ? targets.iloc([train_bound_lower]) : null
            if (x_train_lower && x_train_upper) {
                x_train = danfo.concat({ dfList: [x_train_lower, x_train_upper], axis: 0 })
                y_train = danfo.concat({ dfList: [y_train_lower, y_train_upper], axis: 0 })
            } else {
                x_train = x_train_lower == null ? x_train_upper : x_train_lower
                y_train = x_train_lower == null ? y_train_upper : y_train_lower
            }


            return [x_train, y_train, x_test, y_test]

        }
        this.encodeTarget = async function (y_train, y_test) {
            const danfo = await getDanfo();
            let labelEncoder = new danfo.LabelEncoder()
            labelEncoder.fit(y_train)
            labelEncoder.transform(y_train)
            let encoded_y = labelEncoder.transform(y_train)
            let encoded_y_test = labelEncoder.transform(y_test)
            return [labelEncoder, encoded_y, encoded_y_test]
        }
    },
    watch: {
        modelOption: function () {
            this.getDefaultModelConfiguration()
        },


    }
}
</script>

<style scoped>
.control-title {
    font-size: 1.1rem;
    font-weight: 800;
    margin-bottom: 0.2rem;
}

.control-subtitle {
    font-size: 0.77rem;
    margin: 0 auto 0.65rem;
    max-width: 18rem;
    line-height: 1.4;
}

.train-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
}

.control-action-btn {
    min-width: 5.5rem;
}

.control-action-btn-train:not([disabled]) {
    box-shadow: 0 4px 12px rgba(13, 127, 103, 0.25);
}

.control-action-btn-upload {
    background-color: #f2f7f5;
    border: 1px solid #b7ccc4;
    color: #24463d;
}

.control-action-btn-upload:not([disabled]) {
    background: rgba(55, 168, 255, 0.18) !important;
    border-color: rgba(55, 168, 255, 0.5) !important;
    color: #f7fbff !important;
}

.control-action-btn-upload[disabled] {
    background-color: rgba(255, 255, 255, 0.04) !important;
    border-color: rgba(148, 163, 184, 0.15) !important;
    color: #8fa2bd !important;
}

.sidebar-details--advanced .b-checkbox.checkbox span {
    color: #f7fbff !important;
}

.sidebar-hpc-hint {
    font-size: 0.72rem;
    line-height: 1.35;
    margin: 0.25rem 0 0;
    color: #8fa2bd;
}

.sidebar-hpc-hint--warn {
    color: #fbbf24;
}

.model-config-btn {
    background-color: #eef6f3 !important;
    border-color: #bdd0c9 !important;
    color: #21443a !important;
}

.model-config-btn:hover {
    background-color: #e3efea !important;
    border-color: #a8c0b8 !important;
    color: #1b3a31 !important;
}

.is-danger {
    color: red !important;
}
</style>
