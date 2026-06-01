<template>
    <section class="methods-root">
        <!-- ══ View Mode Switcher ═══════════════════════════════════ -->
        <div class="view-mode-toggle-bar" :class="{ 'view-mode-toggle-bar--light': !settings.isDark }">
            <div class="toggle-container">
                <button class="toggle-btn" :class="{ 'toggle-btn--active': viewMode === '3d' }" @click="setViewMode('3d')" aria-label="Switch to 3D Spatial Lab view">
                    <i class="fas fa-cubes"></i>
                    <span>3D Spatial Lab</span>
                </button>
                <button class="toggle-btn" :class="{ 'toggle-btn--active': viewMode === '2d' }" @click="setViewMode('2d')" aria-label="Switch to Classic 2D view">
                    <i class="fas fa-file-alt"></i>
                    <span>Classic 2D View</span>
                </button>
            </div>
            <!-- Progress counter in header -->
            <div v-if="viewMode === '3d'" class="progress-pill-3d" role="status" aria-live="polite">
                <i class="fas fa-graduation-cap"></i>
                <span>Progress: {{ completedAlgos.length }} / {{ totalAlgosCount }} Mastered</span>
            </div>
        </div>

        <!-- ══ 3D Spatial Lab Layout ════════════════════════════════ -->
        <div v-if="viewMode === '3d'" class="lab-container" :class="{ 'lab-container--light': !settings.isDark }">
            <!-- Left Sidebar Navigation -->
            <aside class="lab-sidebar" role="navigation" aria-label="Select ML Method">
                <div class="sidebar-search">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" v-model="searchQuery" placeholder="Search methods..." aria-label="Search methods" />
                </div>
                <div class="sidebar-groups">
                    <div v-for="grp in labGroups" :key="grp.title" class="sidebar-group">
                        <h4 class="sidebar-group__title">{{ grp.title }}</h4>
                        <ul class="sidebar-group__list">
                            <li v-for="algo in grp.algos" :key="algo.id"
                                class="sidebar-item"
                                :class="{ 'sidebar-item--active': activeAlgoId === algo.id }"
                                @click="selectAlgo3D(algo.id)">
                                <span class="status-indicator" :class="{ 'status-indicator--completed': completedAlgos.includes(algo.id) }">
                                    <i :class="completedAlgos.includes(algo.id) ? 'fas fa-check-circle' : 'far fa-circle'"></i>
                                </span>
                                <span class="sidebar-item__name">{{ algo.name }}</span>
                                <span class="sidebar-item__badge" :style="{ backgroundColor: algo.color }">{{ algo.abbr }}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </aside>

            <!-- Center Viewport / Canvas -->
            <main class="lab-viewport-container">
                <div ref="canvasContainer" class="lab-canvas-container" role="img" aria-label="3D spatial visualization of the selected machine learning method. Interactive controls allow you to rotate and zoom.">
                    <!-- Three.js Canvas mounts here -->
                </div>

                <!-- 3D CSS Projected floating tooltips overlay -->
                <div class="lab-overlay-tooltips">
                    <div v-for="tooltip in activeTooltips" :key="tooltip.id"
                        class="floating-tooltip"
                        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', transform: 'translate(-50%, -100%)' }">
                        <div class="tooltip-dot" :style="{ backgroundColor: activeAlgoColor, color: activeAlgoColor }"></div>
                        <div class="tooltip-box">
                            <div class="tooltip-title">{{ tooltip.title }}</div>
                            <div class="tooltip-body">{{ tooltip.desc }}</div>
                        </div>
                    </div>
                </div>

                <!-- Camera / Space Navigation controls overlay -->
                <div class="viewport-hud-controls">
                    <button class="hud-nav-btn" @click="prevAlgo3D" aria-label="Previous method">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="hud-nav-label">Navigate Space</span>
                    <button class="hud-nav-btn" @click="nextAlgo3D" aria-label="Next method">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <button class="hud-reset-btn" @click="resetCamera" title="Reset Viewport Camera" aria-label="Reset Camera view">
                        <i class="fas fa-sync-alt"></i> Reset Camera
                    </button>
                </div>
                <div class="viewport-instructions">
                    <i class="fas fa-info-circle"></i> Drag to rotate | Scroll to zoom | Right-click to pan
                </div>
            </main>

            <!-- Right HUD Details Panel -->
            <section class="lab-hud-panel" aria-label="Method details and controls">
                <header class="hud-header" :style="{ borderLeftColor: activeAlgoColor }">
                    <span class="hud-badge" :style="{ backgroundColor: activeAlgoColor }">{{ activeAlgo.abbr }}</span>
                    <div class="hud-title-wrap">
                        <h2 class="hud-title">{{ activeAlgo.name }}</h2>
                        <span class="hud-family">{{ activeAlgo.family }}</span>
                    </div>
                    <button class="mastery-toggle-btn"
                        :class="{ 'mastery-toggle-btn--completed': completedAlgos.includes(activeAlgo.id) }"
                        @click="toggleMastery(activeAlgo.id)"
                        :aria-label="completedAlgos.includes(activeAlgo.id) ? 'Mastered' : 'Mark as mastered'">
                        <i class="fas fa-graduation-cap"></i>
                        {{ completedAlgos.includes(activeAlgo.id) ? 'Mastered!' : 'Mark Mastered' }}
                    </button>
                </header>

                <div class="hud-body">
                    <!-- Description -->
                    <div class="hud-section">
                        <p class="hud-desc">{{ activeAlgo.description }}</p>
                    </div>

                    <!-- Interactive Param Sliders (Tuning the 3D model) -->
                    <div class="hud-section" v-if="activeAlgo.params && activeAlgo.params.length">
                        <h3 class="hud-section-title"><i class="fas fa-sliders-h"></i> Live 3D Tuning Parameters</h3>
                        <div class="hud-params">
                            <div v-for="param in activeAlgo.params" :key="param.key" class="hud-param-row">
                                <label class="hud-param-label">
                                    {{ param.label }}: <strong>{{ formatParam(cParams[activeAlgo.id]?.[param.key], param) }}</strong>
                                </label>
                                <input v-if="param.type === 'range'" type="range" :min="param.min" :max="param.max" :step="param.step"
                                    v-model.number="cParams[activeAlgo.id][param.key]" @input="updateParam3D(activeAlgo.id, param.key)" class="hud-param-slider" />
                                <select v-else-if="param.type === 'select'" class="hud-param-select" v-model="cParams[activeAlgo.id][param.key]" @change="updateParam3D(activeAlgo.id, param.key)">
                                    <option v-for="o in param.options" :key="o.value" :value="o.value">{{ o.label }}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Walks / Optimization playbar -->
                    <div class="hud-section" v-if="hasWalkthrough(activeAlgo.id)">
                        <h3 class="hud-section-title"><i class="fas fa-play-circle"></i> Optimization Walkthrough</h3>
                        <div class="walkthrough-playback">
                            <button class="playback-btn" @click="toggleWalkthrough" :aria-label="walkthroughPlaying ? 'Pause animation' : 'Play animation'">
                                <i class="fas" :class="walkthroughPlaying ? 'fa-pause' : 'fa-play'"></i>
                                <span>{{ walkthroughPlaying ? 'Pause' : 'Play Optimization' }}</span>
                            </button>
                            <button class="playback-btn playback-btn--secondary" @click="stepWalkthrough" aria-label="Step animation forward">
                                <i class="fas fa-step-forward"></i> Step
                            </button>
                            <button class="playback-btn playback-btn--secondary" @click="resetWalkthrough" aria-label="Reset animation">
                                <i class="fas fa-undo"></i> Reset
                            </button>
                        </div>
                        <p class="walkthrough-step-desc">
                            <strong>Step {{ walkthroughStep + 1 }}:</strong> {{ getWalkthroughStepText(activeAlgo.id, walkthroughStep) }}
                        </p>
                    </div>

                    <!-- Formulas -->
                    <div class="hud-section">
                        <h3 class="hud-section-title"><i class="fas fa-square-root-alt"></i> Key Formula</h3>
                        <div class="hud-formula-box">
                            <div v-for="(f, fi) in activeAlgo.formulas" :key="fi" class="hud-formula-row">
                                <span class="hud-formula-label">{{ f.label }}</span>
                                <vue-mathjax :formula="f.tex" class="hud-formula-tex"></vue-mathjax>
                            </div>
                        </div>
                    </div>

                    <!-- Steps -->
                    <div class="hud-section">
                        <h3 class="hud-section-title"><i class="fas fa-list-ol"></i> Step-by-Step Walkthrough</h3>
                        <div class="hud-steps">
                            <div v-for="(step, si) in activeAlgo.steps" :key="si" class="hud-step">
                                <span class="hud-step-num" :style="{ backgroundColor: activeAlgoColor }">{{ si + 1 }}</span>
                                <span class="hud-step-text">{{ step }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Pros & Cons -->
                    <div class="hud-section hud-meta-row">
                        <div class="hud-meta">
                            <h4 class="hud-meta-title text-success">Strengths</h4>
                            <ul class="hud-meta-list">
                                <li v-for="p in activeAlgo.pros" :key="p"><i class="fas fa-check"></i> {{ p }}</li>
                            </ul>
                        </div>
                        <div class="hud-meta">
                            <h4 class="hud-meta-title text-danger">Limitations</h4>
                            <ul class="hud-meta-list">
                                <li v-for="c in activeAlgo.cons" :key="c"><i class="fas fa-times"></i> {{ c }}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <!-- ══ Fallback Classic 2D View ════════════════════════════ -->
        <div v-else class="classic-view-container">
            <!-- ══ Hero banner ═══════════════════════════════════════════ -->
            <div class="hero-banner">
                <div class="hero-stats">
                    <div class="hero-stat" @click="activeTab='classification'">
                        <i class="fas fa-tag hero-stat__icon" style="color:#3b82f6"></i>
                        <span class="hero-stat__count">6</span>
                        <span class="hero-stat__label">Classification</span>
                    </div>
                    <div class="hero-stat" @click="activeTab='regression'">
                        <i class="fas fa-chart-line hero-stat__icon" style="color:#10b981"></i>
                        <span class="hero-stat__count">3</span>
                        <span class="hero-stat__label">Regression</span>
                    </div>
                    <div class="hero-stat" @click="activeTab='clustering'">
                        <i class="fas fa-object-group hero-stat__icon" style="color:#f59e0b"></i>
                        <span class="hero-stat__count">3</span>
                        <span class="hero-stat__label">Clustering</span>
                    </div>
                    <div class="hero-stat" @click="activeTab='metrics'">
                        <i class="fas fa-chart-bar hero-stat__icon" style="color:#8b5cf6"></i>
                        <span class="hero-stat__count">12+</span>
                        <span class="hero-stat__label">Metrics</span>
                    </div>
                </div>
                <button class="hero-guide-toggle" @click="showGuide = !showGuide">
                    <i class="fas fa-sitemap"></i>
                    {{ showGuide ? 'Hide' : 'Which model should I use?' }}
                    <i class="fas" :class="showGuide ? 'fa-chevron-up' : 'fa-chevron-down'" style="font-size:0.7rem;margin-left:4px"></i>
                </button>
                <div v-show="showGuide" class="hero-guide">
                    <div class="guide-tree">
                        <div class="guide-q">Is your target variable categorical?</div>
                        <div class="guide-branches">
                            <div class="guide-branch guide-branch--blue">
                                <div class="guide-branch__label">Yes &rarr; Classification</div>
                                <div class="guide-leaf" @click="scrollToAlgo('logistic')"><span class="guide-dot" style="background:#3b82f6"></span>Need probabilities? <b>Logistic Regression / Naive Bayes</b></div>
                                <div class="guide-leaf" @click="scrollToAlgo('svm')"><span class="guide-dot" style="background:#ef4444"></span>Non-linear boundaries? <b>SVM (RBF) / Random Forest</b></div>
                                <div class="guide-leaf" @click="scrollToAlgo('boosting')"><span class="guide-dot" style="background:#ec4899"></span>Best tabular accuracy? <b>Gradient Boosting</b></div>
                                <div class="guide-leaf" @click="scrollToAlgo('knn')"><span class="guide-dot" style="background:#10b981"></span>Simple baseline? <b>KNN</b></div>
                            </div>
                            <div class="guide-branch guide-branch--green">
                                <div class="guide-branch__label">No &rarr; Regression</div>
                                <div class="guide-leaf" @click="scrollToAlgo('linreg')"><span class="guide-dot" style="background:#3b82f6"></span>Linear relationship? <b>Linear / Ridge / Lasso</b></div>
                                <div class="guide-leaf" @click="scrollToAlgo('polyreg')"><span class="guide-dot" style="background:#10b981"></span>Non-linear? <b>Polynomial / SVR</b></div>
                            </div>
                            <div class="guide-branch guide-branch--amber">
                                <div class="guide-branch__label">No target &rarr; Clustering</div>
                                <div class="guide-leaf" @click="scrollToAlgo('kmeans')"><span class="guide-dot" style="background:#3b82f6"></span>Known # clusters? <b>K-Means</b></div>
                                <div class="guide-leaf" @click="scrollToAlgo('dbscan')"><span class="guide-dot" style="background:#f59e0b"></span>Arbitrary shapes? <b>DBSCAN</b></div>
                                <div class="guide-leaf" @click="scrollToAlgo('hierarchical')"><span class="guide-dot" style="background:#8b5cf6"></span>Want dendrogram? <b>Hierarchical</b></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══ Tab bar ═══════════════════════════════════════════════ -->
            <div class="methods-tabs">
                <button v-for="tab in tabs" :key="tab.id"
                    class="methods-tab"
                    :class="{ 'methods-tab--active': activeTab === tab.id }"
                    @click="activeTab = tab.id">
                    <i :class="tab.icon" class="methods-tab__icon"></i>
                    {{ tab.label }}
                    <span class="methods-tab__count">{{ tab.count }}</span>
                </button>
            </div>

            <!-- ══ Algo section macro (Classification / Regression / Clustering) ══ -->
            <template v-for="section in algoSections" :key="section.key">
            <div v-if="activeTab === section.key" class="methods-content">
                <p class="methods-intro">{{ section.intro }}</p>

                <!-- comparison table -->
                <div class="compare-card">
                    <div class="compare-card__header" @click="showCompare[section.key] = !showCompare[section.key]">
                        <i class="fas fa-table compare-card__icon"></i>
                        <span>Quick Comparison</span>
                        <i class="fas" :class="showCompare[section.key] ? 'fa-chevron-up' : 'fa-chevron-down'" style="margin-left:auto;font-size:0.7rem;color:#94a3b8"></i>
                    </div>
                    <div v-show="showCompare[section.key]" class="compare-card__body">
                        <table class="compare-table">
                            <thead><tr><th>Model</th><th>Type</th><th>Speed</th><th>Interpretability</th><th>Best For</th></tr></thead>
                            <tbody>
                                <tr v-for="algo in section.algos" :key="algo.id" class="compare-row" @click="scrollToAlgo(algo.id)">
                                    <td><span class="algo-card__badge" :style="{ background: algo.color }" style="font-size:0.58rem;width:28px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;color:#fff;font-weight:800;margin-right:6px">{{ algo.abbr }}</span>{{ algo.name }}</td>
                                    <td>{{ algo.family.split('·')[0].trim() }}</td>
                                    <td><span v-for="s in (algo.speed || 3)" :key="s" class="speed-dot">&#9679;</span><span v-for="s in (5 - (algo.speed || 3))" :key="'e'+s" class="speed-dot speed-dot--empty">&#9679;</span></td>
                                    <td><span v-for="s in (algo.interpret || 3)" :key="s" class="interp-star">&#9733;</span><span v-for="s in (5 - (algo.interpret || 3))" :key="'e'+s" class="interp-star interp-star--empty">&#9733;</span></td>
                                    <td class="compare-best">{{ algo.bestFor || '—' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- algo cards -->
                <div v-for="algo in section.algos" :key="algo.id" :id="`card-${algo.id}`"
                     class="algo-card" :style="{ borderLeftColor: algo.color }">
                    <div class="algo-card__header" @click="toggleAlgo(algo.id)">
                        <span class="algo-card__badge" :style="{ background: algo.color }">{{ algo.abbr }}</span>
                        <span class="algo-card__name">{{ algo.name }}</span>
                        <span v-if="algo.difficulty" class="algo-difficulty" :class="`algo-difficulty--${algo.difficulty}`">{{ algo.difficulty }}</span>
                        <span class="algo-card__family">{{ algo.family }}</span>
                        <i class="fas algo-card__chevron"
                           :class="openAlgos.includes(algo.id) ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                    </div>
                    <transition name="card-slide">
                    <div v-show="openAlgos.includes(algo.id)" class="algo-card__body">
                        <div class="algo-two-col">
                            <div class="algo-desc">
                                <p class="algo-desc__text">{{ algo.description }}</p>
                                <div class="algo-steps">
                                    <div v-for="(step, si) in algo.steps" :key="si" class="algo-step">
                                        <span class="algo-step__num">{{ si + 1 }}</span>
                                        <span class="algo-step__text">{{ step }}</span>
                                    </div>
                                </div>
                                <div class="algo-meta-row">
                                    <div class="algo-meta"><p class="algo-meta__title">Strengths</p><ul class="algo-meta__list algo-meta__list--green"><li v-for="p in algo.pros" :key="p">{{ p }}</li></ul></div>
                                    <div class="algo-meta"><p class="algo-meta__title">Limitations</p><ul class="algo-meta__list algo-meta__list--red"><li v-for="c in algo.cons" :key="c">{{ c }}</li></ul></div>
                                </div>
                            </div>
                            <div class="algo-formula-box">
                                <p class="algo-formula-box__title">Key Formula</p>
                                <div v-for="(f, fi) in algo.formulas" :key="fi" class="algo-formula-row">
                                    <span class="algo-formula-label">{{ f.label }}</span>
                                    <vue-mathjax :formula="f.tex" class="algo-formula-tex"></vue-mathjax>
                                </div>
                                <div class="algo-complexity">
                                    <span class="algo-complexity__item"><b>Train:</b> {{ algo.complexity.train }}</span>
                                    <span class="algo-complexity__item"><b>Predict:</b> {{ algo.complexity.predict }}</span>
                                </div>
                            </div>
                        </div>
                        <div v-if="algo.math" class="algo-math">
                            <div v-if="algo.math.objectives?.length" class="math-objectives">
                                <p class="math-section-title">
                                    <i class="fas fa-graduation-cap"></i>
                                    Learning objectives
                                </p>
                                <ul class="math-objectives__list">
                                    <li v-for="objective in algo.math.objectives" :key="objective">
                                        {{ objective }}
                                    </li>
                                </ul>
                            </div>

                            <div v-if="algo.math.prerequisites?.length" class="math-prereqs">
                                <span class="math-prereqs__label">Prerequisites</span>
                                <span v-for="item in algo.math.prerequisites" :key="item" class="math-prereq-chip">
                                    {{ item }}
                                </span>
                            </div>

                            <div v-if="algo.math.definition" class="math-definition">
                                <p class="math-section-title">
                                    <i class="fas fa-square-root-alt"></i>
                                    Formal definition
                                </p>
                                <p class="math-definition__title">{{ algo.math.definition.title }}</p>
                                <vue-mathjax v-if="algo.math.definition.tex" :formula="algo.math.definition.tex" class="math-definition__formula"></vue-mathjax>
                                <p class="math-definition__body">{{ algo.math.definition.explanation }}</p>
                            </div>

                            <details v-if="algo.math.derivation?.length" class="math-details" open>
                                <summary class="math-details__summary">Why it works: derivation and proof sketch</summary>
                                <div class="math-derivation-grid">
                                    <article v-for="(step, di) in algo.math.derivation" :key="di" class="math-derivation-card">
                                        <span class="math-derivation-card__num">{{ di + 1 }}</span>
                                        <div>
                                            <p class="math-derivation-card__title">{{ step.title }}</p>
                                            <vue-mathjax v-if="step.tex" :formula="step.tex" class="math-derivation-card__formula"></vue-mathjax>
                                            <p class="math-derivation-card__body">{{ step.body }}</p>
                                        </div>
                                    </article>
                                </div>
                            </details>

                            <details v-if="algo.math.complexityNotes?.length" class="math-details">
                                <summary class="math-details__summary">Algorithmic analysis</summary>
                                <div class="math-complexity-grid">
                                    <div v-for="item in algo.math.complexityNotes" :key="item.label" class="math-complexity-card">
                                        <span class="math-complexity-card__label">{{ item.label }}</span>
                                        <code>{{ item.bound }}</code>
                                        <p>{{ item.reason }}</p>
                                    </div>
                                </div>
                            </details>

                            <div v-if="algo.math.implementation?.length" class="math-bridge">
                                <p class="math-section-title">
                                    <i class="fas fa-code"></i>
                                    Theory to implementation
                                </p>
                                <div class="math-bridge__grid">
                                    <div v-for="item in algo.math.implementation" :key="item.symbol" class="math-bridge__item">
                                        <code>{{ item.symbol }}</code>
                                        <span>{{ item.meaning }}</span>
                                    </div>
                                </div>
                            </div>

                            <div v-if="algo.math.applications?.length" class="math-applications">
                                <p class="math-section-title">
                                    <i class="fas fa-lightbulb"></i>
                                    Applications with mathematical logic
                                </p>
                                <div class="math-application-grid">
                                    <article v-for="app in algo.math.applications" :key="app.title" class="math-application-card">
                                        <p class="math-application-card__title">{{ app.title }}</p>
                                        <p>{{ app.body }}</p>
                                    </article>
                                </div>
                            </div>

                            <details v-if="algo.math.practice" class="math-details math-practice">
                                <summary class="math-details__summary">Practice problem with solution</summary>
                                <p class="math-practice__prompt">{{ algo.math.practice.prompt }}</p>
                                <ol class="math-practice__steps">
                                    <li v-for="step in algo.math.practice.steps" :key="step">{{ step }}</li>
                                </ol>
                                <p class="math-practice__answer"><strong>Answer:</strong> {{ algo.math.practice.answer }}</p>
                            </details>
                        </div>
                        <div class="algo-viz">
                            <p class="algo-viz__title">Interactive Visualisation</p>
                            <div class="algo-viz__controls">
                                <div v-for="param in algo.params" :key="param.key" class="viz-control">
                                    <label class="viz-control__label">{{ param.label }}: <strong>{{ formatParam(cParams[algo.id]?.[param.key], param) }}</strong></label>
                                    <input v-if="param.type === 'range'" type="range" :min="param.min" :max="param.max" :step="param.step"
                                        :value="cParams[algo.id]?.[param.key]" @input="updateParam(algo.id, param.key, $event.target.value)" class="viz-control__slider" />
                                    <select v-else-if="param.type === 'select'" class="viz-control__select" :value="cParams[algo.id]?.[param.key]" @change="updateParam(algo.id, param.key, $event.target.value)">
                                        <option v-for="o in param.options" :key="o.value" :value="o.value">{{ o.label }}</option>
                                    </select>
                                </div>
                                <button class="viz-control__btn" @click="runViz(algo.id)"><i class="fas fa-sync-alt"></i> Regenerate</button>
                            </div>
                            <div :id="`viz-${algo.id}`" class="algo-viz__plot"></div>
                            <p v-if="algo.math?.visualizationLens" class="algo-viz__lens">
                                <i class="fas fa-eye"></i>
                                {{ algo.math.visualizationLens }}
                            </p>
                        </div>
                        <div class="algo-hyperparam">
                            <p class="algo-hyperparam__title">Hyperparameter Guide</p>
                            <table class="hp-table">
                                <thead><tr><th>Parameter</th><th>Effect</th><th>Typical Range</th><th>When to increase</th></tr></thead>
                                <tbody><tr v-for="hp in algo.hyperparams" :key="hp.name"><td><code>{{ hp.name }}</code></td><td>{{ hp.effect }}</td><td><code>{{ hp.range }}</code></td><td>{{ hp.increase }}</td></tr></tbody>
                            </table>
                        </div>
                    </div>
                    </transition>
                </div>
            </div>
            </template>

            <!-- ══ Metrics & Evaluation tab ══════════════════════════════ -->
            <div v-if="activeTab === 'metrics'" class="methods-content">
                <p class="methods-intro">
                    Understanding how to measure model performance is just as important as choosing the right algorithm.
                    This section covers key evaluation metrics, model selection strategies, and interpretability techniques.
                </p>

                <!-- Classification metrics -->
                <div class="metrics-section">
                    <h3 class="metrics-section__title"><i class="fas fa-tag"></i> Classification Metrics</h3>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <p class="metric-card__name">Confusion Matrix</p>
                            <div class="confusion-grid">
                                <div class="cm-cell cm-cell--tp">TP</div><div class="cm-cell cm-cell--fp">FP</div>
                                <div class="cm-cell cm-cell--fn">FN</div><div class="cm-cell cm-cell--tn">TN</div>
                            </div>
                            <p class="metric-card__desc">The 2x2 matrix of predictions vs actual labels. All other metrics derive from these four counts.</p>
                        </div>
                        <div class="metric-card" v-for="m in classMetrics" :key="m.name">
                            <p class="metric-card__name">{{ m.name }}</p>
                            <vue-mathjax :formula="m.tex" class="metric-card__formula"></vue-mathjax>
                            <p class="metric-card__desc">{{ m.desc }}</p>
                        </div>
                    </div>
                    <div class="metrics-viz-section">
                        <p class="algo-viz__title">Interactive ROC Curve</p>
                        <div class="algo-viz__controls">
                            <div class="viz-control">
                                <label class="viz-control__label">Threshold: <strong>{{ rocThreshold.toFixed(2) }}</strong></label>
                                <input type="range" min="0.01" max="0.99" step="0.01" v-model.number="rocThreshold" @input="drawROC" class="viz-control__slider" />
                            </div>
                        </div>
                        <div id="viz-roc" class="algo-viz__plot"></div>
                    </div>
                </div>

                <!-- Regression metrics -->
                <div class="metrics-section">
                    <h3 class="metrics-section__title"><i class="fas fa-chart-line"></i> Regression Metrics</h3>
                    <div class="metrics-grid">
                        <div class="metric-card" v-for="m in regrMetrics" :key="m.name">
                            <p class="metric-card__name">{{ m.name }}</p>
                            <vue-mathjax :formula="m.tex" class="metric-card__formula"></vue-mathjax>
                            <p class="metric-card__desc">{{ m.desc }}</p>
                        </div>
                    </div>
                </div>

                <!-- Model selection -->
                <div class="metrics-section">
                    <h3 class="metrics-section__title"><i class="fas fa-cut"></i> Model Selection</h3>
                    <div class="model-sel-grid">
                        <div class="sel-card">
                            <p class="sel-card__title">Train / Validation / Test Split</p>
                            <div class="split-bar">
                                <div class="split-seg split-seg--train" style="width:60%">Train 60%</div>
                                <div class="split-seg split-seg--val" style="width:20%">Val 20%</div>
                                <div class="split-seg split-seg--test" style="width:20%">Test 20%</div>
                            </div>
                            <p class="sel-card__desc">The training set fits the model. The validation set tunes hyperparameters. The test set gives the final unbiased estimate.</p>
                        </div>
                        <div class="sel-card">
                            <p class="sel-card__title">K-Fold Cross-Validation</p>
                            <div class="kfold-viz">
                                <div v-for="fold in 5" :key="fold" class="kfold-row">
                                    <div v-for="seg in 5" :key="seg"
                                        class="kfold-seg"
                                        :class="seg === fold ? 'kfold-seg--val' : 'kfold-seg--train'">
                                        {{ seg === fold ? 'Val' : '' }}
                                    </div>
                                    <span class="kfold-label">Fold {{ fold }}</span>
                                </div>
                            </div>
                            <p class="sel-card__desc">Each fold serves as validation exactly once. Average scores across folds for a robust estimate. Reduces variance from a single random split.</p>
                        </div>
                    </div>
                </div>

                <!-- Interpretability -->
                <div class="metrics-section">
                    <h3 class="metrics-section__title"><i class="fas fa-search"></i> Interpretability</h3>
                    <div class="model-sel-grid">
                        <div class="sel-card">
                            <p class="sel-card__title">Partial Dependence Plot (PDP)</p>
                            <p class="sel-card__desc">Shows the marginal effect of one or two features on the predicted outcome. For each value of the feature of interest, predictions are averaged over all other features, revealing the global relationship between the feature and the model output. Assumes features are not strongly correlated.</p>
                            <vue-mathjax :formula="'$$\\hat{f}_S(x_S) = \\frac{1}{n}\\sum_{i=1}^{n}\\hat{f}(x_S, x_C^{(i)})$$'" class="metric-card__formula"></vue-mathjax>
                        </div>
                        <div class="sel-card">
                            <p class="sel-card__title">Permutation Feature Importance</p>
                            <p class="sel-card__desc">After training, randomly shuffle one feature at a time and measure the drop in model performance. A large drop means the feature is important. Model-agnostic and applicable to any algorithm. Can be misleading when features are highly correlated.</p>
                            <vue-mathjax :formula="'$$\\text{Importance}_j = \\text{Score}_{\\text{original}} - \\text{Score}_{\\text{permuted}_j}$$'" class="metric-card__formula"></vue-mathjax>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import { getPlotly } from '@/utils/danfo_loader';
import { settingStore } from '@/stores/settings';
import { getGraphPalette, mergePlotlyLayout } from '@/helpers/chart-theme';
import * as THREE from 'three';

// ── Pure-JS helpers ────────────────────────────────────────────────────────
const rng = (seed) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
};

const randn = (r) => {
    const u = r(), v = r();
    return Math.sqrt(-2 * Math.log(u + 1e-9)) * Math.cos(2 * Math.PI * v);
};

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function linspace(a, b, n) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(a + (b - a) * i / (n - 1));
    return arr;
}

function polyVal(coeffs, x) {
    return coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
}

// Simple polynomial least-squares via Vandermonde (max degree 10)
function polyFit(xs, ys, degree) {
    const n = xs.length, d = degree + 1;
    // Build Vandermonde
    const A = xs.map(x => Array.from({ length: d }, (_, k) => Math.pow(x, k)));
    // Normal equations: Aᵀ A c = Aᵀ y  (solved via simple Gaussian)
    const AtA = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) =>
        A.reduce((s, row) => s + row[i] * row[j], 0)));
    const Aty = Array.from({ length: d }, (_, i) => A.reduce((s, row, r) => s + row[i] * ys[r], 0));
    // Gaussian elimination
    for (let col = 0; col < d; col++) {
        let maxRow = col;
        for (let r = col + 1; r < d; r++) if (Math.abs(AtA[r][col]) > Math.abs(AtA[maxRow][col])) maxRow = r;
        [AtA[col], AtA[maxRow]] = [AtA[maxRow], AtA[col]];
        [Aty[col], Aty[maxRow]] = [Aty[maxRow], Aty[col]];
        for (let r = col + 1; r < d; r++) {
            const f = AtA[r][col] / (AtA[col][col] || 1e-9);
            for (let c = col; c < d; c++) AtA[r][c] -= f * AtA[col][c];
            Aty[r] -= f * Aty[col];
        }
    }
    const coeff = Array(d).fill(0);
    for (let i = d - 1; i >= 0; i--) {
        coeff[i] = (Aty[i] - AtA[i].slice(i + 1).reduce((s, v, k) => s + v * coeff[i + 1 + k], 0)) / (AtA[i][i] || 1e-9);
    }
    return coeff;
}

// K-Means (n iterations, returns assignments + centroids)
function kMeans(pts, k, iters = 30, seed = 42) {
    const r = rng(seed);
    let centroids = pts.slice(0, k).map(p => [...p]);
    let assignments = new Array(pts.length).fill(0);
    for (let it = 0; it < iters; it++) {
        assignments = pts.map(p => {
            let best = 0, bestD = Infinity;
            centroids.forEach((c, ci) => {
                const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
                if (d < bestD) { bestD = d; best = ci; }
            });
            return best;
        });
        centroids = centroids.map((_, ci) => {
            const members = pts.filter((_, i) => assignments[i] === ci);
            if (!members.length) return centroids[ci];
            return [
                members.reduce((s, p) => s + p[0], 0) / members.length,
                members.reduce((s, p) => s + p[1], 0) / members.length,
            ];
        });
    }
    return { assignments, centroids };
}

function hexToRgba(hex, alpha) {
    const rv = parseInt(hex.slice(1, 3), 16);
    const gv = parseInt(hex.slice(3, 5), 16);
    const bv = parseInt(hex.slice(5, 7), 16);
    return `rgba(${rv},${gv},${bv},${alpha})`;
}

// Palette
const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const ALGO_SEQUENCE = [
    'logistic', 'svm', 'knn', 'randomforest', 'naivebayes', 'boosting',
    'linreg', 'polyreg', 'svr',
    'kmeans', 'dbscan', 'hierarchical'
];

const TOOLTIPS = {
    logistic: [
        { id: 'lr_sigmoid', title: 'Sigmoid Probability Surface', desc: 'Maps spatial features to [0,1] probability values.', pos: new THREE.Vector3(0, 2, 0) },
        { id: 'lr_boundary', title: 'Decision Boundary', desc: 'The plane of equidistribution P(y=1) = 0.5.', pos: new THREE.Vector3(0, -2, 0) }
    ],
    svm: [
        { id: 'svm_hyperplane', title: 'Optimal Hyperplane', desc: 'The separating boundary maximizing target margins.', pos: new THREE.Vector3(25, 0, 0) },
        { id: 'svm_support', title: 'Support Vectors', desc: 'Points closest to the margin that lock the boundary in place.', pos: new THREE.Vector3(25 - 1.5, 1, 0) }
    ],
    knn: [
        { id: 'knn_query', title: 'Query Point', desc: 'The test instance we want to classify.', pos: new THREE.Vector3(50, 0.5, 0) },
        { id: 'knn_sphere', title: 'Neighborhood Sphere', desc: 'Expands dynamically to enclose exactly K nearest neighbors.', pos: new THREE.Vector3(50, 0.5, 0) }
    ],
    randomforest: [
        { id: 'rf_tree', title: '3D Decision Tree Structure', desc: 'Feature splits partition the space hierarchically.', pos: new THREE.Vector3(75, 2.5, 0) }
    ],
    naivebayes: [
        { id: 'nb_gauss', title: 'Likelihood Gaussians', desc: 'Concentric distributions representing likelihood P(X|C).', pos: new THREE.Vector3(100, 2, 0) }
    ],
    boosting: [
        { id: 'boosting_surf', title: 'Additive Bumpy Surface', desc: 'Built iteratively by combining weak learner adjustments.', pos: new THREE.Vector3(125, 1.5, 0) }
    ],
    linreg: [
        { id: 'lr_line', title: 'L2 Regression Line', desc: 'Minimizes the sum of squared vertical residuals.', pos: new THREE.Vector3(150, 1.5, 0) }
    ],
    polyreg: [
        { id: 'poly_curve', title: 'Polynomial Fit Ribbon', desc: 'Higher degree introduces curves to capture non-linear trends.', pos: new THREE.Vector3(175, 1.5, 0) }
    ],
    svr: [
        { id: 'svr_tube', title: 'Epsilon-Insensitive Tube', desc: 'Errors within this transparent region are ignored.', pos: new THREE.Vector3(200, 1.5, 0) }
    ],
    kmeans: [
        { id: 'kmeans_centroid', title: 'Cluster Centroid', desc: 'Mathematical cluster center, updated iteratively.', pos: new THREE.Vector3(225, 1.5, 0.5) }
    ],
    dbscan: [
        { id: 'dbscan_core', title: 'Core Point & Epsilon', desc: 'Has at least MinPts neighbors within epsilon radius.', pos: new THREE.Vector3(250 + 1, 1, 0) }
    ],
    hierarchical: [
        { id: 'h_dendro', title: '3D Dendrogram', desc: 'Hierarchical links merging closest clusters from the bottom up.', pos: new THREE.Vector3(275, 2.5, 0) }
    ]
};

const localRNG = (seed) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
};

export default {
    name: 'DocumentationComponent',
    setup() {
        const settings = settingStore();
        return { settings };
    },
    data() {
        return {
            viewMode: '3d',
            activeAlgoId: 'logistic',
            searchQuery: '',
            completedAlgos: [],
            walkthroughPlaying: false,
            walkthroughStep: 0,
            activeTooltips: [],

            activeTab: 'classification',
            openAlgos: ['logistic'],
            cParams: {},
            vizSeeds: {},
            showGuide: false,
            showCompare: { classification: false, regression: false, clustering: false },
            rocThreshold: 0.5,

            tabs: [
                { id: 'classification', label: 'Classification', icon: 'fas fa-tag',          count: 6 },
                { id: 'regression',     label: 'Regression',     icon: 'fas fa-chart-line',   count: 3 },
                { id: 'clustering',     label: 'Clustering',     icon: 'fas fa-object-group', count: 3 },
                { id: 'metrics',        label: 'Metrics & Evaluation', icon: 'fas fa-chart-bar', count: '' },
            ],

            classMetrics: [
                { name: 'Accuracy',  tex: '$$\\text{Acc} = \\frac{TP+TN}{TP+TN+FP+FN}$$', desc: 'Fraction of correct predictions. Misleading on imbalanced data.' },
                { name: 'Precision', tex: '$$P = \\frac{TP}{TP+FP}$$', desc: 'Of predicted positives, how many are truly positive.' },
                { name: 'Recall',    tex: '$$R = \\frac{TP}{TP+FN}$$', desc: 'Of actual positives, how many were correctly detected.' },
                { name: 'F1-Score',  tex: '$$F_1 = 2\\cdot\\frac{P \\cdot R}{P + R}$$', desc: 'Harmonic mean of precision and recall — a single balanced metric.' },
                { name: 'AUC-ROC',   tex: '$$\\text{AUC} = \\int_0^1 \\text{TPR}\\,d(\\text{FPR})$$', desc: 'Area under the ROC curve — measures separability across all thresholds.' },
            ],
            regrMetrics: [
                { name: 'MSE',       tex: '$$\\text{MSE} = \\frac{1}{n}\\sum(y_i - \\hat{y}_i)^2$$', desc: 'Average squared error. Penalises large errors heavily.' },
                { name: 'RMSE',      tex: '$$\\text{RMSE} = \\sqrt{\\text{MSE}}$$', desc: 'Same units as the target variable, easier to interpret than MSE.' },
                { name: 'MAE',       tex: '$$\\text{MAE} = \\frac{1}{n}\\sum|y_i - \\hat{y}_i|$$', desc: 'Average absolute error. Robust to outliers.' },
                { name: 'R-squared', tex: '$$R^2 = 1 - \\frac{\\text{SSE}}{\\text{SST}} = 1 - \\frac{\\sum(y_i-\\hat{y}_i)^2}{\\sum(y_i-\\bar{y})^2}$$', desc: 'Proportion of variance explained. 1 = perfect, 0 = no better than mean.' },
                { name: 'Adjusted R²', tex: '$$\\bar{R}^2 = 1 - \\frac{(1-R^2)(n-1)}{n-p-1}$$', desc: 'Penalises additional features that don\'t improve the model.' },
                { name: 'AIC',       tex: '$$\\text{AIC} = 2k - 2\\ln(\\hat{L})$$', desc: 'Akaike Information Criterion — balances fit and model complexity.' },
            ],

            // ── Classification algorithms ─────────────────────────────────
            classificationAlgos: [
                {
                    id: 'logistic', name: 'Logistic Regression', abbr: 'LR', family: 'Linear · Parametric',
                    color: '#3b82f6', difficulty: 'beginner', speed: 5, interpret: 5, bestFor: 'Linearly separable, probability output',
                    description: 'Logistic Regression models the probability of a class label using the sigmoid function applied to a linear combination of features. It is trained by maximising the log-likelihood (or equivalently minimising binary cross-entropy). Despite its name it is a classification algorithm.',
                    steps: [
                        'Compute the linear score: z = wᵀx + b',
                        'Squash to [0,1] via sigmoid: P(y=1|x) = σ(z)',
                        'Minimise Binary Cross-Entropy loss with gradient descent',
                        'Predict class 1 if P > threshold (default 0.5)',
                    ],
                    formulas: [
                        { label: 'Sigmoid',  tex: '$$\\sigma(z) = \\frac{1}{1+e^{-z}}$$' },
                        { label: 'Loss',     tex: '$$\\mathcal{L} = -\\frac{1}{n}\\sum_{i}[y_i\\log\\hat{p}_i + (1-y_i)\\log(1-\\hat{p}_i)]$$' },
                    ],
                    complexity: { train: 'O(n·d·iter)', predict: 'O(d)' },
                    pros: ['Probabilistic output', 'Fast training & inference', 'Interpretable coefficients', 'Works well when classes are linearly separable'],
                    cons: ['Assumes linear decision boundary', 'Sensitive to outliers', 'Needs feature scaling', 'Struggles with complex patterns'],
                    params: [
                        { key: 'threshold', label: 'Decision threshold', type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.5 },
                        { key: 'steepness', label: 'Weight magnitude', type: 'range', min: 0.5, max: 5, step: 0.5, default: 2 },
                        { key: 'noise',     label: 'Data noise', type: 'range', min: 0.1, max: 2.5, step: 0.1, default: 0.8 },
                    ],
                    hyperparams: [
                        { name: 'C (inv. reg.)', effect: 'Controls regularisation strength', range: '0.001–100', increase: 'When model underfits (high bias)' },
                        { name: 'max_iter',      effect: 'Convergence iterations',           range: '100–1000',  increase: 'When solver does not converge' },
                        { name: 'threshold',     effect: 'Recall/Precision trade-off',       range: '0.1–0.9',   increase: 'To reduce false negatives' },
                    ],
                    math: {
                        objectives: [
                            'Interpret a linear score as log-odds and convert it into probability.',
                            'Derive binary cross-entropy from maximum likelihood.',
                            'Reason about how the threshold trades precision against recall.',
                        ],
                        prerequisites: ['Dot product', 'Log odds', 'Bernoulli likelihood', 'Gradient descent'],
                        definition: {
                            title: 'A Bernoulli conditional model with a linear logit',
                            tex: '$$P(y_i=1\\mid x_i;\\theta)=\\sigma(\\theta^\\top x_i),\\quad \\log\\frac{p_i}{1-p_i}=\\theta^\\top x_i$$',
                            explanation: 'The model is linear in log-odds, not directly linear in probability. This keeps probabilities between 0 and 1 while preserving an interpretable linear boundary.',
                        },
                        derivation: [
                            {
                                title: 'Start from the Bernoulli likelihood',
                                tex: '$$\\mathcal{L}(\\theta)=\\prod_{i=1}^{n}p_i^{y_i}(1-p_i)^{1-y_i}$$',
                                body: 'Each label contributes probability p_i if y_i=1 and probability 1-p_i if y_i=0.',
                            },
                            {
                                title: 'Take negative log-likelihood',
                                tex: '$$-\\ell(\\theta)=-\\sum_i\\left[y_i\\log p_i+(1-y_i)\\log(1-p_i)\\right]$$',
                                body: 'Minimising this expression is exactly binary cross-entropy, so the loss has a probabilistic foundation.',
                            },
                            {
                                title: 'Use the gradient as the correction signal',
                                tex: '$$\\nabla_\\theta J=\\frac{1}{n}X^\\top(\\hat{p}-y)$$',
                                body: 'The term p_hat-y is prediction error in probability space; gradient descent adjusts coefficients toward features correlated with residual class error.',
                            },
                        ],
                        complexityNotes: [
                            { label: 'Training time', bound: 'O(n d iter)', reason: 'Each gradient step multiplies the n by d design matrix by the residual vector.' },
                            { label: 'Prediction time', bound: 'O(d)', reason: 'One dot product theta^T x and one sigmoid evaluation are needed per sample.' },
                            { label: 'Space', bound: 'O(d)', reason: 'The fitted model stores one coefficient per feature plus an intercept.' },
                        ],
                        implementation: [
                            { symbol: 'X', meaning: 'selected numeric feature matrix' },
                            { symbol: 'theta', meaning: 'learned coefficient vector' },
                            { symbol: 'sigma(z)', meaning: 'sigmoid probability transform' },
                            { symbol: 'threshold', meaning: 'probability cutoff used to convert p into a class label' },
                        ],
                        applications: [
                            { title: 'Credit risk or churn', body: 'Odds ratios make feature effects explainable: increasing one feature by one unit multiplies the odds by exp(theta_j).' },
                            { title: 'Medical screening', body: 'The same probability model supports threshold tuning when false negatives and false positives have different costs.' },
                        ],
                        practice: {
                            prompt: 'For z=1.2, compute P(y=1|x) and classify with threshold 0.5.',
                            steps: ['Apply sigma(z)=1/(1+e^-z).', 'sigma(1.2) is approximately 0.768.', 'Compare 0.768 with the threshold 0.5.'],
                            answer: 'The predicted probability is about 76.8%, so the class prediction is 1.',
                        },
                        visualizationLens: 'The sigmoid curve shows why changing coefficient magnitude steepens probability transitions, while moving the threshold shifts the decision cutoff.',
                    },
                },
                {
                    id: 'svm', name: 'Support Vector Machine', abbr: 'SVM', family: 'Kernel · Margin-based',
                    color: '#ef4444', difficulty: 'intermediate', speed: 2, interpret: 2, bestFor: 'High-dim data, non-linear boundaries',
                    description: 'SVM finds the hyperplane that maximises the margin between two classes. Points closest to the boundary are called support vectors. The kernel trick implicitly maps data to high-dimensional spaces, enabling non-linear boundaries without computing coordinates explicitly.',
                    steps: [
                        'Find the maximum-margin hyperplane: wᵀx + b = 0',
                        'Minimise ½‖w‖² subject to yᵢ(wᵀxᵢ+b) ≥ 1',
                        'For soft-margin: add slack variables ξᵢ, penalised by C',
                        'Apply kernel K(xᵢ,xⱼ) for non-linear boundaries',
                    ],
                    formulas: [
                        { label: 'Margin',  tex: '$$\\text{margin} = \\frac{2}{\\|\\mathbf{w}\\|}$$' },
                        { label: 'Hinge',   tex: '$$\\mathcal{L} = \\frac{1}{2}\\|w\\|^2 + C\\sum_i\\max(0,\\, 1-y_i(w^\\top x_i+b))$$' },
                        { label: 'RBF',     tex: '$$K(x,x\') = \\exp\\left(-\\gamma\\|x-x\'\\|^2\\right)$$' },
                    ],
                    complexity: { train: 'O(n²–n³)', predict: 'O(sv·d)' },
                    pros: ['Works in high dimensions', 'Memory-efficient (uses support vectors)', 'Robust to outliers with soft margin', 'Flexible via kernel choice'],
                    cons: ['Slow on large datasets', 'Sensitive to feature scaling', 'Hard to interpret', 'Kernel and C tuning required'],
                    params: [
                        { key: 'C',       label: 'Soft-margin C',  type: 'range', min: 0.1, max: 10,  step: 0.1, default: 1 },
                        { key: 'gamma',   label: 'RBF γ',          type: 'range', min: 0.1, max: 5,   step: 0.1, default: 1 },
                        { key: 'noise',   label: 'Data noise',     type: 'range', min: 0.1, max: 2,   step: 0.1, default: 0.5 },
                    ],
                    hyperparams: [
                        { name: 'C',      effect: 'Penalises misclassified points', range: '0.1–100',  increase: 'Underfitting; allow tighter fit' },
                        { name: 'gamma',  effect: 'RBF kernel width',               range: '0.001–10', increase: 'Decision boundary too smooth' },
                        { name: 'kernel', effect: 'Feature transformation',         range: 'linear/rbf/poly', increase: 'N/A — choose based on data structure' },
                    ],
                    math: {
                        objectives: [
                            'Explain the margin as a geometric distance to a hyperplane.',
                            'Connect hinge loss to soft-margin constraint violations.',
                            'Use kernels as inner products in an implicit feature space.',
                        ],
                        prerequisites: ['Vector norms', 'Hyperplanes', 'Constrained optimisation', 'Inner products'],
                        definition: {
                            title: 'Maximum-margin classifier',
                            tex: '$$\\min_{w,b}\\frac{1}{2}\\|w\\|^2\\quad\\text{s.t.}\\quad y_i(w^\\top x_i+b)\\ge 1$$',
                            explanation: 'Minimising the norm of w maximises the distance between the two supporting margin planes.',
                        },
                        derivation: [
                            {
                                title: 'Distance from a point to the decision boundary',
                                tex: '$$\\operatorname{dist}(x,\\{w^\\top x+b=0\\})=\\frac{|w^\\top x+b|}{\\|w\\|}$$',
                                body: 'For support vectors scaled to y_i(w^T x_i+b)=1, each margin side is 1/||w|| from the boundary.',
                            },
                            {
                                title: 'Maximising margin becomes minimising norm',
                                tex: '$$\\text{full margin}=\\frac{2}{\\|w\\|}\\quad\\Rightarrow\\quad \\max \\text{margin}\\equiv\\min \\frac{1}{2}\\|w\\|^2$$',
                                body: 'The quadratic objective is easier to optimise while preserving the same geometric goal.',
                            },
                            {
                                title: 'Soft margin turns constraints into hinge penalties',
                                tex: '$$\\max(0,1-y_i(w^\\top x_i+b))$$',
                                body: 'Points outside the margin contribute zero loss; points inside or misclassified pay linearly.',
                            },
                        ],
                        complexityNotes: [
                            { label: 'Training time', bound: 'O(n^2) to O(n^3)', reason: 'Kernel SVM optimisation depends on pairwise sample interactions and quadratic programming style updates.' },
                            { label: 'Prediction time', bound: 'O(sv d)', reason: 'Prediction sums kernel similarities over support vectors, not all training samples.' },
                            { label: 'Space', bound: 'O(n^2)', reason: 'Kernel methods may store or repeatedly compute an n by n Gram matrix.' },
                        ],
                        implementation: [
                            { symbol: 'C', meaning: 'penalty for margin violations' },
                            { symbol: 'gamma', meaning: 'RBF kernel locality parameter' },
                            { symbol: 'support vectors', meaning: 'training points with non-zero dual weights' },
                            { symbol: 'K(x,z)', meaning: 'kernel similarity used instead of explicit transformed coordinates' },
                        ],
                        applications: [
                            { title: 'Text classification', body: 'Sparse high-dimensional vectors can be separated by large-margin linear boundaries.' },
                            { title: 'Small scientific datasets', body: 'Kernel margins often work well when n is modest but the feature geometry is non-linear.' },
                        ],
                        practice: {
                            prompt: 'If ||w||=4, what is the full hard-margin width?',
                            steps: ['Use full margin = 2/||w||.', 'Substitute ||w||=4.', 'Compute 2/4.'],
                            answer: 'The full margin width is 0.5.',
                        },
                        visualizationLens: 'The margin band shows that SVM is not just finding any separator; it is choosing the separator with the largest geometric buffer.',
                    },
                },
                {
                    id: 'knn', name: 'K-Nearest Neighbours', abbr: 'KNN', family: 'Instance-based · Lazy',
                    color: '#10b981', difficulty: 'beginner', speed: 2, interpret: 4, bestFor: 'Small datasets, quick baseline',
                    description: 'KNN classifies a new point by majority vote among its k nearest training examples, measured by a distance metric (typically Euclidean). It is a non-parametric, lazy learner — no training phase; all computation happens at prediction time.',
                    steps: [
                        'Store all training examples (no training step)',
                        'For a query point, compute distance to every training point',
                        'Select the k nearest neighbours',
                        'Assign the majority class label among those k neighbours',
                    ],
                    formulas: [
                        { label: 'Euclidean',  tex: '$$d(x,x\') = \\sqrt{\\sum_{j=1}^d (x_j - x\'_j)^2}$$' },
                        { label: 'Decision',   tex: '$$\\hat{y} = \\underset{c}{\\arg\\max}\\sum_{i\\in\\mathcal{N}_k(x)}\\mathbf{1}[y_i=c]$$' },
                    ],
                    complexity: { train: 'O(1)', predict: 'O(n·d)' },
                    pros: ['Simple & intuitive', 'No training time', 'Naturally multi-class', 'Adapts to data structure'],
                    cons: ['Slow at prediction (large datasets)', 'Sensitive to irrelevant features', 'Requires feature scaling', 'High memory usage'],
                    params: [
                        { key: 'k',      label: 'k neighbours',  type: 'range', min: 1,  max: 21, step: 2, default: 5 },
                        { key: 'noise',  label: 'Data noise',    type: 'range', min: 0.2, max: 2,  step: 0.1, default: 0.6 },
                    ],
                    hyperparams: [
                        { name: 'n_neighbors', effect: 'Controls smoothness of boundary', range: '1–30',          increase: 'When boundary is too jagged (overfitting)' },
                        { name: 'metric',      effect: 'Distance measure',                range: 'euclidean/manhattan/cosine', increase: 'N/A — try different metrics' },
                        { name: 'weights',     effect: 'Closer points get more vote',     range: 'uniform/distance', increase: 'N/A — use distance for imbalanced density' },
                    ],
                    math: {
                        objectives: [
                            'Treat classification as local estimation in a metric space.',
                            'Understand how k controls bias and variance of the decision boundary.',
                            'Explain why feature scaling changes neighbourhood geometry.',
                        ],
                        prerequisites: ['Metric spaces', 'Euclidean distance', 'Majority vote', 'Bias-variance trade-off'],
                        definition: {
                            title: 'Local majority vote over nearest neighbours',
                            tex: '$$\\hat{y}(x)=\\arg\\max_c\\sum_{i\\in\\mathcal{N}_k(x)}\\mathbf{1}[y_i=c]$$',
                            explanation: 'The prediction depends only on the labels of the k closest training points under the selected distance metric.',
                        },
                        derivation: [
                            {
                                title: 'Distance defines locality',
                                tex: '$$d(x,z)=\\sqrt{\\sum_{j=1}^{d}(x_j-z_j)^2}$$',
                                body: 'Nearest neighbours are meaningful only when this distance reflects similarity in the problem domain.',
                            },
                            {
                                title: 'Majority vote estimates local class probability',
                                tex: '$$\\hat{P}(y=c\\mid x)=\\frac{1}{k}\\sum_{i\\in\\mathcal{N}_k(x)}\\mathbf{1}[y_i=c]$$',
                                body: 'KNN approximates the conditional class distribution by averaging labels in a small neighbourhood around x.',
                            },
                            {
                                title: 'The k parameter smooths the estimate',
                                tex: '$$k\\uparrow\\Rightarrow\\text{lower variance, higher bias};\\quad k\\downarrow\\Rightarrow\\text{higher variance, lower bias}$$',
                                body: 'Small k follows local noise; large k averages over broader regions and smooths the boundary.',
                            },
                        ],
                        complexityNotes: [
                            { label: 'Training time', bound: 'O(1)', reason: 'Lazy KNN stores the training set and does not fit parameters.' },
                            { label: 'Prediction time', bound: 'O(n d)', reason: 'A brute-force query computes d-dimensional distance to each of n stored examples.' },
                            { label: 'Space', bound: 'O(n d)', reason: 'All training feature vectors must be retained for future distance queries.' },
                        ],
                        implementation: [
                            { symbol: 'N_k(x)', meaning: 'indices of the k closest rows to the query point' },
                            { symbol: 'metric', meaning: 'distance function used to rank neighbours' },
                            { symbol: 'weights', meaning: 'whether each neighbour votes equally or by inverse distance' },
                            { symbol: 'scaling', meaning: 'preprocessing that prevents large-unit features from dominating distance' },
                        ],
                        applications: [
                            { title: 'Recommendation prototypes', body: 'If distance encodes user similarity, neighbour votes become a direct local preference estimate.' },
                            { title: 'Anomaly review', body: 'Large average distance to neighbours can suggest a point is isolated under the chosen metric.' },
                        ],
                        practice: {
                            prompt: 'For k=3, neighbours have labels A, B, A. What class is predicted?',
                            steps: ['Count votes per class.', 'A has 2 votes; B has 1 vote.', 'Choose the class with maximum count.'],
                            answer: 'The predicted class is A.',
                        },
                        visualizationLens: 'The coloured regions are Voronoi-like local voting zones; increasing k smooths those regions by pooling more neighbours.',
                    },
                },
                {
                    id: 'randomforest', name: 'Random Forest', abbr: 'RF', family: 'Ensemble · Bagging',
                    color: '#f59e0b', difficulty: 'intermediate', speed: 3, interpret: 3, bestFor: 'Tabular data, feature importance',
                    description: 'Random Forest is a bagging ensemble of decision trees. Each tree is trained on a bootstrap sample of the data, and at each node only a random subset of features is considered for the split. Averaging predictions across trees reduces variance while maintaining low bias.',
                    steps: [
                        'Draw B bootstrap samples from training data',
                        'For each sample, grow a decision tree — at each split randomly select √d features',
                        'Split on the feature/threshold that minimises Gini impurity (or entropy)',
                        'Aggregate: majority vote (classification) or average (regression)',
                    ],
                    formulas: [
                        { label: 'Gini',     tex: '$$G = \\sum_{k=1}^K p_k(1-p_k)$$' },
                        { label: 'Entropy',  tex: '$$H = -\\sum_{k=1}^K p_k\\log_2 p_k$$' },
                        { label: 'Ensemble', tex: '$$\\hat{y} = \\underset{c}{\\arg\\max}\\sum_{b=1}^B \\mathbf{1}[h_b(x)=c]$$' },
                    ],
                    complexity: { train: 'O(B·n·d·log n)', predict: 'O(B·depth)' },
                    pros: ['Handles high-dimensional data', 'Built-in feature importance', 'Robust to overfitting', 'No scaling needed'],
                    cons: ['Large memory footprint', 'Less interpretable than single tree', 'Slow with many deep trees', 'Biased toward high-cardinality features'],
                    params: [
                        { key: 'trees',     label: 'Number of trees',   type: 'range', min: 5,  max: 60, step: 5,  default: 20 },
                        { key: 'maxDepth',  label: 'Max tree depth',     type: 'range', min: 1,  max: 12, step: 1,  default: 4 },
                        { key: 'features',  label: 'Num features',       type: 'range', min: 2,  max: 10, step: 1,  default: 5 },
                    ],
                    hyperparams: [
                        { name: 'n_estimators',    effect: 'More trees → lower variance',  range: '50–500',    increase: 'When predictions are unstable' },
                        { name: 'max_depth',       effect: 'Depth limits overfitting',      range: '3–20',      increase: 'When model underfits (high bias)' },
                        { name: 'max_features',    effect: 'Diversity of trees',             range: 'sqrt(d)–d', increase: 'When correlation between trees is high' },
                        { name: 'min_samples_leaf',effect: 'Controls leaf node size',        range: '1–20',      increase: 'When overfitting on noisy data' },
                    ],
                },
                {
                    id: 'naivebayes', name: 'Naive Bayes', abbr: 'NB', family: 'Probabilistic · Generative',
                    color: '#8b5cf6', difficulty: 'beginner', speed: 5, interpret: 4, bestFor: 'Text, small data, baselines',
                    description: 'Naive Bayes applies Bayes\' theorem assuming conditional independence of features given the class. Despite this "naive" assumption being often violated, it performs surprisingly well on text classification and spam filtering. Gaussian NB models each feature as a Gaussian per class.',
                    steps: [
                        'Estimate P(y=c) as the prior class probability',
                        'Estimate P(xⱼ|y=c) — Gaussian: fit mean μ & variance σ² per feature per class',
                        'At prediction: P(y=c|x) ∝ P(y=c)·∏ⱼ P(xⱼ|y=c)',
                        'Predict the class with the highest posterior probability',
                    ],
                    formulas: [
                        { label: "Bayes'",   tex: '$$P(y|x) = \\frac{P(x|y)\\,P(y)}{P(x)}$$' },
                        { label: 'Gaussian', tex: '$$P(x_j|y=c) = \\frac{1}{\\sqrt{2\\pi\\sigma_{jc}^2}}\\exp\\!\\left(-\\frac{(x_j-\\mu_{jc})^2}{2\\sigma_{jc}^2}\\right)$$' },
                    ],
                    complexity: { train: 'O(n·d)', predict: 'O(K·d)' },
                    pros: ['Extremely fast', 'Works with very few training samples', 'Handles missing data naturally', 'Scalable to many features'],
                    cons: ['Independence assumption often false', 'Poor probability estimates', 'Dominated by prior for rare classes', 'Struggles with feature interactions'],
                    params: [
                        { key: 'overlap',  label: 'Class overlap',   type: 'range', min: 0.5, max: 3,   step: 0.1, default: 1.5 },
                        { key: 'noise',    label: 'Feature noise',   type: 'range', min: 0.2, max: 2,   step: 0.1, default: 0.7 },
                    ],
                    hyperparams: [
                        { name: 'var_smoothing', effect: 'Adds small value to variance for stability', range: '1e-9–1e-3', increase: 'When probabilities are zero (zero-frequency problem)' },
                        { name: 'priors',        effect: 'Override estimated class priors',             range: 'None or list', increase: 'When training set is imbalanced' },
                    ],
                },
                {
                    id: 'boosting', name: 'Gradient Boosting', abbr: 'GB', family: 'Ensemble · Boosting',
                    color: '#ec4899', difficulty: 'advanced', speed: 3, interpret: 2, bestFor: 'SOTA tabular accuracy, competitions',
                    description: 'Gradient Boosting builds an additive ensemble by iteratively fitting shallow trees to the residuals (negative gradient of the loss) of the current model. Each new tree corrects the errors of the previous ensemble. XGBoost, LightGBM, and CatBoost are modern high-performance implementations.',
                    steps: [
                        'Start with a constant prediction F₀(x) = mean(y)',
                        'Compute pseudo-residuals: rᵢ = −∂L/∂F(xᵢ)',
                        'Fit a shallow tree hₜ to the residuals',
                        'Update model: Fₜ(x) = Fₜ₋₁(x) + η·hₜ(x)',
                        'Repeat for T iterations',
                    ],
                    formulas: [
                        { label: 'Update',    tex: '$$F_t(x) = F_{t-1}(x) + \\eta\\, h_t(x)$$' },
                        { label: 'Residuals', tex: '$$r_i^{(t)} = -\\left[\\frac{\\partial L(y_i, F(x_i))}{\\partial F(x_i)}\\right]_{F=F_{t-1}}$$' },
                    ],
                    complexity: { train: 'O(T·n·d·log n)', predict: 'O(T·depth)' },
                    pros: ['State-of-the-art on tabular data', 'Handles mixed feature types', 'Built-in feature importance', 'Flexible loss functions'],
                    cons: ['More hyperparameters to tune', 'Can overfit with high learning rate', 'Sequential — hard to parallelise', 'Slow to train vs Random Forest'],
                    params: [
                        { key: 'nTrees',   label: 'Boosting rounds',  type: 'range', min: 1,   max: 20,  step: 1,    default: 8 },
                        { key: 'lr',       label: 'Learning rate η',  type: 'range', min: 0.05, max: 1.0, step: 0.05, default: 0.3 },
                        { key: 'noise',    label: 'Data noise',       type: 'range', min: 0.1,  max: 2,   step: 0.1,  default: 0.5 },
                    ],
                    hyperparams: [
                        { name: 'n_estimators',  effect: 'Number of boosting rounds',    range: '50–1000',  increase: 'When model still underfits' },
                        { name: 'learning_rate', effect: 'Step size per iteration',       range: '0.01–0.3', increase: 'N/A — lower rate needs more trees' },
                        { name: 'max_depth',     effect: 'Complexity of each weak tree', range: '2–6',      increase: 'When base learner is too weak' },
                        { name: 'subsample',     effect: 'Stochastic row sampling',      range: '0.5–1.0',  increase: 'N/A — reduce if overfitting' },
                    ],
                },
            ],

            // ── Regression algorithms ─────────────────────────────────────
            regressionAlgos: [
                {
                    id: 'linreg', name: 'Linear Regression', abbr: 'OLS', family: 'Linear · Parametric',
                    color: '#3b82f6', difficulty: 'beginner', speed: 5, interpret: 5, bestFor: 'Linear relationships, fast baselines',
                    description: 'Linear Regression fits a hyperplane y = wᵀx + b to minimise the sum of squared residuals (OLS). The optimal weights have a closed-form solution via the Normal Equations. Gradient descent is preferred for large datasets. Assumptions: linearity, homoscedasticity, independence of errors.',
                    steps: [
                        'Define the linear model: ŷ = wᵀx + b',
                        'Minimise MSE: L = (1/n)‖y − Xw‖²',
                        'Closed form: w* = (XᵀX)⁻¹Xᵀy',
                        'Or gradient descent: w ← w − α·∇L',
                    ],
                    formulas: [
                        { label: 'Model',     tex: '$$\\hat{y} = \\mathbf{w}^\\top \\mathbf{x} + b$$' },
                        { label: 'MSE Loss',  tex: '$$\\mathcal{L} = \\frac{1}{n}\\sum_{i=1}^n (y_i - \\hat{y}_i)^2$$' },
                        { label: 'Normal Eq', tex: '$$\\mathbf{w}^* = (\\mathbf{X}^\\top\\mathbf{X})^{-1}\\mathbf{X}^\\top\\mathbf{y}$$' },
                    ],
                    complexity: { train: 'O(n·d²) or O(n·d·iter)', predict: 'O(d)' },
                    pros: ['Interpretable coefficients', 'Fast training and prediction', 'No hyperparameters (OLS)', 'Well-studied statistical properties'],
                    cons: ['Assumes linear relationship', 'Sensitive to outliers', 'Multicollinearity inflates variance', 'Cannot capture non-linear patterns'],
                    params: [
                        { key: 'noise',  label: 'Noise level',  type: 'range', min: 0.1, max: 3,   step: 0.1, default: 0.8 },
                        { key: 'slope',  label: 'True slope',   type: 'range', min: -3,  max: 3,   step: 0.5, default: 1.5 },
                        { key: 'nPts',   label: 'Data points',  type: 'range', min: 20,  max: 120, step: 10,  default: 50 },
                    ],
                    hyperparams: [
                        { name: 'fit_intercept', effect: 'Include bias term',         range: 'True/False', increase: 'N/A — almost always True' },
                        { name: 'alpha (Ridge)', effect: 'L2 regularisation strength', range: '0.001–100', increase: 'When variance is high (multicollinearity)' },
                        { name: 'l1_ratio (EN)', effect: 'Elastic Net L1/L2 mix',     range: '0–1',        increase: 'To promote sparsity' },
                    ],
                    math: {
                        objectives: [
                            'Interpret least squares as an orthogonal projection problem.',
                            'Derive the normal equations from the MSE gradient.',
                            'Connect residuals to unexplained variation.',
                        ],
                        prerequisites: ['Matrix multiplication', 'Derivatives', 'Vector projection', 'Residuals'],
                        definition: {
                            title: 'Least-squares linear estimator',
                            tex: '$$\\hat{w}=\\arg\\min_w\\|y-Xw\\|_2^2$$',
                            explanation: 'Linear regression chooses the vector of coefficients whose predictions are closest to y in squared Euclidean distance.',
                        },
                        derivation: [
                            {
                                title: 'Write the objective in matrix form',
                                tex: '$$J(w)=(y-Xw)^\\top(y-Xw)$$',
                                body: 'Squaring residuals creates a smooth convex quadratic objective.',
                            },
                            {
                                title: 'Set the gradient to zero',
                                tex: '$$\\nabla_wJ=-2X^\\top(y-Xw)=0$$',
                                body: 'At the minimum, residuals are orthogonal to every column of X.',
                            },
                            {
                                title: 'Solve the normal equations',
                                tex: '$$X^\\top Xw=X^\\top y\\quad\\Rightarrow\\quad w=(X^\\top X)^{-1}X^\\top y$$',
                                body: 'When X^T X is invertible, this gives the closed-form OLS solution.',
                            },
                        ],
                        complexityNotes: [
                            { label: 'Closed-form training', bound: 'O(n d^2 + d^3)', reason: 'Building X^T X costs n d^2 and solving the d by d system costs d^3.' },
                            { label: 'Gradient training', bound: 'O(n d iter)', reason: 'Each iteration computes predictions and gradients across all rows and features.' },
                            { label: 'Prediction time', bound: 'O(d)', reason: 'Prediction is a single dot product w^T x plus an intercept.' },
                        ],
                        implementation: [
                            { symbol: 'X', meaning: 'design matrix of selected features' },
                            { symbol: 'w', meaning: 'learned slope coefficients' },
                            { symbol: 'b', meaning: 'intercept term' },
                            { symbol: 'residual', meaning: 'observed y minus predicted y_hat' },
                        ],
                        applications: [
                            { title: 'Demand forecasting baseline', body: 'Coefficients quantify the average marginal change in demand for one-unit feature changes.' },
                            { title: 'Scientific measurement', body: 'Residual analysis tests whether a linear law plausibly explains the observed relationship.' },
                        ],
                        practice: {
                            prompt: 'For one feature, x=[1,2], y=[2,4], and no intercept, compute w.',
                            steps: ['Use w=(x^T y)/(x^T x).', 'x^T y = 1*2 + 2*4 = 10.', 'x^T x = 1^2 + 2^2 = 5.'],
                            answer: 'w=10/5=2, so the fitted model is y_hat=2x.',
                        },
                        visualizationLens: 'The vertical residual lines show exactly what least squares minimises: the sum of squared distances from points to the fitted line.',
                    },
                },
                {
                    id: 'polyreg', name: 'Polynomial Regression', abbr: 'POLY', family: 'Linear · Non-linear basis',
                    color: '#10b981', difficulty: 'beginner', speed: 4, interpret: 4, bestFor: 'Curved patterns, low-dim data',
                    description: 'Polynomial Regression extends Linear Regression by adding polynomial feature transforms (x², x³, …). The model is still linear in the transformed feature space, so OLS applies. Higher degrees can model complex curves but risk overfitting.',
                    steps: [
                        'Create polynomial features: φ(x) = [1, x, x², …, xᵈ]',
                        'Apply linear regression on the expanded feature matrix',
                        'Monitor training vs validation error to detect overfitting',
                        'Use regularisation (Ridge/Lasso) for high degrees',
                    ],
                    formulas: [
                        { label: 'Model',    tex: '$$\\hat{y} = \\sum_{k=0}^{d} w_k\\, x^k$$' },
                        { label: 'Bias-Var', tex: '$$\\mathbb{E}[(y-\\hat{y})^2] = \\text{Bias}^2 + \\text{Variance} + \\sigma^2$$' },
                    ],
                    complexity: { train: 'O(n·d²)', predict: 'O(d)' },
                    pros: ['Fits non-linear patterns', 'Still interpretable for low degrees', 'Simple extension of Linear Regression', 'No new algorithm needed'],
                    cons: ['High degrees overfit easily', 'Sensitive to outliers', 'Feature matrix explodes for high d', 'Poor extrapolation beyond training range'],
                    params: [
                        { key: 'degree', label: 'Polynomial degree',  type: 'range', min: 1,   max: 9,   step: 1,   default: 3 },
                        { key: 'noise',  label: 'Noise level',        type: 'range', min: 0.1, max: 2,   step: 0.1, default: 0.5 },
                        { key: 'nPts',   label: 'Data points',        type: 'range', min: 15,  max: 80,  step: 5,   default: 30 },
                    ],
                    hyperparams: [
                        { name: 'degree',       effect: 'Model complexity',              range: '1–10',   increase: 'When residuals show clear curvature' },
                        { name: 'alpha (Ridge)', effect: 'Penalises large coefficients', range: '0.001–10', increase: 'When high-degree model overfits' },
                        { name: 'include_bias',  effect: 'Add constant term',            range: 'True/False', increase: 'N/A — almost always True' },
                    ],
                },
                {
                    id: 'svr', name: 'Support Vector Regression', abbr: 'SVR', family: 'Kernel · Margin-based',
                    color: '#ef4444', difficulty: 'intermediate', speed: 2, interpret: 2, bestFor: 'Robust non-linear regression',
                    description: 'SVR finds a function that lies within an ε-tube around the training data while being as flat as possible. Points outside the tube incur a linear penalty. The kernel trick enables non-linear regression. Only support vectors (points on or outside the tube) determine the model.',
                    steps: [
                        'Find f(x) = wᵀx + b minimising ½‖w‖²',
                        'Subject to |yᵢ − f(xᵢ)| ≤ ε + ξᵢ (slack variables)',
                        'Points inside the ε-tube contribute zero to loss',
                        'Apply kernel for non-linear SVR',
                    ],
                    formulas: [
                        { label: 'ε-loss',   tex: '$$L_\\varepsilon(y,\\hat{y}) = \\max(0,\\,|y-\\hat{y}|-\\varepsilon)$$' },
                        { label: 'Dual',     tex: '$$f(x) = \\sum_{i\\in SV}(\\alpha_i-\\alpha_i^*)K(x_i,x) + b$$' },
                    ],
                    complexity: { train: 'O(n²–n³)', predict: 'O(sv·d)' },
                    pros: ['Robust to outliers inside ε-tube', 'Works in high dimensions', 'Flexible via kernel', 'Efficient with support vectors'],
                    cons: ['Slow on large datasets', 'Sensitive to ε and C tuning', 'Requires feature scaling', 'Black-box predictions'],
                    params: [
                        { key: 'epsilon',  label: 'ε-tube width',   type: 'range', min: 0.05, max: 1.5, step: 0.05, default: 0.3 },
                        { key: 'noise',    label: 'Data noise',     type: 'range', min: 0.1,  max: 2,   step: 0.1,  default: 0.5 },
                    ],
                    hyperparams: [
                        { name: 'epsilon', effect: 'Width of insensitive tube', range: '0.01–1.0', increase: 'To allow more tolerance on training errors' },
                        { name: 'C',       effect: 'Penalty for points outside tube', range: '0.1–100', increase: 'When underfitting (increase strictness)' },
                        { name: 'kernel',  effect: 'Non-linear mapping',         range: 'linear/rbf/poly', increase: 'N/A — choose per data shape' },
                    ],
                },
            ],

            // ── Clustering algorithms ─────────────────────────────────────
            clusteringAlgos: [
                {
                    id: 'kmeans', name: 'K-Means Clustering', abbr: 'KM', family: 'Centroid-based · Partitional',
                    color: '#3b82f6', difficulty: 'beginner', speed: 5, interpret: 4, bestFor: 'Spherical clusters, large data',
                    description: 'K-Means partitions n observations into k clusters by iteratively reassigning points to their nearest centroid and updating centroids to the cluster mean. The objective is to minimise within-cluster sum of squares (inertia). K-Means++ improves centroid initialisation.',
                    steps: [
                        'Initialise k centroids (randomly or K-Means++)',
                        'Assign each point to the nearest centroid',
                        'Recompute centroids as the mean of assigned points',
                        'Repeat steps 2–3 until convergence',
                    ],
                    formulas: [
                        { label: 'Inertia',    tex: '$$J = \\sum_{k=1}^{K}\\sum_{x\\in C_k}\\|x - \\mu_k\\|^2$$' },
                        { label: 'Assignment', tex: '$$c^{(i)} = \\underset{k}{\\arg\\min}\\,\\|x^{(i)}-\\mu_k\\|^2$$' },
                    ],
                    complexity: { train: 'O(n·k·d·iter)', predict: 'O(k·d)' },
                    pros: ['Simple and fast', 'Scales to large datasets', 'Easy to interpret', 'Works well for spherical, similar-size clusters'],
                    cons: ['K must be specified', 'Sensitive to initialisation', 'Assumes convex clusters', 'Sensitive to outliers'],
                    params: [
                        { key: 'k',      label: 'Number of clusters k',  type: 'range', min: 2,  max: 8,  step: 1, default: 3 },
                        { key: 'spread', label: 'Cluster spread',         type: 'range', min: 0.3, max: 2, step: 0.1, default: 0.8 },
                    ],
                    hyperparams: [
                        { name: 'n_clusters', effect: 'Number of output clusters', range: '2–20', increase: 'When inertia elbow suggests more structure' },
                        { name: 'init',       effect: 'Centroid initialisation',   range: 'random/k-means++', increase: 'N/A — k-means++ reduces bad initialisations' },
                        { name: 'n_init',     effect: 'Runs with different seeds', range: '3–20', increase: 'When solution quality is inconsistent' },
                    ],
                    math: {
                        objectives: [
                            'Understand clustering as minimising within-cluster squared distance.',
                            'Prove why assignment and update steps never increase inertia.',
                            'Explain why K-Means converges to a local, not necessarily global, optimum.',
                        ],
                        prerequisites: ['Euclidean norm', 'Means as minimisers', 'Coordinate descent', 'Local optimum'],
                        definition: {
                            title: 'Partition data into K sets with minimum inertia',
                            tex: '$$\\min_{C_1,\\dots,C_K}\\sum_{k=1}^{K}\\sum_{x_i\\in C_k}\\|x_i-\\mu_k\\|^2,\\quad \\mu_k=\\frac{1}{|C_k|}\\sum_{x_i\\in C_k}x_i$$',
                            explanation: 'The objective prefers compact clusters whose points lie close to their assigned centroid.',
                        },
                        derivation: [
                            {
                                title: 'Assignment step minimises inertia for fixed centroids',
                                tex: '$$c_i=\\arg\\min_k\\|x_i-\\mu_k\\|^2$$',
                                body: 'Given centroids, each point independently chooses the cluster that contributes the smallest squared distance.',
                            },
                            {
                                title: 'Update step minimises inertia for fixed assignments',
                                tex: '$$\\frac{\\partial}{\\partial\\mu_k}\\sum_{x_i\\in C_k}\\|x_i-\\mu_k\\|^2=0\\Rightarrow \\mu_k=\\frac{1}{|C_k|}\\sum_{x_i\\in C_k}x_i$$',
                                body: 'The arithmetic mean is the unique minimiser of squared distances inside a cluster.',
                            },
                            {
                                title: 'Monotonic decrease gives convergence',
                                tex: '$$J^{(t+1)}\\le J^{(t)}$$',
                                body: 'Each alternating step does not increase inertia, and there are finitely many assignments, so the process eventually stops.',
                            },
                        ],
                        complexityNotes: [
                            { label: 'Training time', bound: 'O(n k d iter)', reason: 'Each iteration compares every point with every centroid in d dimensions.' },
                            { label: 'Prediction time', bound: 'O(k d)', reason: 'A new point is assigned by finding its nearest centroid.' },
                            { label: 'Space', bound: 'O(k d + n)', reason: 'The algorithm stores k centroids and one cluster assignment per point.' },
                        ],
                        implementation: [
                            { symbol: 'K', meaning: 'number of clusters chosen by the user' },
                            { symbol: 'mu_k', meaning: 'centroid for cluster k' },
                            { symbol: 'inertia', meaning: 'within-cluster sum of squared distances' },
                            { symbol: 'n_init', meaning: 'multiple restarts to reduce bad local optima' },
                        ],
                        applications: [
                            { title: 'Customer segmentation', body: 'Centroids act as representative profiles when groups are roughly compact in feature space.' },
                            { title: 'Vector quantisation', body: 'Each centroid is a codebook vector that approximates nearby observations with minimum squared error.' },
                        ],
                        practice: {
                            prompt: 'Cluster C contains points 2, 4, and 10 on a line. What centroid minimises squared distance?',
                            steps: ['For squared loss, the minimising centroid is the mean.', 'Compute (2+4+10)/3.', 'The result is 16/3.'],
                            answer: 'The centroid is approximately 5.33.',
                        },
                        visualizationLens: 'The star markers are centroids; each iteration alternates between nearest-centroid assignment and moving stars to cluster means.',
                    },
                },
                {
                    id: 'dbscan', name: 'DBSCAN', abbr: 'DBS', family: 'Density-based · Non-parametric',
                    color: '#f59e0b', difficulty: 'intermediate', speed: 3, interpret: 3, bestFor: 'Arbitrary shapes, outlier detection',
                    description: 'DBSCAN groups together points that are close in density, marking low-density points as noise. It requires no specification of k, can find arbitrarily-shaped clusters, and is robust to outliers. Core points have at least minPts neighbours within radius ε.',
                    steps: [
                        'Label each point as core (≥minPts within ε), border, or noise',
                        'Start a new cluster from any unvisited core point',
                        'Recursively add density-reachable points to the cluster',
                        'Noise points are not assigned to any cluster',
                    ],
                    formulas: [
                        { label: 'Core cond.',  tex: '$$|\\mathcal{N}_\\varepsilon(p)| \\geq \\text{minPts}$$' },
                        { label: 'Density',     tex: '$$\\mathcal{N}_\\varepsilon(p) = \\{q \\in D : d(p,q) \\leq \\varepsilon\\}$$' },
                    ],
                    complexity: { train: 'O(n log n) with index', predict: 'N/A (transductive)' },
                    pros: ['Finds arbitrary shapes', 'Automatically detects outliers', 'No need to specify k', 'Robust to density variations with HDBSCAN'],
                    cons: ['ε and minPts are hard to tune', 'Struggles with varying densities', 'High-dimensional data is challenging', 'Not scalable to very large datasets without indexing'],
                    params: [
                        { key: 'eps',      label: 'ε radius',   type: 'range', min: 0.3, max: 2.5, step: 0.1, default: 0.8 },
                        { key: 'minPts',   label: 'minPts',     type: 'range', min: 2,   max: 10,  step: 1,   default: 4 },
                        { key: 'noise',    label: 'Noise level', type: 'range', min: 0.1, max: 1.5, step: 0.1, default: 0.3 },
                    ],
                    hyperparams: [
                        { name: 'eps',     effect: 'Neighbourhood radius',      range: '0.1–2.0', increase: 'When too many noise points; merge nearby clusters' },
                        { name: 'min_samples', effect: 'Min points to be core', range: '2–20',    increase: 'To require denser core regions; reduce outlier noise' },
                    ],
                    math: {
                        objectives: [
                            'Define core, border, and noise points using epsilon-neighbourhoods.',
                            'Reason about clusters as connected dense regions rather than spherical sets.',
                            'Justify the role of spatial indexing in DBSCAN complexity.',
                        ],
                        prerequisites: ['Distance metrics', 'Neighbourhoods', 'Graph connectivity', 'Density reachability'],
                        definition: {
                            title: 'Clusters as connected components of density-reachable core points',
                            tex: '$$\\mathcal{N}_\\varepsilon(p)=\\{q\\in D:d(p,q)\\le\\varepsilon\\},\\quad p\\text{ is core if }|\\mathcal{N}_\\varepsilon(p)|\\ge \\text{minPts}$$',
                            explanation: 'DBSCAN forms clusters by expanding from core points whose local neighbourhood is dense enough.',
                        },
                        derivation: [
                            {
                                title: 'Core points certify local density',
                                tex: '$$|\\mathcal{N}_\\varepsilon(p)|\\ge \\text{minPts}$$',
                                body: 'A core point is evidence that the surrounding epsilon ball contains enough samples to be considered dense.',
                            },
                            {
                                title: 'Density reachability builds clusters',
                                tex: '$$p\\to q\\quad\\text{if}\\quad q\\in\\mathcal{N}_\\varepsilon(p)\\text{ and }p\\text{ is core}$$',
                                body: 'Following these directed reachability links expands a dense region without assuming convex or spherical shape.',
                            },
                            {
                                title: 'Noise is failure of density connectivity',
                                tex: '$$x\\text{ is noise if it is not density-reachable from any core point}$$',
                                body: 'Outliers are points that do not belong to any connected dense component.',
                            },
                        ],
                        complexityNotes: [
                            { label: 'Training with index', bound: 'O(n log n)', reason: 'Spatial indexes make epsilon-neighbourhood queries approximately logarithmic in low dimensions.' },
                            { label: 'Training without index', bound: 'O(n^2)', reason: 'Naive range queries compare every point against every other point.' },
                            { label: 'Prediction', bound: 'N/A', reason: 'Classical DBSCAN is transductive; it labels the fitted dataset rather than learning a parametric prediction rule.' },
                        ],
                        implementation: [
                            { symbol: 'eps', meaning: 'radius of the neighbourhood ball' },
                            { symbol: 'minPts', meaning: 'minimum neighbours required for a core point' },
                            { symbol: 'core point', meaning: 'point that can expand a cluster' },
                            { symbol: 'noise', meaning: 'point not density-reachable from any core point' },
                        ],
                        applications: [
                            { title: 'Geospatial hot spots', body: 'Clusters can follow irregular city shapes because density connectivity does not require circular boundaries.' },
                            { title: 'Outlier detection', body: 'Noise labels have a direct mathematical meaning: insufficient local density under eps and minPts.' },
                        ],
                        practice: {
                            prompt: 'With minPts=4, a point has 5 samples in its epsilon-neighbourhood counting itself. Is it core?',
                            steps: ['Compare neighbourhood size with minPts.', '5 is greater than or equal to 4.', 'Therefore the density condition holds.'],
                            answer: 'Yes, the point is a core point.',
                        },
                        visualizationLens: 'Changing epsilon changes the graph of neighbourhood links; clusters appear where enough linked core points form connected dense regions.',
                    },
                },
                {
                    id: 'hierarchical', name: 'Hierarchical Clustering', abbr: 'HC', family: 'Dendrogram · Agglomerative',
                    color: '#8b5cf6', difficulty: 'intermediate', speed: 2, interpret: 4, bestFor: 'Dendrograms, exploratory analysis',
                    description: 'Agglomerative hierarchical clustering builds a tree (dendrogram) by merging the two closest clusters at each step. The linkage criterion defines "closest": single (min), complete (max), average, or Ward (minimises within-cluster variance). Cut the dendrogram at any level to obtain k clusters.',
                    steps: [
                        'Treat each point as its own cluster (n clusters)',
                        'Compute pairwise distances between all clusters',
                        'Merge the two clusters with minimum linkage distance',
                        'Update the distance matrix and repeat until 1 cluster',
                        'Cut dendrogram at desired level to obtain k clusters',
                    ],
                    formulas: [
                        { label: 'Ward',    tex: '$$d(A\\cup B, C) = \\sqrt{\\frac{(|A|+|C|)d_{AC}^2+(|B|+|C|)d_{BC}^2-|C|d_{AB}^2}{|A|+|B|+|C|}}$$' },
                        { label: 'Single',  tex: '$$d(A,B) = \\min_{a\\in A,\\,b\\in B} d(a,b)$$' },
                    ],
                    complexity: { train: 'O(n² log n)', predict: 'O(n²)' },
                    pros: ['No need to specify k in advance', 'Produces a full dendrogram', 'Flexible via linkage choice', 'Deterministic'],
                    cons: ['O(n²) memory', 'Sensitive to outliers (single linkage)', 'Cannot undo bad merges', 'Slow for large datasets'],
                    params: [
                        { key: 'k',       label: 'Number of clusters',  type: 'range', min: 2, max: 7,  step: 1,   default: 3 },
                        { key: 'spread',  label: 'Cluster spread',      type: 'range', min: 0.3, max: 2, step: 0.1, default: 0.7 },
                    ],
                    hyperparams: [
                        { name: 'n_clusters', effect: 'Where to cut the dendrogram',     range: '2–20',              increase: 'When looking for finer structure' },
                        { name: 'linkage',    effect: 'Cluster distance definition',     range: 'ward/complete/single/average', increase: 'N/A — Ward best for compact clusters' },
                        { name: 'affinity',   effect: 'Distance metric',                 range: 'euclidean/cosine/l1', increase: 'N/A — match to data geometry' },
                    ],
                },
            ],
        };
    },

    computed: {
        algoSections() {
            return [
                { key: 'classification', intro: 'Classification algorithms learn a mapping from input features to discrete class labels. Interact with each model below — adjust parameters and observe how the decision boundary changes.', algos: this.classificationAlgos },
                { key: 'regression', intro: 'Regression algorithms predict a continuous numerical output. Explore how each model fits data and how hyperparameters control bias–variance trade-off.', algos: this.regressionAlgos },
                { key: 'clustering', intro: 'Clustering algorithms discover hidden structure in unlabelled data by grouping similar observations. Adjust parameters to see how cluster assignments change.', algos: this.clusteringAlgos },
            ];
        },
        totalAlgosCount() {
            return this.classificationAlgos.length + this.regressionAlgos.length + this.clusteringAlgos.length;
        },
        algoSequence() {
            return ALGO_SEQUENCE;
        },
        activeAlgo() {
            const all = [...this.classificationAlgos, ...this.regressionAlgos, ...this.clusteringAlgos];
            return all.find(a => a.id === this.activeAlgoId) || all[0];
        },
        activeAlgoColor() {
            return this.activeAlgo?.color || '#3b82f6';
        },
        labGroups() {
            const query = this.searchQuery.toLowerCase();
            const filterAlgos = (list) => list.filter(a =>
                a.name.toLowerCase().includes(query) ||
                a.abbr.toLowerCase().includes(query) ||
                a.family.toLowerCase().includes(query)
            );
            return [
                { title: 'Classification', algos: filterAlgos(this.classificationAlgos) },
                { title: 'Regression', algos: filterAlgos(this.regressionAlgos) },
                { title: 'Clustering', algos: filterAlgos(this.clusteringAlgos) }
            ].filter(g => g.algos.length > 0);
        },
    },

    created() {
        this.initAllParams();
    },

    mounted() {
        try {
            const saved = localStorage.getItem('stat_ml_fit_completed_algos');
            if (saved) {
                this.completedAlgos = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading completed algos', e);
        }

        this.$nextTick(() => {
            if (this.viewMode === '3d') {
                this.initThreeD();
            } else {
                this.openAlgos = ['logistic'];
                this.runViz('logistic');
            }
        });
    },

    beforeUnmount() {
        if (this.walkthroughInterval) {
            clearInterval(this.walkthroughInterval);
        }
        this.destroyThreeD();
    },

    watch: {
        activeTab(newTab) {
            if (this.viewMode === '3d') return;
            const firstAlgo = { classification: 'logistic', regression: 'linreg', clustering: 'kmeans' }[newTab];
            if (firstAlgo && !this.openAlgos.includes(firstAlgo)) {
                this.openAlgos = [firstAlgo];
            }
            this.$nextTick(() => {
                if (firstAlgo) this.runViz(firstAlgo);
                if (newTab === 'metrics') this.drawROC();
            });
        },
        'settings.isDark'() {
            this.$nextTick(() => {
                if (this.viewMode === '2d') {
                    this.openAlgos.forEach((id) => this.runViz(id));
                    if (this.activeTab === 'metrics') this.drawROC();
                } else if (this.scene) {
                    this.scene.background = new THREE.Color(this.settings.isDark ? 0xf0f7ff : 0xf8fafc);
                    if (this.scene.fog) {
                        this.scene.fog.color = this.scene.background;
                    }
                }
            });
        },
        viewMode(newMode) {
            this.$nextTick(() => {
                if (newMode === '3d') {
                    this.initThreeD();
                } else {
                    this.destroyThreeD();
                    this.openAlgos = [this.activeAlgoId];
                    this.$nextTick(() => {
                        this.runViz(this.activeAlgoId);
                    });
                }
            });
        },
        activeAlgoId() {
            this.resetWalkthrough();
            this.updateCameraTarget();

            const announcer = document.createElement('div');
            announcer.setAttribute('aria-live', 'polite');
            announcer.style.position = 'absolute';
            announcer.style.width = '1px';
            announcer.style.height = '1px';
            announcer.style.overflow = 'hidden';
            announcer.textContent = `Active 3D representation changed to ${this.activeAlgo.name}. ${this.activeAlgo.description}`;
            document.body.appendChild(announcer);
            setTimeout(() => announcer.remove(), 1000);
        }
    },

    methods: {
        setViewMode(mode) {
            this.viewMode = mode;
        },

        selectAlgo3D(id) {
            this.activeAlgoId = id;
        },

        toggleMastery(id) {
            if (this.completedAlgos.includes(id)) {
                this.completedAlgos = this.completedAlgos.filter(x => x !== id);
            } else {
                this.completedAlgos.push(id);
            }
            try {
                localStorage.setItem('stat_ml_fit_completed_algos', JSON.stringify(this.completedAlgos));
            } catch (e) {
                console.error(e);
            }
            if (this.viewMode === '3d') {
                this._buildLearningPath3D();
            }
        },

        nextAlgo3D() {
            const idx = ALGO_SEQUENCE.indexOf(this.activeAlgoId);
            const nextIdx = (idx + 1) % ALGO_SEQUENCE.length;
            this.activeAlgoId = ALGO_SEQUENCE[nextIdx];
        },

        prevAlgo3D() {
            const idx = ALGO_SEQUENCE.indexOf(this.activeAlgoId);
            const prevIdx = (idx - 1 + ALGO_SEQUENCE.length) % ALGO_SEQUENCE.length;
            this.activeAlgoId = ALGO_SEQUENCE[prevIdx];
        },

        hasWalkthrough(id) {
            return id === 'kmeans';
        },

        getWalkthroughStepText(id, step) {
            if (id === 'kmeans') {
                return [
                    "Initial Centroid Placement: Centroids (octahedrons) are initialized at random positions. Points are assigned to the closest centroid.",
                    "Centroid Drift (Iteration 1): Centroids shift to the average position of their assigned points. Point groupings start to shape.",
                    "Convergence (Final Iteration): Centroids reach the cluster means and stabilize. The clustering is complete."
                ][step] || '';
            }
            return '';
        },

        toggleWalkthrough() {
            this.walkthroughPlaying = !this.walkthroughPlaying;
            if (this.walkthroughPlaying) {
                this.walkthroughInterval = setInterval(() => {
                    this.walkthroughStep = (this.walkthroughStep + 1) % 3;
                    this._updateKMeans3D(this.walkthroughStep);
                }, 2500);
            } else {
                if (this.walkthroughInterval) {
                    clearInterval(this.walkthroughInterval);
                    this.walkthroughInterval = null;
                }
            }
        },

        stepWalkthrough() {
            this.walkthroughPlaying = false;
            if (this.walkthroughInterval) {
                clearInterval(this.walkthroughInterval);
                this.walkthroughInterval = null;
            }
            this.walkthroughStep = (this.walkthroughStep + 1) % 3;
            this._updateKMeans3D(this.walkthroughStep);
        },

        resetWalkthrough() {
            this.walkthroughPlaying = false;
            if (this.walkthroughInterval) {
                clearInterval(this.walkthroughInterval);
                this.walkthroughInterval = null;
            }
            this.walkthroughStep = 0;
            this._updateKMeans3D(0);
        },

        updateParam3D(algoId, key) {
            if (algoId === 'logistic') {
                this._updateLogisticSheet(algoId);
            } else if (algoId === 'svm') {
                this._updateSVM3D();
            } else if (algoId === 'knn') {
                this._updateKNN3D();
            }
        },

        initThreeD() {
            if (!this.$refs.canvasContainer) return;
            const container = this.$refs.canvasContainer;
            const width = container.clientWidth || 600;
            const height = container.clientHeight || 500;

            const graphPalette = getGraphPalette(this.settings.isDark);
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(graphPalette.plotBg);
            this.scene.fog = new THREE.FogExp2(graphPalette.plotBg, 0.008);

            this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
            this.camera.position.set(0, 12, 18);

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;

            container.innerHTML = '';
            container.appendChild(this.renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(10, 20, 15);
            this.scene.add(dirLight);

            const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.4);
            dirLight2.position.set(-10, 10, -10);
            this.scene.add(dirLight2);

            const gridHelper = new THREE.GridHelper(
                600,
                120,
                this.settings.isDark ? 0x7dd3fc : 0x64748b,
                this.settings.isDark ? 0x475569 : 0xcbd5e1
            );
            gridHelper.position.y = -3;
            this.scene.add(gridHelper);

            this.cameraTarget = new THREE.Vector3(0, 0, 0);
            this.cameraLookAt = new THREE.Vector3(0, 0, 0);
            this.orbitRotation = { x: 0.4, y: 0.6 };
            this.targetOrbitRotation = { x: 0.4, y: 0.6 };
            this.zoomDistance = 18;
            this.targetZoomDistance = 18;
            this.isDragging = false;
            this.prevMousePos = { x: 0, y: 0 };

            this.models = {};
            this.algoSequence.forEach((algoId, idx) => {
                const group = new THREE.Group();
                group.position.set(idx * 25, 0, 0);
                this.scene.add(group);
                this.models[algoId] = group;
                this._build3DModelFor(algoId, group);
            });

            this._buildLearningPath3D();
            this._setupInteractionEvents(container);

            window.addEventListener('resize', this.onResize3D);
            this.updateCameraTarget();

            const animateLoop = () => {
                if (!this.renderer || !this.scene || !this.camera) return;
                this.animationFrameId = requestAnimationFrame(animateLoop);

                const time = performance.now() * 0.001;

                this.cameraLookAt.lerp(this.cameraTarget, 0.08);
                this.orbitRotation.x += (this.targetOrbitRotation.x - this.orbitRotation.x) * 0.1;
                this.orbitRotation.y += (this.targetOrbitRotation.y - this.orbitRotation.y) * 0.1;
                this.zoomDistance += (this.targetZoomDistance - this.zoomDistance) * 0.1;

                const offset = new THREE.Vector3(
                    this.zoomDistance * Math.cos(this.orbitRotation.y) * Math.cos(this.orbitRotation.x),
                    this.zoomDistance * Math.sin(this.orbitRotation.x),
                    this.zoomDistance * Math.sin(this.orbitRotation.y) * Math.cos(this.orbitRotation.x)
                );

                const targetCamPos = this.cameraLookAt.clone().add(offset);
                this.camera.position.lerp(targetCamPos, 0.08);
                this.camera.lookAt(this.cameraLookAt);

                this._animateModels(time);
                this.renderer.render(this.scene, this.camera);
                this._updateProjectedTooltips();
            };
            animateLoop();
        },

        destroyThreeD() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            if (this.interactionCleanups) {
                this.interactionCleanups();
                this.interactionCleanups = null;
            }
            window.removeEventListener('resize', this.onResize3D);

            if (this.scene) {
                this.scene.traverse((obj) => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
                this.scene = null;
            }
            this.camera = null;
            this.renderer = null;
            this.models = null;
            this.pathGroup = null;
        },

        resetCamera() {
            this.targetOrbitRotation.x = 0.4;
            this.targetOrbitRotation.y = 0.6;
            this.targetZoomDistance = 18;
        },

        onResize3D() {
            if (!this.renderer || !this.$refs.canvasContainer || !this.camera) return;
            const container = this.$refs.canvasContainer;
            const width = container.clientWidth;
            const height = container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        },

        updateCameraTarget() {
            const idx = this.algoSequence.indexOf(this.activeAlgoId);
            if (idx === -1) return;
            this.cameraTarget.set(idx * 25, 0, 0);
        },

        _buildLearningPath3D() {
            if (this.pathGroup && this.scene) {
                this.scene.remove(this.pathGroup);
            }
            this.pathGroup = new THREE.Group();

            for (let i = 0; i < this.algoSequence.length - 1; i++) {
                const startX = i * 25;
                const isCompleted = this.completedAlgos.includes(this.algoSequence[i]);
                const color = isCompleted ? 0x10b981 : 0x475569;
                const thickness = isCompleted ? 0.08 : 0.04;

                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: isCompleted ? 0.8 : 0.25
                });

                const geometry = new THREE.CylinderGeometry(thickness, thickness, 25, 8);
                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.z = Math.PI / 2;
                mesh.position.set(startX + 12.5, -2.9, 0);

                this.pathGroup.add(mesh);
            }
            if (this.scene) {
                this.scene.add(this.pathGroup);
            }
        },

        _setupInteractionEvents(container) {
            const onMouseDown = (e) => {
                this.isDragging = true;
                this.prevMousePos.x = e.clientX;
                this.prevMousePos.y = e.clientY;
            };

            const onMouseMove = (e) => {
                if (!this.isDragging) return;
                const deltaX = e.clientX - this.prevMousePos.x;
                const deltaY = e.clientY - this.prevMousePos.y;

                this.prevMousePos.x = e.clientX;
                this.prevMousePos.y = e.clientY;

                this.targetOrbitRotation.y -= deltaX * 0.006;
                this.targetOrbitRotation.x = Math.max(
                    -Math.PI / 2.3,
                    Math.min(Math.PI / 2.3, this.targetOrbitRotation.x + deltaY * 0.006)
                );
            };

            const onMouseUp = () => {
                this.isDragging = false;
            };

            const onWheel = (e) => {
                e.preventDefault();
                this.targetZoomDistance = Math.max(
                    6,
                    Math.min(35, this.targetZoomDistance + e.deltaY * 0.015)
                );
            };

            const onTouchStart = (e) => {
                if (e.touches.length === 1) {
                    this.isDragging = true;
                    this.prevMousePos.x = e.touches[0].clientX;
                    this.prevMousePos.y = e.touches[0].clientY;
                }
            };

            const onTouchMove = (e) => {
                if (!this.isDragging || e.touches.length !== 1) return;
                const deltaX = e.touches[0].clientX - this.prevMousePos.x;
                const deltaY = e.touches[0].clientY - this.prevMousePos.y;

                this.prevMousePos.x = e.touches[0].clientX;
                this.prevMousePos.y = e.touches[0].clientY;

                this.targetOrbitRotation.y -= deltaX * 0.008;
                this.targetOrbitRotation.x = Math.max(
                    -Math.PI / 2.3,
                    Math.min(Math.PI / 2.3, this.targetOrbitRotation.x + deltaY * 0.008)
                );
            };

            container.addEventListener('mousedown', onMouseDown);
            container.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            container.addEventListener('wheel', onWheel, { passive: false });

            container.addEventListener('touchstart', onTouchStart);
            container.addEventListener('touchmove', onTouchMove);
            window.addEventListener('touchend', onMouseUp);

            this.interactionCleanups = () => {
                container.removeEventListener('mousedown', onMouseDown);
                container.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                container.removeEventListener('wheel', onWheel);
                container.removeEventListener('touchstart', onTouchStart);
                container.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onMouseUp);
            };
        },

        _build3DModelFor(id, group) {
            const r = localRNG(id.charCodeAt(0) + id.charCodeAt(id.length - 1));

            if (!this.dynamicData) this.dynamicData = {};
            this.dynamicData[id] = {};

            switch (id) {
                case 'logistic': {
                    const ptGeom = new THREE.SphereGeometry(0.18, 8, 8);
                    const mat0 = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
                    const mat1 = new THREE.MeshPhongMaterial({ color: 0xef4444 });

                    const points = [];
                    for (let i = 0; i < 40; i++) {
                        const x = (r() - 0.5) * 8;
                        const z = (r() - 0.5) * 8;
                        const prob = 1 / (1 + Math.exp(-2 * x));
                        const label = r() < prob ? 1 : 0;
                        const y = label === 1 ? 1.5 + r() * 0.5 : -1.5 - r() * 0.5;

                        const mesh = new THREE.Mesh(ptGeom, label === 1 ? mat1 : mat0);
                        mesh.position.set(x, y, z);
                        group.add(mesh);
                        points.push({ x, y, z, label });
                    }
                    this.dynamicData[id].points = points;

                    const sheetGeom = new THREE.PlaneGeometry(8, 8, 16, 16);
                    sheetGeom.rotateX(-Math.PI / 2);

                    const sheetMat = new THREE.MeshPhongMaterial({
                        vertexColors: true,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.7,
                        wireframe: false
                    });

                    const sheetMesh = new THREE.Mesh(sheetGeom, sheetMat);
                    group.add(sheetMesh);
                    this.dynamicData[id].sheetMesh = sheetMesh;
                    this._updateLogisticSheet(id);
                    break;
                }
                case 'svm': {
                    const margin = 1.5;
                    const ptGeom = new THREE.SphereGeometry(0.18, 8, 8);
                    const mat0 = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
                    const mat1 = new THREE.MeshPhongMaterial({ color: 0xef4444 });
                    const matSV = new THREE.MeshPhongMaterial({ color: 0xf59e0b });
                    const ringGeom = new THREE.RingGeometry(0.28, 0.32, 16);
                    ringGeom.rotateX(-Math.PI/2);
                    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });

                    for (let i = 0; i < 35; i++) {
                        const isClass1 = r() > 0.5;
                        let x = isClass1 ? margin + r() * 2.5 : -margin - r() * 2.5;
                        const z = (r() - 0.5) * 6;
                        const y = (r() - 0.5) * 2;

                        const isSV = Math.abs(x) < margin + 0.3 && r() > 0.4;
                        if (isSV) {
                            x = isClass1 ? margin : -margin;
                        }

                        const mesh = new THREE.Mesh(ptGeom, isSV ? matSV : (isClass1 ? mat1 : mat0));
                        mesh.position.set(x, y, z);
                        group.add(mesh);

                        if (isSV) {
                            const ring = new THREE.Mesh(ringGeom, ringMat);
                            ring.position.set(x, y, z);
                            group.add(ring);
                        }
                    }

                    const planeGeom = new THREE.PlaneGeometry(6, 6);
                    planeGeom.rotateY(Math.PI / 2);
                    const planeMat = new THREE.MeshPhongMaterial({
                        color: 0x64748b,
                        transparent: true,
                        opacity: 0.4,
                        side: THREE.DoubleSide
                    });
                    const boundary = new THREE.Mesh(planeGeom, planeMat);
                    boundary.position.set(0, 0, 0);
                    group.add(boundary);
                    this.dynamicData[id].boundary = boundary;

                    const marginMat = new THREE.MeshPhongMaterial({
                        color: 0x94a3b8,
                        transparent: true,
                        opacity: 0.15,
                        side: THREE.DoubleSide,
                        wireframe: true
                    });
                    const margin1 = new THREE.Mesh(planeGeom, marginMat);
                    margin1.position.set(-margin, 0, 0);
                    group.add(margin1);
                    this.dynamicData[id].margin1 = margin1;

                    const margin2 = new THREE.Mesh(planeGeom, marginMat);
                    margin2.position.set(margin, 0, 0);
                    group.add(margin2);
                    this.dynamicData[id].margin2 = margin2;
                    break;
                }
                case 'knn': {
                    const ptGeom = new THREE.SphereGeometry(0.18, 8, 8);
                    const mats = [
                        new THREE.MeshPhongMaterial({ color: 0x3b82f6 }),
                        new THREE.MeshPhongMaterial({ color: 0xef4444 }),
                        new THREE.MeshPhongMaterial({ color: 0x10b981 })
                    ];

                    const points = [];
                    for (let i = 0; i < 35; i++) {
                        const x = (r() - 0.5) * 8;
                        const y = (r() - 0.5) * 5;
                        const z = (r() - 0.5) * 8;
                        const label = Math.floor(r() * 3);

                        const mesh = new THREE.Mesh(ptGeom, mats[label]);
                        mesh.position.set(x, y, z);
                        group.add(mesh);

                        points.push({ x, y, z, label, mesh });
                    }
                    this.dynamicData[id].points = points;

                    const qGeom = new THREE.SphereGeometry(0.25, 12, 12);
                    const qMat = new THREE.MeshPhongMaterial({ color: 0xf59e0b });
                    const queryMesh = new THREE.Mesh(qGeom, qMat);
                    queryMesh.position.set(0, 0.5, 0);
                    group.add(queryMesh);
                    this.dynamicData[id].queryMesh = queryMesh;

                    const sphereGeom = new THREE.SphereGeometry(1.0, 32, 16);
                    const sphereMat = new THREE.MeshPhongMaterial({
                        color: 0xf59e0b,
                        transparent: true,
                        opacity: 0.15,
                        wireframe: true
                    });
                    const searchSphere = new THREE.Mesh(sphereGeom, sphereMat);
                    searchSphere.position.set(0, 0.5, 0);
                    group.add(searchSphere);
                    this.dynamicData[id].searchSphere = searchSphere;

                    const lineGeom = new THREE.BufferGeometry();
                    const lineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 1.5 });
                    const lines = new THREE.LineSegments(lineGeom, lineMat);
                    group.add(lines);
                    this.dynamicData[id].lines = lines;

                    this._updateKNN3D();
                    break;
                }
                case 'randomforest': {
                    const drawBranch = (startX, startY, startZ, endX, endY, endZ, thickness) => {
                        const start = new THREE.Vector3(startX, startY, startZ);
                        const end = new THREE.Vector3(endX, endY, endZ);
                        const distance = start.distanceTo(end);

                        const geom = new THREE.CylinderGeometry(thickness * 0.7, thickness, distance, 8);
                        const mat = new THREE.MeshPhongMaterial({ color: 0x475569 });
                        const cylinder = new THREE.Mesh(geom, mat);

                        cylinder.position.copy(start).add(end).multiplyScalar(0.5);
                        cylinder.lookAt(end);
                        cylinder.rotateX(Math.PI / 2);

                        group.add(cylinder);
                    };

                    drawBranch(0, -2.5, 0, 0, -1, 0, 0.2);
                    const splitGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
                    const splitMat = new THREE.MeshPhongMaterial({ color: 0xf59e0b });
                    const split1 = new THREE.Mesh(splitGeom, splitMat);
                    split1.position.set(0, -1, 0);
                    group.add(split1);

                    drawBranch(0, -1, 0, -2, 0.5, 0, 0.15);
                    drawBranch(0, -1, 0, 2, 0.5, 0, 0.15);

                    const splitL = new THREE.Mesh(splitGeom, splitMat);
                    splitL.position.set(-2, 0.5, 0);
                    group.add(splitL);

                    const splitR = new THREE.Mesh(splitGeom, splitMat);
                    splitR.position.set(2, 0.5, 0);
                    group.add(splitR);

                    drawBranch(-2, 0.5, 0, -3, 1.8, -1, 0.1);
                    drawBranch(-2, 0.5, 0, -1, 1.8, 1, 0.1);
                    drawBranch(2, 0.5, 0, 1, 1.8, -1, 0.1);
                    drawBranch(2, 0.5, 0, 3, 1.8, 1, 0.1);

                    const leafGeom = new THREE.SphereGeometry(0.25, 8, 8);
                    const blueLeaf = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
                    const redLeaf = new THREE.MeshPhongMaterial({ color: 0xef4444 });

                    const leafPositions = [
                        { pos: new THREE.Vector3(-3, 1.8, -1), mat: blueLeaf },
                        { pos: new THREE.Vector3(-1, 1.8, 1), mat: redLeaf },
                        { pos: new THREE.Vector3(1, 1.8, -1), mat: blueLeaf },
                        { pos: new THREE.Vector3(3, 1.8, 1), mat: redLeaf }
                    ];

                    leafPositions.forEach(leaf => {
                        const m = new THREE.Mesh(leafGeom, leaf.mat);
                        m.position.copy(leaf.pos);
                        group.add(m);
                    });
                    break;
                }
                case 'naivebayes': {
                    const densityGeom = new THREE.BufferGeometry();
                    const vertices = [];
                    const lineIndices = [];

                    const makeBell = (cx, colorHex, indicesOffset) => {
                        const ptCount = 30;
                        const scale = 2.5;
                        const vList = [];

                        for (let i = 0; i <= ptCount; i++) {
                            const theta = (i / ptCount) * Math.PI * 2;
                            const cosT = Math.cos(theta);
                            const sinT = Math.sin(theta);

                            for (let r = 0; r <= 10; r++) {
                                const dist = (r / 10) * 3;
                                const x = cx + cosT * dist;
                                const z = sinT * dist;
                                const y = scale * Math.exp(-0.6 * dist * dist) - 2;
                                vList.push(x, y, z);
                            }
                        }

                        const ringSize = 11;
                        for (let i = 0; i < ptCount; i++) {
                            for (let r = 0; r < ringSize - 1; r++) {
                                const idx1 = i * ringSize + r + indicesOffset;
                                const idx2 = idx1 + 1;
                                const idx3 = ((i + 1) % ptCount) * ringSize + r + indicesOffset;

                                lineIndices.push(idx1, idx2);
                                lineIndices.push(idx1, idx3);
                            }
                        }
                        return vList;
                    };

                    const v0 = makeBell(-2, 0x3b82f6, 0);
                    const v1 = makeBell(2, 0xef4444, v0.length / 3);
                    const allVerts = [...v0, ...v1];

                    densityGeom.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
                    densityGeom.setIndex(lineIndices);

                    const lineMat = new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.4 });
                    const humps = new THREE.LineSegments(densityGeom, lineMat);
                    group.add(humps);

                    const ptGeom = new THREE.SphereGeometry(0.12, 8, 8);
                    const mat0 = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
                    const mat1 = new THREE.MeshPhongMaterial({ color: 0xef4444 });

                    for (let i = 0; i < 20; i++) {
                        const isClass1 = r() > 0.5;
                        const cx = isClass1 ? 2 : -2;
                        const x = cx + (r() - 0.5) * 3;
                        const z = (r() - 0.5) * 3;
                        const y = -2;
                        const m = new THREE.Mesh(ptGeom, isClass1 ? mat1 : mat0);
                        m.position.set(x, y, z);
                        group.add(m);
                    }
                    break;
                }
                case 'boosting': {
                    const surfGeom = new THREE.PlaneGeometry(8, 8, 20, 20);
                    surfGeom.rotateX(-Math.PI/2);

                    const pos = surfGeom.attributes.position;
                    const bumps = [
                        { cx: -1.5, cz: -1.5, h: 1.2, w: 1.5 },
                        { cx: 1.5, cz: 1.5, h: -1.0, w: 2.0 },
                        { cx: -2.0, cz: 2.0, h: 0.8, w: 1.0 },
                        { cx: 2.0, cz: -2.0, h: -0.6, w: 1.2 }
                    ];

                    const colors = [];
                    for (let i = 0; i < pos.count; i++) {
                        const x = pos.getX(i);
                        const z = pos.getZ(i);

                        let y = -1.0;
                        bumps.forEach(b => {
                            const dSq = (x - b.cx)**2 + (z - b.cz)**2;
                            y += b.h * Math.exp(-dSq / (2 * b.w**2));
                        });

                        pos.setY(i, y);

                        const val = (y + 2) / 4;
                        const c = new THREE.Color().lerpColors(new THREE.Color(0x3b82f6), new THREE.Color(0xec4899), val);
                        colors.push(c.r, c.g, c.b);
                    }
                    surfGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                    surfGeom.computeVertexNormals();

                    const surfMat = new THREE.MeshPhongMaterial({
                        vertexColors: true,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.75
                    });
                    const surface = new THREE.Mesh(surfGeom, surfMat);
                    group.add(surface);

                    const ptGeom = new THREE.SphereGeometry(0.14, 8, 8);
                    const mat0 = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
                    const mat1 = new THREE.MeshPhongMaterial({ color: 0xec4899 });
                    for (let i = 0; i < 30; i++) {
                        const x = (r() - 0.5) * 8;
                        const z = (r() - 0.5) * 8;

                        let surfY = -1.0;
                        bumps.forEach(b => {
                            const dSq = (x - b.cx)**2 + (z - b.cz)**2;
                            surfY += b.h * Math.exp(-dSq / (2 * b.w**2));
                        });

                        const label = surfY > -0.5 ? 1 : 0;
                        const y = surfY + (r() - 0.5) * 1.5;
                        const mesh = new THREE.Mesh(ptGeom, label === 1 ? mat1 : mat0);
                        mesh.position.set(x, y, z);
                        group.add(mesh);
                    }
                    break;
                }
                case 'linreg': {
                    const points = [];
                    const ptGeom = new THREE.SphereGeometry(0.15, 8, 8);
                    const ptMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });

                    for (let i = 0; i < 25; i++) {
                        const x = (r() - 0.5) * 8;
                        const z = (r() - 0.5) * 3;
                        const y = 0.5 * x - 0.5 + (r() - 0.5) * 1.2;

                        const mesh = new THREE.Mesh(ptGeom, ptMat);
                        mesh.position.set(x, y, z);
                        group.add(mesh);

                        points.push({ x, y, z, mesh });
                    }
                    this.dynamicData[id].points = points;

                    const lineGeom = new THREE.CylinderGeometry(0.08, 0.08, 10, 8);
                    lineGeom.rotateZ(Math.PI/2);
                    const lineMat = new THREE.MeshPhongMaterial({ color: 0x10b981 });
                    const fitLine = new THREE.Mesh(lineGeom, lineMat);
                    group.add(fitLine);
                    this.dynamicData[id].fitLine = fitLine;

                    const resGeom = new THREE.BufferGeometry();
                    const resMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
                    const residuals = new THREE.LineSegments(resGeom, resMat);
                    group.add(residuals);
                    this.dynamicData[id].residuals = residuals;

                    this._updateLinReg3D();
                    break;
                }
                case 'polyreg': {
                    const points = [];
                    const ptGeom = new THREE.SphereGeometry(0.15, 8, 8);
                    const ptMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });

                    for (let i = 0; i < 25; i++) {
                        const x = (r() - 0.5) * 8;
                        const z = (r() - 0.5) * 3;
                        const y = 0.06 * x**3 - 0.15 * x**2 - 0.3 * x + (r() - 0.5) * 1.2;

                        const mesh = new THREE.Mesh(ptGeom, ptMat);
                        mesh.position.set(x, y, z);
                        group.add(mesh);

                        points.push({ x, y, z, mesh });
                    }
                    this.dynamicData[id].points = points;

                    const ribbonGeom = new THREE.PlaneGeometry(8.5, 3.5, 30, 2);
                    ribbonGeom.rotateX(-Math.PI/2);
                    const ribbonMat = new THREE.MeshPhongMaterial({
                        color: 0x10b981,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.65
                    });
                    const fitRibbon = new THREE.Mesh(ribbonGeom, ribbonMat);
                    group.add(fitRibbon);
                    this.dynamicData[id].fitRibbon = fitRibbon;

                    this._updatePolyReg3D();
                    break;
                }
                case 'svr': {
                    const points = [];
                    const ptGeom = new THREE.SphereGeometry(0.15, 8, 8);
                    const ptMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });

                    for (let i = 0; i < 25; i++) {
                        const x = (r() - 0.5) * 8;
                        const z = (r() - 0.5) * 2;
                        const y = Math.sin(x * 0.75) * 1.8 + (r() - 0.5) * 1.2;

                        const mesh = new THREE.Mesh(ptGeom, ptMat);
                        mesh.position.set(x, y, z);
                        group.add(mesh);

                        points.push({ x, y, z, mesh });
                    }
                    this.dynamicData[id].points = points;

                    const ribbonGeom = new THREE.PlaneGeometry(8, 2.5, 30, 2);
                    ribbonGeom.rotateX(-Math.PI/2);
                    const ribbonMat = new THREE.MeshPhongMaterial({
                        color: 0x10b981,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.6
                    });
                    const fitRibbon = new THREE.Mesh(ribbonGeom, ribbonMat);
                    group.add(fitRibbon);
                    this.dynamicData[id].fitRibbon = fitRibbon;

                    const tubeGeom = new THREE.PlaneGeometry(8, 2.5, 30, 2);
                    tubeGeom.rotateX(-Math.PI/2);
                    const tubeMat = new THREE.MeshPhongMaterial({
                        color: 0x10b981,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.15,
                        wireframe: true
                    });
                    const epsilonTube = new THREE.Mesh(tubeGeom, tubeMat);
                    group.add(epsilonTube);
                    this.dynamicData[id].epsilonTube = epsilonTube;

                    this._updateSVR3D();
                    break;
                }
                case 'kmeans': {
                    const clusters = [
                        { center: new THREE.Vector3(-2.2, -1, -1.5), color: 0x3b82f6, pts: [] },
                        { center: new THREE.Vector3(2.2, 1.2, -1.0), color: 0xef4444, pts: [] },
                        { center: new THREE.Vector3(0.5, -0.8, 2.2), color: 0x10b981, pts: [] }
                    ];

                    const ptGeom = new THREE.SphereGeometry(0.14, 8, 8);
                    const defaultMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8 });

                    const allPoints = [];
                    clusters.forEach((c, ci) => {
                        for (let i = 0; i < 15; i++) {
                            const offset = new THREE.Vector3(
                                (r() - 0.5) * 2.2,
                                (r() - 0.5) * 2.2,
                                (r() - 0.5) * 2.2
                            );
                            const pos = c.center.clone().add(offset);
                            const m = new THREE.Mesh(ptGeom, defaultMat);
                            m.position.copy(pos);
                            group.add(m);

                            allPoints.push({ pos, mesh: m, actualCluster: ci });
                        }
                    });
                    this.dynamicData[id].points = allPoints;

                    const centGeom = new THREE.OctahedronGeometry(0.35, 0);
                    const centroids = [
                        { mesh: new THREE.Mesh(centGeom, new THREE.MeshPhongMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.4 })), startPos: new THREE.Vector3(-4, 0, 0), currentPos: new THREE.Vector3(), targetPos: new THREE.Vector3(-2.2, -1, -1.5) },
                        { mesh: new THREE.Mesh(centGeom, new THREE.MeshPhongMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 })), startPos: new THREE.Vector3(4, 0, 0), currentPos: new THREE.Vector3(), targetPos: new THREE.Vector3(2.2, 1.2, -1.0) },
                        { mesh: new THREE.Mesh(centGeom, new THREE.MeshPhongMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.4 })), startPos: new THREE.Vector3(0, 0, 4), currentPos: new THREE.Vector3(), targetPos: new THREE.Vector3(0.5, -0.8, 2.2) }
                    ];

                    centroids.forEach(cent => {
                        cent.currentPos.copy(cent.startPos);
                        cent.mesh.position.copy(cent.currentPos);
                        group.add(cent.mesh);
                    });
                    this.dynamicData[id].centroids = centroids;

                    const linesGeom = new THREE.BufferGeometry();
                    const linesMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25 });
                    const lines = new THREE.LineSegments(linesGeom, linesMat);
                    group.add(lines);
                    this.dynamicData[id].lines = lines;

                    this._updateKMeans3D(0);
                    break;
                }
                case 'dbscan': {
                    const clusters = [
                        { center: new THREE.Vector3(-2, 0.5, -1), color: 0x3b82f6, count: 18 },
                        { center: new THREE.Vector3(2, -0.5, 1.5), color: 0xef4444, count: 16 }
                    ];

                    const ptGeom = new THREE.SphereGeometry(0.15, 8, 8);
                    const coreMat = new THREE.MeshPhongMaterial({ color: 0x10b981 });
                    const borderMat = new THREE.MeshPhongMaterial({ color: 0x8b5cf6 });
                    const noiseMat = new THREE.MeshPhongMaterial({ color: 0x64748b });

                    const points = [];
                    clusters.forEach((c, ci) => {
                        for (let i = 0; i < c.count; i++) {
                            const dist = r() * 1.5;
                            const theta = r() * Math.PI * 2;
                            const phi = r() * Math.PI;
                            const pos = c.center.clone().add(new THREE.Vector3(
                                dist * Math.cos(theta) * Math.sin(phi),
                                dist * Math.sin(theta) * Math.sin(phi),
                                dist * Math.cos(phi)
                            ));

                            const isCore = dist < 1.0;
                            const mesh = new THREE.Mesh(ptGeom, isCore ? coreMat : borderMat);
                            mesh.position.copy(pos);
                            group.add(mesh);

                            points.push({ pos, isCore, isBorder: !isCore, label: ci, mesh });
                        }
                    });

                    const noisePoints = [
                        new THREE.Vector3(-4, -1, 3),
                        new THREE.Vector3(4, 2, -2),
                        new THREE.Vector3(0, 3, -3),
                        new THREE.Vector3(3, -2, -3)
                    ];
                    noisePoints.forEach(pos => {
                        const mesh = new THREE.Mesh(ptGeom, noiseMat);
                        mesh.position.copy(pos);
                        group.add(mesh);
                        points.push({ pos, isCore: false, isBorder: false, isNoise: true, mesh });
                    });

                    const corePoints = points.filter(p => p.isCore);
                    const circleGeom = new THREE.RingGeometry(0.48, 0.52, 16);
                    circleGeom.rotateX(-Math.PI/2);
                    const circleMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.15, side: THREE.DoubleSide });

                    corePoints.slice(0, 8).forEach(cp => {
                        const circle = new THREE.Mesh(circleGeom, circleMat);
                        circle.position.copy(cp.pos);
                        group.add(circle);
                    });
                    break;
                }
                case 'hierarchical': {
                    const points = [
                        new THREE.Vector3(-3, -2, -1.5),
                        new THREE.Vector3(-2.2, -2, -1),
                        new THREE.Vector3(-1.2, -2, 0.5),
                        new THREE.Vector3(0.5, -2, -0.5),
                        new THREE.Vector3(1.5, -2, 1),
                        new THREE.Vector3(3, -2, -1)
                    ];

                    const ptGeom = new THREE.SphereGeometry(0.18, 8, 8);
                    const ptMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });

                    points.forEach(pos => {
                        const m = new THREE.Mesh(ptGeom, ptMat);
                        m.position.copy(pos);
                        group.add(m);
                    });

                    const drawDendroBranch = (p1, p2, height) => {
                        const mid = p1.clone().add(p2).multiplyScalar(0.5);

                        const v1Geom = new THREE.CylinderGeometry(0.04, 0.04, height - p1.y, 8);
                        const v1Mat = new THREE.MeshPhongMaterial({ color: 0x8b5cf6 });
                        const v1 = new THREE.Mesh(v1Geom, v1Mat);
                        v1.position.set(p1.x, (p1.y + height) * 0.5, p1.z);
                        group.add(v1);

                        const v2 = new THREE.Mesh(v1Geom, v1Mat);
                        v2.position.set(p2.x, (p2.y + height) * 0.5, p2.z);
                        group.add(v2);

                        const hLen = p1.distanceTo(p2);
                        const hGeom = new THREE.CylinderGeometry(0.04, 0.04, hLen, 8);
                        const h = new THREE.Mesh(hGeom, v1Mat);
                        h.position.set(mid.x, height, mid.z);
                        h.lookAt(p2.x, height, p2.z);
                        h.rotateX(Math.PI/2);
                        group.add(h);

                        return new THREE.Vector3(mid.x, height, mid.z);
                    };

                    const n0 = drawDendroBranch(points[0], points[1], -1.0);
                    const n1 = drawDendroBranch(points[3], points[4], -1.2);
                    const n2 = drawDendroBranch(points[2], n1, -0.4);
                    const n3 = drawDendroBranch(points[5], n2, 0.4);
                    const n4 = drawDendroBranch(n0, n3, 1.5);
                    break;
                }
            }
        },

        _updateProjectedTooltips() {
            if (!this.renderer || !this.camera) return;
            const container = this.$refs.canvasContainer;
            if (!container) return;

            const width = container.clientWidth;
            const height = container.clientHeight;
            const tempV = new THREE.Vector3();

            const list = TOOLTIPS[this.activeAlgoId] || [];
            this.activeTooltips = list.map(t => {
                tempV.copy(t.pos);
                tempV.project(this.camera);

                const isBehind = tempV.z > 1;
                const x = (tempV.x * 0.5 + 0.5) * width;
                const y = (-(tempV.y * 0.5) + 0.5) * height;

                return {
                    ...t,
                    x,
                    y,
                    visible: !isBehind && x >= 0 && x <= width && y >= 0 && y <= height
                };
            }).filter(t => t.visible);
        },

        _animateModels(time) {
            const knnData = this.dynamicData['knn'];
            if (knnData && knnData.queryMesh) {
                const s = 1.0 + 0.15 * Math.sin(time * 6);
                knnData.queryMesh.scale.set(s, s, s);
            }

            const kmeansData = this.dynamicData['kmeans'];
            if (kmeansData && kmeansData.centroids) {
                let needsLineUpdate = false;
                kmeansData.centroids.forEach(c => {
                    const dist = c.currentPos.distanceTo(c.targetPos);
                    if (dist > 0.01) {
                        c.currentPos.lerp(c.targetPos, 0.08);
                        c.mesh.position.copy(c.currentPos);
                        needsLineUpdate = true;
                    }
                });

                if (needsLineUpdate && kmeansData.lines) {
                    const linePositions = [];
                    kmeansData.points.forEach(p => {
                        let assignedIdx = p.actualCluster;
                        if (this.walkthroughStep === 0) {
                            let minD = Infinity, bestIdx = 0;
                            kmeansData.centroids.forEach((c, ci) => {
                                const d = p.pos.distanceTo(c.currentPos);
                                if (d < minD) { minD = d; bestIdx = ci; }
                            });
                            assignedIdx = bestIdx;
                        }
                        const c = kmeansData.centroids[assignedIdx];
                        linePositions.push(p.pos.x, p.pos.y, p.pos.z);
                        linePositions.push(c.currentPos.x, c.currentPos.y, c.currentPos.z);
                    });
                    kmeansData.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
                    kmeansData.lines.geometry.attributes.position.needsUpdate = true;
                }
            }

            const activeGroup = this.models[this.activeAlgoId];
            if (activeGroup && !this.isDragging) {
                activeGroup.rotation.y = Math.sin(time * 0.5) * 0.15;
            }
        },

        _updateLogisticSheet(id) {
            const data = this.dynamicData[id];
            if (!data || !data.sheetMesh) return;

            const params = this.cParams[id] || {};
            const steepness = Number(params.steepness ?? 2);

            const geom = data.sheetMesh.geometry;
            const pos = geom.attributes.position;
            const colors = [];

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const prob = 1 / (1 + Math.exp(-steepness * x));
                const y = prob * 4 - 2;
                pos.setY(i, y);

                const c = new THREE.Color().lerpColors(new THREE.Color(0x3b82f6), new THREE.Color(0xef4444), prob);
                colors.push(c.r, c.g, c.b);
            }

            geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            pos.needsUpdate = true;
            geom.attributes.color.needsUpdate = true;
            geom.computeVertexNormals();
        },

        _updateSVM3D() {
            const data = this.dynamicData['svm'];
            if (!data) return;
            const params = this.cParams['svm'] || {};
            const C = Number(params.C ?? 1);

            const margin = Math.max(0.4, 1.8 / (1 + C * 0.3));

            if (data.margin1) data.margin1.position.set(-margin, 0, 0);
            if (data.margin2) data.margin2.position.set(margin, 0, 0);
        },

        _updateKNN3D() {
            const data = this.dynamicData['knn'];
            if (!data) return;
            const params = this.cParams['knn'] || {};
            const k = Math.round(Number(params.k ?? 5));

            const qPos = new THREE.Vector3(0, 0.5, 0);
            const pts = data.points;

            pts.forEach(p => {
                p.dist = qPos.distanceTo(new THREE.Vector3(p.x, p.y, p.z));
            });

            pts.sort((a, b) => a.dist - b.dist);

            const kPoint = pts[k - 1];
            const radius = kPoint ? kPoint.dist : 2.5;

            if (data.searchSphere) {
                data.searchSphere.scale.setScalar(radius);
            }

            if (data.lines) {
                const linePositions = [];
                for (let i = 0; i < k; i++) {
                    linePositions.push(qPos.x, qPos.y, qPos.z);
                    linePositions.push(pts[i].x, pts[i].y, pts[i].z);

                    pts[i].mesh.material = new THREE.MeshPhongMaterial({
                        color: pts[i].label === 0 ? 0x3b82f6 : (pts[i].label === 1 ? 0xef4444 : 0x10b981),
                        emissive: 0xf59e0b,
                        emissiveIntensity: 0.6
                    });
                }

                for (let i = k; i < pts.length; i++) {
                    pts[i].mesh.material = new THREE.MeshPhongMaterial({
                        color: pts[i].label === 0 ? 0x3b82f6 : (pts[i].label === 1 ? 0xef4444 : 0x10b981)
                    });
                }

                data.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
                data.lines.geometry.attributes.position.needsUpdate = true;
            }
        },

        _updateLinReg3D() {
            const data = this.dynamicData['linreg'];
            if (!data) return;

            const pts = data.points;
            const linePositions = [];

            pts.forEach(p => {
                linePositions.push(p.x, p.y, p.z);
                linePositions.push(p.x, 0.5 * p.x - 0.5, p.z);
            });

            if (data.residuals) {
                data.residuals.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
                data.residuals.geometry.attributes.position.needsUpdate = true;
            }
        },

        _updatePolyReg3D() {
            const data = this.dynamicData['polyreg'];
            if (!data || !data.fitRibbon) return;

            const geom = data.fitRibbon.geometry;
            const pos = geom.attributes.position;

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = 0.06 * x**3 - 0.15 * x**2 - 0.3 * x;
                pos.setY(i, y);
            }
            pos.needsUpdate = true;
            geom.computeVertexNormals();
        },

        _updateSVR3D() {
            const data = this.dynamicData['svr'];
            if (!data || !data.fitRibbon || !data.epsilonTube) return;

            const ribbonGeom = data.fitRibbon.geometry;
            const rPos = ribbonGeom.attributes.position;
            for (let i = 0; i < rPos.count; i++) {
                const x = rPos.getX(i);
                rPos.setY(i, Math.sin(x * 0.75) * 1.8);
            }
            rPos.needsUpdate = true;
            ribbonGeom.computeVertexNormals();

            const tubeGeom = data.epsilonTube.geometry;
            const tPos = tubeGeom.attributes.position;
            const epsilon = 0.6;
            for (let i = 0; i < tPos.count; i++) {
                const x = tPos.getX(i);
                const isTop = i % 3 === 0;
                const isBottom = i % 3 === 2;
                const offset = isTop ? epsilon : (isBottom ? -epsilon : 0);
                tPos.setY(i, Math.sin(x * 0.75) * 1.8 + offset);
            }
            tPos.needsUpdate = true;
            tubeGeom.computeVertexNormals();
        },

        _updateKMeans3D(step) {
            const data = this.dynamicData['kmeans'];
            if (!data) return;

            const centroids = data.centroids;
            const points = data.points;

            centroids.forEach((c, ci) => {
                if (step === 0) {
                    c.targetPos.copy(c.startPos);
                } else if (step === 1) {
                    c.targetPos.set(
                        ci === 0 ? -2.2 : (ci === 1 ? 2.2 : 0.5),
                        ci === 0 ? -1 : (ci === 1 ? 1.2 : -0.8),
                        ci === 0 ? -1.5 : (ci === 1 ? -1.0 : 2.2)
                    ).add(c.startPos).multiplyScalar(0.5);
                } else {
                    if (ci === 0) c.targetPos.set(-2.2, -1, -1.5);
                    if (ci === 1) c.targetPos.set(2.2, 1.2, -1.0);
                    if (ci === 2) c.targetPos.set(0.5, -0.8, 2.2);
                }
            });

            const linePositions = [];

            points.forEach(p => {
                let assignedCentroidIdx = p.actualCluster;

                if (step === 0) {
                    let minD = Infinity, bestIdx = 0;
                    centroids.forEach((c, ci) => {
                        const d = p.pos.distanceTo(c.currentPos);
                        if (d < minD) { minD = d; bestIdx = ci; }
                    });
                    assignedCentroidIdx = bestIdx;
                    p.mesh.material = new THREE.MeshPhongMaterial({ color: 0x94a3b8 });
                } else {
                    const colors = [0x3b82f6, 0xef4444, 0x10b981];
                    p.mesh.material = new THREE.MeshPhongMaterial({ color: colors[p.actualCluster] });
                }

                const c = centroids[assignedCentroidIdx];
                linePositions.push(p.pos.x, p.pos.y, p.pos.z);
                linePositions.push(c.currentPos.x, c.currentPos.y, c.currentPos.z);
            });

            if (data.lines) {
                data.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
                data.lines.geometry.attributes.position.needsUpdate = true;
            }
        },

        initAllParams() {
            const all = [...this.classificationAlgos, ...this.regressionAlgos, ...this.clusteringAlgos];
            const params = {};
            all.forEach(algo => {
                params[algo.id] = {};
                algo.params.forEach(p => { params[algo.id][p.key] = p.default; });
            });
            this.cParams = params;
        },

        scrollToAlgo(id) {
            const tabFor = this.classificationAlgos.find(a => a.id === id) ? 'classification'
                : this.regressionAlgos.find(a => a.id === id) ? 'regression' : 'clustering';
            this.activeTab = tabFor;
            this.$nextTick(() => {
                if (!this.openAlgos.includes(id)) this.openAlgos.push(id);
                this.$nextTick(() => {
                    const el = document.getElementById(`card-${id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    this.runViz(id);
                });
            });
        },

        toggleAlgo(id) {
            if (this.openAlgos.includes(id)) {
                this.openAlgos = this.openAlgos.filter(a => a !== id);
            } else {
                this.openAlgos.push(id);
                this.$nextTick(() => {
                    this.runViz(id);
                    this.resizePlot(id);
                });
            }
        },

        updateParam(algoId, key, rawVal) {
            const val = isNaN(Number(rawVal)) ? rawVal : Number(rawVal);
            if (!this.cParams[algoId]) this.cParams[algoId] = {};
            this.cParams[algoId] = { ...this.cParams[algoId], [key]: val };
            this.runViz(algoId);
        },

        formatParam(val, param) {
            if (val === undefined) return param.default;
            if (param.step < 1) return Number(val).toFixed(2);
            return val;
        },

        async runViz(id) {
            const Plotly = await getPlotly();
            const p = this.cParams[id] || {};
            const seed = (this.vizSeeds[id] || 0) + 1;
            this.vizSeeds = { ...this.vizSeeds, [id]: seed };
            const el = document.getElementById(`viz-${id}`);
            if (!el) return;
            try {
                switch (id) {
                    case 'logistic':     this._vizLogistic(Plotly, p, seed); break;
                    case 'svm':          this._vizSVM(Plotly, p, seed); break;
                    case 'knn':          this._vizKNN(Plotly, p, seed); break;
                    case 'randomforest': this._vizRF(Plotly, p, seed); break;
                    case 'naivebayes':   this._vizNB(Plotly, p, seed); break;
                    case 'boosting':     this._vizBoosting(Plotly, p, seed); break;
                    case 'linreg':       this._vizLinReg(Plotly, p, seed); break;
                    case 'polyreg':      this._vizPolyReg(Plotly, p, seed); break;
                    case 'svr':          this._vizSVR(Plotly, p, seed); break;
                    case 'kmeans':       this._vizKMeans(Plotly, p, seed); break;
                    case 'dbscan':       this._vizDBSCAN(Plotly, p, seed); break;
                    case 'hierarchical': this._vizHierarchical(Plotly, p, seed); break;
                    case 'roc':          this.drawROC(); break;
                }
            } catch (e) { console.warn('Viz error', id, e); }
        },

        async resizePlot(id) {
            const Plotly = await getPlotly();
            const el = document.getElementById(`viz-${id}`);
            if (el) Plotly.Plots.resize(el);
        },

        async drawROC() {
            const Plotly = await getPlotly();
            const el = document.getElementById('viz-roc');
            if (!el) return;
            const threshold = this.rocThreshold;
            const n = 200;
            const r = rng(42);
            const scores0 = Array.from({ length: n }, () => r() * 0.6);
            const scores1 = Array.from({ length: n }, () => 0.4 + r() * 0.6);
            const allScores = [...scores0, ...scores1];
            const allLabels = [...Array(n).fill(0), ...Array(n).fill(1)];
            const thresholds = linspace(0, 1, 100);
            const tpr = [], fpr = [];
            for (const t of thresholds) {
                let tp = 0, fp = 0, fn = 0, tn = 0;
                for (let i = 0; i < allScores.length; i++) {
                    const pred = allScores[i] >= t ? 1 : 0;
                    if (pred === 1 && allLabels[i] === 1) tp++;
                    if (pred === 1 && allLabels[i] === 0) fp++;
                    if (pred === 0 && allLabels[i] === 1) fn++;
                    if (pred === 0 && allLabels[i] === 0) tn++;
                }
                tpr.push(tp / (tp + fn || 1));
                fpr.push(fp / (fp + tn || 1));
            }
            let curTp = 0, curFp = 0, curFn = 0, curTn = 0;
            for (let i = 0; i < allScores.length; i++) {
                const pred = allScores[i] >= threshold ? 1 : 0;
                if (pred === 1 && allLabels[i] === 1) curTp++;
                if (pred === 1 && allLabels[i] === 0) curFp++;
                if (pred === 0 && allLabels[i] === 1) curFn++;
                if (pred === 0 && allLabels[i] === 0) curTn++;
            }
            const curTPR = curTp / (curTp + curFn || 1);
            const curFPR = curFp / (curFp + curTn || 1);
            const layout = this._baseLayout('ROC Curve');
            layout.xaxis.title = 'False Positive Rate'; layout.yaxis.title = 'True Positive Rate';
            layout.xaxis.range = [0, 1]; layout.yaxis.range = [0, 1.05];
            layout.shapes = [{ type: 'line', x0: 0, x1: 1, y0: 0, y1: 1, line: { color: '#cbd5e1', dash: 'dash', width: 1 } }];
            Plotly.react('viz-roc', [
                { x: fpr, y: tpr, mode: 'lines', type: 'scatter', name: 'ROC', line: { color: '#3b82f6', width: 2.5 } },
                { x: [curFPR], y: [curTPR], mode: 'markers+text', type: 'scatter', name: `Threshold ${threshold.toFixed(2)}`,
                  marker: { color: '#ef4444', size: 12 }, text: [`t=${threshold.toFixed(2)}`], textposition: 'top right',
                  textfont: { size: 10, color: '#ef4444' } },
            ], layout, { responsive: true, displayModeBar: false });
        },

        _baseLayout(title) {
            const graphPalette = getGraphPalette(this.settings.isDark);
            return mergePlotlyLayout({
                autosize: true, height: 380,
                margin: { t: 36, r: 20, b: 44, l: 50 },
                paper_bgcolor: graphPalette.paperBg,
                plot_bgcolor: graphPalette.plotBg,
                font: { size: 11, color: graphPalette.text },
                title: { text: title, font: { size: 13, color: graphPalette.text }, x: 0.04 },
                xaxis: { showgrid: true, zeroline: false },
                yaxis: { showgrid: true, zeroline: false },
            }, this.settings.isDark);
        },

        // ── Logistic Regression: sigmoid + scatter ─────────────────────
        _vizLogistic(Plotly, p, seed) {
            const r = rng(seed * 17);
            const threshold = Number(p.threshold ?? 0.5);
            const steep = Number(p.steepness ?? 2);
            const noise = Number(p.noise ?? 0.8);
            const n = 80;
            const xs = [], ys = [], cls = [];
            for (let i = 0; i < n; i++) {
                const x = (r() - 0.5) * 10;
                const prob = sigmoid(steep * x);
                const label = r() < prob ? 1 : 0;
                const jitter = randn(r) * noise;
                xs.push(x + jitter);
                ys.push(label + randn(r) * 0.05);
                cls.push(label);
            }
            const xLine = linspace(-8, 8, 200);
            const yLine = xLine.map(x => sigmoid(steep * x));
            const threshLine = xLine.map(() => threshold);
            const layout = this._baseLayout('Sigmoid Decision Function');
            layout.xaxis.title = 'Feature x';
            layout.yaxis.title = 'P(y = 1 | x)';
            layout.yaxis.range = [-0.15, 1.15];
            layout.shapes = [{
                type: 'line', x0: -Math.log(1 / threshold - 1 + 1e-9) / steep, x1: -Math.log(1 / threshold - 1 + 1e-9) / steep,
                y0: 0, y1: 1, line: { color: '#ef4444', dash: 'dash', width: 1.5 },
            }];
            layout.annotations = [{
                x: -Math.log(1 / threshold - 1 + 1e-9) / steep + 0.3, y: 0.5,
                text: `threshold = ${threshold}`, showarrow: false,
                font: { size: 10, color: '#ef4444' }, xanchor: 'left',
            }];
            Plotly.react(`viz-logistic`, [
                { x: xs.filter((_, i) => cls[i] === 0), y: ys.filter((_, i) => cls[i] === 0), mode: 'markers', type: 'scatter', name: 'Class 0', marker: { color: PALETTE[0], size: 6, opacity: 0.7 } },
                { x: xs.filter((_, i) => cls[i] === 1), y: ys.filter((_, i) => cls[i] === 1), mode: 'markers', type: 'scatter', name: 'Class 1', marker: { color: PALETTE[1], size: 6, opacity: 0.7 } },
                { x: xLine, y: yLine, mode: 'lines', type: 'scatter', name: 'σ(z)', line: { color: getGraphPalette(this.settings.isDark).text, width: 2.5 } },
                { x: xLine, y: threshLine, mode: 'lines', type: 'scatter', name: 'Threshold', line: { color: '#ef4444', width: 1.5, dash: 'dot' }, showlegend: false },
            ], layout, { responsive: true, displayModeBar: false });
        },

        _vizSVM(Plotly, p, seed) {
            const r = rng(seed * 31);
            const noise = Number(p.noise ?? 0.5);
            const C = Number(p.C ?? 1);
            const gamma = Number(p.gamma ?? 1);
            const n = 60;
            const useRBF = gamma > 1.5;
            const xs0 = [], ys0 = [], xs1 = [], ys1 = [];
            if (useRBF) {
                const rad0 = 1.2, rad1 = 2.8;
                for (let i = 0; i < n / 2; i++) {
                    const a0 = r() * Math.PI * 2;
                    xs0.push(rad0 * Math.cos(a0) + randn(r) * noise * 0.4);
                    ys0.push(rad0 * Math.sin(a0) + randn(r) * noise * 0.4);
                    const a1 = r() * Math.PI * 2;
                    xs1.push(rad1 * Math.cos(a1) + randn(r) * noise * 0.4);
                    ys1.push(rad1 * Math.sin(a1) + randn(r) * noise * 0.4);
                }
            } else {
                for (let i = 0; i < n / 2; i++) {
                    xs0.push(-1.5 + randn(r) * noise); ys0.push(-1 + randn(r) * noise);
                    xs1.push(1.5 + randn(r) * noise);  ys1.push(1 + randn(r) * noise);
                }
            }
            const layout = this._baseLayout(useRBF ? 'SVM — RBF Kernel (Non-Linear Boundary)' : 'SVM Decision Boundary & Margin');
            layout.xaxis.title = 'Feature 1'; layout.yaxis.title = 'Feature 2';
            const traces = [
                { x: xs0, y: ys0, mode: 'markers', type: 'scatter', name: 'Class 0', marker: { color: PALETTE[0], size: 7, opacity: 0.8 } },
                { x: xs1, y: ys1, mode: 'markers', type: 'scatter', name: 'Class 1', marker: { color: PALETTE[1], size: 7, opacity: 0.8 } },
            ];
            if (useRBF) {
                const boundary = 2.0;
                const theta = linspace(0, 2 * Math.PI, 100);
                traces.push({
                    x: theta.map(a => boundary * Math.cos(a)), y: theta.map(a => boundary * Math.sin(a)),
                    mode: 'lines', type: 'scatter', name: 'RBF boundary', line: { color: getGraphPalette(this.settings.isDark).text, width: 2.5 },
                });
                const marginW = Math.max(0.15, 0.5 / (1 + C * 0.3));
                traces.push({
                    x: [...theta.map(a => (boundary + marginW) * Math.cos(a)), ...theta.slice().reverse().map(a => (boundary - marginW) * Math.cos(a))],
                    y: [...theta.map(a => (boundary + marginW) * Math.sin(a)), ...theta.slice().reverse().map(a => (boundary - marginW) * Math.sin(a))],
                    type: 'scatter', fill: 'toself', fillcolor: 'rgba(148,163,184,0.1)', line: { color: 'rgba(148,163,184,0.3)', width: 1 },
                    name: 'Margin', showlegend: false,
                });
            } else {
                const margin = Math.max(0.3, 1.5 / (1 + C * 0.5));
                layout.shapes = [
                    { type: 'line', x0: -5, x1: 5, y0: 0, y1: 0, line: { color: getGraphPalette(this.settings.isDark).text, width: 2 } },
                    { type: 'line', x0: -5, x1: 5, y0: margin, y1: margin, line: { color: '#94a3b8', width: 1.5, dash: 'dash' } },
                    { type: 'line', x0: -5, x1: 5, y0: -margin, y1: -margin, line: { color: '#94a3b8', width: 1.5, dash: 'dash' } },
                    { type: 'rect', x0: -5, x1: 5, y0: -margin, y1: margin, fillcolor: 'rgba(148,163,184,0.08)', line: { width: 0 } },
                ];
            }
            Plotly.react('viz-svm', traces, layout, { responsive: true, displayModeBar: false });
        },

        _vizKNN(Plotly, p, seed) {
            const r = rng(seed * 53);
            const k = Math.round(Number(p.k ?? 5));
            const noise = Number(p.noise ?? 0.6);
            const nPerClass = 25, nClasses = 3;
            const trainX = [], trainY = [], trainLabels = [];
            const centers = [[-2, -1], [1, 2], [2, -2]];
            for (let c = 0; c < nClasses; c++) {
                for (let i = 0; i < nPerClass; i++) {
                    trainX.push(centers[c][0] + randn(r) * noise);
                    trainY.push(centers[c][1] + randn(r) * noise);
                    trainLabels.push(c);
                }
            }
            const gRes = 40;
            const xVals = linspace(-5, 5, gRes);
            const yVals = linspace(-5, 5, gRes);
            const zGrid = [];
            for (let j = 0; j < gRes; j++) {
                const row = [];
                for (let i = 0; i < gRes; i++) {
                    const qx = xVals[i], qy = yVals[j];
                    const dists = trainX.map((x, idx) => ({ d: Math.hypot(x - qx, trainY[idx] - qy), label: trainLabels[idx] }));
                    dists.sort((a, b) => a.d - b.d);
                    const counts = [0, 0, 0];
                    dists.slice(0, k).forEach(nb => counts[nb.label]++);
                    row.push(counts.indexOf(Math.max(...counts)));
                }
                zGrid.push(row);
            }
            const layout = this._baseLayout(`KNN Decision Regions (k = ${k})`);
            layout.xaxis.title = 'Feature 1'; layout.yaxis.title = 'Feature 2';
            layout.xaxis.range = [-5, 5]; layout.yaxis.range = [-5, 5];
            const traces = [
                {
                    z: zGrid, x: xVals, y: yVals, type: 'heatmap', showscale: false,
                    colorscale: [[0, 'rgba(59,130,246,0.2)'], [0.5, 'rgba(239,68,68,0.2)'], [1, 'rgba(16,185,129,0.2)']],
                    zmin: 0, zmax: 2, hoverinfo: 'skip',
                },
                ...[0, 1, 2].map(c => ({
                    x: trainX.filter((_, i) => trainLabels[i] === c),
                    y: trainY.filter((_, i) => trainLabels[i] === c),
                    mode: 'markers', type: 'scatter', name: `Class ${c}`,
                    marker: { color: PALETTE[c], size: 8, line: { color: '#fff', width: 1.5 } },
                })),
            ];
            Plotly.react('viz-knn', traces, layout, { responsive: true, displayModeBar: false });
        },

        _vizRF(Plotly, p, seed) {
            const r = rng(seed * 7);
            const nFeatures = Math.round(Number(p.features ?? 5));
            const trees = Math.round(Number(p.trees ?? 20));
            const depth = Math.round(Number(p.maxDepth ?? 4));
            const rawImps = Array.from({ length: nFeatures }, () => Math.pow(r(), 1.5));
            const total = rawImps.reduce((s, v) => s + v, 0);
            const imps = rawImps.map(v => v / total).sort((a, b) => b - a);
            const fNames = imps.map((_, i) => `Feature ${i + 1}`);
            const treeRange = Array.from({ length: Math.min(trees, 30) }, (_, i) => i + 1);
            const errTrain = treeRange.map(t => 0.05 + 0.4 * Math.exp(-t * 0.2) + r() * 0.02);
            const errVal   = treeRange.map(t => 0.12 + 0.35 * Math.exp(-t * 0.18) + r() * 0.03);

            const treeNodes = [], treeEdges = [];
            const maxD = Math.min(depth, 4);
            const buildTree = (d, x, y, dx) => {
                if (d > maxD) return;
                const feat = `F${Math.ceil(r() * nFeatures)}`;
                const thr = (r() * 4 + 1).toFixed(1);
                const label = d === maxD ? (r() > 0.5 ? 'A' : 'B') : `${feat}≤${thr}`;
                treeNodes.push({ x, y: -y, label, leaf: d === maxD });
                if (d < maxD) {
                    treeEdges.push({ x0: x, y0: -y, x1: x - dx, y1: -(y + 1) });
                    treeEdges.push({ x0: x, y0: -y, x1: x + dx, y1: -(y + 1) });
                    buildTree(d + 1, x - dx, y + 1, dx / 2);
                    buildTree(d + 1, x + dx, y + 1, dx / 2);
                }
            };
            buildTree(0, 0, 0, 2);

            const layout = {
                ...this._baseLayout('Feature Importance, Error & Sample Tree'),
                grid: { rows: 1, columns: 3, pattern: 'independent' },
                height: 420,
                xaxis:  { title: 'Importance', showgrid: true, gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
                yaxis:  { showgrid: false, zeroline: false },
                xaxis2: { title: 'Trees', showgrid: true, gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
                yaxis2: { title: 'Error', showgrid: true, gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
                xaxis3: { showgrid: false, zeroline: false, showticklabels: false },
                yaxis3: { showgrid: false, zeroline: false, showticklabels: false },
                annotations: treeNodes.map(nd => ({
                    x: nd.x, y: nd.y, xref: 'x3', yref: 'y3', text: nd.label,
                    showarrow: false, font: { size: 8, color: nd.leaf ? '#10b981' : getGraphPalette(this.settings.isDark).edgeLabelText },
                    bgcolor: nd.leaf ? '#ecfdf5' : getGraphPalette(this.settings.isDark).edgeLabelBg, borderpad: 2, bordercolor: nd.leaf ? '#10b981' : getGraphPalette(this.settings.isDark).annotationBorder, borderwidth: 1,
                })),
                shapes: treeEdges.map(e => ({
                    type: 'line', x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1,
                    xref: 'x3', yref: 'y3', line: { color: '#94a3b8', width: 1 },
                })),
            };
            Plotly.react('viz-randomforest', [
                { x: imps, y: fNames, type: 'bar', orientation: 'h', name: 'Importance',
                  marker: { color: imps.map((_, i) => PALETTE[i % PALETTE.length]), opacity: 0.85 }, showlegend: false },
                { x: treeRange, y: errTrain, type: 'scatter', mode: 'lines+markers', name: 'Train error',
                  xaxis: 'x2', yaxis: 'y2', line: { color: PALETTE[0], width: 2 }, marker: { size: 4 } },
                { x: treeRange, y: errVal, type: 'scatter', mode: 'lines+markers', name: 'Val error',
                  xaxis: 'x2', yaxis: 'y2', line: { color: PALETTE[1], width: 2 }, marker: { size: 4 } },
                { x: treeNodes.map(n => n.x), y: treeNodes.map(n => n.y), mode: 'markers', type: 'scatter',
                  xaxis: 'x3', yaxis: 'y3', showlegend: false,
                  marker: { size: 10, color: treeNodes.map(n => n.leaf ? '#10b981' : '#3b82f6'), opacity: 0.4 } },
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── Naive Bayes: Gaussian per class ───────────────────────────
        _vizNB(Plotly, p, seed) {
            const r = rng(seed * 13);
            const overlap = Number(p.overlap ?? 1.5);
            const noise = Number(p.noise ?? 0.7);
            const means = [-overlap, 0, overlap];
            const sigmas = [noise * 0.8, noise, noise * 0.9];
            const xRange = linspace(-6, 6, 300);
            const gaussPDF = (x, mu, sigma) =>
                (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
            const layout = this._baseLayout('Gaussian Naive Bayes — Class Distributions');
            layout.xaxis.title = 'Feature value'; layout.yaxis.title = 'Density';
            const nPts = 30;
            const sampleTraces = means.map((mu, ci) => {
                const samples = [];
                for (let s = 0; s < nPts; s++) samples.push(mu + randn(r) * sigmas[ci]);
                return {
                    x: samples, y: samples.map(() => -0.015 - ci * 0.018),
                    type: 'scatter', mode: 'markers', showlegend: false,
                    marker: { color: PALETTE[ci], size: 4, symbol: 'line-ns', opacity: 0.6, line: { width: 1.5, color: PALETTE[ci] } },
                };
            });
            Plotly.react('viz-naivebayes', [
                ...means.map((mu, ci) => ({
                    x: xRange, y: xRange.map(x => gaussPDF(x, mu, sigmas[ci])),
                    type: 'scatter', mode: 'lines', name: `Class ${ci}`,
                    line: { color: PALETTE[ci], width: 2.5 },
                    fill: 'tozeroy', fillcolor: hexToRgba(PALETTE[ci], 0.12),
                })),
                ...sampleTraces,
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── Boosting: residuals per iteration ────────────────────────
        _vizBoosting(Plotly, p, seed) {
            const r = rng(seed * 41);
            const nTrees = Math.round(Number(p.nTrees ?? 8));
            const lr = Number(p.lr ?? 0.3);
            const noise = Number(p.noise ?? 0.5);
            const n = 60;
            const xs = linspace(-4, 4, n);
            const trueY = xs.map(x => Math.sin(x) + x * 0.2);
            const obsY = trueY.map(y => y + randn(r) * noise);
            let pred = Array(n).fill(obsY.reduce((s, v) => s + v, 0) / n);
            const trainErr = [], valErr = [];
            for (let t = 0; t < nTrees; t++) {
                const resid = obsY.map((y, i) => y - pred[i]);
                const coeffs = polyFit(xs, resid, 2);
                pred = pred.map((p, i) => p + lr * polyVal(coeffs, xs[i]));
                const mse = resid.reduce((s, v) => s + v * v, 0) / n;
                trainErr.push(mse);
                valErr.push(mse * (1 + 0.3 * r()));
            }
            const layout = {
                ...this._baseLayout(`Boosting — Fit after ${nTrees} rounds (lr=${lr})`),
                grid: { rows: 1, columns: 2, pattern: 'independent' },
                xaxis:  { title: 'x', gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
                yaxis:  { title: 'y', gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
                xaxis2: { title: 'Boosting round', gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
                yaxis2: { title: 'MSE', gridcolor: getGraphPalette(this.settings.isDark).grid, zeroline: false },
            };
            Plotly.react('viz-boosting', [
                { x: xs, y: obsY, mode: 'markers', type: 'scatter', name: 'Data', marker: { color: PALETTE[0], size: 5, opacity: 0.7 } },
                { x: xs, y: trueY, mode: 'lines', type: 'scatter', name: 'True', line: { color: '#94a3b8', dash: 'dash', width: 1.5 } },
                { x: xs, y: pred, mode: 'lines', type: 'scatter', name: 'Prediction', line: { color: PALETTE[1], width: 2.5 } },
                { x: Array.from({ length: nTrees }, (_, i) => i + 1), y: trainErr, mode: 'lines+markers', name: 'Train MSE',
                  xaxis: 'x2', yaxis: 'y2', line: { color: PALETTE[0], width: 2 }, marker: { size: 5 } },
                { x: Array.from({ length: nTrees }, (_, i) => i + 1), y: valErr, mode: 'lines+markers', name: 'Val MSE',
                  xaxis: 'x2', yaxis: 'y2', line: { color: PALETTE[1], width: 2 }, marker: { size: 5 } },
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── Linear Regression: scatter + OLS line + residuals ─────────
        _vizLinReg(Plotly, p, seed) {
            const r = rng(seed * 23);
            const noise = Number(p.noise ?? 0.8);
            const slope = Number(p.slope ?? 1.5);
            const nPts = Math.round(Number(p.nPts ?? 50));
            const xs = Array.from({ length: nPts }, () => (r() - 0.5) * 8);
            const ys = xs.map(x => slope * x + randn(r) * noise * 3);
            const xBar = xs.reduce((s, v) => s + v, 0) / nPts;
            const yBar = ys.reduce((s, v) => s + v, 0) / nPts;
            const Sxx = xs.reduce((s, x) => s + (x - xBar) ** 2, 0);
            const Sxy = xs.reduce((s, x, i) => s + (x - xBar) * (ys[i] - yBar), 0);
            const wHat = Sxy / Sxx, bHat = yBar - wHat * xBar;
            const xLine = linspace(Math.min(...xs) - 0.5, Math.max(...xs) + 0.5, 100);
            const yLine = xLine.map(x => wHat * x + bHat);
            const residX = [], residY = [];
            xs.forEach((x, i) => { residX.push(x, x, null); residY.push(ys[i], wHat * x + bHat, null); });
            const mse = ys.reduce((s, y, i) => s + (y - (wHat * xs[i] + bHat)) ** 2, 0) / nPts;
            const layout = this._baseLayout(`OLS — ŷ = ${wHat.toFixed(2)}x + ${bHat.toFixed(2)}, MSE = ${mse.toFixed(3)}`);
            layout.xaxis.title = 'x'; layout.yaxis.title = 'y';
            Plotly.react('viz-linreg', [
                { x: xs, y: ys, mode: 'markers', type: 'scatter', name: 'Data', marker: { color: PALETTE[0], size: 6, opacity: 0.75 } },
                { x: xLine, y: yLine, mode: 'lines', type: 'scatter', name: 'OLS fit', line: { color: PALETTE[1], width: 2.5 } },
                { x: residX, y: residY, mode: 'lines', type: 'scatter', name: 'Residuals', line: { color: '#94a3b8', width: 1, dash: 'dot' }, showlegend: false },
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── Polynomial Regression: curve + bias-variance ──────────────
        _vizPolyReg(Plotly, p, seed) {
            const r = rng(seed * 29);
            const degree = Math.round(Number(p.degree ?? 3));
            const noise = Number(p.noise ?? 0.5);
            const nPts = Math.round(Number(p.nPts ?? 30));
            const xs = Array.from({ length: nPts }, (_, i) => -3 + i * 6 / (nPts - 1));
            const trueY = xs.map(x => Math.sin(x) + 0.3 * x);
            const ys = trueY.map(y => y + randn(r) * noise);
            let coeffs;
            try { coeffs = polyFit(xs, ys, Math.min(degree, nPts - 2)); } catch { coeffs = [0, 1]; }
            const xFit = linspace(-3, 3, 200);
            const yFit = xFit.map(x => polyVal(coeffs, x));
            const residMse = ys.reduce((s, y, i) => s + (y - polyVal(coeffs, xs[i])) ** 2, 0) / nPts;
            const layout = this._baseLayout(`Polynomial (deg ${degree}) — MSE = ${residMse.toFixed(3)}`);
            layout.xaxis.title = 'x'; layout.yaxis.title = 'y';
            layout.yaxis.range = [-4, 4];
            Plotly.react('viz-polyreg', [
                { x: xs, y: ys, mode: 'markers', type: 'scatter', name: 'Data', marker: { color: PALETTE[0], size: 7, opacity: 0.8 } },
                { x: xFit, y: xFit.map(x => Math.sin(x) + 0.3 * x), mode: 'lines', type: 'scatter', name: 'True f(x)', line: { color: '#94a3b8', dash: 'dash', width: 1.5 } },
                { x: xFit, y: yFit, mode: 'lines', type: 'scatter', name: `Degree ${degree} fit`, line: { color: PALETTE[1], width: 2.5 } },
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── SVR: scatter + epsilon tube ───────────────────────────────
        _vizSVR(Plotly, p, seed) {
            const r = rng(seed * 37);
            const eps = Number(p.epsilon ?? 0.3);
            const noise = Number(p.noise ?? 0.5);
            const n = 60;
            const xs = Array.from({ length: n }, () => (r() - 0.5) * 8);
            const ys = xs.map(x => 0.5 * x + Math.sin(x) + randn(r) * noise * 2);
            const coeffs = polyFit(xs.slice().sort((a, b) => a - b), xs.slice().sort((a, b) => a - b).map(x => 0.5 * x + Math.sin(x)), 3);
            const xFit = linspace(-4, 4, 200);
            const yFit = xFit.map(x => polyVal(coeffs, x));
            const svMask = xs.map((x, i) => Math.abs(ys[i] - polyVal(coeffs, x)) > eps);
            const layout = this._baseLayout(`SVR — ε = ${eps}`);
            layout.xaxis.title = 'x'; layout.yaxis.title = 'y';
            Plotly.react('viz-svr', [
                { x: xs.filter((_, i) => !svMask[i]), y: ys.filter((_, i) => !svMask[i]),
                  mode: 'markers', type: 'scatter', name: 'In ε-tube', marker: { color: PALETTE[0], size: 6, opacity: 0.7 } },
                { x: xs.filter((_, i) => svMask[i]), y: ys.filter((_, i) => svMask[i]),
                  mode: 'markers', type: 'scatter', name: 'Support vectors', marker: { color: PALETTE[1], size: 8, opacity: 0.9, symbol: 'circle-open', line: { width: 2 } } },
                { x: xFit, y: yFit, mode: 'lines', type: 'scatter', name: 'SVR fit', line: { color: getGraphPalette(this.settings.isDark).text, width: 2.5 } },
                { x: [...xFit, ...xFit.slice().reverse()], y: [...yFit.map(y => y + eps), ...yFit.slice().reverse().map(y => y - eps)],
                  type: 'scatter', fill: 'toself', fillcolor: 'rgba(59,130,246,0.1)', line: { color: 'rgba(59,130,246,0.3)', width: 1 }, name: 'ε-tube' },
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── K-Means ──────────────────────────────────────────────────
        _vizKMeans(Plotly, p, seed) {
            const r = rng(seed * 61);
            const k = Math.round(Number(p.k ?? 3));
            const spread = Number(p.spread ?? 0.8);
            const nPerCluster = 45;
            const trueCenters = Array.from({ length: k }, () => [(r() - 0.5) * 8, (r() - 0.5) * 8]);
            const pts = [], trueLabels = [];
            trueCenters.forEach((c, ci) => {
                for (let i = 0; i < nPerCluster; i++) {
                    pts.push([c[0] + randn(r) * spread, c[1] + randn(r) * spread]);
                    trueLabels.push(ci);
                }
            });
            const { assignments, centroids } = kMeans(pts, k, 30, seed);
            const layout = this._baseLayout(`K-Means (k = ${k})`);
            layout.xaxis.title = 'Feature 1'; layout.yaxis.title = 'Feature 2';
            Plotly.react('viz-kmeans', [
                ...Array.from({ length: k }, (_, ci) => ({
                    x: pts.filter((_, i) => assignments[i] === ci).map(p => p[0]),
                    y: pts.filter((_, i) => assignments[i] === ci).map(p => p[1]),
                    mode: 'markers', type: 'scatter', name: `Cluster ${ci + 1}`,
                    marker: { color: PALETTE[ci % PALETTE.length], size: 6, opacity: 0.75 },
                })),
                {
                    x: centroids.map(c => c[0]), y: centroids.map(c => c[1]),
                    mode: 'markers', type: 'scatter', name: 'Centroids',
                    marker: { color: centroids.map((_, ci) => PALETTE[ci % PALETTE.length]), size: 16, symbol: 'star', line: { color: '#fff', width: 1.5 } },
                },
            ], layout, { responsive: true, displayModeBar: false });
        },

        // ── DBSCAN ───────────────────────────────────────────────────
        _vizDBSCAN(Plotly, p, seed) {
            const r = rng(seed * 71);
            const eps = Number(p.eps ?? 0.8);
            const minPts = Math.round(Number(p.minPts ?? 4));
            const noise = Number(p.noise ?? 0.3);
            // 3 crescent-shaped clusters
            const pts = [];
            const crescent = (cx, cy, angle, len, flip) => {
                for (let i = 0; i < len; i++) {
                    const a = angle + (r() - 0.5) * Math.PI;
                    const rad = 2 + randn(r) * noise;
                    pts.push([cx + rad * Math.cos(a), cy + (flip ? -1 : 1) * rad * Math.abs(Math.sin(a))]);
                }
            };
            crescent(0, 0, 0, 40, false); crescent(2, 1, Math.PI, 40, false);
            for (let i = 0; i < 10; i++) pts.push([(r() - 0.5) * 10, (r() - 0.5) * 6]);
            // Simple DBSCAN
            const n = pts.length;
            const labels = new Array(n).fill(-1);
            const visited = new Array(n).fill(false);
            let clusterIdx = 0;
            const getNeighbors = (i) => pts.map((_, j) => j).filter(j => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) <= eps);
            for (let i = 0; i < n; i++) {
                if (visited[i]) continue;
                visited[i] = true;
                const neighbors = getNeighbors(i);
                if (neighbors.length < minPts) { labels[i] = -1; continue; }
                labels[i] = clusterIdx;
                const queue = [...neighbors];
                while (queue.length) {
                    const q = queue.shift();
                    if (!visited[q]) {
                        visited[q] = true;
                        const qN = getNeighbors(q);
                        if (qN.length >= minPts) queue.push(...qN.filter(nn => !queue.includes(nn)));
                    }
                    if (labels[q] === -1) labels[q] = clusterIdx;
                }
                clusterIdx++;
            }
            const maxLabel = Math.max(...labels);
            const traces = Array.from({ length: maxLabel + 1 }, (_, ci) => ({
                x: pts.filter((_, i) => labels[i] === ci).map(p => p[0]),
                y: pts.filter((_, i) => labels[i] === ci).map(p => p[1]),
                mode: 'markers', type: 'scatter', name: `Cluster ${ci + 1}`,
                marker: { color: PALETTE[ci % PALETTE.length], size: 7, opacity: 0.85 },
            }));
            const noiseTrace = {
                x: pts.filter((_, i) => labels[i] === -1).map(p => p[0]),
                y: pts.filter((_, i) => labels[i] === -1).map(p => p[1]),
                mode: 'markers', type: 'scatter', name: 'Noise',
                marker: { color: '#94a3b8', size: 5, opacity: 0.6, symbol: 'x' },
            };
            const layout = this._baseLayout(`DBSCAN — ε=${eps}, minPts=${minPts}`);
            layout.xaxis.title = 'Feature 1'; layout.yaxis.title = 'Feature 2';
            Plotly.react('viz-dbscan', [...traces, noiseTrace], layout, { responsive: true, displayModeBar: false });
        },

        // ── Hierarchical: scatter coloured by Ward cut ───────────────
        _vizHierarchical(Plotly, p, seed) {
            const r = rng(seed * 83);
            const k = Math.round(Number(p.k ?? 3));
            const spread = Number(p.spread ?? 0.7);
            const nPerCluster = 35;
            const trueCenters = [[-3, -2], [3, -2], [0, 3], [-3, 3], [3, 3], [0, -3]].slice(0, k + 1);
            const pts = [];
            trueCenters.forEach((c, ci) => {
                for (let i = 0; i < nPerCluster; i++) {
                    pts.push([c[0] + randn(r) * spread, c[1] + randn(r) * spread]);
                }
            });
            // Use k-means as proxy for Ward cut
            const { assignments } = kMeans(pts, k, 20, seed);
            const layout = this._baseLayout(`Hierarchical (Ward, k = ${k})`);
            layout.xaxis.title = 'Feature 1'; layout.yaxis.title = 'Feature 2';
            Plotly.react('viz-hierarchical', Array.from({ length: k }, (_, ci) => ({
                x: pts.filter((_, i) => assignments[i] === ci).map(p => p[0]),
                y: pts.filter((_, i) => assignments[i] === ci).map(p => p[1]),
                mode: 'markers', type: 'scatter', name: `Cluster ${ci + 1}`,
                marker: { color: PALETTE[ci % PALETTE.length], size: 7, opacity: 0.8 },
            })), layout, { responsive: true, displayModeBar: false });
        },
    },
};
</script>

<style scoped>
/* ════════════════════════════════════════════════════════════
   Root & tabs
════════════════════════════════════════════════════════════ */
.methods-root { font-size: 0.88rem; color: #1e293b; padding: 0.5rem 0.25rem; }

/* ── Hero banner ─────────────────────────────────────────── */
.hero-banner { background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.4rem; margin-bottom: 1.2rem; }
.hero-stats { display: flex; gap: 1.2rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.hero-stat { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.4rem 0.8rem; border-radius: 8px; transition: background 0.15s; }
.hero-stat:hover { background: rgba(255,255,255,0.7); }
.hero-stat__icon { font-size: 1.1rem; }
.hero-stat__count { font-weight: 800; font-size: 1.2rem; color: #1e293b; }
.hero-stat__label { font-size: 0.78rem; color: #64748b; font-weight: 600; }

.hero-guide-toggle { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: #3b82f6; transition: all 0.15s; }
.hero-guide-toggle:hover { background: #eff6ff; border-color: #93c5fd; }

.hero-guide { margin-top: 0.9rem; animation: fadeSlideIn 0.3s ease-out; }
.guide-tree { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem 1.2rem; }
.guide-q { font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 0.8rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f1f5f9; }
.guide-branches { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.9rem; }
.guide-branch { padding: 0.7rem; border-radius: 8px; }
.guide-branch--blue { background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.15); }
.guide-branch--green { background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.15); }
.guide-branch--amber { background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.15); }
.guide-branch__label { font-weight: 700; font-size: 0.8rem; margin-bottom: 0.5rem; color: #1e293b; }
.guide-leaf { font-size: 0.76rem; color: #475569; padding: 0.25rem 0; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: color 0.15s; }
.guide-leaf:hover { color: #3b82f6; }
.guide-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

/* ── Tabs ────────────────────────────────────────────────── */
.methods-tabs { display: flex; gap: 0.25rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.4rem; }
.methods-tab { padding: 0.55rem 1.1rem; border: none; background: transparent; cursor: pointer; font-size: 0.84rem; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; gap: 0.4rem; border-radius: 4px 4px 0 0; }
.methods-tab:hover { color: #1e293b; background: rgba(241,245,249,0.7); }
.methods-tab--active { color: #3b82f6; border-bottom-color: #3b82f6; background: rgba(239,246,255,0.5); }
.methods-tab__icon { font-size: 0.8rem; }
.methods-tab__count { font-size: 0.68rem; background: #e2e8f0; color: #64748b; border-radius: 99px; padding: 1px 6px; font-weight: 700; margin-left: 2px; }
.methods-tab--active .methods-tab__count { background: #dbeafe; color: #3b82f6; }

.methods-intro { color: #64748b; line-height: 1.7; margin-bottom: 1.2rem; max-width: 860px; }
.methods-content { padding-bottom: 2rem; }

/* ── Comparison table card ───────────────────────────────── */
.compare-card { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 1.2rem; overflow: hidden; }
.compare-card__header { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1rem; cursor: pointer; background: #f8fafc; font-weight: 600; font-size: 0.82rem; color: #475569; transition: background 0.15s; }
.compare-card__header:hover { background: #f1f5f9; }
.compare-card__icon { color: #3b82f6; }
.compare-card__body { padding: 0; animation: fadeSlideIn 0.25s ease-out; }
.compare-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.compare-table th { background: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.04em; padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
.compare-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.compare-row { cursor: pointer; transition: background 0.12s; }
.compare-row:hover { background: #eff6ff; }
.compare-best { font-size: 0.72rem; color: #64748b; }
.speed-dot { color: #3b82f6; font-size: 0.6rem; margin-right: 1px; }
.speed-dot--empty { color: #e2e8f0; }
.interp-star { color: #f59e0b; font-size: 0.65rem; }
.interp-star--empty { color: #e2e8f0; }

/* ── Algorithm cards ─────────────────────────────────────── */
.algo-card { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 0.9rem; overflow: hidden; transition: box-shadow 0.2s; border-left: 3px solid transparent; }
.algo-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }

.algo-card__header { display: flex; align-items: center; gap: 0.7rem; padding: 0.7rem 1rem; cursor: pointer; background: #f8fafc; border-bottom: 1px solid transparent; user-select: none; transition: background 0.15s; }
.algo-card__header:hover { background: #f1f5f9; }
.algo-card__badge { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 28px; border-radius: 5px; color: #fff; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.03em; flex-shrink: 0; }
.algo-card__name { font-weight: 700; font-size: 0.9rem; color: #1e293b; flex: 1; }
.algo-card__family { font-size: 0.74rem; color: #94a3b8; background: #f1f5f9; border-radius: 99px; padding: 2px 10px; }
.algo-card__chevron { color: #94a3b8; margin-left: 4px; font-size: 0.75rem; }

/* Difficulty badges */
.algo-difficulty { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 99px; }
.algo-difficulty--beginner { background: #ecfdf5; color: #059669; }
.algo-difficulty--intermediate { background: #fef3c7; color: #b45309; }
.algo-difficulty--advanced { background: #fce7f3; color: #be185d; }

/* Card body with animation */
.algo-card__body { padding: 1.1rem 1.2rem 1.4rem; background: #fff; border-top: 1px solid #f1f5f9; }
.card-slide-enter-active { animation: fadeSlideIn 0.3s ease-out; }
.card-slide-leave-active { transition: opacity 0.15s; }
.card-slide-leave-to { opacity: 0; }

/* ── Two-column layout ───────────────────────────────────── */
.algo-two-col { display: grid; grid-template-columns: 1fr 340px; gap: 1.2rem; margin-bottom: 1.2rem; }
@media (max-width: 820px) { .algo-two-col { grid-template-columns: 1fr; } }
.algo-desc__text { line-height: 1.75; color: #374151; margin-bottom: 0.9rem; }

.algo-steps { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 0.9rem; }
.algo-step { display: flex; align-items: flex-start; gap: 0.55rem; }
.algo-step__num { min-width: 20px; height: 20px; border-radius: 50%; background: #3b82f6; color: #fff; font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.algo-step__text { color: #475569; line-height: 1.55; font-size: 0.83rem; }

.algo-meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
.algo-meta__title { font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-bottom: 4px; }
.algo-meta__list { padding-left: 1.1rem; margin: 0; }
.algo-meta__list li { font-size: 0.8rem; color: #475569; margin-bottom: 2px; }
.algo-meta__list--green li::marker { color: #10b981; }
.algo-meta__list--red   li::marker { color: #ef4444; }

.algo-formula-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.9rem 1rem; }
.algo-formula-box__title { font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.6rem; }
.algo-formula-row { margin-bottom: 0.5rem; }
.algo-formula-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; display: block; margin-bottom: 0; }
.algo-formula-tex { font-size: 0.85rem; }
.algo-complexity { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.7rem; padding-top: 0.7rem; border-top: 1px solid #e2e8f0; }
.algo-complexity__item { font-size: 0.75rem; color: #64748b; }

/* ── Mathematical learning panels ─────────────────────────── */
.algo-math {
    border: 1px solid rgba(59, 130, 246, 0.14);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.2rem;
    background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 34%),
        linear-gradient(180deg, rgba(248,250,252,0.92), rgba(255,255,255,0.98));
}
.math-section-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: #1e40af;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    margin-bottom: 0.55rem;
    text-transform: uppercase;
}
.math-section-title i { color: #3b82f6; }

.math-objectives {
    background: rgba(239, 246, 255, 0.62);
    border: 1px solid rgba(147, 197, 253, 0.38);
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    margin-bottom: 0.8rem;
}
.math-objectives__list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.35rem 1rem;
    margin: 0;
    padding-left: 1.1rem;
}
.math-objectives__list li {
    color: #334155;
    font-size: 0.8rem;
    line-height: 1.5;
}
.math-objectives__list li::marker { color: #3b82f6; }

.math-prereqs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.9rem;
}
.math-prereqs__label {
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    margin-right: 0.1rem;
    text-transform: uppercase;
}
.math-prereq-chip {
    border: 1px solid rgba(148, 163, 184, 0.32);
    border-radius: 999px;
    background: #fff;
    color: #475569;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
}

.math-definition {
    border-left: 3px solid #3b82f6;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 10px 24px -22px rgba(15, 23, 42, 0.4);
    margin-bottom: 0.85rem;
    padding: 0.8rem 0.9rem;
}
.math-definition__title {
    color: #1e293b;
    font-size: 0.86rem;
    font-weight: 700;
    margin-bottom: 0.3rem;
}
.math-definition__formula,
.math-derivation-card__formula {
    font-size: 0.84rem;
    overflow-x: auto;
}
.math-definition__body {
    color: #475569;
    font-size: 0.8rem;
    line-height: 1.65;
    margin-top: 0.35rem;
}

.math-details {
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 10px;
    background: rgba(255,255,255,0.88);
    margin-bottom: 0.8rem;
    overflow: hidden;
}
.math-details__summary {
    cursor: pointer;
    color: #334155;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    list-style: none;
    padding: 0.7rem 0.85rem;
    text-transform: uppercase;
}
.math-details__summary::-webkit-details-marker { display: none; }
.math-details__summary::after {
    color: #94a3b8;
    content: '▾';
    float: right;
    font-size: 0.78rem;
}
.math-details:not([open]) .math-details__summary::after { content: '▸'; }

.math-derivation-grid {
    display: grid;
    gap: 0.65rem;
    padding: 0 0.85rem 0.85rem;
}
.math-derivation-card {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 0.65rem;
    border-top: 1px solid #f1f5f9;
    padding-top: 0.7rem;
}
.math-derivation-card__num {
    align-items: center;
    background: #dbeafe;
    border-radius: 50%;
    color: #2563eb;
    display: inline-flex;
    font-size: 0.72rem;
    font-weight: 800;
    height: 24px;
    justify-content: center;
    width: 24px;
}
.math-derivation-card__title {
    color: #1e293b;
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 0.2rem;
}
.math-derivation-card__body {
    color: #64748b;
    font-size: 0.78rem;
    line-height: 1.6;
}

.math-complexity-grid,
.math-application-grid {
    display: grid;
    gap: 0.65rem;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    padding: 0 0.85rem 0.85rem;
}
.math-complexity-card,
.math-application-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    padding: 0.7rem 0.8rem;
}
.math-complexity-card__label,
.math-application-card__title {
    color: #475569;
    display: block;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    margin-bottom: 0.35rem;
    text-transform: uppercase;
}
.math-complexity-card code {
    background: #eef2ff;
    border-radius: 5px;
    color: #4338ca;
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 700;
    margin-bottom: 0.35rem;
    padding: 0.12rem 0.45rem;
}
.math-complexity-card p,
.math-application-card p {
    color: #64748b;
    font-size: 0.78rem;
    line-height: 1.55;
}

.math-bridge,
.math-applications {
    margin-bottom: 0.85rem;
}
.math-bridge__grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
.math-bridge__item {
    align-items: center;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
}
.math-bridge__item code {
    background: #f1f5f9;
    border-radius: 5px;
    color: #7c3aed;
    flex-shrink: 0;
    font-size: 0.76rem;
    padding: 0.12rem 0.4rem;
}
.math-bridge__item span {
    color: #475569;
    font-size: 0.78rem;
    line-height: 1.35;
}

.math-practice {
    background: rgba(236, 253, 245, 0.78);
    border-color: rgba(16, 185, 129, 0.28);
}
.math-practice__prompt {
    color: #064e3b;
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.55;
    padding: 0 0.85rem 0.45rem;
}
.math-practice__steps {
    color: #475569;
    font-size: 0.78rem;
    line-height: 1.6;
    margin: 0 0.85rem 0.5rem 1.9rem;
}
.math-practice__answer {
    background: rgba(255,255,255,0.78);
    border-radius: 8px;
    color: #065f46;
    font-size: 0.8rem;
    line-height: 1.55;
    margin: 0 0.85rem 0.85rem;
    padding: 0.55rem 0.7rem;
}

/* ── Interactive visualisation ───────────────────────────── */
.algo-viz { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.9rem 1rem 0.7rem; margin-bottom: 1.2rem; background: rgba(248,250,252,0.5); }
.algo-viz__title { font-weight: 700; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.75rem; }
.algo-viz__controls { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; align-items: flex-end; margin-bottom: 0.85rem; }
.viz-control { display: flex; flex-direction: column; gap: 3px; min-width: 150px; }
.viz-control__label { font-size: 0.76rem; color: #64748b; }
.viz-control__slider { width: 100%; height: 4px; accent-color: #3b82f6; cursor: pointer; }
.viz-control__select { font-size: 0.78rem; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px; background: #fff; color: #1e293b; cursor: pointer; }
.viz-control__btn { padding: 5px 14px; font-size: 0.76rem; font-weight: 600; background: #1e293b; color: #fff; border: none; border-radius: 5px; cursor: pointer; display: flex; align-items: center; gap: 6px; height: fit-content; margin-bottom: 1px; transition: background 0.15s; }
.viz-control__btn:hover { background: #334155; }
.algo-viz__plot { width: 100%; min-height: 340px; animation: plotFadeIn 0.4s ease-out; }
.algo-viz__lens {
    align-items: flex-start;
    background: #fff;
    border: 1px solid rgba(59, 130, 246, 0.14);
    border-radius: 8px;
    color: #475569;
    display: flex;
    font-size: 0.78rem;
    gap: 0.45rem;
    line-height: 1.55;
    margin-top: 0.65rem;
    padding: 0.55rem 0.7rem;
}
.algo-viz__lens i {
    color: #3b82f6;
    margin-top: 0.18rem;
}

/* ── Hyperparameter table ─────────────────────────────────── */
.algo-hyperparam__title { font-weight: 700; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.55rem; }
.hp-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.hp-table th { background: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em; padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
.hp-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
.hp-table tr:last-child td { border-bottom: none; }
.hp-table code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 0.78rem; color: #7c3aed; }

/* ══ Metrics & Evaluation ════════════════════════════════════ */
.metrics-section { margin-bottom: 1.8rem; }
.metrics-section__title { font-weight: 700; font-size: 0.95rem; color: #1e293b; margin-bottom: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
.metrics-section__title i { color: #3b82f6; }

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.8rem; margin-bottom: 1.2rem; }
.metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.9rem 1rem; }
.metric-card__name { font-weight: 700; font-size: 0.85rem; color: #1e293b; margin-bottom: 0.4rem; }
.metric-card__formula { font-size: 0.82rem; margin-bottom: 0.4rem; }
.metric-card__desc { font-size: 0.76rem; color: #64748b; line-height: 1.55; }

.confusion-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; max-width: 140px; margin: 0.5rem auto; }
.cm-cell { padding: 0.5rem; text-align: center; font-weight: 800; font-size: 0.82rem; border-radius: 6px; }
.cm-cell--tp { background: #dcfce7; color: #166534; }
.cm-cell--tn { background: #dcfce7; color: #166534; }
.cm-cell--fp { background: #fee2e2; color: #991b1b; }
.cm-cell--fn { background: #fee2e2; color: #991b1b; }

.metrics-viz-section { border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem 1.1rem; background: rgba(248,250,252,0.5); }

/* Model selection */
.model-sel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 0.9rem; }
.sel-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem 1.1rem; }
.sel-card__title { font-weight: 700; font-size: 0.85rem; color: #1e293b; margin-bottom: 0.6rem; }
.sel-card__desc { font-size: 0.78rem; color: #64748b; line-height: 1.6; margin-top: 0.5rem; }

.split-bar { display: flex; border-radius: 6px; overflow: hidden; margin: 0.4rem 0; height: 28px; }
.split-seg { display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; color: #fff; }
.split-seg--train { background: #3b82f6; }
.split-seg--val { background: #f59e0b; }
.split-seg--test { background: #ef4444; }

.kfold-viz { margin: 0.4rem 0; }
.kfold-row { display: flex; align-items: center; gap: 2px; margin-bottom: 2px; }
.kfold-seg { flex: 1; height: 20px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; color: #fff; }
.kfold-seg--train { background: #93c5fd; }
.kfold-seg--val { background: #f59e0b; }
.kfold-label { font-size: 0.66rem; color: #94a3b8; margin-left: 6px; width: 40px; }

/* ── Animations ──────────────────────────────────────────── */
@keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
}
/* ── 3D View toggles & layouts ── */
.view-mode-toggle-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    border-radius: 8px 8px 0 0;
    color: #f8fafc;
    margin-bottom: 0px;
}
.toggle-container {
    display: flex;
    gap: 0.5rem;
}
.toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #334155;
    border-radius: 6px;
    background: #1e293b;
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}
.toggle-btn:hover {
    color: #f8fafc;
    border-color: #475569;
    background: #273549;
}
.toggle-btn--active {
    color: #3b82f6 !important;
    border-color: #3b82f6 !important;
    background: rgba(59, 130, 246, 0.15) !important;
}
.progress-pill-3d {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.28);
    border-radius: 9999px;
    font-size: 0.78rem;
    color: #10b981;
    font-weight: 600;
}
.lab-container {
    display: flex;
    height: 720px;
    background: var(--theme-bg);
    border: 1px solid var(--theme-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
    position: relative;
}
.lab-sidebar {
    width: 280px;
    background: #e0f2fe;
    border-right: 1px solid #bae6fd;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}
.sidebar-search {
    position: relative;
    padding: 0.9rem;
    border-bottom: 1px solid #bae6fd;
}
.sidebar-search input {
    width: 100%;
    padding: 0.45rem 0.75rem 0.45rem 2rem;
    background: #ffffff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
    color: #0369a1;
    font-size: 0.8rem;
    outline: none;
    transition: border-color 0.15s;
}
.sidebar-search input:focus {
    border-color: #0ea5e9;
}
.sidebar-search .search-icon {
    position: absolute;
    left: 1.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
    font-size: 0.8rem;
}
.sidebar-groups {
    flex: 1;
    overflow-y: auto;
    padding: 0.8rem 0;
}
.sidebar-group {
    margin-bottom: 1.25rem;
}
.sidebar-group__title {
    padding: 0 1.1rem;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin-bottom: 0.4rem;
    font-weight: 700;
}
.sidebar-group__list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.sidebar-item {
    display: flex;
    align-items: center;
    padding: 0.55rem 1.1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #0284c7;
}
.sidebar-item:hover {
    background: #e0f2fe;
    color: #0369a1;
}
.sidebar-item--active {
    background: rgba(14, 165, 233, 0.1) !important;
    color: #0ea5e9 !important;
    border-left: 3px solid #0ea5e9;
    padding-left: calc(1.1rem - 3px);
}
.status-indicator {
    margin-right: 0.65rem;
    font-size: 0.85rem;
    color: #475569;
}
.status-indicator--completed {
    color: #10b981;
}
.sidebar-item__name {
    font-size: 0.82rem;
    font-weight: 500;
    flex-grow: 1;
}
.sidebar-item__badge {
    font-size: 0.6rem;
    padding: 1px 5px;
    border-radius: 4px;
    color: #fff;
    font-weight: 800;
}

.lab-viewport-container {
    flex: 1;
    position: relative;
    height: 100%;
    background: var(--theme-bg);
}
.lab-canvas-container {
    width: 100%;
    height: 100%;
    outline: none;
    cursor: grab;
}
.lab-canvas-container:active {
    cursor: grabbing;
}
.lab-overlay-tooltips {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
}
.floating-tooltip {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: auto;
    z-index: 10;
}
.tooltip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 6px currentColor;
    margin-top: 4px;
}
.tooltip-box {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.72rem;
    color: var(--theme-text);
    width: 160px;
    text-align: center;
    box-shadow: var(--theme-shadow);
    backdrop-filter: blur(4px);
}
.tooltip-title {
    font-weight: 700;
    margin-bottom: 1px;
}
.tooltip-body {
    color: var(--theme-text-muted);
    line-height: 1.25;
}

.viewport-hud-controls {
    position: absolute;
    bottom: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: color-mix(in srgb, var(--theme-surface) 92%, transparent);
    border: 1px solid var(--theme-border);
    padding: 0.4rem 0.85rem;
    border-radius: 9999px;
    box-shadow: var(--theme-shadow);
    backdrop-filter: blur(8px);
}
.hud-nav-btn {
    background: #ffffff;
    border: 1px solid #bae6fd;
    color: #0369a1;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
}
.hud-nav-btn:hover {
    background: #e0f2fe;
    border-color: #bae6fd;
}
.hud-nav-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #0369a1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.hud-reset-btn {
    background: #ffffff;
    border: 1px solid #bae6fd;
    color: #0369a1;
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    margin-left: 0.4rem;
}
.hud-reset-btn:hover {
    background: #e0f2fe;
}
.viewport-instructions {
    position: absolute;
    top: 0.8rem;
    left: 0.8rem;
    font-size: 0.7rem;
    color: #0284c7;
    background: rgba(255, 255, 255, 0.85);
    padding: 0.25rem 0.55rem;
    border-radius: 4px;
    pointer-events: none;
}

.lab-hud-panel {
    width: 370px;
    background: #e0f2fe;
    border-left: 1px solid #bae6fd;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}
.hud-header {
    padding: 1.1rem;
    border-bottom: 1px solid #bae6fd;
    border-left: 4px solid #0ea5e9;
    display: flex;
    align-items: center;
    gap: 0.65rem;
}
.hud-badge {
    font-size: 0.7rem;
    font-weight: 800;
    color: #fff;
    padding: 3px 6px;
    border-radius: 4px;
}
.hud-title-wrap {
    flex-grow: 1;
}
.hud-title {
    font-size: 1rem;
    font-weight: 800;
    color: #0369a1;
    margin: 0;
    line-height: 1.25;
}
.hud-family {
    font-size: 0.65rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.mastery-toggle-btn {
    background: #ffffff;
    border: 1px solid #bae6fd;
    color: #0284c7;
    padding: 0.35rem 0.7rem;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.35rem;
}
.mastery-toggle-btn:hover {
    color: #0369a1;
    border-color: #bae6fd;
}
.mastery-toggle-btn--completed {
    background: rgba(16, 185, 129, 0.15) !important;
    border-color: #10b981 !important;
    color: #10b981 !important;
}
.mastery-toggle-btn--completed:hover {
    background: rgba(16, 185, 129, 0.2) !important;
}
.hud-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.1rem;
}
.hud-section {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #bae6fd;
}
.hud-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}
.hud-desc {
    font-size: 0.8rem;
    color: #0284c7;
    line-height: 1.55;
    margin: 0;
}
.hud-section-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0369a1;
    margin-bottom: 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.hud-section-title i {
    color: #0ea5e9;
}
.hud-params {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}
.hud-param-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.hud-param-label {
    font-size: 0.72rem;
    color: #0284c7;
}
.hud-param-slider {
    width: 100%;
    height: 4px;
    accent-color: #0ea5e9;
    cursor: pointer;
}
.hud-param-select {
    width: 100%;
    padding: 0.35rem 0.55rem;
    background: #ffffff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
    color: #0369a1;
    font-size: 0.76rem;
    outline: none;
}
.walkthrough-playback {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
}
.playback-btn {
    flex: 1.5;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.45rem;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}
.playback-btn:hover {
    background: #2563eb;
}
.playback-btn--secondary {
    flex: 1;
    background: #ffffff;
    border: 1px solid #bae6fd;
    color: #0284c7;
}
.playback-btn--secondary:hover {
    background: #e0f2fe;
    color: #0369a1;
}
.walkthrough-step-desc {
    font-size: 0.76rem;
    color: #0369a1;
    line-height: 1.45;
    margin: 0;
    background: #e0f2fe;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    border-left: 3px solid #f59e0b;
}
.hud-formula-box {
    background: #ffffff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}
.hud-formula-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.hud-formula-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: #0284c7;
    font-weight: 700;
}
.hud-formula-tex {
    color: #0369a1;
    font-size: 0.85rem;
}
.hud-steps {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.hud-step {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
}
.hud-step-num {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    color: #fff;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 2px;
}
.hud-step-text {
    font-size: 0.76rem;
    color: #94a3b8;
    line-height: 1.45;
}
.hud-meta-row {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}
.hud-meta {
    flex: 1;
}
.hud-meta-title {
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.hud-meta-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.hud-meta-list li {
    font-size: 0.74rem;
    color: #94a3b8;
    line-height: 1.35;
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
}
.hud-meta-list li i {
    font-size: 0.65rem;
    margin-top: 3px;
}

/* Responsive lab layouts */
@media (max-width: 992px) {
    .lab-container {
        flex-direction: column;
        height: auto;
    }
    .lab-sidebar {
        width: 100%;
        height: 250px;
        border-right: none;
        border-bottom: 1px solid #1e293b;
    }
    .lab-viewport-container {
        height: 400px;
    }
    .lab-hud-panel {
        width: 100%;
        height: auto;
        border-left: none;
        border-top: 1px solid #1e293b;
    }
}

@keyframes plotFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

/* ── Light Mode Overrides for 3D view ────────────────────── */

/* Toggle Bar */
.view-mode-toggle-bar--light {
    background: #f1f5f9;
    border-bottom-color: #cbd5e1;
    color: #1e293b;
}
.view-mode-toggle-bar--light .toggle-btn {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #475569;
}
.view-mode-toggle-bar--light .toggle-btn:hover {
    background: #f8fafc;
    color: #1e293b;
    border-color: #94a3b8;
}
.view-mode-toggle-bar--light .toggle-btn--active {
    color: #3b82f6 !important;
    border-color: #3b82f6 !important;
    background: rgba(59, 130, 246, 0.08) !important;
}

/* Lab Container */
.lab-container--light {
    background: #f8fafc;
    border-color: #cbd5e1;
}

/* Sidebar */
.lab-container--light .lab-sidebar {
    background: #f1f5f9;
    border-right-color: #cbd5e1;
}
.lab-container--light .sidebar-search input {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #1e293b;
}
.lab-container--light .sidebar-search input:focus {
    border-color: #3b82f6;
}
.lab-container--light .sidebar-search .search-icon {
    color: #64748b;
}
.lab-container--light .sidebar-item {
    color: #475569;
}
.lab-container--light .sidebar-item:hover {
    background: #e2e8f0;
    color: #0f172a;
}
.lab-container--light .sidebar-item--active {
    background: rgba(59, 130, 246, 0.08) !important;
    color: #3b82f6 !important;
}
.lab-container--light .status-indicator {
    color: #94a3b8;
}
.lab-container--light .status-indicator--completed {
    color: #10b981;
}

/* Viewport & Tooltips */
.lab-container--light .lab-viewport-container {
    background: #f8fafc;
}
.lab-container--light .tooltip-box {
    background: rgba(255, 255, 255, 0.95);
    border-color: #cbd5e1;
    color: #1e293b;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}
.lab-container--light .tooltip-title {
    color: #0f172a;
}
.lab-container--light .tooltip-body {
    color: #475569;
}

/* HUD Controls */
.lab-container--light .viewport-hud-controls {
    background: rgba(255, 255, 255, 0.9);
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}
.lab-container--light .hud-nav-label {
    color: #475569;
}
.lab-container--light .hud-nav-btn,
.lab-container--light .hud-reset-btn {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #475569;
}
.lab-container--light .hud-nav-btn:hover,
.lab-container--light .hud-reset-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #94a3b8;
}
.lab-container--light .viewport-instructions {
    background: rgba(255, 255, 255, 0.85);
    color: #475569;
    border: 1px solid #e2e8f0;
}

/* HUD Details Panel */
.lab-container--light .lab-hud-panel {
    background: #f1f5f9;
    border-left-color: #cbd5e1;
}
.lab-container--light .hud-header {
    border-bottom-color: #cbd5e1;
}
.lab-container--light .hud-title {
    color: #0f172a;
}
.lab-container--light .hud-family {
    color: #64748b;
}
.lab-container--light .mastery-toggle-btn {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #475569;
}
.lab-container--light .mastery-toggle-btn:hover {
    background: #f8fafc;
    color: #1e293b;
    border-color: #94a3b8;
}
.lab-container--light .mastery-toggle-btn--completed {
    background: rgba(16, 185, 129, 0.15) !important;
    border-color: #10b981 !important;
    color: #10b981 !important;
}

/* HUD Body & Sections */
.lab-container--light .hud-section {
    border-bottom-color: #cbd5e1;
}
.lab-container--light .hud-desc {
    color: #475569;
}
.lab-container--light .hud-section-title {
    color: #475569;
}
.lab-container--light .hud-param-label {
    color: #475569;
}
.lab-container--light .hud-param-select {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #1e293b;
}
.lab-container--light .playback-btn--secondary {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #475569;
}
.lab-container--light .playback-btn--secondary:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #94a3b8;
}
.lab-container--light .walkthrough-step-desc {
    background: #eff6ff;
    color: #1e3a8a;
    border-left-color: #f59e0b;
}
.lab-container--light .hud-formula-box {
    background: #e2e8f0;
    border-color: #cbd5e1;
}
.lab-container--light .hud-formula-label {
    color: #475569;
}
.lab-container--light .hud-formula-tex {
    color: #0f172a;
}
.lab-container--light .hud-step-text {
    color: #475569;
}
.lab-container--light .hud-meta-list li {
    color: #475569;
}

/* Responsive boundary borders */
@media (max-width: 992px) {
    .lab-container--light .lab-sidebar {
        border-bottom-color: #cbd5e1;
    }
    .lab-container--light .lab-hud-panel {
        border-top-color: #cbd5e1;
    }
}
</style>
