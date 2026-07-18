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
    const { data, isLoading: playlistsLoading } = useUserPlaylists(user?.id ?? null, 19);

    if(userLoading || playlistsLoading) {
        return <div>Loading...</div>
    }   

    return (
        <div className="w-fit sticky">
            {data?.items?.map((playlist) => (
                <Tooltip key={playlist.id}>
                    <TooltipTrigger asChild>
                        <div className="p-2 hover:bg-gray-100 bg-transparent transition-colors rounded-md cursor-pointer flex items-center gap-2">
                            <img src={playlist.images?.[0]?.url} alt={playlist.name} className="w-10 h-10" />
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