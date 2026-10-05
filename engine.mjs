// Walk from the wall inward so each tile merges at most once.
const DIRS = {
  left: { axis: "c", toward: 0 },
  right: { axis: "c", toward: 3 },
  up: { axis: "r", toward: 0 },
  down: { axis: "r", toward: 3 },
};

export function makeGame(tiles, rng = Math.random, score = 0) {
  let nextId = 1;
  for (const tile of tiles) nextId = Math.max(nextId, tile.id + 1);
  return {
    tiles: tiles.map((tile) => ({
      id: tile.id,
      value: tile.value,
      r: tile.r,
      c: tile.c,
    })),
    score,
    nextId,
    rng,
  };
}

export function createGame(rng = Math.random) {
  const game = makeGame([], rng, 0);
  spawn(game);
  spawn(game);
  return game;
}

function spawn(game) {
  const taken = new Set(game.tiles.map((tile) => tile.r * 4 + tile.c));
  const empty = [];
  for (let i = 0; i < 16; i += 1) if (!taken.has(i)) empty.push(i);
  if (!empty.length) return null;
  const cell = empty[Math.floor(game.rng() * empty.length)];
  const value = game.rng() < 0.9 ? 2 : 4;
  const tile = {
    id: game.nextId,
    value,
    r: Math.floor(cell / 4),
    c: cell % 4,
    fresh: true,
  };
  game.nextId += 1;
  game.tiles.push(tile);
  return tile;
}

export function move(game, dir) {
  const spec = DIRS[dir];
  if (!spec) return { moved: false, gained: 0, removed: [] };

  for (const tile of game.tiles) {
    delete tile.fresh;
    delete tile.merged;
  }

  const before = new Map(game.tiles.map((tile) => [tile.id, tile.r * 4 + tile.c]));
  const lines = [[], [], [], []];
  for (const tile of game.tiles) {
    const index = spec.axis === "c" ? tile.r : tile.c;
    lines[index].push(tile);
  }

  let gained = 0;
  const removed = [];
  const next = [];
  const step = spec.toward === 0 ? 1 : -1;

  for (const line of lines) {
    line.sort((a, b) =>
      spec.toward === 0 ? a[spec.axis] - b[spec.axis] : b[spec.axis] - a[spec.axis],
    );
    let cursor = spec.toward;
    for (let i = 0; i < line.length; i += 1) {
      const tile = line[i];
      if (i + 1 < line.length && line[i + 1].value === tile.value) {
        const eaten = line[i + 1];
        i += 1;
        tile.value *= 2;
        gained += tile.value;
        tile.merged = true;
        tile[spec.axis] = cursor;
        removed.push({
          id: eaten.id,
          value: eaten.value,
          toR: tile.r,
          toC: tile.c,
        });
      } else {
        tile[spec.axis] = cursor;
      }
      cursor += step;
      next.push(tile);
    }
  }

  const moved =
    removed.length > 0 || next.some((tile) => before.get(tile.id) !== tile.r * 4 + tile.c);
  if (!moved) {
    for (const tile of next) delete tile.merged;
    return { moved: false, gained: 0, removed: [] };
  }

  game.tiles = next;
  game.score += gained;
  spawn(game);
  return { moved: true, gained, removed };
}

export function canMove(game) {
  if (game.tiles.length < 16) return true;
  const grid = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (const tile of game.tiles) grid[tile.r][tile.c] = tile.value;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export function snapshot(game) {
  return {
    tiles: game.tiles.map(({ id, value, r, c }) => ({ id, value, r, c })),
    score: game.score,
    nextId: game.nextId,
  };
}

export function restore(game, snap) {
  game.tiles = snap.tiles.map((tile) => ({ ...tile }));
  game.score = snap.score;
  game.nextId = snap.nextId;
}
