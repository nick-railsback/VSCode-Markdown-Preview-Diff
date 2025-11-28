/**
 * Integration tests for change navigation commands
 * Tests end-to-end navigation flow from command to WebviewManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextChange } from './nextChange';
import { prevChange } from './prevChange';
import { ChangeNavigator } from '../diff/changeNavigator';
import type { ChangeLocation } from '../types/diff.types';

// Mock panel for WebviewManager
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

// Mock vscode
vi.mock('vscode', () => ({
	window: {
		createWebviewPanel: vi.fn(() => mockPanel),
		showInformationMessage: vi.fn(),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	ViewColumn: {
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
			get: vi.fn((key: string, defaultValue: any) => defaultValue),
		})),
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
	},
	commands: {
		executeCommand: vi.fn(),
	},
}));

// Import WebviewManager after mocking vscode
import { WebviewManager } from '../webview/webviewManager';

// Mock ContentBuilder
vi.mock('../webview/contentBuilder', () => ({
	ContentBuilder: {
		buildWebviewHtml: vi.fn(() => '<html>Mock HTML</html>'),
	},
}));

// Mock MessageHandler
vi.mock('../webview/messageHandler', () => ({
	MessageHandler: class MockMessageHandler {
		handleMessage = vi.fn();
		sendMessage = vi.fn();
		setRenderResult = vi.fn();
		constructor(public webview: any) {}
	},
}));

describe('Navigation Integration Tests', () => {
	let changeLocations: ChangeLocation[];
	let changeNavigator: ChangeNavigator;
	let mockContext: any;
	let vscode: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset panel mock
		mockPanel.webview.html = '';
		mockPanel.webview.onDidReceiveMessage.mockClear();
		mockPanel.webview.postMessage.mockClear();
		mockPanel.onDidDispose.mockClear();
		mockPanel.dispose.mockClear();

		// Create change locations
		changeLocations = [
			{ id: 'change-0', beforeOffset: 0, afterOffset: 0 },
			{ id: 'change-1', beforeOffset: 100, afterOffset: 100 },
			{ id: 'change-2', beforeOffset: 200, afterOffset: 200 },
			{ id: 'change-3', beforeOffset: 300, afterOffset: 300 },
			{ id: 'change-4', beforeOffset: 400, afterOffset: 400 },
		];

		changeNavigator = new ChangeNavigator(changeLocations);

		mockContext = {
			extensionUri: { path: '/extension' },
			subscriptions: [],
		};

		// Import vscode mock
		vscode = await import('vscode');

		// Clean up any previous panels
		WebviewManager.dispose();
	});

	afterEach(() => {
		WebviewManager.dispose();
	});

	describe('AC3 & AC4: End-to-end navigation flow', () => {
		it('should navigate to next change through WebviewManager', async () => {
			// Create panel with ChangeNavigator
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Execute nextChange command
			await nextChange();

			// Verify navigation occurred (change from 0 to 1)
			expect(changeNavigator.getCurrentIndex()).toBe(1);
		});

		it('should navigate to previous change through WebviewManager', async () => {
			// Create panel with ChangeNavigator
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Move to index 2 first
			changeNavigator.goToNext(); // 0 -> 1
			changeNavigator.goToNext(); // 1 -> 2

			// Execute prevChange command
			await prevChange();

			// Verify navigation occurred (change from 2 to 1)
			expect(changeNavigator.getCurrentIndex()).toBe(1);
		});

		it('should maintain navigation state across multiple commands', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Navigate forward then backward
			await nextChange(); // 0 -> 1
			await nextChange(); // 1 -> 2
			await nextChange(); // 2 -> 3
			await prevChange(); // 3 -> 2
			await prevChange(); // 2 -> 1

			expect(changeNavigator.getCurrentIndex()).toBe(1);
		});
	});

	describe('AC5 & AC6: Wrapping behavior integration', () => {
		it('should wrap from last to first change', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Navigate to end and wrap
			await nextChange(); // 0 -> 1
			await nextChange(); // 1 -> 2
			await nextChange(); // 2 -> 3
			await nextChange(); // 3 -> 4
			await nextChange(); // 4 -> 0 (wrap)

			expect(changeNavigator.getCurrentIndex()).toBe(0);
		});

		it('should wrap from first to last change', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Navigate backwards from start (should wrap)
			await prevChange(); // 0 -> 4

			expect(changeNavigator.getCurrentIndex()).toBe(4);
		});
	});

	describe('AC8: Message protocol integration', () => {
		it('should send correctly formatted navigateToChange message', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Spy on the navigateToChange method
			const navigateSpy = vi.spyOn(WebviewManager, 'navigateToChange');

			await nextChange();

			expect(navigateSpy).toHaveBeenCalledWith(1);
			expect(navigateSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('ChangeNavigator state sharing', () => {
		it('should share ChangeNavigator between WebviewManager and commands', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Get ChangeNavigator from WebviewManager
			const retrievedNavigator = WebviewManager.getChangeNavigator();

			expect(retrievedNavigator).toBe(changeNavigator);
			expect(retrievedNavigator?.getTotalChanges()).toBe(5);
		});

		it('should clear ChangeNavigator when panel is disposed', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);
			expect(WebviewManager.getChangeNavigator()).toBeDefined();

			// Simulate panel disposal
			const disposeCallback = mockPanel.onDidDispose.mock.calls[0][0];
			disposeCallback();

			expect(WebviewManager.getChangeNavigator()).toBeUndefined();
		});
	});

	describe('Error handling', () => {
		it('should handle navigation when panel is disposed', async () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: changeLocations,
			};

			WebviewManager.createDiffPanel(mockContext, renderResult, changeNavigator);

			// Dispose panel
			const disposeCallback = mockPanel.onDidDispose.mock.calls[0][0];
			disposeCallback();

			// Navigation should show message, not throw
			await expect(nextChange()).resolves.not.toThrow();
			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No diff panel open');
		});
	});
});
