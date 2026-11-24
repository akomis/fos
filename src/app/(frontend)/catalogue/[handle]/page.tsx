import { getPayloadClient } from "@/lib/payload";
import { visibleProductWhere } from "@/lib/visibility";
import { Product } from "@/lib/store";
import { notFound } from "next/navigation";
import ProductDetails from "./ProductDetails";

// Use dynamic rendering for pages that need database access
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
};

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const payload = await getPayloadClient();

  const products = await payload.find({
    collection: "products",
    where: {
      and: [{ handle: { equals: handle } }, visibleProductWhere],
    },
    depth: 2,
    limit: 1,
  });

  const product = products.docs[0] as unknown as Product | undefined;

  // An unknown handle is a 404, not an error - bots probing paths like
  // /catalogue/.env must not surface as exceptions.
  if (!product) {
    notFound();
  }

  return <ProductDetails product={product} />;
}
