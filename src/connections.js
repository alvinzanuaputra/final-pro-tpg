export function createConnectionFinder(size) {
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  const cleared = new Int32Array(size);

  return function findConnections(board) {
    const { width, height, material, color } = board;
    seen.fill(0);
    let componentCount = 0;
    let cellCount = 0;
    let tail = 0;
    let matchColor = 0;

    function visit(index) {
      if (seen[index] || !material[index] || color[index] !== matchColor) return;
      seen[index] = 1;
      queue[tail++] = index;
    }

    for (let row = 0; row < height; row++) {
      const first = row * width;
      if (seen[first] || !material[first]) continue;
      matchColor = color[first];
      tail = 0;
      visit(first);
      let reachesRight = false;
      for (let head = 0; head < tail; head++) {
        const index = queue[head];
        const x = index % width;
        if (x > 0) visit(index - 1);
        if (x < width - 1) visit(index + 1);
        else reachesRight = true;
        if (index >= width) visit(index - width);
        if (index < material.length - width) visit(index + width);
      }
      if (!reachesRight) continue;
      componentCount++;
      cleared.set(queue.subarray(0, tail), cellCount);
      cellCount += tail;
    }
    return { componentCount, indices: cleared.subarray(0, cellCount) };
  };
}

export function clearCells(board, indices) {
  for (const index of indices) {
    board.material[index] = 0;
    board.color[index] = 0;
  }
  board.revision++;
}
