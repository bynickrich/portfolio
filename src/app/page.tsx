import { TronDiskScene } from "@/components/TronDisk";

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <TronDiskScene
        // Uncomment and set to your scan filename once you have one:
        // modelPath="face.obj"
        // diskModelPath="tron-disk.glb"
        particleCount={8000}
      />
    </main>
  );
}
