<template>
    <section
        class="distributions-card my-1"
        role="region"
        aria-label="Parallel Coordinate Plot"
        :class="{ 'is-reduced-motion': prefersReducedMotion }"
    >
        <header class="distributions-card__head">
            <div class="distributions-card__heading">
                <h2 class="distributions-card__title">
                    <i class="fas fa-stream" aria-hidden="true"></i>
                    Parallel Coordinate Plot
                </h2>
                <p class="distributions-card__subtitle">
                    Every row is a polyline across selected numeric features, colored by target.
                </p>
            </div>
        </header>

        <div class="distributions-card__body">
            <div v-if="viewState === 'empty'" class="distributions-empty" role="status">
                <i class="fas fa-stream distributions-empty__icon" aria-hidden="true"></i>
                <h3 class="distributions-empty__title">Pick a target and at least one numeric feature</h3>
                <p class="distributions-empty__body">
                    The parallel coordinate plot needs a classification or regression target plus
                    one or more numeric features selected in the sidebar.
                </p>
            </div>

            <div v-show="viewState !== 'empty'" class="distributions-plot-viewport">
                <div
                    v-show="viewState === 'loading'"
                    class="distributions-skeleton distributions-skeleton--strip"
                    aria-hidden="true"
                >
                    <div
                        v-for="i in 32"
                        :key="i"
                        class="distributions-skeleton__cell"
                    ></div>
                </div>
                <div
                    id="parallel_coordinate_plot"
                    class="distributions-plot"
                    :class="{ 'is-plot-ready': viewState === 'ready', 'is-refreshing': isRefreshing }"
                ></div>
            </div>
            <b-loading :is-full-page="false" v-model="isLoading"></b-loading>
        </div>
    </section>
</template>

<script>
import { settingStore } from '@/stores/settings'
import { ScaleOptions } from '@/helpers/settings'
import { ChartController } from '@/helpers/charts';
import { getDanfo, getPlotly } from '@/utils/danfo_loader';
import { dfColumn } from '@/utils/danfo_frame';
import { applyDataTransformation } from '@/helpers/utils';
import {
    buildEdaBaseValues,
    buildEdaDisplayDataframe,
    edaContextFromSettings,
    getEdaCacheKey,
} from '@/helpers/eda_dataframe';

export default {
    setup() {
        const settings = settingStore()
        return { settings }
    },
    name: 'ParallelCoordinatePlotComponent',
    props: {
        msg: String,
        update: {}
    },
    data() {
        return {
            isLoading: false,
            isRefreshing: false,
            hasPlotDrawn: false,
            prefersReducedMotion: false,
            _motionMql: null,
            _motionHandler: null,
            _resizeObserver: null,
            _resizeRaf: null,
            _basePlotCache: null,
            _basePlotCacheKey: '',
            _refreshTimer: null,
            pcpWatchReady: false,
            ScaleOptions: ScaleOptions,
            features: [],
            df: null,
            rawData: null,
        }
    },
    watch: {
        viewState(newState) {
            if (newState === 'ready') {
                this.scheduleResizePlot();
            }
        },
        'settings.isDark'() {
            if (this.pcpWatchReady && this.hasPlotDrawn) {
                this.scheduleRefresh();
            }
        },
        'settings.modelTarget'() {
            if (!this.pcpWatchReady) return;
            this.scheduleRefresh();
        },
        'settings.isClassification'() {
            if (!this.pcpWatchReady) return;
            this.scheduleRefresh();
        },
        'settings.seed'() {
            if (!this.pcpWatchReady) return;
            this.scheduleRefresh();
        },
        'settings.classTransformations': {
            handler() {
                if (!this.pcpWatchReady) return;
                this.scheduleRefresh();
            },
            deep: true,
        },
        'settings.edaRowKeepIndices'() {
            if (!this.pcpWatchReady) return;
            this.scheduleRefresh();
        },
        'settings.items': {
            handler() {
                if (!this.pcpWatchReady) return;
                this.scheduleRefresh();
            },
            deep: true,
        },
    },
    computed: {
        selectedNumericCount() {
            return (this.settings.items || [])
                .filter((c) => c && c.selected && c.type === 1).length;
        },
        datasetRowCount() {
            const raw = this.settings.rawData;
            return Array.isArray(raw) ? raw.length : 0;
        },
        viewState() {
            if (
                this.datasetRowCount === 0 ||
                this.selectedNumericCount < 1 ||
                !this.settings.modelTarget
            ) {
                return 'empty';
            }
            if (this.isLoading || !this.hasPlotDrawn) return 'loading';
            return 'ready';
        },
    },
    methods: {
        scheduleRefresh() {
            if (this._refreshTimer) {
                clearTimeout(this._refreshTimer);
            }
            this._refreshTimer = setTimeout(() => {
                this._refreshTimer = null;
                void this.ParallelCoordinatePlot({ fast: true });
            }, 60);
        },
        invalidateBasePlotCache() {
            this._basePlotCache = null;
            this._basePlotCacheKey = '';
        },
        getBasePlotCacheKey() {
            return getEdaCacheKey(edaContextFromSettings(this.settings));
        },
        async ensureBasePlotCache() {
            const key = this.getBasePlotCacheKey();
            if (this._basePlotCache && this._basePlotCacheKey === key) {
                return;
            }
            const danfo = await getDanfo();
            const ctx = edaContextFromSettings(this.settings);
            this._basePlotCache = await buildEdaBaseValues({ ...ctx, danfo });
            this._basePlotCacheKey = key;
        },
        async buildPlotDataframe() {
            await this.ensureBasePlotCache();
            const danfo = await getDanfo();
            return buildEdaDisplayDataframe(this._basePlotCache, this.settings, danfo);
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
        scheduleResizePlot() {
            if (typeof window === 'undefined') return;
            if (this._resizeRaf) {
                window.cancelAnimationFrame(this._resizeRaf);
                this._resizeRaf = null;
            }
            this._resizeRaf = window.requestAnimationFrame(() => {
                this._resizeRaf = setTimeout(() => {
                    this._resizeRaf = null;
                    void this.resizePlot();
                }, 250);
            });
        },
        async resizePlot() {
            if (typeof window === 'undefined') return;
            const el = document.getElementById('parallel_coordinate_plot');
            if (!el || !el.data) return;
            try {
                const Plotly = await getPlotly();
                const w = el.offsetWidth;
                const update = w > 100
                    ? { width: w, autosize: true }
                    : { autosize: true };
                await Plotly.relayout(el, update);
            } catch (e) {
                console.warn('ParallelCoordinatePlot resize:', e);
            }
        },
        setupResizeObserver() {
            if (typeof window === 'undefined' || typeof window.ResizeObserver === 'undefined') {
                return;
            }
            this._resizeObserver = new window.ResizeObserver(() => {
                this.scheduleResizePlot();
            });
            const viewport = this.$el?.querySelector?.('.distributions-plot-viewport');
            if (viewport) this._resizeObserver.observe(viewport);
            if (this.$el) this._resizeObserver.observe(this.$el);
        },
        teardownResizeObserver() {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            if (this._resizeRaf != null && typeof window !== 'undefined') {
                window.cancelAnimationFrame(this._resizeRaf);
                clearTimeout(this._resizeRaf);
                this._resizeRaf = null;
            }
        },
        async ParallelCoordinatePlot(options = {}) {
            const fast = options.fast === true;
            if (!this.settings.rawData?.length || !this.chartController) {
                return;
            }

            if (!fast) {
                this.isLoading = true;
            } else {
                this.isRefreshing = true;
            }

            try {
                const danfo = await getDanfo();
                const df = await this.buildPlotDataframe();

                const validTransformations = (this.settings.items || [])
                    .filter((column) => column.selected && column.type === 1);

                if (typeof window !== 'undefined' && window.Plotly) {
                    window.Plotly.purge('parallel_coordinate_plot');
                }

                await applyDataTransformation(
                    df,
                    validTransformations.map((t) => t.name),
                    validTransformations,
                );

                const numericColumns = (this.settings.items || [])
                    .filter((column) => column.selected && column.type === 1)
                    .map((column) => column.name)
                    .filter((name) => df.columns.includes(name));

                const target = this.settings.modelTarget;
                if (numericColumns.length < 1 || !target || !df.columns.includes(target)) {
                    return;
                }

                const colsNeeded = [...new Set([...numericColumns, target])];
                const slice = df.loc({ columns: colsNeeded });
                slice.dropNa({ axis: 0, inplace: true });

                await this.chartController.parallelCoordinatePlot(
                    slice.loc({ columns: numericColumns }).values,
                    dfColumn(slice, target).values,
                    numericColumns,
                    this.settings.isClassification,
                );
                this.hasPlotDrawn = true;
                await this.$nextTick();
                this.scheduleResizePlot();
            } catch (e) {
                console.warn('ParallelCoordinatePlot:', e);
            } finally {
                if (!fast) {
                    this.isLoading = false;
                } else {
                    this.isRefreshing = false;
                }
            }
        },
    },
    mounted() {
        this.chartController = new ChartController(null, null)
        this.setupReducedMotion();
        this.setupResizeObserver();
        this.$nextTick(() => {
            this.pcpWatchReady = true;
        });
    },
    beforeUnmount() {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this.teardownReducedMotion();
        this.teardownResizeObserver();
    },
}
</script>

<style scoped>
#parallel_coordinate_plot {
    min-height: 480px;
    width: 100%;
}

.distributions-card {
    width: 100%;
}
</style>
