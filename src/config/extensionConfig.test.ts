/**
 * Unit tests for ConfigurationService
 *
 * Story 5.1: User Configuration Settings
 * Tests typed configuration access, validation, and change notifications.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationService, ExtensionConfig } from './extensionConfig';

// Track config change callback
let configChangeCallback: ((e: any) => void) | null = null;

// Mock vscode
vi.mock('vscode', () => {
	// EventEmitter class must be inside the factory function (vi.mock is hoisted)
	class MockEventEmitter<T> {
		private listeners: ((data: T) => void)[] = [];
		event = (listener: (data: T) => void) => {
			this.listeners.push(listener);
			return { dispose: () => {} };
		};
		fire(data: T) {
			this.listeners.forEach(l => l(data));
		}
		dispose() {
			this.listeners = [];
		}
	}

	return {
		workspace: {
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string, defaultValue: any) => {
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return defaultValue;
				}),
			})),
			onDidChangeConfiguration: vi.fn((callback: any) => {
				configChangeCallback = callback;
				return { dispose: vi.fn() };
			}),
		},
		window: {
			createOutputChannel: vi.fn(() => ({
				appendLine: vi.fn(),
				show: vi.fn(),
				dispose: vi.fn(),
			})),
		},
		EventEmitter: MockEventEmitter,
	};
});

describe('ConfigurationService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configChangeCallback = null;
		ConfigurationService.resetInstance();
	});

	afterEach(() => {
		ConfigurationService.resetInstance();
	});

	describe('Singleton pattern', () => {
		it('should return the same instance on multiple calls', () => {
			const instance1 = ConfigurationService.getInstance();
			const instance2 = ConfigurationService.getInstance();

			expect(instance1).toBe(instance2);
		});

		it('should create a new instance after reset', () => {
			const instance1 = ConfigurationService.getInstance();
			ConfigurationService.resetInstance();
			const instance2 = ConfigurationService.getInstance();

			expect(instance1).not.toBe(instance2);
		});
	});

	describe('get() method', () => {
		it('should return syncScroll value (AC3)', () => {
			const config = ConfigurationService.getInstance();

			expect(config.get('syncScroll')).toBe(true);
		});

		it('should return highlightStyle value (AC4)', () => {
			const config = ConfigurationService.getInstance();

			expect(config.get('highlightStyle')).toBe('default');
		});

		it('should return defaultComparisonTarget value (AC1)', () => {
			const config = ConfigurationService.getInstance();

			expect(config.get('defaultComparisonTarget')).toBe('HEAD');
		});

		it('should return renderTimeout value (AC5)', () => {
			const config = ConfigurationService.getInstance();

			expect(config.get('renderTimeout')).toBe(5000);
		});
	});

	describe('getAll() method', () => {
		it('should return complete configuration object', () => {
			const config = ConfigurationService.getInstance();
			const all = config.getAll();

			expect(all).toEqual({
				defaultComparisonTarget: 'HEAD',
				syncScroll: true,
				highlightStyle: 'default',
				renderTimeout: 5000,
			});
		});

		it('should return a copy (not the cached object)', () => {
			const config = ConfigurationService.getInstance();
			const all1 = config.getAll();
			const all2 = config.getAll();

			expect(all1).not.toBe(all2);
			expect(all1).toEqual(all2);
		});
	});

	describe('Configuration validation', () => {
		it('should use default for invalid defaultComparisonTarget', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'defaultComparisonTarget') return 'invalid';
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('defaultComparisonTarget')).toBe('HEAD');
		});

		it('should use default for invalid highlightStyle', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'highlightStyle') return 'invalid';
					if (key === 'syncScroll') return true;
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('highlightStyle')).toBe('default');
		});

		it('should use default for non-boolean syncScroll', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'syncScroll') return 'not-a-boolean';
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('syncScroll')).toBe(true);
		});

		it('should clamp renderTimeout to minimum 1000ms', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'renderTimeout') return 100;
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('renderTimeout')).toBe(1000);
		});

		it('should clamp renderTimeout to maximum 10000ms', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'renderTimeout') return 99999;
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('renderTimeout')).toBe(10000);
		});

		it('should use default for NaN renderTimeout', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'renderTimeout') return NaN;
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('renderTimeout')).toBe(5000);
		});
	});

	describe('Configuration change events (AC6)', () => {
		it('should register listener for configuration changes', async () => {
			const vscode = await import('vscode');
			ConfigurationService.getInstance();

			expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
		});

		it('should fire event when relevant config changes', async () => {
			const vscode = await import('vscode');
			const config = ConfigurationService.getInstance();

			const listener = vi.fn();
			config.onDidChangeConfiguration(listener);

			// Update mock to return new value
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'syncScroll') return false;
					if (key === 'highlightStyle') return 'high-contrast';
					if (key === 'defaultComparisonTarget') return 'staged';
					if (key === 'renderTimeout') return 3000;
					return undefined;
				}),
			});

			// Simulate config change
			configChangeCallback!({
				affectsConfiguration: (section: string) =>
					section === 'markdownPreviewDiff' || section.startsWith('markdownPreviewDiff.'),
			});

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith({
				defaultComparisonTarget: 'staged',
				syncScroll: false,
				highlightStyle: 'high-contrast',
				renderTimeout: 3000,
			});
		});

		it('should not fire event for unrelated config changes', async () => {
			const config = ConfigurationService.getInstance();

			const listener = vi.fn();
			config.onDidChangeConfiguration(listener);

			// Simulate unrelated config change
			configChangeCallback!({
				affectsConfiguration: (section: string) => section === 'some.other.setting',
			});

			expect(listener).not.toHaveBeenCalled();
		});

		it('should update cached config when changes occur', async () => {
			const vscode = await import('vscode');

			// Reset mock to return default values for this test
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			// Get a fresh instance
			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('syncScroll')).toBe(true);

			// Update mock to return new value
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'syncScroll') return false;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			// Simulate config change
			configChangeCallback!({
				affectsConfiguration: (section: string) =>
					section === 'markdownPreviewDiff' || section.startsWith('markdownPreviewDiff.'),
			});

			expect(config.get('syncScroll')).toBe(false);
		});
	});

	describe('Valid configuration values', () => {
		it('should accept staged as defaultComparisonTarget', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'defaultComparisonTarget') return 'staged';
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('defaultComparisonTarget')).toBe('staged');
		});

		it('should accept high-contrast as highlightStyle', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'highlightStyle') return 'high-contrast';
					if (key === 'syncScroll') return true;
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('highlightStyle')).toBe('high-contrast');
		});

		it('should accept false as syncScroll', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'syncScroll') return false;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					if (key === 'renderTimeout') return 5000;
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('syncScroll')).toBe(false);
		});

		it('should accept valid renderTimeout values', async () => {
			const vscode = await import('vscode');
			(vscode.workspace.getConfiguration as any).mockReturnValue({
				get: vi.fn((key: string) => {
					if (key === 'renderTimeout') return 7500;
					if (key === 'syncScroll') return true;
					if (key === 'highlightStyle') return 'default';
					if (key === 'defaultComparisonTarget') return 'HEAD';
					return undefined;
				}),
			});

			ConfigurationService.resetInstance();
			const config = ConfigurationService.getInstance();

			expect(config.get('renderTimeout')).toBe(7500);
		});
	});

	describe('dispose()', () => {
		it('should clean up resources', async () => {
			const config = ConfigurationService.getInstance();
			config.dispose();

			// Should not throw when calling dispose multiple times
			expect(() => config.dispose()).not.toThrow();
		});
	});
});
