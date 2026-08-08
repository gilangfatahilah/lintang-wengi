<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import type { LatLng } from '@/types'
import type { LpMeta } from '@/lib/lightPollution'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t } = useI18n()

const props = defineProps<{
  selected: LatLng | null
  lpMeta: LpMeta | null
}>()
const emit = defineEmits<{ pick: [LatLng] }>()

const container = ref<HTMLDivElement | null>(null)
const map = shallowRef<maplibregl.Map | null>(null)
const marker = shallowRef<maplibregl.Marker | null>(null)
const overlayVisible = ref(true)

/**
 * CARTO's dark basemap, free for use with attribution. A dark base is not just a
 * style choice here: this map is read at night, and it lets the light pollution
 * overlay be the brightest thing on screen, which is the point.
 */
const style: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'basemap', type: 'raster', source: 'carto' }],
}

function addOverlay(m: maplibregl.Map, meta: LpMeta) {
  const [west, south, east, north] = meta.bbox
  if (m.getSource('lp')) return
  m.addSource('lp', {
    type: 'image',
    url: '/data/lp-overlay.png',
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  })
  m.addLayer({
    id: 'lp-layer',
    type: 'raster',
    source: 'lp',
    paint: { 'raster-opacity': 0.72, 'raster-resampling': 'linear' },
  })
}

onMounted(() => {
  if (!container.value) return
  const m = new maplibregl.Map({
    container: container.value,
    style,
    center: [117, -2.2],
    zoom: 4,
    maxBounds: [
      [90, -15],
      [146, 10],
    ],
    attributionControl: { compact: true },
  })
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
  m.on('click', (e) => emit('pick', { lat: e.lngLat.lat, lon: e.lngLat.lng }))
  m.on('load', () => {
    if (props.lpMeta) addOverlay(m, props.lpMeta)
  })
  map.value = m

  // Dev-only handle, so a console or a browser-driving script can convert between
  // coordinates and pixels. Stripped from production builds.
  if (import.meta.env.DEV) {
    ;(globalThis as unknown as { __map?: maplibregl.Map }).__map = m
  }
})

onBeforeUnmount(() => {
  map.value?.remove()
  map.value = null
})

// The grid loads asynchronously, so the overlay may become available after load.
watch(
  () => props.lpMeta,
  (meta) => {
    const m = map.value
    if (m && meta && m.isStyleLoaded()) addOverlay(m, meta)
  },
)

watch(
  () => props.selected,
  (point) => {
    const m = map.value
    if (!m || !point) return
    if (!marker.value) {
      const el = document.createElement('div')
      el.className = 'spot-marker'
      marker.value = new maplibregl.Marker({ element: el })
    }
    marker.value.setLngLat([point.lon, point.lat]).addTo(m)
  },
)

/** Lets the parent recentre the map when a point arrives from search or GPS. */
defineExpose({
  flyTo(point: LatLng) {
    map.value?.flyTo({ center: [point.lon, point.lat], zoom: Math.max(map.value.getZoom(), 9) })
  },
})

watch(overlayVisible, (visible) => {
  const m = map.value
  if (m?.getLayer('lp-layer')) {
    m.setLayoutProperty('lp-layer', 'visibility', visible ? 'visible' : 'none')
  }
})
</script>

<template>
  <div class="map-wrap">
    <div ref="container" class="map" />
    <button
      class="overlay-toggle"
      type="button"
      :aria-pressed="overlayVisible"
      @click="overlayVisible = !overlayVisible"
    >
      <Icon name="layers" />
      {{ t('map.lightPollution') }}: {{ overlayVisible ? t('map.shown') : t('map.hidden') }}
    </button>
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
  height: 100%;
}

.map {
  height: 100%;
}

.overlay-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  position: absolute;
  /* Below the search field, which owns the top-left corner. */
  bottom: 0.75rem;
  left: 0.75rem;
  padding: 0.4375rem 0.6875rem;
  background: rgba(14, 17, 23, 0.92);
  border: var(--rule);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  color: var(--star);
}

.overlay-toggle:hover {
  border-color: var(--azure-dim);
}

/* Narrow enough that MapLibre's attribution bar reaches across into the toggle, so
   the toggle steps up out of its row rather than being read through it. */
@media (max-width: 32rem) {
  .overlay-toggle {
    bottom: 2.25rem;
  }
}
</style>

<style>
/* Marker element lives outside the component's scope, so this rule is global. */
.spot-marker {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--azure);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(7, 8, 11, 0.8);
}

.spot-marker::after {
  content: '';
  display: block;
  width: 2px;
  height: 2px;
  margin: 6.5px auto;
  background: var(--azure);
  border-radius: 50%;
}

/* Keep MapLibre's chrome in the app's register rather than its default blue-grey. */
.maplibregl-ctrl-attrib,
.maplibregl-ctrl-attrib a {
  background: rgba(7, 8, 11, 0.8) !important;
  color: var(--haze) !important;
  font-size: 10px;
}

/* The stock zoom buttons are white-on-white and become the brightest thing on
   screen -- the opposite of what this app is for. */
.maplibregl-ctrl-group {
  background: rgba(14, 17, 23, 0.92) !important;
  border: var(--rule);
  box-shadow: none !important;
}

.maplibregl-ctrl-group button + button {
  border-top: var(--rule);
}

.maplibregl-ctrl-group button .maplibregl-ctrl-icon {
  filter: invert(1) opacity(0.55);
}

.maplibregl-ctrl-group button:hover {
  background: rgba(232, 228, 218, 0.06) !important;
}
</style>
