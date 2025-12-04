import NextAuth from 'next-auth';
// Hapus import PrismaAdapter karena tidak dipakai lagi untuk tabel custom
// import { PrismaAdapter } from '@auth/prisma-adapter'; 
// import prisma from '@/lib/prisma';
import { authConfig } from './auth.config';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  // adapter: PrismaAdapter(prisma) as Adapter, <--- HAPUS BARIS INI
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.remainingLeave = user.remainingLeave;
        token.departmentId = user.departmentId;
        token.name = user.fullName; 
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (token.id) {
          session.user.id = token.id as string;
        }
        
        if (token.role) {
          session.user.role = token.role as 'EMPLOYEE' | 'HRD';
        }
        
        if (typeof token.remainingLeave === 'number') {
          session.user.remainingLeave = token.remainingLeave;
        }
        
        session.user.departmentId = (token.departmentId as string | null) ?? null;
      }
      return session;
    },
  },
});