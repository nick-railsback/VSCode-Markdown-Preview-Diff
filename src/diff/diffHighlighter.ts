/**
 * DiffHighlighter - Apply visual highlighting spans to rendered HTML
 *
 * This module injects <span> elements with diff classes into HTML to provide
 * visual change indicators (green for additions, red for removals) with word-level
 * granularity. It also tracks change locations for navigation (Epic 4).
 *
 * Algorithm:
 * 1. Build text-to-DOM position map (strip HTML tags, track positions)
 * 2. For each Change: map text position to DOM position, inject span
 * 3. Track ChangeLocation for navigation
 * 4. Return HighlightedResult
 *
 * Note: Gutter markers (AC4) deferred to future enhancement - see AC4 deferral justification in story file
 */

import { Change, HighlightedResult, ChangeLocation } from '../types/diff.types';
import { logError } from '../utils/errorHandler';

/**
 * DiffHighlighter class
 * Applies visual highlighting to HTML based on diff changes
 */
export class DiffHighlighter {
	/**
	 * Apply visual highlighting to HTML based on diff changes
	 *
	 * @param beforeHtml - Rendered HTML for "before" version (from MarkdownRenderer)
	 * @param afterHtml - Rendered HTML for "after" version (from MarkdownRenderer)
	 * @param changes - Change array from DiffComputer
	 * @returns HighlightedResult with spans injected and change locations tracked
	 *
	 * Implements AC1-AC15:
	 * - AC1: Added content wrapped in span.diff-added (green)
	 * - AC2: Removed content wrapped in span.diff-removed (red)
	 * - AC3: Word-level granularity preserved
	 * - AC4: Gutter markers (DEFERRED to future enhancement)
	 * - AC13: ChangeLocation tracking
	 * - AC15: Graceful degradation on errors
	 */
	public applyHighlights(
		beforeHtml: string,
		afterHtml: string,
		changes: Change[]
	): HighlightedResult {
		try {
			// AC11: Handle empty changes case - return original HTML unchanged
			if (!changes || changes.length === 0) {
				return {
					beforeHtml,
					afterHtml,
					changeLocations: []
				};
			}

			// Initialize tracking arrays
			const changeLocations: ChangeLocation[] = [];
			let changeIdCounter = 1;

			// Build text-to-DOM position maps for both HTML strings
			const beforeMap = this.buildTextToDomMap(beforeHtml);
			const afterMap = this.buildTextToDomMap(afterHtml);

			// Process changes and inject spans
			let modifiedBeforeHtml = beforeHtml;
			let modifiedAfterHtml = afterHtml;

			// Track offset adjustments as we inject spans (HTML grows)
			let beforeOffset = 0;
			let afterOffset = 0;

			for (const change of changes) {
				const changeId = `change-${changeIdCounter}`;

				if (change.type === 'removed') {
					// Map text position to DOM position in beforeHtml
					const domStart = beforeMap.textToDom[change.startIndex] + beforeOffset;
					const domEnd = beforeMap.textToDom[change.endIndex] + beforeOffset;

					// Inject span in beforeHtml
					const spanOpen = `<span class="diff-removed" data-change-id="${changeId}">`;
					const spanClose = `</span>`;

					modifiedBeforeHtml = this.injectSpanAt(
						modifiedBeforeHtml,
						domStart,
						domEnd,
						spanOpen,
						spanClose
					);

					// Update offset for next injection
					beforeOffset += spanOpen.length + spanClose.length;

					// Track change location
					changeLocations.push({
						id: changeId,
						beforeOffset: domStart,
						afterOffset: 0, // No corresponding position in after pane
						type: 'removed'
					});

					changeIdCounter++;
				} else if (change.type === 'added') {
					// Map text position to DOM position in afterHtml
					const domStart = afterMap.textToDom[change.startIndex] + afterOffset;
					const domEnd = afterMap.textToDom[change.endIndex] + afterOffset;

					// Inject span in afterHtml
					const spanOpen = `<span class="diff-added" data-change-id="${changeId}">`;
					const spanClose = `</span>`;

					modifiedAfterHtml = this.injectSpanAt(
						modifiedAfterHtml,
						domStart,
						domEnd,
						spanOpen,
						spanClose
					);

					// Update offset for next injection
					afterOffset += spanOpen.length + spanClose.length;

					// Track change location
					changeLocations.push({
						id: changeId,
						beforeOffset: 0, // No corresponding position in before pane
						afterOffset: domStart,
						type: 'added'
					});

					changeIdCounter++;
				}
				// Skip 'unchanged' changes - no highlighting needed
			}

			return {
				beforeHtml: modifiedBeforeHtml,
				afterHtml: modifiedAfterHtml,
				changeLocations
			};

		} catch (error) {
			// AC15: Graceful degradation - if highlighting fails, return unhighlighted HTML
			logError('Diff highlighting failed, displaying unhighlighted diff', error as Error);
			return {
				beforeHtml,
				afterHtml,
				changeLocations: []
			};
		}
	}

	/**
	 * Build text-to-DOM position mapping
	 * Strips HTML tags to create plain text, tracking position mappings
	 *
	 * @param html - HTML string to map
	 * @returns Map object with textToDom array (textPos -> domPos)
	 */
	private buildTextToDomMap(html: string): { textToDom: number[] } {
		const textToDom: number[] = [];
		let textPos = 0;
		let inTag = false;

		for (let domPos = 0; domPos < html.length; domPos++) {
			const char = html[domPos];

			if (char === '<') {
				inTag = true;
				continue; // Skip '<' character
			} else if (char === '>') {
				inTag = false;
				continue; // Skip '>' character
			}

			if (!inTag) {
				// Character is visible text, map it
				textToDom[textPos] = domPos;
				textPos++;
			}
		}

		// Add final mapping for end position
		textToDom[textPos] = html.length;

		return { textToDom };
	}

	/**
	 * Inject span at specific DOM positions
	 * Safely inserts opening and closing span tags
	 *
	 * @param html - HTML string to modify
	 * @param startPos - DOM start position
	 * @param endPos - DOM end position
	 * @param spanOpen - Opening span tag
	 * @param spanClose - Closing span tag
	 * @returns Modified HTML with span injected
	 *
	 * Note: Gutter markers (AC4) deferred to future enhancement - see AC4 deferral justification in story file
	 */
	private injectSpanAt(
		html: string,
		startPos: number,
		endPos: number,
		spanOpen: string,
		spanClose: string
	): string {
		const before = html.substring(0, startPos);
		const content = html.substring(startPos, endPos);
		const after = html.substring(endPos);

		return before + spanOpen + content + spanClose + after;
	}
}
