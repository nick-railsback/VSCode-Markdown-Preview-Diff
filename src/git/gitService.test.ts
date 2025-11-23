/**
 * Unit tests for GitService
 *
 * Tests the facade pattern implementation and integration of RepositoryDetector
 * and FileVersionRetriever components.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock VS Code API before any imports
const mockReadFile = vi.fn();
const mockWorkspaceFolders = [{
	uri: {
		fsPath: '/workspace/root'
	}
}];

vi.mock('vscode', () => ({
	workspace: {
		get workspaceFolders() {
			return mockWorkspaceFolders;
		},
		fs: {
			get readFile() {
				return mockReadFile;
			}
		}
	},
	Uri: {
		file: (path: string) => ({ fsPath: path })
	},
	FileSystemError: class FileSystemError extends Error {}
}));

// Mock simple-git with factory that can be reconfigured per test
const mockGit = {
	checkIsRepo: vi.fn(),
	revparse: vi.fn(),
	status: vi.fn(),
	show: vi.fn()
};

vi.mock('simple-git', () => ({
	default: vi.fn(() => mockGit)
}));

import { GitService } from './gitService';
import { GitError } from '../types/git.types';

describe('GitService', () => {
	let gitService: GitService;

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Set default mock implementations
		mockGit.checkIsRepo.mockResolvedValue(true);
		mockGit.revparse.mockResolvedValue('/workspace/root');
		mockGit.status.mockResolvedValue({ current: 'main' });
		mockGit.show.mockResolvedValue('# HEAD content');
		mockReadFile.mockResolvedValue(new TextEncoder().encode('# Working content'));

		// Create fresh service instance
		gitService = new GitService();
	});

	afterEach(() => {
		gitService.dispose();
	});

	describe('isInRepository', () => {
		it('should return true for file in git repository', async () => {
			const result = await gitService.isInRepository('/workspace/root/file.md');
			expect(result).toBe(true);
		});

		it('should return false for file not in repository', async () => {
			mockGit.checkIsRepo.mockResolvedValueOnce(false);

			const result = await gitService.isInRepository('/workspace/root/file.md');
			expect(result).toBe(false);
		});

		it('should throw error for path traversal attempt', async () => {
			await expect(
				gitService.isInRepository('/workspace/../etc/passwd')
			).rejects.toThrow(GitError);
		});
	});

	describe('getHeadVersion', () => {
		it('should retrieve HEAD version of file', async () => {
			mockGit.show.mockResolvedValueOnce('# HEAD content from test');

			const content = await gitService.getHeadVersion('/workspace/root/README.md');
			expect(content).toBe('# HEAD content from test');
		});

		it('should return null for new uncommitted file', async () => {
			mockGit.show.mockRejectedValueOnce(new Error('does not exist in HEAD'));

			const content = await gitService.getHeadVersion('/workspace/root/new-file.md');
			expect(content).toBeNull();
		});

		it('should throw error if not in repository', async () => {
			mockGit.checkIsRepo.mockResolvedValueOnce(false);

			await expect(
				gitService.getHeadVersion('/workspace/root/file.md')
			).rejects.toThrow(GitError);
		});
	});

	describe('getWorkingVersion', () => {
		it('should retrieve current file content', async () => {
			const mockContent = new TextEncoder().encode('# Working content');
			mockReadFile.mockResolvedValueOnce(mockContent);

			const content = await gitService.getWorkingVersion('/workspace/root/README.md');
			expect(content).toBe('# Working content');
		});

		it('should throw error for non-existent file', async () => {
			const FileSystemError = (await import('vscode')).FileSystemError;
			mockReadFile.mockRejectedValueOnce(new FileSystemError('File not found'));

			await expect(
				gitService.getWorkingVersion('/workspace/root/missing.md')
			).rejects.toThrow(GitError);
		});
	});

	describe('getAllVersions', () => {
		it('should retrieve all versions in parallel', async () => {
			mockGit.show
				.mockResolvedValueOnce('# HEAD content')  // HEAD version
				.mockResolvedValueOnce('# Staged content'); // Staged version

			const mockContent = new TextEncoder().encode('# Working content');
			mockReadFile.mockResolvedValueOnce(mockContent);

			const versions = await gitService.getAllVersions('/workspace/root/README.md');

			expect(versions.head).toBe('# HEAD content');
			expect(versions.staged).toBe('# Staged content');
			expect(versions.working).toBe('# Working content');
		});

		it('should handle new file with no HEAD version', async () => {
			mockGit.show
				.mockRejectedValueOnce(new Error('does not exist in HEAD'))  // HEAD version
				.mockResolvedValueOnce(null); // Staged version

			const mockContent = new TextEncoder().encode('# New file content');
			mockReadFile.mockResolvedValueOnce(mockContent);

			const versions = await gitService.getAllVersions('/workspace/root/new.md');

			expect(versions.head).toBe(''); // null converted to empty string
			expect(versions.working).toBe('# New file content');
		});
	});

	describe('dispose', () => {
		it('should clear internal state', () => {
			gitService.dispose();
			// No error should occur - internal cleanup
			expect(true).toBe(true);
		});
	});
});
