import LightRays from "@/components/LightRays";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <div className="absolute inset-0">
        <LightRays
          raysColor="#00d5ff"
          followMouse={true}
          raysSpeed={1}
          lightSpread={1}
          rayLength={2}
          pulsating={false}
          fadeDistance={1.0}
          saturation={1.0}
          mouseInfluence={0.1}
          noiseAmount={0.0}
          distortion={0.0}
        />
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        <h1 className="text-5xl font-bold tracking-tight text-white md:text-7xl">
          Coming Soon
        </h1>
      </div>
    </div>
  );
}
