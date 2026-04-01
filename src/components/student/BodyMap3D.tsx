import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Capsule, Sphere } from "@react-three/drei";
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
const NEUTRAL_COLOR = "hsl(220 10% 25%)";

interface MusclePartProps {
  region: string;
  color: string;
  position: [number, number, number];
  args: number[];
  type: "capsule" | "sphere";
  rotation?: [number, number, number];
  onHover?: (name: string | null) => void;
}

function MusclePart({ region, color, position, args, type, rotation, onHover }: MusclePartProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const threeColor = useMemo(() => hslToThreeColor(color), [color]);
  const isActive = color !== DEFAULT_COLOR;
  const emissiveColor = useMemo(() => {
    if (!isActive) return new THREE.Color(0x000000);
    return threeColor.clone().multiplyScalar(0.3);
  }, [threeColor, isActive]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation ? rotation.map(r => r * Math.PI / 180) as [number, number, number] : undefined}
      onPointerOver={(e) => { e.stopPropagation(); onHover?.(region); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover?.(null); }}
    >
      {type === "capsule" ? (
        <capsuleGeometry args={[args[0], args[1], 8, 16]} />
      ) : (
        <sphereGeometry args={[args[0], 16, 16]} />
      )}
      <meshStandardMaterial
        color={threeColor}
        emissive={emissiveColor}
        emissiveIntensity={isActive ? 0.4 : 0}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
}

function HumanBody({ regionColors, onHover }: { regionColors: RegionColors; onHover: (name: string | null) => void }) {
  const getColor = (region: string) => regionColors[region] || DEFAULT_COLOR;

  return (
    <group>
      {/* Head */}
      <MusclePart region="head" color={NEUTRAL_COLOR} position={[0, 1.95, 0]} args={[0.12, 0.14]} type="capsule" onHover={onHover} />
      
      {/* Neck */}
      <MusclePart region="neck" color={NEUTRAL_COLOR} position={[0, 1.72, 0]} args={[0.06, 0.08]} type="capsule" onHover={onHover} />

      {/* Traps */}
      <MusclePart region="traps" color={getColor("traps")} position={[-0.12, 1.62, -0.02]} args={[0.06, 0.06]} type="capsule" rotation={[0, 0, 25]} onHover={onHover} />
      <MusclePart region="traps" color={getColor("traps")} position={[0.12, 1.62, -0.02]} args={[0.06, 0.06]} type="capsule" rotation={[0, 0, -25]} onHover={onHover} />

      {/* Shoulders */}
      <MusclePart region="shoulders" color={getColor("shoulders")} position={[-0.32, 1.52, 0]} args={[0.09]} type="sphere" onHover={onHover} />
      <MusclePart region="shoulders" color={getColor("shoulders")} position={[0.32, 1.52, 0]} args={[0.09]} type="sphere" onHover={onHover} />

      {/* Chest - front */}
      <MusclePart region="chest" color={getColor("chest")} position={[-0.1, 1.38, 0.06]} args={[0.1, 0.08]} type="capsule" rotation={[0, 0, 15]} onHover={onHover} />
      <MusclePart region="chest" color={getColor("chest")} position={[0.1, 1.38, 0.06]} args={[0.1, 0.08]} type="capsule" rotation={[0, 0, -15]} onHover={onHover} />

      {/* Upper Back */}
      <MusclePart region="upper-back" color={getColor("upper-back")} position={[-0.08, 1.4, -0.06]} args={[0.09, 0.1]} type="capsule" onHover={onHover} />
      <MusclePart region="upper-back" color={getColor("upper-back")} position={[0.08, 1.4, -0.06]} args={[0.09, 0.1]} type="capsule" onHover={onHover} />

      {/* Lower Back */}
      <MusclePart region="lower-back" color={getColor("lower-back")} position={[0, 1.15, -0.05]} args={[0.1, 0.1]} type="capsule" onHover={onHover} />

      {/* Abs */}
      <MusclePart region="abs" color={getColor("abs")} position={[0, 1.2, 0.05]} args={[0.09, 0.14]} type="capsule" onHover={onHover} />

      {/* Biceps */}
      <MusclePart region="biceps" color={getColor("biceps")} position={[-0.38, 1.32, 0.03]} args={[0.055, 0.12]} type="capsule" onHover={onHover} />
      <MusclePart region="biceps" color={getColor("biceps")} position={[0.38, 1.32, 0.03]} args={[0.055, 0.12]} type="capsule" onHover={onHover} />

      {/* Triceps */}
      <MusclePart region="triceps" color={getColor("triceps")} position={[-0.38, 1.32, -0.03]} args={[0.05, 0.12]} type="capsule" onHover={onHover} />
      <MusclePart region="triceps" color={getColor("triceps")} position={[0.38, 1.32, -0.03]} args={[0.05, 0.12]} type="capsule" onHover={onHover} />

      {/* Forearms */}
      <MusclePart region="forearms" color={getColor("forearms")} position={[-0.4, 1.08, 0.02]} args={[0.04, 0.12]} type="capsule" onHover={onHover} />
      <MusclePart region="forearms" color={getColor("forearms")} position={[0.4, 1.08, 0.02]} args={[0.04, 0.12]} type="capsule" onHover={onHover} />

      {/* Glutes */}
      <MusclePart region="glutes" color={getColor("glutes")} position={[-0.09, 0.95, -0.04]} args={[0.1]} type="sphere" onHover={onHover} />
      <MusclePart region="glutes" color={getColor("glutes")} position={[0.09, 0.95, -0.04]} args={[0.1]} type="sphere" onHover={onHover} />

      {/* Quads - front */}
      <MusclePart region="quads" color={getColor("quads")} position={[-0.1, 0.7, 0.03]} args={[0.07, 0.2]} type="capsule" onHover={onHover} />
      <MusclePart region="quads" color={getColor("quads")} position={[0.1, 0.7, 0.03]} args={[0.07, 0.2]} type="capsule" onHover={onHover} />

      {/* Hamstrings - back */}
      <MusclePart region="hamstrings" color={getColor("hamstrings")} position={[-0.1, 0.7, -0.03]} args={[0.065, 0.2]} type="capsule" onHover={onHover} />
      <MusclePart region="hamstrings" color={getColor("hamstrings")} position={[0.1, 0.7, -0.03]} args={[0.065, 0.2]} type="capsule" onHover={onHover} />

      {/* Calves */}
      <MusclePart region="calves" color={getColor("calves")} position={[-0.1, 0.32, -0.01]} args={[0.05, 0.16]} type="capsule" onHover={onHover} />
      <MusclePart region="calves" color={getColor("calves")} position={[0.1, 0.32, -0.01]} args={[0.05, 0.16]} type="capsule" onHover={onHover} />
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
    <div className="relative w-full" style={{ height: 320 }}>
      <Canvas
        camera={{ position: [0, 1.2, 3.2], fov: 35 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} />
        <directionalLight position={[-2, 1, -2]} intensity={0.3} />
        <HumanBody regionColors={regionColors} onHover={setHoveredRegion} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2.2}
          maxPolarAngle={Math.PI / 1.8}
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
