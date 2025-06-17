<script lang="ts">
	import { TranslationProvider } from '../translation/index.js';

	const { t, locale, switchLocale } = TranslationProvider();
</script>

<p>{$t('testVars', { someVar: 555 })}</p>
<p>3 - {$t('testPlural', { count: 3 })}</p>
<p>1 - {$t('testPlural', { count: 1 })}</p>
<p>5 - {$t('testPlural', { count: 5 })}</p>
<button onclick={() => switchLocale($locale === 'ru' ? 'en' : 'ru')}>curr lang - {$locale}. Switch</button>
