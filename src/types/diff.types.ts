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
 * Includes position tracking for precise location mapping in BOTH texts
 *
 * Note: Positions are tracked separately because added/removed content
 * causes the texts to diverge. A 'removed' change exists at a position
 * in beforeText but not in afterText, and vice versa for 'added'.
 */
export interface Change {
	/** Type of change: added, removed, or unchanged */
	type: ChangeType | 'added' | 'removed' | 'unchanged';

	/** The text content of this change */
	value: string;

	/** Starting position in the BEFORE text (0-indexed) */
	beforeStartIndex: number;

	/** Ending position in the BEFORE text (exclusive) */
	beforeEndIndex: number;

	/** Starting position in the AFTER text (0-indexed) */
	afterStartIndex: number;

	/** Ending position in the AFTER text (exclusive) */
	afterEndIndex: number;

	/**
	 * @deprecated Use beforeStartIndex instead. Kept for backwards compatibility.
	 * This maps to afterStartIndex for 'added'/'unchanged', beforeStartIndex for 'removed'
	 */
	startIndex: number;

	/**
	 * @deprecated Use beforeEndIndex instead. Kept for backwards compatibility.
	 * This maps to afterEndIndex for 'added'/'unchanged', beforeEndIndex for 'removed'
	 */
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
