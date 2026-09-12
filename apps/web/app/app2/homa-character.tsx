"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { colorTokens } from "@homa/design/contract";
import { Component, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Group, Shape, Vector2 } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

import { EYES, HOUSE_PATH, Logo, PUPIL_FILL } from "../../components/brand/Logo";
import styles from "./homa-character.module.css";

const reduceQuery = "(prefers-reduced-motion: reduce)";
const forcedQuery = "(forced-colors: active)";

function subscribeAppearance(notify: () => void) {
  const reduced = matchMedia(reduceQuery);
  const forced = matchMedia(forcedQuery);
  reduced.addEventListener("change", notify);
  forced.addEventListener("change", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    reduced.removeEventListener("change", notify);
    forced.removeEventListener("change", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}

function appearanceSnapshot() {
  return `${document.hidden}:${matchMedia(reduceQuery).matches}:${matchMedia(forcedQuery).matches}`;
}

function StillMark() {
  return <div className={styles.still}><Logo variant="mark" size={144} /></div>;
}

function ContextLifecycle({ onLost }: { onLost: () => void }) {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    gl.setClearColor(0xffffff, 0);
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl, onLost]);
  return null;
}

class CharacterBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <StillMark /> : this.props.children; }
}

/** #1158: approved local 3D study. The master logo supplies the silhouette and eye proportions. */
function CharacterModel({ moving }: { moving: boolean }) {
  const body = useRef<Group>(null);
  const eyes = useRef<Array<Group | null>>([]);
  const pupils = useRef<Array<Group | null>>([]);
  const time = useRef(0);
  const invalidate = useThree(state => state.invalidate);
  const shape = useMemo(() => {
    const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${HOUSE_PATH}" /></svg>`);
    const outline = SVGLoader.createShapes(svg.paths[0])[0];
    return new Shape(outline.getPoints(64).map(point => new Vector2(point.x - 24, 24.8 - point.y)));
  }, []);
  const extrusion = useMemo(() => ({ depth: 10, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.25, bevelSegments: 6, curveSegments: 32, steps: 1 }), []);

  useEffect(() => { invalidate(); }, [moving, invalidate]);
  useFrame((_, delta) => {
    if (moving) time.current += Math.min(delta, 0.05);
    const t = moving ? time.current : 0;
    if (!body.current) return;
    body.current.position.y = moving ? Math.sin(t * 1.15) * 0.55 : 0;
    body.current.rotation.set(0.035 + Math.sin(t * 0.65) * 0.018, -0.3 + Math.sin(t * 0.42) * 0.055, -0.018 + Math.sin(t * 0.78) * 0.012);

    // Short, irregularly spaced blinks; the rest of the face never changes size.
    const cycle = t % 17;
    const blinkTime = [3.2, 8.1, 14.3].find(start => cycle >= start && cycle < start + 0.22);
    const blink = blinkTime === undefined || !moving ? 1 : Math.max(0.055, 1 - Math.sin((cycle - blinkTime) / 0.22 * Math.PI));
    const glance = moving ? Math.sin(t * 0.47) * 0.65 : 0;
    EYES.forEach((eye, index) => {
      const eyeGroup = eyes.current[index];
      const pupilGroup = pupils.current[index];
      if (eyeGroup) eyeGroup.scale.y = blink;
      if (pupilGroup) pupilGroup.position.set(eye.pupilCx - eye.cx + glance, eye.cy - eye.pupilCy + Math.sin(t * 0.31) * 0.2, 0.47);
    });
  });

  return (
    <group ref={body} rotation={[0.035, -0.3, -0.018]}>
      <mesh position={[0, 0, -5]}>
        <extrudeGeometry args={[shape, extrusion]} />
        <meshPhysicalMaterial color={colorTokens.visualCoral} roughness={0.43} metalness={0} clearcoat={0.24} clearcoatRoughness={0.5} toneMapped={false} />
      </mesh>
      {EYES.map((eye, index) => (
        <group key={eye.cx} position={[eye.cx - 24, 24.8 - eye.cy, 6.6]} ref={element => { eyes.current[index] = element; }}>
          <mesh scale={[1, 1, 0.085]}>
            <sphereGeometry args={[eye.r, 40, 24]} />
            <meshStandardMaterial color={colorTokens.paper} roughness={0.72} />
          </mesh>
          <group ref={element => { pupils.current[index] = element; }} position={[eye.pupilCx - eye.cx, eye.cy - eye.pupilCy, 0.47]}>
            <mesh scale={[1, 1, 0.08]}>
              <sphereGeometry args={[eye.pupilR, 32, 20]} />
              <meshBasicMaterial color={PUPIL_FILL} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

export default function HomaCharacter({ paused = false }: { paused?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const appearance = useSyncExternalStore(subscribeAppearance, appearanceSnapshot, () => "true:true:false");
  const [hidden, reduced, forced] = appearance.split(":").map(value => value === "true");
  const moving = onScreen && !hidden && !reduced && !paused;

  useEffect(() => {
    // Canvas fallback alone does not cover browsers with WebGL disabled.
    const frame = requestAnimationFrame(() => {
      const probe = document.createElement("canvas");
      try {
        const context = probe.getContext("webgl2");
        setWebglAvailable(Boolean(context));
        context?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        setWebglAvailable(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => setOnScreen(entries[0].isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} className={styles.character} role="img" aria-label="Homa, a rounded orange house character" data-motion={moving ? "active" : "still"}>
      <div aria-hidden="true" className={styles.scene} onContextMenu={event => event.preventDefault()}>
        {forced || contextLost || !webglAvailable ? <StillMark /> : (
          <CharacterBoundary>
            <Canvas
              orthographic camera={{ position: [0, 0, 100], zoom: 5.3, near: 0.1, far: 300 }}
              dpr={[1, 1.5]} frameloop={moving ? "always" : "demand"}
              gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
              fallback={<StillMark />}
            >
              <ContextLifecycle onLost={() => setContextLost(true)} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[-30, 45, 60]} intensity={3.2} />
              <directionalLight position={[35, 10, -10]} intensity={2.4} />
              <directionalLight position={[0, -20, 40]} intensity={0.3} />
              <CharacterModel moving={moving} />
            </Canvas>
          </CharacterBoundary>
        )}
      </div>
      {!forced && !contextLost && webglAvailable && <div className={styles.shadow} aria-hidden="true" />}
    </div>
  );
}
