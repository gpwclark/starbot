
'use strict'

const _ = require('lodash')
const config = require('../config')

const msgDefaults = {
  response_type: 'in_channel',
  username: 'chaosmonkey',
  icon_emoji: config('ICON_EMOJI')
}

let attachments = [
  {
    title: 'chaosmonkey will help you find the hippest repos on GitHub',
    color: '#2FA44F',
    text: '`/chaosmonkey repos` returns hip repos \n`/chaosmonkey javascript` returns hip JavaScript repos',
    mrkdwn_in: ['text']
  },
  {
    title: 'Configuring chaosmonkey',
    color: '#E3E4E6',
    text: '`/chaosmonkey help` ... you\'re lookin at it! \n',
    mrkdwn_in: ['text']
  }
]

const handler = (payload, res) => {
  let msg = _.defaults({
    channel: payload.channel_name,
    attachments: attachments
  }, msgDefaults)

  res.set('content-type', 'application/json')
  res.status(200).json(msg)
  return
}

module.exports = { pattern: /help/ig, handler: handler }
