import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

const COLS = 8;
const SQUARE = 512 / COLS; // 64px
const ROWS = 2;
const STRIP_H = SQUARE * ROWS; // 128px

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#e8002d',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        position: 'relative',
      }}
    >
      {/* F1 text — fills the top portion */}
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
            fontSize: 260,
            fontWeight: 900,
            letterSpacing: '-14px',
            lineHeight: 1,
            fontFamily: 'Arial Black, Arial, sans-serif',
            paddingLeft: 14,
            textShadow: '0 4px 32px rgba(0,0,0,0.25)',
          }}
        >
          F1
        </span>
      </div>

      {/* Checkered finish-line strip */}
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
