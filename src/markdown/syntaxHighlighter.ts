/**
 * Syntax highlighting integration for code blocks
 *
 * Wraps Highlight.js to provide syntax highlighting for 190+ languages
 * with auto-detection.
 */

import hljs from 'highlight.js';
import { logDebug, logWarning } from '../utils/errorHandler';

/**
 * Highlights code using Highlight.js
 *
 * Supports 190+ languages with automatic language detection fallback.
 *
 * @param code - Code string to highlight
 * @param language - Language name (e.g., 'javascript', 'python'). If undefined, auto-detection is used.
 * @returns Highlighted HTML string with syntax highlighting classes
 *
 * @example
 * ```typescript
 * const jsCode = 'const foo = "bar";';
 * const highlighted = highlightCode(jsCode, 'javascript');
 * // Returns: '<span class="hljs-keyword">const</span> foo = <span class="hljs-string">"bar"</span>;'
 * ```
 */
export function highlightCode(code: string, language?: string): string {
	try {
		// If language specified and supported, use it
		if (language && hljs.getLanguage(language)) {
			logDebug(`Highlighting code with language: ${language}`);
			return hljs.highlight(code, { language }).value;
		}

		// Language not specified or not supported - use auto-detection
		if (language) {
			logWarning(`Language '${language}' not supported by Highlight.js. Using auto-detection.`);
		}

		logDebug('Using auto-detection for code highlighting');
		const result = hljs.highlightAuto(code);
		if (result.language) {
			logDebug(`Auto-detected language: ${result.language}`);
		}
		return result.value;
	} catch (error) {
		// If highlighting fails completely, return plain text (graceful fallback per NFR-R1)
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logWarning(`Syntax highlighting failed: ${errorMessage}. Falling back to plain text.`);

		// Return code as plain text (escaping HTML to prevent XSS)
		return escapeHtml(code);
	}
}

/**
 * Checks if a language is supported by Highlight.js
 *
 * @param language - Language name to check
 * @returns True if language is supported, false otherwise
 */
export function isLanguageSupported(language: string): boolean {
	return hljs.getLanguage(language) !== undefined;
}

/**
 * Gets list of all supported languages
 *
 * @returns Array of supported language names
 */
export function getSupportedLanguages(): string[] {
	return hljs.listLanguages();
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * Used as fallback when syntax highlighting fails.
 *
 * @param html - HTML string to escape
 * @returns Escaped HTML string
 */
function escapeHtml(html: string): string {
	return html
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Configures Highlight.js options (future use)
 *
 * Currently uses default configuration. In future stories, this can be extended
 * to support theme customization (Epic 5).
 */
export function configureHighlightJs(): void {
	// Future: Configure Highlight.js theme based on user settings
	// For now, using default configuration
	logDebug('Highlight.js configured with default settings');
}
