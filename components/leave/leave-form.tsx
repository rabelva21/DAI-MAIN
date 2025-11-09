'use client';

import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Send,
  UploadCloud,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { Department, LeaveType } from '@prisma/client';
import useSWR from 'swr';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';

const leaveTypeLabels: Record<LeaveType, string> = {
  ANNUAL: 'Cuti Tahunan',
  SICK: 'Cuti Sakit',
  MATERNITY: 'Cuti Melahirkan',
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Komponen Skeleton
function LeaveFormSkeleton() {
  return (
    <Card className="border-gray-200">
      <CardHeader className="border-b bg-gray-50">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-gray-500">Nama Lengkap</Label>
              <Skeleton className="h-6 w-40" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-500">Departemen</Label>
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-500">Sisa Cuti Tahunan</Label>
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
          <hr />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-black">Jenis Cuti</Label>
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Label className="text-black">Tanggal Mulai</Label>
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Label className="text-black">Tanggal Selesai</Label>
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-black">Alasan Cuti</Label>
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
// Akhir Komponen Skeleton

export function LeaveForm() {
  const { toast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Ambil Cloudinary config dari .env.local
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

  const {
    data: departments,
    error: deptError,
    isLoading: deptIsLoading,
  } = useSWR<Department[]>('/api/departments', fetcher);

  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    proof: null as File | null,
  });

  if (sessionStatus === 'loading' || deptIsLoading) {
    return <LeaveFormSkeleton />;
  }

  if (sessionStatus === 'unauthenticated') {
    return <p>Anda tidak terautentikasi.</p>;
  }

  const employeeName = session?.user?.name || 'N/A';
  const remainingLeave = session?.user?.remainingLeave ?? 0;
  const userDepartmentId = session?.user?.departmentId || '';

  const userDepartmentName =
    departments?.find((d) => d.id === userDepartmentId)?.name || 'N/A';

  if (deptError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Gagal memuat data departemen. Silakan muat ulang halaman.
        </AlertDescription>
      </Alert>
    );
  }

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) return 0;
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  const daysTaken = calculateDays();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Validasi dasar
    if (daysTaken <= 0) {
      setApiError('Tanggal selesai harus setelah atau sama dengan tanggal mulai.');
      return;
    }
    if (formData.leaveType === 'ANNUAL' && remainingLeave < daysTaken) {
      setApiError('Jatah cuti tahunan Anda tidak mencukupi.');
      return;
    }
    if (!userDepartmentId || userDepartmentName === 'N/A') {
      setApiError('Data departemen Anda tidak ditemukan. Hubungi HRD.');
      return;
    }

    const proofRequired =
      formData.leaveType === 'SICK' || formData.leaveType === 'MATERNITY';
    if (proofRequired && !formData.proof) {
      setApiError('Bukti (Surat Dokter, dll) wajib diunggah untuk cuti ini.');
      return;
    }

    // Cek konfigurasi Cloudinary
    if (proofRequired && (!cloudName || !apiKey)) {
      setApiError(
        'Konfigurasi upload belum diatur oleh admin (Missing Cloudinary Env Vars).'
      );
      console.error(
        'Error: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME atau NEXT_PUBLIC_CLOUDINARY_API_KEY tidak diatur di .env.local'
      );
      return;
    }

    setIsSubmitting(true);
    let proofUrl = null;

    // --- LANGKAH 1: UPLOAD KE CLOUDINARY (JIKA DIPERLUKAN) ---
    if (proofRequired && formData.proof) {
      setIsUploading(true);
      try {
        // --- LANGKAH 1a: Dapatkan Tanda Tangan (Signature) dari server KITA ---
        const timestamp = Math.round(new Date().getTime() / 1000);
        const paramsToSign = {
          timestamp: timestamp,
        };

        const signatureRes = await fetch('/api/upload-signature', {
          method: 'POST',
          body: JSON.stringify({ paramsToSign }),
        });

        if (!signatureRes.ok) {
          throw new Error('Gagal mendapatkan izin unggah dari server.');
        }

        const { signature } = await signatureRes.json();

        // --- LANGKAH 1b: Unggah file ke Cloudinary dengan Tanda Tangan ---
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.proof);
        uploadFormData.append('api_key', apiKey!);
        uploadFormData.append('timestamp', timestamp.toString());
        uploadFormData.append('signature', signature);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            body: uploadFormData,
          }
        );

        if (!uploadRes.ok) {
          throw new Error('Gagal mengunggah bukti gambar ke Cloudinary.');
        }

        const uploadData = await uploadRes.json();
        proofUrl = uploadData.secure_url; // Dapatkan URL aman
      } catch (error: any) {
        setApiError(`Upload Gagal: ${error.message}`);
        setIsUploading(false);
        setIsSubmitting(false);
        return;
      }
      setIsUploading(false);
    }

    // --- LANGKAH 2: KIRIM URL KE API SERVER ANDA ---
    try {
      const response = await fetch('/api/leave/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType: formData.leaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason,
          daysTaken,
          proofUrl: proofUrl, // Kirim URL yang didapat dari Cloudinary
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengajukan cuti');
      }

      toast({
        title: 'Pengajuan Berhasil!',
        description:
          'Permohonan cuti Anda telah dikirim dan menunggu persetujuan.',
      });

      // Reset form
      setFormData({
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
        proof: null,
      });
      // Reset input file secara manual
      const fileInput = document.getElementById('proof') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      setApiError(error.message);
      toast({
        title: 'Gagal Mengajukan Cuti',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || isUploading;
  let buttonText = 'Kirim Pengajuan';
  if (isUploading) buttonText = 'Mengunggah Bukti...';
  if (isSubmitting && !isUploading) buttonText = 'Mengirim...';

  return (
    <Card className="border-gray-200">
      <CardHeader className="border-b bg-gray-50">
        <CardTitle className="text-2xl text-black">Form Pengajuan Cuti</CardTitle>
        <CardDescription>
          Isi formulir di bawah ini untuk mengajukan permohonan cuti
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-gray-500">Nama Lengkap</Label>
              <p className="font-medium text-black">{employeeName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-500">Departemen</Label>
              <p className="font-medium text-black">{userDepartmentName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-500">Sisa Cuti Tahunan</Label>
              <p className="text-xl font-bold text-red-600">
                {remainingLeave} Hari
              </p>
            </div>
          </div>
          <hr />
          {apiError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leaveType" className="text-black">
                Jenis Cuti <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.leaveType}
                onValueChange={(value) => {
                  setFormData({ ...formData, leaveType: value, proof: null });
                  setApiError(null);
                  // Reset input file jika tipe diubah
                  const fileInput = document.getElementById(
                    'proof'
                  ) as HTMLInputElement;
                  if (fileInput) fileInput.value = '';
                }}
                required
                disabled={isLoading}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Pilih jenis cuti" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(leaveTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(formData.leaveType === 'SICK' ||
              formData.leaveType === 'MATERNITY') && (
              <div className="space-y-2">
                <Label htmlFor="proof" className="text-black">
                  Upload Bukti (Surat Dokter, dll){' '}
                  <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="proof"
                  type="file"
                  // Terima gambar dan PDF
                  accept="image/png, image/jpeg, image/jpg, application/pdf"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      proof: e.target.files ? e.target.files[0] : null,
                    })
                  }
                  required
                  disabled={isLoading}
                  className="border-gray-300 file:text-sm file:font-medium"
                />
                <p className="text-xs text-gray-500">
                  Hanya .jpg, .png, atau .pdf. Maks 10MB.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-black">
                Tanggal Mulai <span className="text-red-600">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  setFormData({ ...formData, startDate: e.target.value });
                  setApiError(null);
                }}
                required
                disabled={isLoading}
                className="border-gray-300"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-black">
                Tanggal Selesai <span className="text-red-600">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => {
                  setFormData({ ...formData, endDate: e.target.value });
                  setApiError(null);
                }}
                required
                disabled={isLoading}
                min={formData.startDate}
                className="border-gray-300"
              />
            </div>
          </div>
          {daysTaken > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-black">
                  Total Durasi Cuti:{' '}
                  <span className="text-red-600">{daysTaken} hari</span>
                </p>
              </div>
              {formData.leaveType === 'ANNUAL' &&
                remainingLeave < daysTaken && (
                  <p className="mt-2 text-xs text-red-700">
                    Jatah cuti Anda ({remainingLeave} hari) tidak mencukupi untuk
                    pengajuan ini.
                  </p>
                )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-black">
              Alasan Cuti <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Jelaskan alasan pengajuan cuti..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              required
              rows={4}
              disabled={isLoading}
              className="border-gray-300 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  leaveType: '',
                  startDate: '',
                  endDate: '',
                  reason: '',
                  proof: null,
                });
                const fileInput = document.getElementById(
                  'proof'
                ) as HTMLInputElement;
                if (fileInput) fileInput.value = '';
              }}
              className="border-gray-300"
              disabled={isLoading}
            >
              Reset
            </Button>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 w-44" // Beri lebar tetap
              disabled={
                isLoading ||
                daysTaken <= 0 ||
                (formData.leaveType === 'ANNUAL' && remainingLeave < daysTaken)
              }
            >
              {isUploading ? (
                <UploadCloud className="mr-2 h-4 w-4 animate-bounce" />
              ) : isSubmitting ? null : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {buttonText}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}