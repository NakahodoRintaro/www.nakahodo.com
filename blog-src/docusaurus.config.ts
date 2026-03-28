import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Rintaro Nakahodo | Blog',
  headTags: [
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Noto+Sans+JP:wght@300;400;500;700&display=swap',
        media: 'print',
        onload: "this.media='all'",
      },
    },
  ],
  tagline: 'NLP Researcher · Engineer · Creator',
  favicon: 'img/favicon.ico',

  url: 'https://nakahodo.com',
  baseUrl: '/blog/',

  organizationName: 'NakahodoRintaro',
  projectName: 'www.nakahodo.com',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja'],
  },

  plugins: [
    [
      '@docusaurus/plugin-google-gtag',
      {
        trackingID: 'G-X5FV7SNY8N',
        anonymizeIP: false,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: false,
        blog: {
          routeBasePath: '/posts',
          showReadingTime: true,
          blogSidebarCount: 'ALL',
          blogSidebarTitle: '記事一覧',
          postsPerPage: 10,
          feedOptions: {
            type: ['rss', 'atom'],
            title: 'Rintaro Nakahodo Blog',
            description: 'NLP · AI · Creator',
            copyright: `© ${new Date().getFullYear()} Rintaro Nakahodo`,
            xslt: true,
          },
          editUrl:
            'https://github.com/NakahodoRintaro/www.nakahodo.com/tree/main/blog-src/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'ignore',
        },
        pages: {},
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/rin_port.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Rintaro Nakahodo',
      items: [
        { to: '/', label: 'Home', position: 'left' },
        { to: '/posts', label: '記事一覧', position: 'left' },
        {
          href: 'https://nakahodo.com',
          label: '← Portfolio',
          position: 'right',
        },
        {
          href: 'https://github.com/NakahodoRintaro',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Links',
          items: [
            { label: 'Portfolio', href: 'https://nakahodo.com' },
            { label: 'GitHub', href: 'https://github.com/NakahodoRintaro' },
            { label: 'Twitter', href: 'https://twitter.com/rin_88astro' },
            {
              label: 'LinkedIn',
              href: 'https://www.linkedin.com/in/rintaro-nakahodo-884305199',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Rintaro Nakahodo — NLP Researcher · Engineer · Creator`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'typescript', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
