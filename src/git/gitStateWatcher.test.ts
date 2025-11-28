/**
 * GitStateWatcher unit tests
 *
 * Story 4.5: Real-Time Diff Updates and Git State Monitoring
 *
 * Tests:
 * - Initialization
 * - Repository matching
 * - State change detection
 * - Resource cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Create mock repository state change handler
let mockStateChangeCallback: (() => void) | null = null;

// Create mock git objects
const createMockRepository = (rootPath: string) => ({
	rootUri: { fsPath: rootPath },
	state: {
		HEAD: {
			name: 'main',
			commit: 'abc123'
		},
		onDidChange: vi.fn((callback: () => void) => {
			mockStateChangeCallback = callback;
			return { dispose: vi.fn() };
		})
	}
});

const mockRepository = createMockRepository('/workspace');

const mockGitAPI = {
	repositories: [mockRepository],
	onDidOpenRepository: vi.fn(() => ({ dispose: vi.fn() }))
};

const mockGitExtension = {
	isActive: true,
	exports: {
		getAPI: vi.fn(() => mockGitAPI)
	},
	activate: vi.fn().mockResolvedValue(undefined)
};

// Mock vscode - must be before importing the module
vi.mock('vscode', () => {
	// Create proper EventEmitter mock that can be instantiated
	class MockEventEmitter {
		private listeners: (() => void)[] = [];

		get event() {
			return (listener: () => void) => {
				this.listeners.push(listener);
				return { dispose: () => {
					const index = this.listeners.indexOf(listener);
					if (index > -1) {
						this.listeners.splice(index, 1);
					}
				}};
			};
		}

		fire() {
			this.listeners.forEach(l => l());
		}

		dispose() {
			this.listeners = [];
		}
	}

	return {
		extensions: {
			getExtension: vi.fn(() => mockGitExtension)
		},
		EventEmitter: MockEventEmitter,
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path }))
		}
	};
});

vi.mock('../utils/errorHandler', () => ({
	logDebug: vi.fn(),
	logInfo: vi.fn(),
	logWarning: vi.fn()
}));

import * as vscode from 'vscode';
import { GitStateWatcher } from './gitStateWatcher';

describe('GitStateWatcher', () => {
	let watcher: GitStateWatcher;

	beforeEach(() => {
		vi.clearAllMocks();
		mockStateChangeCallback = null;

		// Reset mock state
		mockGitExtension.isActive = true;
		mockRepository.rootUri.fsPath = '/workspace';
		mockRepository.state.HEAD = {
			name: 'main',
			commit: 'abc123'
		};
	});

	afterEach(() => {
		watcher?.dispose();
	});

	describe('initialization', () => {
		it('should create watcher successfully', () => {
			watcher = new GitStateWatcher('/workspace/test.md');
			expect(watcher).toBeDefined();
		});

		it('should call git extension getAPI', () => {
			watcher = new GitStateWatcher('/workspace/test.md');
			expect(mockGitExtension.exports.getAPI).toHaveBeenCalledWith(1);
		});

		it('should register state change listener', () => {
			watcher = new GitStateWatcher('/workspace/test.md');
			expect(mockRepository.state.onDidChange).toHaveBeenCalled();
		});

		it('should handle missing git extension gracefully', () => {
			(vscode.extensions.getExtension as Mock).mockReturnValueOnce(undefined);

			watcher = new GitStateWatcher('/workspace/test.md');

			expect(watcher.isActive()).toBe(false);
		});

		it('should activate inactive git extension', () => {
			mockGitExtension.isActive = false;

			watcher = new GitStateWatcher('/workspace/test.md');

			expect(mockGitExtension.activate).toHaveBeenCalled();
		});
	});

	describe('repository matching', () => {
		it('should match repository containing tracked file', () => {
			watcher = new GitStateWatcher('/workspace/subdir/test.md');
			expect(watcher.isActive()).toBe(true);
		});

		it('should not match repository not containing tracked file', () => {
			mockRepository.rootUri.fsPath = '/other-workspace';

			watcher = new GitStateWatcher('/workspace/test.md');

			expect(watcher.isActive()).toBe(false);
		});
	});

	describe('state change events', () => {
		it('should emit onDidChangeState when repository state changes', () => {
			watcher = new GitStateWatcher('/workspace/test.md');

			const eventHandler = vi.fn();
			watcher.onDidChangeState(eventHandler);

			// Simulate state change
			mockStateChangeCallback?.();

			expect(eventHandler).toHaveBeenCalled();
		});

		it('should emit when HEAD commit changes (commit detection)', () => {
			watcher = new GitStateWatcher('/workspace/test.md');

			const eventHandler = vi.fn();
			watcher.onDidChangeState(eventHandler);

			// Simulate commit (same branch, different commit)
			mockRepository.state.HEAD = {
				name: 'main',
				commit: 'def456'
			};
			mockStateChangeCallback?.();

			expect(eventHandler).toHaveBeenCalled();
		});

		it('should emit when branch changes (branch switch detection)', () => {
			watcher = new GitStateWatcher('/workspace/test.md');

			const eventHandler = vi.fn();
			watcher.onDidChangeState(eventHandler);

			// Simulate branch switch
			mockRepository.state.HEAD = {
				name: 'feature-branch',
				commit: 'xyz789'
			};
			mockStateChangeCallback?.();

			expect(eventHandler).toHaveBeenCalled();
		});
	});

	describe('dispose', () => {
		it('should mark watcher as inactive after dispose', () => {
			watcher = new GitStateWatcher('/workspace/test.md');

			expect(watcher.isActive()).toBe(true);

			watcher.dispose();

			expect(watcher.isActive()).toBe(false);
		});
	});

	describe('isActive', () => {
		it('should return true when watcher is attached to repository', () => {
			watcher = new GitStateWatcher('/workspace/test.md');
			expect(watcher.isActive()).toBe(true);
		});

		it('should return false when no repository found', () => {
			mockRepository.rootUri.fsPath = '/other-workspace';

			watcher = new GitStateWatcher('/workspace/test.md');

			expect(watcher.isActive()).toBe(false);
		});
	});
});
