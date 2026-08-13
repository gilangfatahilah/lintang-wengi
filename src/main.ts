import { createApp } from 'vue'
import App from './App.vue'
// MapLibre's stylesheet first, ours second. Its control rules and ours land on the
// same specificity, so whichever is imported last wins -- and the app's palette has
// to be the one that wins.
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'

createApp(App).mount('#app')
