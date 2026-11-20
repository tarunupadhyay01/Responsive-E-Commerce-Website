# Fernwick – Responsive Full-Stack E-Commerce Website

Internship task: **Full Stack Development – Responsive E-Commerce Website** (Vinix Technologies).

A plant and planter store with a responsive UI, a REST API and a SQLite database.

## Features
- Responsive layout (2-column grid on phones, auto-fill grid on larger screens, slide-in cart panel)
- Modern CSS: custom properties, CSS Grid/Flexbox, automatic dark mode, reduced-motion support
- Search, category filter and sorting
- Cart with quantity controls (stored in `localStorage`)
- Checkout with client- and server-side validation
- Orders saved in SQLite; stock reduced inside a single database transaction
- Server recalculates prices from the database, so clients cannot change prices

## Tech stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: SQLite (`better-sqlite3`)

## Run locally
```bash
npm install
npm start
# open http://localhost:3000
```
The database file `shop.db` is created and seeded automatically on first run.

## API
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| POST | `/api/orders` | Place an order: `{customer, email, address, items:[{id, qty}]}` |
| GET | `/api/orders?email=` | List orders for an email |

## Database schema
`products` (id, name, category, price, emoji, color, description, stock) ·
`orders` (id, customer, email, address, total, created_at) ·
`order_items` (id, order_id → orders, product_id → products, quantity, unit_price)

## Folder structure
```
├── server.js          Express server, schema, seed data, API
├── package.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```
