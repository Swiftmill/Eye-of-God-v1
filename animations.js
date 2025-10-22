import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';

const defaultCameraPosition = { x: 0, y: 2.5, z: 12 };
const defaultLookAt = { x: 0, y: 0, z: 0 };

export function focusCamera(camera, target, options = {}) {
  const { duration = 1.6, onComplete } = options;
  const lookTarget = target.clone().normalize().multiplyScalar(2.6);
  const destination = target.clone().normalize().multiplyScalar(7.5);

  gsap.to(camera.position, {
    duration,
    x: destination.x,
    y: destination.y,
    z: destination.z,
    ease: 'power3.inOut',
    onUpdate: () => {
      camera.lookAt(lookTarget);
    },
    onComplete
  });
}

export function resetCamera(camera, options = {}) {
  const { duration = 1.4, delay = 0 } = options;
  gsap.to(camera.position, {
    duration,
    delay,
    ...defaultCameraPosition,
    ease: 'power3.out',
    onUpdate: () => {
      camera.lookAt(defaultLookAt.x, defaultLookAt.y, defaultLookAt.z);
    }
  });
}

export function glitchIn(overlayElement) {
  overlayElement.classList.remove('glitch-out');
  overlayElement.classList.add('glitch-in');
  gsap.fromTo(
    overlayElement,
    { scale: 0.92, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }
  );
}

export function glitchOut(overlayElement, onComplete) {
  overlayElement.classList.remove('glitch-in');
  overlayElement.classList.add('glitch-out');
  gsap.to(overlayElement, {
    scale: 0.9,
    opacity: 0,
    duration: 0.45,
    ease: 'power2.in',
    onComplete: () => {
      overlayElement.classList.remove('glitch-out');
      if (onComplete) onComplete();
    }
  });
}

export function pingNode(object3D) {
  if (!object3D) return;
  gsap.fromTo(
    object3D.scale,
    { x: 1.2, y: 1.2, z: 1.2 },
    {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.6,
      ease: 'elastic.out(1, 0.4)'
    }
  );
}

export function pulseLabel(labelElement) {
  if (!labelElement) return;
  gsap.fromTo(
    labelElement,
    { opacity: 0, y: -8 },
    { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
  );
}

export function fadeOutLabel(labelElement) {
  if (!labelElement) return;
  gsap.to(labelElement, { opacity: 0, y: -6, duration: 0.2, ease: 'power2.in' });
}
