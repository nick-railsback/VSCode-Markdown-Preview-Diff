/**
 * Open Preview Diff Command - Main command handler
 *
 * Orchestrates the complete workflow:
 * 1. Validate file and repository
 * 2. Retrieve HEAD and working versions (parallel)
 * 3. Check if files are identical
 * 4. Compute text diff
 * 5. Render both versions to HTML
 * 6. Create webview panel with side-by-side display
 */

import * as vscode from 'vscode';
import { GitService } from '../git/gitService';
import { MarkdownRenderer } from '../markdown/markdownRenderer';
import { DiffComputer } from '../diff/diffComputer';
import { DiffHighlighter } from '../diff/diffHighlighter';
import { ChangeNavigator } from '../diff/changeNavigator';
import { WebviewManager } from '../webview/webviewManager';
import { RenderResult } from '../types/webview.types';
import { GitError } from '../types/git.types';
import { ConfigurationService } from '../config/extensionConfig';
import { logDebug, logInfo, logError, logPerformance, logPerformanceWarning, logWarning, showError, showInfo, showWarning, handleGitError, logErrorWithContext } from '../utils/errorHandler';

/**
 * Main command handler: Markdown: Open Preview Diff
 * @param context - Extension context passed from activation
 */
export async function openPreviewDiff(context: vscode.ExtensionContext): Promise<void> {
	const perfStart = Date.now();
	const perfMarks: { [key: string]: number } = {};
	logDebug('[openPreviewDiff] Command invoked');

	try {
		// Get active editor and validate
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			showError('No active editor found. Open a markdown file first.');
			return;
		}

		const document = editor.document;
		if (document.languageId !== 'markdown') {
			showError('This command only works with markdown files.');
			return;
		}

		const filePath = document.uri.fsPath;
		logInfo(`[openPreviewDiff] Processing file: ${filePath}`);

		// Check if in git repository
		const gitService = GitService.getInstance();
		const isInRepo = await gitService.isInRepository(filePath);

		if (!isInRepo) {
			showError(
				'This file is not in a git repository. Preview Diff requires git version control.',
				`File: ${filePath}`
			);
			return;
		}

		// Show progress indicator during async operations
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Opening Preview Diff',
				cancellable: false
			},
			async (progress) => {
				// Retrieve file versions in parallel
				progress.report({ increment: 20, message: 'Retrieving file versions...' });

				// Get comparison target from configuration
				const configService = ConfigurationService.getInstance();
				const comparisonTarget = configService.get('defaultComparisonTarget');
				logDebug(`[openPreviewDiff] Retrieving ${comparisonTarget} and working versions`);

				const gitStart = Date.now();
				// Get base version based on comparison target setting
				const baseVersionPromise = comparisonTarget === 'staged'
					? gitService.getStagedVersion(filePath)
					: gitService.getHeadVersion(filePath);

				const [baseVersion, workingVersion] = await Promise.all([
					baseVersionPromise,
					Promise.resolve(document.getText()) // Get working version from active editor
				]);
				perfMarks.gitRetrieval = Date.now() - gitStart;

				const beforeContent = baseVersion ?? ''; // New file: use empty string
				logInfo(
					`[openPreviewDiff] Retrieved versions - ${comparisonTarget}: ${beforeContent.length} chars, Working: ${workingVersion.length} chars`
				);

				// Check file size and warn for large files
				const MAX_OPTIMAL_SIZE = 100 * 1024; // 100KB
				const fileSize = Buffer.from(workingVersion).length;

				if (fileSize > MAX_OPTIMAL_SIZE) {
					const fileSizeKB = (fileSize / 1024).toFixed(1);
					showWarning(
						`Large file detected (${fileSizeKB} KB). Rendering may take longer than usual.`,
						`File: ${filePath}, Size: ${fileSizeKB} KB, Threshold: ${MAX_OPTIMAL_SIZE / 1024} KB`
					);
				}

				// Check if identical
				if (beforeContent === workingVersion) {
					showInfo('No changes detected. The working file is identical to the committed version.');
					return;
				}

				// Render markdown first
				// Note: We render first, then diff the rendered text content
				// This ensures diff positions align with HTML text positions
				progress.report({ increment: 30, message: 'Rendering markdown...' });
				logDebug('[openPreviewDiff] Rendering markdown to HTML');

				const renderStart = Date.now();
				const renderer = new MarkdownRenderer();
				const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '';

				// Render both versions
				const [beforeResult, afterResult] = await Promise.all([
					renderer.render(beforeContent, {
						workspaceRoot,
						markdownFilePath: filePath
					}),
					renderer.render(workingVersion, {
						workspaceRoot,
						markdownFilePath: filePath
					})
				]);
				perfMarks.markdownRendering = Date.now() - renderStart;

				// Check for rendering errors
				if (!beforeResult.success) {
					showError(
						`Failed to render markdown. Check file syntax. ${beforeResult.error || 'Unknown error'}`,
						beforeResult.errorDetails
					);
					return;
				}

				if (!afterResult.success) {
					showError(
						`Failed to render markdown. Check file syntax. ${afterResult.error || 'Unknown error'}`,
						afterResult.errorDetails
					);
					return;
				}

				logInfo('[openPreviewDiff] Markdown rendered successfully');

				// Compute diff on rendered HTML text content
				// Extract text from HTML and diff that - ensures positions align with HTML
				progress.report({ increment: 20, message: 'Computing diff...' });
				logDebug('[openPreviewDiff] Computing text diff on rendered HTML content');

				const diffStart = Date.now();
				const diffComputer = new DiffComputer();
				const diffHighlighter = new DiffHighlighter();

				// Extract text content from rendered HTML for accurate position mapping
				const beforeText = diffHighlighter.extractTextFromHtml(beforeResult.html);
				const afterText = diffHighlighter.extractTextFromHtml(afterResult.html);

				const diffResult = diffComputer.compute(beforeText, afterText);
				perfMarks.diffComputation = Date.now() - diffStart;

				logInfo(
					`[openPreviewDiff] Diff computed - ${diffResult.changeCount} changes (${diffResult.addedLines} added, ${diffResult.removedLines} removed)`
				);

				// Apply diff highlighting
				progress.report({ increment: 10, message: 'Applying diff highlighting...' });
				logDebug('[openPreviewDiff] Applying diff highlighting');

				const highlightStart = Date.now();

				let highlightedResult;
				try {
					highlightedResult = diffHighlighter.applyHighlights(
						beforeResult.html,
						afterResult.html,
						diffResult.changes
					);
					perfMarks.diffHighlighting = Date.now() - highlightStart;

					// Log performance
					logPerformance('diffHighlighting', perfMarks.diffHighlighting);
					if (perfMarks.diffHighlighting > 200) {
						logPerformanceWarning('diffHighlighting', perfMarks.diffHighlighting, 200);
					}

					logInfo(`[openPreviewDiff] Diff highlighting applied - ${highlightedResult.changeLocations.length} change locations tracked`);
				} catch (highlightError) {
					// Graceful degradation
					logError('Diff highlighting failed, showing unhighlighted diff', highlightError as Error);
					highlightedResult = {
						beforeHtml: beforeResult.html,
						afterHtml: afterResult.html,
						changeLocations: []
					};
					perfMarks.diffHighlighting = Date.now() - highlightStart;
				}

				// Initialize ChangeNavigator for navigation commands
				logDebug('[openPreviewDiff] Initializing ChangeNavigator');
				const changeNavigator = new ChangeNavigator(highlightedResult.changeLocations);
				logInfo(`[openPreviewDiff] ChangeNavigator initialized - ${changeNavigator.getTotalChanges()} changes tracked`);

				// Assemble RenderResult
				const renderResult: RenderResult = {
					beforeHtml: highlightedResult.beforeHtml,
					afterHtml: highlightedResult.afterHtml,
					changes: highlightedResult.changeLocations
				};

				// Create webview panel
				progress.report({ increment: 30, message: 'Creating diff view...' });
				logDebug('[openPreviewDiff] Creating webview panel');

				const webviewStart = Date.now();
				WebviewManager.createDiffPanel(context, renderResult, changeNavigator, filePath, comparisonTarget);
				perfMarks.webviewInit = Date.now() - webviewStart;

				// Calculate total time and log all performance metrics
				const total = Date.now() - perfStart;

				logPerformance('gitRetrieval', perfMarks.gitRetrieval);
				logPerformance('diffComputation', perfMarks.diffComputation);
				logPerformance('markdownRendering', perfMarks.markdownRendering);
				logPerformance('webviewInit', perfMarks.webviewInit);
				logPerformance('total', total);

				// Warn if exceeding performance targets
				if (perfMarks.gitRetrieval > 500) {
					logPerformanceWarning('gitRetrieval', perfMarks.gitRetrieval, 500);
				}
				if (perfMarks.diffComputation > 500) {
					logPerformanceWarning('diffComputation', perfMarks.diffComputation, 500);
				}
				if (perfMarks.markdownRendering > 1000) {
					logPerformanceWarning('markdownRendering', perfMarks.markdownRendering, 1000);
				}
				if (perfMarks.webviewInit > 500) {
					logPerformanceWarning('webviewInit', perfMarks.webviewInit, 500);
				}
				if (total > 2000) {
					logPerformanceWarning('total', total, 2000);
				}

				logInfo('[openPreviewDiff] Command completed successfully');
			}
		);
	} catch (error) {
		// Route all errors through centralized errorHandler
		if (error instanceof GitError) {
			handleGitError(error, 'opening preview diff');
		} else if (error instanceof Error) {
			// Generic error via centralized handler
			showError(
				`Failed to open preview diff: ${error.message}`,
				error.stack
			);
		} else {
			// Unknown error
			const unknownError = new Error(String(error));
			showError(
				'Failed to open preview diff: Unknown error',
				unknownError.stack
			);
		}
	}
}
