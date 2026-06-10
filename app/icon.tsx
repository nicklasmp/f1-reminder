import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  const CHECKER = 32;
  const COLS = 16; // 512 / 32
  const ROWS = 2;
  const STRIP_H = CHECKER * ROWS;

  const checkers = Array.from({ length: ROWS * COLS }, (_, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return (
      <div
        key={i}
        style={{
          width: 512 / COLS,
          height: CHECKER,
          background: (row + col) % 2 === 0 ? '#ffffff' : '#0a0a0a',
          flexShrink: 0,
        }}
      />
    );
  });

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 60%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Speed bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            <div style={{ width: 300, height: 18, background: '#e8002d', transform: 'skewX(-30deg)' }} />
            <div style={{ width: 220, height: 18, background: '#e8002d', transform: 'skewX(-30deg) translateX(-40px)', opacity: 0.65 }} />
          </div>
          {/* F1 text */}
          <span
            style={{
              color: 'white',
              fontSize: 220,
              fontWeight: 900,
              transform: 'skewX(-12deg)',
              letterSpacing: '-11px',
              lineHeight: 1,
              fontFamily: 'Arial Black, Arial, sans-serif',
              paddingRight: 18,
            }}
          >
            F1
          </span>
        </div>

        {/* Red divider + checkered strip */}
        <div style={{ width: '100%', height: 14, background: '#e8002d', display: 'flex' }} />
        <div
          style={{
            width: '100%',
            height: STRIP_H,
            display: 'flex',
            flexWrap: 'wrap',
            overflow: 'hidden',
          }}
        >
          {checkers}
        </div>
      </div>
    ),
    { ...size }
  );
}
