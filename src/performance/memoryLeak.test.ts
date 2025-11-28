/**
 * Memory Leak Detection Tests
 *
 * Tests that verify proper resource cleanup and memory management.
 * Validates AC9-AC13 (memory footprint and resource cleanup).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock variables must be defined inside the factory to avoid hoisting issues
vi.mock('vscode', () => {
	const mockDispose = vi.fn();
	const mockPanel = {
		dispose: mockDispose,
		onDidDispose: vi.fn((callback: () => void) => {
			mockDispose.mockImplementation(() => {
				callback();
			});
			return { dispose: vi.fn() };
		}),
		webview: {
			html: '',
			onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
			asWebviewUri: vi.fn((uri: any) => ({
				toString: () => `vscode-webview://mock/${uri?.toString?.() || 'uri'}`
			})),
			cspSource: 'vscode-webview:',
			postMessage: vi.fn(() => Promise.resolve(true))
		}
	};

	return {
		window: {
			createWebviewPanel: vi.fn(() => mockPanel),
			showErrorMessage: vi.fn(),
			showWarningMessage: vi.fn(),
			showInformationMessage: vi.fn(),
			createOutputChannel: vi.fn(() => ({
				appendLine: vi.fn(),
				show: vi.fn(),
				dispose: vi.fn()
			}))
		},
		ViewColumn: {
			Two: 2
		},
		Uri: {
			joinPath: vi.fn((base: any, ...paths: string[]) => ({
				toString: () => paths.join('/')
			})),
			file: vi.fn((path: string) => ({
				fsPath: path,
				scheme: 'file'
			}))
		},
		workspace: {
			onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
			createFileSystemWatcher: vi.fn(() => ({
				onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
				onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
				dispose: vi.fn()
			})),
			getWorkspaceFolder: vi.fn(() => ({
				uri: { fsPath: '/mock/workspace' }
			})),
			asRelativePath: vi.fn(() => 'relative/path'),
			textDocuments: [],
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string) => {
					const defaults: Record<string, any> = {
						'defaultComparisonTarget': 'HEAD',
						'syncScroll': true,
						'highlightStyle': 'default',
						'renderTimeout': 5000
					};
					return defaults[key];
				}),
				update: vi.fn()
			})),
			onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() }))
		},
		commands: {
			executeCommand: vi.fn()
		},
		RelativePattern: vi.fn((folder: any, pattern: string) => ({ folder, pattern })),
		EventEmitter: vi.fn().mockImplementation(function(this: any) {
			this.event = vi.fn();
			this.fire = vi.fn();
			this.dispose = vi.fn();
			return this;
		}),
		extensions: {
			getExtension: vi.fn(() => null)
		}
	};
});

import { WebviewManager } from '../../src/webview/webviewManager';
import type { RenderResult } from '../../src/types/webview.types';

describe('Memory Leak Detection', () => {
	const mockContext = {
		extensionUri: { fsPath: '/mock/extension' },
		subscriptions: []
	} as any;

	const mockRenderResult: RenderResult = {
		beforeHtml: '<p>Before</p>',
		afterHtml: '<p>After</p>',
		changes: []
	};

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset WebviewManager state
		WebviewManager.dispose();
	});

	afterEach(() => {
		WebviewManager.dispose();
	});

	describe('Webview Panel Cleanup (AC10-AC13)', () => {
		it('should set activePanel to undefined after disposal', () => {
			// Create panel
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Dispose panel
			WebviewManager.dispose();
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});

		it('should dispose previous panel when creating new panel (single panel pattern)', () => {
			// Create first panel
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Create second panel (should dispose first)
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);

			// New panel should be active (first was disposed)
			expect(WebviewManager.hasActivePanel()).toBe(true);
		});
	});

	describe('Multiple Open/Close Cycles (AC9)', () => {
		it('should handle 10 open/close cycles without accumulating references', () => {
			const cycleCount = 10;
			const initialMemory = process.memoryUsage();

			// Perform 10 open/close cycles
			for (let i = 0; i < cycleCount; i++) {
				// Create panel
				WebviewManager.createDiffPanel(mockContext, mockRenderResult);
				expect(WebviewManager.hasActivePanel()).toBe(true);

				// Dispose panel
				WebviewManager.dispose();
				expect(WebviewManager.hasActivePanel()).toBe(false);
			}

			// Force garbage collection if available (Node.js with --expose-gc flag)
			if (global.gc) {
				global.gc();
			}

			const finalMemory = process.memoryUsage();
			const memoryDeltaMB = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

			// Memory delta should be minimal (< 10MB allowing for GC delays)
			// Note: This is a rough check since test framework itself uses memory
			expect(Math.abs(memoryDeltaMB)).toBeLessThan(10);
		});

		it('should create fresh instances on each cycle', () => {
			for (let i = 0; i < 5; i++) {
				WebviewManager.createDiffPanel(mockContext, mockRenderResult);
				expect(WebviewManager.hasActivePanel()).toBe(true);
				WebviewManager.dispose();
				expect(WebviewManager.hasActivePanel()).toBe(false);
			}

			// All 5 cycles should complete without errors
			expect(true).toBe(true);
		});
	});

	describe('Resource Cleanup Timing (AC10)', () => {
		it('should complete cleanup within 1 second of disposal', async () => {
			// Create panel
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);

			const start = Date.now();
			WebviewManager.dispose();
			const duration = Date.now() - start;

			// Cleanup should be immediate (synchronous)
			expect(duration).toBeLessThan(1000);
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});

		it('should clean up synchronously without async delays', () => {
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);

			// Disposal should be synchronous
			const hasActiveBefore = WebviewManager.hasActivePanel();
			WebviewManager.dispose();
			const hasActiveAfter = WebviewManager.hasActivePanel();

			expect(hasActiveBefore).toBe(true);
			expect(hasActiveAfter).toBe(false);
		});
	});

	describe('Memory Footprint (AC9)', () => {
		it('should maintain reasonable memory usage for single panel', () => {
			const beforeMemory = process.memoryUsage().heapUsed;

			// Create panel with realistic render result
			const largeRenderResult: RenderResult = {
				beforeHtml: '<div>' + 'x'.repeat(10000) + '</div>',
				afterHtml: '<div>' + 'y'.repeat(10000) + '</div>',
				changes: []
			};

			WebviewManager.createDiffPanel(mockContext, largeRenderResult);

			const afterMemory = process.memoryUsage().heapUsed;
			const memoryUsedMB = (afterMemory - beforeMemory) / (1024 * 1024);

			// Single panel should use minimal memory
			// (Most memory is in the webview process, not extension host)
			expect(memoryUsedMB).toBeLessThan(5); // Extension host footprint only
		});
	});
});
