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

			// Should be called for: github-markdown.css, layout.css, diff.css, main.js (4 calls)
			expect(mockWebview.asWebviewUri).toHaveBeenCalledTimes(4);
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
	});
});
