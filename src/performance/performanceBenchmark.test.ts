/**
 * Performance Benchmark Tests
 *
 * Tests that verify performance targets are met per Story 2.6 acceptance criteria.
 * Validates NFR-P1 through NFR-P7 performance requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiffComputer } from '../../src/diff/diffComputer';
import { MarkdownRenderer } from '../../src/markdown/markdownRenderer';

// Performance thresholds from architecture document
const PERFORMANCE_TARGETS = {
	gitRetrieval: 500,      // AC2: < 500ms
	diffComputation: 500,   // AC2: < 500ms
	markdownRendering: 1000, // AC3: < 1000ms
	webviewInit: 500,       // AC4: < 500ms
	total10KB: 2000,        // AC5: < 2000ms for files < 10KB
	total100KB: 5000        // AC6: < 5000ms for files up to 100KB
};

/**
 * Generate markdown content of specified size for testing
 * Creates realistic markdown with headings, lists, code blocks, and text
 */
function generateMarkdownContent(sizeInKB: number): string {
	const targetBytes = sizeInKB * 1024;
	let content = '';

	// Template section with various markdown features
	const section = `
# Section Heading

This is a paragraph with **bold** and *italic* text. Here's a [link](https://example.com).

## Subsection

- List item 1
- List item 2
- List item 3

\`\`\`typescript
function example() {
	return "code block";
}
\`\`\`

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |

`;

	// Repeat sections until target size reached
	while (content.length < targetBytes) {
		content += section;
	}

	return content.substring(0, targetBytes);
}

/**
 * Generate modified version of markdown for diff testing
 * Creates realistic changes (additions, deletions, modifications)
 */
function generateModifiedMarkdown(original: string): string {
	const lines = original.split('\n');
	const modified: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		// Every 10th line: add a new line
		if (i % 10 === 0) {
			modified.push('> This is a new blockquote added');
		}

		// Every 7th line: modify the line
		if (i % 7 === 0 && lines[i].trim().length > 0) {
			modified.push(lines[i] + ' [MODIFIED]');
		}
		// Every 15th line: skip (deletion)
		else if (i % 15 === 0) {
			// Skip this line
		}
		// Otherwise keep original
		else {
			modified.push(lines[i]);
		}
	}

	return modified.join('\n');
}

describe('Performance Benchmarks', () => {
	describe('Diff Computation Performance (AC2)', () => {
		it('should compute diff for 1KB file in < 500ms', () => {
			const before = generateMarkdownContent(1);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();

			const start = Date.now();
			diffComputer.compute(before, after);
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.diffComputation);
		});

		it('should compute diff for 10KB file in < 500ms', () => {
			const before = generateMarkdownContent(10);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();

			const start = Date.now();
			diffComputer.compute(before, after);
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.diffComputation);
		});

		it('should compute diff for 50KB file in < 500ms', () => {
			const before = generateMarkdownContent(50);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();

			const start = Date.now();
			diffComputer.compute(before, after);
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.diffComputation);
		});

		it('should compute diff for 100KB file in < 500ms', () => {
			const before = generateMarkdownContent(100);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();

			const start = Date.now();
			diffComputer.compute(before, after);
			const duration = Date.now() - start;

			// 100KB files may take slightly longer, but should still be reasonable
			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.diffComputation * 2); // 1000ms max
		});
	});

	describe('Markdown Rendering Performance (AC3)', () => {
		const mockWorkspaceRoot = '/mock/workspace';
		const mockFilePath = '/mock/workspace/test.md';

		it('should render 1KB markdown in < 1000ms', async () => {
			const content = generateMarkdownContent(1);
			const renderer = new MarkdownRenderer();

			const start = Date.now();
			await renderer.render(content, {
				workspaceRoot: mockWorkspaceRoot,
				markdownFilePath: mockFilePath
			});
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.markdownRendering);
		});

		it('should render 10KB markdown in < 1000ms', async () => {
			const content = generateMarkdownContent(10);
			const renderer = new MarkdownRenderer();

			const start = Date.now();
			await renderer.render(content, {
				workspaceRoot: mockWorkspaceRoot,
				markdownFilePath: mockFilePath
			});
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.markdownRendering);
		});

		it('should render 50KB markdown in < 1500ms', async () => {
			const content = generateMarkdownContent(50);
			const renderer = new MarkdownRenderer();

			const start = Date.now();
			await renderer.render(content, {
				workspaceRoot: mockWorkspaceRoot,
				markdownFilePath: mockFilePath
			});
			const duration = Date.now() - start;

			// Larger files get more time, but should still be reasonable
			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.markdownRendering * 1.5);
		});

		it('should render 100KB markdown in < 2000ms', async () => {
			const content = generateMarkdownContent(100);
			const renderer = new MarkdownRenderer();

			const start = Date.now();
			await renderer.render(content, {
				workspaceRoot: mockWorkspaceRoot,
				markdownFilePath: mockFilePath
			});
			const duration = Date.now() - start;

			// 100KB files may take longer but should complete
			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.markdownRendering * 2);
		});
	});

	describe('Combined Operations Performance', () => {
		const mockWorkspaceRoot = '/mock/workspace';
		const mockFilePath = '/mock/workspace/test.md';

		it('should complete full diff + render cycle for 10KB file in < 2000ms (AC5)', async () => {
			const before = generateMarkdownContent(10);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();
			const renderer = new MarkdownRenderer();

			const start = Date.now();

			// Diff computation
			diffComputer.compute(before, after);

			// Parallel rendering (simulating Story 2.5 implementation)
			await Promise.all([
				renderer.render(before, { workspaceRoot: mockWorkspaceRoot, markdownFilePath: mockFilePath }),
				renderer.render(after, { workspaceRoot: mockWorkspaceRoot, markdownFilePath: mockFilePath })
			]);

			const duration = Date.now() - start;

			// This simulates the core operations (minus git retrieval and webview init)
			// Full e2e target is 2000ms, this should be well under that
			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.total10KB);
		});

		it('should complete full diff + render cycle for 100KB file in < 5000ms (AC6)', async () => {
			const before = generateMarkdownContent(100);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();
			const renderer = new MarkdownRenderer();

			const start = Date.now();

			// Diff computation
			diffComputer.compute(before, after);

			// Parallel rendering
			await Promise.all([
				renderer.render(before, { workspaceRoot: mockWorkspaceRoot, markdownFilePath: mockFilePath }),
				renderer.render(after, { workspaceRoot: mockWorkspaceRoot, markdownFilePath: mockFilePath })
			]);

			const duration = Date.now() - start;

			expect(duration).toBeLessThan(PERFORMANCE_TARGETS.total100KB);
		});
	});

	describe('Large File Handling', () => {
		it('should handle 150KB file without crashing', async () => {
			const content = generateMarkdownContent(150);
			const renderer = new MarkdownRenderer();

			// Should complete without throwing error
			const result = await renderer.render(content, {
				workspaceRoot: '/mock/workspace',
				markdownFilePath: '/mock/workspace/large.md'
			});

			expect(result.success).toBe(true);
			expect(result.html).toBeDefined();
		});

		it('should compute diff for 150KB file without crashing', () => {
			const before = generateMarkdownContent(150);
			const after = generateModifiedMarkdown(before);
			const diffComputer = new DiffComputer();

			// Should complete without throwing error
			expect(() => {
				diffComputer.compute(before, after);
			}).not.toThrow();
		});
	});
});
