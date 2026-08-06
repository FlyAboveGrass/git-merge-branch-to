const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
	if (request === 'vscode') {
		return {
			workspace: {},
			window: {
				showWarningMessage: () => {},
			},
		};
	}

	return originalLoad.call(this, request, parent, isMain);
};

const { findAutomaticWebhookEnvironment, resolveGitProjectName } = require('../../utils');

Module._load = originalLoad;

describe('resolveGitProjectName', () => {
	it('returns common repo name in worktree', () => {
		const projectName = resolveGitProjectName('/Users/yangjiajian/Work/workspace/monkey-saas-web.worktrees/origin-release', {
			existsSync: () => true,
			execSync: () => Buffer.from('/Users/yangjiajian/Work/workspace/monkey-saas-web/.git\n'),
		});

		assert.strictEqual(projectName, 'monkey-saas-web');
	});
});

describe('findAutomaticWebhookEnvironment', () => {
	// 自动触发必须由项目级 autoTriggerBranch 决定，不能误用环境的 defaultBranch。
	it('matches the project webhook by merged target branch', () => {
		// 两个环境故意使用相同 defaultBranch，用来对抗仅按环境默认分支匹配的错误实现。
		const developConfig = {
			env: 'dev',
			defaultBranch: 'develop',
			serverWebhookMap: {
				'monkey-saas-web': { hookUrl: 'https://example.com/dev' },
			},
		};
		const uatConfig = {
			env: 'uat',
			defaultBranch: 'develop',
			serverWebhookMap: {
				'monkey-saas-web': {
					hookUrl: 'https://example.com/uat',
					autoTriggerBranch: 'uat',
				},
			},
		};

		assert.strictEqual(
			findAutomaticWebhookEnvironment([developConfig, uatConfig], 'monkey-saas-web', 'uat'),
			uatConfig
		);
		assert.strictEqual(
			findAutomaticWebhookEnvironment([developConfig, uatConfig], 'monkey-saas-web', 'develop'),
			undefined
		);
	});
});
