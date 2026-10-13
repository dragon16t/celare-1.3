import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Admin-editable top-of-homepage banner; auto-slides when multiple images exist.
export default function TopBanner() {
  const [cfg, setCfg] = useState(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API}/api/top-banner`).then(r => {
      if (mounted) setCfg(r.data || {});
    }).catch(() => { if (mounted) setCfg({}); });
    return () => { mounted = false; };
  }, []);

  const slides = (cfg?.slides && cfg.slides.length)
    ? cfg.slides
    : (cfg && (cfg.image_desktop || cfg.image_mobile) ? [cfg] : []);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const t = setInterval(() => setIdx(i => (i + 1) % count), Math.max(1500, cfg?.autoplay_ms || 4000));
    return () => clearInterval(t);
  }, [count, cfg?.autoplay_ms, paused, idx]);

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, moved: false }; setPaused(true); };
  const onTouchMove = (e) => { if (touch.current) touch.current.dx = e.touches[0].clientX - touch.current.x; };
  const onTouchEnd = (e) => {
    const dx = touch.current?.dx || 0;
    if (Math.abs(dx) > 40 && count > 1) {
      e.preventDefault();
      setIdx((i) => (dx < 0 ? (i + 1) % count : (i - 1 + count) % count));
    }
    touch.current = null;
    setPaused(false);
  };

  if (!cfg || !cfg.is_active || !count) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-2 sm:pt-3" data-testid="homepage-top-banner">
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-emerald-100 shadow-sm bg-white touch-pan-y"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} data-testid="top-banner-track">
        <div className="flex items-center transition-transform duration-700 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {slides.map((s, i) => <BannerSlide key={i} slide={s} index={i} />)}
        </div>
        {count > 1 && (
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" data-testid="top-banner-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIdx(i)}
                data-testid={`top-banner-dot-${i}`}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${i === idx ? 'w-5 bg-emerald-600' : 'w-1.5 bg-white/80 ring-1 ring-stone-300'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BannerSlide({ slide, index }) {
  const to = slide.link_url || '/shop?niche=anti-aging';
  const external = /^https?:\/\//.test(to);
  const img = (
    <picture>
      {slide.image_mobile && <source media="(max-width: 640px)" srcSet={slide.image_mobile} />}
      <img
        src={slide.image_desktop || slide.image_mobile}
        alt="Celesta Glow — shop the collection"
        loading={index === 0 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : 'auto'}
        decoding="async"
        className="w-full h-auto block object-cover"
      />
    </picture>
  );
  const cls = 'block w-full shrink-0';
  return external
    ? <a href={to} target="_blank" rel="noopener noreferrer" className={cls} data-testid={`top-banner-slide-${index}`}>{img}</a>
    : <Link to={to} className={cls} data-testid={`top-banner-slide-${index}`}>{img}</Link>;
}
