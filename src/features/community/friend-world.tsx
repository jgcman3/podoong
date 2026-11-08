'use client';
import './playground.css';
import dynamic from 'next/dynamic';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Heart, MapPin, Users, LocateFixed } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { BabyCharacter } from './baby-character';
import { FriendInbox } from './friend-inbox';
import {
  babyPose,
  playgroundAgeLabel,
  depthScale,
  stableHash,
  type Playground,
  type WorldMember,
} from './friend-world-model';

const PostShareSheet = dynamic(
  () => import('./post-share-sheet').then((module) => module.PostShareSheet),
  { ssr: false },
);

function SideScenery() {
  return (
    <div className="world-distant" aria-hidden="true">
      <div className="side-cloud side-cloud-left" />
      <div className="side-cloud side-cloud-right" />
    </div>
  );
}
const MemoScenery = memo(SideScenery);
function Ground({ width }: { width: number }) {
  return (
    <svg
      className="world-ground"
      width={width}
      viewBox={`0 0 ${width} 520`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="side-lawn"
          width="180"
          height="110"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m25 30 3-6 3 6M125 89l3-6 3 6"
            className="side-grass"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="75" cy="70" r="2" className="side-flower" />
        </pattern>
      </defs>
      <rect y="125" width={width} height="395" className="side-lawn" />
      <rect y="140" width={width} height="380" fill="url(#side-lawn)" />
      <ellipse
        cx={width / 2}
        cy="480"
        rx={width}
        ry="90"
        className="side-path"
      />
    </svg>
  );
}
const MemoGround = memo(Ground);
export function FriendWorld({
  initial,
  childId,
  locale,
  neighborhood,
  statusEditor,
}: {
  initial: Playground;
  childId: string;
  locale: Locale;
  neighborhood: string;
  statusEditor?: ReactNode;
}) {
  const ko = locale === 'ko';
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const inviteButton = useRef<HTMLButtonElement>(null);
  const statusEditorRef = useRef<HTMLDivElement>(null);
  const statusDay = useRef(initial.day);
  const [world, setWorld] = useState(initial),
    [members, setMembers] = useState(initial.members),
    [width, setWidth] = useState(360),
    [camera, setCamera] = useState(initial.own.x),
    [selected, setSelected] = useState(initial.own.id);
  useEffect(() => {
    if (statusDay.current === world.day) return;
    statusDay.current = world.day;
    const input = statusEditorRef.current?.querySelector<HTMLInputElement>(
      'input[name="status"]',
    );
    if (input) input.value = world.own.status;
  }, [world.day, world.own.status]);
  const viewport = useRef<HTMLDivElement>(null),
    worldRef = useRef(initial),
    loaded = useRef({ left: initial.left, right: initial.right }),
    drag = useRef<{
      start: number;
      scroll: number;
      pointer: number;
      moved: boolean;
    } | null>(null),
    suppressClick = useRef(false);
  const [reaction, setReaction] = useState<{
    friend: string;
    kind: 'wave' | 'heart' | 'comfort';
    message: string;
  }>();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const sending = useRef(false),
    lastTap = useRef<{ id: string; time: number } | null>(null);
  useEffect(() => {
    if (!reaction) return;
    const timeout = setTimeout(() => setReaction(undefined), 2600);
    return () => clearTimeout(timeout);
  }, [reaction]);
  async function sendReaction(
    person: WorldMember,
    kind: 'wave' | 'heart' | 'comfort',
  ) {
    const key = `${worldRef.current.day}:${person.id}:${kind}`;
    if (sending.current || sent.has(key)) return;
    sending.current = true;
    try {
      const response = await fetch('/api/community/playground/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child: childId,
          friend: person.id,
          kind,
          locale,
        }),
      });
      if (!response.ok) throw Error('Unavailable');
      setSent((previous) => new Set([...previous, key]));
      setReaction({
        friend: person.id,
        kind,
        message: ko
          ? kind === 'wave'
            ? '인사했어요!'
            : kind === 'heart'
              ? '하트를 보냈어요!'
              : '토닥토닥, 위로를 보냈어요!'
          : kind === 'wave'
            ? 'Hello!'
            : kind === 'heart'
              ? 'Heart sent!'
              : 'A little comfort sent!',
      });
    } catch {
      setReaction({
        friend: person.id,
        kind,
        message: ko ? '다시 보내주세요' : 'Please try again',
      });
    } finally {
      sending.current = false;
    }
  }
  const canvasWidth = world.width + width;
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    let active = true,
      frame = 0,
      debounce: ReturnType<typeof setTimeout> | undefined,
      midnight: ReturnType<typeof setTimeout> | undefined,
      controller: AbortController | undefined,
      sequence = 0,
      positioned = false;
    function armExpiry() {
      clearTimeout(midnight);
      midnight = setTimeout(
        () => {
          if (!document.hidden) void load(true);
        },
        Math.max(
          500,
          Math.min(
            2147483000,
            Date.parse(worldRef.current.expires_at) - Date.now() + 100,
          ),
        ),
      );
    }
    async function load(force = false) {
      if (!active || document.hidden) return;
      const current = worldRef.current,
        center = el!.scrollLeft + current.min_x,
        w = el!.clientWidth;
      if (
        !force &&
        Math.max(current.min_x, center - w / 2 - 120) >= loaded.current.left &&
        Math.min(current.max_x, center + w / 2 + 120) <= loaded.current.right
      )
        return;
      const left = Math.floor(Math.max(current.min_x, center - w / 2 - 650)),
        right = Math.ceil(Math.min(current.max_x, center + w / 2 + 650));
      const request = ++sequence;
      controller?.abort();
      controller = new AbortController();
      try {
        const url = new URL('/api/community/playground', location.origin);
        url.search = new URLSearchParams({
          child: childId,
          locale,
          left: String(left),
          right: String(right),
          day: current.day,
        }).toString();
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!active || request !== sequence || !result.ok) return;
        const next = result.world as Playground,
          changedDay = next.day !== current.day,
          shift = current.min_x - next.min_x;
        worldRef.current = next;
        loaded.current = { left: next.left, right: next.right };
        setWorld(next);
        setMembers((previous) => {
          const kept = changedDay
            ? []
            : previous.filter((m) => m.x < next.left || m.x > next.right);
          const merged = new Map(
            [...kept, ...next.members].map((m) => [m.id, m]),
          );
          return [...merged.values()].filter(
            (m) => Math.abs(m.x - (changedDay ? next.own.x : center)) < 4000,
          );
        });
        if (changedDay) {
          setSelected(next.own.id);
          setSent(new Set());
          setReaction(undefined);
        }
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (!active) return;
          el!.scrollLeft = changedDay
            ? next.own.x - next.min_x
            : el!.scrollLeft + shift;
          setCamera(el!.scrollLeft + next.min_x);
        });
        armExpiry();
      } catch {
        /* Retain the current room during a transient network failure. */
      }
    }
    function scrolled() {
      setCamera(el!.scrollLeft + worldRef.current.min_x);
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 180);
    }
    function resumed() {
      if (!document.hidden) void load(true);
    }
    const resize = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (!measured) return;
      setWidth(measured);
      if (!positioned) {
        el!.scrollLeft = worldRef.current.own.x - worldRef.current.min_x;
        positioned = true;
      }
    });
    resize.observe(el);
    el.addEventListener('scroll', scrolled, { passive: true });
    document.addEventListener('visibilitychange', resumed);
    armExpiry();
    const polling = setInterval(() => void load(true), 60_000);
    return () => {
      active = false;
      controller?.abort();
      resize.disconnect();
      clearTimeout(debounce);
      clearTimeout(midnight);
      clearInterval(polling);
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', scrolled);
      document.removeEventListener('visibilitychange', resumed);
    };
  }, [childId, locale]);
  const visible = useMemo(
    () => members.filter((m) => Math.abs(m.x - camera) < width / 2 + 170),
    [members, camera, width],
  );
  function move(center: number) {
    viewport.current?.scrollTo({
      left: center - worldRef.current.min_x,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }
  function player(person: WorldMember, mine = false) {
    const active = selected === person.id;
    const ageLabel = playgroundAgeLabel(person.age_days, world.day, locale);
    const style = {
      left: width / 2 + person.x - world.min_x,
      top: `${(person.y / world.height) * 100}%`,
      zIndex: active ? 900 : Math.round(person.y),
      '--baby-scale': depthScale(person.y) * (active ? 1.22 : 1),
    } as CSSProperties;
    return (
      <div
        key={person.id}
        className={`world-player-group${active ? ' is-selected' : ''}`}
        style={style}
      >
        <button
          type="button"
          className={`world-player${mine ? ' world-player-own' : ''}${active ? ' is-selected' : ''}`}
          onClick={() => {
            setSelected(person.id);
            const now = Date.now(),
              previous = lastTap.current;
            if (
              !mine &&
              previous?.id === person.id &&
              now - previous.time < 400
            ) {
              lastTap.current = null;
              void sendReaction(person, 'wave');
            } else {
              lastTap.current = { id: person.id, time: now };
              // Keep the target still so the second tap lands on the same child.
            }
          }}
          onDoubleClick={() => {
            if (!mine) void sendReaction(person, 'wave');
          }}
          aria-pressed={active}
          aria-label={`${person.nickname}, ${ageLabel}${person.status ? ', ' + person.status : ''}`}
        >
          {person.status && (
            <span className={`world-speech${mine ? ' world-speech-own' : ''}`}>
              {person.status}
            </span>
          )}
          <BabyCharacter
            sex={person.sex}
            pose={babyPose(person.age_days)}
            own={mine}
            variant={mine ? 0 : stableHash(person.id) % 6}
          />
          <span className="world-name" title={person.nickname}>
            {person.child_name}
          </span>
          <span className="world-family-name" title={person.family_name}>
            {person.family_name}
          </span>
          <span className="world-age">{ageLabel}</span>
        </button>
        {active && !mine && (
          <div
            className={`world-reaction-actions${person.x - camera > width / 2 - 100 ? ' actions-left' : ''}`}
            aria-label={ko ? '친구에게 마음 보내기' : 'Send a little love'}
          >
            <button
              type="button"
              aria-label={ko ? '인사 보내기' : 'Wave hello'}
              disabled={sent.has(`${world.day}:${person.id}:wave`)}
              onClick={() => void sendReaction(person, 'wave')}
            >
              👋
            </button>
            <button
              type="button"
              aria-label={ko ? '하트 보내기' : 'Send a heart'}
              disabled={sent.has(`${world.day}:${person.id}:heart`)}
              onClick={() => void sendReaction(person, 'heart')}
            >
              <Heart size={16} fill="currentColor" />
            </button>
            <button
              type="button"
              aria-label={ko ? '위로 보내기' : 'Send comfort'}
              disabled={sent.has(`${world.day}:${person.id}:comfort`)}
              onClick={() => void sendReaction(person, 'comfort')}
            >
              🤗
            </button>
          </div>
        )}
        {reaction?.friend === person.id && (
          <span className="world-reaction-feedback" role="status">
            <span aria-hidden="true">
              {reaction.kind === 'wave'
                ? '👋'
                : reaction.kind === 'heart'
                  ? '💗'
                  : '🤗'}
            </span>
            {reaction.message}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="friend-world-section">
      <header className="friend-world-heading">
        <span className="world-eyebrow">
          <MapPin size={13} />
          {neighborhood || (ko ? '우리 동네' : 'Neighborhood')}
        </span>
        <span className="world-presence">
          <Users size={14} />
          {ko ? `출석 ${world.population}명` : `${world.population} here today`}
        </span>
      </header>
      {world.first_family && (
        <aside className="world-welcome">
          <div>
            <strong>
              {ko ? '우리 동네 첫 가족이에요' : 'You’re the first family here'}
            </strong>
            <p>
              {ko
                ? '가까이 사는 육아 친구를 초대해 함께 만나요.'
                : 'Invite a parenting friend nearby to join you.'}
            </p>
          </div>
          <button
            ref={inviteButton}
            type="button"
            className="button secondary"
            onClick={() =>
              setInviteUrl(
                new URL(`/${locale}/intro`, window.location.origin).href,
              )
            }
          >
            {ko ? '친구 초대하기' : 'Invite a friend'}
          </button>
        </aside>
      )}
      {inviteUrl && (
        <PostShareSheet
          usage="introduction"
          locale={locale}
          url={inviteUrl}
          title={
            ko
              ? '우리 동네 육아 친구로 만나요 · 포둥'
              : 'Meet your parenting neighbors · podoong'
          }
          heading={ko ? '친구 초대하기' : 'Invite a friend'}
          text={
            ko
              ? '포둥에서 육아 기록을 남기고 우리 동네 놀이터에서도 함께 만나요!'
              : 'Keep care records on podoong and meet in our neighborhood playground!'
          }
          close={() => {
            setInviteUrl(null);
            inviteButton.current?.focus();
          }}
        />
      )}
      <div className="friend-world side-world">
        <MemoScenery />
        <div
          className="world-viewport"
          ref={viewport}
          tabIndex={0}
          role="region"
          aria-label={
            ko
              ? '동네 아기들의 가상 놀이터'
              : 'A virtual neighborhood playground'
          }
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            suppressClick.current = false;
            drag.current = {
              start: event.clientX,
              scroll: viewport.current?.scrollLeft ?? 0,
              pointer: event.pointerId,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (!d || d.pointer !== event.pointerId) return;
            const dx = event.clientX - d.start;
            if (Math.abs(dx) > 5) {
              d.moved = true;
              suppressClick.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.scrollLeft = d.scroll - dx;
            }
          }}
          onPointerUp={(event) => {
            const d = drag.current;
            if (d?.pointer === event.pointerId) {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              drag.current = null;
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Home') {
              event.preventDefault();
              move(world.own.x);
            }
          }}
        >
          <div className="world-canvas" style={{ width: canvasWidth }}>
            <MemoGround width={canvasWidth} />
            {visible.map((person) => player(person))}
            {player(world.own, true)}
          </div>
        </div>
        <div className="world-status-editor" ref={statusEditorRef}>
          {statusEditor}
          <button
            type="button"
            className="world-return-own"
            aria-label={ko ? '우리 아이로 돌아가기' : 'Return to my child'}
            onClick={() => {
              setSelected(world.own.id);
              lastTap.current = null;
              move(world.own.x);
            }}
          >
            <LocateFixed size={18} />
          </button>
          <FriendInbox
            key={`${childId}:${world.day}`}
            childId={childId}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
