import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getAdminFromHeader } from '@/lib/auth-admin';
import { s3Client } from '@/lib/r2';
import { handleApiError, AppError } from '@/lib/app-error';

function getR2KeyFromPublicUrl(publicUrl: string) {
    const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');

    if (!publicBase) {
        throw new AppError('Base pública do R2 não configurada', 500, 'R2_BASE_URL_MISSING');
    }

    if (!publicUrl.startsWith(`${publicBase}/`)) {
        throw new AppError('URL não pertence ao bucket configurado', 400, 'INVALID_R2_URL');
    }

    return decodeURIComponent(publicUrl.slice(publicBase.length + 1));
}

export async function DELETE(request: NextRequest) {
    try {
        await getAdminFromHeader(request);

        const body = await request.json();
        const { url, eventoId, kind } = body;

        if (!url || kind !== 'certificado_elemento') {
            throw new AppError('Dados inválidos para exclusão da imagem', 400, 'INVALID_DELETE_PAYLOAD');
        }

        const key = getR2KeyFromPublicUrl(url);
        const expectedPrefix = eventoId ? `eventos/${eventoId}/certificado-elemento-` : 'eventos/';

        if (!key.startsWith(expectedPrefix) || !key.includes('/certificado-elemento-')) {
            throw new AppError('Este arquivo não pode ser excluído por esta ação', 403, 'R2_DELETE_FORBIDDEN');
        }

        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        }));

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
