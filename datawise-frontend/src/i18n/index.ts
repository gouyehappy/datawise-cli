import {createI18n} from 'vue-i18n'
import {ref} from 'vue'
import zhCN from './locales/zh-CN/index'
import enUS from './locales/en-US/index'

export type AppLocale = 'zh-CN' | 'en-US'

export const LOCALE_STORAGE_KEY = 'dw-cli-locale'
const DEFAULT_LOCALE: AppLocale = 'zh-CN'

const messages = {
    'zh-CN': zhCN,
    'en-US': enUS,
}

function readStoredLocale(): AppLocale {
    if (typeof localStorage === 'undefined') return DEFAULT_LOCALE
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored === 'en-US' ? 'en-US' : DEFAULT_LOCALE
}

export const currentLocale = ref<AppLocale>(readStoredLocale())

export const i18n = createI18n({
    legacy: false,
    locale: currentLocale.value,
    fallbackLocale: DEFAULT_LOCALE,
    messages,
})

export function setLocale(locale: AppLocale) {
    currentLocale.value = locale
    i18n.global.locale.value = locale
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
}

export function toggleLocale() {
    setLocale(currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
}

/** 在非组件代码（store / service）中使用 */
export function t(key: string, values?: Record<string, unknown>): string {
    return i18n.global.t(key, values ?? {})
}
