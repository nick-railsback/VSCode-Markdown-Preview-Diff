/**
 * Unit tests for ChangeNavigator
 * Tests navigation state management, wrapping behavior, and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeNavigator } from './changeNavigator.js';
import { ChangeLocation } from '../types/diff.types.js';

describe('ChangeNavigator', () => {
	// Test fixture: Sample change locations matching DiffHighlighter output
	const createTestChangeLocations = (count: number): ChangeLocation[] => {
		return Array.from({ length: count }, (_, i) => ({
			id: `change-${i}`,
			beforeOffset: i * 100,
			afterOffset: i * 100,
			type: i % 2 === 0 ? ('added' as const) : ('removed' as const)
		}));
	};

	describe('Constructor and State Initialization', () => {
		it('should initialize with changeLocations array', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getTotalChanges()).toBe(5);
			expect(navigator.getCurrentIndex()).toBe(0);
		});

		it('should initialize currentChangeIndex to 0', () => {
			const changeLocations = createTestChangeLocations(3);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getCurrentIndex()).toBe(0);
			const current = navigator.getCurrentChange();
			expect(current).not.toBeNull();
			expect(current?.id).toBe('change-0');
		});

		it('should handle empty changeLocations array', () => {
			const navigator = new ChangeNavigator([]);

			expect(navigator.getTotalChanges()).toBe(0);
			expect(navigator.getCurrentIndex()).toBe(0);
			expect(navigator.getCurrentChange()).toBeNull();
		});

		it('should handle single change', () => {
			const changeLocations = createTestChangeLocations(1);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getTotalChanges()).toBe(1);
			expect(navigator.getCurrentChange()?.id).toBe('change-0');
		});
	});

	describe('Navigate to Next Change', () => {
		it('should increment index from 0 to 1', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getCurrentIndex()).toBe(0);

			const next = navigator.goToNext();
			expect(next).not.toBeNull();
			expect(next?.id).toBe('change-1');
			expect(navigator.getCurrentIndex()).toBe(1);
		});

		it('should navigate forward through all changes', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate: 0 → 1 → 2 → 3 → 4
			for (let i = 0; i < 5; i++) {
				expect(navigator.getCurrentIndex()).toBe(i);
				if (i < 4) {
					const next = navigator.goToNext();
					expect(next?.id).toBe(`change-${i + 1}`);
				}
			}
		});

		it('should wrap to first change when at last change', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to last change (index 4)
			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2
			navigator.goToNext(); // 2 → 3
			navigator.goToNext(); // 3 → 4

			expect(navigator.getCurrentIndex()).toBe(4);
			expect(navigator.getCurrentChange()?.id).toBe('change-4');

			// Next from index 4 should wrap to index 0
			const next = navigator.goToNext();
			expect(next).not.toBeNull();
			expect(next?.id).toBe('change-0');
			expect(navigator.getCurrentIndex()).toBe(0);
		});

		it('should return null for empty array', () => {
			const navigator = new ChangeNavigator([]);

			const next = navigator.goToNext();
			expect(next).toBeNull();
			expect(navigator.getCurrentIndex()).toBe(0);
		});

		it('should return correct ChangeLocation object at each index', () => {
			const changeLocations = createTestChangeLocations(3);
			const navigator = new ChangeNavigator(changeLocations);

			const change1 = navigator.goToNext(); // 0 → 1
			expect(change1).toMatchObject({
				id: 'change-1',
				beforeOffset: 100,
				afterOffset: 100,
				type: 'removed'
			});

			const change2 = navigator.goToNext(); // 1 → 2
			expect(change2).toMatchObject({
				id: 'change-2',
				beforeOffset: 200,
				afterOffset: 200,
				type: 'added'
			});
		});
	});

	describe('Navigate to Previous Change', () => {
		it('should decrement index from 2 to 1', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to index 2
			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2

			expect(navigator.getCurrentIndex()).toBe(2);

			const prev = navigator.goToPrevious();
			expect(prev).not.toBeNull();
			expect(prev?.id).toBe('change-1');
			expect(navigator.getCurrentIndex()).toBe(1);
		});

		it('should navigate backward through all changes', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to last change first
			for (let i = 0; i < 4; i++) {
				navigator.goToNext();
			}
			expect(navigator.getCurrentIndex()).toBe(4);

			// Navigate backward: 4 → 3 → 2 → 1 → 0
			for (let i = 4; i > 0; i--) {
				expect(navigator.getCurrentIndex()).toBe(i);
				const prev = navigator.goToPrevious();
				expect(prev?.id).toBe(`change-${i - 1}`);
			}
		});

		it('should wrap to last change when at first change', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getCurrentIndex()).toBe(0);
			expect(navigator.getCurrentChange()?.id).toBe('change-0');

			// Previous from index 0 should wrap to index 4 (last)
			const prev = navigator.goToPrevious();
			expect(prev).not.toBeNull();
			expect(prev?.id).toBe('change-4');
			expect(navigator.getCurrentIndex()).toBe(4);
		});

		it('should return null for empty array', () => {
			const navigator = new ChangeNavigator([]);

			const prev = navigator.goToPrevious();
			expect(prev).toBeNull();
			expect(navigator.getCurrentIndex()).toBe(0);
		});

		it('should return correct ChangeLocation object at each index', () => {
			const changeLocations = createTestChangeLocations(3);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to index 2
			navigator.goToNext();
			navigator.goToNext();

			const change1 = navigator.goToPrevious(); // 2 → 1
			expect(change1).toMatchObject({
				id: 'change-1',
				beforeOffset: 100,
				afterOffset: 100,
				type: 'removed'
			});

			const change0 = navigator.goToPrevious(); // 1 → 0
			expect(change0).toMatchObject({
				id: 'change-0',
				beforeOffset: 0,
				afterOffset: 0,
				type: 'added'
			});
		});
	});

	describe('Get Current Change', () => {
		it('should return current ChangeLocation at index 0', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			const current = navigator.getCurrentChange();
			expect(current).not.toBeNull();
			expect(current?.id).toBe('change-0');
		});

		it('should return current ChangeLocation at index 2', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2

			const current = navigator.getCurrentChange();
			expect(current).not.toBeNull();
			expect(current?.id).toBe('change-2');
		});

		it('should return current ChangeLocation at last index (4)', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to last change
			for (let i = 0; i < 4; i++) {
				navigator.goToNext();
			}

			const current = navigator.getCurrentChange();
			expect(current).not.toBeNull();
			expect(current?.id).toBe('change-4');
		});

		it('should return null when no changes exist', () => {
			const navigator = new ChangeNavigator([]);

			const current = navigator.getCurrentChange();
			expect(current).toBeNull();
		});

		it('should maintain current change after multiple navigations', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2
			navigator.goToPrevious(); // 2 → 1

			const current = navigator.getCurrentChange();
			expect(current).not.toBeNull();
			expect(current?.id).toBe('change-1');
		});
	});

	describe('Get Current Index', () => {
		it('should return 0-based index at various positions', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getCurrentIndex()).toBe(0);

			navigator.goToNext(); // 0 → 1
			expect(navigator.getCurrentIndex()).toBe(1);

			navigator.goToNext(); // 1 → 2
			expect(navigator.getCurrentIndex()).toBe(2);

			navigator.goToPrevious(); // 2 → 1
			expect(navigator.getCurrentIndex()).toBe(1);
		});

		it('should return index after wrapping forward', () => {
			const changeLocations = createTestChangeLocations(3);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to last and wrap
			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2
			navigator.goToNext(); // 2 → 0 (wrap)

			expect(navigator.getCurrentIndex()).toBe(0);
		});

		it('should return index after wrapping backward', () => {
			const changeLocations = createTestChangeLocations(3);
			const navigator = new ChangeNavigator(changeLocations);

			// At index 0, go previous to wrap to last
			navigator.goToPrevious(); // 0 → 2 (wrap)

			expect(navigator.getCurrentIndex()).toBe(2);
		});
	});

	describe('Get Total Changes', () => {
		it('should return 0 for empty array', () => {
			const navigator = new ChangeNavigator([]);
			expect(navigator.getTotalChanges()).toBe(0);
		});

		it('should return 1 for single change', () => {
			const changeLocations = createTestChangeLocations(1);
			const navigator = new ChangeNavigator(changeLocations);
			expect(navigator.getTotalChanges()).toBe(1);
		});

		it('should return 5 for 5 changes', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);
			expect(navigator.getTotalChanges()).toBe(5);
		});

		it('should return 100 for 100 changes', () => {
			const changeLocations = createTestChangeLocations(100);
			const navigator = new ChangeNavigator(changeLocations);
			expect(navigator.getTotalChanges()).toBe(100);
		});

		it('should return consistent count after navigation', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getTotalChanges()).toBe(5);

			navigator.goToNext();
			navigator.goToNext();
			expect(navigator.getTotalChanges()).toBe(5);

			navigator.goToPrevious();
			expect(navigator.getTotalChanges()).toBe(5);
		});
	});

	describe('Reset to First Change', () => {
		it('should reset index to 0 from index 3', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to index 3
			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2
			navigator.goToNext(); // 2 → 3

			expect(navigator.getCurrentIndex()).toBe(3);

			navigator.reset();

			expect(navigator.getCurrentIndex()).toBe(0);
			const current = navigator.getCurrentChange();
			expect(current?.id).toBe('change-0');
		});

		it('should reset index to 0 from last index', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate to last change
			for (let i = 0; i < 4; i++) {
				navigator.goToNext();
			}
			expect(navigator.getCurrentIndex()).toBe(4);

			navigator.reset();

			expect(navigator.getCurrentIndex()).toBe(0);
			const current = navigator.getCurrentChange();
			expect(current?.id).toBe('change-0');
		});

		it('should have no effect when already at index 0', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getCurrentIndex()).toBe(0);

			navigator.reset();

			expect(navigator.getCurrentIndex()).toBe(0);
			expect(navigator.getCurrentChange()?.id).toBe('change-0');
		});

		it('should reset after wrapping navigation', () => {
			const changeLocations = createTestChangeLocations(3);
			const navigator = new ChangeNavigator(changeLocations);

			// Navigate with wrapping
			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2
			navigator.goToNext(); // 2 → 0 (wrap)
			navigator.goToNext(); // 0 → 1

			expect(navigator.getCurrentIndex()).toBe(1);

			navigator.reset();

			expect(navigator.getCurrentIndex()).toBe(0);
			expect(navigator.getCurrentChange()?.id).toBe('change-0');
		});
	});

	describe('Empty Changes Array Handling', () => {
		it('should return null for goToNext with empty array', () => {
			const navigator = new ChangeNavigator([]);

			const next = navigator.goToNext();
			expect(next).toBeNull();
		});

		it('should return null for goToPrevious with empty array', () => {
			const navigator = new ChangeNavigator([]);

			const prev = navigator.goToPrevious();
			expect(prev).toBeNull();
		});

		it('should return null for getCurrentChange with empty array', () => {
			const navigator = new ChangeNavigator([]);

			const current = navigator.getCurrentChange();
			expect(current).toBeNull();
		});

		it('should return 0 for getTotalChanges with empty array', () => {
			const navigator = new ChangeNavigator([]);

			expect(navigator.getTotalChanges()).toBe(0);
		});

		it('should handle reset with empty array', () => {
			const navigator = new ChangeNavigator([]);

			navigator.reset();

			expect(navigator.getCurrentIndex()).toBe(0);
			expect(navigator.getTotalChanges()).toBe(0);
			expect(navigator.getCurrentChange()).toBeNull();
		});

		it('should not throw errors with multiple operations on empty array', () => {
			const navigator = new ChangeNavigator([]);

			expect(() => {
				navigator.goToNext();
				navigator.goToPrevious();
				navigator.getCurrentChange();
				navigator.getCurrentIndex();
				navigator.getTotalChanges();
				navigator.reset();
			}).not.toThrow();
		});
	});

	describe('Integration with DiffHighlighter Output', () => {
		it('should preserve all change IDs from DiffHighlighter', () => {
			const changeLocations: ChangeLocation[] = [
				{ id: 'change-0', beforeOffset: 100, afterOffset: 100, type: 'added' },
				{ id: 'change-1', beforeOffset: 250, afterOffset: 250, type: 'removed' },
				{ id: 'change-2', beforeOffset: 400, afterOffset: 450, type: 'both' }
			];

			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getCurrentChange()?.id).toBe('change-0');
			navigator.goToNext();
			expect(navigator.getCurrentChange()?.id).toBe('change-1');
			navigator.goToNext();
			expect(navigator.getCurrentChange()?.id).toBe('change-2');
		});

		it('should maintain changeLocations order for sequential navigation', () => {
			const changeLocations: ChangeLocation[] = [
				{ id: 'change-0', beforeOffset: 50, afterOffset: 50, type: 'removed' },
				{ id: 'change-1', beforeOffset: 150, afterOffset: 150, type: 'added' },
				{ id: 'change-2', beforeOffset: 300, afterOffset: 320, type: 'both' },
				{ id: 'change-3', beforeOffset: 500, afterOffset: 510, type: 'added' }
			];

			const navigator = new ChangeNavigator(changeLocations);

			// Navigate forward through all changes
			expect(navigator.getCurrentChange()?.id).toBe('change-0');
			expect(navigator.goToNext()?.id).toBe('change-1');
			expect(navigator.goToNext()?.id).toBe('change-2');
			expect(navigator.goToNext()?.id).toBe('change-3');

			// Navigate backward through all changes
			expect(navigator.goToPrevious()?.id).toBe('change-2');
			expect(navigator.goToPrevious()?.id).toBe('change-1');
			expect(navigator.goToPrevious()?.id).toBe('change-0');
		});

		it('should navigate through all changes produced by DiffHighlighter', () => {
			// Simulate realistic DiffHighlighter output with various change types
			const changeLocations: ChangeLocation[] = [
				{ id: 'change-0', beforeOffset: 0, afterOffset: 0, type: 'added' },
				{ id: 'change-1', beforeOffset: 100, afterOffset: 120, type: 'both' },
				{ id: 'change-2', beforeOffset: 200, afterOffset: 200, type: 'removed' },
				{ id: 'change-3', beforeOffset: 300, afterOffset: 350, type: 'both' },
				{ id: 'change-4', beforeOffset: 400, afterOffset: 400, type: 'added' }
			];

			const navigator = new ChangeNavigator(changeLocations);

			expect(navigator.getTotalChanges()).toBe(5);

			// Test navigation through all changes
			for (let i = 0; i < 5; i++) {
				const current = navigator.getCurrentChange();
				expect(current?.id).toBe(`change-${i}`);
				if (i < 4) {
					navigator.goToNext();
				}
			}

			// Verify wrapping works with real-world data
			const wrapped = navigator.goToNext();
			expect(wrapped?.id).toBe('change-0');
		});

		it('should handle "both" type changes (word changed)', () => {
			const changeLocations: ChangeLocation[] = [
				{ id: 'change-0', beforeOffset: 100, afterOffset: 150, type: 'both' }
			];

			const navigator = new ChangeNavigator(changeLocations);

			const current = navigator.getCurrentChange();
			expect(current).not.toBeNull();
			expect(current?.type).toBe('both');
			expect(current?.beforeOffset).toBe(100);
			expect(current?.afterOffset).toBe(150);
		});
	});

	describe('State Management', () => {
		it('should maintain state across navigation operations', () => {
			const changeLocations = createTestChangeLocations(5);
			const navigator = new ChangeNavigator(changeLocations);

			// Perform complex navigation sequence
			navigator.goToNext(); // 0 → 1
			navigator.goToNext(); // 1 → 2
			expect(navigator.getCurrentIndex()).toBe(2);

			navigator.goToPrevious(); // 2 → 1
			expect(navigator.getCurrentIndex()).toBe(1);

			navigator.goToNext(); // 1 → 2
			navigator.goToNext(); // 2 → 3
			expect(navigator.getCurrentIndex()).toBe(3);

			navigator.reset(); // → 0
			expect(navigator.getCurrentIndex()).toBe(0);

			navigator.goToNext(); // 0 → 1
			expect(navigator.getCurrentIndex()).toBe(1);
		});

		it('should not mutate changeLocations array', () => {
			const changeLocations = createTestChangeLocations(3);
			const originalIds = changeLocations.map(c => c.id);

			const navigator = new ChangeNavigator(changeLocations);

			// Perform many navigation operations
			navigator.goToNext();
			navigator.goToNext();
			navigator.goToPrevious();
			navigator.reset();
			navigator.goToNext();

			// Verify original array unchanged
			expect(changeLocations.map(c => c.id)).toEqual(originalIds);
			expect(changeLocations.length).toBe(3);
		});
	});
});
