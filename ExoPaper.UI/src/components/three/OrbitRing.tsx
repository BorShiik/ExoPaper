import { useMemo, useEffect } from "react";
import * as THREE from "three";

interface Props {
  radius?: number;
  position?: [number, number, number];
}

/** Thin orbital ring showing the planet's orbit path */
export default function OrbitRing({ radius = 4, position = [0, 0, 0] }: Props) {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(128);
    return new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, 0, p.y))
    );
  }, [radius]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x88C0D0, // Nord Frost
        transparent: true,
        opacity: 0.1, // Highly transparent
      }),
    []
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const lineObject = useMemo(() => {
    const line = new THREE.Line(geometry, material);
    line.position.set(...position);
    return line;
  }, [geometry, material, position]);

  return <primitive object={lineObject} />;
}
