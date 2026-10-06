-- Webshelf's click counts: one row per search code and page, nothing else.
-- q:       a scrambled code made from the search (SHA-256, first 32 hex digits)
-- u:       the chosen page's address, without anything after "?" or "#"
-- n:       clicks counted
-- pos_sum: the positions those clicks were made at, added up (n and pos_sum
--          give the average position, for correcting the pull of the top spot)
-- day, today_n: the last day it was clicked and how often that day, so one
--          page's count for one search can rise by at most 20 a day
CREATE TABLE IF NOT EXISTS clicks (
  q TEXT NOT NULL,
  u TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  pos_sum INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  today_n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (q, u)
);
