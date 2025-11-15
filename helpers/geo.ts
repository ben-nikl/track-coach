import { LatLng } from './generatePerpendicularSectors';

// Simple local projection relative to reference lat/lon (meters)
export function projectToLocal(ref: LatLng, p: LatLng) {
  const R = 6371000;
  const phi0 = (ref.latitude * Math.PI) / 180;
  const phi = (p.latitude * Math.PI) / 180;
  const lambda0 = (ref.longitude * Math.PI) / 180;
  const lambda = (p.longitude * Math.PI) / 180;
  const x = R * Math.cos(phi0) * (lambda - lambda0);
  const y = R * (phi - phi0);
  return { x, y };
}

interface Point2D { x: number; y: number }

function orientation(a: Point2D, b: Point2D, c: Point2D) {
  const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2; // 1 clockwise, 2 counterclockwise
}

function onSegment(a: Point2D, b: Point2D, c: Point2D) {
  return Math.min(a.x, c.x) <= b.x && b.x <= Math.max(a.x, c.x) && Math.min(a.y, c.y) <= b.y && b.y <= Math.max(a.y, c.y);
}

export function segmentsIntersect(p1: LatLng, p2: LatLng, q1: LatLng, q2: LatLng): boolean {
  // Use q1 as reference for projection (small area assumption)
  const ref = q1;
  const A = projectToLocal(ref, p1);
  const B = projectToLocal(ref, p2);
  const C = projectToLocal(ref, q1);
  const D = projectToLocal(ref, q2);

  const o1 = orientation(A, B, C);
  const o2 = orientation(A, B, D);
  const o3 = orientation(C, D, A);
  const o4 = orientation(C, D, B);

  if (o1 !== o2 && o3 !== o4) return true;
  // Collinear cases
  if (o1 === 0 && onSegment(A, C, B)) return true;
  if (o2 === 0 && onSegment(A, D, B)) return true;
  if (o3 === 0 && onSegment(C, A, D)) return true;
  if (o4 === 0 && onSegment(C, B, D)) return true;
  return false;
}

export function intersectionParamT(p1: LatLng, p2: LatLng, q1: LatLng, q2: LatLng): number | null {
  const ref = q1;
  const A = projectToLocal(ref, p1);
  const B = projectToLocal(ref, p2);
  const C = projectToLocal(ref, q1);
  const D = projectToLocal(ref, q2);
  const denom = (B.x - A.x) * (D.y - C.y) - (B.y - A.y) * (D.x - C.x);
  if (Math.abs(denom) < 1e-9) return null; // parallel or coincident
  const numT = (C.x - A.x) * (D.y - C.y) - (C.y - A.y) * (D.x - C.x);
  const t = numT / denom;
  const numU = (C.x - A.x) * (B.y - A.y) - (C.y - A.y) * (B.x - A.x);
  const u = numU / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}
