import * as vscode from 'vscode';

export async function prevChange(): Promise<void> {
	vscode.window.showInformationMessage(
		'Previous Change command registered (implementation in Epic 4)'
	);
}
