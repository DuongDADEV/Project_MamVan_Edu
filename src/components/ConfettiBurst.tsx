import React, { useEffect, useRef, useState } from 'react';

// Hiệu ứng "Tung hoa" không cần thư viện ngoài: canvas toàn màn hình,
// mảnh giấy rơi có trọng lực, tự biến mất sau durationMs. Tôn trọng
// prefers-reduced-motion (không hiện gì khi user bật giảm chuyển động).
const COLORS = ['#F59E0B', '#10B981', '#4F46E5', '#EC4899', '#F97316', '#06B6D4', '#F2B84B'];

export const ConfettiBurst: React.FC<{ pieces?: number; durationMs?: number }> = ({
  pieces = 90,
  durationMs = 2600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDone(true);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      s: number;
      c: string;
      r: number;
      vr: number;
      circle: boolean;
    };
    const ps: P[] = Array.from({ length: pieces }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.25,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2 + Math.random() * 3.5,
      s: 5 + Math.random() * 7,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      circle: Math.random() < 0.35,
    }));
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx + Math.sin(t / 300 + p.r) * 0.6;
        p.y += p.vy;
        p.vy += 0.045;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        }
        ctx.restore();
      }
      if (t < durationMs) {
        raf = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    const timer = setTimeout(() => setDone(true), durationMs + 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [pieces, durationMs]);

  if (done) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 z-[200] pointer-events-none" aria-hidden="true" />;
};
