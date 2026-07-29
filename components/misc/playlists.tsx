"use client";

import { useCurrentUser } from "@/lib/spotify";
import { useUserPlaylists } from "@/lib/spotify/hooks";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Playlists ({}: {}) {
    const { data: user, isLoading: userLoading } = useCurrentUser();
    const { data, isLoading: playlistsLoading } = useUserPlaylists(user?.id ?? null, 18);

    if(userLoading || playlistsLoading) {
        return <div>Loading...</div>
    }   

    return (
        <div className="w-fit fixed" style={{ zIndex: 1000 }}>
            {data?.items?.map((playlist) => (
                <Tooltip key={playlist.id}>
                    <TooltipTrigger asChild>
                        <div className="p-2 hover:bg-gray-100 bg-transparent transition-colors rounded-md cursor-pointer flex items-center gap-2">
                            {
                                playlist.images?.[0]?.url ? (
                                    <img src={playlist.images[0].url} alt={playlist.name} className="w-8 h-8 rounded-md" />
                                ) : (
                                    <div className="w-8 h-8 rounded-md bg-foreground flex items-center justify-center">
                                        <span className="text-gray-500 text-sm font-medium uppercase">{playlist.name[0]}</span>
                                    </div>
                                )
                            }
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" >
                        {playlist.name}
                    </TooltipContent>
                    
                </Tooltip>
            ))}
        </div>
    )
}