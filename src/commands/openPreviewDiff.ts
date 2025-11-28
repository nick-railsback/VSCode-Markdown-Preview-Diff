/**
 * Open Preview Diff Command - Main command handler for Epic 2
 *
 * Orchestrates the complete workflow:
 * 1. Validate file and repository
 * 2. Retrieve HEAD and working versions (parallel)
 * 3. Check if files are identical
 * 4. Compute text diff
 * 5. Render both versions to HTML
 * 6. Create webview panel with side-by-side display
 *
 * Implements FR1-FR3, FR53-FR56, FR60-FR64 (command invocation, error handling, performance)
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
 *
 * Implements AC-1 through AC-8 from Epic 2 Tech Spec
 * @param context - Extension context passed from activation
 */
export async function openPreviewDiff(context: vscode.ExtensionContext): Promise<void> {
	const perfStart = Date.now();
	const perfMarks: { [key: string]: number } = {};
	logDebug('[openPreviewDiff] Command invoked');

	try {
		// **STEP 1: Get active editor and validate** (FR5, Task 2)
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

		// **STEP 2: Check if in git repository** (FR37, FR53, Task 2)
		const gitService = GitService.getInstance();
		const isInRepo = await gitService.isInRepository(filePath);

		if (!isInRepo) {
			// AC1 (FR53): Not in git repository error handling via centralized errorHandler
			showError(
				'This file is not in a git repository. Preview Diff requires git version control.',
				`File: ${filePath}`
			);
			return;
		}

		// Show progress indicator during async operations (FR56)
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Opening Preview Diff',
				cancellable: false
			},
			async (progress) => {
				// **STEP 3: Retrieve file versions in parallel** (Task 3, NFR-P5)
				progress.report({ increment: 20, message: 'Retrieving file versions...' });

				// Get comparison target from configuration (AC2, FR43)
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

				const beforeContent = baseVersion ?? ''; // New file: use empty string (FR42)
				logInfo(
					`[openPreviewDiff] Retrieved versions - ${comparisonTarget}: ${beforeContent.length} chars, Working: ${workingVersion.length} chars`
				);

				// **STEP 3.5: Check file size and warn for large files** (FR57, Task 7)
				const MAX_OPTIMAL_SIZE = 100 * 1024; // 100KB
				const fileSize = Buffer.from(workingVersion).length;

				if (fileSize > MAX_OPTIMAL_SIZE) {
					const fileSizeKB = (fileSize / 1024).toFixed(1);
					// AC4: Large file handling via centralized errorHandler
					showWarning(
						`Large file detected (${fileSizeKB} KB). Rendering may take longer than usual.`,
						`File: ${filePath}, Size: ${fileSizeKB} KB, Threshold: ${MAX_OPTIMAL_SIZE / 1024} KB`
					);
				}

				// **STEP 4: Check if identical** (FR54, AC2, Task 4)
				if (beforeContent === workingVersion) {
					// AC2: No changes detected info message via centralized errorHandler
					showInfo('No changes detected. The working file is identical to the committed version.');
					return;
				}

				// **STEP 5: Render markdown FIRST** (FR12-FR20, Task 6)
				// Note: We render first, then diff the rendered text content
				// This ensures diff positions align with HTML text positions (Story 4.2b fix)
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

				// Check for rendering errors (FR55, AC3)
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

				// **STEP 6: Compute diff on rendered HTML text content** (Task 5, Story 4.2b fix)
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

				// **STEP 6.5: Apply diff highlighting** (Epic 3, Story 3.1)
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
					// Graceful degradation (AC15)
					logError('Diff highlighting failed, showing unhighlighted diff', highlightError as Error);
					highlightedResult = {
						beforeHtml: beforeResult.html,
						afterHtml: afterResult.html,
						changeLocations: []
					};
					perfMarks.diffHighlighting = Date.now() - highlightStart;
				}

				// **STEP 6.75: Initialize ChangeNavigator** (Epic 3, Story 3.2)
				// ChangeNavigator tracks change locations for Epic 4 navigation commands
				logDebug('[openPreviewDiff] Initializing ChangeNavigator');
				const changeNavigator = new ChangeNavigator(highlightedResult.changeLocations);
				logInfo(`[openPreviewDiff] ChangeNavigator initialized - ${changeNavigator.getTotalChanges()} changes tracked`);

				// **STEP 7: Assemble RenderResult** (Task 7)
				const renderResult: RenderResult = {
					beforeHtml: highlightedResult.beforeHtml,
					afterHtml: highlightedResult.afterHtml,
					changes: highlightedResult.changeLocations
				};

				// **STEP 8: Create webview panel** (FR6-FR11, Task 8)
				progress.report({ increment: 30, message: 'Creating diff view...' });
				logDebug('[openPreviewDiff] Creating webview panel');

				const webviewStart = Date.now();
				// Pass changeNavigator, filePath, and comparisonTarget to WebviewManager for Epic 4 navigation, Story 4.5 real-time updates, and Story 5.1 config
				WebviewManager.createDiffPanel(context, renderResult, changeNavigator, filePath, comparisonTarget);
				perfMarks.webviewInit = Date.now() - webviewStart;

				// Calculate total time and log all performance metrics
				const total = Date.now() - perfStart;

				logPerformance('gitRetrieval', perfMarks.gitRetrieval);
				logPerformance('diffComputation', perfMarks.diffComputation);
				logPerformance('markdownRendering', perfMarks.markdownRendering);
				logPerformance('webviewInit', perfMarks.webviewInit);
				logPerformance('total', total);

				// Warn if exceeding targets (NFR-O1)
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
		// **Error Handling** (FR53, FR55, FR59, NFR-R1)
		// Story 5.3: Route all errors through centralized errorHandler
		if (error instanceof GitError) {
			// Git-specific error handling via centralized handler (FR53, FR59)
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
