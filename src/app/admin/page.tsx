'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

interface LogEntry {
  ts: number;
  level: string;
  msg: string;
}

interface BotStatus {
  running: boolean;
  pid?: number;
  roomCode?: string;
  startedAt?: string;
  startedBy?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<BotStatus>({ running: false });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState({ level: 'ALL', search: '' });
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check admin status
  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data } = await authClient.getSession();
        if (!data?.user?.id) {
          router.push('/login');
          return;
        }
        
        const res = await fetch('/api/admin/test-bot');
        if (res.status === 401) {
          router.push('/dashboard');
          return;
        }
        
        const status = await res.json();
        setBotStatus(status);
        setIsAdmin(true);
      } catch (err) {
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    checkAdmin();
  }, [router]);

  // SSE connection for logs
  useEffect(() => {
    if (!botStatus.running) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Connect to bot's SSE endpoint (proxied or direct)
    const evtSource = new EventSource('http://localhost:3099/logs');
    eventSourceRef.current = evtSource;

    evtSource.onmessage = (e) => {
      try {
        const log = JSON.parse(e.data) as LogEntry;
        setLogs(prev => [...prev.slice(-500), log]); // Keep last 500 logs
      } catch (err) {
        console.error('Failed to parse log:', e.data);
      }
    };

    evtSource.onerror = () => {
      console.log('SSE connection error, retrying...');
    };

    return () => {
      evtSource.close();
    };
  }, [botStatus.running]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startBot = async () => {
    setStarting(true);
    setLogs([]);
    try {
      const res = await fetch('/api/admin/test-bot', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setBotStatus({ running: true, ...data });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  const stopBot = async () => {
    setStopping(true);
    try {
      await fetch('/api/admin/test-bot', { method: 'DELETE' });
      setBotStatus({ running: false });
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStopping(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter.level !== 'ALL' && log.level !== filter.level) return false;
    if (filter.search && !log.msg.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'text-gray-400';
      case 'PLAYER': return 'text-green-400';
      case 'AUTH': return 'text-yellow-400';
      case 'ERROR': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold mb-6">
            <span className="text-gradient">🛠️ Admin Panel</span>
          </h1>

          {/* Test Bot Section */}
          <Card className="bg-card border-border/50 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>🤖 Test Bot</span>
                <div className="flex items-center gap-3">
                  {botStatus.running && botStatus.roomCode && (
                    <a 
                      href={`https://jklm.fun/${botStatus.roomCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-primary/20 rounded text-sm font-mono hover:bg-primary/30 transition-colors"
                    >
                      🎮 {botStatus.roomCode}
                    </a>
                  )}
                  <span className={`px-2 py-1 rounded text-xs ${botStatus.running ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {botStatus.running ? '● Running' : '○ Stopped'}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-4">
                {!botStatus.running ? (
                  <button
                    onClick={startBot}
                    disabled={starting}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium disabled:opacity-50 transition-colors"
                  >
                    {starting ? '⏳ Starting...' : '▶️ Start Test Bot'}
                  </button>
                ) : (
                  <button
                    onClick={stopBot}
                    disabled={stopping}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium disabled:opacity-50 transition-colors"
                  >
                    {stopping ? '⏳ Stopping...' : '⏹️ Stop Bot'}
                  </button>
                )}
              </div>

              {/* Log Filters */}
              <div className="flex gap-3 mb-3">
                <select 
                  value={filter.level}
                  onChange={(e) => setFilter(f => ({ ...f, level: e.target.value }))}
                  className="px-3 py-1.5 bg-secondary rounded text-sm"
                >
                  <option value="ALL">All Levels</option>
                  <option value="INFO">INFO</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="PLAYER">PLAYER</option>
                  <option value="AUTH">AUTH</option>
                  <option value="ERROR">ERROR</option>
                </select>
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={filter.search}
                  onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
                  className="flex-1 px-3 py-1.5 bg-secondary rounded text-sm"
                />
                <button
                  onClick={() => setLogs([])}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded text-sm"
                >
                  Clear
                </button>
              </div>

              {/* Log Viewer */}
              <div className="bg-black/50 rounded-lg p-3 h-[400px] overflow-y-auto font-mono text-xs">
                {filteredLogs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    {botStatus.running ? 'Waiting for logs...' : 'Start the bot to see logs'}
                  </div>
                ) : (
                  filteredLogs.map((log, i) => (
                    <div key={i} className="flex gap-2 py-0.5">
                      <span className="text-gray-600 w-20 flex-shrink-0">
                        {new Date(log.ts).toLocaleTimeString()}
                      </span>
                      <span className={`w-16 flex-shrink-0 ${getLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="text-gray-200">{log.msg}</span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
