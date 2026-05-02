import { HomePageView } from "@/components/public/home-page-view";
import { getHomePageData } from "@/lib/content/repository";
import { resolveViewMode } from "@/lib/content/utils";

type HomePageProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    view?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const viewMode = resolveViewMode(resolvedSearchParams.view);
  const data = await getHomePageData({
    query: resolvedSearchParams.q,
    tag: resolvedSearchParams.tag,
  });

  return <HomePageView data={data} viewMode={viewMode} />;
}
