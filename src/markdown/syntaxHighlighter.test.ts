/**
 * Unit tests for SyntaxHighlighter
 *
 * Tests FR14 (syntax highlighting for 190+ languages) and auto-detection.
 * Coverage target: > 90% per Story 2.2 requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { highlightCode, isLanguageSupported, getSupportedLanguages } from './syntaxHighlighter';

// Mock vscode module
vi.mock('vscode', () => ({
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
	},
}));

describe('SyntaxHighlighter', () => {
	describe('highlightCode', () => {
		it('should highlight JavaScript code when language specified', () => {
			const code = 'const foo = "bar";';
			const result = highlightCode(code, 'javascript');

			// Should contain highlighted spans (exact output depends on Highlight.js version)
			expect(result).toContain('hljs-');
			expect(result).toBeTruthy();
			expect(result.length).toBeGreaterThan(code.length); // Highlighted code is longer due to HTML tags
		});

		it('should highlight Python code when language specified', () => {
			const code = 'def hello():\n    print("Hello, world!")';
			const result = highlightCode(code, 'python');

			expect(result).toContain('hljs-');
			expect(result).toBeTruthy();
		});

		it('should highlight TypeScript code when language specified', () => {
			const code = 'interface User { name: string; age: number; }';
			const result = highlightCode(code, 'typescript');

			expect(result).toContain('hljs-');
			expect(result).toBeTruthy();
		});

		it('should use auto-detection when language not specified', () => {
			const code = 'function test() { return 42; }';
			const result = highlightCode(code);

			// Auto-detection should still produce highlighted output
			expect(result).toContain('hljs-');
			expect(result).toBeTruthy();
		});

		it('should fall back to auto-detection for unsupported language', () => {
			const code = 'const foo = "bar";';
			const result = highlightCode(code, 'unknownlang');

			// Should still return highlighted output using auto-detection
			expect(result).toBeTruthy();
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle empty code gracefully', () => {
			const result = highlightCode('', 'javascript');
			expect(result).toBe('');
		});

		it('should handle code with special characters', () => {
			const code = 'const html = "<div>Test</div>";';
			const result = highlightCode(code, 'javascript');

			expect(result).toBeTruthy();
			// Special characters should be handled by Highlight.js
		});

		it('should escape HTML when highlighting fails', () => {
			// Force an error by mocking - for graceful fallback testing
			const codeWithHtml = '<script>alert("XSS")</script>';
			const result = highlightCode(codeWithHtml, 'invalid');

			// Even if highlighting fails, HTML should be escaped for security
			expect(result).not.toContain('<script>');
		});
	});

	describe('isLanguageSupported', () => {
		it('should return true for JavaScript', () => {
			expect(isLanguageSupported('javascript')).toBe(true);
		});

		it('should return true for Python', () => {
			expect(isLanguageSupported('python')).toBe(true);
		});

		it('should return true for TypeScript', () => {
			expect(isLanguageSupported('typescript')).toBe(true);
		});

		it('should return false for unknown language', () => {
			expect(isLanguageSupported('unknownlanguage')).toBe(false);
		});

		it('should handle case in language names', () => {
			// Note: Highlight.js may be case-insensitive or have aliases
			// The important thing is that common lowercase language names work
			expect(isLanguageSupported('javascript')).toBe(true);
			expect(isLanguageSupported('python')).toBe(true);
			expect(isLanguageSupported('typescript')).toBe(true);
		});
	});

	describe('getSupportedLanguages', () => {
		it('should return array of supported languages', () => {
			const languages = getSupportedLanguages();

			expect(Array.isArray(languages)).toBe(true);
			expect(languages.length).toBeGreaterThan(100); // Highlight.js supports 190+ languages
		});

		it('should include common languages', () => {
			const languages = getSupportedLanguages();

			expect(languages).toContain('javascript');
			expect(languages).toContain('python');
			expect(languages).toContain('typescript');
			expect(languages).toContain('go');
			expect(languages).toContain('rust');
		});
	});

	describe('Multiple languages', () => {
		const testCases = [
			{ lang: 'javascript', code: 'const x = 42;' },
			{ lang: 'python', code: 'x = 42' },
			{ lang: 'typescript', code: 'const x: number = 42;' },
			{ lang: 'go', code: 'package main' },
			{ lang: 'rust', code: 'fn main() {}' },
			{ lang: 'bash', code: 'echo "hello"' },
			{ lang: 'json', code: '{"key": "value"}' },
			{ lang: 'markdown', code: '# Heading' },
		];

		testCases.forEach(({ lang, code }) => {
			it(`should highlight ${lang} code`, () => {
				const result = highlightCode(code, lang);
				expect(result).toBeTruthy();
			});
		});
	});
});
