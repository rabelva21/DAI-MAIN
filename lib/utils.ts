import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LeaveStatus, LeaveType } from '@prisma/client'; // Ini akan berfungsi setelah 'prisma generate'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Menambahkan helper untuk labels (pengganti dummy-data)
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: 'Cuti Tahunan',
  SICK: 'Cuti Sakit',
  MATERNITY: 'Cuti Melahirkan',
};

export const STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export const STATUS_BADGE_COLORS: Record<LeaveStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-800 border-gray-300',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};