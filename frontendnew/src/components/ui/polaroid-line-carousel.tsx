"use client"

import * as React from "react"
import { createPortal } from "react-dom"

/*
 * Polaroid Line Carousel — instant photos pegged to a sagging string. Drag the
 * line (or use the arrows) and the prints slide along it, swinging on their
 * pegs with the speed you give them and settling back with a little
 * overshoot; even at rest they sway in a light breeze. The one in the middle
 * is the one you're looking at.
 *
 * Drag, click a print, ←/→ and autoplay. Slides without an `image` get a
 * painted landscape, so it works with no assets at all.
 */

export type LandPalette = "dawn" | "alpine" | "dusk" | "mist"

export type Slide = {
  image?: string
  title?: string
  caption?: string
  alt?: string
  href?: string
  /** Palette and seed of the painted landscape used when `image` is empty. */
  palette?: LandPalette
  seed?: number
}

export type PolaroidLineCarouselProps = {
  slides?: Slide[]
  /** Any CSS length. Default 100svh. */
  height?: number | string
  /** Width of a print in px (it shrinks on narrow screens). */
  cardWidth?: number
  /** How far the string sags in the middle, px. */
  sag?: number
  /** How much the prints swing; 0 holds them still. */
  swing?: number
  /** ms per print; 0 turns autoplay off. It waits while someone is interacting. */
  autoplay?: number
  /** Colour of the string and pegs. */
  string?: string
  background?: string
  ink?: string
  onChange?: (index: number) => void
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
}

// #region logic
export function wrap(i: number, n: number): number {
  return n ? ((i % n) + n) % n : 0
}

export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}

/** Height of a string sagging by `sag` between (0, y0) and (w, y0), at x. */
export function stringY(x: number, w: number, y0: number, sag: number): number {
  const t = clamp(x / w, 0, 1)
  return y0 + 4 * sag * t * (1 - t)
}

/** One step of a critically damped spring toward target. */
export function springStep(x: number, v: number, target: number, dt: number, k = 70): [number, number] {
  const c = 2 * Math.sqrt(k)
  const nv = v + (k * (target - x) - c * v) * dt
  return [x + nv * dt, nv]
}

/** One step of a print's swing. lineVel is the prints' on-screen speed (px/s, + = moving right); a print lags behind the motion, is pulled back by gravity and damped. */
export function swingStep(a: number, w: number, lineVel: number, dt: number, gain: number): [number, number] {
  const nw = w + (-38 * a - 4.2 * w + lineVel * 0.0034 * gain) * dt
  return [clamp(a + nw * dt, -0.6, 0.6), nw]
}

/** Index of the print nearest the centre for a line offset. */
export function nearestAt(off: number, spacing: number, n: number): number {
  return clamp(Math.round(off / spacing), 0, Math.max(0, n - 1))
}

export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n)
}
// #endregion logic

/* ------------------------------------------------------- painted images */

const PALETTES = {
  dawn: { top: "#e7b7a5", bottom: "#f8e8d6", sun: "#fff4df", far: "#d2b2bb", near: "#3a2a3b", mist: "255,240,232" },
  alpine: { top: "#7ea5c8", bottom: "#e3ecf2", sun: "#ffffff", far: "#a9bfd0", near: "#1c3044", mist: "236,244,250" },
  dusk: { top: "#2a2450", bottom: "#ef8d60", sun: "#ffd9a6", far: "#93607c", near: "#18121f", mist: "255,196,160" },
  mist: { top: "#c4d0cb", bottom: "#eef1ec", sun: "#ffffff", far: "#aebcb5", near: "#2c3a33", mist: "246,248,245" },
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hexRgb(h: string): [number, number, number] {
  const v = parseInt(h.replace("#", ""), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function mixRgb(a: string, b: string, t: number): string {
  const A = hexRgb(a)
  const B = hexRgb(b)
  return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"
}

// A layered-ridge landscape: sky, a low sun, five ridges fading into haze with
// mist between them, a tree line on the nearest, film grain. Painted once.
function paintLandscape(seed: number, palette: LandPalette, w = 1600, h = 1000): string {
  if (typeof document === "undefined") return ""
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const g = c.getContext("2d")
  if (!g) return ""
  const P = PALETTES[palette] ?? PALETTES.dawn
  const r = mulberry32(seed * 104729 + 7)

  const sky = g.createLinearGradient(0, 0, 0, h * 0.72)
  sky.addColorStop(0, P.top)
  sky.addColorStop(1, P.bottom)
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  const sx = w * (0.22 + r() * 0.56)
  const sy = h * (0.26 + r() * 0.16)
  const halo = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.45)
  halo.addColorStop(0, "rgba(" + hexRgb(P.sun).join(",") + ",.85)")
  halo.addColorStop(0.08, "rgba(" + hexRgb(P.sun).join(",") + ",.55)")
  halo.addColorStop(1, "rgba(" + hexRgb(P.sun).join(",") + ",0)")
  g.fillStyle = halo
  g.fillRect(0, 0, w, h)
  g.fillStyle = P.sun
  g.beginPath()
  g.arc(sx, sy, h * 0.045, 0, Math.PI * 2)
  g.fill()

  const layers = 5
  for (let L = 0; L < layers; L++) {
    const k = L / (layers - 1)
    const base = h * (0.42 + k * 0.4)
    const amp = h * (0.07 + k * 0.1)
    const ph = [r(), r(), r(), r()].map((v) => v * Math.PI * 2)
    const fr = [1.3 + r(), 3.1 + r() * 2, 7 + r() * 4, 17 + r() * 8]
    const ridge = (x: number) => {
      const u = x / w
      return (
        base -
        amp *
          (0.55 * Math.sin(u * fr[0] + ph[0]) +
            0.28 * Math.sin(u * fr[1] + ph[1]) +
            0.12 * Math.abs(Math.sin(u * fr[2] + ph[2])) +
            0.05 * Math.sin(u * fr[3] + ph[3]))
      )
    }
    const mist = g.createLinearGradient(0, base - amp * 1.4, 0, base + amp * 0.4)
    mist.addColorStop(0, "rgba(" + P.mist + ",0)")
    mist.addColorStop(1, "rgba(" + P.mist + "," + (0.55 - k * 0.35).toFixed(2) + ")")
    g.fillStyle = mist
    g.fillRect(0, base - amp * 1.4, w, amp * 1.8)
    const body = g.createLinearGradient(0, base - amp, 0, h)
    body.addColorStop(0, mixRgb(P.far, P.near, Math.pow(k, 1.3)))
    body.addColorStop(1, mixRgb(P.far, P.near, Math.min(1, Math.pow(k, 1.3) + 0.18)))
    g.fillStyle = body
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 6) g.lineTo(x, ridge(x))
    g.lineTo(w, h)
    g.closePath()
    g.fill()
    if (L >= layers - 2) {
      g.fillStyle = mixRgb(P.far, P.near, Math.min(1, Math.pow(k, 1.3) + 0.08))
      for (let x = 0; x < w; x += 7 + r() * 9) {
        if (r() < 0.35) continue
        const y = ridge(x) + 2
        const th = h * (0.025 + r() * 0.035) * (0.6 + k)
        const tw = th * 0.32
        g.beginPath()
        g.moveTo(x, y - th)
        g.lineTo(x + tw, y)
        g.lineTo(x - tw, y)
        g.closePath()
        g.fill()
      }
    }
  }

  const vig = g.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h / 2, w * 0.78)
  vig.addColorStop(0, "rgba(0,0,0,0)")
  vig.addColorStop(1, "rgba(0,0,0,.32)")
  g.fillStyle = vig
  g.fillRect(0, 0, w, h)
  const grain = g.getImageData(0, 0, w, h)
  const d = grain.data
  for (let i = 0; i < d.length; i += 4) {
    const v = (r() - 0.5) * 14
    d[i] += v
    d[i + 1] += v
    d[i + 2] += v
  }
  g.putImageData(grain, 0, 0)
  return c.toDataURL("image/jpeg", 0.88)
}

const DEFAULT_SLIDES: Slide[] = [
  { title: "First Light", caption: "Haze lifting off the eastern ridges.", palette: "dawn", seed: 3 },
  { title: "High Pass", caption: "Cold air, clear to the far range.", palette: "alpine", seed: 8 },
  { title: "Ember Hour", caption: "The last of the sun on the valley floor.", palette: "dusk", seed: 14 },
  { title: "Still Valley", caption: "Morning mist that never quite lifts.", palette: "mist", seed: 21 },
  { title: "Rose Ridge", caption: "Five ridges, one long exhale.", palette: "dawn", seed: 34 },
  { title: "Blue Hour", caption: "Pines going dark against the snow.", palette: "alpine", seed: 55 },
]

// Every slide as an image URL; slides without one are painted after mount.
function useSlideImages(slides: Slide[]): string[] {
  const key = slides.map((s) => s.image || (s.palette || "dawn") + ":" + (s.seed ?? 1)).join("|")
  const [painted, setPainted] = React.useState(() => slides.map(() => ""))
  React.useEffect(() => {
    setPainted(slides.map((s, i) => (s.image ? "" : paintLandscape(s.seed ?? i + 1, s.palette || "dawn"))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return slides.map((s, i) => s.image || painted[i] || "")
}

const PL_CSS = [
  ".pl-root{position:relative;width:100%;overflow:hidden;background:var(--pl-bg);color:var(--pl-ink);user-select:none;-webkit-user-select:none;touch-action:pan-y;outline:none;cursor:grab}",
  ".pl-root[data-drag='1']{cursor:grabbing}",
  ".pl-root:focus-visible{box-shadow:inset 0 0 0 2px var(--pl-ink)}",
  ".pl-string{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}",
  ".pl-card{position:absolute;left:0;top:0;width:var(--pl-cw);transform-origin:50% 0;will-change:transform;cursor:pointer}",
  ".pl-root[data-drag='1'] .pl-card{cursor:grabbing}",
  ".pl-card[data-inspecting='1']{opacity:0}",
  ".pl-print{margin-top:10px;background:#fbfaf7;padding:10px 10px 0;box-shadow:0 1px 2px rgba(0,0,0,.12),0 18px 30px -16px rgba(0,0,0,.4);transition:transform .5s cubic-bezier(.2,.7,.2,1),filter .5s ease}",
  ".pl-card[data-on='0'] .pl-print{transform:scale(.9);filter:saturate(.7) brightness(.96)}",
  ".pl-shot{position:relative;aspect-ratio:1;overflow:hidden;background:#d9d5cc}",
  ".pl-shot img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;display:block;pointer-events:none}",
  ".pl-note{height:46px;display:flex;align-items:center;justify-content:center;padding:0 6px;font:italic 400 15px/1.1 ui-serif,Georgia,'Times New Roman',serif;color:#3b3833;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".pl-peg{position:absolute;left:50%;top:0;width:10px;height:26px;margin-left:-5px;border-radius:2px;background:linear-gradient(90deg,#c9a67a,#e3c9a1 45%,#b8915f);box-shadow:0 2px 3px rgba(0,0,0,.25)}",
  ".pl-peg::after{content:'';position:absolute;left:4px;top:8px;width:2px;height:7px;background:rgba(80,60,30,.45);border-radius:1px}",
  ".pl-bar{position:absolute;left:clamp(16px,4vw,56px);right:clamp(16px,4vw,56px);bottom:clamp(20px,4vh,40px);display:flex;align-items:center;gap:clamp(12px,2vw,24px);cursor:default}",
  ".pl-cap{flex:1;min-width:0;overflow:hidden;padding-bottom:.15em}",
  ".pl-cap>*{display:block;animation:pl-in .55s cubic-bezier(.2,.8,.2,1) both}",
  ".pl-title{font:500 clamp(18px,2.2vw,26px)/1.15 ui-serif,Georgia,'Times New Roman',serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".pl-link{color:inherit;text-decoration:none;cursor:pointer}",
  ".pl-link:hover{text-decoration:underline;text-underline-offset:4px}",
  ".pl-link:focus-visible{outline:2px solid var(--pl-ink);outline-offset:2px}",
  ".pl-sub{margin-top:4px;font:400 13px/1.4 ui-sans-serif,system-ui,sans-serif;color:var(--pl-muted)}",
  ".pl-count{font:500 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:var(--pl-muted)}",
  ".pl-count b{color:var(--pl-ink);font-weight:500}",
  ".pl-btn{appearance:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--pl-line);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;transition:background .2s ease,color .2s ease}",
  ".pl-btn:hover{background:var(--pl-ink);color:var(--pl-bg)}",
  ".pl-btn:focus-visible{outline:2px solid var(--pl-ink);outline-offset:2px}",
  ".pl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
  ".pl-inspect{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;isolation:isolate;color:#f9f6ef;user-select:none}",
  ".pl-inspect-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(16,41,55,.52),rgba(4,15,23,.9) 70%);backdrop-filter:blur(3px);animation:pl-backdrop-in .5s both}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-backdrop{animation:pl-backdrop-out .55s both}",
  ".pl-inspect-card{position:fixed;left:var(--pl-from-x);top:var(--pl-from-y);width:var(--pl-from-w);transform-origin:top left;will-change:transform;animation:pl-lift-open .72s cubic-bezier(.2,.78,.18,1) both;pointer-events:none}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-card{animation:pl-shrink-back .55s cubic-bezier(.42,0,.55,1) both}",
  ".pl-inspect-face{background:#fbfaf7;padding:10px 10px 0;box-shadow:0 25px 70px rgba(0,0,0,.4)}",
  ".pl-inspect-cover{animation:pl-cover-out .72s both}",
  ".pl-inspect-face .pl-shot img.pl-inspect-full{object-fit:contain;animation:pl-full-in .72s both}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-cover{animation:pl-cover-in .55s both}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-face .pl-shot img.pl-inspect-full{animation:pl-full-out .55s both}",
  ".pl-inspect-peg{position:absolute;left:50%;top:-10px;width:10px;height:26px;margin-left:-5px;border-radius:2px;background:linear-gradient(90deg,#c9a67a,#e3c9a1 45%,#b8915f);box-shadow:0 2px 3px rgba(0,0,0,.25);animation:pl-peg-off .72s both}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-peg{animation:pl-peg-on .55s both}",
  ".pl-inspect-info{position:fixed;left:20px;right:20px;top:var(--pl-info-y);max-width:560px;margin:auto;text-align:center;opacity:0;animation:pl-info-in .28s .48s both}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-info{animation:none;opacity:0}",
  ".pl-inspect-info h3{margin:0;font:500 clamp(18px,3vw,24px)/1.35 ui-serif,Georgia,serif}",
  ".pl-inspect-info p{margin:6px 0 14px;font:400 13px/1.4 ui-sans-serif,system-ui,sans-serif;color:rgba(255,255,255,.72)}",
  ".pl-inspect-info a{display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border:1px solid rgba(255,255,255,.55);border-radius:999px;color:inherit;text-decoration:none;font:500 13px/1 ui-sans-serif,system-ui,sans-serif}",
  ".pl-inspect-info a:hover{background:rgba(255,255,255,.15)}",
  ".pl-inspect-close{position:fixed;right:clamp(18px,4vw,48px);top:clamp(18px,4vw,40px);width:44px;height:44px;border:1px solid rgba(255,255,255,.45);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:28px;line-height:1;cursor:pointer;animation:pl-backdrop-in .25s .18s both}",
  ".pl-inspect[data-phase='closing'] .pl-inspect-close{animation:none;opacity:0;pointer-events:none}",
  ".pl-inspect-close:hover{background:rgba(255,255,255,.2)}",
  ".pl-inspect-close:focus-visible,.pl-inspect-info a:focus-visible{outline:2px solid #fff;outline-offset:3px}",
  "@keyframes pl-in{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}",
  "@keyframes pl-backdrop-in{from{opacity:0}to{opacity:1}}",
  "@keyframes pl-backdrop-out{from{opacity:1}to{opacity:0}}",
  "@keyframes pl-lift-open{0%{transform:translate3d(0,0,0) scale(1) rotate(0)}19%{transform:translate3d(0,-24px,0) scale(1.04) rotate(-3deg)}72%{transform:translate3d(var(--pl-dx),calc(var(--pl-dy) - 12px),0) scale(var(--pl-scale-peak)) rotate(1.2deg)}100%{transform:translate3d(var(--pl-dx),var(--pl-dy),0) scale(var(--pl-scale)) rotate(0)}}",
  "@keyframes pl-shrink-back{0%{transform:translate3d(var(--pl-dx),var(--pl-dy),0) scale(var(--pl-scale)) rotate(0)}72%{transform:translate3d(0,-16px,0) scale(1.03) rotate(-2deg)}100%{transform:translate3d(0,0,0) scale(1) rotate(0)}}",
  "@keyframes pl-peg-off{0%,12%{opacity:1}38%,100%{opacity:0}}",
  "@keyframes pl-peg-on{0%,65%{opacity:0}100%{opacity:1}}",
  "@keyframes pl-cover-out{0%,50%{opacity:1}100%{opacity:0}}",
  "@keyframes pl-full-in{0%,50%{opacity:0}100%{opacity:1}}",
  "@keyframes pl-cover-in{0%{opacity:0}50%,100%{opacity:1}}",
  "@keyframes pl-full-out{0%{opacity:1}50%,100%{opacity:0}}",
  "@keyframes pl-info-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
  "@media (max-width:600px){.pl-bar{display:grid;grid-template-columns:minmax(0,1fr) 44px 44px;gap:8px;align-items:center;bottom:20px}.pl-cap{grid-column:1/-1}.pl-title{font-size:17px;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}.pl-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl-btn{width:44px;height:44px}}",
  "@media (prefers-reduced-motion:reduce){.pl-cap>*{animation:none}.pl-print{transition:none}.pl-inspect-backdrop,.pl-inspect-card,.pl-inspect-peg,.pl-inspect-info,.pl-inspect-cover,.pl-inspect-full{animation-duration:.01ms!important;animation-delay:0ms!important}}",
].join("\n")

export default function PolaroidLineCarousel({
  slides = DEFAULT_SLIDES,
  height = "100svh",
  cardWidth = 300,
  sag = 46,
  swing = 1,
  autoplay = 4500,
  string = "#8a7f72",
  background = "var(--color-background, #efece6)",
  ink = "var(--color-foreground, #161513)",
  onChange,
  className,
  style,
  ariaLabel = "Image carousel",
}: PolaroidLineCarouselProps) {
  const n = slides.length
  const srcs = useSlideImages(slides)
  const [active, setActive] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const [size, setSize] = React.useState({ w: 1200, h: 800, cw: cardWidth })
  const [inspect, setInspect] = React.useState<null | {
    virtual: number
    index: number
    phase: "opening" | "open" | "closing"
    fromX: number
    fromY: number
    fromW: number
    toX: number
    toY: number
    toW: number
    infoY: number
  }>(null)
  const rootRef = React.useRef(null as HTMLDivElement | null)
  const pathRef = React.useRef(null as SVGPathElement | null)
  const cards = React.useRef(new Map<number, HTMLDivElement>())
  const sim = React.useRef({ off: 0, vel: 0, target: 0, a: [] as number[], w: [] as number[] })
  const drag = React.useRef(null as null | { x: number; off: number; lx: number; lt: number; v: number; moved: boolean })
  const lastTouch = React.useRef(0)
  const activeRef = React.useRef(0)
  const inspectingRef = React.useRef(false)
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const closeTimerRef = React.useRef<number | null>(null)
  const previousFocusRef = React.useRef<HTMLElement | null>(null)
  const opts = React.useRef({ sag, swing })
  opts.current = { sag, swing }

  const spacing = size.cw * 1.08
  const radius = n ? Math.max(1, Math.ceil((size.w / spacing + 4) / n)) : 1
  const virtualSlots = React.useMemo(
    () => n ? Array.from({ length: (radius * 2 + 1) * n }, (_, i) => i - radius * n) : [],
    [n, radius],
  )
  const goTo = React.useCallback(
    (i: number) => {
      sim.current.target = i * spacing
    },
    [spacing],
  )

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ro = new ResizeObserver(() => {
      const r = root.getBoundingClientRect()
      const cw = Math.round(Math.max(150, Math.min(cardWidth, r.width * 0.42, r.height * 0.42)))
      setSize({ w: r.width, h: r.height, cw })
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [cardWidth])

  // keep the target on the active print when the spacing changes
  React.useEffect(() => {
    sim.current.target = activeRef.current * spacing
    sim.current.off = activeRef.current * spacing
  }, [spacing])

  React.useEffect(() => {
    onChange?.(active)
  }, [active, onChange])

  React.useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  React.useEffect(() => {
    if (!inspect) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = oldOverflow
      previousFocusRef.current?.focus()
    }
    // Only run when the viewer opens or closes, not between animation phases.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(inspect)])

  // the simulation, written straight to the DOM each frame
  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let visible = true
    let raf = 0
    let prev = performance.now()
    const S = sim.current
    const frame = (now: number) => {
      raf = 0
      if (!visible) return
      if (inspectingRef.current) {
        raf = requestAnimationFrame(frame)
        return
      }
      const dt = Math.min(0.033, (now - prev) / 1000)
      prev = now
      const { w, h, cw } = size
      const y0 = Math.max(40, h * 0.2)
      const d = drag.current
      let lineVel: number
      if (d && d.moved) {
        lineVel = d.v * 1000
      } else {
        const before = S.off
        ;[S.off, S.vel] = springStep(S.off, S.vel, S.target, dt)
        lineVel = -(S.off - before) / Math.max(dt, 1e-3)
      }
      const o = opts.current
      const g = reduce ? 0 : o.swing
      let near = Math.round(S.off / spacing)
      if (n) {
        while (near >= n) {
          S.off -= n * spacing
          S.target -= n * spacing
          if (d) d.off -= n * spacing
          near -= n
        }
        while (near < 0) {
          S.off += n * spacing
          S.target += n * spacing
          if (d) d.off += n * spacing
          near += n
        }
      }
      for (const i of virtualSlots) {
        const el = cards.current.get(i)
        if (!el) continue
        const x = w / 2 + i * spacing - S.off
        if (x < -cw * 1.5 || x > w + cw * 1.5) {
          el.style.visibility = "hidden"
          continue
        }
        el.style.visibility = "visible"
        const slot = wrap(i, n)
        let a = S.a[slot] || 0
        let av = S.w[slot] || 0
        ;[a, av] = swingStep(a, av, lineVel, dt, g)
        if (g) a += Math.sin(now / 1300 + slot * 1.7) * 0.0009 * g
        if (w < 600) a = clamp(a, -0.18, 0.18)
        S.a[slot] = a
        S.w[slot] = av
        const y = stringY(x, w, y0, o.sag) - 6
        el.style.transform = "translate(" + (x - cw / 2).toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + a.toFixed(4) + "rad)"
        el.style.zIndex = String(i === near ? n + 1 : n - Math.abs(i - near))
      }
      pathRef.current?.setAttribute("d", "M0 " + y0 + " Q" + w / 2 + " " + (y0 + 2 * o.sag) + " " + w + " " + y0)
      if (near !== activeRef.current) {
        activeRef.current = near
        setActive(wrap(near, n))
      }
      raf = requestAnimationFrame(frame)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) {
        prev = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(root)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [size, spacing, n, virtualSlots])

  // autoplay, back to the first print after the last
  React.useEffect(() => {
    if (!autoplay || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = window.setInterval(() => {
      if (document.hidden || drag.current || inspectingRef.current || performance.now() - lastTouch.current < autoplay) return
      goTo(activeRef.current + 1)
    }, autoplay)
    return () => window.clearInterval(t)
  }, [autoplay, n, goTo])

  const openInspect = (virtual: number, card: HTMLDivElement) => {
    if (inspectingRef.current || !n) return
    const rect = card.getBoundingClientRect()
    const toW = Math.max(160, Math.min(420, window.innerWidth - 40, window.innerHeight - 250))
    const toH = toW + 56
    const toY = Math.max(60, (window.innerHeight - toH - 110) / 2)
    previousFocusRef.current = document.activeElement as HTMLElement | null
    inspectingRef.current = true
    lastTouch.current = performance.now()
    setInspect({
      virtual,
      index: wrap(virtual, n),
      phase: "opening",
      fromX: rect.left,
      fromY: rect.top,
      fromW: rect.width,
      toX: (window.innerWidth - toW) / 2,
      toY,
      toW,
      infoY: toY + toH + 20,
    })
  }
  const closeInspect = () => {
    if (!inspect || closeTimerRef.current !== null) return
    setInspect({ ...inspect, phase: "closing" })
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    closeTimerRef.current = window.setTimeout(() => {
      inspectingRef.current = false
      setInspect(null)
      closeTimerRef.current = null
    }, reduce ? 0 : 560)
  }

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".pl-bar")) return
    lastTouch.current = performance.now()
    drag.current = { x: e.clientX, off: sim.current.off, lx: e.clientX, lt: e.timeStamp, v: 0, moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true
      setDragging(true)
      rootRef.current?.setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    const dt = Math.max(1, e.timeStamp - d.lt)
    d.v = 0.7 * ((e.clientX - d.lx) / dt) + 0.3 * d.v
    d.lx = e.clientX
    d.lt = e.timeStamp
    sim.current.off = d.off - dx
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    lastTouch.current = performance.now()
    if (!d) return
    if (d.moved) {
      setDragging(false)
      sim.current.vel = clamp(-d.v * 1000, -spacing * 8, spacing * 8)
      const momentum = clamp(-d.v * 180, -spacing * 2, spacing * 2)
      goTo(Math.round((sim.current.off + momentum) / spacing))
      return
    }
    const card = (e.target as HTMLElement).closest("[data-i]")
    if (card instanceof HTMLDivElement) openInspect(Number(card.dataset.i), card)
  }
  const step = (dir: number) => {
    lastTouch.current = performance.now()
    goTo(Math.round(sim.current.target / spacing) + dir)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") step(1)
    else if (e.key === "ArrowLeft") step(-1)
    else if (e.key === "Enter" || e.key === " ") {
      const card = cards.current.get(activeRef.current)
      if (card) openInspect(activeRef.current, card)
    }
    else return
    e.preventDefault()
  }

  const onInspectKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      closeInspect()
    } else if (e.key === "Tab") {
      const focusable = [closeRef.current, e.currentTarget.querySelector(".pl-inspect-info a")].filter(Boolean) as HTMLElement[]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        last.focus()
        e.preventDefault()
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus()
        e.preventDefault()
      }
    }
  }

  const s = slides[active] || {}

  return (
    <div
      ref={rootRef}
      className={["pl-root", className].filter(Boolean).join(" ")}
      style={{
        height,
        ["--pl-bg" as string]: background,
        ["--pl-ink" as string]: ink,
        ["--pl-muted" as string]: "color-mix(in srgb, var(--pl-ink) 55%, transparent)",
        ["--pl-line" as string]: "color-mix(in srgb, var(--pl-ink) 18%, transparent)",
        ["--pl-cw" as string]: size.cw + "px",
        ...style,
      }}
      data-drag={dragging ? "1" : "0"}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <style>{PL_CSS}</style>
      <svg className="pl-string" aria-hidden="true">
        <path ref={pathRef} fill="none" stroke={string} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {virtualSlots.map((virtual) => {
        const i = wrap(virtual, n)
        const sl = slides[i]
        return (
        <div key={virtual} className="pl-card" data-i={virtual} data-on={virtual === activeRef.current ? "1" : "0"} data-inspecting={inspect?.virtual === virtual ? "1" : undefined} ref={(el) => { if (el) cards.current.set(virtual, el); else cards.current.delete(virtual) }} aria-hidden={virtual === activeRef.current ? undefined : true}>
          <div className="pl-print">
            <div className="pl-shot">{srcs[i] ? <img src={srcs[i]} alt={sl.alt || sl.title || ""} draggable={false} /> : null}</div>
            <div className="pl-note">{sl.title || ""}</div>
          </div>
          <div className="pl-peg" />
        </div>
        )
      })}
      <div className="pl-bar">
        <div className="pl-cap" key={active}>
          {s.title ? (s.href
            ? <a className="pl-title pl-link" href={s.href} aria-label={`查看${s.title}详情`}>{s.title} <span aria-hidden="true">↗</span></a>
            : <span className="pl-title">{s.title}</span>) : null}
          {s.caption ? <span className="pl-sub">{s.caption}</span> : null}
        </div>
        <span className="pl-count" aria-hidden="true">
          <b>{pad2(active + 1)}</b> / {pad2(n)}
        </span>
        <button type="button" className="pl-btn" aria-label="上一项" onClick={() => step(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        <button type="button" className="pl-btn" aria-label="下一项" onClick={() => step(1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </div>
      <div className="pl-sr" aria-live="polite">
        {"Print " + (active + 1) + " of " + n + (s.title ? ": " + s.title : "")}
      </div>
      {inspect && createPortal(
        <div
          className="pl-inspect"
          data-phase={inspect.phase}
          role="dialog"
          aria-modal="true"
          aria-label={`查看${slides[inspect.index]?.title || "奖项照片"}`}
          onKeyDown={onInspectKey}
          style={{
            ["--pl-from-x" as string]: inspect.fromX + "px",
            ["--pl-from-y" as string]: inspect.fromY + "px",
            ["--pl-from-w" as string]: inspect.fromW + "px",
            ["--pl-dx" as string]: inspect.toX - inspect.fromX + "px",
            ["--pl-dy" as string]: inspect.toY - inspect.fromY + "px",
            ["--pl-scale" as string]: String(inspect.toW / inspect.fromW),
            ["--pl-scale-peak" as string]: String(inspect.toW / inspect.fromW * 1.035),
            ["--pl-info-y" as string]: inspect.infoY + "px",
          }}
        >
          <div className="pl-inspect-backdrop" onClick={closeInspect} />
          <div
            className="pl-inspect-card"
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return
              if (inspect.phase === "opening") setInspect((current) => current ? { ...current, phase: "open" } : null)
            }}
          >
            <div className="pl-inspect-face">
              <div className="pl-shot">{srcs[inspect.index] && <>
                <img className="pl-inspect-cover" src={srcs[inspect.index]} alt="" aria-hidden="true" />
                <img className="pl-inspect-full" src={srcs[inspect.index]} alt={slides[inspect.index]?.alt || slides[inspect.index]?.title || ""} />
              </>}</div>
              <div className="pl-note">{slides[inspect.index]?.title || ""}</div>
            </div>
            <div className="pl-inspect-peg" aria-hidden="true" />
          </div>
          <div className="pl-inspect-info">
            <h3>{slides[inspect.index]?.title}</h3>
            {slides[inspect.index]?.caption && <p>{slides[inspect.index]?.caption}</p>}
            {slides[inspect.index]?.href && <a href={slides[inspect.index].href}>查看奖项详情 ↗</a>}
          </div>
          <button ref={closeRef} type="button" className="pl-inspect-close" aria-label="关闭照片" onClick={closeInspect}>×</button>
        </div>,
        document.body,
      )}
    </div>
  )
}
