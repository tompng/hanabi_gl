import * as THREE from 'three'
import hanabiUtilChunk from './shaders/util.vert'
import baseParamsChunk from './shaders/base_params.vert'
import blinkParamsChunk from './shaders/blink_params.vert'
import blinkParticleChunk from './shaders/particle_params.vert'
import { Capturer } from './capture'
import { Land } from './Land'
import { Water } from './Water'
import { skyMesh } from './sky'
import { Fireworks, addHanabi } from './fireworks'
import { Camera } from './camera'
import { setAudioListener, toggleMute, playPyu, playBang } from './sound'

const soundButton = document.querySelector<HTMLElement>('.sound')!
soundButton.onpointerdown = () => {
  const muted = toggleMute()
  soundButton.classList.remove('sound-on', 'sound-off')
  soundButton.classList.add(muted ? 'sound-off' : 'sound-on')
}
const land = new Land({min: -1, max: 1, step: 256},{min: -1, max: 1, step: 256},0,(x,y)=>
  (8*(1-x)*(1+x)*(1-y)*(1+y)*(1+Math.sin(8*x+4*y)+Math.sin(2*x-7*y+1)+Math.sin(9*x+11*y+2)+Math.sin(13*x-12*y+3)-6/(1+4*(x**2+y**2))+2*x)-1) / 128
)
const landAttrs = land.generateGeometryAttributes()
const landGeometry = new THREE.BufferGeometry()
landGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(landAttrs.positions), 3))
landGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(landAttrs.normals), 3))
const landUniforms = {
  color: { value: new THREE.Color('black') }
}
const mesh = new THREE.Mesh(
  landGeometry,
  new THREE.ShaderMaterial({
    uniforms: landUniforms,
    vertexShader: `
      varying vec3 norm;
      varying vec3 gpos;
      void main(){
        norm=normalize(normal);
        gpos=(modelMatrix * vec4(position, 1)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(gpos,1);
      }
    `,
    fragmentShader: `
      varying vec3 norm;
      varying vec3 gpos;
      uniform vec3 color;
      const vec3 fireworksPosition = vec3(0, 0, 100);
      const float z2 = fireworksPosition.z * fireworksPosition.z;
      void main(){
        if(gpos.z<0.0)discard;
        vec3 lvec = fireworksPosition - gpos;
        float l2 = dot(lvec, lvec);
        lvec /= sqrt(l2);
        vec3 n = normalize(norm);
        gl_FragColor=vec4(vec3(0.05+0.05*n.z), 1);
        if (gl_FrontFacing) gl_FragColor.rgb += color * max(dot(n, lvec) * 1.2 - 0.2, 0.0) / (1.0 + l2 / z2);
      }`,
    side: THREE.DoubleSide
  })
)
mesh.position.x = 0
mesh.position.y = 0
mesh.position.z = 0
mesh.scale.x = mesh.scale.y = mesh.scale.z = 256.0

// land.show()

THREE.ShaderChunk['hanabi_util'] = hanabiUtilChunk
THREE.ShaderChunk['base_params'] = baseParamsChunk
THREE.ShaderChunk['blink_params'] = blinkParamsChunk
THREE.ShaderChunk['particle_params'] = blinkParticleChunk

const renderer = new THREE.WebGLRenderer()
renderer.autoClear = false
const scene = new THREE.Scene()
scene.add(skyMesh)
const fireworks = new Fireworks(scene)
const groundScene = new THREE.Scene()
const water = new Water(innerWidth, innerHeight)
const waterScene = new THREE.Scene()
waterScene.add(water.mesh)
groundScene.add(mesh)
const camera = new Camera(innerWidth, innerHeight)
const cameraR = 80
camera.position.x = -cameraR
camera.position.z = 1
camera.verticalAngle = 0.2
const move = { from: { x: camera.position.x, y: camera.position.y }, to: { x: camera.position.x, y: camera.position.y }, time: new Date() }
const lscale = 256
let currentPointerId: null | number = null
const cameraSmoothMove = { h: 0, v: 0 }
renderer.domElement.addEventListener('pointerdown', e => {
  currentPointerId = e.pointerId
  cameraSmoothMove.h = cameraSmoothMove.v = 0
  const startX = e.pageX
  const startY = e.pageY
  e.preventDefault()
  const startHAngle = camera.horizontalAngle
  const startVAngle = camera.verticalAngle
  let maxMove = 0
  const time = new Date()
  let last = { x: startX, y: startY, t: performance.now() }
  let prev = { ...last }
  function pointermove(e: PointerEvent) {
    if (last.x == e.pageX && last.y == e.pageY) {
      last.t = performance.now()
    } else {
      prev = last
      last = { x: e.pageX, y: e.pageY, t: performance.now() }
    }
    e.preventDefault()
    if (e.pointerId !== currentPointerId) return
    const dx = e.pageX - startX
    const dy = e.pageY - startY
    maxMove = Math.max(maxMove, Math.abs(dx), Math.abs(dy))
    if (maxMove < 4) return
    const scale = camera.fov / renderer.domElement.offsetHeight * Math.PI / 180
    camera.horizontalAngle = startHAngle + dx * scale
    camera.verticalAngle = startVAngle + dy * scale
  }
  function pointerup(e: PointerEvent) {
    window.removeEventListener('pointermove', pointermove)
    window.removeEventListener('pointerup', pointerup)
    if (e.pointerId !== currentPointerId) return
    if (maxMove >= 4 || new Date().getTime() - time.getTime() > 500) {
      const scale = camera.fov / renderer.domElement.offsetHeight * Math.PI / 180
      const dt = Math.max(last.t - prev.t, 10) / 1000
      cameraSmoothMove.h = (last.x - prev.x) * scale / dt
      cameraSmoothMove.v = (last.y - prev.y) * scale / dt
      return
    }
    const el = renderer.domElement
    const rx = (e.pageX - el.offsetLeft) / el.offsetWidth
    const ry = (e.pageY - el.offsetTop) / el.offsetHeight
    const view = camera.viewAt(rx, ry)
    const maxXYDistance = 40
    const p = land.intersect(
      {
        x: camera.position.x / lscale,
        y: camera.position.y / lscale,
        z: camera.position.z / lscale
      },
      view
    )
    if (p) {
      const dx = p.x * lscale - camera.position.x
      const dy = p.y * lscale - camera.position.y
      const r = Math.hypot(dx, dy)
      const l = Math.min(maxXYDistance / r, 1)
      move.to = {
        x: Math.min(Math.max(-lscale, camera.position.x + l * dx), lscale),
        y: Math.min(Math.max(-lscale, camera.position.y + l * dy), lscale)
      }
      move.from = { x: camera.position.x, y: camera.position.y }
      move.time = new Date()
    }
  }
  window.addEventListener('pointermove', pointermove)
  window.addEventListener('pointerup', pointerup)
})


const canvas = renderer.domElement
canvas.style.touchAction = 'none'
canvas.style.position = 'fixed'
canvas.style.left = '0'
canvas.style.top = '0'
canvas.style.width = '100%'
canvas.style.height = '100%'
document.body.appendChild(canvas)
let resizeTimer: number | null = null
function doResize() {
  resizeTimer = null
  const size = new THREE.Vector2()
  renderer.getSize(size)
  const width = window.innerWidth
  const height = window.innerHeight
  if (size.x === width && size.y === height) return
  renderer.setSize(width, height)
  camera.width = width
  camera.height = height
  camera.update()
  water.resize(width, height, camera.fov)
}
function resized() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(doResize, 100)
}
window.addEventListener('orientationchange', resized)
window.addEventListener('resize', resized)
doResize()

let capturing: { capturer: Capturer, time: number | null, step: number } | null = null
const cameraButton = document.querySelector<HTMLElement>('.camera')!
const closeButton = document.querySelector<HTMLElement>('.close')!
closeButton.onpointerdown = () => {
  capturing?.capturer.dispose()
  capturing = null
  document.body.classList.remove('picture-mode')
  const images = document.querySelectorAll<HTMLImageElement>('.pictures img')!
  images.forEach(img => { img.src = '' })
}
cameraButton.onpointerdown = () => {
  if (capturing) return
  capturing = {
    capturer: new Capturer(renderer, window.innerWidth, window.innerHeight),
    time: null,
    step: 0
  }
  document.body.classList.add('picture-mode')
  document.querySelector<HTMLElement>('.pictures .p2')!.style.display = 'none'
  const img = document.querySelector<HTMLImageElement>('.pictures .p1 img')!
  const atag = document.querySelector<HTMLAnchorElement>('.pictures .p1 a')!
  atag.style.display = img.style.display = 'none'
}

let timeWas = new Date().getTime() / 1000
function animate() {
  let time = new Date().getTime() / 1000
  if (capturing) {
    if (capturing.time) {
      time = capturing.time + capturing.step / 80
      capturing.step++
    } else {
      capturing.time = time
    }
    cameraSmoothMove.h = cameraSmoothMove.v = 0
  } else {
    let mt = Math.min(Math.max(0, (time - move.time.getTime() / 1000) / 2), 1)
    mt = mt * mt * (3 - 2 * mt)
    camera.position.x = move.from.x * (1 - mt) + mt * move.to.x
    camera.position.y = move.from.y * (1 - mt) + mt * move.to.y
    camera.position.z = Math.max(0, lscale * land.maxZAt(camera.position.x / lscale, camera.position.y / lscale)) + 1
    const dt = Math.max(time - timeWas, 0)
    const k = 8
    const e = Math.exp(-k * dt)
    camera.horizontalAngle += cameraSmoothMove.h * (1 - e) / k
    camera.verticalAngle += cameraSmoothMove.v * (1 - e) / k
    cameraSmoothMove.h *= e
    cameraSmoothMove.v *= e
    camera.update()
    setAudioListener(camera.listenerPosition())
  }
  if (Math.floor(timeWas / 0.1) < Math.floor(time / 0.1)) {
    const n = Math.floor(time / 0.1) % 100000
    const seed = n * 1313 % 5331 + n * 1751 % 3727 + n * 1891 % 2927 + n * 1973 % 2941
    if (seed % 100 < 6) addHanabi(fireworks, { bang: playBang, pyu: playPyu }, time, seed)
  }
  timeWas = time
  fireworks.update(time, camera.pointPixels)
  const brightness = fireworks.brightness()
  const ll = 0.0002
  landUniforms.color.value = new THREE.Color(brightness.r * ll, brightness.g * ll, brightness.b * ll)

  function render() {
    water.update(time % 100000)
    const target = renderer.getRenderTarget()
    renderer.setRenderTarget(water.skyTarget)
    renderer.clearColor()
    renderer.clearDepth()
    renderer.render(scene, camera.waterCamera)
    renderer.setRenderTarget(water.groundTarget)
    renderer.clearColor()
    renderer.clearDepth()
    renderer.render(groundScene, camera.waterCamera)
    renderer.setRenderTarget(target)
    renderer.clearColor()
    renderer.render(groundScene, camera.mainCamera)
    renderer.render(waterScene, camera.mainCamera)
    renderer.render(scene, camera.mainCamera)
  }
  if (capturing) {
    capturing.capturer.add(render)
    if (capturing.step === 8) {
      const canvas = document.createElement('canvas')
      capturing.capturer.capture(canvas)
      const atag = document.querySelector<HTMLAnchorElement>('.pictures .p1 a')!
      const img = document.querySelector<HTMLImageElement>('.pictures .p1 img')!
      img.src = atag.href = canvas.toDataURL()
      atag.style.display = img.style.display = ''

    }
    if (capturing.step === 80) {
      const canvas = document.createElement('canvas')
      capturing.capturer.capture(canvas)
      const atag = document.querySelector<HTMLAnchorElement>('.pictures .p2 a')!
      const img = document.querySelector<HTMLImageElement>('.pictures .p2 img')!
      img.src = atag.href = canvas.toDataURL()
      atag.parentElement!.style.display = ''
      capturing.capturer.dispose()
      capturing = null
      requestAnimationFrame(animate)
    } else {
      setTimeout(animate, 0)
    }
  } else {
    render()
    requestAnimationFrame(animate)
  }
}

animate()
