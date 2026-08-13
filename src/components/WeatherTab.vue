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
import { weatherIcon } from '@/lib/weather'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t, pick, locale } = useI18n()

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

// The locale has to be passed: `groupByLocalDay` builds each day's label itself and
// defaults to English, so leaving it off left "Sat, Aug 8" above an Indonesian table.
const days = computed(() =>
  props.forecast ? groupByLocalDay(props.forecast.points, locale.value) : [],
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

      <!-- One table, not one per day. Every day shares a single column layout, which
           is the only way a column reads straight down the page; separate tables
           sized themselves to their own widest cell and drifted apart by up to 15px.
           The days are tbody groups, so the header is stated once and sticks. -->
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
          <tbody v-for="day in days" :key="day.key">
            <tr class="day">
              <th scope="colgroup" colspan="5" class="eyebrow">{{ day.label }}</th>
            </tr>
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
              <td class="desc">
                <Icon :name="weatherIcon(p.weatherCode)" class="wx" />
                {{ pick(p.description) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

/* Stated once now, so it has to survive the scroll: with three days in one table,
   CLOUD and HUMIDITY are both a bare percentage once the header is out of sight. */
thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--panel);
}

.day th {
  padding-top: 1.25rem;
  border-bottom: none;
  color: var(--star);
}

tbody:first-of-type .day th {
  padding-top: 0.25rem;
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
  /* Emphasis, not alarm: these are the rows that decide the night. */
  color: var(--azure);
}

.cover {
  color: inherit;
}

.desc {
  white-space: normal;
  min-width: 8rem;
}

/* Sized against the row rather than the caption text, so the column of glyphs
   reads as a column when the eye runs down it. */
.wx {
  margin-right: 0.375rem;
  font-size: 1.0625rem;
  color: var(--star);
  opacity: 0.75;
}

tr.dark .wx {
  opacity: 1;
}
</style>
