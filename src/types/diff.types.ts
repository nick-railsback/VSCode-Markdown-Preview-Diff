/**
 * Type definitions for diff computation
 * Supports word-level text diffing with position tracking
 */

/**
 * Type of change in diff computation
 */
export enum ChangeType {
	ADDED = 'added',
	REMOVED = 'removed',
	UNCHANGED = 'unchanged'
}

/**
 * Represents a single change in the diff
 * Includes position tracking for precise location mapping
 */
export interface Change {
	/** Type of change: added, removed, or unchanged */
	type: ChangeType | 'added' | 'removed' | 'unchanged';

	/** The text content of this change */
	value: string;

	/** Starting position in the text (0-indexed) */
	startIndex: number;

	/** Ending position in the text (exclusive) */
	endIndex: number;
}

/**
 * Complete result of diff computation
 * Contains all changes and summary metadata
 */
export interface DiffResult {
	/** Array of all changes (added, removed, unchanged) in sequential order */
	changes: Change[];

	/** Total count of actual changes (added + removed), excludes unchanged */
	changeCount: number;

	/** Number of line regions added (count of newlines in added changes) */
	addedLines: number;

	/** Number of line regions removed (count of newlines in removed changes) */
	removedLines: number;
}
