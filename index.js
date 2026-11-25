// ============================================================
//  My Diary: book notes website
//  Stack: Express + EJS + PostgreSQL (pg) + Axios (Open Library API)
// ============================================================
import express from "express";
import axios from "axios";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config(); // loads the values from the .env file

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const siteOwner = process.env.SITE_OWNER || "Azaan";

// ---------- Database connection ----------
const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

// Log a clear message at start-up if the database cannot be reached.
db.query("SELECT 1")
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) =>
    console.error("Could not connect to PostgreSQL. Check your .env file:", err.message)
  );

// ---------- App settings ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public"))); // css, js, images
app.use(express.urlencoded({ extended: true })); // read form data

// ---------- Helpers available inside every EJS template ----------

// Build the cover image URL. We prefer the Open Library cover id.
// If there is none, we try the ISBN. "default=false" makes Open Library
// return a 404 when no cover exists, so the page can show a placeholder.
function coverUrl(book, size = "L") {
  if (book.cover_id) {
    return `https://covers.openlibrary.org/b/id/${book.cover_id}-${size}.jpg?default=false`;
  }
  if (book.isbn) {
    return `https://covers.openlibrary.org/b/isbn/${book.isbn}-${size}.jpg?default=false`;
  }
  return null;
}

// Turn a rating number into stars, e.g. 4 -> ★★★★☆
function stars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

// Show a date like "12 Nov 2026"
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Format a date for <input type="date"> (needs YYYY-MM-DD)
function inputDate(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

app.use((req, res, next) => {
  res.locals.coverUrl = coverUrl;
  res.locals.stars = stars;
  res.locals.formatDate = formatDate;
  res.locals.inputDate = inputDate;
  res.locals.siteOwner = siteOwner;
  next();
});

// Show the error page with a friendly message.
function showError(res, status, message) {
  res.status(status).render("error.ejs", { status, message });
}

// Read and check the book form. Returns { error } or { data }.
function readBookForm(body) {
  const title = (body.title || "").trim();
  const rating = parseInt(body.rating, 10);

  if (!title) return { error: "Please enter a book title." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be a number from 1 to 5." };
  }

  const year = parseInt(body.first_publish_year, 10);
  const coverId = parseInt(body.cover_id, 10);

  return {
    data: {
      title,
      author: (body.author || "").trim() || null,
      isbn: (body.isbn || "").trim() || null,
      cover_id: Number.isInteger(coverId) ? coverId : null,
      first_publish_year: Number.isInteger(year) ? year : null,
      rating,
      date_read: body.date_read || inputDate(new Date()),
      summary: (body.summary || "").trim().slice(0, 300) || null,
      notes: (body.notes || "").trim() || null,
    },
  };
}

// ============================================================
//  READ: front page (list, total, sort, search)
// ============================================================
// Allowed sort choices. We use a fixed list so users can never
// inject their own SQL into the ORDER BY part.
const SORTS = {
  top: "rating DESC, date_read DESC",
  newest: "date_read DESC, id DESC",
  title: "title ASC",
};

app.get("/", async (req, res) => {
  const sort = SORTS[req.query.sort] ? req.query.sort : "top";
  const q = (req.query.q || "").trim();

  try {
    // Total number of books (ignores the search)
    const totalResult = await db.query("SELECT COUNT(*) FROM book_notes");
    const total = parseInt(totalResult.rows[0].count, 10);

    // List of books. $1 is filled in safely by pg (parameterised query).
    let result;
    if (q) {
      result = await db.query(
        `SELECT * FROM book_notes
         WHERE title ILIKE $1 OR author ILIKE $1
         ORDER BY ${SORTS[sort]}`,
        [`%${q}%`]
      );
    } else {
      result = await db.query(`SELECT * FROM book_notes ORDER BY ${SORTS[sort]}`);
    }

    res.render("index.ejs", { books: result.rows, total, sort, q });
  } catch (err) {
    console.error("Error loading books:", err.message);
    showError(res, 500, "Could not load your books. Is PostgreSQL running?");
  }
});

// ============================================================
//  CREATE: add-book page, Open Library search, save
// ============================================================

// Show the add page. If ?title=... is given, search Open Library with Axios.
app.get("/add", async (req, res) => {
  const title = (req.query.title || "").trim();
  let results = [];
  let searchError = null;

  if (title) {
    try {
      const response = await axios.get("https://openlibrary.org/search.json", {
        params: {
          title,
          limit: 6,
          fields: "title,author_name,first_publish_year,cover_i,isbn",
        },
        timeout: 8000, // give up after 8 seconds
      });

      results = response.data.docs.map((doc) => ({
        title: doc.title,
        author: doc.author_name ? doc.author_name[0] : "",
        year: doc.first_publish_year || "",
        cover_id: doc.cover_i || "",
        isbn: doc.isbn ? doc.isbn[0] : "",
      }));

      if (results.length === 0) searchError = "No books found. Try a different title.";
    } catch (err) {
      console.error("Open Library search failed:", err.message);
      searchError = "Could not reach Open Library. You can still fill the form by hand.";
    }
  }

  res.render("add.ejs", { title, results, searchError, error: null, form: {} });
});

// Save a new book.
app.post("/add", async (req, res) => {
  const { error, data } = readBookForm(req.body);
  if (error) {
    return res
      .status(400)
      .render("add.ejs", { title: "", results: [], searchError: null, error, form: req.body });
  }

  try {
    await db.query(
      `INSERT INTO book_notes
        (title, author, isbn, cover_id, first_publish_year, rating, date_read, summary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.title, data.author, data.isbn, data.cover_id, data.first_publish_year,
        data.rating, data.date_read, data.summary, data.notes,
      ]
    );
    res.redirect("/");
  } catch (err) {
    console.error("Error adding book:", err.message);
    showError(res, 500, "Could not save the book. Please try again.");
  }
});

// ============================================================
//  READ: single book page
// ============================================================
app.get("/book/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return showError(res, 404, "That book does not exist.");

  try {
    const result = await db.query("SELECT * FROM book_notes WHERE id = $1", [id]);
    if (result.rows.length === 0) return showError(res, 404, "That book does not exist.");
    res.render("book.ejs", { book: result.rows[0] });
  } catch (err) {
    console.error("Error loading book:", err.message);
    showError(res, 500, "Could not load this book.");
  }
});

// ============================================================
//  UPDATE: edit page and save changes
// ============================================================
app.get("/book/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return showError(res, 404, "That book does not exist.");

  try {
    const result = await db.query("SELECT * FROM book_notes WHERE id = $1", [id]);
    if (result.rows.length === 0) return showError(res, 404, "That book does not exist.");
    res.render("edit.ejs", { book: result.rows[0], error: null });
  } catch (err) {
    console.error("Error loading book for edit:", err.message);
    showError(res, 500, "Could not load this book.");
  }
});

app.post("/book/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return showError(res, 404, "That book does not exist.");

  const { error, data } = readBookForm(req.body);
  if (error) {
    return res.status(400).render("edit.ejs", { book: { id, ...req.body }, error });
  }

  try {
    const result = await db.query(
      `UPDATE book_notes
       SET title = $1, author = $2, isbn = $3, cover_id = $4, first_publish_year = $5,
           rating = $6, date_read = $7, summary = $8, notes = $9
       WHERE id = $10`,
      [
        data.title, data.author, data.isbn, data.cover_id, data.first_publish_year,
        data.rating, data.date_read, data.summary, data.notes, id,
      ]
    );
    if (result.rowCount === 0) return showError(res, 404, "That book does not exist.");
    res.redirect(`/book/${id}`);
  } catch (err) {
    console.error("Error updating book:", err.message);
    showError(res, 500, "Could not update the book. Please try again.");
  }
});

// ============================================================
//  DELETE
// ============================================================
app.post("/book/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return showError(res, 404, "That book does not exist.");

  try {
    await db.query("DELETE FROM book_notes WHERE id = $1", [id]);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting book:", err.message);
    showError(res, 500, "Could not delete the book. Please try again.");
  }
});

// Any other address: show a 404 page.
app.use((req, res) => showError(res, 404, "Page not found."));

app.listen(port, () => {
  console.log(`My Diary is running at http://localhost:${port}`);
});
