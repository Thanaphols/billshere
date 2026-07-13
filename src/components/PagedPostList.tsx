"use client";

import React, { useState, useEffect, useRef } from "react";
import PostCard, { type PostCardData } from "@/components/PostCard";
import { loadMorePosts } from "@/actions/posts";

export default function PagedPostList({
  initialPosts,
  type,
  searchQuery = "",
  emptyText = "ยังไม่มีโพสในระบบ",
  emptyContent,
  status = "all",
}: {
  initialPosts: PostCardData[];
  type: "owned" | "tagged" | "search";
  searchQuery?: string;
  emptyText?: string;
  emptyContent?: React.ReactNode;
  status?: string;
}) {
  const [posts, setPosts] = useState<PostCardData[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length === 6);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when initialPosts or status changes
  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length === 6);
    setLoading(false);
  }, [initialPosts, status]);

  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          setLoading(true);
          try {
            const nextPosts = await loadMorePosts(type, posts.length, 6, searchQuery, status);
            if (nextPosts.length > 0) {
              setPosts((prev) => [...prev, ...nextPosts]);
            }
            if (nextPosts.length < 6) {
              setHasMore(false);
            }
          } catch (err) {
            console.error("Failed to load more posts:", err);
            setHasMore(false);
          } finally {
            setLoading(false);
          }
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [posts.length, hasMore, loading, type, searchQuery, status]);

  if (posts.length === 0) {
    return (
      emptyContent ?? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
          {emptyText}
        </p>
      )
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4 select-none">
          {loading ? (
            <div className="w-6 h-6 rounded-full border-2 border-muted border-t-brand animate-spin" />
          ) : (
            <span className="text-[10px] text-muted">เลื่อนลงเพื่อโหลดโพสเพิ่ม</span>
          )}
        </div>
      )}
    </div>
  );
}
