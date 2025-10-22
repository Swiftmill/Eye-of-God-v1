import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js';

const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.2 },
    darkness: { value: 1.35 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vig = smoothstep(0.8, darkness + 0.1, dot(uv, uv));
      gl_FragColor = vec4(texel.rgb * (1.0 - vig), texel.a);
    }
  `
};

const globeState = {
  renderer: null,
  composer: null,
  scene: null,
  camera: null,
  earth: null,
  earthLod: null,
  halo: null,
  wires: [],
  nodes: [],
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  clock: new THREE.Clock(),
  onNodeSelect: () => {},
  onNodeHover: () => {},
  isLowMotion: false,
  hoveredNodeId: null,
  highlighted: null
};

function buildEarth() {
  const earthGroup = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: 0x0a6cf1,
    emissive: 0x0a1233,
    emissiveIntensity: 0.65,
    roughness: 0.4,
    metalness: 0.1,
    opacity: 0.98,
    transparent: true
  });

  const lod = new THREE.LOD();
  const high = new THREE.Mesh(new THREE.SphereGeometry(2.8, 64, 64), material);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(2.8, 32, 32), material.clone());

  high.castShadow = false;
  high.receiveShadow = true;
  mid.castShadow = false;
  mid.receiveShadow = true;

  lod.addLevel(high, 0);
  lod.addLevel(mid, 16);

  earthGroup.add(lod);

  const haloGeometry = new THREE.SphereGeometry(3.1, 48, 48);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x56f0ff,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });

  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  earthGroup.add(halo);

  globeState.earth = earthGroup;
  globeState.earthLod = lod;
  globeState.halo = halo;

  return earthGroup;
}

function randomOnSphere(radius) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
}

function buildNodes() {
  const group = new THREE.Group();
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x8bf1ff });

  for (let i = 0; i < 12; i += 1) {
    const nodePos = randomOnSphere(6 + Math.random() * 1.6);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), nodeMaterial.clone());
    node.position.copy(nodePos);
    const metadata = {
      id: `node-${i}`,
      label: `Nœud ${i + 1}`,
      pulseOffset: Math.random() * Math.PI * 2,
      node
    };
    node.userData = metadata;

    const points = [];
    const midPoint = nodePos.clone().multiplyScalar(0.45).add(new THREE.Vector3(0, Math.random() * 1.5, 0));
    points.push(nodePos.clone().setLength(3.8));
    points.push(midPoint);
    points.push(nodePos);

    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.TubeGeometry(curve, 40, 0.04, 6, false);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0099ff,
      emissive: 0x003355,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85
    });

    const wire = new THREE.Mesh(tube, tubeMaterial);
    wire.userData = metadata;

    globeState.wires.push(wire);
    globeState.nodes.push(node);

    group.add(wire);
    group.add(node);
  }

  return group;
}

function addStarfield(scene) {
  const starsGeometry = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const r = 60 * Math.random() + 20;
    const pos = randomOnSphere(r);
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starsMaterial = new THREE.PointsMaterial({
    color: 0x66dfff,
    size: 0.15,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
}

function setupLights(scene) {
  const ambient = new THREE.AmbientLight(0x0a1633, 1.1);
  const directional = new THREE.DirectionalLight(0x6dd4ff, 1.15);
  directional.position.set(6, 5, 8);
  scene.add(ambient);
  scene.add(directional);
}

function clearHighlight() {
  if (!globeState.highlighted) return;
  const { object, originalScale, originalColor, originalEmissive } = globeState.highlighted;
  if (object && originalScale) {
    object.scale.copy(originalScale);
  }
  if (object && object.material) {
    if (originalColor && object.material.color) {
      object.material.color.copy(originalColor);
    }
    if (typeof originalEmissive === 'number' && typeof object.material.emissiveIntensity === 'number') {
      object.material.emissiveIntensity = originalEmissive;
    }
  }
  globeState.highlighted = null;
}

function setHighlight(object) {
  if (!object) return;
  const target = object.userData && object.userData.node ? object.userData.node : object;
  clearHighlight();
  const originalScale = target.scale.clone();
  let originalColor = null;
  let originalEmissive = null;
  if (target.material) {
    if (target.material.color) {
      originalColor = target.material.color.clone();
      target.material.color.setHex(0x56f0ff);
    }
    if (typeof target.material.emissiveIntensity === 'number') {
      originalEmissive = target.material.emissiveIntensity;
      target.material.emissiveIntensity = originalEmissive * 1.6 + 0.4;
    }
  }
  target.scale.multiplyScalar(1.12);
  globeState.highlighted = { object: target, originalScale, originalColor, originalEmissive };
}

function updateHover(intersections) {
  if (!intersections.length) {
    clearHighlight();
    if (globeState.hoveredNodeId) {
      globeState.onNodeHover(null);
      globeState.hoveredNodeId = null;
    }
    document.body.style.cursor = 'default';
    return;
  }

  const [hit] = intersections;
  const { id, label } = hit.object.userData;
  const worldPosition = new THREE.Vector3();
  hit.object.getWorldPosition(worldPosition);
  document.body.style.cursor = 'pointer';

  if (globeState.hoveredNodeId !== id) {
    globeState.hoveredNodeId = id;
    setHighlight(hit.object);
    globeState.onNodeHover({ id, label, object: hit.object, worldPosition });
  } else if (globeState.highlighted && globeState.highlighted.object !== hit.object) {
    setHighlight(hit.object);
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (!globeState.scene) return;

  if (globeState.isLowMotion) {
    if (globeState.composer) {
      globeState.composer.render();
    } else if (globeState.renderer) {
      globeState.renderer.render(globeState.scene, globeState.camera);
    }
    return;
  }

  const delta = globeState.clock.getDelta();
  const elapsed = globeState.clock.elapsedTime;

  if (globeState.earth) {
    globeState.earth.rotation.y += delta * 0.18;
    globeState.halo.material.opacity = 0.18 + Math.sin(elapsed * 1.5) * 0.05;
    if (globeState.earthLod && globeState.camera) {
      globeState.earthLod.update(globeState.camera);
    }
  }

  globeState.wires.forEach((wire, index) => {
    const emissive = 0.8 + Math.sin(elapsed * 2 + index) * 0.4;
    wire.material.emissiveIntensity = emissive;
    wire.scale.y = 0.95 + Math.sin(elapsed * 1.8 + index) * 0.04;
  });

  globeState.nodes.forEach((node, index) => {
    const scale = 0.9 + Math.sin(elapsed * 3 + index) * 0.1;
    node.scale.setScalar(scale);
  });

  globeState.composer.render();
}

function addEventListeners(canvas) {
  const handlePointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    globeState.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    globeState.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    globeState.raycaster.setFromCamera(globeState.pointer, globeState.camera);
    const intersections = globeState.raycaster.intersectObjects(globeState.wires.concat(globeState.nodes), false);
    updateHover(intersections);
  };

  const handleClick = (event) => {
    const rect = canvas.getBoundingClientRect();
    globeState.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    globeState.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    globeState.raycaster.setFromCamera(globeState.pointer, globeState.camera);
    const intersections = globeState.raycaster.intersectObjects(globeState.wires.concat(globeState.nodes), false);
    if (intersections.length > 0) {
      const { object } = intersections[0];
      const worldPosition = new THREE.Vector3();
      object.getWorldPosition(worldPosition);
      globeState.onNodeSelect({
        id: object.userData.id,
        label: object.userData.label,
        node: object.userData.node,
        object
      }, worldPosition);
    }
  };

  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('click', handleClick);

  return () => {
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('click', handleClick);
  };
}

export function initScene({ canvas, onNodeSelect, onNodeHover, lowMotion = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030810, 0.022);

  const camera = new THREE.PerspectiveCamera(48, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  camera.position.set(0, 2.5, 12);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), 0.9, 0.7, 0.2);
  const vignettePass = new ShaderPass(vignetteShader);

  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(vignettePass);

  setupLights(scene);
  addStarfield(scene);

  globeState.wires = [];
  globeState.nodes = [];
  globeState.highlighted = null;

  const earthGroup = buildEarth();
  scene.add(earthGroup);

  const nodes = buildNodes();
  scene.add(nodes);

  globeState.renderer = renderer;
  globeState.scene = scene;
  globeState.camera = camera;
  globeState.composer = composer;
  globeState.onNodeSelect = onNodeSelect;
  globeState.onNodeHover = onNodeHover;
  globeState.isLowMotion = lowMotion;

  const cleanup = addEventListeners(canvas);

  animate();

  return {
    cleanup,
    scene,
    camera,
    renderer,
    composer
  };
}

export function resizeScene() {
  if (!globeState.renderer || !globeState.camera) return;

  const canvas = globeState.renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  globeState.camera.aspect = width / height;
  globeState.camera.updateProjectionMatrix();

  globeState.renderer.setSize(width, height, false);
  globeState.composer.setSize(width, height);
}

export function setLowMotion(enabled) {
  globeState.isLowMotion = enabled;
}

export function getCamera() {
  return globeState.camera;
}

export function getScene() {
  return globeState.scene;
}

export function getNodes() {
  return globeState.nodes;
}
