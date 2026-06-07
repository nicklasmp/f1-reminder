import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#0a0a0a',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#e8002d',
          borderRadius: '18px',
          width: 138,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 70,
            fontWeight: 900,
            letterSpacing: '-4px',
            lineHeight: 1,
            fontFamily: 'Arial Black, Arial, sans-serif',
            paddingLeft: 4,
          }}
        >
          F1
        </span>
      </div>
    </div>,
    { ...size }
  );
}
