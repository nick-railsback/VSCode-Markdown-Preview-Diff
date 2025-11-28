/**
 * Type definitions for webview messaging protocol
 * Defines bidirectional communication between extension host and webview
 */

/**
 * Messages sent from extension to webview
 */
export type ExtensionMessage =
	| InitializeMessage
	| UpdateDiffMessage
	| NavigateToChangeMessage
	| UpdateConfigMessage
	| ErrorMessage
	| NoChangesMessage;

export interface InitializeMessage {
	type: 'initialize';
	data: InitializeData;
}

export interface UpdateDiffMessage {
	type: 'updateDiff';
	data: RenderResult;
	/** When true, webview should preserve scroll position (Story 4.5, AC7) */
	preserveScroll?: boolean;
}

export interface NavigateToChangeMessage {
	type: 'navigateToChange';
	changeIndex: number;
}

export interface UpdateConfigMessage {
	type: 'updateConfig';
	config: Partial<WebviewConfig>;
}

export interface ErrorMessage {
	type: 'error';
	message: string;
}

/**
 * Message sent when no changes are detected (Story 4.5, AC3, AC4)
 * Displayed after commit/stash when working copy matches HEAD
 */
export interface NoChangesMessage {
	type: 'noChanges';
}

/**
 * Messages sent from webview to extension
 */
export type WebviewMessage =
	| ReadyMessage
	| NextChangeMessage
	| PrevChangeMessage
	| ScrolledMessage
	| WebviewErrorMessage
	| CloseMessage;

export interface ReadyMessage {
	type: 'ready';
}

export interface NextChangeMessage {
	type: 'nextChange';
}

export interface PrevChangeMessage {
	type: 'prevChange';
}

export interface ScrolledMessage {
	type: 'scrolled';
	position: number;
}

export interface WebviewErrorMessage {
	type: 'error';
	error: string;
}

export interface CloseMessage {
	type: 'close';
}

/**
 * Data passed to webview on initialization
 */
export interface InitializeData {
	renderResult: RenderResult;
	config: WebviewConfig;
}

/**
 * Configuration for webview behavior
 */
export interface WebviewConfig {
	syncScroll: boolean;
	highlightStyle: string;
}

/**
 * Result of rendering markdown diff
 */
export interface RenderResult {
	beforeHtml: string;
	afterHtml: string;
	changes: ChangeLocation[];
}

/**
 * Location of a change in the rendered HTML
 * Used for navigation and highlighting (Epic 4)
 */
export interface ChangeLocation {
	id: string;
	beforeOffset: number;
	afterOffset: number;
}
