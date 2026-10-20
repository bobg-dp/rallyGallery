import { notFound } from "next/navigation";
import { Desk } from "@/components/desk";
import { Uploader } from "@/components/uploader";
import { getDesk } from "@/lib/studio-data";

export default async function Page({ params }: { params: Promise<{ galleryId: string }> }) {
  const { galleryId } = await params;
  const data = await getDesk(galleryId);
  if (!data) notFound();
  return (
    <div className="space-y-8">
      <Uploader galleryId={data.gallery.id} />
      <Desk
        gallery={data.gallery}
        stages={data.stages}
        competitions={data.competitions}
        crews={data.crews}
        authors={data.authors}
        photos={data.photos}
      />
    </div>
  );
}
