'use strict';
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const LOGGING_ENTITY_NAME = 'serverless-vault-vars';
const VAULT_DEFAULT_ADDRESS = 'http://localhost:8200';

function validateVaultVar(input) {
	if (input.length === 0 || !input.includes('.') || !input.includes('/') ||
			// If length isn't 2*delimeters + 1, then we are sure we have a double delimiter somehwere,
			// might as well stop trying to run this
			input.length < (input.match(/[\/\.]/g).length * 2) + 1) {
		throw `Incorrect vault var format, expecting: some/var.a.b, got: ${input}`;
	}
}

class ServerlessVaultPlugin {
	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;

		// Init vars
		this.vaultToken = this.determineVaultToken();
		this.vaultAddress= this.detemineVaultAddress();
		this.resolveVaultVariable = this.resolveVaultVariable.bind(this);

		// Detemine config
		this.serverless.cli.log(`Using vault address: ${this.vaultAddress}`, LOGGING_ENTITY_NAME);

		this.axios = axios.create({
			baseURL: `${this.vaultAddress.replace(/\/$/, '')}/v1`,
			timeout: 1000,
			headers: {'X-Vault-Token': this.vaultToken}
		});

		this.configurationVariablesSources = {
			vault: {
				resolve: async ({ address }) => {
					const res = await this.resolveVaultVariable(address);
					return { value: res };
				}
			}
		}

		// This method is to be deprecated. left here for compatibility for now.
		this.variableResolvers = {
			vault: this.resolveVaultVariable
		}
	}

	determineVaultToken() {
		// Order: pull from custom vars first, then try environment vars,
		// and lastly try to read the token file in ~/.vault-token (used by the vault cli)
		if (this.serverless.service.custom.vault_token) {
			this.serverless.cli.log("Using vault token custom var", LOGGING_ENTITY_NAME);
			return this.serverless.service.custom.vault_token;
		}

		if (process.env.VAULT_TOKEN) {
			this.serverless.cli.log("Using vault token env var", LOGGING_ENTITY_NAME);
			return process.env.VAULT_TOKEN;
		}

		const homeDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
		if (fs.existsSync(path.join(homeDir, ".vault-token"))) {
			this.serverless.cli.log("Using vault token file", LOGGING_ENTITY_NAME);
			return fs.readFileSync(path.join(homeDir, ".vault-token")).toString();
		}
		this.serverless.cli.log("WARNING: Couldn't determine token source", LOGGING_ENTITY_NAME);
	}

	detemineVaultAddress() {
		// Order: pull from custom vars first, then try environment vars,
		// lastly: default to localhost
		if (this.serverless.service.custom.vault_address) {
			return this.serverless.service.custom.vault_address;
		}

		if (process.env.VAULT_ADDR) {
			return process.env.VAULT_ADDR;
		}

		return VAULT_DEFAULT_ADDRESS;
	}

	async resolveVaultVariable(src) {
		// We expect a path of the form some/path.key and will then return a value
		const vaultVar = src.startsWith("vault:") ? src.slice(6) : src;
		validateVaultVar(vaultVar);

		const secretPath = vaultVar.split('.')[0];
		const valuePath = vaultVar.split('.').slice(1);

		const urlParts = secretPath.split('/');
		urlParts.splice(1, 0, 'data');

		let result = {};
		try {
			const res = await this.axios.get(urlParts.join('/'));
			result = res.data.data.data;
		} catch(e) {
			throw {
				message: `Error communicating with vault: ${e.message} for var: ${src}`,
				address: this.vaultAddress
			};
		}

		const value = valuePath.reduce((acc, curr) => acc[curr], result);
		if (value == null) {
			this.serverless.cli.log(`WARNING: value is null or undefined for ${src}`, LOGGING_ENTITY_NAME);
		}
		
		return value;
	}
}

module.exports = ServerlessVaultPlugin;
