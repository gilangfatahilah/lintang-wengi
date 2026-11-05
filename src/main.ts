import { createApp } from 'vue'
import App from './App.vue'
// MapLibre's stylesheet first, ours second. Its control rules and ours land on the
// same specificity, so whichever is imported last wins -- and the app's palette has
// to be the one that wins.
import 'maplibre-gl/dist/maplibre-gl.css'
import '@fontsource-variable/plus-jakarta-sans'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// Updates itself on the next load after a deploy. Prompting instead would need UI
// for a moment that, at a dark site with no signal, never arrives.
registerSW({ immediate: true })

createApp(App).mount('#app')
