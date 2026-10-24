export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(initialPresent: T): HistoryState<T> {
  return {
    past: [],
    present: initialPresent,
    future: [],
  };
}

export function pushHistory<T>(state: HistoryState<T>, newPresent: T, maxHistory = 50): HistoryState<T> {
  // If no change, return same
  if (state.present === newPresent) return state;

  const newPast = [...state.past, state.present];
  if (newPast.length > maxHistory) {
    newPast.shift(); // remove oldest
  }

  return {
    past: newPast,
    present: newPresent,
    future: [], // clear future on new action
  };
}

export function undoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;

  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, state.past.length - 1);

  return {
    past: newPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;

  const next = state.future[0];
  const newFuture = state.future.slice(1);

  return {
    past: [...state.past, state.present],
    present: next,
    future: newFuture,
  };
}
