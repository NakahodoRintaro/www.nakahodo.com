import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

type Category = {
  label: string;
  icon: string;
  href: string;
};

const CATEGORIES: Category[] = [
  { label: 'NLP', icon: '🔤', href: '/posts/tags/nlp' },
  { label: 'AI', icon: '🤖', href: '/posts/tags/ai' },
  { label: 'Engineering', icon: '⚙️', href: '/posts/tags/engineering' },
  { label: 'Research', icon: '🔬', href: '/posts/tags/research' },
  { label: 'Game', icon: '🎮', href: '/posts/tags/game' },
  { label: 'Life', icon: '🌿', href: '/posts/tags/life' },
  { label: 'Music', icon: '🎵', href: '/posts/tags/Music' },
];

export default function Home(): React.JSX.Element {
  return (
    <Layout
      title="Rintaro Nakahodo Blog"
      description="NLP · Engineering · Game · Music · Life"
    >
      <div className={styles.page}>
        {/* Hero */}
        <header className={styles.hero}>
          <h1 className={styles.heroTitle}>Rintaro Nakahodo Blog</h1>
          <p className={styles.heroSubtitle}>NLP · Engineering · Game · Music · Life</p>
        </header>

        {/* Categories */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>カテゴリー</h2>
          <div className={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Link key={cat.label} to={cat.href} className={styles.categoryCard}>
                <span className={styles.categoryIcon}>{cat.icon}</span>
                <span>{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Latest / ranking */}
        <section className={styles.section} style={{ paddingTop: 0 }}>
          <h2 className={styles.sectionTitle}>最新記事 / アクセスランキング</h2>
          <ul className={styles.postList}>
            <li>— アクセスランキングは今後追加予定です —</li>
          </ul>
          <Link to="/posts" className={styles.allPostsLink}>
            全記事を見る →
          </Link>
        </section>

        {/* Footer note */}
        <p className={styles.footerNote}>アクセスランキングは今後追加予定です</p>
      </div>
    </Layout>
  );
}
