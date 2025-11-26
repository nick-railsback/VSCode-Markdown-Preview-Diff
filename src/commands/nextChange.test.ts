/**
 * Unit tests for nextChange command
 * Tests navigation to next change in diff panel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextChange } from './nextChange';
import { WebviewManager } from '../webview/webviewManager';
import { ChangeNavigator } from '../diff/changeNavigator';
import type { ChangeLocation } from '../types/diff.types';

// Mock vscode
vi.mock('vscode', () => ({
	window: {
		showInformationMessage: vi.fn(),
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
			show: vi.fn(),
			dispose: vi.fn(),
		})),
	},
}));

// Mock WebviewManager
vi.mock('../webview/webviewManager', () => ({
	WebviewManager: {
		hasActivePanel: vi.fn(),
		getChangeNavigator: vi.fn(),
		navigateToChange: vi.fn(),
	},
}));

describe('nextChange command', () => {
	let mockChangeNavigator: ChangeNavigator;
	let changeLocations: ChangeLocation[];
	let vscode: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Create mock change locations
		changeLocations = [
			{ id: 'change-0', beforeOffset: 0, afterOffset: 0 },
			{ id: 'change-1', beforeOffset: 100, afterOffset: 100 },
			{ id: 'change-2', beforeOffset: 200, afterOffset: 200 },
			{ id: 'change-3', beforeOffset: 300, afterOffset: 300 },
			{ id: 'change-4', beforeOffset: 400, afterOffset: 400 },
		];

		// Create actual ChangeNavigator instance
		mockChangeNavigator = new ChangeNavigator(changeLocations);

		// Import vscode mock
		vscode = await import('vscode');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('AC11: Commands Only Active When Panel Open', () => {
		it('should show message when no diff panel is open', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(false);

			await nextChange();

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No diff panel open');
			expect(WebviewManager.navigateToChange).not.toHaveBeenCalled();
		});

		it('should show message when no ChangeNavigator available', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(undefined);

			await nextChange();

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No diff panel open');
			expect(WebviewManager.navigateToChange).not.toHaveBeenCalled();
		});
	});

	describe('AC12: Empty Changes Handling', () => {
		it('should show message when no changes to navigate', async () => {
			const emptyNavigator = new ChangeNavigator([]);
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(emptyNavigator);

			await nextChange();

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to navigate');
			expect(WebviewManager.navigateToChange).not.toHaveBeenCalled();
		});
	});

	describe('AC3: Navigate to Next Change via Keyboard', () => {
		it('should call goToNext() and send navigateToChange message', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			await nextChange();

			// Should navigate to change index 1 (goToNext from 0)
			expect(WebviewManager.navigateToChange).toHaveBeenCalledWith(1);
		});

		it('should increment through changes sequentially', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Navigate through changes
			await nextChange();
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(1);

			await nextChange();
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(2);

			await nextChange();
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(3);
		});
	});

	describe('AC5: Navigation Wrapping at End', () => {
		it('should wrap to first change when at last change', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Navigate to last change (index 4)
			await nextChange(); // 0 -> 1
			await nextChange(); // 1 -> 2
			await nextChange(); // 2 -> 3
			await nextChange(); // 3 -> 4
			await nextChange(); // 4 -> 0 (wrap)

			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(0);
		});

		it('should continue wrapping on subsequent calls', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Go past the end twice
			for (let i = 0; i < 7; i++) {
				await nextChange();
			}

			// After 7 calls from index 0: 1,2,3,4,0,1,2 -> should be at 2
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(2);
		});
	});

	describe('Message format', () => {
		it('should send correct changeIndex to webview', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			await nextChange();

			expect(WebviewManager.navigateToChange).toHaveBeenCalledTimes(1);
			expect(WebviewManager.navigateToChange).toHaveBeenCalledWith(expect.any(Number));
		});
	});
});
