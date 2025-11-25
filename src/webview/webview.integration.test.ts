/**
 * Integration tests for webview components
 * Tests end-to-end webview creation with MarkdownRenderer and DiffComputer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebviewManager } from './webviewManager';
import { ContentBuilder } from './contentBuilder';
import { MarkdownRenderer } from '../markdown/markdownRenderer';
import { DiffComputer } from '../diff/diffComputer';
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
	},
}));

describe('Webview Integration Tests', () => {
	let mockContext: any;
	let renderer: MarkdownRenderer;
	let diffComputer: DiffComputer;

	beforeEach(() => {
		vi.clearAllMocks();

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
});
