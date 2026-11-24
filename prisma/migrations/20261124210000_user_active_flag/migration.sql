-- Lets a staff account be deactivated (instead of deleted, which would
-- orphan their attribution on communications/screenings/tours/rent
-- recommendations). Defaults true so every existing account stays usable.
ALTER TABLE "users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
