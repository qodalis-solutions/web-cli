import {
    ClassProvider,
    FactoryProvider,
    Injectable,
    Injector,
    Provider,
    StaticProvider,
    ValueProvider,
} from '@angular/core';
import { CliProvider, ICliContextServices } from '@qodalis/cli-core';

@Injectable({
    providedIn: 'root',
})
export class CliContextServices implements ICliContextServices {
    private providers: StaticProvider[] = [];
    private currentInjector: Injector;

    constructor(injector: Injector) {
        this.currentInjector = injector;
    }

    get<T>(service: any): T {
        try {
            return this.currentInjector.get<T>(service);
        } catch (e) {
            throw new Error(`Service ${service} not found`);
        }
    }

    set(definition: CliProvider | CliProvider[]): void {
        const definitions = Array.isArray(definition)
            ? definition
            : [definition];

        const newProviders: Provider = [];

        for (const def of definitions) {
            let newProvider: Provider = {
                provide: def.provide,
            };

            if (def.hasOwnProperty('useClass')) {
                const classProvider: ClassProvider = {
                    provide: def.provide,
                    useClass: def.useClass,
                    multi: def.multi,
                };
                newProvider = classProvider;
            } else if (def.hasOwnProperty('useValue')) {
                const valueProvider: ValueProvider = {
                    provide: def.provide,
                    useValue: def.useValue,
                    multi: def.multi,
                };

                newProvider = valueProvider;
            } else if (def.hasOwnProperty('useFactory')) {
                const valueProvider: FactoryProvider = {
                    provide: def.provide,
                    useFactory: def.useFactory,
                    multi: def.multi,
                };

                newProvider = valueProvider;
            }

            newProviders.push(newProvider);
        }

        this.providers.push(...newProviders);

        this.currentInjector = Injector.create({
            providers: newProviders,
            parent: this.currentInjector,
        });
    }
}
