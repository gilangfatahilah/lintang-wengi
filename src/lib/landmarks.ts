/**
 * Places Indonesian astrophotographers actually name when they plan a trip.
 *
 * The kecamatan index answers "where am I", but nobody searches for "Tosari" -- they
 * search for "Bromo". This list closes that gap. Curated rather than exhaustive, the
 * same bargain `skyCatalog.ts` makes: a few dozen entries that cover real intent beat
 * a gazetteer that has to be fetched and filtered.
 *
 * `name` is the proper noun on its own and `kind` carries the descriptor, so one
 * entry renders as "Mount Bromo" or "Gunung Bromo" without storing the name twice.
 * Coordinates point at the viewpoint people shoot from where that differs from the
 * summit, because the summit is usually not where you stand with a tripod.
 */

export type LandmarkKind =
  | 'mountain'
  | 'volcano'
  | 'beach'
  | 'lake'
  | 'plateau'
  | 'island'
  | 'cape'
  | 'park'
  | 'site'

export interface Landmark {
  id: string
  /** Proper noun only; the descriptor comes from `kind`. */
  name: string
  kind: LandmarkKind
  lat: number
  lon: number
  /** Island or province, to disambiguate similar names in the results list. */
  region: string
}

export const LANDMARKS: readonly Landmark[] = [
  // --- Java ---
  { id: 'bromo', name: 'Bromo', kind: 'volcano', lat: -7.9425, lon: 112.953, region: 'Jawa Timur' },
  { id: 'semeru', name: 'Semeru', kind: 'volcano', lat: -8.1077, lon: 112.922, region: 'Jawa Timur' },
  { id: 'ijen', name: 'Ijen', kind: 'volcano', lat: -8.0583, lon: 114.242, region: 'Jawa Timur' },
  { id: 'penanjakan', name: 'Penanjakan', kind: 'site', lat: -7.9167, lon: 112.9469, region: 'Jawa Timur' },
  { id: 'dieng', name: 'Dieng', kind: 'plateau', lat: -7.2058, lon: 109.9075, region: 'Jawa Tengah' },
  { id: 'prau', name: 'Prau', kind: 'mountain', lat: -7.1897, lon: 109.9264, region: 'Jawa Tengah' },
  { id: 'sindoro', name: 'Sindoro', kind: 'volcano', lat: -7.3, lon: 109.9922, region: 'Jawa Tengah' },
  { id: 'sumbing', name: 'Sumbing', kind: 'volcano', lat: -7.3844, lon: 110.0703, region: 'Jawa Tengah' },
  { id: 'merbabu', name: 'Merbabu', kind: 'volcano', lat: -7.455, lon: 110.4397, region: 'Jawa Tengah' },
  { id: 'lawu', name: 'Lawu', kind: 'volcano', lat: -7.6272, lon: 111.1919, region: 'Jawa Tengah' },
  { id: 'slamet', name: 'Slamet', kind: 'volcano', lat: -7.2422, lon: 109.2081, region: 'Jawa Tengah' },
  { id: 'gede', name: 'Gede', kind: 'volcano', lat: -6.7869, lon: 106.9822, region: 'Jawa Barat' },
  { id: 'papandayan', name: 'Papandayan', kind: 'volcano', lat: -7.32, lon: 107.73, region: 'Jawa Barat' },
  { id: 'ciremai', name: 'Ciremai', kind: 'volcano', lat: -6.8925, lon: 108.4, region: 'Jawa Barat' },
  { id: 'tangkuban', name: 'Tangkuban Perahu', kind: 'volcano', lat: -6.7597, lon: 107.6097, region: 'Jawa Barat' },
  { id: 'ujung-kulon', name: 'Ujung Kulon', kind: 'park', lat: -6.7511, lon: 105.3333, region: 'Banten' },
  { id: 'sawarna', name: 'Sawarna', kind: 'beach', lat: -6.9853, lon: 106.3161, region: 'Banten' },
  { id: 'menganti', name: 'Menganti', kind: 'beach', lat: -7.7639, lon: 109.3806, region: 'Jawa Tengah' },
  { id: 'timang', name: 'Timang', kind: 'beach', lat: -8.1508, lon: 110.6289, region: 'Yogyakarta' },
  { id: 'nglambor', name: 'Nglambor', kind: 'beach', lat: -8.1531, lon: 110.6053, region: 'Yogyakarta' },
  { id: 'papuma', name: 'Papuma', kind: 'beach', lat: -8.4406, lon: 113.5533, region: 'Jawa Timur' },
  { id: 'baluran', name: 'Baluran', kind: 'park', lat: -7.8425, lon: 114.3806, region: 'Jawa Timur' },
  { id: 'alas-purwo', name: 'Alas Purwo', kind: 'park', lat: -8.6667, lon: 114.35, region: 'Jawa Timur' },
  { id: 'karimunjawa', name: 'Karimunjawa', kind: 'island', lat: -5.8483, lon: 110.4419, region: 'Jawa Tengah' },

  // --- Bali & Nusa Tenggara ---
  { id: 'kintamani', name: 'Kintamani', kind: 'site', lat: -8.2483, lon: 115.3517, region: 'Bali' },
  { id: 'batur', name: 'Batur', kind: 'volcano', lat: -8.2422, lon: 115.375, region: 'Bali' },
  { id: 'agung', name: 'Agung', kind: 'volcano', lat: -8.3428, lon: 115.5075, region: 'Bali' },
  { id: 'nusa-penida', name: 'Nusa Penida', kind: 'island', lat: -8.7275, lon: 115.5444, region: 'Bali' },
  { id: 'amed', name: 'Amed', kind: 'beach', lat: -8.3372, lon: 115.6572, region: 'Bali' },
  { id: 'rinjani', name: 'Rinjani', kind: 'volcano', lat: -8.4111, lon: 116.4575, region: 'Lombok' },
  { id: 'sembalun', name: 'Sembalun', kind: 'site', lat: -8.3667, lon: 116.5333, region: 'Lombok' },
  { id: 'kuta-lombok', name: 'Kuta Mandalika', kind: 'beach', lat: -8.8917, lon: 116.28, region: 'Lombok' },
  { id: 'komodo', name: 'Komodo', kind: 'park', lat: -8.5486, lon: 119.4869, region: 'Nusa Tenggara Timur' },
  { id: 'padar', name: 'Padar', kind: 'island', lat: -8.6531, lon: 119.5789, region: 'Nusa Tenggara Timur' },
  { id: 'kelimutu', name: 'Kelimutu', kind: 'volcano', lat: -8.7669, lon: 121.8231, region: 'Flores' },
  { id: 'sumba-timur', name: 'Sumba Timur', kind: 'site', lat: -9.8, lon: 120.35, region: 'Nusa Tenggara Timur' },
  { id: 'rote', name: 'Rote', kind: 'island', lat: -10.7333, lon: 123.1167, region: 'Nusa Tenggara Timur' },

  // --- Sumatra ---
  { id: 'toba', name: 'Toba', kind: 'lake', lat: 2.6845, lon: 98.8756, region: 'Sumatera Utara' },
  { id: 'samosir', name: 'Samosir', kind: 'island', lat: 2.5833, lon: 98.8333, region: 'Sumatera Utara' },
  { id: 'sinabung', name: 'Sinabung', kind: 'volcano', lat: 3.17, lon: 98.392, region: 'Sumatera Utara' },
  { id: 'kerinci', name: 'Kerinci', kind: 'volcano', lat: -1.6964, lon: 101.2644, region: 'Jambi' },
  { id: 'maninjau', name: 'Maninjau', kind: 'lake', lat: -0.3167, lon: 100.2, region: 'Sumatera Barat' },
  { id: 'singkarak', name: 'Singkarak', kind: 'lake', lat: -0.6167, lon: 100.5333, region: 'Sumatera Barat' },
  { id: 'mentawai', name: 'Mentawai', kind: 'island', lat: -1.9, lon: 99.65, region: 'Sumatera Barat' },
  { id: 'krakatau', name: 'Krakatau', kind: 'volcano', lat: -6.1022, lon: 105.4231, region: 'Lampung' },
  { id: 'belitung', name: 'Belitung', kind: 'island', lat: -2.8667, lon: 107.75, region: 'Bangka Belitung' },
  { id: 'weh', name: 'Weh', kind: 'island', lat: 5.8167, lon: 95.3167, region: 'Aceh' },

  // --- Kalimantan ---
  { id: 'derawan', name: 'Derawan', kind: 'island', lat: 2.2833, lon: 118.2333, region: 'Kalimantan Timur' },
  { id: 'tanjung-puting', name: 'Tanjung Puting', kind: 'park', lat: -2.7333, lon: 111.9333, region: 'Kalimantan Tengah' },
  { id: 'bukit-raya', name: 'Bukit Raya', kind: 'mountain', lat: -0.65, lon: 112.6833, region: 'Kalimantan Tengah' },

  // --- Sulawesi & Maluku ---
  { id: 'bunaken', name: 'Bunaken', kind: 'island', lat: 1.6167, lon: 124.7667, region: 'Sulawesi Utara' },
  { id: 'togean', name: 'Togean', kind: 'island', lat: -0.4, lon: 121.9, region: 'Sulawesi Tengah' },
  { id: 'wakatobi', name: 'Wakatobi', kind: 'park', lat: -5.3167, lon: 123.5833, region: 'Sulawesi Tenggara' },
  { id: 'rammang', name: 'Rammang-Rammang', kind: 'site', lat: -4.9167, lon: 119.6167, region: 'Sulawesi Selatan' },
  { id: 'bantimurung', name: 'Bantimurung', kind: 'park', lat: -5.0167, lon: 119.6833, region: 'Sulawesi Selatan' },
  { id: 'banda-neira', name: 'Banda Neira', kind: 'island', lat: -4.5236, lon: 129.8975, region: 'Maluku' },
  { id: 'morotai', name: 'Morotai', kind: 'island', lat: 2.2, lon: 128.4, region: 'Maluku Utara' },

  // --- Papua ---
  { id: 'raja-ampat', name: 'Raja Ampat', kind: 'island', lat: -0.5667, lon: 130.5167, region: 'Papua Barat Daya' },
  { id: 'wayag', name: 'Wayag', kind: 'island', lat: -0.15, lon: 130.0333, region: 'Papua Barat Daya' },
  { id: 'baliem', name: 'Baliem', kind: 'site', lat: -4.1, lon: 138.95, region: 'Papua Pegunungan' },
  { id: 'lorentz', name: 'Lorentz', kind: 'park', lat: -4.6667, lon: 137.6667, region: 'Papua Tengah' },
  { id: 'teluk-cenderawasih', name: 'Cenderawasih', kind: 'park', lat: -2.5, lon: 134.8333, region: 'Papua Barat' },
]
