<template>
    <div class="dh-root" v-if="renderKey">
        <!-- ░░ HERO ░░ -->
        <header class="dh-hero">
            <div class="dh-hero__bg" aria-hidden="true">
                <span class="dh-hero__orb dh-hero__orb--a"></span>
                <span class="dh-hero__orb dh-hero__orb--b"></span>
                <span class="dh-hero__orb dh-hero__orb--c"></span>
            </div>

            <div class="dh-hero__content">
                <div class="dh-hero__title-block">
                    <div class="dh-hero__icon" :class="`dh-hero__icon--${healthGrade.tone}`">
                        <i class="fas fa-shield-heart"></i>
                    </div>
                    <div>
                        <h2 class="dh-hero__title">
                            Dataset health overview
                            <span class="dh-live-dot" title="Live updates"></span>
                        </h2>
                        <p class="dh-hero__subtitle">
                            Profiling, anomaly detection &amp; quality scoring &mdash; refreshed
                            <strong>{{ lastUpdatedLabel }}</strong>
                        </p>
                    </div>
                </div>

                <!-- Health score gauge -->
                <div class="dh-score" :class="`dh-score--${healthGrade.tone}`">
                    <svg viewBox="0 0 120 120" class="dh-score__ring">
                        <circle class="dh-score__ring-bg" cx="60" cy="60" r="52"></circle>
                        <circle class="dh-score__ring-fg" cx="60" cy="60" r="52"
                            :stroke-dasharray="ringCircumference"
                            :stroke-dashoffset="ringOffset"></circle>
                    </svg>
                    <div class="dh-score__center">
                        <span class="dh-score__value">{{ animatedScore }}</span>
                        <span class="dh-score__label">{{ healthGrade.label }}</span>
                    </div>
                </div>
            </div>

            <!-- Toolbar / customizable widgets -->
            <div class="dh-toolbar">
                <div class="dh-toolbar__group">
                    <span class="dh-toolbar__caption">Outlier method</span>
                    <div class="dh-segmented">
                        <button v-for="m in outlierMethods" :key="m.id"
                            type="button"
                            class="dh-segmented__btn"
                            :class="{ 'is-active': outlierMethod === m.id }"
                            @click="setOutlierMethod(m.id)">
                            <i :class="m.icon"></i> {{ m.label }}
                        </button>
                    </div>
                </div>

                <div class="dh-toolbar__group" v-if="outlierMethod === 'zscore'">
                    <span class="dh-toolbar__caption">Z threshold: <strong>{{ zThreshold.toFixed(1) }}</strong></span>
                    <input type="range" min="2" max="4" step="0.1" v-model.number="zThreshold"
                        class="dh-slider" @change="recomputeOutliers" />
                </div>

                <div class="dh-toolbar__group dh-toolbar__group--right">
                    <button v-for="w in widgetToggles" :key="w.id"
                        type="button"
                        class="dh-chip"
                        :class="{ 'is-active': widgetVisible[w.id] }"
                        :title="w.title"
                        @click="toggleWidget(w.id)">
                        <i :class="w.icon"></i> {{ w.label }}
                    </button>
                </div>
            </div>
        </header>

        <section v-if="readiness" class="dh-panel">
            <header class="dh-panel__head">
                <div>
                    <h3 class="dh-panel__title">
                        <i class="fas fa-route" aria-hidden="true"></i>
                        ML readiness score
                    </h3>
                    <p class="dh-panel__subtitle">
                        {{ readiness.score }}% ready
                        <span v-if="settings.modelTarget">
                            for {{ readiness.taskMode }} with target <strong>{{ settings.modelTarget }}</strong>
                        </span>
                        <span v-else>
                            once a target column is selected
                        </span>
                    </p>
                </div>
            </header>
            <div v-if="readiness.blockers.length || readiness.warnings.length" class="dh-warning-stack">
                <div
                    v-for="issue in readiness.blockers.concat(readiness.warnings).slice(0, 5)"
                    :key="`${issue.code}-${issue.column || issue.message}`"
                    class="dh-warning"
                >
                    <span class="dh-warning__icon"><i class="fas fa-triangle-exclamation"></i></span>
                    <span class="dh-warning__text">{{ issue.message }}</span>
                </div>
            </div>
            <div v-else class="dh-ok-banner">
                <span class="dh-ok-banner__pulse"></span>
                <i class="fas fa-circle-check"></i>
                <span>This dataset is ready for a first training run.</span>
            </div>
        </section>

        <!-- ░░ KPI TILES ░░ -->
        <section class="dh-kpi-grid">
            <article v-for="(k, idx) in kpiTiles" :key="k.id"
                class="dh-kpi"
                :class="[`dh-kpi--${k.tone}`, { 'dh-kpi--enter': true }]"
                :style="{ animationDelay: (idx * 60) + 'ms' }"
                tabindex="0">
                <div class="dh-kpi__icon"><i :class="k.icon"></i></div>
                <div class="dh-kpi__body">
                    <p class="dh-kpi__label">{{ k.label }}</p>
                    <p class="dh-kpi__value">
                        {{ k.value }}<span v-if="k.unit" class="dh-kpi__unit">{{ k.unit }}</span>
                    </p>
                    <p class="dh-kpi__hint">{{ k.hint }}</p>
                </div>
                <div class="dh-kpi__bar">
                    <span class="dh-kpi__bar-fill" :style="{ width: k.barPct + '%' }"></span>
                </div>
            </article>
        </section>

        <!-- ░░ WARNINGS ░░ -->
        <transition name="dh-fade">
            <div v-if="warnings.length" class="dh-warning-stack">
                <div v-for="(w, i) in warnings" :key="i" class="dh-warning">
                    <span class="dh-warning__icon"><i class="fas fa-triangle-exclamation"></i></span>
                    <span class="dh-warning__text">{{ w }}</span>
                </div>
            </div>
            <div v-else class="dh-ok-banner">
                <span class="dh-ok-banner__pulse"></span>
                <i class="fas fa-circle-check"></i>
                <span>All clear &mdash; no critical data quality warnings detected.</span>
            </div>
        </transition>

        <!-- ░░ OUTLIER DETECTION PANEL ░░ -->
        <section v-if="widgetVisible.outliers" class="dh-panel dh-outlier-panel">
            <header class="dh-panel__head">
                <div>
                    <h3 class="dh-panel__title">
                        <i class="fas fa-radar" aria-hidden="true"></i>
                        Anomaly &amp; outlier detection
                    </h3>
                    <p class="dh-panel__subtitle">
                        Method: <strong>{{ activeMethodLabel }}</strong> &middot;
                        <strong>{{ outlierTotals.totalOutliers }}</strong> point(s) flagged across
                        <strong>{{ outlierTotals.affectedColumns }}</strong> column(s)
                        ({{ outlierTotals.outlierPct }}% of numeric cells)
                    </p>
                </div>
                <div class="dh-outlier-summary">
                    <div class="dh-outlier-summary__pill dh-outlier-summary__pill--high">
                        <span class="dh-outlier-summary__count">{{ severityCounts.high }}</span>
                        <span>High</span>
                    </div>
                    <div class="dh-outlier-summary__pill dh-outlier-summary__pill--med">
                        <span class="dh-outlier-summary__count">{{ severityCounts.medium }}</span>
                        <span>Medium</span>
                    </div>
                    <div class="dh-outlier-summary__pill dh-outlier-summary__pill--low">
                        <span class="dh-outlier-summary__count">{{ severityCounts.low }}</span>
                        <span>Low</span>
                    </div>
                </div>
            </header>

            <div v-if="outlierResults.length === 0" class="dh-empty">
                <i class="fas fa-feather-pointed"></i>
                No outliers detected with the current method &amp; threshold. Your numeric features look clean.
            </div>

            <div v-else class="dh-outlier-grid">
                <article v-for="r in outlierResults" :key="r.column"
                    class="dh-outlier-card"
                    :class="`dh-outlier-card--${r.severity}`"
                    @click="toggleExpanded(r.column)">
                    <header class="dh-outlier-card__head">
                        <div>
                            <span class="dh-outlier-card__col" :title="r.column">{{ r.column }}</span>
                            <span class="dh-sev-badge" :class="`dh-sev-badge--${r.severity}`">
                                {{ r.severity }}
                            </span>
                        </div>
                        <div class="dh-outlier-card__count">
                            <strong>{{ r.count }}</strong>
                            <span>{{ r.pct }}%</span>
                        </div>
                    </header>

                    <div class="dh-outlier-card__bar">
                        <div class="dh-outlier-card__bar-track">
                            <div class="dh-outlier-card__bar-fill"
                                :style="{ width: Math.min(100, r.pct * 4) + '%' }"></div>
                        </div>
                    </div>

                    <dl class="dh-outlier-card__stats">
                        <div><dt>Lower</dt><dd>{{ formatNumber(r.lowerBound) }}</dd></div>
                        <div><dt>Upper</dt><dd>{{ formatNumber(r.upperBound) }}</dd></div>
                        <div><dt>Min flagged</dt><dd>{{ formatNumber(r.minOutlier) }}</dd></div>
                        <div><dt>Max flagged</dt><dd>{{ formatNumber(r.maxOutlier) }}</dd></div>
                    </dl>

                    <p class="dh-outlier-card__explain">
                        <i class="fas fa-circle-info"></i> {{ r.explanation }}
                    </p>

                    <div class="dh-outlier-card__action">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        <span>{{ r.suggestion }}</span>
                    </div>

                    <transition name="dh-fade">
                        <div v-if="expanded[r.column]" class="dh-outlier-card__detail">
                            <p class="dh-detail-title">First flagged values</p>
                            <div class="dh-chip-row">
                                <span v-for="(v, vi) in r.sample" :key="vi" class="dh-value-chip">
                                    {{ formatNumber(v) }}
                                </span>
                            </div>
                            <p class="dh-detail-meta">
                                Mean {{ formatNumber(r.mean) }} &middot;
                                Median {{ formatNumber(r.median) }} &middot;
                                Std {{ formatNumber(r.std) }}
                            </p>
                        </div>
                    </transition>

                    <button type="button" class="dh-outlier-card__expand">
                        <i class="fas" :class="expanded[r.column] ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                        {{ expanded[r.column] ? 'Hide details' : 'Show details' }}
                    </button>
                </article>
            </div>
        </section>

        <!-- ░░ CHART PANELS ░░ -->
        <section class="dh-charts">
            <article v-show="widgetVisible.missing" class="dh-chart-card dh-chart-card--wide">
                <header class="dh-chart-card__head">
                    <div>
                        <h4>Missing value heatmap</h4>
                        <p>Distribution of missing cells by row chunk &amp; column.</p>
                    </div>
                    <span class="dh-chart-tag">{{ healthSummary.missingPercent }}% overall</span>
                </header>
                <div id="dh_missing_heatmap" class="dh-plot"></div>
            </article>

            <article v-show="widgetVisible.skew" class="dh-chart-card">
                <header class="dh-chart-card__head">
                    <div>
                        <h4>Feature skewness</h4>
                        <p>Numeric features &mdash; bars beyond &plusmn;1 indicate heavy tails.</p>
                    </div>
                </header>
                <div id="dh_skewness_chart" class="dh-plot"></div>
            </article>

            <article v-show="widgetVisible.target" class="dh-chart-card">
                <header class="dh-chart-card__head">
                    <div>
                        <h4>Target distribution</h4>
                        <p v-if="settings.modelTarget">Column: <strong>{{ settings.modelTarget }}</strong></p>
                        <p v-else>No target column selected yet.</p>
                    </div>
                </header>
                <div id="dh_target_distribution" class="dh-plot"></div>
            </article>

            <article v-show="widgetVisible.outliers && outlierResults.length" class="dh-chart-card dh-chart-card--wide">
                <header class="dh-chart-card__head">
                    <div>
                        <h4>Numeric distributions with outlier overlay</h4>
                        <p>Box plot per numeric column. Red diamonds mark detected outliers.</p>
                    </div>
                </header>
                <div id="dh_box_outliers" class="dh-plot dh-plot--tall"></div>
            </article>
        </section>
    </div>
</template>

<script>
import { settingStore } from '@/stores/settings'
import { getPlotly } from '@/utils/danfo_loader';
import { sampleSkewness } from 'simple-statistics';
import { analyzeReadiness } from '@/services/data-readiness/readiness-service';
import { detectOutliers } from '@/helpers/outliers';
import { getGraphPalette, mergePlotlyLayout } from '@/helpers/chart-theme';

const RING_RADIUS = 52;

export default {
    name: 'DatasetHealthComponent',
    setup() {
        const settings = settingStore();
        return { settings };
    },
    data() {
        return {
            renderKey: 0,
            warnings: [],
            healthSummary: {
                rows: 0,
                columns: 0,
                missingPercent: '0.00',
            },
            qualityExtras: {
                duplicatePercent: '0.0',
                duplicateNote: '%',
                skewLabel: 'Low',
                outlierTone: 'ok',
                dataTypesLabel: 'Valid',
                typesTone: 'ok',
                classBalanceLabel: '—',
                balanceTone: 'neutral',
                cardinalityLabel: 'Normal',
                cardTone: 'ok',
            },
            skewnessData: {},
            numericColumns: [],
            outlierMethod: 'iqr',
            outlierMethods: [
                { id: 'iqr', label: 'IQR (Tukey)', icon: 'fas fa-chart-simple' },
                { id: 'zscore', label: 'Z-score', icon: 'fas fa-bolt' },
                { id: 'mad', label: 'Modified Z (MAD)', icon: 'fas fa-shield-halved' },
                { id: 'isolation', label: 'Isolation Forest', icon: 'fas fa-tree' },
            ],
            zThreshold: 3.0,
            outlierResults: [],
            expanded: {},
            widgetToggles: [
                { id: 'outliers', label: 'Outliers', icon: 'fas fa-radar', title: 'Toggle outlier panel' },
                { id: 'missing', label: 'Missing', icon: 'fas fa-table-cells', title: 'Toggle missing heatmap' },
                { id: 'skew', label: 'Skewness', icon: 'fas fa-wave-square', title: 'Toggle skewness chart' },
                { id: 'target', label: 'Target', icon: 'fas fa-bullseye', title: 'Toggle target chart' },
            ],
            widgetVisible: {
                outliers: true,
                missing: true,
                skew: true,
                target: true,
            },
            healthScore: 0,
            readiness: null,
            animatedScore: 0,
            lastUpdated: Date.now(),
            tickerHandle: null,
            nowTick: Date.now(),
        };
    },
    computed: {
        ringCircumference() {
            return 2 * Math.PI * RING_RADIUS;
        },
        ringOffset() {
            const c = this.ringCircumference;
            return c - (this.animatedScore / 100) * c;
        },
        healthGrade() {
            const s = this.healthScore;
            if (s >= 85) return { tone: 'ok', label: 'Excellent' };
            if (s >= 70) return { tone: 'good', label: 'Good' };
            if (s >= 50) return { tone: 'warn', label: 'Fair' };
            return { tone: 'bad', label: 'Needs work' };
        },
        lastUpdatedLabel() {
            const diff = Math.max(0, Math.floor((this.nowTick - this.lastUpdated) / 1000));
            if (diff < 5) return 'just now';
            if (diff < 60) return `${diff}s ago`;
            const m = Math.floor(diff / 60);
            return `${m}m ago`;
        },
        activeMethodLabel() {
            const m = this.outlierMethods.find((x) => x.id === this.outlierMethod);
            return m ? m.label : this.outlierMethod;
        },
        outlierTotals() {
            const totalOutliers = this.outlierResults.reduce((s, r) => s + r.count, 0);
            const affectedColumns = this.outlierResults.length;
            const numericCells = (this.numericColumns.length || 1) * (this.healthSummary.rows || 1);
            const outlierPct = ((totalOutliers / numericCells) * 100).toFixed(2);
            return { totalOutliers, affectedColumns, outlierPct };
        },
        severityCounts() {
            return this.outlierResults.reduce(
                (acc, r) => {
                    acc[r.severity] = (acc[r.severity] || 0) + 1;
                    return acc;
                },
                { high: 0, medium: 0, low: 0 }
            );
        },
        kpiTiles() {
            const rows = this.healthSummary.rows || 0;
            const cols = this.healthSummary.columns || 0;
            const missing = parseFloat(this.healthSummary.missingPercent) || 0;
            const dup = parseFloat(this.qualityExtras.duplicatePercent) || 0;
            const outlierPct = parseFloat(this.outlierTotals.outlierPct) || 0;

            return [
                {
                    id: 'rows', label: 'Rows', value: rows.toLocaleString(),
                    icon: 'fas fa-table-list', tone: 'neutral',
                    hint: `${cols} columns total`,
                    barPct: Math.min(100, Math.log10(rows + 1) * 20),
                },
                {
                    id: 'cols', label: 'Columns', value: cols,
                    icon: 'fas fa-columns', tone: 'neutral',
                    hint: `${this.numericColumns.length} numeric`,
                    barPct: Math.min(100, cols * 5),
                },
                {
                    id: 'missing', label: 'Missing values',
                    value: this.healthSummary.missingPercent, unit: '%',
                    icon: 'fas fa-droplet-slash',
                    tone: missing > 5 ? 'bad' : missing > 0.5 ? 'warn' : 'ok',
                    hint: missing === 0 ? 'No missing cells' : 'Consider imputation',
                    barPct: Math.min(100, missing * 5),
                },
                {
                    id: 'dup', label: 'Duplicate rows',
                    value: this.qualityExtras.duplicatePercent, unit: this.qualityExtras.duplicateNote,
                    icon: 'fas fa-clone',
                    tone: dup > 5 ? 'bad' : dup > 0.5 ? 'warn' : 'ok',
                    hint: dup === 0 ? 'All rows unique' : 'Drop or review',
                    barPct: Math.min(100, dup * 5),
                },
                {
                    id: 'outliers', label: 'Outlier cells',
                    value: this.outlierTotals.totalOutliers, unit: ` (${outlierPct}%)`,
                    icon: 'fas fa-radar',
                    tone: outlierPct > 5 ? 'bad' : outlierPct > 1 ? 'warn' : 'ok',
                    hint: this.outlierTotals.affectedColumns + ' column(s) affected',
                    barPct: Math.min(100, outlierPct * 8),
                },
                {
                    id: 'skew', label: 'Skew / tails',
                    value: this.qualityExtras.skewLabel,
                    icon: 'fas fa-chart-line',
                    tone: this.qualityExtras.outlierTone,
                    hint: 'Heavy tails inflate variance',
                    barPct: this.qualityExtras.skewLabel === 'Elevated' ? 80 : this.qualityExtras.skewLabel === 'Some' ? 45 : 15,
                },
                {
                    id: 'types', label: 'Data types',
                    value: this.qualityExtras.dataTypesLabel,
                    icon: 'fas fa-shapes',
                    tone: this.qualityExtras.typesTone,
                    hint: 'dtype consistency',
                    barPct: this.qualityExtras.typesTone === 'ok' ? 100 : 40,
                },
                {
                    id: 'balance', label: 'Class balance',
                    value: this.qualityExtras.classBalanceLabel,
                    icon: 'fas fa-scale-balanced',
                    tone: this.qualityExtras.balanceTone,
                    hint: this.settings.modelTarget ? `Target: ${this.settings.modelTarget}` : 'Pick target column',
                    barPct: 60,
                },
                {
                    id: 'card', label: 'Cardinality',
                    value: this.qualityExtras.cardinalityLabel,
                    icon: 'fas fa-layer-group',
                    tone: this.qualityExtras.cardTone,
                    hint: 'Categorical breadth',
                    barPct: this.qualityExtras.cardinalityLabel === 'High' ? 85 : 40,
                },
            ];
        },
    },
    watch: {
        'settings.datasetShape.count': {
            handler(newVal) {
                if (newVal > 0) this.analyzeDataset();
            },
        },
        'settings.modelTarget': {
            handler() {
                this.analyzeDataset();
            },
        },
        'settings.isDark': {
            handler() {
                if (this.settings.df && this.settings.df.columns) {
                    this.$nextTick(() => this.plotHealthMetrics());
                }
            },
        },
        healthScore(newVal) {
            this.animateScore(newVal);
        },
    },
    mounted() {
        if (this.settings.df && this.settings.df.columns) {
            this.analyzeDataset();
        }
        this.tickerHandle = setInterval(() => {
            this.nowTick = Date.now();
        }, 5000);
    },
    beforeUnmount() {
        if (this.tickerHandle) clearInterval(this.tickerHandle);
    },
    methods: {
        formatNumber(v) {
            if (v === null || v === undefined || Number.isNaN(v)) return '—';
            const abs = Math.abs(v);
            if (abs !== 0 && (abs < 0.01 || abs >= 1e5)) return v.toExponential(2);
            return Number(v).toFixed(abs >= 100 ? 1 : 3);
        },
        toggleWidget(id) {
            this.widgetVisible[id] = !this.widgetVisible[id];
            this.$nextTick(() => this.plotHealthMetrics());
        },
        toggleExpanded(col) {
            this.expanded = { ...this.expanded, [col]: !this.expanded[col] };
        },
        setOutlierMethod(id) {
            this.outlierMethod = id;
            this.recomputeOutliers();
        },
        animateScore(target) {
            const start = this.animatedScore;
            const delta = target - start;
            const steps = 28;
            let i = 0;
            const tick = () => {
                i++;
                const eased = 1 - Math.pow(1 - i / steps, 3);
                this.animatedScore = Math.round(start + delta * eased);
                if (i < steps) requestAnimationFrame(tick);
                else this.animatedScore = Math.round(target);
            };
            requestAnimationFrame(tick);
        },
        async analyzeDataset() {
            if (!this.settings.df || !this.settings.df.columns) return;
            this.readiness = analyzeReadiness(this.settings.rawData?.length ? this.settings.rawData : this.settings.df, {
                target: this.settings.modelTarget,
                taskMode: this.settings.getTaskMode,
            });
            this.warnings = this.readiness.blockers
                .concat(this.readiness.warnings)
                .map((issue) => issue.message);
            this.renderKey++;
            this.lastUpdated = Date.now();
            this.nowTick = Date.now();

            this.$nextTick(async () => {
                await this.plotHealthMetrics();
            });
        },
        computeHealthScore() {
            const missing = parseFloat(this.healthSummary.missingPercent) || 0;
            const dup = parseFloat(this.qualityExtras.duplicatePercent) || 0;
            const outlierPct = parseFloat(this.outlierTotals.outlierPct) || 0;

            let score = 100;
            score -= Math.min(35, missing * 4);
            score -= Math.min(20, dup * 3);
            score -= Math.min(20, outlierPct * 4);
            if (this.qualityExtras.skewLabel === 'Elevated') score -= 10;
            else if (this.qualityExtras.skewLabel === 'Some') score -= 4;
            if (this.qualityExtras.typesTone !== 'ok') score -= 10;
            if (this.qualityExtras.balanceTone === 'warn') score -= 8;
            if (this.qualityExtras.cardTone === 'warn') score -= 5;

            this.healthScore = Math.max(0, Math.round(Math.min(score, this.readiness?.score ?? score)));
        },
        /* ─── Outlier detection ─── */
        detectOutliers(values, method, threshold) {
            return detectOutliers(values, method, threshold);
        },
        explanationFor(method, info) {
            const pct = info.pct;
            if (method === 'iqr') {
                return `IQR rule: values outside [Q1 − 1.5·IQR, Q3 + 1.5·IQR] = [${this.formatNumber(info.lowerBound)}, ${this.formatNumber(info.upperBound)}] are flagged. ${pct}% of points fall outside this band.`;
            }
            if (method === 'zscore') {
                return `Z-score rule: values where |(x − μ)/σ| > ${this.zThreshold.toFixed(1)} are flagged. Mean ${this.formatNumber(info.mean)}, std ${this.formatNumber(info.std)}.`;
            }
            if (method === 'isolation') {
                return `Isolation Forest: values isolated quickly across random split trees are flagged when anomaly score ≥ ${this.formatNumber(info.scoreThreshold)}. Highest score ${this.formatNumber(info.maxIsolationScore)}.`;
            }
            return `Modified Z (MAD) rule: robust to extreme values. Flags points where |0.6745·(x − median)/MAD| > 3.5. Median ${this.formatNumber(info.median)}.`;
        },
        suggestionFor(severity, pct) {
            if (severity === 'high') {
                return pct > 10
                    ? 'Investigate the data source — this many anomalies often signal a measurement or import error.'
                    : 'Consider winsorizing or capping extreme values before training tree-free models.';
            }
            if (severity === 'medium') {
                return 'Review flagged rows; if legitimate, prefer robust models (tree-based) or apply log/Yeo-Johnson transform.';
            }
            return 'Low impact — safe to keep, but worth a quick visual check in the box plot below.';
        },
        severityFor(pct) {
            if (pct >= 5) return 'high';
            if (pct >= 1) return 'medium';
            return 'low';
        },
        recomputeOutliers() {
            if (!this.settings.df || !this.numericColumns.length) {
                this.outlierResults = [];
                return;
            }
            const df = this.settings.df;
            const results = [];
            for (const col of this.numericColumns) {
                const series = df[col];
                const vals = series.dropNa().values;
                const info = this.detectOutliers(vals, this.outlierMethod, this.zThreshold);
                if (!info || info.count === 0) continue;
                const severity = this.severityFor(info.pct);
                results.push({
                    column: col,
                    severity,
                    explanation: this.explanationFor(this.outlierMethod, info),
                    suggestion: this.suggestionFor(severity, info.pct),
                    ...info,
                });
            }
            results.sort((a, b) => b.pct - a.pct);
            this.outlierResults = results;
            this.computeHealthScore();
            this.$nextTick(() => this.plotBoxOutliers());
        },
        async plotHealthMetrics() {
            const df = this.settings.df;
            const columns = df.columns;
            const numRows = df.shape[0];
            const numCols = columns.length;

            this.skewnessData = {};
            this.numericColumns = [];
            let totalMissing = 0;

            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const series = df[col];

                let missingCount = series.isNa().sum();
                totalMissing += missingCount;
                let uniqueValuesCount = series.unique().values.length;

                if (uniqueValuesCount === 1) {
                    this.warnings.push(`Constant Feature: '${col}' has exactly 1 unique value.`);
                }

                if (series.dtype === 'string') {
                    if (uniqueValuesCount > series.shape[0] * 0.9 && series.shape[0] > 50) {
                        this.warnings.push(`High Cardinality: Categorical '${col}' is almost unique (like an ID column).`);
                    }
                } else if (series.dtype === 'int32' || series.dtype === 'float32') {
                    this.numericColumns.push(col);
                    let nonNaValues = series.dropNa().values;
                    let sk = 0;
                    if (nonNaValues.length > 2) {
                        try {
                            sk = sampleSkewness(nonNaValues);
                        } catch (e) { /* ignore */ }
                    }
                    this.skewnessData[col] = sk;
                }
            }

            const totalCells = Math.max(1, numRows * numCols);
            this.healthSummary = {
                rows: numRows,
                columns: numCols,
                missingPercent: ((totalMissing / totalCells) * 100).toFixed(2),
            };

            /* Duplicate-row estimate */
            let dupPctStr = '0.0';
            let dupNote = '%';
            const cap = Math.min(numRows, 5000);
            try {
                if (cap > 0) {
                    const vals = df.values;
                    const seen = new Set();
                    let dupCount = 0;
                    for (let i = 0; i < cap; i++) {
                        let key = '';
                        for (let j = 0; j < numCols; j++) {
                            const v = vals[i][j];
                            key += (j ? '\x1f' : '') + (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? '' : String(v));
                        }
                        if (seen.has(key)) dupCount++;
                        else seen.add(key);
                    }
                    dupPctStr = ((dupCount / cap) * 100).toFixed(1);
                    if (numRows > cap) dupNote = '% *';
                }
            } catch (e) {
                dupPctStr = '—';
                dupNote = '';
            }

            const skewVals = Object.values(this.skewnessData);
            let skewLabel = 'Low';
            let outlierTone = 'ok';
            if (skewVals.length) {
                const high = skewVals.filter((v) => Math.abs(v) > 1).length;
                const ratio = high / skewVals.length;
                if (ratio > 0.35) {
                    skewLabel = 'Elevated';
                    outlierTone = 'warn';
                } else if (high > 0) {
                    skewLabel = 'Some';
                    outlierTone = 'warn-light';
                }
            }

            const constWarnings = this.warnings.filter((w) => w.includes('Constant'));
            const dataTypesLabel = constWarnings.length ? 'Review' : 'Valid';
            const typesTone = constWarnings.length ? 'warn' : 'ok';

            const hasHighCard = this.warnings.some((w) => w.includes('High Cardinality'));
            const cardinalityLabel = hasHighCard ? 'High' : 'Normal';
            const cardTone = hasHighCard ? 'warn' : 'ok';

            let classBalanceLabel = '—';
            let balanceTone = 'neutral';
            try {
                if (this.settings.modelTarget) {
                    const targetSeries = df[this.settings.modelTarget];
                    if (targetSeries) {
                        const u = targetSeries.unique().values.length;
                        if (targetSeries.dtype === 'string' || u <= 12) {
                            const counts = targetSeries.valueCounts();
                            const cvals = counts.values;
                            const tot = cvals.reduce((a, b) => a + b, 0);
                            const minP = Math.round((Math.min(...cvals) / tot) * 100);
                            const maxP = Math.round((Math.max(...cvals) / tot) * 100);
                            classBalanceLabel = `${minP}/${maxP}`;
                            balanceTone = (minP < 10 && u > 1) ? 'warn' : 'ok';
                        }
                    }
                }
            } catch (e) { /* keep defaults */ }

            this.qualityExtras = {
                duplicatePercent: dupPctStr,
                duplicateNote: dupNote,
                skewLabel,
                outlierTone,
                dataTypesLabel,
                typesTone,
                classBalanceLabel,
                balanceTone,
                cardinalityLabel,
                cardTone,
            };

            this.recomputeOutliers();

            const Plotly = await getPlotly();
            const palette = getGraphPalette(false);
            const baseLayout = {
                ...mergePlotlyLayout({}, false),
                hoverlabel: { bgcolor: palette.tooltipBg, font: { color: palette.tooltipText, size: 11 } },
            };

            /* Missing heatmap */
            if (this.widgetVisible.missing) {
                try {
                    const naVals = df.isNa().values;
                    const numChunks = Math.min(20, numRows);
                    const chunkSize = Math.ceil(numRows / numChunks);
                    let zHeatmap = [];
                    let yLabels = [];

                    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
                        let chunkMissingPct = new Array(numCols).fill(0);
                        let start = chunkIdx * chunkSize;
                        let end = Math.min(start + chunkSize, numRows);
                        let actualSize = end - start;
                        if (actualSize <= 0) break;
                        yLabels.push(`Rows ${start}-${end}`);
                        for (let r = start; r < end; r++) {
                            for (let c = 0; c < numCols; c++) {
                                if (naVals[r][c]) chunkMissingPct[c] += 1;
                            }
                        }
                        for (let c = 0; c < numCols; c++) {
                            chunkMissingPct[c] = (chunkMissingPct[c] / actualSize) * 100;
                        }
                        zHeatmap.push(chunkMissingPct);
                    }

                    const trace = {
                        z: zHeatmap, x: columns, y: yLabels,
                        type: 'heatmap',
                        colorscale: [[0, '#ecfdf5'], [0.2, '#fef3c7'], [0.5, '#fb923c'], [1, '#dc2626']],
                        zmin: 0, zmax: 100,
                        colorbar: { title: '% Missing', thickness: 10 },
                        hovertemplate: '<b>%{x}</b><br>%{y}<br>%{z:.1f}% missing<extra></extra>',
                    };
                    Plotly.newPlot('dh_missing_heatmap', [trace], {
                        ...baseLayout,
                        margin: { t: 10, b: 40, l: 80, r: 10 },
                    }, { displayModeBar: false, responsive: true });
                } catch (err) { console.error('heatmap', err); }
            }

            /* Skewness */
            if (this.widgetVisible.skew) {
                try {
                    const sCols = Object.keys(this.skewnessData);
                    const sVals = Object.values(this.skewnessData);
                    const trace = {
                        x: sCols, y: sVals, type: 'bar',
                        marker: {
                            color: sVals.map((v) => Math.abs(v) > 1 ? '#ef4444' : Math.abs(v) > 0.5 ? '#f59e0b' : '#10b981'),
                            line: { color: 'rgba(15,23,42,0.15)', width: 1 },
                        },
                        hovertemplate: '<b>%{x}</b><br>Skewness: %{y:.3f}<extra></extra>',
                    };
                    Plotly.newPlot('dh_skewness_chart', [trace], {
                        ...baseLayout,
                        margin: { t: 10, b: 50, l: 40, r: 10 },
                        shapes: [{
                            type: 'line', xref: 'paper', x0: 0, x1: 1,
                            y0: 0, y1: 0,
                            line: { color: palette.grid, width: 1, dash: 'dot' },
                        }],
                    }, { displayModeBar: false, responsive: true });
                } catch (err) { console.error('skew', err); }
            }

            /* Target */
            if (this.widgetVisible.target) {
                try {
                    if (this.settings.modelTarget) {
                        const targetSeries = df[this.settings.modelTarget];
                        if (targetSeries) {
                            const uniqueTargetCount = targetSeries.unique().values.length;
                            let trace;
                            if (targetSeries.dtype === 'string' || uniqueTargetCount <= 20) {
                                let counts = targetSeries.valueCounts();
                                trace = {
                                    x: counts.index, y: counts.values, type: 'bar',
                                    marker: {
                                        color: counts.values.map((_, i) => `hsl(${(i * 47) % 360}, 70%, 55%)`),
                                    },
                                    hovertemplate: '<b>%{x}</b><br>Count: %{y}<extra></extra>',
                                };
                            } else {
                                trace = {
                                    x: targetSeries.dropNa().values, type: 'histogram',
                                    marker: { color: '#6366f1' },
                                    hovertemplate: 'Bin: %{x}<br>Count: %{y}<extra></extra>',
                                };
                            }
                            Plotly.newPlot('dh_target_distribution', [trace], {
                                ...baseLayout,
                                margin: { t: 10, b: 50, l: 40, r: 10 },
                                bargap: 0.2,
                            }, { displayModeBar: false, responsive: true });
                        }
                    } else {
                        const el = document.getElementById('dh_target_distribution');
                        if (el) Plotly.purge(el);
                    }
                } catch (err) { console.error('target', err); }
            }

            this.computeHealthScore();
        },
        async plotBoxOutliers() {
            if (!this.widgetVisible.outliers || !this.outlierResults.length) return;
            const Plotly = await getPlotly();
            const df = this.settings.df;
            const traces = [];
            const flaggedCols = this.outlierResults.map((r) => r.column);
            const cols = flaggedCols.length ? flaggedCols : this.numericColumns.slice(0, 8);

            for (const col of cols) {
                const series = df[col];
                if (!series) continue;
                const vals = series.dropNa().values;
                const info = this.detectOutliers(vals, this.outlierMethod, this.zThreshold);
                if (!info) continue;
                traces.push({
                    y: vals, name: col, type: 'box',
                    boxpoints: 'outliers',
                    marker: { color: '#ef4444', size: 5, symbol: 'diamond' },
                    line: { color: '#1e293b' },
                    fillcolor: 'rgba(99,102,241,0.18)',
                    hovertemplate: `<b>${col}</b><br>%{y:.4f}<extra></extra>`,
                });
            }

            try {
                const palette = getGraphPalette(false);
                Plotly.newPlot('dh_box_outliers', traces, {
                    ...mergePlotlyLayout({}, false),
                    margin: { t: 10, b: 60, l: 50, r: 10 },
                    showlegend: false,
                    hoverlabel: { bgcolor: palette.tooltipBg, font: { color: palette.tooltipText, size: 11 } },
                }, { displayModeBar: false, responsive: true });
            } catch (err) { console.error('box', err); }
        },
    },
}
</script>

<style scoped>
/* ───────────────────────────────────────────── ROOT ── */
.dh-root {
    --dh-ok: #10b981;
    --dh-good: #22c55e;
    --dh-warn: #f59e0b;
    --dh-bad: #ef4444;
    --dh-ink: #0f172a;
    --dh-muted: #64748b;
    --dh-border: #e2e8f0;
    --dh-surface: #ffffff;
    --dh-surface-tint: #f8fafc;
    --dh-radius: 16px;

    color: var(--dh-ink);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ───────────────────────────────────────────── HERO ── */
.dh-hero {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #eef2ff 100%);
    border: 1px solid var(--dh-border);
    border-radius: 20px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.18);
}

.dh-hero__bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
}

.dh-hero__orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    opacity: 0.55;
    animation: dh-float 14s ease-in-out infinite;
}

.dh-hero__orb--a {
    width: 280px; height: 280px;
    background: radial-gradient(circle, #818cf8, transparent 70%);
    top: -60px; left: -40px;
}

.dh-hero__orb--b {
    width: 220px; height: 220px;
    background: radial-gradient(circle, #34d399, transparent 70%);
    bottom: -80px; right: 10%;
    animation-delay: -4s;
}

.dh-hero__orb--c {
    width: 180px; height: 180px;
    background: radial-gradient(circle, #f472b6, transparent 70%);
    top: 30%; right: -30px;
    animation-delay: -8s;
}

@keyframes dh-float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(20px, -20px) scale(1.08); }
}

.dh-hero__content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.dh-hero__title-block {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.dh-hero__icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 1.4rem;
    box-shadow: 0 8px 24px -6px rgba(99, 102, 241, 0.4);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
.dh-hero__icon--ok { background: linear-gradient(135deg, #10b981, #06b6d4); box-shadow: 0 8px 24px -6px rgba(16, 185, 129, 0.45); }
.dh-hero__icon--good { background: linear-gradient(135deg, #22c55e, #10b981); }
.dh-hero__icon--warn { background: linear-gradient(135deg, #f59e0b, #ef4444); box-shadow: 0 8px 24px -6px rgba(245, 158, 11, 0.45); }
.dh-hero__icon--bad { background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 8px 24px -6px rgba(239, 68, 68, 0.5); }

.dh-hero__title {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    color: var(--dh-ink);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    letter-spacing: -0.01em;
}

.dh-live-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--dh-good);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    animation: dh-pulse 2s infinite;
}

@keyframes dh-pulse {
    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

.dh-hero__subtitle {
    margin: 0.25rem 0 0;
    color: var(--dh-muted);
    font-size: 0.85rem;
}

/* Score ring */
.dh-score {
    position: relative;
    width: 110px;
    height: 110px;
    flex-shrink: 0;
}

.dh-score__ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.dh-score__ring-bg, .dh-score__ring-fg {
    fill: none;
    stroke-width: 10;
    stroke-linecap: round;
}
.dh-score__ring-bg { stroke: rgba(148, 163, 184, 0.25); }
.dh-score__ring-fg {
    stroke: var(--dh-good);
    transition: stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.4s ease;
}
.dh-score--ok .dh-score__ring-fg { stroke: url(#dh-grad-ok); stroke: #10b981; }
.dh-score--good .dh-score__ring-fg { stroke: #22c55e; }
.dh-score--warn .dh-score__ring-fg { stroke: #f59e0b; }
.dh-score--bad .dh-score__ring-fg { stroke: #ef4444; }

.dh-score__center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
}
.dh-score__value {
    display: block;
    font-size: 1.65rem;
    font-weight: 800;
    color: var(--dh-ink);
    line-height: 1;
}
.dh-score__label {
    display: block;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--dh-muted);
    margin-top: 0.15rem;
    font-weight: 700;
}

/* Toolbar */
.dh-toolbar {
    position: relative;
    z-index: 1;
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px dashed rgba(148, 163, 184, 0.4);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.85rem 1.5rem;
}

.dh-toolbar__group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.dh-toolbar__group--right { margin-left: auto; }

.dh-toolbar__caption {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--dh-muted);
    font-weight: 700;
}

.dh-segmented {
    display: inline-flex;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--dh-border);
    border-radius: 10px;
    padding: 3px;
    backdrop-filter: blur(6px);
}

.dh-segmented__btn {
    border: none;
    background: transparent;
    padding: 0.32rem 0.7rem;
    font-size: 0.78rem;
    color: var(--dh-muted);
    border-radius: 7px;
    cursor: pointer;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
.dh-segmented__btn:hover { color: var(--dh-ink); }
.dh-segmented__btn.is-active {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    box-shadow: 0 4px 10px -4px rgba(99, 102, 241, 0.45);
}

.dh-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 130px;
    height: 4px;
    background: linear-gradient(90deg, #6366f1, #ec4899);
    border-radius: 999px;
    outline: none;
}
.dh-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid #6366f1;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.dh-chip {
    border: 1px solid var(--dh-border);
    background: rgba(255, 255, 255, 0.7);
    color: var(--dh-muted);
    padding: 0.32rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    transition: all 0.2s ease;
}
.dh-chip:hover { border-color: #94a3b8; color: var(--dh-ink); transform: translateY(-1px); }
.dh-chip.is-active {
    background: linear-gradient(135deg, #0f172a, #1e293b);
    border-color: #0f172a;
    color: #fff;
}

/* ─────────────────────────────────────────── KPI TILES ── */
.dh-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
}

.dh-kpi {
    position: relative;
    overflow: hidden;
    background: var(--dh-surface);
    border: 1px solid var(--dh-border);
    border-radius: 14px;
    padding: 0.85rem 0.95rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    cursor: default;
}
.dh-kpi:hover, .dh-kpi:focus {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px -16px rgba(15, 23, 42, 0.25);
    border-color: #94a3b8;
    outline: none;
}

.dh-kpi--enter { animation: dh-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
@keyframes dh-rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.dh-kpi__icon {
    position: absolute;
    top: 0.7rem;
    right: 0.7rem;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 0.78rem;
    background: rgba(15, 23, 42, 0.06);
    color: var(--dh-ink);
}

.dh-kpi__label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--dh-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
}

.dh-kpi__value {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--dh-ink);
    margin: 0;
    line-height: 1;
    letter-spacing: -0.02em;
}
.dh-kpi__unit {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--dh-muted);
    margin-left: 2px;
}

.dh-kpi__hint {
    font-size: 0.7rem;
    color: var(--dh-muted);
    margin: 0;
}

.dh-kpi__bar {
    height: 4px;
    background: rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 0.25rem;
}
.dh-kpi__bar-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

.dh-kpi--ok { border-left: 4px solid var(--dh-ok); }
.dh-kpi--ok .dh-kpi__bar-fill { background: linear-gradient(90deg, #10b981, #22c55e); }
.dh-kpi--good { border-left: 4px solid var(--dh-good); }
.dh-kpi--warn { border-left: 4px solid var(--dh-warn); }
.dh-kpi--warn .dh-kpi__bar-fill { background: linear-gradient(90deg, #f59e0b, #fb923c); }
.dh-kpi--warn-light { border-left: 4px solid #fbbf24; }
.dh-kpi--bad { border-left: 4px solid var(--dh-bad); }
.dh-kpi--bad .dh-kpi__bar-fill { background: linear-gradient(90deg, #ef4444, #dc2626); }
.dh-kpi--neutral { border-left: 4px solid #94a3b8; }

/* ─────────────────────────────────────────── WARNINGS ── */
.dh-warning-stack {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.dh-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem 0.85rem;
    background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);
    border: 1px solid #fecaca;
    border-left: 4px solid #ef4444;
    border-radius: 10px;
    font-size: 0.85rem;
    color: #7f1d1d;
}

.dh-warning__icon {
    color: #ef4444;
    font-size: 0.95rem;
    flex-shrink: 0;
}

.dh-ok-banner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 0.95rem;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.05));
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-left: 4px solid #10b981;
    border-radius: 10px;
    font-size: 0.85rem;
    color: #065f46;
    font-weight: 600;
}

.dh-ok-banner__pulse {
    width: 10px; height: 10px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
    animation: dh-pulse 2s infinite;
}

.dh-fade-enter-active, .dh-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.dh-fade-enter-from, .dh-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ─────────────────────────────────────────── PANELS ── */
.dh-panel {
    background: var(--dh-surface);
    border: 1px solid var(--dh-border);
    border-radius: var(--dh-radius);
    padding: 1rem 1.15rem;
    box-shadow: 0 8px 28px -16px rgba(15, 23, 42, 0.15);
}

.dh-panel__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.85rem;
}

.dh-panel__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--dh-ink);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.dh-panel__title i { color: #6366f1; }

.dh-panel__subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.78rem;
    color: var(--dh-muted);
}

/* Outlier panel specifics */
.dh-outlier-summary {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
}

.dh-outlier-summary__pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.32rem 0.65rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
}
.dh-outlier-summary__count {
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999px;
    padding: 0 0.5rem;
    font-size: 0.78rem;
}
.dh-outlier-summary__pill--high {
    background: linear-gradient(135deg, #fee2e2, #fecaca);
    color: #991b1b;
    border-color: #fecaca;
}
.dh-outlier-summary__pill--med {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
    border-color: #fde68a;
}
.dh-outlier-summary__pill--low {
    background: linear-gradient(135deg, #dcfce7, #bbf7d0);
    color: #166534;
    border-color: #bbf7d0;
}

.dh-empty {
    padding: 1.5rem;
    text-align: center;
    color: var(--dh-muted);
    font-size: 0.88rem;
    background: var(--dh-surface-tint);
    border: 1px dashed var(--dh-border);
    border-radius: 12px;
}
.dh-empty i { color: #94a3b8; margin-right: 0.4rem; }

.dh-outlier-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
}

.dh-outlier-card {
    position: relative;
    background: linear-gradient(135deg, #ffffff, #f8fafc);
    border: 1px solid var(--dh-border);
    border-radius: 14px;
    padding: 0.85rem 0.95rem 0.6rem;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.dh-outlier-card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, currentColor, transparent);
    opacity: 0.7;
}
.dh-outlier-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 30px -14px rgba(15, 23, 42, 0.25);
}
.dh-outlier-card--high { color: #ef4444; border-color: rgba(239, 68, 68, 0.35); }
.dh-outlier-card--medium { color: #f59e0b; border-color: rgba(245, 158, 11, 0.35); }
.dh-outlier-card--low { color: #10b981; border-color: rgba(16, 185, 129, 0.3); }

.dh-outlier-card__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    color: var(--dh-ink);
}

.dh-outlier-card__col {
    font-weight: 700;
    font-size: 0.92rem;
    margin-right: 0.4rem;
}

.dh-sev-badge {
    display: inline-block;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    font-weight: 800;
}
.dh-sev-badge--high { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.dh-sev-badge--medium { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.dh-sev-badge--low { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

.dh-outlier-card__count {
    text-align: right;
    color: var(--dh-ink);
    line-height: 1.1;
}
.dh-outlier-card__count strong {
    display: block;
    font-size: 1.2rem;
    font-weight: 800;
}
.dh-outlier-card__count span {
    font-size: 0.7rem;
    color: var(--dh-muted);
}

.dh-outlier-card__bar-track {
    height: 6px;
    background: rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    overflow: hidden;
}
.dh-outlier-card__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, currentColor, rgba(0, 0, 0, 0));
    border-radius: 999px;
    transition: width 0.6s ease;
}

.dh-outlier-card__stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3rem 0.6rem;
    margin: 0;
    color: var(--dh-ink);
}
.dh-outlier-card__stats > div { display: flex; justify-content: space-between; gap: 0.3rem; font-size: 0.74rem; }
.dh-outlier-card__stats dt { color: var(--dh-muted); margin: 0; }
.dh-outlier-card__stats dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }

.dh-outlier-card__explain {
    font-size: 0.74rem;
    color: var(--dh-muted);
    margin: 0;
    line-height: 1.4;
    border-top: 1px dashed rgba(148, 163, 184, 0.4);
    padding-top: 0.5rem;
}
.dh-outlier-card__explain i { color: #6366f1; margin-right: 0.25rem; }

.dh-outlier-card__action {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.18);
    color: #4338ca;
    font-size: 0.74rem;
    border-radius: 8px;
    padding: 0.45rem 0.6rem;
}
.dh-outlier-card__action i { margin-top: 1px; }

.dh-outlier-card__detail {
    background: var(--dh-surface-tint);
    border-radius: 10px;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--dh-border);
}
.dh-detail-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--dh-muted);
    margin: 0 0 0.4rem;
    font-weight: 700;
}
.dh-detail-meta {
    margin: 0.4rem 0 0;
    font-size: 0.7rem;
    color: var(--dh-muted);
}

.dh-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
}
.dh-value-chip {
    background: #fff;
    border: 1px solid var(--dh-border);
    border-radius: 6px;
    padding: 0.15rem 0.4rem;
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    color: var(--dh-ink);
}

.dh-outlier-card__expand {
    border: none;
    background: transparent;
    color: var(--dh-muted);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    align-self: flex-end;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0;
}
.dh-outlier-card__expand:hover { color: var(--dh-ink); }

/* ─────────────────────────────────────────── CHARTS ── */
.dh-charts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}
.dh-chart-card {
    background: var(--dh-surface);
    border: 1px solid var(--dh-border);
    border-radius: 14px;
    padding: 0.85rem 0.95rem;
    box-shadow: 0 6px 22px -16px rgba(15, 23, 42, 0.18);
    transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.dh-chart-card:hover {
    box-shadow: 0 16px 30px -14px rgba(15, 23, 42, 0.18);
}
.dh-chart-card--wide { grid-column: 1 / -1; }

.dh-chart-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}
.dh-chart-card__head h4 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 800;
    color: var(--dh-ink);
}
.dh-chart-card__head p {
    margin: 0.15rem 0 0;
    font-size: 0.74rem;
    color: var(--dh-muted);
}
.dh-chart-tag {
    background: rgba(99, 102, 241, 0.1);
    color: #4338ca;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
}

.dh-plot {
    height: 250px;
    width: 100%;
}
.dh-plot--tall { height: 320px; }

/* ─────────────────────────────────────────── RESPONSIVE ── */
@media (max-width: 900px) {
    .dh-charts { grid-template-columns: 1fr; }
    .dh-chart-card--wide { grid-column: auto; }
}

@media (max-width: 640px) {
    .dh-hero { padding: 1rem; }
    .dh-hero__content { flex-direction: column; align-items: flex-start; }
    .dh-score { align-self: center; }
    .dh-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dh-outlier-grid { grid-template-columns: 1fr; }
    .dh-plot { height: 220px; }
    .dh-toolbar__group--right { margin-left: 0; }
}
</style>
