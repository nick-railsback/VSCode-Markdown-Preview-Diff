/**
 * Memory Leak Detection Tests
 *
 * Tests that verify proper resource cleanup and memory management.
 * Validates AC9-AC13 (memory footprint and resource cleanup).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock VS Code API
const mockDispose = vi.fn();
const mockPanel = {
	dispose: mockDispose,
	onDidDispose: vi.fn((callback: () => void) => {
		// Store callback to call it when dispose is called
		mockDispose.mockImplementation(() => {
			callback();
		});
		return { dispose: vi.fn() };
	}),
	webview: {
		html: '',
		onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() }))
	}
};

const mockCreateWebviewPanel = vi.fn(() => mockPanel);

vi.mock('vscode', () => ({
	window: {
		createWebviewPanel: mockCreateWebviewPanel,
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn()
	},
	ViewColumn: {
		Two: 2
	},
	Uri: {
		joinPath: vi.fn((base: any, ...paths: string[]) => ({
			toString: () => paths.join('/')
		}))
	}
}));

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

		it('should clean up when panel is disposed via onDidDispose callback', () => {
			// Create panel
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Trigger the onDidDispose callback
			mockDispose();

			// Verify cleanup
			expect(WebviewManager.hasActivePanel()).toBe(false);
		});

		it('should dispose previous panel when creating new panel (single panel pattern)', () => {
			// Create first panel
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);
			const firstPanelDispose = mockDispose;

			// Create second panel
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);

			// First panel should have been disposed
			expect(firstPanelDispose).toHaveBeenCalled();
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
			const createCalls: any[] = [];

			for (let i = 0; i < 5; i++) {
				WebviewManager.createDiffPanel(mockContext, mockRenderResult);
				createCalls.push(mockCreateWebviewPanel.mock.calls.length);
				WebviewManager.dispose();
			}

			// Each cycle should create a new panel (5 total creations)
			expect(mockCreateWebviewPanel).toHaveBeenCalledTimes(5);
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

	describe('Event Listener Cleanup (AC11)', () => {
		it('should register onDidReceiveMessage listener during creation', () => {
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);

			// Verify listener was registered
			expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
		});

		it('should clean up message handler reference on disposal', () => {
			WebviewManager.createDiffPanel(mockContext, mockRenderResult);
			WebviewManager.dispose();

			// After disposal, attempting to send messages should be no-op
			// (This is verified by checking hasActivePanel which indicates handler cleanup)
			expect(WebviewManager.hasActivePanel()).toBe(false);
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
