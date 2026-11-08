import {assembleShotsFromFiles} from '../src/production/shot-assembly';

const usage = 'Usage: pnpm shots:assemble <project-directory> <storyboard.json> ' +
  '<shot-files.json> <silent-output.mp4>';

const main = async () => {
  const [projectDirectory, storyboardPath, shotsPath, outputPath, ...extra] =
    process.argv.slice(2);
  if (!projectDirectory || !storyboardPath || !shotsPath || !outputPath || extra.length) {
    throw new Error(usage);
  }
  const result = await assembleShotsFromFiles({
    projectDirectory, storyboardPath, shotsPath, outputPath,
  });
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
