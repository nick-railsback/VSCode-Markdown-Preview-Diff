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

/**
 * Location of a change in the DOM for navigation
 * Used by Epic 4 navigation features
 */
export interface ChangeLocation {
	/** Unique identifier for this change (e.g., "change-1", "change-2") */
	id: string;

	/** DOM offset (scrollTop value) for before pane */
	beforeOffset: number;

	/** DOM offset (scrollTop value) for after pane */
	afterOffset: number;

	/** Type of change: 'added' | 'removed' | 'both' (if word changed) */
	type: 'added' | 'removed' | 'both';
}

/**
 * Result of applying diff highlighting to HTML
 * Contains highlighted HTML and change location metadata
 */
export interface HighlightedResult {
	/** HTML with <span class="diff-added"> and <span class="diff-removed"> injected */
	beforeHtml: string;

	/** HTML with <span class="diff-added"> and <span class="diff-removed"> injected */
	afterHtml: string;

	/** Array of change locations for navigation (Epic 4) */
	changeLocations: ChangeLocation[];
}
