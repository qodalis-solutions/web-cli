import { ICliModule } from '@qodalis/cli-core';

/**
 * The CLI language packs, each in its own chunk (they are large and only
 * one is used at a time). Loaded in parallel; a pack that fails to load is
 * skipped.
 */
export async function loadLanguagePacks(): Promise<ICliModule[]> {
    const packs = await Promise.allSettled([
        import('@qodalis/cli-lang-es').then((m) => m.langEsModule),
        import('@qodalis/cli-lang-fr').then((m) => m.langFrModule),
        import('@qodalis/cli-lang-de').then((m) => m.langDeModule),
        import('@qodalis/cli-lang-pt').then((m) => m.langPtModule),
        import('@qodalis/cli-lang-it').then((m) => m.langItModule),
        import('@qodalis/cli-lang-ja').then((m) => m.langJaModule),
        import('@qodalis/cli-lang-ko').then((m) => m.langKoModule),
        import('@qodalis/cli-lang-zh').then((m) => m.langZhModule),
        import('@qodalis/cli-lang-ru').then((m) => m.langRuModule),
        import('@qodalis/cli-lang-ro').then((m) => m.langRoModule),
    ]);
    return packs.flatMap((p) => {
        if (p.status === 'fulfilled') return [p.value];
        console.warn('[docs] A language pack failed to load:', p.reason);
        return [];
    });
}
