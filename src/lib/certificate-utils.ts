export interface ElementStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
    letterSpacing: number;
}

export interface CertificateElement {
    id: string;
    type: 'text';
    text: string;
    x: number; // normalized 0..1
    y: number; // normalized 0..1
    w: number; // normalized 0..1
    h: number; // normalized 0..1
    style: ElementStyle;
}

export interface CertificateTemplate {
    page: {
        width: number;
        height: number;
        unit: 'px';
    };
    background: {
        url: string;
        fit: 'cover' | 'contain' | 'fill';
    };
    elements: CertificateElement[];
}

export const DEFAULT_TEMPLATE: CertificateTemplate = {
    page: { width: 1200, height: 850, unit: 'px' },
    background: { url: '', fit: 'cover' },
    elements: [
        {
            id: 'titulo',
            type: 'text',
            text: 'CERTIFICADO DE PARTICIPAÇÃO',
            x: 0.1,
            y: 0.15,
            w: 0.8,
            h: 0.1,
            style: {
                fontFamily: 'serif',
                fontSize: 48,
                fontWeight: 700,
                color: '#111111',
                align: 'center',
                lineHeight: 1.2,
                letterSpacing: 2
            }
        },
        {
            id: 'corpo',
            type: 'text',
            text: 'Certificamos que {{NOME_ALUNO}} participou com êxito do evento {{NOME_EVENTO}}, realizado em {{DATA}}, com carga horária total de {{CARGA_HORARIA}} horas.',
            x: 0.1,
            y: 0.35,
            w: 0.8,
            h: 0.3,
            style: {
                fontFamily: 'sans-serif',
                fontSize: 24,
                fontWeight: 400,
                color: '#333333',
                align: 'center',
                lineHeight: 1.6,
                letterSpacing: 0
            }
        }
    ]
};

export function normalize(value: number, total: number): number {
    return value / total;
}

export function denormalize(value: number, total: number): number {
    return value * total;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function renderMockText(text: string, mockData: Record<string, string>): string {
    let rendered = text;
    Object.entries(mockData).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, value);
    });
    return rendered;
}
