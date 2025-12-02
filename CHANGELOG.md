# Change Log

All notable changes to the "merge-code" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.2] - 2025-11-28

### 🚀 Major Performance Improvement
- **Optimized worktree approach**: Uses temporary worktree in system temp directory with `--detach` flag
- **Background execution**: Merge operations happen in isolated worktree, no impact on current workspace
- **Zero interruption**: Developers can continue working without branch switching or file changes
- **Eliminates**: Copying working files and node_modules (only creates minimal .git directory)
- **Result**: Fast, non-blocking merge operations with no editor impact

### Fixed
- **Critical**: Fixed memory leak caused by `withProgress` not returning Promise
- **Critical**: Fixed editor freezing issue caused by worktree copying node_modules and large files
- **Critical**: Fixed massive disk I/O that triggered VSCode file watchers and froze ESLint/TypeScript
- **Critical UX Bug**: Fixed progress notification blocking webhook selection dialog
- Fixed webhook success message to show clickable button instead of non-working Markdown link
- Fixed async operations not being properly awaited in `triggerWebhooks`
- Fixed variable naming conflict in `triggerWebhooks` function
- Webhook selection now appears after progress notification closes
- Users can now clearly see and interact with the webhook environment selection
- Now shows "查看流水线" button that can be clicked to open pipeline URL

### Changed
- **New approach**: Temporary worktree in system temp directory (isolated from workspace)
- Uses `git worktree add --detach` to create minimal worktree without checking out files
- Worktree created in `/tmp` directory, avoiding VSCode file watchers
- All `execSync` calls now use `stdio: "pipe"` with 10MB buffer limit
- `triggerWebhooks` function converted to async/await pattern for better error handling
- Moved `triggerWebhooks()` call to after `withProgress` completes
- Automatic cleanup of temporary worktree after operation
- Better error handling with conflict detection
- Improved webhook success notification with proper button interaction
- Better visual feedback when webhook is triggered
- Improved user experience: progress → success message → webhook selection

### Performance
- **Dramatically** reduced disk I/O (minimal worktree, no working files copied)
- **Dramatically** reduced memory usage (temp directory not monitored by VSCode)
- **Zero impact** on current workspace (no branch switching, no file changes)
- Eliminated editor lag when merging branches
- Fixed ESLint and TypeScript services freezing
- Developers can continue working during merge operations
