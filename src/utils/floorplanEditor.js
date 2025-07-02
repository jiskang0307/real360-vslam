import * as THREE from 'three'
import * as dat from 'dat.gui'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

export function addFloorplanToScene({
  scene,
  camera,
  controls,
  renderer,
  container,
  pointCloudMinZ = 0,
  pointCloudCenter = new THREE.Vector3(),
  texturePath = '/floorplans/office_plan.png'
}) {
  const textureLoader = new THREE.TextureLoader()

  textureLoader.load(texturePath, (texture) => {
    const img = texture.image
    const imageAspect = img.naturalWidth / img.naturalHeight
    const height = 10
    const width = height * imageAspect

    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    const imagePlane = new THREE.Mesh(geometry, material)
    imagePlane.position.set(0, 0, pointCloudMinZ - pointCloudCenter.z)
    scene.add(imagePlane)

    // 🌟 TransformControls 추가
    const transformControls = new TransformControls(camera, renderer.domElement)
    transformControls.attach(imagePlane)
    scene.add(transformControls)

    // OrbitControls와 충돌 방지
    transformControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value
    })

    // 🛠 dat.GUI 구성
    const gui = new dat.GUI({ width: 220 })
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.top = '100px'
    gui.domElement.style.right = '10px'
    gui.domElement.style.zIndex = '100'
    container.appendChild(gui.domElement)

    const state = {
      mode: 'translate',
      space: 'local',
      camera2D: false
    }

    gui.add(state, 'mode', ['translate', 'rotate', 'scale']).name('Transform Mode').onChange(val => {
      transformControls.setMode(val)
    })

    gui.add(state, 'space', ['local', 'world']).name('Coord Space').onChange(val => {
      transformControls.setSpace(val)
    })

    gui.add(state, 'camera2D').name('2D View').onChange(enabled => {
      if (enabled) {
        camera.position.set(0, 0, 10)
        camera.up.set(0, 1, 0)
        camera.lookAt(0, 0, 0)
        controls.enableRotate = false
        controls.enablePan = false
        controls.enableZoom = true
        controls.object.position.set(0, 0, 10)
        controls.target.set(0, 0, 0)
      } else {
        controls.enableRotate = true
        controls.enablePan = true
        controls.enableZoom = true
      }
    })

    // 초기 설정 적용
    transformControls.setMode(state.mode)
    transformControls.setSpace(state.space)
  })
}
