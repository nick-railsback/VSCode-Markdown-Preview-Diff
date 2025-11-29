/**
 * Centralized error handling and user messaging
 *
 * Provides actionable error messages to users with graceful error handling
 * and git failure recovery support.
 *
 * Key functions:
 * - showError(message, details?) - Show error to user and log
 * - showWarning(message, details?) - Show warning to user and log
 * - showInfo(message) - Show info to user
 * - logError(error, context) - Log error without showing to user
 */

import * as vscode from 'vscode';
import { GitError, GitErrorType } from '../types/git.types';

/**
 * Output channel for extension logging
 * Created lazily on first use
 */
let outputChannel: vscode.OutputChannel | null = null;

/**
 * Gets or creates the extension's output channel
 * Named "Markdown Preview Diff"
 */
export function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Markdown Preview Diff');
	}
	return outputChannel;
}

/**
 * Handles git errors and displays user-friendly messages
 *
 * Logs detailed error information to output channel for debugging.
 * Displays actionable error messages to users via VS Code UI.
 *
 * @param error - Error to handle (GitError or generic Error)
 * @param context - Context string describing what operation failed (e.g., "retrieving HEAD version")
 */
export function handleGitError(error: Error | GitError, context: string): void {
	const channel = getOutputChannel();

	// Log detailed error to output channel
	channel.appendLine(`[ERROR] ${new Date().toISOString()} - ${context}`);
	channel.appendLine(`Error: ${error.message}`);
	if (error.stack) {
		channel.appendLine(`Stack: ${error.stack}`);
	}

	// Display user-friendly message
	if (error instanceof GitError) {
		const userMessage = getUserFriendlyMessage(error);
		vscode.window.showErrorMessage(userMessage);
	} else {
		// Generic error fallback
		vscode.window.showErrorMessage(
			`Failed to ${context}. See Output panel for details.`,
			'Show Output'
		).then(selection => {
			if (selection === 'Show Output') {
				channel.show();
			}
		});
	}
}

/**
 * Converts GitError to user-friendly message with troubleshooting guidance
 *
 * @param error - GitError to convert
 * @returns User-friendly error message with actionable guidance
 */
function getUserFriendlyMessage(error: GitError): string {
	switch (error.type) {
		case GitErrorType.GitNotInstalled:
			return 'Git is not installed or not in PATH. Please install git and restart VS Code.';

		case GitErrorType.NotInRepository:
			return 'This file is not in a git repository. Preview Diff requires git version control.';

		case GitErrorType.FileNotFound:
			return `File not found: ${error.message}`;

		case GitErrorType.PermissionDenied:
			return 'Permission denied accessing git repository. Check file permissions.';

		case GitErrorType.RepositoryCorrupted:
			return 'Git operation failed: repository may be corrupted. Try running \'git fsck\' to diagnose.';

		case GitErrorType.InvalidPath:
			return `Invalid file path: ${error.message}`;

		case GitErrorType.Unknown:
		default:
			return `Git operation failed: ${error.message}. Check the Output panel for more details.`;
	}
}

/**
 * Logs informational message to output channel
 *
 * @param message - Message to log
 */
export function logInfo(message: string): void {
	const channel = getOutputChannel();
	channel.appendLine(`[INFO] ${new Date().toISOString()} - ${message}`);
}

/**
 * Logs warning message to output channel and optionally shows to user
 *
 * @param message - Warning message
 * @param showToUser - Whether to display warning message to user
 */
export function logWarning(message: string, showToUser: boolean = false): void {
	const channel = getOutputChannel();
	channel.appendLine(`[WARN] ${new Date().toISOString()} - ${message}`);

	if (showToUser) {
		vscode.window.showWarningMessage(message);
	}
}

/**
 * Logs debug message to output channel (only when VS Code log level is debug)
 *
 * @param message - Debug message
 */
export function logDebug(message: string): void {
	// Only log debug messages in development or when explicitly enabled
	if (process.env.NODE_ENV === 'development') {
		const channel = getOutputChannel();
		channel.appendLine(`[DEBUG] ${new Date().toISOString()} - ${message}`);
	}
}

/**
 * Logs error message to output channel with stack trace
 *
 * @param message - Error context message
 * @param error - Error object
 */
export function logError(message: string, error: Error): void {
	const channel = getOutputChannel();
	channel.appendLine(`[ERROR] ${new Date().toISOString()} - ${message}`);
	channel.appendLine(`Error: ${error.message}`);
	if (error.stack) {
		channel.appendLine(`Stack: ${error.stack}`);
	}
}

/**
 * Logs performance metric to output channel
 *
 * @param operation - Operation name (e.g., "gitRetrieval", "diffComputation")
 * @param durationMs - Duration in milliseconds
 */
export function logPerformance(operation: string, durationMs: number): void {
	const channel = getOutputChannel();
	channel.appendLine(`[Performance] ${operation}: ${durationMs.toFixed(2)}ms`);
}

/**
 * Logs performance warning when operation exceeds threshold
 *
 * @param operation - Operation name
 * @param durationMs - Duration in milliseconds
 * @param threshold - Expected threshold in milliseconds
 */
export function logPerformanceWarning(
	operation: string,
	durationMs: number,
	threshold: number
): void {
	const channel = getOutputChannel();
	channel.appendLine(
		`[Performance Warning] ${operation}: ${durationMs.toFixed(2)}ms (threshold: ${threshold}ms)`
	);
}

/**
 * Shows an error message to the user and logs it to output channel.
 * All logged errors include timestamp, context, and details.
 *
 * @param message - User-friendly error message
 * @param details - Optional additional details for logging
 */
export function showError(message: string, details?: string): void {
	const channel = getOutputChannel();
	const timestamp = new Date().toISOString();

	// Log to output channel with timestamp and details
	channel.appendLine(`[ERROR] ${timestamp} - ${message}`);
	if (details) {
		channel.appendLine(`Details: ${details}`);
	}

	// Show to user with optional "Show Output" button
	vscode.window.showErrorMessage(message, 'Show Output').then(selection => {
		if (selection === 'Show Output') {
			channel.show();
		}
	});
}

/**
 * Shows a warning message to the user and logs it to output channel.
 * All logged warnings include timestamp and context.
 *
 * @param message - User-friendly warning message
 * @param details - Optional additional details for logging
 */
export function showWarning(message: string, details?: string): void {
	const channel = getOutputChannel();
	const timestamp = new Date().toISOString();

	// Log to output channel with timestamp and details
	channel.appendLine(`[WARN] ${timestamp} - ${message}`);
	if (details) {
		channel.appendLine(`Details: ${details}`);
	}

	// Show warning to user
	vscode.window.showWarningMessage(message);
}

/**
 * Shows an informational message to the user.
 * Info messages are shown to user but not logged (per typical info message behavior).
 *
 * @param message - Informational message
 */
export function showInfo(message: string): void {
	vscode.window.showInformationMessage(message);
}

/**
 * Logs an error to the output channel without showing to user.
 * All logged errors include timestamp, context, and stack trace.
 *
 * @param error - Error object
 * @param context - Context string describing what operation failed
 */
export function logErrorWithContext(error: Error, context: string): void {
	const channel = getOutputChannel();
	const timestamp = new Date().toISOString();

	channel.appendLine(`[ERROR] ${timestamp} - ${context}`);
	channel.appendLine(`Error: ${error.message}`);
	if (error.stack) {
		channel.appendLine(`Stack: ${error.stack}`);
	}
}

/**
 * Disposes error handler resources
 *
 * Call this when extension is deactivated.
 */
export function dispose(): void {
	if (outputChannel) {
		outputChannel.dispose();
		outputChannel = null;
	}
}
