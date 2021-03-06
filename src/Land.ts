type P3D = { x: number; y: number; z: number }
type AxisInfo = { min: number; max: number; step: number }
type Vert = {
  i: number
  j: number
  x: number
  y: number
  z: number
  n: P3D
}
function dot(a: P3D, b: P3D) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function normalize({ x, y, z }: P3D) {
  const nr = Math.hypot(x, y, z)
  return { x: x / nr, y: y / nr, z: z / nr }
}

function norm(a: P3D, b: P3D, c: P3D) {
  return normalize({
    x: (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
    y: (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
    z: (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  })
}
function mix2(a: P3D, b: P3D, t: number) {
  return {
    x: a.x * (1 - t) + b.x * t,
    y: a.y * (1 - t) + b.y * t,
    z: a.z * (1 - t) + b.z * t
  }
}
function wsum3(a: P3D, b: P3D, c: P3D, ta: number, tb: number, tc: number) {
  return {
    x: a.x * ta + b.x * tb + c.x * tc,
    y: a.y * ta + b.y * tb + c.y * tc,
    z: a.z * ta + b.z * tb + c.z * tc
  }
}
function center3(a: P3D, b: P3D, c: P3D) {
  const w = 1 / 3
  return wsum3(a, b, c, w, w, w)
}

type Triangle = {
  a: Vert
  b: Vert
  c: Vert
  n: P3D
  ab?: Vert
  bc?: Vert
  ca?: Vert
}

function periodicSmooth(array: number[], scale: number) {
  const size = array.length
  const out = new Array(size).fill(0)
  let weight = 0
  for (let k = 0; k < 2; k++) {
    const ex = Math.exp(-(k + 1) / scale)
    const exs = 1 / (1 - ex ** size)
    const c = 2 - 3 * k
    weight += (2 / (1 - ex) - 1) * c
    let s = 0
    for (let i = 0; i < size; i++) s = s * ex + array[i]
    s *= exs
    for (let i = 0; i < size; i++) out[i] += c * (s = s * ex + array[i])
    s = 0
    for (let i = size - 1; i >= 0; i--) s = s * ex + array[i]
    s *= exs
    for (let i = size - 1; i >= 0; i--) {
      out[i] += c * (s *= ex)
      s += array[i]
    }
  }
  for (let i = 0; i < size; i++) out[i] /= weight
  return out
}
function addNoise(vertices: Vert[][]) {
  const a = Math.random()
  function rand2d(size: number, scale: number) {
    const arr = [...new Array(size)].map(() => periodicSmooth([...new Array(size)].map(() => rand() - 0.5), scale))
    return [...new Array(size)].map((_, i) => periodicSmooth([...new Array(size)].map((_, j) => arr[j][i]), scale))
  }
  const r1 = rand2d(64, 8)
  const r2 = rand2d(64, 4)
  const r3 = rand2d(64, 2)
  vertices.forEach(vs => vs.forEach(v => {
    v.z += (r1[v.i % 64][v.j % 64] + r2[v.i % 64][v.j % 64] / 1.5 + r3[v.i % 64][v.j % 64] / 2) * (1 + v.x) * (1 - v.x) * (1 + v.y) * (1 - v.y)
  }))
}

let seed = 13
const rand = () => {
  return (seed = seed * 137 % 33331) / 33332
}
export class Land {
  baseTriangles: Triangle[] = []
  zmap: number[][] = []
  constructor(public xaxis: AxisInfo, public yaxis: AxisInfo, public zmin: number, public zfunc: (x: number, y: number) => number) {
    this.generateBaseTriangles()
  }
  maxZAt(x: number, y: number) {
    return Math.max(
      0,
      this.zAt(x, y),
      this.zAt(x + 0.01, y),
      this.zAt(x - 0.01, y),
      this.zAt(x, y + 0.01),
      this.zAt(x, y - 0.01)
    )
  }
  zAt(x: number, y: number) {
    x = Math.min(Math.max(this.xaxis.min, x), this.xaxis.max)
    y = Math.min(Math.max(this.yaxis.min, y), this.yaxis.max)
    let fi = (x - this.xaxis.min) / (this.xaxis.max - this.xaxis.min) * this.xaxis.step
    let fj = (y - this.yaxis.min) / (this.yaxis.max - this.yaxis.min) * this.yaxis.step
    const i = Math.min(Math.floor(fi), this.xaxis.step - 1)
    const j = Math.min(Math.floor(fj), this.yaxis.step - 1)
    fi -= i
    fj -= j
    return (
      (1 - fi) * (1 - fj) * this.zmap[i][j]
      + fi * (1 - fj) * this.zmap[i + 1][j]
      + (1 - fi) * fj * this.zmap[i][j + 1]
      + fi * fj * this.zmap[i + 1][j + 1]
    )
  }
  intersect(from: { x: number; y: number; z: number }, view: { x: number; y: number; z: number }) {
    let minT = view.z < 0 ? -from.z / view.z : Infinity
    function crossdot(a: P3D, b: P3D, c: P3D) {
      return (a.y * b.z - a.z * b.y) * c.x + (a.z * b.x - a.x * b.z) * c.y + (a.x * b.y - a.y * b.x) * c.z
    }
    this.baseTriangles.forEach(({ a, b, c, n }) => {
      const fa = { x: a.x - from.x, y: a.y - from.y, z: a.z - from.z }
      const fb = { x: b.x - from.x, y: b.y - from.y, z: b.z - from.z }
      const fc = { x: c.x - from.x, y: c.y - from.y, z: c.z - from.z }
      const v = crossdot(fa, fb, fc)
      const ab = crossdot(fa, fb, view)
      const bc = crossdot(fb, fc, view)
      const ca = crossdot(fc, fa, view)
      if ((ab < 0 && bc < 0 && ca < 0) || (ab > 0 && bc > 0 && ca > 0)) {
        const t = v / (ab + bc + ca)
        if (0 < t && t < minT) minT = t
      }
    })
    if (minT === Infinity) return null
    return {
      x: from.x + view.x * minT,
      y: from.y + view.y * minT,
      z: from.z + view.z * minT,
      t: minT
    }
  }
  generateBaseTriangles() {
    const { xaxis, yaxis, zmin, zfunc } = this
    const vertices: Vert[][] = [...new Array(xaxis.step + 1)].map((_, i) => {
      return [...new Array(yaxis.step + 1)].map((_, j) => {
        const x = i == 0 ? xaxis.min : i == xaxis.step ? xaxis.max : xaxis.min + (xaxis.max - xaxis.min) * (i + 0.2 + 0.6 * rand()) / (xaxis.step + 1)
        const y = j == 0 ? yaxis.min : j == yaxis.step ? yaxis.max : yaxis.min + (yaxis.max - yaxis.min) * (j + 0.2 + 0.6 * rand()) / (yaxis.step + 1)
        return { i, j, x, y, z: zfunc(x, y), n: { x: 0, y: 0, z: 0 } }
      })
    })
    addNoise(vertices)
    this.zmap = vertices.map(vs => vs.map(v => v.z))
    const dirs = [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]] as const
    for (let i = 0; i <= xaxis.step; i++) {
      for (let j = 0; j <= yaxis.step; j++) {
        const va = vertices[i][j]
        const sum = { x: 0, y: 0, z: 0 }
        dirs.forEach(([di1, dj1], k) => {
          const [di2, dj2] = dirs[(k + 1) % 8]
          const vb = vertices[i + di1]?.[j + dj1]
          const vc = vertices[i + di2]?.[j + dj2]
          if (!vb || !vc) return
          const n = norm(va, vb, vc)
          sum.x += n.x
          sum.y += n.y
          sum.z += n.z
        })
        va.n = normalize(sum)
      }
    }
    const tpairs = new Map<string, Vert>()
    const tpkey = (a: Vert, b: Vert) => [a.i, a.j, b.i, b.j].join('-')
    const addTriangle = (a: Vert, b: Vert, c: Vert) => {
      if (a.z <= zmin && b.z <= zmin && c.z <= zmin) return

      tpairs.set(tpkey(a, b), c)
      tpairs.set(tpkey(b, c), a)
      tpairs.set(tpkey(c, a), b)
      const n = norm(a, b, c)
      this.baseTriangles.push({ a, b, c, n })
    }
    for (let i = 0; i < xaxis.step; i++) {
      for (let j = 0; j < yaxis.step; j++) {
        const v00 = vertices[i][j]
        const v10 = vertices[i + 1][j]
        const v01 = vertices[i][j + 1]
        const v11 = vertices[i + 1][j + 1]
        const l1 = Math.hypot(v10.x - v01.x, v10.y - v01.y)
        const l2 = Math.hypot(v00.x - v11.x, v00.y - v11.y)
        if (l1 < l2) {
          addTriangle(v00, v10, v01)
          addTriangle(v01, v10, v11)
        } else {
          addTriangle(v00, v10, v11)
          addTriangle(v00, v11, v01)
        }
      }
    }
    this.baseTriangles.forEach(t => {
      t.ab = tpairs.get(tpkey(t.b, t.a))
      t.bc = tpairs.get(tpkey(t.c, t.b))
      t.ca = tpairs.get(tpkey(t.a, t.c))
    })
  }
  generateGeometrySimpleAttributes() {
    const positions: number[] = []
    const normals: number[] = []
    this.baseTriangles.forEach(t => {
      positions.push(t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z, t.c.x, t.c.y, t.c.z)
      for (let i = 0; i < 3; i++) normals.push(t.n.x, t.n.y, t.n.z)
    })
    return { positions, normals }
  }
  generateGeometryAttributes() {
    return this.generateGeometrySimpleAttributes()
    const triangles = this.generateDetailedTriangles()
    const positions: number[] = []
    const normals: number[] = []
    triangles.forEach(([a, b, c]) => {
      positions.push(a.p.x, a.p.y, a.p.z, b.p.x, b.p.y, b.p.z, c.p.x, c.p.y, c.p.z)
      normals.push(a.n.x, a.n.y, a.n.z, b.n.x, b.n.y, b.n.z, c.n.x, c.n.y, c.n.z)
    })
    return { positions, normals }
  }
  generateDetailedTriangles() {
    type P = { p: P3D, n: P3D }
    const vertPositions = new Map<Vert, { p: { x: number, y: number, z: number }, count: number, edge?: true }>()
    const output: [P, P, P][] = []
    const t = 0.15
    function distCorner(a: Vert, b: Vert, c: Vert) {
      return mix2(a, center3(a, b, c), t)
    }
    function f(a: Vert, b: Vert, c: Vert, bc: Vert | undefined, n: P3D) {
      const pa = { p: distCorner(a, b, c), n }
      const pb = { p: distCorner(b, a, c), n }
      if (!bc) {
        const la = { p: mix2(a, b, t / 2), n }
        const lb = { p: mix2(b, a, t / 2), n }
        output.push([pa, lb, pb], [pa, la, lb])
        const [va, vb] = ([[a, la], [b, lb]] as const).map(([p, l]) => {
          let v = vertPositions.get(p)
          if (!v) vertPositions.set(p, v = { p: { x: 0, y: 0, z: 0 }, count: 0 })
          if (!v.edge) {
            v.edge = true
            v.count = v.p.x = v.p.y = v.p.z = 0
          }
          v.p.x += l.p.x
          v.p.y += l.p.y
          v.p.z += l.p.z
          v.count++
          return v.p
        })
        output.push([{ p: va, n: a.n }, la, pa])
        output.push([{ p: vb, n: b.n }, pb, lb])
      } else {
        const tn = norm(a, bc, b)
        const tpb = { p: distCorner(b, a, bc), n: tn }
        output.push([pa, tpb, pb])
        let vp = vertPositions.get(b)
        if (!vp) vertPositions.set(b, vp = { p: { x: 0, y: 0, z: 0 }, count: 0 })
        if (!vp.edge) {
          vp.p.x += pb.p.x
          vp.p.y += pb.p.y
          vp.p.z += pb.p.z
          vp.count++
        }
        output.push([pb, tpb, { p: vp.p, n: b.n }])
      }
    }
    this.baseTriangles.forEach(({ a, b, c, ab, bc, ca }) => {
      const center = center3(a, b, c)
      const n = norm(a, b, c)
      output.push([
        { p: mix2(a, center, t), n },
        { p: mix2(b, center, t), n },
        { p: mix2(c, center, t), n }
      ])
      f(a, b, c, ab, n)
      f(b, c, a, bc, n)
      f(c, a, b, ca, n)
    })
    vertPositions.forEach(({ p, count }) => {
      p.x /= count
      p.y /= count
      p.z /= count
    })
    return output
  }
  show() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.height = 2048
    ctx.lineWidth = 0.2
    ctx.scale(4, 4)
    this.generateDetailedTriangles().forEach(([a, b, c]) => {
      ctx.beginPath()
      ctx.moveTo(a.p.x, a.p.y)
      ctx.lineTo(b.p.x, b.p.y)
      ctx.lineTo(c.p.x, c.p.y)
      ctx.lineJoin = 'round'
      ctx.closePath()
      ctx.globalAlpha = 0.2
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
    })
    document.body.appendChild(canvas)
  }
}

