import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: ['node_modules', 'out', '.vscode-test', 'src/test/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				'src/test/**',
				'src/**/*.d.ts'
			],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 85,
				statements: 90
			}
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
});
