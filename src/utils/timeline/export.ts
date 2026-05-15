import { getStateAtTime } from './interpolation';
import { getMapRef } from '../../store/mapRef';
import { useLayerStore } from '../../store/layerStore';
import type { KeyframeTrack } from '../../types/timeline';

/** 导出视频 */
export async function exportVideo(
  tracks: KeyframeTrack[],
  duration: number,
  fps: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const map = getMapRef();
  if (!map) throw new Error('地图未初始化');

  // 地图 canvas
  const canvas = map.getCanvas();
  const stream = canvas.captureStream(fps);

  // 获取地图容器 canvas（可能是更大尺寸的离屏渲染）
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas');

  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4; codecs=h264'
      : 'video/webm; codecs=vp9',
  });

  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const promise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, {
        type: recorder.mimeType,
      });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e);

    recorder.start(1000 / fps); // 每帧一个片段

    let currentFrame = 0;
    const totalFrames = Math.ceil(duration * fps);
    const frameInterval = 1000 / fps;

    const renderFrame = () => {
      const time = currentFrame / fps;

      if (time >= duration) {
        // 录完最后一点时间确保 MediaRecorder 收尾
        setTimeout(() => {
          recorder.stop();
        }, frameInterval);
        return;
      }

      // 应用时间轴状态到地图
      const state = getStateAtTime(tracks, time);
      if (state.mapState) {
        map.setCenter(state.mapState.center);
        map.setZoom(state.mapState.zoom);
        map.setBearing(state.mapState.bearing);
        map.setPitch(state.mapState.pitch);
      }

      // 更新图层属性
      if (state.layerStates.size > 0) {
        const layerStore = useLayerStore.getState();
        for (const [layerId, layerState] of state.layerStates) {
          layerStore.updateLayerProperties(layerId, {
            opacity: layerState.opacity,
            color: layerState.color,
          });
        }
      }

      currentFrame++;
      if (onProgress) {
        onProgress(Math.min(currentFrame / totalFrames, 1));
      }

      setTimeout(renderFrame, frameInterval);
    };

    setTimeout(renderFrame, 100);
  });

  return promise;
}

/** 检查是否支持 mp4 导出 */
export function isMp4Supported(): boolean {
  return MediaRecorder.isTypeSupported('video/mp4; codecs=h264');
}

/** 获取导出文件扩展名 */
export function getExportExtension(): string {
  if (isMp4Supported()) {
    return '.mp4';
  }
  return '.webm';
}
