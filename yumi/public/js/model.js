/* What the app knows about the family, worked out from the synced data. */
import { Store, esc, ymd, parseYmd, addDays, today, DOWL, startOfWeek } from './core.js';

export const S = {
  boot: null,        // from /api/boot
  me: null,          // signed-in person { id, name, role, hasCode }
  mode: 'door',      // door | room | family | dad
  tab: 'today',      // current tab inside the mode
  sub: null,         // a sub-page (e.g. More > Planner)
  ui: {},            // little bits of screen state
};

export const ACCENTS = { pink: '#EC3D7C', lilac: '#8B5BE6', mint: '#17A97E', sun: '#EE9A0A', ocean: '#2A86DD' };
export const ACCENT_SOFT = { pink: '#FFE1EC', lilac: '#EFE5FF', mint: '#D3F2E4', sun: '#FFF1C7', ocean: '#DAEBFF' };
export const BUDDIES = [
  { id: 'koko', name: 'Koko', what: 'Koala · calm and kind', e: '🐨' },
  { id: 'cheri', name: 'Cheri', what: 'Cherry · cheeky and bright', e: '🍒' },
  { id: 'luna', name: 'Luna', what: 'Bunny · soft and brave', e: '🐰' },
  { id: 'daisy', name: 'Daisy', what: 'Pup · bouncy and silly', e: '🐶' },
];
export const THEMES = [['classic', 'Classic'], ['kitty', 'Kitty'], ['leopard', 'Leopard'], ['glass', 'Glass']];
export const MOODS = [
  { id: 'happy', e: '😄', t: 'Happy', q: 'What made you smile?' },
  { id: 'excited', e: '🤩', t: 'Excited', q: 'What are you excited about?' },
  { id: 'calm', e: '😌', t: 'Calm', q: 'What feels nice right now?' },
  { id: 'silly', e: '🤪', t: 'Silly', q: "What's the silliest thing today?" },
  { id: 'tired', e: '😴', t: 'Tired', q: 'What wore you out?' },
  { id: 'worried', e: '😟', t: 'Worried', q: "What's on your mind?" },
  { id: 'sad', e: '😢', t: 'Sad', q: 'Want to tell us what happened?' },
  { id: 'grumpy', e: '😤', t: 'Grumpy', q: 'What made you grumpy?' },
];
export const HARD_MOODS = ['worried', 'sad', 'grumpy'];
export const FOODS = [
  { id: 'tacos', t: 'Tacos' }, { id: 'fruit', t: 'Fruit' }, { id: 'icecream', t: 'Ice cream' },
  { id: 'pancakes', t: 'Pancakes' }, { id: 'brownies', t: 'Brownies' }, { id: 'surprise', t: 'Surprise me' },
];
export const SLOTS = [
  { id: 'morning', t: 'Morning', e: '☀️' }, { id: 'after', t: 'After school', e: '🎒' }, { id: 'bed', t: 'Bedtime', e: '🌙' },
];
export const STARTER_ROUTINE = [
  ['morning', '🛏️', 'Make my bed'], ['morning', '👕', 'Get dressed'], ['morning', '🥣', 'Eat breakfast'], ['morning', '🪥', 'Brush teeth'], ['morning', '🎒', 'Pack school bag'],
  ['after', '🥪', 'Unpack lunchbox'], ['after', '📖', 'Reading or homework'], ['after', '🧹', 'Tidy my room'],
  ['bed', '🛁', 'Bath or shower'], ['bed', '👗', "Lay out tomorrow's clothes"], ['bed', '🪥', 'Brush teeth'], ['bed', '📚', 'Story time'],
];
export const STAR_REASONS = ['Helped out', 'Kind to sister', 'Tidied up', 'Brave', 'Listened first time', 'Great effort', 'Homework done'];
export const STRIKE_REASONS = ['Not listening', 'Unkind words', "Didn't tidy up", 'Screen time over'];
export const JOURNAL_PROMPTS = ['The best part of today was…', "Something I'm proud of is…", 'If I had a superpower it would be…', 'Three things that made me smile…', 'Something I want to try is…', 'My favourite thing about my sister is…', 'A dream I had…', 'If I planned the perfect day…'];
export const STICKERS = ['⭐', '💖', '🌈', '🦄', '🐨', '🌸', '🦋', '🍓', '🎀', '🌙', '☀️', '🐶'];
export const WISH_EMOJI = ['🎁', '🧸', '🎨', '📚', '🎮', '👟', '🎧', '🦄', '💄', '🛼', '🧁', '🐶'];
export const EVENT_EMOJI = ['🎒', '⚽', '🎂', '🏊', '🎨', '🩺', '🎉', '🚗', '🩰', '🎬', '🏖️', '👵'];
export const COVERS = ['#EC3D7C', '#8B5BE6', '#2A86DD', '#17A97E', '#EE9A0A', '#1D1720'];
export const PLAN_COLORS = ['#EC3D7C', '#2F6BE8', '#17A97E', '#FFB81F', '#8D55E0'];
export const DEFAULT_IDEAS = [
  { e: '📚', t: 'Library adventure', d: 'Everyone picks three books to borrow. Free and perfect on rainy days.', tags: ['out', 'rainy', 'free'] },
  { e: '🏰', t: 'Blanket fort movie night', d: 'Build the biggest fort ever, then watch a movie inside it.', tags: ['home', 'rainy', 'free'] },
  { e: '🥞', t: 'Pancake art breakfast', d: 'Make pancakes shaped like animals, letters and hearts.', tags: ['home', 'dad'] },
  { e: '💃', t: 'Living room dance party', d: 'Everyone picks three songs. Lights down, disco on.', tags: ['home', 'rainy', 'free'] },
  { e: '🧁', t: 'Bake and decorate cupcakes', d: 'Bake a batch and go wild with the sprinkles.', tags: ['home', 'rainy'] },
  { e: '📓', t: 'Make a comic of our week', d: 'Draw the best bits of the week as a comic strip.', tags: ['home', 'rainy', 'free', 'dad'] },
  { e: '🏕️', t: 'Backyard camp-out', d: 'Tent, torches and stories under the stars.', tags: ['home', 'free'] },
  { e: '🏆', t: 'Board game tournament', d: 'Three games, a scoreboard and a homemade trophy.', tags: ['home', 'rainy', 'free'] },
  { e: '🗺️', t: 'Treasure hunt', d: 'Hide clues around the house or yard for the others to solve.', tags: ['home', 'rainy', 'free'] },
  { e: '🌿', t: 'Park picnic', d: 'Pack a picnic and find the biggest tree in the park.', tags: ['out', 'free'] },
  { e: '🚲', t: 'Bike ride and hot chocolate', d: 'A ride around the neighbourhood, finishing with a hot chocolate.', tags: ['out', 'dad'] },
  { e: '🌱', t: 'Plant something', d: 'Plant seeds or a little herb pot and give it a name.', tags: ['home', 'free'] },
];
export const IDEA_FILTERS = [['all', 'All'], ['home', 'At home'], ['out', 'Out & about'], ['rainy', 'Rainy day'], ['free', 'Free'], ['dad', 'Just me & Dad']];
export const DEFAULT_REWARDS = [
  { id: 'dadnight', e: '🌙', t: 'A night with just Dad', d: 'Your pick of what we do, just us two.', cost: 15 },
  { id: 'movie', e: '🎬', t: "Pick tonight's movie", d: 'You choose, everyone watches.', cost: 5 },
  { id: 'outing', e: '🚗', t: 'Pick the weekend outing', d: 'Choose where the crew goes.', cost: 10 },
  { id: 'dinner', e: '🌮', t: 'Choose dinner', d: 'Tacos? Pancakes for tea? Your call.', cost: 6 },
  { id: 'late', e: '⏰', t: 'Stay up 20 minutes later', d: 'One night, an extra 20 minutes.', cost: 8 },
  { id: 'breakfast', e: '🥞', t: 'Breakfast in bed', d: 'Dad brings it to you.', cost: 12 },
  { id: 'sleepover', e: '🏕️', t: 'Friend sleepover', d: 'Invite a friend over. Dad sorts it.', cost: 25 },
];

export const rules = () => S.boot?.rules || { paydayStars: 100, paydayDollars: 100, strikesPerStar: 3, principalAt: 10 };

/* ---------- people ---------- */
export function people() {
  return (S.boot?.people || []).map(p => P(p.id)).filter(Boolean);
}
export function P(id) {
  const b = (S.boot?.people || []).find(x => x.id === id);
  if (!b) return null;
  const profile = { ...(b.profile || {}), ...(Store.get('people/' + id) || {}) };
  const pub = Store.get('pub/' + id) || b.pub || {};
  return { ...b, ...profile, name: b.name, role: b.role, profile, pub };
}
export const kids = () => people().filter(p => p.role === 'kid');
export const parents = () => people().filter(p => p.role === 'parent');
export const isParent = () => S.me?.role === 'parent';
export const isKid = () => S.me?.role === 'kid';
export const nick = id => { const p = P(id); return p ? (p.role === 'parent' ? (p.nick || p.name) : p.name) : 'Someone'; };
export const short = id => { const p = P(id); return p ? (p.nick || p.name) : 'Someone'; };
export const accentOf = id => ACCENTS[P(id)?.accent] || (P(id)?.role === 'parent' ? (P(id)?.colour || '#5B8CFF') : ACCENTS.pink);
export const accentSoftOf = id => ACCENT_SOFT[P(id)?.accent] || '#E1EAFF';
export const famName = () => S.boot?.family || 'Our family';

/* A picture someone chose themselves wins over the family drawing of them. */
export function picOf(id, kind = 'head') {
  const p = P(id);
  if (p?.pic) return `/art/${p.pic}?v=${Number(p.picV) || 0}`;
  const key = p?.art?.[kind] || p?.art?.head;
  return key ? `/art/${key}` : null;
}
export function avatar(id, kind = 'head', cls = 'av', style = '') {
  const src = picOf(id, kind);
  if (src) return `<span class="${cls}" style="${style}"><img src="${esc(src)}" alt="" loading="lazy"></span>`;
  return `<span class="${cls}" style="${style};background:${accentSoftOf(id)};color:${accentOf(id)}">${esc((p?.name || '?')[0])}</span>`;
}
export const buddyOf = id => BUDDIES.find(b => b.id === P(id)?.buddy) || null;
export const buddyImg = (b, cls = 'bimg') => b ? `<img class="${cls}" src="/img/buddy-${b.id}.webp" alt="${esc(b.name)}">` : '';

/* ---------- houses ---------- */
export const roster = () => Store.get('settings/roster') || null;
export function homeFor(s) {
  const o = Store.get('stays/' + s);
  if (o && (o.home === 'dad' || o.home === 'mum')) return o.home;
  const r = roster();
  if (!r?.pattern) return 'unknown';
  const p = r.pattern[parseYmd(s).getDay()];
  if (p !== 'alt') return p || 'unknown';
  if (!r.altMumTuesday) return 'swap';
  const weeks = Math.round((parseYmd(s) - parseYmd(r.altMumTuesday)) / (7 * 864e5));
  return Math.abs(weeks) % 2 === 0 ? 'mum' : 'dad';
}
export const homeName = h => h === 'dad' ? "Dad's house" : h === 'mum' ? "Mum's house" : h === 'swap' ? 'Swap day' : 'Not set';
export function nextSwitch() {
  const t = new Date(), h0 = homeFor(ymd(t));
  if (h0 === 'swap' || h0 === 'unknown') return null;
  for (let i = 1; i <= 14; i++) { const d = addDays(t, i), h = homeFor(ymd(d)); if (h !== h0) return { home: h, sleeps: i, day: DOWL[d.getDay()] }; }
  return null;
}
export const places = () => Store.get('settings/places')?.items || [{ id: 'dad', t: "Dad's", e: '⌂' }, { id: 'mum', t: "Mum's", e: '♡' }];
export const placeOf = id => places().find(p => p.id === id) || null;
export const rhythm = () => ({ quiet: 60, our: 30, ...(Store.get('settings/rhythm') || {}) });

/* ---------- a girl's things ---------- */
export const routineOf = k => Store.col(`kids/${k}/routine`).sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.at || '').localeCompare(String(b.at || '')));
export const dayOf = (k, d = today()) => Store.get(`kids/${k}/days/${d}`) || { done: [] };
export function routineStats(k, d = today()) {
  const ids = new Set(routineOf(k).map(r => r.id));
  const done = (dayOf(k, d).done || []).filter(x => ids.has(x)).length;
  return { done, total: ids.size };
}
export function moodToday(k) {
  const f = Store.col('feed').filter(x => x.kid === k && x.mood && x.at && ymd(new Date(x.at)) === today()).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  return f ? MOODS.find(m => m.id === f.mood) : null;
}
export function starsOf(k) { return Number(P(k)?.pub?.stars) || 0; }
export function cycleOf(k) {
  const start = P(k)?.pub?.cycleStart || '';
  return { start, log: Store.col(`kids/${k}/log`).filter(l => String(l.at || '') > start) };
}
export function strikesOf(k) { return Number(P(k)?.pub?.strikes) || 0; }
export function streakSet(k) { return new Set(Store.col(`kids/${k}/days`).filter(d => d.starred).map(d => d.id)); }
export const rewardsList = () => Store.get('settings/rewards')?.items || DEFAULT_REWARDS;
export const TRAIL_REWARDS = [
  { id: 'icecream', e: '🍦', t: 'Ice cream trip', d: 'Dad takes you out for an ice cream.', cost: 10 },
  { id: 'cinema', e: '🎬', t: 'Movies at the cinema', d: 'A trip to the cinema, popcorn included.', cost: 25 },
  { id: 'present', e: '🎁', t: 'A surprise present', d: 'Dad picks a surprise just for you.', cost: 50 },
  { id: 'adventure', e: '🏕️', t: 'Big adventure day', d: 'A whole day out. You pick the adventure.', cost: 75 },
];
export const rewardById = id => [...rewardsList(), ...TRAIL_REWARDS].find(r => r.id === id) || null;
export const ideasList = () => Store.get('settings/ideas')?.items || DEFAULT_IDEAS;

/* ---------- family jobs ---------- */
export const doneKey = tk => tk.daily ? today() : 'once';
export const doneBy = tk => { const k = doneKey(tk); return Store.col('taskDone').filter(d => d.task === tk.id && d.key === k).map(d => d.who); };
export const jobsFor = who => Store.col('tasks').filter(tk => (who === 'all' || !tk.who || tk.who === 'all' || tk.who === who) && (tk.daily || !tk.date || tk.date <= today()))
  .sort((a, b) => (a.daily === b.daily ? 0 : a.daily ? -1 : 1) || String(a.at || '').localeCompare(String(b.at || '')));

export const weekDays = (offset = 0) => { const s = addDays(startOfWeek(new Date()), offset * 7); return Array.from({ length: 7 }, (_, i) => ymd(addDays(s, i))); };
