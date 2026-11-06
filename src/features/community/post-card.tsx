import './posts.css';
import Link from 'next/link';
import { PostRowMenu } from './post-row-menu';
import { Images, ThumbsUp, MessageCircle, Eye } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { type PostDetail } from './post-model';
export type ParentingPost = {
  id: string;
  mine: boolean;
  title: string;
  body: string;
  area_label: string;
  photo_ids: string[];
  created_at: string;
  author_identity: PostDetail['author'];
  likes: number;
  views: number;
  comments: number;
};
export function PostCard({
  post,
  tag,
  time,
  locale,
  child,
  source,
}: {
  post: ParentingPost;
  tag: string;
  time: string;
  locale: Locale;
  child: string;
  source: 'neighborhood';
}) {
  const ko = locale === 'ko';
  return (
    <article className="community-list-item">
      <PostRowMenu
        mine={post.mine}
        id={post.id}
        child={child}
        source={source}
        locale={locale}
      />
      <Link
        className="community-post-open"
        aria-label={post.title}
        href={`/${locale}/community/posts/${post.id}?${new URLSearchParams({ child, source })}`}
      >
        <span className="community-post-tag">{tag}</span>
        <span
          className={`community-post-summary${post.photo_ids.length ? ' has-photo' : ''}`}
        >
          <span className="community-post-text">
            <strong>{post.title}</strong>
            <span className="post-body">{post.body}</span>
          </span>
          {!!post.photo_ids.length && (
            <span className="community-post-thumbnail">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/community/post-photos/${post.photo_ids[0]}?size=480`}
                alt={ko ? '게시글 사진' : 'Post photo'}
                loading="lazy"
                width={104}
                height={104}
              />
              {post.photo_ids.length > 1 && (
                <span>
                  <Images size={11} />
                  {post.photo_ids.length}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="community-post-meta">
          <span className="post-residence">{post.area_label}</span>
          <time dateTime={post.created_at}>{time}</time>
          <span className="community-post-counts">
            <span
              aria-label={ko ? `조회 ${post.views}` : `${post.views} views`}
            >
              <Eye size={12} />
              {post.views}
            </span>
            {!!post.likes && (
              <span>
                <ThumbsUp size={12} />
                {post.likes}
              </span>
            )}
            {!!post.comments && (
              <span>
                <MessageCircle size={12} />
                {post.comments}
              </span>
            )}
          </span>
        </span>
      </Link>
    </article>
  );
}
