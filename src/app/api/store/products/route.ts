import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { activeCategoryWhere, visibleProductWhere } from '@/lib/visibility'
import { logger } from '@/lib/logger'
import type { Where } from 'payload'

export async function GET(request: NextRequest) {
  const log = logger.scope({ operation: 'products.list', endpoint: '/api/store/products' })

  try {
    const { searchParams } = new URL(request.url)
    const categoryHandle = searchParams.get('category_handle')

    log.debug('Fetching products', { categoryHandle: categoryHandle || 'all' })

    const payload = await getPayloadClient()

    const conditions: Where[] = [visibleProductWhere]

    if (categoryHandle) {
      // First find the category by handle
      const categoryResult = await payload.find({
        collection: 'categories',
        where: {
          and: [{ handle: { equals: categoryHandle } }, activeCategoryWhere],
        },
        limit: 1,
      })

      if (categoryResult.docs.length === 0) {
        log.debug('Category not found', { categoryHandle })
        return NextResponse.json({ products: [] })
      }

      conditions.push({ category: { equals: categoryResult.docs[0].id } })
    }

    const products = await payload.find({
      collection: 'products',
      where: { and: conditions },
      depth: 2,
      sort: '-createdAt',
      limit: 100,
    })

    log.debug('Products fetched successfully', { count: products.docs.length, categoryHandle: categoryHandle || 'all' })

    return NextResponse.json({ products: products.docs })
  } catch (error) {
    log.error('Failed to fetch products', {}, error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
