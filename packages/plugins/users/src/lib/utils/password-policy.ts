import { CliUsersModuleConfig } from '../models/users-module-config';

/** Build a validator for the configured password policy (null = valid). */
export const DEFAULT_PASSWORD_POLICY = { minLength: 8 };

export function createPasswordPolicyValidator(
    policy: CliUsersModuleConfig['passwordPolicy'] = DEFAULT_PASSWORD_POLICY,
): (password: string) => string | null {
    return (password: string) => {
        if (!password) return 'Password is required';
        if (password.length > 1024) return 'Password is too long';
        if (!policy) return null;
        if (policy.minLength && password.length < policy.minLength) {
            return `Password must be at least ${policy.minLength} characters`;
        }
        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (policy.requireDigit && !/\d/.test(password)) {
            return 'Password must contain at least one digit';
        }
        if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
            return 'Password must contain at least one special character';
        }
        return null;
    };
}
