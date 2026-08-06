<script setup lang="ts">
/**
 * What the sky is doing tonight, once the score has said whether to go at all.
 *
 * Everything here is computed offline from the clicked point -- no network, so this
 * tab stays complete even when BMKG fails; only the one weather sentence in the
 * summary drops out. The work runs in computeds owned by this component rather than
 * in App.vue so it happens only when the tab is opened.
 *
 * Order is the order the questions get asked: what is tonight like, is the Milky Way
 * up, what can I point at, and -- if tonight is no good -- when should I go instead.
 */
import { computed } from 'vue'
import type { Forecast, LatLng, MoonConditions, NightWindow } from '@/types'
import { SKY_CATALOG } from '@/lib/skyCatalog'
import { rankVisible, compassNameKey } from '@/lib/visibility'
import { milkyWayNight, verdictText } from '@/lib/milkyWay'
import { useI18n } from '@/composables/useI18n'
import { moonCalendar } from '@/lib/moonCalendar'
import { showersNear } from '@/lib/meteorShowers'
import { skySummary } from '@/lib/skySummary'
import { cloudCoverForNight } from '@/lib/scoring'
import { formatAtOffset, formatShortDate, timezoneLabel } from '@/lib/time'
import ObjectTable from './ObjectTable.vue'
import MoonCalendar from './MoonCalendar.vue'

const { t, tx, locale } = useI18n()

const props = defineProps<{
  point: LatLng
  bortle: number | null
  window: NightWindow | null
  moon: MoonConditions | null
  forecast: Forecast | null
  offsetMinutes: number
}>()

const milkyWay = computed(() =>
  props.window && props.moon ? milkyWayNight(props.point, props.window, props.moon) : null,
)

const entries = computed(() =>
  props.window ? rankVisible(SKY_CATALOG, props.point, props.window) : [],
)

const cloudCover = computed(() =>
  props.forecast && props.window
    ? cloudCoverForNight(props.forecast.points, props.window)
    : null,
)

const summary = computed(() => {
  if (!props.window || !props.moon) return []
  return skySummary({
    window: props.window,
    moon: props.moon,
    cloudCover: cloudCover.value,
    milkyWay: milkyWay.value,
    objects: entries.value,
    offsetMinutes: props.offsetMinutes,
  })
})

const nights = computed(() =>
  props.window ? moonCalendar(props.point, props.window.start, 30) : [],
)

const showers = computed(() =>
  props.window ? showersNear(props.point, props.window.start) : [],
)

const coreSpan = computed(() => {
  const v = milkyWay.value?.visibility
  if (!v?.from || !v.to) return null
  return `${formatAtOffset(v.from, props.offsetMinutes)}–${formatAtOffset(
    v.to,
    props.offsetMinutes,
  )} ${timezoneLabel(props.offsetMinutes)}`
})

/** "tomorrow", "9 nights away", "peaked last night" -- the peak in the reader's terms. */
function whenLabel(daysAway: number): string {
  if (daysAway === -1) return t('meteor.peakLastNight')
  if (daysAway < 0) return t('meteor.peakNightsAgo', { count: -daysAway })
  if (daysAway === 0) return t('meteor.peakTonight')
  if (daysAway === 1) return t('meteor.peakTomorrow')
  return t('meteor.nightsAway', { count: daysAway })
}
</script>

<template>
  <div class="tab">
    <p v-if="!window || !moon" class="empty">{{ t('sky.noWindow') }}</p>

    <template v-else>
      <section class="summary">
        <p v-for="(line, i) in summary" :key="i">{{ tx(line) }}</p>
      </section>

      <!-- The Milky Way is the headline this app was built around, so it leads. -->
      <section v-if="milkyWay" class="milkyway" :data-verdict="milkyWay.verdict">
        <h3 class="eyebrow">{{ t('milkyWay.heading') }}</h3>
        <p class="verdict">{{ tx(verdictText(milkyWay.verdict)) }}</p>
        <p class="reason">{{ tx(milkyWay.reason) }}</p>
        <dl v-if="coreSpan" class="facts numeric">
          <div>
            <dt>{{ t('sky.columns.visible') }}</dt>
            <dd>{{ coreSpan }}</dd>
          </div>
          <div>
            <dt>{{ t('sky.columns.peak') }}</dt>
            <dd>
              {{
                t('sky.peakDetail', {
                  degrees: Math.round(milkyWay.visibility.maxAltitude),
                  direction: t(compassNameKey(milkyWay.visibility.azimuthAtMax)),
                })
              }}
              <template v-if="milkyWay.visibility.maxAltitudeTime">
                {{
                  t('sky.peakAt', {
                    time: formatAtOffset(milkyWay.visibility.maxAltitudeTime, offsetMinutes),
                  })
                }}
              </template>
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 class="eyebrow">{{ t('sky.visibleTonight') }}</h3>
        <p class="lede">{{ t('sky.visibleLede') }}</p>
        <ObjectTable :entries="entries" :offset-minutes="offsetMinutes" />
      </section>

      <section class="ahead">
        <h3 class="eyebrow">{{ t('sky.planAhead') }}</h3>
        <MoonCalendar :nights="nights" :offset-minutes="offsetMinutes" />

        <div v-if="showers.length" class="showers">
          <h4 class="eyebrow sub">{{ t('meteor.heading') }}</h4>
          <ul>
            <li v-for="s in showers" :key="s.shower.id">
              <div class="line">
                <span class="name">{{ s.shower.name }}</span>
                <span class="numeric when">{{ whenLabel(s.daysAway) }}</span>
              </div>
              <p class="detail numeric">
                {{
                  t('meteor.detail', {
                    date: formatShortDate(s.peak, offsetMinutes, locale),
                    degrees: Math.round(s.radiant.maxAltitude),
                    zhr: s.shower.zhr,
                  })
                }}
                <template v-if="s.moonInterference >= 0.4">
                  · <span class="warn">{{ t('meteor.moonAffected') }}</span>
                </template>
              </p>
            </li>
          </ul>
          <p class="fine">{{ t('meteor.caveat') }}</p>
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

.summary p {
  margin: 0 0 0.4375rem;
  font-size: 0.8125rem;
  line-height: 1.6;
}

.summary p:last-child {
  margin-bottom: 0;
}

.milkyway {
  padding: 0.875rem;
  background: var(--panel-raised);
  border-left: 2px solid var(--ember-dim);
}

.milkyway[data-verdict='baik'] {
  border-left-color: var(--clear);
}

.milkyway[data-verdict='terbatas'] {
  border-left-color: var(--ember);
}

h3,
h4 {
  margin: 0 0 0.375rem;
}

.verdict {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.9375rem;
  font-weight: 500;
}

.milkyway[data-verdict='baik'] .verdict {
  color: var(--clear);
}

.reason {
  margin: 0.1875rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--haze);
}

.facts {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin: 0.625rem 0 0;
  font-size: 0.75rem;
}

.facts > div {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: 0.5rem;
}

.facts dt {
  color: var(--haze);
}

.facts dd {
  margin: 0;
}

.lede {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--haze);
}

.ahead {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  border-top: var(--rule);
}

.sub {
  margin-bottom: 0.25rem;
}

.showers ul {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: var(--rule);
}

.showers li {
  padding: 0.4375rem 0;
  border-bottom: var(--rule);
}

.line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.name {
  font-size: 0.8125rem;
  font-weight: 500;
}

.when {
  font-size: 0.6875rem;
  color: var(--star);
}

.detail {
  margin: 0.125rem 0 0;
  font-size: 0.6875rem;
  color: var(--haze);
}

.warn {
  color: var(--ember);
}

.fine {
  margin: 0.375rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--haze);
  opacity: 0.75;
}

.empty {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--haze);
}
</style>
