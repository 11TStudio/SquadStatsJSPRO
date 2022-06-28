const chalk = require("chalk");
const version = require("../package.json").version;
const axios = require("axios");

module.exports = class {
	constructor(client) {
		this.client = client;
	}

	async run() {
		const client = this.client;
		const socket = client.socket;
		const nameChecker = await client.getNameCheckerConfig();
		if (socket) {
			socket.on("connect_error", (err) => {
				return client.logger.log(err, "ERROR");
			});
			// /* Squad Creating Plugin */
			// 	await client.emit("squadCreating", squadVotingGuild, "851451690020110346", socket);
			//
			client.logger.log("Loading PLAYER_CONNECTED event.", "log");

			// When player is connected.
			socket.on("PLAYER_CONNECTED", async (playerData) => {
				await client.emit(
					"sessionStart",
					playerData
					)
				// here all events that relate with player connection
				const banData = await client.getPlayerBan(playerData?.player?.steamID),
					owner = await client.findUserByID(client.config.owner.id);
				if (!owner.apiToken) return;
				if (banData.length > 0) {
					// check every ban the player has
					for (let i = 0; i < banData.length; i++) {
						const ban = banData[i];
						if (ban.endDate > new Date().getTime()) {
							// if the player is banned, then kick him
							await axios.post(client.config.dashboard.baseURL + "/squad-api/kick", {
								apiToken: owner.apiToken,
								steamUID: ban.steamID,
								reason: ban.reason,
							})
						} else {
							// set the data in db to false if the player is not banned anymore
							await axios.post(client.config.dashboard.baseURL + "/squad-api/banlist/removeUserBanlist", {
								steamUID: ban.steamID,
								reason: "Time Expired",
								endDate: ban.endDate,
								apiToken: owner.apiToken,
							})
						}
					}
				}
				// Name checker plugin
				if (nameChecker.enabled) {
					await client.emit(
						"onPlayerConnection",
						client.config.support.logs,
						playerData,
						nameChecker
					);
				}
				// ingame sessions 


			});

			socket.on("PLAYER_DISCONNECTED", async (playerData) => {
				// session ends
				await client.emit(
					"sessionEnd",
					playerData
					);
			});

			socket.on("PLAYER_DIED", async (playerData) => {
				const inList_isAttacker = client.players.find((p) => p.player.steamID === playerData?.attacker?.steamID);
				if (inList_isAttacker) {
					inList_isAttacker.session.kills++;
				}
				const inList_isVictim = client.players.find((p) => p.player.steamID === playerData?.victim?.steamID);
				if (inList_isVictim) {
					inList_isVictim.session.deaths++;
				}
			})

			socket.on("PLAYER_REVIVED", async (playerData) => {
				const inList_isReviver = client.players.find((p) => p.player.steamID === playerData?.reviver?.steamID);
				if (inList_isReviver) {
					inList_isReviver.session.revives++;
				}
			})



			
				


			// When players writes something
			// socket.on("CHAT_MESSAGE", async (messageData) => {
			// });

			// When player goes in to admin camera
			// socket.on("POSSESSED_ADMIN_CAMERA", async (playerData) => {
			// 	// here all events that relate with player connection
			// });
		}
		// Logs some informations using the logger file
		client.logger.log(
			`Loading a total of ${client.commands.size} command(s).`,
			"log"
		);

		client.logger.log(
			`${client.user.tag}, ready to serve ${client.users.cache.size}.`,
			"ready"
		);

		// STREAMERS PERMS ?
		// // setInterval(function () {
		// client.on("presenceUpdate", (oldPresence, newPresence) => {
		// 	if (!newPresence.activities) return false;
		// 	newPresence.activities.forEach(activity => {
		// 		if (activity.type == "STREAMING" && activity.state == "Squad") {
		// 			console.log(activity);
		// 			console.log(`${newPresence.user.tag} is streaming at ${activity.url}.`);
		// 		}
		// 	});
		// });
		// // }, 20000); // Every 20 seconds
		// Start the dashboard
		if (client.config.dashboard.enabled) {
			client.dashboard.load(client);
		}

		let i = 0;

		setInterval(function () {
			const toDisplay =
				client.config.status[parseInt(i, 10)].name + " | v" + version;
			client.user.setActivity(toDisplay, {
				type: client.config.status[parseInt(i, 10)].type,
			});
			if (client.config.status[parseInt(i + 1, 10)]) i++;
			else i = 0;
		}, 20000); // Every 20 seconds

		setTimeout(() => {
			console.log(
				chalk.magenta("\n\nSquadStatsJS Ready!"),
				"Made with ❤️   by LeventHAN https://github.com/11TStudio/SquadStatsJSPRO"
			);
		}, 400);
	}
};
