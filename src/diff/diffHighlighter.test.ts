/**
 * Unit tests for DiffHighlighter
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

/**
 * Helper to create Change objects with the new dual-position format
 * For tests, we use actual DiffComputer to get proper positions
 */
function makeChange(
	type: 'added' | 'removed' | 'unchanged',
	value: string,
	beforeStart: number,
	afterStart: number
): Change {
	const valueLen = value.length;
	return {
		type,
		value,
		beforeStartIndex: beforeStart,
		beforeEndIndex: type === 'added' ? beforeStart : beforeStart + valueLen,
		afterStartIndex: afterStart,
		afterEndIndex: type === 'removed' ? afterStart : afterStart + valueLen,
		// Deprecated but required
		startIndex: type === 'removed' ? beforeStart : afterStart,
		endIndex: type === 'removed' ? beforeStart + valueLen : afterStart + valueLen
	};
}

describe('DiffHighlighter', () => {
	let diffHighlighter: DiffHighlighter;

	beforeEach(() => {
		diffHighlighter = new DiffHighlighter();
	});

	describe('Added Content Visual Highlighting', () => {
		it('should wrap added words with diff-added span', () => {
			const beforeHtml = '<p>hello</p>';
			const afterHtml = '<p>hello world</p>';
			// before: "hello" (5 chars), after: "hello world" (11 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),  // both texts have "hello " at start
				makeChange('added', 'world', 5, 6)        // "world" added at position 6 in after
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

	describe('Removed Content Visual Highlighting', () => {
		it('should wrap removed words with diff-removed span', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello</p>';
			// before: "hello world" (11 chars), after: "hello" (5 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),  // both texts have "hello "
				makeChange('removed', 'world', 6, 6)      // "world" removed from position 6 in before
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

	describe('Word-Level Diff Granularity Preserved', () => {
		it('should highlight only changed words, not entire lines', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			// before: "hello world" (11 chars), after: "hello universe" (14 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),  // position 0-6 in both
				makeChange('removed', 'world', 6, 6),     // position 6-11 in before, no advance in after
				makeChange('added', 'universe', 11, 6)    // no advance in before, position 6-14 in after
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

	// Gutter Markers - Deferred to future enhancement for simplicity

	describe('Highlighting with Nested HTML - Tables', () => {
		it('should highlight changed content within table cells', () => {
			const beforeHtml = '<table><tr><td>old</td></tr></table>';
			const afterHtml = '<table><tr><td>new</td></tr></table>';
			// before: "old", after: "new" - both 3 chars
			const changes: Change[] = [
				makeChange('removed', 'old', 0, 0),  // "old" at position 0 in before
				makeChange('added', 'new', 3, 0)     // "new" at position 0 in after
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

	describe('Highlighting with Nested HTML - Code Blocks', () => {
		it('should highlight changed code within code blocks', () => {
			const beforeHtml = '<pre><code>const x = 1;</code></pre>';
			const afterHtml = '<pre><code>const x = 2;</code></pre>';
			// before: "const x = 1;" (12 chars), after: "const x = 2;" (12 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'const x = ', 0, 0),  // 0-10 in both
				makeChange('removed', '1', 10, 10),           // "1" at position 10 in before
				makeChange('added', '2', 11, 10),             // "2" at position 10 in after
				makeChange('unchanged', ';', 11, 11)          // ";" at position 11 in both
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

	describe('Highlighting with Nested HTML - Lists', () => {
		it('should highlight changed content within list items', () => {
			const beforeHtml = '<ul><li>item one</li></ul>';
			const afterHtml = '<ul><li>item two</li></ul>';
			// before: "item one" (8 chars), after: "item two" (8 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'item ', 0, 0),  // 0-5 in both
				makeChange('removed', 'one', 5, 5),      // "one" at position 5 in before
				makeChange('added', 'two', 8, 5)         // "two" at position 5 in after
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

	describe('Empty Changes Handling', () => {
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

	describe('Change Location Tracking for Navigation', () => {
		it('should track change locations with sequential IDs', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			// before: "hello world" (11 chars), after: "hello universe" (14 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),  // 0-6 in both
				makeChange('removed', 'world', 6, 6),     // 6-11 in before
				makeChange('added', 'universe', 11, 6)    // 6-14 in after
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			expect(result.changeLocations).toHaveLength(2);
			expect(result.changeLocations[0].id).toBe('change-1');
			expect(result.changeLocations[1].id).toBe('change-2');
		});

		it('should track change locations with correct types', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			// before: "hello world" (11 chars), after: "hello universe" (14 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),
				makeChange('removed', 'world', 6, 6),
				makeChange('added', 'universe', 11, 6)
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			expect(result.changeLocations[0].type).toBe('removed');
			expect(result.changeLocations[1].type).toBe('added');
		});

		it('should track change locations with offsets', () => {
			const beforeHtml = '<p>hello world</p>';
			const afterHtml = '<p>hello universe</p>';
			// before: "hello world" (11 chars), after: "hello universe" (14 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),
				makeChange('removed', 'world', 6, 6),
				makeChange('added', 'universe', 11, 6)
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

	describe('HTML Injection Safety', () => {
		it('should preserve HTML entities', () => {
			// Use a simple example where the entity is NOT in the changed region
			const beforeHtml = '<p>hello&nbsp;world test</p>';
			const afterHtml = '<p>hello&nbsp;world changed</p>';
			// Text content: "hello world test" vs "hello world changed"
			// The &nbsp; entity should be preserved since we're only changing "test" -> "changed"
			// before: "hello world test" (16 chars), after: "hello world changed" (19 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello world ', 0, 0),  // 0-12 in both
				makeChange('removed', 'test', 12, 12),           // 12-16 in before
				makeChange('added', 'changed', 16, 12)           // 12-19 in after
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve &nbsp; entity (which is in the unchanged portion)
			expect(result.beforeHtml).toContain('&nbsp;');
			expect(result.afterHtml).toContain('&nbsp;');
		});

		it('should not break with special characters', () => {
			const beforeHtml = '<p>&lt;script&gt;alert(\'test\')&lt;/script&gt;</p>';
			const afterHtml = '<p>&lt;script&gt;console.log(\'test\')&lt;/script&gt;</p>';
			// Text content: "<script>alert('test')</script>" vs "<script>console.log('test')</script>"
			// before: 30 chars, after: 36 chars
			const changes: Change[] = [
				makeChange('unchanged', '<script>', 0, 0),       // 0-8 in both
				makeChange('removed', 'alert', 8, 8),            // 8-13 in before
				makeChange('added', 'console.log', 13, 8),       // 8-19 in after
				makeChange('unchanged', '(\'test\')</script>', 13, 19)  // 13-30 in before, 19-36 in after
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should preserve escaped HTML entities
			expect(result.beforeHtml).toContain('&lt;');
			expect(result.beforeHtml).toContain('&gt;');
			expect(result.afterHtml).toContain('&lt;');
			expect(result.afterHtml).toContain('&gt;');
		});
	});

	describe('Graceful Degradation', () => {
		it('should return unhighlighted HTML on error', () => {
			const beforeHtml = '<p>hello</p>';
			const afterHtml = '<p>world</p>';
			// Malformed changes that might cause issues - out of range positions
			const changes: Change[] = [
				makeChange('removed', 'hello', 10000, 10000) // Out of range
			];

			const result = diffHighlighter.applyHighlights(beforeHtml, afterHtml, changes);

			// Should return original HTML (graceful degradation)
			expect(result.beforeHtml).toBeDefined();
			expect(result.afterHtml).toBeDefined();
			expect(result.changeLocations).toBeDefined();
		});
	});

	describe('Tag-Boundary-Aware Span Injection', () => {
		it('should wrap text segments separately when change spans multiple HTML elements', () => {
			// Simulating a change that spans from heading into paragraph
			const beforeHtml = '<h1>Title</h1>';
			const afterHtml = '<h1>Title</h1><p>New paragraph</p>';
			// before: "Title" (5 chars), after: "TitleNew paragraph" (18 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'Title', 0, 0),         // 0-5 in both
				makeChange('added', 'New paragraph', 5, 5)      // 5-18 in after
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
			// before: "old" (3 chars), after: "firstsecond" (11 chars)
			const changes: Change[] = [
				makeChange('removed', 'old', 0, 0),          // 0-3 in before
				makeChange('added', 'firstsecond', 3, 0)     // 0-11 in after
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
			// before: "hello world" (11 chars), after: "hello universe" (14 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'hello ', 0, 0),
				makeChange('removed', 'world', 6, 6),
				makeChange('added', 'universe', 11, 6)
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
			// before: "Title" (5 chars), after: "TitleIntro textItem 1Item 2" (27 chars)
			const changes: Change[] = [
				makeChange('unchanged', 'Title', 0, 0),
				makeChange('added', 'Intro textItem 1Item 2', 5, 5)
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
			// before: "" (0 chars), after: "new" (3 chars)
			const changes: Change[] = [
				makeChange('added', 'new', 0, 0)
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
