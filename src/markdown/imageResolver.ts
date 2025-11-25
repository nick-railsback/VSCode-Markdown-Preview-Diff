/**
 * Image path resolution for markdown images
 *
 * Resolves relative and absolute image paths for webview display.
 * Implements FR16 (images with relative and absolute paths) with security validation.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { validateFilePath } from '../utils/pathValidator';
import { logDebug, logWarning } from '../utils/errorHandler';

/**
 * Resolves image path for webview display
 *
 * Handles:
 * - External URLs (http://, https://) - pass through unchanged
 * - Data URIs (data:) - pass through unchanged
 * - Absolute workspace paths - validate and convert to file:// URI
 * - Relative paths - resolve relative to markdown file directory
 *
 * Security:
 * - Validates paths are within workspace (prevents path traversal)
 * - Uses pathValidator.ts for security checks (NFR-S3)
 *
 * @param imagePath - Image path from markdown (can be relative, absolute, URL, or data URI)
 * @param workspaceRoot - Workspace root path for validation
 * @param markdownFilePath - Absolute path to markdown file (for relative path resolution)
 * @returns Resolved path as file:// URI for webview, or original path if external/data URI
 *
 * @example
 * ```typescript
 * // Relative path
 * resolveImagePath('./logo.png', '/workspace', '/workspace/docs/readme.md')
 * // Returns: 'file:///workspace/docs/logo.png'
 *
 * // External URL
 * resolveImagePath('https://example.com/image.png', '/workspace', '/workspace/readme.md')
 * // Returns: 'https://example.com/image.png'
 * ```
 */
export function resolveImagePath(
	imagePath: string,
	workspaceRoot: string,
	markdownFilePath: string
): string {
	// External URLs - pass through unchanged (FR16)
	if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
		logDebug(`Image is external URL: ${imagePath}`);
		return imagePath;
	}

	// Data URIs - pass through unchanged (base64 images, etc.)
	if (imagePath.startsWith('data:')) {
		logDebug('Image is data URI (base64)');
		return imagePath;
	}

	// Absolute paths - validate and convert to file:// URI
	if (path.isAbsolute(imagePath)) {
		try {
			const validatedPath = validateFilePath(imagePath, workspaceRoot);
			const fileUri = vscode.Uri.file(validatedPath).toString();
			logDebug(`Resolved absolute image path: ${imagePath} -> ${fileUri}`);
			return fileUri;
		} catch (error) {
			// Path validation failed (outside workspace or path traversal)
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			logWarning(`Invalid absolute image path: ${imagePath}. ${errorMsg}`);
			// Return original path - will result in broken image (security boundary enforced)
			return imagePath;
		}
	}

	// Relative paths - resolve relative to markdown file directory (FR16)
	try {
		const markdownDir = path.dirname(markdownFilePath);
		const resolvedPath = path.resolve(markdownDir, imagePath);

		// Validate resolved path is within workspace (security check per NFR-S1)
		const validatedPath = validateFilePath(resolvedPath, workspaceRoot);
		const fileUri = vscode.Uri.file(validatedPath).toString();
		logDebug(`Resolved relative image path: ${imagePath} -> ${fileUri}`);
		return fileUri;
	} catch (error) {
		// Path resolution or validation failed
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		logWarning(`Failed to resolve relative image path: ${imagePath}. ${errorMsg}`);
		// Return original path - will result in broken image (security boundary enforced)
		return imagePath;
	}
}

/**
 * Checks if an image path is a data URI
 *
 * @param imagePath - Image path to check
 * @returns True if data URI, false otherwise
 */
export function isDataUri(imagePath: string): boolean {
	return imagePath.startsWith('data:');
}

/**
 * Checks if an image path is an external URL
 *
 * @param imagePath - Image path to check
 * @returns True if external URL, false otherwise
 */
export function isExternalUrl(imagePath: string): boolean {
	return imagePath.startsWith('http://') || imagePath.startsWith('https://');
}

/**
 * Checks if an image path is relative
 *
 * @param imagePath - Image path to check
 * @returns True if relative path, false otherwise
 */
export function isRelativePath(imagePath: string): boolean {
	return !path.isAbsolute(imagePath) && !isExternalUrl(imagePath) && !isDataUri(imagePath);
}
