/**
 * Integration tests for scroll synchronization (Story 4.3)
 *
 * Tests the integration between:
 * - WebviewManager config change listener
 * - MessageHandler updateSyncScroll
 * - Webview message protocol
 *
 * AC3: Configuration setting for sync scroll
 * AC4: Disabled sync scroll behavior
 * AC7: Initialize sync scroll from config
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebviewManager } from './webviewManager';
import type { RenderResult } from '../types/webview.types';

// Mock panel with message tracking
const postMessageCalls: any[] = [];
const mockPanel = {
	webview: {
		html: '',
		cspSource: 'vscode-webview://test',
		asWebviewUri: vi.fn((uri: any) => ({
			toString: () => `vscode-webview://test/${uri.path}`,
		})),
		onDidReceiveMessage: vi.fn(),
		postMessage: vi.fn(async (message: any) => {
			postMessageCalls.push(message);
			return true;
		}),
	},
	onDidDispose: vi.fn(),
	dispose: vi.fn(),
};

// Track config change callbacks
let configChangeCallback: ((e: any) => void) | null = null;

vi.mock('vscode', () => ({
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
				if (key === 'syncScroll') {
					return true;
				}
				return defaultValue;
			}),
		})),
		onDidChangeConfiguration: vi.fn((callback: any) => {
			configChangeCallback = callback;
			return { dispose: vi.fn() };
		}),
	},
	commands: {
		executeCommand: vi.fn(),
	},
}));

// Mock ContentBuilder
vi.mock('./contentBuilder', () => ({
	ContentBuilder: {
		buildWebviewHtml: vi.fn(() => '<html>Mock HTML</html>'),
	},
}));

describe('Scroll Sync Integration Tests (Story 4.3)', () => {
	let mockContext: any;
	let renderResult: RenderResult;

	beforeEach(() => {
		vi.clearAllMocks();
		postMessageCalls.length = 0;
		configChangeCallback = null;

		// Reset panel mock
		mockPanel.webview.html = '';
		mockPanel.webview.onDidReceiveMessage.mockClear();
		mockPanel.webview.postMessage.mockClear();
		mockPanel.onDidDispose.mockClear();
		mockPanel.dispose.mockClear();

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
	});

	describe('AC3: Configuration setting for sync scroll', () => {
		it('should register config change listener when panel is created', async () => {
			const vscode = await import('vscode');

			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
			expect(configChangeCallback).not.toBeNull();
		});

		it('should read syncScroll config on initialization', async () => {
			const vscode = await import('vscode');

			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Simulate webview ready message
			const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
			messageCallback({ type: 'ready' });

			// Check that initialize message was sent with config
			const initMessage = postMessageCalls.find((m) => m.type === 'initialize');
			expect(initMessage).toBeDefined();
			expect(initMessage.data.config.syncScroll).toBe(true);
		});
	});

	describe('AC4: Runtime config change handling', () => {
		it('should send updateConfig message when syncScroll changes', async () => {
			const vscode = await import('vscode');

			// Mock config to return false for syncScroll
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === 'syncScroll') {
						return false;
					}
					return defaultValue;
				}),
			});

			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Simulate webview ready
			const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
			messageCallback({ type: 'ready' });

			// Clear previous messages
			postMessageCalls.length = 0;

			// Simulate config change event
			expect(configChangeCallback).not.toBeNull();
			configChangeCallback!({
				affectsConfiguration: (section: string) => section === 'markdownPreviewDiff.syncScroll',
			});

			// Check that updateConfig message was sent
			const updateConfigMessage = postMessageCalls.find((m) => m.type === 'updateConfig');
			expect(updateConfigMessage).toBeDefined();
			expect(updateConfigMessage.config.syncScroll).toBe(false);
		});

		it('should not send updateConfig for unrelated config changes', async () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Simulate webview ready
			const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
			messageCallback({ type: 'ready' });

			// Clear previous messages
			postMessageCalls.length = 0;

			// Simulate unrelated config change
			configChangeCallback!({
				affectsConfiguration: (section: string) => section === 'some.other.setting',
			});

			// No updateConfig message should be sent
			const updateConfigMessage = postMessageCalls.find((m) => m.type === 'updateConfig');
			expect(updateConfigMessage).toBeUndefined();
		});
	});

	describe('AC7: Initialize sync scroll from config', () => {
		it('should include syncScroll in initialize message data', async () => {
			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Simulate webview ready message
			const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
			messageCallback({ type: 'ready' });

			// Verify initialize message structure
			const initMessage = postMessageCalls.find((m) => m.type === 'initialize');
			expect(initMessage).toMatchObject({
				type: 'initialize',
				data: {
					renderResult: expect.any(Object),
					config: {
						syncScroll: expect.any(Boolean),
						highlightStyle: expect.any(String),
					},
				},
			});
		});

		it('should pass renderResult with changes in initialize message', async () => {
			const renderResultWithChanges: RenderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: [
					{ id: 'change-1', beforeOffset: 0, afterOffset: 0 },
					{ id: 'change-2', beforeOffset: 100, afterOffset: 100 },
				],
			};

			WebviewManager.createDiffPanel(mockContext, renderResultWithChanges);

			// Simulate webview ready
			const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
			messageCallback({ type: 'ready' });

			const initMessage = postMessageCalls.find((m) => m.type === 'initialize');
			expect(initMessage.data.renderResult.changes).toHaveLength(2);
		});
	});

	describe('Config listener cleanup', () => {
		it('should dispose config listener when panel is disposed', async () => {
			const vscode = await import('vscode');

			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Get the dispose callback
			const disposeCallback = mockPanel.onDidDispose.mock.calls[0][0];

			// Dispose the panel
			disposeCallback();

			// Creating a new panel should register a new listener
			const initialCallCount = (vscode.workspace.onDidChangeConfiguration as any).mock.calls.length;

			WebviewManager.createDiffPanel(mockContext, renderResult);

			expect((vscode.workspace.onDidChangeConfiguration as any).mock.calls.length).toBe(
				initialCallCount + 1
			);
		});
	});
});
