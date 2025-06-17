import { dev } from '$app/environment';
import { edgesHandle } from 'edges-svelte/server';
import { type Handle } from '@sveltejs/kit';
import { TranslationProvider } from './translation/index.js';

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
