<template>
   <section v-if="this.settings?.items.length > 2">

       <!-- ── Sub-tab nav ────────────────────────────────────────────── -->
       <nav class="studio-subtabs dr-subtabs" aria-label="Dimensionality reduction methods">
           <button v-for="sub in drSubtabs" :key="sub.id" type="button"
               class="studio-subtabs__btn"
               :class="{ 'is-active': drSection === sub.id }"
               @click="drSection = sub.id">
               {{ sub.label }}
           </button>
       </nav>

       <!-- ══ PCA ═══════════════════════════════════════════════════════ -->
       <div v-show="drSection === 'pca'">
       <!-- ══ PCA Card ══════════════════════════════════════════════════ -->
       <div class="message is-info pca-card">
            <div class="message-header p-2 pca-header">
                <span class="pca-header__title">
                    <i class="fas fa-layer-group pca-header__icon" aria-hidden="true"></i>
                    Principal Component Analysis
                </span>
                <b-tooltip append-to-body label="PCA finds orthogonal components that maximise variance. Use the Scree Plot to pick how many components to keep (look for the 'elbow'). The Biplot shows how features load onto PC1 & PC2." multilined>
                    <b-button icon-left="info" icon-pack="fas" size="is-small" type="is-dark" />
                </b-tooltip>
            </div>

            <div class="message-body pca-body">

                <!-- Educational Explanation Panel -->
                <div class="dr-explanation">
                    <p class="dr-explanation__title">
                        <i class="fas fa-graduation-cap" aria-hidden="true"></i> Understanding Principal Component Analysis (PCA)
                    </p>
                    <p class="dr-explanation__text">
                        PCA is a linear dimensionality reduction method that projects high-dimensional data onto a lower-dimensional subspace of orthogonal directions called <b>Principal Components (PCs)</b>. The first component (PC1) is chosen to maximize the variance of the projected data, and each subsequent component maximizes the remaining variance while being perpendicular (orthogonal) to the preceding ones.
                    </p>
                    <div class="dr-explanation__bullets">
                        <div><b>Scree Plot:</b> Visualizes the percentage of total variance explained by each PC. Look for the "elbow" where the variance drops off, representing the optimal compact subset of components.</div>
                        <div><b>Loading Biplot:</b> Shows the correlation between features and the first two PCs. Arrow lengths reflect feature representation strength; angle cosine indicates correlation between features.</div>
                    </div>
                </div>

                <!-- ── Step 1: Explore ─────────────────────────────────── -->
                <div class="pca-step">
                    <p class="pca-step__label">
                        <span class="pca-step__badge">1</span>
                        Explore variance &amp; feature loadings
                    </p>
                    <div class="pca-step__controls">
                        <b-field label="Seed" :label-position="'on-border'" class="pca-field">
                            <b-input v-model="pcaSeed" size="is-small" type="number"
                                min="0" step="1" :disabled="loadingPCA" placeholder="42"></b-input>
                        </b-field>
                        <b-field label="Standardise features" :label-position="'on-border'" class="pca-field">
                            <b-select v-model="pcaScaleData" size="is-small" :disabled="loadingPCA">
                                <option :value="true">Yes (StandardScaler)</option>
                                <option :value="false">No (raw data)</option>
                            </b-select>
                        </b-field>
                        <div class="pca-step__actions">
                            <b-button icon-left="play" icon-pack="fas" size="is-small" type="is-info"
                                :loading="loadingPCA" @click="drawPCA()" label="Fit PCA"
                                :disabled="loadingPCA" />
                            <b-button v-if="pcaVarianceData" size="is-small" type="is-light"
                                icon-left="download" icon-pack="fas"
                                @click="downloadExplainedVariance()" label="Variance CSV" class="ml-1" />
                        </div>
                    </div>

                    <!-- Variance KPI cards -->
                    <div v-if="pcaVarianceCards.length" class="pca-kpi-row">
                        <div v-for="(card, ci) in pcaVarianceCards" :key="ci" class="pca-kpi-card">
                            <p class="pca-kpi-card__label">PC{{ ci + 1 }}</p>
                            <p class="pca-kpi-card__value">{{ card.pct }}</p>
                            <div class="pca-kpi-card__bar">
                                <div class="pca-kpi-card__bar-fill" :style="{ width: card.fill }"></div>
                            </div>
                        </div>
                        <div class="pca-kpi-card pca-kpi-card--cumulative">
                            <p class="pca-kpi-card__label">Top {{ pcaVarianceCards.length }}</p>
                            <p class="pca-kpi-card__value">{{ pcaCumulativePct }}</p>
                            <p class="pca-kpi-card__sub">cumulative</p>
                        </div>
                    </div>

                    <div v-if="pcaVarianceData" class="pca-insight-strip" aria-label="PCA summary">
                        <div class="pca-insight-card">
                            <span class="pca-insight-card__label">Recommended</span>
                            <strong>{{ pcaRecommendedComponents }} PCs</strong>
                            <span>captures {{ pcaRecommendedPct }} variance</span>
                        </div>
                        <div class="pca-insight-card">
                            <span class="pca-insight-card__label">PC1 + PC2</span>
                            <strong>{{ pcaFirstTwoPct }}</strong>
                            <span>visible in the loading biplot</span>
                        </div>
                        <div class="pca-insight-card">
                            <span class="pca-insight-card__label">Scaling</span>
                            <strong>{{ pcaScaleData ? 'Standardized' : 'Raw values' }}</strong>
                            <span>{{ pcaScaleData ? 'best for mixed units' : 'keeps original units' }}</span>
                        </div>
                    </div>

                    <!-- Scree + Biplot side by side -->
                    <div v-if="hasPCA" class="pca-explore-plots">
                        <div class="pca-explore-plots__cell pca-explore-plots__cell--scree">
                            <div class="pca-plot-head">
                                <div>
                                    <p class="pca-plot-label">Scree plot — Explained Variance</p>
                                    <p class="pca-plot-caption">Use the elbow and 80/90% guide lines to choose a compact component count.</p>
                                </div>
                                <span class="pca-plot-chip">{{ pcaRecommendedComponents }} PCs suggested</span>
                            </div>
                            <div id="scree_plot" class="pca-explore-plot"></div>
                        </div>
                        <div class="pca-explore-plots__cell pca-explore-plots__cell--biplot">
                            <div class="pca-plot-head">
                                <div>
                                    <p class="pca-plot-label">Biplot — Feature Loadings (PC1 vs PC2)</p>
                                    <p class="pca-plot-caption">Long arrows near the circle are strongly represented by PC1/PC2.</p>
                                </div>
                                <span class="pca-plot-chip">{{ pcaFirstTwoPct }}</span>
                            </div>
                            <div class="pca-biplot-frame">
                                <div id="correlation_circle" class="pca-explore-plot pca-explore-plot--biplot"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Step 2: Scatter matrix ──────────────────────────── -->
                <div v-if="hasPCA" class="pca-step pca-step--bordered">
                    <p class="pca-step__label">
                        <span class="pca-step__badge pca-step__badge--2">2</span>
                        Visualise projection
                    </p>
                    <div class="pca-step__controls">
                        <b-field label="Components" :label-position="'on-border'" class="pca-field">
                            <b-select v-model="numberOfComponents" size="is-small" :disabled="loadingPCA">
                                <option v-for="n in pcaMaxComponents" :key="n" :value="n">
                                    {{ n }} PCs
                                    <template v-if="pcaVarianceData && pcaVarianceData[n-1]">
                                        ({{ (pcaVarianceData.slice(0,n).reduce((s,v)=>s+v,0)*100).toFixed(0) }}% var)
                                    </template>
                                </option>
                            </b-select>
                        </b-field>
                        <b-button size="is-small" type="is-info" icon-left="chart-scatter" icon-pack="fas"
                            :loading="loadingPCA" @click="findPCA()" label="Draw PCA"
                            :disabled="loadingPCA || numberOfComponents < 2" />
                        <b-button v-if="pcaData" size="is-small" type="is-light"
                            icon-left="download" icon-pack="fas"
                            @click="downloadPCA()" label="Data CSV" class="ml-1" />
                        <b-button v-if="pcaData" size="is-small" type="is-light"
                            icon-left="image" icon-pack="fas"
                            @click="downloadPCAPlot()" label="Plot" class="ml-1" />
                    </div>

                    <!-- Legend for classification -->
                    <div v-if="pcaLegend.length" class="pca-legend">
                        <span class="pca-legend__title">{{ settings.modelTarget || 'Class' }}</span>
                        <span v-for="(item, li) in pcaLegend" :key="li" class="pca-legend__item">
                            <span class="pca-legend__dot" :style="{ background: item.color }"></span>
                            <span class="pca-legend__label">{{ item.label }}</span>
                        </span>
                    </div>

                    <div id="pca_matrix" class="pca-matrix-container"></div>
                </div>

                <!-- Loading overlay -->
                <div v-if="loadingPCA" class="pca-loading">
                    <span class="pca-loading__spinner"></span>
                    <span class="pca-loading__text">Computing PCA&hellip;</span>
                </div>

                <!-- Empty state -->
                <div v-if="!hasPCA && !loadingPCA" class="pca-empty">
                    <i class="fas fa-chart-line pca-empty__icon" aria-hidden="true"></i>
                    <p class="pca-empty__text">Click <strong>Fit PCA</strong> to explore how much variance each principal component captures.</p>
                </div>

            </div>
        </div>
       </div><!-- /pca section -->

       <!-- ══ t-SNE & UMAP ══════════════════════════════════════════════ -->
       <div v-show="drSection === 'manifold'">
       <div class="message is-info tsne-card">
            <div class="message-header p-2 tsne-header">
                <span class="tsne-header__title">
                    <i class="fas fa-project-diagram tsne-header__icon" aria-hidden="true"></i>
                    t-SNE &mdash; t-distributed Stochastic Neighbor Embedding
                </span>
                <b-tooltip append-to-body label="t-SNE projects high-dimensional data to 2 or 3 components while preserving local neighborhood structure. Higher perplexity = broader neighborhoods." multilined>
                    <b-button icon-left="info" icon-pack="fas" size="is-small" type="is-dark" />
                </b-tooltip>
            </div>
             <div class="message-body tsne-body">

                <!-- Educational Explanation Panel -->
                <div class="dr-explanation">
                    <p class="dr-explanation__title">
                        <i class="fas fa-graduation-cap" aria-hidden="true"></i> Understanding t-SNE
                    </p>
                    <p class="dr-explanation__text">
                        t-distributed Stochastic Neighbor Embedding (t-SNE) is a non-linear, probabilistic technique primarily used for the visualization of high-dimensional datasets. It maps high-dimensional points to 2D or 3D space such that similar points remain close together, and dissimilar points are modeled by a Student-t distribution to solve the crowding problem.
                    </p>
                    <div class="dr-explanation__bullets">
                        <div><b>Perplexity:</b> Can be interpreted as a guess of the number of close neighbors for each point. Standard values range from 5 to 50. High values focus on global geometry; low values highlight local clusters.</div>
                        <div><b>Stochastic Nature:</b> The algorithm is randomized and non-deterministic; changing the random seed will yield different configurations. It does not preserve global distances accurately.</div>
                    </div>
                </div>

                <div class="tsne-controls">
                    <b-field label="Components" :label-position="'on-border'" class="tsne-field">
                        <b-select v-model="componentsTSNE" size="is-small" :disabled="loadingTSNE">
                            <option :value="2">2D</option>
                            <option :value="3">3D (interactive)</option>
                        </b-select>
                    </b-field>

                    <b-field label="Perplexity" :label-position="'on-border'" class="tsne-field">
                        <b-input v-model="tsnePerplexity" size="is-small" type="number"
                            min="5" max="50" step="1" :disabled="loadingTSNE" placeholder="30"></b-input>
                    </b-field>

                    <b-field label="Seed" :label-position="'on-border'" class="tsne-field">
                        <b-input v-model="seedTSNE" size="is-small" type="number"
                            :disabled="loadingTSNE" placeholder="123"></b-input>
                    </b-field>

                    <div class="tsne-actions">
                        <b-button @click="findTSNE" size="is-small" type="is-info"
                            :loading="loadingTSNE" icon-left="play" icon-pack="fas"
                            label="Fit t-SNE" />
                        <b-button v-if="tsneReady" @click="downloadTSNEPlot" size="is-small"
                            type="is-light" icon-left="download" icon-pack="fas"
                            label="Download" class="ml-1" />
                    </div>
                </div>

                <div v-if="loadingTSNE" class="tsne-loading">
                    <span class="tsne-loading__spinner"></span>
                    <span class="tsne-loading__text">Running t-SNE&hellip; this may take a moment</span>
                </div>

                <div v-show="tsneReady && !loadingTSNE" class="tsne-plot-wrap">
                    <div id="tsne" class="tsne-plot"></div>
                </div>

                <div v-if="!tsneReady && !loadingTSNE" class="tsne-empty">
                    <i class="fas fa-scatter-plot tsne-empty__icon" aria-hidden="true"></i>
                    <p class="tsne-empty__text">Configure parameters above and click <strong>Fit t-SNE</strong> to visualise the embedding.</p>
                </div>
            </div>
        </div>

        <!-- ══ UMAP Card ════════════════════════════════════════════════ -->
        <div class="message is-info umap-card">
            <div class="message-header p-2 umap-header">
                <span class="umap-header__title">
                    <i class="fas fa-circle-nodes umap-header__icon" aria-hidden="true"></i>
                    UMAP &mdash; Uniform Manifold Approximation &amp; Projection
                </span>
                <b-tooltip append-to-body multilined
                    label="UMAP preserves both local and global structure better than t-SNE and runs much faster. n_neighbors controls local vs global balance; min_dist controls cluster tightness.">
                    <b-button icon-left="info" icon-pack="fas" size="is-small" type="is-dark" />
                </b-tooltip>
            </div>

            <div class="message-body umap-body">

                <!-- Educational Explanation Panel -->
                <div class="dr-explanation">
                    <p class="dr-explanation__title">
                        <i class="fas fa-graduation-cap" aria-hidden="true"></i> Understanding UMAP
                    </p>
                    <p class="dr-explanation__text">
                        Uniform Manifold Approximation and Projection (UMAP) is a modern non-linear dimensionality reduction technique built on Riemannian geometry and algebraic topology. It models the manifold structure of the data and finds a low-dimensional layout that preserves both local relationships and global distance structures.
                    </p>
                    <div class="dr-explanation__bullets">
                        <div><b>n_neighbors:</b> Controls the scale of the local neighborhood. Lower values force UMAP to focus on local fine-structure; higher values capture broader, global trends.</div>
                        <div><b>min_dist:</b> Controls how tightly UMAP packs points together. Low values result in tight, distinct clusters; higher values preserve a broader distribution.</div>
                    </div>
                </div>

                <!-- ── Controls ─────────────────────────────────────────── -->
                <div class="umap-controls">
                    <b-field label="Components" :label-position="'on-border'" class="umap-field">
                        <b-select v-model="umapComponents" size="is-small" :disabled="loadingUMAP">
                            <option :value="2">2D</option>
                            <option :value="3">3D (interactive)</option>
                        </b-select>
                    </b-field>

                    <b-field label="n_neighbors" :label-position="'on-border'" class="umap-field">
                        <b-input v-model.number="umapNeighbors" size="is-small" type="number"
                            min="2" max="200" step="1" :disabled="loadingUMAP"></b-input>
                    </b-field>

                    <b-field label="min_dist" :label-position="'on-border'" class="umap-field">
                        <b-input v-model.number="umapMinDist" size="is-small" type="number"
                            min="0.001" max="0.99" step="0.05" :disabled="loadingUMAP"></b-input>
                    </b-field>

                    <b-field label="spread" :label-position="'on-border'" class="umap-field">
                        <b-input v-model.number="umapSpread" size="is-small" type="number"
                            min="0.1" max="5" step="0.1" :disabled="loadingUMAP"></b-input>
                    </b-field>

                    <b-field label="Seed" :label-position="'on-border'" class="umap-field">
                        <b-input v-model.number="umapSeed" size="is-small" type="number"
                            min="0" step="1" :disabled="loadingUMAP"></b-input>
                    </b-field>

                    <div class="umap-actions">
                        <b-button @click="findUMAP" size="is-small" type="is-info"
                            :loading="loadingUMAP" icon-left="play" icon-pack="fas"
                            label="Fit UMAP" />
                        <b-button v-if="umapReady" @click="downloadUMAPPlot" size="is-small"
                            type="is-light" icon-left="download" icon-pack="fas"
                            label="Download" class="ml-1" />
                    </div>
                </div>

                <!-- Parameter guide chips -->
                <div class="umap-guide">
                    <div class="umap-guide__chip">
                        <i class="fas fa-info-circle" style="color:#3b82f6"></i>
                        <span><b>n_neighbors</b> (2–200): Low → local detail; High → global structure</span>
                    </div>
                    <div class="umap-guide__chip">
                        <i class="fas fa-info-circle" style="color:#8b5cf6"></i>
                        <span><b>min_dist</b> (0–1): Low → tight clusters; High → spread out</span>
                    </div>
                    <div class="umap-guide__chip">
                        <i class="fas fa-info-circle" style="color:#10b981"></i>
                        <span><b>spread</b>: Scale of the embedding — increase if clusters are too packed</span>
                    </div>
                </div>

                <!-- Loading -->
                <div v-if="loadingUMAP" class="umap-loading">
                    <div class="umap-loading__inner">
                        <span class="umap-loading__spinner"></span>
                        <span class="umap-loading__text">Running UMAP&hellip;</span>
                    </div>
                    <div v-if="umapProgress > 0" class="umap-progress">
                        <div class="umap-progress__bar-wrap">
                            <div class="umap-progress__bar" :style="{ width: umapProgress + '%' }"></div>
                        </div>
                        <span class="umap-progress__text">{{ umapProgress }}% optimised</span>
                    </div>
                </div>

                <!-- Result -->
                <div v-show="umapReady && !loadingUMAP" class="umap-result">
                    <div class="umap-plot-row">
                        <div class="umap-plot-wrap">
                            <div id="umap_plot" class="umap-plot"></div>
                        </div>

                        <div class="umap-sidebar">
                            <!-- Stats -->
                            <div v-if="umapStats" class="umap-stats">
                                <p class="umap-stats__title">Embedding Info</p>
                                <div class="umap-stat-row"><span class="umap-stat-key">Samples</span><span class="umap-stat-val">{{ umapStats.n }}</span></div>
                                <div class="umap-stat-row"><span class="umap-stat-key">Features in</span><span class="umap-stat-val">{{ umapStats.inputDim }}</span></div>
                                <div class="umap-stat-row"><span class="umap-stat-key">Components out</span><span class="umap-stat-val">{{ umapStats.nComponents }}</span></div>
                                <div class="umap-stat-row"><span class="umap-stat-key">n_neighbors</span><span class="umap-stat-val">{{ umapStats.nNeighbors }}</span></div>
                                <div class="umap-stat-row"><span class="umap-stat-key">min_dist</span><span class="umap-stat-val">{{ umapStats.minDist }}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty state -->
                <div v-if="!umapReady && !loadingUMAP" class="umap-empty">
                    <i class="fas fa-circle-nodes umap-empty__icon" aria-hidden="true"></i>
                    <p class="umap-empty__text">Configure parameters above and click <strong>Fit UMAP</strong> to visualise the embedding.</p>
                    <div class="umap-cmp-table">
                        <p class="umap-cmp-table__title">UMAP vs t-SNE at a glance</p>
                        <table class="umap-cmp">
                            <thead><tr><th>Property</th><th>UMAP</th><th>t-SNE</th></tr></thead>
                            <tbody>
                                <tr><td>Speed</td><td class="good">Fast ✓</td><td class="warn">Slow</td></tr>
                                <tr><td>Global structure</td><td class="good">Preserved ✓</td><td class="warn">Often lost</td></tr>
                                <tr><td>Cluster distances</td><td class="good">Meaningful ✓</td><td class="warn">Not reliable</td></tr>
                                <tr><td>3D support</td><td class="good">Yes ✓</td><td class="good">Yes ✓</td></tr>
                                <tr><td>Reproducibility</td><td class="good">Seed-stable ✓</td><td class="warn">Varies</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
       </div><!-- /manifold section -->

       <!-- ══ Autoencoder ════════════════════════════════════════════════ -->
       <div v-show="drSection === 'autoencoder'">
       <!-- ══ Autoencoder Card ══════════════════════════════════════════ -->
        <div class="message is-info ae-card">
            <div class="message-header p-2 ae-header">
                <span class="ae-header__title">
                    <i class="fas fa-brain ae-header__icon" aria-hidden="true"></i>
                    Autoencoder
                </span>
                <b-tooltip append-to-body label="An Autoencoder learns a compressed (latent) representation by training an encoder-decoder pair. Configure hidden layers, bottleneck size and training params, then visualise the latent space." multilined>
                    <b-button icon-left="info" icon-pack="fas" size="is-small" type="is-dark" />
                </b-tooltip>
            </div>

            <div class="message-body ae-body">

                <!-- Educational Explanation Panel -->
                <div class="dr-explanation">
                    <p class="dr-explanation__title">
                        <i class="fas fa-graduation-cap" aria-hidden="true"></i> Understanding Autoencoders
                    </p>
                    <p class="dr-explanation__text">
                        An Autoencoder is a symmetric neural network trained to reconstruct its input. It consists of an <b>Encoder</b> that compresses the input into a lower-dimensional bottleneck layer (the latent space), and a <b>Decoder</b> that reconstructs the original features from this latent representation. By constraining the bottleneck dimension, the network is forced to learn non-linear manifold structures.
                    </p>
                    <div class="dr-explanation__bullets">
                        <div><b>Bottleneck Size:</b> The number of units in the latent representation. It defines the dimensionality of the compressed features you can plot.</div>
                        <div><b>Loss Curve:</b> Tracks the reconstruction Mean Squared Error (MSE) over training epochs. A smooth, downward curve indicates successful learning.</div>
                    </div>
                </div>

                <!-- ── Architecture builder ─────────────────────────────── -->
                <div class="ae-section">
                    <p class="ae-section__title">
                        <span class="ae-badge ae-badge--1">1</span>
                        Architecture
                    </p>

                    <!-- Visual architecture diagram -->
                    <div class="ae-arch-diagram">
                        <!-- Input block -->
                        <div class="ae-arch-block ae-arch-block--input">
                            <div class="ae-arch-block__label">Input</div>
                            <div class="ae-arch-block__neurons">{{ aeInputDim || '?' }}</div>
                            <div class="ae-arch-block__sub">features</div>
                        </div>
                        <div class="ae-arch-arrow">→</div>

                        <!-- Encoder layers -->
                        <template v-for="(layer, li) in aeEncoderLayers" :key="'e'+li">
                            <div class="ae-arch-block ae-arch-block--enc">
                                <div class="ae-arch-block__tag">Encoder {{ li + 1 }}</div>
                                <div class="ae-arch-block__neurons">{{ layer.units }}</div>
                                <div class="ae-arch-block__sub">{{ layer.activation }}</div>
                            </div>
                            <div class="ae-arch-arrow">→</div>
                        </template>

                        <!-- Bottleneck -->
                        <div class="ae-arch-block ae-arch-block--bottleneck">
                            <div class="ae-arch-block__tag">Bottleneck</div>
                            <div class="ae-arch-block__neurons">{{ hiddenLayerSize }}</div>
                            <div class="ae-arch-block__sub">{{ aeLatentActivation }}</div>
                        </div>
                        <div class="ae-arch-arrow">→</div>

                        <!-- Decoder mirrors encoder in reverse -->
                        <template v-for="(layer, li) in [...aeEncoderLayers].reverse()" :key="'d'+li">
                            <div class="ae-arch-block ae-arch-block--dec">
                                <div class="ae-arch-block__tag">Decoder {{ li + 1 }}</div>
                                <div class="ae-arch-block__neurons">{{ layer.units }}</div>
                                <div class="ae-arch-block__sub">{{ layer.activation }}</div>
                            </div>
                            <div class="ae-arch-arrow">→</div>
                        </template>

                        <!-- Output block -->
                        <div class="ae-arch-block ae-arch-block--output">
                            <div class="ae-arch-block__label">Output</div>
                            <div class="ae-arch-block__neurons">{{ aeInputDim || '?' }}</div>
                            <div class="ae-arch-block__sub">{{ aeDecoderOutputActivation }}</div>
                        </div>
                    </div>

                    <!-- Layer editor -->
                    <div class="ae-layer-header">
                        <span class="ae-layer-header__text">Hidden layers (encoder side — decoder mirrors)</span>
                        <button class="ae-layer-add" @click="addAeLayer" :disabled="loadingAutoEncoder">
                            <i class="fas fa-plus-circle"></i> Add layer
                        </button>
                    </div>

                    <div class="ae-layers-list">
                        <div v-for="(layer, li) in aeEncoderLayers" :key="li" class="ae-layer-row">
                            <span class="ae-layer-row__num">{{ li + 1 }}</span>
                            <b-field label="Neurons" :label-position="'on-border'" class="ae-layer-field">
                                <b-input v-model.number="layer.units" size="is-small" type="number"
                                    min="2" max="512" step="1" :disabled="loadingAutoEncoder"></b-input>
                            </b-field>
                            <b-field label="Activation" :label-position="'on-border'" class="ae-layer-field">
                                <b-select v-model="layer.activation" size="is-small" :disabled="loadingAutoEncoder">
                                    <option v-for="a in aeActivations" :key="a" :value="a">{{ a }}</option>
                                </b-select>
                            </b-field>
                            <button class="ae-layer-remove" @click="removeAeLayer(li)" :disabled="loadingAutoEncoder || aeEncoderLayers.length <= 1" title="Remove layer">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Bottleneck & output controls -->
                    <div class="ae-bottleneck-row">
                        <b-field label="Bottleneck (latent) size" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-input v-model.number="hiddenLayerSize" size="is-small" type="number"
                                min="2" max="64" step="1" :disabled="loadingAutoEncoder"></b-input>
                        </b-field>
                        <b-field label="Latent activation" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-select v-model="aeLatentActivation" size="is-small" :disabled="loadingAutoEncoder">
                                <option v-for="a in aeActivations" :key="a" :value="a">{{ a }}</option>
                            </b-select>
                        </b-field>
                        <b-field label="Output activation" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-select v-model="aeDecoderOutputActivation" size="is-small" :disabled="loadingAutoEncoder">
                                <option v-for="a in aeActivations" :key="a" :value="a">{{ a }}</option>
                            </b-select>
                        </b-field>
                    </div>
                </div>

                <!-- ── Training settings ─────────────────────────────────── -->
                <div class="ae-section ae-section--bordered">
                    <p class="ae-section__title">
                        <span class="ae-badge ae-badge--2">2</span>
                        Training
                    </p>
                    <div class="ae-train-grid">
                        <b-field label="Epochs" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-input v-model.number="iterations" size="is-small" type="number"
                                min="1" max="2000" step="10" :disabled="loadingAutoEncoder"></b-input>
                        </b-field>
                        <b-field label="Learning rate" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-input v-model.number="aeLearningRate" size="is-small" type="number"
                                min="0.0001" max="0.5" step="0.001" :disabled="loadingAutoEncoder"></b-input>
                        </b-field>
                        <b-field label="Optimizer" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-select v-model="aeOptimizer" size="is-small" :disabled="loadingAutoEncoder">
                                <option value="adam">Adam</option>
                                <option value="rmsprop">RMSProp</option>
                                <option value="sgd">SGD</option>
                            </b-select>
                        </b-field>
                        <b-field label="Seed" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-input v-model.number="autoEncoderSeed" size="is-small" type="number"
                                min="0" step="1" :disabled="loadingAutoEncoder"></b-input>
                        </b-field>
                    </div>
                    <div class="ae-train-actions">
                        <b-button size="is-small" type="is-info" icon-left="play" icon-pack="fas"
                            :loading="loadingAutoEncoder" @click="autoEncoder" label="Fit Autoencoder"
                            :disabled="loadingAutoEncoder" />
                        <b-button v-if="aeReady" size="is-small" type="is-light" icon-left="download" icon-pack="fas"
                            @click="downloadAePlot" label="Download plot" class="ml-1" />
                    </div>

                    <!-- Training progress bar -->
                    <div v-if="loadingAutoEncoder" class="ae-progress">
                        <div class="ae-progress__bar-wrap">
                            <div class="ae-progress__bar" :style="{ width: aeProgressPct + '%' }"></div>
                        </div>
                        <span class="ae-progress__text">Epoch {{ aeCurrentEpoch }} / {{ iterations }} &nbsp;|&nbsp; Loss: {{ aeCurrentLoss }}</span>
                    </div>
                </div>

                <!-- ── Visualisation ─────────────────────────────────────── -->
                <div v-if="aeReady" class="ae-section ae-section--bordered">
                    <p class="ae-section__title">
                        <span class="ae-badge ae-badge--3">3</span>
                        Latent Space Projection
                    </p>

                    <div class="ae-viz-controls">
                        <b-field label="X axis (dim)" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-input v-model.number="autoEncoderX" size="is-small" type="number"
                                min="1" :max="hiddenLayerSize" step="1"></b-input>
                        </b-field>
                        <b-field label="Y axis (dim)" :label-position="'on-border'" class="ae-ctrl-field">
                            <b-input v-model.number="autoEncoderY" size="is-small" type="number"
                                min="1" :max="hiddenLayerSize" step="1"></b-input>
                        </b-field>
                        <b-button size="is-small" type="is-light" icon-left="sync" icon-pack="fas"
                            @click="redrawAutoencoder" label="Redraw" />
                    </div>

                    <div class="ae-plots-grid">
                        <div class="ae-plot-cell">
                            <p class="ae-plot-label">Latent Space (Dim {{ autoEncoderX }} vs {{ autoEncoderY }})</p>
                            <div id="autoencoder" class="ae-plot"></div>
                        </div>
                        <div class="ae-plot-cell">
                            <p class="ae-plot-label">Training Loss</p>
                            <div id="ae_loss" class="ae-plot"></div>
                        </div>
                    </div>

                    <!-- Reconstruction stats -->
                    <div v-if="aeStats" class="ae-stats-row">
                        <div class="ae-stat-pill">
                            <span class="ae-stat-pill__label">Final Train Loss</span>
                            <span class="ae-stat-pill__val">{{ aeStats.trainLoss }}</span>
                        </div>
                        <div v-if="aeStats.valLoss" class="ae-stat-pill">
                            <span class="ae-stat-pill__label">Final Val Loss</span>
                            <span class="ae-stat-pill__val">{{ aeStats.valLoss }}</span>
                        </div>
                        <div class="ae-stat-pill">
                            <span class="ae-stat-pill__label">Latent Dim</span>
                            <span class="ae-stat-pill__val">{{ aeStats.latentDim }}</span>
                        </div>
                        <div class="ae-stat-pill">
                            <span class="ae-stat-pill__label">Total Layers</span>
                            <span class="ae-stat-pill__val">{{ aeStats.totalLayers }}</span>
                        </div>
                    </div>
                </div>

                <!-- Loading state (shown during training even on re-runs) -->
                <div v-if="loadingAutoEncoder" class="ae-loading">
                    <span class="ae-loading__spinner"></span>
                    <span class="ae-loading__text">Training autoencoder&hellip;</span>
                </div>
                <!-- Empty state (first visit, no training yet) -->
                <div v-if="!aeReady && !loadingAutoEncoder" class="ae-empty">
                    <i class="fas fa-brain ae-empty__icon" aria-hidden="true"></i>
                    <p class="ae-empty__text">Configure the architecture above and click <strong>Fit Autoencoder</strong> to train and visualise the latent space.</p>
                </div>
            </div>
        </div>
       </div><!-- /autoencoder section -->

   </section>
   <section v-else>
        <b-message type="is-danger" has-icon icon-pack="fas">
            There is no data to show.
        </b-message>
    </section>
</template>

<script>
import { ChartController } from '@/helpers/charts';
import { settingStore } from '@/stores/settings'
import { getPlotly, getDanfo } from '@/utils/danfo_loader';
import UMAPReducer from '@/helpers/dimensionality-reduction/umap';
import { getGraphPalette, getPlotlyAxisDefaults, mergePlotlyLayout } from '@/helpers/chart-theme';

import { FeatureCategories } from '@/helpers/settings'

export default {
    name: 'dmensionality-reduction-component',
    setup() {
        const settings = settingStore()

        return { settings }
    },
    props: {
        msg: String,
        dataframe: Object,
        columns: []
    },
    data() {
        return {
            drSection: 'pca',
            drSubtabs: [
                { id: 'pca',         label: 'PCA' },
                { id: 'manifold',    label: 't-SNE & UMAP' },
                { id: 'autoencoder', label: 'Autoencoder' },
            ],
            numberOfComponents: 2,
            loadingPCA: false,
            loadingTSNE: false,
            x: 1, y: 2,
            loadingAutoEncoder: false,
            hiddenLayerSize: 4,
            componentsTSNE: 2,
            tsnePerplexity: 30,
            seedTSNE: 123,
            pcaData: null,
            pcaVarianceData: null,
            iterations: 150,
            autoEncoderSeed: 123,
            // legacy (kept for compat)
            encoderActivationFunction: 'relu',
            decoderActivationFunction: 'linear',
            autoEncoderX: 1,
            autoEncoderY: 2,
            hasPCA: false,
            pcaContainers: [],
            df: null,
            tsneReady: false,
            tsneLegend: [],
            pcaLegend: [],
            pcaVarianceCards: [],
            pcaSeed: 42,
            pcaScaleData: true,
            // ── UMAP fields ────────────────────────────────────────────
            umapComponents: 2,
            umapNeighbors: 15,
            umapMinDist: 0.1,
            umapSpread: 1.0,
            umapSeed: 42,
            loadingUMAP: false,
            umapReady: false,
            umapLegend: [],
            umapStats: null,
            umapProgress: 0,
            // ── Autoencoder new fields ─────────────────────────────────
            aeEncoderLayers: [
                { units: 32, activation: 'relu' },
            ],
            aeLatentActivation: 'relu',
            aeDecoderOutputActivation: 'linear',
            aeLearningRate: 0.01,
            aeOptimizer: 'adam',
            aeActivations: ['relu', 'sigmoid', 'tanh', 'linear', 'elu', 'selu'],
            aeReady: false,
            aeStats: null,
            aeEncodedData: null,
            aeLabels: null,
            aeProgressPct: 0,
            aeCurrentEpoch: 0,
            aeCurrentLoss: '—',
            aeInputDim: null,
            aeLossHistory: null,
        }
    },
    computed: {
        pcaMaxComponents() {
            const n = this.settings.items.filter(c => c.selected && c.type === 1).length;
            const max = Math.min(n, this.pcaVarianceData ? this.pcaVarianceData.length : n);
            return Array.from({ length: Math.max(0, max - 1) }, (_, i) => i + 2);
        },
        pcaCumulativePct() {
            if (!this.pcaVarianceData || !this.pcaVarianceCards.length) return '—';
            // Sum the raw variance values for the displayed cards (max 6)
            const n = this.pcaVarianceCards.length;
            const sum = this.pcaVarianceData.slice(0, n).reduce((s, v) => s + v, 0);
            return (sum * 100).toFixed(1) + '%';
        },
        pcaRecommendedComponents() {
            if (!this.pcaVarianceData?.length) return 2;
            let cumulative = 0;
            for (let i = 0; i < this.pcaVarianceData.length; i++) {
                cumulative += this.pcaVarianceData[i];
                if (cumulative >= 0.8) return Math.max(2, i + 1);
            }
            return Math.max(2, this.pcaVarianceData.length);
        },
        pcaRecommendedPct() {
            if (!this.pcaVarianceData?.length) return '—';
            const n = Math.min(this.pcaRecommendedComponents, this.pcaVarianceData.length);
            const sum = this.pcaVarianceData.slice(0, n).reduce((s, v) => s + v, 0);
            return (sum * 100).toFixed(1) + '%';
        },
        pcaFirstTwoPct() {
            if (!this.pcaVarianceData?.length) return '—';
            const sum = this.pcaVarianceData.slice(0, 2).reduce((s, v) => s + v, 0);
            return (sum * 100).toFixed(1) + '%';
        },
    },
    methods: {
        async prepareData() {
            const danfo = await getDanfo()
            this.df = new danfo.DataFrame(this.settings.rawData);
            this.df.dropNa({ axis: 1, inplace: true })
            if (this.settings.isClassification && this.settings.mergedClasses?.length > 0) {
                this.settings.mergedClasses.forEach((classes) => {
                    let newClass = classes.map(m => m.class).join('_');
                    classes.forEach(cls => {
                        this.df.replace(cls.class, newClass, { columns: [this.settings.modelTarget], inplace: true })
                    });
                })
            }
        },
        async drawPCA() {
            this.numberOfComponents = 2;
            await this.findPCA(true);
        },
        async findPCA(drawExplainedVariance = false) {
            if (this.loadingPCA) return;
            this.loadingPCA = true;
            try {
                await this.prepareData();
                await getPlotly();
                this.pcaContainers = [];
                const numericColumns = this.settings.items
                    .filter(c => c.selected && c.type === 1)
                    .map(c => c.name);

                // Only keep columns that survived the dropNa(axis:1) in prepareData()
                const dfCols = this.df.columns || [];
                const validNumericCols = numericColumns.filter(c => dfCols.includes(c));

                if (validNumericCols.length < 2) {
                    this.$buefy.toast.open({ message: 'Need at least 2 numeric features with no missing values. Check your data.', type: 'is-warning' });
                    return;
                }

                if (!drawExplainedVariance) {
                    const n = Number(this.numberOfComponents);
                    if (n === 2) {
                        this.pcaContainers.push([1, 2]);
                    } else if (n === 3) {
                        this.pcaContainers.push([1, 2], [1, 3], [2, 3]);
                    } else if (n > 3) {
                        this.pcaContainers.push([1, 2], [1, 3], [2, 3]);
                        for (let i = 4; i <= n; i++) {
                            for (let j = 1; j < i; j++) {
                                this.pcaContainers.push([j, i]);
                            }
                        }
                    }
                } else {
                    this.numberOfComponents = validNumericCols.length;
                }

                // Build aligned feature + label arrays using only rows with no NaN in numeric cols
                const target = this.settings.modelTarget;
                const hasTarget = !!(target && dfCols.includes(target));

                // Get the raw feature values and filter rows that are fully numeric/non-null
                const rawFeatureValues = this.df.loc({ columns: validNumericCols }).values;
                const rawLabelValues = hasTarget
                    ? this.df.loc({ columns: [target] }).values
                    : null;

                const isNumericBad = v => v === null || v === undefined || (typeof v === 'number' && isNaN(v)) || v === '';
                const cleanRows = rawFeatureValues.reduce((acc, row, idx) => {
                    if (!row.some(isNumericBad)) {
                        acc.x.push(row);
                        if (rawLabelValues) acc.labels.push(rawLabelValues[idx]);
                    }
                    return acc;
                }, { x: [], labels: [] });

                if (cleanRows.x.length < 2) {
                    this.$buefy.toast.open({ message: 'Not enough clean rows after removing NaN values.', type: 'is-warning' });
                    return;
                }

                const x = cleanRows.x;
                const labels = cleanRows.labels;

                // Reveal the plot containers BEFORE calling Plotly so the DOM elements exist
                this.hasPCA = true;
                await this.$nextTick();

                const pcaResult = await this.chartController.draw_pca(
                    x,
                    this.settings.isClassification,
                    labels,
                    this.numberOfComponents,
                    this.pcaContainers,
                    validNumericCols,
                    drawExplainedVariance,
                    Number(this.pcaSeed) || 42,
                    this.pcaScaleData !== false
                );
                this.pcaData = pcaResult[0];
                this.pcaVarianceData = pcaResult[1];
                this.pcaLegend = pcaResult[2] || [];

                // Build variance KPI cards (top 6 max for display)
                if (this.pcaVarianceData) {
                    const top = this.pcaVarianceData.slice(0, 6);
                    const maxV = Math.max(...top);
                    this.pcaVarianceCards = top.map(v => ({
                        pct: (v * 100).toFixed(1) + '%',
                        fill: ((v / maxV) * 100).toFixed(1) + '%',
                    }));
                    // Auto-select elbow (first PC where cumulative ≥ 80%)
                    if (drawExplainedVariance) {
                        let cum = 0;
                        let elbow = 2;
                        for (let i = 0; i < this.pcaVarianceData.length; i++) {
                            cum += this.pcaVarianceData[i];
                            if (cum >= 0.8) { elbow = Math.max(2, i + 1); break; }
                        }
                        this.numberOfComponents = Math.min(elbow, validNumericCols.length);
                    }
                }

            } catch (error) {
                console.error('PCA failed:', error);
                this.$buefy.toast.open({ message: `PCA failed: ${error?.message || error}`, type: 'is-danger' });
            } finally {
                this.loadingPCA = false;
            }
        },
        downloadPCAPlot() {
            this.chartController.downloadPlot('pca_matrix');
        },
        async downloadPCA() {
            const danfo = await getDanfo()
            let df = new danfo.DataFrame(this.pcaData)
            danfo.toCSV(df, { filePath: "pca_data.csv", download: true });
        },
        async downloadExplainedVariance() {
            const danfo = await getDanfo()

            let varianceData = [];
            for (let i = 1; i <= this.pcaVarianceData.length; i++) {
                const element = this.pcaVarianceData[i - 1];
                varianceData.push({ Components: i, ExplainedVariace: element })
            }
            let df = new danfo.DataFrame(varianceData)
            danfo.toCSV(df, { filePath: "variance_data.csv", download: true });
        },
        downloadTSNEPlot() {
            this.chartController.downloadPlot('tsne');
        },
        async findTSNE() {
            if (this.loadingTSNE) return;
            this.loadingTSNE = true;
            this.tsneReady = false;
            this.tsneLegend = [];
            try {
                await this.prepareData();
                await getPlotly();

                let numericColumns = this.settings.items
                    .filter(c => c.selected && c.type === 1)
                    .map(c => c.name);
                const dfCols = this.df.columns || [];
                numericColumns = numericColumns.filter(c => dfCols.includes(c));

                if (numericColumns.length < 2) {
                    this.$buefy.toast.open({ message: 'Need at least 2 numeric features for t-SNE', type: 'is-warning' });
                    this.loadingTSNE = false;
                    return;
                }

                const rawValues = this.df.loc({ columns: numericColumns }).values;
                const isNumericBad = v => v === null || v === undefined || (typeof v === 'number' && isNaN(v)) || v === '';
                const target = this.settings.modelTarget;
                const hasTarget = !!(target && dfCols.includes(target));
                const rawLabels = hasTarget ? this.df.loc({ columns: [target] }).values : null;

                const cleanData = [], cleanLabels = [];
                rawValues.forEach((row, idx) => {
                    if (!row.some(isNumericBad)) {
                        cleanData.push(row.map(Number));
                        if (rawLabels) cleanLabels.push(rawLabels[idx]);
                    }
                });

                if (cleanData.length < 4) {
                    this.$buefy.toast.open({ message: 't-SNE requires at least 4 clean rows after removing NaN values.', type: 'is-warning' });
                    this.loadingTSNE = false;
                    return;
                }

                const labels = cleanLabels.length ? cleanLabels : cleanData.map((_, i) => [i]);

                const legend = await this.chartController.plot_tsne(
                    cleanData,
                    this.settings.isClassification,
                    labels,
                    this.seedTSNE,
                    this.componentsTSNE,
                    Number(this.tsnePerplexity) || 30
                );
                if (legend) this.tsneLegend = legend;
                this.tsneReady = true;
                this.loadingTSNE = false;
            } catch (error) {
                this.loadingTSNE = false;
                console.error('t-SNE failed:', error);
                this.$buefy.toast.open({ message: `t-SNE failed: ${error?.message || error}`, type: 'is-danger' });
            }
        },
        downloadUMAPPlot() {
            this.chartController.downloadPlot('umap_plot');
        },

        async findUMAP() {
            if (this.loadingUMAP) return;
            this.loadingUMAP = true;
            this.umapReady = false;
            this.umapLegend = [];
            this.umapStats = null;
            this.umapProgress = 0;
            try {
                await this.prepareData();
                const Plotly = await getPlotly();

                let numericColumns = this.settings.items
                    .filter(c => c.selected && c.type === 1)
                    .map(c => c.name);
                const dfCols = this.df.columns || [];
                numericColumns = numericColumns.filter(c => dfCols.includes(c));

                if (numericColumns.length < 2) {
                    this.$buefy.toast.open({ message: 'Need at least 2 numeric features for UMAP', type: 'is-warning' });
                    return;
                }

                const rawValues = this.df.loc({ columns: numericColumns }).values;
                const isNumericBad = v => v === null || v === undefined || (typeof v === 'number' && isNaN(v)) || v === '';
                const target = this.settings.modelTarget;
                const hasTarget = !!(target && dfCols.includes(target));
                const rawLabels = hasTarget ? this.df.loc({ columns: [target] }).values : null;

                const cleanData = [], cleanLabels = [];
                rawValues.forEach((row, idx) => {
                    if (!row.some(isNumericBad)) {
                        cleanData.push(row.map(Number));
                        if (rawLabels) cleanLabels.push(rawLabels[idx][0]);
                    }
                });

                if (cleanData.length < 4) {
                    this.$buefy.toast.open({ message: 'UMAP requires at least 4 clean rows', type: 'is-warning' });
                    return;
                }

                const umap = new UMAPReducer();
                const embedding = await umap.predict(
                    cleanData,
                    this.umapComponents,
                    this.umapNeighbors,
                    this.umapMinDist,
                    this.umapSpread,
                    this.umapSeed,
                    0,
                    (ep, total) => { this.umapProgress = Math.round((ep / total) * 100); }
                );

                const labels = cleanLabels.length ? cleanLabels : cleanData.map((_, i) => i);
                const isClass = this.settings.isClassification && cleanLabels.length > 0;
                const uniqueLabels = [...new Set(labels)];

                this.umapReady = true;
                await this.$nextTick();

                // ── Build Plotly traces ───────────────────────────────
                const is3D = this.umapComponents === 3;
                const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                const legendItems = [];
                const graphPalette = getGraphPalette(this.settings.isDark);
                const axisDefaults = getPlotlyAxisDefaults(this.settings.isDark);
                const embeddedLegend = {
                    x: 0.985,
                    y: 0.86,
                    xanchor: 'right',
                    yanchor: 'top',
                    bgcolor: graphPalette.tooltipBg,
                    bordercolor: graphPalette.annotationBorder,
                    borderwidth: 1,
                    font: { size: 10, color: graphPalette.tooltipText },
                    itemclick: 'toggle',
                    itemdoubleclick: 'toggleothers',
                };

                let traces;
                if (isClass) {
                    traces = uniqueLabels.map((lab, ki) => {
                        const color = PALETTE[ki % PALETTE.length];
                        legendItems.push({ label: String(lab), color });
                        const mask = labels.map((l, i) => l === lab ? i : -1).filter(i => i >= 0);
                        const common = {
                            mode: 'markers', name: String(lab), showlegend: true,
                            marker: { color, size: is3D ? 4 : 6, opacity: 0.82, line: { width: 0.5, color: '#fff' } },
                            hovertemplate: `<b>${String(lab)}</b><extra></extra>`,
                        };
                        return is3D
                            ? { type: 'scatter3d', ...common, x: mask.map(i => embedding[i][0]), y: mask.map(i => embedding[i][1]), z: mask.map(i => embedding[i][2]) }
                            : { type: 'scatter', ...common, x: mask.map(i => embedding[i][0]), y: mask.map(i => embedding[i][1]) };
                    });
                } else {
                    // Regression/no target — colour by row index sequentially
                    const min = 0, max = cleanData.length - 1;
                    const colors = labels.map((_, i) => {
                        const t = i / Math.max(1, max);
                        const r = Math.round(59 + t * (236 - 59));
                        const g = Math.round(130 + t * (72 - 130));
                        const b = Math.round(246 + t * (153 - 246));
                        return `rgb(${r},${g},${b})`;
                    });
                    const common = {
                        mode: 'markers', name: 'Points', showlegend: false,
                        marker: { color: colors, size: is3D ? 4 : 6, opacity: 0.82, colorscale: 'Viridis', showscale: false },
                    };
                    traces = [is3D
                        ? { type: 'scatter3d', ...common, x: embedding.map(v => v[0]), y: embedding.map(v => v[1]), z: embedding.map(v => v[2]) }
                        : { type: 'scatter', ...common, x: embedding.map(v => v[0]), y: embedding.map(v => v[1]) }];
                }

                const axisStyle = { ...axisDefaults, showgrid: true, zeroline: false };
                const axis3D = {
                    backgroundcolor: graphPalette.panelBg,
                    gridcolor: graphPalette.grid,
                    gridwidth: 1,
                    zerolinecolor: graphPalette.zeroLine,
                    showspikes: false,
                    tickfont: { size: 10, color: graphPalette.textMuted },
                    titlefont: { size: 11, color: graphPalette.text },
                };

                const layout = is3D ? mergePlotlyLayout({
                    autosize: true, height: 520,
                    margin: { t: 0, r: 0, b: 0, l: 0 },
                    paper_bgcolor: graphPalette.paperBg,
                    scene: {
                        xaxis: { title: { text: 'UMAP 1', font: { size: 11 } }, ...axis3D },
                        yaxis: { title: { text: 'UMAP 2', font: { size: 11 } }, ...axis3D },
                        zaxis: { title: { text: 'UMAP 3', font: { size: 11 } }, ...axis3D },
                        bgcolor: graphPalette.plotBg,
                        camera: { eye: { x: 1.4, y: 1.4, z: 0.9 } },
                        aspectmode: 'cube',
                    },
                    hovermode: 'closest',
                    showlegend: isClass,
                    legend: embeddedLegend,
                }, this.settings.isDark) : mergePlotlyLayout({
                    autosize: true, height: 480,
                    margin: { t: 30, r: 20, b: 50, l: 50 },
                    paper_bgcolor: graphPalette.paperBg, plot_bgcolor: graphPalette.plotBg,
                    font: { size: 11, color: graphPalette.text },
                    title: { text: `UMAP — n_neighbors=${this.umapNeighbors}, min_dist=${this.umapMinDist}`, font: { size: 12, color: graphPalette.text }, x: 0.04 },
                    xaxis: { title: 'UMAP 1', ...axisStyle },
                    yaxis: { title: 'UMAP 2', ...axisStyle },
                    hovermode: 'closest',
                    showlegend: isClass,
                    legend: embeddedLegend,
                }, this.settings.isDark);

                Plotly.react('umap_plot', traces, layout, { responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['resetCameraLastSave3d'] });
                this.umapLegend = legendItems;
                this.umapStats = {
                    n: cleanData.length,
                    inputDim: numericColumns.length,
                    nComponents: this.umapComponents,
                    nNeighbors: this.umapNeighbors,
                    minDist: this.umapMinDist,
                };

            } catch (error) {
                console.error('UMAP error:', error);
                this.$buefy.toast.open({ message: `UMAP failed: ${error?.message || error}`, type: 'is-danger' });
                this.umapReady = false;
            } finally {
                this.loadingUMAP = false;
            }
        },

        addAeLayer() {
            this.aeEncoderLayers.push({ units: 16, activation: 'relu' });
        },
        removeAeLayer(idx) {
            if (this.aeEncoderLayers.length <= 1) return;
            this.aeEncoderLayers.splice(idx, 1);
        },
        downloadAePlot() {
            this.chartController.downloadPlot('autoencoder');
        },
        async redrawAutoencoder() {
            if (!this.aeEncodedData || !this.aeLabels) return;
            const Plotly = await getPlotly();
            const latentDim = this.aeEncodedData[0]?.length ?? 2;
            const xIdx = Math.min(Math.max(0, this.autoEncoderX - 1), latentDim - 1);
            const yIdx = Math.min(Math.max(0, this.autoEncoderY - 1), latentDim - 1);
            if (xIdx === yIdx) { this.$buefy.toast.open({ message: 'X and Y must be different dimensions', type: 'is-warning' }); return; }
            this.chartController.drawAutoencoder(this.aeEncodedData, xIdx, yIdx, this.aeLabels, this.settings.isClassification);
        },
        async _drawAeLossChart(history) {
            const Plotly = await getPlotly();
            const el = document.getElementById('ae_loss');
            if (!el || !history?.loss?.length) return;
            const epochs = Array.from({ length: history.loss.length }, (_, i) => i + 1);
            const layout = mergePlotlyLayout({
                autosize: true,
                height: 300,
                margin: { t: 30, r: 14, b: 44, l: 50 },
                title: { text: 'Loss per Epoch', font: { size: 12 }, x: 0.04 },
                xaxis: { title: 'Epoch', showgrid: true, zeroline: false },
                yaxis: { title: 'MSE Loss', showgrid: true, zeroline: false },
            }, this.settings.isDark);
            const traces = [
                { x: epochs, y: history.loss, mode: 'lines', name: 'Train', line: { color: '#3b82f6', width: 2 } },
            ];
            if (history.valLoss?.length) {
                traces.push({ x: epochs, y: history.valLoss, mode: 'lines', name: 'Val', line: { color: '#ef4444', width: 2, dash: 'dash' } });
            }
            Plotly.react('ae_loss', traces, layout, { responsive: true, displayModeBar: false });
        },
        async autoEncoder() {
            if (this.loadingAutoEncoder) return;
            this.loadingAutoEncoder = true;
            this.aeReady = false;
            this.aeStats = null;
            this.aeProgressPct = 0;
            this.aeCurrentEpoch = 0;
            this.aeCurrentLoss = '—';
            try {
                await this.prepareData();
                await getPlotly();

                let numericColumns = this.settings.items
                    .filter(c => c.selected && c.type === FeatureCategories.Numerical.id)
                    .map(c => c.name);
                if (numericColumns.length < 2) {
                    numericColumns = this.settings.items
                        .filter(c => c.type === FeatureCategories.Numerical.id)
                        .map(c => c.name);
                }
                if (numericColumns.length < 2) {
                    this.$buefy.toast.open({ message: 'Select at least 2 numerical features in Data Analysis', type: 'is-warning' });
                    return;
                }

                const values = this.df.loc({ columns: numericColumns }).values;
                const valuesArray = Array.isArray(values)
                    ? values.map(row => (Array.isArray(row) ? row : [row]).map(v => Number(v))).filter(row => row.every(Number.isFinite))
                    : [];
                if (valuesArray.length === 0) { this.$buefy.toast.open({ message: 'No valid numeric data to fit autoencoder', type: 'is-warning' }); return; }

                const latentSize = Math.max(2, Number(this.hiddenLayerSize) || 4);
                if (latentSize < 2) { this.$buefy.toast.open({ message: 'Latent size must be ≥ 2', type: 'is-warning' }); return; }

                this.aeInputDim = valuesArray[0].length;
                const totalEpochs = Math.max(1, Number(this.iterations) || 150);

                const { default: Autoencoder } = await import('@/helpers/dimensionality-reduction/autoencoder');
                const autoencoder = new Autoencoder();
                const result = await autoencoder.predict(
                    valuesArray,
                    latentSize,
                    totalEpochs,
                    this.aeEncoderLayers,
                    this.aeLatentActivation,
                    this.aeDecoderOutputActivation,
                    this.autoEncoderSeed,
                    this.aeLearningRate,
                    this.aeOptimizer,
                    (epoch, total, loss) => {
                        this.aeCurrentEpoch = epoch;
                        this.aeProgressPct = Math.round((epoch / total) * 100);
                        this.aeCurrentLoss = Number(loss).toFixed(5);
                    }
                );

                const labels = this.settings.modelTarget
                    ? this.df.loc({ columns: [this.settings.modelTarget] }).values
                    : Array.from({ length: valuesArray.length }, (_, i) => [i]);

                this.aeEncodedData = result.encoded;
                this.aeLabels = labels;
                this.aeStats = {
                    trainLoss: result.history.loss.length ? result.history.loss[result.history.loss.length - 1].toFixed(5) : '—',
                    valLoss: result.history.valLoss?.length ? result.history.valLoss[result.history.valLoss.length - 1].toFixed(5) : null,
                    latentDim: result.latentDim,
                    totalLayers: this.aeEncoderLayers.length * 2 + 1,
                };

                const actualLatentDim = result.latentDim;
                let xIdx = Math.min(Math.max(0, this.autoEncoderX - 1), actualLatentDim - 1);
                let yIdx = Math.min(Math.max(0, this.autoEncoderY - 1), actualLatentDim - 1);
                if (xIdx === yIdx && actualLatentDim >= 2) {
                    yIdx = (xIdx + 1) % actualLatentDim;
                }

                // ⚠️ Must set loadingAutoEncoder = false BEFORE aeReady = true so the
                // DOM section (v-if="aeReady") renders with its plot containers visible
                // before we call Plotly on them.
                this.loadingAutoEncoder = false;
                this.aeReady = true;
                await this.$nextTick();

                this.chartController.drawAutoencoder(result.encoded, xIdx, yIdx, labels, this.settings.isClassification);
                await this._drawAeLossChart(result.history);
                this.aeLossHistory = result.history;
            } catch (error) {
                console.error('Autoencoder error:', error);
                this.$buefy.toast.open({ message: error?.message || 'Autoencoder failed', type: 'is-danger' });
            } finally {
                // Idempotent safety reset for the error path
                this.loadingAutoEncoder = false;
            }
        },
        async refreshPlotsForTheme() {
            if (this.hasPCA) {
                await this.findPCA(!!this.pcaVarianceData?.length);
            }
            if (this.tsneReady) {
                await this.findTSNE();
            }
            if (this.umapReady) {
                await this.findUMAP();
            }
            if (this.aeReady) {
                await this.redrawAutoencoder();
                if (this.aeLossHistory) {
                    await this._drawAeLossChart(this.aeLossHistory);
                }
            }
        }
    },
    errorCaptured() {

    },
    watch: {
        'settings.isDark'() {
            this.$nextTick(() => this.refreshPlotsForTheme());
        },
    },
    mounted() {
        this.chartController = new ChartController()
        this.autoEncoderSeed = this.settings.getSeed || 123;
    }
}
</script>

<style scoped>
/* ══ DR Sub-tabs nav ═══════════════════════════════════════════ */
.dr-subtabs { margin-bottom: 1.25rem; }

/* ══ UMAP Card ═════════════════════════════════════════════════ */
.umap-card { border-radius: 10px; overflow: hidden; }
.umap-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.umap-header__title { display: flex; align-items: center; gap: 0.45rem; font-size: 0.92rem; font-weight: 600; letter-spacing: 0.01em; }
.umap-header__icon { opacity: 0.82; font-size: 0.85rem; }
.umap-body { padding: 1rem 1.1rem 1.25rem; }

/* Controls row */
.umap-controls { display: flex; flex-wrap: wrap; gap: 0.65rem 1rem; align-items: flex-end; margin-bottom: 0.85rem; }
.umap-field { min-width: 120px; margin-bottom: 0 !important; }
.umap-actions { display: flex; align-items: center; padding-bottom: 2px; gap: 0.4rem; }

/* Parameter guide chips */
.umap-guide { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 1rem; }
.umap-guide__chip { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(248,250,252,0.9); border: 1px solid #e2e8f0; border-radius: 99px; padding: 3px 10px; font-size: 0.73rem; color: #475569; }

/* Loading */
.umap-loading { padding: 1.5rem 0 0.8rem; }
.umap-loading__inner { display: flex; align-items: center; gap: 0.7rem; color: #64748b; font-size: 0.88rem; margin-bottom: 0.6rem; }
.umap-loading__spinner { width: 20px; height: 20px; border: 2.5px solid #cbd5e1; border-top-color: #3b82f6; border-radius: 50%; animation: umap-spin 0.75s linear infinite; flex-shrink: 0; }
@keyframes umap-spin { to { transform: rotate(360deg); } }
.umap-progress { }
.umap-progress__bar-wrap { height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
.umap-progress__bar { height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 3px; transition: width 0.25s ease; }
.umap-progress__text { font-size: 0.74rem; color: #94a3b8; }

/* Result layout */
.umap-result { animation: umapFadeIn 0.4s ease-out; }
@keyframes umapFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.umap-plot-row { display: flex; align-items: flex-start; gap: 1rem; }
.umap-plot-wrap { flex: 1 1 0; min-width: 0; }
.umap-plot { width: 100%; min-height: 400px; }
.umap-sidebar { flex: 0 0 auto; min-width: 140px; max-width: 180px; display: flex; flex-direction: column; gap: 0.75rem; }

/* Legend */
.umap-legend { background: rgba(248,250,252,0.95); border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; padding: 0.65rem 0.8rem; font-size: 0.78rem; }
.umap-legend__title { font-weight: 700; color: #334155; margin-bottom: 0.45rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
.umap-legend__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.umap-legend__item { display: flex; align-items: center; gap: 0.42rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.umap-legend__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 1.5px rgba(0,0,0,0.08); }
.umap-legend__label { color: #475569; overflow: hidden; text-overflow: ellipsis; }

/* Stats */
.umap-stats { background: rgba(248,250,252,0.95); border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; padding: 0.65rem 0.8rem; font-size: 0.78rem; }
.umap-stats__title { font-weight: 700; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.5rem; }
.umap-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; border-bottom: 1px solid rgba(148,163,184,0.12); }
.umap-stat-row:last-child { border-bottom: none; }
.umap-stat-key { color: #94a3b8; font-size: 0.72rem; }
.umap-stat-val { color: #1e293b; font-weight: 700; font-size: 0.8rem; }

/* Empty state */
.umap-empty { display: flex; flex-direction: column; align-items: center; gap: 0.9rem; padding: 2rem 1rem 1.5rem; color: #94a3b8; text-align: center; }
.umap-empty__icon { font-size: 2.4rem; opacity: 0.3; }
.umap-empty__text { font-size: 0.88rem; max-width: 380px; line-height: 1.55; }

/* Comparison table */
.umap-cmp-table { width: 100%; max-width: 540px; }
.umap-cmp-table__title { font-size: 0.78rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem; }
.umap-cmp { width: 100%; border-collapse: collapse; font-size: 0.78rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.umap-cmp th { background: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.04em; padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
.umap-cmp td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.umap-cmp tr:last-child td { border-bottom: none; }
.umap-cmp td.good { color: #059669; font-weight: 600; }
.umap-cmp td.warn { color: #b45309; }

/* ══ Autoencoder Card ══════════════════════════════════════════ */
.ae-card { border-radius: 10px; overflow: hidden; }
.ae-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.ae-header__title { display: flex; align-items: center; gap: 0.45rem; font-size: 0.92rem; font-weight: 600; letter-spacing: 0.01em; }
.ae-header__icon { opacity: 0.82; font-size: 0.85rem; }
.ae-body { padding: 1.1rem 1.2rem 1.4rem; }

.ae-section { margin-bottom: 1.4rem; }
.ae-section--bordered { border-top: 1px solid rgba(148,163,184,0.2); padding-top: 1.2rem; }
.ae-section__title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 0.9rem; }

.ae-badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; color: #fff; font-size: 0.68rem; font-weight: 700; flex-shrink: 0; }
.ae-badge--1 { background: #3b82f6; }
.ae-badge--2 { background: #8b5cf6; }
.ae-badge--3 { background: #10b981; }

/* Architecture diagram */
.ae-arch-diagram { display: flex; align-items: center; flex-wrap: wrap; gap: 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1rem; overflow-x: auto; }
.ae-arch-arrow { font-size: 1rem; color: #94a3b8; padding: 0 4px; flex-shrink: 0; }
.ae-arch-block { display: flex; flex-direction: column; align-items: center; padding: 0.45rem 0.65rem; border-radius: 8px; min-width: 62px; text-align: center; flex-shrink: 0; }
.ae-arch-block__label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
.ae-arch-block__tag { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
.ae-arch-block__neurons { font-size: 1.1rem; font-weight: 800; line-height: 1; }
.ae-arch-block__sub { font-size: 0.6rem; margin-top: 2px; }
.ae-arch-block--input  { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
.ae-arch-block--enc    { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
.ae-arch-block--bottleneck { background: #fef3c7; border: 2px solid #fbbf24; color: #92400e; font-weight: 700; }
.ae-arch-block--dec    { background: #fce7f3; border: 1px solid #f9a8d4; color: #9d174d; }
.ae-arch-block--output { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }

/* Layer editor */
.ae-layer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
.ae-layer-header__text { font-size: 0.78rem; font-weight: 600; color: #475569; }
.ae-layer-add { display: inline-flex; align-items: center; gap: 0.3rem; padding: 4px 10px; border: 1px solid #3b82f6; border-radius: 5px; background: #eff6ff; color: #2563eb; font-size: 0.76rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.ae-layer-add:hover:not(:disabled) { background: #dbeafe; }
.ae-layer-add:disabled { opacity: 0.5; cursor: default; }

.ae-layers-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.ae-layer-row { display: flex; align-items: flex-end; gap: 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.55rem 0.8rem; }
.ae-layer-row__num { width: 20px; height: 20px; border-radius: 50%; background: #3b82f6; color: #fff; font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-bottom: 2px; }
.ae-layer-field { min-width: 0; flex: 1; margin-bottom: 0 !important; }
.ae-layer-remove { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1rem; padding: 2px 4px; margin-bottom: 2px; transition: color 0.15s; }
.ae-layer-remove:hover:not(:disabled) { color: #ef4444; }
.ae-layer-remove:disabled { opacity: 0.3; cursor: default; }

.ae-bottleneck-row { display: flex; flex-wrap: wrap; gap: 0.55rem 0.85rem; padding: 0.7rem 0.9rem; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.25); border-radius: 8px; }
.ae-ctrl-field { min-width: 140px; margin-bottom: 0 !important; }

/* Training */
.ae-train-grid { display: flex; flex-wrap: wrap; gap: 0.55rem 0.85rem; margin-bottom: 0.9rem; }
.ae-train-actions { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; }

.ae-progress { margin-top: 0.6rem; }
.ae-progress__bar-wrap { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-bottom: 0.35rem; }
.ae-progress__bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 3px; transition: width 0.3s ease; }
.ae-progress__text { font-size: 0.76rem; color: #64748b; }

/* Viz */
.ae-viz-controls { display: flex; flex-wrap: wrap; gap: 0.55rem 0.85rem; margin-bottom: 0.9rem; align-items: flex-end; }
.ae-plots-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; margin-bottom: 0.9rem; }
@media (max-width: 860px) { .ae-plots-grid { grid-template-columns: 1fr; } }
.ae-plot-cell { min-width: 0; }
.ae-plot-label { font-size: 0.72rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
.ae-plot { width: 100%; min-height: 280px; }

/* Stats row */
.ae-stats-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.ae-stat-pill { display: flex; flex-direction: column; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.45rem 0.8rem; min-width: 100px; }
.ae-stat-pill__label { font-size: 0.66rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
.ae-stat-pill__val { font-size: 0.95rem; font-weight: 700; color: #1e293b; }

/* States */
.ae-loading { display: flex; align-items: center; gap: 0.7rem; padding: 2rem 0 1.5rem; color: #64748b; font-size: 0.88rem; }
.ae-loading__spinner { width: 20px; height: 20px; border: 2.5px solid #cbd5e1; border-top-color: #3b82f6; border-radius: 50%; animation: ae-spin 0.75s linear infinite; flex-shrink: 0; }
@keyframes ae-spin { to { transform: rotate(360deg); } }
.ae-empty { display: flex; flex-direction: column; align-items: center; gap: 0.65rem; padding: 2.5rem 1rem; color: #94a3b8; text-align: center; }
.ae-empty__icon { font-size: 2.4rem; opacity: 0.3; }
.ae-empty__text { font-size: 0.88rem; max-width: 420px; line-height: 1.55; }

/* ── t-SNE card ──────────────────────────────────────────────── */
.tsne-card {
    border-radius: 10px;
    overflow: hidden;
}
.tsne-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}
.tsne-header__title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0.01em;
}
.tsne-header__icon {
    opacity: 0.82;
    font-size: 0.85rem;
}

/* controls row */
.tsne-body {
    padding: 1rem 1.1rem 1.25rem;
}
.tsne-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem 1rem;
    align-items: flex-end;
    margin-bottom: 1.1rem;
}
.tsne-field {
    min-width: 130px;
    margin-bottom: 0 !important;
}
.tsne-actions {
    display: flex;
    align-items: center;
    padding-bottom: 2px;
}

/* plot area */
.tsne-plot-wrap {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
}
.tsne-plot {
    flex: 1 1 0;
    min-width: 0;
}

/* legend */
.tsne-legend {
    flex: 0 0 auto;
    min-width: 110px;
    max-width: 160px;
    background: rgba(248, 250, 252, 0.92);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 8px;
    padding: 0.65rem 0.8rem;
    font-size: 0.78rem;
    margin-top: 4px;
}
.tsne-legend__title {
    font-weight: 700;
    color: #334155;
    margin-bottom: 0.45rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.tsne-legend__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.tsne-legend__item {
    display: flex;
    align-items: center;
    gap: 0.42rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.tsne-legend__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 1.5px rgba(0,0,0,0.08);
}
.tsne-legend__label {
    color: #475569;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.78rem;
}

/* loading state */
.tsne-loading {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 2rem 0 1.5rem;
    color: #64748b;
    font-size: 0.88rem;
}
.tsne-loading__spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid #cbd5e1;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: tsne-spin 0.75s linear infinite;
    flex-shrink: 0;
}
@keyframes tsne-spin {
    to { transform: rotate(360deg); }
}

/* empty state */
.tsne-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
    padding: 2.5rem 1rem;
    color: #94a3b8;
    text-align: center;
}
.tsne-empty__icon {
    font-size: 2.2rem;
    opacity: 0.35;
}
.tsne-empty__text {
    font-size: 0.88rem;
    max-width: 360px;
    line-height: 1.55;
}

/* ════════════════════════════════════════════════════════════
   PCA Card
════════════════════════════════════════════════════════════ */
.pca-card { border-radius: 10px; overflow: hidden; }

.pca-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.pca-header__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
}
.pca-header__icon { opacity: 0.75; }

.pca-body { padding: 1.1rem 1.2rem; }

/* Steps */
.pca-step { margin-bottom: 1.4rem; }
.pca-step--bordered {
    border-top: 1px solid rgba(148, 163, 184, 0.25);
    padding-top: 1.2rem;
}
.pca-step__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-bottom: 0.75rem;
}
.pca-step__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
}
.pca-step__badge--2 { background: #8b5cf6; }

.pca-step__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.55rem 0.85rem;
    margin-bottom: 1rem;
}
.pca-field {
    min-width: 155px;
    margin-bottom: 0 !important;
}
.pca-step__actions {
    display: flex;
    align-items: center;
    padding-bottom: 2px;
}

/* KPI Cards */
.pca-kpi-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-bottom: 0.8rem;
}
.pca-kpi-card {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 12px;
    box-shadow: 0 10px 24px -22px rgba(15, 23, 42, 0.55);
    padding: 0.55rem 0.75rem;
    min-width: 78px;
    text-align: center;
}
.pca-kpi-card--cumulative {
    background:
        linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(238, 242, 255, 0.95));
    border-color: rgba(59, 130, 246, 0.3);
}
.pca-kpi-card__label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
}
.pca-kpi-card__value {
    font-size: 1rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
}
.pca-kpi-card__sub {
    font-size: 0.65rem;
    color: #94a3b8;
    margin-top: 1px;
}
.pca-kpi-card__bar {
    height: 3px;
    background: rgba(148, 163, 184, 0.18);
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
}
.pca-kpi-card__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
    border-radius: 2px;
    transition: width 0.4s ease;
}

/* Insight strip */
.pca-insight-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
    margin: 0.9rem 0 1rem;
}
.pca-insight-card {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
    padding: 0.75rem 0.85rem;
    border: 1px solid rgba(59, 130, 246, 0.16);
    border-radius: 14px;
    background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 46%),
        rgba(255, 255, 255, 0.92);
}
.pca-insight-card__label {
    color: #64748b;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.pca-insight-card strong {
    color: #172554;
    font-size: 1rem;
    line-height: 1.25;
}
.pca-insight-card span:last-child {
    color: #64748b;
    font-size: 0.75rem;
    line-height: 1.35;
}

/* Explore-plots grid */
.pca-explore-plots {
    display: grid;
    grid-template-columns: minmax(420px, 1.35fr) minmax(330px, 0.85fr);
    gap: 1rem;
    align-items: stretch;
}
@media (max-width: 860px) {
    .pca-explore-plots,
    .pca-insight-strip {
        grid-template-columns: 1fr;
    }
}
.pca-explore-plots__cell {
    min-width: 0;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 16px;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.9));
    box-shadow: 0 18px 40px -34px rgba(15, 23, 42, 0.6);
    padding: 0.75rem 0.8rem 0.45rem;
}
.pca-explore-plots__cell--biplot {
    display: flex;
    flex-direction: column;
}
.pca-plot-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.45rem;
}
.pca-plot-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.pca-plot-caption {
    color: #94a3b8;
    font-size: 0.72rem;
    line-height: 1.35;
    margin: 0;
}
.pca-plot-chip {
    flex-shrink: 0;
    border: 1px solid rgba(59, 130, 246, 0.18);
    border-radius: 999px;
    background: rgba(239, 246, 255, 0.9);
    color: #2563eb;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.25rem 0.5rem;
    white-space: nowrap;
}
.pca-explore-plot {
    width: 100%;
    min-height: 320px;
}
.pca-biplot-frame {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 1;
    min-height: 330px;
}
.pca-explore-plot--biplot {
    aspect-ratio: 1 / 1;
    max-width: 430px;
    min-height: 330px;
}

/* Scatter matrix */
.pca-matrix-container {
    overflow-x: auto;
    margin-top: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    background: #fff;
}

/* Legend */
.pca-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.1rem;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
}
.pca-legend__title {
    font-weight: 700;
    color: #475569;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 0.25rem;
}
.pca-legend__item {
    display: flex;
    align-items: center;
    gap: 5px;
}
.pca-legend__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.pca-legend__label { color: #334155; }

/* Loading */
.pca-loading {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 1.8rem 0 1.2rem;
    color: #64748b;
    font-size: 0.88rem;
}
.pca-loading__spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid #cbd5e1;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: pca-spin 0.75s linear infinite;
    flex-shrink: 0;
}
@keyframes pca-spin { to { transform: rotate(360deg); } }
.pca-loading__text { font-size: 0.88rem; }

/* Empty state */
.pca-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
    padding: 2.5rem 1rem;
    color: #94a3b8;
    text-align: center;
}
.pca-empty__icon {
    font-size: 2.4rem;
    opacity: 0.3;
}
.pca-empty__text {
    font-size: 0.88rem;
    max-width: 380px;
    line-height: 1.55;
}

/* ── Educational Explanation Panel ────────────────────────── */
.dr-explanation {
    background: rgba(239, 246, 255, 0.6);
    border: 1px solid rgba(191, 219, 254, 0.7);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    margin-bottom: 1.1rem;
    text-align: left;
}
html.dark .dr-explanation {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid rgba(148, 163, 184, 0.2);
}
.dr-explanation__title {
    font-size: 0.82rem;
    font-weight: 700;
    color: #1e3a8a;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
html.dark .dr-explanation__title {
    color: #bae6fd;
}
.dr-explanation__text {
    font-size: 0.78rem;
    line-height: 1.5;
    color: #374151;
    margin-bottom: 0.6rem;
}
html.dark .dr-explanation__text {
    color: #94a3b8;
}
.dr-explanation__bullets {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.dr-explanation__bullets div {
    font-size: 0.74rem;
    line-height: 1.4;
    color: #4b5563;
    padding-left: 0.75rem;
    position: relative;
}
html.dark .dr-explanation__bullets div {
    color: #cbd5e1;
}
.dr-explanation__bullets div::before {
    content: "•";
    position: absolute;
    left: 0;
    color: #3b82f6;
    font-weight: bold;
}
</style>
