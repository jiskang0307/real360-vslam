import * as THREE from 'three'

export function createFovSector(origin, yaw, fov = Math.PI / 3, radius = 1.5, segments = 32) {
  const geometry = new THREE.BufferGeometry()
  const vertices = []
  const center = new THREE.Vector3(0, 0, 0)
  vertices.push(center.x, center.y, center.z)

  const startAngle = yaw - fov / 2
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (i / segments) * fov
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    vertices.push(x, y, 0)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: false,
    side: THREE.DoubleSide,
    depthTest: true
  })

  const mesh = new THREE.Mesh(geometry, material)

  mesh.rotation.x = Math.PI / 2
  mesh.position.copy(origin.clone().add(new THREE.Vector3(0, 0, 0.2)))

  return mesh
}

