import { TronDiskScene } from "@/components/TronDisk";

/**
 * Tron Identity Disk page.
 *
 * To use your own face scan:
 * 1. Scan your face with your iPhone LiDAR (using Polycam, 3d Scanner App, etc.)
 * 2. Export as .obj, .ply, or .glb format
 * 3. Place the file in /public/models/ (e.g. /public/models/face.obj)
 * 4. Pass the filename to modelPath prop below
 *
 * Without a model file, it renders a sphere of particles as a placeholder.
 */
export default function TronDiskPage() {
  return (
    <main style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <TronDiskScene
        // Uncomment and set to your scan filename once you have one:
        // modelPath="face.obj"
        particleCount={15000}
      />
    </main>
  );
}
