import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "NekoStack",
  description: "The Single Source of Truth for Data Contracts.",
  
  ignoreDeadLinks: true,

  // Clean URLs (e.g. /guide/ instead of /guide.html)
  cleanUrls: true,

  themeConfig: {
    nav: [
      { text: 'Thesis', link: '/thesis' },
      { text: 'Roadmap', link: '/roadmap' },
      { text: 'GitHub', link: 'https://github.com/cmclicker/NekoStack' }
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Product Thesis', link: '/thesis' },
          { text: 'Roadmap', link: '/roadmap' }
        ]
      },
      {
        text: 'Data Contracts (@nekostack/schema)',
        items: [
          { text: 'Introduction', link: '/schema/' },
          { text: 'Zod Migration Guide', link: '/schema/migration-guide' },
          { text: 'Performance Benchmarks', link: '/schema/benchmarks' },
          { text: 'Issue Codes Catalog', link: '/schema/issue-codes' }
        ]
      },
      {
        text: 'Migrations (@nekostack/migrate-runner)',
        items: [
          { text: 'Runner Engine', link: '/runner/' },
          { text: 'Runner Spec', link: '/runner/spec' }
        ]
      },
      {
        text: 'Presentation Layer',
        items: [
          { text: 'Theme Registry', link: '/theme/' },
          { text: 'UI Components', link: '/ui/' }
        ]
      }
    ]
  }
})
