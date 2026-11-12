import {
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
    writeExamples,
    writeWrapped,
} from '@qodalis/cli-core';

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
        module: descriptor.module || fallbackModule,
        icon: descriptor.icon || DEFAULT_SERVER_COMMAND_ICON,
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
        const allowed = p.allowedValues?.length ? [...p.allowedValues] : undefined;
        return {
            name: p.name,
            aliases: p.aliases?.map((a) => a.replace(/^-+/, '')).filter(Boolean),
            description: p.description,
            required: p.required,
            type: p.type,
            defaultValue: p.defaultValue,
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
    const paragraphs = (descriptor.documentation ?? '')
        .split(/\r?\n\s*\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    const examples = (descriptor.examples ?? []).filter((e) => e?.command);
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
