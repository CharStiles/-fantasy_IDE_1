import { useEffect, useRef, useState } from "react";
import { renderer } from "@/lib/webgpu";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

// Animated test shader that draws a rotating colored triangle
const testShader = `
  struct Uniforms {
    time: f32,
  }
  @binding(0) @group(0) var<uniform> uniforms: Uniforms;

  @vertex
  fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(
      vec2<f32>( 0.0,  0.5),
      vec2<f32>(-0.5, -0.5),
      vec2<f32>( 0.5, -0.5)
    );

    // Rotate the triangle based on time
    let angle = uniforms.time;
    let s = sin(angle);
    let c = cos(angle);
    let rotated = vec2<f32>(
      pos[VertexIndex].x * c - pos[VertexIndex].y * s,
      pos[VertexIndex].x * s + pos[VertexIndex].y * c
    );

    return vec4<f32>(rotated, 0.0, 1.0);
  }

  @fragment
  fn fs_main() -> @location(0) vec4<f32> {
    // Make color pulse with time
    return vec4<f32>(
      abs(sin(uniforms.time)),
      abs(cos(uniforms.time)),
      0.5,
      1.0
    );
  }
`;

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserInfo, setBrowserInfo] = useState<string>("");
  const animationRef = useRef<number>();

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.includes('Chrome');
    const isEdge = userAgent.includes('Edg');
    const version = userAgent.match(/(?:Chrome|Edg)\/(\d+)/)?.at(1) || 'unknown';
    setBrowserInfo(`${isChrome ? 'Chrome' : isEdge ? 'Edge' : 'Other'} ${version}`);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize WebGPU
    renderer.init(canvas).then((success) => {
      if (!success && renderer.error) {
        setError(renderer.error);
      } else {
        // If initialization succeeded, start animation loop
        let startTime = performance.now();

        function animate() {
          const time = (performance.now() - startTime) / 1000; // Convert to seconds
          renderer.render(testShader, time);
          animationRef.current = requestAnimationFrame(animate);
        }

        animate();
      }
    }).catch((e) => {
      setError(`Failed to initialize WebGPU: ${e.message}`);
    });

    // Cleanup animation on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <Card className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4 text-white">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">WebGPU Not Available</h3>
        <p className="text-sm text-gray-400 text-center max-w-md mb-4">
          {error}
        </p>
        <div className="text-xs text-gray-500 mt-2">
          <p>Current Browser: {browserInfo}</p>
        </div>
        <div className="text-xs text-gray-500 mt-4">
          <p>To enable WebGPU:</p>
          <ol className="list-decimal list-inside mt-2">
            <li>Use Chrome Canary or Edge Canary</li>
            <li>Enable flags in browser settings:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>chrome://flags/#enable-unsafe-webgpu</li>
                <li>chrome://flags/#enable-webgpu-developer-features</li>
              </ul>
            </li>
            <li>Make sure your GPU drivers are up to date</li>
          </ol>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex items-center justify-center bg-gray-900 p-4">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={512}
        height={512}
      />
    </Card>
  );
}