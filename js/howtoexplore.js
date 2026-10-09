// ---------- Controlo para Fechar o Pop-up ----------
const popupOverlay = document.getElementById('popup-folha');
const fecharBtn = document.getElementById('fechar-popup');
const mobileUnavailableQuery = window.matchMedia(
    '(max-width: 767px), (max-height: 500px) and (pointer: coarse)'
);
let popupAtivo = true;

if (fecharBtn && popupOverlay) {
    fecharBtn.addEventListener('click', () => {
        fecharBtn.disabled = true;
        popupOverlay.classList.add('fechando');
        setTimeout(() => {
            popupOverlay.style.display = 'none';
            popupAtivo = false;
            disposeInstructionScene();

            if (typeof activateItem === 'function' && !window.storyStarted) {
                window.storyStarted = true;
                activateItem(0);
            }
        }, 300);
    });
}

// Importações Three.js
import * as THREE from 'three';
import { GLTFLoader } from 'addons/loaders/GLTFLoader.js';

// ---------- Configuração base ----------
const canvas = document.getElementById('instructions');

const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Configurações de cor e sombras
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(0, 0, 1);
camera.lookAt(0, 0, 0);

// ---------- Luzes ----------
const ambient = new THREE.AmbientLight(0xD2B6A5, 0.7);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0x986853, 1);
keyLight.position.set(0, 5, 15);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
keyLight.shadow.camera.near = 0.9;
keyLight.shadow.camera.far = 1000;
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

// Variáveis
let mixer;
const clock = new THREE.Clock();

const folhaGroup = new THREE.Group();
scene.add(folhaGroup);

// Ajuste de posição x
folhaGroup.position.x = -0.628;//-0.62621
let folha;
let animTerminou = false;
let popAnim = false;
let popTime = 0;
const BASE_SCALE = 1.25; //1.2escala um pouco maior para ser legivel as instruções
let animationFrameId = null;
let sceneDisposed = false;

/* ---------- Controlo Rato  ---------- */
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let mouseNeedsRaycast = true;
let touchPointerId = null;

const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    mouseNeedsRaycast = true;
}

window.addEventListener('mousemove', onMouseMove, { passive: true });
function onTouchPointerDown(event) {
    if (event.pointerType !== 'touch' || !animTerminou || !folha || !popupAtivo) return;

    const bounds = canvas.getBoundingClientRect();
    mouse.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.intersectObject(folha, true).length === 0) return;

    event.preventDefault();
    touchPointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    mouseNeedsRaycast = true;
}

function onTouchPointerMove(event) {
    if (event.pointerType !== 'touch' || event.pointerId !== touchPointerId) return;

    const bounds = canvas.getBoundingClientRect();
    mouse.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    mouseNeedsRaycast = true;
}

function stopTouchDrag(event) {
    if (event.pointerId !== touchPointerId) return;

    touchPointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
    }
}

canvas.addEventListener('pointerdown', onTouchPointerDown);
canvas.addEventListener('pointermove', onTouchPointerMove);
canvas.addEventListener('pointerup', stopTouchDrag);
canvas.addEventListener('pointercancel', stopTouchDrag);

/* ---------- Carregar o modelo ---------- */
const loader = new GLTFLoader();

loader.load(
    'model/regras.glb', // 1. glb Instrucoesv2.glb

    (gltf) => {

        if (sceneDisposed) {
            disposeGltfResources(gltf.scene);
            return;
        }

        folha = gltf.scene;

        folha.traverse((node) => {

            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }

        });

        // Centralizar o modelo 3D
        const box = new THREE.Box3().setFromObject(folha);
        const center = box.getCenter(new THREE.Vector3());

        folha.position.sub(center);

        // Escala inicial
        folha.scale.setScalar(BASE_SCALE);

        folhaGroup.add(folha);

        // Animação
        if (gltf.animations && gltf.animations.length > 0) {

            mixer = new THREE.AnimationMixer(folha);

            const action = mixer.clipAction(gltf.animations[0]);

            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            action.play();
            action.timeScale = 0.5;

            mixer.addEventListener('finished', () => {

                animTerminou = true;
                popAnim = true;
                popTime = 0;

            });

        } else {

            animTerminou = true;
            popAnim = true;
            popTime = 0;

        }

    },

    undefined,

    (error) => {
        console.error('Erro:', error);
    }

);

/* ---------- Loop da animação da folha ---------- */
let isVisible = true;
function onVisibilityChange() {
    isVisible = !document.hidden;
    if (!isVisible && animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    } else if (
        isVisible &&
        !mobileUnavailableQuery.matches &&
        !sceneDisposed &&
        animationFrameId === null
    ) {
        animate();
    }
}
document.addEventListener('visibilitychange', onVisibilityChange);

function onDisplayModeChange() {
    if (mobileUnavailableQuery.matches) {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    } else if (isVisible && !sceneDisposed && popupAtivo && animationFrameId === null) {
        animate();
    }
}
mobileUnavailableQuery.addEventListener('change', onDisplayModeChange);

function animate() {
    if (!isVisible || mobileUnavailableQuery.matches || sceneDisposed || !popupAtivo) {
        animationFrameId = null;
        return;
    }

    animationFrameId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (mixer) {
        mixer.update(delta);
    }

    // Efeito Pop up 
    if (popAnim && folha) {

        popTime += delta;

        let scale;
        let t;

        if (popTime < 0.25) {

            t = THREE.MathUtils.smootherstep(popTime / 0.25, 0, 1);
            scale = THREE.MathUtils.lerp(BASE_SCALE, 1.15, t);

        } else if (popTime < 0.50) {

            t = THREE.MathUtils.smootherstep((popTime - 0.25) / 0.25, 0, 1);
            scale = THREE.MathUtils.lerp(1.15, 1.08, t);

        } else if (popTime < 0.75) {

            t = THREE.MathUtils.smootherstep((popTime - 0.50) / 0.25, 0, 1);
            scale = THREE.MathUtils.lerp(1.08, BASE_SCALE, t);

        } else {

            scale = BASE_SCALE;
            popAnim = false;
            
            if (fecharBtn) {
                fecharBtn.classList.add('visivel');
            }
        }

        folha.scale.setScalar(scale);

    }


/* ---------------- Interação com o hover do rato + suave ---------------- */
    if (folha && animTerminou) {
        if (mouseNeedsRaycast) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(folha, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const localPoint = hit.point.clone();
                folha.worldToLocal(localPoint);
                targetRotation.y = localPoint.x * 0.15;
                targetRotation.x = -localPoint.y * 0.15;
            } else {
                targetRotation.x = 0;
                targetRotation.y = 0;
            }

            mouseNeedsRaycast = false;
        }

        currentRotation.x = THREE.MathUtils.lerp(currentRotation.x, targetRotation.x, 0.03);
        currentRotation.y = THREE.MathUtils.lerp(currentRotation.y, targetRotation.y, 0.03);
        folhaGroup.rotation.x = currentRotation.x;
        folhaGroup.rotation.y = currentRotation.y;
    }

    renderer.render(scene, camera);

}

animate();






/* ---------------- Responsividade ---------------- */
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function disposeGltfResources(root) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();

    root.traverse((node) => {
        if (node.geometry) geometries.add(node.geometry);
        const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
        nodeMaterials.filter(Boolean).forEach((material) => {
            materials.add(material);
            Object.values(material).forEach((value) => {
                if (value?.isTexture) textures.add(value);
            });
            Object.values(material.uniforms || {}).forEach(({ value }) => {
                if (value?.isTexture) textures.add(value);
            });
        });
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
}

function disposeInstructionScene() {
    if (sceneDisposed) return;
    sceneDisposed = true;

    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    window.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    mobileUnavailableQuery.removeEventListener('change', onDisplayModeChange);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('pointerdown', onTouchPointerDown);
    canvas.removeEventListener('pointermove', onTouchPointerMove);
    canvas.removeEventListener('pointerup', stopTouchDrag);
    canvas.removeEventListener('pointercancel', stopTouchDrag);
    
    if (folha) disposeGltfResources(folha);
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
}