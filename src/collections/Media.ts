import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    mimeTypes: ['image/*'],
    bulkUpload: true,
    // Files are served through /api/media/file. Cached for a day rather than
    // immutable because editing a crop in the admin rewrites the same filename.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=86400')
      return headers
    },
  },
  admin: {
    group: 'Store',
    components: {
      views: {
        list: {
          Component: '@/components/admin/MediaGrid',
        },
      },
    },
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      defaultValue: 'silver jewellery image',
    },
  ],
}
