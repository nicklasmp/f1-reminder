import { NextResponse } from 'next/server';
import { fetchNews } from '@/lib/news';

export async function GET() {
  try {
    const news = await fetchNews();
    return NextResponse.json({ news }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('News API error:', err);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
