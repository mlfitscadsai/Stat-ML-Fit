<template>
  <div id="app" class="dashboard-app">
    <LandingPage v-if="showLanding" @enter-dashboard="enterDashboard" />

    <template v-else>
      <b-notification v-show="appStore.getDatasizeFlag" class="dashboard-banner" type="is-warning" has-icon
        aria-close-label="Close notification" role="alert">
        Due to the large size of dataset only 10,000 random samples from dataset would be used.
      </b-notification>

      <header class="dashboard-mob-header" aria-label="Mobile navigation">
        <button type="button" class="dashboard-mob-header__btn" @click="mobileNavOpen = !mobileNavOpen"
          :aria-expanded="mobileNavOpen" aria-controls="dashboard-sidebar-panel" aria-label="Open or close menu">
          <i class="fas fa-bars" aria-hidden="true"></i>
        </button>
        <div class="dashboard-mob-header__titles">
          <span class="dashboard-mob-header__brand">ML Studio</span>
          <span class="dashboard-mob-header__tagline">Train &amp; explain models</span>
        </div>
        <ThemeToggle button-class="dashboard-mob-header__btn dashboard-mob-header__btn--theme" />
      </header>

      <div
        v-show="mobileNavOpen"
        class="dashboard-backdrop"
        @click="mobileNavOpen = false"
        @keydown.escape="mobileNavOpen = false"
        aria-hidden="true"
      />

      <div class="dashboard-body" :class="{ 'dashboard-body--nav-open': mobileNavOpen }">
        <SidebarComponent
          id="dashboard-sidebar-panel"
          ref="sidebar"
          class="dashboard-sidebar"
          @updateFeatures="updateFeatureStats"
          @close-mobile-panel="mobileNavOpen = false"
        />
        <MainComponent ref="main" class="dashboard-main" :dataframe="appStore.df" @check-target="checkTarget()" @train-request="handleWizardTrainRequest" @wizard-config-sync="handleWizardConfigSync" />
      </div>
    </template>
  </div>

</template>

<script>
import { defineAsyncComponent } from 'vue'
import LandingPage from '@/components/landing/landing-page.vue'
import { settingStore } from '@/stores/settings'
import { mapStores, mapActions } from 'pinia'
import { runSidebarTraining, validateConfig } from '@/services/training/training-runner'
import { loadExperiments } from '@/services/experiments/experiment-store'
import { getStoredTheme } from '@/services/theme/theme-service'
import ThemeToggle from '@/components/theme/theme-toggle.vue'

const SidebarComponent = defineAsyncComponent(() => import('./components/sidebar-component.vue'))
const MainComponent = defineAsyncComponent(() => import('./components/main-component.vue'))

const LANDING_ENTERED_KEY = 'mlfitLandingEntered'

function shouldShowLanding() {
  try {
    return typeof sessionStorage?.getItem === 'function' && sessionStorage.getItem(LANDING_ENTERED_KEY) !== 'true'
  } catch {
    return true
  }
}

export default {
  name: 'App',
  components: {
    LandingPage,
    SidebarComponent,
    MainComponent,
    ThemeToggle,
  },
  computed: {
    ...mapStores(settingStore),

  },
  data() {
    return {
      dataframe: null,
      selectedFeatures: [],
      mobileNavOpen: false,
      showLanding: shouldShowLanding(),
    }
  },
  async mounted() {
    this.appStore.setDark(getStoredTheme())
    try {
      const experiments = await loadExperiments()
      if (experiments.length) this.appStore.setTrainingRuns(experiments)
    } catch (error) {
      console.warn('Could not restore experiment history:', error)
    }
  },
  methods: {
    ...mapActions(settingStore, ['addMessage', 'resetDF']),
    enterDashboard() {
      this.showLanding = false
      try {
        if (typeof sessionStorage?.setItem === 'function') {
          sessionStorage.setItem(LANDING_ENTERED_KEY, 'true')
        }
      } catch {
        // Session storage can be unavailable in private browsing or tests.
      }
    },
    checkTarget() {
      this.$refs.sidebar.checkmodelTask()
    },
    reset() {
      this.resetDF();
    },
    updateFeatureStats() {
      this.$refs.main.renderStats();
    },
    setSelectedFeatures(e) {
      this.selectedFeatures = e
    },
    handleWizardConfigSync(config) {
      const sidebar = this.$refs.sidebar
      if (!sidebar) return
      if (config.target    !== null) sidebar.syncFromWizard(config)
    },
    async handleWizardTrainRequest(config) {
      const sidebar = this.$refs.sidebar
      if (!sidebar) return

      // ── 1. Ensure sidebar has a live dataframe (needed by checkmodelTask) ──
      if (!sidebar.dataframe && this.appStore.df?.columns?.length) {
        sidebar.dataframe = this.appStore.df
      }

      // ── 2. Reset any stuck training state from a previous failed run ──
      sidebar.training = false

      // ── 3. Set task mode + target first so checkmodelTask resolves correctly ──
      sidebar.taskMode    = config.isClassification ? 'classification' : 'regression'
      sidebar.modelTarget = config.target
      if (config.target != null) {
        this.appStore.setTarget(config.target)
      }
      sidebar.modelOption = config.algoId
      sidebar.crossValidationOption = config.crossValidationOption

      // ── 4. Let checkmodelTask build the correct modelOptions + modelName ──
      //      (also calls getDefaultModelConfiguration which gives full config
      //       structure including the `values` arrays selects need)
      sidebar.checkmodelTask()

      // ── 5. Apply wizard's custom hyperparameter values on top of defaults ──
      if (config.modelConfigurations && sidebar.modelConfigurations) {
        for (const key of Object.keys(config.modelConfigurations)) {
          if (sidebar.modelConfigurations[key] !== undefined) {
            sidebar.modelConfigurations[key].value = config.modelConfigurations[key].value
          }
        }
      }

      const validation = validateConfig({
        rawData: this.appStore.rawData,
        target: config.target,
        algoId: config.algoId,
      })
      if (!validation.valid) {
        if (config.onError) config.onError(new Error(validation.message))
        return
      }

      try {
        const normalized = await runSidebarTraining({
          sidebar,
          store: this.appStore,
          onProgress: config.onProgress,
        })
        if (config.onDone) config.onDone(normalized)
      } catch (err) {
        if (config.onError) config.onError(err)
      }
    },
  }
}
</script>

<style>
#app.dashboard-app {
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: inherit;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
}

.dashboard-banner {
  margin: 0 !important;
  border-radius: 0 !important;
  flex-shrink: 0;
}

.notification.is-danger {
  background-color: hsl(348, 86%, 61%);
  color: #fff !important;
}

.button.is-danger {
  color: #fff !important;
}

.toast.is-danger {
  color: #fff !important;
}

</style>
