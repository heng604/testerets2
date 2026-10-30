import React, { useState, useEffect } from 'react';

// Auto-sliding image banner.
// - Each image slides in from the left to the right (see .xc-slide-banner-img
//   / @keyframes xcSlideLR in styles/theme.js).
// - Every `intervalMs` (default 1000 = 1s) it advances to the next image and
//   loops back to the first once it reaches the end — runs forever.
//
// Sizing:
// - By default, height follows each image's own natural aspect ratio
//   (scales down smoothly as the screen gets narrower).
// - `minHeight` sets a floor so it never shrinks below that, no matter how
//   narrow the screen is — once the natural aspect-ratio height would dip
//   below minHeight, the image switches to object-fit: cover to fill that
//   floor height without ever stretching/distorting (it crops the sides
//   evenly instead).
// - `height` (fixed number) locks the banner to exactly that height for
//   every image at every screen size, always using object-fit: cover.
// - `aspectRatio` (width / height, e.g. 1902/688) locks the banner's width
//   and height to that exact ratio at every screen size — the width stays
//   100% of the container and the height is derived from it, so every
//   slide comes out the same width x height box (object-fit: cover keeps
//   images from stretching). Takes priority over `height`/`minHeight` when set.
export function AutoSlideBanner({ images, intervalMs = 1000, height, minHeight = 180, aspectRatio, rounded = true }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length < 2) return; // nothing to rotate
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [images, intervalMs]);

  if (!images || images.length === 0) return null;

  const fixedRatio = typeof aspectRatio === 'number';
  const fixedHeight = !fixedRatio && typeof height === 'number';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: fixedRatio ? undefined : (fixedHeight ? height : undefined),
        aspectRatio: fixedRatio ? String(aspectRatio) : undefined,
        minHeight: fixedRatio || fixedHeight ? undefined : minHeight,
        borderRadius: rounded ? '16px' : '0px',
        overflow: 'hidden',
        border: '4px solid rgba(165, 180, 252, 0.35)',
        background: '#100d1c',
        lineHeight: 0, // avoids a few stray px of gap under inline images
      }}
    >
      {/* key={index} forces React to remount the <img>, which replays the
          xcSlideLR CSS animation from scratch on every image change. */}
      <img
        key={index}
        src={images[index]}
        alt=""
        className="xc-slide-banner-img"
        style={{
          width: '100%',
          height: fixedRatio || fixedHeight ? '100%' : 'auto',
          minHeight: fixedRatio || fixedHeight ? undefined : minHeight,
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
          {images.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === index ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
