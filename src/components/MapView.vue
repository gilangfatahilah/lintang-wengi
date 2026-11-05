<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import type { LatLng } from '@/types'
import { overlayGradient, type LpMeta } from '@/lib/lightPollution'
import { ICONS } from '@/lib/icons'
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
/** Drawn from the same stops that painted the overlay PNG, so the two cannot disagree. */
const legendRamp = computed(() =>
  props.lpMeta?.overlayStops ? overlayGradient(props.lpMeta.overlayStops) : null,
)
let resizeObserver: ResizeObserver | null = null

/**
 * CARTO's dark basemap, free for use with attribution. A dark base is not just a
 * style choice here: this map is read at night, and it lets the light pollution
 * overlay be the brightest thing on screen, which is the point.
 *
 * Every tile needs `?key=`. Without one CARTO still answers 200, but with a grey
 * "API KEY REQUIRED" tile instead of the map — nothing errors, so check the
 * picture, not the status.
 *
 * CARTO's dark is a neutral grey, and the app is never neutral black: beside the
 * navy panel it read as a second product. So the tiles are drawn slightly
 * translucent over a background of --void, which pulls their greys toward the
 * dome without a second tile set. The colour is read from the token at mount
 * rather than written here twice; field mode needs nothing extra, because its
 * filter on the whole canvas recolours this layer with the rest.
 */
function buildStyle(): StyleSpecification {
  const ground =
    getComputedStyle(document.documentElement).getPropertyValue('--void').trim() || '#060812'
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png?key=${import.meta.env.VITE_CARTO_API_KEY}`,
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': ground } },
      {
        id: 'basemap',
        type: 'raster',
        source: 'carto',
        paint: { 'raster-opacity': 0.88, 'raster-saturation': -1 },
      },
    ],
  }
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
    style: buildStyle(),
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

  /*
   * MapLibre only watches the window, not its own container. Once the panel became
   * resizable the container changes size without the window doing anything, and an
   * unresized map renders a stretched canvas with the pointer landing in the wrong
   * place -- clicks would return coordinates for somewhere the user did not click.
   */
  resizeObserver = new ResizeObserver(() => m.resize())
  resizeObserver.observe(container.value)

  // Dev-only handle, so a console or a browser-driving script can convert between
  // coordinates and pixels. Stripped from production builds.
  if (import.meta.env.DEV) {
    ;(globalThis as unknown as { __map?: maplibregl.Map }).__map = m
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
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
      // The glyph goes in a child, not on the marker element: MapLibre owns that
      // element's `transform` for positioning, so animating it there would fight
      // the map on every pan.
      el.innerHTML = `<svg class="pin" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS.pin}</svg>`
      // The tip names the point, so the glyph hangs above it rather than centring on it.
      marker.value = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    }
    marker.value.setLngLat([point.lon, point.lat]).addTo(m)

    // Replay the drop on every pick, not just the first. The element is reused, so
    // the class has to come off and go back on with a reflow between -- otherwise
    // picking a second point moves a pin that never acknowledges the tap. Done in
    // CSS rather than the Web Animations API so `prefers-reduced-motion` still
    // neutralises it from one place.
    const pin = marker.value.getElement().firstElementChild
    if (pin) {
      pin.classList.remove('drop')
      void (pin as HTMLElement).offsetWidth
      pin.classList.add('drop')
    }
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
    <!-- The legend sits on the toggle it explains, and goes when the layer does. -->
    <div class="overlay-box">
      <div v-if="legendRamp && overlayVisible" class="legend">
        <span class="map-legend-ramp" :style="{ backgroundImage: legendRamp }" aria-hidden="true" />
        <span class="legend-ends">
          <span>{{ t('map.legendDark') }}</span>
          <span>{{ t('map.legendBright') }}</span>
        </span>
      </div>
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

.overlay-box {
  position: absolute;
  /* Below the search field, which owns the top-left corner. */
  bottom: 0.75rem;
  left: 0.75rem;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  border: var(--rule);
}

.legend {
  display: grid;
  gap: 0.25rem;
  padding: 0.5rem 0.6875rem 0.25rem;
}

/* Over --void, the overlay's faint end reads here as it does over open sea. */
.map-legend-ramp {
  display: block;
  height: 0.5rem;
  border-radius: 0.25rem;
  background-color: var(--void);
}

.legend-ends {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--haze);
}

.overlay-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.6875rem;
  font-size: 0.8125rem;
  color: var(--star);
}

.overlay-toggle:hover {
  color: var(--accent);
}

/* Narrow enough that MapLibre's attribution bar reaches across into the toggle, so
   the toggle steps up out of its row rather than being read through it. */
@media (max-width: 32rem) {
  .overlay-box {
    bottom: 2.25rem;
  }
}
</style>

<style>
/* Marker element lives outside the component's scope, so this rule is global. */
.spot-marker {
  width: 26px;
  height: 26px;
  color: var(--accent);
}

.spot-marker .pin {
  display: block;
  width: 100%;
  height: 100%;
  /* A dark edge rather than a border: the pin has to stay legible over the black of
     open sea and over the glare of a city, and only one of those needs the outline. */
  filter: drop-shadow(0 0 1px color-mix(in srgb, var(--void) 95%, transparent)) drop-shadow(0 1px 2px color-mix(in srgb, var(--void) 60%, transparent));
}

/*
 * Dropped rather than simply appearing, because outdoors and one-handed the finger
 * that placed it is covering the spot. Transform and opacity only, so field mode is
 * untouched; `prefers-reduced-motion` collapses it globally in styles.css.
 */
.spot-marker .pin.drop {
  animation: spot-drop 180ms cubic-bezier(0.2, 0.7, 0.3, 1);
  transform-origin: 50% 100%;
}

@keyframes spot-drop {
  from {
    opacity: 0;
    transform: translateY(-7px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Keep MapLibre's chrome in the app's register rather than its default blue-grey. */
.maplibregl-ctrl-attrib,
.maplibregl-ctrl-attrib a {
  background: color-mix(in srgb, var(--void) 80%, transparent) !important;
  color: var(--haze) !important;
  font-size: 10px;
}

/* The stock zoom buttons are white-on-white and become the brightest thing on
   screen -- the opposite of what this app is for. */
.maplibregl-ctrl-group {
  background: color-mix(in srgb, var(--panel) 92%, transparent) !important;
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
  background: color-mix(in srgb, var(--star) 6%, transparent) !important;
}
</style>
