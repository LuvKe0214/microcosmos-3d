'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useRef, useMemo, useState, useEffect, MutableRefObject } from 'react';
import * as THREE from 'three';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Type Definitions ---
type GLVParams = {
  r: number[];   // Growth rates
  A: number[][]; // Interaction matrix
  dt: number;    // Time step
};

// --- GLV Core Logic (The Math) ---
// Solves the Generalized Lotka-Volterra differential equations
const updatePopulations = (pops: number[], params: GLVParams) => {
  const { r, A, dt } = params;
  const newPops = [...pops];
  
  // Euler integration method
  for (let i = 0; i < 3; i++) {
    let interaction = 0;
    for (let j = 0; j < 3; j++) {
      interaction += A[i][j] * pops[j];
    }
    const dN = pops[i] * (r[i] + interaction);
    // Clamp population to 0.1 to prevent total extinction (for visualization purposes)
    newPops[i] = Math.max(0.1, pops[i] + dN * dt); 
  }
  return newPops;
};

// --- 3D Visualization Component ---
function Colony({ populations }: { populations: number[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 3000; // Total particle count
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Initialize particles in a spherical distribution
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const radius = 10 + Math.random() * 10;
      
      temp.push({ 
        x: radius * Math.sin(phi) * Math.cos(theta), 
        y: radius * Math.sin(phi) * Math.sin(theta), 
        z: radius * Math.cos(phi), 
        species: i % 3 
      }); 
    }
    return temp;
  }, []);

  // Render Loop (60 FPS)
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    
    particles.forEach((p, i) => {
      // Logic: Particle size is driven by population data
      const scale = populations[p.species] * 0.4; 
      
      // Animation: Gentle floating motion
      dummy.position.set(
        p.x + Math.sin(time + p.x) * 0.5, 
        p.y + Math.cos(time + p.y) * 0.5, 
        p.z
      );
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      // Color Logic: Red (Predator), Green (Prey), Blue (Competitor)
      const colors = ['#ff0055', '#00cc88', '#22ccff'];
      meshRef.current!.setColorAt(i, new THREE.Color(colors[p.species]));
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.2, 8, 8]} />
      <meshStandardMaterial roughness={0.1} metalness={0.5} />
    </instancedMesh>
  );
}

// --- MAIN APPLICATION ---
export default function Home() {
  const [pops, setPops] = useState([1.0, 1.0, 1.0]);
  const [history, setHistory] = useState<{name: string, A: number, B: number, C: number}[]>([]);
  const [explanation, setExplanation] = useState("Default balanced ecosystem.");
  
  // Simulation Parameters Ref (Mutable for performance)
  const params = useRef<GLVParams>({
    r: [0.5, 0.3, 0.4], 
    A: [[-0.1, 0.5, -0.2], [-0.5, -0.1, 0.0], [-0.1, -0.2, -0.1]],
    dt: 0.05 
  });

  // --- 1. Scientific Simulation Loop ---
  // We use setInterval to update the chart data independently from the frame rate.
  // This mimics a "sampling rate" in a real lab experiment (e.g., every 100ms).
  useEffect(() => {
    const interval = setInterval(() => {
      setPops((current) => {
        const next = updatePopulations(current, params.current);
        
        // Push data to history for the chart (Keep last 50 data points)
        setHistory(prev => {
          const newData = [...prev, { name: '', A: next[0], B: next[1], C: next[2] }];
          return newData.slice(-50); // Sliding window
        });
        
        return next;
      });
    }, 100); // 100ms interval
    return () => clearInterval(interval);
  }, []);

  // --- 2. Educational Scenarios ---
  const applyScenario = (type: string) => {
    if (type === 'balance') {
      params.current.r = [0.5, 0.3, 0.4];
      setExplanation("Stable Equilibrium: Predator and Prey populations oscillate in harmony.");
    } else if (type === 'explosion') {
      params.current.r = [0.8, 1.5, 0.1]; // Prey grows fast
      setExplanation("Population Explosion: High growth rate leads to chaotic spikes.");
    } else if (type === 'extinction') {
      params.current.r = [-0.2, -0.1, -0.1]; // Negative growth
      setExplanation("Mass Extinction: Harsh conditions cause all populations to collapse.");
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      
      {/* Top Left: Virtual Lab Control Panel */}
      <div style={{ 
        position: 'absolute', top: 20, left: 20, zIndex: 10, 
        width: '300px', padding: '20px', 
        background: 'rgba(20, 20, 20, 0.8)', 
        borderRadius: '12px', border: '1px solid #333', 
        color: 'white', backdropFilter: 'blur(10px)' 
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>🧪 Virtual Bio-Lab</h2>
        <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '20px' }}>
          Experiment with Lotka-Volterra dynamics in real-time.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button onClick={() => applyScenario('balance')} style={btnStyle}>⚖️ Balance</button>
          <button onClick={() => applyScenario('explosion')} style={btnStyle}>💥 Chaos</button>
          <button onClick={() => applyScenario('extinction')} style={btnStyle}>💀 Die-off</button>
        </div>

        <div style={{ background: '#222', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #00cc88' }}>
          <p style={{ fontSize: '0.75rem', color: '#ccc', margin: 0 }}>
            <strong>Observation:</strong> {explanation}
          </p>
        </div>
      </div>

      {/* Bottom Right: Real-time Analytics Chart */}
      <div style={{ 
        position: 'absolute', bottom: 20, right: 20, zIndex: 10, 
        width: '400px', height: '200px', 
        background: 'rgba(0,0,0,0.6)', padding: '10px', 
        borderRadius: '12px', border: '1px solid #333' 
      }}>
        <h3 style={{ color: 'white', fontSize: '0.8rem', margin: '0 0 5px 0', textAlign: 'center' }}>
          Real-time Population Analysis
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <XAxis hide />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#333', border: 'none', color: '#fff' }} 
              itemStyle={{ fontSize: '12px' }} 
            />
            <Line type="monotone" dataKey="A" stroke="#ff0055" strokeWidth={2} dot={false} animationDuration={300} name="Predator" />
            <Line type="monotone" dataKey="B" stroke="#00cc88" strokeWidth={2} dot={false} animationDuration={300} name="Prey" />
            <Line type="monotone" dataKey="C" stroke="#22ccff" strokeWidth={2} dot={false} animationDuration={300} name="Competitor" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 3D Scene */}
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <Colony populations={pops} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        <OrbitControls autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}

// Simple styles for the buttons
const btnStyle = {
  flex: 1,
  padding: '8px',
  background: '#333',
  border: '1px solid #555',
  borderRadius: '6px',
  color: 'white',
  cursor: 'pointer',
  fontSize: '0.8rem',
  transition: 'all 0.2s'
};