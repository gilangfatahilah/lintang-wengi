<script setup lang="ts">
/**
 * The verdict and the evidence behind it: should you go tonight, and what is
 * holding it back. Moved out of SpotPanel unchanged when the panel gained tabs.
 */
import { computed } from 'vue'
import type { Forecast, LatLng, MoonConditions, NightWindow, Score } from '@/types'
import { bortleText } from '@/lib/lightPollution'
import { ratingText, limitingFactorText } from '@/lib/scoring'
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
    <!-- The verdict, stated before the evidence. -->
    <section v-if="score" class="verdict">
      <div class="rating">
        <span class="numeric value">{{ score.rating }}</span>
        <span class="denom">/5</span>
      </div>
      <div class="verdict-text">
        <p class="label">{{ tx(ratingText(score.rating)) }}</p>
        <p v-if="limitingFactorText(score)" class="reason">
          <!-- Names the culprit before the sentence does. -->
          <Icon :name="FACTOR_ICONS[score.limitingFactor!.key]" />
          {{ tx(limitingFactorText(score)!) }}
        </p>
        <p v-else-if="score.complete" class="reason good">{{ t('score.nothingLimiting') }}</p>
        <p v-if="!score.complete" class="reason provisional">{{ t('score.provisional') }}</p>
      </div>
    </section>

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
      <div class="row">
        <dt class="eyebrow">{{ t('panel.tabs.sky') }}</dt>
        <dd>
          <span class="numeric strong">
            {{ bortle !== null ? t('score.factor.darkness', { bortle }) : '—' }}
          </span>
          <span v-if="bortle !== null" class="detail">{{ tx(bortleText(bortle)) }}</span>
        </dd>
      </div>

      <div class="row">
        <dt class="eyebrow">{{ t('moon.heading') }}</dt>
        <dd>
          <span class="numeric strong">
            <MoonGlyph
              v-if="moon"
              :illumination="moon.illumination"
              :phase-key="moon.phaseKey"
              :size="1.35"
              class="moon-glyph"
            />
            {{
              moon
                ? `${t('moon.phase.' + moon.phaseKey)} ${Math.round(moon.illumination * 100)}%`
                : '—'
            }}
          </span>
          <span v-if="moonTimes" class="detail numeric">{{ moonTimes }}</span>
        </dd>
      </div>

      <div v-if="forecast" class="row">
        <dt class="eyebrow">{{ t('weather.forecastPoint') }}</dt>
        <dd>
          <span class="numeric strong">{{ forecast.location.desa }}</span>
          <span v-if="distanceKm !== null" class="detail numeric">
            {{ t('weather.distanceAway', { km: distanceKm.toFixed(1) }) }}
          </span>
        </dd>
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

.verdict {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem;
  background: var(--brand);
  border-left: 2px solid var(--azure);
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

.reason .icon {
  margin-right: 0.25rem;
  color: var(--ember);
}

.moon-glyph {
  margin-right: 0.375rem;
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
</style>
