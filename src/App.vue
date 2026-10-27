<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, watch } from 'vue'
import type { Forecast, Kecamatan, LatLng, MoonConditions, NightWindow, Score } from '@/types'
import {
  loadGrid,
  sampleMagnitude,
  magnitudeToBortle,
  isStubGrid,
  type LpGrid,
} from '@/lib/lightPollution'
import { loadIndex, findNearest, haversineKm } from '@/lib/wilayah'
import { fetchForecast } from '@/lib/bmkg'
import { nightWindow, moonConditions } from '@/lib/astro'
import { computeScore, cloudCoverForNight } from '@/lib/scoring'
import MapView from './components/MapView.vue'
import PlaceSearch from './components/PlaceSearch.vue'
import SpotPanel from './components/SpotPanel.vue'
import PanelResizer from './components/PanelResizer.vue'
import PanelControls from './components/PanelControls.vue'
import MoonTonight from './components/MoonTonight.vue'
import Icon from './components/Icon.vue'
import { provideI18n } from '@/composables/useI18n'
import { usePanelLayout } from '@/composables/usePanelLayout'
import { LOCALES } from '@/lib/i18n'

// Created here so every descendant shares one reactive locale.
const { t, locale, setLocale } = provideI18n()

const grid = shallowRef<LpGrid | null>(null)
const index = shallowRef<Kecamatan[] | null>(null)
const loadError = ref<string | null>(null)

const selected = ref<LatLng | null>(null)
const bortle = ref<number | null>(null)
const window_ = shallowRef<NightWindow | null>(null)
const moon = shallowRef<MoonConditions | null>(null)
const forecast = shallowRef<Forecast | null>(null)
const nearest = shallowRef<Kecamatan | null>(null)
const forecastState = ref<'idle' | 'loading' | 'error'>('idle')
const forecastError = ref<string | null>(null)

const fieldMode = ref(false)
const mapView = ref<InstanceType<typeof MapView> | null>(null)

// Named apart from the domain refs above because these are all about the shape of
// the window, not about the spot being looked at.
const {
  state: panelState,
  placement: panelPlacement,
  size: panelSize,
  min: panelMin,
  max: panelMax,
  dragging: panelDragging,
  frame: panelFrame,
  startDrag: panelDragStart,
  nudge: panelNudge,
  setSize: panelSetSize,
  minimize: panelMinimize,
  maximize: panelMaximize,
  restore: panelRestore,
} = usePanelLayout()

/**
 * True for one animation's length after the panel changes state, so whatever now
 * occupies the panel column can announce itself.
 *
 * The column's *width* cannot be animated, and it is worth writing down why so this
 * is not "fixed" later: the three states declare different numbers of grid tracks
 * (`1fr auto <size>` against `1fr auto` and `0 1fr`), and CSS cannot interpolate
 * between track lists of different lengths. Nor could they simply be padded to
 * match -- interpolation also needs the track *types* to line up, and these states
 * mix lengths with `minmax()` and `auto`. Making the width slide means rewriting the
 * column out of grid tracks entirely, which is a change to the most load-bearing
 * layout in the app for the sake of 200ms.
 *
 * So the contents transition and the track snaps. Gated on the state change rather
 * than left on the elements, because the panel also mounts when a point is picked,
 * and the pin's own drop already acknowledges that.
 */
const panelSwitching = ref(false)
let switchTimer: ReturnType<typeof setTimeout> | undefined
watch(panelState, () => {
  panelSwitching.value = true
  clearTimeout(switchTimer)
  switchTimer = setTimeout(() => (panelSwitching.value = false), 200)
})

/** Cancels an in-flight forecast when the user clicks somewhere else. */
let pending: AbortController | null = null

onMounted(async () => {
  const results = await Promise.allSettled([loadGrid(), loadIndex()])
  const [gridResult, indexResult] = results
  if (gridResult.status === 'fulfilled') grid.value = gridResult.value
  if (indexResult.status === 'fulfilled') index.value = indexResult.value

  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length) {
    loadError.value = t('app.dataError')
  }
})

const score = computed<Score | null>(() => {
  if (bortle.value === null || !moon.value) return null
  const cloudCover =
    forecast.value && window_.value
      ? cloudCoverForNight(forecast.value.points, window_.value)
      : null
  return computeScore({ bortle: bortle.value, cloudCover, moon: moon.value })
})

/** Until the grid loads, assume placeholder rather than claiming calibrated data. */
const lpStub = computed(() => (grid.value ? isStubGrid(grid.value.meta) : true))

const distanceKm = computed(() =>
  selected.value && forecast.value
    ? haversineKm(selected.value, {
        lat: forecast.value.location.lat,
        lon: forecast.value.location.lon,
      })
    : null,
)

/**
 * Everything computable offline resolves immediately; only the forecast waits on the
 * network. The panel therefore shows sky darkness, the dark window and the moon the
 * instant the map is clicked, then fills in cloud cover when BMKG answers.
 */
function pick(point: LatLng) {
  selected.value = point

  const mag = grid.value ? sampleMagnitude(grid.value, point) : null
  bortle.value = mag === null ? null : magnitudeToBortle(mag)

  try {
    const w = nightWindow(point)
    window_.value = w
    moon.value = moonConditions(point, w)
  } catch {
    window_.value = null
    moon.value = null
  }

  pending?.abort()
  forecast.value = null
  forecastError.value = null

  const match = index.value ? findNearest(index.value, point) : null
  nearest.value = match
  if (!match) {
    forecastState.value = 'error'
    forecastError.value = 'errors.wilayahIndex'
    return
  }

  const controller = new AbortController()
  pending = controller
  forecastState.value = 'loading'
  fetchForecast(match.adm4, controller.signal)
    .then((f) => {
      if (controller.signal.aborted) return
      forecast.value = f
      forecastState.value = 'idle'
    })
    .catch((err: Error) => {
      if (controller.signal.aborted) return
      forecastState.value = 'error'
      forecastError.value = err.message
    })
}

/** Search and GPS results are off-screen by definition, so the map follows them. */
function pickAndFly(point: LatLng) {
  pick(point)
  mapView.value?.flyTo(point)
}

watch(fieldMode, (on) => {
  document.documentElement.dataset.field = String(on)
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <h1 class="logo" role="img" aria-label="Lintang Wengi"></h1>
      <div class="controls">
        <div class="lang" role="group" :aria-label="t('app.language')">
          <button
            v-for="code in LOCALES"
            :key="code"
            type="button"
            :aria-pressed="locale === code"
            :class="{ on: locale === code }"
            @click="setLocale(code)"
          >
            {{ code.toUpperCase() }}
          </button>
        </div>
        <button
          class="field-toggle"
        type="button"
        :aria-pressed="fieldMode"
        :title="t('app.fieldModeHint')"
        @click="fieldMode = !fieldMode"
      >
          <Icon name="torch" />
          {{ t('app.fieldMode') }}
        </button>
      </div>
    </header>

    <p v-if="loadError" class="load-error">{{ loadError }}</p>

    <main
      ref="panelFrame"
      class="body"
      :class="{ switching: panelSwitching }"
      :data-panel="panelState"
      :data-placement="panelPlacement"
      :style="{ '--panel-size': `${panelSize}px` }"
    >
      <div class="map-area">
        <MapView
          ref="mapView"
          :selected="selected"
          :lp-meta="grid?.meta ?? null"
          @pick="pick"
        />
        <PlaceSearch :index="index" :lp-meta="grid?.meta ?? null" @pick="pickAndFly" />
      </div>

      <PanelResizer
        v-if="panelState === 'normal'"
        :placement="panelPlacement"
        :size="panelSize"
        :min="panelMin"
        :max="panelMax"
        :dragging="panelDragging"
        @start="panelDragStart"
        @nudge="panelNudge"
        @jump="(edge) => panelSetSize(edge === 'max' ? panelMax : panelMin)"
      />

      <!-- Minimized: a rail rather than nothing. The verdict is the one thing worth
           keeping while you look at the map, and it costs a single digit of space. -->
      <aside v-if="panelState === 'minimized'" class="rail">
        <button
          type="button"
          class="rail-restore"
          :class="{ stacked: panelPlacement === 'below' }"
          :aria-label="t('panel.restore')"
          :title="t('panel.restore')"
          @click="panelRestore"
        >
          <Icon name="expand" :size="1.2" />
        </button>
        <p
          v-if="score"
          class="rail-score numeric"
          role="img"
          :aria-label="t('score.ratingAria', { rating: score.rating })"
        >
          <Icon name="star" :size="0.9" class="rail-star" />
          <span class="rail-value">{{ score.rating }}</span>
        </p>
      </aside>

      <template v-else>
        <SpotPanel
          v-if="selected"
          :point="selected"
          :bortle="bortle"
          :window="window_"
          :moon="moon"
          :forecast="forecast"
          :score="score"
          :forecast-state="forecastState"
          :forecast-error="forecastError"
          :distance-km="distanceKm"
          :lp-stub="lpStub"
          :panel-state="panelState"
          :panel-placement="panelPlacement"
          @minimize="panelMinimize"
          @maximize="panelMaximize"
        />
        <!-- Carries the same controls as SpotPanel. Without them, maximizing before
             picking a point hid the map behind a panel with no way to shrink, and
             the state outlived a reload. -->
        <aside v-else class="empty">
          <div class="empty-text">
            <p class="lede">{{ t('app.tagline') }}</p>
            <p class="sub">{{ t('app.intro') }}</p>
            <MoonTonight />
          </div>
          <PanelControls
            :state="panelState"
            :placement="panelPlacement"
            @minimize="panelMinimize"
            @maximize="panelMaximize"
          />
        </aside>
      </template>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 1rem;
  border-bottom: var(--rule);
  background: var(--panel);
}

/*
 * The logo ships as a single-colour navy silhouette on transparency. Drawn as an
 * image its own #193667 would sit at 1.6:1 against --panel and be near-invisible,
 * and it would stay blue in field mode. So it is used as a mask and filled from the
 * palette: --azure is that same navy lifted to a readable value, and it turns red
 * the moment "Mode lapangan" remaps the token. One asset, correct in both modes.
 */
.logo {
  flex: none;
  margin: 0;
  height: 1.5rem;
  aspect-ratio: 1735 / 801;
  background-color: var(--azure);
  -webkit-mask: url("/logo-mark.png") center / contain no-repeat;
  mask: url("/logo-mark.png") center / contain no-repeat;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Two-state segmented control; the active side borrows the field-toggle's accent. */
.lang {
  display: flex;
}

.lang button {
  padding: 0.375rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--haze);
}

.lang button.on {
  color: var(--star);
}

.field-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  background: var(--panel-raised);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--haze);
}

/* A mode indicator, not a warning: this is the state the app is meant to be used in. */
.field-toggle[aria-pressed="true"] {
  color: var(--azure);
}

.load-error {
  margin: 0;
  padding: 0.5rem 1rem;
  background: var(--panel-raised);
  border-bottom: 1px solid var(--ember-dim);
  font-size: 0.8125rem;
  color: var(--ember);
}

.map-area {
  position: relative;
  min-width: 0;
}

/*
 * Three tracks: map, separator, panel. The separator is a real grid item rather than
 * an overlay so dragging it moves the boundary itself, and the map never sits under
 * the panel — a translucent overlay would let light pollution colour show through
 * the readout, which is the one place that has to stay legible.
 *
 * `--panel-size` is written by usePanelLayout in px, already clamped.
 */
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto var(--panel-size, 25rem);
  min-height: 0;
  flex: 1;
}

/*
 * Two tracks in the other two states, because the separator is not rendered there --
 * there is no boundary to drag when the map is collapsed or the panel is a rail.
 * Keeping three tracks here silently left the panel in the middle `auto` track and
 * sized it to its content instead of filling the window.
 */
.body[data-panel='minimized'] {
  grid-template-columns: minmax(0, 1fr) auto;
}

.body[data-panel='maximized'] {
  grid-template-columns: 0 minmax(0, 1fr);
}

/*
 * The panel column changing hands. Transform and opacity only, on the element that
 * arrives -- the track width itself snaps, for the reason set out in the script.
 */
.body.switching > :last-child {
  animation: panel-switch 180ms ease-out;
}

@keyframes panel-switch {
  from {
    opacity: 0;
    transform: translateX(6px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Below the map the column arrives from underneath, not from the side. */
.body[data-placement='below'].switching > :last-child {
  animation-name: panel-switch-below;
}

@keyframes panel-switch-below {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.body > :last-child {
  border-left: var(--rule);
  background: var(--panel);
  min-height: 0;
}

/* The map's own element must be allowed to collapse, or the grid keeps its width. */
.body[data-panel='maximized'] .map-area {
  overflow: hidden;
}

.empty {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.75rem 1.25rem 1.25rem;
}

.empty-text {
  min-width: 0;
  /* Matches the readout's cap so a maximized empty panel is not one long line. */
  max-width: 46rem;
}

/*
 * The minimized rail. It keeps the rating rather than going blank: the whole reason
 * to minimize is to look at the map, and the verdict is what you would otherwise be
 * reopening the panel to re-read.
 */
.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.5rem;
  width: 2.75rem;
}

.rail-restore {
  display: flex;
  padding: 0.25rem;
  color: var(--haze);
}

.rail-restore:hover {
  color: var(--azure);
}

/* Stacked, the panel reopens upward, so the arrow has to say so. */
.rail-restore.stacked .icon {
  transform: rotate(90deg);
}

.rail-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  line-height: 1;
}

.rail-value {
  font-size: 1.125rem;
  font-weight: 700;
}

.rail-star {
  margin-bottom: 0.25rem;
}

/* The empty panel's one statement, lettered like the place names it is waiting for. */
.lede {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 400;
  line-height: 1.15;
  text-wrap: balance;
}

.sub {
  margin: 0;
  max-width: 34rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--haze);
}

/*
 * Breakpoint mirrored by STACKED_QUERY in usePanelLayout.ts, which is what decides
 * whether a drag is measured against width or height. They have to agree.
 */
@media (max-width: 52rem) {
  .body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto var(--panel-size, 45vh);
  }

  .body[data-panel='minimized'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .body[data-panel='maximized'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 0 minmax(0, 1fr);
  }

  .body > :last-child {
    border-left: none;
    border-top: var(--rule);
  }

  /* Stacked, the rail runs along the bottom instead of down the side. */
  .rail {
    flex-direction: row;
    justify-content: space-between;
    width: auto;
    padding: 0.5rem 1rem;
  }

  .rail-score {
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
  }

  .rail-star {
    margin-bottom: 0;
  }
}
</style>
