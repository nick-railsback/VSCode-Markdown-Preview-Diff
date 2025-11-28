/**
 * Resource Cleanup Validation Tests
 *
 * Story 5.4: Validate Performance and Reliability Across Platforms
 * AC5: Resource Cleanup Validation (FR64)
 *
 * These tests validate the cleanup patterns used in the codebase
 * through static analysis rather than runtime mocking.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Resource Cleanup Validation (AC5)', () => {
	describe('WebviewManager Disposal Pattern', () => {
		it('should implement dispose method for panel cleanup', () => {
			const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
			const content = readFileSync(webviewManagerPath, 'utf-8');

			// Should have dispose method
			expect(content).toContain('public static dispose()');

			// Should dispose activePanel
			expect(content).toMatch(/activePanel\.dispose\(\)/);

			// Should clear references
			expect(content).toContain('activePanel = undefined');
		});

		it('should clean up DiffUpdateManager when panel disposes', () => {
			const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
			const content = readFileSync(webviewManagerPath, 'utf-8');

			// Should dispose DiffUpdateManager
			expect(content).toMatch(/diffUpdateManager\.dispose\(\)/);

			// Should clear DiffUpdateManager reference
			expect(content).toContain('diffUpdateManager = undefined');
		});

		it('should handle onDidDispose callback for cleanup', () => {
			const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
			const content = readFileSync(webviewManagerPath, 'utf-8');

			// Should register onDidDispose callback
			expect(content).toContain('panel.onDidDispose');

			// Callback should clear all references
			expect(content).toMatch(/onDidDispose[\s\S]*?activePanel = undefined/);
		});

		it('should set context when panel is disposed', () => {
			const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
			const content = readFileSync(webviewManagerPath, 'utf-8');

			// Should set context to false on disposal
			expect(content).toMatch(/setContext.*panelActive.*false/);
		});
	});

	describe('DiffUpdateManager Disposal Pattern', () => {
		it('should implement dispose method', () => {
			const diffUpdatePath = join(process.cwd(), 'src/webview/diffUpdateManager.ts');
			const content = readFileSync(diffUpdatePath, 'utf-8');

			// Should have public dispose method
			expect(content).toContain('public dispose()');
		});

		it('should clear debounce timer on disposal', () => {
			const diffUpdatePath = join(process.cwd(), 'src/webview/diffUpdateManager.ts');
			const content = readFileSync(diffUpdatePath, 'utf-8');

			// Should clear debounce timer
			expect(content).toContain('clearTimeout(this.debounceTimer)');
			expect(content).toContain('this.debounceTimer = null');
		});

		it('should dispose all registered disposables', () => {
			const diffUpdatePath = join(process.cwd(), 'src/webview/diffUpdateManager.ts');
			const content = readFileSync(diffUpdatePath, 'utf-8');

			// Should iterate and dispose all disposables
			expect(content).toMatch(/for.*disposable.*of.*this\.disposables/);
			expect(content).toMatch(/disposable\.dispose\(\)/);

			// Should clear the array after disposal
			expect(content).toContain('this.disposables = []');
		});

		it('should clear watcher references', () => {
			const diffUpdatePath = join(process.cwd(), 'src/webview/diffUpdateManager.ts');
			const content = readFileSync(diffUpdatePath, 'utf-8');

			// Should clear gitStateWatcher reference
			expect(content).toContain('this.gitStateWatcher = null');

			// Should clear fileSystemWatcher reference
			expect(content).toContain('this.fileSystemWatcher = null');
		});
	});

	describe('GitStateWatcher Disposal Pattern', () => {
		it('should implement dispose method', () => {
			const gitWatcherPath = join(process.cwd(), 'src/git/gitStateWatcher.ts');
			const content = readFileSync(gitWatcherPath, 'utf-8');

			// Should have public dispose method
			expect(content).toContain('public dispose()');
		});

		it('should dispose all event listeners', () => {
			const gitWatcherPath = join(process.cwd(), 'src/git/gitStateWatcher.ts');
			const content = readFileSync(gitWatcherPath, 'utf-8');

			// Should dispose all tracked disposables
			expect(content).toMatch(/for.*disposable.*of.*this\.disposables/);

			// Should dispose the event emitter
			expect(content).toContain('_onDidChangeState.dispose()');
		});

		it('should clear repository reference', () => {
			const gitWatcherPath = join(process.cwd(), 'src/git/gitStateWatcher.ts');
			const content = readFileSync(gitWatcherPath, 'utf-8');

			// Should clear repository reference
			expect(content).toContain('this.repository = null');

			// Should set active to false
			expect(content).toContain('this.active = false');
		});
	});

	describe('ConfigurationService Disposal Pattern', () => {
		it('should implement dispose method', () => {
			const configPath = join(process.cwd(), 'src/config/extensionConfig.ts');
			const content = readFileSync(configPath, 'utf-8');

			// Should have public dispose method
			expect(content).toContain('public dispose()');
		});

		it('should dispose configuration change listener', () => {
			const configPath = join(process.cwd(), 'src/config/extensionConfig.ts');
			const content = readFileSync(configPath, 'utf-8');

			// Should dispose config change listener
			expect(content).toMatch(/configChangeDisposable.*\.dispose\(\)/);
		});
	});

	describe('ErrorHandler Disposal Pattern', () => {
		it('should implement dispose method for output channel', () => {
			const errorHandlerPath = join(process.cwd(), 'src/utils/errorHandler.ts');
			const content = readFileSync(errorHandlerPath, 'utf-8');

			// Should have dispose method
			expect(content).toMatch(/export function dispose/);

			// Should dispose output channel
			expect(content).toMatch(/outputChannel.*\.dispose\(\)/);

			// Should set to null after disposal
			expect(content).toContain('outputChannel = null');
		});
	});
});

describe('Extension Subscriptions Pattern (AC5)', () => {
	it('should add disposables to context.subscriptions', () => {
		const extensionPath = join(process.cwd(), 'src/extension.ts');
		const content = readFileSync(extensionPath, 'utf-8');

		// Should push disposables to subscriptions
		expect(content).toContain('context.subscriptions.push');
	});

	it('should register commands as disposables', () => {
		const extensionPath = join(process.cwd(), 'src/extension.ts');
		const content = readFileSync(extensionPath, 'utf-8');

		// Commands should be registered and added to disposables
		expect(content).toContain('vscode.commands.registerCommand');
	});
});

describe('Memory Management Validation (AC5)', () => {
	it('should use retainContextWhenHidden=false for webview', () => {
		const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
		const content = readFileSync(webviewManagerPath, 'utf-8');

		// Should not retain context to save memory
		expect(content).toContain('retainContextWhenHidden: false');
	});

	it('should implement single panel pattern to prevent memory leaks', () => {
		const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
		const content = readFileSync(webviewManagerPath, 'utf-8');

		// Should dispose previous panel before creating new
		expect(content).toMatch(/if.*activePanel[\s\S]*?dispose/);
	});
});

describe('Cleanup Timing Validation (AC5)', () => {
	it('should use synchronous disposal pattern', () => {
		const webviewManagerPath = join(process.cwd(), 'src/webview/webviewManager.ts');
		const content = readFileSync(webviewManagerPath, 'utf-8');

		// Dispose method should be synchronous (no async/await)
		const disposeMatch = content.match(/public static dispose\(\)[^{]*{[^}]*}/);
		if (disposeMatch) {
			expect(disposeMatch[0]).not.toContain('async');
			expect(disposeMatch[0]).not.toContain('await');
		}
	});
});
