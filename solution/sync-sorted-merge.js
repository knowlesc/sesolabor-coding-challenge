"use strict";

const { MinPriorityQueue } = require("@datastructures-js/priority-queue");

// Print all entries, across all of the sources, in chronological order.
module.exports = (logSources, printer) => {
  const pq = new MinPriorityQueue(({ log }) => log.date);

  // Get the earliest log from all log sources and insert into priority queue
  // O(K) for the outer loop, O(K log K) total
  for (const source of logSources) {
    const log = source.pop();

    // O(log K)
    pq.push({ log, source });
  }

  // O(KN) for the outer loop, so O(KN * log K) total
  while (!pq.isEmpty()) {
    // pop the earliest log from the queue
    // O(log K)
    const { source, log } = pq.pop();

    printer.print(log);

    // refill the queue of the source that was drained so we're guaranteed to have the lowest from each source
    // the pq will contain no more entries than the # sources as we only fill one at a time
    if (!source.drained) {
      const log = source.pop();
      // Still O(log K) as it will only ever hold 1 element per source
      if (log) pq.push({ log, source });
    }
  }

  printer.done();
  return console.log("Sync sort complete.");
};
