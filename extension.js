const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
const { getGitProjectName } = require("./utils");

const CANCEL = "退出操作";

// execSync 统一配置：使用 pipe 避免大量输出导致内存问题
/** @type {import('child_process').ExecSyncOptions} */
const EXEC_SYNC_OPTIONS = {
  stdio: "pipe",
  maxBuffer: 10 * 1024 * 1024, // 10MB buffer
};

function generateWorkTreeName(targetBranch) {
  return `${targetBranch}-worktree-vscodePlugin`;
}

function workTreeFlows({ repoPath, worktreePath, targetBranch, sourceBranch }) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Processing Worktree",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Creating new worktree..." });
      // 创建新的工作区
      try {
        execSync(`git -C "${repoPath}" worktree add "${worktreePath}" "${targetBranch}"`, EXEC_SYNC_OPTIONS);
      } catch (error) {
        vscode.window.showErrorMessage(
          `创建新的工作区失败，请检查分支是否存在,或者${worktreePath}工作区已经创建过 ${error.message}`
        );
        return;
      }

      progress.report({ message: "merging branch..." });
      try {
        try {
          execSync(`git -C "${worktreePath}" switch "${targetBranch}"`, EXEC_SYNC_OPTIONS);
          execSync(`git -C "${worktreePath}" pull`, EXEC_SYNC_OPTIONS);
        } catch (error) {
          vscode.window.showErrorMessage(
            `拉取${targetBranch}代码失败, 可能存在代码冲突，请手动处理。. ${error.message}`
          );
          throw error;
        }

        // 合并代码到指定分支
        try {
          execSync(`git -C "${worktreePath}" merge "${sourceBranch}"`, EXEC_SYNC_OPTIONS);
        } catch (error) {
          vscode.window.showErrorMessage(
            `合并分支失败 ${sourceBranch} -> ${targetBranch}. 可能存在代码冲突，请手动处理。 ${error.message}`
          );
          throw error;
        }

        try {
          execSync(`git -C "${worktreePath}" push -u origin "${targetBranch}"`, EXEC_SYNC_OPTIONS);
        } catch (error) {
          vscode.window.showErrorMessage(
            `推送失败 ${targetBranch}。请检查是否有推送该分支的权限或者检查网络连接是否正常。 ${error.message}`
          );
          throw error;
        }

        await clearWorkTree({ repoPath, worktreePath, targetBranch });

        vscode.window.showInformationMessage(`合并分支 ${sourceBranch} -> ${targetBranch} 成功`);
      } catch (error) {
        await clearWorkTree({ repoPath, worktreePath, targetBranch });
        vscode.window.showErrorMessage(
          `合并分支失败 ${sourceBranch} -> ${targetBranch}: ${error.message} ${error.stderr}`
        );
        return;
      }

      triggerWebhooks();

      progress.report({ message: "merge process finished ..." });
    }
  );

  async function clearWorkTree({ repoPath, worktreePath, targetBranch }) {
    const worktreeAbsolutePath = path.resolve(repoPath, worktreePath);

    // 检查工作区路径是否存在
    const worktreeExists = fs.existsSync(worktreeAbsolutePath);

    if (worktreeExists) {
      try {
        // 删除工作区
        execSync(`git -C "${repoPath}" worktree remove "${worktreeAbsolutePath}" --force`, EXEC_SYNC_OPTIONS);
      } catch (error) {
        // 如果 git worktree remove 失败，尝试直接删除目录
        try {
          execSync(`rm -rf "${worktreeAbsolutePath}"`, EXEC_SYNC_OPTIONS);
          // 手动清理 git worktree 配置
          execSync(`git -C "${repoPath}" worktree prune`, EXEC_SYNC_OPTIONS);
        } catch (rmError) {
          vscode.window.showErrorMessage(`删除工作区失败: ${error.message}. 请手动删除 ${worktreeAbsolutePath}`);
        }
      }
    }
  }

  function triggerWebhooks() {
    const config = vscode.workspace.getConfiguration("gitMergeBranchTo");
    const urlConfigs = config.get("deployConfig").urlConfig || [];
    const branches = config.get("branches") || [];
    if (!urlConfigs.length || !branches.length) {
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

        const { hookUrl: webhookUrl, webUrl } = config.serverWebhookMap[projectName];
        const feishuId = vscode.workspace.getConfiguration("gitMergeBranchTo").get("feishuId");
        const branch = config.defaultBranch;
        const data = JSON.stringify({ feishuId: feishuId, branch });
        try {
          execSync(
            `curl --header "Content-Type: application/json" --request POST --data '${data}' ${webhookUrl}`,
            EXEC_SYNC_OPTIONS
          );
          vscode.window
            .showInformationMessage(
              `触发 webhook 成功。${webUrl ? `[查看流水线](${webUrl})` : ""}`,
              { modal: false },
              { title: "Open in Browser", command: "vscode.open" }
            )
            .then((selection) => {
              if (selection?.command === "vscode.open") {
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

  // 适配预约小程序，不配置分支
  if (!branches || !branches.length) {
    const sourceBranch = getCurrentBranchName();
    const targetBranch = sourceBranch.replace("feature/", "release/");
    process.chdir(vscode.workspace.rootPath);
    const isExistRemoteTargetBranch = execSync(
      `git ls-remote --heads origin ${targetBranch}`,
      EXEC_SYNC_OPTIONS
    ).toString();

    if (!isExistRemoteTargetBranch) {
      try {
        // 从远程的master分支创建本地分支
        execSync(`git branch ${targetBranch} origin/master`, EXEC_SYNC_OPTIONS);
        // 推送到远程
        execSync(`git push origin ${targetBranch}`, EXEC_SYNC_OPTIONS);
        vscode.window.showInformationMessage(`已创建远程分支 ${targetBranch} 并推送到远端`);
      } catch (error) {
        vscode.window.showErrorMessage(`创建分支 ${targetBranch} 失败: ${error.message}`);
        // 如果创建分支失败，则终止后续流程
        return;
      }
    }

    execFlow(targetBranch);

    return;
  }

  vscode.window
    .showQuickPick(branches, {
      canPickMany: false,
      placeHolder: "选择你要合并到哪个分支",
    })
    .then((targetBranch) => {
      if (!targetBranch || targetBranch === CANCEL) return;

      execFlow(targetBranch);
    });

  function getCurrentBranchName() {
    const gitExtension = vscode.extensions.getExtension("vscode.git").exports;
    const gitApi = gitExtension.getAPI(1);

    const repository = gitApi.repositories.find((repo) => repo.rootUri.fsPath === vscode.workspace.rootPath);
    if (!repository) {
      throw new Error("当前仓库无法识别");
    }

    return repository.state.HEAD?.name;
  }

  function execFlow(targetBranch) {
    const sourceBranch = getCurrentBranchName();
    const repoPath = vscode.workspace.rootPath;
    // 将 worktree 创建在系统临时目录，避免 VS Code 索引导致卡死
    const tempDir = os.tmpdir();
    const worktreeName = generateWorkTreeName(targetBranch);
    const worktreePath = path.join(tempDir, worktreeName);

    workTreeFlows({ repoPath, worktreePath, targetBranch, sourceBranch });
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
