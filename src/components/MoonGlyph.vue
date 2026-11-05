<script setup lang="ts">
/**
 * Tonight's moon, drawn rather than looked up.
 *
 * The shape comes from the same `illumination` the score is computed from, so the
 * glyph cannot disagree with the number printed beside it -- a fixed set of eight
 * phase pictures eventually would, because the phase key is a rounding of a
 * continuous quantity and 51% illuminated does not look like a half moon.
 *
 * The lit region is bounded by the limb on one side and the terminator on the other.
 * The terminator projects to an ellipse of half-width |1 - 2k| * r: zero at quarter
 * phase, where it is a straight edge, and a full circle at new and full. Which side
 * is lit follows from the phase key, since illumination alone cannot tell waxing
 * from waning.
 *
 * Orientation is northern-hemisphere convention (waxing lights the right). Indonesia
 * straddles the equator and the moon's tilt varies through the night anyway, so
 * there is no orientation that is correct everywhere; this one is the one people
 * have seen in print.
 */
import { computed, useId } from 'vue'
import type { MoonPhaseKey } from '@/types'
import { litPath, MARIA } from '@/lib/moonShape'

const props = withDefaults(
  defineProps<{
    /** Illuminated fraction, 0–1. */
    illumination: number
    phaseKey: MoonPhaseKey
    size?: number
    label?: string
  }>(),
  { size: 1.15, label: undefined },
)

const R = 10
const C = 12

const lit = computed(() => litPath(props.illumination, props.phaseKey, C, C, R))

// Several glyphs share a page (empty state, score row, night bar), so the mask and
// gradient ids have to be unique per instance or every moon reads the first one's.
const uid = useId()
const maskId = `moon-lit-${uid}`
const limbId = `moon-limb-${uid}`

const seas = MARIA.map((m) => ({
  cx: C + m.cx * R,
  cy: C + m.cy * R,
  rx: m.rx * R,
  ry: m.ry * R,
  transform: m.rotate ? `rotate(${m.rotate} ${C + m.cx * R} ${C + m.cy * R})` : undefined,
}))
</script>

<template>
  <svg
    class="moon"
    viewBox="0 0 24 24"
    :style="{ width: `${size}em`, height: `${size}em` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <!--
      The mask's greys are luminance, not colour: they only set how much of
      currentColor shows through, so field mode still recolours every pixel.
      Lit face = limb-darkened disc, minus the maria, clipped to the lit region.
    -->
    <defs>
      <radialGradient :id="limbId">
        <stop offset="0.55" stop-color="white" />
        <stop offset="1" stop-color="#9a9a9a" />
      </radialGradient>
      <mask :id="maskId" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <path v-if="lit" :d="lit" :fill="`url(#${limbId})`" />
        <g fill="black" opacity="0.26">
          <ellipse v-for="(m, i) in seas" :key="i" v-bind="m" />
        </g>
      </mask>
    </defs>
    <!-- The unlit disc stays visible so a thin crescent still reads as a moon
         rather than as a stray sliver; faintly mapped, as earthshine shows it. -->
    <circle :cx="C" :cy="C" :r="R" class="dark" />
    <g class="earthshine">
      <ellipse v-for="(m, i) in seas" :key="i" v-bind="m" />
    </g>
    <circle v-if="lit" :cx="C" :cy="C" :r="R" class="lit" :mask="`url(#${maskId})`" />
  </svg>
</template>

<style scoped>
.moon {
  display: inline-block;
  flex: none;
  vertical-align: -0.15em;
}

.dark {
  fill: currentColor;
  opacity: 0.18;
}

/* Maria on the night side, darker than the earthshine around them: a thin crescent
   then still shows the whole face, the way it does through binoculars. */
.earthshine {
  fill: var(--void);
  opacity: 0.2;
}

.lit {
  fill: currentColor;
}
</style>
