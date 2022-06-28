const { Client, Collection, Intents } = require("discord.js");

const util = require("util"),
	path = require("path"),
	fs = require("fs"),
	moment = require("moment"),
	MYSQLPromiseObjectBuilder = require("./MYSQLPromiseObjectBuilder.js"),
	axios = require("axios"),
	BM = require("@leventhan/battlemetrics");

const mysql = require("mysql2");
moment.relativeTimeThreshold("s", 60);
moment.relativeTimeThreshold("ss", 5);
moment.relativeTimeThreshold("m", 60);
moment.relativeTimeThreshold("h", 60);
moment.relativeTimeThreshold("d", 24);
moment.relativeTimeThreshold("M", 12);

// Creates SquadStatsJSv3 class
class SquadStatsJSv3 extends Client {
	constructor() {
		super({
			intents: [
				Intents.FLAGS.GUILDS,
				Intents.FLAGS.GUILD_MEMBERS,
				Intents.FLAGS.GUILD_MESSAGES,
				Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
				Intents.FLAGS.GUILD_VOICE_STATES,
				Intents.FLAGS.DIRECT_MESSAGES,
			],
			allowedMentions: {
				parse: ["users"],
			},
		});
		// init axios here
		this.axios = axios;
		this.BattleMetrics = null;
		this.config = {};
		this.customEmojis = require("../emojis.json"); // load the bot's emojis
		this.languages = require("../languages/language-meta.json"); // Load the bot's languages
		this.commands = new Collection(); // Creates new commands collection
		this.aliases = new Collection(); // Creates new command aliases collection
		this.logger = require("../helpers/logger"); // Load the logger file
		this.wait = util.promisify(setTimeout); // client.wait(1000) - Wait 1 second
		this.functions = require("../helpers/functions"); // Load the functions file
		this.guildsData = require("./Guild"); // Guild mongoose model
		this.usersData = require("./User"); // User mongoose model
		this.logs = require("./Log"); // Log mongoose model
		this.moderation = require("./Moderation"); // Log mongoose model
		this.audit = require("./Audit"); // Audit mongoose model
		this.permission = require("./Permissions"); // Audit mongoose model
		this.whitelists = require("./Whitelist"); // Audit mongoose model
		this.clansData = require("./Clan"); // User mongoose model
		this.dashboard = require("../dashboard/app"); // Dashboard app
		this.states = {}; // Used for the dashboard
		this.knownGuilds = [];
		this.players = [];
		this.pool = null;

		this.databaseCache = {};
		this.databaseCache.users = new Collection();
		this.databaseCache.clans = new Collection();
		this.databaseCache.guilds = new Collection();

		// For the website
		this.databaseCache.audit = new Collection();
		this.databaseCache.moderation = new Collection();
		this.databaseCache.permissions = new Collection();
		this.databaseCache.whitelists = new Collection();

		this.databaseCache.usersReminds = new Collection(); // members with active reminds
		this.databaseCache.mutedUsers = new Collection(); // members who are currently muted
		this.socket = null;
	}

	async setUpBM() {
		this.BattleMetrics = new BM({
			token: this.config.apiKeys.battleMetrics,
			serverID: this.config.squadBattleMetricsID,
			game: process.env.BM_GAME || "squad",
		});
		this.logger.log("BattleMetrics Module is initialized.", "log");
	}

	async hookSocketIO() {
		if (this.config.socketIO.enabled) {
			const io = require("socket.io-client"); // Load the socket.io client
			// make socketIO connection to an IP address
			this.socket = io.connect(
				"ws://" + this.config.socketIO.ip + ":" + this.config.socketIO.port,
				{
					auth: {
						token: this.config.socketIO.token,
					},
					serverAuth: {
						token: this.config.socketIO.serverSecret,
					},
				}
			);
			// log on connection /w socket.io @ SquadJS server
			this.socket.on("connect", () => {
				this.logger.log("Socket.io connected to the SquadJS server.", "log");
			});
		}
	}
	async readConfig(configPath = "./config.json") {
		configPath = path.resolve(__dirname, "../", configPath);
		if (!fs.existsSync(configPath))
			throw new Error("Config file does not exist.");
		return fs.readFileSync(configPath, "utf8");
	}

	async parseConfig(configString) {
		try {
			return JSON.parse(configString);
		} catch (err) {
			throw new Error("Unable to parse config file, check the JSON format.");
		}
	}

	get defaultLanguage() {
		return this.languages.find((language) => language.default).name;
	}

	translate(key, args, locale) {
		if (!locale) locale = this.defaultLanguage;
		const language = this.translations.get(locale);
		if (!language) throw "Invalid language set in data.";
		return language(key, args);
	}

	printDate(date, format, locale) {
		if (!locale) locale = this.defaultLanguage;
		const languageData = this.languages.find(
			(language) =>
				language.name === locale || language.aliases.includes(locale)
		);
		if (!format) format = languageData.defaultMomentFormat;
		return moment(new Date(date)).locale(languageData.moment).format(format);
	}

	convertTime(time, type, noPrefix, locale) {
		if (!type) time = "to";
		if (!locale) locale = this.defaultLanguage;
		const languageData = this.languages.find(
			(language) =>
				language.name === locale || language.aliases.includes(locale)
		);
		const m = moment(time).locale(languageData.moment);
		return type === "to" ? m.toNow(noPrefix) : m.fromNow(noPrefix);
	}

	// This function is used to load a command and add it to the collection
	loadCommand(commandPath, commandName) {
		try {
			const props = new (require(`.${commandPath}${path.sep}${commandName}`))(
				this
			);
			this.logger.log(`Loading Command: ${props.help.name}. 👌`, "log");
			props.conf.location = commandPath;
			if (props.init) {
				props.init(this);
			}
			this.commands.set(props.help.name, props);
			props.help.aliases.forEach((alias) => {
				this.aliases.set(alias, props.help.name);
			});
			return false;
		} catch (e) {
			return `Unable to load command ${commandName}: ${e}`;
		}
	}

	// This function is used to unload a command (you need to load them again)
	async unloadCommand(commandPath, commandName) {
		let command;
		if (this.commands.has(commandName)) {
			command = this.commands.get(commandName);
		} else if (this.aliases.has(commandName)) {
			command = this.commands.get(this.aliases.get(commandName));
		}
		if (!command) {
			return `The command \`${commandName}\` doesn't seem to exist, nor is it an alias. Try again!`;
		}
		if (command.shutdown) {
			await command.shutdown(this);
		}
		delete require.cache[
			require.resolve(`.${commandPath}${path.sep}${commandName}.js`)
		];
		return false;
	}

	// This function is used to find a user data or create it
	async findOrCreateUser({ id: userID }, isLean = false) {
		if (this.databaseCache.users.get(userID)) {
			return isLean
				? this.databaseCache.users.get(userID).toJSON()
				: this.databaseCache.users.get(userID);
		} else {
			let userData = isLean
				? await this.usersData.findOne({ id: userID }).lean()
				: await this.usersData.findOne({ id: userID });
			if (userData) {
				if (!isLean) this.databaseCache.users.set(userID, userData);
				return userData;
			} else {
				userData = new this.usersData({ id: userID });
				await userData.save();
				this.databaseCache.users.set(userID, userData);
				return isLean ? userData.toJSON() : userData;
			}
		}
	}

	async findOrCreateClan({ id: clanID }, isLean = false) {
		if (this.databaseCache.clans.get(clanID)) {
			return isLean
				? this.databaseCache.clans.get(clanID).toJSON()
				: this.databaseCache.clans.get(clanID);
		} else {
			let clanData = isLean
				? await this.clansData.findOne({ id: clanID }).lean()
				: await this.clansData.findOne({ id: clanID });
			if (clanData) {
				if (!isLean) this.databaseCache.clans.set(clanID, clanData);
				return clanData;
			} else {
				clanData = new this.clansData({ id: clanID });
				await clanData.save();
				this.databaseCache.clans.set(clanID, clanData);
				return isLean ? clanData.toJSON() : clanData;
			}
		}
	}

	// Will get the user data via userID and will put the given steam object in it and save it.
	async linkSteamAccount(userID, steamObj, attempt = 0) {
		// In case something goes wrong, we want to make sure we don't have a steam account linked to this user
		if (steamObj.id) {
			const userData = await this.findOrCreateUser({ id: userID });
			if (!userData) return;
			// check if userData has a steam account
			if (!userData.steam) {
				const playerBattleMetrics = await this.BattleMetrics.getPlayerInfoBy("steamID", steamObj.id);
				if(!playerBattleMetrics?.data[0]?.id) {
					if(attempt > 3){
						this.logger.log(`Unable to get BM ID from BattleMetrics API for DiscordID: ${userID} - Name: ${steamObj.displayName}. Attempting to save only steam details.`, "error");
						userData.steam = steamObj._json;
						await userData.markModified("steam");
						await userData.save();
						return;
					}
					attempt++;
					this.wait(1500).then(
						() => this.linkSteamAccount(userID, steamObj, attempt)
					);
				} else {
					userData.battleMetricsID = playerBattleMetrics?.data[0]?.id;
					userData.steam = steamObj._json;
					await userData.markModified("steam");
					await userData.save();
					return;
				}
			}
		}
	}

	// Will check if the user has a steam account linked to them and send back the steam data if so
	async linkedSteamAccount(userID) {
		const userData = await this.usersData.findOne({ "steam.steamid": userID });
		if (!userData) return false;
		return userData.steam;
	}

	// Checks if the user.id is the same as the owners id given in the config file
	async isOwner(id) {
		return this.config.owner.id === id;
	}

	// Will return the user that the token belongs to
	async fetchUserByToken(token) {
		const apiUser = await this.usersData.findOne({ apiToken: token });
		if (apiUser) {
			const userData = await this.findOrCreateUser({ id: apiUser.id }, true);
			return userData;
		} else {
			return null;
		}
	}

	// Will save the ip address of the user by its user.id
	async apiSaveIP(userID, ip) {
		const user = await this.usersData.findOne({ id: userID });
		if (!user.lastIp.includes(ip)) {
			// save the ip to the user lastIp array
			user.lastIp.push(ip);
			// save the user
			await user.save();
		}
	}

	// This function is used to find a guild data or create it
	async findOrCreateGuild({ id: guildID }, isLean) {
		if (this.databaseCache.guilds.get(guildID)) {
			return isLean
				? this.databaseCache.guilds.get(guildID).toJSON()
				: this.databaseCache.guilds.get(guildID);
		} else {
			let guildData = isLean
				? await this.guildsData
					.findOne({ id: guildID })
					.populate("members")
					.lean()
				: await this.guildsData.findOne({ id: guildID }).populate("members");
			if (guildData) {
				if (!isLean) this.databaseCache.guilds.set(guildID, guildData);
				return guildData;
			} else {
				guildData = new this.guildsData({ id: guildID });
				await guildData.save();
				this.databaseCache.guilds.set(guildID, guildData);
				return isLean ? guildData.toJSON() : guildData;
			}
		}
	}

	async getNameCheckerConfig() {
		const guild = await this.findOrCreateGuild({ id: this.config.serverID });
		return {
			enabled: guild.plugins.squad.nameChecker.enabled,
			kickMessage: guild.plugins.squad.nameChecker.kickMessage,
			showWhichLetters: guild.plugins.squad.nameChecker.showWhichLetters,
			blacklist: guild.plugins.squad.nameChecker.blacklist,
			matchRegex: guild.plugins.squad.nameChecker.matchRegex,
		};
	}

	// This function is used to create a log data in the mongodb
	async addLog({
		action: action,
		author: { discord: discordDetails, steam: steamDetails },
		details: { details: moreDetails },
		ip: ip,
	}) {
		const logData = new this.audit({
			action: action,
			author: { discord: discordDetails, steam: steamDetails },
			ip: ip,
			details: { details: moreDetails },
		});
		await logData.save();
		return logData;
	}

	async addModeration({
		steamID: steamID,
		moderatorSteamID: moderatorSteamID,
		moderatorName: moderatorName,
		moderator: moderator,
		typeModeration: typeModeration,
		reason: reason,
		endDate: endDate,
	}) {
		const moderationRow = new this.moderation({
			steamID: steamID,
			moderatorSteamID: moderatorSteamID,
			moderatorName: moderatorName,
			moderator: moderator,
			typeModeration: typeModeration,
			reason: reason,
			endDate: endDate,
		});
		await moderationRow.save();
		return moderationRow;
	}

	// Will create/init the mock data for permissions
	async createPermissions() {
		const doesExist = await this.permission.find({}).lean();
		if (doesExist.length !== 0)
			return this.logger.log("Permissions schema already exist. 👌", "log");
		this.permission.create({}).catch((err) => {
			return console.log(err);
		});
		this.logger.log("Permissions schema is created 👌", "log");
	}

	// Will create/init the mock data for permissions
	async createWhitelist() {
		const doesExist = await this.whitelists.find({}).lean();
		if (doesExist.length !== 0) return;
		this.whitelists.create({}).catch((err) => {
			return console.log(err);
		});
		this.logger.log("Whitelists default schema is created 👌", "log");
	}

	// Will replace the Whitelist by the new one given (file)
	async importWhitelist({ roles: roles, whitelisted: whitelisted }) {
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		whitelist.roles = roles;
		whitelist.memberData = whitelisted;
		await whitelist.save();
		this.logger.log(
			"Whitelists schema is imported via the dashboard 👌",
			"log"
		);
	}

	async getBanlist() {
		const bans = await this.moderation.find({});
		return bans.filter((ban) => ban.typeModeration === "ban");
	}
	async getPlayerBan(steamID) {
		const bans = await this.moderation.find({
			steamID: steamID,
			active: true,
			typeModeration: "ban",
			$or:
				[
					{
						endDate:
						{
							$gt: Date.now()
						}
					},
					{
						endDate:
						{	
							$eq: 0
						}
					}
				]
			});
		return bans;
	}
	async editBan(steamID, oldDate, newDate, reason)
	{
		await this.moderation.findOneAndUpdate(
			{ steamID: steamID, endDate: oldDate },
			{ $set: { endDate: newDate, reason: reason } }
		);
		return true;
	}

	// Returns the whitelist roles only (Groups)
	async getWhitelistRoles() {
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		return whitelist.roles;
	}
	// Returns the whitelist users only (Accounts)
	async getWhitelistUsers() {
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		return whitelist.memberData;
	}

	async removeUserBanlist(steamID, endDate) {
		const ban = await this.moderation.findOne({
			steamID: steamID,
			endDate: endDate,
			active: true,
		});
		ban.active = false;
		await ban.save();
		return true;
	}

	// Remove user from whitelist by steamID
	async removeUserWhitelist(steamID) {
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		delete whitelist.memberData[steamID];
		await whitelist.markModified("memberData");
		await whitelist.save();
	}

	async removeWhitelistRole(role) {
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		delete whitelist.roles[role];
		await whitelist.markModified("roles");
		await whitelist.save();
	}

	// Add a single role (Groupe) to a permission groupe or if not exist make it.
	async addWhitelistRolePermission(role, permission) {
		// Normally there is only one, but might want to change it to .find({}) later
		const whitelists = await this.whitelists.findOne({});
		if (!whitelists) return;
		if (!whitelists.roles[role]) return;
		whitelists.roles[role].permissions.push(permission);
		await whitelists.markModified("roles");
		await whitelists.save();
	}

	// Remove a single role
	async removeWhitelistRolePermission(role, permission) {
		const whitelists = await this.whitelists.findOne({});
		if (!whitelists) return;
		if (!whitelists.roles[role]) return;
		whitelists.roles[role].permissions = whitelists.roles[
			role
		].permissions.filter((perm) => perm !== permission);
		await whitelists.markModified("roles");
		await whitelists.save();
	}

	// will add a new group to the whitelist schema
	async addWhitelistGroup(group) {
		const whitelists = await this.whitelists.findOne({});
		if (!whitelists) return;
		whitelists.roles[group] = {
			permissions: [],
			name: group,
		};
		await whitelists.markModified("roles");
		await whitelists.save();
	}

	// will add whitelist to an user
	async addUserWhitelist(steamID, role, description) {
		const whitelists = await this.whitelists.findOne({});
		if (!whitelists) return;
		whitelists.memberData[steamID] = {
			role: role,
			description: description,
		};
		await whitelists.markModified("memberData");
		await whitelists.save();
	}
	async findUserByID(userID) {
		const user = await this.usersData.findOne({ id: userID });
		if (!user) return;
		return user;
	}
	async addMember(steamID, name, whitelisted, clanID){
		const isInClan = await this.getUsersClan(steamID);
		if(isInClan) return { status: "nok", message: "User is already in a clan" };
		// get the clan from the database
		const clan = await this.clansData.findOne({id: clanID});
		if (!clan) return { status: "nok", message: "We couldn't find the clan you are on" };
		// get the member from the database
		clan.manualWhitelistedUsers.push({
			name: name,
			whitelisted: whitelisted,
			steamID: steamID,
		});
		await clan.markModified("manualWhitelistedUsers");
		await clan.save();
		return { status: "ok", message: "User added to clan" };
	}

	// Righnot hard coded. Might wanna change this...
	async getAllAvaibleAccesLevels() {
		return [
			{
				level: "changemap",
				description: "Map commands",
			},
			{
				level: "canseeadminchat",
				description: "This group can see the admin chat + teamkills",
			},
			{
				level: "balance",
				description: "This group can switch teams regardless of team sizes",
			},
			{
				level: "pause",
				description: "Match commands",
			},
			{
				level: "cheat",
				description: "Access to some cheat commands",
			},
			{
				level: "private",
				description: "Set server private",
			},
			{
				level: "chat",
				description: "Admin chat",
			},
			{
				level: "kick",
				description: "kick commands",
			},
			{
				level: "ban",
				description: "ban commands",
			},
			{
				level: "config",
				description: "Set server configuration",
			},
			{
				level: "immune",
				description: "Cannot be kicked or banned",
			},
			{
				level: "manageserver",
				description: "Manage server / kill server",
			},
			{
				level: "cameraman",
				description: "Spectate players",
			},
			{
				level: "featuretest",
				description: "Debug commands like Vehicle Spawner",
			},
			{
				level: "forceteamchange",
				description: "Allows forced team changes",
			},
			{
				level: "reserve",
				description: "Reserved slot access",
			},
			{
				level: "demos",
				description: "Record demo's (currently broken)",
			},
			{
				level: "debug",
				description: "Debug commands",
			},
			{
				level: "teamchange",
				description: "Change teams without penalty",
			},
		];
	}

	async getPlayersLength() {
		if (!this.socket) return "N/A";
		this.players;
		const response = new Promise((res) => {
			this.socket.emit("players", async (data) => {
				res(data);
			});
		});
		this.players = response;
		return await this.players.then((players) => players.length);
	}

	// Will return the users dashboard roles ("owner", "admin", etc..)
	async getRoles(userID) {
		// search the roles for the userID
		const user = await this.usersData.findOne({ id: userID });
		if (!user || !user.roles) return;
		return user.roles;
	}

	// Get all role names that can do the "action" (kick, ban, etc..)
	async whoCan(action) {
		// get the permissions
		const perms = await this.permission.findOne({});
		if (!perms) return;
		// check if the action is in the permissions
		if (!perms.whoCan[action]) return;
		// return the permissions
		return perms.whoCan[action];
	}

	async getAllCanSee() {
		const perms = await this.permission.findOne({});
		if (!perms) return;
		return perms.canSee;
	}

	async getAllClans() {
		const clans = await this.clansData.find({});
		if (!clans) return;
		return clans;
	}
	async getClansMember(clanID) {
		const users = await this.usersData.find({ "whitelist.clan": clanID });
		if (!users) return;
		return users;
	}
	async getAllWhitelisted()
	{
		const whitelisteds = await this.usersData.find();
		if (!whitelisteds) return;
		return whitelisteds;
	}
	async getClan(clanID) {
		const clans = await this.clansData.findOne({ id: clanID });
		if (!clans) return;
		return clans;
	}
	async getClanWhiteLimit(clanID) {
		const clans = await this.clansData.findOne({ id: clanID });
		if (!clans) return;
		return clans.whitelistLimit;
	}
	async getClanWhitelisted(clanID) {
		const whitelisted = await this.usersData.find({ "whitelist.clan": clanID, "whitelist.byClan": true });
		let clanManualWhitelist = await this.clansData.findOne({ id: clanID });
		clanManualWhitelist = clanManualWhitelist.manualWhitelistedUsers.filter(
			(user) => user.whitelisted
		);
		const size = whitelisted.length + clanManualWhitelist.length;
		return size;
	}
	async addClan(clanName, clanLogo, clanBanner, steamID)
	{
		const token = await this.generateToken();
		const clan = await this.findOrCreateClan({id: token});
		clan.createdBy = steamID; 
		clan.name = clanName; 
		clan.logo = clanLogo; 
		clan.banner = clanBanner;
		await clan.save();

		const userCreated = await this.usersData.findOne({ "steam.steamid": steamID });
		userCreated.whitelist.clan = token;
		userCreated.whitelist.byClan = true;
		await userCreated.markModified("whitelist");
		await userCreated.save();
		return true;
	}
	async getUsersClan(steamid)
	{
		const user = await this.usersData.findOne({ "steam.steamid": steamid });
		if (!user) return;
		return await user.whitelist.clan;		
	}
	async findClanbyName(clanName)
	{
		if(!clanName) return;
		const clans = await this.clansData.findOne({name: clanName});
		if(!clans) return;
		return await clans.id;
	}
	async findClanbyID(clanID)
	{
		if(!clanID) return;
		const clans = await this.clansData.findOne({id: clanID});
		if(!clans) return;
		return await clans;
	}
	async clanAddApplication(steamID,  playHour, oldClan, additional, clanID)
	{
		const application = {};
		const clans = await this.clansData.findOne({ id: clanID });
		if(!clans) return;
		application.steamID = steamID; 
		application.playHour = playHour;
		application.oldClan = oldClan; 
		application.additional = additional; 
		application.status = true;
		await this.clansData.findOneAndUpdate({id: clanID}, {"$push": { applications: application } } );
		return;
	}
	async toggleRecruitStatus(clanID){
		let msg = false;
		const clans = await this.clansData.findOne({ id: clanID });
		if(!clans) return msg;
		clans.recruitStatus = !clans.recruitStatus;
		await clans.save();
		msg = "Recruitment status is now " + (clans.recruitStatus ? "opened" : "closed") + ".";
		return msg;
	}
	async clanAddUserWL(steamID, callback) {
		const user = await this.usersData.findOne({ "steam.steamid": steamID });
		if (!user) return callback({success: false, msg: "User not found."});
		const amountOfWhitelists = await this.getClanWhitelisted(user.whitelist.clan);
		const clanLimit = await this.getClanWhiteLimit(user.whitelist.clan);
		if (clanLimit <= amountOfWhitelists) {
			return callback({success: false, msg: "The clan whitelist limit has been reached."});
		}
		user.whitelist.byClan = true;
		await user.markModified("whitelist");
		await user.save();
		return callback({
			success: true,
			msg: "Successful whitelisted."
		});
	}
	async clanAddUserWLManual(steamID, clanID, callback) {
		await this.clansData.findOne({ id: clanID }).exec(async (err, clan) => {
			if (err) return callback({success: false, msg: "Can't find clan."});
			const amountOfWhitelists = await this.getClanWhitelisted(clanID);
			const clanLimit = await this.getClanWhiteLimit(clanID);
			if (clanLimit <= amountOfWhitelists) {
				return callback({success: false, msg: "The clan whitelist limit has been reached."});
			}
			for (let i = 0; i < clan.manualWhitelistedUsers.length; i++) {
				if (clan.manualWhitelistedUsers[i].steamID === steamID) {
					clan.manualWhitelistedUsers[i].whitelisted = true;
					await clan.markModified("manualWhitelistedUsers");
					await clan.save(function (err) {
						if (err) {
							return callback({
								success: false,
								msg: "Update failed"
							});
						}
						return callback({
							success: true,
							msg: "Successful updated."
						});
					});
				}
			}
		});
	}
	async clanRemoveUserWL(steamID) {
		const user = await this.usersData.findOne({ "steam.steamid": steamID });
		if (!user) return;
		user.whitelist.byClan = false;
		await user.markModified("whitelist");
		await user.save();
		return true;
	}
	async clanRemoveUserWLManual(steamID, clanID) {
		const res = await this.clansData.find({ "id": clanID }).exec(async (err, clan) => {
			if (err) return;
			for (let i = 0; i < clan[0].manualWhitelistedUsers.length; i++) {
				if (clan[0].manualWhitelistedUsers[i].steamID === steamID) {
					clan[0].manualWhitelistedUsers[i].whitelisted = false;
					clan[0].markModified("manualWhitelistedUsers");
					clan[0].save(function (err) {
						if (err) {
							return ({
								success: false,
								msg: "Update failed"
							});
						}
						return ({
							success: true,
							msg: "Successful updated."
						});
					});
				}
			}
			return res;
		});	
	}
	async clanRemoveUserManual(steamID, clanID) {
		const res = await this.clansData.find({ "id": clanID }).exec(async (err, clan) => {
			if (err) return;
			for (let i = 0; i < clan[0].manualWhitelistedUsers.length; i++) {
				if (clan[0].manualWhitelistedUsers[i].steamID === steamID) {
					// remove clan[0].manualWhitelistedUsers[i] from clan[0].manualWhitelistedUsers
					clan[0].manualWhitelistedUsers.splice(i, 1);
					clan[0].markModified("manualWhitelistedUsers");
					clan[0].save(function (err) {
						if (err) {
							return ({
								success: false,
								msg: "Update failed"
							});
						}
						return ({
							success: true,
							msg: "Successful updated."
						});
					});
				}
			}
			return res;
		});	
	}
	
	async disbandClan(clanID)
	{
		// get all users that have this clan in their whitelist
		const users = await this.usersData.find({ "whitelist.clan": clanID });

		users.forEach(async user => {
			user.whitelist.clan= null;
			user.whitelist.byClan= false;
			await user.markModified("whitelist");
			await user.save();
		});
		const clan = await this.findOrCreateClan({id: clanID});
		await clan.delete();
		return true;
	}
	async getClanApps(clanID)
	{
		const clan = await this.clansData.findOne({id: clanID});
		for(const app in clan.applications)
		{
			if(clan.applications[app].status == true) return [clan.applications[app]];
		}
	}
	async leaveClan(steamID) {
		const user = await this.usersData.findOne({ "steam.steamid": steamID });
		if (!user) return;
		user.whitelist.clan = null;
		user.whitelist.byClan = false;
		await user.markModified("whitelist");
		await user.save();
		// await this.usersData.findOneAndUpdate({ "steam.steamid": steamID }, { $set: { "whitelist.clan": null, "whitelist.byClan": false } });
		return true;
	}
	async clanKickUser(steamID) {
		await this.usersData.findOneAndUpdate({"steam.steamid": steamID}, { $set: { "whitelist.clan": null, "whitelist.byClan": false } });
		return true;
	}
	async clanAddUser(steamID,clanID) {
		await this.usersData.findOneAndUpdate({"steam.steamid": steamID}, { $set: { "whitelist.clan": clanID, "whitelist.byClan": false } });
		return true;
	}
	async clanAcceptApp(steamID,clanID) {
		const apps = await this.clansData.findOne( { id: clanID });
		for(const app in apps.applications)
		{
			if(apps.applications[app].steamID === steamID && apps.applications[app].status === true) 
			{
				apps.applications[app].status = false; 
			}
		}
		apps.markModified("applications");
		await apps.save();
		await this.usersData.findOneAndUpdate({"steam.steamid": steamID}, { $set: { "whitelist.clan": clanID, "whitelist.byClan": false } });
		return true;
	}
	async clanRejectApp(steamID,clanID) {
		const apps = await this.clansData.findOne( { id: clanID });
		for(const app in apps.applications)
		{
			if(apps.applications[app].steamID === steamID && apps.applications[app].status === true) 
			{
				//remove it 
			}
		}
		apps.markModified("applications");
		await apps.save();
		await this.usersData.findOneAndUpdate({"steam.steamid": steamID}, { $set: { "whitelist.clan": null, "whitelist.byClan": false } });
		return true;
	}
	async setClanWhiteLimit(clanID, limit) {
		const clans = await this.clansData.find({id: clanID});
		if (!clans) return;
		await this.clansData.findOneAndUpdate({id: clanID}, { $set: { "whitelistLimit": limit } });
		return true;
	}
	async getAllDiffrentRoles() {
		const perms = await this.permission.findOne({});
		if (!perms) return;
		return perms.allRoles;
	}

	async getAllPagesCanSee() {
		const perms = await this.permission.findOne({});
		if (!perms) return;
		// look inside canSee and whoCan and put all diffrent values in an array
		const pages = [];
		for (const key in perms.canSee) {
			if (perms.canSee[key]) pages.push(key);
		}
		return pages;
	}

	async getAllActionsWhoCan() {
		const perms = await this.permission.findOne({});
		if (!perms) return;
		return perms.whoCan;
	}

	// Check if userID can access/see the route/page
	async canAccess(route, userID) {
		const perms = await this.permission.find().lean();
		const user = await this.findOrCreateUser({ id: userID });
		let response = false;
		if (perms.length === 0) return false;

		// Loop trough perms.canSee and search for route in it
		for (const key in perms[0].canSee) {
			if (key === route) {
				// Loop trough the roles in the array
				for (const role of perms[0].canSee[key]) {
					// Loop trough user.roles and check if the keys that have true as value are included in role now it is an array
					for (const userRole of user.roles) {
						if (userRole === role) response = true;
					}
				}
			}
		}
		return response;
	}

	// Will get the secret key for the whitelist URL (used for the remote whitelist link)
	async getWhitelistToken() {
		// get the token from the whitelists collection
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		return whitelist.token;
	}

	// Will generate a random string that is 32 characters long
	async generateToken() {
		let token = "";
		const characters =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwzy0123456789_";
		for (let i = 0; i < 32; i++) {
			token += characters.charAt(Math.floor(Math.random() * characters.length));
		}
		return token;
	}

	// Will regenerate a random string with 32 characters
	async regenerateToken() {
		// get the token from the whitelists collection
		const whitelist = await this.whitelists.findOne({});
		if (!whitelist) return;
		// generate a new token
		const token = await this.generateToken();
		// update the token in the whitelists collection
		await this.whitelists.findOneAndUpdate({}, { $set: { token: token } });
		return token;
	}

	// Will init the mysql pool
	async setPool() {
		const guildID = this.config.serverID;
		let guild = await this.guildsData.findOne({ id: guildID });
		if (!guild) {
			guild = new this.guildsData({ id: guildID });
			await guild.save();
			this.databaseCache.guilds.set(guildID, guild);
		}
		const pool = await mysql.createPool({
			connectionLimit: 10, // Call all
			host: guild.plugins.squad.db.host,
			port: guild.plugins.squad.db.port,
			user: guild.plugins.squad.db.user,
			password: guild.plugins.squad.db.password,
			database: guild.plugins.squad.db.database,
		});
		return pool;
	}

	async getPreviusMap(callback) {
		const pool = this.pool;
		const res = new MYSQLPromiseObjectBuilder(pool);
		await res
			.add(
				"PreviusMap", // object key
				"SELECT layerClassName FROM DBLog_Matches WHERE endTime IS NULL ORDER BY startTime DESC LIMIT 1;",
				"Not connected with DB", // default value when null, 0 or nothing
				"layerClassName" // this is the name of the column
			)
			.then((res) => {
				return callback(res);
			});
	}

	// Will update a users squad stats
	async updateStats(userID) {
		const user = await this.findOrCreateUser({ id: userID });
		if (!user) return console.log("No User found.");
		const steamUID = user.steam.steamid;
		const pool = this.pool;
		const res = new MYSQLPromiseObjectBuilder(pool);
		await res.add(
			"kd", // object key
			`SELECT (COUNT(*)/(SELECT COUNT(*) FROM DBLog_Deaths WHERE victim = "${steamUID}")) AS KD FROM DBLog_Deaths WHERE attacker="${steamUID}"`,
			"0", // default value when null, 0 or nothing
			"KD" // this is the name of the column
		);
		await res.add(
			"Kills_ALL",
			`SELECT COUNT(*) AS Kills_ALL FROM DBLog_Deaths WHERE attacker = "${steamUID}"`,
			"0",
			"Kills_ALL"
		);
		await res.add(
			"Matches",
			`SELECT COUNT(DISTINCT(\`match\`)) FROM DBLog_Deaths WHERE attacker = "${steamUID}" AND \`match\` IS NOT NULL`,
			"0",
			"Maches_ALL"
		);
		await res.add(
			"deaths",
			`SELECT COUNT(*) AS Deaths FROM DBLog_Deaths WHERE victim = "${steamUID}"`,
			"0",
			"Deaths"
		);
		await res.add(
			"woundsINF",
			`SELECT COUNT(*) AS Wounds_INF FROM DBLog_Wounds WHERE attacker = "${steamUID}" AND weapon NOT REGEXP '(kord|stryker|uh60|projectile|mortar|btr80|btr82|deployable|kornet|s5|s8|tow|crows|50cal|warrior|coax|L30A1|_hesh|_AP|technical|shield|DShK|brdm|2A20|LAV|M1126|T72|bmp2|SPG9|FV4034|Truck|logi|FV432|2A46|Tigr)'`,
			"0",
			"Wounds_INF"
		);
		await res.add(
			"woundsVEH",
			`SELECT COUNT(*) AS Wounds_VEH FROM DBLog_Wounds WHERE attacker = "${steamUID}" AND weapon REGEXP '(kord|stryker|uh60|projectile|mortar|btr80|btr82|deployable|kornet|s5|s8|tow|crows|50cal|warrior|coax|L30A1|_hesh|_AP|technical|shield|DShK|brdm|2A20|LAV|M1126|T72|bmp2|SPG9|FV4034|Truck|logi|FV432|2A46|Tigr)'`,
			"0",
			"Wounds_VEH"
		);
		await res.add(
			"revives",
			`SELECT COUNT(*) AS Revives FROM DBLog_Revives WHERE reviver = "${steamUID}"`,
			"0",
			"Revives"
		);
		await res.add(
			"tk",
			`SELECT COUNT(*) AS TeamKills FROM DBLog_Wounds WHERE attacker = "${steamUID}" AND teamkill=1`,
			"0",
			"TeamKills"
		);
		await res.add(
			"mk_gun",
			`SELECT weapon AS Fav_Gun FROM DBLog_Wounds WHERE attacker = "${steamUID}" GROUP BY weapon ORDER BY COUNT(weapon) DESC LIMIT 1`,
			"0",
			"Fav_Gun"
		);
		await res.add(
			"mk_role",
			`SELECT weapon AS Fav_Role FROM DBLog_Deaths WHERE attacker = "${steamUID}" GROUP BY weapon ORDER BY COUNT(weapon) DESC LIMIT 1`,
			"0",
			"Fav_Role"
		);
		await res.waitForAll(user.squad);
		let dt = new Date();
		dt = dt.setHours(dt.getHours() + 2);
		dt = new Date(dt);
		user.squad.trackDate = dt;
		if (!user.squad.tracking) {
			user.squad.tracking = true;
		}
		await user.markModified("squad");
		await user.save();
		return true;
	}

	// Get all player squad stats from mongoose
	async getLeaderboard() {
		const users = await this.usersData.find({ "squad.kd": { $exists: true } });
		users.map((user) => user.squad.kd).sort();
		// return only users squad object and steam.name if it exist
		return users.map((user) => {
			if (user.steam?.personaname)
				return {
					name: user.steam.personaname,
					id: user.steam.steamid,
					avatar: user.steam.avatar,
					squad: user.squad,
				};
		});
	}

	async getAllUsers() {
		const users = await this.usersData.find({});
		return users;
	}

	async toggleUserRole(userID, role) {
		const user = await this.findOrCreateUser({ id: userID });
		if (!user) return false;
		let action = "";
		// check if user has role and remove it
		if (user.roles.includes(role)) {
			user.roles = user.roles.filter((r) => r !== role);
			action = "removed";
		} else {
			user.roles.push(role);
			action = "added";
		}
		await user.save();
		return action;
	}

	async toggleWhoCan(typeAction, role) {
		const permissions = await this.permission.findOne({});
		if (!permissions) return false;
		if (permissions.whoCan[typeAction].includes(role)) {
			permissions.whoCan[typeAction] = permissions.whoCan[typeAction].filter(
				(r) => r !== role
			);
			// mark modified and save
			await permissions.markModified("whoCan");
			await permissions.save();
			return "removed";
		} else {
			permissions.whoCan[typeAction].push(role);
			// mark modified and save
			await permissions.markModified("whoCan");
			await permissions.save();
			return "added";
		}
	}

	async toggleCanSee(page, role) {
		const permissions = await this.permission.findOne({});
		if (!permissions) return false;
		if (permissions.canSee[page].includes(role)) {
			permissions.canSee[page] = permissions.canSee[page].filter(
				(r) => r !== role
			);
			// mark modified and save
			await permissions.markModified("canSee");
			await permissions.save();
			return "removed";
		} else {
			permissions.canSee[page].push(role);
			// mark modified and save
			await permissions.markModified("canSee");
			await permissions.save();
			return "added";
		}
	}

	async addUserRole(role) {
		const permissions = await this.permission.findOne({});
		if (!permissions) return false;
		permissions.allRoles.push(role);
		// mark modified and save
		await permissions.markModified("allRoles");
		await permissions.save();
		return true;
	}

	async removeUserRole(role) {
		const permissions = await this.permission.findOne({});
		if (!permissions) return false;
		permissions.allRoles = permissions.allRoles.filter((r) => r !== role);
		for (const key in permissions.whoCan) {
			permissions.whoCan[key] = permissions.whoCan[key].filter(
				(r) => r !== role
			);
		}
		for (const key in permissions.canSee) {
			permissions.canSee[key] = permissions.canSee[key].filter(
				(r) => r !== role
			);
		}
		// mark modified and save
		await permissions.markModified("allRoles");
		await permissions.markModified("whoCan");
		await permissions.markModified("canSee");
		await permissions.save();
		return true;
	}

	// This function is used to resolve a user from a string (his name or id for example when searching it)
	async resolveUser(search) {
		let user = null;
		if (!search || typeof search !== "string") return;
		// Try ID search
		if (search.match(/^<@!?(\d+)>$/)) {
			const id = search.match(/^<@!?(\d+)>$/)[1];
			user = this.users.fetch(id).catch(() => {});
			if (user) return user;
		}
		// Try username search
		if (search.match(/^!?(\w+)#(\d+)$/)) {
			const username = search.match(/^!?(\w+)#(\d+)$/)[0];
			const discriminator = search.match(/^!?(\w+)#(\d+)$/)[1];
			user = this.users.find(
				(u) => u.username === username && u.discriminator === discriminator
			);
			if (user) return user;
		}
		user = await this.users.fetch(search).catch(() => {});
		return user;
	}

	// Get all data from audit logs form mongoose
	async getAuditLogs() {
		const logs = await this.audit.find({});
		return logs;
	}

	async getShowNotifications() {
		const guild = await this.findOrCreateGuild({ id: this.config.serverID });
		return guild.dashboard.showNotifications;
	}

	async getUpdatePlayersTable() {
		const guild = await this.findOrCreateGuild({ id: this.config.serverID });
		return guild.dashboard.updatePlayersTable;
	}

	async toggleShowNotifications(actionType) {
		const guild = await this.findOrCreateGuild({ id: this.config.serverID });
		if (guild) {
			for (const action in guild.dashboard.showNotifications) {
				if (action === actionType) {
					guild.dashboard.showNotifications[action] =
						!guild.dashboard.showNotifications[action];
				}
			}
		}
		await guild.markModified("dashboard.showNotifications");
		await guild.save();
	}

	async toggleUpdatePlayersTable(actionType) {
		const guild = await this.findOrCreateGuild({ id: this.config.serverID });
		if (guild) {
			for (const action in guild.dashboard.updatePlayersTable) {
				if (action === actionType) {
					guild.dashboard.updatePlayersTable[action] =
						!guild.dashboard.updatePlayersTable[action];
				}
			}
		}
		await guild.markModified("dashboard.updatePlayersTable");
		await guild.save();
	}

	async toggleDashboardSettings(typeSetting, actionType) {
		switch (typeSetting) {
			case "notifications":
				await this.toggleShowNotifications(actionType);
				break;
			case "updates":
				await this.toggleUpdatePlayersTable(actionType);
				break;
		}
	}

	// This function is used to resolve a role from a string (his name or id for example when searching it)
	async resolveRole(search, guild) {
		let role = null;
		if (!search || typeof search !== "string") return;
		// Try ID search
		if (search.match(/^<@&!?(\d+)>$/)) {
			const id = search.match(/^<@&!?(\d+)>$/)[1];
			role = guild.roles.cache.get(id);
			if (role) return role;
		}
		// Try name search
		role = guild.roles.cache.find((r) => search === r.name);
		if (role) return role;
		role = guild.roles.cache.get(search);
		return role;
	}
}

module.exports = SquadStatsJSv3;
