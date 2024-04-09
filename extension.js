const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { getGitProjectName } = require("./utils");

const CANCEL = '退出操作'
function workTreeFlows({ repoPath, worktreePath, targetBranch, sourceBranch }) {
  try {
      // 创建新的工作区
    try {
      execSync(`git -C "${repoPath}" worktree add "${worktreePath}" "${targetBranch}"`, { stdio: "inherit" });
      execSync(`git -C "${worktreePath}" switch "${targetBranch}"`, { stdio: "inherit" });
    } catch (error) {
      vscode.window.showErrorMessage(`创建新的工作区失败，请检查分支是否存在或者工作区是否已经创建 ${error.message}`);
      throw error;
    }

    // 合并代码到指定分支
    try {
      execSync(`git -C "${worktreePath}" merge "${sourceBranch}"`, { stdio: "inherit" });
    } catch (error) {
      vscode.window.showErrorMessage(
        `合并分支失败 ${sourceBranch} -> ${targetBranch}. 可能存在代码冲突，请手动处理。 ${error.message}`
      );
      throw error;
    }

    try {
      execSync(`git -C "${worktreePath}" push -u origin "${targetBranch}"`, { stdio: 'inherit' });
    } catch (error) {
      vscode.window.showErrorMessage(
        `推送失败 ${targetBranch}。请检查是否有推送该分支的权限或者检查网络连接是否正常。 ${error.message}`
      );
      throw error;
    }

    clearWorkTree({ repoPath, worktreePath, targetBranch });

    vscode.window.showInformationMessage(`合并分支 ${sourceBranch} -> ${targetBranch} 成功`);
  } catch (error) {
    clearWorkTree({ repoPath, worktreePath, targetBranch });
    vscode.window.showErrorMessage(
      `合并分支失败 ${sourceBranch} -> ${targetBranch}: ${error.message} ${error.stderr}`
    );
    return;
  }

  triggerWebhooks();

  function clearWorkTree({ repoPath, worktreePath, targetBranch }) {
    const worktreeBranch = `${targetBranch}-worktree`;
    const worktreeAbsolutePath = path.resolve(repoPath, worktreePath);
  
    // 检查工作区路径是否存在
    const worktreeExists = fs.existsSync(worktreeAbsolutePath);
  
    if (worktreeExists) {
      try {
        // 删除工作区
        execSync(`git -C "${repoPath}" worktree remove ${worktreeBranch}`, { stdio: "inherit" });
        execSync(`rm -rf "${worktreePath}"`, { stdio: "inherit" });
      } catch (error) {
        vscode.window.showErrorMessage(`删除工作区失败: ${error.message}`);
      }
    }
  }

  function triggerWebhooks() {
    const config = vscode.workspace.getConfiguration("gitMergeBranchTo");
    const urlConfigs = config.get("deployConfig").urlConfig || [];
    if (!urlConfigs || !urlConfigs.length) {
      return;
    }

    const envList = urlConfigs.map((item) => item.env);
    vscode.window
      .showQuickPick([CANCEL, ...envList], {
        canPickMany: false,
        placeHolder: "选择要触发webhook的环境",
      })
      .then(async (selectedEnv) => {
        if (selectedEnv === CANCEL) {
          return;
        }

        const projectName = await getGitProjectName();
        if (!projectName) {
          vscode.window.showErrorMessage("未找到当前项目名, 请确保当前项目目录存在git仓库内");
          return;
        }

        const config = urlConfigs.find((urlConfig) => urlConfig.env === selectedEnv);
        if (
          !config ||
          !config.serverWebhookMap ||
          !config.serverWebhookMap[projectName] ||
          !config.serverWebhookMap[projectName].hookUrl
        ) {
          vscode.window.showErrorMessage(`未找到 ${projectName} 的配置信息`);
          return;
        }

        const {hookUrl: webhookUrl, webUrl } = config.serverWebhookMap[projectName];
        try {
          execSync(`curl --header "Content-Type: application/json" --request POST --data "{}" ${webhookUrl}`, {
            stdio: "inherit",
          });
          vscode.window.showInformationMessage(
            `触发 webhook 成功。${webUrl ? `[查看流水线](${webUrl})` : ''}`,
            { modal: false },
            { title: 'Open in Browser', command: 'vscode.open' }
          ).then(selection => {
            if (selection?.command === 'vscode.open') {
              vscode.env.openExternal(vscode.Uri.parse(webUrl));
            }
          });
        } catch (error) {
          vscode.window.showErrorMessage(`触发 webhook 失败: ${error.message}`);
        }
      });
  }
}

function manageWorktrees() {
  const config = vscode.workspace.getConfiguration("gitMergeBranchTo");
  const branches = config.get("branches");
  if (!branches || !branches.length) {
    vscode.window.showErrorMessage("未找到配置的分支列表");
    return;
  }

  vscode.window
    .showQuickPick(branches, {
      canPickMany: false,
      placeHolder: "选择你要合并到哪个分支",
    })
    .then(async (targetBranch) => {
      if (!targetBranch || targetBranch === CANCEL) return;

      const repoPath = vscode.workspace.rootPath;
      const sourceBranch = await getCurrentBranchName();
      const worktreePath = path.join(repoPath, `${targetBranch}-worktree`);

      workTreeFlows({ repoPath, worktreePath, targetBranch, sourceBranch });
    });

  async function getCurrentBranchName() {
    const gitExtension = vscode.extensions.getExtension("vscode.git").exports;
    const gitApi = gitExtension.getAPI(1);

    const repository = gitApi.repositories.find((repo) => repo.rootUri.fsPath === vscode.workspace.rootPath);
    if (!repository) {
      throw new Error("当前仓库无法识别");
    }

    return repository.state.HEAD?.name;
  }
}

exports.activate = function activate(context) {
  let disposable = vscode.commands.registerCommand("gitMergeBranchTo.merge-branch-to", manageWorktrees);

  context.subscriptions.push(disposable);

  // Add status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "gitMergeBranchTo.merge-branch-to";
  statusBarItem.text = "$(git-branch) 合并分支到";
  statusBarItem.tooltip = "合并分支到指定分支";
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
};

exports.deactivate = function deactivate() {};
