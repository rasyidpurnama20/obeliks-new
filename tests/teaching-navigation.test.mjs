import assert from "node:assert/strict";
import test from "node:test";
import {
  getNavigationForRole,
  teachingSubnavigation,
} from "../src/lib/mvp/data.ts";

test("Pengajaran Saya is scoped to Dosen", () => {
  for (const role of ["admin", "kaprodi", "gpm", "mahasiswa"]) {
    assert.equal(
      getNavigationForRole(role).flatMap(({ items }) => items).some(({ id }) => id === "pengajaran-saya"),
      false,
    );
  }

  assert.equal(
    getNavigationForRole("dosen").flatMap(({ items }) => items).some(({ id }) => id === "pengajaran-saya"),
    true,
  );
});

test("the open Dosen submenu has one stable level and all workspace destinations", () => {
  const ids = teachingSubnavigation.map(({ id }) => id);

  assert.deepEqual(ids, ["courses", "rps", "pelaksanaan", "evaluasi", "riwayat"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(teachingSubnavigation.every(({ label, description }) => label && description));
});
