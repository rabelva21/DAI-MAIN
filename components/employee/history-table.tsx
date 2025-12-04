'use client';

import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import useSWR from 'swr';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Eye, ExternalLink, Paperclip, Calendar, Clock, FileText, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
// PERBAIKAN: Import type agar tidak crash
import type { LeaveRequest } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '@/components/ui/separator';

// PERBAIKAN: Definisi Type Manual Lengkap
type LeaveRequestWithDetails = LeaveRequest & {
  hrdCommentBy: { fullName: string } | null;
  hrdComment?: string | null;
};

type ApiResponse = {
  data: LeaveRequestWithDetails[];
  totalCount: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Manual Map untuk mencegah crash client side
const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Cuti Tahunan',
  SICK: 'Cuti Sakit',
  MATERNITY: 'Cuti Melahirkan',
};

const ITEMS_PER_PAGE = 5;

export function HistoryTable() {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: apiResponse, error, mutate, isLoading } = useSWR<ApiResponse>(
    `/api/leave/history?page=${currentPage}&limit=${ITEMS_PER_PAGE}`,
    fetcher
  );

  const requests = apiResponse?.data;
  const totalCount = apiResponse?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-800 border-gray-300',
      APPROVED: 'bg-green-100 text-green-800 border-green-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200',
      CANCELLED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return <Badge variant="outline" className={`${styles[status]} px-3 py-1`}>{status}</Badge>;
  };

  const handleCancelRequest = async (requestId: string) => {
    setIsCancelling(true);
    try {
      const res = await fetch('/api/leave/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) throw new Error('Gagal membatalkan');
      toast({ title: 'Berhasil', description: 'Pengajuan cuti telah dibatalkan.' });
      mutate();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
        {/* DESKTOP */}
        <div className="hidden rounded-lg border border-gray-200 bg-white md:block shadow-sm">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-100">
                  <TableHead className="font-semibold text-black w-[180px]">Jenis Cuti</TableHead>
                  <TableHead className="font-semibold text-black">Tanggal</TableHead>
                  <TableHead className="font-semibold text-black">Durasi</TableHead>
                  <TableHead className="font-semibold text-black">Status</TableHead>
                  <TableHead className="font-semibold text-black w-[200px]">Komentar HRD</TableHead>
                  <TableHead className="text-right font-semibold text-black">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <LoadingSkeleton />}
                {error && <TableRow><TableCell colSpan={6} className="text-center text-red-500 py-8">Gagal memuat riwayat.</TableCell></TableRow>}
                {!isLoading && requests && requests.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">Anda belum pernah mengajukan cuti.</TableCell></TableRow>}
                {requests?.map((request) => (
                  <TableRow key={request.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="text-gray-700 font-medium">
                      <div className="flex items-center gap-2">
                        {LEAVE_TYPE_LABELS[request.leaveType]}
                        {request.proofUrl && (
                          <Tooltip delayDuration={100}><TooltipTrigger asChild><a href={request.proofUrl} target="_blank" className="p-1"><Paperclip className="h-4 w-4 text-blue-600" /></a></TooltipTrigger><TooltipContent><p>Lihat Bukti</p></TooltipContent></Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {format(new Date(request.startDate), 'dd MMM yyyy', { locale: idLocale })} - {format(new Date(request.endDate), 'dd MMM yyyy', { locale: idLocale })}
                    </TableCell>
                    <TableCell className="text-gray-700"><Badge variant="secondary">{request.daysTaken} hari</Badge></TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="max-w-[200px] text-gray-600 text-sm truncate" title={request.hrdComment || ''}>{request.hrdComment || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleViewDetail(request)}><Eye className="h-4 w-4 text-gray-500" /></Button>
                        {request.status === 'PENDING' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={isCancelling} className="h-8 text-xs">Batalkan</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Batalkan Pengajuan?</AlertDialogTitle><AlertDialogDescription>Kuota cuti akan dikembalikan.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Kembali</AlertDialogCancel><AlertDialogAction disabled={isCancelling} onClick={() => handleCancelRequest(request.id)} className="bg-red-600 hover:bg-red-700">Ya, Batalkan</AlertDialogAction></AlertDialogFooter>
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

        {/* MOBILE */}
        <div className="space-y-4 md:hidden">
          {requests?.map((request) => (
            <Card key={request.id} className="shadow-sm border-l-4 border-l-primary">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-black flex items-center gap-2">{LEAVE_TYPE_LABELS[request.leaveType]}</p>
                    <p className="text-xs text-gray-500 mt-1">{format(new Date(request.startDate), 'dd MMM', { locale: idLocale })} - {format(new Date(request.endDate), 'dd MMM', { locale: idLocale })}</p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center bg-gray-50 p-3 rounded-b-lg">
                 <Button size="sm" variant="outline" onClick={() => handleViewDetail(request)} className="text-xs h-8"><Eye className="mr-2 h-3 w-3" /> Detail</Button>
                 {request.status === 'PENDING' && <Button size="sm" variant="destructive" className="text-xs h-8" onClick={() => handleCancelRequest(request.id)}>Batalkan</Button>}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="text-xs text-gray-500">Hal. {currentPage} dari {totalPages}</div>
            <Pagination>
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage((prev) => Math.max(prev - 1, 1)); }}/></PaginationItem>
                <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage((prev) => Math.min(prev + 1, totalPages)); }}/></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* DIALOG DETAIL - FIX DISINI */}
        <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setSelectedRequest(null); }}>
          <DialogContent className="sm:max-w-md md:max-w-lg rounded-xl">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Detail Pengajuan Cuti</DialogTitle>
              <DialogDescription>Informasi lengkap pengajuan.</DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border"><span className="text-sm font-medium text-gray-500">Status</span>{getStatusBadge(selectedRequest.status)}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-xs text-gray-500 uppercase">Jenis Cuti</Label><p className="font-medium text-gray-900">{LEAVE_TYPE_LABELS[selectedRequest.leaveType]}</p></div>
                  <div className="space-y-1"><Label className="text-xs text-gray-500 uppercase">Durasi</Label><p className="font-medium text-gray-900">{selectedRequest.daysTaken} Hari</p></div>
                </div>
                <Separator />
                <div className="space-y-2"><Label className="text-sm font-semibold text-gray-700">Alasan</Label><div className="p-3 bg-gray-50 rounded-md text-sm text-gray-700 border">{selectedRequest.reason}</div></div>
                {(selectedRequest.hrdComment || selectedRequest.hrdCommentBy) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1"><UserCheck className="h-4 w-4 text-blue-600" /><span className="text-sm font-semibold text-blue-800">HRD</span></div>
                    <p className="text-sm text-gray-800 italic">"{selectedRequest.hrdComment || 'Tidak ada catatan.'}"</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter><DialogClose asChild><Button type="button" variant="default">Tutup</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function LoadingSkeleton() {
  return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

function MobileLoadingSkeleton() {
  return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>;
}