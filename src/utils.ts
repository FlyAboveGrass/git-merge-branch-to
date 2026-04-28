import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

export async function getGitProjectName(): Promise<string | null> {
  const rootUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!rootUri) {
    void vscode.window.showWarningMessage(
      '当前窗口未打开项目或没有关联的 Git 仓库，无法获取项目名称。请确保您在一个具有 Git 仓库的工作空间内。'
    );
    return null;
  }

  const rootPath = rootUri.fsPath;

  const isGitRepo = await new Promise<boolean>((resolve) => {
    fs.access(path.join(rootPath, '.git'), fs.constants.F_OK, (error) => {
      resolve(!error);
    });
  });

  if (!isGitRepo) {
    void vscode.window.showWarningMessage(
      '当前项目不是一个 Git 仓库，无法获取项目名称。'
    );
    return null;
  }

  return path.basename(rootPath);
}
