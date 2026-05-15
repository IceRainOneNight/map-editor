import { create } from 'zustand';
import { temporal } from 'zundo';
import type { EditTool, DrawState } from '../types/edit';

/** 编辑操作的快照数据（用于 undo/redo） */
export interface EditSnapshot {
  action: string;
  layerId: string;
  featureId: string | number | null;
}

interface EditStoreState {
  tool: EditTool;
  drawState: DrawState;
  drawCoords: [number, number][];
  selectedLayerId: string | null;
  selectedFeatureId: string | number | null;
  nodeEditMode: boolean;
  lastSnapshot: EditSnapshot | null;

  setTool: (tool: EditTool) => void;
  setDrawState: (state: DrawState) => void;
  addDrawCoord: (coord: [number, number]) => void;
  updateLastDrawCoord: (coord: [number, number]) => void;
  clearDrawCoords: () => void;
  cancelDraw: () => void;
  insertDrawCoordBeforeLast: (coord: [number, number]) => void;
  setSelection: (layerId: string | null, featureId: string | number | null) => void;
  clearSelection: () => void;
  setNodeEditMode: (on: boolean) => void;
  setLastSnapshot: (snap: EditSnapshot) => void;
}

export const useEditStore = create<EditStoreState>()(
  temporal(
    (set) => ({
      tool: null,
      drawState: 'idle',
      drawCoords: [],
      selectedLayerId: null,
      selectedFeatureId: null,
      nodeEditMode: false,
      lastSnapshot: null,

      setTool: (tool) => {
        // 切换工具时始终取消当前绘制，避免状态残留
        set({ tool, drawCoords: [], drawState: 'idle' });
      },
      setDrawState: (state) =>
        set({
          drawState: state,
          // 仅 idle 时清空坐标；drawing 时保持已有坐标不变
          ...(state === 'idle' ? { drawCoords: [] } : {}),
        }),
      addDrawCoord: (coord) =>
        set((s) => ({ drawCoords: [...s.drawCoords, coord] })),
      updateLastDrawCoord: (coord) =>
        set((s) => {
          const coords = [...s.drawCoords];
          if (coords.length > 0) coords[coords.length - 1] = coord;
          return { drawCoords: coords };
        }),
      clearDrawCoords: () => set({ drawCoords: [] }),
      cancelDraw: () => set({ drawCoords: [], drawState: 'idle' }),
      insertDrawCoordBeforeLast: (coord) =>
        set((s) => {
          const coords = [...s.drawCoords];
          if (coords.length > 0) {
            coords.splice(coords.length - 1, 0, coord);
          } else {
            coords.push(coord);
          }
          return { drawCoords: coords };
        }),
      setSelection: (layerId, featureId) =>
        set({ selectedLayerId: layerId, selectedFeatureId: featureId }),
      clearSelection: () =>
        set({ selectedLayerId: null, selectedFeatureId: null }),
      setNodeEditMode: (on) => set({ nodeEditMode: on }),
      setLastSnapshot: (snap) => set({ lastSnapshot: snap }),
    }),
    {
      limit: 50,
      partialize: (state) => ({
        lastSnapshot: state.lastSnapshot,
      }),
    }
  )
);
