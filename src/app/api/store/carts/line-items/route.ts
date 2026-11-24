import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCartSession } from '@/lib/session'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const log = logger.scope({ operation: 'cart.addLineItem', endpoint: '/api/store/carts/line-items' })

  try {
    const cartId = await getCartSession()

    if (!cartId) {
      log.warn('No cart session for adding line item')
      return NextResponse.json({ error: 'No cart session' }, { status: 401 })
    }

    const payload = await getPayloadClient()
    const { productId, quantity = 1 } = await request.json()

    log.debug('Adding line item', { cartId, productId, quantity })

    // Get current cart
    const cart = await payload.findByID({
      collection: 'carts',
      id: cartId,
      depth: 0,
    })

    // Get product
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 1,
    })

    if (!product) {
      log.warn('Product not found', { cartId, productId })
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Unpublished products and products in an inactive category are hidden
    // from the store, so they must not be addable either.
    const categoryActive =
      typeof product.category === 'object' ? product.category?.active !== false : true
    if (product.status !== 'published' || !categoryActive) {
      log.warn('Product not visible on store', { cartId, productId })
      return NextResponse.json({ error: 'Product is no longer available' }, { status: 400 })
    }

    const inventory = product.inventory ?? 1
    if (inventory === 0) {
      log.warn('Product out of stock', { cartId, productId, inventory })
      return NextResponse.json({ error: 'Product is no longer available' }, { status: 400 })
    }

    // Check if item already exists in cart
    const items = cart.items || []
    const existingItemIndex = items.findIndex((item: any) => {
      const itemProductId =
        typeof item.product === 'string' || typeof item.product === 'number'
          ? String(item.product)
          : item.product?.id
      return itemProductId === productId
    })

    let updatedItems
    if (existingItemIndex >= 0) {
      updatedItems = [...items]
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity,
      }
      log.debug('Updated existing item quantity', { cartId, productId, newQuantity: updatedItems[existingItemIndex].quantity })
    } else {
      updatedItems = [
        ...items,
        {
          product: productId,
          quantity,
          unitPrice: product.price,
        },
      ]
      log.debug('Added new item to cart', { cartId, productId, quantity, price: product.price })
    }

    const updatedCart = await payload.update({
      collection: 'carts',
      id: cartId,
      data: { items: updatedItems },
      depth: 2,
    })

    log.debug('Line item added successfully', { cartId, itemCount: updatedCart.items?.length })

    return NextResponse.json({ cart: updatedCart })
  } catch (error) {
    log.error('Failed to add line item', {}, error)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}
