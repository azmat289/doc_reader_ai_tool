import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // TODO: Retrieve chat session by ID
  const chatSession = {
    id,
    messages: [
      {
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString()
      },
      {
        role: 'assistant', 
        content: 'Hi there! How can I help you today?',
        timestamp: new Date().toISOString()
      }
    ]
  }

  return NextResponse.json(chatSession)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // TODO: Add message to existing chat session
    const response = {
      id,
      message: `Response to: ${message}`,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}