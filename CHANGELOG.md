# Change Log

All notable changes to the "merge-code" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.2] - 2024-XX-XX

### Fixed
- 修复插件执行时内存爆满的问题：将 worktree 创建在系统临时目录，避免 VS Code 索引导致卡死
- 修复 ESLint、TypeScript 和代码提示卡死的问题
- 修复 worktree 删除逻辑错误：使用路径而不是分支名
- 优化 execSync 输出处理：使用 pipe 模式并限制缓冲区大小，避免大量输出导致内存问题
- 代码优化：提取 execSync 配置为统一常量

## [Unreleased]

- Initial release