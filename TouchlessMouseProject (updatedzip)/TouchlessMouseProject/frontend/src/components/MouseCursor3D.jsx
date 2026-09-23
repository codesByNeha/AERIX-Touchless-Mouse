import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const CURSOR_SIZE = 72;

/** A decorative WebGL cursor. It deliberately has no pointer interaction. */
export default function MouseCursor3D() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(CURSOR_SIZE, CURSOR_SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.3, 9);
    scene.add(new THREE.HemisphereLight(0xdce7ff, 0x10101c, 3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
    keyLight.position.set(-4, 6, 8);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x62b9ff, 16, 30);
    rimLight.position.set(4, 1, 5);
    scene.add(rimLight);

    const cursorRig = new THREE.Group();
    const tiltRig = new THREE.Group();
    cursorRig.add(tiltRig);
    scene.add(cursorRig);

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const current = { ...target };
    let previous = { ...target };
    let visible = false;
    let frameId;
    let disposed = false;

    const setVisible = (nextVisible) => {
      visible = nextVisible;
      host.style.opacity = nextVisible ? "1" : "0";
    };

    const move = (event) => {
      if (
        event.clientX < 0 || event.clientX > window.innerWidth ||
        event.clientY < 0 || event.clientY > window.innerHeight
      ) {
        setVisible(false);
        return;
      }
      target.x = event.clientX;
      target.y = event.clientY;
      setVisible(true);
    };

    const hide = () => setVisible(false);
    const hideWhenDocumentIsHidden = () => {
      if (document.hidden) hide();
    };
    const hideWhenPointerLeavesViewport = (event) => {
      if (!event.relatedTarget) hide();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hideWhenDocumentIsHidden);
    document.addEventListener("pointerout", hideWhenPointerLeavesViewport);

    const loader = new GLTFLoader();
    loader.load(
      "/aerix-3d-start-mouse.glb",
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        model.position.sub(bounds.getCenter(new THREE.Vector3()));
        model.scale.setScalar(3.2 / Math.max(size.x, size.y, size.z));
        model.rotation.set(-0.2, 0.55, -0.1);
        tiltRig.add(model);
      },
      undefined,
      () => setVisible(false),
    );

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      current.x = THREE.MathUtils.lerp(current.x, target.x, 0.2);
      current.y = THREE.MathUtils.lerp(current.y, target.y, 0.2);
      const velocityX = current.x - previous.x;
      const velocityY = current.y - previous.y;
      previous = { ...current };

      host.style.transform = `translate3d(${current.x - 12}px, ${current.y - 12}px, 0)`;
      tiltRig.rotation.y = THREE.MathUtils.lerp(tiltRig.rotation.y, velocityX * 0.035, 0.12);
      tiltRig.rotation.x = THREE.MathUtils.lerp(tiltRig.rotation.x, -velocityY * 0.035, 0.12);
      cursorRig.rotation.z = THREE.MathUtils.lerp(cursorRig.rotation.z, -velocityX * 0.008, 0.1);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hideWhenDocumentIsHidden);
      document.removeEventListener("pointerout", hideWhenPointerLeavesViewport);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material?.map?.dispose?.();
          material?.dispose?.();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="mouse-cursor-3d" aria-hidden="true" />;
}
