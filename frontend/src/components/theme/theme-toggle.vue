<template>
  <button
    type="button"
    class="theme-toggle"
    :class="buttonClass"
    :aria-pressed="settings.isDark"
    :title="settings.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="settings.toggleDark()"
  >
    <span class="theme-toggle__icon" aria-hidden="true">{{ settings.isDark ? '☀️' : '🌙' }}</span>
    <span v-if="showLabel" class="theme-toggle__label">{{ settings.isDark ? 'Light mode' : 'Dark mode' }}</span>
  </button>
</template>

<script>
import { settingStore } from '@/stores/settings'

export default {
  name: 'ThemeToggle',
  props: {
    showLabel: {
      type: Boolean,
      default: false,
    },
    buttonClass: {
      type: String,
      default: '',
    },
  },
  setup() {
    return { settings: settingStore() }
  },
}
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--theme-border, #d5e8e1);
  border-radius: 999px;
  padding: 0.45rem 0.7rem;
  background: var(--theme-surface, #fff);
  color: var(--theme-text, #0f2a24);
  cursor: pointer;
  font-weight: 700;
  font-size: 0.82rem;
}

.theme-toggle:hover {
  border-color: var(--theme-accent, #0e8d73);
}

.theme-toggle__icon {
  line-height: 1;
}
</style>
