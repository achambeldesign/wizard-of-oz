import * as THREE from 'three';
import * as BufferGeometryUtils from 'addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'addons/loaders/DRACOLoader.js';


const MAX_TIME = 13000; // tempo máx para abertura das nuvens em milissegundos
let isPaused = false;
let startTime = Date.now();


let camera, scene, renderer;
const container = document.querySelector('.nuvens');

/* ------------------ Cloud shader ------------------ */
const cloudShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

  renderer.setPixelRatio(window.devicePixelRatio);
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

  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    'https://mrdoob.com/lab/javascript/webgl/clouds/cloud10.png',
    (tex) => {
      createCloudLayers(tex);
      if (window._loadHouse) loadHouse();
    }
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

    const geometries = [];

    // 🔥 FIXED SIDE (nunca muda)
    const side = Math.random() < 0.5 ? -1 : 1;

    const chunk = {
      side,
      speedOffset: Math.random() * 0.7 + 0.3,
      seed: Math.random() * 1000,
      mesh: null
    };

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

      const g = plane.clone();
      g.applyMatrix4(obj.matrix);

      geometries.push(g);
    }

    chunk.mesh = new THREE.Mesh(
      BufferGeometryUtils.mergeGeometries(geometries),
      mat
    );

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
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const time = Date.now() * 0.001;
  const elapsed = (Date.now() - startTime) / 1000;
  
  // Duração total da animação em segundos
  const totalDuration = 30; 
  
  // Progressão de 0 a 1
  let progress = Math.min(elapsed / totalDuration, 1);
  
  const maxOpening = 100; 
  let openingFactor = Math.sin(Math.pow(progress, 2) * Math.PI) * maxOpening;

  /* ------ Nuvens ------ */
  for (const c of cloudLayers) {
    const speed = (isPaused ? c.baseSpeed * 0.4 : c.baseSpeed) * c.speedOffset;

    c.mesh.position.x += speed * c.side;

    let targetX = c.side * openingFactor;
    

    c.mesh.position.x += (targetX - c.mesh.position.x) * 0.02;

    // Efeito de oscilação 
    const wave = Math.sin(time * 0.8 + c.seed) * 0.12 + Math.sin(time * 1.5 + c.seed * 2) * 0.06;
    c.mesh.position.x += wave * c.side;
    c.mesh.position.y += Math.sin(time + c.seed) * 0.02;

    // Limites
    if (c.side === -1 && c.mesh.position.x < -500) c.mesh.position.x = -500;
    if (c.side === 1 && c.mesh.position.x > 500) c.mesh.position.x = 500;
  }

  renderer.render(scene, camera);
}
animate();

/* ----------------- Responsividade ----------------- */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}