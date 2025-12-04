'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Check,
    X,
    Eye,
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { LeaveRequest } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { LEAVE_TYPE_LABELS, STATUS_LABELS, STATUS_BADGE_COLORS, LeaveType, LeaveStatus } from '@/lib/utils';

// FIX: Menambahkan hrdComment secara eksplisit
type LeaveRequestWithDetails = LeaveRequest & {
    employee: { fullName: string; email: string; remainingLeave: number };
    department: { name: string } | null;
    hrdCommentBy: { fullName: string } | null;
    hrdComment?: string | null;
};

type ApiResponse = {
    data: LeaveRequestWithDetails[];
    totalCount: number;
    page: number;
    limit: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const ITEMS_PER_PAGE = 10;

const isValidDate = (date: Date | string) => {
    const d = new Date(date);
    return !isNaN(d.getTime());
};

const formatDate = (date: Date | string) => {
    if (!isValidDate(date)) return 'Tanggal tidak valid';
    return format(new Date(date), 'dd MMM yyyy', { locale: idLocale });
};

function TableLoadingSkeleton() {
    return (
        <>
          {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-4 w-10" /></TableCell>
              <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </>
      );
}

export function LeaveTable() {
    const { toast } = useToast();
    const { mutate: globalMutate } = useSWRConfig();

    const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithDetails | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');
    const [currentPage, setCurrentPage] = useState(1);

    // Reset page jika filter berubah
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
    
    const handleDelete = async (id: string, employeeName: string) => {
        const confirmed = window.confirm(
            `Hapus permanen data ${employeeName}?`
        );
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/leaves/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Gagal menghapus');
            mutate(); 
            globalMutate('/api/admin/stats'); 
            toast({ title: 'Berhasil Dihapus' });
        } catch (error: any) {
            toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        }
    };

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

            if (!res.ok) throw new Error('Gagal mereview');

            mutate();
            globalMutate('/api/admin/department-stats');
            globalMutate('/api/admin/stats');

            setIsReviewOpen(false);
            setReviewNotes('');
            toast({
                title: 'Berhasil',
                description: `Pengajuan telah ${reviewAction === 'APPROVED' ? 'disetujui' : 'ditolak'}.`,
            });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsReviewLoading(false);
        }
    };

    const getStatusBadge = (status: LeaveStatus) => {
        return (
            <Badge variant="outline" className={`shrink-0 ${STATUS_BADGE_COLORS[status]}`}>
                {STATUS_LABELS[status]}
            </Badge>
        );
    };

    return (
        <TooltipProvider>
            <div className="space-y-6">
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
                            <TableCell colSpan={6} className="text-center text-red-500">Gagal memuat data.</TableCell>
                          </TableRow>
                        )}
                        {isLoading && <TableLoadingSkeleton />}
                        {!isLoading && requests && requests.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-500">Tidak ada data.</TableCell>
                          </TableRow>
                        )}
                        {requests?.map((request) => (
                          <TableRow key={request.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-black">
                              {request.employee.fullName}
                              <p className="text-xs text-gray-600">{request.department?.name || 'N/A'}</p>
                            </TableCell>
                            <TableCell className="text-gray-700">
                              <div className="flex items-center gap-2">
                                {LEAVE_TYPE_LABELS[request.leaveType as LeaveType]}
                                {request.proofUrl && (
                                  <Tooltip>
                                    <TooltipTrigger><Paperclip className="h-3 w-3 text-blue-500" /></TooltipTrigger>
                                    <TooltipContent><p>Ada lampiran</p></TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-700 text-xs">
                              {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            </TableCell>
                            <TableCell className="text-gray-700">{request.daysTaken} hari</TableCell>
                            <TableCell>{getStatusBadge(request.status as LeaveStatus)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleViewDetail(request)}><Eye className="h-4 w-4" /></Button>
                                {request.status === 'PENDING' && (
                                  <>
                                    <Button size="sm" onClick={() => handleReview(request, 'APPROVED')} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4" /></Button>
                                    <Button size="sm" onClick={() => handleReview(request, 'REJECTED')} className="bg-red-600 hover:bg-red-700"><X className="h-4 w-4" /></Button>
                                  </>
                                )}
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(request.id, request.employee.fullName)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if(!open) setSelectedRequest(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Detail Pengajuan</DialogTitle>
                            <DialogDescription>{selectedRequest?.employee.fullName}</DialogDescription>
                        </DialogHeader>
                        {selectedRequest && (
                            <div className="grid gap-4 py-4 text-sm">
                                <div className="grid grid-cols-3 gap-4">
                                    <Label>Alasan</Label>
                                    <span className="col-span-2">{selectedRequest.reason}</span>
                                </div>
                                {selectedRequest.proofUrl && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <Label>Bukti</Label>
                                        <a href={selectedRequest.proofUrl} target="_blank" className="col-span-2 text-blue-600 flex items-center gap-1">Lihat <ExternalLink className="h-3 w-3"/></a>
                                    </div>
                                )}
                                {(selectedRequest.hrdComment || selectedRequest.hrdCommentBy) && (
                                    <div className="grid grid-cols-3 gap-4 border-t pt-2">
                                        <Label>HRD ({selectedRequest.hrdCommentBy?.fullName})</Label>
                                        <span className="col-span-2">{selectedRequest.hrdComment}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <DialogFooter><DialogClose asChild><Button variant="secondary">Tutup</Button></DialogClose></DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isReviewOpen} onOpenChange={(open) => { setIsReviewOpen(open); if(!open) setSelectedRequest(null); }}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Review Pengajuan</DialogTitle></DialogHeader>
                        <div className="py-4"><Label>Catatan</Label><Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} /></div>
                        <DialogFooter><Button onClick={handleSubmitReview} disabled={isReviewLoading}>Simpan</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}