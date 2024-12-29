import { Injectable } from '@angular/core';

export interface Package {
    name: string;
    version: string;
    url: string;
}

@Injectable({
    providedIn: 'root',
})
export class CliPackageManagerService {
    private readonly storageKey = 'cliPackages';

    constructor() {}

    /**
     * Retrieves the list of packages from localStorage.
     * @returns {Package[]} Array of packages
     */
    getPackages(): Package[] {
        const packages = localStorage.getItem(this.storageKey);
        return packages ? JSON.parse(packages) : [];
    }

    /**
     * Checks if a package with the given name exists in the list.
     * @param packageName {string} The name of the package to check
     * @returns {boolean} True if the package exists, false otherwise
     */
    hasPackage(packageName: string): boolean {
        return (
            this.getPackages().find((p) => p.name === packageName) !== undefined
        );
    }

    /**
     * Adds a new package to the list and saves it in localStorage.
     * @param pkg {Package} The package to add
     */
    addPackage(pkg: Package): void {
        const packages = this.getPackages();
        if (packages.find((p) => p.name === pkg.name)) {
            throw new Error(`Package with name "${pkg.name}" already exists.`);
        }
        packages.push(pkg);
        this.savePackages(packages);
    }

    /**
     * Removes a package by name and saves the updated list in localStorage.
     * @param packageName {string} The name of the package to remove
     */
    removePackage(packageName: string): void {
        const packages = this.getPackages();
        const updatedPackages = packages.filter((p) => p.name !== packageName);
        if (packages.length === updatedPackages.length) {
            throw new Error(`Package with name "${packageName}" not found.`);
        }
        this.savePackages(updatedPackages);
    }

    /**
     * Saves the list of packages to localStorage.
     * @param packages {Package[]} The list of packages to save
     */
    private savePackages(packages: Package[]): void {
        localStorage.setItem(this.storageKey, JSON.stringify(packages));
    }
}
