/**
 * Shared VS Code mock for unit tests
 * Provides common mock implementations for VS Code API
 */

import { vi } from 'vitest';

/**
 * Mock EventEmitter class matching vscode.EventEmitter interface
 */
export class MockEventEmitter<T> {
	private listeners: ((data: T) => void)[] = [];

	event = (listener: (data: T) => void) => {
		this.listeners.push(listener);
		return { dispose: () => this.removeListener(listener) };
	};

	fire(data: T) {
		this.listeners.forEach(l => l(data));
	}

	dispose() {
		this.listeners = [];
	}

	private removeListener(listener: (data: T) => void) {
		const index = this.listeners.indexOf(listener);
		if (index > -1) {
			this.listeners.splice(index, 1);
		}
	}
}

/**
 * Creates a standard VS Code mock with all commonly needed APIs
 * @param configOverrides - Optional config value overrides
 */
export function createVscodeMock(configOverrides?: Record<string, any>) {
	const defaultConfig: Record<string, any> = {
		syncScroll: true,
		highlightStyle: 'default',
		defaultComparisonTarget: 'HEAD',
		renderTimeout: 5000,
		...configOverrides,
	};

	return {
		commands: {
			executeCommand: vi.fn(),
			registerCommand: vi.fn(),
		},
		window: {
			createOutputChannel: vi.fn(() => ({
				appendLine: vi.fn(),
				show: vi.fn(),
				dispose: vi.fn(),
			})),
			createWebviewPanel: vi.fn(() => ({
				webview: {
					html: '',
					postMessage: vi.fn().mockResolvedValue(true),
					onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
					asWebviewUri: vi.fn((uri) => uri),
				},
				onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
				dispose: vi.fn(),
				reveal: vi.fn(),
			})),
			showErrorMessage: vi.fn(),
			showInformationMessage: vi.fn(),
			showWarningMessage: vi.fn(),
			activeTextEditor: undefined,
			withProgress: vi.fn((options, callback) => callback({ report: vi.fn() })),
		},
		workspace: {
			workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string, defaultValue: any) => {
					return key in defaultConfig ? defaultConfig[key] : defaultValue;
				}),
			})),
			onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
			getWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: '/workspace' } })),
		},
		Uri: {
			file: vi.fn((path: string) => ({ fsPath: path, scheme: 'file' })),
			joinPath: vi.fn((base: any, ...paths: string[]) => ({
				fsPath: [base.fsPath, ...paths].join('/'),
			})),
		},
		ViewColumn: {
			One: 1,
			Two: 2,
			Three: 3,
		},
		ProgressLocation: {
			Notification: 15,
		},
		EventEmitter: MockEventEmitter,
	};
}
