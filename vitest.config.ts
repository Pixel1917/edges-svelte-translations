import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const edgesContextPath = fileURLToPath(new URL('./node_modules/edges-svelte/dist/context/index.js', import.meta.url));
const edgesRootPath = fileURLToPath(new URL('./node_modules/edges-svelte/dist/index.js', import.meta.url));

export default defineConfig({
	resolve: {
		conditions: ['svelte'],
		alias: [
			{ find: /^edges-svelte\/context$/, replacement: edgesContextPath },
			{ find: /^edges-svelte$/, replacement: edgesRootPath }
		]
	},
	test: {
		exclude: ['**/node_modules/**', '**/dist/**', '**/.svelte-kit/**']
	}
});
