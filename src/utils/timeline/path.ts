/**
 * 路径插值工具：根据进度计算路径上的坐标点
 */

/** 计算路径上某一点 */
export function interpolatePathPosition(
  coords: [number, number][],
  progress: number
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segLengths.push(d);
    totalLength += d;
  }

  const targetDist = progress * totalLength;
  let accDist = 0;

  for (let i = 0; i < segLengths.length; i++) {
    if (accDist + segLengths[i] >= targetDist) {
      const t = (targetDist - accDist) / segLengths[i];
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    accDist += segLengths[i];
  }

  return coords[coords.length - 1];
}

/** 计算截取到指定 progress 处的子路径坐标 */
export function slicePathTo(
  coords: [number, number][],
  progress: number
): [number, number][] {
  if (coords.length < 2 || progress <= 0) return [coords[0]];
  if (progress >= 1) return [...coords];

  const pos = interpolatePathPosition(coords, progress);

  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segLengths.push(d);
    totalLength += d;
  }

  const targetDist = progress * totalLength;
  let accDist = 0;
  const result: [number, number][] = [];

  for (let i = 0; i < segLengths.length; i++) {
    result.push(coords[i]);
    if (accDist + segLengths[i] >= targetDist) {
      result.push(pos);
      break;
    }
    accDist += segLengths[i];
  }

  return result;
}
