<script setup lang="ts">
/**
 * The evidence behind the verdict. The verdict itself is in SpotPanel's sticky head
 * (VerdictHeader), so it stays in view on every tab; this tab is the night bar and
 * one row per factor, each with how far it is from ideal.
 */
import { computed } from 'vue'
import type { Forecast, LatLng, MoonConditions, NightWindow, Score, SubScoreKey } from '@/types'
import { bortleText } from '@/lib/lightPollution'
import { useI18n } from '@/composables/useI18n'
import { visibilityDuring } from '@/lib/visibility'
import { MILKY_WAY_CORE } from '@/lib/skyCatalog'
import { formatAtOffset, timezoneLabel } from '@/lib/time'
import { FACTOR_ICONS } from '@/lib/icons'
import NightBar from './NightBar.vue'
import Icon from './Icon.vue'
import MoonGlyph from './MoonGlyph.vue'

const { t, tx } = useI18n()

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
  offsetMinutes: number
}>()

// One object across 48 samples -- cheap enough to compute here rather than plumbing
// it down from the Langit tab, which the user may never open.
const core = computed(() =>
  props.window ? visibilityDuring(MILKY_WAY_CORE, props.point, props.window) : null,
)

/** Read off the score itself, so the row and the rating cannot disagree. */
const cloudCover = computed(() => props.score?.stretch?.cloudCover ?? null)

/** 0-1 per factor, for the meters; null where the factor did not enter the score. */
function subScore(key: SubScoreKey): number | null {
  return props.score?.subScores.find((s) => s.key === key)?.value ?? null
}

function isLimiting(key: SubScoreKey): boolean {
  return props.score?.limitingFactor?.key === key
}

/**
 * "rises 06:41 · sets 13:58 WIB", with either half dropped when it does not happen.
 *
 * A null rise or set is an event that falls outside the night, not a value the app
 * failed to find -- a moon already up at dusk and still up at dawn has neither. The
 * em dash that stood in for it read as missing data, and "sets — WIB" read as a bug.
 */
const moonTimes = computed(() => {
  const moon = props.moon
  if (!moon) return null
  const parts: string[] = []
  if (moon.rise) parts.push(t('moon.rise', { time: formatAtOffset(moon.rise, props.offsetMinutes) }))
  if (moon.set) parts.push(t('moon.set', { time: formatAtOffset(moon.set, props.offsetMinutes) }))
  return parts.length ? `${parts.join(' · ')} ${timezoneLabel(props.offsetMinutes)}` : null
})
</script>

<template>
  <div class="tab">
    <NightBar
      v-if="window && moon"
      :window="window"
      :moon="moon"
      :points="forecast?.points ?? []"
      :offset-minutes="offsetMinutes"
      :core="core"
    />

    <p v-if="forecastState === 'loading'" class="status">{{ t('score.loadingForecast') }}</p>
    <p v-else-if="forecastState === 'error'" class="status error">
      {{ t(forecastError ?? 'errors.forecastFetch') }}
      <span class="hint">{{ t('score.forecastFallback') }}</span>
    </p>

    <dl class="readout">
      <div class="row" :class="{ limit: isLimiting('darkness') }">
        <span class="badge"><Icon :name="FACTOR_ICONS.darkness" :size="1.25" /></span>
        <div class="text">
          <dt class="label-quiet">{{ t('panel.tabs.sky') }}</dt>
          <dd>
            <span class="numeric strong">
              {{ bortle !== null ? t('score.factor.darkness', { bortle }) : '—' }}
            </span>
            <span v-if="bortle !== null" class="detail">{{ tx(bortleText(bortle)) }}</span>
          </dd>
        </div>
        <span v-if="subScore('darkness') !== null" class="meter" aria-hidden="true">
          <i :style="{ transform: `scaleX(${subScore('darkness')})` }"></i>
        </span>
      </div>

      <div class="row" :class="{ limit: isLimiting('clouds') }">
        <span class="badge"><Icon :name="FACTOR_ICONS.clouds" :size="1.25" /></span>
        <div class="text">
          <dt class="label-quiet">{{ t('weather.heading') }}</dt>
          <dd>
            <span class="numeric strong">
              {{ cloudCover !== null ? `${Math.round(cloudCover)}%` : '—' }}
            </span>
            <span v-if="cloudCover !== null" class="detail">{{
              t(score?.stretch?.wholeNight === false ? 'score.cloudDetailStretch' : 'score.cloudDetail')
            }}</span>
          </dd>
        </div>
        <span v-if="subScore('clouds') !== null" class="meter" aria-hidden="true">
          <i :style="{ transform: `scaleX(${subScore('clouds')})` }"></i>
        </span>
      </div>

      <div class="row" :class="{ limit: isLimiting('moon') }">
        <span class="badge">
          <MoonGlyph
            v-if="moon"
            :illumination="moon.illumination"
            :phase-key="moon.phaseKey"
            :size="1.25"
          />
          <Icon v-else :name="FACTOR_ICONS.moon" :size="1.25" />
        </span>
        <div class="text">
          <dt class="label-quiet">{{ t('moon.heading') }}</dt>
          <dd>
            <span class="numeric strong">
              {{
                moon
                  ? `${t('moon.phase.' + moon.phaseKey)} ${Math.round(moon.illumination * 100)}%`
                  : '—'
              }}
            </span>
            <span v-if="moonTimes" class="detail numeric">{{ moonTimes }}</span>
          </dd>
        </div>
        <span v-if="subScore('moon') !== null" class="meter" aria-hidden="true">
          <i :style="{ transform: `scaleX(${subScore('moon')})` }"></i>
        </span>
      </div>

      <div v-if="forecast" class="row plain">
        <span class="badge"><Icon name="pin" :size="1.25" /></span>
        <div class="text">
          <dt class="label-quiet">{{ t('weather.forecastPoint') }}</dt>
          <dd>
            <span class="numeric strong">{{ forecast.location.desa }}</span>
            <span v-if="distanceKm !== null" class="detail numeric">
              {{ t('weather.distanceAway', { km: distanceKm.toFixed(1) }) }}
            </span>
          </dd>
        </div>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.status {
  margin: 0;
  font-size: 0.875rem;
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
  gap: 0.5rem;
  margin: 0;
}

/* One factor per row: glyph, reading, and a meter for how close it is to ideal. */
.row {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) 3.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius);
  background: var(--panel-raised);
}

.row.plain {
  grid-template-columns: 2.5rem minmax(0, 1fr);
  background: none;
  padding-block: 0.25rem;
}

/* The limiting factor carries the warning colour on its outline, glyph and meter, the
   same row the verdict's chip names. */
.row.limit {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ember) 55%, transparent);
}

.badge {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
  background: var(--void);
  font-size: 1rem;
  color: var(--star);
}

.row.limit .badge {
  color: var(--ember);
}

.text {
  min-width: 0;
}

.text dd {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  margin: 0;
}

.strong {
  font-size: 1.0625rem;
  font-weight: 700;
}

.detail {
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--haze);
}

.meter {
  height: 0.375rem;
  border-radius: 0.1875rem;
  background: var(--void);
  overflow: hidden;
}

/* Scaled rather than sized so it never animates a layout property. */
.meter i {
  display: block;
  height: 100%;
  background: var(--clear);
  transform-origin: left;
}

.row.limit .meter i {
  background: var(--ember);
}
</style>
