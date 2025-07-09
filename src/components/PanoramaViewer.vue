<template>
  <div ref="panoramaContainer" class="shrinked-viewer">
    <q-btn flat dense icon="close" size="sm" style="position: absolute; top: 0; right: 0; z-index: 10000" @click.stop="close" />
  </div>
</template>
<script setup>
import { ref, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import * as PANOLENS from 'panolens'

const props = defineProps({ imagePath: String })
const emit = defineEmits(['close', 'view-direction'])
const panoramaContainer = ref(null)
let panolensViewer = null
let panorama = null

function close() {
  emit('close')
}

async function loadPanorama(path) {
  await nextTick()
  console.log('📦 container exists?', panoramaContainer.value)
  if (!panoramaContainer.value) return

  console.log('🌀 Panorama path:', path)

  panorama = new PANOLENS.ImagePanorama(path)

  // ✅ 반드시 이벤트 먼저 등록!
  panorama.addEventListener('viewChange', (event) => {
    const yaw = event.longitude
    console.log('📡 Panorama yaw emitted:', yaw)
    emit('view-direction', yaw)
  })

  // ✅ Panorama enter 로그도 추가
  panorama.addEventListener('enter', () => {
    console.log('✅ Panorama ENTERED')
  })

  if (!panolensViewer) {
    panolensViewer = new PANOLENS.Viewer({
      container: panoramaContainer.value,
      autoRotate: false,
      controlBar: true
    })
  }

  // ✅ 핵심: add() + setPanorama() 모두 필요
  panolensViewer.add(panorama)
  panolensViewer.setPanorama(panorama)
  console.log('📍 startYawTracking 호출됨')
  
  startYawTracking()
}


watch(() => props.imagePath, (newPath) => {
  if (newPath) {
    // console.log('👀 imagePath changed:', newPath)
    loadPanorama(newPath)
  }
})

onMounted(() => {
  if (props.imagePath) {
    loadPanorama(props.imagePath)
  }
})

onBeforeUnmount(() => {
  panolensViewer?.dispose()
})

let yawInterval = null

function startYawTracking() {
  yawInterval = setInterval(() => {
    if (panolensViewer && panolensViewer.camera) {
      const yaw = panolensViewer.camera.rotation.y
      // console.log('🧭 Current Yaw:', yaw)
      emit('view-direction', yaw)
    } else {
      console.warn('❗ panolensViewer.camera 없음')
    }
  }, 1000)
}


// function stopYawTracking() {
//   if (yawInterval) {
//     clearInterval(yawInterval)
//     yawInterval = null
//   }
// }


</script>


<style scoped>
.shrinked-viewer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background-color: #000;
}

</style>