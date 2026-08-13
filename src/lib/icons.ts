/**
 * The app's icon set, drawn here rather than installed.
 *
 * Three things follow from that choice and none of them are incidental:
 *
 * - Everything is `currentColor`, so field mode turns every icon red through the
 *   same token cascade as the text beside it. No second asset, no CSS rule per icon,
 *   and no way for an icon to be the one blue thing left on a red screen.
 * - The glyphs are *filled*, not stroked. They render at 12-14px next to 11-13px
 *   type, and at that size a 1.5px outline is mush -- solid mass survives.
 * - The set is small and specific: a volcano rather than a generic triangle, an
 *   edge-on galaxy rather than a sparkle. Each one names something this app actually
 *   distinguishes, which is why a general-purpose icon library would not have helped.
 *
 * Values are inner-SVG markup rendered through `v-html` in Icon.vue. That is safe
 * here and only here: this is a static local constant that never touches user input,
 * network data, or a BMKG response. Nothing may be appended to it at runtime.
 */
import type { SkyCategory, SubScoreKey } from '@/types'
import type { LandmarkKind } from './landmarks'

export type IconName =
  // Weather, keyed from BMKG's numeric code -- see weather.ts
  | 'sun'
  | 'sun-cloud'
  // Partly cloudy after dark. Clear nights reuse `moon` -- a crescent is a picture
  // of the moon in both places, so a second near-identical glyph would earn nothing.
  | 'moon-cloud'
  | 'cloud'
  | 'overcast'
  | 'haze'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'downpour'
  | 'shower'
  | 'storm'
  // Landmark kinds -- see landmarks.ts
  | 'mountain'
  | 'volcano'
  | 'beach'
  | 'lake'
  | 'plateau'
  | 'island'
  | 'cape'
  | 'park'
  | 'flag'
  | 'district'
  // Sky and score
  | 'glow'
  | 'pin'
  | 'moon'
  | 'galaxy'
  | 'planet'
  | 'star'
  | 'nebula'
  | 'gauge'
  // Controls
  | 'crosshair'
  | 'close'
  | 'layers'
  | 'torch'
  | 'collapse'
  | 'expand'
  | 'restore'

/** Shorthand for the stroked parts of otherwise-filled glyphs. */
const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'

/**
 * A cloud with a flat base, built from three circles and a rectangle whose bottoms
 * all land on the same line. Overlapping filled primitives union for free, which is
 * why the weather glyphs are assembled this way rather than as one traced outline.
 */
function cloud(x: number, y: number, scale = 1): string {
  const p = (cx: number, cy: number, r: number) =>
    `<circle cx="${x + cx * scale}" cy="${y + cy * scale}" r="${r * scale}"/>`
  return (
    p(-3, 0.5, 4.5) +
    p(3, -0.5, 5.5) +
    p(6, 1.5, 3.5) +
    `<rect x="${x - 3 * scale}" y="${y + 0.5 * scale}" width="${9 * scale}" height="${
      4.5 * scale
    }"/>`
  )
}

export const ICONS: Record<IconName, string> = {
  sun:
    '<circle cx="12" cy="12" r="4.6"/>' +
    `<g ${S} stroke-width="1.9"><path d="M12 1.6v2.6M12 19.8v2.6M22.4 12h-2.6M4.2 12H1.6` +
    'M19.4 4.6l-1.9 1.9M6.5 17.5l-1.9 1.9M19.4 19.4l-1.9-1.9M6.5 6.5 4.6 4.6"/></g>',

  'sun-cloud':
    '<circle cx="8" cy="7" r="3.2"/>' +
    `<g ${S} stroke-width="1.7"><path d="M8 0.9v2M1.9 7h2M3.7 2.7l1.4 1.4M3.7 11.3l1.4-1.4` +
    'M12.3 2.7l-1.4 1.4"/></g>' +
    cloud(13, 14),

  /*
   * The same composition as sun-cloud, so the pair reads as one condition seen by
   * day and by night. The crescent is the `moon` path scaled to 0.4375 and moved to
   * where that glyph puts its sun, which is what keeps the two the same weight at
   * the 13px they render at.
   */
  'moon-cloud': '<path d="M11.63 8.23A4.03 4.03 0 0 1 6.78 3.37A4.2 4.2 0 1 0 11.63 8.23z"/>' + cloud(13, 14),

  cloud: cloud(12, 13),

  /*
   * Two layers rather than one bigger cloud. Scaling the same shape up made
   * "Berawan" and "Berawan Tebal" indistinguishable at the 13px they render at,
   * which is the whole size this set has to work at.
   */
  overcast: `<g opacity="0.5">${cloud(9, 7.5, 0.72)}</g>` + cloud(13.5, 14.5, 0.95),

  haze:
    '<circle cx="12" cy="8.5" r="4.2"/>' +
    `<g ${S} stroke-width="1.9"><path d="M3.5 16.5h17M6.5 20.5h11"/></g>`,

  // Staggered bands, so it does not read as a text-alignment control.
  fog: `<g ${S} stroke-width="1.9"><path d="M2.5 7.5h13M8.5 11.5h13M2.5 15.5h13M8.5 19.5h13"/></g>`,

  drizzle: cloud(12, 10) + `<g ${S} stroke-width="1.9"><path d="M9.5 18v2.4M15 18v2.4"/></g>`,

  rain: cloud(12, 10) + `<g ${S} stroke-width="1.9"><path d="M8 18v3M12 18v3M16 18v3"/></g>`,

  downpour:
    cloud(12, 10) +
    `<g ${S} stroke-width="1.9"><path d="M7.5 18l-1.2 3.2M11 18l-1.2 3.2M14.5 18l-1.2 3.2M18 18l-1.2 3.2"/></g>`,

  shower:
    '<circle cx="7" cy="6" r="2.8"/>' +
    `<g ${S} stroke-width="1.6"><path d="M7 0.4v1.8M1.4 6h1.8M3.1 2.1l1.3 1.3M3.1 9.9l1.3-1.3"/></g>` +
    cloud(13.5, 12.5, 0.92) +
    `<g ${S} stroke-width="1.9"><path d="M12 19.5v2.2M17 19.5v2.2"/></g>`,

  storm:
    cloud(12, 9) +
    '<path d="M13.6 13.8 9.4 19.6h2.4L10.5 23.4l4.4-5.6h-2.5z"/>',

  mountain: '<path d="M1.5 20.5 8.6 7l4.2 7.5 2.6-3.7 7.1 9.7z"/>',

  // A cut-off cone with ejecta above it -- the notch and the dots are what separate
  // this from `mountain` at 13px, where the silhouettes alone would be the same.
  volcano:
    '<path d="M2.5 20.5 8.9 10h6.2l6.4 10.5z"/>' +
    '<circle cx="12" cy="4.6" r="1.7"/><circle cx="8" cy="6.6" r="1"/><circle cx="16" cy="6.6" r="1"/>',

  beach:
    '<circle cx="12" cy="7.5" r="3.8"/>' +
    `<g ${S} stroke-width="1.9"><path d="M2 16.5c2-1.6 3.7-1.6 5.7 0s3.7 1.6 5.7 0 3.7-1.6 5.7 0` +
    'M2 20.5c2-1.6 3.7-1.6 5.7 0s3.7 1.6 5.7 0 3.7-1.6 5.7 0"/></g>',

  // Water enclosed by hills, rather than open water -- the reason it is not `beach`.
  lake:
    '<path d="M3 11.5 7.8 4.5l4.4 7z"/><path d="M10.5 11.5 15 5.5l4.8 6z"/>' +
    '<ellipse cx="12" cy="16.8" rx="9.2" ry="4.6"/>',

  island:
    '<path d="M4.5 16.5c1.6-5.4 4.2-8.1 7.5-8.1s5.9 2.7 7.5 8.1z"/>' +
    `<g ${S} stroke-width="1.9"><path d="M2 19.8c2-1.5 3.7-1.5 5.7 0s3.7 1.5 5.7 0 3.7-1.5 5.7 0"/></g>`,

  plateau: '<path d="M1.5 20.5v-4.2h4.2V12.5h12.6v3.8h4.2v4.2z"/>',

  cape:
    '<path d="M1.5 4.5h7.8v5.2c0 4.4-2.7 7.6-7.8 9.6z"/>' +
    `<g ${S} stroke-width="1.8"><path d="M13 11.5c1.5-1.2 2.7-1.2 4.2 0s2.7 1.2 4.2 0` +
    'M13 16c1.5-1.2 2.7-1.2 4.2 0s2.7 1.2 4.2 0M13 20.5c1.5-1.2 2.7-1.2 4.2 0s2.7 1.2 4.2 0"/></g>',

  park:
    '<path d="M12 2 5.8 12.5h3.4L4.2 20.5h15.6L14.8 12.5h3.4z"/>' +
    '<rect x="10.9" y="19.5" width="2.2" height="3.2"/>',

  flag: '<rect x="5.4" y="2.5" width="1.9" height="19"/><path d="M8.2 3.4h11l-2.8 3.7 2.8 3.7h-11z"/>',

  // A folded map: what a kecamatan result is, as opposed to a named place.
  district:
    '<path d="m2 5.6 6.2-2.6v15.4L2 21z"/><path d="m9.4 3 5.2 2.6V21l-5.2-2.6z"/>' +
    '<path d="m15.8 5.6 6.2-2.6v15.4L15.8 21z"/>',

  // Light pollution: a dome of glow standing on the horizon, not a lamp.
  glow:
    '<path d="M12 7.5c3.9 0 7 3.9 7 8.7H5c0-4.8 3.1-8.7 7-8.7z"/>' +
    `<g ${S} stroke-width="1.9"><path d="M2 20.2h20"/></g>` +
    `<g ${S} stroke-width="1.6" opacity="0.75"><path d="M12 1.6v2.8M4.6 4.2l1.9 2.2M19.4 4.2l-1.9 2.2"/></g>`,

  /*
   * The map marker. The point it names is the tip, not the centre, so whatever
   * places it has to anchor at the bottom -- centring a pin puts the tip half a
   * glyph below the coordinate the app actually sampled.
   *
   * The head is a real hole, cut with `fill-rule="evenodd"` rather than filled with
   * a background colour, so the map shows through it. That is what keeps the pin
   * readable over both the black of open sea and the glare of a city, and it is
   * also why it survives field mode: there is no second colour to remap.
   */
  pin:
    '<path fill-rule="evenodd" d="M12 22.8c-.7-.9-8-9.4-8-13.8a8 8 0 1 1 16 0c0 4.4-7.3 12.9-8 13.8z' +
    'm0-10.4a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z"/>',

  moon: '<path d="M20.3 14.8A9.2 9.2 0 0 1 9.2 3.7 9.6 9.6 0 1 0 20.3 14.8z"/>',

  // Edge-on, because that is how the Milky Way is actually seen and drawn here.
  // Three nested bands rather than one: a single 45%-opacity ellipse vanished at
  // small sizes and left only the core dot.
  galaxy:
    '<g transform="rotate(-25 12 12)">' +
    '<ellipse cx="12" cy="12" rx="11" ry="3.9" opacity="0.4"/>' +
    '<ellipse cx="12" cy="12" rx="7.2" ry="2.9" opacity="0.7"/>' +
    '<circle cx="12" cy="12" r="3.3"/></g>',

  planet:
    '<circle cx="12" cy="11.5" r="5.6"/>' +
    `<ellipse cx="12" cy="11.5" rx="10.4" ry="3.2" transform="rotate(-20 12 11.5)" ${S} stroke-width="1.8"/>`,

  star: '<path d="m12 2.2 3 6.4 7 1-5.1 4.9 1.3 6.9L12 18.1l-6.2 3.3 1.3-6.9L2 9.6l7-1z"/>',

  nebula:
    '<ellipse cx="11.5" cy="12.8" rx="7.8" ry="6.2" opacity="0.45"/>' +
    '<ellipse cx="13" cy="11.2" rx="4.6" ry="3.7" opacity="0.8"/>' +
    '<circle cx="4.6" cy="5" r="1.2"/><circle cx="19.6" cy="5.8" r="0.95"/><circle cx="19.2" cy="19" r="1.05"/>',

  gauge:
    `<g ${S} stroke-width="2.6"><path d="M3.4 18.5a8.6 8.6 0 1 1 17.2 0"/></g>` +
    '<circle cx="12" cy="18.5" r="2.4"/><path d="M13.4 17 18.6 9.2l-7.3 6.8z"/>',

  crosshair:
    `<g ${S} stroke-width="1.9"><circle cx="12" cy="12" r="6.4"/>` +
    '<path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/></g>' +
    '<circle cx="12" cy="12" r="2"/>',

  close: `<g ${S} stroke-width="2.1"><path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/></g>`,

  layers:
    '<path d="m12 2.2 9.8 5.1-9.8 5.1-9.8-5.1z"/>' +
    '<path d="m3.4 12.4 8.6 4.5 8.6-4.5 1.2.6-9.8 5.1-9.8-5.1z" opacity="0.6"/>' +
    '<path d="m3.4 16.9 8.6 4.5 8.6-4.5 1.2.6-9.8 5.1-9.8-5.1z" opacity="0.35"/>',

  torch:
    '<path d="M8.4 2.2h7.2v4.6H8.4z"/>' +
    '<path d="M7.2 8.2h9.6L14 21.8h-4z" opacity="0.55"/>',

  /*
   * The panel controls read as what happens to the panel, not as generic window
   * chrome: the filled bar is the edge the panel lives against, and the arrow says
   * which way the panel moves. Named for what they *draw* rather than for the action
   * they trigger, because naming them `minimize`/`maximize` is exactly how they
   * ended up pointing the wrong way -- collapsing a right-hand panel moves it
   * toward the right edge, not away from it.
   *
   * Drawn for the `beside` case and rotated a quarter turn when the panel is below.
   * That rotation is why the arrows lost their shafts: a shaft running into a bar is
   * the download glyph, and a quarter turn put it exactly there -- one control read
   * as "download", the one beside it as "upload". A chevron against the same bar
   * says the same thing about the panel and collides with nothing.
   */
  collapse:
    '<rect x="17.4" y="3" width="3.6" height="18" rx="0.6"/>' +
    `<g ${S} stroke-width="2.2"><path d="M6.2 5.6 12.6 12l-6.4 6.4"/></g>`,

  expand:
    '<rect x="17.4" y="3" width="3.6" height="18" rx="0.6"/>' +
    `<g ${S} stroke-width="2.2"><path d="M12.6 5.6 6.2 12l6.4 6.4"/></g>`,

  restore:
    '<rect x="3" y="3" width="3.6" height="18" rx="0.6"/>' +
    '<rect x="17.4" y="3" width="3.6" height="18" rx="0.6"/>' +
    `<g ${S} stroke-width="1.9"><path d="M9.6 12h4.8"/></g>`,
}

/*
 * The three tables below are typed as full `Record`s on purpose. Adding a landmark
 * kind, a sky category or a sub-score then fails to compile until it has a glyph,
 * which is stricter than a test and arrives sooner.
 */

export const LANDMARK_ICONS: Record<LandmarkKind, IconName> = {
  mountain: 'mountain',
  volcano: 'volcano',
  beach: 'beach',
  lake: 'lake',
  plateau: 'plateau',
  island: 'island',
  cape: 'cape',
  park: 'park',
  site: 'flag',
}

export const CATEGORY_ICONS: Record<SkyCategory, IconName> = {
  core: 'galaxy',
  planet: 'planet',
  star: 'star',
  deepsky: 'nebula',
}

/** The three things that can hold a night back, as named by the score. */
export const FACTOR_ICONS: Record<SubScoreKey, IconName> = {
  darkness: 'glow',
  clouds: 'cloud',
  moon: 'moon',
}
