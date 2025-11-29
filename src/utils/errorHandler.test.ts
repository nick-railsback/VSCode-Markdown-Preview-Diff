/**
 * Error Handler Tests
 *
 * Tests for centralized error handling and performance logging utilities.
 * Validates Task 9 (performance monitoring and logging).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock VS Code API
const mockOutputChannel = {
	appendLine: vi.fn(),
	show: vi.fn(),
	dispose: vi.fn()
};

vi.mock('vscode', () => ({
	window: {
		createOutputChannel: vi.fn(() => mockOutputChannel),
		showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
		showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
		showInformationMessage: vi.fn(() => Promise.resolve(undefined))
	}
}));

// Import after mocking
import {
	logPerformance,
	logPerformanceWarning,
	logInfo,
	logWarning,
	logDebug,
	logError,
	showError,
	showWarning,
	showInfo,
	logErrorWithContext,
	dispose
} from '../../../src/utils/errorHandler';

describe('ErrorHandler - Performance Logging', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('logPerformance()', () => {
		it('should log performance metric with correct format', () => {
			logPerformance('gitRetrieval', 234.56);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance] gitRetrieval: 234.56ms'
			);
		});

		it('should format duration to 2 decimal places', () => {
			logPerformance('diffComputation', 45.123);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance] diffComputation: 45.12ms'
			);
		});

		it('should handle integer durations', () => {
			logPerformance('markdownRendering', 567);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance] markdownRendering: 567.00ms'
			);
		});

		it('should handle very small durations', () => {
			logPerformance('quickOperation', 0.5);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance] quickOperation: 0.50ms'
			);
		});

		it('should execute quickly (overhead < 1ms)', () => {
			const iterations = 1000;
			const start = Date.now();

			for (let i = 0; i < iterations; i++) {
				logPerformance('test', 100);
			}

			const duration = Date.now() - start;
			const avgOverhead = duration / iterations;

			// Average overhead per call should be < 1ms
			expect(avgOverhead).toBeLessThan(1);
		});
	});

	describe('logPerformanceWarning()', () => {
		it('should log performance warning with threshold', () => {
			logPerformanceWarning('gitRetrieval', 750, 500);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance Warning] gitRetrieval: 750.00ms (threshold: 500ms)'
			);
		});

		it('should format both duration and threshold correctly', () => {
			logPerformanceWarning('total', 2345.67, 2000);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance Warning] total: 2345.67ms (threshold: 2000ms)'
			);
		});

		it('should be called when operation exceeds threshold', () => {
			const duration = 1200;
			const threshold = 1000;

			if (duration > threshold) {
				logPerformanceWarning('slowOperation', duration, threshold);
			}

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[Performance Warning]')
			);
		});
	});

	describe('Performance Logging Integration', () => {
		it('should support typical usage pattern from openPreviewDiff', () => {
			const perfMarks = {
				gitRetrieval: 234,
				diffComputation: 45,
				markdownRendering: 567,
				webviewInit: 123
			};
			const total = 969;

			// Log all performance metrics
			logPerformance('gitRetrieval', perfMarks.gitRetrieval);
			logPerformance('diffComputation', perfMarks.diffComputation);
			logPerformance('markdownRendering', perfMarks.markdownRendering);
			logPerformance('webviewInit', perfMarks.webviewInit);
			logPerformance('total', total);

			// Check warnings for exceeded thresholds
			if (perfMarks.gitRetrieval > 500) {
				logPerformanceWarning('gitRetrieval', perfMarks.gitRetrieval, 500);
			}
			if (perfMarks.markdownRendering > 1000) {
				logPerformanceWarning('markdownRendering', perfMarks.markdownRendering, 1000);
			}
			if (total > 2000) {
				logPerformanceWarning('total', total, 2000);
			}

			// Should have logged 5 performance metrics
			expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(5);

			// Verify format
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'[Performance] total: 969.00ms'
			);
		});

		it('should warn when any phase exceeds threshold', () => {
			const scenarios = [
				{ operation: 'gitRetrieval', duration: 600, threshold: 500 },
				{ operation: 'diffComputation', duration: 550, threshold: 500 },
				{ operation: 'markdownRendering', duration: 1100, threshold: 1000 },
				{ operation: 'webviewInit', duration: 520, threshold: 500 },
				{ operation: 'total', duration: 2100, threshold: 2000 }
			];

			scenarios.forEach(({ operation, duration, threshold }) => {
				if (duration > threshold) {
					logPerformanceWarning(operation, duration, threshold);
				}
			});

			// All 5 scenarios exceed threshold, should have 5 warnings
			expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(5);

			// Verify all are warnings
			const calls = mockOutputChannel.appendLine.mock.calls;
			calls.forEach((call: any[]) => {
				expect(call[0]).toContain('[Performance Warning]');
			});
		});
	});

	describe('Other Logging Functions', () => {
		it('should log info messages', () => {
			logInfo('Test info message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[INFO]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test info message')
			);
		});

		it('should log warning messages', () => {
			logWarning('Test warning message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[WARN]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test warning message')
			);
		});

		it('should log error messages with stack trace', () => {
			const error = new Error('Test error');
			logError('Error context', error);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test error')
			);
		});

		it('should log debug messages in development', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			logDebug('Test debug message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[DEBUG]')
			);

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe('Resource Cleanup', () => {
		it('should dispose output channel', () => {
			dispose();

			expect(mockOutputChannel.dispose).toHaveBeenCalled();
		});
	});
});

describe('ErrorHandler - Centralized Error Handler API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('showError()', () => {
		it('should show error message to user via vscode.window.showErrorMessage', async () => {
			const vscode = await import('vscode');

			showError('Test error message');

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				'Test error message',
				'Show Output'
			);
		});

		it('should log error to output channel with timestamp', () => {
			showError('Test error message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test error message')
			);
		});

		it('should log details when provided', () => {
			showError('Test error message', 'Additional error details');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'Details: Additional error details'
			);
		});

		it('should not log details when not provided', () => {
			showError('Test error message');

			const calls = mockOutputChannel.appendLine.mock.calls;
			const detailsCalls = calls.filter((call: any[]) => call[0].startsWith('Details:'));
			expect(detailsCalls.length).toBe(0);
		});
	});

	describe('showWarning()', () => {
		it('should show warning message to user via vscode.window.showWarningMessage', async () => {
			const vscode = await import('vscode');

			showWarning('Test warning message');

			expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Test warning message');
		});

		it('should log warning to output channel with timestamp', () => {
			showWarning('Test warning message');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[WARN]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test warning message')
			);
		});

		it('should log details when provided', () => {
			showWarning('Test warning message', 'Additional warning details');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				'Details: Additional warning details'
			);
		});
	});

	describe('showInfo()', () => {
		it('should show information message to user via vscode.window.showInformationMessage', async () => {
			const vscode = await import('vscode');

			showInfo('Test info message');

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Test info message');
		});

		it('should NOT log to output channel (info messages are not logged)', () => {
			vi.clearAllMocks();
			showInfo('Test info message');

			// showInfo should not call appendLine
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
		});
	});

	describe('logErrorWithContext()', () => {
		it('should log error to output channel without showing to user', async () => {
			const vscode = await import('vscode');
			const error = new Error('Test error');

			logErrorWithContext(error, 'Test context');

			// Should log to output channel
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test context')
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test error')
			);

			// Should NOT show to user
			expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
		});

		it('should include timestamp in log', () => {
			const error = new Error('Test error');

			logErrorWithContext(error, 'Test context');

			const calls = mockOutputChannel.appendLine.mock.calls;
			const errorCall = calls.find((call: any[]) => call[0].includes('[ERROR]'));
			// Timestamp format: ISO string like 2025-11-28T...
			expect(errorCall[0]).toMatch(/\[ERROR\] \d{4}-\d{2}-\d{2}T/);
		});

		it('should include stack trace when available', () => {
			const error = new Error('Test error with stack');

			logErrorWithContext(error, 'Test context');

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Stack:')
			);
		});

		it('should handle errors without stack trace', () => {
			const error = new Error('Test error');
			error.stack = undefined;

			logErrorWithContext(error, 'Test context');

			// Should not throw, should still log the error message
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('Test error')
			);
		});
	});
});
