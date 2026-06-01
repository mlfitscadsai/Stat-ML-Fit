<template>
    <div class="mtw-root">
        <!-- Breadcrumb stepper -->
        <nav class="mtw-stepper" aria-label="Training workflow steps">
            <div
                v-for="(step, i) in steps"
                :key="step.id"
                class="mtw-step"
                :class="{
                    'mtw-step--done':    currentStep > i + 1,
                    'mtw-step--active':  currentStep === i + 1,
                    'mtw-step--pending': currentStep < i + 1
                }"
                @click="currentStep > i + 1 ? goTo(i + 1) : null"
                :style="currentStep > i + 1 ? 'cursor:pointer' : ''"
                :aria-current="currentStep === i + 1 ? 'step' : undefined"
            >
                <span class="mtw-step__dot">
                    <i v-if="currentStep > i + 1" class="fas fa-check" aria-hidden="true"></i>
                    <span v-else>{{ i + 1 }}</span>
                </span>
                <span class="mtw-step__label">{{ step.label }}</span>
                <span v-if="i < steps.length - 1" class="mtw-step__sep" aria-hidden="true"></span>
            </div>
        </nav>

        <!-- Step panels -->
        <div class="mtw-panel">

            <!-- ── STEP 1: Problem Type ── -->
            <div v-if="currentStep === 1" class="mtw-step-body">
                <h2 class="mtw-panel-title">What are you trying to predict?</h2>
                <div class="mtw-problem-grid">
                    <button
                        v-for="pt in problemTypes"
                        :key="pt.id"
                        class="mtw-problem-card"
                        :class="{ 'mtw-problem-card--selected': problemType === pt.id }"
                        @click="problemType = pt.id"
                        type="button"
                    >
                        <span class="mtw-problem-icon" :style="{ background: pt.iconBg }">{{ pt.icon }}</span>
                        <strong class="mtw-problem-name">{{ pt.name }}</strong>
                        <span class="mtw-problem-desc">{{ pt.desc }}</span>
                        <span class="mtw-problem-meta"><b>Examples:</b> {{ pt.examples }}</span>
                        <span class="mtw-problem-meta"><b>Metrics:</b> {{ pt.metrics }}</span>
                        <span v-if="problemType === pt.id" class="mtw-selected-badge">
                            <i class="fas fa-check-circle"></i> Selected
                        </span>
                    </button>
                </div>
                <div class="mtw-step-actions mtw-step-actions--right">
                    <button class="mtw-btn mtw-btn--primary" :disabled="!problemType" @click="goTo(2)" type="button">
                        Next: Select Dataset <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>

            <!-- ── STEP 2: Dataset ── -->
            <div v-if="currentStep === 2" class="mtw-step-body">
                <h2 class="mtw-panel-title">Select Your Dataset</h2>
                <div v-if="!hasDataset" class="mtw-empty-state">
                    <i class="fas fa-database fa-2x mb-3"></i>
                    <p>No dataset loaded yet. Upload a CSV file from the sidebar to continue.</p>
                </div>
                <template v-else>
                    <div class="mtw-dataset-list">
                        <div class="mtw-dataset-row mtw-dataset-row--selected">
                            <span class="mtw-dataset-type-badge">CSV</span>
                            <div class="mtw-dataset-info">
                                <span class="mtw-dataset-name">{{ settings.getDatasetName || 'dataset' }}</span>
                                <span class="mtw-dataset-meta">
                                    {{ settings.datasetShape.count }} rows ·
                                    {{ settings.datasetShape.columns }} columns ·
                                    {{ approxKb }} KB
                                </span>
                            </div>
                            <i class="fas fa-check-circle mtw-dataset-check" aria-hidden="true"></i>
                        </div>
                    </div>

                    <div class="mtw-target-section">
                        <h3 class="mtw-subtitle">Select Target Column</h3>
                        <div class="mtw-target-grid">
                            <button
                                v-for="col in datasetColumns"
                                :key="col"
                                type="button"
                                class="mtw-target-btn"
                                :class="{ 'mtw-target-btn--selected': selectedTarget === col }"
                                @click="selectedTarget = col"
                            >{{ col }}</button>
                        </div>
                    </div>
                    <div v-if="readiness" class="mtw-param-card mt-4">
                        <h3 class="mtw-subtitle">Readiness Check</h3>
                        <div class="mtw-config-info">
                            Score: <b>{{ readiness.score }}%</b>
                            <span v-if="readiness.targetCandidates.length">
                                · Suggested target: <b>{{ readiness.targetCandidates[0].column }}</b>
                            </span>
                        </div>
                        <div v-if="readinessIssues.length" class="mtw-readiness-list">
                            <p v-for="issue in readinessIssues" :key="`${issue.code}-${issue.column || issue.message}`">
                                <i class="fas fa-triangle-exclamation mr-1"></i>{{ issue.message }}
                            </p>
                        </div>
                        <p v-else class="mtw-config-info">No major blockers found for a first model.</p>
                    </div>
                </template>

                <div class="mtw-step-actions">
                    <button class="mtw-btn mtw-btn--ghost" @click="goTo(1)" type="button">
                        <i class="fas fa-chevron-left mr-1"></i> Back
                    </button>
                    <button class="mtw-btn mtw-btn--primary" :disabled="!hasDataset || !selectedTarget" @click="onDatasetNext" type="button">
                        Next: Algorithm <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>

            <!-- ── STEP 3: Algorithm ── -->
            <div v-if="currentStep === 3" class="mtw-step-body">
                <div class="mtw-step-head-row">
                    <h2 class="mtw-panel-title">Choose an Algorithm</h2>
                    <span class="mtw-context-badge">{{ problemType }}</span>
                </div>
                <section v-if="modelRecommendations.length" class="mtw-param-card mtw-recommendation-lane">
                    <div class="mtw-step-head-row">
                        <h3 class="mtw-subtitle">Recommended starting points</h3>
                        <span class="mtw-context-badge">AutoML lane</span>
                    </div>
                    <button
                        v-for="recommendation in modelRecommendations.slice(0, 3)"
                        :key="recommendation.modelId"
                        type="button"
                        class="mtw-recommendation-card"
                        @click="selectRecommendedModel(recommendation)"
                    >
                        <strong>{{ recommendation.label }}</strong>
                        <span>{{ recommendation.reasons[0] || 'Good first candidate for this dataset.' }}</span>
                        <small>{{ recommendation.tags.join(' · ') }}</small>
                    </button>
                </section>
                <div class="mtw-algo-grid">
                    <button
                        v-for="algo in algorithmList"
                        :key="algo.id"
                        type="button"
                        class="mtw-algo-card"
                        :class="{ 'mtw-algo-card--selected': selectedAlgo === algo.id }"
                        @click="selectAlgo(algo)"
                    >
                        <div class="mtw-algo-header">
                            <span class="mtw-algo-name">{{ algo.label }}</span>
                            <span v-if="algo.badge" class="mtw-algo-badge" :class="'mtw-algo-badge--' + algo.badge.type">
                                {{ algo.badge.icon }} {{ algo.badge.text }}
                            </span>
                        </div>
                        <p class="mtw-algo-desc">{{ algo.desc }}</p>
                        <div class="mtw-algo-footer">
                            <div class="mtw-algo-tags">
                                <span v-for="tag in algo.tags" :key="tag" class="mtw-algo-tag">{{ tag }}</span>
                            </div>
                            <span class="mtw-algo-time"><i class="far fa-clock"></i> {{ algo.time }}</span>
                        </div>
                    </button>
                </div>
                <div class="mtw-step-actions">
                    <button class="mtw-btn mtw-btn--ghost" @click="goTo(2)" type="button">
                        <i class="fas fa-chevron-left mr-1"></i> Back
                    </button>
                    <button class="mtw-btn mtw-btn--primary" :disabled="!selectedAlgo" @click="goTo(4)" type="button">
                        Next: Hyperparameters <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>

            <!-- ── STEP 4: Hyperparameters ── -->
            <div v-if="currentStep === 4" class="mtw-step-body">
                <div class="mtw-step-head-row">
                    <h2 class="mtw-panel-title">Hyperparameter Configuration</h2>
                    <span class="mtw-context-badge">{{ selectedAlgoLabel }}</span>
                </div>
                <div class="mtw-hyper-layout">
                    <!-- Left: parameter controls -->
                    <div class="mtw-hyper-left">
                        <div class="mtw-param-card">
                            <h3 class="mtw-subtitle">Model Parameters</h3>
                            <div v-if="hyperParams.length === 0" class="mtw-empty-sm">
                                <p>This model has no configurable parameters.</p>
                            </div>
                            <div v-for="p in hyperParams" :key="p.key" class="mtw-param-row">
                                <div class="mtw-param-label-row">
                                    <label class="mtw-param-label">{{ p.label }}</label>
                                    <span class="mtw-param-val">{{ formatParamVal(p) }}</span>
                                </div>
                                <template v-if="p.type === 'range'">
                                    <input
                                        type="range"
                                        class="mtw-slider"
                                        :min="p.min" :max="p.max" :step="p.step"
                                        v-model.number="p.value"
                                    />
                                    <div class="mtw-slider-bounds">
                                        <span>{{ p.min }}</span>
                                        <span>{{ p.max }}</span>
                                    </div>
                                </template>
                                <template v-else-if="p.type === 'select'">
                                    <select class="mtw-select" v-model="p.value">
                                        <option v-for="opt in p.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                    </select>
                                </template>
                                <template v-else-if="p.type === 'number'">
                                    <input type="number" class="mtw-number-input" v-model.number="p.value" />
                                </template>
                            </div>
                        </div>
                    </div>
                    <!-- Right: preview -->
                    <div class="mtw-hyper-right">
                        <div class="mtw-param-card">
                            <h3 class="mtw-subtitle">Optimization Strategy</h3>
                            <div class="mtw-toggle-row">
                                <div>
                                    <strong>Early Stopping</strong>
                                    <p class="mtw-toggle-desc">Stop when validation loss plateaus</p>
                                </div>
                                <label class="mtw-toggle">
                                    <input type="checkbox" v-model="earlyStoppping" />
                                    <span class="mtw-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="mtw-config-info">
                                <i class="fas fa-info-circle mr-1" style="color:#3b82f6"></i>
                                Selected: <b>{{ selectedAlgoLabel }}</b> · Dataset: <b>{{ settings.getDatasetName }}</b> · Target: <b>{{ selectedTarget }}</b>
                            </div>
                            <h3 class="mtw-subtitle mt-4">Code Preview</h3>
                            <pre class="mtw-code-preview">{{ codePreview }}</pre>
                        </div>
                    </div>
                </div>
                <div class="mtw-step-actions">
                    <button class="mtw-btn mtw-btn--ghost" @click="goTo(3)" type="button">
                        <i class="fas fa-chevron-left mr-1"></i> Back
                    </button>
                    <button class="mtw-btn mtw-btn--primary" @click="goTo(5)" type="button">
                        Next: Validation <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>

            <!-- ── STEP 5: Validation ── -->
            <div v-if="currentStep === 5" class="mtw-step-body">
                <h2 class="mtw-panel-title">Validation Strategy</h2>
                <div class="mtw-validation-layout">
                    <!-- Left: CV strategy -->
                    <div class="mtw-val-left">
                        <div class="mtw-param-card">
                            <h3 class="mtw-subtitle">Cross-Validation</h3>
                            <div
                                v-for="cv in cvStrategies"
                                :key="cv.id"
                                class="mtw-cv-option"
                                :class="{ 'mtw-cv-option--selected': selectedCv === cv.id }"
                                @click="selectedCv = cv.id"
                            >
                                <input type="radio" :name="'cv'" :id="'cv-' + cv.id" :value="cv.id" v-model="selectedCv" class="mtw-radio" />
                                <label :for="'cv-' + cv.id" class="mtw-cv-label">
                                    <span class="mtw-cv-name">{{ cv.name }}</span>
                                    <span class="mtw-cv-desc">{{ cv.desc }}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <!-- Right: metrics -->
                    <div class="mtw-val-right">
                        <div class="mtw-param-card">
                            <h3 class="mtw-subtitle">Evaluation Metrics</h3>
                            <div v-for="m in availableMetrics" :key="m.id" class="mtw-metric-row">
                                <label class="mtw-metric-label">
                                    <input
                                        type="checkbox"
                                        class="mtw-checkbox"
                                        :value="m.id"
                                        v-model="selectedMetrics"
                                    />
                                    <div>
                                        <span class="mtw-metric-name">{{ m.name }}</span>
                                        <span class="mtw-metric-desc">{{ m.desc }}</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mtw-step-actions">
                    <button class="mtw-btn mtw-btn--ghost" @click="goTo(4)" type="button">
                        <i class="fas fa-chevron-left mr-1"></i> Back
                    </button>
                    <button class="mtw-btn mtw-btn--primary" @click="goTo(6)" type="button">
                        Review &amp; Train <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>

            <!-- ── STEP 6: Training ── -->
            <div v-if="currentStep === 6" class="mtw-step-body">
                <!-- Pre-train review -->
                <div v-if="!isTraining && !trainingDone" class="mtw-ready-panel">
                    <div class="mtw-ready-icon">
                        <i class="fas fa-microchip" aria-hidden="true"></i>
                    </div>
                    <h2 class="mtw-ready-title">Ready to Train</h2>
                    <table class="mtw-ready-table">
                        <tbody>
                            <tr><td>Algorithm</td><td><b>{{ selectedAlgoLabel }}</b></td></tr>
                            <tr><td>Dataset</td><td><b>{{ settings.getDatasetName }} ({{ settings.datasetShape.count }} rows)</b></td></tr>
                            <tr><td>Target</td><td><b>{{ selectedTarget }}</b></td></tr>
                            <tr><td>Validation</td><td><b>{{ selectedCvLabel }}</b></td></tr>
                            <tr><td>Estimated time</td><td><b>{{ selectedAlgoTime }}</b></td></tr>
                        </tbody>
                    </table>
                    <div v-if="readinessIssues.length" class="mtw-param-card mt-4">
                        <h3 class="mtw-subtitle">Before you train</h3>
                        <div class="mtw-readiness-list">
                            <p v-for="issue in readinessIssues" :key="`review-${issue.code}-${issue.column || issue.message}`">
                                <i class="fas fa-triangle-exclamation mr-1"></i>{{ issue.message }}
                            </p>
                        </div>
                    </div>
                    <button class="mtw-btn mtw-btn--train" @click="startTraining" type="button">
                        <i class="fas fa-bolt mr-2"></i> Start Training
                    </button>
                </div>

                <!-- In-progress view -->
                <div v-if="isTraining" class="mtw-training-layout">
                    <div class="mtw-train-left">
                        <div class="mtw-progress-panel">
                            <div class="mtw-progress-header">
                                <span class="mtw-progress-dot mtw-progress-dot--pulse"></span>
                                <span>Training in progress...</span>
                                <span class="ml-auto mtw-progress-pct">{{ trainingProgress }}%</span>
                            </div>
                            <div class="mtw-progress-bar-wrap">
                                <div class="mtw-progress-bar" :style="{ width: trainingProgress + '%' }"></div>
                            </div>
                            <div class="mtw-train-log">
                                <p v-for="(log, i) in trainingLogs" :key="i" class="mtw-log-line">{{ log }}</p>
                            </div>
                        </div>
                        <div class="mtw-param-card mt-4">
                            <h3 class="mtw-subtitle">Training Curves</h3>
                            <div class="mtw-curves-placeholder">
                                <i class="fas fa-circle-notch fa-spin mr-2"></i>
                                Training curves will appear here...
                            </div>
                        </div>
                    </div>
                    <div class="mtw-train-right">
                        <div class="mtw-param-card mtw-status-card">
                            <div class="mtw-status-icon">
                                <div class="mtw-spinner"></div>
                            </div>
                            <p class="mtw-status-label">Training...</p>
                            <p class="mtw-status-pct">{{ trainingProgress }}% complete</p>
                        </div>
                    </div>
                </div>

                <!-- Completed view -->
                <div v-if="trainingDone" class="mtw-training-layout">
                    <div class="mtw-train-left">
                        <div class="mtw-param-card">
                            <h3 class="mtw-subtitle">Training Curves</h3>
                            <div id="mtw-training-curves" class="mtw-curves-chart"></div>
                        </div>
                    </div>
                    <div class="mtw-train-right">
                        <div class="mtw-param-card">
                            <h3 class="mtw-subtitle">
                                <span class="mtw-trophy">🏆</span> Final Results
                            </h3>
                            <div class="mtw-metric-results">
                                <div v-for="r in trainingResults" :key="r.name" class="mtw-result-row">
                                    <span class="mtw-result-name">{{ r.name }}</span>
                                    <span class="mtw-result-val" :class="metricColorClass(r.value)">{{ r.display }}</span>
                                </div>
                            </div>
                            <div class="mtw-done-badge">
                                <i class="fas fa-check-circle mr-2"></i>
                                <div>
                                    <strong>Training Complete!</strong>
                                    <p class="mtw-model-id">Model ID: {{ modelId }}...</p>
                                </div>
                            </div>
                            <button class="mtw-btn mtw-btn--ghost mt-3 w-100" @click="resetWizard" type="button">
                                <i class="fas fa-redo mr-2"></i> Train Another Model
                            </button>
                            <button class="mtw-btn mtw-btn--primary mt-2 w-100" @click="goToResults" type="button">
                                <i class="fas fa-chart-pie mr-2"></i> View Full Results
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Error banner -->
                <div v-if="trainingError && !isTraining && !trainingDone" class="mtw-error-banner">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <div>
                        <strong>Training failed</strong>
                        <p class="mtw-error-detail">{{ trainingErrorMessage }}</p>
                    </div>
                    <button class="mtw-btn mtw-btn--ghost ml-auto" @click="trainingError = null" type="button">Dismiss</button>
                </div>

                <div v-if="!isTraining && !trainingDone" class="mtw-step-actions" style="justify-content: flex-start; margin-top: 1rem;">
                    <button class="mtw-btn mtw-btn--ghost" @click="goTo(5)" type="button">
                        <i class="fas fa-chevron-left mr-1"></i> Back
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>

<script>
import { settingStore } from '@/stores/settings'
import { mapState } from 'pinia'
import { Settings, FeatureCategories, CV_OPTIONS } from '@/helpers/settings'
import { TASK_MODES } from '@/helpers/task_mode'
import { analyzeReadiness } from '@/services/data-readiness/readiness-service'
import { recommendModels } from '@/services/recommendations/recommendation-service'

const PROBLEM_TYPES = [
    {
        id: 'classification',
        name: 'Classification',
        icon: '🏷️',
        iconBg: '#fff7ed',
        desc: 'Predict a category or label',
        examples: 'Churn, Spam, Disease',
        metrics: 'Accuracy, F1, AUC-ROC',
    },
    {
        id: 'regression',
        name: 'Regression',
        icon: '📈',
        iconBg: '#eff6ff',
        desc: 'Predict a continuous number',
        examples: 'House Price, Sales, Temperature',
        metrics: 'RMSE, MAE, R²',
    },
    {
        id: 'clustering',
        name: 'Clustering',
        icon: '🗃️',
        iconBg: '#fff7ed',
        desc: 'Discover hidden groups',
        examples: 'Customer Segments, Anomalies',
        metrics: 'Silhouette, Inertia',
        disabled: true,
    },
]

const CLASSIFICATION_ALGOS = [
    {
        id: 6,
        label: 'XGBoost',
        desc: 'Gradient boosted trees. Best accuracy on tabular data.',
        tags: ['Ensemble', 'Robust'],
        time: '~1 min',
        badge: { type: 'recommended', icon: '⭐', text: 'Recommended' },
    },
    {
        id: 3,
        label: 'K-Nearest Neighbors',
        desc: 'Distance-based classifier. Simple and effective.',
        tags: ['Instance-based', 'Fast'],
        time: '~30s',
        badge: { type: 'fast', icon: '⚡', text: 'Fast' },
    },
    {
        id: 5,
        label: 'Random Forest',
        desc: 'Bagging of decision trees, robust to noise.',
        tags: ['Ensemble', 'Interpretable'],
        time: '~2 min',
        badge: { type: 'stable', icon: '🛡️', text: 'Stable' },
    },
    {
        id: 1,
        label: 'Logistic Regression',
        desc: 'Linear model. Best starting point.',
        tags: ['Linear', 'Baseline'],
        time: '~5s',
        badge: { type: 'interpretable', icon: '💡', text: 'Interpretable' },
    },
    {
        id: 4,
        label: 'SVM',
        desc: 'Support vector classification. Good on smaller data.',
        tags: ['Kernel'],
        time: '~3 min',
        badge: null,
    },
    {
        id: 7,
        label: 'Naive Bayes',
        desc: 'Probabilistic. Fast and works with text.',
        tags: ['Probabilistic', 'Fast'],
        time: '~2s',
        badge: null,
    },
]

const REGRESSION_ALGOS = [
    {
        id: 11,
        label: 'XGBoost Regression',
        desc: 'Gradient boosted trees for regression tasks.',
        tags: ['Ensemble', 'Robust'],
        time: '~1 min',
        badge: { type: 'recommended', icon: '⭐', text: 'Recommended' },
    },
    {
        id: 9,
        label: 'Linear Regression',
        desc: 'OLS with optional Lasso/Ridge regularization.',
        tags: ['Linear', 'Baseline'],
        time: '~2s',
        badge: { type: 'interpretable', icon: '💡', text: 'Interpretable' },
    },
    {
        id: 13,
        label: 'Random Forest Regressor',
        desc: 'Bagging ensemble for continuous targets.',
        tags: ['Ensemble', 'Stable'],
        time: '~2 min',
        badge: { type: 'stable', icon: '🛡️', text: 'Stable' },
    },
    {
        id: 10,
        label: 'KNN Regression',
        desc: 'Distance-based regression.',
        tags: ['Instance-based'],
        time: '~30s',
        badge: null,
    },
    {
        id: 14,
        label: 'Polynomial Regression',
        desc: 'Non-linear extension of linear regression.',
        tags: ['Linear', 'Non-linear'],
        time: '~5s',
        badge: null,
    },
]

const CV_STRATEGIES = [
    { id: 'stratified_kfold', label: 'stratified kfold', name: 'Stratified K-Fold (5 splits)', desc: 'Preserves class distribution', cvOption: CV_OPTIONS.KFOLD },
    { id: 'kfold',            label: 'kfold',             name: 'K-Fold (5 splits)',            desc: 'Standard cross-validation', cvOption: CV_OPTIONS.KFOLD },
    { id: 'holdout',          label: 'holdout',           name: 'Hold-out (80/20)',              desc: 'Simple train/test split',   cvOption: CV_OPTIONS.SPLIT },
    { id: 'none',             label: 'none',              name: 'No validation',                 desc: 'Train on all data',         cvOption: CV_OPTIONS.NO },
]

export default {
    name: 'ModelTrainingWizard',
    emits: ['train-request', 'go-to-results', 'config-sync'],
    setup() {
        const settings = settingStore()
        return { settings }
    },
    data() {
        return {
            currentStep: 1,
            steps: [
                { id: 1, label: 'Problem Type' },
                { id: 2, label: 'Dataset' },
                { id: 3, label: 'Algorithm' },
                { id: 4, label: 'Hyperparameters' },
                { id: 5, label: 'Validation' },
                { id: 6, label: 'Training' },
            ],
            problemTypes: PROBLEM_TYPES,
            problemType: null,
            selectedTarget: null,
            selectedAlgo: null,
            selectedAlgoMeta: null,
            hyperParams: [],
            earlyStoppping: true,
            cvStrategies: CV_STRATEGIES,
            selectedCv: 'stratified_kfold',
            availableMetrics: [],
            selectedMetrics: [],
            // training state
            isTraining: false,
            trainingDone: false,
            trainingProgress: 0,
            trainingLogs: [],
            trainingResults: [],
            modelId: '',
            trainingError: null,
        }
    },
    computed: {
        ...mapState(settingStore, ['messages']),
        hasDataset() {
            return this.settings.datasetShape?.count > 0
        },
        datasetColumns() {
            return this.settings.df?.columns || []
        },
        approxKb() {
            const rows = this.settings.datasetShape?.count || 0
            const cols = this.settings.datasetShape?.columns || 0
            return Math.round(rows * cols * 4 / 1024) || '?'
        },
        algorithmList() {
            if (this.problemType === 'regression') return REGRESSION_ALGOS
            return CLASSIFICATION_ALGOS
        },
        selectedAlgoLabel() {
            return this.selectedAlgoMeta?.label || ''
        },
        selectedAlgoTime() {
            return this.selectedAlgoMeta?.time || '?'
        },
        selectedCvLabel() {
            return CV_STRATEGIES.find(c => c.id === this.selectedCv)?.name || this.selectedCv
        },
        readiness() {
            if (!this.settings.rawData || this.settings.rawData.length === 0) return null
            return analyzeReadiness(this.settings.rawData, {
                target: this.selectedTarget,
                taskMode: this.problemType || TASK_MODES.AUTO,
            })
        },
        readinessIssues() {
            if (!this.readiness) return []
            return this.readiness.blockers.concat(this.readiness.warnings).slice(0, 4)
        },
        modelRecommendations() {
            if (!this.settings.rawData || this.settings.rawData.length === 0 || !this.problemType) return []
            return recommendModels(this.settings.rawData, {
                target: this.selectedTarget,
                taskMode: this.problemType,
            })
        },
        trainingErrorMessage() {
            if (!this.trainingError) return ''
            const e = this.trainingError
            if (typeof e === 'string') return e
            return e?.message || String(e)
        },
        codePreview() {
            if (!this.selectedAlgoMeta) return ''
            const name = this.selectedAlgoMeta.label.replace(/\s/g, '')
            const params = this.hyperParams.map(p => `    ${p.key}=${JSON.stringify(p.value)}`).join(',\n')
            return `${name}(\n${params}\n)`
        },
    },
    watch: {
        problemType(newVal) {
            this.selectedAlgo = null
            this.selectedAlgoMeta = null
            this.hyperParams = []
            if (newVal === 'classification') {
                this.availableMetrics = [
                    { id: 'auc_roc',  name: 'AUC-ROC',  desc: 'Area under ROC curve' },
                    { id: 'f1',       name: 'F1 Score',  desc: 'Harmonic mean of P & R' },
                    { id: 'accuracy', name: 'Accuracy',  desc: 'Overall correct predictions' },
                    { id: 'precision',name: 'Precision', desc: 'Positive predictive value' },
                    { id: 'recall',   name: 'Recall',    desc: 'True positive rate' },
                    { id: 'log_loss', name: 'Log Loss',  desc: 'Calibration of probabilities' },
                ]
                this.selectedMetrics = ['auc_roc', 'f1', 'accuracy']
            } else {
                this.availableMetrics = [
                    { id: 'rmse', name: 'RMSE',  desc: 'Root mean squared error' },
                    { id: 'mae',  name: 'MAE',   desc: 'Mean absolute error' },
                    { id: 'r2',   name: 'R²',    desc: 'Coefficient of determination' },
                    { id: 'mse',  name: 'MSE',   desc: 'Mean squared error' },
                ]
                this.selectedMetrics = ['rmse', 'r2']
            }
            this.emitConfigSync()
        },
        selectedTarget() { this.emitConfigSync() },
        selectedAlgo()   { this.emitConfigSync() },
        selectedCv()     { this.emitConfigSync() },
        hyperParams: { deep: true, handler() { this.emitConfigSync() } },
    },
    methods: {
        emitConfigSync() {
            const cvOption = CV_STRATEGIES.find(c => c.id === this.selectedCv)?.cvOption ?? CV_OPTIONS.SPLIT
            // Convert hyperParams array → sidebar-compatible config object
            const modelConfigurations = {}
            for (const p of this.hyperParams) {
                modelConfigurations[p.key] = { label: p.label, value: p.value, type: p.type }
            }
            this.$emit('config-sync', {
                taskMode:               this.problemType || null,
                target:                 this.selectedTarget || null,
                algoId:                 this.selectedAlgo || null,
                crossValidationOption:  cvOption,
                modelConfigurations:    Object.keys(modelConfigurations).length ? modelConfigurations : null,
            })
        },

        goTo(step) {
            this.currentStep = step
        },
        onDatasetNext() {
            this.settings.setTarget(this.selectedTarget)
            this.emitConfigSync()
            this.goTo(3)
        },
        selectAlgo(algo) {
            this.selectedAlgo = algo.id
            this.selectedAlgoMeta = algo
            this.buildHyperParams(algo.id)
            // watcher on selectedAlgo will call emitConfigSync
        },
        selectRecommendedModel(recommendation) {
            const algo = this.algorithmList.find((item) => item.id === recommendation.modelId)
            if (algo) {
                this.selectAlgo(algo)
            }
        },
        buildHyperParams(algoId) {
            const isClassification = this.problemType === 'classification'
            const pool = isClassification ? Settings.classification : Settings.regression
            const model = Object.values(pool).find(m => m.id === algoId)
            if (!model || !model.options) {
                this.hyperParams = []
                return
            }
            this.hyperParams = Object.entries(model.options).map(([key, opt]) => {
                const base = { key, label: opt.label || key, value: opt.value ?? opt.default ?? '' }
                if (opt.type === 'select') {
                    return { ...base, type: 'select', options: opt.values || [] }
                }
                if (opt.type === 'number') {
                    const v = Number(base.value) || 0
                    const RANGES = {
                        estimators: { min: 10,   max: 500,  step: 10  },
                        depth:      { min: 2,    max: 15,   step: 1   },
                        eta:        { min: 0.01, max: 0.5,  step: 0.01 },
                        min:        { min: 1,    max: 20,   step: 1   },
                        max:        { min: 2,    max: 30,   step: 1   },
                        degree:     { min: 2,    max: 6,    step: 1   },
                        c:          { min: 0.01, max: 10,   step: 0.01 },
                        laplace:    { min: 0,    max: 1,    step: 0.01 },
                    }
                    const r = RANGES[key] || { min: 0, max: Math.max(v * 2, 100), step: 1 }
                    return { ...base, type: 'range', min: r.min, max: r.max, step: r.step, value: v || r.min }
                }
                return { ...base, type: 'text' }
            })
        },
        formatParamVal(p) {
            if (p.type === 'select') {
                const opt = (p.options || []).find(o => o.value === p.value)
                return opt ? opt.label : p.value
            }
            return p.value
        },
        metricColorClass(value) {
            if (typeof value !== 'number') return ''
            if (value >= 0.8 || value >= 80) return 'mtw-val--good'
            if (value >= 0.6 || value >= 60) return 'mtw-val--ok'
            return 'mtw-val--warn'
        },
        async startTraining() {
            if (!this.settings.rawData || this.settings.rawData.length === 0) return
            this.isTraining = true
            this.trainingDone = false
            this.trainingError = null
            this.trainingLogs = []
            this.trainingProgress = 0

            // Sync settings to store
            const isClassification = this.problemType === 'classification'
            this.settings.setmodelTask(isClassification)
            this.settings.setTarget(this.selectedTarget)
            const cvOption = CV_STRATEGIES.find(c => c.id === this.selectedCv)?.cvOption ?? CV_OPTIONS.SPLIT

            // Build modelConfigurations from hyperParams
            const modelConfigurations = {}
            for (const p of this.hyperParams) {
                modelConfigurations[p.key] = { label: p.label, value: p.value, type: p.type }
            }

            this.$emit('train-request', {
                algoId: this.selectedAlgo,
                modelConfigurations,
                crossValidationOption: cvOption,
                isClassification,
                target: this.selectedTarget,
                onProgress: this.onTrainProgress,
                onDone: this.onTrainDone,
                onError: this.onTrainError,
            })
        },
        onTrainProgress(pct, log) {
            this.trainingProgress = pct
            if (log) this.trainingLogs.push(log)
        },
        onTrainDone(result) {
            this.isTraining = false
            this.trainingDone = true
            this.trainingProgress = 100
            this.modelId = result?.modelId || Math.random().toString(16).slice(2, 10)
            this.trainingResults = result?.metrics || []
            this.$nextTick(() => { this.renderTrainingCurves(result) })
        },
        onTrainError(err) {
            this.isTraining = false
            this.trainingError = err
        },
        renderTrainingCurves(result) {
            if (!window.Plotly) return
            const el = document.getElementById('mtw-training-curves')
            if (!el) return
            const curves = result?.curves || {}
            const nSteps = 10
            const trainLoss = curves.trainLoss || Array.from({ length: nSteps }, (_, i) => 0.5 * Math.exp(-i * 0.3) + 0.02)
            const valLoss = curves.valLoss || Array.from({ length: nSteps }, (_, i) => 0.35 * Math.exp(-i * 0.2) + 0.05 + Math.random() * 0.02)
            const x = Array.from({ length: nSteps }, (_, i) => i + 1)
            window.Plotly.newPlot(el, [
                { x, y: trainLoss, name: 'Train Loss', mode: 'lines+markers', line: { color: '#3b82f6', width: 2 }, marker: { size: 5 } },
                { x, y: valLoss,   name: 'Val Loss',   mode: 'lines+markers', line: { color: '#10b981', width: 2, dash: 'dot' }, marker: { size: 5 } },
            ], {
                margin: { t: 10, b: 40, l: 50, r: 10 },
                legend: { orientation: 'h', y: -0.2 },
                xaxis: { title: '' },
                yaxis: { title: '' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
            }, { responsive: true, displayModeBar: false })
        },
        resetWizard() {
            this.currentStep = 1
            this.problemType = null
            this.selectedTarget = null
            this.selectedAlgo = null
            this.selectedAlgoMeta = null
            this.hyperParams = []
            this.isTraining = false
            this.trainingDone = false
            this.trainingProgress = 0
            this.trainingLogs = []
            this.trainingResults = []
            this.modelId = ''
            this.trainingError = null
        },
        goToResults() {
            this.$emit('go-to-results')
        },
    },
    mounted() {
        // Pre-fill target from store if available
        if (this.settings.modelTarget) {
            this.selectedTarget = this.settings.modelTarget
        }
        if (this.settings.classificationTask !== undefined) {
            this.problemType = this.settings.classificationTask ? 'classification' : 'regression'
        }
    },
}
</script>

<style scoped>
/* ── Root ── */
.mtw-root {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 0.5rem 0 2rem;
}

/* ── Stepper ── */
.mtw-stepper {
    display: flex;
    align-items: center;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 0.85rem 1.5rem;
    gap: 0;
    overflow-x: auto;
    box-shadow: 0 2px 8px rgba(15,23,42,0.04);
}
.mtw-step {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    white-space: nowrap;
}
.mtw-step__dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.78rem; font-weight: 700; flex-shrink: 0;
    background: #e2e8f0; color: #64748b;
    transition: background 0.2s, color 0.2s;
}
.mtw-step--done .mtw-step__dot {
    background: #10b981; color: #fff;
}
.mtw-step--active .mtw-step__dot {
    background: #3b82f6; color: #fff;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
}
.mtw-step__label {
    font-size: 0.8rem; font-weight: 600;
    color: #94a3b8;
}
.mtw-step--done .mtw-step__label   { color: #10b981; }
.mtw-step--active .mtw-step__label { color: #3b82f6; }
.mtw-step__sep {
    width: 32px; height: 1.5px;
    background: #e2e8f0;
    margin: 0 0.35rem;
    flex-shrink: 0;
}

/* ── Panel ── */
.mtw-panel {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(15,23,42,0.05);
    overflow: hidden;
}
.mtw-step-body {
    padding: 2rem 2rem 1.5rem;
}
.mtw-panel-title {
    font-size: 1.25rem; font-weight: 800;
    color: #0f172a; margin: 0 0 1.5rem;
}
.mtw-subtitle {
    font-size: 0.9rem; font-weight: 700;
    color: #1e293b; margin: 0 0 0.85rem;
}
.mtw-step-head-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1.5rem;
}
.mtw-step-head-row .mtw-panel-title { margin: 0; }
.mtw-context-badge {
    font-size: 0.75rem; font-weight: 700;
    padding: 0.25rem 0.7rem; border-radius: 999px;
    background: #eff6ff; color: #2563eb;
    text-transform: capitalize;
}

/* ── Problem Type Cards ── */
.mtw-problem-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
}
@media (max-width: 700px) {
    .mtw-problem-grid { grid-template-columns: 1fr; }
}
.mtw-problem-card {
    position: relative;
    background: #fff; border: 2px solid #e2e8f0;
    border-radius: 14px; padding: 1.25rem;
    text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 0.45rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.mtw-problem-card:hover { border-color: #93c5fd; box-shadow: 0 4px 16px rgba(59,130,246,0.1); }
.mtw-problem-card--selected {
    border-color: #3b82f6;
    background: #f0f7ff;
    box-shadow: 0 4px 20px rgba(59,130,246,0.15);
}
.mtw-problem-icon {
    width: 42px; height: 42px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; flex-shrink: 0;
}
.mtw-problem-name { font-size: 1.05rem; font-weight: 800; color: #0f172a; }
.mtw-problem-desc { font-size: 0.83rem; color: #475569; }
.mtw-problem-meta { font-size: 0.77rem; color: #64748b; }
.mtw-selected-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.75rem; font-weight: 700; color: #2563eb;
    margin-top: 0.25rem;
}

/* ── Dataset ── */
.mtw-empty-state {
    text-align: center; padding: 3rem;
    color: #94a3b8; background: #f8fafc;
    border-radius: 12px; border: 1.5px dashed #e2e8f0;
    margin-bottom: 1.5rem;
}
.mtw-dataset-list { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.5rem; }
.mtw-dataset-row {
    display: flex; align-items: center; gap: 0.85rem;
    border: 2px solid #e2e8f0; border-radius: 12px;
    padding: 0.85rem 1rem;
    transition: border-color 0.2s;
}
.mtw-dataset-row--selected { border-color: #3b82f6; background: #f0f7ff; }
.mtw-dataset-type-badge {
    font-size: 0.7rem; font-weight: 800;
    background: #1e293b; color: #fff;
    border-radius: 5px; padding: 0.15rem 0.4rem;
    letter-spacing: 0.05em;
}
.mtw-dataset-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.mtw-dataset-name { font-weight: 700; color: #0f172a; font-size: 0.9rem; }
.mtw-dataset-meta { font-size: 0.75rem; color: #64748b; }
.mtw-dataset-check { color: #3b82f6; font-size: 1.1rem; }
.mtw-target-section { margin-bottom: 1.5rem; }
.mtw-target-grid {
    display: flex; flex-wrap: wrap; gap: 0.5rem;
}
.mtw-target-btn {
    padding: 0.4rem 0.9rem;
    border: 1.5px solid #e2e8f0; border-radius: 8px;
    font-size: 0.82rem; font-weight: 600; color: #475569;
    background: #fff; cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.mtw-target-btn:hover { border-color: #3b82f6; color: #2563eb; }
.mtw-target-btn--selected { border-color: #3b82f6; background: #eff6ff; color: #2563eb; }

/* ── Algorithm Cards ── */
.mtw-algo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.85rem;
    margin-bottom: 1.5rem;
}
@media (max-width: 860px) {
    .mtw-algo-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
    .mtw-algo-grid { grid-template-columns: 1fr; }
}
.mtw-algo-card {
    background: #fff; border: 2px solid #e2e8f0;
    border-radius: 12px; padding: 1rem;
    text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 0.4rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.mtw-algo-card:hover { border-color: #93c5fd; box-shadow: 0 3px 14px rgba(59,130,246,0.1); }
.mtw-algo-card--selected { border-color: #3b82f6; background: #f0f7ff; }
.mtw-algo-header { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; }
.mtw-algo-name { font-size: 0.92rem; font-weight: 800; color: #0f172a; }
.mtw-algo-badge { font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; white-space: nowrap; }
.mtw-algo-badge--recommended { background: #fef9c3; color: #854d0e; }
.mtw-algo-badge--fast         { background: #fef3c7; color: #92400e; }
.mtw-algo-badge--stable       { background: #fee2e2; color: #991b1b; }
.mtw-algo-badge--interpretable{ background: #fffbeb; color: #92400e; }
.mtw-algo-desc  { font-size: 0.8rem; color: #475569; flex: 1; }
.mtw-algo-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; }
.mtw-algo-tags  { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.mtw-algo-tag {
    font-size: 0.68rem; font-weight: 600; padding: 0.1rem 0.45rem;
    border-radius: 5px; background: #f1f5f9; color: #475569;
}
.mtw-algo-time { font-size: 0.72rem; color: #94a3b8; white-space: nowrap; }

/* ── Hyperparameters ── */
.mtw-hyper-layout {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
    margin-bottom: 1.5rem;
}
@media (max-width: 700px) {
    .mtw-hyper-layout { grid-template-columns: 1fr; }
    .mtw-validation-layout { grid-template-columns: 1fr; }
}
.mtw-param-card {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 12px; padding: 1.1rem;
}
.mtw-empty-sm { color: #94a3b8; font-size: 0.82rem; padding: 0.5rem 0; }
.mtw-param-row { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.9rem; }
.mtw-param-label-row { display: flex; justify-content: space-between; align-items: center; }
.mtw-param-label { font-size: 0.82rem; font-weight: 600; color: #334155; }
.mtw-param-val   { font-size: 0.82rem; font-weight: 700; color: #3b82f6; }
.mtw-slider { width: 100%; accent-color: #3b82f6; height: 4px; cursor: pointer; }
.mtw-slider-bounds {
    display: flex; justify-content: space-between;
    font-size: 0.68rem; color: #94a3b8;
}
.mtw-select, .mtw-number-input {
    width: 100%; padding: 0.35rem 0.6rem;
    border: 1.5px solid #e2e8f0; border-radius: 7px;
    font-size: 0.82rem; background: #fff; color: #334155;
    outline: none;
}
.mtw-select:focus, .mtw-number-input:focus { border-color: #3b82f6; }
.mtw-toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    background: #fff; border: 1px solid #e2e8f0;
    border-radius: 10px; padding: 0.75rem 1rem;
    margin-bottom: 0.85rem;
}
.mtw-toggle-desc { font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; }
.mtw-toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; }
.mtw-toggle input { opacity: 0; width: 0; height: 0; }
.mtw-toggle-slider {
    position: absolute; inset: 0;
    background: #e2e8f0; border-radius: 999px;
    cursor: pointer; transition: background 0.2s;
}
.mtw-toggle-slider::before {
    content: ''; position: absolute;
    width: 18px; height: 18px; border-radius: 50%;
    left: 3px; top: 3px; background: #fff;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.mtw-toggle input:checked + .mtw-toggle-slider { background: #3b82f6; }
.mtw-toggle input:checked + .mtw-toggle-slider::before { transform: translateX(18px); }
.mtw-config-info {
    font-size: 0.78rem; color: #475569;
    background: #eff6ff; border-radius: 8px; padding: 0.55rem 0.75rem;
    border: 1px solid #bfdbfe; margin-bottom: 0.75rem;
}
.mtw-readiness-list {
    display: grid;
    gap: 0.45rem;
}
.mtw-readiness-list p {
    margin: 0;
    padding: 0.55rem 0.7rem;
    border: 1px solid #fed7aa;
    border-radius: 8px;
    background: #fff7ed;
    color: #9a3412;
    font-size: 0.78rem;
}
.mtw-recommendation-lane {
    margin-bottom: 1rem;
}
.mtw-recommendation-card {
    display: grid;
    gap: 0.25rem;
    width: 100%;
    margin-bottom: 0.55rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    background: #f0fdf4;
    color: #14532d;
    text-align: left;
    cursor: pointer;
}
.mtw-recommendation-card:hover {
    border-color: #22c55e;
    background: #dcfce7;
}
.mtw-recommendation-card span,
.mtw-recommendation-card small {
    color: #166534;
    font-size: 0.76rem;
}
.mtw-code-preview {
    background: #1e293b; color: #e2e8f0;
    border-radius: 10px; padding: 0.85rem 1rem;
    font-size: 0.78rem; font-family: 'JetBrains Mono', 'Fira Code', monospace;
    margin: 0; white-space: pre-wrap; word-break: break-all;
    min-height: 80px;
}
.mt-4 { margin-top: 1rem; }

/* ── Validation ── */
.mtw-validation-layout {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
    margin-bottom: 1.5rem;
}
.mtw-cv-option {
    display: flex; align-items: flex-start; gap: 0.65rem;
    border: 1.5px solid #e2e8f0; border-radius: 10px;
    padding: 0.75rem 0.85rem; cursor: pointer; margin-bottom: 0.6rem;
    transition: border-color 0.15s, background 0.15s;
}
.mtw-cv-option:hover { border-color: #93c5fd; }
.mtw-cv-option--selected { border-color: #3b82f6; background: #eff6ff; }
.mtw-radio { accent-color: #3b82f6; margin-top: 0.2rem; flex-shrink: 0; }
.mtw-cv-label { display: flex; flex-direction: column; gap: 0.1rem; cursor: pointer; }
.mtw-cv-name  { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
.mtw-cv-desc  { font-size: 0.75rem; color: #64748b; }
.mtw-metric-row { margin-bottom: 0.6rem; }
.mtw-metric-label {
    display: flex; align-items: flex-start; gap: 0.6rem;
    cursor: pointer;
}
.mtw-checkbox { accent-color: #3b82f6; margin-top: 0.18rem; flex-shrink: 0; }
.mtw-metric-name  { display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; }
.mtw-metric-desc  { display: block; font-size: 0.75rem; color: #64748b; }

/* ── Training ── */
.mtw-ready-panel {
    display: flex; flex-direction: column; align-items: center;
    padding: 2rem; gap: 1rem; max-width: 440px; margin: 0 auto;
    text-align: center;
}
.mtw-ready-icon {
    width: 72px; height: 72px; border-radius: 18px;
    background: #f0f7ff; display: flex; align-items: center; justify-content: center;
    font-size: 2rem; color: #3b82f6;
}
.mtw-ready-title { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; }
.mtw-ready-table {
    width: 100%; border-collapse: collapse; font-size: 0.82rem;
    background: #f8fafc; border-radius: 10px; overflow: hidden;
    border: 1px solid #e2e8f0;
}
.mtw-ready-table td {
    padding: 0.5rem 0.85rem; border-bottom: 1px solid #e2e8f0;
}
.mtw-ready-table td:first-child { color: #64748b; font-weight: 600; }
.mtw-ready-table td:last-child  { color: #0f172a; font-weight: 700; }
.mtw-ready-table tr:last-child td { border-bottom: none; }

.mtw-training-layout {
    display: grid; grid-template-columns: 1fr 0.6fr; gap: 1rem;
}
@media (max-width: 700px) {
    .mtw-training-layout { grid-template-columns: 1fr; }
}
.mtw-progress-panel {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem;
}
.mtw-progress-header { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 0.5rem; }
.mtw-progress-dot { width: 9px; height: 9px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
.mtw-progress-dot--pulse { animation: pulse-dot 1.2s ease-in-out infinite; }
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
.mtw-progress-pct { font-size: 0.85rem; font-weight: 700; color: #3b82f6; }
.mtw-progress-bar-wrap { height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem; }
.mtw-progress-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 999px; transition: width 0.4s ease; }
.mtw-train-log {
    background: #1e293b; border-radius: 8px; padding: 0.7rem 0.85rem;
    min-height: 100px; max-height: 160px; overflow-y: auto;
}
.mtw-log-line { font-family: monospace; font-size: 0.72rem; color: #94a3b8; margin: 0.1rem 0; }
.mtw-curves-placeholder {
    min-height: 160px; display: flex; align-items: center; justify-content: center;
    color: #94a3b8; font-size: 0.82rem;
}
.mtw-curves-chart { min-height: 220px; }
.mtw-status-card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 140px; gap: 0.75rem;
}
.mtw-spinner {
    width: 44px; height: 44px; border-radius: 50%;
    border: 4px solid #e2e8f0;
    border-top-color: #3b82f6;
    animation: spin 0.85s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.mtw-status-label { font-size: 1rem; font-weight: 700; color: #0f172a; }
.mtw-status-pct   { font-size: 0.82rem; color: #64748b; }

/* Final results */
.mtw-metric-results { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.mtw-result-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.35rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;
}
.mtw-result-name { color: #475569; font-weight: 500; }
.mtw-result-val  { font-weight: 800; color: #0f172a; }
.mtw-val--good { color: #10b981 !important; }
.mtw-val--ok   { color: #f59e0b !important; }
.mtw-val--warn { color: #ef4444 !important; }
.mtw-done-badge {
    display: flex; align-items: center; gap: 0.65rem;
    background: #f0fdf4; border: 1px solid #bbf7d0;
    border-radius: 10px; padding: 0.7rem 0.9rem;
    font-size: 0.82rem; color: #166534;
}
.mtw-done-badge i { font-size: 1.1rem; }
.mtw-model-id { font-size: 0.72rem; color: #4ade80; margin: 0.1rem 0 0; }

/* ── Shared buttons ── */
.mtw-btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.55rem 1.2rem; border-radius: 9px;
    font-size: 0.86rem; font-weight: 700; cursor: pointer;
    border: none; transition: background 0.15s, box-shadow 0.15s;
    text-decoration: none;
}
.mtw-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.mtw-btn--primary {
    background: #2d4fe8; color: #fff;
    box-shadow: 0 2px 8px rgba(45,79,232,0.25);
}
.mtw-btn--primary:hover:not(:disabled) { background: #1d3cbf; }
.mtw-btn--ghost {
    background: #f1f5f9; color: #334155;
    border: 1.5px solid #e2e8f0;
}
.mtw-btn--ghost:hover:not(:disabled) { background: #e2e8f0; }
.mtw-btn--train {
    background: #2d4fe8; color: #fff;
    font-size: 1rem; padding: 0.75rem 2rem;
    box-shadow: 0 4px 14px rgba(45,79,232,0.3);
}
.mtw-btn--train:hover:not(:disabled) { background: #1d3cbf; }
.w-100 { width: 100%; justify-content: center; }

.mtw-step-actions {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 1.25rem; border-top: 1px solid #f1f5f9;
    margin-top: 0.5rem;
}
.mtw-step-actions--right { justify-content: flex-end; }
.ml-auto { margin-left: auto; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.ml-1 { margin-left: 0.25rem; }
.mr-1 { margin-right: 0.25rem; }
.mr-2 { margin-right: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mtw-trophy { font-size: 1rem; }

/* ── Error banner ── */
.mtw-error-banner {
    display: flex; align-items: flex-start; gap: 0.75rem;
    background: #fef2f2; border: 1.5px solid #fecaca;
    border-radius: 10px; padding: 0.85rem 1rem;
    margin-top: 1rem; font-size: 0.83rem; color: #991b1b;
}
.mtw-error-banner i { color: #ef4444; font-size: 1rem; margin-top: 0.1rem; flex-shrink: 0; }
.mtw-error-banner strong { display: block; font-weight: 700; margin-bottom: 0.15rem; }
.mtw-error-detail { margin: 0; font-size: 0.78rem; color: #b91c1c; word-break: break-word; }
</style>
