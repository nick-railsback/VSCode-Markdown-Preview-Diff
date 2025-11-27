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
					const rawDomStart = beforeMap.textToDom[change.startIndex];
					const rawDomEnd = beforeMap.textToDom[change.endIndex];

					// Skip if positions are undefined (out of bounds)
					if (rawDomStart === undefined || rawDomEnd === undefined) {
						changeIdCounter++;
						continue;
					}

					const domStart = rawDomStart + beforeOffset;
					const domEnd = rawDomEnd + beforeOffset;

					// Inject span in beforeHtml
					const spanOpen = `<span class="diff-removed" data-change-id="${changeId}">`;
					const spanClose = `</span>`;

					// Count segments before injection to calculate offset
					const segmentCount = this.findTextSegments(modifiedBeforeHtml, domStart, domEnd).length;

					modifiedBeforeHtml = this.injectSpanAt(
						modifiedBeforeHtml,
						domStart,
						domEnd,
						spanOpen,
						spanClose
					);

					// Update offset based on number of segments wrapped
					beforeOffset += this.calculateInjectionLength(segmentCount, spanOpen, spanClose);

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
					const rawDomStart = afterMap.textToDom[change.startIndex];
					const rawDomEnd = afterMap.textToDom[change.endIndex];

					// Skip if positions are undefined (out of bounds)
					if (rawDomStart === undefined || rawDomEnd === undefined) {
						changeIdCounter++;
						continue;
					}

					const domStart = rawDomStart + afterOffset;
					const domEnd = rawDomEnd + afterOffset;

					// Inject span in afterHtml
					const spanOpen = `<span class="diff-added" data-change-id="${changeId}">`;
					const spanClose = `</span>`;

					// Count segments before injection to calculate offset
					const segmentCount = this.findTextSegments(modifiedAfterHtml, domStart, domEnd).length;

					modifiedAfterHtml = this.injectSpanAt(
						modifiedAfterHtml,
						domStart,
						domEnd,
						spanOpen,
						spanClose
					);

					// Update offset based on number of segments wrapped
					afterOffset += this.calculateInjectionLength(segmentCount, spanOpen, spanClose);

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
	 * Extract plain text from HTML by stripping all tags
	 * Used to get text content for diffing against rendered HTML
	 *
	 * @param html - HTML string to extract text from
	 * @returns Plain text content without HTML tags
	 */
	public extractTextFromHtml(html: string): string {
		let text = '';
		let inTag = false;

		for (let i = 0; i < html.length; i++) {
			const char = html[i];

			if (char === '<') {
				inTag = true;
			} else if (char === '>') {
				inTag = false;
			} else if (!inTag) {
				text += char;
			}
		}

		return text;
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
	 * Inject span at specific DOM positions with tag-boundary awareness
	 * Splits the span into multiple segments to avoid wrapping HTML tags
	 *
	 * @param html - HTML string to modify
	 * @param startPos - DOM start position
	 * @param endPos - DOM end position
	 * @param spanOpen - Opening span tag
	 * @param spanClose - Closing span tag
	 * @returns Object with modified HTML and the total length added
	 *
	 * Instead of wrapping the entire range (which could include
	 * HTML tags), we identify text-only segments and wrap each separately.
	 */
	private injectSpanAt(
		html: string,
		startPos: number,
		endPos: number,
		spanOpen: string,
		spanClose: string
	): string {
		// Find all text segments within the range (between HTML tags)
		const segments = this.findTextSegments(html, startPos, endPos);

		if (segments.length === 0) {
			// No text content to wrap
			return html;
		}

		// Build result by processing segments from end to start
		// (to avoid position shifts affecting earlier segments)
		let result = html;
		for (let i = segments.length - 1; i >= 0; i--) {
			const seg = segments[i];
			const before = result.substring(0, seg.start);
			const content = result.substring(seg.start, seg.end);
			const after = result.substring(seg.end);
			result = before + spanOpen + content + spanClose + after;
		}

		return result;
	}

	/**
	 * Find text-only segments within a DOM position range
	 * Returns array of {start, end} positions that contain only text (no HTML tags)
	 *
	 * @param html - HTML string to analyze
	 * @param startPos - Start position in HTML
	 * @param endPos - End position in HTML
	 * @returns Array of text segment positions
	 */
	private findTextSegments(
		html: string,
		startPos: number,
		endPos: number
	): Array<{ start: number; end: number }> {
		const segments: Array<{ start: number; end: number }> = [];
		let segmentStart: number | null = null;
		let inTag = false;

		// Determine if we're starting inside a tag
		for (let i = 0; i < startPos && i < html.length; i++) {
			if (html[i] === '<') {
				inTag = true;
			} else if (html[i] === '>') {
				inTag = false;
			}
		}

		for (let pos = startPos; pos < endPos && pos < html.length; pos++) {
			const char = html[pos];

			if (char === '<') {
				// Entering a tag - close current segment if any
				if (segmentStart !== null && !inTag) {
					segments.push({ start: segmentStart, end: pos });
					segmentStart = null;
				}
				inTag = true;
			} else if (char === '>') {
				// Exiting a tag
				inTag = false;
			} else if (!inTag) {
				// Text character - start segment if not already in one
				if (segmentStart === null) {
					segmentStart = pos;
				}
			}
		}

		// Close final segment if still open
		if (segmentStart !== null) {
			segments.push({ start: segmentStart, end: endPos });
		}

		return segments;
	}

	/**
	 * Calculate total length added by span injection
	 * Used to track offset adjustments
	 *
	 * @param segmentCount - Number of text segments wrapped
	 * @param spanOpen - Opening span tag
	 * @param spanClose - Closing span tag
	 * @returns Total characters added
	 */
	private calculateInjectionLength(
		segmentCount: number,
		spanOpen: string,
		spanClose: string
	): number {
		return segmentCount * (spanOpen.length + spanClose.length);
	}
}
