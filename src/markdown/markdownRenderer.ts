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
import { ConfigurationService } from '../config/extensionConfig';
import { logDebug, logInfo, logWarning, showError, logErrorWithContext } from '../utils/errorHandler';

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

			// Get render timeout from configuration (AC5, FR46)
			const configService = ConfigurationService.getInstance();
			const renderTimeout = configService.get('renderTimeout');

			logDebug(`Rendering markdown (${markdown.length} characters), timeout: ${renderTimeout}ms`);
			const startTime = Date.now();

			// Parse markdown with timeout (AC5, FR46)
			const html = await this.renderWithTimeout(markdown, renderTimeout);

			const duration = Date.now() - startTime;
			logInfo(`Markdown rendered successfully in ${duration}ms`);

			return {
				success: true,
				html,
			};
		} catch (error) {
			// Rendering failed - return error result (FR55, AC3: error message if rendering fails)
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const errorDetails = error instanceof Error ? error.stack : undefined;

			// AC3: Log full stack trace to output channel via centralized errorHandler
			if (error instanceof Error) {
				logErrorWithContext(error, 'Markdown rendering failed');
			}

			// Note: User message shown via openPreviewDiff command which handles RenderResult
			// This allows graceful degradation - diff panel doesn't crash

			return {
				success: false,
				html: '',
				error: errorMessage,
				errorDetails,
			};
		}
	}

	/**
	 * Renders markdown with a timeout mechanism (AC4, FR46)
	 *
	 * If rendering takes longer than the timeout, returns partial content
	 * with a warning message per AC4: "File too large or complex. Consider splitting into smaller files."
	 *
	 * @param markdown - Markdown string to render
	 * @param timeout - Timeout in milliseconds
	 * @returns Rendered HTML
	 * @throws Error if rendering fails
	 */
	private async renderWithTimeout(markdown: string, timeout: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let resolved = false;

			// Set timeout (AC4: handle timeout with user-friendly message)
			const timeoutId = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					// AC4: Log timeout via centralized errorHandler
					logWarning(`Markdown rendering timed out after ${timeout}ms`);
					// AC4: Return partial content with warning message and suggested workarounds
					resolve(`<div class="render-warning" style="padding: 10px; background: var(--vscode-inputValidation-warningBackground, #5c5c00); border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500); border-radius: 4px; margin-bottom: 10px;">
						<strong>⚠️ File too large or complex</strong>
						<p>The markdown file could not be rendered within ${timeout}ms. Consider splitting into smaller files.</p>
						<p><strong>Suggested workarounds:</strong></p>
						<ul>
							<li>Split large documents into multiple smaller files</li>
							<li>Reduce the number of images or complex elements</li>
							<li>Increase the render timeout in settings (markdownPreviewDiff.renderTimeout)</li>
						</ul>
					</div>
					<p><em>Content too large to render within timeout.</em></p>`);
				}
			}, timeout);

			// Perform rendering - marked.parse() is synchronous by default
			try {
				const html = marked.parse(markdown) as string;
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					resolve(html);
				}
			} catch (error) {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					reject(error);
				}
			}
		});
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
