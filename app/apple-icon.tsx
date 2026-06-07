import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const COLS = 6;
const SQUARE = 180 / COLS; // 30px
const ROWS = 2;
const STRIP_H = SQUARE * ROWS; // 60px

export default function AppleIcon() {
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
            fontSize: 90,
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
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: `${STRIP_H}px`,
          flexShrink: 0,
        }}
      >
        {Array.from({ length: ROWS }).map((_, row) => (
          <div key={row} style={{ display: 'flex', flex: 1 }}>
            {Array.from({ length: COLS }).map((_, col) => (
              <div
                key={col}
                style={{
                  flex: 1,
                  background: (row + col) % 2 === 0 ? 'white' : '#111',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>,
    { ...size }
  );
}
