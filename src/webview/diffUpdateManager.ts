/**
 * DiffUpdateManager - Coordinates real-time diff updates
 *
 * Manages all watchers for document changes, git state changes, and file system changes.
 * Implements debounced updates to prevent excessive recomputation during rapid editing.
 *
 * Story 4.5: Real-Time Diff Updates and Git State Monitoring
 *
 * Watchers:
 * - Document change watcher (AC1, AC2, AC10)
 * - Git state watcher (AC3, AC4, AC5)
 * - File system watcher (AC6)
 *
 * Responsibilities:
 * - Coordinate all update triggers
 * - Debounce updates (300ms per AC2)
 * - Trigger diff recomputation
 * - Handle "no changes" state
 * - Preserve scroll position
 * - Error handling and resource cleanup
 */

import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { DiffComputer } from '../diff/diffComputer';
import { MarkdownRenderer } from '../markdown/markdownRenderer';
import { DiffHighlighter } from '../diff/diffHighlighter';
import { ChangeNavigator } from '../diff/changeNavigator';
import { RenderResult } from '../types/webview.types';
import { logDebug, logInfo, logWarning, logError } from '../utils/errorHandler';
import { GitStateWatcher } from '../git/gitStateWatcher';

/** Debounce delay in milliseconds (AC2) */
const DEBOUNCE_DELAY_MS = 300;

/**
 * DiffUpdateManager coordinates all real-time update mechanisms
 */
export class DiffUpdateManager {
	/** Tracked file path */
	private readonly filePath: string;

	/** Webview panel reference */
	private readonly webview: vscode.Webview;

	/** Extension context for resource disposal */
	private readonly context: vscode.ExtensionContext;

	/** All disposables for cleanup (AC9) */
	private disposables: vscode.Disposable[] = [];

	/** Debounce timer reference */
	private debounceTimer: NodeJS.Timeout | null = null;

	/** Git state watcher */
	private gitStateWatcher: GitStateWatcher | null = null;

	/** File system watcher */
	private fileSystemWatcher: vscode.FileSystemWatcher | null = null;

	/** Flag to track internal edits vs external changes */
	private lastInternalEditTime: number = 0;

	/** Callback to update ChangeNavigator after recomputation */
	private onChangeNavigatorUpdate?: (navigator: ChangeNavigator) => void;

	/**
	 * Create a new DiffUpdateManager
	 *
	 * @param filePath - Absolute path to tracked markdown file
	 * @param webview - Webview for sending messages
	 * @param context - Extension context
	 * @param onChangeNavigatorUpdate - Callback when ChangeNavigator is updated
	 */
	constructor(
		filePath: string,
		webview: vscode.Webview,
		context: vscode.ExtensionContext,
		onChangeNavigatorUpdate?: (navigator: ChangeNavigator) => void
	) {
		this.filePath = filePath;
		this.webview = webview;
		this.context = context;
		this.onChangeNavigatorUpdate = onChangeNavigatorUpdate;

		logDebug(`DiffUpdateManager: Created for file ${filePath}`);
	}

	/**
	 * Initialize all watchers
	 * Call this after construction to start monitoring
	 */
	public initialize(): void {
		logDebug('DiffUpdateManager: Initializing watchers');

		this.setupDocumentChangeWatcher();
		this.setupGitStateWatcher();
		this.setupFileSystemWatcher();

		logInfo('DiffUpdateManager: All watchers initialized');
	}

	/**
	 * Set up document change watcher (AC1, AC2, AC10)
	 * Monitors VS Code text document changes for the tracked file
	 */
	private setupDocumentChangeWatcher(): void {
		const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
			// AC10: Only respond to changes in the tracked file
			if (event.document.uri.fsPath !== this.filePath) {
				return;
			}

			// Skip if no actual changes
			if (event.contentChanges.length === 0) {
				return;
			}

			logDebug(`DiffUpdateManager: Document changed, scheduling debounced update`);

			// Mark this as an internal edit (for file system watcher filtering)
			this.lastInternalEditTime = Date.now();

			// AC2: Debounce updates
			this.scheduleUpdate();
		});

		this.disposables.push(disposable);
		logDebug('DiffUpdateManager: Document change watcher registered');
	}

	/**
	 * Set up git state watcher (AC3, AC4, AC5)
	 * Monitors git state changes via VS Code Git Extension API
	 */
	private setupGitStateWatcher(): void {
		try {
			this.gitStateWatcher = new GitStateWatcher(this.filePath);

			const disposable = this.gitStateWatcher.onDidChangeState(() => {
				logDebug('DiffUpdateManager: Git state changed, scheduling update');
				this.scheduleUpdate();
			});

			this.disposables.push(disposable);

			// Add gitStateWatcher itself to disposables for cleanup
			this.disposables.push({
				dispose: () => this.gitStateWatcher?.dispose()
			});

			logDebug('DiffUpdateManager: Git state watcher registered');
		} catch (error) {
			logWarning(`DiffUpdateManager: Failed to setup git state watcher: ${error}`);
			// Continue without git state watching - document changes still work
		}
	}

	/**
	 * Set up file system watcher (AC6)
	 * Monitors external file changes
	 */
	private setupFileSystemWatcher(): void {
		try {
			// Create watcher for the specific tracked file
			const fileUri = vscode.Uri.file(this.filePath);
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);

			if (!workspaceFolder) {
				logWarning('DiffUpdateManager: No workspace folder found for file');
				return;
			}

			// Use relative pattern for the specific file
			const relativePath = vscode.workspace.asRelativePath(fileUri);
			const pattern = new vscode.RelativePattern(workspaceFolder, relativePath);

			this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(pattern);

			// Handle file change (AC6)
			const changeDisposable = this.fileSystemWatcher.onDidChange(() => {
				// Filter out changes that came from internal VS Code edits
				// If we edited within the last 1000ms, assume it's not external
				const timeSinceInternalEdit = Date.now() - this.lastInternalEditTime;
				if (timeSinceInternalEdit < 1000) {
					logDebug('DiffUpdateManager: Ignoring file change (recent internal edit)');
					return;
				}

				logDebug('DiffUpdateManager: External file change detected, scheduling update');
				this.scheduleUpdate();
			});

			// Handle file deletion
			const deleteDisposable = this.fileSystemWatcher.onDidDelete(() => {
				logWarning('DiffUpdateManager: Tracked file deleted');
				this.sendError('The tracked file has been deleted.');
			});

			this.disposables.push(changeDisposable, deleteDisposable);
			this.disposables.push(this.fileSystemWatcher);

			logDebug('DiffUpdateManager: File system watcher registered');
		} catch (error) {
			logWarning(`DiffUpdateManager: Failed to setup file system watcher: ${error}`);
		}
	}

	/**
	 * Schedule a debounced update (AC2)
	 * Coalesces rapid changes into single update
	 */
	private scheduleUpdate(): void {
		// Clear existing timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		// Schedule new update after debounce delay
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			this.recomputeDiff();
		}, DEBOUNCE_DELAY_MS);
	}

	/**
	 * Recompute diff and update webview (AC1, AC3, AC4, AC5, AC6)
	 * Uses existing services pipeline
	 */
	private async recomputeDiff(): Promise<void> {
		logDebug('DiffUpdateManager: Recomputing diff');

		try {
			const gitService = GitService.getInstance();

			// Get fresh HEAD version
			const headVersion = await gitService.getHeadVersion(this.filePath);
			const beforeContent = headVersion ?? '';

			// Get current working version
			// Prefer open document content over file system for accuracy
			const document = vscode.workspace.textDocuments.find(
				doc => doc.uri.fsPath === this.filePath
			);
			const workingVersion = document
				? document.getText()
				: await gitService.getWorkingVersion(this.filePath);

			// Check if files are identical (AC3, AC4 - "no changes" state)
			if (beforeContent === workingVersion) {
				logInfo('DiffUpdateManager: No changes detected after recomputation');
				this.sendNoChanges();
				return;
			}

			// Render markdown
			const renderer = new MarkdownRenderer();
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.filePath));
			const workspaceRoot = workspaceFolder?.uri.fsPath || '';

			const [beforeResult, afterResult] = await Promise.all([
				renderer.render(beforeContent, {
					workspaceRoot,
					markdownFilePath: this.filePath
				}),
				renderer.render(workingVersion, {
					workspaceRoot,
					markdownFilePath: this.filePath
				})
			]);

			if (!beforeResult.success || !afterResult.success) {
				throw new Error('Markdown rendering failed');
			}

			// Compute diff
			const diffComputer = new DiffComputer();
			const diffHighlighter = new DiffHighlighter();

			const beforeText = diffHighlighter.extractTextFromHtml(beforeResult.html);
			const afterText = diffHighlighter.extractTextFromHtml(afterResult.html);

			const diffResult = diffComputer.compute(beforeText, afterText);

			// Apply highlights
			const highlightedResult = diffHighlighter.applyHighlights(
				beforeResult.html,
				afterResult.html,
				diffResult.changes
			);

			// Update ChangeNavigator
			const changeNavigator = new ChangeNavigator(highlightedResult.changeLocations);
			if (this.onChangeNavigatorUpdate) {
				this.onChangeNavigatorUpdate(changeNavigator);
			}

			// Build render result
			const renderResult: RenderResult = {
				beforeHtml: highlightedResult.beforeHtml,
				afterHtml: highlightedResult.afterHtml,
				changes: highlightedResult.changeLocations
			};

			// Send update to webview (AC7 - preserveScroll flag)
			this.sendUpdateDiff(renderResult);

			logInfo(`DiffUpdateManager: Diff recomputed - ${highlightedResult.changeLocations.length} changes`);

		} catch (error) {
			// AC8: Error handling
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logError('DiffUpdateManager: Diff recomputation failed', error as Error);
			this.sendError(`Failed to update diff: ${errorMessage}`);
		}
	}

	/**
	 * Send updateDiff message to webview
	 */
	private sendUpdateDiff(renderResult: RenderResult): void {
		this.webview.postMessage({
			type: 'updateDiff',
			data: renderResult,
			preserveScroll: true
		}).then(
			success => {
				if (!success) {
					logWarning('DiffUpdateManager: Failed to send updateDiff message');
				}
			}
		);
	}

	/**
	 * Send noChanges message to webview (AC3, AC4)
	 */
	private sendNoChanges(): void {
		this.webview.postMessage({
			type: 'noChanges'
		}).then(
			success => {
				if (!success) {
					logWarning('DiffUpdateManager: Failed to send noChanges message');
				}
			}
		);
	}

	/**
	 * Send error message to webview (AC8)
	 */
	private sendError(message: string): void {
		this.webview.postMessage({
			type: 'error',
			message
		}).then(
			success => {
				if (!success) {
					logWarning('DiffUpdateManager: Failed to send error message');
				}
			}
		);
	}

	/**
	 * Dispose all resources (AC9)
	 * Cleans up watchers, timers, and event listeners
	 */
	public dispose(): void {
		logDebug('DiffUpdateManager: Disposing resources');

		// Clear debounce timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Dispose all registered disposables
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];

		// Clear references
		this.gitStateWatcher = null;
		this.fileSystemWatcher = null;

		logInfo('DiffUpdateManager: All resources disposed');
	}
}
