<template>
    <div class="results-root">

        <template v-if="this.settings.results?.length > 0">
            <section class="results-overview">
                <div>
                    <p class="results-overview__eyebrow">Results Analysis</p>
                    <h2 class="results-overview__title">Model performance workspace</h2>
                    <p class="results-overview__subtitle">
                        Compare trained models, inspect diagnostics, and download reproducible outputs from one place.
                    </p>
                </div>
                <div class="results-overview__stats">
                    <article class="results-stat">
                        <span class="results-stat__label">Runs</span>
                        <strong>{{ resultsSummary.total }}</strong>
                    </article>
                    <article class="results-stat">
                        <span class="results-stat__label">Classification</span>
                        <strong>{{ resultsSummary.classification }}</strong>
                    </article>
                    <article class="results-stat">
                        <span class="results-stat__label">Regression</span>
                        <strong>{{ resultsSummary.regression }}</strong>
                    </article>
                </div>
            </section>
            <hpc-job-center-component></hpc-job-center-component>

        <b-tabs v-model="activeResult" @input="onResultTabChanged">
            <b-tab-item label="Comparison" @click="refreshComparison()">
                <div class="comparison-shell">
                    <div class="columns is-multiline is-vcentered">
                        <div class="column is-4">
                            <b-field label="Dataset / Task" :label-position="'on-border'">
                                <b-select :expanded="true" v-model="selectedScopeKey" size="is-small"
                                    @update:modelValue="onScopeChange">
                                    <option v-for="scope in comparisonScopes" :key="scope.key" :value="scope.key">
                                        {{ scope.label }}
                                    </option>
                                </b-select>
                            </b-field>
                        </div>
                        <div class="column is-4">
                            <b-field label="Ranking metric" :label-position="'on-border'">
                                <b-select :expanded="true" v-model="selectedMetric" size="is-small"
                                    @update:modelValue="refreshComparison">
                                    <option v-for="metric in availableMetrics" :key="metric.key" :value="metric.key">
                                        {{ metric.label }}
                                    </option>
                                </b-select>
                            </b-field>
                        </div>
                        <div class="column is-4 has-text-right">
                            <b-button class="is-small is-info mt-4" @click="downloadComparisonCsv"
                                :disabled="comparisonRows.length === 0">
                                Download comparison CSV
                            </b-button>
                        </div>
                    </div>

                    <b-message v-if="comparisonRows.length === 0" type="is-warning" has-icon icon-pack="fas">
                        Train at least one model for a dataset/task pair to compare methods.
                    </b-message>

                    <template v-else>
                        <div class="columns is-multiline comparison-kpi-grid">
                            <div class="column is-3">
                                <article class="comparison-kpi">
                                    <p class="comparison-kpi-title">Best model</p>
                                    <p class="comparison-kpi-value">{{ summary.bestModel }}</p>
                                </article>
                            </div>
                            <div class="column is-3">
                                <article class="comparison-kpi">
                                    <p class="comparison-kpi-title">{{ summary.metricLabel }}</p>
                                    <p class="comparison-kpi-value">{{ summary.bestMetricValue }}</p>
                                </article>
                            </div>
                            <div class="column is-3">
                                <article class="comparison-kpi">
                                    <p class="comparison-kpi-title">Compared models</p>
                                    <p class="comparison-kpi-value">{{ summary.modelCount }}</p>
                                </article>
                            </div>
                            <div class="column is-3">
                                <article class="comparison-kpi">
                                    <p class="comparison-kpi-title">Performance gap</p>
                                    <p class="comparison-kpi-value">{{ summary.metricSpread }}</p>
                                </article>
                            </div>
                        </div>

                        <div class="columns is-multiline">
                            <div class="column is-7">
                                <div class="message is-info">
                                    <div class="message-header p-2">Primary metric ranking</div>
                                    <div class="message-body">
                                        <div id="comparison_primary_plot" class="comparison-plot"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="column is-5">
                                <div class="message is-info">
                                    <div class="message-header p-2">Normalized metric heatmap</div>
                                    <div class="message-body">
                                        <div id="comparison_heatmap_plot" class="comparison-plot"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Outlier Detection Impact Analysis Section -->
                        <div v-if="outlierPairs.length > 0" class="message is-success mt-5">
                            <div class="message-header p-2">
                                <span class="icon-text">
                                    <span class="icon" style="margin-right: 0.5rem;"><i class="fas fa-filter"></i></span>
                                    <span>Outlier Detection Impact Analysis</span>
                                </span>
                            </div>
                            <div class="message-body">
                                <p class="is-size-7 mb-3">
                                    Compare model performance trained on the raw dataset versus the outlier-cleaned dataset. Positive values indicate improvement from outlier removal.
                                </p>
                                <div class="table-container">
                                    <table class="table is-bordered is-fullwidth is-hoverable is-striped is-narrow is-size-7">
                                        <thead>
                                            <tr>
                                                <th>Model (Method)</th>
                                                <th>Metric</th>
                                                <th class="has-text-centered">Raw Model</th>
                                                <th class="has-text-centered">Cleaned Model</th>
                                                <th class="has-text-centered">Difference</th>
                                                <th class="has-text-centered">Impact</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <template v-for="pair in outlierPairs" :key="pair.sessionId">
                                                <tr v-for="(metric, mIdx) in getPairMetrics(pair)" :key="pair.sessionId + '_' + metric.key">
                                                    <td v-if="metric.isFirst" :rowspan="getPairMetrics(pair).length" style="vertical-align: middle; font-weight: bold; border-right: 1px solid #dbdbdb;">
                                                        {{ pair.modelName }} ({{ pair.method.toUpperCase() }})
                                                    </td>
                                                    <td>{{ metric.label }}</td>
                                                    <td class="has-text-centered">{{ formatMetricValue(metric.rawVal) }}</td>
                                                    <td class="has-text-centered">{{ formatMetricValue(metric.cleanVal) }}</td>
                                                    <td class="has-text-centered" :class="metric.diffClass">
                                                        {{ metric.diffStr }}
                                                    </td>
                                                    <td class="has-text-centered">
                                                        <span class="tag is-small" :class="metric.tagClass">
                                                            {{ metric.impactStr }}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </template>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div class="message is-info">
                            <div class="message-header p-2">
                                Methods comparison details
                            </div>
                            <div class="message-body">
                                <div class="table-container">
                                    <table class="table is-bordered is-fullwidth is-hoverable is-striped is-narrow is-size-7">
                                        <thead>
                                            <tr>
                                                <th>Rank</th>
                                                <th>Model</th>
                                                <th v-for="metric in availableMetrics" :key="metric.key">
                                                    {{ metric.label }}
                                                </th>
                                                <th>Gap to best</th>
                                                <th>Composite score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="row in comparisonRows" :key="row.resultId">
                                                <td>{{ row.rank }}</td>
                                                <td>{{ row.displayName }}</td>
                                                <td v-for="metric in availableMetrics" :key="metric.key">
                                                    {{ formatMetricValue(row.metrics[metric.key]) }}
                                                </td>
                                                <td>{{ formatMetricValue(row.gapToBest) }}</td>
                                                <td>{{ formatMetricValue(row.compositeScore) }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </b-tab-item>
            <b-tab-item :label="(result.id) + '.' + result.name.toString()" v-for="result in this.settings.results"
                :key="result.id">
                <classification-view-component @delete-result="deleteResult" :result="result"
                    v-if="result.modelTask"></classification-view-component>
                <regression-view-component @delete-result="deleteResult" :result="result" v-else>
                </regression-view-component>
                <xai-storyboard-component :result="result"></xai-storyboard-component>
                <div class="column is-12">
                    <div class="table-container" v-if="!result.useHPC">
                        <table :id="'predictions_table_' + result.id"
                            class="table is-bordered is-hoverable is-narrow display is-size-7" width="100%">
                        </table>
                    </div>
                </div>
            </b-tab-item>
        </b-tabs>
        </template>
        <section class="results-empty" v-else>
            <i class="fas fa-chart-line results-empty__icon" aria-hidden="true"></i>
            <h3>No model results yet</h3>
            <p>
                Train a classification or regression model first, then return here to compare metrics,
                inspect diagnostics, and download model artifacts.
            </p>
        </section>
    </div>

</template>

<script>
import { settingStore } from '@/stores/settings'
import ClassificationViewComponent from './classification-view-component.vue'
import RegressionViewComponent from './regression-view-component.vue'
import XaiStoryboardComponent from './xai-storyboard-component.vue'
import HpcJobCenterComponent from '@/components/jobs/hpc-job-center-component.vue'
import { computed } from "vue";
import { removeTable } from '@/helpers/utils'
import { getPlotly } from '@/utils/danfo_loader'
import { mergePlotlyLayout } from '@/helpers/chart-theme'


export default {
    components: {
        'classification-view-component': ClassificationViewComponent,
        'regression-view-component': RegressionViewComponent,
        'xai-storyboard-component': XaiStoryboardComponent,
        'hpc-job-center-component': HpcJobCenterComponent,

    },
    setup() {
        const settings = settingStore()
        const activeResult = computed({
            get: () => settings.getResultTab,
            set: (value) => settings.setResultActiveTab(value), // Mutate the state properly
        });
        return { settings, activeResult }
    },

    name: 'ResultsComponent',
    props: {
    },
    data() {
        return {
            comparisonScopes: [],
            selectedScopeKey: '',
            availableMetrics: [],
            selectedMetric: '',
            comparisonRows: [],
            summary: {
                bestModel: '-',
                bestMetricValue: '-',
                modelCount: 0,
                metricSpread: '-',
                metricLabel: 'Primary metric'
            },
        }
    },
    computed: {
        resultsSummary() {
            const results = this.settings.results || [];
            return {
                total: results.length,
                classification: results.filter((result) => result.modelTask).length,
                regression: results.filter((result) => !result.modelTask).length,
            };
        },
        outlierPairs() {
            const results = this.settings.results || [];
            const groups = {};
            results.forEach((res) => {
                if (res.outlierInfo && res.outlierInfo.sessionId) {
                    const sid = res.outlierInfo.sessionId;
                    if (!groups[sid]) {
                        groups[sid] = {
                            raw: null,
                            cleaned: null,
                            method: res.outlierInfo.method,
                            modelName: res.name.replace(/ \(Raw\)| \(Cleaned - .*\)/, '')
                        };
                    }
                    if (res.outlierInfo.processed) {
                        groups[sid].cleaned = res;
                    } else {
                        groups[sid].raw = res;
                    }
                }
            });
            const pairs = [];
            for (const sid in groups) {
                const group = groups[sid];
                if (group.raw && group.cleaned) {
                    const rawScope = this.getScopeKey(group.raw.datasetName, group.raw.modelTask);
                    if (rawScope === this.selectedScopeKey) {
                        pairs.push({
                            sessionId: sid,
                            modelName: group.modelName,
                            method: group.method,
                            raw: group.raw,
                            cleaned: group.cleaned
                        });
                    }
                }
            }
            return pairs;
        }
    },
    methods: {
        getPairMetrics(pair) {
            const isClassification = pair.raw.modelTask;
            const metricsList = isClassification
                ? [
                    { key: 'accuracy', label: 'Accuracy', better: 'higher' },
                    { key: 'precision_macro', label: 'Precision (Macro)', better: 'higher' },
                    { key: 'recall_macro', label: 'Recall (Macro)', better: 'higher' },
                    { key: 'f1_macro', label: 'F1-Score (Macro)', better: 'higher' }
                  ]
                : [
                    { key: 'rmse', label: 'RMSE', better: 'lower' },
                    { key: 'mae', label: 'MAE', better: 'lower' },
                    { key: 'rsquared', label: 'R²', better: 'higher' },
                    { key: 'mse', label: 'MSE', better: 'lower' }
                  ];

            return metricsList.map((m, idx) => {
                const rawVal = pair.raw.metrics ? pair.raw.metrics[m.key] : null;
                const cleanVal = pair.cleaned.metrics ? pair.cleaned.metrics[m.key] : null;
                
                let diff = null;
                let pctDiff = null;
                let isImprovement = false;
                let diffStr = '-';
                let impactStr = 'No Change';
                let diffClass = '';
                let tagClass = 'is-light';

                if (rawVal != null && cleanVal != null) {
                    diff = cleanVal - rawVal;
                    isImprovement = m.better === 'higher' ? diff > 0.00001 : diff < -0.00001;
                    const isRegression = m.better === 'higher' ? diff < -0.00001 : diff > 0.00001;

                    if (Math.abs(diff) < 0.00001) {
                        diffStr = '0.0000';
                        impactStr = '0.00%';
                    } else {
                        diffStr = (diff > 0 ? '+' : '') + diff.toFixed(4);
                        if (rawVal !== 0) {
                            const pct = (diff / rawVal) * 100;
                            pctDiff = pct;
                            impactStr = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
                        } else {
                            impactStr = diff > 0 ? 'Improved' : 'Regressed';
                        }
                    }

                    if (isImprovement) {
                        diffClass = 'has-text-success has-text-weight-semibold';
                        tagClass = 'is-success is-light';
                    } else if (isRegression) {
                        diffClass = 'has-text-danger has-text-weight-semibold';
                        tagClass = 'is-danger is-light';
                    }
                }

                return {
                    key: m.key,
                    label: m.label,
                    rawVal,
                    cleanVal,
                    diffStr,
                    impactStr,
                    diffClass,
                    tagClass,
                    isFirst: idx === 0
                };
            });
        },
        getScopeKey(datasetName, modelTask) {
            return `${datasetName}__${modelTask ? 'cls' : 'reg'}`;
        },
        metricDefinitions(task) {
            return task ?
                [
                    { key: 'accuracy', label: 'Accuracy', better: 'higher' },
                    { key: 'f1_micro', label: 'F1 micro', better: 'higher' },
                    { key: 'f1_macro', label: 'F1 macro', better: 'higher' }
                ] :
                [
                    { key: 'rsquared', label: 'R²', better: 'higher' },
                    { key: 'rmse', label: 'RMSE', better: 'lower' },
                    { key: 'mae', label: 'MAE', better: 'lower' },
                    { key: 'mse', label: 'MSE', better: 'lower' }
                ];
        },
        getMetricValue(metrics, metricKey) {
            if (!metrics) {
                return null;
            }
            const aliases = {
                accuracy: ['accuracy'],
                f1_micro: ['f1_micro', 'f1micro', 'f1Micro'],
                f1_macro: ['f1_macro', 'f1macro', 'f1Macro'],
                rsquared: ['rsquared', 'r2', 'R2'],
                rmse: ['rmse', 'RMSE'],
                mae: ['mae', 'MAE'],
                mse: ['mse', 'MSE']
            };
            const keys = aliases[metricKey] || [metricKey];
            for (const key of keys) {
                const value = metrics[key];
                if (Number.isFinite(value)) {
                    return Number(value);
                }
            }
            return null;
        },
        formatMetricValue(value) {
            return Number.isFinite(value) ? Number(value).toFixed(3) : '-';
        },
        buildScopeOptions() {
            const scopeMap = new Map();
            this.settings.getMethodResults.forEach((result) => {
                if (!result?.datasetName) {
                    return;
                }
                const key = this.getScopeKey(result.datasetName, result.modelTask);
                if (!scopeMap.has(key)) {
                    scopeMap.set(key, {
                        key,
                        datasetName: result.datasetName,
                        modelTask: result.modelTask,
                        label: `${result.datasetName} - ${result.modelTask ? 'classification' : 'regression'}`
                    });
                }
            });
            this.comparisonScopes = Array.from(scopeMap.values());

            if (!this.comparisonScopes.length) {
                this.selectedScopeKey = '';
                return;
            }

            const preferredKey = this.getScopeKey(this.settings.datasetName, this.settings.classificationTask);
            if (!this.selectedScopeKey || !scopeMap.has(this.selectedScopeKey)) {
                this.selectedScopeKey = scopeMap.has(preferredKey) ? preferredKey : this.comparisonScopes[0].key;
            }
        },
        calculateCompositeScore(rows, metrics) {
            const ranges = {};
            metrics.forEach((metric) => {
                const values = rows.map((row) => row.metrics[metric.key]).filter(Number.isFinite);
                if (!values.length) {
                    ranges[metric.key] = null;
                    return;
                }
                ranges[metric.key] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            });

            rows.forEach((row) => {
                let scoreSum = 0;
                let scoreCount = 0;
                metrics.forEach((metric) => {
                    const value = row.metrics[metric.key];
                    const range = ranges[metric.key];
                    if (!Number.isFinite(value) || !range) {
                        return;
                    }
                    const distance = (range.max - range.min) || 1;
                    const normalized = metric.better === 'higher'
                        ? (value - range.min) / distance
                        : (range.max - value) / distance;
                    scoreSum += normalized;
                    scoreCount += 1;
                });
                row.compositeScore = scoreCount ? scoreSum / scoreCount : null;
            });
        },
        rankRows(rows, selectedMetric) {
            const metricConfig = this.availableMetrics.find((metric) => metric.key === selectedMetric);
            const sortedRows = [...rows].sort((a, b) => {
                const valueA = a.metrics[selectedMetric];
                const valueB = b.metrics[selectedMetric];

                if (Number.isFinite(valueA) && Number.isFinite(valueB)) {
                    if (metricConfig?.better === 'lower') {
                        return valueA - valueB;
                    }
                    return valueB - valueA;
                }
                if (Number.isFinite(valueA)) {
                    return -1;
                }
                if (Number.isFinite(valueB)) {
                    return 1;
                }
                const compositeA = Number.isFinite(a.compositeScore) ? a.compositeScore : -Infinity;
                const compositeB = Number.isFinite(b.compositeScore) ? b.compositeScore : -Infinity;
                return compositeB - compositeA;
            });

            const bestRow = sortedRows.find((row) => Number.isFinite(row.metrics[selectedMetric]));
            const bestValue = bestRow ? bestRow.metrics[selectedMetric] : null;

            sortedRows.forEach((row, index) => {
                row.rank = index + 1;
                const value = row.metrics[selectedMetric];
                if (!Number.isFinite(value) || !Number.isFinite(bestValue)) {
                    row.gapToBest = null;
                    return;
                }
                row.gapToBest = metricConfig?.better === 'lower' ? value - bestValue : bestValue - value;
            });

            return sortedRows;
        },
        updateSummary(selectedMetric) {
            const metricConfig = this.availableMetrics.find((metric) => metric.key === selectedMetric);
            const bestRow = this.comparisonRows.find((row) => Number.isFinite(row.metrics[selectedMetric]));
            const worstRow = [...this.comparisonRows].reverse().find((row) => Number.isFinite(row.metrics[selectedMetric]));
            let spread = null;
            if (bestRow && worstRow) {
                spread = Math.abs(bestRow.metrics[selectedMetric] - worstRow.metrics[selectedMetric]);
            }

            this.summary = {
                bestModel: bestRow ? bestRow.displayName : '-',
                bestMetricValue: bestRow ? this.formatMetricValue(bestRow.metrics[selectedMetric]) : '-',
                modelCount: this.comparisonRows.length,
                metricSpread: Number.isFinite(spread) ? this.formatMetricValue(spread) : '-',
                metricLabel: metricConfig ? metricConfig.label : 'Primary metric'
            };
        },
        purgeComparisonPlots() {
            if (!window.Plotly) {
                return;
            }
            ['comparison_primary_plot', 'comparison_heatmap_plot'].forEach((id) => {
                try {
                    window.Plotly.purge(id);
                } catch (error) {
                    console.debug('comparison purge skipped', id, error);
                }
            });
        },
        async renderComparisonPlots() {
            if (!this.comparisonRows.length || !this.selectedMetric) {
                this.purgeComparisonPlots();
                return;
            }
            if (!window.Plotly) {
                await getPlotly();
            }

            const metricConfig = this.availableMetrics.find((metric) => metric.key === this.selectedMetric);
            if (!metricConfig) {
                return;
            }

            const rankedRows = this.comparisonRows.filter((row) => Number.isFinite(row.metrics[this.selectedMetric]));
            const labels = rankedRows.map((row) => row.displayName);
            const values = rankedRows.map((row) => row.metrics[this.selectedMetric]);
            window.Plotly.newPlot('comparison_primary_plot', [{
                x: labels,
                y: values,
                type: 'bar',
                marker: {
                    color: values.map((_, index) => index === 0 ? '#12b886' : '#4dabf7')
                }
            }], mergePlotlyLayout({
                height: 330,
                margin: { l: 50, r: 10, t: 20, b: 100 },
                xaxis: {
                    tickangle: -30,
                },
                yaxis: {
                    title: metricConfig.label,
                },
            }, false), { displayModeBar: false, responsive: true });

            const metricKeys = this.availableMetrics.map((metric) => metric.key);
            const metricLabels = this.availableMetrics.map((metric) => metric.label);
            const normalized = this.comparisonRows.map((row) => {
                return metricKeys.map((key, i) => {
                    const metric = this.availableMetrics[i];
                    const availableValues = this.comparisonRows.map((r) => r.metrics[key]).filter(Number.isFinite);
                    if (!availableValues.length || !Number.isFinite(row.metrics[key])) {
                        return null;
                    }
                    const min = Math.min(...availableValues);
                    const max = Math.max(...availableValues);
                    const span = (max - min) || 1;
                    if (metric.better === 'lower') {
                        return (max - row.metrics[key]) / span;
                    }
                    return (row.metrics[key] - min) / span;
                });
            });

            window.Plotly.newPlot('comparison_heatmap_plot', [{
                x: metricLabels,
                y: this.comparisonRows.map((row) => row.displayName),
                z: normalized,
                type: 'heatmap',
                colorscale: 'YlGnBu',
                zmin: 0,
                zmax: 1
            }], {
                height: 330,
                margin: { l: 90, r: 10, t: 20, b: 50 },
                paper_bgcolor: bgColor,
                plot_bgcolor: bgColor,
                font: { color: textColor }
            }, { responsive: true });
        },
        refreshComparison() {
            this.buildScopeOptions();
            if (!this.selectedScopeKey) {
                this.availableMetrics = [];
                this.comparisonRows = [];
                this.updateSummary(this.selectedMetric);
                this.purgeComparisonPlots();
                return;
            }

            const selectedScope = this.comparisonScopes.find((scope) => scope.key === this.selectedScopeKey);
            if (!selectedScope) {
                return;
            }

            const metricDefinitions = this.metricDefinitions(selectedScope.modelTask);
            const scopedResults = this.settings.getMethodResults.filter((result) =>
                result.datasetName === selectedScope.datasetName && result.modelTask === selectedScope.modelTask
            );

            const rawRows = scopedResults.map((result) => {
                const metrics = {};
                metricDefinitions.forEach((metric) => {
                    metrics[metric.key] = this.getMetricValue(result.metrics, metric.key);
                });
                return {
                    resultId: result.id,
                    displayName: `${result.id}.${result.name}`,
                    metrics,
                    compositeScore: null,
                    rank: null,
                    gapToBest: null
                };
            });

            this.availableMetrics = metricDefinitions.filter((metric) =>
                rawRows.some((row) => Number.isFinite(row.metrics[metric.key]))
            );

            if (!this.availableMetrics.length) {
                this.comparisonRows = [];
                this.updateSummary(this.selectedMetric);
                this.purgeComparisonPlots();
                return;
            }

            if (!this.availableMetrics.some((metric) => metric.key === this.selectedMetric)) {
                this.selectedMetric = this.availableMetrics[0].key;
            }

            this.calculateCompositeScore(rawRows, this.availableMetrics);
            this.comparisonRows = this.rankRows(rawRows, this.selectedMetric);
            this.updateSummary(this.selectedMetric);

            this.$nextTick(() => {
                this.renderComparisonPlots();
            });
        },
        onScopeChange() {
            this.refreshComparison();
        },
        onResultTabChanged(v) {
            if (v === 0) {
                this.refreshComparison();
            }
            window.dispatchEvent(new Event('resize'));
        },
        downloadComparisonCsv() {
            if (!this.comparisonRows.length) {
                return;
            }

            const headers = ['rank', 'model']
                .concat(this.availableMetrics.map((metric) => metric.label))
                .concat(['gap_to_best', 'composite_score']);

            const lines = [headers.join(',')];
            this.comparisonRows.forEach((row) => {
                const values = [
                    row.rank,
                    `"${row.displayName}"`,
                    ...this.availableMetrics.map((metric) => this.formatMetricValue(row.metrics[metric.key])),
                    this.formatMetricValue(row.gapToBest),
                    this.formatMetricValue(row.compositeScore)
                ];
                lines.push(values.join(','));
            });

            const csv = lines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'methods_comparison.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        deleteResult(id) {
            // eslint-disable-next-line no-unused-vars
            let [tables, plots] = this.settings.getResultVisualizations(id);
            tables.forEach(table => {
                removeTable(table)
            });
            plots.forEach(plot => {
                window.Plotly.purge(plot);
            });
            this.settings.removeResult(id);
            this.$nextTick(() => {
                this.refreshComparison();
            });

        },
    },
    watch: {
        'settings.isDark'() {
            this.$nextTick(() => this.refreshComparison());
        },
        'settings.results': {
            handler() {
                this.$nextTick(() => this.refreshComparison());
            },
            deep: true
        }
    },
    mounted() {
        this.refreshComparison();
    }
}
</script>

<style>
.results-root {
    color: #1e293b;
}

.results-overview {
    align-items: center;
    background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 34%),
        linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eef2ff 100%);
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    box-shadow: 0 18px 42px -34px rgba(15, 23, 42, 0.55);
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding: 1rem 1.15rem;
}

.results-overview__eyebrow,
.result-hero__eyebrow {
    color: #3b82f6;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    margin-bottom: 0.15rem;
    text-transform: uppercase;
}

.results-overview__title,
.result-hero__title {
    color: #0f172a;
    font-size: 1.05rem;
    font-weight: 800;
    line-height: 1.25;
    margin: 0;
}

.results-overview__subtitle,
.result-hero__meta {
    color: #64748b;
    font-size: 0.8rem;
    line-height: 1.5;
    margin-top: 0.25rem;
}

.result-hero__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
}

.results-overview__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
}

.results-stat {
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 12px;
    min-width: 92px;
    padding: 0.55rem 0.7rem;
}

.results-stat__label {
    color: #64748b;
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.results-stat strong {
    color: #0f172a;
    font-size: 1.15rem;
}

.results-empty {
    align-items: center;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    color: #64748b;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 3rem 1rem;
    text-align: center;
}

.results-empty__icon {
    color: #93c5fd;
    font-size: 2.3rem;
}

.results-empty h3 {
    color: #0f172a;
    font-size: 1.05rem;
    font-weight: 800;
}

.results-empty p {
    max-width: 520px;
}

.result-dashboard {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}

.result-hero {
    align-items: flex-start;
    background:
        radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 32%),
        linear-gradient(135deg, #fff 0%, #f8fafc 100%);
    border: 1px solid #e2e8f0;
    border-left: 4px solid #3b82f6;
    border-radius: 16px;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    padding: 1rem;
}

.result-dashboard--regression .result-hero {
    border-left-color: #10b981;
}

.result-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    justify-content: flex-end;
}

.result-action {
    align-items: center;
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    font-size: 0.74rem;
    font-weight: 700;
    gap: 0.35rem;
    padding: 0.45rem 0.65rem;
}

.result-action--danger { background: #ef4444; }
.result-action--success { background: #10b981; }
.result-action--info { background: #0ea5e9; }

.result-kpi-grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.result-kpi-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 14px 28px -28px rgba(15, 23, 42, 0.55);
    padding: 0.8rem 0.9rem;
}

.result-kpi-card__label {
    color: #64748b;
    display: block;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.result-kpi-card strong {
    color: #0f172a;
    display: block;
    font-size: 1.25rem;
    line-height: 1.2;
    margin: 0.18rem 0;
}

.result-kpi-card p {
    color: #64748b;
    font-size: 0.74rem;
    line-height: 1.45;
}

.result-kpi-card--primary { border-top: 3px solid #3b82f6; }
.result-kpi-card--success { border-top: 3px solid #10b981; }
.result-kpi-card--warning { border-top: 3px solid #f59e0b; }
.result-kpi-card--neutral { border-top: 3px solid #94a3b8; }

.result-info-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
}

.result-panel,
.result-plot-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
}

.result-panel {
    padding: 0.85rem 0.95rem;
}

.result-panel--guide {
    background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 42%),
        #f8fafc;
}

.result-panel__title {
    color: #334155;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    margin-bottom: 0.55rem;
    text-transform: uppercase;
}

.result-panel p:not(.result-panel__title),
.result-muted {
    color: #64748b;
    font-size: 0.78rem;
    line-height: 1.6;
}

.result-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.65rem;
}

.result-chip {
    background: #eef2ff;
    border: 1px solid rgba(99, 102, 241, 0.18);
    border-radius: 999px;
    color: #4338ca;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
}

.result-detail-list {
    display: grid;
    gap: 0.35rem 0.8rem;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    margin: 0 0 0.55rem;
}

.result-detail-list div {
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.25rem;
}

.result-detail-list dt {
    color: #94a3b8;
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
}

.result-detail-list dd {
    color: #1e293b;
    font-size: 0.8rem;
    font-weight: 700;
    margin: 0;
}

.result-plot-card {
    margin-bottom: 0.9rem;
    overflow: hidden;
}

.result-plot-card__head {
    align-items: center;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    padding: 0.7rem 0.9rem;
}

.result-plot-card__head h3 {
    color: #0f172a;
    font-size: 0.86rem;
    font-weight: 800;
    margin: 0;
}

.result-plot-card__head p {
    color: #64748b;
    font-size: 0.74rem;
    line-height: 1.45;
    margin-top: 0.12rem;
}

.result-plot-card__body {
    padding: 0.65rem 0.75rem;
}

.result-pending {
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #64748b;
    display: flex;
    gap: 0.65rem;
    padding: 1rem;
}

@media (max-width: 820px) {
    .results-overview,
    .result-hero {
        align-items: stretch;
        flex-direction: column;
    }

    .result-actions {
        justify-content: flex-start;
    }

    .result-info-grid {
        grid-template-columns: 1fr;
    }
}

.comparison-shell {
    padding: 0.25rem 0.35rem 0.6rem;
}

.comparison-kpi-grid {
    margin-top: 0.25rem;
}

.comparison-kpi {
    background: linear-gradient(150deg, rgba(71, 167, 255, 0.14), rgba(16, 185, 129, 0.12));
    border: 1px solid rgba(96, 165, 250, 0.35);
    border-radius: 12px;
    padding: 0.55rem 0.7rem;
    min-height: 76px;
}

.comparison-kpi-title {
    font-size: 0.72rem;
    font-weight: 700;
    opacity: 0.8;
    margin-bottom: 0.15rem;
}

.comparison-kpi-value {
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: 0.01em;
}

.comparison-plot {
    min-height: 300px;
}

html.dark .comparison-kpi {
    background: linear-gradient(150deg, rgba(57, 126, 190, 0.28), rgba(31, 100, 92, 0.3));
    border-color: rgba(112, 160, 214, 0.45);
}
</style>
