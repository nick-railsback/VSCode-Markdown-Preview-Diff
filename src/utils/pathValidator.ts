/**
 * Path validation utilities for security
 *
 * Prevents path traversal attacks and ensures all file access is scoped to workspace.
 * Per Architecture Document Security section (NFR-S1, NFR-S3).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { GitError, GitErrorType } from '../types/git.types';

/**
 * Validates that a file path is safe and within workspace boundaries
 *
 * Security checks:
 * - Rejects paths containing '..' (path traversal prevention)
 * - Ensures path is within workspace root
 * - Normalizes path for cross-platform compatibility
 *
 * @param filePath - Absolute file path to validate
 * @param workspaceRoot - Workspace root path for boundary checking
 * @returns Normalized, validated file path
 * @throws GitError with type InvalidPath if validation fails
 */
export function validateFilePath(filePath: string, workspaceRoot: string): string {
	// Reject path traversal attempts (NFR-S3)
	if (filePath.includes('..')) {
		throw new GitError(
			GitErrorType.InvalidPath,
			`Invalid file path: path traversal not allowed. Path: ${filePath}`
		);
	}

	// Normalize path for cross-platform handling (FR52)
	const normalized = path.normalize(filePath);

	// Ensure path is absolute (required for workspace boundary check)
	const resolvedPath = path.isAbsolute(normalized)
		? normalized
		: path.resolve(workspaceRoot, normalized);

	// Validate path is within workspace (NFR-S1)
	const normalizedWorkspaceRoot = path.normalize(workspaceRoot);
	if (!resolvedPath.startsWith(normalizedWorkspaceRoot)) {
		throw new GitError(
			GitErrorType.InvalidPath,
			`File path is outside workspace: ${resolvedPath}`
		);
	}

	return resolvedPath;
}

/**
 * Gets the workspace root for the active workspace
 *
 * @returns Workspace root URI, or undefined if no workspace is open
 */
export function getWorkspaceRoot(): vscode.Uri | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return undefined;
	}

	// Return first workspace folder (multi-root not supported in MVP)
	return workspaceFolders[0].uri;
}

/**
 * Converts absolute path to relative path from repository root
 *
 * Git commands require relative paths from repo root (e.g., for git show)
 *
 * @param absolutePath - Absolute file path
 * @param repoRoot - Absolute path to git repository root
 * @returns Relative path from repo root
 */
export function getRelativePath(absolutePath: string, repoRoot: string): string {
	return path.relative(repoRoot, absolutePath);
}
