<script setup lang="ts">
/**
 * Moonlight over the next month, so the answer can be "not tonight, go on the 14th".
 *
 * Each bar is one night's usable darkness -- the inverse of moon interference, not
 * the inverse of phase. A bright moon that sets early leaves a tall bar, which is
 * the whole point: a phase calendar would draw that night as unusable.
 */
import { computed } from 'vue'
import type { MoonNight } from '@/lib/moonCalendar'
import { bestDarkRun } from '@/lib/moonCalendar'
import { formatShortDate } from '@/lib/time'
import { useI18n } from '@/composables/useI18n'

const { t, locale } = useI18n()

const props = defineProps<{
  nights: readonly MoonNight[]
  offsetMinutes: number
}>()

// viewBox units. The aspect ratio is preserved on render, as in NightBar.
const W = 340
const H = 56
const PAD_X = 4
const BASELINE = 40
const TOP = 6
const LABEL_Y = 52

const bars = computed(() => {
  const n = props.nights.length
  if (n === 0) return []
  const slot = (W - 2 * PAD_X) / n
  return props.nights.map((night, i) => {
    const height = (1 - night.interference) * (BASELINE - TOP)
    return {
      key: night.window.start.toISOString(),
      x: PAD_X + i * slot,
      width: Math.max(slot - 1, 0.5),
      y: BASELINE - height,
      height,
      dark: night.dark,
      night,
    }
  })
})

/** A label every seventh night; more than that and they collide. */
const labels = computed(() =>
  bars.value
    .filter((_, i) => i % 7 === 0)
    .map((bar) => ({
      key: bar.key,
      x: bar.x,
      text: formatShortDate(bar.night.window.start, props.offsetMinutes, locale.value),
    })),
)

const run = computed(() => bestDarkRun(props.nights))

const runLabel = computed(() => {
  const r = run.value
  if (!r || r.length === 0) return null
  const first = formatShortDate(r[0]!.window.start, props.offsetMinutes, locale.value)
  const last = formatShortDate(r[r.length - 1]!.window.start, props.offsetMinutes, locale.value)
  return r.length === 1 ? first : `${first} – ${last}`
})
</script>

<template>
  <figure class="calendar">
    <figcaption class="head">
      <span class="eyebrow">{{ t('moonCalendar.heading') }}</span>
      <span v-if="runLabel" class="numeric range">{{ runLabel }}</span>
    </figcaption>

    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="
        runLabel
          ? t('moonCalendar.summaryWithRun', { count: nights.length, run: runLabel })
          : t('moonCalendar.summary', { count: nights.length })
      "
    >
      <rect
        v-for="bar in bars"
        :key="bar.key"
        :x="bar.x"
        :y="bar.y"
        :width="bar.width"
        :height="Math.max(bar.height, 0.5)"
        :class="{ bar: true, dark: bar.dark }"
      />
      <line :x1="PAD_X" :x2="W - PAD_X" :y1="BASELINE" :y2="BASELINE" class="axis" />
      <text
        v-for="label in labels"
        :key="label.key"
        :x="label.x"
        :y="LABEL_Y"
        class="tick"
        text-anchor="start"
      >
        {{ label.text }}
      </text>
    </svg>

    <p class="legend">{{ t('moonCalendar.legend') }}</p>
  </figure>
</template>

<style scoped>
.calendar {
  margin: 0;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.375rem;
}

.range {
  font-size: 0.8125rem;
  color: var(--star);
}

svg {
  display: block;
  width: 100%;
  height: auto;
}

.bar {
  fill: var(--haze);
  opacity: 0.35;
}

.bar.dark {
  fill: var(--clear);
  opacity: 0.85;
}

.axis {
  stroke: rgba(232, 228, 218, 0.16);
  stroke-width: 1;
}

.tick {
  fill: var(--haze);
  font-family: var(--font-mono);
  font-size: 9px;
}

.legend {
  margin: 0.375rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--haze);
}
</style>
