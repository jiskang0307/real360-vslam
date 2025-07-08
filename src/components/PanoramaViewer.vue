<template>
  <div ref="panoramaContainer" class="shrinked-viewer">
    <q-btn flat dense icon="close" size="sm" style="position: absolute; top: 0; right: 0; z-index: 10000" @click.stop="close" />
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import * as PANOLENS from 'panolens'

const props = defineProps({ imagePath: String })
const emit = defineEmits(['close'])
const panoramaContainer = ref(null)
let panolensViewer = null

function close() {
  emit('close')
}

async function loadPanorama(path) {
  // DOM이 아직 준비 안 됐을 수도 있으므로 nextTick 보장
  await nextTick()

  if (!panoramaContainer.value) return

  if (panolensViewer) {
    panolensViewer.dispose()
    panoramaContainer.value.innerHTML = ''
  }

  const panorama = new PANOLENS.ImagePanorama(path)
  panolensViewer = new PANOLENS.Viewer({
    container: panoramaContainer.value,
    autoRotate: false,
    controlBar: true
  })
  panolensViewer.add(panorama)
}

watch(() => props.imagePath, (newPath) => {
  if (newPath) loadPanorama(newPath)
})

onMounted(() => {
  if (props.imagePath) {
    loadPanorama(props.imagePath)
  }
})

onBeforeUnmount(() => {
  panolensViewer?.dispose()
})


// watch(() => props.imagePath, (newPath) => {
//   if (newPath) {
//     if (panolensViewer) {
//       panolensViewer.dispose()
//       panoramaContainer.value.innerHTML = ''
//     }
//     const panorama = new PANOLENS.ImagePanorama(newPath)
//     panolensViewer = new PANOLENS.Viewer({ container: panoramaContainer.value, autoRotate: false, controlBar: true })
//     panolensViewer.add(panorama)
//   }
// })

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