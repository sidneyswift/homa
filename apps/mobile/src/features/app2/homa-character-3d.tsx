/* eslint-disable react/no-unknown-property -- react-three-fiber elements take three.js props, not DOM attributes. */
import { colorTokens } from "@homa/design/contract";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { useFocusEffect } from "expo-router";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { OrthographicCamera, type Group } from "three";

import { EYES, HOUSE_PATH, Logo, PUPIL_FILL } from "../../components/brand/logo";
import { colors } from "../../theme/app2";
import { houseShape } from "./house-shape";

/** Animation cadence for the idle character; see PacedFrames. */
const FRAME_MS = 1000 / 30;

/**
 * The first on-screen GL view after launch never shows a frame on iOS:
 * its renderer builds and draws, the view stays blank, and every later
 * view renders (gh#1236, reproduced on each cold start on whichever screen
 * mounts Homa first; an offscreen warm-up context did not help). That
 * first view is replaced once, as soon as it reports ready.
 */
let firstSurfaceSpent = false;

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

/**
 * expo-gl presents a finished frame on the UI thread's next vsync. A
 * continuous render loop queues the following frame's clear before that
 * present runs, so the screen mostly shows blank frames (reproduced on the
 * iOS 26 simulator). Rendering on demand at a fixed cadence leaves each
 * present a full vsync to land.
 */
function PacedFrames({ moving }: { moving: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => invalidate(), FRAME_MS);
    return () => clearInterval(timer);
  }, [moving, invalidate]);
  return null;
}

/** Native port of the #1158 web study (apps/web/app/app2/homa-character.tsx): same silhouette, timings and materials. */
function CharacterModel({ moving }: { moving: boolean }) {
  const body = useRef<Group>(null);
  const eyes = useRef<(Group | null)[]>([]);
  const pupils = useRef<(Group | null)[]>([]);
  const time = useRef(0);
  const invalidate = useThree(state => state.invalidate);
  const shape = useMemo(() => houseShape(HOUSE_PATH), []);
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

/** The web shadow is a blurred ellipse; native has no blur filter, so a radial fade stands in. */
function GroundShadow({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: size * 0.06, height: size * 0.1, alignItems: "center" }}>
      <Svg width={size * 0.6} height={size * 0.1}>
        <Defs>
          <RadialGradient id="homa-ground-shadow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={colors.textStrong} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.textStrong} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={size * 0.3} cy={size * 0.05} rx={size * 0.3} ry={size * 0.05} fill="url(#homa-ground-shadow)" />
      </Svg>
    </View>
  );
}

/**
 * Homa in 3D on the App 2 conversation canvas. Motion stops while the app
 * is backgrounded, the screen is covered, or Reduce Motion is on; a GL
 * failure falls back to the flat mark rather than an empty square.
 */
export function HomaCharacter3D({ size, paused = false }: { size: number; paused?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [focused, setFocused] = useState(true);
  const [failed, setFailed] = useState(false);
  const [surface, setSurface] = useState(0);
  const markFailed = useCallback(() => setFailed(true), []);
  const surfaceReady = useCallback(() => {
    if (firstSurfaceSpent) return;
    firstSurfaceSpent = true;
    requestAnimationFrame(() => setSurface(current => current + 1));
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const moving = foreground && focused && !reducedMotion && !paused;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Homa, a rounded orange house character" style={{ width: size, height: size }}>
      {failed ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Logo variant="mark" size={size * 0.7} /></View>
      ) : (
        <CharacterBoundary onError={markFailed}>
          <Canvas
            key={surface}
            style={{ flex: 1 }}
            orthographic
            camera={{ position: [0, 0, 100], near: 0.1, far: 300 }}
            frameloop="demand"
            gl={{ antialias: true }}
            onCreated={({ gl }) => {
              gl.setClearColor(colors.page, 1);
              surfaceReady();
            }}
          >
            <ambientLight intensity={1.2} />
            <directionalLight position={[-30, 45, 60]} intensity={3.2} />
            <directionalLight position={[35, 10, -10]} intensity={2.4} />
            <directionalLight position={[0, -20, 40]} intensity={0.3} />
            <CharacterFraming />
            <PacedFrames moving={moving} />
            <CharacterModel moving={moving} />
          </Canvas>
        </CharacterBoundary>
      )}
      {failed ? null : <GroundShadow size={size} />}
    </View>
  );
}
