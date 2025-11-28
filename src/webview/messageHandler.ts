/**
 * MessageHandler - Handles webview ↔ extension communication
 * Routes messages between extension host and webview
 */

import * as vscode from 'vscode';
import { WebviewMessage, ExtensionMessage, RenderResult } from '../types/webview.types';
import { logDebug, logInfo, logWarning } from '../utils/errorHandler';

export class MessageHandler {
	private renderResult: RenderResult | undefined;
	private syncScrollEnabled: boolean = true;

	constructor(private readonly webview: vscode.Webview) {
		// Read initial config
		this.syncScrollEnabled = this.getSyncScrollConfig();
	}

	/**
	 * Read syncScroll config from VS Code settings (AC3)
	 */
	private getSyncScrollConfig(): boolean {
		const config = vscode.workspace.getConfiguration('markdownPreviewDiff');
		return config.get<boolean>('syncScroll', true);
	}

	/**
	 * Update syncScroll setting and notify webview (AC4)
	 */
	public updateSyncScroll(enabled: boolean): void {
		this.syncScrollEnabled = enabled;
		this.sendMessage({
			type: 'updateConfig',
			config: { syncScroll: enabled }
		});
		logDebug(`MessageHandler: Updated syncScroll to ${enabled}`);
	}

	/**
	 * Set the render result for initialization
	 * Must be called before webview sends 'ready' message
	 */
	public setRenderResult(renderResult: RenderResult): void {
		this.renderResult = renderResult;
	}

	/**
	 * Handle messages received from webview
	 */
	public handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case 'ready':
				logInfo('MessageHandler: Webview ready');
				// Send initialize message with render result and change locations
				if (this.renderResult) {
					logDebug(`MessageHandler: Sending initialize with ${this.renderResult.changes.length} changes, syncScroll: ${this.syncScrollEnabled}`);
					this.sendMessage({
						type: 'initialize',
						data: {
							renderResult: this.renderResult,
							config: {
								syncScroll: this.syncScrollEnabled,
								highlightStyle: 'default'
							}
						}
					});
				} else {
					logWarning('MessageHandler: No render result available for initialization');
				}
				break;

			case 'nextChange':
				logDebug('MessageHandler: Next change requested');
				vscode.commands.executeCommand('markdown.previewDiff.nextChange');
				break;

			case 'prevChange':
				logDebug('MessageHandler: Previous change requested');
				vscode.commands.executeCommand('markdown.previewDiff.prevChange');
				break;

			case 'scrolled':
				logDebug(`MessageHandler: Webview scrolled to position ${message.position}`);
				// Store scroll position for future use (synchronized scrolling in Epic 4)
				break;

			case 'error':
				logWarning(`MessageHandler: Webview error: ${message.error}`);
				vscode.window.showErrorMessage(`Webview error: ${message.error}`);
				break;

			case 'close':
				logDebug('MessageHandler: Close requested from webview');
				// Panel will be disposed automatically
				break;

			default:
				logWarning(`MessageHandler: Unknown message type: ${JSON.stringify(message)}`);
		}
	}

	/**
	 * Send message to webview
	 */
	public sendMessage(message: ExtensionMessage): void {
		this.webview.postMessage(message).then(
			(success) => {
				if (!success) {
					logWarning('MessageHandler: Failed to send message to webview');
				}
			},
			(error) => {
				logWarning(`MessageHandler: Error sending message: ${error}`);
			}
		);
	}
}
