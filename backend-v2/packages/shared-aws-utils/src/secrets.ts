/**
 * AWS Secrets Manager utilities for TypeScript/Node.js
 *
 * Provides a simple interface for managing secrets in AWS Secrets Manager
 * with support for JSON storage and async operations.
 */

import {
	CreateSecretCommand,
	DeleteSecretCommand,
	DescribeSecretCommand,
	GetSecretValueCommand,
	InvalidParameterException,
	InvalidRequestException,
	ListSecretsCommand,
	ResourceExistsException,
	ResourceNotFoundException,
	SecretsManagerClient,
	UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * AWS Secrets Manager client with helper methods
 *
 * Handles secret storage, retrieval, and management with support for:
 * - JSON serialization/deserialization
 * - Async operations
 * - Error handling
 */
export class SecretsManager {
	private client: SecretsManagerClient;

	/**
	 * Initialize Secrets Manager client
	 *
	 * @param region - AWS region (defaults to environment AWS_REGION)
	 */
	constructor(region?: string) {
		this.client = new SecretsManagerClient({
			region: region || process.env.AWS_REGION || 'us-east-1',
		});
	}

	/**
	 * Retrieve a secret from Secrets Manager
	 *
	 * @param secretName - Name of the secret
	 * @param asJson - If true, parse SecretString as JSON (default: true)
	 * @returns Secret value as object (if asJson=true) or string
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * const apiKey = await manager.getSecret('supermemory-api-key');
	 * console.log(apiKey.key);
	 * ```
	 */
	async getSecret<T = Record<string, any>>(
		secretName: string,
		asJson: boolean = true
	): Promise<T | string> {
		try {
			const command = new GetSecretValueCommand({
				SecretId: secretName,
			});

			const response = await this.client.send(command);

			const secretString = response.SecretString;
			if (!secretString) {
				// Handle binary secrets (not common for our use case)
				const secretBinary = response.SecretBinary;
				if (secretBinary) {
					return Buffer.from(secretBinary).toString('utf-8');
				}
				throw new Error(`Secret '${secretName}' exists but has no content`);
			}

			if (asJson) {
				return JSON.parse(secretString) as T;
			}
			return secretString;
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				console.warn(`Secret not found: ${secretName}`);
				throw new Error(`Secret '${secretName}' does not exist`);
			} else if (error instanceof InvalidRequestException) {
				console.error(`Invalid request for secret: ${secretName}`);
				throw new Error(`Invalid request for secret '${secretName}'`);
			} else if (error instanceof InvalidParameterException) {
				console.error(`Invalid parameter for secret: ${secretName}`);
				throw new Error(`Invalid parameter for secret '${secretName}'`);
			} else {
				console.error(`Error retrieving secret ${secretName}:`, error);
				throw new Error(`Failed to retrieve secret '${secretName}': ${error}`);
			}
		}
	}

	/**
	 * Create a new secret in Secrets Manager
	 *
	 * @param secretName - Name for the secret
	 * @param secretValue - Secret value (object will be JSON serialized)
	 * @param description - Optional description
	 * @param tags - Optional tags [{ Key: 'Environment', Value: 'dev' }]
	 * @returns ARN of the created secret
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * const arn = await manager.createSecret(
	 *   'api-key-service-x',
	 *   { api_key: 'sk_test_123' },
	 *   'Service X API key'
	 * );
	 * ```
	 */
	async createSecret(
		secretName: string,
		secretValue: Record<string, any> | string,
		description?: string,
		tags?: Array<{ Key: string; Value: string }>
	): Promise<string> {
		try {
			// Serialize object to JSON
			const secretString =
				typeof secretValue === 'object'
					? JSON.stringify(secretValue)
					: secretValue;

			const command = new CreateSecretCommand({
				Name: secretName,
				SecretString: secretString,
				Description: description,
				Tags: tags,
			});

			const response = await this.client.send(command);
			console.log(`Created secret: ${secretName}`);

			return response.ARN || '';
		} catch (error) {
			if (error instanceof ResourceExistsException) {
				console.warn(`Secret already exists: ${secretName}`);
				throw new Error(`Secret '${secretName}' already exists`);
			} else {
				console.error(`Error creating secret ${secretName}:`, error);
				throw new Error(`Failed to create secret '${secretName}': ${error}`);
			}
		}
	}

	/**
	 * Update an existing secret's value
	 *
	 * @param secretName - Name of the secret to update
	 * @param secretValue - New secret value (object will be JSON serialized)
	 * @returns ARN of the updated secret
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * await manager.updateSecret(
	 *   'gmail-tokens-user123',
	 *   { access_token: 'new_token', refresh_token: 'refresh' }
	 * );
	 * ```
	 */
	async updateSecret(
		secretName: string,
		secretValue: Record<string, any> | string
	): Promise<string> {
		try {
			// Serialize object to JSON
			const secretString =
				typeof secretValue === 'object'
					? JSON.stringify(secretValue)
					: secretValue;

			const command = new UpdateSecretCommand({
				SecretId: secretName,
				SecretString: secretString,
			});

			const response = await this.client.send(command);
			console.log(`Updated secret: ${secretName}`);

			return response.ARN || '';
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				console.warn(`Secret not found for update: ${secretName}`);
				throw new Error(`Secret '${secretName}' does not exist`);
			} else {
				console.error(`Error updating secret ${secretName}:`, error);
				throw new Error(`Failed to update secret '${secretName}': ${error}`);
			}
		}
	}

	/**
	 * Delete a secret from Secrets Manager
	 *
	 * @param secretName - Name of the secret to delete
	 * @param recoveryWindowDays - Days before permanent deletion (7-30, default: 30)
	 * @param forceDelete - If true, delete immediately without recovery window
	 * @returns Deletion response
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * // Schedule deletion (30 day recovery)
	 * await manager.deleteSecret('old-api-key');
	 *
	 * // Immediate deletion
	 * await manager.deleteSecret('temp-secret', 0, true);
	 * ```
	 */
	async deleteSecret(
		secretName: string,
		recoveryWindowDays: number = 30,
		forceDelete: boolean = false
	): Promise<any> {
		try {
			const command = new DeleteSecretCommand({
				SecretId: secretName,
				ForceDeleteWithoutRecovery: forceDelete,
				RecoveryWindowInDays: forceDelete ? undefined : recoveryWindowDays,
			});

			const response = await this.client.send(command);
			console.log(`Deleted secret: ${secretName} (force=${forceDelete})`);

			return response;
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				console.warn(`Secret not found for deletion: ${secretName}`);
				throw new Error(`Secret '${secretName}' does not exist`);
			} else {
				console.error(`Error deleting secret ${secretName}:`, error);
				throw new Error(`Failed to delete secret '${secretName}': ${error}`);
			}
		}
	}

	/**
	 * Check if a secret exists
	 *
	 * @param secretName - Name of the secret
	 * @returns True if secret exists, False otherwise
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * if (await manager.secretExists('api-key')) {
	 *   console.log('Secret exists');
	 * }
	 * ```
	 */
	async secretExists(secretName: string): Promise<boolean> {
		try {
			const command = new DescribeSecretCommand({
				SecretId: secretName,
			});
			await this.client.send(command);
			return true;
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				return false;
			}
			throw error;
		}
	}

	/**
	 * List secrets in Secrets Manager
	 *
	 * @param namePrefix - Optional prefix filter (e.g., 'gmail-tokens-')
	 * @param maxResults - Maximum number of results (default: 100)
	 * @returns List of secret metadata
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * // List all Gmail tokens
	 * const gmailSecrets = await manager.listSecrets('gmail-tokens-');
	 * for (const secret of gmailSecrets) {
	 *   console.log(secret.Name);
	 * }
	 * ```
	 */
	async listSecrets(
		namePrefix?: string,
		maxResults: number = 100
	): Promise<any[]> {
		try {
			const command = new ListSecretsCommand({
				MaxResults: maxResults,
				Filters: namePrefix
					? [
							{
								Key: 'name',
								Values: [namePrefix],
							},
					  ]
					: undefined,
			});

			const response = await this.client.send(command);
			return response.SecretList || [];
		} catch (error) {
			console.error('Error listing secrets:', error);
			throw new Error(`Failed to list secrets: ${error}`);
		}
	}

	/**
	 * Get secret if it exists, otherwise create with default value
	 *
	 * @param secretName - Name of the secret
	 * @param defaultValue - Value to use if secret doesn't exist
	 * @param description - Optional description for new secret
	 * @returns Secret value (existing or newly created)
	 *
	 * @example
	 * ```typescript
	 * const manager = new SecretsManager();
	 * const config = await manager.getOrCreateSecret(
	 *   'app-config',
	 *   { debug: false, api_url: 'https://api.example.com' }
	 * );
	 * ```
	 */
	async getOrCreateSecret<T = Record<string, any>>(
		secretName: string,
		defaultValue: Record<string, any> | string,
		description?: string
	): Promise<T | string> {
		try {
			return await this.getSecret<T>(secretName);
		} catch (error) {
			// Secret doesn't exist, create it
			await this.createSecret(secretName, defaultValue, description);
			return defaultValue as T;
		}
	}

	/**
	 * Build a secret name from a pattern with parameters
	 *
	 * @param pattern - Secret name pattern with {placeholders}
	 * @param params - Values to substitute in pattern
	 * @returns Formatted secret name
	 *
	 * @example
	 * ```typescript
	 * const name = SecretsManager.buildSecretName(
	 *   'gmail-tokens-{user_id}',
	 *   { user_id: 'user123' }
	 * );
	 * console.log(name); // 'gmail-tokens-user123'
	 *
	 * const name2 = SecretsManager.buildSecretName(
	 *   '{env}/{service}/api-key',
	 *   { env: 'prod', service: 'payment' }
	 * );
	 * console.log(name2); // 'prod/payment/api-key'
	 * ```
	 */
	static buildSecretName(
		pattern: string,
		params: Record<string, string>
	): string {
		return pattern.replace(/{(\w+)}/g, (_, key) => params[key] || `{${key}}`);
	}
}

/**
 * Convenience function to get a user-specific secret
 *
 * @param secretType - Type of secret (e.g., 'gmail-tokens', 'gcal-tokens')
 * @param userId - User identifier
 * @param region - Optional AWS region
 * @returns Secret value as object
 *
 * @example
 * ```typescript
 * const tokens = await getUserSecret('gmail-tokens', 'user123');
 * console.log(tokens.access_token);
 * ```
 */
export async function getUserSecret<T = Record<string, any>>(
	secretType: string,
	userId: string,
	region?: string
): Promise<string | T> {
	const manager = new SecretsManager(region);
	const secretName = `${secretType}-${userId}`;
	return manager.getSecret<T>(secretName);
}

/**
 * Convenience function to update a user-specific secret
 *
 * @param secretType - Type of secret (e.g., 'gmail-tokens', 'gcal-tokens')
 * @param userId - User identifier
 * @param secretValue - New secret value
 * @param region - Optional AWS region
 * @returns ARN of updated secret
 *
 * @example
 * ```typescript
 * await updateUserSecret(
 *   'gmail-tokens',
 *   'user123',
 *   { access_token: 'new_token', refresh_token: 'refresh' }
 * );
 * ```
 */
export async function updateUserSecret(
	secretType: string,
	userId: string,
	secretValue: Record<string, any>,
	region?: string
): Promise<string> {
	const manager = new SecretsManager(region);
	const secretName = `${secretType}-${userId}`;
	return manager.updateSecret(secretName, secretValue);
}
