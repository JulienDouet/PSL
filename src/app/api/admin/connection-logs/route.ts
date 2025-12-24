import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import type { Category } from '@prisma/client';

// POST - Bot sends a connection log event
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.roomCode || !body.nickname || typeof body.success !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Create the connection log
    const log = await prisma.connectionLog.create({
      data: {
        roomCode: body.roomCode,
        nickname: body.nickname,
        success: body.success,
        method: body.method || null,
        failReason: body.failReason || null,
        userId: body.userId || null,
        authService: body.authService || null,
        authId: body.authId || null,
        category: body.category as Category || null,
        queueCount: body.queueCount || null,
      }
    });
    
    return NextResponse.json({ success: true, id: log.id });
  } catch (err) {
    console.error('❌ Error creating connection log:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET - Admin fetches recent connection logs
export async function GET(req: Request) {
  try {
    await requireAdmin();
    
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const roomCode = url.searchParams.get('roomCode');
    const successFilter = url.searchParams.get('success');
    
    const logs = await prisma.connectionLog.findMany({
      where: {
        ...(roomCode && { roomCode }),
        ...(successFilter === 'true' && { success: true }),
        ...(successFilter === 'false' && { success: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    
    return NextResponse.json({ logs });
  } catch (err: any) {
    if (err.message?.includes('Admin')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('❌ Error fetching connection logs:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Admin clears old logs (optional cleanup)
export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    
    const url = new URL(req.url);
    const olderThanDays = parseInt(url.searchParams.get('olderThanDays') || '7');
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    const deleted = await prisma.connectionLog.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });
    
    return NextResponse.json({ success: true, deleted: deleted.count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
