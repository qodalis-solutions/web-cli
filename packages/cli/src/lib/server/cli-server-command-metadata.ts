import {
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
    writeExamples,
    writeWrapped,
} from '@qodalis/cli-core';

/**
 * Text a server sent, safe to print: control characters (terminal escapes)
 * dropped; with `keepLineBreaks`, line breaks and tabs stay.
 */
export function plainText(value: unknown, keepLineBreaks = false): string {
    const text = String(value ?? '');
    return keepLineBreaks
        ? text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
        : text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

/** Text a server sent, or undefined when it sent none. */
function optionalText(value: unknown): string | undefined {
    return value === undefined || value === null ? undefined : plainText(value);
}

/**
 * A server command's aliases, safe to register: control characters dropped,
 * empty ones and ones with spaces (they cannot be typed) left out.
 */
export function serverCommandAliases(descriptor: Pick<CliServerCommandDescriptor, 'aliases'>): string[] {
    return (descriptor.aliases ?? [])
        .map((a) => plainText(a).trim())
        .filter((a) => a && !/\s/.test(a));
}

/** The icon of a server command that names none. */
export const DEFAULT_SERVER_COMMAND_ICON = '\u{1F5A5}';

/**
 * Processor metadata of a server command: its own module and icon when the
 * server sends them (servers with command metadata), else `fallbackModule`
 * and 🖥; always `requireServer` and the server it runs on.
 */
export function serverCommandMetadata(
    descriptor: CliServerCommandDescriptor,
    fallbackModule: string,
    server?: string,
): CliProcessorMetadata {
    return {
        module: plainText(descriptor.module) || fallbackModule,
        icon: plainText(descriptor.icon) || DEFAULT_SERVER_COMMAND_ICON,
        requireServer: true,
        ...(server ? { server } : {}),
    };
}

/**
 * Parameters of a server command. Aliases lose leading dashes (servers
 * declare `-a` or `a`; both mean `-a` on the command line). Allowed values
 * come with a validator that refuses other values (ignoring case) before the
 * request is sent.
 */
export function serverCommandParameters(
    descriptor: CliServerCommandDescriptor,
): ICliCommandParameterDescriptor[] | undefined {
    return descriptor.parameters?.map((p) => {
        const allowed = p.allowedValues?.length ? p.allowedValues.map((v) => plainText(v)) : undefined;
        const examples = p.examples?.map((v) => plainText(v)).filter(Boolean);
        return {
            name: p.name,
            aliases: p.aliases?.map((a) => plainText(a).replace(/^-+/, '')).filter(Boolean),
            description: optionalText(p.description) as string,
            required: p.required,
            type: p.type,
            defaultValue: p.defaultValue,
            ...(examples?.length ? { examples } : {}),
            ...(allowed
                ? {
                      allowedValues: allowed,
                      validator: (value: any) => {
                          const values = Array.isArray(value) ? value : [value];
                          const valid = values.every((v) =>
                              allowed.some((a) => a.toLowerCase() === String(v).toLowerCase()),
                          );
                          return valid
                              ? { valid: true }
                              : { valid: false, message: `--${p.name} must be one of: ${allowed.join(', ')}` };
                      },
                  }
                : {}),
        };
    });
}

/**
 * The `writeDescription` of a server command: its documentation (one
 * wrapped paragraph per block) and its examples, or undefined when the
 * server sends neither, so help shows only the description.
 */
export function serverCommandWriteDescription(
    descriptor: CliServerCommandDescriptor,
): ((context: ICliExecutionContext) => void) | undefined {
    const paragraphs = plainText(descriptor.documentation, true)
        .split(/\r?\n\s*\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    const examples = (descriptor.examples ?? [])
        .filter((e) => e?.command)
        .map((e) => ({ command: plainText(e.command), description: optionalText(e.description) }));
    if (paragraphs.length === 0 && examples.length === 0) {
        return undefined;
    }
    return (context: ICliExecutionContext) => {
        paragraphs.forEach((paragraph, i) => {
            if (i > 0) context.writer.writeln();
            writeWrapped(context, paragraph);
        });
        if (examples.length > 0) {
            if (paragraphs.length > 0) context.writer.writeln();
            writeExamples(
                context,
                examples.map((e) => [e.command, e.description ?? ''] as const),
            );
        }
    };
}
