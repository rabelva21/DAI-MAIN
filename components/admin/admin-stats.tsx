'use client';

import useSWR from 'swr';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileText,
  Clock,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StatsData {
  totalEmployees: number;
  totalRequests: number;
  pendingRequests: number;
  employeesOnLeave: number;
  requestsByDepartment: { name: string; total: number }[];
}

const chartConfig = {
  total: {
    label: 'Total Pengajuan',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

// Komponen Card Statistik
function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2" />
        ) : (
          <div className="text-3xl font-bold text-black">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

// Komponen Utama Dashboard
export function AdminDashboardStats() {
  const { data, error, isLoading } = useSWR<StatsData>(
    '/api/admin/stats',
    fetcher
  );

  const stats = [
    {
      title: 'Total Karyawan',
      value: data?.totalEmployees ?? 0,
      icon: Users,
    },
    {
      title: 'Total Pengajuan',
      value: data?.totalRequests ?? 0,
      icon: FileText,
    },
    {
      title: 'Menunggu Persetujuan',
      value: data?.pendingRequests ?? 0,
      icon: Clock,
    },
    {
      title: 'Sedang Cuti Hari Ini',
      value: data?.employeesOnLeave ?? 0,
      icon: UserCheck,
    },
  ];

  if (error) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h3 className="font-semibold text-red-800">Gagal Memuat Data</h3>
        </div>
        <p className="text-sm text-red-700">
          Tidak dapat memuat data statistik. Silakan coba muat ulang halaman.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-6">
      {/* 1. Kartu Statistik */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* 2. Bagan Departemen */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Pengajuan Cuti per Departemen</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ChartContainer
              config={chartConfig}
              className="h-[250px] w-full"
            >
              <BarChart
                data={data?.requestsByDepartment}
                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
