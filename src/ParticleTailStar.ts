import * as THREE from 'three'
import type { N3D } from './util'
import vertexShader from './shaders/particle_tail.vert'
import fragmentShader from './shaders/point_star.frag'
import { StarBaseAttributes, setStarBaseAttributes, generateStarParticleAttributes, setStarParticleAttributes } from './attributes'

export class ParticleTailStar {
  uniforms = {
    time: { value: 0 },
    color: { value: new THREE.Color('#642') },
    center: { value: new THREE.Vector3(0, 0, 2) },
    baseVelocity: { value: new THREE.Vector3(0, 0, 0) },
    velocityScale: { value: 4.0 },
    friction: { value: 4 },
    duration: { value: 0.6 }
  }
  mesh: THREE.Points
  constructor(direction: N3D[], attrs: StarBaseAttributes) {
    const material = new THREE.ShaderMaterial({
      defines: { BEE: true, BLINK: false },
      uniforms: this.uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.mesh = new THREE.Points(generateGeometry(direction, attrs), material)
  }
  update(time: number) {
    this.uniforms.time.value = time
  }
}

function generateGeometry(direction: N3D[], attrs: StarBaseAttributes, particles: number = 64) {
  const geometry = new THREE.BufferGeometry()
  const ds: number[] = []
  direction.forEach(p => {
    for (let i = 0; i < particles; i++) ds.push(...p)
  })
  setStarBaseAttributes(geometry, attrs, particles)
  const pattrs = generateStarParticleAttributes(particles * direction.length)
  setStarParticleAttributes(geometry, pattrs)
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * particles * direction.length), 3))
  geometry.setAttribute('direction', new THREE.BufferAttribute(new Float32Array(ds), 3))
  geometry.boundingSphere = new THREE.Sphere(undefined, 4)
  return geometry
}