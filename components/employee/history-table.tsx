'use client';

import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import useSWR from 'swr';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
// --- Impor Diperbarui ---
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'; // Import Tooltip
import { Label } from '@/components/ui/label';
import { Eye, ExternalLink, Paperclip } from 'lucide-react';
// --- PERBAIKAN: Impor Alert ---
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// -----------------------------
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { LeaveRequest, LeaveStatus, LeaveType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Skeleton } from '../ui/skeleton';

// Tipe data (tetap sama)
type LeaveRequestWithDetails = LeaveRequest & {
  hrdCommentBy: { fullName: string } | null;
};
type ApiResponse = {
  data: LeaveRequestWithDetails[];
  totalCount: number;
};
const fetcher = (url: string) => fetch(url).then((res) => res.json());
const leaveTypeLabels: Record<LeaveType, string> = {
  ANNUAL: 'Cuti Tahunan',
  SICK: 'Cuti Sakit',
  MATERNITY: 'Cuti Melahirkan',
};
const statusLabels: Record<LeaveStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};
const ITEMS_PER_PAGE = 5;
// --- Akhir Tipe Data ---

export function HistoryTable() {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequestWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const {
    data: apiResponse,
    error,
    mutate,
    isLoading,
  } = useSWR<ApiResponse>(
    `/api/leave/my-history?page=${currentPage}&limit=${ITEMS_PER_PAGE}`,
    fetcher
  );

  const requests = apiResponse?.data;
  const totalCount = apiResponse?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusBadge = (status: LeaveStatus) => {
    const styles = {
      PENDING: 'bg-gray-100 text-gray-800 border-gray-300',
      APPROVED: 'bg-green-50 text-green-700 border-green-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      CANCELLED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    };
    return (
      <Badge variant="outline" className={styles[status]}>
        {statusLabels[status]}
      </Badge>
    );
  };

  const handleCancelRequest = async (requestId: string) => {
    setIsCancelling(true);
    try {
      const res = await fetch('/api/leave/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal membatalkan');
      }

      toast({
        title: 'Berhasil',
        description: 'Pengajuan cuti telah dibatalkan.',
      });
      mutate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleViewDetail = (request: LeaveRequestWithDetails) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* --- TAMPILAN DESKTOP (TABLE) --- */}
        <div className="hidden rounded-lg border border-gray-200 bg-white md:block">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-100">
                  <TableHead className="font-semibold text-black">
                    Jenis Cuti
                  </TableHead>
                  <TableHead className="font-semibold text-black">
                    Tanggal
                  </TableHead>
                  <TableHead className="font-semibold text-black">
                    Durasi
                  </TableHead>
                  <TableHead className="font-semibold text-black">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-black">
                    Komentar HRD
                  </TableHead>
                  <TableHead className="text-right font-semibold text-black">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* --- PERBAIKAN: Memanggil Skeleton di dalam TableBody --- */}
                {isLoading && <LoadingSkeleton />}
                {error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-red-500">
                      Gagal memuat riwayat pengajuan.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && requests && requests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-gray-500"
                    >
                      Anda belum pernah mengajukan cuti.
                    </TableCell>
                  </TableRow>
                )}
                {/* -------------------------------------------------------- */}
                {requests?.map((request) => (
                  <TableRow key={request.id} className="hover:bg-gray-50">
                    <TableCell className="text-gray-700">
                      <div className="flex items-center gap-2">
                        {leaveTypeLabels[request.leaveType]}
                        {/* --- PERBAIKAN: Ganti title dengan Tooltip --- */}
                        {request.proofUrl && (
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger>
                              <Paperclip className="h-3 w-3 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ada lampiran</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* ------------------------------------------- */}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {format(new Date(request.startDate), 'dd MMM yyyy', {
                        locale: idLocale,
                      })}{' '}
                      -{' '}
                      {format(new Date(request.endDate), 'dd MMM yyyy', {
                        locale: idLocale,
                      })}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {request.daysTaken} hari
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer inline-block hover:opacity-80 transition-opacity"
                        onClick={() => handleViewDetail(request)}
                        title="Klik untuk melihat detail"
                      >
                        {getStatusBadge(request.status)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-700">
                      {request.hrdComment || '-'}
                      {request.hrdCommentBy && (
                        <span className="block text-xs text-gray-500">
                          (Oleh: {request.hrdCommentBy.fullName})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(request)}
                          title="Lihat Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {request.status === 'PENDING' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isCancelling}
                              >
                                Batalkan
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini akan membatalkan pengajuan cuti
                                  Anda. Anda tidak dapat mengurungkan tindakan
                                  ini.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Close</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={isCancelling}
                                  onClick={() =>
                                    handleCancelRequest(request.id)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {isCancelling
                                    ? 'Membatalkan...'
                                    : 'Ya, Batalkan'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* --- TAMPILAN SELULER (CARDS) --- */}
        <div className="space-y-4 md:hidden">
          {isLoading && <MobileLoadingSkeleton />}
          {/* --- PERBAIKAN: Menggunakan Alert --- */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Gagal memuat riwayat pengajuan.
              </AlertDescription>
            </Alert>
          )}
          {/* ---------------------------------- */}
          {!isLoading && requests && requests.length === 0 && (
            <p className="text-center text-gray-500">
              Anda belum pernah mengajukan cuti.
            </p>
          )}
          {requests?.map((request) => (
            <Card key={request.id} className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-black flex items-center gap-2">
                    {leaveTypeLabels[request.leaveType]}
                    {/* --- PERBAIKAN: Ganti title dengan Tooltip --- */}
                    {request.proofUrl && (
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger>
                          <Paperclip className="h-4 w-4 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ada lampiran</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* ------------------------------------------- */}
                  </div>
                  <div
                    className="cursor-pointer"
                    onClick={() => handleViewDetail(request)}
                  >
                    {getStatusBadge(request.status)}
                  </div>
                </div>

                <div className="text-sm text-gray-700">
                  <p className="font-medium">
                    {format(new Date(request.startDate), 'dd MMM yyyy', {
                      locale: idLocale,
                    })}{' '}
                    -{' '}
                    {format(new Date(request.endDate), 'dd MMM yyyy', {
                      locale: idLocale,
                    })}
                  </p>
                  <p className="text-gray-500">{request.daysTaken} hari</p>
                </div>

                {request.hrdComment && (
                  <CardDescription>
                    <span className="font-medium text-gray-800">
                      Komentar HRD:{' '}
                    </span>
                    {request.hrdComment}
                  </CardDescription>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 bg-gray-50 p-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewDetail(request)}
                  title="Lihat Detail"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Detail
                </Button>
                {request.status === 'PENDING' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isCancelling}
                      >
                        Batalkan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tindakan ini akan membatalkan pengajuan cuti Anda. Anda
                          tidak dapat mengurungkan tindakan ini.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isCancelling}
                          onClick={() => handleCancelRequest(request.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isCancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* --- KONTROL PAGINASI (SELALU TAMPIL) --- */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Halaman <strong>{currentPage}</strong> dari{' '}
              <strong>{totalPages}</strong>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((prev) => Math.max(prev - 1, 1));
                    }}
                    aria-disabled={currentPage === 1}
                    className={
                      currentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : undefined
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                    }}
                    aria-disabled={currentPage === totalPages}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* --- DIALOG DETAIL (UNTUK KARYAWAN) --- */}
        <Dialog
          open={isDetailOpen}
          onOpenChange={(open) => {
            setIsDetailOpen(open);
            if (!open) setSelectedRequest(null);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detail Riwayat Cuti</DialogTitle>
              <DialogDescription>
                Detail lengkap pengajuan cuti Anda.
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="grid gap-4 py-4 text-sm">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Status</Label>
                  <div className="col-span-2">
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Jenis Cuti</Label>
                  <span className="col-span-2">
                    {leaveTypeLabels[selectedRequest.leaveType]}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-8">
                  <Label className="text-gray-500">Tanggal</Label>
                  <span className="col-span-2">
                    {format(new Date(selectedRequest.startDate), 'dd MMM yyyy', {
                      locale: idLocale,
                    })}{' '}
                    -{' '}
                    {format(new Date(selectedRequest.endDate), 'dd MMM yyyy', {
                      locale: idLocale,
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Durasi</Label>
                  <span className="col-span-2">
                    {selectedRequest.daysTaken} hari
                  </span>
                </div>
                <hr className="col-span-3" />
                <div className="grid grid-cols-3 items-start gap-4">
                  <Label className="text-gray-500">Alasan Anda</Label>
                  <p className="col-span-2">{selectedRequest.reason}</p>
                </div>
                {selectedRequest.proofUrl && (
                  <div className="grid grid-cols-3 items-start gap-4">
                    <Label className="text-gray-500">Bukti</Label>
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="col-span-2 p-0 justify-start h-auto"
                    >
                      <a
                        href={selectedRequest.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600"
                      >
                        Lihat Lampiran
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}
                {selectedRequest.hrdComment && (
                  <div className="grid grid-cols-3 items-start gap-4">
                    <Label className="text-gray-500">Komentar HRD</Label>
                    <p className="col-span-2">{selectedRequest.hrdComment}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Tutup
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// --- PERBAIKAN: Komponen Skeleton (Desktop) ---
// Hanya mengembalikan TableRow, bukan Table utuh
function LoadingSkeleton() {
  return (
    <>
      {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-9 w-10 ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
// ---------------------------------------------

// Komponen Skeleton (Seluler)
function MobileLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 bg-gray-50 p-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}