import { createCli } from '../src/cli.js';

await createCli().parseAsync(process.argv);
