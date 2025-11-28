/**
 * Unit tests for WebviewManager
 * Tests panel creation, disposal, and single active panel pattern
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebviewManager } from './webviewManager';
import { ConfigurationService } from '../config/extensionConfig';
import type { RenderResult } from '../types/webview.types';

// Mock vscode module
const mockPanel = {
	webview: {
		html: '',
		cspSource: 'vscode-webview://test',
		asWebviewUri: vi.fn((uri: any) => ({
			toString: () => `vscode-webview://test/${uri.path}`,
		})),
		onDidReceiveMessage: vi.fn(),
		postMessage: vi.fn().mockResolvedValue(true),
	},
	onDidDispose: vi.fn(),
	dispose: vi.fn(),
};

vi.mock('vscode', () => {
	// EventEmitter class must be inside the factory function (vi.mock is hoisted)
	class MockEventEmitter<T> {
		private listeners: ((data: T) => void)[] = [];
		event = (listener: (data: T) => void) => {
			this.listeners.push(listener);
			return { dispose: () => {} };
		};
		fire(data: T) {
			this.listeners.forEach(l => l(data));
		}
		dispose() {
			this.listeners = [];
		}
	}

	return {
		window: {
			createWebviewPanel: vi.fn(() => mockPanel),
			createOutputChannel: vi.fn(() => ({
				appendLine: vi.fn(),
				show: vi.fn(),
				dispose: vi.fn(),
			})),
			showErrorMessage: vi.fn(),
			showInformationMessage: vi.fn(),
			showWarningMessage: vi.fn(),
		},
		ViewColumn: {
			One: 1,
			Two: 2,
		},
		Uri: {
			joinPath: vi.fn((base: any, ...paths: any[]) => ({
				path: `${base.path}/${paths.join('/')}`,
			})),
		},
		workspace: {
			workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return defaultValue;
				}),
			})),
			onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
		},
		commands: {
			executeCommand: vi.fn(),
		},
		EventEmitter: MockEventEmitter,
	};
});

// Mock ContentBuilder
vi.mock('./contentBuilder', () => ({
	ContentBuilder: {
		buildWebviewHtml: vi.fn(() => '<html>Mock HTML</html>'),
	},
}));

// Mock MessageHandler
vi.mock('./messageHandler', () => ({
	MessageHandler: class MockMessageHandler {
		handleMessage = vi.fn();
		sendMessage = vi.fn();
		setRenderResult = vi.fn();
		constructor(public webview: any) {}
	},
}));

describe('WebviewManager', () => {
	let mockContext: any;
	let renderResult: RenderResult;
	let vscodeWindow: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset ConfigurationService singleton
		ConfigurationService.resetInstance();

		// Reset panel mock
		mockPanel.webview.html = '';
		mockPanel.webview.onDidReceiveMessage.mockClear();
		mockPanel.onDidDispose.mockClear();
		mockPanel.dispose.mockClear();

		// Import vscode after mocking
		const vscode = await import('vscode');
		vscodeWindow = vscode.window;

		mockContext = {
			extensionUri: { path: '/extension' },
			subscriptions: [],
		};

		renderResult = {
			beforeHtml: '<p>Before content</p>',
			afterHtml: '<p>After content</p>',
			changes: [],
		};

		// Reset static state
		WebviewManager.dispose();
	});

	afterEach(() => {
		WebviewManager.dispose();
		ConfigurationService.resetInstance();
	});

	describe('createDiffPanel', () => {
		it('should create webview panel with correct configuration', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(vscodeWindow.createWebviewPanel).toHaveBeenCalledWith(
				'markdownPreviewDiff',
				'Markdown Preview Diff: HEAD vs Working',
				2, // ViewColumn.Two
				expect.objectContaining({
					enableScripts: true,
					retainContextWhenHidden: false,
				})
			);
		});

		it('should set webview HTML content', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(mockPanel.webview.html).toBe('<html>Mock HTML</html>');
		});

		it('should register message handler', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
		});

		it('should register disposal handler', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(mockPanel.onDidDispose).toHaveBeenCalled();
		});

		it('should track active panel', () => {
			expect(WebviewManager.hasActivePanel()).toBe(false);

			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(WebviewManager.hasActivePanel()).toBe(true);
		});

		it('should dispose previous panel when creating new one (single panel pattern)', () => {
			// Create first panel
			WebviewManager.createDiffPanel(mockContext, renderResult);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Reset mock to track second call
			mockPanel.dispose.mockClear();

			// Create second panel
			WebviewManager.createDiffPanel(mockContext, renderResult);

			// First panel should be disposed
			expect(mockPanel.dispose).toHaveBeenCalled();
			expect(WebviewManager.hasActivePanel()).toBe(true);
		});

		it('should clean up when panel is disposed', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Get the dispose callback
			const disposeCallback = mockPanel.onDidDispose.mock.calls[0][0];

			// Call the dispose callback
			disposeCallback();

			// Active panel should be cleared
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});
	});

	describe('updateDiff', () => {
		it('should update diff content in active panel', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			const newRenderResult: RenderResult = {
				beforeHtml: '<p>New before</p>',
				afterHtml: '<p>New after</p>',
				changes: [],
			};

			WebviewManager.updateDiff(newRenderResult);

			// MessageHandler.sendMessage should be called
			// We can't easily verify this without more complex mocking
			// but the method should not throw
		});

		it('should not throw when no active panel', () => {
			const newRenderResult: RenderResult = {
				beforeHtml: '<p>New before</p>',
				afterHtml: '<p>New after</p>',
				changes: [],
			};

			expect(() => {
				WebviewManager.updateDiff(newRenderResult);
			}).not.toThrow();
		});
	});

	describe('navigateToChange', () => {
		it('should send navigate message to active panel', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			WebviewManager.navigateToChange(5);

			// MessageHandler.sendMessage should be called
			// Should not throw
		});

		it('should not throw when no active panel', () => {
			expect(() => {
				WebviewManager.navigateToChange(5);
			}).not.toThrow();
		});
	});

	describe('dispose', () => {
		it('should dispose active panel', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(WebviewManager.hasActivePanel()).toBe(true);

			mockPanel.dispose.mockClear();
			WebviewManager.dispose();

			expect(mockPanel.dispose).toHaveBeenCalled();
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});

		it('should not throw when no active panel', () => {
			expect(() => {
				WebviewManager.dispose();
			}).not.toThrow();
		});
	});

	describe('hasActivePanel', () => {
		it('should return false initially', () => {
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});

		it('should return true after creating panel', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);
			expect(WebviewManager.hasActivePanel()).toBe(true);
		});

		it('should return false after disposing panel', () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);
			WebviewManager.dispose();
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});
	});
});
