Assignment 3 - Conspiracy Viability Calculator
===

Due: September 15th, by 1:59 PM.
https://a3-lex-moulton.onrender.com

Lex Moulton - WPI CS 4241 Assignment 3

A calculator for how long a conspiracy can stay secret, based on David Grimes' 2016 paper.
You enter a theory and how many conspiritors it has and how long its been running and it tells you the chance that it has been leaked and the time till it is guaranteed to have leaked.

This is A2 moved onto Express, with the data stored in MongoDB and user accounts so each person only sees their own theories.

Login is username and password, hashed with `bcryptjs` and kept in a session with `express-session`. If the username doesn't exist an account is made and the main page tells you. I went with this because it was the simplest to set up.

The CSS is from Pico CSS. I overrode its color variables to use my adobe color pallete, and added a few flex rules so the title and buttons sit on one line in the header and on each card.

## Instructions

Run `npm install`, put `MONGODB_URI` and `SESSION_SECRET` in a `.env`, then `npm start` and open `http://localhost:3000`.
Log in, press **New Conspiracy +** to open the entry form, fill in the fields then press **Add Conspiracy**. Press **Edit** to load that theory back into the form and change it, or **Delete** to remove it.

## Technical Achievements

- **Express middleware**:
  - `express-session` keeps users logged in between requests.
  - `helmet` sets security headers like `Content-Security-Policy` and removes `X-Powered-By`.
  - `morgan` logs each request's method, path, status, and response time.
  - `compression` gzips responses so the CSS and JSON are smaller.
  - `express-rate-limit` caps `/login` attempts per IP to slow down password guessing.
