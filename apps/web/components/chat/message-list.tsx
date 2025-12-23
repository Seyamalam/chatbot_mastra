"use client";

import { cn } from "@/lib/utils";
import { BotAvatar, UserAvatar } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  userEmail?: string;
  userName?: string;
  userImage?: string;
}

export function MessageList({ 
  messages, 
  isStreaming, 
  userEmail,
  userName,
  userImage 
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-glow rounded-full" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg">
            <Sparkles className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">Start a conversation</h3>
          <p className="max-w-sm text-muted-foreground">
            Ask me anything! I can help with your Google contacts, emails, and more.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[
            "Show my recent emails",
            "Find contact info for...",
            "Summarize my inbox",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/50 hover:bg-accent hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-4">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLast={index === messages.length - 1}
          userEmail={userEmail}
          userName={userName}
          userImage={userImage}
        />
      ))}
      {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
        <TypingIndicator />
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isLast,
  userEmail,
  userName,
  userImage,
}: {
  message: Message;
  isLast: boolean;
  userEmail?: string;
  userName?: string;
  userImage?: string;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-message-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 pt-1">
        {isUser ? (
          <UserAvatar 
            email={userEmail} 
            name={userName}
            image={userImage}
            size="sm" 
          />
        ) : (
          <BotAvatar size="sm" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 shadow-sm",
            isUser
              ? "rounded-tr-md bg-primary text-primary-foreground"
              : "rounded-tl-md bg-card border border-border"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {message.createdAt && (
          <span className="px-1 text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-message-in">
      <div className="flex-shrink-0 pt-1">
        <BotAvatar size="sm" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-card border border-border px-4 py-3 shadow-sm">
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
