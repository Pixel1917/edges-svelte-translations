export default {
	branches: ['main', 'dev'],
	dryRun: false,
	ci: false,
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				releaseRules: [
					{ type: 'release', release: 'major' },
					{ type: 'feature', release: 'minor' },
					{ type: 'perf', release: false },
					{ type: 'refactor', release: false },
					{ type: 'fix', release: 'patch' },
					{ type: 'chore', release: false },
					{ type: 'ci', release: false },
					{ type: 'docs', scope: 'README', release: false },
					{ type: 'test', release: false },
					{ type: 'style', release: false }
				]
			}
		],
		'@semantic-release/release-notes-generator'
	]
};
