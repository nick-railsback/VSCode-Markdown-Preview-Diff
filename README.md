# Markdown Preview Diff

A VS Code extension that shows GitHub-style rendered markdown diffs - see your changes as they'll appear, not as raw text.

## Features

- **Side-by-side rendered diff view**: Compare the before and after versions of your markdown as rendered HTML
- **Real-time updates**: Automatically updates when you save or change files
- **Change navigation**: Jump between changes with keyboard shortcuts
- **Git integration**: Compares against HEAD or staged changes
- **GitHub-Flavored Markdown**: Supports tables, code blocks, inline code, images, lists, links, blockquotes, and more

## Keyboard Shortcuts

| Command | macOS | Windows/Linux | Description |
|---------|-------|---------------|-------------|
| Open Preview Diff | `Cmd+K D` | `Ctrl+K D` | Opens a rendered diff view for the current markdown file |
| Next Change | `N` | `N` | Navigate to next change in diff view |
| Previous Change | `P` | `P` | Navigate to previous change in diff view |

**Note**: The `Cmd+K D` / `Ctrl+K D` shortcut only works when a markdown file is open in the editor. Navigation shortcuts (`N`/`P`) only work when the diff view is focused.

All keybindings can be customized in VS Code's Keyboard Shortcuts settings (`Cmd+K Cmd+S` on macOS or `Ctrl+K Ctrl+S` on Windows/Linux).

## Requirements

- VS Code 1.60.0 or higher
- Git installed and available in PATH

## Extension Settings

This extension contributes the following settings:

* `markdownPreviewDiff.defaultComparisonTarget`: Compare against `HEAD` (last commit) or `staged` changes. Default: `HEAD`
* `markdownPreviewDiff.syncScroll`: Enable synchronized scrolling between before and after panes. Default: `true`
* `markdownPreviewDiff.highlightStyle`: Color scheme for diff highlighting (`default` or `high-contrast`). Default: `default`
* `markdownPreviewDiff.renderTimeout`: Maximum time in milliseconds to wait for markdown rendering. Default: `5000`

## Performance

### Performance Targets

- **Activation Time**: < 500ms from command invocation
- **Typical Files (< 10KB)**: < 2 seconds end-to-end
- **Larger Files (10KB - 100KB)**: < 5 seconds with progress indicator
- **Large Files (> 100KB)**: Supported with warning message

### Memory Usage

- **Extension Memory**: < 50MB per diff view
- **Single Panel Pattern**: Previous diff view automatically closed when opening new one
- **Resource Cleanup**: All resources released within 1 second of closing diff view

### Performance Monitoring

Performance metrics are logged to the "Markdown Preview Diff" output channel:
- Open the Output panel (View → Output or `Cmd+Shift+U` / `Ctrl+Shift+U`)
- Select "Markdown Preview Diff" from the dropdown

## Troubleshooting

### Slow Rendering

1. **Check file size**: Large files (> 100KB) may take longer
2. **Check git repository health**: Run `git status` in terminal
3. **View performance logs**: Check Output panel for specific bottlenecks

### Git Errors

1. **Verify git is installed**: Run `git --version` in terminal
2. **Check repository status**: Run `git status` to ensure repo is healthy
3. **Ensure file is in a git repository**: Extension requires git version control

### Extension Not Activating

1. **Open a markdown file**: Extension only activates for `.md` files
2. **Check file language mode**: Ensure file is recognized as markdown
3. **Reload window**: `Cmd+R` / `Ctrl+R` or "Developer: Reload Window"

## License

MIT

---

**Enjoy!**
