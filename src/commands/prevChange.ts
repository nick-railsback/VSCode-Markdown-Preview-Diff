import * as vscode from 'vscode';
import { WebviewManager } from '../webview/webviewManager';
import { logDebug, logInfo } from '../utils/errorHandler';

/**
 * Navigate to the previous change in the diff panel
 * Implements AC4 (Navigate to Previous Change via Keyboard) and AC6 (Navigation Wrapping at Beginning)
 */
export async function prevChange(): Promise<void> {
	logDebug('[prevChange] Command invoked');

	// Check if there's an active diff panel (AC11)
	if (!WebviewManager.hasActivePanel()) {
		vscode.window.showInformationMessage('No diff panel open');
		return;
	}

	// Get the ChangeNavigator
	const changeNavigator = WebviewManager.getChangeNavigator();
	if (!changeNavigator) {
		logDebug('[prevChange] No ChangeNavigator available');
		vscode.window.showInformationMessage('No diff panel open');
		return;
	}

	// Check if there are any changes (AC12)
	if (changeNavigator.getTotalChanges() === 0) {
		vscode.window.showInformationMessage('No changes to navigate');
		return;
	}

	// Navigate to previous change (handles wrapping automatically)
	const prevChangeLocation = changeNavigator.goToPrevious();
	if (!prevChangeLocation) {
		return;
	}

	const currentIndex = changeNavigator.getCurrentIndex();
	logInfo(`[prevChange] Navigating to change ${currentIndex + 1} of ${changeNavigator.getTotalChanges()}`);

	// Send message to webview to scroll to the change
	WebviewManager.navigateToChange(currentIndex);
}
