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
                    <span>Class balance &amp; merge</span>
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
                            Class merge and balance are available for classification targets only.
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
                        <p class="distributions-merge__hint">
                            Select two or more classes to merge manually, unmerge combined groups, auto-balance
                            rare classes, or reset all changes.
                        </p>

                        <div
                            v-if="activeMergeGroups.length"
                            class="distributions-merge__groups"
                            aria-label="Active merge groups"
                        >
                            <span
                                v-for="group in activeMergeGroups"
                                :key="group.label"
                                class="distributions-merge__chip"
                            >
                                <span class="distributions-merge__chip-label">{{ group.label }}</span>
                                <span class="distributions-merge__chip-meta">
                                    ← {{ group.members.join(' + ') }}
                                </span>
                                <button
                                    type="button"
                                    class="distributions-merge__chip-btn"
                                    :aria-label="`Unmerge ${group.label}`"
                                    @click="unmergeClass(group.label)"
                                >
                                    <i class="fas fa-times" aria-hidden="true"></i>
                                </button>
                            </span>
                        </div>

                        <div class="distributions-merge__table-wrap">
                            <table class="distributions-merge__table">
                                <thead>
                                    <tr>
                                        <th scope="col" class="col-check">
                                            <span class="is-sr-only">Select</span>
                                        </th>
                                        <th scope="col">Class</th>
                                        <th scope="col">Samples</th>
                                        <th scope="col">Share</th>
                                        <th scope="col" class="col-action">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="row in classesInfo"
                                        :key="row.class"
                                        :class="{
                                            'is-rare': row.isRare,
                                            'is-selected': isClassRowSelected(row),
                                        }"
                                    >
                                        <td class="col-check">
                                            <input
                                                type="checkbox"
                                                :checked="isClassRowSelected(row)"
                                                :aria-label="`Select class ${row.class}`"
                                                @change="toggleClassSelection(row, $event)"
                                            />
                                        </td>
                                        <td>
                                            <span class="distributions-merge__class-name">{{ row.class }}</span>
                                            <span
                                                v-if="row.isMerged"
                                                class="distributions-merge__badge"
                                            >merged</span>
                                        </td>
                                        <td>{{ row.count }}</td>
                                        <td :class="{ 'has-text-danger': row.isMinor }">
                                            {{ row.sharePct }}%
                                        </td>
                                        <td class="col-action">
                                            <button
                                                v-if="row.isMerged"
                                                type="button"
                                                class="distributions-merge__row-btn"
                                                @click="unmergeClass(row.class)"
                                            >
                                                Unmerge
                                            </button>
                                            <span v-else class="distributions-merge__row-muted">—</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="distributions-merge__actions">
                            <button
                                type="button"
                                class="distributions-btn is-primary"
                                :disabled="!canMergeSelected"
                                @click="mergeSelectedClasses()"
                            >
                                <i class="fas fa-compress-arrows-alt" aria-hidden="true"></i>
                                <span>Merge selected</span>
                            </button>
                            <button
                                type="button"
                                class="distributions-btn"
                                :disabled="!settings.isClassification || classesInfo.length < 2"
                                @click="applyAutoClassBalance()"
                            >
                                <i class="fas fa-balance-scale" aria-hidden="true"></i>
                                <span>Auto-balance</span>
                            </button>
                            <button
                                type="button"
                                class="distributions-btn"
                                :disabled="!hasClassChanges"
                                @click="resetAllClassMerges()"
                            >
                                <i class="fas fa-rotate-left" aria-hidden="true"></i>
                                <span>Reset all</span>
                            </button>
                        </div>

                        <p
                            v-if="settings.classBalanceEnabled"
                            class="distributions-merge__strategy"
                        >
                            Sidebar strategy:
                            <strong>{{ classBalanceStrategyLabel }}</strong>
                        </p>
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
import { prepareSplomInputs } from '@/helpers/splom_data';
import {
    buildClassInfoRows,
    mergedLabelFromGroup,
    resolveSelectionToOriginalLabels,
} from '@/helpers/target_class_utils';
import {
    buildEdaBaseValues,
    buildEdaDisplayDataframe,
    edaContextFromSettings,
    getEdaCacheKey,
} from '@/helpers/eda_dataframe';
import {
    applyClassBalanceToValues,
    formatClassBalanceReport,
    needsClassBalance,
    planClassBalance,
    planToClassTransformations,
} from '@/services/preprocessing/class-balance-service';
import PCPComponent from '../visualization/parallel-coordinate-plot-component.vue'
import { getDanfo, getPlotly } from '@/utils/danfo_loader';
import { BSelect } from 'buefy';

/** Rows threshold above which we surface a "plots may take a few seconds" hint. */
const LARGE_DATASET_THRESHOLD = 5000;
/** Cap the skeleton grid so very wide datasets don't paint thousands of shimmer tiles. */
const SKELETON_MAX_AXIS = 12;

export default {
    components: {
        'parallel-coordinate-plot-component': PCPComponent, BSelect
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
            settingsRefreshTimer: null,
            scaleRefreshTimer: null,
            classActionBusy: false,
            _suppressTransformWatch: false,
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
        'settings.classTransformations': {
            handler() {
                if (!this.splomWatchReady || this._suppressTransformWatch) return;
                this.scheduleRefreshFromSettings();
            },
            deep: true,
        },
        'settings.edaRowKeepIndices'() {
            if (!this.splomWatchReady || this._suppressTransformWatch) return;
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
        },
        canMergeSelected() {
            return this.selectedClasses.length >= 2
                && this.selectedClasses.length < this.classesInfo.length;
        },
        hasClassChanges() {
            return (this.settings.classTransformations?.length ?? 0) > 0
                || (this.settings.edaRowKeepIndices?.length ?? 0) > 0;
        },
        activeMergeGroups() {
            return (this.settings.mergedClasses || []).map((group) => ({
                label: mergedLabelFromGroup(group),
                members: group.map((entry) => String(entry.class)),
            })).filter((group) => group.label);
        },
        classBalanceStrategyLabel() {
            const labels = {
                auto: 'Auto (merge then remove)',
                merge: 'Merge only',
                remove: 'Remove rare classes',
                merge_then_remove: 'Merge then remove',
            };
            return labels[this.settings.classBalanceStrategy] || this.settings.classBalanceStrategy;
        },
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
                el.style.width = `${w}px`;
                el.style.minWidth = `${w}px`;
            }
            if (Number.isFinite(h) && h > 0) {
                el.style.height = `${h}px`;
                el.style.minHeight = `${Math.max(460, h)}px`;
            }
        },
        async resizePlotById(plotId) {
            if (typeof window === 'undefined') return;
            const el = document.getElementById(plotId);
            if (!el?.layout) return;
            try {
                const Plotly = await getPlotly();
                if (el.layout.width && el.layout.height) {
                    await Plotly.relayout(plotId, {
                        width: el.layout.width,
                        height: el.layout.height,
                    });
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
        getBasePlotCacheKey() {
            const ctx = edaContextFromSettings(this.settings);
            return getEdaCacheKey(ctx);
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
            const danfo = await getDanfo();
            const ctx = edaContextFromSettings(this.settings);
            const base = await buildEdaBaseValues({ ...ctx, danfo });
            this._basePlotCache = base;
            this._basePlotCacheKey = key;
            this.df = buildEdaDisplayDataframe(base, this.settings, danfo);
        },
        async buildPlotDataframeForDisplay() {
            await this.ensureBasePlotCache();
            const danfo = await getDanfo();
            return buildEdaDisplayDataframe(this._basePlotCache, this.settings, danfo);
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
        async withSuppressTransformWatch(fn) {
            this._suppressTransformWatch = true;
            try {
                await fn();
            } finally {
                this._suppressTransformWatch = false;
            }
        },
        isClassRowSelected(row) {
            return this.selectedClasses.some((entry) => entry.class === row.class);
        },
        toggleClassSelection(row, event) {
            const checked = event?.target?.checked;
            if (checked) {
                if (!this.isClassRowSelected(row)) {
                    this.selectedClasses = [...this.selectedClasses, row];
                }
            } else {
                this.selectedClasses = this.selectedClasses.filter(
                    (entry) => entry.class !== row.class,
                );
            }
        },
        async refreshClassPlots(options = {}) {
            const fast = options.fast !== false;
            this.invalidateBasePlotCache();
            this.df = await this.buildPlotDataframeForDisplay();
            await this.dispalySPLOM(this.df, { fast, syncPcp: true });
            await this.updateClassesInfo();
            this.selectedClasses = [];
            this.scheduleVisibleLayoutSync();
        },
        async refreshLinkedPlots(options = {}) {
            const fast = options.fast !== false;
            await this.$refs.coordinate_plot?.ParallelCoordinatePlot?.({ fast });
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
                if (this.settings.isClassification) {
                    await this.updateClassesInfo();
                }
                await this.refreshLinkedPlots({ fast: false });
            } catch (e) {
                console.warn('refreshPlotsForSettingsChange:', e);
            }
        },
        async updateClassesInfo() {
            await this.ensureBasePlotCache();
            const target = this.settings.modelTarget;
            if (!target || !this._basePlotCache?.values?.[target]) {
                this.classesInfo = [];
                return;
            }
            this.classesInfo = buildClassInfoRows(
                this._basePlotCache.values[target],
                this.settings.mergedClasses,
            );
        },
        async mergeSelectedClasses() {
            if (!this.canMergeSelected || this.classActionBusy) return;
            this.classActionBusy = true;
            try {
                const labels = resolveSelectionToOriginalLabels(
                    this.selectedClasses,
                    this.settings.mergedClasses,
                );
                if (labels.length < 2) {
                    this.$buefy.toast.open('Select at least two classes to merge.');
                    return;
                }
                const newLabel = labels.join('_');
                await this.withSuppressTransformWatch(async () => {
                    this.settings.applyManualClassMerge(labels);
                });
                await this.refreshClassPlots({ fast: true });
                this.$buefy.toast.open(`Merged → ${newLabel}`);
                this.settings.addMessage({
                    message: `Merged classes → ${newLabel}`,
                    type: 'info',
                });
                this.classMergeOpen = true;
            } catch (error) {
                const message = error?.message || String(error);
                this.$buefy.toast.open(message);
            } finally {
                this.classActionBusy = false;
            }
        },
        async unmergeClass(mergedLabel) {
            if (!mergedLabel || this.classActionBusy) return;
            this.classActionBusy = true;
            try {
                await this.withSuppressTransformWatch(async () => {
                    this.settings.unmergeClassByLabel(mergedLabel);
                });
                await this.refreshClassPlots({ fast: true });
                this.$buefy.toast.open(`Unmerged ${mergedLabel}`);
                this.settings.addMessage({
                    message: `Unmerged class group ${mergedLabel}`,
                    type: 'info',
                });
            } catch (error) {
                const message = error?.message || String(error);
                this.$buefy.toast.open(message);
            } finally {
                this.classActionBusy = false;
            }
        },
        async resetAllClassMerges() {
            if (!this.hasClassChanges || this.classActionBusy) return;
            this.classActionBusy = true;
            try {
                await this.withSuppressTransformWatch(async () => {
                    this.settings.resetClassTransformations();
                });
                await this.refreshClassPlots({ fast: true });
                this.$buefy.toast.open('All class merges and balance changes reset.');
                this.settings.addMessage({
                    message: 'Class merges and EDA balance reset to original labels.',
                    type: 'info',
                });
                this.classMergeOpen = true;
            } catch (error) {
                const message = error?.message || String(error);
                this.$buefy.toast.open(message);
            } finally {
                this.classActionBusy = false;
            }
        },
        async applyAutoClassBalance() {
            const target = this.settings.modelTarget;
            if (!this.settings.isClassification || !target || this.classActionBusy) return;

            this.classActionBusy = true;
            try {
                await this.ensureBasePlotCache();
                const values = this._basePlotCache.values[target];
                if (!values?.length) return;

                const strategy = this.settings.classBalanceStrategy || 'auto';
                if (!needsClassBalance(values, { strategy })) {
                    this.$buefy.toast.open('Classes are already balanced for this dataset.');
                    return;
                }

                const plan = planClassBalance(values, { strategy });
                const { values: balanced, keptIndices } = applyClassBalanceToValues(values, plan);
                if (!balanced.length) {
                    throw new Error('Auto-balance removed all rows. Try merge-only strategy.');
                }

                await this.withSuppressTransformWatch(async () => {
                    this.settings.replaceClassTransformations(planToClassTransformations(plan));
                    this.settings.setEdaRowKeepIndices(keptIndices);
                    this.settings.setClassBalanceReport({
                        report: formatClassBalanceReport(plan),
                        original: plan.original,
                        final: plan.final,
                    });
                });

                await this.refreshClassPlots({ fast: true });

                this.$buefy.toast.open('Auto-balance applied to feature distributions.');
                this.settings.addMessage({
                    message: `Auto-balance: ${plan.original.distribution.length} → ${plan.final.distribution.length} classes.`,
                    type: 'info',
                });
                this.classMergeOpen = true;
            } catch (error) {
                const message = error?.message || String(error);
                this.$buefy.toast.open(message);
                this.settings.addMessage({ message, type: 'warning' });
            } finally {
                this.classActionBusy = false;
            }
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
                const syncPcp = options.syncPcp !== false;
                if (!fast) {
                    if (this.settings.isClassification) {
                        await this.updateClassesInfo();
                    }
                    if (syncPcp) {
                        await this.refreshLinkedPlots({ fast: false });
                    }
                } else if (syncPcp) {
                    await this.refreshLinkedPlots({ fast: true });
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
        scaleData() {
            if (this.scaleRefreshTimer) {
                clearTimeout(this.scaleRefreshTimer);
            }
            this.scaleRefreshTimer = setTimeout(() => {
                this.scaleRefreshTimer = null;
                void this.runFeatureScaling();
            }, 50);
        },
        async runFeatureScaling() {
            const validTransformations = this.settings.items.filter(
                (feature) => feature.selected && feature.type === 1 && feature.scaler != 0
            );

            try {
                this.scaleRefreshing = true;
                this.df = await this.buildPlotDataframeForDisplay();
                await this.dispalySPLOM(this.df, { fast: true, syncPcp: true });

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

                    this.settings.addMessage({
                        message: 'scaled fetures: <br> ' + transformations.join('_'),
                        type: 'info',
                    });
                } else {
                    this.settings.resetTransformations();
                }

                this.$emit('coordinate-plot', true);
            } catch (error) {
                const message = 'Something went wrong applying feature scaling: ' + error.toString();
                this.$buefy.toast.open(message);
                this.settings.addMessage({ message, type: 'warning' });
            } finally {
                this.scaleRefreshing = false;
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
