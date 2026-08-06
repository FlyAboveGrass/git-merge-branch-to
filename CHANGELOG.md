# Change Log

All notable changes to the "merge-code" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.3.0] - 2026-08-06

### Added
- 新增 webhook 自动/手动触发配置，默认保持手动选择环境
- 自动模式支持按项目和合并目标分支直接触发对应 webhook

## [1.2.5] - 2026-07-22

### Fixed
- 修复临时 worktree 缺少 Husky 运行文件时无法创建 merge commit 的问题

## [1.2.4] - 2026-05-12

### Fixed
- 修复在 Git worktree 中触发 webhook 时项目名识别错误的问题：改为基于 `git rev-parse --git-common-dir` 解析真实仓库名，而不是直接使用 worktree 目录名


## [1.2.2] - 2024-XX-XX

### Fixed
- 修复插件执行时内存爆满的问题：将 worktree 创建在系统临时目录，避免 VS Code 索引导致卡死
- 修复 ESLint、TypeScript 和代码提示卡死的问题
- 修复 worktree 删除逻辑错误：使用路径而不是分支名
- 优化 execSync 输出处理：使用 pipe 模式并限制缓冲区大小，避免大量输出导致内存问题
- 代码优化：提取 execSync 配置为统一常量

## [Unreleased]

- Initial release
