<script setup lang="ts">
/**
 * The night at a glance: when it is dark, how cloudy, and when the moon is up.
 *
 * This is the one graphic the app exists to draw. A rating tells you whether to go;
 * this tells you *when* to go, which is the decision actually being made -- a night
 * that is 80% clouded but clear from 01:00 to 04:00 is a good night if you know it,
 * and a wasted drive if you only saw the average.
 *
 * Cloud cover is drawn as an area through the 3-hourly forecast points, with a dot
 * on each actual sample so the interpolation between them is not mistaken for real
 * resolution. The area is dim outside astronomical darkness and saturated inside it,
 * because only the dark part is what you can shoot in.
 *
 * The galactic core rides a second track above the moon's. Both are answers to the
 * same question -- when in this night is it worth being outside -- and reading them
 * against each other on one axis is the whole reason they share it: a core window
 * that sits under the moon's is a different night from one that does not.
 */
import { computed } from 'vue'
import type { ForecastPoint, MoonConditions, NightWindow, ObjectVisibility } from '@/types'
import { formatAtOffset } from '@/lib/time'
import { useI18n } from '@/composables/useI18n'
import MoonGlyph from './MoonGlyph.vue'

const { t } = useI18n()

const props = defineProps<{
  window: NightWindow
  moon: MoonConditions
  points: readonly ForecastPoint[]
  offsetMinutes: number
  /** Galactic core visibility, or null when it never clears the useful altitude. */
  core?: ObjectVisibility | null
  now?: Date
}>()

// Geometry in viewBox units. The aspect ratio is preserved on render, so these are
// real proportions rather than something the browser will stretch.
//
// Nothing here is text. A viewBox unit is not a pixel -- it is a fraction of the
// rendered width -- so type set inside the SVG grows with the container, and the
// axis labels reached 31px against 16px body text once the panel filled the window.
// The labels are HTML positioned over the same coordinate space instead, which is
// what keeps them at instrument size no matter how wide the bezel gets.
const W = 340
const H = 92
const PAD_X = 6
const CORE_Y = 10
const MOON_Y = 20
const PLOT_TOP = 32
const PLOT_BOTTOM = 86

/** Pad the axis an hour either side so dusk and dawn read as edges, not cliffs. */
const PAD_MS = 3600_000

const span = computed(() => {
  const start = props.window.start.getTime() - PAD_MS
  const end = props.window.end.getTime() + PAD_MS
  return { start, end, duration: end - start }
})

function toX(time: number): number {
  const { start, duration } = span.value
  return PAD_X + ((time - start) / duration) * (W - 2 * PAD_X)
}

function toY(cloudCover: number): number {
  return PLOT_BOTTOM - (cloudCover / 100) * (PLOT_BOTTOM - PLOT_TOP)
}

const darkStart = computed(() => toX(props.window.start.getTime()))
const darkEnd = computed(() => toX(props.window.end.getTime()))

const samples = computed(() =>
  props.points
    .filter((p) => {
      const t = p.time.getTime()
      return t >= span.value.start && t <= span.value.end
    })
    .map((p) => ({
      key: p.time.toISOString(),
      x: toX(p.time.getTime()),
      y: toY(p.cloudCover),
      cover: p.cloudCover,
    })),
)

/** Filled area under the cloud-cover line. Empty when the forecast misses the night. */
const areaPath = computed(() => {
  const s = samples.value
  if (s.length === 0) return ''
  const line = s.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L')
  return `M${s[0]!.x.toFixed(2)},${PLOT_BOTTOM} L${line} L${s[s.length - 1]!.x.toFixed(
    2,
  )},${PLOT_BOTTOM} Z`
})

/**
 * The stretch of the night the moon is up.
 *
 * Derived from the sampled fraction rather than rise/set times: a window can contain
 * zero, one or two such events, and the fraction is defined in every case. Anchoring
 * it to the correct end matters -- a moon that sets early and one that rises late
 * are opposite situations for planning.
 */
const moonTrack = computed(() => {
  const f = props.moon.fractionAboveHorizon
  if (f <= 0.001) return null
  const width = (darkEnd.value - darkStart.value) * f
  const setsDuringNight = props.moon.set !== null && props.moon.rise === null
  return { x: setsDuringNight ? darkStart.value : darkEnd.value - width, width }
})

const ticks = computed(() => {
  const { start, end } = span.value
  const out: { x: number; label: string }[] = []
  const first = Math.ceil(start / 3600_000) * 3600_000
  for (let t = first; t <= end; t += 2 * 3600_000) {
    out.push({ x: toX(t), label: formatAtOffset(new Date(t), props.offsetMinutes) })
  }
  return out
})

const nowX = computed(() => {
  const t = (props.now ?? new Date()).getTime()
  const { start, end } = span.value
  return t >= start && t <= end ? toX(t) : null
})

const darkLabel = computed(
  () =>
    `${formatAtOffset(props.window.start, props.offsetMinutes)} – ${formatAtOffset(
      props.window.end,
      props.offsetMinutes,
    )}`,
)

const moonPercent = computed(() => Math.round(props.moon.fractionAboveHorizon * 100))

/**
 * The stretch the galactic core is usable, clipped to the dark window.
 *
 * Comes straight from `from`/`to` rather than being reconstructed from a fraction:
 * unlike the moon, the core's window has real endpoints, and where it sits in the
 * night is the point -- an early core and a pre-dawn core mean different alarm clocks.
 */
const coreTrack = computed(() => {
  const v = props.core
  if (!v?.from || !v.to) return null
  const x1 = toX(v.from.getTime())
  const x2 = toX(v.to.getTime())
  return { x: x1, width: Math.max(x2 - x1, 1) }
})

/** Screen-reader summary of the whole graphic, assembled from the same numbers. */
const ariaLabel = computed(() => {
  const parts = [t('night.ariaSummary', { range: darkLabel.value, percent: moonPercent.value })]
  if (coreTrack.value) parts.push(t('night.ariaCore'))
  if (!samples.value.length) parts.push(t('night.noForecast'))
  return parts.join(' ')
})
</script>

<template>
  <figure class="nightbar">
    <figcaption class="head">
      <span class="label-quiet">{{ t('night.astronomicalDark') }}</span>
      <span class="numeric range">{{ darkLabel }}</span>
    </figcaption>

    <div class="plot">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="ariaLabel"
      >
        <defs>
          <clipPath id="dark-clip">
            <rect
              :x="darkStart"
              :width="Math.max(darkEnd - darkStart, 0)"
              :y="PLOT_TOP - 8"
              :height="PLOT_BOTTOM - PLOT_TOP + 8"
            />
          </clipPath>
        </defs>

        <!-- The dark window: everything outside it is twilight or daylight. -->
        <rect
          :x="darkStart"
          :width="Math.max(darkEnd - darkStart, 0)"
          :y="PLOT_TOP - 8"
          :height="PLOT_BOTTOM - PLOT_TOP + 8"
          class="dark-band"
        />
        <line :x1="darkStart" :x2="darkStart" :y1="PLOT_TOP - 10" :y2="PLOT_BOTTOM" class="edge" />
        <line :x1="darkEnd" :x2="darkEnd" :y1="PLOT_TOP - 10" :y2="PLOT_BOTTOM" class="edge" />

        <!-- Galactic core: the window you actually came for -->
        <line
          v-if="coreTrack"
          :x1="coreTrack.x"
          :x2="coreTrack.x + coreTrack.width"
          :y1="CORE_Y"
          :y2="CORE_Y"
          class="core-track"
          stroke-linecap="round"
        />

        <!-- Moon presence across the dark window -->
        <line
          v-if="moonTrack"
          :x1="moonTrack.x"
          :x2="moonTrack.x + moonTrack.width"
          :y1="MOON_Y"
          :y2="MOON_Y"
          class="moon-track"
          :style="{ opacity: 0.3 + 0.7 * moon.illumination }"
          stroke-linecap="round"
        />

        <!-- Cloud cover: dim overall, saturated where it actually matters -->
        <template v-if="areaPath">
          <path :d="areaPath" class="cloud-area" />
          <path :d="areaPath" class="cloud-area bright" clip-path="url(#dark-clip)" />
          <polyline
            :points="samples.map((p) => `${p.x},${p.y}`).join(' ')"
            class="cloud-line"
            fill="none"
          />
          <circle v-for="p in samples" :key="p.key" :cx="p.x" :cy="p.y" r="2" class="sample" />
        </template>

        <line :x1="PAD_X" :x2="W - PAD_X" :y1="PLOT_BOTTOM" :y2="PLOT_BOTTOM" class="axis" />

        <line
          v-if="nowX !== null"
          :x1="nowX"
          :x2="nowX"
          :y1="CORE_Y - 4"
          :y2="PLOT_BOTTOM + 4"
          class="now"
        />
      </svg>

      <p v-if="!areaPath" class="nodata">{{ t('night.noForecast') }}</p>
    </div>

    <!-- The axis, in HTML. Percentages of the same viewBox width the marks are drawn
         in, so a label stays over its tick at every panel size. Hidden from the
         reader because the svg's aria-label already states the window. -->
    <div class="ticks" aria-hidden="true">
      <span
        v-for="tick in ticks"
        :key="tick.label"
        class="numeric"
        :style="{ left: `${(tick.x / W) * 100}%` }"
        >{{ tick.label }}</span
      >
    </div>

    <ul class="legend">
      <li><i class="swatch cloud-swatch" aria-hidden="true"></i>{{ t('night.cloudCover') }}</li>
      <li>
        <i class="swatch moon-swatch" aria-hidden="true"></i>{{ t('night.moonUp') }}
        <span class="numeric">{{ moonPercent }}%</span>
        <!-- How bright that moon is, which the track's opacity encodes but no
             legend swatch can say. -->
        <MoonGlyph :illumination="moon.illumination" :phase-key="moon.phaseKey" :size="1.2" />
      </li>
      <li v-if="coreTrack">
        <i class="swatch core-swatch" aria-hidden="true"></i>{{ t('milkyWay.heading') }}
      </li>
      <li v-if="nowX !== null"><i class="swatch now-swatch" aria-hidden="true"></i>{{ t('night.now') }}</li>
    </ul>
  </figure>
</template>

<style scoped>
.nightbar {
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

.plot {
  position: relative;
}

svg {
  display: block;
  width: 100%;
  height: auto;
}

.ticks {
  position: relative;
  height: 1rem;
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--haze);
}

.ticks span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}

.dark-band {
  fill: var(--night-band);
}

.edge {
  stroke: var(--azure-dim);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.axis {
  stroke: color-mix(in srgb, var(--star) 16%, transparent);
  stroke-width: 1;
}

.cloud-area {
  fill: var(--haze);
  opacity: 0.16;
}

.cloud-area.bright {
  opacity: 0.42;
}

.cloud-line {
  stroke: var(--haze);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.sample {
  fill: var(--star);
  opacity: 0.65;
}

.moon-track {
  stroke: var(--ember);
  stroke-width: 4;
}

.core-track {
  stroke: var(--azure);
  stroke-width: 4;
  opacity: 0.85;
}

.now {
  stroke: var(--ember);
  stroke-width: 1.5;
}

.nodata {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--haze);
  font-size: 0.6875rem;
  font-style: italic;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.875rem;
  margin: 0.375rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.6875rem;
  color: var(--haze);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.swatch {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 1px;
}

.cloud-swatch {
  background: var(--haze);
  opacity: 0.5;
}

.moon-swatch {
  background: var(--ember);
  height: 0.1875rem;
  border-radius: 2px;
}

.core-swatch {
  background: var(--azure);
  height: 0.1875rem;
  border-radius: 2px;
}

.now-swatch {
  background: var(--ember);
  width: 0.125rem;
  height: 0.75rem;
}
</style>