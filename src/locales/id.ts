import type { Messages } from './en'

/**
 * Typed as `Messages`, so any key present in `en.ts` but missing here is a compile
 * error rather than a string that silently falls back to English at runtime.
 *
 * Indonesian does not inflect for number, so the `_one`/`_other` pairs in `en.ts`
 * collapse to a single form here — `translate` falls back to the base key when the
 * count variants are absent.
 */
export const id: Messages = {
  app: {
    tagline: 'Pilih titik di peta.',
    intro:
      'Skor kelayakan malam ini dihitung dari polusi cahaya lokasi, tutupan awan BMKG, dan posisi bulan selama jendela gelap astronomis.',
    fieldMode: 'Mode lapangan',
    fieldModeHint: 'Merah monokrom, agar adaptasi gelap mata tidak hilang saat di lapangan',
    language: 'Bahasa',
    dataError:
      'Sebagian data gagal dimuat. Jalankan `pnpm data:lp` dan `pnpm data:wilayah`, lalu muat ulang.',
  },

  moonTonight: {
    heading: 'Bulan malam ini',
    dark: 'Nyaris bulan baru. Langit tidak akan lebih gelap dari ini sebulan penuh.',
    thin: 'Bulan tipis. Objek samar masih terjangkau.',
    half: 'Separuh bercahaya. Milky Way meredup selama bulan berada di atas horizon.',
    bright: 'Bulan terang. Nyaris tidak ada yang samar bertahan.',
  },

  map: {
    lightPollution: 'Polusi cahaya',
    shown: 'tampil',
    hidden: 'sembunyi',
    zoomIn: 'Perbesar',
    zoomOut: 'Perkecil',
  },

  search: {
    label: 'Cari lokasi',
    placeholder: 'Cari daerah atau tempat…',
    useMyLocation: 'Pakai lokasi saya',
    locating: 'Mencari posisimu…',
    noResults: 'Tidak ada yang cocok dengan “{query}”.',
    clear: 'Bersihkan pencarian',
    kind: {
      mountain: 'Gunung {name}',
      volcano: 'Gunung {name}',
      beach: 'Pantai {name}',
      lake: 'Danau {name}',
      plateau: 'Dataran Tinggi {name}',
      island: 'Pulau {name}',
      cape: 'Tanjung {name}',
      park: '{name}',
      site: '{name}',
    },
    kindLabel: {
      mountain: 'Gunung',
      volcano: 'Gunung api',
      beach: 'Pantai',
      lake: 'Danau',
      plateau: 'Dataran tinggi',
      island: 'Pulau',
      cape: 'Tanjung',
      park: 'Taman nasional',
      site: 'Lokasi',
    },
    district: 'Kecamatan',
  },

  geolocation: {
    denied: 'Izin lokasi ditolak. Aktifkan di browser, atau cari lokasinya lewat pencarian.',
    unavailable: 'Perangkat ini tidak bisa melaporkan lokasi.',
    timeout: 'Pencarian lokasi terlalu lama. Coba lagi, atau pakai pencarian.',
    outsideCoverage: 'Kamu berada di luar Indonesia. Aplikasi ini hanya mencakup langit Indonesia.',
    failed: 'Tidak bisa mendapatkan lokasimu.',
  },

  panel: {
    tabsLabel: 'Informasi lokasi',
    resolving: 'Menentukan wilayah…',
    tabs: { score: 'Skor', sky: 'Langit', weather: 'Cuaca' },
    attributionWeather: 'Data cuaca:',
    attributionAgency: '— Badan Meteorologi, Klimatologi, dan Geofisika',
    lpStub: 'Polusi cahaya: data sementara, belum dikalibrasi.',
    lpReal: 'Polusi cahaya: World Atlas 2015 — Falchi dkk.',
    minimize: 'Ciutkan panel',
    maximize: 'Penuhi layar',
    restore: 'Kembalikan panel',
    resize: 'Ubah ukuran panel',
  },

  score: {
    outOf: '/5',
    ratingAria: '{rating} dari 5',
    rating: {
      5: 'Sangat baik',
      4: 'Baik',
      3: 'Cukup',
      2: 'Kurang',
      1: 'Tidak disarankan',
    },
    reason: {
      darkness: 'polusi cahaya',
      clouds: 'tutupan awan',
      moon: 'cahaya bulan',
    },
    factor: {
      darkness: 'Bortle {bortle}',
      clouds: '{percent}%',
      moon: '{phase} ({percent}%)',
      moonDown: '{phase} ({percent}%), di bawah horizon',
    },
    limitedBy: 'Tertahan {reason} — {detail}',
    nothingLimiting: 'Tidak ada faktor yang menahan.',
    provisional: 'Sementara — dihitung tanpa data cuaca.',
    loadingForecast: 'Mengambil prakiraan BMKG…',
    forecastFallback: 'Skor dihitung dari polusi cahaya dan bulan saja.',
  },

  night: {
    astronomicalDark: 'Gelap astronomis',
    cloudCover: 'Tutupan awan',
    moonUp: 'Bulan di atas horizon',
    now: 'Sekarang',
    noForecast: 'Prakiraan awan belum mencakup malam ini',
    ariaSummary:
      'Malam gelap {range}. Bulan di atas horizon {percent} persen dari durasi malam.',
    ariaCore: 'Inti Bima Sakti terpakai sebagian malam.',
  },

  sky: {
    category: {
      core: 'Bima Sakti',
      planet: 'Planet',
      deepsky: 'Objek langit dalam',
      star: 'Bintang terang',
    },
    columns: {
      object: 'Objek',
      peak: 'Puncak',
      altitude: 'Ketinggian',
      direction: 'Arah',
      magnitude: 'Mag',
      visible: 'Terlihat',
    },
    nothingUp: 'Tidak ada objek katalog yang cukup tinggi malam ini.',
    magnitudeTitle: 'Magnitudo {value}',
    belowHorizon: 'Di bawah horizon',
    noWindow: 'Jendela malam tidak dapat dihitung untuk titik ini.',
    visibleTonight: 'Terlihat malam ini',
    visibleLede:
      'Objek yang naik di atas 20° selama malam gelap — jendela, ketinggian puncak, dan arah pandang.',
    planAhead: 'Merencanakan malam lain',
    peakDetail: '{degrees}° ke {direction}',
    peakAt: 'pukul {time}',
  },

  milkyWay: {
    heading: 'Inti Bima Sakti',
    verdict: {
      good: 'Malam yang baik untuk Bima Sakti',
      limited: 'Bisa, dengan catatan',
      no: 'Bukan malam untuk Bima Sakti',
    },
    reason: {
      belowHorizon:
        'Inti galaksi berada di bawah horizon sepanjang malam gelap — belum musimnya.',
      tooLow: 'Inti galaksi hanya mencapai {degrees}°, terlalu rendah untuk ditembus.',
      moonWashout: 'Inti naik, tapi cahaya bulan {percent}% menghapus kontrasnya.',
      shortWindow: 'Jendelanya pendek — siapkan alat sebelum inti mencapai puncaknya.',
      good: 'Inti mencapai {degrees}° dengan langit gelap tanpa gangguan bulan berarti.',
    },
  },

  moon: {
    heading: 'Bulan',
    rise: 'terbit {time}',
    set: 'terbenam {time}',
    phase: {
      new: 'Bulan Baru',
      waxingCrescent: 'Sabit Awal',
      firstQuarter: 'Kuartal Pertama',
      waxingGibbous: 'Cembung Awal',
      full: 'Purnama',
      waningGibbous: 'Cembung Akhir',
      lastQuarter: 'Kuartal Terakhir',
      waningCrescent: 'Sabit Akhir',
    },
  },

  weather: {
    heading: 'Tutupan awan',
    forecastPoint: 'Titik cuaca',
    distanceAway: '{km} km dari titik yang dipilih',
    time: 'Waktu',
    cloud: 'Awan',
    temp: 'Suhu',
    humidity: 'Kelembapan',
    condition: 'Kondisi',
    darkRowNote: 'Baris bertanda berada di dalam jendela gelap astronomis malam ini',
    darkRowMarker: 'malam gelap',
    unavailable: 'Prakiraan tidak tersedia untuk lokasi ini.',
  },

  moonCalendar: {
    heading: 'Malam gelap berikutnya',
    summaryWithRun: 'Kegelapan per malam selama {count} malam ke depan. Rentang paling gelap {run}.',
    summary: 'Kegelapan per malam selama {count} malam ke depan.',
    legend:
      'Batang tinggi = malam gelap. Warna terang menandai malam yang cukup gelap untuk didatangi.',
  },

  compass: {
    short: { n: 'U', ne: 'TL', e: 'T', se: 'TG', s: 'S', sw: 'BD', w: 'B', nw: 'BL' },
    long: {
      n: 'utara', ne: 'timur laut', e: 'timur', se: 'tenggara',
      s: 'selatan', sw: 'barat daya', w: 'barat', nw: 'barat laut',
    },
  },

  summary: {
    darkSpan: 'Langit gelap astronomis dari {start} sampai {end} {tz}, {duration}.',
    moonDown:
      '{phase} {percent}% berada di bawah horizon sepanjang malam gelap — tidak mengganggu sama sekali.',
    moonDominates:
      '{phase} {percent}% menerangi {share}% durasi malam — objek redup akan hilang tertelan cahayanya.',
    moonMinor: '{phase} {percent}% hanya menemani {share}% durasi malam, jadi sisanya bersih.',
    coreWindow: 'Inti Bima Sakti terpakai {from}–{to}, memuncak di {degrees}° arah {direction}.',
    bestObject: 'Objek paling tinggi malam ini {name}, mencapai {degrees}° arah {direction}.',
    cloudHeavy: 'Prakiraan BMKG menutup malam ini dengan awan {percent}%.',
    cloudMixed:
      'Prakiraan BMKG memberi tutupan awan rata-rata {percent}% — kemungkinan ada celah, tapi tidak dijamin.',
    cloudLight: 'Prakiraan BMKG memberi tutupan awan rata-rata {percent}% selama jendela gelap.',
  },

  meteor: {
    heading: 'Hujan meteor',
    detail: '{date} · radiant {degrees}° · hingga {zhr}/jam',
    moonAffected: 'terganggu bulan',
    caveat:
      'Angka per jam berlaku untuk langit sempurna dengan radiant di zenit — di lapangan selalu lebih sedikit.',
    peakTonight: 'puncak malam ini',
    peakTomorrow: 'puncak besok malam',
    peakLastNight: 'puncak tadi malam',
    peakNightsAgo: 'puncak {count} malam lalu',
    nightsAway: '{count} malam lagi',
  },

  bortle: {
    1: 'Langit gelap sempurna — Milky Way tampak sangat detail',
    2: 'Langit gelap sejati — Milky Way jelas dan berstruktur',
    3: 'Langit pedesaan — Milky Way masih tampak jelas',
    4: 'Peralihan pedesaan/pinggiran — Milky Way tampak di atas kepala',
    5: 'Langit pinggiran kota — Milky Way samar dan mudah hilang',
    6: 'Pinggiran kota terang — Milky Way praktis tak terlihat',
    7: 'Peralihan pinggiran/kota — langit abu terang menyeluruh',
    8: 'Langit kota — hanya bintang paling terang yang tampak',
    9: 'Pusat kota — hampir tidak ada bintang yang terlihat',
  },

  units: {
    km: 'km',
    degrees: '°',
    percent: '%',
    hours_one: '{count} jam',
    hours_other: '{count} jam',
    minutes_one: '{count} menit',
    minutes_other: '{count} menit',
    hoursMinutes: '{hours} jam {minutes} menit',
  },

  errors: {
    lpMeta: 'Gagal memuat metadata polusi cahaya.',
    lpGrid: 'Gagal memuat grid polusi cahaya.',
    wilayahIndex: 'Gagal memuat indeks wilayah.',
    forecastEmpty: 'Prakiraan cuaca tidak tersedia untuk lokasi ini.',
    forecastFetch: 'Gagal mengambil data BMKG.',
    nightWindow: 'Tidak dapat menghitung jendela malam untuk lokasi ini.',
  },
}
