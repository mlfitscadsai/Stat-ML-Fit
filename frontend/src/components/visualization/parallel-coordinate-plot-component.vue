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
                    :class="{ 'is-plot-ready': viewState === 'ready' }"
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
            hasPlotDrawn: false,
            prefersReducedMotion: false,
            _motionMql: null,
            _motionHandler: null,
            _resizeObserver: null,
            _resizeRaf: null,
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
            if (this.hasPlotDrawn) {
                this.ParallelCoordinatePlot();
            }
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
            // rAF → debounce timer → resize.
            // parcoords needs the full browser layout cycle (including any CSS
            // transitions on the parent tab panel) to complete before reading
            // offsetWidth, otherwise axis positions are computed from a stale size.
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
                // Parcoords axis positions are baked in at draw time and are NOT
                // updated by Plotly.Plots.resize() alone.  Passing an explicit
                // width forces Plotly to recompute the inter-axis spacing.
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
            // Observe the viewport (layout changes) AND the component root so
            // that when a v-show ancestor reveals this component the observer
            // fires and we can relayout with the now-correct container width.
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
        async ParallelCoordinatePlot() {
            this.isLoading = true;
            try {
                if (!this.settings.rawData?.length || !this.chartController) {
                    return;
                }
                const danfo = await getDanfo()
                const df = new danfo.DataFrame(this.settings.rawData);
                if (this.settings.isClassification && this.settings.classTransformations.length > 0) {
                    this.settings.mergedClasses.forEach((classes) => {
                        let newClass = classes.map(m => m.class).join('_');
                        classes.forEach(cls => {
                            df.replace(cls.class, newClass, { columns: [this.settings.modelTarget], inplace: true })
                        });
                    })
                }

                let validTransformations = this.settings.items.filter(column => column.selected && column.type === 1)
                window.Plotly.purge('parallel_coordinate_plot')
                await applyDataTransformation(
                    df,
                    validTransformations.map((t) => t.name),
                    validTransformations
                );
                let numericColumns = this.settings.items
                    .filter(column => column.selected && column.type === 1)
                    .map(column => column.name)
                    .filter((name) => df.columns.includes(name));
                const target = this.settings.modelTarget;
                if (numericColumns.length < 1 || !target || !df.columns.includes(target)) {
                    return;
                }
                const colsNeeded = [...new Set([...numericColumns, target])];
                let slice = df.loc({ columns: colsNeeded });
                slice.dropNa({ axis: 0, inplace: true });
                await this.chartController.parallelCoordinatePlot(
                    slice.loc({ columns: numericColumns }).values,
                    dfColumn(slice, target).values,
                    numericColumns,
                    this.settings.isClassification
                )
                this.hasPlotDrawn = true;
                await this.$nextTick();
                this.scheduleResizePlot();
            } catch (e) {
                console.warn('ParallelCoordinatePlot:', e);
            } finally {
                this.isLoading = false;
            }
        }
    },
    mounted() {
        this.chartController = new ChartController(null, null)
        this.setupReducedMotion();
        this.setupResizeObserver();
    },
    beforeUnmount() {
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

/* Ensure the card body fills horizontal space inside the SPLOM parent card. */
.distributions-card {
    width: 100%;
}
</style>
