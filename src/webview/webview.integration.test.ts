/**
 * Integration tests for webview components
 * Tests end-to-end webview creation with MarkdownRenderer and DiffComputer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebviewManager } from './webviewManager';
import { ContentBuilder } from './contentBuilder';
import { MarkdownRenderer } from '../markdown/markdownRenderer';
import { DiffComputer } from '../diff/diffComputer';
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
		onDidReceiveMessage: vi.fn((callback: any) => {
			// Store callback for testing
			return { dispose: vi.fn() };
		}),
		postMessage: vi.fn().mockResolvedValue(true),
	},
	onDidDispose: vi.fn((callback: any) => {
		// Store callback for testing
		return { dispose: vi.fn() };
	}),
	dispose: vi.fn(),
	reveal: vi.fn(),
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
			Two: 2,
		},
		Uri: {
			joinPath: vi.fn((base: any, ...paths: any[]) => ({
				path: `${base.path}/${paths.join('/')}`,
			})),
			file: vi.fn((path: string) => ({
				toString: () => `file://${path}`,
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

describe('Webview Integration Tests', () => {
	let mockContext: any;
	let renderer: MarkdownRenderer;
	let diffComputer: DiffComputer;

	beforeEach(() => {
		vi.clearAllMocks();
		ConfigurationService.resetInstance();

		// Reset panel mock
		mockPanel.webview.html = '';

		mockContext = {
			extensionUri: { path: '/extension' },
			subscriptions: [],
		};

		renderer = new MarkdownRenderer();
		diffComputer = new DiffComputer();

		// Clean up any previous panels
		WebviewManager.dispose();
	});

	afterEach(() => {
		WebviewManager.dispose();
		ConfigurationService.resetInstance();
	});

	describe('End-to-end webview creation with markdown rendering', () => {
		it('should create webview with rendered markdown content', async () => {
			// Step 1: Render markdown
			const beforeMarkdown = '# Before\n\nThis is the before content.';
			const afterMarkdown = '# After\n\nThis is the **after** content.';

			const renderOptions = {
				workspaceRoot: '/workspace',
				markdownFilePath: '/workspace/test.md',
			};

			const beforeResult = await renderer.render(beforeMarkdown, renderOptions);
			const afterResult = await renderer.render(afterMarkdown, renderOptions);

			expect(beforeResult.success).toBe(true);
			expect(afterResult.success).toBe(true);

			// Step 2: Create RenderResult
			const renderResult: RenderResult = {
				beforeHtml: beforeResult.success ? beforeResult.html : '',
				afterHtml: afterResult.success ? afterResult.html : '',
				changes: [], // DiffComputer not integrated yet (Story 2.5)
			};

			// Step 3: Create webview panel
			WebviewManager.createDiffPanel(mockContext, renderResult);

			// Verify panel was created
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Verify HTML was set
			expect(mockPanel.webview.html).toBeTruthy();
			expect(mockPanel.webview.html.length).toBeGreaterThan(0);
		});

		it('should include CSP meta tag in generated HTML', async () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Test before</p>',
				afterHtml: '<p>Test after</p>',
				changes: [],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;
			expect(html).toContain('Content-Security-Policy');
			expect(html).toContain('default-src \'none\'');
		});

		it('should include both panes with content', async () => {
			const beforeMarkdown = '## Before Heading';
			const afterMarkdown = '## After Heading';

			const renderOptions = {
				workspaceRoot: '/workspace',
				markdownFilePath: '/workspace/test.md',
			};

			const beforeResult = await renderer.render(beforeMarkdown, renderOptions);
			const afterResult = await renderer.render(afterMarkdown, renderOptions);

			const renderResult: RenderResult = {
				beforeHtml: beforeResult.success ? beforeResult.html : '',
				afterHtml: afterResult.success ? afterResult.html : '',
				changes: [],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;
			expect(html).toContain('Before (HEAD)');
			expect(html).toContain('After (Working)');
			expect(html).toContain('Before Heading');
			expect(html).toContain('After Heading');
		});

		it('should dispose resources when panel is closed', async () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: [],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Simulate panel disposal
			WebviewManager.dispose();

			expect(WebviewManager.hasActivePanel()).toBe(false);
			expect(mockPanel.dispose).toHaveBeenCalled();
		});

		it('should handle complex markdown with code blocks', async () => {
			const beforeMarkdown = '```javascript\nconst x = 1;\n```';
			const afterMarkdown = '```javascript\nconst x = 2;\n```';

			const renderOptions = {
				workspaceRoot: '/workspace',
				markdownFilePath: '/workspace/test.md',
			};

			const beforeResult = await renderer.render(beforeMarkdown, renderOptions);
			const afterResult = await renderer.render(afterMarkdown, renderOptions);

			expect(beforeResult.success).toBe(true);
			expect(afterResult.success).toBe(true);

			const renderResult: RenderResult = {
				beforeHtml: beforeResult.success ? beforeResult.html : '',
				afterHtml: afterResult.success ? afterResult.html : '',
				changes: [],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;
			// Code content is inside the HTML, check for presence
			expect(html).toContain('<code');
			expect(beforeResult.html).toContain('1');
			expect(afterResult.html).toContain('2');
		});
	});

	describe('Integration with DiffComputer', () => {
		it('should compute diff and store in RenderResult', () => {
			const beforeText = 'Hello world';
			const afterText = 'Hello beautiful world';

			const diffResult = diffComputer.compute(beforeText, afterText);

			expect(diffResult.changeCount).toBeGreaterThan(0);
			expect(diffResult.changes.length).toBeGreaterThan(0);

			// Verify we can create a RenderResult with diff data
			const renderResult: RenderResult = {
				beforeHtml: '<p>Hello world</p>',
				afterHtml: '<p>Hello beautiful world</p>',
				changes: [], // Will be mapped from diffResult in Story 2.5
			};

			expect(renderResult).toBeDefined();
			expect(renderResult.beforeHtml).toBeTruthy();
			expect(renderResult.afterHtml).toBeTruthy();
		});
	});

	describe('ContentBuilder HTML generation', () => {
		it('should generate valid HTML structure', () => {
			const renderResult: RenderResult = {
				beforeHtml: '<h1>Before</h1>',
				afterHtml: '<h1>After</h1>',
				changes: [],
			};

			const mockWebview = {
				cspSource: 'vscode-webview://test',
				asWebviewUri: vi.fn((uri: any) => ({
					toString: () => `vscode-webview://test${uri.path}`,
				})),
			};

			const mockExtensionUri = { path: '/extension' };

			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('<html lang="en">');
			expect(html).toContain('</html>');
			expect(html).toContain('<h1>Before</h1>');
			expect(html).toContain('<h1>After</h1>');
		});

		it('should include all required CSS files', () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Test</p>',
				afterHtml: '<p>Test</p>',
				changes: [],
			};

			const mockWebview = {
				cspSource: 'vscode-webview://test',
				asWebviewUri: vi.fn((uri: any) => ({
					toString: () => `vscode-webview://test${uri.path}`,
				})),
			};

			const mockExtensionUri = { path: '/extension' };

			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('github-markdown.css');
			expect(html).toContain('layout.css');
			expect(html).toContain('diff.css');
		});
	});

	describe('Single active panel pattern', () => {
		it('should close previous panel when creating new one', async () => {
			const renderResult1: RenderResult = {
				beforeHtml: '<p>First before</p>',
				afterHtml: '<p>First after</p>',
				changes: [],
			};

			// Create first panel
			WebviewManager.createDiffPanel(mockContext, renderResult1);
			expect(WebviewManager.hasActivePanel()).toBe(true);

			// Reset mock to track second panel
			mockPanel.dispose.mockClear();

			const renderResult2: RenderResult = {
				beforeHtml: '<p>Second before</p>',
				afterHtml: '<p>Second after</p>',
				changes: [],
			};

			// Create second panel
			WebviewManager.createDiffPanel(mockContext, renderResult2);

			// First panel should have been disposed
			expect(mockPanel.dispose).toHaveBeenCalled();
			expect(WebviewManager.hasActivePanel()).toBe(true);
		});
	});

	// Story 4.4 - Toolbar navigation button integration tests
	describe('Toolbar navigation buttons integration', () => {
		it('should render toolbar with navigation buttons when changes exist (AC1, AC2, AC3)', () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: [
					{ id: 'change-1', beforeOffset: 0, afterOffset: 0 },
					{ id: 'change-2', beforeOffset: 10, afterOffset: 10 },
				],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;

			// Verify toolbar structure
			expect(html).toContain('id="toolbar"');
			expect(html).toContain('id="prev-change"');
			expect(html).toContain('id="next-change"');
			expect(html).toContain('id="change-counter"');

			// Verify button attributes for accessibility (AC2, AC3, AC7)
			expect(html).toContain('aria-label="Previous Change"');
			expect(html).toContain('aria-label="Next Change"');
			expect(html).toContain('title="Previous Change (p)"');
			expect(html).toContain('title="Next Change (n)"');
		});

		it('should show correct initial counter with changes (AC4, AC9)', () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: [
					{ id: 'change-1', beforeOffset: 0, afterOffset: 0 },
					{ id: 'change-2', beforeOffset: 10, afterOffset: 10 },
					{ id: 'change-3', beforeOffset: 20, afterOffset: 20 },
				],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;
			expect(html).toContain('Change 1 of 3');
		});

		it('should show "No changes" and disabled buttons when no changes (AC4, AC8)', () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: [],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;
			expect(html).toContain('No changes');

			// Verify buttons are disabled (AC8)
			expect(html).toMatch(/id="prev-change"[^>]*disabled/);
			expect(html).toMatch(/id="next-change"[^>]*disabled/);
		});

		it('should enable buttons when there are changes (AC9)', () => {
			const renderResult: RenderResult = {
				beforeHtml: '<p>Before</p>',
				afterHtml: '<p>After</p>',
				changes: [{ id: 'change-1', beforeOffset: 0, afterOffset: 0 }],
			};

			WebviewManager.createDiffPanel(mockContext, renderResult);

			const html = mockPanel.webview.html;

			// Buttons should NOT have disabled attribute when there are changes
			const prevButtonMatch = html.match(/<button id="prev-change"[^>]*>/);
			const nextButtonMatch = html.match(/<button id="next-change"[^>]*>/);
			expect(prevButtonMatch).toBeTruthy();
			expect(nextButtonMatch).toBeTruthy();
			expect(prevButtonMatch![0]).not.toContain('disabled');
			expect(nextButtonMatch![0]).not.toContain('disabled');
		});
	});
});
