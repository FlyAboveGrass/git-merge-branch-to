# VS Code 插件发布流程

本文档说明如何打包和发布 VS Code 插件到 Marketplace。

## 发布前准备

### 1. 更新版本号

在 `package.json` 中更新版本号，遵循 [语义化版本](https://semver.org/)：

- **主版本号（Major）**：不兼容的 API 修改
- **次版本号（Minor）**：向下兼容的功能性新增
- **修订号（Patch）**：向下兼容的问题修正

```json
{
  "version": "1.2.2"  // 格式：主版本.次版本.修订号
}
```

### 2. 更新 CHANGELOG.md

在 `CHANGELOG.md` 中添加本次更新的内容，包括：
- 新增功能（Added）
- 修复问题（Fixed）
- 变更（Changed）
- 废弃（Deprecated）
- 移除（Removed）

格式示例：

```markdown
## [1.2.2] - 2024-XX-XX

### Fixed
- 修复插件执行时内存爆满的问题
- 修复 ESLint、TypeScript 和代码提示卡死的问题
```

### 3. 代码检查

运行 lint 检查，确保代码质量：

```bash
npm run lint
```

## 打包插件

使用 `@vscode/vsce` 工具打包插件：

```bash
npx @vscode/vsce package
```

打包成功后会在根目录生成 `.vsix` 文件，例如：`git-merge-branch-to-1.2.2.vsix`

## 发布插件

**如何获取 Personal Access Token**

1. 访问 https://dev.azure.com
2. 点击右上角用户头像 → **Security**
3. 在左侧找到 **Personal access tokens**
4. 点击 **+ New Token**
5. 配置：
   - **Name**: `VS Code Extension Publishing`
   - **Organization**: `All accessible organizations`
   - **Expiration**: 根据需要选择（建议选择较长时间）
   - **Scopes**: 选择 **Marketplace** → **Manage**
6. 点击 **Create**，复制生成的 token（**只显示一次，请妥善保存**）


### 方式一：使用命令行发布（推荐）


#### 1. 登录（首次发布需要）

```bash
npx @vscode/vsce login <publisher-name>
```

例如：
```bash
npx @vscode/vsce login FlyAboveGrass
```

登录时会提示输入 Personal Access Token。

#### 2. 发布

```bash
npx @vscode/vsce publish
```

### 方式二：使用 Personal Access Token 直接发布

如果不想保存登录信息，可以直接使用 token：

```bash
npx @vscode/vsce publish -p <PersonalAccessToken>
```

## 验证发布

发布成功后，可以在以下位置查看：

- **Marketplace 管理页面**: https://marketplace.visualstudio.com/manage/publishers/FlyAboveGrass
- **插件页面**: 会自动更新到新版本

## 发布检查清单

发布前请确认：

- [ ] 版本号已更新（package.json）
- [ ] CHANGELOG.md 已更新
- [ ] 代码已通过 lint 检查（`npm run lint`）
- [ ] 已测试插件功能正常
- [ ] 已打包插件（`npx @vscode/vsce package`）
- [ ] 已准备好 Personal Access Token（如需要）

## 常见问题

### 1. 发布失败：版本号已存在

如果版本号已存在，需要更新 `package.json` 中的版本号。

### 2. 发布失败：未授权

确保已正确登录或提供了有效的 Personal Access Token。

### 3. 打包失败：缺少必要文件

检查 `.vscodeignore` 文件，确保没有排除必要的文件。

## 参考链接

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce 工具文档](https://github.com/microsoft/vscode-vsce)
- [语义化版本规范](https://semver.org/)

