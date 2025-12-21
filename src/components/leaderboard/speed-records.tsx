'use client';

import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpeedRecords, type SpeedRecord } from '@/app/actions/get-speed-records';
import { Loader2, Search, Timer } from 'lucide-react';
import Link from 'next/link';

export function SpeedRecords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<SpeedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await getSpeedRecords(searchTerm);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            Recherche de records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Entre une réponse (ex: naruto, france...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2">Rechercher</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card className="bg-card border-border/50">
            <CardHeader>
                <CardTitle>Top 50 - {searchTerm}</CardTitle>
            </CardHeader>
            <CardContent>
            {records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    Aucun record trouvé pour cette réponse.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-muted-foreground border-b border-border/50">
                            <tr>
                                <th className="px-4 py-3 text-left w-16">#</th>
                                <th className="px-4 py-3 text-left">Joueur</th>
                                <th className="px-4 py-3 text-right">Temps</th>
                                <th className="px-4 py-3 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record, index) => (
                                <tr key={record.id} className="border-b border-border/10 hover:bg-secondary/20 transition-colors">
                                    <td className="px-4 py-3 font-mono text-muted-foreground">{index + 1}</td>
                                    <td className="px-4 py-3">
                                        <Link href={`/profile/${record.userId}`} className="flex items-center gap-2 hover:underline">
                                            {record.userImage ? (
                                                <img src={record.userImage} alt="" className="w-6 h-6 rounded-full" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                                                    {(record.userName[0] || '?').toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium">{record.userName}</span>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-green-400">
                                        {(record.time / 1000).toFixed(3)}s
                                    </td>
                                    <td className="px-4 py-3 text-right text-muted-foreground">
                                        {new Date(record.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
