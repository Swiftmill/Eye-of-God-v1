import { initScene, resizeScene, setLowMotion, getCamera } from './three/scene.js';
import { focusCamera, resetCamera, glitchIn, glitchOut, pingNode, pulseLabel, fadeOutLabel } from './animations.js';

const canvas = document.getElementById('eye-scene');
const overlay = document.getElementById('overlay');
const overlayContent = overlay.querySelector('.overlay-content');
const overlayVideo = document.getElementById('overlay-video');
const overlayTitle = document.getElementById('overlay-title');
const overlayDescription = document.getElementById('overlay-description');
const togglePlayBtn = document.getElementById('toggle-play');
const randomSiteBtn = document.getElementById('random-site');
const closeOverlayBtn = document.getElementById('close-overlay');
const toggleLowMotionBtn = document.getElementById('toggle-low-motion');
const toggleAccessibilityBtn = document.getElementById('toggle-accessibility');
const accessibilityPanel = document.getElementById('accessibility-panel');
const reduceMotionCheckbox = document.getElementById('reduce-motion');
const muteVideosCheckbox = document.getElementById('mute-videos');
const fallbackGrid = document.getElementById('fallback-grid');
const mobileFallback = document.getElementById('mobile-fallback');

const labelElement = document.createElement('div');
labelElement.className = 'node-label';
labelElement.setAttribute('role', 'status');
labelElement.hidden = true;
document.body.appendChild(labelElement);

const state = {
  videos: [],
  whitelist: [],
  currentVideo: null,
  isOverlayOpen: false,
  muted: true,
  lowMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  cleanupScene: null,
  sceneReady: false,
  lastHoverPosition: null,
  previousFocus: null
};

const mobileQuery = window.matchMedia('(max-width: 820px)');

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path}`);
  }
  return response.json();
}

async function loadData() {
  try {
    const [videos, whitelist] = await Promise.all([
      loadJSON('videos.json'),
      loadJSON('whitelist.json')
    ]);
    state.videos = videos;
    state.whitelist = whitelist.sites || [];
    renderFallback();
  } catch (error) {
    console.error(error);
  }
}

function renderFallback() {
  if (!fallbackGrid) return;
  fallbackGrid.innerHTML = '';
  state.videos.forEach((video, index) => {
    const item = document.createElement('button');
    item.className = 'fallback-card';
    item.type = 'button';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <h3>${video.title}</h3>
      <p>${video.description}</p>
    `;
    item.addEventListener('click', () => {
      openOverlay(video);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOverlay(video);
      }
    });
    fallbackGrid.appendChild(item);
  });
}

function initAccessibility() {
  reduceMotionCheckbox.checked = state.lowMotion;
  muteVideosCheckbox.checked = state.muted;
  if (state.lowMotion) {
    document.body.classList.add('low-motion');
  }
  toggleLowMotionBtn.setAttribute('aria-pressed', state.lowMotion.toString());
}

function init3DScene() {
  if (state.sceneReady) return;
  if (!canvas) return;

  const { cleanup } = initScene({
    canvas,
    onNodeSelect: handleNodeSelect,
    onNodeHover: handleNodeHover,
    lowMotion: state.lowMotion
  });
  state.cleanupScene = cleanup;
  state.sceneReady = true;
}

function disposeScene() {
  if (!state.sceneReady) return;
  if (state.cleanupScene) state.cleanupScene();
  state.sceneReady = false;
  state.cleanupScene = null;
}

function toggleOverlay(show) {
  overlay.hidden = !show;
  overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) {
    document.body.style.overflow = 'hidden';
    state.previousFocus = document.activeElement;
    requestAnimationFrame(() => {
      closeOverlayBtn.focus();
    });
  } else {
    document.body.style.overflow = '';
    if (state.previousFocus && typeof state.previousFocus.focus === 'function') {
      state.previousFocus.focus();
    }
    state.previousFocus = null;
  }
}

function openOverlay(video) {
  state.currentVideo = video;
  if (!video) return;

  overlayVideo.pause();
  overlayVideo.removeAttribute('src');
  overlayVideo.load();

  overlayTitle.textContent = video.title;
  overlayDescription.textContent = video.description;
  overlayVideo.src = video.src;
  overlayVideo.loop = true;
  overlayVideo.muted = state.muted;
  overlayVideo.setAttribute('playsinline', 'true');
  overlayVideo.setAttribute('aria-label', video.title);
  overlayVideo.addEventListener('loadeddata', () => {
    if (!state.muted) {
      overlayVideo.muted = false;
    }
    overlayVideo.play().catch(() => {});
  }, { once: true });

  togglePlayBtn.textContent = 'Pause';
  togglePlayBtn.setAttribute('aria-pressed', 'true');
  state.isOverlayOpen = true;
  toggleOverlay(true);
  glitchIn(overlayContent);
}

function closeOverlay() {
  if (!state.isOverlayOpen) return;
  state.isOverlayOpen = false;
  glitchOut(overlayContent, () => {
    toggleOverlay(false);
    overlayVideo.pause();
    overlayVideo.removeAttribute('src');
    overlayVideo.load();
    togglePlayBtn.setAttribute('aria-pressed', 'false');
    togglePlayBtn.textContent = 'Lecture';
  });
  const camera = getCamera();
  if (camera) {
    resetCamera(camera);
  }
}

function handleNodeSelect(payload, worldPosition) {
  if (!payload) return;
  const video = pickVideo();
  openOverlay(video);
  const camera = getCamera();
  if (camera && worldPosition) {
    focusCamera(camera, worldPosition.clone());
  }
  const nodeToPing = payload.node || payload.object || null;
  pingNode(nodeToPing);
  hideLabel();
}

function pickVideo() {
  if (!state.videos.length) return null;
  const index = Math.floor(Math.random() * state.videos.length);
  return state.videos[index];
}

function handleNodeHover(payload) {
  if (!payload) {
    hideLabel();
    return;
  }
  const camera = getCamera();
  if (!camera) return;
  labelElement.textContent = payload.label;
  positionLabel(payload.worldPosition, camera);
  labelElement.hidden = false;
  labelElement.classList.add('visible');
  pulseLabel(labelElement);
  state.lastHoverPosition = payload.worldPosition.clone();
}

function hideLabel() {
  fadeOutLabel(labelElement);
  labelElement.classList.remove('visible');
  setTimeout(() => {
    labelElement.hidden = true;
  }, 180);
  state.lastHoverPosition = null;
}

function positionLabel(position, camera) {
  if (!position || !camera) return;
  const vector = position.clone().project(camera);
  const x = (vector.x + 1) / 2 * window.innerWidth;
  const y = (-vector.y + 1) / 2 * window.innerHeight;
  labelElement.style.left = `${x}px`;
  labelElement.style.top = `${y}px`;
}

function handleLowMotionToggle() {
  state.lowMotion = !state.lowMotion;
  reduceMotionCheckbox.checked = state.lowMotion;
  document.body.classList.toggle('low-motion', state.lowMotion);
  setLowMotion(state.lowMotion);
  toggleLowMotionBtn.setAttribute('aria-pressed', state.lowMotion.toString());
}

function handleAccessibilityToggle() {
  const isHidden = accessibilityPanel.hasAttribute('hidden');
  if (isHidden) {
    accessibilityPanel.removeAttribute('hidden');
  } else {
    accessibilityPanel.setAttribute('hidden', '');
  }
  toggleAccessibilityBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
}

function bindControls() {
  toggleLowMotionBtn.addEventListener('click', handleLowMotionToggle);
  toggleAccessibilityBtn.addEventListener('click', handleAccessibilityToggle);

  reduceMotionCheckbox.addEventListener('change', (event) => {
    state.lowMotion = event.target.checked;
    document.body.classList.toggle('low-motion', state.lowMotion);
    setLowMotion(state.lowMotion);
    toggleLowMotionBtn.setAttribute('aria-pressed', state.lowMotion.toString());
  });

  muteVideosCheckbox.addEventListener('change', (event) => {
    state.muted = event.target.checked;
    if (overlayVideo) {
      overlayVideo.muted = state.muted;
    }
  });

  togglePlayBtn.addEventListener('click', () => {
    if (overlayVideo.paused) {
      overlayVideo.play();
      togglePlayBtn.textContent = 'Pause';
      togglePlayBtn.setAttribute('aria-pressed', 'true');
    } else {
      overlayVideo.pause();
      togglePlayBtn.textContent = 'Lecture';
      togglePlayBtn.setAttribute('aria-pressed', 'false');
    }
  });

  randomSiteBtn.addEventListener('click', () => {
    if (!state.whitelist.length) return;
    const item = state.whitelist[Math.floor(Math.random() * state.whitelist.length)];
    if (item && item.url) {
      window.open(item.url, '_blank', 'noopener');
    }
  });

  closeOverlayBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.classList.contains('overlay-bg')) {
      closeOverlay();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.isOverlayOpen) {
      closeOverlay();
    }
  });
}

function handleResize() {
  if (state.sceneReady) {
    resizeScene();
  }
  if (!labelElement.hidden && state.lastHoverPosition) {
    const camera = getCamera();
    if (camera) {
      positionLabel(state.lastHoverPosition, camera);
    }
  }
}

function handleMobileChange(event) {
  if (event.matches) {
    disposeScene();
    mobileFallback.style.display = 'flex';
  } else {
    mobileFallback.style.display = '';
    init3DScene();
  }
}

async function bootstrap() {
  initAccessibility();
  bindControls();
  await loadData();

  if (!mobileQuery.matches) {
    init3DScene();
  } else {
    mobileFallback.style.display = 'flex';
  }

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', handleMobileChange);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(handleMobileChange);
  }
  window.addEventListener('resize', handleResize);
}

bootstrap();
