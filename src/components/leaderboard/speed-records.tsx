'use client';

import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpeedRecords, type SpeedRecord } from '@/app/actions/get-speed-records';
import { Loader2, Search, Timer } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from "@/lib/i18n/context";

export function SpeedRecords() {
  const [filterType, setFilterType] = useState<'text' | 'length'>('text');
  const [searchTerm, setSearchTerm] = useState('');
  const [lengthFilter, setLengthFilter] = useState<number | null>(null);
  const [records, setRecords] = useState<SpeedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  
  // Load default records on mount
  useEffect(() => {
    fetchRecords();
  }, []);

  // Fetch when length filter changes
  useEffect(() => {
    if (filterType === 'length' && lengthFilter) {
        fetchRecords({ length: lengthFilter });
    }
  }, [lengthFilter, filterType]);

  async function fetchRecords(options?: { query?: string, length?: number }) {
    setLoading(true);
    try {
      const data = await getSpeedRecords(options);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    fetchRecords({ query: searchTerm });
  }

  // Dynamic title
  const getTitle = () => {
    if (filterType === 'text' && searchTerm) return `Top 50 - "${searchTerm}"`;
    if (filterType === 'length' && lengthFilter) return `Top 50 - ${lengthFilter} ${t.leaderboard.speed.letters}`;
    return t.leaderboard.speed.global_top;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            {t.leaderboard.speed.search_title}
          </CardTitle>
        </CardHeader>
        <CardContent>
            {/* Filter Type Toggle */}
            <div className="flex gap-4 mb-4">
                <Button 
                    variant={filterType === 'text' ? 'default' : 'outline'}
                    onClick={() => { setFilterType('text'); setSearchTerm(''); fetchRecords(); }}
                    size="sm"
                >
                    {t.leaderboard.speed.filter_text}
                </Button>
                <Button 
                    variant={filterType === 'length' ? 'default' : 'outline'}
                    onClick={() => { setFilterType('length'); setLengthFilter(null); fetchRecords(); }}
                    size="sm"
                >
                    {t.leaderboard.speed.filter_length}
                </Button>
            </div>

            {/* Input Search */}
            {filterType === 'text' && (
                <form onSubmit={handleSearch} className="flex gap-2">
                    <Input
                    placeholder="naruto, bts, ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                    />
                    <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span className="ml-2">{t.common.search}</span>
                    </Button>
                </form>
            )}

            {/* Length Controls */}
            {filterType === 'length' && (
                <div className="flex items-center gap-4 w-full p-2">
                    <Input
                        type="number"
                        min={1}
                        max={40}
                        value={lengthFilter || ''}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 1 && val <= 40) {
                                setLengthFilter(val);
                            } else if (e.target.value === '') {
                                setLengthFilter(null);
                            }
                        }}
                        placeholder="N"
                        className="w-20 text-center font-mono font-bold"
                    />
                    <div className="relative flex-1 h-6 flex items-center">
                        <input
                            type="range"
                            min="1"
                            max="40"
                            value={lengthFilter || 1}
                            onChange={(e) => setLengthFilter(parseInt(e.target.value))}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                    <span className="text-sm text-muted-foreground w-20 text-right">
                        {lengthFilter ? `${lengthFilter} ${t.leaderboard.speed.letters}` : '-'}
                    </span>
                </div>
            )}

        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
            <CardTitle>{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
        {records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                {loading ? t.common.loading : t.leaderboard.speed.no_records}
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-muted-foreground border-b border-border/50">
                        <tr>
                            <th className="px-4 py-3 text-left w-16">{t.leaderboard.speed.table.rank}</th>
                            <th className="px-4 py-3 text-left">{t.leaderboard.speed.table.player}</th>
                            <th className="px-4 py-3 text-left">{t.leaderboard.speed.table.answer}</th>
                            <th className="px-4 py-3 text-right">{t.leaderboard.speed.table.time}</th>
                            <th className="px-4 py-3 text-right">{t.leaderboard.speed.table.date}</th>
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
                                <td className="px-4 py-3 font-medium text-foreground/80">
                                    {record.answer}
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
    </div>
  );
}

