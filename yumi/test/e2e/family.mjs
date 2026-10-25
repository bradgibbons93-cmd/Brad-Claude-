/* Rewards on Dad's phone, Dad's own star reasons, the two new games and the girls' friends lists,
   end to end on 390px phones (Dad, Lilly and Skylah) against a real server and database.
   Start a server on an empty database with SETUP_TOKEN=test-setup-token, then:
     node --experimental-strip-types test/e2e/family.mjs      (BASE defaults to http://localhost:8096) */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8096';
const OUT = process.env.SHOTS || '/tmp/';
let fails = 0, passes = 0;
const ok = (c, m, extra = '') => { if (c) { passes++; console.log('  ✓', m); } else { fails++; console.log('  ✗', m, extra); } };
const post = (page, path, body) => page.evaluate(async ([p, b]) => { const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, [path, body]);
const get = (page, path) => page.evaluate(async p => (await fetch('/api' + p)).json(), path);
const tappable = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return 'missing'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && (hit === el || el.contains(hit)) ? true : 'covered by ' + (hit?.className || hit?.tagName); }, sel);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new'] });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, bypassCSP: true };
const errors = [];
const watch = (page, who) => { page.on('pageerror', e => errors.push(who + ': ' + String(e))); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_CERT|net::ERR|Failed to load resource/.test(m.text())) errors.push(who + ': ' + m.text()); }); };
const noSideways = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

/* ---- the family ---- */
const dadCtx = await browser.newContext(phone), dad = await dadCtx.newPage(); watch(dad, 'dad');
await dad.goto(BASE + '/');
const setup = await post(dad, '/setup', { token: 'test-setup-token', code: '123456', family: 'Gibbons Crew', parent: 'Bradley', kids: ['Lilly', 'Skylah'], tz: 'Australia/Melbourne' });
if (!setup.ok) await post(dad, '/login', { who: 'bradley', code: '123456' });
async function kidPhone(who, code) {
  const pc = await post(dad, '/pair/create', { who });
  const ctx = await browser.newContext(phone), page = await ctx.newPage(); watch(page, who);
  await page.goto(BASE + '/'); await post(page, '/pair/claim', { code: pc.code }); await post(page, '/me/code', { code });
  await page.goto(BASE + '/'); await page.waitForSelector('.nav');
  return page;
}
const lilly = await kidPhone('lilly', '1234'), sky = await kidPhone('skylah', '4321');
await dad.goto(BASE + '/?tab=rewards'); await dad.waitForSelector('#dadRewards');

console.log("Rewards on Dad's phone");
const shopTitles = await lilly.evaluate(async () => { const r = await fetch('/api/boot'); return true; });
ok(/What Lilly can get/.test(await dad.locator('#dadRewards h3').textContent()), "Dad's Rewards tab shows what Lilly can get");
const dadRows = await dad.locator('#dadRewards .dadrew b').allTextContents();
ok(['Ice cream trip', 'Movies at the cinema', 'A surprise present', 'Big adventure day', "Pick tonight's movie", 'A night with just Dad', 'Friend sleepover'].every(t => dadRows.includes(t)), 'the star trail treats and the Spend or save list are all there, by name', JSON.stringify(dadRows));
ok(dadRows.some(t => /Payday/.test(t)), 'with payday at the end of the trail');
await lilly.click('.nav button[data-tab="rewards"]'); await lilly.waitForSelector('.rewards');
const kidRows = await lilly.locator('.reward b').allTextContents();
ok(kidRows.every(t => dadRows.includes(t)), 'the same list Lilly sees on her phone');
await dad.click('[data-act="rewEditMode"]');
await dad.locator('#dadRewards .dadrew', { hasText: "Pick tonight's movie" }).locator('[data-act="rewEdit"]').click();
await dad.waitForSelector('#rwC'); await dad.fill('#rwC', '7'); await dad.click('[data-act="rewSave"]');
await dad.click('[data-act="rewEdit"][data-id=""]');
await dad.waitForSelector('#rwT'); await dad.fill('#rwE', '🎮'); await dad.fill('#rwT', 'Pick the music in the car'); await dad.fill('#rwC', '3'); await dad.click('[data-act="rewSave"]');
await lilly.waitForFunction(() => [...document.querySelectorAll('.reward')].some(r => /Pick the music in the car/.test(r.textContent) && /★ 3/.test(r.textContent)) && [...document.querySelectorAll('.reward')].some(r => /Pick tonight's movie/.test(r.textContent) && /★ 7/.test(r.textContent)), null, { timeout: 8000 });
ok(true, 'Dad can change a cost and add a reward, and Lilly sees it straight away');
await dad.click('[data-act="rewEditMode"]');
ok(await noSideways(dad), 'nothing scrolls sideways');
await dad.locator('#dadRewards').screenshot({ path: OUT + 'yumi-dad-rewards.png' });

console.log('My own reason for a star');
await dad.click('[data-act="starOwn"][data-k="lilly"]');
await dad.waitForSelector('#ownReason');
await dad.fill('#ownReason', 'Read to Skylah');
await dad.click('#sheetBody .emoji-pick.nums button[data-n="2"]');
await dad.click('[data-act="starOwnGo"]');
await dad.waitForFunction(() => [...document.querySelectorAll('.reasons button.mine')].some(b => /Read to Skylah \+2/.test(b.textContent)), null, { timeout: 8000 });
ok(true, 'a star with my own words goes in, and stays as a button (with its +2) for next time');
await lilly.waitForFunction(() => /Read to Skylah/.test(document.body.textContent), null, { timeout: 8000 });
ok(/\+2 ★ · Read to Skylah/.test(await lilly.locator('.logrow').first().textContent()), "Lilly's Latest shows +2 ★ and Dad's words");
const before = await dad.locator('.logrow').count();
await dad.locator('.reasons button.mine', { hasText: 'Read to Skylah' }).click();
await dad.waitForFunction(n => document.querySelectorAll('.logrow').length > n || [...document.querySelectorAll('.logrow')].filter(r => /Read to Skylah/.test(r.textContent)).length >= 2, before, { timeout: 8000 });
ok(true, 'the saved button gives the same star again in one tap');
await dad.goto(BASE + '/'); await dad.waitForSelector('[data-act="quickStar"]');
await dad.click('[data-act="quickStar"]');
await dad.waitForSelector('#sheetBody .reasons');
ok(await dad.locator('#sheetBody .reasons button.mine', { hasText: 'Read to Skylah' }).count() === 2 && await dad.locator('#sheetBody [data-act="starOwn"]').count() === 2, 'the quick Give a Star sheet has it too, for both girls, and its own reason button');
await dad.evaluate(() => document.querySelector('.sheet-bg')?.click());
await dad.goto(BASE + '/?tab=rewards'); await dad.waitForSelector('#dadRewards');
await dad.click('[data-act="starReasonEdit"]');
await dad.click('[data-act="starReasonDel"]');
await dad.waitForFunction(() => !document.querySelector('.reasons button.mine'), null, { timeout: 8000 });
ok(true, 'and it can be removed again');
await dad.click('[data-act="starOwn"][data-k="lilly"]');
await dad.waitForSelector('#ownReason');
await dad.fill('#ownReason', 'Brave at the dentist'); await dad.click('#ownKeep'); await dad.click('[data-act="starOwnGo"]');
await dad.waitForFunction(() => /Brave at the dentist/.test(document.querySelector('.logrow')?.textContent || ''), null, { timeout: 8000 });
ok(await dad.locator('.reasons button.mine').count() === 0, 'untick "keep it" and it gives the star without saving a button');

console.log('Games');
await lilly.goto(BASE + '/?tab=me&sub=games'); await lilly.waitForSelector('.chips');
const chips = await lilly.locator('.chips button[data-act="gamePick"]').allTextContents();
ok(chips.length === 3 && chips.some(c => /Memory match/.test(c)) && chips.some(c => /Noughts/.test(c)), 'three games now: word search, memory match, noughts & crosses', JSON.stringify(chips));
await lilly.click('[data-act="gamePick"][data-g="memory"]'); await lilly.waitForSelector('.mem');
ok(await lilly.locator('.mem .mc').count() === 12, 'memory match deals 12 cards');
const faces = await lilly.locator('.mem .mc .face').allTextContents();
await lilly.click('.mem .mc[data-i="0"]'); const other = faces.findIndex((f, i) => i > 0 && f !== faces[0]);
await lilly.click(`.mem .mc[data-i="${other}"]`);
await lilly.waitForTimeout(1100);
ok(await lilly.locator('.mem .mc.up').count() === 0, 'two different cards flip back');
const pairs = {}; faces.forEach((f, i) => (pairs[f] ||= []).push(i));
for (const [a, b] of Object.values(pairs)) { await lilly.click(`.mem .mc[data-i="${a}"]`); await lilly.click(`.mem .mc[data-i="${b}"]`); await lilly.waitForTimeout(120); }
await lilly.waitForSelector('.mg .ws-done');
ok(/All pairs in 7 moves/.test(await lilly.locator('.mg .ws-done').textContent()), 'finding every pair finishes the game: 7 moves');
await lilly.waitForTimeout(600);
const lp = await get(lilly, '/sync?since=0');
ok(lp.docs.some(d => d.path === 'play/lilly/memory' && d.data.best12 === 7), 'her best is saved to her');
ok(await tappable(lilly, '.mem .mc[data-i="11"]') === true, 'the last card is tappable, not under the menu');
await lilly.screenshot({ path: OUT + 'yumi-memory.png' });
await lilly.click('[data-act="gamePick"][data-g="xo"]'); await lilly.waitForSelector('.xo');
ok(/Your turn/.test(await lilly.locator('.xo-status').textContent()), 'noughts & crosses: her turn first');
for (let n = 0; n < 6; n++) {
  if (/win|draw/i.test(await lilly.locator('.xo-status').textContent())) break;
  const free = lilly.locator('.xo .xc:not([disabled])'); if (!(await free.count())) break;
  await free.first().click(); await lilly.waitForTimeout(700);
}
ok(/win|draw/i.test(await lilly.locator('.xo-status').textContent()), 'Yumi plays back and the game ends', await lilly.locator('.xo-status').textContent());
await lilly.waitForTimeout(500);
const xs = (await get(lilly, '/sync?since=0')).docs.find(d => d.path === 'play/lilly/xo');
ok(xs && (Number(xs.data.wins) || 0) + (Number(xs.data.draws) || 0) + (Number(xs.data.losses) || 0) === 1, 'the result goes on her score');
await lilly.click('[data-act="xoMode"][data-m="two"]');
await lilly.click('.xo .xc[data-i="0"]'); await lilly.click('.xo .xc[data-i="4"]');
ok((await lilly.locator('.xo .xc[data-i="0"]').textContent()) === '❌' && (await lilly.locator('.xo .xc[data-i="4"]').textContent()) === '⭕', '2 players: cross then nought, passing the phone');
await lilly.screenshot({ path: OUT + 'yumi-xo.png' });

console.log('Friends');
await lilly.goto(BASE + '/?tab=me'); await lilly.waitForSelector('.tiles');
await lilly.click('.tiles [data-sub="friends"]');
await lilly.waitForSelector('[data-act="friendEdit"]');
await lilly.click('[data-act="friendEdit"][data-id=""]');
await lilly.waitForSelector('#frName');
await lilly.fill('#frName', 'Mia');
await lilly.click('#sheetBody .emoji-pick.emo button[data-e="🐼"]');
const bday = new Date(Date.now() + 5 * 864e5), bdayStr = `2016-${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`;
await lilly.fill('#frBday', bdayStr);
await lilly.fill('#frLikes', 'horses and KATSEYE');
await lilly.fill('#frGrown', 'Sarah 0400 000 000');
await lilly.click('[data-act="friendSave"]');
await lilly.waitForSelector('.friend');
const card = await lilly.locator('.friend').textContent();
ok(/Mia/.test(card) && /🐼/.test(card) && /in 5 days/.test(card) && /horses and KATSEYE/.test(card), 'Lilly adds Mia: picture, birthday countdown, what she loves', card);
ok(!/Sarah/.test(card), "the grown-up's number is for Dad, not shown on her card");
await lilly.click('[data-act="playdate"]');
await lilly.waitForSelector('#pdWhen'); await lilly.fill('#pdWhen', 'Saturday');
await lilly.click('[data-act="playdateGo"]');
await lilly.waitForFunction(() => /Asked for a playdate/.test(document.body.textContent), null, { timeout: 8000 });
ok(true, 'she asks for a playdate and her card says so');
const ss = await get(sky, '/sync?since=0');
ok(!ss.docs.some(d => d.path.startsWith('kids/lilly/friends/')), "Skylah's phone never receives Lilly's friends");
ok((await post(sky, '/write', { ops: [{ path: 'kids/lilly/friends/x', set: { name: 'Sneaky' } }] })).results?.[0]?.ok === false, "and can't add to them");
await dad.goto(BASE + '/'); await dad.waitForSelector('#waiting');
ok(/Lilly would love a playdate with Mia/.test(await dad.locator('#waiting').textContent()) && /When: Saturday/.test(await dad.locator('#waiting').textContent()), "Dad's Waiting for you: Lilly would love a playdate with Mia, Saturday");
await dad.locator('#waiting .wait', { hasText: 'playdate' }).locator('[data-act="seen"]').click();
await dad.waitForFunction(() => !/playdate with Mia/.test(document.getElementById('waiting')?.textContent || ''), null, { timeout: 8000 });
ok(true, '"Got it ✓" clears it');
await dad.goto(BASE + '/?tab=family'); await dad.waitForSelector('.chips');
await dad.click('.chips [data-sub="friends"]');
await dad.waitForSelector('.friend');
ok(/Lilly's friends/.test(await dad.locator('.card h3').first().textContent()) && /Sarah 0400 000 000/.test(await dad.locator('.friend').textContent()), "Dad sees each girl's friends under Family, with the grown-up's number");
ok(/hasn't added any friends yet/.test(await dad.locator('.card', { hasText: "Skylah's friends" }).textContent()), "and Skylah's empty list says so");
ok(await noSideways(dad) && await noSideways(lilly), 'nothing scrolls sideways');
await lilly.goto(BASE + '/?tab=me&sub=friends'); await lilly.waitForSelector('.friend');
await lilly.screenshot({ path: OUT + 'yumi-friends.png' });
ok(errors.length === 0, 'no page errors', errors.join(' | '));

await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
