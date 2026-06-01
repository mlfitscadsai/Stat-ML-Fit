<template>
    <div class="result-dashboard result-dashboard--regression">
        <section class="result-hero">
            <div>
                <p class="result-hero__eyebrow">Regression Result</p>
                <h2 class="result-hero__title">{{ result.id }}. {{ result.name }}</h2>
                <p class="result-hero__meta">
                    Dataset <strong>{{ result.datasetName || 'Unknown' }}</strong>
                    <span>Target <strong>{{ result.target || 'N/A' }}</strong></span>
                </p>
            </div>
            <div class="result-actions">
                <button class="result-action result-action--danger" @click="deleteTab()">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
                <button class="result-action result-action--success" @click="toggleHelp(result.helpSectionId)">
                    <i class="fas fa-book-open"></i>
                    Method description
                </button>
            </div>
        </section>

        <section class="result-kpi-grid">
            <article v-for="metric in metricCards" :key="metric.key" class="result-kpi-card" :class="`result-kpi-card--${metric.tone}`">
                <span class="result-kpi-card__label">{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
                <p>{{ metric.help }}</p>
            </article>
        </section>

        <section class="result-info-grid">
            <article class="result-panel">
                <p class="result-panel__title">Model setup</p>
                <div class="result-chip-row">
                    <span class="result-chip">{{ featureStats.numeric }} numeric</span>
                    <span class="result-chip">{{ featureStats.categorical }} categorical</span>
                    <span class="result-chip">{{ transformationCount }} transformations</span>
                </div>
                <dl class="result-detail-list">
                    <div v-for="(value, key) in result.options" :key="key">
                        <dt>{{ key }}</dt>
                        <dd>{{ value['value'] }}</dd>
                    </div>
                </dl>
                <p v-if="transformationSummary" class="result-muted">
                    Transformations: {{ transformationSummary }}
                </p>
            </article>
            <article class="result-panel result-panel--guide">
                <p class="result-panel__title">Interpretation guide</p>
                <p>
                    Start with prediction-vs-actual plots to see fit quality, then inspect residual and QQ plots
                    for bias, heavy tails, and assumption breaks. Prefer RMSE when large errors matter most.
                </p>
            </article>
        </section>
        <div class="column is-12" v-if="result.name.includes('Lin.Reg') || result.name.includes('Poly.Reg')">
            <div class="columns is-multiline is-gapless">

                <div class="column is-7">
                    <article class="result-plot-card">
                        <header class="result-plot-card__head">
                            <div>
                                <h3>Coefficient estimates</h3>
                                <p>Compare OLS and regularized coefficient estimates with uncertainty and p-values.</p>
                            </div>
                        </header>
                        <div class="result-plot-card__body">
                    <div class="table-container">
                        <table
                            class="table has-text-centered nowrap is-striped is-bordered is-narrow is-hoverable is-size-7"
                            :id="'metrics_table_' + result.id">
                            <thead>
                                <tr>
                                    <th colspan="1"></th>
                                    <th colspan="3" class="has-text-centered">OLS</th>
                                    <th colspan="3" class="has-text-centered">lasso min</th>
                                    <th colspan="3" class="has-text-centered">lasso 1se</th>
                                </tr>
                                <tr>
                                    <th class="has-text-centered">names</th>
                                    <th>coef</th>
                                    <th>st.d.</th>
                                    <th><i>p</i>-value</th>
                                    <th>coef</th>
                                    <th>st.d.</th>
                                    <th><i>p</i>-value</th>
                                    <th>coef</th>
                                    <th>st.d.</th>
                                    <th><i>p</i>-value</th>
                                </tr>
                            </thead>
                            <tfoot style=" font-weight: normal">
                                <tr>
                                    <th></th>
                                    <th colspan="3" class="has-text-centered"></th>
                                    <th colspan="3" class="has-text-centered"></th>
                                    <th colspan="3" class="has-text-centered"></th>

                                </tr>
                            </tfoot>
                        </table>
                    </div>
                        </div>
                    </article>
                </div>
                <div class="column is-5" :id="'parameters_plot_' + result.id" style="min-height:300px">
                </div>
                <div class="column is-12 mb-2">
                    <article class="result-plot-card">
                        <header class="result-plot-card__head">
                            <div>
                                <h3>Regularization path</h3>
                                <p>Use these plots to understand how shrinkage trades variance for bias.</p>
                            </div>
                        </header>
                        <div class="result-plot-card__body">
                            <div class="columns is-multiline is-gapless">
                                <div class="column is-6" :id="'errors_' + result.id" width="100%" style="height:250px">
                                </div>
                                <div class="column is-6" :id="'regularization_' + result.id" width="100%"
                                    style="height:250px">
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
                <article class="result-plot-card">
                    <header class="result-plot-card__head">
                        <div>
                            <h3>Residual diagnostics</h3>
                            <p>Check prediction calibration, residual spread, and normality assumptions.</p>
                        </div>
                    </header>
                    <div class="result-plot-card__body">
                        <div class="columns is-multiline is-gapless">

                            <div class="column is-4">
                                <div :id="'regression_y_yhat_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'regression_y_yhat_min_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'regression_y_yhat_1se_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>

                            <div class="column is-4">
                                <div :id="'regression_residual_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'regression_residual_min_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'regression_residual_1se_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'qqplot_ols_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'qqplot_min_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                            <div class="column is-4">
                                <div :id="'qqplot_1se_' + result.id" width="100%" style="height:300px">
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </div>
        <div class="column is-12" v-else>
            <div class="columns is-multiline is-gapless">
                <div class="column is-12">
                    <article class="result-plot-card">
                        <header class="result-plot-card__head">
                            <div>
                                <h3>Fit quality</h3>
                                <p>Compare predicted and observed values, then inspect residual structure.</p>
                            </div>
                        </header>
                        <div class="result-plot-card__body">
                            <div class="columns is-multiline is-gapless">

                                <div class="column is-6">
                                    <div :id="'regression_y_yhat_' + result.id" style="width:100%;height:300px">
                                    </div>
                                </div>
                                <div class="column is-6">
                                    <div :id="'errors_' + result.id" style="width:100%;height:300px"></div>
                                </div>
                                <div class="column is-6" style="height: 350px;" :id="'knn_table_' + result.id"
                                    v-if="result.name.toString().toLowerCase().includes('knn')">
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
                <div class="column is-12">
                    <article class="result-plot-card">
                        <header class="result-plot-card__head">
                            <div>
                                <h3>Explainability</h3>
                                <p>Permutation importance and partial dependence explain which features drive predictions.</p>
                            </div>
                        </header>
                        <div class="result-plot-card__body">
                            <div class="columns is-multiline is-gapless">
                                <div class="column is-6" style="height: 400px;" v-show="result.hasExplaination"
                                    :id="'pfi_boxplot_' + result.id">
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </div>

    </div>
</template>

<script>
import { settingStore } from '@/stores/settings'
import { ModelFactory } from "@/helpers/model_factory";
import { openGemmaAssistant } from '@/services/gemma/assistant-events';
import { buildMethodPrompt } from '@/services/gemma/help-context';

export default {

    setup() {
        const settings = settingStore()
        return { settings }
    },
    name: 'regression-view-component',
    methods: {
        toggleHelp(id) {
            openGemmaAssistant({
                prompt: buildMethodPrompt({ ...this.result, helpSectionId: id }),
                context: {
                    resultId: this.result.id,
                    helpSectionId: id,
                    modelName: this.result.name,
                },
            });
        },
        deleteTab() {
            this.$emit("delete-result", this.result.id)
        },
        async updatePartialDependencePlot() {
            let model_factory = new ModelFactory();
            let model = model_factory.createModel(this.result.snapshot.id, this.result.options);
            await model.train(this.result.snapshot.x, this.result.snapshot.y,
                this.result.snapshot.xt, this.result.snapshot.yt, this.result.snapshot.xFeatures, this.result.snapshot.categoricals,
                [0, 1, 2]);
            model.chartController.plotPDPRegression(this.result.id, model.pdp_averages, model.pdp_grid, this.result.snapshot.labels, this.result.snapshot.xFeatures, this.result.snapshot.categoricals);

        },
    },
    created() {
        this.pdpFeature = this.settings.features.filter(feature => feature.name != this.settings.target)[0].name;

    },

    data() {
        return {
            pdpFeature: null,
            showResult: true
        }
    },
    computed: {
        metricCards() {
            const metric = (key, fallback = null) => {
                const value = this.result?.metrics?.[key];
                if (Number.isFinite(value)) return Number(value).toFixed(key === 'mse' ? 2 : 4);
                if (fallback != null) return fallback;
                return 'N/A';
            };
            const mse = this.result?.metrics?.mse;
            const rmseFallback = Number.isFinite(mse) ? Math.sqrt(Number(mse)).toFixed(4) : null;
            return [
                { key: 'rsquared', label: 'R²', value: metric('rsquared'), tone: 'primary', help: 'Variance explained by the model.' },
                { key: 'rmse', label: 'RMSE', value: metric('rmse', rmseFallback), tone: 'success', help: 'Typical error in target units.' },
                { key: 'mae', label: 'MAE', value: metric('mae'), tone: 'warning', help: 'Average absolute prediction error.' },
                { key: 'mse', label: 'MSE', value: metric('mse'), tone: 'neutral', help: 'Squared-error loss; emphasizes large misses.' },
            ];
        },
        featureStats() {
            return {
                numeric: this.result?.numericColumns?.length || 0,
                categorical: this.result?.categoricalFeatures?.length || 0,
            };
        },
        transformationCount() {
            return this.result?.transformations?.length || 0;
        },
        transformationSummary() {
            const transformations = this.result?.transformations || [];
            if (!transformations.length) return '';
            return transformations
                .map((t) => `${t.name}: ${t.scalerLabel || t.scaler || 'scaled'}`)
                .join(', ');
        },
    },
    props: {
        result: {}
    },
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>