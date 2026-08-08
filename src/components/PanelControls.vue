<script setup lang="ts">
/**
 * Collapse and expand, for whatever the panel column currently holds.
 *
 * Its own component because these belong to the panel *container*, not to the spot
 * readout. They lived inside SpotPanel, which is not rendered before a point is
 * picked — so maximizing with nothing selected hid the map behind a panel that had
 * no way to shrink, and the state persisted, so a reload did not clear it either.
 * Anything that can occupy the panel column has to carry these.
 */
import type { PanelPlacement, PanelState } from '@/lib/panelLayout'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t } = useI18n()

defineProps<{
  state: PanelState
  /** Only decides which way the arrows point. */
  placement: PanelPlacement
}>()

defineEmits<{ minimize: []; maximize: [] }>()
</script>

<template>
  <div class="window-controls">
    <button
      type="button"
      :class="{ stacked: placement === 'below' }"
      :aria-label="t('panel.minimize')"
      :title="t('panel.minimize')"
      @click="$emit('minimize')"
    >
      <Icon name="collapse" :size="1.15" />
    </button>
    <button
      type="button"
      :class="{ stacked: placement === 'below' }"
      :aria-pressed="state === 'maximized'"
      :aria-label="t(state === 'maximized' ? 'panel.restore' : 'panel.maximize')"
      :title="t(state === 'maximized' ? 'panel.restore' : 'panel.maximize')"
      @click="$emit('maximize')"
    >
      <Icon :name="state === 'maximized' ? 'restore' : 'expand'" :size="1.15" />
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  flex: none;
  gap: 0.125rem;
  /* Pulled up to sit on the neighbouring title's cap height rather than below it. */
  margin-top: -0.125rem;
}

button {
  display: flex;
  padding: 0.25rem;
  color: var(--haze);
}

button:hover,
button[aria-pressed='true'] {
  color: var(--azure);
}

/*
 * Beside the map the panel is to the right, so the arrows point that way as drawn.
 * Stacked, the panel is below, and the same glyphs turn a quarter turn to keep
 * meaning "toward the edge the panel lives on".
 */
button.stacked .icon {
  transform: rotate(90deg);
}
</style>
