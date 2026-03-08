import { baseLocale, i18nObject } from './i18n-util.js';
import { loadAllLocales } from './i18n-util.sync.js';

loadAllLocales();

export const defaultLocale = baseLocale;
export const LL = i18nObject(defaultLocale);
