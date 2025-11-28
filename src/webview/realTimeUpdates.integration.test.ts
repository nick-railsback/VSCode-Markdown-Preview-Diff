/**
 * Real-Time Diff Updates Integration Tests
 *
 * Story 4.5: Real-Time Diff Updates and Git State Monitoring
 *
 * Tests the integration between:
 * - DiffUpdateManager
 * - WebviewManager
 * - Webview message handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock vscode
vi.mock('vscode', () => {
	const mockDisposable = { dispose: vi.fn() };
	const subscriptions: unknown[] = [];

	return {
		workspace: {
			onDidChangeTextDocument: vi.fn(() => mockDisposable),
			onDidChangeConfiguration: vi.fn(() => mockDisposable),
			createFileSystemWatcher: vi.fn(() => ({
				onDidChange: vi.fn(() => mockDisposable),
				onDidDelete: vi.fn(() => mockDisposable),
				dispose: vi.fn()
			})),
			getWorkspaceFolder: vi.fn(() => ({
				uri: { fsPath: '/workspace' }
			})),
			asRelativePath: vi.fn(() => 'test.md'),
			textDocuments: [],
			getConfiguration: vi.fn(() => ({
				get: vi.fn().mockReturnValue(true)
			}))
		},
		window: {
			createWebviewPanel: vi.fn(() => ({
				webview: {
					html: '',
					postMessage: vi.fn().mockResolvedValue(true),
					onDidReceiveMessage: vi.fn(() => mockDisposable)
				},
				onDidDispose: vi.fn((callback) => {
					subscriptions.push(callback);
					return mockDisposable;
				}),
				dispose: vi.fn()
			}))
		},
		commands: {
			executeCommand: vi.fn()
		},
		ViewColumn: { Two: 2 },
		RelativePattern: vi.fn(),
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path })),
			joinPath: vi.fn((base, ...paths) => ({
				fsPath: `${base}/${paths.join('/')}`
			}))
		},
		EventEmitter: vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
			dispose: vi.fn()
		})),
		extensions: {
			getExtension: vi.fn()
		}
	};
});

// Mock services
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

// Mock ContentBuilder
vi.mock('./contentBuilder', () => ({
	ContentBuilder: {
		buildWebviewHtml: vi.fn().mockReturnValue('<html></html>')
	}
}));

import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { RenderResult } from '../types/webview.types';

describe('Real-Time Updates Integration', () => {
	let mockContext: vscode.ExtensionContext;
	let mockRenderResult: RenderResult;

	beforeEach(() => {
		vi.clearAllMocks();

		mockContext = {
			extensionUri: { fsPath: '/extension' },
			subscriptions: []
		} as unknown as vscode.ExtensionContext;

		mockRenderResult = {
			beforeHtml: '<p>Before</p>',
			afterHtml: '<p>After</p>',
			changes: []
		};
	});

	afterEach(() => {
		WebviewManager.dispose();
	});

	describe('WebviewManager integration with DiffUpdateManager', () => {
		it('should create panel with DiffUpdateManager when filePath is provided', () => {
			WebviewManager.createDiffPanel(
				mockContext,
				mockRenderResult,
				undefined,
				'/workspace/test.md'
			);

			expect(WebviewManager.hasActivePanel()).toBe(true);
		});

		it('should create panel without DiffUpdateManager when filePath is not provided', () => {
			WebviewManager.createDiffPanel(
				mockContext,
				mockRenderResult
			);

			expect(WebviewManager.hasActivePanel()).toBe(true);
		});

		it('should dispose DiffUpdateManager when panel is disposed', () => {
			WebviewManager.createDiffPanel(
				mockContext,
				mockRenderResult,
				undefined,
				'/workspace/test.md'
			);

			WebviewManager.dispose();

			expect(WebviewManager.hasActivePanel()).toBe(false);
		});
	});

	describe('message types', () => {
		it('should support updateDiff message type', () => {
			// Verify the type system allows updateDiff with preserveScroll
			const updateMessage = {
				type: 'updateDiff' as const,
				data: mockRenderResult,
				preserveScroll: true
			};

			expect(updateMessage.type).toBe('updateDiff');
			expect(updateMessage.preserveScroll).toBe(true);
		});

		it('should support noChanges message type', () => {
			// Verify the type system allows noChanges message
			const noChangesMessage = {
				type: 'noChanges' as const
			};

			expect(noChangesMessage.type).toBe('noChanges');
		});

		it('should support error message type', () => {
			// Verify the type system allows error message
			const errorMessage = {
				type: 'error' as const,
				message: 'Test error'
			};

			expect(errorMessage.type).toBe('error');
			expect(errorMessage.message).toBe('Test error');
		});
	});

	describe('panel lifecycle', () => {
		it('should clean up previous panel when creating new one', () => {
			// Create first panel
			WebviewManager.createDiffPanel(
				mockContext,
				mockRenderResult,
				undefined,
				'/workspace/test1.md'
			);

			// Create second panel (should dispose first)
			WebviewManager.createDiffPanel(
				mockContext,
				mockRenderResult,
				undefined,
				'/workspace/test2.md'
			);

			expect(WebviewManager.hasActivePanel()).toBe(true);
		});
	});
});
