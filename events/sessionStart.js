const chalk = require("chalk");
const version = require("../package.json").version;
const axios = require("axios");

module.exports = class {
	constructor(client) {
		this.client = client;
	}

	async run(playerData) {
		const client = this.client;
        playerData.entry = Date.now();
        playerData.session = {
            date: Date.now(),
            kills: 0,
            deaths: 0,
            revives: 0,
        }
        client.players.push(playerData);
    }
}