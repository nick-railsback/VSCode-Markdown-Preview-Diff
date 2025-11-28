/**
 * Platform utilities for cross-platform compatibility
 *
 * Provides OS detection, path normalization, and safe URI conversion.
 * Implements FR48-FR52 for cross-platform path handling.
 * Per Architecture Document Security section (NFR-S1, NFR-S3).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { GitError, GitErrorType } from '../types/git.types';

/**
 * Platform information interface
 *
 * Contains OS type, path separator, and modifier key for current platform.
 */
export interface PlatformInfo {
	/** Operating system identifier */
	os: 'darwin' | 'win32' | 'linux';
	/** Path separator character */
	pathSeparator: '/' | '\\';
	/** Keyboard modifier key for shortcuts */
	modifierKey: 'Cmd' | 'Ctrl';
}

/**
 * Gets information about the current platform
 *
 * Detects the operating system and returns appropriate configuration.
 * Used for platform-specific behavior and documentation.
 *
 * @returns PlatformInfo object with OS-specific values
 *
 * @example
 * ```typescript
 * const platform = getPlatformInfo();
 * console.log(`Running on ${platform.os} with ${platform.modifierKey} modifier`);
 * ```
 */
export function getPlatformInfo(): PlatformInfo {
	const platform = process.platform;

	switch (platform) {
		case 'darwin':
			return {
				os: 'darwin',
				pathSeparator: '/',
				modifierKey: 'Cmd'
			};
		case 'win32':
			return {
				os: 'win32',
				pathSeparator: '\\',
				modifierKey: 'Ctrl'
			};
		case 'linux':
		default:
			return {
				os: 'linux',
				pathSeparator: '/',
				modifierKey: 'Ctrl'
			};
	}
}

/**
 * Normalizes a file path for cross-platform compatibility
 *
 * Converts path separators to the current platform's separator,
 * resolves redundant separators, and handles edge cases.
 *
 * Security: Does NOT validate path safety. Use validateFilePath for security checks.
 *
 * @param filePath - File path to normalize (may contain mixed separators)
 * @returns Normalized path with platform-appropriate separators
 * @throws GitError if path is empty or invalid
 *
 * @example
 * ```typescript
 * // On Unix
 * normalizePath('C:\\Users\\nick\\file.md') // Returns 'C:/Users/nick/file.md'
 *
 * // On Windows
 * normalizePath('/home/nick/file.md') // Returns '\\home\\nick\\file.md'
 * ```
 */
export function normalizePath(filePath: string): string {
	// Handle empty paths
	if (!filePath || filePath.trim() === '') {
		throw new GitError(
			GitErrorType.InvalidPath,
			'Path cannot be empty'
		);
	}

	// Use Node's path.normalize for consistent handling
	// This handles redundant separators (foo//bar) and . segments
	const normalized = path.normalize(filePath);

	return normalized;
}

/**
 * Validates a path does not contain path traversal attempts
 *
 * Security check to prevent directory traversal attacks.
 * Should be called before any file system operations.
 *
 * @param filePath - Path to validate
 * @returns True if path is safe (no traversal)
 * @throws GitError with InvalidPath if path contains traversal patterns
 *
 * @example
 * ```typescript
 * validateNoTraversal('/workspace/docs/file.md'); // Returns true
 * validateNoTraversal('../../../etc/passwd'); // Throws GitError
 * ```
 */
export function validateNoTraversal(filePath: string): boolean {
	// Check for path traversal patterns (NFR-S3)
	if (filePath.includes('..')) {
		throw new GitError(
			GitErrorType.InvalidPath,
			`Invalid file path: path traversal not allowed. Path: ${filePath}`
		);
	}
	return true;
}

/**
 * Converts a file path to a vscode.Uri safely
 *
 * Handles cross-platform path conversion and validation.
 * Preferred method for creating URIs from file paths.
 *
 * @param filePath - Absolute file path to convert
 * @returns vscode.Uri representing the file
 * @throws GitError if path is empty
 *
 * @example
 * ```typescript
 * const uri = toVscodeUri('/home/user/docs/readme.md');
 * // Returns vscode.Uri with file:///home/user/docs/readme.md
 *
 * const winUri = toVscodeUri('C:\\Users\\docs\\readme.md');
 * // Returns vscode.Uri with file:///c%3A/Users/docs/readme.md
 * ```
 */
export function toVscodeUri(filePath: string): vscode.Uri {
	// Handle empty paths
	if (!filePath || filePath.trim() === '') {
		throw new GitError(
			GitErrorType.InvalidPath,
			'Path cannot be empty'
		);
	}

	// Use vscode.Uri.file() for safe cross-platform URI creation
	// This handles Windows drive letters, UNC paths, and Unix paths
	return vscode.Uri.file(filePath);
}

/**
 * Checks if a path appears to be a Windows-style path
 *
 * Useful for determining path format before processing.
 *
 * @param filePath - Path to check
 * @returns True if path appears to be Windows-style
 *
 * @example
 * ```typescript
 * isWindowsPath('C:\\Users\\file.md'); // true
 * isWindowsPath('/home/user/file.md'); // false
 * isWindowsPath('\\\\server\\share\\file.md'); // true (UNC path)
 * ```
 */
export function isWindowsPath(filePath: string): boolean {
	// Check for Windows drive letter (e.g., C:)
	if (/^[a-zA-Z]:/.test(filePath)) {
		return true;
	}

	// Check for UNC path (e.g., \\server\share)
	if (filePath.startsWith('\\\\')) {
		return true;
	}

	// Check if path contains more backslashes than forward slashes
	const backslashes = (filePath.match(/\\/g) || []).length;
	const forwardSlashes = (filePath.match(/\//g) || []).length;

	return backslashes > forwardSlashes;
}

/**
 * Converts a path to use forward slashes consistently
 *
 * Useful when needing consistent path representation regardless of platform.
 * Note: This may not be valid on Windows for all operations.
 *
 * @param filePath - Path to convert
 * @returns Path with forward slashes
 *
 * @example
 * ```typescript
 * toForwardSlashes('C:\\Users\\nick\\file.md');
 * // Returns 'C:/Users/nick/file.md'
 * ```
 */
export function toForwardSlashes(filePath: string): string {
	return filePath.replace(/\\/g, '/');
}

/**
 * Converts a path to use backslashes consistently
 *
 * Useful for Windows-specific operations that require backslashes.
 *
 * @param filePath - Path to convert
 * @returns Path with backslashes
 *
 * @example
 * ```typescript
 * toBackslashes('/home/nick/file.md');
 * // Returns '\\home\\nick\\file.md'
 * ```
 */
export function toBackslashes(filePath: string): string {
	return filePath.replace(/\//g, '\\');
}
