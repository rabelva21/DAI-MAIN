'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Check,
  X,
  Eye,
  Filter,
  Search,
  ExternalLink,
  Paperclip,
} from 'lucide-react';
import useSWR, { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LeaveRequest, LeaveStatus, LeaveType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

// Tipe data (tetap sama)
type LeaveRequestWithDetails = LeaveRequest & {
  employee: { fullName: string; email: string; remainingLeave: number };
  department: { name: string } | null;
  hrdCommentBy: { fullName: string } | null;
};
type ApiResponse = {
  data: LeaveRequestWithDetails[];
  totalCount: number;
};
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
const fetcher = (url: string) => fetch(url).then((res) => res.json());
const ITEMS_PER_PAGE = 10;
// --- Akhir Tipe Data ---

export function LeaveTable() {
  const { toast } = useToast();
  
  // --- PERBAIKAN 2: Inisialisasi hook SWRConfig ---
  const { mutate: globalMutate } = useSWRConfig();
  // ----------------------------------------------
  
  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequestWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | null>(
    null
  );
  const [reviewNotes, setReviewNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  // 'mutate' ini adalah mutate lokal untuk tabel ini
  const {
    data: apiResponse,
    error,
    mutate,
    isLoading,
  } = useSWR<ApiResponse>(
    `/api/leave/admin-list?status=${statusFilter}&search=${searchQuery}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`,
    fetcher
  );

  const requests = apiResponse?.data;
  const totalCount = apiResponse?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handleViewDetail = (request: LeaveRequestWithDetails) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const handleReview = (
    request: LeaveRequestWithDetails,
    action: 'APPROVED' | 'REJECTED'
  ) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes(request.hrdComment || '');
    setIsReviewOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedRequest || !reviewAction) return;
    setIsReviewLoading(true);

    try {
      const res = await fetch('/api/leave/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          newStatus: reviewAction,
          hrdComment: reviewNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mereview');
      }

      // --- PERBAIKAN 3: Panggil globalMutate untuk refresh komponen lain ---

      // Mutate lokal (untuk tabel ini)
      mutate();
      
      // Mutate global (untuk Statistik Kuota Departemen)
      globalMutate('/api/admin/department-stats');
      
      // Mutate global (untuk Statistik Kartu Atas)
      globalMutate('/api/admin/stats');

      // -----------------------------------------------------------------

      setIsReviewOpen(false);
      setReviewNotes('');
      toast({
        title:
          reviewAction === 'APPROVED' ? 'Pengajuan Disetujui' : 'Pengajuan Ditolak',
        description: `Pengajuan cuti dari ${selectedRequest.employee.fullName} telah diperbarui.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsReviewLoading(false);
    }
  };

  const getStatusBadge = (status: LeaveStatus) => {
    const styles = {
      PENDING: 'bg-gray-100 text-gray-800 border-gray-300',
      APPROVED: 'bg-green-50 text-green-700 border-green-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      CANCELLED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    };

    return (
      <Badge variant="outline" className={`shrink-0 ${styles[status]}`}>
        {statusLabels[status]}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-black">
          Daftar Pengajuan Cuti
        </h2>
        {/* Filter dan Search Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Cari nama atau departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-600" />
            <Select
              value={statusFilter}
              onValueChange={(value: any) => setStatusFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="PENDING">Menunggu</SelectItem>
                <SelectItem value="APPROVED">Disetujui</SelectItem>
                <SelectItem value="REJECTED">Ditolak</SelectItem>
                <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-100">
                  <TableHead className="font-semibold text-black">
                    Karyawan
                  </TableHead>
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
                  <TableHead className="text-right font-semibold text-black">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-red-500">
                      Gagal memuat data.
                    </TableCell>
                  </TableRow>
                )}
                {isLoading && <TableLoadingSkeleton />}
                {!isLoading && requests && requests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-gray-500"
                    >
                      Tidak ada data yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                )}
                {requests?.map((request) => (
                  <TableRow key={request.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-black">
                      {request.employee.fullName}
                      <p className="text-xs text-gray-600">
                        {request.department?.name || 'N/A'}
                      </p>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      <div className="flex items-center gap-2">
                        {leaveTypeLabels[request.leaveType]}
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
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700 text-xs">
                      {format(new Date(request.startDate), 'dd/MM/yy', {
                        locale: idLocale,
                      })}{' '}
                      -{' '}
                      {format(new Date(request.endDate), 'dd/MM/yy', {
                        locale: idLocale,
                      })}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {request.daysTaken} hari
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(request)}
                          className="border-gray-300"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {request.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleReview(request, 'APPROVED')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReview(request, 'REJECTED')}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Kontrol Paginasi */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Menampilkan{' '}
            <strong>
              {totalCount === 0
                ? 0
                : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            </strong>{' '}
            -{' '}
            <strong>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</strong>{' '}
            dari <strong>{totalCount}</strong> data
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
              <PaginationItem className="hidden sm:block">
                <span className="px-2 text-sm text-gray-600">
                  Halaman {currentPage} dari {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                  }}
                  aria-disabled={currentPage === totalPages || totalPages === 0}
                  className={
                    currentPage === totalPages || totalPages === 0
                      ? 'pointer-events-none opacity-50'
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

        {/* --- Dialog (Semua kode dialog di bawah ini tetap sama) --- */}
        
        {/* === DIALOG DETAIL (Tombol Mata) === */}
        <Dialog
          open={isDetailOpen}
          onOpenChange={(open) => {
            setIsDetailOpen(open);
            if (!open) setSelectedRequest(null);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detail Pengajuan Cuti</DialogTitle>
              <DialogDescription>
                Detail lengkap pengajuan dari{' '}
                {selectedRequest?.employee.fullName}.
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="grid gap-4 py-4 text-sm">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Nama</Label>
                  <span className="col-span-2 font-medium text-black">
                    {selectedRequest.employee.fullName}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Departemen</Label>
                  <span className="col-span-2">
                    {selectedRequest.department?.name || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Sisa Cuti</Label>
                  <span className="col-span-2 font-bold">
                    {selectedRequest.employee.remainingLeave} hari
                  </span>
                </div>
                <hr />
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Jenis Cuti</Label>
                  <span className="col-span-2">
                    {leaveTypeLabels[selectedRequest.leaveType]}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Tanggal</Label>
                  <span className="col-span-2">
                    {format(
                      new Date(selectedRequest.startDate),
                      'dd MMM yyyy',
                      {
                        locale: idLocale,
                      }
                    )}{' '}
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
                <div className="grid grid-cols-3 items-start gap-4">
                  <Label className="text-gray-500">Alasan</Label>
                  <p className="col-span-2">{selectedRequest.reason}</p>
                </div>

                {selectedRequest.proofUrl && (
                  <div className="grid grid-cols-3 items-start gap-4">
                    <Label className="text-gray-500">Bukti</Label>
                    <div className="col-span-2 space-y-2">
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="p-0 justify-start h-auto"
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
                      {selectedRequest.proofUrl.includes('.pdf') ? (
                        <p className="text-xs text-gray-500">
                          (Lampiran adalah PDF, lihat di tab baru)
                        </p>
                      ) : (
                        <img
                          src={selectedRequest.proofUrl}
                          alt="Bukti Lampiran"
                          className="rounded-md border max-h-60 w-auto"
                        />
                      )}
                    </div>
                  </div>
                )}

                <hr />
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-gray-500">Status</Label>
                  <div className="col-span-2">
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>
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

        {/* === DIALOG REVIEW (Tombol Centang/Silang) === */}
        <Dialog
          open={isReviewOpen}
          onOpenChange={(open) => {
            setIsReviewOpen(open);
            if (!open) setSelectedRequest(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {reviewAction === 'APPROVED' ? 'Setujui' : 'Tolak'} Pengajuan
              </DialogTitle>
              <DialogDescription>
                Anda akan{' '}
                {reviewAction === 'APPROVED' ? 'menyetujui' : 'menolak'} pengajuan
                dari {selectedRequest?.employee.fullName}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="reviewNotes">Catatan / Komentar (Opsional)</Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Berikan alasan atau catatan..."
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isReviewLoading}
                >
                  Batal
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSubmitReview}
                disabled={isReviewLoading}
                className={
                  reviewAction === 'REJECTED'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }
              >
                {isReviewLoading
                  ? 'Menyimpan...'
                  : reviewAction === 'APPROVED'
                  ? 'Setujui Pengajuan'
                  : 'Tolak Pengajuan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// Komponen LoadingSkeleton
function TableLoadingSkeleton() {
  return (
    <>
      {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-3 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-20 rounded-full" />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
