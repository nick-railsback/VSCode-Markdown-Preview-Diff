/**
 * Scroll Synchronization Module
 * Implements synchronized scrolling between before and after panes
 *
 * AC1: Scroll sync from before pane
 * AC2: Scroll sync from after pane
 * AC6: Smooth scrolling with 60fps debouncing
 * AC8: Prevent infinite scroll loops
 */

(function () {
	'use strict';

	// Module state
	let syncScrollEnabled = true;
	let isScrolling = false;
	let beforePane = null;
	let afterPane = null;

	// Debounce timing for ~60fps
	const DEBOUNCE_MS = 16;

	/**
	 * Initialize scroll synchronization between two panes
	 * @param {HTMLElement} beforePaneElement - The before (left) pane content element
	 * @param {HTMLElement} afterPaneElement - The after (right) pane content element
	 */
	function initScrollSync(beforePaneElement, afterPaneElement) {
		if (!beforePaneElement || !afterPaneElement) {
			console.warn('[ScrollSync] Cannot initialize: pane elements not provided');
			return;
		}

		beforePane = beforePaneElement;
		afterPane = afterPaneElement;

		// Create bound handlers for each pane
		const handleBeforeScroll = createScrollHandler(beforePane, afterPane);
		const handleAfterScroll = createScrollHandler(afterPane, beforePane);

		// Store handlers for cleanup
		beforePane._scrollSyncHandler = handleBeforeScroll;
		afterPane._scrollSyncHandler = handleAfterScroll;

		// Attach event listeners
		beforePane.addEventListener('scroll', handleBeforeScroll, { passive: true });
		afterPane.addEventListener('scroll', handleAfterScroll, { passive: true });

		console.log('[ScrollSync] Initialized with syncScrollEnabled:', syncScrollEnabled);
	}

	/**
	 * Create a scroll handler for a source pane that syncs to target pane
	 * @param {HTMLElement} sourcePane - The pane being scrolled by user
	 * @param {HTMLElement} targetPane - The pane to sync scroll position to
	 * @returns {Function} - Event handler function
	 */
	function createScrollHandler(sourcePane, targetPane) {
		return function handleScroll() {
			// Skip if sync is disabled or we're already syncing (AC4, AC8)
			if (!syncScrollEnabled || isScrolling) {
				return;
			}

			// Set flag to prevent infinite loop (AC8)
			isScrolling = true;

			// Calculate scroll percentage (AC1, AC2)
			const scrollableHeight = sourcePane.scrollHeight - sourcePane.clientHeight;

			// Avoid division by zero for non-scrollable content
			if (scrollableHeight <= 0) {
				isScrolling = false;
				return;
			}

			const scrollPercentage = sourcePane.scrollTop / scrollableHeight;

			// Apply to target pane
			const targetScrollableHeight = targetPane.scrollHeight - targetPane.clientHeight;
			const targetScrollTop = scrollPercentage * targetScrollableHeight;

			// Only update if there's a meaningful difference
			if (Math.abs(targetPane.scrollTop - targetScrollTop) > 1) {
				targetPane.scrollTop = targetScrollTop;
			}

			// Reset flag after debounce (AC6 - 60fps targeting)
			setTimeout(function () {
				isScrolling = false;
			}, DEBOUNCE_MS);
		};
	}

	/**
	 * Enable or disable scroll synchronization
	 * @param {boolean} enabled - Whether sync scroll should be enabled
	 */
	function enableSyncScroll(enabled) {
		syncScrollEnabled = enabled;
		console.log('[ScrollSync] Sync scroll enabled:', enabled);
	}

	/**
	 * Check if scroll sync is currently enabled
	 * @returns {boolean} - Whether sync scroll is enabled
	 */
	function isSyncScrollEnabled() {
		return syncScrollEnabled;
	}

	/**
	 * Remove scroll event listeners (for cleanup or disabling)
	 */
	function removeScrollListeners() {
		if (beforePane && beforePane._scrollSyncHandler) {
			beforePane.removeEventListener('scroll', beforePane._scrollSyncHandler);
			delete beforePane._scrollSyncHandler;
		}
		if (afterPane && afterPane._scrollSyncHandler) {
			afterPane.removeEventListener('scroll', afterPane._scrollSyncHandler);
			delete afterPane._scrollSyncHandler;
		}
		console.log('[ScrollSync] Scroll listeners removed');
	}

	/**
	 * Re-add scroll event listeners (for re-enabling)
	 */
	function addScrollListeners() {
		if (!beforePane || !afterPane) {
			console.warn('[ScrollSync] Cannot add listeners: panes not initialized');
			return;
		}

		// Create new handlers if needed
		if (!beforePane._scrollSyncHandler) {
			const handleBeforeScroll = createScrollHandler(beforePane, afterPane);
			const handleAfterScroll = createScrollHandler(afterPane, beforePane);

			beforePane._scrollSyncHandler = handleBeforeScroll;
			afterPane._scrollSyncHandler = handleAfterScroll;

			beforePane.addEventListener('scroll', handleBeforeScroll, { passive: true });
			afterPane.addEventListener('scroll', handleAfterScroll, { passive: true });

			console.log('[ScrollSync] Scroll listeners added');
		}
	}

	/**
	 * Disable scroll synchronization and remove listeners (AC4)
	 */
	function disableSyncScroll() {
		syncScrollEnabled = false;
		removeScrollListeners();
		console.log('[ScrollSync] Sync scroll disabled');
	}

	/**
	 * Re-enable scroll synchronization and add listeners
	 */
	function reenableSyncScroll() {
		syncScrollEnabled = true;
		addScrollListeners();
		console.log('[ScrollSync] Sync scroll re-enabled');
	}

	/**
	 * Clean up all resources
	 */
	function cleanup() {
		removeScrollListeners();
		beforePane = null;
		afterPane = null;
		isScrolling = false;
		console.log('[ScrollSync] Cleaned up');
	}

	// Export to global scope for use by main.js
	window.scrollSync = {
		initScrollSync: initScrollSync,
		enableSyncScroll: enableSyncScroll,
		disableSyncScroll: disableSyncScroll,
		reenableSyncScroll: reenableSyncScroll,
		isSyncScrollEnabled: isSyncScrollEnabled,
		cleanup: cleanup
	};

	console.log('[ScrollSync] Module loaded');
})();
