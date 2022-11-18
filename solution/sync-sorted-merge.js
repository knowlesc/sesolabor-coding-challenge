"use strict";

const { MinPriorityQueue } = require("@datastructures-js/priority-queue");

// Print all entries, across all of the sources, in chronological order.
module.exports = (logSources, printer) => {
  const pq = new MinPriorityQueue(({ log }) => log.date);

  // Get the earliest log from all log sources and insert into priority queue
  for (const source of logSources) {
    const log = source.pop();
    pq.push({ log, source });
  }

  while (!pq.isEmpty()) {
    // pop the earliest log from the queue
    const { source, log } = pq.pop();

    printer.print(log);

    // refill the queue of the source that was drained so we're guaranteed to have the lowest from each source
    // the pq will contain no more entries than the # sources as we only fill one at a time
    if (!source.drained) {
      const log = source.pop();
      if (log) pq.push({ log, source });
    }
  }

  printer.done();
  return console.log("Sync sort complete.");
};
