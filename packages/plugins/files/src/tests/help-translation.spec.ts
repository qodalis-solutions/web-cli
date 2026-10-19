import { CliHelpCommandProcessor, CliTestHarness } from '@qodalis/cli';
import { CliGrepCommandProcessor } from '../lib/processors/cli-grep-command-processor';
import { deTranslations } from '@qodalis/cli-lang-de';

describe('help pages in another language', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessors([
            new CliHelpCommandProcessor(),
            new CliGrepCommandProcessor(),
        ]);
    });

    it('help grep is in English by default', async () => {
        const result = await harness.execute('help grep');
        expect(result.output).toContain('Search one or more files');
        expect(result.output).toContain('# Case-insensitive search');
    });

    it('help grep uses the German language pack after switching locale', async () => {
        harness.translator.addTranslations('de', deTranslations);
        harness.translator.setLocale('de');

        const result = await harness.execute('help grep');

        const usageLine = deTranslations['cli.grep.help.search_one_more_files'];
        expect(usageLine).toBeTruthy();
        expect(result.output).toContain(usageLine);
        expect(result.output).toContain(
            `# ${deTranslations['cli.grep.help.case_insensitive_search']}`,
        );
        expect(result.output).toContain(deTranslations['cli.grep.description']);
        // Command syntax is not translated
        expect(result.output).toContain('grep <pattern> <file...>');
        expect(result.output).not.toContain('Search one or more files');
    });
});
