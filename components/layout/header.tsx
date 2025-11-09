'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Calendar,
  LayoutDashboard,
  LogOut,
  History,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '../ui/button';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTrigger,
} from '@/components/ui/sheet';
import Image from 'next/image';

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;

  // Jangan tampilkan header di halaman login atau register
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    status === 'loading'
  ) {
    return (
      // Placeholder untuk menghindari layout shift saat loading
      <header className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between"></div>
        </div>
      </header>
    );
  }

  const employeeLinks = (
    <>
      <Link
        href="/"
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          pathname === '/'
            ? 'bg-red-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <Calendar className="h-4 w-4" />
        Pengajuan Cuti
      </Link>
      <Link
        href="/my-history"
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          pathname === '/my-history'
            ? 'bg-red-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <History className="h-4 w-4" />
        Riwayat Saya
      </Link>
    </>
  );

  const hrdLinks = (
    <Link
      href="/admin"
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        pathname === '/admin'
          ? 'bg-red-600 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      <LayoutDashboard className="h-4 w-4" />
      Dashboard Admin
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      {' '}
      {/* Buat header sticky */}
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* --- PERBAIKAN: Bungkus logo dan teks dengan Link --- */}
          <div className="flex items-center gap-4">
            <Image
              src="/logo.webp"
              alt="PT. DAI Logo"
              width={40}
              height={40}
              className="shrink-0" // Mencegah logo mengecil
            />
            <div>
              <h1 className="text-left text-xl font-bold text-black">
                PT. Dharma Anugerah Indah
              </h1>
              <p className="hidden text-xs text-gray-600 sm:block">
                Form Pengajuan Cuti
              </p>
            </div>
          </div>
          {/* --- AKHIR PERBAIKAN --- */}

          {status === 'authenticated' && (
            <div className="flex items-center gap-2">
              {/* Navigasi Desktop */}
              <nav className="hidden gap-1 md:flex">
                {userRole === 'EMPLOYEE' && employeeLinks}
                {userRole === 'HRD' && hrdLinks}
              </nav>

              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="ml-4 hidden border-gray-300 md:flex"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>

              {/* Navigasi Mobile (Hamburger Menu) */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right">
                    <nav className="flex flex-col gap-4 py-6">
                      {userRole === 'EMPLOYEE' && (
                        <>
                          <SheetClose asChild>{employeeLinks}</SheetClose>
                        </>
                      )}
                      {userRole === 'HRD' && (
                        <SheetClose asChild>{hrdLinks}</SheetClose>
                      )}
                      <hr />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="border-gray-300"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}