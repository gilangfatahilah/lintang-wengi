<script setup lang="ts">
import { computed } from 'vue'
import type { Forecast, LatLng, MoonConditions, NightWindow, Score } from '@/types'
import { bortleLabel } from '@/lib/lightPollution'
import { ratingLabel, limitingFactorText } from '@/lib/scoring'
import { approximateOffsetMinutes, formatAtOffset, timezoneLabel } from '@/lib/time'
import NightBar from './NightBar.vue'

const props = defineProps<{
  point: LatLng
  bortle: number | null
  window: NightWindow | null
  moon: MoonConditions | null
  forecast: Forecast | null
  score: Score | null
  forecastState: 'idle' | 'loading' | 'error'
  forecastError: string | null
  distanceKm: number | null
}>()

// The forecast carries the location's real offset; until it lands, approximate from
// longitude so displayed times are not silently rendered in the viewer's timezone.
const offset = computed(
  () => props.forecast?.points[0]?.offsetMinutes ?? approximateOffsetMinutes(props.point.lon),
)

const placeName = computed(() => {
  const l = props.forecast?.location
  return l ? `${l.kecamatan}, ${l.kotkab}` : 'Menentukan wilayah…'
})

const coords = computed(
  () => `${props.point.lat.toFixed(4)}°, ${props.point.lon.toFixed(4)}°`,
)

const moonTimes = computed(() => {
  if (!props.moon) return null
  const fmt = (d: Date | null) => (d ? formatAtOffset(d, offset.value) : '—')
  return { rise: fmt(props.moon.rise), set: fmt(props.moon.set) }
})
</script>

<template>
  <aside class="panel">
    <header class="head">
      <h2 class="place">{{ placeName }}</h2>
      <p class="numeric coords">{{ coords }}</p>
    </header>

    <!-- The verdict, stated before the evidence. -->
    <section v-if="score" class="verdict">
      <div class="rating">
        <span class="numeric value">{{ score.rating }}</span>
        <span class="denom">/5</span>
      </div>
      <div class="verdict-text">
        <p class="label">{{ ratingLabel(score.rating) }}</p>
        <p v-if="limitingFactorText(score)" class="reason">{{ limitingFactorText(score) }}</p>
        <p v-else-if="score.complete" class="reason good">Tidak ada faktor yang menahan.</p>
        <p v-if="!score.complete" class="reason provisional">
          Sementara — dihitung tanpa data cuaca.
        </p>
      </div>
    </section>

    <NightBar
      v-if="window && moon"
      :window="window"
      :moon="moon"
      :points="forecast?.points ?? []"
      :offset-minutes="offset"
    />

    <p v-if="forecastState === 'loading'" class="status">Mengambil prakiraan BMKG…</p>
    <p v-else-if="forecastState === 'error'" class="status error">
      {{ forecastError }}
      <span class="hint">Skor dihitung dari polusi cahaya dan bulan saja.</span>
    </p>

    <dl class="readout">
      <div class="row">
        <dt class="eyebrow">Langit</dt>
        <dd>
          <span class="numeric strong">{{ bortle !== null ? `Bortle ${bortle}` : '—' }}</span>
          <span v-if="bortle !== null" class="detail">{{ bortleLabel(bortle) }}</span>
        </dd>
      </div>

      <div class="row">
        <dt class="eyebrow">Bulan</dt>
        <dd>
          <span class="numeric strong">
            {{ moon ? `${moon.phaseName} ${Math.round(moon.illumination * 100)}%` : '—' }}
          </span>
          <span v-if="moonTimes" class="detail numeric">
            terbit {{ moonTimes.rise }} · terbenam {{ moonTimes.set }}
            {{ timezoneLabel(offset) }}
          </span>
        </dd>
      </div>

      <div v-if="forecast" class="row">
        <dt class="eyebrow">Titik cuaca</dt>
        <dd>
          <span class="numeric strong">{{ forecast.location.desa }}</span>
          <span v-if="distanceKm !== null" class="detail numeric">
            {{ distanceKm.toFixed(1) }} km dari titik yang dipilih
          </span>
        </dd>
      </div>
    </dl>

    <!-- BMKG requires attribution wherever their data is shown. It belongs next to
         the data it describes, not buried in a page footer. -->
    <footer class="attribution">
      <p>
        Data cuaca:
        <a href="https://data.bmkg.go.id/prakiraan-cuaca/" target="_blank" rel="noopener">
          BMKG
        </a>
        — Badan Meteorologi, Klimatologi, dan Geofisika
      </p>
      <p class="fine">Polusi cahaya: data sementara, belum dikalibrasi.</p>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
  overflow-y: auto;
}

.head {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.place {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.coords {
  margin: 0;
  font-size: 0.75rem;
  color: var(--haze);
}

.verdict {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem;
  background: var(--panel-raised);
  border-left: 2px solid var(--ember);
}

.rating {
  display: flex;
  align-items: baseline;
  line-height: 1;
}

.value {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
}

.denom {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--haze);
}

.verdict-text {
  min-width: 0;
}

.label {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 500;
}

.reason {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--haze);
}

.reason.good {
  color: var(--clear);
}

.reason.provisional {
  color: var(--ember);
}

.status {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--haze);
}

.status.error {
  color: var(--ember);
}

.hint {
  display: block;
  color: var(--haze);
}

.readout {
  display: flex;
  flex-direction: column;
  margin: 0;
  border-top: var(--rule);
}

.row {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 0.75rem;
  padding: 0.6875rem 0;
  border-bottom: var(--rule);
}

.row dt {
  padding-top: 0.1875rem;
}

.row dd {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin: 0;
  min-width: 0;
}

.strong {
  font-size: 0.875rem;
  font-weight: 500;
}

.detail {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--haze);
}

.attribution {
  margin-top: auto;
  padding-top: 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--haze);
}

.attribution p {
  margin: 0;
}

.attribution a {
  color: var(--star);
  text-decoration-color: var(--ember-dim);
  text-underline-offset: 2px;
}

.fine {
  color: var(--ember-dim);
}
</style>
