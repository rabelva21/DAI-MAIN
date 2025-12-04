import { DefaultSession } from 'next-auth';
// Hapus import UserRole jika error, kita gunakan string literal saja atau definisikan ulang
// import { UserRole } from '@prisma/client'; 

declare module 'next-auth/adapters' {
  interface AdapterUser {
    id: string;
    email: string;
    name: string | null;
    role: 'HRD' | 'EMPLOYEE';
    remainingLeave: number;
    departmentId: string | null;
    fullName: string;
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'HRD' | 'EMPLOYEE';
      remainingLeave: number;
      departmentId: string | null;
      fullName: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'HRD' | 'EMPLOYEE';
    remainingLeave: number;
    departmentId: string | null;
    fullName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'HRD' | 'EMPLOYEE';
    remainingLeave: number;
    departmentId: string | null;
    fullName: string;
  }
}