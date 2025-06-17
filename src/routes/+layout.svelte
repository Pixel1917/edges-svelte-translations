<script lang="ts">
	import type { Snippet } from 'svelte';

	const { children }: { children: Snippet } = $props();
</script>

<div class="layout">
	<div class="page">
		{@render children()}
	</div>
</div>

<style>
	.layout {
		display: flex;
		height: 100vh;
	}
	.page {
		min-height: calc(100% - 104px);
		height: fit-content;
		width: 100%;
		display: flex;
		flex-direction: column;
		padding: 24px 24px 40px;
		margin-left: 236px;
		margin-top: 104px;
	}
</style>
