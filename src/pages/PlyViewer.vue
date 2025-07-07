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
     <PointCloudViewer
      @sphere-selected="handleSphereSelected"
      @loading="isLoading = $event"
      @progress="progress = $event"
      ref="cloudViewer"
    />

    <div class="q-gutter-sm q-mt-md">
      <q-btn label="도면 불러오기" @click="loadFloorplan" color="primary" />
      <q-btn label="카메라 Pose 로딩" @click="loadCameraPoses" color="secondary" />
    </div>

    <PanoramaViewer v-if="showingImage" :imagePath="currentImagePath" @close="showingImage = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PointCloudViewer from '../components/PointCloudViewer.vue'
import PanoramaViewer from '../components/PanoramaViewer.vue'
import axios from 'axios'

const isLoading = ref(false)
const showingImage = ref(false)
const currentImagePath = ref('')
const cloudViewer = ref(null)
const progress = ref(0)

function handleSphereSelected(index, imagePath) {
  currentImagePath.value = imagePath
  showingImage.value = true
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
