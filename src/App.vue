<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, watch } from 'vue'
import type { Forecast, Kecamatan, LatLng, MoonConditions, NightWindow, Score } from '@/types'
import { loadGrid, sampleMagnitude, magnitudeToBortle, type LpGrid } from '@/lib/lightPollution'
import { loadIndex, findNearest, haversineKm } from '@/lib/wilayah'
import { fetchForecast } from '@/lib/bmkg'
import { nightWindow, moonConditions } from '@/lib/astro'
import { computeScore, cloudCoverForNight } from '@/lib/scoring'
import MapView from './components/MapView.vue'
import SpotPanel from './components/SpotPanel.vue'

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

/** Cancels an in-flight forecast when the user clicks somewhere else. */
let pending: AbortController | null = null

onMounted(async () => {
  const results = await Promise.allSettled([loadGrid(), loadIndex()])
  const [gridResult, indexResult] = results
  if (gridResult.status === 'fulfilled') grid.value = gridResult.value
  if (indexResult.status === 'fulfilled') index.value = indexResult.value

  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length) {
    loadError.value =
      'Sebagian data gagal dimuat. Jalankan `pnpm data:lp` dan `pnpm data:wilayah`, lalu muat ulang.'
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
    forecastError.value = 'Indeks wilayah belum tersedia.'
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

watch(fieldMode, (on) => {
  document.documentElement.dataset.field = String(on)
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <h1 class="wordmark">
        Stargazing<span class="mark">·</span>Spot<span class="mark">·</span>Finder
      </h1>
      <button
        class="field-toggle"
        type="button"
        :aria-pressed="fieldMode"
        title="Merah monokrom, agar adaptasi gelap mata tidak hilang saat di lapangan"
        @click="fieldMode = !fieldMode"
      >
        Mode lapangan
      </button>
    </header>

    <p v-if="loadError" class="load-error">{{ loadError }}</p>

    <main class="body">
      <MapView :selected="selected" :lp-meta="grid?.meta ?? null" @pick="pick" />

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
      />
      <aside v-else class="empty">
        <p class="lede">Pilih titik di peta.</p>
        <p class="sub">
          Skor kelayakan malam ini dihitung dari polusi cahaya lokasi, tutupan awan BMKG,
          dan posisi bulan selama jendela gelap astronomis.
        </p>
      </aside>
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

.wordmark {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.mark {
  color: var(--ember);
  padding: 0 0.1em;
}

.field-toggle {
  padding: 0.375rem 0.625rem;
  border: var(--rule);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  color: var(--haze);
}

.field-toggle[aria-pressed='true'] {
  color: var(--ember);
  border-color: var(--ember-dim);
}

.load-error {
  margin: 0;
  padding: 0.5rem 1rem;
  background: var(--panel-raised);
  border-bottom: 1px solid var(--ember-dim);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ember);
}

.body {
  display: grid;
  grid-template-columns: 1fr var(--panel-width);
  min-height: 0;
  flex: 1;
}

.body > :last-child {
  border-left: var(--rule);
  background: var(--panel);
  min-height: 0;
}

.empty {
  padding: 1.5rem 1.25rem;
}

.lede {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.0625rem;
  font-weight: 500;
}

.sub {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--haze);
}

@media (max-width: 52rem) {
  .body {
    grid-template-columns: 1fr;
    grid-template-rows: 45vh 1fr;
  }

  .body > :last-child {
    border-left: none;
    border-top: var(--rule);
  }
}
</style>
