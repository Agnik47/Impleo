import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { cn } from '../lib/utils.js';

/*
 * Environmental particles — drifting leaves + soft spores on a single canvas.
 * Cheap and self-contained:
 *   - DPR-aware, resizes with its container
 *   - pauses via IntersectionObserver when off-screen, and on tab hide
 *   - disabled entirely under reduced-motion (renders nothing)
 * Colors are brand lime/green at low alpha so it reads as atmosphere, not noise.
 */
const COLORS = ['rgba(166,217,26,', 'rgba(40,201,78,', 'rgba(0,160,80,'];

function makeLeaf(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: 4 + Math.random() * 7,
    speed: 0.15 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 0.4,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.02,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.005 + Math.random() * 0.01,
    alpha: 0.12 + Math.random() * 0.22,
    color: COLORS[(Math.random() * COLORS.length) | 0],
  };
}

export default function LeafField({ density = 26, className = '' }) {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let running = true;
    let leaves = [];
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((density * w) / 1200);
      leaves = Array.from({ length: Math.max(8, count) }, () => makeLeaf(w, h));
    }

    function drawLeaf(l) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = `${l.color}${l.alpha})`;
      ctx.beginPath();
      // simple leaf: two mirrored quadratic curves
      ctx.moveTo(0, -l.size);
      ctx.quadraticCurveTo(l.size, 0, 0, l.size);
      ctx.quadraticCurveTo(-l.size, 0, 0, -l.size);
      ctx.fill();
      ctx.restore();
    }

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const l of leaves) {
        l.sway += l.swaySpeed;
        l.y += l.speed;
        l.x += l.drift + Math.sin(l.sway) * 0.3;
        l.rot += l.rotSpeed;
        if (l.y - l.size > h) {
          l.y = -l.size;
          l.x = Math.random() * w;
        }
        if (l.x < -20) l.x = w + 20;
        if (l.x > w + 20) l.x = -20;
        drawLeaf(l);
      }
      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    // Pause when off-screen.
    const io = new IntersectionObserver(
      ([e]) => {
        running = e.isIntersecting && !document.hidden;
        if (running && !raf) tick();
        else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVisibility = () => {
      running = !document.hidden;
      if (running && !raf) tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
    };
  }, [density, reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}
