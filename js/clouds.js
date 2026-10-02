/* ------------------ Nuvens (index e about) e Casa ------------------ */
import * as THREE from 'three';
import { GLTFLoader } from 'addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'addons/loaders/KTX2Loader.js';

//Variáveis globais  
let camera, scene, renderer;
const container = document.querySelector('.nuvens');

//Cloud shader (parametros para o shader das nuvens)
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
      if (h < 0.33)       color = mix(colorBottom,    colorMidBottom, h / 0.33);
      else if (h < 0.66)  color = mix(colorMidBottom, colorMidTop,   (h - 0.33) / 0.33);
      else                color = mix(colorMidTop,    colorTop,       (h - 0.66) / 0.34);

      vec4 finalColor = vec4(color, tex.a);
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      float fogFactor = smoothstep(fogNear, fogFar, depth);
      gl_FragColor = mix(finalColor, vec4(fogColor, finalColor.a), fogFactor);
    }
  `
};

// ------------------ INIT ------------------
init();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    1,
    3000
  );
  camera.position.z = 1200;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.fog = new THREE.Fog(0x482417, -100, 2500);

  const ambient = new THREE.AmbientLight(0xD2B6A5, 0.7);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0x986853, 1);
  keyLight.position.set(0, 5, 15);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width  = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.9;
  keyLight.shadow.camera.far  = 1000;
  keyLight.shadow.bias = -0.001;
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
    'img/cloud.png',
    (tex) => {
      createCloudLayers(tex);
    },
    undefined,
    (error) => console.error('Erro ao carregar textura das nuvens:', error)
  );
  if (container.dataset.showHouse !== 'false') {
    loadHouse();
  }
}

// ------------------ CLOUD LAYER FACTORY ------------------
function buildCloudMesh(texture, count, yOffset, zStart, zRange, scale) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      map:           { value: texture },
      fogColor:      { value: scene.fog.color },
      fogNear:       { value: scene.fog.near },
      fogFar:        { value: scene.fog.far },
      colorTop:      { value: new THREE.Color(0x8E5840) },
      colorMidTop:   { value: new THREE.Color(0x986853) },
      colorMidBottom:{ value: new THREE.Color(0xC09381) },
      colorBottom:   { value: new THREE.Color(0xDAC1B7) }
    },
    vertexShader:   cloudShader.vertexShader,
    fragmentShader: cloudShader.fragmentShader,
    transparent: true,
    depthWrite:  false
  });

  const plane = new THREE.PlaneGeometry(64, 64);
  const mesh = new THREE.InstancedMesh(plane, mat, count);
  const obj = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    obj.position.set(
      Math.random() * 1000 - 500,
      yOffset + (Math.random() - 0.5) * 120,
      zStart + Math.random() * zRange
    );
    obj.rotation.z = Math.random() * Math.PI;
    obj.scale.setScalar(Math.random() * scale + scale * 0.4);
    obj.updateMatrix();
    mesh.setMatrixAt(i, obj.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

const cloudLayers = [];

function createCloudLayers(texture) {
  const back  = buildCloudMesh(texture, 1500, -80,  0,   400, 3.5);
  back.renderOrder = 0;
  scene.add(back);

  const mid   = buildCloudMesh(texture, 1500, -200, 400, 400, 2.8);
  mid.renderOrder = 1;
  scene.add(mid);

  const front = buildCloudMesh(texture, 1000, -500, 800, 300, 2.2);
  front.renderOrder = 10;
  scene.add(front);

  cloudLayers.push(
    { meshes: [back], speed: 0.35, maxZ: 400, scale: 3.5 },
    { meshes: [mid], speed: 0.55, maxZ: 800, scale: 2.8 },
    { meshes: [front], speed: 0.85, maxZ: 1100, scale: 2.2 }
  );

  cloudLayers.forEach(updateCloudTiles);
}

/*----------------------- Modelo da Casa 3D -----------------------*/
let mixer      = null;
let houseModel = null;
let modelLoaded = false;

const mouse      = { x: 0, y: 0 };
const mouseDelta = { x: 0, y: 0 };
const lastMouse  = { x: 0, y: 0 };
const current    = { x: 0, y: 0, rotY: 0, rotX: 0 };

window.addEventListener('mousemove', (e) => {
  const nx =  (e.clientX / window.innerWidth  - 0.5) * 2;
  const ny = -(e.clientY / window.innerHeight - 0.5) * 2;
  mouseDelta.x = nx - lastMouse.x;
  mouseDelta.y = ny - lastMouse.y;
  lastMouse.x  = nx;
  lastMouse.y  = ny;
  mouse.x = nx;
  mouse.y = ny;
});

function loadHouse() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/libs/draco/'
  );

  // 1. Configurar o KTX2Loader para suportar ETC1s / Basis Universal
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(
    'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/libs/basis/'
  );
  ktx2Loader.detectSupport(renderer); // Essencial para o loader saber o que a placa gráfica suporta

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setKTX2Loader(ktx2Loader); // 2. Registar o KTX2Loader no GLTFLoader

  gltfLoader.load(
    './model/House_c2.glb',
    (gltf) => {
      ktx2Loader.dispose();
      dracoLoader.dispose();
      houseModel = gltf.scene;

      houseModel.traverse((node) => {
        if (node.isMesh) {
          node.castShadow    = true;
          node.receiveShadow = true;
          node.renderOrder   = 5;
        }
      });

      const box    = new THREE.Box3().setFromObject(houseModel);
      const center = new THREE.Vector3();
      const size   = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      houseModel.position.sub(center);

      const maxDim     = Math.max(size.x, size.y, size.z);
      const targetSize = 200;
      houseModel.scale.setScalar(targetSize / maxDim);

      houseModel.position.z = 750;
      houseModel.position.y = 30;

      scene.add(houseModel);

      mixer = new THREE.AnimationMixer(houseModel);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());

      modelLoaded = true;
    },
    undefined,
    (err) => {
      ktx2Loader.dispose();
      dracoLoader.dispose();
      console.error('Erro ao carregar casa:', err);
    }
  );
}

/*----------------- Animação das nuvens -----------------*/
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cloudLayers.forEach(updateCloudTiles);
}

const clock = new THREE.Clock();

function getCloudWrapLimit(layer) {
  const viewDepth = Math.max(camera.near, camera.position.z - layer.maxZ);
  const halfViewWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    * viewDepth
    * camera.aspect;
  const cloudExtent = 500 + 64 * layer.scale * 1.4;
  return halfViewWidth + cloudExtent;
}

function updateCloudTiles(layer) {
  const tileWidth = 1000;
  let tileCount = Math.max(3, Math.ceil((2 * getCloudWrapLimit(layer)) / tileWidth) + 1);
  if (tileCount % 2 === 0) tileCount++;

  while (layer.meshes.length > tileCount) {
    scene.remove(layer.meshes.pop());
  }

  while (layer.meshes.length < tileCount) {
    const mesh = layer.meshes[0].clone();
    scene.add(mesh);
    layer.meshes.push(mesh);
  }

  layer.meshes.forEach((mesh, index) => {
    mesh.position.x = (index - (tileCount - 1) / 2) * tileWidth;
  });
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  // Move and recycle each repeated cloud tile independently.
  for (const layer of cloudLayers) {
    const wrapLimit = getCloudWrapLimit(layer);
    const tileWidth = 1000;

    for (const mesh of layer.meshes) {
      mesh.position.x -= layer.speed * 60 * delta;
      if (mesh.position.x < -wrapLimit) {
        mesh.position.x += tileWidth * layer.meshes.length;
      }
    }
  }

  if (mixer) mixer.update(delta);

  if (modelLoaded) {
    const lp = 0.14;
    const lr = 0.15;

    const depth  = camera.position.z - 750;
    const fovRad = camera.fov * (Math.PI / 180);
    const halfH  = Math.tan(fovRad / 2) * depth;
    const halfW  = halfH * camera.aspect;

    const targetX = mouse.x * halfW;
    const targetY = mouse.y * halfH;

    const positionLerp = 1 - Math.exp(-lp * 60 * delta);
    const rotationLerp = 1 - Math.exp(-lr * 60 * delta);
    current.x += (targetX - current.x) * positionLerp;
    current.y += (targetY - current.y) * positionLerp;

    houseModel.position.x = current.x;
    houseModel.position.y = current.y;

    const targetRotY = mouse.x * Math.PI * 0.18;
    const targetRotX = mouse.y * Math.PI * -0.08;

    current.rotY += (targetRotY - current.rotY) * rotationLerp;
    current.rotX += (targetRotX - current.rotX) * rotationLerp;
    current.rotX  = Math.max(-0.25, Math.min(0.25, current.rotX));

    houseModel.rotation.y = current.rotY;
    houseModel.rotation.x = current.rotX;

    mouseDelta.x = 0;
    mouseDelta.y = 0;
  }

  renderer.render(scene, camera);
}

animate();