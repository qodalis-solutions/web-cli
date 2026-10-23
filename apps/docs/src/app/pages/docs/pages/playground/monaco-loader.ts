/**
 * Loads Monaco on demand from the docs' own assets (copied from
 * monaco-editor/min/vs at build time), so it is never part of the app bundle
 * and only downloaded when the playground is opened.
 */

// Monaco's API is typed loosely here: its types are not part of the docs build
export type Monaco = any;

const MONACO_BASE = '/assets/monaco/vs';

let loading: Promise<Monaco> | undefined;

export function loadMonaco(): Promise<Monaco> {
    loading ??= new Promise<Monaco>((resolve, reject) => {
        const w = window as any;
        if (w.monaco) {
            resolve(w.monaco);
            return;
        }
        const script = document.createElement('script');
        script.src = `${MONACO_BASE}/loader.js`;
        script.onload = () => {
            w.require.config({ paths: { vs: MONACO_BASE } });
            w.require(
                ['vs/editor/editor.main'],
                () => {
                    // The AMD loader sets define.amd, which makes UMD scripts loaded later
                    // (plugins installed with `pkg add`) register with it instead of as
                    // globals. Monaco's own modules call define() directly and do not need it.
                    if (w.define?.amd) w.define.amd = undefined;
                    resolve(w.monaco);
                },
                (error: unknown) => reject(error),
            );
        };
        script.onerror = () => reject(new Error('The editor could not be loaded.'));
        document.head.appendChild(script);
    });
    loading.catch(() => (loading = undefined));
    return loading;
}
