import { useRef, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface RegionColors {
  [region: string]: string;
}

interface BodyMap3DProps {
  regionColors: RegionColors;
  muscleVolumes: { muscleGroup: string; volume: number }[];
}

function hslToThreeColor(hsl: string): THREE.Color {
  const match = hsl.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!match) return new THREE.Color(0x1a1a2e);
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  return new THREE.Color().setHSL(h, s, l);
}

const DEFAULT_COLOR = "hsl(220 10% 18%)";
const BASE_COLOR = new THREE.Color().setHSL(220 / 360, 0.10, 0.15);

interface MusclePartProps {
  region: string;
  color: string;
  position: [number, number, number];
  args: number[];
  type: "capsule" | "sphere";
  rotation?: [number, number, number];
  scale?: [number, number, number];
  onHover?: (name: string | null) => void;
}

function MusclePart({ region, color, position, args, type, rotation, scale, onHover }: MusclePartProps) {
  const threeColor = useMemo(() => hslToThreeColor(color), [color]);
  const isActive = color !== DEFAULT_COLOR;
  const emissiveColor = useMemo(() => {
    if (!isActive) return new THREE.Color(0x000000);
    return threeColor.clone().multiplyScalar(0.35);
  }, [threeColor, isActive]);

  return (
    <mesh
      position={position}
      rotation={rotation ? rotation.map(r => r * Math.PI / 180) as [number, number, number] : undefined}
      scale={scale}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.(region); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover?.(null); }}
    >
      {type === "capsule" ? (
        <capsuleGeometry args={[args[0], args[1], 12, 24]} />
      ) : (
        <sphereGeometry args={[args[0], 24, 24]} />
      )}
      <meshStandardMaterial
        color={threeColor}
        emissive={emissiveColor}
        emissiveIntensity={isActive ? 0.5 : 0}
        roughness={0.55}
        metalness={0.08}
      />
    </mesh>
  );
}

/* Base silhouette — neutral dark body that connects everything */
function BodyBase() {
  const mat = useMemo(() => (
    <meshStandardMaterial color={BASE_COLOR} roughness={0.7} metalness={0.05} />
  ), []);

  return (
    <group>
      {/* Torso */}
      <mesh position={[0, 1.28, 0]}>
        <capsuleGeometry args={[0.14, 0.42, 12, 24]} />
        {mat}
      </mesh>

      {/* Pelvis */}
      <mesh position={[0, 0.98, 0]} scale={[1.1, 0.55, 0.85]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        {mat}
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.63, 0]}>
        <capsuleGeometry args={[0.05, 0.08, 8, 16]} />
        {mat}
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.82, 0]}>
        <capsuleGeometry args={[0.1, 0.1, 12, 24]} />
        {mat}
      </mesh>

      {/* Upper arms */}
      <mesh position={[-0.3, 1.35, 0]} rotation={[0, 0, 8 * Math.PI / 180]}>
        <capsuleGeometry args={[0.05, 0.18, 8, 16]} />
        {mat}
      </mesh>
      <mesh position={[0.3, 1.35, 0]} rotation={[0, 0, -8 * Math.PI / 180]}>
        <capsuleGeometry args={[0.05, 0.18, 8, 16]} />
        {mat}
      </mesh>

      {/* Forearms */}
      <mesh position={[-0.33, 1.1, 0.01]} rotation={[0, 0, 4 * Math.PI / 180]}>
        <capsuleGeometry args={[0.035, 0.16, 8, 16]} />
        {mat}
      </mesh>
      <mesh position={[0.33, 1.1, 0.01]} rotation={[0, 0, -4 * Math.PI / 180]}>
        <capsuleGeometry args={[0.035, 0.16, 8, 16]} />
        {mat}
      </mesh>

      {/* Hands */}
      <mesh position={[-0.34, 0.92, 0.01]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        {mat}
      </mesh>
      <mesh position={[0.34, 0.92, 0.01]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        {mat}
      </mesh>

      {/* Thighs */}
      <mesh position={[-0.09, 0.72, 0]}>
        <capsuleGeometry args={[0.07, 0.22, 10, 20]} />
        {mat}
      </mesh>
      <mesh position={[0.09, 0.72, 0]}>
        <capsuleGeometry args={[0.07, 0.22, 10, 20]} />
        {mat}
      </mesh>

      {/* Shins */}
      <mesh position={[-0.09, 0.36, 0]}>
        <capsuleGeometry args={[0.045, 0.2, 8, 16]} />
        {mat}
      </mesh>
      <mesh position={[0.09, 0.36, 0]}>
        <capsuleGeometry args={[0.045, 0.2, 8, 16]} />
        {mat}
      </mesh>

      {/* Feet */}
      <mesh position={[-0.09, 0.14, 0.03]} scale={[0.7, 0.4, 1.2]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        {mat}
      </mesh>
      <mesh position={[0.09, 0.14, 0.03]} scale={[0.7, 0.4, 1.2]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        {mat}
      </mesh>
    </group>
  );
}

function MuscleLayer({ regionColors, onHover }: { regionColors: RegionColors; onHover: (name: string | null) => void }) {
  const getColor = (region: string) => regionColors[region] || DEFAULT_COLOR;

  return (
    <group>
      {/* Traps */}
      <MusclePart region="traps" color={getColor("traps")} position={[-0.1, 1.55, -0.02]} args={[0.055, 0.06]} type="capsule" rotation={[0, 0, 20]} onHover={onHover} />
      <MusclePart region="traps" color={getColor("traps")} position={[0.1, 1.55, -0.02]} args={[0.055, 0.06]} type="capsule" rotation={[0, 0, -20]} onHover={onHover} />

      {/* Shoulders */}
      <MusclePart region="shoulders" color={getColor("shoulders")} position={[-0.22, 1.48, 0]} args={[0.08]} type="sphere" onHover={onHover} />
      <MusclePart region="shoulders" color={getColor("shoulders")} position={[0.22, 1.48, 0]} args={[0.08]} type="sphere" onHover={onHover} />

      {/* Chest */}
      <MusclePart region="chest" color={getColor("chest")} position={[-0.08, 1.38, 0.08]} args={[0.08, 0.06]} type="capsule" rotation={[0, 0, 12]} onHover={onHover} />
      <MusclePart region="chest" color={getColor("chest")} position={[0.08, 1.38, 0.08]} args={[0.08, 0.06]} type="capsule" rotation={[0, 0, -12]} onHover={onHover} />

      {/* Upper Back */}
      <MusclePart region="upper-back" color={getColor("upper-back")} position={[-0.07, 1.38, -0.08]} args={[0.08, 0.1]} type="capsule" onHover={onHover} />
      <MusclePart region="upper-back" color={getColor("upper-back")} position={[0.07, 1.38, -0.08]} args={[0.08, 0.1]} type="capsule" onHover={onHover} />

      {/* Lower Back */}
      <MusclePart region="lower-back" color={getColor("lower-back")} position={[0, 1.12, -0.07]} args={[0.09, 0.08]} type="capsule" onHover={onHover} />

      {/* Abs */}
      <MusclePart region="abs" color={getColor("abs")} position={[0, 1.18, 0.08]} args={[0.08, 0.12]} type="capsule" onHover={onHover} />

      {/* Biceps */}
      <MusclePart region="biceps" color={getColor("biceps")} position={[-0.3, 1.35, 0.04]} args={[0.045, 0.1]} type="capsule" onHover={onHover} />
      <MusclePart region="biceps" color={getColor("biceps")} position={[0.3, 1.35, 0.04]} args={[0.045, 0.1]} type="capsule" onHover={onHover} />

      {/* Triceps */}
      <MusclePart region="triceps" color={getColor("triceps")} position={[-0.3, 1.35, -0.04]} args={[0.042, 0.1]} type="capsule" onHover={onHover} />
      <MusclePart region="triceps" color={getColor("triceps")} position={[0.3, 1.35, -0.04]} args={[0.042, 0.1]} type="capsule" onHover={onHover} />

      {/* Forearms */}
      <MusclePart region="forearms" color={getColor("forearms")} position={[-0.33, 1.1, 0.02]} args={[0.035, 0.1]} type="capsule" onHover={onHover} />
      <MusclePart region="forearms" color={getColor("forearms")} position={[0.33, 1.1, 0.02]} args={[0.035, 0.1]} type="capsule" onHover={onHover} />

      {/* Glutes */}
      <MusclePart region="glutes" color={getColor("glutes")} position={[-0.08, 0.94, -0.05]} args={[0.085]} type="sphere" onHover={onHover} />
      <MusclePart region="glutes" color={getColor("glutes")} position={[0.08, 0.94, -0.05]} args={[0.085]} type="sphere" onHover={onHover} />

      {/* Quads */}
      <MusclePart region="quads" color={getColor("quads")} position={[-0.1, 0.72, 0.04]} args={[0.06, 0.18]} type="capsule" onHover={onHover} />
      <MusclePart region="quads" color={getColor("quads")} position={[0.1, 0.72, 0.04]} args={[0.06, 0.18]} type="capsule" onHover={onHover} />

      {/* Hamstrings */}
      <MusclePart region="hamstrings" color={getColor("hamstrings")} position={[-0.1, 0.72, -0.04]} args={[0.055, 0.18]} type="capsule" onHover={onHover} />
      <MusclePart region="hamstrings" color={getColor("hamstrings")} position={[0.1, 0.72, -0.04]} args={[0.055, 0.18]} type="capsule" onHover={onHover} />

      {/* Calves */}
      <MusclePart region="calves" color={getColor("calves")} position={[-0.09, 0.36, -0.02]} args={[0.042, 0.14]} type="capsule" onHover={onHover} />
      <MusclePart region="calves" color={getColor("calves")} position={[0.09, 0.36, -0.02]} args={[0.042, 0.14]} type="capsule" onHover={onHover} />
    </group>
  );
}

const REGION_LABELS: Record<string, string> = {
  chest: "Peitoral",
  shoulders: "Deltoides",
  traps: "Trapézio",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraço",
  abs: "Abdômen",
  "upper-back": "Dorsal",
  "lower-back": "Lombar",
  glutes: "Glúteos",
  quads: "Quadríceps",
  hamstrings: "Posterior",
  calves: "Panturrilha",
};

export function BodyMap3D({ regionColors, muscleVolumes }: BodyMap3DProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  return (
    <div className="relative w-full" style={{ height: 380 }}>
      <Canvas
        camera={{ position: [0, 1.1, 2.8], fov: 38 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={0.9} />
        <directionalLight position={[-2, 1, -2]} intensity={0.35} />
        <pointLight position={[0, 0.2, 1.5]} intensity={0.4} distance={4} />
        <BodyBase />
        <MuscleLayer regionColors={regionColors} onHover={setHoveredRegion} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          target={[0, 1.1, 0]}
          minPolarAngle={Math.PI / 2.4}
          maxPolarAngle={Math.PI / 1.7}
        />
      </Canvas>
      {hoveredRegion && REGION_LABELS[hoveredRegion] && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1 text-xs font-sans text-foreground pointer-events-none">
          {REGION_LABELS[hoveredRegion]}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground text-center mt-1 font-sans">
        Arraste para rotacionar
      </p>
    </div>
  );
}
