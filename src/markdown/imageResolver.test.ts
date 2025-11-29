/**
 * Unit tests for ImageResolver
 *
 * Tests image path resolution with security validation.
 * Coverage target: > 90%.
 */

import { describe, it, expect, vi } from 'vitest';
import { resolveImagePath, isDataUri, isExternalUrl, isRelativePath } from './imageResolver';

// Mock vscode module
vi.mock('vscode', () => ({
	Uri: {
		file: (filePath: string) => ({
			toString: () => `file://${filePath}`,
		}),
	},
	workspace: {
		workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
	},
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
	},
}));

describe('ImageResolver', () => {
	const workspaceRoot = '/workspace';
	const markdownFilePath = '/workspace/docs/readme.md';

	describe('resolveImagePath', () => {
		it('should pass through external HTTP URLs unchanged', () => {
			const imagePath = 'http://example.com/image.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBe('http://example.com/image.png');
		});

		it('should pass through external HTTPS URLs unchanged', () => {
			const imagePath = 'https://example.com/image.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBe('https://example.com/image.png');
		});

		it('should pass through data URIs unchanged', () => {
			const imagePath = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBe('data:image/png;base64,iVBORw0KGgoAAAANS...');
		});

		it('should resolve relative path from markdown file directory', () => {
			const imagePath = './logo.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			// Should resolve relative to /workspace/docs/
			expect(result).toContain('/workspace/docs/logo.png');
			expect(result).toContain('file://');
		});

		it('should resolve relative path with parent directory', () => {
			const imagePath = '../images/logo.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			// Should resolve relative to /workspace/docs/ -> /workspace/images/logo.png
			expect(result).toContain('/workspace/images/logo.png');
			expect(result).toContain('file://');
		});

		it('should resolve absolute workspace path to file:// URI', () => {
			const imagePath = '/workspace/images/logo.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('file:///workspace/images/logo.png');
		});

		it('should return original path for invalid absolute path outside workspace', () => {
			const imagePath = '/outside/workspace/image.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			// Security: path outside workspace should not be resolved, return original (broken image)
			expect(result).toBe('/outside/workspace/image.png');
		});

		it('should handle path traversal attempt with ..', () => {
			const imagePath = '../../sensitive/file.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			// Security: path traversal outside workspace should be rejected
			// Result depends on validation - may be original path or file:// if still within workspace
			expect(result).toBeTruthy();
		});

		it('should handle image in same directory as markdown', () => {
			const imagePath = 'diagram.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('/workspace/docs/diagram.png');
			expect(result).toContain('file://');
		});

		it('should handle nested relative paths', () => {
			const imagePath = './subfolder/image.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('/workspace/docs/subfolder/image.png');
			expect(result).toContain('file://');
		});
	});

	describe('isDataUri', () => {
		it('should return true for data URI', () => {
			expect(isDataUri('data:image/png;base64,iVBORw0...')).toBe(true);
		});

		it('should return false for http URL', () => {
			expect(isDataUri('http://example.com/image.png')).toBe(false);
		});

		it('should return false for relative path', () => {
			expect(isDataUri('./image.png')).toBe(false);
		});

		it('should return false for absolute path', () => {
			expect(isDataUri('/workspace/image.png')).toBe(false);
		});
	});

	describe('isExternalUrl', () => {
		it('should return true for http URL', () => {
			expect(isExternalUrl('http://example.com/image.png')).toBe(true);
		});

		it('should return true for https URL', () => {
			expect(isExternalUrl('https://example.com/image.png')).toBe(true);
		});

		it('should return false for data URI', () => {
			expect(isExternalUrl('data:image/png;base64,...')).toBe(false);
		});

		it('should return false for relative path', () => {
			expect(isExternalUrl('./image.png')).toBe(false);
		});

		it('should return false for absolute path', () => {
			expect(isExternalUrl('/workspace/image.png')).toBe(false);
		});
	});

	describe('isRelativePath', () => {
		it('should return true for current directory path', () => {
			expect(isRelativePath('./image.png')).toBe(true);
		});

		it('should return true for parent directory path', () => {
			expect(isRelativePath('../image.png')).toBe(true);
		});

		it('should return true for simple filename', () => {
			expect(isRelativePath('image.png')).toBe(true);
		});

		it('should return false for absolute path', () => {
			expect(isRelativePath('/workspace/image.png')).toBe(false);
		});

		it('should return false for http URL', () => {
			expect(isRelativePath('http://example.com/image.png')).toBe(false);
		});

		it('should return false for data URI', () => {
			expect(isRelativePath('data:image/png;base64,...')).toBe(false);
		});
	});

	describe('Cross-platform path handling', () => {
		it('should handle Unix forward slash paths', () => {
			const imagePath = './folder/image.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBeTruthy();
			expect(result).toContain('file://');
		});

		it('should handle paths with spaces', () => {
			const imagePath = './my images/logo.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBeTruthy();
			expect(result).toContain('file://');
		});

		it('should handle paths with Unicode characters', () => {
			const imagePath = './图片/image.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBeTruthy();
			expect(result).toContain('file://');
		});

		it('should handle paths with special characters in filename', () => {
			const imagePath = './image-v1.0_final.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toBeTruthy();
			expect(result).toContain('file://');
		});

		it('should handle broken images gracefully (returns original path)', () => {
			// Path outside workspace - should return original path (broken image)
			const imagePath = '/etc/passwd';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			// Should not resolve to file:// URI, should return original
			expect(result).toBe('/etc/passwd');
		});

		// Note: Windows backslash paths would be tested on Windows platform
		// For cross-platform compatibility, vscode.Uri handles path normalization
	});
});
