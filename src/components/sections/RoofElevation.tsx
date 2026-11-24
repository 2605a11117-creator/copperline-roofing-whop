import { site } from '../../config/site';
import { lines } from '../../lib/format';

// A front elevation of a hip roof, annotated the way a roofer marks up a job:
// pitch symbol, roof size, and callouts for the parts of the roof system.
// Labels come from site.hero.drawing. On small screens the callouts become numbered
// markers with a legend under the drawing.

const EAVE_Y = 270;
const RIDGE_Y = 120;
const EAVE_LEFT = 60;
const EAVE_RIGHT = 596;
const RIDGE_LEFT = 218;
const RIDGE_RIGHT = 438;
const COURSE = 12;
const TAB = 28;
const GROUND_Y = 424;
const LABEL_X = 656;

const roofPoints = `${EAVE_LEFT},${EAVE_Y} ${RIDGE_LEFT},${RIDGE_Y} ${RIDGE_RIGHT},${RIDGE_Y} ${EAVE_RIGHT},${EAVE_Y}`;

const courses: number[] = [];
for (let y = EAVE_Y - COURSE; y > RIDGE_Y; y -= COURSE) courses.push(y);

// Shingle tabs: short vertical joints on each course, offset by half a tab on alternate rows.
const tabs: Array<{ x: number; y: number }> = [];
courses.forEach((y, row) => {
  for (let x = EAVE_LEFT + (row % 2 === 0 ? 0 : TAB / 2); x < EAVE_RIGHT; x += TAB) tabs.push({ x, y });
});

interface Callout {
  key: 'ridge' | 'flashing' | 'field' | 'eave';
  /** Leader line from the roof part to the label column. The first point is the part. */
  leader: Array<[number, number]>;
  labelY: number;
}

const CALLOUTS: Callout[] = [
  { key: 'ridge', leader: [[330, RIDGE_Y], [330, 70], [LABEL_X - 8, 70]], labelY: 74 },
  { key: 'flashing', leader: [[410, 172], [628, 140], [LABEL_X - 8, 140]], labelY: 144 },
  { key: 'field', leader: [[500, 222], [628, 206], [LABEL_X - 8, 206]], labelY: 210 },
  { key: 'eave', leader: [[584, EAVE_Y], [628, 280], [LABEL_X - 8, 280]], labelY: 284 },
];

export function RoofElevation() {
  const drawing = site.hero.drawing;
  const [rise, run] = drawing.pitch.match(/\d+/g) ?? ['8', '12'];
  const parts = CALLOUTS.map((callout) => drawing[callout.key].replace('\n', ' '));

  return (
    <figure className="elev">
      <div className="elev__frame">
        <svg className="elev__svg" viewBox="0 0 840 480" role="img" aria-labelledby="elev-title elev-desc">
          <title id="elev-title">Roof elevation drawing</title>
          <desc id="elev-desc">{`A hip roof marked with ${drawing.pitch}, ${drawing.size}, and ${parts.join(', ')}.`}</desc>
          <defs>
            <clipPath id="elev-roof-clip">
              <polygon points={roofPoints} />
            </clipPath>
          </defs>

          {/* House */}
          <line className="elev__ink elev__draw" x1="20" y1={GROUND_Y} x2="620" y2={GROUND_Y} pathLength={1} />
          <rect className="elev__wall elev__draw" x="98" y={EAVE_Y} width="460" height={GROUND_Y - EAVE_Y} pathLength={1} />
          <rect className="elev__window elev__draw" x="138" y="304" width="80" height="70" pathLength={1} />
          <rect className="elev__window elev__draw" x="438" y="304" width="80" height="70" pathLength={1} />
          <line className="elev__thin" x1="178" y1="304" x2="178" y2="374" />
          <line className="elev__thin" x1="478" y1="304" x2="478" y2="374" />
          <rect className="elev__door elev__draw" x="306" y="334" width="44" height={GROUND_Y - 334} pathLength={1} />

          {/* Roof plane with shingle courses */}
          <polygon className="elev__roof" points={roofPoints} />
          <g className="elev__shingles" clipPath="url(#elev-roof-clip)">
            {courses.map((y) => (
              <line key={`course-${y}`} x1={EAVE_LEFT} y1={y} x2={EAVE_RIGHT} y2={y} />
            ))}
            {tabs.map((tab) => (
              <line key={`tab-${tab.x}-${tab.y}`} x1={tab.x} y1={tab.y} x2={tab.x} y2={tab.y + COURSE} />
            ))}
          </g>
          <polygon className="elev__ink elev__draw" points={roofPoints} pathLength={1} />

          {/* Ridge cap, gutter and downspout */}
          <path className="elev__copper elev__copper--ridge elev__draw" d={`M${RIDGE_LEFT} ${RIDGE_Y} H${RIDGE_RIGHT}`} pathLength={1} />
          <path className="elev__ink elev__draw" d={`M${EAVE_LEFT - 4} ${EAVE_Y + 6} H${EAVE_RIGHT + 4}`} pathLength={1} />
          <path
            className="elev__ink elev__draw"
            d={`M566 ${EAVE_Y + 6} V${GROUND_Y - 8} Q566 ${GROUND_Y - 2} 574 ${GROUND_Y - 2} H586`}
            pathLength={1}
          />

          {/* Chimney in front of the ridge, with copper step flashing at its base */}
          <rect className="elev__chimney elev__draw" x="382" y="86" width="28" height="88" pathLength={1} />
          <line className="elev__ink" x1="378" y1="86" x2="414" y2="86" />
          <path className="elev__copper elev__draw" d="M378 174 H414" pathLength={1} />

          {/* Pitch symbol and overall size */}
          <g className="elev__notes">
            <path className="elev__thin" d="M70 156 H106 V132 Z" />
            <text className="elev__label elev__label--small" x="88" y="173" textAnchor="middle">
              {run}
            </text>
            <text className="elev__label elev__label--small" x="114" y="149">
              {rise}
            </text>
            <text className="elev__label" x="70" y="120">
              {drawing.pitch}
            </text>
            <path className="elev__thin" d={`M${EAVE_LEFT} 438 V454 M${EAVE_LEFT} 446 H${EAVE_RIGHT} M${EAVE_RIGHT} 438 V454`} />
            <text className="elev__label elev__label--dim" x={(EAVE_LEFT + EAVE_RIGHT) / 2} y="472" textAnchor="middle">
              {drawing.size}
            </text>
          </g>

          {/* Callouts with leader lines (wide screens) */}
          <g className="elev__callouts">
            {CALLOUTS.map((callout) => {
              const [px, py] = callout.leader[0];
              return (
                <g key={callout.key}>
                  <circle className="elev__dot" cx={px} cy={py} r="3.5" />
                  <polyline className="elev__leader" points={callout.leader.map((point) => point.join(',')).join(' ')} />
                  <text className="elev__label" x={LABEL_X} y={callout.labelY}>
                    {lines(drawing[callout.key]).map((line, index) => (
                      <tspan key={`${callout.key}-${index}`} x={LABEL_X} dy={index === 0 ? 0 : 17}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Numbered markers (small screens) */}
          <g className="elev__markers" aria-hidden="true">
            {CALLOUTS.map((callout, index) => {
              const [px, py] = callout.leader[0];
              return (
                <g key={callout.key}>
                  <circle className="elev__marker" cx={px} cy={py} r="15" />
                  <text className="elev__marker-text" x={px} y={py + 6} textAnchor="middle">
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <figcaption className="elev__legend">
        <ol>
          {parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
