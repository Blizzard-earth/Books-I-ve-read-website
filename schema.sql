-- Run this inside your PostgreSQL database (in pgAdmin: right-click your
-- database -> Query Tool -> paste this -> press F5).

CREATE TABLE IF NOT EXISTS book_notes (
    id                 SERIAL PRIMARY KEY,
    title              VARCHAR(255) NOT NULL,
    author             VARCHAR(255),
    isbn               VARCHAR(20),               -- optional, used as a cover fallback
    cover_id           INTEGER,                   -- Open Library "cover_i" number
    first_publish_year INTEGER,
    rating             INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    date_read          DATE NOT NULL DEFAULT CURRENT_DATE,
    summary            VARCHAR(300),              -- short blurb shown on the front page
    notes              TEXT                       -- your full notes, shown on the book page
);

-- A few sample rows so the website is not empty the first time you run it.
-- (They use ISBNs for covers. Books you add through the search page use cover ids.)
INSERT INTO book_notes (title, author, isbn, first_publish_year, rating, date_read, summary, notes)
VALUES
('Oliver Twist', 'Charles Dickens', '9780141439747', 1838, 5, '2026-11-12',
 'An orphan boy survives poverty and crime in Victorian London.',
 'My favourite part was how Dickens shows the workhouse and the streets of London. Oliver stays kind even when everyone around him is cruel. Fagin and the Artful Dodger are unforgettable characters. The ending ties every thread together.'),
('Atomic Habits', 'James Clear', '9780735211292', 2018, 4, '2026-10-02',
 'Small daily changes compound into big results.',
 'Key ideas: make habits obvious, attractive, easy and satisfying. Focus on your identity, not just your goals. Improving by 1 percent every day adds up over time.'),
('The Alchemist', 'Paulo Coelho', '9780062315007', 1988, 3, '2026-09-05',
 'A shepherd travels to Egypt to follow his personal legend.',
 'A short, simple story about following your dreams. The idea that the whole universe helps you when you truly want something stayed with me.');
