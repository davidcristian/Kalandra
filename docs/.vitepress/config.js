import { defineConfig } from 'vitepress'

const BASE = '/Kalandra/'

export default defineConfig({
  title: 'Kalandra',
  description: 'A Path of Exile 2 overlay for price checking items, with widgets for maps, stash search, XP tracking and more.',
  base: BASE,
  mpa: true,
  head: [
    ['link', { rel: 'shortcut icon', type: 'image/png', href: `${BASE}favicon.png` }]
  ],
  markdown: {
    theme: 'light-plus',
    attrs: {
      leftDelimiter: '{:',
      rightDelimiter: '}'
    }
  },
  themeConfig: {
    appVersion: '0.16.3',
    github: {
      releasesUrl: 'https://github.com/davidcristian/Kalandra/releases'
    },
    socialLinks: [
      {
        text: 'GitHub',
        color: '#181717',
        link: 'https://github.com/davidcristian/Kalandra'
      }
    ],
    sidebar: [
      {
        text: 'Get started',
        items: [
          { text: 'Download', link: '/download' },
          { text: 'Quick start', link: '/quick-start' },
          { text: 'Features', link: '/features' }
        ]
      },
      {
        text: 'Price check',
        items: [
          { text: 'Price check', link: '/price-check' },
          { text: 'Item info', link: '/item-info' },
          { text: 'Map check', link: '/map-check' },
          { text: 'Private leagues', link: '/private-leagues' }
        ]
      },
      {
        text: 'Widgets',
        items: [
          { text: 'Widgets', link: '/widgets' },
          { text: 'Stash search', link: '/stash-search' },
          { text: 'XP tracker', link: '/xp-tracker' },
          { text: 'Extra widgets', link: '/extra-widgets' },
          { text: 'Chat commands', link: '/chat-commands' },
          { text: 'OCR guide', link: '/ocr-guide' },
          { text: 'Item data', link: '/item-data' },
          { text: 'Client log file', link: '/client-log-parser' }
        ]
      },
      {
        text: 'Settings',
        items: [
          { text: 'Settings', link: '/settings' },
          { text: 'Command-line options', link: '/cmd-flags' }
        ]
      },
      {
        text: 'Problems',
        items: [
          { text: 'Common issues', link: '/issues' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Nothing happens', link: '/nothing-happens' },
          { text: 'No stats to select', link: '/no-item-mods' },
          { text: 'Query is too complex', link: '/complex-query' },
          { text: 'Failed to load leagues', link: '/failed-load-leagues' },
          { text: 'Invalid JSON', link: '/invalid-json' }
        ]
      }
    ]
  }
})
