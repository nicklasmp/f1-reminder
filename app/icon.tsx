import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 280,
          fontWeight: 900,
          letterSpacing: '-14px',
          lineHeight: 1,
          fontFamily: 'Arial Black, Arial, sans-serif',
          paddingLeft: 14,
        }}
      >
        F1
      </span>
    </div>,
    { ...size }
  );
}
