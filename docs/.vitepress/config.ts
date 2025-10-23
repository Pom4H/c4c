import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'c4c',
  description: 'TypeScript-first workflow automation framework',
  
  // GitHub Pages base path - update this if your repo name is different
  // For https://username.github.io/repo-name/, use '/repo-name/'
  // For https://username.github.io/, use '/'
  base: process.env.BASE_PATH || '/',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Packages', link: '/packages/core' },
      { text: 'Examples', link: '/examples/basic' },
      {
        text: 'GitHub',
        link: 'https://github.com/c4c/c4c'
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Installation', link: '/guide/installation' },
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Procedures', link: '/guide/procedures' },
            { text: 'Workflows', link: '/guide/workflows' },
            { text: 'Registry', link: '/guide/registry' },
            { text: 'Auto-Naming', link: '/guide/auto-naming' },
          ]
        },
        {
          text: 'Features',
          items: [
            { text: 'Type Safety', link: '/guide/type-safety' },
            { text: 'Project Organization', link: '/guide/organization' },
            { text: 'CLI Commands', link: '/guide/cli' },
            { text: 'HTTP API', link: '/guide/http-api' },
            { text: 'OpenTelemetry', link: '/guide/opentelemetry' },
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Policies', link: '/guide/policies' },
            { text: 'Client Generation', link: '/guide/client-generation' },
            { text: 'Integrations', link: '/guide/integrations' },
            { text: 'Authentication', link: '/guide/authentication' },
            { text: 'Triggers & Webhooks', link: '/guide/triggers' },
          ]
        }
      ],
      '/packages/': [
        {
          text: 'Packages',
          items: [
            { text: 'Overview', link: '/packages/overview' },
            { text: '@c4c/core', link: '/packages/core' },
            { text: '@c4c/workflow', link: '/packages/workflow' },
            { text: '@c4c/adapters', link: '/packages/adapters' },
            { text: '@c4c/policies', link: '/packages/policies' },
            { text: '@c4c/generators', link: '/packages/generators' },
            { text: '@c4c/workflow-react', link: '/packages/workflow-react' },
            { text: '@c4c/cli', link: '/packages/cli' },
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic', link: '/examples/basic' },
            { text: 'Modules', link: '/examples/modules' },
            { text: 'Integrations', link: '/examples/integrations' },
            { text: 'Cross-Integration', link: '/examples/cross-integration' },
            { text: 'Triggers', link: '/examples/triggers' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/c4c/c4c' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present c4c Contributors'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/c4c/c4c/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
