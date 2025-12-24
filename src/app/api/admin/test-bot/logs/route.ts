import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    
    // In production, we need to connect to the bot's HTTP server
    // The bot runs on the same Railway project, we use internal networking
    const botHost = process.env.BOT_INTERNAL_URL || 'http://localhost:3099';
    
    // Create a ReadableStream that proxies from the bot
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(`${botHost}/logs`, {
            headers: { 'Accept': 'text/event-stream' }
          });
          
          if (!response.ok) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ level: 'ERROR', msg: 'Bot not running or unreachable', ts: Date.now() })}\n\n`));
            controller.close();
            return;
          }
          
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          
          // Pump data from bot to client
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          
          controller.close();
        } catch (err) {
          console.error('SSE proxy error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ level: 'ERROR', msg: 'Connection to bot failed', ts: Date.now() })}\n\n`));
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
