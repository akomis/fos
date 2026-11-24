import Block from "@/components/Block";
import Contact from "@/components/Contact";
import CutoffText from "@/components/CutoffText";
import DynamicBackground from "@/components/DynamicBackground";
import CookieSettingsLink from "@/components/CookieSettingsLink";
import Section from "@/components/Section";
import Link from "next/link";
import { getPages, pagePath } from "@/lib/pages";
import { getPayloadClient } from "@/lib/payload";
import { activeCategoryWhere } from "@/lib/visibility";
import type { Category, LandingPage } from "@/lib/store";
import { Suspense } from "react";

// Use dynamic rendering for pages that need database access
export const dynamic = "force-dynamic";

const Header = async () => {
  const payload = await getPayloadClient();

  const categoriesResult = await payload.find({
    collection: "categories",
    where: activeCategoryWhere,
    depth: 2,
    sort: "_order",
    limit: 100,
  });

  const categories = categoriesResult.docs as unknown as Category[];

  const data = categories.map((category) => ({
    category,
    desktopUrl: category.headerDesktop?.url,
    mobileUrl: category.headerMobile?.url,
  }));

  return <DynamicBackground data={data} />;
};

const About = ({ abouts }: { abouts: LandingPage["abouts"] }) => {
  const aboutsList = abouts || [];

  return (
    <Section className="pt-12 pb-4">
      <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between items-start leading-10">
        <div className="mb-6 px-10 2xl:p-0 2xl:mb-2">
          <CutoffText>ABOUT</CutoffText>
        </div>

        <div className="flex flex-col gap-5 lg:gap-10 py-0 m-0 px-10 w-full">
          {aboutsList.map((about) => (
            <div key={about.title} className="flex flex-col gap-2">
              <p className="text-4xl sm:text-7xl tracking-widest font-bold">
                {about.title}
              </p>
              <Block content={about.content} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

const Footer = ({
  socials,
  footerImage,
}: {
  socials: LandingPage["socials"];
  footerImage: LandingPage["footerImage"];
}) => {
  const socialsList = socials || [];
  const bgImageUrl = footerImage?.url;

  return (
    <Section
      className="h-[450px] flex flex-col justify-end items-start pb-5 px-5 sm:px-10"
      style={{
        backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        id="footer"
        className="flex flex-row items-end justify-between gap-4 mt-10 w-full text-white"
      >
        <Contact socials={socialsList} />
        <div className="flex flex-col items-end sm:flex-row sm:items-center sm:justify-end flex-wrap gap-x-6 gap-y-2 text-sm w-auto">
          {getPages().map((page) => (
            <Link
              key={page.slug}
              href={pagePath("en", page.slug)}
              className="hover:opacity-70 transition-all duration-500"
            >
              {page.title}
            </Link>
          ))}
          <CookieSettingsLink className="text-right sm:text-left hover:opacity-70 transition-all duration-500" />
        </div>
      </div>
    </Section>
  );
};

export default async function Landing() {
  const payload = await getPayloadClient();

  const landingPage = (await payload.findGlobal({
    slug: "landing-page",
    depth: 2,
  })) as unknown as LandingPage;

  return (
    <Suspense>
      <div className="animate-in fade-in">
        <Header />
        <About abouts={landingPage.abouts} />
        <Footer
          socials={landingPage.socials}
          footerImage={landingPage.footerImage}
        />
      </div>
    </Suspense>
  );
}
