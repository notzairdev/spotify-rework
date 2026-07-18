import Playlists from "@/components/misc/playlists";
import VideoCanvaPlayer from "@/components/misc/video";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground min-h-screen w-screen px-3 py-16 flex">
      <div>
        <Playlists/>
      </div>
      <div className="flex-1 mx-4 rounded-lg overflow-hidden h-full">
        {children}
      </div>
      <div>
        <VideoCanvaPlayer />
      </div>
    </div>
  );
}