/**
 * Unit tests for platformUtils
 *
 * Tests cross-platform path handling and OS detection utilities.
 * Implements FR48-FR52 requirements for cross-platform compatibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original platform
const originalPlatform = process.platform;

// Mock vscode module
vi.mock('vscode', () => ({
	Uri: {
		file: (filePath: string) => ({
			fsPath: filePath,
			toString: () => `file://${filePath}`,
			scheme: 'file',
			path: filePath,
		}),
	},
}));

import {
	getPlatformInfo,
	normalizePath,
	validateNoTraversal,
	toVscodeUri,
	isWindowsPath,
	toForwardSlashes,
	toBackslashes,
} from './platformUtils';
import { GitError, GitErrorType } from '../types/git.types';

describe('platformUtils', () => {
	afterEach(() => {
		// Restore original platform
		Object.defineProperty(process, 'platform', {
			value: originalPlatform,
		});
	});

	describe('getPlatformInfo', () => {
		it('should return darwin info for macOS', () => {
			Object.defineProperty(process, 'platform', { value: 'darwin' });

			const info = getPlatformInfo();

			expect(info.os).toBe('darwin');
			expect(info.pathSeparator).toBe('/');
			expect(info.modifierKey).toBe('Cmd');
		});

		it('should return win32 info for Windows', () => {
			Object.defineProperty(process, 'platform', { value: 'win32' });

			const info = getPlatformInfo();

			expect(info.os).toBe('win32');
			expect(info.pathSeparator).toBe('\\');
			expect(info.modifierKey).toBe('Ctrl');
		});

		it('should return linux info for Linux', () => {
			Object.defineProperty(process, 'platform', { value: 'linux' });

			const info = getPlatformInfo();

			expect(info.os).toBe('linux');
			expect(info.pathSeparator).toBe('/');
			expect(info.modifierKey).toBe('Ctrl');
		});

		it('should default to linux for unknown platforms', () => {
			Object.defineProperty(process, 'platform', { value: 'freebsd' });

			const info = getPlatformInfo();

			expect(info.os).toBe('linux');
			expect(info.modifierKey).toBe('Ctrl');
		});
	});

	describe('normalizePath', () => {
		it('should normalize Unix forward-slash paths', () => {
			const result = normalizePath('/home/nick/docs/file.md');
			expect(result).toBeTruthy();
			expect(result).not.toContain('//');
		});

		it('should handle paths with redundant separators', () => {
			const result = normalizePath('/home/nick//docs///file.md');
			expect(result).not.toContain('//');
		});

		it('should handle paths with . segments', () => {
			const result = normalizePath('/home/nick/./docs/./file.md');
			expect(result).not.toContain('/./');
		});

		it('should throw error for empty path', () => {
			expect(() => normalizePath('')).toThrow(GitError);
			expect(() => normalizePath('   ')).toThrow(GitError);
		});

		it('should preserve path with spaces', () => {
			const result = normalizePath('/home/john smith/my docs/file.md');
			expect(result).toContain('john smith');
			expect(result).toContain('my docs');
		});

		it('should preserve Unicode characters', () => {
			const result = normalizePath('/home/nick/文档/readme.md');
			expect(result).toContain('文档');
		});

		it('should handle Windows backslash paths', () => {
			const result = normalizePath('C:\\Users\\nick\\docs\\file.md');
			expect(result).toBeTruthy();
		});

		it('should handle deeply nested paths', () => {
			const result = normalizePath('/a/b/c/d/e/f/g/h/file.md');
			expect(result).toBeTruthy();
		});
	});

	describe('validateNoTraversal', () => {
		it('should return true for safe path', () => {
			expect(validateNoTraversal('/home/nick/docs/file.md')).toBe(true);
		});

		it('should throw error for path with ..', () => {
			expect(() => validateNoTraversal('/home/nick/../etc/passwd')).toThrow(GitError);

			try {
				validateNoTraversal('/home/nick/../etc/passwd');
			} catch (error) {
				expect(error).toBeInstanceOf(GitError);
				expect((error as GitError).type).toBe(GitErrorType.InvalidPath);
			}
		});

		it('should throw error for path starting with ..', () => {
			expect(() => validateNoTraversal('../etc/passwd')).toThrow(GitError);
		});

		it('should throw error for path with multiple ..', () => {
			expect(() => validateNoTraversal('/home/../../etc/passwd')).toThrow(GitError);
		});

		it('should allow paths with dots in filenames', () => {
			expect(validateNoTraversal('/home/nick/file.v1.0.md')).toBe(true);
		});

		it('should allow hidden files (single dot prefix)', () => {
			expect(validateNoTraversal('/home/nick/.gitignore')).toBe(true);
		});
	});

	describe('toVscodeUri', () => {
		it('should convert Unix path to URI', () => {
			const uri = toVscodeUri('/home/nick/docs/file.md');
			expect(uri).toBeTruthy();
			expect(uri.fsPath).toBe('/home/nick/docs/file.md');
		});

		it('should convert Windows path to URI', () => {
			const uri = toVscodeUri('C:\\Users\\nick\\docs\\file.md');
			expect(uri).toBeTruthy();
			expect(uri.fsPath).toBe('C:\\Users\\nick\\docs\\file.md');
		});

		it('should throw error for empty path', () => {
			expect(() => toVscodeUri('')).toThrow(GitError);
			expect(() => toVscodeUri('   ')).toThrow(GitError);
		});

		it('should handle paths with spaces', () => {
			const uri = toVscodeUri('/home/john smith/my docs/file.md');
			expect(uri).toBeTruthy();
			expect(uri.fsPath).toContain('john smith');
		});

		it('should handle paths with Unicode characters', () => {
			const uri = toVscodeUri('/home/nick/文档/readme.md');
			expect(uri).toBeTruthy();
			expect(uri.fsPath).toContain('文档');
		});
	});

	describe('isWindowsPath', () => {
		it('should detect Windows drive letter path', () => {
			expect(isWindowsPath('C:\\Users\\nick\\file.md')).toBe(true);
			expect(isWindowsPath('D:\\Projects\\file.md')).toBe(true);
		});

		it('should detect lowercase drive letters', () => {
			expect(isWindowsPath('c:\\Users\\file.md')).toBe(true);
		});

		it('should detect UNC paths', () => {
			expect(isWindowsPath('\\\\server\\share\\file.md')).toBe(true);
		});

		it('should not detect Unix paths as Windows', () => {
			expect(isWindowsPath('/home/nick/file.md')).toBe(false);
			expect(isWindowsPath('/Users/nick/file.md')).toBe(false);
		});

		it('should handle mixed separator paths', () => {
			// More backslashes than forward slashes
			expect(isWindowsPath('C:\\Users\\nick/file.md')).toBe(true);
		});
	});

	describe('toForwardSlashes', () => {
		it('should convert backslashes to forward slashes', () => {
			const result = toForwardSlashes('C:\\Users\\nick\\docs\\file.md');
			expect(result).toBe('C:/Users/nick/docs/file.md');
		});

		it('should preserve forward slashes', () => {
			const result = toForwardSlashes('/home/nick/docs/file.md');
			expect(result).toBe('/home/nick/docs/file.md');
		});

		it('should handle mixed separators', () => {
			const result = toForwardSlashes('C:\\Users/nick\\docs/file.md');
			expect(result).toBe('C:/Users/nick/docs/file.md');
		});
	});

	describe('toBackslashes', () => {
		it('should convert forward slashes to backslashes', () => {
			const result = toBackslashes('/home/nick/docs/file.md');
			expect(result).toBe('\\home\\nick\\docs\\file.md');
		});

		it('should preserve backslashes', () => {
			const result = toBackslashes('C:\\Users\\nick\\docs\\file.md');
			expect(result).toBe('C:\\Users\\nick\\docs\\file.md');
		});

		it('should handle mixed separators', () => {
			const result = toBackslashes('C:/Users\\nick/docs\\file.md');
			expect(result).toBe('C:\\Users\\nick\\docs\\file.md');
		});
	});

	describe('edge cases', () => {
		it('should handle path with only filename', () => {
			const result = normalizePath('file.md');
			expect(result).toBe('file.md');
		});

		it('should handle path with emoji', () => {
			const result = normalizePath('/home/nick/🎉/file.md');
			expect(result).toContain('🎉');
		});

		it('should handle very long paths', () => {
			const longPath = '/home/' + 'a'.repeat(200) + '/file.md';
			const result = normalizePath(longPath);
			expect(result).toBeTruthy();
		});

		it('should handle paths with @ symbol', () => {
			const result = normalizePath('/home/nick/image@2x.png');
			expect(result).toContain('@');
		});

		it('should handle paths with hash symbol', () => {
			const result = normalizePath('/home/nick/file#1.md');
			expect(result).toContain('#');
		});

		it('should handle paths with parentheses', () => {
			const result = normalizePath('/home/nick/file(1).md');
			expect(result).toContain('(1)');
		});
	});
});
