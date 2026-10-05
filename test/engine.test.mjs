import assert from "node:assert/strict";
import test from "node:test";
import { canMove, createGame, makeGame, move, restore, snapshot } from "../engine.mjs";

function cells(game) {
  return game.tiles
    .map((tile) => `${tile.r},${tile.c}:${tile.value}`)
    .sort()
    .join(" ");
}

function scripted(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function overlaps(game) {
  const seen = new Set();
  for (const tile of game.tiles) {
    const key = `${tile.r},${tile.c}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

test("left merges a pair once and does not chain the result", () => {
  const game = makeGame(
    [
      { id: 1, value: 2, r: 0, c: 0 },
      { id: 2, value: 2, r: 0, c: 1 },
      { id: 3, value: 2, r: 0, c: 2 },
      { id: 4, value: 2, r: 0, c: 3 },
    ],
    () => 0,
  );
  const result = move(game, "left");
  assert.equal(result.moved, true);
  assert.equal(result.gained, 8);
  assert.equal(result.removed.length, 2);
  const row = game.tiles.filter((tile) => tile.r === 0).sort((a, b) => a.c - b.c);
  assert.deepEqual(
    row.slice(0, 2).map((tile) => tile.value),
    [4, 4],
  );
  assert.equal(game.score, 8);
  assert.equal(game.tiles.length, 3);
});

test("three twos become a four and a two, not an eight", () => {
  const game = makeGame(
    [
      { id: 1, value: 2, r: 0, c: 0 },
      { id: 2, value: 2, r: 0, c: 1 },
      { id: 3, value: 2, r: 0, c: 2 },
    ],
    () => 0.95,
  );
  move(game, "left");
  const row = game.tiles.filter((tile) => tile.r === 0).sort((a, b) => a.c - b.c);
  assert.deepEqual(
    row.slice(0, 2).map((tile) => [tile.c, tile.value]),
    [
      [0, 4],
      [1, 2],
    ],
  );
});

test("right merges the pair closest to the wall", () => {
  const game = makeGame(
    [
      { id: 1, value: 2, r: 1, c: 0 },
      { id: 2, value: 2, r: 1, c: 1 },
      { id: 3, value: 2, r: 1, c: 2 },
    ],
    () => 0,
  );
  const result = move(game, "right");
  assert.equal(result.gained, 4);
  const row = game.tiles.filter((tile) => tile.r === 1).sort((a, b) => a.c - b.c);
  assert.deepEqual(
    row.filter((tile) => tile.value !== 2 || tile.c >= 2).map((tile) => [tile.c, tile.value]),
    [
      [2, 2],
      [3, 4],
    ],
  );
});

test("up slides a tile to the top wall", () => {
  const game = makeGame([{ id: 1, value: 8, r: 3, c: 2 }], () => 0);
  move(game, "up");
  const moved = game.tiles.find((tile) => tile.value === 8);
  assert.equal(moved.r, 0);
  assert.equal(moved.c, 2);
});

test("a packed row does not spawn or score", () => {
  const tiles = [
    { id: 1, value: 2, r: 0, c: 0 },
    { id: 2, value: 4, r: 0, c: 1 },
    { id: 3, value: 8, r: 0, c: 2 },
    { id: 4, value: 16, r: 0, c: 3 },
  ];
  const game = makeGame(tiles, () => 0);
  const before = cells(game);
  const result = move(game, "left");
  assert.equal(result.moved, false);
  assert.equal(result.gained, 0);
  assert.equal(game.score, 0);
  assert.equal(cells(game), before);
  assert.equal(game.nextId, 5);
});

test("a full board with no neighbors cannot move", () => {
  const tiles = [];
  let id = 1;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      tiles.push({ id, value: (r + c) % 2 === 0 ? 2 : 4, r, c });
      id += 1;
    }
  }
  const game = makeGame(tiles);
  assert.equal(canMove(game), false);
  tiles[1].value = 2;
  const open = makeGame(tiles);
  assert.equal(canMove(open), true);
});

test("snapshot and restore rewind a merge", () => {
  const game = makeGame(
    [
      { id: 1, value: 16, r: 2, c: 0 },
      { id: 2, value: 16, r: 2, c: 3 },
    ],
    () => 0,
  );
  const before = snapshot(game);
  move(game, "left");
  assert.equal(game.score, 32);
  restore(game, before);
  assert.equal(game.score, 0);
  assert.equal(cells(game), "2,0:16 2,3:16");
});

test("opening deal places two tiles and random play stays legal", () => {
  let seed = 7;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const game = createGame(rng);
  assert.equal(game.tiles.length, 2);
  assert.equal(overlaps(game), false);

  const dirs = ["left", "up", "right", "down"];
  for (let turn = 0; turn < 200 && canMove(game); turn += 1) {
    const before = game.tiles.length;
    const score = game.score;
    let result = { moved: false, removed: [] };
    for (const dir of dirs) {
      result = move(game, dir);
      if (result.moved) break;
    }
    if (!result.moved) break;
    assert.equal(game.tiles.length, before - result.removed.length + 1);
    assert.equal(game.score, score + result.gained);
    assert.equal(overlaps(game), false);
    for (const tile of game.tiles) assert.equal(Math.log2(tile.value) % 1, 0);
  }
});

test("scripted rolls can spawn a four", () => {
  const game = createGame(scripted([0, 0.95]));
  assert.equal(game.tiles.length, 2);
  assert.ok(game.tiles.some((tile) => tile.value === 4));
});
