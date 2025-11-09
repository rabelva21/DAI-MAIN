'use client';

import { useState } from 'react';
import { LeaveTable } from '@/components/admin/leave-table';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AdminDashboardStats } from '@/components/admin/admin-stats';
import { DepartmentStats } from '@/components/admin/department-stats';
import { useSWRConfig } from 'swr';

// Komponen aksi Reset Cuti (tetap sama)
function ResetLeaveButton() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/reset-all-leave', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Gagal mereset cuti');
      const data = await res.json();
      toast({
        title: 'Berhasil!',
        description: `Jatah cuti untuk ${data.count} karyawan telah direset ke 12.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash className="mr-2 h-4 w-4" />
          Reset Jatah Cuti Tahunan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini akan MENGATUR ULANG jatah cuti (remainingLeave) semua
            karyawan (role: EMPLOYEE) kembali ke 12. Tindakan ini tidak dapat
            dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? 'Mereset...' : 'Ya, Reset Semua'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Komponen aksi Import/Backup (Diperbarui)
function DataActions() {
  const { toast } = useToast();
  const { mutate } = useSWRConfig(); // <-- Dapatkan mutate global
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) throw new Error('Gagal membuat file backup');
      const disposition = res.headers.get('content-disposition');
      const fileName =
        disposition?.split('filename=')[1]?.replace(/"/g, '') ||
        'dai_backup.json';
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Backup Berhasil',
        description: `${fileName} telah diunduh.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error Backup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Saat file dipilih
  const onFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json') {
        toast({
          title: 'File Tidak Valid',
          description: 'Harap pilih file .json yang didapat dari backup.',
          variant: 'destructive',
        });
        return;
      }
      setImportFile(file);
      setIsImportAlertOpen(true); // Tampilkan dialog konfirmasi
    }
    // Kosongkan input agar bisa pilih file yang sama
    event.target.value = '';
  };

  // Saat konfirmasi import
  const handleConfirmImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Gagal mengimpor data');
      }

      toast({
        title: 'Import Berhasil!',
        description: `${result.counts.users} user, ${result.counts.departments} departemen, dan ${result.counts.leaveRequests} pengajuan telah diimpor.`,
      });
      
      // --- REFRESH SEMUA DATA DI HALAMAN ---
      mutate('/api/admin/stats');
      mutate('/api/admin/department-stats');
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/leave/admin-list'));

    } catch (error: any) {
      toast({
        title: 'Error Import',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setIsImportAlertOpen(false);
      setImportFile(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={handleBackup}
        disabled={isBackingUp || isImporting}
      >
        {isBackingUp ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Backup Data
      </Button>

      {/* Tombol Import sekarang hanya memicu input file */}
      <Button asChild variant="outline" disabled={isBackingUp || isImporting}>
        <label htmlFor="import-file">
          {isImporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Import Data
          <input
            type="file"
            id="import-file"
            className="sr-only"
            accept=".json"
            onChange={onFileSelect}
            disabled={isImporting}
          />
        </label>
      </Button>

      {/* Dialog Konfirmasi Import */}
      <AlertDialog
        open={isImportAlertOpen}
        onOpenChange={setIsImportAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ANDA YAKIN?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan **MENGHAPUS SEMUA DATA** saat ini (karyawan,
              departemen, dan riwayat cuti) dan menggantinya dengan data dari
              file backup.
              <br />
              <strong className="mt-2 block">
                File: {importFile?.name}
              </strong>
              <br />
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isImporting}
              onClick={() => setImportFile(null)}
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isImporting}
              onClick={handleConfirmImport}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isImporting ? 'Mengimpor...' : 'Ya, Hapus dan Impor'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ... (Komponen AdminPage tetap sama) ...
export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-black">Dashboard Admin</h1>
            <p className="mt-2 text-gray-600">
              Kelola dan review pengajuan cuti karyawan PT. DAI
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DataActions />
          </div>
        </div>
      </div>

      {/* Statistik Ringkasan */}
      <AdminDashboardStats />

      {/* Statistik Departemen */}
      <div className="my-8">
        <DepartmentStats />
      </div>

      {/* Reset Jatah Cuti Tahunan */}
      {/* <div className="my-8 space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800">Aksi Berbahaya</h3>
          <p className="text-sm text-yellow-700 mb-2">
            Fitur ini akan mereset jatah cuti semua karyawan. Gunakan dengan
            hati-hati di akhir tahun.
          </p>
          <ResetLeaveButton />
        </div>
      </div> */}

      {/* Tabel Pengajuan Cuti */}
      <LeaveTable />
    </div>
  );
}
