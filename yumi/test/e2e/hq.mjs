/* HQ inside Yumi, end to end on a 390px phone against a real server and database: the move from the
   HQ page with a one-time code, every card, the privacy of it, and the generated widget script run
   against the server in the strict Scriptable stand-in (test/scriptable.ts).

   Start a server on an empty database with SETUP_TOKEN=test-setup-token, then:
     npm install --no-save playwright      (not a dependency; Chromium is at /opt/pw-browsers)
     node --experimental-strip-types test/e2e/hq.mjs
   BASE defaults to http://localhost:8096. HQ_PAYLOAD=<file> runs it with a real HQ export instead of
   the made-up one below; never commit a real one, it holds someone's money. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { runScript, tableRows } from '../scriptable.ts';
import { monthSummary, subsSummary, openTasks, money } from '../../public/js/hqmath.js';

const BASE = process.env.BASE || 'http://localhost:8096';
const OUT = process.env.SHOTS || '/tmp/';
const PAYLOAD = process.env.HQ_PAYLOAD ? JSON.parse(fs.readFileSync(process.env.HQ_PAYLOAD)) : madeUp();
const counts = Object.fromEntries(Object.entries(PAYLOAD.data).map(([k, v]) => [k, Object.keys(v).length]));

/* An HQ export with invented people and numbers, shaped like the real one. */
function madeUp() {
  const d = new Date(), ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, day = n => `${ym}-${String(n).padStart(2, '0')}`;
  const ahead = n => { const x = new Date(Date.now() + n * 864e5); return x.toISOString().slice(0, 10); };
  const t = (id, title, pri, project, rank, extra = {}) => [id, { added: '2026-10-09T15:30:00+11:00', by: 'claude', done: false, how: '', links: [], needs: false, pri, project, rank, title, tool: '', ...extra }];
  return { from: 'made-up HQ', data: {
    tasks: Object.fromEntries([
      t('r-price', 'Pick the founding price', 'now', 'runnit', 1, { how: 'The strategy doc has the options.', links: [{ label: 'Strategy', url: 'https://example.com/strategy' }], tool: 'Strategy doc' }),
      t('r-send', 'Send the studio its page', 'now', 'runnit', 2, { needs: true }), t('s-wait', 'Build the waitlist page', 'now', 'softr', 3),
      t('e-pack', 'Send the consulting package', 'next', 'encap', 4), t('f-check', 'Check the campaign is live', 'next', 'five8', 5),
      t('q-hair', 'Book haircuts', 'next', 'crew', 6), t('m-seat', 'Cancel the unused seat', 'next', 'money', 7),
      ...Array.from({ length: 10 }, (_, i) => t('l-' + i, 'Someday idea ' + (i + 1), 'later', 'hq', 10 + i)),
      t('d-old', 'An old finished one', 'now', 'hq', 0, { done: true, doneAt: '2026-10-01T01:00:00Z' }),
    ]),
    txns: { a: { amount: -50, cat: 'groceries', date: day(1), note: 'Shop', added: day(1), bank: 'X', pending: false, seq: 1, source: 'test' }, b: { amount: -20.5, cat: 'eatingout', date: day(2), note: 'Lunch', added: day(2), bank: 'X', pending: false, seq: 2, source: 'test' }, c: { amount: 300, cat: 'income', date: day(2), note: 'Client', added: day(2), bank: 'X', pending: false, seq: 3, source: 'test' }, p: { amount: -99, cat: 'kids', date: day(3), note: 'Theirs', who: 'partner', added: day(3), bank: 'X', pending: false, seq: 4, source: 'test' } },
    subs: { one: { name: 'Music', amount: 12, cycle: 'month', status: 'active', renews: ahead(3), decision: '', checked: '', evidence: '', group: '', manage: '', note: '', plan: '', suggest: '', via: '' }, two: { name: 'Cloud', amount: 120, cycle: 'year', status: 'active', renews: ahead(40), decision: '', checked: '', evidence: '', group: '', manage: '', note: '', plan: '', suggest: '', via: '' }, three: { name: 'Old app', amount: 9, cycle: 'month', status: 'payment_failing', renews: null, decision: '', checked: '', evidence: '', group: '', manage: '', note: '', plan: '', suggest: '', via: '' } },
    rules: { coles: { cat: 'groceries', match: 'coles' } },
    settings: { people: { partner: 'Sam' }, budget: { limits: {} } },
  } };
}
let fails = 0, passes = 0;
const ok = (c, m, extra = '') => { if (c) { passes++; console.log('  ✓', m); } else { fails++; console.log('  ✗', m, extra); } };
const post = (page, path, body) => page.evaluate(async ([p, b]) => { const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, [path, body]);
const get = (page, path) => page.evaluate(async p => { const r = await fetch('/api' + p); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, path);
const raw = async (path, init = {}) => { const r = await fetch(BASE + '/api' + path, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } }); return { status: r.status, json: await r.json().catch(() => null) }; };
const tappable = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) return 'missing'; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && (hit === el || el.contains(hit)) ? true : 'covered by ' + (hit?.className || hit?.tagName); }, sel);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new'] });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, bypassCSP: true };
const errors = [];
const watch = (page, who) => { page.on('pageerror', e => errors.push(who + ': ' + String(e))); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_CERT|net::ERR|Failed to load resource/.test(m.text())) errors.push(who + ': ' + m.text()); }); };

/* ---- the family ---- */
const dadCtx = await browser.newContext({ ...phone, permissions: ['clipboard-read', 'clipboard-write'] }), dad = await dadCtx.newPage(); watch(dad, 'dad');
await dad.goto(BASE + '/');
const setup = await post(dad, '/setup', { token: 'test-setup-token', code: '123456', family: 'Gibbons Crew', parent: 'Bradley', kids: ['Lilly', 'Skylah'], tz: 'Australia/Melbourne' });
if (!setup.ok) await post(dad, '/login', { who: 'bradley', code: '123456' });
await dad.goto(BASE + '/'); await dad.waitForSelector('.hqmini');

console.log('The way in');
ok(/BRAD HQ/.test(await dad.locator('.hqmini').textContent()), "Dad's Home has the HQ card, named BRAD HQ");
ok(await dad.locator('.nav button[data-tab="hq"]').count() === 1, 'HQ is a tab on the bottom menu');
await dad.click('.hqmini');
await dad.waitForSelector('.hqx');
ok(await dad.evaluate(() => document.body.classList.contains('t-hq')), 'HQ turns the whole screen to the Cel-X look');
ok(await dad.evaluate(() => getComputedStyle(document.querySelector('.hqhead h1 em')).color === 'rgb(255, 212, 0)'), 'the name is in Cyph yellow');
const order = await dad.evaluate(() => ['hq-import', 'hq-dump', 'hq-studio', 'hq-todo', 'hq-money', 'hq-subs', 'hq-widget'].map(id => Math.round(document.getElementById(id)?.getBoundingClientRect().top ?? -1)));
ok(order.every((t, i) => t > 0 && (i === 0 || t > order[i - 1])), 'order: bring-across, brain dump, studio, to-do, money, subs, widget', order.join(' < '));
ok(await tappable(dad, '[data-act="hqPaste"]') === true, 'Paste from HQ is tappable');
ok(await dad.locator('.hqtile').count() === 6, 'six studio tiles');
ok(await dad.evaluate(() => getComputedStyle(document.getElementById('hqDump')).backgroundColor === 'rgb(10, 12, 16)'), 'the brain dump box is dark, not white');
ok(await dad.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nothing scrolls sideways at 390px');
await dad.screenshot({ path: OUT + 'yumi-hq-empty.png', fullPage: false });

console.log('Bringing the HQ across');
const exportText = JSON.stringify({ hqExport: 1, from: PAYLOAD.from, at: new Date().toISOString(), data: PAYLOAD.data });
await dad.fill('#hqPasteBox', 'my shopping list');
await dad.click('[data-act="hqPaste"]');
ok(await dad.locator('#hqPasteBox').count() === 1 && /isn't the HQ copy/.test(await dad.locator('.toast').textContent()), "pasting something else is turned away, kindly");
await dad.fill('#hqPasteBox', '');
await dad.evaluate(t => navigator.clipboard.writeText(t), exportText);
await dad.click('[data-act="hqPaste"]');
await dad.waitForSelector('.hqok');
ok(new RegExp(`Found ${counts.tasks} to-dos, ${counts.txns} money entries and ${counts.subs} subscriptions`).test(await dad.locator('.hqok').textContent()), 'Paste from HQ reads the clipboard and says what it found');
await dad.click('[data-act="hqImportGo"]');
await dad.waitForFunction(() => !document.getElementById('hq-import') && document.querySelectorAll('.hqt').length > 0, null, { timeout: 8000 });
ok(true, 'the page fills in by itself and the bring-across card goes');
ok(new RegExp(`${counts.tasks} to-dos, ${counts.txns} money entries, ${counts.subs} subscriptions`).test(await dad.locator('.hqfoot').textContent()), 'a line at the bottom says what came across');
const ic = await post(dad, '/hq/import-code', {});
ok(/^HQ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(ic.code), 'a code for Claude can still be made, shaped HQ-XXXX-XXXX', ic.code);
ok((await raw('/hq/import', { method: 'POST', body: JSON.stringify({ code: 'HQ-AAAA-BBBB', data: PAYLOAD.data }) })).status === 403, 'a made-up code is refused');
const again = await raw('/hq/import', { method: 'POST', body: JSON.stringify({ code: ic.code.toLowerCase().replace(/-/g, ' '), from: 'again', data: PAYLOAD.data }) });
ok(again.status === 200 && Object.values(again.json.added).every(n => n === 0), 'the code works, and moving the same HQ twice adds nothing twice', JSON.stringify(again.json));
ok((await raw('/hq/import', { method: 'POST', body: JSON.stringify({ code: ic.code, data: PAYLOAD.data }) })).status === 403, 'the code only works once');
const tasks = Object.entries(PAYLOAD.data.tasks).map(([id, t]) => ({ id, ...t }));
const open = openTasks(tasks), nowList = open.filter(t => t.pri === 'now');
ok((await dad.locator('.hqtasks .hqt').count()) === Math.min(8, nowList.length), `the Now tab lists the Now to-dos (${nowList.length})`);
ok((await dad.locator('.hqtasks .hqt b').first().textContent()) === nowList[0].title, 'in the same order as HQ', nowList[0].title);
ok(new RegExp(`${open.length} open`).test(await dad.locator('#hq-todo .hqmeta').textContent()), `${open.length} open, the same count as HQ`);

console.log('Brain dump');
await dad.fill('#hqDump', 'Ring the accountant\nOrder SOFTR labels');
await dad.selectOption('#hqDumpProj', 'softr');
await dad.click('[data-act="hqDumpPri"][data-v="now"]');
ok(await tappable(dad, '[data-act="hqDumpAdd"]') === true, 'Add to my list is tappable, not under the menu');
await dad.click('[data-act="hqDumpAdd"]');
await dad.waitForFunction(() => [...document.querySelectorAll('.hqt b')].some(b => b.textContent === 'Order SOFTR labels'));
ok(await dad.inputValue('#hqDump') === '', 'the box empties');
ok(await dad.locator('.hqt b', { hasText: 'Ring the accountant' }).count() === 1, 'each line became its own to-do, under Now');
await dad.fill('#hqDump', 'Half written');
await dad.click('[data-act="hqTab"][data-v="next"]');
ok(await dad.inputValue('#hqDump') === 'Half written', 'a half-written dump survives the page redrawing');
await dad.fill('#hqDump', '');
await dad.click('[data-act="hqTab"][data-v="now"]');

console.log('To-do');
const first = dad.locator('.hqt', { hasText: 'Ring the accountant' });
await first.locator('.hqcheck').click();
await dad.waitForFunction(() => ![...document.querySelectorAll('.hqt b')].some(b => b.textContent === 'Ring the accountant'));
ok(true, 'ticking one takes it off Now');
await dad.click('[data-act="hqTab"][data-v="done"]');
ok(await dad.locator('.hqt.done b', { hasText: 'Ring the accountant' }).count() === 1, 'and it sits under Done');
await dad.locator('.hqt.done', { hasText: 'Ring the accountant' }).locator('.hqcheck').click();
await dad.click('[data-act="hqTab"][data-v="now"]');
await dad.waitForFunction(() => [...document.querySelectorAll('.hqt b')].some(b => b.textContent === 'Ring the accountant'));
ok(true, 'unticking puts it back');
await dad.locator('.hqt', { hasText: 'Order SOFTR labels' }).locator('.hqtbody').click();
await dad.waitForSelector('#hqTTitle');
await dad.fill('#hqTTitle', 'Order SOFTR labels from the printer');
await dad.click('#sheetBody [data-hqpri="later"]');
await dad.click('[data-act="hqSave"]');
await dad.waitForFunction(() => [...document.querySelectorAll('.hqt.flash b')].some(b => b.textContent === 'Order SOFTR labels from the printer'));
ok(await dad.locator('[data-act="hqTab"][data-v="later"]').getAttribute('aria-selected') === 'true', 'a to-do can be renamed and moved to Later, and the list follows it there');
await dad.waitForTimeout(400);
ok(await dad.evaluate(() => { const r = document.querySelector('.hqt.flash').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }), "it's scrolled into view and highlighted, even though Later has more than 8");
const withLinks = tasks.find(t => !t.done && t.links?.length && t.how);
if (withLinks) {
  await dad.click(`[data-act="hqTab"][data-v="${withLinks.pri}"]`);
  if (await dad.locator('[data-act="hqAll"]').count()) await dad.click('[data-act="hqAll"]');
  await dad.click(`.hqtbody[data-id="${withLinks.id}"]`);
  await dad.waitForSelector('.hqhow');
  ok((await dad.locator('.hqsheet .hqlinks a').count()) >= 1 && (await dad.locator('.hqhow').textContent()) === withLinks.how, "a to-do's notes and links from HQ show when opened");
  await dad.click('#sheetBody [data-act="closeSheet"], .sheet-bg').catch(() => {});
  await dad.evaluate(() => document.querySelector('.sheet-bg')?.click());
}
await dad.click('#hq-studio .hqcount >> nth=0');
ok(/only ✕/.test(await dad.locator('.hqfilter').textContent()), 'a studio tile\'s "open" count filters the list to that project');
await dad.click('.hqfilter');

console.log('Money');
const now = new Date(), ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const m0 = monthSummary(Object.values(PAYLOAD.data.txns), ym);
const outText = async () => (await dad.locator('.hqmoney div:nth-child(2) b').textContent()).trim();
ok(await outText() === money(m0.out), `this month's money out matches HQ's sum (${m0.out})`, await outText());
await dad.click('[data-act="hqTxNew"]');
await dad.waitForSelector('#hqTxAmt');
await dad.fill('#hqTxAmt', '42.50');
await dad.fill('#hqTxNote', 'Coles');
const outBefore = await outText();
await dad.click('[data-act="hqTxSave"]');
await dad.waitForFunction(o => document.querySelector('.hqmoney div:nth-child(2) b')?.textContent.trim() !== o, outBefore);
const exp = Math.round((m0.out + 42.5) * 100) / 100;
ok(await outText() === money(exp), 'adding $42.50 at Coles adds to money out', await outText());
ok(await dad.locator('.hqtx b', { hasText: 'Coles' }).count() === 1, 'and it shows at the top of the list');
await dad.click('[data-act="hqTxNew"]');
await dad.click('#sheetBody [data-act="hqTxKind"][data-v="in"]');
ok(await dad.inputValue('#hqTxCat') === 'income', 'switching to Money in offers the income categories');
await dad.evaluate(() => document.querySelector('.sheet-bg')?.click());

console.log('Subscriptions');
const s0 = subsSummary(Object.entries(PAYLOAD.data.subs).map(([id, s]) => ({ id, ...s })), new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date()));
ok(new RegExp(`about \\$${Math.round(s0.monthly).toLocaleString('en-AU')}/mo · ${s0.running} running`).test(await dad.locator('#hq-subs .hqmeta').textContent()), `subscriptions read about $${Math.round(s0.monthly)}/mo, ${s0.running} running, as HQ worked out`, await dad.locator('#hq-subs .hqmeta').textContent());
if (s0.failing) ok(/card/.test(await dad.locator('.hqwarn').textContent()), 'failing cards are flagged');
await dad.click('.hqall summary');
const firstSub = await dad.locator('[data-hqdecide]').first().getAttribute('data-hqdecide');
await dad.selectOption(`[data-hqdecide="${firstSub}"]`, 'keep');
await dad.waitForTimeout(600);
await dad.goto(BASE + '/?tab=hq'); await dad.waitForSelector('.hqx');
await dad.click('.hqall summary');
ok(await dad.inputValue(`[data-hqdecide="${firstSub}"]`) === 'keep', 'a decision on a subscription is saved');

console.log('iPhone widget');
ok(/off/.test(await dad.locator('#hq-widget .hqmeta').textContent()), 'the widget starts off');
await dad.click('[data-act="hqWidgetMake"]');
await dad.waitForSelector('#hqScript');
const script = await dad.inputValue('#hqScript');
const key = (script.match(/\/api\/hq\/w\/([A-Za-z0-9_-]+)/) || [])[1];
ok(key && key.length >= 40 && script.includes(BASE), 'the script carries this server and a long key');
await dad.click('[data-act="hqCopy"][data-from="hqScript"]');
ok(await dad.evaluate(() => navigator.clipboard.readText()) === script, 'Copy script puts the whole script on the clipboard');
ok(await tappable(dad, '[data-act="hqCopy"][data-from="hqScript"]') === true, 'Copy is tappable, not under the menu');
const realFetch = async (url, init) => { const r = await fetch(url, { method: init.method, headers: init.headers, body: init.body }); return { status: r.status, json: await r.json().catch(() => null) }; };
const med = await runScript(script, { family: 'medium', fetcher: realFetch });
const topNow = openTasks(Object.entries(PAYLOAD.data.tasks).map(([id, t]) => ({ id, ...t })))[0];
const top3 = (await raw('/hq/w/' + key)).json.tasks.top.slice(0, 3).map(t => t.title);
ok(med.drawn.texts.includes('BRAD HQ') && top3.length === 3 && top3.every(t => med.drawn.texts.includes(t)), 'the widget, run against this server, shows the real top three', JSON.stringify(top3));
ok(med.drawn.texts.some(t => t.endsWith(' out')), 'and this month\'s money');
await runScript(script, { inWidget: false, query: { do: 'dump' }, fetcher: realFetch, alerts: [{ index: 1, text: 'Pick up the girls' }, { index: -1 }] });
await dad.click('[data-act="hqTab"][data-v="now"]');
await dad.waitForFunction(() => [...document.querySelectorAll('.hqt b')].some(b => b.textContent === 'Pick up the girls'), null, { timeout: 8000 });
ok(true, "a brain dump from the widget lands on Dad's open HQ page by itself");
const pickId = await dad.locator('.hqt', { hasText: 'Pick up the girls' }).locator('.hqcheck').getAttribute('data-id');
await runScript(script, { inWidget: false, query: { do: 'done', id: pickId, t: 'Pick up the girls' }, fetcher: realFetch, alerts: [{ index: 0 }, { index: -1 }] });
await dad.waitForFunction(() => ![...document.querySelectorAll('.hqt b')].some(b => b.textContent === 'Pick up the girls'), null, { timeout: 8000 });
ok(true, 'ticking it from the widget ticks it here too');
const listRun = await runScript(script, { inWidget: false, fetcher: realFetch });
ok(tableRows(listRun.tables[0]).some(r => /^NOW · \d+$/.test(r.title)), 'the full list in Scriptable groups the real to-dos');
await dad.click('[data-act="hqScriptHide"]');
await dad.click('[data-act="hqWidgetOff"]'); await dad.click('[data-act="hqWidgetOff"]');
await dad.waitForFunction(() => /off/.test(document.querySelector('#hq-widget .hqmeta')?.textContent || ''));
ok((await raw('/hq/w/' + key)).status === 404, 'Turn off stops the old key straight away');
const offRun = await runScript(script, { family: 'medium', fetcher: realFetch });
ok(offRun.drawn.texts.includes('Turned off in Yumi'), 'and the widget says it was turned off');
await dad.click('[data-act="hqWidgetMake"]'); await dad.waitForSelector('#hqScript');
const key2 = ((await dad.inputValue('#hqScript')).match(/\/api\/hq\/w\/([A-Za-z0-9_-]+)/) || [])[1];
await dad.click('[data-act="hqWidgetMake"]').catch(() => {});
ok(key2 && key2 !== key && (await raw('/hq/w/' + key2)).status === 200, 'a new widget gets a new key that works');

console.log('Privacy');
const pc = await post(dad, '/pair/create', { who: 'lilly' });
const kidCtx = await browser.newContext(phone), kid = await kidCtx.newPage(); watch(kid, 'lilly');
await kid.goto(BASE + '/');
await post(kid, '/pair/claim', { code: pc.code });
await post(kid, '/me/code', { code: '1234' });
const ks = await get(kid, '/sync?since=0');
ok(ks.docs && ks.docs.length > 0 && !ks.docs.some(d => d.path.startsWith('hq/')), "Lilly's phone never receives a single HQ record", `${ks.docs?.filter(d => d.path.startsWith('hq/')).length} hq docs`);
const kw = await post(kid, '/write', { ops: [{ path: 'hq/lilly/tasks/x', set: { title: 'hi' } }, { path: 'hq/bradley/tasks/x', set: { title: 'hi' } }] });
ok(kw.results?.every(r => !r.ok), "and can't write into anyone's HQ, her own included");
ok((await get(kid, '/hq/widget')).status === 403 && (await post(kid, '/hq/import-code', {})).status === 403 && (await post(kid, '/hq/import-mine', { data: { tasks: { x: { title: 'hi' } } } })).status === 403, "and can't make a widget key, an import code, or paste an HQ in");
const ds = await get(dad, '/sync?since=0');
ok(ds.docs.filter(d => d.path.startsWith('hq/bradley/tasks/')).length >= counts.tasks + 2, "Dad's own phone gets all of it");
await kid.goto(BASE + '/?tab=hq'); await kid.waitForSelector('.main');
ok(await kid.locator('.hqx').count() === 0 && await kid.locator('.nav button[data-tab="hq"]').count() === 0, 'a link to HQ on her phone just opens her Home');

console.log('Phone layout');
await dad.goto(BASE + '/?tab=hq'); await dad.waitForSelector('.hqx .hqt');
ok(await dad.evaluate(() => document.body.classList.contains('t-hq')), 'a link with ?tab=hq opens straight onto HQ (the widget\'s Open Yumi)');
ok(await dad.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll with everything filled in');
ok(await dad.evaluate(() => { const t = document.querySelector('.hqtiles'); return t.scrollWidth > t.clientWidth; }), 'the studio row swipes sideways');
await dad.screenshot({ path: OUT + 'yumi-hq-top.png', fullPage: false });
await dad.screenshot({ path: OUT + 'yumi-hq-full.png', fullPage: true });
await dad.click('.nav button[data-tab="home"]');
await dad.waitForSelector('.hqmini');
ok(!(await dad.evaluate(() => document.body.classList.contains('t-hq'))), 'leaving HQ puts the bright Yumi look back');
ok(/now · /.test(await dad.locator('.hqmini small').textContent()), 'the Home card now shows the count and the top to-do', await dad.locator('.hqmini small').textContent());
ok(await dad.evaluate(() => document.querySelector('.hqmini').getBoundingClientRect().top >= document.querySelector('.people').getBoundingClientRect().bottom - 1), "the Home card sits under the family's cards, not beneath them");
ok(await tappable(dad, '.hqmini') === true, 'and it can be tapped');
await dad.screenshot({ path: OUT + 'yumi-hq-home.png', fullPage: false });
ok(errors.length === 0, 'no page errors', errors.join(' | '));

await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
