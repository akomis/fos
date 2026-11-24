const getApiBase = () => {
  if (typeof window !== "undefined") {
    return "/api/store";
  }
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${baseUrl}/api/store`;
};

const API_BASE = getApiBase();

// Logging helper for both client and server
const logFetch = {
  request: (operation: string, url: string, method: string = "GET") => {
    const isServer = typeof window === "undefined";
    const timestamp = new Date().toISOString();
    const context = {
      timestamp,
      operation,
      url,
      method,
      env: isServer ? "server" : "client",
    };

    if (isServer) {
      console.info(
        JSON.stringify({
          level: "DEBUG",
          message: `[Store] ${operation} started`,
          context,
        })
      );
    } else if (process.env.NODE_ENV === "development") {
      console.debug(`[Store] ${operation}`, method, url);
    }
  },

  error: (
    operation: string,
    url: string,
    error: unknown,
    response?: Response
  ) => {
    const isServer = typeof window === "undefined";
    const timestamp = new Date().toISOString();

    // Extract detailed error info
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? error.message : String(error),
    };

    if (error instanceof Error) {
      errorDetails.name = error.name;
      errorDetails.stack = error.stack;

      // Extract cause chain (important for ECONNREFUSED errors)
      if ("cause" in error && error.cause) {
        const cause = error.cause as any;
        errorDetails.cause = {
          message: cause.message,
          code: cause.code,
          name: cause.name,
        };
      }

      // Extract error codes
      if ("code" in error) {
        errorDetails.code = (error as any).code;
      }
      if ("digest" in error) {
        errorDetails.digest = (error as any).digest;
      }
    }

    const context = {
      timestamp,
      operation,
      url,
      statusCode: response?.status,
      statusText: response?.statusText,
      env: isServer ? "server" : "client",
      apiBase: API_BASE,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "NOT_SET",
    };

    if (isServer) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          message: `[Store] ${operation} failed`,
          context,
          error: errorDetails,
        })
      );
    } else {
      console.error(`[Store] ${operation} failed:`, {
        context,
        error: errorDetails,
      });
    }
  },

  success: (operation: string, url: string, duration: number) => {
    const isServer = typeof window === "undefined";

    if (isServer) {
      console.info(
        JSON.stringify({
          level: "DEBUG",
          message: `[Store] ${operation} completed`,
          context: { operation, url, duration, env: "server" },
        })
      );
    }
  },
};

// Error thrown for any non-ok store API response. Carries the HTTP status so
// callers can distinguish an expected 404 from a genuine failure instead of
// treating every bad response as an unhandled exception.
export class StoreError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StoreError";
    this.status = status;
  }
}

// Enhanced fetch with logging
async function storeApi<T>(
  url: string,
  options: RequestInit & { operation: string }
): Promise<T> {
  const { operation, ...fetchOptions } = options;
  const method = fetchOptions.method || "GET";
  const startTime = Date.now();

  logFetch.request(operation, url, method);

  try {
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.clone().json();
      } catch {
        errorBody = await response.clone().text();
      }

      const error = new StoreError(
        typeof errorBody === "object" && errorBody.error
          ? errorBody.error
          : `${operation} failed with status ${response.status}`,
        response.status
      );

      logFetch.error(operation, url, error, response);
      throw error;
    }

    logFetch.success(operation, url, duration);
    return response.json();
  } catch (error) {
    // Only log if not already logged (response errors are logged above)
    if (!(error instanceof StoreError)) {
      logFetch.error(operation, url, error);
    }
    throw error;
  }
}

// Types
export interface CartItem {
  product: Product | string;
  quantity: number;
  unitPrice: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: "flat" | "percentage";
  value: number;
  minimumOrderAmount?: number;
  usageLimit?: number;
  usageCount?: number;
  expiresAt?: string;
  status: "active" | "inactive";
}

export interface Cart {
  id: string;
  items: CartItem[];
  email?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  shippingOption?: ShippingOption | string | number;
  coupon?: Coupon | string | number;
  discount: number;
  subtotal: number;
  shippingTotal: number;
  total: number;
  stripePaymentIntentId?: string;
  stripeClientSecret?: string;
  completedAt?: string;
  paymentStatus?: "pending" | "processing" | "succeeded" | "failed";
  notes?: string;
}

export interface Address {
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  phone?: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  handle: string;
  price: number;
  compareAtPrice?: number;
  inventory?: number;
  category: Category | string;
  thumbnail: Media;
  images?: { image: Media }[];
  status: "draft" | "published" | "archived";
  size?: string;
}

export interface Category {
  id: string;
  name: string;
  handle: string;
  description?: string;
  active?: boolean;
  headerDesktop?: Media;
  headerMobile?: Media;
}

export interface ShippingOption {
  id: string;
  name: string;
  amount: number;
  countries: ("CY" | "GR")[];
  isActive: boolean;
}

export interface Media {
  id: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: {
    thumbnail?: { url: string };
    card?: { url: string };
    full?: { url: string };
  };
}

export interface Order {
  id: string;
  displayId: string;
  email: string;
  items: {
    productId: string;
    productTitle: string;
    productDescription?: string;
    thumbnail?: string;
    quantity: number;
    unitPrice: number;
  }[];
  shippingAddress: Address;
  shippingMethod?: { name?: string; amount?: number };
  subtotal: number;
  shippingTotal: number;
  total: number;
  status: string;
  fulfillmentStatus: string;
}

// CMS Types
export interface LandingPage {
  abouts?: {
    title: string;
    content: any; // Lexical rich text
  }[];
  socials?: {
    key: string;
    value: string;
    url?: string;
  }[];
  footerImage?: Media;
}

export interface Catalogue {
  showcaseImages?: { image: Media }[];
}

// Store API client
export const store = {
  // Cart operations (session-based - cart ID stored in HTTP-only cookie)
  cart: {
    async create(): Promise<{ cart: Cart }> {
      return storeApi(`${API_BASE}/carts`, {
        method: "POST",
        operation: "cart.create",
      });
    },

    async retrieve(): Promise<{ cart: Cart }> {
      return storeApi(`${API_BASE}/carts`, {
        operation: "cart.retrieve",
      });
    },

    async update(data: Partial<Cart>): Promise<{ cart: Cart }> {
      return storeApi(`${API_BASE}/carts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        operation: "cart.update",
      });
    },

    async addLineItem(
      productId: string,
      quantity = 1
    ): Promise<{ cart: Cart }> {
      return storeApi(`${API_BASE}/carts/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
        operation: "cart.addLineItem",
      });
    },

    async deleteLineItem(itemIndex: number): Promise<{ cart: Cart }> {
      return storeApi(`${API_BASE}/carts/line-items/${itemIndex}`, {
        method: "DELETE",
        operation: "cart.deleteLineItem",
      });
    },

    async createPaymentIntent(): Promise<{
      client_secret: string;
      payment_intent_id: string;
    }> {
      return storeApi(`${API_BASE}/carts/payment`, {
        method: "POST",
        operation: "cart.createPaymentIntent",
      });
    },

    async complete(): Promise<
      | { type: "order"; order: Order }
      | { type: "cart"; error: string; code?: string }
      | { type: "processing"; message: string }
    > {
      return storeApi(`${API_BASE}/carts/complete`, {
        method: "POST",
        operation: "cart.complete",
      });
    },

    async applyCoupon(code: string): Promise<{
      cart: Cart;
      coupon: { code: string; type: string; value: number };
    }> {
      return storeApi(`${API_BASE}/carts/coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        operation: "cart.applyCoupon",
      });
    },

    async removeCoupon(): Promise<{ cart: Cart }> {
      return storeApi(`${API_BASE}/carts/coupon`, {
        method: "DELETE",
        operation: "cart.removeCoupon",
      });
    },

    async reset(): Promise<void> {
      logFetch.request("cart.reset", `${API_BASE}/carts`, "DELETE");
      await fetch(`${API_BASE}/carts`, { method: "DELETE" });
    },
  },

  // Product operations
  product: {
    async list(categoryHandle?: string): Promise<{ products: Product[] }> {
      const params = categoryHandle ? `?category_handle=${categoryHandle}` : "";
      return storeApi(`${API_BASE}/products${params}`, {
        operation: "product.list",
      });
    },

    async get(handle: string): Promise<{ product: Product }> {
      return storeApi(`${API_BASE}/products/${handle}`, {
        operation: "product.get",
      });
    },
  },

  // Category operations
  category: {
    async list(): Promise<{ categories: Category[] }> {
      return storeApi(`${API_BASE}/categories`, {
        operation: "category.list",
      });
    },
  },

  // Shipping operations
  shipping: {
    async listOptions(
      countryCode?: string
    ): Promise<{ shipping_options: ShippingOption[] }> {
      const params = countryCode ? `?country_code=${countryCode}` : "";
      return storeApi(`${API_BASE}/shipping${params}`, {
        operation: "shipping.listOptions",
      });
    },
  },

  // CMS operations
  cms: {
    async getLandingPage(): Promise<{ landingPage: LandingPage }> {
      return storeApi(`${API_BASE}/landing-page`, {
        operation: "cms.getLandingPage",
      });
    },

    async getCatalogue(): Promise<{ catalogue: Catalogue }> {
      return storeApi(`${API_BASE}/catalogue`, {
        operation: "cms.getCatalogue",
      });
    },
  },
};
