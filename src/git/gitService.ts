/**
 * Git Service - Unified API for git operations
 *
 * Facade pattern implementation that orchestrates RepositoryDetector and FileVersionRetriever.
 * Provides the main public API for git operations per Architecture Document and Epic 2 Tech Spec.
 */

import { RepositoryDetector } from './repositoryDetector';
import { FileVersionRetriever } from './fileVersionRetriever';
import { FileVersions, GitError, GitErrorType } from '../types/git.types';
import { getWorkspaceRoot } from '../utils/pathValidator';

/**
 * Main git service providing unified access to repository and file operations
 *
 * This is the primary interface used by other extension components.
 * Implements the Facade pattern per Architecture Document.
 */
export class GitService {
	private repositoryDetector: RepositoryDetector | null = null;
	private fileVersionRetriever: FileVersionRetriever | null = null;
	private workspaceRoot: string | null = null;
	private repoRoot: string | null = null;

	/**
	 * Creates a GitService instance
	 *
	 * Initializes lazily - repository detection happens on first use.
	 * This allows the service to be created before workspace is available.
	 */
	constructor() {
		// Lazy initialization - detect repository on first use
	}

	/**
	 * Initializes git service with workspace context
	 *
	 * @throws GitError if no workspace is open
	 */
	private async initialize(): Promise<void> {
		if (this.repositoryDetector !== null) {
			// Already initialized
			return;
		}

		// Get workspace root
		const workspaceRootUri = getWorkspaceRoot();
		if (!workspaceRootUri) {
			throw new GitError(
				GitErrorType.Unknown,
				'No workspace folder is open. Please open a workspace to use this extension.'
			);
		}

		this.workspaceRoot = workspaceRootUri.fsPath;

		// Initialize repository detector
		this.repositoryDetector = new RepositoryDetector(this.workspaceRoot);
	}

	/**
	 * Checks if a file is within a git repository
	 *
	 * Implements FR37 (detect git repository) and FR53 (error if not in repo).
	 *
	 * @param filePath - Absolute path to file
	 * @returns true if file is in a git repository, false otherwise
	 * @throws GitError if initialization fails or git is not installed
	 */
	async isInRepository(filePath: string): Promise<boolean> {
		await this.initialize();

		if (!this.repositoryDetector) {
			throw new GitError(
				GitErrorType.Unknown,
				'Repository detector not initialized'
			);
		}

		return await this.repositoryDetector.isInRepository(filePath);
	}

	/**
	 * Gets file content from HEAD commit
	 *
	 * Implements FR38 (retrieve HEAD version) and FR42 (handle new uncommitted files).
	 * Automatically initializes file version retriever if needed.
	 *
	 * @param filePath - Absolute path to file
	 * @returns File content from HEAD, or null if file doesn't exist in HEAD (new file)
	 * @throws GitError if not in repository or git operation fails
	 */
	async getHeadVersion(filePath: string): Promise<string | null> {
		await this.initialize();

		// Ensure we have repository context
		await this.ensureRepositoryContext(filePath);

		if (!this.fileVersionRetriever) {
			throw new GitError(
				GitErrorType.Unknown,
				'File version retriever not initialized'
			);
		}

		return await this.fileVersionRetriever.getHeadVersion(filePath);
	}

	/**
	 * Gets file content from staging area
	 *
	 * Implements FR39 (retrieve staged version).
	 *
	 * @param filePath - Absolute path to file
	 * @returns File content from staging area, or null if file is not staged
	 * @throws GitError if not in repository or git operation fails
	 */
	async getStagedVersion(filePath: string): Promise<string | null> {
		await this.initialize();

		// Ensure we have repository context
		await this.ensureRepositoryContext(filePath);

		if (!this.fileVersionRetriever) {
			throw new GitError(
				GitErrorType.Unknown,
				'File version retriever not initialized'
			);
		}

		return await this.fileVersionRetriever.getStagedVersion(filePath);
	}

	/**
	 * Gets current file content from editor or filesystem
	 *
	 * Implements FR40 (retrieve working version).
	 *
	 * @param filePath - Absolute path to file
	 * @returns Current file content
	 * @throws GitError if file cannot be read
	 */
	async getWorkingVersion(filePath: string): Promise<string> {
		await this.initialize();

		// Ensure we have repository context
		await this.ensureRepositoryContext(filePath);

		if (!this.fileVersionRetriever) {
			throw new GitError(
				GitErrorType.Unknown,
				'File version retriever not initialized'
			);
		}

		return await this.fileVersionRetriever.getWorkingVersion(filePath);
	}

	/**
	 * Gets all file versions (HEAD, staged, working) in parallel
	 *
	 * Convenience method that retrieves all versions efficiently.
	 * Uses Promise.all for parallel git operations (NFR-P5).
	 *
	 * @param filePath - Absolute path to file
	 * @returns FileVersions object with all versions
	 * @throws GitError if not in repository or git operations fail
	 */
	async getAllVersions(filePath: string): Promise<FileVersions> {
		await this.initialize();

		// Ensure we have repository context
		await this.ensureRepositoryContext(filePath);

		// Retrieve all versions in parallel for performance (NFR-P5)
		const [head, staged, working] = await Promise.all([
			this.getHeadVersion(filePath),
			this.getStagedVersion(filePath),
			this.getWorkingVersion(filePath)
		]);

		return {
			head: head || '', // Convert null to empty string for new files
			staged: staged || undefined, // Convert null to undefined for type compatibility
			working
		};
	}

	/**
	 * Ensures repository context is initialized for file operations
	 *
	 * Detects repository root and creates FileVersionRetriever if needed.
	 * Caches repository root to avoid repeated detection (NFR-P5).
	 *
	 * @param filePath - File path to check repository context for
	 * @throws GitError if file is not in a repository
	 */
	private async ensureRepositoryContext(filePath: string): Promise<void> {
		if (!this.repositoryDetector) {
			throw new GitError(
				GitErrorType.Unknown,
				'Repository detector not initialized'
			);
		}

		// Check if file is in repository
		const isInRepo = await this.repositoryDetector.isInRepository(filePath);
		if (!isInRepo) {
			throw new GitError(
				GitErrorType.NotInRepository,
				'File is not in a git repository. Preview Diff requires git version control.'
			);
		}

		// Initialize file version retriever if not already done (caching optimization)
		if (!this.fileVersionRetriever) {
			// Get repository root (cached in RepositoryDetector)
			this.repoRoot = await this.repositoryDetector.getRepositoryRoot();

			// Create file version retriever with repository context
			this.fileVersionRetriever = new FileVersionRetriever(
				this.workspaceRoot!,
				this.repoRoot
			);
		}
	}

	/**
	 * Disposes the git service and releases resources
	 *
	 * Call this when the extension is deactivated.
	 */
	dispose(): void {
		this.repositoryDetector = null;
		this.fileVersionRetriever = null;
		this.workspaceRoot = null;
		this.repoRoot = null;
	}
}
