import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { Lilita_One, Shrikhand } from 'next/font/google'
import styles from './teaser.module.css'

const lilita = Lilita_One({
    subsets: ['latin'],
    weight: '400',
    variable: '--font-lilita',
})

const shrikhand = Shrikhand({
    subsets: ['latin'],
    weight: '400',
    variable: '--font-shrikhand',
})

export const metadata: Metadata = {
    title: 'A maior de todos os tempos | FAZAG',
    description: 'A maior de todos os tempos está chegando.',
}

const lines = [
    [
        { text: 'A', accent: false },
        { text: 'MAIOR', accent: false },
    ],
    [
        { text: 'DE', accent: false },
        { text: 'TODOS', accent: true, artistic: true },
    ],
    [
        { text: 'OS', accent: false },
        { text: 'TEMPOS', accent: false },
    ],
]

export default function TeaserPage() {
    let wordIndex = 0

    return (
        <main className={`${styles.teaser} ${lilita.variable} ${shrikhand.variable}`}>
            <div className={styles.scene} aria-hidden="true">
                <div className={styles.softCircle} />
                <div className={styles.ring} />
                <div className={`${styles.spark} ${styles.sparkLarge}`} />
                <div className={`${styles.spark} ${styles.sparkSmall}`} />
                <div className={`${styles.spark} ${styles.sparkMini}`} />
                <div className={`${styles.dot} ${styles.dotOne}`} />
                <div className={`${styles.dot} ${styles.dotTwo}`} />
                <div className={styles.wave} />
            </div>

            <p className={styles.eyebrow}>vem aí...</p>

            <h1 className={styles.title} aria-label="A maior de todos os tempos">
                {lines.map((line, lineIndex) => (
                    <span className={`${styles.line} ${styles[`line${lineIndex + 1}`]}`} key={lineIndex}>
                        {line.map((word) => {
                            const currentIndex = wordIndex++

                            return (
                                <span
                                    className={`${styles.word} ${word.accent ? styles.accent : ''} ${word.artistic ? styles.artistic : ''}`}
                                    data-text={word.text}
                                    key={word.text}
                                    style={{ '--word-index': currentIndex } as CSSProperties}
                                    aria-hidden="true"
                                >
                                    {word.text}
                                </span>
                            )
                        })}
                    </span>
                ))}
            </h1>

            <header className={styles.header}>
                <Image
                    className={styles.logo}
                    src="/fazag-logo-white.png"
                    alt="FAZAG"
                    width={4500}
                    height={1200}
                    priority
                />
            </header>

            <div className={styles.grain} aria-hidden="true" />
        </main>
    )
}
