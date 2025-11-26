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
import { logDebug, logInfo, logError, logPerformance, logPerformanceWarning, logWarning } from '../utils/errorHandler';

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
			vscode.window.showErrorMessage('No active editor found. Open a markdown file first.');
			return;
		}

		const document = editor.document;
		if (document.languageId !== 'markdown') {
			vscode.window.showErrorMessage('This command only works with markdown files.');
			return;
		}

		const filePath = document.uri.fsPath;
		logInfo(`[openPreviewDiff] Processing file: ${filePath}`);

		// **STEP 2: Check if in git repository** (FR37, FR53, Task 2)
		const gitService = GitService.getInstance();
		const isInRepo = await gitService.isInRepository(filePath);

		if (!isInRepo) {
			vscode.window.showErrorMessage(
				'This file is not in a git repository. Preview Diff requires git version control.'
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
				logDebug('[openPreviewDiff] Retrieving HEAD and working versions');

				const gitStart = Date.now();
				const [headVersion, workingVersion] = await Promise.all([
					gitService.getHeadVersion(filePath),
					Promise.resolve(document.getText()) // Get working version from active editor
				]);
				perfMarks.gitRetrieval = Date.now() - gitStart;

				const beforeContent = headVersion ?? ''; // New file: use empty string (FR42)
				logInfo(
					`[openPreviewDiff] Retrieved versions - HEAD: ${beforeContent.length} chars, Working: ${workingVersion.length} chars`
				);

				// **STEP 3.5: Check file size and warn for large files** (FR57, Task 7)
				const MAX_OPTIMAL_SIZE = 100 * 1024; // 100KB
				const fileSize = Buffer.from(workingVersion).length;

				if (fileSize > MAX_OPTIMAL_SIZE) {
					const fileSizeKB = (fileSize / 1024).toFixed(1);
					vscode.window.showWarningMessage(
						`Large file detected (${fileSizeKB} KB). Rendering may take longer than usual.`
					);
					logWarning(`Processing large file: ${fileSizeKB} KB (threshold: ${MAX_OPTIMAL_SIZE / 1024} KB)`);
				}

				// **STEP 4: Check if identical** (FR54, Task 4)
				if (beforeContent === workingVersion) {
					vscode.window.showInformationMessage(
						'No changes detected. The working file is identical to the committed version.'
					);
					return;
				}

				// **STEP 5: Compute diff** (Task 5)
				progress.report({ increment: 20, message: 'Computing diff...' });
				logDebug('[openPreviewDiff] Computing text diff');

				const diffStart = Date.now();
				const diffComputer = new DiffComputer();
				const diffResult = diffComputer.compute(beforeContent, workingVersion);
				perfMarks.diffComputation = Date.now() - diffStart;

				logInfo(
					`[openPreviewDiff] Diff computed - ${diffResult.changeCount} changes (${diffResult.addedLines} added, ${diffResult.removedLines} removed)`
				);

				// **STEP 6: Render markdown** (FR12-FR20, Task 6)
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

				// Check for rendering errors (FR55)
				if (!beforeResult.success) {
					vscode.window.showErrorMessage(
						`Failed to render HEAD version. ${beforeResult.error || 'Unknown error'}`
					);
					return;
				}

				if (!afterResult.success) {
					vscode.window.showErrorMessage(
						`Failed to render working version. ${afterResult.error || 'Unknown error'}`
					);
					return;
				}

				logInfo('[openPreviewDiff] Markdown rendered successfully');

				// **STEP 6.5: Apply diff highlighting** (Epic 3, Story 3.1)
				progress.report({ increment: 10, message: 'Applying diff highlighting...' });
				logDebug('[openPreviewDiff] Applying diff highlighting');

				const highlightStart = Date.now();
				const diffHighlighter = new DiffHighlighter();

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
				// Pass changeNavigator to WebviewManager for Epic 4 navigation commands
				WebviewManager.createDiffPanel(context, renderResult, changeNavigator);
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
		if (error instanceof GitError) {
			// Git-specific error handling (FR59)
			logError('[openPreviewDiff] Git error', error);
			vscode.window.showErrorMessage(
				`Git operation failed: ${error.message}`
			);
		} else if (error instanceof Error) {
			// Generic error
			logError('[openPreviewDiff] Error', error);
			vscode.window.showErrorMessage(
				`Failed to open preview diff: ${error.message}`
			);
		} else {
			// Unknown error
			logError('[openPreviewDiff] Unknown error', new Error(String(error)));
			vscode.window.showErrorMessage(
				'Failed to open preview diff: Unknown error'
			);
		}
	}
}
