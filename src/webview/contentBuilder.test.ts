/**
 * Unit tests for ContentBuilder
 * Tests HTML generation with CSP, resource URIs, and content injection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentBuilder } from './contentBuilder';
import type { RenderResult } from '../types/webview.types';

// Mock vscode module
vi.mock('vscode', () => ({
	Uri: {
		joinPath: vi.fn((base: any, ...paths: any[]) => ({
			path: `${base.path}/${paths.join('/')}`,
		})),
	},
}));

const mockWebview = {
	cspSource: 'vscode-webview://test',
	asWebviewUri: vi.fn((uri: any) => ({
		toString: () => `vscode-webview://test/${uri.path}`,
	})),
};

const mockExtensionUri = {
	path: '/extension',
};

describe('ContentBuilder', () => {
	let renderResult: RenderResult;

	beforeEach(() => {
		vi.clearAllMocks();
		renderResult = {
			beforeHtml: '<p>Before content</p>',
			afterHtml: '<p>After content</p>',
			changes: [],
		};
	});

	describe('buildWebviewHtml', () => {
		it('should generate valid HTML with CSP meta tag', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('<html lang="en">');
			expect(html).toContain('Content-Security-Policy');
			expect(html).toContain('default-src \'none\'');
			expect(html).toContain('script-src \'nonce-');
		});

		it('should include all CSS resources', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('github-markdown.css');
			expect(html).toContain('layout.css');
			expect(html).toContain('diff.css');
		});

		it('should include loading indicator', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('id="loading"');
			expect(html).toContain('loading-indicator');
			expect(html).toContain('spinner');
			expect(html).toContain('Loading diff...');
		});

		it('should include both panes with correct labels', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('pane-before');
			expect(html).toContain('Before (HEAD)');
			expect(html).toContain('pane-after');
			expect(html).toContain('After (Working)');
		});

		it('should inject beforeHtml and afterHtml content', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('<p>Before content</p>');
			expect(html).toContain('<p>After content</p>');
		});

		it('should include main.js script with nonce', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('scripts/main.js');
			expect(html).toContain('nonce=');
		});

		it('should hide diff container initially', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('id="diff-container"');
			expect(html).toContain('style="display: none;"');
		});

		it('should generate unique nonce for each call', () => {
			const html1 = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);
			const html2 = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			const nonce1Match = html1.match(/nonce="([^"]+)"/);
			const nonce2Match = html2.match(/nonce="([^"]+)"/);

			expect(nonce1Match).not.toBeNull();
			expect(nonce2Match).not.toBeNull();
			expect(nonce1Match![1]).not.toBe(nonce2Match![1]);
		});

		it('should call webview.asWebviewUri for all resources', () => {
			ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			// Should be called for: github-markdown.css, layout.css, diff.css, scrollSync.js, main.js (5 calls)
			expect(mockWebview.asWebviewUri).toHaveBeenCalledTimes(5);
		});

		it('should include scrollSync.js script before main.js (Story 4.3)', () => {
			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				renderResult
			);

			expect(html).toContain('scrollSync.js');
			// scrollSync.js should be loaded before main.js
			const scrollSyncIndex = html.indexOf('scrollSync.js');
			const mainJsIndex = html.indexOf('main.js');
			expect(scrollSyncIndex).toBeLessThan(mainJsIndex);
		});

		it('should handle empty HTML content', () => {
			const emptyResult: RenderResult = {
				beforeHtml: '',
				afterHtml: '',
				changes: [],
			};

			const html = ContentBuilder.buildWebviewHtml(
				mockWebview as any,
				mockExtensionUri as any,
				emptyResult
			);

			expect(html).toContain('<html lang="en">');
			expect(html).toContain('pane-before');
			expect(html).toContain('pane-after');
		});

		// Story 4.4 - Toolbar navigation button tests
		describe('toolbar navigation buttons', () => {
			it('should include prev-change button with correct attributes (AC2)', () => {
				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					renderResult
				);

				expect(html).toContain('id="prev-change"');
				expect(html).toContain('title="Previous Change (p)"');
				expect(html).toContain('aria-label="Previous Change"');
			});

			it('should include next-change button with correct attributes (AC3)', () => {
				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					renderResult
				);

				expect(html).toContain('id="next-change"');
				expect(html).toContain('title="Next Change (n)"');
				expect(html).toContain('aria-label="Next Change"');
			});

			it('should include change counter display (AC4)', () => {
				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					renderResult
				);

				expect(html).toContain('id="change-counter"');
				expect(html).toContain('class="change-counter"');
			});

			it('should display "No changes" when no changes exist (AC4)', () => {
				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					renderResult
				);

				expect(html).toContain('No changes');
			});

			it('should display "Change 1 of N" when changes exist (AC4)', () => {
				const resultWithChanges: RenderResult = {
					beforeHtml: '<p>Before</p>',
					afterHtml: '<p>After</p>',
					changes: [
						{ id: 'change-1', beforeOffset: 0, afterOffset: 0 },
						{ id: 'change-2', beforeOffset: 10, afterOffset: 10 },
						{ id: 'change-3', beforeOffset: 20, afterOffset: 20 },
					],
				};

				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					resultWithChanges
				);

				expect(html).toContain('Change 1 of 3');
			});

			it('should disable buttons when no changes exist (AC8)', () => {
				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					renderResult
				);

				// Check for disabled attribute on buttons
				expect(html).toMatch(/id="prev-change"[^>]*disabled/);
				expect(html).toMatch(/id="next-change"[^>]*disabled/);
			});

			it('should enable buttons when changes exist (AC9)', () => {
				const resultWithChanges: RenderResult = {
					beforeHtml: '<p>Before</p>',
					afterHtml: '<p>After</p>',
					changes: [{ id: 'change-1', beforeOffset: 0, afterOffset: 0 }],
				};

				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					resultWithChanges
				);

				// Buttons should NOT have disabled attribute when there are changes
				const prevButtonMatch = html.match(/<button id="prev-change"[^>]*>/);
				const nextButtonMatch = html.match(/<button id="next-change"[^>]*>/);
				expect(prevButtonMatch).toBeTruthy();
				expect(nextButtonMatch).toBeTruthy();
				expect(prevButtonMatch![0]).not.toContain('disabled');
				expect(nextButtonMatch![0]).not.toContain('disabled');
			});

			it('should have toolbar in correct DOM order (prev → counter → next) for tab navigation (AC7)', () => {
				const html = ContentBuilder.buildWebviewHtml(
					mockWebview as any,
					mockExtensionUri as any,
					renderResult
				);

				const prevIndex = html.indexOf('id="prev-change"');
				const counterIndex = html.indexOf('id="change-counter"');
				const nextIndex = html.indexOf('id="next-change"');

				expect(prevIndex).toBeLessThan(counterIndex);
				expect(counterIndex).toBeLessThan(nextIndex);
			});
		});
	});
});
