import {
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';
import { ParsedArg } from './command-parser';

export class CliArgsParser {
    public static convertToRecord(
        args: ParsedArg[],
        processor: ICliCommandProcessor,
    ): Record<string, any> {
        const result: Record<string, any> = {};

        const updateParamValue = (
            parameter: ICliCommandParameterDescriptor,
            value: any,
        ) => {
            result[parameter.name] = value;
            parameter.aliases?.forEach((alias) => {
                result[alias] = value;
            });
        };

        args.forEach((arg) => {
            const parameter = processor.parameters?.find(
                (p) =>
                    p.name === arg.name ||
                    p.aliases?.some((a) => a === arg.name),
            );

            if (parameter) {
                let value = arg.value;

                switch (parameter.type) {
                    case 'array': {
                        const previousValue = Array.isArray(
                            result[parameter.name],
                        )
                            ? result[parameter.name]
                            : [];
                        value = [...previousValue, arg.value];
                        break;
                    }
                    case 'boolean':
                        value =
                            value === true ||
                            value === 'true' ||
                            value === '1' ||
                            value === 'yes' ||
                            value === 'y' ||
                            value === 1;
                        break;
                    default:
                        value = arg.value;
                        break;
                }
                updateParamValue(parameter, value);
            } else {
                result[arg.name] = arg.value;
            }
        });

        return result;
    }
}
