import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import { en } from '@/locales/en'
import { id } from '@/locales/id'
import {
  translate,
  translateText,
  type I18nText,
  type Locale,
  type Localized,
  type MessageTree,
  type TranslationParams,
  resolveInitialLocale,
} from '@/lib/i18n'

const DICTIONARIES: Record<Locale, MessageTree> = {
  en: en as unknown as MessageTree,
  id: id as unknown as MessageTree,
}

const STORAGE_KEY = 'lw.locale'

export interface I18n {
  locale: Ref<Locale>
  setLocale(next: Locale): void
  /** Resolve a message key with optional interpolation. */
  t(key: string, params?: TranslationParams): string
  /** Resolve an `I18nText` produced by domain code in `src/lib/`. */
  tx(text: I18nText): string
  /** Pick the active language from a piece of bilingual catalogue data. */
  pick(value: Localized): string
}

const KEY: InjectionKey<I18n> = Symbol('i18n')

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private browsing and some embedded webviews throw on access rather than
    // returning null. A missing preference is not worth breaking startup over.
    return null
  }
}

/** Creates the shared instance. Called once, from App.vue. */
export function provideI18n(): I18n {
  const locale = ref<Locale>(
    resolveInitialLocale(readStored(), navigator.languages ?? [navigator.language]),
  )

  const dict = computed(() => DICTIONARIES[locale.value])

  function setLocale(next: Locale) {
    locale.value = next
    document.documentElement.lang = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference simply will not persist; the app still works this session.
    }
  }

  document.documentElement.lang = locale.value

  const api: I18n = {
    locale,
    setLocale,
    t: (key, params) => translate(dict.value, key, params, locale.value),
    tx: (text) => translateText(dict.value, text, locale.value),
    pick: (value) => value[locale.value],
  }

  provide(KEY, api)
  return api
}

export function useI18n(): I18n {
  const api = inject(KEY)
  if (!api) throw new Error('useI18n() called outside a component tree with provideI18n()')
  return api
}
