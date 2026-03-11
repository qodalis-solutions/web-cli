import { ICliKeyValueStore, Package } from '@qodalis/cli-core';

export class CliPackageManagerService {
    private readonly storageKey = 'cli-packages';

    public QODALIS_COMMAND_PREFIX = '@qodalis/cli-';

    private store!: ICliKeyValueStore;

    constructor() {}

    /**
     * Set the key-value store instance for persistence.
     */
    setStore(store: ICliKeyValueStore): void {
        this.store = store;
    }

    /**
     * Retrieves the list of packages
     * @returns {Package[]} Array of packages
     */
    async getPackages(): Promise<Package[]> {
        const oldPackages = localStorage.getItem('cliPackages');
        if (oldPackages) {
            localStorage.removeItem('cliPackages');
            await this.store.set(this.storageKey, JSON.parse(oldPackages));
        }

        const packages = await this.store.get<Package[]>(this.storageKey);

        return packages ? packages : [];
    }

    /**
     * Retrieves a package by name from the list.
     */
    async getPackage(packageName: string): Promise<Package | undefined> {
        return (await this.getPackages()).find(
            (p) =>
                p.name === packageName ||
                p.name === this.QODALIS_COMMAND_PREFIX + packageName,
        );
    }

    /**
     * Checks if a package with the given name exists in the list.
     */
    async hasPackage(packageName: string): Promise<boolean> {
        return (await this.getPackage(packageName)) !== undefined;
    }

    /**
     * Adds a new package to the list and saves it in storage.
     */
    async addPackage(pkg: Package): Promise<void> {
        const packages = await this.getPackages();
        if (packages.find((p) => p.name === pkg.name)) {
            throw new Error(`Package with name "${pkg.name}" already exists.`);
        }
        packages.push(pkg);
        await this.savePackages(packages);
    }

    /**
     * Removes a package by name and saves the updated list in storage.
     */
    async removePackage(packageName: string): Promise<Package> {
        const packages = await this.getPackages();
        const packageToRemove = packages.find(
            (p) =>
                p.name === packageName ||
                p.name === this.QODALIS_COMMAND_PREFIX + packageName,
        );

        if (!packageToRemove) {
            throw new Error(`Package with name "${packageName}" not found.`);
        }

        const updatedPackages = packages.filter(
            (p) => p.name !== packageToRemove.name,
        );

        if (packages.length === updatedPackages.length) {
            throw new Error(`Package with name "${packageName}" not found.`);
        }

        this.savePackages(updatedPackages);

        return packageToRemove!;
    }

    /**
     * Updates an existing package in the list.
     */
    async updatePackage(pkg: Package): Promise<void> {
        const packages = await this.getPackages();
        const index = packages.findIndex((p) => p.name === pkg.name);
        if (index === -1) {
            throw new Error(`Package with name "${pkg.name}" not found.`);
        }
        packages[index] = pkg;
        await this.savePackages(packages);
    }

    private async savePackages(packages: Package[]): Promise<void> {
        await this.store.set(this.storageKey, packages);
    }
}
