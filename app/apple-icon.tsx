import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: '#e8002d',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: 98,
          fontWeight: 900,
          letterSpacing: '-5px',
          lineHeight: 1,
          fontFamily: 'Arial Black, Arial, sans-serif',
          paddingLeft: 5,
        }}
      >
        F1
      </span>
    </div>,
    { ...size }
  );
}
