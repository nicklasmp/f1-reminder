import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#0a0a0a',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '22%',
      }}
    >
      {/* Checkered flag accent — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          right: 48,
          display: 'flex',
          flexWrap: 'wrap',
          width: 80,
          height: 80,
          opacity: 0.18,
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 20,
              height: 20,
              background: (Math.floor(i / 4) + (i % 4)) % 2 === 0 ? 'white' : 'transparent',
            }}
          />
        ))}
      </div>

      {/* F1 pill badge */}
      <div
        style={{
          background: '#e8002d',
          borderRadius: '32px',
          width: 340,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 176,
            fontWeight: 900,
            letterSpacing: '-10px',
            lineHeight: 1,
            fontFamily: 'Arial Black, Arial, sans-serif',
            paddingLeft: 12,
          }}
        >
          F1
        </span>
      </div>
    </div>,
    { ...size }
  );
}
