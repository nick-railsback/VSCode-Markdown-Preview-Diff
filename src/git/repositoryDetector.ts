/**
 * Git repository detection module
 *
 * Detects whether a file is within a git repository.
 * Part of the Git Service component per Architecture Document.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import { GitError, GitErrorType, RepositoryInfo } from '../types/git.types';
import { validateFilePath } from '../utils/pathValidator';
import * as path from 'path';

/**
 * Detects git repositories and provides repository information
 */
export class RepositoryDetector {
	private git: SimpleGit;
	private workspaceRoot: string;

	/**
	 * Creates a RepositoryDetector instance
	 *
	 * @param workspaceRootPath - Absolute path to workspace root
	 */
	constructor(workspaceRootPath: string) {
		this.workspaceRoot = workspaceRootPath;

		// Initialize simple-git with secure configuration (ADR-002)
		this.git = simpleGit({
			baseDir: workspaceRootPath,
			binary: 'git',
			maxConcurrentProcesses: 6,
			trimmed: true
		});
	}

	/**
	 * Checks if a file is within a git repository
	 *
	 * Validates file path security before checking repository status.
	 *
	 * @param filePath - Absolute path to file
	 * @returns true if file is in a git repository, false otherwise
	 * @throws GitError if path validation fails or git is not installed
	 */
	async isInRepository(filePath: string): Promise<boolean> {
		try {
			// Security: Validate file path (NFR-S1, NFR-S3)
			validateFilePath(filePath, this.workspaceRoot);

			// Check if file path is within a git repository
			const isRepo = await this.git.checkIsRepo();

			if (!isRepo) {
				return false;
			}

			// Verify file is within the detected repository
			const repoRoot = await this.getRepositoryRoot();
			const normalizedFilePath = path.normalize(filePath);
			const normalizedRepoRoot = path.normalize(repoRoot);

			return normalizedFilePath.startsWith(normalizedRepoRoot);
		} catch (error) {
			// Handle git not installed
			if (error instanceof Error && error.message.includes('git: command not found')) {
				throw new GitError(
					GitErrorType.GitNotInstalled,
					'Git is not installed or not in PATH. Please install git to use this extension.',
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
				`Failed to check repository status: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Gets the root directory of the git repository
	 *
	 * @returns Absolute path to repository root
	 * @throws GitError if not in a repository or git operation fails
	 */
	async getRepositoryRoot(): Promise<string> {
		try {
			// Get repository root using git rev-parse
			const root = await this.git.revparse(['--show-toplevel']);
			return root.trim();
		} catch (error) {
			throw new GitError(
				GitErrorType.NotInRepository,
				'File is not in a git repository. Preview Diff requires git version control.',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Gets information about the current repository
	 *
	 * @returns Repository information (root path, current branch)
	 * @throws GitError if not in a repository or git operation fails
	 */
	async getRepositoryInfo(): Promise<RepositoryInfo> {
		try {
			const root = await this.getRepositoryRoot();

			// Get current branch name
			const status = await this.git.status();
			const branch = status.current || 'HEAD';

			return {
				root,
				branch
			};
		} catch (error) {
			if (error instanceof GitError) {
				throw error;
			}

			throw new GitError(
				GitErrorType.Unknown,
				`Failed to get repository information: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}
}
