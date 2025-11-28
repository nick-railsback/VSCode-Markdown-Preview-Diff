/**
 * Cross-Platform Validation Tests
 *
 * Story 5.4: Validate Performance and Reliability Across Platforms
 *
 * Tests cross-platform path handling, keyboard shortcuts, and platform-specific
 * behavior for macOS (AC1), Windows (AC2), and Linux (AC3).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getPlatformInfo,
	normalizePath,
	validateNoTraversal,
	toVscodeUri,
	isWindowsPath,
	toForwardSlashes,
	toBackslashes
} from '../../src/utils/platformUtils';
import { GitError, GitErrorType } from '../../src/types/git.types';

// Mock vscode for Uri.file
vi.mock('vscode', () => ({
	Uri: {
		file: vi.fn((path: string) => ({
			fsPath: path,
			scheme: 'file',
			toString: () => `file://${path}`
		}))
	}
}));

describe('Cross-Platform Validation (AC1, AC2, AC3)', () => {
	describe('Platform Detection', () => {
		it('should detect current platform correctly', () => {
			const platform = getPlatformInfo();

			// Should return valid platform info
			expect(['darwin', 'win32', 'linux']).toContain(platform.os);
			expect(['/', '\\']).toContain(platform.pathSeparator);
			expect(['Cmd', 'Ctrl']).toContain(platform.modifierKey);
		});

		it('should use Cmd modifier on macOS', () => {
			// This test validates the logic, actual platform is runtime-dependent
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

			const platform = getPlatformInfo();
			expect(platform.os).toBe('darwin');
			expect(platform.modifierKey).toBe('Cmd');
			expect(platform.pathSeparator).toBe('/');

			Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
		});

		it('should use Ctrl modifier on Windows', () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

			const platform = getPlatformInfo();
			expect(platform.os).toBe('win32');
			expect(platform.modifierKey).toBe('Ctrl');
			expect(platform.pathSeparator).toBe('\\');

			Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
		});

		it('should use Ctrl modifier on Linux', () => {
			const originalPlatform = process.platform;
			Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

			const platform = getPlatformInfo();
			expect(platform.os).toBe('linux');
			expect(platform.modifierKey).toBe('Ctrl');
			expect(platform.pathSeparator).toBe('/');

			Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
		});
	});

	describe('Path Handling - macOS (AC1)', () => {
		it('should handle Unix forward slash paths', () => {
			const path = '/Users/nick/Documents/readme.md';
			const normalized = normalizePath(path);
			expect(normalized).toBeTruthy();
		});

		it('should handle paths with spaces (AC1)', () => {
			const path = '/Users/nick/My Documents/readme.md';
			const normalized = normalizePath(path);
			expect(normalized).toContain('My Documents');
		});

		it('should handle paths with special characters', () => {
			const path = '/Users/nick/docs/file-name_v1.2.md';
			const normalized = normalizePath(path);
			expect(normalized).toContain('file-name_v1.2');
		});

		it('should convert to vscode.Uri safely', () => {
			const path = '/Users/nick/Documents/readme.md';
			const uri = toVscodeUri(path);
			expect(uri.fsPath).toBe(path);
		});

		it('should detect Unix path as not Windows path', () => {
			expect(isWindowsPath('/Users/nick/file.md')).toBe(false);
		});
	});

	describe('Path Handling - Windows (AC2)', () => {
		it('should handle Windows backslash paths', () => {
			const path = 'C:\\Users\\nick\\Documents\\readme.md';
			const normalized = normalizePath(path);
			expect(normalized).toBeTruthy();
		});

		it('should handle Windows paths with spaces (AC2)', () => {
			const path = 'C:\\Users\\nick\\My Documents\\readme.md';
			const normalized = normalizePath(path);
			expect(normalized).toBeTruthy();
		});

		it('should detect Windows drive letter paths', () => {
			expect(isWindowsPath('C:\\Users\\nick\\file.md')).toBe(true);
			expect(isWindowsPath('D:\\Projects\\test.md')).toBe(true);
		});

		it('should detect UNC paths', () => {
			expect(isWindowsPath('\\\\server\\share\\file.md')).toBe(true);
		});

		it('should convert backslashes to forward slashes', () => {
			const path = 'C:\\Users\\nick\\file.md';
			const converted = toForwardSlashes(path);
			expect(converted).toBe('C:/Users/nick/file.md');
		});
	});

	describe('Path Handling - Linux (AC3)', () => {
		it('should handle Linux forward slash paths', () => {
			const path = '/home/nick/Documents/readme.md';
			const normalized = normalizePath(path);
			expect(normalized).toBeTruthy();
		});

		it('should handle paths with spaces', () => {
			const path = '/home/nick/my documents/readme.md';
			const normalized = normalizePath(path);
			expect(normalized).toContain('my documents');
		});

		it('should detect Linux path as not Windows path', () => {
			expect(isWindowsPath('/home/nick/file.md')).toBe(false);
		});
	});

	describe('Path Security Validation', () => {
		it('should reject path traversal attempts', () => {
			expect(() => validateNoTraversal('../../../etc/passwd')).toThrow(GitError);
			expect(() => validateNoTraversal('/home/../root/file.md')).toThrow(GitError);
		});

		it('should allow safe paths', () => {
			expect(validateNoTraversal('/Users/nick/Documents/readme.md')).toBe(true);
			expect(validateNoTraversal('C:\\Users\\nick\\file.md')).toBe(true);
		});

		it('should reject empty paths', () => {
			expect(() => normalizePath('')).toThrow(GitError);
			expect(() => normalizePath('   ')).toThrow(GitError);
		});
	});

	describe('Cross-Platform Path Conversion', () => {
		it('should convert forward slashes to backslashes', () => {
			const path = '/home/nick/file.md';
			const converted = toBackslashes(path);
			expect(converted).toBe('\\home\\nick\\file.md');
		});

		it('should handle mixed separators in Windows path detection', () => {
			// Path with more backslashes than forward slashes
			expect(isWindowsPath('folder\\subfolder\\file.md')).toBe(true);
			// Path with more forward slashes
			expect(isWindowsPath('folder/subfolder/file.md')).toBe(false);
		});
	});
});

describe('Line Ending Handling (AC2 - Windows CRLF)', () => {
	it('should handle CRLF line endings in diff computation', async () => {
		// Import DiffComputer for line ending test
		const { DiffComputer } = await import('../../src/diff/diffComputer');
		const diffComputer = new DiffComputer();

		// Content with CRLF (Windows) line endings
		const beforeCRLF = 'Line 1\r\nLine 2\r\nLine 3';
		const afterCRLF = 'Line 1\r\nLine 2 modified\r\nLine 3';

		// Should compute diff without issues
		const result = diffComputer.compute(beforeCRLF, afterCRLF);
		expect(result.changeCount).toBeGreaterThan(0);
	});

	it('should handle LF line endings in diff computation', async () => {
		const { DiffComputer } = await import('../../src/diff/diffComputer');
		const diffComputer = new DiffComputer();

		// Content with LF (Unix/Mac) line endings
		const beforeLF = 'Line 1\nLine 2\nLine 3';
		const afterLF = 'Line 1\nLine 2 modified\nLine 3';

		// Should compute diff without issues
		const result = diffComputer.compute(beforeLF, afterLF);
		expect(result.changeCount).toBeGreaterThan(0);
	});

	it('should handle mixed line endings', async () => {
		const { DiffComputer } = await import('../../src/diff/diffComputer');
		const diffComputer = new DiffComputer();

		// Mixed line endings
		const before = 'Line 1\r\nLine 2\nLine 3\r\n';
		const after = 'Line 1\nLine 2\r\nLine 3\n';

		// Should not crash
		expect(() => diffComputer.compute(before, after)).not.toThrow();
	});
});

describe('Keyboard Shortcut Configuration (AC1, AC2, AC3)', () => {
	it('should have platform-aware keybindings in package.json', async () => {
		const { readFileSync } = await import('fs');
		const { join } = await import('path');

		// Read package.json to verify keybindings
		const packageJsonPath = join(process.cwd(), 'package.json');
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

		const keybindings = packageJson.contributes?.keybindings || [];

		// Find the Open Preview Diff keybinding
		const openDiffBinding = keybindings.find(
			(kb: any) => kb.command === 'markdown.openPreviewDiff'
		);

		expect(openDiffBinding).toBeDefined();
		// Should have Ctrl for Windows/Linux
		expect(openDiffBinding.key).toBe('ctrl+k d');
		// Should have Cmd for macOS
		expect(openDiffBinding.mac).toBe('cmd+k d');
		// Should only activate for markdown files
		expect(openDiffBinding.when).toBe('editorLangId == markdown');
	});
});
