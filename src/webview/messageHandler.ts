/**
 * MessageHandler - Handles webview ↔ extension communication
 * Routes messages between extension host and webview
 */

import * as vscode from 'vscode';
import { WebviewMessage, ExtensionMessage } from '../types/webview.types';
import { logDebug, logInfo, logWarning } from '../utils/errorHandler';

export class MessageHandler {
	constructor(private readonly webview: vscode.Webview) {}

	/**
	 * Handle messages received from webview
	 */
	public handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case 'ready':
				logInfo('MessageHandler: Webview ready');
				// Webview is ready to receive messages
				// Send initialize message if needed
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
