"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "@/lib/auth-client";
import { Loader2, LogOut, User, Settings, ChevronDown, Trophy, Gamepad2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function Navbar() {
  const { data: session, isPending } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [liveMatchCount, setLiveMatchCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();

  // Check admin status
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/admin/test-bot')
        .then(res => {
          setIsAdmin(res.status !== 401);
        })
        .catch(() => setIsAdmin(false));
    }
  }, [session?.user?.id]);

  // Fetch live match count
  useEffect(() => {
    async function fetchLiveMatches() {
      try {
        const res = await fetch('/api/matches/active', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setLiveMatchCount(data.matches?.length || 0);
        }
      } catch (err) {
        // Ignore errors
      }
    }
    
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Fermer le menu si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    router.push("/");
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Image src="/transparent logo.png" alt="PSL Logo" width={120} height={60} className="object-contain" />
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Language Switcher - With SVG flags */}
          <button 
            onClick={toggleLanguage} 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer border border-border/30"
            title={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
          >
            {language === 'fr' ? (
              <>
                <svg className="w-5 h-3.5" viewBox="0 0 3 2">
                  <rect width="1" height="2" fill="#002654"/>
                  <rect x="1" width="1" height="2" fill="#fff"/>
                  <rect x="2" width="1" height="2" fill="#ce1126"/>
                </svg>
                <span>FR</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-3.5" viewBox="0 0 60 30">
                  <rect width="60" height="30" fill="#012169"/>
                  <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
                  <path d="M0,0 L60,30" stroke="#C8102E" strokeWidth="2"/>
                  <path d="M60,0 L0,30" stroke="#C8102E" strokeWidth="2"/>
                  <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
                  <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
                </svg>
                <span>EN</span>
              </>
            )}
          </button>

          {isPending ? (
             <div className="flex items-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
             </div>
          ) : session ? (
            <>
              {/* Leaderboard - With icon */}
              <Link 
                href="/leaderboard" 
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <Trophy className="w-4 h-4" />
                {t.navbar.leaderboard}
              </Link>
              
              {/* Matches - With live count badge */}
              <Link 
                href="/matches" 
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all relative"
              >
                <Gamepad2 className="w-4 h-4" />
                {t.navbar.matches || "Matchs"}
                {liveMatchCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                    {liveMatchCount}
                  </span>
                )}
              </Link>
              
              {/* Play Button - Subtle gradient */}
              <Link href="/dashboard#play">
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-medium shadow-md transition-all hover:shadow-lg"
                >
                  🎮 {t.navbar.play}
                </Button>
              </Link>
              
              {/* Discord Button - With icon and glow */}
              <a href="https://discord.gg/JGHRNy6qRn" target="_blank" rel="noopener noreferrer" className="hidden sm:block">
                <Button 
                  size="sm" 
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium shadow-lg shadow-[#5865F2]/25 hover:shadow-[#5865F2]/40 transition-all"
                >
                  <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Discord
                </Button>
              </a>
              
              {/* Profile Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border/50 transition-all cursor-pointer"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="w-7 h-7 rounded-full ring-2 ring-primary/30"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                      {(session.user.name?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium hidden sm:inline">{session.user.name}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <Link
                      href={`/profile/${session.user.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/80 transition-colors"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      {t.navbar.profile}
                    </Link>
                    <Link
                      href={`/profile/${session.user.id}/edit`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/80 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      {t.navbar.edit_profile}
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-secondary/80 transition-colors"
                      >
                        <span className="w-4 h-4 flex items-center justify-center">🛠️</span>
                        {t.navbar.admin}
                      </Link>
                    )}
                    <hr className="my-1.5 border-border/50" />
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm w-full text-left hover:bg-red-500/10 transition-colors text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      {t.navbar.logout}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                {t.navbar.leaderboard}
              </Link>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/25">
                  {t.navbar.login}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
