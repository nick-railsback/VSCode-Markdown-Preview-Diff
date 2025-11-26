/**
 * ContentBuilder - Builds HTML content for webview
 * Generates complete HTML with CSP, styles, and pane structure
 */

import * as vscode from 'vscode';
import { RenderResult } from '../types/webview.types';

export class ContentBuilder {
	/**
	 * Build complete HTML for webview
	 * Includes CSP, resource URIs, and rendered content
	 */
	public static buildWebviewHtml(
		webview: vscode.Webview,
		extensionUri: vscode.Uri,
		renderResult: RenderResult
	): string {
		// Get URIs for CSS resources
		const stylesPath = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'styles');
		const githubMarkdownCssUri = webview.asWebviewUri(
			vscode.Uri.joinPath(stylesPath, 'github-markdown.css')
		);
		const layoutCssUri = webview.asWebviewUri(
			vscode.Uri.joinPath(stylesPath, 'layout.css')
		);
		const diffCssUri = webview.asWebviewUri(
			vscode.Uri.joinPath(stylesPath, 'diff.css')
		);

		// Get URI for main script
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(extensionUri, 'webview-ui', 'scripts', 'main.js')
		);

		// Generate nonce for inline scripts (CSP)
		const nonce = this.getNonce();

		// Build HTML
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
	<link rel="stylesheet" href="${githubMarkdownCssUri}">
	<link rel="stylesheet" href="${layoutCssUri}">
	<link rel="stylesheet" href="${diffCssUri}">
	<title>Markdown Preview Diff</title>
</head>
<body>
	<!-- Loading Indicator -->
	<div id="loading" class="loading-indicator">
		<div class="spinner"></div>
		<p>Loading diff...</p>
	</div>

	<!-- Toolbar with change counter (Epic 4) -->
	<div id="toolbar" class="toolbar">
		<span id="change-counter" class="change-counter">${renderResult.changes.length > 0 ? `Change 1 of ${renderResult.changes.length}` : 'No changes'}</span>
	</div>

	<!-- Diff Container (initially hidden) -->
	<div id="diff-container" class="diff-container" style="display: none;">
		<!-- Before Pane (HEAD) -->
		<div class="pane pane-before">
			<div class="pane-header">Before (HEAD)</div>
			<div class="pane-content markdown-body" id="before-content">
				${renderResult.beforeHtml}
			</div>
		</div>

		<!-- After Pane (Working) -->
		<div class="pane pane-after">
			<div class="pane-header">After (Working)</div>
			<div class="pane-content markdown-body" id="after-content">
				${renderResult.afterHtml}
			</div>
		</div>
	</div>

	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	/**
	 * Generate a random nonce for CSP
	 */
	private static getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
