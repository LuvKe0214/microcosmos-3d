'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useRef, useMemo, useState, MutableRefObject } from 'react';
import * as THREE from 'three';

// --- Type Definitions ---
type GLVParams = {
  r: number[];   // Growth rates
  A: number[][]; // Interaction matrix
  dt: number;    // Time step
};

// --- GLV Math Core (The Biology Part) ---
// Model: Generalized Lotka-Volterra equations
// dN/dt = N * (r + A * N)
const updatePopulations = (pops: number[], params: GLVParams) => {
  const { r, A, dt } = params;
  const newPops = [...pops];
  
  // Euler method implementation for solving ODEs numerically
  for (let i = 0; i < 3; i++) {
    let interaction = 0;
    for (let j = 0; j < 3; j++) {
      interaction += A[i][j] * pops[j];
    }
    const dN = pops[i] * (r[i] + interaction);
    
    // Prevent extinction: clamp population to a minimum value of 0.1
    newPops[i] = Math.max(0.1, pops[i] + dN * dt); 
  }
  return newPops;
};

// --- Logic Component (Handles the Math Loop) ---
// Separated from the UI to sync updates strictly with the visual frame rate
function SimulationLoop({ onUpdate, params }: { 
  onUpdate: (callback: (prev: number[]) => number[]) => void; 
  params: MutableRefObject<GLVParams>;
}) {
  useFrame(() => {
    onUpdate((currentPops) => updatePopulations(currentPops, params.current));
  });
  return null;
}

// --- 3D Particle Component (The Visualization) ---
function Colony({ populations }: { populations: number[] }) {
  // Explicitly type the ref as an InstancedMesh to satisfy TypeScript
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 3000; // Total number of particles
  
  // Create a dummy object to handle matrix calculations efficiently
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Initialize particle positions (Random spherical distribution)
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const radius = 10 + Math.random() * 10;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      // Assign species ID (0, 1, or 2) sequentially
      temp.push({ x, y, z, species: i % 3 }); 
    }
    return temp;
  }, []);

  useFrame((state) => {
    // TypeScript Safety Check: Ensure the mesh is loaded before accessing
    const mesh = meshRef.current;
    if (!mesh) return;

    particles.forEach((particle, i) => {
      const { species, x, y, z } = particle;
      
      // Core Logic: Particle size reflects the population abundance of its species
      const scale = populations[species] * 0.5; 
      
      // Animation: Simulate Brownian motion (gentle floating)
      const time = state.clock.getElapsedTime();
      const hoverX = x + Math.sin(time + x) * 0.5;
      const hoverY = y + Math.cos(time + y) * 0.5;

      dummy.position.set(hoverX, hoverY, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      
      // Apply the transformation matrix to the specific instance
      mesh.setMatrixAt(i, dummy.matrix);
      
      // Update Colors based on Species Identity
      if (species === 0) mesh.setColorAt(i, new THREE.Color('#ff0055')); // Red (Predator)
      if (species === 1) mesh.setColorAt(i, new THREE.Color('#00cc88')); // Green (Prey)
      if (species === 2) mesh.setColorAt(i, new THREE.Color('#22ccff')); // Blue (Competitor)
    });

    // Notify Three.js that the matrices and colors have been updated
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    // 'undefined' is used here instead of 'null' for compatibility with React Three Fiber types
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial roughness={0.1} metalness={0.5} />
    </instancedMesh>
  );
}

// --- Main Application Entry Point ---
export default function Home() {
  // State: Holds the current population counts for all 3 species
  const [pops, setPops] = useState<number[]>([1.0, 1.0, 1.0]);

  // Ref: Stores simulation parameters (Growth rates and Interaction Matrix)
  const params = useRef<GLVParams>({
    r: [0.5, 0.3, 0.4], 
    A: [
      [-0.1, 0.5, -0.2], // Species 0 interaction coefficients
      [-0.5, -0.1, 0.0], // Species 1 interaction coefficients
      [-0.1, -0.2, -0.1] // Species 2 interaction coefficients
    ],
    dt: 0.05 // Time delta per frame
  });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* HUD: Heads-Up Display for data visualization */}
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 10, fontFamily: 'monospace' }}>
        <h1>🧬 Bio-Viz: GLV Simulation</h1>
        <p>Species A (Predator): {pops[0].toFixed(2)}</p>
        <p>Species B (Prey):     {pops[1].toFixed(2)}</p>
        <p>Species C (Comp):     {pops[2].toFixed(2)}</p>
      </div>

      {/* 3D Scene Setup */}
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        {/* Physics/Math Loop */}
        <SimulationLoop onUpdate={setPops} params={params} />

        {/* Visual Components */}
        <Colony populations={pops} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        <OrbitControls autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}