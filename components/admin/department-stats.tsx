'use client';

import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DepartmentStat {
  id: string;
  name: string;
  maxConcurrentLeave: number;
  totalDaysTaken: number;
  onLeaveToday: number;
}

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex justify-between items-center p-2">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function DepartmentStats() {
  const {
    data: stats,
    error,
    isLoading,
  } = useSWR<DepartmentStat[]>('/api/admin/department-stats', fetcher);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Ringkasan Kuota Departemen</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <StatsLoadingSkeleton />}
        {error && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm">Gagal memuat statistik departemen.</p>
          </div>
        )}
        {stats && !isLoading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departemen</TableHead>
                <TableHead>Cuti Hari Ini / Kuota Bersamaan</TableHead>
                <TableHead className="text-right">
                  Total Hari Terpakai
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500">
                    Belum ada data departemen.
                  </TableCell>
                </TableRow>
              )}
              {stats.map((dept) => {
                const quotaPercentage =
                  dept.maxConcurrentLeave > 0
                    ? (dept.onLeaveToday / dept.maxConcurrentLeave) * 100
                    : 0;
                return (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-sm">
                          {dept.onLeaveToday} / {dept.maxConcurrentLeave}
                        </span>
                        <Progress value={quotaPercentage} className="w-full" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {dept.totalDaysTaken} Hari
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}