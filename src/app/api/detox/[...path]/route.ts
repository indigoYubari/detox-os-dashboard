import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'https://web-production-179ae.up.railway.app'
const USER = process.env.DETOX_DASHBOARD_USER
const PASS = process.env.DETOX_DASHBOARD_PASS

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  const search = request.nextUrl.searchParams.toString()
  const url = `${BACKEND}/api/${path}${search ? `?${search}` : ''}`

  const headers: Record<string, string> = {}
  if (USER && PASS) {
    headers['Authorization'] = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`
  }

  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Backend utilgjengelig' }, { status: 502 })
  }
}
