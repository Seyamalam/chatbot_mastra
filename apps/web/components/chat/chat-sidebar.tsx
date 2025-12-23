"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  BarChart3, 
  LogOut, 
  Search,
  Sparkles
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatSidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewChat: () => void;
  userEmail?: string;
  userName?: string;
  userImage?: string;
}

export function ChatSidebar({
  currentThreadId,
  onThreadSelect,
  onNewChat,
  userEmail,
  userName,
  userImage,
}: ChatSidebarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch threads
  const { data: threadsData, isLoading } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/chat/threads`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json() as Promise<{ threads: Thread[] }>;
    },
  });

  // Delete thread mutation
  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await fetch(`${API_URL}/chat/threads/${threadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete thread");
      return res.json();
    },
    onSuccess: (_, deletedThreadId) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      if (deletedThreadId === currentThreadId) {
        onNewChat();
      }
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setDeletingId(threadId);
    deleteMutation.mutate(threadId);
  };

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  const threads = threadsData?.threads || [];
  const filteredThreads = threads.filter((thread) =>
    thread.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group threads by date
  const groupedThreads = groupThreadsByDate(filteredThreads);

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        {/* Logo and brand */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Chat</h1>
          </div>
        </div>

        {/* New chat button */}
        <Button 
          onClick={onNewChat} 
          className="w-full justify-start gap-2 bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-sidebar-border bg-sidebar py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground/70">
                Start a new chat to begin
              </p>
            )}
          </div>
        ) : (
          Object.entries(groupedThreads).map(([group, groupThreads]) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel className="px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupThreads.map((thread) => (
                    <SidebarMenuItem key={thread.id}>
                      <SidebarMenuButton
                        onClick={() => onThreadSelect(thread.id)}
                        isActive={thread.id === currentThreadId}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all",
                          thread.id === currentThreadId && "bg-sidebar-accent"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{thread.title || "New Chat"}</span>
                        {thread.id === currentThreadId && (
                          <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        onClick={(e) => handleDelete(e, thread.id)}
                        disabled={deletingId === thread.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2
                          className={cn(
                            "h-4 w-4 text-muted-foreground hover:text-destructive",
                            deletingId === thread.id && "animate-spin"
                          )}
                        />
                        <span className="sr-only">Delete</span>
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => router.push("/traces")}
              className="mx-2 rounded-lg"
            >
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span>View Traces</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <SidebarSeparator className="my-2" />
        
        {/* User profile section */}
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors">
          <UserAvatar 
            email={userEmail} 
            name={userName}
            image={userImage}
            size="sm" 
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {userName || userEmail?.split("@")[0] || "User"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {userEmail}
            </p>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function groupThreadsByDate(threads: Thread[]): Record<string, Thread[]> {
  const groups: Record<string, Thread[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  threads.forEach((thread) => {
    const threadDate = new Date(thread.updatedAt || thread.createdAt);
    let group: string;

    if (threadDate >= today) {
      group = "Today";
    } else if (threadDate >= yesterday) {
      group = "Yesterday";
    } else if (threadDate >= lastWeek) {
      group = "Last 7 days";
    } else if (threadDate >= lastMonth) {
      group = "Last 30 days";
    } else {
      group = "Older";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(thread);
  });

  return groups;
}
