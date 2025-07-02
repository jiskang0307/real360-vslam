<template>
  <q-inner-loading :showing="isLoading" label="PLY 파일 로딩 중..." class="absolute-full z-top" />
  <div class="q-pa-md">
    <!-- Three.js container -->
    <div
      ref="container"
      style="width: 100%; height: 80vh; background: black; position: relative;"
    ></div>

    <!-- 버튼 영역 -->
    <div class="q-gutter-sm q-mt-md">
      <q-btn label="도면 불러오기" @click="loadFloorplan" color="primary" />
      <q-btn label="카메라 Pose 로딩" @click="loadCameraPoses" color="secondary" />
    </div>

    <!-- Panolens 360 container -->
    <div
      v-if="showingImage"
      ref="panoramaContainer"
      style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 200px; z-index: 9999;"
    >
      <q-btn
        flat
        dense
        icon="close"
        size="sm"
        style="position: absolute; top: 0; right: 0; z-index: 10000"
        @click.stop="showingImage = false; showingPanorama = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as THREE from 'three'
import * as PANOLENS from 'panolens'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'
import axios from 'axios'

const container = ref(null)
const panoramaContainer = ref(null)
const showingPanorama = ref(false)
const isLoading = ref(false)
let scene, camera, renderer, controls
let floor = null
let pointCloudCenter = new THREE.Vector3()
let pointCloudMinZ = 0
let resizeHandle = null
let moveHandle = null
let rotateHandle = null
let dragging = false
let draggingMode = null
let prevMouse = { x: 0, y: 0 }
let selectedSphere = null

const showingImage = ref(false)
const currentImagePath = ref('')

let panolensViewer = null

function showPanorama(imagePath) {
  showingPanorama.value = true
  nextTick(() => {
    const panorama = new PANOLENS.ImagePanorama(imagePath)
    if (!panolensViewer) {
      panolensViewer = new PANOLENS.Viewer({
        container: panoramaContainer.value,
        autoRotate: false,
        controlBar: true,
      })
    } else {
      panolensViewer.dispose()
      panoramaContainer.value.innerHTML = ''
      panolensViewer = new PANOLENS.Viewer({
        container: panoramaContainer.value,
        autoRotate: false,
        controlBar: true,
      })
    }
    panolensViewer.add(panorama)
  })
}

function showImage(path) {
  currentImagePath.value = path
  showingImage.value = true
  showPanorama(path)


}

function isTopView(camera) {
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  return Math.abs(dir.x) < 0.3 && Math.abs(dir.y) < 0.3 && dir.z < -0.9
}

onMounted(async () => {
  await nextTick()

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, container.value.clientWidth / container.value.clientHeight, 0.01, 1000)
  camera.up.set(0, 0, 1)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.setClearColor(0x111111)
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.15
  controls.enableZoom = true
  controls.enablePan = true
  controls.minPolarAngle = 0
  controls.maxPolarAngle = Math.PI / 2
  controls.panSpeed = 2.0
  // controls.rotateSpeed = -1.0  // ← 회전 방향 반전


  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  const loader = new PLYLoader()
  isLoading.value = true
  loader.load('/pointclouds/sample_8k.ply', async (geometry) => {
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    const center = new THREE.Vector3()
    geometry.boundingBox.getCenter(center)
    pointCloudCenter.copy(center)
    pointCloudMinZ = geometry.boundingBox.min.z

    const material = new THREE.PointsMaterial({ size: 0.01, vertexColors: true })
    const pointCloud = new THREE.Points(geometry, material)
    pointCloud.position.sub(center)
    pointCloud.rotation.x = -Math.PI / 2
    scene.add(pointCloud)

    camera.position.set(0, 0, 20)
    camera.lookAt(0, 0, 0)
    controls.target.set(0, 0, 0)
    isLoading.value = false
  }, undefined, (err) => {
    console.error('PLY 로딩 실패:', err)
    isLoading.value = false
  })

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!resizeHandle || !moveHandle || !rotateHandle) return
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects([resizeHandle, moveHandle, rotateHandle])
    if (intersects.length > 0) {
      dragging = true
      draggingMode = intersects[0].object === resizeHandle
        ? 'resize'
        : intersects[0].object === rotateHandle
        ? 'rotate'
        : 'move'
      controls.enabled = false
      prevMouse.x = event.clientX
      prevMouse.y = event.clientY
    }
  })

  renderer.domElement.addEventListener('pointerup', () => {
    dragging = false
    draggingMode = null
    controls.enabled = true
  })

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (dragging && floor) {
      const dx = event.clientX - prevMouse.x
      const dy = event.clientY - prevMouse.y

      if (draggingMode === 'resize') {
        const delta = (dx - dy) * 0.005
        floor.scale.x += delta
        floor.scale.y += delta
        floor.scale.z = 1
      } else if (draggingMode === 'move') {
        floor.position.x += dx * 0.01
        floor.position.y -= dy * 0.01
      } else if (draggingMode === 'rotate') {
        floor.rotation.z += dx * 0.01
      }

      prevMouse.x = event.clientX
      prevMouse.y = event.clientY
    }
  })

  renderer.domElement.addEventListener('dblclick', (event) => {
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const redSpheres = scene.children.filter(obj =>
      obj.isMesh && obj.material?.color?.getHex() === 0xff0000
    )

    const intersects = raycaster.intersectObjects(redSpheres)
    if (intersects.length > 0) {
        const hit = intersects[0].object

        // ✅ 기존 선택된 구 색 되돌리기
        if (selectedSphere) {
          selectedSphere.material.color.set(0xff0000)
        }

        // ✅ 새로 선택한 구 색 바꾸기
        hit.material.color.set(0xffff00) // 노란색
        selectedSphere = hit

        const { imagePath } = hit.userData
        showImage(imagePath)
      }
  })

  const animate = () => {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
    if (resizeHandle) resizeHandle.visible = isTopView(camera)
  }
  animate()
})

function renderCameraPoses(poses) {
  const sphereGeo = new THREE.SphereGeometry(0.1, 16, 16)

  const rotMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2)

  for (let i = 0; i < poses.length; i++) {
    const { x, y, z } = poses[i]
    const originalPos = new THREE.Vector3(x, y, z)
    const rotatedPos = originalPos.clone().applyMatrix4(rotMatrix).sub(pointCloudCenter)
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.copy(rotatedPos)
    sphere.userData = {
      index: i,
      imagePath: `/images/keyframe_${i}.jpg`,
    }
    scene.add(sphere)

    if (i < poses.length - 1) {
      const next = poses[i + 1]
      const nextPos = new THREE.Vector3(next.x, next.y, next.z)
        .applyMatrix4(rotMatrix)
        .sub(pointCloudCenter)

      const dir = new THREE.Vector3().subVectors(nextPos, rotatedPos)
      const length = dir.length()
      if (length > 0) {
        const arrow = new THREE.ArrowHelper(
          dir.clone().normalize(),
          rotatedPos,
          length,
          0x0000ff
        )
        scene.add(arrow)
      }
    }
  }
}

const loadCameraPoses = async () => {
  try {
    const { data } = await axios.get('/api/poses')
    const scaleFactor = 0.8
    const poses = data.map((p) => {
      const { tx, ty, tz } = p
      return { x: tx * scaleFactor, y: ty * scaleFactor, z: tz * scaleFactor }
    }).filter(Boolean)

    renderCameraPoses(poses)

    if (poses.length > 0) {
      const { x, y, z } = poses[0]
      camera.position.set(x, y - 2, z + 2)
      camera.lookAt(x, y, z)
    }
  } catch (err) {
    console.error('pose 로딩 실패:', err)
  }
}

const loadFloorplan = async () => {
  const geometry = new THREE.PlaneGeometry(10, 5)
  const texture = await new Promise((resolve, reject) => {
    new THREE.TextureLoader().load('/floorplans/office_plan.png', resolve, undefined, reject)
  })

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  })

  floor = new THREE.Mesh(geometry, material)
  floor.rotation.x = 0
  floor.position.set(0, 0, pointCloudMinZ - pointCloudCenter.z)
  scene.add(floor)

  const handleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.1)

  resizeHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }))
  resizeHandle.position.set(5, -2.5, 0.01)
  floor.add(resizeHandle)

  moveHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }))
  moveHandle.position.set(0, 0, 0.01)
  floor.add(moveHandle)

  rotateHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0x0000ff }))
  rotateHandle.position.set(-5, 2.5, 0.01)
  floor.add(rotateHandle)
}
</script>

<style scoped>
canvas {
  display: block;
}

.shrinked-viewer {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px !important;
  height: 200px !important;
  z-index: 9999;
  box-shadow: 0 0 10px #000;
  border: 2px solid #ccc;
}

.image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: black;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>