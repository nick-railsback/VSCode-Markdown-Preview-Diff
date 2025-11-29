/**
 * Integration tests for DiffComputer
 * Tests realistic usage scenarios with typical markdown-like text
 * Note: Full integration with MarkdownRenderer requires VS Code environment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiffComputer } from './diffComputer';

describe('DiffComputer Integration Tests', () => {
	let diffComputer: DiffComputer;

	beforeEach(() => {
		diffComputer = new DiffComputer();
	});

	describe('Realistic Text Diff Scenarios', () => {
		it('should compute diff between two text versions', () => {
			const beforeText = '<h1>Hello World</h1><p>This is a paragraph.</p>';
			const afterText = '<h1>Hello Universe</h1><p>This is a modified paragraph.</p>';

			// Compute diff
			const diffResult = diffComputer.compute(beforeText, afterText);

			// Verify diff detected changes
			expect(diffResult.changeCount).toBeGreaterThan(0);
			expect(diffResult.changes.length).toBeGreaterThan(0);

			// Verify changes array has valid structure
			for (const change of diffResult.changes) {
				expect(change.type).toMatch(/added|removed|unchanged/);
				expect(change.value).toBeDefined();
				expect(change.startIndex).toBeGreaterThanOrEqual(0);
				expect(change.endIndex).toBeGreaterThan(change.startIndex);
			}
		});

		it('should detect no changes when text is identical', () => {
			const text = '<h1>Same Title</h1><p>Same content.</p>';

			// Compute diff on identical text
			const diffResult = diffComputer.compute(text, text);

			// Should have no changes
			expect(diffResult.changeCount).toBe(0);
			expect(diffResult.changes.every((c) => c.type === 'unchanged')).toBe(true);
		});

		it('should handle complex HTML-like text', () => {
			const beforeText = `
<h1>Code Example</h1>
<pre><code class="language-javascript">function hello() {
  console.log('world');
}
</code></pre>
`;

			const afterText = `
<h1>Code Example</h1>
<pre><code class="language-javascript">function hello() {
  console.log('universe');
}
</code></pre>
`;

			// Compute diff
			const diffResult = diffComputer.compute(beforeText, afterText);

			// Should detect changes in code block
			expect(diffResult.changeCount).toBeGreaterThan(0);
		});

		it('should handle table-like HTML', () => {
			const beforeText = `
<table>
<thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
<tbody><tr><td>Value 1</td><td>Value 2</td></tr></tbody>
</table>
`;

			const afterText = `
<table>
<thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
<tbody><tr><td>Modified</td><td>Value 2</td></tr></tbody>
</table>
`;

			// Compute diff
			const diffResult = diffComputer.compute(beforeText, afterText);

			// Should detect changes in table
			expect(diffResult.changeCount).toBeGreaterThan(0);
		});

		it('should handle list-like HTML', () => {
			const beforeText = `
<ul>
<li>Item 1</li>
<li>Item 2</li>
<li>Item 3</li>
</ul>
`;

			const afterText = `
<ul>
<li>Item 1</li>
<li>Modified Item 2</li>
<li>Item 3</li>
</ul>
`;

			// Compute diff
			const diffResult = diffComputer.compute(beforeText, afterText);

			// Should detect changes in list
			expect(diffResult.changeCount).toBeGreaterThan(0);
		});
	});

	describe('Performance with Typical HTML', () => {
		it('should complete diff computation in < 500ms for typical rendered HTML', () => {
			// Simulate typical rendered HTML from markdown
			const typicalHTML = `
<h1>Documentation</h1>
<h2>Section 1</h2>
<p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
<pre><code class="language-typescript">function example() {
  return 'code';
}
</code></pre>
<h2>Section 2</h2>
<ul>
<li>List item 1</li>
<li>List item 2</li>
<li>List item 3</li>
</ul>
<table>
<thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>
<tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody>
</table>
`.repeat(5); // Repeat to simulate larger file

			const modifiedHTML = typicalHTML.replace('Cell 1', 'Modified Cell 1');

			// Measure diff computation time
			const startTime = performance.now();
			const diffResult = diffComputer.compute(typicalHTML, modifiedHTML);
			const endTime = performance.now();

			const duration = endTime - startTime;

			// Verify diff completed
			expect(diffResult.changeCount).toBeGreaterThan(0);

			// Performance target: < 500ms (per NFR-P2)
			expect(duration).toBeLessThan(500);
		});
	});

	describe('Metadata Accuracy', () => {
		it('should provide accurate metadata for multi-line diffs', () => {
			const beforeText = `
<p>First line.</p>
<p>Second line.</p>
<p>Third line.</p>
`;

			const afterText = `
<p>First line.</p>
<p>Modified second line.</p>
<p>Third line.</p>
<p>Fourth line.</p>
`;

			// Compute diff
			const diffResult = diffComputer.compute(beforeText, afterText);

			// Verify metadata structure
			expect(diffResult.changeCount).toBeGreaterThan(0);
			expect(diffResult.changes).toBeDefined();
			expect(Array.isArray(diffResult.changes)).toBe(true);
			expect(typeof diffResult.addedLines).toBe('number');
			expect(typeof diffResult.removedLines).toBe('number');
		});
	});

	describe('Integration Readiness for ', () => {
		it('should produce DiffResult suitable for webview display', () => {
			const beforeHTML = '<h1>Before Version</h1>';
			const afterHTML = '<h1>After Version</h1>';

			// Compute diff
			const diffResult = diffComputer.compute(beforeHTML, afterHTML);

			// Verify DiffResult has all required fields for webview
			expect(diffResult).toHaveProperty('changes');
			expect(diffResult).toHaveProperty('changeCount');
			expect(diffResult).toHaveProperty('addedLines');
			expect(diffResult).toHaveProperty('removedLines');

			// Verify changes have position tracking
			for (const change of diffResult.changes) {
				expect(change).toHaveProperty('type');
				expect(change).toHaveProperty('value');
				expect(change).toHaveProperty('startIndex');
				expect(change).toHaveProperty('endIndex');
			}

			// This DiffResult is ready to be passed to  webview
		});
	});
});
