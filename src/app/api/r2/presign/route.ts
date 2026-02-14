import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromHeader } from '@/lib/auth-admin';
import { s3Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handleApiError, AppError } from '@/lib/app-error';

export async function POST(request: NextRequest) {
    try {
        // 1. Validar ADMIN (getAdminFromHeader já valida roles ADMIN/SUPER_ADMIN)
        await getAdminFromHeader(request);

        const body = await request.json();
        const { eventoId, fileName, contentType, fileSize, kind = 'banner' } = body;

        // 2. Validações básicas
        if (!fileName || !contentType || !fileSize) {
            return NextResponse.json({ error: { message: 'Dados do arquivo incompletos' } }, { status: 400 });
        }

        // Limite de tamanho (5MB definido no prompt)
        const MAX_SIZE = (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;
        if (fileSize > MAX_SIZE) {
            return NextResponse.json({ error: { message: `Arquivo muito grande. Máximo ${process.env.MAX_UPLOAD_MB || 5}MB` } }, { status: 400 });
        }

        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(contentType)) {
            return NextResponse.json({ error: { message: 'Tipo de arquivo não permitido. Use JPG, PNG ou WEBP.' } }, { status: 400 });
        }

        // 3. Gerar Key padronizada
        const ext = fileName.split('.').pop();
        const timestamp = Date.now();
        const id = eventoId || `temp-${timestamp}`;

        // Definir prefixo da Key baseado no kind
        const prefix = kind === 'certificado_fundo' ? 'certificado-fundo' : 'banner';
        const key = `eventos/${id}/${prefix}-${timestamp}.${ext}`;

        // 4. Gerar Presigned URL
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
        const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

        return NextResponse.json({
            uploadUrl,
            publicUrl,
            key
        });

    } catch (error) {
        return handleApiError(error);
    }
}
