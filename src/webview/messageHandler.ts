/**
 * MessageHandler - Handles webview ↔ extension communication
 * Routes messages between extension host and webview
 */

import * as vscode from 'vscode';
import { WebviewMessage, ExtensionMessage, RenderResult, WebviewConfig } from '../types/webview.types';
import { ConfigurationService } from '../config/extensionConfig';
import { logDebug, logInfo, logWarning } from '../utils/errorHandler';

export class MessageHandler {
	private renderResult: RenderResult | undefined;
	private currentConfig: WebviewConfig;

	constructor(private readonly webview: vscode.Webview) {
		// Read initial config from ConfigurationService
		const configService = ConfigurationService.getInstance();
		this.currentConfig = {
			syncScroll: configService.get('syncScroll'),
			highlightStyle: configService.get('highlightStyle'),
		};
	}

	/**
	 * Update configuration and notify webview
	 * @param config - Partial config to update
	 */
	public updateConfig(config: Partial<WebviewConfig>): void {
		// Merge with current config
		this.currentConfig = { ...this.currentConfig, ...config };
		this.sendMessage({
			type: 'updateConfig',
			config: config
		});
		logDebug(`MessageHandler: Updated config - ${JSON.stringify(config)}`);
	}

	/**
	 * Update syncScroll setting and notify webview
	 * @deprecated Use updateConfig instead
	 */
	public updateSyncScroll(enabled: boolean): void {
		this.updateConfig({ syncScroll: enabled });
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
					logDebug(`MessageHandler: Sending initialize with ${this.renderResult.changes.length} changes, config: ${JSON.stringify(this.currentConfig)}`);
					this.sendMessage({
						type: 'initialize',
						data: {
							renderResult: this.renderResult,
							config: this.currentConfig
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
