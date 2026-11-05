<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import type { LatLng } from '@/types'
import { overlayGradient, type LpMeta } from '@/lib/lightPollution'
import { isInView, panIntoView, type Inset } from '@/lib/mapFraming'
import { ICONS } from '@/lib/icons'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t } = useI18n()

const props = defineProps<{
  selected: LatLng | null
  lpMeta: LpMeta | null
  /** Where BMKG's forecast for the selection was issued, once it has arrived. */
  source: (LatLng & { name: string }) | null
}>()
const emit = defineEmits<{ pick: [LatLng] }>()

const container = ref<HTMLDivElement | null>(null)
const map = shallowRef<maplibregl.Map | null>(null)
const marker = shallowRef<maplibregl.Marker | null>(null)
const sourceMarker = shallowRef<maplibregl.Marker | null>(null)
const overlayVisible = ref(true)
/** Drawn from the same stops that painted the overlay PNG, so the two cannot disagree. */
const legendRamp = computed(() =>
  props.lpMeta?.overlayStops ? overlayGradient(props.lpMeta.overlayStops) : null,
)
let resizeObserver: ResizeObserver | null = null
let styleReady = false
/** Whether the picked point was on screen after the last move the user made. */
let selectedInView = false

/**
 * The part of the map a picked point is kept inside. The top is deepest because the
 * search field sits there and the pin stands above its point; the bottom clears the
 * legend and the zoom buttons.
 */
const FRAME_INSET: Inset = { top: 72, right: 24, bottom: 40, left: 24 }

/** Closer than this on screen, the forecast source hides under the pin and its ring. */
const SOURCE_MIN_PX = 28

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
function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function buildStyle(): StyleSpecification {
  const ground = token('--void', '#060812')
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

/**
 * The dashed line from the picked point to the desa BMKG actually forecast for. The
 * index is kecamatan-granular, so the forecast can come from several kilometres
 * away; the panel says how far, and this shows which way. Painted from --accent
 * like the pin it hangs off; field mode reaches it through the filter on the canvas.
 */
function addSourceLink(m: maplibregl.Map) {
  if (m.getSource('forecast-link')) return
  m.addSource('forecast-link', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  m.addLayer({
    id: 'forecast-link',
    type: 'line',
    source: 'forecast-link',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': token('--accent', '#ffffff'),
      'line-width': 1.25,
      'line-opacity': 0.7,
      'line-dasharray': [2, 2.5],
    },
  })
}

const sourceLabel = computed(() =>
  props.source ? t('map.forecastSource', { place: props.source.name }) : '',
)

function syncSource() {
  const m = map.value
  if (!m || !styleReady) return
  const from = props.selected
  const to = props.source
  const link = m.getSource('forecast-link') as maplibregl.GeoJSONSource | undefined

  if (!from || !to) {
    link?.setData({ type: 'FeatureCollection', features: [] })
    sourceMarker.value?.remove()
    return
  }

  link?.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [from.lon, from.lat],
        [to.lon, to.lat],
      ],
    },
  })

  if (!sourceMarker.value) {
    const el = document.createElement('div')
    el.className = 'forecast-source'
    el.innerHTML = '<span class="dot"></span><span class="label"></span>'
    sourceMarker.value = new maplibregl.Marker({ element: el, anchor: 'center' })
  }
  const label = sourceMarker.value.getElement().querySelector('.label')
  if (label) label.textContent = sourceLabel.value
  sourceMarker.value.setLngLat([to.lon, to.lat]).addTo(m)
  placeSource()
}

/**
 * At low zoom the source sits under the pin, so it hides rather than stacking the
 * two. Near the right edge its label would be cut off by the map, so it moves to
 * the left of the dot.
 */
function placeSource() {
  const m = map.value
  const el = sourceMarker.value?.getElement()
  if (!m || !el || !styleReady || !props.selected || !props.source) return
  const a = m.project([props.selected.lon, props.selected.lat])
  const b = m.project([props.source.lon, props.source.lat])
  const near = Math.hypot(a.x - b.x, a.y - b.y) < SOURCE_MIN_PX
  m.setLayoutProperty('forecast-link', 'visibility', near ? 'none' : 'visible')
  el.classList.toggle('near', near)
  const label = el.querySelector<HTMLElement>('.label')
  const overflows = label ? b.x + 9 + label.offsetWidth > viewSize(m).width : false
  el.classList.toggle('flip', overflows)
}

function viewSize(m: maplibregl.Map) {
  const canvas = m.getCanvas()
  return { width: canvas.clientWidth, height: canvas.clientHeight }
}

function trackSelectedInView() {
  const m = map.value
  const p = props.selected
  if (!m || !p) return
  const size = viewSize(m)
  // A collapsed map shows nothing; keep the last answer for when it comes back.
  if (size.width === 0 || size.height === 0) return
  selectedInView = isInView(m.project([p.lon, p.lat]), size)
}

/** Nudges the map so the picked point clears the edges and the overlays on them. */
function keepSelectedInView(duration: number) {
  const m = map.value
  const p = props.selected
  if (!m || !p) return
  const size = viewSize(m)
  if (size.width === 0 || size.height === 0) return
  const [dx, dy] = panIntoView(m.project([p.lon, p.lat]), size, FRAME_INSET)
  if (dx || dy) m.panBy([dx, dy], { duration })
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
    // The ResizeObserver below covers window resizes too. MapLibre's own window
    // listener would resize first, and the `moveend` that fires would record the
    // point as off screen before the observer could keep it on.
    trackResize: false,
  })
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
  m.on('click', (e) => emit('pick', { lat: e.lngLat.lat, lon: e.lngLat.lng }))
  m.on('load', () => {
    if (props.lpMeta) addOverlay(m, props.lpMeta)
    addSourceLink(m)
    styleReady = true
    syncSource()
  })
  m.on('move', placeSource)
  m.on('moveend', trackSelectedInView)
  map.value = m

  /*
   * MapLibre only watches the window, not its own container. Once the panel became
   * resizable the container changes size without the window doing anything, and an
   * unresized map renders a stretched canvas with the pointer landing in the wrong
   * place -- clicks would return coordinates for somewhere the user did not click.
   */
  // A point the user could see before the resize stays seen after it; one they had
  // panned away from on purpose is left where they put it.
  resizeObserver = new ResizeObserver(() => {
    const keep = selectedInView
    m.resize()
    if (keep) keepSelectedInView(0)
    trackSelectedInView()
  })
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
  styleReady = false
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
      // The element has no size, so MapLibre's centre anchor puts it exactly on the
      // coordinate: the ring is centred on that spot and the pin stands with its tip
      // in the ring. The glyphs are children, not the element itself, because
      // MapLibre owns the element's `transform` and animating it would fight the map
      // on every pan.
      el.innerHTML =
        '<span class="ring"></span>' +
        `<svg class="pin" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS.pin}</svg>`
      marker.value = new maplibregl.Marker({ element: el, anchor: 'center' })
    }
    marker.value.setLngLat([point.lon, point.lat]).addTo(m)

    // Replay the drop on every pick, not just the first. The element is reused, so
    // the class has to come off and go back on with a reflow between -- otherwise
    // picking a second point moves a pin that never acknowledges the tap. Done in
    // CSS rather than the Web Animations API so `prefers-reduced-motion` still
    // neutralises it from one place.
    const el = marker.value.getElement()
    el.classList.remove('drop')
    void el.offsetWidth
    el.classList.add('drop')

    // A tap near an edge leaves the pin under the search field or half off the map.
    // Search and GPS picks are already flying to the point; leave those alone.
    if (!m.isMoving()) keepSelectedInView(200)
    trackSelectedInView()
    syncSource()
  },
)

// The label changes width with the language, so it is placed again as well as relabelled.
watch([() => props.source, sourceLabel], syncSource)

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

/* A click here picks a coordinate, so the pointer is a sight rather than MapLibre's
   open hand. Dragging still grabs, which is what pans. */
.map :deep(.maplibregl-canvas-container.maplibregl-interactive) {
  cursor: crosshair;
}

.map :deep(.maplibregl-canvas-container.maplibregl-interactive:active) {
  cursor: grabbing;
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
/* Marker elements live outside the component's scope, so these rules are global. */
.spot-marker,
.forecast-source {
  width: 0;
  height: 0;
  /* Clicking on the pin picks the point under it, the same as clicking beside it. */
  pointer-events: none;
}

.spot-marker {
  color: var(--accent);
}

/* The coordinate the readout was computed for. The pin says "here" from a distance;
   the ring says exactly where, which the pin's tip, a single pixel, cannot. Flattened
   to an ellipse so it lies on the ground the pin stands on. */
.spot-marker .ring {
  position: absolute;
  left: -8px;
  top: -3px;
  width: 16px;
  height: 6px;
  box-sizing: border-box;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

.spot-marker .pin {
  position: absolute;
  left: -13px;
  /* The glyph's tip is at y 22.8 of 24, so the box drops by the remaining 1.2 units
     to put the tip on the coordinate rather than just above it. */
  bottom: calc(-26px * 1.2 / 24);
  display: block;
  width: 26px;
  height: 26px;
}

/* A dark edge rather than a border: both have to stay legible over the black of open
   sea and over the glare of a city, and only one of those needs the outline. */
.spot-marker .pin,
.spot-marker .ring,
.forecast-source .dot {
  filter: drop-shadow(0 0 1px color-mix(in srgb, var(--void) 95%, transparent)) drop-shadow(0 1px 2px color-mix(in srgb, var(--void) 60%, transparent));
}

/*
 * The pin drops, because outdoors and one-handed the finger that placed it is
 * covering the spot; the ring closes in on the point as it lands, the way a finder
 * settles on a star. Transform and opacity only, so field mode is untouched;
 * `prefers-reduced-motion` collapses both globally in styles.css.
 */
.spot-marker.drop .pin {
  animation: spot-drop 180ms cubic-bezier(0.2, 0.7, 0.3, 1);
  transform-origin: 50% 100%;
}

.spot-marker.drop .ring {
  animation: spot-lock 180ms cubic-bezier(0.2, 0.7, 0.3, 1);
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

@keyframes spot-lock {
  from {
    opacity: 0;
    transform: scale(3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.forecast-source .dot {
  position: absolute;
  left: -3.5px;
  top: -3.5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.forecast-source .label {
  position: absolute;
  left: 9px;
  top: 0;
  transform: translateY(-50%);
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  white-space: nowrap;
  /* MapLibre sets its own Helvetica on the map container. */
  font-family: var(--font-body);
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--star);
  background: color-mix(in srgb, var(--panel) 88%, transparent);
}

.forecast-source.flip .label {
  left: auto;
  right: 9px;
}

.forecast-source.near {
  visibility: hidden;
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
