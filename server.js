const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const db = new Database(path.join(__dirname, "shop.db"));
db.pragma("foreign_keys = ON");

/* ---------- Schema ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  price REAL NOT NULL CHECK(price >= 0), emoji TEXT, color TEXT,
  description TEXT, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0));
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, email TEXT NOT NULL,
  address TEXT NOT NULL, total REAL NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price REAL NOT NULL);
`);

/* ---------- Seed data ---------- */
if (db.prepare("SELECT COUNT(*) c FROM products").get().c === 0) {
  const ins = db.prepare("INSERT INTO products(name,category,price,emoji,color,description,stock) VALUES (?,?,?,?,?,?,?)");
  const rows = [
    ["Monstera Deliciosa","Plants",34,"🌿","#cfe8d5","Bold split leaves; thrives in bright, indirect light.",12],
    ["Snake Plant","Plants",22,"🪴","#dfe9c8","Nearly unkillable. Tolerates low light.",20],
    ["Pothos Trailing","Plants",16,"🍃","#d3ecdc","Fast-growing vine for shelves and hanging pots.",25],
    ["Fiddle Leaf Fig","Plants",48,"🌳","#c9e3cf","A statement tree for a bright corner.",5],
    ["Aloe Vera","Succulents",14,"🌵","#e3efc9","Soothing gel and sculptural leaves.",18],
    ["Echeveria Mix","Succulents",18,"🪷","#f1dcd9","Three rosettes in soft pastel shades.",3],
    ["Jade Plant","Succulents",20,"🌱","#d4ecd0","Thick glossy leaves; lives for decades.",9],
    ["Speckled Planter","Planters",28,"🏺","#efe6d2","Hand-glazed stoneware with drainage hole.",14],
    ["Hanging Basket","Planters",24,"🧺","#ecdcc4","Woven cotton rope with a removable liner.",0],
    ["Terracotta Trio","Planters",32,"🪔","#f0d6c6","Three sizes, unglazed and breathable.",16],
    ["Mist Spray Bottle","Care",12,"💧","#d2e6f0","Fine mist bottle, 500 ml.",30],
    ["Organic Potting Mix","Care",15,"🛍️","#e4dccb","Peat-free blend with perlite, 5 L.",22],
  ];
  db.transaction(() => rows.forEach(r => ins.run(...r)))();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ---------- API ---------- */
app.get("/api/products", (req, res) => {
  res.json(db.prepare("SELECT * FROM products ORDER BY id").all());
});

app.post("/api/orders", (req, res) => {
  const { customer, email, address, items } = req.body || {};
  if (!customer?.trim() || !address?.trim() || !/^\S+@\S+\.\S+$/.test(email || ""))
    return res.status(400).json({ error: "Name, valid email and address are required." });
  if (!Array.isArray(items) || !items.length)
    return res.status(400).json({ error: "Cart is empty." });

  const getP = db.prepare("SELECT * FROM products WHERE id = ?");
  const dec = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
  const insO = db.prepare("INSERT INTO orders(customer,email,address,total) VALUES (?,?,?,?)");
  const insI = db.prepare("INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)");

  try {
    const result = db.transaction(() => {
      let total = 0;
      const lines = items.map(({ id, qty }) => {
        const p = getP.get(id);
        if (!p || !Number.isInteger(qty) || qty < 1) throw { status: 400, msg: "Invalid cart item." };
        if (p.stock < qty) throw { status: 409, msg: `Only ${p.stock} left of ${p.name}.` };
        total += p.price * qty; // price always comes from the database, never the client
        return { p, qty };
      });
      const orderId = insO.run(customer.trim(), email.trim(), address.trim(), total).lastInsertRowid;
      lines.forEach(({ p, qty }) => { insI.run(orderId, p.id, qty, p.price); dec.run(qty, p.id); });
      return { id: orderId, total };
    })();
    res.status(201).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.msg || "Could not place order." });
  }
});

app.get("/api/orders", (req, res) => {
  const email = (req.query.email || "").trim();
  if (!email) return res.status(400).json({ error: "email query parameter is required." });
  const orders = db.prepare("SELECT * FROM orders WHERE email = ? ORDER BY id DESC").all(email);
  const items = db.prepare(`SELECT oi.quantity, oi.unit_price, p.name FROM order_items oi
    JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`);
  res.json(orders.map(o => ({ ...o, items: items.all(o.id) })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fernwick running at http://localhost:${PORT}`));
