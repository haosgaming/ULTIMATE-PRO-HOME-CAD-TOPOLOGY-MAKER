import { useState, useCallback, useEffect } from 'react';
import { TopologyProject } from '../types/topology.ts';
import {
  HistoryState,
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
} from '../utils/history-engine.ts';

export function useProjectHistory(initialProject: TopologyProject) {
  const [history, setHistory] = useState<HistoryState<TopologyProject>>(() =>
    createHistory(initialProject)
  );

  const setProject = useCallback((newProject: TopologyProject) => {
    setHistory((prev) => pushHistory(prev, newProject));
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => undoHistory(prev));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => redoHistory(prev));
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
          e.preventDefault();
          redo();
        } else {
          // Undo: Ctrl+Z / Cmd+Z
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        // Redo: Ctrl+Y
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    project: history.present,
    setProject,
    undo,
    redo,
    canUndo,
    canRedo,
    historyDepth: history.past.length,
    futureDepth: history.future.length,
  };
}
