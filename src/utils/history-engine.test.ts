import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
} from './history-engine.ts';

test('createHistory initializes correctly', () => {
  const history = createHistory({ count: 1 });
  assert.deepEqual(history.past, []);
  assert.deepEqual(history.present, { count: 1 });
  assert.deepEqual(history.future, []);
});

test('pushHistory updates present and adds to past', () => {
  let history = createHistory({ count: 1 });
  history = pushHistory(history, { count: 2 });
  assert.equal(history.past.length, 1);
  assert.deepEqual(history.present, { count: 2 });
  assert.equal(history.future.length, 0);

  history = pushHistory(history, { count: 3 });
  assert.equal(history.past.length, 2);
  assert.deepEqual(history.present, { count: 3 });
});

test('undoHistory reverts to previous state and enables redo', () => {
  let history = createHistory({ count: 1 });
  history = pushHistory(history, { count: 2 });
  history = pushHistory(history, { count: 3 });

  // Undo from 3 to 2
  history = undoHistory(history);
  assert.deepEqual(history.present, { count: 2 });
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);

  // Undo from 2 to 1
  history = undoHistory(history);
  assert.deepEqual(history.present, { count: 1 });
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 2);

  // Undo when past is empty does nothing
  const unchanged = undoHistory(history);
  assert.deepEqual(unchanged.present, { count: 1 });
});

test('redoHistory steps forward to undone state', () => {
  let history = createHistory({ count: 1 });
  history = pushHistory(history, { count: 2 });
  history = pushHistory(history, { count: 3 });

  history = undoHistory(history); // at 2
  history = undoHistory(history); // at 1

  history = redoHistory(history); // back to 2
  assert.deepEqual(history.present, { count: 2 });
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);

  history = redoHistory(history); // back to 3
  assert.deepEqual(history.present, { count: 3 });
  assert.equal(history.past.length, 2);
  assert.equal(history.future.length, 0);
});

test('pushHistory clears future branch', () => {
  let history = createHistory({ count: 1 });
  history = pushHistory(history, { count: 2 });
  history = pushHistory(history, { count: 3 });

  history = undoHistory(history); // at 2, future has 3
  assert.equal(history.future.length, 1);

  // Push new state while in past
  history = pushHistory(history, { count: 99 });
  assert.deepEqual(history.present, { count: 99 });
  assert.equal(history.future.length, 0); // future 3 is cleared
});
