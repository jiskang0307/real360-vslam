<template>
  <q-inner-loading :showing="isLoading" class="absolute-full z-top">
      <div class="text-white text-center">
        <q-spinner size="50px" color="white" />
        <div class="q-mt-sm">PLY 파일 로딩 중... {{ progress }}%</div>
        <q-linear-progress
          color="white"
          size="10px"
          :value="progress / 100"
          class="q-mt-sm"
        />
      </div>
    </q-inner-loading>
  <div class="q-pa-md">
    <div :class="showingImage ? 'pip-view' : 'full-view'">
      <PointCloudViewer
        @sphere-selected="handleSphereSelected"
        @loading="isLoading = $event"
        @progress="progress = $event"
        ref="cloudViewer"
      />
    </div>

    <!-- PanoramaViewer는 항상 존재하되 show/hide로 컨트롤 -->
    <PanoramaViewer
      v-show="showingImage"
      :imagePath="currentImagePath"
      @close="showingImage = false"
    />

    <div class="q-gutter-sm q-mt-md">
      <q-btn label="도면 불러오기" @click="loadFloorplan" color="primary" />
      <q-btn label="카메라 Pose 로딩" @click="loadCameraPoses" color="secondary" />
    </div>

  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import PointCloudViewer from '../components/PointCloudViewer.vue'
import PanoramaViewer from '../components/PanoramaViewer.vue'
import axios from 'axios'

const isLoading = ref(false)
const showingImage = ref(false)
const currentImagePath = ref('')
const cloudViewer = ref(null)
const progress = ref(0)


async function handleSphereSelected(index, imagePath) {
  const wasAlreadyInPip = showingImage.value

  currentImagePath.value = imagePath
  showingImage.value = true

  // 📌 PiP 상태가 아니었을 때만 카메라 리셋
  if (!wasAlreadyInPip) {
    nextTick(() => {
      setTimeout(() => {
        cloudViewer.value.resizeViewer()
        cloudViewer.value.centerCameraForPip()
      }, 500)
    })
  }
}




function loadFloorplan() {
  cloudViewer.value.addFloorplan('/floorplans/office_plan.png')
}

async function loadCameraPoses() {
  try {
    const { data } = await axios.get('/api/poses')
    const scaleFactor = 0.8
    const poses = data.map((p) => {
      const { tx, ty, tz } = p
      return { x: tx * scaleFactor, y: ty * scaleFactor, z: tz * scaleFactor }
    }).filter(Boolean)

    cloudViewer.value.renderCameraPoses(poses)
  } catch (err) {
    console.error('pose 로딩 실패:', err)
  }
}
</script>

<style scoped>
.full-view {
  width: 100%;
  height: 80vh;
  position: relative;
  transition: all 0.4s ease;
}

.pip-view {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 600px;
  height: 400px;
  z-index: 10000;
  border: 2px solid #888;
  box-shadow: 0 0 10px #000;
  transition: all 0.4s ease;
  opacity: 0.7;
}
</style>