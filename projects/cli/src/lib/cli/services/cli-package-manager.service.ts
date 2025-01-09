import { Injectable } from '@angular/core';
import { Package } from '@qodalis/cli-core';
import { CliKeyValueStore } from '../storage/cli-key-value-store';

@Injectable({
    providedIn: 'root',
})
export class CliPackageManagerService {
    private readonly storageKey = 'cli-packages';

    public QODALIS_COMMAND_PREFIX = '@qodalis/cli-';

    constructor(private readonly store: CliKeyValueStore) {}

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
     * @param packageName {string} The name of the package to retrieve
     * @returns {Package | undefined} The package if found, undefined otherwise
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
     * @param packageName {string} The name of the package to check
     * @returns {boolean} True if the package exists, false otherwise
     */
    async hasPackage(packageName: string): Promise<boolean> {
        return (await this.getPackage(packageName)) !== undefined;
    }

    /**
     * Adds a new package to the list and saves it in storage.
     * @param pkg {Package} The package to add
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
     * Removes a package by name and saves the updated list in storage
     * @param packageName {string} The name of the package to remove
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
     * Updates an existing package in the list and saves the updated list in storage.
     * @param pkg {Package} The updated package
     * @throws {Error} If the package to update is not found
     * @returns {void}
     * @throws {Error} If the package to update is not found
     * @returns {void}
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

    /**
     * Saves the list of packages to storage.
     * @param packages {Package[]} The list of packages to save
     */
    private async savePackages(packages: Package[]): Promise<void> {
        await this.store.set(this.storageKey, packages);
    }
}
