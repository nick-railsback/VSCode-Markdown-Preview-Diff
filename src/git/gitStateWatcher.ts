/**
 * GitStateWatcher - Monitors VS Code Git Extension for state changes
 *
 * Story 4.5: Real-Time Diff Updates and Git State Monitoring
 *
 * Detects:
 * - Git commits (AC3): HEAD changes
 * - Git stash (AC4): Working tree state changes
 * - Branch switches (AC5): HEAD branch changes
 *
 * Uses VS Code Git Extension API:
 * - vscode.extensions.getExtension('vscode.git')
 * - repository.state.onDidChange
 */

import * as vscode from 'vscode';
import { logDebug, logInfo, logWarning } from '../utils/errorHandler';

/**
 * Git extension API types
 * Based on VS Code Git Extension API (vscode.git)
 */
interface GitExtension {
	getAPI(version: number): GitAPI;
}

interface GitAPI {
	repositories: Repository[];
	onDidOpenRepository: vscode.Event<Repository>;
}

interface Repository {
	rootUri: vscode.Uri;
	state: RepositoryState;
}

interface RepositoryState {
	HEAD: Head | undefined;
	onDidChange: vscode.Event<void>;
}

interface Head {
	name?: string;
	commit?: string;
	type?: RefType;
}

enum RefType {
	Head = 0,
	RemoteHead = 1,
	Tag = 2
}

/**
 * GitStateWatcher monitors git repository state changes
 */
export class GitStateWatcher {
	/** Event emitter for state changes */
	private readonly _onDidChangeState = new vscode.EventEmitter<void>();

	/** Public event for state changes */
	public readonly onDidChangeState = this._onDidChangeState.event;

	/** Tracked file path */
	private readonly filePath: string;

	/** Repository reference */
	private repository: Repository | null = null;

	/** Last known HEAD commit hash (for commit detection) */
	private lastHeadCommit: string | undefined;

	/** Last known branch name (for branch switch detection) */
	private lastBranchName: string | undefined;

	/** Disposables for cleanup */
	private disposables: vscode.Disposable[] = [];

	/** Whether watcher is active */
	private active: boolean = false;

	/**
	 * Create a new GitStateWatcher
	 * @param filePath - Path to file for repository detection
	 */
	constructor(filePath: string) {
		this.filePath = filePath;
		this.initialize();
	}

	/**
	 * Initialize the git state watcher
	 */
	private initialize(): void {
		try {
			const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');

			if (!gitExtension) {
				logWarning('GitStateWatcher: VS Code Git extension not found');
				return;
			}

			if (!gitExtension.isActive) {
				// Wait for extension to activate - use Promise.resolve to get proper Promise methods
				Promise.resolve(gitExtension.activate()).then(
					() => {
						this.setupWatcher(gitExtension.exports);
					},
					(err: unknown) => {
						logWarning(`GitStateWatcher: Failed to activate git extension: ${err}`);
					}
				);
			} else {
				this.setupWatcher(gitExtension.exports);
			}
		} catch (error) {
			logWarning(`GitStateWatcher: Initialization failed: ${error}`);
		}
	}

	/**
	 * Set up the repository state watcher
	 */
	private setupWatcher(gitExtension: GitExtension): void {
		try {
			const git = gitExtension.getAPI(1);

			// Find repository for the tracked file
			this.repository = this.findRepository(git);

			if (!this.repository) {
				logWarning('GitStateWatcher: No repository found for tracked file');

				// Listen for repository open events
				const openDisposable = git.onDidOpenRepository((repo) => {
					if (this.isFileInRepository(repo)) {
						this.repository = repo;
						this.attachStateListener();
						logInfo('GitStateWatcher: Repository opened, watcher attached');
					}
				});
				this.disposables.push(openDisposable);
				return;
			}

			this.attachStateListener();

		} catch (error) {
			logWarning(`GitStateWatcher: Failed to setup watcher: ${error}`);
		}
	}

	/**
	 * Find repository containing the tracked file
	 */
	private findRepository(git: GitAPI): Repository | null {
		for (const repo of git.repositories) {
			if (this.isFileInRepository(repo)) {
				return repo;
			}
		}
		return null;
	}

	/**
	 * Check if tracked file is within repository
	 */
	private isFileInRepository(repo: Repository): boolean {
		const repoRoot = repo.rootUri.fsPath;
		return this.filePath.startsWith(repoRoot);
	}

	/**
	 * Attach listener to repository state changes
	 */
	private attachStateListener(): void {
		if (!this.repository) {
			return;
		}

		// Store initial state
		this.lastHeadCommit = this.repository.state.HEAD?.commit;
		this.lastBranchName = this.repository.state.HEAD?.name;

		// Listen for state changes
		const stateDisposable = this.repository.state.onDidChange(() => {
			this.handleStateChange();
		});

		this.disposables.push(stateDisposable);
		this.active = true;

		logInfo(`GitStateWatcher: Watching repository at ${this.repository.rootUri.fsPath}`);
		logDebug(`GitStateWatcher: Initial HEAD commit: ${this.lastHeadCommit}, branch: ${this.lastBranchName}`);
	}

	/**
	 * Handle repository state change
	 * Detects commits, stash operations, and branch switches
	 */
	private handleStateChange(): void {
		if (!this.repository) {
			return;
		}

		const currentHead = this.repository.state.HEAD;
		const currentCommit = currentHead?.commit;
		const currentBranch = currentHead?.name;

		let changeDetected = false;
		let changeType = 'unknown';

		// AC3: Detect commit - HEAD commit changed on same branch
		if (currentCommit !== this.lastHeadCommit) {
			if (currentBranch === this.lastBranchName) {
				changeType = 'commit';
				logDebug(`GitStateWatcher: Commit detected - ${this.lastHeadCommit?.substring(0, 7)} → ${currentCommit?.substring(0, 7)}`);
			} else {
				// AC5: Branch switch detected
				changeType = 'branch-switch';
				logDebug(`GitStateWatcher: Branch switch detected - ${this.lastBranchName} → ${currentBranch}`);
			}
			changeDetected = true;
		}

		// AC4: Working tree changes (stash) - this is also caught by onDidChange
		// The repository state change event fires on any working tree modification
		// We emit the event and let the diff recomputation determine if content changed

		// Update tracked state
		this.lastHeadCommit = currentCommit;
		this.lastBranchName = currentBranch;

		// Emit change event
		if (changeDetected || changeType === 'unknown') {
			// For unknown changes (stash, etc.), still emit event
			// The recomputation will handle "no changes" case
			logDebug(`GitStateWatcher: Emitting state change event (type: ${changeType})`);
			this._onDidChangeState.fire();
		}
	}

	/**
	 * Check if watcher is active
	 */
	public isActive(): boolean {
		return this.active;
	}

	/**
	 * Dispose all resources
	 */
	public dispose(): void {
		logDebug('GitStateWatcher: Disposing');

		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];

		this._onDidChangeState.dispose();
		this.repository = null;
		this.active = false;

		logInfo('GitStateWatcher: Disposed');
	}
}
