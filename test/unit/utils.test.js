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

const { resolveGitProjectName } = require('../../utils');

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
