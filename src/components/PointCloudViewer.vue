<template>
  <div ref="container" class="viewer-container"></div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, defineExpose } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader'
import { addFloorplanToScene } from '../utils/floorplanEditor'
// import ResizeObserver from 'resize-observer-polyfill'
import { createFovSector } from '../utils/viewDirection'

const emit = defineEmits(['sphere-selected', 'loading', 'progress'])
const container = ref(null)
let scene, camera, renderer, controls
let floor = null
let pointCloudCenter = new THREE.Vector3()
let pointCloudMinZ = 0
let selectedSphere = null
let resizeHandle = null
let moveHandle = null
let rotateHandle = null
let dragging = false
let draggingMode = null
let prevMouse = { x: 0, y: 0 }
let fovSector = null
let fovArrow = null

function isTopView(camera) {
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  return Math.abs(dir.x) < 0.3 && Math.abs(dir.y) < 0.3 && dir.z < -0.9
}

onMounted(async () => {
  await nextTick()
  emit('loading', true)
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  const loader = new PLYLoader()
  loader.load('/pointclouds/sample_8k.ply', (geometry) => {
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
    let step = 81
    const interval = setInterval(() => {
      emit('progress', step)
      step++
      if (step >= 100) {
        clearInterval(interval)
        emit('loading', false)
        emit('progress', 100)
      }
    }, 20)

    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
  }, (xhr) => {
    if (xhr.lengthComputable) {
      const percent = Math.round((xhr.loaded / xhr.total) * 80) // max 80%
      emit('progress', percent)
    }
  },
  (err) => {
    console.error('PLY 로딩 실패:', err)
    emit('loading', false)
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
      draggingMode = intersects[0].object === resizeHandle ? 'resize' : intersects[0].object === rotateHandle ? 'rotate' : 'move'
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
    const redSpheres = scene.children.filter(obj => obj.isMesh && obj.material?.color?.getHex() === 0xff0000)

    const intersects = raycaster.intersectObjects(redSpheres)
    if (intersects.length > 0) {
      const hit = intersects[0].object

      if (selectedSphere) {
        selectedSphere.material.color.set(0xff0000)
      }

      hit.material.color.set(0xffff00)
      selectedSphere = hit

      const { imagePath } = hit.userData
      emit('sphere-selected', hit.userData.index, imagePath)
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
    sphere.userData = { index: i, imagePath: `/images/keyframe_${i}.jpg` }
    scene.add(sphere)

    if (i < poses.length - 1) {
      const next = poses[i + 1]
      const nextPos = new THREE.Vector3(next.x, next.y, next.z)
        .applyMatrix4(rotMatrix)
        .sub(pointCloudCenter)

      const dir = new THREE.Vector3().subVectors(nextPos, rotatedPos)
      const length = dir.length()
      if (length > 0) {
        const arrow = new THREE.ArrowHelper(dir.clone().normalize(), rotatedPos, length, 0x0000ff)
        scene.add(arrow)
      }
    }
  }
}

function addFloorplan(imagePath) {
  addFloorplanToScene({
    scene, camera, controls, renderer, container: container.value, pointCloudMinZ, pointCloudCenter
  }, imagePath)
}

function centerCamera() {
  if (!camera || !controls) return

  camera.position.set(0, 0, 0)
  controls.target.set(0, 0, 0)
  camera.lookAt(0, 0, 0)
  controls.update()
}

function centerCameraForPip() {
  if (!camera || !controls || !container.value || !renderer) return

  // 1. 크기 계산
  // const width = container.value.clientWidth
  // const height = container.value.clientHeight
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()


  // 2. 카메라 위치 설정 (너무 가까우면 벗어남)
  camera.position.set(0, 0, 0)  // PiP에서도 중심을 포함할 수 있는 적당한 거리

  // 3. 중심 설정
  controls.target.set(0, 0, 0)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  controls.update()
  controls.enableZoom = true
  // 4. 🚨 한 프레임 뒤에 다시 강제 update
  requestAnimationFrame(() => {
    controls.update()
    renderer.render(scene, camera)
  })
}


function resizeViewer() {
  if (!container.value || !renderer || !camera) return

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function watchResizeAndCenter() {
  if (!container.value) return

  const observer = new ResizeObserver(() => {
    // 실제로 크기가 바뀐 다음에 실행
    resizeViewer()
    centerCamera()
    observer.disconnect() // 한 번만 실행
  })

  observer.observe(container.value)
}


function updateViewingDirection(index, yaw) {
  const sphere = scene.children.find(obj => obj.userData?.index === index)
  if (!sphere) {
    console.warn('❗ sphere not found for index', index)
    return
  }

  // 이전 화살표 제거
  if (fovArrow) {
    scene.remove(fovArrow)
    fovArrow = null
  }

  // yaw -> 방향 벡터로 변환 (z축 기준 yaw)
  const dir = new THREE.Vector3(Math.cos(yaw), Math.sin(yaw), 0)

  // ArrowHelper 생성
  fovArrow = new THREE.ArrowHelper(
    dir.clone().normalize(),     // 방향
    sphere.position.clone(),     // 시작 위치
    1.5,                         // 길이
    0x00ff00                     // 색상 (녹색)
  )

  scene.add(fovArrow)
}

defineExpose({ renderCameraPoses, addFloorplan, centerCamera, resizeViewer, centerCameraForPip, watchResizeAndCenter, updateViewingDirection })

onBeforeUnmount(() => {
  renderer.dispose()
  controls.dispose()
})
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  background: black;
  position: relative;
  overflow: hidden;
}
</style>