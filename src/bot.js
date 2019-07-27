
'use strict'

const slack = require('slack')
const _ = require('lodash')
const config = require('./config')
const ffClient = require('espn-fantasy-football-api/node');

let bot = slack.rtm.client()
let leagueId = process.env.LEAGUE_ID;
let seasonId = process.env.SEASON_ID;
//const myClient = new ffClient({ leagueId: leagueId });

function getMessage() {
	return `beep boop! ${leagueId} ${seasonId}"`
}

bot.started((payload) => {
  this.self = payload.self
	console.log("BOT: " + JSON.stringify(ffClient));
})

bot.message((msg) => {
  if (!msg.user) return
  if (!_.includes(msg.text.match(/<@([A-Z0-9])+>/igm), `<@${this.self.id}>`)) return

  slack.chat.postMessage({
    token: config('SLACK_TOKEN'),
    icon_emoji: config('ICON_EMOJI'),
    channel: msg.channel,
    username: 'C ⚛ H ⛾ A ☭ O ⛐ S  ☉ M ☲ O ☬ N ⚰ K ♛ E ⛤ Y',
    text: getMessage()
  }, (err, data) => {
    if (err) throw err

    let txt = _.truncate(data.message.text)

    console.log(`🤖  beep boop: I responded with "${txt}"`)
  })
})

module.exports = bot
