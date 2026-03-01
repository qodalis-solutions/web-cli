import { input } from '@inquirer/prompts';

function toPascalCase(str: string): string {
    return str
        .split(/[-_\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export interface PluginAnswers {
    name: string;
    description: string;
    processorName: string;
}

export async function promptForPluginInfo(): Promise<PluginAnswers> {
    const name = await input({
        message: 'Plugin name (lowercase, e.g. "mylib"):',
        validate: (value) => {
            if (!value) return 'Plugin name is required';
            if (value !== value.toLowerCase()) return 'Must be lowercase';
            if (/\s/.test(value)) return 'Must not contain spaces';
            if (value.startsWith('cli-')) return 'Do not prefix with "cli-" (added automatically)';
            if (!/^[a-z][a-z0-9-]*$/.test(value)) return 'Must start with a letter, only lowercase letters, numbers, and hyphens';
            return true;
        },
    });

    const description = await input({
        message: 'Description:',
        default: `CLI extension for ${name}`,
    });

    const suggestedName = toPascalCase(name);
    const processorName = await input({
        message: `Processor class name (Cli___CommandProcessor):`,
        default: suggestedName,
    });

    return { name, description, processorName };
}
