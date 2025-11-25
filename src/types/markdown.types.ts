/**
 * TypeScript type definitions for markdown rendering
 *
 * Provides type safety for MarkdownRenderer, SyntaxHighlighter, and ImageResolver.
 * Per Story 2.2 Task 7 requirements and TypeScript strict mode compliance.
 */

/**
 * Options for markdown rendering
 */
export interface RenderOptions {
	/**
	 * Workspace root path for image resolution
	 * Used to resolve relative image paths and validate workspace boundaries
	 */
	workspaceRoot: string;

	/**
	 * Absolute path to the markdown file being rendered
	 * Used to resolve relative image paths relative to the markdown file's directory
	 */
	markdownFilePath: string;

	/**
	 * Theme for syntax highlighting (future use)
	 * Defaults to 'github' theme matching GitHub's appearance
	 */
	theme?: string;
}

/**
 * Result of markdown rendering
 *
 * Includes both success and failure paths per NFR-R1 (graceful error handling)
 */
export interface RenderResult {
	/**
	 * Whether rendering succeeded
	 */
	success: boolean;

	/**
	 * Rendered HTML output (empty string if error)
	 */
	html: string;

	/**
	 * Error message if rendering failed
	 */
	error?: string;

	/**
	 * Detailed error information for debugging
	 */
	errorDetails?: string;
}

/**
 * Options for syntax highlighting
 */
export interface SyntaxHighlightOptions {
	/**
	 * Language name for highlighting (e.g., 'javascript', 'python')
	 * If undefined, auto-detection will be used
	 */
	language?: string;

	/**
	 * Whether to ignore illegal syntax (fallback to plain text)
	 * Default: true
	 */
	ignoreIllegals?: boolean;
}

/**
 * Options for image path resolution
 */
export interface ImageResolverOptions {
	/**
	 * Workspace root path for boundary validation
	 */
	workspaceRoot: string;

	/**
	 * Absolute path to markdown file (for relative path resolution)
	 */
	markdownFilePath: string;

	/**
	 * Whether to validate paths are within workspace (security check)
	 * Default: true
	 */
	validateWorkspaceBoundary?: boolean;
}

/**
 * Error types specific to markdown rendering
 */
export enum MarkdownErrorType {
	/** Markdown parsing failed (malformed syntax) */
	ParseError = 'ParseError',

	/** Syntax highlighting failed */
	SyntaxHighlightError = 'SyntaxHighlightError',

	/** Image path resolution failed */
	ImageResolutionError = 'ImageResolutionError',

	/** Generic rendering error */
	RenderError = 'RenderError',
}

/**
 * Markdown-specific error class
 *
 * Extends Error with markdown-specific error types
 */
export class MarkdownError extends Error {
	constructor(
		public readonly type: MarkdownErrorType,
		message: string,
		public readonly details?: string
	) {
		super(message);
		this.name = 'MarkdownError';
	}
}
