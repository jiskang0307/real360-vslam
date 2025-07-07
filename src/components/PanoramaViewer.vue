<template>
  <div ref="panoramaContainer" class="shrinked-viewer">
    <q-btn flat dense icon="close" size="sm" style="position: absolute; top: 0; right: 0; z-index: 10000" @click.stop="close" />
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import * as PANOLENS from 'panolens'

const props = defineProps({ imagePath: String })
const emit = defineEmits(['close'])
const panoramaContainer = ref(null)
let panolensViewer = null

function close() {
  emit('close')
}

watch(() => props.imagePath, (newPath) => {
  if (newPath) {
    if (panolensViewer) {
      panolensViewer.dispose()
      panoramaContainer.value.innerHTML = ''
    }
    const panorama = new PANOLENS.ImagePanorama(newPath)
    panolensViewer = new PANOLENS.Viewer({ container: panoramaContainer.value, autoRotate: false, controlBar: true })
    panolensViewer.add(panorama)
  }
})

onBeforeUnmount(() => {
  panolensViewer?.dispose()
})
</script>

<style scoped>
.shrinked-viewer {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 200px;
  z-index: 9999;
  box-shadow: 0 0 10px #000;
  border: 2px solid #ccc;
}
</style>
