#!/usr/bin/env node
import {runCli} from '../src/cli';

process.exitCode = await runCli(process.argv.slice(2));
