import { useEffect, useRef } from "react";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
const LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js";

export default function StartPage({ onStart }) {
  const stage = useRef(null);

  useEffect(() => {
    let dispose = () => {};
    let cancelled = false;

    Promise.all([
      import(/* @vite-ignore */ THREE_URL),
      import(/* @vite-ignore */ LOADER_URL),
    ]).then(([THREE, { GLTFLoader }]) => {
      if (cancelled || !stage.current) return;
      const host = stage.current;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "aerix-start-model";
      host.append(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 1.5, 25);
      scene.add(new THREE.HemisphereLight(0xc2c9ff, 0x07040f, 2.5));
      const key = new THREE.DirectionalLight(0x9a7cff, 4); key.position.set(-10, 14, 18); scene.add(key);
      const rim = new THREE.PointLight(0x35cfff, 24, 40); rim.position.set(8, 2, 11); scene.add(rim);
      const rig = new THREE.Group(), tilt = new THREE.Group(); rig.add(tilt); scene.add(rig);
      let frame = 0, targetX = 0, targetY = 0, modelLoaded = false;
      const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const follow = (event) => { const box = host.getBoundingClientRect(); targetX = (event.clientX - box.left) / box.width - 0.5; targetY = (event.clientY - box.top) / box.height - 0.5; };
      const reset = () => { targetX = 0; targetY = 0; };
      host.addEventListener("pointermove", follow, { passive: true }); host.addEventListener("pointerleave", reset, { passive: true }); window.addEventListener("resize", resize); resize();
      new GLTFLoader().load("/aerix-3d-start-mouse.glb", (gltf) => { const model = gltf.scene, bounds = new THREE.Box3().setFromObject(model); model.position.sub(bounds.getCenter(new THREE.Vector3())); model.scale.setScalar(1.65); model.rotation.set(-0.3, 0.45, -0.12); tilt.add(model); modelLoaded = true; });
      const animate = (time) => { frame = requestAnimationFrame(animate); if (!modelLoaded) return; tilt.rotation.x = THREE.MathUtils.lerp(tilt.rotation.x, -targetY * 0.22, 0.075); tilt.rotation.y = THREE.MathUtils.lerp(tilt.rotation.y, targetX * 0.32, 0.075); tilt.position.y = Math.sin(time * 0.0011) * 0.45; rig.rotation.z = Math.sin(time * 0.0007) * 0.025; renderer.render(scene, camera); };
      frame = requestAnimationFrame(animate);
      dispose = () => { cancelAnimationFrame(frame); host.removeEventListener("pointermove", follow); host.removeEventListener("pointerleave", reset); window.removeEventListener("resize", resize); renderer.dispose(); renderer.domElement.remove(); };
    });
    return () => { cancelled = true; dispose(); };
  }, []);

  return <section className="aerix-start-page"><div className="aerix-start-background" /><div className="aerix-start-brand"><h1>AERIX</h1><p>Control Beyond Touch</p></div><button type="button" className="aerix-start-mouse" onClick={onStart} aria-label="Start AERIX"><span className="aerix-start-halo" /><span ref={stage} className="aerix-start-model-host" /></button><button type="button" className="aerix-start-cta" onClick={onStart}>Click to Start</button></section>;
}
