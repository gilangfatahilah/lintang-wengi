<script setup lang="ts">
/**
 * The panel is a shell: place, tabs, and the BMKG attribution. Each tab owns its own
 * content and its own computation, so the expensive sky work only runs once someone
 * asks to see it.
 */
import { computed, ref } from 'vue'
import type { Forecast, LatLng, MoonConditions, NightWindow, Score } from '@/types'
import { approximateOffsetMinutes } from '@/lib/time'
import ScoreTab from './ScoreTab.vue'
import SkyTab from './SkyTab.vue'
import WeatherTab from './WeatherTab.vue'
import Icon from './Icon.vue'
import PanelControls from './PanelControls.vue'
import type { IconName } from '@/lib/icons'
import type { PanelPlacement, PanelState } from '@/lib/panelLayout'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  point: LatLng
  bortle: number | null
  window: NightWindow | null
  moon: MoonConditions | null
  forecast: Forecast | null
  score: Score | null
  forecastState: 'idle' | 'loading' | 'error'
  forecastError: string | null
  distanceKm: number | null
  /** True while the light pollution grid is placeholder data. */
  lpStub: boolean
  panelState: PanelState
  /** Only affects which way the collapse arrows point. */
  panelPlacement: PanelPlacement
}>()

defineEmits<{ minimize: []; maximize: [] }>()

type TabKey = 'skor' | 'langit' | 'cuaca'

const TABS: ReadonlyArray<{ key: TabKey; labelKey: string; icon: IconName }> = [
  { key: 'skor', labelKey: 'panel.tabs.score', icon: 'gauge' },
  { key: 'langit', labelKey: 'panel.tabs.sky', icon: 'galaxy' },
  { key: 'cuaca', labelKey: 'panel.tabs.weather', icon: 'cloud' },
]

/**
 * Deliberately not reset when `point` changes: someone comparing two spots on the
 * Langit tab should not be thrown back to Skor by every click on the map.
 */
const active = ref<TabKey>('skor')

// The forecast carries the location's real offset; until it lands, approximate from
// longitude so displayed times are not silently rendered in the viewer's timezone.
const offset = computed(
  () => props.forecast?.points[0]?.offsetMinutes ?? approximateOffsetMinutes(props.point.lon),
)

const placeName = computed(() => {
  const l = props.forecast?.location
  return l ? `${l.kecamatan}, ${l.kotkab}` : t('panel.resolving')
})

const coords = computed(() => `${props.point.lat.toFixed(4)}°, ${props.point.lon.toFixed(4)}°`)
</script>

<template>
  <aside class="panel">
    <header class="head">
      <div class="titles">
        <h2 class="place">{{ placeName }}</h2>
        <p class="numeric coords">{{ coords }}</p>
      </div>
      <PanelControls
        :state="panelState"
        :placement="panelPlacement"
        @minimize="$emit('minimize')"
        @maximize="$emit('maximize')"
      />
    </header>

    <nav class="tabs" role="tablist" :aria-label="t('panel.tabsLabel')">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="active === tab.key"
        :class="{ on: active === tab.key }"
        @click="active = tab.key"
      >
        <Icon :name="tab.icon" :size="1.3" />
        {{ t(tab.labelKey) }}
      </button>
    </nav>

    <ScoreTab
      v-if="active === 'skor'"
      :point="point"
      :bortle="bortle"
      :window="window"
      :moon="moon"
      :forecast="forecast"
      :score="score"
      :forecast-state="forecastState"
      :forecast-error="forecastError"
      :distance-km="distanceKm"
      :offset-minutes="offset"
    />

    <SkyTab
      v-else-if="active === 'langit'"
      :point="point"
      :bortle="bortle"
      :window="window"
      :moon="moon"
      :forecast="forecast"
      :offset-minutes="offset"
    />

    <WeatherTab
      v-else
      :forecast="forecast"
      :window="window"
      :forecast-state="forecastState"
      :forecast-error="forecastError"
      :offset-minutes="offset"
    />

    <!-- BMKG requires attribution wherever their data is shown. It belongs next to
         the data it describes, not buried in a page footer. -->
    <footer class="attribution">
      <p>
        {{ t('panel.attributionWeather') }}
        <a href="https://data.bmkg.go.id/prakiraan-cuaca/" target="_blank" rel="noopener">
          BMKG
        </a>
        {{ t('panel.attributionAgency') }}
      </p>
      <p class="fine" :class="{ stub: lpStub }">
        {{ lpStub ? t('panel.lpStub') : t('panel.lpReal') }}
      </p>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
  overflow-y: auto;
}

/*
 * A readout column stops getting easier to read past about this width, and the
 * figures start scaling into decoration: NightBar keeps a uniform aspect ratio on
 * purpose, so a panel dragged to 1200px rendered a 400px-tall bar with type to
 * match. Capping here rather than on the graphic keeps every tab in one column.
 */
.panel > * {
  width: 100%;
  max-width: 46rem;
  margin-inline: auto;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.titles {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}


.place {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.coords {
  margin: 0;
  font-size: 0.75rem;
  color: var(--haze);
}

.tabs {
  display: flex;
  gap: 1.25rem;
  margin-bottom: -0.5rem;
  border-bottom: var(--rule);
}

.tabs button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0 0.4375rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--haze);
}

.tabs button.on {
  color: var(--star);
}

/* The rule sits on the nav; the active marker overlaps it rather than shifting it. */
.tabs button.on::after {
  content: '';
  position: absolute;
  inset: auto 0 -1px;
  height: 2px;
  background: var(--azure);
}

/*
 * No `margin-top: auto`. Pushing this to the floor of the panel is what put 155px
 * of nothing between the forecast it credits and the credit itself, which is the
 * opposite of the rule it exists to satisfy: BMKG's attribution belongs next to
 * their data. Blank space below the credit is just a readout that has ended.
 */
.attribution {
  padding-top: 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--haze);
}

.attribution p {
  margin: 0;
}

.attribution a {
  color: var(--star);
  text-decoration-color: var(--azure-dim);
  text-underline-offset: 2px;
}

.fine {
  color: var(--haze);
}

/* Only a caveat while the grid is placeholder data; once it is real this is a
   statement of provenance and has no business looking like a warning. */
.fine.stub {
  color: var(--ember-dim);
}
</style>
