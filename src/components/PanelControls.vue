<script setup lang="ts">
/**
 * The panel's layout, chosen from pictures of the three layouts.
 *
 * Its own component because this belongs to the panel *container*, not to the spot
 * readout. It lived inside SpotPanel, which is not rendered before a point is
 * picked, so maximizing with nothing selected hid the map behind a panel that had
 * no way to shrink, and the state persisted, so a reload did not clear it either.
 * Anything that can occupy the panel column has to carry this.
 *
 * Built like the tab strip, and for the same reason: the current layout is a raised
 * fill rather than a colour, because --accent sits too close to the text to carry a
 * state alone. Showing all three, with the current one pressed, replaced two
 * direction buttons whose meaning depended on which state you were already in.
 */
import type { PanelPlacement, PanelState } from '@/lib/panelLayout'
import type { IconName } from '@/lib/icons'
import { useI18n } from '@/composables/useI18n'
import Icon from './Icon.vue'

const { t } = useI18n()

const props = defineProps<{
  state: PanelState
  /** Only decides which way the pictures face. */
  placement: PanelPlacement
}>()

const emit = defineEmits<{ minimize: []; restore: []; maximize: [] }>()

const OPTIONS: { state: PanelState; icon: IconName; label: string }[] = [
  { state: 'minimized', icon: 'panelRail', label: 'panel.minimize' },
  { state: 'normal', icon: 'panelSplit', label: 'panel.restore' },
  { state: 'maximized', icon: 'panelFull', label: 'panel.maximize' },
]

/** Pressing the layout you are already in does nothing, rather than toggling out of it. */
function choose(next: PanelState) {
  if (next === props.state) return
  if (next === 'minimized') emit('minimize')
  else if (next === 'maximized') emit('maximize')
  else emit('restore')
}
</script>

<template>
  <div class="layout-picker" role="group" :aria-label="t('panel.layoutLabel')">
    <button
      v-for="option in OPTIONS"
      :key="option.state"
      type="button"
      :class="{ stacked: placement === 'below' }"
      :aria-pressed="state === option.state"
      :aria-label="t(option.label)"
      :title="t(option.label)"
      @click="choose(option.state)"
    >
      <Icon :name="option.icon" :size="1.25" />
    </button>
  </div>
</template>

<style scoped>
.layout-picker {
  display: flex;
  flex: none;
  padding: 0.25rem;
  border-radius: var(--radius);
  background: var(--void);
}

button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.25rem;
  border-radius: 0.5625rem;
  color: var(--haze);
}

/* The visible cell is 36px tall so the strip sits beside a heading without
   outweighing it; the hit area still reaches 44px. */
button::after {
  content: '';
  position: absolute;
  inset: -0.25rem 0;
}

button:hover {
  color: var(--star);
}

/* Inset, because the cells touch: the default 2px offset drew over the neighbour. */
button:focus-visible {
  outline-offset: -2px;
}

button[aria-pressed='true'] {
  background: var(--panel-raised);
  color: var(--accent);
  cursor: default;
}

/* Stacked, the panel is below the map, so the pictures turn to put it there. */
button.stacked .icon {
  transform: rotate(90deg);
}
</style>
