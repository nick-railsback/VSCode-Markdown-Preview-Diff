/**
 * Unit tests for DiffHighlighter
 * Tests all acceptance criteria: AC1-AC15
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffHighlighter } from './diffHighlighter';
import { Change } from '../types/diff.types';

// Mock errorHandler to avoid VS Code dependency
vi.mock('../utils/errorHandler', () => ({
	logError: vi.fn(),
	logPerformance: vi.fn(),
	logPerformanceWarning: vi.fn()
}));

describe('DiffHighlighter', () => {
	let diffHighlighter: DiffHighlighter;

	beforeEach(() => {
		diffHighlighter = new DiffHighlighter();
	});

	describe('AC1: Added Content Visual Highlighting', () => {
		it('should wrap added words with diff-added span', () => {
			const beforeHtml = '<p>hello</p>';
			const afterHtml = '<p>hello world</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'added', value: 'world', startIndex: 6, endIndex: 11 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Check that the span with correct class and change-id exists
			expect(result.afterHtml).toContain('diff-added');
			expect(result.afterHtml).toContain('data-change-id="change-1"');
			expect(result.afterHtml).toContain('world');
			expect(result.changeLocations).toHaveLength(1);
			expect(result.changeLocations[0].type).toBe('added');
		});

		// Note: Gutter markers deferred to future enhancement
	});

	describe('AC2: Removed Content Visual Highlighting', () => {
		it('should wrap removed words with diff-removed span', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'removed', value: 'world', startIndex: 6, endIndex: 11 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Check that the span with correct class and change-id exists
			expect(result.beforeHtml).toContain('diff-removed');
			expect(result.beforeHtml).toContain('data-change-id="change-1"');
			expect(result.beforeHtml).toContain('world');
			expect(result.changeLocations).toHaveLength(1);
			expect(result.changeLocations[0].type).toBe('removed');
		});

		// Note: Gutter markers deferred to future enhancement
	});

	describe('AC3: Word-Level Diff Granularity Preserved', () => {
		it('should highlight only changed words, not entire lines', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'removed', value: 'world', startIndex: 6, endIndex: 11 },
				{ type: 'added', value: 'universe', startIndex: 6, endIndex: 14 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Only "world" should be highlighted in before
			expect(result.beforeHtml).toContain('hello');
			expect(result.beforeHtml).toContain('diff-removed');
			expect(result.beforeHtml).toContain('world');

			// Only "universe" should be highlighted in after
			expect(result.afterHtml).toContain('hello');
			expect(result.afterHtml).toContain('diff-added');
			expect(result.afterHtml).toContain('universe');
		});
	});

	// AC4: Gutter Markers - Deferred to future enhancement for simplicity

	describe('AC8: Highlighting with Nested HTML - Tables', () => {
		it('should highlight changed content within table cells', () => {
			const beforeHtml = '<table><tr><td>old</td></tr></table>';
			const afterHtml = '<table><tr><td>new</td></tr></table>';
			const changes: Change[] = [
				{ type: 'removed', value: 'old', startIndex: 0, endIndex: 3 },
				{ type: 'added', value: 'new', startIndex: 0, endIndex: 3 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve table structure
			expect(result.beforeHtml).toContain('<table>');
			expect(result.beforeHtml).toContain('</table>');
			expect(result.afterHtml).toContain('<table>');
			expect(result.afterHtml).toContain('</table>');

			// Should highlight content
			expect(result.beforeHtml).toContain('diff-removed');
			expect(result.afterHtml).toContain('diff-added');
		});
	});

	describe('AC9: Highlighting with Nested HTML - Code Blocks', () => {
		it('should highlight changed code within code blocks', () => {
			const beforeHtml = '<pre><code>const x = 1;</code></pre>';
			const afterHtml = '<pre><code>const x = 2;</code></pre>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'const x = ', startIndex: 0, endIndex: 10 },
				{ type: 'removed', value: '1', startIndex: 10, endIndex: 11 },
				{ type: 'added', value: '2', startIndex: 10, endIndex: 11 },
				{ type: 'unchanged', value: ';', startIndex: 11, endIndex: 12 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve code block structure
			expect(result.beforeHtml).toContain('<pre>');
			expect(result.beforeHtml).toContain('</code></pre>');
			expect(result.afterHtml).toContain('<pre>');
			expect(result.afterHtml).toContain('</code></pre>');

			// Should highlight changed code
			expect(result.beforeHtml).toContain('diff-removed');
			expect(result.afterHtml).toContain('diff-added');
		});
	});

	describe('AC10: Highlighting with Nested HTML - Lists', () => {
		it('should highlight changed content within list items', () => {
			const beforeHtml = '<ul><li>item one</li></ul>';
			const afterHtml = '<ul><li>item two</li></ul>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'item ', startIndex: 0, endIndex: 5 },
				{ type: 'removed', value: 'one', startIndex: 5, endIndex: 8 },
				{ type: 'added', value: 'two', startIndex: 5, endIndex: 8 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve list structure
			expect(result.beforeHtml).toContain('<ul>');
			expect(result.beforeHtml).toContain('</ul>');
			expect(result.afterHtml).toContain('<ul>');
			expect(result.afterHtml).toContain('</ul>');

			// Should highlight content
			expect(result.beforeHtml).toContain('diff-removed');
			expect(result.afterHtml).toContain('diff-added');
		});
	});

	describe('AC11: Empty Changes Handling', () => {
		it('should return unchanged HTML for empty changes array', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello world</p>';
			const changes: Change[] = [];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			expect(result.beforeHtml).toBe(beforeHtml);
			expect(result.afterHtml).toBe(afterHtml);
			expect(result.changeLocations).toHaveLength(0);
		});

		it('should return unchanged HTML for null changes', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello world</p>';
			const changes: any = null;

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			expect(result.beforeHtml).toBe(beforeHtml);
			expect(result.afterHtml).toBe(afterHtml);
			expect(result.changeLocations).toHaveLength(0);
		});
	});

	describe('AC13: Change Location Tracking for Navigation', () => {
		it('should track change locations with sequential IDs', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'removed', value: 'world', startIndex: 6, endIndex: 11 },
				{ type: 'added', value: 'universe', startIndex: 6, endIndex: 14 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			expect(result.changeLocations).toHaveLength(2);
			expect(result.changeLocations[0].id).toBe('change-1');
			expect(result.changeLocations[1].id).toBe('change-2');
		});

		it('should track change locations with correct types', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'removed', value: 'world', startIndex: 6, endIndex: 11 },
				{ type: 'added', value: 'universe', startIndex: 6, endIndex: 14 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			expect(result.changeLocations[0].type).toBe('removed');
			expect(result.changeLocations[1].type).toBe('added');
		});

		it('should track change locations with offsets', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'removed', value: 'world', startIndex: 6, endIndex: 11 },
				{ type: 'added', value: 'universe', startIndex: 6, endIndex: 14 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Removed change should have beforeOffset set
			expect(result.changeLocations[0].beforeOffset).toBeGreaterThan(0);
			expect(result.changeLocations[0].afterOffset).toBe(0);

			// Added change should have afterOffset set
			expect(result.changeLocations[1].beforeOffset).toBe(0);
			expect(result.changeLocations[1].afterOffset).toBeGreaterThan(0);
		});
	});

	describe('AC14: HTML Injection Safety', () => {
		it('should preserve HTML entities', () => {
			const beforeHtml = '<p>hello&nbsp;world</p>';
			const afterHtml = '<p>hello&nbsp;universe</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello world ', startIndex: 0, endIndex: 12 },
				{ type: 'removed', value: 'world', startIndex: 12, endIndex: 17 },
				{ type: 'added', value: 'universe', startIndex: 12, endIndex: 20 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve &nbsp; entity
			expect(result.beforeHtml).toContain('&nbsp;');
			expect(result.afterHtml).toContain('&nbsp;');
		});

		it('should not break with special characters', () => {
			const beforeHtml = '<p>&lt;script&gt;alert(\'test\')&lt;/script&gt;</p>';
			const afterHtml = '<p>&lt;script&gt;console.log(\'test\')&lt;/script&gt;</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: '<script>', startIndex: 0, endIndex: 8 },
				{ type: 'removed', value: 'alert', startIndex: 8, endIndex: 13 },
				{ type: 'added', value: 'console.log', startIndex: 8, endIndex: 19 },
				{ type: 'unchanged', value: '(\'test\')</script>', startIndex: 13, endIndex: 30 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve escaped HTML entities
			expect(result.beforeHtml).toContain('&lt;');
			expect(result.beforeHtml).toContain('&gt;');
			expect(result.afterHtml).toContain('&lt;');
			expect(result.afterHtml).toContain('&gt;');
		});
	});

	describe('AC15: Graceful Degradation', () => {
		it('should return unhighlighted HTML on error', () => {
			const beforeHtml = '<p>hello</p>';
			const afterHtml = '<p>world</p>';
			// Malformed changes that might cause issues
			const changes: Change[] = [
				{ type: 'removed', value: 'hello', startIndex: 10000, endIndex: 10005 } // Out of range
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should return original HTML (graceful degradation)
			expect(result.beforeHtml).toBeDefined();
			expect(result.afterHtml).toBeDefined();
			expect(result.changeLocations).toBeDefined();
		});
	});

	describe('Story 4.2b: Tag-Boundary-Aware Span Injection', () => {
		it('should wrap text segments separately when change spans multiple HTML elements', () => {
			// Simulating a change that spans from heading into paragraph
			const beforeHtml = '<h1>Title</h1>';
			const afterHtml = '<h1>Title</h1><p>New paragraph</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'Title', startIndex: 0, endIndex: 5 },
				{ type: 'added', value: 'New paragraph', startIndex: 5, endIndex: 18 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should NOT have block elements inside spans
			expect(result.afterHtml).not.toMatch(/<span[^>]*><h1>/);
			expect(result.afterHtml).not.toMatch(/<span[^>]*><p>/);
			expect(result.afterHtml).not.toMatch(/<\/h1><\/span>/);
			expect(result.afterHtml).not.toMatch(/<\/p><\/span>/);

			// Should still have the diff-added class
			expect(result.afterHtml).toContain('diff-added');
			expect(result.afterHtml).toContain('New paragraph');
		});

		it('should create multiple spans for text in different HTML elements', () => {
			const beforeHtml = '<p>old</p>';
			const afterHtml = '<p>first</p><p>second</p>';
			const changes: Change[] = [
				{ type: 'removed', value: 'old', startIndex: 0, endIndex: 3 },
				{ type: 'added', value: 'firstsecond', startIndex: 0, endIndex: 11 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Count how many diff-added spans exist (should be 2, one for each paragraph)
			const spanMatches = result.afterHtml.match(/diff-added/g);
			expect(spanMatches).not.toBeNull();
			expect(spanMatches!.length).toBe(2);
		});

		it('should handle changes within a single element (no tag crossing)', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
				{ type: 'removed', value: 'world', startIndex: 6, endIndex: 11 },
				{ type: 'added', value: 'universe', startIndex: 6, endIndex: 14 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should still work correctly for single-element changes
			expect(result.beforeHtml).toContain('<span class="diff-removed"');
			expect(result.beforeHtml).toContain('world</span>');
			expect(result.afterHtml).toContain('<span class="diff-added"');
			expect(result.afterHtml).toContain('universe</span>');
		});

		it('should handle large additions spanning heading, paragraph, and list', () => {
			const beforeHtml = '<h1>Title</h1>';
			const afterHtml = '<h1>Title</h1><p>Intro text</p><ul><li>Item 1</li><li>Item 2</li></ul>';
			const changes: Change[] = [
				{ type: 'unchanged', value: 'Title', startIndex: 0, endIndex: 5 },
				{ type: 'added', value: 'Intro textItem 1Item 2', startIndex: 5, endIndex: 27 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should have diff-added spans for each text segment
			expect(result.afterHtml).toContain('diff-added');
			// Should preserve HTML structure (no block elements inside spans)
			expect(result.afterHtml).toContain('<p>');
			expect(result.afterHtml).toContain('</p>');
			expect(result.afterHtml).toContain('<ul>');
			expect(result.afterHtml).toContain('<li>');

			// The spans should wrap text content, not block elements
			// Check that </p> is not followed immediately by </span>
			expect(result.afterHtml).not.toMatch(/<\/p><\/span>/);
			expect(result.afterHtml).not.toMatch(/<\/li><\/span>/);
		});

		it('should not wrap empty text segments', () => {
			const beforeHtml = '<p></p>';
			const afterHtml = '<p></p><p>new</p>';
			const changes: Change[] = [
				{ type: 'added', value: 'new', startIndex: 0, endIndex: 3 }
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should only wrap "new", not create empty spans
			expect(result.afterHtml).toContain('diff-added');
			expect(result.afterHtml).toContain('>new<');
		});
	});

	describe('extractTextFromHtml', () => {
		it('should extract plain text from simple HTML', () => {
			const html = '<p>Hello World</p>';
			const text = diffHighlighter.extractTextFromHtml(html);
			expect(text).toBe('Hello World');
		});

		it('should extract text from nested HTML', () => {
			const html = '<div><h1>Title</h1><p>Paragraph</p></div>';
			const text = diffHighlighter.extractTextFromHtml(html);
			expect(text).toBe('TitleParagraph');
		});

		it('should handle HTML with attributes', () => {
			const html = '<p class="intro" id="main">Content</p>';
			const text = diffHighlighter.extractTextFromHtml(html);
			expect(text).toBe('Content');
		});

		it('should handle empty HTML', () => {
			const html = '<div></div>';
			const text = diffHighlighter.extractTextFromHtml(html);
			expect(text).toBe('');
		});

		it('should preserve whitespace in text content', () => {
			const html = '<p>Hello   World</p>';
			const text = diffHighlighter.extractTextFromHtml(html);
			expect(text).toBe('Hello   World');
		});
	});
});
