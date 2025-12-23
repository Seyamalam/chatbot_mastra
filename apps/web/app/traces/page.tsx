"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { 
  ArrowLeft, 
  MessageSquare, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  ChevronDown,
  Sparkles,
  Bot,
  Wrench,
  Cpu,
  LogOut,
  Activity,
  Layers,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Span {
  id: string;
  traceId: string;
  name: string;
  type: string;
  startTime: string;
  endTime?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  attributes?: Record<string, any>;
  errorInfo?: { message: string; details?: Record<string, any> };
  parentSpanId?: string;
  isRootSpan: boolean;
}

interface TraceInfo {
  traceId: string;
  name?: string;
  startTime: string;
  endTime?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}

interface Conversation {
  threadId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  traceCount: number;
  traces: TraceInfo[];
}

type ViewMode = "conversation" | "trace";

export default function TracesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>("conversation");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
  }, [session, isPending, router]);

  const { data: listData, isLoading: isLoadingList } = useQuery({
    queryKey: ["traces", viewMode],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/traces?groupBy=${viewMode}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!session,
    refetchInterval: 10000,
  });

  const { data: conversationData, isLoading: isLoadingConversation } = useQuery({
    queryKey: ["conversation-traces", selectedConversation],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/traces/conversation/${selectedConversation}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedConversation && viewMode === "conversation",
  });

  const { data: traceDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["trace", selectedTrace],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/traces/${selectedTrace}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trace");
      return res.json();
    },
    enabled: !!selectedTrace,
  });

  const handleSignOut = async () => {
    await signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  };

  const toggleSpan = (spanId: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  };

  if (isPending || isLoadingList) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-glow rounded-full" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full gradient-bg shadow-lg">
              <Activity className="h-8 w-8 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Loading traces...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const conversations: Conversation[] = listData?.conversations || [];
  const traces = listData?.traces || [];

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background/80 backdrop-blur-sm px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/chat")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">AI Traces</h1>
          </div>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
            <Button
              variant={viewMode === "conversation" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setViewMode("conversation"); setSelectedTrace(null); setSelectedConversation(null); }}
            >
              By Conversation
            </Button>
            <Button
              variant={viewMode === "trace" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setViewMode("trace"); setSelectedTrace(null); setSelectedConversation(null); }}
            >
              All Traces
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UserAvatar email={session.user?.email ?? undefined} name={session.user?.name ?? undefined} image={session.user?.image ?? undefined} size="sm" />
          <span className="text-sm text-muted-foreground hidden sm:block">{session.user?.email}</span>
          <ThemeToggle />
          <Button variant="ghost" size="icon-sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-72 border-r overflow-y-auto scrollbar-thin p-4 bg-muted/30">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            {viewMode === "conversation" ? "Conversations" : "Recent Traces"}
          </h2>
          {viewMode === "conversation" ? (
            conversations.length === 0 ? (
              <EmptyState icon={<MessageSquare />} text="No conversations yet" />
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <ConversationCard
                    key={conv.threadId}
                    conversation={conv}
                    isSelected={selectedConversation === conv.threadId}
                    onClick={() => { setSelectedConversation(conv.threadId); setSelectedTrace(null); }}
                  />
                ))}
              </div>
            )
          ) : (
            traces.length === 0 ? (
              <EmptyState icon={<Activity />} text="No traces yet" />
            ) : (
              <div className="space-y-2">
                {traces.map((trace: any) => (
                  <TraceCard
                    key={trace.traceId}
                    trace={trace}
                    isSelected={selectedTrace === trace.traceId}
                    onClick={() => setSelectedTrace(trace.traceId)}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Middle Panel - Conversation Traces */}
        {viewMode === "conversation" && (
          <div className="w-80 border-r overflow-y-auto scrollbar-thin p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              {selectedConversation ? "Traces" : "Select a conversation"}
            </h2>
            {isLoadingConversation ? (
              <LoadingSpinner />
            ) : conversationData?.traces ? (
              <div className="space-y-2">
                {conversationData.traces.map((trace: TraceInfo, index: number) => (
                  <TraceListItem
                    key={trace.traceId}
                    trace={trace}
                    index={index}
                    isSelected={selectedTrace === trace.traceId}
                    onClick={() => setSelectedTrace(trace.traceId)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a conversation to see traces.</p>
            )}
          </div>
        )}

        {/* Right Panel - Trace Detail */}
        <div className={cn("flex-1 overflow-y-auto scrollbar-thin p-6", !selectedTrace && "flex items-center justify-center")}>
          {selectedTrace ? (
            isLoadingDetail ? (
              <LoadingSpinner />
            ) : traceDetail?.trace ? (
              <TraceDetail trace={traceDetail.trace} expandedSpans={expandedSpans} toggleSpan={toggleSpan} />
            ) : (
              <EmptyState icon={<AlertCircle />} text="Trace not found" />
            )
          ) : (
            <EmptyState icon={<Layers />} text="Select a trace to view details" />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ConversationCard({ conversation, isSelected, onClick }: { conversation: Conversation; isSelected: boolean; onClick: () => void }) {
  return (
    <Card className={cn("cursor-pointer transition-all hover:shadow-md", isSelected && "border-primary ring-2 ring-primary/20")} onClick={onClick}>
      <CardContent className="p-3">
        <p className="font-medium text-sm truncate">{conversation.title}</p>
        <div className="flex items-center justify-between mt-2">
          <Badge variant="secondary" className="text-[10px]">{conversation.traceCount} traces</Badge>
          <span className="text-[10px] text-muted-foreground">{formatTime(conversation.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TraceCard({ trace, isSelected, onClick }: { trace: any; isSelected: boolean; onClick: () => void }) {
  return (
    <Card className={cn("cursor-pointer transition-all hover:shadow-md", isSelected && "border-primary ring-2 ring-primary/20")} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <SpanTypeIcon type={trace.name || "agent_run"} />
          <Badge variant="outline" className="text-[10px]">{trace.name || "agent_run"}</Badge>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground truncate">{trace.traceId}</p>
        <span className="text-[10px] text-muted-foreground">{formatTime(trace.startTime)}</span>
      </CardContent>
    </Card>
  );
}

function TraceListItem({ trace, index, isSelected, onClick }: { trace: TraceInfo; index: number; isSelected: boolean; onClick: () => void }) {
  return (
    <Card className={cn("cursor-pointer transition-all hover:shadow-md", isSelected && "border-primary ring-2 ring-primary/20")} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Badge className="bg-primary text-primary-foreground text-[10px]">#{index + 1}</Badge>
          <span className="text-[10px] text-muted-foreground">{formatTime(trace.startTime)}</span>
        </div>
        {trace.input && <p className="text-[11px] text-muted-foreground truncate">Q: {truncate(stringify(trace.input), 50)}</p>}
        {trace.output && <p className="text-[11px] truncate mt-1">A: {truncate(stringify(trace.output), 50)}</p>}
      </CardContent>
    </Card>
  );
}

function TraceDetail({ trace, expandedSpans, toggleSpan }: { trace: any; expandedSpans: Set<string>; toggleSpan: (id: string) => void }) {
  const spans = trace.spans || [trace];
  const rootSpans = spans.filter((s: Span) => s.isRootSpan || !s.parentSpanId);
  const childSpansMap = new Map<string, Span[]>();
  spans.forEach((span: Span) => {
    if (span.parentSpanId) {
      const children = childSpansMap.get(span.parentSpanId) || [];
      children.push(span);
      childSpansMap.set(span.parentSpanId, children);
    }
  });

  const renderSpan = (span: Span, depth: number = 0) => {
    const children = childSpansMap.get(span.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedSpans.has(span.id);

    return (
      <div key={span.id} style={{ marginLeft: depth * 16 }}>
        <Card className={cn("mb-2 transition-all", span.errorInfo && "border-destructive/50")}>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasChildren && (
                  <button onClick={() => toggleSpan(span.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
                <SpanTypeIcon type={span.type} />
                <CardTitle className="text-sm font-medium">{span.name}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{span.type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {span.errorInfo && <Badge variant="destructive" className="text-[10px]">Error</Badge>}
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {formatDuration(span.startTime, span.endTime)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <p className="text-[10px] font-mono text-muted-foreground">ID: {span.id}</p>
            {span.attributes && Object.keys(span.attributes).length > 0 && (
              <DataBlock title="Attributes" data={span.attributes} />
            )}
            {span.input && <DataBlock title="Input" data={span.input} />}
            {span.output && <DataBlock title="Output" data={span.output} />}
            {span.errorInfo && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs font-medium text-destructive mb-1">Error</p>
                <pre className="text-[11px] text-destructive/80 whitespace-pre-wrap">{span.errorInfo.message}</pre>
              </div>
            )}
          </CardContent>
        </Card>
        {isExpanded && children.map((child) => renderSpan(child, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Trace Details</h2>
        <p className="text-xs font-mono text-muted-foreground">{trace.traceId || trace.id}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={<Layers />} label="Total Spans" value={spans.length} />
        <StatCard icon={<Clock />} label="Duration" value={formatDuration(trace.startTime || spans[0]?.startTime, trace.endTime || spans[spans.length - 1]?.endTime)} />
        <StatCard icon={<AlertCircle />} label="Errors" value={spans.filter((s: Span) => s.errorInfo).length} variant={spans.some((s: Span) => s.errorInfo) ? "destructive" : "default"} />
      </div>

      <h3 className="text-sm font-medium mb-3">Spans</h3>
      {rootSpans.map((span: Span) => renderSpan(span, 0))}
    </div>
  );
}

function StatCard({ icon, label, value, variant = "default" }: { icon: React.ReactNode; label: string; value: string | number; variant?: "default" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-xl font-bold", variant === "destructive" && "text-destructive")}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DataBlock({ title, data }: { title: string; data: any }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground mb-1">{title}</p>
      <pre className="bg-muted rounded-lg p-3 text-[11px] overflow-x-auto max-h-32 scrollbar-thin">
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function SpanTypeIcon({ type }: { type: string }) {
  const iconClass = "h-4 w-4";
  switch (type) {
    case "agent_run": return <Bot className={cn(iconClass, "text-blue-500")} />;
    case "model_generation": return <Sparkles className={cn(iconClass, "text-purple-500")} />;
    case "tool_call": return <Wrench className={cn(iconClass, "text-green-500")} />;
    case "workflow_run": return <Cpu className={cn(iconClass, "text-orange-500")} />;
    default: return <Activity className={cn(iconClass, "text-gray-500")} />;
  }
}

function formatTime(time: string) {
  return new Date(time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: string, end?: string) {
  if (!end) return "In progress...";
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function stringify(data: any): string {
  if (typeof data === "string") return data;
  if (data?.text) return data.text;
  return JSON.stringify(data);
}
