/**
 * Procedural model toolkit. Every mesh in Vethmoor is assembled from these
 * helpers — no model files exist. Geometries carry baked vertex colors and
 * are rendered with one shared vertex-colored Lambert material.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Sfc32 } from '@/engine/rng';

let floraMat: THREE.MeshLambertMaterial | null = null;

/** Shared material for all vertex-colored procedural models. DoubleSide so
 * crossed-quad vegetation reads from every angle. */
export function vertexColorMaterial(): THREE.MeshLambertMaterial {
  if (!floraMat) {
    floraMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  return floraMat;
}

/** Bake a flat color into a geometry's vertex colors. */
export function paint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Bake a vertical color gradient (bottom → top across the geometry's Y span). */
export function paintGradient(
  geo: THREE.BufferGeometry,
  bottom: number,
  top: number,
): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox as THREE.Box3;
  const cb = new THREE.Color(bottom);
  const ct = new THREE.Color(top);
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const span = Math.max(0.0001, bb.max.y - bb.min.y);
  for (let i = 0; i < n; i++) {
    const t = (pos.getY(i) - bb.min.y) / span;
    colors[i * 3] = cb.r + (ct.r - cb.r) * t;
    colors[i * 3 + 1] = cb.g + (ct.g - cb.g) * t;
    colors[i * 3 + 2] = cb.b + (ct.b - cb.b) * t;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Randomly displace vertices for organic crustiness (welds preserved per-position). */
export function roughen(geo: THREE.BufferGeometry, rng: Sfc32, amount: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = seen.get(key);
    if (!d) {
      d = [rng.range(-amount, amount), rng.range(-amount, amount), rng.range(-amount, amount)];
      seen.set(key, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

export function translate(geo: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  geo.translate(x, y, z);
  return geo;
}

/** Merge parts into one geometry (parts are consumed/disposed). UVs are
 * stripped — everything procedural is vertex-colored, and attribute sets
 * must match for mergeGeometries. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const noIndex = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  for (const p of noIndex) {
    p.deleteAttribute('uv');
    p.deleteAttribute('uv1');
  }
  const merged = mergeGeometries(noIndex, false);
  for (const p of parts) p.dispose();
  for (const p of noIndex) {
    if (!parts.includes(p)) p.dispose();
  }
  if (!merged) throw new Error('merge failed');
  return merged;
}

/** Low-poly cylinder (optionally tapered/bent) between two points. */
export function limb(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  r0: number,
  r1: number,
  segments = 5,
): THREE.BufferGeometry {
  const from = new THREE.Vector3(x0, y0, z0);
  const to = new THREE.Vector3(x1, y1, z1);
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(r1, r0, len, segments, 1);
  geo.translate(0, len / 2, 0);
  const dir = to.clone().sub(from).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  geo.applyQuaternion(quat);
  geo.translate(from.x, from.y, from.z);
  return geo;
}

/** Squashed, roughened icosahedron — the universal rock. */
export function blob(
  rng: Sfc32,
  radius: number,
  squashY: number,
  detail = 0,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  geo.scale(rng.range(0.8, 1.2), squashY, rng.range(0.8, 1.2));
  roughen(geo, rng, radius * 0.22);
  return geo;
}

/** A simple box helper with bottom at y=0. */
export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  return geo;
}

/** Crossed quads (×2 or ×3) for grass/reeds — cheap alpha-free vegetation. */
export function crossedQuads(
  w: number,
  h: number,
  planes: number,
  bend = 0,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < planes; i++) {
    const p = new THREE.PlaneGeometry(w, h, 1, 2);
    const pos = p.getAttribute('position') as THREE.BufferAttribute;
    // taper top + bend
    for (let v = 0; v < pos.count; v++) {
      const t = (pos.getY(v) + h / 2) / h;
      pos.setX(v, pos.getX(v) * (1 - t * 0.7));
      pos.setZ(v, pos.getZ(v) + bend * t * t);
    }
    p.translate(0, h / 2, 0);
    p.rotateY((i / planes) * Math.PI);
    parts.push(p);
  }
  const g = merge(parts);
  // Double-sided look via duplicated reversed faces is wasteful; Lambert
  // material renders DoubleSide globally for the flora material instead.
  return g;
}
