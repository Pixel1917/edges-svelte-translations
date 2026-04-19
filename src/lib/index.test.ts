import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createTranslations, type Translation } from './index.js';

const { requestContextMock } = vi.hoisted(() => {
	const state = {
		getter: () =>
			({
				event: undefined,
				symbol: Symbol('request'),
				data: { providers: new Map() }
			}) as unknown
	};
	return {
		requestContextMock: {
			init(getter: () => unknown) {
				state.getter = getter;
			},
			current() {
				return state.getter();
			}
		}
	};
});

vi.mock('@azure-net/edges', () => ({
	createStore: <T>(nameOrFactory: string | ((deps: unknown) => T), maybeFactory?: (deps: unknown) => T) => {
		const factory = (typeof nameOrFactory === 'string' ? maybeFactory : nameOrFactory)!;
		return () => {
			const createState = <V>(initial: V) => {
				let value = initial;
				const listeners = new Set<(v: V) => void>();
				return {
					subscribe(run: (v: V) => void) {
						run(value);
						listeners.add(run);
						return () => listeners.delete(run);
					},
					set(next: V) {
						value = next;
						listeners.forEach((listener) => listener(value));
					},
					update(updater: (current: V) => V) {
						value = updater(value);
						listeners.forEach((listener) => listener(value));
					}
				};
			};

			const createDerivedState = <S extends Array<{ subscribe: (run: (value: unknown) => void) => () => void }>, R>(
				stores: S,
				deriveFn: (values: unknown[]) => R
			) => {
				return {
					subscribe(run: (value: R) => void) {
						const values = new Array(stores.length);
						let initialized = 0;
						const unsubs = stores.map((store, idx) =>
							store.subscribe((next) => {
								if (initialized < stores.length && values[idx] === undefined) initialized += 1;
								values[idx] = next;
								if (initialized >= stores.length) run(deriveFn(values));
							})
						);
						return () => unsubs.forEach((unsub) => unsub());
					}
				};
			};

			return factory({ createState, createDerivedState });
		};
	}
}));

vi.mock('@azure-net/edges/context', () => ({
	RequestContext: requestContextMock
}));

vi.mock('$app/environment', () => ({
	browser: false
}));

class MockCookies {
	constructor(private readonly data: Record<string, string | undefined>) {}

	get(name: string): string | undefined {
		return this.data[name];
	}

	set(): void {}
}

const makeEvent = (args?: {
	cookies?: Record<string, string | undefined>;
	acceptLanguage?: string;
	lang?: string;
	translations?: Translation;
}): RequestEvent => {
	const url = new URL('http://localhost/test');
	const headers = new Headers();
	if (args?.acceptLanguage) {
		headers.set('accept-language', args.acceptLanguage);
	}

	return {
		url,
		request: new Request(url, { headers }),
		cookies: new MockCookies(args?.cookies ?? {}),
		locals: {
			lang: args?.lang,
			translations: args?.translations
		}
	} as unknown as RequestEvent;
};

const runWithRequest = async <T>(event: RequestEvent, run: () => Promise<T> | T): Promise<T> => {
	const context = {
		event,
		symbol: Symbol('request'),
		data: { providers: new Map() }
	};
	requestContextMock.init(() => context as never);
	return await run();
};

type TranslatorFn = (translation?: string | { key: string; vars?: Record<string, unknown> }, vars?: Record<string, unknown>) => string;

type ProviderApi = {
	preloadTranslation: (callback?: () => 'en' | 'ru') => Promise<void>;
	syncTranslation: (data: { translations?: Translation; lang: string }, fromEvent?: boolean) => Promise<void>;
	switchLocale: (locale: 'en' | 'ru') => Promise<void>;
	applyHtmlLocaleAttr: (html: string) => string;
	subscribeLocaleChangeEvent: (listener: (data: 'en' | 'ru') => void) => () => void;
	t: { subscribe: (run: (value: TranslatorFn) => void) => () => void };
	locale: { subscribe: (run: (value: 'en' | 'ru' | undefined) => void) => () => void };
	locales: Record<'en' | 'ru', 'en' | 'ru'>;
};

const readStoreValue = <T>(subscribe: (run: (value: T) => void) => () => void): T => {
	let value!: T;
	const unsubscribe = subscribe((next) => {
		value = next;
	});
	unsubscribe();
	return value;
};

const readTranslation = (provider: ProviderApi, key: string, vars?: Record<string, unknown>) => {
	const translator = readStoreValue(provider.t.subscribe);
	return translator(key, vars);
};

const createTestSetup = () => {
	const calls = { en: 0, ru: 0 };
	const messages = {
		en: async () => {
			calls.en += 1;
			return {
				home: { routeName: 'Home' },
				msg: 'Hello {{name}}',
				plural: 'You have {{ count | plural: item, items }}'
			};
		},
		ru: async () => {
			calls.ru += 1;
			return {
				home: { routeName: 'Главная' },
				msg: 'Привет {{name}}',
				plural: 'У вас {{ count | plural: предмет, предмета, предметов }}'
			};
		}
	};

	const useProvider = createTranslations<typeof messages, 'home.routeName' | 'msg' | 'plural'>({
		messages,
		initLang: 'en',
		cookieName: 'lang',
		initLangFromAcceptLanguage: true
	});

	return { useProvider, calls };
};

describe('createTranslations (SSR + load behavior)', () => {
	it('preloads default init language when no cookie/header', async () => {
		const { useProvider, calls } = createTestSetup();
		const event = makeEvent();

		const translated = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			expect(readStoreValue(provider.locale.subscribe)).toBe('en');
			return readTranslation(provider, 'home.routeName');
		});

		expect(event.locals.lang).toBe('en');
		expect(calls.en).toBe(1);
		expect(translated).toBe('Home');
	});

	it('uses cookie language over accept-language and initLang', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'ru' }, acceptLanguage: 'en-US,en;q=0.9' });

		const translated = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'home.routeName');
		});

		expect(event.locals.lang).toBe('ru');
		expect(translated).toBe('Главная');
	});

	it('uses accept-language when cookie is missing and detection enabled', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ acceptLanguage: 'ru-RU,ru;q=0.9,en;q=0.8' });

		const currentLocale = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readStoreValue(provider.locale.subscribe);
		});

		expect(event.locals.lang).toBe('ru');
		expect(currentLocale).toBe('ru');
	});

	it('falls back to init language when requested language is unsupported', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'de' }, acceptLanguage: 'de-DE,de;q=0.9' });

		await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
		});

		expect(event.locals.lang).toBe('en');
	});

	it('supports explicit callback language override in preload', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'en' } });

		const currentLocale = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation(() => 'ru');
			return readStoreValue(provider.locale.subscribe);
		});

		expect(event.locals.lang).toBe('ru');
		expect(currentLocale).toBe('ru');
	});

	it('does not overwrite prefilled locals language/translations', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({
			lang: 'ru',
			translations: {
				home: { routeName: 'Custom' }
			}
		});

		const translated = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'home.routeName');
		});

		expect(event.locals.lang).toBe('en');
		expect(translated).toBe('Custom');
	});

	it('throws when syncTranslation is called on server', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent();

		await expect(
			runWithRequest(event, async () => {
				const provider = useProvider() as ProviderApi;
				await provider.preloadTranslation();
				await provider.syncTranslation({ lang: 'de' });
			})
		).rejects.toThrow('Do no sync translations on server side');
	});

	it('throws when syncTranslation with fromEvent=true is called on server', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent();

		await expect(
			runWithRequest(event, async () => {
				const provider = useProvider() as ProviderApi;
				await provider.preloadTranslation();
				await provider.syncTranslation(
					{
						lang: 'ru',
						translations: { home: { routeName: 'Injected' } }
					},
					true
				);
			})
		).rejects.toThrow('Do no sync translations on server side');
	});

	it('does not allow repeated syncTranslation calls on server', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent();

		await expect(
			runWithRequest(event, async () => {
				const provider = useProvider() as ProviderApi;
				await provider.preloadTranslation();
				await provider.syncTranslation({ lang: 'ru' });
				await provider.syncTranslation({ lang: 'en' });
			})
		).rejects.toThrow('Do no sync translations on server side');
	});

	it('keeps per-request locale isolated between different requests', async () => {
		const { useProvider } = createTestSetup();
		const firstEvent = makeEvent({ cookies: { lang: 'ru' } });
		const secondEvent = makeEvent({ cookies: { lang: 'en' } });

		const first = await runWithRequest(firstEvent, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'home.routeName');
		});

		const second = await runWithRequest(secondEvent, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'home.routeName');
		});

		expect(first).toBe('Главная');
		expect(second).toBe('Home');
		expect(firstEvent.locals.lang).toBe('ru');
		expect(secondEvent.locals.lang).toBe('en');
	});
});

describe('createTranslations (formatting + API behavior)', () => {
	it('interpolates variables in messages', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'en' } });

		const translated = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'msg', { name: 'Alice' });
		});

		expect(translated).toBe('Hello Alice');
	});

	it('applies 2-form pluralization for english', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'en' } });

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return {
				one: readTranslation(provider, 'plural', { count: 1 }),
				many: readTranslation(provider, 'plural', { count: 3 })
			};
		});

		expect(result.one).toBe('You have item');
		expect(result.many).toBe('You have items');
	});

	it('applies 3-form pluralization for russian', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'ru' } });

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return {
				one: readTranslation(provider, 'plural', { count: 1 }),
				few: readTranslation(provider, 'plural', { count: 2 }),
				many: readTranslation(provider, 'plural', { count: 5 })
			};
		});

		expect(result.one).toBe('У вас предмет');
		expect(result.few).toBe('У вас предмета');
		expect(result.many).toBe('У вас предметов');
	});

	it('warns and returns empty plural token when count is not numeric', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'en' } });
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'plural', { count: 'oops' });
		});

		expect(result).toBe('You have ');
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it('returns original key when translation path does not exist', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'en' } });

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return readTranslation(provider, 'missing.path');
		});

		expect(result).toBe('missing.path');
	});

	it('applyHtmlLocaleAttr replaces placeholder with server locale', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'ru' } });

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return provider.applyHtmlLocaleAttr('<html lang="%lang%"><body>ok</body></html>');
		});

		expect(result).toBe('<html lang="ru"><body>ok</body></html>');
	});

	it('applyHtmlLocaleAttr leaves html unchanged when locale is invalid', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ lang: 'de' });

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			return provider.applyHtmlLocaleAttr('<html lang="%lang%"><body>ok</body></html>');
		});

		expect(result).toBe('<html lang="%lang%"><body>ok</body></html>');
	});

	it('throws on switchLocale from server runtime', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent({ cookies: { lang: 'en' } });

		await expect(
			runWithRequest(event, async () => {
				const provider = useProvider() as ProviderApi;
				await provider.preloadTranslation();
				await provider.switchLocale('ru');
			})
		).rejects.toThrow('Do not switch locale on server side');
	});

	it('exposes a stable locales map', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent();

		const result = await runWithRequest(event, async () => {
			const provider = useProvider() as ProviderApi;
			await provider.preloadTranslation();
			return provider.locales;
		});

		expect(result).toEqual({ en: 'en', ru: 'ru' });
	});

	it('throws when locale change listener subscription is attempted on server', async () => {
		const { useProvider } = createTestSetup();
		const event = makeEvent();

		await expect(
			runWithRequest(event, async () => {
				const provider = useProvider() as ProviderApi;
				provider.subscribeLocaleChangeEvent(() => {});
			})
		).rejects.toThrow('Do no subscribe to change event on server side');
	});
});
