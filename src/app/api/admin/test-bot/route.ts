import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Singleton: only one test bot at a time
let activeTestBot: {
  process: ChildProcess;
  roomCode: string | null;
  startedAt: Date;
  startedBy: string;
} | null = null;

// Auto-kill timeout (5 minutes)
const AUTO_KILL_TIMEOUT = 5 * 60 * 1000;
let autoKillTimer: NodeJS.Timeout | null = null;

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    
    // Check if already running
    if (activeTestBot && activeTestBot.process && !activeTestBot.process.killed) {
      return NextResponse.json({
        error: 'A test bot is already running',
        roomCode: activeTestBot.roomCode,
        startedBy: activeTestBot.startedBy,
        startedAt: activeTestBot.startedAt
      }, { status: 409 });
    }
    
    console.log(`🧪 [ADMIN] ${admin.userName} starting test bot...`);
    
    // Spawn bot process with --test-mode --create
    const botPath = path.join(process.cwd(), 'jklm-bot', 'index.js');
    const child = spawn('node', [botPath, '--create', '--test-mode'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    activeTestBot = {
      process: child,
      roomCode: null,
      startedAt: new Date(),
      startedBy: admin.userName || 'Admin'
    };
    
    // Capture room code from stdout
    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString();
      console.log(`[TEST-BOT] ${line.trim()}`);
      
      // Parse room code from "🎮 Room créée: XXXX"
      const roomMatch = line.match(/Room créée: ([A-Z]{4})/);
      if (roomMatch && activeTestBot) {
        activeTestBot.roomCode = roomMatch[1];
        console.log(`🎮 [ADMIN] Test bot room: ${activeTestBot.roomCode}`);
      }
    });
    
    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[TEST-BOT ERROR] ${data.toString().trim()}`);
    });
    
    child.on('exit', (code) => {
      console.log(`🧪 [ADMIN] Test bot exited with code ${code}`);
      activeTestBot = null;
      if (autoKillTimer) {
        clearTimeout(autoKillTimer);
        autoKillTimer = null;
      }
    });
    
    // Auto-kill after timeout
    autoKillTimer = setTimeout(() => {
      if (activeTestBot && activeTestBot.process && !activeTestBot.process.killed) {
        console.log('⏰ [ADMIN] Auto-killing test bot after timeout');
        activeTestBot.process.kill('SIGTERM');
        activeTestBot = null;
      }
    }, AUTO_KILL_TIMEOUT);
    
    // Wait a bit for room creation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return NextResponse.json({
      success: true,
      pid: child.pid,
      roomCode: activeTestBot?.roomCode,
      logsUrl: 'http://localhost:3099/logs',
      timeout: AUTO_KILL_TIMEOUT
    });
    
  } catch (err: any) {
    console.error('❌ [ADMIN] Test bot start error:', err);
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    
    if (!activeTestBot || !activeTestBot.process || activeTestBot.process.killed) {
      return NextResponse.json({ error: 'No test bot running' }, { status: 404 });
    }
    
    console.log('🛑 [ADMIN] Stopping test bot...');
    activeTestBot.process.kill('SIGTERM');
    
    if (autoKillTimer) {
      clearTimeout(autoKillTimer);
      autoKillTimer = null;
    }
    
    activeTestBot = null;
    
    return NextResponse.json({ success: true });
    
  } catch (err: any) {
    console.error('❌ [ADMIN] Test bot stop error:', err);
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    
    if (!activeTestBot || !activeTestBot.process || activeTestBot.process.killed) {
      return NextResponse.json({ running: false });
    }
    
    return NextResponse.json({
      running: true,
      pid: activeTestBot.process.pid,
      roomCode: activeTestBot.roomCode,
      startedAt: activeTestBot.startedAt,
      startedBy: activeTestBot.startedBy,
      logsUrl: 'http://localhost:3099/logs'
    });
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
