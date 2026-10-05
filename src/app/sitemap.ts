import { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { LOCALES, getAllPageSlugs, pagePath } from '@/lib/pages'

const BASE_URL = 'https://www.fosjewels.com'

// Rendered per request - the database is not reachable during the build.
export const dynamic = 'force-dynamic'

const entry = (
  path: string,
  rest: Omit<MetadataRoute.Sitemap[number], 'url'>,
): MetadataRoute.Sitemap[number] => ({ ...rest, url: `${BASE_URL}${path}` })

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayloadClient()

  // Get all published products
  const products = await payload.find({
    collection: 'products',
    where: {
      status: { equals: 'published' },
    },
    limit: 1000,
    select: {
      handle: true,
      updatedAt: true,
    },
  })

  // Get all categories
  const categories = await payload.find({
    collection: 'categories',
    limit: 100,
    select: {
      handle: true,
      updatedAt: true,
    },
  })

  // Core pages
  const corePages: MetadataRoute.Sitemap = [
    entry('/', {
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    }),
    entry('/catalogue', {
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    }),
  ]

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = categories.docs.map((category) =>
    entry(`/catalogue/category/${category.handle}`, {
      lastModified: category.updatedAt
        ? new Date(category.updatedAt)
        : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }),
  )

  // Product pages
  const productPages: MetadataRoute.Sitemap = products.docs.map((product) =>
    entry(`/catalogue/${product.handle}`, {
      lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
  )

  // Static content pages - the only translated surface, so these carry
  // hreflang alternates pairing the English and Greek versions.
  const staticPages: MetadataRoute.Sitemap = getAllPageSlugs().flatMap((slug) =>
    LOCALES.map((locale) =>
      entry(pagePath(locale, slug), {
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((alternate) => [
              alternate,
              `${BASE_URL}${pagePath(alternate, slug)}`,
            ]),
          ),
        },
      }),
    ),
  )

  return [...corePages, ...categoryPages, ...productPages, ...staticPages]
}
