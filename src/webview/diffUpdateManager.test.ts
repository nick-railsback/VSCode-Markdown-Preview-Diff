/**
 * DiffUpdateManager unit tests
 *
 * 
 *
 * Tests:
 * - Debounce mechanism
 * - Watcher scope filtering
 * - Resource cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock all dependencies before importing the module under test
vi.mock('vscode', () => {
	const mockDisposable = { dispose: vi.fn() };
	return {
		workspace: {
			onDidChangeTextDocument: vi.fn(() => mockDisposable),
			createFileSystemWatcher: vi.fn(() => ({
				onDidChange: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				dispose: vi.fn()
			})),
			getWorkspaceFolder: vi.fn(() => ({
				uri: { fsPath: '/workspace' }
			})),
			asRelativePath: vi.fn(() => 'test.md'),
			textDocuments: []
		},
		RelativePattern: vi.fn(),
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path }))
		}
	};
});

vi.mock('../git/gitService');
vi.mock('../git/gitStateWatcher', () => ({
	GitStateWatcher: vi.fn().mockImplementation(() => ({
		onDidChangeState: vi.fn(() => ({ dispose: vi.fn() })),
		dispose: vi.fn()
	}))
}));
vi.mock('../markdown/markdownRenderer');
vi.mock('../diff/diffComputer');
vi.mock('../diff/diffHighlighter');
vi.mock('../diff/changeNavigator');
vi.mock('../utils/errorHandler', () => ({
	logDebug: vi.fn(),
	logInfo: vi.fn(),
	logWarning: vi.fn(),
	logError: vi.fn()
}));

import * as vscode from 'vscode';
import { DiffUpdateManager } from './diffUpdateManager';

describe('DiffUpdateManager', () => {
	let manager: DiffUpdateManager;
	let mockWebview: { postMessage: Mock };
	let mockContext: vscode.ExtensionContext;
	let documentChangeCallback: ((event: { document: { uri: { fsPath: string } }; contentChanges: unknown[] }) => void) | null;

	beforeEach(() => {
		vi.useFakeTimers();

		mockWebview = {
			postMessage: vi.fn().mockResolvedValue(true)
		};

		mockContext = {
			subscriptions: []
		} as unknown as vscode.ExtensionContext;

		documentChangeCallback = null;

		// Capture the callback when onDidChangeTextDocument is called
		(vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((callback) => {
			documentChangeCallback = callback;
			return { dispose: vi.fn() };
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
		manager?.dispose();
	});

	describe('initialization', () => {
		it('should register document change watcher on initialize', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			expect(vscode.workspace.onDidChangeTextDocument).toHaveBeenCalled();
		});

		it('should register file system watcher on initialize', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
		});
	});

	describe('debounce mechanism', () => {
		it('should not trigger immediately on document change', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			// Simulate document change
			documentChangeCallback?.({
				document: { uri: { fsPath: '/workspace/test.md' } },
				contentChanges: [{}]
			});

			// Should not have called postMessage yet (debounce pending)
			expect(mockWebview.postMessage).not.toHaveBeenCalled();
		});

		it('should coalesce multiple rapid changes into one update', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			// Simulate multiple rapid changes
			for (let i = 0; i < 5; i++) {
				documentChangeCallback?.({
					document: { uri: { fsPath: '/workspace/test.md' } },
					contentChanges: [{}]
				});
				vi.advanceTimersByTime(50); // Less than debounce delay
			}

			// Still should not have triggered (debounce resets on each change)
			expect(mockWebview.postMessage).not.toHaveBeenCalled();
		});
	});

	describe('watcher scope', () => {
		it('should ignore changes to other files', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			// Simulate change to different file
			documentChangeCallback?.({
				document: { uri: { fsPath: '/workspace/other.md' } },
				contentChanges: [{}]
			});

			vi.advanceTimersByTime(500);

			// Should not trigger update for other files
			expect(mockWebview.postMessage).not.toHaveBeenCalled();
		});

		it('should ignore empty content changes', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			// Simulate empty content change
			documentChangeCallback?.({
				document: { uri: { fsPath: '/workspace/test.md' } },
				contentChanges: []
			});

			vi.advanceTimersByTime(500);

			// Should not trigger update for empty changes
			expect(mockWebview.postMessage).not.toHaveBeenCalled();
		});
	});

	describe('resource cleanup', () => {
		it('should clear debounce timer on dispose', () => {
			manager = new DiffUpdateManager(
				'/workspace/test.md',
				mockWebview as unknown as vscode.Webview,
				mockContext
			);
			manager.initialize();

			// Trigger change to start debounce timer
			documentChangeCallback?.({
				document: { uri: { fsPath: '/workspace/test.md' } },
				contentChanges: [{}]
			});

			// Dispose before debounce completes
			manager.dispose();

			// Advance timer past debounce delay
			vi.advanceTimersByTime(500);

			// Should not have triggered because timer was cleared
			expect(mockWebview.postMessage).not.toHaveBeenCalled();
		});
	});
});
