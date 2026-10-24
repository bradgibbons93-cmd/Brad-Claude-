/* A stand-in for the Scriptable app, strict on purpose: only the members Scriptable really has exist,
   and reading or setting anything else throws. A typo in the widget script is a blank widget on the
   phone and nothing here would show it, so this is where it has to fail instead.
   Member lists follow docs.scriptable.app. */
import vm from "node:vm";

type Opts = {
  family?: string; inWidget?: boolean; query?: Record<string, string>;
  fetcher: (url: string, init: { method: string; headers: any; body: any }) => Promise<{ status: number; json: any }>;
  alerts?: { index: number; text?: string }[];          // answers, in order, to each Alert shown
  files?: Record<string, string>;                         // path -> contents, for FileManager
  icloudDocs?: Record<string, string>;                    // name -> contents, in iCloud's Documents
  events?: { title: string; startDate: Date; endDate: Date; isAllDay: boolean }[];
  scriptName?: string;
};

function strict<T extends object>(name: string, target: T, props: string[], methods: Record<string, Function>) {
  const allowed = new Set([...props, ...Object.keys(methods)]);
  for (const [k, f] of Object.entries(methods)) (target as any)[k] = f;
  return new Proxy(target, {
    get(t: any, k) {
      if (typeof k === "symbol" || k === "then" || k === "toJSON" || k === "constructor") return t[k];
      if (k.startsWith("__")) return t[k];
      if (!allowed.has(k)) throw new Error(`${name} has no member "${k}"`);
      return t[k];
    },
    set(t: any, k, v) {
      if (typeof k === "symbol" || k.startsWith("__")) { t[k] = v; return true; }
      if (!props.includes(k)) throw new Error(`can't set ${name}.${k}`);
      t[k] = v; return true;
    },
  });
}

export async function runScript(script: string, o: Opts) {
  const texts: string[] = [], urls: string[] = [], calls: { url: string; method: string; body: any }[] = [];
  const shownAlerts: { title: string; message: string; actions: string[] }[] = [];
  const scheduled: any[] = [], tables: any[] = [], opened: string[] = [];
  let widget: any = null, presented: string | null = null;
  const alerts = [...(o.alerts || [])];
  const files = new Map(Object.entries(o.files || {}));
  for (const [n, c] of Object.entries(o.icloudDocs || {})) files.set("/icloud/Documents/" + n, c);

  const color = (hex: string, alpha?: number) => { if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error("bad colour " + hex); return { hex, alpha: alpha ?? 1, __color: true }; };
  class Color { constructor(hex: string, alpha?: number) { return color(hex, alpha) as any; } }
  class Size { width: number; height: number; constructor(width: number, height: number) { if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("bad size"); this.width = width; this.height = height; } }
  class Point { x: number; y: number; constructor(x: number, y: number) { this.x = x; this.y = y; } }
  class LinearGradient { constructor() { return strict("LinearGradient", {}, ["colors", "locations", "startPoint", "endPoint"], {}); } }
  const FONTS = ["largeTitle", "title1", "title2", "title3", "headline", "subheadline", "body", "callout", "footnote", "caption1", "caption2",
    ...["", "ultraLight", "thin", "light", "regular", "medium", "semibold", "bold", "heavy", "black", "italic"].map(w => (w ? w + "SystemFont" : "systemFont")),
    ...["ultraLight", "thin", "light", "regular", "medium", "semibold", "bold", "heavy", "black"].flatMap(w => [w + "MonospacedSystemFont", w + "RoundedSystemFont"])];
  const Font: any = strict("Font", {}, [], Object.fromEntries(FONTS.map(f => [f, (size?: number) => { if (f.endsWith("SystemFont") && !Number.isFinite(size)) throw new Error("font size"); return { f, size }; }])));

  const textProps = ["text", "font", "textColor", "textOpacity", "lineLimit", "minimumScaleFactor", "shadowColor", "shadowRadius", "shadowOffset", "url"];
  const stackProps = ["backgroundColor", "backgroundImage", "backgroundGradient", "spacing", "size", "cornerRadius", "borderWidth", "borderColor", "url"];
  const mkText = (s: any) => {
    if (typeof s !== "string") throw new Error("addText needs a string, got " + typeof s);
    texts.push(s);
    const t = strict("WidgetText", { text: s, __kind: "text" } as any, textProps, { leftAlignText() {}, centerAlignText() {}, rightAlignText() {} });
    return t;
  };
  const container = (name: string, extraProps: string[], extra: Record<string, Function> = {}) => {
    const kids: any[] = [];
    const self: any = strict(name, { __kids: kids } as any, [...stackProps.filter(p => name === "WidgetStack" || p !== "size" && p !== "cornerRadius" && p !== "borderWidth" && p !== "borderColor"), ...extraProps], {
      addText(s: any) { const t = mkText(s); kids.push(t); return t; },
      addDate(d: Date) { if (!(d instanceof Date)) throw new Error("addDate"); return mkText(d.toISOString()); },
      addImage() { return strict("WidgetImage", {}, ["image", "resizable", "imageSize", "imageOpacity", "cornerRadius", "borderWidth", "borderColor", "containerRelativeShape", "tintColor", "url"], {}); },
      addSpacer(n?: number) { if (n !== undefined && !Number.isFinite(n)) throw new Error("spacer"); kids.push({ __spacer: n ?? null }); },
      addStack() { const s = container("WidgetStack", [], { layoutHorizontally() {}, layoutVertically() {}, topAlignContent() {}, centerAlignContent() {}, bottomAlignContent() {} }); kids.push(s); return s; },
      setPadding(...a: number[]) { if (a.length !== 4 || !a.every(Number.isFinite)) throw new Error("setPadding takes 4 numbers"); },
      useDefaultPadding() {},
      ...extra,
    });
    return self;
  };
  class ListWidget {
    constructor() {
      return container("ListWidget", ["addAccessoryWidgetBackground", "refreshAfterDate"], {
        async presentSmall() { presented = "small"; }, async presentMedium() { presented = "medium"; }, async presentLarge() { presented = "large"; }, async presentExtraLarge() { presented = "extraLarge"; },
      });
    }
  }
  class Request {
    constructor(url: string) {
      const self: any = strict("Request", { url, method: "GET", headers: {}, body: undefined, timeoutInterval: 60, response: { statusCode: 0 } } as any,
        ["url", "method", "headers", "body", "timeoutInterval", "onRedirect", "allowInsecureRequest", "response"], {
          async loadJSON() {
            calls.push({ url: self.url, method: self.method, body: self.body ? JSON.parse(self.body) : null });
            const r = await o.fetcher(self.url, { method: self.method, headers: self.headers, body: self.body });
            self.response = { statusCode: r.status };
            return r.json;
          },
          async loadString() { throw new Error("not used"); },
        });
      return self;
    }
  }
  class DateFormatter {
    constructor() {
      let time = false, date = true;
      return strict("DateFormatter", {}, ["dateFormat", "locale"], {
        useNoDateStyle() { date = false; }, useShortDateStyle() { date = true; }, useMediumDateStyle() {}, useLongDateStyle() {}, useFullDateStyle() {},
        useNoTimeStyle() { time = false; }, useShortTimeStyle() { time = true; }, useMediumTimeStyle() {}, useLongTimeStyle() {}, useFullTimeStyle() {},
        string(d: Date) { if (!(d instanceof Date) || isNaN(+d)) throw new Error("string() needs a Date"); const h = d.getHours(), m = d.getMinutes(); const t = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; return (date ? d.toDateString() + " " : "") + (time ? t : ""); },
        date() { return new Date(); },
      });
    }
  }
  const fmFor = (root: string) => strict("FileManager", {}, [], {
    documentsDirectory: () => root + "/Documents", cacheDirectory: () => root + "/Caches", libraryDirectory: () => root + "/Library", temporaryDirectory: () => root + "/tmp",
    joinPath: (a: string, b: string) => a.replace(/\/$/, "") + "/" + b,
    fileExists: (p: string) => files.has(p), isDirectory: (p: string) => [...files.keys()].some(k => k.startsWith(p + "/")),
    listContents: (dir: string) => [...files.keys()].filter(k => k.startsWith(dir + "/") && !k.slice(dir.length + 1).includes("/")).map(k => k.slice(dir.length + 1)),
    readString: (p: string) => files.get(p) ?? null, writeString: (p: string, s: string) => { if (typeof s !== "string") throw new Error("writeString"); files.set(p, s); },
    remove: (p: string) => files.delete(p), isFileStoredIniCloud: (p: string) => p.startsWith("/icloud/"), downloadFileFromiCloud: async () => {},
    fileName: (p: string) => p.split("/").pop(), fileExtension: (p: string) => p.split(".").pop(), createDirectory() {},
  });
  const FileManager = strict("FileManager", {}, [], { local: () => fmFor("/local"), iCloud: () => fmFor("/icloud") });
  const CalendarEvent = strict("CalendarEvent", {}, [], {
    async between(a: Date, b: Date, cals: any[]) { if (!(a instanceof Date) || !(b instanceof Date) || !Array.isArray(cals)) throw new Error("between(start, end, calendars)"); return (o.events || []).map(e => ({ ...e })); },
    async today() { return o.events || []; }, async tomorrow() { return []; },
  });
  const URLScheme = strict("URLScheme", {}, [], { forRunningScript: () => "scriptable:///run/" + encodeURIComponent(o.scriptName || "Brad HQ"), allParameters: () => o.query || {}, parameter: (k: string) => (o.query || {})[k] });
  const Script = strict("Script", {}, [], { name: () => o.scriptName || "Brad HQ", setWidget(w: any) { widget = w; }, complete() {}, setShortcutOutput() {} });
  class Alert {
    constructor() {
      const fields: string[] = [], actions: string[] = [];
      let answer: { index: number; text?: string } | null = null;
      const self: any = strict("Alert", { title: "", message: "" } as any, ["title", "message"], {
        addAction(t: string) { actions.push(t); }, addDestructiveAction(t: string) { actions.push(t); }, addCancelAction(t: string) { actions.push("(cancel) " + t); },
        addTextField(ph?: string, v?: string) { fields.push(v || ""); }, addSecureTextField() { fields.push(""); },
        textFieldValue(i: number) { if (i >= fields.length) throw new Error("no text field " + i); return answer?.text ?? fields[i]; },
        async presentAlert() { shownAlerts.push({ title: self.title, message: self.message, actions: [...actions] }); answer = alerts.shift() || { index: 0 }; return answer.index; },
        async present() { return self.presentAlert(); }, async presentSheet() { return self.presentAlert(); },
      });
      return self;
    }
  }
  class Notification {
    constructor() {
      const self: any = strict("Notification", {} as any, ["identifier", "title", "subtitle", "body", "preferredContentHeight", "badge", "threadIdentifier", "userInfo", "sound", "openURL", "deliveryDate", "nextTriggerDate", "scriptName", "actions"], {
        async schedule() { scheduled.push({ title: self.title, body: self.body, identifier: self.identifier, at: self.__at }); },
        async remove() {}, setTriggerDate(d: Date) { if (!(d instanceof Date)) throw new Error("setTriggerDate"); self.__at = d; }, setDailyTrigger() {}, setWeeklyTrigger() {}, addAction() {},
      });
      return self;
    }
    static async removePending(ids: string[]) { if (!Array.isArray(ids)) throw new Error("removePending([ids])"); }
    static async removeDelivered() {}
    static async allPending() { return []; }
  }
  const cellProps = ["widthWeight", "onTap", "dismissOnTap", "titleColor", "subtitleColor", "titleFont", "subtitleFont"];
  const cell = (title: any, subtitle: any) => strict("UITableCell", { __title: title, __subtitle: subtitle } as any, cellProps, { leftAligned() {}, centerAligned() {}, rightAligned() {} });
  class UITableRow {
    constructor() {
      const cells: any[] = [];
      return strict("UITableRow", { __cells: cells } as any, ["cellSpacing", "height", "isHeader", "dismissOnSelect", "onSelect", "backgroundColor"], {
        addText(t: any, s?: any) { if (typeof t !== "string") throw new Error("addText title"); const c = cell(t, s); cells.push(c); return c; },
        addImage() { return cell("", null); }, addButton(t: string) { const c = cell(t, null); cells.push(c); return c; }, addCell(c: any) { cells.push(c); },
      });
    }
  }
  class UITable {
    constructor() {
      const rows: any[] = [];
      const self: any = strict("UITable", { __rows: rows } as any, ["showSeparators"], {
        addRow(r: any) { rows.push(r); }, removeRow(r: any) { rows.splice(rows.indexOf(r), 1); }, removeAllRows() { rows.length = 0; }, reload() {},
        async present() { tables.push(self); },
      });
      return self;
    }
  }
  const Safari = strict("Safari", {}, [], { open(u: string) { opened.push(u); }, async openInApp(u: string) { opened.push(u); } });
  const inWidget = o.inWidget !== false;
  const ro = (name: string, o: any) => strict(name, o, Object.keys(o), {});
  const config = ro("config", { runsInWidget: inWidget && !String(o.family || "").startsWith("accessory"), runsInAccessoryWidget: inWidget && String(o.family || "").startsWith("accessory"), runsInApp: !inWidget, runsInActionExtension: false, runsWithSiri: false, runsInNotification: false, runsFromHomeScreen: false, widgetFamily: inWidget ? o.family || "medium" : undefined });
  const args = ro("args", { queryParameters: o.query || {}, widgetParameter: null, shortcutParameter: null, plainTexts: [], urls: [], fileURLs: [], images: [], notification: null });
  const ctx = { Color, Size, Point, LinearGradient, Font, ListWidget, Request, DateFormatter, FileManager, CalendarEvent, URLScheme, Script, Alert, Notification, UITable, UITableRow, Safari, config, args, console, JSON, Math, Date, String, Number, Promise, Error, Object, Array, encodeURIComponent, decodeURIComponent, RegExp, isNaN };
  await vm.runInNewContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 5000 });

  /* Every tap target the widget has, and its texts, walked in order. */
  const walk = (n: any, out: { texts: string[]; urls: string[] }) => {
    if (!n) return out;
    if (n.__kind === "text") { out.texts.push(n.text); if (n.url) out.urls.push(n.url); return out; }
    if (n.url) out.urls.push(n.url);
    for (const k of n.__kids || []) walk(k, out);
    return out;
  };
  const drawn = walk(widget, { texts: [], urls: [] });
  return { widget, drawn, texts, calls, shownAlerts, scheduled, tables, opened, presented, files };
}

export const tableRows = (t: any) => (t?.__rows || []).map((r: any) => ({ row: r, title: r.__cells[0]?.__title, subtitle: r.__cells[0]?.__subtitle }));
