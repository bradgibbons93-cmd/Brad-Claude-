/* Good & hard days, end to end on 390px phones (Dad, Lilly and Skylah) against a real server and database:
   her check-in on Home, "I'd like to talk to Dad" reaching Dad's Waiting for you, her own graph, Dad's
   graph of both girls, and her sister never seeing any of it.
   Start a server on an empty database with SETUP_TOKEN=test-setup-token, then:
     node --experimental-strip-types test/e2e/together.mjs      (BASE defaults to http://localhost:8096) */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8096';
const OUT = process.env.SHOTS || '/tmp/';
let fails = 0, passes = 0;
const ok = (c, m, extra = '') => { if (c) { passes++; console.log('  ✓', m); } else { fails++; console.log('  ✗', m, extra); } };
const post = (page, path, body) => page.evaluate(async ([p, b]) => { const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, [path, body]);
const tappable = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return 'missing'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && (hit === el || el.contains(hit)) ? true : 'covered by ' + (hit?.className || hit?.tagName); }, sel);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new'] });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, bypassCSP: true };
const errors = [];
const watch = (page, who) => { page.on('pageerror', e => errors.push(who + ': ' + String(e))); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_CERT|net::ERR|Failed to load resource/.test(m.text())) errors.push(who + ': ' + m.text()); }); };
const noSideways = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const pad = n => String(n).padStart(2, '0');
const dayBack = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

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

console.log('Her check-in, on Home');
await lilly.waitForSelector('.tg-card');
ok(/How was today with Riannon and her kids\?/.test(await lilly.locator('.tg-card h3').textContent()), 'Lilly is asked how today was with Riannon and her kids');
const feels = await lilly.locator('.tg-card .tg-feels button').allTextContents();
ok(feels.length === 6 && /Great/.test(feels[0]) && /Really hard/.test(feels[4]) && /Didn't see them/.test(feels[5]), 'great, good, okay, hard, really hard, or didn\'t see them', JSON.stringify(feels));
ok(await tappable(lilly, '.tg-card [data-f="hard"]') === true, 'the buttons are tappable');
await lilly.click('.tg-card [data-f="hard"]');
await lilly.waitForSelector('#sheetBody #tgTags');
ok(await lilly.locator('#sheetBody .tg-feels button.on').getAttribute('data-f') === 'hard', 'the sheet opens on Hard');
const tags = await lilly.locator('#tgTags button').allTextContents();
ok(tags.includes('Argument') && tags.includes('Felt left out') && !tags.includes('Played together'), 'a hard day offers the hard things that can happen', JSON.stringify(tags));
await lilly.click('#sheetBody [data-f="good"]');
ok((await lilly.locator('#tgTags button').allTextContents()).includes('Played together') && await lilly.locator('#tgTalk').count() === 0, 'switching to Good offers the good things instead, and no "talk to Dad" box');
await lilly.click('#sheetBody [data-f="hard"]');
await lilly.click('#tgTags button:has-text("Argument")');
await lilly.click('#tgTags button:has-text("Felt left out")');
await lilly.fill('#tgNote', 'We fought over the TV and nobody listened');
await lilly.check('#tgTalk');
await lilly.locator('#sheetBody').screenshot({ path: OUT + 'yumi-together-sheet.png' });
await lilly.click('[data-act="tgSave"]');
await lilly.waitForSelector('.tg-done', { timeout: 8000 });
ok(/Today with Riannon and her kids: Hard/.test(await lilly.locator('.tg-done').textContent()), 'the card says thanks and shows today as Hard');

console.log("It reaches Dad when she asks to talk");
await dad.goto(BASE + '/'); await dad.waitForSelector('.nav');
await dad.waitForFunction(() => /Lilly had a hard day with Riannon and her kids/.test(document.querySelector('#waiting')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
const wait = (await dad.locator('#waiting').textContent().catch(() => '')) || '';
ok(/💞/.test(wait) && /Lilly had a hard day with Riannon and her kids/.test(wait) && /We fought over the TV/.test(wait), "Dad's Waiting for you has it, in her words", wait.slice(0, 200));
ok(await dad.locator('#waiting [data-act="seen"]', { hasText: 'We talked' }).count() === 1, 'with a "We talked ✓" button');
await lilly.click('.tg-done');
await lilly.waitForSelector('.tg-fig');
await lilly.locator('.tg-row').nth(0).locator('[data-act="tgEdit"]').click();
await lilly.waitForSelector('#tgNote'); await lilly.fill('#tgNote', 'We fought over the TV. Better now'); await lilly.click('[data-act="tgSave"]');
await lilly.waitForTimeout(800);
await dad.reload(); await dad.waitForSelector('.nav'); await dad.waitForTimeout(600);
ok((await dad.locator('#waiting .wait', { hasText: 'hard day with' }).count()) === 1, 'changing the note afterwards does not send Dad a second alert');

console.log('Her weeks, as a graph');
const seed = [];
for (let i = 1; i < 28; i++) {
  const f = i % 9 === 0 ? 'awful' : i % 6 === 0 ? 'hard' : i % 7 === 0 ? 'none' : i % 3 === 0 ? 'okay' : i % 2 ? 'good' : 'great';
  seed.push({ path: `kids/lilly/together/${dayBack(i)}`, set: { feel: f, tags: f === 'good' ? ['Played together'] : f === 'great' ? ['Laughed a lot'] : f === 'hard' ? ['Argument'] : [] } });
}
const w = await post(lilly, '/write', { ops: seed });
ok(w.ok, 'four weeks of her check-ins go in', JSON.stringify(w).slice(0, 200));
await lilly.goto(BASE + '/?tab=me&sub=together'); await lilly.waitForSelector('.tg-fig');
const bars = await lilly.evaluate(() => ({ g: document.querySelectorAll('.tg-g').length, h: document.querySelectorAll('.tg-h').length, o: document.querySelectorAll('.tg-o').length, line: document.querySelectorAll('.tg-ld').length, hits: document.querySelectorAll('.tg-hit').length }));
ok(bars.hits === 28 && bars.g > 10 && bars.h >= 5 && bars.o >= 2 && bars.line === 4, 'good days above the line, hard days below, okay on it, and four weekly averages', JSON.stringify(bars));
const goodUp = await lilly.evaluate(() => { const base = document.querySelector('.tg-base').getBBox().y; return [...document.querySelectorAll('.tg-g')].every(p => p.getBBox().y + p.getBBox().height <= base + 0.5) && [...document.querySelectorAll('.tg-h')].every(p => p.getBBox().y >= base - 0.5); });
ok(goodUp, 'every good bar sits above the line and every hard bar below it');
const verdict = await lilly.locator('.tg-verdict').textContent();
ok(/Mostly good days, with some hard ones too/.test(verdict), 'a month of mostly good days with some hard ones reads as normal ups and downs', verdict);
ok(/Only you and Dad see this/.test(await lilly.locator('.tg-intro').textContent()) && /isn't a vote/.test(await lilly.locator('.tg-intro').textContent()), 'it tells her it is private, and not a vote');
const counts = await lilly.locator('.tg-counts').textContent();
ok(/good/.test(counts) && /hard/.test(counts) && /check-ins/.test(counts), 'with counts of good, okay and hard days', counts);
await lilly.locator(`.tg-hit[data-d="${dayBack(6)}"]`).dispatchEvent('click');
await lilly.waitForSelector('.tg-day');
ok(/Hard/.test(await lilly.locator('.tg-day').textContent()) && /Argument/.test(await lilly.locator('.tg-day').textContent()), 'tapping a day shows it, with what happened');
await lilly.click('.tg-day [data-act="tgEdit"]'); await lilly.waitForSelector('#sheetBody .tg-feels');
ok(await lilly.locator('#sheetBody .tg-feels button.on').getAttribute('data-f') === 'hard', 'and she can change a past day');
await lilly.click('[data-act="closeSheet"]').catch(() => lilly.evaluate(() => document.querySelector('.sheet-bg')?.click()));
await lilly.click('[data-act="tgWeeks"][data-n="8"]');
ok(await lilly.locator('.tg-hit').count() === 56, 'eight weeks at a tap');
ok(await noSideways(lilly), 'nothing scrolls sideways on her phone');
await lilly.screenshot({ path: OUT + 'yumi-together-lilly.png', fullPage: true });
await lilly.goto(BASE + '/?tab=me'); await lilly.waitForSelector('.tiles');
ok(await lilly.locator('.tiles [data-sub="together"]').count() === 1, 'her Me page has a Good & hard days tile');

console.log('Her sister never sees it');
await sky.goto(BASE + '/?tab=me&sub=together'); await sky.waitForSelector('.tg-fig');
ok(!/We fought over the TV/.test(await sky.textContent('body')) && await sky.locator('.tg-g, .tg-h').count() === 0, "Skylah's page shows only her own (empty) graph, none of Lilly's days");
const skyWrite = await post(sky, '/write', { ops: [{ path: `kids/lilly/together/${dayBack(0)}`, set: { feel: 'great' } }] });
ok(!skyWrite.ok, "Skylah can't write Lilly's check-in");
const skySync = await sky.evaluate(async () => { const r = await fetch('/api/sync?since=0'); return r.text(); });
ok(!/kids\/lilly\/together/.test(skySync), "and Lilly's check-ins never reach Skylah's phone at all");

console.log("Dad's view");
await dad.goto(BASE + '/?tab=family&sub=together'); await dad.waitForSelector('.tg-fig');
ok(await dad.locator('.tg-fig').count() === 2, 'one graph per girl');
ok(await dad.locator('.tg-hit').count() === 112, 'eight weeks each by default');
const lillyCard = dad.locator('section.card', { hasText: 'Lilly' }).filter({ has: dad.locator('.tg-fig') });
const dv = await lillyCard.locator('.tg-verdict').textContent();
ok(/Mostly good\. The hard days are worth talking about/.test(dv), "Dad's words for the same picture", dv);
ok(/In her words/.test(await lillyCard.textContent()) && /Better now/.test(await lillyCard.textContent()) && /Asked to talk/.test(await lillyCard.textContent()), 'with her notes, and the day she asked to talk');
ok(/Argument/.test(await lillyCard.locator('.tg-tags').last().textContent()), 'and what the hard days were');
const dadWrite = await post(dad, '/write', { ops: [{ path: `kids/lilly/together/${dayBack(1)}`, set: { feel: 'great' } }] });
ok(!dadWrite.ok, "Dad can read her check-ins but can't change them: they're her words");
await dad.fill('#tgLabelIn', 'Riannon, Mia and Josh'); await dad.click('[data-act="tgLabelSave"]');
await lilly.goto(BASE + '/'); await lilly.waitForSelector('.tg-done');
await lilly.waitForFunction(() => /Riannon, Mia and Josh/.test(document.querySelector('.tg-done')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
ok(/Today with Riannon, Mia and Josh/.test(await lilly.locator('.tg-done').textContent()), 'Dad can change who the question is about, and Lilly sees it');
await dad.click('.tg-tips summary');
ok(/family counsellor/.test(await dad.locator('.tg-tips').textContent()), 'with a few words on talking about it');
ok(await noSideways(dad), "nothing scrolls sideways on Dad's phone");
await dad.screenshot({ path: OUT + 'yumi-together-dad.png', fullPage: true });
await dad.goto(BASE + '/?tab=me'); await dad.waitForSelector('.tiles');
ok(await dad.locator('.tiles [data-act="tgDad"]').count() === 1, "Dad's Me page has a tile for it too");
await dad.goto(BASE + '/?tab=family'); await dad.waitForSelector('.chips');
ok(await dad.locator('.chips [data-sub="together"]').count() === 1, 'and a Together chip on Family');

console.log("Didn't see them");
await sky.goto(BASE + '/'); await sky.waitForSelector('.tg-card');
await sky.click('.tg-card [data-f="none"]');
await sky.waitForSelector('.tg-done', { timeout: 8000 });
ok(/Didn't see them/.test(await sky.locator('.tg-done').textContent()), 'one tap and it is done, without a sheet');

ok(!errors.length, 'no errors on any phone', errors.join('\n'));
console.log(`\n${passes} passed, ${fails} failed`);
await browser.close();
process.exit(fails ? 1 : 0);
