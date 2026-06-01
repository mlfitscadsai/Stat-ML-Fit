<template>
    <div class="workspace-panel">
        <section class="workspace-content">
            <header class="workspace-page-head">
                <div class="workspace-page-head__layout">
                    <div class="workspace-page-head__left">
                        <div class="workspace-page-head__top">
                            <nav class="studio-breadcrumbs" aria-label="Breadcrumb">
                                <span class="studio-breadcrumbs__root">ML Studio</span>
                                <span class="studio-breadcrumbs__sep" aria-hidden="true">/</span>
                                <span class="studio-breadcrumbs__current">{{ currentWorkspacePage.title }}</span>
                            </nav>
                        </div>
                        <h1 class="workspace-page-head__title">{{ currentWorkspacePage.title }}</h1>
                        <p class="workspace-page-head__desc">{{ currentWorkspacePage.desc }}</p>
                    </div>
                    <div class="workspace-page-head__right" v-if="settings.datasetShape?.count > 0">
                        <div class="dataset-meta-badge">
                            <div class="dataset-meta-badge__icon">
                                <i class="fas fa-database"></i>
                            </div>
                            <div class="dataset-meta-badge__info">
                                <div class="dataset-meta-badge__name">{{ datasetDisplayName }}</div>
                                <div class="dataset-meta-badge__stats">
                                    <span><strong>{{ settings.datasetShape.count }}</strong> rows</span>
                                    <span class="dataset-meta-badge__sep">•</span>
                                    <span><strong>{{ settings.datasetShape.columns }}</strong> columns</span>
                                    <span class="dataset-meta-badge__sep">•</span>
                                    <span class="tag is-small" :class="settings.isClassification ? 'is-success' : 'is-info'">
                                        {{ settings.isClassification ? 'Classification' : 'Regression' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <b-tabs class="workspace-tabs workspace-tabs--studio" v-model="activeTab" :position="'is-centered'" :animated="false" type="success"
                @input="resize()">
                <b-tab-item label="Data Analysis" icon="search" icon-pack="fas">
                    <section v-if="this.settings.datasetShape?.count > 0">
                        <nav v-if="activeTab === 0" class="studio-subtabs" aria-label="Data analysis sections">
                            <button v-for="sub in dataAnalysisSubtabs" :key="sub.id" type="button"
                                class="studio-subtabs__btn"
                                :class="{ 'is-active': dataAnalysisSection === sub.id }"
                                @click="dataAnalysisSection = sub.id">
                                {{ sub.label }}
                            </button>
                        </nav>

                        <div v-show="dataAnalysisSection === 'overview'">
                            <dataset-health-component></dataset-health-component>
                        </div>

                        <div v-show="dataAnalysisSection === 'features'" class="studio-section-fade">
                        <div class="fp-root" v-if="isActive">
                            <!-- ── Summary bar ── -->
                            <div class="fp-summary-bar">
                                <div class="fp-summary-pill fp-pill--blue">
                                    <i class="fas fa-table"></i>
                                    <span>{{ settings.datasetShape.count }} <small>rows</small></span>
                                </div>
                                <div class="fp-summary-pill fp-pill--green">
                                    <i class="fas fa-columns"></i>
                                    <span>{{ settings.datasetShape.columns }} <small>columns</small></span>
                                </div>
                                <div class="fp-summary-pill fp-pill--purple">
                                    <i class="fas fa-hashtag"></i>
                                    <span>{{ continuousFeaturesStats.length }} <small>numeric</small></span>
                                </div>
                                <div class="fp-summary-pill fp-pill--orange">
                                    <i class="fas fa-font"></i>
                                    <span>{{ categoricalFeaturesStats.length }} <small>categorical</small></span>
                                </div>
                                <div class="fp-summary-pill" :class="fpTotalMissing > 0 ? 'fp-pill--red' : 'fp-pill--grey'">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <span>{{ fpTotalMissing }} <small>missing</small></span>
                                </div>
                                <div class="fp-summary-actions ml-auto">
                                    <button class="fp-btn fp-btn--primary" @click="applyChanges()">
                                        <i class="fas fa-check"></i> Apply changes
                                    </button>
                                </div>
                            </div>

                            <!-- ── Toolbar: search + filter + bulk ── -->
                            <div class="fp-toolbar">
                                <div class="fp-search-wrap">
                                    <i class="fas fa-search fp-search-icon"></i>
                                    <input class="fp-search" v-model="fpSearch" placeholder="Search features…" />
                                    <button v-if="fpSearch" class="fp-search-clear" @click="fpSearch=''"><i class="fas fa-times"></i></button>
                                </div>
                                <div class="fp-type-tabs">
                                    <button v-for="t in fpTypeTabs" :key="t.id" class="fp-type-tab"
                                        :class="{ 'is-active': fpTypeFilter === t.id }"
                                        @click="fpTypeFilter = t.id">{{ t.label }}</button>
                                </div>
                                <div class="fp-bulk-btns">
                                    <button class="fp-btn fp-btn--ghost" @click="fpSelectAll(true)"><i class="fas fa-check-square"></i> All</button>
                                    <button class="fp-btn fp-btn--ghost" @click="fpSelectAll(false)"><i class="far fa-square"></i> None</button>
                                </div>
                            </div>

                            <!-- ── Numerical cards ── -->
                            <div v-if="fpTypeFilter !== 'cat' && fpFilteredNumerical.length" class="fp-section">
                                <div class="fp-section-head">
                                    <span class="fp-section-badge fp-badge--num"><i class="fas fa-hashtag"></i></span>
                                    <h3 class="fp-section-title">Numerical Features</h3>
                                    <span class="fp-count-chip">{{ fpFilteredNumerical.length }}</span>
                                </div>
                                <div class="fp-cards-grid">
                                    <div class="fp-card fp-card--num" v-for="f in fpFilteredNumerical" :key="f.name"
                                        :class="{ 'fp-card--deselected': !f.selected, 'fp-card--high-missing': Number(f.missingPct) > 0.2 }">
                                        <div class="fp-card__header">
                                            <label class="fp-card__name-wrap">
                                                <input type="checkbox" v-model="f.selected" class="fp-checkbox" />
                                                <span class="fp-card__name" :title="f.name">{{ f.name }}</span>
                                            </label>
                                            <span class="fp-skew-badge" :title="`Skewness: ${f.skewness}`"
                                                :class="fpSkewClass(f.skewness)">
                                                {{ fpSkewLabel(f.skewness) }}
                                            </span>
                                        </div>
                                        <!-- Sparkline histogram -->
                                        <div class="fp-sparkline-wrap">
                                            <svg class="fp-sparkline" viewBox="0 0 80 28" preserveAspectRatio="none">
                                                <path :d="fpNumSparkline(f.histogram)" class="fp-spark-path" />
                                            </svg>
                                        </div>
                                        <!-- Stats grid -->
                                        <div class="fp-stats-grid">
                                            <div class="fp-stat">
                                                <span class="fp-stat__label">Min</span>
                                                <span class="fp-stat__val">{{ f.min }}</span>
                                            </div>
                                            <div class="fp-stat">
                                                <span class="fp-stat__label">Max</span>
                                                <span class="fp-stat__val">{{ f.max }}</span>
                                            </div>
                                            <div class="fp-stat">
                                                <span class="fp-stat__label">Mean</span>
                                                <span class="fp-stat__val">{{ f.mean }}</span>
                                            </div>
                                            <div class="fp-stat">
                                                <span class="fp-stat__label">Median</span>
                                                <span class="fp-stat__val">{{ f.median }}</span>
                                            </div>
                                            <div class="fp-stat">
                                                <span class="fp-stat__label">Std</span>
                                                <span class="fp-stat__val">{{ f.std }}</span>
                                            </div>
                                            <div class="fp-stat">
                                                <span class="fp-stat__label">IQR</span>
                                                <span class="fp-stat__val">{{ f.iqr }}</span>
                                            </div>
                                        </div>
                                        <!-- Q1 / Q3 row -->
                                        <div class="fp-quartiles">
                                            <span class="fp-q-label">Q1</span><span class="fp-q-val">{{ f.q1 }}</span>
                                            <span class="fp-q-sep"></span>
                                            <span class="fp-q-label">Q3</span><span class="fp-q-val">{{ f.q3 }}</span>
                                        </div>
                                        <!-- Missing value bar -->
                                        <div class="fp-missing-row">
                                            <span class="fp-missing-label">Missing</span>
                                            <div class="fp-missing-bar-wrap">
                                                <div class="fp-missing-bar" :style="{ width: (Number(f.missingPct)*100).toFixed(1) + '%' }"
                                                    :class="Number(f.missingPct) > 0.2 ? 'fp-missing-bar--high' : 'fp-missing-bar--low'"></div>
                                            </div>
                                            <span class="fp-missing-count">{{ f.missingValuesCount }}</span>
                                        </div>
                                        <!-- Type selector -->
                                        <div class="fp-type-row">
                                            <select class="fp-type-select" v-model="f.type">
                                                <option v-for="opt in featureTypeOptions" :value="opt.id" :key="opt.id">{{ opt.name }}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ── Categorical cards ── -->
                            <div v-if="fpTypeFilter !== 'num' && fpFilteredCategorical.length" class="fp-section">
                                <div class="fp-section-head">
                                    <span class="fp-section-badge fp-badge--cat"><i class="fas fa-font"></i></span>
                                    <h3 class="fp-section-title">Categorical Features</h3>
                                    <span class="fp-count-chip">{{ fpFilteredCategorical.length }}</span>
                                    <span class="fp-cat-note">Nominal → one-hot encoded &nbsp;·&nbsp; Ordinal → single column</span>
                                </div>
                                <div class="fp-cards-grid">
                                    <div class="fp-card fp-card--cat" v-for="f in fpFilteredCategorical" :key="f.name"
                                        :class="{ 'fp-card--deselected': !f.selected, 'fp-card--high-missing': Number(f.missingPct) > 0.2 }">
                                        <div class="fp-card__header">
                                            <label class="fp-card__name-wrap">
                                                <input type="checkbox" v-model="f.selected" class="fp-checkbox" />
                                                <span class="fp-card__name" :title="f.name">{{ f.name }}</span>
                                            </label>
                                            <span class="fp-unique-badge">{{ f.shape }} unique</span>
                                        </div>
                                        <!-- Top values bar chart -->
                                        <div class="fp-topvals" v-if="f.topValues && f.topValues.length">
                                            <div class="fp-topval-row" v-for="tv in f.topValues" :key="tv.label">
                                                <span class="fp-topval-label" :title="tv.label">{{ String(tv.label).length > 10 ? String(tv.label).slice(0,9)+'…' : tv.label }}</span>
                                                <div class="fp-topval-bar-wrap">
                                                    <div class="fp-topval-bar" :style="{ width: (tv.pct * 100).toFixed(1) + '%' }"></div>
                                                </div>
                                                <span class="fp-topval-pct">{{ (tv.pct * 100).toFixed(0) }}%</span>
                                            </div>
                                        </div>
                                        <!-- Stats row -->
                                        <div class="fp-cat-stats">
                                            <div class="fp-stat"><span class="fp-stat__label">Mode</span><span class="fp-stat__val fp-ellipsis">{{ f.mode }}</span></div>
                                            <div class="fp-stat"><span class="fp-stat__label">Mode %</span><span class="fp-stat__val">{{ (Number(f.percentage)*100).toFixed(1) }}%</span></div>
                                        </div>
                                        <!-- Missing -->
                                        <div class="fp-missing-row">
                                            <span class="fp-missing-label">Missing</span>
                                            <div class="fp-missing-bar-wrap">
                                                <div class="fp-missing-bar" :style="{ width: (Number(f.missingPct)*100).toFixed(1) + '%' }"
                                                    :class="Number(f.missingPct) > 0.2 ? 'fp-missing-bar--high' : 'fp-missing-bar--low'"></div>
                                            </div>
                                            <span class="fp-missing-count">{{ f.missingValuesCount }}</span>
                                        </div>
                                        <!-- Type selector -->
                                        <div class="fp-type-row">
                                            <select class="fp-type-select" v-model="f.type">
                                                <option v-for="opt in featureTypeOptions" :value="opt.id" :key="opt.id">{{ opt.name }}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- ── Empty state ── -->
                            <div v-if="!fpFilteredNumerical.length && !fpFilteredCategorical.length" class="fp-empty">
                                <i class="fas fa-search fa-2x mb-2"></i>
                                <p>No features match <strong>{{ fpSearch }}</strong></p>
                            </div>

                            <!-- ── Sample Data ── -->
                            <div class="fp-sample-panel">
                                <div class="fp-section-head">
                                    <span class="fp-section-badge fp-badge--grey"><i class="fas fa-eye"></i></span>
                                    <h3 class="fp-section-title">Sample Data</h3>
                                    <span class="fp-count-chip">5 rows</span>
                                </div>
                                <div class="fp-sample-scroll">
                                    <table class="fp-sample-table">
                                        <thead>
                                            <tr>
                                                <th v-for="col in datasetColumns" :key="col.field"
                                                    :class="fpColTypeClass(col.field)">{{ col.label }}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(row, ri) in sampleData" :key="ri">
                                                <td v-for="col in datasetColumns" :key="col.field">{{ row[col.field] }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        </div>

                        <div v-show="dataAnalysisSection === 'plots'" class="studio-section-fade">
                        <section>
                            <header class="distributions-section-header">
                                <h2 class="distributions-section-header__title">
                                    <i class="fas fa-chart-area" aria-hidden="true"></i>
                                    Feature Distributions
                                </h2>
                                <p class="distributions-section-header__subtitle">
                                    Inspect pairwise relationships and per-feature scaling before modeling.
                                </p>
                            </header>
                            <scatterplot-matrix-component ref="splom"></scatterplot-matrix-component>
                        </section>
                        </div>

                        <div v-show="dataAnalysisSection === 'correlations'" class="studio-section-fade mt-1">
                            <div class="studio-quality-report" style="margin-top: 1rem;">
                                <div class="studio-quality-report__head is-flex is-justify-content-space-between is-align-items-flex-start is-flex-wrap-wrap correlation-head-flex">
                                    <div>
                                        <h2 class="studio-quality-report__title">
                                            <i class="fas fa-project-diagram" aria-hidden="true"></i>
                                            Correlation Matrix and Dendrogram
                                            <b-tooltip append-to-body label="Ward method requires euclidean distance." multilined type="is-dark" position="is-right">
                                                <i class="fas fa-info-circle has-text-grey-light is-size-6 ml-2" style="cursor:help;"></i>
                                            </b-tooltip>
                                        </h2>
                                        <p class="studio-quality-report__subtitle">Explore relationships between numerical features and hierarchical clustering.</p>
                                    </div>
                                    <div class="correlation-toolbar mt-2">
                                        <b-field grouped group-multiline>
                                            <b-field label="Linkage Method" label-position="on-border" class="mr-3">
                                                <b-select size="is-small" v-model="method">
                                                    <option value="single">single</option>
                                                    <option value="complete">complete</option>
                                                    <option value="average">average</option>
                                                    <option value="weighted">weighted</option>
                                                    <option value="centroid">centroid</option>
                                                    <option value="median">median</option>
                                                    <option value="ward">ward</option>
                                                </b-select>
                                            </b-field>
                                            <b-field label="Distance Metric" label-position="on-border" class="mr-3">
                                                <b-select size="is-small" v-model="metric">
                                                    <option value="euclidean">euclidean</option>
                                                    <option value="correlation">correlation</option>
                                                    <option value="mahalanobis">mahalanobis</option>
                                                    <option value="cosine">cosine</option>
                                                </b-select>
                                            </b-field>
                                            <div class="loader-container" v-if="loading">
                                                <i class="fas fa-circle-notch fa-spin has-text-primary"></i>
                                            </div>
                                        </b-field>
                                    </div>
                                </div>
                                <div class="studio-quality-report__body pt-4">
                                    <div class="columns is-multiline is-centered mb-2 p-0 is-gapless correlation-charts">
                                        <div class="column is-6 px-3">
                                            <div class="health-chart-card" style="height: 100%;">
                                                <h5 class="title is-6 mb-2">Linear Correlation Matrix</h5>
                                                <div id="correlation_matrix" class="correlation-plot"></div>
                                            </div>
                                        </div>
                                        <div class="column is-6 px-3">
                                            <div class="health-chart-card" style="height: 100%;">
                                                <h5 class="title is-6 mb-2">Hierarchical Clustering (Dendrogram)</h5>
                                                <div id="correlation_matrix_ordered" class="correlation-plot"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="studio-quality-report" style="margin-top: 1.5rem;" v-if="settings.modelTarget">
                                <div class="studio-quality-report__head">
                                    <h2 class="studio-quality-report__title">
                                        <i class="fas fa-microscope" aria-hidden="true" style="color: #8b5cf6;"></i>
                                        Feature Significance Tests
                                        <b-tooltip append-to-body label="Significance codes: ★ &lt; 0.05, ★★ &lt; 0.01, ★★★ &lt; 0.001" multilined type="is-dark" position="is-right">
                                            <i class="fas fa-info-circle has-text-grey-light is-size-6 ml-2" style="cursor:help;"></i>
                                        </b-tooltip>
                                    </h2>
                                    <p class="studio-quality-report__subtitle">Statistical significance against target variable (<span class="has-text-weight-bold">{{ settings.modelTarget }}</span>).</p>
                                </div>
                                <div class="studio-quality-report__body pt-4">
                                    <b-table 
                                        :data="significanceResults" 
                                        :loading="loadingSignificance"
                                        striped hoverable narrow
                                        class="is-size-7"
                                        v-if="significanceResults && significanceResults.length">
                                        <b-table-column field="feature" label="Feature" v-slot="props" sortable>
                                            {{ props.row.feature }}
                                        </b-table-column>
                                        <b-table-column field="test" label="Statistical Test" v-slot="props" sortable>
                                            {{ props.row.test }}
                                        </b-table-column>
                                        <b-table-column field="statistic" label="Test Statistic" v-slot="props" numeric sortable>
                                            {{ props.row.statistic }}
                                        </b-table-column>
                                        <b-table-column field="p_value" label="p-value" v-slot="props" numeric sortable>
                                            {{ props.row.p_value_display }}
                                        </b-table-column>
                                        <b-table-column field="significance" label="Significance" v-slot="props" sortable class="has-text-weight-bold" style="color: #f59e0b;">
                                            {{ props.row.significance }}
                                        </b-table-column>
                                    </b-table>
                                    <div class="has-text-centered p-4" v-else-if="!loadingSignificance">
                                        <p>No valid features found for statistical testing against target.</p>
                                    </div>
                                </div>
                            </div>
                            <div class="studio-quality-report" style="margin-top: 1.5rem;" v-else>
                                <div class="has-text-centered p-4">
                                    <p class="has-text-grey"><i class="fas fa-bullseye mr-2"></i> Select a Target Variable in the sidebar to compute feature significance.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section v-else>
                        <b-message type="is-danger" has-icon icon-pack="fas">
                            <span class="my-auto">
                                Upload a dataset or select a sample from sidebar.

                            </span>
                        </b-message>
                    </section>

                </b-tab-item>

                <b-tab-item label="Dimensionality Reduction" icon="compress-arrows-alt" icon-pack="fas">
                    <dmensionality-reduction-component :dataframe="this.settings.df"
                        :columns="selectedFeatures"></dmensionality-reduction-component>
                </b-tab-item>
                <b-tab-item label="Model Training" icon="brain" icon-pack="fas">
                    <model-training-wizard
                        v-if="activeTab === 2"
                        @train-request="handleTrainRequest"
                        @go-to-results="settings.setActiveTab(3)"
                        @config-sync="$emit('wizard-config-sync', $event)"
                    ></model-training-wizard>
                </b-tab-item>
                <b-tab-item label="Results Analysis" icon="chart-pie" icon-pack="fas">
                    <results-component ref="results"></results-component>
                </b-tab-item>
                <b-tab-item label="Methods Details" icon="list" icon-pack="fas">

                    <DocumentationComponent v-if="activeTab == 4" />
                </b-tab-item>
                <b-tab-item label="Help" icon="question" icon-pack="fas">
                    <section class="assistant-help-landing">
                        <div>
                            <p class="assistant-help-landing__eyebrow">Gemma Help</p>
                            <h2>Ask the local ML assistant</h2>
                            <p>
                                Use the floating Gemma button to ask about datasets, feature selection,
                                model training, metrics, diagnostics, and next steps. Gemma runs directly
                                in your browser when WebGPU is available.
                            </p>
                        </div>
                    </section>
                </b-tab-item>
                <b-tab-item label="Messages Log" icon="history" icon-pack="fas">
                    <b-notification aria-close-label="Close notification" icon-pack="fas"
                        :type="m.type == 'warning' ? 'is-warning' : m.type == 'danger' ? 'is-danger' : 'is-info'"
                        has-icon :closable="false" v-for="(m, i) in messages" :key="i">
                        {{ m.message?.toLowerCase() }}
                        <br>
                        {{ m.date }}

                    </b-notification>
                </b-tab-item>
            </b-tabs>
        </section>
        <gemma-chat-widget />
    </div>
</template>

<script>
import SPLOMComponent from './visualization/scatterplot-matrix-component.vue'
import DatasetHealthComponent from './dataset-health-component.vue'

import { FeatureCategories } from '../helpers/settings'
import { ChartController } from '@/helpers/charts';
import { settingStore } from '@/stores/settings'
import { Matrix, correlation } from 'ml-matrix';
// eslint-disable-next-line no-unused-vars
import Clustermap from '@/helpers/correlation/correlation-matrix'
import FeatureSignificance from '@/helpers/correlation/feature-significance'
import { getDanfo, getPlotly } from '@/utils/danfo_loader';
import { mapState } from 'pinia';
import { renderDatasetStats } from '@/helpers/utils'
import { defineAsyncComponent } from 'vue'
export default {
    name: 'MainComponent',
    components: {
        'dmensionality-reduction-component': defineAsyncComponent(() => {
            return import('./tabs/dmensionality-reduction-componenet.vue')
        }),
        DocumentationComponent: defineAsyncComponent(() => {
            return import('./tabs/documentation-component.vue')
        }),
        'results-component': defineAsyncComponent(() => import('./tabs/results-component.vue')),
        'model-training-wizard': defineAsyncComponent(() => import('./tabs/model-training-wizard.vue')),
        'scatterplot-matrix-component': SPLOMComponent,
        'dataset-health-component': DatasetHealthComponent,
        'gemma-chat-widget': defineAsyncComponent(() => import('./assistant/gemma-chat-widget.vue')),
    },
    setup() {
        const settings = settingStore()
        return { settings }
    },
    props: {
        msg: String,
        selectedFeatures: [],
    },

    data() {
        return {
            featureTypeOptions: FeatureCategories,
            checkedRows: [],
            metric: 'euclidean',
            method: 'ward',
            img: null,
            continuousFeaturesStats: [
            ],
            continuousFeaturesColumns: [
            ],
            categoricalFeaturesStats: [
            ],
            categoricalFeaturesColumns: [
            ],
            sampleData: [
            ],
            datasetColumns: [
            ],

            isActive: true,
            hasCorrelationMatrix: false,
            loading: false,
            loadingSignificance: false,
            significanceResults: [],
            dataAnalysisSection: 'overview',
            dataAnalysisSubtabs: [
                { id: 'overview', label: 'Overview' },
                { id: 'features', label: 'Column profiles' },
                { id: 'correlations', label: 'Correlations' },
                { id: 'plots', label: 'Distributions' },
            ],
            // Column profiles redesign
            fpSearch: '',
            fpTypeFilter: 'all',
            fpTypeTabs: [
                { id: 'all', label: 'All' },
                { id: 'num', label: 'Numerical' },
                { id: 'cat', label: 'Categorical' },
            ],
        }
    },
    computed: {
        ...mapState(settingStore, ['messages']),
        activeTab: {
            get() {
                return this.settings.activeTab
            },
            set(value) {
                this.settings.setActiveTab(value)
            }
        },
        currentWorkspacePage() {
            const pages = [
                { title: 'Data Analysis', desc: 'Dataset health, feature types, correlations, and sample preview.' },
                { title: 'Dimensionality Reduction', desc: 'Reduce dimensionality with PCA and related views.' },
                { title: 'Model Training', desc: 'Configure algorithms, hyperparameters, and run training experiments.' },
                { title: 'Results & XAI', desc: 'Model outputs, comparisons, and explainability.' },
                { title: 'Methods Details', desc: 'Documentation and details for implemented methods.' },
                { title: 'Help', desc: 'How to use ML Studio and interpret results.' },
                { title: 'Messages Log', desc: 'Training runs and system messages.' },
            ]
            const i = Number(this.activeTab) || 0
            return pages[i] || pages[0]
        },
        datasetDisplayName() {
            const n = this.settings.getDatasetName || 'dataset'
            if (!n) return 'dataset.csv'
            if (/\.(csv|txt|xlsx)$/i.test(n)) return n
            return `${n}.csv`
        },
        fpTotalMissing() {
            const nMiss = this.continuousFeaturesStats.reduce((s, f) => s + (Number(f.missingValuesCount) || 0), 0);
            const cMiss = this.categoricalFeaturesStats.reduce((s, f) => s + (Number(f.missingValuesCount) || 0), 0);
            return nMiss + cMiss;
        },
        fpFilteredNumerical() {
            const q = (this.fpSearch || '').toLowerCase();
            return this.continuousFeaturesStats.filter(f => !q || f.name.toLowerCase().includes(q));
        },
        fpFilteredCategorical() {
            const q = (this.fpSearch || '').toLowerCase();
            return this.categoricalFeaturesStats.filter(f => !q || f.name.toLowerCase().includes(q));
        },
    },
    watch: {
        dataAnalysisSection(newVal) {
            this.$nextTick(() => {
                window.dispatchEvent(new Event('resize'));
                if (newVal === 'plots') {
                    this.$refs.splom?.scheduleVisibleLayoutSync?.();
                }
            })
            if (newVal === 'correlations' && !this.hasCorrelationMatrix && this.settings.datasetShape?.count > 0) {
                this.correlationMatrix();
                this.computeSignificance();
            }
        },
        method(newVal) {
            if (newVal === 'ward' && this.metric !== 'euclidean') {
                this.metric = 'euclidean';
                return;
            }
            if (this.settings.datasetShape?.count > 0) {
                this.correlationMatrix();
            }
        },
        metric(newVal) {
            if (this.method === 'ward' && newVal !== 'euclidean') {
                this.metric = 'euclidean';
                return;
            }
            if (this.settings.datasetShape?.count > 0) {
                this.correlationMatrix();
            }
        },
        'settings.modelTarget': function() {
            if (this.dataAnalysisSection === 'correlations' && this.settings.datasetShape?.count > 0) {
                this.computeSignificance();
            }
        },
        'settings.classificationTask': function() {
            if (this.dataAnalysisSection === 'correlations' && this.settings.datasetShape?.count > 0) {
                this.computeSignificance();
            }
        }
    },
    methods: {
        handleTrainRequest(config) {
            this.$emit('train-request', config)
        },

        resize() {
            window.dispatchEvent(new Event('resize'));
        },
        fpNumSparkline(histogram) {
            if (!histogram || !histogram.length) return '';
            const max = Math.max(...histogram, 1);
            const W = 80, H = 28, bw = W / histogram.length;
            return histogram.map((v, i) => {
                const bh = Math.max(1, (v / max) * H);
                const x = i * bw, y = H - bh;
                return `M${x.toFixed(1)},${H} L${x.toFixed(1)},${y.toFixed(1)} L${(x + bw - 0.5).toFixed(1)},${y.toFixed(1)} L${(x + bw - 0.5).toFixed(1)},${H} Z`;
            }).join(' ');
        },
        fpSkewLabel(skew) {
            const s = Number(skew);
            if (s > 1) return '↗ Right';
            if (s < -1) return '↙ Left';
            return '≈ Sym';
        },
        fpSkewClass(skew) {
            const s = Number(skew);
            if (s > 1) return 'fp-skew--right';
            if (s < -1) return 'fp-skew--left';
            return 'fp-skew--sym';
        },
        fpColTypeClass(col) {
            const isNum = this.continuousFeaturesStats.some(f => f.name === col);
            const isCat = this.categoricalFeaturesStats.some(f => f.name === col);
            if (isNum) return 'fp-th--num';
            if (isCat) return 'fp-th--cat';
            return '';
        },
        fpSelectAll(val) {
            this.continuousFeaturesStats.forEach(f => { f.selected = val; });
            this.categoricalFeaturesStats.forEach(f => { f.selected = val; });
        },
        scrollToUploadHint() {
            const el = document.querySelector('.dashboard-sidebar aside, aside.control-panel, .control-panel')
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        },
        exportDatasetCsv() {
            const rows = this.settings.rawData
            if (!rows?.length) return
            const keys = Object.keys(rows[0])
            const esc = (v) => {
                if (v == null) return ''
                const s = String(v)
                if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
                return s
            }
            const lines = [keys.join(',')]
            rows.forEach((r) => lines.push(keys.map((k) => esc(r[k])).join(',')))
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            const base = (this.settings.getDatasetName || 'export').replace(/\.(csv|txt)$/i, '')
            a.download = `${base}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(a.href)
        },
        async computeSignificance() {
            if (!this.settings.modelTarget) {
                this.significanceResults = [];
                return;
            }
            this.loadingSignificance = true;
            try {
                let fs = new FeatureSignificance();
                
                let selectedNumeric = this.settings.items.filter(m => m.selected && m.type === FeatureCategories.Numerical.id).map(m => m.name);
                let selectedCategorical = this.settings.items.filter(m => m.selected && m.type !== FeatureCategories.Numerical.id && m.name !== this.settings.modelTarget).map(m => m.name);
                
                let allColumns = [...selectedNumeric, ...selectedCategorical, this.settings.modelTarget];
                allColumns = [...new Set(allColumns)];

                if (allColumns.length <= 1) { 
                    this.significanceResults = [];
                    this.loadingSignificance = false;
                    return;
                }
                
                let values_df = this.settings.df.loc({ columns: allColumns });
                let X_data = JSON.parse(JSON.stringify(values_df.values));
                let y_data = JSON.parse(JSON.stringify(this.settings.df[this.settings.modelTarget].values));
                
                let results = await fs.compute(
                    X_data, 
                    y_data, 
                    JSON.parse(JSON.stringify(allColumns)), 
                    JSON.parse(JSON.stringify(selectedNumeric.filter(c => c !== this.settings.modelTarget))), 
                    JSON.parse(JSON.stringify(selectedCategorical)), 
                    this.settings.classificationTask
                );
                this.significanceResults = results || [];
            } catch (err) {
                console.error("Significance error", err);
                this.significanceResults = [{"feature": "Vue Try/Catch Error", "test": "N/A", "statistic": "0", "p_value_display": String(err), "significance": "ERROR"}];
            } finally {
                this.loadingSignificance = false;
            }
        },
        async correlationMatrix() {
            this.loading = true;
            if (this.settings.modelTarget) {
                this.computeSignificance();
            }
            await getPlotly()
            let chartController = new ChartController(null, null)

            try {
                let numericColumns = this.settings.items.filter(m => m.selected && m.type === FeatureCategories.Numerical.id).map(m => m.name);
                let values = this.settings.df.loc({ columns: numericColumns })
                values = values.dropNa({ axis: 1 }).values
                let matrix = new Matrix(values)
                let correlations = correlation(matrix)
                this.hasCorrelationMatrix = true;
                await chartController.correlationHeatmap('correlation_matrix', correlations.data, numericColumns);
                let mtx = new Clustermap();
                let [dendogram, orderedMatrix, columns] = await mtx.train(values, numericColumns, this.metric, this.method);
                await chartController.dendogramPlot('correlation_matrix_ordered', orderedMatrix, dendogram, columns, numericColumns);
                this.loading = false;
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                }, 500);
            } catch (error) {
                this.loading = false;
                throw error
            }
        },
        applyChanges() {
            this.renderStats(true)
        },
        async renderStats(update = false) {
            if (this.settings.df?.columns?.length > 0) {
                let numericColumns, categoricalColumns;
                if (!update) {
                    numericColumns = this.settings.items.filter(m => m?.type === FeatureCategories.Numerical.id).map(function (m) {
                        return {
                            name: m.name,
                            selected: true
                        }
                    });
                    categoricalColumns = this.settings.items.filter(m => m?.type !== FeatureCategories.Numerical.id).map(function (m) {
                        return {
                            name: m.name,
                            selected: true
                        }
                    });
                } else {
                    console.log(this.continuousFeaturesStats);
                    let features = this.continuousFeaturesStats.concat(this.categoricalFeaturesStats)
                    numericColumns = features.filter(m => m?.type === FeatureCategories.Numerical.id).map(function (m) {
                        return {
                            name: m.name,
                            selected: m.selected,
                            scaler: m.sclaer ?? 0
                        }
                    });
                    categoricalColumns = features.filter(m => m?.type
                        === FeatureCategories.Nominal.id
                        || m?.type === FeatureCategories.Ordinal.id).map(function (m) {
                            return {
                                name: m.name,
                                selected: m.selected
                            }
                        });

                    let selectedFeatures = features;
                    for (const element of selectedFeatures) {
                        this.settings.addFeature(element)
                    }
                    this.$emit('check-target')

                }

                const danfo = await getDanfo()
                let df = new danfo.DataFrame(this.settings.rawData);
                let datasetStats = renderDatasetStats(df, numericColumns, categoricalColumns);
                this.continuousFeaturesColumns = datasetStats[0];
                this.continuousFeaturesStats = datasetStats[1];
                this.categoricalFeaturesColumns = datasetStats[2];
                this.categoricalFeaturesStats = datasetStats[3];
                this.datasetColumns = this.settings.df.columns.map(column => {
                    return {
                        field: column,
                        label: column

                    }
                });
                this.sampleData = danfo.toJSON(this.settings.df.head(5));
                this.$refs.splom?.initSPLOM();
                setTimeout(() => {
                    this.correlationMatrix();
                    this.computeSignificance();
                }, 500);
            }
        },
    },

}
</script>

<style scoped>
.studio-quality-report {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem 1.25rem 0.75rem;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06);
}

.studio-quality-report__head {
    margin-bottom: 1rem;
}

.studio-quality-report__title {
    font-size: 1.15rem;
    font-weight: 800;
    margin: 0 0 0.35rem 0;
    color: #0f172a !important;
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.studio-quality-report__title i.fa-project-diagram {
    color: #10b981;
}

.studio-quality-report__subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: #64748b !important;
    line-height: 1.4;
}

.studio-quality-report__body {
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
    margin-top: 0.5rem;
}

.health-chart-card {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #d7e5df;
    border-radius: 12px;
    padding: 1rem 1rem 0.5rem;
}

.health-chart-card .title {
    color: #102b24 !important;
}

.correlation-plot {
    height: 480px;
    width: 100%;
}

.loader-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    font-size: 1.25rem;
    margin-left: 0.5rem;
}

.correlation-head-flex {
    gap: 1.5rem;
}

.correlation-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.45rem;
}

.correlation-charts {
    overflow: hidden;
}

#correlation_matrix,
#correlation_matrix_ordered {
    min-width: 0;
}

/* ══════════════════════════════════════
   Column Profiles Redesign (fp = feature-profiles)
══════════════════════════════════════ */
.fp-root {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding: 0.1rem 0;
}

/* Summary bar */
.fp-summary-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.55rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 0.7rem 1rem;
}
.fp-summary-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    letter-spacing: 0.01em;
}
.fp-summary-pill small { font-weight: 400; font-size: 0.75rem; margin-left: 0.15rem; }
.fp-summary-pill i { font-size: 0.8rem; }
.fp-pill--blue  { background: #eff6ff; color: #1d4ed8; }
.fp-pill--green { background: #f0fdf4; color: #166534; }
.fp-pill--purple{ background: #faf5ff; color: #7c3aed; }
.fp-pill--orange{ background: #fff7ed; color: #c2410c; }
.fp-pill--red   { background: #fef2f2; color: #b91c1c; }
.fp-pill--grey  { background: #f1f5f9; color: #64748b; }
.fp-summary-actions { margin-left: auto; }

/* Toolbar */
.fp-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.65rem;
}
.fp-search-wrap {
    position: relative;
    flex: 1 1 200px;
    max-width: 320px;
}
.fp-search-icon {
    position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%);
    color: #94a3b8; font-size: 0.8rem; pointer-events: none;
}
.fp-search {
    width: 100%;
    padding: 0.38rem 2rem 0.38rem 2rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.83rem;
    outline: none;
    transition: border-color 0.2s;
    background: #fff;
}
.fp-search:focus { border-color: #3b82f6; }
.fp-search-clear {
    position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 0.85rem;
}
.fp-type-tabs {
    display: flex;
    gap: 0;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
}
.fp-type-tab {
    padding: 0.35rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    background: #fff;
    border: none;
    cursor: pointer;
    color: #64748b;
    transition: background 0.15s, color 0.15s;
    border-right: 1px solid #e2e8f0;
}
.fp-type-tab:last-child { border-right: none; }
.fp-type-tab.is-active { background: #3b82f6; color: #fff; }
.fp-bulk-btns { display: flex; gap: 0.4rem; }

/* Shared buttons */
.fp-btn {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.35rem 0.85rem; border-radius: 8px; font-size: 0.8rem;
    font-weight: 600; cursor: pointer; border: none; transition: background 0.15s;
}
.fp-btn--primary { background: #10b981; color: #fff; }
.fp-btn--primary:hover { background: #059669; }
.fp-btn--ghost { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
.fp-btn--ghost:hover { background: #e2e8f0; }

/* Section headings */
.fp-section { display: flex; flex-direction: column; gap: 0.75rem; }
.fp-section-head {
    display: flex;
    align-items: center;
    gap: 0.55rem;
}
.fp-section-badge {
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
}
.fp-badge--num  { background: #eff6ff; color: #2563eb; }
.fp-badge--cat  { background: #fff7ed; color: #ea580c; }
.fp-badge--grey { background: #f1f5f9; color: #475569; }
.fp-section-title {
    font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;
}
.fp-count-chip {
    background: #f1f5f9; color: #475569; border-radius: 999px;
    font-size: 0.75rem; font-weight: 700; padding: 0.1rem 0.55rem;
}
.fp-cat-note {
    margin-left: auto; font-size: 0.75rem; color: #94a3b8; font-style: italic;
}

/* Cards grid */
.fp-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 0.85rem;
}

/* Individual card */
.fp-card {
    background: #fff;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    padding: 0.85rem 0.85rem 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: box-shadow 0.2s, border-color 0.2s;
}
.fp-card:hover { box-shadow: 0 6px 22px rgba(15,23,42,0.09); border-color: #cbd5e1; }
.fp-card--num { border-top: 3px solid #3b82f6; }
.fp-card--cat { border-top: 3px solid #f59e0b; }
.fp-card--deselected { opacity: 0.55; }
.fp-card--high-missing { border-left: 3px solid #ef4444; }

/* Card header */
.fp-card__header {
    display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;
}
.fp-card__name-wrap {
    display: flex; align-items: center; gap: 0.45rem; cursor: pointer; min-width: 0;
}
.fp-checkbox { accent-color: #3b82f6; width: 14px; height: 14px; flex-shrink: 0; cursor: pointer; }
.fp-card__name {
    font-size: 0.85rem; font-weight: 700; color: #1e293b;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Skewness badge */
.fp-skew-badge {
    font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem;
    border-radius: 999px; white-space: nowrap; flex-shrink: 0;
}
.fp-skew--right { background: #fff7ed; color: #c2410c; }
.fp-skew--left  { background: #f0f9ff; color: #0369a1; }
.fp-skew--sym   { background: #f0fdf4; color: #166534; }

/* Unique badge */
.fp-unique-badge {
    font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem;
    border-radius: 999px; background: #fff7ed; color: #c2410c; flex-shrink: 0;
}

/* Sparkline */
.fp-sparkline-wrap {
    background: #f8fafc;
    border-radius: 6px;
    padding: 0.25rem 0.3rem 0.1rem;
    overflow: hidden;
}
.fp-sparkline {
    width: 100%; height: 28px; display: block;
}
.fp-spark-path {
    fill: #3b82f6;
    opacity: 0.75;
}
.fp-card--cat .fp-spark-path { fill: #f59e0b; }

/* Stats grid */
.fp-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem 0.35rem;
}
.fp-stat {
    display: flex; flex-direction: column; align-items: center;
    background: #f8fafc; border-radius: 6px; padding: 0.2rem 0.3rem;
}
.fp-stat__label { font-size: 0.62rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
.fp-stat__val   { font-size: 0.78rem; font-weight: 700; color: #1e293b; }
.fp-ellipsis { max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Quartile row */
.fp-quartiles {
    display: flex; align-items: center; gap: 0.3rem;
    background: #f1f5f9; border-radius: 6px; padding: 0.22rem 0.45rem;
    font-size: 0.72rem;
}
.fp-q-label { color: #64748b; font-weight: 600; }
.fp-q-val   { color: #1e293b; font-weight: 700; }
.fp-q-sep   { flex: 1; height: 1px; background: #cbd5e1; }

/* Missing bar */
.fp-missing-row {
    display: flex; align-items: center; gap: 0.45rem; font-size: 0.72rem;
}
.fp-missing-label { color: #94a3b8; font-size: 0.68rem; flex-shrink: 0; min-width: 44px; }
.fp-missing-bar-wrap {
    flex: 1; height: 5px; background: #e2e8f0; border-radius: 999px; overflow: hidden;
}
.fp-missing-bar {
    height: 100%; border-radius: 999px; min-width: 0; transition: width 0.3s;
}
.fp-missing-bar--low  { background: #22c55e; }
.fp-missing-bar--high { background: #ef4444; }
.fp-missing-count { font-weight: 700; color: #475569; min-width: 18px; text-align: right; }

/* Type select */
.fp-type-row { margin-top: 0.1rem; }
.fp-type-select {
    width: 100%; font-size: 0.75rem; border: 1.5px solid #e2e8f0;
    border-radius: 6px; padding: 0.25rem 0.4rem;
    background: #f8fafc; color: #334155; cursor: pointer; outline: none;
}
.fp-type-select:focus { border-color: #3b82f6; }

/* Categorical top values */
.fp-topvals { display: flex; flex-direction: column; gap: 0.28rem; }
.fp-topval-row { display: flex; align-items: center; gap: 0.4rem; }
.fp-topval-label { font-size: 0.7rem; color: #475569; min-width: 58px; max-width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.fp-topval-bar-wrap { flex: 1; height: 7px; background: #fef3c7; border-radius: 999px; overflow: hidden; }
.fp-topval-bar { height: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); border-radius: 999px; transition: width 0.3s; min-width: 1px; }
.fp-topval-pct { font-size: 0.68rem; font-weight: 700; color: #92400e; min-width: 28px; text-align: right; }

/* Categorical stats */
.fp-cat-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem; }

/* Empty state */
.fp-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 2.5rem; color: #94a3b8; text-align: center;
    background: #f8fafc; border-radius: 14px; border: 1.5px dashed #e2e8f0;
}

/* Sample data panel */
.fp-sample-panel {
    display: flex; flex-direction: column; gap: 0.7rem;
    background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px;
    padding: 0.85rem;
}
.fp-sample-scroll { overflow-x: auto; }
.fp-sample-table {
    width: 100%; border-collapse: collapse; font-size: 0.78rem;
}
.fp-sample-table th, .fp-sample-table td {
    padding: 0.4rem 0.7rem;
    text-align: left;
    white-space: nowrap;
}
.fp-sample-table th {
    font-weight: 700; font-size: 0.72rem; text-transform: uppercase;
    letter-spacing: 0.04em; border-bottom: 2px solid #e2e8f0;
    position: sticky; top: 0; background: #fff;
}
.fp-sample-table tr:nth-child(even) td { background: #f8fafc; }
.fp-sample-table tr:hover td { background: #eff6ff; }
.fp-th--num { color: #2563eb; border-bottom-color: #93c5fd !important; }
.fp-th--cat { color: #ea580c; border-bottom-color: #fcd34d !important; }

.assistant-help-landing {
    display: grid;
    place-items: center;
    min-height: 360px;
    margin: 1rem;
    padding: 2rem;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 24px;
    background:
        radial-gradient(circle at top left, rgba(79, 70, 229, 0.12), transparent 34%),
        linear-gradient(135deg, #f8fafc, #eef2ff);
    text-align: center;
}

.assistant-help-landing__eyebrow {
    margin: 0 0 0.45rem;
    color: #4f46e5;
    font-size: 0.75rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.assistant-help-landing h2 {
    margin: 0 0 0.75rem;
    color: #0f172a;
    font-size: clamp(1.4rem, 3vw, 2.2rem);
    font-weight: 900;
}

.assistant-help-landing p:not(.assistant-help-landing__eyebrow) {
    max-width: 680px;
    margin: 0 auto;
    color: #475569;
    line-height: 1.7;
}
</style>
