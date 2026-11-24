import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { visibleProductWhere } from '@/lib/visibility'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const payload = await getPayloadClient()

    const products = await payload.find({
      collection: 'products',
      where: {
        and: [{ handle: { equals: handle } }, visibleProductWhere],
      },
      depth: 2,
      limit: 1,
    })

    if (products.docs.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product: products.docs[0] })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
