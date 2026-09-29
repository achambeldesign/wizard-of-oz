/* ------------------ Nuvens e Casa ------------------ */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'addons/loaders/DRACOLoader.js';

//Variáveis globais  
let camera, scene, renderer;
const container = document.querySelector('.nuvens');

//Cloud shader (parametros para o shader das nuvens)
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
  renderer.setPixelRatio(window.devicePixelRatio);
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
  keyLight.shadow.mapSize.width  = 2048;
  keyLight.shadow.mapSize.height = 2048;
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
    'https://mrdoob.com/lab/javascript/webgl/clouds/cloud10.png',
    (tex) => {
      createCloudLayers(tex);
      if (window._loadHouse) loadHouse();
    }
  );
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
  const geometries = [];
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

    const g = plane.clone();
    g.applyMatrix4(obj.matrix);
    geometries.push(g);
  }

  const merged = BufferGeometryUtils.mergeGeometries(geometries);
  return new THREE.Mesh(merged, mat);
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
    { mesh: back,  speed: 0.35, limit: 600 },
    { mesh: mid,   speed: 0.55, limit: 600 },
    { mesh: front, speed: 0.85, limit: 600 }
  );
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

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(
    './model/House.glb',
    (gltf) => {
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
    (xhr) => console.log((xhr.loaded / xhr.total * 100).toFixed(1) + '% carregado'),
    (err) => console.error('Erro ao carregar casa:', err)
  );
}

/*----------------- Animação das nuvens -----------------*/
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // Movimento contínuo e limpo das nuvens
  for (const layer of cloudLayers) {
    layer.mesh.position.x -= layer.speed;
    if (layer.mesh.position.x < -layer.limit) {
      layer.mesh.position.x = layer.limit;
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

    current.x += (targetX - current.x) * lp;
    current.y += (targetY - current.y) * lp;

    houseModel.position.x = current.x;
    houseModel.position.y = current.y;

    const targetRotY = mouse.x * Math.PI * 0.18;
    const targetRotX = mouse.y * Math.PI * -0.08;

    current.rotY += (targetRotY - current.rotY) * lr;
    current.rotX += (targetRotX - current.rotX) * lr;
    current.rotX  = Math.max(-0.25, Math.min(0.25, current.rotX));

    houseModel.rotation.y = current.rotY;
    houseModel.rotation.x = current.rotX;

    mouseDelta.x = 0;
    mouseDelta.y = 0;
  }

  renderer.render(scene, camera);
}

animate();