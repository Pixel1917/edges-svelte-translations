# 🌍 edges-svelte-translations

**Elegant, type-safe and SSR-friendly internationalization for your [edges-svelte](https://github.com/Pixel1917/edge-s) app.**

This package provides a powerful translation provider with:
✅ Full SSR support  
✅ Client-side lazy switching  
✅ Cookie-based locale persistence  
✅ Automatic `<html lang>` updates  
✅ Pluralization and variable interpolation  
✅ Type-safe keys  
✅ Simple integration with `edges-svelte`

---

## 📦 Requirements

This plugin requires **[`edges-svelte`](https://github.com/Pixel1917/edge-s)** to work properly.  
Install both packages:

```bash
npm install edges-svelte edges-svelte-translations
```

or if you already use **[`edges-svelte`](https://github.com/Pixel1917/edge-s)** just

```bash
npm install edges-svelte-translations
```

---

## 🚀 Quick Start

### 1. Define Translations

Export your translation modules:

```ts
// $lib/translations/messages/index.ts or whereever you want
export const messages = {
	en: () => import('./en.js').then((res) => res.default),
	ru: () => import('./ru.js').then((res) => res.default)
};
```

Each translation file (e.g., `en.js`, `ru.js`) should export a default object containing the translations.

## 🗣️ Example Translations

Example translation files:

**English (`en.js`):**

```js
export default {
	someText: 'some text',
	testVars: 'Test variable: {{someVar}}',
	testPlural: 'You have {{ count | plural: item, items }}',
	home: {
		routeName: 'Home'
	}
};
```

**Russian (`ru.js`):**

```js
export default {
	someText: 'некий текст',
	testVars: 'Тестовая переменная: {{someVar}}',
	testPlural: 'У вас {{ count | plural: предмет, предмета, предметов }}',
	home: {
		routeName: 'Главная'
	}
};
```

---

### 2. Initialize Translations

Initialize the translation provider:

```ts
// $lib/translations/index.ts or whereever you want
import { messages } from './messages';
import { createTranslations } from 'edges-svelte-translations';

export const TranslationProvider = createTranslations({
	messages,
	initLang: 'en',
	initLangFromAcceptLanguage: true,
	cookieName: 'lang'
});
```

---

### 3. Configure edges-svelte and translations in hooks

In `src/hooks.server.ts`, configure the edge middleware:

```ts
// src/hooks.server.ts
import { dev } from '$app/environment';
import { edgesHandle } from 'edges-svelte/server';
import { type Handle } from '@sveltejs/kit';
import { TranslationProvider } from '$lib/translations';

export const handle: Handle = async ({ event, resolve }) => {
	return edgesHandle(
		event,
		async ({ edgesEvent, serialize }) => {
			const { preloadTranslation, applyHtmlLocaleAttr } = TranslationProvider();
			await preloadTranslation(edgesEvent);
			return resolve(edgesEvent, {
				transformPageChunk: ({ html }) => {
					const serialized = serialize(html);
					return applyHtmlLocaleAttr(serialized);
				}
			});
		},
		dev
	);
};
```

---

### 4. Synchronize Translations on Client

In `src/routes/+layout.ts`, synchronize translations on the client. There are two ways:
First way - provide to syncTranslation only lang and false as second argument. This way will load all you translations again bun on the client.

```ts
// src/routes/+layout.server.ts
import { TranslationProvider } from '$lib/translation';
import { browser } from '$app/environment';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { lang: locals.lang };
};

// src/routes/+layout.ts
import { TranslationProvider } from '$lib/translation';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types.js';

export const load: LayoutLoad = async ({ data }) => {
	const { syncTranslation } = TranslationProvider();
	if (browser) {
		await syncTranslation({ lang: data.lang }, false);
	}
};
```

Second way - provide to syncTranslation lang and translations from locals and true as second argument (or without second argument). This way will load translations from locals to sync translations from server, but page.data may be huge (states from page.data will store in your html and your html will be huge too).

```ts
// src/routes/+layout.server.ts
import { TranslationProvider } from '$lib/translation';
import { browser } from '$app/environment';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { lang: locals.lang, translations: locals.translations };
};

// src/routes/+layout.ts
import { TranslationProvider } from '$lib/translation';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types.js';

export const load: LayoutLoad = async ({ data }) => {
	const { syncTranslation } = TranslationProvider();
	if (browser) {
		await syncTranslation({ lang: data.lang, translations: data.translations });
	}
};
```

The first approach reduces the initial state size but may result in additional translation loading on the client. The second approach includes translations in the initial state, increasing the payload size but potentially reducing client-side translation loading.

---

## 🧩 Usage in Svelte Components

In your Svelte components, use the translation provider:

```svelte
<script lang="ts">
	import { TranslationProvider } from '../lib/translation/index.js';

	const { t, locale, switchLocale } = TranslationProvider();
</script>

<p>{$t('testVars', { someVar: 555 })}</p>
<p>3 - {$t('testPlural', { count: 3 })}</p>
<p>1 - {$t('testPlural', { count: 1 })}</p>
<p>5 - {$t('testPlural', { count: 5 })}</p>
<button onclick={() => switchLocale($locale === 'ru' ? 'en' : 'ru')}>
	Current lang - {$locale}. Switch
</button>
```

---

## 🍪 Cookie-Based Language Initialization

You can set `cookieName` to use and sync plugin current language with cookies automatically:

```ts
// src/lib/translation/index.ts
import { messages } from './locales/index.js';
import { createTranslations } from 'edges-svelte';

export const TranslationProvider = createTranslations({
	messages,
	initLang: 'ru',
	cookieName: 'lang'
});
```

---

## 🗂️ API

### `createTranslations(options)`

| Option                       | Description                                                   | Required |
| ---------------------------- | ------------------------------------------------------------- | -------- |
| `messages`                   | An object where each locale maps to an async import function. | ✅       |
| `initLang`                   | Fallback language.                                            | ✅       |
| `cookieName`                 | Cookie key for saving user language.                          | Optional |
| `initLangFromAcceptLanguage` | If true, auto-detects language from `Accept-Language`.        | Optional |

### Provider Methods

| Method                           | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `preloadTranslation(event)`      | Loads translations on server.                            |
| `syncTranslation(data)`          | Syncs server data on client.                             |
| `switchLocale(locale)`           | Switches language on client.                             |
| `t(key, vars?)`                  | Translate with optional variables.                       |
| `locale`                         | Reactive store with current locale.                      |
| `applyHtmlLocaleAttr(html)`      | Replace `%lang%` in rendered HTML with current language. |
| `subscribeLocaleChangeEvent(cb)` | Listen to locale changes.                                |

---

## 🔢 Pluralization

This package has built-in pluralization for both **2-form** (English) and **3-form** (Slavic languages) rules.

**Syntax:**

Use `| plural: one, few, many` inside your strings:

```json
{
	"cart_items": "You have {{ count | plural: item, items }}.",
	"cart_items_ru": "У вас {{ count }} {{ count | plural: товар, товара, товаров }}."
}
```

**How it works:**

- For 2-form languages (like English):

  - `item` → singular (`1`)
  - `items` → plural (`0, 2, 3, ...`)

- For 3-form languages (like Russian, Ukrainian):
  - `товар` → singular (`1`)
  - `товара` → few (`2, 3, 4`)
  - `товаров` → many (`0, 5, 6, ...`)

If you pass a variable that is not a number, it logs a warning and returns an empty string.

---

## License

[MIT](./LICENSE)

---

## ✨ Made for [edges-svelte](https://github.com/Pixel1917/edge-s)

---

Crafted with ❤️ by Pixel1917.
