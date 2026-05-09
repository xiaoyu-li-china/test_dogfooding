import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class EarthViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId)
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.earth = null
    this.clouds = null
    this.atmosphere = null
    this.stars = null
    this.orbits = []
    this.moon = null
    this.moonAngle = 0
    this.clock = null
    this.animationId = null
    this.showOrbits = true
    this.showStars = true
    this.showMoon = true
    this.onResize = this.handleResize.bind(this)
  }

  init() {
    this.initScene()
    this.createEarth()
    this.createStars()
    this.createOrbits()
    this.createMoon()
    this.startAnimation()
    window.addEventListener('resize', this.onResize)
    return this
  }

  initScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000011)

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    this.camera.position.set(0, 2, 6)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.minDistance = 3
    this.controls.maxDistance = 20

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    this.scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 2, 100)
    pointLight.position.set(10, 5, 10)
    this.scene.add(pointLight)

    const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.5)
    this.scene.add(pointLightHelper)

    this.clock = new THREE.Clock()
  }

  createEarthTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#1e3a5f')
    gradient.addColorStop(0.2, '#2d5a87')
    gradient.addColorStop(0.4, '#1e3a5f')
    gradient.addColorStop(0.6, '#2d5a87')
    gradient.addColorStop(0.8, '#1e3a5f')
    gradient.addColorStop(1, '#1e3a5f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#2d8a4e'
    ctx.beginPath()
    ctx.ellipse(300, 250, 180, 120, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(350, 450, 80, 60, 0.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(600, 300, 150, 100, 0.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(900, 450, 200, 150, 0.1, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(1100, 250, 120, 80, 0.4, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(1400, 350, 180, 120, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(1700, 550, 100, 70, 0.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#e8e8e8'
    ctx.beginPath()
    ctx.ellipse(1024, 50, 500, 60, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(1024, 974, 600, 80, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.3
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const r = Math.random() * 30 + 10
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    return texture
  }

  createCloudTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * canvas.width
      const y = Math.random() * canvas.height
      const r = Math.random() * 40 + 20
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    return texture
  }

  createEarth() {
    const earthTexture = this.createEarthTexture()
    const cloudTexture = this.createCloudTexture()

    const earthGeometry = new THREE.SphereGeometry(2, 64, 64)
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 20,
      specular: new THREE.Color(0x333333)
    })
    this.earth = new THREE.Mesh(earthGeometry, earthMaterial)
    this.scene.add(this.earth)

    const atmosphereGeometry = new THREE.SphereGeometry(2.05, 64, 64)
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    })
    this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
    this.scene.add(this.atmosphere)

    const cloudsGeometry = new THREE.SphereGeometry(2.02, 64, 64)
    const cloudsMaterial = new THREE.MeshPhongMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.4
    })
    this.clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial)
    this.scene.add(this.clouds)
  }

  createStars() {
    const starGeometry = new THREE.BufferGeometry()
    const starCount = 5000
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 200 + Math.random() * 300
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i + 2] = radius * Math.cos(phi)

      const colorIntensity = 0.5 + Math.random() * 0.5
      colors[i] = colorIntensity
      colors[i + 1] = colorIntensity
      colors[i + 2] = colorIntensity + Math.random() * 0.2
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const starMaterial = new THREE.PointsMaterial({
      size: 1,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    })

    this.stars = new THREE.Points(starGeometry, starMaterial)
    this.stars.visible = this.showStars
    this.scene.add(this.stars)
  }

  createOrbits() {
    const curve = new THREE.EllipseCurve(
      0, 0,
      4, 4,
      0, 2 * Math.PI,
      false,
      0
    )

    const points = curve.getPoints(100)
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, 0, p.y))
    )

    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.3
    })

    const orbit = new THREE.Line(orbitGeometry, orbitMaterial)
    orbit.rotation.x = Math.PI / 2
    orbit.visible = this.showOrbits
    this.scene.add(orbit)

    const orbit2 = orbit.clone()
    orbit2.rotation.x = Math.PI / 2 + 0.2
    orbit2.rotation.y = 0.3
    orbit2.visible = this.showOrbits
    this.scene.add(orbit2)

    this.orbits = [orbit, orbit2]
  }

  createMoon() {
    const moonGeometry = new THREE.SphereGeometry(0.3, 32, 32)
    const moonMaterial = new THREE.MeshPhongMaterial({
      color: 0xaaaaaa,
      shininess: 10
    })
    this.moon = new THREE.Mesh(moonGeometry, moonMaterial)
    this.moon.visible = this.showMoon
    this.scene.add(this.moon)
  }

  startAnimation() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      this.update()
      this.render()
    }
    animate()
  }

  update() {
    const delta = this.clock.getDelta()

    if (this.earth) {
      this.earth.rotation.y += 0.002
    }
    if (this.clouds) {
      this.clouds.rotation.y += 0.0025
    }
    if (this.atmosphere) {
      this.atmosphere.rotation.y += 0.001
    }

    if (this.stars && this.stars.visible) {
      this.stars.rotation.y += 0.0001
    }

    if (this.moon && this.moon.visible) {
      this.moonAngle += 0.01
      const moonRadius = 4
      this.moon.position.x = Math.cos(this.moonAngle) * moonRadius
      this.moon.position.z = Math.sin(this.moonAngle) * moonRadius
      this.moon.position.y = Math.sin(this.moonAngle * 2) * 0.5
      this.moon.rotation.y += 0.01
    }

    if (this.controls) {
      this.controls.update()
    }
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  handleResize() {
    const width = window.innerWidth
    const height = window.innerHeight
    if (this.camera) {
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
    if (this.renderer) {
      this.renderer.setSize(width, height)
      this.renderer.setPixelRatio(window.devicePixelRatio)
    }
  }

  setEarthTexture(texture) {
    if (this.earth && texture) {
      this.earth.material.map = texture
      this.earth.material.needsUpdate = true
    }
  }

  setEarthColor(color) {
    if (this.earth) {
      this.earth.material.color = new THREE.Color(color)
    }
  }

  setShowOrbits(show) {
    this.showOrbits = show
    if (this.orbits) {
      this.orbits.forEach(orbit => {
        orbit.visible = show
      })
    }
  }

  toggleOrbits() {
    this.setShowOrbits(!this.showOrbits)
    return this.showOrbits
  }

  setShowStars(show) {
    this.showStars = show
    if (this.stars) {
      this.stars.visible = show
    }
  }

  toggleStars() {
    this.setShowStars(!this.showStars)
    return this.showStars
  }

  setShowMoon(show) {
    this.showMoon = show
    if (this.moon) {
      this.moon.visible = show
    }
  }

  toggleMoon() {
    this.setShowMoon(!this.showMoon)
    return this.showMoon
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
    window.removeEventListener('resize', this.onResize)

    if (this.renderer) {
      this.renderer.dispose()
      if (this.renderer.domElement && this.container) {
        this.container.removeChild(this.renderer.domElement)
      }
    }

    if (this.controls) {
      this.controls.dispose()
    }
  }

  getScene() {
    return this.scene
  }

  getCamera() {
    return this.camera
  }

  getRenderer() {
    return this.renderer
  }

  getControls() {
    return this.controls
  }

  getEarth() {
    return this.earth
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const earthViewer = new EarthViewer('canvas-container').init()
    window.earthViewer = earthViewer
  })
}
