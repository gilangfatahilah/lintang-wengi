import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import {
  BOUNDS,
  clampPanelSize,
  isPanelState,
  nudgePanelSize,
  panelSizeFromPointer,
  resolvePanelSize,
  toggleMaximized,
  toggleMinimized,
  RESIZE_STEP,
  RESIZE_STEP_FINE,
  type PanelPlacement,
  type PanelState,
} from '@/lib/panelLayout'

/**
 * Must match the `@media (max-width: 52rem)` breakpoint in App.vue, which is where
 * the panel actually moves from beside the map to below it. Two sources of truth,
 * unavoidably — CSS decides the layout, JS decides which minimums apply to it.
 */
const STACKED_QUERY = '(max-width: 52rem)'

const SIZE_KEY: Record<PanelPlacement, string> = {
  beside: 'lw.panel.width',
  below: 'lw.panel.height',
}
const STATE_KEY = 'lw.panel.state'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Private browsing and some embedded webviews throw rather than returning null.
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The preference will not persist; this session still works.
  }
}

export interface PanelLayout {
  state: Ref<PanelState>
  placement: Ref<PanelPlacement>
  /** Panel extent in px along the resize axis: width when beside, height when below. */
  size: Ref<number>
  /** Container extent along the same axis, for the separator's ARIA range. */
  container: Ref<number>
  min: Ref<number>
  max: Ref<number>
  dragging: Ref<boolean>
  /** Bind to the element the panel is measured inside. */
  frame: Ref<HTMLElement | null>
  startDrag(event: PointerEvent): void
  nudge(direction: -1 | 1, fine: boolean): void
  setSize(next: number): void
  minimize(): void
  maximize(): void
  restore(): void
}

export function usePanelLayout(): PanelLayout {
  const frame = ref<HTMLElement | null>(null)
  const placement = ref<PanelPlacement>('beside')
  const container = ref(0)
  const dragging = ref(false)

  const stored = read(STATE_KEY)
  const state = ref<PanelState>(isPanelState(stored) ? stored : 'normal')

  // Seeded from the viewport so the first paint is not a jump: the real container is
  // measured on mount, but a plausible size now beats the default flashing past.
  const size = ref(
    resolvePanelSize(read(SIZE_KEY.beside), window.innerWidth, 'beside'),
  )

  const min = computed(() => BOUNDS[placement.value].minPanel)
  const max = computed(() =>
    Math.max(container.value - BOUNDS[placement.value].minMap, min.value),
  )

  function measure() {
    const el = frame.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    container.value = placement.value === 'beside' ? rect.width : rect.height
    // A window that has just been made narrower can leave the stored size invalid.
    size.value = clampPanelSize(size.value, container.value, placement.value)
  }

  /** Reload the size for a placement, since the two are remembered separately. */
  function adoptPlacement(next: PanelPlacement) {
    placement.value = next
    measure()
    size.value = resolvePanelSize(read(SIZE_KEY[next]), container.value, next)
  }

  function setSize(next: number) {
    size.value = clampPanelSize(next, container.value, placement.value)
    write(SIZE_KEY[placement.value], String(size.value))
  }

  function startDrag(event: PointerEvent) {
    const el = frame.value
    if (!el || state.value !== 'normal') return

    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    dragging.value = true

    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      size.value =
        placement.value === 'beside'
          ? panelSizeFromPointer(e.clientX, rect.left, rect.right, 'beside')
          : panelSizeFromPointer(e.clientY, rect.top, rect.bottom, 'below')
    }

    const end = () => {
      dragging.value = false
      target.releasePointerCapture?.(event.pointerId)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', end)
      target.removeEventListener('pointercancel', end)
      write(SIZE_KEY[placement.value], String(size.value))
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', end)
    target.addEventListener('pointercancel', end)
    event.preventDefault()
  }

  function nudge(direction: -1 | 1, fine: boolean) {
    setSize(
      nudgePanelSize(
        size.value,
        direction,
        container.value,
        placement.value,
        fine ? RESIZE_STEP_FINE : RESIZE_STEP,
      ),
    )
  }

  const minimize = () => (state.value = toggleMinimized(state.value))
  const maximize = () => (state.value = toggleMaximized(state.value))
  const restore = () => (state.value = 'normal')

  watch(state, (next) => write(STATE_KEY, next))

  let media: MediaQueryList | null = null
  let observer: ResizeObserver | null = null
  const onMedia = (e: MediaQueryListEvent) => adoptPlacement(e.matches ? 'below' : 'beside')

  onMounted(() => {
    media = window.matchMedia(STACKED_QUERY)
    media.addEventListener('change', onMedia)
    adoptPlacement(media.matches ? 'below' : 'beside')

    // Catches window resizes and anything else that changes the frame, without
    // guessing at which events those might be.
    observer = new ResizeObserver(measure)
    if (frame.value) observer.observe(frame.value)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', onMedia)
    observer?.disconnect()
  })

  // The frame ref is populated after the first mount tick in some orderings.
  watch(frame, (el) => {
    if (!el || !observer) return
    observer.disconnect()
    observer.observe(el)
    measure()
  })

  return {
    state,
    placement,
    size,
    container,
    min,
    max,
    dragging,
    frame,
    startDrag,
    nudge,
    setSize,
    minimize,
    maximize,
    restore,
  }
}
