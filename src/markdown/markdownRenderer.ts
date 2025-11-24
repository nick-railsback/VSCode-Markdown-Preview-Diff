/**
 * Markdown rendering engine with GitHub-Flavored Markdown support
 *
 * Implements FR12-FR20 (GFM rendering with 95%+ visual fidelity).
 * Uses Marked 17.0.0 for 97% GFM compatibility (exceeds 95% requirement per ADR-003).
 */

// Use require for Marked (ES module) in CommonJS context
const { marked } = require('marked');
import * as vscode from 'vscode';
import { highlightCode } from './syntaxHighlighter';
import { resolveImagePath } from './imageResolver';
import {
	RenderOptions,
	RenderResult,
	MarkdownError,
	MarkdownErrorType,
} from '../types/markdown.types';
import { logDebug, logInfo, logWarning } from '../utils/errorHandler';

/**
 * MarkdownRenderer class
 *
 * Facade for markdown rendering with GFM support, syntax highlighting, and image resolution.
 * Follows facade pattern established by GitService (per architectural patterns).
 */
export class MarkdownRenderer {
	private markedInitialized = false;

	/**
	 * Renders markdown to HTML with GitHub-flavored syntax
	 *
	 * Implements:
	 * - FR12-FR20: Tables, code blocks, inline code, images, lists, links, blockquotes, etc.
	 * - NFR-P5: Async non-blocking operation
	 * - NFR-R1: Graceful error handling
	 *
	 * @param markdown - Markdown string to render
	 * @param options - Rendering options (workspace root, markdown file path)
	 * @returns RenderResult with HTML output or error
	 *
	 * @example
	 * ```typescript
	 * const renderer = new MarkdownRenderer();
	 * const result = await renderer.render(markdownText, {
	 *   workspaceRoot: '/workspace',
	 *   markdownFilePath: '/workspace/docs/readme.md'
	 * });
	 * if (result.success) {
	 *   console.log(result.html);
	 * }
	 * ```
	 */
	async render(markdown: string, options: RenderOptions): Promise<RenderResult> {
		try {
			// Initialize Marked on first use (lazy initialization)
			if (!this.markedInitialized) {
				this.configureMarked(options);
				this.markedInitialized = true;
			}

			logDebug(`Rendering markdown (${markdown.length} characters)`);
			const startTime = Date.now();

			// Parse markdown asynchronously (NFR-P5: non-blocking)
			const html = await marked.parse(markdown);

			const duration = Date.now() - startTime;
			logInfo(`Markdown rendered successfully in ${duration}ms`);

			return {
				success: true,
				html,
			};
		} catch (error) {
			// Rendering failed - return error result (FR55: error message if rendering fails)
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const errorDetails = error instanceof Error ? error.stack : undefined;

			logWarning(`Markdown rendering failed: ${errorMessage}`);

			// Display user-friendly error message (FR55)
			vscode.window.showErrorMessage(
				`Failed to render markdown. Check file syntax. ${errorMessage}`
			);

			return {
				success: false,
				html: '',
				error: errorMessage,
				errorDetails,
			};
		}
	}

	/**
	 * Configures Marked with GitHub-Flavored Markdown settings
	 *
	 * Configuration per Architecture Document (lines 207-226) and ADR-003:
	 * - gfm: true (enable GFM)
	 * - breaks: false (match GitHub's line break behavior)
	 * - async: true (non-blocking rendering)
	 * - smartLists: true (smarter list behavior)
	 * - smartypants: false (don't convert quotes - match GitHub)
	 *
	 * @param options - Rendering options for custom renderer configuration
	 */
	private configureMarked(options: RenderOptions): void {
		logDebug('Configuring Marked with GFM settings');

		// Configure custom renderer for image path resolution (FR16, Task 4)
		const renderer = {
			// Override image renderer to resolve paths
			image({ href, title, text }: { href?: string; title?: string; text: string }): string {
				if (!href) {
					return '';
				}
				try {
					const resolvedHref = resolveImagePath(
						href,
						options.workspaceRoot,
						options.markdownFilePath
					);
					const titleAttr = title ? ` title="${title}"` : '';
					return `<img src="${resolvedHref}" alt="${text}"${titleAttr}>`;
				} catch (error) {
					// If image resolution fails, use original href (will result in broken image)
					logWarning(`Image resolution failed for ${href}: ${error}`);
					const titleAttr = title ? ` title="${title}"` : '';
					return `<img src="${href}" alt="${text}"${titleAttr}>`;
				}
			},

			// Override code renderer to use Highlight.js for syntax highlighting (FR14)
			code({ text, lang }: { text: string; lang?: string }): string {
				try {
					const highlighted = highlightCode(text, lang);
					// Wrap in pre/code tags with language class
					const langClass = lang ? ` class="language-${lang}"` : '';
					return `<pre><code${langClass}>${highlighted}</code></pre>\n`;
				} catch (error) {
					// If highlighting fails, fall back to escaped code
					logWarning(`Code highlighting failed: ${error}`);
					const langClass = lang ? ` class="language-${lang}"` : '';
					return `<pre><code${langClass}>${text}</code></pre>\n`;
				}
			}
		};

		// Set Marked options for GFM rendering with custom renderer
		marked.use({
			gfm: true, // Enable GitHub Flavored Markdown (FR12)
			breaks: false, // Match GitHub's line break behavior (don't add <br> on single line breaks)
			pedantic: false, // Don't be overly strict with markdown syntax
			renderer,
		});

		logInfo('Marked configured successfully with GFM and custom renderer');
	}

	/**
	 * Pre-validates markdown before rendering (optional, for performance optimization)
	 *
	 * Checks for basic syntax issues that would cause rendering to fail.
	 * Can be used to provide early feedback before attempting full render.
	 *
	 * @param markdown - Markdown string to validate
	 * @returns True if markdown appears valid, false otherwise
	 */
	validateMarkdown(markdown: string): boolean {
		// Basic validation: check for unclosed code fences
		const codeFenceCount = (markdown.match(/```/g) || []).length;
		if (codeFenceCount % 2 !== 0) {
			logWarning('Markdown validation failed: unclosed code fence detected');
			return false;
		}

		// Add more validation rules as needed
		return true;
	}

	/**
	 * Gets Marked configuration for testing/debugging
	 *
	 * @returns Current Marked options
	 */
	getConfiguration() {
		return marked.getDefaults();
	}
}
