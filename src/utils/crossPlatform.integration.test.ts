/**
 * Integration tests for cross-platform path handling
 *
 * Tests end-to-end path handling across git, image resolution, and webview components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Mock vscode module with full implementation
const mockReadFile = vi.fn();
const mockWorkspaceFolders = [{
	uri: {
		fsPath: '/workspace/root',
		toString: () => 'file:///workspace/root',
	}
}];

vi.mock('vscode', () => ({
	workspace: {
		get workspaceFolders() {
			return mockWorkspaceFolders;
		},
		fs: {
			get readFile() {
				return mockReadFile;
			}
		},
	},
	Uri: {
		file: (filePath: string) => ({
			fsPath: filePath,
			toString: () => `file://${filePath}`,
			scheme: 'file',
			path: filePath,
		}),
		joinPath: (base: any, ...paths: string[]) => ({
			fsPath: path.join(base.fsPath, ...paths),
			toString: () => `file://${path.join(base.fsPath, ...paths)}`,
		}),
	},
	FileSystemError: class FileSystemError extends Error {},
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

// Mock simple-git
const mockGit = {
	checkIsRepo: vi.fn(),
	revparse: vi.fn(),
	status: vi.fn(),
	show: vi.fn(),
};

vi.mock('simple-git', () => ({
	default: vi.fn(() => mockGit),
}));

import { validateFilePath, getRelativePath } from './pathValidator';
import { resolveImagePath } from '../markdown/imageResolver';
import { normalizePath, toVscodeUri, validateNoTraversal, isWindowsPath } from './platformUtils';
import { GitError } from '../types/git.types';

describe('Cross-Platform Path Handling Integration', () => {
	const workspaceRoot = '/workspace/root';
	const markdownFilePath = '/workspace/root/docs/guide/README.md';

	beforeEach(() => {
		vi.clearAllMocks();
		mockGit.checkIsRepo.mockResolvedValue(true);
		mockGit.revparse.mockResolvedValue('/workspace/root');
		mockReadFile.mockResolvedValue(new TextEncoder().encode('# Test'));
	});

	describe('Unix path scenarios', () => {
		it('should validate Unix absolute paths within workspace', () => {
			const unixPath = '/workspace/root/src/extension.ts';
			const result = validateFilePath(unixPath, workspaceRoot);
			expect(result).toBe(path.normalize(unixPath));
		});

		it('should resolve relative image paths in Unix environment', () => {
			const imagePath = './images/screenshot.png';
			const result = resolveImagePath(imagePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('file://');
			expect(result).toContain('/workspace/root/docs/guide/images/screenshot.png');
		});

		it('should handle deeply nested Unix paths', () => {
			const deepPath = '/workspace/root/src/components/ui/buttons/primary/index.ts';
			const result = validateFilePath(deepPath, workspaceRoot);
			expect(result).toBe(path.normalize(deepPath));
		});

		it('should handle Unix paths with spaces', () => {
			const spacePath = '/workspace/root/my docs/my file.md';
			const result = validateFilePath(spacePath, workspaceRoot);
			expect(result).toContain('my docs');
			expect(result).toContain('my file.md');
		});

		it('should handle macOS-style paths', () => {
			const macPath = '/Users/developer/Library/Application Support/Code/settings.json';
			// This should fail validation since it's outside workspace
			expect(() => validateFilePath(macPath, workspaceRoot)).toThrow(GitError);
		});
	});

	describe('Windows path detection', () => {
		it('should detect Windows drive letter paths', () => {
			expect(isWindowsPath('C:\\Users\\developer\\file.md')).toBe(true);
			expect(isWindowsPath('D:\\Projects\\markdown-diff\\README.md')).toBe(true);
		});

		it('should detect UNC paths', () => {
			expect(isWindowsPath('\\\\server\\share\\docs\\file.md')).toBe(true);
		});

		it('should not misidentify Unix paths as Windows', () => {
			expect(isWindowsPath('/home/developer/file.md')).toBe(false);
			expect(isWindowsPath('/Users/developer/Documents/file.md')).toBe(false);
		});

		it('should normalize Windows backslash paths', () => {
			const windowsPath = 'C:\\Users\\developer\\docs\\file.md';
			const normalized = normalizePath(windowsPath);
			expect(normalized).toBeTruthy();
		});
	});

	describe('Relative path resolution', () => {
		it('should resolve ./ relative paths from markdown directory', () => {
			const relativePath = './diagram.png';
			const result = resolveImagePath(relativePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('file://');
			expect(result).toContain('/workspace/root/docs/guide/diagram.png');
		});

		it('should resolve ../ relative paths to parent directory', () => {
			const relativePath = '../images/logo.png';
			const result = resolveImagePath(relativePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('file://');
			expect(result).toContain('/workspace/root/docs/images/logo.png');
		});

		it('should resolve ../../ relative paths to grandparent', () => {
			const relativePath = '../../assets/icon.png';
			const result = resolveImagePath(relativePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('file://');
			expect(result).toContain('/workspace/root/assets/icon.png');
		});

		it('should handle relative paths without prefix', () => {
			const relativePath = 'images/logo.png';
			const result = resolveImagePath(relativePath, workspaceRoot, markdownFilePath);

			expect(result).toContain('file://');
		});

		it('should reject path traversal outside workspace', () => {
			const maliciousPath = '../../../etc/passwd';
			// This should be caught by validation
			expect(() => validateNoTraversal(maliciousPath)).toThrow(GitError);
		});
	});

	describe('Path conversion for git operations', () => {
		it('should convert absolute path to relative for git', () => {
			const absolutePath = '/workspace/root/src/extension.ts';
			const relativePath = getRelativePath(absolutePath, workspaceRoot);
			expect(relativePath).toBe(path.join('src', 'extension.ts'));
		});

		it('should handle paths at root level', () => {
			const absolutePath = '/workspace/root/README.md';
			const relativePath = getRelativePath(absolutePath, workspaceRoot);
			expect(relativePath).toBe('README.md');
		});

		it('should preserve path components with special characters', () => {
			const absolutePath = '/workspace/root/docs/file-v1.0.md';
			const relativePath = getRelativePath(absolutePath, workspaceRoot);
			expect(relativePath).toBe(path.join('docs', 'file-v1.0.md'));
		});
	});

	describe('URI conversion', () => {
		it('should convert Unix path to vscode.Uri', () => {
			const uri = toVscodeUri('/workspace/root/file.md');
			expect(uri.fsPath).toBe('/workspace/root/file.md');
		});

		it('should convert Windows path to vscode.Uri', () => {
			const uri = toVscodeUri('C:\\Users\\developer\\file.md');
			expect(uri.fsPath).toBe('C:\\Users\\developer\\file.md');
		});

		it('should handle paths with Unicode', () => {
			const uri = toVscodeUri('/workspace/root/文档/readme.md');
			expect(uri.fsPath).toContain('文档');
		});

		it('should handle paths with spaces', () => {
			const uri = toVscodeUri('/workspace/root/my docs/file.md');
			expect(uri.fsPath).toContain('my docs');
		});
	});

	describe('External URL handling', () => {
		it('should pass through HTTP URLs unchanged', () => {
			const httpUrl = 'http://example.com/image.png';
			const result = resolveImagePath(httpUrl, workspaceRoot, markdownFilePath);
			expect(result).toBe(httpUrl);
		});

		it('should pass through HTTPS URLs unchanged', () => {
			const httpsUrl = 'https://example.com/image.png';
			const result = resolveImagePath(httpsUrl, workspaceRoot, markdownFilePath);
			expect(result).toBe(httpsUrl);
		});

		it('should pass through data URIs unchanged', () => {
			const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
			const result = resolveImagePath(dataUri, workspaceRoot, markdownFilePath);
			expect(result).toBe(dataUri);
		});
	});

	describe('Edge cases', () => {
		it('should handle paths with multiple consecutive separators', () => {
			const messyPath = '/workspace/root//docs///file.md';
			const result = validateFilePath(messyPath, workspaceRoot);
			expect(result).not.toContain('//');
		});

		it('should handle paths with . segments', () => {
			const dotPath = '/workspace/root/./docs/./file.md';
			const result = validateFilePath(dotPath, workspaceRoot);
			expect(result).not.toContain('/./');
		});

		it('should handle hidden files (dot prefix)', () => {
			const hiddenPath = '/workspace/root/.gitignore';
			const result = validateFilePath(hiddenPath, workspaceRoot);
			expect(result).toContain('.gitignore');
		});

		it('should handle filenames with multiple extensions', () => {
			const multiExtPath = '/workspace/root/file.test.ts';
			const result = validateFilePath(multiExtPath, workspaceRoot);
			expect(result).toContain('file.test.ts');
		});
	});
});
