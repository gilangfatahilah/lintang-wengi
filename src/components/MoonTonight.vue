<script setup lang="ts">
/**
 * Tonight's moon, before a point is picked.
 *
 * The empty panel used to hold one heading and one paragraph beside a full-height
 * map. Two of the three things this app scores are meaningless without a location,
 * but the moon's phase is not -- so this is the part of "is tonight worth it?" that
 * can be answered on arrival.
 *
 * Nothing here is location-dependent, and nothing here may become so: rise and set
 * times belong to the readout that appears after a point is chosen.
 */
import { computed } from 'vue'
import { moonTonight, moonBrightnessKey } from '@/lib/moonTonight'
import { useI18n } from '@/composables/useI18n'
import MoonGlyph from './MoonGlyph.vue'

const { t } = useI18n()

/** Injectable so a known night can be driven in a browser check. */
const props = defineProps<{ now?: Date }>()

const moon = computed(() => moonTonight(props.now ?? new Date(), -new Date().getTimezoneOffset()))
const percent = computed(() => Math.round(moon.value.illumination * 100))
</script>

<template>
  <section class="moon-tonight">
    <h2 class="label-quiet">{{ t('moonTonight.heading') }}</h2>
    <p class="phase">
      <MoonGlyph
        :illumination="moon.illumination"
        :phase-key="moon.phaseKey"
        :size="2.75"
        class="glyph"
      />
      <span class="name">{{ t('moon.phase.' + moon.phaseKey) }}</span>
      <span class="numeric pct">{{ percent }}%</span>
    </p>
    <p class="meaning">{{ t(moonBrightnessKey(moon.illumination)) }}</p>
  </section>
</template>

<style scoped>
.moon-tonight {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: var(--rule-section);
}

.phase {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0 0.5rem;
}

.name {
  font-family: var(--font-display);
  font-size: 1.375rem;
  color: var(--star);
}

.pct {
  color: var(--haze);
  font-size: 1rem;
}

.meaning {
  margin: 0;
  max-width: 34rem;
  color: var(--haze);
  line-height: 1.55;
}
</style>
