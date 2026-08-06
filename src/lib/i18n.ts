/**
 * Minimal translation layer.
 *
 * Hand-rolled rather than vue-i18n: two locales and a few hundred strings do not
 * need ICU, and this keeps `translate` a pure function that can be unit-tested like
 * everything else in `src/lib/`. The reactive wrapper lives in
 * `src/composables/useI18n.ts`; nothing here knows about Vue.
 */

export type Locale = 'en' | 'id'

export const LOCALES: readonly Locale[] = ['en', 'id']

/** A string that exists in both languages. Used for catalogue content. */
export type Localized = Record<Locale, string>

/**
 * A parameter may itself be a translatable phrase.
 *
 * "{phase} ({percent}%)" needs the phase name translated before it is substituted.
 * Making that an `I18nText` keeps it explicit and type-checked; the alternative --
 * passing a bare key string and hoping the render layer knows to resolve it -- is
 * indistinguishable from ordinary text and breaks silently.
 */
/**
 * A parameter may be plain text, a number, another translatable phrase, or a piece
 * of already-bilingual data.
 *
 * The last two matter: "{phase} ({percent}%)" needs the phase name translated before
 * substitution, and "{name} reaches 40°" needs a catalogue name picked for the
 * current language. Modelling both explicitly keeps them type-checked; passing a
 * bare key string and hoping the render layer resolves it would be indistinguishable
 * from ordinary text and would break silently.
 */
export type TranslationParams = Record<string, string | number | I18nText | Localized>

/**
 * A message key plus whatever it needs interpolated.
 *
 * This is what `src/lib/` returns instead of a finished sentence. Domain code
 * decides *what* to say; only the render layer decides in which language.
 */
export interface I18nText {
  key: string
  params?: TranslationParams
}

function isI18nText(value: unknown): value is I18nText {
  return typeof value === 'object' && value !== null && 'key' in value
}

function isLocalized(value: unknown): value is Localized {
  return typeof value === 'object' && value !== null && 'en' in value && 'id' in value
}

export interface MessageTree {
  [key: string]: string | MessageTree
}

const PLACEHOLDER = /\{(\w+)\}/g

function lookup(dict: MessageTree, path: string): string | undefined {
  let node: string | MessageTree | undefined = dict
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[segment]
  }
  return typeof node === 'string' ? node : undefined
}

/**
 * Resolves `key` against `dict` and fills in `params`.
 *
 * A missing key returns the key itself. That is deliberately conspicuous: an
 * untranslated string reads as "score.rating.4" in the UI, which someone notices,
 * whereas an empty string silently leaves a hole.
 *
 * When `params.count` is present, `key_one` / `key_other` are preferred if they
 * exist. Indonesian does not inflect for number, so `id.ts` simply defines the base
 * key and the variants are never looked for.
 */
export function translate(
  dict: MessageTree,
  key: string,
  params?: TranslationParams,
  locale: Locale = 'en',
): string {
  let template: string | undefined
  if (params && typeof params.count === 'number') {
    template = lookup(dict, `${key}${params.count === 1 ? '_one' : '_other'}`)
  }
  template ??= lookup(dict, key)
  if (template === undefined) return key
  if (!params) return template

  return template.replace(PLACEHOLDER, (match, name: string) => {
    if (!(name in params)) return match
    const value = params[name]
    if (isI18nText(value)) return translate(dict, value.key, value.params, locale)
    if (isLocalized(value)) return value[locale]
    return String(value)
  })
}

/** Resolves an `I18nText` produced by domain code. */
export function translateText(dict: MessageTree, text: I18nText, locale: Locale = 'en'): string {
  return translate(dict, text.key, text.params, locale)
}

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'id'
}

/**
 * Which language to open in.
 *
 * English is the default, but a visitor whose browser asks for Indonesian gets
 * Indonesian -- most of this app's audience is in Indonesia, and defaulting them to
 * a second language would be a small insult repeated every visit. An explicit choice
 * always wins and is what `localStorage` holds.
 *
 * Pure so the rule can be tested without a DOM; the caller supplies
 * `navigator.languages`.
 */
export function resolveInitialLocale(
  stored: string | null,
  languages: readonly string[],
): Locale {
  if (isLocale(stored)) return stored

  for (const tag of languages) {
    // Compare subtags so "id-ID" matches but "yi" and "hid" do not.
    const primary = tag.toLowerCase().split('-')[0]
    if (isLocale(primary)) return primary
  }
  return 'en'
}
