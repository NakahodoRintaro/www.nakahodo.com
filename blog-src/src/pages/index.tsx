import React, { useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import postsData from '../../static/posts-data.json';
import gaRankingData from '../../static/ga-ranking.json';
import styles from './index.module.css';

type Post = {
  title: string;
  date: string;
  permalink: string;
  tags: string[];
  description?: string;
};

type GaEntry = { rank: number; path: string; title: string; views: number };
type GaRanking = { updatedAt: string | null; ranking: GaEntry[] };

const CATEGORIES = [
  { key: 'life',        label: 'Life',         href: '/posts/tags/life' },
  { key: 'engineering', label: 'Engineering',  href: '/posts/tags/engineering' },
  { key: 'research',    label: 'Research',     href: '/posts/tags/research' },
  { key: 'game',        label: 'Game',         href: '/posts/tags/game' },
  { key: 'music',       label: 'Music',        href: '/posts/tags/Music' },
  { key: 'nlp',         label: 'NLP',          href: '/posts/tags/nlp' },
  { key: 'ai',          label: 'AI',           href: '/posts/tags/ai' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()} 更新`;
}

function CategorySection({ cat, posts }: { cat: typeof CATEGORIES[0]; posts: Post[] }) {
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
                <li key={post.permalink} className={styles.postItem}>
                  <Link to={post.permalink} className={styles.postTitle}>
                    {post.title}
                  </Link>
                  <span className={styles.postDate}>{formatDate(post.date)}</span>
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
  const allPosts = (postsData as { posts: Post[] }).posts;
  const ranking = (gaRankingData as GaRanking);

  const recentPosts = allPosts.slice(0, 5);

  const postsByCategory = Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat.key,
      allPosts.filter((post) =>
        post.tags.some((tag) => tag.toLowerCase() === cat.label.toLowerCase())
      ),
    ])
  );

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

        <main>
        <div className={styles.layout}>
        <div className={styles.body}>

          {/* Recent posts */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>最新記事</h2>
            {recentPosts.length === 0 ? (
              <p className={styles.emptyNote}>まだ記事がありません</p>
            ) : (
              <ul className={styles.postList}>
                {recentPosts.map((post) => (
                  <li key={post.permalink} className={styles.postItem}>
                    <Link to={post.permalink} className={styles.postTitle}>
                      {post.title}
                    </Link>
                    <span className={styles.postDate}>{formatDate(post.date)}</span>
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

          {/* Access ranking — shown only when GA4 data is available */}
          {ranking.ranking.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                アクセスランキング
                {ranking.updatedAt && (
                  <span className={styles.updatedAt}>
                    {formatUpdatedAt(ranking.updatedAt)}
                  </span>
                )}
              </h2>
              <ol className={styles.rankingList}>
                {ranking.ranking.map((entry) => (
                  <li key={entry.path} className={styles.rankingItem}>
                    <span className={styles.rankNum}>{entry.rank}</span>
                    <Link to={entry.path} className={styles.postTitle}>
                      {entry.title}
                    </Link>
                    <span className={styles.postDate}>{entry.views} views</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

        </div>

          {/* Profile sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.profileCard}>
              <img src="/blog/img/icon_03.webp" alt="Rintaro Nakahodo" className={styles.profileIcon} />
              <p className={styles.profileName}>Rintaro Nakahodo</p>
              <p className={styles.profileBio}>
                研究者 / JTCのFDEエンジニア / 2019年からのゲームデベロッパー。
                <br /><br />
                冴えない彼女の育て方に共感し、ゲーム制作を始める。
                <br /><br />
                趣味はゲームとライブ参戦。Liella! をはじめ好きなアーティストのライブに足繁く通う。
                <br /><br />
                <a
                  href="https://open.spotify.com/intl-ja/track/5VmeWIQkbCjW0q2SQbYagC?si=9f1d3f8727064093"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.motto}
                >
                  Live with a Smile!
                </a>
              </p>
              <a
                href="https://x.com/rin_88astro"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.profileLink}
              >
                X (Twitter)
              </a>
              <a
                href="https://nakahodo.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.profileLink}
              >
                Portfolio
              </a>
            </div>
          </aside>

        </div>
        </main>
      </div>
    </Layout>
  );
}
