import Basket from "@/components/Basket";
import Filter from "@/components/Filter";
import HomeButton from "@/components/HomeButton";
import ProductGrid from "@/components/ProductGrid";
import Screen from "@/components/Screen";
import { getPayloadClient } from "@/lib/payload";
import { activeCategoryWhere, visibleProductWhere } from "@/lib/visibility";
import {
  Catalogue as CatalogueType,
  Category,
  LandingPage,
  Product,
} from "@/lib/store";
import { notFound } from "next/navigation";

// Use dynamic rendering for pages that need database access
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category: string }>;
};

export default async function CategoryPage({ params }: Props) {
  const { category: categoryHandle } = await params;
  const payload = await getPayloadClient();

  // First, find the category by handle
  const categoryResult = await payload.find({
    collection: "categories",
    where: {
      and: [{ handle: { equals: categoryHandle } }, activeCategoryWhere],
    },
    limit: 1,
  });

  const category = categoryResult.docs[0] as unknown as Category | undefined;

  // If category doesn't exist, return 404
  if (!category) {
    notFound();
  }

  // Now fetch everything else
  const [categoriesResult, catalogue, landingPage, productsResult] =
    await Promise.all([
      payload.find({
        collection: "categories",
        where: activeCategoryWhere,
        depth: 2,
        sort: "_order",
        limit: 100,
      }),
      payload.findGlobal({
        slug: "catalogue",
        depth: 2,
      }) as Promise<CatalogueType>,
      payload.findGlobal({
        slug: "landing-page" as "catalogue",
      }) as unknown as Promise<LandingPage>,
      payload.find({
        collection: "products",
        where: {
          and: [visibleProductWhere, { category: { equals: category.id } }],
        },
        depth: 2,
        sort: "-createdAt",
        limit: 100,
      }),
    ]);

  const categories = categoriesResult.docs as unknown as Category[];
  const products = productsResult.docs as unknown as Product[];
  const socials = landingPage.socials || [];

  const catalogueStaticImages =
    catalogue.showcaseImages?.map((item) => ({
      url: item.image?.url || "",
    })) || [];

  return (
    <Screen className="px-5 animate-in fade-in">
      <div className="w-full max-w-[1200px] mx-auto">
        <div className="flex justify-between items-center w-full sticky top-0 z-10 bg-black pb-16 pt-10">
          <HomeButton isIcon />

          <div className="absolute left-1/2 -translate-x-1/2">
            <Filter categories={categories} activeCategoryHandle={categoryHandle} />
          </div>

          <Basket />
        </div>

        <ProductGrid
          images={catalogueStaticImages}
          socials={socials}
          initialProducts={products}
          categoryHandle={categoryHandle}
        />
      </div>
    </Screen>
  );
}
