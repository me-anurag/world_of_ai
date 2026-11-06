// One place for the site's name, address and repository. Change these before launch.
export const site = {
  name: 'World of AI',
  // The public address. Set SITE_URL in the hosting provider once the domain is bought.
  url: process.env.SITE_URL || 'https://world-of-ai.pages.dev',
  repo: 'me-anurag/world_of_ai',
  // Shown on About and in page metadata. Leave empty to omit.
  editor: process.env.SITE_EDITOR || '',
  // Shows a Beta badge in the header when true.
  beta: false,
  updated: new Date().toISOString().slice(0, 10),
};
