import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration for performance and validation tests
 *
 * Story 5.4: Validate Performance and Reliability Across Platforms
 *
 * These tests are run separately because they:
 * - May take longer to run (performance benchmarks)
 * - Test cross-platform compatibility
 * - Validate resource cleanup and memory management
 */
export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/performance/**/*.test.ts'],
		exclude: ['node_modules', 'out', '.vscode-test'],
		testTimeout: 120000, // 2 minute timeout for performance tests
		hookTimeout: 30000,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				'src/test/**',
				'src/**/*.d.ts'
			]
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
});
