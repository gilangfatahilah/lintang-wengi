<script setup lang="ts">
/**
 * Two ways to reach a spot without hunting on the map: type its name, or ask the
 * device where you are.
 *
 * Both resolve to the same `pick` the map click uses, so nothing downstream has to
 * know how a point was chosen.
 */
import { computed, ref, nextTick } from 'vue'
import type { Kecamatan, LatLng } from '@/types'
import type { LpMeta } from '@/lib/lightPollution'
import { LANDMARKS } from '@/lib/landmarks'
import { searchPlaces, type SearchResult } from '@/lib/search'
import { LANDMARK_ICONS, type IconName } from '@/lib/icons'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t } = useI18n()

const props = defineProps<{
  index: Kecamatan[] | null
  /** Used to reject positions outside the app's coverage before anything else runs. */
  lpMeta: LpMeta | null
}>()
const emit = defineEmits<{ pick: [LatLng] }>()

const query = ref('')
const open = ref(false)
const activeIndex = ref(-1)
const locating = ref(false)
const geoError = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)

const results = computed(() =>
  props.index ? searchPlaces(props.index, LANDMARKS, query.value) : [],
)

const showList = computed(() => open.value && query.value.trim().length > 0)

/** Landmarks render through their kind so one entry serves both languages. */
function label(r: SearchResult): string {
  return r.landmarkKind ? t(`search.kind.${r.landmarkKind}`, { name: r.name }) : r.name
}

function kindLabel(r: SearchResult): string {
  return r.landmarkKind ? t(`search.kindLabel.${r.landmarkKind}`) : t('search.district')
}

/** A landmark shows what it is; a kecamatan shows that it is a place on the map. */
function icon(r: SearchResult): IconName {
  return r.landmarkKind ? LANDMARK_ICONS[r.landmarkKind] : 'district'
}

function choose(r: SearchResult) {
  emit('pick', { lat: r.lat, lon: r.lon })
  query.value = label(r)
  open.value = false
  activeIndex.value = -1
  geoError.value = null
}

function onInput() {
  open.value = true
  activeIndex.value = -1
  geoError.value = null
}

function move(delta: number) {
  if (!showList.value || results.value.length === 0) return
  const n = results.value.length
  activeIndex.value = (activeIndex.value + delta + n) % n
}

function onEnter() {
  const r = results.value[activeIndex.value] ?? results.value[0]
  if (r) choose(r)
}

function clear() {
  query.value = ''
  open.value = false
  activeIndex.value = -1
  geoError.value = null
  nextTick(() => input.value?.focus())
}

/**
 * Whether a position falls inside the data this app actually has.
 *
 * Without this the app fails in the most misleading way available: `sampleMagnitude`
 * correctly returns null outside the grid, but `findNearest` will still hand back the
 * closest Indonesian kecamatan even from thousands of km away, and the panel would
 * then present a real BMKG forecast for somewhere the user is not.
 */
function insideCoverage(p: LatLng): boolean {
  const bbox = props.lpMeta?.bbox
  if (!bbox) return true
  const [west, south, east, north] = bbox
  return p.lon >= west && p.lon <= east && p.lat >= south && p.lat <= north
}

function useMyLocation() {
  geoError.value = null
  if (!navigator.geolocation) {
    geoError.value = t('geolocation.unavailable')
    return
  }

  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const point = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      if (!insideCoverage(point)) {
        geoError.value = t('geolocation.outsideCoverage')
        return
      }
      query.value = ''
      open.value = false
      emit('pick', point)
    },
    (err) => {
      locating.value = false
      // Distinct causes get distinct advice: a denied permission needs different
      // action from a device that simply cannot fix a position.
      geoError.value = {
        [err.PERMISSION_DENIED]: t('geolocation.denied'),
        [err.POSITION_UNAVAILABLE]: t('geolocation.unavailable'),
        [err.TIMEOUT]: t('geolocation.timeout'),
      }[err.code] ?? t('geolocation.failed')
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  )
}
</script>

<template>
  <div class="search" @keydown.escape="open = false">
    <div class="field">
      <input
        ref="input"
        v-model="query"
        type="search"
        role="combobox"
        autocomplete="off"
        :aria-label="t('search.label')"
        :aria-expanded="showList"
        aria-controls="search-results"
        :aria-activedescendant="activeIndex >= 0 ? `search-opt-${activeIndex}` : undefined"
        :placeholder="t('search.placeholder')"
        @input="onInput"
        @focus="open = true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
      />
      <button
        v-if="query"
        class="ctl"
        type="button"
        :aria-label="t('search.clear')"
        @click="clear"
      >
        <Icon name="close" />
      </button>
      <button
        class="ctl locate"
        type="button"
        :disabled="locating"
        :aria-label="t('search.useMyLocation')"
        :title="t('search.useMyLocation')"
        @click="useMyLocation"
      >
        <span v-if="locating" class="spinner" aria-hidden="true"></span>
        <Icon v-else name="crosshair" />
      </button>
    </div>

    <p v-if="locating" class="msg">{{ t('search.locating') }}</p>
    <p v-else-if="geoError" class="msg error">{{ geoError }}</p>

    <ul v-if="showList" id="search-results" class="results" role="listbox">
      <li
        v-for="(r, i) in results"
        :id="`search-opt-${i}`"
        :key="r.id"
        role="option"
        :aria-selected="i === activeIndex"
        :class="{ active: i === activeIndex }"
        @mousedown.prevent="choose(r)"
        @mouseenter="activeIndex = i"
      >
        <Icon :name="icon(r)" :size="1.25" class="kind" />
        <span class="name">{{ label(r) }}</span>
        <span class="meta">{{ kindLabel(r) }} · {{ r.secondary }}</span>
      </li>
      <li v-if="results.length === 0" class="empty" role="presentation">
        {{ t('search.noResults', { query }) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  width: min(20rem, calc(100vw - 1.5rem));
}

.field {
  display: flex;
  align-items: center;
  background: rgba(14, 17, 23, 0.94);
  border: var(--rule);
}

input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--star);
}

input::placeholder {
  color: var(--haze);
}

/* The browser's own clear affordance would sit alongside ours. */
input::-webkit-search-cancel-button {
  display: none;
}

.ctl {
  display: flex;
  align-items: center;
  flex: none;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  line-height: 1;
  color: var(--haze);
}

.ctl:hover:not(:disabled) {
  color: var(--star);
}

.locate {
  border-left: var(--rule);
}

.spinner {
  display: block;
  width: 0.75rem;
  height: 0.75rem;
  border: 1.5px solid var(--azure-dim);
  border-top-color: var(--azure);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.msg {
  margin: 0.25rem 0 0;
  padding: 0.25rem 0.375rem;
  background: rgba(14, 17, 23, 0.94);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--haze);
}

.msg.error {
  color: var(--ember);
}

.results {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  max-height: 16rem;
  overflow-y: auto;
  background: rgba(14, 17, 23, 0.97);
  border: var(--rule);
  /* The only layer in the app that floats over another. Appearing instantly reads
     as a glitch rather than as an answer; 120ms is enough to say it arrived. */
  animation: results-in 120ms ease-out;
}

@keyframes results-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* The glyph spans both text rows so it reads as belonging to the whole result
   rather than to the name line. */
.results li {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.5rem;
  row-gap: 0.0625rem;
  padding: 0.4375rem 0.625rem;
  cursor: pointer;
}

.kind {
  grid-row: 1 / 3;
  align-self: center;
  color: var(--haze);
}

.results li.active .kind {
  color: var(--azure);
}

.results li + li {
  border-top: var(--rule);
}

.results li.active {
  background: var(--brand);
  box-shadow: inset 2px 0 0 var(--azure);
}

.results li.empty {
  display: block;
  cursor: default;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--haze);
}

.name {
  font-size: 0.8125rem;
  color: var(--star);
}

.meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--haze);
}

@media (max-width: 52rem) {
  .search {
    width: calc(100vw - 1.5rem);
  }
}
</style>
