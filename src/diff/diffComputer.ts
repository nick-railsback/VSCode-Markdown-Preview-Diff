/**
 * Diff computation module
 * Computes word-level differences between two text strings using Myers algorithm
 */

import { diffWords, Change as DiffChange } from 'diff';
import { Change, ChangeType, DiffResult } from '../types/diff.types';

/**
 * Computes word-level differences between two text strings
 * Uses the Myers diff algorithm via the 'diff' library
 *
 * Per ADR-004: Word-level granularity for balanced change detection
 * Configuration: ignoreCase=false, ignoreWhitespace=false for accuracy
 */
export class DiffComputer {
	/**
	 * Compute word-level diff between before and after texts
	 *
	 * @param beforeText - Original text (e.g., HEAD version from git)
	 * @param afterText - Modified text (e.g., working version)
	 * @returns DiffResult with change array and metadata
	 *
	 * @example
	 * ```typescript
	 * const computer = new DiffComputer();
	 * const result = computer.compute('hello world', 'hello universe');
	 * // result.changes: [
	 * //   { type: 'unchanged', value: 'hello ', startIndex: 0, endIndex: 6 },
	 * //   { type: 'removed', value: 'world', startIndex: 6, endIndex: 11 },
	 * //   { type: 'added', value: 'universe', startIndex: 6, endIndex: 14 }
	 * // ]
	 * ```
	 */
	public compute(beforeText: string, afterText: string): DiffResult {
		// Validate and normalize inputs
		if (beforeText === null || beforeText === undefined) {
			beforeText = '';
		}
		if (afterText === null || afterText === undefined) {
			afterText = '';
		}

		try {
			// Configure diffWords for accuracy (per ADR-004 and Epic 2 tech spec)
			// Note: diffWords only supports ignoreCase option
			const diffChanges: DiffChange[] = diffWords(beforeText, afterText, {
				ignoreCase: false
			});

			// Map diff library output to our Change[] format with position tracking
			let position = 0;
			const mappedChanges: Change[] = diffChanges.map((diffChange) => {
				// Determine change type
				const type: ChangeType | 'added' | 'removed' | 'unchanged' = diffChange.added
					? 'added'
					: diffChange.removed
						? 'removed'
						: 'unchanged';

				// Position tracking: startIndex at current position
				const startIndex = position;
				const endIndex = position + diffChange.value.length;

				// Critical: Only increment position for non-removed changes
				// Removed changes don't exist in the "after" text, so position stays same
				if (!diffChange.removed) {
					position += diffChange.value.length;
				}

				return {
					type,
					value: diffChange.value,
					startIndex,
					endIndex
				};
			});

			// Calculate metadata
			const addedChanges = mappedChanges.filter((c) => c.type === 'added');
			const removedChanges = mappedChanges.filter((c) => c.type === 'removed');

			// changeCount: total actual changes (exclude unchanged)
			const changeCount = addedChanges.length + removedChanges.length;

			// addedLines: count newline characters in added changes
			const addedLines = addedChanges.reduce((count, change) => {
				const newlines = (change.value.match(/\n/g) || []).length;
				return count + newlines;
			}, 0);

			// removedLines: count newline characters in removed changes
			const removedLines = removedChanges.reduce((count, change) => {
				const newlines = (change.value.match(/\n/g) || []).length;
				return count + newlines;
			}, 0);

			return {
				changes: mappedChanges,
				changeCount,
				addedLines,
				removedLines
			};
		} catch (error) {
			// Graceful error handling: return empty result on error
			// Per NFR-R1: Don't crash, log for debugging
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('[DiffComputer] Diff computation failed:', errorMessage);

			// Return empty DiffResult
			return {
				changes: [],
				changeCount: 0,
				addedLines: 0,
				removedLines: 0
			};
		}
	}
}
