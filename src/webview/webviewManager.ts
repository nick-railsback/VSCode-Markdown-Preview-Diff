/**
 * WebviewManager - Creates and manages webview panel lifecycle
 * Implements single active panel pattern per ADR-009
 */

import * as vscode from 'vscode';
import { RenderResult } from '../types/webview.types';
import { ContentBuilder } from './contentBuilder';
import { MessageHandler } from './messageHandler';
import { ChangeNavigator } from '../diff/changeNavigator';
import { DiffUpdateManager } from './diffUpdateManager';
import { ConfigurationService } from '../config/extensionConfig';
import { logDebug, logInfo } from '../utils/errorHandler';

export class WebviewManager {
	private static activePanel: vscode.WebviewPanel | undefined;
	private static messageHandler: MessageHandler | undefined;
	private static changeNavigator: ChangeNavigator | undefined;
	private static configChangeDisposable: vscode.Disposable | undefined;
	private static diffUpdateManager: DiffUpdateManager | undefined;
	private static trackedFilePath: string | undefined;

	/**
	 * Create a new diff panel or reuse existing one
	 * Implements single active panel pattern (ADR-009)
	 * @param context - Extension context
	 * @param renderResult - Rendered diff content
	 * @param changeNavigator - Optional ChangeNavigator for navigation commands
	 * @param filePath - Path to tracked file for real-time updates (Story 4.5)
	 * @param comparisonTarget - Comparison target for panel title (Story 5.1, AC2)
	 */
	public static createDiffPanel(
		context: vscode.ExtensionContext,
		renderResult: RenderResult,
		changeNavigator?: ChangeNavigator,
		filePath?: string,
		comparisonTarget: 'HEAD' | 'staged' = 'HEAD'
	): void {
		logDebug('WebviewManager: Creating diff panel');

		// Dispose previous panel if exists (single panel pattern)
		if (WebviewManager.activePanel) {
			logInfo('WebviewManager: Disposing previous panel');
			WebviewManager.activePanel.dispose();
			WebviewManager.activePanel = undefined;
			WebviewManager.changeNavigator = undefined;
		}

		// Dispose previous DiffUpdateManager (Story 4.5, AC9)
		if (WebviewManager.diffUpdateManager) {
			WebviewManager.diffUpdateManager.dispose();
			WebviewManager.diffUpdateManager = undefined;
		}

		// Dispose previous config listener
		if (WebviewManager.configChangeDisposable) {
			WebviewManager.configChangeDisposable.dispose();
			WebviewManager.configChangeDisposable = undefined;
		}

		// Store tracked file path (Story 4.5)
		WebviewManager.trackedFilePath = filePath;

		// Store change navigator for navigation commands
		WebviewManager.changeNavigator = changeNavigator;

		// Create webview panel with dynamic title based on comparison target (AC2)
		const panelTitle = `Markdown Preview Diff: ${comparisonTarget} vs Working`;
		const panel = vscode.window.createWebviewPanel(
			'markdownPreviewDiff',
			panelTitle,
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

		// Listen for configuration changes via ConfigurationService (AC6: runtime config updates)
		const configService = ConfigurationService.getInstance();
		WebviewManager.configChangeDisposable = configService.onDidChangeConfiguration((config) => {
			logDebug(`WebviewManager: Configuration changed - syncScroll: ${config.syncScroll}, highlightStyle: ${config.highlightStyle}`);
			if (WebviewManager.messageHandler) {
				// Send all webview-relevant config updates
				WebviewManager.messageHandler.updateConfig({
					syncScroll: config.syncScroll,
					highlightStyle: config.highlightStyle,
				});
			}
		});
		context.subscriptions.push(WebviewManager.configChangeDisposable);

		// Initialize DiffUpdateManager for real-time updates (Story 4.5)
		if (filePath) {
			WebviewManager.diffUpdateManager = new DiffUpdateManager(
				filePath,
				panel.webview,
				context,
				(navigator) => {
					// Update ChangeNavigator when diff is recomputed
					WebviewManager.changeNavigator = navigator;
				}
			);
			WebviewManager.diffUpdateManager.initialize();
			logInfo('WebviewManager: DiffUpdateManager initialized for real-time updates');
		}

		// Clean up on disposal
		panel.onDidDispose(
			() => {
				logInfo('WebviewManager: Panel disposed, cleaning up');
				WebviewManager.activePanel = undefined;
				WebviewManager.messageHandler = undefined;
				WebviewManager.changeNavigator = undefined;
				WebviewManager.trackedFilePath = undefined;
				// Clean up DiffUpdateManager (Story 4.5, AC9)
				if (WebviewManager.diffUpdateManager) {
					WebviewManager.diffUpdateManager.dispose();
					WebviewManager.diffUpdateManager = undefined;
				}
				// Clean up config change listener
				if (WebviewManager.configChangeDisposable) {
					WebviewManager.configChangeDisposable.dispose();
					WebviewManager.configChangeDisposable = undefined;
				}
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
