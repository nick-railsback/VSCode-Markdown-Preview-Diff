/**
 * File version retrieval module
 *
 * Retrieves different versions of files from git (HEAD, staged, working).
 * Part of the Git Service component per Architecture Document.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';
import { GitError, GitErrorType } from '../types/git.types';
import { validateFilePath, getRelativePath } from '../utils/pathValidator';

/**
 * Retrieves file content from different git states
 */
export class FileVersionRetriever {
	private git: SimpleGit;
	private workspaceRoot: string;
	private repoRoot: string;

	/**
	 * Creates a FileVersionRetriever instance
	 *
	 * @param workspaceRootPath - Absolute path to workspace root
	 * @param repositoryRootPath - Absolute path to git repository root
	 */
	constructor(workspaceRootPath: string, repositoryRootPath: string) {
		this.workspaceRoot = workspaceRootPath;
		this.repoRoot = repositoryRootPath;

		// Initialize simple-git with secure configuration (ADR-002)
		this.git = simpleGit({
			baseDir: repositoryRootPath,
			binary: 'git',
			maxConcurrentProcesses: 6,
			trimmed: true
		});
	}

	/**
	 * Gets file content from HEAD commit
	 *
	 * Implements FR38 (retrieve HEAD version) and FR42 (handle new uncommitted files).
	 * Uses parameterized git commands to prevent injection attacks (NFR-S2).
	 *
	 * @param filePath - Absolute path to file
	 * @returns File content from HEAD, or null if file doesn't exist in HEAD (new file)
	 * @throws GitError if path validation fails or git operation fails unexpectedly
	 */
	async getHeadVersion(filePath: string): Promise<string | null> {
		try {
			// Security: Validate file path (NFR-S1, NFR-S3)
			validateFilePath(filePath, this.workspaceRoot);

			// Convert to relative path from repo root
			const relativePath = getRelativePath(filePath, this.repoRoot);

			// Parameterized git command to prevent injection (NFR-S2)
			// CORRECT: git.show(['HEAD:path']) - parameterized array
			// INCORRECT: git.raw(['show', `HEAD:${path}`]) - string interpolation vulnerable
			const content = await this.git.show(['HEAD:' + relativePath]);

			return content;
		} catch (error) {
			// Handle new files that don't exist in HEAD (FR42)
			if (error instanceof Error &&
				(error.message.includes('does not exist') ||
				 error.message.includes('exists on disk, but not in') ||
				 error.message.includes('Path') && error.message.includes('does not exist'))) {
				// This is expected for new uncommitted files
				return null;
			}

			// Handle git not installed
			if (error instanceof Error && error.message.includes('git: command not found')) {
				throw new GitError(
					GitErrorType.GitNotInstalled,
					'Git is not installed or not in PATH. Please install git to use this extension.',
					error
				);
			}

			// Handle permission errors
			if (error instanceof Error && error.message.includes('Permission denied')) {
				throw new GitError(
					GitErrorType.PermissionDenied,
					'Permission denied accessing git repository. Check file permissions.',
					error
				);
			}

			// Re-throw GitError from validation
			if (error instanceof GitError) {
				throw error;
			}

			// Catch-all for unexpected errors
			throw new GitError(
				GitErrorType.Unknown,
				`Failed to retrieve HEAD version: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Gets file content from staging area
	 *
	 * Implements FR39 (retrieve staged version).
	 *
	 * @param filePath - Absolute path to file
	 * @returns File content from staging area, or null if file is not staged
	 * @throws GitError if path validation fails or git operation fails unexpectedly
	 */
	async getStagedVersion(filePath: string): Promise<string | null> {
		try {
			// Security: Validate file path (NFR-S1, NFR-S3)
			validateFilePath(filePath, this.workspaceRoot);

			// Convert to relative path from repo root
			const relativePath = getRelativePath(filePath, this.repoRoot);

			// Parameterized git command to get staged content (NFR-S2)
			// Git uses ':path' notation for staged content
			const content = await this.git.show([':' + relativePath]);

			return content;
		} catch (error) {
			// Handle files not in staging area
			if (error instanceof Error &&
				(error.message.includes('does not exist') ||
				 error.message.includes('Path') && error.message.includes('is in the index'))) {
				// File not staged - this is not an error
				return null;
			}

			// Re-throw GitError from validation
			if (error instanceof GitError) {
				throw error;
			}

			// Catch-all for unexpected errors (but be lenient for staging area)
			// Many files won't be in staging area, so return null instead of throwing
			return null;
		}
	}

	/**
	 * Gets current file content from editor or filesystem
	 *
	 * Implements FR40 (retrieve working version).
	 * Uses VS Code workspace API for safe file access (NFR-S1).
	 *
	 * @param filePath - Absolute path to file
	 * @returns Current file content
	 * @throws GitError if path validation fails or file cannot be read
	 */
	async getWorkingVersion(filePath: string): Promise<string> {
		try {
			// Security: Validate file path (NFR-S1, NFR-S3)
			validateFilePath(filePath, this.workspaceRoot);

			// Use VS Code API for safe file access
			const uri = vscode.Uri.file(filePath);
			const fileContent = await vscode.workspace.fs.readFile(uri);

			// Convert Uint8Array to UTF-8 string
			const decoder = new TextDecoder('utf-8');
			const content = decoder.decode(fileContent);

			return content;
		} catch (error) {
			// Handle file not found
			if (error instanceof vscode.FileSystemError) {
				throw new GitError(
					GitErrorType.FileNotFound,
					`File not found: ${filePath}`,
					error
				);
			}

			// Re-throw GitError from validation
			if (error instanceof GitError) {
				throw error;
			}

			// Catch-all for unexpected errors
			throw new GitError(
				GitErrorType.Unknown,
				`Failed to read working file: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}
}
