/**
 * Error Handling Integration Tests (Story 5.3)
 *
 * Tests for comprehensive error handling across all edge cases:
 * - AC1: Not in git repository error
 * - AC2: No changes detected info message
 * - AC3: Markdown rendering failure
 * - AC4: Large file handling with timeout
 * - AC5: Missing image placeholder
 * - AC6: Git operation failure with actionable messages
 * - AC7: Centralized error handler utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock VS Code API
const mockOutputChannel = {
	appendLine: vi.fn(),
	show: vi.fn(),
	dispose: vi.fn()
};

vi.mock('vscode', () => ({
	window: {
		createOutputChannel: vi.fn(() => mockOutputChannel),
		showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
		showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
		showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
		activeTextEditor: undefined,
		withProgress: vi.fn()
	},
	workspace: {
		getWorkspaceFolder: vi.fn()
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path, toString: () => `file://${path}` }))
	},
	ProgressLocation: {
		Notification: 1
	}
}));

// Import after mocking
import {
	showError,
	showWarning,
	showInfo,
	handleGitError,
	logErrorWithContext
} from '../utils/errorHandler';
import { GitError, GitErrorType } from '../types/git.types';

describe('Error Handling Integration Tests (Story 5.3)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('AC1: Not in Git Repository Error', () => {
		it('should show error message when file is not in git repository', async () => {
			const vscode = await import('vscode');

			// AC1: Error message should contain "not in a git repository"
			showError(
				'This file is not in a git repository. Preview Diff requires git version control.',
				'/path/to/file.md'
			);

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				'This file is not in a git repository. Preview Diff requires git version control.',
				'Show Output'
			);
		});

		it('should log file path to output channel for debugging', () => {
			showError(
				'This file is not in a git repository. Preview Diff requires git version control.',
				'File: /path/to/file.md'
			);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'Details: File: /path/to/file.md'
			);
		});
	});

	describe('AC2: No Changes Detected Info Message', () => {
		it('should show info message when files are identical', async () => {
			const vscode = await import('vscode');

			// AC2: Info message for no changes
			showInfo('No changes detected. The working file is identical to the committed version.');

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				'No changes detected. The working file is identical to the committed version.'
			);
		});

		it('should not log info messages to output channel', () => {
			vi.clearAllMocks();
			showInfo('No changes detected. The working file is identical to the committed version.');

			// Info messages should NOT be logged (per AC7 spec)
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
		});
	});

	describe('AC3: Markdown Rendering Failure Error', () => {
		it('should show error with syntax check message when rendering fails', async () => {
			const vscode = await import('vscode');

			showError(
				'Failed to render markdown. Check file syntax. Unexpected token at line 42',
				'Stack trace...'
			);

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('Failed to render markdown. Check file syntax.'),
				'Show Output'
			);
		});

		it('should log full stack trace to output channel', () => {
			const error = new Error('Unexpected token');
			error.stack = 'Error: Unexpected token\n    at parse (markdown.js:42:10)';

			logErrorWithContext(error, 'Markdown rendering failed');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Markdown rendering failed')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Stack:')
			);
		});
	});

	describe('AC4: Large File Handling with Timeout', () => {
		it('should show warning for large files', async () => {
			const vscode = await import('vscode');

			showWarning(
				'Large file detected (150.5 KB). Rendering may take longer than usual.',
				'File: /path/to/large-file.md, Size: 150.5 KB'
			);

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
				'Large file detected (150.5 KB). Rendering may take longer than usual.'
			);
		});

		it('should log large file warning with details', () => {
			showWarning(
				'Large file detected (150.5 KB). Rendering may take longer than usual.',
				'File: /path/to/large-file.md, Size: 150.5 KB, Threshold: 100 KB'
			);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[WARN]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'Details: File: /path/to/large-file.md, Size: 150.5 KB, Threshold: 100 KB'
			);
		});
	});

	describe('AC5: Missing Image Error Logging', () => {
		it('should log missing image path without showing to user', async () => {
			const vscode = await import('vscode');
			const error = new Error('ENOENT: no such file or directory');

			logErrorWithContext(error, 'Failed to resolve image path: ./missing.png');

			// Should log to output channel
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Failed to resolve image path: ./missing.png')
			);

			// Should NOT show to user (missing images are not user-facing errors)
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
		});

		it('should include image path in log for debugging', () => {
			const error = new Error('Path outside workspace');

			logErrorWithContext(error, 'Invalid absolute image path: /etc/passwd');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('/etc/passwd')
			);
		});
	});

	describe('AC6: Git Operation Failure with Actionable Messages', () => {
		it('should show actionable error for git not installed', async () => {
			const vscode = await import('vscode');
			const error = new GitError(
				GitErrorType.GitNotInstalled,
				'git: command not found'
			);

			handleGitError(error, 'checking repository');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				'Git is not installed or not in PATH. Please install git and restart VS Code.'
			);
		});

		it('should show actionable error for corrupted repository', async () => {
			const vscode = await import('vscode');
			const error = new GitError(
				GitErrorType.RepositoryCorrupted,
				'fatal: bad object HEAD'
			);

			handleGitError(error, 'reading HEAD');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('git fsck')
			);
		});

		it('should show actionable error for permission denied', async () => {
			const vscode = await import('vscode');
			const error = new GitError(
				GitErrorType.PermissionDenied,
				'permission denied'
			);

			handleGitError(error, 'accessing repository');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				'Permission denied accessing git repository. Check file permissions.'
			);
		});

		it('should include original git error in log output', () => {
			const originalError = new Error('fatal: not a git repository');
			const error = new GitError(
				GitErrorType.NotInRepository,
				'File is not in a git repository',
				originalError
			);

			handleGitError(error, 'checking repository status');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('checking repository status')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('File is not in a git repository')
			);
		});

		it('should log full stack trace for git errors', () => {
			const error = new GitError(
				GitErrorType.Unknown,
				'Unknown git error'
			);
			error.stack = 'GitError: Unknown git error\n    at GitService.getHeadVersion';

			handleGitError(error, 'getting HEAD version');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Stack:')
			);
		});
	});

	describe('AC7: Centralized Error Handler Integration', () => {
		it('should route all error types through showError', async () => {
			const vscode = await import('vscode');

			// Test that showError works for various error types
			showError('Custom error message');
			showError('Error with details', 'Additional details');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(2);
		});

		it('should route all warning types through showWarning', async () => {
			const vscode = await import('vscode');

			showWarning('Custom warning message');
			showWarning('Warning with details', 'Additional details');

			expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(2);
		});

		it('should include timestamp in all logged errors', () => {
			showError('Test error');

			const errorCall = mockOutputChannel.appendLine.mock.calls[0][0];
			// Should contain ISO timestamp format
			expect(errorCall).toMatch(/\[ERROR\] \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it('should include context in logged errors', () => {
			showError('Operation failed', 'Context: retrieving file');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'Details: Context: retrieving file'
			);
		});
	});

	describe('End-to-End Error Flow', () => {
		it('should handle complete git error flow', async () => {
			const vscode = await import('vscode');

			// Simulate complete git error flow
			const error = new GitError(
				GitErrorType.GitNotInstalled,
				'git: command not found'
			);

			handleGitError(error, 'initializing git service');

			// Should log to output channel
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('initializing git service')
			);

			// Should show user-friendly message
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('install git')
			);
		});

		it('should handle error → log → display flow correctly', async () => {
			const vscode = await import('vscode');
			vi.clearAllMocks();

			// Step 1: Error occurs
			const error = new Error('Network timeout');

			// Step 2: Log to output channel (without showing to user)
			logErrorWithContext(error, 'Fetching remote changes');

			// Verify log happened
			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();

			vi.clearAllMocks();

			// Step 3: Show to user (separate action)
			showError('Failed to fetch remote changes. Check your network connection.');

			// Verify both log and display happened
			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
			expect(vscode.window.showErrorMessage).toHaveBeenCalled();
		});
	});
});
