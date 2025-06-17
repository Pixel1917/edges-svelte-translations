export const messages = {
	ru: () => import('./ru.js').then((res) => res.default),
	en: () => import('./en.js').then((res) => res.default)
};
