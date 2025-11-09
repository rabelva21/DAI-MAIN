import { HistoryTable } from '@/components/employee/history-table';

export default function MyHistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">Status & Riwayat Cuti</h1>
        <p className="mt-2 text-gray-600">
          Lacak semua pengajuan cuti Anda di sini.
        </p>
      </div>
      <HistoryTable />
    </div>
  );
}