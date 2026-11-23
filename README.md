# tiny stack VM

An interpreter for make.fun's tiny stack ISA (v1): 32-bit wrapping integers, a 256-value data stack,
a 64-deep call stack, 256 words of memory, branches and calls, ten traps and the step and output
limits. One run answers a whole set: per `/input/<id>/program.bin` it writes
`/output/<id>/stdout.bin` and `/output/<id>/exit.txt`.

[![competition](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/c/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/bongekanjing/tiny-stack-vm-lynx-15/rank.svg)](https://make.fun/c/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/bongekanjing/tiny-stack-vm-lynx-15/reward.svg)](https://make.fun/c/tiny-stack-vm-01-run-20261122)

Node 22, no dependencies, no clock, no network:

    MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts

`main.ts` is the whole VM: an opcode table of immediate width and stack effect, then one dispatch
loop checking steps, `pc`, opcode and stack bounds first. MIT.
