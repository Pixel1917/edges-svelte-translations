import { createStore } from 'edges-svelte';
import { RequestContext } from 'edges-svelte/context';
import { browser } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';

export type Path<T, Prefix extends string = ''> = T extends object
	? {
			[K in keyof T & string]: T[K] extends object ? Path<T[K], `${Prefix}${K}.`> : `${Prefix}${K}`;
		}[keyof T & string]
	: never;
export type Translation = string | { [key: string]: Translation };

export const createTranslations = <
	T extends Record<string, () => Promise<Translation>>,
	TParam extends Path<Awaited<ReturnType<T[keyof T]>>>
>(params: {
	messages: T;
	initLang: keyof T;
	cookieName?: string;
	initLangFromAcceptLanguage?: boolean;
}) => {
	type AvailableLocales = keyof typeof params.messages;

	type TranslationExtended = { key: TParam | string; vars?: Record<string, unknown> };

	const translations: Partial<Record<AvailableLocales, Translation>> = {};
	const channels: Map<'localeChanged', ((data: AvailableLocales) => void)[]> = new Map();

	const pluralize = (num: number, titles: string[]): string => {
		if (titles.length !== 2 && titles.length !== 3) {
			throw new Error('Titles array in plural func must have 2 or 3 elements');
		}

		const number = Math.abs(num);

		if (titles.length === 2) {
			return number === 1 ? titles[0]! : titles[1]!;
		} else {
			const cases = [2, 0, 1, 1, 1, 2];
			if (number % 100 > 4 && number % 100 < 20) {
				return titles[2]!;
			}
			return titles[cases[number % 10 < 5 ? number % 10 : 5]!]!;
		}
	};

	return createStore('EdgesTranslationsLocalesStore', ({ createState, createDerivedState }) => {
		const locale = createState<keyof T | undefined>(undefined);
		const t = createDerivedState<[typeof locale], (translation?: TParam | TranslationExtended | string, vars?: Record<string, unknown>) => string>(
			[locale],
			([$locale]) => {
				return (translation?: TParam | TranslationExtended | string, vars?: Record<string, unknown>) => {
					const key = typeof translation === 'object' ? translation.key : translation;
					const variables = typeof translation === 'object' ? translation.vars : vars;
					return key ? translate(String($locale), key, variables ?? {}) : '';
				};
			}
		);
		const locales: Record<keyof T, keyof T> = Object.keys(params.messages).reduce(
			(acc, curr) => {
				acc[curr as keyof typeof acc] = curr;
				return acc;
			},
			{} as Record<keyof T, keyof T>
		);

		const checkLang = (lang?: string | AvailableLocales): AvailableLocales | undefined => {
			return lang && lang in locales ? locales[lang] : undefined;
		};

		const getLocaleToSet = (event: RequestEvent) => {
			const cookieLang = params.cookieName ? checkLang(event?.cookies.get(params.cookieName)) : undefined;
			const requestLang = params.initLangFromAcceptLanguage
				? event?.request.headers.get('accept-language')?.split(',')[0].substring(0, 2)
				: undefined;
			const baseLang = checkLang(requestLang) ?? params.initLang;
			return cookieLang ?? baseLang;
		};

		const preloadTranslation = async (event: RequestEvent, callback?: () => AvailableLocales) => {
			const lang = callback ? callback() : getLocaleToSet(event);
			if (event && !event.locals.translations && !event.locals.lang) {
				event.locals.translations = event.locals.translations ?? (await params.messages[lang]());
				event.locals.lang = lang as string;
				locale.set(lang);
			}
		};

		const syncTranslation = async <T extends { translations?: Translation; lang: string }>(data: T, fromEvent = true) => {
			const langToSync = checkLang(data.lang) ?? params.initLang;
			if (fromEvent && data.translations) {
				translations[langToSync] = data.translations;
			} else {
				await loadTranslation(langToSync);
			}
		};

		const getTranslations = (locale: AvailableLocales) => {
			return !browser ? RequestContext.current().event?.locals.translations : translations[locale];
		};

		const translate = (locale?: AvailableLocales, messageKey?: string, vars: Record<string, unknown> = {}): string => {
			if (!messageKey) return '';
			if (!locale) return messageKey;
			const currentTranslation = getTranslations(locale);
			if (!currentTranslation) return messageKey;

			const messageKeys = messageKey.split('.');

			let result = messageKeys.reduce<Translation>((acc, key) => {
				if (typeof acc === 'string') {
					return acc;
				} else if (typeof acc === 'object' && key in acc) {
					return acc[key];
				}
				return messageKey;
			}, currentTranslation);

			if (typeof result === 'string') {
				result = result.replace(/{{\s*(\w+)\s*\|\s*plural\s*:(.*?)}}/g, (_, varName: string, titlesStr: string) => {
					const titles = titlesStr.split(',').map((t) => t.trim());
					const count = Number(vars[varName]);
					if (Number.isNaN(count)) {
						console.warn(`Pluralization failed: variable "${varName}" is not a number.`);
						return '';
					}
					return pluralize(count, titles);
				});

				result = result.replace(/{{\s*(\w+)\s*}}/g, (_, k) => {
					return vars[k] !== undefined ? String(vars[k]) : '';
				});

				return result;
			}
			return messageKey;
		};

		const loadTranslation = async (lang: AvailableLocales) => {
			if (!lang || !(lang in params.messages)) {
				throw Error('Lang is missing in messages');
			}
			if (!translations[lang]) {
				translations[lang] = await params.messages[lang]();
			}
		};

		const localeChangeEvent = (locale: AvailableLocales) => {
			const listeners = channels.get('localeChanged');
			if (!listeners || listeners.length === 0) {
				return;
			}
			listeners.forEach((listener) => listener(locale));
		};

		const subscribeLocaleChangeEvent = (listener: (data: AvailableLocales) => void): void => {
			if (!channels.has('localeChanged')) {
				channels.set('localeChanged', []);
			}
			channels.get('localeChanged')!.push(listener);
		};

		const switchLocale = async (newLocale: AvailableLocales) => {
			if (browser) {
				await loadTranslation(newLocale);
				locale.set(newLocale);
				if (params.cookieName) {
					document.cookie = `${encodeURIComponent(params.cookieName)}=${encodeURIComponent(String(newLocale))}; path=/`;
				}
				const html = document.querySelector('html');
				if (html) {
					html.lang = String(newLocale);
				}
				localeChangeEvent(newLocale);
			} else {
				throw Error('Do not switch locale on server side');
			}
		};

		const applyHtmlLocaleAttr = (html: string) => {
			const event = RequestContext.current().event;
			const lang = checkLang(event?.locals?.lang);
			if (lang) {
				return html.replace('%lang%', String(lang));
			}
			return html;
		};

		return { preloadTranslation, syncTranslation, switchLocale, applyHtmlLocaleAttr, subscribeLocaleChangeEvent, t, locale, locales };
	});
};
