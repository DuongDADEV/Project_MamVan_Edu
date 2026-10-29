import React, { useEffect, useRef } from 'react';

// Hiệu ứng "Pháo hoa" chúc mừng không cần thư viện ngoài: canvas toàn màn
// hình, tên lửa bay lên rồi nổ thành chùm hạt tỏa tròn, tự kết thúc rồi gọi
// onDone (để màn hình gọi nó thu hoạch lá). Tôn trọng prefers-reduced-motion
// (không hiện gì, gọi onDone ngay để lá vẫn biến mất như thường).
const COLORS = ['#F59E0B', '#EC4899', '#22D3EE', '#A78BFA', '#34D399', '#FB7185', '#FACC15'];

export const FireworksBurst: React.FC<{ onDone?: () => void; durationMs?: number }> = ({
  onDone,
  durationMs = 3000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDoneRef.current?.();
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

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      color: string;
      twinkle: number;
    };
    type Rocket = { x: number; y: number; vy: number; targetY: number; color: string };
    const particles: Particle[] = [];
    const rockets: Rocket[] = [];
    let raf = 0;
    const start = performance.now();
    let launched = 0;
    const BURSTS = 5;

    const launch = () => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      rockets.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h + 10,
        vy: -(9 + Math.random() * 3),
        targetY: h * (0.18 + Math.random() * 0.35),
        color,
      });
    };
    const explode = (x: number, y: number, color: string) => {
      const n = 55 + Math.floor(Math.random() * 25);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
        const sp = 1.5 + Math.random() * 4.5;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          maxLife: 60 + Math.random() * 50,
          size: 1.5 + Math.random() * 2.5,
          color: Math.random() < 0.75 ? color : COLORS[Math.floor(Math.random() * COLORS.length)],
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    };

    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      if (launched < BURSTS && t > launched * 450) {
        launch();
        launched++;
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy += 0.12;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(r.x, r.y + 8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (r.vy >= -1 || r.y <= r.targetY) {
          explode(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.vx *= 0.985;
        p.vy *= 0.99;
        const fade = 1 - p.life / p.maxLife;
        if (fade <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const tw = 0.6 + 0.4 * Math.sin(p.life * 0.35 + p.twinkle);
        ctx.globalAlpha = fade * tw;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (t < durationMs || rockets.length > 0 || particles.length > 0) {
        raf = requestAnimationFrame(tick);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [durationMs]);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[60] pointer-events-none" aria-hidden="true" />;
};
