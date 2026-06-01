<template>
  <main class="landing-page" :class="{ 'landing-page--reduced-motion': motionReduced }">
    <a class="landing-skip-link" href="#landing-content">Skip to content</a>

    <header class="landing-header" aria-label="Landing navigation">
      <div class="landing-header__institution landing-header__institution--left">
        <img :src="scadsLogo" alt="ScaDS.AI Dresden Leipzig" class="landing-institution-logo landing-institution-logo--scads">
        <a class="landing-brand" href="#landing-hero" aria-label="ExplainML Studio landing page">
          <span class="landing-brand__mark" aria-hidden="true">ML</span>
          <span>
            <strong>ExplainML Studio</strong>
            <small>Visual tabular machine learning</small>
          </span>
        </a>
      </div>

      <nav class="landing-nav" aria-label="Landing sections">
        <a href="#audiences">For learners</a>
        <a href="#workflow">Workflow</a>
        <a href="#metrics">Metrics</a>
      </nav>

      <div class="landing-header__actions">
        <img :src="tuDresdenLogo" alt="Dresden University of Technology" class="landing-institution-logo landing-institution-logo--tud">
        <button
          type="button"
          class="landing-motion-toggle"
          :aria-pressed="motionReduced"
          @click="toggleMotion"
        >
          {{ motionReduced ? 'Motion off' : 'Reduce motion' }}
        </button>
        <ThemeToggle button-class="landing-theme-toggle" />
        <button type="button" class="landing-btn landing-btn--small" @click="enterDashboard">
          Open workspace
        </button>
      </div>
    </header>

    <section id="landing-hero" class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero__copy" id="landing-content">
        <p class="landing-eyebrow">Built only for structured datasets</p>
        <h1 id="landing-title">
          The most intuitive visual workspace for tabular machine learning.
        </h1>
        <p class="landing-hero__lead">
          Learn, train, compare, and explain models for CSV and spreadsheet data
          without writing code. Purpose-built for students, educators, and
          experimental researchers who need clarity instead of generic AI noise.
        </p>
        <div class="landing-hero__actions" aria-label="Primary calls to action">
          <button type="button" class="landing-btn landing-btn--primary" @click="enterDashboard">
            Start building for free
          </button>
          <a class="landing-btn landing-btn--ghost" href="#workflow">
            See tabular workflow
          </a>
        </div>
        <dl class="landing-trust-row" aria-label="Platform highlights">
          <div>
            <dt>0 code</dt>
            <dd>Visual model training</dd>
          </div>
          <div>
            <dt>7+</dt>
            <dd>Tabular model templates</dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd>Metrics and explanations</dd>
          </div>
        </dl>
      </div>

      <div class="landing-hero__visual" aria-label="Animated tabular machine learning workflow">
        <div class="lab-scene" @mousemove="updateScenePointer" @mouseleave="resetScenePointer">
          <div class="lab-scene__halo" aria-hidden="true"></div>
          <div class="dataset-sheet" aria-label="Floating dataset grid">
            <div class="dataset-sheet__toolbar">
              <span></span><span></span><span></span>
              <strong>student_scores.csv</strong>
            </div>
            <div class="dataset-grid" aria-hidden="true">
              <span v-for="cell in 48" :key="cell" :class="{ 'is-target': cell % 11 === 0, 'is-feature': cell % 7 === 0 }"></span>
            </div>
          </div>

          <svg class="feature-arcs" viewBox="0 0 520 320" role="img" aria-label="Feature relationships flowing into model nodes">
            <path d="M90 135 C180 40, 260 75, 334 136" />
            <path d="M92 178 C190 225, 250 220, 335 170" />
            <path d="M140 100 C230 125, 280 120, 390 92" />
            <path d="M150 230 C230 176, 305 244, 430 210" />
          </svg>

          <div class="model-core" aria-label="Predictive model node">
            <span class="model-core__ring"></span>
            <span class="model-core__label">Tabular model</span>
            <strong>Random Forest</strong>
          </div>

          <div class="metric-orbit metric-orbit--accuracy">
            <span>Accuracy</span>
            <strong>94.8%</strong>
          </div>
          <div class="metric-orbit metric-orbit--roc">
            <span>ROC AUC</span>
            <strong>0.91</strong>
          </div>
          <div class="importance-panel" aria-label="Feature importance bars">
            <span v-for="bar in importanceBars" :key="bar.label" :style="{ '--bar-height': bar.height }">
              <i></i><b>{{ bar.label }}</b>
            </span>
          </div>
        </div>
      </div>
    </section>

    <section id="audiences" class="landing-section" aria-labelledby="audiences-title">
      <div class="landing-section__head">
        <p class="landing-eyebrow">Designed around real academic workflows</p>
        <h2 id="audiences-title">A visual ML lab for every learning stage.</h2>
        <p>Each audience gets a clear path from dataset upload to model interpretation.</p>
      </div>
      <div class="audience-grid">
        <article
          v-for="audience in audiences"
          :key="audience.title"
          class="audience-card"
          tabindex="0"
        >
          <div class="audience-card__visual" aria-hidden="true">
            <span v-for="dot in 8" :key="dot"></span>
          </div>
          <p>{{ audience.kicker }}</p>
          <h3>{{ audience.title }}</h3>
          <p>{{ audience.copy }}</p>
          <button type="button" class="landing-link-btn" @click="enterDashboard">
            {{ audience.cta }}
          </button>
        </article>
      </div>
    </section>

    <section id="workflow" class="landing-section landing-section--split" aria-labelledby="workflow-title">
      <div>
        <p class="landing-eyebrow">From spreadsheet to experiment</p>
        <h2 id="workflow-title">Upload tabular datasets instantly.</h2>
        <p>
          Drop a CSV, inspect detected column types, select a target, and move
          into preprocessing guidance without writing scripts or notebooks.
        </p>
        <ul class="landing-check-list">
          <li>Automatic feature detection and target selection</li>
          <li>Data cleaning previews for missing values and outliers</li>
          <li>Guided setup for classification, regression, and clustering</li>
        </ul>
      </div>
      <div class="upload-lab" aria-label="Dataset upload visualization">
        <div class="file-card file-card--csv">CSV</div>
        <div class="file-card file-card--xlsx">XLSX</div>
        <div class="upload-lab__zone">
          <span>Drop dataset</span>
          <strong>150 rows x 5 columns</strong>
        </div>
        <div class="column-stack" aria-hidden="true">
          <span>Target</span><span>Species</span><span>Petal length</span><span>Sepal width</span>
        </div>
      </div>
    </section>

    <section class="landing-section" aria-labelledby="templates-title">
      <div class="landing-section__head">
        <p class="landing-eyebrow">Research-ready templates</p>
        <h2 id="templates-title">Model cards built for tabular ML, not generic AI.</h2>
      </div>
      <div class="model-card-grid">
        <article v-for="model in models" :key="model.name" class="template-card" tabindex="0">
          <span class="template-card__tag">{{ model.type }}</span>
          <h3>{{ model.name }}</h3>
          <p>{{ model.copy }}</p>
          <div class="parameter-spheres" aria-hidden="true">
            <span v-for="sphere in 3" :key="sphere"></span>
          </div>
        </article>
      </div>
    </section>

    <section id="metrics" class="landing-section landing-section--split landing-section--reverse" aria-labelledby="metrics-title">
      <div class="metrics-hologram" aria-label="Live performance metrics visualization">
        <div class="curve-card">
          <span class="curve-card__line"></span>
          <strong>Accuracy curve</strong>
        </div>
        <div class="confusion-matrix" aria-label="Confusion matrix">
          <span v-for="cell in 9" :key="cell" :class="{ 'is-hot': cell === 1 || cell === 5 || cell === 9 }"></span>
        </div>
        <div class="comparison-stack">
          <span>Random Forest 94.8</span>
          <span>XGBoost 93.5</span>
          <span>Logistic 89.2</span>
        </div>
      </div>
      <div>
        <p class="landing-eyebrow">One-click testing</p>
        <h2 id="metrics-title">Understand model performance visually.</h2>
        <p>
          Watch validation flows, feature importance, ROC curves, and confusion
          matrices form in real time so learners can connect ML concepts to results.
        </p>
        <button type="button" class="landing-btn landing-btn--primary" @click="enterDashboard">
          Compare models visually
        </button>
      </div>
    </section>

    <section class="landing-final-cta" aria-labelledby="final-cta-title">
      <p class="landing-eyebrow">Start with your own spreadsheet</p>
      <h2 id="final-cta-title">Turn tabular data into teachable machine learning experiments.</h2>
      <button type="button" class="landing-btn landing-btn--primary" @click="enterDashboard">
        Try your first dataset
      </button>
    </section>

    <footer class="landing-institution-footer" aria-label="Institutional partners">
      <img :src="scadsLogo" alt="ScaDS.AI Dresden Leipzig" class="landing-institution-logo landing-institution-logo--scads">
      <span>Academic visual machine learning workspace</span>
      <img :src="tuDresdenLogo" alt="Dresden University of Technology" class="landing-institution-logo landing-institution-logo--tud">
    </footer>
  </main>
</template>

<script>
import ThemeToggle from '@/components/theme/theme-toggle.vue';
import scadsLogo from '@/assets/scadsai.png';
import tuDresdenLogo from '@/assets/TU_Dresden.png';

export default {
  name: 'LandingPage',
  components: {
    ThemeToggle,
  },
  emits: ['enter-dashboard'],
  data() {
    return {
      scadsLogo,
      tuDresdenLogo,
      motionReduced: false,
      importanceBars: [
        { label: 'Petal', height: '86%' },
        { label: 'Sepal', height: '64%' },
        { label: 'Class', height: '48%' },
        { label: 'Score', height: '72%' },
      ],
      audiences: [
        {
          kicker: 'Students',
          title: 'Train ML models visually.',
          copy: 'Perfect for assignments, projects, and first hands-on model training.',
          cta: 'Start building for free',
        },
        {
          kicker: 'Beginners',
          title: 'Explore ML without programming.',
          copy: 'Guided experiments explain what happens at each step.',
          cta: 'Launch guided experiments',
        },
        {
          kicker: 'Researchers',
          title: 'Prototype tabular experiments faster.',
          copy: 'Compare models, metrics, and experiment outcomes in one visual space.',
          cta: 'Explore research features',
        },
        {
          kicker: 'Educators',
          title: 'Teach machine learning interactively.',
          copy: 'Classroom-ready workflows help students understand concepts clearly.',
          cta: 'View classroom workflows',
        },
      ],
      models: [
        { name: 'Random Forest', type: 'Ensemble', copy: 'Robust baselines with interpretable feature importance.' },
        { name: 'XGBoost', type: 'Boosting', copy: 'High-performing tabular experimentation for structured data.' },
        { name: 'CatBoost', type: 'Categorical', copy: 'Practical handling for categorical-heavy datasets.' },
        { name: 'Logistic Regression', type: 'Linear', copy: 'Transparent classification for teaching probabilities.' },
        { name: 'Decision Trees', type: 'Explainable', copy: 'Readable rules for classroom demonstrations.' },
        { name: 'LightGBM', type: 'Fast', copy: 'Efficient experimentation for larger tabular problems.' },
      ],
    };
  },
  mounted() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  },
  methods: {
    enterDashboard() {
      this.$emit('enter-dashboard');
    },
    toggleMotion() {
      this.motionReduced = !this.motionReduced;
    },
    updateScenePointer(event) {
      if (this.motionReduced) return;
      const scene = event.currentTarget;
      const rect = scene.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3);
      const y = ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3);
      scene.style.setProperty('--pointer-x', x);
      scene.style.setProperty('--pointer-y', y);
    },
    resetScenePointer(event) {
      event.currentTarget.style.setProperty('--pointer-x', 0);
      event.currentTarget.style.setProperty('--pointer-y', 0);
    },
  },
};
</script>
