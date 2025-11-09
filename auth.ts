import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@/lib/prisma';
import { authConfig } from './auth.config';
import type { Adapter } from 'next-auth/adapters';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as Adapter,
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
        // Cek apakah token.id ada sebelum assign
        if (token.id) {
          session.user.id = token.id as string;
        }
        
        if (token.role) {
          session.user.role = token.role as 'EMPLOYEE' | 'HRD';
        }
        
        if (typeof token.remainingLeave === 'number') {
          session.user.remainingLeave = token.remainingLeave;
        }
        
        // departmentId bisa null, jadi ini aman
        session.user.departmentId = (token.departmentId as string | null) ?? null;
      }
      return session;
    },
  },
});