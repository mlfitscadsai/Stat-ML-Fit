import { createApp } from 'vue'
import App from './App.vue'
import buefy from 'buefy'
import { createPinia } from 'pinia'
import '@/assets/dark-mode.css'
import '@/assets/experience-theme.css'
import '@/assets/redesign.css'
import '@/assets/theme-surfaces.css'
import '@/assets/landing-page.css'
import VueMathjax from './components/vue-mathjax.vue'

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(buefy)
app.component('vue-mathjax', VueMathjax);
app.mount('#app');
