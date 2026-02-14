import { Toaster } from 'sonner'
import './globals.css'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                {children}
                <Toaster richColors position="top-center" />
            </body>
        </html>
    )
}
