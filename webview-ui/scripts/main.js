/**
 * Webview main script - Client-side logic for diff panel
 * Runs in the webview (browser) context
 */

(function () {
	// Acquire VS Code API
	const vscode = acquireVsCodeApi();

	// State management
	let currentState = null;

	// Change navigation state (Epic 4)
	let changeLocations = [];
	let currentChangeIndex = 0;

	// Scroll sync state (Story 4.3)
	let scrollSyncInitialized = false;

	// Send ready message on load
	window.addEventListener('DOMContentLoaded', () => {
		console.log('[Webview] DOM loaded, sending ready message');
		vscode.postMessage({ type: 'ready' });

		// Hide loading spinner and show content
		// Content is already injected by ContentBuilder
		hideLoadingSpinner();

		// Setup toolbar button click handlers (Story 4.4)
		setupToolbarButtons();
	});

	/**
	 * Setup click handlers for toolbar navigation buttons (Story 4.4)
	 */
	function setupToolbarButtons() {
		const prevButton = document.getElementById('prev-change');
		const nextButton = document.getElementById('next-change');

		if (prevButton) {
			prevButton.addEventListener('click', () => {
				if (!prevButton.disabled) {
					console.log('[Webview] Previous change button clicked');
					vscode.postMessage({ type: 'prevChange' });
				}
			});
		}

		if (nextButton) {
			nextButton.addEventListener('click', () => {
				if (!nextButton.disabled) {
					console.log('[Webview] Next change button clicked');
					vscode.postMessage({ type: 'nextChange' });
				}
			});
		}
	}

	/**
	 * Enable or disable navigation buttons (Story 4.4 - AC8)
	 * @param {boolean} enabled - Whether buttons should be enabled
	 */
	function setButtonsEnabled(enabled) {
		const prevButton = document.getElementById('prev-change');
		const nextButton = document.getElementById('next-change');

		if (prevButton) {
			prevButton.disabled = !enabled;
		}

		if (nextButton) {
			nextButton.disabled = !enabled;
		}

		console.log('[Webview] Buttons enabled:', enabled);
	}

	// Listen for messages from extension
	window.addEventListener('message', (event) => {
		const message = event.data;
		console.log('[Webview] Received message:', message.type);

		switch (message.type) {
			case 'initialize':
				handleInitialize(message.data);
				break;

			case 'updateDiff':
				handleUpdateDiff(message.data, message.preserveScroll);
				break;

			case 'navigateToChange':
				handleNavigateToChange(message.changeIndex);
				break;

			case 'updateConfig':
				handleUpdateConfig(message.config);
				break;

			case 'noChanges':
				handleNoChanges();
				break;

			case 'error':
				handleError(message.message);
				break;

			default:
				console.warn('[Webview] Unknown message type:', message.type);
		}
	});

	// ESC key to close panel (Task 7)
	window.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			console.log('[Webview] ESC key pressed, sending close message');
			vscode.postMessage({ type: 'close' });
			// Note: VS Code handles ESC automatically for webview panels
			// This is a backup mechanism in case custom handling is needed
		}
	});

	// Keyboard navigation for changes (Epic 4)
	// n = next change, p = previous change (when webview is focused)
	window.addEventListener('keydown', (event) => {
		if (event.key === 'p') {
			event.preventDefault();
			console.log('[Webview] Previous change key pressed: p');
			vscode.postMessage({ type: 'prevChange' });
		}
		else if (event.key === 'n') {
			event.preventDefault();
			console.log('[Webview] Next change key pressed: n');
			vscode.postMessage({ type: 'nextChange' });
		}
	});

	/**
	 * Handle initialize message from extension
	 */
	function handleInitialize(data) {
		console.log('[Webview] Initializing with data');

		// Store state
		currentState = data;
		vscode.setState(currentState);

		// Store change locations for navigation (Epic 4)
		if (data.renderResult && data.renderResult.changes) {
			changeLocations = data.renderResult.changes;
			currentChangeIndex = 0;
			console.log(`[Webview] Loaded ${changeLocations.length} change locations`);
			// Initialize change counter and button state (Story 4.4)
			updateChangeCounter(0, changeLocations.length);
			setButtonsEnabled(changeLocations.length > 0);
		} else {
			// No changes - disable buttons (AC8)
			changeLocations = [];
			updateChangeCounter(0, 0);
			setButtonsEnabled(false);
		}

		// Hide loading spinner
		hideLoadingSpinner();

		// Content is already in the HTML (injected by ContentBuilder)
		// Just make sure it's visible
		const diffContainer = document.getElementById('diff-container');
		if (diffContainer) {
			diffContainer.style.display = 'flex';
		}

		// Apply initial highlight style (AC4, Story 5.1)
		applyHighlightStyle(data.config.highlightStyle);

		// Initialize scroll sync from config (AC7, Story 4.3)
		// CRITICAL: Must be called AFTER diffContainer.style.display = 'flex'
		// so that panes have non-zero dimensions for scroll calculations
		initializeScrollSync(data.config);
	}

	/**
	 * Apply highlight style class to diff container (AC4, Story 5.1)
	 * @param {string} style - 'default' or 'high-contrast'
	 */
	function applyHighlightStyle(style) {
		const diffContainer = document.getElementById('diff-container');
		if (!diffContainer) {
			console.warn('[Webview] Cannot apply highlight style: diff container not found');
			return;
		}

		// Remove all highlight style classes
		diffContainer.classList.remove('highlight-style-default', 'highlight-style-high-contrast');

		// Add the appropriate class
		if (style === 'high-contrast') {
			diffContainer.classList.add('highlight-style-high-contrast');
			console.log('[Webview] Applied high-contrast highlight style');
		} else {
			diffContainer.classList.add('highlight-style-default');
			console.log('[Webview] Applied default highlight style');
		}
	}

	/**
	 * Initialize scroll synchronization (Story 4.3)
	 * @param {Object} config - Configuration object with syncScroll setting
	 */
	function initializeScrollSync(config) {
		if (scrollSyncInitialized) {
			console.log('[Webview] Scroll sync already initialized');
			return;
		}

		// Get pane content elements
		const beforePane = document.querySelector('.pane-before .pane-content');
		const afterPane = document.querySelector('.pane-after .pane-content');

		if (!beforePane || !afterPane) {
			console.warn('[Webview] Cannot initialize scroll sync: pane elements not found');
			return;
		}

		// Check if scrollSync module is available (loaded via script tag)
		if (typeof window.scrollSync === 'undefined') {
			console.warn('[Webview] scrollSync module not loaded');
			return;
		}

		// Initialize the scroll sync module
		window.scrollSync.initScrollSync(beforePane, afterPane);

		// Apply initial config setting (AC7)
		const syncScrollEnabled = config && typeof config.syncScroll === 'boolean' ? config.syncScroll : true;
		window.scrollSync.enableSyncScroll(syncScrollEnabled);

		scrollSyncInitialized = true;
		console.log('[Webview] Scroll sync initialized, enabled:', syncScrollEnabled);
	}

	/**
	 * Handle updateConfig message for runtime config changes (AC3, AC4, AC6)
	 * @param {Object} config - Updated configuration
	 */
	function handleUpdateConfig(config) {
		console.log('[Webview] Received config update:', config);

		// Handle syncScroll changes (AC3)
		if (typeof config.syncScroll === 'boolean' && typeof window.scrollSync !== 'undefined') {
			if (config.syncScroll) {
				window.scrollSync.reenableSyncScroll();
			} else {
				window.scrollSync.disableSyncScroll();
			}
			console.log('[Webview] Sync scroll updated:', config.syncScroll);
		}

		// Handle highlightStyle changes (AC4, AC6)
		if (typeof config.highlightStyle === 'string') {
			applyHighlightStyle(config.highlightStyle);
		}
	}

	/**
	 * Handle updateDiff message (refresh content) - Story 4.5
	 * @param {Object} data - Render result with beforeHtml, afterHtml, changes
	 * @param {boolean} preserveScroll - Whether to preserve scroll position (AC7)
	 */
	function handleUpdateDiff(data, preserveScroll) {
		console.log('[Webview] Updating diff content, preserveScroll:', preserveScroll);

		// Capture scroll position before update (AC7)
		let scrollPercentage = 0;
		const beforePane = document.querySelector('.pane-before .pane-content');
		if (preserveScroll && beforePane) {
			const scrollHeight = beforePane.scrollHeight - beforePane.clientHeight;
			scrollPercentage = scrollHeight > 0 ? beforePane.scrollTop / scrollHeight : 0;
		}

		// Update pane content
		const beforeContent = document.getElementById('before-content');
		const afterContent = document.getElementById('after-content');

		if (beforeContent && data.beforeHtml) {
			beforeContent.innerHTML = data.beforeHtml;
		}

		if (afterContent && data.afterHtml) {
			afterContent.innerHTML = data.afterHtml;
		}

		// Update change locations and reset navigation (AC1)
		if (data.changes) {
			changeLocations = data.changes;
			currentChangeIndex = 0;
			updateChangeCounter(0, changeLocations.length);
			setButtonsEnabled(changeLocations.length > 0);
			console.log(`[Webview] Updated ${changeLocations.length} change locations`);
		}

		// Hide "no changes" message if it was showing
		hideNoChangesMessage();

		// Restore scroll position after DOM update (AC7)
		if (preserveScroll && beforePane) {
			requestAnimationFrame(() => {
				const newScrollHeight = beforePane.scrollHeight - beforePane.clientHeight;
				beforePane.scrollTop = scrollPercentage * newScrollHeight;
			});
		}

		// Update state
		currentState = { ...currentState, renderResult: data };
		vscode.setState(currentState);
	}

	/**
	 * Handle noChanges message (Story 4.5, AC3, AC4)
	 * Display "No changes detected" UI when working copy matches HEAD
	 */
	function handleNoChanges() {
		console.log('[Webview] No changes detected');

		// Clear change locations
		changeLocations = [];
		currentChangeIndex = 0;
		updateChangeCounter(0, 0);
		setButtonsEnabled(false);

		// Show "no changes" message in both panes
		showNoChangesMessage();

		// Update state
		currentState = { ...currentState, noChanges: true };
		vscode.setState(currentState);
	}

	/**
	 * Show "No changes detected" message overlay
	 */
	function showNoChangesMessage() {
		// Check if message already exists
		let noChangesDiv = document.getElementById('no-changes-message');

		if (!noChangesDiv) {
			noChangesDiv = document.createElement('div');
			noChangesDiv.id = 'no-changes-message';
			noChangesDiv.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				text-align: center;
				padding: 20px 40px;
				background: var(--vscode-editor-background);
				border: 1px solid var(--vscode-panel-border);
				border-radius: 8px;
				z-index: 100;
				color: var(--vscode-foreground);
			`;
			noChangesDiv.innerHTML = `
				<h3 style="margin: 0 0 10px 0; color: var(--vscode-foreground);">No Changes Detected</h3>
				<p style="margin: 0; color: var(--vscode-descriptionForeground);">
					The working file is identical to the committed version.
				</p>
			`;

			const diffContainer = document.getElementById('diff-container');
			if (diffContainer) {
				diffContainer.style.position = 'relative';
				diffContainer.appendChild(noChangesDiv);
			}
		}

		noChangesDiv.style.display = 'block';
	}

	/**
	 * Hide "No changes detected" message
	 */
	function hideNoChangesMessage() {
		const noChangesDiv = document.getElementById('no-changes-message');
		if (noChangesDiv) {
			noChangesDiv.style.display = 'none';
		}
	}

	/**
	 * Handle navigateToChange message (Epic 4)
	 * Implements AC8 (Webview Message Protocol), AC9 (Current Change Visual Highlighting), AC10 (Scroll Position)
	 */
	function handleNavigateToChange(changeIndex) {
		console.log('[Webview] Navigate to change:', changeIndex);

		if (changeIndex < 0 || changeIndex >= changeLocations.length) {
			console.warn('[Webview] Invalid change index:', changeIndex);
			return;
		}

		// Get the change location
		const change = changeLocations[changeIndex];
		if (!change) {
			console.warn('[Webview] No change found at index:', changeIndex);
			return;
		}

		// Remove previous current change highlighting (AC9)
		document.querySelectorAll('.diff-current').forEach(el => {
			el.classList.remove('diff-current');
		});

		// Find elements with the change ID in both panes
		const changeId = change.id;
		const beforeElements = document.querySelectorAll(`#before-content [data-change-id="${changeId}"]`);
		const afterElements = document.querySelectorAll(`#after-content [data-change-id="${changeId}"]`);

		console.log(`[Webview] Found ${beforeElements.length} before elements, ${afterElements.length} after elements for change ${changeId}`);

		// Add highlighting and scroll to first found element (AC9, AC10)
		let scrollTarget = null;

		beforeElements.forEach(el => {
			el.classList.add('diff-current');
			if (!scrollTarget) scrollTarget = el;
		});

		afterElements.forEach(el => {
			el.classList.add('diff-current');
			if (!scrollTarget) scrollTarget = el;
		});

		// Scroll to the change with smooth animation (AC10)
		if (scrollTarget) {
			scrollTarget.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}

		// Update current change index and counter (AC7)
		currentChangeIndex = changeIndex;
		updateChangeCounter(changeIndex, changeLocations.length);
	}

	/**
	 * Update change counter display (AC7)
	 * @param {number} currentIndex - Current change index (0-based)
	 * @param {number} total - Total number of changes
	 */
	function updateChangeCounter(currentIndex, total) {
		const counter = document.getElementById('change-counter');
		if (counter) {
			if (total > 0) {
				counter.textContent = `Change ${currentIndex + 1} of ${total}`;
			} else {
				counter.textContent = 'No changes';
			}
		}
	}

	/**
	 * Handle error message from extension
	 */
	function handleError(message) {
		console.error('[Webview] Error:', message);

		// Display error in UI
		const loadingDiv = document.getElementById('loading');
		if (loadingDiv) {
			loadingDiv.innerHTML = `
				<div style="color: var(--vscode-errorForeground); padding: 20px;">
					<h3>Error</h3>
					<p>${message}</p>
				</div>
			`;
			loadingDiv.style.display = 'flex';
		}

		// Hide diff container
		const diffContainer = document.getElementById('diff-container');
		if (diffContainer) {
			diffContainer.style.display = 'none';
		}
	}

	/**
	 * Hide loading spinner and show content
	 */
	function hideLoadingSpinner() {
		const loadingDiv = document.getElementById('loading');
		const diffContainer = document.getElementById('diff-container');

		if (loadingDiv) {
			loadingDiv.style.display = 'none';
		}

		if (diffContainer) {
			diffContainer.style.display = 'flex';
		}
	}

	// Restore previous state if available
	const previousState = vscode.getState();
	if (previousState) {
		console.log('[Webview] Restoring previous state');
		currentState = previousState;
	}
})();
