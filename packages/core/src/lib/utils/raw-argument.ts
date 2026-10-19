/**
 * Text given as one free-form argument (JSON, code, a query) without one
 * pair of quotes wrapping all of it: `'{"a": 1}'` -> `{"a": 1}`, and
 * `"say \"hi\""` -> `say "hi"`. Anything else is kept as typed, so quotes
 * and backslashes inside the text are never touched.
 */
export function unquoteRawArgument(text: string): string {
    const value = text.trim();
    if (value.length < 2) return value;
    const quote = value[0];
    if (quote === "'") {
        return value.indexOf("'", 1) === value.length - 1 ? value.slice(1, -1) : value;
    }
    if (quote === '"') {
        for (let i = 1; i < value.length; i++) {
            if (value[i] === '\\') i++;
            else if (value[i] === '"') {
                return i === value.length - 1
                    ? value.slice(1, -1).replace(/\\(["\\$`])/g, '$1')
                    : value;
            }
        }
    }
    return value;
}
