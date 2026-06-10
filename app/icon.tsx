import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  const CHECKER_H = 32;
  const COLS = 16;
  const ROWS = 2;
  const STRIP_H = CHECKER_H * ROWS;

  const checkers = Array.from({ length: ROWS * COLS }, (_, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return (
      <div
        key={i}
        style={{
          width: 512 / COLS,
          height: CHECKER_H,
          background: (row + col) % 2 === 0 ? '#000000' : '#ffffff',
          flexShrink: 0,
        }}
      />
    );
  });

  return new ImageResponse(
    (
      <div
        style={{
          background: '#e8002d',
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
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: 252,
              fontWeight: 900,
              letterSpacing: '-13px',
              lineHeight: 1,
              fontFamily: 'Arial Black, Arial, sans-serif',
              paddingLeft: 13,
            }}
          >
            F1
          </span>
        </div>
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
