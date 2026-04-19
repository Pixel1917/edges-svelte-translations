# @azure-net/edges-translations

**Elegant, type-safe and SSR-friendly internationalization for your [`@azure-net/edges`](https://www.npmjs.com/package/@azure-net/edges) app.**

This package provides a powerful translation provider with:

- Full SSR support
- Client-side lazy switching
- Cookie-based locale persistence
- Automatic `<html lang>` updates
- Pluralization and variable interpolation
- Type-safe keys
- Simple integration with `@azure-net/edges`

---

## 📦 Requirements

This plugin requires **[`@azure-net/edges`](https://www.npmjs.com/package/@azure-net/edges)** to work properly.  
Install both packages:

```bash
npm install @azure-net/edges @azure-net/edges-translations
```

or if you already use **`@azure-net/edges`** just

```bash
npm install @azure-net/edges-translations
```

---

## Quick Start

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

## Example Translations

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
import { createTranslations } from '@azure-net/edges-translations';

export const TranslationProvider = createTranslations({
	messages,
	initLang: 'en',
	initLangFromAcceptLanguage: true,
	cookieName: 'lang'
});
```

---

### 3. Configure `@azure-net/edges` and translations in hooks

In `vite.config.ts`, ensure the edges plugin is enabled:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from '@azure-net/edges/plugin';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin()]
});
```

In `src/hooks.server.ts`, preload translations and apply `lang` attr:

```ts
// src/hooks.server.ts
import { type Handle } from '@sveltejs/kit';
import { TranslationProvider } from '$lib/translations';

export const handle: Handle = async ({ event, resolve }) => {
	const { preloadTranslation, applyHtmlLocaleAttr } = TranslationProvider();
	await preloadTranslation();
	return resolve(event, {
		transformPageChunk: ({ html }) => applyHtmlLocaleAttr(html)
	});
};
```

Also ensure your `src/app.html` contains `%lang%` in the root html tag:

```html
<html lang="%lang%"></html>
```

---

### 4. Client‑side Translation Synchronization

In `src/routes/+layout.server.ts` in locals, the server provides the detected `lang` and `translations`. There are two synchronization strategies:

---

#### Option A – Minimal payload (only language)

Pass only `{ lang }` and `false` to `syncTranslation`, causing the client to reimport translations:

```ts
// +layout.server.ts
export const load: LayoutServerLoad = async ({ locals }) => {
	return { lang: locals.lang };
};

// +layout.ts
export const load: LayoutLoad = async ({ data }) => {
	const { syncTranslation } = TranslationProvider();
	await syncTranslation({ lang: data.lang }, false);
};
```

✅ Tiny initial payload  
⚠️ Client makes an additional import of current translations

---

#### Option B – Include translations (larger HTML)

Pass `{ lang, translations }` and optionally `true`, syncing the client directly with server translations:

```ts
// +layout.server.ts
export const load: LayoutServerLoad = async ({ locals }) => {
	return { lang: locals.lang, translations: locals.translations };
};

// +layout.ts
export const load: LayoutLoad = async ({ data }) => {
	const { syncTranslation } = TranslationProvider();
	await syncTranslation({ lang: data.lang, translations: data.translations });
};
```

✅ Instantly available client-side translations  
⚠️ Increases `page.data` size and HTML payload

---

#### 🔍 Comparison

| Strategy | HTML Size | Client reimport |
| -------- | --------- | --------------- |
| Option A | ✅ Small  | ❌ Yes          |
| Option B | ❌ Large  | ✅ No           |

---

## Usage in Svelte Components

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

## Cookie-Based Language Initialization

You can set `cookieName` to use and sync plugin current language with cookies automatically:

```ts
// src/lib/translation/index.ts
import { messages } from './locales/index.js';
import { createTranslations } from '@azure-net/edges-translations';

export const TranslationProvider = createTranslations({
	messages,
	initLang: 'ru',
	cookieName: 'lang'
});
```

---

## API

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
| `preloadTranslation(callback?)`  | Loads translations on server.                            |
| `syncTranslation(data)`          | Syncs server data on client.                             |
| `switchLocale(locale)`           | Switches language on client.                             |
| `t(key, vars?)`                  | Translation function.                                    |
| `locale`                         | Reactive store with current locale.                      |
| `applyHtmlLocaleAttr(html)`      | Replace `%lang%` in rendered HTML with current language. |
| `subscribeLocaleChangeEvent(cb)` | Listen to language changes. Returns `unsubscribe()`.     |

---

## Pluralization

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

## ⚠️ Action/Redirect Limitations

This package relies on the same sync model as `@azure-net/edges`: it is **not** a full consistency protocol for every SvelteKit flow.

- Avoid changing locale in server `svelte actions` and expecting guaranteed client sync.
- Especially with `redirect` responses from actions, client translation state may not synchronize the way you expect.
- Prefer client-side `switchLocale(...)` for interactive language changes.
- If you must change locale on server + redirect, use explicit app-level transfer patterns (cookie/session/flash) and handle follow-up sync in `load`.

---

## License

[MIT](./LICENSE)

---

## ✨ Made for `@azure-net/edges`

---

Crafted with ❤️ by Pixel1917.
