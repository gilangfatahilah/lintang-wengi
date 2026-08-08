<script setup lang="ts">
/**
 * One glyph from `ICONS`, sized in `em` so it tracks the type it sits beside.
 *
 * Hidden from assistive technology by default: every icon in this app is placed
 * next to the words it illustrates, so announcing it would read the same fact
 * twice. Pass `label` only where an icon genuinely stands alone.
 */
import { computed } from 'vue'
import { ICONS, type IconName } from '@/lib/icons'

const props = withDefaults(
  defineProps<{
    name: IconName
    /** Multiple of the current font size. */
    size?: number
    label?: string
  }>(),
  { size: 1.15, label: undefined },
)

const markup = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="currentColor"
    :style="{ width: `${size}em`, height: `${size}em` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    v-html="markup"
  />
</template>

<style scoped>
.icon {
  display: inline-block;
  flex: none;
  /* Sits on the text baseline rather than hanging below it. */
  vertical-align: -0.15em;
}
</style>
