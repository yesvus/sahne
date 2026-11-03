export type Point = {x: number; y: number};
export type EdgeGeometry = {start: Point; end: Point};

/** Clip a line between two distinct node centers at their rectangular boundaries. */
export const getEdgeGeometry = (
  from: Point,
  to: Point,
  halfWidth = 119,
  halfHeight = 58,
): EdgeGeometry => {
  if (![from.x, from.y, to.x, to.y, halfWidth, halfHeight].every(Number.isFinite)) {
    throw new RangeError('Expected finite diagram coordinates');
  }
  if (halfWidth <= 0 || halfHeight <= 0 || (from.x === to.x && from.y === to.y)) {
    throw new RangeError('Diagram nodes must be distinct and have positive bounds');
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const factor = Math.min(halfWidth / Math.abs(dx), halfHeight / Math.abs(dy));
  const start = {x: from.x + dx * factor, y: from.y + dy * factor};
  const end = {x: to.x - dx * factor, y: to.y - dy * factor};
  return {start, end};
};

/** Deterministic linear interpolation, clamping rendering before/after a packet's window. */
export const packetPosition = (start: Point, end: Point, progress: number): Point => {
  if (!Number.isFinite(progress)) {
    throw new RangeError('Packet progress must be finite');
  }
  const ratio = Math.max(0, Math.min(1, progress));
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
};
