import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3';

export async function GET(request: Request) {
    let userId: string | undefined;
    let userRole: string | undefined;

    const session = await auth();
    if (session && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
    }

    if (!userId) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1];
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
                userRole = decoded.role;
            } catch (e) {}
        }
    }

    if (!userId || userRole !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const skip = (page - 1) * limit;

    try {
        const whereClause = { employeeId: userId };

        const [rawRequests, totalCount] = await prisma.$transaction([
            prisma.leaveRequest.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                include: {
                    approval: {
                        include: {
                            hrd: {
                                select: { fullName: true }
                            }
                        }
                    }
                },
                skip: skip,
                take: limit,
            }),
            prisma.leaveRequest.count({ where: whereClause }),
        ]);

        const formattedRequests = rawRequests.map((req) => ({
            ...req,
            hrdComment: req.approval?.comment || null,
            hrdCommentBy: req.approval?.hrd ? { fullName: req.approval.hrd.fullName } : null
        }));

        return NextResponse.json({
            data: formattedRequests,
            totalCount: totalCount,
        });
    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}