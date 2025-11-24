/**
 * Webview main script - Client-side logic for diff panel
 * Runs in the webview (browser) context
 */

(function () {
	// Acquire VS Code API
	const vscode = acquireVsCodeApi();

	// State management
	let currentState = null;

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

	// Arrow key navigation (for future use in Epic 4)
	window.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowRight' || event.key === 'n') {
			vscode.postMessage({ type: 'nextChange' });
		} else if (event.key === 'ArrowLeft' || event.key === 'p') {
			vscode.postMessage({ type: 'prevChange' });
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
	 */
	function handleNavigateToChange(changeIndex) {
		console.log('[Webview] Navigate to change:', changeIndex);

		// Placeholder for Epic 4: Change Navigation
		// Will scroll to the specific change location
		// For now, just log the request
		console.log('[Webview] Change navigation not yet implemented (Epic 4)');
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
