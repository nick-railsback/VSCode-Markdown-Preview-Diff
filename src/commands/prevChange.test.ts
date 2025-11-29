/**
 * Unit tests for prevChange command
 * Tests navigation to previous change in diff panel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prevChange } from './prevChange';
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

describe('prevChange command', () => {
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

	describe('Commands Only Active When Panel Open', () => {
		it('should show message when no diff panel is open', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(false);

			await prevChange();

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No diff panel open');
			expect(WebviewManager.navigateToChange).not.toHaveBeenCalled();
		});

		it('should show message when no ChangeNavigator available', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(undefined);

			await prevChange();

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No diff panel open');
			expect(WebviewManager.navigateToChange).not.toHaveBeenCalled();
		});
	});

	describe('Empty Changes Handling', () => {
		it('should show message when no changes to navigate', async () => {
			const emptyNavigator = new ChangeNavigator([]);
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(emptyNavigator);

			await prevChange();

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No changes to navigate');
			expect(WebviewManager.navigateToChange).not.toHaveBeenCalled();
		});
	});

	describe('Navigate to Previous Change via Keyboard', () => {
		it('should call goToPrevious() and send navigateToChange message', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// First go to index 1 so we can go back
			mockChangeNavigator.goToNext();

			await prevChange();

			// Should navigate back to change index 0
			expect(WebviewManager.navigateToChange).toHaveBeenCalledWith(0);
		});

		it('should decrement through changes sequentially', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Start at index 3
			mockChangeNavigator.goToNext(); // 0 -> 1
			mockChangeNavigator.goToNext(); // 1 -> 2
			mockChangeNavigator.goToNext(); // 2 -> 3

			// Navigate backwards
			await prevChange();
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(2);

			await prevChange();
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(1);

			await prevChange();
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(0);
		});
	});

	describe('Navigation Wrapping at Beginning', () => {
		it('should wrap to last change when at first change', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Start at index 0 and go previous (should wrap to 4)
			await prevChange();

			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(4);
		});

		it('should continue wrapping on subsequent calls', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Go backwards twice from 0
			await prevChange(); // 0 -> 4
			await prevChange(); // 4 -> 3

			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(3);
		});

		it('should wrap multiple times correctly', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			// Go backwards 7 times from index 0
			for (let i = 0; i < 7; i++) {
				await prevChange();
			}

			// After 7 calls from index 0: 4,3,2,1,0,4,3 -> should be at 3
			expect(WebviewManager.navigateToChange).toHaveBeenLastCalledWith(3);
		});
	});

	describe('Message format', () => {
		it('should send correct changeIndex to webview', async () => {
			vi.mocked(WebviewManager.hasActivePanel).mockReturnValue(true);
			vi.mocked(WebviewManager.getChangeNavigator).mockReturnValue(mockChangeNavigator);

			await prevChange();

			expect(WebviewManager.navigateToChange).toHaveBeenCalledTimes(1);
			expect(WebviewManager.navigateToChange).toHaveBeenCalledWith(expect.any(Number));
		});
	});
});
