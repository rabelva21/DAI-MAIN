'use client';

import { useState, useEffect } from 'react';
import { format, isSameDay, isWithinInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Send,
  UploadCloud,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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

// Komponen Skeleton (Loading)
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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function LeaveForm() {
  const { toast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // --- STATE UNTUK TANGGAL YANG SUDAH DIBOOKING ---
  const [bookedRanges, setBookedRanges] = useState<{ from: Date; to: Date }[]>([]);

  // Cloudinary Config
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

  const { data: departments, error: deptError, isLoading: deptIsLoading } = useSWR<Department[]>('/api/departments', fetcher);
  
  // Ambil data tanggal booked dari API baru
  const { data: bookedData } = useSWR('/api/leave/booked-dates', fetcher);

  useEffect(() => {
    if (bookedData && Array.isArray(bookedData)) {
      const ranges = bookedData.map((d: any) => ({
        from: new Date(d.startDate),
        to: new Date(d.endDate),
      }));
      setBookedRanges(ranges);
    }
  }, [bookedData]);

  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
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
  const userDepartmentName = departments?.find((d) => d.id === userDepartmentId)?.name || 'N/A';

  if (deptError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Gagal memuat data departemen.</AlertDescription>
      </Alert>
    );
  }

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      if (formData.endDate < formData.startDate) return 0;
      const diffTime = Math.abs(formData.endDate.getTime() - formData.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  const daysTaken = calculateDays();

  // Helper untuk mengecek apakah tanggal tertentu disabled (Booked)
  const isDateDisabled = (date: Date) => {
    // 1. Cek apakah tanggal di masa lalu
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date < yesterday) return true;

    // 2. Cek apakah tanggal ada di bookedRanges
    return bookedRanges.some((range) => 
      isWithinInterval(date, { start: range.from, end: range.to })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Validasi Tanggal Manual (Double Check)
    if (formData.startDate && isDateDisabled(formData.startDate)) {
       setApiError("Tanggal Mulai yang dipilih sudah Anda ambil sebelumnya.");
       return;
    }
    if (formData.endDate && isDateDisabled(formData.endDate)) {
       setApiError("Tanggal Selesai yang dipilih sudah Anda ambil sebelumnya.");
       return;
    }

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

    const proofRequired = formData.leaveType === 'SICK' || formData.leaveType === 'MATERNITY';
    if (proofRequired && !formData.proof) {
      setApiError('Bukti (Surat Dokter, dll) wajib diunggah untuk cuti ini.');
      return;
    }

    if (proofRequired && (!cloudName || !apiKey)) {
      setApiError('Konfigurasi upload belum diatur admin.');
      return;
    }

    setIsSubmitting(true);
    let proofUrl = null;

    if (proofRequired && formData.proof) {
      setIsUploading(true);
      try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const paramsToSign = { timestamp: timestamp };
        const signatureRes = await fetch('/api/upload-signature', {
          method: 'POST',
          body: JSON.stringify({ paramsToSign }),
        });

        if (!signatureRes.ok) throw new Error('Gagal izin unggah.');
        const { signature } = await signatureRes.json();

        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.proof);
        uploadFormData.append('api_key', apiKey!);
        uploadFormData.append('timestamp', timestamp.toString());
        uploadFormData.append('signature', signature);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: uploadFormData }
        );

        if (!uploadRes.ok) throw new Error('Gagal unggah ke Cloudinary.');
        const uploadData = await uploadRes.json();
        proofUrl = uploadData.secure_url;
      } catch (error: any) {
        setApiError(`Upload Gagal: ${error.message}`);
        setIsUploading(false);
        setIsSubmitting(false);
        return;
      }
      setIsUploading(false);
    }

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
          proofUrl: proofUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengajukan cuti');
      }

      toast({
        title: 'Pengajuan Berhasil!',
        description: 'Permohonan cuti Anda telah dikirim dan menunggu persetujuan.',
      });

      // Reset form
      setFormData({
        leaveType: '',
        startDate: undefined,
        endDate: undefined,
        reason: '',
        proof: null,
      });
      const fileInput = document.getElementById('proof') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Refresh booked dates agar langsung update merahnya
      // (Optional: Bisa pakai mutate SWR, tapi reload simple juga oke jika user navigasi)
      
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
          Isi formulir di bawah ini. Tanggal merah menandakan sudah diambil.
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
                  const fileInput = document.getElementById('proof') as HTMLInputElement;
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

            {(formData.leaveType === 'SICK' || formData.leaveType === 'MATERNITY') && (
              <div className="space-y-2">
                <Label htmlFor="proof" className="text-black">
                  Upload Bukti <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setFormData({ ...formData, proof: e.target.files ? e.target.files[0] : null })
                  }
                  required
                  disabled={isLoading}
                  className="border-gray-300 file:text-sm file:font-medium"
                />
                <p className="text-xs text-gray-500">Maks 10MB.</p>
              </div>
            )}

            {/* --- DATE PICKER START --- */}
            <div className="space-y-2">
              <Label className="text-black">Tanggal Mulai <span className="text-red-600">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    disabled={isLoading}
                    className={cn(
                      "w-full justify-start text-left font-normal border-gray-300",
                      !formData.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(formData.startDate, "PPP", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={(date) => setFormData({ ...formData, startDate: date })}
                    disabled={isDateDisabled}
                    // Mengatur style untuk tanggal yang sudah dibooking (disabled)
                    modifiers={{ booked: bookedRanges }}
                    modifiersClassNames={{
                        booked: "bg-red-100 text-red-600 font-bold decoration-red-500 line-through opacity-100" 
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-black">Tanggal Selesai <span className="text-red-600">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    disabled={isLoading}
                    className={cn(
                      "w-full justify-start text-left font-normal border-gray-300",
                      !formData.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.endDate ? format(formData.endDate, "PPP", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.endDate}
                    onSelect={(date) => setFormData({ ...formData, endDate: date })}
                    disabled={(date) => 
                        isDateDisabled(date) || (formData.startDate ? date < formData.startDate : false)
                    }
                    modifiers={{ booked: bookedRanges }}
                    modifiersClassNames={{
                        booked: "bg-red-100 text-red-600 font-bold decoration-red-500 line-through opacity-100" 
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* --- DATE PICKER END --- */}

          </div>

          {daysTaken > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-red-600" />
                <p className="text-sm font-medium text-black">
                  Total Durasi Cuti: <span className="text-red-600">{daysTaken} hari</span>
                </p>
              </div>
              {formData.leaveType === 'ANNUAL' && remainingLeave < daysTaken && (
                <p className="mt-2 text-xs text-red-700">Jatah cuti tidak cukup.</p>
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
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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
                  startDate: undefined,
                  endDate: undefined,
                  reason: '',
                  proof: null,
                });
                const fileInput = document.getElementById('proof') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
              }}
              className="border-gray-300"
              disabled={isLoading}
            >
              Reset
            </Button>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 w-44"
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