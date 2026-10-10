import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  isClosureDue,
  localDate,
  localTime,
  isValidClosureTime,
} from "../src/modules/sales/posOperations.rules.js";

test("la clôture ne devient due qu'à l'heure configurée", () => {
  assert.equal(isClosureDue("19:59", "20:00:00"), false);
  assert.equal(isClosureDue("20:00", "20:00:00"), true);
  assert.equal(isClosureDue("23:59", "20:00:00"), true);
});

test("les dates commerciales progressent sans dépendre du fuseau du serveur", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("la date et l'heure commerciales sont produites dans le fuseau de Madagascar", () => {
  const instant = new Date("2026-10-10T17:00:00.000Z");
  assert.equal(localDate(instant), "2026-10-10");
  assert.equal(localTime(instant), "20:00");
});

test("les heures de clôture configurées sont strictement validées", () => {
  assert.equal(isValidClosureTime("00:00"), true);
  assert.equal(isValidClosureTime("23:59"), true);
  assert.equal(isValidClosureTime("24:00"), false);
  assert.equal(isValidClosureTime("20:60"), false);
  assert.equal(isValidClosureTime("8:00"), false);
});
