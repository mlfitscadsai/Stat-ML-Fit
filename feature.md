# ML Platform Feature Review and Enhancement Catalog

## Executive Summary

Stat ML Fit is already positioned as a no-code ML studio with strong foundations: Vue-based data exploration, client-side model training, dimensionality reduction, explainability views, MissForest imputation, HPC-backed Slurm execution, and an emerging in-browser Gemma assistant. The most compelling differentiation opportunity is to make the platform feel like an intelligent ML partner instead of a collection of controls: guide users from dataset upload to validated model decisions, explain trade-offs in plain language, preserve reproducible experiment history, and make advanced compute feel seamless.

This catalog reviews current capabilities, gaps, and high-impact enhancements across ML workflow depth, user experience, performance, collaboration, and cutting-edge ML-specific functionality. Each proposed feature includes implementation details, technical requirements, user experience improvements, and success metrics.

## Current Capability Inventory

### Backend

- Flask API in `backend/app.py` serves the Vue SPA and exposes `/upload`, `/missforest`, `/run`, and `/progress`.
- `/missforest` performs server-side imputation with `MissForest`, `RandomForestClassifier`, and `RandomForestRegressor`.
- `/run` creates a Python script through `backend/helpers/commnad_write.py`, uploads data and script files over Paramiko SFTP, and submits a Slurm job with `sbatch`.
- `/progress` polls remote HPC output by checking for `res.json` and downloads the result file when available.
- `backend/helpers/ssh_client.py` is the integration boundary for HPC credentials and SSH setup.
- Backend tests cover upload behavior, mocked HPC submission, progress polling, MissForest, SSH client creation, and command generation.

### Frontend

- Vue 3, Pinia, Buefy/Bulma, Vite, Vitest, DanfoJS, TensorFlow.js, Plotly, Highcharts, scikitjs, UMAP, tfjs-tsne, Transformers.js, and Gemma agent libraries are already present.
- `frontend/src/components/upload-component.vue` supports CSV/TXT ingestion, configurable separators/decimals/headers, toy datasets, seeded sampling, and a 10,000-row performance cap.
- `frontend/src/components/main-component.vue` provides a studio workspace with Data Analysis, Dimensionality Reduction, Model Training, Results/XAI, Methods, Help, and Messages tabs.
- `frontend/src/components/sidebar-component.vue` runs the advanced training flow with target selection, task mode, imputation, cross validation, model configuration, PCA, explainability, and optional HPC upload.
- `frontend/src/components/tabs/model-training-wizard.vue` adds a guided multi-step training workflow with problem type, target selection, algorithm cards, hyperparameters, validation, and training review.
- `frontend/src/components/tabs/results-component.vue` supports model comparison, metric ranking, normalized heatmaps, CSV export, and classification/regression result tabs.
- `frontend/src/services/gemma/*` adds an on-device assistant with app-context tools, result listing, method explanation, tab navigation, and feature inspection.
- Frontend tests cover upload, dataset health, scatterplot matrix, parallel coordinates, CSV parsing, parser factory, settings store, Danfo loading, and task mode detection.

## Current Gaps and Risk Areas

- The backend generated HPC script reads `main.csv`, while `/run` uploads the user-provided filename. This can break remote execution unless the uploaded file happens to match the hardcoded script expectation.
- `/run` reads `method_name` but does not use it, so the backend cannot yet execute model families beyond the current LDA/QDA command template.
- Discriminant analysis options such as `lda_type` and `priors` exist in the command template but are not passed from `/run`.
- Frontend upload accepts `.xlsx`, while the parser factory currently supports CSV/TXT only.
- Frontend API calls use hardcoded `http://127.0.0.1:5000`, while the Flask app runs on port 5001 locally and Docker exposes a different mapping.
- The platform has two model training surfaces: the sidebar flow and the wizard. They sync partially, but model execution, validation, progress, and errors should eventually flow through one training runner.
- Training progress in the wizard can be simulated rather than tied to actual model callbacks or backend job state.
- Heavy client-side computation, visualizations, and Gemma model loading can block or slow the UI without deeper worker and lazy-loading boundaries.
- There is no durable experiment store, project concept, sharing model, model artifact registry, or collaboration layer.
- Security posture needs hardening before public use: unauthenticated upload/imputation, permissive CORS, password SSH, AutoAddPolicy host handling, no quotas, and no tenant separation.
- Documentation is high level and does not yet describe the API contract, HPC setup, assistant behavior, deployment paths, or troubleshooting.
- CI and deployment workflows target different branches and runtimes, which can create uncertainty about canonical quality gates.

## Differentiation Thesis

The strongest competitive angle is a privacy-preserving, no-code ML studio for education, research, and applied tabular ML that combines:

1. Guided workflows for non-experts.
2. Advanced controls for data scientists.
3. Local-first computation for small and medium datasets.
4. HPC offload for expensive jobs.
5. Built-in explainability and reproducibility.
6. An on-device ML copilot that understands the current dataset, model results, and UI state.

The best "wow moments" should happen when the system anticipates what the user needs next: recommending a target, flagging leakage, choosing validation, explaining model trade-offs, generating a reproducible report, and launching the right compute path without forcing users to understand infrastructure.

## Proposed Feature Catalog

### 1. Unified Experiment Runner

**Category:** Advanced ML workflow  
**Priority:** P0  
**Wow moment:** The user clicks Train once and sees a single live run timeline whether the job executes in-browser, in Flask, or on HPC.

**Current hooks**

- `frontend/src/components/sidebar-component.vue` owns most training logic.
- `frontend/src/components/tabs/model-training-wizard.vue` emits wizard training requests.
- `backend/app.py` exposes `/run` and `/progress`.
- `frontend/src/stores/settings.js` stores results, messages, seed, target, features, and task mode.

**Implementation details**

- Create `frontend/src/services/training/training-runner.js`.
- Move run orchestration out of `sidebar-component.vue` into a single service with methods such as `prepareDataset`, `validateConfig`, `runLocal`, `runBackend`, `runHpc`, `pollProgress`, and `normalizeResult`.
- Update both the sidebar and wizard to call the same runner.
- Add a Pinia `trainingRuns` state shape:
  - `id`
  - `datasetName`
  - `target`
  - `mode`
  - `model`
  - `executionBackend`
  - `status`
  - `progress`
  - `startedAt`
  - `finishedAt`
  - `warnings`
  - `metrics`
  - `artifacts`
- Replace timer-based progress with real lifecycle updates from local model callbacks, worker messages, or `/progress`.
- Normalize backend and local result payloads before adding them to `settings.results`.

**Technical requirements**

- Stable run ID generated once in the frontend and passed to backend `job_id`.
- Typed run contract documented in `docs/api.md` or in JSDoc until TypeScript is introduced.
- Backward-compatible adapter for existing `settings.addResult`.
- Unit tests for runner validation and result normalization.
- Component tests for wizard and sidebar using mocked runner responses.

**UX improvements**

- One run timeline with stages: data validation, preprocessing, training, evaluation, explainability, report generation.
- Clear status for queued, running, failed, cancelled, completed, and partially completed jobs.
- Warnings shown before training, not after failure.
- Users no longer need to understand whether a run came from sidebar, wizard, browser, backend, or HPC.

**Success metrics**

- 95% of training failures show a user-actionable message.
- 100% of completed runs have a normalized run record.
- Reduce duplicated training orchestration code by at least 40%.
- Wizard and sidebar produce identical result objects for equivalent configs.

### 2. Intelligent Data Health and Readiness Score

**Category:** UI/UX and ML workflow  
**Priority:** P0  
**Wow moment:** After upload, the platform instantly says "This dataset is 82% ready for classification" and shows exactly what to fix.

**Current hooks**

- `frontend/src/components/dataset-health-component.vue`
- Feature profile logic in `frontend/src/components/main-component.vue`
- `frontend/src/helpers/correlation/feature-significance.js`
- `frontend/src/stores/settings.js`
- Upload sampling and raw data state in `frontend/src/components/upload-component.vue`

**Implementation details**

- Add `frontend/src/services/data-readiness/readiness-service.js`.
- Compute dataset-level signals:
  - missingness by column and row
  - high-cardinality categorical columns
  - constant or near-constant columns
  - duplicate rows
  - target leakage candidates
  - class imbalance
  - train/test split risk for small datasets
  - skew/outlier risk for numeric columns
  - feature-target association strength
- Add a readiness score from 0 to 100 and categorized blockers/warnings/suggestions.
- Show a top-level readiness card in Data Analysis and the model wizard dataset step.
- Add one-click actions: exclude column, set as target, mark as ordinal, impute, standardize, rebalance, or continue anyway.

**Technical requirements**

- Computation must run on sampled data first, then optionally full data when feasible.
- Use Web Workers for expensive profiling on datasets above 10,000 rows.
- Add tests for readiness scoring edge cases.
- Ensure all recommendations are explainable and deterministic for a fixed seed.

**UX improvements**

- Users get a guided checklist before model training.
- Novices learn why data problems matter.
- Advanced users can apply or dismiss recommendations quickly.
- Reduces silent bad-model outcomes.

**Success metrics**

- 80% of new users can identify the target and train a valid first model without external help.
- Reduce training failures caused by invalid feature/target selection by 50%.
- At least 70% of readiness warnings include a one-click remediation.

### 3. Experiment History, Reproducibility, and Model Registry

**Category:** Advanced ML workflow and collaboration foundation  
**Priority:** P0  
**Wow moment:** Every run becomes a reproducible experiment card with config, metrics, plots, artifacts, and a "rerun exactly" button.

**Current hooks**

- `settings.results`
- `results-component.vue` comparison workspace
- `settings.seed`
- `settings.features`, `settings.transformations`, `settings.classTransformations`
- Backend `res.json` from HPC jobs

**Implementation details**

- Add IndexedDB persistence for experiments through a small storage service.
- Store:
  - dataset fingerprint
  - feature selection
  - transformations
  - split strategy
  - model family
  - hyperparameters
  - random seed
  - metrics
  - plots/artifact references
  - execution environment
  - package/runtime versions where available
- Add "Rerun", "Clone and tune", "Compare", "Archive", and "Export" actions.
- Extend backend jobs to return a run manifest alongside `res.json`.
- Add optional model artifact storage for local models and HPC models.

**Technical requirements**

- IndexedDB wrapper with schema versioning.
- Export/import format as JSON.
- Backend manifest contract for HPC outputs.
- Dataset fingerprint based on name, shape, columns, and sample hash.
- Tests for migration and reload behavior.

**UX improvements**

- Users can leave and return without losing runs.
- Comparisons become stable and auditable.
- Researchers can reproduce results for papers or class assignments.

**Success metrics**

- 100% of runs can be exported as reproducible JSON.
- Reloading the app restores experiment history in under 2 seconds for 100 runs.
- Users can rerun a prior experiment with one click and receive the same config.

### 4. ML Copilot with Actionable Tools

**Category:** Cutting-edge ML-specific functionality  
**Priority:** P0  
**Wow moment:** The assistant says "Your target is imbalanced, KNN may struggle after one-hot encoding, and Random Forest with class weighting is a better first run. Want me to configure it?"

**Current hooks**

- `frontend/src/components/assistant/gemma-chat-widget.vue`
- `frontend/src/services/gemma/agent-service.js`
- `frontend/src/services/gemma/tools.js`
- `frontend/src/services/gemma/help-context.js`
- Pinia settings store

**Implementation details**

- Expand Gemma tools:
  - `recommend_next_step`
  - `diagnose_dataset`
  - `suggest_model_config`
  - `explain_metric`
  - `compare_runs`
  - `create_report_outline`
  - `configure_training_draft`
- Add a draft-action approval flow. The assistant can propose UI changes, but the user must confirm before state changes.
- Add tool results grounded in current store state and readiness service outputs.
- Add assistant citations to the current dataset, selected target, metric values, and method documentation.
- Add sanitization for rendered assistant markdown if any non-local or remote model mode is introduced.

**Technical requirements**

- Tool execution must be pure or explicitly marked as state-changing.
- Add a `pendingAssistantActions` queue in Pinia.
- Add Vitest coverage for tool argument validation and tab navigation.
- Add browser capability checks before loading WebGPU/Gemma model files.
- Lazy-load assistant code and model assets only when opened or after idle.

**UX improvements**

- Converts hidden platform power into guided decisions.
- Builds user trust by explaining why it recommends each action.
- Keeps privacy story strong by running locally when hardware supports it.

**Success metrics**

- Assistant first-load cost does not affect initial app LCP.
- 90% of assistant recommendations include a specific next action.
- At least 80% of assistant actions are reversible or require confirmation.
- User testing shows lower time-to-first-valid-model by at least 30%.

### 5. Seamless HPC Job Center

**Category:** Advanced ML workflow and performance  
**Priority:** P0  
**Wow moment:** HPC feels like a cloud job queue with live status, logs, artifacts, cancellation, and clear cost/resource estimates.

**Current hooks**

- `/run` and `/progress` in `backend/app.py`
- `backend/helpers/commnad_write.py`
- `sidebar-component.vue` HPC upload controls
- Docker and docker-compose HPC environment variables

**Implementation details**

- Replace plain text status responses with a structured JSON job protocol:
  - `queued`
  - `submitted`
  - `running`
  - `collecting_artifacts`
  - `completed`
  - `failed`
  - `cancelled`
- Parse Slurm job ID from `sbatch` output and persist it in a job manifest.
- Add endpoints:
  - `POST /jobs`
  - `GET /jobs/<job_id>`
  - `GET /jobs/<job_id>/logs`
  - `POST /jobs/<job_id>/cancel`
  - `GET /jobs/<job_id>/artifacts`
- Fix generated script data filename by passing the uploaded CSV name into `CommandWriter`.
- Use `method_name` to choose command templates.
- Add a frontend Job Center panel with queue status, logs, and artifact downloads.

**Technical requirements**

- SSH key-based authentication or explicit host key verification.
- Job workspace isolation per run ID.
- Request validation for target, method, file, seed, and options.
- Cleanup policy for remote and local temporary files.
- Tests for job protocol and generated command arguments.

**UX improvements**

- Users understand what HPC is doing and when to expect results.
- Failures become debuggable without opening terminal logs.
- Advanced users can inspect artifacts while novices see simple status.

**Success metrics**

- 95% of HPC jobs expose at least one status update before completion.
- 100% of failed jobs include stderr or a diagnostic reason.
- Reduce support/debug time for HPC failures by 60%.

### 6. AutoML Recommendation Lane

**Category:** Cutting-edge ML-specific functionality  
**Priority:** P1  
**Wow moment:** The platform proposes three sensible candidate pipelines and explains when each one is likely to win.

**Current hooks**

- `helpers/settings.js` model catalog
- `helpers/model_factory.js`
- `helpers/task_mode.js`
- Client-side model helpers for classification/regression
- Results comparison workspace

**Implementation details**

- Add a recommendation service that selects model candidates based on:
  - row count
  - column count
  - numeric/categorical ratio
  - class imbalance
  - missingness
  - target type
  - estimated training cost
- Start with rule-based recommendations, then add optional meta-learning later.
- Create "Quick benchmark" mode that runs 3 to 5 lightweight models with safe defaults.
- Automatically rank candidates using cross-validation where feasible.
- Surface "speed", "accuracy", "interpretability", and "robustness" labels.

**Technical requirements**

- Shared model metadata registry with capabilities and constraints.
- Worker-backed training for benchmarks.
- Cancellation support for benchmark runs.
- Tests for recommendation rules.

**UX improvements**

- Users do not need to choose from a long algorithm list before seeing baseline performance.
- Helps educators demonstrate trade-offs between interpretable and high-performing models.
- Makes results comparison meaningful from the first session.

**Success metrics**

- First benchmark completes in under 60 seconds for 10,000 rows and 30 columns on a modern laptop.
- Recommended models include at least one interpretable baseline and one higher-capacity model.
- 80% of quick benchmarks produce at least two comparable results.

### 7. Explainability Storyboard

**Category:** ML-specific UX and XAI  
**Priority:** P1  
**Wow moment:** Instead of isolated plots, users get a narrative: "These three features drive predictions, this effect is nonlinear, and this class is confused with that one."

**Current hooks**

- `results-component.vue`
- `classification-view-component.vue`
- `regression-view-component.vue`
- Backend PFI/PDP generation in `CommandWriter`
- Frontend explainability flags and plotting helpers

**Implementation details**

- Create an XAI storyboard view per run:
  - model summary
  - confusion/residual diagnosis
  - feature importance
  - partial dependence
  - per-feature caveats
  - recommended next experiment
- Add local explainability adapters for supported browser-trained models.
- Normalize backend `pfi`, `pdp_grid`, and `pdp_avgs` payloads into typed chart inputs.
- Let the Gemma assistant explain each chart using current metrics and method context.

**Technical requirements**

- Chart data normalizer with tests for local and HPC outputs.
- Guardrails for unsupported models.
- Performance budget for rendering large PDP grids.
- Accessibility labels and text alternatives for charts.

**UX improvements**

- Users understand what to do with explainability output.
- Reduces chart overload.
- Supports teaching and reporting use cases.

**Success metrics**

- 100% of explainable runs show at least one plain-language insight.
- Storyboard renders in under 2 seconds after metrics are available.
- User tests show improved ability to answer "why did this model win?"

### 8. What-If Simulator and Counterfactual Explorer

**Category:** Cutting-edge ML-specific functionality  
**Priority:** P1  
**Wow moment:** Users drag feature sliders and see how predictions, probabilities, and explanations change instantly.

**Current hooks**

- Trained local model objects in result entries.
- Prediction tables in `results-component.vue`.
- Feature metadata in Pinia.
- Plotting utilities and model helper classes.

**Implementation details**

- Add a "What-if" tab inside each result.
- For a selected row, generate editable controls based on feature types.
- Re-run prediction locally when the model object is available.
- For HPC-only models, add a future `POST /predict` endpoint using stored model artifacts.
- Add counterfactual search for tabular data:
  - numeric hill-climbing within valid ranges
  - categorical one-step alternatives
  - constraints for immutable features
- Display minimal changes needed to flip class or reach a target prediction range.

**Technical requirements**

- Model adapters exposing `predict` and optionally `predictProba`.
- Feature constraint metadata.
- Backend model persistence for remote models, ideally using skops or a safe serialization strategy.
- Tests for adapter behavior.

**UX improvements**

- Makes abstract model behavior tangible.
- Excellent teaching and stakeholder demo feature.
- Helps users discover actionable features.

**Success metrics**

- What-if prediction latency under 100 ms for local models.
- Counterfactual search returns a valid candidate for at least 70% of supported classification examples.
- Users can export a what-if scenario into reports.

### 9. Performance Architecture: Workers, Lazy Loading, and Bundle Budgets

**Category:** Performance optimization  
**Priority:** P1  
**Wow moment:** The app opens quickly, stays responsive during training, and loads heavyweight ML tools only when needed.

**Current hooks**

- `frontend/src/utils/danfo_loader.js`
- Existing worker files under `frontend/src/workers`
- Dynamic component loading in `main-component.vue`
- Vite build tooling and `vite-bundle-analyzer`
- Gemma assets and ONNX runtime files

**Implementation details**

- Add Vite manual chunks for:
  - core Vue app
  - visualization libraries
  - TensorFlow.js
  - Danfo/Plotly
  - Gemma/Transformers
  - XGBoost/WASM
- Move heavy model training and profiling into a worker pool.
- Lazy-load `GemmaChatWidget` only when opened or during idle time.
- Replace deep Plotly import paths with direct package imports or aliases.
- Replace remote jQuery/DataTables loading with bundled or lazy-loaded local dependencies.
- Add performance instrumentation for load time, worker time, and chart render time.

**Technical requirements**

- Define budgets for initial JS, route chunk sizes, and model asset loading.
- Worker protocol for progress, cancellation, errors, and result payloads.
- Browser feature detection and fallback UX for WebGPU/WASM features.
- CI check using bundle analyzer output or a custom size script.

**UX improvements**

- Faster first impression.
- No frozen UI during expensive operations.
- Users understand when large models or assets are being downloaded.

**Success metrics**

- Initial app route JS reduced by at least 30%.
- Training UI remains interactive during benchmark runs.
- Assistant code is absent from the initial bundle unless preloaded intentionally.
- LCP under 2.5 seconds on target deployment hardware for a cached production build.

### 10. Guided Onboarding and Teaching Mode

**Category:** UI/UX  
**Priority:** P1  
**Wow moment:** A first-time user can load Iris, train a model, inspect metrics, and understand the result in under five minutes.

**Current hooks**

- `shepherd.js` dependency
- Toy dataset selector in `upload-component.vue`
- Wizard in `model-training-wizard.vue`
- Methods/help/documentation components
- Messages log

**Implementation details**

- Add product tours:
  - first dataset upload
  - first model training
  - results interpretation
  - dimensionality reduction
  - HPC job submission
- Add "Teaching Mode" with contextual explanations, glossary terms, and safe defaults.
- Add guided sample workflows for Iris classification, California housing regression, and Titanic survival.
- Let the assistant answer questions tied to each tour step.

**Technical requirements**

- Tour registry with route/tab selectors and fallback behavior.
- Persist completed tours in localStorage.
- Accessibility review for focus trapping and keyboard navigation.
- Tests for tour step availability on core screens.

**UX improvements**

- Reduces onboarding friction.
- Helps students learn ML concepts in context.
- Makes the app feel polished and intentional.

**Success metrics**

- New users complete first sample workflow in under five minutes.
- At least 75% of tour steps anchor successfully across supported viewport sizes.
- Reduce "what do I do next?" feedback in usability tests.

### 11. Collaboration Projects, Comments, and Shareable Reports

**Category:** Collaboration tools  
**Priority:** P1  
**Wow moment:** A researcher can package a dataset summary, experiment history, model comparison, and explanation notes into a shareable project report.

**Current hooks**

- `jspdf`, `marked`, and results CSV export
- `settings.results`
- Messages log
- Existing chart outputs

**Implementation details**

- Introduce a "Project" concept:
  - project name
  - dataset fingerprint
  - saved experiments
  - notes
  - report sections
  - export bundle
- Add comments/annotations on results and charts.
- Add Markdown report composer with generated sections:
  - dataset overview
  - preprocessing
  - experiment table
  - winning model
  - explainability findings
  - limitations
- Export to PDF and Markdown.
- Future server-backed version can add multi-user project sharing.

**Technical requirements**

- Local project persistence through IndexedDB.
- Report renderer that can capture chart images reliably.
- Sanitized Markdown rendering.
- Export schema with version number.

**UX improvements**

- Turns analysis into a deliverable.
- Supports classrooms, research groups, and stakeholder reviews.
- Users can preserve the reasoning behind model choices.

**Success metrics**

- Generated report includes all selected runs and charts without manual copy/paste.
- Export succeeds for projects with at least 20 runs.
- Report generation completes in under 10 seconds for typical projects.

### 12. Dataset Versioning and Lineage

**Category:** Collaboration and reproducibility  
**Priority:** P1  
**Wow moment:** Users can see exactly how raw data became model-ready data, including filters, encodings, imputations, and dropped columns.

**Current hooks**

- `settings.rawData`
- `settings.df`
- `settings.transformations`
- `settings.classTransformations`
- Feature selection and scaling settings
- `helpers/utils.js`

**Implementation details**

- Track a lineage graph from raw upload through transformations.
- Add a dataset version every time the user applies feature changes, imputation, scaling, encoding, sampling, or PCA.
- Show lineage in a visual "Data Recipe" panel.
- Allow rollback to prior dataset versions.
- Export transformation recipe as JSON and optionally Python pseudo-code.

**Technical requirements**

- Immutable transformation records.
- Deterministic replay from raw data and seed.
- Storage limits and compaction for large raw datasets.
- Tests for replaying recipes.

**UX improvements**

- Users trust the analysis because every transformation is visible.
- Advanced users can reproduce steps outside the UI.
- Reduces accidental data leakage or hidden preprocessing.

**Success metrics**

- 100% of training runs reference a dataset version.
- Recipe replay produces matching shape and columns for supported transformations.
- Users can rollback transformations without re-uploading data.

### 13. Advanced Validation Suite

**Category:** Advanced ML workflow  
**Priority:** P1  
**Wow moment:** The platform warns "Random split may overestimate performance because rows from the same patient appear in train and test."

**Current hooks**

- `CV_OPTIONS` in `helpers/settings.js`
- Split and k-fold logic in `sidebar-component.vue`
- Task mode validation in `helpers/task_mode.js`

**Implementation details**

- Add validation strategies:
  - stratified train/test split
  - stratified k-fold
  - group k-fold
  - time-based split
  - repeated k-fold
  - nested validation for tuning
- Add UI for selecting group/time columns when detected.
- Warn about leakage risks when ID-like, timestamp-like, or duplicate groups are present.
- Store validation strategy in experiment metadata and report output.

**Technical requirements**

- Validation strategy registry.
- Model helper compatibility checks.
- Deterministic splitting with seed.
- Tests for class balance and group isolation.

**UX improvements**

- Prevents misleading metrics.
- Makes the platform credible for applied ML.
- Teaches users why validation choice matters.

**Success metrics**

- Stratified split preserves class distribution within 5 percentage points on supported datasets.
- Group split guarantees no group overlap between train and test.
- Validation warnings appear before training for detected risk patterns.

### 14. Server-Side Model Expansion and Method Registry

**Category:** Advanced ML workflow  
**Priority:** P1  
**Wow moment:** Users can choose local or HPC execution for LightGBM, Random Forest, LDA/QDA, and future methods with the same UI contract.

**Current hooks**

- `method_name` in `/run`
- `lightgbm` in `backend/requirements.txt`
- Model catalog in `helpers/settings.js`
- Current `CommandWriter` template

**Implementation details**

- Replace single `CommandWriter` with a backend method registry:
  - `DiscriminantAnalysisWriter`
  - `RandomForestWriter`
  - `LightGbmWriter`
  - `SklearnPipelineWriter`
- Add a shared job request schema.
- Generate scripts from structured configs instead of loosely interpolated query params.
- Add server-side validation that target exists and method supports the task type.
- Return a standardized result object matching local model outputs.

**Technical requirements**

- Request validation layer, ideally with Pydantic or Marshmallow.
- Safer script generation with escaped JSON config files rather than raw string interpolation.
- Unit tests for each writer.
- Integration tests using small fixture CSV files without requiring SSH.

**UX improvements**

- Users get more algorithms without learning different execution paths.
- HPC becomes a scaling option, not a separate feature.
- Results comparison works across local and remote models.

**Success metrics**

- Add at least three backend/HPC-capable methods with one shared result contract.
- 100% of method writers have snapshot tests for generated scripts.
- Backend rejects invalid target/method requests before SSH.

### 15. Secure Deployment and Multi-User Readiness

**Category:** Platform foundation  
**Priority:** P1  
**Wow moment:** The app can move from local demo to shared lab deployment without exposing uploads, credentials, or compute endpoints.

**Current hooks**

- Flask app with CORS
- Dockerfile and docker-compose
- HPC environment variables
- GitHub workflows

**Implementation details**

- Add authentication and per-user workspaces before public deployment.
- Restrict CORS by environment.
- Replace password SSH with key-based auth and host key verification.
- Add upload quotas, file type validation, row limits, and compute limits.
- Add audit logs for upload, train, cancel, export, and delete actions.
- Align ports and API base URL through environment variables.

**Technical requirements**

- `VITE_API_BASE` frontend config.
- Flask config class for development, test, and production.
- Request IDs and structured logs.
- Secrets excluded from repo and documented in `.env.example`.
- CI workflow alignment for canonical branches and runtime versions.

**UX improvements**

- Clear account/workspace boundaries.
- Better error messages when quotas or unsupported file types block an action.
- Administrators can monitor usage and troubleshoot safely.

**Success metrics**

- No hardcoded API origins remain in source.
- Security review finds no password-based SSH or permissive production CORS.
- 100% of uploads are associated with a user/workspace in multi-user mode.

### 16. Large Dataset Streaming and Progressive Profiling

**Category:** Performance and ML workflow  
**Priority:** P2  
**Wow moment:** Users upload a large CSV and see useful profiles immediately while deeper analysis continues in the background.

**Current hooks**

- `DATASET_SIZE = 10000` sampling in `upload-component.vue`
- Data size warning flag in Pinia
- Danfo-based dataframe creation
- Backend upload endpoint

**Implementation details**

- Replace hard cap behavior with progressive ingestion:
  - fast sample for immediate UI
  - background chunk profiling
  - optional full-data backend/HPC profiling
- Add visible sample policy controls:
  - random sample
  - stratified sample
  - first N rows
  - full data on backend
- Show confidence indicators when charts are based on samples.
- Store sample metadata in experiment records.

**Technical requirements**

- Streaming CSV parser or chunked file reader.
- Worker-based profiling.
- Backend endpoint for full-dataset validation when files are uploaded.
- Clear memory limits.

**UX improvements**

- Users are not surprised that only 10,000 rows were used.
- Large files become approachable without freezing the browser.
- Charts communicate whether they represent sample or full data.

**Success metrics**

- First dataset summary appears within 3 seconds for a 100 MB CSV on target hardware.
- UI remains responsive during chunk profiling.
- All sample-based charts include sample size and strategy.

### 17. Data Source Connectors and Dataset Library

**Category:** UX and workflow expansion  
**Priority:** P2  
**Wow moment:** Users can start from sample datasets, local files, URLs, or saved project datasets without manual setup.

**Current hooks**

- Toy dataset selector in `upload-component.vue`
- Parser factory
- Public CSV sample files

**Implementation details**

- Add a Dataset Library page:
  - built-in samples
  - recently uploaded datasets
  - project datasets
  - URL import
  - future database/API connectors
- Fix Excel support by either implementing `XLXParser` or removing `.xlsx` from accepted files until supported.
- Add dataset preview before committing upload.
- Add schema inference and manual override.

**Technical requirements**

- Parser support matrix.
- Dataset metadata store.
- Safe URL import rules if server-side fetching is introduced.
- Tests for supported and unsupported file types.

**UX improvements**

- Faster start for demos and teaching.
- Fewer opaque parser errors.
- Users can reuse datasets across experiments.

**Success metrics**

- Unsupported file types produce specific messages and suggested fixes.
- Dataset preview renders before load for CSV/TXT/Excel when supported.
- Users can reload a recent dataset without re-uploading.

### 18. Report-Ready Deployment Modes and Observability

**Category:** Platform operations  
**Priority:** P2  
**Wow moment:** Maintainers can tell whether failures are frontend parsing, backend validation, SSH, Slurm, or model code within seconds.

**Current hooks**

- Dockerfile
- docker-compose
- GitHub Actions test workflow
- Flask print statements for Slurm output

**Implementation details**

- Add structured logging in Flask for request ID, job ID, user/workspace, stage, status, and duration.
- Add frontend error boundary/reporting service that records failed stage, component, and user-safe message.
- Add health endpoints:
  - `/health`
  - `/health/hpc`
  - `/version`
- Add CI artifacts for coverage and bundle reports.
- Align `main`, `master`, and deployment branch workflows or document the canonical path.

**Technical requirements**

- Logging format usable locally and in containers.
- Non-secret config dump on `/version`.
- CI upload for coverage reports.
- Deployment documentation.

**UX improvements**

- Users see reliable status pages instead of unexplained failures.
- Maintainers troubleshoot faster.
- Builds confidence for institutional deployment.

**Success metrics**

- 100% of backend requests include request ID logs.
- Health checks identify missing HPC configuration without failing the whole app.
- CI exposes backend coverage, frontend coverage, and bundle summary.

## Suggested Delivery Roadmap

### Phase 1: Trust and Flow

- Unified Experiment Runner
- Intelligent Data Health and Readiness Score
- Experiment History and Reproducibility
- API base URL alignment and upload/parser fixes
- Structured backend job protocol

### Phase 2: Differentiation

- ML Copilot with actionable tools
- Explainability Storyboard
- AutoML Recommendation Lane
- Seamless HPC Job Center
- Worker and lazy-loading performance architecture

### Phase 3: Collaboration and Scale

- Projects, comments, and shareable reports
- Dataset versioning and lineage
- Advanced validation suite
- Server-side model registry
- Secure deployment and multi-user readiness

### Phase 4: Enterprise and Research Depth

- Large dataset streaming
- Data source connectors
- Observability and report-ready deployment modes
- Model artifact registry and prediction APIs
- Optional remote collaboration backend

## Near-Term Engineering Backlog

1. Fix backend CSV filename mismatch between `/run` uploads and generated script reads.
2. Replace hardcoded frontend API origins with `VITE_API_BASE`.
3. Gate or implement `.xlsx` support.
4. Create a shared frontend training runner used by both sidebar and wizard.
5. Add structured JSON responses to `/run` and `/progress`.
6. Add run metadata to every result object.
7. Lazy-load Gemma assistant and heavyweight visualization/ML libraries.
8. Add tests for wizard training, sidebar training, Gemma tools, and backend command generation.
9. Add documentation for API contracts, HPC setup, and deployment modes.
10. Align CI workflows around a single canonical branch and runtime matrix.

## Product Success Metrics

- Time to first valid model: under 5 minutes for a new user using a sample dataset.
- Time to first insight: under 60 seconds after upload for datasets up to 10,000 rows.
- Training reliability: at least 95% of validation errors caught before model execution.
- Reproducibility: 100% of completed runs export with config, seed, dataset fingerprint, metrics, and artifact references.
- Performance: initial app route loads under 2.5 seconds on target deployment hardware.
- Explainability: 100% of supported explainable runs include at least one narrative insight.
- Collaboration: generated reports include dataset summary, experiment table, model comparison, and limitations without manual copy/paste.
- HPC transparency: every remote run exposes status, Slurm job ID, logs or diagnostics, and artifacts.

## Recommended Positioning

Position the platform as a privacy-first, no-code ML studio for researchers, students, and applied teams who need both approachable guidance and serious ML workflow controls. The differentiator is not only the number of algorithms, but the connected experience: dataset readiness, guided model selection, reproducible experiments, explainable results, local AI assistance, and scalable HPC execution in one workspace.
