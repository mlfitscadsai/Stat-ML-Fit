<template>
    <section
        class="distributions-card"
        role="region"
        aria-label="Scatterplot Matrix"
        :class="{ 'is-reduced-motion': prefersReducedMotion }"
    >
        <header class="distributions-card__head">
            <div class="distributions-card__heading">
                <h2 class="distributions-card__title">
                    <i class="fas fa-th" aria-hidden="true"></i>
                    Scatterplot Matrix
                    <b-tooltip
                        append-to-body
                        label="nrd method and gaussian kernel is used for kernel density estimation."
                        multilined
                        type="is-dark"
                        position="is-right"
                    >
                        <i
                            class="fas fa-info-circle has-text-grey-light is-size-6 ml-2"
                            style="cursor: help;"
                            aria-hidden="true"
                        ></i>
                    </b-tooltip>
                </h2>
                <p class="distributions-card__subtitle">
                    Pairwise distributions across numeric features with KDE on the diagonal.
                </p>
            </div>
            <div class="distributions-card__badges">
                <span
                    v-if="isLargeDataset"
                    class="distributions-pill"
                    role="status"
                    aria-live="polite"
                >
                    <i class="fas fa-layer-group" aria-hidden="true"></i>
                    {{ datasetSizeLabel }} rows — plots may take a few seconds
                </span>
                <button
                    type="button"
                    class="distributions-btn"
                    :disabled="viewState !== 'ready'"
                    aria-label="Download scatterplot matrix as image"
                    @click="downlaodSPLOM()"
                >
                    <i class="fas fa-download" aria-hidden="true"></i>
                    <span>Download plot</span>
                </button>
            </div>
        </header>

        <div class="distributions-card__body">
            <div v-if="viewState === 'empty'" class="distributions-empty" role="status">
                <i class="far fa-chart-bar distributions-empty__icon" aria-hidden="true"></i>
                <h3 class="distributions-empty__title">Select at least 2 numeric features</h3>
                <p class="distributions-empty__body">
                    The scatterplot matrix needs two or more numeric columns selected in the sidebar
                    to render pairwise relationships.
                </p>
            </div>

            <div v-show="viewState !== 'empty'" class="distributions-plot-viewport">
                <div
                    v-show="viewState === 'loading'"
                    class="distributions-skeleton"
                    :style="skeletonGridStyle"
                    aria-hidden="true"
                >
                    <div
                        v-for="i in skeletonCellCount"
                        :key="i"
                        class="distributions-skeleton__cell"
                    ></div>
                </div>
                <div
                    id="scatterplot_mtx"
                    ref="plotEl"
                    class="distributions-plot"
                    :class="{ 'is-plot-ready': viewState === 'ready', 'is-refreshing': scaleRefreshing }"
                ></div>
            </div>

            <div
                v-show="selectedFeatureColumns.length > 0 && viewState !== 'empty'"
                class="distributions-scaler-bar is-sticky"
                :class="{ 'is-stuck': scalerBarStuck }"
                role="group"
                aria-label="Feature scaling controls"
            >
                <div class="distributions-scaler-bar__inner">
                    <div
                        v-for="feature in selectedFeatureColumns"
                        :key="feature.id != null ? feature.id : feature.name"
                        class="distributions-scaler-cell"
                    >
                        <template v-if="feature.type === 1">
                            <label
                                :id="`scaler-label-${slugify(feature.name)}`"
                                class="distributions-scaler-cell__label"
                                :for="`scaler-${slugify(feature.name)}`"
                            >{{ feature.name }}</label>
                            <div class="select is-small distributions-scaler-cell__select">
                                <select
                                    :id="`scaler-${slugify(feature.name)}`"
                                    :aria-labelledby="`scaler-label-${slugify(feature.name)}`"
                                    v-model="feature.scaler"
                                    @change="scaleData()"
                                >
                                    <option
                                        v-for="option in ScaleOptions"
                                        :value="option.id"
                                        :key="option.id"
                                    >{{ option.name }}</option>
                                </select>
                            </div>
                        </template>
                        <template v-else>
                            <span class="distributions-scaler-cell__label is-categorical">
                                {{ feature.name }}
                            </span>
                            <span class="distributions-scaler-cell__meta">categorical</span>
                        </template>
                    </div>
                </div>
            </div>

            <parallel-coordinate-plot-component ref="coordinate_plot" />

            <details
                v-if="datasetRowCount > 0"
                class="distributions-merge"
                :open="classMergeOpen"
                @toggle="onClassMergeToggle"
            >
                <summary class="distributions-merge__summary">
                    <span>Merge classes</span>
                    <span v-if="settings.isClassification && classesInfo.length" class="distributions-merge__count">
                        {{ classesInfo.length }}
                        {{ classesInfo.length === 1 ? 'class' : 'classes' }}
                    </span>
                </summary>
                <div class="distributions-merge__body">
                    <div
                        v-if="!settings.isClassification"
                        class="distributions-empty is-compact"
                        role="status"
                    >
                        <p class="distributions-empty__body">
                            Merge classes is available for classification targets only.
                            Current target is treated as regression.
                        </p>
                    </div>
                    <div
                        v-else-if="classesInfo.length === 0"
                        class="distributions-empty is-compact"
                        role="status"
                    >
                        <p class="distributions-empty__body">
                            No classes detected yet. Select a classification target first.
                        </p>
                    </div>
                    <template v-else>
                        <b-table
                            class="is-size-7 distributions-merge__table"
                            :data="classesInfo"
                            :columns="classesInfoColumns"
                            checkable
                            :row-class="(row) => row.mode <= 0.10 ? 'has-text-danger' : ''"
                            :narrowed="true"
                            :checked-rows.sync="selectedClasses"
                        ></b-table>
                        <div class="distributions-merge__actions">
                            <button
                                type="button"
                                class="distributions-btn is-primary"
                                :disabled="
                                    !selectedClasses?.length ||
                                    selectedClasses.length >= classesInfo.length
                                "
                                @click="scaleData()"
                            >
                                <i class="fas fa-compress-arrows-alt" aria-hidden="true"></i>
                                <span>Merge classes</span>
                            </button>
                            <button
                                type="button"
                                class="distributions-btn"
                                @click="scaleData(true)"
                            >
                                <i class="fas fa-rotate-left" aria-hidden="true"></i>
                                <span>Reset</span>
                            </button>
                        </div>
                    </template>
                </div>
            </details>

            <b-loading :is-full-page="false" v-model="isLoading"></b-loading>
        </div>
    </section>
</template>

<script>
import { ChartController } from '@/helpers/charts';
import { settingStore } from '@/stores/settings'
import { ScaleOptions } from '@/helpers/settings'
import { transformColumnValues } from '@/helpers/utils';
import { prepareSplomInputs } from '@/helpers/splom_data';
import PCPComponent from '../visualization/parallel-coordinate-plot-component.vue'
import { getDanfo, getPlotly } from '@/utils/danfo_loader';
import { BSelect, BTable } from 'buefy';

/** Rows threshold above which we surface a "plots may take a few seconds" hint. */
const LARGE_DATASET_THRESHOLD = 5000;
/** Cap the skeleton grid so very wide datasets don't paint thousands of shimmer tiles. */
const SKELETON_MAX_AXIS = 12;

export default {
    components: {
        'parallel-coordinate-plot-component': PCPComponent, BSelect, BTable
    },
    setup() {
        const settings = settingStore()
        return { settings }
    },
    name: 'ScatterplotMatrixComponent',
    props: {
        msg: String,
        update: {}
    },
    data() {
        return {
            isLoading: false,
            hasPlotDrawn: false,
            prefersReducedMotion: false,
            classMergeOpen: true,
            scalerBarStuck: false,
            _motionMql: null,
            _motionHandler: null,
            _scrollHandler: null,
            _visibleLayoutTimer: null,
            ScaleOptions: ScaleOptions,
            features: [],
            df: null,
            rawData: null,
            classesInfo: [],
            selectedClasses: [],
            classesInfoColumns: [],
            settingsRefreshTimer: null,
            scaleRefreshTimer: null,
            scaleRefreshing: false,
            _basePlotCache: null,
            _basePlotCacheKey: '',
            /** Avoid duplicate draw on mount before first initSPLOM finishes. */
            splomWatchReady: false,
        }
    },
    watch: {
        'settings.modelTarget'() {
            if (!this.splomWatchReady) return;
            this.scheduleRefreshFromSettings();
        },
        'settings.isClassification'() {
            if (!this.splomWatchReady) return;
            this.scheduleRefreshFromSettings();
        },
        'settings.seed'() {
            if (!this.splomWatchReady) return;
            this.scheduleRefreshFromSettings();
        },
        'settings.isDark'() {
            if (!this.splomWatchReady) return;
            this.scheduleRefreshFromSettings();
        },
    },
    computed: {
        selectedFeatureColumns() {
            return (this.settings.items || []).filter((c) => c && c.selected);
        },
        selectedNumericCount() {
            return this.selectedFeatureColumns.filter((c) => c.type === 1).length;
        },
        datasetRowCount() {
            const raw = this.settings.rawData;
            return Array.isArray(raw) ? raw.length : 0;
        },
        isLargeDataset() {
            return this.datasetRowCount > LARGE_DATASET_THRESHOLD;
        },
        datasetSizeLabel() {
            const n = this.datasetRowCount;
            if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
            if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
            return `${n}`;
        },
        viewState() {
            if (this.datasetRowCount === 0 || this.selectedNumericCount < 2) {
                return 'empty';
            }
            if (this.isLoading || !this.hasPlotDrawn) return 'loading';
            return 'ready';
        },
        skeletonCellCount() {
            const n = Math.min(this.selectedNumericCount || 4, SKELETON_MAX_AXIS);
            return n * n;
        },
        skeletonGridStyle() {
            const n = Math.min(this.selectedNumericCount || 4, SKELETON_MAX_AXIS);
            return { 'grid-template-columns': `repeat(${n}, 1fr)` };
        },
        column_width: {
            get() {
                return this.features.length === 0 ? 0 : 100 / this.features.length
            }
        }
    },
    methods: {
        slugify(name) {
            return String(name || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'feature';
        },
        onClassMergeToggle(event) {
            this.classMergeOpen = !!event?.target?.open;
        },
        setupReducedMotion() {
            if (typeof window === 'undefined' || !window.matchMedia) return;
            this._motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.prefersReducedMotion = this._motionMql.matches;
            this._motionHandler = (e) => { this.prefersReducedMotion = e.matches; };
            if (this._motionMql.addEventListener) {
                this._motionMql.addEventListener('change', this._motionHandler);
            } else if (this._motionMql.addListener) {
                this._motionMql.addListener(this._motionHandler);
            }
        },
        teardownReducedMotion() {
            if (!this._motionMql || !this._motionHandler) return;
            if (this._motionMql.removeEventListener) {
                this._motionMql.removeEventListener('change', this._motionHandler);
            } else if (this._motionMql.removeListener) {
                this._motionMql.removeListener(this._motionHandler);
            }
        },
        setupScrollShadow() {
            if (typeof window === 'undefined') return;
            this._scrollHandler = () => {
                const el = this.$el?.querySelector?.('.distributions-scaler-bar');
                if (!el) return;
                const rect = el.getBoundingClientRect();
                this.scalerBarStuck = rect.top <= 6;
            };
            window.addEventListener('scroll', this._scrollHandler, { passive: true });
        },
        teardownScrollShadow() {
            if (this._scrollHandler && typeof window !== 'undefined') {
                window.removeEventListener('scroll', this._scrollHandler);
            }
        },
        syncPlotIntrinsicSize() {
            if (typeof document === 'undefined') return;
            const el = document.getElementById('scatterplot_mtx');
            if (!el?.layout) return;
            const w = el.layout.width;
            const h = el.layout.height;
            if (Number.isFinite(w) && w > 0) {
                el.style.minWidth = `${w}px`;
            }
            if (Number.isFinite(h) && h > 0) {
                el.style.minHeight = `${Math.max(460, h)}px`;
            }
        },
        async resizePlotById(plotId) {
            if (typeof window === 'undefined') return;
            const el = document.getElementById(plotId);
            if (!el || !el.data) return;
            try {
                const Plotly = await getPlotly();
                if (Plotly?.Plots?.resize) {
                    await Plotly.Plots.resize(el);
                }
            } catch (e) {
                console.warn(`resize ${plotId}:`, e);
            }
        },
        scheduleVisibleLayoutSync() {
            if (this._visibleLayoutTimer) {
                clearTimeout(this._visibleLayoutTimer);
            }
            this._visibleLayoutTimer = setTimeout(() => {
                this._visibleLayoutTimer = null;
                void this.ensureVisibleLayout();
            }, 70);
        },
        async ensureVisibleLayout(redrawPcp = false) {
            await this.$nextTick();
            this.syncPlotIntrinsicSize();
            await this.resizePlotById('scatterplot_mtx');
            if (redrawPcp) {
                await this.$refs.coordinate_plot?.ParallelCoordinatePlot();
            } else {
                await this.$refs.coordinate_plot?.resizePlot?.();
            }
        },
        downlaodSPLOM() {
            this.chartController.downloadPlot('scatterplot_mtx')
        },
        /** Apply saved class merges to the target column (in place). */
        applyMergedClassesToDataframe(df) {
            const target = this.settings.modelTarget;
            if (!target || !df?.columns?.includes(target) || !this.settings.mergedClasses?.length) {
                return;
            }
            this.settings.mergedClasses.forEach((classes) => {
                const newClass = classes.map((m) => m.class).join('_');
                classes.forEach((cls) => {
                    df.replace(cls.class, newClass, { columns: [target], inplace: true });
                });
            });
        },
        /**
         * Raw data + class merges + shuffle/sample (seed) + drop empty columns — same basis as SPLOM plots.
         */
        async buildWorkingDataframe() {
            const danfo = await getDanfo();
            let df = new danfo.DataFrame(this.settings.rawData);
            this.applyMergedClassesToDataframe(df);
            df = await df.sample(df.$data.length, { seed: this.settings.getSeed });
            df.dropNa({ axis: 1, inplace: true });
            return df;
        },
        getBasePlotCacheKey() {
            const raw = this.settings.rawData;
            const rowCount = Array.isArray(raw) ? raw.length : 0;
            const mergeCount = this.settings.mergedClasses?.length ?? 0;
            return `${rowCount}:${this.settings.getSeed}:${mergeCount}:${this.settings.modelTarget || ''}`;
        },
        invalidateBasePlotCache() {
            this._basePlotCache = null;
            this._basePlotCacheKey = '';
        },
        async ensureBasePlotCache() {
            const key = this.getBasePlotCacheKey();
            if (this._basePlotCache && this._basePlotCacheKey === key) {
                return;
            }
            const df = await this.buildWorkingDataframe();
            const columns = df.columns.slice();
            const values = {};
            for (const col of columns) {
                values[col] = df.column(col).values.slice();
            }
            this._basePlotCache = { columns, values };
            this._basePlotCacheKey = key;
            this.df = df;
        },
        async buildPlotDataframeForDisplay() {
            await this.ensureBasePlotCache();
            const danfo = await getDanfo();
            const { columns, values } = this._basePlotCache;
            const data = {};
            for (const col of columns) {
                let colValues = values[col].slice();
                const feature = this.settings.items.find(
                    (item) => item.name === col && item.selected && item.type === 1
                );
                if (feature && feature.scaler != 0) {
                    colValues = transformColumnValues(colValues, feature.scaler);
                }
                data[col] = colValues;
            }
            return new danfo.DataFrame(data);
        },
        syncFeaturesMetaFromSettings() {
            const numericColumns = this.settings.items
                .filter((column) => column.selected && column.type === 1)
                .map((column) => ({ name: column.name, type: column.type }));
            this.features = numericColumns.map((feature, i) => ({
                id: i,
                name: feature.name,
                type: feature.type,
                scaler: 0,
            }));
        },
        scheduleRefreshFromSettings() {
            if (this.settingsRefreshTimer) {
                clearTimeout(this.settingsRefreshTimer);
            }
            this.settingsRefreshTimer = setTimeout(() => {
                this.settingsRefreshTimer = null;
                void this.refreshPlotsForSettingsChange();
            }, 80);
        },
        /**
         * Call when target, task mode, or seed changes (exposed for parent / tests).
         */
        async refreshPlotsForSettingsChange() {
            if (!this.chartController || !this.settings.rawData?.length) {
                return;
            }
            await this.$nextTick();
            try {
                this.invalidateBasePlotCache();
                this.df = await this.buildPlotDataframeForDisplay();
                this.syncFeaturesMetaFromSettings();
                await this.dispalySPLOM(this.df);
            } catch (e) {
                console.warn('refreshPlotsForSettingsChange:', e);
            }
        },
        async updateClassesInfo() {
            const danfo = await getDanfo()

            this.df = new danfo.DataFrame(this.settings.rawData);
            this.applyMergedClassesToDataframe(this.df);
            if (!this.settings.modelTarget || !this.df.columns?.includes(this.settings.modelTarget)) {
                this.classesInfo = [];
                return;
            }
            let targetValues;
            try {
                targetValues = this.df.column(this.settings.modelTarget).values;
            } catch {
                this.classesInfo = [];
                return;
            }
            let samplesLength = targetValues.length;
            let classes = new Set(...[targetValues]);
            let result = []
            classes.forEach(cls => {
                result.push({
                    class: cls,
                    mode: +(targetValues.filter(val => val === cls).length / samplesLength).toFixed(2)
                })
            });
            this.classesInfo = result.concat();
            this.classesInfoColumns = [{
                field: 'class',
                label: ' class'
            }, {
                field: 'mode',
                label: 'Samples in each class (%)'
            }]
        },
        async dispalySPLOM(dataframe, options = {}) {
            if (!this.chartController) {
                return;
            }
            const fast = options.fast === true;
            if (!fast) {
                this.isLoading = true;
            } else {
                this.scaleRefreshing = true;
            }
            try {
                const numericColumns = this.settings.items
                    .filter((column) => column.selected && column.type === 1)
                    .map((column) => column.name);
                const categorical_columns = [];
                if (numericColumns.length < 2) {
                    if (!fast) {
                        this.$buefy.toast.open('Select at least 2 numerical features for scatterplot matrix');
                    }
                    return;
                }

                dataframe.dropNa({ axis: 1, inplace: true });

                const prep = prepareSplomInputs(
                    dataframe,
                    numericColumns,
                    this.settings.modelTarget,
                    this.settings.isClassification
                );
                if (prep.error) {
                    if (!fast) {
                        this.$buefy.toast.open(prep.error);
                    }
                    return;
                }
                if (!fast) {
                    prep.warnings.forEach((w) =>
                        this.settings.addMessage({ message: w, type: 'info' })
                    );
                }

                await this.chartController.ScatterplotMatrix(
                    prep.items,
                    prep.matrixFeatureNames,
                    prep.labelValues,
                    categorical_columns.length,
                    this.settings.isClassification,
                    numericColumns,
                    categorical_columns,
                    this.settings.modelTarget,
                    prep.extendTargetMargins,
                    { skipPurge: fast }
                );
                this.hasPlotDrawn = true;
                if (!fast) {
                    if (this.settings.isClassification) {
                        await this.updateClassesInfo();
                    }
                    await this.$refs.coordinate_plot?.ParallelCoordinatePlot();
                } else {
                    void this.$refs.coordinate_plot?.ParallelCoordinatePlot?.();
                }
                this.scheduleVisibleLayoutSync();
            } catch (error) {
                const message = 'Something went wrong drawing data analysis plots' + error.toString();
                this.$buefy.toast.open(message);
                this.settings.addMessage({ message: message, type: 'warning' });
            } finally {
                if (!fast) {
                    this.isLoading = false;
                } else {
                    this.scaleRefreshing = false;
                }
            }
        },
        scaleData(reset = false) {
            if (this.scaleRefreshTimer) {
                clearTimeout(this.scaleRefreshTimer);
            }
            this.scaleRefreshTimer = setTimeout(() => {
                this.scaleRefreshTimer = null;
                void this.runScaleData(reset);
            }, 50);
        },
        async runScaleData(reset = false) {
            if (reset) {
                this.settings.resetClassTransformations([]);
                this.invalidateBasePlotCache();
                await this.updateClassesInfo();
            }

            const didMerge = this.settings.isClassification && this.selectedClasses?.length > 0;
            if (didMerge) {
                this.invalidateBasePlotCache();
                await this.ensureBasePlotCache();
                const newClass = this.selectedClasses.map((m) => m.class).join('_');
                this.selectedClasses.forEach((cls) => {
                    this.df.replace(cls.class, newClass, { columns: [this.settings.modelTarget], inplace: true });
                });
                this._basePlotCache.values[this.settings.modelTarget] = this.df
                    .column(this.settings.modelTarget)
                    .values.slice();
                this.settings.setClassTransformation(this.selectedClasses);
                const message = { message: 'merged classes: ' + newClass, type: 'info' };
                this.$buefy.toast.open('merged classes: ' + newClass);
                this.settings.addMessage(message);
            }

            const validTransformations = this.settings.items.filter(
                (feature) => feature.selected && feature.type === 1 && feature.scaler != 0
            );

            try {
                this.df = await this.buildPlotDataframeForDisplay();
                await this.dispalySPLOM(this.df, { fast: true });

                if (validTransformations.length > 0) {
                    const transformations = [];
                    this.settings.resetTransformations();
                    validTransformations.forEach((transformation) => {
                        const transformationInfo = Object.keys(ScaleOptions).find(
                            (key) => ScaleOptions[key].id == transformation.scaler
                        );
                        transformation.scalerLabel = transformationInfo;
                        this.settings.addTransformation(transformation);
                        transformations.push(
                            `feature: ${transformation.name} ,scaler: ${transformation.scalerLabel} `
                        );
                    });

                    const message = {
                        message: 'scaled fetures: <br> ' + transformations.join('_'),
                        type: 'info',
                    };
                    this.settings.addMessage(message);
                } else {
                    this.settings.resetTransformations();
                }

                if (didMerge && !reset) {
                    this.classMergeOpen = false;
                }

                this.$emit('coordinate-plot', true);
            } catch (error) {
                const message = 'Something went wrong applying feature scaling: ' + error.toString();
                this.$buefy.toast.open(message);
                this.settings.addMessage({ message, type: 'warning' });
            } finally {
                this.selectedClasses = [];
            }
        },
        async initSPLOM() {
            if (!this.settings.rawData || this.settings.rawData.length === 0) {
                return;
            }
            this.invalidateBasePlotCache();
            this.df = await this.buildPlotDataframeForDisplay();
            this.syncFeaturesMetaFromSettings();
            await this.dispalySPLOM(this.df);
        }
    },
    mounted() {
        this.chartController = new ChartController(null, null)
        this.setupReducedMotion();
        this.setupScrollShadow();
        // DOM (#scatterplot_mtx) must exist and chartController must be set — do not draw from async created()
        this.$nextTick(async () => {
            await this.initSPLOM();
            this.splomWatchReady = true;
        })
    },
    beforeUnmount() {
        if (this.settingsRefreshTimer) {
            clearTimeout(this.settingsRefreshTimer);
        }
        if (this.scaleRefreshTimer) {
            clearTimeout(this.scaleRefreshTimer);
        }
        if (this._visibleLayoutTimer) {
            clearTimeout(this._visibleLayoutTimer);
        }
        this.teardownReducedMotion();
        this.teardownScrollShadow();
    },
}
</script>
