/**
 * What is worth looking at, from Indonesia.
 *
 * A TypeScript array rather than a JSON file in `public/data/`: it is a few
 * kilobytes, so bundling it costs nothing measurable while buying type checking and
 * -- more to the point -- removing one more fetched artifact that can fail to load
 * the way `lp-grid.bin` can. The catalogue is curated, not exhaustive; anything a
 * camera cannot make something of from a dark Indonesian site is left out.
 *
 * Coordinates are J2000: right ascension in hours, declination in degrees. See the
 * note on `SkyTarget` for why they are not precessed.
 *
 * Names and notes carry both languages inline rather than living in the message
 * dictionaries. They are data belonging with the coordinates, and keeping them here
 * makes it impossible for an id and a message key to drift apart unnoticed.
 */
import { Body } from 'astronomy-engine'
import type { SkyCategory, SkyObject } from '@/types'
import type { Localized } from './i18n'

/** Many proper nouns are spelled the same in both languages; a bare string means both. */
type Text = string | Localized

function loc(value: Text): Localized {
  return typeof value === 'string' ? { en: value, id: value } : value
}

/**
 * Sagittarius A*, the galactic centre.
 *
 * Kept as its own export because the Milky Way core is the headline this app is
 * built around, not one row in a list.
 */
export const MILKY_WAY_CORE: SkyObject = {
  id: 'mw-core',
  name: { en: 'Milky Way Core', id: 'Inti Bima Sakti' },
  category: 'core',
  target: { kind: 'fixed', ra: 17.7611, dec: -29.0078, magnitude: null },
  note: {
    en: 'The densest, most colourful stretch of our galaxy.',
    id: 'Bagian paling padat dan berwarna dari galaksi kita.',
  },
}

function planet(id: string, name: Text, body: Body, note: Localized): SkyObject {
  return { id, name: loc(name), category: 'planet', target: { kind: 'planet', body }, note }
}

function star(id: string, name: Text, ra: number, dec: number, magnitude: number, note?: Localized): SkyObject {
  return {
    id,
    name: loc(name),
    category: 'star',
    target: { kind: 'fixed', ra, dec, magnitude },
    note,
  }
}

function dso(
  id: string,
  name: Text,
  ra: number,
  dec: number,
  magnitude: number | null,
  note?: Localized,
): SkyObject {
  return {
    id,
    name: loc(name),
    category: 'deepsky',
    target: { kind: 'fixed', ra, dec, magnitude },
    note,
  }
}

/**
 * Pluto is omitted: at magnitude 14 it is invisible to the eye and to any camera
 * this app's users are carrying.
 */
const PLANETS: SkyObject[] = [
  planet('venus', 'Venus', Body.Venus, {
    en: 'Brightest thing after the Moon, but it only appears near dusk or dawn.',
    id: 'Paling terang setelah Bulan, tapi hanya muncul dekat senja atau fajar.',
  }),
  planet('jupiter', 'Jupiter', Body.Jupiter, {
    en: 'The four Galilean moons show up even in binoculars.',
    id: 'Empat bulan Galilean terlihat bahkan dengan binokular.',
  }),
  planet('saturn', { en: 'Saturn', id: 'Saturnus' }, Body.Saturn, {
    en: 'The rings resolve in even a small telescope.',
    id: 'Cincinnya kelihatan mulai dari teleskop kecil.',
  }),
  planet('mars', 'Mars', Body.Mars, {
    en: 'Its brightness swings widely with distance from Earth.',
    id: 'Kecerlangannya berayun jauh mengikuti jarak ke Bumi.',
  }),
  planet('mercury', { en: 'Mercury', id: 'Merkurius' }, Body.Mercury, {
    en: 'Always low and close to the Sun — a narrow window.',
    id: 'Selalu rendah dan dekat Matahari — jendelanya sempit.',
  }),
  planet('uranus', 'Uranus', Body.Uranus, {
    en: 'A greenish point; needs a dark sky and binoculars.',
    id: 'Titik kehijauan; butuh langit gelap dan binokular.',
  }),
  planet('neptune', { en: 'Neptune', id: 'Neptunus' }, Body.Neptune, {
    en: 'Telescope only, and only from a genuinely dark sky.',
    id: 'Perlu teleskop; hanya dari langit yang benar-benar gelap.',
  }),
]

/** The brightest stars reachable from Indonesian latitudes, roughly by magnitude. */
const STARS: SkyObject[] = [
  star('sirius', 'Sirius', 6.7525, -16.7161, -1.46, {
    en: 'The brightest star in the night sky.',
    id: 'Bintang paling terang di langit malam.',
  }),
  star('canopus', 'Canopus', 6.3992, -52.6957, -0.74),
  star('alpha-centauri', { en: 'Alpha Centauri', id: 'Alfa Centauri' }, 14.66, -60.8339, -0.27, {
    en: 'The nearest star system to the Sun.',
    id: 'Sistem bintang terdekat dari Matahari.',
  }),
  star('arcturus', 'Arcturus', 14.261, 19.1825, -0.05),
  star('vega', 'Vega', 18.6156, 38.7837, 0.03),
  star('rigel', 'Rigel', 5.2422, -8.2017, 0.13),
  star('procyon', 'Procyon', 7.6551, 5.225, 0.34),
  star('achernar', 'Achernar', 1.6285, -57.2367, 0.46),
  star('betelgeuse', 'Betelgeuse', 5.9195, 7.4071, 0.5, {
    en: 'A red giant; the colour is obvious in photographs.',
    id: 'Raksasa merah; warnanya jelas di foto.',
  }),
  star('altair', 'Altair', 19.8464, 8.8683, 0.76),
  star('acrux', 'Acrux', 12.4433, -63.0991, 0.77, {
    en: 'The foot of the Southern Cross.',
    id: 'Kaki Salib Selatan.',
  }),
  star('spica', 'Spica', 13.4199, -11.1614, 1.04),
  star('antares', 'Antares', 16.4901, -26.4319, 1.06, {
    en: 'The heart of Scorpius, next to the galactic core.',
    id: 'Jantung Scorpius, dekat inti galaksi.',
  }),
]

/** Nebulae, clusters and galaxies that reward a camera from a dark site. */
const DEEP_SKY: SkyObject[] = [
  dso('lmc', { en: 'Large Magellanic Cloud', id: 'Awan Magellan Besar' }, 5.3931, -69.7561, 0.9, {
    en: 'A satellite galaxy; large and bright.',
    id: 'Galaksi satelit; besar dan terang.',
  }),
  dso('carina', { en: 'Eta Carinae Nebula', id: 'Nebula Eta Carinae' }, 10.7517, -59.8667, 1.0, {
    en: 'Bigger and brighter than Orion.',
    id: 'Lebih besar dan terang dari Orion.',
  }),
  dso('ic2602', { en: 'Southern Pleiades', id: 'Pleiades Selatan' }, 10.7161, -64.4, 1.9),
  dso('m45', 'Pleiades (M45)', 3.79, 24.1167, 1.6, {
    en: 'An open cluster wrapped in blue reflection nebulosity.',
    id: 'Gugus terbuka dengan nebula refleksi biru.',
  }),
  dso('smc', { en: 'Small Magellanic Cloud', id: 'Awan Magellan Kecil' }, 0.8792, -72.8286, 2.7),
  dso(
    'm31',
    { en: 'Andromeda Galaxy (M31)', id: 'Galaksi Andromeda (M31)' },
    0.7122,
    41.2692,
    3.4,
    { en: 'The nearest large galaxy.', id: 'Galaksi besar terdekat.' },
  ),
  dso('omega-cen', 'Omega Centauri', 13.4464, -47.4794, 3.9, {
    en: 'The brightest globular cluster in the sky.',
    id: 'Gugus bola paling terang di langit.',
  }),
  dso('m42', { en: 'Orion Nebula (M42)', id: 'Nebula Orion (M42)' }, 5.5881, -5.3911, 4.0, {
    en: 'The easiest first target there is.',
    id: 'Target pertama yang paling mudah.',
  }),
  dso('ngc104', '47 Tucanae', 0.4017, -72.0814, 4.1),
  dso(
    'm24',
    { en: 'Sagittarius Star Cloud (M24)', id: 'Awan Bintang Sagitarius (M24)' },
    18.275,
    -18.4833,
    4.6,
  ),
  dso('rho-oph', 'Rho Ophiuchi', 16.4264, -23.4472, 5.0, {
    en: 'The most colourful cloud complex in the sky.',
    id: 'Kompleks awan paling berwarna di langit.',
  }),
  dso('m17', { en: 'Omega Nebula (M17)', id: 'Nebula Omega (M17)' }, 18.3406, -16.1767, 6.0),
  dso('m16', { en: 'Eagle Nebula (M16)', id: 'Nebula Elang (M16)' }, 18.3133, -13.7833, 6.0, {
    en: 'Home of the "Pillars of Creation".',
    id: 'Rumah "Pilar Penciptaan".',
  }),
  dso('m8', { en: 'Lagoon Nebula (M8)', id: 'Nebula Laguna (M8)' }, 18.0603, -24.3867, 6.0, {
    en: 'Bright, wide, and right next to the galactic core.',
    id: 'Terang, lebar, dekat inti galaksi.',
  }),
  dso('m20', { en: 'Trifid Nebula (M20)', id: 'Nebula Trifid (M20)' }, 18.0397, -23.03, 6.3),
  dso('m13', { en: 'Hercules Cluster (M13)', id: 'Gugus Hercules (M13)' }, 16.6947, 36.4603, 5.8),
  dso('ic434', { en: 'Horsehead Nebula', id: 'Nebula Kepala Kuda' }, 5.6831, -2.4583, 6.8, {
    en: 'Needs a dark sky and a long exposure.',
    id: 'Butuh langit gelap dan eksposur panjang.',
  }),
  dso('ngc7293', { en: 'Helix Nebula', id: 'Nebula Helix' }, 22.4942, -20.8372, 7.6),
  // A dark nebula: it is an absence of light, so a magnitude would be meaningless.
  dso('coalsack', { en: 'Coalsack Nebula', id: 'Kantong Batu Bara' }, 12.8333, -62.5, null, {
    en: 'A dark nebula beside the Southern Cross.',
    id: 'Nebula gelap di sisi Salib Selatan.',
  }),
]

export const SKY_CATALOG: readonly SkyObject[] = [
  MILKY_WAY_CORE,
  ...PLANETS,
  ...DEEP_SKY,
  ...STARS,
]

/** Message key for the heading shown above each group in the object list. */
export function categoryKey(category: SkyCategory): string {
  return `sky.category.${category}`
}
