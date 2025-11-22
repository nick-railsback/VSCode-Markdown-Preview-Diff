import * as vscode from 'vscode';

export async function openPreviewDiff(): Promise<void> {
	vscode.window.showInformationMessage(
		'Preview Diff command registered (implementation in Epic 2)'
	);
}
