/**
 * ConfigurationService - Centralized configuration management
 *
 * Implements Story 5.1: User Configuration Settings
 * Provides typed access to extension settings with change notifications.
 *
 * Follows singleton pattern established by GitService (per architectural patterns).
 */

import * as vscode from 'vscode';
import { logDebug, logInfo } from '../utils/errorHandler';

/**
 * Configuration interface for the extension
 * Maps to package.json contributes.configuration properties
 */
export interface ExtensionConfig {
	/** Version to compare working changes against (FR43) */
	defaultComparisonTarget: 'HEAD' | 'staged';
	/** Enable synchronized scrolling between panes (FR45) */
	syncScroll: boolean;
	/** Color scheme for diff highlighting (FR44) */
	highlightStyle: 'default' | 'high-contrast';
	/** Maximum render time in milliseconds (FR46) */
	renderTimeout: number;
}

/**
 * Configuration defaults matching package.json defaults
 */
const CONFIG_DEFAULTS: ExtensionConfig = {
	defaultComparisonTarget: 'HEAD',
	syncScroll: true,
	highlightStyle: 'default',
	renderTimeout: 5000,
};

/**
 * Configuration section name in VS Code settings
 */
const CONFIG_SECTION = 'markdownPreviewDiff';

/**
 * ConfigurationService class
 *
 * Provides:
 * - Typed configuration access via get<K>(key)
 * - Configuration change events for consumers
 * - Automatic validation and defaults
 *
 * @example
 * ```typescript
 * const config = ConfigurationService.getInstance();
 * const syncScroll = config.get('syncScroll'); // boolean
 * config.onDidChangeConfiguration((newConfig) => {
 *   console.log('Config changed:', newConfig);
 * });
 * ```
 */
export class ConfigurationService implements vscode.Disposable {
	private static instance: ConfigurationService | null = null;
	private cachedConfig: ExtensionConfig;
	private configChangeDisposable: vscode.Disposable | undefined;
	private readonly _onDidChangeConfiguration = new vscode.EventEmitter<ExtensionConfig>();

	/**
	 * Event fired when configuration changes
	 */
	public readonly onDidChangeConfiguration: vscode.Event<ExtensionConfig> =
		this._onDidChangeConfiguration.event;

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {
		this.cachedConfig = this.loadConfiguration();

		// Listen for configuration changes
		this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(CONFIG_SECTION)) {
				logDebug('ConfigurationService: Configuration changed');
				const oldConfig = this.cachedConfig;
				this.cachedConfig = this.loadConfiguration();

				// Log what changed
				this.logConfigChanges(oldConfig, this.cachedConfig);

				// Notify listeners
				this._onDidChangeConfiguration.fire(this.cachedConfig);
			}
		});

		logInfo('ConfigurationService: Initialized');
	}

	/**
	 * Gets the singleton instance of ConfigurationService
	 */
	public static getInstance(): ConfigurationService {
		if (!ConfigurationService.instance) {
			ConfigurationService.instance = new ConfigurationService();
		}
		return ConfigurationService.instance;
	}

	/**
	 * Resets the singleton instance (for testing)
	 */
	public static resetInstance(): void {
		if (ConfigurationService.instance) {
			ConfigurationService.instance.dispose();
			ConfigurationService.instance = null;
		}
	}

	/**
	 * Gets a typed configuration value
	 *
	 * @param key - Configuration key
	 * @returns Typed configuration value
	 */
	public get<K extends keyof ExtensionConfig>(key: K): ExtensionConfig[K] {
		return this.cachedConfig[key];
	}

	/**
	 * Gets all configuration values
	 *
	 * @returns Complete configuration object
	 */
	public getAll(): ExtensionConfig {
		return { ...this.cachedConfig };
	}

	/**
	 * Loads configuration from VS Code settings
	 *
	 * @returns Validated configuration object
	 */
	private loadConfiguration(): ExtensionConfig {
		const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

		// Read each setting with type validation and defaults
		const defaultComparisonTarget = this.validateEnum(
			config.get<string>('defaultComparisonTarget'),
			['HEAD', 'staged'],
			CONFIG_DEFAULTS.defaultComparisonTarget
		) as ExtensionConfig['defaultComparisonTarget'];

		const syncScroll = this.validateBoolean(
			config.get<boolean>('syncScroll'),
			CONFIG_DEFAULTS.syncScroll
		);

		const highlightStyle = this.validateEnum(
			config.get<string>('highlightStyle'),
			['default', 'high-contrast'],
			CONFIG_DEFAULTS.highlightStyle
		) as ExtensionConfig['highlightStyle'];

		const renderTimeout = this.validateNumber(
			config.get<number>('renderTimeout'),
			CONFIG_DEFAULTS.renderTimeout,
			1000,
			10000
		);

		return {
			defaultComparisonTarget,
			syncScroll,
			highlightStyle,
			renderTimeout,
		};
	}

	/**
	 * Validates an enum value
	 */
	private validateEnum<T extends string>(
		value: string | undefined,
		validValues: T[],
		defaultValue: T
	): T {
		if (value !== undefined && validValues.includes(value as T)) {
			return value as T;
		}
		return defaultValue;
	}

	/**
	 * Validates a boolean value
	 */
	private validateBoolean(value: boolean | undefined, defaultValue: boolean): boolean {
		return typeof value === 'boolean' ? value : defaultValue;
	}

	/**
	 * Validates a number value within bounds
	 */
	private validateNumber(
		value: number | undefined,
		defaultValue: number,
		min: number,
		max: number
	): number {
		if (typeof value === 'number' && !isNaN(value)) {
			return Math.max(min, Math.min(max, value));
		}
		return defaultValue;
	}

	/**
	 * Logs configuration changes for debugging
	 */
	private logConfigChanges(oldConfig: ExtensionConfig, newConfig: ExtensionConfig): void {
		const changes: string[] = [];

		if (oldConfig.defaultComparisonTarget !== newConfig.defaultComparisonTarget) {
			changes.push(`defaultComparisonTarget: ${oldConfig.defaultComparisonTarget} → ${newConfig.defaultComparisonTarget}`);
		}
		if (oldConfig.syncScroll !== newConfig.syncScroll) {
			changes.push(`syncScroll: ${oldConfig.syncScroll} → ${newConfig.syncScroll}`);
		}
		if (oldConfig.highlightStyle !== newConfig.highlightStyle) {
			changes.push(`highlightStyle: ${oldConfig.highlightStyle} → ${newConfig.highlightStyle}`);
		}
		if (oldConfig.renderTimeout !== newConfig.renderTimeout) {
			changes.push(`renderTimeout: ${oldConfig.renderTimeout} → ${newConfig.renderTimeout}`);
		}

		if (changes.length > 0) {
			logInfo(`ConfigurationService: Changes - ${changes.join(', ')}`);
		}
	}

	/**
	 * Disposes resources
	 */
	public dispose(): void {
		if (this.configChangeDisposable) {
			this.configChangeDisposable.dispose();
			this.configChangeDisposable = undefined;
		}
		this._onDidChangeConfiguration.dispose();
		logInfo('ConfigurationService: Disposed');
	}
}
