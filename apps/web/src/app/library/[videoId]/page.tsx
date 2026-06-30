import { VideoDetail } from "@/components/library/video-detail";

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return <VideoDetail videoId={decodeURIComponent(videoId)} />;
}
