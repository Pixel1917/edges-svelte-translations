import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const edgesContextPath = fileURLToPath(new URL('./node_modules/@azure-net/edges/dist/context/index.js', import.meta.url));
const edgesRootPath = fileURLToPath(new URL('./node_modules/@azure-net/edges/dist/index.js', import.meta.url));

export default defineConfig({
	resolve: {
		conditions: ['svelte'],
		alias: [
			{ find: /^@azure-net\/edges\/context$/, replacement: edgesContextPath },
			{ find: /^@azure-net\/edges$/, replacement: edgesRootPath }
		]
	},
	test: {
		exclude: ['**/node_modules/**', '**/dist/**', '**/.svelte-kit/**']
	}
});
