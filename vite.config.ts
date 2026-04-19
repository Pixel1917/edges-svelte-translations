import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from '@azure-net/edges/plugin';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin()]
});
