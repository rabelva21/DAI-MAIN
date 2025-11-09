import { LoginForm } from '@/components/auth/login-form';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react'; // <-- 1. Impor Suspense

// Buat komponen skeleton sederhana untuk fallback
function LoginFormSkeleton() {
  return (
    <div className="border-gray-200 rounded-lg border shadow-sm p-6 space-y-4">
      <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
      <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
      <div className="h-10 w-full bg-red-200 rounded animate-pulse"></div>
    </div>
  );
}

export default function KaryawanLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">

        <div className="mb-6 flex items-center justify-center gap-2">
          <Image
            src="https://res.cloudinary.com/imagehandlers/image/upload/v1762437016/logo-daiprint_cfm1cn.webp"
            alt="PT. DAI Logo"
            width={80}
            height={80}
            className="shrink-0"
            priority
          />
          <div>
            <h1 className="text-2xl font-bold text-black">Login Karyawan</h1>
            <p className="text-sm text-gray-600">PT. Dharma Anugerah Indah</p>
          </div>
        </div>

        {/* --- 2. Bungkus LoginForm dengan Suspense --- */}
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm role="EMPLOYEE" />
        </Suspense>
        {/* ------------------------------------------- */}

        <p className="mt-6 text-center text-sm text-gray-600">
          Belum punya akun?{' '}
          <Link
            href="/register"
            className="font-medium text-red-600 hover:underline"
          >
            Daftar di sini
          </Link>
        </p>
      </div>
    </div>
  );
}