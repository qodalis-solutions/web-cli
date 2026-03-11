import { usersModule } from '../public-api';
import {
    CliIcon,
    ICliUsersStoreService_TOKEN,
    ICliGroupsStoreService_TOKEN,
} from '@qodalis/cli-core';

describe('CliUsersModule', () => {
    it('should be defined', () => {
        expect(usersModule).toBeDefined();
    });

    it('should have the correct name', () => {
        expect(usersModule.name).toBe('@qodalis/cli-users');
    });

    it('should have a version string', () => {
        expect(usersModule.version).toBeDefined();
        expect(typeof usersModule.version).toBe('string');
    });

    it('should have a description', () => {
        expect(usersModule.description).toBe(
            'Linux-style user and group management with authentication',
        );
    });

    it('should have 14 processors', () => {
        expect(usersModule.processors?.length).toBe(14);
    });

    it('should have a configure method', () => {
        expect(usersModule.configure).toBeDefined();
    });

    it('should have services', () => {
        expect(usersModule.services?.length).toBeGreaterThan(0);
    });

    it('should have an onInit hook', () => {
        expect(usersModule.onInit).toBeDefined();
    });

    // ---------- Processor existence and command names ----------

    const expectedCommands = [
        'whoami',
        'adduser',
        'listusers',
        'su',
        'userdel',
        'usermod',
        'passwd',
        'login',
        'logout',
        'id',
        'groups',
        'groupadd',
        'groupdel',
        'w',
    ];

    expectedCommands.forEach((cmd) => {
        it(`should contain a processor with command "${cmd}"`, () => {
            const found = usersModule.processors!.find(
                (p) => p.command === cmd,
            );
            expect(found).toBeDefined();
        });
    });

    // ---------- Processor metadata ----------

    it('every processor should have metadata.sealed = true', () => {
        for (const processor of usersModule.processors!) {
            expect(processor.metadata?.sealed)
                .withContext(
                    `Processor "${processor.command}" should be sealed`,
                )
                .toBe(true);
        }
    });

    it('every processor should have metadata.module = "users"', () => {
        for (const processor of usersModule.processors!) {
            expect(processor.metadata?.module)
                .withContext(
                    `Processor "${processor.command}" should have module "users"`,
                )
                .toBe('users');
        }
    });

    it('every processor should have metadata.icon = CliIcon.User', () => {
        for (const processor of usersModule.processors!) {
            expect(processor.metadata?.icon)
                .withContext(
                    `Processor "${processor.command}" should have User icon`,
                )
                .toBe(CliIcon.User);
        }
    });

    // ---------- configure() ----------

    it('configure() should return a new module with config set', () => {
        const config = { defaultPassword: 'test123' };
        const configured = usersModule.configure(config);
        expect(configured).toBeDefined();
        expect(configured).not.toBe(usersModule);
        expect((configured as any).config).toEqual(config);
    });

    it('configure() should preserve all original properties', () => {
        const config = { sessionTimeout: 5000 };
        const configured = usersModule.configure(config);
        expect(configured.name).toBe(usersModule.name);
        expect(configured.processors?.length).toBe(
            usersModule.processors?.length,
        );
        expect(configured.services?.length).toBe(usersModule.services?.length);
    });

    // ---------- Services ----------

    it('should have exactly 2 services registered', () => {
        expect(usersModule.services?.length).toBe(2);
    });

    it('should register a users store service', () => {
        const usersStoreSvc = usersModule.services!.find(
            (s: any) => s.provide === ICliUsersStoreService_TOKEN,
        );
        expect(usersStoreSvc).toBeDefined();
    });

    it('should register a groups store service', () => {
        const groupsStoreSvc = usersModule.services!.find(
            (s: any) => s.provide === ICliGroupsStoreService_TOKEN,
        );
        expect(groupsStoreSvc).toBeDefined();
    });
});
