<script setup lang="ts">
/**
 * The verdict: should you go tonight, and what is holding it back.
 *
 * Lives in SpotPanel's sticky head rather than in the Skor tab, so it stays in view
 * on every tab. It used to sit inside ScoreTab, and switching to Langit or Cuaca to
 * check *why* the rating was low took the rating itself off screen.
 */
import { computed, ref, watch } from 'vue'
import type { Score } from '@/types'
import { ratingText, limitingFactorText } from '@/lib/scoring'
import { FACTOR_ICONS } from '@/lib/icons'
import { formatAtOffset, timezoneLabel } from '@/lib/time'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t, tx } = useI18n()

const props = defineProps<{ score: Score; offsetMinutes: number }>()

/**
 * "01:00–04:00 WIB" when the rating is for part of the night. Without it, a 5 earned
 * by the clear hours after 01:00 would read as a promise about 20:00.
 */
const bestRange = computed(() => {
  const stretch = props.score.stretch
  if (!stretch || stretch.wholeNight) return null
  const from = formatAtOffset(stretch.start, props.offsetMinutes)
  const to = formatAtOffset(stretch.end, props.offsetMinutes)
  return `${from}–${to} ${timezoneLabel(props.offsetMinutes)}`
})

/**
 * Marks the moment the forecast lands.
 *
 * The rating renders immediately from light pollution and the moon, and reads
 * *higher* while it is provisional because a missing term is dropped rather than
 * guessed. When cloud cover arrives the number can therefore fall while the reader
 * is looking straight at it. Left unmarked that reads as a misread; marked, it reads
 * as an arrival. Fires only on the false-to-true edge, so re-picking a point does
 * not set it off -- the pin's own drop already acknowledges that.
 */
const settling = ref(false)
watch(
  () => props.score.complete,
  (isComplete, was) => {
    if (isComplete === true && was === false) settling.value = true
  },
)
</script>

<template>
  <section class="verdict" :class="{ settling }" @animationend="settling = false">
    <!-- The figure first, large, for a glance at arm's length; the stars beneath it
         are the same number as a picture, and the app's namesake. -->
    <div class="rating" role="img" :aria-label="t('score.ratingAria', { rating: score.rating })">
      <p class="numeric value" aria-hidden="true">
        {{ score.rating }}<span class="of">/5</span>
      </p>
      <p class="stars" aria-hidden="true">
        <Icon
          v-for="n in 5"
          :key="n"
          name="star"
          :size="0.8"
          class="star"
          :class="{ lit: n <= score.rating }"
        />
      </p>
    </div>

    <div class="verdict-text">
      <p class="label">{{ tx(ratingText(score.rating)) }}</p>
      <p v-if="bestRange" class="reason">{{ t('score.bestStretch', { range: bestRange }) }}</p>
      <p v-if="limitingFactorText(score)" class="reason limit">
        <!-- Names the culprit before the sentence does. -->
        <Icon :name="FACTOR_ICONS[score.limitingFactor!.key]" :size="1.1" />
        {{ tx(limitingFactorText(score)!) }}
      </p>
      <p v-else-if="score.complete" class="reason good">{{ t('score.nothingLimiting') }}</p>
      <p v-if="!score.complete" class="reason provisional">{{ t('score.provisional') }}</p>
    </div>
  </section>
</template>

<style scoped>
.verdict {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
}

/* Transform and opacity only. Flashing the background would animate a token, and
   field mode exists precisely so that nothing changes colour unasked. */
.verdict.settling {
  animation: verdict-settle 180ms ease-out;
}

@keyframes verdict-settle {
  from {
    opacity: 0.5;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.rating {
  display: grid;
  justify-items: center;
  gap: 0.25rem;
}

.value {
  margin: 0;
  font-size: 3.25rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
}

.of {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--haze);
}

.stars {
  display: flex;
  gap: 0.125rem;
  margin: 0;
  line-height: 1;
}

/* Unlit stars are the same glyph, faint -- not a second outline drawing, which at
   this size would read as a different shape rather than an absent one. */
.star {
  color: var(--star);
  opacity: 0.22;
}

.star.lit {
  opacity: 1;
}

.verdict-text {
  display: grid;
  justify-items: start;
  gap: 0.375rem;
  min-width: 0;
}

.label {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
  text-wrap: balance;
}

.reason {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--haze);
}

/* The limiting factor as a chip: it is the one thing on this panel that needs
   attention, so it is the one thing given a filled shape. */
.reason.limit {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--ember) 13%, transparent);
  color: var(--ember);
}

.reason.good {
  color: var(--clear);
}

.reason.provisional {
  color: var(--ember);
}
</style>
