import * as THREE from 'three';

const startTime = Date.now();


let camera, scene, renderer;
const container = document.querySelector('.nuvens');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let animationFrameId = null;
let cloudsReady = false;

/* ------------------ Cloud shader ------------------ */
const cloudShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 transformedPosition = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        transformedPosition = instanceMatrix * transformedPosition;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * transformedPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform vec3 colorTop;
    uniform vec3 colorMidTop;
    uniform vec3 colorMidBottom;
    uniform vec3 colorBottom;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(map, vUv);
      float h = vUv.y + tex.r * 0.2;

      vec3 color;
      if (h < 0.33) color = mix(colorBottom, colorMidBottom, h / 0.33);
      else if (h < 0.66) color = mix(colorMidBottom, colorMidTop, (h - 0.33) / 0.33);
      else color = mix(colorMidTop, colorTop, (h - 0.66) / 0.34);

      vec4 finalColor = vec4(color, tex.a);
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      float fogFactor = smoothstep(fogNear, fogFar, depth);

      gl_FragColor = mix(finalColor, vec4(fogColor, finalColor.a), fogFactor);
    }
  `
};

/* ------------------ Init ------------------  */
init();

function init() {
  scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x482417, -100, 2500);

  camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    1,
    3000
  );
  camera.position.z = 1200;

  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  container.appendChild(renderer.domElement);

  /* ------------------ Luzes ------------------ */
  scene.add(new THREE.AmbientLight(0xD2B6A5, 0.7));

  const keyLight = new THREE.DirectionalLight(0x986853, 1);
  keyLight.position.set(0, 5, 15);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xD6B09A, 1);
  fillLight.position.set(-5, 3, -3);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xF2C7A5, 0.1);
  rimLight.position.set(0, 10, -10);
  scene.add(rimLight);

  const bottomLight = new THREE.DirectionalLight(0xFFF2E8, 0.7);
  bottomLight.position.set(0, -3, 0);
  scene.add(bottomLight);

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    'https://mrdoob.com/lab/javascript/webgl/clouds/cloud10.png',
    (tex) => {
      createCloudLayers(tex);
      cloudsReady = true;
      animate();
    },
    undefined,
    (error) => console.error('Failed to load credits cloud texture:', error)
  );
}

/* ------------------ Nuvens ------------------ */
function buildCloudMesh(texture, count, yOffset, zStart, zRange, scale) {

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      fogColor: { value: scene.fog.color },
      fogNear: { value: scene.fog.near },
      fogFar: { value: scene.fog.far },
      colorTop: { value: new THREE.Color(0x8E5840) },
      colorMidTop: { value: new THREE.Color(0x986853) },
      colorMidBottom: { value: new THREE.Color(0xC09381) },
      colorBottom: { value: new THREE.Color(0xDAC1B7) }
    },
    vertexShader: cloudShader.vertexShader,
    fragmentShader: cloudShader.fragmentShader,
    transparent: true,
    depthWrite: false
  });

  const plane = new THREE.PlaneGeometry(64, 64);

  const chunks = [];
  const numChunks = 14;

  const obj = new THREE.Object3D();

  for (let c = 0; c < numChunks; c++) {

    // 🔥 FIXED SIDE (nunca muda)
    const side = Math.random() < 0.5 ? -1 : 1;

    const chunk = {
      side,
      speedOffset: Math.random() * 0.7 + 0.3,
      seed: Math.random() * 1000,
      mesh: new THREE.InstancedMesh(plane, mat, Math.ceil(count / numChunks))
    };
    chunk.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    let instanceCount = 0;
    for (let i = 0; i < count / numChunks; i++) {

      const x = side < 0
        ? Math.random() * 500 - 500   // esquerda
        : Math.random() * 500;       // direita

      obj.position.set(
        x,
        yOffset + (Math.random() - 0.5) * 120,
        zStart + Math.random() * zRange
      );

      obj.rotation.z = Math.random() * Math.PI;
      obj.scale.setScalar(Math.random() * scale + scale * 0.4);
      obj.updateMatrix();

      chunk.mesh.setMatrixAt(instanceCount++, obj.matrix);
    }

    chunk.mesh.count = instanceCount;
    chunk.mesh.instanceMatrix.needsUpdate = true;
    chunk.mesh.computeBoundingSphere();

    chunks.push(chunk);
  }

  return chunks;
}

const cloudLayers = [];

function createCloudLayers(texture) {

  const back = buildCloudMesh(texture, 1500, -80, 0, 400, 3.5);
  const mid = buildCloudMesh(texture, 1500, -200, 400, 400, 2.8);
  const front = buildCloudMesh(texture, 1000, -500, 800, 300, 2.2);

  [back, mid, front].forEach((layer, i) => {

const baseSpeed = [0.7, 1.0, 1.4][i];

    layer.forEach((chunk) => {
      chunk.mesh.renderOrder = i;
      scene.add(chunk.mesh);

      cloudLayers.push({
        mesh: chunk.mesh,
        baseSpeed,
        speedOffset: chunk.speedOffset,
        seed: chunk.seed,
        side: chunk.side,
        limit: 600
      });
    });
  });
}

/* ----- Animação (de baixo para cima) ----- */
function animate() {
  animationFrameId = null;
  if (!cloudsReady || document.hidden) return;

  if (!prefersReducedMotion) {
    const time = Date.now() * 0.001;
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / 30, 1);
    const openingFactor = Math.sin(Math.pow(progress, 2) * Math.PI) * 100;

    /* ------ Nuvens ------ */
    for (const c of cloudLayers) {
      const speed = c.baseSpeed * c.speedOffset;

      c.mesh.position.x += speed * c.side;

      const targetX = c.side * openingFactor;

      c.mesh.position.x += (targetX - c.mesh.position.x) * 0.02;

      // Efeito de oscilação
      const wave = Math.sin(time * 0.8 + c.seed) * 0.12 + Math.sin(time * 1.5 + c.seed * 2) * 0.06;
      c.mesh.position.x += wave * c.side;
      c.mesh.position.y += Math.sin(time + c.seed) * 0.02;

      // Limites
      if (c.side === -1 && c.mesh.position.x < -500) c.mesh.position.x = -500;
      if (c.side === 1 && c.mesh.position.x > 500) c.mesh.position.x = 500;
    }
  }

  renderer.render(scene, camera);
  if (!prefersReducedMotion) {
    animationFrameId = requestAnimationFrame(animate);
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  } else if (animationFrameId === null) {
    animate();
  }
}

/* ----------------- Responsividade ----------------- */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}