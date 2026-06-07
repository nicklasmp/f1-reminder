import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const CHECKER_H = 15;
  const COLS = 12; // 180 / 15
  const ROWS = 2;
  const STRIP_H = CHECKER_H * ROWS;

  const checkers = Array.from({ length: ROWS * COLS }, (_, i) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return (
      <div
        key={i}
        style={{
          width: 180 / COLS,
          height: CHECKER_H,
          background: (row + col) % 2 === 0 ? '#000000' : '#ffffff',
          flexShrink: 0,
        }}
      />
    );
  });

  return new ImageResponse(
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
      {/* F1 text */}
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
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: '-5px',
            lineHeight: 1,
            fontFamily: 'Arial Black, Arial, sans-serif',
            paddingLeft: 5,
          }}
        >
          F1
        </span>
      </div>

      {/* Checkered strip */}
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
    </div>,
    { ...size }
  );
}
