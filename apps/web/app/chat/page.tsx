"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MessageList, type Message } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { Sparkles, Menu } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    searchParams.get("thread")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    const threadFromUrl = searchParams.get("thread");
    if (threadFromUrl !== currentThreadId) {
      setCurrentThreadId(threadFromUrl);
      if (!threadFromUrl) {
        setMessages([]);
      }
    }
  }, [searchParams, currentThreadId]);

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["chat-history", currentThreadId],
    queryFn: async () => {
      if (!currentThreadId) return { messages: [] };
      const res = await fetch(
        `${API_URL}/chat/history?threadId=${currentThreadId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!session && !!currentThreadId,
    staleTime: 0,
  });

  // Track if we're in the middle of sending a message to avoid overwriting local state
  const isSendingRef = useRef(false);

  useEffect(() => {
    // Don't overwrite messages if we're currently sending (to preserve optimistic updates)
    if (historyData?.messages && !isSendingRef.current) {
      setMessages(
        historyData.messages.map((msg: any) => ({
          id: msg.id || crypto.randomUUID(),
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : msg.content?.map((p: any) => p.text || "").join("") || "",
          createdAt: msg.createdAt,
        }))
      );
    }
  }, [historyData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleThreadSelect = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setMessages([]);
    router.push(`/chat?thread=${threadId}`);
  }, [router]);

  const handleNewChat = useCallback(() => {
    setCurrentThreadId(null);
    setMessages([]);
    router.push("/chat");
  }, [router]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      isSendingRef.current = true;
      
      let threadId = currentThreadId;
      if (!threadId) {
        const res = await fetch(`${API_URL}/chat/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title: content.slice(0, 50) }),
        });
        if (!res.ok) {
          isSendingRef.current = false;
          return;
        }
        const data = await res.json();
        threadId = data.thread.id;
        setCurrentThreadId(threadId);
        router.push(`/chat?thread=${threadId}`);
        queryClient.invalidateQueries({ queryKey: ["threads"] });
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      try {
        const response = await fetch(`${API_URL}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: content, threadId }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantId = crypto.randomUUID();

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString() },
        ]);

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("event:") || !line.trim()) continue;
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const text = JSON.parse(data);
                if (typeof text === "string" && /^[a-f0-9]{32}$/i.test(text)) continue;
                assistantContent += text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: assistantContent } : msg
                  )
                );
              } catch {}
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ["threads"] });
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: "Sorry, something went wrong.", createdAt: new Date().toISOString() },
        ]);
      } finally {
        setIsStreaming(false);
        isSendingRef.current = false;
      }
    },
    [isStreaming, currentThreadId, router, queryClient]
  );

  if (isPending) return <LoadingScreen />;
  if (!session) return null;

  return (
    <SidebarProvider>
      <ChatSidebar
        currentThreadId={currentThreadId}
        onThreadSelect={handleThreadSelect}
        onNewChat={handleNewChat}
        userEmail={session.user?.email ?? undefined}
        userName={session.user?.name ?? undefined}
        userImage={session.user?.image ?? undefined}
      />
      <SidebarInset className="flex flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4 sticky top-0 z-10">
          <SidebarTrigger className="-ml-1">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-medium">{currentThreadId ? "Chat" : "New conversation"}</h2>
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {isLoadingHistory && currentThreadId ? (
              <div className="flex items-center justify-center p-8"><LoadingSpinner /></div>
            ) : (
              <>
                <MessageList messages={messages} isStreaming={isStreaming} userEmail={session.user?.email ?? undefined} userName={session.user?.name ?? undefined} userImage={session.user?.image ?? undefined} />
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <MessageInput onSend={handleSendMessage} disabled={isStreaming} placeholder={currentThreadId ? "Type your message..." : "Start a new conversation..."} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-glow rounded-full" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg">
            <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-sm text-muted-foreground">Loading messages...</span>
    </div>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<LoadingScreen />}><ChatContent /></Suspense>;
}
