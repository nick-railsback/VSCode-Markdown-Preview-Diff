import * as vscode from 'vscode';
import { openPreviewDiff } from './commands/openPreviewDiff';
import { nextChange } from './commands/nextChange';
import { prevChange } from './commands/prevChange';

export function activate(context: vscode.ExtensionContext) {
	console.log('markdown-preview-diff extension is now active');

	try {
		// Register commands
		const disposables = [
			vscode.commands.registerCommand('markdown.openPreviewDiff', openPreviewDiff),
			vscode.commands.registerCommand('markdown.previewDiff.nextChange', nextChange),
			vscode.commands.registerCommand('markdown.previewDiff.prevChange', prevChange)
		];

		// Add to subscriptions for cleanup
		context.subscriptions.push(...disposables);
	} catch (error) {
		console.error('Failed to register commands:', error);
		vscode.window.showErrorMessage('Failed to activate markdown-preview-diff extension');
	}
}

export function deactivate() {
	// Cleanup happens automatically via disposables
}
