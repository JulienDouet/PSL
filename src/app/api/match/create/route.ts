import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomCode, autoCreate } = body;

    // Mode création automatique OU code room existant
    if (!autoCreate && (!roomCode || typeof roomCode !== 'string' || roomCode.length !== 4)) {
      return NextResponse.json({ error: 'Invalid room code (must be 4 chars) or set autoCreate: true' }, { status: 400 });
    }

    // Chemin absolu vers le script du bot
    const botScript = path.join(process.cwd(), 'jklm-bot/index.js');
    
    // URL de callback (fallback à localhost si non défini)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/match/callback`;

    // Arguments selon le mode
    let args: string[];
    if (autoCreate) {
      console.log(`🚀 [API] Création automatique de room + lancement bot...`);
      args = [botScript, '--create', callbackUrl];
    } else {
      console.log(`🚀 [API] Lancement du bot pour la room ${roomCode}...`);
      args = [botScript, roomCode, callbackUrl];
    }
    console.log(`📡 [API] Callback URL: ${callbackUrl}`);

    // Configuration du détachement du processus
    // Par défaut: détaché en PROD, attaché en DEV (pour que le bot se ferme avec le serveur)
    // Peut être forcé via BOT_DETACHED=true/false
    const isDev = process.env.NODE_ENV === 'development';
    let isDetached = !isDev; // Default behavior
    
    if (process.env.BOT_DETACHED !== undefined) {
        isDetached = process.env.BOT_DETACHED === 'true';
    }

    console.log(`⚙️ [API] Bot process mode: ${isDetached ? 'DETACHED (Background)' : 'ATTACHED (Child)'}`);

    // Lancement du processus Node.js
    const child = spawn('node', args, {
        detached: isDetached,
        stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr
        cwd: process.cwd()
    });

    let roomCodeFound: string | null = null;
    let botPid = child.pid;

    if (autoCreate) {
      // Attendre que le bot affiche le code de la room
      try {
        roomCodeFound = await new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('⏰ Timeout waiting for room code');
            resolve(null);
          }, 20000); // 20s timeout

          child.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[BOT] ${output.trim()}`);
            // Chercher "Room créée: XXXX"
            const match = output.match(/Room cr..?e: ([A-Z]{4})/i); 
            if (match) {
              clearTimeout(timeout);
              resolve(match[1]);
            }
          });

          child.stderr.on('data', (data) => {
            console.error(`[BOT ERR] ${data.toString()}`);
          });

          child.on('exit', (code) => {
             if (code !== 0) {
                 console.error(`[BOT] Exited with code ${code}`);
                 // Don't resolve null yet, maybe output came earlier? But effectively failed.
             }
          });
        });
      } catch (e) {
        console.error('Error awaiting room code:', e);
      }
    } else {
        // En mode join manuel, on laisse juste tourner mais on peut logger un peu
        child.stdout.on('data', d => console.log(`[BOT] ${d}`));
        child.stderr.on('data', d => console.error(`[BOT ERR] ${d}`));
    }

    // On détache le processus pour ne pas attendre sa fin
    child.unref();

    console.log(`✅ [API] Bot lancé avec PID ${botPid}, Room: ${roomCodeFound || 'N/A'}`);

    return NextResponse.json({ 
        success: true, 
        pid: botPid, 
        autoCreate: !!autoCreate,
        roomCode: roomCodeFound
    });
  } catch (err) {
    console.error('❌ [API] Erreur lancement bot:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
