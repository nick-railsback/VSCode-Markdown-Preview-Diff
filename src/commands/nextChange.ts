import * as vscode from 'vscode';
import { WebviewManager } from '../webview/webviewManager';
import { logDebug, logInfo } from '../utils/errorHandler';

/**
 * Navigate to the next change in the diff panel
 * Implements AC3 (Navigate to Next Change via Keyboard) and AC5 (Navigation Wrapping at End)
 */
export async function nextChange(): Promise<void> {
	logDebug('[nextChange] Command invoked');

	// Check if there's an active diff panel (AC11)
	if (!WebviewManager.hasActivePanel()) {
		vscode.window.showInformationMessage('No diff panel open');
		return;
	}

	// Get the ChangeNavigator
	const changeNavigator = WebviewManager.getChangeNavigator();
	if (!changeNavigator) {
		logDebug('[nextChange] No ChangeNavigator available');
		vscode.window.showInformationMessage('No diff panel open');
		return;
	}

	// Check if there are any changes (AC12)
	if (changeNavigator.getTotalChanges() === 0) {
		vscode.window.showInformationMessage('No changes to navigate');
		return;
	}

	// Navigate to next change (handles wrapping automatically)
	const nextChangeLocation = changeNavigator.goToNext();
	if (!nextChangeLocation) {
		return;
	}

	const currentIndex = changeNavigator.getCurrentIndex();
	logInfo(`[nextChange] Navigating to change ${currentIndex + 1} of ${changeNavigator.getTotalChanges()}`);

	// Send message to webview to scroll to the change
	WebviewManager.navigateToChange(currentIndex);
}
