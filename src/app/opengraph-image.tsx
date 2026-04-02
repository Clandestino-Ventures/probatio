import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'PROBATIO — Forensic Music Copyright Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0A0A0B', color: '#F5F0EB',
        fontFamily: 'serif',
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', padding: '0 100px', opacity: 0.15 }}>
          {Array.from({ length: 80 }, (_, i) => (
            <div key={i} style={{
              width: '8px',
              height: `${20 + Math.sin(i * 0.3) * 40 + Math.cos(i * 0.7) * 30}%`,
              backgroundColor: i % 5 === 0 ? '#E63926' : '#2E6CE6',
              borderRadius: '2px 2px 0 0',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          <div style={{ fontSize: '72px', letterSpacing: '6px', fontWeight: 400 }}>PROBATIO</div>
          <div style={{ fontSize: '24px', color: '#8A8A8E', marginTop: '16px', letterSpacing: '1px' }}>
            Every frequency tells the truth.
          </div>
          <div style={{
            marginTop: '32px', padding: '8px 24px', border: '1px solid #3A3A3F',
            borderRadius: '4px', fontSize: '14px', color: '#8A8A8E', letterSpacing: '2px',
          }}>
            FORENSIC MUSIC COPYRIGHT INTELLIGENCE
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
