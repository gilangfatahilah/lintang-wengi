<script setup lang="ts">
/**
 * The full BMKG forecast, three days at three-hourly resolution.
 *
 * All of this already arrives with the response the score uses; until now only
 * `tcc` survived into the UI. Rows falling inside tonight's dark window are marked,
 * because those are the only ones that decide anything.
 */
import { computed } from 'vue'
import type { Forecast, NightWindow } from '@/types'
import { groupByLocalDay } from '@/lib/bmkg'
import { formatAtOffset, timezoneLabel } from '@/lib/time'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  forecast: Forecast | null
  window: NightWindow | null
  forecastState: 'idle' | 'loading' | 'error'
  forecastError: string | null
  offsetMinutes: number
}>()

/** Both are absolute instants, so this needs no timezone handling. */
function inDarkWindow(time: Date): boolean {
  if (!props.window) return false
  return time >= props.window.start && time <= props.window.end
}

const days = computed(() =>
  props.forecast ? groupByLocalDay(props.forecast.points) : [],
)
</script>

<template>
  <div class="tab">
    <p v-if="forecastState === 'loading'" class="status">{{ t('score.loadingForecast') }}</p>
    <p v-else-if="forecastState === 'error'" class="status error">
      {{ t(forecastError ?? 'errors.forecastFetch') }}
    </p>

    <template v-else-if="forecast">
      <p class="note">
        {{ t('weather.darkRowNote') }}
        <span class="numeric">({{ timezoneLabel(offsetMinutes) }})</span>.
      </p>

      <section v-for="day in days" :key="day.key" class="day">
        <h3 class="eyebrow day-label">{{ day.label }}</h3>
        <div class="scroller">
          <table>
            <thead>
              <tr>
                <th scope="col">{{ t('weather.time') }}</th>
                <th scope="col">{{ t('weather.cloud') }}</th>
                <th scope="col">{{ t('weather.temp') }}</th>
                <th scope="col">{{ t('weather.humidity') }}</th>
                <th scope="col">{{ t('weather.condition') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in day.points"
                :key="p.time.toISOString()"
                :class="{ dark: inDarkWindow(p.time) }"
              >
                <td class="numeric">
                  <span v-if="inDarkWindow(p.time)" class="marker" :aria-label="t('weather.darkRowMarker')">●</span>
                  {{ formatAtOffset(p.time, p.offsetMinutes) }}
                </td>
                <td class="numeric cover">{{ Math.round(p.cloudCover) }}%</td>
                <td class="numeric">{{ Math.round(p.temp) }}°</td>
                <td class="numeric">{{ Math.round(p.humidity) }}%</td>
                <td class="desc">{{ p.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.status,
.note {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--haze);
}

.status.error {
  color: var(--ember);
}

.day-label {
  margin: 0 0 0.375rem;
}

/* Wide content scrolls inside its own box; the panel must never scroll sideways. */
.scroller {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  white-space: nowrap;
}

th {
  padding: 0 0.5rem 0.25rem 0;
  border-bottom: var(--rule);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: left;
  color: var(--haze);
}

td {
  padding: 0.3125rem 0.5rem 0.3125rem 0;
  border-bottom: var(--rule);
  color: var(--haze);
}

tr.dark td {
  color: var(--star);
}

.marker {
  margin-right: 0.25rem;
  font-size: 0.5rem;
  vertical-align: 0.15em;
  color: var(--ember);
}

.cover {
  color: inherit;
}

.desc {
  white-space: normal;
  min-width: 8rem;
}
</style>
