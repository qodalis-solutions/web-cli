import { ScriptLoaderService } from '../lib/services/script-loader';

type Probe = { __qcliScriptLoaderProbe?: string };

describe('ScriptLoaderService.injectBodyScript', () => {
    const probe = window as unknown as Probe;

    afterEach(() => {
        delete probe.__qcliScriptLoaderProbe;
        document.head
            .querySelectorAll('script')
            .forEach((script) => script.textContent?.includes('__qcliScriptLoaderProbe') && script.remove());
    });

    it('runs the code from a blob: URL and has run it when the promise resolves', async () => {
        const created = spyOn(URL, 'createObjectURL').and.callThrough();
        const revoked = spyOn(URL, 'revokeObjectURL').and.callThrough();

        await new ScriptLoaderService().injectBodyScript(
            'window.__qcliScriptLoaderProbe = "blob";',
        );

        expect(probe.__qcliScriptLoaderProbe).toBe('blob');
        expect(created).toHaveBeenCalledTimes(1);
        expect(revoked).toHaveBeenCalledWith(created.calls.mostRecent().returnValue);
        const inlineScripts = Array.from(document.head.querySelectorAll('script:not([src])'));
        expect(inlineScripts.some((script) => script.textContent?.includes('"blob"'))).toBe(false);
    });

    it('falls back to an inline script when the blob: URL is refused (a policy without blob:)', async () => {
        // A URL that cannot load stands in for one a Content-Security-Policy blocks: both fire `error`
        spyOn(URL, 'createObjectURL').and.returnValue('blob:null/refused');
        spyOn(URL, 'revokeObjectURL');

        await new ScriptLoaderService().injectBodyScript(
            'window.__qcliScriptLoaderProbe = "inline";',
        );

        expect(probe.__qcliScriptLoaderProbe).toBe('inline');
        expect(document.head.querySelector('script[src="blob:null/refused"]')).toBeNull();
    });
});
