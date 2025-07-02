<template>
  <q-page class="q-pa-md">
    <div ref="threeContainer" style="width: 100%; height: 80vh; background: #111; position: relative;" />
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';

const threeContainer = ref();
let dragging = false;
let draggingMode = null;
let prevMouse = { x: 0, y: 0 };
let dragTarget = null;
let imagePlane = null;
let resizeHandle = null;
let moveArrowX = null;
let moveArrowY = null;
let rotateCircleZ = null;
let rotateCircleY = null;
let controls = null;
let camera = null;
let scene = null;

onMounted(() => {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, threeContainer.value.clientWidth / threeContainer.value.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight);
  threeContainer.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;


  const textureLoader = new THREE.TextureLoader();
  textureLoader.load('/floorplans/office_plan.png', (texture) => {
    const aspect = texture.image.width / texture.image.height;
    const height = 2;
    const width = height * aspect;

    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    imagePlane = new THREE.Mesh(geometry, material);
    scene.add(imagePlane);

    const handleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    resizeHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    resizeHandle.position.set(width / 2, -height / 2, 0.01);
    imagePlane.add(resizeHandle);

    moveArrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0.01), 1, 0x00ff00);
    moveArrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0.01), 1, 0x0000ff);
    imagePlane.add(moveArrowX);
    imagePlane.add(moveArrowY);

    const ringGeoZ = new THREE.RingGeometry(0.6, 0.65, 32);
    const ringMatZ = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
    rotateCircleZ = new THREE.Mesh(ringGeoZ, ringMatZ);
    rotateCircleZ.rotation.x = Math.PI / 2;
    rotateCircleZ.position.set(0, 0, 0.01);
    imagePlane.add(rotateCircleZ);

    const ringGeoY = new THREE.RingGeometry(0.7, 0.75, 32);
    const ringMatY = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
    rotateCircleY = new THREE.Mesh(ringGeoY, ringMatY);
    rotateCircleY.rotation.x = Math.PI / 2;
    rotateCircleY.position.set(0, 0, 0.01);
    imagePlane.add(rotateCircleY);

    updateToolVisibility();
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!imagePlane) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const interactiveObjects = [];
    if (draggingMode === 'resize' && resizeHandle) interactiveObjects.push(resizeHandle);
    if (draggingMode === 'move') {
      if (moveArrowX) interactiveObjects.push(moveArrowX.cone);
      if (moveArrowY) interactiveObjects.push(moveArrowY.cone);
    }
    if (draggingMode === 'rotate') {
      if (rotateCircleZ) interactiveObjects.push(rotateCircleZ);
      if (rotateCircleY) interactiveObjects.push(rotateCircleY);
    }

    const intersects = raycaster.intersectObjects(interactiveObjects);
    if (intersects.length > 0) {
      dragging = true;
      dragTarget = intersects[0].object;
      controls.enabled = false;
      prevMouse.x = event.clientX;
      prevMouse.y = event.clientY;
    }
  });

  renderer.domElement.addEventListener('pointerup', () => {
    dragging = false;
    dragTarget = null;
    controls.enabled = true;
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (dragging && imagePlane && dragTarget) {
      const dx = event.clientX - prevMouse.x;
      const dy = event.clientY - prevMouse.y;

      if (draggingMode === 'resize') {
        imagePlane.scale.x += dx * 0.01;
        imagePlane.scale.y -= dy * 0.01;
        imagePlane.scale.z = 1;
      } else if (draggingMode === 'move') {
        if (dragTarget === moveArrowX.cone) imagePlane.position.x += dx * 0.01;
        if (dragTarget === moveArrowY.cone) imagePlane.position.y -= dy * 0.01;
      } else if (draggingMode === 'rotate') {
        if (dragTarget === rotateCircleZ) imagePlane.rotation.z += dy * 0.01;
        if (dragTarget === rotateCircleY) imagePlane.rotation.y += dx * 0.01;
      }

      prevMouse.x = event.clientX;
      prevMouse.y = event.clientY;
    }
  });

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  animate();

  const gui = new dat.GUI({ width: 220 });
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.top = '100px';
  gui.domElement.style.right = '10px';
  gui.domElement.style.zIndex = '100';

  const state = {
    mode: 'None',
    camera2D: false
  };

  gui.add(state, 'mode', ['None', 'Move', 'Rotate', 'Resize']).name('Tool Mode').onChange(val => {
    draggingMode = val.toLowerCase();
    updateToolVisibility();
  });

  gui.add(state, 'camera2D').name('2D View').onChange(enabled => {
    if (enabled) {
      camera.position.set(0, 0, 10);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.object.position.set(0, 0, 10);
      controls.target.set(0, 0, 0);
    } else {
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableZoom = true;
    }
  });

  function updateToolVisibility() {
    if (!resizeHandle || !moveArrowX || !moveArrowY || !rotateCircleZ || !rotateCircleY) return;
    const isResize = draggingMode === 'resize';
    const isMove = draggingMode === 'move';
    const isRotate = draggingMode === 'rotate';

    resizeHandle.visible = isResize;
    moveArrowX.visible = isMove;
    moveArrowY.visible = isMove;
    rotateCircleZ.visible = isRotate;
    rotateCircleY.visible = isRotate;
  }
});
</script>

<style scoped>
canvas {
  display: block;
}
</style>
