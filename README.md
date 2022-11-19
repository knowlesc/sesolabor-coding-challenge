<img align="left" width="100px" height="100px" src="https://user-images.githubusercontent.com/12256205/162470824-d34c5fad-555e-498b-9ac9-ba86b6eb057a.png">

# SESO Coding Challenge: Log Sorting [SUBMISSION]

<br>

## Tooling Used

- Node version: 19.1.0
- NPM version: 8.19.3

## Machines Used for Testing

- Windows PC
  - i7, 4 cores
  - 16GB memory
- MacBook Pro
  - i7, 6 cores
  - 32GB memory

# Sync Challenge Solution

I used a min priority queue (implemented via a heap) based on some research. A min heap works nicely as we don't need to worry about sorting it - just inserting into it in order. At any given time we only need to pop off the next element in the heap, as we're inserting the next element from our K sorted arrays, so the next element in the heap is going to be guaranteed to be the earliest log across all K sources.

I used a library rather than implementing my own, since the challenge specifies _using_ an appropriate data structure, not _implementing_ one. I did briefly attempt using an implementation from stackoverflow instead of importing from the library to see if that increased performance at all,and it didn't increase it noticeably.

On my PC I get around 3-5k logs/s with 100 sources. The results deviate a decent amount, which is probably because I have a ton of other stuff running on the machine while running the solution. The solution runs considerably faster on my MacBook, where I get 20-25k logs/s.

I tried removing the `console.log` from the printer and confirmed that it was the bottleneck. Without the console log, I get about 10x the logs "printed".

## Test Results

| Machine | Log Sources | Logs Printed | Time Taken | Logs / s |
| ------- | ----------- | ------------ | ---------- | -------- |
| Windows | 1           | 258          | 0.051      | 5058     |
| Windows | 10          | 2342         | 0.566      | 4137     |
| Windows | 100         | 23950        | 5.31       | 4510     |
| Windows | 1000        | 238472       | 50.242     | 4746     |
| Windows | 10000       | 2390029      | 510.07     | 4685     |
| MacBook | 1           | 207          | 0.007      | 29571    |
| MacBook | 10          | 2457         | 0.098      | 25071    |
| MacBook | 100         | 23866        | 1.024      | 23306    |
| MacBook | 1000        | 238647       | 10.342     | 23075    |
| MacBook | 10000       | 2394700      | 125.515    | 19078    |

# Async Challenge Solution

This was tricky and took me 2 or 3 total rewrites before I got something working! My approach was to write out pseudocode first, then translate that into functions for readibility. There were some interesting constraints that I had to work around - I documented them in the code itself.

On my PC I get about 2k logs/s as long as the number of sources is relatively high. The bottleneck for a small number of log sources is the fact that we can only await one log per source at any given time, due to the implementation of `popAsync`. As the log source numbers get larger, the speed improves significantly and then caps out. With more log sources, more data is needed in memory to get the next log as we need to look at the earliest entry of all log sources to ensure we can pick the earliest of all.

Using the Chrome DevTools profiler on the Async solution with 10,000 log sources, I found that memory usage capped around 30MB, and hovered somewhere between 20-30MB even as the script ran for 5+ minutes. This is thanks to capping the number of items in the priority queue as well as capping the number of promises we await at once.

One interesting thing I noticed when profiling is that printing the log.date directly to the console causes the Chrome DevTools to actually hold on to a reference to that date, so I temporarily changed the printer class to call `toString()` on the date objects to get an accurate profile. Otherwise it looks like there's a memory leak because of the DevTools holding on to references!

## Test Results

| Machine | Log Sources | Logs Printed | Time Taken | Logs / s |
| ------- | ----------- | ------------ | ---------- | -------- |
| Windows | 1           | 282          | 4.393      | 64       |
| Windows | 10          | 2510         | 4.891      | 513      |
| Windows | 100         | 23948        | 11.776     | 2033     |
| Windows | 1000        | 240325       | 108.18     | 2221     |
| MacBook | 1           | 186          | 0.863      | 215      |
| MacBook | 10          | 2425         | 2.523      | 961      |
| MacBook | 100         | 23977        | 4.883      | 4910     |
| MacBook | 1000        | 240577       | 51.131     | 4705     |

Tuning variables used:

| Machine | TARGET_LOGS_PER_MS | AVERAGE_LOG_DELAY_MS | PROMISE_OVERHEAD_CONSTANT_MS |
| ------- | ------------------ | -------------------- | ---------------------------- |
| Windows | 5                  | 4                    | 11                           |
| MacBook | 20                 | 4                    | 4                            |

## Possible Future Improvements

- I have a feeling using worker threads or at least streams to balance reads and writes would lead to a better throughput without having to do so much manual tuning of the algorithm, however I didn't think I could design a better solution with either of these methods in the time frame given, so I stuck with my loop-based solution.
