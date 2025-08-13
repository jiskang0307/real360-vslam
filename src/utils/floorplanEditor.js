import * as THREE from 'three'
import * as dat from 'dat.gui'

export function addFloorplanToScene({
  scene,
  camera,
  controls,
  renderer,
  container,
  pointCloudMinZ = 0,
  pointCloudCenter = new THREE.Vector3(),
  texturePath = '/floorplans/nav_deck.png'
}) {
  let dragging = false
  let draggingMode = 'none'
  let prevMouse = { x: 0, y: 0 }
  let dragTarget = null
  let imagePlane = null
  let resizeHandle = null
  let moveArrowX = null
  let moveArrowY = null
  let rotateCircleX = null
  let rotateCircleY = null
  let rotateCircleZ = null
  let startScale = new THREE.Vector2(1, 1)
  let startMouse = new THREE.Vector2()
  let imageAspect = 1
  let originalWidth = 1
  let originalHeight = 1
  let originalCameraUp = camera.up.clone()
  let originalCameraPos = camera.position.clone()
  let originalControlsTarget = controls.target.clone()


  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(texturePath, (texture) => {
    const img = texture.image
    imageAspect = img.naturalWidth / img.naturalHeight
    const height = 10
    const width = height * imageAspect
    originalWidth = width
    originalHeight = height

    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    imagePlane = new THREE.Mesh(geometry, material)
    imagePlane.position.set(0, 0, pointCloudMinZ - pointCloudCenter.z)
    scene.add(imagePlane)

    const handleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3)

    resizeHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }))
    resizeHandle.position.set(width / 2, -height / 2, 0.01)
    imagePlane.add(resizeHandle)

    moveArrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0.01), 5, 0x00ff00)
    moveArrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0.01), 3, 0x0000ff)
    imagePlane.add(moveArrowX)
    imagePlane.add(moveArrowY)

    const ringGeoX = new THREE.RingGeometry(1.6, 1.8, 64)
    const ringMatX = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
    rotateCircleX = new THREE.Mesh(ringGeoX, ringMatX)
    rotateCircleX.rotation.set(0, 0, Math.PI / 2)
    rotateCircleX.position.set(0, 0, 0.01)
    imagePlane.add(rotateCircleX)

    const ringGeoY = new THREE.RingGeometry(1.6, 1.8, 64)
    const ringMatY = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    rotateCircleY = new THREE.Mesh(ringGeoY, ringMatY)
    rotateCircleY.rotation.set(0, Math.PI / 2, 0)
    rotateCircleY.position.set(0, 0, 0.01)
    imagePlane.add(rotateCircleY)

    const ringGeoZ = new THREE.RingGeometry(1.6, 1.8, 64)
    const ringMatZ = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide })
    rotateCircleZ = new THREE.Mesh(ringGeoZ, ringMatZ)
    rotateCircleZ.rotation.set(Math.PI / 2, 0, 0)
    rotateCircleZ.position.set(0, 0, 0.01)
    imagePlane.add(rotateCircleZ)

    updateToolVisibility()
  })

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!imagePlane) return
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const interactiveObjects = []
    if (draggingMode === 'resize' && resizeHandle) interactiveObjects.push(resizeHandle)
    if (draggingMode === 'move') {
      if (moveArrowX) interactiveObjects.push(moveArrowX.cone)
      if (moveArrowY) interactiveObjects.push(moveArrowY.cone)
    }
    if (draggingMode === 'rotate') {
      if (rotateCircleX) interactiveObjects.push(rotateCircleX)
      if (rotateCircleZ) interactiveObjects.push(rotateCircleZ)
      if (rotateCircleY) interactiveObjects.push(rotateCircleY)
    }

    const intersects = raycaster.intersectObjects(interactiveObjects)
      if (intersects.length > 0) {
        dragging = true
        dragTarget = intersects[0].object
        controls.enabled = false
        prevMouse.x = event.clientX
        prevMouse.y = event.clientY

        // 초기 마우스 위치와 스케일 저장
        startMouse.set(event.clientX, event.clientY)
        startScale.set(imagePlane.scale.x, imagePlane.scale.y)
        if (imagePlane) {
          startScale.set(imagePlane.scale.x, imagePlane.scale.y)
        }
      }
  })

  renderer.domElement.addEventListener('pointerup', () => {
    dragging = false
    dragTarget = null
    controls.enabled = true
  })

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (dragging && imagePlane && dragTarget) {
      const dx = event.clientX - prevMouse.x
      const dy = event.clientY - prevMouse.y

      if (draggingMode === 'resize') {
        const delta = event.clientX - startMouse.x
        const scaleFactor = 1 + delta * 0.01

        const newScaleX = Math.max(0.1, startScale.x * scaleFactor)
        const newScaleY = Math.max(0.1, startScale.y * scaleFactor)

        imagePlane.scale.set(newScaleX, newScaleY, 1)
        updateResizeHandlePosition()
      } else if (draggingMode === 'move') {
        if (dragTarget === moveArrowX.cone) {
          const dir = new THREE.Vector3(1, 0, 0)
          dir.applyQuaternion(imagePlane.quaternion)
          imagePlane.position.addScaledVector(dir, dx * 0.05)
        }

        if (dragTarget === moveArrowY.cone) {
          const dir = new THREE.Vector3(0, 1, 0)
          dir.applyQuaternion(imagePlane.quaternion)
          imagePlane.position.addScaledVector(dir, -dy * 0.05)
        }
      } else if (draggingMode === 'rotate') {
        if (dragTarget === rotateCircleX) imagePlane.rotation.z -= dy * 0.01
        if (dragTarget === rotateCircleY) imagePlane.rotation.x += dy * 0.01
        if (dragTarget === rotateCircleZ) imagePlane.rotation.y += dx * 0.01
      }

      prevMouse.x = event.clientX
      prevMouse.y = event.clientY
    }
  })

  const gui = new dat.GUI({ width: 220 })
  gui.domElement.style.position = 'absolute'
  gui.domElement.style.top = '100px'
  gui.domElement.style.right = '10px'
  gui.domElement.style.zIndex = '100'
  container.appendChild(gui.domElement)

  const state = {
    mode: 'None',
    camera2D: false
  }

  gui.add(state, 'mode', ['None', 'Move', 'Rotate', 'Resize']).name('Tool Mode').onChange(val => {
    draggingMode = val.toLowerCase()
    updateToolVisibility()
  })

  gui.add(state, 'camera2D').name('2D View').onChange(enabled => {
    if (enabled) {
      camera.position.set(0, 0, 10)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)

      controls.target.set(0, 0, 0)
      controls.enableRotate = false
      controls.enablePan = false
      controls.enableZoom = true
      controls.minPolarAngle = 0
      controls.maxPolarAngle = 0
      controls.update()
    } else {
      camera.position.copy(originalCameraPos)
      camera.up.copy(originalCameraUp)
      camera.lookAt(originalControlsTarget)

      controls.target.copy(originalControlsTarget)
      controls.enableRotate = true
      controls.enablePan = true
      controls.enableZoom = true
      controls.minPolarAngle = 0
      controls.maxPolarAngle = Math.PI / 2
      controls.update()
    }
  })

  function updateToolVisibility() {
    const isResize = draggingMode === 'resize'
    const isMove = draggingMode === 'move'
    const isRotate = draggingMode === 'rotate'

    if (resizeHandle) resizeHandle.visible = isResize
    if (moveArrowX) moveArrowX.visible = isMove
    if (moveArrowY) moveArrowY.visible = isMove
    if (rotateCircleX) rotateCircleX.visible = isRotate
    if (rotateCircleZ) rotateCircleZ.visible = isRotate
    if (rotateCircleY) rotateCircleY.visible = isRotate
  }

  function updateResizeHandlePosition() {
    if (!resizeHandle || !imagePlane) return

    resizeHandle.position.set(originalWidth / 2, -originalHeight / 2, 0.01)
  }

}