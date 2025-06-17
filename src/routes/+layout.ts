import { TranslationProvider } from '../translation/index.js';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types.js';

export const load: LayoutLoad = async ({ data }) => {
	const { syncTranslation } = TranslationProvider();
	if (browser) {
		await syncTranslation({ lang: data.lang }, false);
	}
};
