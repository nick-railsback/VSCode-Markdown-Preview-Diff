/**
 * Git-related type definitions for VS Code Markdown Preview Diff extension
 *
 * These types support safe git operations with strict type checking per
 * Architecture Document (Data Models section) and Epic 2 Tech Spec.
 */

/**
 * Represents different versions of a file in git
 * Used for comparing file content across git states
 */
export interface FileVersions {
	/** Current file content from editor or filesystem */
	working: string;

	/** Committed version from HEAD */
	head: string;

	/** Staged version (optional, for future use) */
	staged?: string;
}

/**
 * Information about a git repository
 */
export interface RepositoryInfo {
	/** Absolute path to repository root */
	root: string;

	/** Current branch name */
	branch: string;
}

/**
 * Standardized error types for git operations
 * Enables consistent error handling and user messaging
 */
export enum GitErrorType {
	/** Git binary not found in PATH */
	GitNotInstalled = 'GitNotInstalled',

	/** File is not in a git repository */
	NotInRepository = 'NotInRepository',

	/** File does not exist in the specified git ref */
	FileNotFound = 'FileNotFound',

	/** Permission denied accessing repository or file */
	PermissionDenied = 'PermissionDenied',

	/** Git repository may be corrupted */
	RepositoryCorrupted = 'RepositoryCorrupted',

	/** Invalid file path (security violation) */
	InvalidPath = 'InvalidPath',

	/** Unknown git operation failure */
	Unknown = 'Unknown'
}

/**
 * Structured git error with context for debugging and user messaging
 */
export class GitError extends Error {
	constructor(
		public readonly type: GitErrorType,
		message: string,
		public readonly originalError?: Error
	) {
		super(message);
		this.name = 'GitError';
	}
}

/**
 * Result type for git operations that may fail
 * Enables type-safe error handling without throwing exceptions
 */
export type GitResult<T> =
	| { success: true; data: T }
	| { success: false; error: GitError };
