import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { activeCategoryWhere } from '@/lib/visibility'

export async function GET() {
  try {
    const payload = await getPayloadClient()

    const categories = await payload.find({
      collection: 'categories',
      where: activeCategoryWhere,
      depth: 2,
      sort: '_order',
      limit: 100,
    })

    return NextResponse.json({ categories: categories.docs })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
