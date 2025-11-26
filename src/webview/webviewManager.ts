/**
 * WebviewManager - Creates and manages webview panel lifecycle
 * Implements single active panel pattern per ADR-009
 */

import * as vscode from 'vscode';
import { RenderResult } from '../types/webview.types';
import { ContentBuilder } from './contentBuilder';
import { MessageHandler } from './messageHandler';
import { ChangeNavigator } from '../diff/changeNavigator';
import { logDebug, logInfo } from '../utils/errorHandler';

export class WebviewManager {
	private static activePanel: vscode.WebviewPanel | undefined;
	private static messageHandler: MessageHandler | undefined;
	private static changeNavigator: ChangeNavigator | undefined;

	/**
	 * Create a new diff panel or reuse existing one
	 * Implements single active panel pattern (ADR-009)
	 * @param context - Extension context
	 * @param renderResult - Rendered diff content
	 * @param changeNavigator - Optional ChangeNavigator for navigation commands
	 */
	public static createDiffPanel(
		context: vscode.ExtensionContext,
		renderResult: RenderResult,
		changeNavigator?: ChangeNavigator
	): void {
		logDebug('WebviewManager: Creating diff panel');

		// Dispose previous panel if exists (single panel pattern)
		if (WebviewManager.activePanel) {
			logInfo('WebviewManager: Disposing previous panel');
			WebviewManager.activePanel.dispose();
			WebviewManager.activePanel = undefined;
			WebviewManager.changeNavigator = undefined;
		}

		// Store change navigator for navigation commands
		WebviewManager.changeNavigator = changeNavigator;

		// Create webview panel
		const panel = vscode.window.createWebviewPanel(
			'markdownPreviewDiff',
			'Markdown Preview Diff: HEAD vs Working',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, 'webview-ui')
				],
				retainContextWhenHidden: false // Don't retain state to save memory
			}
		);

		WebviewManager.activePanel = panel;

		// Set context for command availability (AC11)
		vscode.commands.executeCommand('setContext', 'markdown.previewDiff.panelActive', true);

		// Set HTML content
		panel.webview.html = ContentBuilder.buildWebviewHtml(
			panel.webview,
			context.extensionUri,
			renderResult
		);

		// Set up message handler with render result for initialization
		WebviewManager.messageHandler = new MessageHandler(panel.webview);
		WebviewManager.messageHandler.setRenderResult(renderResult);
		panel.webview.onDidReceiveMessage(
			(message) => WebviewManager.messageHandler!.handleMessage(message),
			undefined,
			context.subscriptions
		);

		// Clean up on disposal
		panel.onDidDispose(
			() => {
				logInfo('WebviewManager: Panel disposed, cleaning up');
				WebviewManager.activePanel = undefined;
				WebviewManager.messageHandler = undefined;
				WebviewManager.changeNavigator = undefined;
				// Clear context for command availability (AC11)
				vscode.commands.executeCommand('setContext', 'markdown.previewDiff.panelActive', false);
			},
			null,
			context.subscriptions
		);

		logInfo('WebviewManager: Panel created successfully');
	}

	/**
	 * Update the diff content in the existing panel
	 */
	public static updateDiff(renderResult: RenderResult): void {
		if (!WebviewManager.activePanel) {
			logDebug('WebviewManager: No active panel to update');
			return;
		}

		if (!WebviewManager.messageHandler) {
			logDebug('WebviewManager: No message handler available');
			return;
		}

		logDebug('WebviewManager: Updating diff content');
		WebviewManager.messageHandler.sendMessage({
			type: 'updateDiff',
			data: renderResult
		});
	}

	/**
	 * Navigate to a specific change
	 */
	public static navigateToChange(changeIndex: number): void {
		if (!WebviewManager.activePanel) {
			logDebug('WebviewManager: No active panel to navigate');
			return;
		}

		if (!WebviewManager.messageHandler) {
			logDebug('WebviewManager: No message handler available');
			return;
		}

		logDebug(`WebviewManager: Navigating to change ${changeIndex}`);
		WebviewManager.messageHandler.sendMessage({
			type: 'navigateToChange',
			changeIndex
		});
	}

	/**
	 * Dispose the active panel
	 */
	public static dispose(): void {
		if (WebviewManager.activePanel) {
			logInfo('WebviewManager: Disposing active panel');
			WebviewManager.activePanel.dispose();
			WebviewManager.activePanel = undefined;
			WebviewManager.messageHandler = undefined;
		}
	}

	/**
	 * Check if there is an active panel
	 */
	public static hasActivePanel(): boolean {
		return WebviewManager.activePanel !== undefined;
	}

	/**
	 * Get the ChangeNavigator for the active panel
	 * Used by navigation commands to navigate between changes
	 */
	public static getChangeNavigator(): ChangeNavigator | undefined {
		return WebviewManager.changeNavigator;
	}
}
