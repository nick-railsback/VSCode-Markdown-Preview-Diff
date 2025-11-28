/**
 * Unit tests for MessageHandler
 * Tests message routing between extension and webview
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageHandler } from './messageHandler';
import { ConfigurationService } from '../config/extensionConfig';
import type { WebviewMessage, ExtensionMessage } from '../types/webview.types';

// Mock vscode module
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
		commands: {
			executeCommand: vi.fn(),
		},
		window: {
			createOutputChannel: vi.fn(() => ({
				appendLine: vi.fn(),
				show: vi.fn(),
				dispose: vi.fn(),
			})),
			showErrorMessage: vi.fn(),
			showInformationMessage: vi.fn(),
			showWarningMessage: vi.fn(),
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
		EventEmitter: MockEventEmitter,
	};
});

describe('MessageHandler', () => {
	let mockWebview: any;
	let messageHandler: MessageHandler;
	let vscodeCommands: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset ConfigurationService singleton to ensure test isolation
		ConfigurationService.resetInstance();

		// Import vscode after mocking
		const vscode = await import('vscode');
		vscodeCommands = vscode.commands;

		mockWebview = {
			postMessage: vi.fn().mockResolvedValue(true),
		};

		messageHandler = new MessageHandler(mockWebview);
	});

	afterEach(() => {
		ConfigurationService.resetInstance();
	});

	describe('handleMessage', () => {
		it('should handle ready message', () => {
			const message: WebviewMessage = { type: 'ready' };
			messageHandler.handleMessage(message);
			// Should log that webview is ready
			// No commands should be executed
			expect(vscodeCommands.executeCommand).not.toHaveBeenCalled();
		});

		it('should handle nextChange message', () => {
			const message: WebviewMessage = { type: 'nextChange' };
			messageHandler.handleMessage(message);
			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				'markdown.previewDiff.nextChange'
			);
		});

		it('should handle prevChange message', () => {
			const message: WebviewMessage = { type: 'prevChange' };
			messageHandler.handleMessage(message);
			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				'markdown.previewDiff.prevChange'
			);
		});

		it('should handle scrolled message', () => {
			const message: WebviewMessage = { type: 'scrolled', position: 100 };
			messageHandler.handleMessage(message);
			// Should log scroll position
			// Future implementation will sync scroll
			expect(vscodeCommands.executeCommand).not.toHaveBeenCalled();
		});

		it('should handle error message from webview', async () => {
			const vscode = await import('vscode');
			const message: WebviewMessage = { type: 'error', error: 'Test error' };
			messageHandler.handleMessage(message);
			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				'Webview error: Test error'
			);
		});

		it('should handle close message', () => {
			const message: WebviewMessage = { type: 'close' };
			messageHandler.handleMessage(message);
			// Panel will be disposed automatically by VS Code
			expect(vscodeCommands.executeCommand).not.toHaveBeenCalled();
		});
	});

	describe('sendMessage', () => {
		it('should send initialize message to webview', () => {
			const message: ExtensionMessage = {
				type: 'initialize',
				data: {
					renderResult: {
						beforeHtml: '<p>Before</p>',
						afterHtml: '<p>After</p>',
						changes: [],
					},
					config: {
						syncScroll: false,
						highlightStyle: 'default',
					},
				},
			};

			messageHandler.sendMessage(message);
			expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
		});

		it('should send updateDiff message to webview', () => {
			const message: ExtensionMessage = {
				type: 'updateDiff',
				data: {
					beforeHtml: '<p>Updated before</p>',
					afterHtml: '<p>Updated after</p>',
					changes: [],
				},
			};

			messageHandler.sendMessage(message);
			expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
		});

		it('should send navigateToChange message to webview', () => {
			const message: ExtensionMessage = {
				type: 'navigateToChange',
				changeIndex: 5,
			};

			messageHandler.sendMessage(message);
			expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
		});

		it('should send error message to webview', () => {
			const message: ExtensionMessage = {
				type: 'error',
				message: 'Test error message',
			};

			messageHandler.sendMessage(message);
			expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
		});

		it('should handle postMessage failure', async () => {
			mockWebview.postMessage.mockResolvedValue(false);

			const message: ExtensionMessage = {
				type: 'error',
				message: 'Test',
			};

			messageHandler.sendMessage(message);

			// Wait for promise to resolve
			await new Promise(resolve => setTimeout(resolve, 0));

			// Should log warning but not throw
			expect(mockWebview.postMessage).toHaveBeenCalled();
		});

		it('should handle postMessage rejection', async () => {
			mockWebview.postMessage.mockRejectedValue(new Error('Connection failed'));

			const message: ExtensionMessage = {
				type: 'error',
				message: 'Test',
			};

			messageHandler.sendMessage(message);

			// Wait for promise to reject
			await new Promise(resolve => setTimeout(resolve, 0));

			// Should log warning but not throw
			expect(mockWebview.postMessage).toHaveBeenCalled();
		});
	});

	describe('updateSyncScroll (Story 4.3)', () => {
		it('should send updateConfig message when syncScroll is enabled', () => {
			messageHandler.updateSyncScroll(true);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'updateConfig',
				config: { syncScroll: true }
			});
		});

		it('should send updateConfig message when syncScroll is disabled', () => {
			messageHandler.updateSyncScroll(false);

			expect(mockWebview.postMessage).toHaveBeenCalledWith({
				type: 'updateConfig',
				config: { syncScroll: false }
			});
		});
	});

	describe('ready message with syncScroll config (Story 4.3)', () => {
		it('should send initialize with syncScroll config from settings', () => {
			const renderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: []
			};

			messageHandler.setRenderResult(renderResult);
			messageHandler.handleMessage({ type: 'ready' });

			expect(mockWebview.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'initialize',
					data: expect.objectContaining({
						config: expect.objectContaining({
							syncScroll: true
						})
					})
				})
			);
		});
	});
});
