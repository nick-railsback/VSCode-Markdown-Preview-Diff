import * as vscode from 'vscode';
import { openPreviewDiff } from './commands/openPreviewDiff';
import { nextChange } from './commands/nextChange';
import { prevChange } from './commands/prevChange';
import { logPerformance, logPerformanceWarning } from './utils/errorHandler';

/**
 * Activation timestamp for performance measurement (Story 5.4)
 * Exported for testing purposes
 */
export let activationDurationMs: number | undefined;

export function activate(context: vscode.ExtensionContext) {
	const activationStart = Date.now();
	console.log('markdown-preview-diff extension is now active');

	try {
		// Register commands with context binding (Task 9)
		const disposables = [
			vscode.commands.registerCommand('markdown.openPreviewDiff', () => openPreviewDiff(context)),
			vscode.commands.registerCommand('markdown.previewDiff.nextChange', nextChange),
			vscode.commands.registerCommand('markdown.previewDiff.prevChange', prevChange)
		];

		// Add to subscriptions for cleanup
		context.subscriptions.push(...disposables);

		// Measure activation duration (Story 5.4, AC4, FR63)
		activationDurationMs = Date.now() - activationStart;
		logPerformance('extensionActivation', activationDurationMs);

		// Warn if activation exceeds 500ms threshold
		if (activationDurationMs > 500) {
			logPerformanceWarning('extensionActivation', activationDurationMs, 500);
		}
	} catch (error) {
		console.error('Failed to register commands:', error);
		vscode.window.showErrorMessage('Failed to activate markdown-preview-diff extension');
	}
}

export function deactivate() {
	// Cleanup happens automatically via disposables
}
