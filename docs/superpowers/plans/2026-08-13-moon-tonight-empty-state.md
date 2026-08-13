# Moon Tonight — Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The panel answers the half of "is tonight worth it?" that needs no location — tonight's moon phase and illumination — instead of standing empty until a point is picked.

**Architecture:** A new pure module `src/lib/moonTonight.ts` exposes only the geocentric moon facts (illumination, phase key) plus the band of copy they map to, deliberately excluding rise/set and time-above-horizon because those need a location. A small presentational component renders it inside the existing empty `<aside>` in `App.vue`. No change to the picked-point path, no change to scoring.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, `astronomy-engine`, Vitest.

**Spec:** This document's Background section, agreed in session 2026-08-13. Product framing lives in [`PLAN.md`](../../../PLAN.md); the design rules this must obey are in [`CLAUDE.md`](../../../CLAUDE.md).

---

## Background

The empty state is the first screen every visitor sees: a 400×850 column holding one heading and one paragraph, beside a map. Measured on the score tab, the panel also had 155px of dead space — that half was a CSS bug and is already fixed in `8a74c5b`. What remains is not a spacing problem but an answering problem.

The app scores three inputs. Two of them — light pollution and BMKG cloud cover — are meaningless without a location. **The moon's phase and illuminated fraction are geocentric: at a given instant they are the same number for every observer on Earth.** So the app can state them honestly before it knows anything about the user, and they frequently decide whether going out is worth it at all.

What must *not* appear there: moonrise, moonset, and the fraction of the night the moon is above the horizon. Those vary across the archipelago by tens of minutes and are exactly what the existing `app.intro` copy already promises to compute once a point is picked.

## Global Constraints

Copied from `CLAUDE.md`; every task's requirements implicitly include these.

- **`src/lib/` must never return a user-facing sentence.** Domain code returns `I18nText` (`{ key, params }`) or a message key; the render layer resolves it.
- **All domain logic is pure functions in `src/lib/`, unit-tested with no DOM, no network, no map.** Vue components only render.
- **UI chrome copy goes in `src/locales/{en,id}.ts`.** `en.ts` is canonical and `Messages` is a widened `typeof en`, so a key added to `en.ts` but missing from `id.ts` fails `pnpm typecheck`. **Do not add `as const` to `en.ts`.**
- **Every colour must come from an existing token**, because `:root[data-field='true']` remaps the whole set and one unmapped colour makes field mode decorative rather than functional.
- **Do not use `:global(...)` as the first compound selector in a scoped block.**
- Commands: `pnpm test`, `pnpm typecheck`, `pnpm dev`. Deploy is `pnpm deploy:cf` (not `pnpm deploy` — pnpm shadows that name).
- Commit messages: imperative subject, body explaining *why*, ending with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/moonTonight.ts` *(create)* | Pure. Which instant "tonight" means, the two geocentric moon facts at that instant, and which copy band an illumination falls in. Exports no sentences. |
| `src/lib/moonTonight.test.ts` *(create)* | Unit tests: band boundaries, the local-midnight pivot, and two ephemeris anchors. |
| `src/locales/en.ts` *(modify)* | New `moonTonight` block: heading plus four band strings. |
| `src/locales/id.ts` *(modify)* | Same keys in Indonesian. Missing keys fail typecheck. |
| `src/components/MoonTonight.vue` *(create)* | Renders the block: glyph, phase name, percentage, one line of meaning. No computation beyond calling the lib. |
| `src/App.vue` *(modify)* | Renders `<MoonTonight />` inside the existing empty `<aside class="empty">`. |
| `CLAUDE.md` *(modify)* | Records why only the geocentric half is shown, so nobody later "completes" it with rise/set. |

Why a new module rather than adding to `astro.ts`: every existing function there takes a `LatLng`. The whole point of this one is that it does not, and `moonCalendar.ts` is the precedent for a focused moon module beside `astro.ts`.

---

### Task 1: The pure module

**Files:**
- Create: `src/lib/moonTonight.ts`
- Test: `src/lib/moonTonight.test.ts`

**Interfaces:**
- Consumes: `phaseKeyOf(phaseAngle: number): MoonPhaseKey` from `src/lib/astro.ts:124`; `MoonPhaseKey` from `src/types.ts:98`.
- Produces:
  - `interface MoonTonight { illumination: number; phaseKey: MoonPhaseKey }`
  - `tonightMidnight(now: Date, offsetMinutes: number): Date`
  - `moonTonight(now: Date, offsetMinutes: number): MoonTonight`
  - `moonBrightnessKey(illumination: number): string`

- [x] **Step 1: Write the failing test**

Create `src/lib/moonTonight.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tonightMidnight, moonTonight, moonBrightnessKey } from './moonTonight'

const WIB = 420

describe('tonightMidnight', () => {
  it('takes the coming midnight when the viewer is in the afternoon or evening', () => {
    // 2026-08-13 10:00Z is 17:00 WIB. The night being asked about starts tonight,
    // so the anchor is 2026-08-14 00:00 WIB = 2026-08-13 17:00Z.
    expect(tonightMidnight(new Date('2026-08-13T10:00:00Z'), WIB).toISOString()).toBe(
      '2026-08-13T17:00:00.000Z',
    )
  })

  it('keeps the night already underway when the viewer is past midnight', () => {
    // 2026-08-13 19:00Z is 02:00 WIB on the 14th -- standing inside that night, so
    // the anchor is the midnight just passed, not the next one.
    expect(tonightMidnight(new Date('2026-08-13T19:00:00Z'), WIB).toISOString()).toBe(
      '2026-08-13T17:00:00.000Z',
    )
  })

  it('pivots at local noon', () => {
    const before = tonightMidnight(new Date('2026-08-13T04:59:00Z'), WIB) // 11:59 WIB
    const after = tonightMidnight(new Date('2026-08-13T05:01:00Z'), WIB) // 12:01 WIB
    expect(after.getTime() - before.getTime()).toBe(86_400_000)
  })

  it('works for a negative offset without landing on the wrong day', () => {
    // 2026-08-13 02:00Z is 2026-08-12 21:00 at -05:00, an evening, so the anchor is
    // 2026-08-13 00:00 local = 2026-08-13 05:00Z.
    expect(tonightMidnight(new Date('2026-08-13T02:00:00Z'), -300).toISOString()).toBe(
      '2026-08-13T05:00:00.000Z',
    )
  })
})

describe('moonTonight', () => {
  // Anchored to numbers this app already prints for these dates, so the test fails
  // if the ephemeris call or the instant it is made at ever changes.
  it('reads the new moon of 2026-08-13', () => {
    const m = moonTonight(new Date('2026-08-13T10:00:00Z'), WIB)
    expect(m.phaseKey).toBe('new')
    expect(m.illumination).toBeLessThan(0.05)
  })

  it('reads the waning crescent of 2026-08-08', () => {
    const m = moonTonight(new Date('2026-08-08T10:00:00Z'), WIB)
    expect(m.phaseKey).toBe('waningCrescent')
    expect(m.illumination).toBeGreaterThan(0.18)
    expect(m.illumination).toBeLessThan(0.27)
  })

  it('always returns a fraction, never a percentage', () => {
    for (const day of ['2026-08-01', '2026-08-09', '2026-08-17', '2026-08-25']) {
      const m = moonTonight(new Date(`${day}T10:00:00Z`), WIB)
      expect(m.illumination).toBeGreaterThanOrEqual(0)
      expect(m.illumination).toBeLessThanOrEqual(1)
    }
  })
})

describe('moonBrightnessKey', () => {
  it('maps each band to its own key', () => {
    expect(moonBrightnessKey(0)).toBe('moonTonight.dark')
    expect(moonBrightnessKey(0.14)).toBe('moonTonight.dark')
    expect(moonBrightnessKey(0.15)).toBe('moonTonight.thin')
    expect(moonBrightnessKey(0.44)).toBe('moonTonight.thin')
    expect(moonBrightnessKey(0.45)).toBe('moonTonight.half')
    expect(moonBrightnessKey(0.74)).toBe('moonTonight.half')
    expect(moonBrightnessKey(0.75)).toBe('moonTonight.bright')
    expect(moonBrightnessKey(1)).toBe('moonTonight.bright')
  })

  it('returns a key, never a sentence', () => {
    for (const v of [0, 0.3, 0.6, 0.9]) {
      expect(moonBrightnessKey(v)).toMatch(/^moonTonight\.[a-z]+$/)
    }
  })
})
```

- [x] **Step 2: Run the test and watch it fail**

Run: `pnpm vitest run src/lib/moonTonight.test.ts`
Expected: FAIL — `Failed to resolve import "./moonTonight"`.

- [x] **Step 3: Write the module**

Create `src/lib/moonTonight.ts`:

```ts
/**
 * The moon, before a point has been picked.
 *
 * Phase and illumination are geocentric: at a given instant they are the same number
 * for every observer on Earth, which is exactly why they can be stated before the app
 * knows where the user is. Moonrise, moonset and the fraction of the night the moon
 * spends above the horizon are not -- those need a location, they vary by tens of
 * minutes across the archipelago, and `app.intro` already promises them once a point
 * is picked. This module exposes only the two that travel; do not add the others.
 */
import * as A from 'astronomy-engine'
import { phaseKeyOf } from './astro'
import type { MoonPhaseKey } from '@/types'

export interface MoonTonight {
  /** Illuminated fraction, 0-1. */
  illumination: number
  /** Which of the eight principal phases, as a message key suffix. */
  phaseKey: MoonPhaseKey
}

/**
 * The instant "tonight" is evaluated at: the midnight belonging to the night the
 * viewer is either standing in or about to have.
 *
 * Illumination moves by up to seven points a day, so evaluating at "now" would print
 * a breakfast number under the word "tonight". Local noon is the pivot -- before it,
 * the night in question is the one that began at the midnight just passed; after it,
 * the one starting at the coming midnight.
 *
 * `offsetMinutes` is the viewer's own UTC offset, not a location's. It only decides
 * which midnight is meant, and that choice is insensitive to being an hour or two out.
 */
export function tonightMidnight(now: Date, offsetMinutes: number): Date {
  const local = new Date(now.getTime() + offsetMinutes * 60_000)
  const localDayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const localMidnight = local.getUTCHours() >= 12 ? localDayStart + 86_400_000 : localDayStart
  return new Date(localMidnight - offsetMinutes * 60_000)
}

/** Tonight's moon, for a viewer whose only known coordinate is their clock. */
export function moonTonight(now: Date, offsetMinutes: number): MoonTonight {
  const at = tonightMidnight(now, offsetMinutes)
  return {
    illumination: A.Illumination(A.Body.Moon, at).phase_fraction,
    phaseKey: phaseKeyOf(A.MoonPhase(at)),
  }
}

/**
 * What this much moon costs you, as a message key.
 *
 * Four bands rather than eight: the principal phase name is already printed beside
 * this line, so an eight-way second vocabulary would only repeat it. What changes the
 * decision is roughly none / a little / a lot / forget the faint things.
 *
 * Says nothing about when the moon is up, which is the half that needs a location.
 */
export function moonBrightnessKey(illumination: number): string {
  if (illumination < 0.15) return 'moonTonight.dark'
  if (illumination < 0.45) return 'moonTonight.thin'
  if (illumination < 0.75) return 'moonTonight.half'
  return 'moonTonight.bright'
}
```

- [x] **Step 4: Run the test and watch it pass**

Run: `pnpm vitest run src/lib/moonTonight.test.ts`
Expected: PASS, 9 tests.

If the two ephemeris anchors fail, do **not** loosen them until you have checked the dates against the running app — they were taken from its own output on those days.

- [x] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no output, exit 0.

- [x] **Step 6: Commit**

```bash
git add src/lib/moonTonight.ts src/lib/moonTonight.test.ts
git commit -m "$(cat <<'EOF'
Compute the half of tonight that needs no location

Phase and illuminated fraction are geocentric -- the same number for
every observer on Earth at a given instant -- so they can be stated
before the app knows where the user is. Rise, set and time above the
horizon cannot, and are deliberately absent rather than merely unused.

Evaluated at the midnight of the night being asked about rather than at
"now", pivoting on local noon, because illumination moves by up to seven
points a day and a breakfast number printed under the word "tonight"
would simply be wrong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The block on the empty screen

**Files:**
- Modify: `src/locales/en.ts` (after the `app` block, which ends at line 15)
- Modify: `src/locales/id.ts` (matching position)
- Create: `src/components/MoonTonight.vue`
- Modify: `src/App.vue:258-269` (the `<aside class="empty">` branch)
- Modify: `CLAUDE.md` (Design section)

**Interfaces:**
- Consumes: `moonTonight`, `moonBrightnessKey` from Task 1; `MoonGlyph.vue` (props `illumination: number`, `phaseKey: MoonPhaseKey`, `size: number` — see its use in `NightBar.vue`); `useI18n()` returning `{ t }`.
- Produces: `MoonTonight.vue`, a component taking one optional prop `now?: Date` (injectable so the block can be driven to a known date when checking it in a browser).

- [x] **Step 1: Add the English copy**

In `src/locales/en.ts`, immediately after the closing `},` of the `app` block:

```ts
  moonTonight: {
    heading: 'Moon tonight',
    dark: 'Near new. The sky will not get darker than this all month.',
    thin: 'A thin moon. Faint targets stay within reach.',
    half: 'Half lit. The Milky Way dims wherever this moon is up.',
    bright: 'A bright moon. Little that is faint survives it.',
  },
```

- [x] **Step 2: Add the Indonesian copy**

In `src/locales/id.ts`, at the matching position:

```ts
  moonTonight: {
    heading: 'Bulan malam ini',
    dark: 'Nyaris bulan baru. Langit tidak akan lebih gelap dari ini sebulan penuh.',
    thin: 'Bulan tipis. Objek samar masih terjangkau.',
    half: 'Separuh bercahaya. Milky Way meredup selama bulan berada di atas horizon.',
    bright: 'Bulan terang. Nyaris tidak ada yang samar bertahan.',
  },
```

- [x] **Step 3: Prove the typecheck catches a missing translation**

Temporarily delete the `bright` line from `id.ts` and run `pnpm typecheck`.
Expected: FAIL naming `bright`. Put the line back and confirm it passes. This is the guard that keeps the two dictionaries in step; verify it works rather than assuming it.

- [x] **Step 4: Write the component**

Create `src/components/MoonTonight.vue`:

```vue
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
    <h2 class="eyebrow">{{ t('moonTonight.heading') }}</h2>
    <p class="phase">
      <MoonGlyph
        :illumination="moon.illumination"
        :phase-key="moon.phaseKey"
        :size="1.6"
        class="glyph"
      />
      <span class="numeric name">{{ t('moon.phase.' + moon.phaseKey) }}</span>
      <span class="numeric pct">{{ percent }}%</span>
    </p>
    <p class="meaning">{{ t(moonBrightnessKey(moon.illumination)) }}</p>
  </section>
</template>

<style scoped>
.moon-tonight {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: var(--rule);
}

.phase {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0 0.375rem;
}

.name {
  color: var(--star);
  font-size: 1rem;
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
```

- [x] **Step 5: Render it in the empty panel**

In `src/App.vue`, inside `<div class="empty-text">`, after the two existing paragraphs:

```vue
          <div class="empty-text">
            <p class="lede">{{ t('app.tagline') }}</p>
            <p class="sub">{{ t('app.intro') }}</p>
            <MoonTonight />
          </div>
```

And with the other component imports near `src/App.vue:19`:

```ts
import MoonTonight from './components/MoonTonight.vue'
```

- [x] **Step 6: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass (233 + 9 = 242), typecheck silent.

- [x] **Step 7: Look at it, in four states**

Run `pnpm dev`, then with **no point picked** check:

1. **English, 1440px** — the block sits under the intro, the glyph's lit fraction visibly matches the printed percentage, and the meaning line matches the band.
2. **Indonesian** — switch with the ID button. No English survives, no raw key like `moonTonight.thin` renders. `translate` returns unknown keys unchanged, so a missing key shows as the key itself rather than as an error.
3. **Field mode** — no blue anywhere. Verify by computed style, not by eye:
   ```js
   [...document.querySelectorAll('.moon-tonight *')].flatMap((el) => {
     const cs = getComputedStyle(el)
     return ['color', 'backgroundColor', 'borderTopColor', 'fill'].map((k) => cs[k])
   }).filter((v) => { const m = /rgba?\(([^)]+)\)/.exec(v); if (!m) return false
     const [r, g, b] = m[1].split(',').map(parseFloat); return b > r + 12 && b > g + 12 })
   ```
   Expected: `[]`.
4. **390px wide, and maximized** — the block wraps without horizontal overflow, and at full width the meaning line is held by its `max-width` rather than running the width of the window.

- [x] **Step 8: Record the rule in CLAUDE.md**

In the Design section, after the `MoonGlyph.vue` paragraph:

```markdown
**The empty state answers what does not need a location.** Phase and illuminated fraction are geocentric — the same number for every observer on Earth at a given instant — so `MoonTonight.vue` can state them before a point is picked. Moonrise, moonset and time-above-horizon are not, vary by tens of minutes across the archipelago, and belong to the readout that appears after a click. `src/lib/moonTonight.ts` exposes only the two that travel; completing the set is the mistake it exists to prevent.
```

- [x] **Step 9: Commit**

```bash
git add src/locales/en.ts src/locales/id.ts src/components/MoonTonight.vue src/App.vue CLAUDE.md
git commit -m "$(cat <<'EOF'
Answer tonight's moon before a point is picked

The first screen everyone sees was a heading and a paragraph in a 400px
column beside a full-height map -- an app that answers nothing until it
is clicked, despite one of its three inputs not depending on where you
are.

Phase and illumination are the same for every observer on Earth, so the
empty panel now states them: glyph, phase, percentage, and one line on
what that costs. Rise and set stay out. They shift by tens of minutes
across the archipelago, and app.intro already promises them for the spot
you choose.

Four bands of copy rather than eight, because the phase name is printed
beside the line and a second eight-way vocabulary would only repeat it.

Checked in both languages, in field mode with a computed-style scan for
blue, at 390px and maximized.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage.** Show tonight's moon phase and illumination in the empty state → Task 2 Steps 4–5. Compute them without a location → Task 1. Exclude rise/set and time-above-horizon → enforced by the module's exports, stated in its header comment, in `CLAUDE.md` (Task 2 Step 8), and by the absence of any locale string that could carry them. Bilingual → Task 2 Steps 1–3, with Step 3 verifying the typecheck guard actually fires. Field mode → Task 2 Step 7.3. Responsive → Step 7.4.

**Placeholder scan.** No TBDs. Every code step carries the code. Every test step names the command and the expected result.

**Type consistency.** `moonTonight(now, offsetMinutes)` is called with both arguments in the component and in every test. `MoonTonight.illumination` is a 0–1 fraction everywhere; the percentage exists only in the component. `moonBrightnessKey` returns `string` and every returned value has a matching key in both dictionaries: `dark`, `thin`, `half`, `bright`. `phaseKeyOf` is imported from `astro.ts`, not reimplemented, so the eight phase names already in `moon.phase.*` keep working.

**Known risk.** The two ephemeris anchors in Task 1 assert real sky. They came from this app's own output on 2026-08-08 and 2026-08-13. If a future `astronomy-engine` upgrade shifts them, that is a signal worth reading, not a test to relax.
