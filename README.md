# markdown-preview-diff README

This is the README for your extension "markdown-preview-diff". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Keyboard Shortcuts

| Command | macOS | Windows/Linux | Description |
|---------|-------|---------------|-------------|
| Open Preview Diff | `Cmd+K D` | `Ctrl+K D` | Opens a rendered diff view for the current markdown file |
| Next Change | `N` | `N` | Navigate to next change in diff view |
| Previous Change | `P` | `P` | Navigate to previous change in diff view |

**Note**: The `Cmd+K D` / `Ctrl+K D` shortcut only works when a markdown file is open in the editor. Navigation shortcuts (`N`/`P`) only work when the diff view is focused.

All keybindings can be customized in VS Code's Keyboard Shortcuts settings (`Cmd+K Cmd+S` on macOS or `Ctrl+K Ctrl+S` on Windows/Linux).

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Performance

### Performance Targets

The extension is optimized for fast, responsive operation:

- **Activation Time**: < 500ms from command invocation
- **Typical Files (< 10KB)**: < 2 seconds end-to-end
- **Larger Files (10KB - 100KB)**: < 5 seconds with progress indicator
- **Large Files (> 100KB)**: Supported with warning message

### Performance Breakdown

Individual phase targets for typical files:
- Git retrieval: < 500ms
- Diff computation: < 500ms
- Markdown rendering: < 1000ms
- Webview initialization: < 500ms

### Memory Usage

- **Extension Memory**: < 50MB per diff view
- **Single Panel Pattern**: Previous diff view automatically closed when opening new one
- **Resource Cleanup**: All resources released within 1 second of closing diff view

### Supported File Sizes

- **Optimal**: Files up to 100KB render with best performance
- **Large Files**: Files > 100KB are supported with a warning message
  - "Large file detected (XXX KB). Rendering may take longer than usual."
- **Very Large Files**: Files > 500KB may experience slower rendering but will not crash

### Performance Monitoring

Performance metrics are logged to the "Markdown Preview Diff" output channel:
- Open the Output panel (View → Output or `Cmd+Shift+U` / `Ctrl+Shift+U`)
- Select "Markdown Preview Diff" from the dropdown
- View timing for each operation and warnings if thresholds exceeded

## Performance Troubleshooting

### Slow Rendering

**Problem**: Diff view takes longer than 5 seconds to open

**Solutions**:
1. **Check file size**: Large files (> 100KB) may take longer
   - Try with a smaller file first to verify extension works
   - Consider splitting very large markdown files
2. **Check git repository health**: Run `git status` in terminal
   - Corrupted repositories may slow git operations
3. **Check VS Code performance**: Other extensions may impact performance
   - Try disabling other extensions temporarily
4. **View performance logs**: Check Output panel for specific bottlenecks

### Memory Issues

**Problem**: VS Code feels slow or uses excessive memory

**Solutions**:
1. **Close unused diff views**: Only one view is kept open automatically
   - Close the diff panel when done reviewing
2. **Restart VS Code**: Clears all cached data
3. **Check for memory leaks**: Report if memory grows over time
   - Include Output panel logs when reporting

### Git Timeout

**Problem**: "Git operation failed" or timeout errors

**Solutions**:
1. **Verify git is installed**: Run `git --version` in terminal
2. **Check repository status**: Run `git status` to ensure repo is healthy
3. **Network issues**: If using remote repositories, check network connection
4. **Large repository**: Very large git histories may slow operations
   - Performance is independent of repository size for most operations

### Extension Not Activating

**Problem**: Command not available or extension seems inactive

**Solutions**:
1. **Open a markdown file**: Extension only activates for `.md` files
2. **Check file language mode**: Ensure file is recognized as markdown
   - Click language indicator in status bar and select "Markdown"
3. **Reload window**: `Cmd+R` / `Ctrl+R` or "Developer: Reload Window"

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
