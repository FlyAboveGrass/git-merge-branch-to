const vscode = require("vscode");
const { execSync } = require("child_process");
const { getGitProjectName } = require("./utils");

const CANCEL = "退出操作";

function workTreeFlows({ repoPath, targetBranch, sourceBranch }) {
  // 返回 withProgress 的 Promise，确保进度窗口能正确关闭
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "后台合并分支中...",
      cancellable: false,
    },
    async (progress) => {
      // 生成临时 worktree 路径（在系统临时目录中，避免触发 VSCode 监控）
      const os = require('os');
      const crypto = require('crypto');
      const tmpDir = os.tmpdir();
      const randomId = crypto.randomBytes(8).toString('hex');
      const worktreePath = `${tmpDir}/vscode-merge-${targetBranch}-${randomId}`;
      
      progress.report({ message: "创建临时工作区..." });
      try {
        // 使用 --detach 创建分离的 worktree，不检出任何文件
        // 这样只创建 .git 目录，不会复制工作文件
        execSync(`git -C "${repoPath}" worktree add --detach "${worktreePath}"`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });
      } catch (error) {
        vscode.window.showErrorMessage(`创建临时工作区失败: ${error.message}`);
        return;
      }

      try {
        progress.report({ message: "获取最新分支信息..." });
        // 在 worktree 中 fetch 最新信息
        execSync(`git -C "${worktreePath}" fetch origin`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });

        progress.report({ message: "切换到目标分支..." });
        // 切换到目标分支（在 worktree 中，不影响主工作区）
        execSync(`git -C "${worktreePath}" checkout "${targetBranch}"`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });

        // 拉取目标分支最新代码
        execSync(`git -C "${worktreePath}" pull origin "${targetBranch}"`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });

        progress.report({ message: "合并分支..." });
        // 合并源分支（使用 --no-commit 先不提交，检查冲突）
        try {
          execSync(`git -C "${worktreePath}" merge --no-ff "${sourceBranch}" -m "Merge ${sourceBranch} into ${targetBranch}"`, {
            stdio: "pipe",
            maxBuffer: 1024 * 1024 * 10
          });
        } catch (error) {
          // 检查是否是冲突
          const status = execSync(`git -C "${worktreePath}" status`, {
            stdio: "pipe",
            maxBuffer: 1024 * 1024 * 10
          }).toString();
          
          if (status.includes('Unmerged paths') || status.includes('CONFLICT')) {
            vscode.window.showErrorMessage(
              `合并分支失败 ${sourceBranch} -> ${targetBranch}. 存在代码冲突，请手动处理。`
            );
          } else {
            vscode.window.showErrorMessage(
              `合并分支失败 ${sourceBranch} -> ${targetBranch}. ${error.message}`
            );
          }
          throw error;
        }

        progress.report({ message: "推送到远程..." });
        execSync(`git -C "${worktreePath}" push origin "${targetBranch}"`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });

        vscode.window.showInformationMessage(`✅ 合并分支 ${sourceBranch} -> ${targetBranch} 成功（后台执行）`);

      } catch (error) {
        // 错误已经在上面处理过了
        if (!error.message.includes('合并分支失败')) {
          vscode.window.showErrorMessage(`操作失败: ${error.message}`);
        }
      } finally {
        // 清理临时 worktree
        progress.report({ message: "清理临时文件..." });
        try {
          execSync(`git -C "${repoPath}" worktree remove "${worktreePath}" --force`, {
            stdio: "pipe",
            maxBuffer: 1024 * 1024 * 10
          });
        } catch (error) {
          // 如果删除失败，尝试手动删除目录
          try {
            const fs = require('fs');
            fs.rmSync(worktreePath, { recursive: true, force: true });
          } catch (e) {
            console.error('清理临时目录失败:', e);
          }
        }
      }

      progress.report({ message: "完成" });
    }
  ).then(() => {
    // 进度通知关闭后，再触发 webhook
    // 这样用户可以看到选择框
    triggerWebhooks();
  });

  async function triggerWebhooks() {
    const config = vscode.workspace.getConfiguration("gitMergeBranchTo");
    const urlConfigs = config.get("deployConfig").urlConfig || [];
    const branches = config.get("branches") || [];
    if (!urlConfigs.length || !branches.length) {
      return;
    }

    const envList = urlConfigs.map((item) => item.env);
    const selectedEnv = await vscode.window.showQuickPick([CANCEL, ...envList], {
      canPickMany: false,
      placeHolder: "选择要触发webhook的环境",
    });

    if (!selectedEnv || selectedEnv === CANCEL) {
      return;
    }

    const projectName = await getGitProjectName();
    if (!projectName) {
      vscode.window.showErrorMessage("未找到当前项目名, 请确保当前项目目录存在git仓库内");
      return;
    }

    const envConfig = urlConfigs.find((urlConfig) => urlConfig.env === selectedEnv);
    if (
      !envConfig ||
      !envConfig.serverWebhookMap ||
      !envConfig.serverWebhookMap[projectName] ||
      !envConfig.serverWebhookMap[projectName].hookUrl
    ) {
      vscode.window.showErrorMessage(`未找到 ${projectName} 的配置信息`);
      return;
    }

    const { hookUrl: webhookUrl, webUrl } = envConfig.serverWebhookMap[projectName];
    const feishuId = vscode.workspace.getConfiguration("gitMergeBranchTo").get("feishuId");
    const branch = envConfig.defaultBranch;
    const data = JSON.stringify({ feishuId: feishuId, branch });
    try {
      execSync(`curl --header "Content-Type: application/json" --request POST --data '${data}' ${webhookUrl}`, {
        stdio: "pipe",
        maxBuffer: 1024 * 1024 * 10
      });
      
      // 如果有 webUrl，显示带按钮的提示
      if (webUrl) {
        const selection = await vscode.window.showInformationMessage(
          `✅ 触发 webhook 成功`,
          "查看流水线"
        );
        if (selection === "查看流水线") {
          vscode.env.openExternal(vscode.Uri.parse(webUrl));
        }
      } else {
        vscode.window.showInformationMessage(`✅ 触发 webhook 成功`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`触发 webhook 失败: ${error.message}`);
    }
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
    const isExistRemoteTargetBranch = execSync(`git ls-remote --heads origin ${targetBranch}`, {
      stdio: "pipe",
      maxBuffer: 1024 * 1024 * 10
    }).toString();

    if (!isExistRemoteTargetBranch) {
      try {
        // 从远程的master分支创建本地分支
        execSync(`git branch ${targetBranch} origin/master`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });
        // 推送到远程
        execSync(`git push origin ${targetBranch}`, {
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 10
        });
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

    workTreeFlows({ repoPath, targetBranch, sourceBranch });
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

exports.deactivate = function deactivate() {
  // 清理资源，确保没有内存泄露
  // VSCode 会自动清理 context.subscriptions 中的资源
};
