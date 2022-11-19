"use strict";
const { MinPriorityQueue } = require("@datastructures-js/priority-queue");
const { performance } = require("perf_hooks");

/**
 * Constraints:
 * - We don't want too many promises at once in memory
 *   - Idea: Only batch a certain # at a time
 *     - Say the printer write throughput is X logs/ms
 *     - If the avg delay for each log is around 4ms (random delay between 0 and 8),
 *       to achieve the desired rate, we need at least x*4 fetches batched at a time
 * - We don't want the sorted priority queue too full
 *   - Solution: Pick a max size & stop adding to the queue if it gets full
 * - We don't want to have entries come in our of order
 *   - We need to always at least have one entry from every log source in the queue
 *
 * For reference, I'm using these letters:
 *  - K = source count
 *  - N = log count
 */

// Find the source with the fewest buffered entries or zero
// O(K)
function findNextLogSourceToQueue(logSources) {
  let minSource = null;

  for (const source of logSources) {
    // IMPORTANT: can't queue more than one of the same source due to behaviour of `popAsync`
    if (source.loading) continue;
    if (source.bufferCount === 0) return source;

    if (source.bufferCount < (minSource?.bufferCount ?? Infinity)) {
      minSource = source;
    }
  }

  return minSource;
}

// Queue next log to be popped async
async function queueLogFromSource(source, priorityQueue, promiseQueue) {
  source.loading = true;
  const promise = source.popAsync().then((log) => {
    if (log) {
      // O(log K)
      priorityQueue.push({ log, source });
      source.bufferCount++;
    }
    source.loading = false;
  });

  // O(1)
  promiseQueue.push(promise);
}

// O(K)
function addNextLogToQueue(logSources, priorityQueue, promiseQueue) {
  const source = findNextLogSourceToQueue(logSources);

  // It's possible all sources are loading so could be null
  if (source) {
    queueLogFromSource(source, priorityQueue, promiseQueue);
  }
}

// O(K)
function allSourcesHaveBeenRead(logSources) {
  return logSources.every(({ bufferCount }) => bufferCount > 0);
}

// O(log K)
function printNextLogFromQueue(priorityQueue, printer) {
  const { source, log } = priorityQueue.pop();
  printer.print(log);
  source.bufferCount--;
}

function priorityQueueIsFull(priorityQueue, maxSize, promiseQueue) {
  if (priorityQueue.size() > maxSize) {
    throw new Error("PriorityQueue exceeded MaxSize");
  }

  // Need to take into account in-flight promises so we don't over-queue
  return priorityQueue.size() + promiseQueue.length >= maxSize;
}

function promiseQueueIsFull(promiseQueue, maxSize) {
  return promiseQueue.length >= maxSize;
}

// O(K)
function allSourcesAreLoading(logSources) {
  return logSources.every(({ loading }) => loading);
}

// Add some additional useful data to each log source so we can keep track of state
// O(K)
function initializeSources(logSources) {
  logSources.forEach((source, index) => {
    source.bufferCount = 0;
    source.loading = false;
    source.id = index + 1;
  });
}

function continueLoop(logSources, priorityQueue) {
  return logSources.length > 0 || priorityQueue.size();
}

/**
 * Tweak this number based on the system!
 *
 * The printer is a big bottleneck. It can print X logs/second in the sync challenge,
 * so in theory we can automatically tune our promise/priority queue sizes to be
 * optimal to achieve approximately that many reads per second to match the printer.
 * If we make the reads faster, we waste CPU cycles and memory unnecessarily
 */
const TARGET_LOGS_PER_MS = 5;

// In log-source.js, delay is a random # between 0 and 8, which will average out to 4
const AVERAGE_LOG_DELAY_MS = 4;

/**
 * Awaiting the popAsync promises with Promise.All() on my windows machine  seems to
 * always take ~15ms regardless of the batch size. I didn't have enough time to look
 * more closely into this, but I think there must be some optimizations possible,
 * or something I've missed. I tried both node 14 and node 19.
 *
 * On my Macbook, the awaiting seems to take
 *
 * I tried the latest node version (19.1.0) and the promise overhead interestingly
 * shrinks.
 *
 * I've added some logging at the end to determine how long the average await takes, which can
 * be used to tune this number.
 */
const PROMISE_OVERHEAD_CONSTANT_MS = 11;

/**
 * If we use this batch size, we'll read enough logs per second to reach our target
 *
 * IMPORTANT: The log source count is also a constraint, as we NEED to load a log from
 * every source before we can be 100% sure what the next earliest log is, and the log-source
 * implementation doesn't allow us to load more than one source at the same time, as it'll
 * always return the current state of the last log (see my comment in log-source.js)
 *
 * So this solution actually goes faster the more log sources there are, up to the point
 * where the log source count exceeds the optimal promise batch size for the system.
 *
 * This formula is definitely not perfect as there are other variables that I'm not factoring in.
 */
const PROMISE_BATCH_SIZE = Math.ceil(
  TARGET_LOGS_PER_MS * (AVERAGE_LOG_DELAY_MS + PROMISE_OVERHEAD_CONSTANT_MS)
);

// Print all entries, across all of the *async* sources, in chronological order.
module.exports = (logSources, printer) => {
  /**
   * Loading more entries into priority queue helps avoid bottlenecks.
   * I've found a multiplier of 10 is great, and going higher doesn't help.
   * Going lower leads to a significant slowdown (like up to 20x slower).
   *
   * Keeping the multiplier as a constant times the sources length keeps push/pop at O(log K)
   */
  const MAX_PRIORITY_QUEUE_SIZE = logSources.length * 10;

  let promiseQueue = [];
  const priorityQueue = new MinPriorityQueue(({ log }) => log.date);
  initializeSources(logSources);

  const totalTimes = {
    addingLogToQueue: 0,
    checkingPromiseQueue: 0,
    awaiting: 0,
    printingLog: 0,
  };

  let awaitCounter = 0;

  return new Promise(async (resolve, reject) => {
    /**
     * I think this is O(KN) for outer loop, O(K) inside because of the array operations,
     * so O(K^2 * N) overall... more log sources will cause more complexity
     * I think it could possibly be done without the extra K if we avoid the array filter/foreach
     */
    while (continueLoop(logSources, priorityQueue)) {
      const fullPriorityQueue = priorityQueueIsFull(
        priorityQueue,
        MAX_PRIORITY_QUEUE_SIZE,
        promiseQueue
      );

      const fullPromiseQueue = promiseQueueIsFull(promiseQueue, 50);

      const timer1 = performance.now();

      if (!fullPriorityQueue) {
        addNextLogToQueue(logSources, priorityQueue, promiseQueue);
      }

      const timer2 = performance.now();

      if (
        promiseQueue.length > 0 &&
        (fullPriorityQueue ||
          fullPromiseQueue ||
          // This is O(K)
          allSourcesAreLoading(logSources))
      ) {
        const timerp1 = performance.now();
        await Promise.all(promiseQueue);
        const timerp2 = performance.now();
        awaitCounter++;
        totalTimes.awaiting += timerp2 - timerp1;
        promiseQueue = [];
      }
      const timer3 = performance.now();

      // If we've read from all sources, we know we have the next log in the priority queue
      // This is also O(K)
      if (allSourcesHaveBeenRead(logSources)) {
        printNextLogFromQueue(priorityQueue, printer);
      }
      const timer4 = performance.now();

      // This is also O(K)
      logSources = logSources.filter(({ drained }) => !drained);

      totalTimes.addingLogToQueue += timer2 - timer1;
      totalTimes.checkingPromiseQueue += timer3 - timer2;
      totalTimes.printingLog += timer4 - timer3;
    }

    printer.done();

    console.log("\nTiming info (cumulative): ");
    console.table(totalTimes);
    console.log(
      `Average await time (promise batch size ${PROMISE_BATCH_SIZE}): ${
        totalTimes.awaiting / awaitCounter
      }`
    );

    resolve(console.log("Async sort complete."));
  });
};
