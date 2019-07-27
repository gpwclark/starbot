import { Client } from 'espn-fantasy-football-api/node';
import axios from 'axios';

'use strict'

const slack = require('slack')
const _ = require('lodash')
const config = require('./config')
//const ffClient = require('espn-fantasy-football-api/node');

let bot = slack.rtm.client()
let leagueId = process.env.LEAGUE_ID;
let seasonId = process.env.SEASON_ID;
let espnS2 = process.env.ESPN_S2;
let swid = process.env.SWID;
const ffClient = new Client({ leagueId: leagueId });
//http://fantasy.espn.com/apis/v3/games/ffl/seasons/2019/segments/0/leagues/168284
const baseApi = "https://fantasy.espn.com/apis/v3/games/ffl/seasons/"

function getMessage() {
	return `beep boop! ${leagueId} ${seasonId}"`
}

/**
 * Correctly builds an axios config with cookies, if set on the instance
 * @param  {object} config An axios config.
 * @return {object}        An axios config with cookies added if set on instance
 *  @private
 *
 */
function _buildAxiosConfig(config) {
	if ((espnS2 && swid)) {
		const headers = { Cookie: `espn_s2=${espnS2}; SWID=${swid};` };
		return _.merge({}, config, { headers, withCredentials: true });
	}
	return config;
}

function getTeamsInLeague(seasonId) {
//http://fantasy.espn.com/apis/v3/games/ffl/seasons/2019/segments/0/leagues/168284
	const routeBase = `${seasonId}/segments/0/leagues/${leagueId}`;
	const routeParams = `?view=mRoster&view=mTeam&view=modular&view=mNav`;
	const route = `${baseApi}${routeBase}${routeParams}`;

	return axios.get(route, _buildAxiosConfig()).then((response) => {
		const members = _.get(response.data, 'members');
		//const data = _.filter(schedule, { matchupPeriodId });
		return members;
		/*
		const schedule = _.get(response.data, 'schedule');
		const data = _.filter(schedule, { matchupPeriodId });

		return _.map(data, (matchup) => (
			Boxscore.buildFromServer(matchup, { leagueId: this.leagueId, seasonId })
		));
		*/
	}).catch((err) => {
		console.log(`great ${err} ${JSON.stringify(err)}`);
	});
}

bot.started((payload) => {
	bot.self = payload.self
	console.log(`BOT: leagueid: ${leagueId} seasonid: ${seasonId}`);
	console.log(`auth: swid: ${swid} espnS2: ${espnS2}`);
	ffClient.setCookies({ espnS2: espnS2, SWID: swid });
	getTeamsInLeague(seasonId).then((bs) => {
		console.log("meow");
		console.log(JSON.stringify(bs));
		bot.teams= JSON.stringify(bs);
	});
});

bot.message((msg) => {
	if (!msg.user) return
	if (!_.includes(msg.text.match(/<@([A-Z0-9])+>/igm), `<@${bot.self.id}>`)) return

	slack.chat.postMessage({
		token: config('SLACK_TOKEN'),
		icon_emoji: config('ICON_EMOJI'),
		channel: msg.channel,
		username: 'C ⚛ H ⛾ A ☭ O ⛐ S  ☉ M ☲ O ☬ N ⚰ K ♛ E ⛤ Y',
		text: `${bot.teams}`
	}, (err, data) => {
		if (err) throw err

		let txt = _.truncate(data.message.text)

		console.log(`🤖  beep boop: I responded with "${txt}"`)
	})
});

module.exports = bot
