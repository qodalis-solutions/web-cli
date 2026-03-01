import { Command } from 'commander';
import { execSync } from 'child_process';
import { detectMonorepo } from './detect-monorepo';
import { promptForPluginInfo, toPascalCase, PluginAnswers } from './prompts';
import { scaffoldPlugin } from './scaffold';

const program = new Command();

program
    .name('create-cli-plugin')
    .description('Scaffold a new Qodalis CLI plugin')
    .version('1.0.0')
    .option('-n, --name <name>', 'Plugin name (lowercase)')
    .option('-d, --description <description>', 'Plugin description')
    .option('-p, --processor-name <name>', 'Processor class name (PascalCase)')
    .action(async (options) => {
        try {
            const cwd = process.cwd();
            const monorepo = detectMonorepo(cwd);

            if (monorepo) {
                console.log(`Detected web-cli monorepo at: ${monorepo.root}`);
                console.log('Plugin will be created inside the monorepo.\n');
            } else {
                console.log('Creating a standalone plugin project.\n');
            }

            let answers: PluginAnswers;

            if (options.name) {
                answers = {
                    name: options.name,
                    description: options.description || `CLI extension for ${options.name}`,
                    processorName: options.processorName || toPascalCase(options.name),
                };
            } else {
                answers = await promptForPluginInfo();
            }

            const projectDir = scaffoldPlugin(answers, monorepo);

            console.log('\nDone!\n');

            if (monorepo) {
                console.log('Next steps:');
                console.log(`  1. cd ${projectDir}`);
                console.log(`  2. Implement your command in src/lib/processors/`);
                console.log(`  3. pnpm nx build ${answers.name}`);
                console.log(`  4. pnpm nx test ${answers.name}`);
            } else {
                console.log('Installing dependencies...\n');
                const pm = detectPackageManager();
                execSync(`${pm} install`, { cwd: projectDir, stdio: 'inherit' });

                console.log('\nNext steps:');
                console.log(`  1. cd qodalis-cli-${answers.name}`);
                console.log(`  2. Implement your command in src/lib/processors/`);
                console.log(`  3. ${pm === 'npm' ? 'npx' : pm} tsup`);
                console.log(`  4. npm publish --access public`);
            }
        } catch (error) {
            if (error instanceof Error) {
                console.error(`\nError: ${error.message}`);
            }
            process.exit(1);
        }
    });

function detectPackageManager(): string {
    try {
        execSync('pnpm --version', { stdio: 'ignore' });
        return 'pnpm';
    } catch {
        return 'npm';
    }
}

program.parse();
