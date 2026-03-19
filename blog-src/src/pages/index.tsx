import React, { useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useGlobalData from '@docusaurus/useGlobalData';
import styles from './index.module.css';

type BlogPostMeta = {
  permalink: string;
  title: string;
  date: string;
  tags: Array<{ label: string; permalink: string }>;
  description?: string;
};

type BlogPost = {
  id: string;
  metadata: BlogPostMeta;
};

const CATEGORIES = [
  { key: 'nlp',         label: 'NLP',         href: '/posts/tags/nlp' },
  { key: 'ai',          label: 'AI',           href: '/posts/tags/ai' },
  { key: 'engineering', label: 'Engineering',  href: '/posts/tags/engineering' },
  { key: 'research',    label: 'Research',     href: '/posts/tags/research' },
  { key: 'game',        label: 'Game',         href: '/posts/tags/game' },
  { key: 'life',        label: 'Life',         href: '/posts/tags/life' },
  { key: 'music',       label: 'Music',        href: '/posts/tags/Music' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function CategorySection({ cat, posts }: { cat: typeof CATEGORIES[0]; posts: BlogPost[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.categorySection}>
      <button
        className={styles.categoryHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.categoryLabel}>{cat.label}</span>
        <span className={styles.categoryMeta}>
          {posts.length > 0 ? `${posts.length} 記事` : '記事なし'}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
        </span>
      </button>

      {open && (
        <div className={styles.postListWrap}>
          {posts.length === 0 ? (
            <p className={styles.emptyNote}>まだ記事がありません</p>
          ) : (
            <ul className={styles.postList}>
              {posts.map((post) => (
                <li key={post.id} className={styles.postItem}>
                  <Link to={post.metadata.permalink} className={styles.postTitle}>
                    {post.metadata.title}
                  </Link>
                  <span className={styles.postDate}>{formatDate(post.metadata.date)}</span>
                </li>
              ))}
            </ul>
          )}
          {posts.length > 0 && (
            <Link to={cat.href} className={styles.tagLink}>
              {cat.label} の記事をすべて見る
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home(): React.JSX.Element {
  const globalData = useGlobalData();
  const blogData = (globalData?.['docusaurus-plugin-content-blog'] as any)?.default;
  const allPosts: BlogPost[] = blogData?.blogPosts ?? [];

  const postsByCategory = Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat.key,
      allPosts.filter((post) =>
        post.metadata.tags.some(
          (tag) => tag.label.toLowerCase() === cat.label.toLowerCase()
        )
      ),
    ])
  );

  const recentPosts = [...allPosts].sort(
    (a, b) => new Date(b.metadata.date).getTime() - new Date(a.metadata.date).getTime()
  ).slice(0, 5);

  return (
    <Layout
      title="Rintaro Nakahodo Blog"
      description="NLP · Engineering · Game · Music · Life"
    >
      <div className={styles.page}>
        <header className={styles.hero}>
          <h1 className={styles.heroTitle}>Rintaro Nakahodo Blog</h1>
          <p className={styles.heroSubtitle}>NLP · Engineering · Game · Music · Life</p>
        </header>

        <div className={styles.body}>
          {/* Recent posts */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>最新記事</h2>
            {recentPosts.length === 0 ? (
              <p className={styles.emptyNote}>まだ記事がありません</p>
            ) : (
              <ul className={styles.postList}>
                {recentPosts.map((post) => (
                  <li key={post.id} className={styles.postItem}>
                    <Link to={post.metadata.permalink} className={styles.postTitle}>
                      {post.metadata.title}
                    </Link>
                    <span className={styles.postDate}>{formatDate(post.metadata.date)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/posts" className={styles.allPostsLink}>
              全記事を見る
            </Link>
          </section>

          {/* Categories with posts */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>カテゴリー</h2>
            <div className={styles.categoryList}>
              {CATEGORIES.map((cat) => (
                <CategorySection
                  key={cat.key}
                  cat={cat}
                  posts={postsByCategory[cat.key] ?? []}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
