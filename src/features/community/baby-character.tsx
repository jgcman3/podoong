import { memo, useId } from 'react';
import type { BabyPose } from './friend-world-model';

function BabyCharacterDrawing({
  sex,
  pose,
  variant = 0,
  own = false,
}: {
  sex: string;
  pose: BabyPose;
  variant?: number;
  own?: boolean;
}) {
  const id = useId();
  const female = sex === 'female';
  const outfits = [
    '#e9947d',
    '#79ad9a',
    '#d5b66e',
    '#93a7d0',
    '#be9ac5',
    '#84b6c4',
  ];
  const outfitColor = outfits[(variant + (female ? 0 : 3)) % outfits.length];
  const outfit = `url(#${id}-outfit)`;
  const skinColor = ['#ffdab8', '#f5c59e', '#d9a57d', '#edbd96'][variant % 4];
  const skin = `url(#${id}-skin)`;
  const face = (cx: number, cy: number, r = 23) => (
    <g>
      <ellipse cx={cx - r} cy={cy + 2} rx="5" ry="7" fill={skin} />
      <ellipse cx={cx + r} cy={cy + 2} rx="5" ry="7" fill={skin} />
      {female && (
        <ellipse
          cx={cx}
          cy={cy - 3}
          rx={r + 3}
          ry={r + 2}
          fill={`url(#${id}-hair)`}
        />
      )}
      <circle cx={cx} cy={cy} r={r} fill={skin} />
      <ellipse
        cx={cx - 7}
        cy={cy - 9}
        rx="10"
        ry="6"
        fill="#fff3df"
        opacity=".3"
      />
      <path
        d={`M${cx - r + 3} ${cy - 10} Q${cx - 11} ${cy - r - 8} ${cx + 3} ${cy - r + 1} Q${cx + 15} ${cy - r + 6} ${cx + r - 2} ${cy - 8} Q${cx + 9} ${cy - 13} ${cx + 4} ${cy - 19} Q${cx - 5} ${cy - 8} ${cx - r + 3} ${cy - 10}`}
        fill={`url(#${id}-hair)`}
      />
      {female ? (
        <g fill="#e98595">
          <path d={`M${cx + 10} ${cy - r + 4} l-9 -7 v14z`} />
          <path d={`M${cx + 10} ${cy - r + 4} l9 -7 v14z`} />
          <circle cx={cx + 10} cy={cy - r + 4} r="3" fill="#ffd1d7" />
        </g>
      ) : (
        <path
          d={`M${cx - 4} ${cy - r + 2} q-7 -12 4 -11 q9 3 1 9`}
          fill="none"
          stroke="#775446"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      <ellipse
        cx={cx - 12}
        cy={cy + 6}
        rx="5.5"
        ry="3.2"
        fill="#f4a49d"
        opacity=".65"
      />
      <ellipse
        cx={cx + 12}
        cy={cy + 6}
        rx="5.5"
        ry="3.2"
        fill="#f4a49d"
        opacity=".65"
      />
      <ellipse cx={cx - 8} cy={cy + 1} rx="3.7" ry="4.8" fill="#3d2b25" />
      <ellipse cx={cx + 8} cy={cy + 1} rx="3.7" ry="4.8" fill="#3d2b25" />
      <circle cx={cx - 8.7} cy={cy - 0.2} r="1.3" fill="white" />
      <circle cx={cx + 7.3} cy={cy - 0.2} r="1.3" fill="white" />
      <ellipse
        cx={cx}
        cy={cy + 7}
        rx="2.7"
        ry="2"
        fill="#dca088"
        opacity=".65"
      />
      <path
        d={`M${cx - 4} ${cy + 10} q4 5 8 0`}
        fill="none"
        stroke="#b16757"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
  return (
    <svg
      className={`baby-character pose-${pose}${own ? ' is-own' : ''}`}
      viewBox="0 0 120 140"
      fill="none"
      aria-hidden="true"
      data-pose={pose}
      data-sex={sex}
    >
      <defs>
        <radialGradient id={`${id}-skin`} cx="32%" cy="25%" r="78%">
          <stop stopColor="#fff0dc" />
          <stop offset=".55" stopColor={skinColor} />
          <stop offset="1" stopColor="#cf9277" />
        </radialGradient>
        <radialGradient id={`${id}-outfit`} cx="28%" cy="18%" r="90%">
          <stop stopColor="#fffaf1" />
          <stop offset=".35" stopColor={outfitColor} />
          <stop offset="1" stopColor={outfitColor} stopOpacity=".82" />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x2=".8" y2="1">
          <stop stopColor="#9b7056" />
          <stop offset=".45" stopColor="#684534" />
          <stop offset="1" stopColor="#382b26" />
        </linearGradient>
      </defs>
      <ellipse
        cx="60"
        cy="130"
        rx={pose === 'lying' || pose === 'crawling' ? 43 : 29}
        ry="6"
        fill="#728c65"
        opacity=".16"
      />
      {pose === 'standing' && (
        <g>
          <path
            d="M47 100v22M72 100v22"
            stroke={skin}
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M40 125h14M67 125h15"
            stroke={outfit}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M41 69 24 83M78 69l15-17"
            stroke={skin}
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d={
              female
                ? 'M39 68q21-12 42 0l7 42q-28 10-56 0z'
                : 'M39 68q21-12 42 0l-4 39H43z'
            }
            fill={outfit}
          />
          <path d="M47 67q12 15 26 0" fill="#fff9ee" />
          <circle cx="59" cy="87" r="5" fill="#fff9ee" opacity=".8" />
          {face(60, 43)}
        </g>
      )}
      {pose === 'sitting' && (
        <g>
          <ellipse cx="60" cy="123" rx="37" ry="9" fill="#f3d69b" />
          <path
            d="M48 107 30 117M71 107l19 10"
            stroke={skin}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M38 82 27 103M81 82l11 21"
            stroke={skin}
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path d="M39 79q21-13 42 0l-4 29q-17 15-34 0z" fill={outfit} />
          <path d="M48 77q11 15 24 0" fill="#fff9ee" />
          {face(60, 56)}
        </g>
      )}
      {pose === 'crawling' && (
        <g>
          <path
            d="M39 98 29 121M76 104l13 17"
            stroke={skin}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path d="M39 94q14-20 38-6l17 17-22 13-32-11z" fill={outfit} />
          <path
            d="m76 112 4 11h18"
            stroke={outfit}
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M42 99 47 121"
            stroke={skin}
            strokeWidth="11"
            strokeLinecap="round"
          />
          {face(37, 76, 24)}
        </g>
      )}
      {pose === 'lying' && (
        <g>
          <rect
            x="9"
            y="93"
            width="101"
            height="35"
            rx="17"
            fill="#e5c994"
            transform="rotate(-8 60 110)"
          />
          <path d="m43 104 38-14q26-3 25 15-6 22-44 18z" fill={outfit} />
          <path
            d="m74 108 23 5"
            stroke="#fff9ee"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".8"
          />
          <path
            d="m50 104 17-13"
            stroke={skin}
            strokeWidth="10"
            strokeLinecap="round"
          />
          {face(31, 91, 23)}
        </g>
      )}
    </svg>
  );
}

export const BabyCharacter = memo(BabyCharacterDrawing);
