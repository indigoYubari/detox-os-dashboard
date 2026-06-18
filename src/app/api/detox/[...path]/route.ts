import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'https://web-production-179ae.up.railway.app'
const USER = process.env.DETOX_DASHBOARD_USER
const PASS = process.env.DETOX_DASHBOARD_PASS

function authHeaders() {
  const headers: Record<string, string> = {}
  if (USER && PASS) {
    headers['Authorization'] = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`
  }
  return headers
}

async function forward(
  request: NextRequest,
  params: { path: string[] },
  method: 'GET' | 'POST',
) {
  const path = params.path.join('/')
  const search = request.nextUrl.searchParams.toString()
  const url = `${BACKEND}/api/${path}${search ? `?${search}` : ''}`

  const headers = authHeaders()
  if (method === 'POST') headers['content-type'] = 'application/json'

  let body: string | undefined
  if (method === 'POST') {
    const text = await request.text()
    body = text || '{}'
  }

  try {
    const res = await fetch(url, { method, headers, body, cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Backend utilgjengelig' }, { status: 502 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params, 'POST')
}
