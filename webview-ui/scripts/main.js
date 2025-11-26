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

	// Send ready message on load
	window.addEventListener('DOMContentLoaded', () => {
		console.log('[Webview] DOM loaded, sending ready message');
		vscode.postMessage({ type: 'ready' });

		// Hide loading spinner and show content
		// Content is already injected by ContentBuilder
		hideLoadingSpinner();
	});

	// Listen for messages from extension
	window.addEventListener('message', (event) => {
		const message = event.data;
		console.log('[Webview] Received message:', message.type);

		switch (message.type) {
			case 'initialize':
				handleInitialize(message.data);
				break;

			case 'updateDiff':
				handleUpdateDiff(message.data);
				break;

			case 'navigateToChange':
				handleNavigateToChange(message.changeIndex);
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
			// Initialize change counter
			updateChangeCounter(0, changeLocations.length);
		}

		// Hide loading spinner
		hideLoadingSpinner();

		// Content is already in the HTML (injected by ContentBuilder)
		// Just make sure it's visible
		const diffContainer = document.getElementById('diff-container');
		if (diffContainer) {
			diffContainer.style.display = 'flex';
		}
	}

	/**
	 * Handle updateDiff message (refresh content)
	 */
	function handleUpdateDiff(data) {
		console.log('[Webview] Updating diff content');

		// Update pane content
		const beforeContent = document.getElementById('before-content');
		const afterContent = document.getElementById('after-content');

		if (beforeContent && data.beforeHtml) {
			beforeContent.innerHTML = data.beforeHtml;
		}

		if (afterContent && data.afterHtml) {
			afterContent.innerHTML = data.afterHtml;
		}

		// Update state
		currentState = { ...currentState, renderResult: data };
		vscode.setState(currentState);
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

	/**
	 * Track scroll events (for synchronized scrolling in Epic 4)
	 */
	const beforePane = document.querySelector('.pane-before .pane-content');
	const afterPane = document.querySelector('.pane-after .pane-content');

	if (beforePane) {
		beforePane.addEventListener('scroll', () => {
			const position = beforePane.scrollTop;
			// For now, just track - Epic 4 will implement sync
			// vscode.postMessage({ type: 'scrolled', position });
		});
	}

	if (afterPane) {
		afterPane.addEventListener('scroll', () => {
			const position = afterPane.scrollTop;
			// For now, just track - Epic 4 will implement sync
			// vscode.postMessage({ type: 'scrolled', position });
		});
	}

	// Restore previous state if available
	const previousState = vscode.getState();
	if (previousState) {
		console.log('[Webview] Restoring previous state');
		currentState = previousState;
	}
})();
