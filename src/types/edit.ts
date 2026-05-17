/** 编辑工具 */
export type EditTool = 'select' | 'point' | 'line' | 'polygon' | 'battleZone' | null;

/** 绘制状态 */
export type DrawState = 'idle' | 'drawing';

/** 选中状态 */
export interface SelectionState {
  featureId: string | number | null;
  layerId: string | null;
  coordinates: [number, number][] | null; // 当前选中要素的节点坐标
}
