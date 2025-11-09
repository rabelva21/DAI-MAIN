import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  const isApiRoute = nextUrl.pathname.startsWith('/api');

  // Definisikan semua rute publik di sini
  const isPublicRoute =
    nextUrl.pathname.startsWith('/login') || // Meliputi /login, /login/admin, /login/karyawan
    nextUrl.pathname.startsWith('/register');

  // Izinkan semua request API (akan dilindungi di dalam route handler-nya)
  if (isApiRoute) {
    return;
  }

  // Logika untuk Rute Publik (Login & Register)
  if (isPublicRoute) {
    if (isLoggedIn) {
      // Jika sudah login, paksa redirect ke dashboard masing-masing
      const redirectUrl = userRole === 'HRD' ? '/admin' : '/';
      return Response.redirect(new URL(redirectUrl, nextUrl));
    }
    // Jika belum login, izinkan akses ke halaman login/register
    return;
  }

  // --- Perlindungan Halaman Privat ---

  // Jika belum login dan mengakses halaman privat
  if (!isLoggedIn && !isPublicRoute) {
    // Arahkan ke hub login utama
    return Response.redirect(new URL('/login', nextUrl));
  }

  // --- Perlindungan Berbasis Peran (Role) ---
  if (isLoggedIn) {
    // Jika Karyawan mencoba mengakses /admin
    if (userRole === 'EMPLOYEE' && nextUrl.pathname.startsWith('/admin')) {
      return Response.redirect(new URL('/', nextUrl)); // Redirect ke home Karyawan
    }

    // Jika HRD mencoba mengakses halaman Karyawan (form / atau riwayat)
    if (
      userRole === 'HRD' &&
      (nextUrl.pathname === '/' || nextUrl.pathname.startsWith('/my-history'))
    ) {
      return Response.redirect(new URL('/admin', nextUrl)); // Redirect ke home HRD
    }
  }

  // Izinkan akses jika semua kondisi di atas lolos
  return;
});

// Konfigurasi matcher (tetap sama)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};