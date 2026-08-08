<script setup lang="ts">
/**
 * The divider between the map and the readout.
 *
 * A window splitter in ARIA terms: focusable, with arrow keys, because a drag is
 * the one interaction this app cannot assume — it is used outdoors, one-handed, in
 * the cold, and often through a phone case. Home and End jump to the extremes.
 *
 * The hit area is deliberately wider than the visible line. A 1px rule is the right
 * amount of ink and the wrong amount of target.
 */
import type { PanelPlacement } from '@/lib/panelLayout'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  placement: PanelPlacement
  size: number
  min: number
  max: number
  dragging: boolean
}>()

const emit = defineEmits<{
  start: [PointerEvent]
  nudge: [-1 | 1, boolean]
  jump: ['min' | 'max']
}>()

/**
 * Which arrow grows the panel depends on where it sits: to the right of the map,
 * left grows it; below the map, up grows it.
 */
function onKey(event: KeyboardEvent) {
  const fine = event.shiftKey
  const grow = props.placement === 'beside' ? 'ArrowLeft' : 'ArrowUp'
  const shrink = props.placement === 'beside' ? 'ArrowRight' : 'ArrowDown'

  if (event.key === grow) emit('nudge', 1, fine)
  else if (event.key === shrink) emit('nudge', -1, fine)
  else if (event.key === 'Home') emit('jump', 'max')
  else if (event.key === 'End') emit('jump', 'min')
  else return

  event.preventDefault()
}
</script>

<template>
  <div
    class="resizer"
    role="separator"
    tabindex="0"
    :aria-orientation="placement === 'beside' ? 'vertical' : 'horizontal'"
    :aria-label="t('panel.resize')"
    :aria-valuenow="Math.round(size)"
    :aria-valuemin="Math.round(min)"
    :aria-valuemax="Math.round(max)"
    :class="[placement, { dragging }]"
    @pointerdown="emit('start', $event)"
    @keydown="onKey"
  >
    <span class="grip" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.resizer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel);
  touch-action: none;
}

.resizer.beside {
  width: 0.5rem;
  cursor: col-resize;
  border-left: var(--rule);
}

.resizer.below {
  height: 0.5rem;
  cursor: row-resize;
  border-top: var(--rule);
}

/*
 * The visible line is thin; the target is not. This pseudo-element reaches past the
 * divider into both neighbours so a fingertip finds it, which a 0.5rem strip alone
 * would not allow at arm's length in the dark.
 */
.resizer::before {
  content: '';
  position: absolute;
  inset: 0;
}

.resizer.beside::before {
  inset: 0 -0.3125rem;
}

.resizer.below::before {
  inset: -0.3125rem 0;
}

.grip {
  border-radius: 999px;
  background: var(--haze);
  opacity: 0.45;
  transition: opacity 0.12s ease, background-color 0.12s ease;
}

.resizer.beside .grip {
  width: 2px;
  height: 1.75rem;
}

.resizer.below .grip {
  width: 1.75rem;
  height: 2px;
}

.resizer:hover .grip,
.resizer:focus-visible .grip,
.resizer.dragging .grip {
  background: var(--azure);
  opacity: 1;
}

/* While dragging the pointer is captured, so the grip stays lit past the divider. */
.resizer.dragging {
  background: var(--panel-raised);
}

.resizer:focus-visible {
  outline: 2px solid var(--azure);
  outline-offset: -2px;
}
</style>
