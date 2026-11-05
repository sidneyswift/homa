"use client";

import { addAfterEffect, Canvas, useFrame, useThree } from "@react-three/fiber";
import { colorTokens } from "@homa/design/contract";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Group, OrthographicCamera, Shape, Vector2 } from "three";
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

function ContextLifecycle({ onLost, onFrame }: { onLost: () => void; onFrame: (snapshot: string | null) => void }) {
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    let lastFrame = -1;
    let capturedAt = -Infinity;
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    const restored = () => {
      lastFrame = -1;
      capturedAt = -Infinity;
      // Keep the still visible until a restored frame has actually rendered.
      invalidate();
    };
    gl.setClearColor(0xffffff, 0);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    const removeAfterRender = addAfterEffect(now => {
      if (gl.getContext().isContextLost() || !gl.info.render.frame || gl.info.render.frame === lastFrame) return;
      lastFrame = gl.info.render.frame;
      if (now - capturedAt < 1000) return;
      capturedAt = now;
      let snapshot: string | null = null;
      try {
        // Capture immediately after drawing, before the browser clears the buffer.
        snapshot = canvas.toDataURL("image/png");
      } catch {
        // A snapshot failure must not interrupt an otherwise healthy renderer.
      }
      onFrame(snapshot);
    });
    return () => {
      removeAfterRender();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, invalidate, onLost, onFrame]);
  return null;
}

class CharacterBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function CharacterFraming() {
  const getScene = useThree(state => state.get);
  const size = useThree(state => state.size);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const { camera } = getScene();
    if (!(camera instanceof OrthographicCamera) || !size.width || !size.height) return;
    // The 48-unit logo needs room for bevels, depth during glances, and its bob.
    camera.zoom = Math.min(size.width, size.height) / 64;
    camera.updateProjectionMatrix();
    invalidate();
  }, [getScene, size.width, size.height, invalidate]);
  return null;
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
  const extrusion = useMemo(() => ({ depth: 18, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.25, bevelSegments: 6, curveSegments: 32, steps: 1 }), []);

  useEffect(() => { invalidate(); }, [moving, invalidate]);
  useFrame((_, delta) => {
    if (moving) time.current += Math.min(delta, 0.05);
    const t = moving ? time.current : 0;
    if (!body.current) return;
    body.current.position.y = moving ? Math.sin(t * 1.15) * 0.55 : 0;
    // Mostly face forward. Each occasional glance eases out and back to rest.
    const lookCycle = t % 24;
    const turn = lookCycle >= 6 && lookCycle < 9.6
      ? -0.2 * Math.sin((lookCycle - 6) / 3.6 * Math.PI) ** 2
      : lookCycle >= 16 && lookCycle < 20
        ? 0.18 * Math.sin((lookCycle - 16) / 4 * Math.PI) ** 2
        : 0;
    body.current.rotation.set(0, turn, 0);

    // Short, irregularly spaced blinks; the rest of the face never changes size.
    const cycle = t % 17;
    const blinkTime = [3.2, 8.1, 14.3].find(start => cycle >= start && cycle < start + 0.22);
    const blink = blinkTime === undefined || !moving ? 1 : Math.max(0.055, 1 - Math.sin((cycle - blinkTime) / 0.22 * Math.PI));
    const glance = turn * 3;
    EYES.forEach((eye, index) => {
      const eyeGroup = eyes.current[index];
      const pupilGroup = pupils.current[index];
      if (eyeGroup) eyeGroup.scale.y = blink;
      if (pupilGroup) pupilGroup.position.set(eye.pupilCx - eye.cx + glance, eye.cy - eye.pupilCy + Math.sin(t * 0.31) * 0.2, 0.47);
    });
  });

  return (
    <group ref={body}>
      <mesh position={[0, 0, -9]}>
        <extrudeGeometry args={[shape, extrusion]} />
        <meshPhysicalMaterial color={colorTokens.visualCoral} roughness={0.43} metalness={0} clearcoat={0.24} clearcoatRoughness={0.5} toneMapped={false} />
      </mesh>
      {EYES.map((eye, index) => (
        <group key={eye.cx} position={[eye.cx - 24, 24.8 - eye.cy, 10.6]} ref={element => { eyes.current[index] = element; }}>
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
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const markContextLost = useCallback(() => setContextLost(true), []);
  const markFrame = useCallback((frame: string | null) => {
    if (frame && frame !== "data:,") setSnapshot(frame);
    setContextLost(false);
  }, []);
  const appearance = useSyncExternalStore(subscribeAppearance, appearanceSnapshot, () => "true:true:false");
  const [hidden, reduced, forced] = appearance.split(":").map(value => value === "true");
  const moving = onScreen && !hidden && !reduced && !paused && !contextLost;

  useEffect(() => {
    if (!contextLost || hidden || forced || rendererAttempt >= 2) return;
    // Give native restoration a chance, then replace only the failed renderer.
    const retry = setTimeout(() => setRendererAttempt(attempt => attempt + 1), 1500);
    return () => clearTimeout(retry);
  }, [contextLost, hidden, forced, rendererAttempt]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => setOnScreen(entries[0].isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} className={styles.character} role="img" aria-label="Homa, a rounded orange house character" data-motion={moving ? "active" : "still"} data-render-state={forced ? "accessible" : contextLost ? "recovering" : "live"} data-renderer-attempt={rendererAttempt}>
      <div aria-hidden="true" className={styles.scene} onContextMenu={event => event.preventDefault()}>
        {forced ? <StillMark /> : (
          <div className={styles.renderer} data-unavailable={contextLost}>
            <CharacterBoundary key={rendererAttempt} onError={markContextLost}>
              <Canvas
                resize={{ offsetSize: true }}
                orthographic camera={{ position: [0, 0, 100], near: 0.1, far: 300 }}
                dpr={[1, 1.5]} frameloop={moving ? "always" : "demand"}
                gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
                fallback={<StillMark />}
              >
                {/* Keep the canvas mounted so Three.js can restore a temporary context loss. */}
                <ContextLifecycle onLost={markContextLost} onFrame={markFrame} />
                <ambientLight intensity={1.2} />
                <directionalLight position={[-30, 45, 60]} intensity={3.2} />
                <directionalLight position={[35, 10, -10]} intensity={2.4} />
                <directionalLight position={[0, -20, 40]} intensity={0.3} />
                <CharacterFraming />
                <CharacterModel moving={moving} />
              </Canvas>
            </CharacterBoundary>
          </div>
        )}
        {!forced && contextLost && <div className={styles.recovery}>
          {snapshot ? (
            // The image contains only this locally rendered brand character.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.snapshot} src={snapshot} alt="" />
          ) : <StillMark />}
        </div>}
      </div>
      {!forced && <div className={styles.shadow} aria-hidden="true" />}
    </div>
  );
}
