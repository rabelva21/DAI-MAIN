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
    Trash2,
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

// Definisikan tipe data manual
type LeaveRequestWithDetails = LeaveRequest & {
    employee: { fullName: string; email: string; remainingLeave: number };
    department: { name: string } | null;
    hrdCommentBy: { fullName: string } | null;
};

type ApiResponse = {
    data: LeaveRequestWithDetails[];
    totalCount: number;
    page: number;
    limit: number;
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

// Fungsi yang menguji apakah tanggal valid
const isValidDate = (date: Date | string) => {
    const d = new Date(date);
    return !isNaN(d.getTime());
};

// Fungsi Pembantu untuk format Tanggal yang AMAN
const formatDate = (date: Date | string) => {
    if (!isValidDate(date)) return 'Tanggal tidak valid';
    return format(new Date(date), 'dd MMM yyyy', { locale: idLocale });
};

// --- Fungsi Skeleton untuk Loading Table ---
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


export function LeaveTable() {
    const { toast } = useToast();
    const { mutate: globalMutate } = useSWRConfig();

    const [selectedRequest, setSelectedRequest] =
        useState<LeaveRequestWithDetails | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false); 
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

    const {
        data: apiResponse,
        error,
        mutate,
        isLoading,
    } = useSWR<ApiResponse>(
        `/api/admin/leaves?status=${statusFilter}&search=${searchQuery}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`,
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
    
    // --- FUNGSI DELETE (Hard Delete Logic) ---
    const handleDelete = async (id: string, employeeName: string) => {
        const confirmed = window.confirm(
            `PERINGATAN: Apakah Anda yakin ingin menghapus data pengajuan cuti milik ${employeeName} secara PERMANEN? Data yang dihapus tidak dapat dikembalikan.`
        );

        if (!confirmed) return;

        setIsDeleteLoading(true);

        try {
            const res = await fetch(`/api/admin/leaves/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Gagal menghapus data');
            }

            mutate(); 
            globalMutate('/api/admin/stats'); 

            toast({
                title: 'Berhasil Dihapus',
                description: 'Data pengajuan cuti telah dihapus secara permanen.',
                variant: 'default',
            });

        } catch (error: any) {
            toast({
                title: 'Gagal Menghapus',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsDeleteLoading(false);
        }
    };
    // -----------------------------------------


    const handleSubmitReview = async () => {
        if (!selectedRequest || !reviewAction) return;
        setIsReviewLoading(true);

        try {
            const res = await fetch(`/api/admin/leaves/${selectedRequest.id}`, { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newStatus: reviewAction,
                    hrdComment: reviewNotes,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Gagal mereview');
            }

            mutate();
            globalMutate('/api/admin/department-stats');
            globalMutate('/api/admin/stats');

            setIsReviewOpen(false);
            setReviewNotes('');
            toast({
                title: reviewAction === 'APPROVED' ? 'Pengajuan Disetujui' : 'Pengajuan Ditolak',
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
        const styles: Record<LeaveStatus, string> = {
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
                
                {/* ... (Search & Filter components remain the same) ... */}

                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-100">
                          <TableHead className="font-semibold text-black">Karyawan</TableHead>
                          <TableHead className="font-semibold text-black">Jenis Cuti</TableHead>
                          <TableHead className="font-semibold text-black">Tanggal</TableHead>
                          <TableHead className="font-semibold text-black">Durasi</TableHead>
                          <TableHead className="font-semibold text-black">Status</TableHead>
                          <TableHead className="text-right font-semibold text-black">Aksi</TableHead>
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
                            <TableCell colSpan={6} className="text-center text-gray-500">
                              Tidak ada data yang cocok dengan filter.
                            </TableCell>
                          </TableRow>
                        )}
                        {requests?.map((request) => (
                          <TableRow key={request.id} className="hover:bg-gray-50">
                            {/* --- Kolom Data --- */}
                            
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
                              {/* Menggunakan formatDate yang lebih aman */}
                              {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            </TableCell>
                            <TableCell className="text-gray-700">
                              {request.daysTaken} hari
                            </TableCell>
                            <TableCell>{getStatusBadge(request.status)}</TableCell>
                            
                            {/* --- KOLOM AKSI --- */}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {/* Tombol Detail */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewDetail(request)}
                                  className="border-gray-300"
                                  title="Lihat Detail"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                {/* Tombol Approve & Reject (Hanya status PENDING) */}
                                {request.status === 'PENDING' && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => handleReview(request, 'APPROVED')}
                                      className="bg-green-600 hover:bg-green-700"
                                      title="Setujui"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleReview(request, 'REJECTED')}
                                      className="bg-red-600 hover:bg-red-700"
                                      title="Tolak"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}

                                {/* Tombol Hapus */}
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(request.id, request.employee.fullName)}
                                    disabled={false}
                                    className="bg-red-100 hover:bg-red-200 text-red-600 border border-red-200"
                                    title="Hapus Permanen"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>

                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>


                {/* --- DIALOG DETAIL PENGAJUAN CUTI (KODE PERBAIKAN UTAMA) --- */}
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
                                {selectedRequest?.employee.fullName || 'Karyawan Tidak Dikenal'}.
                            </DialogDescription>
                        </DialogHeader>
                        {selectedRequest ? (
                            <div className="grid gap-4 py-4 text-sm">
                                {/* 1. STATUS & JENIS CUTI */}
                                <div className="grid grid-cols-3 items-center gap-4 border-b pb-4">
                                    <Label className="text-gray-500">Status</Label>
                                    <span className="col-span-2 font-medium text-black">
                                        {getStatusBadge(selectedRequest.status)}
                                    </span>
                                </div>

                                {/* 2. NAMA KARYAWAN */}
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label className="text-gray-500">Karyawan</Label>
                                    <span className="col-span-2 font-medium text-black">
                                        {selectedRequest.employee.fullName} ({selectedRequest.department?.name})
                                    </span>
                                </div>

                                {/* 3. JENIS CUTI & DURASI */}
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label className="text-gray-500">Jenis / Durasi</Label>
                                    <span className="col-span-2 text-black">
                                        {leaveTypeLabels[selectedRequest.leaveType]} ({selectedRequest.daysTaken} hari)
                                    </span>
                                </div>

                                {/* 4. TANGGAL */}
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label className="text-gray-500">Periode</Label>
                                    <span className="col-span-2 text-black text-xs">
                                        {formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}
                                    </span>
                                </div>

                                {/* 5. ALASAN */}
                                <div className="grid grid-cols-3 items-start gap-4">
                                    <Label className="text-gray-500">Alasan</Label>
                                    <span className="col-span-2 text-black whitespace-pre-wrap">
                                        {selectedRequest.reason}
                                    </span>
                                </div>

                                {/* 6. LAMPIRAN BUKTI (PROOF URL) --- SOLUSI HILANG DATA --- */}
                                {selectedRequest.proofUrl && (
                                    <div className="grid grid-cols-3 items-center gap-4 border-t pt-4">
                                        <Label className="text-gray-500 flex items-center gap-1">
                                            <Paperclip className="h-4 w-4" /> Bukti Lampiran
                                        </Label>
                                        <a
                                            href={selectedRequest.proofUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="col-span-2 text-blue-600 hover:text-blue-800 flex items-center gap-1 truncate"
                                        >
                                            Lihat Dokumen
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                        </a>
                                    </div>
                                )}

                                {/* 7. KOMENTAR ADMIN */}
                                {(selectedRequest.hrdComment || selectedRequest.hrdCommentBy) && (
                                    <div className="grid grid-cols-3 items-start gap-4 border-t pt-4">
                                        <Label className="text-gray-500">Komentar HRD</Label>
                                        <div className="col-span-2 text-black">
                                            <p className="text-sm font-medium">
                                                {selectedRequest.hrdCommentBy?.fullName || 'Admin'}
                                            </p>
                                            <p className="text-xs text-gray-600 whitespace-pre-wrap mt-1">
                                                {selectedRequest.hrdComment || 'Tidak ada catatan.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <TableLoadingSkeleton />
                        )}
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Tutup</Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* --- DIALOG REVIEW (Logic Persetujuan/Penolakan) --- */}
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
                            <Button onClick={handleSubmitReview} disabled={isReviewLoading}>
                                {isReviewLoading ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </TooltipProvider>
    );
}