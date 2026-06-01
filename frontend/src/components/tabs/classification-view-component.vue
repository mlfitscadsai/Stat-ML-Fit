<template>
    <article class="result-dashboard result-dashboard--classification">
        <section class="result-hero">
            <div>
                <p class="result-hero__eyebrow">Classification Result</p>
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
                <button class="result-action result-action--info" @click="downloadPythonCode()">
                    <i class="fas fa-code"></i>
                    Download code
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
                    Start with F1 macro when classes are imbalanced, then inspect the confusion matrix
                    to see which classes are confused. Use ROC/probability plots to tune thresholds when
                    false positives and false negatives have different costs.
                </p>
            </article>
        </section>
        <template v-if="!hide">
            <div class="column is-12">
                <article class="result-plot-card">
                    <header class="result-plot-card__head">
                        <div>
                            <h3>Classification diagnostics</h3>
                            <p>Confusion matrix, probability distributions, ROC curve, and feature importance.</p>
                        </div>
                    </header>
                    <div class="result-plot-card__body">
                        <div class="columns is-multiline is-gapless">
                            <div class="column is-6 my-1" style="height: 400px;" :id="'confusion_matrix_' + result.id">
                            </div>
                            <div v-show="hasProbabilityDiagnostics" class="column is-6 my-1" style="height: 400px;"
                                :id="'proba_plot_' + result.id">
                            </div>
                            <br>
                            <div v-show="hasProbabilityDiagnostics" class="column is-6 my-1" style="height: 400px;"
                                :id="'roc_plot_' + result.id">
                            </div>

                            <div v-show="hasFeatureImportanceDiagnostics" class="column is-6 my-1"
                                style="height: 400px;" :id="'pfi_boxplot_' + result.id">
                            </div>
                        </div>
                    </div>
                </article>
            </div>
            <div class="column is-12" v-if="result.name.includes('Logi.Reg')">
                <article class="result-plot-card">
                    <header class="result-plot-card__head">
                        <div>
                            <h3>Logistic regression coefficients</h3>
                            <p>Compare unregularized and regularized coefficients, uncertainty, and regularization paths.</p>
                        </div>
                    </header>
                <div class="columns is-multiline result-plot-card__body">
                    <div class="column is-7">
                        <div class="table-container">
                            <table
                                class="table has-text-centered nowrap is-striped is-bordered is-narrow is-hoverable is-size-7"
                                :id="'metrics_table_' + result.id">
                                <thead>
                                    <tr>
                                        <th colspan="1"></th>
                                        <th colspan="3" class="has-text-centered">OLS</th>
                                        <th colspan="3" class="has-text-centered">lambda min</th>
                                        <th colspan="3" class="has-text-centered">lambda 1se</th>
                                    </tr>
                                    <tr>
                                        <th class="has-text-centered">name</th>
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
                                <tfoot class="has-text-centered" style=" font-weight: normal">
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
                    <div class="column is-5" :id="'parameters_plot_' + result.id">
                    </div>
                    <div class="column is-6" :id="'errors_' + result.id" style="height:250px">
                    </div>
                    <div class="column is-6" :id="'regularization_' + result.id" style="height:250px">
                    </div>
                </div>
                </article>
            </div>
            <div class="column is-12" v-show="result.hasExplaination && !result.name.includes('Logi.Reg')">
                <article class="result-plot-card">
                    <header class="result-plot-card__head">
                        <div>
                            <h3>Explainability</h3>
                            <p>Partial dependence shows the average model response as a feature changes.</p>
                        </div>
                    </header>
                    <div class="result-plot-card__body">
                        <div v-if="!hasPdpData" class="notification is-warning is-light is-size-7 mb-2">
                            Partial Dependence Plot is not available for this model/dataset configuration.
                            Training succeeded, but explainability for PDP could not be computed.
                        </div>
                        <div class="columns is-multiline is-gapless" v-show="hasPdpData">
                            <div class="column is-6" style="height: 400px;" :id="'knn_table_' + result.id"
                                v-if="result.name.toString().toLowerCase().includes('knn')">
                            </div>
                            <div :id="'pdp_containers_' + result.id"></div>
                        </div>
                        <br>
                    </div>
                </article>
            </div>
        </template>
        <template v-else>
            <section class="result-pending">
                <i class="fas fa-circle-notch fa-spin"></i>
                <span>Remote analysis is still running. Results will appear here when the job completes.</span>
            </section>
        </template>
    </article>

</template>

<script>
import { settingStore } from '@/stores/settings';
import { ModelFactory } from "@/helpers/model_factory";

import { getDanfo } from '@/utils/danfo_loader';
import { openGemmaAssistant } from '@/services/gemma/assistant-events';
import { buildMethodPrompt } from '@/services/gemma/help-context';
import { apiUrl } from '@/services/api/client';

import axios from "axios";

export default {

    setup() {
        const settings = settingStore()
        return { settings }
    },
    created() {
        this.pdpFeature = this.settings.features[0].name
    },
    data() {
        return {
            pdpFeature: null,
            hide: false,
            fileName: null,
            showResult: true,
            intervalId: null,
            jobProgressTries: 0,
        }
    },
    computed: {
        metricCards() {
            const metric = (key) => {
                const value = this.result?.metrics?.[key];
                return Number.isFinite(value) ? Number(value).toFixed(3) : 'N/A';
            };
            return [
                { key: 'accuracy', label: 'Accuracy', value: metric('accuracy'), tone: 'primary', help: 'Overall share of correct predictions.' },
                { key: 'f1_micro', label: 'F1 micro', value: metric('f1_micro'), tone: 'success', help: 'Global precision/recall balance across all samples.' },
                { key: 'f1_macro', label: 'F1 macro', value: metric('f1_macro'), tone: 'warning', help: 'Class-balanced F1; useful for imbalanced targets.' },
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
        hasPdpData() {
            const averages = this.result?.model?.pdp_averages;
            const grids = this.result?.model?.pdp_grid;
            return Array.isArray(averages) && averages.length > 0 && Array.isArray(grids) && grids.length > 0;
        },
        hasProbabilityDiagnostics() {
            const hasProbas = Array.isArray(this.result?.model?.probas) && this.result.model.probas.length > 0;
            const hasRoc = Array.isArray(this.result?.model?.fpr) && this.result.model.fpr.length > 0;
            return Boolean(this.result?.showProbas || (hasProbas && hasRoc));
        },
        hasFeatureImportanceDiagnostics() {
            const importances = this.result?.model?.importances;
            return Boolean(
                this.result?.hasExplaination
                && this.result?.if !== 1
                && !String(this.result?.name || '').includes('Logi.Reg')
                && Array.isArray(importances)
                && importances.length > 0
            );
        }
    },
    name: 'ClassificationViewComponent',
    methods: {
        async upload() {
            let vm = this;
            const danfo = await getDanfo()
            let formdata = new FormData();
            let dataframe = danfo.concat({ dfList: [this.result.snapshot.x, this.result.snapshot.xt], axis: 0 })
            let target = this.result.snapshot.y.concat(this.result.snapshot.yt)
            dataframe.addColumn(this.result.target, target, { inplace: true })
            let file = danfo.toCSV(dataframe, { filePath: "pca_data.csv" });
            const blob = new Blob([file], { type: "text/csv" });
            formdata.append('file', blob, 'main.csv');

            return axios.post(apiUrl('/upload'), formdata, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
            ).then(function (res) {
                vm.fileName = res.data
                console.log('SUCCESS!!', vm.fileName);
                axios.get(apiUrl(`/run?file_name=${encodeURIComponent(vm.fileName)}&job_id=${encodeURIComponent(vm.result.useHPC)}&target=${encodeURIComponent(vm.result.target)}&seed=${encodeURIComponent(vm.result.seed)}`)).then(() => {
                    vm.intervalId = setInterval(() => {
                        axios.get(apiUrl(`/progress?job_id=${encodeURIComponent(vm.result.useHPC)}`))
                            .then((res) => {
                                vm.jobProgressTries += 1;
                                if (res.data?.status === 'running') {
                                    return;
                                }
                                const jobResult = res.data?.result || res.data;
                                if (jobResult && res.data?.status !== 'failed') {
                                    vm.hide = false;
                                    vm.result.model.predictions = jobResult.predictions;
                                    vm.result.model.pdp_averages = jobResult.pdp_avgs;
                                    vm.result.model.pdp_grid = jobResult.pdp_grid;
                                    vm.result.model.importances = jobResult.pfi;
                                    vm.result.model.fpr = jobResult.fprs;
                                    vm.result.model.tpr = jobResult.tprs;
                                    vm.result.model.auc = jobResult.auc;
                                    vm.result.model.probas = jobResult.probas;
                                    vm.result.model.visualize(vm.result.snapshot.xt, vm.result.snapshot.yt, vm.result.snapshot.labels,
                                        jobResult.predictions, vm.result.encoder, vm.result.snapshot.x.columns, vm.result.snapshot.categoricals)
                                    clearInterval(vm.intervalId);
                                } else if (vm.jobProgressTries > 100) {
                                    clearInterval(vm.intervalId);
                                }
                            });
                    }, 3 * 1000)
                }).catch(function (err) {
                    console.log('FAILURE!!', err.data);
                });
            }).catch(function () {
                console.log('FAILURE!!');
            });
        },
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
        downloadPythonCode() {
            let model_factory = new ModelFactory();
            let model = model_factory.createModel(this.result.snapshot.id, this.result.options);
            let pyCode = model.generatePythonCode()
            const blob = new Blob([pyCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'example.py';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        async updatePartialDependencePlot() {
            let model_factory = new ModelFactory();
            let model = model_factory.createModel(this.result.snapshot.id, this.result.options);
            await model.train(this.result.snapshot.x, this.result.snapshot.y,
                this.result.snapshot.xt, this.result.snapshot.yt, this.result.snapshot.xFeatures, this.result.snapshot.categoricals, this.result.snapshot.xFeatures.findIndex(feature => feature == this.pdpFeature));
            model.chartController.plotPDP(this.result.id, model.pdp_averages, model.pdp_grid, this.result.snapshot.labels, this.pdpFeature);

        }
    },
    props: {
        result: {}
    },
    watch: {
        result: {
            handler() {
                if (this.result.useHPC) {
                    this.hide = true;
                    this.upload()
                }
            },
            immediate: true,
        }
    },
    errorCaptured(err, vm, info) {
        console.log(`cat EC: ${err.toString()}\ninfo: ${info}`);
        return false;
    },
    unmounted() {
        clearInterval(this.intervalId)
    }
}
</script>
