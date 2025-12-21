"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "@/lib/auth-client";
import { Loader2, LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function Navbar() {
  const { data: session, isPending } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();

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
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Language Switcher - Minimal Text Style */}
          <button 
            onClick={toggleLanguage} 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium"
            title={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
          >
            {language === 'fr' ? 'FR' : 'EN'}
          </button>

          {isPending ? (
             <div className="flex items-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
             </div>
          ) : session ? (
            <>
              <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                {t.navbar.leaderboard}
              </Link>
              <Link href="/matches" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                {t.navbar.matches || "Matchs"}
              </Link>
              <Link href="/dashboard#play">
                <Button size="sm" className="bg-gradient-psl hover:opacity-90 transition-opacity">
                  🎮 {t.navbar.play}
                </Button>
              </Link>
              <a href="https://discord.gg/JGHRNy6qRn" target="_blank" rel="noopener noreferrer" className="hidden sm:block">
                <Button size="sm" variant="outline" className="border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/10">
                  Discord
                </Button>
              </a>
              
              {/* Profile Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {(session.user.name?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium hidden sm:inline">{session.user.name}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-150">
                    <Link
                      href={`/profile/${session.user.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {t.navbar.profile}
                    </Link>
                    <Link
                      href={`/profile/${session.user.id}/edit`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      {t.navbar.edit_profile}
                    </Link>
                    <hr className="my-1 border-border" />
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-4 py-2 text-sm w-full text-left hover:bg-secondary transition-colors text-red-400"
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
                <Button variant="outline" className="border-primary/50 hover:border-primary hover:bg-primary/10">
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
