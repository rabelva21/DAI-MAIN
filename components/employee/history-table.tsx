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
  CardFooter,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Eye, ExternalLink, Paperclip, Calendar, Clock, FileText, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Separator } from '@/components/ui/separator';

// PERBAIKAN: Definisikan type secara manual agar hrdComment dikenali
type LeaveRequestWithDetails = LeaveRequest & {
  hrdCommentBy: { fullName: string } | null;
  hrdComment?: string | null; // <--- PERBAIKAN DI SINI
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
    `/api/leave/history?page=${currentPage}&limit=${ITEMS_PER_PAGE}`,
    fetcher
  );

  const requests = apiResponse?.data;
  const totalCount = apiResponse?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusBadge = (status: LeaveStatus) => {
    const styles = {
      PENDING: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200',
      APPROVED: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
      CANCELLED: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200',
    };
    return (
      <Badge variant="outline" className={`${styles[status]} px-3 py-1`}>
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
        <div className="hidden rounded-lg border border-gray-200 bg-white md:block shadow-sm">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-100">
                  <TableHead className="font-semibold text-black w-[180px]">
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
                  <TableHead className="font-semibold text-black w-[200px]">
                    Komentar HRD
                  </TableHead>
                  <TableHead className="text-right font-semibold text-black">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <LoadingSkeleton />}
                {error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-red-500 py-8">
                      Gagal memuat riwayat pengajuan.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && requests && requests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-gray-500 py-8"
                    >
                      Anda belum pernah mengajukan cuti.
                    </TableCell>
                  </TableRow>
                )}
                {requests?.map((request) => (
                  <TableRow key={request.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="text-gray-700 font-medium">
                      <div className="flex items-center gap-2">
                        {leaveTypeLabels[request.leaveType]}
                        {request.proofUrl && (
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <a 
                                href={request.proofUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-full p-1 hover:bg-gray-200 transition-colors"
                                onClick={(e) => e.stopPropagation()} 
                              >
                                <Paperclip className="h-4 w-4 text-blue-600" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Lihat Bukti Lampiran</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      <div className="flex flex-col">
                        <span>{format(new Date(request.startDate), 'dd MMM yyyy', { locale: idLocale })}</span>
                        <span className="text-xs text-gray-400">s/d</span>
                        <span>{format(new Date(request.endDate), 'dd MMM yyyy', { locale: idLocale })}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      <Badge variant="secondary">{request.daysTaken} hari</Badge>
                    </TableCell>
                    <TableCell>
                        {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell className="max-w-[200px] text-gray-600 text-sm truncate" title={request.hrdComment || ''}>
                      {request.hrdComment || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetail(request)}
                          title="Lihat Detail"
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4 text-gray-500" />
                        </Button>
                        {request.status === 'PENDING' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isCancelling}
                                className="h-8 text-xs"
                              >
                                Batalkan
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini akan membatalkan pengajuan cuti Anda. 
                                  Kuota cuti Anda akan dikembalikan jika sebelumnya terpotong.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Kembali</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={isCancelling}
                                  onClick={() => handleCancelRequest(request.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {isCancelling ? 'Memproses...' : 'Ya, Batalkan'}
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
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Gagal memuat riwayat pengajuan.
              </AlertDescription>
            </Alert>
          )}
          {!isLoading && requests && requests.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              Anda belum pernah mengajukan cuti.
            </p>
          )}
          {requests?.map((request) => (
            <Card key={request.id} className="shadow-sm border-l-4 border-l-primary">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-black flex items-center gap-2">
                      {leaveTypeLabels[request.leaveType]}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(request.startDate), 'dd MMM yyyy', { locale: idLocale })} - {format(new Date(request.endDate), 'dd MMM yyyy', { locale: idLocale })}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                   <div>
                      <p className="text-xs text-gray-500">Durasi</p>
                      <p className="font-medium">{request.daysTaken} Hari</p>
                   </div>
                   {request.proofUrl && (
                     <div className="flex items-end justify-end">
                       <a 
                          href={request.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Paperclip className="h-3 w-3" /> Lihat Bukti
                       </a>
                     </div>
                   )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center bg-gray-50 p-3 rounded-b-lg">
                 <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewDetail(request)}
                  className="text-xs h-8"
                >
                  <Eye className="mr-2 h-3 w-3" />
                  Detail
                </Button>

                {request.status === 'PENDING' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs h-8"
                        disabled={isCancelling}
                      >
                        Batalkan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                       {/* Mobile Alert Dialog Content same as desktop */}
                       <AlertDialogHeader>
                        <AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Yakin ingin membatalkan pengajuan ini?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Tidak</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleCancelRequest(request.id)}>Ya, Batalkan</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* --- KONTROL PAGINASI --- */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="text-xs text-gray-500">
              Hal. {currentPage} dari {totalPages}
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

        {/* --- DIALOG DETAIL --- */}
        <Dialog
          open={isDetailOpen}
          onOpenChange={(open) => {
            setIsDetailOpen(open);
            if (!open) setSelectedRequest(null);
          }}
        >
          <DialogContent className="sm:max-w-md md:max-w-lg rounded-xl">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Detail Pengajuan Cuti
              </DialogTitle>
              <DialogDescription>
                Informasi lengkap mengenai status dan detail pengajuan Anda.
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-6 py-4">
                
                {/* Status Section */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                  <span className="text-sm font-medium text-gray-500">Status Saat Ini</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>

                {/* Main Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Jenis Cuti</Label>
                    <p className="font-medium text-gray-900">{leaveTypeLabels[selectedRequest.leaveType]}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Durasi
                    </Label>
                    <p className="font-medium text-gray-900">{selectedRequest.daysTaken} Hari</p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Tanggal
                    </Label>
                    <p className="font-medium text-gray-900">
                      {format(new Date(selectedRequest.startDate), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
                      <span className="mx-2 text-gray-400">→</span>
                      {format(new Date(selectedRequest.endDate), 'EEEE, dd MMMM yyyy', { locale: idLocale })}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Reason Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">Alasan Pengajuan</Label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-700 leading-relaxed border">
                    {selectedRequest.reason}
                  </div>
                </div>

                {/* Proof Section */}
                {selectedRequest.proofUrl && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Bukti Lampiran</Label>
                    <div>
                        <Button asChild variant="outline" className="w-full justify-start gap-2 border-dashed border-gray-400">
                            <a href={selectedRequest.proofUrl} target="_blank" rel="noopener noreferrer">
                                <Paperclip className="h-4 w-4" />
                                Lihat Dokumen Bukti (Klik untuk membuka)
                                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                            </a>
                        </Button>
                    </div>
                  </div>
                )}

                {/* HRD Comment Section (Hanya jika ada) */}
                {(selectedRequest.hrdComment || selectedRequest.hrdCommentBy) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-800">Tanggapan HRD</span>
                    </div>
                    <p className="text-sm text-gray-800 italic">
                      "{selectedRequest.hrdComment || 'Tidak ada catatan tambahan.'}"
                    </p>
                    {selectedRequest.hrdCommentBy && (
                        <p className="text-xs text-blue-600 text-right mt-2">
                            — {selectedRequest.hrdCommentBy.fullName}
                        </p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="default" className="w-full sm:w-auto">
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

function LoadingSkeleton() {
  return (
    <>
      {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function MobileLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}