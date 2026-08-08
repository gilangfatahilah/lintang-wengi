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
import { computed } from 'vue'
import type { MoonPhaseKey } from '@/types'
import { litPath } from '@/lib/moonShape'

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
    <!-- The unlit disc stays visible so a thin crescent still reads as a moon
         rather than as a stray sliver. -->
    <circle :cx="C" :cy="C" :r="R" class="dark" />
    <path v-if="lit" :d="lit" class="lit" />
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

.lit {
  fill: currentColor;
}
</style>
