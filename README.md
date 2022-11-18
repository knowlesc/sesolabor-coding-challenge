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
