import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from 'edges-svelte/plugin';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin()]
});
