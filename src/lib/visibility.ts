import type { Where } from 'payload'

// Storefront visibility rules. `not_equals: false` (rather than `equals: true`)
// keeps rows whose `active` column is still NULL visible.

// Categories shown on the store.
export const activeCategoryWhere: Where = {
  active: { not_equals: false },
}

// Products shown on the store: published and in an active category.
export const visibleProductWhere: Where = {
  status: { equals: 'published' },
  'category.active': { not_equals: false },
}
