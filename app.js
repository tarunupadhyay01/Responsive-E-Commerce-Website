/* Frontend logic: fetches data from the Express/SQLite API; cart lives in localStorage. */
let products = [], cart = JSON.parse(localStorage.getItem("cart") || "[]");
let cat = "All", term = "", sortBy = "feat";
const $ = s => document.querySelector(s);
const money = n => "$" + n.toFixed(2);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const saveCart = () => localStorage.setItem("cart", JSON.stringify(cart));
const find = id => products.find(p => p.id === id);
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }

async function loadProducts() {
  products = await (await fetch("/api/products")).json();
  cart = cart.filter(c => find(c.id)).map(c => ({ ...c, qty: Math.min(c.qty, find(c.id).stock) })).filter(c => c.qty > 0);
  saveCart(); renderChips(); refresh();
}
function renderChips() {
  const cats = ["All", ...new Set(products.map(p => p.category))];
  $("#chips").innerHTML = cats.map(c => `<button class="chip" aria-pressed="${c === cat}" data-c="${c}">${c}</button>`).join("");
}
function renderGrid() {
  const sorters = { lo: (a, b) => a.price - b.price, hi: (a, b) => b.price - a.price, az: (a, b) => a.name.localeCompare(b.name), feat: (a, b) => a.id - b.id };
  const list = products.filter(p => (cat === "All" || p.category === cat) && (p.name + " " + p.description).toLowerCase().includes(term.toLowerCase())).sort(sorters[sortBy]);
  $("#grid").innerHTML = list.length ? list.map(p => {
    const inCart = (cart.find(c => c.id === p.id) || { qty: 0 }).qty, left = p.stock - inCart;
    return `<article class="card"><div class="tile" style="background:${p.color}" aria-hidden="true">${p.emoji}</div>
      <div class="info"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>
      <div class="row"><span class="price">${money(p.price)}</span>
      <button class="add" data-add="${p.id}" ${left <= 0 ? "disabled" : ""}>${p.stock === 0 ? "Sold out" : left <= 0 ? "Max in cart" : "Add to cart"}</button></div>
      ${p.stock > 0 && p.stock <= 5 ? `<small style="color:var(--danger)">Only ${p.stock} left</small>` : ""}</div></article>`;
  }).join("") : `<div class="empty"><h2>No matches</h2><p>Try a different word or clear the category filter.</p></div>`;
}
function setQty(id, q) {
  const p = find(id);
  if (q > p.stock) return toast("That's all we have in stock");
  if (q <= 0) cart = cart.filter(c => c.id !== id);
  else { const c = cart.find(c => c.id === id); c ? c.qty = q : cart.push({ id, qty: q }); }
  saveCart(); refresh();
}
const total = () => cart.reduce((s, c) => s + c.qty * find(c.id).price, 0);
function renderCart() {
  $("#ptitle").textContent = "Your cart";
  $("#cnt").textContent = cart.reduce((s, c) => s + c.qty, 0);
  if (!cart.length) { $("#pbody").innerHTML = `<p class="empty">Your cart is empty. Add a plant to get started.</p>`; $("#pfoot").innerHTML = ""; return; }
  $("#pbody").innerHTML = cart.map(c => { const p = find(c.id);
    return `<div class="line"><div class="em">${p.emoji}</div><div><b>${esc(p.name)}</b><div class="qty"><button data-q="${p.id}" data-d="-1" aria-label="Decrease quantity">−</button><span>${c.qty}</span><button data-q="${p.id}" data-d="1" aria-label="Increase quantity">+</button></div></div><b>${money(c.qty * p.price)}</b></div>`; }).join("");
  $("#pfoot").innerHTML = `<div class="total"><span>Total</span><span>${money(total())}</span></div>
    <form class="f" id="co" novalidate><input name="customer" placeholder="Full name" autocomplete="name"><input name="email" type="email" placeholder="Email" autocomplete="email"><input name="address" placeholder="Delivery address" autocomplete="street-address">
    <div class="err" id="err"></div><button class="primary" type="submit">Place order</button></form>`;
}
async function checkout(e) {
  e.preventDefault();
  const v = Object.fromEntries(new FormData(e.target)), bad = [];
  if (v.customer.trim().length < 2) bad.push("customer");
  if (v.address.trim().length < 2) bad.push("address");
  if (!/^\S+@\S+\.\S+$/.test(v.email)) bad.push("email");
  e.target.querySelectorAll("input").forEach(i => i.classList.toggle("bad", bad.includes(i.name)));
  if (bad.length) return void ($("#err").textContent = "Check the highlighted fields: name, a valid email and delivery address are required.");
  const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, items: cart }) });
  const data = await res.json();
  if (!res.ok) { $("#err").textContent = data.error; await loadProducts(); return; }
  localStorage.setItem("email", v.email.trim());
  cart = []; saveCart(); closePanel(); await loadProducts();
  toast(`Order #${data.id} placed. Thank you, ${v.customer.split(" ")[0]}!`);
}
async function showOrders() {
  const email = localStorage.getItem("email") || prompt("Enter the email you ordered with:");
  if (!email) return;
  const os = await (await fetch("/api/orders?email=" + encodeURIComponent(email))).json();
  $("#ptitle").textContent = "Your orders"; $("#pfoot").innerHTML = "";
  $("#pbody").innerHTML = os.length ? os.map(o => `<div class="ord"><b>Order #${o.id}</b> · ${new Date(o.created_at + "Z").toLocaleDateString()}<br>${o.items.map(i => `${i.quantity} × ${esc(i.name)}`).join(", ")}<br><b>${money(o.total)}</b> to ${esc(o.address)}</div>`).join("") : `<p class="empty">No orders yet for ${esc(email)}.</p>`;
  openPanel();
}
function openPanel() { $("#panel").classList.add("on"); $("#scrim").classList.add("on"); $("#panel").setAttribute("aria-hidden", "false"); }
function closePanel() { $("#panel").classList.remove("on"); $("#scrim").classList.remove("on"); $("#panel").setAttribute("aria-hidden", "true"); renderCart(); }
function refresh() { renderCart(); renderGrid(); }

$("#cartBtn").onclick = () => { renderCart(); openPanel(); };
$("#ordersBtn").onclick = showOrders;
$("#close").onclick = closePanel; $("#scrim").onclick = closePanel;
document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
$("#q").oninput = e => { term = e.target.value; renderGrid(); };
$("#sort").onchange = e => { sortBy = e.target.value; renderGrid(); };
$("#chips").onclick = e => { const b = e.target.closest("[data-c]"); if (b) { cat = b.dataset.c; renderChips(); renderGrid(); } };
$("#grid").onclick = e => { const b = e.target.closest("[data-add]"); if (b) { const id = +b.dataset.add, ex = cart.find(c => c.id === id); setQty(id, (ex ? ex.qty : 0) + 1); toast(find(id).name + " added to cart"); } };
$("#pbody").onclick = e => { const b = e.target.closest("[data-q]"); if (b) { const id = +b.dataset.q; setQty(id, cart.find(c => c.id === id).qty + +b.dataset.d); } };
$("#pfoot").addEventListener("submit", e => { if (e.target.id === "co") checkout(e); });
loadProducts().catch(() => toast("Could not reach the server. Is `npm start` running?"));
