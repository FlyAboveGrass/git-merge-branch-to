const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

async function getGitProjectName() {
  const rootUri = vscode.workspace.workspaceFolders?.[0].uri; // 获取第一个工作空间的根目录 URI
  if (!rootUri) {
    vscode.window.showWarningMessage('当前窗口未打开项目或没有关联的 Git 仓库，无法获取项目名称。请确保您在一个具有 Git 仓库的工作空间内。');
    return null;
  }

  const rootPath = rootUri.fsPath; // 转换为文件系统路径

  // 检查根目录是否包含 .git 子目录，以确认是否为 Git 仓库
  const isGitRepo = await new Promise((resolve) => {
    fs.access(path.join(rootPath, '.git'), fs.constants.F_OK, (err) => {
      resolve(!err);
    });
  });

  if (!isGitRepo) {
    vscode.window.showWarningMessage('当前项目不是一个 Git 仓库，无法获取项目名称。');
    return null;
  }

  const gitProjectName = path.basename(rootPath); // 获取根目录的基名，即项目名称

  return gitProjectName;
}

module.exports = {
  getGitProjectName,
};