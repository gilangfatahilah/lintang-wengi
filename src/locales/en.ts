/**
 * The canonical message set. `id.ts` is typed against this object, so a key added
 * here fails to compile until it is translated — missing strings cannot ship
 * quietly.
 */
export const en = {
  app: {
    tagline: 'Pick a point on the map.',
    intro:
      "Tonight's viability is scored from the site's light pollution, BMKG cloud cover, and where the moon sits during astronomical darkness.",
    fieldMode: 'Field mode',
    fieldModeHint: 'Red monochrome, so your night vision survives being outdoors',
    language: 'Language',
    dataError: 'Some data failed to load. Run `pnpm data:lp` and `pnpm data:wilayah`, then reload.',
  },

  map: {
    lightPollution: 'Light pollution',
    shown: 'shown',
    hidden: 'hidden',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },

  search: {
    label: 'Search for a place',
    placeholder: 'Search a place or landmark…',
    useMyLocation: 'Use my location',
    locating: 'Finding you…',
    noResults: 'Nothing matches “{query}”.',
    clear: 'Clear search',
    kind: {
      mountain: 'Mount {name}',
      volcano: 'Mount {name}',
      beach: '{name} Beach',
      lake: 'Lake {name}',
      plateau: '{name} Plateau',
      island: '{name} Island',
      cape: 'Cape {name}',
      park: '{name}',
      site: '{name}',
    },
    kindLabel: {
      mountain: 'Mountain',
      volcano: 'Volcano',
      beach: 'Beach',
      lake: 'Lake',
      plateau: 'Plateau',
      island: 'Island',
      cape: 'Cape',
      park: 'National park',
      site: 'Spot',
    },
    district: 'District',
  },

  geolocation: {
    denied: 'Location permission denied. Enable it in your browser, or search for a place instead.',
    unavailable: 'This device cannot report a location.',
    timeout: 'Locating took too long. Try again, or search for a place instead.',
    outsideCoverage: 'You are outside Indonesia. This app only covers Indonesian skies.',
    failed: 'Could not get your location.',
  },

  panel: {
    tabsLabel: 'Location information',
    resolving: 'Finding the district…',
    tabs: { score: 'Score', sky: 'Sky', weather: 'Weather' },
    attributionWeather: 'Weather data:',
    attributionAgency: '— Meteorology, Climatology and Geophysical Agency of Indonesia',
    lpStub: 'Light pollution: placeholder data, not calibrated.',
    lpReal: 'Light pollution: World Atlas 2015 — Falchi et al.',
  },

  score: {
    outOf: '/5',
    rating: {
      5: 'Excellent',
      4: 'Good',
      3: 'Fair',
      2: 'Poor',
      1: 'Not worth the drive',
    },
    reason: {
      darkness: 'light pollution',
      clouds: 'cloud cover',
      moon: 'moonlight',
    },
    factor: {
      darkness: 'Bortle {bortle}',
      clouds: 'Cloud cover {percent}%',
      moon: '{phase} ({percent}%)',
      moonDown: '{phase} ({percent}%), below the horizon',
    },
    limitedBy: 'Held back by {reason} — {detail}',
    nothingLimiting: 'Nothing is holding it back.',
    provisional: 'Provisional — calculated without weather data.',
    loadingForecast: 'Fetching the BMKG forecast…',
    forecastFallback: 'Scored from light pollution and the moon only.',
  },

  night: {
    astronomicalDark: 'Astronomical darkness',
    cloudCover: 'Cloud cover',
    moonUp: 'Moon above horizon',
    now: 'Now',
    noForecast: 'The forecast does not reach tonight yet',
    ariaSummary:
      'Dark from {range}. The moon is above the horizon for {percent} percent of the night.',
    ariaCore: 'The Milky Way core is usable for part of the night.',
  },

  sky: {
    category: {
      core: 'Milky Way',
      planet: 'Planets',
      deepsky: 'Deep sky',
      star: 'Bright stars',
    },
    columns: {
      object: 'Object',
      peak: 'Peak',
      altitude: 'Altitude',
      direction: 'Direction',
      magnitude: 'Mag',
      visible: 'Visible',
    },
    nothingUp: 'Nothing from the catalogue clears a useful altitude tonight.',
    magnitudeTitle: 'Magnitude {value}',
    belowHorizon: 'Below the horizon',
    noWindow: 'The dark window cannot be worked out for this point.',
    visibleTonight: 'Visible tonight',
    visibleLede:
      'Objects that climb above 20° during astronomical darkness — window, peak altitude, and where to look.',
    planAhead: 'Planning another night',
    peakDetail: '{degrees}° to the {direction}',
    peakAt: 'at {time}',
  },

  milkyWay: {
    heading: 'Milky Way core',
    verdict: {
      good: 'A good night for the Milky Way',
      limited: 'Possible, with caveats',
      no: 'Not a Milky Way night',
    },
    reason: {
      belowHorizon:
        'The galactic core stays below the horizon all night — it is not the season yet.',
      tooLow: 'The core only reaches {degrees}°, too low to shoot through the haze.',
      moonWashout: 'The core is up, but a {percent}% moon erases its contrast.',
      shortWindow: 'The window is short — be set up before the core peaks.',
      good: 'The core reaches {degrees}° under dark sky, with no real moon interference.',
    },
  },

  moon: {
    heading: 'Moon',
    rise: 'rises {time}',
    set: 'sets {time}',
    phase: {
      new: 'New Moon',
      waxingCrescent: 'Waxing Crescent',
      firstQuarter: 'First Quarter',
      waxingGibbous: 'Waxing Gibbous',
      full: 'Full Moon',
      waningGibbous: 'Waning Gibbous',
      lastQuarter: 'Last Quarter',
      waningCrescent: 'Waning Crescent',
    },
  },

  weather: {
    heading: 'Cloud cover',
    forecastPoint: 'Forecast point',
    distanceAway: '{km} km from the point you picked',
    time: 'Time',
    cloud: 'Cloud',
    temp: 'Temp',
    humidity: 'Humidity',
    condition: 'Condition',
    darkRowNote: 'Marked rows fall inside tonight\u2019s astronomical darkness',
    darkRowMarker: 'dark window',
    unavailable: 'No forecast available for this location.',
  },

  moonCalendar: {
    heading: 'Next dark nights',
    summaryWithRun: 'Darkness per night over the next {count} nights. Darkest stretch {run}.',
    summary: 'Darkness per night over the next {count} nights.',
    legend:
      'Tall bar = dark night. The lit colour marks nights dark enough to be worth the drive.',
  },

  compass: {
    short: { n: 'N', ne: 'NE', e: 'E', se: 'SE', s: 'S', sw: 'SW', w: 'W', nw: 'NW' },
    long: {
      n: 'north', ne: 'northeast', e: 'east', se: 'southeast',
      s: 'south', sw: 'southwest', w: 'west', nw: 'northwest',
    },
  },

  summary: {
    darkSpan: 'Astronomical darkness from {start} to {end} {tz}, {duration}.',
    moonDown: '{phase} {percent}% stays below the horizon all night — no interference at all.',
    moonDominates:
      '{phase} {percent}% lights {share}% of the night — faint targets will be swallowed.',
    moonMinor: '{phase} {percent}% only covers {share}% of the night, so the rest is clean.',
    coreWindow: 'The Milky Way core is usable {from}–{to}, peaking at {degrees}° to the {direction}.',
    bestObject: 'The highest object tonight is {name}, reaching {degrees}° to the {direction}.',
    cloudHeavy: 'BMKG closes the night out at {percent}% cloud.',
    cloudMixed:
      'BMKG gives {percent}% average cloud cover — there may be gaps, but nothing is promised.',
    cloudLight: 'BMKG gives {percent}% average cloud cover across the dark window.',
  },

  meteor: {
    heading: 'Meteor showers',
    detail: '{date} · radiant {degrees}° · up to {zhr}/hr',
    moonAffected: 'moon-affected',
    caveat:
      'The hourly figure assumes a perfect sky with the radiant overhead — in the field it is always fewer.',
    peakTonight: 'peaks tonight',
    peakTomorrow: 'peaks tomorrow night',
    peakLastNight: 'peaked last night',
    peakNightsAgo: 'peaked {count} nights ago',
    nightsAway: '{count} nights away',
  },

  bortle: {
    1: 'Pristine dark sky — the Milky Way shows fine detail',
    2: 'Truly dark sky — the Milky Way is bright and structured',
    3: 'Rural sky — the Milky Way is still obvious',
    4: 'Rural/suburban transition — the Milky Way shows overhead',
    5: 'Suburban sky — the Milky Way is faint and easily lost',
    6: 'Bright suburban sky — the Milky Way is effectively invisible',
    7: 'Suburban/urban transition — a bright grey sky throughout',
    8: 'City sky — only the brightest stars get through',
    9: 'Inner city — almost no stars are visible',
  },

  units: {
    km: 'km',
    degrees: '°',
    percent: '%',
    hours_one: '{count} hour',
    hours_other: '{count} hours',
    minutes_one: '{count} minute',
    minutes_other: '{count} minutes',
    hoursMinutes: '{hours} h {minutes} min',
  },

  errors: {
    lpMeta: 'Could not load the light pollution metadata.',
    lpGrid: 'Could not load the light pollution grid.',
    wilayahIndex: 'Could not load the district index.',
    forecastEmpty: 'No forecast is available for this location.',
    forecastFetch: 'Could not reach the BMKG forecast.',
    nightWindow: 'Could not work out the dark window for this location.',
  },
}

/**
 * Structure is required, values are free.
 *
 * Without the widening step `en` would be inferred with literal string types under
 * `as const`, and `id.ts` could only ever repeat the English text verbatim.
 */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof en>
