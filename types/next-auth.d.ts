import { DefaultSession } from 'next-auth';
import { UserRole } from '@prisma/client';

declare module 'next-auth/adapters' {
  interface AdapterUser {
    id: string;
    email: string;
    emailVerified: Date | null;
    name: string | null;
    image: string | null;
    role: UserRole;
    remainingLeave: number;
    departmentId: string | null;
    fullName: string; // <-- Tambahkan ini
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      remainingLeave: number;
      departmentId: string | null;
    } & DefaultSession['user']; // 'name' sudah ada di DefaultSession
  }

  interface User {
    // Tipe ini HARUS sesuai dengan apa yang dikembalikan oleh 'authorize' (model Prisma User)
    id: string;
    role: UserRole;
    remainingLeave: number;
    departmentId: string | null;
    fullName: string; // <-- TAMBAHKAN INI
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    remainingLeave: number;
    departmentId: string | null;
    name: string | null; // <-- TAMBAHKAN INI
  }
}