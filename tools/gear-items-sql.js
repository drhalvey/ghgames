// Prints the SQL that loads gear.js's catalogue into public.gear_items (run: node tools/gear-items-sql.js)
const fs = require("fs"), vm = require("vm");
const win = { setInterval() {}, setTimeout() {}, addEventListener() {}, localStorage: { getItem() { return null; }, setItem() {} } };
win.window = win;
vm.runInNewContext(fs.readFileSync(__dirname + "/../gear.js", "utf8"), Object.assign(win, { localStorage: win.localStorage }));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const rows = win.Gear.items.map(it => `(${q(it.id)},${q(it.slot)},${q(it.name)},${q(it.rarity)},${it.price},${q(it.source)},${it.level},${it.sort})`);
console.log("insert into public.gear_items(id, slot, name, rarity, price, source, level, sort) values\n" + rows.join(",\n") +
  "\non conflict (id) do update set slot = excluded.slot, name = excluded.name, rarity = excluded.rarity, price = excluded.price, source = excluded.source, level = excluded.level, sort = excluded.sort;");
