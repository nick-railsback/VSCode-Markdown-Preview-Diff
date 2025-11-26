/**
 * Change Navigator
 * Manages navigation state for diff changes with wrap-around support
 * Used by Epic 4 navigation commands (next/previous change)
 */

import { ChangeLocation } from '../types/diff.types.js';

/**
 * ChangeNavigator tracks change locations and provides navigation state management
 * All methods are O(1) constant time for efficient navigation
 */
export class ChangeNavigator {
	/** Array of change locations (immutable, set in constructor) */
	private readonly changeLocations: ReadonlyArray<ChangeLocation>;

	/** Current index in changeLocations array (0-based) */
	private currentChangeIndex: number;

	/**
	 * Construct a new ChangeNavigator
	 * @param changeLocations - Array of change locations from DiffHighlighter
	 */
	constructor(changeLocations: ChangeLocation[]) {
		this.changeLocations = changeLocations;
		this.currentChangeIndex = 0;
	}

	/**
	 * Navigate to next change
	 * Wraps to first change if at end
	 * @returns ChangeLocation for next change, or null if no changes exist
	 */
	public goToNext(): ChangeLocation | null {
		if (this.changeLocations.length === 0) {
			return null;
		}

		this.currentChangeIndex = (this.currentChangeIndex + 1) % this.changeLocations.length;
		return this.changeLocations[this.currentChangeIndex];
	}

	/**
	 * Navigate to previous change
	 * Wraps to last change if at beginning
	 * @returns ChangeLocation for previous change, or null if no changes exist
	 */
	public goToPrevious(): ChangeLocation | null {
		if (this.changeLocations.length === 0) {
			return null;
		}

		this.currentChangeIndex = this.currentChangeIndex === 0
			? this.changeLocations.length - 1
			: this.currentChangeIndex - 1;
		return this.changeLocations[this.currentChangeIndex];
	}

	/**
	 * Get current change being viewed
	 * @returns ChangeLocation at current index, or null if no changes exist
	 */
	public getCurrentChange(): ChangeLocation | null {
		if (this.changeLocations.length === 0) {
			return null;
		}
		return this.changeLocations[this.currentChangeIndex];
	}

	/**
	 * Get current index (0-based)
	 * @returns Current index in changeLocations array
	 */
	public getCurrentIndex(): number {
		return this.currentChangeIndex;
	}

	/**
	 * Get total count of changes
	 * @returns Total number of changes tracked
	 */
	public getTotalChanges(): number {
		return this.changeLocations.length;
	}

	/**
	 * Reset to first change
	 * Sets currentChangeIndex back to 0
	 */
	public reset(): void {
		this.currentChangeIndex = 0;
	}
}
