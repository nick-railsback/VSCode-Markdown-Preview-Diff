import * as vscode from 'vscode';

export async function nextChange(): Promise<void> {
	vscode.window.showInformationMessage(
		'Next Change command registered (implementation in Epic 4)'
	);
}
