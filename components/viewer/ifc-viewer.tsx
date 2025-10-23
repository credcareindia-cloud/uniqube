"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"

export function IFCViewer() {
  return (
    <div className="h-[420px] w-full bg-background">
      <Canvas camera={{ position: [2.5, 2, 2.5], fov: 55 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <mesh rotation={[0.2, 0.3, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={"#9db2ff"} />
        </mesh>
        <gridHelper args={[10, 10]} />
        <OrbitControls />
      </Canvas>
    </div>
  )
}
