<template>
  <q-page class="q-pa-md">
    <div ref="container" style="width: 100%; height: 80vh; background: black;"></div>
    <q-btn label="Pose 불러오기" @click="loadCameraPoses" color="primary" class="q-mt-md" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import axios from 'axios'

const container = ref(null)
let scene, camera, renderer, controls

onMounted(async () => {
  await nextTick()

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, container.value.clientWidth / container.value.clientHeight, 0.01, 1000)
  camera.up.set(0, 0, 1)
  camera.position.set(0, 0, 10)
camera.aspect = container.value.clientWidth / container.value.clientHeight
camera.updateProjectionMatrix()

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  container.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(1, 1, 1)
  scene.add(light)
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  animate()
})
function renderCameraPoses(poses) {
  const sphereGeo = new THREE.SphereGeometry(0.1, 16, 16)
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 })

  for (let i = 0; i < poses.length; i++) {
    const { x, y, z } = poses[i]
    const pos = new THREE.Vector3(x, y, z)

    // 🔴 빨간 구 생성
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.copy(pos)
    scene.add(sphere)

    // 🔵 파란색 화살표로 다음 포즈와 연결
    if (i < poses.length - 1) {
      const next = poses[i + 1]
      const nextPos = new THREE.Vector3(next.x, next.y, next.z)
      const dir = new THREE.Vector3().subVectors(nextPos, pos)
      const length = dir.length()
      if (length > 0) {
        const arrow = new THREE.ArrowHelper(
          dir.clone().normalize(), // 방향
          pos,                     // 시작 위치
          length,                  // 길이
          0x0000ff                 // 파란색
        )
        scene.add(arrow)
      }
    }
  }
}

const loadCameraPoses = async () => {
  try {
    const { data } = await axios.get('/api/poses')  // ✅ JSON 응답 받음

    // 구조 확인
    console.log('📦 받아온 pose JSON:', data)
    console.log('✅ pose 개수:', data.length)

    // pose 배열에서 {x,y,z} 추출 (tx, ty, tz → x, y, z로 매핑)
    const poses = data.map((p, i) => {
      const { tx, ty, tz } = p
      if ([tx, ty, tz].some(v => v === undefined)) {
        console.warn(`❌ pose[${i}] 필드 누락`, p)
        return null
      }
      return { x: tx, y: ty, z: tz }
    }).filter(Boolean)

    console.log('✅ 변환된 poses:', poses)
    renderCameraPoses(poses)

    if (poses.length > 0) {
      const { x, y, z } = poses[0]
      camera.position.set(x, y - 2, z + 2)
      camera.lookAt(x, y, z)
    }

  } catch (err) {
    console.error('❌ pose 로딩 실패:', err)
  }
}





function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}
</script>

<style scoped>
canvas {
  display: block;
}
</style>