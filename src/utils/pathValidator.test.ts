/**
 * Unit tests for path validation utilities
 *
 * Tests security-critical path validation and cross-platform path handling.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock VS Code API
vi.mock('vscode', () => ({
	workspace: {
		workspaceFolders: [{
			uri: {
				fsPath: '/workspace/root'
			}
		}]
	},
	Uri: {
		file: (path: string) => ({ fsPath: path })
	}
}));

import { validateFilePath, getRelativePath } from './pathValidator';
import { GitError, GitErrorType } from '../types/git.types';
import * as path from 'path';

describe('pathValidator', () => {
	const workspaceRoot = '/workspace/root';

	describe('validateFilePath', () => {
		it('should accept valid absolute path within workspace', () => {
			const validPath = '/workspace/root/docs/README.md';
			const result = validateFilePath(validPath, workspaceRoot);
			expect(result).toBe(path.normalize(validPath));
		});

		it('should reject path with .. (path traversal)', () => {
			const maliciousPath = '/workspace/root/../etc/passwd';
			expect(() => validateFilePath(maliciousPath, workspaceRoot))
				.toThrow(GitError);

			try {
				validateFilePath(maliciousPath, workspaceRoot);
			} catch (error) {
				expect(error).toBeInstanceOf(GitError);
				expect((error as GitError).type).toBe(GitErrorType.InvalidPath);
			}
		});

		it('should reject path outside workspace', () => {
			const outsidePath = '/other/directory/file.md';
			expect(() => validateFilePath(outsidePath, workspaceRoot))
				.toThrow(GitError);

			try {
				validateFilePath(outsidePath, workspaceRoot);
			} catch (error) {
				expect(error).toBeInstanceOf(GitError);
				expect((error as GitError).type).toBe(GitErrorType.InvalidPath);
			}
		});

		it('should normalize relative paths', () => {
			const relativePath = 'docs/README.md';
			const result = validateFilePath(relativePath, workspaceRoot);
			expect(result.startsWith(workspaceRoot)).toBe(true);
		});

		it('should handle paths with multiple slashes', () => {
			const messyPath = '/workspace/root//docs///README.md';
			const result = validateFilePath(messyPath, workspaceRoot);
			expect(result).toBe(path.normalize(messyPath));
		});
	});

	describe('getRelativePath', () => {
		it('should convert absolute path to relative from repo root', () => {
			const absolutePath = '/workspace/root/src/extension.ts';
			const repoRoot = '/workspace/root';
			const result = getRelativePath(absolutePath, repoRoot);
			expect(result).toBe(path.join('src', 'extension.ts'));
		});

		it('should handle file in repo root', () => {
			const absolutePath = '/workspace/root/README.md';
			const repoRoot = '/workspace/root';
			const result = getRelativePath(absolutePath, repoRoot);
			expect(result).toBe('README.md');
		});

		it('should handle nested directories', () => {
			const absolutePath = '/workspace/root/docs/guides/getting-started.md';
			const repoRoot = '/workspace/root';
			const result = getRelativePath(absolutePath, repoRoot);
			expect(result).toBe(path.join('docs', 'guides', 'getting-started.md'));
		});
	});
});
