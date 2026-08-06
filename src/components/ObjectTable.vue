<script setup lang="ts">
/**
 * What is up tonight, and when to point at it.
 *
 * The three columns are the whole decision: how long it is usable, how high it gets,
 * and which way to face. Objects that never clear the useful altitude are absent
 * rather than greyed out -- a list of things you cannot shoot is noise at 2 AM.
 */
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'
import type { VisibleObject } from '@/types'
import { groupByCategory, compassPoint } from '@/lib/visibility'
import { formatAtOffset } from '@/lib/time'

const { t, pick } = useI18n()

const props = defineProps<{
  entries: readonly VisibleObject[]
  offsetMinutes: number
}>()

const groups = computed(() => groupByCategory(props.entries))

function span(entry: VisibleObject): string {
  const { from, to } = entry.visibility
  if (!from || !to) return '—'
  return `${formatAtOffset(from, props.offsetMinutes)}–${formatAtOffset(to, props.offsetMinutes)}`
}

function magnitude(entry: VisibleObject): string {
  const m = entry.visibility.magnitude
  return m === null ? '—' : m.toFixed(1)
}
</script>

<template>
  <div class="objects">
    <section v-for="group in groups" :key="group.category">
      <h3 class="eyebrow">{{ t(group.labelKey) }}</h3>
      <ul>
        <li v-for="entry in group.entries" :key="entry.object.id">
          <div class="line">
            <span class="name">{{ pick(entry.object.name) }}</span>
            <span class="numeric mag" :title="`Magnitudo ${magnitude(entry)}`">
              {{ magnitude(entry) }}
            </span>
          </div>
          <div class="line facts numeric">
            <span>{{ span(entry) }}</span>
            <span class="sep">·</span>
            <span>{{ Math.round(entry.visibility.maxAltitude) }}°</span>
            <span class="sep">·</span>
            <span>{{ compassPoint(entry.visibility.azimuthAtMax) }}</span>
          </div>
          <p v-if="entry.object.note" class="note">{{ pick(entry.object.note) }}</p>
        </li>
      </ul>
    </section>

    <p v-if="groups.length === 0" class="empty">
      Tidak ada objek katalog yang naik di atas 20° selama malam gelap di sini.
    </p>
  </div>
</template>

<style scoped>
.objects {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h3 {
  margin: 0 0 0.375rem;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: var(--rule);
}

li {
  padding: 0.5rem 0;
  border-bottom: var(--rule);
}

.line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.name {
  font-size: 0.8125rem;
  font-weight: 500;
}

.mag {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--haze);
}

.facts {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--haze);
}

.sep {
  color: var(--ember-dim);
}

.note {
  margin: 0.1875rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--haze);
  opacity: 0.75;
}

.empty {
  margin: 0;
  font-size: 0.75rem;
  color: var(--haze);
}
</style>
