import { type Handle } from '@sveltejs/kit';
import { TranslationProvider } from './translation/index.js';

export const handle: Handle = async ({ event, resolve }) => {
	const { preloadTranslation, applyHtmlLocaleAttr } = TranslationProvider();
	await preloadTranslation(event);
	return resolve(event, {
		transformPageChunk: ({ html }) => applyHtmlLocaleAttr(html)
	});
};
